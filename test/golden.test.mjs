// 자체 엔진 ↔ 진짜 pandas 2.2 대조 시험
// test/scenarios.json 의 코드를 엔진으로 실행해 test/golden.json(진짜 파이썬 결과)과 글자 단위로 견준다.
import { readFileSync } from 'node:fs';
import { Kernel } from '../src/engine/interp.js';
import { boxStats } from '../src/engine/plotting.js';

export function run(t) {
  const root = new URL('..', import.meta.url);
  const csv = readFileSync(new URL('src/data/penguins.csv', root), 'utf8');
  const scen = JSON.parse(readFileSync(new URL('test/scenarios.json', root), 'utf8'));
  const gold = JSON.parse(readFileSync(new URL('test/golden.json', root), 'utf8'));

  for (const s of scen) {
    const k = new Kernel({ files: { 'penguins.csv': csv } });
    s.cells.forEach((code, i) => {
      const g = gold[s.id][i];
      const r = k.run(code);
      const label = `[${s.id} #${i}] ${code.split('\n').pop().slice(0, 60)}`;
      const stdout = r.items.filter((x) => x.kind === 'stdout').map((x) => x.text).join('');
      const display = r.items.find((x) => x.kind === 'display')?.text ?? null;
      const warnings = r.items.filter((x) => x.kind === 'stderr').length;
      if (g.error) {
        t.eq(r.error && [r.error.type, r.error.message], g.error, label + ' (오류)');
      } else {
        t.eq(r.error, null, label + ' (오류가 없어야 함)');
        t.eq(stdout, g.stdout, label + ' (print 출력)');
        t.eq(display, g.display, label + ' (셀 결과)');
        t.eq(warnings > 0, g.warnings.length > 0, label + ' (경고 여부)');
      }
    });
  }

  // 상자그림 수치 — matplotlib 과 같은가
  const k = new Kernel({ files: { 'penguins.csv': csv } });
  k.run(`import pandas as pd
penguins = pd.read_csv('penguins.csv')
for_fill = 0`);
  for (const [col, g] of Object.entries(gold.boxstats)) {
    k.run(`penguins['${col}'] = penguins['${col}'].fillna(penguins['${col}'].mean())`);
    const vals = k.env.get('penguins').data[col];
    const st = boxStats(vals);
    for (const key of ['whislo', 'q1', 'med', 'q3', 'whishi']) t.eq(st[key], g[key], `상자그림 ${col} ${key}`);
    t.eq([...st.fliers].sort((a, b) => a - b), [...g.fliers].sort((a, b) => a - b), `상자그림 ${col} 바깥 점`);
  }
}
