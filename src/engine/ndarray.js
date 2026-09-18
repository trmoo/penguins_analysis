// numpy 배열 흉내 — 이 수업에서는 np.percentile 의 결과, MinMaxScaler 의 결과,
// 그리고 .values·.unique() 정도만 다룬다. 1차원·2차원만 지원한다.
import { Num, f64, i64, npBool, Tuple, pyInt, PyError, repr as pyRepr, PyFunc, parseArgs, toNumber } from './pyvalues.js';
import { numpyFloatElements, pairwiseSum, percentileSorted, pyFloat } from './numfmt.js';

export class NDArray {
  // data 는 한 줄로 펼친 배열, shape 는 [n] 또는 [행, 열]
  constructor(data, shape, dtype = 'float64') {
    this.data = data; this.shape = shape; this.dtype = dtype;
  }
  get pyType() { return 'ndarray'; }
  get ndim() { return this.shape.length; }
  get size() { return this.data.length; }

  static from2D(rows, dtype = 'float64') {
    const r = rows.length, c = r ? rows[0].length : 0;
    return new NDArray(rows.flat(), [r, c], dtype);
  }

  row(i) { const c = this.shape[1]; return this.data.slice(i * c, (i + 1) * c); }
  col(j) { const [r, c] = this.shape; return Array.from({ length: r }, (_, i) => this.data[i * c + j]); }

  // 원소 하나를 파이썬 값으로
  scalar(v) {
    if (this.dtype === 'float64') return f64(v);
    if (this.dtype === 'int64') return i64(v);
    if (this.dtype === 'bool') return npBool(v);
    return v;
  }

  equals(o) {
    return o instanceof NDArray && this.dtype === o.dtype && this.shape.join() === o.shape.join() &&
      this.data.every((x, i) => x === o.data[i] || (Number.isNaN(x) && Number.isNaN(o.data[i])));
  }

  // ── 화면 표기 ──
  _elements() {
    if (this.dtype === 'float64') return numpyFloatElements(this.data);
    if (this.dtype === 'int64') {
      const w = Math.max(...this.data.map((x) => String(x).length));
      return this.data.map((x) => String(x).padStart(w));
    }
    if (this.dtype === 'bool') {
      const s = this.data.map((x) => (x ? 'True' : 'False'));
      const w = Math.max(...s.map((x) => x.length));
      return s.map((x) => x.padStart(w));
    }
    return this.data.map((x) => pyRepr(x));
  }

  _lines(sep, prefix) {
    if (this.data.length === 0) return '[]';
    const el = this._elements();
    if (this.ndim === 1) return '[' + el.join(sep) + ']';
    const c = this.shape[1];
    const rows = [];
    for (let i = 0; i < this.shape[0]; i++) rows.push('[' + el.slice(i * c, (i + 1) * c).join(sep) + ']');
    return '[' + rows.join((sep === ', ' ? ',' : '') + '\n' + ' '.repeat(prefix)) + ']';
  }

  repr() {
    const body = this._lines(', ', 7);
    const tail = this.dtype === 'object' ? ', dtype=object' : '';
    return 'array(' + body + tail + ')';
  }

  str() { return this._lines(' ', 1); }

  getattr(name) {
    const m = NDARRAY_METHODS[name];
    if (m) return m(this);
    return undefined;
  }
}

function reduceFloat(arr, how) {
  const a = arr.data.map(Number);
  if (how === 'sum') return pairwiseSum(a);
  if (how === 'mean') return pairwiseSum(a) / a.length;
  if (how === 'min') return a.reduce((m, x) => (Number.isNaN(x) || x < m ? x : m), Infinity);
  if (how === 'max') return a.reduce((m, x) => (Number.isNaN(x) || x > m ? x : m), -Infinity);
  throw new Error(how);
}

const bound = (self, name, fn) => new PyFunc(name, fn, { owner: 'ndarray', self });

const NDARRAY_METHODS = {
  shape: (s) => new Tuple(s.shape.map(pyInt)),
  ndim: (s) => pyInt(s.ndim),
  size: (s) => pyInt(s.size),
  dtype: (s) => ({ pyType: 'dtype', repr: () => `dtype('${s.dtype === 'object' ? 'O' : s.dtype}')`, str: () => s.dtype }),
  T: (s) => (s.ndim === 1 ? s : NDArray.from2D(Array.from({ length: s.shape[1] }, (_, j) => s.col(j)), s.dtype)),
  tolist: (s) => bound(s, 'tolist', () => (s.ndim === 1
    ? s.data.map((x) => (s.dtype === 'float64' ? new Num(x, 'float') : s.dtype === 'int64' ? pyInt(x) : x))
    : Array.from({ length: s.shape[0] }, (_, i) => s.row(i).map((x) => new Num(x, 'float'))))),
  min: (s) => bound(s, 'min', () => f64(reduceFloat(s, 'min'))),
  max: (s) => bound(s, 'max', () => f64(reduceFloat(s, 'max'))),
  mean: (s) => bound(s, 'mean', () => f64(reduceFloat(s, 'mean'))),
  sum: (s) => bound(s, 'sum', () => f64(reduceFloat(s, 'sum'))),
  round: (s) => bound(s, 'round', (args, kw) => {
    const { decimals } = parseArgs('round', args, kw, [['decimals', pyInt(0)]]);
    const d = toNumber(decimals);
    return new NDArray(s.data.map((x) => roundHalfEven(x, d)), s.shape, s.dtype);
  }),
};

// numpy 의 반올림은 "짝수 쪽으로" (0.5 → 0, 1.5 → 2, 2.5 → 2)
export function roundHalfEven(x, d) {
  if (!Number.isFinite(x)) return x;
  const m = 10 ** d;
  const y = x * m;
  const r = Math.round(y);
  const fixed = Math.abs(y % 1) === 0.5 ? 2 * Math.round(y / 2) : r;
  return fixed / m;
}

// np.percentile(배열, 25) 또는 np.percentile(배열, [25, 75])
export function percentileOf(values, q) {
  const clean = values.filter((x) => !Number.isNaN(x));
  if (clean.length < values.length) return NaN; // numpy 는 nan 이 하나라도 있으면 nan
  const sorted = [...clean].sort((a, b) => a - b);
  return percentileSorted(sorted, q);
}

export { pyFloat };
