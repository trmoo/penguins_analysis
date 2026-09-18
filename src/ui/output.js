// 실행 결과 그리기 — print 글자, 셀 결과, 경고, 그림, 오류
import { h } from '../lib/ui.js';
import { renderFigure } from './figure.js';

// 코드 색칠 — 주석·글자·수·예약어·함수 이름
const KW = /\b(import|from|as|True|False|None|and|or|not|in|is)\b/;
export function highlight(text) {
  const frag = document.createDocumentFragment();
  const re = /(#[^\n]*)|('(?:[^'\\\n]|\\.)*'|"(?:[^"\\\n]|\\.)*")|(\b\d+(?:\.\d+)?\b)|(\b(?:import|from|as|True|False|None|and|or|not|in|is)\b)|([A-Za-z_]\w*)(?=\()/g;
  let last = 0, m;
  while ((m = re.exec(text))) {
    if (m.index > last) frag.appendChild(document.createTextNode(text.slice(last, m.index)));
    const cls = m[1] ? 'c-com' : m[2] ? 'c-str' : m[3] ? 'c-num' : m[4] ? 'c-kw' : 'c-fn';
    frag.appendChild(h('span', { class: cls }, m[0]));
    last = m.index + m[0].length;
  }
  if (last < text.length) frag.appendChild(document.createTextNode(text.slice(last)));
  return frag;
}
export { KW };

const ERROR_KO = {
  SyntaxError: '문법 오류 — 파이썬이 문장을 읽지 못했습니다',
  IndentationError: '들여쓰기 오류',
  NameError: '이름 오류 — 아직 없는 이름을 썼습니다',
  AttributeError: '속성 오류 — 그런 명령어(속성)가 없습니다',
  KeyError: '열쇠 오류 — 그런 열(또는 줄)이 없습니다',
  TypeError: '자료형 오류 — 값의 종류가 맞지 않습니다',
  ValueError: '값 오류 — 값이 알맞지 않습니다',
  IndexError: '위치 오류 — 범위를 벗어났습니다',
  FileNotFoundError: '파일 오류 — 그런 파일이 없습니다',
  ModuleNotFoundError: '모듈 오류 — 그런 라이브러리가 없습니다',
  ImportError: '가져오기 오류',
  ZeroDivisionError: '0 으로 나누었습니다',
  NotFittedError: '학습 전 오류 — fit 을 먼저 해야 합니다',
};

export function renderError(err) {
  if (err.type === 'NotSupported') {
    return h('div', { class: 'out-error unsupported' },
      h('div', { class: 'err-title' }, '🚧 이 실습실에서는 아직 실행할 수 없는 명령'),
      h('pre', { class: 'err-src' }, `----> ${err.line} ${err.source}`),
      h('div', { class: 'hint' }, '💡 ', err.hint));
  }
  if (err.type === 'InternalError') {
    return h('div', { class: 'out-error unsupported' },
      h('div', { class: 'err-title' }, '⚙️ 실습실 엔진이 이 코드를 처리하지 못했습니다'),
      h('pre', {}, err.message),
      h('div', { class: 'hint' }, '💡 ', err.hint));
  }
  return h('div', { class: 'out-error' },
    h('pre', { class: 'err-head' }, `${err.type.padEnd(42)}Traceback (most recent call last)`),
    h('pre', { class: 'err-src' }, `----> ${err.line} ${err.source}`),
    h('pre', { class: 'err-msg' }, `${err.type}: ${err.message}`),
    ERROR_KO[err.type] && h('div', { class: 'err-ko' }, '🔎 ', ERROR_KO[err.type]),
    err.hint && h('div', { class: 'hint' }, '💡 ', err.hint));
}

export function renderResult(result) {
  const box = h('div', { class: 'outputs' });
  for (const it of result.items) {
    if (it.kind === 'stdout') box.appendChild(h('pre', { class: 'out' }, it.text));
    else if (it.kind === 'display') box.appendChild(h('pre', { class: 'out result' }, it.text));
    // 경고(stderr, 예: fillna(inplace=True) 의 FutureWarning)는 화면에 보여 주지 않는다 (사용자 지시 2026-09-18).
    // 엔진은 코랩과 똑같이 경고를 만들어 두고(대조 시험이 확인), 여기서만 걸러 낸다.
    else if (it.kind === 'stderr') continue;
    else if (it.kind === 'figure') box.appendChild(renderFigure(it.fig));
    else if (it.kind === 'note') box.appendChild(h('div', { class: 'note' }, 'ℹ️ ', it.text));
  }
  if (result.error) box.appendChild(renderError(result.error));
  return box;
}
