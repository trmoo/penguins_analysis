// 실행기 — 구문 나무를 따라가며 계산한다. 코랩의 "커널" 하나에 해당한다.
//   const k = new Kernel({ files: { 'penguins.csv': csv글자 } });
//   const r = k.run("penguins.head(3)");
//   r.items  → [{kind:'display', text}, {kind:'stdout', text}, {kind:'figure', fig}, {kind:'stderr', text}]
//   r.error  → null 또는 { type, message, line, source, hint }
// 변수는 셀을 넘어 이어진다(주피터처럼 위 셀에서 만든 penguins 를 아래 셀에서 쓴다).
import { parse, splitFString } from './parser.js';
import {
  Num, pyInt, pyFloatNum, f64, i64, npBool, Tuple, Dict, PyFunc, Module, PyError, NotSupported,
  repr, str as pyStr, typeName, truthy, toNumber, isNumberLike, parseArgs, REQUIRED,
} from './pyvalues.js';
import { DataFrame, Series, Index, Indexer, getItem, setItem, pandasBinop, pandasUnary, nearest, isMissing } from './pandas.js';
import { NDArray, roundHalfEven } from './ndarray.js';
import { PlotState, Figure, Axes } from './plotting.js';
import { makeModules, KNOWN_REAL_MODULES } from './modules.js';
import { pyFloat, fixed } from './numfmt.js';

// 진짜 pandas 에는 있지만 이 실습실이 흉내 내지 않는 이름들 — "없는 명령"과 구분해 알려 준다
const REAL_PANDAS_NAMES = new Set(['plot', 'hist', 'groupby', 'merge', 'join', 'apply', 'map', 'corr', 'cov', 'agg', 'aggregate',
  'pivot', 'pivot_table', 'melt', 'set_index', 'rename', 'replace', 'sample', 'query', 'iterrows', 'itertuples', 'items',
  'to_csv', 'to_excel', 'to_dict', 'cumsum', 'cumprod', 'clip', 'mode', 'idxmax', 'idxmin', 'isin', 'where', 'mask',
  'interpolate', 'ffill', 'bfill', 'duplicated', 'drop_duplicates', 'nlargest', 'nsmallest', 'kurt', 'skew', 'T',
  'transpose', 'memory_usage', 'insert', 'pop', 'assign', 'eval', 'between', 'str', 'dt', 'cat', 'diff', 'pct_change',
  'rank', 'shift', 'rolling', 'expanding', 'resample', 'explode', 'stack', 'unstack', 'crosstab', 'at', 'iat', 'keys',
  'select_dtypes', 'filter', 'squeeze', 'first_valid_index', 'last_valid_index', 'le', 'ge', 'lt', 'gt', 'eq', 'ne',
  'add', 'sub', 'mul', 'div', 'truediv', 'floordiv', 'pow', 'dot', 'combine', 'update', 'align', 'equals', 'sort_index',
  'set_axis', 'swapaxes', 'to_frame', 'item', 'argmax', 'argmin', 'is_unique', 'hasnans', 'axes', 'ndim', 'attrs', 'style']);

const METHOD_NAMES = {
  DataFrame: ['head', 'tail', 'info', 'describe', 'isnull', 'isna', 'notnull', 'notna', 'sum', 'mean', 'median', 'min', 'max',
    'std', 'var', 'count', 'fillna', 'dropna', 'drop', 'copy', 'boxplot', 'shape', 'columns', 'index', 'dtypes', 'values',
    'loc', 'iloc', 'sort_values', 'reset_index', 'round', 'quantile', 'any', 'all', 'nunique', 'size', 'empty'],
  Series: ['head', 'tail', 'describe', 'isnull', 'isna', 'notnull', 'sum', 'mean', 'median', 'min', 'max', 'std', 'var',
    'count', 'fillna', 'dropna', 'drop', 'copy', 'round', 'unique', 'nunique', 'value_counts', 'quantile', 'values', 'index',
    'name', 'dtype', 'shape', 'sort_values', 'tolist', 'astype', 'loc', 'iloc', 'any', 'all'],
};

// 변수를 먼저 만들어야 하는 이름 — "아직 없다"는 오류에 알맞은 도움말을 붙인다
const NAME_HINTS = {
  pd: 'pd 는 import pandas as pd 로 먼저 가져와야 씁니다. 맨 위 셀을 먼저 실행했나요?',
  np: 'np 는 import numpy as np 로 먼저 가져와야 씁니다.',
  plt: 'plt 는 import matplotlib.pyplot as plt 로 먼저 가져와야 씁니다.',
  penguins: 'penguins 표는 pd.read_csv(...) 로 불러오는 첫 셀에서 만들어집니다. 위쪽 셀부터 차례대로 실행하세요.',
  MinMaxScaler: 'MinMaxScaler 는 from sklearn.preprocessing import MinMaxScaler 로 먼저 가져와야 씁니다.',
};

export class Kernel {
  constructor({ files = {} } = {}) {
    this.files = files;
    this.env = new Map();
    this.count = 0;
    this.modules = makeModules(() => this.ctx);
  }

  reset() { this.env = new Map(); this.count = 0; }

  run(code) {
    this.count++;
    const items = [];
    const pushText = (kind, text) => {
      const last = items[items.length - 1];
      if (last && last.kind === kind) last.text += text; else items.push({ kind, text });
    };
    const srcLines = code.replace(/\r\n?/g, '\n').split('\n');
    let curLine = 1;
    const plt = new PlotState((fig) => items.push({ kind: 'figure', fig }));
    this.ctx = {
      print: (t) => pushText('stdout', t),
      warn: (t) => pushText('stderr', `<ipython-input-${this.count}>:${curLine}: ${t}  ${(srcLines[curLine - 1] ?? '').trim()}\n`),
      note: (t) => items.push({ kind: 'note', text: t }),
      plt,
      files: this.files,
      kernel: this,
    };
    const assigned = new Set();
    const result = { items, error: null, assigned, count: this.count };
    try {
      const stmts = parse(code);
      stmts.forEach((st, i) => {
        curLine = st.line;
        const isLast = i === stmts.length - 1;
        if (st.type === 'Expr') {
          const v = this.eval(st.expr);
          if (isLast && v !== null && v !== undefined) {
            items.push({ kind: 'display', text: repr(v), value: v });
            if (v instanceof PyFunc && v.self) {
              items.push({ kind: 'note', text: `괄호 ( ) 를 빠뜨렸나요? ${v.name} 뒤에 ( ) 를 붙여야 명령이 실행됩니다. 지금은 "명령 그 자체"가 찍혔습니다.` });
            }
          }
        } else {
          this.exec(st, assigned);
        }
      });
      plt.flush();
    } catch (e) {
      plt.flush();
      result.error = this.describeError(e, curLine, srcLines);
    }
    return result;
  }

  describeError(e, curLine, srcLines) {
    const line = e.line ?? curLine;
    const source = srcLines[line - 1] ?? '';
    if (e instanceof PyError) return { type: e.type, message: e.pyMessage, hint: e.hint, line, source };
    if (e instanceof NotSupported) {
      return { type: 'NotSupported', message: e.what, line, source,
        hint: `진짜 파이썬에는 있지만 이 실습실에서는 아직 실행할 수 없는 명령입니다 — ${e.what}. 코랩에서 해 보세요.` };
    }
    if (e instanceof RangeError) {
      return { type: 'RecursionError', message: 'maximum recursion depth exceeded', line, source, hint: '식이 너무 깁니다.' };
    }
    console.error(e);
    return { type: 'InternalError', message: String(e?.message ?? e), line, source,
      hint: '실습실 엔진이 이 코드를 처리하지 못했습니다. 코드는 맞을 수도 있습니다. 선생님께 알려 주세요.' };
  }

  // ── 문장 ──────────────────────────────────────────────
  exec(st, assigned) {
    switch (st.type) {
      case 'Pass': return;
      case 'Import':
        for (const { module, as } of st.names) {
          const mod = this.importModule(module, st.line);
          if (as) { this.env.set(as, mod); assigned.add(as); }
          else { const top = module.split('.')[0]; this.env.set(top, this.importModule(top, st.line)); assigned.add(top); }
        }
        return;
      case 'ImportFrom': {
        const mod = this.importModule(st.module, st.line);
        for (const { name, as } of st.names) {
          if (name === '*') throw new NotSupported('from … import *');
          let v = mod.attrs[name];
          if (v === undefined && this.modules[`${st.module}.${name}`]) v = this.modules[`${st.module}.${name}`];
          if (v === undefined) {
            const near = nearest(name, Object.keys(mod.attrs));
            throw new PyError('ImportError', `cannot import name '${name}' from '${st.module}'`, near ? `혹시 ${near} 아닐까요? (대문자·소문자까지 똑같아야 합니다)` : '');
          }
          this.env.set(as ?? name, v); assigned.add(as ?? name);
        }
        return;
      }
      case 'Assign': {
        const v = this.eval(st.value);
        for (const t of st.targets) this.assign(t, v, assigned);
        return;
      }
      case 'AugAssign': {
        const cur = this.eval(st.target);
        this.assign(st.target, this.binop(st.op, cur, this.eval(st.value)), assigned);
        return;
      }
    }
    throw new Error('알 수 없는 문장 ' + st.type);
  }

  importModule(name, line) {
    const m = this.modules[name];
    if (m) return m;
    const top = name.split('.')[0];
    if (KNOWN_REAL_MODULES.has(top) || this.modules[top]) {
      const e = new NotSupported(`import ${name}`); e.line = line; throw e;
    }
    const near = nearest(name, Object.keys(this.modules));
    throw new PyError('ModuleNotFoundError', `No module named '${name}'`, near ? `혹시 ${near} 아닐까요?` : '모듈 이름의 철자를 확인하세요.');
  }

  assign(t, v, assigned) {
    if (t.type === 'Name') { this.env.set(t.id, v); assigned.add(t.id); return; }
    if (t.type === 'Tuple' || t.type === 'List') {
      const items = this.iterate(v);
      if (items.length !== t.items.length) {
        if (items.length > t.items.length) throw new PyError('ValueError', `too many values to unpack (expected ${t.items.length})`, `오른쪽 값은 ${items.length}개인데 왼쪽 이름은 ${t.items.length}개입니다.`);
        throw new PyError('ValueError', `not enough values to unpack (expected ${t.items.length}, got ${items.length})`, `오른쪽 값은 ${items.length}개인데 왼쪽 이름은 ${t.items.length}개입니다.`);
      }
      t.items.forEach((x, i) => this.assign(x, items[i], assigned));
      return;
    }
    if (t.type === 'Subscript') {
      const obj = this.eval(t.obj);
      const key = this.evalIndex(t.index);
      if (Array.isArray(obj)) { obj[this.listIndex(obj, key)] = v; return; }
      if (obj instanceof Dict) { obj.map.set(key, v); return; }
      if (obj instanceof Indexer) throw new NotSupported('.loc[ ] · .iloc[ ] 로 값 바꾸기');
      setItem(obj, key, v);
      const root = rootName(t.obj); if (root) assigned.add(root);
      return;
    }
    if (t.type === 'Attribute') {
      const obj = this.eval(t.obj);
      if (obj instanceof DataFrame) {
        throw new NotSupported('df.새열 = 값 (pandas 는 이렇게 새 열을 만들지 않습니다. df["새열"] = 값 을 쓰세요)');
      }
      throw new PyError('AttributeError', `'${typeName(obj)}' object attribute '${t.name}' is read-only`);
    }
  }

  iterate(v) {
    if (Array.isArray(v)) return v;
    if (v instanceof Tuple) return v.items;
    if (typeof v === 'string') return [...v];
    if (v instanceof NDArray) {
      if (v.ndim === 1) return v.data.map((x) => v.scalar(x));
      return Array.from({ length: v.shape[0] }, (_, i) => new NDArray(v.row(i), [v.shape[1]], v.dtype));
    }
    if (v instanceof Series) return v.values.map((x, i) => getItem(new Indexer(v, 'iloc'), pyInt(i)));
    if (v instanceof Index) return v.labels.map((x) => (typeof x === 'number' ? pyInt(x) : x));
    if (v instanceof DataFrame) return [...v.columns];
    if (v instanceof Dict) return [...v.map.keys()];
    throw new PyError('TypeError', `cannot unpack non-iterable ${typeName(v)} object`, '여러 이름에 나눠 담으려면 오른쪽이 값 여러 개(리스트·튜플·배열)여야 합니다.');
  }

  listIndex(list, key) {
    if (!(key instanceof Num) || key.isFloat) throw new PyError('TypeError', `list indices must be integers or slices, not ${typeName(key)}`);
    let i = key.v; if (i < 0) i += list.length;
    if (i < 0 || i >= list.length) throw new PyError('IndexError', 'list index out of range', `0 부터 ${list.length - 1} 까지만 있습니다.`);
    return i;
  }

  // ── 식 ───────────────────────────────────────────────
  eval(n) {
    switch (n.type) {
      case 'Num': return n.isInt ? pyInt(n.value) : pyFloatNum(n.value);
      case 'Str': return n.value;
      case 'FString': return n.parts.map((p) => (p.f ? this.fstring(p.text) : p.text)).join('');
      case 'Const': return n.value;
      case 'Name': return this.lookup(n.id);
      case 'List': return n.items.map((x) => this.eval(x));
      case 'Tuple': return new Tuple(n.items.map((x) => this.eval(x)));
      case 'Dict': return new Dict(n.keys.map((k, i) => [this.eval(k), this.eval(n.values[i])]));
      case 'Attribute': {
        let obj;
        try { obj = this.eval(n.obj); } catch (e) {
          // pd.read_csv(penguins.csv) — 따옴표를 빠뜨려 파일 이름이 변수 이름으로 읽힌 경우
          if (e instanceof PyError && e.type === 'NameError' && ['csv', 'txt', 'xlsx', 'json'].includes(n.name)) {
            e.hint = "파일 이름은 따옴표로 감싸야 글자로 읽힙니다. 예) pd.read_csv('penguins.csv')";
          }
          throw e;
        }
        return this.getAttr(obj, n.name, n);
      }
      case 'Subscript': return this.subscript(this.eval(n.obj), this.evalIndex(n.index), n);
      case 'Call': return this.call(n);
      case 'BinOp': return this.binop(n.op, this.eval(n.left), this.eval(n.right), n);
      case 'Unary': return this.unary(n.op, this.eval(n.operand));
      case 'BoolOp': {
        const l = this.eval(n.left);
        if (n.op === 'and') return truthy(l) ? this.eval(n.right) : l;
        return truthy(l) ? l : this.eval(n.right);
      }
      case 'Compare': {
        let left = this.eval(n.first);
        let result = true;
        for (let i = 0; i < n.ops.length; i++) {
          const right = this.eval(n.rest[i]);
          const r = this.compare(n.ops[i], left, right);
          if (n.ops.length === 1) return r;
          if (!truthy(r)) return r;
          result = r; left = right;
        }
        return result;
      }
      case 'Slice': return this.evalIndex(n);
    }
    throw new Error('알 수 없는 식 ' + n.type);
  }

  fstring(text) {
    return splitFString(text).map((p) => {
      if (p.lit !== undefined) return p.lit;
      const stmts = parse(p.expr.trim());
      const v = this.eval(stmts[0].expr);
      return formatSpec(v, p.spec);
    }).join('');
  }

  evalIndex(n) {
    if (n.type === 'Slice') {
      return { pyType: 'slice', start: n.start ? this.eval(n.start) : null, stop: n.stop ? this.eval(n.stop) : null, step: n.step ? this.eval(n.step) : null };
    }
    if (n.type === 'Tuple' && !n.paren) return new Tuple(n.items.map((x) => this.evalIndex(x)));
    return this.eval(n);
  }

  lookup(id) {
    if (this.env.has(id)) return this.env.get(id);
    if (BUILTINS[id]) return BUILTINS[id];
    const candidates = [...this.env.keys(), ...Object.keys(BUILTINS)];
    const near = nearest(id, candidates);
    let hint = NAME_HINTS[id] ?? (/^mean\d$/.test(id) ? `${id} 는 평균을 구하는 셀에서 만들어집니다. 그 셀을 먼저 실행하세요.` : '');
    if (!hint && ['q1', 'q3', 'iqr', 'upper', 'lower', 'outliers'].includes(id)) hint = `${id} 는 이상치를 찾는 셀에서 만들어집니다. 그 셀을 먼저 실행하세요.`;
    if (!hint && near) hint = `혹시 ${near} 아닐까요? (대문자·소문자, 밑줄 하나까지 똑같아야 합니다)`;
    if (!hint) hint = '아직 만들지 않은 이름입니다. 위쪽 셀을 먼저 실행했는지, 철자가 맞는지 확인하세요.';
    throw new PyError('NameError', `name '${id}' is not defined`, hint);
  }

  getAttr(obj, name, node) {
    if (obj instanceof Module) {
      if (name in obj.attrs) return obj.attrs[name];
      const near = nearest(name, Object.keys(obj.attrs));
      // 학생이 붙인 별명(pd·np·plt)으로 알려 준다
      const alias = node?.obj?.type === 'Name' ? node.obj.id : obj.name.split('.').pop();
      let hint = near ? `혹시 ${alias}.${near} 아닐까요?` : '';
      if (obj.name === 'matplotlib' && ['subplot', 'show', 'title', 'xlabel', 'ylabel', 'tight_layout'].includes(name)) {
        hint = 'plt 에 matplotlib 를 통째로 넣었습니다. 그림 명령은 matplotlib.pyplot 안에 있으니 import matplotlib.pyplot as plt 로 가져오세요.';
      }
      throw new PyError('AttributeError', `module '${obj.name}' has no attribute '${name}'`, hint);
    }
    if (obj instanceof PyFunc && obj.kind === 'class' && obj.classAttrs?.[name]) return obj.classAttrs[name];
    if (obj && typeof obj.getattr === 'function') {
      const v = obj.getattr(name);
      if (v !== undefined) return v;
    }
    if (typeof obj === 'string') {
      const sm = STRING_METHODS[name];
      if (sm) return new PyFunc(name, (a, k) => sm(obj, a, k), { owner: 'str', self: obj });
    }
    if (Array.isArray(obj) && name === 'append') return new PyFunc('append', (a) => { obj.push(a[0]); return null; }, { owner: 'list', self: obj });
    if (obj instanceof Dict && ['keys', 'values', 'items'].includes(name)) {
      return new PyFunc(name, () => [...obj.map[name === 'items' ? 'entries' : name]()].map((x) => (Array.isArray(x) ? new Tuple(x) : x)), { owner: 'dict', self: obj });
    }
    const tn = typeName(obj);
    const shortTn = tn.replace(/^pandas\.|^numpy\./, '');
    if ((obj instanceof DataFrame || obj instanceof Series) && REAL_PANDAS_NAMES.has(name)) {
      throw new NotSupported(`${shortTn}.${name}`);
    }
    let hint = '';
    const pool = obj instanceof DataFrame ? [...METHOD_NAMES.DataFrame, ...obj.columns] : obj instanceof Series ? METHOD_NAMES.Series : [];
    const near = nearest(name, pool);
    if (near) hint = `혹시 ${near} 아닐까요?`;
    if (obj instanceof Series && name === 'boxplot') hint = '상자그림(boxplot)은 표(DataFrame)에 쓰는 명령입니다. 열 하나만 그리려면 penguins[[\'열이름\']].boxplot() 처럼 대괄호를 두 겹으로 쓰세요.';
    if (obj instanceof Series && name === 'shape') hint = '';
    if (obj === null) hint = '앞의 명령이 아무 값도 돌려주지 않았습니다(None). inplace=True 를 쓴 명령은 결과를 돌려주지 않고 원본을 바꿉니다.';
    if (obj instanceof PyFunc && obj.self) hint = `${obj.name} 뒤에 괄호 ( ) 를 빠뜨렸습니다. 명령을 실행한 결과에 이어 써야 합니다. 예) ${obj.name}().${name}`;
    if (['csv', 'txt', 'xlsx', 'json'].includes(name)) hint = "파일 이름은 따옴표로 감싸야 글자로 읽힙니다. 예) pd.read_csv('penguins.csv')";
    if (obj instanceof Axes) hint = '상자그림을 그리는 명령은 결과로 그림 칸(Axes)을 돌려줍니다. 표에 쓰려던 명령이라면 앞부분을 확인하세요.';
    throw new PyError('AttributeError', `'${obj instanceof Module ? 'module' : displayType(obj)}' object has no attribute '${name}'`, hint);
  }

  subscript(obj, key, node) {
    if (obj instanceof DataFrame || obj instanceof Series || obj instanceof Indexer) return getItem(obj, key);
    if (Array.isArray(obj) || obj instanceof Tuple || typeof obj === 'string') {
      const arr = Array.isArray(obj) ? obj : obj instanceof Tuple ? obj.items : [...obj];
      if (key?.pyType === 'slice') {
        const n = arr.length;
        const norm = (v, d) => { if (v == null) return d; let x = toNumber(v); if (x < 0) x += n; return Math.min(Math.max(x, 0), n); };
        const part = arr.slice(norm(key.start, 0), norm(key.stop, n));
        return Array.isArray(obj) ? part : obj instanceof Tuple ? new Tuple(part) : part.join('');
      }
      const i = this.listIndex(arr, key instanceof Num && key.k === 'i64' ? pyInt(key.v) : key);
      return arr[i];
    }
    if (obj instanceof Index) {
      if (key?.pyType === 'slice') {
        const n = obj.length;
        const norm = (v, d) => { if (v == null) return d; let x = toNumber(v); if (x < 0) x += n; return Math.min(Math.max(x, 0), n); };
        return obj.slice(norm(key.start, 0), norm(key.stop, n));
      }
      if (key instanceof Series && key.dtype === 'bool') return obj.take(key.values.map((b, i) => (b ? i : -1)).filter((i) => i >= 0));
      const arr = obj.labels.map((x) => (typeof x === 'number' ? pyInt(x) : x));
      return arr[this.listIndex(arr, key instanceof Num ? pyInt(key.v) : key)];
    }
    if (obj instanceof NDArray) {
      if (key instanceof Num && !key.isFloat) {
        let i = key.v; const n = obj.shape[0]; if (i < 0) i += n;
        if (i < 0 || i >= n) throw new PyError('IndexError', `index ${key.v} is out of bounds for axis 0 with size ${n}`);
        return obj.ndim === 1 ? obj.scalar(obj.data[i]) : new NDArray(obj.row(i), [obj.shape[1]], obj.dtype);
      }
      if (key instanceof Tuple && obj.ndim === 2) {
        const [r, c] = key.items;
        if (r?.pyType === 'slice' && c instanceof Num) return new NDArray(obj.col(c.v), [obj.shape[0]], obj.dtype);
        if (r instanceof Num && c instanceof Num) return obj.scalar(obj.data[r.v * obj.shape[1] + c.v]);
      }
      throw new NotSupported('이런 방식의 배열 대괄호 꺼내기');
    }
    if (obj instanceof Dict) {
      for (const [k, v] of obj.map) if (repr(k) === repr(key)) return v;
      throw new PyError('KeyError', repr(key));
    }
    if (obj instanceof PyFunc) {
      throw new PyError('TypeError', `'method' object is not subscriptable`, `명령어 ${obj.name} 뒤에는 대괄호 [ ] 가 아니라 괄호 ( ) 를 씁니다. 예) ${obj.name}()`);
    }
    throw new PyError('TypeError', `'${displayType(obj)}' object is not subscriptable`,
      obj === null ? '앞의 명령이 아무 값도 돌려주지 않았습니다(None).' : '');
  }

  call(n) {
    const fn = this.eval(n.func);
    const args = n.args.map((a) => this.eval(a));
    const kw = new Map(n.kwargs.map((k) => [k.name, this.eval(k.value)]));
    if (fn instanceof PyFunc) return fn.fn(args, kw, this.ctx);
    if (fn instanceof Module) {
      throw new PyError('TypeError', "'module' object is not callable",
        fn.name === 'matplotlib.figure' ? 'plt 에 matplotlib 를 통째로 넣어서 plt.figure 가 명령이 아니라 모듈이 되었습니다. import matplotlib.pyplot as plt 로 가져오세요.' : '');
    }
    let hint = '';
    const callee = n.func.type === 'Attribute' ? n.func.name : n.func.type === 'Name' ? n.func.id : '';
    if (fn instanceof Tuple && callee === 'shape') hint = 'shape 는 명령이 아니라 값이라서 괄호 없이 씁니다. 예) penguins.shape';
    else if (fn instanceof Index || fn instanceof Series && ['index', 'columns', 'values'].includes(callee)) hint = `${callee} 는 괄호 없이 씁니다.`;
    else if (['columns', 'index', 'values', 'dtypes', 'loc', 'iloc', 'size'].includes(callee)) hint = `${callee} 는 명령이 아니라 값이라서 괄호 없이 씁니다.`;
    else if (fn instanceof Series && n.func.type === 'Attribute') hint = `${callee} 는 열 이름이라서 괄호를 붙일 수 없습니다. 명령어 이름의 철자를 확인하세요.`;
    else if (fn instanceof DataFrame) hint = '표 이름 뒤에 바로 괄호를 붙였습니다. 점(.)과 명령어 이름이 빠진 것 같습니다. 예) penguins.head()';
    else if (fn instanceof Num) hint = '수 뒤에 괄호를 붙였습니다. 곱하기라면 * 를 써야 합니다. 예) 1.5 * iqr';
    throw new PyError('TypeError', `'${displayType(fn)}' object is not callable`, hint);
  }

  unary(op, v) {
    if (op === 'not') return !truthy(v);
    const p = pandasUnary(op, v);
    if (p !== undefined) return p;
    if (v instanceof NDArray && op === '-') return new NDArray(v.data.map((x) => -x), v.shape, v.dtype);
    if (v instanceof Num || typeof v === 'boolean') {
      const x = toNumber(v);
      const kind = v instanceof Num ? v.k : 'int';
      if (op === '-') return new Num(-x, kind === 'b_' ? 'i64' : kind);
      if (op === '+') return new Num(x, kind === 'b_' ? 'i64' : kind);
      if (op === '~') {
        if (typeof v === 'boolean' || kind === 'int' || kind === 'i64') return new Num(~x, kind === 'i64' ? 'i64' : 'int');
        if (kind === 'b_') return npBool(!x);
      }
    }
    throw new PyError('TypeError', `bad operand type for unary ${op}: '${typeName(v)}'`);
  }

  compare(op, a, b) {
    if (op === 'in' || op === 'not in') {
      let r;
      if (typeof b === 'string') r = b.includes(pyStr(a));
      else if (Array.isArray(b) || b instanceof Tuple) r = (Array.isArray(b) ? b : b.items).some((x) => repr(x) === repr(a));
      else if (b instanceof DataFrame) r = b.columns.includes(a);
      else if (b instanceof Series || b instanceof Index) r = (b instanceof Series ? b.index : b).has(a instanceof Num ? a.v : a);
      else if (b instanceof Dict) r = [...b.map.keys()].some((x) => repr(x) === repr(a));
      else throw new PyError('TypeError', `argument of type '${typeName(b)}' is not iterable`);
      return op === 'in' ? r : !r;
    }
    if (op === 'is' || op === 'is not') {
      const same = a === b || (a === null && b === null);
      return op === 'is' ? same : !same;
    }
    return this.binop(op, a, b);
  }

  binop(op, a, b, node) {
    const p = pandasBinop(op, a, b);
    if (p !== undefined) return p;
    if (a instanceof NDArray || b instanceof NDArray) return ndBinop(op, a, b);
    if (isNumberLike(a) && isNumberLike(b)) return numBinop(op, a, b);
    if (typeof a === 'string' && typeof b === 'string') {
      if (op === '+') return a + b;
      if (['==', '!=', '<', '>', '<=', '>='].includes(op)) return { '==': a === b, '!=': a !== b, '<': a < b, '>': a > b, '<=': a <= b, '>=': a >= b }[op];
    }
    if (op === '*' && typeof a === 'string' && b instanceof Num) return a.repeat(b.v);
    if (op === '+' && Array.isArray(a) && Array.isArray(b)) return [...a, ...b];
    if (op === '==' ) return repr(a) === repr(b);
    if (op === '!=') return repr(a) !== repr(b);
    let hint = '';
    if (a === null || b === null) hint = '계산에 None(아무 값도 없음)이 끼었습니다. inplace=True 를 쓴 명령은 결과를 돌려주지 않습니다.';
    else if (typeof a === 'string' || typeof b === 'string') hint = '글자와 수는 바로 계산할 수 없습니다. 따옴표를 잘못 붙이지 않았는지 확인하세요.';
    else if (a instanceof PyFunc || b instanceof PyFunc) hint = '명령어 뒤에 괄호 ( ) 를 빠뜨려서 계산할 수 없습니다. 예) penguins.body_mass_g.mean()';
    if (['<', '>', '<=', '>='].includes(op)) {
      throw new PyError('TypeError', `'${op}' not supported between instances of '${displayType(a)}' and '${displayType(b)}'`, hint);
    }
    throw new PyError('TypeError', `unsupported operand type(s) for ${op}: '${displayType(a)}' and '${displayType(b)}'`, hint);
  }
}

function rootName(n) {
  while (n.type === 'Attribute' || n.type === 'Subscript') n = n.obj;
  return n.type === 'Name' ? n.id : null;
}

function displayType(v) {
  if (v instanceof PyFunc) return v.kind === 'class' ? 'type' : v.self ? 'method' : 'builtin_function_or_method';
  if (v instanceof NDArray) return 'numpy.ndarray';
  if (v instanceof Figure) return 'Figure';
  return typeName(v);
}

// 수 두 개의 계산 — 결과가 int 인지 float 인지, numpy 수인지 파이썬 수인지까지 맞춘다
function numBinop(op, a, b) {
  const x = toNumber(a), y = toNumber(b);
  const ka = a instanceof Num ? a.k : 'bool', kb = b instanceof Num ? b.k : 'bool';
  const numpy = ['i64', 'f64', 'b_'].includes(ka) || ['i64', 'f64', 'b_'].includes(kb);
  const isFloat = ka === 'float' || ka === 'f64' || kb === 'float' || kb === 'f64';
  if (['<', '>', '<=', '>=', '==', '!='].includes(op)) {
    const r = { '<': x < y, '>': x > y, '<=': x <= y, '>=': x >= y, '==': x === y, '!=': x !== y }[op];
    return numpy ? npBool(r) : r;
  }
  if (op === '&' || op === '|' || op === '^') {
    if (isFloat) throw new PyError('TypeError', `unsupported operand type(s) for ${op}: '${typeName(a)}' and '${typeName(b)}'`,
      `조건을 ${op} 로 이을 때는 조건마다 괄호로 감싸야 합니다. 예) (s > upper) ${op} (s < lower)`);
    const r = op === '&' ? x & y : op === '|' ? x | y : x ^ y;
    if (typeof a === 'boolean' && typeof b === 'boolean') return Boolean(r);
    return new Num(r, numpy ? 'i64' : 'int');
  }
  if ((op === '/' || op === '//' || op === '%') && y === 0) {
    if (!numpy) throw new PyError('ZeroDivisionError', op === '/' ? 'division by zero' : 'integer division or modulo by zero', '0 으로 나눌 수 없습니다.');
  }
  let r;
  switch (op) {
    case '+': r = x + y; break;
    case '-': r = x - y; break;
    case '*': r = x * y; break;
    case '/': r = x / y; break;
    case '//': r = Math.floor(x / y); break;
    case '%': r = x - Math.floor(x / y) * y; break;
    case '**': r = x ** y; break;
    case '@': throw new PyError('TypeError', "unsupported operand type(s) for @");
  }
  const floatResult = isFloat || op === '/' || (op === '**' && y < 0);
  if (numpy) return new Num(r, floatResult ? 'f64' : 'i64');
  return new Num(r, floatResult ? 'float' : 'int');
}

function ndBinop(op, a, b) {
  const arr = a instanceof NDArray ? a : b;
  const get = (v, i) => (v instanceof NDArray ? (v.data.length === arr.data.length ? v.data[i] : v.data[i % v.data.length]) : toNumber(v));
  if (a instanceof NDArray && b instanceof NDArray && a.data.length !== b.data.length && b.data.length !== (arr.shape[1] ?? -1)) {
    throw new PyError('ValueError', `operands could not be broadcast together with shapes (${a.shape.join(',')},) (${b.shape.join(',')},)`);
  }
  const cmp = ['<', '>', '<=', '>=', '==', '!='].includes(op);
  const data = arr.data.map((_, i) => {
    const x = get(a, i), y = get(b, i);
    switch (op) {
      case '+': return x + y; case '-': return x - y; case '*': return x * y; case '/': return x / y;
      case '**': return x ** y; case '//': return Math.floor(x / y);
      case '<': return x < y; case '>': return x > y; case '<=': return x <= y; case '>=': return x >= y;
      case '==': return x === y; case '!=': return x !== y;
    }
    throw new NotSupported(`배열의 ${op} 계산`);
  });
  return new NDArray(data, arr.shape, cmp ? 'bool' : 'float64');
}

// f-문자열 서식 {값:.2f}
function formatSpec(v, spec) {
  if (!spec) return pyStr(v);
  const m = /^([<>^]?)(\d*)(?:\.(\d+))?([fd%]?)$/.exec(spec);
  if (!m) throw new NotSupported(`f-문자열 서식 :${spec}`);
  let s;
  if (m[4] === 'f' || (m[3] && !m[4])) s = fixed(toNumber(v), Number(m[3] ?? 6));
  else if (m[4] === '%') s = fixed(toNumber(v) * 100, Number(m[3] ?? 6)) + '%';
  else if (m[4] === 'd') s = String(toNumber(v));
  else s = pyStr(v);
  const w = Number(m[2] || 0);
  if (m[1] === '<') return s.padEnd(w);
  if (m[1] === '^') { const pad = Math.max(0, w - s.length); return ' '.repeat(Math.floor(pad / 2)) + s + ' '.repeat(Math.ceil(pad / 2)); }
  return typeof v === 'string' && !m[1] ? s.padEnd(w) : s.padStart(w);
}

const STRING_METHODS = {
  upper: (s) => s.toUpperCase(),
  lower: (s) => s.toLowerCase(),
  strip: (s) => s.trim(),
  replace: (s, a) => s.split(pyStr(a[0])).join(pyStr(a[1])),
  split: (s, a) => (a.length ? s.split(pyStr(a[0])) : s.trim().split(/\s+/)),
  startswith: (s, a) => s.startsWith(pyStr(a[0])),
  endswith: (s, a) => s.endsWith(pyStr(a[0])),
  format: (s, a) => { let i = 0; return s.replace(/\{\}/g, () => pyStr(a[i++])); },
};

// ── 파이썬 기본 함수 ──────────────────────────────────────
function fnb(name, body) { return new PyFunc(name, body, { kind: 'builtin' }); }

const TYPE_NAMES = {
  DataFrame: 'pandas.core.frame.DataFrame', Series: 'pandas.core.series.Series', Index: 'pandas.core.indexes.base.Index',
  RangeIndex: 'pandas.core.indexes.range.RangeIndex', ndarray: 'numpy.ndarray', Axes: 'matplotlib.axes._axes.Axes',
  Figure: 'matplotlib.figure.Figure',
};

const BUILTINS = {
  print: fnb('print', (args, kw, ctx) => {
    const sep = kw.has('sep') ? pyStr(kw.get('sep')) : ' ';
    const end = kw.has('end') ? pyStr(kw.get('end')) : '\n';
    ctx.print(args.map((a) => pyStr(a)).join(sep) + end);
    return null;
  }),
  len: fnb('len', (args) => {
    const v = args[0];
    if (args.length !== 1) throw new PyError('TypeError', `len() takes exactly one argument (${args.length} given)`);
    if (typeof v === 'string' || Array.isArray(v)) return pyInt(v.length);
    if (v instanceof Tuple) return pyInt(v.items.length);
    if (v instanceof Dict) return pyInt(v.map.size);
    if (v instanceof DataFrame) return pyInt(v.nrows);
    if (v instanceof Series || v instanceof Index) return pyInt(v.length);
    if (v instanceof NDArray) return pyInt(v.shape[0]);
    throw new PyError('TypeError', `object of type '${typeName(v)}' has no len()`);
  }),
  type: fnb('type', (args) => {
    const v = args[0];
    const tn = v?.pyType ? (TYPE_NAMES[v.pyType] ?? v.pyType) : typeName(v);
    return new PyFunc(tn, () => { throw new NotSupported('type(…)(…)'); }, { kind: 'class', owner: tn });
  }),
  round: fnb('round', (args, kw) => {
    const { number, ndigits } = parseArgs('round', args, kw, [['number', REQUIRED], ['ndigits', null]]);
    const x = toNumber(number);
    if (number instanceof Series || number instanceof DataFrame) return number.getattr('round').fn(ndigits ? [ndigits] : [], new Map());
    if (ndigits === null) return pyInt(roundHalfEven(x, 0));
    const r = roundHalfEven(x, toNumber(ndigits));
    return number instanceof Num && number.isNumpy ? f64(r) : number instanceof Num && number.isFloat ? pyFloatNum(r) : pyInt(r);
  }),
  int: fnb('int', (args) => {
    const v = args[0] ?? pyInt(0);
    if (typeof v === 'string') { if (!/^\s*[-+]?\d+\s*$/.test(v)) throw new PyError('ValueError', `invalid literal for int() with base 10: ${repr(v)}`); return pyInt(Number(v)); }
    return pyInt(Math.trunc(toNumber(v)));
  }),
  float: fnb('float', (args) => {
    const v = args[0] ?? pyInt(0);
    if (typeof v === 'string') { const x = Number(v); if (Number.isNaN(x) && v.trim().toLowerCase() !== 'nan') throw new PyError('ValueError', `could not convert string to float: ${repr(v)}`); return pyFloatNum(x); }
    return pyFloatNum(toNumber(v));
  }),
  str: fnb('str', (args) => (args.length ? pyStr(args[0]) : '')),
  bool: fnb('bool', (args) => (args.length ? truthy(args[0]) : false)),
  list: fnb('list', (args, kw, ctx) => (args.length ? ctx.kernel.iterate(args[0]).slice() : [])),
  tuple: fnb('tuple', (args, kw, ctx) => new Tuple(args.length ? ctx.kernel.iterate(args[0]).slice() : [])),
  abs: fnb('abs', (args) => { const v = args[0]; return new Num(Math.abs(toNumber(v)), v instanceof Num ? v.k : 'int'); }),
  sum: fnb('sum', (args, kw, ctx) => ctx.kernel.iterate(args[0]).reduce((acc, x) => numBinop('+', acc, x), pyInt(0))),
  min: fnb('min', (args, kw, ctx) => { const xs = args.length === 1 ? ctx.kernel.iterate(args[0]) : args; return xs.reduce((m, x) => (truthy(numBinop('<', x, m)) ? x : m)); }),
  max: fnb('max', (args, kw, ctx) => { const xs = args.length === 1 ? ctx.kernel.iterate(args[0]) : args; return xs.reduce((m, x) => (truthy(numBinop('>', x, m)) ? x : m)); }),
  sorted: fnb('sorted', (args, kw, ctx) => [...ctx.kernel.iterate(args[0])].sort((a, b) => (a instanceof Num ? a.v - b.v : pyStr(a) < pyStr(b) ? -1 : 1))),
  range: fnb('range', (args) => {
    const n = args.map((a) => toNumber(a));
    const [start, stop, step] = n.length === 1 ? [0, n[0], 1] : [n[0], n[1], n[2] ?? 1];
    const out = []; for (let i = start; step > 0 ? i < stop : i > stop; i += step) out.push(pyInt(i));
    return out;
  }),
  help: fnb('help', (args, kw, ctx) => { ctx.note('이 실습실에서는 help( ) 대신 오른쪽 위 [📖 명령어 사전] 을 보세요.'); return null; }),
  display: fnb('display', (args, kw, ctx) => { for (const a of args) ctx.kernel.ctx.print(repr(a) + '\n'); return null; }),
};

export { repr, pyStr, isMissing, pyFloat };
