// 👀 눈으로 보기 — 단계마다 개념을 손으로 만져 보는 화면
//   table  : 1단계 데이터 표 전체와 열 설명
//   missing: 2단계 빈칸 지도, 평균과 중앙값
//   iqr    : 3단계 IQR 울타리 실험실
//   minmax : 4단계 정규화 계산기
// 계산은 모두 같은 엔진(src/engine)으로 한다 — 노트북 결과와 숫자가 어긋나지 않게.
import { h, svg, rich, fill } from '../lib/ui.js';
import { Kernel } from '../engine/interp.js';
import { boxStats } from '../engine/plotting.js';
import { COLUMNS } from '../lessons/data.js';
import { niceTicks } from './figure.js';

const NUM4 = COLUMNS.slice(0, 4);
const ko = (name) => COLUMNS.find((c) => c.name === name)?.ko ?? name;
const unit = (name) => COLUMNS.find((c) => c.name === name)?.unit ?? '';

function prepared(files, stage) {
  const k = new Kernel({ files });
  const run = (code) => { const r = k.run(code); if (r.error) throw new Error(r.error.message); };
  run("import pandas as pd\nimport numpy as np\npenguins = pd.read_csv('penguins.csv')\nraw = penguins.copy()");
  if (stage >= 2) {
    for (const c of NUM4) run(`penguins['${c.name}'] = penguins['${c.name}'].fillna(penguins['${c.name}'].mean())`);
  }
  if (stage >= 3) {
    run("q1, q3 = np.percentile(penguins['body_mass_g'],[25, 75])\niqr = q3 - q1\noutliers = penguins['body_mass_g'][(penguins['body_mass_g'] > q3 + 1.5 * iqr)|(penguins['body_mass_g'] < q1 - 1.5 * iqr)]\npenguins_new = penguins.drop(index = outliers.index)[['bill_length_mm', 'bill_depth_mm', 'flipper_length_mm', 'body_mass_g']]");
  }
  return k.env;
}

function fmt(v, d = 2) {
  if (Number.isNaN(v)) return 'NaN';
  const r = Math.round(v * 10 ** d) / 10 ** d;
  return r.toLocaleString('ko-KR', { maximumFractionDigits: d });
}

function pills(options, current, onPick) {
  return h('div', { class: 'pills', role: 'group' }, options.map(([value, label]) =>
    h('button', { class: `pill ${value === current ? 'on' : ''}`, 'aria-pressed': String(value === current), onClick: () => onPick(value) }, label)));
}

export function buildPanel(kind, files) {
  const wrap = h('details', { class: 'panel', open: true },
    h('summary', {}, '👀 눈으로 보기 — ', { table: '데이터 표 살펴보기', missing: '빈칸 지도와 평균·중앙값', iqr: 'IQR 울타리 실험실', minmax: '정규화 계산기' }[kind]));
  const body = h('div', { class: 'panel-body' });
  wrap.appendChild(body);
  const make = { table: tablePanel, missing: missingPanel, iqr: iqrPanel, minmax: minmaxPanel }[kind];
  try { make(body, files); } catch (e) { console.error(e); body.appendChild(h('p', {}, '이 화면을 그리지 못했습니다: ' + e.message)); }
  return wrap;
}

// ───────────────────────────────────────────────────────────
// 1단계 — 표 전체 보기
// ───────────────────────────────────────────────────────────
function tablePanel(body, files) {
  const env = prepared(files, 1);
  const df = env.get('penguins');
  const stats = Object.fromEntries(NUM4.map((c) => [c.name, boxStats(df.data[c.name])]));
  const suspicious = (col, v) => stats[col] && !Number.isNaN(v) && (v < stats[col].whislo || v > stats[col].whishi);
  let sortCol = null, sortDir = 0, mark = false;

  body.appendChild(h('div', { class: 'col-cards' }, COLUMNS.map((c) => h('div', { class: 'col-card' },
    h('div', { class: 'col-name' }, h('code', {}, c.name)), h('div', { class: 'col-ko' }, c.ko, c.unit && h('span', { class: 'unit' }, ` (${c.unit})`)), h('div', { class: 'col-desc' }, c.desc)))));
  body.appendChild(penguinDiagram());

  const tableBox = h('div', { class: 'table-scroll' });
  const note = h('p', { class: 'tiny' });
  const markBtn = h('label', { class: 'check' }, h('input', { type: 'checkbox', onChange: (e) => { mark = e.target.checked; draw(); } }), ' 🔎 튀는 값 칠하기 (상자그림 수염 밖의 값)');
  body.appendChild(h('div', { class: 'row-between' }, h('p', {}, rich('열 이름을 누르면 정렬됩니다. 빨간 칸은 비어 있는 값(NaN)입니다.')), markBtn));
  body.appendChild(tableBox);
  body.appendChild(note);

  function draw() {
    let order = df.index.labels.map((_, i) => i);
    if (sortCol) {
      const vals = df.data[sortCol];
      order.sort((a, b) => {
        const x = vals[a], y = vals[b];
        const xn = typeof x === 'number' && Number.isNaN(x), yn = typeof y === 'number' && Number.isNaN(y);
        if (xn || yn) return xn - yn;
        return (x < y ? -1 : x > y ? 1 : 0) * sortDir;
      });
    }
    const head = h('tr', {}, h('th', {}, '번호'), df.columns.map((c) => h('th', {
      class: 'sortable', onClick: () => { if (sortCol !== c) { sortCol = c; sortDir = 1; } else if (sortDir === 1) sortDir = -1; else { sortCol = null; sortDir = 0; } draw(); },
    }, c, sortCol === c ? (sortDir > 0 ? ' ▲' : ' ▼') : '')));
    let naCount = 0, oddCount = 0;
    const rows = order.map((i) => h('tr', {}, h('th', {}, String(df.index.labels[i])), df.columns.map((c) => {
      const v = df.data[c][i];
      const na = typeof v === 'number' && Number.isNaN(v);
      const odd = mark && suspicious(c, v);
      if (na) naCount++;
      if (odd) oddCount++;
      return h('td', { class: na ? 'na' : odd ? 'odd' : '' }, na ? 'NaN' : String(v));
    })));
    fill(tableBox, h('table', { class: 'data' }, h('thead', {}, head), h('tbody', {}, rows)));
    note.textContent = `150행 × 5열 · 빈칸 ${naCount}칸` + (mark ? ` · 튀는 값 ${oddCount}칸 (정말 잘못된 값인지는 다음 단계들에서 따져 봅니다)` : '');
  }
  draw();
}

function penguinDiagram() {
  // 부리 길이·두께가 어디를 잰 것인지 보여 주는 단순한 그림
  const s = svg('svg', { viewBox: '0 0 430 150', class: 'diagram', role: 'img', 'aria-label': '부리 길이와 부리 두께를 재는 위치' },
    svg('ellipse', { cx: 95, cy: 80, rx: 70, ry: 58, fill: '#1e293b' }),
    svg('ellipse', { cx: 108, cy: 92, rx: 40, ry: 40, fill: '#f8fafc' }),
    svg('circle', { cx: 120, cy: 62, r: 7, fill: '#fff' }), svg('circle', { cx: 122, cy: 62, r: 3.5, fill: '#0f172a' }),
    svg('path', { d: 'M158 66 L285 80 L158 96 Z', fill: '#f59e0b' }),
    svg('line', { x1: 158, y1: 120, x2: 285, y2: 120, stroke: '#dc2626', 'stroke-width': 3, 'marker-start': 'url(#ar)', 'marker-end': 'url(#ar)' }),
    svg('text', { x: 222, y: 142, 'text-anchor': 'middle', class: 'dg-label' }, '부리 길이 bill_length_mm'),
    svg('line', { x1: 300, y1: 66, x2: 300, y2: 96, stroke: '#2563eb', 'stroke-width': 3, 'marker-start': 'url(#ab)', 'marker-end': 'url(#ab)' }),
    svg('text', { x: 308, y: 55, class: 'dg-label' }, '부리 두께'),
    svg('text', { x: 308, y: 110, class: 'dg-label small' }, 'bill_depth_mm'),
    svg('defs', {},
      svg('marker', { id: 'ar', viewBox: '0 0 10 10', refX: 5, refY: 5, markerWidth: 5, markerHeight: 5, orient: 'auto-start-reverse' }, svg('path', { d: 'M0 0 L10 5 L0 10 z', fill: '#dc2626' })),
      svg('marker', { id: 'ab', viewBox: '0 0 10 10', refX: 5, refY: 5, markerWidth: 5, markerHeight: 5, orient: 'auto-start-reverse' }, svg('path', { d: 'M0 0 L10 5 L0 10 z', fill: '#2563eb' }))));
  return h('div', { class: 'diagram-wrap' }, s, h('p', { class: 'tiny' }, '날개 길이(flipper_length_mm)는 헤엄칠 때 쓰는 날개의 길이, 몸무게(body_mass_g)는 그램 단위입니다.'));
}

// ───────────────────────────────────────────────────────────
// 2단계 — 빈칸 지도, 평균·중앙값
// ───────────────────────────────────────────────────────────
function missingPanel(body, files) {
  const env = prepared(files, 2);
  const raw = env.get('raw'), filled = env.get('penguins');
  let showFilled = false, dropOdd = false;

  const map = h('div', { class: 'na-map' });
  const table = h('div', {});
  const toggle = pills([[false, '채우기 전'], [true, '평균으로 채운 뒤']], showFilled, (v) => { showFilled = v; draw(); });
  const toggleBox = h('div', {});
  body.appendChild(h('p', {}, rich('펭귄 150마리를 한 줄에 한 칸씩 늘어놓았습니다. 빨간 칸이 빈칸(NaN)입니다. 칸에 마우스를 올리면 몇 번 펭귄인지 보입니다.')));
  body.appendChild(toggleBox);
  body.appendChild(map);
  body.appendChild(table);

  function draw() {
    fill(toggleBox, pills([[false, '채우기 전'], [true, '평균으로 채운 뒤']], showFilled, (v) => { showFilled = v; draw(); }));
    fill(map, ...NUM4.map((c) => h('div', { class: 'na-row' },
      h('div', { class: 'na-label' }, h('code', {}, c.name), h('span', { class: 'unit' }, ` ${c.ko}`)),
      h('div', { class: 'na-cells' }, raw.data[c.name].map((v, i) => {
        const na = Number.isNaN(v);
        const cls = na ? (showFilled ? 'cell filled' : 'cell miss') : 'cell';
        return h('span', { class: cls, title: na ? `${i}번 펭귄 — ${showFilled ? `평균 ${fmt(filled.data[c.name][i], 5)} 로 채움` : '비어 있음'}` : `${i}번 펭귄: ${v}` });
      })))));
    const rows = [];
    raw.index.labels.forEach((label, i) => {
      NUM4.forEach((c) => {
        if (Number.isNaN(raw.data[c.name][i])) {
          rows.push(h('tr', {}, h('td', {}, `${label}번`), h('td', {}, h('code', {}, c.name)), h('td', { class: 'na' }, 'NaN'),
            h('td', { class: showFilled ? 'filled-val' : 'muted' }, showFilled ? String(filled.data[c.name][i]) : '?')));
        }
      });
    });
    fill(table, h('table', { class: 'data small' },
      h('thead', {}, h('tr', {}, h('th', {}, '펭귄'), h('th', {}, '열'), h('th', {}, '원래 값'), h('th', {}, '채운 값'))), h('tbody', {}, rows)),
      h('p', { class: 'tiny' }, `빈칸 ${rows.length}칸. 같은 열의 빈칸은 모두 같은 값(그 열의 평균)으로 채워집니다.`));
  }
  draw();

  // 평균과 중앙값
  const meanBox = h('div', { class: 'meanbox' });
  body.appendChild(h('h4', { class: 'panel-h' }, '🤔 몸무게 평균(4272g)은 왜 중앙값(3975g)보다 클까?'));
  body.appendChild(meanBox);
  const drawMean = () => {
    const vals = raw.data.body_mass_g.filter((v) => !Number.isNaN(v));
    const used = dropOdd ? vals.filter((v) => v !== 12500 && v !== 850) : vals;
    const mean = used.reduce((a, b) => a + b, 0) / used.length;
    const sorted = [...used].sort((a, b) => a - b);
    const n = sorted.length;
    const median = n % 2 ? sorted[(n - 1) / 2] : (sorted[n / 2 - 1] + sorted[n / 2]) / 2;
    const W = 720, H = 150, lo = 0, hi = 13000, X = (v) => 30 + ((v - lo) / (hi - lo)) * (W - 60);
    const chart = svg('svg', { viewBox: `0 0 ${W} ${H}`, class: 'strip' });
    const { ticks } = niceTicks(lo, hi, 7);
    ticks.forEach((t) => {
      chart.appendChild(svg('line', { x1: X(t), x2: X(t), y1: 105, y2: 111, stroke: '#64748b' }));
      chart.appendChild(svg('text', { x: X(t), y: 128, 'text-anchor': 'middle', class: 'axis-t' }, String(t)));
    });
    chart.appendChild(svg('line', { x1: X(lo), x2: X(hi), y1: 105, y2: 105, stroke: '#64748b' }));
    vals.forEach((v, i) => {
      const odd = v === 12500 || v === 850;
      chart.appendChild(svg('circle', { cx: X(v), cy: 40 + ((i * 37) % 50), r: odd ? 6 : 3.5, fill: odd ? (dropOdd ? '#cbd5e1' : '#dc2626') : '#334155', opacity: odd && dropOdd ? 0.5 : 0.7 }, svg('title', {}, `${v}g`)));
    });
    chart.appendChild(svg('line', { x1: X(median), x2: X(median), y1: 22, y2: 105, stroke: '#2563eb', 'stroke-width': 3 }));
    chart.appendChild(svg('line', { x1: X(mean), x2: X(mean), y1: 22, y2: 105, stroke: '#f59e0b', 'stroke-width': 3, 'stroke-dasharray': '6 4' }));
    chart.appendChild(svg('text', { x: X(median) - 6, y: 16, 'text-anchor': 'end', class: 'lbl-blue' }, `중앙값 ${fmt(median, 1)}`));
    chart.appendChild(svg('text', { x: X(mean) + 6, y: 16, class: 'lbl-orange' }, `평균 ${fmt(mean, 1)}`));
    fill(meanBox, 
      h('label', { class: 'check' }, h('input', { type: 'checkbox', checked: dropOdd, onChange: (e) => { dropOdd = e.target.checked; drawMean(); } }), ' 빨간 두 값(12500g, 850g)을 빼고 계산해 보기'),
      h('div', { class: 'figure-wrap' }, chart),
      h('p', {}, dropOdd
        ? `두 값을 빼니 평균이 ${fmt(mean, 1)}g, 중앙값이 ${fmt(median, 1)}g 가 되었습니다. 평균은 크게 움직였지만 중앙값은 거의 그대로입니다.`
        : `평균은 모든 값을 더해 나누므로 12500g 처럼 동떨어진 큰 값에 끌려갑니다. 중앙값은 한가운데 순서의 값이라 잘 흔들리지 않습니다. 그래서 이상치가 있는 열의 빈칸은 중앙값으로 채우기도 합니다.`));
  };
  drawMean();
}

// ───────────────────────────────────────────────────────────
// 3단계 — IQR 울타리 실험실
// ───────────────────────────────────────────────────────────
function iqrPanel(body, files) {
  const env = prepared(files, 2);
  const df = env.get('penguins');
  // 수업에서 울타리 계수는 1.5 로 고정한다 (upper = q3 + 1.5 * iqr)
  const K = 1.5;
  let col = 'body_mass_g';
  const controls = h('div', { class: 'controls' });
  const chartBox = h('div', {});
  const numbers = h('div', { class: 'formula' });
  body.appendChild(h('p', {}, rich('열을 바꿔 보세요. 노트북의 `upper = q3 + 1.5 * iqr` 처럼, Q1·Q3 에서 IQR 의 1.5배만큼 떨어진 곳에 울타리를 칩니다. (결측치를 평균으로 채운 표로 계산합니다)')));
  body.appendChild(controls);
  body.appendChild(chartBox);
  body.appendChild(numbers);

  function draw() {
    const vals = df.data[col];
    const sorted = [...vals].sort((a, b) => a - b);
    const s = boxStats(vals);
    const lower = s.q1 - K * s.iqr, upper = s.q3 + K * s.iqr;
    const outs = df.index.labels.map((label, i) => [label, vals[i]]).filter(([, v]) => v < lower || v > upper);

    fill(controls, 
      h('div', { class: 'ctl' }, h('span', { class: 'ctl-l' }, '열'), pills(NUM4.map((c) => [c.name, c.ko]), col, (v) => { col = v; draw(); })));

    const W = 720, H = 272;
    const lo = Math.min(sorted[0], lower), hi = Math.max(sorted[sorted.length - 1], upper);
    const pad = (hi - lo) * 0.04;
    const X = (v) => 20 + ((v - (lo - pad)) / (hi - lo + 2 * pad)) * (W - 40);
    const c = svg('svg', { viewBox: `0 0 ${W} ${H}`, class: 'strip' });
    // 울타리 밖 영역
    c.appendChild(svg('rect', { x: 0, y: 44, width: Math.max(0, X(lower)), height: 136, fill: '#fee2e2' }));
    c.appendChild(svg('rect', { x: X(upper), y: 44, width: Math.max(0, W - X(upper)), height: 136, fill: '#fee2e2' }));
    // 상자
    c.appendChild(svg('rect', { x: X(s.q1), y: 80, width: Math.max(1, X(s.q3) - X(s.q1)), height: 64, fill: '#dbeafe', stroke: '#1d4ed8', 'stroke-width': 2 }));
    c.appendChild(svg('line', { x1: X(s.med), x2: X(s.med), y1: 80, y2: 144, stroke: '#16a34a', 'stroke-width': 3 }));
    // 점
    vals.forEach((v, i) => {
      const out = v < lower || v > upper;
      c.appendChild(svg('circle', { cx: X(v), cy: 56 + ((i * 53) % 112), r: out ? 7 : 4, fill: out ? '#dc2626' : '#0f172a', opacity: out ? 0.95 : 0.35 },
        svg('title', {}, `${df.index.labels[i]}번 펭귄: ${v}`)));
    });
    // 울타리
    // 두 울타리가 가까우면 이름표가 겹치므로 높이를 달리한다
    [[lower, `← 아래 울타리 ${fmt(lower, 2)}`, 206], [upper, `위 울타리 ${fmt(upper, 2)} →`, 228]].forEach(([v, label, y]) => {
      c.appendChild(svg('line', { x1: X(v), x2: X(v), y1: 44, y2: y - 14, stroke: '#dc2626', 'stroke-width': 2.5, 'stroke-dasharray': '8 5' }));
      const anchor = X(v) < W / 2 ? 'start' : 'end';
      c.appendChild(svg('text', { x: X(v) + (anchor === 'start' ? -4 : 4), y, 'text-anchor': anchor, class: 'lbl-red' }, label));
    });
    c.appendChild(svg('text', { x: X(s.q1) - 4, y: 30, 'text-anchor': 'end', class: 'lbl-blue' }, `Q1 ${fmt(s.q1, 3)}`));
    c.appendChild(svg('text', { x: X(s.q3) + 4, y: 30, class: 'lbl-blue' }, `Q3 ${fmt(s.q3, 3)}`));
    c.appendChild(svg('text', { x: W / 2, y: 262, 'text-anchor': 'middle', class: 'axis-t' }, `${col} (${ko(col)}, ${unit(col)}) — 점 하나가 펭귄 한 마리`));
    fill(chartBox, h('div', { class: 'figure-wrap' }, c));

    fill(numbers, 
      h('div', { class: 'eq' }, h('b', {}, 'IQR'), ` = Q3 − Q1 = ${fmt(s.q3, 3)} − ${fmt(s.q1, 3)} = `, h('b', {}, fmt(s.iqr, 3))),
      h('div', { class: 'eq' }, h('b', {}, '아래 울타리'), ` = Q1 − 1.5 × IQR = ${fmt(s.q1, 3)} − 1.5 × ${fmt(s.iqr, 3)} = `, h('b', {}, fmt(lower, 3))),
      h('div', { class: 'eq' }, h('b', {}, '위 울타리'), ` = Q3 + 1.5 × IQR = ${fmt(s.q3, 3)} + 1.5 × ${fmt(s.iqr, 3)} = `, h('b', {}, fmt(upper, 3))),
      h('div', { class: 'eq big' }, `울타리 밖: ${outs.length}마리 `, outs.slice(0, 12).map(([l, v]) => h('span', { class: 'chip' }, `${l}번 ${v}`)), outs.length > 12 ? ' …' : ''),
      col !== 'body_mass_g' && outs.length ? h('p', { class: 'tiny warnline' }, '노트북은 몸무게(body_mass_g)만 처리했기 때문에, 이 열의 이상치는 penguins_outliers 에 그대로 남습니다.') : null);
  }
  draw();
}

// ───────────────────────────────────────────────────────────
// 4단계 — 정규화 계산기
// ───────────────────────────────────────────────────────────
function minmaxPanel(body, files) {
  const env = prepared(files, 3);
  const df = env.get('penguins_new');
  let col = 'body_mass_g', pos = 0, trim = false;
  const controls = h('div', { class: 'controls' });
  const view = h('div', {});
  body.appendChild(h('p', {}, rich('펭귄 한 마리와 열을 골라 `(x − 최솟값) ÷ (최댓값 − 최솟값)` 을 직접 따라가 보세요. (결측치를 채우고 몸무게 이상치 두 마리를 지운 penguins_new 로 계산합니다)')));
  body.appendChild(controls);
  body.appendChild(view);

  function draw() {
    const all = df.data[col];
    const st = boxStats(all);
    const keep = trim ? all.map((v) => v >= st.whislo && v <= st.whishi) : all.map(() => true);
    const used = all.filter((_, i) => keep[i]);
    const mn = Math.min(...used), mx = Math.max(...used);
    const x = all[pos];
    const label = df.index.labels[pos];
    const scaled = (x - mn) / (mx - mn);

    fill(controls, 
      h('div', { class: 'ctl' }, h('span', { class: 'ctl-l' }, '열'), pills(NUM4.map((c) => [c.name, c.ko]), col, (v) => { col = v; draw(); })),
      h('div', { class: 'ctl' }, h('span', { class: 'ctl-l' }, `위치 ${pos}`),
        h('input', { type: 'range', min: 0, max: df.nrows - 1, step: 1, value: pos, 'aria-label': '펭귄 고르기', onInput: (e) => { pos = Number(e.target.value); draw(); } }),
        h('span', { class: 'chip' }, `줄 번호(인덱스) ${label}`), h('span', { class: 'tiny' }, '위치는 0 부터 셉니다')),
      col !== 'body_mass_g' ? h('label', { class: 'check' }, h('input', { type: 'checkbox', checked: trim, onChange: (e) => { trim = e.target.checked; draw(); } }), ` 이 열의 이상치(${st.fliers.join(', ')})도 지웠다면?`) : null);

    const W = 720, H = 240;
    const X1 = (v) => 40 + ((v - Math.min(...all)) / (Math.max(...all) - Math.min(...all))) * (W - 80);
    const X2 = (v) => 40 + v * (W - 80);
    const c = svg('svg', { viewBox: `0 0 ${W} ${H}`, class: 'strip' });
    c.appendChild(svg('text', { x: 40, y: 22, class: 'axis-t' }, `원래 값 (${unit(col)})`));
    c.appendChild(svg('line', { x1: 40, x2: W - 40, y1: 50, y2: 50, stroke: '#64748b', 'stroke-width': 2 }));
    c.appendChild(svg('text', { x: 40, y: 206, class: 'axis-t' }, '정규화한 값 (0 ~ 1)'));
    c.appendChild(svg('line', { x1: X2(0), x2: X2(1), y1: 170, y2: 170, stroke: '#64748b', 'stroke-width': 2 }));
    all.forEach((v, i) => {
      if (!keep[i]) { c.appendChild(svg('circle', { cx: X1(v), cy: 50, r: 6, fill: 'none', stroke: '#94a3b8', 'stroke-width': 2 }, svg('title', {}, `${v} — 지운 값`))); return; }
      c.appendChild(svg('circle', { cx: X1(v), cy: 50, r: 4, fill: '#0f172a', opacity: 0.25 }));
      c.appendChild(svg('circle', { cx: X2((v - mn) / (mx - mn)), cy: 170, r: 4, fill: '#0f172a', opacity: 0.25 }));
    });
    for (const [v, t] of [[0, '0'], [0.5, '0.5'], [1, '1']]) c.appendChild(svg('text', { x: X2(v), y: 190, 'text-anchor': 'middle', class: 'axis-t' }, t));
    c.appendChild(svg('text', { x: X1(mn), y: 80, 'text-anchor': 'start', class: 'lbl-blue' }, `최솟값 ${mn}`));
    c.appendChild(svg('text', { x: X1(mx), y: 80, 'text-anchor': 'end', class: 'lbl-blue' }, `최댓값 ${mx}`));
    if (keep[pos]) {
      c.appendChild(svg('line', { x1: X1(x), y1: 50, x2: X2(scaled), y2: 170, stroke: '#f59e0b', 'stroke-width': 3 }));
      c.appendChild(svg('circle', { cx: X1(x), cy: 50, r: 9, fill: '#f59e0b', stroke: '#fff', 'stroke-width': 2 }));
      c.appendChild(svg('circle', { cx: X2(scaled), cy: 170, r: 9, fill: '#f59e0b', stroke: '#fff', 'stroke-width': 2 }));
    }
    fill(view, h('div', { class: 'figure-wrap' }, c),
      keep[pos]
        ? h('div', { class: 'formula' }, h('div', { class: 'eq big' },
          `(${x} − ${mn}) ÷ (${mx} − ${mn}) = ${fmt(x - mn, 4)} ÷ ${fmt(mx - mn, 4)} = `, h('b', {}, fmt(scaled, 6))))
        : h('p', { class: 'verdict' }, '이 펭귄의 값은 이상치라 지웠다고 가정했습니다. 다른 줄을 골라 보세요.'),
      h('p', { class: 'verdict' }, spreadNote(col, used, mn, mx, trim)),
      indexNote(df, pos));
  }
  draw();
}

function spreadNote(col, used, mn, mx, trim) {
  const scaled = used.map((v) => (v - mn) / (mx - mn)).sort((a, b) => a - b);
  const q = (p) => scaled[Math.floor((scaled.length - 1) * p)];
  const range = `가운데 절반의 펭귄이 ${fmt(q(0.25), 2)} ~ ${fmt(q(0.75), 2)} 사이에 있습니다.`;
  if (col === 'body_mass_g') return `몸무게는 이상치를 지운 뒤라 0~1 을 넓게 씁니다. ${range}`;
  return trim
    ? `이상치를 지우고 정규화하니 펭귄들이 0~1 에 넓게 퍼졌습니다. ${range}`
    : `지우지 않은 이상치가 최솟값·최댓값이 되어 나머지 펭귄이 좁은 곳에 몰렸습니다. ${range} 위의 체크 상자를 눌러 비교해 보세요.`;
}

function indexNote(df, pos) {
  const label = df.index.labels[pos];
  if (label === pos) return h('p', { class: 'tiny' }, `이 펭귄은 위치(${pos})와 줄 번호(${label})가 같습니다. 위치를 33 이상으로 옮겨 보세요.`);
  return h('p', { class: 'tiny warnline' }, rich(`⚠ penguins_new 에서 위치 ${pos} 의 펭귄은 줄 번호가 ${label} 입니다. 그런데 `), h('code', {}, 'normal'), ` 표에서는 같은 펭귄의 줄 번호가 ${pos} 입니다. 이상치를 지우면서 번호에 구멍이 생겼는데, MinMaxScaler 가 번호를 버리고 0 부터 다시 매겼기 때문입니다. 두 표를 번호로 이어 붙이면 다른 펭귄끼리 짝지어질 수 있어요.`);
}
