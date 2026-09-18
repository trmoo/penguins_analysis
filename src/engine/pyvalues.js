// 파이썬 값의 모양 — 정수·실수·튜플·딕셔너리·함수, 그리고 오류.
//
// 파이썬에는 같은 3 이라도 int 3, float 3.0, numpy 의 np.int64(3)·np.float64(3.0) 이 있고
// 화면에 찍히는 모양이 모두 다르다(코랩에서 q1 을 치면 np.float64(3600.0) 이 나온다).
// 그래서 수 하나에도 "무슨 종류인지(k)"를 함께 들고 다닌다.
//   k = 'int' | 'float' | 'i64' | 'f64' | 'b_'(numpy 참거짓)
// 파이썬의 True/False 는 자바스크립트 true/false, None 은 null, 리스트는 배열, 문자열은 문자열.
import { pyFloat } from './numfmt.js';

export class Num {
  constructor(v, k) { this.v = v; this.k = k; }
  get isNumpy() { return this.k === 'i64' || this.k === 'f64' || this.k === 'b_'; }
  get isFloat() { return this.k === 'float' || this.k === 'f64'; }
}
export const pyInt = (v) => new Num(v, 'int');
export const pyFloatNum = (v) => new Num(v, 'float');
export const f64 = (v) => new Num(v, 'f64');
export const i64 = (v) => new Num(v, 'i64');
export const npBool = (v) => new Num(v ? 1 : 0, 'b_');

export class Tuple {
  constructor(items) { this.items = items; }
}

export class Dict {
  constructor(entries = []) { this.map = new Map(entries); }
}

// 파이썬에서 부를 수 있는 것(함수·메소드·클래스).
// fn(args, kwargs) 를 부르고, owner 는 오류 문구·repr 에 쓴다.
export class PyFunc {
  constructor(name, fn, { owner = null, self = null, kind = 'method' } = {}) {
    this.name = name; this.fn = fn; this.owner = owner; this.self = self; this.kind = kind;
  }
}

// 모듈 (import pandas as pd 의 pd)
export class Module {
  constructor(name, attrs, { callable = false } = {}) {
    this.name = name; this.attrs = attrs; this.callable = callable;
  }
}

// 파이썬 오류. type 은 'NameError' 같은 이름, hint 는 학생에게 보여 줄 우리말 도움말.
export class PyError extends Error {
  constructor(type, message, hint = '') {
    super(message);
    this.type = type; this.pyMessage = message; this.hint = hint;
  }
}

// 파이썬에는 있지만 이 실습실이 아직 흉내 내지 못하는 명령 — 오류와 구분해서 알려 준다.
export class NotSupported extends Error {
  constructor(what) { super(what); this.what = what; }
}

// ── 이름 붙이기 ──────────────────────────────────────────
export function typeName(v) {
  if (v === null || v === undefined) return 'NoneType';
  if (typeof v === 'boolean') return 'bool';
  if (typeof v === 'string') return 'str';
  if (Array.isArray(v)) return 'list';
  if (v instanceof Num) {
    return { int: 'int', float: 'float', i64: 'numpy.int64', f64: 'numpy.float64', b_: 'numpy.bool' }[v.k];
  }
  if (v instanceof Tuple) return 'tuple';
  if (v instanceof Dict) return 'dict';
  if (v instanceof PyFunc) return v.kind === 'class' ? 'type' : 'method';
  if (v instanceof Module) return 'module';
  return v?.pyType ?? 'object';
}

// 파이썬 문자열 repr — 작은따옴표로 감싸되, 안에 작은따옴표만 있으면 큰따옴표로.
export function strRepr(s) {
  const q = s.includes("'") && !s.includes('"') ? '"' : "'";
  let body = s.replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/\t/g, '\\t');
  if (q === "'") body = body.replace(/'/g, "\\'");
  return q + body + q;
}

// repr() — 셀 마지막 줄의 값이 화면에 찍히는 모양
export function repr(v) {
  if (v === null || v === undefined) return 'None';
  if (v === true) return 'True';
  if (v === false) return 'False';
  if (typeof v === 'string') return strRepr(v);
  if (v instanceof Num) {
    switch (v.k) {
      case 'int': return String(v.v);
      case 'float': return pyFloat(v.v);
      case 'i64': return `np.int64(${v.v})`;
      case 'f64': return `np.float64(${pyFloat(v.v)})`;
      case 'b_': return v.v ? 'np.True_' : 'np.False_';
    }
  }
  if (Array.isArray(v)) return '[' + v.map(repr).join(', ') + ']';
  if (v instanceof Tuple) {
    if (v.items.length === 1) return '(' + repr(v.items[0]) + ',)';
    return '(' + v.items.map(repr).join(', ') + ')';
  }
  if (v instanceof Dict) {
    return '{' + [...v.map.entries()].map(([k, x]) => repr(k) + ': ' + repr(x)).join(', ') + '}';
  }
  if (v instanceof Module) return `<module '${v.name}'>`;
  if (v instanceof PyFunc) {
    if (v.kind === 'class') return `<class '${v.owner}'>`;
    if (v.kind === 'function') return `<function ${v.name}>`;
    if (v.self) return `<bound method ${v.owner}.${v.name} of ${repr(v.self)}>`;
    return `<built-in function ${v.name}>`;
  }
  if (typeof v.repr === 'function') return v.repr();
  return '<object>';
}

// str() — print() 가 찍는 모양. 문자열은 따옴표 없이, numpy 수는 np.float64(...) 없이.
export function str(v) {
  if (typeof v === 'string') return v;
  if (v instanceof Num) {
    if (v.k === 'f64' || v.k === 'float') return pyFloat(v.v);
    if (v.k === 'b_') return v.v ? 'True' : 'False';
    return String(v.v);
  }
  if (v && typeof v.str === 'function') return v.str();
  return repr(v);
}

// 수로 꺼내기 (계산할 때). 참거짓도 파이썬처럼 1·0 으로 셈한다.
export function toNumber(v, what = '값') {
  if (v instanceof Num) return v.v;
  if (typeof v === 'boolean') return v ? 1 : 0;
  throw new PyError('TypeError', `${what}에는 수가 와야 합니다 (받은 것: '${typeName(v)}')`);
}

export function isNumberLike(v) {
  return v instanceof Num || typeof v === 'boolean';
}

// 파이썬의 참·거짓 판정 (if, and, or, not)
export function truthy(v) {
  if (v === null || v === undefined || v === false) return false;
  if (v === true) return true;
  if (v instanceof Num) return v.v !== 0; // 파이썬에서 nan 은 참이다
  if (typeof v === 'string') return v.length > 0;
  if (Array.isArray(v)) return v.length > 0;
  if (v instanceof Tuple) return v.items.length > 0;
  if (v instanceof Dict) return v.map.size > 0;
  if (v?.pyType === 'Series' || v?.pyType === 'DataFrame') {
    throw new PyError('ValueError',
      `The truth value of a ${v.pyType} is ambiguous. Use a.empty, a.bool(), a.item(), a.any() or a.all().`,
      '시리즈 여러 개의 참·거짓을 이을 때는 and·or 가 아니라 & (그리고) · | (또는) 를 쓰고, 조건마다 괄호로 감싸야 합니다.\n예) (df["a"] > 1) | (df["a"] < 0)');
  }
  return true;
}

// 함수에 들어온 인자를 이름표대로 나눈다.
//   spec = [['n', 5], ['inplace', false], ['value', REQUIRED]]
// 파이썬처럼 자리로도, 이름=값 으로도 받을 수 있다.
export const REQUIRED = Symbol('required');
export function parseArgs(fname, args, kw, spec) {
  const out = {};
  if (args.length > spec.length) {
    throw new PyError('TypeError', `${fname}() takes ${spec.length} positional arguments but ${args.length} were given`);
  }
  spec.forEach(([name, def], i) => {
    if (i < args.length) {
      if (kw.has(name)) throw new PyError('TypeError', `${fname}() got multiple values for argument '${name}'`);
      out[name] = args[i];
    } else if (kw.has(name)) {
      out[name] = kw.get(name);
    } else if (def === REQUIRED) {
      throw new PyError('TypeError', `${fname}() missing 1 required positional argument: '${name}'`,
        `${fname}( ) 의 괄호 안에 ${name} 값을 넣어야 합니다.`);
    } else {
      out[name] = def;
    }
  });
  for (const k of kw.keys()) {
    if (!spec.some(([n]) => n === k)) {
      throw new PyError('TypeError', `${fname}() got an unexpected keyword argument '${k}'`,
        `${fname}( ) 에는 ${k}= 라는 이름의 값을 넣을 수 없습니다.`);
    }
  }
  return out;
}

// 두 값이 같은가 (채점용 — 결과를 기준 답과 견줄 때)
export function deepEqual(a, b) {
  if (a === b) return true;
  if (a instanceof Num && b instanceof Num) {
    return a.k === b.k && (a.v === b.v || (Number.isNaN(a.v) && Number.isNaN(b.v)));
  }
  if (typeof a === 'number' && typeof b === 'number') return a === b || (Number.isNaN(a) && Number.isNaN(b));
  if (Array.isArray(a) && Array.isArray(b)) return a.length === b.length && a.every((x, i) => deepEqual(x, b[i]));
  if (a instanceof Tuple && b instanceof Tuple) return deepEqual(a.items, b.items);
  if (a instanceof Dict && b instanceof Dict) {
    return a.map.size === b.map.size && [...a.map].every(([k, v], i) => { const [k2, v2] = [...b.map][i]; return deepEqual(k, k2) && deepEqual(v, v2); });
  }
  if (a instanceof Module && b instanceof Module) return a.name === b.name;
  if (a instanceof PyFunc && b instanceof PyFunc) return a.name === b.name && a.owner === b.owner;
  if (a && b && typeof a.equals === 'function' && a.constructor === b.constructor) return a.equals(b);
  return false;
}
