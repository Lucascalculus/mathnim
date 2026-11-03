# COMP90049 lessons 08 (logistic regression) and 09 (support vector machines); README.md here has the plan.
# Every number in a worked example is computed below (helpers at the top) and asserted against the literal
# that the text shows, so a typo in a string cannot slip through (see the checks at the end of the file).
import math
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from ml_kit import *  # noqa: E402,F403


# ------------------------------------------------------------------ numbers shared by the lessons
def sig(z):
    return 1 / (1 + math.exp(-z))


# the deck's income example (lecture 8, slides 30-31): features (age, edu-num, hrs/wk), label 1 = >50K
LR_THETA = [-18, 0.12, 0.96, 0.1]
LR_DATA = [(31, 13, 40, 1), (31, 9, 20, 0), (25, 13, 60, 1), (70, 9, 40, 1), (39, 9, 45, 0)]


def lr_z(theta, x):
    return theta[0] + sum(t * v for t, v in zip(theta[1:], x))


LR_P = [sig(lr_z(LR_THETA, d[:3])) for d in LR_DATA]
LR_ERR = [p - d[3] for p, d in zip(LR_P, LR_DATA)]
LR_GRAD = [sum(LR_ERR)] + [sum(e * d[j] for e, d in zip(LR_ERR, LR_DATA)) for j in range(3)]
LR_ETA = 0.001
LR_NEW = [t - LR_ETA * g for t, g in zip(LR_THETA, LR_GRAD)]


def lr_loss(theta):
    tot = 0
    for d in LR_DATA:
        p = sig(lr_z(theta, d[:3]))
        tot -= d[3] * math.log(p) + (1 - d[3]) * math.log(1 - p)
    return tot


LR_LOSS0, LR_LOSS1 = lr_loss(LR_THETA), lr_loss(LR_NEW)
LR_BIG = lr_loss([t - 0.01 * g for t, g in zip(LR_THETA, LR_GRAD)])  # eta = 0.01 overshoots

# softmax example of the deck (slides 38-39); x = (bias 1, x1 = 1, x2 = 2)
SM_THETA = {'A': [0.1, 0.5, -0.2], 'B': [-0.1, -0.3, 0.4], 'C': [0.0, 0.1, 0.2]}
SM_X = [1, 1, 2]
SM_Z = {k: sum(a * b for a, b in zip(v, SM_X)) for k, v in SM_THETA.items()}
SM_E = {k: math.exp(v) for k, v in SM_Z.items()}
SM_S = sum(SM_E.values())
SM_P = {k: v / SM_S for k, v in SM_E.items()}


def fit_logreg_1d(xs, ys):
    """Newton's method for a one-feature logistic regression (two parameters)."""
    t0 = t1 = 0.0
    for _ in range(40):
        g0 = g1 = h00 = h01 = h11 = 0.0
        for x, y in zip(xs, ys):
            p = sig(t0 + t1 * x)
            w = p * (1 - p)
            g0 += p - y; g1 += (p - y) * x
            h00 += w; h01 += w * x; h11 += w * x * x
        d = h00 * h11 - h01 ** 2
        t0 -= (h11 * g0 - h01 * g1) / d
        t1 -= (-h01 * g0 + h00 * g1) / d
    return t0, t1


# ------------------------------------------------------------------ figures: logistic regression
STUDY_X = [1, 2, 3, 4, 6, 5, 7, 8, 9, 10, 11]
STUDY_Y = [0, 0, 0, 0, 0, 1, 1, 1, 1, 1, 1]


def fig_line_vs_sigmoid(lang):
    zh = lang == 'zh'
    n = len(STUDY_X)
    mx, my = sum(STUDY_X) / n, sum(STUDY_Y) / n
    sl = sum((x - mx) * (y - my) for x, y in zip(STUDY_X, STUDY_Y)) / sum((x - mx) ** 2 for x in STUDY_X)
    ic = my - sl * mx
    t0, t1 = fit_logreg_1d(STUDY_X, STUDY_Y)
    P = Plot(0, 12, -0.4, 1.4, w=640, h=380)
    P.area([(0, -0.4), (12, -0.4), (12, 0), (0, 0)], ORANGE, 0.10)
    P.area([(0, 1), (12, 1), (12, 1.4), (0, 1.4)], ORANGE, 0.10)
    P.seg((0, 0), (12, 0), MUTED, 1.2, '5 5')
    P.seg((0, 1), (12, 1), MUTED, 1.2, '5 5')
    P.curve(lambda x: ic + sl * x, 0, 12, ORANGE, 3, '8 5')
    P.curve(lambda x: sig(t0 + t1 * x), 0, 12, BLUE, 3.5)
    for x, y in zip(STUDY_X, STUDY_Y):
        P.dot(x, y, INK, 5.5)
    P.axes('x', 'P(y=1)' if not zh else 'P(y=1)', (0, 4, 8, 12), (0, 1))
    P.text(0.2, -0.25, '线性回归 θᵀx' if zh else 'linear θᵀx', ORANGE, 17)
    P.text(0.2, 1.22, '> 1 ？' if zh else '> 1 ?', ORANGE, 17)
    P.text(7.2, 0.4, 'σ(θᵀx)', BLUE, 18, weight='bold')
    P.text(11.9, 1.22, '概率越界' if zh else 'not a probability', ORANGE, 15, anchor='end')
    return P.svg()


def fig_loss_vs_z(lang):
    zh = lang == 'zh'
    P = Plot(-6, 6, 0, 6.5, w=640, h=380)
    P.curve(lambda z: -math.log(sig(z)), -6, 6, BLUE, 3.5)
    P.curve(lambda z: (1 - sig(z)) ** 2, -6, 6, ORANGE, 3.5)
    P.axes('z', '', (-6, -3, 0, 3, 6), (0, 2, 4, 6))
    P.text(-5.8, 5.9, '交叉熵 −ln σ(z)' if zh else 'cross-entropy −ln σ(z)', BLUE, 17, weight='bold')
    P.text(-5.8, 1.45, '平方误差 (1−σ(z))²' if zh else 'squared error (1−σ(z))²', ORANGE, 17, weight='bold')
    P.text(5.9, 0.55, 'y = 1', INK, 17, anchor='end')
    P.dot(-6, -math.log(sig(-6)), BLUE, 5)
    P.dot(-6, (1 - sig(-6)) ** 2, ORANGE, 5)
    return P.svg()


# ================================================================== lesson 1: logistic regression
def L_logreg():
    LM, LP, LL, LG, LC, LK, LV = ('logreg.logit', 'logreg.model', 'logreg.loss', 'logreg.gd', 'logreg.convex', 'logreg.multi', 'logreg.compare')
    t0, t1 = fit_logreg_1d(STUDY_X, STUDY_Y)
    steps = [
        # -------------------------------------------------------------- the idea
        read('why', T('From a line to a probability', '从一条直线到一个概率'),
             p(T(r"Binary classification, $y \in \{0, 1\}$. What we want is a probability, $P(y=1 \mid \mathbf{x}; \boldsymbol{\theta})$: how likely is the positive class here? Regression is the tool we have (lecture 7), so try the obvious thing: let the model output $\boldsymbol{\theta}^\top \mathbf{x}$ and call it the probability.",
                  r"二分类，$y \in \{0, 1\}$。我们要的是一个概率 $P(y=1 \mid \mathbf{x}; \boldsymbol{\theta})$：这里属于正类的可能性有多大？手边现成的工具是回归（第 7 讲），所以先试最直接的做法：让模型输出 $\boldsymbol{\theta}^\top \mathbf{x}$，把它当作概率。")),
             svg(drawn(fig_line_vs_sigmoid), T('Study hours against pass or fail: a straight line leaves the range 0 to 1, the sigmoid stays inside it.', '学习时间对应及格与否：直线会越出 0 到 1 的范围，sigmoid 曲线始终留在其中。')),
             p(T(r"The line fails twice. It is **not bounded**: far from the data it predicts $-0.2$ or $1.3$, and those are not probabilities. And it is **trying to hit 1 and 0 exactly**, so a very easy positive far to the right still tilts the line, which moves where it crosses 0.5. We want a curve that flattens out at 0 and at 1.",
                  r"直线有两个毛病。一是**没有界**：离数据远了它会预测 $-0.2$ 或 $1.3$，这不是概率。二是**它想精确地贴住 0 和 1**，所以右边一个很容易的正例也会把直线拉斜，连带移动它穿过 0.5 的位置。我们要的是一条在 0 和 1 处变平的曲线。")),
             quiz(T('The fitted line gives $\\boldsymbol{\\theta}^\\top \\mathbf{x} = 1.3$ for some input. What is wrong with reading that as $P(y=1 \\mid \\mathbf{x})$?', '拟合的直线对某个输入给出 $\\boldsymbol{\\theta}^\\top \\mathbf{x} = 1.3$。把它读作 $P(y=1 \\mid \\mathbf{x})$ 错在哪里？'),
                  [(T('Nothing: values above 1 just mean "very sure".', '没问题：大于 1 就是"非常确定"。'), T('Probabilities are at most 1. A value of 1.3 cannot be combined with $P(y=0) = 1 - P(y=1)$ without getting a negative probability.', '概率最大是 1。1.3 配上 $P(y=0) = 1 - P(y=1)$ 会得到负的概率。')),
                   (T('It is above 1, so it is not a probability.', '它大于 1，不是概率。'), True),
                   (T('Linear models cannot take a binary label as target.', '线性模型不能把二值标签当作目标。'), T('They can: lecture 7 fits any numeric target. The problem is the *output range*, not the target.', '可以：第 7 讲能拟合任何数值目标。问题在输出的取值范围，不在目标。'))],
                  T('A probability must lie in $[0, 1]$. Whatever we model has to be squeezed into that range.', '概率必须落在 $[0, 1]$。我们建模的量必须被压进这个范围。')),
             chapter=T('The model', '模型')),

        read('odds', T('Odds and log-odds: a quantity a line may take', '几率与对数几率：直线可以取的量'),
             p(T(r"We cannot let a line be a probability, but we can let it be something that *ranges over all real numbers* and is **tied** to a probability. The classic one is the **odds** $\frac{p}{1-p}$: how many times more likely yes is than no. Its logarithm is the **log-odds** or **logit**.",
                 r"直线不能直接当概率，但可以让它去表示一个**取遍全体实数**、并且**与概率一一对应**的量。经典的选择是**几率**（odds）$\frac{p}{1-p}$：\"是\"比\"否\"可能多少倍。它的对数叫**对数几率**（log-odds，logit）。")),
             math_(r"\frac{p}{1-p}, \qquad \log \frac{p}{1-p}"),
             table([T('$p$', '$p$'), T('odds', '几率'), T('log-odds (natural log)', '对数几率（自然对数）'), T('reading', '含义')],
                   ['0.1', '0.111', '-2.197', T('9 to 1 against', '9 比 1 偏向否')],
                   ['0.25', '0.333', '-1.099', T('3 to 1 against', '3 比 1 偏向否')],
                   ['0.5', '1', '0', T('even', '五五开')],
                   ['0.8', '4', '1.386', T('4 to 1 for', '4 比 1 偏向是')],
                   ['0.9', '9', '2.197', T('9 to 1 for', '9 比 1 偏向是')],
                   ['0.99', '99', '4.595', T('99 to 1 for', '99 比 1 偏向是')]),
             p(T(r"The log turns the lopsided odds scale ($0$ to $\infty$) into a **symmetric** one ($-\infty$ to $\infty$, with 0 at $p = 0.5$). That is the quantity we let a line describe. **The one modelling assumption of logistic regression:**",
                 r"取对数把不对称的几率（$0$ 到 $\infty$）变成**对称**的尺度（$-\infty$ 到 $\infty$，$p = 0.5$ 对应 0）。这就是我们让直线去描述的量。**逻辑回归唯一的建模假设：**")),
             math_(r"\log \frac{P(y=1 \mid \mathbf{x}; \boldsymbol{\theta})}{1 - P(y=1 \mid \mathbf{x}; \boldsymbol{\theta})} = \boldsymbol{\theta}^\top \mathbf{x} = \theta_0 + \theta_1 x_1 + \dots + \theta_F x_F"),
             p(T(r"Reading it: each extra unit of $x_j$ adds $\theta_j$ to the log-odds, i.e. **multiplies the odds by** $e^{\theta_j}$. With $\theta_j = 0.1$ the odds grow by a factor $e^{0.1} \approx 1.105$ per unit.",
                 r"怎么读：$x_j$ 每增加一个单位，对数几率加 $\theta_j$，也就是把几率**乘以** $e^{\theta_j}$。若 $\theta_j = 0.1$，每增加一个单位几率就乘以 $e^{0.1} \approx 1.105$。")),
             callout('note', T('Three equivalent ways to say "predict $y=1$" (slides 24-26)', '三种等价的说法："预测 $y=1$"（第 24-26 页）'),
                     T(r"$P(y=1 \mid \mathbf{x}) > P(y=0 \mid \mathbf{x})$ $\Leftrightarrow$ $P(y=1 \mid \mathbf{x}) > 0.5$ $\Leftrightarrow$ odds $> 1$ $\Leftrightarrow$ log-odds $> 0$. The first is the argmax rule, the last is a condition on $\boldsymbol{\theta}^\top \mathbf{x}$ alone.",
                       r"$P(y=1 \mid \mathbf{x}) > P(y=0 \mid \mathbf{x})$ $\Leftrightarrow$ $P(y=1 \mid \mathbf{x}) > 0.5$ $\Leftrightarrow$ 几率 $> 1$ $\Leftrightarrow$ 对数几率 $> 0$。第一个是 argmax 规则，最后一个只和 $\boldsymbol{\theta}^\top \mathbf{x}$ 有关。"))),

        derive('sigmoid', T('Solving for $p$: the sigmoid appears', '解出 $p$：sigmoid 出现了'),
               [(r"\log \frac{p}{1-p} = z", T(r"Start from the assumption. Write $p = P(y=1 \mid \mathbf{x}; \boldsymbol{\theta})$ and $z = \boldsymbol{\theta}^\top \mathbf{x}$.", r"从假设出发。记 $p = P(y=1 \mid \mathbf{x}; \boldsymbol{\theta})$，$z = \boldsymbol{\theta}^\top \mathbf{x}$。")),
                (r"\frac{p}{1-p} = e^{z}", T(r"Undo the log by exponentiating both sides.", r"两边取指数，把 log 去掉。")),
                (r"p = e^{z}(1-p)", T(r"Multiply both sides by $1-p$.", r"两边乘以 $1-p$。")),
                (r"p + p\,e^{z} = e^{z}", T(r"Expand and move the $p$-term to the left.", r"展开，把含 $p$ 的项移到左边。")),
                (r"p\,(1 + e^{z}) = e^{z}", T(r"Factor $p$ out.", r"提出 $p$。")),
                (r"p = \frac{e^{z}}{1 + e^{z}}", T(r"Divide by $1 + e^{z}$.", r"除以 $1 + e^{z}$。")),
                (r"p = \frac{1}{1 + e^{-z}} = \sigma(z)", T(r"Divide top and bottom by $e^{z}$. This is the **sigmoid** (logistic) function, and the answer to slide 27.", r"分子分母同除以 $e^{z}$。这就是 **sigmoid**（logistic）函数，也就是第 27 页的结果。"),
                 T(r"The same map in the other direction: $\log\frac{\sigma(z)}{1-\sigma(z)} = z$. The sigmoid is the inverse of the logit.", r"反方向是同一个映射：$\log\frac{\sigma(z)}{1-\sigma(z)} = z$。sigmoid 是 logit 的反函数。"))],
               intro=T(r"Given the assumption, what is $P(y=1 \mid \mathbf{x})$ itself? Solve for $p$.", r"有了这个假设，$P(y=1 \mid \mathbf{x})$ 本身是多少？解出 $p$ 即可。"),
               blank=(5, 'exp(z)/(1+exp(z))', T(r"Divide $p\,(1+e^{z}) = e^{z}$ by $1 + e^{z}$: what is $p$?", r"把 $p\,(1+e^{z}) = e^{z}$ 除以 $1 + e^{z}$：$p$ 等于什么？"), ['z']), skill=LM),

        read('shape', T('The sigmoid, the two probabilities and the boundary', 'sigmoid、两个概率与决策边界'),
             math_(r"P(y=1 \mid \mathbf{x}; \boldsymbol{\theta}) = \sigma(\boldsymbol{\theta}^\top \mathbf{x}), \qquad P(y=0 \mid \mathbf{x}; \boldsymbol{\theta}) = 1 - \sigma(\boldsymbol{\theta}^\top \mathbf{x}) = \sigma(-\boldsymbol{\theta}^\top \mathbf{x})"),
             table([T('$z = \\boldsymbol{\\theta}^\\top \\mathbf{x}$', '$z = \\boldsymbol{\\theta}^\\top \\mathbf{x}$'), '-4', '-2', '-1', '0', '1', '2', '4'],
                   [T('$\\sigma(z)$', '$\\sigma(z)$'), '0.018', '0.119', '0.269', '0.5', '0.731', '0.881', '0.982']),
             p(T(r"What each piece does. The line $z = \boldsymbol{\theta}^\top \mathbf{x}$ is a **score**: its sign says which class, its size says how sure. The sigmoid squashes the score into $(0, 1)$, is $0.5$ at $z=0$, and is symmetric: $\sigma(-z) = 1 - \sigma(z)$, which is why $P(y=0)$ is just the sigmoid of the negated score. Most scores land near the flat ends, so predictions are close to 0 or 1, as the labels are.",
                 r"每一块的作用。直线 $z = \boldsymbol{\theta}^\top \mathbf{x}$ 是**得分**：符号说明哪一类，大小说明有多确定。sigmoid 把得分压进 $(0, 1)$，$z=0$ 时为 $0.5$，并且对称：$\sigma(-z) = 1 - \sigma(z)$，所以 $P(y=0)$ 就是负得分的 sigmoid。多数得分落在曲线平坦的两端，所以预测接近 0 或 1，和标签一样。")),
             h(T('The decision boundary', '决策边界')),
             p(T(r"Predict $y=1$ when $P(y=1 \mid \mathbf{x}) > 0.5$. Because $\sigma(z) > 0.5 \Leftrightarrow z > 0$, this is simply $\boldsymbol{\theta}^\top \mathbf{x} > 0$. The boundary is where the score is zero, $\boldsymbol{\theta}^\top \mathbf{x} = 0$: a **line** in 2D, a **plane** in 3D, a hyperplane in general. So logistic regression is a **linear classifier**, even though the probability curve bends.",
                 r"当 $P(y=1 \mid \mathbf{x}) > 0.5$ 时预测 $y=1$。因为 $\sigma(z) > 0.5 \Leftrightarrow z > 0$，这就是 $\boldsymbol{\theta}^\top \mathbf{x} > 0$。边界在得分为零之处，$\boldsymbol{\theta}^\top \mathbf{x} = 0$：二维是**直线**，三维是**平面**，一般是超平面。所以逻辑回归是**线性分类器**，尽管概率曲线是弯的。")),
             quiz(T(r"A different threshold (say predict $y=1$ when $P > 0.8$ because false positives are costly) does what to the boundary?", r"换一个阈值（比如因为误报代价高，改为 $P > 0.8$ 才预测 $y=1$），边界会怎样？"),
                  [(T('It becomes curved.', '变成曲线。'), T('$P = 0.8$ means $z = \\log 4$, still a constant: $\\boldsymbol{\\theta}^\\top \\mathbf{x} = 1.386$ is a hyperplane, only shifted.', '$P = 0.8$ 对应 $z = \\log 4$，仍是常数：$\\boldsymbol{\\theta}^\\top \\mathbf{x} = 1.386$ 还是超平面，只是平移了。')),
                   (T('It stays a straight line, shifted away from the positive class.', '仍是直线，远离正类方向平移。'), True),
                   (T('Nothing: the threshold is learned, not chosen.', '不变：阈值是学出来的，不是选出来的。'), T('Training learns $\\boldsymbol{\\theta}$. The threshold is applied afterwards and can be chosen to suit costs.', '训练学的是 $\\boldsymbol{\\theta}$。阈值是之后再用的，可以按代价来选。'))],
                  T('Every threshold $t$ gives $\\boldsymbol{\\theta}^\\top \\mathbf{x} = \\log\\frac{t}{1-t}$: parallel hyperplanes. Only the *offset* moves.', '每个阈值 $t$ 给出 $\\boldsymbol{\\theta}^\\top \\mathbf{x} = \\log\\frac{t}{1-t}$：一族平行的超平面，只有*偏移*在变。'))),

        read('disc', T('Probabilistic and discriminative: what that means', '概率的、判别式的：这是什么意思'),
             p(T(r"Lecture 23 asks you to place every model on the map. Logistic regression is a **probabilistic discriminative** model. Two words, two separate facts:",
                 r"第 23 讲要你把每个模型放到图上。逻辑回归是**概率的判别式**模型。两个词，两件不同的事：")),
             ul(T(r"**Probabilistic**: the model outputs a distribution, $P(y \mid \mathbf{x}; \boldsymbol{\theta})$, a Bernoulli with parameter $\sigma(\boldsymbol{\theta}^\top \mathbf{x})$, and it is fitted by maximum likelihood. It does not just output a label.",
                   r"**概率的**：模型输出一个分布 $P(y \mid \mathbf{x}; \boldsymbol{\theta})$，即参数为 $\sigma(\boldsymbol{\theta}^\top \mathbf{x})$ 的伯努利分布，用最大似然来拟合。它输出的不只是一个标签。"),
                T(r"**Discriminative**: it models $P(y \mid \mathbf{x})$ *directly*. It never models how the features themselves are distributed, neither $P(\mathbf{x} \mid y)$ nor $P(\mathbf{x}, y)$. It only learns where to draw the line between classes.",
                  r"**判别式**：它*直接*建模 $P(y \mid \mathbf{x})$。它从不建模特征本身怎么分布，既不是 $P(\mathbf{x} \mid y)$，也不是 $P(\mathbf{x}, y)$，只学在哪里划分类别之间的线。")),
             table(['', T('Naive Bayes', '朴素贝叶斯'), T('Logistic regression', '逻辑回归')],
                   [T('Type', '类型'), T('probabilistic **generative**', '概率的**生成式**'), T('probabilistic **discriminative**', '概率的**判别式**')],
                   [T('Models', '建模对象'), r'$P(\mathbf{x}, y) = P(y)\prod_j P(x_j \mid y)$', r'$P(y \mid \mathbf{x})$'],
                   [T('Assumption on features', '对特征的假设'), T('conditional independence given $y$', '给定 $y$ 条件独立'), T('none (log-odds linear in $\\mathbf{x}$)', '无（对数几率对 $\\mathbf{x}$ 线性）')],
                   [T('Fitting', '拟合'), T('counting, closed form', '计数，闭式解'), T('iterative (no closed form)', '迭代（没有闭式解）')],
                   [T('Could generate new data?', '能生成新数据吗？'), T('yes', '能'), T('no', '不能')]),
             details(T('A link between the two (textbook)', '两者之间的联系（教材内容）'),
                     p(T(r"Naive Bayes with binary features also has log-odds linear in $\mathbf{x}$, so its decision boundary is a hyperplane too. The two models are the same *family* of boundaries fitted by different principles: NB maximises the joint likelihood $P(\mathbf{x}, y)$, logistic regression the conditional one $P(y \mid \mathbf{x})$. With little data, NB's strong assumption helps; with a lot, logistic regression usually wins (Ng and Jordan, 2002).",
                         r"带二值特征的朴素贝叶斯，其对数几率同样对 $\mathbf{x}$ 线性，所以它的决策边界也是超平面。两个模型是同一*族*边界，用不同原则拟合：NB 最大化联合似然 $P(\mathbf{x}, y)$，逻辑回归最大化条件似然 $P(y \mid \mathbf{x})$。数据少时 NB 的强假设有帮助；数据多时逻辑回归通常更好（Ng 与 Jordan，2002）。"))),
             quiz(T('Which statement about logistic regression is **false**?', '关于逻辑回归，哪一句是**错**的？'),
                  [(T('It learns the distribution of the features within each class.', '它学习每个类别内部特征的分布。'), True),
                   (T('It assumes the log-odds are a linear function of the features.', '它假设对数几率是特征的线性函数。'), T('That is exactly its modelling assumption, so this statement is true.', '这正是它的建模假设，所以这句话是对的。')),
                   (T('Its decision boundary is a hyperplane.', '它的决策边界是超平面。'), T('True: $\\boldsymbol{\\theta}^\\top \\mathbf{x} = 0$ is a hyperplane.', '对：$\\boldsymbol{\\theta}^\\top \\mathbf{x} = 0$ 是超平面。'))],
                  T('Learning $P(\\mathbf{x} \\mid y)$ is what a *generative* model does. Logistic regression never touches it, so it makes no independence assumption between features.', '学习 $P(\\mathbf{x} \\mid y)$ 是*生成式*模型做的事。逻辑回归从不碰它，所以对特征之间没有独立性假设。'))),

        derive('predict', T('The deck\'s example: income from age, education, hours', '课件的例子：由年龄、学历、工时预测收入'),
               [(r"\boldsymbol{\theta} = (-18,\ 0.12,\ 0.96,\ 0.1)", T(r"The weights given on slide 30: bias, age, education years, hours per week. Label 1 means income $> 50$K.", r"第 30 页给出的权重：偏置、年龄、受教育年数、每周工时。标签 1 表示收入 $> 50$K。")),
                (r"\mathbf{x} = (1,\ 20,\ 10,\ 25)", T(r"The test person: age 20, 10 years of education, 25 hours. The leading 1 is $x_0$, so that $\theta_0$ is the bias.", r"测试对象：20 岁，受教育 10 年，每周 25 小时。开头的 1 是 $x_0$，这样 $\theta_0$ 就是偏置。")),
                (r"z = -18 + 0.12 \cdot 20 + 0.96 \cdot 10 + 0.1 \cdot 25", T(r"The score $z = \boldsymbol{\theta}^\top \mathbf{x}$: each feature times its weight, summed.", r"得分 $z = \boldsymbol{\theta}^\top \mathbf{x}$：每个特征乘以它的权重再求和。")),
                (r"z = -18 + 2.4 + 9.6 + 2.5 = -3.5", T(r"Negative: the model leans to the negative class.", r"为负：模型倾向于负类。")),
                (r"P(y=1 \mid \mathbf{x}) = \sigma(-3.5) = \frac{1}{1 + e^{3.5}} \approx 0.03", T(r"Push the score through the sigmoid. $e^{3.5} \approx 33.1$.", r"把得分送进 sigmoid。$e^{3.5} \approx 33.1$。")),
                (r"0.03 < 0.5 \ \Rightarrow\ \hat{y} = 0\ (\le 50\text{K})", T(r"Below the 0.5 threshold, so predict the negative class. Note that we did not even need the probability: $z < 0$ already says so.", r"低于 0.5 的阈值，所以预测负类。其实不用算概率，$z < 0$ 就已经说明了。"))],
               blank=(3, '-3.5', T(r"Add up the four terms: $-18 + 2.4 + 9.6 + 2.5$.", r"把四项加起来：$-18 + 2.4 + 9.6 + 2.5$。")), skill=LP),

        # -------------------------------------------------------------- training
        read('likelihood', T('Training: choose $\\boldsymbol{\\theta}$ that makes the labels least surprising', '训练：选使标签"最不意外"的 $\\boldsymbol{\\theta}$'),
             p(T(r"The model is fixed up to $\boldsymbol{\theta}$. How do we find it? The principle, as in lecture 4 and for naive Bayes: **maximum likelihood**. Pick $\boldsymbol{\theta}$ under which the labels we actually saw were as probable as possible.",
                 r"模型除 $\boldsymbol{\theta}$ 外都定了。怎么找它？原则和第 4 讲、朴素贝叶斯一样：**最大似然**。选一个 $\boldsymbol{\theta}$，让我们实际看到的标签的概率尽可能大。")),
             p(T(r"For one instance, with $p_i = \sigma(\boldsymbol{\theta}^\top \mathbf{x}^{(i)})$, the probability of its label is $p_i$ if $y^{(i)} = 1$ and $1 - p_i$ if $y^{(i)} = 0$. One formula for both, using that $y$ is 0 or 1:",
                 r"对一个实例，记 $p_i = \sigma(\boldsymbol{\theta}^\top \mathbf{x}^{(i)})$，它的标签的概率：$y^{(i)} = 1$ 时是 $p_i$，$y^{(i)} = 0$ 时是 $1 - p_i$。利用 $y$ 只取 0 或 1，可以写成一个式子：")),
             math_(r"P(y^{(i)} \mid \mathbf{x}^{(i)}; \boldsymbol{\theta}) = p_i^{\,y^{(i)}} \, (1 - p_i)^{\,1 - y^{(i)}}"),
             p(T(r"It works like a switch: when $y = 1$ the second factor is $(\cdot)^0 = 1$ and drops out; when $y = 0$ the first does. The instances are assumed independent, so the likelihood of the whole training set is the product, and we maximise it:",
                 r"它像一个开关：$y = 1$ 时第二个因子是 $(\cdot)^0 = 1$，消失；$y = 0$ 时第一个消失。假设各实例相互独立，整个训练集的似然就是乘积，我们把它最大化：")),
             math_(r"\mathcal{L}(\boldsymbol{\theta}) = \prod_{i=1}^{N} p_i^{\,y^{(i)}} (1 - p_i)^{\,1 - y^{(i)}}"),
             p(T(r"Products of many numbers below 1 underflow on a computer and are awkward to differentiate, so we take the log (it is increasing, so the best $\boldsymbol{\theta}$ does not change) and flip the sign to get something to *minimise*. Next page: the algebra.",
                 r"许多小于 1 的数相乘，计算机会下溢，求导也麻烦。所以取对数（它是递增的，最优 $\boldsymbol{\theta}$ 不变），再变号，得到要*最小化*的量。下一页是代数过程。"))),

        derive('ce', T('Deeper: cross-entropy loss from maximum likelihood', '深入：从最大似然得到交叉熵损失'),
               [(r"\mathcal{L}(\boldsymbol{\theta}) = \prod_{i=1}^{N} p_i^{\,y_i}\,(1-p_i)^{\,1-y_i}", T(r"The likelihood from the last page ($y_i$ short for $y^{(i)}$).", r"上一页的似然（$y_i$ 是 $y^{(i)}$ 的简写）。")),
                (r"\log \mathcal{L}(\boldsymbol{\theta}) = \sum_{i=1}^{N} \log\!\left[ p_i^{\,y_i}(1-p_i)^{\,1-y_i} \right]", T(r"Take the log: the log of a product is the sum of the logs. Because $\log$ is increasing, $\arg\max \mathcal{L} = \arg\max \log\mathcal{L}$.", r"取对数：乘积的对数是对数之和。因为 $\log$ 递增，$\arg\max \mathcal{L} = \arg\max \log\mathcal{L}$。")),
                (r"\log \mathcal{L}(\boldsymbol{\theta}) = \sum_{i=1}^{N} \Big[ y_i \log p_i + (1-y_i)\log(1-p_i) \Big]", T(r"The log of a power brings the exponent down: $\log a^{b} = b \log a$. The switch is now a weight in front of each log.", r"幂的对数把指数拿下来：$\log a^{b} = b \log a$。开关变成了每个对数前面的权重。")),
                (r"J(\boldsymbol{\theta}) = -\sum_{i=1}^{N} \Big[ y_i \log p_i + (1-y_i)\log(1-p_i) \Big]", T(r"Maximising $\log\mathcal{L}$ is the same as minimising its negative. This $J$ is the **negative log-likelihood**, called the **cross-entropy loss** (binary). The deck writes it $-\log\mathcal{L}$.", r"最大化 $\log\mathcal{L}$ 等价于最小化它的相反数。这个 $J$ 是**负对数似然**，叫**交叉熵损失**（二元）。课件里写作 $-\log\mathcal{L}$。")),
                (r"-\big[\,y\log p + (1-y)\log(1-p)\,\big] = -\log p_{y}", T(r"Why *cross-entropy*: it is $H(q, p) = -\sum_k q_k \log p_k$ between the true label distribution $q$ (all mass on the right class) and the model's $(p, 1-p)$. Since $q$ is one-hot, only the true class's term survives: the loss is minus the log of the probability given to the true class, written $p_y$.", r"为什么叫*交叉熵*：它是真实标签分布 $q$（全部概率在正确类别上）与模型分布 $(p, 1-p)$ 之间的 $H(q, p) = -\sum_k q_k \log p_k$。$q$ 是 one-hot，只剩真实类别那一项：损失就是模型给真实类别的概率（记作 $p_y$）的负对数。"))],
               intro=T(r"From the likelihood to the loss, one line at a time.", r"从似然到损失，一行一行来。"),
               outro=T(r"So maximum likelihood and “minimise the cross-entropy” are the same thing. Squared error is the same story for regression: least squares *is* maximum likelihood under Gaussian noise (lecture 7).", r"所以最大似然和“最小化交叉熵”是同一件事。回归里的平方误差是同样的故事：最小二乘就是高斯噪声下的最大似然（第 7 讲）。"), skill=LL),

        read('ce-feel', T('What the loss feels like', '这个损失是什么手感'),
             p(T(r"The loss of one instance is $-\log$ of the probability given to the truth. Natural log here (the exam may give you either; the shape is the same):",
                 r"一个实例的损失是模型给真实类别的概率的 $-\log$。这里用自然对数（考试可能用任何一种底，形状一样）：")),
             table([T('probability given to the true class', '给真实类别的概率'), '0.99', '0.9', '0.5', '0.1', '0.01'],
                   [T('loss $-\\ln p$', '损失 $-\\ln p$'), '0.010', '0.105', '0.693', '2.303', '4.605']),
             p(T(r"Being right and confident costs almost nothing; being unsure costs $\ln 2 = 0.693$; being **confidently wrong grows without bound** ($p \to 0$ gives $\to \infty$). That is the behaviour we want from a probabilistic classifier: a model that says 99% and is wrong is punished far more than one that said 60%.",
                 r"又对又有把握，几乎不付代价；拿不准，付 $\ln 2 = 0.693$；**有把握地错，代价没有上限**（$p \to 0$ 时趋于 $\infty$）。这正是概率分类器该有的行为：说 99% 却错了，比说 60% 错了要重罚得多。")),
             quiz(T('Two models predict $P(y=1) = 0.9$ and $0.6$ for an instance whose true label is $y=0$. Which has the larger cross-entropy loss on it?', '两个模型对一个真实标签为 $y=0$ 的实例分别预测 $P(y=1) = 0.9$ 和 $0.6$。哪个在它上面的交叉熵损失更大？'),
                  [(T('The 0.6 model: it is closer to 0.5.', '0.6 的模型：它更接近 0.5。'), T('The loss is $-\\ln(1 - P(y=1))$: for 0.6 that is $-\\ln 0.4 = 0.916$, smaller than for 0.9 ($-\\ln 0.1 = 2.303$).', '损失是 $-\\ln(1 - P(y=1))$：0.6 时为 $-\\ln 0.4 = 0.916$，比 0.9 时的 $-\\ln 0.1 = 2.303$ 小。')),
                   (T('They are equal: both predict the wrong class.', '一样：两个都预测错了类别。'), T('Cross-entropy looks at the *probability* given to the truth, not just the label. Same mistake, different confidence, different loss.', '交叉熵看的是给真相的*概率*，不只是标签。同样的错、不同的把握，损失不同。')),
                   (T('The 0.9 model: $-\\ln(1-0.9) = 2.303$ against $0.916$.', '0.9 的模型：$-\\ln(1-0.9) = 2.303$，对比 $0.916$。'), True)],
                  T('Confidently wrong is what the loss punishes hardest.', '有把握地错，是这个损失罚得最重的。'))),

        derive('sig-deriv', T('Deeper: the tool for the gradient, $\\sigma\'(z) = \\sigma(z)(1 - \\sigma(z))$', '深入：求梯度要用的工具 $\\sigma\'(z) = \\sigma(z)(1 - \\sigma(z))$'),
               [(r"\sigma(z) = \frac{1}{1 + e^{-z}} = (1 + e^{-z})^{-1}", T("Write the sigmoid as a power so the chain rule applies.", "把 sigmoid 写成幂的形式，好用链式法则。")),
                (r"\sigma'(z) = -(1 + e^{-z})^{-2} \cdot \frac{d}{dz}\left(1 + e^{-z}\right)", T(r"Chain rule: the derivative of $u^{-1}$ is $-u^{-2}$, times the derivative of the inside $u = 1 + e^{-z}$.", r"链式法则：$u^{-1}$ 的导数是 $-u^{-2}$，再乘里面 $u = 1 + e^{-z}$ 的导数。")),
                (r"\sigma'(z) = -(1 + e^{-z})^{-2} \cdot (-e^{-z}) = \frac{e^{-z}}{(1 + e^{-z})^{2}}", T(r"The inside has derivative $-e^{-z}$; the two minus signs cancel.", r"里面的导数是 $-e^{-z}$；两个负号抵消。")),
                (r"\sigma'(z) = \frac{1}{1 + e^{-z}} \cdot \frac{e^{-z}}{1 + e^{-z}}", T("Split the square into two factors.", "把平方拆成两个因子。")),
                (r"\frac{e^{-z}}{1 + e^{-z}} = \frac{(1 + e^{-z}) - 1}{1 + e^{-z}} = 1 - \frac{1}{1 + e^{-z}} = 1 - \sigma(z)", T(r"Rewrite the numerator as $(1 + e^{-z}) - 1$ and split the fraction.", r"把分子写成 $(1 + e^{-z}) - 1$，再拆开分数。")),
                (r"\sigma'(z) = \sigma(z)\,\big(1 - \sigma(z)\big)", T("The derivative is built from the function itself. It is largest ($0.25$) at $z = 0$ and near 0 on the flat ends.", "导数由函数自己构成。它在 $z = 0$ 处最大（$0.25$），在两端的平坦处接近 0。"))],
               intro=T(r"We need this once, for the gradient on the next page.", r"下一页求梯度要用到它，这里一次推完。"), skill=LL),

        derive('grad', T('Deeper: the gradient of the loss, line by line', '深入：损失的梯度，逐行推导'),
               [(r"\ell = -\big[\, y \ln p + (1-y)\ln(1-p) \,\big],\quad p = \sigma(z),\quad z = \boldsymbol{\theta}^\top \mathbf{x}", T(r"Loss of one instance. Three links in a chain: $\theta_j \to z \to p \to \ell$.", r"一个实例的损失。链上有三环：$\theta_j \to z \to p \to \ell$。")),
                (r"\frac{\partial \ell}{\partial \theta_j} = \frac{\partial \ell}{\partial p} \cdot \frac{\partial p}{\partial z} \cdot \frac{\partial z}{\partial \theta_j}", T("Chain rule: multiply the derivative of each link.", "链式法则：把每一环的导数相乘。")),
                (r"\frac{\partial \ell}{\partial p} = -\frac{y}{p} + \frac{1-y}{1-p}", T(r"Differentiate the loss in $p$. The derivative of $\ln p$ is $1/p$; of $\ln(1-p)$ it is $-1/(1-p)$, which flips the sign of the second term.", r"损失对 $p$ 求导。$\ln p$ 的导数是 $1/p$；$\ln(1-p)$ 的导数是 $-1/(1-p)$，使第二项变号。")),
                (r"\frac{\partial p}{\partial z} = p\,(1-p)", T(r"The sigmoid derivative, proved on the previous page.", r"sigmoid 的导数，上一页证明过。")),
                (r"\frac{\partial z}{\partial \theta_j} = x_j", T(r"$z = \theta_0 x_0 + \dots + \theta_j x_j + \dots$ is linear in $\theta_j$ with slope $x_j$.", r"$z = \theta_0 x_0 + \dots + \theta_j x_j + \dots$ 对 $\theta_j$ 是线性的，斜率为 $x_j$。")),
                (r"\left(-\frac{y}{p} + \frac{1-y}{1-p}\right) p\,(1-p) = -y\,(1-p) + (1-y)\,p", T(r"Multiply the first two factors. In each fraction one factor cancels: $p$ in the first, $1-p$ in the second.", r"先乘前两个因子。每个分式约掉一个因子：第一个约掉 $p$，第二个约掉 $1-p$。")),
                (r"-y + yp + p - yp = p - y", T(r"Expand: the two $yp$ terms cancel. **What is left is just the error.**", r"展开：两个 $yp$ 抵消。**剩下的就是误差本身。**")),
                (r"\frac{\partial \ell}{\partial \theta_j} = (p - y)\,x_j = \big(\sigma(\boldsymbol{\theta}^\top \mathbf{x}) - y\big)\,x_j", T(r"Multiply by $\partial z / \partial \theta_j = x_j$.", r"再乘上 $\partial z / \partial \theta_j = x_j$。")),
                (r"\frac{\partial J}{\partial \theta_j} = \sum_{i=1}^{N} \big(\sigma(\boldsymbol{\theta}^\top \mathbf{x}^{(i)}) - y^{(i)}\big)\,x^{(i)}_j", T(r"The loss is a sum over instances, so its gradient is the sum of the per-instance gradients. This is slide 34.", r"损失是对各实例求和，所以它的梯度是各实例梯度之和。这就是第 34 页。"))],
               intro=T(r"One instance first; the sum over the training set comes at the end. Write $p = \sigma(z)$ to keep lines short.", r"先做一个实例，最后再对训练集求和。为了行短，记 $p = \sigma(z)$。"),
               outro=T(r"**Read it as: error times input.** $(p - y)$ is how far the predicted probability is from the label; $x_j$ says how much feature $j$ was involved. It is the same shape as linear regression's gradient, $(\boldsymbol{\theta}^\top \mathbf{x} - y)\,x_j$, with the sigmoid inside the prediction. The sigmoid's slope $p(1-p)$ cancelled exactly, which is the reason cross-entropy and the sigmoid belong together (page on squared error).", r"**读法：误差乘以输入。**$(p - y)$ 是预测概率离标签有多远；$x_j$ 说明特征 $j$ 参与了多少。它和线性回归的梯度 $(\boldsymbol{\theta}^\top \mathbf{x} - y)\,x_j$ 形状一样，只是预测里多了 sigmoid。sigmoid 的斜率 $p(1-p)$ 被恰好约掉了，这正是交叉熵与 sigmoid 该搭配的原因（见“平方误差”一页）。"),
               blank=(6, 'p-y', T(r"Expand $-y(1-p) + (1-y)p$. What is left?", r"展开 $-y(1-p) + (1-y)p$，剩下什么？"), ['p', 'y']), skill=LL),

        read('gd', T('Gradient descent: no closed form, so walk downhill', '梯度下降：没有闭式解，就沿着坡往下走'),
             p(T(r"The recipe from lecture 4: differentiate, set to zero, solve. For a Bernoulli's MLE that gave a clean answer. Here $\sum_i (\sigma(\boldsymbol{\theta}^\top \mathbf{x}^{(i)}) - y^{(i)})\,x_j^{(i)} = 0$ has $\boldsymbol{\theta}$ trapped inside the sigmoids: **no closed-form solution** (like $x e^{x} = 1$). So we improve $\boldsymbol{\theta}$ step by step.",
                 r"第 4 讲的做法：求导、令其为零、解方程。对伯努利的 MLE 这样得到干净的答案。而这里 $\sum_i (\sigma(\boldsymbol{\theta}^\top \mathbf{x}^{(i)}) - y^{(i)})\,x_j^{(i)} = 0$ 里 $\boldsymbol{\theta}$ 困在 sigmoid 里面：**没有闭式解**（和 $x e^{x} = 1$ 一样）。所以只能一步一步改进 $\boldsymbol{\theta}$。")),
             math_(r"\theta_j^{(t+1)} = \theta_j^{(t)} - \eta\, \frac{\partial J}{\partial \theta_j}\Big(\boldsymbol{\theta}^{(t)}\Big) = \theta_j^{(t)} - \eta \sum_{i=1}^{N} \big(\sigma(\boldsymbol{\theta}^{(t)\top} \mathbf{x}^{(i)}) - y^{(i)}\big)\, x_j^{(i)}"),
             p(T(r"The gradient points to the steepest *increase* of $J$, so we step against it. The sign check: if $\partial J / \partial \theta_j < 0$, raising $\theta_j$ lowers $J$, and subtracting a negative number raises $\theta_j$. $\eta > 0$ is the **learning rate**; all parameters are updated together from the same gradient vector. Stop after a fixed number of iterations or when the gradient is tiny.",
                 r"梯度指向 $J$ 增长最快的方向，所以我们逆着它走。验证符号：若 $\partial J / \partial \theta_j < 0$，增大 $\theta_j$ 会使 $J$ 下降，而减去一个负数正好使 $\theta_j$ 增大。$\eta > 0$ 是**学习率**；所有参数用同一个梯度向量同时更新。迭代固定次数后停止，或梯度很小时停止。")),
             h(T('The learning rate, on a toy', '学习率：一个小例子')),
             p(T(r"Minimise $f(\theta) = (\theta - 3)^2$ from $\theta^{(0)} = 0$; here $f' = 2(\theta - 3)$ and each step is $\theta \leftarrow \theta - \eta \cdot 2(\theta - 3)$:",
                 r"从 $\theta^{(0)} = 0$ 出发最小化 $f(\theta) = (\theta - 3)^2$；这里 $f' = 2(\theta - 3)$，每步 $\theta \leftarrow \theta - \eta \cdot 2(\theta - 3)$：")),
             table([T('$\\eta$', '$\\eta$'), '$\\theta^{(1)}$', '$\\theta^{(2)}$', '$\\theta^{(3)}$', '$\\theta^{(4)}$', T('verdict', '结论')],
                   ['0.01', '0.06', '0.119', '0.176', '0.233', T('too small: crawls', '太小：爬得太慢')],
                   ['0.3', '1.8', '2.52', '2.808', '2.923', T('good: converges', '合适：收敛')],
                   ['0.9', '5.4', '1.08', '4.536', '1.771', T('too large: overshoots, bounces', '太大：冲过头，来回跳')],
                   ['1.1', '6.6', '-1.32', '8.184', '-3.221', T('way too large: diverges', '过大：发散')]),
             callout('note', T('What gradient descent guarantees (slide 19)', '梯度下降能保证什么（第 19 页）'),
                     T(r"With a suitable $\eta$: on a differentiable **convex** function it reaches the **global** minimum; on a non-convex one only *a* local minimum. Whether logistic regression's loss is convex decides which of these applies. It is, and that is the next chapter.",
                       r"取合适的 $\eta$：在可微的**凸**函数上它到达**全局**最小值；在非凸函数上只到某个局部最小值。逻辑回归的损失是不是凸的，决定适用哪一条。它是凸的，下一章证明。"))),

        derive('step', T('One gradient step by hand (the deck\'s five people)', '手算一步梯度（课件里的五个人）'),
               [(r"\boldsymbol{\theta}^{(0)} = (-18,\ 0.12,\ 0.96,\ 0.1),\quad \eta = 0.001", T(r"Start from the deck's weights on its five training rows. Use the sum-form gradient of the deck.", r"从课件的权重出发，用它那五行训练数据，取课件的求和形式的梯度。")),
                (r"z = (2.20,\ -3.64,\ 3.48,\ 3.04,\ -0.18)", T(r"Scores $\boldsymbol{\theta}^\top \mathbf{x}$ of persons 1 to 5 (for person 1: $-18 + 0.12 \cdot 31 + 0.96 \cdot 13 + 0.1 \cdot 40$).", r"五个人的得分 $\boldsymbol{\theta}^\top \mathbf{x}$（第 1 人：$-18 + 0.12 \cdot 31 + 0.96 \cdot 13 + 0.1 \cdot 40$）。")),
                (r"p = \sigma(z) = (0.900,\ 0.026,\ 0.970,\ 0.954,\ 0.455)", T("Through the sigmoid.", "过 sigmoid。")),
                (r"p - y = (-0.100,\ 0.026,\ -0.030,\ -0.046,\ 0.455)", T(r"Labels are $y = (1, 0, 1, 1, 0)$. Person 5 is the clear mistake: $p = 0.455$ yet $y = 0$ is nearly a coin flip; the others are mostly right already.", r"标签 $y = (1, 0, 1, 1, 0)$。第 5 人是主要的错误：$p = 0.455$，而 $y = 0$ 几乎是抛硬币；其余的基本已经对了。")),
                (r"\frac{\partial J}{\partial \theta_0} = \sum_i (p_i - y_i) \cdot 1 = 0.305", T(r"Bias: the input is always 1, so the gradient is just the sum of errors.", r"偏置：输入恒为 1，所以梯度就是误差之和。")),
                (r"\frac{\partial J}{\partial \theta_1} = \sum_i (p_i - y_i)\,x_{i1} = 11.51", T(r"Age ($x_{i1}$): each error weighted by that person's age. Person 5 (age 39, error $+0.455$) dominates.", r"年龄（$x_{i1}$）：每个误差乘以该人的年龄。第 5 人（39 岁，误差 $+0.455$）占主导。")),
                (r"\frac{\partial J}{\partial \theta_2} = 2.23, \qquad \frac{\partial J}{\partial \theta_3} = 13.38", T("Education and hours, the same way.", "学历和工时，同样的算法。")),
                (r"\boldsymbol{\theta}^{(1)} = \boldsymbol{\theta}^{(0)} - 0.001\,(0.305,\ 11.51,\ 2.23,\ 13.38)", T("The update: subtract $\\eta$ times the gradient, all four parameters at once.", "更新：减去 $\\eta$ 乘梯度，四个参数同时更新。")),
                (r"\boldsymbol{\theta}^{(1)} = (-18.0003,\ 0.1085,\ 0.9578,\ 0.0866)", T("All weights moved down, since the one big error is a person we over-score. The loss $J$ falls from 0.815 to 0.772.", "所有权重都下调了，因为那一个大误差是被我们打高分的人。损失 $J$ 从 0.815 降到 0.772。"))],
               outro=T(r"With $\eta = 0.01$ the same step would send $J$ **up** to 25.3: the gradient is a *sum* and the features (age, hours) are large, so the step overshoots. That is slide 41’s “feature scaling issues”: standardise the features, or divide the gradient by $N$.", r"如果用 $\eta = 0.01$，同样的一步会让 $J$ **上升**到 25.3：梯度是*求和*，而且特征（年龄、工时）数值大，一步迈过头。这就是第 41 页说的“特征缩放问题”：把特征标准化，或者把梯度除以 $N$。"), skill=LG),

        # -------------------------------------------------------------- deeper: convexity, regularisation, squared error
        derive('convex', T('Deeper: one optimum, because the loss is convex', '深入：损失是凸的，所以只有一个最优点'),
               [(r"\frac{\partial J}{\partial \theta_j} = \sum_i (p_i - y_i)\,x_{ij}", T(r"The gradient from before ($x_{ij}$ is feature $j$ of instance $i$).", r"前面的梯度（$x_{ij}$ 是实例 $i$ 的特征 $j$）。")),
                (r"\frac{\partial p_i}{\partial \theta_k} = p_i(1-p_i)\,x_{ik}", T(r"Differentiate again, with respect to $\theta_k$. Only $p_i$ depends on $\theta$; its derivative is $\sigma'(z_i)\,\partial z_i/\partial\theta_k$. ($y_i$ is a constant and disappears.)", r"再求一次导，对 $\theta_k$。只有 $p_i$ 依赖 $\theta$；它的导数是 $\sigma'(z_i)\,\partial z_i/\partial\theta_k$。（$y_i$ 是常数，消失。）")),
                (r"\frac{\partial^2 J}{\partial \theta_j\, \partial \theta_k} = \sum_i p_i(1-p_i)\,x_{ij}\,x_{ik}", T("This is entry $(j, k)$ of the Hessian, the matrix of second derivatives.", "这是 Hessian（二阶导数矩阵）的第 $(j, k)$ 个元素。")),
                (r"H = \sum_i p_i(1-p_i)\;\mathbf{x}_i \mathbf{x}_i^\top", T(r"In matrix form: a sum of outer products $\mathbf{x}_i\mathbf{x}_i^\top$, each weighted by $p_i(1-p_i) \in (0, \tfrac14]$.", r"矩阵形式：外积 $\mathbf{x}_i\mathbf{x}_i^\top$ 之和，每项乘权重 $p_i(1-p_i) \in (0, \tfrac14]$。")),
                (r"\mathbf{v}^\top H\, \mathbf{v} = \sum_i p_i(1-p_i)\,(\mathbf{v}^\top \mathbf{x}_i)^2", T(r"Test with any direction $\mathbf{v}$: $\mathbf{v}^\top(\mathbf{x}_i\mathbf{x}_i^\top)\mathbf{v} = (\mathbf{v}^\top\mathbf{x}_i)^2$.", r"用任意方向 $\mathbf{v}$ 检验：$\mathbf{v}^\top(\mathbf{x}_i\mathbf{x}_i^\top)\mathbf{v} = (\mathbf{v}^\top\mathbf{x}_i)^2$。")),
                (r"\mathbf{v}^\top H\, \mathbf{v} \ \ge\ 0 \qquad \forall\, \mathbf{v}", T("A positive weight times a square is $\\ge 0$, and so is a sum of them. A Hessian with this property is *positive semi-definite*: the surface curves up (or is flat) in every direction.", "正的权重乘以平方是 $\\ge 0$，它们的和也是。具有这个性质的 Hessian 是*半正定*的：曲面在每个方向上都向上弯（或平）。")),
                (r"\nabla^2 J \succeq 0", T("So $J$ is convex: there is no local minimum that is not global: every stationary point is a global minimum, and gradient descent with a suitable $\\eta$ cannot get stuck.", "所以 $J$ 是凸的：不存在不是全局的局部最小：每个驻点都是全局最小，取合适的 $\\eta$ 时梯度下降不会卡住。"))],
               intro=T(r"We claimed gradient descent finds the global minimum. Prove the loss is convex by showing its Hessian is positive semi-definite.", r"前面说梯度下降能找到全局最小值。通过证明 Hessian 半正定来证明损失是凸的。"),
               outro=T(r"Two caveats. If the two classes can be **perfectly separated** by a hyperplane, the loss can always be lowered by scaling $\boldsymbol{\theta}$ up (making the probabilities more extreme), so there is no finite minimiser: $\|\boldsymbol{\theta}\| \to \infty$. And the minimiser is unique only if the features are not redundant. Both are cured by the next page.", r"两点保留。若两类可以被一个超平面**完全分开**，把 $\boldsymbol{\theta}$ 放大（让概率更极端）总能使损失更低，所以没有有限的最小点：$\|\boldsymbol{\theta}\| \to \infty$。而且只有特征不冗余时最小点才唯一。这两个问题都由下一页解决。"), skill=LC),

        read('reg', T('Regularisation: keeping the weights honest', '正则化：管住权重'),
             p(T(r"The deck calls regularisation “a nuisance, but important since overfitting can be a big problem”. Why it matters here: with many features, or separable classes, the fit can drive weights to huge values and probabilities to exactly 0 and 1. The training loss looks perfect, test behaviour is not.",
                 r"课件说正则化“麻烦，但很重要，因为过拟合可能很严重”。这里为什么重要：特征很多或两类可分时，拟合会把权重推到极大值、概率推到恰好 0 和 1。训练损失看起来完美，测试表现却不然。")),
             math_(r"J_{\lambda}(\boldsymbol{\theta}) = -\sum_{i=1}^{N}\Big[ y_i \log p_i + (1-y_i)\log(1-p_i)\Big] + \frac{\lambda}{2}\sum_{j=1}^{F} \theta_j^{2}"),
             ul(T(r"The new term charges for large weights. $\lambda \ge 0$ sets the price: $\lambda = 0$ is plain logistic regression, large $\lambda$ shrinks all weights towards 0 (underfits).", r"新增的项对大权重收费。$\lambda \ge 0$ 是价格：$\lambda = 0$ 是普通逻辑回归，$\lambda$ 大则所有权重缩向 0（欠拟合）。"),
                T(r"The gradient just gains $+\lambda\theta_j$, so each step also shrinks $\theta_j$ a little (“weight decay”). The bias $\theta_0$ is usually not penalised.", r"梯度只多出 $+\lambda\theta_j$，所以每一步都会把 $\theta_j$ 缩小一点（“权重衰减”）。偏置 $\theta_0$ 通常不惩罚。"),
                T(r"It also restores a finite, unique optimum on separable data (the penalty grows as $\|\boldsymbol{\theta}\|$ does).", r"它还使可分数据上的最优点重新有限且唯一（权重变大时惩罚也变大）。"),
                T(r"Penalising $\sum|\theta_j|$ instead ($L_1$) sets many weights exactly to 0: a built-in feature selector (lecture 12). $\lambda$ is chosen by cross-validation.", r"改罚 $\sum|\theta_j|$（$L_1$）会使许多权重恰好为 0：自带的特征选择（第 12 讲）。$\lambda$ 用交叉验证来选。"))),

        read('squared', T('Deeper: why not squared error with a sigmoid?', '深入：为什么不在 sigmoid 上用平方误差？'),
             p(T(r"Regression's habit would be to keep squared error, $\tfrac12(p - y)^2$, and just put the sigmoid inside $p$. It runs, but it is the wrong partner, for two reasons that the chain rule shows at once.",
                 r"回归的习惯是保留平方误差 $\tfrac12(p - y)^2$，把 sigmoid 放进 $p$ 里。它能跑，但搭配不对，原因有两个，链式法则一眼就能看出来。")),
             svg(drawn(fig_loss_vs_z), T('Loss against the score z for a positive example: cross-entropy keeps rising for confident mistakes, squared error flattens at 1.', '正例的损失随得分 z 变化：交叉熵对有把握的错误持续上升，平方误差在 1 处变平。')),
             p(T(r"**1. Vanishing gradient.** With squared error the gradient has the extra factor $p(1-p)$ from $\sigma'$:",
                 r"**1. 梯度消失。**用平方误差时，梯度里多了来自 $\sigma'$ 的因子 $p(1-p)$：")),
             math_(r"\frac{\partial}{\partial\theta_j}\tfrac12 (p-y)^2 = (p - y)\,\underline{p(1-p)}\,x_j \qquad\text{vs.}\qquad \frac{\partial \ell}{\partial\theta_j} = (p - y)\,x_j"),
             p(T(r"Take $y = 1$ and a badly wrong score $z = -6$, so $p = 0.0025$. The cross-entropy factor is $p - y = -0.9975$: a strong push. With squared error it is $-0.9975 \times 0.0025 \times 0.9975 = -0.0025$: **400 times weaker**, exactly when the model is most wrong. Learning stalls on the flat part of the curve.",
                 r"取 $y = 1$ 和一个错得很离谱的得分 $z = -6$，则 $p = 0.0025$。交叉熵的因子是 $p - y = -0.9975$：推力很强。平方误差则是 $-0.9975 \times 0.0025 \times 0.9975 = -0.0025$：**弱了 400 倍**，而且恰好是模型错得最厉害的时候。在曲线的平坦处，学习停滞了。")),
             p(T(r"**2. Not convex.** Composing a convex loss with a sigmoid does not stay convex: the loss curve above has a flat shoulder and bends the wrong way, so $J$ can have plateaus and (for several parameters) local minima, and the guarantee of the convexity page is lost. Cross-entropy was derived from maximum likelihood, and its gradient is the clean error $(p - y)\,x_j$ because $\log$ undoes the sigmoid's exponential. That is why the two go together.",
                 r"**2. 不是凸的。**凸损失与 sigmoid 复合后不再是凸的：上图的损失曲线有一段平台，并且弯向错的方向，所以 $J$ 可能有平台和（参数多时）局部最小，凸性那一页的保证就没了。交叉熵来自最大似然，它的梯度是干净的误差 $(p - y)\,x_j$，因为 $\log$ 抵消了 sigmoid 里的指数。这就是它们该搭配的原因。"))),

        # -------------------------------------------------------------- more than two classes
        read('multi', T('More than two classes: one-vs-rest and softmax', '多于两类：一对多与 softmax'),
             p(T(r"Logistic regression is a binary classifier. Two ways to use it with $K$ classes (slides 36-37):", r"逻辑回归是二分类器。有 $K$ 个类别时有两种用法（第 36-37 页）：")),
             table(['', T('One-vs-rest (one-vs-all)', '一对多（one-vs-rest）'), T('Softmax (multinomial)', 'Softmax（多项逻辑回归）')],
                   [T('Idea', '思路'), T('train $K$ separate binary classifiers: class $k$ against everything else', '训练 $K$ 个独立的二分类器：类别 $k$ 对其余所有'), T('one model, $K$ weight vectors fitted jointly', '一个模型，$K$ 个权重向量联合拟合')],
                   [T('Predict', '预测'), T('the class whose classifier gives the highest score', '分类器得分最高的类别'), r'$\arg\max_k \boldsymbol{\theta}_k^\top \mathbf{x}$'],
                   [T('Outputs', '输出'), T('$K$ numbers that need not add to 1', '$K$ 个不一定和为 1 的数'), T('a proper distribution over the $K$ classes', '$K$ 个类别上的一个真正的分布')],
                   [T('Catch', '问题'), T('"rest" is a mix and may be imbalanced', '"其余"是混合体，可能很不平衡'), T('all classes trained together, one loss', '所有类别一起训练，一个损失')]),
             math_(r"P(y = k \mid \mathbf{x}) = \frac{e^{\boldsymbol{\theta}_k^\top \mathbf{x}}}{\sum_{m=1}^{K} e^{\boldsymbol{\theta}_m^\top \mathbf{x}}}"),
             p(T(r"Softmax does for $K$ scores what the sigmoid does for one: exponentiate each score (so it is positive) and divide by the total (so they add to 1). Bigger score, bigger share; the arg max of the probabilities is the arg max of the scores, so the class regions are still cut by linear boundaries. The loss is again $-\log P(y = \text{true class} \mid \mathbf{x})$.",
                 r"softmax 对 $K$ 个得分做的事，就是 sigmoid 对一个得分做的事：各自取指数（保证为正），再除以总和（保证和为 1）。得分大，份额大；概率的最大者就是得分的最大者，所以类别区域仍由线性边界切分。损失仍然是 $-\log P(y = \text{真实类别} \mid \mathbf{x})$。")),
             details(T('Deeper: two classes is the sigmoid; and the gradient is again error times input', '再深一点：两类时就是 sigmoid；梯度还是误差乘以输入'),
                     math_(r"\frac{e^{z_1}}{e^{z_1} + e^{z_0}} = \frac{1}{1 + e^{-(z_1 - z_0)}} = \sigma(z_1 - z_0)"),
                     p(T(r"Divide top and bottom by $e^{z_1}$: with $K=2$ softmax is the sigmoid of the *difference* of the scores, so binary logistic regression is the special case with $\boldsymbol{\theta} = \boldsymbol{\theta}_1 - \boldsymbol{\theta}_0$. For the softmax cross-entropy the same chain-rule algebra gives",
                         r"分子分母同除以 $e^{z_1}$：$K=2$ 时 softmax 就是得分*之差*的 sigmoid，所以二元逻辑回归是 $\boldsymbol{\theta} = \boldsymbol{\theta}_1 - \boldsymbol{\theta}_0$ 的特例。对 softmax 交叉熵，同样的链式法则代数给出")),
                     math_(r"\frac{\partial \ell}{\partial \boldsymbol{\theta}_k} = \big(P(y=k \mid \mathbf{x}) - \mathbb{1}[y = k]\big)\,\mathbf{x}"),
                     p(T(r"one error per class: predicted probability minus one-hot truth. (Adding the same vector to every $\boldsymbol{\theta}_k$ leaves all probabilities unchanged, so one set of weights is redundant.)",
                         r"每个类别一个误差：预测概率减去 one-hot 真值。（给每个 $\boldsymbol{\theta}_k$ 加上同一个向量，所有概率不变，所以有一组权重是多余的。）")))),

        derive('softmax-ex', T('The deck\'s softmax example: three classes', '课件的 softmax 例子：三个类别'),
               [(r"\mathbf{x} = (1,\ 1,\ 2)", T(r"Features $x_1 = 1$, $x_2 = 2$, with the bias input $x_0 = 1$ in front. Weights: $\boldsymbol{\theta}_A = (0.1, 0.5, -0.2)$, $\boldsymbol{\theta}_B = (-0.1, -0.3, 0.4)$, $\boldsymbol{\theta}_C = (0, 0.1, 0.2)$.", r"特征 $x_1 = 1$、$x_2 = 2$，前面加上偏置输入 $x_0 = 1$。权重：$\boldsymbol{\theta}_A = (0.1, 0.5, -0.2)$，$\boldsymbol{\theta}_B = (-0.1, -0.3, 0.4)$，$\boldsymbol{\theta}_C = (0, 0.1, 0.2)$。")),
                (r"z_A = 0.1 + 0.5 - 0.4 = 0.2,\quad z_B = -0.1 - 0.3 + 0.8 = 0.4,\quad z_C = 0 + 0.1 + 0.4 = 0.5", T("Step 1: one score (logit) per class, $\\boldsymbol{\\theta}_k^\\top \\mathbf{x}$.", "第 1 步：每个类别一个得分（logit）$\\boldsymbol{\\theta}_k^\\top \\mathbf{x}$。")),
                (r"e^{0.2} = 1.221,\quad e^{0.4} = 1.492,\quad e^{0.5} = 1.649", T("Step 2: exponentiate each score.", "第 2 步：对每个得分取指数。")),
                (r"1.221 + 1.492 + 1.649 = 4.362", T("Step 3: the normaliser, the sum of the exponentials.", "第 3 步：归一化常数，即指数之和。")),
                (r"P(A) = \frac{1.221}{4.362} = 0.280,\quad P(B) = \frac{1.492}{4.362} = 0.342,\quad P(C) = \frac{1.649}{4.362} = 0.378", T("Step 4: divide. The three add to 1.", "第 4 步：相除。三个数加起来为 1。")),
                (r"\hat{y} = \arg\max_k P(k \mid \mathbf{x}) = C", T("The highest probability is class C (as is the highest score, 0.5). The probabilities are close: the model is not very sure.", "概率最高的是类别 C（得分最高的也是 0.5）。几个概率很接近：模型并不很有把握。"))],
               blank=(3, '4.362', T(r"Add $e^{0.2} + e^{0.4} + e^{0.5} = 1.221 + 1.492 + 1.649$.", r"求和 $e^{0.2} + e^{0.4} + e^{0.5} = 1.221 + 1.492 + 1.649$。")), skill=LK),

        # -------------------------------------------------------------- judging it
        read('procon', T('Strengths, weaknesses, and when to pick it', '优缺点，以及什么时候选它'),
             table([T('Pros (slide 41)', '优点（第 41 页）'), T('Why', '原因')],
                   [T('Probabilistic interpretation', '有概率解释'), T('outputs $P(y \\mid \\mathbf{x})$: confidence, thresholds that suit costs, ranking', '输出 $P(y \\mid \\mathbf{x})$：有置信度，可按代价调阈值，可排序')],
                   [T('No restrictive assumptions on features', '对特征没有苛刻的假设'), T('no conditional independence, correlated features are fine (unlike NB)', '不要求条件独立，特征相关也没问题（不像 NB）')],
                   [T('Often beats naive Bayes', '常常胜过朴素贝叶斯'), T('with enough data, discriminative training reaches a lower error', '数据足够时，判别式训练能达到更低的误差')],
                   [T('Suited to frequency-based features', '适合基于频次的特征'), T('e.g. word counts in text classification', '例如文本分类里的词频')],
                   [T('Convex loss', '损失是凸的'), T('one optimum; gradient descent will find it', '只有一个最优点；梯度下降一定能找到')]),
             table([T('Cons (slide 41)', '缺点（第 41 页）'), T('Why', '原因')],
                   [T('Only linear feature-label relationships', '只能学线性关系'), T('the boundary is a hyperplane; XOR-type structure needs feature engineering or a non-linear model', '边界是超平面；XOR 型结构需要构造特征或用非线性模型')],
                   [T('Feature scaling issues', '特征缩放问题'), T('features on very different scales make gradient descent slow or unstable (see the step above)', '特征量纲差别大会让梯度下降变慢或不稳（见上面那一步）')],
                   [T('Needs a lot of data', '需要较多数据'), T('many parameters estimated by iteration; with little data NB can do better', '参数多、靠迭代估计；数据少时 NB 可能更好')],
                   [T('Regularisation needed', '需要正则化'), T('overfits easily with many features or separable classes', '特征多或两类可分时容易过拟合')]),
             quiz(T('Which dataset is the **worst** fit for plain logistic regression?', '哪个数据集最**不适合**用普通逻辑回归？'),
                  [(T('Spam detection with 10 000 word-count features and 100 000 emails.', '垃圾邮件检测：1 万个词频特征、10 万封邮件。'), T('This is what it is good at: frequency features and lots of data.', '这是它擅长的：频次特征加大量数据。')),
                   (T('Two classes that are one inside the other, like a disc and a ring.', '两个类别一个套在另一个里面，像圆盘和圆环。'), True),
                   (T('Predicting a patient\'s risk from correlated lab values.', '由相关的化验值预测患者风险。'), T('Correlated features are fine: it makes no independence assumption.', '特征相关没问题：它没有独立性假设。'))],
                  T('No straight line separates a disc from the ring around it. Adding squared features would fix it, but the plain model cannot.', '没有一条直线能把圆盘和外面的圆环分开。加上平方特征可以解决，但普通模型做不到。'))),

        # -------------------------------------------------------------- exam practice
        number('q-prob', T('Practice: a prediction', '练习：做一个预测'), LP,
               T(r"With the deck's weights $\boldsymbol{\theta} = (-18, 0.12, 0.96, 0.1)$ (bias, age, education years, hours per week), a person is 45 years old, has 11 years of education and works 30 hours a week. Compute $P(y = 1 \mid \mathbf{x})$ (answer to 2 decimal places).",
                 r"用课件的权重 $\boldsymbol{\theta} = (-18, 0.12, 0.96, 0.1)$（偏置、年龄、受教育年数、每周工时），一个人 45 岁、受教育 11 年、每周工作 30 小时。计算 $P(y = 1 \mid \mathbf{x})$（保留两位小数）。"),
               0.72, T(r"$z = -18 + 0.12 \cdot 45 + 0.96 \cdot 11 + 0.1 \cdot 30 = -18 + 5.4 + 10.56 + 3 = 0.96$, so $P = \sigma(0.96) = 1/(1 + e^{-0.96}) = 0.723$. Above 0.5: predict $>50$K.", r"$z = -18 + 0.12 \cdot 45 + 0.96 \cdot 11 + 0.1 \cdot 30 = -18 + 5.4 + 10.56 + 3 = 0.96$，所以 $P = \sigma(0.96) = 1/(1 + e^{-0.96}) = 0.723$。大于 0.5：预测 $>50$K。"),
               tolerance=0.01, hints=(T('First the score $z = \\boldsymbol{\\theta}^\\top \\mathbf{x}$ with $x_0 = 1$; then the sigmoid.', '先算得分 $z = \\boldsymbol{\\theta}^\\top \\mathbf{x}$，$x_0 = 1$；再过 sigmoid。'),)),

        number('q-update', T('Practice: one update', '练习：一次更新'), LG,
               T(r"A one-feature model has $\theta_0 = -1$, $\theta_1 = 0.5$. One training instance has $x_1 = 4$ and $y = 0$. Do one gradient-descent update with learning rate $\eta = 0.5$ on this single instance (loss gradient $(\sigma(z) - y)\,x_j$, with $x_0 = 1$). What is the new $\theta_1$? (2 decimal places)",
                 r"一个单特征模型 $\theta_0 = -1$，$\theta_1 = 0.5$。一个训练实例 $x_1 = 4$、$y = 0$。只用这个实例做一次梯度下降更新，学习率 $\eta = 0.5$（损失梯度 $(\sigma(z) - y)\,x_j$，$x_0 = 1$）。新的 $\theta_1$ 是多少？（两位小数）"),
               -0.96, T(r"$z = -1 + 0.5 \cdot 4 = 1$, $\sigma(1) = 0.731$. Error $= 0.731 - 0 = 0.731$. $\theta_1 \leftarrow 0.5 - 0.5 \cdot 0.731 \cdot 4 = 0.5 - 1.462 = -0.962$. (And $\theta_0 \leftarrow -1 - 0.5 \cdot 0.731 = -1.366$.) The model said 73% for a negative example, so both weights go down.", r"$z = -1 + 0.5 \cdot 4 = 1$，$\sigma(1) = 0.731$。误差 $= 0.731 - 0 = 0.731$。$\theta_1 \leftarrow 0.5 - 0.5 \cdot 0.731 \cdot 4 = 0.5 - 1.462 = -0.962$。（同时 $\theta_0 \leftarrow -1 - 0.5 \cdot 0.731 = -1.366$。）模型对一个负例给了 73%，所以两个权重都下调。"),
               tolerance=0.02),

        choice('q-mse', T('Practice: loss choice', '练习：损失的选择'), LL,
               T('A classmate trains logistic regression by minimising squared error $\\sum_i (\\sigma(\\boldsymbol{\\theta}^\\top \\mathbf{x}_i) - y_i)^2$ instead of cross-entropy. What is the main problem?', '一位同学用平方误差 $\\sum_i (\\sigma(\\boldsymbol{\\theta}^\\top \\mathbf{x}_i) - y_i)^2$ 代替交叉熵来训练逻辑回归。主要问题是什么？'),
               [(T('The loss is no longer convex and its gradient vanishes where the sigmoid is flat, so confident mistakes learn very slowly.', '损失不再是凸的，而且在 sigmoid 平坦处梯度消失，所以有把握的错误学得很慢。'), True),
                (T('Squared error cannot be computed when the labels are 0 and 1.', '标签是 0 和 1 时没法计算平方误差。'), T('It can: it is just $(p - y)^2$. The problem is how it behaves, not whether it is defined.', '可以：就是 $(p - y)^2$。问题在它的性质，不在能不能定义。'), 'mse-ok'),
                (T('It is convex but slower, so a bigger learning rate fixes it.', '它是凸的，只是慢一点，把学习率调大就行。'), T('With the sigmoid inside it is not convex, and a bigger $\\eta$ does not restore a gradient that is nearly zero.', 'sigmoid 在里面时它不是凸的，而且调大 $\\eta$ 也救不回几乎为零的梯度。'), 'mse-ok'),
                (T('It is not a likelihood, so the probabilities come out negative.', '它不是似然，所以概率会变成负数。'), T('The outputs are still $\\sigma(\\cdot) \\in (0, 1)$ whatever the loss. The loss only changes how $\\boldsymbol{\\theta}$ is chosen.', '不管用什么损失，输出仍是 $\\sigma(\\cdot) \\in (0, 1)$。损失只改变 $\\boldsymbol{\\theta}$ 怎么选。'))],
               T('The cross-entropy gradient is $(p - y)\\,x_j$; squared error adds the factor $p(1-p)$, which is almost 0 on the flat ends exactly when the model is confidently wrong.', '交叉熵的梯度是 $(p - y)\\,x_j$；平方误差多了因子 $p(1-p)$，在平坦的两端几乎为 0，而那正是模型有把握地错的时候。'), purpose='check'),

        text_q('q-disc', T('Section A style: place it on the map', 'A 部分题型：把它放到图上'), LV,
               T('In two or three sentences: why is logistic regression called a *probabilistic discriminative* model? Name one practical difference from naive Bayes.', '用两三句话说明：逻辑回归为什么叫*概率的判别式*模型？说出它与朴素贝叶斯的一个实际区别。'),
               [T('probabilistic: outputs P(y|x) via the sigmoid, fitted by maximum likelihood', '概率的：通过 sigmoid 输出 P(y|x)，用最大似然拟合'),
                T('discriminative: models P(y|x) directly, not P(x|y) or P(x,y)', '判别式：直接建模 P(y|x)，不是 P(x|y) 或 P(x,y)'),
                T('difference: no conditional independence assumption (NB has one); or iterative training vs counting', '区别：没有条件独立假设（NB 有）；或迭代训练 vs 计数')],
               T('Logistic regression is probabilistic because it outputs a distribution P(y|x) = sigmoid(theta^T x) and is trained by maximum likelihood (minimising cross-entropy). It is discriminative because it models P(y|x) directly instead of P(x|y) or the joint P(x,y), so it learns only the boundary between classes and cannot generate data. Unlike naive Bayes it makes no conditional independence assumption between features, so correlated features are not double counted; the price is iterative training (no closed form).',
                 'Logistic regression is probabilistic because it outputs a distribution P(y|x) = sigmoid(theta^T x) and is trained by maximum likelihood (minimising cross-entropy). It is discriminative because it models P(y|x) directly instead of P(x|y) or the joint P(x,y), so it learns only the boundary between classes and cannot generate data. Unlike naive Bayes it makes no conditional independence assumption between features, so correlated features are not double counted; the price is iterative training (no closed form).'),
               T('Probabilistic = a distribution out and likelihood in. Discriminative = $P(y \\mid \\mathbf{x})$ only. The contrast with generative NB is the standard follow-up.', '概率的 = 输出分布、用似然训练。判别式 = 只建模 $P(y \\mid \\mathbf{x})$。与生成式 NB 的对比是标准的追问。')),

        text_q('q-design', T('Section C style: choose and defend', 'C 部分题型：选择并论证'), LV,
               T('A clinic has 60 labelled patients, 25 correlated numeric measurements each, and wants to predict a disease (yes/no) and report how confident it is. A colleague proposes logistic regression. Say what you would check or change before training, and how you would choose the decision threshold. About a third of a page.', '一家诊所有 60 名带标签的患者，每人 25 个相互相关的数值测量，要预测是否患病并报告把握有多大。同事建议用逻辑回归。说明训练前你会检查或改动什么，以及怎么选决策阈值。大约三分之一页。'),
               [T('few data, many features: overfitting risk, so regularise (L2/L1) and choose lambda by cross-validation', '数据少特征多：有过拟合风险，所以正则化（L2/L1），用交叉验证选 lambda'),
                T('standardise features (scaling) so gradient descent behaves', '特征标准化，让梯度下降表现正常'),
                T('correlated features are fine for LR (no independence assumption) but weights unstable; regularisation helps', '特征相关对 LR 没问题（无独立性假设），但权重不稳；正则化有帮助'),
                T('threshold: not necessarily 0.5; pick by the cost of false negatives vs false positives, evaluated on held-out data; check calibration', '阈值：不一定是 0.5；按假阴性与假阳性的代价选，在留出数据上评估；检查校准')],
               T('Logistic regression is reasonable: it gives probabilities and does not need independent features. With only 60 instances and 25 correlated features it will overfit, so I would standardise the features, add L2 (or L1 for selection) regularisation and pick lambda by cross-validation, and compare with a simpler baseline such as naive Bayes. The default 0.5 threshold is not sacred: a missed disease is usually costlier than a false alarm, so I would choose the threshold on held-out data from the false-negative and false-positive costs (e.g. predict disease when P > 0.2), and check that the predicted probabilities are calibrated.',
                 'Logistic regression is reasonable: it gives probabilities and does not need independent features. With only 60 instances and 25 correlated features it will overfit, so I would standardise the features, add L2 (or L1 for selection) regularisation and pick lambda by cross-validation, and compare with a simpler baseline such as naive Bayes. The default 0.5 threshold is not sacred: a missed disease is usually costlier than a false alarm, so I would choose the threshold on held-out data from the false-negative and false-positive costs (e.g. predict disease when P > 0.2), and check that the predicted probabilities are calibrated.'),
               T('A good Section C answer ties each choice to a property of the data: few rows, many correlated columns, a need for probabilities, unequal costs.', '好的 C 部分答案把每个选择都与数据的性质挂钩：行少、相关列多、需要概率、代价不对称。')),

        read('remember', T('What to remember: logistic regression', '要记住的：逻辑回归'),
             table([T('Item', '内容'), T('Formula or fact', '公式或要点')],
                   [T('model', '模型'), r'$P(y=1 \mid \mathbf{x}) = \sigma(\boldsymbol{\theta}^\top \mathbf{x}) = \dfrac{1}{1 + e^{-\boldsymbol{\theta}^\top \mathbf{x}}}$, $\ P(y=0 \mid \mathbf{x}) = 1 - \sigma(\boldsymbol{\theta}^\top \mathbf{x})$'],
                   [T('assumption', '假设'), T(r'$\log\dfrac{P(y=1)}{1-P(y=1)} = \boldsymbol{\theta}^\top \mathbf{x}$ (log-odds linear)', r'$\log\dfrac{P(y=1)}{1-P(y=1)} = \boldsymbol{\theta}^\top \mathbf{x}$（对数几率线性）')],
                   [T('boundary', '边界'), T('predict 1 iff $P > 0.5$ iff $\\boldsymbol{\\theta}^\\top \\mathbf{x} > 0$: a hyperplane', '预测 1 当且仅当 $P > 0.5$ 当且仅当 $\\boldsymbol{\\theta}^\\top \\mathbf{x} > 0$：超平面')],
                   [T('type', '类型'), T('probabilistic, discriminative, linear, parametric; no independence assumption', '概率的、判别式、线性、参数化；无独立性假设')],
                   [T('likelihood', '似然'), r'$\mathcal{L} = \prod_i p_i^{y_i}(1-p_i)^{1-y_i}$'],
                   [T('loss', '损失'), T(r'$J = -\sum_i [\,y_i \log p_i + (1-y_i)\log(1-p_i)\,]$ (cross-entropy = negative log-likelihood)', r'$J = -\sum_i [\,y_i \log p_i + (1-y_i)\log(1-p_i)\,]$（交叉熵 = 负对数似然）')],
                   [T('gradient', '梯度'), T(r'$\partial J / \partial\theta_j = \sum_i (\sigma(\boldsymbol{\theta}^\top \mathbf{x}_i) - y_i)\,x_{ij}$ (error times input), using $\sigma^{\prime} = \sigma(1-\sigma)$', r'$\partial J / \partial\theta_j = \sum_i (\sigma(\boldsymbol{\theta}^\top \mathbf{x}_i) - y_i)\,x_{ij}$（误差乘以输入），用到 $\sigma^{\prime} = \sigma(1-\sigma)$')],
                   [T('update', '更新'), T(r'$\theta_j \leftarrow \theta_j - \eta\,\partial J/\partial\theta_j$; $\eta$ too small: slow, too large: diverges', r'$\theta_j \leftarrow \theta_j - \eta\,\partial J/\partial\theta_j$；$\eta$ 太小：慢，太大：发散')],
                   [T('convex', '凸性'), T('Hessian $\\sum p(1-p)\\mathbf{x}\\mathbf{x}^\\top \\succeq 0$: one optimum; separable data: weights $\\to \\infty$, so regularise', 'Hessian $\\sum p(1-p)\\mathbf{x}\\mathbf{x}^\\top \\succeq 0$：只有一个最优点；可分数据：权重 $\\to \\infty$，所以要正则化')],
                   [T('multiclass', '多类'), T(r'one-vs-rest, or softmax $e^{z_k}/\sum_m e^{z_m}$ with loss $-\log p_y$', r'一对多，或 softmax $e^{z_k}/\sum_m e^{z_m}$，损失 $-\log p_y$')],
                   [T('vs NB', '对比 NB'), T('NB: generative, closed form, independence assumption, better with little data; LR: discriminative, iterative, better with lots of data', 'NB：生成式、闭式解、有独立性假设，数据少时更好；LR：判别式、迭代，数据多时更好')],
                   [T('pros/cons', '优缺点'), T('probabilities, few assumptions / linear only, scaling, needs data, needs regularisation', '有概率、假设少 / 只能线性、要缩放、要数据、要正则化')])),
    ]
    return dict(
        id=lid('logreg'), title=T('Logistic regression', '逻辑回归'),
        description=T('From a probability to the sigmoid, the cross-entropy loss from maximum likelihood, its gradient line by line, why it is convex, and why not squared error.', '从概率到 sigmoid，由最大似然得到交叉熵损失，逐行推出它的梯度，为什么它是凸的，以及为什么不用平方误差。'),
        minutes=45,
        skills=[{'id': LM, 'name': T('Odds, log-odds and the sigmoid', '几率、对数几率与 sigmoid')},
                {'id': LP, 'name': T('The model, boundary and prediction', '模型、边界与预测')},
                {'id': LL, 'name': T('Likelihood, cross-entropy and its gradient', '似然、交叉熵与它的梯度')},
                {'id': LG, 'name': T('Gradient descent and the learning rate', '梯度下降与学习率')},
                {'id': LC, 'name': T('Convexity of the loss', '损失的凸性')},
                {'id': LK, 'name': T('Multiclass: one-vs-rest and softmax', '多类：一对多与 softmax')},
                {'id': LV, 'name': T('Logistic regression compared with other models', '逻辑回归与其他模型的比较')}],
        misconceptions=[{'id': 'mse-ok', 'description': T('Believing squared error is as good a loss for logistic regression as cross-entropy', '认为平方误差和交叉熵一样适合逻辑回归')},
                        {'id': 'lr-generative', 'description': T('Calling logistic regression generative, or thinking it models how the features are distributed', '把逻辑回归说成生成式，或以为它建模了特征的分布')},
                        {'id': 'boundary-curved', 'description': T('Thinking the decision boundary is curved because the probability curve is', '因为概率曲线是弯的，就以为决策边界也是弯的')},
                        {'id': 'prob-from-line', 'description': T('Reading the linear score $\\boldsymbol{\\theta}^\\top \\mathbf{x}$ as the probability', '把线性得分 $\\boldsymbol{\\theta}^\\top \\mathbf{x}$ 直接当作概率')}],
        steps=steps)


# ------------------------------------------------------------------ SVM: numbers and figures
# the hand-solved example of the lesson: the support vectors are (3,3) (+) and (1,1) (-), w = (0.5, 0.5), b = -2
SV_POS = [(3, 3), (4, 5), (5, 3.5), (2, 4.5)]
SV_NEG = [(1, 1), (0, 1), (1.5, -0.5), (-0.5, 1.5)]
SV_W, SV_B = (0.5, 0.5), -2.0


def dot(a, b):
    return sum(x * y for x, y in zip(a, b))


def svm_f(w, b, x):
    return dot(w, x) + b


# soft-margin example (solved once with a QP solver; the numbers are w and b of the solutions for three values of C)
SOFT_P = [(1.0, 5.0), (1.5, 3.8), (2.0, 4.6), (2.6, 3.5), (3.0, 5.2), (2.2, 2.6), (3.4, 2.5)]
SOFT_N = [(4.0, 1.2), (5.0, 2.0), (4.6, 3.2), (5.6, 0.8), (6.0, 2.6), (3.4, 1.4), (2.6, 3.0)]
SOFT_SOL = {100: ((-1.0, 0.666), 1.467), 1: ((-0.909, 0.606), 1.244), 0.1: ((-0.378, 0.406), 0.027)}


class Pane:
    """A data rectangle drawn inside a Fig (ox, oy, w, h in figure units; xr, yr the data ranges)."""

    def __init__(self, fig, ox, oy, w, h, xr, yr):
        self.f, self.ox, self.oy, self.w, self.h, self.xr, self.yr = fig, ox, oy, w, h, xr, yr
        fig.rect(ox, oy, w, h, '#ffffff', LINE, 1.2, 4)

    def X(self, x): return self.ox + (x - self.xr[0]) / (self.xr[1] - self.xr[0]) * self.w
    def Y(self, y): return self.oy + self.h - (y - self.yr[0]) / (self.yr[1] - self.yr[0]) * self.h

    def clip(self, w, b, level):
        """The two ends of the line w.x + b = level inside the data rectangle."""
        pts = []
        for x in self.xr:
            if w[1]:
                y = (level - b - w[0] * x) / w[1]
                if self.yr[0] - 1e-9 <= y <= self.yr[1] + 1e-9: pts.append((x, y))
        for y in self.yr:
            if w[0]:
                x = (level - b - w[1] * y) / w[0]
                if self.xr[0] - 1e-9 <= x <= self.xr[1] + 1e-9: pts.append((x, y))
        pts = sorted(set((round(x, 9), round(y, 9)) for x, y in pts))
        return pts[0], pts[-1]

    def line(self, w, b, level=0, color=INK, width=2, dash=None):
        a, c = self.clip(w, b, level)
        self.f.line(self.X(a[0]), self.Y(a[1]), self.X(c[0]), self.Y(c[1]), color, width, dash)
        return a, c

    def band(self, w, b, color=BLUE, opacity=0.07):
        a1, c1 = self.clip(w, b, 1)
        a2, c2 = self.clip(w, b, -1)
        pts = [a1, c1, c2, a2]
        self.f.parts.append(f'<polygon points="{" ".join(f"{self.X(x):.1f},{self.Y(y):.1f}" for x, y in pts)}" fill="{color}" fill-opacity="{opacity}" stroke="none"/>')

    def pos(self, x, y, r=8): self.f.circle(self.X(x), self.Y(y), r, BLUE, '#ffffff', 1.5)
    def neg(self, x, y, r=7): self.f.cross(self.X(x), self.Y(y), r, ORANGE)
    def ring(self, x, y, r=15): self.f.circle(self.X(x), self.Y(y), r, 'none', INK, 2.4)
    def text(self, x, y, s, size=16, color=INK, anchor='start', weight=None): self.f.text(self.X(x), self.Y(y), s, size, color, anchor, weight)


def fig_margin(lang):
    f = Fig(625, 520, lang)
    P = Pane(f, 20, 12, 585, 455, (-1.5, 7.5), (-1.5, 5.5))
    P.band(SV_W, SV_B)
    for x, y in SV_POS: P.pos(x, y)
    for x, y in SV_NEG: P.neg(x, y)
    P.line(SV_W, SV_B, 0, INK, 3.2)
    P.line(SV_W, SV_B, 1, BLUE, 2, '7 5')
    P.line(SV_W, SV_B, -1, ORANGE, 2, '7 5')
    for x, y in [SV_POS[0], SV_NEG[0]]: P.ring(x, y)
    # the margin: a dotted segment between the two support vectors, along w
    f.line(P.X(1.2), P.Y(1.2), P.X(2.8), P.Y(2.8), INK, 1.6, '3 4')
    P.text(2.3, 1.75, '2/‖w‖', 17, INK, 'start', 'bold')
    # w, perpendicular to the boundary
    f.line(P.X(3.5), P.Y(0.5), P.X(4.25), P.Y(1.25), GREEN, 3, None, True)
    P.text(4.35, 1.35, 'w', 18, GREEN, 'start', 'bold')
    P.text(3.45, 3.15, L2(lang, 'support vector', '支持向量'), 16, INK, 'start')
    P.text(0.85, 0.12, L2(lang, 'support vector', '支持向量'), 16, INK, 'end')
    # each line is named where it meets the bottom edge
    yb = f.h - 14
    f.text(P.X(3.5), yb, 'w·x+b = −1', 16, ORANGE, 'middle')
    f.text(P.X(5.5), yb, 'w·x+b = 0', 16, INK, 'middle')
    f.text(P.X(7.5) - 4, yb, 'w·x+b = 1', 16, BLUE, 'end')
    return f.svg()


def L2(lang, en, zh):
    return zh if lang == 'zh' else en


def soft_xi(w, b):
    out = []
    for pts, y in ((SOFT_P, 1), (SOFT_N, -1)):
        for x in pts:
            out.append((x, y, max(0.0, 1 - y * svm_f(w, b, x))))
    return out


def fig_soft(lang):
    f = Fig(560, 480, lang)
    P = Pane(f, 20, 12, 520, 455, (0, 7), (0, 6))
    w, b = SOFT_SOL[1]
    P.band(w, b)
    pts = soft_xi(w, b)
    for x, y, xi in pts:
        (P.pos if y == 1 else P.neg)(*x)
    P.line(w, b, 0, INK, 3.2)
    P.line(w, b, 1, BLUE, 2, '7 5')
    P.line(w, b, -1, ORANGE, 2, '7 5')
    for x, y, xi in pts:
        if xi > 1e-6 or abs(y * svm_f(w, b, x) - 1) < 0.02:
            P.ring(*x, 14)
    names = {}
    for x, y, xi in pts:
        if abs(xi) < 1e-6 and abs(y * svm_f(w, b, x) - 1) < 0.02: names.setdefault('0', x)
        elif 0 < xi < 1: names.setdefault('mid', x)
        elif xi > 1: names.setdefault('big', x)
    for key, label, dx, dy in (('0', 'ξ = 0', -0.15, 0.52), ('mid', '0 < ξ < 1', -1.6, -0.62), ('big', 'ξ > 1', 0.45, 0.2)):
        if key in names:
            px, py = names[key]
            P.text(px + dx, py + dy, label, 17, PURPLE, 'start', 'bold')
    return f.svg()


def fig_c(lang):
    f = Fig(960, 340, lang)
    for k, C in enumerate((100, 1, 0.1)):
        P = Pane(f, 10 + k * 318, 40, 300, 285, (0, 7), (0, 6))
        w, b = SOFT_SOL[C]
        P.band(w, b)
        for x, y, xi in soft_xi(w, b):
            P.pos(*x, 6) if y == 1 else P.neg(*x, 5.5)
        P.line(w, b, 0, INK, 3)
        P.line(w, b, 1, BLUE, 1.8, '6 4')
        P.line(w, b, -1, ORANGE, 1.8, '6 4')
        f.text(10 + k * 318 + 150, 28, f'C = {C}', 20, INK, 'middle', 'bold')
    return f.svg()


def fig_margin_losses(lang):
    P = Plot(-2.5, 3, 0, 3.2, w=640, h=380)
    P.curve(lambda m: 1.0 if m <= 0 else 0.0, -2.5, 0, MUTED, 3, None, 2)
    P.seg((0, 1), (0, 0), MUTED, 3)
    P.seg((0, 0), (3, 0), MUTED, 3)
    P.curve(lambda m: max(0, 1 - m), -2.5, 3, BLUE, 3.5, None, 120)
    P.curve(lambda m: math.log2(1 + math.exp(-m)), -2.5, 3, ORANGE, 3.5)
    P.curve(lambda m: max(0, -m), -2.5, 3, GREEN, 3, '7 5', 120)
    P.axes('m', '', (-2, -1, 0, 1, 2, 3), (0, 1, 2, 3))
    # a legend in the empty corner
    for k, (col, dash, en, zh) in enumerate(((BLUE, None, 'hinge (SVM)', 'hinge（SVM）'), (ORANGE, None, 'logistic (÷ ln 2)', 'logistic（÷ ln 2）'),
                                              (GREEN, '7 5', 'perceptron', '感知机'), (MUTED, None, '0-1 loss', '0-1 损失'))):
        y = 3.0 - 0.36 * k
        P.seg((0.75, y), (1.2, y), col, 3.5, dash)
        P.text(1.3, y, L2(lang, en, zh), col if col != MUTED else INK, 17, dy=5)
    return P.svg()


# ================================================================== lesson 2: support vector machines
def L_svm():
    SG, SM, SO, SD, SK, SS, SC = ('svm.margin', 'svm.primal', 'svm.dual', 'svm.kernel', 'svm.soft', 'svm.compare', 'svm.multi')
    steps = [
        # -------------------------------------------------------------- the picture
        read('idea', T('Which separating line? The widest street', '选哪条分隔线？选最宽的"街道"'),
             p(T(r"When two classes can be separated by a line, there are infinitely many lines that do it, and all have zero training error. The perceptron takes whichever it stumbles on first; logistic regression takes the one that maximises the likelihood. The **support vector machine** (SVM) asks a geometric question: which line stays **as far as possible from both classes**?",
                 r"两个类别若能被一条直线分开，那么有无穷多条直线都能做到，训练误差都是零。感知机取它先碰到的那一条；逻辑回归取似然最大的那一条。**支持向量机**（SVM）问的是一个几何问题：哪条线离**两个类别都尽可能远**？")),
             svg(drawn(fig_margin), T('A maximum-margin line in 2D: the boundary, the two margin lines, the circled support vectors and the width 2/‖w‖.', '二维里的最大间隔直线：决策边界、两条间隔线、圈出的支持向量与宽度 2/‖w‖。')),
             p(T(r"Think of the widest street that fits between the classes, with the boundary down its middle. The **margin** is the half-width of that street. Why this helps generalisation: a test point is classified wrongly only if noise pushes it across the boundary, and the wider the empty street, the bigger the push needed. Only the points on the edge of the street, the **support vectors**, decide where it can be.",
                 r"想象能塞进两类之间的最宽的街道，边界就是街道的中线。**间隔**（margin）是街道的半宽。它为什么有利于泛化：测试点只有被噪声推过边界才会判错，空街道越宽，需要的推力越大。街道的位置只由街边的点，也就是**支持向量**（support vectors），决定。")),
             quiz(T('Two lines both classify every training point correctly. Line A has margin 0.5, line B has margin 2. The hard-margin SVM prefers…', '两条线都把所有训练点分对。线 A 的间隔是 0.5，线 B 是 2。硬间隔 SVM 偏好……'),
                  [(T('A, because a narrow margin means it fits the data more tightly.', 'A，因为间隔窄意味着它更贴合数据。'), T('A tight fit to the training points is what we do not want: it sits close to some points and tolerates less noise.', '紧贴训练点正是我们不想要的：它离某些点很近，容忍的噪声更少。')),
                   (T('Either: both have zero training error.', '都可以：两个训练误差都是零。'), T('SVM does not stop at zero error; among all separating lines it optimises the margin.', 'SVM 不止于训练误差为零；在所有能分开的直线里它优化间隔。')),
                   (T('B: it leaves the widest empty street.', 'B：它留出最宽的空街道。'), True)],
                  T('Maximum margin is the criterion that picks one line out of the infinitely many that separate the data.', '最大间隔是从无穷多条可分直线里挑出一条的准则。')),
             chapter=T('The maximum-margin classifier', '最大间隔分类器')),

        read('hyperplane', T('The hyperplane $\\mathbf{w}^\\top \\mathbf{x} + b = 0$ and the labels $\\pm 1$', '超平面 $\\mathbf{w}^\\top \\mathbf{x} + b = 0$ 与标签 $\\pm 1$'),
             p(T(r"A linear classifier scores a point by $f(\mathbf{x}) = \mathbf{w}^\top \mathbf{x} + b$ and predicts its sign: $\hat{y} = \text{sign}(f(\mathbf{x}))$. The deck writes $\boldsymbol{\theta}$ and $\theta_0$; here they are $\mathbf{w}$ and $b$, the usual SVM names, and the bias is kept separate.",
                 r"线性分类器用 $f(\mathbf{x}) = \mathbf{w}^\top \mathbf{x} + b$ 给点打分，预测其符号：$\hat{y} = \text{sign}(f(\mathbf{x}))$。课件写作 $\boldsymbol{\theta}$ 与 $\theta_0$；这里叫 $\mathbf{w}$ 与 $b$，是 SVM 通用的记号，偏置单独写。")),
             ul(T(r"**Boundary**: $\mathbf{w}^\top \mathbf{x} + b = 0$, a hyperplane (a line for $d=2$, a plane for $d=3$).", r"**边界**：$\mathbf{w}^\top \mathbf{x} + b = 0$，一个超平面（$d=2$ 是直线，$d=3$ 是平面）。"),
                T(r"**$\mathbf{w}$ is perpendicular to the boundary**: for two points on it, $\mathbf{w}^\top\mathbf{x} + b = 0$ and $\mathbf{w}^\top\mathbf{x}' + b = 0$ give $\mathbf{w}^\top(\mathbf{x} - \mathbf{x}') = 0$, so $\mathbf{w}$ is orthogonal to every direction *inside* the plane. It points to the $+1$ side.", r"**$\mathbf{w}$ 垂直于边界**：边界上两点满足 $\mathbf{w}^\top\mathbf{x} + b = 0$ 与 $\mathbf{w}^\top\mathbf{x}' + b = 0$，相减得 $\mathbf{w}^\top(\mathbf{x} - \mathbf{x}') = 0$，所以 $\mathbf{w}$ 与平面*内部*的每个方向都正交。它指向 $+1$ 的一侧。"),
                T(r"**The offset $b$** slides the plane parallel to itself. Without it the plane must pass through the origin; allowing it can widen the margin a lot (slide 27).", r"**偏置 $b$** 让平面平行移动。没有它，平面必须过原点；允许它，间隔可以大得多（第 27 页）。")),
             callout('note', T('Labels are $-1/+1$, not $0/1$', '标签是 $-1/+1$，不是 $0/1$'),
                     T(r"Logistic regression coded the classes 0 and 1 (so that $y$ could be a probability). The SVM codes them $-1$ and $+1$ so that **$y_i f(\mathbf{x}_i) > 0$ exactly when the point is on the correct side**. Everything below uses that product.",
                       r"逻辑回归把类别编码为 0 和 1（这样 $y$ 才能当概率）。SVM 编码为 $-1$ 和 $+1$，使得**点在正确一侧当且仅当 $y_i f(\mathbf{x}_i) > 0$**。下面的一切都用这个乘积。"))),

        derive('distance', T('How far is a point from the hyperplane?', '一个点离超平面有多远？'),
               [(r"x_i = x_p + r\,\frac{\mathbf{w}}{\|\mathbf{w}\|}", T(r"Split $\mathbf{x}_i$ into its foot $\mathbf{x}_p$ on the hyperplane plus a step of signed length $r$ along the unit normal $\mathbf{w}/\|\mathbf{w}\|$. $|r|$ is the distance we want.", r"把 $\mathbf{x}_i$ 拆成它在超平面上的垂足 $\mathbf{x}_p$，加上沿单位法向量 $\mathbf{w}/\|\mathbf{w}\|$ 走的一步，带符号长度为 $r$。$|r|$ 就是要求的距离。")),
                (r"\mathbf{w}^\top \mathbf{x}_p + b = 0", T("The foot lies on the hyperplane.", "垂足在超平面上。")),
                (r"\mathbf{w}^\top \mathbf{x}_i + b = \underbrace{\mathbf{w}^\top \mathbf{x}_p + b}_{0} + r\,\frac{\mathbf{w}^\top \mathbf{w}}{\|\mathbf{w}\|} = r\,\|\mathbf{w}\|", T(r"Apply $\mathbf{w}^\top(\cdot) + b$ to the split. The foot part is zero, and $\mathbf{w}^\top\mathbf{w} = \|\mathbf{w}\|^2$.", r"对拆分式作用 $\mathbf{w}^\top(\cdot) + b$。垂足那部分为零，且 $\mathbf{w}^\top\mathbf{w} = \|\mathbf{w}\|^2$。")),
                (r"r = \frac{\mathbf{w}^\top \mathbf{x}_i + b}{\|\mathbf{w}\|}", T(r"Solve for $r$: the **signed distance**, positive on the $+1$ side. (This is the deck's $\cos\beta$ picture on slide 9: the projection of $\mathbf{x}_i$ on $\mathbf{w}$.)", r"解出 $r$：**带符号的距离**，在 $+1$ 一侧为正。（这就是课件第 9 页的 $\cos\beta$ 图：$\mathbf{x}_i$ 在 $\mathbf{w}$ 上的投影。）")),
                (r"y_i\,r = \frac{y_i\,(\mathbf{w}^\top \mathbf{x}_i + b)}{\|\mathbf{w}\|}", T(r"Multiply by the label $y_i = \pm 1$: the result is positive for every correctly classified point, whichever side it is on. This is the clever trick of slide 49.", r"乘以标签 $y_i = \pm 1$：对每个分类正确的点结果都是正的，无论它在哪一侧。这就是第 49 页说的巧妙之处。")),
                (r"\mathbf{w} = (3, 4),\ b = -5,\ \mathbf{x} = (3, 4):\quad \frac{9 + 16 - 5}{\sqrt{9 + 16}} = \frac{20}{5} = 4", T("A check with numbers: the point is at distance 4 on the positive side.", "用数字检验：这个点在正的一侧，距离是 4。"))],
               intro=T(r"The margin is a distance, so first the formula for the distance from a point to a hyperplane.", r"间隔是一个距离，所以先推点到超平面距离的公式。"),
               outro=T(r"Two names. The **functional margin** of a point is $y_i(\mathbf{w}^\top \mathbf{x}_i + b)$; the **geometric margin** is that divided by $\|\mathbf{w}\|$, the true distance. The margin of the whole classifier is the smallest over the training set, $\gamma_g = \min_i y_i(\mathbf{w}^\top \mathbf{x}_i + b)/\|\mathbf{w}\|$ (slide 11). Rescaling $(\mathbf{w}, b) \to (c\mathbf{w}, cb)$ leaves the boundary and $\gamma_g$ alone but multiplies the functional margin by $c$: so only the geometric margin is meaningful.", r"两个名字。点的**函数间隔**（functional margin）是 $y_i(\mathbf{w}^\top \mathbf{x}_i + b)$；**几何间隔**（geometric margin）是它除以 $\|\mathbf{w}\|$，即真实的距离。整个分类器的间隔是训练集上的最小值，$\gamma_g = \min_i y_i(\mathbf{w}^\top \mathbf{x}_i + b)/\|\mathbf{w}\|$（第 11 页）。把 $(\mathbf{w}, b)$ 换成 $(c\mathbf{w}, cb)$，边界和 $\gamma_g$ 都不变，函数间隔却乘以 $c$：所以只有几何间隔有意义。"),
               blank=(5, '4', T(r"Compute $\dfrac{3\cdot 3 + 4\cdot 4 - 5}{\sqrt{3^2 + 4^2}}$.", r"计算 $\dfrac{3\cdot 3 + 4\cdot 4 - 5}{\sqrt{3^2 + 4^2}}$。")), skill=SM),

        derive('primal', T('From "maximise the margin" to a quadratic program', '从"最大化间隔"到二次规划'),
               [(r"\max_{\mathbf{w},\,b,\,\gamma}\ \gamma \quad \text{s.t.}\quad \frac{y_i(\mathbf{w}^\top \mathbf{x}_i + b)}{\|\mathbf{w}\|} \ge \gamma,\quad i = 1, \dots, n", T(r"The idea in symbols (slides 16-17): find the line whose smallest geometric margin $\gamma$ is as large as possible. Every point must be at distance $\ge \gamma$.", r"把想法写成符号（第 16-17 页）：找一条线，使它最小的几何间隔 $\gamma$ 尽可能大。每个点离线的距离都必须 $\ge \gamma$。")),
                (r"\gamma\,\|\mathbf{w}\| = 1 \quad\Longleftrightarrow\quad \gamma = \frac{1}{\|\mathbf{w}\|}", T(r"Scaling freedom: $(\mathbf{w}, b)$ and $(c\mathbf{w}, cb)$ are the same line. So we may *choose* the scale in which the closest point has functional margin exactly 1. This only fixes the scale; it loses nothing (slide 18, “for mathematical convenience”).", r"缩放自由度：$(\mathbf{w}, b)$ 和 $(c\mathbf{w}, cb)$ 是同一条线。所以可以*选定*一种尺度，使最近的点的函数间隔恰好为 1。这只是固定尺度，不损失任何东西（第 18 页“为数学上的方便”）。")),
                (r"\max_{\mathbf{w},\,b}\ \frac{1}{\|\mathbf{w}\|} \quad \text{s.t.}\quad \frac{y_i(\mathbf{w}^\top \mathbf{x}_i + b)}{\|\mathbf{w}\|} \ge \frac{1}{\|\mathbf{w}\|}", T("Substitute $\\gamma = 1/\\|\\mathbf{w}\\|$ everywhere.", "到处代入 $\\gamma = 1/\\|\\mathbf{w}\\|$。")),
                (r"y_i(\mathbf{w}^\top \mathbf{x}_i + b) \ge 1", T(r"Multiply each constraint by $\|\mathbf{w}\| > 0$: the nasty fraction is gone and the constraint is **linear** in $(\mathbf{w}, b)$.", r"每个约束乘以 $\|\mathbf{w}\| > 0$：难看的分式消失，约束对 $(\mathbf{w}, b)$ 变成**线性**的。")),
                (r"\max \frac{1}{\|\mathbf{w}\|} \ \Longleftrightarrow\ \min \|\mathbf{w}\|", T("Making $1/\\|\\mathbf{w}\\|$ big means making $\\|\\mathbf{w}\\|$ small (slide 20).", "$1/\\|\\mathbf{w}\\|$ 大，就是 $\\|\\mathbf{w}\\|$ 小（第 20 页）。")),
                (r"\min_{\mathbf{w},\,b}\ \tfrac12\|\mathbf{w}\|^2 \quad \text{s.t.}\quad y_i(\mathbf{w}^\top \mathbf{x}_i + b) \ge 1,\ \ i = 1, \dots, n", T(r"Square it and add $\tfrac12$: on positive numbers $\|\mathbf{w}\|$ and $\tfrac12\|\mathbf{w}\|^2$ have the same minimiser, but the square is smooth (no root) and its derivative is just $\mathbf{w}$. This is the **hard-margin SVM** (slide 21).", r"平方再乘 $\tfrac12$：对正数，$\|\mathbf{w}\|$ 与 $\tfrac12\|\mathbf{w}\|^2$ 的最小点相同，但平方是光滑的（没有根号），导数就是 $\mathbf{w}$。这就是**硬间隔 SVM**（第 21 页）。"))],
               outro=T(r"A **quadratic program** (QP): a quadratic objective and linear constraints. It is **convex**, so it has one global optimum and no local traps (the deck's pro on slide 48), unlike a neural network's loss. Contrast with logistic regression: no likelihood, no probabilities, just geometry.", r"这是一个**二次规划**（QP）：二次目标加线性约束。它是**凸**的，所以只有一个全局最优、没有局部陷阱（课件第 48 页的优点），不像神经网络的损失。与逻辑回归对比：没有似然，没有概率，只有几何。"),
               skill=SM),

        derive('width', T('Why the margin is $2/\\|\\mathbf{w}\\|$', '为什么间隔宽度是 $2/\\|\\mathbf{w}\\|$'),
               [(r"H_{+}: \mathbf{w}^\top\mathbf{x} + b = +1, \qquad H_{-}: \mathbf{w}^\top\mathbf{x} + b = -1", T(r"In the scale we fixed, the closest points satisfy $y_i(\mathbf{w}^\top \mathbf{x}_i + b) = 1$: positives on $H_+$, negatives on $H_-$. Both are parallel to the boundary $H_0$ (slide 22).", r"在我们选定的尺度下，最近的点满足 $y_i(\mathbf{w}^\top \mathbf{x}_i + b) = 1$：正例在 $H_+$ 上，负例在 $H_-$ 上。两者都与边界 $H_0$ 平行（第 22 页）。")),
                (r"\mathbf{x}_{+} = \mathbf{x}_{-} + \lambda\,\mathbf{w}", T(r"The shortest way from $H_-$ to $H_+$ goes along the normal $\mathbf{w}$. Take $\mathbf{x}_-$ on $H_-$ and walk $\lambda$ times $\mathbf{w}$.", r"从 $H_-$ 到 $H_+$ 的最短路沿法向量 $\mathbf{w}$。取 $H_-$ 上的 $\mathbf{x}_-$，沿 $\mathbf{w}$ 走 $\lambda$ 倍。")),
                (r"\mathbf{w}^\top(\mathbf{x}_{+} - \mathbf{x}_{-}) = (+1 - b) - (-1 - b) = 2", T(r"Subtract the two plane equations: $b$ cancels.", r"两个平面方程相减：$b$ 抵消。")),
                (r"\lambda\,\|\mathbf{w}\|^2 = 2 \ \Rightarrow\ \lambda = \frac{2}{\|\mathbf{w}\|^2}", T(r"Substitute $\mathbf{x}_+ - \mathbf{x}_- = \lambda\mathbf{w}$ into the line above.", r"把 $\mathbf{x}_+ - \mathbf{x}_- = \lambda\mathbf{w}$ 代入上一行。")),
                (r"\|\mathbf{x}_{+} - \mathbf{x}_{-}\| = \lambda\,\|\mathbf{w}\| = \frac{2}{\|\mathbf{w}\|}", T(r"The distance between the planes is the **width of the street**, $2/\|\mathbf{w}\|$; the margin (half of it) is $1/\|\mathbf{w}\|$.", r"两个平面之间的距离就是**街道的宽度** $2/\|\mathbf{w}\|$；间隔（它的一半）是 $1/\|\mathbf{w}\|$。"))],
               intro=T(r"Check the picture with algebra: the two margin lines are $\mathbf{w}^\top\mathbf{x} + b = \pm 1$. How far apart are they?", r"用代数检验这幅图：两条间隔线是 $\mathbf{w}^\top\mathbf{x} + b = \pm 1$，它们相距多远？"),
               outro=T(r"So **small $\|\mathbf{w}\|$ = wide street**: minimising $\tfrac12\|\mathbf{w}\|^2$ *is* maximising the margin. The same “small weights” idea appears as regularisation in logistic regression, which is not an accident (see the hinge page).", r"所以 **$\|\mathbf{w}\|$ 小 = 街道宽**：最小化 $\tfrac12\|\mathbf{w}\|^2$ *就是*最大化间隔。“权重小”这个想法在逻辑回归里以正则化的面目出现，这不是巧合（见 hinge 一页）。"),
               skill=SM),

        read('hard', T('Support vectors, and the limits of the hard margin', '支持向量，以及硬间隔的局限'),
             p(T(r"At the optimum, the points whose constraint is **tight**, $y_i(\mathbf{w}^\top \mathbf{x}_i + b) = 1$, lie exactly on the margin lines. These are the **support vectors**; every other point has slack to spare. The solution is **sparse**: the boundary is determined by the support vectors alone (slide 23). Move or delete any other point and nothing changes.",
                 r"在最优解处，约束**取等号**的点，$y_i(\mathbf{w}^\top \mathbf{x}_i + b) = 1$，恰好落在间隔线上。这些就是**支持向量**；其他点都有富余。解是**稀疏**的：边界只由支持向量决定（第 23 页）。移动或删掉别的点，什么都不变。")),
             p(T(r"Is sparse good? Yes, and it gives a cheap estimate of test error (slide 24). In leave-one-out cross-validation, removing a non-support vector leaves the classifier unchanged, so that point is still classified correctly. Only removing a support vector can cause a mistake. Hence the leave-one-out error is at most $N_s / n$, with $N_s$ the number of support vectors:",
                 r"稀疏是好事吗？是的，而且它给出一个便宜的测试误差估计（第 24 页）。留一交叉验证里，删掉一个非支持向量，分类器不变，这个点仍被分对。只有删掉支持向量才可能出错。因此留一误差至多是 $N_s / n$，其中 $N_s$ 是支持向量的个数：")),
             math_(r"\varepsilon_{\text{LOO}} \ \le\ \frac{N_s}{n}"),
             quiz(T('You delete one training point that is **not** a support vector and retrain a hard-margin SVM. The new boundary is…', '你删掉一个**不是**支持向量的训练点，重新训练硬间隔 SVM。新的边界……'),
                  [(T('slightly different: every point contributes a little.', '略有不同：每个点都有一点贡献。'), T('That is how logistic regression behaves. For the SVM, a point strictly outside the margin has no influence at all.', '这是逻辑回归的行为。对 SVM，严格在间隔之外的点完全没有影响。')),
                   (T('exactly the same.', '完全相同。'), True),
                   (T('wider, because there is more room.', '更宽，因为空间更大了。'), T('The margin is set by the *closest* points, the support vectors; removing a far point does not change them.', '间隔由*最近*的点，即支持向量决定；删掉远处的点不会改变它们。'))],
                  T('Only the support vectors are in the constraints that are tight, so only they shape the solution.', '只有支持向量对应的约束取等号，所以只有它们塑造解。')),
             h(T('Two weaknesses of the hard margin (slides 28-29)', '硬间隔的两个弱点（第 28-29 页）')),
             ul(T(r"**Sensitive to outliers and label errors**: one stray point close to the other class can drag the boundary and shrink the street dramatically.", r"**对离群点和标签错误敏感**：一个靠近另一类的游离点，就能把边界拉偏、把街道大大压窄。"),
                T(r"**No solution if the data are not linearly separable**: the constraints $y_i(\mathbf{w}^\top \mathbf{x}_i + b) \ge 1$ cannot all hold, and the QP is infeasible.", r"**数据线性不可分时无解**：约束 $y_i(\mathbf{w}^\top \mathbf{x}_i + b) \ge 1$ 不可能全部成立，QP 无可行解。")),
             p(T(r"Both are fixed by letting some points break the rules for a price: the soft margin, later in this lesson. First, the machinery that explains support vectors and makes kernels possible.",
                 r"两者都靠“让一些点付出代价、允许它们违规”来解决：本课后面的软间隔。先讲能解释支持向量、并使核方法成为可能的那套工具。")),
             chapter=T('The dual and kernels', '对偶问题与核')),

        derive('toy', T('Optimising under a constraint: the deck\'s toy problem', '带约束的优化：课件里的小例子'),
               [(r"\min_z\ (z-1)^2 \quad \text{s.t.}\quad z - 3 \ge 0", T(r"Slide 13. Without the constraint the minimum is at $z = 1$, which breaks $z \ge 3$. The answer must lie on the allowed set, and by the picture it is the allowed point closest to 1: $z^* = 3$. Now find it by a method that will also work for the SVM.", r"第 13 页。没有约束时最小点在 $z = 1$，但它违反 $z \ge 3$。答案必须在允许的集合里，从图上看是离 1 最近的允许点：$z^* = 3$。现在用一种同样适用于 SVM 的方法把它求出来。")),
                (r"\mathcal{L}(z, \alpha) = (z-1)^2 - \alpha\,(z - 3), \qquad \alpha \ge 0", T(r"The **Lagrangian**: add the constraint, times a multiplier $\alpha \ge 0$, to the objective. For $z < 3$ the added term is positive: a **penalty for violating** the constraint. ($\alpha$ is how much the constraint is worth.)", r"**拉格朗日函数**：把约束乘上乘子 $\alpha \ge 0$ 加到目标上。$z < 3$ 时新增的项为正：对违反约束的**惩罚**。（$\alpha$ 是这条约束值多少钱。）")),
                (r"\frac{\partial \mathcal{L}}{\partial z} = 2(z-1) - \alpha = 0 \ \Rightarrow\ \alpha = 2(z-1)", T("Stationarity: set the derivative in the variable to zero.", "驻点条件：对变量的导数取零。")),
                (r"\alpha\,(z - 3) = 0", T(r"**Complementary slackness**: either the multiplier is zero, or the constraint is tight. A constraint with room to spare costs nothing, so its price must be 0.", r"**互补松弛**：要么乘子为零，要么约束取等号。有富余的约束不花代价，所以它的价格必须是 0。")),
                (r"\alpha = 0 \Rightarrow z = 1 \notin \{z \ge 3\};\qquad z = 3 \Rightarrow \alpha = 2(3-1) = 4 \ge 0", T("Try both cases. The first is infeasible. The second works.", "两种情形都试一下。第一种不可行，第二种成立。")),
                (r"z^* = 3,\quad \alpha^* = 4,\quad (z^*-1)^2 = 4", T(r"The constraint is **active** ($\alpha > 0$): it pushes back with force 4. Had the unconstrained minimum been allowed, we would have found $\alpha = 0$. The SVM does exactly this, with one multiplier per training point.", r"约束是**起作用的**（$\alpha > 0$）：它以力 4 顶了回来。若无约束的最小点本来就被允许，我们会得到 $\alpha = 0$。SVM 做的正是这件事，每个训练点一个乘子。"))],
               intro=T(r"To see why only some points matter, and why kernels work, we need one tool: the Lagrangian. Learn it on the deck's one-variable example.", r"要看清为什么只有一些点起作用、为什么核方法行得通，需要一个工具：拉格朗日函数。先在课件的一元例子上学会它。"), skill=SO),

        derive('lagrangian', T('Deeper: the SVM Lagrangian and the two stationarity conditions', '深入：SVM 的拉格朗日函数与两个驻点条件'),
               [(r"\min_{\mathbf{w},b}\ \tfrac12\|\mathbf{w}\|^2 \quad \text{s.t.}\quad y_i(\mathbf{w}^\top \mathbf{x}_i + b) - 1 \ge 0", T("The primal, with each constraint written as “something $\\ge 0$”, as in the toy.", "原问题，每个约束写成“某个量 $\\ge 0$”的形式，和刚才的小例子一样。")),
                (r"\mathcal{L}(\mathbf{w}, b, \boldsymbol{\alpha}) = \tfrac12\|\mathbf{w}\|^2 - \sum_{i=1}^{n} \alpha_i \big[ y_i(\mathbf{w}^\top \mathbf{x}_i + b) - 1 \big],\quad \alpha_i \ge 0", T(r"One multiplier $\alpha_i$ per training point: the price of its constraint.", r"每个训练点一个乘子 $\alpha_i$：它的约束的价格。")),
                (r"P^{*} = \min_{\mathbf{w},b}\ \max_{\boldsymbol{\alpha} \ge 0}\ \mathcal{L}", T(r"$P^*$, the primal value. Why this is the same problem: if some constraint is violated, its bracket is negative, so $-\alpha_i[\cdot]$ can be made arbitrarily large and the max is $+\infty$. If all hold, the best $\alpha_i$ are 0 and the max equals $\tfrac12\|\mathbf{w}\|^2$. So the inner max enforces the constraints automatically.", r"$P^*$ 是原问题的值。为什么这是同一个问题：若某个约束被违反，它的括号为负，$-\alpha_i[\cdot]$ 可以任意大，max 是 $+\infty$。若全部满足，最优的 $\alpha_i$ 为 0，max 等于 $\tfrac12\|\mathbf{w}\|^2$。所以内层的 max 自动强制了约束。")),
                (r"D^{*} = \max_{\boldsymbol{\alpha} \ge 0}\ \min_{\mathbf{w},b}\ \mathcal{L}", T(r"Swap the order to get $D^*$, the dual value. In general $D^* \le P^*$ (weak duality), but for a convex objective with linear constraints the two are **equal** (strong duality), so we may solve whichever is easier.", r"交换顺序得到 $D^*$，对偶问题的值。一般有 $D^* \le P^*$（弱对偶），但对凸目标加线性约束，两者**相等**（强对偶），所以可以解较容易的那个。")),
                (r"\frac{\partial \mathcal{L}}{\partial \mathbf{w}} = \mathbf{w} - \sum_i \alpha_i y_i \mathbf{x}_i = 0 \ \Rightarrow\ \mathbf{w} = \sum_{i=1}^{n} \alpha_i y_i \mathbf{x}_i", T(r"Inner minimisation, in $\mathbf{w}$ first. The derivative of $\tfrac12\|\mathbf{w}\|^2$ is $\mathbf{w}$; of $\alpha_i y_i \mathbf{w}^\top\mathbf{x}_i$ it is $\alpha_i y_i\mathbf{x}_i$. So **$\mathbf{w}$ is a weighted sum of the training points**, label-signed.", r"先对 $\mathbf{w}$ 做内层最小化。$\tfrac12\|\mathbf{w}\|^2$ 的导数是 $\mathbf{w}$；$\alpha_i y_i \mathbf{w}^\top\mathbf{x}_i$ 的导数是 $\alpha_i y_i\mathbf{x}_i$。所以 **$\mathbf{w}$ 是训练点的加权和**，带标签的符号。")),
                (r"\frac{\partial \mathcal{L}}{\partial b} = -\sum_i \alpha_i y_i = 0 \ \Rightarrow\ \sum_{i=1}^{n} \alpha_i y_i = 0", T(r"Then in $b$. Only the term $-b\sum_i\alpha_i y_i$ contains $b$. The condition says the total push on the boundary from the $+1$ points equals that from the $-1$ points (forces balance).", r"再对 $b$。只有 $-b\sum_i\alpha_i y_i$ 这一项含 $b$。这个条件说：$+1$ 点对边界的总推力等于 $-1$ 点的总推力（力平衡）。"))],
               intro=T(r"The same recipe as the toy, now with $n$ constraints. Part 1: set up and differentiate.", r"和小例子同一套办法，只是现在有 $n$ 个约束。第 1 部分：建立并求导。"), skill=SO),

        derive('dual', T('Deeper: the dual problem', '深入：对偶问题'),
               [(r"\mathcal{L} = \tfrac12\,\mathbf{w}^\top\mathbf{w} - \sum_i \alpha_i y_i\,\mathbf{w}^\top \mathbf{x}_i - b\sum_i \alpha_i y_i + \sum_i \alpha_i", T("Start from the Lagrangian and expand the bracket.", "从拉格朗日函数出发，把括号展开。")),
                (r"\mathcal{L} = \tfrac12\,\mathbf{w}^\top\mathbf{w} - \mathbf{w}^\top\Big(\sum_i \alpha_i y_i \mathbf{x}_i\Big) + \sum_i \alpha_i", T(r"The $b$ term vanishes because $\sum_i \alpha_i y_i = 0$. In the second term, pull $\mathbf{w}^\top$ out of the sum.", r"$b$ 项消失，因为 $\sum_i \alpha_i y_i = 0$。第二项里把 $\mathbf{w}^\top$ 提到求和外面。")),
                (r"\mathcal{L} = \tfrac12\,\mathbf{w}^\top\mathbf{w} - \mathbf{w}^\top\mathbf{w} + \sum_i \alpha_i = \sum_i \alpha_i - \tfrac12\,\mathbf{w}^\top\mathbf{w}", T(r"The bracket is exactly $\mathbf{w}$ (the first stationarity condition).", r"括号里恰好是 $\mathbf{w}$（第一个驻点条件）。")),
                (r"\mathbf{w}^\top\mathbf{w} = \sum_i\sum_j \alpha_i\alpha_j\,y_i y_j\,\mathbf{x}_i^\top \mathbf{x}_j", T(r"Write $\mathbf{w}$ as the sum twice and multiply out.", r"把 $\mathbf{w}$ 写成两次求和再相乘。")),
                (r"\max_{\boldsymbol{\alpha}}\ \ W(\boldsymbol{\alpha}) = \sum_{i=1}^{n} \alpha_i - \tfrac12 \sum_{i,j} \alpha_i\alpha_j\,y_i y_j\,\mathbf{x}_i^\top \mathbf{x}_j \quad \text{s.t.}\ \ \alpha_i \ge 0,\ \ \sum_i \alpha_i y_i = 0", T(r"The **dual**: a problem in the $n$ multipliers only; $\mathbf{w}$ and $b$ are gone. It is a concave QP (so again one optimum).", r"**对偶问题**：只含 $n$ 个乘子；$\mathbf{w}$ 和 $b$ 都消失了。它是凹的 QP（同样只有一个最优点）。")),
                (r"f(\mathbf{x}) = \mathbf{w}^\top \mathbf{x} + b = \sum_{i=1}^{n} \alpha_i y_i\,\mathbf{x}_i^\top \mathbf{x} + b", T(r"Prediction also uses $\mathbf{w} = \sum_i \alpha_i y_i \mathbf{x}_i$.", r"预测同样用 $\mathbf{w} = \sum_i \alpha_i y_i \mathbf{x}_i$。"))],
               intro=T(r"Part 2: put $\mathbf{w} = \sum_i \alpha_i y_i \mathbf{x}_i$ and $\sum_i \alpha_i y_i = 0$ back into $\mathcal{L}$ to eliminate $\mathbf{w}$ and $b$.", r"第 2 部分：把 $\mathbf{w} = \sum_i \alpha_i y_i \mathbf{x}_i$ 与 $\sum_i \alpha_i y_i = 0$ 代回 $\mathcal{L}$，消掉 $\mathbf{w}$ 和 $b$。"),
               outro=T(r"Look at where the data appear: **only inside dot products** $\mathbf{x}_i^\top \mathbf{x}_j$, both in training and in prediction. That is the door to kernels.", r"看看数据出现在哪里：**只出现在点积** $\mathbf{x}_i^\top \mathbf{x}_j$ 里，训练和预测都是。这就是通向核方法的门。"), skill=SO),

        read('kkt', T('Deeper: complementary slackness, or why only support vectors count', '深入：互补松弛，为什么只有支持向量起作用'),
             p(T(r"At the optimum the **KKT conditions** hold. The one that matters for interpretation is complementary slackness, as in the toy example:",
                 r"在最优点，**KKT 条件**成立。对解释最重要的是互补松弛，和小例子里一样：")),
             math_(r"\alpha_i\,\big[\, y_i(\mathbf{w}^\top \mathbf{x}_i + b) - 1 \,\big] = 0, \qquad i = 1, \dots, n"),
             table([T('case', '情形'), T('then', '于是'), T('the point is', '这个点')],
                   [r'$\alpha_i = 0$', r'$y_i f(\mathbf{x}_i) \ge 1$', T('outside or on the margin; **no influence** on $\\mathbf{w}$', '在间隔外或边上；对 $\\mathbf{w}$ **没有影响**')],
                   [r'$\alpha_i > 0$', r'$y_i f(\mathbf{x}_i) = 1$', T('exactly on a margin line: a **support vector**', '恰在间隔线上：**支持向量**')]),
             p(T(r"So in $\mathbf{w} = \sum_i \alpha_i y_i \mathbf{x}_i$ every non-support vector has weight 0: **the sum runs over the support vectors only**, which is the sparsity of slide 23, now derived. A picture to remember: each support vector pushes on the street with a force $\alpha_i$, the plane rests where the forces balance ($\sum_i \alpha_i y_i = 0$), and a point with no contact (outside the street) pushes with force 0.",
                 r"所以在 $\mathbf{w} = \sum_i \alpha_i y_i \mathbf{x}_i$ 中，每个非支持向量的权重都是 0：**求和只在支持向量上进行**，这就是第 23 页的稀疏性，现在推出来了。可以这样记：每个支持向量以力 $\alpha_i$ 推着街道，平面停在力平衡处（$\sum_i \alpha_i y_i = 0$），而没接触的点（在街外）推力为 0。")),
             p(T(r"The bias comes from any support vector $s$: $y_s(\mathbf{w}^\top \mathbf{x}_s + b) = 1$ and $y_s = \pm 1$ give $b = y_s - \mathbf{w}^\top \mathbf{x}_s$.", r"偏置由任一支持向量 $s$ 得到：$y_s(\mathbf{w}^\top \mathbf{x}_s + b) = 1$ 且 $y_s = \pm 1$，得 $b = y_s - \mathbf{w}^\top \mathbf{x}_s$。")),
             quiz(T('A training point has $y_i f(\\mathbf{x}_i) = 2.5$ at the optimum. Its multiplier $\\alpha_i$ is…', '最优点处某训练点满足 $y_i f(\\mathbf{x}_i) = 2.5$。它的乘子 $\\alpha_i$ 是……'),
                  [(T('positive, because it is classified correctly.', '正的，因为它被分对了。'), T('Correct classification is not enough: $\\alpha_i > 0$ needs the point to sit *on* the margin line ($y_i f = 1$).', '分对还不够：$\\alpha_i > 0$ 需要点恰好*在*间隔线上（$y_i f = 1$）。')),
                   (T('between 0 and 1, depending on the distance.', '在 0 和 1 之间，取决于距离。'), T('Multipliers are not tied to distance like that; for a point with slack to spare the bracket is non-zero, so $\\alpha_i$ must be 0.', '乘子并非这样与距离挂钩；有富余的点，括号非零，所以 $\\alpha_i$ 必为 0。')),
                   (T('zero: the constraint is not tight, so it costs nothing.', '零：约束没取等号，不花代价。'), True)],
                  T('$\\alpha_i[y_i f(\\mathbf{x}_i) - 1] = 0$ with the bracket equal to $1.5 \\neq 0$ forces $\\alpha_i = 0$.', '$\\alpha_i[y_i f(\\mathbf{x}_i) - 1] = 0$，而括号等于 $1.5 \\neq 0$，所以 $\\alpha_i = 0$。'))),

        derive('check', T('Deeper: the dual solved by hand on the figure\'s data', '深入：在图中的数据上手算对偶问题'),
               [(r"\mathbf{x}_1 = (3,3),\ y_1 = +1;\qquad \mathbf{x}_3 = (1,1),\ y_3 = -1", T(r"The data of the figure. By eye the two circled points are the support vectors, so every other $\alpha_i = 0$. (We verify afterwards that the others are outside the street.)", r"图中的数据。目测圈出的两个点是支持向量，所以其他 $\alpha_i$ 都为 0。（最后会验证其余点都在街外。）")),
                (r"\sum_i \alpha_i y_i = \alpha_1 - \alpha_3 = 0 \ \Rightarrow\ \alpha_1 = \alpha_3 = \alpha", T("The balance constraint: the two forces are equal.", "平衡约束：两个力相等。")),
                (r"\mathbf{x}_1^\top\mathbf{x}_1 = 18,\quad \mathbf{x}_3^\top\mathbf{x}_3 = 2,\quad \mathbf{x}_1^\top\mathbf{x}_3 = 6", T("The dot products the dual needs.", "对偶问题需要的点积。")),
                (r"W(\alpha) = 2\alpha - \tfrac12\big(18\alpha^2 - 2\cdot 6\,\alpha^2 + 2\alpha^2\big) = 2\alpha - 4\alpha^2", T(r"Insert into $W$. The cross term carries $y_1 y_3 = -1$, which is why it is subtracted twice.", r"代入 $W$。交叉项带有 $y_1 y_3 = -1$，所以被减去两次。")),
                (r"W'(\alpha) = 2 - 8\alpha = 0 \ \Rightarrow\ \alpha = \tfrac14", T("Maximise: set the derivative to zero.", "最大化：导数取零。")),
                (r"\mathbf{w} = \tfrac14\,(3,3) - \tfrac14\,(1,1) = (0.5,\ 0.5)", T(r"$\mathbf{w} = \sum_i \alpha_i y_i \mathbf{x}_i$ over the support vectors.", r"$\mathbf{w} = \sum_i \alpha_i y_i \mathbf{x}_i$，只对支持向量求和。")),
                (r"y_1(\mathbf{w}^\top \mathbf{x}_1 + b) = 1 \ \Rightarrow\ 3 + b = 1 \ \Rightarrow\ b = -2", T("The bias from a support vector.", "由一个支持向量得到偏置。")),
                (r"\frac{2}{\|\mathbf{w}\|} = \frac{2}{\sqrt{0.5}} = 2\sqrt{2} = \|\mathbf{x}_1 - \mathbf{x}_3\|,\qquad \tfrac12\|\mathbf{w}\|^2 = 0.25 = W(\tfrac14)", T("Two checks. The street width equals the distance between the two support vectors. And the primal value equals the dual value (strong duality).", "两个检验。街道宽度等于两个支持向量之间的距离。原问题的值等于对偶问题的值（强对偶）。"))],
               intro=T(r"Now run the dual on a tiny problem: the four-plus-four points of the first figure, whose support vectors are $(3,3)$ and $(1,1)$.", r"现在在一个小问题上跑一遍对偶：第一幅图里的四加四个点，支持向量是 $(3,3)$ 与 $(1,1)$。"),
               outro=T(r"Every other point has $y_i f(\mathbf{x}_i) > 1$ (for example $(4,5)$ gives $2.5$, $(0,1)$ gives $1.5$), so $\alpha_i = 0$ was right.", r"其余的点都满足 $y_i f(\mathbf{x}_i) > 1$（例如 $(4,5)$ 得 $2.5$，$(0,1)$ 得 $1.5$），所以 $\alpha_i = 0$ 是对的。"),
               blank=(4, '1/4', T(r"Solve $2 - 8\alpha = 0$.", r"解 $2 - 8\alpha = 0$。")), skill=SO),

        read('kernel', T('Deeper: the kernel trick', '深入：核技巧'),
             callout('note', T('Beyond the deck', '超出课件的内容'),
                     T(r"The deck says kernel methods are not covered. This page and the next are for depth; the exam will not ask you to derive kernels. Knowing the idea and the names is enough.", r"课件说核方法不在范围内。这一页和下一页是为了加深理解；考试不会要求推导核。知道想法和名字就够了。")),
             p(T(r"Some data are not linearly separable in the original space, but become so after a feature map $\phi$ that adds features (squares, products). The dual shows how to use $\phi$ without paying for it: the data enter only as dot products, so replace each by a **kernel**",
                 r"有些数据在原空间里线性不可分，但用特征映射 $\phi$ 加上新特征（平方、乘积）之后就可分了。对偶问题告诉我们怎样用 $\phi$ 而不付出代价：数据只以点积出现，所以把每个点积换成一个**核函数**")),
             math_(r"K(\mathbf{x}, \mathbf{z}) = \phi(\mathbf{x})^\top \phi(\mathbf{z}), \qquad f(\mathbf{x}) = \sum_{i} \alpha_i y_i\,K(\mathbf{x}_i, \mathbf{x}) + b"),
             p(T(r"The trick: computing $K$ directly is often far cheaper than computing $\phi$, which may have a huge or even infinite number of coordinates. The classifier is still linear, but in the $\phi$-space, so its boundary in the original space is curved. Everything above (margin, support vectors, sparsity) carries over unchanged.",
                 r"诀窍：直接算 $K$ 往往比算 $\phi$ 便宜得多，$\phi$ 可能有巨大甚至无穷多个坐标。分类器在 $\phi$ 空间里仍是线性的，所以在原空间里边界是弯的。上面的一切（间隔、支持向量、稀疏性）原样保留。")),
             table([T('kernel', '核'), T('$K(\\mathbf{x}, \\mathbf{z})$', '$K(\\mathbf{x}, \\mathbf{z})$'), T('boundary in the original space', '原空间里的边界'), T('knob', '参数')],
                   [T('linear', '线性'), r'$\mathbf{x}^\top\mathbf{z}$', T('a hyperplane (the plain SVM)', '超平面（普通 SVM）'), '-'],
                   [T('polynomial', '多项式'), r'$(\mathbf{x}^\top\mathbf{z} + c)^d$', T('a polynomial surface up to degree $d$', '至多 $d$ 次的多项式曲面'), r'$d$, $c$'],
                   [T('RBF (Gaussian)', 'RBF（高斯）'), r'$\exp(-\gamma\,\|\mathbf{x} - \mathbf{z}\|^2)$', T('smooth, local blobs around the support vectors; infinite-dimensional $\\phi$', '围绕支持向量的光滑局部"团块"；$\\phi$ 是无穷维的'), r'$\gamma$']),
             p(T(r"The RBF kernel is a similarity: 1 when $\mathbf{x} = \mathbf{z}$, falling to 0 with distance. Large $\gamma$ makes each support vector's reach tiny, so the boundary wiggles around single points (overfit); small $\gamma$ makes it smooth, nearly linear. A valid kernel must give a symmetric positive semi-definite Gram matrix $[K(\mathbf{x}_i, \mathbf{x}_j)]$ (Mercer's condition); that guarantees it equals a dot product for *some* $\phi$.",
                 r"RBF 核是一种相似度：$\mathbf{x} = \mathbf{z}$ 时为 1，随距离增大衰减到 0。$\gamma$ 大，每个支持向量的影响范围很小，边界围着单个点扭动（过拟合）；$\gamma$ 小，边界光滑、近乎线性。合法的核必须使 Gram 矩阵 $[K(\mathbf{x}_i, \mathbf{x}_j)]$ 对称半正定（Mercer 条件），这保证它对*某个* $\phi$ 等于点积。"))),

        derive('kernel-ex', T('Deeper: a kernel is a dot product in disguise, as $(\\mathbf{x}^\\top \\mathbf{z})^2$ shows', '深入：核是伪装的点积，以 $(\\mathbf{x}^\\top \\mathbf{z})^2$ 为例'),
               [(r"K(\mathbf{x}, \mathbf{z}) = (\mathbf{x}^\top \mathbf{z})^2,\qquad \mathbf{x}, \mathbf{z} \in \mathbb{R}^2", T("The degree-2 polynomial kernel (with $c = 0$) on two features.", "两个特征上的二次多项式核（$c = 0$）。")),
                (r"(x_1 z_1 + x_2 z_2)^2 = x_1^2 z_1^2 + 2\,x_1 x_2 z_1 z_2 + x_2^2 z_2^2", T("Expand the square.", "展开平方。")),
                (r"= \big(x_1^2,\ \sqrt{2}\,x_1 x_2,\ x_2^2\big) \cdot \big(z_1^2,\ \sqrt{2}\,z_1 z_2,\ z_2^2\big)", T(r"Regroup as a dot product of two 3-vectors: put $\sqrt2$ in each so the middle product is $2x_1x_2z_1z_2$. So the explicit feature map is $\phi(\mathbf{x}) = (x_1^2, \sqrt2\,x_1x_2, x_2^2)$.", r"重新组合成两个三维向量的点积：每边放一个 $\sqrt2$，使中间项乘出 $2x_1x_2z_1z_2$。所以显式的特征映射是 $\phi(\mathbf{x}) = (x_1^2, \sqrt2\,x_1x_2, x_2^2)$。")),
                (r"\mathbf{x} = (1, 2),\ \mathbf{z} = (3, 1):\quad (\mathbf{x}^\top\mathbf{z})^2 = (3 + 2)^2 = 25", T("A number check, the kernel route: one dot product in the original 2D space and a square.", "用数字检验，走核的路线：在原来的二维空间里做一次点积再平方。")),
                (r"\phi(\mathbf{x}) = (1,\ 2\sqrt2,\ 4),\quad \phi(\mathbf{z}) = (9,\ 3\sqrt2,\ 1)", T("The feature route: map both points to 3D first.", "特征的路线：先把两个点映射到三维。")),
                (r"\phi(\mathbf{x})^\top\phi(\mathbf{z}) = 9 + 2\sqrt2 \cdot 3\sqrt2 + 4 = 9 + 12 + 4 = 25", T("The same 25. The kernel gave the 3D dot product without ever forming the 3D vectors.", "同样是 25。核没有构造三维向量，就给出了三维空间里的点积。")),
                (r"\text{XOR: } (1,1),(-1,-1) \mapsto \phi_3 = +\sqrt2;\quad (1,-1),(-1,1) \mapsto \phi_3 = -\sqrt2", T(r"Why bother: XOR (positives on one diagonal, negatives on the other) cannot be split by any line in 2D. After $\phi$ the third coordinate $\sqrt2\,x_1x_2$ is $+\sqrt2$ for one class and $-\sqrt2$ for the other, so the plane $\phi_3 = 0$ separates them, which is a curved (hyperbola-shaped) boundary back in the plane.", r"为什么要这样做：XOR（正例在一条对角线上、负例在另一条上）在二维里没有直线能分开。映射之后第三个坐标 $\sqrt2\,x_1x_2$ 对一类是 $+\sqrt2$，对另一类是 $-\sqrt2$，平面 $\phi_3 = 0$ 就把它们分开了，回到原平面上就是一条弯的（双曲线形）边界。"))],
               intro=T(r"Check the claim $K(\mathbf{x}, \mathbf{z}) = \phi(\mathbf{x})^\top\phi(\mathbf{z})$ for one kernel, symbolically and with numbers.", r"对一个核，用符号和数字各检验一次 $K(\mathbf{x}, \mathbf{z}) = \phi(\mathbf{x})^\top\phi(\mathbf{z})$。"), skill=SK),

        # -------------------------------------------------------------- soft margin
        read('soft', T('The soft margin: slack variables', '软间隔：松弛变量'),
             chapter=T('Soft margin and C', '软间隔与 C'),
             *[p(T(r"Real data have overlap, outliers and label errors. The fix: let each point $i$ break its margin constraint by an amount $\xi_i \ge 0$ (the **slack**), but charge for it.",
                   r"真实数据有重叠、离群点和标签错误。办法：允许每个点 $i$ 违反它的间隔约束，违反量是 $\xi_i \ge 0$（**松弛**），但要收费。")),
               math_(r"\min_{\mathbf{w},\,b,\,\boldsymbol{\xi}}\ \ \tfrac12\|\mathbf{w}\|^2 + C \sum_{i=1}^{n} \xi_i \qquad \text{s.t.}\quad y_i(\mathbf{w}^\top \mathbf{x}_i + b) \ge 1 - \xi_i,\quad \xi_i \ge 0"),
               svg(drawn(fig_soft), T('A soft-margin solution: support vectors with slack 0, between 0 and 1, and above 1.', '一个软间隔的解：松弛为 0、介于 0 与 1、大于 1 的支持向量。')),
               table([T('slack', '松弛'), T('the point', '这个点'), T('role', '角色')],
                     [r'$\xi_i = 0$', T('on or outside its margin line', '在间隔线上或之外'), T('on the line: a support vector; outside: no influence', '在线上：支持向量；在外面：没有影响')],
                     [r'$0 < \xi_i < 1$', T('inside the street, still on the correct side', '在街道里面，但仍在正确的一侧'), T('a support vector, classified correctly with low margin', '支持向量，分类正确但间隔小')],
                     [r'$\xi_i > 1$', T('on the wrong side of the boundary', '在边界错误的一侧'), T('a support vector, misclassified', '支持向量，被分错')]),
               p(T(r"The last row explains why the penalty makes sense: a misclassified point has $\xi_i > 1$, so $\sum_i \xi_i$ is an upper bound on the number of training mistakes. The margin is still read as $1/\|\mathbf{w}^*\|$ (slide 33). Notice that now **three kinds of points are support vectors**: on the margin, inside it, and misclassified.",
                   r"最后一行说明了惩罚为什么合理：被分错的点有 $\xi_i > 1$，所以 $\sum_i \xi_i$ 是训练错误个数的上界。间隔仍读作 $1/\|\mathbf{w}^*\|$（第 33 页）。注意现在**三类点都是支持向量**：在间隔线上的、在间隔里面的、被分错的。"))]),

        read('c', T('What $C$ trades off', '$C$ 在权衡什么'),
             p(T(r"$C$ is the price of one unit of slack. The objective balances two wishes: a wide street ($\tfrac12\|\mathbf{w}\|^2$ small) and few violations ($C\sum\xi_i$ small).",
                 r"$C$ 是一单位松弛的价格。目标在两个愿望之间折中：街道宽（$\tfrac12\|\mathbf{w}\|^2$ 小）、违规少（$C\sum\xi_i$ 小）。")),
             svg(drawn(fig_c), T('The same data fitted with C = 100, 1 and 0.1: the street widens as C falls.', '同一份数据用 C = 100、1、0.1 拟合：C 越小，街道越宽。')),
             table(['', T('large $C$', '$C$ 大'), T('small $C$', '$C$ 小')],
                   [T('violations', '违规'), T('expensive: few, if any', '代价高：很少，甚至没有'), T('cheap: many allowed', '代价低：允许很多')],
                   [T('margin', '间隔'), T('narrow, hugs the data', '窄，紧贴数据'), T('wide', '宽')],
                   [T('risk', '风险'), T('overfitting; outliers pull the boundary (towards the hard margin as $C \\to \\infty$)', '过拟合；离群点拉动边界（$C \\to \\infty$ 趋向硬间隔）'), T('underfitting; the boundary ignores real structure', '欠拟合；边界忽略真实结构')]),
             p(T(r"Compare with regularisation: dividing the objective by $C$ gives $\sum_i \xi_i + \frac{1}{2C}\|\mathbf{w}\|^2$, so $1/C$ plays the role of $\lambda$: **small $C$ = strong regularisation**. As on slides 42-44, $C$ also changes the solution on separable data, since the soft problem is solved even then. $C$ is a hyperparameter chosen by cross-validation, never by training error.",
                 r"和正则化对照：目标除以 $C$ 得 $\sum_i \xi_i + \frac{1}{2C}\|\mathbf{w}\|^2$，所以 $1/C$ 的角色就是 $\lambda$：**$C$ 小 = 正则化强**。如第 42-44 页所示，即使在可分数据上 $C$ 也会改变解，因为软间隔问题那时也在求解。$C$ 是超参数，用交叉验证选，不能靠训练误差选。")),
             quiz(T('Training error is 0 but test error is high, and $C = 10^4$. A sensible next step?', '训练误差为 0、测试误差很高，且 $C = 10^4$。合理的下一步是？'),
                  [(T('Increase $C$ further to punish any remaining errors.', '继续增大 $C$，惩罚剩下的任何错误。'), T('That pushes towards the hard margin and makes overfitting worse.', '这会趋向硬间隔，让过拟合更严重。')),
                   (T('Lower $C$ (and pick it by cross-validation).', '降低 $C$（并用交叉验证来选）。'), True),
                   (T('Nothing: zero training error means the model is optimal.', '什么都不用做：训练误差为零说明模型最优。'), T('Zero training error with a high test error is the signature of overfitting.', '训练误差为零而测试误差高，正是过拟合的特征。'))],
                  T('Lowering $C$ widens the street, tolerates a few training errors, and usually generalises better.', '降低 $C$ 会加宽街道、容忍少量训练错误，通常泛化更好。')),
             details(T('Deeper: the soft-margin dual and the three cases', '再深一点：软间隔的对偶与三种情形'),
                     p(T(r"The dual is the same $W(\boldsymbol{\alpha})$ with one change: the box constraint $0 \le \alpha_i \le C$ (the multiplier of $\xi_i \ge 0$ forces the cap). Complementary slackness then gives the three cases of the slack table:",
                         r"对偶问题还是同一个 $W(\boldsymbol{\alpha})$，只改了一处：盒约束 $0 \le \alpha_i \le C$（$\xi_i \ge 0$ 的乘子迫使出现上界）。互补松弛于是给出松弛表里的三种情形：")),
                     table([r'$\alpha_i$', T('slack', '松弛'), T('point', '点')],
                           [r'$0$', r'$\xi_i = 0$', T('outside the street', '在街外')],
                           [r'$0 < \alpha_i < C$', r'$\xi_i = 0$', T('exactly on the margin line', '恰在间隔线上')],
                           [r'$\alpha_i = C$', r'$\xi_i > 0$', T('inside the street or misclassified', '在街内或被分错')]),
                     p(T(r"$C$ is the most any single point can push, which is why a small $C$ stops an outlier from dragging the boundary.", r"$C$ 是单个点能施加的最大推力，这就是为什么小 $C$ 能阻止离群点拉偏边界。")))),

        derive('hinge', T('Deeper: the soft margin is the hinge loss plus a penalty', '深入：软间隔就是 hinge 损失加惩罚'),
               [(r"\xi_i \ge 1 - y_i f(\mathbf{x}_i), \qquad \xi_i \ge 0, \qquad f(\mathbf{x}) = \mathbf{w}^\top\mathbf{x} + b", T(r"The two constraints on slack, restated with the score $f$.", r"关于松弛的两个约束，用得分 $f$ 重写。")),
                (r"\xi_i = \max\!\big(0,\ 1 - y_i f(\mathbf{x}_i)\big)", T(r"The objective charges $C\xi_i$, so for fixed $(\mathbf{w}, b)$ each $\xi_i$ sits at the *smallest* value both constraints allow: the larger of the two bounds.", r"目标对 $\xi_i$ 收费 $C\xi_i$，所以对固定的 $(\mathbf{w}, b)$，每个 $\xi_i$ 取两个约束允许的*最小*值：两个下界中较大的那个。")),
                (r"\min_{\mathbf{w},b}\ \ \tfrac12\|\mathbf{w}\|^2 + C \sum_{i=1}^{n} \max\!\big(0,\ 1 - y_i f(\mathbf{x}_i)\big)", T("Substitute: the slack variables are gone and the constraints with them. An unconstrained problem.", "代入：松弛变量没有了，约束也随之消失。变成无约束问题。")),
                (r"\ell_h(m) = \max(0,\ 1 - m), \qquad m = y_i f(\mathbf{x}_i)", T(r"The **hinge loss** $\ell_h$ of the (functional) margin $m$: zero once $m \ge 1$ (safely outside the street), then growing linearly as the point enters the street and crosses the boundary.", r"关于（函数）间隔 $m$ 的 **hinge 损失** $\ell_h$：$m \ge 1$ 之后为零（安全地在街外），之后点进入街道、越过边界时线性增长。")),
                (r"\sum_i \ell_h(m_i) + \lambda\,\|\mathbf{w}\|^2, \qquad \lambda = \tfrac{1}{2C}", T(r"Divide by $C$: the SVM is **a loss plus an $L_2$ penalty on the weights**, the same recipe as regularised logistic regression with only the loss changed.", r"除以 $C$：SVM 就是**一个损失加上对权重的 $L_2$ 惩罚**，和正则化的逻辑回归是同一个配方，只是损失换了。"))],
               intro=T(r"Eliminate the slack variables to see what the SVM is really minimising.", r"消去松弛变量，看 SVM 到底在最小化什么。"), skill=SK),

        read('compare', T('SVM, logistic regression, perceptron', 'SVM、逻辑回归、感知机'),
             svg(drawn(fig_margin_losses), T('Losses against the margin m = y·f(x): 0-1, hinge, logistic (scaled to pass through (0,1)) and the perceptron loss.', '损失随间隔 m = y·f(x) 的变化：0-1 损失、hinge、logistic（缩放后过 (0,1)）、感知机损失。')),
             p(T(r"All three are linear classifiers $\text{sign}(\mathbf{w}^\top\mathbf{x} + b)$. They differ in the loss on the margin $m = y\,f(\mathbf{x})$, and therefore in which line they pick.",
                 r"三者都是线性分类器 $\text{sign}(\mathbf{w}^\top\mathbf{x} + b)$。区别在于它们对间隔 $m = y\,f(\mathbf{x})$ 用什么损失，因此挑出的直线也不同。")),
             table(['', T('Perceptron', '感知机'), T('Logistic regression', '逻辑回归'), 'SVM'],
                   [T('loss on $m$', '$m$ 上的损失'), r'$\max(0, -m)$', r'$\log(1 + e^{-m})$', r'$\max(0, 1 - m)$'],
                   [T('zero loss when', '损失为零当'), r'$m \ge 0$ (just correct)', T('never (only tends to 0)', '永远不会（只是趋近 0）'), T('$m \\ge 1$ (outside the street)', '$m \\ge 1$（在街道之外）')],
                   [T('which line', '哪条线'), T('any separating line, depends on the order of updates', '任一可分直线，取决于更新顺序'), T('maximum likelihood; every point pulls a bit', '最大似然；每个点都拉一点'), T('maximum margin; only support vectors pull', '最大间隔；只有支持向量在拉')],
                   [T('output', '输出'), T('a label', '一个标签'), T('a probability', '一个概率'), T('a signed score (distance), no probability', '带符号的得分（距离），没有概率')],
                   [T('non-separable data', '不可分数据'), T('never converges', '永不收敛'), T('fine (weights stay finite with regularisation)', '没问题（有正则化时权重有限）'), T('fine with the soft margin', '软间隔下没问题')],
                   [T('can use kernels', '能用核'), T('yes (kernel perceptron)', '能（核感知机）'), T('yes, but not sparse', '能，但不稀疏'), T('yes, naturally, and sparse', '能，很自然，而且稀疏')]),
             p(T(r"The picture is the point: logistic loss and hinge loss are close cousins (both smooth or piecewise-linear upper bounds of the 0-1 loss). The hinge is **exactly zero beyond $m = 1$**, so well-classified points drop out entirely and only the support vectors matter; the logistic loss never reaches zero, so every point still pulls. The perceptron's loss is zero for $m \ge 0$: it is happy with a point just barely on the right side, hence no margin pressure.",
                 r"这幅图就是要点：logistic 损失和 hinge 损失是近亲（都是 0-1 损失的上界，一个光滑、一个分段线性）。hinge 在 **$m = 1$ 之后恰好为零**，分得好的点完全退场，只有支持向量起作用；logistic 损失永远不到零，所以每个点都还在拉。感知机的损失在 $m \ge 0$ 时就为零：点刚好在正确一侧它就满足了，因此没有扩大间隔的压力。")),
             quiz(T('Which model gives you $P(y = 1 \\mid \\mathbf{x})$ directly, without extra post-processing?', '哪个模型直接给出 $P(y = 1 \\mid \\mathbf{x})$，不需要额外后处理？'),
                  [(T('The SVM: the score is the distance to the boundary, so it is a probability.', 'SVM：得分是到边界的距离，所以是概率。'), T('A distance is unbounded and not calibrated. Probabilities from an SVM need an extra step (e.g. Platt scaling).', '距离没有界，也没有校准。SVM 要得到概率需要额外一步（例如 Platt 缩放）。')),
                   (T('Logistic regression.', '逻辑回归。'), True),
                   (T('The perceptron: it outputs 0 or 1, which are the probabilities.', '感知机：它输出 0 或 1，就是概率。'), T('A hard label is not a calibrated probability: it says nothing about confidence.', '硬标签不是校准的概率：它不说明置信度。'))],
                  T('Only logistic regression models $P(y \\mid \\mathbf{x})$; the SVM and perceptron give decisions.', '只有逻辑回归建模 $P(y \\mid \\mathbf{x})$；SVM 和感知机给出的是决策。'))),

        read('multi', T('More than two classes, and other tasks', '多于两类，以及其他任务'),
             p(T(r"An SVM is binary by construction: a hyperplane has two sides (slide 45). The deck's way (slide 46): give each of the $k$ classes its own weight vector $\boldsymbol{\theta}_1, \dots, \boldsymbol{\theta}_k$ and **learn them jointly**, requiring the correct class to score higher than every other class by a margin of 1:",
                 r"SVM 天生是二分类：超平面只有两侧（第 45 页）。课件的做法（第 46 页）：给 $k$ 个类别各一个权重向量 $\boldsymbol{\theta}_1, \dots, \boldsymbol{\theta}_k$，并且**联合学习**，要求正确类别的得分比其他每个类别都高出 1 的间隔：")),
             math_(r"\min\ \ \tfrac12 \sum_{y=1}^{k} \|\boldsymbol{\theta}_y\|^2 \quad \text{s.t.}\quad \boldsymbol{\theta}_{y_i}^\top \mathbf{x}_i \ \ge\ \boldsymbol{\theta}_{y'}^\top \mathbf{x}_i + 1 \quad \forall\, y' \ne y_i,\ \ i = 1, \dots, n"),
             math_(r"\hat{y} = \arg\max_{y = 1, \dots, k}\ \boldsymbol{\theta}_y^{*\top} \mathbf{x}"),
             p(T(r"The same idea as before: the margin is now the gap between the right class's score and the best wrong one. Two other common reductions to binary SVMs (textbook):",
                 r"想法和前面一样：间隔现在是正确类别的得分与最高的错误类别得分之差。另外两种把问题化为二元 SVM 的常见做法（教材内容）：")),
             table(['', T('One-vs-rest', '一对多'), T('One-vs-one', '一对一')],
                   [T('classifiers for $k$ classes', '$k$ 类需要的分类器数'), '$k$', r'$k(k-1)/2$'],
                   [T('each is trained on', '每个分类器的训练数据'), T('all the data (class $c$ against the rest)', '全部数据（类别 $c$ 对其余）'), T('only the two classes involved', '只有涉及的两个类别')],
                   [T('predict by', '预测方式'), T('highest score', '得分最高者'), T('majority vote over the pairs', '对各对的多数投票')],
                   [T('example: $k = 10$', '例：$k = 10$'), '10', '45']),
             p(T(r"Slide 47 adds that SVMs are used beyond classification: **rating** (e.g. movies), **ranking** (e.g. search results) and **structured prediction** (e.g. dependency parsing, protein structure), by changing what the margin constraints compare.",
                 r"第 47 页补充，SVM 的用途不限于分类：**评分**（如电影）、**排序**（如搜索结果）、**结构化预测**（如依存句法分析、蛋白质结构），做法是改变间隔约束所比较的对象。"))),

        read('procon', T('Strengths, weaknesses, and when to pick it', '优缺点，以及什么时候选它'),
             table([T('Pros (slide 48)', '优点（第 48 页）'), T('Why', '原因')],
                   [T('Maximum margin: good generalisation', '最大间隔：泛化好'), T('the widest street tolerates the most noise; points near the boundary are not trusted', '最宽的街道容忍最多的噪声；不信任靠近边界的点')],
                   [T('Convex optimisation', '凸优化'), T('a QP: one global optimum, no local minima', 'QP：只有一个全局最优，没有局部最小')],
                   [T('Works well in high dimensions', '在高维数据上表现好'), T('the margin does not depend on the number of features; the solution is sparse in the data', '间隔不依赖特征个数；解对数据是稀疏的')]),
             table([T('Cons (slide 48)', '缺点（第 48 页）'), T('Why', '原因')],
                   [T('Sensitive to outliers and label errors', '对离群点和标签错误敏感'), T('one bad point can move the support vectors, and the boundary with them (hard margin)', '一个坏点就能移动支持向量，边界也随之移动（硬间隔）')],
                   [T('No solution if not separable', '不可分时无解'), T('the hard-margin constraints cannot all hold; needs the soft margin', '硬间隔的约束不可能全部成立；需要软间隔')],
                   [T('$C$ needs tuning', '$C$ 需要调'), T('large $C$: few violations but narrow margin; small $C$: wide margin but many violations', '$C$ 大：违规少但间隔窄；$C$ 小：间隔宽但违规多')],
                   [T('Linear boundaries only (plain SVM)', '只有线性边界（普通 SVM）'), T('non-linear data needs kernel methods (not covered in the subject)', '非线性数据需要核方法（本课程不讲）')]),
             p(T(r"Pick an SVM when the data are high-dimensional or small and you want a strong, regularised linear classifier without probabilities. Prefer logistic regression when you need calibrated probabilities, and a different model when the structure is clearly non-linear and you do not use a kernel.",
                 r"数据维度高、或样本少，并且想要一个强而有正则的线性分类器、不需要概率时，选 SVM。需要校准的概率时，选逻辑回归；结构明显非线性又不用核时，选别的模型。"))),

        # -------------------------------------------------------------- exam practice
        number('q-margin', T('Practice: the width of the street', '练习：街道的宽度'), SG,
               T(r"A trained hard-margin SVM has $\mathbf{w} = (1.5,\ 2)$ and $b = 0.5$, in the scale where the support vectors satisfy $y_i(\mathbf{w}^\top \mathbf{x}_i + b) = 1$. How wide is the street between the two margin lines, $2/\|\mathbf{w}\|$?",
                 r"训练好的硬间隔 SVM 有 $\mathbf{w} = (1.5,\ 2)$、$b = 0.5$，所取尺度使支持向量满足 $y_i(\mathbf{w}^\top \mathbf{x}_i + b) = 1$。两条间隔线之间的街道有多宽，即 $2/\|\mathbf{w}\|$？"),
               0.8, T(r"$\|\mathbf{w}\| = \sqrt{1.5^2 + 2^2} = \sqrt{6.25} = 2.5$, so the width is $2/2.5 = 0.8$ (each side of the boundary has $1/2.5 = 0.4$). $b$ does not matter: it only slides the street.", r"$\|\mathbf{w}\| = \sqrt{1.5^2 + 2^2} = \sqrt{6.25} = 2.5$，所以宽度是 $2/2.5 = 0.8$（边界每一侧是 $1/2.5 = 0.4$）。$b$ 无关：它只是平移街道。"),
               tolerance=0.01, hints=(T('Compute $\\|\\mathbf{w}\\|$ first, then $2/\\|\\mathbf{w}\\|$.', '先算 $\\|\\mathbf{w}\\|$，再算 $2/\\|\\mathbf{w}\\|$。'),)),

        number('q-kernel', T('Practice: an RBF kernel value', '练习：一个 RBF 核的值'), SK,
               T(r"The RBF kernel is $K(\mathbf{x}, \mathbf{z}) = \exp(-\gamma\,\|\mathbf{x} - \mathbf{z}\|^2)$. Compute it for $\gamma = 0.2$, $\mathbf{x} = (1, 2)$, $\mathbf{z} = (2, 0)$ (2 decimal places).",
                 r"RBF 核是 $K(\mathbf{x}, \mathbf{z}) = \exp(-\gamma\,\|\mathbf{x} - \mathbf{z}\|^2)$。对 $\gamma = 0.2$、$\mathbf{x} = (1, 2)$、$\mathbf{z} = (2, 0)$ 计算它（保留两位小数）。"),
               0.37, T(r"$\|\mathbf{x} - \mathbf{z}\|^2 = (1-2)^2 + (2-0)^2 = 1 + 4 = 5$, so $K = \exp(-0.2 \cdot 5) = e^{-1} = 0.368$. A value between 0 and 1: the two points are moderately similar.", r"$\|\mathbf{x} - \mathbf{z}\|^2 = (1-2)^2 + (2-0)^2 = 1 + 4 = 5$，所以 $K = \exp(-0.2 \cdot 5) = e^{-1} = 0.368$。值在 0 和 1 之间：两点中等相似。"),
               tolerance=0.01),

        choice('q-c', T('Practice: the effect of $C$', '练习：$C$ 的作用'), SS,
               T('A soft-margin SVM is trained twice on the same data, with $C = 0.01$ and $C = 100$. Which description is correct?', '同一份数据上训练两次软间隔 SVM，$C = 0.01$ 和 $C = 100$。哪一个描述是对的？'),
               [(T('$C = 100$: narrower margin, fewer training violations, higher risk of overfitting.', '$C = 100$：间隔更窄、训练违规更少、过拟合风险更高。'), True),
                (T('$C = 100$: wider margin, because a larger $C$ means a stronger regulariser.', '$C = 100$：间隔更宽，因为 $C$ 越大正则化越强。'), T('It is the other way round: $C$ multiplies the *violation* penalty, so large $C$ is *weak* regularisation. The regulariser is $1/C$.', '正相反：$C$ 乘的是*违规*惩罚，所以 $C$ 大是*弱*正则化。正则化强度是 $1/C$。'), 'c-direction'),
                (T('$C = 0.01$: more support vectors are misclassified because the margin is narrower.', '$C = 0.01$：间隔更窄，所以更多支持向量被分错。'), T('Small $C$ gives a *wider* margin, which usually puts *more* points inside it; the margin is not narrower.', '$C$ 小给出*更宽*的间隔，通常使*更多*点落在间隔里；间隔并不窄。'), 'c-direction'),
                (T('The two give the same boundary on separable data.', '在可分数据上两者给出相同的边界。'), T('Not in general: the soft-margin problem trades margin against slack even when the data are separable (slides 42-44).', '一般不会：即使数据可分，软间隔问题也在间隔与松弛之间权衡（第 42-44 页）。'))],
               T('Large $C$ makes slack expensive, so the optimiser narrows the street to cut violations.', '$C$ 大使松弛很贵，所以优化器会收窄街道来减少违规。'), purpose='check'),

        choice('q-sv', T('Practice: who is a support vector?', '练习：谁是支持向量？'), SO,
               T(r"After training a soft-margin SVM, which of these points is **not** a support vector (so deleting it would not change the solution)?", r"训练软间隔 SVM 之后，下面哪个点**不是**支持向量（删掉它不会改变解）？"),
               [(T('A point exactly on a margin line, with $\\xi = 0$.', '恰好在间隔线上的点，$\\xi = 0$。'), T('A point on the margin line has $y_i f = 1$ and typically $\\alpha_i > 0$: it is a support vector.', '间隔线上的点 $y_i f = 1$，通常 $\\alpha_i > 0$：它是支持向量。')),
                (T('A correctly classified point inside the street, with $0 < \\xi < 1$.', '街道里面分对的点，$0 < \\xi < 1$。'), T('It violates its margin constraint, so its multiplier is at the cap $C$: a support vector.', '它违反了自己的间隔约束，乘子到了上界 $C$：支持向量。')),
                (T('A misclassified point, with $\\xi > 1$.', '被分错的点，$\\xi > 1$。'), T('It has the largest slack, $\\alpha_i = C$: a support vector, and exactly the kind of point that pulls the boundary.', '它的松弛最大，$\\alpha_i = C$：是支持向量，而且正是会拉动边界的那种点。')),
                (T('A point well outside the street, with $y_i f \\gg 1$.', '远在街道之外的点，$y_i f \\gg 1$。'), True)],
               T('Complementary slackness: $\\alpha_i = 0$ whenever $y_i f(\\mathbf{x}_i) > 1$. Only points on or inside the margin, or misclassified, are support vectors.', '互补松弛：只要 $y_i f(\\mathbf{x}_i) > 1$，就有 $\\alpha_i = 0$。只有在间隔上、间隔里或被分错的点才是支持向量。'), purpose='check'),

        text_q('q-text', T('Section A style: slack, $C$ and logistic regression', 'A 部分题型：松弛、$C$ 与逻辑回归'), SS,
               T('In three or four lines: (a) what do the slack variables and the parameter $C$ do in a soft-margin SVM? (b) Give one difference between how an SVM and logistic regression treat a training point that is far on the correct side of the boundary.', '用三四行回答：(a) 软间隔 SVM 里的松弛变量和参数 $C$ 起什么作用？(b) 对一个远在边界正确一侧的训练点，SVM 与逻辑回归的处理方式有什么不同？'),
               [T('slack xi_i: how far point i violates its margin constraint (0 if fine, >1 if misclassified)', '松弛 xi_i：点 i 违反间隔约束多少（没问题为 0，分错则 >1）'),
                T('C: price of slack; large C = few violations, narrow margin; small C = wide margin, more violations', 'C：松弛的价格；C 大 = 违规少、间隔窄；C 小 = 间隔宽、违规多'),
                T('SVM: a point beyond the margin has zero loss and zero influence (not a support vector)', 'SVM：间隔之外的点损失为零、没有影响（不是支持向量）'),
                T('logistic regression: loss never exactly zero, every point still contributes a little gradient', '逻辑回归：损失永远不恰好为零，每个点仍贡献一点梯度')],
               T('(a) The slack variable xi_i measures how much point i violates its margin constraint y_i(w.x_i + b) >= 1 (xi_i = 0 if it is on or outside its margin, 0 < xi_i < 1 if inside the margin, xi_i > 1 if misclassified). The objective 1/2 ||w||^2 + C sum xi_i trades a wide margin against violations: a large C makes violations expensive, giving a narrow margin that fits the training data closely (risk of overfitting); a small C gives a wide margin with more violations (risk of underfitting). C is chosen by cross-validation. (b) For an SVM a point far beyond the margin has hinge loss 0 and alpha_i = 0, so it has no influence on the boundary; logistic regression has a loss that never reaches 0, so every point, even a well-classified one, still contributes a small gradient.',
                 '(a) The slack variable xi_i measures how much point i violates its margin constraint y_i(w.x_i + b) >= 1 (xi_i = 0 if it is on or outside its margin, 0 < xi_i < 1 if inside the margin, xi_i > 1 if misclassified). The objective 1/2 ||w||^2 + C sum xi_i trades a wide margin against violations: a large C makes violations expensive, giving a narrow margin that fits the training data closely (risk of overfitting); a small C gives a wide margin with more violations (risk of underfitting). C is chosen by cross-validation. (b) For an SVM a point far beyond the margin has hinge loss 0 and alpha_i = 0, so it has no influence on the boundary; logistic regression has a loss that never reaches 0, so every point, even a well-classified one, still contributes a small gradient.'),
               T('Part (a) wants the roles of both symbols and the direction of the trade-off; part (b) is the hinge-versus-logistic contrast of the comparison page.', '(a) 要说出两个符号的作用和权衡的方向；(b) 是对比页里 hinge 与 logistic 的区别。')),

        read('remember', T('What to remember: support vector machines', '要记住的：支持向量机'),
             table([T('Item', '内容'), T('Formula or fact', '公式或要点')],
                   [T('classifier', '分类器'), T(r'$\hat y = \text{sign}(\mathbf{w}^\top\mathbf{x} + b)$, labels $\pm1$; $\mathbf{w}$ perpendicular to the boundary', r'$\hat y = \text{sign}(\mathbf{w}^\top\mathbf{x} + b)$，标签 $\pm1$；$\mathbf{w}$ 垂直于边界')],
                   [T('distance', '距离'), T(r'$\dfrac{y_i(\mathbf{w}^\top\mathbf{x}_i + b)}{\|\mathbf{w}\|}$ geometric; without the denominator: functional', r'$\dfrac{y_i(\mathbf{w}^\top\mathbf{x}_i + b)}{\|\mathbf{w}\|}$ 是几何间隔；不除以分母则是函数间隔')],
                   [T('margin', '间隔'), T(r'$\gamma_g = \min_i \dfrac{y_i(\mathbf{w}^\top\mathbf{x}_i + b)}{\|\mathbf{w}\|}$; in the scale where the nearest points have $y_i f = 1$: $\gamma = 1/\|\mathbf{w}\|$, street width $2/\|\mathbf{w}\|$', r'$\gamma_g = \min_i \dfrac{y_i(\mathbf{w}^\top\mathbf{x}_i + b)}{\|\mathbf{w}\|}$；取最近点 $y_i f = 1$ 的尺度时：$\gamma = 1/\|\mathbf{w}\|$，街道宽 $2/\|\mathbf{w}\|$')],
                   [T('hard-margin primal', '硬间隔原问题'), r'$\min \tfrac12\|\mathbf{w}\|^2$ s.t. $y_i(\mathbf{w}^\top\mathbf{x}_i + b) \ge 1$ (a convex QP)'],
                   [T('support vectors', '支持向量'), T('points with tight constraints ($y_i f = 1$); the solution is sparse; LOO error $\\le$ #SV$/n$', '约束取等号的点（$y_i f = 1$）；解是稀疏的；LOO 误差 $\\le$ 支持向量数$/n$')],
                   [T('dual', '对偶'), r'$\max \sum_i\alpha_i - \tfrac12\sum_{i,j}\alpha_i\alpha_j y_i y_j \mathbf{x}_i^\top\mathbf{x}_j$ s.t. $\alpha_i \ge 0$, $\sum_i\alpha_i y_i = 0$; $\mathbf{w} = \sum_i\alpha_i y_i\mathbf{x}_i$'],
                   [T('KKT', 'KKT'), T(r'$\alpha_i[y_i f(\mathbf{x}_i) - 1] = 0$: $\alpha_i > 0$ only on the margin', r'$\alpha_i[y_i f(\mathbf{x}_i) - 1] = 0$：只有在间隔线上才有 $\alpha_i > 0$')],
                   [T('kernel', '核'), T(r'replace $\mathbf{x}_i^\top\mathbf{x}_j$ by $K(\mathbf{x}_i, \mathbf{x}_j) = \phi(\mathbf{x}_i)^\top\phi(\mathbf{x}_j)$: linear, polynomial $(\mathbf{x}^\top\mathbf{z}+c)^d$, RBF $e^{-\gamma\|\mathbf{x}-\mathbf{z}\|^2}$', r'把 $\mathbf{x}_i^\top\mathbf{x}_j$ 换成 $K(\mathbf{x}_i, \mathbf{x}_j) = \phi(\mathbf{x}_i)^\top\phi(\mathbf{x}_j)$：线性、多项式 $(\mathbf{x}^\top\mathbf{z}+c)^d$、RBF $e^{-\gamma\|\mathbf{x}-\mathbf{z}\|^2}$')],
                   [T('soft margin', '软间隔'), T(r'$\min \tfrac12\|\mathbf{w}\|^2 + C\sum_i\xi_i$ s.t. $y_i f(\mathbf{x}_i) \ge 1 - \xi_i$, $\xi_i \ge 0$; $\xi = 0$ / $(0,1)$ / $>1$: on-or-outside / inside / misclassified', r'$\min \tfrac12\|\mathbf{w}\|^2 + C\sum_i\xi_i$，约束 $y_i f(\mathbf{x}_i) \ge 1 - \xi_i$，$\xi_i \ge 0$；$\xi = 0$ / $(0,1)$ / $>1$：在线上或之外 / 在街内 / 被分错')],
                   [T('role of $C$', '$C$ 的作用'), T('large: few violations, narrow margin, overfit; small: wide margin, many violations; tune by CV; $1/C \\sim \\lambda$', '大：违规少、间隔窄、过拟合；小：间隔宽、违规多；用 CV 调；$1/C \\sim \\lambda$')],
                   [T('hinge loss', 'hinge 损失'), T(r'$\max(0, 1 - y f(\mathbf{x}))$: SVM = hinge loss + $\lambda\|\mathbf{w}\|^2$', r'$\max(0, 1 - y f(\mathbf{x}))$：SVM = hinge 损失 + $\lambda\|\mathbf{w}\|^2$')],
                   [T('multiclass', '多类'), T('$k$ weight vectors learned jointly with margin 1 against every other class, $\\arg\\max_y \\boldsymbol{\\theta}_y^\\top \\mathbf{x}$; or one-vs-rest ($k$), one-vs-one ($k(k-1)/2$)', '$k$ 个权重向量联合学习，对每个其他类别间隔为 1，$\\arg\\max_y \\boldsymbol{\\theta}_y^\\top \\mathbf{x}$；或一对多（$k$ 个）、一对一（$k(k-1)/2$ 个）')],
                   [T('pros / cons', '优缺点'), T('max margin, convex, high-dimensional data / outliers, non-separable (hard), tune $C$, linear only (without kernels)', '最大间隔、凸、适合高维 / 离群点、不可分（硬间隔）、要调 $C$、只能线性（不用核时）')],
                   [T('vs LR vs perceptron', '对比 LR 与感知机'), T('hinge: zero beyond the margin, sparse, no probabilities; logistic: never zero, probabilities; perceptron: zero once correct, any separator', 'hinge：间隔之外为零、稀疏、没有概率；logistic：永不为零、有概率；感知机：对了就为零、任一分隔线')])),
    ]
    return dict(
        id=lid('svm'), title=T('Support vector machines', '支持向量机'),
        description=T('The widest street between two classes: the margin 2/‖w‖ derived, the primal, Lagrangian and dual line by line, why only support vectors count, kernels, the soft margin and the hinge loss.', '两类之间最宽的街道：推出间隔 2/‖w‖，逐行推导原问题、拉格朗日函数与对偶问题，为什么只有支持向量起作用，核方法，软间隔与 hinge 损失。'),
        minutes=50,
        skills=[{'id': SG, 'name': T('Hyperplane, margins and the margin width', '超平面、间隔与间隔宽度')},
                {'id': SM, 'name': T('The hard-margin primal', '硬间隔原问题')},
                {'id': SO, 'name': T('Lagrangian, dual and support vectors (KKT)', '拉格朗日函数、对偶与支持向量（KKT）')},
                {'id': SD, 'name': T('Kernel trick (beyond the deck)', '核技巧（超出课件）')},
                {'id': SK, 'name': T('Kernels and the hinge loss', '核与 hinge 损失')},
                {'id': SS, 'name': T('Soft margin, slack and C; comparison with logistic regression', '软间隔、松弛与 C；与逻辑回归的比较')},
                {'id': SC, 'name': T('Multiclass SVM', '多类 SVM')}],
        misconceptions=[{'id': 'c-direction', 'description': T('Getting the direction of $C$ wrong: large $C$ is weak regularisation, a narrow margin', '把 $C$ 的方向弄反：$C$ 大是弱正则化、窄间隔')},
                        {'id': 'every-point-counts', 'description': T('Thinking every training point shapes the SVM boundary (only support vectors do)', '以为每个训练点都影响 SVM 的边界（只有支持向量影响）')},
                        {'id': 'svm-probability', 'description': T('Treating the SVM score as a probability', '把 SVM 的得分当作概率')},
                        {'id': 'functional-vs-geometric', 'description': T('Mixing up functional margin (depends on the scale of $\\mathbf{w}$) and geometric margin (a distance)', '混淆函数间隔（取决于 $\\mathbf{w}$ 的尺度）与几何间隔（一个距离）')}],
        steps=steps)


LESSONS = [L_logreg, L_svm]


# ------------------------------------------------------------------ checks: the literals in the text against the computed values
def _checks():
    near = lambda a, b, tol=6e-4: abs(a - b) < tol
    assert near(sig(-3.5), 0.0293, 5e-4)
    assert [round(z, 2) for z in (lr_z(LR_THETA, d[:3]) for d in LR_DATA)] == [2.2, -3.64, 3.48, 3.04, -0.18]
    assert [round(p_, 3) for p_ in LR_P] == [0.9, 0.026, 0.97, 0.954, 0.455]
    assert [round(e, 3) for e in LR_ERR] == [-0.1, 0.026, -0.03, -0.046, 0.455]
    assert [round(g, 2) for g in LR_GRAD] == [0.3, 11.51, 2.23, 13.38] or [round(g, 3) for g in LR_GRAD][0] == 0.305
    assert [round(g, 3) for g in LR_GRAD][0] == 0.305 and round(LR_GRAD[1], 2) == 11.51 and round(LR_GRAD[2], 2) == 2.23 and round(LR_GRAD[3], 2) == 13.38
    assert [round(t, 4) for t in LR_NEW] == [-18.0003, 0.1085, 0.9578, 0.0866]
    assert round(LR_LOSS0, 3) == 0.815 and round(LR_LOSS1, 3) == 0.772 and round(LR_BIG, 1) == 25.3
    assert [round(SM_Z[k], 3) for k in 'ABC'] == [0.2, 0.4, 0.5] and round(SM_S, 3) == 4.362
    assert [round(SM_P[k], 3) for k in 'ABC'] == [0.28, 0.342, 0.378]
    assert near(sig(0.96), 0.723, 1e-3) and near(sig(1) , 0.731, 1e-3)
    assert round(0.5 - 0.5 * sig(1) * 4, 3) == -0.962
    sg = sig(-6)
    assert near(sg, 0.0025, 1e-4) and near(sg - 1, -0.9975, 1e-4) and near((sg - 1) * sg * (1 - sg), -0.0025, 1e-4)
    assert round(math.exp(0.1), 3) == 1.105 and round(math.exp(3.5), 1) == 33.1
    # the SVM example: every constraint holds, the two support vectors are tight, the street width equals 2/||w||
    for x in SV_POS: assert svm_f(SV_W, SV_B, x) >= 1 - 1e-9
    for x in SV_NEG: assert svm_f(SV_W, SV_B, x) <= -1 + 1e-9
    assert svm_f(SV_W, SV_B, (3, 3)) == 1 and svm_f(SV_W, SV_B, (1, 1)) == -1
    assert [svm_f(SV_W, SV_B, x) for x in ((4, 5), (0, 1))] == [2.5, -1.5]
    assert near(2 / math.hypot(*SV_W), 2 * math.sqrt(2)) and near(math.hypot(2, 2), 2 * math.sqrt(2))
    a = 0.25
    assert dot((3, 3), (3, 3)) == 18 and dot((1, 1), (1, 1)) == 2 and dot((3, 3), (1, 1)) == 6
    assert near(2 * a - 4 * a * a, 0.25) and near(0.5 * dot(SV_W, SV_W), 0.25)
    assert near((20 / math.hypot(3, 4)), 4)
    assert near(2 / math.hypot(1.5, 2), 0.8)
    assert near(math.exp(-0.2 * 5), 0.368, 1e-3)
    assert dot((1, 2), (3, 1)) ** 2 == 25
    s2 = math.sqrt(2)
    fx, fz = (1, s2 * 2, 4), (9, s2 * 3, 1)
    assert near(dot(fx, fz), 25)
    # slack types in the soft-margin figure: all three kinds occur for C = 1
    xs = [xi for _, _, xi in soft_xi(*SOFT_SOL[1])]
    assert any(abs(v) < 1e-6 for v in xs) and any(0 < v < 1 for v in xs) and any(v > 1 for v in xs)


_checks()
