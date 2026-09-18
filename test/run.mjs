// 시험 모음 실행기 — node test/run.mjs
// test/*.test.mjs 파일마다 run(t) 를 불러 결과를 모은다.
import { readdirSync } from 'node:fs';

const files = readdirSync(new URL('.', import.meta.url)).filter((f) => f.endsWith('.test.mjs')).sort();
let pass = 0, fail = 0;
const failures = [];

const show = (v) => (typeof v === 'string' ? JSON.stringify(v) : JSON.stringify(v));

for (const f of files) {
  const t = {
    eq(actual, expected, name) {
      const ok = JSON.stringify(actual) === JSON.stringify(expected);
      if (ok) pass++; else { fail++; failures.push({ f, name, actual, expected }); }
    },
    ok(cond, name) { if (cond) pass++; else { fail++; failures.push({ f, name, actual: cond, expected: true }); } },
  };
  const mod = await import(new URL(f, import.meta.url));
  try {
    await mod.run(t);
  } catch (e) {
    fail++; failures.push({ f, name: '시험 파일이 도중에 멈춤', actual: String(e.stack), expected: '' });
  }
}

for (const x of failures.slice(0, 40)) {
  console.log(`✗ ${x.f} — ${x.name}`);
  if (typeof x.actual === 'string' && typeof x.expected === 'string' && (x.actual.includes('\n') || x.expected.includes('\n'))) {
    console.log('  --- 엔진 ---\n' + x.actual + '\n  --- 기준 ---\n' + x.expected);
  } else {
    console.log('  엔진:', show(x.actual), '\n  기준:', show(x.expected));
  }
}
if (failures.length > 40) console.log(`… 그 밖에 ${failures.length - 40}개`);
console.log(`\n통과 ${pass} · 실패 ${fail}`);
process.exit(fail ? 1 : 0);
