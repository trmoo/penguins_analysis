// pandas 흉내 — Index · Series · DataFrame.
// 이 수업(데이터 수집 → 결측치 → 이상치 → 정규화)에 나오는 명령어와,
// 학생이 궁금해서 쳐 볼 만한 이웃 명령어를 중심으로 만들었다.
//
// ★ 코랩(pandas 2.2)과 같게 동작하도록 한 중요한 점 두 가지
//  1) df.열이름 · df['열이름'] 으로 꺼낸 Series 는 DataFrame 과 같은 배열을 함께 쓴다.
//     그래서 penguins.bill_length_mm.fillna(mean1, inplace=True) 가 penguins 원본을 바꾼다.
//     (pandas 3 에서는 원본이 안 바뀐다 — 그래서 FutureWarning 경고가 함께 뜬다.)
//  2) 평균·표준편차·백분위수를 numpy 와 같은 순서로 계산해 마지막 자리까지 맞춘다.
import {
  Num, f64, i64, npBool, pyInt, pyFloatNum, Tuple, Dict, PyFunc, PyError, NotSupported,
  parseArgs, REQUIRED, toNumber, isNumberLike, str as pyStr, repr as pyRepr, typeName, strRepr,
} from './pyvalues.js';
import {
  pandasFloatColumn, pandasFloatSingle, pairwiseSum, percentileSorted, center, sizeof, fixed,
} from './numfmt.js';
import { NDArray, roundHalfEven } from './ndarray.js';

const NUMERIC = new Set(['float64', 'int64', 'bool']);

// ─────────────────────────────────────────────────────────────
// Index — 줄 이름표(0, 1, 2 …) 또는 열 이름표
// ─────────────────────────────────────────────────────────────
export class Index {
  constructor(labels, { isRange = false, name = null } = {}) {
    this.labels = labels; this.isRange = isRange; this.name = name; this._pos = null;
  }
  get pyType() { return this.isRange ? 'RangeIndex' : 'Index'; }
  get length() { return this.labels.length; }
  static range(n, start = 0) { return new Index(Array.from({ length: n }, (_, i) => start + i), { isRange: true }); }
  get dtype() { return this.labels.every((x) => typeof x === 'number') ? 'int64' : 'object'; }

  pos(label) {
    if (!this._pos) { this._pos = new Map(); this.labels.forEach((l, i) => { if (!this._pos.has(l)) this._pos.set(l, i); }); }
    return this._pos.get(label);
  }
  has(label) { return this.pos(label) !== undefined; }
  slice(a, b) { return new Index(this.labels.slice(a, b), { isRange: this.isRange, name: this.name }); }
  take(positions) { return new Index(positions.map((p) => this.labels[p]), { name: this.name }); }
  equals(o) { return o instanceof Index && o.labels.length === this.labels.length && o.labels.every((x, i) => x === this.labels[i]); }

  repr() {
    if (this.isRange) {
      const start = this.labels.length ? this.labels[0] : 0;
      return `RangeIndex(start=${start}, stop=${start + this.labels.length}, step=1)`;
    }
    const dtype = this.dtype;
    const items = this.labels.map((x) => (typeof x === 'string' ? strRepr(x) : String(x)));
    const oneLine = '[' + items.join(', ') + ']';
    const tail = `dtype='${dtype}'` + (this.name != null ? `, name=${strRepr(String(this.name))}` : '');
    // 한 줄에 들어가면 한 줄로, 넘치면 pandas 처럼 80칸에서 접는다
    if (oneLine.length < 80 - 7) return `Index(${oneLine}, ${tail})`;
    let out = '', line = 'Index([';
    items.forEach((it, i) => {
      const word = it + (i < items.length - 1 ? ', ' : ']');
      if (line.trimEnd().length + word.trimEnd().length >= 80) { out += line.trimEnd() + '\n'; line = ' '.repeat(7); }
      line += word;
    });
    return out + line + ',\n' + ' '.repeat(6) + tail + ')';
  }

  getattr(name) {
    switch (name) {
      case 'name': return this.name;
      case 'size': return pyInt(this.length);
      case 'shape': return new Tuple([pyInt(this.length)]);
      case 'dtype': return dtypeObj(this.dtype);
      case 'values': return new NDArray([...this.labels], [this.length], this.dtype);
      case 'tolist': case 'to_list':
        return new PyFunc(name, () => this.labels.map((x) => (typeof x === 'number' ? pyInt(x) : x)), { owner: 'Index', self: this });
    }
    return undefined;
  }
}

export function dtypeObj(d) {
  return { pyType: 'dtype', repr: () => (d === 'object' ? "dtype('O')" : `dtype('${d}')`), str: () => d, equals: (o) => o.str?.() === d };
}

// 파이썬 값 → 이름표(자바스크립트 수·글자)
function toLabel(v) {
  if (v instanceof Num) return v.v;
  if (typeof v === 'string' || typeof v === 'number') return v;
  if (typeof v === 'boolean') return v ? 1 : 0;
  throw new PyError('TypeError', `이름표로 쓸 수 없는 값입니다: ${typeName(v)}`);
}
function toLabels(v) {
  if (v instanceof Index) return v.labels;
  if (v instanceof Series) return v.values.map(toLabel);
  if (v instanceof NDArray) return v.data;
  if (Array.isArray(v)) return v.map(toLabel);
  if (v instanceof Tuple) return v.items.map(toLabel);
  return [toLabel(v)];
}

// 한 칸의 값이 비었나(NaN·None)
export function isMissing(x) {
  return x === null || x === undefined || (typeof x === 'number' && Number.isNaN(x)) || (x instanceof Num && Number.isNaN(x.v));
}

// 저장해 둔 원소 → 파이썬 값
function box(x, dtype) {
  if (dtype === 'float64') return f64(x);
  if (dtype === 'int64') return i64(x);
  if (dtype === 'bool') return npBool(x);
  if (typeof x === 'number') return new Num(x, Number.isNaN(x) ? 'float' : 'float');
  return x;
}

// 파이썬 값 → 저장용 원소 (dtype 에 맞게)
function unbox(v, dtype) {
  if (dtype === 'float64' || dtype === 'int64') {
    if (v === null) return NaN;
    return toNumber(v);
  }
  if (dtype === 'bool') return Boolean(v instanceof Num ? v.v : v);
  return v;
}

// 파이썬 리스트 같은 값들의 dtype 짐작
function inferDtype(vals) {
  if (vals.length === 0) return 'object';
  if (vals.every((v) => typeof v === 'boolean' || (v instanceof Num && v.k === 'b_'))) return 'bool';
  if (vals.every((v) => v instanceof Num && (v.k === 'int' || v.k === 'i64'))) return 'int64';
  if (vals.every((v) => v === null || isNumberLike(v))) return 'float64';
  return 'object';
}

const bound = (self, owner, name, fn) => new PyFunc(name, fn, { owner, self });

// ─────────────────────────────────────────────────────────────
// Series — 이름표가 붙은 값 한 줄
// ─────────────────────────────────────────────────────────────
export class Series {
  constructor(values, index, { name = null, dtype = 'float64', parent = null } = {}) {
    this.values = values; this.index = index; this.name = name; this.dtype = dtype;
    this.parent = parent; // { df, column } — DataFrame 에서 꺼낸 열이면 그 출처
  }
  get pyType() { return 'Series'; }
  get length() { return this.values.length; }

  static fromPython(vals, { name = null, index = null } = {}) {
    const dtype = inferDtype(vals);
    return new Series(vals.map((v) => unbox(v, dtype)), index ?? Index.range(vals.length), { name, dtype });
  }

  equals(o) {
    return o instanceof Series && o.dtype === this.dtype && o.name === this.name && o.index.equals(this.index) &&
      o.values.length === this.values.length &&
      o.values.every((x, i) => x === this.values[i] || (isMissing(x) && isMissing(this.values[i])) ||
        (x instanceof Num && this.values[i] instanceof Num && x.v === this.values[i].v));
  }

  copyWith(values, index = this.index, dtype = this.dtype, name = this.name) {
    return new Series(values, index, { name, dtype });
  }

  take(positions, index = this.index.take(positions)) {
    return new Series(positions.map((p) => this.values[p]), index, { name: this.name, dtype: this.dtype });
  }

  nums() {
    if (this.dtype === 'object') return null;
    if (this.dtype === 'bool') return this.values.map((x) => (x ? 1 : 0));
    return this.values;
  }

  // 숫자로만 계산할 수 있는 명령에서 글자 열을 만났을 때
  requireNumeric(what) {
    const n = this.nums();
    if (!n) {
      const first = this.values.find((x) => typeof x === 'string');
      throw new PyError('TypeError', `could not convert string to float: ${strRepr(String(first))}`,
        `'${this.name}' 열은 글자(${first} 등)가 들어 있어 계산할 수 없습니다(${what}). 숫자 열을 골라 보세요.`);
    }
    return n;
  }

  repr() { return renderSeries(this); }
  str() { return renderSeries(this); }

  getattr(name) {
    const m = SERIES_METHODS[name];
    if (m) return m(this);
    return undefined;
  }
}

// ── 통계 계산 (numpy 순서 그대로) ────────────────────────────
function nanSumMean(nums) {
  let count = 0;
  const filled = nums.map((x) => { if (Number.isNaN(x)) return 0; count++; return x; });
  const s = pairwiseSum(filled);
  return { sum: s, count, mean: count ? s / count : NaN, filled };
}
function nanVar(nums, ddof = 1) {
  const { sum, count } = nanSumMean(nums);
  if (count - ddof <= 0) return NaN;
  const avg = sum / count;
  const sqr = nums.map((x) => (Number.isNaN(x) ? 0 : (avg - x) ** 2));
  return pairwiseSum(sqr) / (count - ddof);
}
function sortedClean(nums) { return nums.filter((x) => !Number.isNaN(x)).sort((a, b) => a - b); }
function nanMedian(nums) {
  const s = sortedClean(nums);
  const n = s.length;
  if (!n) return NaN;
  return n % 2 ? s[(n - 1) / 2] : (s[n / 2 - 1] + s[n / 2]) / 2;
}

// Series 하나를 줄이는 계산들 (sum·mean·…) → 파이썬 값
function reduceSeries(s, how, opts = {}) {
  const dt = s.dtype;
  if (how === 'count') return i64(s.values.filter((x) => !isMissing(x)).length);
  if (dt === 'object') {
    const vals = s.values.filter((x) => !isMissing(x));
    if (how === 'sum') return vals.map((x) => pyStr(x)).join('');
    if (how === 'min' || how === 'max') {
      if (!vals.length) return pyFloatNum(NaN);
      return vals.reduce((m, x) => ((how === 'min' ? pyStr(x) < pyStr(m) : pyStr(x) > pyStr(m)) ? x : m));
    }
    throw new PyError('TypeError', `could not convert string to float: ${strRepr(pyStr(vals[0]))}`,
      `'${s.name}' 열은 글자라서 ${how}( ) 를 계산할 수 없습니다.`);
  }
  const nums = s.nums();
  switch (how) {
    case 'sum': {
      const { sum } = nanSumMean(nums);
      return dt === 'float64' ? f64(sum) : i64(sum);
    }
    case 'mean': return f64(nanSumMean(nums).mean);
    case 'median': return f64(nanMedian(nums));
    case 'std': return f64(Math.sqrt(nanVar(nums, opts.ddof ?? 1)));
    case 'var': return f64(nanVar(nums, opts.ddof ?? 1));
    case 'min': case 'max': {
      const c = nums.filter((x) => !Number.isNaN(x));
      if (!c.length) return f64(NaN);
      const v = c.reduce((m, x) => (how === 'min' ? (x < m ? x : m) : (x > m ? x : m)));
      return dt === 'float64' ? f64(v) : dt === 'int64' ? i64(v) : npBool(v);
    }
    case 'any': return npBool(nums.some((x) => x && !Number.isNaN(x)));
    case 'all': return npBool(nums.every((x) => x || Number.isNaN(x)));
  }
  throw new Error(how);
}

function quantileOf(s, q) {
  const nums = s.requireNumeric('백분위수');
  return percentileSorted(sortedClean(nums), q * 100);
}

function describeSeries(s) {
  if (s.dtype === 'object') {
    const vals = s.values.filter((x) => !isMissing(x));
    const counts = valueCounts(vals);
    const [top, freq] = counts[0] ?? [NaN, 0];
    return new Series([i64(vals.length), i64(counts.length), top, i64(freq)],
      new Index(['count', 'unique', 'top', 'freq']), { name: s.name, dtype: 'object' });
  }
  const nums = s.nums();
  const { count, mean } = nanSumMean(nums);
  const sorted = sortedClean(nums);
  const out = [count, mean, Math.sqrt(nanVar(nums)), sorted[0] ?? NaN,
    percentileSorted(sorted, 25), percentileSorted(sorted, 50), percentileSorted(sorted, 75), sorted[sorted.length - 1] ?? NaN];
  return new Series(out, new Index(['count', 'mean', 'std', 'min', '25%', '50%', '75%', 'max']), { name: s.name, dtype: 'float64' });
}

function valueCounts(vals) {
  const m = new Map();
  for (const v of vals) { const k = pyStr(v); if (!m.has(k)) m.set(k, [v, 0]); m.get(k)[1]++; }
  return [...m.values()].sort((a, b) => b[1] - a[1]); // 자바스크립트 정렬은 안정 정렬 — 개수가 같으면 먼저 나온 것이 앞
}

// fillna 에 넣을 값 한 칸 얻기
function fillValue(value, label) {
  if (value instanceof Series) {
    const p = value.index.pos(label);
    return p === undefined ? undefined : box(value.values[p], value.dtype);
  }
  if (value instanceof Dict) {
    for (const [k, v] of value.map) if (toLabel(k) === label) return v;
    return undefined;
  }
  return value;
}

// DataFrame 에서 꺼낸 Series 에 inplace=True 를 쓰면 코랩(pandas 2.2)은 원본을 바꾸면서 이 경고를 띄운다.
export const CHAINED_WARNING =
  'FutureWarning: A value is trying to be set on a copy of a DataFrame or Series through chained assignment using an inplace method.\n' +
  'The behavior will change in pandas 3.0. This inplace method will never work because the intermediate object on which we are setting values always behaves as a copy.\n\n' +
  "For example, when doing 'df[col].method(value, inplace=True)', try using 'df.method({col: value}, inplace=True)' or df[col] = df[col].method(value) instead, to perform the operation inplace on the original object.\n\n";

function seriesFillna(s, args, kw, ctx) {
  const { value, method, inplace } = parseArgs('fillna', args, kw, [['value', null], ['method', null], ['inplace', false]]);
  if (value === null) {
    throw new PyError('ValueError', "Must specify a fill 'value' or 'method'.", 'fillna( ) 괄호 안에 채울 값을 넣어야 합니다. 예) fillna(mean1)');
  }
  if (value instanceof Series && value.parent == null && s.parent == null) { /* 이름표 맞춰 채우기 */ }
  const filled = s.values.map((x) => {
    if (!isMissing(x)) return x;
    const v = value instanceof Series ? box(value.values[0], value.dtype) : value;
    if (s.dtype === 'object') return v;
    if (!isNumberLike(v)) {
      throw new PyError('TypeError', `Invalid value '${pyStr(v)}' for dtype '${s.dtype}'`,
        '숫자 열의 빈칸은 숫자로 채워야 합니다.');
    }
    return toNumber(v);
  });
  if (inplace === true) {
    if (s.parent) ctx.warn(CHAINED_WARNING);
    for (let i = 0; i < filled.length; i++) s.values[i] = filled[i]; // 같은 배열을 바꾸므로 원본 DataFrame 도 바뀐다
    return null;
  }
  return s.copyWith(filled);
}

// ── Series 의 명령어 모음 ─────────────────────────────────────
const SERIES_METHODS = {
  values: (s) => new NDArray([...s.values], [s.length], s.dtype),
  index: (s) => s.index,
  name: (s) => s.name,
  dtype: (s) => dtypeObj(s.dtype),
  shape: (s) => new Tuple([pyInt(s.length)]),
  size: (s) => pyInt(s.length),
  empty: (s) => s.length === 0,
  loc: (s) => new Indexer(s, 'loc'),
  iloc: (s) => new Indexer(s, 'iloc'),
  head: (s) => bound(s, 'NDFrame', 'head', (a, k) => { const { n } = parseArgs('head', a, k, [['n', pyInt(5)]]); const m = clampN(n, s.length); return new Series(s.values.slice(0, m), s.index.slice(0, m), { name: s.name, dtype: s.dtype }); }),
  tail: (s) => bound(s, 'NDFrame', 'tail', (a, k) => { const { n } = parseArgs('tail', a, k, [['n', pyInt(5)]]); const m = clampN(n, s.length); return new Series(s.values.slice(s.length - m), s.index.slice(s.length - m), { name: s.name, dtype: s.dtype }); }),
  isnull: (s) => bound(s, 'Series', 'isnull', () => s.copyWith(s.values.map(isMissing), s.index, 'bool')),
  isna: (s) => bound(s, 'Series', 'isna', () => s.copyWith(s.values.map(isMissing), s.index, 'bool')),
  notnull: (s) => bound(s, 'Series', 'notnull', () => s.copyWith(s.values.map((x) => !isMissing(x)), s.index, 'bool')),
  notna: (s) => bound(s, 'Series', 'notna', () => s.copyWith(s.values.map((x) => !isMissing(x)), s.index, 'bool')),
  sum: (s) => bound(s, 'Series', 'sum', () => reduceSeries(s, 'sum')),
  mean: (s) => bound(s, 'Series', 'mean', () => reduceSeries(s, 'mean')),
  median: (s) => bound(s, 'Series', 'median', () => reduceSeries(s, 'median')),
  min: (s) => bound(s, 'Series', 'min', () => reduceSeries(s, 'min')),
  max: (s) => bound(s, 'Series', 'max', () => reduceSeries(s, 'max')),
  std: (s) => bound(s, 'Series', 'std', (a, k) => { const { ddof } = parseArgs('std', a, k, [['ddof', pyInt(1)]]); return reduceSeries(s, 'std', { ddof: toNumber(ddof) }); }),
  var: (s) => bound(s, 'Series', 'var', (a, k) => { const { ddof } = parseArgs('var', a, k, [['ddof', pyInt(1)]]); return reduceSeries(s, 'var', { ddof: toNumber(ddof) }); }),
  count: (s) => bound(s, 'Series', 'count', () => reduceSeries(s, 'count')),
  any: (s) => bound(s, 'Series', 'any', () => reduceSeries(s, 'any')),
  all: (s) => bound(s, 'Series', 'all', () => reduceSeries(s, 'all')),
  quantile: (s) => bound(s, 'Series', 'quantile', (a, k) => {
    const { q } = parseArgs('quantile', a, k, [['q', pyFloatNum(0.5)]]);
    if (Array.isArray(q)) return new Series(q.map((x) => quantileOf(s, toNumber(x))), new Index(q.map((x) => toNumber(x))), { name: s.name, dtype: 'float64' });
    return f64(quantileOf(s, toNumber(q)));
  }),
  describe: (s) => bound(s, 'NDFrame', 'describe', () => describeSeries(s)),
  fillna: (s) => bound(s, 'Series', 'fillna', (a, k, ctx) => seriesFillna(s, a, k, ctx)),
  dropna: (s) => bound(s, 'Series', 'dropna', () => { const keep = s.values.map((x, i) => (isMissing(x) ? -1 : i)).filter((i) => i >= 0); return s.take(keep); }),
  copy: (s) => bound(s, 'NDFrame', 'copy', () => s.copyWith([...s.values])),
  round: (s) => bound(s, 'Series', 'round', (a, k) => {
    const { decimals } = parseArgs('round', a, k, [['decimals', pyInt(0)]]);
    s.requireNumeric('반올림');
    return s.copyWith(s.values.map((x) => roundHalfEven(x, toNumber(decimals))));
  }),
  unique: (s) => bound(s, 'Series', 'unique', () => {
    const seen = new Set(); const out = [];
    for (const x of s.values) { const key = isMissing(x) ? 'NaN' : pyStr(box(x, s.dtype)); if (!seen.has(key)) { seen.add(key); out.push(x); } }
    return new NDArray(out, [out.length], s.dtype);
  }),
  nunique: (s) => bound(s, 'Series', 'nunique', () => pyInt(new Set(s.values.filter((x) => !isMissing(x)).map((x) => pyStr(box(x, s.dtype)))).size)),
  value_counts: (s) => bound(s, 'Series', 'value_counts', () => {
    const counts = valueCounts(s.values.filter((x) => !isMissing(x)));
    const idx = new Index(counts.map(([v]) => v), { name: s.name });
    return new Series(counts.map(([, c]) => c), idx, { name: 'count', dtype: 'int64' });
  }),
  sort_values: (s) => bound(s, 'Series', 'sort_values', (a, k) => {
    const { ascending } = parseArgs('sort_values', a, k, [['ascending', true]]);
    const order = sortOrder(s.values, ascending !== false);
    return s.take(order);
  }),
  drop: (s) => bound(s, 'Series', 'drop', (a, k) => {
    const { labels, index } = parseArgs('drop', a, k, [['labels', null], ['index', null]]);
    const drop = toLabels(labels ?? index);
    const missing = drop.filter((l) => !s.index.has(l));
    if (missing.length) throw new PyError('KeyError', `${pyListOf(missing)} not found in axis`);
    const set = new Set(drop);
    return s.take(s.index.labels.map((l, i) => (set.has(l) ? -1 : i)).filter((i) => i >= 0));
  }),
  reset_index: (s) => bound(s, 'Series', 'reset_index', (a, k) => {
    const { drop } = parseArgs('reset_index', a, k, [['drop', false]]);
    if (drop !== true) throw new NotSupported('Series.reset_index(drop=False)');
    return new Series([...s.values], Index.range(s.length), { name: s.name, dtype: s.dtype });
  }),
  abs: (s) => bound(s, 'Series', 'abs', () => s.copyWith(s.requireNumeric('절댓값').map(Math.abs))),
  tolist: (s) => bound(s, 'Series', 'tolist', () => s.values.map((x) => pyValueOf(x, s.dtype))),
  to_list: (s) => bound(s, 'Series', 'to_list', () => s.values.map((x) => pyValueOf(x, s.dtype))),
  to_numpy: (s) => bound(s, 'Series', 'to_numpy', () => new NDArray([...s.values], [s.length], s.dtype)),
  astype: (s) => bound(s, 'Series', 'astype', (a, k) => {
    const { dtype } = parseArgs('astype', a, k, [['dtype', REQUIRED]]);
    const d = pyStr(dtype);
    if (d === 'float' || d === 'float64') return s.copyWith(s.values.map((x) => (typeof x === 'number' ? x : Number(pyStr(x)))), s.index, 'float64');
    if (d === 'int' || d === 'int64') return s.copyWith(s.values.map((x) => Math.trunc(x)), s.index, 'int64');
    if (d === 'str' || d === 'object') return s.copyWith(s.values.map((x) => pyStr(box(x, s.dtype))), s.index, 'object');
    throw new NotSupported(`astype('${d}')`);
  }),
};

function pyValueOf(x, dtype) {
  if (dtype === 'float64') return pyFloatNum(x);
  if (dtype === 'int64') return pyInt(x);
  if (dtype === 'bool') return Boolean(x);
  return x;
}

function clampN(n, len) {
  const v = toNumber(n, 'head( )·tail( ) 괄호 안');
  return v < 0 ? Math.max(len + v, 0) : Math.min(v, len);
}

function sortOrder(values, asc) {
  const idx = values.map((_, i) => i);
  const key = (x) => (isMissing(x) ? null : x instanceof Num ? x.v : x);
  return idx.sort((a, b) => {
    const x = key(values[a]), y = key(values[b]);
    if (x === null && y === null) return 0;
    if (x === null) return 1; // 빈칸은 언제나 맨 뒤
    if (y === null) return -1;
    if (x < y) return asc ? -1 : 1;
    if (x > y) return asc ? 1 : -1;
    return 0;
  });
}

function pyListOf(labels) {
  return '[' + labels.map((l) => (typeof l === 'string' ? strRepr(l) : String(l))).join(', ') + ']';
}

// ─────────────────────────────────────────────────────────────
// DataFrame — 표
// ─────────────────────────────────────────────────────────────
export class DataFrame {
  constructor(columns, data, index, dtypes) {
    this.columns = columns; this.data = data; this.index = index; this.dtypes = dtypes;
  }
  get pyType() { return 'DataFrame'; }
  get nrows() { return this.index.length; }

  static fromCSV(text) {
    const lines = text.replace(/\r/g, '').split('\n').filter((l) => l.length);
    const header = lines[0].split(',');
    const rows = lines.slice(1).map((l) => l.split(','));
    const data = {}, dtypes = {};
    header.forEach((h, j) => {
      const raw = rows.map((r) => r[j] ?? '');
      const numeric = raw.every((x) => x === '' || !Number.isNaN(Number(x)));
      if (numeric) {
        const hasNa = raw.some((x) => x === '');
        const allInt = raw.every((x) => x === '' || /^-?\d+$/.test(x));
        data[h] = raw.map((x) => (x === '' ? NaN : Number(x)));
        dtypes[h] = allInt && !hasNa ? 'int64' : 'float64';
      } else {
        data[h] = raw.map((x) => (x === '' ? NaN : x));
        dtypes[h] = 'object';
      }
    });
    return new DataFrame(header, data, Index.range(rows.length), dtypes);
  }

  col(name) {
    if (!(name in this.data)) {
      throw new PyError('KeyError', strRepr(String(name)), columnHint(this, String(name)));
    }
    return new Series(this.data[name], this.index, { name, dtype: this.dtypes[name], parent: { df: this, column: name } });
  }

  // positions 에 있는 줄만 새 표로 (항상 복사본)
  takeRows(positions, index = this.index.take(positions)) {
    const data = {};
    for (const c of this.columns) data[c] = positions.map((p) => this.data[c][p]);
    return new DataFrame([...this.columns], data, index, { ...this.dtypes });
  }
  sliceRows(a, b) {
    const data = {};
    for (const c of this.columns) data[c] = this.data[c].slice(a, b);
    return new DataFrame([...this.columns], data, this.index.slice(a, b), { ...this.dtypes });
  }
  selectColumns(cols) {
    const missing = cols.filter((c) => !(c in this.data));
    if (missing.length) {
      throw new PyError('KeyError', `"${pyListOf(missing)} not in index"`, columnHint(this, String(missing[0])));
    }
    const data = {}, dtypes = {};
    for (const c of cols) { data[c] = [...this.data[c]]; dtypes[c] = this.dtypes[c]; }
    return new DataFrame([...cols], data, this.index, dtypes);
  }
  copy() {
    const data = {};
    for (const c of this.columns) data[c] = [...this.data[c]];
    return new DataFrame([...this.columns], data, this.index, { ...this.dtypes });
  }
  // inplace 명령이 자기 자신을 통째로 바꿀 때
  assignFrom(o) { this.columns = o.columns; this.data = o.data; this.index = o.index; this.dtypes = o.dtypes; }

  numericColumns() { return this.columns.filter((c) => NUMERIC.has(this.dtypes[c])); }

  equals(o) {
    return o instanceof DataFrame && o.columns.join(' ') === this.columns.join(' ') && o.index.equals(this.index) &&
      this.columns.every((c) => o.dtypes[c] === this.dtypes[c] &&
        this.data[c].every((x, i) => x === o.data[c][i] || (isMissing(x) && isMissing(o.data[c][i]))));
  }

  repr() { return renderFrame(this); }
  str() { return renderFrame(this); }

  getattr(name) {
    const m = FRAME_METHODS[name];
    if (m) return m(this);
    if (name in this.data) return this.col(name);
    return undefined;
  }
}

function columnHint(df, wrong) {
  const near = nearest(wrong, df.columns);
  const list = df.columns.map((c) => `'${c}'`).join(', ');
  return (near ? `혹시 '${near}' 아닐까요? ` : '') + `이 표에 있는 열 이름: ${list}`;
}

// 비슷한 이름 찾기 (오타 도우미)
export function nearest(word, candidates, max = 3) {
  let best = null, bestD = Infinity;
  for (const c of candidates) {
    const d = editDistance(word.toLowerCase(), c.toLowerCase());
    if (d < bestD) { bestD = d; best = c; }
  }
  return bestD <= Math.max(1, Math.min(max, Math.floor(word.length / 3))) ? best : null;
}
function editDistance(a, b) {
  const dp = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) dp[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
  }
  return dp[a.length][b.length];
}

// 열마다 줄여서 Series 하나로 (df.mean(), df.isnull().sum() …)
function reduceFrame(df, how, { numericOnly = false, axis = 0, ddof = 1 } = {}) {
  if (axis === 1 || axis === 'columns') {
    const cols = numericOnly || how !== 'count' ? df.numericColumns() : df.columns;
    const out = [];
    for (let i = 0; i < df.nrows; i++) {
      const rowSeries = new Series(cols.map((c) => (df.dtypes[c] === 'bool' ? (df.data[c][i] ? 1 : 0) : df.data[c][i])), new Index(cols), { dtype: cols.every((c) => df.dtypes[c] === 'bool') ? 'bool' : 'float64' });
      out.push(reduceSeries(rowSeries, how, { ddof }));
    }
    const dtype = out.every((v) => v instanceof Num && v.k === 'b_') ? 'bool' : out.every((v) => v instanceof Num && v.k === 'i64') ? 'int64' : 'float64';
    return new Series(out.map((v) => v.v), df.index, { dtype: dtype === 'bool' ? 'bool' : dtype });
  }
  let cols = df.columns;
  if (numericOnly) cols = df.numericColumns();
  else if (!['count', 'min', 'max', 'sum'].includes(how)) {
    const obj = cols.find((c) => df.dtypes[c] === 'object');
    if (obj) {
      const joined = df.data[obj].filter((x) => !isMissing(x)).join('');
      throw new PyError('TypeError', `Could not convert ['${joined}'] to numeric`,
        `'${obj}' 열이 글자라서 ${how}( ) 를 계산할 수 없습니다. 숫자 열만 계산하려면 ${how}(numeric_only=True) 처럼 쓰세요.`);
    }
  }
  const results = cols.map((c) => reduceSeries(new Series(df.data[c], df.index, { name: c, dtype: df.dtypes[c] }), how, { ddof }));
  const allF = results.every((v) => v instanceof Num && v.k === 'f64');
  const allI = results.every((v) => v instanceof Num && v.k === 'i64');
  const allB = results.every((v) => v instanceof Num && v.k === 'b_');
  if (allF) return new Series(results.map((v) => v.v), new Index([...cols]), { dtype: 'float64' });
  if (allI) return new Series(results.map((v) => v.v), new Index([...cols]), { dtype: 'int64' });
  if (allB) return new Series(results.map((v) => Boolean(v.v)), new Index([...cols]), { dtype: 'bool' });
  return new Series(results.map((v) => (v instanceof Num ? new Num(v.v, v.k === 'f64' ? 'float' : 'int') : v)), new Index([...cols]), { dtype: 'object' });
}

function describeFrame(df) {
  const cols = df.numericColumns().filter((c) => df.dtypes[c] !== 'bool');
  if (!cols.length) throw new NotSupported('글자 열만 있는 표의 describe()');
  const data = {}, dtypes = {};
  for (const c of cols) { data[c] = describeSeries(new Series(df.data[c], df.index, { name: c, dtype: df.dtypes[c] })).values; dtypes[c] = 'float64'; }
  return new DataFrame(cols, data, new Index(['count', 'mean', 'std', 'min', '25%', '50%', '75%', 'max']), dtypes);
}

// info() — 표의 요약 설명서
function infoText(df) {
  const lines = ["<class 'pandas.core.frame.DataFrame'>"];
  const n = df.nrows;
  if (df.index.isRange) lines.push(n ? `RangeIndex: ${n} entries, ${df.index.labels[0]} to ${df.index.labels[n - 1]}` : 'RangeIndex: 0 entries');
  else lines.push(n ? `Index: ${n} entries, ${df.index.labels[0]} to ${df.index.labels[n - 1]}` : 'Index: 0 entries');
  lines.push(`Data columns (total ${df.columns.length} columns):`);
  const heads = [' # ', 'Column', 'Non-Null Count', 'Dtype'];
  const rows = df.columns.map((c, i) => [` ${i}`, c, `${df.data[c].filter((x) => !isMissing(x)).length} non-null`, df.dtypes[c]]);
  const w = heads.map((h, j) => Math.max(h.length, ...rows.map((r) => r[j].length)));
  lines.push(heads.map((h, j) => h.padEnd(w[j])).join('  '));
  lines.push(heads.map((h, j) => '-'.repeat(h.length).padEnd(w[j])).join('  '));
  for (const r of rows) lines.push(r.map((x, j) => x.padEnd(w[j])).join('  '));
  const counts = {};
  for (const c of df.columns) counts[df.dtypes[c]] = (counts[df.dtypes[c]] ?? 0) + 1;
  lines.push('dtypes: ' + Object.keys(counts).sort().map((k) => `${k}(${counts[k]})`).join(', '));
  // 메모리: 값 칸마다 8바이트(참거짓은 1바이트) + 이름표
  let bytes = 0;
  for (const c of df.columns) bytes += n * (df.dtypes[c] === 'bool' ? 1 : 8);
  bytes += df.index.isRange ? 132 : n * 8;
  lines.push('memory usage: ' + sizeof(bytes, df.columns.some((c) => df.dtypes[c] === 'object')));
  return lines.join('\n') + '\n';
}

function frameFillna(df, args, kw) {
  const { value, inplace } = parseArgs('fillna', args, kw, [['value', null], ['method', null], ['axis', null], ['inplace', false]]);
  if (value === null) throw new PyError('ValueError', "Must specify a fill 'value' or 'method'.", 'fillna( ) 괄호 안에 채울 값을 넣어야 합니다.');
  const out = df.copy();
  for (const c of out.columns) {
    const v = fillValue(value, c);
    if (v === undefined) continue;
    if (out.dtypes[c] !== 'object' && !isNumberLike(v)) {
      if (!out.data[c].some(isMissing)) continue;
      throw new PyError('TypeError', `Invalid value '${pyStr(v)}' for dtype '${out.dtypes[c]}'`, '숫자 열의 빈칸은 숫자로 채워야 합니다.');
    }
    out.data[c] = out.data[c].map((x) => (isMissing(x) ? (out.dtypes[c] === 'object' ? v : toNumber(v)) : x));
  }
  if (inplace === true) { df.assignFrom(out); return null; }
  return out;
}

function frameDrop(df, args, kw) {
  const o = parseArgs('drop', args, kw, [['labels', null], ['axis', pyInt(0)], ['index', null], ['columns', null], ['inplace', false]]);
  let rowLabels = o.index != null ? toLabels(o.index) : null;
  let colLabels = o.columns != null ? toLabels(o.columns) : null;
  if (o.labels != null) {
    const ax = o.axis instanceof Num ? o.axis.v : o.axis;
    if (ax === 1 || ax === 'columns') colLabels = toLabels(o.labels); else rowLabels = toLabels(o.labels);
  }
  if (rowLabels == null && colLabels == null) {
    throw new PyError('TypeError', "Need to specify at least one of 'labels', 'index' or 'columns'", '무엇을 지울지 index= 또는 columns= 로 알려 주세요.');
  }
  let out = df;
  if (rowLabels) {
    const missing = rowLabels.filter((l) => !df.index.has(l));
    if (missing.length) throw new PyError('KeyError', `${pyListOf(missing)} not found in axis`, '지우려는 줄 번호가 표에 없습니다. 이미 지웠거나 번호가 틀렸는지 확인하세요.');
    const set = new Set(rowLabels);
    out = df.takeRows(df.index.labels.map((l, i) => (set.has(l) ? -1 : i)).filter((i) => i >= 0));
  }
  if (colLabels) {
    const missing = colLabels.filter((c) => !(c in df.data));
    if (missing.length) throw new PyError('KeyError', `${pyListOf(missing)} not found in axis`, columnHint(df, String(missing[0])));
    out = out.selectColumns(out.columns.filter((c) => !colLabels.includes(c)));
  }
  if (o.inplace === true) { df.assignFrom(out === df ? df.copy() : out); return null; }
  return out === df ? df.copy() : out;
}

function frameDropna(df, args, kw) {
  const o = parseArgs('dropna', args, kw, [['axis', pyInt(0)], ['how', 'any'], ['subset', null], ['inplace', false]]);
  const cols = o.subset ? toLabels(o.subset) : df.columns;
  const keep = [];
  for (let i = 0; i < df.nrows; i++) {
    const miss = cols.map((c) => isMissing(df.data[c][i]));
    const drop = o.how === 'all' ? miss.every(Boolean) : miss.some(Boolean);
    if (!drop) keep.push(i);
  }
  const out = df.takeRows(keep);
  if (o.inplace === true) { df.assignFrom(out); return null; }
  return out;
}

const FRAME_METHODS = {
  shape: (d) => new Tuple([pyInt(d.nrows), pyInt(d.columns.length)]),
  columns: (d) => new Index([...d.columns]),
  index: (d) => d.index,
  size: (d) => pyInt(d.nrows * d.columns.length),
  empty: (d) => d.nrows === 0 || d.columns.length === 0,
  dtypes: (d) => new Series(d.columns.map((c) => d.dtypes[c]), new Index([...d.columns]), { dtype: 'object' }),
  values: (d) => NDArray.from2D(Array.from({ length: d.nrows }, (_, i) => d.columns.map((c) => d.data[c][i])),
    d.columns.every((c) => d.dtypes[c] === 'float64' || d.dtypes[c] === 'int64') ? 'float64' : 'object'),
  loc: (d) => new Indexer(d, 'loc'),
  iloc: (d) => new Indexer(d, 'iloc'),
  head: (d) => bound(d, 'NDFrame', 'head', (a, k) => { const { n } = parseArgs('head', a, k, [['n', pyInt(5)]]); return d.sliceRows(0, clampN(n, d.nrows)); }),
  tail: (d) => bound(d, 'NDFrame', 'tail', (a, k) => { const { n } = parseArgs('tail', a, k, [['n', pyInt(5)]]); const m = clampN(n, d.nrows); return d.sliceRows(d.nrows - m, d.nrows); }),
  info: (d) => bound(d, 'DataFrame', 'info', (a, k, ctx) => { parseArgs('info', a, k, []); ctx.print(infoText(d)); return null; }),
  describe: (d) => bound(d, 'NDFrame', 'describe', () => describeFrame(d)),
  isnull: (d) => bound(d, 'DataFrame', 'isnull', () => mapFrame(d, isMissing, 'bool')),
  isna: (d) => bound(d, 'DataFrame', 'isna', () => mapFrame(d, isMissing, 'bool')),
  notnull: (d) => bound(d, 'DataFrame', 'notnull', () => mapFrame(d, (x) => !isMissing(x), 'bool')),
  notna: (d) => bound(d, 'DataFrame', 'notna', () => mapFrame(d, (x) => !isMissing(x), 'bool')),
  sum: (d) => reducer(d, 'sum'),
  mean: (d) => reducer(d, 'mean'),
  median: (d) => reducer(d, 'median'),
  min: (d) => reducer(d, 'min'),
  max: (d) => reducer(d, 'max'),
  std: (d) => reducer(d, 'std'),
  var: (d) => reducer(d, 'var'),
  count: (d) => reducer(d, 'count'),
  any: (d) => reducer(d, 'any'),
  all: (d) => reducer(d, 'all'),
  quantile: (d) => bound(d, 'DataFrame', 'quantile', (a, k) => {
    const { q } = parseArgs('quantile', a, k, [['q', pyFloatNum(0.5)], ['numeric_only', false]]);
    const cols = d.numericColumns();
    const qq = toNumber(q);
    return new Series(cols.map((c) => quantileOf(new Series(d.data[c], d.index, { name: c, dtype: d.dtypes[c] }), qq)), new Index(cols), { name: qq, dtype: 'float64' });
  }),
  fillna: (d) => bound(d, 'DataFrame', 'fillna', (a, k) => frameFillna(d, a, k)),
  dropna: (d) => bound(d, 'DataFrame', 'dropna', (a, k) => frameDropna(d, a, k)),
  drop: (d) => bound(d, 'DataFrame', 'drop', (a, k) => frameDrop(d, a, k)),
  copy: (d) => bound(d, 'NDFrame', 'copy', () => d.copy()),
  sort_values: (d) => bound(d, 'DataFrame', 'sort_values', (a, k) => {
    const { by, ascending } = parseArgs('sort_values', a, k, [['by', REQUIRED], ['axis', pyInt(0)], ['ascending', true]]);
    const c = pyStr(by);
    const s = d.col(c);
    return d.takeRows(sortOrder(s.values, ascending !== false));
  }),
  reset_index: (d) => bound(d, 'DataFrame', 'reset_index', (a, k) => {
    const { drop, inplace } = parseArgs('reset_index', a, k, [['drop', false], ['inplace', false]]);
    let out;
    if (drop === true) {
      out = d.copy(); out.index = Index.range(d.nrows);
    } else {
      const data = { index: [...d.index.labels], ...d.copy().data };
      out = new DataFrame(['index', ...d.columns], data, Index.range(d.nrows), { index: d.index.dtype, ...d.dtypes });
    }
    if (inplace === true) { d.assignFrom(out); return null; }
    return out;
  }),
  round: (d) => bound(d, 'DataFrame', 'round', (a, k) => {
    const { decimals } = parseArgs('round', a, k, [['decimals', pyInt(0)]]);
    const out = d.copy();
    for (const c of out.columns) if (out.dtypes[c] === 'float64') out.data[c] = out.data[c].map((x) => roundHalfEven(x, toNumber(decimals)));
    return out;
  }),
  boxplot: (d) => bound(d, 'DataFrame', 'boxplot', (a, k, ctx) => {
    const o = parseArgs('boxplot', a, k, [['column', null], ['by', null], ['ax', null], ['fontsize', null], ['rot', pyInt(0)], ['grid', true], ['figsize', null]]);
    let cols = o.column ? toLabels(o.column) : d.numericColumns().filter((c) => d.dtypes[c] !== 'bool');
    for (const c of cols) if (!(c in d.data)) d.col(c);
    const boxes = cols.map((c) => ({ label: c, values: d.data[c].map(Number).filter((x) => !Number.isNaN(x)) }));
    return ctx.plt.boxplot(boxes, { grid: o.grid !== false, figsize: o.figsize });
  }),
  nunique: (d) => bound(d, 'DataFrame', 'nunique', () => new Series(d.columns.map((c) => new Set(d.data[c].filter((x) => !isMissing(x)).map(String)).size), new Index([...d.columns]), { dtype: 'int64' })),
  to_numpy: (d) => bound(d, 'DataFrame', 'to_numpy', () => FRAME_METHODS.values(d)),
  abs: (d) => bound(d, 'DataFrame', 'abs', () => mapFrame(d, (x) => Math.abs(x), null)),
};

function reducer(d, how) {
  return bound(d, 'DataFrame', how, (a, k) => {
    const o = parseArgs(how, a, k, [['axis', pyInt(0)], ['numeric_only', false], ['ddof', pyInt(1)]]);
    const axis = o.axis instanceof Num ? o.axis.v : o.axis;
    return reduceFrame(d, how, { numericOnly: o.numeric_only === true, axis, ddof: toNumber(o.ddof) });
  });
}

function mapFrame(d, fn, dtype) {
  const data = {}, dtypes = {};
  for (const c of d.columns) {
    if (dtype === null && d.dtypes[c] === 'object') throw new PyError('TypeError', "bad operand type for abs(): 'str'");
    data[c] = d.data[c].map(fn); dtypes[c] = dtype ?? d.dtypes[c];
  }
  return new DataFrame([...d.columns], data, d.index, dtypes);
}

// ─────────────────────────────────────────────────────────────
// 대괄호 꺼내기 — df['열'], df[['열','열']], df[조건], s[조건], .loc[…], .iloc[…]
// ─────────────────────────────────────────────────────────────
export class Indexer {
  constructor(obj, mode) { this.obj = obj; this.mode = mode; }
  get pyType() { return this.mode === 'loc' ? '_LocIndexer' : '_iLocIndexer'; }
  repr() { return `<pandas.core.indexing._${this.mode === 'loc' ? 'Loc' : 'iLoc'}Indexer object>`; }
}

// 조건(참거짓 Series)으로 고를 줄 번호
function maskPositions(target, mask) {
  if (mask.dtype !== 'bool') return null;
  if (mask.index.equals(target.index)) return mask.values.map((b, i) => (b ? i : -1)).filter((i) => i >= 0);
  // 이름표가 다르면 이름표로 맞춘다
  return target.index.labels.map((l, i) => { const p = mask.index.pos(l); return p !== undefined && mask.values[p] ? i : -1; }).filter((i) => i >= 0);
}

export function getItem(obj, key) {
  if (obj instanceof Indexer) return indexerGet(obj, key);
  if (obj instanceof DataFrame) {
    if (typeof key === 'string') return obj.col(key);
    if (Array.isArray(key) || key instanceof Index) return obj.selectColumns(toLabels(key).map(String));
    if (key instanceof Series && key.dtype === 'bool') {
      if (key.length !== obj.nrows) throw new PyError('ValueError', `Item wrong length ${key.length} instead of ${obj.nrows}.`);
      return obj.takeRows(maskPositions(obj, key));
    }
    if (key instanceof DataFrame) throw new NotSupported('df[조건표] (표 전체 조건)');
    if (key?.pyType === 'slice') { const [a, b] = sliceBounds(key, obj.nrows); return obj.sliceRows(a, b); }
    if (key instanceof Num || typeof key === 'number') {
      throw new PyError('KeyError', String(toLabel(key)), '표에서 줄 하나를 꺼낼 때는 df.loc[번호] 를 씁니다. df[...] 에는 열 이름을 넣습니다.');
    }
    throw new PyError('KeyError', pyRepr(key));
  }
  if (obj instanceof Series) {
    if (key instanceof Series && key.dtype === 'bool') return obj.take(maskPositions(obj, key));
    if (key?.pyType === 'slice') { const [a, b] = sliceBounds(key, obj.length); return new Series(obj.values.slice(a, b), obj.index.slice(a, b), { name: obj.name, dtype: obj.dtype }); }
    if (Array.isArray(key) || key instanceof Index) {
      const labels = toLabels(key);
      return obj.take(labels.map((l) => { const p = obj.index.pos(l); if (p === undefined) throw new PyError('KeyError', `"${pyListOf([l])} not in index"`); return p; }));
    }
    const label = toLabel(key);
    const p = obj.index.pos(label);
    if (p === undefined) throw new PyError('KeyError', typeof label === 'string' ? strRepr(label) : String(label), '그 이름표를 가진 칸이 없습니다.');
    return box(obj.values[p], obj.dtype);
  }
  return undefined;
}

function sliceBounds(sl, n) {
  const norm = (v, def) => { if (v == null) return def; let x = toNumber(v); if (x < 0) x += n; return Math.min(Math.max(x, 0), n); };
  return [norm(sl.start, 0), norm(sl.stop, n)];
}

function rowAsSeries(df, pos) {
  const vals = df.columns.map((c) => df.data[c][pos]);
  const allFloat = df.columns.every((c) => df.dtypes[c] === 'float64');
  const allInt = df.columns.every((c) => df.dtypes[c] === 'int64');
  const name = df.index.labels[pos];
  if (allFloat || allInt) return new Series(vals, new Index([...df.columns]), { name, dtype: allFloat ? 'float64' : 'int64' });
  const pyVals = df.columns.map((c, j) => (df.dtypes[c] === 'object' ? vals[j] : df.dtypes[c] === 'bool' ? vals[j] : new Num(vals[j], df.dtypes[c] === 'float64' ? 'float' : 'int')));
  return new Series(pyVals, new Index([...df.columns]), { name, dtype: 'object' });
}

function indexerGet(ix, key) {
  const o = ix.obj;
  let rowKey = key, colKey = null;
  if (key instanceof Tuple) { rowKey = key.items[0]; colKey = key.items[1]; }
  const isDF = o instanceof DataFrame;
  const n = isDF ? o.nrows : o.length;

  // 줄 고르기 → 위치 목록 또는 위치 하나
  let positions = null, single = null;
  if (rowKey?.pyType === 'slice') {
    if (ix.mode === 'iloc') { const [a, b] = sliceBounds(rowKey, n); positions = Array.from({ length: b - a }, (_, i) => a + i); }
    else {
      const a = rowKey.start == null ? 0 : o.index.pos(toLabel(rowKey.start));
      const b = rowKey.stop == null ? n - 1 : o.index.pos(toLabel(rowKey.stop));
      positions = Array.from({ length: Math.max(0, b - a + 1) }, (_, i) => a + i);
    }
  } else if (rowKey instanceof Series && rowKey.dtype === 'bool') {
    positions = maskPositions(o, rowKey);
  } else if (Array.isArray(rowKey) || rowKey instanceof Index) {
    const labels = toLabels(rowKey);
    positions = labels.map((l) => {
      if (ix.mode === 'iloc') { if (l < 0 || l >= n) throw new PyError('IndexError', 'positional indexers are out-of-bounds'); return l; }
      const p = o.index.pos(l);
      if (p === undefined) throw new PyError('KeyError', `"${pyListOf([l])} not in index"`, '표에 없는 줄 번호가 섞여 있습니다.');
      return p;
    });
  } else {
    const l = toLabel(rowKey);
    if (ix.mode === 'iloc') {
      const p = l < 0 ? n + l : l;
      if (p < 0 || p >= n) throw new PyError('IndexError', 'single positional indexer is out-of-bounds', `이 표는 0 부터 ${n - 1} 까지만 있습니다.`);
      single = p;
    } else {
      single = o.index.pos(l);
      if (single === undefined) {
        throw new PyError('KeyError', typeof l === 'string' ? strRepr(l) : String(l),
          '그 번호(이름표)를 가진 줄이 없습니다. 이상치를 지운 표라면 그 번호가 사라졌을 수 있어요. 위치로 고르려면 .iloc[ ] 를 쓰세요.');
      }
    }
  }

  if (!isDF) {
    if (single !== null) return box(o.values[single], o.dtype);
    return o.take(positions);
  }
  if (colKey === null) return single !== null ? rowAsSeries(o, single) : o.takeRows(positions);

  // 열까지 고른 경우
  let cols;
  if (ix.mode === 'iloc') {
    if (colKey?.pyType === 'slice') { const [a, b] = sliceBounds(colKey, o.columns.length); cols = o.columns.slice(a, b); }
    else if (Array.isArray(colKey)) cols = toLabels(colKey).map((j) => o.columns[j]);
    else { const j = toLabel(colKey); if (o.columns[j] === undefined) throw new PyError('IndexError', 'single positional indexer is out-of-bounds'); cols = o.columns[j]; }
  } else if (colKey?.pyType === 'slice') {
    const a = colKey.start == null ? 0 : o.columns.indexOf(pyStr(colKey.start));
    const b = colKey.stop == null ? o.columns.length - 1 : o.columns.indexOf(pyStr(colKey.stop));
    cols = o.columns.slice(a, b + 1);
  } else if (Array.isArray(colKey)) cols = toLabels(colKey).map(String);
  else cols = pyStr(colKey);

  if (typeof cols === 'string') {
    const s = o.col(cols);
    if (single !== null) return box(s.values[single], s.dtype);
    return s.take(positions);
  }
  const sub = o.selectColumns(cols);
  return single !== null ? rowAsSeries(sub, single) : sub.takeRows(positions);
}

export function setItem(obj, key, value) {
  if (obj instanceof DataFrame && typeof key === 'string') {
    let vals, dtype;
    if (value instanceof Series) {
      if (value.index.equals(obj.index)) vals = [...value.values];
      else vals = obj.index.labels.map((l) => { const p = value.index.pos(l); return p === undefined ? NaN : value.values[p]; });
      dtype = value.dtype;
    } else if (value instanceof NDArray && value.ndim === 1) {
      if (value.size !== obj.nrows) throw new PyError('ValueError', `Length of values (${value.size}) does not match length of index (${obj.nrows})`);
      vals = [...value.data]; dtype = value.dtype;
    } else if (Array.isArray(value)) {
      if (value.length !== obj.nrows) throw new PyError('ValueError', `Length of values (${value.length}) does not match length of index (${obj.nrows})`);
      dtype = inferDtype(value); vals = value.map((v) => unbox(v, dtype));
    } else {
      dtype = inferDtype([value]); vals = Array(obj.nrows).fill(unbox(value, dtype));
    }
    if (!(key in obj.data)) obj.columns.push(key);
    obj.data[key] = vals; obj.dtypes[key] = dtype;
    return;
  }
  if (obj instanceof Series) {
    const p = obj.index.pos(toLabel(key));
    if (p === undefined) throw new NotSupported('시리즈에 새 칸 추가');
    obj.values[p] = unbox(value, obj.dtype);
    return;
  }
  throw new NotSupported(`${typeName(obj)} 에 [ ] 로 값 넣기`);
}

// ─────────────────────────────────────────────────────────────
// 연산 — s > upper, (조건) | (조건), df - df.min(), s * 2 …
// ─────────────────────────────────────────────────────────────
const CMP = new Set(['>', '<', '>=', '<=', '==', '!=']);

function scalarOp(op, x, y) {
  switch (op) {
    case '+': return x + y;
    case '-': return x - y;
    case '*': return x * y;
    case '/': return x / y;
    case '//': return Math.floor(x / y);
    case '%': return ((x % y) + y) % y;
    case '**': return x ** y;
    case '>': return x > y;
    case '<': return x < y;
    case '>=': return x >= y;
    case '<=': return x <= y;
    case '==': return x === y;
    case '!=': return x !== y;
    case '&': return Boolean(x) && Boolean(y);
    case '|': return Boolean(x) || Boolean(y);
  }
  throw new Error(op);
}

function resultDtype(op, da, db) {
  if (CMP.has(op)) return 'bool';
  if (op === '&' || op === '|') return 'bool';
  if (op === '/' || op === '**' && db === 'float64') return 'float64';
  if (da === 'float64' || db === 'float64') return 'float64';
  return 'int64';
}

function scalarInfo(v) {
  if (v instanceof Num) return { v: v.v, dtype: v.isFloat ? 'float64' : v.k === 'b_' ? 'bool' : 'int64' };
  if (typeof v === 'boolean') return { v, dtype: 'bool' };
  if (typeof v === 'string') return { v, dtype: 'object' };
  if (v === null) return { v: NaN, dtype: 'float64' };
  return null;
}

function checkLogical(op, dtype, side) {
  if ((op === '&' || op === '|') && dtype !== 'bool') {
    throw new PyError('TypeError', `unsupported operand type(s) for ${op}: '${dtype === 'float64' ? 'float' : dtype}' and 'bool'`,
      `조건을 ${op} 로 이을 때는 조건마다 괄호로 감싸야 합니다.\n예) (s > upper) ${op} (s < lower)\n괄호가 없으면 파이썬은 ${op} 를 > · < 보다 먼저 계산합니다.`);
  }
}

// 연산 한 번. 판다스·넘파이 값이 끼어 있으면 여기서 처리하고, 아니면 undefined.
export function pandasBinop(op, a, b) {
  const aS = a instanceof Series, bS = b instanceof Series;
  const aD = a instanceof DataFrame, bD = b instanceof DataFrame;
  if (!aS && !bS && !aD && !bD) return undefined;

  if ((aS || bS) && !aD && !bD) {
    const s = aS ? a : b;
    if (aS && bS) {
      let bv = b.values;
      if (!a.index.equals(b.index)) bv = a.index.labels.map((l) => { const p = b.index.pos(l); return p === undefined ? NaN : b.values[p]; });
      checkLogical(op, a.dtype); checkLogical(op, b.dtype);
      const dtype = resultDtype(op, a.dtype, b.dtype);
      return new Series(a.values.map((x, i) => elem(op, x, bv[i], dtype)), a.index, { name: a.name === b.name ? a.name : null, dtype });
    }
    const other = aS ? b : a;
    const info = scalarInfo(other);
    if (!info) throw new PyError('TypeError', `unsupported operand type(s) for ${op}: '${typeName(a)}' and '${typeName(b)}'`);
    checkLogical(op, s.dtype);
    if (op === '&' || op === '|') checkLogical(op, info.dtype);
    if (s.dtype === 'object' && !CMP.has(op)) {
      throw new PyError('TypeError', `unsupported operand type(s) for ${op}: 'str' and '${typeName(other)}'`, `'${s.name}' 열은 글자라서 계산할 수 없습니다.`);
    }
    if (s.dtype === 'object' && CMP.has(op) && op !== '==' && op !== '!=' && typeof info.v !== 'string') {
      throw new PyError('TypeError', `'${op}' not supported between instances of 'str' and '${typeName(other)}'`, `'${s.name}' 열은 글자라서 수와 크기를 비교할 수 없습니다.`);
    }
    const dtype = resultDtype(op, s.dtype, info.dtype);
    const vals = s.values.map((x) => (aS ? elem(op, x, info.v, dtype) : elem(op, info.v, x, dtype)));
    return new Series(vals, s.index, { name: s.name, dtype });
  }

  // DataFrame 이 낀 계산 — 열마다
  const df = aD ? a : b;
  const out = {}, dtypes = {};
  for (const c of df.columns) {
    const left = aD ? new Series(a.data[c], a.index, { name: c, dtype: a.dtypes[c] }) : a instanceof Series ? pickFromSeries(a, c, df) : a;
    const right = bD ? (c in b.data ? new Series(b.data[c], b.index, { name: c, dtype: b.dtypes[c] }) : NaN) : b instanceof Series ? pickFromSeries(b, c, df) : b;
    const r = pandasBinop(op, left, right) ?? pandasBinop(op, left instanceof Series ? left : right, left instanceof Series ? right : left);
    out[c] = r.values; dtypes[c] = r.dtype;
  }
  return new DataFrame([...df.columns], out, df.index, dtypes);
}

// df - df.min() 처럼 표와 시리즈를 계산하면 시리즈의 이름표가 열 이름과 짝지어진다
function pickFromSeries(s, col, df) {
  const p = s.index.pos(col);
  const v = p === undefined ? NaN : s.values[p];
  return box(v, s.dtype);
}

function elem(op, x, y, dtype) {
  if (x instanceof Num) x = x.v;
  if (y instanceof Num) y = y.v;
  if (CMP.has(op)) {
    if ((typeof x === 'number' && Number.isNaN(x)) || (typeof y === 'number' && Number.isNaN(y))) return op === '!=';
    return scalarOp(op, x, y);
  }
  if (dtype === 'bool') return scalarOp(op, x, y);
  return scalarOp(op, Number(x), Number(y));
}

export function pandasUnary(op, v) {
  if (v instanceof Series) {
    if (op === '~') {
      if (v.dtype !== 'bool') throw new PyError('TypeError', "bad operand type for unary ~: 'float'");
      return v.copyWith(v.values.map((x) => !x));
    }
    if (op === '-') return v.copyWith(v.requireNumeric('부호 바꾸기').map((x) => -x));
    return v;
  }
  if (v instanceof DataFrame && op === '~') return mapFrame(v, (x) => !x, 'bool');
  return undefined;
}

// ─────────────────────────────────────────────────────────────
// 화면 표기 (repr)
// ─────────────────────────────────────────────────────────────
const MAX_ROWS = 60, MIN_ROWS = 10;

// 열 하나의 값들을 글자로 — 앞에 부호 자리(빈칸)를 둔다
function formatValues(values, dtype) {
  if (dtype === 'float64') {
    const s = pandasFloatColumn(values);
    // 너무 크거나 작은 값이 섞이면 지수 표기로
    const abs = values.filter((x) => !Number.isNaN(x)).map(Math.abs);
    const withSign = s.map((x, i) => (x === 'NaN' ? 'NaN' : (values[i] < 0 || Object.is(values[i], -0) ? '' : ' ') + x));
    const tooLong = Math.max(0, ...withSign.map((x) => x.length)) > 12;
    if (abs.some((x) => x > 0 && x < 1e-6) || (tooLong && abs.some((x) => x > 1e6))) {
      return values.map((x) => (Number.isNaN(x) ? 'NaN' : (x < 0 ? '' : ' ') + expPy(x)));
    }
    return withSign;
  }
  if (dtype === 'int64') return values.map((x) => (x < 0 ? '' : ' ') + String(x));
  if (dtype === 'bool') return values.map((x) => ' ' + (x ? 'True' : 'False'));
  return values.map((x) => {
    if (isMissing(x)) return ' NaN';
    if (x instanceof Num && x.isFloat) return ' ' + pandasFloatSingle(x.v).replace(/^-/, '-');
    if (x instanceof Num) return ' ' + String(x.v);
    if (typeof x === 'boolean') return ' ' + (x ? 'True' : 'False');
    return ' ' + pyStr(x);
  }).map((x) => x.replace(/^ -/, '-'));
}

function expPy(x) {
  const [m, e] = x.toExponential(6).split('e');
  const n = Number(e);
  return m.replace('-', '') + 'e' + (n < 0 ? '-' : '+') + String(Math.abs(n)).padStart(2, '0');
}

function truncatedRows(n) {
  if (n <= MAX_ROWS) return { rows: [...Array(n).keys()], cut: -1 };
  const half = MIN_ROWS / 2;
  return { rows: [...Array(half).keys(), ...Array.from({ length: half }, (_, i) => n - half + i)], cut: half };
}

function labelStr(l) {
  if (l instanceof Num) return pyStr(l);
  return typeof l === 'number' ? String(l) : String(l);
}

export function renderFrame(df) {
  const n = df.nrows;
  if (df.columns.length === 0 || n === 0) {
    const cols = '[' + df.columns.map((c) => c).join(', ') + ']';
    const idx = '[' + df.index.labels.map(labelStr).join(', ') + ']';
    return `Empty DataFrame\nColumns: ${cols}\nIndex: ${idx}`;
  }
  const { rows, cut } = truncatedRows(n);
  const idxStrs = rows.map((i) => labelStr(df.index.labels[i]));
  const idxW = Math.max(0, ...idxStrs.map((x) => x.length));
  const strcols = [];
  // 이름표 열 (왼쪽 맞춤)
  const idxCol = ['', ...idxStrs].map((x) => x.padEnd(idxW));
  strcols.push(idxCol);
  for (const c of df.columns) {
    const dt = df.dtypes[c];
    const header = (NUMERIC.has(dt) ? ' ' : '') + c;
    const vals = formatValues(rows.map((i) => df.data[c][i]), dt);
    const w = Math.max(header.length, ...vals.map((x) => x.length));
    strcols.push([header.padStart(w), ...vals.map((x) => x.padStart(w))]);
  }
  if (cut >= 0) {
    strcols.forEach((col, ix) => {
      const cw = col[cut].length;
      const dots = cw > 3 ? '...' : '..';
      col.splice(cut + 1, 0, ix === 0 ? dots.padEnd(cw) : dots.padStart(cw));
    });
  }
  const lines = [];
  for (let r = 0; r < strcols[0].length; r++) lines.push(strcols.map((col) => col[r]).join(' '));
  let out = lines.join('\n');
  if (cut >= 0) out += `\n\n[${n} rows x ${df.columns.length} columns]`;
  return out;
}

export function renderSeries(s) {
  const n = s.length;
  const nameTxt = s.name == null ? null : `Name: ${typeof s.name === 'string' ? s.name : labelStr(s.name)}`;
  const dtypeTxt = `dtype: ${s.dtype}`;
  if (n === 0) {
    return `Series([], ${[nameTxt, dtypeTxt].filter(Boolean).join(', ')})`;
  }
  const { rows, cut } = truncatedRows(n);
  let vals = formatValues(rows.map((i) => s.values[i]), s.dtype);
  const vw = Math.max(...vals.map((x) => x.length));
  vals = vals.map((x) => x.padStart(vw));
  let idx = rows.map((i) => labelStr(s.index.labels[i]));
  if (cut >= 0) {
    vals.splice(cut, 0, center(vw > 3 ? '...' : '..', vw));
    idx.splice(cut, 0, '');
  }
  const iw = Math.max(...idx.map((x) => x.length));
  const lines = idx.map((l, i) => l.padEnd(iw) + '   ' + vals[i]);
  let out = (s.index.name != null ? String(s.index.name) + '\n' : '') + lines.join('\n');
  const footer = [nameTxt, cut >= 0 ? `Length: ${n}` : null, dtypeTxt].filter(Boolean).join(', ');
  return out + '\n' + footer;
}

export { fixed };
