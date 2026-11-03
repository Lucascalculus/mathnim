# COMP90049 lessons 10 and 11: evaluation (splits, metrics) and bias-variance (README.md here).
# Every number of every worked example is computed below, never typed by hand.
import numpy as np
from math import comb, sqrt
from ml_kit import *

LIGHT = {BLUE: '#e6ecfb', ORANGE: '#fdebe0', GREEN: '#dff3ef', PURPLE: '#efe8fd', GOLD: '#f8efd9', MUTED: '#eceef1'}


def S(en, zh, **kw):
    """T() where «name» tokens are replaced by computed values."""
    for k, v in kw.items():
        en, zh = en.replace('«' + k + '»', str(v)), zh.replace('«' + k + '»', str(v))
    return T(en, zh)


def f2(x): return f'{x:.2f}'
def f3(x): return f'{x:.3f}'
def f4(x): return f'{x:.4f}'


# ------------------------------------------------------------------ metrics (computed once, used in the text)
def prf(tp, fp, fn):
    p = tp / (tp + fp) if tp + fp else 0.0
    r = tp / (tp + fn) if tp + fn else 0.0
    f = 2 * p * r / (p + r) if p + r else 0.0
    return p, r, f


def per_class(M):
    """M[actual][predicted] -> list of (TP, FP, FN, TN, support) per class."""
    M = np.array(M)
    n, out = M.sum(), []
    for c in range(len(M)):
        tp = int(M[c, c]); fp = int(M[:, c].sum() - tp); fn = int(M[c].sum() - tp)
        out.append((tp, fp, fn, int(n - tp - fp - fn), int(M[c].sum())))
    return out


def averages(M):
    pc = per_class(M)
    N = sum(x[4] for x in pc)
    ps = [prf(*x[:3])[0] for x in pc]; rs = [prf(*x[:3])[1] for x in pc]; fs = [prf(*x[:3])[2] for x in pc]
    sup = [x[4] for x in pc]
    TP = sum(x[0] for x in pc); FP = sum(x[1] for x in pc); FN = sum(x[2] for x in pc)
    return dict(P=ps, R=rs, F=fs, sup=sup, N=N, TP=TP, FP=FP, FN=FN,
                macro=(np.mean(ps), np.mean(rs), np.mean(fs)),
                micro=prf(TP, FP, FN),
                weighted=(sum(p * s for p, s in zip(ps, sup)) / N, sum(r * s for r, s in zip(rs, sup)) / N, sum(f * s for f, s in zip(fs, sup)) / N),
                acc=TP / N)


M_DECK = [[1, 1, 0], [2, 0, 0], [0, 1, 0]]          # slides 43-49: Red, Blue, Gold
M_SKEW = [[180, 20, 0], [15, 5, 0], [6, 3, 1]]      # slide 51
M_EX = [[18, 1, 1], [3, 4, 3], [1, 0, 4]]           # practice question
AD, AS, AX = averages(M_DECK), averages(M_SKEW), averages(M_EX)
PD, PS_ = per_class(M_DECK), per_class(M_SKEW)

# the four-instance example of slide 41
tp4, fp4, fn4, tn4 = 1, 2, 1, 0
P4, R4, F4 = prf(tp4, fp4, fn4)
F4_rounded = 2 * 0.33 * 0.5 / (0.5 + 0.33)

# stratification: 100 instances, 10 positive, a random test set of 20
p_none = comb(90, 20) / comb(100, 20)
hyp_mean = 20 * 0.1
hyp_sd = sqrt(20 * 0.1 * 0.9 * 80 / 99)

# precision-recall as the threshold moves
POS = [0.95, 0.88, 0.72, 0.64, 0.45, 0.30]
NEG = [0.85, 0.70, 0.60, 0.52, 0.40, 0.35, 0.25, 0.20, 0.12, 0.05]


def at_threshold(t):
    tp = sum(s >= t - 1e-9 for s in POS); fp = sum(s >= t - 1e-9 for s in NEG)
    return tp, fp, len(POS) - tp


def fbeta(p, r, b): return (1 + b * b) * p * r / (b * b * p + r) if p + r else 0.0


# regression
RY, RP = [3, 5, 2, 7, 4], [2.5, 5.5, 2, 6, 7]
RERR = [y - p for y, p in zip(RY, RP)]
SSE = sum(e * e for e in RERR); MSE = SSE / 5; RMSE = sqrt(MSE); MAE = sum(abs(e) for e in RERR) / 5
SST = sum((y - np.mean(RY)) ** 2 for y in RY); R2 = 1 - SSE / SST
SSE_out = SSE - RERR[-1] ** 2
Y3, P3 = [10, 20, 30], [12, 18, 36]
RMSE3 = sqrt(sum((a - b) ** 2 for a, b in zip(Y3, P3)) / 3)

# the polynomial simulation of lesson 2 (f = sin 2 pi x, noise 0.3), expectations over many training sets
SIG, FT = 0.3, (lambda x: np.sin(2 * np.pi * x))
GRID = np.linspace(0.02, 0.98, 97)


def simulate(N=30, runs=300, degs=range(0, 8), seed=1):
    rng = np.random.default_rng(seed)
    preds = {d: [] for d in degs}; trn = {d: [] for d in degs}; tst = {d: [] for d in degs}
    for _ in range(runs):
        x = rng.uniform(0, 1, N); y = FT(x) + rng.normal(0, SIG, N); yt = FT(GRID) + rng.normal(0, SIG, len(GRID))
        for d in degs:
            P = np.polynomial.Polynomial.fit(x, y, d)
            preds[d].append(P(GRID)); trn[d].append(np.mean((P(x) - y) ** 2)); tst[d].append(np.mean((P(GRID) - yt) ** 2))
    out = {}
    for d in degs:
        A = np.array(preds[d])
        out[d] = dict(b2=float(np.mean((A.mean(0) - FT(GRID)) ** 2)), var=float(np.mean(A.var(0))), train=float(np.mean(trn[d])), test=float(np.mean(tst[d])))
    return out


SIM = simulate()


def learning_curve(d, Ns, runs=200, seed=3):
    rng = np.random.default_rng(seed); res = []
    for N in Ns:
        tr, te = [], []
        for _ in range(runs):
            x = rng.uniform(0, 1, N); y = FT(x) + rng.normal(0, SIG, N); yt = FT(GRID) + rng.normal(0, SIG, len(GRID))
            P = np.polynomial.Polynomial.fit(x, y, d)
            tr.append(np.mean((P(x) - y) ** 2)); te.append(np.mean((P(GRID) - yt) ** 2))
        res.append((N, float(np.mean(tr)), float(np.mean(te))))
    return res


LC_N = [20, 30, 40, 60, 90, 130, 200]
LC_BIAS = learning_curve(1, LC_N)
LC_VAR = learning_curve(9, LC_N)
LC_GOOD = learning_curve(3, LC_N)

# the point-wise decomposition at x0 = 0.25 (f = 1), by simulation: degree 1 against degree 6
X0 = 0.25


def pointwise(d, N=30, runs=2000, seed=5):
    rng = np.random.default_rng(seed); v = []
    for _ in range(runs):
        x = rng.uniform(0, 1, N); y = FT(x) + rng.normal(0, SIG, N)
        v.append(np.polynomial.Polynomial.fit(x, y, d)(X0))
    v = np.array(v)
    b2 = float((v.mean() - FT(X0)) ** 2); var = float(v.var())
    return v.mean(), b2, var, b2 + var + SIG ** 2


PW1, PW6 = pointwise(1), pointwise(6)

# shrinking a sample mean: yhat = c * xbar, mu = 2, sigma^2 = 4, n = 4
MU, SG2, NN = 2.0, 4.0, 4
def shrink_mse(c): return (c - 1) ** 2 * MU ** 2 + c * c * SG2 / NN
C_OPT = MU ** 2 / (MU ** 2 + SG2 / NN)

FOLDS = [82, 78, 85, 80, 75]
FMEAN = sum(FOLDS) / 5; FVAR = sum((e - FMEAN) ** 2 for e in FOLDS) / 5

YB, PB = [12, 15, 9, 20], [10, 16, 7, 17]
BIAS_B = sum(y - p for y, p in zip(YB, PB)) / 4; MSE_B = sum((y - p) ** 2 for y, p in zip(YB, PB)) / 4


# ------------------------------------------------------------------ figures
def curve_clipped(P, f, a, b, color, width, ylo, yhi, n=120, dash=None):
    """Like Plot.curve, but the line leaves the frame at ylo/yhi instead of flattening against it."""
    xs = [a + (b - a) * i / n for i in range(n + 1)]
    ys = [float(f(x)) for x in xs]
    piece = []
    d = f' stroke-dasharray="{dash}"' if dash else ''

    def flush():
        if len(piece) > 1:
            P.parts.append(f'<polyline points="{" ".join(piece)}" fill="none" stroke="{color}" stroke-width="{width}" stroke-linecap="round" stroke-linejoin="round"{d}/>')
        piece.clear()
    for i in range(n + 1):
        inside = ylo <= ys[i] <= yhi
        if i > 0 and inside != (ylo <= ys[i - 1] <= yhi):
            edge = yhi if (ys[i] > yhi or ys[i - 1] > yhi) else ylo
            t = (edge - ys[i - 1]) / (ys[i] - ys[i - 1])
            xe = xs[i - 1] + t * (xs[i] - xs[i - 1])
            piece.append(P.pt(xe, edge))
            if inside:
                piece[:] = [P.pt(xe, edge)]
            else:
                flush()
        if inside:
            piece.append(P.pt(xs[i], ys[i]))
    flush()


def fig_splits(lang):
    F = Fig(600, 190, lang)
    x0, w = 20, 560
    parts = [('Train', '训练集', 0.6, BLUE), ('Validation', '验证集', 0.2, GOLD), ('Test', '测试集', 0.2, ORANGE)]
    x = x0
    for en, zh, fr, col in parts:
        F.rect(x, 50, w * fr, 56, LIGHT[col], col, 2, 4)
        F.text(x + w * fr / 2, 85, F.L(en, zh), 18, INK, 'middle', 'bold')
        x += w * fr
    use = [(0.3, 'fit the parameters', '拟合参数', BLUE), (0.7, 'choose k, depth, C', '选 k、深度、C', GOLD), (0.9, 'report once', '只报告一次', ORANGE)]
    for fr, en, zh, col in use:
        cx = x0 + w * fr
        F.line(cx, 150, cx, 112, col, 2.4, arrow=True)
        F.text(cx, 174, F.L(en, zh), 16, col, 'middle', 'bold')
    F.text(x0, 30, F.L('all labelled data', '全部有标签数据'), 16, MUTED)
    return F.svg()


def fig_folds(lang):
    k, cw, ch = 5, 74, 34
    F = Fig(560, 300, lang)
    x0, y0 = 70, 46
    for i in range(k):
        y = y0 + i * (ch + 8)
        F.text(x0 - 10, y + 24, f'{i + 1}', 16, MUTED, 'end')
        for j in range(k):
            test = i == j
            F.rect(x0 + j * cw, y, cw - 4, ch, LIGHT[ORANGE] if test else LIGHT[BLUE], ORANGE if test else BLUE, 1.8, 4)
        F.text(x0 + k * cw + 8, y + 24, f'E_{{{i + 1}}}', 17, INK)
    F.rect(20, 14, 18, 14, LIGHT[BLUE], BLUE, 1.6, 3); F.text(44, 27, F.L('train', '训练'), 15, INK)
    F.rect(120, 14, 18, 14, LIGHT[ORANGE], ORANGE, 1.6, 3); F.text(144, 27, F.L('test', '测试'), 15, INK)
    F.text(x0, 292, F.L('E = mean of E_{i}', 'E = E_{i} 的平均'), 16, GREEN, weight='bold')
    return F.svg()


def fig_threshold(lang):
    P = Plot(0, 1, 0, 1.05, 640, 380)
    ts = [i / 100 for i in range(0, 96)]
    rec = lambda t: prf(*at_threshold(t))[1]
    pre = lambda t: prf(*at_threshold(t))[0]
    P.curve(rec, 0.0, 0.95, BLUE, 3.4, n=95)
    P.curve(pre, 0.0, 0.95, ORANGE, 3.4, n=95)
    P.text(0.04, rec(0.04), 'recall' if lang == 'en' else '召回率', BLUE, 17, dy=-12, weight='bold')
    P.text(0.62, 0.40, 'precision' if lang == 'en' else '精确率', ORANGE, 17, weight='bold', dy=-4)
    P.text(0.5, 0.0, 'threshold t' if lang == 'en' else '阈值 t', INK, 17, 'middle', dy=44)
    P.axes('', 'P, R', [0, 0.25, 0.5, 0.75, 1], [0, 0.5, 1])
    return P.svg()


def fig_poly(lang):
    rng = np.random.default_rng(11)
    x = np.sort(rng.uniform(0.03, 0.97, 15)); y = FT(x) + rng.normal(0, SIG, 15)
    P = Plot(0, 1, -1.9, 1.7, 640, 400)
    P.curve(FT, 0, 1, MUTED, 2.4, '6 6')
    for d, col in ((1, ORANGE), (3, GREEN), (9, PURPLE)):
        curve_clipped(P, np.polynomial.Polynomial.fit(x, y, d), 0, 1, col, 3.2, -1.6, 1.6, 240)
    for a, b in zip(x, y):
        P.dot(a, b, INK, 4.5)
    P.text(0.99, 1.45, 'D = 9', PURPLE, 17, 'end', weight='bold')
    P.text(0.99, 0.2, 'D = 3', GREEN, 17, 'end', weight='bold', dy=-14)
    P.text(0.76, -0.45, 'D = 1', ORANGE, 17, 'middle', weight='bold')
    P.text(0.58, 0.45, 'f(x)', MUTED, 17, dy=-6)
    P.axes('x', 'y', [0, 0.5, 1], [-1, 0, 1])
    return P.svg()


def fig_complexity(lang):
    ds = list(SIM)
    P = Plot(0, 7, 0, 0.7, 640, 400, right=60)
    P.curve(lambda d: np.interp(d, ds, [SIM[k]['test'] for k in ds]), 0, 7, ORANGE, 3.6, n=70)
    P.curve(lambda d: np.interp(d, ds, [SIM[k]['train'] for k in ds]), 0, 7, BLUE, 3.6, n=70)
    P.curve(lambda d: np.interp(d, ds, [SIM[k]['b2'] for k in ds]), 0, 7, GREEN, 2.6, '7 5', n=70)
    P.curve(lambda d: np.interp(d, ds, [SIM[k]['var'] for k in ds]), 0, 7, PURPLE, 2.6, '7 5', n=70)
    P.seg((0, SIG ** 2), (7, SIG ** 2), MUTED, 1.8, '3 5')
    P.text(7, SIM[7]['test'], 'test' if lang == 'en' else '测试', ORANGE, 16, dx=6, dy=5, weight='bold')
    P.text(7, SIM[7]['train'], 'train' if lang == 'en' else '训练', BLUE, 16, dx=6, dy=5, weight='bold')
    P.text(1.55, SIM[1]['b2'], 'bias²' if lang == 'en' else '偏差²', GREEN, 16, dy=22, weight='bold')
    P.text(6.2, SIM[7]['var'], 'variance' if lang == 'en' else '方差', PURPLE, 16, 'end', dx=-6, dy=26, weight='bold')
    P.text(0.3, SIG ** 2, 'σ²', MUTED, 16, dy=-6)
    P.text(0.9, 0.0, 'underfit' if lang == 'en' else '欠拟合', INK, 16, 'middle', dy=-12)
    P.text(6.2, 0.0, 'overfit' if lang == 'en' else '过拟合', INK, 16, 'middle', dy=-12)
    P.text(3.5, 0.0, 'D', INK, 17, 'middle', dy=44)
    P.axes('', 'error' if lang == 'en' else '误差', [0, 1, 2, 3, 4, 5, 6, 7], [0, 0.2, 0.4, 0.6])
    return P.svg()


def fig_lc(res, lang, noise_label):
    P = Plot(0, 200, 0, 0.6, 640, 380, right=64)
    xs = [r[0] for r in res]
    curve_clipped(P, lambda n: float(np.interp(n, xs, [r[2] for r in res])), xs[0], 200, ORANGE, 3.6, 0, 0.6, 200)
    P.curve(lambda n: float(np.interp(n, xs, [r[1] for r in res])), xs[0], 200, BLUE, 3.6, n=100)
    P.seg((0, SIG ** 2), (200, SIG ** 2), MUTED, 1.8, '3 5')
    if noise_label:
        P.text(200, SIG ** 2, 'σ²', MUTED, 16, dx=6, dy=5)
    up, lo = (res[-1][2], res[-1][1]) if res[-1][2] >= res[-1][1] else (res[-1][1], res[-1][2])
    te_up = res[-1][2] >= res[-1][1]
    P.text(200, res[-1][2], 'test' if lang == 'en' else '测试', ORANGE, 16, dx=6, dy=-4 if te_up else 16, weight='bold')
    P.text(200, res[-1][1], 'train' if lang == 'en' else '训练', BLUE, 16, dx=6, dy=16 if te_up else -4, weight='bold')
    P.text(100, 0.0, 'N', INK, 17, 'middle', dy=44)
    P.axes('', 'error' if lang == 'en' else '误差', [0, 50, 100, 150, 200], [0, 0.2, 0.4, 0.6])
    return P.svg()


def fig_lc_bias(lang): return fig_lc(LC_BIAS, lang, True)
def fig_lc_var(lang): return fig_lc(LC_VAR, lang, False)




def ps(en, zh, **kw):
    """A paragraph with computed values."""
    return p(S(en, zh, **kw))


def tx(s, **kw):
    for k, v in kw.items():
        s = s.replace('«' + k + '»', str(v))
    return s


def row(*cells):
    return [T(c, c) if isinstance(c, str) else c for c in cells]


# ================================================================== LESSON 1: evaluation
def L_evaluation():
    SP, CV, CM, PR, MC, RG = 'eval.splits', 'eval.cv', 'eval.confusion', 'eval.prf', 'eval.multi', 'eval.regression'
    a, sk = AD, AS
    t_rows = []
    for t in (0.9, 0.8, 0.7, 0.5, 0.3):
        tp, fp, fn = at_threshold(t); pp, rr, ff = prf(tp, fp, fn)
        t_rows.append(row(f'{t}', f'{tp}', f'{fp}', f'{fn}', f2(pp), f2(rr), f2(ff)))
    tp5, fp5, fn5 = at_threshold(0.5); p5, r5, f5 = prf(tp5, fp5, fn5)
    names3 = (('Red', '红'), ('Blue', '蓝'), ('Gold', '金'))
    cls_rows = [[T(n, z)] + row(str(x[0]), str(x[1]), str(x[2]), f3(a['P'][i]), f3(a['R'][i]), f3(a['F'][i])) for i, ((n, z), x) in enumerate(zip(names3, PD))]

    def mat(M, labels):
        return [[T(*lab)] + row(*[str(v) for v in r_]) for lab, r_ in zip(labels, M)]

    return dict(
        id=lid('evaluation'), title=T('Evaluation: splits, validation and metrics', '评估：数据划分、验证与指标'),
        description=T('Why training accuracy lies, how holdout, stratification and cross-validation estimate performance on unseen data, and every metric of the confusion matrix, with micro, macro and weighted averages by hand.',
                      '为什么训练准确率会骗人，留出法、分层和交叉验证怎样估计模型在新数据上的表现，以及混淆矩阵上的各种指标，包括手算 micro、macro、加权平均。'),
        minutes=45,
        skills=[{'id': SP, 'name': T('Train, validation and test; holdout and stratification', '训练/验证/测试；留出与分层')},
                {'id': CV, 'name': T('Cross-validation and tuning', '交叉验证与调参')},
                {'id': CM, 'name': T('Confusion matrix, accuracy, baselines', '混淆矩阵、准确率与基线')},
                {'id': PR, 'name': T('Precision, recall, F-score and the threshold', '精确率、召回率、F 值与阈值')},
                {'id': MC, 'name': T('Multiclass averaging: macro, micro, weighted', '多分类平均：macro、micro、加权')},
                {'id': RG, 'name': T('Regression metrics', '回归指标')}],
        misconceptions=[{'id': 'train-acc', 'description': T('Reporting training accuracy as the model quality', '把训练准确率当作模型的好坏')},
                        {'id': 'tune-on-test', 'description': T('Tuning hyperparameters on the test set (data leakage)', '在测试集上调超参数（数据泄漏）')},
                        {'id': 'acc-imbalance', 'description': T('Trusting accuracy when the classes are imbalanced', '类别不平衡时仍相信准确率')},
                        {'id': 'micro-macro', 'description': T('Mixing up which average is dominated by large classes', '分不清哪种平均被大类主导')}],
        steps=[
            read('goal', T('What we are after: performance on data we have not seen', '目标：在没见过的数据上表现好'),
                 p(T(r"A model is useful only on **new** cases. So the one question evaluation answers is: how well will this model do on data it was not trained on? Everything in this lesson is a way to answer it honestly.",
                     r"模型只有在**新**数据上才有用。评估只回答一个问题：这个模型在没训练过的数据上会表现多好？这一课的所有做法，都是为了诚实地回答它。")),
                 ul(T(r"Fit the model on the **training data**; measure it on **data held back** (validation or test).", r"用**训练数据**拟合模型；用**留出的数据**（验证或测试）来衡量。"),
                    T(r"This rests on two assumptions: the held-back instances come from the **same distribution** as the training ones, and instances are drawn **independently**.", r"这样做靠两个假设：留出的数据与训练数据**同分布**，且样本**相互独立**。"),
                    T(r"The inductive learning hypothesis (Mitchell): a hypothesis that fits a large enough training sample well will also fit unseen cases well. It is a hope about the data, not a theorem; evaluation is how we check it.",
                      r"归纳学习假设（Mitchell）：在足够大的训练样本上拟合得好的假设，在没见过的样本上也会拟合得好。这是对数据的期望，不是定理；评估就是用来检验它。")),
                 quiz(T(r"A 1-nearest-neighbour classifier has 100% accuracy on its own training data. What does that tell us about its accuracy on new data?", r"1-近邻分类器在自己的训练数据上准确率是 100%。这说明它在新数据上的准确率……"),
                      [(T(r"Nothing: every training point is its own nearest neighbour, so 100% is guaranteed, whatever the model is worth.", r"什么也说明不了：每个训练点的最近邻就是它自己，所以 100% 是必然的，和模型好坏无关。"), True),
                       (T(r"It will also be close to 100%.", r"也会接近 100%。"), T(r"Training accuracy of 100% is built in for 1-NN (the point finds itself, distance 0). It is a statement about memorising, not about generalising.", r"1-NN 的训练准确率天生就是 100%（点会找到自己，距离为 0）。这说明的是记忆，不是泛化。")),
                       (T(r"It will be exactly 50% on new data.", r"在新数据上正好是 50%。"), T(r"Nothing fixes it at 50%; new-data accuracy depends on the problem. The point is that the training number carries no information.", r"没有什么把它固定在 50%；新数据的准确率取决于问题。关键是训练上的数字不含信息。"))],
                      T(r"Measuring on the data a model was fitted on rewards memorisation. Evaluation needs data the model has not touched.", r"在拟合过的数据上量模型，奖励的是记忆。评估需要模型没碰过的数据。")),
                 chapter=T('Why and how to split', '为什么、怎么划分')),

            read('three-sets', T('Three sets with three jobs', '三份数据，三种用途'),
                 svg(drawn(fig_splits), T('The labelled data split into train, validation and test, each with its job.', '有标签数据划成训练、验证、测试三份，各有用途。')),
                 p(T(r"Many methods have **hyperparameters** that training does not learn: $k$ in k-NN, the depth of a decision tree, $C$ in an SVM. To choose them we have to compare models, and that comparison needs data too.",
                     r"很多方法有训练学不到的**超参数**（hyperparameter）：k-NN 的 $k$、决策树的深度、SVM 的 $C$。要选它们就得比较模型，而比较也需要数据。")),
                 table([T('Set', '数据集'), T('Used for', '用来'), T('How often', '用几次')],
                       [T('Train', '训练集'), T('fit the parameters (tree splits, weights)', '拟合参数（树的划分、权重）'), T('many times', '很多次')],
                       [T('Validation', '验证集'), T('compare hyperparameters, pick the best', '比较超参数、选出最好的'), T('many times', '很多次')],
                       [T('Test', '测试集'), T('estimate the final model on unseen data', '估计最终模型在新数据上的表现'), T('once', '一次')]),
                 p(T(r"Procedure: choose the hyperparameter on validation data; then **refit on train + validation** with the chosen value; then look at the test set once.", r"流程：在验证集上选超参数；然后用选好的值在**训练+验证**上重新拟合；最后只看一次测试集。")),
                 quiz(T(r"You try depths 1 to 20 for a decision tree and keep the depth with the best accuracy on the test set. You report that accuracy. What is wrong?", r"你试了深度 1 到 20，保留测试集准确率最高的深度，并报告这个准确率。错在哪？"),
                      [(T(r"Nothing: the test set is the right place to compare models.", r"没错：测试集正是比较模型的地方。"), T(r"If the test set picks the winner, there is no unseen data left to judge the winner. The best of 20 tries is biased upwards.", r"测试集挑出了赢家，就没有没见过的数据来评判赢家了。20 次里最好的那个，数值偏高。")),
                       (T(r"The test set helped choose the model, so its score is optimistic: data leakage. Use a validation set (or cross-validation) to choose.", r"测试集参与了选模型，所以分数偏乐观：数据泄漏。应当用验证集（或交叉验证）来选。"), True),
                       (T(r"Depth 20 is too many trials; try fewer depths.", r"试 20 个深度太多了，应该少试几个。"), T(r"Fewer trials shrink the bias but do not remove it. The fix is to keep the test set out of the choice.", r"试得少只是让偏差变小，并没消除。办法是让测试集完全不参与选择。"))],
                      T(r"Leakage means information from the test set reached training or model choice. Then no data is left to test honestly.", r"泄漏就是测试集的信息进入了训练或选模型的环节。这样就没有可以诚实检验的数据了。"))),

            read('holdout', T('Holdout and random subsampling', '留出法与随机子采样'),
                 p(T(r"**Holdout**: assign each instance at random to train or test, no overlap. Build the model on the training part only, evaluate on the test part only. Typical splits (train–test): 50–50, 80–20, 90–10.",
                     r"**留出法**（holdout）：随机把每个实例分到训练或测试，互不重叠。只用训练部分建模，只用测试部分评估。常见比例（训练–测试）：50–50、80–20、90–10。")),
                 p(T(r"**Random subsampling** repeats holdout several times with different random splits and averages the scores, so one unlucky split matters less.", r"**随机子采样**（random subsampling）把留出法用不同的随机划分重复几次再取平均，这样一次倒霉的划分影响小一些。")),
                 table([T('Pros', '优点'), T('Cons', '缺点')],
                       [T('Simple to work with and implement', '简单、容易实现'), T('The size of the split matters (below)', '划分大小会影响结果（见下）')],
                       [T('Highly reproducible (fix the seed)', '可复现（固定随机种子）'), T('Sampling bias: a random split can give train and test different distributions', '抽样偏差：随机划分可能让训练、测试分布不同')],
                       [T('–', '–'), T('Inefficient: the test data is never used for training', '资源利用低：测试数据从不参与训练')]),
                 h(T('The size of the split', '划分的大小')),
                 ul(T(r"**Many test, few training** instances: the learner lacks information, so the model is worse than it could be and the score underestimates what all the data would give.", r"**测试多、训练少**：学习器信息不足，模型比本可以做到的差，分数低估了用全部数据时的表现。"),
                    T(r"**Many training, few test** instances: an accurate model, but the small test set may not be representative, so the estimate can be too high or too low.", r"**训练多、测试少**：模型准确，但测试集太小可能没有代表性，估计可能偏高也可能偏低。"))),

            read('stratify', T('Stratification: keeping the class mix', '分层：保持类别比例'),
                 p(T(r"Random splitting does not promise that the test set has the class mix of the data. With imbalanced data that is a real problem. **Stratification** forces every partition to keep the original class distribution.",
                     r"随机划分不保证测试集的类别比例和原数据一致。数据不平衡时这是个真问题。**分层**（stratification）让每个划分都保持原来的类别分布。")),
                 ps(r"Example: 100 instances, 10 of them positive, a random test set of 20. A random test set holds on average «m» positives, with a standard deviation of «sd»; with probability «p0» it holds **none**, and then precision and recall are undefined. A stratified split gives exactly 2 every time.",
                    r"例子：100 个实例，其中 10 个正例，随机抽 20 个做测试集。随机测试集平均含 «m» 个正例，标准差 «sd»；有 «p0» 的概率**一个正例都没有**，这时精确率、召回率都无从算起。分层划分每次都恰好是 2 个。",
                    m=f'{hyp_mean:.0f}', sd=f2(hyp_sd), p0=f'{p_none * 100:.1f}%'),
                 table([T('Pros', '优点'), T('Cons', '缺点')],
                       [T('Preserves the distribution: every stratum is represented in the right proportion', '保持分布：每个子群都按正确比例出现'), T('More complex to implement than simple random sampling', '比简单随机抽样实现更复杂')],
                       [T('Small but important subgroups are still represented', '小而重要的子群也能被代表到'), T('As with holdout, some data is only for training and some only for testing', '和留出法一样，一部分数据只训练、一部分只测试')]),
                 p(T(r"Stratification combines with holdout and with cross-validation.", r"分层可以和留出法、交叉验证结合。"))),

            read('kfold', T('k-fold cross-validation and leave-one-out', 'k 折交叉验证与留一法'),
                 svg(drawn(fig_folds), T('Five folds: each fold is the test fold once; the five scores are averaged.', '五折：每一折轮流当一次测试折；五个分数取平均。')),
                 ul(T(r"Split the data into $k$ folds (stratified if the classes are imbalanced).", r"把数据分成 $k$ 折（类别不平衡就分层）。"),
                    T(r"In round $i$, fold $i$ is the test data and the other $k-1$ folds are the training data. Score it: $E_i$.", r"第 $i$ 轮，第 $i$ 折当测试数据，其余 $k-1$ 折当训练数据，得到分数 $E_i$。"),
                    T(r"Report the average of the $k$ scores.", r"报告 $k$ 个分数的平均。")),
                 math_(r"E = \frac{1}{k}\sum_{i=1}^{k} E_i"),
                 p(T(r"**Leave-one-out** (LOOCV) is the extreme $k = N$: each instance is the test set once, the model is trained on the other $N-1$.", r"**留一法**（leave-one-out，LOOCV）是极端的 $k = N$：每个实例轮流当一次测试集，模型用其余 $N-1$ 个训练。")),
                 table([T('–', '–'), T('Pros', '优点'), T('Cons', '缺点')],
                       [T('k-fold', 'k 折'), T('Every instance is used for both training and testing; the estimate reflects a dataset that looks like the whole data', '每个实例既训练又测试；估计反映的是像整体数据一样的数据集'), T('Slower: $k$ model fits', '更慢：要拟合 $k$ 次')],
                       [T('Leave-one-out', '留一法'), T('Trains on nearly all the data each time; no randomness in the split', '每次几乎用全部数据训练；划分没有随机性'), T('$N$ model fits: the slowest', '要拟合 $N$ 次：最慢')]),
                 h(T('How big is k?', 'k 取多大？')),
                 ul(T(r"**Fewer folds**: more instances per partition, more variance in the performance estimate, less work.", r"**折数少**：每折实例多，性能估计方差更大，计算少。"),
                    T(r"**More folds**: fewer instances per partition, less variance, slower.", r"**折数多**：每折实例少，方差更小，更慢。"),
                    T(r"The usual choice is $k = 10$ (sometimes 5): it mimics a 90–10 holdout, but far more reliably, because every instance takes a turn in the test fold.", r"常用 $k = 10$（有时 5）：它像 90–10 的留出法，但可靠得多，因为每个实例都轮到当测试数据。")),
                 quiz(T(r"With 10-fold cross-validation on 1000 instances, how many models are trained, and on how many instances each?", r"对 1000 个实例做 10 折交叉验证：训练多少个模型、每个用多少实例？"),
                      [(T(r"10 models, 100 instances each", r"10 个模型，每个 100 个实例"), T(r"100 is the size of the test fold. Each model trains on the other $k - 1$ folds: 900.", r"100 是测试折的大小。每个模型用其余 $k - 1$ 折训练：900。")),
                       (T(r"1 model, 900 instances", r"1 个模型，900 个实例"), T(r"That is a single 90–10 holdout. Cross-validation retrains from scratch in every round.", r"那是一次 90–10 的留出。交叉验证每一轮都重新训练。")),
                       (T(r"10 models, 900 instances each", r"10 个模型，每个 900 个实例"), True)],
                      T(r"Each round trains on $(k-1)/k$ of the data and tests on $1/k$; the cost is $k$ fits.", r"每一轮用 $(k-1)/k$ 的数据训练、$1/k$ 测试；代价是拟合 $k$ 次。"))),

            read('cv-tuning', T('Cross-validation for tuning, and which to use', '用交叉验证调参，以及怎么选方法'),
                 p(T(r"Instead of a third set, tune with cross-validation **inside the training data**: for each candidate hyperparameter, run $k$-fold on the training data, average the $k$ validation scores, and keep the best candidate. Refit on all the training data; use the test set once at the end.",
                     r"可以不留第三份数据，而是在**训练数据内部**用交叉验证调参：对每个候选超参数，在训练数据上做 $k$ 折，把 $k$ 个验证分数取平均，留下最好的。再用全部训练数据重新拟合；测试集最后只用一次。")),
                 table([T('Consider', '考虑'), T('Holdout', '留出法'), T('Cross-validation', '交叉验证')],
                       [T('Data scale', '数据量'), T('Fine when data is plentiful', '数据充足时够用'), T('Better when data is small: every instance is used', '数据少时更好：每个实例都被用到')],
                       [T('Efficiency', '效率'), T('One fit', '拟合一次'), T('$k$ fits: costly for big models', '拟合 $k$ 次：大模型代价高')],
                       [T('Bias and variance', '偏差与方差'), T('One split: unstable estimate', '只有一次划分：估计不稳定'), T('Averages many splits: more stable', '平均多次划分：更稳定')],
                       [T('Hyperparameter tuning', '调超参数'), T('A fixed validation set', '固定的验证集'), T('Validation folds inside the training data', '训练数据内部的验证折')],
                       [T('Goal', '目的'), T('A quick check, a final test set', '快速检查、最终测试集'), T('A reliable comparison of methods', '可靠地比较方法')]),
                 quiz(T(r"Which is the best reason to prefer 10-fold cross-validation to a single 80–20 holdout on a dataset of 150 instances?", r"数据只有 150 个实例，相比一次 80–20 留出，更倾向 10 折交叉验证，最好的理由是？"),
                      [(T(r"It is faster than holdout.", r"它比留出法更快。"), T(r"It is $k$ times slower, not faster. Speed is the reason to prefer holdout.", r"它慢 $k$ 倍，不是更快。要快才该选留出法。")),
                       (T(r"It removes the need for a test set.", r"它让测试集变得不需要。"), T(r"Cross-validation estimates performance; if you also tune on those folds, the final number is still optimistic. Keep a test set or use nested cross-validation.", r"交叉验证估计表现；如果你同时用这些折调参，最终数字仍偏乐观。要留测试集，或用嵌套交叉验证。")),
                       (T(r"A 30-instance test set is small and noisy; averaging ten different test folds makes the estimate more stable and uses all the data.", r"30 个实例的测试集又小又噪；平均十个不同的测试折更稳，也用上了全部数据。"), True)],
                      T(r"Small data is where cross-validation earns its cost.", r"数据少时，交叉验证的代价才值得。"))),

            read('confusion', T('The confusion matrix, accuracy and error rate', '混淆矩阵、准确率与错误率'),
                 p(T(r"**Accuracy** is the fraction of correct predictions; the **error rate** is $1 -$ accuracy. A good start, but it does not say *which* mistakes the model makes. For two classes (positive = the one we look for) we tabulate all four outcomes:",
                     r"**准确率**（accuracy）是预测正确的比例，**错误率**（error rate）是 $1 -$ 准确率。它是个好的起点，但没告诉我们模型犯的是*哪种*错。两类时（正类 = 我们要找的那一类），把四种结果列成表：")),
                 table([T('–', '–'), T('Predicted positive', '预测为正'), T('Predicted negative', '预测为负')],
                       [T('Actual positive', '实际为正'), T('TP: true positive', 'TP：真正例'), T('FN: false negative', 'FN：假反例')],
                       [T('Actual negative', '实际为负'), T('FP: false positive', 'FP：假正例'), T('TN: true negative', 'TN：真反例')]),
                 math_(r"A = \frac{TP + TN}{TP + TN + FP + FN}, \qquad E = 1 - A"),
                 p(T(r"Rows are the **actual** class, columns the **predicted** class (the lectures' convention; some books swap them, so read the labels).", r"行是**实际**类别，列是**预测**类别（课件的约定；有的书反过来，所以先看标签）。")),
                 p(T(r"Not all errors cost the same. Calling a person with a viral infection healthy is a **false negative**; calling an innocent person a criminal is a **false positive**. We need metrics that look at each kind separately.",
                     r"并非所有错误代价相同。把感染病毒的人判为健康是**假反例**；把无辜的人判为罪犯是**假正例**。我们需要分别看两类错误的指标。")),
                 chapter=T('Metrics for classification', '分类指标')),

            read('prec-rec', T('Precision and recall', '精确率与召回率'),
                 table([T('Metric', '指标'), T('Formula', '公式'), T('Asks', '问的是'), T('Close to 1 means', '接近 1 表示')],
                       [T('Recall (sensitivity)', '召回率（灵敏度）'), T(r'$\frac{TP}{TP + FN}$', r'$\frac{TP}{TP + FN}$'), T('Of the actual positives, how many did we find?', '实际为正的里面，找到了多少？'), T('few false negatives', '假反例很少')],
                       [T('Precision', '精确率'), T(r'$\frac{TP}{TP + FP}$', r'$\frac{TP}{TP + FP}$'), T('Of those we called positive, how many really are?', '我们判为正的里面，真是正的有多少？'), T('few false positives', '假正例很少')],
                       [T('Specificity', '特异度'), T(r'$\frac{TN}{TN + FP}$', r'$\frac{TN}{TN + FP}$'), T('Of the actual negatives, how many did we clear?', '实际为负的里面，排除了多少？'), T('few false positives (recall of the negative class)', '假正例很少（负类的召回率）')]),
                 p(T(r"Recall is about the **row** of actual positives, precision about the **column** of predicted positives. Specificity is not in the lectures; it is the recall of the negative class and appears in medical settings.", r"召回率看的是实际为正那一**行**，精确率看的是预测为正那一**列**。特异度（specificity）课件里没有；它是负类的召回率，医学里常见。")),
                 ps(r"The deck's four-instance example (Red positive, Blue negative): TP = «tp», FN = «fn», FP = «fp», TN = «tn». Accuracy = «acc»; precision = «tp»/(«tp»+«fp») = «p»; recall = «tp»/(«tp»+«fn») = «r».",
                    r"课件的四实例例子（红为正、蓝为负）：TP = «tp»，FN = «fn»，FP = «fp»，TN = «tn»。准确率 = «acc»；精确率 = «tp»/(«tp»+«fp») = «p»；召回率 = «tp»/(«tp»+«fn») = «r»。",
                    tp=tp4, fn=fn4, fp=fp4, tn=tn4, acc=f2((tp4 + tn4) / 4), p=f3(P4), r=f2(R4)),
                 quiz(T(r"Which metric matters most for an email spam filter, where losing a real email is costly? (Spam is the positive class.)", r"垃圾邮件过滤器丢掉正常邮件代价很高，最该看哪个指标？（垃圾邮件为正类）"),
                      [(T(r"Recall of the spam class.", r"垃圾邮件类的召回率。"), T(r"Recall counts missed spam (false negatives), only an annoyance here. The costly mistake is a false positive, which precision penalises.", r"召回率数的是漏掉的垃圾邮件（假反例），这里只是烦人。代价高的是假正例，由精确率惩罚。")),
                       (T(r"Precision of the spam class: a false positive is a real email in the spam folder.", r"垃圾邮件类的精确率：假正例就是把正常邮件放进了垃圾箱。"), True),
                       (T(r"Accuracy, because it counts every mistake.", r"准确率，因为它把每个错误都算上了。"), T(r"Accuracy weighs both kinds of mistake equally. When their costs differ, look at the one that hurts.", r"准确率给两种错误一样的权重。代价不同时，要看让你疼的那一种。"))],
                      T(r"Choose the metric by the cost of the mistake you cannot afford.", r"按你付不起的那种错误的代价来选指标。"))),

            read('threshold', T('The threshold moves precision and recall in opposite directions', '阈值一动，精确率和召回率反向变化'),
                 p(T(r"Most classifiers produce a **score** and call an instance positive when the score reaches a threshold $t$. Raise $t$ and fewer instances are called positive: those left are the sure ones, so precision tends to rise, but we miss more positives, so recall falls. Lower $t$ and the reverse.",
                     r"多数分类器先给出一个**分数**，分数达到阈值 $t$ 才判为正。把 $t$ 抬高，判为正的变少，留下的都是把握大的，所以精确率往往上升，但会漏掉更多正例，召回率下降。把 $t$ 放低则相反。")),
                 svg(drawn(fig_threshold), T('Recall and precision against the threshold for six positive and ten negative instances.', '六个正例、十个负例时，召回率和精确率随阈值的变化。')),
                 table([T('t', 't'), T('TP', 'TP'), T('FP', 'FP'), T('FN', 'FN'), T('Precision', '精确率'), T('Recall', '召回率'), T('F1', 'F1')], *t_rows),
                 p(T(r"Recall can only fall as $t$ rises (a positive called positive at a high threshold is also called positive at a lower one). Precision can wiggle: here it is 0.50 at $t = 0.3$ and at $t = 0.5$, but 0.60 at 0.7. So “inverse relationship” is a tendency, not a law.",
                     r"$t$ 升高时召回率只会下降（高阈值下被判为正的，在低阈值下也是正）。精确率可能起伏：这里 $t = 0.3$ 和 $t = 0.5$ 时都是 0.50，在 0.7 时是 0.60。所以“此消彼长”是倾向，不是定律。")),
                 p(T(r"If you care about only one of them, push the threshold that way. Usually we want both, so we combine them into one number.", r"如果只在乎其中一个，就把阈值往那个方向推。通常两个都要，所以把它们合成一个数。"))),

            derive('f1-derive', T('F-score: one number for both', 'F 值：把两者合成一个数'),
                   [(r"F_1 = \frac{2PR}{P + R}", T(r"The **F1-score** is the **harmonic mean** of precision $P$ and recall $R$. Why not the plain average? With $P = 1$ and $R = 0.01$ (call everything negative except one sure case) the average is 0.505, which looks fine; $F_1 = 0.0198$ tells the truth. The harmonic mean is dragged toward the smaller one.", r"**F1 值**是精确率 $P$ 和召回率 $R$ 的**调和平均**。为什么不用普通平均？当 $P = 1$、$R = 0.01$（几乎全判为负、只挑一个最有把握的），平均是 0.505，看上去还行；$F_1 = 0.0198$ 才说出真相。调和平均被较小的那个拉下去。")),
                    (r"P = \frac{TP}{TP + FP}, \quad R = \frac{TP}{TP + FN}", T(r"Write $P$ and $R$ with their counts.", r"把 $P$ 和 $R$ 用计数写出来。")),
                    (r"2PR = \frac{2\,TP^2}{(TP+FP)(TP+FN)}", T(r"The numerator: multiply the two fractions.", r"分子：把两个分数相乘。")),
                    (r"P + R = \frac{TP\,[(TP+FN) + (TP+FP)]}{(TP+FP)(TP+FN)}", T(r"The denominator: put both fractions over the common denominator $(TP+FP)(TP+FN)$.", r"分母：通分到 $(TP+FP)(TP+FN)$。")),
                    (r"F_1 = \frac{2\,TP^2}{TP\,(2TP + FP + FN)} = \frac{2\,TP}{2TP + FP + FN}", T(r"Divide: the common denominator cancels, and so does one $TP$. This form is the fastest to compute from the matrix. Note that **TN never appears**.", r"相除：公共分母约掉，一个 $TP$ 也约掉。这个形式从矩阵里算最快。注意：**TN 根本没出现**。")),
                    (r"F_1 = \frac{2 \cdot 1}{2 \cdot 1 + 2 + 1} = 0.4", T(r"Check on the four-instance example ($TP = 1$, $FP = 2$, $FN = 1$). The deck writes 0.398 because it rounded $P$ to 0.33 first; the exact value is 0.4. Round at the end, not in the middle.", r"用四实例的例子检验（$TP = 1$、$FP = 2$、$FN = 1$）。课件写 0.398 是因为先把 $P$ 舍成了 0.33；精确值是 0.4。要最后再舍入，不要中途舍入。"))],
                   outro=S(r"**F-beta** generalises it: $F_\beta = \dfrac{(1+\beta^2)PR}{\beta^2 P + R}$. $\beta > 1$ favours recall, $\beta < 1$ favours precision, $\beta = 1$ is F1. At the threshold $t = 0.5$ above, $P = «p»$, $R = «r»$: $F_1 = «f1»$ and $F_2 = «f2»$ (recall is larger, so $F_2$ is higher).",
                           r"**F-beta** 是它的推广：$F_\beta = \dfrac{(1+\beta^2)PR}{\beta^2 P + R}$。$\beta > 1$ 偏重召回率，$\beta < 1$ 偏重精确率，$\beta = 1$ 就是 F1。上面 $t = 0.5$ 时 $P = «p»$、$R = «r»$：$F_1 = «f1»$，$F_2 = «f2»$（召回率更大，所以 $F_2$ 更高）。",
                           p=f2(p5), r=f2(r5), f1=f2(f5), f2=f2(fbeta(p5, r5, 2))),
                   blank=(5, '0.4', T(r"Evaluate the fraction for $TP = 1$, $FP = 2$, $FN = 1$.", r"代入 $TP = 1$、$FP = 2$、$FN = 1$，算出这个分数。")), skill=PR),

            derive('acc-fails', T('Why accuracy fails on imbalanced data', '为什么类别不平衡时准确率会失效'),
                   [(r"A = \frac{TP + TN}{N}", T(r"Start from the definition; $N$ is the number of instances. Let $N_+ = TP + FN$ be the actual positives and $N_- = TN + FP$ the actual negatives.", r"从定义出发；$N$ 是实例总数。设 $N_+ = TP + FN$ 为实际正例数，$N_- = TN + FP$ 为实际负例数。")),
                    (r"= \frac{TP}{N_+}\cdot\frac{N_+}{N} + \frac{TN}{N_-}\cdot\frac{N_-}{N}", T(r"Split the numerator, then multiply and divide the first term by $N_+$ and the second by $N_-$. Nothing changed; we only introduced two ratios.", r"拆开分子；第一项乘除 $N_+$，第二项乘除 $N_-$。数值没变，只是引入了两个比值。")),
                    (r"A = \pi R + (1-\pi) S", T(r"The ratios have names: $TP/N_+ = R$ is recall, $TN/N_- = S$ is specificity, $A$ is accuracy, and $\pi = N_+/N$ is the share of positives. **Accuracy is a weighted average of the recall on each class, weighted by class size.**", r"这些比值有名字：$TP/N_+ = R$ 是召回率，$TN/N_- = S$ 是特异度，$A$ 是准确率，$\pi = N_+/N$ 是正例所占比例。**准确率是各类召回率按类别大小加权的平均。**")),
                    (r"R = 0,\ S = 1 \ \Rightarrow\ A = 1 - \pi", T(r"The majority-class baseline (Zero-R) never says positive: $R = 0$, $S = 1$.", r"多数类基线（Zero-R）从不判为正：$R = 0$、$S = 1$。")),
                    (r"\pi = 0.01:\ A = 0.01 \cdot 0 + 0.99 \cdot 1 = 0.99", T(r"The deck's disease example (1% sick). A model that detects **no** sick person scores 99%. Detecting every sick person raises accuracy by at most the weight of the positive class: 0.01.", r"课件里的疾病例子（1% 患病）。一个**一个病人都检测不出**的模型得 99%。把所有病人都检出来，准确率最多再涨正类的权重：0.01。"))],
                   outro=T(r"So always compare accuracy with the **baseline**: Zero-R gives $1-\pi$; One-R is the best single-feature rule; random guessing with the class proportions gives $\pi^2 + (1-\pi)^2$. Accuracy 99% means little when the baseline is 99%; accuracy 60% can be excellent on a hard task whose baseline is 20%. Then look at per-class precision and recall.",
                           r"所以永远把准确率和**基线**（baseline）比较：Zero-R 是 $1-\pi$；One-R 是最好的单特征规则；按类别比例随机猜是 $\pi^2 + (1-\pi)^2$。基线是 99% 时，准确率 99% 毫无意义；基线是 20% 的难任务上，60% 可能已经很棒。然后再看各类的精确率和召回率。"),
                   blank=(4, '0.99', T(r"Put $\pi = 0.01$, recall 0 and specificity 1 into the formula.", r"把 $\pi = 0.01$、召回率 0、特异度 1 代入公式。")), skill=CM),

            read('multi-setup', T('More than two classes: one class against the rest', '多于两类：一类对其余所有类'),
                 p(T(r"With classes Red, Blue, Gold there is no single “positive”. Pick one **interesting** class and treat all others as “negative”; read TP, FP, FN, TN from the matrix for that class; repeat for every class.",
                     r"有红、蓝、金三类时就没有唯一的“正类”。选一个**关注的**类，把其余类都当作“负类”；从矩阵里读出这一类的 TP、FP、FN、TN；对每一类重复。")),
                 p(T(r"The deck's example (5 instances): actual Red, Blue, Red, Blue, Gold; predicted Red, Red, Blue, Red, Blue. Rows are actual, columns predicted:", r"课件的例子（5 个实例）：实际为红、蓝、红、蓝、金；预测为红、红、蓝、红、蓝。行是实际，列是预测：")),
                 table([T('–', '–'), T('Pred. Red', '预测红'), T('Pred. Blue', '预测蓝'), T('Pred. Gold', '预测金')], *mat(M_DECK, (('Actual Red', '实际红'), ('Actual Blue', '实际蓝'), ('Actual Gold', '实际金')))),
                 ul(T(r"**TP** of a class: its diagonal cell.", r"某类的 **TP**：它的对角线格子。"),
                    T(r"**FN**: the rest of its **row** (actually this class, predicted as another).", r"**FN**：它所在**行**的其余格子（实际属于这类，被预测成别的）。"),
                    T(r"**FP**: the rest of its **column** (predicted as this class, actually another).", r"**FP**：它所在**列**的其余格子（被预测成这类，实际是别的）。")),
                 table([T('Class', '类'), T('TP', 'TP'), T('FP', 'FP'), T('FN', 'FN'), T('Precision', '精确率'), T('Recall', '召回率'), T('F1', 'F1')], *cls_rows),
                 callout('note', T('0 / 0', '0 / 0'), T(r"Gold is never predicted, so its precision is $0/0$. The deck sets it to 0 (so does scikit-learn, with a warning). Say so in an answer instead of hiding it.", r"金从来没被预测过，所以它的精确率是 $0/0$。课件把它定为 0（scikit-learn 也如此，并给出警告）。答题时把这个约定写出来，不要藏着。")),
                 chapter=T('Many classes', '多个类别')),

            derive('averages', T('Macro, micro and weighted: the deck example by hand', 'macro、micro、加权：课件例子手算'),
                   [(tx(r"P_M = \frac{\tfrac13 + 0 + 0}{3} = «v»", v=f3(a['macro'][0])), T(r"**Macro**: compute the metric per class, then take the plain average. Every class counts the same, whatever its size.", r"**Macro**：先按类算指标，再取简单平均。每一类权重相同，不管大小。")),
                    (tx(r"R_M = \frac{\tfrac12 + 0 + 0}{3} = «v»", v=f3(a['macro'][1])), T(r"Same for recall: Red $\tfrac12$, Blue 0, Gold 0.", r"召回率同样：红 $\tfrac12$，蓝 0，金 0。")),
                    (tx(r"P_\mu = \frac{\sum TP_c}{\sum (TP_c + FP_c)} = \frac{«tp»}{«tp» + «fp»} = «v»", tp=a['TP'], fp=a['FP'], v=f2(a['micro'][0])),
                     T(r"**Micro**: pool all instances first. Add the counts over classes ($\sum TP = 1$, $\sum FP = 2 + 2 + 0 = 4$), then compute once. Every *instance* counts the same.", r"**Micro**：先把所有实例汇总。把各类的计数相加（$\sum TP = 1$，$\sum FP = 2 + 2 + 0 = 4$），再算一次。每个*实例*权重相同。")),
                    (tx(r"R_\mu = \frac{«tp»}{«tp» + «fn»} = «v»", tp=a['TP'], fn=a['FN'], v=f2(a['micro'][1])), T(r"Here $\sum FN = 1 + 2 + 1 = 4$. Micro precision and micro recall are equal, and equal to the accuracy, 0.2. (Proved in the next lesson step.)", r"这里 $\sum FN = 1 + 2 + 1 = 4$。micro 精确率和 micro 召回率相等，也等于准确率 0.2。（下一步证明。）")),
                    (tx(r"P_W = \tfrac25 \cdot \tfrac13 + \tfrac25 \cdot 0 + \tfrac15 \cdot 0 = «v»", v=f3(a['weighted'][0])),
                     T(r"**Weighted**: per-class metric averaged with weights $n_c / N$, the class's share of the instances (Red 2, Blue 2, Gold 1 out of 5). The deck prints 0.132 because it used 0.33; exactly it is 2/15.", r"**加权**：按类算指标，用 $n_c / N$（类 $c$ 的实例占比：红 2、蓝 2、金 1，共 5）加权平均。课件印的是 0.132，因为用了 0.33；精确值是 2/15。")),
                    (tx(r"R_W = \tfrac25 \cdot \tfrac12 + 0 + 0 = «v»", v=f2(a['weighted'][1])), T(r"Weighted recall is 0.2 too: it also equals the accuracy (shown in the next step).", r"加权召回率也是 0.2：它同样等于准确率（下一步证明）。"))],
                   outro=S(r"**Summary** (precision / recall): macro «mp» / «mr»; micro «up» / «ur»; weighted «wp» / «wr»; accuracy «acc». Macro F1 (the average of the per-class F1 values 0.4, 0, 0) is «mf»; micro F1 is «uf».",
                           r"**小结**（精确率 / 召回率）：macro «mp» / «mr»；micro «up» / «ur»；加权 «wp» / «wr»；准确率 «acc»。macro F1（各类 F1 值 0.4、0、0 的平均）是 «mf»；micro F1 是 «uf»。",
                           mp=f3(a['macro'][0]), mr=f3(a['macro'][1]), up=f2(a['micro'][0]), ur=f2(a['micro'][1]), wp=f3(a['weighted'][0]), wr=f2(a['weighted'][1]), acc=f2(a['acc']), mf=f3(a['macro'][2]), uf=f2(a['micro'][2])),
                   blank=(1, '0.167', T(r"Average the three per-class recalls: $\tfrac12$, 0, 0 (three decimals).", r"把三个类的召回率平均：$\tfrac12$、0、0（保留三位小数）。")), skill=MC),

            read('skewed', T('A skewed example: when each average misleads', '一个偏斜的例子：每种平均何时误导'),
                 p(T(r"The deck's second example has a big class (Red, 200 instances) and two small ones (Blue 20, Gold 10):", r"课件的第二个例子有一个大类（红，200 个实例）和两个小类（蓝 20，金 10）：")),
                 table([T('–', '–'), T('Pred. Red', '预测红'), T('Pred. Blue', '预测蓝'), T('Pred. Gold', '预测金')], *mat(M_SKEW, (('Actual Red (200)', '实际红（200）'), ('Actual Blue (20)', '实际蓝（20）'), ('Actual Gold (10)', '实际金（10）')))),
                 table([T('–', '–'), T('Red', '红'), T('Blue', '蓝'), T('Gold', '金'), T('Macro', 'macro'), T('Micro', 'micro'), T('Weighted', '加权')],
                       [T('Recall', '召回率')] + row(*[f2(r_) for r_ in sk['R']], f2(sk['macro'][1]), f2(sk['micro'][1]), f2(sk['weighted'][1])),
                       [T('Precision', '精确率')] + row(*[f2(r_) for r_ in sk['P']], f2(sk['macro'][0]), f2(sk['micro'][0]), f2(sk['weighted'][0]))),
                 ps(r"Accuracy is «acc», and micro and weighted recall say the same. Yet the model finds only 25% of Blue and 10% of Gold. Macro recall, «mr», shows it.", r"准确率是 «acc»，micro 和加权召回率也这么说。但模型只找到了 25% 的蓝和 10% 的金。macro 召回率 «mr» 才暴露了这一点。", acc=f2(sk['acc']), mr=f2(sk['macro'][1])),
                 ul(T(r"**Micro** (and weighted recall) is dominated by the large class. Use it when each *instance* matters equally; it can hide a failing minority class.", r"**Micro**（以及加权召回率）被大类主导。每个*实例*同等重要时用它；它会掩盖失败的少数类。"),
                    T(r"**Macro** treats classes equally and emphasises small ones. Use it when every *class* matters equally. It can mislead the other way: Gold's precision is 1.00 from a single prediction, yet it supplies a third of the macro precision.", r"**Macro** 对各类一视同仁，强调小类。每个*类别*同等重要时用它。它也可能反向误导：金只预测了一次，精确率就是 1.00，却贡献了 macro 精确率的三分之一。"),
                    T(r"**Weighted** weights classes by size: close to micro, but keeps per-class precision and recall separate (its precision can differ from its recall).", r"**加权**按类别大小加权：接近 micro，但保留了各类的精确率和召回率（它的精确率可以不等于召回率）。")),
                 quiz(T(r"A detector must be judged on how well it finds each of 12 rare diseases, whose frequencies differ a hundredfold. Which average?", r"一个检测器要按它找出 12 种罕见病各自的能力来评判，这些病的发病率相差上百倍。用哪种平均？"),
                      [(T(r"Micro: it uses all the instances.", r"micro：它用到了所有实例。"), T(r"Micro is dominated by the frequent diseases; a detector that misses every rare disease can still score high.", r"micro 被常见病主导；漏掉所有罕见病的检测器照样可以得高分。")),
                       (T(r"Weighted: the fairest compromise.", r"加权：最公平的折中。"), T(r"Weighting by frequency again lets the common diseases dominate, just what we wanted to avoid.", r"按频率加权又让常见病占主导，这正是我们想避免的。")),
                       (T(r"Macro: every disease counts the same, however rare.", r"macro：每种病权重相同，不管多罕见。"), True)],
                      T(r"Choose the average by what should count equally: classes (macro) or instances (micro).", r"按“什么该被同等看待”来选平均：类别（macro）还是实例（micro）。"))),

            derive('micro-acc', T('Deeper: why micro-F1 equals accuracy for single-label problems', '深入：为什么单标签多分类里 micro-F1 等于准确率'),
                   [(r"\sum_c TP_c = M", T(r"Summing the diagonal counts every correctly classified instance once; call that number $M$.", r"把对角线加起来，每个分类正确的实例恰好算一次；记这个数为 $M$。")),
                    (r"y = a,\ \hat y = b,\ b \neq a", T(r"Each wrong instance has exactly one true class $a$ and one predicted class $b \ne a$ (single-label: one label each).", r"每个分类错误的实例恰有一个真类 $a$ 和一个预测类 $b \ne a$（单标签：各一个标签）。")),
                    (r"\Rightarrow\ FN_a \mathrel{+}= 1,\ FP_b \mathrel{+}= 1", T(r"It is missed by class $a$ (FN) and wrongly claimed by class $b$ (FP): the same mistake counted once on each side.", r"它被 $a$ 类漏掉（FN），又被 $b$ 类错认（FP）：同一个错误在两边各记一次。")),
                    (r"\sum_c FP_c = \sum_c FN_c = N - \sum_c TP_c", T(r"So both sums equal the number of wrong instances.", r"所以两个和都等于错误实例的个数。")),
                    (tx(r"\sum TP + \sum FP = «tp» + «fp» = «n»", tp=a['TP'], fp=a['FP'], n=a['N']), T(r"Check on the deck's 5-instance example: $\sum TP = 1$, $\sum FP = 4$, and together they make $N$. In general $\sum TP + \sum FP = \sum TP + (N - \sum TP) = N$.", r"用课件的 5 实例例子检验：$\sum TP = 1$，$\sum FP = 4$，加起来就是 $N$。一般地 $\sum TP + \sum FP = \sum TP + (N - \sum TP) = N$。")),
                    (r"P_\mu = \frac{\sum TP}{\sum TP + \sum FP} = \frac{\sum TP}{N} = A", T(r"So the micro-precision denominator is $N$.", r"所以 micro 精确率的分母是 $N$。")),
                    (r"R_\mu = \frac{\sum TP}{\sum TP + \sum FN} = \frac{\sum TP}{N} = A", T(r"Same for recall. Both equal the accuracy.", r"召回率同理。两者都等于准确率。")),
                    (r"F_{1,\mu} = \frac{2PR}{P + R} = \frac{2A^2}{2A} = A", T(r"With $P = R = A$ the harmonic mean is just $A$. So reporting micro-F1 adds nothing beyond accuracy.", r"$P = R = \text{Acc}$ 时调和平均就是 Acc。所以报告 micro-F1 不比准确率多给任何信息。")),
                    (r"R_W = \sum_c \frac{n_c}{N}\cdot\frac{TP_c}{n_c} = \frac{\sum_c TP_c}{N} = A", T(r"The same trick for weighted recall: the class sizes $n_c$ cancel.", r"加权召回率同理：类别大小 $n_c$ 约掉了。"))],
                   outro=T(r"Take-away for the exam: in a single-label multiclass problem, micro precision = micro recall = micro F1 = accuracy. Only macro and weighted averages carry extra information.", r"考试要点：单标签多分类里，micro 精确率 = micro 召回率 = micro F1 = 准确率。只有 macro 和加权平均才带来额外信息。"),
                   blank=(4, '5', T(r"How many instances are there? ($\sum TP + \sum FP$ should come out as this number.)", r"一共有多少个实例？（$\sum TP + \sum FP$ 应该等于这个数。）")), skill=MC),

            read('reg-metrics', T('Regression metrics: the size of the error', '回归指标：误差有多大'),
                 p(T(r"For a numeric target there is no right or wrong, only how far off. With error $y_i - \hat y_i$ on test instance $i$:", r"目标是数值时没有对错，只有差多远。第 $i$ 个测试实例的误差是 $y_i - \hat y_i$：")),
                 table([T('Metric', '指标'), T('Formula', '公式'), T('Notes', '特点')],
                       [T('SSE (RSS)', 'SSE（RSS）'), T(r'$\sum_i (y_i - \hat y_i)^2$', r'$\sum_i (y_i - \hat y_i)^2$'), T('sum of squared errors; what least squares minimises', '平方误差之和；最小二乘最小化的量')],
                       [T('MSE', 'MSE'), T(r'$\frac{1}{N}\sum_i (y_i - \hat y_i)^2 = SSE/N$', r'$\frac{1}{N}\sum_i (y_i - \hat y_i)^2 = SSE/N$'), T('penalises large errors more; sensitive to outliers', '更重地惩罚大误差；对离群点敏感')],
                       [T('RMSE', 'RMSE'), T(r'$\sqrt{MSE}$', r'$\sqrt{MSE}$'), T('same units as the target, so easier to read', '和目标同单位，更好读')],
                       [T('MAE', 'MAE'), T(r'$\frac{1}{N}\sum_i |y_i - \hat y_i|$', r'$\frac{1}{N}\sum_i |y_i - \hat y_i|$'), T('every error counts in proportion; less sensitive to outliers', '每个误差按比例计入；对离群点不那么敏感')]),
                 ps(r"Example: actual $y = (3, 5, 2, 7, 4)$, predicted $\hat y = (2.5, 5.5, 2, 6, 7)$. Errors: $0.5, -0.5, 0, 1, -3$. SSE = «sse», MSE = «mse», RMSE = «rmse», MAE = «mae». The one big miss (error 3) is 3 of the 5 absolute-error units but «sh» of the squared error.",
                    r"例子：实际 $y = (3, 5, 2, 7, 4)$，预测 $\hat y = (2.5, 5.5, 2, 6, 7)$。误差：$0.5, -0.5, 0, 1, -3$。SSE = «sse»，MSE = «mse»，RMSE = «rmse»，MAE = «mae»。那一个大误差（3）在绝对误差里占 5 份中的 3 份，在平方误差里却占 «sh»。",
                    sse=f2(SSE), mse=f2(MSE), rmse=f3(RMSE), mae=f2(MAE), sh=f'{RERR[-1] ** 2 / SSE * 100:.0f}%'),
                 ps(r"RMSE is always at least MAE; the bigger the gap, the more of the error comes from a few large misses (here «r» against «m»).", r"RMSE 永远不小于 MAE；差距越大，说明误差越集中在少数大失误上（这里 «r» 对 «m»）。", r=f3(RMSE), m=f2(MAE)),
                 details(T('R² (not in the lectures)', 'R²（课件没有）'),
                         math_(r"R^2 = 1 - \frac{SSE}{SST}, \qquad SST = \sum_i (y_i - \bar y)^2"),
                         ps(r"$SST$ is the squared error of the “baseline” that always predicts the mean $\bar y$ (the regression Zero-R). So $R^2 = 1$ is perfect, 0 is no better than the mean, and negative is worse. Here $SST = «sst»$, so $R^2 = «r2»$.", r"$SST$ 是总是预测均值 $\bar y$ 的“基线”（回归里的 Zero-R）的平方误差。所以 $R^2 = 1$ 是完美，0 是不比均值好，负数是更糟。这里 $SST = «sst»$，所以 $R^2 = «r2»$。", sst=f2(SST), r2=f2(R2))),
                 chapter=T('Regression', '回归')),

            derive('mean-median', T('Deeper: why MSE chases outliers and MAE does not', '深入：为什么 MSE 追着离群点跑，而 MAE 不会'),
                   [(r"\min_c \sum_i (y_i - c)^2", T(r"Suppose the model can only predict one constant $c$. Which $c$ minimises the squared error?", r"假设模型只能预测一个常数 $c$。哪个 $c$ 让平方误差最小？")),
                    (r"\frac{d}{dc} = -2\sum_i (y_i - c) = 0", T(r"Differentiate and set to zero.", r"求导并令其为零。")),
                    (r"c = \frac{1}{N}\sum_i y_i = \bar y", T(r"The squared-error optimum is the **mean**. One huge $y_i$ drags the mean, so the fit chases it.", r"平方误差的最优解是**均值**。一个巨大的 $y_i$ 会拽动均值，拟合就追着它走。")),
                    (r"\min_c \sum_i |y_i - c| \;\Rightarrow\; \frac{d}{dc} = \#\{y_i < c\} - \#\{y_i > c\} = 0", T(r"For absolute error each point pulls with a constant force $\pm 1$, however far away it is. Balance: as many points below $c$ as above.", r"绝对误差下，每个点以恒定的力 $\pm 1$ 拉，不论离多远。平衡点：$c$ 下方和上方的点一样多。")),
                    (r"c = \tilde y", T(r"The absolute-error optimum is the **median** $\tilde y$, which a single outlier hardly moves.", r"绝对误差的最优解是**中位数** $\tilde y$，一个离群点几乎拽不动它。"))],
                   outro=T(r"So the choice of metric is a choice of what to care about: MSE/RMSE if large misses are especially costly, MAE if you want robustness to outliers.", r"所以选指标就是选在乎什么：大失误代价特别高，用 MSE/RMSE；想对离群点稳健，用 MAE。"), skill=RG),

            number('ck-f1', T('F1 from a confusion matrix', '由混淆矩阵算 F1'), CM,
                   T(r"A classifier on 200 test instances gives $TP = 40$, $FP = 10$, $FN = 20$, $TN = 130$. What is the F1-score of the positive class? (Two decimals.)", r"分类器在 200 个测试实例上得到 $TP = 40$、$FP = 10$、$FN = 20$、$TN = 130$。正类的 F1 是多少？（两位小数。）"),
                   round(2 * 40 / (2 * 40 + 10 + 20), 4),
                   T(r"$F_1 = \dfrac{2TP}{2TP + FP + FN} = \dfrac{80}{110} = 0.727$. Via the parts: precision $40/50 = 0.8$, recall $40/60 = 0.667$, harmonic mean 0.727. TN plays no role.", r"$F_1 = \dfrac{2TP}{2TP + FP + FN} = \dfrac{80}{110} = 0.727$。分步：精确率 $40/50 = 0.8$，召回率 $40/60 = 0.667$，调和平均 0.727。TN 不起作用。"),
                   tolerance=0.01, hints=[T(r"Use $F_1 = 2TP / (2TP + FP + FN)$.", r"用 $F_1 = 2TP / (2TP + FP + FN)$。")], purpose='practice',
                   chapter=T('Exam practice', '考试练习')),

            number('ck-macro', T('Macro-averaged precision', 'macro 平均精确率'), MC,
                   T("Three classes, confusion matrix below (rows actual, columns predicted; order A, B, C):\n\nA: 18, 1, 1\nB: 3, 4, 3\nC: 1, 0, 4\n\nWhat is the macro-averaged precision? (Three decimals.)", "三类的混淆矩阵如下（行为实际，列为预测；顺序 A、B、C）：\n\nA: 18, 1, 1\nB: 3, 4, 3\nC: 1, 0, 4\n\nmacro 平均精确率是多少？（三位小数。）"),
                   round(float(AX['macro'][0]), 4),
                   S(r"Precision is per **column**: A $18/22 = «a»$, B $4/5 = «b»$, C $4/8 = «c»$. Macro = their plain average = «m». (Macro recall would be «mr»; micro = accuracy = «acc».)", r"精确率按**列**算：A $18/22 = «a»$，B $4/5 = «b»$，C $4/8 = «c»$。macro = 简单平均 = «m»。（macro 召回率是 «mr»；micro = 准确率 = «acc»。）",
                     a=f3(AX['P'][0]), b=f3(AX['P'][1]), c=f3(AX['P'][2]), m=f3(AX['macro'][0]), mr=f3(AX['macro'][1]), acc=f3(AX['acc'])),
                   tolerance=0.005, hints=[T(r"Column sums are 22, 5, 8; the diagonal is 18, 4, 4.", r"各列之和是 22、5、8；对角线是 18、4、4。")]),

            choice('ck-leak', T('Spot the leak', '找出泄漏'), SP,
                   T(r"A student standardises the features with the mean and standard deviation of the **whole** dataset, then runs 10-fold cross-validation and reports 94% accuracy. What is the problem?", r"一位同学用**整个**数据集的均值和标准差对特征做标准化，然后做 10 折交叉验证，报告 94% 的准确率。问题是什么？"),
                   [(T(r"10 folds is too few.", r"10 折太少了。"), T(r"The number of folds is not the issue; the order of operations is.", r"问题不在折数，而在操作顺序。"), 'folds'),
                    (T(r"Information from the test folds (their mean and spread) leaked into training; the estimate is optimistic. Compute the scaling on the training folds only.", r"测试折的信息（均值和离散程度）漏进了训练；估计偏乐观。应只用训练折来计算缩放参数。"), True),
                    (T(r"Standardising should not be done in cross-validation at all.", r"交叉验证里根本不该做标准化。"), T(r"Standardise, but **inside** each round, fitted on that round's training folds and applied to its test fold.", r"要做，但要在每一轮**内部**做：用该轮训练折拟合，再应用到它的测试折。"), 'no-prep'),
                    (T(r"The folds should not be stratified.", r"折不该分层。"), T(r"Stratification is harmless here and unrelated to the leak.", r"分层在这里无害，和泄漏无关。"), 'strat')],
                   T(r"Anything learned from data (scaling, feature selection, hyperparameters) must be learned from the training part of each round only.", r"任何从数据里学来的东西（缩放、特征选择、超参数）都只能从每一轮的训练部分学。")),

            choice('ck-imb', T('A fraud detector', '欺诈检测器'), CM,
                   T(r"Only 0.5% of transactions are fraudulent. A model has 99.4% accuracy. Which conclusion is justified?", r"只有 0.5% 的交易是欺诈。某模型准确率 99.4%。下面哪个结论成立？"),
                   [(T(r"The model is excellent.", r"模型很出色。"), T(r"99.4% is below the 99.5% baseline of “never fraud”. It may be worse than doing nothing.", r"99.4% 低于“从不判欺诈”的基线 99.5%。它可能还不如什么都不做。"), 'acc-imbalance'),
                    (T(r"The model is poor because 99.4% is below 100%.", r"模型很差，因为 99.4% 低于 100%。"), T(r"100% is not the right yardstick; the baseline is. Poor or not depends on the fraud-class metrics.", r"100% 不是合适的尺子，基线才是。差不差要看欺诈类的指标。"), 'perfect'),
                    (T(r"Nothing yet: the Zero-R baseline already scores 99.5%, so this model is below it. Look at precision and recall on the fraud class.", r"还不能下结论：Zero-R 基线已经是 99.5%，这个模型还低于它。要看欺诈类的精确率和召回率。"), True),
                    (T(r"Switch to micro-averaged F1 to fix it.", r"改用 micro 平均 F1 就能解决。"), T(r"With single labels, micro-F1 equals accuracy: it would say 0.994 again.", r"单标签时，micro-F1 就等于准确率：它还是 0.994。"), 'micro')],
                   T(r"Compare with the baseline and look at the minority class. Micro averages cannot rescue you: they are accuracy in disguise.", r"和基线比较，并看少数类。micro 平均救不了你：它就是换了名字的准确率。")),

            number('ck-rmse', T('RMSE by hand', '手算 RMSE'), RG,
                   T(r"Actual values $(10, 20, 30)$, predictions $(12, 18, 36)$. What is the RMSE? (Two decimals.)", r"实际值 $(10, 20, 30)$，预测 $(12, 18, 36)$。RMSE 是多少？（两位小数。）"),
                   round(RMSE3, 4),
                   S(r"Errors $-2, 2, -6$; squares $4, 4, 36$; MSE $= 44/3 = «mse»$; RMSE $= \sqrt{«mse»} = «r»$. (MAE would be $10/3 = «mae»$.)", r"误差 $-2, 2, -6$；平方 $4, 4, 36$；MSE $= 44/3 = «mse»$；RMSE $= \sqrt{«mse»} = «r»$。（MAE 是 $10/3 = «mae»$。）", mse=f2(44 / 3), r=f2(RMSE3), mae=f2(10 / 3)),
                   tolerance=0.01),

            text_q('ck-compare', T('Holdout against k-fold', '留出法与 k 折比较'), SP,
                   T(r"Compare the holdout method and k-fold cross-validation as ways of estimating a classifier's performance. Give two points for each and say when you would use which. (3 to 5 lines)", r"比较留出法和 k 折交叉验证这两种估计分类器性能的方法。各给两点，并说明什么时候用哪个。（3 到 5 行）"),
                   [T(r"Holdout: one random train/test split; simple, fast, reproducible", r"留出法：一次随机划分训练/测试；简单、快、可复现"),
                    T(r"Holdout weaknesses: result depends on the split and its size; test data is never used for training", r"留出法缺点：结果依赖划分及其大小；测试数据不参与训练"),
                    T(r"k-fold: every instance is tested once and used for training k-1 times; the k scores are averaged, so the estimate is more stable", r"k 折：每个实例测试一次、训练 k-1 次；k 个分数取平均，估计更稳"),
                    T(r"k-fold costs k model fits (leave-one-out: N)", r"k 折要拟合 k 次（留一法：N 次）"),
                    T(r"Use holdout for large data or expensive models; k-fold (stratified for imbalance) for small data and for comparing or tuning", r"数据大或模型贵用留出法；数据少、要比较或调参用 k 折（不平衡时分层）")],
                   T(r"Holdout splits the data once at random into train and test (e.g. 80-20). It is simple, fast and reproducible, but the estimate depends on which instances land in the test set and on its size, and the test instances are never used for training. k-fold cross-validation splits the data into k folds; each fold is the test set once while the others train, and the k scores are averaged. Every instance is used for both training and testing and the estimate is more stable, but it needs k model fits. I would use holdout when data is plentiful or training is expensive, and (stratified) k-fold, typically k = 10, when data is small or I need a reliable comparison or hyperparameter tuning.",
                     r"Holdout splits the data once at random into train and test (e.g. 80-20). It is simple, fast and reproducible, but the estimate depends on which instances land in the test set and on its size, and the test instances are never used for training. k-fold cross-validation splits the data into k folds; each fold is the test set once while the others train, and the k scores are averaged. Every instance is used for both training and testing and the estimate is more stable, but it needs k model fits. I would use holdout when data is plentiful or training is expensive, and (stratified) k-fold, typically k = 10, when data is small or I need a reliable comparison or hyperparameter tuning."),
                   T(r"The exam wants contrasts with a reason, not a list of names.", r"考试要的是带理由的对比，不是名词罗列。")),

            text_q('ck-design', T('Design an evaluation (Section C style)', '设计一个评估（C 部分风格）'), SP,
                   T(r"A hospital wants a classifier that flags a rare disease (2% of patients) from scan features. The dataset has 500 patients and several scans per patient. Describe how you would evaluate it: how to split, which metrics, and what to compare against. (A third of a page)", r"医院想用扫描特征训练一个分类器来标出某种罕见病（2% 的患者）。数据有 500 名患者，每人有多次扫描。请说明你会怎样评估：怎么划分、用哪些指标、和什么比较。（约三分之一页）"),
                   [T(r"Split by patient, not by scan, so no patient is in both train and test", r"按患者而不是按扫描划分，同一患者不同时出现在训练和测试里"),
                    T(r"Stratify on the disease label (cross-validation or holdout) to keep the 2% in every part", r"按疾病标签分层（交叉验证或留出），让每份都保持 2%"),
                    T(r"Metrics: recall (missed cases), precision, F1 on the disease class; not accuracy alone", r"指标：疾病类的召回率（漏诊）、精确率、F1；不能只看准确率"),
                    T(r"Baseline: Zero-R scores 98% accuracy; the model must beat it on recall/F1", r"基线：Zero-R 准确率 98%；模型要在召回率/F1 上胜过它"),
                    T(r"Tune hyperparameters on validation folds only; touch the test set once", r"超参数只在验证折上调；测试集只碰一次")],
                   T(r"I would split by patient so that scans of one patient never appear in both training and test data (otherwise the model can recognise the patient and the estimate is optimistic). With 500 patients and about 10 positives, I would use stratified k-fold cross-validation (k = 5), keeping the 2% positive rate in each fold, tuning hyperparameters inside the training folds and keeping a final test set untouched until the end. I would not use accuracy, since the Zero-R baseline already has 98%. I would report recall (missing a sick patient is costly), precision and F1 for the disease class, with the mean and spread across folds, and compare them with the baseline and a simple model.",
                     r"I would split by patient so that scans of one patient never appear in both training and test data (otherwise the model can recognise the patient and the estimate is optimistic). With 500 patients and about 10 positives, I would use stratified k-fold cross-validation (k = 5), keeping the 2% positive rate in each fold, tuning hyperparameters inside the training folds and keeping a final test set untouched until the end. I would not use accuracy, since the Zero-R baseline already has 98%. I would report recall (missing a sick patient is costly), precision and F1 for the disease class, with the mean and spread across folds, and compare them with the baseline and a simple model."),
                   T(r"A design answer states the split, the metric and the baseline, each with its reason.", r"设计题要写出划分、指标和基线，每一项都带理由。")),

            read('remember', T('What to remember', '要记住的'),
                 table([T('Topic', '主题'), T('Remember', '记住')],
                       [T('Goal', '目标'), T('performance on unseen data; train / validation (tune) / test (once); leakage = test information reaching training or model choice', '在没见过的数据上的表现；训练/验证（调参）/测试（一次）；泄漏 = 测试信息进入训练或选模型')],
                       [T('Holdout', '留出法'), T('simple, reproducible; split size and sampling bias; wastes data', '简单、可复现；划分大小与抽样偏差；浪费数据')],
                       [T('Stratified', '分层'), T('keeps class proportions; use for imbalance', '保持类别比例；用于不平衡数据')],
                       [T('k-fold / LOO', 'k 折 / 留一'), T('mean of k scores; every instance tested once; k = 10 usual; LOO k = N, slowest', 'k 个分数的平均；每个实例测试一次；常用 k = 10；留一 k = N，最慢')],
                       [T('Accuracy / error', '准确率 / 错误率'), T('$(TP+TN)/N$; $1-$ accuracy; compare with the Zero-R / One-R baseline', '$(TP+TN)/N$；$1-$ 准确率；要和 Zero-R / One-R 基线比')],
                       [T('Precision / recall', '精确率 / 召回率'), T('$TP/(TP+FP)$ column; $TP/(TP+FN)$ row; the threshold trades one for the other', '$TP/(TP+FP)$（列）；$TP/(TP+FN)$（行）；阈值让两者此消彼长')],
                       [T('F-score', 'F 值'), T(r'$F_1 = 2PR/(P+R) = 2TP/(2TP+FP+FN)$; $F_\beta$: $\beta>1$ favours recall', r'$F_1 = 2PR/(P+R) = 2TP/(2TP+FP+FN)$；$F_\beta$：$\beta>1$ 偏重召回率')],
                       [T('Macro', 'macro'), T('average over classes; every class equal; emphasises small classes', '按类平均；每类等权；强调小类')],
                       [T('Micro', 'micro'), T('pool the counts; every instance equal; dominated by large classes; micro-P = micro-R = micro-F1 = accuracy (single label)', '汇总计数；每个实例等权；被大类主导；单标签时 micro-P = micro-R = micro-F1 = 准确率')],
                       [T('Weighted', '加权'), T('per-class metric weighted by class size; weighted recall = accuracy', '按类别大小加权的各类指标；加权召回率 = 准确率')],
                       [T('Regression', '回归'), T(r'SSE; MSE = SSE/N (outliers hurt); RMSE = $\sqrt{MSE}$ (target units); MAE = mean $|y-\hat y|$ (robust)', r'SSE；MSE = SSE/N（对离群点敏感）；RMSE = $\sqrt{MSE}$（目标的单位）；MAE = $|y-\hat y|$ 的均值（稳健）')]),
                 callout('warning', T('On the exam', '考试里'), T(r"Round at the end, state the 0/0 convention, say which class is “positive”, and write the formula before the numbers.", r"最后再舍入，写明 0/0 的约定，说清哪一类是“正类”，先写公式再代数。"))),
        ])


# ================================================================== LESSON 2: bias-variance
def L_bias_variance():
    FIT, LCV, DEC, REM, EV = 'bv.fit', 'bv.curves', 'bv.decomp', 'bv.remedy', 'bv.evalbv'
    d = SIM
    rows = [row(str(k), f2(d[k]['train']), f2(d[k]['test']), f3(d[k]['b2']), f3(d[k]['var'])) for k in d]
    best = min(d, key=lambda k: d[k]['test'])
    lb, lv = LC_BIAS, LC_VAR
    sd100, sd400 = sqrt(0.8 * 0.2 / 100), sqrt(0.8 * 0.2 / 400)
    return dict(
        id=lid('bias-variance'), title=T('Bias, variance and learning curves', '偏差、方差与学习曲线'),
        description=T('Underfitting and overfitting read from learning curves, the bias-variance decomposition derived line by line, and how evaluation itself has bias and variance.',
                      '从学习曲线读出欠拟合与过拟合，一行一行推导偏差-方差分解，以及评估本身也有偏差和方差。'),
        minutes=45,
        skills=[{'id': FIT, 'name': T('Underfitting, overfitting and complexity', '欠拟合、过拟合与模型复杂度')},
                {'id': LCV, 'name': T('Reading learning curves', '读学习曲线')},
                {'id': DEC, 'name': T('The bias-variance decomposition', '偏差-方差分解')},
                {'id': REM, 'name': T('Remedies for high bias and high variance', '高偏差与高方差的对策')},
                {'id': EV, 'name': T('Evaluation bias and variance', '评估的偏差与方差')}],
        misconceptions=[{'id': 'more-data-bias', 'description': T('Believing more training data fixes high bias', '以为多加数据能解决高偏差')},
                        {'id': 'complex-better', 'description': T('Believing a more complex model always generalises better', '以为越复杂的模型泛化越好')},
                        {'id': 'bias-types', 'description': T('Confusing model bias with evaluation bias', '混淆模型偏差与评估偏差')},
                        {'id': 'zero-error', 'description': T('Expecting test error to reach zero with enough data (the noise floor)', '以为数据够多测试误差能到零（忽略噪声下限）')}],
        steps=[
            read('fit', T('Underfitting and overfitting', '欠拟合与过拟合'),
                 p(T(r"**Generalisation** is performing well on unseen data. There are two ways to fail at it:", r"**泛化**（generalisation）是在没见过的数据上表现好。有两种失败方式：")),
                 ul(T(r"**Underfitting**: the model is not expressive enough to capture the pattern.", r"**欠拟合**（underfitting）：模型表达力不够，抓不住规律。"),
                    T(r"**Overfitting**: the model is too complicated; it captures the **noise** of this training set as if it were pattern.", r"**过拟合**（overfitting）：模型太复杂，把这份训练集的**噪声**当成了规律。"),
                    T(r"An appropriate fit captures the essential pattern and nothing more.", r"合适的拟合只抓住本质的规律，不多不少。")),
                 svg(drawn(fig_poly), T('Fifteen noisy points from a sine curve with polynomial fits of order 1, 3 and 9.', '正弦曲线上 15 个带噪声的点，以及 1 阶、3 阶、9 阶多项式拟合。')),
                 p(T(r"**Model complexity** is the number of adjustable parameters: the order $D$ of the polynomial $y = \mathbf{w}^\top\phi(x)$ with $\phi(x) = [1, x, x^2, \dots, x^D]$, the depth of a decision tree, the number of leaves. $D = 1$ is a line: too stiff (underfit). $D = 9$ passes close to every point and swings wildly between them: it learned the noise (overfit).",
                     r"**模型复杂度**（model complexity）是可调参数的数量：多项式 $y = \mathbf{w}^\top\phi(x)$ 的阶数 $D$（$\phi(x) = [1, x, x^2, \dots, x^D]$）、决策树的深度、叶子数。$D = 1$ 是直线：太僵硬（欠拟合）。$D = 9$ 几乎穿过每个点，点间却剧烈摆动：它学了噪声（过拟合）。")),
                 chapter=T('Fitting too little, fitting too much', '拟合不足与拟合过度')),

            read('u-shape', T('Training error keeps falling; test error turns up', '训练误差一路下降，测试误差会掉头向上'),
                 p(T(r"Fit polynomials of order 0 to 7 to 30 noisy points (noise standard deviation 0.3, so the noise variance is $\sigma^2 = 0.09$), repeat on 300 fresh training sets and average. Errors are mean squared errors.",
                     r"对 30 个带噪声的点（噪声标准差 0.3，所以噪声方差 $\sigma^2 = 0.09$）拟合 0 到 7 阶多项式，在 300 份新训练集上重复并取平均。误差是均方误差。")),
                 svg(drawn(fig_complexity), T('Training error falls with complexity; test error falls then rises. Bias squared falls, variance rises; the dashed floor is the noise.', '训练误差随复杂度下降；测试误差先降后升。偏差²下降，方差上升；虚线下限是噪声。')),
                 table([T('Order D', '阶数 D'), T('Train error', '训练误差'), T('Test error', '测试误差'), T('Bias²', '偏差²'), T('Variance', '方差')], *rows),
                 ul(S(r"**Underfitting** (small $D$): high error on **both** the training and the test set. Order 0: «a» and «b».", r"**欠拟合**（$D$ 小）：训练和测试误差**都高**。0 阶：«a» 和 «b»。", a=f2(d[0]['train']), b=f2(d[0]['test'])),
                    S(r"**Overfitting** (large $D$): low training error, high test error, a **large gap**. Order 7: «a» against «b».", r"**过拟合**（$D$ 大）：训练误差低，测试误差高，**差距很大**。7 阶：«a» 对 «b»。", a=f2(d[7]['train']), b=f2(d[7]['test'])),
                    S(r"The best test error is at order «k»: «t», not far above the noise floor 0.09.", r"测试误差最低在 «k» 阶：«t»，离噪声下限 0.09 不远。", k=best, t=f2(d[best]['test']))),
                 p(T(r"Training error alone can never reveal overfitting, because it only goes down as complexity grows. The tree analogue is error against the number of leaf nodes: training error keeps falling, test error turns up.", r"只看训练误差永远看不出过拟合，因为它随复杂度增加只会下降。决策树里对应的是：误差随叶子数的变化——训练误差一直降，测试误差掉头向上。")),
                 quiz(T(r"A polynomial of order 9 has a training error of 0.001 and a test error of 0.3 (noise level 0.09). A colleague says: “add more complexity, the training error is almost zero.” What is the right reading?", r"一个 9 阶多项式训练误差 0.001、测试误差 0.3（噪声水平 0.09）。同事说：“再加复杂度吧，训练误差快到零了。”正确的解读是？"),
                      [(T(r"Underfitting: more complexity is needed.", r"欠拟合：需要更复杂。"), T(r"Underfitting shows as high error on both sets. Here the training error is tiny.", r"欠拟合的表现是两边误差都高。这里训练误差极小。")),
                       (T(r"Overfitting: the large train–test gap says the model fits noise. Reduce complexity or add data.", r"过拟合：训练与测试之间的大差距说明模型在拟合噪声。要降复杂度或加数据。"), True),
                       (T(r"Good fit: training error near zero is the goal.", r"拟合得好：训练误差接近零就是目标。"), T(r"The goal is low *test* error. A training error far below the noise level means the model memorised noise.", r"目标是低的*测试*误差。训练误差远低于噪声水平，说明模型记住了噪声。"))],
                      T(r"Diagnose with the gap and the level, not with the training error alone.", r"要看差距和水平来诊断，不能只看训练误差。"))),

            read('data-caveats', T('When the split itself lies', '划分本身说谎的时候'),
                 p(T(r"Before reading any curve, check how the data was collected:", r"读任何曲线之前，先看数据是怎么收集的：")),
                 ul(T(r"**Sampling bias**: the training data is not representative of the population (patients from one city, one age group). A test set cut from the same data cannot warn you.", r"**抽样偏差**（sampling bias）：训练数据不能代表总体（只有一个城市、一个年龄段的患者）。从同一份数据里切出来的测试集不会提醒你。"),
                    T(r"**Related instances**: several instances (scans, sentences) belong to one patient or one author, but we want to generalise to **new** patients. Then split by patient, or the model is tested on people it has already seen.", r"**相关的实例**：好几个实例（扫描、句子）属于同一个患者或作者，而我们想泛化到**新的**患者。这时要按患者划分，否则模型是在它已经见过的人身上测试。")),
                 quiz(T(r"Ten scans per patient, 100 patients. You split the 1000 scans randomly 80–20 and get 98% test accuracy. On new patients the deployed model gets 80%. Most likely cause?", r"每位患者 10 次扫描，共 100 位患者。你把 1000 次扫描随机按 80–20 划分，测试准确率 98%。部署后在新患者上只有 80%。最可能的原因？"),
                      [(T(r"Underfitting.", r"欠拟合。"), T(r"Underfitting gives low accuracy on the test set too; here the test score was high.", r"欠拟合时测试集上准确率也低；这里测试分数很高。")),
                       (T(r"Too little training data.", r"训练数据太少。"), T(r"Little data hurts both estimates; “98% on test, 80% on new patients” is a leak, not a shortage.", r"数据少会让两边都差；“测试 98%、新患者 80%”这种模式是泄漏，不是数据不足。")),
                       (T(r"Scans of the same patient were in both train and test: the model recognised patients, so the estimate was optimistic.", r"同一患者的扫描同时出现在训练和测试里：模型认出了患者，所以估计偏乐观。"), True)],
                      T(r"Split along the unit you want to generalise over.", r"沿着你想泛化的那个单位去划分。"))),

            read('learning-curves', T('Learning curves', '学习曲线'),
                 p(T(r"A **learning curve** plots performance against *experience*: the y-axis is accuracy, error rate or another metric; the x-axis is a condition such as the **training-set size**, the model complexity, or the number of iterations.", r"**学习曲线**把表现画成*经验*的函数：纵轴是准确率、错误率或其他指标；横轴是某个条件，如**训练集大小**、模型复杂度或迭代次数。")),
                 ul(T(r"The **training curve** is measured on the training set: how well the model has learned.", r"**训练曲线**在训练集上量：模型学得多好。"),
                    T(r"The **validation curve** is measured on held-out data: how well it generalises.", r"**验证曲线**在留出数据上量：它泛化得多好。")),
                 p(T(r"Example 1, varying the training size: split 90–10, 80–20, …, 10–90 (9 points), averaging several runs per size. It shows the **data trade-off**: more training instances usually give a better model; more evaluation instances give a more reliable estimate. One dataset cannot give both.", r"例 1，改变训练集大小：按 90–10、80–20、……、10–90 划分（9 个点），每个大小平均多次运行。它展示了**数据的取舍**：训练实例多，模型通常更好；评估实例多，估计更可靠。一份数据两者不可兼得。")),
                 p(T(r"Below: error against training size $N$ for a straight line ($D = 1$) fitted to the noisy sine. Training error rises (a line cannot memorise more points), test error falls, and they **meet high up**, above the noise floor.", r"下图：用直线（$D = 1$）拟合带噪声的正弦，误差随训练集大小 $N$ 的变化。训练误差上升（直线记不住更多的点），测试误差下降，两条线**在高处会合**，高于噪声下限。")),
                 svg(drawn(fig_lc_bias), T('Learning curve of a straight line: training and test error converge at a high level.', '直线模型的学习曲线：训练和测试误差在高位会合。')),
                 ps(r"At $N = 200$: training «a», test «b». The gap is tiny and the level is high. Doubling the data would not change this.", r"$N = 200$ 时：训练 «a»，测试 «b»。差距很小，水平很高。数据再翻倍也不会改变。", a=f3(lb[-1][1]), b=f3(lb[-1][2])),
                 chapter=T('Reading learning curves', '读学习曲线')),

            read('read-lc', T('How to read a learning curve', '怎样读学习曲线'),
                 svg(drawn(fig_lc_var), T('Learning curve of an order-9 polynomial: a large gap that closes only slowly as data grows; the test curve starts off the chart.', '9 阶多项式的学习曲线：差距很大，随数据增加只缓慢缩小；测试曲线起点在图外。')),
                 ps(r"Here the model is flexible. The test error starts off the chart (small $N$); at $N = 60$ the gap is «g60», at $N = 200$ it is «g200». More data helps, and the gap is the signal.", r"这里的模型很灵活。测试误差起点在图外（$N$ 小）；$N = 60$ 时差距是 «g60»，到 $N = 200$ 时缩到 «g200»。多加数据有帮助；差距就是信号。",
                    g60=f3(lv[3][2] - lv[3][1]), g200=f3(lv[-1][2] - lv[-1][1])),
                 table([T('Looks like', '看起来'), T('Diagnosis', '诊断'), T('More data?', '多加数据？')],
                       [T('both errors high, curves close together', '两条误差都高，彼此靠近'), T('**high bias** (underfitting)', '**高偏差**（欠拟合）'), T('will not help by itself', '本身没用')],
                       [T('training error low, test error much higher: a gap', '训练误差低、测试误差高得多：有差距'), T('**high variance** (overfitting)', '**高方差**（过拟合）'), T('likely to help', '很可能有用')],
                       [T('both low and close', '都低而且接近'), T('good bias-variance trade-off', '偏差-方差权衡得好'), T('little left to gain', '收益不大')]),
                 p(T(r"The deck's Naive Bayes curve (training about 0.82, validation about 0.80, meeting near 0.8): the curves have met, so extra data will not move them much. If 0.8 is below what we need, the limit is the model (or the noise in the problem), so we need a richer model or better features, not more of the same data.", r"课件里朴素贝叶斯的曲线（训练约 0.82、验证约 0.80，在 0.8 附近会合）：两条线已会合，更多数据改变不大。如果 0.8 达不到要求，限制来自模型（或问题本身的噪声），要的是更丰富的模型或更好的特征，而不是更多同样的数据。")),
                 quiz(T(r"Training error 2%, validation error 15%, and the validation curve still slopes down at the largest training size. What do you try first?", r"训练误差 2%，验证误差 15%，在最大的训练集规模处验证曲线仍在下降。先试什么？"),
                      [(T(r"Add many more features.", r"加很多特征。"), T(r"More features raise complexity and widen the gap. That is a remedy for high bias.", r"更多特征提高复杂度，让差距更大。那是高偏差的对策。")),
                       (T(r"Switch to a more complex model.", r"换更复杂的模型。"), T(r"The model already fits the training data almost perfectly; more flexibility only widens the gap.", r"模型已经几乎完美拟合训练数据；更灵活只会让差距更大。")),
                       (T(r"Collect more training data (or reduce the complexity): this is high variance.", r"收集更多训练数据（或降低复杂度）：这是高方差。"), True)],
                      T(r"A gap means variance; a high level with no gap means bias.", r"有差距：方差。水平高而没有差距：偏差。"))),

            read('remedies', T('Remedies: what to change for each problem', '对策：对症下药'),
                 table([T('Problem', '问题'), T('Remedies', '对策'), T('Why it works', '为什么有效')],
                       [T('**High bias** (underfit)', '**高偏差**（欠拟合）'), T('use a more complex model (e.g. a non-linear one); add features; boosting', '用更复杂的模型（如非线性的）；加特征；boosting'), T('the model family can now bend to the pattern', '模型族终于能弯到规律上')],
                       [T('**High variance** (overfit)', '**高方差**（过拟合）'), T('add more training data; use fewer features (feature selection); reduce complexity; bagging', '加训练数据；减少特征（特征选择）；降低复杂度；bagging'), T('less room to chase noise; noise averages out', '追逐噪声的余地变小；噪声被平均掉')]),
                 p(T(r"Complex models are prone to high variance; simple ones to high bias. Bias goes down and variance goes up as complexity grows, so the remedy for one is the cause of the other: **it is a trade-off**. Ensembles (lecture 16) escape part of it: bagging attacks variance, boosting attacks bias.", r"复杂模型容易高方差，简单模型容易高偏差。复杂度增加时偏差降、方差升，所以治一个的药正是另一个的病：**这是个权衡**。集成方法（第 16 讲）能逃开一部分：bagging 对付方差，boosting 对付偏差。")),
                 quiz(T(r"Which action is a remedy for high **variance**?", r"下面哪个是对付高**方差**的办法？"),
                      [(T(r"Drop some features or limit the tree depth.", r"去掉一些特征或限制树的深度。"), True),
                       (T(r"Add polynomial features.", r"加多项式特征。"), T(r"That raises complexity: it lowers bias and raises variance.", r"那会提高复杂度：降低偏差、提高方差。")),
                       (T(r"Use boosting with deeper trees.", r"用 boosting 并加深树。"), T(r"Boosting mainly reduces bias; deeper trees increase variance.", r"boosting 主要降低偏差；更深的树增加方差。"))],
                      T(r"Match the cure to the diagnosis: gap, simplify or add data; no gap and high error, enrich.", r"对症下药：有差距就简化或加数据；没差距而误差高就丰富模型。"))),

            read('meanings', T('Bias and variance: five meanings', '偏差与方差：五个含义'),
                 table([T('–', '–'), T('Model', '模型'), T('Evaluation', '评估'), T('Sampling', '抽样')],
                       [T('**Bias**', '**偏差**'), T('the tendency to make systematically wrong predictions', '倾向于做出系统性错误的预测'), T('the evaluation strategy over- or under-estimates performance', '评估方式系统性地高估或低估表现'), T('the training/evaluation data is not representative of the population', '训练/评估数据不能代表总体')],
                       [T('**Variance**', '**方差**'), T('predictions change a lot when the training set changes slightly', '训练集稍变，预测就大变'), T('the estimate of performance changes a lot with the evaluation instances', '性能估计随评估实例大幅变化'), T('–', '–')]),
                 h(T('Model bias in regression', '回归中的模型偏差')),
                 p(T(r"For each evaluation instance the **signed error** is $y_i - \hat y_i$. The deck defines the bias $B$ as their average, and a model as biased if its predictions are systematically too high or too low:", r"对每个评估实例，**带符号的误差**是 $y_i - \hat y_i$。课件把偏差 $B$ 定义为它们的平均，预测系统性地偏高或偏低就是有偏：")),
                 math_(r"B = \frac{1}{N}\sum_{i=1}^{N}(y_i - \hat y_i)"),
                 p(T(r"The formal version used for the decomposition is $B = E[\hat f(x)] - f(x)$: the gap between the **average** prediction (over many training sets) and the truth. Careful: errors of $+3$ and $-3$ average to zero bias but are bad predictions. The signed average measures systematic error, not size; that is what MSE and the variance are for.", r"分解里用的形式是 $B = E[\hat f(x)] - f(x)$：（在许多训练集上取）**平均**预测与真值之间的差。注意：$+3$ 和 $-3$ 的误差平均起来偏差为零，预测却很差。带符号的平均衡量的是系统性误差，不是大小；大小要靠 MSE 和方差。")),
                 p(T(r"For classification the deck gives no formula (outside the scope of COMP90049): an unbiased classifier produces labels with the same distribution as the actual one; a classifier **biased towards the majority class** predicts too many instances as the majority class.", r"分类的偏差课件没有给公式（超出 COMP90049 范围）：无偏的分类器给出的标签分布与实际分布相同；**偏向多数类**的分类器把太多实例预测成多数类。")),
                 h(T('Model variance', '模型方差')),
                 math_(r"V = E\!\left[\big(\hat f(x) - E[\hat f(x)]\big)^2\right]"),
                 p(T(r"High variance: a different random training set gives very different predictions on the evaluation set. Low variance: similar predictions, **whether or not they are correct**. Zero-R has zero variance (always the majority class) and high bias.", r"方差高：换一份随机训练集，在评估集上的预测就大不相同。方差低：预测相似，**不管对不对**。Zero-R 的方差为零（永远预测多数类）而偏差很高。")),
                 chapter=T('The decomposition', '偏差-方差分解')),

            read('expectation', T('Deeper: the facts about expectations the derivation needs', '深入：推导要用的几个期望性质'),
                 p(T(r"The **expectation** $E[X]$ of a random variable is the average over unlimited samples. For a discrete $X$ with mass function $p$, and for a continuous one with density $p$:", r"随机变量的**期望** $E[X]$ 是无限多次抽样的平均。离散 $X$（概率质量函数 $p$）和连续 $X$（密度 $p$）分别是：")),
                 math_(r"E[X] = \sum_x x\,p(x), \qquad E[X] = \int x\,p(x)\,dx"),
                 p(T(r"The deck's example: a Bernoulli $X \in \{0, 1\}$ with $p(0) = p(1) = \tfrac12$ has $E[X] = 0 \cdot \tfrac12 + 1 \cdot \tfrac12 = \tfrac12$. The average of $n$ samples approaches it as $n$ grows (0.8 for 10 samples, 0.44 for 100, 0.5138 for 10000 in the deck's run). “An expectation is an average with unlimited samples.”", r"课件的例子：伯努利 $X \in \{0, 1\}$，$p(0) = p(1) = \tfrac12$，则 $E[X] = 0 \cdot \tfrac12 + 1 \cdot \tfrac12 = \tfrac12$。$n$ 个样本的平均随 $n$ 增大逼近它（课件的一次运行：10 个样本 0.8，100 个 0.44，10000 个 0.5138）。“期望就是无限样本的平均。”")),
                 p(T(r"What the next derivation uses:", r"下一步推导用到的：")),
                 ul(T(r"$E[c] = c$ for a constant $c$, and $E[cX] = c\,E[X]$; $E[X + Y] = E[X] + E[Y]$ (always).", r"常数 $c$：$E[c] = c$，$E[cX] = c\,E[X]$；$E[X + Y] = E[X] + E[Y]$（永远成立）。"),
                    T(r"$E[XY] = E[X]\,E[Y]$ when $X$ and $Y$ are **independent**.", r"$X$ 与 $Y$ **独立**时，$E[XY] = E[X]\,E[Y]$。"),
                    T(r"$\text{Var}(X) = E[(X - E[X])^2] = E[X^2] - E[X]^2$, so $E[X^2] = \text{Var}(X) + E[X]^2$.", r"$\text{Var}(X) = E[(X - E[X])^2] = E[X^2] - E[X]^2$，所以 $E[X^2] = \text{Var}(X) + E[X]^2$。"),
                    T(r"$E[X - E[X]] = E[X] - E[X] = 0$: deviations from the mean average to zero.", r"$E[X - E[X]] = E[X] - E[X] = 0$：离均值的偏差平均为零。")),
                 p(T(r"What is random in the decomposition: the **training set** (so $\hat f$ is random, one fit per training set) and the **noise** $\varepsilon$ of the test target. $f(x)$ at a fixed $x$ is a plain number.", r"分解里什么是随机的：**训练集**（所以 $\hat f$ 是随机的，每份训练集一个拟合）和测试目标的**噪声** $\varepsilon$。固定 $x$ 处的 $f(x)$ 只是个普通的数。")),
                 quiz(T(r"$X$ is the roll of a fair die. What is $E[X]$, and is it a value $X$ can take?", r"$X$ 是一个均匀骰子的点数。$E[X]$ 是多少？它是 $X$ 能取到的值吗？"),
                      [(T(r"3.5: an average, not a value you can roll.", r"3.5：这是平均，不是能掷出的值。"), True),
                       (T(r"3 or 4: the middle faces.", r"3 或 4：中间的两面。"), T(r"The expectation weights every face by $\tfrac16$: $(1+2+\dots+6)/6 = 3.5$. It need not be attainable.", r"期望给每一面权重 $\tfrac16$：$(1+2+\dots+6)/6 = 3.5$。它不必是能取到的值。")),
                       (T(r"6: the most extreme face.", r"6：最极端的一面。"), T(r"The expectation is a probability-weighted average of all faces, not the maximum.", r"期望是所有面按概率加权的平均，不是最大值。"))],
                      T(r"An expectation is an average over unlimited repetitions.", r"期望是无限次重复的平均。"))),

            derive('decomp', T('Deeper: the bias-variance decomposition, line by line', '深入：一行一行推出偏差-方差分解'),
                   [(r"Y = f(x) + \varepsilon,\quad E[\varepsilon] = 0,\ \text{Var}(\varepsilon) = \sigma^2", T(r"Setup at one fixed input $x$. The truth is a function $f$; the observed target adds noise $\varepsilon$ (annotation or measurement error: unknown, unmeasurable). The noise has mean 0, variance $\sigma^2$, and is **independent of the training set**, hence of $\hat f$. We write $B$ for bias, $V$ for variance, $G$ for the generalisation error.", r"在某个固定的输入 $x$ 上设定。真相是函数 $f$；观测到的目标加了噪声 $\varepsilon$（标注或测量误差：未知、不可测）。噪声均值 0、方差 $\sigma^2$，并且**与训练集独立**，因此也与 $\hat f$ 独立。我们记偏差为 $B$、方差为 $V$、泛化误差为 $G$。")),
                    (r"G = E\big[(Y - \hat f(x))^2\big] = E\big[(f - \hat f + \varepsilon)^2\big]", T(r"The expected squared prediction error, averaged over training sets (through $\hat f$) and noise. Substitute $Y = f + \varepsilon$; write $f$ for $f(x)$ and $\hat f$ for $\hat f(x)$.", r"期望平方预测误差，对训练集（通过 $\hat f$）和噪声取平均。代入 $Y = f + \varepsilon$；$f$ 记 $f(x)$，$\hat f$ 记 $\hat f(x)$。")),
                    (r"= E\big[(f - \hat f)^2\big] + 2E\big[\varepsilon\,(f - \hat f)\big] + E[\varepsilon^2]", T(r"Expand $(A + B)^2 = A^2 + 2AB + B^2$ with $A = f - \hat f$, $B = \varepsilon$, and split the expectation of the sum.", r"按 $(A + B)^2 = A^2 + 2AB + B^2$ 展开，$A = f - \hat f$，$B = \varepsilon$，并把和的期望拆开。")),
                    (r"2E[\varepsilon]\,E[f - \hat f] = 2 \cdot 0 \cdot E[f - \hat f] = 0", T(r"The cross term. $\varepsilon$ is independent of $\hat f$, so the expectation of the product is the product of the expectations; and $E[\varepsilon] = 0$. It vanishes.", r"交叉项。$\varepsilon$ 与 $\hat f$ 独立，所以乘积的期望等于期望的乘积；又 $E[\varepsilon] = 0$。它消失了。")),
                    (r"E[\varepsilon^2] = \text{Var}(\varepsilon) + E[\varepsilon]^2 = \sigma^2", T(r"The last term: $E[X^2] = \text{Var}(X) + E[X]^2$ with $E[\varepsilon] = 0$. This is the **irreducible error**: noise in the data that no model can predict.", r"最后一项：$E[X^2] = \text{Var}(X) + E[X]^2$，$E[\varepsilon] = 0$。这就是**不可约误差**：数据里任何模型都预测不了的噪声。")),
                    (r"f - \hat f = \big(f - E[\hat f]\big) + \big(E[\hat f] - \hat f\big)", T(r"Now the first term, $E[(f - \hat f)^2]$. The trick: add and subtract the **average prediction** $E[\hat f]$. The first bracket is a fixed number (truth minus average prediction); the second is the random fluctuation of $\hat f$ around its own average.", r"现在看第一项 $E[(f - \hat f)^2]$。技巧：加减**平均预测** $E[\hat f]$。第一个括号是固定的数（真值减平均预测）；第二个是 $\hat f$ 围绕自身平均的随机波动。")),
                    (r"E\big[(f - \hat f)^2\big] = \big(f - E[\hat f]\big)^2 + 2\big(f - E[\hat f]\big)E\big[E[\hat f] - \hat f\big] + E\big[(\hat f - E[\hat f])^2\big]", T(r"Expand the square again. In the middle term the fixed bracket $(f - E[\hat f])$ comes out of the expectation, and the first term is a constant, so its expectation is itself.", r"再展开一次平方。中间项里，固定的括号 $(f - E[\hat f])$ 可以提到期望外面，第一项是常数，期望就是它本身。")),
                    (r"E\big[E[\hat f] - \hat f\big] = E[\hat f] - E[\hat f] = 0", T(r"The new cross term: deviations of $\hat f$ from its own average have mean zero. It vanishes too.", r"新的交叉项：$\hat f$ 偏离自身平均的偏差均值为零。它也消失了。")),
                    (r"E\big[(f - \hat f)^2\big] = \underbrace{\big(f - E[\hat f]\big)^2}_{B^2} + \underbrace{E\big[(\hat f - E[\hat f])^2\big]}_{V}", T(r"What is left: the squared **bias** (how far the average prediction is from the truth) plus the **variance** (how much a single fit scatters around its average).", r"剩下的是：**偏差**的平方（平均预测离真值有多远）加上**方差**（单次拟合围绕自身平均散开多少）。")),
                    (r"G = B^2 + V + \sigma^2", T(r"Put the two pieces together. **Expected test error = bias² + variance + irreducible noise.** The deck writes it with $\varepsilon^2$ for the last term; it means the noise variance $\sigma^2$.", r"把两部分合起来。**期望测试误差 = 偏差² + 方差 + 不可约噪声。**课件最后一项写成 $\varepsilon^2$，指的是噪声方差 $\sigma^2$。"))],
                   outro=T(r"Reading it: bias is **inherent to the model** (even with infinite data, a straight line cannot become a sine); variance is how **over-specialised** the fit is to one training set; $\sigma^2$ is a floor set by the data, which you can never beat. Zero-R has variance 0 and large bias; a flexible model has small bias and large variance. A good model balances the two.", r"怎么理解：偏差是**模型本身的**局限（数据无限多，直线也变不成正弦）；方差是拟合对某一份训练集**过度专门化**的程度；$\sigma^2$ 是数据设下的下限，永远超不过。Zero-R 方差为 0 而偏差大；灵活的模型偏差小而方差大。好模型在两者之间取得平衡。"),
                   blank=(3, '0', T(r"What does the cross term $2E[\varepsilon]\,E[f - \hat f]$ equal? (Use $E[\varepsilon] = 0$.)", r"交叉项 $2E[\varepsilon]\,E[f - \hat f]$ 等于多少？（用 $E[\varepsilon] = 0$。）")), skill=DEC),

            read('numeric-bv', T('The decomposition in numbers', '用数字看分解'),
                 ps(r"A check by simulation. Take the noisy sine, fix $x_0 = 0.25$ (where $f = 1$), and train a straight line ($D = 1$) and an order-6 polynomial on 2000 fresh training sets of 30 points each. The average prediction, bias² and variance at $x_0$:",
                    r"用模拟检验。取带噪声的正弦，固定 $x_0 = 0.25$（此处 $f = 1$），在 2000 份各含 30 个点的新训练集上训练一条直线（$D = 1$）和一个 6 阶多项式。在 $x_0$ 处的平均预测、偏差² 和方差："),
                 table([T('Model', '模型'), T('Mean prediction', '平均预测'), T('Bias²', '偏差²'), T('Variance', '方差'), T('+ σ² = 0.09', '+ σ² = 0.09')],
                       [T('Line, D = 1', '直线，D = 1')] + row(f3(PW1[0]), f3(PW1[1]), f3(PW1[2]), f3(PW1[3])),
                       [T('Order 6', '6 阶')] + row(f3(PW6[0]), f3(PW6[1]), f3(PW6[2]), f3(PW6[3]))),
                 ps(r"The line is off by about «b1» on average (the sine peaks at 1; a line cannot follow it): large bias, small variance. The order-6 fit is right on average («m6») and at this point its variance «v6» is hardly above the line's: here the flexible model simply wins. Variance is not the same everywhere, though: it is much larger near the two ends of the interval (the wild ends of the order-9 curve in the first figure), and averaged over all $x$ it is what makes the U-curve below turn up.",
                    r"直线平均偏离约 «b1»（正弦峰值是 1，直线跟不上）：偏差大、方差小。6 阶拟合平均下来是对的（«m6»），而且在这一点上它的方差 «v6» 比直线高不了多少：这里灵活的模型直接赢了。但方差并不处处一样：在区间两端要大得多（第一张图里 9 阶曲线两头的狂摆），对所有 $x$ 取平均后，正是它让下面的 U 形曲线翘起来。",
                    b1=f3(abs(PW1[0] - 1)), m6=f3(PW6[0]), v6=f3(PW6[2])),
                 p(T(r"A smaller version of the same trade, by hand: you estimate a mean $\mu = 2$ from $n = 4$ noisy observations (noise variance $\sigma^2 = 4$) and predict $c \cdot \bar x$, where $\bar x$ is the sample mean and $c \le 1$ shrinks it. Then $\text{Bias} = (c-1)\mu$, $\text{Var} = c^2\sigma^2/n$, so", r"同样的取舍，再手算一个小版本：从 $n = 4$ 个带噪声的观测（噪声方差 $\sigma^2 = 4$）估计均值 $\mu = 2$，预测 $c \cdot \bar x$，$\bar x$ 是样本均值，$c \le 1$ 把它往零压缩。此时 $\text{Bias} = (c-1)\mu$，$\text{Var} = c^2\sigma^2/n$，所以")),
                 math_(r"\text{MSE}(c) = (c - 1)^2\mu^2 + c^2\,\frac{\sigma^2}{n}"),
                 table([T('c', 'c'), T('Bias²', '偏差²'), T('Variance', '方差'), T('MSE', 'MSE')],
                       *[row(f'{c}', f2((c - 1) ** 2 * MU ** 2), f2(c * c * SG2 / NN), f2(shrink_mse(c))) for c in (1.0, 0.8, 0.5)]),
                 ps(r"$c = 1$ is unbiased but has MSE «m1»; accepting some bias with $c = 0.8$ lowers the MSE to «m8». Setting the derivative to zero, $2(c-1)\mu^2 + 2c\sigma^2/n = 0$, gives $c^* = \mu^2/(\mu^2 + \sigma^2/n) = «co»$. An unbiased estimator is not automatically the best one.",
                    r"$c = 1$ 无偏，但 MSE 是 «m1»；接受一点偏差取 $c = 0.8$，MSE 降到 «m8»。令导数为零 $2(c-1)\mu^2 + 2c\sigma^2/n = 0$，得 $c^* = \mu^2/(\mu^2 + \sigma^2/n) = «co»$。无偏的估计量不一定是最好的。",
                    m1=f2(shrink_mse(1.0)), m8=f2(shrink_mse(0.8)), co=f2(C_OPT))),

            read('complexity-knob', T('Complexity as a knob: polynomial order, k, depth', '复杂度是个旋钮：多项式阶数、k、深度'),
                 p(T(r"Look at the figure again: as complexity rises, bias² falls and variance rises. Test error is their sum plus the floor $\sigma^2$, so it is **U-shaped**; the best model sits at the bottom, not at zero training error.", r"再看那张图：复杂度升高，偏差²下降、方差上升。测试误差是它们的和再加下限 $\sigma^2$，所以是 **U 形**；最好的模型在谷底，而不是训练误差为零的地方。")),
                 svg(drawn(fig_complexity), T('Training error falls with complexity; test error falls then rises. Bias squared falls, variance rises; the dashed floor is the noise.', '训练误差随复杂度下降；测试误差先降后升。偏差²下降，方差上升；虚线下限是噪声。')),
                 table([T('Method', '方法'), T('Knob', '旋钮'), T('Low bias, high variance (complex)', '低偏差、高方差（复杂）'), T('High bias, low variance (simple)', '高偏差、低方差（简单）')],
                       [T('k-NN', 'k-NN'), T('$k$', '$k$'), T('$k = 1$: follows every training point, training error 0', '$k = 1$：紧跟每个训练点，训练误差为 0'), T('$k = N$: predicts the global majority (or mean), the same for every input', '$k = N$：永远预测全局多数类（或均值），对任何输入都一样')],
                       [T('Decision tree', '决策树'), T('depth, leaves', '深度、叶子数'), T('deep tree: memorises training data', '深树：记住训练数据'), T('depth 1 (like One-R) or Zero-R', '深度 1（像 One-R）或 Zero-R')],
                       [T('Polynomial regression', '多项式回归'), T('order $D$', '阶数 $D$'), T('large $D$', '$D$ 大'), T('$D = 0$ or 1', '$D = 0$ 或 1')],
                       [T('SVM', 'SVM'), T('$C$, kernel', '$C$、核函数'), T('large $C$ (hard margin)', '$C$ 大（硬间隔）'), T('small $C$ (wide, soft margin)', '$C$ 小（宽松的软间隔）')]),
                 details(T('k-NN regression: the variance is exactly σ²/k', 'k-NN 回归：方差恰好是 σ²/k'),
                         p(T(r"For k-NN regression the prediction at $x_0$ is the mean of $k$ neighbour targets, each with independent noise of variance $\sigma^2$. The variance of a mean of $k$ independent values is $\sigma^2/k$. With the neighbours' true values $f(x_{(l)})$ (textbook result, Hastie et al., ESL §7.3):", r"k-NN 回归在 $x_0$ 处的预测是 $k$ 个近邻目标的均值，每个带方差 $\sigma^2$ 的独立噪声。$k$ 个独立值的均值的方差是 $\sigma^2/k$。设近邻的真值为 $f(x_{(l)})$（教材结果，Hastie 等，ESL §7.3）：")),
                         math_(r"G(x_0) = \sigma^2 + \Big[f(x_0) - \frac{1}{k}\sum_{l=1}^{k} f(x_{(l)})\Big]^2 + \frac{\sigma^2}{k}"),
                         p(T(r"Larger $k$: variance $\sigma^2/k$ shrinks, but the neighbours reach further away, so the bias term grows. That is the trade-off for $k$ in one line.", r"$k$ 变大：方差 $\sigma^2/k$ 缩小，但近邻伸得更远，偏差项变大。这就是 $k$ 的权衡，一行就够。"))),
                 quiz(T(r"A decision tree has 100% training accuracy and 70% validation accuracy. Which change is most likely to improve validation accuracy?", r"一棵决策树训练准确率 100%、验证准确率 70%。哪个改动最可能提高验证准确率？"),
                      [(T(r"Limit the depth or prune the tree.", r"限制深度或剪枝。"), True),
                       (T(r"Grow the tree deeper.", r"把树长得更深。"), T(r"It already fits the training data perfectly; deeper means even more variance.", r"它已经完美拟合了训练数据；更深意味着方差更大。")),
                       (T(r"Add the test set to training.", r"把测试集加进训练。"), T(r"That destroys the evaluation (leakage) and does not cure overfitting.", r"那会毁掉评估（泄漏），也治不了过拟合。"))],
                      T(r"A perfect training score with a big gap is the signature of high variance: simplify.", r"训练满分而差距很大，是高方差的标志：简化。")),
                 ),

            read('eval-bv', T('Evaluation bias and evaluation variance', '评估的偏差与方差'),
                 p(T(r"The evaluation metric is itself an **estimator**. We want the true error rate of the classifier on the population, but we only have an estimate from one particular set of evaluation instances. This quality is independent of the trained model.", r"评估指标本身也是一个**估计量**。我们想知道分类器在总体上的真实错误率，手里却只有在某一组评估实例上的估计。这个质量与训练出的模型无关。")),
                 ul(T(r"**Evaluation bias**: our estimate of effectiveness is systematically too high or too low (e.g. training error as the estimate is too low; tuning on the validation set and reporting its score is too high).", r"**评估偏差**：我们对效果的估计系统性偏高或偏低（例如用训练误差当估计会偏低；在验证集上调参又报告它的分数会偏高）。"),
                    T(r"**Evaluation variance**: the estimate changes a lot as we alter the instances in the test set. It can be hard to tell apart from model variance.", r"**评估方差**：换一换测试集里的实例，估计就变化很大。它很难和模型方差分开。")),
                 p(T(r"Two traps from the deck: we can have good accuracy on one specific evaluation set and poor accuracy on other unseen sets; and it is possible to **overfit the validation data** with respect to the evaluation function, by trying many models and keeping the one that scored best.", r"课件提醒的两个陷阱：在某个具体的评估集上准确率很好，在别的没见过的评估集上却很差；还有可能对验证数据**过拟合**：试了很多模型，只留下得分最高的那个。")),
                 table([T('–', '–'), T('Model bias / variance', '模型偏差/方差'), T('Evaluation bias / variance', '评估偏差/方差')],
                       [T('About', '关于'), T('the learned model $\\hat f$', '学出来的模型 $\\hat f$'), T('the number we report', '我们报告的那个数')],
                       [T('Source of randomness', '随机性来源'), T('which training set we drew', '抽到了哪份训练集'), T('which test instances we drew (and how we split)', '抽到了哪些测试实例（以及怎么划分）')],
                       [T('Cure', '对策'), T('change the model: complexity, data', '改模型：复杂度、数据'), T('change the evaluation: more test data, cross-validation, stratification', '改评估：更多测试数据、交叉验证、分层')]), chapter=T('Evaluation itself: bias and variance', '评估本身的偏差与方差')),

            derive('eval-var', T('Deeper: how noisy is a test accuracy?', '深入：测试准确率有多吵？'),
                   [(r"A = \frac{1}{n}\sum_{i=1}^{n} X_i,\quad X_i \in \{0, 1\}", T(r"Accuracy $A$ on $n$ independent test instances is the mean of $n$ indicator variables $X_i$: each is 1 (instance $i$ correct) with probability $p$, the model's true accuracy, and 0 otherwise.", r"$n$ 个独立测试实例上的准确率 $A$，是 $n$ 个指示变量 $X_i$ 的均值：每个以概率 $p$（模型的真实准确率）取 1（正确），否则取 0。")),
                    (r"E[A] = p", T(r"The estimate is **unbiased** here: its expectation is the true accuracy (as long as the test set was not used to choose the model).", r"这里估计是**无偏的**：期望就是真实准确率（前提是测试集没用来选过模型）。")),
                    (r"\text{Var}(X_i) = p(1 - p)", T(r"A 0/1 variable: $E[X^2] = p$, so $\text{Var} = p - p^2$.", r"0/1 变量：$E[X^2] = p$，所以 $\text{Var} = p - p^2$。")),
                    (r"\text{Var}(A) = \frac{1}{n^2}\sum_i \text{Var}(X_i) = \frac{p(1-p)}{n}", T(r"Independent variances add; the factor $\tfrac{1}{n}$ comes out squared.", r"独立的方差相加；系数 $\tfrac{1}{n}$ 提出来要平方。")),
                    (tx(r"\text{SD}(A) = \sqrt{\frac{0.8 \cdot 0.2}{100}} = «s1»", s1=f3(sd100)), T(r"For a true accuracy of 0.8 on a test set of $n = 100$: the standard deviation is 4 percentage points. A reported 84% and a reported 76% are compatible with the same model.", r"真实准确率 0.8、测试集 $n = 100$ 时：标准差是 4 个百分点。报告 84% 和报告 76% 可能来自同一个模型。")),
                    (tx(r"\text{SD}(A) = \sqrt{\frac{0.8 \cdot 0.2}{400}} = «s2»", s2=f3(sd400)), T(r"Four times the test data halves the noise: the noise shrinks like $1/\sqrt{n}$.", r"测试数据多四倍，噪声减半：噪声按 $1/\sqrt{n}$ 缩小。"))],
                   outro=T(r"This is why a small test set gives a high evaluation variance, and why differences of a point or two between models on a small test set mean nothing.", r"这就是为什么小测试集的评估方差很高，也是为什么小测试集上两个模型差一两个点说明不了什么。"),
                   blank=(4, '0.04', T(r"Evaluate the square root: $\sqrt{0.16/100}$.", r"算出这个平方根：$\sqrt{0.16/100}$。")), skill=EV),

            read('controls', T('Controlling bias and variance in evaluation', '怎样控制评估里的偏差与方差'),
                 table([T('Choice', '选择'), T('Effect (the deck)', '效果（课件）')],
                       [T('Holdout: more training, less test data', '留出法：训练多、测试少'), T('less model variance, **more** evaluation variance', '模型方差更小，评估方差**更大**')],
                       [T('Holdout: less training, more test data', '留出法：训练少、测试多'), T('**more** model variance, less evaluation variance', '模型方差**更大**，评估方差更小')],
                       [T('k-fold cross-validation', 'k 折交叉验证'), T('less variance than holdout, for the model and for the evaluation', '模型和评估的方差都比留出法小')],
                       [T('Stratification', '分层'), T('less model and evaluation bias', '模型和评估的偏差都更小')],
                       [T('Leave-one-out (k = N)', '留一法（k = N）'), T('no sampling bias; lowest bias and variance in general', '没有抽样偏差；一般偏差和方差最低')]),
                 p(T(r"Why the holdout row reads that way: the one split is split between two jobs. Every instance given to the test set makes the **estimate** steadier (evaluation variance down) but takes one away from training, so the **model** is weaker and more sensitive to what it was given (model variance up, and the estimate pessimistic).", r"留出法这一行为什么这样：同一份数据要分给两件事。每多给测试集一个实例，**估计**更稳（评估方差降），却从训练里拿走一个，于是**模型**更弱、对拿到什么数据更敏感（模型方差升，估计偏悲观）。")),
                 callout('note', T('A caveat beyond the deck', '课件之外的提醒'), T(r"The deck says leave-one-out has the lowest bias and variance in general. Textbooks (Hastie et al., ESL §7.10) add that LOO is almost unbiased but its estimate can have **high variance**, because the $N$ training sets overlap almost entirely and the $N$ test scores are strongly correlated; $k = 5$ or 10 is often the better compromise. On the exam, give the deck's claim; mention the caveat only if asked to discuss.", r"课件说留一法一般偏差和方差最低。教材（Hastie 等，ESL §7.10）补充：留一法几乎无偏，但估计的**方差可能很高**，因为 $N$ 个训练集几乎完全重叠，$N$ 个测试分数强相关；$k = 5$ 或 10 往往是更好的折中。考试里按课件的说法答；被要求讨论时再提这个提醒。")),
                 h(T('Report the spread too', '也报告波动')),
                 p(T(r"For any evaluation method, report the mean **and the variance** of the scores. With $k$ fold scores $E_i$:", r"无论哪种评估方法，都要报告分数的均值**和方差**。$k$ 个折的分数 $E_i$：")),
                 math_(r"\mu = \frac{1}{k}\sum_{i=1}^{k} E_i, \qquad s^2 = \frac{1}{k}\sum_{i=1}^{k}(E_i - \mu)^2"),
                 ps(r"Five fold accuracies (%): 82, 78, 85, 80, 75. Mean «m»; squared deviations 4, 4, 25, 0, 25; variance «v» (the deck divides by $k$), standard deviation «s». So we would write «m» ± «s».",
                    r"五折的准确率（%）：82、78、85、80、75。均值 «m»；偏差平方 4、4、25、0、25；方差 «v»（课件除以 $k$），标准差 «s»。所以应写成 «m» ± «s»。",
                    m=f'{FMEAN:.0f}', v=f'{FVAR:.1f}', s=f'{sqrt(FVAR):.2f}'),
                 quiz(T(r"Model A scores 81.0% and model B 82.5% on the same 100-instance test set. What can you conclude?", r"在同一个 100 个实例的测试集上，模型 A 得 81.0%，模型 B 得 82.5%。能得出什么结论？"),
                      [(T(r"B is better: 82.5 > 81.0.", r"B 更好：82.5 > 81.0。"), T(r"A 1.5-point gap is well inside the roughly 4-point standard deviation of one such estimate.", r"1.5 个点的差距远小于这样一个估计约 4 个点的标准差。")),
                       (T(r"Not much: the standard deviation of each estimate is about 4 points, so the gap is within the noise. Use more test data or cross-validation.", r"结论很有限：每个估计的标准差约 4 个点，差距在噪声之内。要用更多测试数据或交叉验证。"), True),
                       (T(r"A is better, because it is closer to 80%.", r"A 更好，因为它更接近 80%。"), T(r"Nothing makes 80% special. Closeness to a round number is not evidence.", r"80% 并不特殊。接近整数不是证据。"))],
                      T(r"Compare the gap with the evaluation variance before declaring a winner.", r"宣布赢家之前，先拿差距和评估方差比。")),
                 ),

            number('ck-bias', T('Model bias and MSE from predictions', '由预测算模型偏差和 MSE'), DEC,
                   T(r"A regression model predicts $\hat y = (10, 16, 7, 17)$ for actual values $y = (12, 15, 9, 20)$. Using the lecture's definition (the average signed error $\frac{1}{N}\sum (y_i - \hat y_i)$), what is the model bias?", r"一个回归模型对实际值 $y = (12, 15, 9, 20)$ 预测 $\hat y = (10, 16, 7, 17)$。按课件的定义（带符号误差的平均 $\frac{1}{N}\sum (y_i - \hat y_i)$），模型偏差是多少？"),
                   BIAS_B,
                   S(r"Signed errors $y - \hat y$: $2, -1, 2, 3$; mean $= 6/4 = «b»$. Positive: the model predicts too low on average. (The MSE is «m»; it also sees the sizes, which the bias ignores.)", r"带符号误差 $y - \hat y$：$2, -1, 2, 3$；平均 $= 6/4 = «b»$。为正：模型平均预测偏低。（MSE 是 «m»；它还看到大小，偏差则不看。）", b=f2(BIAS_B), m=f2(MSE_B)),
                   tolerance=0.01, purpose='practice', chapter=T('Exam practice', '考试练习')),

            choice('ck-curve', T('Diagnose the learning curve', '诊断学习曲线'), LCV,
                   T(r"For a classifier the learning curves show: training error 3% and validation error 14% at the largest training size; the validation error is still falling slowly. Which diagnosis and remedy fit?", r"某分类器的学习曲线显示：在最大训练集规模处训练误差 3%、验证误差 14%；验证误差仍在缓慢下降。哪种诊断与对策合适？"),
                   [(T(r"High bias: use a more complex model.", r"高偏差：用更复杂的模型。"), T(r"High bias shows as high error on both curves. Here the training error is tiny; the problem is the gap.", r"高偏差表现为两条曲线误差都高。这里训练误差很小；问题在差距。"), 'bias-variance'),
                    (T(r"High variance: add training data, remove features or reduce complexity.", r"高方差：加训练数据、减特征或降复杂度。"), True),
                    (T(r"Good trade-off: stop.", r"权衡得很好：到此为止。"), T(r"An 11-point gap, with the curve still falling, is not a good trade-off; more data would help.", r"差距 11 个点、曲线还在降，不算好；更多数据会有帮助。"), 'gap'),
                    (T(r"High variance: add many more features.", r"高方差：加很多特征。"), T(r"Right diagnosis, wrong cure: more features raise the complexity and widen the gap.", r"诊断对了，药开错了：更多特征提高复杂度、加宽差距。"), 'remedy')],
                   T(r"Gap between the curves → variance → more data, fewer features, less complexity, bagging.", r"两线之间有差距 → 方差 → 多数据、少特征、降复杂度、bagging。")),

            number('ck-knnvar', T('Variance of k-NN regression', 'k-NN 回归的方差'), DEC,
                   T(r"A k-NN regressor averages the targets of its $k$ nearest neighbours, each with independent noise of variance $\sigma^2 = 4$. What is the variance of its prediction due to noise when $k = 8$?", r"k-NN 回归器对 $k$ 个最近邻的目标取平均，每个带方差 $\sigma^2 = 4$ 的独立噪声。$k = 8$ 时，由噪声引起的预测方差是多少？"),
                   0.5,
                   T(r"The variance of the mean of $k$ independent values is $\sigma^2/k = 4/8 = 0.5$. With $k = 1$ it would be 4: the price of following every point. The bias term grows with $k$, since the neighbours are farther away.", r"$k$ 个独立值的均值的方差是 $\sigma^2/k = 4/8 = 0.5$。$k = 1$ 时是 4：紧跟每个点的代价。偏差项随 $k$ 增大，因为近邻离得更远。"),
                   tolerance=0.01),

            number('ck-fold', T('Spread of the fold scores', '各折分数的波动'), EV,
                   T(r"Five-fold cross-validation gives accuracies (%) of 82, 78, 85, 80, 75. Using the lecture's formula (divide by $k$), what is the variance of the scores?", r"五折交叉验证得到的准确率（%）是 82、78、85、80、75。按课件的公式（除以 $k$），分数的方差是多少？"),
                   round(FVAR, 4),
                   S(r"Mean $= 80$. Squared deviations $4, 4, 25, 0, 25$ sum to 58; $58/5 = «v»$. (Dividing by $k - 1$ would give 14.5; state which you use.)", r"均值 $= 80$。偏差平方 $4, 4, 25, 0, 25$，和为 58；$58/5 = «v»$。（除以 $k - 1$ 会得 14.5；要写明用哪个。）", v=f'{FVAR:.1f}'),
                   tolerance=0.1),

            choice('ck-bias-types', T('Which bias is it?', '这是哪种偏差？'), EV,
                   T(r"A team tries 50 hyperparameter settings, picks the one with the highest score on the validation set, and reports that score as the expected performance. Which statement is correct?", r"一个团队试了 50 组超参数，选验证集上得分最高的那组，并把这个分数当作预期表现来报告。哪种说法对？"),
                   [(T(r"Model variance: the model is too sensitive to the training data.", r"模型方差：模型对训练数据过于敏感。"), T(r"Model variance concerns how the fitted model changes with the training set. Here the reported *number* is the problem.", r"模型方差说的是拟合出的模型随训练集怎么变。这里出问题的是报告的那个*数*。"), 'bias-types'),
                    (T(r"Evaluation bias: the reported score is systematically too high, because the validation set was used to pick the winner.", r"评估偏差：报告的分数系统性偏高，因为验证集被用来挑赢家。"), True),
                    (T(r"Sampling bias: the validation set is not representative.", r"抽样偏差：验证集没有代表性。"), T(r"Nothing says the data is unrepresentative; the selection process is the source of the optimism.", r"没有迹象说数据没有代表性；乐观来自选择的过程。"), 'sampling'),
                    (T(r"No problem: the validation set is meant for this.", r"没问题：验证集本来就是干这个的。"), T(r"It is meant for *choosing*, not for the final estimate. Report performance on an untouched test set.", r"它是用来*选择*的，不是用来做最终估计的。要在没碰过的测试集上报告表现。"), 'leak')],
                   T(r"Selecting the best of many on the same data makes its score an optimistic estimate: an evaluation bias.", r"在同一份数据上从很多个里挑最好的，它的分数就是个乐观的估计：评估偏差。")),

            text_q('ck-bv-explain', T('Bias and variance in words (Section A)', '用文字讲偏差与方差（A 部分）'), DEC,
                   T(r"Explain the difference between model bias and evaluation bias, and between model variance and evaluation variance. Give one example of each. (3 to 5 lines)", r"解释模型偏差与评估偏差的区别，以及模型方差与评估方差的区别。各举一个例子。（3 到 5 行）"),
                   [T(r"Model bias: the model makes systematically wrong predictions (e.g. a straight line for curved data; Zero-R)", r"模型偏差：模型系统性地预测错（如用直线拟合曲线数据；Zero-R）"),
                    T(r"Evaluation bias: the evaluation method systematically over- or under-estimates performance (e.g. testing on training data, tuning on the test set)", r"评估偏差：评估方法系统性地高估或低估表现（如在训练数据上测试、在测试集上调参）"),
                    T(r"Model variance: predictions change a lot when the training set changes (e.g. a deep tree, 1-NN)", r"模型方差：训练集一变，预测大变（如深树、1-NN）"),
                    T(r"Evaluation variance: the performance estimate changes a lot with the test instances (e.g. a small holdout set)", r"评估方差：性能估计随测试实例大幅变化（如很小的留出集）"),
                    T(r"Model bias and variance are about the learned model; evaluation bias and variance are about the number we report", r"模型的偏差与方差关乎学到的模型；评估的偏差与方差关乎我们报告的数")],
                   T(r"Model bias is the tendency of the model to make systematically wrong predictions, for example a linear model fitted to curved data, or Zero-R. Evaluation bias is when the evaluation strategy systematically over- or under-estimates the performance, for example measuring accuracy on the training data or tuning on the test set. Model variance is the sensitivity of the model to the particular training set: a deep decision tree or 1-NN changes a lot when a few training instances change. Evaluation variance is the variability of the performance estimate with the choice of test instances, for example with a small holdout set. So model bias and variance describe the learned model, while evaluation bias and variance describe how trustworthy the number is that we report.",
                     r"Model bias is the tendency of the model to make systematically wrong predictions, for example a linear model fitted to curved data, or Zero-R. Evaluation bias is when the evaluation strategy systematically over- or under-estimates the performance, for example measuring accuracy on the training data or tuning on the test set. Model variance is the sensitivity of the model to the particular training set: a deep decision tree or 1-NN changes a lot when a few training instances change. Evaluation variance is the variability of the performance estimate with the choice of test instances, for example with a small holdout set. So model bias and variance describe the learned model, while evaluation bias and variance describe how trustworthy the number is that we report."),
                   T(r"Four terms, each with a definition and an example, and the one-line contrast.", r"四个术语，各有定义和例子，再加一句对比。")),

            text_q('ck-bv-design', T('Diagnose and fix (Section C style)', '诊断并改进（C 部分风格）'), REM,
                   T(r"You train a decision tree on 2000 labelled emails for spam detection. It has 100% training accuracy and 82% accuracy on a validation set. Describe what the learning curve of training size against error would look like, diagnose the problem, and propose three changes with reasons. (A third of a page)", r"你在 2000 封有标签的邮件上训练决策树做垃圾邮件检测。训练准确率 100%，验证集准确率 82%。描述训练集大小对误差的学习曲线会是什么样，诊断问题，并提出三项改动和理由。（约三分之一页）"),
                   [T(r"Curve: training error near 0, validation error much higher: a large gap that narrows slowly with N", r"曲线：训练误差接近 0，验证误差高得多：差距很大，随 N 增大缓慢缩小"),
                    T(r"Diagnosis: high variance / overfitting (the tree memorises noise)", r"诊断：高方差/过拟合（树记住了噪声）"),
                    T(r"Remedy 1: limit depth or prune (reduce complexity)", r"对策 1：限制深度或剪枝（降复杂度）"),
                    T(r"Remedy 2: more training data, or fewer features (feature selection)", r"对策 2：更多训练数据，或更少特征（特征选择）"),
                    T(r"Remedy 3: bagging (a random forest) to average out variance; choose the depth on validation data or by cross-validation, not on the test set", r"对策 3：bagging（随机森林）平均掉方差；深度要在验证数据上或用交叉验证选，不能用测试集")],
                   T(r"The learning curve would show a training error near 0 and a validation error around 18%, with a large gap that closes only slowly as the training size grows. This is high variance, i.e. overfitting: the fully grown tree memorises the noise of these 2000 emails. I would (1) limit the tree depth or prune it, which reduces the model complexity and so the variance, with the depth chosen on a validation set or by cross-validation; (2) collect more labelled emails or remove uninformative features, since more data and fewer features both reduce variance; and (3) use bagging, such as a random forest, which averages many trees trained on bootstrap samples and so cancels much of the variance. I would not add features or make the tree deeper, as that increases the variance.",
                     r"The learning curve would show a training error near 0 and a validation error around 18%, with a large gap that closes only slowly as the training size grows. This is high variance, i.e. overfitting: the fully grown tree memorises the noise of these 2000 emails. I would (1) limit the tree depth or prune it, which reduces the model complexity and so the variance, with the depth chosen on a validation set or by cross-validation; (2) collect more labelled emails or remove uninformative features, since more data and fewer features both reduce variance; and (3) use bagging, such as a random forest, which averages many trees trained on bootstrap samples and so cancels much of the variance. I would not add features or make the tree deeper, as that increases the variance."),
                   T(r"State the picture, name the diagnosis, then give remedies that match it, each with its reason.", r"先说图的样子，点明诊断，再给与之匹配的对策，每条带理由。")),

            read('remember', T('What to remember', '要记住的'),
                 table([T('Topic', '主题'), T('Remember', '记住')],
                       [T('Under/overfitting', '欠拟合/过拟合'), T('underfit: both errors high; overfit: low training error, large gap. Complexity = parameters, polynomial order, tree depth/leaves', '欠拟合：两边误差都高；过拟合：训练误差低、差距大。复杂度 = 参数数、多项式阶数、树深度/叶子数')],
                       [T('Learning curve', '学习曲线'), T('performance against training size (or complexity, iterations); training vs validation curve; the gap shows variance, the level shows bias', '表现随训练集大小（或复杂度、迭代）的变化；训练曲线对验证曲线；差距看方差，水平看偏差')],
                       [T('High bias', '高偏差'), T('more data does not help by itself; fix: more complex model, more features, boosting', '多加数据本身没用；对策：更复杂的模型、更多特征、boosting')],
                       [T('High variance', '高方差'), T('more data helps; fix: more data, fewer features, less complexity, bagging', '多加数据有用；对策：更多数据、更少特征、降复杂度、bagging')],
                       [T('Bias, variance', '偏差、方差'), T(r'$B = E[\hat f] - f$ (regression: mean of $y - \hat y$); $V = E[(\hat f - E\hat f)^2]$', r'$B = E[\hat f] - f$（回归：$y - \hat y$ 的平均）；$V = E[(\hat f - E\hat f)^2]$')],
                       [T('Decomposition', '分解'), T(r'$G = B^2 + V + \sigma^2$; cross terms vanish because $E[\varepsilon] = 0$ and $E[\hat f - E\hat f] = 0$', r'$G = B^2 + V + \sigma^2$；交叉项消失是因为 $E[\varepsilon] = 0$、$E[\hat f - E\hat f] = 0$')],
                       [T('Knobs', '旋钮'), T('k-NN: small k = low bias, high variance; trees: deeper = more variance; polynomial: higher order = more variance', 'k-NN：k 小 = 低偏差高方差；树：越深方差越大；多项式：阶数越高方差越大')],
                       [T('Evaluation bias / variance', '评估偏差/方差'), T('bias: the strategy over/under-estimates; variance: the estimate moves with the test instances ($\\text{SD} = \\sqrt{p(1-p)/n}$)', '偏差：评估方式高估/低估；方差：估计随测试实例变化（$\\text{SD} = \\sqrt{p(1-p)/n}$）')],
                       [T('Controls', '控制手段'), T('holdout: more training = less model variance, more evaluation variance; k-fold: less variance; stratification: less bias; LOO: no sampling bias; report mean and variance of the folds', '留出法：训练多 = 模型方差小、评估方差大；k 折：方差更小；分层：偏差更小；留一：无抽样偏差；报告各折的均值和方差')]),
                 callout('warning', T('On the exam', '考试里'), T(r"Say which bias or variance you mean (model or evaluation). Read the gap and the level of a learning curve before naming a remedy.", r"说清你指的是哪种偏差或方差（模型还是评估）。先读学习曲线的差距和水平，再说对策。"))),
        ])


LESSONS = [L_evaluation, L_bias_variance]
