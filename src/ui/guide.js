// 📖 안내 탭 — 쓰는 법, 명령어 사전, 이 실습실에 대하여
import { h, modal, clearStore, toast } from '../lib/ui.js';

const DICT = [
  ['1', "pd.read_csv('파일.csv')", 'CSV 파일을 읽어 표(DataFrame)로 만든다', "penguins = pd.read_csv('penguins.csv')"],
  ['1', '표.head(n)', '앞의 n줄을 본다. n 을 비우면 5줄', 'penguins.head(3)'],
  ['1', '표.info()', '줄 수·열 이름·빈칸 아닌 값의 수·자료형을 본다', 'penguins.info()'],
  ['1', '표.describe()', '숫자 열의 개수·평균·표준편차·최솟값·사분위수·최댓값', 'penguins.describe()'],
  ['2', '표.isnull().sum()', '열마다 빈칸(NaN) 수를 센다. isna() 도 같다', 'penguins.isnull().sum()'],
  ['2', '표.열.mean()', '열의 평균 (빈칸은 빼고 계산)', 'penguins.body_mass_g.mean()'],
  ['2', '표.열.fillna(값, inplace=True)', '빈칸을 값으로 채우고 원래 표를 바로 고친다', 'penguins.body_mass_g.fillna(mean4, inplace=True)'],
  ['3', "표[['열', '열']].boxplot()", '고른 열들의 상자그림을 그린다', "penguins[['body_mass_g']].boxplot()"],
  ['3', 'np.percentile(열, [25, 75])', '25%·75% 지점의 값(Q1·Q3)', "q1, q3 = np.percentile(penguins['body_mass_g'], [25, 75])"],
  ['3', '열[(조건) | (조건)]', '조건에 맞는 값만 고른다. | 는 또는, & 는 그리고', "s[(s > upper) | (s < lower)]"],
  ['3', '표.drop(index=번호들)', '그 줄들을 뺀 새 표를 돌려준다', 'penguins.drop(index=outliers.index)'],
  ['3', '표.shape', '(행 수, 열 수). 괄호 없이 쓴다', 'penguins_outliers.shape'],
  ['4', 'MinMaxScaler().fit_transform(표)', '열마다 0~1 로 정규화한 숫자 배열', 'MinMaxScaler().fit_transform(penguins_new)'],
  ['4', 'pd.DataFrame(배열, columns=열이름)', '숫자 배열에 열 이름을 붙여 표로 만든다', 'pd.DataFrame(normal, columns=penguins_new.columns)'],
  ['4', 'plt.figure(figsize=(가로, 세로))', '그림판을 만든다 (단위: 인치, 1인치 = 100픽셀)', 'plt.figure(figsize=(12, 6))'],
  ['4', 'plt.subplot(행, 열, 번호)', '그림판을 칸으로 나누고 번호 칸을 고른다', 'plt.subplot(1, 2, 1)'],
  ['4', 'plt.show()', '그린 그림을 보여 준다', 'plt.show()'],
];

const MORE = [
  '표.median() · min() · max() · std() · var() · count() · sum() · quantile(0.25)',
  '표.dropna() · 표.fillna(값) · 표.copy() · 표.sort_values(\'열\', ascending=False) · 표.reset_index(drop=True)',
  '표.iloc[위치] · 표.loc[번호, \'열\'] · 표.columns · 표.index · 표.dtypes · 표.values · len(표)',
  "표['새열'] = 값 · (표 - 표.min()) / (표.max() - 표.min()) · 열.unique() · 열.round(2)",
  'np.mean · np.median · np.std · np.quantile · StandardScaler() · print(…, …) · f\'{값:.2f}\'',
];

export function buildGuide(onClear) {
  return h('div', { class: 'guide' },
    h('section', { class: 'hero' },
      h('h2', {}, '📖 쓰는 법'),
      h('ol', { class: 'howto' },
        h('li', {}, '위쪽 탭에서 단계를 고르고, 코드 셀의 빈칸을 채운 뒤 ', h('b', {}, '▶ 실행'), '(또는 빈칸에서 Enter)을 누릅니다.'),
        h('li', {}, '노트북과 같은 결과가 나오면 ✅, 막히면 ', h('b', {}, '💡 힌트'), '를 누릅니다. 세 번 누르면 정답을 넣을 수 있습니다.'),
        h('li', {}, '셀은 ', h('b', {}, '위에서부터 차례대로'), ' 실행해야 합니다. 순서가 꼬이면 ▶ 위에서부터 모두 실행. 🔄 다시 시작은 그 탭의 빈칸 답까지 모두 지우고 처음으로 돌아갑니다.')),
      h('p', { class: 'tiny' }, '파이썬 설치도, 인터넷도, 로그인도 필요 없습니다. 파일을 올릴 필요도 없습니다 — penguins.csv 가 이미 들어 있습니다.')),

    h('section', { class: 'card' },
      h('h3', {}, '📚 명령어 사전'),
      h('div', { class: 'table-scroll tall' },
        h('table', { class: 'data dict' },
          h('thead', {}, h('tr', {}, h('th', {}, '단계'), h('th', {}, '명령어'), h('th', {}, '하는 일'), h('th', {}, '예'))),
          h('tbody', {}, DICT.map(([n, cmd, what, ex]) => h('tr', {}, h('td', {}, n), h('td', {}, h('code', {}, cmd)), h('td', {}, what), h('td', {}, h('code', { class: 'ex' }, ex))))))),
      h('h4', {}, '자유 실험 셀에서 함께 쓸 수 있는 명령'),
      h('ul', { class: 'more' }, MORE.map((m) => h('li', {}, h('code', {}, m))))),

    h('section', { class: 'card' },
      h('h3', {}, '🔧 이 실습실에 대하여'),
      h('ul', {},
        h('li', {}, '이 앱 안에는 진짜 파이썬이 아니라, ', h('b', {}, '이 수업에 나오는 pandas·numpy·matplotlib·scikit-learn 명령을 흉내 내는 작은 실행기'), '가 들어 있습니다. 그래서 인터넷 없이 바로 실행됩니다.'),
        h('li', {}, '출력 모양은 ', h('b', {}, '코랩(pandas 2.2)'), '과 글자 하나까지 같도록 맞추고, 진짜 pandas 로 뽑은 결과 100가지와 대조해 검사했습니다(평균의 마지막 자릿수, describe 표, 오류 문구까지).'),
        h('li', {}, 'for·if·def 같은 문장, 그래프는 상자그림 말고는 아직 실행할 수 없습니다. 이런 명령은 오류가 아니라 🚧 「아직 실행할 수 없는 명령」으로 알려 줍니다. 코랩에서 해 보세요.'),
        h('li', {}, '이름·학번 같은 개인정보는 받지 않습니다. 채운 빈칸과 통과 기록만 이 컴퓨터의 브라우저에 남습니다.'))),

    h('section', { class: 'card' },
      h('h3', {}, '🧹 내 기록 지우기'),
      h('p', {}, '공용 컴퓨터를 다음 사람에게 넘기기 전에 누르세요. 채운 빈칸·통과 기록·문제 답이 모두 지워집니다.'),
      h('button', {
        class: 'btn danger', onClick: async () => {
          const ok = await modal('내 기록을 모두 지울까요?', '채운 빈칸, 통과 기록, 확인 문제 답이 지워지고 처음 화면으로 돌아갑니다.', { ok: '지우기', cancel: '취소' });
          if (!ok) return;
          clearStore();
          toast('기록을 지웠습니다.');
          onClear();
        },
      }, '🧹 내 기록 지우기')));
}
