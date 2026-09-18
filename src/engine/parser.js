// 파이썬 문장 읽기 — 글자를 낱말(토큰)로 자르고, 낱말을 나무(구문 트리)로 엮는다.
// 이 수업에 필요한 만큼만: 가져오기(import), 대입(=), 식(계산·함수 호출·대괄호·점).
// for·if·def 같은 블록 문장은 지원하지 않는다고 분명히 알려 준다.
import { PyError, NotSupported } from './pyvalues.js';

const KEYWORDS = new Set(['import', 'from', 'as', 'True', 'False', 'None', 'and', 'or', 'not', 'in', 'is',
  'for', 'while', 'if', 'elif', 'else', 'def', 'class', 'return', 'lambda', 'with', 'try', 'except',
  'finally', 'global', 'del', 'pass', 'break', 'continue', 'yield', 'raise', 'assert', 'async', 'await', 'nonlocal']);

const BLOCK_NAMES = {
  for: 'for 반복문', while: 'while 반복문', if: 'if 조건문', elif: 'elif', else: 'else', def: '함수 만들기(def)',
  class: '클래스 만들기(class)', with: 'with 문', try: 'try 문', except: 'except', finally: 'finally',
  lambda: 'lambda', return: 'return', yield: 'yield', global: 'global', nonlocal: 'nonlocal', raise: 'raise',
  assert: 'assert', async: 'async', await: 'await', break: 'break', continue: 'continue', del: 'del',
};

// 한글 자판에서 섞여 들어오기 쉬운 전각 기호 (빈칸·괄호·쉼표·따옴표)
const FULLWIDTH = /[　（），‘’“”]/;

const syntax = (msg, line, hint = '') => {
  const e = new PyError('SyntaxError', msg, hint);
  e.line = line;
  return e;
};

// ── 낱말 자르기 ─────────────────────────────────────────────
export function tokenize(src) {
  const toks = [];
  const text = src.replace(/\r\n?/g, '\n');
  let i = 0, line = 1;
  const stack = []; // 열린 괄호들
  let lineStart = true;
  const push = (t, v, extra = {}) => toks.push({ t, v, line, ...extra });

  while (i < text.length) {
    const ch = text[i];

    if (lineStart && stack.length === 0) {
      // 줄 맨 앞의 들여쓰기 — 블록이 없으니 들여쓰면 안 된다
      let j = i;
      while (text[j] === ' ' || text[j] === '\t') j++;
      const rest = text[j];
      if (j > i && rest !== undefined && rest !== '\n' && rest !== '#') throw syntaxIndent(line);
      i = j;
      lineStart = false;
      continue;
    }

    if (ch === '\n') {
      if (stack.length === 0) push('nl', '\n');
      line++; i++; lineStart = true;
      continue;
    }
    if (ch === ' ' || ch === '\t') { i++; continue; }
    if (ch === '#') { while (i < text.length && text[i] !== '\n') i++; continue; }
    if (ch === '\\' && text[i + 1] === '\n') { i += 2; line++; continue; }

    // 수
    if (/[0-9]/.test(ch) || (ch === '.' && /[0-9]/.test(text[i + 1] ?? ''))) {
      const m = /^(\d[\d_]*)?(\.\d*)?([eE][+-]?\d+)?/.exec(text.slice(i));
      const word = m[0];
      push('num', Number(word.replace(/_/g, '')), { isInt: !/[.eE]/.test(word) });
      i += word.length;
      if (/[A-Za-z_가-힣]/.test(text[i] ?? '')) throw syntax('invalid decimal literal', line, '숫자 바로 뒤에 글자를 붙일 수 없습니다.');
      continue;
    }

    // 글자(문자열) — 앞에 f·r 이 붙을 수 있다
    const pre = /^([rRfFbB]{0,2})(['"])/.exec(text.slice(i));
    if (pre) {
      const prefix = pre[1].toLowerCase();
      const q = pre[2];
      let j = i + pre[1].length;
      const triple = text.slice(j, j + 3) === q.repeat(3);
      const endQ = triple ? q.repeat(3) : q;
      j += endQ.length;
      let val = '';
      const startLine = line;
      while (true) {
        if (j >= text.length || (!triple && text[j] === '\n')) {
          throw syntax(`unterminated string literal (detected at line ${startLine})`, startLine,
            `따옴표 ${q} 로 연 글자를 ${q} 로 닫지 않았습니다.`);
        }
        if (text.startsWith(endQ, j)) { j += endQ.length; break; }
        const c = text[j];
        if (c === '\\' && !prefix.includes('r')) {
          const n = text[j + 1];
          const map = { n: '\n', t: '\t', '\\': '\\', "'": "'", '"': '"', '\n': '' };
          if (n in map) { val += map[n]; j += 2; continue; }
        }
        if (c === '\n') line++;
        val += c; j++;
      }
      push('str', val, { fstring: prefix.includes('f') });
      i = j;
      continue;
    }

    // 이름 (한글 변수명도 된다). 전각 기호가 붙어 있으면 거기서 자른다.
    const nm = /^[A-Za-z_À-￿][\wÀ-￿]*/u.exec(text.slice(i));
    if (nm && !FULLWIDTH.test(nm[0][0])) {
      const cut = nm[0].search(FULLWIDTH);
      const word = cut > 0 ? nm[0].slice(0, cut) : nm[0];
      push(KEYWORDS.has(word) ? 'kw' : 'name', word);
      i += word.length;
      continue;
    }

    // 기호
    const three = text.slice(i, i + 3);
    const two = text.slice(i, i + 2);
    if (['**=', '//=', '...'].includes(three)) { push('op', three); i += 3; continue; }
    if (['**', '//', '==', '!=', '>=', '<=', '+=', '-=', '*=', '/=', '%=', '->'].includes(two)) { push('op', two); i += 2; continue; }
    if ('()[]{},:.;=+-*/%<>|&~^@'.includes(ch)) {
      if ('([{'.includes(ch)) stack.push({ ch, line });
      if (')]}'.includes(ch)) {
        const open = stack.pop();
        const want = { ')': '(', ']': '[', '}': '{' }[ch];
        if (!open) throw syntax(`unmatched '${ch}'`, line, `여는 괄호 없이 닫는 괄호 ${ch} 가 있습니다.`);
        if (open.ch !== want) {
          throw syntax(`closing parenthesis '${ch}' does not match opening parenthesis '${open.ch}'`, line,
            `${open.ch} 로 연 괄호를 ${ch} 로 닫았습니다. 괄호 짝을 확인하세요.`);
        }
      }
      push('op', ch); i++;
      continue;
    }
    if (ch === '!') throw syntax('invalid syntax', line, '코랩의 ! 명령(예: !pip install)은 이 실습실에서 쓸 수 없고, 필요하지도 않습니다.');
    if (FULLWIDTH.test(ch)) {
      throw syntax(`invalid character '${ch}' (U+${ch.codePointAt(0).toString(16).toUpperCase().padStart(4, '0')})`, line,
        '한글 자판의 전각 문자(괄호·쉼표·따옴표·빈칸)가 섞였습니다. 영문 자판으로 바꿔 다시 입력하세요.');
    }
    throw syntax(`invalid character '${ch}'`, line);
  }
  if (stack.length) {
    const open = stack[stack.length - 1];
    throw syntax(`'${open.ch}' was never closed`, open.line, `${open.ch} 로 연 괄호를 닫지 않았습니다.`);
  }
  push('nl', '\n');
  push('eof', null);
  return toks;
}

function syntaxIndent(line) {
  const e = new PyError('IndentationError', 'unexpected indent', '줄 맨 앞에 빈칸이 들어갔습니다. 빈칸을 지우고 왼쪽 끝에 붙여 쓰세요.');
  e.line = line;
  return e;
}

// ── 나무 엮기 ───────────────────────────────────────────────
export function parse(src) {
  // for·if·def 같은 블록 문장은 들여쓰기 검사보다 먼저 "지원하지 않음"으로 알려 준다
  const srcLines = src.split(/\r?\n/);
  for (let i = 0; i < srcLines.length; i++) {
    const m = /^\s*(for|while|if|elif|else|def|class|with|try|except|finally)\b[^#]*:\s*(#.*)?$/.exec(srcLines[i]);
    if (m) { const e = new NotSupported(BLOCK_NAMES[m[1]]); e.line = i + 1; throw e; }
  }
  const toks = tokenize(src);
  let p = 0;
  const peek = (o = 0) => toks[p + o];
  const next = () => toks[p++];
  const isOp = (v, o = 0) => peek(o).t === 'op' && peek(o).v === v;
  const isKw = (v, o = 0) => peek(o).t === 'kw' && peek(o).v === v;
  const expectOp = (v) => {
    if (!isOp(v)) throw unexpected(peek(), v === ')' ? `'(' was never closed` : undefined);
    return next();
  };

  function unexpected(tok, msg) {
    if (tok.t === 'nl' || tok.t === 'eof') {
      return syntax(msg ?? 'invalid syntax', tok.line, '문장이 끝나지 않았습니다. 빠진 부분이 없는지 확인하세요.');
    }
    if (tok.t === 'kw' && BLOCK_NAMES[tok.v]) {
      const e = new NotSupported(BLOCK_NAMES[tok.v]); e.line = tok.line; return e;
    }
    return syntax(msg ?? 'invalid syntax', tok.line, hintFor(tok));
  }

  function hintFor(tok) {
    if (tok.t === 'op' && tok.v === '=') return '= 는 값을 넣을 때 씁니다. 같은지 비교하려면 == , 이름=값 은 괄호 안에서만 씁니다.';
    if (tok.t === 'op' && tok.v === '.') return '점(.) 앞뒤에 이름이 있어야 합니다. 예) penguins.head()';
    if (tok.t === 'op' && tok.v === '(') return '괄호 앞에 명령어 이름이 빠진 것 같습니다.';
    if (tok.t === 'name' || tok.t === 'num' || tok.t === 'str') return '낱말 사이에 점(.)·쉼표(,)·연산자가 빠졌을 수 있습니다.';
    return '';
  }

  const stmts = [];
  while (peek().t !== 'eof') {
    if (peek().t === 'nl') { next(); continue; }
    if (isOp(';')) { next(); continue; }
    stmts.push(statement());
    if (isOp(';')) { next(); continue; }
    if (peek().t !== 'nl' && peek().t !== 'eof') throw unexpected(peek());
  }
  return stmts;

  function statement() {
    const tok = peek();
    const line = tok.line;
    if (tok.t === 'kw') {
      if (tok.v === 'import') return importStmt(line);
      if (tok.v === 'from') return fromStmt(line);
      if (tok.v === 'pass') { next(); return { type: 'Pass', line }; }
      if (BLOCK_NAMES[tok.v]) { const e = new NotSupported(BLOCK_NAMES[tok.v]); e.line = line; throw e; }
    }
    const first = exprList();
    if (isOp('=')) {
      const targets = [first];
      while (isOp('=')) {
        next();
        targets.push(exprList());
      }
      const value = targets.pop();
      targets.forEach((t) => checkTarget(t, line));
      return { type: 'Assign', targets, value, line };
    }
    const aug = ['+=', '-=', '*=', '/=', '//=', '%=', '**='].find((o) => isOp(o));
    if (aug) {
      next();
      checkTarget(first, line);
      return { type: 'AugAssign', op: aug.slice(0, -1), target: first, value: exprList(), line };
    }
    return { type: 'Expr', expr: first, line };
  }

  function checkTarget(t, line) {
    if (t.type === 'Name' || t.type === 'Subscript' || t.type === 'Attribute') return;
    if (t.type === 'Tuple' || t.type === 'List') { t.items.forEach((x) => checkTarget(x, line)); return; }
    const what = t.type === 'Call' ? 'function call' : t.type === 'Const' ? 'literal' : 'expression';
    throw syntax(`cannot assign to ${what} here. Maybe you meant '==' instead of '='?`, line,
      '= 왼쪽에는 값을 담을 이름(변수)이 와야 합니다. 예) upper = q3 + 1.5 * iqr');
  }

  function dottedName() {
    const parts = [];
    if (peek().t !== 'name') throw unexpected(peek());
    parts.push(next().v);
    while (isOp('.')) { next(); if (peek().t !== 'name') throw unexpected(peek()); parts.push(next().v); }
    return parts.join('.');
  }

  function importStmt(line) {
    next();
    const names = [];
    do {
      if (names.length) next();
      const module = dottedName();
      let as = null;
      if (isKw('as')) { next(); if (peek().t !== 'name') throw unexpected(peek()); as = next().v; }
      names.push({ module, as });
    } while (isOp(','));
    return { type: 'Import', names, line };
  }

  function fromStmt(line) {
    next();
    const module = dottedName();
    if (!isKw('import')) throw unexpected(peek());
    next();
    const paren = isOp('(');
    if (paren) next();
    const names = [];
    do {
      if (names.length) next();
      if (paren && isOp(')')) break;
      if (isOp('*')) { next(); names.push({ name: '*', as: null }); continue; }
      if (peek().t !== 'name') throw unexpected(peek());
      const name = next().v;
      let as = null;
      if (isKw('as')) { next(); as = next().v; }
      names.push({ name, as });
    } while (isOp(','));
    if (paren) expectOp(')');
    return { type: 'ImportFrom', module, names, line };
  }

  // 쉼표로 이어진 식 → 튜플
  function exprList() {
    const line = peek().line;
    const first = test();
    if (!isOp(',')) return first;
    const items = [first];
    while (isOp(',')) {
      next();
      if (peek().t === 'nl' || peek().t === 'eof' || isOp('=') || isOp(')') || isOp(';')) break;
      items.push(test());
    }
    return { type: 'Tuple', items, line };
  }

  function test() {
    if (isKw('lambda')) { const e = new NotSupported('lambda'); e.line = peek().line; throw e; }
    const body = orTest();
    if (isKw('if')) { const e = new NotSupported('한 줄 조건식(값 if 조건 else 값)'); e.line = peek().line; throw e; }
    return body;
  }
  function orTest() {
    let left = andTest();
    while (isKw('or')) { const line = next().line; left = { type: 'BoolOp', op: 'or', left, right: andTest(), line }; }
    return left;
  }
  function andTest() {
    let left = notTest();
    while (isKw('and')) { const line = next().line; left = { type: 'BoolOp', op: 'and', left, right: notTest(), line }; }
    return left;
  }
  function notTest() {
    if (isKw('not')) { const line = next().line; return { type: 'Unary', op: 'not', operand: notTest(), line }; }
    return comparison();
  }
  function comparison() {
    const first = bor();
    const ops = [], rest = [];
    while (true) {
      const t = peek();
      if (t.t === 'op' && ['<', '>', '==', '>=', '<=', '!='].includes(t.v)) { next(); ops.push(t.v); }
      else if (isKw('in')) { next(); ops.push('in'); }
      else if (isKw('not') && isKw('in', 1)) { next(); next(); ops.push('not in'); }
      else if (isKw('is')) { next(); if (isKw('not')) { next(); ops.push('is not'); } else ops.push('is'); }
      else break;
      rest.push(bor());
    }
    if (!ops.length) return first;
    return { type: 'Compare', first, ops, rest, line: first.line };
  }
  // 파이썬의 우선순위: 비교 < | < ^ < & < + - < * / // % < 단항 < **
  // 그래서 s > upper | s < lower 는 s > (upper | s) < lower 로 읽힌다.
  function binLevel(sub, opsList) {
    let left = sub();
    while (peek().t === 'op' && opsList.includes(peek().v)) {
      const t = next();
      left = { type: 'BinOp', op: t.v, left, right: sub(), line: t.line };
    }
    return left;
  }
  function bor() { return binLevel(bxor, ['|']); }
  function bxor() { return binLevel(band, ['^']); }
  function band() { return binLevel(arith, ['&']); }
  function arith() { return binLevel(term, ['+', '-']); }
  function term() { return binLevel(factor, ['*', '/', '//', '%', '@']); }
  function factor() {
    if (peek().t === 'op' && ['-', '+', '~'].includes(peek().v)) {
      const t = next();
      return { type: 'Unary', op: t.v, operand: factor(), line: t.line };
    }
    return power();
  }
  function power() {
    const base = atomExpr();
    if (isOp('**')) { const t = next(); return { type: 'BinOp', op: '**', left: base, right: factor(), line: t.line }; }
    return base;
  }

  function atomExpr() {
    let node = atom();
    while (true) {
      if (isOp('(')) {
        const t = next();
        const { args, kwargs } = argList();
        expectOp(')');
        node = { type: 'Call', func: node, args, kwargs, line: t.line };
      } else if (isOp('[')) {
        const t = next();
        const index = subscriptList();
        expectOp(']');
        node = { type: 'Subscript', obj: node, index, line: t.line };
      } else if (isOp('.')) {
        const t = next();
        if (peek().t !== 'name' && peek().t !== 'kw') throw unexpected(peek());
        const name = next().v;
        node = { type: 'Attribute', obj: node, name, line: t.line };
      } else break;
    }
    return node;
  }

  function argList() {
    const args = [], kwargs = [];
    while (!isOp(')')) {
      if (isOp('*') || isOp('**')) { const e = new NotSupported('*인자 풀기'); e.line = peek().line; throw e; }
      if (peek().t === 'name' && isOp('=', 1)) {
        const name = next().v; next();
        if (isOp(',') || isOp(')')) throw syntax('expected argument value expression', peek().line, `${name}= 뒤에 값을 넣어야 합니다.`);
        kwargs.push({ name, value: test() });
      } else {
        if (kwargs.length) throw syntax('positional argument follows keyword argument', peek().line, '이름=값 으로 넣은 인자 뒤에는 이름 없는 인자를 둘 수 없습니다.');
        args.push(test());
      }
      if (!isOp(',')) break;
      next();
    }
    return { args, kwargs };
  }

  function subscriptList() {
    const line = peek().line;
    const items = [subscript()];
    while (isOp(',')) { next(); if (isOp(']')) break; items.push(subscript()); }
    return items.length === 1 ? items[0] : { type: 'Tuple', items, line };
  }
  function subscript() {
    const line = peek().line;
    let start = null;
    if (!isOp(':')) start = test();
    if (!isOp(':')) return start;
    next();
    let stop = null, step = null;
    if (!isOp(']') && !isOp(',') && !isOp(':')) stop = test();
    if (isOp(':')) { next(); if (!isOp(']') && !isOp(',')) step = test(); }
    return { type: 'Slice', start, stop, step, line };
  }

  function atom() {
    const t = peek();
    if (t.t === 'op' && t.v === '(') {
      next();
      if (isOp(')')) { next(); return { type: 'Tuple', items: [], line: t.line }; }
      const e = exprList();
      expectOp(')');
      if (e.type === 'Tuple') { e.paren = true; return e; }
      return { ...e, paren: true };
    }
    if (t.t === 'op' && t.v === '[') {
      next();
      const items = [];
      while (!isOp(']')) { items.push(test()); if (!isOp(',')) break; next(); }
      if (isKw('for')) { const e = new NotSupported('리스트 컴프리헨션'); e.line = t.line; throw e; }
      expectOp(']');
      return { type: 'List', items, line: t.line };
    }
    if (t.t === 'op' && t.v === '{') {
      next();
      const keys = [], values = [];
      while (!isOp('}')) {
        keys.push(test()); expectOp(':'); values.push(test());
        if (!isOp(',')) break; next();
      }
      expectOp('}');
      return { type: 'Dict', keys, values, line: t.line };
    }
    if (t.t === 'num') { next(); return { type: 'Num', value: t.v, isInt: t.isInt, line: t.line }; }
    if (t.t === 'str') {
      next();
      const parts = [t];
      while (peek().t === 'str') parts.push(next());
      if (parts.some((x) => x.fstring)) return { type: 'FString', parts: parts.map((x) => ({ text: x.v, f: x.fstring })), line: t.line };
      return { type: 'Str', value: parts.map((x) => x.v).join(''), line: t.line };
    }
    if (t.t === 'name') { next(); return { type: 'Name', id: t.v, line: t.line }; }
    if (t.t === 'kw') {
      if (t.v === 'True') { next(); return { type: 'Const', value: true, line: t.line }; }
      if (t.v === 'False') { next(); return { type: 'Const', value: false, line: t.line }; }
      if (t.v === 'None') { next(); return { type: 'Const', value: null, line: t.line }; }
    }
    if (t.t === 'op' && t.v === '...') { next(); return { type: 'Const', value: null, line: t.line }; }
    throw unexpected(t);
  }
}

// f'…{식}…' 안의 식 조각을 나눈다
export function splitFString(text) {
  const out = [];
  let i = 0, buf = '';
  while (i < text.length) {
    const c = text[i];
    if (c === '{' && text[i + 1] === '{') { buf += '{'; i += 2; continue; }
    if (c === '}' && text[i + 1] === '}') { buf += '}'; i += 2; continue; }
    if (c === '{') {
      if (buf) out.push({ lit: buf });
      buf = '';
      let depth = 1, j = i + 1;
      while (j < text.length && depth) { if (text[j] === '{') depth++; if (text[j] === '}') depth--; j++; }
      const inner = text.slice(i + 1, j - 1);
      const colon = inner.search(/:(?![^\[]*\])/);
      out.push({ expr: colon >= 0 ? inner.slice(0, colon) : inner, spec: colon >= 0 ? inner.slice(colon + 1) : '' });
      i = j;
      continue;
    }
    buf += c; i++;
  }
  if (buf) out.push({ lit: buf });
  return out;
}
