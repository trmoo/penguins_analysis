// 단계 끝의 확인 문제 — 고르면 바로 맞았는지와 해설을 보여 준다.
import { h, loadStore, saveStore } from '../lib/ui.js';

export function buildQuiz(lesson) {
  const store = loadStore();
  store.quiz[lesson.id] ??= {};
  const answers = store.quiz[lesson.id];
  const score = h('div', { class: 'quiz-score' });
  const list = h('ol', { class: 'quiz-list' });

  const updateScore = () => {
    const done = lesson.quiz.filter((_, i) => answers[i] !== undefined).length;
    const right = lesson.quiz.filter((q, i) => answers[i] === q.answer).length;
    score.textContent = done ? `${lesson.quiz.length}문제 중 ${done}문제 풂 · 맞힌 문제 ${right}개` : `${lesson.quiz.length}문제`;
  };

  lesson.quiz.forEach((q, qi) => {
    const why = h('div', { class: 'quiz-why' });
    const btns = q.choices.map((c, ci) => h('button', { class: 'choice', onClick: () => pick(ci) }, `${'ㄱㄴㄷㄹㅁ'[ci]}. ${c}`));
    function pick(ci) {
      answers[qi] = ci; saveStore();
      paint();
      updateScore();
    }
    function paint() {
      const ci = answers[qi];
      btns.forEach((b, i) => {
        b.classList.remove('right', 'wrong', 'dim');
        if (ci === undefined) return;
        if (i === q.answer && ci === q.answer) b.classList.add('right');
        else if (i === ci) b.classList.add('wrong');
        else b.classList.add('dim');
      });
      if (ci === undefined) { why.replaceChildren(); return; }
      why.replaceChildren(ci === q.answer
        ? h('div', { class: 'fb pass' }, '⭕ 맞았어요! ', h('span', { class: 'sub' }, q.why))
        : h('div', { class: 'fb mismatch' }, '❌ 다시 생각해 보세요. ', h('button', { class: 'btn ghost small', onClick: (e) => { e.currentTarget.remove(); why.firstChild.appendChild(h('div', { class: 'sub' }, `정답: ${'ㄱㄴㄷㄹㅁ'[q.answer]}. ${q.why}`)); } }, '정답과 해설 보기')));
    }
    list.appendChild(h('li', { class: 'quiz-item' }, h('p', { class: 'quiz-q' }, q.q), h('div', { class: 'choices' }, btns), why));
    paint();
  });
  updateScore();

  return h('section', { class: 'quiz' },
    h('div', { class: 'row-between' }, h('h3', {}, '📝 확인 문제'), score),
    list);
}
