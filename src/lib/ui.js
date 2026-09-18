// 화면을 만드는 잔손 — 요소 만들기, 알림창, 저장소.

// 요소 하나 만들기.
// ⚠ 자식 자리에 넣는 문자열은 글자 그대로 들어간다. 태그를 쓰려면 { html: '...' } 속성.
export function h(tag, attrs = {}, ...children) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v == null || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k === 'html') el.innerHTML = v;
    else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
    else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2).toLowerCase(), v);
    else if (v === true) el.setAttribute(k, '');
    else el.setAttribute(k, v);
  }
  for (const c of children.flat(9)) {
    if (c == null || c === false || c === '') continue;
    el.appendChild(c?.nodeType ? c : document.createTextNode(String(c)));
  }
  return el;
}

// 요소의 자식을 통째로 바꾸기. replaceChildren 은 null 을 글자 "null" 로 넣어 버리므로 걸러 낸다.
export function fill(el, ...children) {
  el.replaceChildren(...children.flat(9).filter((c) => c != null && c !== false && c !== ''));
  return el;
}

export function svg(tag, attrs = {}, ...children) {
  const el = document.createElementNS('http://www.w3.org/2000/svg', tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v == null || v === false) continue;
    if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2).toLowerCase(), v);
    else el.setAttribute(k, v);
  }
  for (const c of children.flat(9)) {
    if (c == null || c === false) continue;
    el.appendChild(c?.nodeType ? c : document.createTextNode(String(c)));
  }
  return el;
}

// 글자 안의 `코드` 를 <code> 로 — 설명 문장에 명령어가 섞여 있을 때
export function rich(text) {
  const frag = document.createDocumentFragment();
  String(text).split(/(`[^`]+`)/).forEach((part) => {
    if (part.startsWith('`') && part.endsWith('`')) frag.appendChild(h('code', {}, part.slice(1, -1)));
    else if (part) frag.appendChild(document.createTextNode(part));
  });
  return frag;
}

// 알림창 — 브라우저 기본 alert·confirm 은 주소를 함께 보여 주어 교실 화면에 어울리지 않는다.
export function modal(title, body, { ok = '확인', cancel = null } = {}) {
  return new Promise((resolve) => {
    const close = (v) => { overlay.remove(); document.removeEventListener('keydown', onKey); resolve(v); };
    const onKey = (e) => { if (e.key === 'Escape') close(false); };
    const box = h('div', { class: 'modal', role: 'dialog', 'aria-modal': 'true' },
      h('h3', {}, title),
      typeof body === 'string' ? h('p', {}, body) : body,
      h('div', { class: 'modal-btns' },
        cancel && h('button', { class: 'btn', onClick: () => close(false) }, cancel),
        h('button', { class: 'btn primary', onClick: () => close(true) }, ok)));
    const overlay = h('div', { class: 'overlay', onClick: (e) => { if (e.target === overlay) close(false); } }, box);
    document.body.appendChild(overlay);
    document.addEventListener('keydown', onKey);
    box.querySelector('.primary').focus();
  });
}

// 잠깐 떴다 사라지는 알림
export function toast(text) {
  const t = h('div', { class: 'toast', role: 'status' }, text);
  document.body.appendChild(t);
  setTimeout(() => t.classList.add('show'), 10);
  setTimeout(() => { t.classList.remove('show'); setTimeout(() => t.remove(), 300); }, 2600);
}

// ── 저장소 ──
// 학생 이름·학번은 받지 않는다. 채운 빈칸·통과 여부·문제 답만 이 브라우저에 남긴다.
const KEY = 'penguins-lab:v1';
let cache = null;
export function loadStore() {
  if (cache) return cache;
  try { cache = JSON.parse(localStorage.getItem(KEY)) ?? {}; } catch { cache = {}; }
  cache.answers ??= {}; cache.passed ??= {}; cache.quiz ??= {}; cache.free ??= {};
  return cache;
}
let timer = null;
export function saveStore() {
  clearTimeout(timer);
  timer = setTimeout(() => { try { localStorage.setItem(KEY, JSON.stringify(cache)); } catch { /* 저장 못 해도 실습은 된다 */ } }, 200);
}
export function clearStore() {
  cache = { answers: {}, passed: {}, quiz: {}, free: {} };
  try { localStorage.removeItem(KEY); } catch { /* 무시 */ }
}

export const CIRCLED = ['①', '②', '③', '④', '⑤', '⑥', '⑦', '⑧', '⑨', '⑩'];
