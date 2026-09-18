// matplotlib.pyplot 흉내 — 이 수업에 나오는 그림은 상자그림 하나뿐이다.
// 그림 "그리기"는 화면 쪽(src/ui/figure.js)이 SVG 로 하고, 여기서는
// 어떤 그림판(Figure)에 어떤 칸(Axes)이 있고 무엇을 그렸는지만 기록한다.
import { PyFunc, PyError, Tuple, Num, parseArgs, toNumber, pyInt, str as pyStr, NotSupported } from './pyvalues.js';
import { percentileSorted } from './numfmt.js';

export class Figure {
  constructor(w = 6.4, h = 4.8) { this.w = w; this.h = h; this.axes = []; this.current = null; }
  get pyType() { return 'Figure'; }
  repr() { return `<Figure size ${Math.round(this.w * 100)}x${Math.round(this.h * 100)} with ${this.axes.length} Axes>`; }
  equals(o) { return o instanceof Figure && JSON.stringify(summary(this)) === JSON.stringify(summary(o)); }
}

export class Axes {
  constructor(fig, nrows = 1, ncols = 1, index = 1) {
    this.fig = fig; this.nrows = nrows; this.ncols = ncols; this.index = index;
    this.boxes = []; this.title = ''; this.xlabel = ''; this.ylabel = ''; this.grid = false;
  }
  get pyType() { return 'Axes'; }
  repr() { return this.title ? `<Axes: title={'center': '${this.title}'}>` : '<Axes: >'; }
  equals(o) { return o instanceof Axes && JSON.stringify(axSummary(this)) === JSON.stringify(axSummary(o)); }
}

function axSummary(ax) {
  return { pos: [ax.nrows, ax.ncols, ax.index], title: ax.title, boxes: ax.boxes.map((b) => [b.label, b.values.length, b.stats.med]) };
}
function summary(fig) { return fig.axes.map(axSummary); }

// matplotlib 의 상자그림 수치 — 사분위수는 선형 보간, 수염은 1.5×IQR 안쪽의 실제 가장 먼 값
export function boxStats(values, whis = 1.5) {
  const x = values.filter((v) => !Number.isNaN(v)).sort((a, b) => a - b);
  if (!x.length) return null;
  const q1 = percentileSorted(x, 25), med = percentileSorted(x, 50), q3 = percentileSorted(x, 75);
  const iqr = q3 - q1;
  const loval = q1 - whis * iqr, hival = q3 + whis * iqr;
  const inHi = x.filter((v) => v <= hival);
  const inLo = x.filter((v) => v >= loval);
  const whishi = inHi.length && inHi[inHi.length - 1] >= q3 ? inHi[inHi.length - 1] : q3;
  const whislo = inLo.length && inLo[0] <= q1 ? inLo[0] : q1;
  const fliers = x.filter((v) => v < whislo || v > whishi);
  return { whislo, q1, med, q3, whishi, fliers, loval, hival, iqr, mean: x.reduce((a, b) => a + b, 0) / x.length };
}

// 그림 상태 — 셀을 실행하는 동안의 "현재 그림판"
export class PlotState {
  constructor(onShow) { this.figs = []; this.onShow = onShow; }

  figure(size) {
    const [w, h] = size ?? [6.4, 4.8];
    const f = new Figure(w, h);
    this.figs.push(f);
    return f;
  }
  gcf() { return this.figs[this.figs.length - 1] ?? this.figure(); }
  gca() {
    const f = this.gcf();
    if (!f.current) { f.current = new Axes(f); f.axes.push(f.current); }
    return f.current;
  }
  subplot(nrows, ncols, index) {
    const f = this.gcf();
    if (index < 1 || index > nrows * ncols) {
      throw new PyError('ValueError', `num must be an integer with 1 <= num <= ${nrows * ncols}, not ${index}`,
        `plt.subplot(${nrows}, ${ncols}, 번호) 의 번호는 1 부터 ${nrows * ncols} 사이여야 합니다.`);
    }
    let ax = f.axes.find((a) => a.nrows === nrows && a.ncols === ncols && a.index === index);
    if (!ax) {
      // 1×1 로 이미 그려 둔 칸이 있으면 matplotlib 처럼 새 배치가 그 칸을 덮는다
      f.axes = f.axes.filter((a) => !(a.nrows === 1 && a.ncols === 1 && nrows * ncols > 1 && a.boxes.length === 0));
      ax = new Axes(f, nrows, ncols, index); f.axes.push(ax);
    }
    f.current = ax;
    return ax;
  }
  boxplot(boxes, { grid = true, figsize = null } = {}) {
    if (figsize) this.figure(figsize.items.map((v) => toNumber(v)));
    const ax = this.gca();
    ax.boxes = boxes.map((b) => ({ ...b, stats: boxStats(b.values) }));
    ax.grid = grid;
    return ax;
  }
  // plt.show() 또는 셀이 끝날 때 — 그린 그림판을 밖으로 내보내고 비운다
  flush() {
    const out = this.figs.filter((f) => f.axes.length > 0);
    this.figs = [];
    out.forEach((f) => this.onShow(f));
  }
}

// pyplot 모듈이 가진 함수들
export function pyplotAttrs(ctxGetter) {
  const fn = (name, spec, body) => new PyFunc(name, (args, kw) => body(parseArgs(name, args, kw, spec), ctxGetter()), { kind: 'function' });
  return {
    figure: fn('figure', [['num', null], ['figsize', null], ['dpi', null]], (o, ctx) => {
      let size = null;
      if (o.figsize) {
        const items = o.figsize instanceof Tuple ? o.figsize.items : Array.isArray(o.figsize) ? o.figsize : null;
        if (!items || items.length !== 2) throw new PyError('ValueError', 'figsize must be a tuple of 2 numbers', 'figsize 는 (가로, 세로) 두 수로 적습니다. 예) figsize=(12, 6)');
        size = items.map((v) => toNumber(v));
      }
      return ctx.plt.figure(size);
    }),
    subplot: new PyFunc('subplot', (args, kw) => {
      const ctx = ctxGetter();
      let nums = args.map((a) => toNumber(a));
      if (nums.length === 1) {
        const v = nums[0];
        if (v < 111 || v > 999) throw new PyError('ValueError', `Integer subplot specification must be a three-digit number, not ${v}`, 'plt.subplot(1, 2, 1) 처럼 세 수를 쉼표로 나눠 적거나, 121 처럼 세 자리 수로 적습니다.');
        nums = [Math.floor(v / 100), Math.floor(v / 10) % 10, v % 10];
      }
      if (nums.length !== 3) {
        throw new PyError('TypeError', `subplot() takes 1 or 3 positional arguments but ${nums.length} were given`,
          'plt.subplot(행 수, 열 수, 몇 번째 칸) 세 수를 넣습니다. 예) 한 줄에 두 칸 중 첫째 칸 → plt.subplot(1, 2, 1)');
      }
      return ctx.plt.subplot(nums[0], nums[1], nums[2]);
    }, { kind: 'function' }),
    show: fn('show', [], (o, ctx) => { ctx.plt.flush(); return null; }),
    title: fn('title', [['label', ''], ['fontsize', null]], (o, ctx) => { ctx.plt.gca().title = pyStr(o.label); return null; }),
    xlabel: fn('xlabel', [['xlabel', ''], ['fontsize', null]], (o, ctx) => { ctx.plt.gca().xlabel = pyStr(o.xlabel); return null; }),
    ylabel: fn('ylabel', [['ylabel', ''], ['fontsize', null]], (o, ctx) => { ctx.plt.gca().ylabel = pyStr(o.ylabel); return null; }),
    tight_layout: fn('tight_layout', [], () => null),
    grid: fn('grid', [['visible', true]], (o, ctx) => { ctx.plt.gca().grid = o.visible !== false; return null; }),
    boxplot: new PyFunc('boxplot', () => { throw new NotSupported('plt.boxplot( ) — 이 실습실에서는 표.boxplot( ) 을 씁니다'); }, { kind: 'function' }),
    plot: new PyFunc('plot', () => { throw new NotSupported('plt.plot( )'); }, { kind: 'function' }),
    hist: new PyFunc('hist', () => { throw new NotSupported('plt.hist( )'); }, { kind: 'function' }),
    scatter: new PyFunc('scatter', () => { throw new NotSupported('plt.scatter( )'); }, { kind: 'function' }),
    savefig: new PyFunc('savefig', () => { throw new NotSupported('plt.savefig( ) — 파일 저장'); }, { kind: 'function' }),
  };
}

export { pyInt, Num };
