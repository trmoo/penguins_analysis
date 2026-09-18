// 단계별 실습 내용 — 셀·빈칸·힌트·결과 읽는 법·확인 문제
// ⚠ 여기서 화면 요소(DOM)를 만들지 말 것. node 로 불러다 시험한다(test/lessons.test.mjs).
//
// 코드 속 【0】【1】… 자리가 빈칸이다. blanks[n].answers 의 어느 것과 같아도 정답이고,
// 글자가 달라도 실행 결과가 기준과 같으면 정답으로 인정한다(src/lessons/grade.js).
//
// 셀 종류
//   code   : 빈칸을 채워 실행하는 셀 (채점함)
//   review : 앞 단계에서 완성한 코드 — 채울 것 없이 실행만 (채점 안 함, 진행에 필요)
//   extra  : 노트북 밖의 "더 해 보기" (채점함, 진행률에는 따로 셈)
//   free   : 마음대로 쳐 보는 실험 셀
//   section: 소제목과 설명

const COLS4 = "['bill_length_mm', 'bill_depth_mm', 'flipper_length_mm', 'body_mass_g']";

const LOAD = "import pandas as pd\npenguins = pd.read_csv('penguins.csv')";
const FILL = [
  'mean1 = penguins.bill_length_mm.mean()',
  'mean2 = penguins.bill_depth_mm.mean()',
  'mean3 = penguins.flipper_length_mm.mean()',
  'mean4 = penguins.body_mass_g.mean()',
  'penguins.bill_length_mm.fillna(mean1, inplace=True)',
  'penguins.bill_depth_mm.fillna(mean2, inplace=True)',
  'penguins.flipper_length_mm.fillna(mean3, inplace=True)',
  'penguins.body_mass_g.fillna(mean4, inplace=True)',
].join('\n');
const OUTLIER = [
  'import matplotlib.pyplot as plt',
  'import numpy as np',
  "q1, q3 = np.percentile(penguins['body_mass_g'],[25, 75])",
  'iqr = q3 - q1',
  'upper = q3 + 1.5 * iqr',
  'lower = q1 - 1.5 * iqr',
  "outliers = penguins['body_mass_g'][(penguins['body_mass_g'] > upper)|(penguins['body_mass_g'] < lower)]",
  'penguins_outliers = penguins.drop(index = outliers.index)',
].join('\n');

export const COLUMNS = [
  { name: 'bill_length_mm', ko: '부리 길이', unit: 'mm', desc: '부리 끝에서 머리까지 부리의 길이' },
  { name: 'bill_depth_mm', ko: '부리 두께', unit: 'mm', desc: '부리를 옆에서 봤을 때 위아래 두께' },
  { name: 'flipper_length_mm', ko: '날개 길이', unit: 'mm', desc: '헤엄칠 때 쓰는 지느러미 모양 날개의 길이' },
  { name: 'body_mass_g', ko: '몸무게', unit: 'g', desc: '몸 전체의 무게' },
  { name: 'species', ko: '종', unit: '', desc: 'Adelie(아델리) · Chinstrap(턱끈) · Gentoo(젠투) 세 종류' },
];

export const LESSONS = [
  // ───────────────────────────────────────────────────────────
  {
    id: 'l1', num: 1, icon: '📥', title: '데이터 수집과 특성 분석', short: '수집·특성',
    goal: ['CSV 파일을 불러와 표(데이터프레임)로 만든다', '앞부분을 눈으로 확인한다', '열마다 자료형과 빈칸 수, 기술 통계를 읽는다'],
    panel: 'table', panelAfter: 'l1-describe',
    cells: [
      { kind: 'section', title: '① 데이터 불러오기', text: '펭귄 150마리를 잰 기록이 penguins.csv 파일에 있습니다. 파이썬으로 표를 다룰 때는 pandas 라이브러리를 씁니다.' },
      {
        id: 'l1-load', kind: 'code', title: 'CSV 파일을 표로 불러오고 앞의 3줄 보기',
        what: 'pandas 를 pd 라는 짧은 이름으로 가져온 뒤, CSV 파일을 읽어 penguins 라는 표에 담습니다. 그리고 표의 맨 앞 3줄만 꺼내 봅니다.',
        code: "import pandas as pd\npenguins = 【0】('penguins.csv')\npenguins.【1】(3)",
        blanks: [
          { answers: ['pd.read_csv'], hint: 'CSV 파일을 "읽는(read)" pandas 명령입니다. pd. 로 시작합니다.' },
          { answers: ['head'], hint: '표의 "머리(앞부분)"를 보여 주는 명령입니다.' },
        ],
        read: '줄마다 왼쪽의 0, 1, 2 는 줄 번호(인덱스)입니다. 열은 5개 — 부리 길이·부리 두께·날개 길이·몸무게·종입니다. 괄호 안의 3 을 바꾸면 보이는 줄 수가 바뀝니다. 아무것도 안 넣으면 5줄이 나옵니다.',
      },
      { kind: 'section', title: '② 데이터의 특성 살펴보기', text: '표를 불러왔으면 "어떤 열이 있고, 무슨 자료이고, 빈칸은 없는지"부터 확인합니다.' },
      {
        id: 'l1-info', kind: 'code', title: '표의 설명서 보기',
        what: '표 전체의 요약 정보(줄 수, 열 이름, 빈칸이 아닌 값의 수, 자료형)를 한 번에 보여 주는 명령입니다.',
        code: 'penguins.【0】()',
        blanks: [{ answers: ['info'], hint: '"정보(information)"의 앞 네 글자입니다.' }],
        read: 'RangeIndex: 150 entries → 펭귄이 150마리입니다. Non-Null Count 는 비어 있지 않은 칸의 수라서, 150 에서 빼면 빈칸 수가 나옵니다. bill_length_mm 은 148 → 빈칸 2개, body_mass_g 은 147 → 빈칸 3개. Dtype 의 float64 는 소수(숫자), object 는 글자입니다.',
      },
      {
        id: 'l1-describe', kind: 'code', title: '기술 통계 보기',
        what: '숫자 열마다 개수·평균·표준편차·최솟값·사분위수·최댓값을 한꺼번에 계산해 줍니다.',
        code: 'penguins.【0】()',
        blanks: [{ answers: ['describe'], hint: '"묘사하다, 설명하다"라는 뜻의 영어 낱말입니다. d 로 시작합니다.' }],
        read: 'species 는 글자 열이라 빠졌습니다. count 가 150 이 아닌 것은 빈칸 때문입니다. 그리고 min·max 를 잘 보세요. 부리 길이가 2.5mm 인 펭귄, 115.4mm 인 펭귄, 날개가 421mm, 몸무게가 12500g 인 펭귄… 정말 있을까요? 다음 단계들에서 이 값들을 처리합니다.',
      },
      { kind: 'section', title: '더 해 보기', text: '노트북에는 없지만 표를 살펴볼 때 자주 쓰는 명령어입니다.' },
      {
        id: 'l1-shape', kind: 'extra', title: '몇 행 몇 열인가',
        what: '표의 크기를 (행 수, 열 수) 로 알려 줍니다. 명령이 아니라 값이라서 괄호를 붙이지 않습니다.',
        code: 'penguins.【0】',
        blanks: [{ answers: ['shape'], hint: '"모양"이라는 뜻의 영어 낱말입니다. 괄호 없이 씁니다.' }],
        read: '(150, 5) — 150행 5열입니다. 이 값은 이상치를 지운 뒤 줄이 몇 개 남았는지 확인할 때 다시 씁니다.',
      },
      {
        id: 'l1-counts', kind: 'extra', title: '종마다 몇 마리인가',
        what: '글자 열에서 값마다 몇 번 나오는지 세어 많은 순서로 보여 줍니다.',
        code: "penguins['species'].【0】()",
        blanks: [{ answers: ['value_counts'], hint: '"값(value)"을 "세다(count)" — 두 낱말을 밑줄로 잇습니다.' }],
        read: 'Adelie 55, Gentoo 50, Chinstrap 45 마리입니다. 글자 열의 특성은 describe() 대신 이렇게 봅니다.',
      },
      {
        id: 'l1-tail', kind: 'extra', title: '맨 뒤 3줄 보기',
        what: 'head 의 반대입니다. 표의 꼬리(뒷부분)를 보여 줍니다.',
        code: 'penguins.【0】(3)',
        blanks: [{ answers: ['tail'], hint: '"꼬리"라는 뜻의 영어 낱말입니다.' }],
        read: '줄 번호가 147, 148, 149 로 끝납니다. 0 부터 세므로 150번째 펭귄의 번호는 149 입니다.',
      },
      { kind: 'free', title: '🧪 자유 실험', text: '배운 명령어를 마음대로 바꿔 쳐 보세요. 예) penguins.head(10) · penguins.info() · penguins.describe()' },
    ],
    quiz: [
      { q: 'penguins 표는 몇 행 몇 열인가요?', choices: ['5행 150열', '150행 5열', '148행 5열', '150행 4열'], answer: 1, why: 'info() 의 150 entries, total 5 columns 또는 shape 의 (150, 5) 로 알 수 있습니다.' },
      { q: 'info() 결과로 볼 때 빈칸(결측치)이 가장 많은 열은?', choices: ['bill_length_mm', 'flipper_length_mm', 'body_mass_g', 'species'], answer: 2, why: 'body_mass_g 의 Non-Null Count 가 147 이라서 150 − 147 = 3개가 비어 있습니다.' },
      { q: 'describe() 결과에서 "측정·입력 실수"일 가능성이 가장 큰 값은?', choices: ['몸무게 평균 4272g', '부리 두께 25% 값 15.9mm', '날개 길이 최댓값 421mm', '부리 길이 50% 값 45.85mm'], answer: 2, why: '날개 길이의 75% 값이 214mm 인데 최댓값만 421mm 로 두 배 가까이 튑니다. 부리 길이 2.5mm·115.4mm, 몸무게 12500g 도 같은 종류의 의심스러운 값입니다.' },
    ],
  },

  // ───────────────────────────────────────────────────────────
  {
    id: 'l2', num: 2, icon: '🩹', title: '결측치 처리', short: '결측치',
    goal: ['열마다 빈칸(결측치)이 몇 개인지 센다', '열의 평균을 구한다', '빈칸을 평균으로 채우고, 다 채워졌는지 확인한다'],
    panel: 'missing', panelAfter: 'l2-mean4',
    cells: [
      { kind: 'section', title: '앞 단계 코드', text: '앞 단계에서 완성한 코드입니다. 채울 것은 없고, 차례대로 실행만 하면 됩니다.' },
      { id: 'l2-r0', kind: 'review', title: '불러오기', code: LOAD + '\npenguins.head(3)' },
      { id: 'l2-r1', kind: 'review', title: '설명서', code: 'penguins.info()' },
      { id: 'l2-r2', kind: 'review', title: '기술 통계', code: 'penguins.describe()' },
      { kind: 'section', title: '① 결측치 세기', text: '결측치(缺測値)는 "재지 못해 비어 있는 값"입니다. 파이썬에서는 NaN(Not a Number) 으로 보입니다.' },
      {
        id: 'l2-isnull', kind: 'code', title: '열마다 빈칸 수 세기',
        what: 'isnull() 은 칸마다 "비었으면 True, 아니면 False" 인 표를 만듭니다. 여기에 sum() 을 붙이면 True 를 1 로 세어 열마다 더해 줍니다.',
        code: 'penguins.【0】().sum()',
        blanks: [{ answers: ['isnull', 'isna'], hint: '"비어 있나(is null)?"를 묻는 명령입니다. 두 낱말을 붙여 씁니다.' }],
        read: 'bill_length_mm 2개, bill_depth_mm 2개, flipper_length_mm 2개, body_mass_g 3개, species 0개 — 모두 9칸이 비어 있습니다. 앞 단계 info() 의 Non-Null Count 와 맞는지 견주어 보세요.',
      },
      { kind: 'section', title: '② 채울 값 구하기', text: '빈칸을 채우는 방법은 여러 가지입니다(줄 지우기, 0 넣기, 평균·중앙값 넣기 …). 여기서는 그 열의 평균으로 채웁니다.' },
      {
        id: 'l2-mean1', kind: 'code', title: '부리 길이의 평균',
        what: '표.열이름.mean() 은 그 열의 평균입니다. 빈칸은 빼고 계산합니다. 결과를 mean1 이라는 이름에 담아 둡니다.',
        code: 'mean1 = penguins.bill_length_mm.mean()\nprint(mean1)',
        blanks: [],
        read: '44.96621621621622 — 빈칸 2개를 뺀 148마리의 평균입니다.',
      },
      { id: 'l2-mean2', kind: 'code', title: '부리 두께의 평균', what: '같은 방법으로 부리 두께의 평균을 mean2 에 담습니다.', code: 'mean2 = penguins.bill_depth_mm.mean()\nprint(mean2)', blanks: [], read: '17.402702702702705' },
      { id: 'l2-mean3', kind: 'code', title: '날개 길이의 평균', what: '날개 길이의 평균을 mean3 에 담습니다.', code: 'mean3 = penguins.flipper_length_mm.mean()\nprint(mean3)', blanks: [], read: '202.34459459459458' },
      { id: 'l2-mean4', kind: 'code', title: '몸무게의 평균', what: '몸무게의 평균을 mean4 에 담습니다.', code: 'mean4 = penguins.body_mass_g.mean()\nprint(mean4)', blanks: [], read: '4272.448979591837 — 그런데 몸무게 중앙값은 3975 입니다. 평균이 왜 더 클까요? 아래 [눈으로 보기] 에서 확인해 보세요.' },
      { kind: 'section', title: '③ 빈칸 채우기', text: '' },
      {
        id: 'l2-fill', kind: 'code', title: '빈칸을 평균으로 채우고 확인하기',
        what: 'fillna(값) 은 빈칸(na)을 값으로 채웁니다(fill). inplace=True 를 붙이면 새 표를 만들지 않고 원래 표를 바로 고칩니다. 마지막 줄에서 빈칸을 다시 세어 0 이 되었는지 확인합니다.',
        code: 'penguins.bill_length_mm.【0】(【1】, inplace=True)\npenguins.bill_depth_mm.【2】(【3】, inplace=True)\npenguins.flipper_length_mm.【4】(【5】, inplace=True)\npenguins.body_mass_g.【6】(【7】, inplace=True)\npenguins.【8】().sum()',
        blanks: [
          { answers: ['fillna'], hint: '빈칸(na)을 채우다(fill) — fill 과 na 를 붙여 씁니다.' },
          { answers: ['mean1'], hint: '부리 길이의 평균을 담아 둔 이름입니다.' },
          { answers: ['fillna'], hint: '위 줄과 같은 명령입니다.' },
          { answers: ['mean2'], hint: '부리 두께의 평균을 담아 둔 이름입니다.' },
          { answers: ['fillna'], hint: '위 줄과 같은 명령입니다.' },
          { answers: ['mean3'], hint: '날개 길이의 평균을 담아 둔 이름입니다.' },
          { answers: ['fillna'], hint: '위 줄과 같은 명령입니다.' },
          { answers: ['mean4'], hint: '몸무게의 평균을 담아 둔 이름입니다.' },
          { answers: ['isnull', 'isna'], hint: '①에서 빈칸을 셀 때 쓴 명령입니다.' },
        ],
        read: '모든 열이 0 이면 성공입니다. 네 열의 빈칸 9칸이 각 열의 평균으로 채워졌습니다.',
      },
      { kind: 'section', title: '더 해 보기', text: '' },
      {
        id: 'l2-loc', kind: 'extra', title: '채워진 줄 직접 보기',
        what: '19번 펭귄은 몸무게가 비어 있던 펭귄입니다. .loc[번호] 로 그 한 줄을 꺼내 무엇으로 채워졌는지 봅니다.',
        code: 'penguins.loc[【0】]',
        blanks: [{ answers: ['19'], hint: '몸무게가 비어 있던 펭귄의 줄 번호를 넣습니다. 이 앞의 [눈으로 보기] 빈칸 지도에서 찾을 수 있습니다.' }],
        read: 'body_mass_g 가 4272.44898 입니다. 실제로 잰 값이 아니라 평균으로 채운 값이라서 소수점 아래가 깁니다. 채운 값은 "그럴듯한 추측"일 뿐이라는 점을 기억하세요.',
      },
      {
        id: 'l2-info', kind: 'extra', title: '설명서로 다시 확인하기',
        what: '빈칸을 채운 뒤 표의 설명서를 다시 봅니다.',
        code: 'penguins.【0】()',
        blanks: [{ answers: ['info'], hint: '1단계에 표의 설명서를 볼 때 쓴 명령입니다.' }],
        read: '이제 모든 열의 Non-Null Count 가 150 입니다.',
      },
      { kind: 'free', title: '🧪 자유 실험', text: '예) penguins.body_mass_g.median() · penguins.describe() · penguins.isnull().sum().sum()' },
    ],
    quiz: [
      { q: 'penguins.isnull().sum() 결과에서 bill_length_mm 옆의 2 는 무슨 뜻인가요?', choices: ['부리 길이의 평균이 2', '부리 길이 열에 빈칸이 2개', '부리 길이가 2mm 인 펭귄이 있다', '두 번째 열이라는 뜻'], answer: 1, why: 'isnull() 이 빈칸을 True(1) 로 바꾸고 sum() 이 그것을 더했으니 빈칸의 개수입니다.' },
      { q: 'fillna(mean1, inplace=True) 에서 inplace=True 의 역할은?', choices: ['평균을 새로 계산한다', '빈칸이 있는 줄을 지운다', '새 표를 만들지 않고 원래 표를 바로 고친다', '경고를 없앤다'], answer: 2, why: 'inplace 는 "그 자리에서"라는 뜻입니다. 없으면 채운 결과를 새로 돌려줄 뿐 penguins 는 그대로입니다.' },
      { q: '몸무게 평균(4272g)이 중앙값(3975g)보다 큰 까닭으로 가장 알맞은 것은?', choices: ['빈칸이 3개라서', '12500g 같은 아주 큰 값이 평균을 끌어올려서', '평균은 원래 중앙값보다 크다', '젠투펭귄이 가장 많아서'], answer: 1, why: '평균은 극단적인 값에 쉽게 끌려갑니다. 그래서 이상치가 있으면 평균 대신 중앙값으로 채우기도 합니다.' },
    ],
  },

  // ───────────────────────────────────────────────────────────
  {
    id: 'l3', num: 3, icon: '🎯', title: '이상치 처리하기', short: '이상치',
    goal: ['상자그림으로 이상치를 눈으로 찾는다', 'IQR(사분위 범위)로 이상치의 기준(울타리)을 계산한다', '이상치가 있는 줄을 지우고 표의 크기를 확인한다'],
    panel: 'iqr', panelAfter: 'l3-iqr',
    cells: [
      { kind: 'section', title: '앞 단계 코드', text: '불러오기와 결측치 채우기까지 한 번에 실행합니다.' },
      { id: 'l3-r0', kind: 'review', title: '불러오기 + 결측치 채우기', code: LOAD + '\n' + FILL + '\npenguins.isnull().sum()' },
      { kind: 'section', title: '① 상자그림 그리기', text: '상자그림은 자료의 가운데 50%를 상자로, 나머지를 수염으로 그립니다. 수염 밖에 따로 찍힌 점이 이상치 후보입니다.' },
      {
        id: 'l3-box', kind: 'code', title: '네 숫자 열의 상자그림',
        what: '그림을 그리는 matplotlib 의 pyplot 을 plt 라는 이름으로 가져옵니다. 표에서 숫자 열 넷을 골라(대괄호 두 겹) 상자그림을 그립니다.',
        code: `#penguins의 상자그림 그리기\n\nimport 【0】 as plt\npenguins[${COLS4}].【1】()`,
        blanks: [
          { answers: ['matplotlib.pyplot', 'matplotlib'], strict: true, hint: '그림 라이브러리 matplotlib 안의 pyplot 입니다. 점(.)으로 잇습니다.' },
          { answers: ['boxplot'], hint: '상자(box) + 그림(plot) 을 붙여 씁니다.' },
        ],
        read: '몸무게(body_mass_g)만 수천 단위라서 다른 세 열은 바닥에 납작하게 붙었습니다. 몸무게 위쪽에 12500 근처의 점, 아래쪽에 850 근처의 점이 따로 떨어져 있습니다. (import matplotlib as plt 로 써도 이 그림은 그려지지만, plt.figure() 같은 명령은 쓸 수 없습니다. matplotlib.pyplot 이 올바른 이름입니다.)',
      },
      { kind: 'section', title: '② IQR 로 이상치 찾기', text: 'Q1(25%)과 Q3(75%) 사이의 거리를 IQR 이라고 합니다. Q1 − 1.5×IQR 보다 작거나 Q3 + 1.5×IQR 보다 크면 이상치로 봅니다.' },
      {
        id: 'l3-iqr', kind: 'code', title: '몸무게의 이상치 찾기',
        what: 'np.percentile(열, [25, 75]) 로 Q1·Q3 를 한 번에 구해 q1, q3 두 이름에 나눠 담습니다. 위·아래 울타리를 계산한 뒤, 울타리 밖에 있는 값만 골라냅니다.',
        code: "#penguins의 body_mass_g 이상치 확인하기\n\nimport 【0】 as np\nq1, q3 = np.percentile(penguins['body_mass_g'],[【1】, 【2】])\niqr = q3 - q1\nupper = 【3】\nlower = 【4】\noutliers = penguins['body_mass_g'][(penguins['body_mass_g'] 【5】)|(penguins['body_mass_g'] 【6】)]\noutliers",
        blanks: [
          { answers: ['numpy'], hint: '수 계산 라이브러리입니다. 보통 np 라는 이름으로 가져옵니다.' },
          { answers: ['25'], hint: '1사분위수(Q1)는 몇 퍼센트 지점인가요? (0.25 가 아니라 퍼센트 숫자로)' },
          { answers: ['75'], hint: '3사분위수(Q3)는 몇 퍼센트 지점인가요?' },
          { answers: ['q3 + 1.5 * iqr', '1.5 * iqr + q3', 'q3 + iqr * 1.5'], hint: '위 울타리 = Q3 + 1.5 × IQR. 곱하기는 * 로 씁니다.' },
          { answers: ['q1 - 1.5 * iqr', 'q1 - iqr * 1.5', '-1.5 * iqr + q1'], hint: '아래 울타리 = Q1 − 1.5 × IQR.' },
          { answers: ['> upper'], hint: '위 울타리보다 "큰" 값 — 부등호와 울타리 이름을 함께 씁니다.' },
          { answers: ['< lower'], hint: '아래 울타리보다 "작은" 값.' },
        ],
        read: '33번 펭귄 12500g, 104번 펭귄 850g 두 마리가 이상치입니다. | 는 "또는", 조건마다 괄호로 감싸야 합니다. Q1=3600, Q3=4956.25, IQR=1356.25, 울타리는 1565.625 ~ 6990.625 입니다. [눈으로 보기] 에서 울타리를 직접 움직여 보세요.',
      },
      {
        id: 'l3-drop', kind: 'code', title: '이상치가 있는 줄 지우기',
        what: 'drop(index=지울 줄 번호들) 은 그 줄을 뺀 새 표를 돌려줍니다. 원래 penguins 는 그대로 두고, 지운 결과는 penguins_outliers 에 담습니다. 전후의 크기를 견줘 봅니다.',
        code: "#penguins의 body_mass_g 이상치 처리하기\n\npenguins_outliers = penguins.【0】(index = outliers.index)\nprint('이상치 제거 전:', penguins.【1】)\nprint('이상치 제거 후:', penguins_outliers.【2】)",
        blanks: [
          { answers: ['drop'], hint: '"떨어뜨리다, 빼다"라는 뜻의 영어 낱말입니다.' },
          { answers: ['shape'], hint: '표의 (행 수, 열 수). 괄호 없이 씁니다.' },
          { answers: ['shape'], hint: '위와 같습니다.' },
        ],
        read: '(150, 5) → (148, 5). 두 줄이 빠졌습니다. 열 수는 그대로입니다.',
      },
      { kind: 'section', title: '더 해 보기', text: '노트북은 몸무게만 처리했습니다. 다른 열에도 이상치가 남아 있을까요?' },
      {
        id: 'l3-rows', kind: 'extra', title: '이상치 펭귄의 전체 기록 보기',
        what: 'outliers.index 에는 이상치 펭귄의 줄 번호(33, 104)가 들어 있습니다. .loc[ ] 로 그 줄을 통째로 꺼냅니다.',
        code: 'penguins.【0】[outliers.index]',
        blanks: [{ answers: ['loc'], hint: '줄 번호(이름표)로 줄을 꺼낼 때 쓰는 세 글자.' }],
        read: '12500g 펭귄은 날개 218mm 인 젠투, 850g 펭귄은 날개 186mm 인 아델리입니다. 다른 값은 멀쩡하니 몸무게를 잘못 적었을 가능성이 큽니다.',
      },
      {
        id: 'l3-bill', kind: 'extra', title: '부리 길이의 이상치',
        what: '같은 방법을 부리 길이에 써 봅니다. 이번에는 이름을 a1, a3, b 로 짧게 썼습니다.',
        code: "a1, a3 = np.percentile(penguins['bill_length_mm'], [25, 75])\nb = a3 - a1\npenguins['bill_length_mm'][(penguins['bill_length_mm'] > 【0】) | (penguins['bill_length_mm'] < 【1】)]",
        blanks: [
          { answers: ['a3 + 1.5 * b', '1.5 * b + a3', 'a3 + b * 1.5', 'b * 1.5 + a3'], strict: true, hint: '위 울타리 = Q3 + 1.5 × IQR. 여기서는 Q3 가 a3, IQR 이 b 입니다.' },
          { answers: ['a1 - 1.5 * b', 'a1 - b * 1.5', '-1.5 * b + a1'], strict: true, hint: '아래 울타리 = Q1 − 1.5 × IQR.' },
        ],
        read: '7번 펭귄 115.4mm, 129번 펭귄 2.5mm. 몸무게만 지운 penguins_outliers 에는 이 두 값이 그대로 남아 있습니다. 다음 단계의 정규화 결과에 영향을 줍니다.',
      },
      { kind: 'free', title: '🧪 자유 실험', text: "예) 날개 길이(flipper_length_mm)·부리 두께(bill_depth_mm)의 이상치도 찾아보세요. · penguins_outliers.describe()" },
    ],
    quiz: [
      { q: 'Q1 = 3600, Q3 = 4956.25 일 때 IQR 은?', choices: ['1356.25', '4278.125', '8556.25', '6990.625'], answer: 0, why: 'IQR = Q3 − Q1 = 4956.25 − 3600 = 1356.25 입니다.' },
      { q: '위 울타리(upper)가 6990.625 일 때 이상치인 몸무게는?', choices: ['6775g', '6990g', '12500g', '4956g'], answer: 2, why: '6990.625 보다 큰 값만 이상치입니다. 6775g 은 가장 무겁지만 울타리 안입니다.' },
      { q: "조건을 (s > upper) | (s < lower) 처럼 괄호로 감싸야 하는 까닭은?", choices: ['보기 좋으라고', '파이썬은 | 를 > · < 보다 먼저 계산하기 때문에', '괄호가 없으면 느려서', 'upper 가 숫자라서'], answer: 1, why: '괄호가 없으면 upper | s 를 먼저 계산하려다 오류가 납니다. [자유 실험]에서 괄호를 빼고 직접 확인해 보세요.' },
    ],
  },

  // ───────────────────────────────────────────────────────────
  {
    id: 'l4', num: 4, icon: '📐', title: '정규화', short: '정규화',
    goal: ['단위와 크기가 다른 열을 0~1 사이로 맞춘다(최소-최대 정규화)', '정규화 결과를 다시 표로 만든다', '정규화 전후의 상자그림을 나란히 그려 비교한다'],
    panel: 'minmax', panelAfter: 'l4-scale',
    cells: [
      { kind: 'section', title: '앞 단계 코드', text: '' },
      { id: 'l4-r0', kind: 'review', title: '파일 올리기 (코랩 전용)', code: '# 파일 업로드\nfrom google.colab import files\nuploaded = files.upload()' },
      { id: 'l4-r1', kind: 'review', title: '불러오기 + 결측치 채우기', code: LOAD + '\n' + FILL + '\npenguins.isnull().sum()' },
      { id: 'l4-r2', kind: 'review', title: '이상치 찾아 지우기', code: OUTLIER + '\npenguins_outliers.shape' },
      { kind: 'section', title: '① 최소-최대 정규화', text: '정규화 값 = (x − 최솟값) ÷ (최댓값 − 최솟값). 가장 작은 값은 0, 가장 큰 값은 1 이 되고 나머지는 그 사이에 놓입니다.' },
      {
        id: 'l4-scale', kind: 'code', title: 'MinMaxScaler 로 정규화하기',
        what: 'scikit-learn 의 MinMaxScaler() 를 만들고 fit_transform(표) 를 부르면 최솟값·최댓값을 배우고(fit) 바로 바꿔(transform) 줍니다. 결과는 표가 아니라 숫자 배열이라서, pd.DataFrame( ) 으로 다시 열 이름을 붙인 표로 만듭니다.',
        code: `from sklearn.preprocessing import MinMaxScaler\npenguins_new = penguins_outliers[${COLS4}]\nnormal = MinMaxScaler().【0】(penguins_new)\nnormal = pd.【1】(normal, columns = penguins_new.columns)\nprint(normal); print(penguins_new)`,
        blanks: [
          { answers: ['fit_transform'], hint: '배우고(fit) + 바꾸기(transform) 를 밑줄로 잇습니다.' },
          { answers: ['DataFrame'], hint: 'pandas 의 표 이름입니다. D 와 F 가 대문자입니다.' },
        ],
        read: '위 표(normal)는 모두 0~1 사이, 아래 표(penguins_new)는 원래 값입니다. 0번 펭귄 몸무게: (5425 − 2725) ÷ (6775 − 2725) = 0.666667. 그런데 줄 번호를 보세요. normal 은 0~147 인데 penguins_new 는 이상치 두 줄이 빠져서 148, 149 로 끝납니다. 같은 자리의 줄이 같은 펭귄이 아닐 수 있습니다!',
      },
      { kind: 'section', title: '② 정규화 전후 비교', text: '' },
      {
        id: 'l4-plot', kind: 'code', title: '두 상자그림을 나란히 그리기',
        what: 'plt.figure(figsize=(가로, 세로)) 로 그림판을 만들고, plt.subplot(행, 열, 번호) 로 칸을 고른 뒤 그 칸에 상자그림을 그립니다. 마지막에 plt.show() 로 보여 줍니다.',
        code: 'import matplotlib.pyplot as plt\nplt.【0】(figsize=(12, 6))\nplt.【1】(1, 2, 1)\npenguins_new.【2】()\nplt.subplot(【3】)\nnormal.【4】()\nplt.【5】()',
        blanks: [
          { answers: ['figure'], hint: '그림판 — "그림, 도형"이라는 뜻의 영어 낱말입니다.' },
          { answers: ['subplot'], hint: '그림판 안의 작은 칸 — sub + plot.' },
          { answers: ['boxplot'], hint: '상자그림 명령입니다.' },
          { answers: ['1, 2, 2', '1,2,2', '122'], hint: '1행 2열 중 두 번째 칸 — 수 세 개를 쉼표로 나눕니다.' },
          { answers: ['boxplot'], hint: '상자그림 명령입니다.' },
          { answers: ['show'], strict: true, hint: '"보여 주다"라는 뜻의 영어 낱말입니다.' },
        ],
        read: '왼쪽(정규화 전)은 몸무게만 크게 보이고 나머지는 바닥에 붙어 있지만, 오른쪽(정규화 후)은 네 열을 같은 눈금에서 견줄 수 있습니다. 그런데 오른쪽을 자세히 보세요. 몸무게는 0~1 을 넓게 쓰는데, 부리 길이는 0.27~0.48, 부리 두께는 0~0.28, 날개 길이는 0~0.23 의 좁은 곳에 몰려 있고, 1 에 점이 하나씩 떨어져 있습니다(부리 길이는 0 에도). 지우지 않은 이상치(부리 길이 115.4·2.5mm, 부리 두께 42.9mm, 날개 421mm)가 최댓값·최솟값이 되어 나머지 펭귄을 한쪽으로 눌러 버렸기 때문입니다. 정규화 전에 이상치를 먼저 처리해야 하는 까닭입니다.',
      },
      { kind: 'section', title: '더 해 보기', text: '' },
      {
        id: 'l4-describe', kind: 'extra', title: '정말 0~1 인지 확인하기',
        what: '정규화한 표의 기술 통계를 봅니다.',
        code: 'normal.【0】()',
        blanks: [{ answers: ['describe'], hint: '1단계에 기술 통계를 볼 때 쓴 명령입니다.' }],
        read: '모든 열의 min 이 0, max 가 1 입니다. bill_length_mm 의 평균은 0.38 로, 가운데(0.5)보다 한참 아래입니다.',
      },
      {
        id: 'l4-formula', kind: 'extra', title: '공식으로 직접 정규화하기',
        what: 'MinMaxScaler 없이 공식을 그대로 씁니다. 표 − 표.min() 은 열마다 그 열의 최솟값을 뺍니다.',
        code: 'manual = (penguins_new - penguins_new.【0】()) / (penguins_new.【1】() - penguins_new.【2】())\nmanual.head(3)',
        blanks: [
          { answers: ['min'], hint: '최솟값 명령입니다.' },
          { answers: ['max'], hint: '최댓값 명령입니다.' },
          { answers: ['min'], hint: '최솟값 명령입니다.' },
        ],
        read: 'normal.head(3) 과 값이 같습니다. 다만 manual 은 줄 번호가 penguins_new 와 같게 남아 있습니다. MinMaxScaler 는 표를 숫자 배열로 바꾸면서 줄 번호를 버리기 때문입니다.',
      },
      { kind: 'free', title: '🧪 자유 실험', text: "예) import matplotlib as plt 로 가져온 뒤 plt.figure(figsize=(12, 6)) 을 실행해 보세요. 어떤 오류가 날까요? · normal.head() · penguins_new.head()" },
    ],
    quiz: [
      { q: '최소-최대 정규화를 하면 모든 값은 어느 범위에 들어가나요?', choices: ['−1 ~ 1', '0 ~ 1', '0 ~ 100', '평균 0, 표준편차 1'], answer: 1, why: '가장 작은 값이 0, 가장 큰 값이 1 이 됩니다. "평균 0, 표준편차 1" 은 표준화(StandardScaler)입니다.' },
      { q: '몸무게 최솟값 2725g, 최댓값 6775g 일 때 5425g 의 정규화 값은?', choices: ['0.5', '0.6667', '0.8007', '1.3333'], answer: 1, why: '(5425 − 2725) ÷ (6775 − 2725) = 2700 ÷ 4050 = 0.6667 입니다.' },
      { q: '정규화 전 상자그림에서 부리·날개 열이 바닥에 납작하게 붙은 까닭은?', choices: ['빈칸이 많아서', '몸무게만 수천 단위라 눈금이 커져서', '이상치를 지워서', '글자 열이 섞여서'], answer: 1, why: '한 그림에 함께 그리면 가장 큰 몸무게에 눈금이 맞춰집니다. 그래서 크기가 다른 열을 견줄 때 정규화를 합니다.' },
    ],
  },
];

// 빈칸 정답을 채운 완성 코드
export function fillAnswers(cell, pick = (b) => b.answers[0]) {
  return cell.code.replace(/【(\d+)】/g, (_, n) => pick(cell.blanks[Number(n)], Number(n)));
}

// 코드 템플릿을 조각으로 — [{text}, {blank: n}, …]
export function splitTemplate(code) {
  const parts = [];
  let last = 0;
  for (const m of code.matchAll(/【(\d+)】/g)) {
    if (m.index > last) parts.push({ text: code.slice(last, m.index) });
    parts.push({ blank: Number(m[1]) });
    last = m.index + m[0].length;
  }
  if (last < code.length) parts.push({ text: code.slice(last) });
  return parts;
}

export const runnable = (c) => c.kind === 'code' || c.kind === 'review' || c.kind === 'extra';
export const graded = (c) => c.kind === 'code' || c.kind === 'extra';
