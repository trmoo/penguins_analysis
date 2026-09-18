// 차시 내용 시험 — 정답대로 풀면 모든 셀이 통과하는가, 틀리게 풀면 통과하지 않는가,
// 화면에 적어 둔 숫자가 실제 실행 결과와 맞는가.
import { readFileSync } from 'node:fs';
import { Kernel } from '../src/engine/interp.js';
import { LESSONS, fillAnswers, splitTemplate, runnable, graded } from '../src/lessons/data.js';
import { grade, cellCode, blankMatches } from '../src/lessons/grade.js';

export function run(t) {
  const csv = readFileSync(new URL('../src/data/penguins.csv', import.meta.url), 'utf8');
  const files = { 'penguins.csv': csv };

  t.eq(LESSONS.map((l) => l.id), ['l1', 'l2', 'l3', 'l4'], '차시 4개');

  for (const lesson of LESSONS) {
    const ids = new Set();
    // ── 자료 모양 ──
    for (const c of lesson.cells) {
      if (!runnable(c)) continue;
      t.ok(c.id && !ids.has(c.id), `${lesson.id} 셀 id 가 있고 겹치지 않음: ${c.id}`);
      ids.add(c.id);
      const nums = splitTemplate(c.code).filter((p) => p.blank !== undefined).map((p) => p.blank);
      t.eq([...new Set(nums)].sort((a, b) => a - b), (c.blanks ?? []).map((_, i) => i), `${c.id} 빈칸 번호가 0부터 빠짐없이`);
      for (const [i, b] of (c.blanks ?? []).entries()) {
        t.ok(b.answers.length > 0 && b.hint, `${c.id} 빈칸 ${i} 에 정답과 힌트가 있음`);
      }
      if (graded(c)) t.ok(c.what && c.read, `${c.id} 설명과 결과 읽는 법이 있음`);
    }
    for (const [i, q] of lesson.quiz.entries()) {
      t.ok(q.answer >= 0 && q.answer < q.choices.length && q.why, `${lesson.id} 문제 ${i + 1} 정답 번호·해설`);
    }

    // ── 정답대로 풀면 전부 통과 ──
    const k = new Kernel({ files });
    for (const c of lesson.cells) {
      if (!runnable(c)) continue;
      const values = (c.blanks ?? []).map((b) => b.answers[0]);
      const r = k.run(cellCode(c, values));
      t.eq(r.error, null, `${c.id} 정답 코드가 오류 없이 실행`);
      if (graded(c)) t.eq(grade(lesson, c, values, r, k, files).status, 'pass', `${c.id} 정답이면 통과`);
    }

    // ── 다른 정답 표기도 통과, 틀린 답은 불통과 ──
    for (const c of lesson.cells) {
      if (!graded(c) || !c.blanks.length) continue;
      c.blanks.forEach((b, bi) => {
        const runUpTo = (values) => {
          const kk = new Kernel({ files });
          for (const cc of lesson.cells) {
            if (!runnable(cc)) continue;
            if (cc.id === c.id) return { r: kk.run(cellCode(cc, values)), kk };
            kk.run(cc.blanks?.length ? fillAnswers(cc) : cc.code);
          }
        };
        const base = c.blanks.map((x) => x.answers[0]);
        for (const alt of b.answers.slice(1)) {
          const values = [...base]; values[bi] = alt;
          const { r, kk } = runUpTo(values);
          t.eq(grade(lesson, c, values, r, kk, files).status, 'pass', `${c.id} 빈칸 ${bi} 다른 정답 "${alt}" 도 통과`);
        }
        const wrong = [...base]; wrong[bi] = WRONG[b.answers[0]] ?? 'zzz';
        const { r, kk } = runUpTo(wrong);
        const g = grade(lesson, c, wrong, r, kk, files);
        t.ok(g.status !== 'pass', `${c.id} 빈칸 ${bi} 에 틀린 답 "${wrong[bi]}" 이면 불통과 (${g.status})`);
        const empty = [...base]; empty[bi] = '  ';
        t.eq(grade(lesson, c, empty, r, kk, files).status, 'empty', `${c.id} 빈칸 ${bi} 이 비면 "빈칸" 상태`);
      });
    }
  }

  // ── 화면에 적은 숫자가 실제 결과와 맞는가 ──
  const k = new Kernel({ files });
  const out = (code) => { const r = k.run(code); if (r.error) throw new Error(code + ' → ' + r.error.message); return r.items.map((x) => x.text ?? '').join(''); };
  out("import pandas as pd\nimport numpy as np\npenguins = pd.read_csv('penguins.csv')");
  t.eq(out('penguins.isnull().sum().sum()'), 'np.int64(9)', '빈칸은 모두 9칸');
  t.eq(out("penguins.body_mass_g.median()"), 'np.float64(3975.0)', '몸무게 중앙값 3975 (채우기 전)');
  t.eq(out("penguins[penguins.body_mass_g.isnull()].index.tolist()"), '[19, 52, 117]', '몸무게가 빈 펭귄 19·52·117');
  const k2 = new Kernel({ files });
  const run2 = (code) => { const r = k2.run(code); if (r.error) throw new Error(code + ' → ' + r.error.message); return r; };
  const l4 = LESSONS[3];
  for (const c of l4.cells) if (runnable(c)) run2(c.blanks?.length ? fillAnswers(c) : c.code);
  const q = (code) => run2(code).items.map((x) => x.text ?? '').join('');
  t.eq(q('print(q1, q3, iqr, upper, lower)'), '3600.0 4956.25 1356.25 6990.625 1565.625\n', '울타리 수치');
  t.eq(q('outliers.index'), 'Index([33, 104], dtype=\'int64\')', '이상치 줄 번호 33·104');
  t.eq(q("penguins.loc[19, 'body_mass_g']"), 'np.float64(4272.448979591837)', '19번 몸무게는 평균으로 채워짐');
  t.eq(q("round(float((5425 - 2725) / (6775 - 2725)), 4)"), '0.6667', '문제: 5425g 의 정규화 값');
  t.eq(q("round(float(normal.loc[0, 'body_mass_g']), 4)"), '0.6667', '0번 펭귄 몸무게 정규화 값 0.6667');
  t.eq(q("penguins_new.min().tolist()"), '[2.5, 12.5, 175.0, 2725.0]', '정규화 전 최솟값');
  t.eq(q("penguins_new.max().tolist()"), '[115.4, 42.9, 421.0, 6775.0]', '정규화 전 최댓값 — 부리·날개 이상치가 남음');
  t.eq(q("round(float(normal.bill_length_mm.mean()), 2)"), '0.38', '정규화한 부리 길이 평균 0.38');
  t.eq(q("penguins.loc[[7, 129], 'bill_length_mm'].tolist()"), '[115.4, 2.5]', '부리 길이 이상치 7·129번');
  t.eq(q("penguins.loc[33, 'species'] + ' ' + penguins.loc[104, 'species']"), "'Gentoo Adelie'", '몸무게 이상치 펭귄의 종');
  t.eq(q("penguins.loc[33, 'flipper_length_mm']"), 'np.float64(218.0)', '12500g 펭귄의 날개 218mm');
  t.eq(q("penguins_new.index[-2:].tolist()"), '[148, 149]', 'penguins_new 의 줄 번호는 149 로 끝남');
  t.eq(q("normal.index[-1:].tolist()"), '[147]', 'normal 의 줄 번호는 147 로 끝남');
  t.eq(q("penguins['species'].value_counts().tolist()"), '[55, 50, 45]', '종별 마리 수');
}

// 틀린 답 예시 — 문법은 맞지만 결과가 달라야 하는 답
const WRONG = {
  'pd.read_csv': 'pd.DataFrame', head: 'tail', info: 'describe', describe: 'info', isnull: 'notnull',
  fillna: 'dropna', mean1: 'mean2', mean2: 'mean1', mean3: 'mean4', mean4: 'mean3', 'matplotlib.pyplot': 'numpy',
  boxplot: 'describe', numpy: 'pandas', 25: '20', 75: '80', 'q3 + 1.5 * iqr': 'q3 + 3 * iqr', 'q1 - 1.5 * iqr': 'q1 - 3 * iqr',
  '> upper': '> lower', '< lower': '< upper', drop: 'copy', shape: 'size', fit_transform: 'fit', DataFrame: 'Series',
  figure: 'subplot', subplot: 'figure', '1, 2, 2': '1, 2, 1', show: 'title', shape_: '', value_counts: 'unique', tail: 'head',
  19: '20', loc: 'head', 'a3 + 1.5 * b': 'a3 + 3 * b', 'a1 - 1.5 * b': 'a1 - 3 * b', min: 'max', max: 'min',
};
