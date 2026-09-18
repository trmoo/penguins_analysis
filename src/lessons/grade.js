// 채점 — 학생이 실행한 셀의 결과를 "정답 코드로 처음부터 실행한 결과"와 견준다.
// ⚠ 화면(DOM)을 쓰지 말 것. node 시험에서 그대로 부른다.
//
// 통과 조건 (셋 다)
//  ① 오류 없이 실행됨
//  ② 화면 출력(print·셀 결과·그림)이 기준과 같음 — 경고(FutureWarning)와 안내 문구는 빼고 견준다
//  ③ 변수의 값이 기준과 같음 (예: fillna 에 mean2 를 잘못 넣으면 출력은 같아도 표가 다르다)
//  ④ strict 로 표시한 빈칸은 글자도 정답 목록과 같음
// 빈칸의 글자가 정답 목록에 없어도 ①②③ 을 만족하면 정답이다(다른 방법으로 맞게 쓴 것).
import { Kernel } from '../engine/interp.js';
import { Module, Dict, PyFunc, deepEqual } from '../engine/pyvalues.js';
import { fillAnswers, runnable } from './data.js';

export function normalize(s) {
  return String(s ?? '').replace(/\s+/g, '').replace(/"/g, "'");
}

// 빈칸마다 정답 목록에 있는가
export function blankMatches(cell, values) {
  return cell.blanks.map((b, i) => b.answers.some((a) => normalize(a) === normalize(values[i])));
}

export function cellCode(cell, values) {
  if (!cell.blanks?.length) return cell.code;
  return fillAnswers(cell, (_, i) => values[i] ?? '');
}

// 출력 요약 — 견줄 때 쓰는 모양
export function outputSignature(result) {
  return result.items
    .filter((x) => x.kind === 'stdout' || x.kind === 'display' || x.kind === 'figure')
    .map((x) => (x.kind === 'figure' ? 'FIG:' + JSON.stringify(x.fig.axes.map((a) => [a.nrows, a.ncols, a.index, a.boxes.map((b) => [b.label, b.values.length, b.stats?.q1, b.stats?.q3, b.stats?.med])])) : x.kind + ':' + x.text))
    .join('\n');
}

// 정답 코드로 lesson 의 처음부터 cell 까지 실행한 기준 결과
export function referenceFor(lesson, cellId, files) {
  const k = new Kernel({ files });
  let result = null;
  for (const c of lesson.cells) {
    if (!runnable(c)) continue;
    result = k.run(c.blanks?.length ? fillAnswers(c) : c.code);
    if (c.id === cellId) return { kernel: k, result };
  }
  throw new Error('셀을 찾을 수 없음: ' + cellId);
}

export function grade(lesson, cell, values, studentResult, studentKernel, files) {
  const empties = (cell.blanks ?? []).map((_, i) => !normalize(values[i]));
  const matches = cell.blanks?.length ? blankMatches(cell, values) : [];
  if (empties.some(Boolean)) return { status: 'empty', empties, matches };
  if (studentResult.error) return { status: 'error', matches };

  const ref = referenceFor(lesson, cell.id, files);
  const sameOutput = outputSignature(studentResult) === outputSignature(ref.result);
  // 이 셀에서 만든 이름만이 아니라 기준 커널의 모든 변수를 견준다.
  // (fillna(inplace=True) 는 대입 없이 표를 바꾸므로, 대입한 이름만 보면 mean1·mean2 를 바꿔 넣어도 통과해 버린다)
  const badVars = [];
  for (const name of ref.kernel.env.keys()) {
    const want = ref.kernel.env.get(name);
    // 모듈(import matplotlib as plt 처럼 달리 가져와도 이 셀에선 괜찮다)·함수·코랩 업로드 결과는 견주지 않는다
    if (want instanceof Module || want instanceof PyFunc || want instanceof Dict) continue;
    if (!deepEqual(studentKernel.env.get(name), want)) badVars.push(name);
  }
  // strict 빈칸 — 결과만으로는 틀렸는지 알 수 없는 자리(예: plt.show 는 빠져도 그림이 나온다)는 글자까지 맞아야 한다
  const strictMiss = (cell.blanks ?? []).map((b, i) => b.strict && !matches[i]);
  if (sameOutput && badVars.length === 0 && !strictMiss.some(Boolean)) return { status: 'pass', matches, ref: ref.result };
  return { status: 'mismatch', matches, sameOutput, badVars, strictMiss, ref: ref.result };
}
