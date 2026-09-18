# penguins-lab — 펭귄 데이터 전처리 실습실

## ① 목적과 대상
- 코랩 노트북 4개(`../01. 데이터 수집과 특성 분석_penguins` ~ `../04. 정규화_penguins`)의
  **빈칸 명령어 실습을 브라우저에서 그대로** 해 보는 앱. 데이터는 `../penguins.csv`(150행 5열).
- 대상 단원: 「데이터 과학」·「인공지능 기초」의 데이터 전처리 — 수집·특성 파악 → 결측치 → 이상치 → 정규화.
- **노트북은 다른 선생님 자료다.** 명령어 순서와 빈칸 위치만 따랐고,
  설명·결과 읽는 법·힌트·확인 문제·「눈으로 보기」는 새로 썼다.
  ⚠ 원본 노트북 파일(`../0N. …_penguins`)은 앱 폴더 밖에 있어 저장소에 들어가지 않는다. 작성자 실명도 적지 않는다(공개 저장소).
- ⚠ **사용자 지시(2026-09-17): 저작자 표시를 하지 않는다.**
  루트 `CLAUDE.md` 의 「저작권 표시」(© 티쳐무 일곱 곳) 방침을 **이 앱에는 적용하지 않았다.**
  `LICENSE` 없음, 푸터·머리 주석·배너 없음, `package.json` 에 `license` 필드 없음.
- **배포 (2026-09-18 사용자 지시로 공개 배포)** — 처음엔 배포하지 않기로 했다가 바꿨다.
  저장소: https://github.com/trmoo/penguins_analysis (Pages: https://trmoo.github.io/penguins_analysis/)
  ⚠ **폴더 이름(`penguins-lab`)과 저장소 이름(`penguins_analysis`)이 다르다.** 깃 저장소 루트는 이 앱 폴더다.
  Pages 는 `.github/workflows/deploy.yml` 이 푸시마다 `npm ci → npm test → npm run build → 빌드 결과 점검`을
  돌려 올린다(dist 커밋 안 함, 시험이 깨지면 배포도 멈춤). 저장소의 Pages 가 처음부터 「GitHub Actions」(`build_type: workflow`)였다.
  ⚠ 배포 확인은 Actions 탭의 「성공」만 보지 말고 **크기와 MD5** 를 로컬 `dist/index.html` 과 견줄 것
  (1KB 미만이면 브랜치 배포가 이긴 것 — 다른 앱에서 겪은 함정).
  ⚠ 배포본은 로컬 빌드보다 **302바이트 작다** — 로컬 `src/data/penguins.csv` 가 CRLF 이고 깃이 LF 로 바꿔 올리기 때문이다
  (151줄 × CR 1바이트). 앱은 CSV 를 읽을 때 CR 을 걷어 내므로 결과는 같다. 그래서 MD5 는 다르게 나온다.
  포털 `comedu_portal` 의 「학습 도구」에 「펭귄 데이터로 전처리 연습하기」(🐧)로 걸려 있다.

## ② 기능
- **탭 5개** — 1단계 수집·특성 / 2단계 결측치 / 3단계 이상치 / 4단계 정규화 / 📖 안내(명령어 사전·기록 지우기).
  ⚠ 화면에서는 「차시」가 아니라 **「단계」** 라고 부른다(사용자 지시 2026-09-18). 「지난 시간 코드」도 「앞 단계 코드」로 바꿨다. 이 문서의 「차시」는 단계와 같은 뜻이다.
  주소 해시 `#l1`~`#l4`, `#guide`.
- **셀 종류** (`src/lessons/data.js`)
  - `code` 노트북의 빈칸 셀(채점) · `review` 지난 시간 코드(실행만) · `extra` 더 해 보기(채점, 진행률 따로)
  - `free` 자유 실험 셀(아무 코드나) · `section` 소제목
  - 빈칸은 코드 속 `【0】【1】…`. 입력칸 자리표시로 ①②… 가 보인다. 빈칸에서 Enter = 실행.
- **채점** (`src/lessons/grade.js`) — 정답 코드로 **처음부터 그 셀까지 새 커널에서 실행한 기준**과 견준다.
  ① 오류 없음 ② 출력(print·셀 결과·그림) 같음 ③ **기준 커널의 모든 변수** 값이 같음 ④ `strict` 빈칸은 글자도 정답 목록과 같음.
  그래서 `isna` 처럼 다르게 써도 결과가 같으면 통과한다.
- **힌트 3단계** — 설명 → 첫 글자 무늬(`h _ _ _`) → [🔑 정답 넣기].
- **오류 화면** — 코랩 모양의 Traceback + 우리말 오류 이름 + 💡 도움말. 지원하지 않는 명령은 🚧 로 따로 알린다.
- **👀 눈으로 보기** (`src/ui/panels.js`) — 1차시 표 전체(정렬·NaN 빨강·튀는 값 칠하기) / 2차시 빈칸 지도(채우기 전후)·평균과 중앙값 /
  3차시 IQR 울타리 실험실(열 바꾸기. 울타리 계수는 수업대로 1.5 고정 — 사용자 지시 2026-09-18 로 k 슬라이더를 뺐다) / 4차시 정규화 계산기(펭귄 하나를 따라가기 + 이상치 지웠다면? + 줄 번호 어긋남).
- **확인 문제** 차시마다 3문제(고르면 바로 해설).
- **교사용** — 툴바 [👩‍🏫 정답 채우기] → [▶ 위에서부터 모두 실행] 으로 한 번에 시연.
- 개인정보 없음. `localStorage`(`penguins-lab:v1`)에 채운 빈칸·통과·문제 답만. [🧹 내 기록 지우기].

## ③ 자체 엔진 (`src/engine/`) — 이 앱의 핵심
파이썬 설치·인터넷 없이 돌도록 **수업에 나오는 pandas·numpy·matplotlib·sklearn 명령만 흉내 내는 실행기**를 직접 만들었다.
(Pyodide 는 약 15~35MB 를 받아야 해서 사용자가 자체 엔진을 골랐다.)

| 파일 | 하는 일 |
|---|---|
| `parser.js` | 토큰·구문 트리. 가져오기·대입·식·f-문자열. for·if·def 는 🚧 로 알림 |
| `interp.js` | `Kernel` — `run(code)` → `{items, error, assigned, count}`. 이름·속성 오류에 도움말 |
| `pandas.js` | `Index`·`Series`·`DataFrame`·`.loc/.iloc`·연산·**화면 표기(repr)** |
| `ndarray.js` | numpy 배열 표기 |
| `plotting.js` | 그림판·칸·상자그림 수치(matplotlib 과 같은 수염 계산) |
| `modules.js` | `pd`·`np`·`matplotlib(.pyplot)`·`sklearn.preprocessing`·`google.colab.files` |
| `numfmt.js` | 파이썬 float repr·pandas 6자리·numpy 8자리·**numpy 덧셈 순서**·반올림 |

★ **출력이 코랩(pandas 2.2)과 글자 하나까지 같다.** `tools/golden.py` 가 진짜 pandas 로 `test/scenarios.json` 100셀을 실행해
`test/golden.json` 을 만들고, `test/golden.test.mjs` 가 엔진 출력과 대조한다.

⚠ **기준 출력은 반드시 pandas 2.2 로 만든다** — 이 PC 의 기본 파이썬은 pandas **3.0.5** 인데,
pandas 3 에서는 `penguins.bill_length_mm.fillna(mean1, inplace=True)` 가 **원본을 바꾸지 않는다**(노트북과 결과가 달라짐).
`ds_performance/.venv`(pandas 2.2.2, numpy 2.x, scikit-learn 없음)를 **읽기만 하는 용도로** 빌려 쓴다:
```bash
cd D:\project_AI\data_analysis\penguins-lab
PYTHONUTF8=1 ../../ds_performance/.venv/Scripts/python.exe tools/golden.py
```

만들며 알아낸 것 (고칠 때 되돌리지 말 것)
- ⚠ **평균은 numpy 의 짝수 개 덧셈(pairwise summation) 순서로 더해야** `print(mean1)` 의 마지막 자리(`44.96621621621622`)가 맞는다.
  앞에서부터 더하면 어긋난다. 무작위 3,000회로 numpy 와 같음을 확인했다(`numfmt.pairwiseSum`).
- ⚠ **pandas 표의 수 표기** — 열마다 소수 6자리로 적고 "모두 0 으로 끝나면 함께 지운다". 그래서 44.966216 이 섞인 열은 47.200000 이 된다.
  열 머리는 숫자 열이면 앞에 빈칸 하나, 칸 사이 1칸(값에도 부호 자리 빈칸). 60줄 넘으면 앞뒤 5줄 + `..`/`...`.
- ⚠ **반올림은 파이썬처럼 짝수 쪽으로** — `6990.625` → `6990.62`(자바스크립트 `toFixed` 는 `6990.63`). `numfmt.fixed`.
- ⚠ **MinMaxScaler 는 sklearn 순서** `x × (1/(max−min)) + (0 − min × scale)` 로 계산한다. `(x−min)/(max−min)` 과 마지막 자리가 다르다.
- ⚠ **numpy 2 + pandas 2.2.2 에서 `np.array(df)` 가 원본을 가리킬 수 있다** — 기준 스크립트의 흉내 MinMaxScaler 가 `penguins_new` 원본을
  바꿔 버려서 대조가 5개 틀렸었다. `golden.py` 에 `.copy()` 를 넣었다(엔진이 맞았다).
- ⚠ **`import matplotlib as plt` 뒤 `plt.figure(...)` 는 진짜 파이썬에서 `TypeError: 'module' object is not callable`** 이다
  (`matplotlib.figure` 가 하위 모듈이라서). 3차시 노트북의 답이 `matplotlib` 이어도 상자그림은 그려지므로 두 답 다 받고 strict 로 둔다.
- ⚠ **채점에서 변수 비교를 "대입한 이름"으로만 하면 안 된다** — `fillna(inplace=True)` 는 대입 없이 표를 바꿔서
  `mean1`·`mean2` 를 바꿔 넣어도 통과했다. 기준 커널의 **모든 변수**(모듈·함수·딕셔너리 빼고)를 견준다.
- ⚠ **`strict` 빈칸** — 결과로는 틀렸는지 모르는 자리: `plt.show`(없어도 셀이 끝나면 그림이 나옴), 울타리 계수 1.5(3 으로 써도 같은 이상치),
  import 이름. 새 빈칸을 만들 때 `test/lessons.test.mjs` 의 `WRONG` 표에 틀린 답 예시를 넣으면 이런 구멍을 시험이 잡는다.
- ⚠ **틀린 답으로 한 번 실행하면 표가 이미 바뀐다** — 한 번 채운 칸은 빈칸이 아니라 다시 `fillna` 해도 안 바뀐다(코랩도 같음).
  `state.ranWrong` 으로 알아채 「▶ 위에서부터 모두 실행」을 안내한다(차시마다 첫 셀이 `pd.read_csv` 로 표를 새로 읽으므로 이것만으로 처음부터 다시 계산된다).
- ⚠ **FutureWarning 등 경고(stderr)는 화면에 보이지 않는다**(사용자 지시 2026-09-18). 엔진은 코랩과 똑같이 경고를 만들고(대조 시험이 확인) `src/ui/output.js` 에서만 걸러 낸다.
- ⚠ **[🔄 다시 시작] 은 그 탭의 빈칸 답까지 지운다**(사용자 지시 2026-09-18). 통과 기록(✅)과 자유 실험 코드는 남긴다.
  그래서 어긋났을 때의 안내는 「다시 시작 → 모두 실행」이 아니라 「모두 실행」만이다 — 다시 시작하면 빈칸이 비어 모두 실행이 첫 빈칸에서 멈춘다.
- ⚠ **화면 요소의 자식을 바꿀 때 `replaceChildren` 대신 `fill()`**(`src/lib/ui.js`) — `replaceChildren(null)` 은 글자 "null" 을 찍는다(실제로 겪었다).
- ⚠ **`src/lessons/data.js`·`grade.js`·`src/engine/` 에서 DOM 을 쓰지 말 것** — node 시험이 그대로 불러온다.
- ⚠ 파이썬 정규식이 든 파일을 **셸 히어독 안의 스크립트로 고치지 말 것** — 역슬래시가 풀려 `parser.js` 가 한 번 통째로 깨졌다. Edit/Write 로 고친다.

## ④ 점검·실행
| 명령 | 하는 일 |
|---|---|
| `npm install` | vite · vite-plugin-singlefile |
| `npm start` | 개발 서버 (`index.html`). `.claude/launch.json` 의 `penguins-lab`(포트 5191) |
| `npm run build` | `dist/index.html` 한 파일(약 186KB, 바깥 자원 0개) — 더블클릭 실행 |
| `npm test` | **771가지** — 진짜 pandas 대조(golden) · 차시 정답/다른 정답/틀린 답/빈칸 · 화면에 적은 숫자 · 오류 도움말 |

화면에 적어 둔 숫자(시험이 지킨다): 빈칸 9칸(2·2·2·3) · 몸무게 중앙값 3975 · 평균 44.96621621621622 ·
Q1 3600 · Q3 4956.25 · IQR 1356.25 · 울타리 1565.625 ~ 6990.625 · 이상치 33번 12500g(젠투, 날개 218)·104번 850g(아델리) ·
(150, 5) → (148, 5) · 부리 길이 이상치 7번 115.4·129번 2.5 · 정규화 0번 몸무게 0.6667 · normal 부리 길이 평균 0.38 ·
penguins_new 줄 번호는 149 로 끝나고 normal 은 147 로 끝남.

## ⑤ 현재 상태 (2026-09-17)
- 4차시 전부 완성. 브라우저(개발 서버)에서 네 차시를 [정답 채우기 → 모두 실행] 으로 끝까지 통과, 오류 0 확인.
- 좁은 화면(366px)·태블릿(768px)에서 확인. 넓은 TV 화면은 그림 글자를 키워 두었지만 실제 TV 로는 못 봤다.

## ⑥ 다음 할 일 (후보)
- for 문 지원(열 네 개를 반복문으로 채우기) — 지금은 🚧 로 안내만 한다.
- 히스토그램·산점도(`plt.hist`·`plt.scatter`) — 지금은 상자그림만 그린다.
- 결측치를 중앙값으로 채우거나, 부리·날개 이상치까지 지운 뒤 정규화하는 「비교 실험」 차시.
