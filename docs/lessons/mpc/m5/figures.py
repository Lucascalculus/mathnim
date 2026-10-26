"""M5's static figures, as SVG in both languages: apps/mathnim/public/mpc/m5/<name>.<lang>.svg.

- structure: the matrix a Newton step factors, for the cart MPC with N = 10,
  condensed (inputs only: dense) vs sparse (states and inputs, stage by stage:
  banded). Computed here with numpy, no measurement.
- time_vs_n: solve time per QP against the horizon N, measured by bench.py
  (bench.json): median over samples 1..89 of a 90-sample closed loop, bar to
  the worst sample.
- iters: iterations per sample over the N = 20 closed loop (bench.json).

Run:  python3 docs/lessons/mpc/m5/figures.py
"""
import html
import json
import math
import pathlib

import numpy as np

HERE = pathlib.Path(__file__).resolve().parent
ROOT = HERE.parents[3]
OUT = ROOT / 'apps' / 'mathnim' / 'public' / 'mpc' / 'm5'
B = json.loads((HERE / 'bench.json').read_text())
C = {'ink': '#111113', 'muted': '#86868B', 'faint': '#E6E6EA', 'accent': '#2563EB', 'gold': '#B8860B', 'coral': '#E4572E',
     'good': '#1F8A5B', 'purple': '#7C3AED', 'teal': '#0D9488', 'bg': '#FFFFFF'}
FONT = "-apple-system, 'PingFang SC', 'Noto Sans SC', 'Helvetica Neue', Arial, sans-serif"
MIN_FONT = 15
W = 720


def esc(s):
    return html.escape(str(s))


def T(x, y, s, size=16, color=C['ink'], anchor='start', weight=400, rotate=None):
    size = max(MIN_FONT, size)
    rot = f' transform="rotate({rotate} {x:.1f} {y:.1f})"' if rotate is not None else ''
    return f'<text x="{x:.1f}" y="{y:.1f}" font-size="{size}" fill="{color}" text-anchor="{anchor}" font-weight="{weight}"{rot}>{esc(s)}</text>'


def text_w(s, size):
    return sum(size if ord(ch) > 0x2e80 else 0.55 * size for ch in str(s))


def wrap(s, size, width):
    import re
    out, cur = [], ''
    for t in re.findall(r'[⺀-￿]|\S+\s*|\s+', str(s)):
        if cur and text_w(cur + t, size) > width:
            out.append(cur.rstrip())
            cur = t.lstrip()
        else:
            cur += t
    if cur.strip():
        out.append(cur.rstrip())
    return out


def para(x, y, s, size, color, width, weight=400):
    lh = round(max(MIN_FONT, size) * 1.35)
    parts = []
    for line in wrap(s, max(MIN_FONT, size), width):
        parts.append(T(x, y, line, size, color, weight=weight))
        y += lh
    return parts, y


def R(x, y, w, h, fill, rx=0, stroke='none', sw=0, op=1):
    return f'<rect x="{x:.1f}" y="{y:.1f}" width="{max(0, w):.1f}" height="{max(0, h):.1f}" rx="{rx}" fill="{fill}" fill-opacity="{op}" stroke="{stroke}" stroke-width="{sw}"/>'


def L(x0, y0, x1, y1, color, sw=1.5, dash=None):
    d = f' stroke-dasharray="{dash}"' if dash else ''
    return f'<line x1="{x0:.1f}" y1="{y0:.1f}" x2="{x1:.1f}" y2="{y1:.1f}" stroke="{color}" stroke-width="{sw}"{d}/>'


def PL(pts, color, sw=2.5, dash=None):
    d = f' stroke-dasharray="{dash}"' if dash else ''
    return f'<polyline points="{" ".join(f"{x:.1f},{y:.1f}" for x, y in pts)}" fill="none" stroke="{color}" stroke-width="{sw}" stroke-linejoin="round"{d}/>'


def dot(x, y, color, r=4, hollow=False):
    if hollow:
        return f'<circle cx="{x:.1f}" cy="{y:.1f}" r="{r}" fill="{C["bg"]}" stroke="{color}" stroke-width="2"/>'
    return f'<circle cx="{x:.1f}" cy="{y:.1f}" r="{r}" fill="{color}"/>'


def svg(w, h, parts):
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {w} {h:.0f}" width="{w}" height="{h:.0f}" font-family="{FONT}">'
            f'<rect width="{w}" height="{h:.0f}" fill="{C["bg"]}"/>' + ''.join(parts) + '</svg>\n')


def write(name, lang, content):
    p = OUT / f'{name}.{lang}.svg'
    p.parent.mkdir(parents=True, exist_ok=True)
    p.write_text(content, encoding='utf-8')
    print('wrote', p.relative_to(ROOT))


def title(parts, s):
    tp, y = para(20, 32, s, 19, C['ink'], W - 40, 600)
    parts += tp
    return y


# ------------------------------------------------------------------ the matrices
DT, N_SPY = 0.1, 10
A = np.array([[1, DT], [0, 1]])
Bm = np.array([[DT * DT / 2], [DT]])


def newton_matrices(N):
    """Nonzero patterns of the matrix one interior-point (Newton) step factors."""
    n, m = 2, 1
    # condensed: H + G' D G with G the dense input-to-state rows (lower triangular blocks)
    Gam = np.zeros((N * n, N * m))
    for k in range(N):
        for j in range(k + 1):
            Gam[k * n:(k + 1) * n, j] = (np.linalg.matrix_power(A, k - j) @ Bm).ravel()
    Hc = Gam.T @ Gam + np.eye(N)            # any positive weights give the same pattern
    cond = np.abs(Hc) > 1e-12
    # sparse: variables stage by stage (u0, x1, u1, x2, ...), dynamics as equalities: KKT [[P + D, Aeq'], [Aeq, 0]]
    nv = N * (n + m)
    order_u = [k * (n + m) for k in range(N)]
    order_x = [[k * (n + m) + 1, k * (n + m) + 2] for k in range(N)]
    Aeq = np.zeros((N * n, nv))
    for k in range(N):
        r = slice(k * n, (k + 1) * n)
        Aeq[r, order_x[k]] = np.eye(n)
        Aeq[r, order_u[k]] = -Bm.ravel()
        if k > 0:
            Aeq[r, order_x[k - 1]] = -A
    Pd = np.eye(nv)
    # interleave each stage's equality rows right after its variables, so the band shows
    blocks = []
    for k in range(N):
        blocks += [('v', order_u[k]), ('v', order_x[k][0]), ('v', order_x[k][1]), ('e', k * n), ('e', k * n + 1)]
    K = np.zeros((nv + N * n, nv + N * n))
    K[:nv, :nv] = Pd
    K[:nv, nv:] = Aeq.T
    K[nv:, :nv] = Aeq
    idx = [i if kind == 'v' else nv + i for kind, i in blocks]
    Ks = np.abs(K[np.ix_(idx, idx)]) > 1e-12
    return cond, Ks


def fig_structure():
    cond, sparse = newton_matrices(N_SPY)
    nnz_c, nnz_s = int(cond.sum()), int(sparse.sum())
    S = {
        'en': dict(title=f'What one Newton step has to factor (cart MPC, N = {N_SPY})',
                   c=f'condensed: {cond.shape[0]} × {cond.shape[0]}, every entry nonzero', c2='inputs only; x eliminated',
                   s=f'sparse: {sparse.shape[0]} × {sparse.shape[0]}, {nnz_s} nonzeros', s2='states and inputs, stage by stage',
                   foot=f'Each square is one matrix entry; filled = nonzero. Condensed: much smaller but dense, and factoring a dense m·N × m·N matrix costs about (mN)³. '
                        f'Sparse: bigger but banded (each stage only touches its neighbours), so a structured factorization costs about N·(n + m)³. '
                        f'Computed for the course cart (n = 2, m = 1); not a measurement.'),
        'zh': dict(title=f'一次牛顿步要分解的矩阵（小车 MPC，N = {N_SPY}）',
                   c=f'稠密形式（condensed）：{cond.shape[0]} × {cond.shape[0]}，全部非零', c2='只留输入，x 被消掉',
                   s=f'稀疏形式（sparse）：{sparse.shape[0]} × {sparse.shape[0]}，{nnz_s} 个非零', s2='状态和输入都保留，按时间步排',
                   foot=f'每个小方块是矩阵的一个元素，涂色表示非零。稠密形式：尺寸小，但处处非零；分解一个 mN × mN 的稠密矩阵约需 (mN)³ 次运算。'
                        f'稀疏形式：尺寸大，但呈带状（每一步只和相邻的步有关），按结构分解约需 N·(n + m)³。按课程小车（n = 2，m = 1）算出，不是测量值。'),
    }
    for lang, s in S.items():
        parts = []
        y = title(parts, s['title']) + 8
        size = 300
        # condensed, drawn at the same cell size as the sparse one, so the sizes compare honestly
        ns = sparse.shape[0]
        cell = size / ns
        xc, xs = 40, 360
        top = y + 54
        parts.append(T(xc, y + 14, s['c'], 15, C['coral'], weight=600))
        parts.append(T(xc, y + 36, s['c2'], 15, C['muted']))
        parts.append(T(xs, y + 14, s['s'], 15, C['teal'], weight=600))
        parts.append(T(xs, y + 36, s['s2'], 15, C['muted']))
        nc = cond.shape[0]
        parts.append(R(xc, top, nc * cell, nc * cell, C['bg'], 0, C['muted'], 1))
        for i in range(nc):
            for j in range(nc):
                if cond[i, j]:
                    parts.append(R(xc + j * cell + 0.5, top + i * cell + 0.5, cell - 1, cell - 1, C['coral']))
        parts.append(R(xs, top, ns * cell, ns * cell, C['bg'], 0, C['muted'], 1))
        for i in range(ns):
            for j in range(ns):
                if sparse[i, j]:
                    parts.append(R(xs + j * cell + 0.5, top + i * cell + 0.5, cell - 1, cell - 1, C['teal']))
        fp, yend = para(20, top + size + 34, s['foot'], 15, C['muted'], W - 40)
        write('structure', lang, svg(W, yend, parts + fp))
    return nnz_c, nnz_s


# ------------------------------------------------------------------ time against N
SERIES = [
    ('clarabel_condensed', C['coral'], None, {'en': 'interior point, condensed', 'zh': '内点法，稠密形式'}),
    ('clarabel_sparse', C['teal'], None, {'en': 'interior point, sparse', 'zh': '内点法，稀疏形式'}),
    ('osqp_sparse_cold', C['good'], '6 4', {'en': 'ADMM (OSQP), sparse, cold start', 'zh': 'ADMM（OSQP）稀疏，冷启动'}),
    ('osqp_sparse_shift', C['good'], None, {'en': 'ADMM (OSQP), sparse, warm start', 'zh': 'ADMM（OSQP）稀疏，热启动'}),
]


def fig_time():
    Ns = sorted(int(k) for k in B['timing'])
    S = {
        'en': dict(title='Time to solve one QP against the horizon N (measured)', x='horizon N (samples)', y='time per QP',
                   budget='the whole sample: Δt = 100 ms',
                   foot=('Measured by docs/lessons/mpc/m5/bench.py on an Apple M4 laptop (Python 3.12, OSQP 1.1.1 at its default accuracy 1e-3, '
                         'Clarabel 0.11.1): the course cart docking from rest, 90 samples of closed loop. Dot: median over samples 1–89; bar: up to the worst sample. '
                         'Warm start: from the previous plan, shifted one step. Condensed interior point was not run beyond N = 160. '
                         'Your machine will differ; the slopes are what carries over.')),
        'zh': dict(title='解一次 QP 的时间随预测步数 N 的变化（实测）', x='预测步数 N', y='每次 QP 用时',
                   budget='整个采样周期：Δt = 100 ms',
                   foot=('由 docs/lessons/mpc/m5/bench.py 在一台 Apple M4 笔记本上测得（Python 3.12；OSQP 1.1.1，默认精度 1e-3；Clarabel 0.11.1）：'
                         '课程里的小车从静止出发靠墙停车，闭环跑 90 个采样。圆点：第 1–89 个采样的中位数；竖线：一直到最慢的那个采样。'
                         '热启动：从上一个计划平移一步出发。稠密形式的内点法在 N > 160 时没有跑。换一台机器数字会变，能带走的是斜率。')),
    }
    for lang, s in S.items():
        parts = []
        y = title(parts, s['title'])
        x0, x1, y0, y1 = 96, 440, y + 24, y + 384
        lx0, lx1 = math.log10(15), math.log10(400)
        ly0, ly1 = 1, 6   # 10 µs .. 1 s
        X = lambda N: x0 + (math.log10(N) - lx0) / (lx1 - lx0) * (x1 - x0)
        Y = lambda t: y1 - (math.log10(t * 1e6) - ly0) / (ly1 - ly0) * (y1 - y0)
        for e in range(ly0, ly1 + 1):
            yy = Y(10 ** e / 1e6)
            parts.append(L(x0, yy, x1, yy, C['faint'], 1))
            lab = {1: '10 µs', 2: '100 µs', 3: '1 ms', 4: '10 ms', 5: '100 ms', 6: '1 s'}[e]
            parts.append(T(x0 - 8, yy + 5, lab, 15, C['ink'], 'end'))
        for N in [20, 40, 80, 160, 320]:
            parts.append(L(X(N), y1, X(N), y1 + 5, C['muted'], 1))
            parts.append(T(X(N), y1 + 22, str(N), 15, C['ink'], 'middle'))
        parts.append(L(x0, y0, x0, y1, C['muted'], 1))
        parts.append(L(x0, y1, x1, y1, C['muted'], 1))
        parts.append(T((x0 + x1) / 2, y1 + 46, s['x'], 15, C['ink'], 'middle'))
        parts.append(T(24, (y0 + y1) / 2, s['y'], 15, C['ink'], 'middle', rotate=-90))
        # the budget
        yb = Y(0.1)
        parts.append(L(x0, yb, x1, yb, C['coral'], 2, '8 5'))
        parts.append(T(x0 + 8, yb - 8, s['budget'], 15, C['coral']))
        legend_y = y0 + 10
        for name, col, dash, lab in SERIES:
            pts, bars = [], []
            for N in Ns:
                r = B['timing'][str(N)].get(name)
                if not r:
                    continue
                pts.append((X(N), Y(r['median'])))
                bars.append((X(N), Y(r['median']), Y(r['max'])))
            for (bx, by, bm) in bars:
                parts.append(L(bx, by, bx, bm, col, 1.5))
            parts.append(PL(pts, col, 2.5, dash))
            for (px, py) in pts:
                parts.append(dot(px, py, col, 4, hollow=dash is not None))
            # legend on the right
            parts.append(L(462, legend_y, 492, legend_y, col, 2.5, dash))
            parts.append(dot(477, legend_y, col, 4, hollow=dash is not None))
            lines = wrap(lab[lang], 15, W - 540)
            for i, ln in enumerate(lines):
                parts.append(T(500, legend_y + 5 + i * 19, ln, 15, col))
            legend_y += 22 + 19 * len(lines)
        fp, yend = para(20, y1 + 78, s['foot'], 15, C['muted'], W - 40)
        write('time-vs-n', lang, svg(W, yend, parts + fp))


# ------------------------------------------------------------------ iterations per sample
def fig_iters():
    ps = B['per_sample']
    S = {
        'en': dict(title='Iterations per sample over one closed-loop run (N = 20, measured)', x='sample k (Δt = 0.1 s)', y='iterations',
                   names={'osqp_cold': 'ADMM, cold start', 'osqp_shift': 'ADMM, warm start (shifted plan)', 'clarabel': 'interior point'},
                   foot=('Same run as above (bench.json). Totals over the 90 samples: ADMM cold {c}, warm {w}, interior point {i}. '
                         'The interior point needs about 10 iterations whatever happens, but each one factors a new matrix; '
                         'ADMM\'s iterations are cheap (one matrix, factored once), and warm-started it needs far fewer. '
                         'Sample 0 has no previous plan, so every method starts cold there.')),
        'zh': dict(title='闭环运行中每个采样的迭代次数（N = 20，实测）', x='采样 k（Δt = 0.1 s）', y='迭代次数',
                   names={'osqp_cold': 'ADMM，冷启动', 'osqp_shift': 'ADMM，热启动（平移后的计划）', 'clarabel': '内点法'},
                   foot=('与上图同一组运行（bench.json）。90 个采样的总迭代数：ADMM 冷启动 {c}，热启动 {w}，内点法 {i}。'
                         '内点法不管发生什么都要 10 次左右，但每次都要分解一个新矩阵；ADMM 每次迭代很便宜（同一个矩阵，只分解一次），'
                         '热启动后次数又少得多。第 0 个采样没有上一个计划，所以三种方法都是冷启动。')),
    }
    tot = {k: sum(ps[k]) for k in ['osqp_cold', 'osqp_shift', 'clarabel']}
    for lang, s in S.items():
        parts = []
        y = title(parts, s['title'])
        x0, x1, y0, y1 = 70, 690, y + 64, y + 304
        ymax = 650
        X = lambda k: x0 + k / 89 * (x1 - x0)
        Y = lambda v: y1 - v / ymax * (y1 - y0)
        for v in range(0, ymax + 1, 100):
            parts.append(L(x0, Y(v), x1, Y(v), C['faint'], 1))
            parts.append(T(x0 - 8, Y(v) + 5, str(v), 15, C['ink'], 'end'))
        for k in range(0, 90, 10):
            parts.append(T(X(k), y1 + 22, str(k), 15, C['ink'], 'middle'))
        parts.append(L(x0, y1, x1, y1, C['muted'], 1))
        parts.append(T((x0 + x1) / 2, y1 + 46, s['x'], 15, C['ink'], 'middle'))
        parts.append(T(22, (y0 + y1) / 2, s['y'], 15, C['ink'], 'middle', rotate=-90))
        series = [('osqp_cold', C['good'], '6 4'), ('osqp_shift', C['good'], None), ('clarabel', C['teal'], None)]
        lx = x0
        for name, col, dash in series:
            parts.append(PL([(X(k), Y(v)) for k, v in enumerate(ps[name])], col, 2.2, dash))
            lab = s['names'][name]
            parts.append(L(lx, y + 26, lx + 28, y + 26, col, 2.5, dash))
            parts.append(T(lx + 36, y + 31, lab, 15, col))
            lx += 36 + text_w(lab, 15) + 28
        fp, yend = para(20, y1 + 78, s['foot'].format(c=tot['osqp_cold'], w=tot['osqp_shift'], i=tot['clarabel']), 15, C['muted'], W - 40)
        write('iters', lang, svg(W, yend, parts + fp))
    return tot


if __name__ == '__main__':
    print('structure nnz', fig_structure())
    fig_time()
    print('iteration totals', fig_iters())
