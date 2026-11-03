# COMP90049 lessons on the perceptron (deck 13) and the multi-layer perceptron (deck 14); see README.md here.
# Every number of a worked example is computed below (and asserted where a figure is typed into the text).
import math

import numpy as np

from ml_kit import *  # noqa: F401,F403

BLUE_, ORANGE_ = BLUE, ORANGE


# ---------------------------------------------------------------- numbers
def sigmoid(z):
    return 1 / (1 + math.exp(-z))


def perceptron_run(X, y, eta=1.0, theta=None, epochs=50):
    """The deck's algorithm: rows (epoch, x, y, theta before, score, mistake) and the final theta."""
    th = np.array(theta if theta is not None else [0.0] * len(X[0]), float)
    rows = []
    for ep in range(1, epochs + 1):
        updates = 0
        for x, t in zip(X, y):
            x = np.array(x, float)
            s = float(th @ x)
            mis = t * s <= 0
            rows.append((ep, [int(v) if float(v).is_integer() else v for v in x], t, [float(v) for v in th], s, mis))
            if mis:
                th = th + eta * t * x
                updates += 1
        if updates == 0:
            break
    return th, rows


EX1_X = [[1, 1, 1], [1, 1, 2], [1, 0, 0], [1, -1, 0]]
EX1_Y = [1, 1, -1, -1]
EX1_TH, EX1_ROWS = perceptron_run(EX1_X, EX1_Y)
assert list(EX1_TH) == [-1, 1, 1] and EX1_ROWS[-1][0] == 3 and sum(r[5] for r in EX1_ROWS) == 3

# XOR with labels -1/+1: the weights return to zero after every epoch
XOR_X = [[1, 0, 0], [1, 1, 0], [1, 0, 1], [1, 1, 1]]
XOR_Y = [-1, 1, 1, -1]
_th, XOR_ROWS = perceptron_run(XOR_X, XOR_Y, epochs=3)
assert all(r[5] for r in XOR_ROWS) and list(_th) == [0, 0, 0]

# a perceptron run with another learning rate makes the same mistakes (initial weights 0): only the scale changes
_a, ra = perceptron_run(EX1_X, EX1_Y, eta=1)
_b, rb = perceptron_run(EX1_X, EX1_Y, eta=0.1)
assert [r[5] for r in ra] == [r[5] for r in rb] and np.allclose(_b, _a * 0.1)

# Novikoff on the deck's example 1 with theta* = (-1, 1, 1) (norm sqrt 3)
_ts = np.array([-1.0, 1, 1])
GAMMA_UN = min(t * float(_ts @ np.array(x)) for x, t in zip(EX1_X, EX1_Y))
R2 = max(float(np.dot(x, x)) for x in EX1_X)
NORM2 = float(_ts @ _ts)
assert (GAMMA_UN, R2, NORM2) == (1.0, 6.0, 3.0) and R2 * NORM2 / GAMMA_UN ** 2 == 18

# checkpoint: eta = 0.5 on three points
CP_X = [[1, 2, 0], [1, 0, 1], [1, -1, -1]]
CP_Y = [1, -1, -1]
CP_TH, CP_ROWS = perceptron_run(CP_X, CP_Y, eta=0.5, epochs=1)
assert list(CP_TH) == [0, 1, -0.5]


def fnum(v):
    s = f'{v:g}'
    return s.replace('-', '-')


def vec(v):
    return '[' + ', '.join(f'{x:g}' for x in v) + ']'


# ---------------------------------------------------------------- figures
def line_in_box(P, th, color, width=2.5, dash=None):
    """The line th0 + th1 x1 + th2 x2 = 0 clipped to the plot box of P."""
    t0, t1, t2 = th
    pts = []
    n = 400
    for i in range(n + 1):
        x1 = P.x0 + (P.x1 - P.x0) * i / n
        if abs(t2) < 1e-12:
            continue
        x2 = -(t0 + t1 * x1) / t2
        if P.y0 <= x2 <= P.y1:
            pts.append((x1, x2))
    if abs(t2) < 1e-12:
        pts = [(-t0 / t1, P.y0), (-t0 / t1, P.y1)]
    if len(pts) >= 2:
        P.seg(pts[0], pts[-1], color, width, dash)


def point(P, x, y, label, size=9):
    """A class +1 point is a filled blue square, a class -1 point an orange ring."""
    if label > 0:
        P.parts.append(f'<rect x="{P.X(x) - size:.1f}" y="{P.Y(y) - size:.1f}" width="{2 * size}" height="{2 * size}" fill="{BLUE}"/>')
    else:
        P.parts.append(f'<circle cx="{P.X(x):.1f}" cy="{P.Y(y):.1f}" r="{size + 1}" fill="#ffffff" stroke="{ORANGE}" stroke-width="3.5"/>')


def legend(P, x, y):
    """Blue square = class +1, orange ring = class -1, at data position (x, y) of the plot P."""
    X, Y = P.X(x), P.Y(y)
    P.parts.append(f'<rect x="{X - 8:.1f}" y="{Y - 8:.1f}" width="16" height="16" fill="{BLUE}"/>')
    P.parts.append(f'<text x="{X + 14:.1f}" y="{Y + 6:.1f}" font-size="16" fill="{INK}">+1</text>')
    P.parts.append(f'<circle cx="{X + 70:.1f}" cy="{Y:.1f}" r="9" fill="#ffffff" stroke="{ORANGE}" stroke-width="3"/>')
    P.parts.append(f'<text x="{X + 86:.1f}" y="{Y + 6:.1f}" font-size="16" fill="{INK}">−1</text>')


def fig_neuron(lang):
    f = Fig(660, 350, lang)
    ys = [50, 115, 180, 290]
    names = ['1', 'x_{1}', 'x_{2}', 'x_{d}']
    ws = ['θ_{0}', 'θ_{1}', 'θ_{2}', 'θ_{d}']
    for y, n, w in zip(ys, names, ws):
        f.line(110, y, 330, 165, MUTED, 2)
        f.circle(70, y, 26, '#ffffff', INK)
        f.text(70, y + 6, n, 19, INK, 'middle')
        f.text(205, (y + 165) / 2 - 8, w, 18, BLUE)
    f.text(70, 248, '⋮', 26, MUTED, 'middle')
    f.circle(365, 165, 36, '#eef2fc', BLUE)
    f.text(365, 172, 'Σ', 26, BLUE, 'middle')
    f.line(401, 165, 470, 165, INK, 2.5, arrow=True)
    f.rect(470, 125, 80, 80, '#ffffff', INK)
    f.line(485, 180, 510, 180, INK, 3)
    f.line(510, 180, 510, 150, INK, 3)
    f.line(510, 150, 535, 150, INK, 3)
    f.line(550, 165, 610, 165, INK, 2.5, arrow=True)
    f.text(625, 172, 'y', 22, INK, 'middle')
    f.text(70, 342, f.L('inputs', '输入'), 16, MUTED, 'middle')
    f.text(205, 342, f.L('weights', '权重'), 16, MUTED, 'middle')
    f.text(365, 222, f.L('weighted sum θ·x', '加权和 θ·x'), 16, MUTED, 'middle')
    f.text(510, 232, f.L('activation f', '激活函数 f'), 16, MUTED, 'middle')
    f.text(625, 200, f.L('output', '输出'), 16, MUTED, 'middle')
    return f.svg()


def fig_geometry(lang):
    """The boundary th . x = 0 in 2-D, with th as its normal vector."""
    P = Plot(-1, 5, -1, 5)
    th = (-2.0, 1.0, 1.0)  # x1 + x2 = 2
    line_in_box(P, th, INK, 3)
    P.area([(-1, 3), (-1, 5), (5, 5), (5, -1), (3, -1)], BLUE, 0.07)
    P.area([(-1, 3), (-1, -1), (3, -1)], ORANGE, 0.07)
    P.seg((1, 1), (2.2, 2.2), GREEN, 3.5)
    P.dot(2.2, 2.2, GREEN, 6)
    P.text(2.45, 2.25, 'θ', GREEN, 22)
    P.text(3.7, 3.7, 'θ·x > 0', BLUE, 18, dx=0)
    P.text(-0.8, 0.0, 'θ·x ≤ 0', ORANGE, 18)
    P.text(-0.9, 3.45, 'θ·x = 0', INK, 18)
    P.axes('x₁', 'x₂', [0, 2, 4], [0, 2, 4])
    return P.svg()


def fig_ex1(lang):
    P = Plot(-2.2, 3.2, -2.2, 3.2)
    pts = [(1, 1, 1), (1, 2, 1), (0, 0, -1), (-1, 0, -1)]
    line_in_box(P, (1, 1, 1), MUTED, 2.5, '8 6')
    line_in_box(P, (0, 1, 1), PURPLE, 2.5, '8 6')
    line_in_box(P, (-1, 1, 1), GREEN, 3.5)
    for x, y, t in pts:
        point(P, x, y, t, 8)
    P.text(-2.0, -0.55, 'θ(1)', MUTED, 17)
    P.text(-1.1, 1.3, 'θ(2)', PURPLE, 17)
    P.text(1.9, 0.3, 'θ(3)', GREEN, 17)
    legend(P, 1.9, 2.9)
    P.axes('x₁', 'x₂', [-2, -1, 0, 1, 2, 3], [-2, -1, 0, 1, 2, 3])
    return P.svg()


def fig_ex2(lang):
    P = Plot(-0.5, 3.5, -2.2, 2.2)
    for x, y, t in [(1, 1, -1), (2, 1, 1), (1.5, 0.5, 1)]:
        point(P, x, y, t, 8)
    line_in_box(P, (-0.1, 0.2, 0.0), MUTED, 2.5, '8 6')
    line_in_box(P, (-0.2, 0.1, -0.1), PURPLE, 2.5, '8 6')
    line_in_box(P, (-0.1, 0.3, 0.0), GREEN, 3.5)
    P.text(0.55, 1.9, 'θ(0)', MUTED, 17)
    P.text(2.5, 0.2, 'θ(1)', PURPLE, 17)
    P.text(-0.45, 1.5, 'θ(2)', GREEN, 17)
    legend(P, 2.1, 1.9)
    P.axes('x₁', 'x₂', [0, 1, 2, 3], [-2, -1, 0, 1, 2])
    return P.svg()


def fig_xor(lang):
    P = Plot(-0.6, 1.8, -0.6, 1.8)
    for x, y, t in [(0, 0, -1), (1, 1, -1), (1, 0, 1), (0, 1, 1)]:
        point(P, x, y, t, 11)
    line_in_box(P, (-0.5, 1, 1), MUTED, 2.5, '8 6')
    line_in_box(P, (-1.5, 1, 1), MUTED, 2.5, '8 6')
    line_in_box(P, (0.2, 1, -1), MUTED, 2.5, '8 6')
    P.text(0.0, -0.3, '(0,0)', MUTED, 15, 'middle')
    P.text(1.0, -0.3, '(1,0)', MUTED, 15, 'middle')
    P.text(0.0, 1.3, '(0,1)', MUTED, 15, 'middle')
    P.text(1.0, 1.3, '(1,1)', MUTED, 15, 'middle')
    legend(P, 1.1, -0.4)
    P.axes('x₁', 'x₂', [0, 1], [0, 1])
    return P.svg()


def plot_legend(f, x, y, lang):
    f.rect(x, y - 12, 18, 18, BLUE, None, 0, 0)
    f.text(x + 26, y + 3, '+1', 15, INK)
    f.circle(x + 80, y - 3, 9, '#ffffff', ORANGE, 3)
    f.text(x + 96, y + 3, '−1', 15, INK)


# ================================================================ lesson 1: the perceptron
def trace_table():
    rows = []
    for ep, x, t, th, s, mis in EX1_ROWS:
        new = [a + t * b for a, b in zip(th, x)]
        rows.append([str(ep), vec(x), f'{t:+d}'.replace('+', ''), vec(th), f'{s:g}', f'{t * s:g}',
                     T(f'update → {vec(new)}', f'更新 → {vec(new)}') if mis else T('ok', '正确')])
    return table([T('epoch', '轮'), 'x', 'y', 'θ', 'θ·x', 'y(θ·x)', T('result', '结果')], *rows)


def L_perceptron():
    S = 'perceptron.neuron'
    R = 'perceptron.rule'
    C = 'perceptron.convergence'
    X = 'perceptron.xor'
    G = 'perceptron.sgd'
    return dict(
        id=lid('perceptron'),
        title=T('The perceptron: a neuron that learns from its mistakes', '感知机：从错误中学习的神经元'),
        description=T('The single artificial neuron, its learning rule traced by hand, why the rule is stochastic gradient descent, the convergence theorem and why XOR defeats it.',
                      '单个人工神经元、手算它的学习规则、为什么这条规则就是随机梯度下降、收敛定理，以及 XOR 为什么难倒它。'),
        minutes=40,
        skills=[{'id': S, 'name': T('The computational neuron and its decision boundary', '计算神经元及其决策边界')},
                {'id': R, 'name': T('The perceptron learning rule and algorithm', '感知机学习规则与算法')},
                {'id': G, 'name': T('The rule as stochastic gradient descent on the perceptron loss', '把规则看作感知机损失上的随机梯度下降')},
                {'id': C, 'name': T('Convergence on separable data', '线性可分数据上的收敛')},
                {'id': X, 'name': T('Linear separability and XOR', '线性可分与 XOR')}],
        misconceptions=[
            {'id': 'update-all', 'description': T('Updating the weights on every example, not only on mistakes', '每个样本都更新权重，而不是只在分错时更新')},
            {'id': 'no-converge-means-bug', 'description': T('Reading "no convergence" as proof that the data are not separable (or that the code is wrong)', '把“不收敛”当成数据一定不可分（或代码有错）的证据')},
            {'id': 'perceptron-max-margin', 'description': T('Believing the perceptron finds the maximum-margin boundary like an SVM', '以为感知机像 SVM 一样找到最大间隔边界')},
            {'id': 'boundary-nonlinear', 'description': T('Thinking the decision boundary θ·x = 0 is non-linear', '以为决策边界 θ·x = 0 是非线性的')}],
        steps=[
            read('place', T('Where the perceptron sits', '感知机在哪个位置'),
                 p(T(r"You have met two classifiers that output probabilities: Naive Bayes models $p(\mathbf{x}, y)$ (generative), logistic regression models $p(y \mid \mathbf{x})$ (discriminative). The perceptron drops probabilities altogether. Its one aim: **minimise the classification error directly**. It is a *geometric* classifier: it just puts a straight line (a hyperplane in more dimensions) between the two classes.",
                     r"前面学过两个输出概率的分类器：朴素贝叶斯建模 $p(\mathbf{x}, y)$（生成式），逻辑回归建模 $p(y \mid \mathbf{x})$（判别式）。感知机干脆不要概率，只有一个目标：**直接减少分类错误**。它是一个*几何*分类器：在两个类别之间画一条直线（高维里叫超平面）。")),
                 table(['', T('Naive Bayes', '朴素贝叶斯'), T('Logistic regression', '逻辑回归'), T('Perceptron', '感知机')],
                       [T('models', '建模对象'), r'$p(\mathbf{x}, y)$', r'$p(y \mid \mathbf{x})$', T('none: a boundary only', '无：只有一条边界')],
                       [T('objective', '目标'), T('maximise log-likelihood', '最大化对数似然'), T('minimise negative conditional log-likelihood', '最小化负条件对数似然'), T('minimise errors', '最小化错误')],
                       [T('output', '输出'), T('probability', '概率'), T('probability', '概率'), T('a class, −1 or 1', '一个类别，−1 或 1')]),
                 p(T(r"**Biological inspiration.** A neuron in the brain collects electrical signals from many other neurons through its dendrites, and fires along its axon only when the combined signal is strong enough. Crudely, the brain is a mesh of interconnected processing nodes relaying signals. An *artificial* neural network is a network of such processing elements, each turning its inputs into one output through a function (the **activation function**) of a weighted sum of the inputs. Designing the topology and adjusting the weights to the data is what training means.",
                     r"**生物学启发。** 脑中的一个神经元通过树突收集来自许多其他神经元的电信号，只有合起来的信号足够强，才沿轴突发出信号。粗略地说，大脑是由相互连接的处理节点组成的网络，在节点之间传递信号。*人工*神经网络就是这样一些处理单元组成的网络：每个单元把输入通过一个函数（**激活函数**，activation function）变成一个输出，这个函数作用在输入的加权和上。设计网络结构、再按数据调权重，就是训练。")),
                 p(T(r"**A short history, because exam questions ask for it.** 1943, McCulloch and Pitts: the first artificial neurons, output 1 if the weighted sum of inputs reaches a threshold and 0 otherwise, with weights set by hand. 1958, Rosenblatt: the **perceptron**, which *learns* its weights with a learning rule, even from random initial values. 1969, Minsky and Papert: the perceptron cannot solve linearly non-separable problems, and research stalled until the mid-1980s (the 'AI winter'). The limit is overcome by combining many perceptrons into a network, the subject of the next lesson.",
                     r"**一段简短的历史，考试会问。** 1943 年，McCulloch 和 Pitts：最早的人工神经元，加权和达到阈值就输出 1，否则输出 0，权重靠手工设定。1958 年，Rosenblatt：**感知机**（perceptron），用学习规则*自己学*权重，哪怕初值是随机的。1969 年，Minsky 和 Papert 指出感知机解决不了线性不可分的问题，研究因此停滞到 80 年代中期（“AI 寒冬”）。这个局限靠把许多感知机组合成网络来突破，那是下一课的内容。")),
                 chapter=T('The neuron', '神经元')),
            read('neuron', T('The artificial neuron, term by term', '人工神经元，逐项看'),
                 svg(drawn(fig_neuron), T('A neuron: inputs 1, x1, x2, ..., xd with weights θ0, θ1, θ2, ..., θd feed a sum, then an activation function, giving the output y.',
                                         '一个神经元：输入 1、x1、x2、…、xd，乘权重 θ0、θ1、θ2、…、θd 后求和，再过激活函数，得到输出 y。')),
                 p(T(r"A neuron takes an input vector $\mathbf{x} = (1, x_1, \dots, x_d)$ and computes a single output",
                     r"一个神经元接收输入向量 $\mathbf{x} = (1, x_1, \dots, x_d)$，算出一个输出")),
                 math_(r"y = f(\boldsymbol{\theta}\cdot\mathbf{x}) = f(\theta_0 + \theta_1 x_1 + \dots + \theta_d x_d)"),
                 ul(T(r"$\theta_j$ (weight): how much input $j$ matters, and in which direction. A large positive weight means 'when this feature is big, push towards class 1'; a negative weight pushes the other way. These are the **parameters** the algorithm learns.",
                      r"$\theta_j$（权重）：输入 $j$ 有多重要、朝哪个方向。大的正权重表示“这个特征大，就把结果推向类别 1”；负权重则相反。它们是算法要学的**参数**。"),
                    T(r"$x_0 = 1$ (the bias input): a constant input, so that $\theta_0$ is a weight like the others. Without it every boundary would have to pass through the origin; $\theta_0$ slides the boundary away from it. The deck says 'we add a bias term'; always write $\mathbf{x}$ with the leading 1.",
                      r"$x_0 = 1$（偏置输入）：一个恒为 1 的输入，这样 $\theta_0$ 就和其他权重一样处理。没有它，每条边界都得经过原点；$\theta_0$ 把边界从原点处平移开。课件里说“we add a bias term”；写 $\mathbf{x}$ 时永远带上开头的 1。"),
                    T(r"$f$ (activation function): a **hyper-parameter** chosen by us, not learned. It turns the weighted sum, any real number, into the neuron's output.",
                      r"$f$（激活函数）：由我们选定的**超参数**，不是学出来的。它把加权和（任意实数）变成神经元的输出。")),
                 callout('note', T('Parameter or hyper-parameter?', '参数还是超参数？'),
                         T(r"Parameters ($\boldsymbol{\theta}$) are fitted to the data. Hyper-parameters (the activation $f$, the learning rate $\eta$, the number of epochs) are fixed before fitting. The deck's definition lists exactly this split.",
                           r"参数（$\boldsymbol{\theta}$）由数据拟合出来；超参数（激活函数 $f$、学习率 $\eta$、轮数）在拟合之前定好。课件的定义里正是这样划分的。"))),
            read('step', T('The step function and the decision boundary', '阶跃函数与决策边界'),
                 p(T(r"For binary classification with classes $-1$ and $+1$, the perceptron uses the **step function** as its activation:",
                     r"对类别为 $-1$ 和 $+1$ 的二分类，感知机用**阶跃函数**（step function）作激活函数：")),
                 math_(r"\hat y = f(\boldsymbol{\theta}\cdot\mathbf{x}) = \begin{cases} 1 & \boldsymbol{\theta}\cdot\mathbf{x} > 0 \\ -1 & \boldsymbol{\theta}\cdot\mathbf{x} \le 0 \end{cases}"),
                 p(T(r"The neuron asks one question: is the weighted sum positive? The **decision boundary** is where the answer flips, the set of points with $\boldsymbol{\theta}\cdot\mathbf{x} = 0$. Written out in 2-D, $\theta_0 + \theta_1 x_1 + \theta_2 x_2 = 0$ is a **straight line**: the boundary is **linear**, so the perceptron is a *linear classifier*. The deck asks exactly this ('linear or non-linear?'); the step function is non-linear, but the *boundary* it creates is a line.",
                     r"神经元只问一个问题：加权和是不是正的？**决策边界**（decision boundary）就是答案翻转的地方，也就是满足 $\boldsymbol{\theta}\cdot\mathbf{x} = 0$ 的点。二维里写出来，$\theta_0 + \theta_1 x_1 + \theta_2 x_2 = 0$ 是一条**直线**：边界是**线性**的，所以感知机是*线性分类器*。课件就是这么问的（“linear or non-linear?”）；阶跃函数本身是非线性的，但它划出的*边界*是一条直线。")),
                 svg(drawn(fig_geometry), T('A line in the (x1, x2) plane with the weight vector θ drawn as an arrow perpendicular to it. θ·x > 0 on the side θ points to, θ·x ≤ 0 on the other.',
                                            '(x1, x2) 平面上的一条直线，权重向量 θ 画成垂直于它的箭头。θ 所指的一侧 θ·x > 0，另一侧 θ·x ≤ 0。')),
                 p(T(r"The weight vector $\boldsymbol{\theta}$ is **perpendicular** to the boundary and points into the class-$+1$ side. (Reason: $\boldsymbol{\theta}\cdot\mathbf{x}$ is the same for all points on the boundary, so moving *along* it changes nothing; the direction that changes the sum fastest is $\boldsymbol{\theta}$ itself.) Changing the weights *rotates* the line, changing $\theta_0$ *slides* it.",
                     r"权重向量 $\boldsymbol{\theta}$ **垂直于**边界，并指向类别 $+1$ 的一侧。（原因：边界上所有点的 $\boldsymbol{\theta}\cdot\mathbf{x}$ 都一样，所以*沿着*边界移动不改变和；让和变化最快的方向就是 $\boldsymbol{\theta}$ 本身。）改变权重是*转动*这条线，改变 $\theta_0$ 是*平移*它。")),
                 quiz(T(r"A perceptron in 2-D has $\boldsymbol{\theta} = (-2, 1, 1)$. Where is the boundary?", r"二维感知机的 $\boldsymbol{\theta} = (-2, 1, 1)$。边界在哪？"),
                      [(T(r"The line $x_1 + x_2 = 2$; the point $(3, 1)$ is class $+1$", r"直线 $x_1 + x_2 = 2$；点 $(3, 1)$ 属于类别 $+1$"), True),
                       (T(r"The line $x_1 + x_2 = -2$", r"直线 $x_1 + x_2 = -2$"), T(r"The bias is $\theta_0 = -2$, so $-2 + x_1 + x_2 = 0$ means $x_1 + x_2 = +2$. Move the constant to the other side.", r"偏置是 $\theta_0 = -2$，所以 $-2 + x_1 + x_2 = 0$ 即 $x_1 + x_2 = +2$。常数项要移到另一边。")),
                       (T(r"A curve, since the step function is not linear", r"一条曲线，因为阶跃函数不是线性的"), T(r"The step function only reads the sign of $\boldsymbol{\theta}\cdot\mathbf{x}$; the boundary is where $\boldsymbol{\theta}\cdot\mathbf{x} = 0$, and that is a line.", r"阶跃函数只看 $\boldsymbol{\theta}\cdot\mathbf{x}$ 的符号；边界是 $\boldsymbol{\theta}\cdot\mathbf{x} = 0$ 的地方，那是一条直线。"))],
                      T(r"At $(3,1)$: $-2 + 3 + 1 = 2 > 0$, so $\hat y = 1$.", r"在 $(3,1)$：$-2 + 3 + 1 = 2 > 0$，所以 $\hat y = 1$。"))),
            read('rule', T('The learning rule: fix only what is wrong', '学习规则：只修正错的地方'),
                 p(T(r"Learning means adjusting $\boldsymbol{\theta}$ so the training examples $(\mathbf{x}^{(i)}, y^{(i)})$ are classified correctly. Counting mistakes directly is mathematically awkward (we will see why in the deeper chapter), so the perceptron uses a simple loop: look at one example at a time and nudge the weights only if it is wrong.",
                     r"学习就是调整 $\boldsymbol{\theta}$，让训练样本 $(\mathbf{x}^{(i)}, y^{(i)})$ 被分对。直接数错误个数在数学上不好处理（深入的一章里会看到原因），所以感知机用一个简单的循环：一次看一个样本，只有分错才轻轻推一下权重。")),
                 table([T('true $y$', '真实 $y$'), r'$\hat y$', T('what to do', '怎么做'), T('why', '为什么')],
                       ['1', '1', T('nothing', '不动'), T('already right', '已经对了')],
                       ['−1', '−1', T('nothing', '不动'), T('already right', '已经对了')],
                       ['1', '−1', T('increase the weights', '增大权重'), T(r'$\boldsymbol{\theta}\cdot\mathbf{x} \le 0$ must rise above 0', r'$\boldsymbol{\theta}\cdot\mathbf{x} \le 0$ 要升到 0 以上')],
                       ['−1', '1', T('decrease the weights', '减小权重'), T(r'$\boldsymbol{\theta}\cdot\mathbf{x} > 0$ must fall to 0 or below', r'$\boldsymbol{\theta}\cdot\mathbf{x} > 0$ 要降到 0 或以下')]),
                 p(T(r"Since $\hat y$ and $y$ are both $\pm 1$, a mistake is simply a score with the wrong sign: $y\,(\boldsymbol{\theta}\cdot\mathbf{x}) \le 0$. (The deck uses $\le$, not $<$, so that the starting point $\boldsymbol{\theta} = \mathbf{0}$, where every score is 0, still counts as a mistake.) The update that handles both mistake rows at once is",
                     r"因为 $\hat y$ 和 $y$ 都是 $\pm 1$，分错就是得分符号不对：$y\,(\boldsymbol{\theta}\cdot\mathbf{x}) \le 0$。（课件用 $\le$ 而不是 $<$，这样起点 $\boldsymbol{\theta} = \mathbf{0}$（所有得分都是 0）时也算分错。）同时处理两种分错的更新是")),
                 math_(r"\theta_j \leftarrow \theta_j + \eta\, y\, x_j\ \ (j = 0, \dots, d),\qquad \boldsymbol{\theta} \leftarrow \boldsymbol{\theta} + \eta\, y\, \mathbf{x}"),
                 p(T(r"The form $\theta_j \leftarrow \theta_j + \eta(y - \hat y)x_j$ is the same rule: on a mistake $y - \hat y = 2y$ (the factor 2 is absorbed into $\eta$), on a correct example $y - \hat y = 0$ and nothing changes. **$\eta > 0$ is the learning rate**: the step size.",
                     r"形式 $\theta_j \leftarrow \theta_j + \eta(y - \hat y)x_j$ 是同一条规则：分错时 $y - \hat y = 2y$（系数 2 并进 $\eta$），分对时 $y - \hat y = 0$，什么都不变。**$\eta > 0$ 是学习率**，即步长。")),
                 h(T('Why this moves the right way', '为什么这样走是对的')),
                 p(T(r"After an update on example $(\mathbf{x}, y)$ the new score is",
                     r"在样本 $(\mathbf{x}, y)$ 上更新之后，新得分是")),
                 math_(r"y\,\boldsymbol{\theta}_{\text{new}}\cdot\mathbf{x} = y\,\boldsymbol{\theta}\cdot\mathbf{x} + \eta\, y^2\, \lVert\mathbf{x}\rVert^2 = y\,\boldsymbol{\theta}\cdot\mathbf{x} + \eta\lVert\mathbf{x}\rVert^2"),
                 p(T(r"since $y^2 = 1$. The signed score of this example rises by $\eta\lVert\mathbf{x}\rVert^2 > 0$: one update moves the boundary towards classifying this point correctly (maybe not enough in one step, but never the wrong way for this point). It may spoil other points, which is why we loop over the data many times.",
                     r"因为 $y^2 = 1$。这个样本的带符号得分增加了 $\eta\lVert\mathbf{x}\rVert^2 > 0$：一次更新就让边界朝着把这个点分对的方向走（一步未必够，但对这个点绝不会走错方向）。它可能弄坏别的点，所以要在数据上循环许多遍。")),
                 quiz(T(r"The example $(\mathbf{x}, y) = ((1, 2, 1), +1)$ has score $\boldsymbol{\theta}\cdot\mathbf{x} = 3$. What does the perceptron do with it?", r"样本 $(\mathbf{x}, y) = ((1, 2, 1), +1)$ 的得分 $\boldsymbol{\theta}\cdot\mathbf{x} = 3$。感知机怎么处理它？"),
                      [(T(r"Nothing: $y\,\boldsymbol{\theta}\cdot\mathbf{x} = 3 > 0$, so it is correct", r"什么都不做：$y\,\boldsymbol{\theta}\cdot\mathbf{x} = 3 > 0$，已经分对"), True),
                       (T(r"Add $\eta\mathbf{x}$ to push the score even higher", r"加上 $\eta\mathbf{x}$，把得分推得更高"), T(r"The rule only fires on mistakes. Pushing every example further would be a different algorithm that never stops changing.", r"规则只在分错时触发。把每个样本都往外推是另一种算法，它永远不会停下来。")),
                       (T(r"Subtract $\eta\mathbf{x}$, because the score is large", r"减去 $\eta\mathbf{x}$，因为得分很大"), T(r"A large positive score for a $+1$ example is perfect; the sign is what matters, not the size.", r"$+1$ 样本得分为大的正数是最理想的；要看的是符号，不是大小。"))],
                      T(r"Only mistakes ($y\,\boldsymbol{\theta}\cdot\mathbf{x} \le 0$) trigger an update.", r"只有分错（$y\,\boldsymbol{\theta}\cdot\mathbf{x} \le 0$）才触发更新。")),
                 chapter=T('The learning algorithm', '学习算法')),
            read('algorithm', T('The training algorithm', '训练算法'),
                 p(T(r"Repeat over the data until a full pass makes no mistakes:", r"在数据上反复循环，直到完整一遍都没有分错：")),
                 ol(T(r"Choose an initial guess $\boldsymbol{\theta}^{(0)}$ (often $\mathbf{0}$, or small random values); set $k = 0$.", r"选一个初值 $\boldsymbol{\theta}^{(0)}$（常取 $\mathbf{0}$ 或很小的随机数）；令 $k = 0$。"),
                    T(r"For each **epoch** $t = 1, \dots, T$ (one pass over the whole training set):", r"对每一**轮**（epoch）$t = 1, \dots, T$（遍历整个训练集一次）："),
                    T(r"for $i = 1, \dots, N$: if $y^{(i)}\,(\boldsymbol{\theta}\cdot\mathbf{x}^{(i)}) \le 0$ (sample $i$ misclassified) then $\boldsymbol{\theta}^{(k+1)} = \boldsymbol{\theta}^{(k)} + \eta\, y^{(i)}\mathbf{x}^{(i)}$ and $k \leftarrow k + 1$.", r"对 $i = 1, \dots, N$：若 $y^{(i)}\,(\boldsymbol{\theta}\cdot\mathbf{x}^{(i)}) \le 0$（样本 $i$ 被分错），则 $\boldsymbol{\theta}^{(k+1)} = \boldsymbol{\theta}^{(k)} + \eta\, y^{(i)}\mathbf{x}^{(i)}$，$k \leftarrow k + 1$。"),
                    T(r"**Convergence**: an epoch with no update at all. The weights will never change again, so stop.", r"**收敛**：某一轮一次更新都没有。权重以后不会再变，停止。")),
                 ul(T(r"$\boldsymbol{\theta}^{(k)}$ is the weight vector *after $k$ updates*: handy for theory. When you implement it, just write $\boldsymbol{\theta} \leftarrow \boldsymbol{\theta} + \eta\, y\,\mathbf{x}$.", r"$\boldsymbol{\theta}^{(k)}$ 是*更新 $k$ 次之后*的权重向量：做理论分析时方便。写代码时直接写 $\boldsymbol{\theta} \leftarrow \boldsymbol{\theta} + \eta\, y\,\mathbf{x}$。"),
                    T(r"It is an **online** algorithm: the weights change right after each example. Naive Bayes and logistic regression with gradient descent are **batch**: they use statistics of the whole training set and update all parameters at once. Online learning can be cheaper on very large data sets; gradient descent has an online version, stochastic gradient descent (the deeper chapter).", r"它是**在线**（online）算法：每看一个样本，权重马上改变。朴素贝叶斯和用梯度下降的逻辑回归是**批量**（batch）算法：用整个训练集的统计量，一次更新全部参数。数据特别大时在线学习可能更省；梯度下降也有在线版本，即随机梯度下降（深入一章）。"),
                    T(r"The order of the examples and the initial weights change the path, and the final $\boldsymbol{\theta}$; many different boundaries separate the same data, and the perceptron stops at the first one it reaches.", r"样本的顺序和初始权重会改变路径，也改变最终的 $\boldsymbol{\theta}$；许多不同的边界都能分开同一份数据，感知机碰到第一条就停下。"))),
            read('ex1', T('Worked example 1: the deck, epoch by epoch', '例 1：课件的例子，一轮一轮走'),
                 p(T(r"Four training instances in the format $[1, x_1, x_2]$ (the leading 1 is the bias input), learning rate $\eta = 1$, start $\boldsymbol{\theta}^{(0)} = [0, 0, 0]$, mistake when $y(\boldsymbol{\theta}\cdot\mathbf{x}) \le 0$. Each row is one instance, in order, with the weights it meets:",
                     r"四个训练样本，格式 $[1, x_1, x_2]$（开头的 1 是偏置输入），学习率 $\eta = 1$，起点 $\boldsymbol{\theta}^{(0)} = [0, 0, 0]$，$y(\boldsymbol{\theta}\cdot\mathbf{x}) \le 0$ 时分错。每一行是一个样本（按顺序）和它遇到的权重：")),
                 trace_table(),
                 p(T(r"Epoch 1 makes two updates (the first example at score 0, the third at score 1 with label $-1$), epoch 2 one more (the third example again, score 0), and epoch 3 passes all four examples with no update: **converged** with $\boldsymbol{\theta} = [-1, 1, 1]$ after $k = 3$ updates. Note the third example, $(1, 0, 0)$ with $y = -1$, needed two corrections: the bias had to fall to $-1$ before the origin was on the negative side.",
                     r"第 1 轮更新两次（第一个样本得分 0；第三个样本得分 1 但标签是 $-1$），第 2 轮再更新一次（第三个样本又错，得分 0），第 3 轮四个样本全对、没有更新：**收敛**，$\boldsymbol{\theta} = [-1, 1, 1]$，共更新 $k = 3$ 次。注意第三个样本 $(1, 0, 0)$、$y = -1$ 被纠正了两次：偏置要降到 $-1$，原点才落到负类一侧。")),
                 svg(drawn(fig_ex1), T('The four points, blue squares for class 1 at (1,1) and (1,2), orange rings for class −1 at (0,0) and (−1,0). Three boundaries: θ(1) is x1 + x2 = −1, θ(2) is x1 + x2 = 0, θ(3) is x1 + x2 = 1, the last one separating the classes.',
                                       '四个点：类别 1 的蓝色方块在 (1,1) 和 (1,2)，类别 −1 的橙色圆环在 (0,0) 和 (−1,0)。三条边界：θ(1) 是 x1 + x2 = −1，θ(2) 是 x1 + x2 = 0，θ(3) 是 x1 + x2 = 1，最后一条把两类分开。'),
                     T(r"The boundary after each update: $\boldsymbol{\theta}^{(1)}$, $\boldsymbol{\theta}^{(2)}$, then $\boldsymbol{\theta}^{(3)}$, which separates the classes.", r"每次更新后的边界：$\boldsymbol{\theta}^{(1)}$、$\boldsymbol{\theta}^{(2)}$，然后是把两类分开的 $\boldsymbol{\theta}^{(3)}$。"))),
            derive('ex1_updates', T('The three updates in words', '三次更新，逐句说明'),
                   [(r"\boldsymbol{\theta}^{(0)} = [0, 0, 0]", T(r"Start at zero. Every score is $0$, so the first example is a mistake: $y(\boldsymbol{\theta}\cdot\mathbf{x}) = 1\cdot 0 \le 0$.", r"从零开始。所有得分都是 $0$，所以第一个样本分错：$y(\boldsymbol{\theta}\cdot\mathbf{x}) = 1\cdot 0 \le 0$。")),
                    (r"\boldsymbol{\theta}^{(1)} = [0,0,0] + [1,1,1] = [1,1,1]", T(r"Update on $((1,1,1), +1)$: add $\eta y\mathbf{x}$. The example's own score is now $3 > 0$. The second example scores $1 + 1 + 2 = 4 > 0$ with $y = +1$: fine, no update.", r"在 $((1,1,1), +1)$ 上更新：加上 $\eta y\mathbf{x}$。这个样本自己的得分变成 $3 > 0$。第二个样本得分 $1 + 1 + 2 = 4 > 0$，$y = +1$：没问题，不更新。")),
                    (r"\boldsymbol{\theta}^{(2)} = [1,1,1] - [1,0,0] = [0,1,1]", T(r"The third example $((1,0,0), -1)$ scores $1$, positive but its label is $-1$: mistake. Subtract $\mathbf{x}$ (because $y = -1$): the bias drops from 1 to 0.", r"第三个样本 $((1,0,0), -1)$ 得分 $1$，是正的而标签是 $-1$：分错。减去 $\mathbf{x}$（因为 $y = -1$）：偏置从 1 降到 0。")),
                    (r"\boldsymbol{\theta}^{(3)} = [0,1,1] - [1,0,0] = [-1,1,1]", T(r"Back to the top for epoch 2, with $\boldsymbol{\theta} = [0,1,1]$. The first two examples score $2$ and $3$: fine. The third scores exactly $0$, and $y\cdot 0 \le 0$ is a mistake (this is where $\le$ rather than $<$ matters). Subtract again: bias $-1$. The fourth example scored $-1$ with $y = -1$ in epoch 1: correct.", r"第 2 轮回到开头，此时 $\boldsymbol{\theta} = [0,1,1]$。前两个样本得分 $2$ 和 $3$：没问题。第三个样本得分恰好是 $0$，$y\cdot 0 \le 0$ 算分错（这里就是 $\le$ 而不是 $<$ 起作用的地方）。再减一次：偏置变成 $-1$。（第 1 轮的第四个样本得分 $-1$、$y = -1$：正确。）")),
                    (r"y\,(\boldsymbol{\theta}^{(3)}\cdot\mathbf{x}^{(i)}) = 1,\,2,\,1,\,2 > 0", T(r"Epoch 3: check all four with $\boldsymbol{\theta} = [-1,1,1]$: the scores are $1, 2, -1, -2$, times the labels $1, 1, -1, -1$ gives $1, 2, 1, 2$, all positive. No update: converged.", r"第 3 轮：用 $\boldsymbol{\theta} = [-1,1,1]$ 检查四个样本：得分是 $1, 2, -1, -2$，乘标签 $1, 1, -1, -1$ 得 $1, 2, 1, 2$，全为正。没有更新：收敛。"))],
                   skill=R),
            read('ex2', T('Worked example 2: a small learning rate', '例 2：小学习率'),
                 p(T(r"The deck's second example in 2-D with $\eta = 0.1$: start $\boldsymbol{\theta} = (-0.1, 0.2, 0.0)$, boundary $-0.1 + 0.2x_1 = 0$, the vertical line $x_1 = 0.5$. The points: $(1,1)$ in class $-1$, $(2,1)$ in class $+1$, $(1.5, 0.5)$ in class $+1$.",
                     r"课件的第二个例子，二维，$\eta = 0.1$：起点 $\boldsymbol{\theta} = (-0.1, 0.2, 0.0)$，边界 $-0.1 + 0.2x_1 = 0$，即竖线 $x_1 = 0.5$。数据点：$(1,1)$ 属类别 $-1$，$(2,1)$ 属类别 $+1$，$(1.5, 0.5)$ 属类别 $+1$。")),
                 svg(drawn(fig_ex2), T('Three points and the boundary moving: θ(0) is the vertical line x1 = 0.5, θ(1) is x2 = x1 − 2, θ(2) is the vertical line x1 = 1/3. Class −1 at (1,1); class 1 at (2,1) and (1.5, 0.5).',
                                       '三个点和移动的边界：θ(0) 是竖线 x1 = 0.5，θ(1) 是 x2 = x1 − 2，θ(2) 是竖线 x1 = 1/3。类别 −1 在 (1,1)；类别 1 在 (2,1) 和 (1.5, 0.5)。')),
                 table([T('example', '样本'), T('score', '得分'), 'y·score', T('update ($\\eta y\\mathbf{x}$ added)', '更新（加上 $\\eta y\\mathbf{x}$）'), T('new $\\boldsymbol{\\theta}$', '新 $\\boldsymbol{\\theta}$')],
                       ['(1, 1)', '−0.1 + 0.2 + 0 = 0.1', '−0.1', T(r'$-0.1\,(1,1,1)$', r'$-0.1\,(1,1,1)$'), '(−0.2, 0.1, −0.1)'],
                       ['(2, 1)', '−0.2 + 0.2 − 0.1 = −0.1', '−0.1', T(r'$+0.1\,(1,2,1)$', r'$+0.1\,(1,2,1)$'), '(−0.1, 0.3, 0.0)'],
                       ['(1.5, 0.5)', '−0.1 + 0.45 = 0.35', '0.35', T('none: correct', '无：已正确'), '(−0.1, 0.3, 0.0)']),
                 p(T(r"The first mistake rotates the line to $-0.2 + 0.1x_1 - 0.1x_2 = 0$, i.e. $x_2 = x_1 - 2$ (the deck's second picture). The second mistake, on $(2,1)$, swings it back to the vertical line $x_1 = 1/3$; the third point is then correct. The deck then continues with a fourth point (class $-1$, upper right) and says: *eventually all the data will be correctly classified, provided it is linearly separable.* The numbers above are computed exactly as the algorithm prescribes; the slide does not give the fourth point's coordinates, so we stop there.",
                     r"第一次分错把直线转成 $-0.2 + 0.1x_1 - 0.1x_2 = 0$，即 $x_2 = x_1 - 2$（课件的第二幅图）。第二次分错发生在 $(2,1)$ 上，把它拉回竖线 $x_1 = 1/3$；这时第三个点是对的。课件接着出现第四个点（类别 $-1$，右上方），并说：*只要数据线性可分，最终所有数据都会被分对。* 上面的数字严格按算法计算；幻灯片没有给出第四个点的坐标，所以我们到此为止。"))),
            read('eta', T('Does the learning rate matter?', '学习率重要吗？'),
                 p(T(r"A surprise worth knowing. If you start from $\boldsymbol{\theta}^{(0)} = \mathbf{0}$, the learning rate **does not change which examples are mistakes**. Every weight vector the algorithm visits is a sum of terms $\eta\,y\,\mathbf{x}$, so it is $\eta$ times what you would get with $\eta = 1$; multiplying $\boldsymbol{\theta}$ by a positive number never changes the sign of $\boldsymbol{\theta}\cdot\mathbf{x}$, so the same examples are misclassified in the same order. (We ran the deck's example 1 with $\eta = 1$ and with $\eta = 0.1$ to check: same mistakes, final weights $[-1,1,1]$ versus $[-0.1,0.1,0.1]$, the same line.)",
                     r"一个值得知道的意外。如果从 $\boldsymbol{\theta}^{(0)} = \mathbf{0}$ 出发，学习率**并不改变哪些样本是错的**。算法经过的每个权重向量，都是若干项 $\eta\,y\,\mathbf{x}$ 的和，也就是 $\eta = 1$ 时结果的 $\eta$ 倍；把 $\boldsymbol{\theta}$ 乘上一个正数，$\boldsymbol{\theta}\cdot\mathbf{x}$ 的符号不变，所以分错的样本和顺序都一样。（我们把课件例 1 分别用 $\eta = 1$ 和 $\eta = 0.1$ 跑过：错误完全相同，最终权重 $[-1,1,1]$ 和 $[-0.1,0.1,0.1]$ 是同一条直线。）")),
                 p(T(r"So $\eta$ only matters when the start is not zero (as in example 2, where $\boldsymbol{\theta}^{(0)} = (-0.1, 0.2, 0)$ is on the same scale as the updates). In that case a large $\eta$ makes the first updates swamp the initial guess and a small $\eta$ makes the algorithm keep the initial guess longer. Contrast with gradient descent on a smooth loss, where $\eta$ controls stability and speed.",
                     r"所以只有起点不为零时 $\eta$ 才有影响（比如例 2，$\boldsymbol{\theta}^{(0)} = (-0.1, 0.2, 0)$ 的量级和更新差不多）。这时 $\eta$ 大，最初的几次更新会盖过初值；$\eta$ 小，初值被保留得更久。对比光滑损失上的梯度下降，那里 $\eta$ 决定稳定性和速度。")),
                 quiz(T(r"Start at $\boldsymbol{\theta}^{(0)} = \mathbf{0}$. Does doubling $\eta$ change the sequence of mistakes the perceptron makes?", r"从 $\boldsymbol{\theta}^{(0)} = \mathbf{0}$ 出发。把 $\eta$ 加倍，感知机的错误序列会变吗？"),
                      [(T(r"Yes: larger steps change which points are misclassified", r"会：步子大了，分错的点就不同"), T(r"Every weight vector is just doubled, and $\boldsymbol{\theta}\cdot\mathbf{x}$ keeps its sign when $\boldsymbol{\theta}$ is scaled by a positive number.", r"每个权重向量只是变成两倍，而 $\boldsymbol{\theta}$ 乘一个正数后 $\boldsymbol{\theta}\cdot\mathbf{x}$ 的符号不变。")),
                       (T(r"No: the weights are scaled by 2 but the mistakes are identical", r"不会：权重放大 2 倍，错误完全相同"), True),
                       (T(r"Only for linearly separable data", r"只有线性可分的数据才不会"), T(r"The argument never uses separability: it holds for any data, separable or not.", r"这个论证用不到可分性：任何数据都成立。"))],
                      T(r"With a zero start the learning rate is only a global scale on $\boldsymbol{\theta}$.", r"零起点时，学习率只是 $\boldsymbol{\theta}$ 的整体尺度。")),
                 ),
            read('separable', T('Linear separability and what convergence promises', '线性可分，以及收敛保证了什么'),
                 p(T(r"A data set is **linearly separable** if some hyperplane puts every $+1$ example on one side and every $-1$ example on the other: there is a $\boldsymbol{\theta}^\ast$ with $y^{(i)}(\boldsymbol{\theta}^\ast\cdot\mathbf{x}^{(i)}) > 0$ for all $i$. For such data the deck states:",
                     r"如果存在一个超平面，把所有 $+1$ 样本放在一侧、所有 $-1$ 样本放在另一侧，数据集就是**线性可分**（linearly separable）的：存在 $\boldsymbol{\theta}^\ast$，使所有 $i$ 都有 $y^{(i)}(\boldsymbol{\theta}^\ast\cdot\mathbf{x}^{(i)}) > 0$。对这样的数据，课件的结论是：")),
                 ul(T(r"the perceptron algorithm is **guaranteed to converge**;", r"感知机算法**保证收敛**；"),
                    T(r"the final parameters **depend on the initialisation, the learning rate and the order** of the data;", r"最终参数**依赖初始化、学习率和数据顺序**；"),
                    T(r"there is **no guarantee that the margin is maximised**, unlike a support vector machine: the line only has to separate the data, it may pass very close to some points;", r"**不保证间隔最大**，这一点和支持向量机不同：直线只要把数据分开就行，可能紧贴某些点；"),
                    T(r"on data that are **not** linearly separable there is **no guarantee of convergence**.", r"在**不**线性可分的数据上，**不保证收敛**。")),
                 p(T(r"The **margin** is how far the closest point is from the boundary. The next chapters make 'guaranteed to converge' precise, and say how many mistakes it can take. First, the case where no line works.",
                     r"**间隔**（margin）是离边界最近的点到边界的距离。后面的章节会把“保证收敛”说精确，并说明最多会犯多少次错。先看一条直线都不行的情形。")),
                 chapter=T('Limits: XOR', '局限：XOR')),
            read('xor', T('The XOR problem', 'XOR 问题'),
                 p(T(r"Take the four corners of the unit square. **AND** and **OR** are linearly separable, so a perceptron learns them: for OR, $\boldsymbol{\theta} = (-0.5, 1, 1)$ (class 1 when $x_1 + x_2 > 0.5$); for AND, $(-1.5, 1, 1)$ (class 1 only when $x_1 + x_2 > 1.5$). **XOR** (exclusive or) is 1 exactly when the inputs differ:",
                     r"取单位正方形的四个角。**AND** 和 **OR** 线性可分，所以感知机学得会：OR 取 $\boldsymbol{\theta} = (-0.5, 1, 1)$（$x_1 + x_2 > 0.5$ 时为类别 1）；AND 取 $(-1.5, 1, 1)$（只有 $x_1 + x_2 > 1.5$ 才是类别 1）。**XOR**（异或）恰好在两个输入不同时为 1：")),
                 table(['$x_1$', '$x_2$', 'AND', 'OR', 'XOR'], ['0', '0', '0', '0', '0'], ['1', '0', '0', '1', '1'], ['0', '1', '0', '1', '1'], ['1', '1', '1', '1', '0']),
                 svg(drawn(fig_xor), T('The unit square corners: class −1 (orange rings) at (0,0) and (1,1), class 1 (blue squares) at (1,0) and (0,1). Three dashed lines each leave a wrong point on the wrong side.',
                                       '单位正方形的四个角：类别 −1（橙色圆环）在 (0,0) 和 (1,1)，类别 1（蓝色方块）在 (1,0) 和 (0,1)。三条虚线各自都让某个点落在错的一侧。')),
                 p(T(r"Try to draw one line with the blue squares on one side and the orange rings on the other. The two classes sit on the diagonals and each diagonal's midpoint is the same point $(0.5, 0.5)$, which is what makes a line impossible. Next, the proof, so that you can write it in the exam.",
                     r"试着画一条直线，把蓝方块放一侧、橙圆环放另一侧。两个类别各占一条对角线，而两条对角线的中点是同一个点 $(0.5, 0.5)$，这就是画不出直线的原因。下面给出证明，考试里可以直接写。"))),
            derive('xor_proof', T('XOR is not linearly separable: the proof', '证明 XOR 线性不可分'),
                   [(r"\theta_0 \le 0", T(r"Suppose a perceptron $\hat y = 1$ iff $\theta_0 + \theta_1x_1 + \theta_2x_2 > 0$ computed XOR. Input $(0,0)$ must give 0 (class $-1$), so $\theta_0 \le 0$.", r"假设感知机（$\theta_0 + \theta_1x_1 + \theta_2x_2 > 0$ 时输出 1）能算 XOR。输入 $(0,0)$ 必须输出 0（类别 $-1$），所以 $\theta_0 \le 0$。")),
                    (r"\theta_0 + \theta_1 > 0", T(r"Input $(1,0)$ must give 1.", r"输入 $(1,0)$ 必须输出 1。")),
                    (r"\theta_0 + \theta_2 > 0", T(r"Input $(0,1)$ must give 1.", r"输入 $(0,1)$ 必须输出 1。")),
                    (r"\theta_0 + \theta_1 + \theta_2 \le 0", T(r"Input $(1,1)$ must give 0.", r"输入 $(1,1)$ 必须输出 0。")),
                    (r"2\theta_0 + \theta_1 + \theta_2 > 0", T(r"Add the two middle inequalities: a sum of two positive numbers is positive.", r"把中间两个不等式相加：两个正数之和为正。")),
                    (r"\theta_0 + \theta_1 + \theta_2 > -\theta_0 \ge 0", T(r"Subtract $\theta_0$ from both sides of the last line: the left side is exactly the score of $(1,1)$. And $-\theta_0 \ge 0$ by the first line. So the score of $(1,1)$ is strictly positive.", r"上一行两边减去 $\theta_0$：左边正好是 $(1,1)$ 的得分。又由第一行 $-\theta_0 \ge 0$。所以 $(1,1)$ 的得分严格为正。")),
                    (r"0 < \theta_0+\theta_1+\theta_2 \le 0", T(r"This contradicts the fourth inequality. No weights exist: **XOR is not linearly separable**, and no perceptron can learn it, however long it trains.", r"这与第四个不等式矛盾。不存在这样的权重：**XOR 线性不可分**，感知机怎么训练都学不会。"))],
                   outro=T(r"This is Minsky and Papert's point (1969). The fix, a hidden layer that re-describes the inputs, is the next lesson.", r"这就是 Minsky 和 Papert（1969）的论点。解决办法是加一个隐藏层，重新描述输入，那是下一课。"),
                   skill=X),
            read('xor_run', T('What the algorithm does on XOR', '算法在 XOR 上的表现'),
                 p(T(r"Run the perceptron on XOR (labels $-1,+1,+1,-1$ for the inputs $(0,0), (1,0), (0,1), (1,1)$, $\eta = 1$, $\boldsymbol{\theta} = \mathbf{0}$). Every single example is a mistake, and the four updates cancel:",
                     r"在 XOR 上跑感知机（输入 $(0,0), (1,0), (0,1), (1,1)$ 的标签依次为 $-1,+1,+1,-1$，$\eta = 1$，$\boldsymbol{\theta} = \mathbf{0}$）。每个样本都分错，四次更新互相抵消：")),
                 table([T('example', '样本'), T('$\\boldsymbol{\\theta}$ before', '更新前 $\\boldsymbol{\\theta}$'), T('score', '得分'), T('result', '结果')],
                       *[[f'x = {vec(x[1:])}, y = {t}', vec(th), f'{s:g}', T(f'mistake → {vec([a + t * b for a, b in zip(th, x)])}', f'分错 → {vec([a + t * b for a, b in zip(th, x)])}')]
                         for ep, x, t, th, s, m in XOR_ROWS[:4]]),
                 p(T(r"After the fourth update the weights are back at $[0,0,0]$ (look at the last row's new value: $[1,1,1] - [1,1,1]$). The second epoch repeats the first one exactly, forever: 4 mistakes per epoch, no convergence. In general, on non-separable data the perceptron **never reaches an epoch without mistakes**, and the weights keep wandering (for XOR they cycle). In practice one stops after a fixed number of epochs $T$, which is why the algorithm has $T$ in it.",
                     r"第四次更新之后权重又回到 $[0,0,0]$（看最后一行的新值：$[1,1,1] - [1,1,1]$）。第二轮和第一轮完全一样，永远重复：每轮 4 次错误，不收敛。一般地，在线性不可分的数据上，感知机**永远不会有一轮零错误**，权重一直游走（XOR 上是循环）。实际中跑固定的 $T$ 轮就停，这也是算法里有 $T$ 的原因。")),
                 quiz(T(r"A perceptron has run for 1000 epochs and still makes mistakes. What can you conclude?", r"感知机已经跑了 1000 轮，仍然有错误。能得出什么结论？"),
                      [(T(r"The data are certainly not linearly separable", r"数据肯定线性不可分"), T(r"Not certain: the mistake bound $(R/\gamma)^2$ is finite but can be huge when the margin $\gamma$ is tiny, so separable data can take very long.", r"不一定：错误上界 $(R/\gamma)^2$ 是有限的，但间隔 $\gamma$ 很小时它可以非常大，可分的数据也可能跑很久。")),
                       (T(r"Nothing for sure: either not separable, or separable with a tiny margin and slow", r"没法确定：要么不可分，要么可分但间隔很小所以很慢"), True),
                       (T(r"The learning rate is too large", r"学习率太大"), T(r"From a zero start the learning rate does not even change which examples are mistakes.", r"零起点时，学习率连分错哪些样本都不会改变。"))],
                      T(r"Non-convergence in finite time can never prove non-separability; only a separating $\boldsymbol{\theta}$ (or a proof) can settle it.", r"有限时间内不收敛永远证明不了不可分；只有给出分开数据的 $\boldsymbol{\theta}$（或一个证明）才能下结论。"))),
            read('loss_idea', T('Deeper: what is the perceptron optimising?', '深入：感知机在优化什么？'),
                 p(T(r"The rule looks like a hack, and the deck notes that gradient descent needs a *differentiable* loss while the perceptron's step function is non-differentiable. But the rule *is* gradient descent, on a different loss. Let us find it.",
                     r"这条规则看起来像一个土办法，课件也提到梯度下降需要*可微*的损失，而感知机的阶跃函数不可微。但这条规则*就是*梯度下降，只是损失函数不同。我们把它找出来。")),
                 p(T(r"The loss we would like is the number of mistakes (the 0-1 loss). It is piecewise constant in $\boldsymbol{\theta}$: its gradient is $0$ wherever it exists, so it tells gradient descent nothing about which way to move. Instead, penalise each mistake by *how wrong it is*: the score $z = \boldsymbol{\theta}\cdot\mathbf{x}$ has the wrong sign by $-y z$. The **perceptron loss** is",
                     r"我们真正想要的损失是错误个数（0-1 损失）。它对 $\boldsymbol{\theta}$ 是分段常数：凡有梯度的地方梯度都是 $0$，对往哪边走一无所知。换个办法：按*错得多厉害*来惩罚每个错误：得分 $z = \boldsymbol{\theta}\cdot\mathbf{x}$ 的符号错了 $-yz$。**感知机损失**为")),
                 math_(r"\ell_i(\boldsymbol{\theta}) = \max\bigl(0,\; -y_i\,\boldsymbol{\theta}^\top\mathbf{x}_i\bigr),\qquad L(\boldsymbol{\theta}) = \sum_{i=1}^N \ell_i(\boldsymbol{\theta})"),
                 p(T(r"A correct example costs 0; a mistake costs its distance past the boundary (in score units). $L \ge 0$, and $L = 0$ exactly when every example is classified correctly (with the $\le$ convention at 0 aside). It is the 'hinge' $\max(0, 1 - yz)$ of the SVM with the margin 1 replaced by 0: so a perceptron is a soft-margin SVM with no margin demand (and no regulariser). A good thing to say in an exam comparison.",
                     r"分对的样本代价为 0；分错的样本代价是越过边界多远（用得分的单位）。$L \ge 0$，当且仅当所有样本分对时 $L = 0$（0 处的 $\le$ 约定除外）。它是 SVM 合页损失 $\max(0, 1 - yz)$ 把间隔 1 换成 0：所以感知机就是没有间隔要求（也没有正则项）的软间隔 SVM。比较题里这是个好句子。"))),
            derive('sgd', T('Deeper: the perceptron rule is stochastic gradient descent', '深入：感知机规则就是随机梯度下降'),
                   [(r"\ell_i(\boldsymbol{\theta}) = \max(0,\,-y_i\boldsymbol{\theta}^\top\mathbf{x}_i)", T(r"The loss of one example $i$. $\max(0, u)$ is the **ReLU**: $0$ for $u \le 0$, $u$ for $u > 0$. Here $u = -y_i\boldsymbol{\theta}^\top\mathbf{x}_i$ is positive exactly when $i$ is a mistake.", r"单个样本 $i$ 的损失。$\max(0, u)$ 是 **ReLU**：$u \le 0$ 时为 $0$，$u > 0$ 时为 $u$。这里 $u = -y_i\boldsymbol{\theta}^\top\mathbf{x}_i$ 当且仅当 $i$ 分错时为正。")),
                    (r"\nabla\ell_i = \mathbf{0}\quad\text{if } y_i\boldsymbol{\theta}^\top\mathbf{x}_i > 0", T(r"Correct example: we are on the flat part, $\ell_i = 0$ near $\boldsymbol{\theta}$, so the gradient is zero: no move. This is the 'do nothing' rows of the rule.", r"分对的样本：处在平坦部分，$\boldsymbol{\theta}$ 附近 $\ell_i = 0$，梯度为零：不动。这就是规则里“不动”的那几行。")),
                    (r"\nabla\ell_i = -y_i\,\mathbf{x}_i\quad\text{if } y_i\boldsymbol{\theta}^\top\mathbf{x}_i < 0", T(r"Mistake: $\ell_i = -y_i\boldsymbol{\theta}^\top\mathbf{x}_i$ is linear in $\boldsymbol{\theta}$, so its gradient is the coefficient of $\boldsymbol{\theta}$: $-y_i\mathbf{x}_i$. (At exactly $0$ the ReLU has a kink: any slope between the two sides, a *subgradient*, works, and we pick $-y_i\mathbf{x}_i$. This answers the deck's remark 'derivative at zero is undefined'.)", r"分错：$\ell_i = -y_i\boldsymbol{\theta}^\top\mathbf{x}_i$ 关于 $\boldsymbol{\theta}$ 是线性的，所以梯度就是 $\boldsymbol{\theta}$ 的系数：$-y_i\mathbf{x}_i$。（恰好等于 $0$ 时 ReLU 有个尖角：两侧斜率之间的任何值，即*次梯度*（subgradient），都可用，我们取 $-y_i\mathbf{x}_i$。这就回答了课件里“derivative at zero is undefined”的说法。）")),
                    (r"\boldsymbol{\theta} \leftarrow \boldsymbol{\theta} - \eta\,\nabla\ell_i", T(r"Gradient descent on one example at a time: **stochastic** gradient descent (SGD), step size $\eta$. 'Stochastic' because one example, not the sum over all $N$, estimates the gradient.", r"每次只在一个样本上做梯度下降：**随机**梯度下降（SGD），步长 $\eta$。说“随机”，是因为用一个样本而不是 $N$ 个样本之和来估计梯度。")),
                    (r"\boldsymbol{\theta} \leftarrow \boldsymbol{\theta} + \eta\, y_i\,\mathbf{x}_i", T(r"On a mistake, insert the mistake gradient: the minus signs cancel and this is **exactly the perceptron rule**.", r"分错时代入分错的梯度：两个负号抵消，这**正是感知机规则**。"))],
                   outro=T(r"So the perceptron is SGD with batch size 1 on the perceptron loss. The lecture's comparison is then clear: logistic regression runs the same recipe on the smooth cross-entropy loss, where every example (not only mistakes) has a gradient $(\sigma(z) - y)\mathbf{x}$; a perceptron's gradient vanishes the moment an example is right.", r"所以感知机就是在感知机损失上做批大小为 1 的 SGD。课件里的比较就清楚了：逻辑回归对光滑的交叉熵损失用同一套方法，每个样本（不只是分错的）都有梯度 $(\sigma(z) - y)\mathbf{x}$；而感知机的梯度在样本被分对的那一刻就消失了。"),
                   skill=G),
            read('theorem', T('Deeper: the convergence theorem', '深入：收敛定理'),
                 p(T(r"Now make 'guaranteed to converge' precise. Assume the data are separable **with margin $\gamma$**: some unit vector $\boldsymbol{\theta}^\ast$ ($\lVert\boldsymbol{\theta}^\ast\rVert = 1$) has $y_i(\boldsymbol{\theta}^\ast\cdot\mathbf{x}_i) \ge \gamma > 0$ for all $i$ (so $\gamma$ is the distance from the closest point to that boundary). Let all inputs lie in a ball, $\lVert\mathbf{x}_i\rVert \le R$.",
                     r"现在把“保证收敛”说精确。假设数据以**间隔 $\gamma$** 线性可分：存在单位向量 $\boldsymbol{\theta}^\ast$（$\lVert\boldsymbol{\theta}^\ast\rVert = 1$），对所有 $i$ 有 $y_i(\boldsymbol{\theta}^\ast\cdot\mathbf{x}_i) \ge \gamma > 0$（所以 $\gamma$ 是最近的点到该边界的距离）。再设所有输入都在一个球内，$\lVert\mathbf{x}_i\rVert \le R$。")),
                 callout('note', T('Novikoff (1962)', 'Novikoff 定理（1962）'),
                         T(r"Started at $\boldsymbol{\theta}^{(0)} = \mathbf{0}$, the perceptron algorithm makes at most $\left(\dfrac{R}{\gamma}\right)^2$ mistakes in total, however many epochs it runs and in whatever order it visits the data. So it stops, with no mistakes in a pass, after finitely many updates.",
                           r"从 $\boldsymbol{\theta}^{(0)} = \mathbf{0}$ 出发，感知机算法总共最多犯 $\left(\dfrac{R}{\gamma}\right)^2$ 次错，不论跑多少轮、按什么顺序。所以它在有限次更新后停下，此时一整遍没有错误。")),
                 ul(T(r"The bound does not depend on the number of examples $N$ or on the dimension: only on the **ratio of the data's size to the margin**. A wide margin means few mistakes; a razor-thin margin means very many.", r"这个上界与样本数 $N$、维数都无关：只取决于**数据的尺度和间隔之比**。间隔宽，错得少；间隔薄如刀刃，错得非常多。"),
                    T(r"It is the margin again: the same quantity an SVM maximises. The perceptron does not try to enlarge it, but its running time is controlled by it.", r"又是间隔：正是 SVM 要最大化的量。感知机不去扩大它，但运行时间由它控制。"),
                    T(r"With $\boldsymbol{\theta}^\ast$ not of norm 1 the bound reads $R^2\lVert\boldsymbol{\theta}^\ast\rVert^2/\tilde\gamma^2$ with $\tilde\gamma = \min_i y_i\boldsymbol{\theta}^\ast\cdot\mathbf{x}_i$: scale-free.", r"如果 $\boldsymbol{\theta}^\ast$ 的范数不是 1，上界写成 $R^2\lVert\boldsymbol{\theta}^\ast\rVert^2/\tilde\gamma^2$，其中 $\tilde\gamma = \min_i y_i\boldsymbol{\theta}^\ast\cdot\mathbf{x}_i$：与尺度无关。"))),
            derive('novikoff', T('Deeper: a proof sketch, two inequalities that collide', '深入：证明概要，两个不等式相撞'),
                   [(r"\boldsymbol{\theta}^{(k)} = \boldsymbol{\theta}^{(k-1)} + y\,\mathbf{x}", T(r"Take $\eta = 1$ and $\boldsymbol{\theta}^{(0)} = \mathbf{0}$ (other $\eta$ only rescale, as we saw). The $k$-th mistake is on some example $(\mathbf{x}, y)$, with $y\,\boldsymbol{\theta}^{(k-1)}\cdot\mathbf{x} \le 0$. We track two numbers: the alignment $a_k = \boldsymbol{\theta}^{(k)}\cdot\boldsymbol{\theta}^\ast$ and the length $n_k = \lVert\boldsymbol{\theta}^{(k)}\rVert$.", r"取 $\eta = 1$、$\boldsymbol{\theta}^{(0)} = \mathbf{0}$（别的 $\eta$ 只改变尺度，前面看过）。第 $k$ 次错误发生在某个样本 $(\mathbf{x}, y)$ 上，满足 $y\,\boldsymbol{\theta}^{(k-1)}\cdot\mathbf{x} \le 0$。我们跟踪两个量：对齐程度 $a_k = \boldsymbol{\theta}^{(k)}\cdot\boldsymbol{\theta}^\ast$，以及长度 $n_k = \lVert\boldsymbol{\theta}^{(k)}\rVert$。")),
                    (r"a_k = a_{k-1} + y\,\mathbf{x}\cdot\boldsymbol{\theta}^\ast", T(r"Dot the update with $\boldsymbol{\theta}^\ast$.", r"把更新式与 $\boldsymbol{\theta}^\ast$ 做点积。")),
                    (r"a_k \ge a_{k-1} + \gamma", T(r"Every example has $y\,\mathbf{x}\cdot\boldsymbol{\theta}^\ast \ge \gamma$ (the margin assumption), so each mistake adds at least $\gamma$ to the alignment.", r"每个样本都有 $y\,\mathbf{x}\cdot\boldsymbol{\theta}^\ast \ge \gamma$（间隔假设），所以每次错误至少给“对齐程度”加上 $\gamma$。")),
                    (r"a_k \ge k\gamma", T(r"Start at 0 and add at least $\gamma$ per mistake: **linear growth** (first claim).", r"从 0 开始，每次错误至少加 $\gamma$：**线性增长**（第一个论断）。")),
                    (r"n_k^2 = n_{k-1}^2 + 2y\,\boldsymbol{\theta}^{(k-1)}\!\cdot\mathbf{x} + \lVert\mathbf{x}\rVert^2", T(r"Now the length: square the update ($y^2 = 1$).", r"再看长度：把更新式取平方（$y^2 = 1$）。")),
                    (r"n_k^2 \le n_{k-1}^2 + R^2", T(r"The middle term is $\le 0$ **because this was a mistake** (the rule fires only then), and $\lVert\mathbf{x}\rVert^2 \le R^2$. The cross term can only help us.", r"中间项 $\le 0$，**因为这是一次错误**（规则只在此时触发），而 $\lVert\mathbf{x}\rVert^2 \le R^2$。交叉项只会帮我们的忙。")),
                    (r"n_k^2 \le k R^2", T(r"Start at 0 and add at most $R^2$ per mistake: the squared length grows **at most linearly** (second claim), so the length itself grows at most like $\sqrt k$.", r"从 0 开始，每次错误最多加 $R^2$：长度的平方**至多线性增长**（第二个论断），所以长度本身至多像 $\sqrt k$ 一样增长。")),
                    (r"k\gamma \le a_k \le n_k \le \sqrt{k}\,R", T(r"Collide them. Cauchy-Schwarz: $\boldsymbol{\theta}\cdot\boldsymbol{\theta}^\ast \le \lVert\boldsymbol{\theta}\rVert\,\lVert\boldsymbol{\theta}^\ast\rVert = \lVert\boldsymbol{\theta}\rVert$. The alignment grows like $k$ but is capped by something that grows like $\sqrt{k}$.", r"让它们相撞。Cauchy-Schwarz：$\boldsymbol{\theta}\cdot\boldsymbol{\theta}^\ast \le \lVert\boldsymbol{\theta}\rVert\,\lVert\boldsymbol{\theta}^\ast\rVert = \lVert\boldsymbol{\theta}\rVert$。对齐程度像 $k$ 一样增长，却被一个像 $\sqrt{k}$ 一样增长的量封顶。")),
                    (r"k \le \dfrac{R^2}{\gamma^2}", T(r"Divide $k\gamma \le \sqrt{k}R$ by $\sqrt{k}\gamma$: $\sqrt{k} \le R/\gamma$. A linear function cannot stay below a square-root function forever, so $k$ must stop: **at most $(R/\gamma)^2$ mistakes**.", r"把 $k\gamma \le \sqrt{k}R$ 除以 $\sqrt{k}\gamma$：$\sqrt{k} \le R/\gamma$。线性函数不可能永远压在平方根函数之下，所以 $k$ 必须停住：**至多 $(R/\gamma)^2$ 次错误**。")),
                    (r"k \le \dfrac{6\cdot 3}{1^2} = 18", T(r"Check on the deck's example 1: $\boldsymbol{\theta}^\ast = (-1,1,1)$ has $\lVert\boldsymbol{\theta}^\ast\rVert^2 = 3$, the smallest $y\,\boldsymbol{\theta}^\ast\cdot\mathbf{x}$ is $\tilde\gamma = 1$, the largest $\lVert\mathbf{x}\rVert^2$ is $R^2 = 1+1+4 = 6$. Unnormalised, the bound is $R^2\lVert\boldsymbol{\theta}^\ast\rVert^2/\tilde\gamma^2$.", r"用课件例 1 检验：$\boldsymbol{\theta}^\ast = (-1,1,1)$ 有 $\lVert\boldsymbol{\theta}^\ast\rVert^2 = 3$，$y\,\boldsymbol{\theta}^\ast\cdot\mathbf{x}$ 的最小值是 $\tilde\gamma = 1$，$\lVert\mathbf{x}\rVert^2$ 的最大值是 $R^2 = 1+1+4 = 6$。不归一化时，上界是 $R^2\lVert\boldsymbol{\theta}^\ast\rVert^2/\tilde\gamma^2$。"))],
                   outro=T(r"The bound allows 18 mistakes on example 1; the algorithm made 3. A bound, not a prediction.", r"例 1 的上界允许 18 次错误；算法实际犯了 3 次。这是上界，不是预测。"),
                   blank=(9, '18', T(r"Fill in the number: the bound for example 1.", r"填数字：例 1 的上界。")), skill=C),
            read('compare', T('Perceptron against logistic regression and SVM', '感知机、逻辑回归与 SVM 的比较'),
                 table(['', T('Perceptron', '感知机'), T('Logistic regression', '逻辑回归'), T('SVM (linear)', '线性 SVM')],
                       [T('activation / output', '激活函数 / 输出'), T('step, class −1 or 1', '阶跃，类别 −1 或 1'), T('sigmoid, $p(y=1\\mid\\mathbf{x})$', 'sigmoid，$p(y=1\\mid\\mathbf{x})$'), T('sign of $\\mathbf{w}\\cdot\\mathbf{x}+b$', r'$\mathbf{w}\cdot\mathbf{x}+b$ 的符号')],
                       [T('loss', '损失'), r'$\max(0,-yz)$', T('cross-entropy (negative log-likelihood)', '交叉熵（负对数似然）'), T(r'hinge $\max(0,1-yz)$ + $\lVert\mathbf{w}\rVert^2$', r'合页损失 $\max(0,1-yz)$ + $\lVert\mathbf{w}\rVert^2$')],
                       [T('boundary', '边界'), T('linear', '线性'), T('linear', '线性'), T('linear (non-linear with a kernel)', '线性（用核则非线性）')],
                       [T('update', '更新'), T('online, only on mistakes', '在线，只在分错时'), T('batch gradient descent (or SGD), every example', '批量梯度下降（或 SGD），每个样本都有贡献'), T('quadratic programme', '二次规划')],
                       [T('non-separable data', '不可分数据'), T('never converges', '不收敛'), T('fine (a best fit exists)', '没问题（存在最佳拟合）'), T('fine (soft margin)', '没问题（软间隔）')],
                       [T('separable data', '可分数据'), T('converges to *a* separator, not max-margin', '收敛到*某个*分离面，不是最大间隔'), T('weights grow without bound (no finite optimum)', '权重无限增大（没有有限最优解）'), T('unique max-margin separator', '唯一的最大间隔分离面')],
                       [T('probabilities', '概率'), T('none', '无'), T('yes', '有'), T('none', '无')]),
                 p(T(r"One bridge worth remembering: replace the step by a sigmoid and the loss by cross-entropy and the same single neuron **is** logistic regression. The perceptron, logistic regression and the first layer of every neural network are one picture, $y = f(\boldsymbol{\theta}\cdot\mathbf{x})$, with different $f$ and different losses.",
                     r"一座值得记住的桥：把阶跃换成 sigmoid、损失换成交叉熵，同一个神经元**就是**逻辑回归。感知机、逻辑回归和每个神经网络的第一层是同一幅图：$y = f(\boldsymbol{\theta}\cdot\mathbf{x})$，只是 $f$ 和损失不同。")),
                 chapter=T('Exam practice', '考试练习')),
            number('cp_trace', T('Trace one epoch', '追踪一轮'), R,
                   T(r"Run one epoch of the perceptron algorithm, $\eta = 0.5$, $\boldsymbol{\theta}^{(0)} = [0, 0, 0]$, mistake when $y(\boldsymbol{\theta}\cdot\mathbf{x}) \le 0$, on $[1,2,0]$ with $y = +1$, then $[1,0,1]$ with $y = -1$, then $[1,-1,-1]$ with $y = -1$. What is $\theta_2$ after the epoch?",
                     r"把感知机算法跑一轮：$\eta = 0.5$，$\boldsymbol{\theta}^{(0)} = [0, 0, 0]$，$y(\boldsymbol{\theta}\cdot\mathbf{x}) \le 0$ 时分错；依次处理 $[1,2,0]$（$y = +1$）、$[1,0,1]$（$y = -1$）、$[1,-1,-1]$（$y = -1$）。一轮之后 $\theta_2$ 是多少？"),
                   -0.5, T(r"Example 1: score 0, mistake: $\boldsymbol{\theta} = 0.5\cdot[1,2,0] = [0.5, 1, 0]$. Example 2: score $0.5$ but $y = -1$: mistake, $\boldsymbol{\theta} = [0.5,1,0] - 0.5\cdot[1,0,1] = [0, 1, -0.5]$. Example 3: score $0 - 1 + 0.5 = -0.5$, $y = -1$: correct, no update. So $\theta_2 = -0.5$ (and $\boldsymbol{\theta} = [0, 1, -0.5]$).", r"样本 1：得分 0，分错：$\boldsymbol{\theta} = 0.5\cdot[1,2,0] = [0.5, 1, 0]$。样本 2：得分 $0.5$ 而 $y = -1$：分错，$\boldsymbol{\theta} = [0.5,1,0] - 0.5\cdot[1,0,1] = [0, 1, -0.5]$。样本 3：得分 $0 - 1 + 0.5 = -0.5$，$y = -1$：正确，不更新。所以 $\theta_2 = -0.5$（$\boldsymbol{\theta} = [0, 1, -0.5]$）。"),
                   tolerance=0.001, hints=(T(r"Two of the three examples are mistakes; compute each score before updating.", r"三个样本里有两个分错；每次更新前先算得分。"),)),
            number('cp_bound', T('A mistake bound', '错误次数上界'), C,
                   T(r"All inputs satisfy $\lVert\mathbf{x}\rVert \le 4$, and a separating boundary with margin $\gamma = 0.5$ exists. What is the largest number of mistakes the perceptron algorithm (from $\boldsymbol{\theta}^{(0)} = \mathbf{0}$) can make?",
                     r"所有输入满足 $\lVert\mathbf{x}\rVert \le 4$，且存在间隔为 $\gamma = 0.5$ 的分离边界。感知机算法（从 $\boldsymbol{\theta}^{(0)} = \mathbf{0}$ 出发）最多会犯多少次错？"),
                   64, T(r"$(R/\gamma)^2 = (4/0.5)^2 = 8^2 = 64$.", r"$(R/\gamma)^2 = (4/0.5)^2 = 8^2 = 64$。"), tolerance=0.01),
            choice('cp_xor', T('Why XOR fails', '为什么 XOR 学不会'), X,
                   T('Which statement about the perceptron and the XOR function is correct?', '关于感知机和 XOR 函数，下列哪句话正确？'),
                   [(T(r"A perceptron cannot represent XOR: no line separates $\{(0,0),(1,1)\}$ from $\{(1,0),(0,1)\}$, so training never converges", r"感知机表示不了 XOR：没有一条直线能把 $\{(0,0),(1,1)\}$ 和 $\{(1,0),(0,1)\}$ 分开，所以训练永远不收敛"), True),
                    (T(r"It can learn XOR with a smaller learning rate", r"换小一点的学习率就能学会 XOR"), T(r"The problem is representational (no $\boldsymbol{\theta}$ exists), not about the step size.", r"问题出在表示能力（不存在这样的 $\boldsymbol{\theta}$），和步长无关。"), 'no-converge-means-bug'),
                    (T(r"It can learn XOR if the step function is replaced by a sigmoid", r"把阶跃函数换成 sigmoid 就能学会 XOR"), T(r"A sigmoid unit is still $f(\boldsymbol{\theta}\cdot\mathbf{x})$ with a monotone $f$: its boundary is still a line. You need a hidden layer.", r"sigmoid 单元仍然是 $f(\boldsymbol{\theta}\cdot\mathbf{x})$（$f$ 单调）：边界仍是直线。需要隐藏层。"), 'boundary-nonlinear'),
                    (T(r"It fails only because there are too few training examples", r"它学不会只是因为训练样本太少"), T(r"The four XOR points are the whole function; more data would not help.", r"XOR 的四个点就是整个函数；再多数据也没用。"))],
                   T(r"Linear boundary + XOR's diagonal layout = impossible (proved above with four inequalities).", r"线性边界加上 XOR 的对角分布，不可能（上面用四个不等式证明过）。")),
            choice('cp_margin', T('What the algorithm guarantees', '算法保证什么'), C,
                   T('A perceptron converges on a linearly separable data set. Which statement about its final boundary is true?', '感知机在线性可分数据集上收敛了。关于它最终的边界，哪句话对？'),
                   [(T('It separates the training data but is not necessarily the maximum-margin boundary; it depends on the initial weights and the order of the data', '它把训练数据分开了，但不一定是最大间隔边界；它依赖初始权重和数据顺序'), True),
                    (T('It is the maximum-margin boundary, the same one an SVM would find', '它是最大间隔边界，和 SVM 找到的一样'), T('Nothing in the update rule rewards a large margin: it stops at the first separator it reaches.', '更新规则里没有任何东西奖励大间隔：碰到第一个分离面它就停了。'), 'perceptron-max-margin'),
                    (T('It is unique, whatever the initialisation', '不管怎么初始化，它都是唯一的'), T('Different starts and orders give different separating lines (try the deck example with another order).', '不同的起点和顺序给出不同的分离直线（把课件的例子换个顺序试试）。')),
                    (T('It minimises the probability of error on new data', '它让新数据上的错误概率最小'), T('It only guarantees zero training mistakes; nothing is said about new data.', '它只保证训练错误为零；对新数据没有任何保证。'))],
                   T(r"Convergence = a separator; max-margin needs the SVM's objective.", r"收敛 = 找到一个分离面；最大间隔需要 SVM 的目标函数。")),
            text_q('cp_compare', T('Compare perceptron and logistic regression', '比较感知机与逻辑回归'), R,
                   T('Compare the perceptron with logistic regression: activation function, objective, how the weights are updated, and behaviour on non-separable data. (Section A style, about 3 lines)', '比较感知机与逻辑回归：激活函数、目标、权重更新方式，以及在线性不可分数据上的表现。（Section A 风格，约 3 行）'),
                   [T('Activation: perceptron uses a step function (output −1/1, non-differentiable); logistic regression uses a sigmoid (probability, differentiable).', '激活函数：感知机用阶跃函数（输出 −1/1，不可微）；逻辑回归用 sigmoid（输出概率，可微）。'),
                    T('Objective: perceptron minimises classification errors directly (no probabilities); logistic regression minimises the negative conditional log-likelihood (cross-entropy).', '目标：感知机直接最小化分类错误（没有概率）；逻辑回归最小化负条件对数似然（交叉熵）。'),
                    T('Update: perceptron is online and updates only on mistakes, $\\theta \\leftarrow \\theta + \\eta y x$; logistic regression uses gradient descent with a gradient from every example.', '更新：感知机是在线的，只在分错时更新，$\\theta \\leftarrow \\theta + \\eta y x$；逻辑回归用梯度下降，每个样本都有梯度。'),
                    T('Non-separable data: the perceptron never converges; logistic regression still finds the best fit.', '不可分数据：感知机不收敛；逻辑回归仍能找到最佳拟合。')],
                   T('Both are linear classifiers y = f(θ·x). The perceptron uses a step activation and updates θ ← θ + ηyx only on misclassified examples, minimising errors with no probabilities; it converges only if the data are linearly separable. Logistic regression uses a sigmoid and minimises cross-entropy by gradient descent, giving probabilities, and works on non-separable data.',
                     'Both are linear classifiers y = f(θ·x). The perceptron uses a step activation and updates θ ← θ + ηyx only on misclassified examples, minimising errors with no probabilities; it converges only if the data are linearly separable. Logistic regression uses a sigmoid and minimises cross-entropy by gradient descent, giving probabilities, and works on non-separable data.'),
                   T('A good answer names the activation, the objective, the update and the separable/non-separable difference.', '好的答案要写出激活函数、目标、更新方式，以及可分/不可分时的区别。')),
            read('remember', T('What to remember', '要记住的'),
                 ul(T(r"**Neuron**: $\hat y = f(\boldsymbol{\theta}\cdot\mathbf{x})$, $x_0 = 1$; perceptron: $f$ = step, $\hat y = 1$ if $\boldsymbol{\theta}\cdot\mathbf{x} > 0$ else $-1$. Boundary $\boldsymbol{\theta}\cdot\mathbf{x} = 0$ is **linear**; $\boldsymbol{\theta}$ is its normal.", r"**神经元**：$\hat y = f(\boldsymbol{\theta}\cdot\mathbf{x})$，$x_0 = 1$；感知机：$f$ 为阶跃，$\boldsymbol{\theta}\cdot\mathbf{x} > 0$ 时 $\hat y = 1$，否则 $-1$。边界 $\boldsymbol{\theta}\cdot\mathbf{x} = 0$ 是**线性**的；$\boldsymbol{\theta}$ 是它的法向量。"),
                    T(r"**Rule**: mistake iff $y(\boldsymbol{\theta}\cdot\mathbf{x}) \le 0$; then $\boldsymbol{\theta} \leftarrow \boldsymbol{\theta} + \eta y\mathbf{x}$. Epochs until an epoch has no update. Online, order-dependent; with a zero start $\eta$ only scales $\boldsymbol{\theta}$.", r"**规则**：当且仅当 $y(\boldsymbol{\theta}\cdot\mathbf{x}) \le 0$ 时分错；此时 $\boldsymbol{\theta} \leftarrow \boldsymbol{\theta} + \eta y\mathbf{x}$。一轮轮地跑，直到某一轮没有更新。在线、依赖顺序；零起点时 $\eta$ 只缩放 $\boldsymbol{\theta}$。"),
                    T(r"**Is SGD** on $\max(0, -y\boldsymbol{\theta}^\top\mathbf{x})$ (gradient $-y\mathbf{x}$ on a mistake, 0 otherwise); the hinge loss with margin 0.", r"**就是 SGD**，损失 $\max(0, -y\boldsymbol{\theta}^\top\mathbf{x})$（分错时梯度 $-y\mathbf{x}$，否则 0）；是间隔为 0 的合页损失。"),
                    T(r"**Convergence**: separable with margin $\gamma$, $\lVert\mathbf{x}\rVert \le R$: at most $(R/\gamma)^2$ mistakes. Proof: $\boldsymbol{\theta}\cdot\boldsymbol{\theta}^\ast \ge k\gamma$, $\lVert\boldsymbol{\theta}\rVert^2 \le kR^2$, Cauchy-Schwarz. Not max-margin; depends on init and order. Non-separable: never converges (cannot prove non-separability by non-convergence).", r"**收敛**：以间隔 $\gamma$ 可分、$\lVert\mathbf{x}\rVert \le R$：至多 $(R/\gamma)^2$ 次错误。证明：$\boldsymbol{\theta}\cdot\boldsymbol{\theta}^\ast \ge k\gamma$，$\lVert\boldsymbol{\theta}\rVert^2 \le kR^2$，再用 Cauchy-Schwarz。不是最大间隔；依赖初值和顺序。不可分：不收敛（但不能凭不收敛证明不可分）。"),
                    T(r"**XOR** is not linearly separable (four inequalities contradict): the 1969 limitation; fixed by hidden layers. AND and OR are separable.", r"**XOR** 线性不可分（四个不等式矛盾）：1969 年的局限；用隐藏层解决。AND、OR 可分。"),
                    T(r"**Versus** logistic regression: sigmoid + cross-entropy, probabilities, batch/SGD, fine on non-separable data. A single sigmoid neuron with cross-entropy *is* logistic regression. **Versus SVM**: hinge with margin 1 + $\lVert\mathbf{w}\rVert^2$, unique max-margin solution.", r"**对比**逻辑回归：sigmoid + 交叉熵，有概率，批量/SGD，不可分数据也能处理。单个 sigmoid 神经元加交叉熵*就是*逻辑回归。**对比** SVM：间隔为 1 的合页损失 + $\lVert\mathbf{w}\rVert^2$，有唯一的最大间隔解。"))),
        ])


# ================================================================ lesson 2: the multi-layer perceptron
def softmax(z):
    e = [math.exp(v) for v in z]
    s = sum(e)
    return [v / s for v in e]


relu = lambda v: max(0.0, v)  # noqa: E731

# the hand forward pass: 2 inputs, 2 sigmoid hidden units, 1 sigmoid output, y = 1
FX = (1.0, 2.0)
H1 = (0.1, 0.4, -0.2)
H2 = (-0.3, 0.5, 0.1)
OW = (0.2, 0.6, -0.5)
FZ1 = H1[0] + H1[1] * FX[0] + H1[2] * FX[1]
FZ2 = H2[0] + H2[1] * FX[0] + H2[2] * FX[1]
FH1, FH2 = sigmoid(FZ1), sigmoid(FZ2)
FZO = OW[0] + OW[1] * FH1 + OW[2] * FH2
FY = sigmoid(FZO)
FLOSS = -math.log(FY)
assert [round(v, 3) for v in (FZ1, FZ2, FH1, FH2, FZO, FY, FLOSS)] == [0.1, 0.4, 0.525, 0.599, 0.216, 0.554, 0.591]

SM = softmax([2.0, 1.0, 0.0])
assert [round(v, 3) for v in SM] == [0.665, 0.245, 0.09] and round(-math.log(SM[0]), 3) == 0.408
SM2 = softmax([1.0, 2.0, 0.5])
assert round(SM2[1], 3) == 0.629

assert round(-math.log(0.8), 3) == 0.223 and round(-math.log(0.1), 3) == 2.303
assert round((1 - 0.8) ** 2, 2) == 0.04 and round((1 - 0.1) ** 2, 2) == 0.81
assert abs((0.25 + 0.25) / 2 - 0.25) < 1e-12

# a stack of linear layers
W1 = np.array([[1, 2], [0, 1]])
W2 = np.array([[2, -1]])
assert (W2 @ W1).tolist() == [[2, 3]] and (W2 @ (W1 @ np.array([1, 1]))).tolist() == [5] and ((W2 @ W1) @ np.array([1, 1])).tolist() == [5]

# parameter count of a 3-4-3-1 network, biases included
assert (3 + 1) * 4 + (4 + 1) * 3 + (3 + 1) * 1 == 35

# the deck's XOR network (step with phi(x) = 1 for x >= 0)
step0 = lambda v: 1 if v >= 0 else 0  # noqa: E731
XOR_NET = [(a, b, step0(a + b - 0.5), step0(a + b - 1.5), step0(step0(a + b - 0.5) - step0(a + b - 1.5) - 0.5)) for a, b in [(0, 0), (1, 0), (0, 1), (1, 1)]]
assert [r[4] for r in XOR_NET] == [0, 1, 1, 0]

# the ReLU forward pass of the checkpoint: a dead unit
CX = (2.0, -1.0)
CH1 = relu(1 + 0.5 * CX[0] - 1 * CX[1])
CH2 = relu(-1 + 0.5 * CX[0] + 1 * CX[1])
CZ = 0.5 + 1.0 * CH1 - 2.0 * CH2
assert (CH1, CH2, CZ) == (3.0, 0.0, 3.5) and round(sigmoid(CZ), 3) == 0.971

assert abs(math.tanh(0.7) - (2 * sigmoid(1.4) - 1)) < 1e-12
assert round(sigmoid(5) * (1 - sigmoid(5)), 4) == 0.0066 and 0.25 ** 10 < 1e-6 and 0.25 ** 5 == 1 / 1024


def fig_network(lang):
    f = Fig(700, 380, lang)
    layers = [(90, 3, 'x'), (270, 4, 'h'), (450, 3, 'h'), (620, 1, 'y')]
    pos = []
    for x, n, _ in layers:
        top = 170 - (n - 1) * 45
        pos.append([(x, top + 90 * i) for i in range(n)])
    for a in range(3):
        for (x1, y1) in pos[a]:
            for (x2, y2) in pos[a + 1]:
                f.line(x1 + 22, y1, x2 - 22, y2, LINE, 1.4)
    f.line(pos[1][1][0] + 22, pos[1][1][1], pos[2][2][0] - 22, pos[2][2][1], BLUE, 3.4)
    f.text(360, 305, 'θ_{ij}', 18, BLUE, 'middle')
    labels = ['x_{1}', 'x_{2}', 'x_{3}']
    for i, (x, y) in enumerate(pos[0]):
        f.circle(x, y, 22, '#ffffff', INK)
        f.text(x, y + 6, labels[i], 17, INK, 'middle')
    for a in (1, 2):
        for i, (x, y) in enumerate(pos[a]):
            f.circle(x, y, 22, '#eef2fc', BLUE)
            f.text(x, y + 6, f'h_{{{i + 1}}}', 17, BLUE, 'middle')
    f.circle(pos[3][0][0], pos[3][0][1], 22, '#fdf1ea', ORANGE)
    f.text(pos[3][0][0], pos[3][0][1] + 6, 'y', 18, ORANGE, 'middle')
    for (x, _, _), name in zip(layers, [f.L('input layer', '输入层'), f.L('hidden layer 1', '隐藏层 1'), f.L('hidden layer 2', '隐藏层 2'), f.L('output layer', '输出层')]):
        f.text(x, 352, name, 16, MUTED, 'middle')
    return f.svg()


def fig_activations(lang):
    P = Plot(-4, 4, -1.4, 2.2)
    P.curve(lambda z: 1 if z > 0 else 0, -4, 0, MUTED, 2.5, '7 5')
    P.curve(lambda z: 1, 0, 4, MUTED, 2.5, '7 5')
    P.curve(sigmoid, -4, 4, BLUE, 3.5)
    P.curve(math.tanh, -4, 4, ORANGE, 3.5)
    P.curve(lambda z: max(0, z), -4, 2.2, GREEN, 3.5)
    P.text(2.9, 0.78, 'σ', BLUE, 20, dy=0)
    P.text(-2.7, -0.8, 'tanh', ORANGE, 18)
    P.text(0.3, 1.9, 'ReLU', GREEN, 18)
    P.text(0.1, 1.2, 'step' if lang == 'en' else '阶跃', MUTED, 16)
    P.axes('z', 'f(z)', [-4, -2, 0, 2, 4], [-1, 0, 1, 2])
    return P.svg()


def fig_xor_hidden(lang):
    f = Fig(700, 340, lang)

    def panel(ox, title, xl, yl, pts, line=None, extra=None):
        f.line(ox, 270, ox + 260, 270, INK, 2, arrow=True)
        f.line(ox, 270, ox, 50, INK, 2, arrow=True)
        f.text(ox + 262, 295, xl, 18, INK)
        f.text(ox - 12, 42, yl, 18, INK)
        f.text(ox + 130, 322, title, 16, MUTED, 'middle')
        for (a, b, cls, lab) in pts:
            cx, cy = ox + 40 + 160 * a, 250 - 160 * b
            if cls > 0:
                f.rect(cx - 11, cy - 11, 22, 22, BLUE, None, 0, 0)
            else:
                f.circle(cx, cy, 12, '#ffffff', ORANGE, 3.5)
            if lab:
                f.text(cx + 18, cy - 14, lab, 14, MUTED)
        if extra:
            f.text(*extra, 14, MUTED, 'middle')
        if line:
            f.line(*line, GREEN, 3.5)

    panel(40, f.L('inputs (x₁, x₂)', '输入空间 (x₁, x₂)'), 'x₁', 'x₂', [(0, 0, -1, '(0,0)'), (1, 1, -1, '(1,1)'), (1, 0, 1, '(1,0)'), (0, 1, 1, '(0,1)')])
    panel(400, f.L('hidden space (h₁, h₂)', '隐藏空间 (h₁, h₂)'), 'h₁', 'h₂', [(0, 0, -1, '(0,0)'), (1, 1, -1, '(1,1)'), (1, 0, 1, '')],
          line=(400 + 40 + 160 * 0.5, 270, 400 + 40 + 160 * 0.5 + 135, 270 - 135),
          extra=(400 + 40 + 150, 292, '{(1,0), (0,1)}'))
    return f.svg()


def xor_truth_table():
    return table(['$x_1$', '$x_2$', '$h_1$ = OR', '$h_2$ = AND', '$y$ = XOR'], *[[str(a), str(b), str(h1), str(h2), str(y)] for a, b, h1, h2, y in XOR_NET])


def L_mlp():
    LY, AC, LS, XN, PW = 'mlp.layers', 'mlp.activations', 'mlp.loss', 'mlp.xor', 'mlp.power'
    return dict(
        id=lid('mlp'),
        title=T('Multi-layer perceptrons: stacking units', '多层感知机：把单元叠起来'),
        description=T('Layers, weights and activations, the forward pass by hand, loss functions, why hidden layers need non-linearity, how XOR is solved, what universal approximation does and does not say, and why the perceptron rule cannot train a hidden layer.',
                      '层、权重和激活函数，手算前向传播，损失函数，为什么隐藏层需要非线性，XOR 怎么解，万能逼近定理说了什么没说什么，以及为什么感知机规则训练不了隐藏层。'),
        minutes=40,
        skills=[{'id': LY, 'name': T('Layers, units and the forward pass', '层、单元与前向传播')},
                {'id': AC, 'name': T('Activation and output functions', '激活函数与输出函数')},
                {'id': LS, 'name': T('Loss functions: squared error and cross-entropy', '损失函数：平方误差与交叉熵')},
                {'id': XN, 'name': T('Non-linearity, XOR and feature learning', '非线性、XOR 与特征学习')},
                {'id': PW, 'name': T('Representational power and its limits', '表示能力及其局限')}],
        misconceptions=[
            {'id': 'deep-linear', 'description': T('Believing that more layers add power even when every activation is linear', '以为激活函数全是线性时，层数多也能增加表达能力')},
            {'id': 'uat-trainable', 'description': T('Reading universal approximation as "any network trained by gradient descent will find the function"', '把万能逼近定理理解成“梯度下降训练出的网络一定能找到那个函数”')},
            {'id': 'step-hidden', 'description': T('Using the step function in hidden layers that are trained by gradient descent', '在用梯度下降训练的隐藏层里使用阶跃函数')},
            {'id': 'perceptron-rule-mlp', 'description': T('Thinking the perceptron rule can train hidden units', '以为感知机规则可以训练隐藏单元')}],
        steps=[
            read('why', T('Why stack units into layers', '为什么要把单元叠成层'),
                 p(T(r"The perceptron lesson ended on a wall: one unit draws one straight line, and XOR cannot be separated by any line. The deck's answer is 'stack moar layers': **a neural network is a combination of many perceptron-like units**, wired in layers so that the outputs of one layer become the inputs of the next. One condition changes: for training by gradient descent the units must have **continuous (differentiable) activation functions**, so the step function is replaced by sigmoid, tanh or ReLU.",
                     r"感知机那一课撞上了一堵墙：一个单元只画一条直线，而 XOR 用任何直线都分不开。课件的回答是“多叠几层”（stack moar layers）：**神经网络是许多类感知机单元的组合**，按层连接，上一层的输出是下一层的输入。有一个条件变了：要用梯度下降训练，单元必须有**连续（可微）的激活函数**，所以阶跃函数换成 sigmoid、tanh 或 ReLU。")),
                 p(T(r"The **multi-layer perceptron** (MLP) is one particular kind of neural network: **feed-forward** (signals only go from inputs to outputs, no loops), **fully connected** (every unit connects to every unit of the next layer), and a **supervised** learner. Other kinds: convolutional networks (images), recurrent networks (sequences), autoencoders (unsupervised). Only the MLP is in scope.",
                     r"**多层感知机**（multi-layer perceptron，MLP）是神经网络里的一种：**前馈**（feed-forward，信号只从输入走向输出，没有回路）、**全连接**（fully connected，每个单元与下一层每个单元都相连）、**监督**学习器。其他种类：卷积网络（图像）、循环网络（序列）、自编码器（无监督）。只有 MLP 在考纲里。")),
                 table(['', T('Linear classifiers', '线性分类器'), T('Neural networks (≥ 1 hidden layer, non-linear activation)', '神经网络（≥ 1 个隐藏层、非线性激活）')],
                       [T('examples', '例子'), T('perceptron, naive Bayes, logistic regression', '感知机、朴素贝叶斯、逻辑回归'), T('multi-layer perceptron', '多层感知机')],
                       [T('decision boundary', '决策边界'), T('linear combination of features', '特征的线性组合'), T('non-linear function of the inputs', '输入的非线性函数')],
                       [T('feature interactions', '特征交互'), T('not learned naturally', '无法自然学到'), T('learned by the hidden units', '由隐藏单元学到')]),
                 callout('note', T('Not a new idea', '并不是新想法'),
                         T(r"Perceptrons and neural networks date from the 1950s-60s, backpropagation from the 1980s. They became popular around 2010 because of better algorithms, parallel hardware (GPUs) and data (the internet). That is the deck's answer to 'why now?'.",
                           r"感知机和神经网络出现在 1950-60 年代，反向传播在 1980 年代。到 2010 年前后才流行，原因是算法更好、并行硬件（GPU）、以及数据（互联网）。这是课件对“为什么是现在”的回答。")),
                 chapter=T('From one unit to a network', '从一个单元到一个网络')),
            read('layers', T('Layers, units, weights', '层、单元、权重'),
                 svg(drawn(fig_network), T('A network with 3 inputs, hidden layer 1 of four units, hidden layer 2 of three units and one output. Every unit connects to all units of the next layer; one weight θij is highlighted.',
                                          '一个网络：3 个输入，隐藏层 1 有四个单元，隐藏层 2 有三个单元，一个输出。每个单元与下一层的所有单元相连；其中一个权重 θij 用蓝线标出。')),
                 ul(T(r"**Three kinds of layer.** *Input layer* (units $x_j$, one per feature), *output layer* (units $y$: one per possible output, so one unit for binary classification), *hidden layers* (units $h$: everything in between, 'hidden' because their values are not observed in the data).", r"**三种层。** *输入层*（单元 $x_j$，每个特征一个）、*输出层*（单元 $y$：每种可能的输出一个，二分类就一个单元）、*隐藏层*（单元 $h$：中间的所有层，称“隐藏”是因为数据里观测不到它们的值）。"),
                    T(r"**Depth and width.** $L$ layers of units is the *depth*; layer $l$ has $K_l$ units, its *width*, and the width may vary from layer to layer.", r"**深度和宽度。** 有 $L$ 层单元，$L$ 就是*深度*；第 $l$ 层有 $K_l$ 个单元，是它的*宽度*，各层宽度可以不同。"),
                    T(r"**Weights.** One weight $\theta^{(l)}_{ij}$ per connection from unit $j$ of layer $l-1$ to unit $i$ of layer $l$, **plus a bias** $\theta_0$ per unit (a weight from a constant 1, as in the perceptron).", r"**权重。** 第 $l-1$ 层的单元 $j$ 连到第 $l$ 层的单元 $i$，每条连接一个权重 $\theta^{(l)}_{ij}$，**再加上**每个单元一个偏置 $\theta_0$（来自常数 1 的权重，和感知机一样）。"),
                    T(r"**Activation** $\phi^{(l)}$ per layer, applied element by element.", r"每层一个**激活函数** $\phi^{(l)}$，逐个元素地作用。")),
                 p(T(r"**Counting parameters** is a favourite small question. For the network drawn (3 inputs, 4, 3, 1 units): layer 1 has $(3+1)\times 4 = 16$ weights including biases, layer 2 has $(4+1)\times 3 = 15$, the output layer $(3+1)\times 1 = 4$. Total $16 + 15 + 4 = 35$. Rule: each unit has (inputs from the previous layer + 1) parameters.",
                     r"**数参数**是常见的小题。图中的网络（3 个输入，4、3、1 个单元）：第 1 层有 $(3+1)\times 4 = 16$ 个权重（含偏置），第 2 层 $(4+1)\times 3 = 15$ 个，输出层 $(3+1)\times 1 = 4$ 个。合计 $16 + 15 + 4 = 35$。规则：每个单元有（上一层单元数 + 1）个参数。")),
                 quiz(T(r"How many parameters (weights and biases) has an MLP with 2 inputs, one hidden layer of 3 units and 2 output units?", r"一个 MLP：2 个输入、一个含 3 个单元的隐藏层、2 个输出单元。它有多少个参数（权重和偏置）？"),
                      [(T(r"$(2+1)\times 3 + (3+1)\times 2 = 17$", r"$(2+1)\times 3 + (3+1)\times 2 = 17$"), True),
                       (T(r"$2\times 3 + 3\times 2 = 12$", r"$2\times 3 + 3\times 2 = 12$"), T(r"That counts weights only. Every hidden and output unit also has a bias: $3 + 2 = 5$ more.", r"这只数了权重。每个隐藏单元和输出单元还各有一个偏置：多 $3 + 2 = 5$ 个。")),
                       (T(r"$(2+1)\times 3 + (3+1)\times 2 + 2 = 19$", r"$(2+1)\times 3 + (3+1)\times 2 + 2 = 19$"), T(r"The $+1$ in each bracket already is the bias; adding another term counts the output biases twice.", r"每个括号里的 $+1$ 已经是偏置；再加一项就把输出层的偏置数了两遍。"))],
                      T(r"Each unit: (number of units feeding it) weights and 1 bias.", r"每个单元：（输入它的单元数）个权重加 1 个偏置。"))),
            read('forward', T('The forward pass', '前向传播'),
                 p(T(r"**Prediction** with a trained network is a single sweep from the inputs to the output, layer by layer. In the deck's notation for a network with two hidden layers (the bias is the weight on a constant $h_0 = 1$):",
                     r"用训练好的网络做**预测**，就是从输入到输出逐层扫过一遍。课件的记号，两个隐藏层的网络（偏置是常数 $h_0 = 1$ 上的权重）：")),
                 math_(r"h^{(1)}_i = \phi^{(1)}\Bigl(\sum_j \theta^{(1)}_{ij}\,x_j\Bigr),\quad h^{(2)}_i = \phi^{(2)}\Bigl(\sum_j \theta^{(2)}_{ij}\,h^{(1)}_j\Bigr),\quad y_i = \phi^{(3)}\Bigl(\sum_j \theta^{(3)}_{ij}\,h^{(2)}_j\Bigr)"),
                 p(T(r"Read every line the same way: *each unit of this layer takes a weighted sum of all units of the previous layer, then applies its activation.* In vector form, with $\boldsymbol{\theta}^{(l)}$ the matrix of layer $l$ (one column per unit) and $\phi^{(l)}$ applied **element-wise**:",
                     r"每一行读法相同：*这一层的每个单元，对上一层所有单元做加权和，再套上激活函数。* 写成向量形式，$\boldsymbol{\theta}^{(l)}$ 是第 $l$ 层的权重矩阵（每个单元一列），$\phi^{(l)}$ **逐元素**作用：")),
                 math_(r"\mathbf{h}^{(1)} = \phi^{(1)}\bigl(\boldsymbol{\theta}^{(1)\top}\mathbf{x}\bigr),\quad \mathbf{h}^{(2)} = \phi^{(2)}\bigl(\boldsymbol{\theta}^{(2)\top}\mathbf{h}^{(1)}\bigr),\quad \mathbf{y} = \phi^{(3)}\bigl(\boldsymbol{\theta}^{(3)\top}\mathbf{h}^{(2)}\bigr)"),
                 p(T(r"The **pre-activation** of a unit is the weighted sum $z = \sum_j\theta_{ij}h_j$ (the quantity $\boldsymbol{\theta}\cdot\mathbf{x}$ of the perceptron); its **activation** is $h = \phi(z)$. Each layer is a perceptron-like layer with a smooth activation: *nothing new, repeated*. What is new is the composition: $\mathbf{y}$ is a function of a function of a function.",
                     r"单元的**预激活值**（pre-activation）是加权和 $z = \sum_j\theta_{ij}h_j$（就是感知机里的 $\boldsymbol{\theta}\cdot\mathbf{x}$）；它的**激活值**（activation）是 $h = \phi(z)$。每一层都是用光滑激活函数的类感知机层：*没什么新东西，只是重复*。新的是复合：$\mathbf{y}$ 是函数的函数的函数。")),
                 p(T(r"The **output unit(s)** depend on the task, in the next steps: sigmoid or step for two classes, softmax for $K$ classes, the identity for regression.",
                     r"**输出单元**取决于任务，后面几步细说：两个类别用 sigmoid 或阶跃，$K$ 个类别用 softmax，回归用恒等函数。"))),
            read('activations', T('Activation functions', '激活函数'),
                 p(T(r"A layer's activation is a non-linear squashing of its weighted sum. Four to know:", r"每层的激活函数是对加权和做一个非线性的“压缩”。要认识四个：")),
                 svg(drawn(fig_activations), T('Curves of sigmoid (from 0 to 1), tanh (from −1 to 1), ReLU (0 for negative z, then the line y = z) and, dashed, the step function.', 'sigmoid（从 0 到 1）、tanh（从 −1 到 1）、ReLU（z 为负时是 0，之后是直线 y = z）以及虚线的阶跃函数的曲线。')),
                 table([T('name', '名称'), r'$\phi(z)$', r"$\phi'(z)$", T('range', '值域'), T('good to know', '要点')],
                       [T('sigmoid $\\sigma$', 'sigmoid $\\sigma$'), r'$\dfrac{1}{1+e^{-z}}$', r'$\sigma(z)\,(1-\sigma(z))$', '(0, 1)', T(r'a probability; slope at most $1/4$; saturates', r'可当概率；斜率至多 $1/4$；会饱和')],
                       [T('tanh', 'tanh'), r'$\dfrac{e^{2z}-1}{e^{2z}+1}$', r'$1-\tanh^2(z)$', '(−1, 1)', T(r'zero-centred; $= 2\sigma(2z) - 1$; slope at most 1; saturates', r'以 0 为中心；$= 2\sigma(2z) - 1$；斜率至多 1；会饱和')],
                       [T('ReLU', 'ReLU'), r'$\max(0, z)$', T(r'$1$ if $z>0$, else $0$', r'$z>0$ 时为 $1$，否则 $0$'), r'$[0, \infty)$', T('cheap; no saturation for $z>0$; units can "die" (always 0)', '计算便宜；$z>0$ 时不饱和；单元可能“死掉”（总输出 0）')],
                       [T('step', '阶跃'), r'$1$ if $z>0$', r'$0$ (undefined at 0)', '{0, 1}', T('zero gradient: useless for training hidden units', '梯度为零：没法用来训练隐藏单元')]),
                 p(T(r"**What about the step function?** The deck leaves it as a question. A step has derivative 0 everywhere except at the jump, where it is undefined. Gradient descent changes a weight by following the derivative of the loss, so with a step in the middle of the network the derivative is 0 and **no learning signal gets through**. The smooth functions tell the optimiser: 'a slightly larger weight would change the output *this much*.'",
                     r"**阶跃函数呢？** 课件留成了一个问题。阶跃函数除跳变处外导数处处为 0，跳变处没有定义。梯度下降沿着损失的导数调整权重，网络中间放一个阶跃，导数就是 0，**学习信号过不去**。光滑函数则告诉优化器：“权重略大一点，输出会变化*这么多*。”")),
                 p(T(r"**Which one where?** Hidden layers: ReLU is the modern default (simple, does not saturate for positive inputs), tanh or sigmoid in older or smaller networks. The *output* function is chosen by the task, below.",
                     r"**用在哪？** 隐藏层：现在默认用 ReLU（简单，输入为正时不饱和），较老或较小的网络用 tanh 或 sigmoid。*输出层*的函数由任务决定，见下。"))),
            derive('sigmoid_deriv', T('The sigmoid derivative, line by line', 'sigmoid 的导数，逐行推'),
                   [(r"\sigma(z) = \dfrac{1}{1+e^{-z}} = (1+e^{-z})^{-1}", T(r"Write the sigmoid as a power so that the chain rule applies.", r"把 sigmoid 写成幂的形式，便于用链式法则。")),
                    (r"\sigma'(z) = -(1+e^{-z})^{-2}\cdot(-e^{-z}) = \dfrac{e^{-z}}{(1+e^{-z})^{2}}", T(r"Chain rule: the outer derivative of $u^{-1}$ is $-u^{-2}$; the inner derivative of $1 + e^{-z}$ is $-e^{-z}$. The two minus signs cancel.", r"链式法则：外层 $u^{-1}$ 的导数是 $-u^{-2}$；内层 $1 + e^{-z}$ 的导数是 $-e^{-z}$。两个负号抵消。")),
                    (r"= \dfrac{1}{1+e^{-z}}\cdot\dfrac{e^{-z}}{1+e^{-z}}", T(r"Split the square into two factors: the first is $\sigma(z)$ itself.", r"把平方拆成两个因子：第一个就是 $\sigma(z)$ 本身。")),
                    (r"\dfrac{e^{-z}}{1+e^{-z}} = 1 - \dfrac{1}{1+e^{-z}} = 1 - \sigma(z)", T(r"The second factor: write $e^{-z} = (1 + e^{-z}) - 1$ in the numerator.", r"第二个因子：分子写成 $e^{-z} = (1 + e^{-z}) - 1$。")),
                    (r"\sigma'(z) = \sigma(z)\,\bigl(1-\sigma(z)\bigr)", T(r"The slope of the sigmoid is built from its own value. This is why backpropagation computes it for free: the forward pass already holds $\sigma(z)$.", r"sigmoid 的斜率完全由它自己的值决定。这就是反向传播能“白送”这个导数的原因：前向传播已经算出了 $\sigma(z)$。")),
                    (r"\sigma'(0) = \tfrac12\cdot\tfrac12 = \tfrac14", T(r"At $z = 0$, $\sigma = 1/2$. $s(1-s)$ is largest at $s = 1/2$, so this is the **maximum slope: $\sigma' \le 1/4$** everywhere.", r"$z = 0$ 时 $\sigma = 1/2$。$s(1-s)$ 在 $s = 1/2$ 处最大，所以这是**最大斜率：处处 $\sigma' \le 1/4$**。")),
                    (r"\sigma'(5) = 0.993\times 0.007 \approx 0.0066", T(r"Far from zero, the sigmoid is flat: at $z = 5$ the slope is only $0.0066$. This **saturation** matters in the deeper chapter.", r"离零远了，sigmoid 就很平：$z = 5$ 时斜率只有 $0.0066$。这种**饱和**在深入一章里很重要。"))],
                   blank=(5, '1/4', T(r"Evaluate $\sigma'(0)$.", r"求 $\sigma'(0)$。")), skill=AC),
            read('output', T('Output functions', '输出函数'),
                 p(T(r"The output layer must produce the kind of answer the task needs:", r"输出层要给出任务所需要的那种答案：")),
                 table([T('task', '任务'), T('output units', '输出单元'), T('output function', '输出函数')],
                       [T('binary classification', '二分类'), T('1', '1 个'), T('step (as in the perceptron) or sigmoid: $\\hat y_1 = p(y=1\\mid\\mathbf{x})$', '阶跃（同感知机）或 sigmoid：$\\hat y_1 = p(y=1\\mid\\mathbf{x})$')],
                       [T('multiclass ($K$ classes)', '多分类（$K$ 类）'), T('$K$, one per class', '$K$ 个，每类一个'), T('softmax', 'softmax')],
                       [T('regression', '回归'), T('1 (or more)', '1 个（或更多）'), T('identity (linear), sometimes sigmoid or tanh', '恒等（线性），有时用 sigmoid 或 tanh')]),
                 p(T(r"**Softmax** turns the $K$ pre-activations $z_1, \dots, z_K$ of the last layer into a probability distribution over the classes:",
                     r"**Softmax** 把最后一层的 $K$ 个预激活值 $z_1, \dots, z_K$ 变成类别上的概率分布：")),
                 math_(r"P(y = j \mid \mathbf{x};\boldsymbol{\theta}) = \frac{\exp(z_j)}{\sum_{k=1}^{K}\exp(z_k)}"),
                 p(T(r"The exponential makes every score positive and magnifies differences; dividing by the sum makes them add to 1. Example, $\mathbf{z} = (2, 1, 0)$: $e^2 = 7.389$, $e^1 = 2.718$, $e^0 = 1$, sum $11.107$, so $P = (0.665,\ 0.245,\ 0.090)$. Two facts: adding the same constant to every $z_k$ changes nothing (it cancels), which is how software avoids overflow; and for $K = 2$ softmax reduces to a sigmoid of $z_1 - z_2$, which is why logistic regression is the two-class case.",
                     r"指数让每个得分变成正数并放大差距；除以总和让它们加起来等于 1。例，$\mathbf{z} = (2, 1, 0)$：$e^2 = 7.389$，$e^1 = 2.718$，$e^0 = 1$，总和 $11.107$，所以 $P = (0.665,\ 0.245,\ 0.090)$。两个事实：给每个 $z_k$ 加同一个常数不改变结果（约掉了），软件就靠这个避免溢出；$K = 2$ 时 softmax 化为 $z_1 - z_2$ 的 sigmoid，所以逻辑回归是它的二类特例。")),
                 quiz(T(r"For $\mathbf{z} = (2, 1, 0)$, what is the softmax probability of class 3 (the one with $z = 0$)?", r"$\mathbf{z} = (2, 1, 0)$ 时，类别 3（$z = 0$ 的那个）的 softmax 概率是多少？"),
                      [(T(r"$0$, because its score is 0", r"$0$，因为它的得分是 0"), T(r"$e^0 = 1 > 0$: the exponential makes every probability strictly positive. A score of 0 is not a probability of 0.", r"$e^0 = 1 > 0$：指数让每个概率都严格为正。得分为 0 不等于概率为 0。")),
                       (T(r"$1/(e^2 + e + 1) = 0.090$", r"$1/(e^2 + e + 1) = 0.090$"), True),
                       (T(r"$1/3$, since softmax is uniform when one score is 0", r"$1/3$，因为有一个得分为 0 时 softmax 是均匀的"), T(r"Softmax is uniform only when *all* scores are equal. Here the other two scores are higher, so class 3 gets less than a third.", r"只有*所有*得分相等时 softmax 才是均匀的。这里另两个得分更高，类别 3 得到的不到三分之一。"))],
                      T(r"$e^0 / (e^2 + e^1 + e^0) = 1/11.107 = 0.090$.", r"$e^0 / (e^2 + e^1 + e^0) = 1/11.107 = 0.090$。"))),
            read('loss', T('Loss functions', '损失函数'),
                 p(T(r"Training minimises a **loss** that measures how far predictions are from labels. Two cases, exactly as in logistic and linear regression:",
                     r"训练就是最小化一个**损失**，衡量预测离标签有多远。两种情形，与逻辑回归、线性回归完全一样：")),
                 h(T('Classification: cross-entropy (negative conditional log-likelihood)', '分类：交叉熵（负条件对数似然）')),
                 math_(r"\mathcal{L}^{(i)} = -\log p\bigl(y^{(i)} \mid \mathbf{x}^{(i)};\boldsymbol{\theta}\bigr),\qquad \mathcal{L} = \sum_i \mathcal{L}^{(i)}"),
                 p(T(r"The loss is small when the network gives the *true* label a high probability. Binary case, with $\hat y_1^{(i)} = p(y^{(i)} = 1\mid\mathbf{x}^{(i)})$; multiclass case, with $y_j^{(i)} = 1$ if $j$ is the true class of instance $i$ and 0 otherwise (**one-hot**):",
                     r"网络给*真实*标签的概率高，损失就小。二分类，$\hat y_1^{(i)} = p(y^{(i)} = 1\mid\mathbf{x}^{(i)})$；多分类，$y_j^{(i)}$ 在 $j$ 是样本 $i$ 的真实类别时为 1、否则为 0（**独热**编码，one-hot）：")),
                 math_(r"\mathcal{L}_{(2)} = -\sum_i \Bigl[y^{(i)}\log\hat y_1^{(i)} + \bigl(1 - y^{(i)}\bigr)\log\bigl(1 - \hat y_1^{(i)}\bigr)\Bigr],\qquad \mathcal{L}_{(K)} = -\sum_i\sum_j y_j^{(i)}\log\hat y_j^{(i)}"),
                 p(T(r"In both, the one-hot labels switch off every term except the true class, so the multiclass loss for one instance is just $-\log$ of the probability given to the right class. With the softmax example above and true class 1: $-\ln 0.665 = 0.408$. (These are natural logs; base 2 would only rescale.)",
                     r"两个式子里，独热标签把除了真实类别以外的项都关掉，所以多分类里一个样本的损失就是正确类别所得概率的 $-\log$。用上面的 softmax 例子、真实类别为 1：$-\ln 0.665 = 0.408$。（这里是自然对数；换底 2 只是整体缩放。）")),
                 table([T('true $y = 1$, predicted $\\hat y_1$', '真实 $y = 1$，预测 $\\hat y_1$'), T('cross-entropy $-\\ln\\hat y_1$', '交叉熵 $-\\ln\\hat y_1$'), T('squared error $(1-\\hat y_1)^2$', '平方误差 $(1-\\hat y_1)^2$')],
                       ['0.8', '0.223', '0.04'], ['0.1', '2.303', '0.81']),
                 p(T(r"The table shows why classification uses cross-entropy: a confident wrong prediction ($\hat y_1 = 0.1$) is punished 10 times harder than a mild one by cross-entropy, and it keeps growing without limit as $\hat y_1 \to 0$, whereas squared error can never exceed 1. (Its gradient with a sigmoid output also does not fade; see the deeper note in the logistic regression lesson.)",
                     r"这张表说明为什么分类用交叉熵：自信而错误的预测（$\hat y_1 = 0.1$），交叉熵的惩罚约是温和预测的 10 倍，而且 $\hat y_1 \to 0$ 时无限增大；平方误差永远不超过 1。（配 sigmoid 输出时它的梯度也不会消失，详见逻辑回归一课。）")),
                 h(T('Regression: mean squared error', '回归：均方误差')),
                 math_(r"\mathcal{L} = \frac1N\sum_{i=1}^{N}\bigl(y^{(i)} - \hat y^{(i)}\bigr)^2"),
                 p(T(r"Output and target are real numbers, and the output unit is the identity. Example: targets $(3, 1)$, predictions $(2.5, 1.5)$: $\bigl((0.5)^2 + (0.5)^2\bigr)/2 = 0.25$.",
                     r"输出和目标都是实数，输出单元取恒等函数。例：目标 $(3, 1)$，预测 $(2.5, 1.5)$：$\bigl((0.5)^2 + (0.5)^2\bigr)/2 = 0.25$。"))),
            derive('forward_hand', T('A forward pass and its loss by hand', '手算一次前向传播和损失'),
                   [(r"z^{(1)}_1 = 0.1 + 0.4(1) - 0.2(2) = 0.1", T(r"A network with 2 inputs, 2 sigmoid hidden units and 1 sigmoid output. Input $\mathbf{x} = (1, 2)$, true label $y = 1$. Hidden unit 1 has bias $0.1$ and weights $(0.4, -0.2)$: weighted sum first.", r"网络：2 个输入、2 个 sigmoid 隐藏单元、1 个 sigmoid 输出。输入 $\mathbf{x} = (1, 2)$，真实标签 $y = 1$。隐藏单元 1 的偏置是 $0.1$，权重是 $(0.4, -0.2)$：先算加权和。")),
                    (r"h_1 = \sigma(0.1) = 0.525", T(r"Squash it: $\sigma(0.1) = 1/(1 + e^{-0.1}) = 0.525$ (3 decimals; keep more digits on the calculator).", r"压缩：$\sigma(0.1) = 1/(1 + e^{-0.1}) = 0.525$（保留 3 位小数；计算器里多保留几位）。")),
                    (r"z^{(1)}_2 = -0.3 + 0.5(1) + 0.1(2) = 0.4", T(r"Hidden unit 2: bias $-0.3$, weights $(0.5, 0.1)$.", r"隐藏单元 2：偏置 $-0.3$，权重 $(0.5, 0.1)$。")),
                    (r"h_2 = \sigma(0.4) = 0.599", T(r"Squash: $\sigma(0.4) = 0.599$. The hidden layer now represents the input as $(h_1, h_2) = (0.525, 0.599)$.", r"压缩：$\sigma(0.4) = 0.599$。隐藏层现在把输入表示为 $(h_1, h_2) = (0.525, 0.599)$。")),
                    (r"z^{(2)} = 0.2 + 0.6(0.525) - 0.5(0.599) = 0.216", T(r"Output unit: bias $0.2$, weights $(0.6, -0.5)$ on the hidden values.", r"输出单元：偏置 $0.2$，对隐藏值的权重为 $(0.6, -0.5)$。")),
                    (r"\hat y = \sigma(0.216) = 0.554", T(r"The network says: $P(y = 1) = 0.554$. A (weak) vote for class 1.", r"网络的回答：$P(y = 1) = 0.554$。对类别 1 的（微弱）支持。")),
                    (r"\mathcal{L} = -\ln(0.554) = 0.591", T(r"True label $y = 1$, so binary cross-entropy keeps only $-\ln\hat y$. (If the label had been 0, the loss would be $-\ln(1 - 0.554) = 0.807$.)", r"真实标签 $y = 1$，所以二元交叉熵只剩 $-\ln\hat y$。（如果标签是 0，损失是 $-\ln(1 - 0.554) = 0.807$。）"))],
                   outro=T(r"Training will change the nine numbers $(0.1, 0.4, -0.2, -0.3, 0.5, 0.1, 0.2, 0.6, -0.5)$ to push this loss down. *How* is the next lesson (backpropagation), which uses exactly the quantities computed here.", r"训练就是改变这九个数 $(0.1, 0.4, -0.2, -0.3, 0.5, 0.1, 0.2, 0.6, -0.5)$，把这个损失压下去。*怎么改*是下一课（反向传播）的内容，它用的正是这里算出的这些量。"),
                   blank=(2, '0.4', T(r"Compute the weighted sum $z^{(1)}_2$ of hidden unit 2.", r"算出隐藏单元 2 的加权和 $z^{(1)}_2$。")), skill=LY,
                   chapter=T('Computing by hand', '动手算')),
            derive('collapse', T('A stack of linear layers is one linear layer', '一叠线性层就是一个线性层'),
                   [(r"\mathbf{h} = W_1\mathbf{x}", T(r"Take a hidden layer whose activation is the identity: it just multiplies by a matrix $W_1$ (the transpose of the deck's $\boldsymbol{\theta}^{(1)}$). Biases come in a moment.", r"取一个激活函数为恒等的隐藏层：它只是乘以一个矩阵 $W_1$（课件 $\boldsymbol{\theta}^{(1)}$ 的转置）。偏置稍后再加。")),
                    (r"\hat{\mathbf{y}} = W_2\mathbf{h} = W_2(W_1\mathbf{x})", T(r"The output layer, also linear, multiplies again.", r"输出层也是线性的，再乘一次。")),
                    (r"\hat{\mathbf{y}} = (W_2W_1)\,\mathbf{x} = W'\mathbf{x}", T(r"Matrix multiplication is associative: regroup. The whole network is **one** matrix $W' = W_2W_1$. The extra layer added no representational power, only more parameters to fit.", r"矩阵乘法满足结合律：重新分组。整个网络就是**一个**矩阵 $W' = W_2W_1$。多出的那一层没有增加表示能力，只是多了要拟合的参数。")),
                    (r"W_2W_1 = \begin{pmatrix}2 & -1\end{pmatrix}\begin{pmatrix}1 & 2\\ 0 & 1\end{pmatrix} = \begin{pmatrix}2 & 3\end{pmatrix}", T(r"Numbers: $W_1 = \begin{pmatrix}1&2\\0&1\end{pmatrix}$, $W_2 = \begin{pmatrix}2&-1\end{pmatrix}$. Row times columns: $2\cdot1 + (-1)\cdot 0 = 2$ and $2\cdot 2 + (-1)\cdot 1 = 3$.", r"数值：$W_1 = \begin{pmatrix}1&2\\0&1\end{pmatrix}$，$W_2 = \begin{pmatrix}2&-1\end{pmatrix}$。行乘列：$2\cdot1 + (-1)\cdot 0 = 2$，$2\cdot 2 + (-1)\cdot 1 = 3$。")),
                    (r"W_1\mathbf{x} = (3, 1)^\top,\ W_2(W_1\mathbf{x}) = 5", T(r"Check with $\mathbf{x} = (1, 1)$ through the two layers one after the other.", r"用 $\mathbf{x} = (1, 1)$ 验证，一层接一层地走。")),
                    (r"(W_2W_1)\,\mathbf{x} = 2\cdot1 + 3\cdot1 = 5", T(r"Through the single collapsed matrix: the same 5.", r"用合并后的单个矩阵：同样是 5。")),
                    (r"W_2(W_1\mathbf{x}+\mathbf{b}_1)+\mathbf{b}_2 = W'\mathbf{x} + (W_2\mathbf{b}_1+\mathbf{b}_2)", T(r"With biases the collapse is still complete: the result is a linear map plus one constant vector, i.e. a single affine layer. By induction the same holds for any number of linear layers.", r"带上偏置，合并依然彻底：结果是一个线性映射加一个常向量，也就是单个仿射层。归纳可知任意多个线性层都是如此。"))],
                   outro=T(r"So a network of linear layers has a linear decision boundary, however deep. The **non-linear activation between the layers** is what stops the matrices from merging, and is the entire source of an MLP's extra power.", r"所以由线性层组成的网络，无论多深，决策边界都是线性的。**层与层之间的非线性激活**才使矩阵无法合并，也是 MLP 额外能力的全部来源。"),
                   blank=(5, '5', T(r"Compute $(W_2W_1)\mathbf{x}$ for $\mathbf{x} = (1,1)$.", r"计算 $\mathbf{x} = (1,1)$ 时的 $(W_2W_1)\mathbf{x}$。")), skill=XN,
                   chapter=T('Why hidden layers need non-linearity', '为什么隐藏层需要非线性')),
            read('xor_net', T('XOR with one hidden layer', '一个隐藏层解 XOR'),
                 p(T(r"The deck's XOR network uses the step $\phi(x) = 1$ if $x \ge 0$, else $0$, and two hidden units. Weights (bias first):",
                     r"课件的 XOR 网络用阶跃 $\phi(x) = 1$（$x \ge 0$ 时）否则 $0$，和两个隐藏单元。权重（偏置在前）：")),
                 ul(T(r"$h_1 = \phi(-0.5 + x_1 + x_2)$: fires when $x_1 + x_2 \ge 0.5$, i.e. **OR**.", r"$h_1 = \phi(-0.5 + x_1 + x_2)$：$x_1 + x_2 \ge 0.5$ 时发火，即 **OR**。"),
                    T(r"$h_2 = \phi(-1.5 + x_1 + x_2)$: fires when $x_1 + x_2 \ge 1.5$, i.e. **AND**.", r"$h_2 = \phi(-1.5 + x_1 + x_2)$：$x_1 + x_2 \ge 1.5$ 时发火，即 **AND**。"),
                    T(r"$y = \phi(-0.5 + h_1 - h_2)$: fires when $h_1 = 1$ and $h_2 = 0$: *OR but not AND* — that is XOR.", r"$y = \phi(-0.5 + h_1 - h_2)$：$h_1 = 1$ 且 $h_2 = 0$ 时发火：*OR 但不是 AND*，这正是 XOR。")),
                 xor_truth_table(),
                 svg(drawn(fig_xor_hidden), T('Left: the XOR points in input space, not separable by a line. Right: the same points in hidden space (h1, h2): (0,0) stays, (1,0) and (0,1) both map to (1,0), (1,1) goes to (1,1). A line h1 − h2 = 0.5 now separates the classes.',
                                              '左：XOR 的点在输入空间里，直线分不开。右：同样的点在隐藏空间 (h1, h2) 里：(0,0) 不动，(1,0) 和 (0,1) 都变成 (1,0)，(1,1) 变成 (1,1)。现在一条直线 h1 − h2 = 0.5 就把两类分开了。')),
                 p(T(r"This is the key picture. The first layer is **not** solving the problem; it **re-describes the inputs** so that the problem becomes linear for the last layer. The two corners that were on opposite sides of the diagonal, $(1,0)$ and $(0,1)$, are folded onto the same point. The output unit is an ordinary perceptron on the new features $(h_1, h_2)$, and a perceptron can do that: a hidden layer = a learned change of coordinates.",
                     r"这是关键的图。第一层**不是**在解决问题；它**重新描述输入**，让问题对最后一层变成线性的。原来在对角线两侧的两个角 $(1,0)$ 和 $(0,1)$ 被折叠到同一个点。输出单元就是作用在新特征 $(h_1, h_2)$ 上的普通感知机，而感知机做得到：隐藏层 = 学出来的坐标变换。"))),
            derive('xor_check', T('Checking the XOR network, input by input', '逐个输入验证 XOR 网络'),
                   [(r"(0,0):\ (h_1,h_2) = (0,0),\ y = 0", T(r"$h_1 = \phi(-0.5) = 0$, $h_2 = \phi(-1.5) = 0$, $y = \phi(-0.5 + 0 - 0) = \phi(-0.5) = 0$. XOR(0,0) = 0. ✓", r"$h_1 = \phi(-0.5) = 0$，$h_2 = \phi(-1.5) = 0$，$y = \phi(-0.5 + 0 - 0) = \phi(-0.5) = 0$。XOR(0,0) = 0。✓")),
                    (r"(1,0):\ (h_1,h_2) = (1,0),\ y = 1", T(r"$h_1 = \phi(0.5) = 1$, $h_2 = \phi(-0.5) = 0$, $y = \phi(-0.5 + 1 - 0) = \phi(0.5) = 1$. XOR(1,0) = 1. ✓", r"$h_1 = \phi(0.5) = 1$，$h_2 = \phi(-0.5) = 0$，$y = \phi(-0.5 + 1 - 0) = \phi(0.5) = 1$。XOR(1,0) = 1。✓")),
                    (r"(0,1):\ (h_1,h_2) = (1,0),\ y = 1", T(r"Same sums as $(1,0)$ because both hidden units add $x_1 + x_2$. ✓", r"和 $(1,0)$ 的和相同，因为两个隐藏单元算的都是 $x_1 + x_2$。✓")),
                    (r"(1,1):\ (h_1,h_2) = (1,1),\ y = 0", T(r"$h_1 = \phi(1.5) = 1$, $h_2 = \phi(0.5) = 1$, $y = \phi(-0.5 + 1 - 1) = \phi(-0.5) = 0$. XOR(1,1) = 0. ✓", r"$h_1 = \phi(1.5) = 1$，$h_2 = \phi(0.5) = 1$，$y = \phi(-0.5 + 1 - 1) = \phi(-0.5) = 0$。XOR(1,1) = 0。✓"))],
                   outro=T(r"All four rows of XOR are reproduced. The same wiring is the answer to the deck's toy questions: AND and OR need no hidden layer (a perceptron learns them); XOR does (a perceptron cannot, an MLP can).", r"XOR 的四行全部复现。同样的接线也回答了课件里的小问题：AND 和 OR 不需要隐藏层（感知机学得会）；XOR 需要（感知机不行，MLP 可以）。"),
                   skill=XN),
            read('features', T('Feature engineering versus feature learning', '特征工程与特征学习'),
                 p(T(r"The XOR example is a tiny case of the main idea. Perceptron, naive Bayes and logistic regression need a **fixed set of informative features** chosen by a person, for example outlook $\in$ {overcast, sunny, rainy}, wind $\in$ {high, low}. This **feature engineering** needs domain knowledge. A neural network takes 'raw' numeric data (measurements $m_1, m_2, \dots, m_F$) and **learns the features as intermediate representations** while solving the target task: **representation learning**, learning abstract features that are informative for the task.",
                     r"XOR 是这个主要想法的一个小例子。感知机、朴素贝叶斯和逻辑回归都需要人选好的**一组固定的有信息量的特征**，比如 outlook $\in$ {overcast, sunny, rainy}，wind $\in$ {high, low}。这种**特征工程**（feature engineering）需要领域知识。神经网络直接接收“原始”数值数据（测量值 $m_1, m_2, \dots, m_F$），在解决目标任务的同时**学出特征作为中间表示**：这就是**表示学习**（representation learning），学出对任务有用的抽象特征。")),
                 p(T(r"In the deck's weather example, the raw measurements go in, the hidden units (the '???' boxes) end up playing the role of 'outlook', 'temperature', 'humidity', 'windy', and the output says *play or not*. With several hidden layers the features become increasingly high-level: in face recognition, the first layer responds to edges, the next to parts such as eyes and noses, the next to whole faces.",
                     r"课件的天气例子里，原始测量值输入，隐藏单元（那些“???”方框）最终扮演“outlook”“temperature”“humidity”“windy”的角色，输出回答*去不去玩*。有多个隐藏层时，特征越来越高层：人脸识别里，第一层对边缘有反应，下一层对眼睛、鼻子等部件有反应，再下一层对整张脸有反应。")),
                 callout('warning', T('The price', '代价'),
                         T(r"Feature engineering is often replaced, at the cost of **extra tuning**: the number of layers, their widths, activations, learning rate. Depth versus width is an empirical question; theory explains it poorly.", r"特征工程常被取代，代价是**更多的调参**：层数、宽度、激活函数、学习率。深度和宽度哪个更好是个经验问题，理论上解释得不好。")),
                 p(T(r"**Input representations.** The input must be numeric. A patient is a vector of measurements; text becomes a **1-hot** vector (dimension $V$, the vocabulary size) or a pre-trained **embedding** (dimension $k$); an image becomes pixel values (RGB). Special architectures exploit structure: convolutions (images), recurrences (language), attention. Beyond this course.",
                     r"**输入表示。** 输入必须是数值。病人是一个测量值向量；文本变成**独热**向量（维度 $V$，即词表大小）或预训练的**词嵌入**（embedding，维度 $k$）；图像变成像素值（RGB）。有些特殊结构利用数据的结构：卷积（图像）、循环（语言）、注意力。超出本课范围。"))),
            read('power', T('Deeper: what universal approximation says (and does not)', '深入：万能逼近定理说了什么、没说什么'),
                 callout('note', T('Universal approximation theorem', '万能逼近定理'),
                         T(r"A feed-forward network with **a single hidden layer** and a **non-linear** activation (e.g. sigmoid, Cybenko 1989; Hornik 1991) can approximate **any continuous function** on a bounded region of $\mathbb{R}^n$ to any accuracy, provided the hidden layer has **enough units**.",
                           r"只有**一个隐藏层**、激活函数**非线性**（如 sigmoid，Cybenko 1989；Hornik 1991）的前馈网络，只要隐藏层有**足够多的单元**，就能在 $\mathbb{R}^n$ 的有界区域上把**任何连续函数**逼近到任意精度。")),
                 p(T(r"Why it is plausible: one hidden unit with a steep sigmoid or two ReLUs makes a step or a ramp; the difference of two such units makes a **bump** of any position and width; a weighted sum of bumps approximates any curve, as a histogram or Riemann sum does. More hidden units, finer bumps. (In more dimensions, the same idea with bumps in each direction.) It also shows why the non-linearity is needed: with a linear activation, the sum of units is again linear.",
                     r"为什么说得通：一个陡峭的 sigmoid 或两个 ReLU 就能做出一个台阶或斜坡；两个这样的单元相减能做出任意位置、任意宽度的**凸起**（bump）；凸起的加权和可以逼近任何曲线，就像直方图或黎曼和。隐藏单元越多，凸起越细。（高维时同样的思路，每个方向上都有凸起。）这也说明了为什么需要非线性：激活函数是线性时，单元之和还是线性的。")),
                 p(T(r"**What it does *not* promise.** Read the theorem word by word; this is a favourite for discussion questions.",
                     r"**它*没有*保证什么。** 逐词读这个定理；这是讨论题的常客。")),
                 ul(T(r"**Existence, not learning.** It says weights exist; it does not say gradient descent will find them. Training can get stuck or be slow.", r"**只说存在，不说学得到。** 定理说的是权重存在，不是梯度下降能找到它们。训练可能卡住或很慢。"),
                    T(r"**'Enough units' may be astronomically many.** One wide layer can need exponentially more units than a deeper network for some functions; that is one reason depth is used.", r"**“足够多”可能多得离谱。** 对某些函数，一个很宽的层可能比较深的网络需要指数级更多的单元；这是使用深度的原因之一。"),
                    T(r"**Not generalisation.** It speaks about fitting a function, not about doing well on new data. A network big enough to fit anything fits the noise too: the 'danger of overfitting' on the pros-and-cons list.", r"**不涉及泛化。** 它讲的是拟合一个函数，不是在新数据上表现好。大到什么都能拟合的网络，连噪声也一起拟合：这就是优缺点清单里的“过拟合风险”。"),
                    T(r"**Continuous functions on bounded regions**, up to a chosen accuracy: not exact, and not every function.", r"**有界区域上的连续函数**，精度由你指定：不是精确，也不是所有函数。")),
                 quiz(T(r"Which conclusion does the universal approximation theorem support?", r"万能逼近定理支持下面哪个结论？"),
                      [(T(r"A network with one hidden layer is trained by gradient descent to the lowest possible loss", r"只有一个隐藏层的网络，用梯度下降一定能训练到最低可能的损失"), T(r"The theorem is silent about training. It guarantees the *representation exists*, not that the optimiser reaches it.", r"定理对训练只字未提。它保证的是*表示存在*，不是优化器一定能到达。")),
                       (T(r"For any continuous target there is a one-hidden-layer network, of some width, that approximates it arbitrarily well", r"对任何连续目标函数，都有某个宽度的单隐藏层网络能把它任意逼近"), True),
                       (T(r"Neural networks never overfit, since they can represent every function", r"神经网络不会过拟合，因为它们能表示所有函数"), T(r"The opposite: the ability to represent everything is what makes overfitting a danger.", r"恰恰相反：什么都能表示，才使过拟合成为风险。"))],
                      T(r"Existence of a representation, no more.", r"只是表示的存在性，别无其他。")),
                 chapter=T('Power and limits', '能力与局限')),
            derive('vanish', T('Deeper: vanishing gradients, and why ReLU', '深入：梯度消失，以及为什么用 ReLU'),
                   [(r"h_l = \sigma(z_l),\quad z_l = w_l\,h_{l-1}", T(r"Take the simplest deep network: a chain of $L$ layers with one sigmoid unit each (weight $w_l$, no bias). To train layer 1 we need how the output $h_L$ responds to changes upstream.", r"取最简单的深层网络：$L$ 层链，每层一个 sigmoid 单元（权重 $w_l$，无偏置）。训练第 1 层需要知道输出 $h_L$ 对上游变化的响应。")),
                    (r"\dfrac{\partial h_l}{\partial h_{l-1}} = \sigma'(z_l)\,w_l", T(r"Chain rule through one layer: the derivative of the sigmoid times the weight.", r"过一层的链式法则：sigmoid 的导数乘以权重。")),
                    (r"\dfrac{\partial h_L}{\partial h_0} = \prod_{l=1}^{L}\sigma'(z_l)\,w_l", T(r"Through $L$ layers the factors multiply. (Backpropagation, next lesson, is this product organised efficiently; the gradient of the first layer's weights contains it.)", r"经过 $L$ 层，各因子相乘。（下一课的反向传播就是把这个乘积有效地组织起来；第一层权重的梯度里就含有它。）")),
                    (r"\Bigl|\dfrac{\partial h_L}{\partial h_0}\Bigr| \le \Bigl(\dfrac{|w|_{\max}}{4}\Bigr)^{L}", T(r"Use $\sigma' \le 1/4$ (from the derivative derived earlier) in every factor.", r"每个因子都用 $\sigma' \le 1/4$（前面推出的导数）。")),
                    (r"|w| \le 1:\ \bigl(\tfrac14\bigr)^{5} = \dfrac{1}{1024}", T(r"Five layers with weights of size at most 1 already shrink the signal by a factor of at least 1024.", r"五层、权重不超过 1，信号就至少被压小 1024 倍。")),
                    (r"\bigl(\tfrac14\bigr)^{10} \approx 9.5\times 10^{-7}", T(r"Ten layers: about one part in a million. The early layers receive a gradient so small that they barely learn. This is the **vanishing gradient** problem. Saturation makes it worse: at $z = 5$, $\sigma' = 0.0066$, far below $1/4$.", r"十层：大约百万分之一。靠前的层得到的梯度小得几乎学不动。这就是**梯度消失**问题。饱和使它更糟：$z = 5$ 时 $\sigma' = 0.0066$，远小于 $1/4$。")),
                    (r"\text{ReLU}:\ \phi'(z) = 1\ \ (z>0)", T(r"For ReLU the slope on the active side is exactly 1, so the product is just $\prod w_l$: no systematic shrinking by the activation. That, plus being cheap, is why ReLU replaced sigmoid in hidden layers. (tanh has slope up to 1 but saturates too.)", r"ReLU 在激活的那一侧斜率恰好是 1，所以乘积只剩 $\prod w_l$：激活函数不再系统性地缩小信号。加上计算便宜，这就是 ReLU 在隐藏层里取代 sigmoid 的原因。（tanh 斜率最高到 1，但也会饱和。）"))],
                   outro=T(r"The catch: a ReLU unit whose input is always negative has gradient 0 and stops learning (a 'dead' unit). No activation is free.", r"代价：输入总是负数的 ReLU 单元，梯度为 0，不再学习（“死”单元）。没有哪种激活函数是白给的。"),
                   blank=(4, '1/1024', T(r"Evaluate $(1/4)^5$ as a fraction.", r"把 $(1/4)^5$ 写成分数。")), skill=AC),
            read('proscons', T('Pros, cons, and when a linear model is enough', '优缺点，以及什么时候线性模型就够了'),
                 table([T('Pros', '优点'), T('Cons', '缺点')],
                       [T('Powerful: with at least 1 hidden layer, universal approximators', '能力强：至少 1 个隐藏层就是万能逼近器'), T('Powerful models overfit easily', '强大的模型容易过拟合')],
                       [T('Automatic feature learning', '自动学习特征'), T('Need large training sets', '需要大量训练数据')],
                       [T('Very good empirical performance on many diverse tasks', '在很多不同任务上经验表现很好'), T('Often need powerful compute (GPUs)', '常需要强算力（GPU）')],
                       ['', T('Lack of interpretability: hard to say why a prediction was made', '缺乏可解释性：很难说为什么得出这个预测')]),
                 p(T(r"**When is linear classification enough?** (1) When the classes are (approximately) linearly separable. (2) When the feature space is very high-dimensional, with more features than training instances (a linear model can already separate almost anything; the kernel trick covers the rest). (3) When the training set is small. (4) When interpretability matters: you want to see how combinations of features explain predictions. With more data and compute, non-linear models, above all neural networks, keep gaining ground.",
                     r"**什么时候线性分类就够了？** (1) 类别（近似）线性可分。(2) 特征空间维度很高、特征数比训练样本还多（线性模型几乎已经能分开任何东西；其余靠核技巧）。(3) 训练集很小。(4) 可解释性重要：想看到特征的组合怎样解释预测。随着数据和算力增加，非线性模型，首先是神经网络，不断扩大地盘。"))),
            read('bridge', T('How do we train it? The perceptron rule fails', '怎么训练？感知机规则行不通'),
                 p(T(r"We know how to train one unit: the perceptron rule compares the prediction with the **label** $y$ and nudges the weights. For the output unit that still works in spirit: its label is in the data. For a **hidden** unit, what would the rule say? *There is no label for $h_1$.* The data contain $\mathbf{x}$ and $y$; nobody recorded what the hidden unit 'should have said' (that is why it is hidden). Without a target, $y - \hat y$ cannot be formed for it.",
                     r"一个单元怎么训练，我们知道：感知机规则把预测和**标签** $y$ 比较，再推一推权重。对输出单元，这个精神仍然适用：它的标签就在数据里。对**隐藏**单元，规则会怎么说？*$h_1$ 没有标签。* 数据里只有 $\mathbf{x}$ 和 $y$；没人记录隐藏单元“本该说什么”（这正是它“隐藏”的含义）。没有目标，就没法为它算 $y - \hat y$。")),
                 p(T(r"There is a second obstacle. The perceptron rule is gradient descent on a loss of the *output*; to move a hidden weight we need to know how the final loss changes when that weight changes, through every unit in between, and a step activation passes **zero** gradient. Hence both obstacles at once: (1) no target for hidden units, (2) a non-differentiable activation.",
                     r"还有第二个障碍。感知机规则是对*输出*的损失做梯度下降；要移动一个隐藏层的权重，需要知道这个权重改变时最终损失怎样变化，要经过中间的每个单元，而阶跃激活传回的梯度是**零**。所以两个障碍同时存在：(1) 隐藏单元没有目标，(2) 激活函数不可微。")),
                 p(T(r"The way out, in one sentence: use smooth activations, and send the **error signal backwards** from the output with the chain rule, so that each hidden unit is told how much *it* contributed to the error. This is **backpropagation**: 'essentially just gradient descent, but using the chain rule to make the calculations more efficient'. It is the next lesson, and the gradient of the vanishing-gradient product above is exactly what it computes.",
                     r"出路，一句话：用光滑的激活函数，并用链式法则把**误差信号从输出往回传**，让每个隐藏单元知道*它自己*对误差贡献了多少。这就是**反向传播**（backpropagation）：“本质上就是梯度下降，只是用链式法则让计算更高效”。那是下一课，而上面梯度消失的那个乘积，正是它要计算的东西。")),
                 quiz(T(r"Why can the perceptron learning rule not train the hidden units of an MLP?", r"为什么感知机学习规则训练不了 MLP 的隐藏单元？"),
                      [(T(r"The rule needs the true label of each unit, but the data give labels only for the output", r"规则需要每个单元的真实标签，而数据只给了输出的标签"), True),
                       (T(r"The rule works for any number of layers but is too slow", r"规则对任意层数都适用，只是太慢"), T(r"It is not a speed issue: for a hidden unit the quantity $y - \hat y$ does not even exist.", r"不是速度问题：对隐藏单元，$y - \hat y$ 这个量根本就不存在。")),
                       (T(r"Because hidden units use ReLU, which has no derivative at all", r"因为隐藏单元用 ReLU，而 ReLU 完全没有导数"), T(r"ReLU is differentiable except at $z = 0$ (and the perceptron rule does not use derivatives anyway). The missing hidden-unit target is the point.", r"ReLU 除 $z = 0$ 外都可导（而且感知机规则本来也不用导数）。关键是缺少隐藏单元的目标。"))],
                      T(r"No labels for hidden units, and a step has no gradient: backpropagation solves both.", r"隐藏单元没有标签，阶跃又没有梯度：反向传播把这两个问题一起解决。")),
                 chapter=T('Exam practice', '考试练习')),
            number('cp_softmax', T('A softmax output', 'Softmax 输出'), AC,
                   T(r"The last layer of a 3-class network gives $\mathbf{z} = (1.0,\ 2.0,\ 0.5)$. What probability does softmax assign to class 2? Give 3 decimals.", r"3 类网络的最后一层给出 $\mathbf{z} = (1.0,\ 2.0,\ 0.5)$。softmax 给类别 2 的概率是多少？保留 3 位小数。"),
                   round(SM2[1], 3), T(r"$e^{1} = 2.718$, $e^{2} = 7.389$, $e^{0.5} = 1.649$; sum $= 11.756$. $P(\text{class }2) = 7.389/11.756 = 0.629$.", r"$e^{1} = 2.718$，$e^{2} = 7.389$，$e^{0.5} = 1.649$；总和 $= 11.756$。$P(\text{类别 }2) = 7.389/11.756 = 0.629$。"),
                   tolerance=0.002),
            number('cp_forward', T('A ReLU forward pass', 'ReLU 前向传播'), LY,
                   T(r"Input $\mathbf{x} = (2, -1)$. Two ReLU hidden units: $h_1 = \max(0,\ 1 + 0.5x_1 - 1x_2)$ and $h_2 = \max(0,\ -1 + 0.5x_1 + 1x_2)$ (bias first). Output: $\hat y = \sigma(0.5 + 1\cdot h_1 - 2\cdot h_2)$. Find $\hat y$ to 3 decimals.",
                     r"输入 $\mathbf{x} = (2, -1)$。两个 ReLU 隐藏单元：$h_1 = \max(0,\ 1 + 0.5x_1 - 1x_2)$，$h_2 = \max(0,\ -1 + 0.5x_1 + 1x_2)$（偏置在前）。输出：$\hat y = \sigma(0.5 + 1\cdot h_1 - 2\cdot h_2)$。求 $\hat y$，保留 3 位小数。"),
                   round(sigmoid(CZ), 3), T(r"$h_1$: pre-activation $1 + 1 + 1 = 3$, ReLU gives 3. $h_2$: pre-activation $-1 + 1 - 1 = -1$, ReLU gives **0** (a dead unit for this input). Output pre-activation $0.5 + 3 - 0 = 3.5$, $\hat y = \sigma(3.5) = 1/(1 + e^{-3.5}) = 0.971$.", r"$h_1$：预激活值 $1 + 1 + 1 = 3$，ReLU 后是 3。$h_2$：预激活值 $-1 + 1 - 1 = -1$，ReLU 后是 **0**（这个输入下它是“死”的）。输出的预激活值 $0.5 + 3 - 0 = 3.5$，$\hat y = \sigma(3.5) = 1/(1 + e^{-3.5}) = 0.971$。"),
                   tolerance=0.001, hints=(T(r"Compute each hidden pre-activation first; one of them is negative.", r"先算每个隐藏单元的预激活值；其中一个是负的。"),)),
            choice('cp_linear', T('Depth without non-linearity', '没有非线性的深度'), XN,
                   T('A network has five hidden layers, but every unit uses the identity activation. Which statement is correct?', '一个网络有五个隐藏层，但每个单元都用恒等激活。下面哪句正确？'),
                   [(T(r"It can represent exactly what a single linear layer can: a linear boundary, so it cannot solve XOR", r"它能表示的和单个线性层完全一样：线性边界，所以解不了 XOR"), True),
                    (T(r"It can solve XOR because five layers give a more complex boundary", r"它能解 XOR，因为五层给出更复杂的边界"), T(r"$W_5\cdots W_1\mathbf{x}$ is one matrix times $\mathbf{x}$; depth adds parameters, not shape.", r"$W_5\cdots W_1\mathbf{x}$ 就是一个矩阵乘 $\mathbf{x}$；深度增加的是参数，不是形状。"), 'deep-linear'),
                    (T(r"It can solve XOR only if each layer has at least two units", r"只要每层至少两个单元，它就能解 XOR"), T(r"Width does not help either: the product of matrices is still a single linear map.", r"宽度也没用：矩阵之积仍然是单个线性映射。"), 'deep-linear'),
                    (T(r"It works like logistic regression with five times as many weights, but has a non-linear boundary", r"它像权重多五倍的逻辑回归，但边界是非线性的"), T(r"The boundary of such a network is still $\mathbf{w}\cdot\mathbf{x} + b = 0$, a hyperplane.", r"这样的网络的边界仍是 $\mathbf{w}\cdot\mathbf{x} + b = 0$，一个超平面。"), 'deep-linear')],
                   T(r"Composition of linear maps is linear.", r"线性映射的复合仍然是线性的。")),
            choice('cp_step', T('Choosing an activation', '选择激活函数'), AC,
                   T('Why is the step function a poor choice for the hidden units of a network trained by gradient descent?', '为什么阶跃函数不适合作为用梯度下降训练的网络的隐藏单元？'),
                   [(T(r"Its derivative is 0 almost everywhere (and undefined at the jump), so no gradient reaches the weights below it", r"它的导数几乎处处为 0（跳变处没有定义），所以没有梯度传到它下面的权重"), True),
                    (T(r"It outputs values outside $[0, 1]$", r"它的输出超出 $[0, 1]$"), T(r"The step outputs only 0 and 1. The problem is its derivative, not its range.", r"阶跃只输出 0 和 1。问题出在导数，不在值域。"), 'step-hidden'),
                    (T(r"It is linear, so the layers collapse into one", r"它是线性的，所以各层会合并成一层"), T(r"The step is non-linear (that is why a perceptron with hidden steps can do XOR). It fails for training, not for representation.", r"阶跃是非线性的（所以带阶跃隐藏层的感知机能做 XOR）。它的问题在训练，不在表示。"), 'step-hidden'),
                    (T(r"ReLU would be rejected for the same reason, because it is not differentiable at 0", r"ReLU 也会因同样的理由被排除，因为它在 0 处不可导"), T(r"ReLU is differentiable everywhere except the single point $z = 0$, and elsewhere its slope is 0 or 1, informative enough; a step's slope carries no information at all.", r"ReLU 除 $z = 0$ 这一个点外处处可导，其余地方斜率是 0 或 1，信息足够；阶跃的斜率则毫无信息。"), 'step-hidden')],
                   T(r"Zero gradient = no learning signal.", r"梯度为零 = 没有学习信号。")),
            text_q('cp_why_not', T('Why not the perceptron rule?', '为什么不能用感知机规则？'), LY,
                   T('Explain why the perceptron learning algorithm cannot be used to train a neural network with hidden layers, and name what is used instead. (Section A style, about 3 lines)', '解释为什么感知机学习算法不能用来训练带隐藏层的神经网络，并说出用什么代替。（Section A 风格，约 3 行）'),
                   [T('The perceptron rule needs the true label of each unit to compute its error, but for hidden units the labels are not observed (only the output has labels).', '感知机规则需要每个单元的真实标签来算误差，但隐藏单元的标签观测不到（只有输出有标签）。'),
                    T('Hidden layers also need a differentiable activation (sigmoid/tanh/ReLU), because the step function gives zero gradient.', '隐藏层还需要可微的激活函数（sigmoid/tanh/ReLU），因为阶跃函数的梯度为零。'),
                    T('Instead use backpropagation: gradient descent where the chain rule propagates the output error back to every layer.', '改用反向传播：梯度下降，用链式法则把输出误差传回每一层。')],
                   T('The perceptron rule needs a target for every unit it updates. In a network with hidden layers only the output units have labels, the hidden units have none, so their errors cannot be computed; also the step activation has zero gradient. Instead we use backpropagation, which is gradient descent that applies the chain rule to propagate the output error backwards through the layers.',
                     'The perceptron rule needs a target for every unit it updates. In a network with hidden layers only the output units have labels, the hidden units have none, so their errors cannot be computed; also the step activation has zero gradient. Instead we use backpropagation, which is gradient descent that applies the chain rule to propagate the output error backwards through the layers.'),
                   T('Two reasons (no hidden targets, no gradient through a step) and the remedy (backpropagation with smooth activations).', '两个原因（隐藏单元没有目标、阶跃没有梯度）和对策（光滑激活加反向传播）。')),
            text_q('cp_design', T('Design: linear model or neural network?', '设计：线性模型还是神经网络？'), XN,
                   T('A hospital has 150 patients with 2000 gene-expression measurements each and wants to predict whether a drug works, and needs doctors to understand the prediction. Would you use logistic regression or a multi-layer perceptron? Justify with the properties of both. (Section C style, a few lines)', '一家医院有 150 名病人，每人 2000 个基因表达测量值，要预测某种药是否有效，并且需要医生能理解预测。你会用逻辑回归还是多层感知机？用两者的性质来论证。（Section C 风格，几行）'),
                   [T('Small training set (150) with far more features than instances (2000): a flexible MLP would overfit; a linear model is already very expressive in this regime.', '训练集小（150），特征远多于样本（2000）：灵活的 MLP 会过拟合；这种情形下线性模型已经很有表达力。'),
                    T('Interpretability required: logistic regression weights show how each feature pushes the prediction; an MLP is hard to interpret.', '需要可解释性：逻辑回归的权重显示每个特征怎样推动预测；MLP 难以解释。'),
                    T('MLP strengths (feature learning, non-linear boundary, universal approximation) need large data and compute, which we lack; if used, regularise and validate carefully.', 'MLP 的优势（特征学习、非线性边界、万能逼近）需要大数据和算力，而这里没有；若要用，必须正则化并仔细验证。')],
                   T('I would use logistic regression (ideally with regularisation or feature selection). The training set is small (150) and the feature space is very high-dimensional (2000 > 150), where a linear model can already separate the data and a multi-layer perceptron, a universal approximator, would mostly overfit and would need much more data and compute. The doctors also need to see how features contribute, which the weights of logistic regression show and the hidden layers of an MLP do not.',
                     'I would use logistic regression (ideally with regularisation or feature selection). The training set is small (150) and the feature space is very high-dimensional (2000 > 150), where a linear model can already separate the data and a multi-layer perceptron, a universal approximator, would mostly overfit and would need much more data and compute. The doctors also need to see how features contribute, which the weights of logistic regression show and the hidden layers of an MLP do not.'),
                   T('Use all three of the deck\'s "when linear is enough" conditions: small data, more features than instances, interpretability.', '用上课件里“线性分类何时够用”的三个条件：数据少、特征多于样本、需要可解释性。')),
            read('remember', T('What to remember', '要记住的'),
                 ul(T(r"**Network**: input / hidden / output layers; depth $L$, width $K_l$; one weight per connection plus a bias per unit; each unit: $h = \phi(\sum_j\theta_{ij}h_j)$, layer by layer ($\mathbf{h}^{(l)} = \phi^{(l)}(\boldsymbol{\theta}^{(l)\top}\mathbf{h}^{(l-1)})$). Feed-forward, fully connected, supervised. Parameters per unit: inputs + 1.", r"**网络**：输入/隐藏/输出层；深度 $L$，宽度 $K_l$；每条连接一个权重、每个单元一个偏置；每个单元 $h = \phi(\sum_j\theta_{ij}h_j)$，逐层计算（$\mathbf{h}^{(l)} = \phi^{(l)}(\boldsymbol{\theta}^{(l)\top}\mathbf{h}^{(l-1)})$）。前馈、全连接、监督。每个单元的参数个数：输入数 + 1。"),
                    T(r"**Activations**: sigmoid $1/(1+e^{-z})$, $\sigma' = \sigma(1-\sigma) \le 1/4$; tanh $\tfrac{e^{2z}-1}{e^{2z}+1}$, $1 - \tanh^2$; ReLU $\max(0,z)$, slope 0 or 1; step: no gradient. **Outputs**: sigmoid (binary), softmax $e^{z_j}/\sum_k e^{z_k}$ ($K$ classes), identity (regression).", r"**激活函数**：sigmoid $1/(1+e^{-z})$，$\sigma' = \sigma(1-\sigma) \le 1/4$；tanh $\tfrac{e^{2z}-1}{e^{2z}+1}$，$1 - \tanh^2$；ReLU $\max(0,z)$，斜率 0 或 1；阶跃：没有梯度。**输出**：sigmoid（二分类）、softmax $e^{z_j}/\sum_k e^{z_k}$（$K$ 类）、恒等（回归）。"),
                    T(r"**Losses**: cross-entropy $-\sum_i\sum_j y^{(i)}_j\log\hat y^{(i)}_j$ (binary: $-[y\log\hat y + (1-y)\log(1-\hat y)]$); MSE $\tfrac1N\sum(y-\hat y)^2$.", r"**损失**：交叉熵 $-\sum_i\sum_j y^{(i)}_j\log\hat y^{(i)}_j$（二分类：$-[y\log\hat y + (1-y)\log(1-\hat y)]$）；MSE $\tfrac1N\sum(y-\hat y)^2$。"),
                    T(r"**Non-linearity**: $W_2(W_1\mathbf{x}) = (W_2W_1)\mathbf{x}$, so linear layers collapse; a hidden layer with non-linear activation gives a non-linear boundary. **XOR** = OR but not AND (hidden $-0.5$, $-1.5$; output $1, -1, -0.5$). The hidden layer re-describes the inputs: **representation learning**, replacing feature engineering at the cost of tuning.", r"**非线性**：$W_2(W_1\mathbf{x}) = (W_2W_1)\mathbf{x}$，线性层会合并；带非线性激活的隐藏层给出非线性边界。**XOR** = OR 但不是 AND（隐藏层偏置 $-0.5$、$-1.5$；输出 $1, -1, -0.5$）。隐藏层重新描述输入：**表示学习**，以调参为代价取代特征工程。"),
                    T(r"**Universal approximation**: one hidden layer, non-linear activation, enough units approximates any continuous function; says nothing about training, size, or generalisation. **Vanishing gradient**: $\sigma' \le 1/4$, product over layers shrinks; ReLU slope 1.", r"**万能逼近**：一个隐藏层、非线性激活、足够多单元，可逼近任何连续函数；对训练、规模、泛化只字未提。**梯度消失**：$\sigma' \le 1/4$，各层连乘后变小；ReLU 斜率为 1。"),
                    T(r"**Pros**: powerful, feature learning, good empirical performance. **Cons**: overfitting, needs large data and compute, hard to interpret. Linear is enough when separable, high-dimensional with few instances, small data, or interpretability matters. **Training**: perceptron rule fails (no hidden labels, step has no gradient) → backpropagation.", r"**优点**：能力强、特征学习、经验表现好。**缺点**：过拟合、需要大数据和算力、难解释。线性模型够用的情形：可分、高维少样本、数据少、或需要可解释性。**训练**：感知机规则行不通（隐藏单元没有标签、阶跃没有梯度）→ 反向传播。"))),
        ])


LESSONS = [L_perceptron, L_mlp]
