# Shared by the MGMT90141 lesson files: the frame block, the LP numbers (solved by the instruments' own engine and
# cross-checked with scipy, never typed by hand), the paper's z-table, and small writing helpers.
import json
import math
import os
import subprocess
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, '..'))
from lesson_kit import *  # noqa: E402,F403

CID = 'mgmt90141'
INF = 1e30  # what the engine reports for "no limit" (Excel's 1E+30)


def frame(src, alt, caption=None, height=None, **params):
    """An instrument from public/frames/mgmt90141/ (see docs/lessons/NEXT-LEARNING.md); params reach it as ?p=."""
    b = {'type': 'frame', 'src': f'frames/mgmt90141/{src}', 'alt': alt}
    if params: b['params'] = params
    if height: b['height'] = height
    if caption: b['caption'] = caption
    return b


# ---------------------------------------------------------------- LP numbers: engine in node, checked by scipy
def _scipy(sense, c, rows):
    from scipy.optimize import linprog
    A_ub, b_ub, A_eq, b_eq = [], [], [], []
    for a, op, b in rows:
        if op == '<=': A_ub.append(a); b_ub.append(b)
        elif op == '>=': A_ub.append([-v for v in a]); b_ub.append(-b)
        else: A_eq.append(a); b_eq.append(b)
    sg = -1 if sense == 'max' else 1
    ref = linprog([sg * v for v in c], A_ub=A_ub or None, b_ub=b_ub or None, A_eq=A_eq or None, b_eq=b_eq or None, bounds=(0, None), method='highs')
    return ref, sg


def lp_solve(sense, c, rows):
    """rows: [(a, op, b)]. Returns the engine's solution and sensitivity; asserts scipy finds the same optimum and that every
    shadow price equals the change of the optimum when its right-hand side moves (re-solved by scipy)."""
    model = {'sense': sense, 'c': c, 'rows': [{'a': a, 'op': op, 'b': b} for a, op, b in rows]}
    out = subprocess.run(['node', os.path.join(HERE, 'lpnode.cjs')], input=json.dumps({'models': [model]}), capture_output=True, text=True, check=True)
    r = json.loads(out.stdout)[0]
    ref, sg = _scipy(sense, c, rows)
    if r['status'] != 'optimal':
        assert ref.status != 0, 'engine and scipy disagree on feasibility'
        return r
    assert ref.status == 0 and abs(sg * ref.fun - r['obj']) < 1e-6 * max(1, abs(r['obj'])), f'engine {r["obj"]} vs scipy {sg * ref.fun}'
    for k, row in enumerate(r['rows']):
        if row['inc'] > 1e-6 and row['shadow'] != 0:
            step = min(1, row['inc'] / 2)
            rows2 = [list(x) for x in rows]
            rows2[k][2] += step
            ref2, _ = _scipy(sense, c, rows2)
            d = (sg * ref2.fun - r['obj']) / step
            assert abs(d - row['shadow']) < 1e-6, f'shadow price of row {k}: engine {row["shadow"]} vs re-solve {d}'
    return r


def n(v, d=2):
    """A number written the way the lessons write it: 1,234.5 (trailing zeros trimmed), with a true minus sign."""
    s = f'{round(v, d):,.{d}f}'
    if '.' in s: s = s.rstrip('0').rstrip('.')
    return s.replace('-', '−')


def usd(v, d=2):
    return '\\$' + n(v, d)


# ---------------------------------------------------------------- the normal table of the paper (Appendices 1 and 2)
def Phi(z):
    return 0.5 * (1 + math.erf(z / math.sqrt(2)))


def ztable(z):
    """The cumulative probability the paper's table prints for z (two decimals), to four places."""
    return round(Phi(round(z, 2)) + 1e-12, 4)


def z_from_table(p):
    """The z (two decimals) whose printed entry is closest to p: how the table is read backwards."""
    best = min((abs(ztable(k / 100) - p), k) for k in range(-300, 301))
    return best[1] / 100


def code(lang, text, caption=None):
    b = {'type': 'code', 'lang': lang, 'code': text}
    if caption: b['caption'] = caption
    return b
