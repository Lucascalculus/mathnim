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
            if ref2.status != 0:
                continue   # moving this right-hand side makes the model infeasible (the engine's range is then one-sided): nothing to compare
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


def ptxt(en, zh):
    """A multi-line text of the paper as one T per line (money signs escaped); both languages must have the same lines."""
    a, b = en.split('\n'), zh.split('\n')
    assert len(a) == len(b), 'paper text: the two languages differ in line count'
    return [T(x.replace('$', '\\$'), y.replace('$', '\\$')) for x, y in zip(a, b)]


def roll(node, sense='max'):
    """Fill in node['v'] (expected value) and, for decision nodes, node['best'] (index of the chosen branch)."""
    if node['k'] == 'leaf':
        node['v'] = node['value']
        return node['v']
    vals = [roll(c, sense) for c in node['c']]
    if node['k'] == 'chance':
        node['v'] = sum(c['p'] * v for c, v in zip(node['c'], vals))
    else:
        node['best'] = min(range(len(vals)), key=lambda i: (-vals[i] if sense == 'max' else vals[i]))
        node['v'] = vals[node['best']]
    return node['v']


def tree_svg(tree, lang='en', sense='max', show_ev=False, unit='', dp=2, colw=150):
    """A decision tree drawn as the exam wants it: squares for decisions, circles for chance, probabilities on the branches,
    payoffs at the ends (and, when show_ev, the expected value above each node, the rejected branches struck through)."""
    roll(tree, sense)
    leaves = []

    def depth(n): return 0 if n['k'] == 'leaf' else 1 + max(depth(c) for c in n['c'])

    def place(n, d):
        n['x'] = d
        if n['k'] == 'leaf':
            n['y'] = len(leaves); leaves.append(n)
        else:
            for c in n['c']: place(c, d + 1)
            n['y'] = sum(c['y'] for c in n['c']) / len(n['c'])
    place(tree, 0)
    D, dy, X0 = depth(tree), 36, 26
    W, H = X0 + D * colw + 92, len(leaves) * dy + 30
    pick = lambda x: x[lang] if isinstance(x, dict) else x
    fmtv = lambda v: f'{unit}{v:,.{dp}f}'.rstrip('0').rstrip('.') if dp else f'{unit}{v:,.0f}'
    out = []

    def X(n): return X0 + n['x'] * colw
    def Y(n): return 18 + n['y'] * dy + dy / 2

    def draw(n, struck=False):
        if n['k'] != 'leaf':
            for i, c in enumerate(n['c']):
                bad = struck or (n['k'] == 'decision' and show_ev and i != n['best'])
                col = '#b8bcc2' if bad else '#1f2328'
                x1, y1, x2, y2 = X(n) + 11, Y(n), X(c) - (11 if c['k'] != 'leaf' else 4), Y(c)
                out.append(f'<polyline points="{x1:.1f},{y1:.1f} {(x1 + x2) / 2:.1f},{y2:.1f} {x2:.1f},{y2:.1f}" fill="none" stroke="{col}" stroke-width="1.8"/>')
                lab = pick(c.get('e', '')) if c.get('e') else ''
                if n['k'] == 'chance' and c.get('p') is not None: lab = (lab + ' ' if lab else '') + f'{c["p"]:g}'
                if lab: out.append(f'<text x="{x2 - (13 if c["k"] != "leaf" else 6):.1f}" y="{y2 - 5:.1f}" font-size="14" text-anchor="end" fill="{"#9aa0a6" if bad else "#1f2328"}" stroke="#fff" stroke-width="4" paint-order="stroke" stroke-linejoin="round">{lab}</text>')
                if bad and n['k'] == 'decision':
                    mx = x1 + 22
                    out.append(f'<line x1="{mx - 5:.1f}" y1="{y2 - 6:.1f}" x2="{mx + 5:.1f}" y2="{y2 + 6:.1f}" stroke="#c2412d" stroke-width="2"/><line x1="{mx - 5:.1f}" y1="{y2 + 6:.1f}" x2="{mx + 5:.1f}" y2="{y2 - 6:.1f}" stroke="#c2412d" stroke-width="2"/>')
                draw(c, bad)
            shape = (f'<rect x="{X(n) - 11:.1f}" y="{Y(n) - 11:.1f}" width="22" height="22" fill="#fff" stroke="#1f2328" stroke-width="2"/>' if n['k'] == 'decision'
                     else f'<circle cx="{X(n):.1f}" cy="{Y(n):.1f}" r="11" fill="#fff" stroke="#1f2328" stroke-width="2"/>')
            out.append(shape)
            if show_ev: out.append(f'<text x="{X(n):.1f}" y="{Y(n) - 16:.1f}" font-size="14" font-weight="600" fill="#2f5bd3" text-anchor="middle">{fmtv(n["v"])}</text>')
            if n.get('l') and n is tree or n.get('tag'): out.append(f'<text x="{X(n):.1f}" y="{Y(n) + 27:.1f}" font-size="13" fill="#6b7077" text-anchor="middle">{pick(n.get("tag", n.get("l", "")))}</text>')
        else:
            out.append(f'<text x="{X(n):.1f}" y="{Y(n) + 4.5:.1f}" font-size="15" font-weight="600" fill="{"#9aa0a6" if struck else "#1f2328"}">{fmtv(n["value"])}</text>')
    draw(tree)
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W} {H}" font-family="sans-serif"><rect width="{W}" height="{H}" fill="#ffffff"/>' + ''.join(out) + '</svg>')


def code(lang, text, caption=None):
    b = {'type': 'code', 'lang': lang, 'code': text}
    if caption: b['caption'] = caption
    return b
