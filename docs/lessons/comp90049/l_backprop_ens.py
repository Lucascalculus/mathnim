# COMP90049 lessons `backprop` (deck 15) and `ensembles` (deck 16); the plan is in README.md here, the coverage
# table in coverage/backprop_ens.md. Every number of a worked example is computed below, never typed by hand.
import copy
import math
import re
from math import comb

from ml_kit import *  # noqa: F403

# ---------------------------------------------------------------- numbers: the filled-in helper
V = {}


def fill(s):
    """Replace @name@ by the number V[name], so every worked value comes from the computations below."""
    return re.sub(r'@(\w+)@', lambda m: V[m.group(1)], s)


def S(en, zh):
    return T(fill(en), fill(zh))


def X(tex):
    return fill(tex)


def f4(v):
    return f'{v:.4f}'


def sg(z):
    return 1 / (1 + math.exp(-z))


# ================================================================ BACKPROP: the worked network (2 - 2 - 2, sigmoid, E = 1/2 sum (y - a)^2)
BX = [1.0, 0.5]
BT1 = [[0.4, -0.2], [0.3, 0.6]]     # theta^(1)_jk: hidden unit j, input k
BT2 = [[0.5, -0.4], [0.2, 0.7]]     # theta^(2)_ij: output unit i, hidden unit j
BY = [1.0, 0.0]
ETA = 0.5


def bp_forward(t1, t2):
    z1 = [sum(t1[j][k] * BX[k] for k in range(2)) for j in range(2)]
    a1 = [sg(z) for z in z1]
    z2 = [sum(t2[i][j] * a1[j] for j in range(2)) for i in range(2)]
    a2 = [sg(z) for z in z2]
    return z1, a1, z2, a2


def bp_error(a2):
    return 0.5 * sum((BY[i] - a2[i]) ** 2 for i in range(2))


Z1, A1, Z2, A2 = bp_forward(BT1, BT2)
E0 = bp_error(A2)
D2 = [(BY[i] - A2[i]) * A2[i] * (1 - A2[i]) for i in range(2)]
D1 = [A1[j] * (1 - A1[j]) * sum(BT2[i][j] * D2[i] for i in range(2)) for j in range(2)]
DT2 = [[ETA * D2[i] * A1[j] for j in range(2)] for i in range(2)]
DT1 = [[ETA * D1[j] * BX[k] for k in range(2)] for j in range(2)]
NT2 = [[BT2[i][j] + DT2[i][j] for j in range(2)] for i in range(2)]
NT1 = [[BT1[j][k] + DT1[j][k] for k in range(2)] for j in range(2)]
E1 = bp_error(bp_forward(NT1, NT2)[3])
# gradient check: central finite difference of E on theta^(2)_11 against -delta a
_h = 1e-6
_up, _dn = copy.deepcopy(BT2), copy.deepcopy(BT2)
_up[0][0] += _h
_dn[0][0] -= _h
FD = (bp_error(bp_forward(BT1, _up)[3]) - bp_error(bp_forward(BT1, _dn)[3])) / (2 * _h)
BPG = -D2[0] * A1[0]

for j in range(2):
    V[f'z1_{j + 1}'], V[f'a1_{j + 1}'] = f4(Z1[j]), f4(A1[j])
    V[f'z2_{j + 1}'], V[f'a2_{j + 1}'] = f4(Z2[j]), f4(A2[j])
    V[f'd2_{j + 1}'], V[f'd1_{j + 1}'] = f4(D2[j]), f4(D1[j])
    V[f'gp1_{j + 1}'] = f4(A1[j] * (1 - A1[j]))
    V[f'gp2_{j + 1}'] = f4(A2[j] * (1 - A2[j]))
    V[f'e2_{j + 1}'] = f4(BY[j] - A2[j])
    for k in range(2):
        V[f't1_{j + 1}{k + 1}'], V[f'dt1_{j + 1}{k + 1}'], V[f'nt1_{j + 1}{k + 1}'] = f4(BT1[j][k]), f4(DT1[j][k]), f4(NT1[j][k])
        V[f't2_{j + 1}{k + 1}'], V[f'dt2_{j + 1}{k + 1}'], V[f'nt2_{j + 1}{k + 1}'] = f4(BT2[j][k]), f4(DT2[j][k]), f4(NT2[j][k])
V['E0'], V['E1'] = f4(E0), f4(E1)
V['fd'], V['bpg'] = f'{FD:.6f}', f'{BPG:.6f}'
V['hsum1'] = f4(sum(BT2[i][0] * D2[i] for i in range(2)))
V['hsum2'] = f4(sum(BT2[i][1] * D2[i] for i in range(2)))
V['ratio'] = f'{abs(D2[0]) / abs(D1[0]):.0f}'
assert E1 < E0

# the cost of one gradient: finite differences against backpropagation (W weights, one forward pass = W multiply-adds)
def cost_fd(w): return 2 * w * w        # two forward passes per weight
def cost_bp(w): return 3 * w            # forward W + backward deltas W + weight gradients W


W_MNIST = 784 * 100 + 100 + 100 * 10 + 10
for name, w in (('w8', 8), ('wm', W_MNIST), ('w1m', 10 ** 6), ('w1b', 10 ** 9)):
    V[name] = f'{w:,}'
    V[name + '_fd'] = f'{cost_fd(w):,}' if w < 10 ** 8 else f'{cost_fd(w):.1e}'.replace('e+', r' \times 10^{') + '}'
    V[name + '_bp'] = f'{cost_bp(w):,}' if w < 10 ** 8 else f'{cost_bp(w):.1e}'.replace('e+', r' \times 10^{') + '}'
    V[name + '_ratio'] = f'{cost_fd(w) / cost_bp(w):,.0f}'
V['w8_ratio'] = f'{cost_fd(8) / cost_bp(8):.1f}'

# learning-rate demonstration: f(theta) = theta^2, theta <- theta (1 - 2 eta), start at 3
def lr_path(eta, n=6):
    t, out = 3.0, [3.0]
    for _ in range(n):
        t = t - eta * 2 * t
        out.append(t)
    return out


LR = {0.1: lr_path(0.1), 0.9: lr_path(0.9), 1.1: lr_path(1.1)}

# exam numbers of the backprop lesson
Q1_Z = 0.5 * 0.4 + 1.0 * (-0.6)
Q1_A = sg(Q1_Z)
Q2_D = (1 - 0.8) * 0.8 * (1 - 0.8)
Q3_D = 0.5 * 0.5 * (0.4 * 0.1 + (-0.2) * 0.3)
Q4_NEW = 0.5 + 0.1 * Q2_D * 0.6


def tq(id, title, skill, prompt, key_points, model_answer, explain):
    """A free-text question; the exam is in English, so key points and the model answer are English in both languages."""
    return text_q(id, title, skill, prompt, [T(k, k) for k in key_points], T(model_answer, model_answer), explain)


# ---------------------------------------------------------------- backprop figures
def fig_net(lang, stage):
    """The 2-2-2 network: weights on the edges; stage 'full' adds forward values a (blue) and backward deltas (orange)."""
    f = Fig(800, 420, lang)
    xs = [110, 400, 680]
    ys = [115, 295]
    r = 40
    f.text(xs[0], 30, f.L('input', '输入'), 17, MUTED, 'middle')
    f.text(xs[1], 30, f.L('hidden', '隐藏'), 17, MUTED, 'middle')
    f.text(xs[2], 30, f.L('output', '输出'), 17, MUTED, 'middle')
    # edges first, then nodes on top; labels sit at 30% of the edge so they do not collide where edges cross
    for (x0, x1, W, name) in ((xs[0], xs[1], BT1, 'θ^{(1)}'), (xs[1], xs[2], BT2, 'θ^{(2)}')):
        for t in range(2):
            for s in range(2):
                f.line(x0 + r, ys[s], x1 - r, ys[t], '#9aa0a6', 1.8)
    for (x0, x1, W) in ((xs[0], xs[1], BT1), (xs[1], xs[2], BT2)):
        for t in range(2):
            for s in range(2):
                p = 0.3 if s == t else 0.3
                px = (x0 + r) + p * (x1 - x0 - 2 * r)
                py = ys[s] + p * (ys[t] - ys[s])
                f.rect(px - 27, py - 12, 54, 24, '#ffffff', None, 0, 4)
                f.text(px, py + 5, f'{W[t][s]:.1f}'.replace('-', '−'), 15, INK, 'middle')
    xin = [BX[0], BX[1]]
    for s in range(2):
        f.circle(xs[0], ys[s], r, SOFT, INK)
        f.text(xs[0], ys[s] + 5, f'x_{{{s + 1}}}={xin[s]:g}', 16, INK, 'middle')
    for j in range(2):
        f.circle(xs[1], ys[j], r, '#ffffff', INK)
        f.circle(xs[2], ys[j], r, '#ffffff', INK)
        if stage == 'full':
            f.text(xs[1], ys[j] + 5, f'{A1[j]:.3f}', 17, BLUE, 'middle', 'bold')
            f.text(xs[2], ys[j] + 5, f'{A2[j]:.3f}', 17, BLUE, 'middle', 'bold')
            ty = ys[j] - r - 10 if j == 0 else ys[j] + r + 22
            f.text(xs[1], ty, f'δ={D1[j]:+.4f}'.replace('-', '−'), 16, ORANGE, 'middle', 'bold')
            f.text(xs[2], ty, f'δ={D2[j]:+.4f}'.replace('-', '−'), 16, ORANGE, 'middle', 'bold')
        else:
            f.text(xs[1], ys[j] + 5, f'j={j + 1}', 17, MUTED, 'middle')
            f.text(xs[2], ys[j] + 5, f'i={j + 1}', 17, MUTED, 'middle')
        f.text(xs[2] + r + 12, ys[j] + 5, f'y={BY[j]:g}', 17, MUTED)
    if stage == 'full':
        f.text(120, 405, f.L('forward: a', '前向：a'), 17, BLUE, 'start', 'bold')
        f.text(330, 405, f.L('backward: δ', '反向：δ'), 17, ORANGE, 'start', 'bold')
        f.text(560, 405, f'E = {E0:.4f}', 17, INK, 'start', 'bold')
    return f.svg()


def fig_chain(lang):
    """The path from a weight to the error: one factor per arrow."""
    f = Fig(800, 330, lang)
    bw, bh = 96, 44
    xs = [20 + i * 126 for i in range(6)]

    def box(x, y, s, fill='#ffffff'):
        f.rect(x, y, bw, bh, fill, INK, 1.6, 8)
        f.text(x + bw / 2, y + 29, s, 18, INK, 'middle')

    def arrow(x, y, label, color=BLUE):
        f.line(x + bw + 2, y + bh / 2, x + 126 - 2, y + bh / 2, color, 2.2, None, True)
        f.text(x + bw + 15, y + bh + 24, label, 16, color, 'middle')

    y1, y2 = 40, 190
    f.text(20, 24, f.L('output weight', '输出层的权重'), 16, MUTED)
    for i, s in enumerate(['θ_{ij}', 'z_{i}', 'a_{i}', 'E']):
        box(xs[i], y1, s, SOFT if i in (0, 3) else '#ffffff')
    for i, lab in enumerate(['a_{j}', "g′(z_{i})", '−(y−a_{i})']):
        arrow(xs[i], y1, lab)
    f.text(20, 174, f.L('hidden weight', '隐藏层的权重'), 16, MUTED)
    for i, s in enumerate(['θ_{jk}', 'z_{j}', 'a_{j}', 'z_{i}', 'a_{i}', 'E']):
        box(xs[i], y2, s, SOFT if i in (0, 5) else '#ffffff')
    for i, lab in enumerate(['a_{k}', "g′(z_{j})", 'θ_{ij}', "g′(z_{i})", '−(y−a_{i})']):
        arrow(xs[i], y2, lab, ORANGE if i == 2 else BLUE)
    f.rect(xs[3] - 10, y2 - 12, xs[4] + bw - xs[3] + 20, bh + 24, 'none', ORANGE, 1.4, 10, '6 5')
    f.text((xs[3] + xs[4] + bw) / 2, y2 + bh + 52, f.L('summed over every output i', '对每个输出 i 求和'), 16, ORANGE, 'middle')
    return f.svg()


def _act_plot(kind):
    P = Plot(-4, 4, -1.4 if kind == 'g' else -0.15, 1.5 if kind == 'g' else 1.25)
    zt = [-4, -2, 0, 2, 4]
    P.axes('z', 'g(z)' if kind == 'g' else "g′(z)", zt, [-1, 0, 1] if kind == 'g' else [0, 0.25, 0.5, 1])
    return P


def fig_act(lang, kind):
    P = _act_plot(kind)
    L = (lambda en, zh: zh) if lang == 'zh' else (lambda en, zh: en)
    sig = lambda z: 1 / (1 + math.exp(-z))
    if kind == 'g':
        P.curve(sig, -4, 4, BLUE)
        P.curve(math.tanh, -4, 4, ORANGE)
        P.curve(lambda z: max(0, z), -4, 1.45, GREEN)
        P.seg((-4, 0), (0, 0), MUTED, 2.5, '7 5')
        P.seg((0, 0), (0, 1), MUTED, 2.5, '7 5')
        P.seg((0, 1), (4, 1), MUTED, 2.5, '7 5')
        P.text(-2.6, 0.3, 'σ', BLUE, 18, weight='bold')
        P.text(2.6, 1.0, 'tanh', ORANGE, 17, dx=0, dy=-26, weight='bold')
        P.text(1.45, 1.45, 'ReLU', GREEN, 17, dx=10, dy=0, weight='bold')
        P.text(-3.9, 0.0, L('step', '阶跃'), MUTED, 17, dx=0, dy=-28)
    else:
        d_sig = lambda z: sig(z) * (1 - sig(z))
        P.curve(d_sig, -4, 4, BLUE)
        P.curve(lambda z: 1 - math.tanh(z) ** 2, -4, 4, ORANGE)
        P.seg((0.03, 1), (4, 1), GREEN, 3)
        P.seg((-4, 0), (0, 0), GREEN, 3)
        P.seg((-4, 0), (4, 0), MUTED, 2, '7 5')
        P.text(1.0, 0.25, 'σ′ ≤ 0.25', BLUE, 17, dx=34, dy=0, weight='bold')
        P.text(0.0, 1.0, "tanh′ ≤ 1", ORANGE, 17, dx=-12, dy=-12, anchor='end', weight='bold')
        P.text(1.2, 1.0, "ReLU′", GREEN, 17, dx=10, dy=-12, weight='bold')
        P.text(-3.95, 0.0, L('step′ = 0', '阶跃′ = 0'), MUTED, 17, dx=0, dy=-12)
    return P.svg()


def fig_lr(lang):
    P = Plot(0, 6, -9, 10, right=100)
    P.axes('t', 'θ_t', [0, 2, 4, 6], [-8, -4, 0, 4, 8])
    P.seg((0, 0), (6, 0), MUTED, 1.5, '5 5')
    for eta, col in ((0.1, BLUE), (0.9, GREEN), (1.1, ORANGE)):
        ys = LR[eta]
        for t in range(6):
            P.seg((t, ys[t]), (t + 1, ys[t + 1]), col, 3)
        for t, v in enumerate(ys):
            P.dot(t, v, col, 4.5)
    L = (lambda en, zh: zh) if lang == 'zh' else (lambda en, zh: en)
    P.text(6, LR[0.1][6], 'η = 0.1', BLUE, 17, dx=10, dy=-14, weight='bold')
    P.text(6, LR[0.9][6], 'η = 0.9', GREEN, 17, dx=10, dy=18, weight='bold')
    P.text(6, LR[1.1][6], 'η = 1.1', ORANGE, 17, dx=10, dy=5, weight='bold')
    return P.svg()


# ================================================================ ENSEMBLES: numbers
def binom_err(n, e):
    """P(more than n/2 of n independent classifiers, each wrong with probability e, are wrong)."""
    return sum(comb(n, i) * e ** i * (1 - e) ** (n - i) for i in range(n // 2 + 1, n + 1))


def alpha_of(e):
    return 0.5 * math.log((1 - e) / e)


V['be25'] = f'{binom_err(25, 0.35):.4f}'
V['be3'] = f'{binom_err(3, 0.3):.3f}'
V['be3_a'] = f'{3 * 0.3 ** 2 * 0.7:.3f}'
V['be3_b'] = f'{0.3 ** 3:.3f}'
V['be5'] = f'{binom_err(5, 0.3):.4f}'
for n in (1, 3, 5, 11, 25, 101):
    V[f'bn{n}'] = f'{binom_err(n, 0.35):.3f}'
V['be25_45'] = f'{binom_err(25, 0.45):.3f}'
V['be25_55'] = f'{binom_err(25, 0.55):.3f}'
V['unique5'] = f'{1 - (1 - 1 / 5) ** 5:.4f}'
for n in (5, 10, 100, 1000, 10 ** 6):
    V[f'out{n}'] = f'{(1 - 1 / n) ** n:.4f}'
    V[f'in{n}'] = f'{1 - (1 - 1 / n) ** n:.4f}'
V['out_inf'], V['in_inf'] = f'{math.exp(-1):.4f}', f'{1 - math.exp(-1):.4f}'


def var_avg(rho, m, sigma2=1.0):
    return rho * sigma2 + (1 - rho) * sigma2 / m


for rho in (0, 0.3, 0.6, 1):
    for m in (1, 10, 100):
        V[f'var_{int(rho * 10)}_{m}'] = f'{var_avg(rho, m):.3f}'.rstrip('0').rstrip('.')
V['q_var'] = f'{var_avg(0.25, 10, 4.0):.2f}'
for e in (0.5, 0.4, 0.3, 0.2, 0.1, 0.01, 0.6):
    V[f'al_{int(round(e * 100))}'] = f'{alpha_of(e):.4f}'
V['al_neg'] = f'{alpha_of(0.6):.4f}'


def adaboost(xs, ys, rounds):
    """AdaBoost with threshold stumps on a 1-D axis; returns per-round records (weights, stump, error, alpha, Z, new weights)."""
    n = len(xs)
    w = [1 / n] * n
    out = []
    for _ in range(rounds):
        best = None
        for t in [x + 0.5 for x in range(0, max(xs))]:
            for sgn in (1, -1):
                pr = [sgn if x > t else -sgn for x in xs]
                e = sum(w[j] for j in range(n) if pr[j] != ys[j])
                if best is None or e < best[0] - 1e-12:
                    best = (e, t, sgn, pr)
        e, t, sgn, pr = best
        a = alpha_of(e)
        raw = [w[j] * math.exp(-a * ys[j] * pr[j]) for j in range(n)]
        z = sum(raw)
        nw = [v / z for v in raw]
        out.append(dict(w=w, t=t, sgn=sgn, pred=pr, eps=e, alpha=a, Z=z, new=nw))
        w = nw
    return out


AX = list(range(1, 11))
AY = [1, 1, 1, -1, -1, -1, -1, 1, 1, 1]
AR = adaboost(AX, AY, 3)
for r, rec in enumerate(AR, 1):
    V[f'eps{r}'], V[f'alpha{r}'], V[f'Z{r}'] = f4(rec['eps']), f4(rec['alpha']), f4(rec['Z'])
V['up1'] = f4(AR[0]['new'][-1])
V['dn1'] = f4(AR[0]['new'][0])
V['exp_up1'] = f4(math.exp(AR[0]['alpha']))
V['exp_dn1'] = f4(math.exp(-AR[0]['alpha']))
V['Zprod'] = f4(AR[0]['Z'] * AR[1]['Z'] * AR[2]['Z'])
V['prodbound'] = f4(math.prod(2 * math.sqrt(r['eps'] * (1 - r['eps'])) for r in AR))
FINAL = [sum(r['alpha'] * r['pred'][j] for r in AR) for j in range(10)]
assert all((FINAL[j] > 0) == (AY[j] > 0) for j in range(10))
for j in range(10):
    V[f'F{j + 1}'] = f'{FINAL[j]:+.3f}'.replace('-', '−')
assert abs(AR[0]['alpha'] - alpha_of(0.3)) < 1e-12 and abs(AR[0]['eps'] - 0.3) < 1e-12
V['Q_alpha'] = f4(alpha_of(0.2))
V['Q_up'] = f4(0.1 * math.exp(alpha_of(0.3)) / AR[0]['Z'])
V['deckvote_pos'], V['deckvote_neg'] = '2.5', '3.0'
V['deck_eps3'] = f'{1 / (1 + math.exp(6)):.4f}'


# ---------------------------------------------------------------- ensemble figures
def fig_vote(lang):
    P = Plot(0, 1, 0, 1, 680, 420, left=96, right=60)
    P.axes(*(('ε', 'ensemble') if lang == 'en' else ('ε', '集成')), [0, 0.5, 1], [0, 0.5, 1])
    P.seg((0, 0), (1, 1), BLUE, 3, '8 6')
    P.curve(lambda e: binom_err(25, e), 0, 1, ORANGE, 3.5, None, 100)
    P.seg((0.5, 0), (0.5, 1), MUTED, 1.5, '4 5')
    P.guide(0.35, binom_err(25, 0.35))
    P.dot(0.35, binom_err(25, 0.35), INK, 6)
    L = (lambda en, zh: zh) if lang == 'zh' else (lambda en, zh: en)
    P.text(0.35, 0.05, '0.35 → 0.06', INK, 16, dx=16, dy=-4)
    P.text(0.08, 0.3, L('identical', '完全相同'), BLUE, 17, weight='bold')
    P.text(0.62, 0.5, L('independent', '相互独立'), ORANGE, 17, dx=10, dy=0, weight='bold')
    return P.svg()


def fig_var(lang):
    P = Plot(1, 30, -0.12, 1.08, 680, 400, left=96, right=110)
    P.axes('M', 'Var/σ²', [1, 10, 20, 30], [0, 0.5, 1])
    for rho, col in ((1.0, MUTED), (0.6, PURPLE), (0.3, ORANGE), (0.0, BLUE)):
        P.curve(lambda m, rho=rho: var_avg(rho, m), 1, 30, col, 3.5, None, 120)
        P.text(30, var_avg(rho, 30), f'ρ = {rho:g}', col, 17, dx=10, dy=5, weight='bold')
    return P.svg()


def fig_stack(lang):
    f = Fig(800, 360, lang)
    bw, bh = 86, 42
    f.text(20, 26, f.L('level 0: train on blue, predict orange', '第 0 层：用蓝色训练，预测橙色'), 16, MUTED)
    for r in range(3):
        y = 50 + r * 62
        for c in range(3):
            held = (c == r)
            f.rect(30 + c * (bw + 6), y, bw, bh, '#fde4d3' if held else '#dbe5fb', ORANGE if held else BLUE, 1.8, 6)
            f.text(30 + c * (bw + 6) + bw / 2, y + 27, f.L('held out', '留出') if held else f.L('train', '训练'), 15, ORANGE if held else BLUE, 'middle')
        f.line(30 + 3 * (bw + 6), y + bh / 2, 400, y + bh / 2, ORANGE, 1.8, '6 5', True)
    f.text(30, 262, f.L('every model: K rounds', '每个模型：做 K 轮'), 16, MUTED)
    x0 = 412
    f.rect(x0, 50, 150, 3 * 62 - 20, '#fde4d3', ORANGE, 2, 8)
    f.text(x0 + 75, 100, f.L('out-of-fold', '折外预测'), 17, INK, 'middle', 'bold')
    f.text(x0 + 75, 128, 'ŷ_{C1}, ŷ_{C2}, ŷ_{C3}', 15, INK, 'middle')
    f.text(x0 + 75, 156, f.L('one row per', '每个训练'), 15, MUTED, 'middle')
    f.text(x0 + 75, 176, f.L('training instance', '实例一行'), 15, MUTED, 'middle')
    f.line(x0 + 150, 120, 612, 120, INK, 2.4, None, True)
    f.rect(620, 85, 160, 70, '#ffffff', INK, 2, 10)
    f.text(700, 114, f.L('level 1', '第 1 层'), 17, INK, 'middle', 'bold')
    f.text(700, 138, f.L('meta-classifier', '元分类器'), 16, INK, 'middle')
    return f.svg()


# ================================================================ LESSON 1: backprop
def L_backprop():
    SK = 'backprop.'
    why, act, delta, algo, eff, train = (SK + s for s in ('why', 'activations', 'delta', 'algorithm', 'efficiency', 'training'))
    return dict(
        id=lid('backprop'),
        title=T('Backpropagation: the gradient of every weight', '反向传播：求出每个权重的梯度'),
        description=T('Why gradient descent needs a gradient for every weight, the chain rule, the generalised delta rule derived line by line, a full numeric forward and backward pass, and why it is so cheap.',
                      '梯度下降为什么要每个权重的梯度；链式法则；逐行推出广义 delta 规则；一次完整的前向与反向数值计算；以及它为什么这么省。'),
        minutes=45,
        skills=[{'id': why, 'name': T('Why backpropagation: the gradient of every weight', '为什么要反向传播：每个权重的梯度')},
                {'id': act, 'name': T('Activation functions and their derivatives', '激活函数及其导数')},
                {'id': delta, 'name': T('The generalised delta rule', '广义 delta 规则')},
                {'id': algo, 'name': T('The backpropagation algorithm, traced numerically', '反向传播算法与数值演算')},
                {'id': eff, 'name': T('Why backpropagation is cheap', '反向传播为什么高效')},
                {'id': train, 'name': T('Learning rate, local minima, vanishing gradients, overfitting', '学习率、局部极小、梯度消失、过拟合')}],
        misconceptions=[{'id': 'hidden-has-target', 'description': T('Computing a hidden unit\'s error from the target y, as if hidden units had targets', '用目标 y 直接算隐藏单元的误差，好像隐藏单元有目标值')},
                        {'id': 'step-ok', 'description': T('Thinking the step function can be trained with backpropagation', '以为阶跃函数也能用反向传播训练')},
                        {'id': 'zero-init', 'description': T('Starting all weights at zero is harmless', '以为所有权重初始化为 0 没有问题')},
                        {'id': 'bp-is-optimiser', 'description': T('Treating backpropagation as the optimiser, instead of the way gradients are computed', '把反向传播当成优化器，而不是计算梯度的方法')}],
        steps=[
            read('why', T('What backpropagation is for', '反向传播是用来做什么的'),
                 p(T(r"Training a neural network is gradient descent: every weight moves a small step downhill, $\theta \leftarrow \theta - \eta\,\partial E/\partial\theta$. So **every weight needs its own gradient**, and a network has thousands to billions of them. Backpropagation is the way to get all of those gradients cheaply. It is **not** a learning algorithm of its own: it computes gradients, and gradient descent uses them.",
                     r"训练神经网络就是梯度下降：每个权重朝下坡方向走一小步，$\theta \leftarrow \theta - \eta\,\partial E/\partial\theta$。所以**每个权重都要有自己的梯度**，而网络有成千上万乃至数十亿个权重。反向传播（backpropagation）就是便宜地算出所有这些梯度的办法。它**不是**独立的学习算法：它负责算梯度，用梯度的是梯度下降。")),
                 p(T(r"The perceptron rule $\theta_i \leftarrow \theta_i + \eta\,y\,x_i$ needed the target $y$. In a multilayer network only the **output** layer has targets. A hidden unit has no \"correct activation\" to compare with. The trick is to take the error at the output and **send it backwards** through the network with the chain rule, so each hidden unit gets its share of the blame.",
                     r"感知机规则 $\theta_i \leftarrow \theta_i + \eta\,y\,x_i$ 要用到目标 $y$。多层网络里只有**输出层**有目标；隐藏单元没有“正确的激活值”可比。办法是：取输出处的误差，用链式法则**把它往回传**，让每个隐藏单元分到自己该担的那份。")),
                 h(T('Which loss goes with which output', '输出层和损失怎么配')),
                 table([T('Task', '任务'), T('Output activation $g$', '输出激活 $g$'), T('Loss', '损失')],
                       [T('binary classification', '二分类'), T(r"sigmoid $\frac{1}{1+e^{-z}}$", r"sigmoid $\frac{1}{1+e^{-z}}$"), T(r"binary cross-entropy $-[y\log\hat y + (1-y)\log(1-\hat y)]$", r"二元交叉熵 $-[y\log\hat y + (1-y)\log(1-\hat y)]$")],
                       [T('multiclass', '多分类'), T(r"softmax $\frac{e^{z_j}}{\sum_k e^{z_k}}$", r"softmax $\frac{e^{z_j}}{\sum_k e^{z_k}}$"), T(r"categorical cross-entropy $-\sum_k y_k\log\hat y_k$ (only the true class counts)", r"类别交叉熵 $-\sum_k y_k\log\hat y_k$（只有真实类别那项有作用）")],
                       [T('regression', '回归'), T(r"linear $g(z) = z$", r"线性 $g(z) = z$"), T(r"mean squared error $\frac1N\sum (y-\hat y)^2$", r"均方误差 $\frac1N\sum (y-\hat y)^2$")]),
                 p(T(r"The derivation below uses sigmoid units and the squared error $E = \frac12(y-a)^2$, exactly as the lecture does, because the algebra is shortest. The idea does not depend on that choice.",
                     r"下面的推导和课上一样，用 sigmoid 单元和平方误差 $E = \frac12(y-a)^2$，因为代数最短。思路并不依赖这个选择。")),
                 details(T('With cross-entropy the output error is even simpler', '换成交叉熵，输出层的误差更简单'),
                         p(T(r"For a sigmoid output $a = \sigma(z)$ and $E = -[y\ln a + (1-y)\ln(1-a)]$: $\frac{\partial E}{\partial a} = -\frac{y}{a} + \frac{1-y}{1-a} = \frac{a-y}{a(1-a)}$, and $\sigma'(z) = a(1-a)$. The chain rule multiplies them and the $a(1-a)$ cancels:",
                             r"sigmoid 输出 $a = \sigma(z)$，$E = -[y\ln a + (1-y)\ln(1-a)]$：$\frac{\partial E}{\partial a} = -\frac{y}{a} + \frac{1-y}{1-a} = \frac{a-y}{a(1-a)}$，而 $\sigma'(z) = a(1-a)$。链式法则一乘，$a(1-a)$ 抵消：")),
                         math_(r"\frac{\partial E}{\partial z} = \frac{a-y}{a(1-a)}\cdot a(1-a) = a - y"),
                         p(T(r"So $\delta = y - a$ with no $g'$ factor: a confidently wrong sigmoid output does not stall. Softmax with categorical cross-entropy gives the same $\hat y_k - y_k$.",
                             r"于是 $\delta = y - a$，没有 $g'$ 这一项：sigmoid 输出即使错得很自信，学习也不会卡住。softmax 加类别交叉熵同样得到 $\hat y_k - y_k$。"))),
                 chapter=T('Why backpropagation', '为什么要反向传播')),
            read('activations', T('Activation functions and their derivatives', '激活函数和它们的导数'),
                 p(T(r"Each unit applies a non-linear **activation function** $g$ to its weighted input $z$. Backpropagation will need $g'(z)$, the answer to one question: *if $z$ moves a little, how much does the output move?* A flat part of $g$ passes no signal back.",
                     r"每个单元对加权输入 $z$ 施加一个非线性的**激活函数**（activation function）$g$。反向传播要用到 $g'(z)$，它回答一个问题：*$z$ 动一点，输出动多少？* $g$ 平坦的地方，传不回任何信号。")),
                 table([T('Function', '函数'), T('Formula', '公式'), T('Derivative', '导数'), T('Notes', '说明')],
                       [T('sigmoid', 'sigmoid'), r"$\frac{1}{1+e^{-z}}$", r"$g(1-g) = a(1-a)$", T(r"output in $(0,1)$; $g' \le 0.25$", r"输出在 $(0,1)$；$g' \le 0.25$")],
                       [T('tanh', 'tanh'), r"$\frac{e^{2z}-1}{e^{2z}+1}$", r"$1 - a^2$", T(r"output in $(-1,1)$; $g' \le 1$: larger updates than sigmoid", r"输出在 $(-1,1)$；$g' \le 1$：更新比 sigmoid 大")],
                       [T('ReLU', 'ReLU'), r"$\max(0, z)$", r"$1$ if $z>0$, else $0$", T(r"not defined at 0 (set to 0 by convention); dead units help delete unneeded weights", r"在 0 处没有定义（约定取 0）；失活的单元有助于删去不需要的权重")],
                       [T('step', '阶跃'), r"$1$ if $z>0$, else $0$", r"$0$ (undefined at 0)", T('cannot be used for backpropagation', '不能用于反向传播')]),
                 p(T(r"The sigmoid and tanh derivatives are written with the activation $a$ the forward pass has already computed, so they cost nothing extra.",
                     r"sigmoid 和 tanh 的导数都能用前向时已经算好的激活值 $a$ 来写，所以几乎不花额外的计算。")),
                 svg(drawn(fig_act, 'g'), T('The four activation functions on one plot: the sigmoid rises from 0 to 1, tanh from -1 to 1, ReLU is 0 then a straight line, and the step jumps from 0 to 1.', '四个激活函数画在一张图上：sigmoid 从 0 升到 1，tanh 从 -1 升到 1，ReLU 先是 0 然后是一条直线，阶跃则在 0 处从 0 跳到 1。')),
                 svg(drawn(fig_act, 'dg'), T('The derivatives: the sigmoid derivative peaks at 0.25, tanh at 1, ReLU is 0 or 1, and the step has derivative 0 everywhere.', '导数：sigmoid 的导数最高 0.25，tanh 最高 1，ReLU 是 0 或 1，阶跃处处为 0。')),
                 details(T('Where $\\sigma\' = \\sigma(1-\\sigma)$ comes from', r"$\sigma' = \sigma(1-\sigma)$ 从哪来"),
                         math_(r"\sigma(z) = (1+e^{-z})^{-1}, \qquad \sigma'(z) = \frac{e^{-z}}{(1+e^{-z})^2}"),
                         math_(r"= \frac{1}{1+e^{-z}}\cdot\frac{e^{-z}}{1+e^{-z}} = \sigma(z)\,\bigl(1-\sigma(z)\bigr)"),
                         p(T(r"The last step: $\frac{e^{-z}}{1+e^{-z}} = 1 - \frac{1}{1+e^{-z}}$.", r"最后一步：$\frac{e^{-z}}{1+e^{-z}} = 1 - \frac{1}{1+e^{-z}}$。"))),
                 quiz(T('Why can a network of step-function units not be trained by backpropagation?', '为什么阶跃函数单元组成的网络不能用反向传播训练？'),
                      [(T(r"Its derivative is 0 wherever it is defined, so every $\delta$ and every update is 0", r"它有定义的地方导数全是 0，于是每个 $\delta$、每个更新都是 0"), True),
                       (T('Its output is not between 0 and 1', '它的输出不在 0 和 1 之间'), T(r"The step output is exactly 0 or 1. The problem is its slope, not its range.", r"阶跃的输出恰好是 0 或 1。问题出在它的斜率，不在取值范围。")),
                       (T('It is too slow to compute', '它算起来太慢'), T(r"The step is the cheapest function there is. What fails is that $g'(z) = 0$ passes no error backwards.", r"阶跃是最便宜的函数。失败的原因是 $g'(z) = 0$，什么误差也传不回去。"))],
                      T(r"Backpropagation multiplies by $g'(z)$ at every unit. With the step function that factor is 0 (and undefined at $z=0$), so the weights could never learn anything.",
                        r"反向传播在每个单元上都要乘 $g'(z)$。阶跃函数的这个因子是 0（在 $z=0$ 处还没有定义），权重什么也学不到。"))),
            read('chain', T('The chain rule on a network', '链式法则：沿着网络走'),
                 p(T(r"A weight changes the error only along a **path**: it changes $z$, which changes the activation $a$, which changes the next layer, and so on to $E$. The chain rule says the gradient is the **product of one small derivative per arrow**. Each arrow is easy to differentiate.",
                     r"一个权重只会沿着一条**路径**影响误差：它改变 $z$，$z$ 改变激活 $a$，$a$ 又改变下一层，一路到 $E$。链式法则说：梯度就是**路径上每条箭头的小导数连乘**。每一条箭头都很好求导。")),
                 svg(drawn(fig_chain), T('Two chains of arrows. The output weight theta_ij goes to z_i, a_i, E with factors a_j, g-prime of z_i and minus (y minus a_i). The hidden weight theta_jk goes to z_j, a_j, then through every output unit i, to E.', '两条箭头链。输出层权重 theta_ij 经 z_i、a_i 到 E，因子是 a_j、g 在 z_i 处的导数和 −(y−a_i)。隐藏层权重 theta_jk 经 z_j、a_j，再穿过每个输出单元 i，到 E。')),
                 p(T(r"The top chain is the output weight and has one path. The bottom chain is a hidden weight: its unit $j$ feeds **every** output unit $i$, so there are several paths and the chain rule **adds** their contributions. The shared tail (the arrows near $E$) is the same for all weights behind it. Backpropagation computes that tail once and reuses it.",
                     r"上面一条是输出层权重，只有一条路径。下面一条是隐藏层权重：它的单元 $j$ 喂给**每一个**输出单元 $i$，所以有好几条路径，链式法则把各条路径的贡献**加起来**。靠近 $E$ 的那一段（共同的尾巴）对它后面的所有权重都一样。反向传播把这个尾巴只算一次，反复使用。"))),
            derive('delta_out', T('Output layer: the delta rule, derived', '输出层：delta 规则的推导'),
                   [(r"\Delta\theta^{(2)}_{ij} = -\eta\,\frac{\partial E}{\partial \theta^{(2)}_{ij}}",
                     T(r"Gradient descent: move the weight from hidden unit $j$ to output unit $i$ against the slope of the error. The minus sign is \"downhill\", $\eta$ the step size.",
                       r"梯度下降：权重（隐藏单元 $j$ 到输出单元 $i$）逆着误差的斜率走。负号是“下坡”，$\eta$ 是步长。")),
                    (r"= -\eta\,\frac{\partial E}{\partial a_i}\,\frac{\partial a_i}{\partial z_i}\,\frac{\partial z_i}{\partial \theta^{(2)}_{ij}}",
                     T(r"Chain rule along the path $\theta \to z_i \to a_i \to E$: one factor per arrow.", r"沿路径 $\theta \to z_i \to a_i \to E$ 用链式法则：每条箭头一个因子。")),
                    (r"\frac{\partial E}{\partial a_i} = -(y - a_i)",
                     T(r"First factor. $E = \frac12 (y - a_i)^2$, so the 2 cancels the $\frac12$. The minus: raising $a_i$ above the target $y$ makes the error larger.", r"第一个因子。$E = \frac12 (y - a_i)^2$，2 抵消 $\frac12$。负号：把 $a_i$ 抬得离目标 $y$ 更远，误差就更大。")),
                    (r"\frac{\partial a_i}{\partial z_i} = g'(z_i)",
                     T(r"Second factor: $a_i = g(z_i)$, the slope of the activation function.", r"第二个因子：$a_i = g(z_i)$，激活函数的斜率。")),
                    (r"\frac{\partial z_i}{\partial \theta^{(2)}_{ij}} = a_j",
                     T(r"Third factor. $z_i = \sum_j \theta^{(2)}_{ij}\,a_j$ is a sum, and only the term with our weight changes: its coefficient is the input $a_j$.", r"第三个因子。$z_i = \sum_j \theta^{(2)}_{ij}\,a_j$ 是一个和，只有含这个权重的那一项会变，它的系数就是输入 $a_j$。")),
                    (r"\Delta\theta^{(2)}_{ij} = \eta\,(y - a_i)\,g'(z_i)\,a_j",
                     T(r"Multiply the three factors. The minus of the update and the minus of $-(y-a_i)$ cancel.", r"三个因子相乘。更新里的负号和 $-(y-a_i)$ 里的负号抵消。")),
                    (r"\delta_i = (y - a_i)\,g'(z_i), \qquad \Delta\theta^{(2)}_{ij} = \eta\,\delta_i\,a_j",
                     T(r"Name the first two factors the **error term** $\delta_i$. The update is the error term times the incoming activation. For a sigmoid, $g'(z_i) = a_i(1-a_i)$.", r"把前两个因子记作**误差项**（error term）$\delta_i$。更新量就是误差项乘以输入的激活。sigmoid 时 $g'(z_i) = a_i(1-a_i)$。"),
                     T(r"$\delta_i = -\partial E/\partial z_i$: how much the error would fall per unit increase of the unit's input. This is the deck's sign convention; many books define $\delta$ with the opposite sign and subtract.", r"$\delta_i = -\partial E/\partial z_i$：该单元的输入每增加一个单位，误差会降多少。这是课件的符号约定；不少书把 $\delta$ 定成相反的符号，更新时用减号。"))],
                   intro=T(r"Take the lecture's setting. Unit $i$ is in the output layer, fed by hidden units $j$; $z_i = \sum_j \theta^{(2)}_{ij}a_j$, $a_i = g(z_i)$ and $E = \frac12(y - a_i)^2$. The superscript on a weight names its layer.",
                           r"用课上的设定。单元 $i$ 在输出层，由隐藏单元 $j$ 供给；$z_i = \sum_j \theta^{(2)}_{ij}a_j$，$a_i = g(z_i)$，$E = \frac12(y - a_i)^2$。权重的上标表示它所在的层。"),
                   outro=T(r"This $\delta_i$ needs the target $y$, so it works **only for output units**. Hidden units have no target, and that is the next derivation.", r"这个 $\delta_i$ 用到了目标 $y$，所以**只适用于输出单元**。隐藏单元没有目标，这正是下一个推导要解决的。"),
                   skill=delta, chapter=T('The generalised delta rule', '广义 delta 规则')),
            derive('delta_hidden', T('Hidden layer: the error is sent back', '隐藏层：把误差传回来'),
                   [(r"\Delta\theta^{(1)}_{jk} = -\eta\,\frac{\partial E}{\partial \theta^{(1)}_{jk}}",
                     T(r"Same start, for a weight from input $k$ to hidden unit $j$.", r"起点相同，对象是输入 $k$ 到隐藏单元 $j$ 的权重。")),
                    (r"\frac{\partial E}{\partial \theta^{(1)}_{jk}} = \frac{\partial E}{\partial z_j}\,\frac{\partial z_j}{\partial \theta^{(1)}_{jk}}",
                     T(r"Cut the chain at $z_j$, the input of hidden unit $j$. The weight touches the error only through $z_j$.", r"在隐藏单元 $j$ 的输入 $z_j$ 处把链切开。这个权重只通过 $z_j$ 影响误差。")),
                    (r"\frac{\partial z_j}{\partial \theta^{(1)}_{jk}} = a_k",
                     T(r"The right factor is as before: $z_j = \sum_k \theta^{(1)}_{jk}a_k$, so the coefficient is the input $a_k$ (for the first hidden layer, $a_k = x_k$).", r"右边这个因子和之前一样：$z_j = \sum_k \theta^{(1)}_{jk}a_k$，系数就是输入 $a_k$（第一个隐藏层时 $a_k = x_k$）。")),
                    (r"\delta_j := -\frac{\partial E}{\partial z_j} \;\Rightarrow\; \Delta\theta^{(1)}_{jk} = \eta\,\delta_j\,a_k",
                     T(r"Define the hidden unit's error term the same way as the output's. The update then has **exactly the same form**: error term times incoming activation. All that is left is to find $\delta_j$.", r"用和输出层同样的方式定义隐藏单元的误差项。更新就有了**完全相同的形式**：误差项乘输入激活。剩下的事只是求 $\delta_j$。")),
                    (r"\frac{\partial E}{\partial z_j} = \sum_i \frac{\partial E}{\partial z_i}\,\frac{\partial z_i}{\partial z_j}",
                     T(r"$z_j$ reaches $E$ through **every** output unit $i$ that unit $j$ feeds. The chain rule with several paths adds one term per path.", r"$z_j$ 通过它喂给的**每一个**输出单元 $i$ 到达 $E$。多条路径的链式法则，每条路径加一项。")),
                    (r"\frac{\partial z_i}{\partial z_j} = \theta^{(2)}_{ij}\,g'(z_j)",
                     T(r"One arrow: $z_i = \sum_j \theta^{(2)}_{ij}\,g(z_j)$, so the dependence on $z_j$ is the connection weight times the slope of $g$ at $z_j$.", r"一条箭头：$z_i = \sum_j \theta^{(2)}_{ij}\,g(z_j)$，所以对 $z_j$ 的依赖就是连接权重乘上 $g$ 在 $z_j$ 处的斜率。")),
                    (r"\delta_j = g'(z_j)\,\sum_i \theta^{(2)}_{ij}\,\delta_i",
                     T(r"Substitute, with $\partial E/\partial z_i = -\delta_i$ (the minus signs cancel). **A hidden unit's error is the errors of the units it feeds, each weighted by the connection that carried the influence, times its own slope.**", r"代入，$\partial E/\partial z_i = -\delta_i$（负号抵消）。**隐藏单元的误差，就是它所喂的各单元的误差，按各自的连接权重加权求和，再乘上它自己的斜率。**"),
                     T(r"The $\delta_i$ were computed one layer earlier, so each one is reused by every unit that feeds it. This reuse is why backpropagation is cheap.", r"$\delta_i$ 在上一层已经算好，每一个都会被喂它的所有单元重复使用。反向传播便宜，就靠这种重复使用。")),
                    (r"\delta_j = 0.25 \times 0.5 \times 0.2 = 0.025",
                     T(r"A check with numbers: a hidden unit with $g'(z_j) = 0.25$ feeds a single output with $\theta^{(2)}_{ij} = 0.5$ and $\delta_i = 0.2$.", r"用数字验一下：一个隐藏单元 $g'(z_j) = 0.25$，只喂一个输出单元，$\theta^{(2)}_{ij} = 0.5$，$\delta_i = 0.2$。"))],
                   intro=T(r"Now a weight $\theta^{(1)}_{jk}$ one layer further back. Unit $j$ is hidden and feeds the output units $i$ through $\theta^{(2)}_{ij}$; unit $k$ is in the layer before.", r"现在看再往前一层的权重 $\theta^{(1)}_{jk}$。单元 $j$ 是隐藏单元，通过 $\theta^{(2)}_{ij}$ 喂给输出单元 $i$；单元 $k$ 在更前面一层。"),
                   outro=T(r"The error flows **backwards** along the same connections that carried the signal forward, multiplied by the same weights. That is why it is called backpropagation.", r"误差沿着前向传信号的**同一些连接往回流**，乘的也是同样的权重。这就是“反向传播”的由来。"),
                   blank=(7, '0.025', T(r"A hidden unit has $g'(z_j) = 0.25$ and feeds one output unit with $\theta^{(2)}_{ij} = 0.5$, $\delta_i = 0.2$. What is $\delta_j$?", r"隐藏单元 $g'(z_j) = 0.25$，只喂一个输出单元，$\theta^{(2)}_{ij} = 0.5$，$\delta_i = 0.2$。$\delta_j$ 是多少？")),
                   skill=delta),
            read('matrix', T('Any depth, in matrix form', '任意深度：矩阵形式'),
                 p(T(r"The two results are one rule applied layer after layer. With $\mathbf{z}^{(l)}$ the inputs of layer $l$, $\mathbf{a}^{(l)} = g(\mathbf{z}^{(l)})$, $W^{(l)}$ the weights into layer $l$ and $L$ the output layer:",
                     r"这两个结果其实是同一条规则，一层一层地用。设 $\mathbf{z}^{(l)}$ 是第 $l$ 层的输入，$\mathbf{a}^{(l)} = g(\mathbf{z}^{(l)})$，$W^{(l)}$ 是进入第 $l$ 层的权重，$L$ 是输出层：")),
                 math_(r"\boldsymbol{\delta}^{(L)} = (\mathbf{y} - \mathbf{a}^{(L)}) \odot g'(\mathbf{z}^{(L)})"),
                 math_(r"\boldsymbol{\delta}^{(l)} = g'(\mathbf{z}^{(l)}) \odot \bigl(W^{(l+1)}\bigr)^{\!\top}\boldsymbol{\delta}^{(l+1)}"),
                 math_(r"\Delta W^{(l)} = \eta\,\boldsymbol{\delta}^{(l)}\,\bigl(\mathbf{a}^{(l-1)}\bigr)^{\!\top}"),
                 p(T(r"Where the transpose comes from: the scalar sum $\sum_i \theta^{(2)}_{ij}\delta_i$ of the hidden derivation is the $j$-th entry of $W^\top\boldsymbol\delta$. The forward pass multiplies by $W$ (row $i$ collects the inputs of unit $i$); the backward pass multiplies by $W^\top$ (column $j$ collects the outputs of unit $j$). The **same weights, used in the opposite direction.** $\odot$ is the entry-by-entry product, because $g'$ acts on each unit separately.",
                     r"转置从哪来：隐藏层推导里的标量和 $\sum_i \theta^{(2)}_{ij}\delta_i$，正是 $W^\top\boldsymbol\delta$ 的第 $j$ 个分量。前向乘 $W$（第 $i$ 行汇集单元 $i$ 的输入）；反向乘 $W^\top$（第 $j$ 列汇集单元 $j$ 的输出）。**同样的权重，反方向使用。** $\odot$ 是逐项相乘，因为 $g'$ 对每个单元分别作用。")),
                 table([T('Compare', '对照'), T('Forward pass', '前向'), T('Backward pass', '反向')],
                       [T('direction', '方向'), T('input to output', '从输入到输出'), T('output to input', '从输出到输入')],
                       [T('carries', '传的是'), T(r"activations $\mathbf{a}$", r"激活 $\mathbf{a}$"), T(r"error terms $\boldsymbol\delta$", r"误差项 $\boldsymbol\delta$")],
                       [T('uses the weights as', '权重用作'), r"$W$", r"$W^\top$"],
                       [T('local factor', '本层因子'), r"$g$", r"$g'(\mathbf{z})$"]),
                 callout('note', T('Sign convention', '符号约定'), T(r"The deck defines $\delta = -\partial E/\partial z$ and adds the update. Books that define $\delta = +\partial E/\partial z$ subtract it instead. The recursion for $\boldsymbol\delta^{(l)}$ is the same in both, because it is linear in $\boldsymbol\delta^{(l+1)}$.", r"课件定义 $\delta = -\partial E/\partial z$，更新时用加号。把 $\delta$ 定义成 $+\partial E/\partial z$ 的书，更新时用减号。两种写法下 $\boldsymbol\delta^{(l)}$ 的递推式相同，因为它对 $\boldsymbol\delta^{(l+1)}$ 是线性的。")),
                 quiz(T(r"Which weights enter $\delta_j$ of hidden unit $j$?", r"隐藏单元 $j$ 的 $\delta_j$ 里用到哪些权重？"),
                      [(T(r"The weights coming into $j$, $\theta^{(1)}_{jk}$", r"进入 $j$ 的权重 $\theta^{(1)}_{jk}$"), T(r"Those are the weights that $\delta_j$ will **update** (together with $a_k$), not the ones that carry $j$'s blame.", r"这些是要用 $\delta_j$（和 $a_k$）去**更新**的权重，不是承担 $j$ 那份责任的权重。")),
                       (T('All weights of the network', '网络的所有权重'), T(r"Only the local ones: backpropagation is local, each $\delta$ needs just the layer after it.", r"只用局部的：反向传播是局部的，每个 $\delta$ 只需要它后面那一层。")),
                       (T(r"The weights going into the layer above, $\theta^{(2)}_{ij}$ for every $i$ that $j$ feeds", r"通向上一层的权重，也就是 $j$ 所喂的每个 $i$ 对应的 $\theta^{(2)}_{ij}$"), True)],
                      T(r"The blame of $j$ for the final error travels through the connections leaving $j$, so those weights, and the $\delta_i$ at their other ends, are what $\delta_j$ is made from.", r"$j$ 对最终误差的责任，是沿着离开 $j$ 的那些连接传下去的，所以 $\delta_j$ 是用这些权重和它们另一端的 $\delta_i$ 做成的。"))),
            read('algorithm', T('The algorithm, and when to update', '完整算法，以及什么时候更新'),
                 ol(T(r"**Forward pass.** Push the instance through the network; keep every $z$ and $a$.", r"**前向。** 把实例送过网络；保存每个 $z$ 和 $a$。"),
                    T(r"**Error.** Compare the output $\hat y$ with the target $y$ and compute $\delta$ at the output units.", r"**误差。** 比较输出 $\hat y$ 与目标 $y$，算出输出单元的 $\delta$。"),
                    T(r"**Backward pass.** From the last layer to the first, $\delta^{(l)} = g'(z^{(l)}) \odot (W^{(l+1)})^\top\delta^{(l+1)}$, and for every weight $\Delta\theta_{ij}^{(l)} = \eta\,\delta_i\,a_j$.", r"**反向。** 从最后一层到第一层，$\delta^{(l)} = g'(z^{(l)}) \odot (W^{(l+1)})^\top\delta^{(l+1)}$，并对每个权重算 $\Delta\theta_{ij}^{(l)} = \eta\,\delta_i\,a_j$。"),
                    T(r"**Update all weights at once:** $\theta \leftarrow \theta + \Delta\theta$. Repeat until a stopping criterion is met.", r"**一次更新所有权重：** $\theta \leftarrow \theta + \Delta\theta$。重复，直到满足停止条件。")),
                 callout('warning', T('Compute every delta before changing any weight', '先算完所有 delta，再改权重'),
                         T(r"$\delta_j$ uses $\theta^{(2)}_{ij}$. If the output weights were already updated, the hidden gradients would belong to a different network than the one that made the error. The worked example below uses the **old** weights throughout.", r"$\delta_j$ 要用 $\theta^{(2)}_{ij}$。如果输出层权重已经改了，隐藏层的梯度就属于另一个网络，不是产生这个误差的那个。下面的例子全程用**旧**权重。")),
                 h(T('How many instances per update', '每次更新用多少个实例')),
                 table([T('Variant', '方式'), T('Instances behind one update', '一次更新依据的实例'), T('Good', '好处'), T('Bad', '坏处')],
                       [T('batch gradient descent', '批量梯度下降'), T('all $N$ (gradients averaged)', '全部 $N$ 个（梯度取平均）'), T('exact gradient, smooth path', '梯度精确，路径平滑'), T('one update per full pass: slow; all data in memory', '遍历一遍才更新一次：慢；数据要全进内存')],
                       [T('stochastic (online)', '随机（在线）'), T('1 (the lecture\'s loop)', '1 个（课件的循环）'), T('cheap, fast updates; noise can shake it out of shallow minima', '更新便宜又快；噪声能把它从浅的极小值里晃出来'), T('noisy path, may never settle', '路径抖动，可能一直停不下来')],
                       [T('mini-batch', '小批量'), T('$b$ instances, e.g. 32 to 256', '$b$ 个，如 32 到 256'), T('less noise than 1, vectorises well: the default in practice', '比 1 个噪声小，容易向量化：实践中的默认做法'), T('one more hyperparameter, $b$', '多一个超参数 $b$')]),
                 p(T(r"One pass over all training instances is an **epoch**. Common stopping criteria: a maximum number of epochs, the loss changing by less than a threshold, or the error on held-out data starting to rise (*early stopping*, see the last chapter).",
                     r"把所有训练实例过一遍叫一个**轮次**（epoch）。常见的停止条件：达到最大轮次；损失的变化小于阈值；或者留出数据上的误差开始上升（*早停*，见最后一章）。")),
                 callout('misconception', T('Backpropagation is not the optimiser', '反向传播不是优化器'),
                         T(r"Backpropagation only computes $\partial E/\partial\theta$ for all weights. What to do with the gradients (plain gradient descent, momentum, Adam) is a separate choice.", r"反向传播只负责算出所有权重的 $\partial E/\partial\theta$。拿梯度怎么办（普通梯度下降、动量、Adam）是另一个选择。")),
                 chapter=T('The algorithm, traced', '算法与数值演算')),
            read('net', T('A network to trace by hand', '一个手算的小网络'),
                 p(T(r"Two inputs, two hidden sigmoid units, two sigmoid outputs, squared error. One training instance $x = (1,\ 0.5)$ with target $y = (1,\ 0)$, and $\eta = 0.5$. Biases are left out for clarity (a bias is one more weight on a constant input 1). All numbers below are rounded to 4 decimals.",
                     r"两个输入、两个 sigmoid 隐藏单元、两个 sigmoid 输出、平方误差。一个训练实例 $x = (1,\ 0.5)$，目标 $y = (1,\ 0)$，$\eta = 0.5$。为清楚起见省略偏置（偏置就是常数输入 1 上多一个权重）。下面的数都四舍五入到 4 位小数。")),
                 svg(drawn(fig_net, 'weights'), T('A network with two inputs (1 and 0.5), two hidden units and two output units with targets 1 and 0, and the weight on each edge.', '一个网络：两个输入（1 和 0.5），两个隐藏单元，两个输出单元（目标为 1 和 0），每条边上标着权重。')),
                 p(T(r"The hidden weights are $\theta^{(1)}$ (row $j$ = hidden unit, column $k$ = input) and the output weights $\theta^{(2)}$ (row $i$ = output unit, column $j$ = hidden unit):", r"隐藏层权重是 $\theta^{(1)}$（行 $j$ 为隐藏单元，列 $k$ 为输入），输出层权重是 $\theta^{(2)}$（行 $i$ 为输出单元，列 $j$ 为隐藏单元）：")),
                 math_(X(r"\theta^{(1)} = \begin{pmatrix} @t1_11@ & @t1_12@ \\ @t1_21@ & @t1_22@ \end{pmatrix}, \qquad \theta^{(2)} = \begin{pmatrix} @t2_11@ & @t2_12@ \\ @t2_21@ & @t2_22@ \end{pmatrix}")),
                 p(T(r"Three stages: forward pass, deltas, updates. Then we check that the error really went down.", r"三个阶段：前向、算 delta、更新。最后检验误差真的下降了。"))),
            derive('forward', T('Forward pass', '前向计算'),
                   [(X(r"z^{(1)}_1 = 0.4(1) + (-0.2)(0.5) = @z1_1@"), T(r"Hidden unit 1: weighted sum of the inputs.", r"隐藏单元 1：输入的加权和。")),
                    (X(r"a^{(1)}_1 = \sigma(@z1_1@) = @a1_1@"), T(r"Squash with the sigmoid.", r"用 sigmoid 压一下。")),
                    (X(r"z^{(1)}_2 = 0.3(1) + 0.6(0.5) = @z1_2@, \quad a^{(1)}_2 = @a1_2@"), T(r"Hidden unit 2, the same two steps.", r"隐藏单元 2，同样两步。")),
                    (X(r"z^{(2)}_1 = 0.5(@a1_1@) + (-0.4)(@a1_2@) = @z2_1@"), T(r"Output unit 1 takes the hidden activations as its inputs.", r"输出单元 1 把隐藏层的激活当输入。")),
                    (X(r"a^{(2)}_1 = \sigma(@z2_1@) = @a2_1@"), T(r"The first prediction; its target is 1.", r"第一个预测；它的目标是 1。")),
                    (X(r"z^{(2)}_2 = 0.2(@a1_1@) + 0.7(@a1_2@) = @z2_2@, \quad a^{(2)}_2 = @a2_2@"), T(r"Output unit 2; its target is 0.", r"输出单元 2；它的目标是 0。")),
                    (X(r"E = \tfrac12\bigl[(1 - @a2_1@)^2 + (0 - @a2_2@)^2\bigr] = @E0@"), T(r"The squared error of this instance. Keep all the $z$ and $a$: the backward pass reuses them.", r"这个实例的平方误差。把所有 $z$ 和 $a$ 留着，反向要用。"))],
                   outro=T(r"Both outputs are on the wrong side of their targets (unit 1 should be 1 but is below 0.51; unit 2 should be 0 but is above 0.6), so both will be pushed.", r"两个输出都离目标不够近（单元 1 本该是 1 却不到 0.51；单元 2 本该是 0 却超过 0.6），所以两个都会被推动。"),
                   skill=algo),
            derive('backward', T('Backward pass: the deltas', '反向计算：各个 delta'),
                   [(X(r"\delta^{(2)}_1 = (1 - @a2_1@)\cdot @a2_1@(1 - @a2_1@) = @d2_1@"), T(r"Output unit 1: $(y - a)\,g'(z)$ with $g'(z) = a(1-a)$ for the sigmoid. Positive: the unit should go **up**.", r"输出单元 1：$(y - a)\,g'(z)$，sigmoid 时 $g'(z) = a(1-a)$。为正：该单元应当**升高**。")),
                    (X(r"\delta^{(2)}_2 = (0 - @a2_2@)\cdot @a2_2@(1 - @a2_2@) = @d2_2@"), T(r"Output unit 2. Negative: it should go **down**.", r"输出单元 2。为负：它应当**降低**。")),
                    (X(r"\delta^{(1)}_1 = @gp1_1@\,\bigl(0.5\,(@d2_1@) + 0.2\,(@d2_2@)\bigr) = @d1_1@"), T(r"Hidden unit 1: $g'(z) = a(1-a) = @gp1_1@$ times the sum over both outputs it feeds, each $\delta$ weighted by the connection ($\theta^{(2)}_{11} = 0.5$, $\theta^{(2)}_{21} = 0.2$). **Old weights.**", r"隐藏单元 1：$g'(z) = a(1-a) = @gp1_1@$，乘上它所喂的两个输出的加权和，每个 $\delta$ 乘各自的连接（$\theta^{(2)}_{11} = 0.5$，$\theta^{(2)}_{21} = 0.2$）。**用旧权重。**")),
                    (X(r"\delta^{(1)}_2 = @gp1_2@\,\bigl((-0.4)(@d2_1@) + 0.7\,(@d2_2@)\bigr) = @d1_2@"), T(r"Hidden unit 2: it pulls the two outputs in opposite directions (negative weight to output 1, positive to output 2), and both pushes agree: **down**.", r"隐藏单元 2：它对两个输出的作用方向相反（连到输出 1 的权重为负，连到输出 2 的为正），而两个推力方向一致：**降低**。"))],
                   outro=T(r"The hidden deltas are about @ratio@ times smaller than the output deltas: each layer multiplies by $g'\le 0.25$ and by weights below 1. Remember this for vanishing gradients.", r"隐藏层的 delta 比输出层的小了约 @ratio@ 倍：每过一层都要乘 $g' \le 0.25$ 和小于 1 的权重。后面讲梯度消失时会用到。"),
                   skill=algo),
            derive('update', T('Updates: error term times activation', '更新：误差项乘激活'),
                   [(X(r"\Delta\theta^{(2)}_{11} = 0.5\,(@d2_1@)(@a1_1@) = @dt2_11@"), T(r"Output weight: learning rate, times the error term of the unit it feeds, times the activation it carries.", r"输出层权重：学习率，乘它所喂单元的误差项，乘它传来的激活。")),
                    (X(r"\theta^{(2)}_{11} \leftarrow @t2_11@ + @dt2_11@ = @nt2_11@"), T(r"Positive $\delta$: the weight grows, so unit 1 moves toward its target 1.", r"$\delta$ 为正：权重变大，单元 1 朝目标 1 移动。")),
                    (X(r"\Delta\theta^{(2)}_{22} = 0.5\,(@d2_2@)(@a1_2@) = @dt2_22@, \;\; \theta^{(2)}_{22} \leftarrow @nt2_22@"), T(r"Negative $\delta$: the weight shrinks, unit 2 moves toward 0.", r"$\delta$ 为负：权重变小，单元 2 朝 0 移动。")),
                    (X(r"\Delta\theta^{(1)}_{11} = 0.5\,(@d1_1@)(1) = @dt1_11@, \;\; \theta^{(1)}_{11} \leftarrow @nt1_11@"), T(r"Hidden weight: error term of the hidden unit times the **input** $x_1 = 1$.", r"隐藏层权重：隐藏单元的误差项，乘**输入** $x_1 = 1$。")),
                    (X(r"\Delta\theta^{(1)}_{22} = 0.5\,(@d1_2@)(0.5) = @dt1_22@, \;\; \theta^{(1)}_{22} \leftarrow @nt1_22@"), T(r"Same, with $x_2 = 0.5$. The other four weights follow the same pattern.", r"同样，输入是 $x_2 = 0.5$。其余四个权重照此办理。"))],
                   skill=algo),
            read('check', T('Did it work? The full picture and a gradient check', '有效吗？整体图景与梯度检验'),
                 svg(drawn(fig_net, 'full'), T('The same network after the forward and backward pass: each unit shows its activation (blue) and its delta (orange).', '前向与反向之后的同一个网络：每个单元里是激活（蓝），旁边是它的 delta（橙）。')),
                 table([T('weight', '权重'), T('old', '旧值'), T('$\\Delta\\theta$', r'$\Delta\theta$'), T('new', '新值')],
                       *[[f'$\\theta^{{(2)}}_{{{i + 1}{j + 1}}}$', f4(BT2[i][j]), f4(DT2[i][j]), f4(NT2[i][j])] for i in range(2) for j in range(2)],
                       *[[f'$\\theta^{{(1)}}_{{{j + 1}{k + 1}}}$', f4(BT1[j][k]), f4(DT1[j][k]), f4(NT1[j][k])] for j in range(2) for k in range(2)]),
                 p(S(r"A second forward pass with the new weights gives $E = @E1@$, down from $@E0@$. One small step, and the error fell.", r"用新权重再前向一次，$E = @E1@$，比之前的 $@E0@$ 小。一小步，误差就降了。")),
                 callout('note', T('Gradient checking', '梯度检验'),
                         S(r"To test an implementation, nudge one weight by $\pm 10^{-6}$ and compare $\frac{E(\theta+h)-E(\theta-h)}{2h}$ with the backprop gradient. For $\theta^{(2)}_{11}$ the finite difference gives $@fd@$ and $-\delta^{(2)}_1 a^{(1)}_1 = @bpg@$. They agree to six places, so the deltas are right.",
                           r"测试一个实现：把某个权重动 $\pm 10^{-6}$，用 $\frac{E(\theta+h)-E(\theta-h)}{2h}$ 和反向传播的梯度比较。对 $\theta^{(2)}_{11}$，有限差分得 $@fd@$，而 $-\delta^{(2)}_1 a^{(1)}_1 = @bpg@$。六位小数一致，说明 delta 算对了。"))),
            derive('cost', T('Why backpropagation is cheap', '反向传播为什么这么省'),
                   [(r"C_1 \approx W",
                     T(r"Take a network with $W$ weights. A forward pass uses each weight once (one multiply-add), so one pass costs $C_1 \approx W$ operations.", r"设网络有 $W$ 个权重。前向用每个权重一次（一次乘加），所以一次前向的代价 $C_1 \approx W$ 次运算。")),
                    (r"C_{\mathrm{FD}} = 2W \times W = 2W^2",
                     T(r"The naive gradient (finite differences, $C_{\mathrm{FD}}$) nudges each weight in turn and re-runs the whole network (twice for the central difference): $2W$ forward passes of cost $W$ each.", r"朴素的梯度做法（有限差分，$C_{\mathrm{FD}}$）是：逐个权重微调一下，把整个网络重新算一遍（中心差分要两遍），共 $2W$ 次前向，每次代价 $W$。")),
                    (r"C_{\mathrm{BP}} = W + W + W = 3W",
                     T(r"Backpropagation ($C_{\mathrm{BP}}$): one forward pass ($W$), the $\delta$s of all units (each weight used once more, $W$), and all the products $\delta_i a_j$ (one per weight, $W$). About two forward passes' worth in total for the backward half.", r"反向传播（$C_{\mathrm{BP}}$）：一次前向（$W$），所有单元的 $\delta$（每个权重再用一次，$W$），所有乘积 $\delta_i a_j$（每个权重一个，$W$）。反向这半边总共约等于两次前向的工作量。")),
                    (r"\frac{2W^2}{3W} = \frac{2W}{3}",
                     S(r"The speed-up grows with the size of the network: @w8_ratio@ times for our 8 weights, about @wm_ratio@ times for a 784-100-10 network (@wm@ weights), @w1m_ratio@ times for a million weights.", r"提速随网络变大：我们这 8 个权重的网络是 @w8_ratio@ 倍，784-100-10 的网络（@wm@ 个权重）约 @wm_ratio@ 倍，一百万个权重就是 @w1m_ratio@ 倍。"),
                     T(r"Counts are rough (biases, the activation function and batch size are ignored), but the order of magnitude is the point: $W$ versus $W^2$.", r"计数是粗略的（忽略了偏置、激活函数和批大小），要点是数量级：$W$ 对 $W^2$。"))],
                   intro=T(r"The delta rule gives every weight's gradient. How expensive is that, compared with the obvious alternative of measuring the slope numerically?", r"delta 规则给出每个权重的梯度。和最直接的做法（用数值方法量斜率）相比，它有多贵？"),
                   outro=T(r"**Why the saving?** The error of unit $j$ is one number, $\delta_j$, computed once and then used by every weight into $j$ and by every unit behind $j$. A weight deep in the network has exponentially many paths to the output (about $m^L$ for width $m$ and depth $L$). The chain rule adds them up, and backpropagation does so **layer by layer, merging paths as it goes**, instead of walking each path again. It is dynamic programming on the network (in software: *reverse-mode automatic differentiation*). The price is memory: all activations of the forward pass must be kept until the backward pass.",
                           r"**为什么能省？** 单元 $j$ 的误差就是一个数 $\delta_j$，只算一次，进入 $j$ 的每个权重、排在 $j$ 之后的每个单元都用它。网络深处的一个权重到输出有指数多条路径（宽度 $m$、深度 $L$ 时约 $m^L$ 条）。链式法则要把它们加起来，反向传播是**一层一层地、边走边合并路径**，而不是把每条路径重走一遍。这就是网络上的动态规划（在软件里叫*反向模式自动微分*）。代价是内存：前向时的所有激活要留到反向用。"),
                   skill=eff, chapter=T('Why it is cheap', '为什么它这么省')),
            read('lr', T('The learning rate', '学习率'),
                 p(T(r"The update $\theta \leftarrow \theta + \eta\,\delta\,a$ is only as good as the step size $\eta$. Take the simplest bowl, $E = \theta^2$, and start at $\theta = 3$. One step gives $\theta \leftarrow \theta(1 - 2\eta)$:",
                     r"更新 $\theta \leftarrow \theta + \eta\,\delta\,a$ 好不好，要看步长 $\eta$。拿最简单的碗 $E = \theta^2$，从 $\theta = 3$ 出发。一步是 $\theta \leftarrow \theta(1 - 2\eta)$：")),
                 svg(drawn(fig_lr), T('Three paths of theta over six steps: eta 0.1 creeps down slowly; eta 0.9 swings across zero each step but shrinks; eta 1.1 swings wider each step and diverges.', '六步里 theta 的三条路径：η = 0.1 慢慢往下爬；η = 0.9 每步越过 0 但在缩小；η = 1.1 每步摆得更远，发散。')),
                 ul(T(r"**Too small** ($0.1$): the factor is $0.8$, a safe but slow crawl.", r"**太小**（$0.1$）：因子 $0.8$，稳但慢。"),
                    T(r"**Large but stable** ($0.9$): the factor is $-0.8$, it overshoots the minimum each time but the swings shrink.", r"**大但稳**（$0.9$）：因子 $-0.8$，每次冲过最低点，但摆幅在缩小。"),
                    T(r"**Too large** ($1.1$): the factor is $-1.2$, each step overshoots by more than the last: divergence.", r"**太大**（$1.1$）：因子 $-1.2$，每步比上一步冲得更远：发散。")),
                 p(T(r"In practice: try values on a log scale ($0.1, 0.01, 0.001$), watch the training loss, and shrink $\eta$ during training. A loss that jumps up and down or goes to infinity says $\eta$ is too large; a loss that barely moves says it may be too small.",
                     r"实践中：在对数尺度上试（$0.1, 0.01, 0.001$），盯着训练损失，训练过程中把 $\eta$ 调小。损失上蹿下跳或冲到无穷，说明 $\eta$ 太大；几乎不动，可能是太小。")),
                 quiz(T('The training loss grows from epoch to epoch and finally becomes NaN. What is the most likely cause?', '训练损失一轮比一轮大，最后变成 NaN。最可能的原因是什么？'),
                      [(T('The learning rate is too small', '学习率太小'), T(r"A too-small $\eta$ makes the loss fall slowly, not rise.", r"$\eta$ 太小会让损失下降得慢，而不是上升。")),
                       (T('The learning rate is too large: the steps overshoot more each time', '学习率太大：步子一次比一次冲得远'), True),
                       (T('There are too few hidden units', '隐藏单元太少'), T(r"Too little capacity gives a high but **stable** loss, not one that explodes.", r"容量不够会得到偏高但**稳定**的损失，不会爆炸。"))],
                      T(r"Divergence is the signature of a step size that is too large (compare the $\eta = 1.1$ path).", r"发散是步长太大的特征（对照 $\eta = 1.1$ 那条路径）。")),
                 chapter=T('Training in practice', '训练中的实际问题')),
            read('landscape', T('Local minima, vanishing gradients, overfitting', '局部极小、梯度消失、过拟合'),
                 h(T('The error surface is not a bowl', '误差曲面不是一只碗')),
                 p(T(r"With hidden layers $E(\theta)$ is **non-convex**: gradient descent stops wherever the gradient is 0, which can be a **local minimum**, a flat **plateau** or a **saddle point**, not necessarily the best weights. What you get depends on the starting weights and the order of the data. Remedies: random restarts, noisy (stochastic or mini-batch) updates, momentum. In practice, in large networks, most local minima are about as good as the global one; plateaus and saddles are the more common trouble.",
                     r"有了隐藏层，$E(\theta)$ 是**非凸**的：梯度下降在梯度为 0 的地方就停，可能是**局部极小**、平坦的**高原**或**鞍点**，不一定是最好的权重。结果取决于初始权重和数据的顺序。对策：随机重启、带噪声的（随机或小批量）更新、动量。实践中，大网络里多数局部极小和全局最小差不多好；更常见的麻烦是高原和鞍点。")),
                 quiz(T('You start every weight at 0. What happens to the hidden units?', '把所有权重都初始化为 0。隐藏单元会怎样？'),
                      [(T('Nothing special: zero is a neutral start', '没什么特别：0 是中性的起点'), T(r"The start is neutral in value but not in effect: with equal weights, every hidden unit has the same $a$ and (since its outgoing weights are equal too) the same $\delta_j$, so they receive the same updates and never differ.", r"值上中性，效果上不是：权重相等时，每个隐藏单元的 $a$ 相同，（出向权重也相同，所以）$\delta_j$ 也相同，更新量相同，永远无法分化。")),
                       (T('They stay identical forever and learn the same feature', '永远保持完全一样，学到同一个特征'), True),
                       (T('The network diverges at once', '网络立刻发散'), T(r"The weights do not blow up; they just stay symmetric. The problem is lack of diversity, not instability.", r"权重不会爆炸，只是一直保持对称。问题是缺乏差异，不是不稳定。"))],
                      T(r"Small **random** initial weights break the symmetry. (Biases may start at 0.)", r"用小的**随机**初始权重来打破对称。（偏置可以从 0 开始。）")),
                 h(T('Vanishing gradients', '梯度消失')),
                 p(S(r"Going backwards, $\delta$ is multiplied at each layer by $g'(z) \le 0.25$ (sigmoid) and by weights. In our example the hidden $\delta$s were already about @ratio@ times smaller than the output ones after one layer. With 10 sigmoid layers the signal in the first layers can be a factor $0.25^{10} \approx 10^{-6}$ smaller: those layers hardly learn. Remedies: ReLU (slope 1 for $z>0$), tanh (slope up to 1, so larger updates than the sigmoid), careful initialisation, shorter paths.",
                     r"往回走时，每过一层 $\delta$ 要乘 $g'(z) \le 0.25$（sigmoid）和权重。我们的例子里，才过一层，隐藏层的 $\delta$ 就已经比输出层小了约 @ratio@ 倍。10 层 sigmoid，前几层的信号可能小 $0.25^{10} \approx 10^{-6}$ 倍：这些层几乎学不到东西。对策：ReLU（$z>0$ 时斜率为 1）、tanh（斜率最大到 1，更新比 sigmoid 大）、仔细初始化、缩短路径。")),
                 h(T('Overfitting and regularisation', '过拟合与正则化')),
                 p(T(r"A network with many weights can fit the training noise (see the bias-variance lesson). Standard defences, none of which changes backpropagation itself: **early stopping** (stop when the validation error starts to rise), **weight decay** (an $L_2$ penalty $\frac{\lambda}{2}\lVert\theta\rVert^2$ adds $-\lambda\theta$ to every update, keeping weights small), **dropout** (randomly switch units off during training), and more data.",
                     r"权重很多的网络能把训练数据里的噪声也拟合进去（见偏差-方差一课）。标准的防御手段，都不改变反向传播本身：**早停**（验证误差开始上升就停）、**权重衰减**（$L_2$ 惩罚 $\frac{\lambda}{2}\lVert\theta\rVert^2$ 给每次更新加一项 $-\lambda\theta$，让权重保持小）、**dropout**（训练时随机关掉一些单元）、以及更多数据。"))),
            number('q_forward', T('Exam practice: a forward step', '考试练习：一步前向'), act,
                   T(r"A unit has inputs $0.5$ and $1.0$ with weights $0.4$ and $-0.6$ (no bias) and a sigmoid activation. What is its output $a$? Round to 3 decimals.", r"一个单元的输入是 $0.5$ 和 $1.0$，权重是 $0.4$ 和 $-0.6$（无偏置），激活函数为 sigmoid。输出 $a$ 是多少？保留 3 位小数。"),
                   round(Q1_A, 3), T(rf"$z = 0.5(0.4) + 1.0(-0.6) = -0.4$ and $a = \sigma(-0.4) = 1/(1+e^{{0.4}}) = {Q1_A:.3f}$.", rf"$z = 0.5(0.4) + 1.0(-0.6) = -0.4$，$a = \sigma(-0.4) = 1/(1+e^{{0.4}}) = {Q1_A:.3f}$。"),
                   tolerance=0.002, chapter=T('Exam practice', '考试练习')),
            number('q_delta_out', T('Exam practice: the output delta', '考试练习：输出层的 delta'), delta,
                   T(r"A sigmoid output unit has activation $a = 0.8$ and target $y = 1$. Using the lecture's rule $\delta = (y - a)\,g'(z)$, what is $\delta$? Round to 4 decimals.", r"一个 sigmoid 输出单元的激活 $a = 0.8$，目标 $y = 1$。用课件的 $\delta = (y - a)\,g'(z)$，$\delta$ 是多少？保留 4 位小数。"),
                   round(Q2_D, 4), T(rf"For a sigmoid $g'(z) = a(1-a) = 0.8 \times 0.2 = 0.16$, so $\delta = 0.2 \times 0.16 = {Q2_D:.3f}$.", rf"sigmoid 的 $g'(z) = a(1-a) = 0.8 \times 0.2 = 0.16$，所以 $\delta = 0.2 \times 0.16 = {Q2_D:.3f}$。"),
                   tolerance=0.0006, hints=(T(r"Write $g'(z)$ with the activation $a$.", r"用激活 $a$ 来写 $g'(z)$。"),)),
            number('q_delta_hidden', T('Exam practice: a hidden delta', '考试练习：隐藏层的 delta'), delta,
                   T(r"A hidden sigmoid unit has $a_j = 0.5$. It feeds two output units with weights $0.4$ and $-0.2$, whose error terms are $\delta_1 = 0.1$ and $\delta_2 = 0.3$. What is $\delta_j$? Round to 4 decimals.", r"一个 sigmoid 隐藏单元的 $a_j = 0.5$。它喂给两个输出单元，权重分别是 $0.4$ 和 $-0.2$，两个输出单元的误差项是 $\delta_1 = 0.1$，$\delta_2 = 0.3$。$\delta_j$ 是多少？保留 4 位小数。"),
                   round(Q3_D, 4), T(rf"$g'(z_j) = 0.5 \times 0.5 = 0.25$, and $\sum_i\theta_{{ij}}\delta_i = 0.4(0.1) + (-0.2)(0.3) = -0.02$. So $\delta_j = 0.25 \times (-0.02) = {Q3_D:.3f}$.", rf"$g'(z_j) = 0.5 \times 0.5 = 0.25$，$\sum_i\theta_{{ij}}\delta_i = 0.4(0.1) + (-0.2)(0.3) = -0.02$。所以 $\delta_j = 0.25 \times (-0.02) = {Q3_D:.3f}$。"),
                   tolerance=0.0006, hints=(T(r"Both outputs count: add the two terms before multiplying by $g'$.", r"两个输出都要算：先把两项加起来，再乘 $g'$。"),)),
            number('q_update', T('Exam practice: a weight update', '考试练习：一次权重更新'), algo,
                   T(r"An output weight is $0.5$. Its output unit has $\delta = 0.032$, the hidden unit it comes from has $a_j = 0.6$, and $\eta = 0.1$. What is the weight after one update $\Delta\theta = \eta\,\delta\,a_j$? Round to 5 decimals.", r"某个输出层权重为 $0.5$。它所通向的输出单元 $\delta = 0.032$，它来自的隐藏单元 $a_j = 0.6$，$\eta = 0.1$。按 $\Delta\theta = \eta\,\delta\,a_j$ 更新一次后权重是多少？保留 5 位小数。"),
                   round(Q4_NEW, 5), T(rf"$\Delta\theta = 0.1 \times 0.032 \times 0.6 = 0.00192$, so the new weight is $0.5 + 0.00192 = {Q4_NEW:.5f}$.", rf"$\Delta\theta = 0.1 \times 0.032 \times 0.6 = 0.00192$，新权重 $0.5 + 0.00192 = {Q4_NEW:.5f}$。"),
                   tolerance=0.00003),
            choice('q_hidden_target', T('Exam practice: why not use the target for a hidden unit?', '考试练习：为什么隐藏单元不能直接用目标？'), delta,
                   T(r"Why can the output rule $\delta_i = (y - a_i)\,g'(z_i)$ not be used for a hidden unit?", r"为什么输出层的规则 $\delta_i = (y - a_i)\,g'(z_i)$ 不能用在隐藏单元上？"),
                   [(T('Hidden units have no target output $y$ to compare against; their error has to come from the layer after them', '隐藏单元没有可比较的目标输出 $y$；它们的误差只能来自后一层'), True),
                    (T('Hidden units use a different activation function', '隐藏单元用的是另一种激活函数'), T(r"They can use the same $g$. The rule fails because there is no $y$ for them, not because of $g$.", r"它们可以用同一个 $g$。规则失效是因为它们没有 $y$，和 $g$ 无关。"), 'hidden-has-target'),
                    (T('The hidden weights are too small to update', '隐藏层权重太小，没法更新'), T(r"Size is not the issue; the rule has no target to use. Hidden weights are updated with $\delta_j = g'(z_j)\sum_i\theta_{ij}\delta_i$.", r"问题不在大小，而是规则里没有目标可用。隐藏层权重用 $\delta_j = g'(z_j)\sum_i\theta_{ij}\delta_i$ 来更新。"), 'hidden-has-target'),
                    (T('Hidden units are updated by perceptron learning instead', '隐藏单元改用感知机学习规则更新'), T(r"The perceptron rule needs the target too. It cannot train hidden layers, which is the reason backpropagation exists.", r"感知机规则同样需要目标，训不了隐藏层，这正是反向传播存在的原因。"), 'hidden-has-target')],
                   T(r"Only the output layer has targets. Backpropagation hands the output error back through the weights, so hidden units get $\delta_j = g'(z_j)\sum_i\theta_{ij}\delta_i$.", r"只有输出层有目标。反向传播把输出的误差通过权重往回传，于是隐藏单元得到 $\delta_j = g'(z_j)\sum_i\theta_{ij}\delta_i$。")),
            choice('q_bp_role', T('Exam practice: what is backpropagation?', '考试练习：反向传播是什么？'), why,
                   T('Which statement about backpropagation is correct?', '关于反向传播，哪一句是对的？'),
                   [(T('It is the optimiser that replaces gradient descent', '它是取代梯度下降的优化器'), T(r"It does not decide how to move the weights; it only supplies $\partial E/\partial\theta$. Gradient descent (or Adam, etc.) uses it.", r"它不决定权重怎么走，只提供 $\partial E/\partial\theta$，由梯度下降（或 Adam 等）去用。"), 'bp-is-optimiser'),
                    (T('It computes the gradient of the error with respect to every weight in one forward and one backward pass, by reusing the delta of each unit', '它用一次前向加一次反向，通过重复使用每个单元的 delta，算出误差对每个权重的梯度'), True),
                    (T('It tries each weight in turn and keeps the change that lowers the error', '它逐个尝试每个权重，保留能降低误差的改动'), T(r"That is the finite-difference approach, $2W$ forward passes. Backpropagation avoids it.", r"那是有限差分的做法，要 $2W$ 次前向。反向传播避免了这种做法。"), 'bp-is-optimiser'),
                    (T('It guarantees the global minimum of the error', '它保证找到误差的全局最小'), T(r"The error surface is non-convex; gradient descent with exact gradients still only reaches a local minimum or plateau.", r"误差曲面非凸；即便梯度精确，梯度下降也只能到局部极小或高原。"), 'bp-is-optimiser')],
                   T(r"Backpropagation = an efficient way to compute all gradients. Learning = gradient descent using them.", r"反向传播 = 高效地算出所有梯度的办法。学习 = 用这些梯度做梯度下降。")),
            tq('q_explain', T('Exam practice: explain backpropagation (Section A)', '考试练习：解释反向传播（A 部分）'), why,
                   T('In 3 lines or fewer: what problem does backpropagation solve, and how?', '三行以内：反向传播解决什么问题，怎么解决？'),
                   ['gradient of the error with respect to every weight (needed for gradient descent)', 'hidden units have no target: the output error is propagated backwards with the chain rule', 'a forward pass, then deltas computed layer by layer backwards, reusing them, so it is cheap', 'then the weights are updated by delta times incoming activation'],
                   'Gradient descent needs the gradient of the error for every weight, but hidden units have no target. Backpropagation does a forward pass, computes the error delta at the output, then uses the chain rule to propagate the deltas backwards layer by layer (delta_j = g\'(z_j) * sum_i theta_ij * delta_i), reusing them for all weights. Each weight is then updated by eta * delta * (incoming activation).',
                   T('A marker looks for: the gradient for every weight; the chain rule passing the error backwards; reuse of the deltas (cheap); the update rule.', '阅卷看：每个权重的梯度；链式法则把误差往回传；delta 的重复使用（便宜）；更新规则。')),
            tq('q_design', T('Exam practice: a stuck network (Section C style)', '考试练习：训练不动的网络（C 部分风格）'), train,
                   T('A 10-layer network with sigmoid units is trained with backpropagation. After many epochs the training loss has hardly moved, and the first layers\' weights are almost unchanged. Explain what is probably wrong and propose two changes. Write about a third of a page.', '一个 10 层的 sigmoid 网络用反向传播训练。许多轮之后训练损失几乎没动，前几层的权重几乎没变。解释最可能的问题，并提出两项改动。写约三分之一页。'),
                   ['vanishing gradients: the sigmoid derivative is at most 0.25, and the delta is multiplied by it (and by weights) at every layer', 'the early layers receive almost no signal, so they do not learn', 'use ReLU (derivative 1 for z > 0) or tanh', 'better (random, scaled) initialisation, fewer layers, or a different learning rate; check with gradient checking'],
                   'The likely cause is vanishing gradients. Backpropagation multiplies the delta by g\'(z) at every layer, and for the sigmoid g\'(z) <= 0.25, so after 10 layers the delta reaching the first layers can be around 1e-6 of the output delta; those layers hardly learn. Two changes: replace the sigmoid by ReLU, whose derivative is 1 for z > 0 (or tanh, with a larger maximum slope), and use a careful random initialisation (or a shallower network); a gradient check and a look at the size of the deltas per layer would confirm the diagnosis.',
                   T('Name the cause (vanishing gradient, through the product of $g\'$ and weights), then give changes that attack that cause.', '先点出原因（梯度消失，来自 $g\'$ 与权重的连乘），再给出针对这个原因的改动。')),
            read('sheet', T('What to remember', '要记住的'),
                 table([T('Piece', '部分'), T('Formula', '公式')],
                       [T('gradient descent', '梯度下降'), r"$\theta \leftarrow \theta + \Delta\theta,\quad \Delta\theta = -\eta\,\partial E/\partial\theta$"],
                       [T('error', '误差'), r"$E = \frac12 (y - a)^2$ (sigmoid unit)"],
                       [T('derivatives', '导数'), r"$\sigma' = a(1-a)$, $\tanh' = 1-a^2$, ReLU$' \in \{0,1\}$, step$' = 0$"],
                       [T('output unit', '输出单元'), r"$\delta_i = (y - a_i)\,g'(z_i)$"],
                       [T('hidden unit', '隐藏单元'), r"$\delta_j = g'(z_j)\sum_i \theta^{(2)}_{ij}\,\delta_i$"],
                       [T('weight update', '权重更新'), T(r"$\Delta\theta_{ij} = \eta\,\delta_i\,a_j$ (error term $\times$ incoming activation)", r"$\Delta\theta_{ij} = \eta\,\delta_i\,a_j$（误差项 $\times$ 输入激活）")],
                       [T('matrix form', '矩阵形式'), r"$\boldsymbol\delta^{(l)} = g'(\mathbf z^{(l)}) \odot (W^{(l+1)})^\top\boldsymbol\delta^{(l+1)}$"]),
                 ol(T('Forward: compute and keep every $z$ and $a$.', '前向：算出并保存每个 $z$ 和 $a$。'),
                    T('Error: $\\delta$ at the output units from the targets.', '误差：用目标算输出单元的 $\\delta$。'),
                    T('Backward: $\\delta$ of each layer from the layer after it (old weights).', '反向：每层的 $\\delta$ 由后一层得到（用旧权重）。'),
                    T('Update all weights at once; repeat until a stopping criterion.', '一次更新所有权重；重复，直到满足停止条件。')),
                 ul(T(r"Cost: about two forward passes for all gradients, instead of $2W$ passes by finite differences.", r"代价：所有梯度约两次前向的工作量，而有限差分要 $2W$ 次前向。"),
                    T(r"The step function cannot be used: derivative 0. Sigmoid: $g' \le 0.25$ and vanishing gradients; ReLU: slope 1 for $z>0$.", r"阶跃函数不能用：导数为 0。sigmoid：$g' \le 0.25$，梯度消失；ReLU：$z>0$ 时斜率 1。"),
                    T(r"Batch, stochastic, mini-batch differ in how many instances one update uses. $\eta$ too large diverges, too small crawls. Do not start all weights at 0.", r"批量、随机、小批量的差别在于一次更新用多少实例。$\eta$ 太大发散，太小爬得慢。不要把所有权重初始化为 0。"),
                    T(r"Non-convex: local minima, plateaus, saddles. Overfitting: early stopping, weight decay, dropout, more data.", r"非凸：局部极小、高原、鞍点。过拟合：早停、权重衰减、dropout、更多数据。")),
                 chapter=T('What to remember', '要记住的')),
        ])


# ================================================================ LESSON 2: ensembles
def _toy_tables():
    """The three scenarios of the lecture's toy example: 1 = the classifier is right on that test instance."""
    sc = {'A': [[1, 1, 0], [0, 1, 1], [1, 0, 1]], 'B': [[1, 1, 0], [1, 1, 0], [1, 1, 0]], 'C': [[1, 0, 0], [0, 1, 0], [0, 0, 1]]}
    out = []
    for name, rows in sc.items():
        vote = [1 if sum(r[t] for r in rows) >= 2 else 0 for t in range(3)]
        mark = lambda v: '✓' if v else '✗'
        out.append((name, table(['', 't₁', 't₂', 't₃'], *([f'C{i + 1}'] + [mark(v) for v in r] for i, r in enumerate(rows)), ['C*'] + [mark(v) for v in vote])))
    return out


def _bootstrap_example():
    import random
    rng = random.Random(33)
    sample = [rng.randint(1, 10) for _ in range(10)]
    missing = [v for v in range(1, 11) if v not in sample]
    return sample, missing


BSAMPLE, BMISSING = _bootstrap_example()
V['bsample'] = ', '.join(map(str, BSAMPLE))
V['bmissing'] = ', '.join(map(str, BMISSING))
V['bunique'] = str(len(set(BSAMPLE)))


def L_ensembles():
    SK = 'ensembles.'
    vote, stack, bag, varsk, ada, cmp = (SK + s for s in ('voting', 'stacking', 'bagging', 'variance', 'adaboost', 'compare'))
    toy = _toy_tables()
    def stump_text(rec):
        t, sgn = rec['t'], rec['sgn']
        if t < 1:
            return T('always +1', '恒为 +1') if sgn == 1 else T('always −1', '恒为 −1')
        lo, hi = ('+1', '−1') if sgn == -1 else ('−1', '+1')
        return f'x ≤ {t:g}: {lo};  x > {t:g}: {hi}'

    rounds_tbl = table([T('round', '轮次'), T('stump', '树桩'), T('wrong at x', '判错的 x'), 'ε', 'α'],
                       *[[str(r + 1), stump_text(rec), ', '.join(str(AX[j]) for j in range(10) if rec['pred'][j] != AY[j]), f4(rec['eps']), f4(rec['alpha'])] for r, rec in enumerate(AR)])
    wt_tbl = table(['x', 'y', 'w¹', 'w²', 'w³', 'F(x)'],
                   *[[str(AX[j]), '+' if AY[j] > 0 else '−', f4(AR[0]['w'][j]), f4(AR[1]['w'][j]), f4(AR[2]['w'][j]), V[f'F{j + 1}']] for j in range(10)])
    return dict(
        id=lid('ensembles'),
        title=T('Ensembles: voting, stacking, bagging, boosting', '集成学习：投票、堆叠、装袋、提升'),
        description=T('Why many models beat one: when voting helps, how stacking, bagging, random forests and AdaBoost build their members, why averaging cuts variance, and where AdaBoost\'s weights come from.',
                      '为什么多个模型胜过一个：投票什么时候有用；堆叠、装袋、随机森林、AdaBoost 怎样造出成员；为什么平均能降方差；AdaBoost 的权重从哪来。'),
        minutes=50,
        skills=[{'id': vote, 'name': T('Voting and when an ensemble works', '投票，以及集成什么时候有效')},
                {'id': stack, 'name': T('Stacking and nested cross-validation', '堆叠与嵌套交叉验证')},
                {'id': bag, 'name': T('Bagging, the bootstrap and random forests', '装袋、自助采样与随机森林')},
                {'id': varsk, 'name': T('Why averaging reduces variance', '为什么平均能降低方差')},
                {'id': ada, 'name': T('Boosting and AdaBoost', '提升与 AdaBoost')},
                {'id': cmp, 'name': T('Bagging versus boosting versus stacking', '装袋、提升与堆叠的比较')}],
        misconceptions=[{'id': 'copies', 'description': T('Believing that more copies of the same model make an ensemble better', '以为同一个模型多来几份，集成就会更好')},
                        {'id': 'leak', 'description': T('Training the stacking meta-classifier on predictions made for data the base models were trained on', '用基模型在其训练数据上的预测去训练堆叠的元分类器')},
                        {'id': 'boost-noise', 'description': T('Thinking boosting is as robust to noisy labels as bagging', '以为提升和装袋一样不怕噪声标签')},
                        {'id': 'bag-bias', 'description': T('Expecting bagging to remove bias', '指望装袋消除偏差')}],
        steps=[
            read('idea', T('Many models, one answer', '很多模型，一个答案'),
                 p(T(r"Until now we compared classifiers and picked the best one. But each test instance gets **one shot** at one model, with all the bias of that algorithm. **Ensemble learning** (classifier combination) trains a set of base classifiers and aggregates their outputs into a single meta-classifier.",
                     r"到目前为止，我们都是比较几个分类器、挑最好的那个。可每个测试实例只能由一个模型判一次，带着这个算法全部的偏差。**集成学习**（ensemble learning，也叫分类器组合）训练一组基分类器，把它们的输出汇总成一个元分类器。")),
                 p(T(rf"The simplest aggregation is **voting**. For classification choose the class most base classifiers predict (majority vote); for regression take the average, for example the predictions $0.8, 0.7, 0.2, 0.9$ give $\frac{{0.8+0.7+0.2+0.9}}{{4}} = {(0.8 + 0.7 + 0.2 + 0.9) / 4:.2f}$.", rf"最简单的汇总是**投票**（voting）。分类时选多数基分类器预测的类别（多数投票）；回归时取平均，例如预测 $0.8, 0.7, 0.2, 0.9$ 得 $\frac{{0.8+0.7+0.2+0.9}}{{4}} = {(0.8 + 0.7 + 0.2 + 0.9) / 4:.2f}$。")),
                 h(T('The two intuitions', '两条直觉')),
                 ol(T(r"**Intuition 1.** A combination of many **weak** classifiers can be at least as good as one strong classifier.", r"**直觉 1。** 许多**弱**分类器的组合，可以至少和一个强分类器一样好。"),
                    T(r"**Intuition 2.** A combination of several **strong** classifiers is (usually) at least as good as the best of them.", r"**直觉 2。** 几个**强**分类器的组合，（通常）至少和其中最好的一个一样好。")),
                 h(T('Where the different members come from', '成员之间的差异从哪来')),
                 table([T('Manipulate', '改变什么'), T('How', '怎么做'), T('Typical method', '典型方法')],
                       [T('the instances', '实例'), T('different training samples', '不同的训练样本'), T('bagging (random forest also manipulates features)', '装袋（随机森林同时改变特征）')],
                       [T('the features', '特征'), T('different feature subsets', '不同的特征子集'), T('random forest; stacking with feature subsets', '随机森林；用特征子集的堆叠')],
                       [T('the algorithm', '算法'), T('tweak internal parameters; reweight instances', '调内部参数；给实例重新加权'), T('boosting', '提升')],
                       [T('the class labels', '类别标签'), T('reversible re-coding, e.g. A vs not-A', '可还原的重新编码，如 A 对非 A'), T('one-vs-rest, error-correcting codes', '一对多、纠错编码')],
                       [T('the model type', '模型类型'), T('NN, Naive Bayes, tree together', '神经网络、朴素贝叶斯、树一起用'), T('stacking', '堆叠')]),
                 chapter=T('Why combine', '为什么要组合')),
            read('when', T('When does voting work?', '投票什么时候有用？'),
                 p(T(r"Three classifiers vote on three test instances; ✓ means right. Which scenario helps?", r"三个分类器对三个测试实例投票；✓ 表示判对。哪种情形有帮助？")),
                 *[blk for name, tb in toy for blk in (h(T(f'Scenario {name}', f'情形 {name}')), tb)],
                 ul(T(r"**A.** Each classifier is wrong on a different instance. The vote is right on all three: **the errors cancel.**", r"**A。** 每个分类器错在不同的实例上。投票三个全对：**错误互相抵消。**"),
                    T(r"**B.** All three make the same mistake, so the vote repeats it: **no gain.**", r"**B。** 三个犯同样的错，投票只是把错误重复一遍：**没有收益。**"),
                    T(r"**C.** Each classifier is right on only 1 of 3 (accuracy $\frac13$, worse than chance for two classes). The majority is wrong everywhere: **voting amplifies bad classifiers.**", r"**C。** 每个分类器只对 3 个里的 1 个（准确率 $\frac13$，比二分类的随机猜测还差）。多数票处处出错：**投票会放大糟糕的分类器。**")),
                 callout('note', T('Two conditions', '两个条件'), T(r"An ensemble works when (1) the classifiers **do not make the same mistakes** (different biases) and (2) each is **reasonably accurate**, better than chance (error below 0.5).", r"集成有效需要：(1) 分类器**不犯同样的错**（偏差不同）；(2) 每个都**相当准确**，好于随机（错误率低于 0.5）。")),
                 quiz(T('Five classifiers are trained on exactly the same data with the same algorithm and the same settings. What does a majority vote give?', '五个分类器用同样的数据、同样的算法、同样的设置训练。多数投票会得到什么？'),
                      [(T('Better than any single one, because five votes are more reliable than one', '比任何一个都好，因为五票比一票可靠'), T(r"They are identical, so the five votes are one vote counted five times: scenario B.", r"它们完全一样，五票其实是同一票数了五遍：这就是情形 B。")),
                       (T('Exactly the same as one of them', '和其中任何一个完全相同'), True),
                       (T('Worse, because the votes cancel', '更差，因为票互相抵消'), T(r"Identical votes do not cancel: they all agree, so the majority is the single model's answer.", r"相同的票不会抵消：它们完全一致，多数票就是单个模型的答案。"))],
                      T(r"Diversity is what voting needs. That is why every ensemble method below is a recipe for making the members **different**.", r"投票需要的是差异。所以下面每一种集成方法，都是在教你怎么把成员做得**不一样**。"))),
            derive('binom', T('How much does an ensemble help? A binomial calculation', '集成能帮多少？一个二项分布的计算'),
                   [(r"P_{E} = P\bigl(K > \tfrac{n}{2}\bigr)",
                     T(r"Let $K$ be the number of wrong members and $P_E$ the ensemble error. With a majority vote of an odd number $n$ of members, the ensemble errs exactly when more than half of them err.", r"设 $K$ 为判错的成员数，$P_E$ 为集成的错误率。奇数 $n$ 个成员做多数投票，当且仅当超过一半成员判错时，集成才判错。")),
                    (r"n = 3:\quad P = \binom{3}{2}\epsilon^2(1-\epsilon) + \binom{3}{3}\epsilon^3",
                     T(r"Three members, each wrong with probability $\epsilon$, **independently**. Ensemble wrong = exactly 2 wrong (choose which 2: $\binom32 = 3$ ways, both wrong, the third right) or all 3 wrong.", r"三个成员，各自以概率 $\epsilon$ 出错，且**相互独立**。集成出错 = 恰好 2 个错（选哪 2 个：$\binom32 = 3$ 种，两个错、第三个对）或 3 个全错。")),
                    (S(r"\epsilon = 0.3:\quad P = 3(0.09)(0.7) + 0.027 = @be3_a@ + @be3_b@ = @be3@", r"\epsilon = 0.3:\quad P = 3(0.09)(0.7) + 0.027 = @be3_a@ + @be3_b@ = @be3@")['en'],
                     T(r"Three members of error 0.3 combine to error 0.216. Better than any member.", r"三个错误率 0.3 的成员，组合后错误率是 0.216，比任何一个成员都低。")),
                    (r"P = \sum_{i > n/2}^{n} \binom{n}{i}\,\epsilon^{\,i}\,(1-\epsilon)^{\,n-i}",
                     T(r"In general the number of wrong members is binomial: the probability of exactly $i$ wrong is $\binom ni\epsilon^i(1-\epsilon)^{n-i}$ (a sum of $n$ independent yes/no trials). Add up all $i$ above $n/2$.", r"一般地，判错的成员数服从二项分布：恰好 $i$ 个错的概率是 $\binom ni\epsilon^i(1-\epsilon)^{n-i}$（$n$ 次独立的“是/否”试验之和）。把所有大于 $n/2$ 的 $i$ 加起来。")),
                    (S(r"n = 25,\ \epsilon = 0.35:\quad P = \sum_{i=13}^{25}\binom{25}{i}\,0.35^{i}\,0.65^{25-i} = @be25@ \approx 0.06", r"n = 25,\ \epsilon = 0.35:\quad P = \sum_{i=13}^{25}\binom{25}{i}\,0.35^{i}\,0.65^{25-i} = @be25@ \approx 0.06")['en'],
                     T(r"The lecture's example: 25 independent classifiers with error 0.35 vote. Wrong needs at least 13 of them wrong. The ensemble error drops from 0.35 to about **0.06**.", r"课上的例子：25 个独立的、错误率 0.35 的分类器投票。判错需要至少 13 个出错。集成错误率从 0.35 降到约 **0.06**。")),
                    (S(r"\epsilon = 0.55,\ n = 25:\quad P = @be25_55@", r"\epsilon = 0.55,\ n = 25:\quad P = @be25_55@")['en'],
                     T(r"The same formula with members worse than chance: the ensemble gets **worse** (0.55 becomes 0.69). At $\epsilon = 0.5$ it stays 0.5.", r"同一个公式，成员比随机还差：集成**更差**（0.55 变成 0.69）。$\epsilon = 0.5$ 时仍是 0.5。"))],
                   intro=T(r"Assume (generously) that the $n$ base classifiers err **independently**, each with probability $\epsilon$. How often does the majority vote err?", r"（很慷慨地）假设 $n$ 个基分类器**相互独立**地出错，每个的错误概率都是 $\epsilon$。多数投票多久会出错一次？"),
                   outro=T(r"This is the arithmetic behind Intuition 1: many weak classifiers with $\epsilon < 0.5$ make a strong one. The catch is the word *independently*.", r"这就是直觉 1 背后的算术：许多 $\epsilon < 0.5$ 的弱分类器能组成一个强分类器。关键是“相互独立”这个词。"),
                   skill=vote),
            read('curve', T('The error curve, and the catch', '错误率曲线，与它的陷阱'),
                 svg(drawn(fig_vote), T('Ensemble error against base classifier error for 25 members. The independent curve is S-shaped, below the diagonal when the base error is under 0.5 and above it when over 0.5; identical classifiers lie on the diagonal. The point 0.35 maps to 0.06.', '25 个成员的集成错误率对单个分类器错误率的曲线。相互独立时曲线呈 S 形：单个错误率低于 0.5 时在对角线下面，高于 0.5 时在上面；完全相同的分类器落在对角线上。0.35 对应 0.06。')),
                 table([T('members $n$', '成员数 $n$'), T('ensemble error ($\\epsilon = 0.35$)', r'集成错误率（$\epsilon = 0.35$）')],
                       *[[str(n), V[f'bn{n}']] for n in (1, 3, 5, 11, 25, 101)]),
                 ul(T(r"**Below 0.5** the ensemble beats its members, and more members help more. **Above 0.5** it is worse: \"better than chance\" is a real condition.", r"**低于 0.5**：集成优于成员，成员越多越有利。**高于 0.5**：集成更差：“好于随机”是个实在的条件。"),
                    T(r"The orange curve assumes independence, which is **usually false**: members trained on the same data make correlated errors. The blue diagonal is the other extreme, identical members. Real ensembles sit between the two, and the whole art is pushing them toward the orange curve. How correlation limits the gain is derived below.", r"橙色曲线假设了独立性，而这**通常不成立**：用同一份数据训练的成员，错误是相关的。蓝色对角线是另一个极端，成员完全相同。真实的集成落在两者之间，全部技巧就是把它往橙色曲线那边推。相关性怎样限制收益，下面会推出来。")),
                 quiz(T(r"Five classifiers each have error 0.3 but always make the **same** mistakes. What is the error of their majority vote?", r"五个分类器错误率都是 0.3，但总是犯**同样**的错。它们多数投票的错误率是多少？"),
                      [(T(r"$0.163$, as the binomial formula says for $n = 5$", r"$0.163$，按 $n = 5$ 的二项公式"), T(r"The binomial formula needs independent errors. Here they are perfectly correlated.", r"二项公式要求错误独立。这里它们完全相关。")),
                       (T(r"$0.7$", r"$0.7$"), T(r"The vote is wrong exactly when the shared mistake happens, i.e. on 30% of instances, not 70%.", r"只在那个共同的错误出现时投票才错，也就是 30% 的实例，不是 70%。")),
                       (T(r"$0.3$: no better than one of them", r"$0.3$：不比其中一个更好"), True)],
                      T(r"Perfectly correlated members are one member. The diagonal of the figure.", r"完全相关的成员就是一个成员，对应图里的对角线。"))),
            read('stacking', T('Stacking: learn how to combine', '堆叠：学会怎么组合'),
                 p(T(r"Voting treats every member alike. **Stacking** (stacked generalisation) instead *learns* how much to trust each one. The intuition: smooth out the errors over algorithms with different biases.",
                     r"投票对每个成员一视同仁。**堆叠**（stacking，stacked generalisation）则是*学出来*该多信任每一个成员。直觉：把不同偏差的算法的错误互相抹平。")),
                 ul(T(r"**Level 0:** train different base classifiers on the training data $(X, y)$, for example a neural network, Naive Bayes and a decision tree.", r"**第 0 层：** 在训练数据 $(X, y)$ 上训练不同的基分类器，如神经网络、朴素贝叶斯、决策树。"),
                    T(r"**New data:** for each instance form $X_{new} = [\hat y_{C_1}, \hat y_{C_2}, \hat y_{C_3}, \dots, X_{old}]$: the predictions, optionally their confidences (e.g. NB probabilities), and optionally the original features (keep or discard $X$).", r"**新数据：** 对每个实例构造 $X_{new} = [\hat y_{C_1}, \hat y_{C_2}, \hat y_{C_3}, \dots, X_{old}]$：各分类器的预测，可选地加上它们的置信度（如 NB 的概率），也可选地保留原特征（保留或丢弃 $X$）。"),
                    T(r"**Level 1:** train a **meta-classifier** on $X_{new}$ to predict $y$. Typically logistic regression. Its weights are how much it trusts each base classifier.", r"**第 1 层：** 在 $X_{new}$ 上训练一个**元分类器**（meta-classifier）去预测 $y$，通常是逻辑回归。它的权重就是对每个基分类器的信任程度。")),
                 table([T('Strengths', '优点'), T('Weaknesses', '缺点')],
                       [T('mathematically simple; combines **heterogeneous** classifiers of varying quality', '数学上简单；能组合**不同类型**、水平不一的分类器'), T('computationally expensive: many models plus a meta-model, with cross-validation', '计算昂贵：许多模型加一个元模型，还要交叉验证')],
                       [T('generally as good as, or better than, the best base classifier', '通常不比最好的基分类器差，甚至更好'), T('less interest in theory (statistical learning); mostly seen in applied work', '理论上关注较少（统计学习），多见于应用研究')])),
            read('stack_cv', T('Building the meta-classifier\'s training data without cheating', '怎样不作弊地造出元分类器的训练数据'),
                 p(T(r"A trap: the meta-classifier must learn from predictions the base models make on data they have **not seen**. If a decision tree grown to full depth predicts its own training instances, it is right every time, and the meta-classifier will learn \"always trust the tree\". At test time the tree is not perfect, and the stacked model is miscalibrated. So the question in the lecture is: how do we make sure none of the level-0 classifiers sees the level-1 test data?",
                     r"一个陷阱：元分类器必须从基模型在**没见过的数据**上做出的预测里学习。如果一棵长满的决策树去预测它自己的训练实例，它每次都对，元分类器就会学成“永远相信这棵树”。到测试时，这棵树并不完美，堆叠的模型就失准了。所以课上的问题是：怎么保证没有一个第 0 层分类器见过第 1 层的测试数据？")),
                 svg(drawn(fig_stack), T('Three rows of three blocks: in each row two blue blocks are used for training the level-0 model and one orange block is held out. The held-out predictions of the three rows are collected into one table of out-of-fold predictions, the training data of the level-1 meta-classifier.', '三行、每行三块：每行两块蓝色用来训练第 0 层模型，一块橙色留出。三行留出部分的预测汇集成一张折外预测表，作为第 1 层元分类器的训练数据。')),
                 ol(T(r"Split the training data into $K$ folds. For each fold, train every level-0 model on the other $K-1$ folds and predict the held-out fold.", r"把训练数据分成 $K$ 折。对每一折，用其余 $K-1$ 折训练每个第 0 层模型，再预测这一折。"),
                    T(r"Stack the held-out predictions. Every training instance now has **out-of-fold** predictions, made by models that never saw it. This is the level-1 training set.", r"把留出折上的预测叠起来。每个训练实例现在都有**折外**（out-of-fold）预测，由从没见过它的模型做出。这就是第 1 层的训练集。"),
                    T(r"Train the meta-classifier on it. At test time use level-0 models retrained on all the data.", r"在它上面训练元分类器。测试时用在全部数据上重训的第 0 层模型。")),
                 p(T(r"The lecture draws this as **nested cross-validation**: the internal (level-0) models are never exposed to the level-1 test split, they still get enough data to train, and every instance can serve as level-1 test data, so all the data is used to evaluate the meta-classifier.",
                     r"课上把它画成**嵌套交叉验证**：内层（第 0 层）模型从不接触第 1 层的测试折，却仍有足够数据可训练，并且每个实例都能当第 1 层的测试数据，所以全部数据都用来评估元分类器。")),
                 quiz(T('The meta-classifier is trained on predictions that the base models made on their own training data. What goes wrong?', '元分类器用的是基模型对自己训练数据做出的预测。会出什么问题？'),
                      [(T('Nothing: more data is always better', '没问题：数据越多越好'), T(r"The predictions are not more data, they are biased data: an overfit model looks perfect on what it has seen.", r"这些预测不是更多数据，而是有偏的数据：过拟合的模型对见过的数据看起来完美。")),
                       (T('The meta-classifier cannot be trained because the labels are missing', '元分类器没法训练，因为缺标签'), T(r"The labels $y$ are there. The problem is how reliable the base predictions are.", r"标签 $y$ 是有的。问题在于基模型预测有多可靠。")),
                       (T('It over-trusts the base models that overfit most, and test performance disappoints', '它会过度信任过拟合最严重的基模型，测试表现令人失望'), True)],
                      T(r"Out-of-fold predictions imitate what the base models will do on genuinely new data, which is what the meta-classifier has to be trained for.", r"折外预测模仿了基模型在真正新数据上的表现，而这才是元分类器要学会应对的。")),
                 ),
            read('bagging', T('Bagging: more data from the same data', '装袋：从同一份数据里变出更多数据'),
                 p(T(r"The intuition: more data means lower variance, but we have only one training set. **Bagging** (bootstrap aggregating) makes new training sets from it by **sampling with replacement**.",
                     r"直觉：数据越多，方差越低，可我们只有一份训练集。**装袋**（bagging，bootstrap aggregating）用**有放回采样**从它造出新的训练集。")),
                 ol(T(r"From the $N$ training instances draw $N$ times **with replacement**: a **bootstrap sample**, the same size as the original, with some instances repeated and others missing.", r"从 $N$ 个训练实例中**有放回**地抽 $N$ 次：得到一份**自助样本**（bootstrap sample），大小和原来一样，有些实例重复出现，有些缺席。"),
                    T(r"Do it $k$ times; train one base classifier (the same algorithm) on each sample.", r"这样做 $k$ 次；在每份样本上训练一个基分类器（同一个算法）。"),
                    T(r"Predict by majority vote (classification) or average (regression).", r"用多数投票（分类）或平均（回归）来预测。")),
                 p(S(r"Example with $N = 10$: from the instances $1, \dots, 10$ one bootstrap sample is $@bsample@$. It holds only @bunique@ distinct instances; $@bmissing@$ are missing.", r"例：$N = 10$，从实例 $1, \dots, 10$ 抽出的一份自助样本是 $@bsample@$。它只含 @bunique@ 个不同的实例，缺了 $@bmissing@$。")),
                 h(T('When it works', '什么时候有效')),
                 ul(T(r"The base algorithm must be **unstable** (high variance: small changes in the data change the model a lot), for example a deep decision tree or a $1$-nearest-neighbour classifier. A stable method such as Naive Bayes barely changes between samples, so there is nothing to average away.", r"基算法必须**不稳定**（方差高：数据小变动，模型大变动），例如深的决策树、1-最近邻。朴素贝叶斯这类稳定方法，在不同样本间几乎不变，没有什么可平均掉的。"),
                    T(r"Simple (sampling and voting), **parallelisable** (the members are independent), and highly effective on **noisy** data: an outlier is missing from about a third of the samples and its influence is diluted.", r"简单（采样加投票）、可以**并行**（成员互相独立），在**有噪声**的数据上很有效：一个离群点会缺席约三分之一的样本，影响被冲淡。"),
                    T(r"Generally much better than a single base classifier, and only occasionally substantially worse.", r"通常明显好于单个基分类器，只是偶尔会明显更差。")),
                 details(T('Out-of-bag error: a free test set', '袋外误差：免费的测试集'),
                         p(T(r"Each bootstrap sample leaves out about 37% of the instances (derived next). Predict every training instance using **only the trees whose samples did not contain it** and compare with its label: the **out-of-bag (OOB) error**. It is an honest error estimate that needs no separate validation set.", r"每份自助样本都会漏掉约 37% 的实例（下面推导）。对每个训练实例，**只用样本中不含它的那些树**来预测，再和标签比较，得到**袋外（OOB）误差**。这是一个诚实的误差估计，不需要另留验证集。"))),
                 chapter=T('Bagging and random forests', '装袋与随机森林')),
            derive('boot', T('How much of the data does a bootstrap sample contain?', '一份自助样本含多少数据？'),
                   [(r"q_1 = 1 - \frac1N",
                     T(r"$q_1$ is the chance that instance $j$ is missed by one draw. Each draw picks one of the $N$ instances uniformly, so a given instance is **not** picked with probability $1 - 1/N$.", r"$q_1$ 是实例 $j$ 在一次抽取中被漏掉的概率。每次抽取从 $N$ 个实例中均匀地选一个，所以某个实例**没**被选中的概率是 $1 - 1/N$。")),
                    (r"q_N = q_1^{\,N} = \Bigl(1 - \frac1N\Bigr)^{N}",
                     T(r"$q_N$ is the chance of being missed by all $N$ draws. The draws are independent (sampling with replacement), so the probabilities multiply.", r"$q_N$ 是 $N$ 次抽取全都漏掉它的概率。各次抽取相互独立（有放回），所以概率相乘。")),
                    (r"\ln\Bigl(1 - \frac1N\Bigr)^{N} = N\,\ln\Bigl(1 - \frac1N\Bigr)",
                     T(r"Take the logarithm to turn the power into a product.", r"取对数，把幂变成乘积。")),
                    (r"\ln(1 - x) = -x - \tfrac{x^2}{2} - \cdots \;\Rightarrow\; N\ln\Bigl(1-\tfrac1N\Bigr) = -1 - \tfrac{1}{2N} - \cdots",
                     T(r"For small $x$, $\ln(1-x) \approx -x$ (Taylor series). Put $x = 1/N$ and multiply by $N$: the leading term is exactly $-1$, the rest shrinks as $N$ grows.", r"$x$ 小时 $\ln(1-x) \approx -x$（泰勒展开）。令 $x = 1/N$ 再乘 $N$：首项恰好是 $-1$，其余项随 $N$ 变大而消失。")),
                    (S(r"\Bigl(1 - \frac1N\Bigr)^{N} \;\longrightarrow\; e^{-1} = @out_inf@", r"\Bigl(1 - \frac1N\Bigr)^{N} \;\longrightarrow\; e^{-1} = @out_inf@")['en'],
                     T(r"Exponentiate back. The chance that an instance is **left out** tends to $1/e \approx 0.368$.", r"再取指数。一个实例**被漏掉**的概率趋于 $1/e \approx 0.368$。")),
                    (S(r"1 - q_N = 1 - \Bigl(1 - \frac1N\Bigr)^{N} \;\longrightarrow\; 1 - \frac1e \approx @in_inf@", r"")['en'],
                     T(r"So a bootstrap sample contains about **63.2%** of the distinct training instances.", r"所以一份自助样本约含**63.2%** 的不同训练实例。")),
                    (S(r"N = 5: @in5@ \quad N = 10: @in10@ \quad N = 100: @in100@ \quad N = 1000: @in1000@", r"N = 5: @in5@ \quad N = 10: @in10@ \quad N = 100: @in100@ \quad N = 1000: @in1000@")['en'],
                     T(r"The limit is reached quickly: already at $N = 10$ it is 0.65.", r"极限很快就到了：$N = 10$ 时已经是 0.65。"))],
                   intro=T(r"The lecture's bootstrap example shows repeats and missing instances. How many instances are missing, on average, for large $N$?", r"课上的自助采样例子里有重复的，也有缺席的实例。$N$ 很大时，平均缺席多少？"),
                   outro=T(r"Each tree trains on roughly 63% of the data and is tested (out of bag) on the other 37%. Because the 63% overlaps a lot between samples, the trees are correlated: the next derivation shows why that limits what averaging can do.", r"每棵树大约用 63% 的数据训练，用另外 37% 来（袋外）测试。不同样本之间这 63% 重叠很多，所以树之间是相关的：下一个推导会说明这怎样限制了平均的效果。"),
                   skill=bag),
            read('rf', T('Random forests: decorrelate the trees', '随机森林：让树互不相像'),
                 p(T(r"A **random tree** is a decision tree where, at each node, only a random subset of the attributes is considered (a fixed proportion, or about $\sqrt F$ of the $F$ features, a common default; Breiman 2001). It is faster to build than a normal tree, and as a single model it has **higher variance**. This is **feature manipulation**.",
                     r"**随机树**是这样一棵决策树：在每个节点，只考虑随机抽取的一部分属性（一个固定比例，或者 $F$ 个特征里约 $\sqrt F$ 个，这是常见的默认值；Breiman 2001）。它比普通树建得快，作为单个模型**方差更高**。这是**特征操纵**。")),
                 p(T(r"A **random forest** is an ensemble of random trees combined by voting, each trained on its own **bootstrap sample** (instance manipulation). Two sources of randomness, one purpose: to minimise the ensemble's variance without adding bias.",
                     r"**随机森林**是用投票组合起来的一批随机树，每棵树各用自己的**自助样本**训练（实例操纵）。两重随机性，一个目的：在不增加偏差的前提下，把集成的方差压到最低。")),
                 table([T('Strengths', '优点'), T('Limits', '局限')],
                       [T('Generally a very strong performer; robust to overfitting (more trees do not overfit)', '通常表现很强；抗过拟合（树越多不会过拟合）'), T('Interpretability sacrificed (hundreds of trees)', '牺牲了可解释性（几百棵树）')],
                       [T('Parallelisable, surprisingly efficient', '可并行，出乎意料地高效'), T('Each single random tree has higher variance than a normal tree', '单棵随机树的方差比普通树高')]),
                 quiz(T('In a random forest, why is each split chosen from a random subset of the features?', '随机森林里，为什么每次分裂只从随机抽取的一部分特征里选？'),
                      [(T('To make each tree more accurate on its own', '让每棵树自身更准'), T(r"It does the opposite: a single random tree is usually a bit **worse** than a normal tree.", r"恰恰相反：单棵随机树通常比普通树略**差**。")),
                       (T('To make the trees different from each other, so averaging them removes more variance', '让树彼此不同，这样平均能消除更多方差'), True),
                       (T('To remove the bias of the trees', '消除树的偏差'), T(r"Averaging does not change the bias of its members; the lever here is variance.", r"平均不会改变成员的偏差；这里起作用的杠杆是方差。"))],
                      T(r"If one feature is very strong, every bootstrap tree splits on it first and the trees look alike (high correlation $\rho$). Hiding it from some splits decorrelates them. The next derivation shows how much $\rho$ matters.", r"如果有一个特征特别强，每棵自助树都会先拿它分裂，树就长得很像（相关性 $\rho$ 高）。在一些分裂里把它藏起来，树就不那么像了。下一个推导会说明 $\rho$ 有多重要。"))),
            derive('var', T('Why averaging reduces variance', '为什么平均能降低方差'),
                   [(r"\bar f(x) = \frac1M\sum_{i=1}^{M} f_i(x)",
                     T(r"The ensemble's prediction is the average of the $M$ members' predictions at a point $x$ (for classification, think of the predicted score).", r"集成的预测是 $M$ 个成员在点 $x$ 处预测的平均（分类时，把预测的得分当作这个量）。")),
                    (r"\mathrm{Var}(\bar f) = \frac{1}{M^2}\,\mathrm{Var}\Bigl(\sum_i f_i\Bigr)",
                     T(r"A constant factor comes out of a variance **squared**: $\mathrm{Var}(cX) = c^2\mathrm{Var}(X)$, here $c = 1/M$.", r"常数因子从方差里提出来要**平方**：$\mathrm{Var}(cX) = c^2\mathrm{Var}(X)$，这里 $c = 1/M$。")),
                    (r"= \frac{1}{M^2}\Bigl(\sum_i \mathrm{Var}(f_i) + \sum_{i\neq j}\mathrm{Cov}(f_i, f_j)\Bigr)",
                     T(r"The variance of a sum is the sum of the variances **plus every pairwise covariance**. If the members were independent the covariances would vanish.", r"和的方差等于各方差之和**再加上每一对的协方差**。如果成员相互独立，协方差就消失了。")),
                    (r"\mathrm{Var}(f_i) = \sigma^2, \qquad \mathrm{Cov}(f_i, f_j) = \rho\,\sigma^2",
                     T(r"Assume each member has variance $\sigma^2$ (over the randomness of the training sample) and each pair has correlation $\rho$, so covariance $\rho\sigma^2$.", r"假设每个成员的方差为 $\sigma^2$（针对训练样本的随机性），每一对的相关系数为 $\rho$，协方差就是 $\rho\sigma^2$。")),
                    (r"\#\{(i,j) : i \neq j\} = M(M-1)",
                     T(r"Count the ordered pairs with $i \neq j$: $M$ choices of $i$, then $M-1$ of $j$.", r"数 $i \neq j$ 的有序对：$i$ 有 $M$ 种选法，$j$ 再有 $M-1$ 种。")),
                    (r"\mathrm{Var}(\bar f) = \frac{1}{M^2}\bigl(M\sigma^2 + M(M-1)\,\rho\sigma^2\bigr)",
                     T(r"$M$ variance terms and $M(M-1)$ covariance terms.", r"$M$ 个方差项，$M(M-1)$ 个协方差项。")),
                    (r"= \frac{\sigma^2}{M} + \frac{M-1}{M}\,\rho\,\sigma^2",
                     T(r"Divide through by $M^2$.", r"整体除以 $M^2$。")),
                    (r"\mathrm{Var}(\bar f) = \rho\,\sigma^2 + \frac{1-\rho}{M}\,\sigma^2",
                     T(r"Use $\frac{M-1}{M} = 1 - \frac1M$: $\rho\sigma^2 - \frac{\rho\sigma^2}{M} + \frac{\sigma^2}{M}$, then collect the $\frac1M$ terms.", r"用 $\frac{M-1}{M} = 1 - \frac1M$：得 $\rho\sigma^2 - \frac{\rho\sigma^2}{M} + \frac{\sigma^2}{M}$，再把含 $\frac1M$ 的项合并。"),
                     T(r"Check the extremes: $\rho = 0$ gives $\sigma^2/M$; $\rho = 1$ gives $\sigma^2$ for every $M$.", r"验证两个极端：$\rho = 0$ 得 $\sigma^2/M$；$\rho = 1$ 时无论 $M$ 多大都是 $\sigma^2$。"))],
                   intro=T(r"Take $M$ models whose predictions at a point have the same variance $\sigma^2$ and are pairwise correlated with coefficient $\rho$. What is the variance of their average?", r"取 $M$ 个模型，它们在某点的预测方差都是 $\sigma^2$，两两相关系数是 $\rho$。它们的平均的方差是多少？"),
                   outro=T(r"A term that shrinks with $M$, $\frac{1-\rho}{M}\sigma^2$, and a **floor** that more members cannot touch, $\rho\sigma^2$.", r"一项随 $M$ 变小：$\frac{1-\rho}{M}\sigma^2$；另一项是更多成员也动不了的**下限**：$\rho\sigma^2$。"),
                   blank=(4, 'M*(M-1)', T(r"How many ordered pairs $(i,j)$ with $i \neq j$ are there among $M$ members?", r"$M$ 个成员里，$i \neq j$ 的有序对 $(i,j)$ 有多少个？"), ['M']),
                   skill=varsk, chapter=T('Why averaging works', '为什么平均有效')),
            read('var_read', T('What the formula says', '这个公式在说什么'),
                 math_(r"\mathrm{Var}(\bar f) = \rho\,\sigma^2 + \frac{1-\rho}{M}\,\sigma^2"),
                 svg(drawn(fig_var), T('Variance of the average against the number of members M for correlations 0, 0.3, 0.6 and 1. Each curve falls and flattens at a floor equal to its correlation; correlation 1 does not fall at all.', '成员数 M 增加时，平均的方差随之变化，相关系数分别为 0、0.3、0.6、1。每条曲线下降后在等于相关系数的水平处走平；相关系数为 1 的完全不降。')),
                 table([T('$\\rho$ ($\\sigma^2 = 1$)', r'$\rho$（$\sigma^2 = 1$）'), '$M = 1$', '$M = 10$', '$M = 100$', T('$M \\to \\infty$', r'$M \to \infty$')],
                       *[[f'{r:g}', V[f'var_{int(r * 10)}_1'], V[f'var_{int(r * 10)}_10'], V[f'var_{int(r * 10)}_100'], f'{r:g}'] for r in (0, 0.3, 0.6, 1)]),
                 ul(T(r"**Independent members** ($\rho = 0$): variance $\sigma^2/M$; add members and it vanishes.", r"**成员独立**（$\rho = 0$）：方差 $\sigma^2/M$，加成员它就消失。"),
                    T(r"**Correlated members:** the variance stops at $\rho\sigma^2$. With $\rho = 0.3$, a hundred trees give only a 3x reduction. **Decorrelating** the members matters more than adding more of them. This is why random forests hide features at each split, and why bagging gains less than the independent curve promised.", r"**成员相关：** 方差停在 $\rho\sigma^2$。$\rho = 0.3$ 时，一百棵树也只降到约三分之一。**降低相关性**比再加成员更重要。这正是随机森林在每次分裂时藏起一些特征的原因，也是装袋的收益达不到独立曲线所许诺的原因。"),
                    T(r"**Bias is untouched:** $E[\bar f] = E[f_i]$ when members share the same expectation. Averaging cuts variance only, so it helps low-bias, high-variance members (deep trees) and does nothing for high-bias ones (shallow stumps). That is the job of boosting.", r"**偏差不变：** 成员期望相同时 $E[\bar f] = E[f_i]$。平均只降方差，所以对低偏差、高方差的成员（深树）有帮助，对高偏差的成员（浅的树桩）没有用。那是提升的任务。")),
                 quiz(T(r"Members have $\rho = 0.3$ and $\sigma^2 = 1$. What does the variance of the average approach as $M$ grows?", r"成员的 $\rho = 0.3$，$\sigma^2 = 1$。$M$ 变大时，平均的方差趋近于多少？"),
                      [(T(r"$0$", r"$0$"), T(r"That needs $\rho = 0$. With positive correlation there is a floor.", r"那要 $\rho = 0$ 才行。相关性为正时存在下限。")),
                       (T(r"$0.3$", r"$0.3$"), True),
                       (T(r"$0.7$", r"$0.7$"), T(r"$0.7 = 1 - \rho$ is the part that **does** vanish, $\frac{1-\rho}{M}\sigma^2$. The floor is $\rho\sigma^2 = 0.3$.", r"$0.7 = 1 - \rho$ 是**会**消失的那部分，即 $\frac{1-\rho}{M}\sigma^2$。下限是 $\rho\sigma^2 = 0.3$。"))],
                      T(r"$\lim_{M\to\infty}\mathrm{Var}(\bar f) = \rho\sigma^2$.", r"$\lim_{M\to\infty}\mathrm{Var}(\bar f) = \rho\sigma^2$。"))),
            read('boost_intro', T('Boosting: focus on what is still wrong', '提升：盯住还没学会的部分'),
                 p(T(r"Bagging trains members independently and averages away their variance. **Boosting** works differently: members are trained **one after another**, and each one concentrates on the instances the previous ones got wrong. It reduces **bias**, and combines weak members (like one-split decision trees, **stumps**) into a strong one.",
                     r"装袋让成员相互独立地训练，靠平均抹掉方差。**提升**（boosting）完全不同：成员**一个接一个**地训练，每一个都专注于前面成员判错的实例。它降低的是**偏差**，能把弱的成员（比如只分裂一次的决策树，**树桩**）合成一个强的。")),
                 ol(T(r"Start with every instance weighted equally, $w_j = 1/N$.", r"开始时每个实例权重相等，$w_j = 1/N$。"),
                    T(r"Repeat for $T$ rounds: train a classifier $C_i$ with the current instance weights (or on a sample drawn according to them); measure its weighted error; **raise the weights of misclassified instances and lower the others**.", r"重复 $T$ 轮：用当前的实例权重（或按权重抽出的样本）训练一个分类器 $C_i$；度量它的加权错误率；**把判错实例的权重调高，其余的调低**。"),
                    T(r"Combine all the classifiers by **weighted** voting: a better classifier gets a bigger vote.", r"用**加权**投票组合所有分类器：越好的分类器票越重。")),
                 h(T('AdaBoost (adaptive boosting)', 'AdaBoost（自适应提升）')),
                 p(T(r"Labels $y \in \{-1, +1\}$, base classifiers $C_i$ (stumps), instance weights $w_j$ that sum to 1. In round $i$:", r"标签 $y \in \{-1, +1\}$，基分类器 $C_i$（树桩），实例权重 $w_j$ 之和为 1。第 $i$ 轮：")),
                 math_(r"\epsilon_i = \sum_{j=1}^{N} w_j\,\delta\bigl(C_i(x_j) \neq y_j\bigr)"),
                 math_(r"\alpha_i = \frac12\ln\frac{1-\epsilon_i}{\epsilon_i}"),
                 math_(r"w_j \leftarrow \frac{w_j\,e^{-\alpha_i\,y_j\,C_i(x_j)}}{Z_i}"),
                 math_(r"C^*(x) = \arg\max_y \sum_{i=1}^{T}\alpha_i\,\delta\bigl(C_i(x) = y\bigr) \;=\; \mathrm{sign}\Bigl(\sum_i \alpha_i C_i(x)\Bigr)"),
                 ul(T(r"$\epsilon_i$: the **weighted error**, the total weight of the instances $C_i$ gets wrong ($\delta = 1$ when the condition holds, else 0).", r"$\epsilon_i$：**加权错误率**，即 $C_i$ 判错的实例的权重之和（条件成立时 $\delta = 1$，否则为 0）。"),
                    T(r"$\alpha_i$: the classifier's **vote**, half the log-odds of being right.", r"$\alpha_i$：这个分类器的**票重**，即答对的对数几率的一半。"),
                    T(r"$Z_i$: the normaliser that makes the new weights sum to 1.", r"$Z_i$：归一化常数，让新权重之和为 1。"),
                    T(r"$C^*$: the final weighted vote (for two classes, the sign of the weighted sum).", r"$C^*$：最终的加权投票（两类时，加权和的符号）。")),
                 p(T(r"In words: a **misclassified** instance has $y\,C = -1$, so its weight is multiplied by $e^{\alpha_i} > 1$; a correct one by $e^{-\alpha_i} < 1$. The lecture states this direction (misclassified up, correct down); the exact factor is derived below.", r"换成话说：**判错**的实例 $y\,C = -1$，权重乘 $e^{\alpha_i} > 1$；判对的乘 $e^{-\alpha_i} < 1$。课件讲的是这个方向（错的调高、对的调低）；精确的系数在后面推导。")),
                 table([T('weighted error $\\epsilon$', r'加权错误率 $\epsilon$'), T('vote $\\alpha$', r'票重 $\alpha$'), T('meaning', '含义')],
                       ['0.01', V['al_1'], T('almost perfect: a very loud vote', '几乎完美：说话很响')],
                       ['0.1', V['al_10'], T('very good', '很好')],
                       ['0.2', V['al_20'], T('good', '好')],
                       ['0.3', V['al_30'], T('fair', '尚可')],
                       ['0.5', '0', T('random guessing: no vote', '随机猜测：没有发言权')],
                       ['0.6', '−' + V['al_neg'].lstrip('-'), T('worse than chance: negative vote (flip it)', '比随机还差：负票（反着用）')]),
                 ul(T(r"**We only trust classifiers that beat random guessing** ($\epsilon < 0.5$ so $\alpha > 0$). As long as every base classifier does, the training error is guaranteed to fall (bound derived below).", r"**我们只信任好于随机猜测的分类器**（$\epsilon < 0.5$，所以 $\alpha > 0$）。只要每个基分类器都做到，训练误差就一定下降（界在后面推导）。"),
                    T(r"Boosting is mathematically more complicated but computationally cheap; sequential, so more expensive than bagging. The training error falls fast, and the test error can keep falling after the training error reaches 0. In practice boosting tends to overfit, especially with noisy labels.", r"提升数学上更复杂，但计算便宜；因为是串行的，比装袋贵。训练误差下降很快，训练误差到 0 之后测试误差还可能继续下降。实际中提升容易过拟合，尤其是标签有噪声时。")),
                 chapter=T('Boosting and AdaBoost', '提升与 AdaBoost')),
            derive('ada_r1', T('AdaBoost, round 1, fully computed', 'AdaBoost 第 1 轮，完整计算'),
                   [(r"w_j = \frac{1}{10} = 0.1", T(r"Ten instances at $x = 1, \dots, 10$ with labels $+,+,+,-,-,-,-,+,+,+$. No single threshold separates them, so a stump will make mistakes. All weights start equal.", r"十个实例，$x = 1, \dots, 10$，标签 $+,+,+,-,-,-,-,+,+,+$。没有哪个阈值能把它们分开，所以树桩必然出错。权重一开始都相等。")),
                    (r"C_1(x) = \begin{cases} +1 & x \le 3.5 \\ -1 & x > 3.5 \end{cases}", T(r"The best stump under these weights. It is wrong exactly on $x = 8, 9, 10$ (it predicts $-1$ there).", r"在这些权重下最好的树桩。它恰好在 $x = 8, 9, 10$ 上出错（那里它预测 $-1$）。")),
                    (S(r"\epsilon_1 = 3 \times 0.1 = @eps1@", r"\epsilon_1 = 3 \times 0.1 = @eps1@")['en'], T(r"The weighted error is the total weight of the mistakes.", r"加权错误率就是错误实例的权重之和。")),
                    (S(r"\alpha_1 = \tfrac12\ln\frac{0.7}{0.3} = @alpha1@", r"\alpha_1 = \tfrac12\ln\frac{0.7}{0.3} = @alpha1@")['en'], T(r"The vote of $C_1$: positive, because $0.3 < 0.5$.", r"$C_1$ 的票重：为正，因为 $0.3 < 0.5$。")),
                    (S(r"e^{\alpha_1} = @exp_up1@, \qquad e^{-\alpha_1} = @exp_dn1@", r"")['en'], T(r"The multipliers for the instance weights: $e^{\alpha_1}$ for the three mistakes (up), $e^{-\alpha_1}$ for the seven others (down).", r"实例权重的乘数：三个错误实例乘 $e^{\alpha_1}$（升），其余七个乘 $e^{-\alpha_1}$（降）。")),
                    (S(r"Z_1 = 7(0.1)(@exp_dn1@) + 3(0.1)(@exp_up1@) = @Z1@", r"Z_1 = 7(0.1)(@exp_dn1@) + 3(0.1)(@exp_up1@) = @Z1@")['en'], T(r"The weights after multiplying no longer sum to 1; their total $Z_1$ is the normaliser.", r"乘完之后权重之和不再是 1；它们的总和 $Z_1$ 就是归一化常数。")),
                    (S(r"w_{8,9,10} = \frac{0.1(@exp_up1@)}{@Z1@} = @up1@, \qquad w_{1..7} = \frac{0.1(@exp_dn1@)}{@Z1@} = @dn1@", r"w_{8,9,10} = \frac{0.1(@exp_up1@)}{@Z1@} = @up1@, \qquad w_{1..7} = \frac{0.1(@exp_dn1@)}{@Z1@} = @dn1@")['en'],
                     T(r"The new weights. The three mistakes went from 0.1 to 0.1667 each, the seven others from 0.1 to 0.0714. Check: $3(0.1667) + 7(0.0714) = 1$.", r"新的权重。三个错误实例各从 0.1 升到 0.1667，其余七个从 0.1 降到 0.0714。验算：$3(0.1667) + 7(0.0714) = 1$。"),
                     T(r"The mistakes now hold total weight exactly 0.5: $\frac{\epsilon e^{\alpha}}{Z} = \frac{\epsilon\sqrt{(1-\epsilon)/\epsilon}}{2\sqrt{\epsilon(1-\epsilon)}} = \frac12$. So $C_1$ would be at chance on the new weights, and round 2 must find something different.", r"错误实例的权重之和现在恰好是 0.5：$\frac{\epsilon e^{\alpha}}{Z} = \frac{\epsilon\sqrt{(1-\epsilon)/\epsilon}}{2\sqrt{\epsilon(1-\epsilon)}} = \frac12$。所以在新权重下 $C_1$ 恰好和随机一样，第 2 轮必须找出不同的东西。"))],
                   outro=T(r"The next two rounds follow the same recipe; the table on the next page has all the numbers.", r"接下来两轮照同样的方法；下一页的表里有全部数字。"),
                   skill=ada, chapter=T('AdaBoost by hand', '手算 AdaBoost')),
            read('ada_rounds', T('Three rounds and the final vote', '三轮，以及最后的投票'),
                 rounds_tbl,
                 p(T(r"Instance weights at the start of each round (round 1 is uniform) and the final score $F(x) = \sum_t \alpha_t C_t(x)$:", r"每轮开始时的实例权重（第 1 轮是均匀的），以及最终得分 $F(x) = \sum_t \alpha_t C_t(x)$：")),
                 wt_tbl,
                 ul(T(r"Round 2 puts weight 0.1667 on $x = 8, 9, 10$ and finds the stump that gets them right (but now misses $x = 1, 2, 3$, with $\epsilon_2 = 0.2143$). Round 3 finds a different compromise. Each round's mistakes are other instances.", r"第 2 轮把 0.1667 的权重压在 $x = 8, 9, 10$ 上，找到能判对它们的树桩（但现在错了 $x = 1, 2, 3$，$\epsilon_2 = 0.2143$）。第 3 轮找出另一种折中。每轮的错误都落在不同的实例上。"),
                    T(r"The sign of $F(x)$ is the prediction. It is **correct on all ten instances**, although each stump alone makes 3 or 4 mistakes. Three weak classifiers made a perfect one: Intuition 1, through weights instead of independence.", r"$F(x)$ 的符号就是预测。它在**全部十个实例上都对**，尽管每个树桩单独都错 3 到 4 个。三个弱分类器造出了一个完美的分类器：直觉 1，靠的是权重而不是独立性。")),
                 h(T('The lecture\'s weighted vote', '课件里的加权投票')),
                 table(['C', T('predicts', '预测'), 'α'], ['C₁', '+1', '1.0'], ['C₂', '−1', '3.0'], ['C₃', '+1', '1.5']),
                 p(T(r"The vote is $C^*(x) = \arg\max_y \sum_i \alpha_i\,\delta(C_i(x) = y)$: total weight behind $+1$ is $1.0 + 1.5 = 2.5$, behind $-1$ is $3.0$. The answer is **$-1$**, although two of three classifiers say $+1$.", r"投票 $C^*(x) = \arg\max_y \sum_i \alpha_i\,\delta(C_i(x) = y)$：支持 $+1$ 的总权重是 $1.0 + 1.5 = 2.5$，支持 $-1$ 的是 $3.0$。结果是 **$-1$**，尽管三个里有两个说 $+1$。")),
                 quiz(T(r"$C_2$ has $\alpha_2 = 3.0$. What weighted error does it have?", r"$C_2$ 的 $\alpha_2 = 3.0$。它的加权错误率是多少？"),
                      [(T(r"About $0.95$", r"约 $0.95$"), T(r"A large $\alpha$ means a **low** error: $\alpha = \frac12\ln\frac{1-\epsilon}{\epsilon}$ grows as $\epsilon \to 0$.", r"$\alpha$ 大意味着错误率**低**：$\alpha = \frac12\ln\frac{1-\epsilon}{\epsilon}$ 在 $\epsilon \to 0$ 时变大。")),
                       (T(r"About $0.5$", r"约 $0.5$"), T(r"At $\epsilon = 0.5$, $\alpha = 0$: no voice at all.", r"$\epsilon = 0.5$ 时 $\alpha = 0$：完全没有发言权。")),
                       (S(r"About $@deck_eps3@$: $\epsilon = \frac{1}{1+e^{2\alpha}}$", r"约 $@deck_eps3@$：$\epsilon = \frac{1}{1+e^{2\alpha}}$"), True)],
                      T(r"Invert $\alpha = \frac12\ln\frac{1-\epsilon}{\epsilon}$: $e^{2\alpha} = \frac{1-\epsilon}{\epsilon}$, so $\epsilon = \frac{1}{1+e^{2\alpha}} = \frac{1}{1+e^{6}}$, a nearly perfect classifier, which deserves to outvote the other two together.", r"把 $\alpha = \frac12\ln\frac{1-\epsilon}{\epsilon}$ 反过来：$e^{2\alpha} = \frac{1-\epsilon}{\epsilon}$，所以 $\epsilon = \frac{1}{1+e^{2\alpha}} = \frac{1}{1+e^{6}}$，几乎完美的分类器，理应压过另外两个之和。"))),
            derive('ada_alpha', T('Where AdaBoost\'s vote weights and instance weights come from', 'AdaBoost 的票重与实例权重从哪来'),
                   [(r"L(F) = \sum_{j} e^{-y_j F(x_j)}",
                     T(r"**Exponential loss** of the score $F$. $y\,F > 0$ means right: the loss is small and shrinks with confidence; $y\,F < 0$ means wrong: the loss is large. It is above the 0-1 error, so shrinking it shrinks the training error.", r"得分 $F$ 的**指数损失**。$y\,F > 0$ 表示判对：损失小，且越有把握越小；$y\,F < 0$ 表示判错：损失大。它高于 0-1 错误，所以把它压小，训练错误也被压小。")),
                    (r"F_t = F_{t-1} + \alpha\,C_t \;\Rightarrow\; e^{-yF_t} = e^{-yF_{t-1}}\,e^{-\alpha\,y\,C_t}",
                     T(r"Build the ensemble greedily, adding one classifier $C_t$ with vote $\alpha$ at a time. The exponential of a sum is a product.", r"贪心地构造集成，每次加一个分类器 $C_t$，票重为 $\alpha$。和的指数就是指数的积。")),
                    (r"w_j \propto e^{-y_j F_{t-1}(x_j)}",
                     T(r"The first factor is already fixed when we add $C_t$. It is **the instance weight**: large for instances the ensemble so far gets wrong or only just right. (At the start $F_0 = 0$, so all weights are equal.) This is where the multiplicative update $w_j \leftarrow w_j e^{-\alpha y C}$ comes from.", r"加入 $C_t$ 时，第一个因子已经固定。它就是**实例权重**：对目前的集成判错、或只是勉强判对的实例，它很大。（起点 $F_0 = 0$，所有权重相等。）乘法更新 $w_j \leftarrow w_j e^{-\alpha y C}$ 就是由此而来。")),
                    (r"L \;\propto\; \sum_j w_j\,e^{-\alpha\,y_j C_t(x_j)} = (1-\epsilon)\,e^{-\alpha} + \epsilon\,e^{\alpha}",
                     T(r"Split the instances. Where $C_t$ is right ($y\,C = +1$, total weight $1-\epsilon$) the factor is $e^{-\alpha}$; where it is wrong (total weight $\epsilon$) it is $e^{\alpha}$.", r"把实例分成两组。$C_t$ 判对的（$y\,C = +1$，总权重 $1-\epsilon$）因子是 $e^{-\alpha}$；判错的（总权重 $\epsilon$）因子是 $e^{\alpha}$。")),
                    (r"\frac{dL}{d\alpha} = -(1-\epsilon)\,e^{-\alpha} + \epsilon\,e^{\alpha} = 0",
                     T(r"Choose the vote $\alpha$ that minimises the loss: set the derivative to 0.", r"选使损失最小的票重 $\alpha$：令导数为 0。")),
                    (r"e^{2\alpha} = \frac{1-\epsilon}{\epsilon}",
                     T(r"Multiply by $e^{\alpha}$ and rearrange.", r"两边乘 $e^{\alpha}$ 整理。")),
                    (r"\alpha = \frac12\ln\frac{1-\epsilon}{\epsilon}",
                     T(r"Take the logarithm. This is the lecture's formula: **half the log-odds of being right.** A low error gives a big vote; $\epsilon = 0.5$ gives none.", r"取对数。这就是课件里的公式：**答对的对数几率的一半。** 错误率低，票重就大；$\epsilon = 0.5$ 就没有。")),
                    (r"L_{\min} \;\propto\; 2\sqrt{\epsilon\,(1-\epsilon)} < 1 \quad (\epsilon < \tfrac12)",
                     T(r"Substitute back: $(1-\epsilon)\sqrt{\frac{\epsilon}{1-\epsilon}} + \epsilon\sqrt{\frac{1-\epsilon}{\epsilon}} = 2\sqrt{\epsilon(1-\epsilon)}$. Every round with $\epsilon < \frac12$ shrinks the loss by this factor $Z_t$.", r"代回去：$(1-\epsilon)\sqrt{\frac{\epsilon}{1-\epsilon}} + \epsilon\sqrt{\frac{1-\epsilon}{\epsilon}} = 2\sqrt{\epsilon(1-\epsilon)}$。每一轮只要 $\epsilon < \frac12$，损失就乘上这个因子 $Z_t$ 而变小。")),
                    (S(r"E_{tr} \le \prod_t 2\sqrt{\epsilon_t(1-\epsilon_t)} = @prodbound@", r"")['en'],
                     T(r"$E_{tr}$ is the training error. The per-round factors multiply, and the 0-1 error is below the exponential loss. So **as long as each classifier beats chance, the training error bound falls exponentially in the number of rounds.** In our example the bound is 0.58 after 3 rounds while the real error is already 0: an upper bound, not tight. (Freund and Schapire 1997; the exponential-loss view is due to Friedman, Hastie and Tibshirani 2000.)", r"$E_{tr}$ 是训练误差。各轮的因子相乘，而 0-1 错误低于指数损失。所以**只要每个分类器都好于随机，训练误差的界就随轮数指数下降。** 在我们的例子里，3 轮后界是 0.58，而真实误差已经是 0：这是上界，并不紧。（Freund 与 Schapire 1997；指数损失的观点来自 Friedman、Hastie 与 Tibshirani 2000。）"))],
                   intro=T(r"The formulas for $\alpha_i$ and the weight update were just stated. Here is where they come from: AdaBoost greedily minimises the exponential loss. Use labels $y \in \{-1,+1\}$ and members $C_t(x) \in \{-1,+1\}$; the ensemble scores $F(x) = \sum_t \alpha_t C_t(x)$ and predicts $\mathrm{sign}\,F$.", r"$\alpha_i$ 和权重更新的公式刚才只是给出来的。它们的来源是：AdaBoost 在贪心地最小化指数损失。设标签 $y \in \{-1,+1\}$，成员 $C_t(x) \in \{-1,+1\}$；集成的得分是 $F(x) = \sum_t \alpha_t C_t(x)$，预测 $\mathrm{sign}\,F$。"),
                   skill=ada),
            read('compare', T('Bagging, boosting, stacking side by side', '装袋、提升、堆叠对照'),
                 table(['', T('Bagging', '装袋'), T('Boosting', '提升'), T('Stacking', '堆叠')],
                       [T('members trained', '成员训练方式'), T('in parallel, independently', '并行，相互独立'), T('sequentially, each corrects the last', '串行，后一个纠正前一个'), T('in parallel; then a meta-model', '并行；然后训练元模型')],
                       [T('data', '数据'), T('bootstrap samples (random)', '自助样本（随机）'), T('iteratively reweighted instances', '迭代地重新加权实例'), T('same data (out-of-fold predictions for level 1)', '同一份数据（第 1 层用折外预测）')],
                       [T('base algorithm', '基算法'), T('one, unstable (deep trees)', '一种，不稳定（深树）'), T('one, weak (stumps)', '一种，弱（树桩）'), T('different models, any kind', '不同的模型，任意种类')],
                       [T('combination', '组合方式'), T('simple vote / average', '简单投票/平均'), T('weighted vote ($\\alpha$)', r'加权投票（$\alpha$）'), T('learned (meta-classifier)', '学出来的（元分类器）')],
                       [T('reduces', '降低'), T('variance', '方差'), T('bias (instance bias)', '偏差（实例偏差）'), T('smooths the biases of different algorithms', '抹平不同算法的偏差')],
                       [T('overfitting', '过拟合'), T('not prone', '不易'), T('prone, esp. with noise', '容易，尤其有噪声时'), T('depends; guard with out-of-fold data', '视情况；靠折外数据防护')],
                       [T('cost', '代价'), T('cheap, parallelisable', '便宜，可并行'), T('more than bagging (sequential)', '比装袋贵（串行）'), T('expensive: many models + CV', '昂贵：很多模型加交叉验证')]),
                 callout('misconception', T('Noise', '噪声'),
                         T(r"A mislabelled instance is always misclassified, so boosting raises its weight round after round and the later classifiers contort themselves to fit it: boosting is sensitive to label noise. Bagging only sees it in some samples, and its vote dilutes the effect: bagging is robust to noise.", r"一个标错的实例总是被判错，所以提升一轮又一轮地加大它的权重，后面的分类器会扭曲自己去迎合它：提升对标签噪声敏感。装袋只在部分样本里碰到它，投票又把影响冲淡：装袋对噪声稳健。")),
                 p(T(r"General cost of any ensemble: more computation and memory, and less interpretability than one model. Reward: usually higher accuracy and lower variance.", r"任何集成的共同代价：计算和内存更多，可解释性不如单个模型。回报：通常准确率更高、方差更低。")),
                 quiz(T('You have deep, unpruned decision trees (low bias, high variance) on a noisy dataset. Which ensemble fits best?', '你有深而未剪枝的决策树（低偏差、高方差），数据有噪声。哪种集成最合适？'),
                      [(T('Boosting: it fixes the hard instances, which includes the noisy ones', '提升：它修正难的实例，包括那些噪声实例'), T(r"It would chase the noise, and its job (reducing bias) is not what deep trees need.", r"它会去追噪声，而且它的任务（降偏差）并不是深树所需要的。")),
                       (T('Bagging (a random forest): it averages the variance away and dilutes the noise', '装袋（随机森林）：把方差平均掉，并冲淡噪声'), True),
                       (T('Neither: ensembles only help weak classifiers', '都不用：集成只对弱分类器有用'), T(r"Intuition 2: ensembles of strong classifiers are usually at least as good as the best, and bagging is built for exactly such high-variance members.", r"直觉 2：强分类器的集成通常至少不比最好的差，而装袋正是为这类高方差成员设计的。"))],
                      T(r"Match the ensemble to the member's weakness: high variance, use bagging; high bias, use boosting.", r"根据成员的弱点选集成：方差高用装袋；偏差高用提升。")),
                 quiz(T('Which pairing is right?', '哪一个配对是对的？'),
                      [(T('Bagging reduces bias, boosting reduces variance', '装袋降偏差，提升降方差'), T(r"Reversed. Averaging independent-ish members cuts variance; boosting fits what is still wrong, cutting bias.", r"弄反了。平均近乎独立的成员降方差；提升拟合还没学会的东西，降偏差。")),
                       (T('Both reduce only variance', '两者都只降方差'), T(r"Boosting's stumps start with high bias; adding them in sequence fits the pattern they individually cannot.", r"提升用的树桩一开始偏差很高；串行地加起来，才拟合了它们单个拟合不了的模式。")),
                       (T('Bagging reduces variance, boosting reduces bias', '装袋降方差，提升降偏差'), True)],
                      T(r"Bagging: parallel, simple vote, minimises variance, not prone to overfitting. Boosting: iterative, weighted vote, minimises bias, prone to overfitting.", r"装袋：并行、简单投票、压方差、不易过拟合。提升：迭代、加权投票、压偏差、易过拟合。")),
                 chapter=T('Putting it together', '放到一起')),
            number('q_vote', T('Exam practice: majority vote of independent classifiers', '考试练习：独立分类器的多数投票'), vote,
                   T(r"Five independent classifiers each have error rate $0.3$. What is the error rate of their majority vote? Round to 3 decimals.", r"五个相互独立的分类器，错误率都是 $0.3$。它们多数投票的错误率是多少？保留 3 位小数。"),
                   round(binom_err(5, 0.3), 3), T(rf"The vote is wrong if at least 3 of 5 are wrong: $\binom53 0.3^3 0.7^2 + \binom54 0.3^4 0.7 + 0.3^5 = 0.1323 + 0.02835 + 0.00243 = {binom_err(5, 0.3):.4f}$.", rf"至少 3 个判错时投票才错：$\binom53 0.3^3 0.7^2 + \binom54 0.3^4 0.7 + 0.3^5 = 0.1323 + 0.02835 + 0.00243 = {binom_err(5, 0.3):.4f}$。"),
                   tolerance=0.002, hints=(T(r"Wrong means 3, 4 or 5 of the 5 members wrong.", r"判错意味着 5 个里有 3、4 或 5 个错。"),), chapter=T('Exam practice', '考试练习')),
            number('q_var', T('Exam practice: the variance of an average', '考试练习：平均的方差'), varsk,
                   T(r"Ten models have prediction variance $\sigma^2 = 4$ and pairwise correlation $\rho = 0.25$. What is the variance of their average?", r"十个模型，预测方差 $\sigma^2 = 4$，两两相关系数 $\rho = 0.25$。它们的平均的方差是多少？"),
                   round(var_avg(0.25, 10, 4.0), 2), T(rf"$\rho\sigma^2 + \frac{{1-\rho}}{{M}}\sigma^2 = 0.25 \times 4 + \frac{{0.75}}{{10}} \times 4 = 1 + 0.3 = {var_avg(0.25, 10, 4.0):.2f}$.", rf"$\rho\sigma^2 + \frac{{1-\rho}}{{M}}\sigma^2 = 0.25 \times 4 + \frac{{0.75}}{{10}} \times 4 = 1 + 0.3 = {var_avg(0.25, 10, 4.0):.2f}$。"),
                   tolerance=0.01),
            number('q_alpha', T('Exam practice: the classifier weight', '考试练习：分类器的权重'), ada,
                   T(r"In an AdaBoost round the weak classifier has weighted error $\epsilon = 0.2$. What is its weight $\alpha = \frac12\ln\frac{1-\epsilon}{\epsilon}$ (natural log)? Round to 3 decimals.", r"AdaBoost 的某一轮里，弱分类器的加权错误率 $\epsilon = 0.2$。它的权重 $\alpha = \frac12\ln\frac{1-\epsilon}{\epsilon}$（自然对数）是多少？保留 3 位小数。"),
                   round(alpha_of(0.2), 3), T(rf"$\alpha = \frac12\ln\frac{{0.8}}{{0.2}} = \frac12\ln 4 = \ln 2 = {alpha_of(0.2):.4f}$.", rf"$\alpha = \frac12\ln\frac{{0.8}}{{0.2}} = \frac12\ln 4 = \ln 2 = {alpha_of(0.2):.4f}$。"),
                   tolerance=0.002),
            number('q_update', T('Exam practice: a weight update', '考试练习：实例权重更新'), ada,
                   T(r"Ten instances start with weight $0.1$ each. The first classifier has $\epsilon = 0.3$ (3 instances wrong, $\alpha = 0.4236$). After the update and normalisation, what is the weight of one misclassified instance? Round to 3 decimals.", r"十个实例，权重起初各为 $0.1$。第一个分类器 $\epsilon = 0.3$（错 3 个，$\alpha = 0.4236$）。更新并归一化之后，一个被判错的实例的权重是多少？保留 3 位小数。"),
                   round(float(V['Q_up']), 3), T(rf"Unnormalised: $0.1\,e^{{0.4236}} = 0.1528$. Normaliser $Z = 7(0.0655) + 3(0.1528) = 0.9165$. New weight $0.1528/0.9165 = {V['Q_up']}$. (Shortcut: the 3 mistakes now carry half the weight: $0.5/3$.)", rf"未归一化：$0.1\,e^{{0.4236}} = 0.1528$。归一化常数 $Z = 7(0.0655) + 3(0.1528) = 0.9165$。新权重 $0.1528/0.9165 = {V['Q_up']}$。（捷径：3 个错误实例现在共占一半权重：$0.5/3$。）"),
                   tolerance=0.002, hints=(T(r"After normalising, the misclassified instances hold total weight $\frac12$.", r"归一化之后，被判错的实例共占权重 $\frac12$。"),)),
            choice('q_leak', T('Exam practice: stacking validation', '考试练习：堆叠的验证'), stack,
                   T('How should the training data of the meta-classifier in stacking be produced?', '堆叠里元分类器的训练数据应该怎样产生？'),
                   [(T('Predict the training instances with the base models trained on all of them', '用在全部训练数据上训练的基模型去预测这些训练实例'), T(r"The base models have seen these instances: their predictions are over-optimistic, and the meta-classifier learns to over-trust the models that overfit.", r"基模型见过这些实例：预测过于乐观，元分类器会学成过度信任那些过拟合的模型。"), 'leak'),
                    (T('Use random labels so the meta-classifier cannot cheat', '用随机标签，让元分类器没法作弊'), T(r"The meta-classifier needs the true labels $y$; cheating is prevented by what the base predictions have seen, not by hiding $y$.", r"元分类器需要真实标签 $y$；防作弊靠的是基模型预测有没有见过这些数据，而不是藏起 $y$。"), 'leak'),
                    (T('With cross-validation: each instance is predicted by base models that were trained without it (out-of-fold predictions)', '用交叉验证：每个实例都由没用它训练的基模型来预测（折外预测）'), True),
                    (T('Average the base models\' predictions instead of learning a meta-classifier', '不学元分类器，直接把基模型的预测平均'), T(r"That is plain voting, not stacking.", r"那是普通投票，不是堆叠。"), 'leak')],
                   T(r"Out-of-fold predictions imitate genuinely new data (nested cross-validation).", r"折外预测模仿了真正的新数据（嵌套交叉验证）。")),
            choice('q_bias_var', T('Exam practice: which ensemble for which weakness', '考试练习：什么弱点用什么集成'), cmp,
                   T('A single decision stump (one split) underfits badly: high bias. Which ensemble method addresses that?', '单个决策树桩（只分裂一次）严重欠拟合：偏差高。哪种集成方法能解决？'),
                   [(T('Bagging stumps trained on bootstrap samples', '对树桩做装袋，用自助样本训练'), T(r"Bagging averages variance. Averaged stumps are still stumps: the bias stays.", r"装袋平均的是方差。平均之后的树桩还是树桩：偏差不变。"), 'bag-bias'),
                    (T('Boosting stumps (AdaBoost)', '对树桩做提升（AdaBoost）'), True),
                    (T('A random forest with a larger feature subset', '加大特征子集的随机森林'), T(r"The feature subset controls the correlation of deep trees; it does not add the capacity that stumps lack.", r"特征子集控制的是深树之间的相关性；它不会补上树桩缺少的容量。"), 'bag-bias'),
                    (T('Simple voting of 100 copies of the same stump', '把同一个树桩复制 100 份做简单投票'), T(r"100 identical members are one member.", r"100 个相同的成员就是一个成员。"), 'copies')],
                   T(r"Boosting fits what the earlier members got wrong, so a sequence of stumps can represent what no single stump can (see the 10-point example).", r"提升拟合前面成员判错的部分，所以一串树桩能表示任何单个树桩表示不了的东西（见那个 10 点的例子）。")),
            tq('q_compare', T('Exam practice: bagging versus boosting (Section A)', '考试练习：装袋与提升的比较（A 部分）'), cmp,
                   T('Compare bagging and boosting in 3 lines or fewer.', '用三行以内比较装袋和提升。'),
                   ['bagging: parallel, bootstrap samples, simple vote; reduces variance; not prone to overfitting', 'boosting: sequential, reweights instances toward the hard ones, weighted vote; reduces bias', 'boosting is prone to overfitting and sensitive to noisy labels; bagging is robust'],
                   'Bagging trains independent classifiers in parallel on bootstrap samples and combines them by simple voting; it reduces variance and is not prone to overfitting. Boosting trains classifiers sequentially, raising the weights of misclassified instances, and combines them by weighted voting; it reduces bias, but is more expensive and prone to overfitting, especially with noisy labels.',
                   T('A marker looks for: parallel vs sequential, simple vs weighted vote, variance vs bias, and the overfitting/noise difference.', '阅卷看：并行与串行、简单投票与加权投票、方差与偏差，以及过拟合/噪声的差别。')),
            tq('q_design', T('Exam practice: choose an ensemble (Section C style)', '考试练习：选一种集成（C 部分风格）'), cmp,
                   T('A hospital wants to predict readmission from 200 noisy features and 5,000 patient records, with about 5% of labels wrong. A single deep decision tree overfits. Propose an ensemble approach, justify it, and say how you would estimate its error. Write about a third of a page.', '一家医院想用 200 个有噪声的特征和 5000 条病人记录预测再入院，约 5% 的标签有误。单棵深决策树过拟合。提出一种集成方案，说明理由，并说明怎样估计它的误差。写约三分之一页。'),
                   ['bagging / random forest: high-variance trees, averaging reduces variance, bootstrap dilutes noisy labels, parallelisable', 'random feature subsets at each split decorrelate the trees (the variance floor is rho sigma^2)', 'avoid or be careful with AdaBoost: it increases the weight of mislabelled instances and overfits noise', 'estimate error with out-of-bag error or cross-validation on held-out data; stacking with out-of-fold predictions is an option if several model types are available'],
                   'I would use a random forest. A deep tree has low bias and high variance, which is exactly what bagging fixes: averaging many trees trained on bootstrap samples lowers the variance, and the 5% wrong labels are diluted because each mislabelled record is absent from about 37% of the samples. Choosing a random subset of features at each split decorrelates the trees, which matters because the variance of the average has a floor of rho*sigma^2. I would avoid AdaBoost, which raises the weight of the mislabelled records every round and would overfit them. The error can be estimated by the out-of-bag error (each record predicted only by trees that did not see it) or by cross-validation. If several different model types performed well, stacking with out-of-fold predictions would be a further option.',
                   T('Match the ensemble to the problem: high-variance members and noise point to bagging / random forest; justify with the variance floor and noise sensitivity; name an honest error estimate.', '让集成方案匹配问题：高方差成员加噪声，指向装袋/随机森林；用方差下限和噪声敏感性来论证；说出诚实的误差估计办法。')),
            read('sheet', T('What to remember', '要记住的'),
                 table([T('Method', '方法'), T('Idea', '思路'), T('Key facts', '要点')],
                       [T('voting', '投票'), T('majority (class) / average (regression)', '多数（分类）/平均（回归）'), T('needs diverse, better-than-chance members; independent: error $\\sum_{i>n/2}\\binom ni\\epsilon^i(1-\\epsilon)^{n-i}$', r'需要多样、好于随机的成员；独立时错误率 $\sum_{i>n/2}\binom ni\epsilon^i(1-\epsilon)^{n-i}$')],
                       [T('stacking', '堆叠'), T('level 1 learns from level-0 predictions', '第 1 层从第 0 层的预测里学'), T('different models; out-of-fold predictions (nested CV); expensive', '不同的模型；折外预测（嵌套交叉验证）；昂贵')],
                       [T('bagging', '装袋'), T('bootstrap samples, vote', '自助样本，投票'), T('63.2% distinct per sample, 36.8% out-of-bag; unstable base; variance down', '每份样本含 63.2% 不同实例，36.8% 袋外；基模型要不稳定；降方差')],
                       [T('random forest', '随机森林'), T('bagging + random features per split', '装袋 + 每次分裂随机特征'), T('decorrelates trees; parallel; strong; not interpretable', '让树去相关；并行；强；不可解释')],
                       [T('AdaBoost', 'AdaBoost'), T('reweight toward mistakes, weighted vote', '向错误倾斜地重新加权，加权投票'), T('$\\alpha = \\frac12\\ln\\frac{1-\\epsilon}{\\epsilon}$; bias down; overfits noise', r'$\alpha = \frac12\ln\frac{1-\epsilon}{\epsilon}$；降偏差；对噪声过拟合')]),
                 math_(r"\mathrm{Var}(\bar f) = \rho\,\sigma^2 + \frac{1-\rho}{M}\,\sigma^2 \qquad 1 - \Bigl(1 - \frac1N\Bigr)^N \to 1 - \frac1e \approx 0.632"),
                 math_(r"w_j \leftarrow \frac{w_j\,e^{-\alpha_i\,y_j\,C_i(x_j)}}{Z_i}, \qquad C^*(x) = \mathrm{sign}\sum_i \alpha_i C_i(x)"),
                 ul(T(r"Bagging: parallel, simple vote, variance, not prone to overfitting. Boosting: sequential, weighted vote, bias, prone to overfitting.", r"装袋：并行、简单投票、方差、不易过拟合。提升：串行、加权投票、偏差、易过拟合。"),
                    T(r"Correlation sets a floor on what averaging can do: $\rho\sigma^2$. Bias is not reduced by averaging.", r"相关性给平均能做到的设了下限：$\rho\sigma^2$。平均不会降低偏差。"),
                    T(r"Ensemble cost: more computation, less interpretability.", r"集成的代价：更多计算，可解释性更差。")),
                 chapter=T('What to remember', '要记住的')),
        ])


def _filled(x):
    """Fill every @name@ left in a lesson's strings (a safety net behind S() and X())."""
    if isinstance(x, str):
        return fill(x) if '@' in x else x
    if isinstance(x, list):
        return [_filled(v) for v in x]
    if isinstance(x, dict):
        return {k: _filled(v) for k, v in x.items()}
    return x


LESSONS = [lambda: _filled(L_backprop()), lambda: _filled(L_ensembles())]
