// 펭귄 데이터 전처리 실습실 — 시작점
// 탭 4개(단계) + 안내. 주소 끝의 #l1 ~ #l4, #guide 로 바로 갈 수 있다.
// 단계마다 노트북(과 그 커널)을 한 번만 만들어 두고, 탭을 옮겨도 실행 상태가 유지되게 한다.
import './style.css';
import csvText from './data/penguins.csv?raw';
import { h, loadStore } from './lib/ui.js';
import { LESSONS } from './lessons/data.js';
import { Notebook } from './ui/notebook.js';
import { buildGuide } from './ui/guide.js';

const files = { 'penguins.csv': csvText };
let notebooks = new Map();
let guide = null;

const top = document.getElementById('top');
const tabs = document.getElementById('tabs');
const main = document.getElementById('main');

top.append(
  h('div', { class: 'brand' },
    h('span', { class: 'logo', 'aria-hidden': 'true' }, '🐧'),
    h('div', {}, h('h1', {}, '펭귄 데이터 전처리 실습실'), h('p', {}, '데이터 수집 → 결측치 → 이상치 → 정규화, 명령어를 직접 실행해 보기'))),
  h('a', { class: 'btn ghost light', href: '#guide' }, '📖 명령어 사전'));

function currentId() {
  const id = location.hash.slice(1);
  return id === 'guide' || LESSONS.some((l) => l.id === id) ? id : 'l1';
}

function drawTabs() {
  const store = loadStore();
  const id = currentId();
  tabs.replaceChildren(...LESSONS.map((l) => {
    const main = l.cells.filter((c) => c.kind === 'code');
    const done = main.filter((c) => store.passed[c.id]).length;
    const complete = done === main.length;
    return h('a', { class: `tab ${id === l.id ? 'on' : ''}`, href: `#${l.id}`, 'aria-current': id === l.id ? 'page' : null },
      h('span', { class: 'tab-num' }, `${l.num}단계`),
      h('span', { class: 'tab-title' }, `${l.icon} ${l.short}`),
      h('span', { class: `tab-prog ${complete ? 'done' : ''}` }, complete ? '✅' : `${done}/${main.length}`));
  }), h('a', { class: `tab guide ${id === 'guide' ? 'on' : ''}`, href: '#guide' }, h('span', { class: 'tab-title' }, '📖 안내')));
}

function show() {
  const id = currentId();
  drawTabs();
  let view;
  if (id === 'guide') {
    guide ??= buildGuide(() => { notebooks = new Map(); guide = null; location.hash = '#l1'; show(); });
    view = guide;
  } else {
    if (!notebooks.has(id)) notebooks.set(id, new Notebook(LESSONS.find((l) => l.id === id), files, drawTabs));
    view = notebooks.get(id).el;
  }
  main.replaceChildren(view);
  window.scrollTo(0, 0);
}

// 실행 도구 막대가 탭 막대 바로 아래에 붙도록 탭 막대의 높이를 알려 준다
const syncTabsHeight = () => document.documentElement.style.setProperty('--tabs-h', `${tabs.offsetHeight}px`);
new ResizeObserver(syncTabsHeight).observe(tabs);

window.addEventListener('hashchange', show);
show();
