// 그림판(Figure) → SVG. matplotlib 이 그리는 상자그림과 비슷한 모양으로 그린다.
// 상자 = Q1~Q3, 초록 선 = 중앙값, 수염 = 1.5×IQR 안쪽의 가장 먼 실제 값, 동그라미 = 수염 밖의 값(이상치 후보)
import { svg, h } from '../lib/ui.js';

const BLUE = '#1f77b4', GREEN = '#2ca02c', GRID = '#d0d0d0';

// 보기 좋은 눈금 간격
export function niceTicks(lo, hi, maxTicks = 8) {
  if (!(hi > lo)) { hi = lo + 1; lo = lo - 1; }
  const raw = (hi - lo) / maxTicks;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= raw);
  const start = Math.ceil(lo / step - 1e-9) * step;
  const ticks = [];
  for (let v = start; v <= hi + step * 1e-9; v += step) ticks.push(Math.round(v / step) * step);
  const decimals = Math.max(0, -Math.floor(Math.log10(step) + 1e-9) + (String(step / mag).includes('.') ? 1 : 0));
  return { ticks, fmt: (v) => v.toFixed(decimals) };
}

export function renderFigure(fig) {
  const W = fig.w * 100, H = fig.h * 100;
  // matplotlib 기본 여백 (subplotpars)
  const L = 0.125, R = 0.9, B = 0.11, T = 0.88, WS = 0.2, HS = 0.2;
  const root = svg('svg', { viewBox: `0 0 ${W} ${H}`, class: 'figure', role: 'img', 'aria-label': '상자그림' });
  // 교실 TV 에서 읽히도록 그림이 클수록 글자도 키운다 (640 픽셀 그림에서 12px)
  root.style.setProperty('--fs', `${Math.max(12, W / 55)}px`);
  root.appendChild(svg('rect', { x: 0, y: 0, width: W, height: H, fill: '#fff' }));

  for (const ax of fig.axes) {
    const cellW = ((R - L) * W) / (ax.ncols + WS * (ax.ncols - 1));
    const cellH = ((T - B) * H) / (ax.nrows + HS * (ax.nrows - 1));
    const col = (ax.index - 1) % ax.ncols, row = Math.floor((ax.index - 1) / ax.ncols);
    const x0 = L * W + col * cellW * (1 + WS);
    const y0 = (1 - T) * H + row * cellH * (1 + HS);
    drawAxes(root, ax, x0, y0, cellW, cellH, fig);
  }
  return h('div', { class: 'figure-wrap', style: { maxWidth: `${Math.min(W, 1100)}px` } }, root);
}

function drawAxes(root, ax, x0, y0, w, hgt, fig) {
  const g = svg('g', {});
  const boxes = ax.boxes.filter((b) => b.stats);
  const all = boxes.flatMap((b) => [b.stats.whislo, b.stats.whishi, ...b.stats.fliers]);
  let lo = Math.min(...all), hi = Math.max(...all);
  if (!all.length) { lo = 0; hi = 1; }
  const pad = (hi - lo) * 0.05 || 1;
  lo -= pad; hi += pad;
  const n = Math.max(boxes.length, 1);
  const X = (pos) => x0 + ((pos - 0.5) / n) * w;
  const Y = (v) => y0 + hgt - ((v - lo) / (hi - lo)) * hgt;

  // 격자·눈금
  const { ticks, fmt } = niceTicks(lo, hi, Math.max(4, Math.round(hgt / 45)));
  for (const t of ticks) {
    if (t < lo || t > hi) continue;
    if (ax.grid) g.appendChild(svg('line', { x1: x0, x2: x0 + w, y1: Y(t), y2: Y(t), stroke: GRID, 'stroke-width': 0.8 }));
    g.appendChild(svg('line', { x1: x0 - 4, x2: x0, y1: Y(t), y2: Y(t), stroke: '#000', 'stroke-width': 0.8 }));
    g.appendChild(svg('text', { x: x0 - 7, y: Y(t) + 5, 'text-anchor': 'end', class: 'fig-tick' }, fmt(t)));
  }
  const widths = Math.min(Math.max(0.15 * (n - 1), 0.15), 0.5);
  boxes.forEach((b, i) => {
    const pos = i + 1;
    const cx = X(pos);
    const half = (widths / n) * w / 2;
    const s = b.stats;
    if (ax.grid) g.appendChild(svg('line', { x1: cx, x2: cx, y1: y0, y2: y0 + hgt, stroke: GRID, 'stroke-width': 0.8 }));
    const tip = `${b.label}\n최솟값 쪽 수염 ${round(s.whislo)}\nQ1 ${round(s.q1)} · 중앙값 ${round(s.med)} · Q3 ${round(s.q3)}\n최댓값 쪽 수염 ${round(s.whishi)}` + (s.fliers.length ? `\n바깥 점 ${s.fliers.map(round).join(', ')}` : '');
    const grp = svg('g', { class: 'fig-box' }, svg('title', {}, tip));
    grp.appendChild(svg('line', { x1: cx, x2: cx, y1: Y(s.q1), y2: Y(s.whislo), stroke: BLUE, 'stroke-width': 1.2 }));
    grp.appendChild(svg('line', { x1: cx, x2: cx, y1: Y(s.q3), y2: Y(s.whishi), stroke: BLUE, 'stroke-width': 1.2 }));
    grp.appendChild(svg('line', { x1: cx - half / 2, x2: cx + half / 2, y1: Y(s.whislo), y2: Y(s.whislo), stroke: BLUE, 'stroke-width': 1.2 }));
    grp.appendChild(svg('line', { x1: cx - half / 2, x2: cx + half / 2, y1: Y(s.whishi), y2: Y(s.whishi), stroke: BLUE, 'stroke-width': 1.2 }));
    grp.appendChild(svg('rect', { x: cx - half, y: Y(s.q3), width: half * 2, height: Math.max(0.5, Y(s.q1) - Y(s.q3)), fill: 'none', stroke: BLUE, 'stroke-width': 1.2 }));
    grp.appendChild(svg('line', { x1: cx - half, x2: cx + half, y1: Y(s.med), y2: Y(s.med), stroke: GREEN, 'stroke-width': 1.6 }));
    for (const f of s.fliers) grp.appendChild(svg('circle', { cx, cy: Y(f), r: 3.5, fill: 'none', stroke: '#000', 'stroke-width': 1 }));
    g.appendChild(grp);
    g.appendChild(svg('line', { x1: cx, x2: cx, y1: y0 + hgt, y2: y0 + hgt + 4, stroke: '#000', 'stroke-width': 0.8 }));
    const fontSize = Math.min(Math.max(12, (fig.w * 100) / 55), (w / n) / Math.max(b.label.length, 1) * 1.75);
    g.appendChild(svg('text', { x: cx, y: y0 + hgt + 8 + fontSize, 'text-anchor': 'middle', class: 'fig-tick', style: `font-size:${fontSize}px` }, b.label));
  });
  g.appendChild(svg('rect', { x: x0, y: y0, width: w, height: hgt, fill: 'none', stroke: '#000', 'stroke-width': 0.9 }));
  if (ax.title) g.appendChild(svg('text', { x: x0 + w / 2, y: y0 - 8, 'text-anchor': 'middle', class: 'fig-title' }, ax.title));
  root.appendChild(g);
}

function round(v) {
  return Math.abs(v) >= 100 ? String(Math.round(v * 100) / 100) : String(Math.round(v * 10000) / 10000);
}
