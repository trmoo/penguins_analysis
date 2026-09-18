# 🐧 펭귄 데이터 전처리 실습실

펭귄 150마리 기록(`penguins.csv`)으로 **데이터 수집 → 결측치 → 이상치 → 정규화** 명령어를
브라우저에서 직접 실행해 보는 실습 앱입니다. 파이썬 설치·인터넷·로그인이 필요 없습니다.

## 학생·교사용 사용법
1. **https://trmoo.github.io/penguins_analysis/** 로 들어가거나, `dist/index.html` 을 더블클릭해 엽니다(크롬·엣지·웨일).
   `dist/index.html` 한 파일은 인터넷 없이도 열립니다.
2. 위쪽 탭에서 단계를 고르고, 코드 셀의 **노란 빈칸**을 채운 뒤 **▶ 실행**(또는 빈칸에서 Enter)을 누릅니다.
3. 노트북과 같은 결과가 나오면 ✅. 막히면 **💡 힌트**(세 번 누르면 정답 넣기). 순서가 꼬이면 ▶ 위에서부터 모두 실행. 🔄 다시 시작은 그 탭의 빈칸 답까지 지우고 처음으로 돌아갑니다.

| 단계 | 실습하는 명령어 |
|---|---|
| 1 데이터 수집과 특성 분석 | `pd.read_csv` · `head` · `info` · `describe` (+ `shape` · `value_counts` · `tail`) |
| 2 결측치 처리 | `isnull().sum()` · `mean` · `fillna(값, inplace=True)` (+ `loc` · `info`) |
| 3 이상치 처리하기 | `boxplot` · `np.percentile` · IQR 울타리 · `(조건) \| (조건)` · `drop` · `shape` |
| 4 정규화 | `MinMaxScaler().fit_transform` · `pd.DataFrame` · `plt.figure` · `plt.subplot` · `plt.show` |

- 단계마다 **👀 눈으로 보기**(빈칸 지도, IQR 울타리 실험실, 정규화 계산기 등)와 **📝 확인 문제**가 있습니다.
- 교사는 툴바의 **👩‍🏫 정답 채우기** → **▶ 위에서부터 모두 실행** 으로 한 번에 시연할 수 있습니다.
- 공용 컴퓨터에서는 📖 안내 탭의 **🧹 내 기록 지우기** 를 눌러 주세요. 이름·학번 같은 개인정보는 받지 않습니다.

## 알아 둘 점
- 앱 안에는 진짜 파이썬이 아니라 **이 수업의 명령어를 흉내 내는 작은 실행기**가 들어 있습니다.
  출력은 코랩(pandas 2.2)과 같게 맞췄고, 진짜 pandas 결과 100가지와 대조해 검사했습니다.
- for·if 문, 상자그림 이외의 그래프 등은 🚧 「아직 실행할 수 없는 명령」으로 안내합니다. 그런 실험은 코랩에서 해 보세요.
- 2단계의 `fillna(값, inplace=True)` 실행 때 코랩에서는 분홍색 `FutureWarning` 경고가 뜨지만, 이 앱에서는 보여 주지 않습니다.

## 개발
```bash
cd D:\project_AI\data_analysis\penguins-lab
npm install
npm start        # 개발 서버
npm test         # 771가지 점검
npm run build    # dist/index.html 한 파일
```
