# 기준 출력 만들기 — 진짜 pandas 2.2 로 test/scenarios.json 의 코드를 실행해
# test/golden.json 에 담는다. 자체 엔진(src/engine)이 이것과 글자 하나까지 같아야 한다.
#
# 코랩과 같은 pandas 2.2 가 필요하다 (pandas 3 에서는 fillna(inplace=True) 가 원본을 안 바꾼다).
#   ..\..\ds_performance\.venv\Scripts\python.exe tools\golden.py
import ast, io, json, os, sys, types, warnings, contextlib, traceback

import numpy as np
import pandas as pd
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
from matplotlib import cbook

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
assert pd.__version__.startswith('2.2'), 'pandas 2.2 로 실행해야 한다: ' + pd.__version__


# scikit-learn 이 없는 환경이라 MinMaxScaler 를 sklearn 과 같은 계산 순서로 흉내 낸다.
# (sklearn: scale_ = 1/(max-min), min_ = 0 - min*scale_, X*scale_ + min_)
class MinMaxScaler:
    def fit_transform(self, X):
        a = np.array(X, dtype=float).copy()  # numpy 2 + pandas 2.2.2 에서는 np.array(df) 가 원본을 가리킬 수 있다
        mn, mx = np.nanmin(a, axis=0), np.nanmax(a, axis=0)
        rng = mx - mn
        rng[rng == 0.0] = 1.0
        scale = 1.0 / rng
        m = 0 - mn * scale
        a *= scale
        a += m
        return a


sk = types.ModuleType('sklearn'); pre = types.ModuleType('sklearn.preprocessing')
pre.MinMaxScaler = MinMaxScaler; sk.preprocessing = pre
sys.modules['sklearn'] = sk; sys.modules['sklearn.preprocessing'] = pre


def run_cell(code, ns):
    out = io.StringIO()
    res = {'stdout': '', 'display': None, 'error': None, 'warnings': []}
    try:
        tree = ast.parse(code)
    except SyntaxError as e:
        res['error'] = ['SyntaxError', str(e.msg)]
        return res
    last = None
    if tree.body and isinstance(tree.body[-1], ast.Expr):
        last = ast.Expression(tree.body.pop().value)
    with warnings.catch_warnings(record=True) as w, contextlib.redirect_stdout(out):
        warnings.simplefilter('always')
        try:
            exec(compile(tree, '<cell>', 'exec'), ns)
            if last is not None:
                v = eval(compile(last, '<cell>', 'eval'), ns)
                if v is not None:
                    res['display'] = repr(v)
        except Exception as e:
            msg = str(e)
            if isinstance(e, KeyError):
                msg = repr(e.args[0]) if e.args else ''
            res['error'] = [type(e).__name__, msg]
        res['warnings'] = [x.category.__name__ for x in w]
    res['stdout'] = out.getvalue()
    return res


def main():
    os.chdir(os.path.join(ROOT, 'src', 'data'))
    scen = json.load(open(os.path.join(ROOT, 'test', 'scenarios.json'), encoding='utf-8'))
    result = {}
    for s in scen:
        ns = {}
        cells = []
        for code in s['cells']:
            plt.close('all')
            cells.append(run_cell(code, ns))
        result[s['id']] = cells

    # 상자그림 수치 — 수염 끝·바깥 점(fliers)을 matplotlib 계산 그대로 기록
    df = pd.read_csv('penguins.csv')
    num = ['bill_length_mm', 'bill_depth_mm', 'flipper_length_mm', 'body_mass_g']
    for c in num:
        df[c] = df[c].fillna(df[c].mean())
    box = {}
    for c in num:
        st = cbook.boxplot_stats(df[c].values)[0]
        box[c] = {k: (list(map(float, st[k])) if k == 'fliers' else float(st[k]))
                  for k in ['whislo', 'q1', 'med', 'q3', 'whishi', 'fliers']}
    result['boxstats'] = box

    json.dump(result, open(os.path.join(ROOT, 'test', 'golden.json'), 'w', encoding='utf-8'),
              ensure_ascii=False, indent=1)
    print('golden.json 저장 —', sum(len(v) for k, v in result.items() if k != 'boxstats'), '셀')


main()
