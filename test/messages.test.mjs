// 학생이 흔히 내는 실수에 알맞은 오류와 도움말이 나오는가
import { readFileSync } from 'node:fs';
import { Kernel } from '../src/engine/interp.js';

export function run(t) {
  const csv = readFileSync(new URL('../src/data/penguins.csv', import.meta.url), 'utf8');
  const k = new Kernel({ files: { 'penguins.csv': csv } });
  k.run("import pandas as pd\nimport numpy as np\nfrom sklearn.preprocessing import MinMaxScaler\npenguins = pd.read_csv('penguins.csv')\npenguins_outliers = penguins.drop(index=[33, 104])\nupper = 6990.625\nlower = 1565.625");
  const err = (code) => k.run(code).error;
  const has = (code, type, hintPart) => {
    const e = err(code);
    t.eq(e?.type, type, `${code.split('\n').pop()} → ${type}`);
    t.ok(e && e.hint.includes(hintPart), `${code.split('\n').pop()} → 도움말에 "${hintPart}"`);
  };
  has("penguins['body_mass_g'][penguins['body_mass_g'] > upper | penguins['body_mass_g'] < lower]", 'TypeError', '괄호로 감싸야');
  has("s = penguins['body_mass_g']\ns[(s > upper) or (s < lower)]", 'ValueError', '| (또는)');
  has('penguins.shape()', 'TypeError', '괄호 없이');
  has('import matplotlib.pyplot as plt\nplt.subplot(1, 2)', 'TypeError', 'plt.subplot(1, 2, 1)');
  has('MinMaxScaler.fit_transform(penguins)', 'TypeError', 'MinMaxScaler()');
  has('MinMaxScaler().fit_transform(penguins_outliers)', 'ValueError', '숫자 열만');
  has("MinMaxScaler().fit_transform(penguins['body_mass_g'])", 'ValueError', '두 겹');
  has('import matplotlib as plt\nplt.figure(figsize=(12, 6))', 'TypeError', 'matplotlib.pyplot');
  has('import matplotlib as plt\nplt.subplot(1, 2, 1)', 'AttributeError', 'matplotlib.pyplot');
  has('penguins.fillna(penguins.mean())', 'TypeError', 'numeric_only=True');
  has('penguins_outliers.loc[33]', 'KeyError', '.iloc');
  has('for c in penguins.columns:\n    print(c)', 'NotSupported', 'for');
  has('penguins.groupby("species").mean()', 'NotSupported', 'groupby');
  has('Penguins.head()', 'NameError', 'penguins');
  has('penguins.head(3', 'SyntaxError', '닫지 않았');
  has('penguins.isnull.sum()', 'AttributeError', 'isnull().sum');
  has("pd.read_cvs('penguins.csv')", 'AttributeError', 'pd.read_csv');
  has("pd.read_csv('penguin.csv')", 'FileNotFoundError', 'penguins.csv');
  has("pd.read_csv(penguins.csv)", 'AttributeError', '따옴표');
  has("pd.read_csv(pengu.csv)", 'NameError', '따옴표');
  has('  penguins.head()', 'IndentationError', '빈칸');
  has("penguins['body_mass_g'].boxplot()", 'AttributeError', '두 겹');
  has("penguins['body_mass']", 'KeyError', 'body_mass_g');
  has('print(mean1)', 'NameError', '평균을 구하는 셀');
  has('penguins.hed(3)', 'AttributeError', 'head');
  has('penguins.head（3）', 'SyntaxError', '전각');

  const r = k.run("np.percentile(penguins['body_mass_g'], [25, 75])");
  t.eq(r.items.find((x) => x.kind === 'display')?.text, 'array([nan, nan])', '빈칸이 있으면 nan (코랩과 같은 모양)');
  t.ok(r.items.some((x) => x.kind === 'note' && x.text.includes('결측치를 먼저')), 'nan 이 나온 까닭을 알려 줌');
  const h = k.run('penguins.head');
  t.ok(h.items.some((x) => x.kind === 'note' && x.text.includes('괄호')), '괄호 없이 명령만 치면 안내');
  t.eq(k.run("print(f'{upper:.2f}')").items[0].text, '6990.62\n', 'f-문자열 서식 (반올림은 파이썬처럼)');
}
