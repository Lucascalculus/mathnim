# COMP90049 lessons: feature selection (deck 12) and anomaly detection (deck 21). Every number of every worked
# example is computed here (nothing typed by hand): the helpers below do the entropy, LOF and z-score arithmetic.
import os
import sys
from collections import Counter
from math import comb, log, log2, sqrt

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from ml_kit import *  # noqa: E402,F403


def f2(x, n=2):
    return f'{x:.{n}f}'


# ================================================================ lesson 1: feature selection
# the deck's worked table (slide 15)
Y8 = [-1, -1, -1, -1, 1, 1, 1, 1]
X8 = {1: [1, 1, 2, 2, 1, 1, 1, 2], 2: [1, 2, 2, 3, 1, 1, 3, 3], 3: [1, 1, 1, 2, 2, 2, 2, 2]}


def mi_bits(x, y):
    n = len(x)
    pj, px, py = Counter(zip(x, y)), Counter(x), Counter(y)
    return sum(c / n * log2((c / n) / (px[a] / n * py[b] / n)) for (a, b), c in pj.items())


def chi_sq(x, y):
    n = len(x)
    pj, px, py = Counter(zip(x, y)), Counter(x), Counter(y)
    return sum((pj[(a, b)] - px[a] * py[b] / n) ** 2 / (px[a] * py[b] / n) for a in px for b in py)


def h_bits(ps):
    return -sum(p * log2(p) for p in ps if p > 0)


MI = {k: mi_bits(X8[k], Y8) for k in X8}
CHI = {k: chi_sq(X8[k], Y8) for k in X8}
G2 = 2 * 8 * MI[2] * log(2)          # the likelihood-ratio statistic: 2 N I (I in nats)
T_CELL = {  # the terms of I(Y;X2): (y, x2, joint, ratio, term)
    (y, x): (c, c / 8 / ((4 / 8) * (Counter(X8[2])[x] / 8)))
    for (x, y), c in Counter(zip(X8[2], Y8)).items()
}


def fits_forward(d):
    return d * (d + 1) // 2


def fig_lattice(lang):
    f = Fig(720, 392, lang)
    rows = [[''.join(b) for b in sorted({tuple('1' if i in s else '0' for i in range(4))
                                         for s in __import__('itertools').combinations(range(4), j)}, reverse=True)] for j in range(5)]
    pos = {}
    for j, row in enumerate(rows):
        for i, name in enumerate(row):
            pos[name] = (120 + (i + 0.5) * (580 / len(row)), 36 + j * 80)
    fwd = ['0000', '1000', '1100', '1110', '1111']
    bwd = ['1111', '0111', '0101', '0100', '0000']
    for name, (x, y) in pos.items():
        for i in range(4):
            if name[i] == '0':
                sup = name[:i] + '1' + name[i + 1:]
                x2, y2 = pos[sup]
                f.line(x, y + 15, x2, y2 - 15, LINE, 1.2)
    for path, col in ((fwd, BLUE), (bwd, ORANGE)):
        for a, b in zip(path, path[1:]):
            (xa, ya), (xb, yb) = pos[a], pos[b]
            lo, hi = (a, b) if a.count('1') < b.count('1') else (b, a)
            (xl, yl), (xh, yh) = pos[lo], pos[hi]
            f.line(xl, yl + 15, xh, yh - 15, col, 3.2)
    for name, (x, y) in pos.items():
        col = BLUE if name in fwd[1:4] else ORANGE if name in bwd[1:4] else INK
        fill = '#eaf0ff' if name in fwd[1:4] else '#fff1e8' if name in bwd[1:4] else '#ffffff'
        f.rect(x - 34, y - 15, 68, 30, fill, col, 1.6, 6)
        f.text(x, y + 5, name, 15, col, 'middle')
    for j in range(5):
        f.text(8, 41 + j * 80, f'{comb(4, j)}', 17, MUTED)
    f.text(8, 18, f.L('subsets', '个子集'), 14, MUTED)
    f.text(716, 41, f.L('start of forward', '前向的起点'), 14, BLUE, 'end')
    f.text(716, 361, f.L('start of backward', '后向的起点'), 14, ORANGE, 'end')
    return f.svg()


def fig_xor(lang):
    f = Fig(440, 330, lang)
    ox, oy, s = 70, 270, 200
    f.line(ox - 20, oy, ox + s + 30, oy, INK, 2, arrow=True)
    f.line(ox, oy + 20, ox, oy - s - 20, INK, 2, arrow=True)
    f.text(ox + s + 34, oy + 22, 'x_{1}', 18, INK, 'end')
    f.text(ox - 12, oy - s - 24, 'x_{2}', 18, INK, 'end')
    for v in (0, 1):
        f.text(ox + v * s, oy + 24, str(v), 15, MUTED, 'middle')
        f.text(ox - 14, oy - v * s + 5, str(v), 15, MUTED, 'end')
    for a in (0, 1):
        for b in (0, 1):
            y = a ^ b
            f.circle(ox + a * s, oy - b * s, 17, '#ffffff' if y == 0 else '#fff1e8', BLUE if y == 0 else ORANGE, 3)
            f.text(ox + a * s, oy - b * s + 6, 'y=' + str(y), 15, BLUE if y == 0 else ORANGE, 'middle')
    return f.svg()


def fig_l0l1(lang):
    f = Fig(660, 270, lang)
    for k, (ox, title) in enumerate(((20, 'L0:  1 − δ(θ, 0)'), (350, 'L1:  |θ|'))):
        w, h, base = 280, 170, 215
        f.line(ox, base, ox + w, base, INK, 2)
        f.line(ox + w / 2, base + 6, ox + w / 2, base - h, INK, 2)
        f.text(ox + w / 2, 30, title, 17, INK, 'middle', 'bold')
        f.text(ox + w - 2, base + 24, 'θ', 17, INK, 'end')
        for v in (-3, 0, 3):
            f.text(ox + w / 2 + v * w / 6.4, base + 24, str(v), 14, MUTED, 'middle')
        cx = ox + w / 2
        if k == 0:
            y1 = base - 110
            f.line(ox + 6, y1, cx - 8, y1, ORANGE, 3.4)
            f.line(cx + 8, y1, ox + w - 6, y1, ORANGE, 3.4)
            f.circle(cx, y1, 6, '#ffffff', ORANGE, 2.4)
            f.circle(cx, base, 6, ORANGE, ORANGE, 1)
            f.text(ox + w / 2 + 14, y1 - 10, '1', 15, MUTED)
        else:
            f.line(ox + 20, base - 130, cx, base, GREEN, 3.4)
            f.line(cx, base, ox + w - 20, base - 130, GREEN, 3.4)
            f.circle(cx, base, 6, GREEN, GREEN, 1)
    return f.svg()


def L_features():
    S_WHY, S_FIL, S_MI, S_WRAP, S_EMB, S_CMP = [f'features.{k}' for k in ('why', 'filter', 'mi', 'wrapper', 'embedded', 'compare')]
    pj = {k: mi_bits(X8[k], Y8) for k in X8}
    hy = 1.0
    # terms of the worked example (y, x2) -> term in bits
    terms = []
    for (y, x) in [(-1, 1), (-1, 2), (-1, 3), (1, 1), (1, 2), (1, 3)]:
        c = Counter(zip(X8[2], Y8))[(x, y)]
        px = Counter(X8[2])[x]
        terms.append((y, x, c, px))
    parts = []
    for y, x, c, px in terms:
        if c:
            r = (c / 8) / ((4 / 8) * (px / 8))
            parts.append(c / 8 * log2(r))
        else:
            parts.append(0.0)
    mi2 = sum(parts)
    assert abs(mi2 - MI[2]) < 1e-12
    # a small table for the checkpoint: X binary, Y: (X=1: 3 yes 1 no), (X=0: 1 yes 3 no)
    mi_cp = 1 - h_bits([.75, .25])
    sec = 10  # seconds per train-and-evaluate cycle (the deck)
    hrs10 = 2 ** 10 * sec / 3600
    hrs60 = 2 ** 60 * sec / 3600
    hrs_f60 = fits_forward(60) * sec / 3600

    def pmi_cell(y, x):
        c = Counter(zip(X8[2], Y8))[(x, y)]
        return log2((c / 8) / ((4 / 8) * (Counter(X8[2])[x] / 8)))

    steps = [
        read('why', T('Why select features, and the map of methods', '为什么要选特征，以及方法地图'),
             p(T(r"You have a table with $d$ attributes and a label. **Feature selection** chooses which of the $d$ attributes the model gets to see. Real data often has thousands to millions of low-level attributes (pixels, words, genes), and most are useless or redundant.",
                 r"你有一张有 $d$ 个属性和一个标签的表。**特征选择**（feature selection）决定模型能看到 $d$ 个属性里的哪些。真实数据常有成千上万甚至上百万个低层属性（像素、单词、基因），其中大多数没用或者重复。")),
             p(T(r"**Main goal:** better performance on the evaluation metric. **Side goals:** the features that survive tell you something about the problem (and can suggest further features); fewer features mean a smaller model and a faster answer.",
                 r"**主要目标：**在评估指标上表现更好。**附带目标：**留下来的特征本身说明了问题的一些东西（还能启发新的特征）；特征少意味着模型小、答案快。")),
             p(T(r"Two questions sort every method. (1) *What does it look at?* A **univariate** method scores one feature at a time; a **multivariate** method scores subsets of features together. (2) *Does it use the classifier?* A **filter** ranks features independently of the classifier; a **wrapper** trains the classifier to assess features; an **embedded** method selects while the model is being trained.",
                 r"两个问题可以把所有方法分类。(1) *它看什么？***单变量**（univariate）方法一次给一个特征打分；**多变量**（multivariate）方法给特征子集一起打分。(2) *它用不用分类器？***过滤法**（filter）不依赖分类器给特征排序；**包装法**（wrapper）训练分类器来评估特征；**嵌入法**（embedded）在训练模型的同时完成选择。")),
             table([T('Family', '类别'), T('Scores', '给什么打分'), T('Uses the classifier?', '用分类器吗'), T('Cost', '代价')],
                   [T('Filter', '过滤法'), T('each feature (or subset) by a statistic', '用统计量给单个特征（或子集）打分'), T('no', '不用'), T('cheapest: linear in $d$', '最便宜：和 $d$ 成线性')],
                   [T('Wrapper', '包装法'), T('subsets, by the classifier\'s validation score', '子集，用分类器的验证分数'), T('yes, retrained for every candidate', '用，每个候选都重训'), T('highest', '最高')],
                   [T('Embedded', '嵌入法'), T('features, as a by-product of training', '特征，作为训练的副产品'), T('yes, but trained far fewer times', '用，但训练次数少得多'), T('in between', '居中')]),
             callout('note', T('Where it sits', '它在流程里的位置'),
                     T(r"Our job as ML practitioners: inspect and clean the data, choose a model suited to the attributes, and choose attributes useful for that model. Feature selection is the third job, and it can be done before the model (filter), around it (wrapper) or inside it (embedded).",
                       r"机器学习从业者的工作：检查清洗数据，选一个适合这些属性的模型，再选对这个模型有用的属性。特征选择是第三件事，可以在模型之前做（过滤），围绕模型做（包装），或在模型内部做（嵌入）。")),
             chapter=T('The map and the filters', '地图与过滤法')),
        read('good', T('What makes one feature good?', '什么样的单个特征是好特征'),
             p(T(r"Look at two categorical features and a label $c$ (four instances):", r"看两个类别型特征和标签 $c$（四个实例）：")),
             table(['$x_1$', '$x_2$', '$c$'], ['A', 'C', 'Y'], ['A', 'D', 'Y'], ['B', 'C', 'N'], ['B', 'D', 'N']),
             p(T(r"$x_1$ is good: knowing it tells you the label (A means Y, B means N). $x_2$ is useless: C and D each appear once with Y and once with N. A good single feature is **dependent** on the label: it can predict the label by itself. “Correlated” is a loose word here, because features can be categorical, not only numbers.",
                 r"$x_1$ 好：知道它就知道标签（A 对应 Y，B 对应 N）。$x_2$ 没用：C 和 D 各自一次配 Y、一次配 N。好的单个特征和标签**相关**（dependent）：自己就能预测标签。这里的“相关”是个宽泛的词，因为特征可以是类别型的，不只是数。")),
             p(T(r"How to score it depends on the type of feature:", r"怎么打分，取决于特征的类型：")),
             table([T('Feature type', '特征类型'), T('Score', '打分方式'), T('Idea', '想法')],
                   [T('continuous', '连续'), T(r'signal-to-noise ratio $S2N = \frac{|\mu_+ - \mu_-|}{\sigma_+ + \sigma_-}$', r"信噪比 $S2N = \frac{|\mu_+ - \mu_-|}{\sigma_+ + \sigma_-}$"), T('class means far apart relative to the spread of each class', '两类均值离得远，相对于各类自己的散布')],
                   [T('categorical', '类别'), T('mutual information, chi-squared', '互信息、卡方'), T('how far the joint is from the product of the marginals', '联合分布离“边缘分布乘积”有多远')],
                   [T('continuous, many classes', '连续、多类'), T('ANOVA F-value', 'ANOVA F 值'), T('between-class variance relative to within-class variance', '类间方差相对类内方差')],
                   [T('numeric target', '数值目标'), T('correlation (e.g. Pearson), as in CFS', '相关系数（如 Pearson），即 CFS'), T('keep features with large $|r|$ with the target', '保留与目标 $|r|$ 大的特征')]),
             p(T(r"Here $\mu_\pm$ and $\sigma_\pm$ are the mean and standard deviation of the feature within the positive and negative class. All of these look at one feature at a time, so scoring all $d$ features costs time linear in $d$.",
                 r"这里 $\mu_\pm$、$\sigma_\pm$ 是该特征在正类、负类内部的均值和标准差。它们都一次只看一个特征，所以给 $d$ 个特征全部打分的时间和 $d$ 成线性。")),
             quiz(T(r"A feature has class means $\mu_+ = 5$, $\mu_- = 3$ and standard deviations $\sigma_+ = \sigma_- = 4$. What is its S2N?", r"一个特征的类均值 $\mu_+ = 5$、$\mu_- = 3$，标准差 $\sigma_+ = \sigma_- = 4$。它的 S2N 是多少？"),
                  [(T(r"0.5", r"0.5"), T(r"You divided by one standard deviation (4) and got 2/4. The denominator is the *sum* $\sigma_+ + \sigma_-$.", r"你只除了一个标准差（4），得 2/4。分母是两个标准差之*和* $\sigma_+ + \sigma_-$。")),
                   (T(r"0.25", r"0.25"), True),
                   (T(r"2", r"2"), T(r"That is the raw gap of the means; S2N divides it by the spread.", r"这是均值之差本身；S2N 还要除以散布。"))],
                  T(r"$|5 - 3| / (4 + 4) = 0.25$: the classes overlap heavily, so this feature is weak.", r"$|5 - 3| / (4 + 4) = 0.25$：两类大量重叠，这个特征很弱。"))),
        read('mi', T('Mutual information: how dependent are Y and X?', '互信息：Y 和 X 有多相关'),
             p(T(r"The slides' tool for the categorical case. Start from what independence means: $P(Y, X) = P(Y)P(X)$, the joint probability is the product of the marginals. **Mutual information** measures how far the joint is from that product:",
                 r"课件处理类别型特征用的工具。先从独立的定义出发：$P(Y, X) = P(Y)P(X)$，联合概率等于边缘概率的乘积。**互信息**（mutual information）度量联合分布偏离这个乘积有多远：")),
             math_(r'I(Y;X) = \sum_{y}\sum_{x} P(y, x)\,\log_2 \frac{P(y, x)}{P(y)\,P(x)}'),
             ul(T(r"$I = 0$: $Y$ and $X$ are independent (the log is 0 in every cell). The feature says nothing about the label.", r"$I = 0$：$Y$ 与 $X$ 独立（每个格子里的对数都是 0）。这个特征对标签什么也没说。"),
                T(r"$I > 0$: they are dependent. The larger, the more knowing $X$ tells you about $Y$ (it is never negative).", r"$I > 0$：二者相关。越大，知道 $X$ 对了解 $Y$ 的帮助越大（它永远不会是负的）。"),
                T(r"Rule: **select the features with the highest $I(Y;X_i)$.**", r"规则：**选 $I(Y;X_i)$ 最高的那些特征。**")),
             p(T(r"From data we plug in empirical frequencies. With $n$ training instances and $\delta(a, b) = 1$ if $a = b$ and 0 otherwise:",
                 r"有数据时，代入经验频率。设有 $n$ 个训练实例，$\delta(a, b)$ 在 $a = b$ 时为 1，否则为 0：")),
             math_(r'\hat P(y, x) = \tfrac{1}{n}\sum_{t=1}^{n}\delta(y, y_t)\,\delta(x, x_{t}) \qquad \hat P(y) = \tfrac{1}{n}\sum_{t}\delta(y, y_t) \qquad \hat P(x) = \tfrac{1}{n}\sum_t \delta(x, x_t)'),
             p(T(r"These are just counts divided by $n$: the share of rows with $(Y, X) = (y, x)$, and the shares of rows with $Y = y$ and $X = x$. A cell with $\hat P(y, x) = 0$ contributes 0 (we define $0 \log 0 = 0$).",
                 r"其实就是计数除以 $n$：$(Y, X) = (y, x)$ 的行占比、$Y = y$ 的行占比、$X = x$ 的行占比。$\hat P(y, x) = 0$ 的格子贡献 0（约定 $0 \log 0 = 0$）。")),
             details(T('Continuous variables', '连续变量'),
                     p(T(r"For continuous $Y, X_i$ the sums become integrals over the densities:", r"对连续的 $Y, X_i$，求和变成对密度的积分：")),
                     math_(r'I(Y, X_i) = \int\!\!\int P(Y, X_i)\,\log\frac{P(Y, X_i)}{P(Y)\,P(X_i)}\,dY\,dX_i')),
             callout('note', T('The other name', '另一个名字'),
                     T(r"Mutual information is **information gain**, the quantity a decision tree maximises when it picks a split: $I(X;Y) = H(Y) - H(Y \mid X)$ (Lecture 5). The next page shows why, and why MI is an *average of pointwise values*.",
                       r"互信息就是**信息增益**（information gain），决策树选分裂时最大化的量：$I(X;Y) = H(Y) - H(Y \mid X)$（第 5 讲）。下一页推出为什么，以及为什么互信息是一堆“逐点值”的*平均*。")),
             chapter=None),
        derive('mi-expected', T('Deeper: MI is the expected PMI, and equals information gain', '深入：互信息是 PMI 的期望，也等于信息增益'),
               [(r'\mathrm{pmi}(x, y) = \log_2\frac{P(x, y)}{P(x)P(y)}',
                 T(r"Look at one cell $(x, y)$ only. **Pointwise mutual information** (PMI) is how much more often the two values occur together than they would if independent, on a log scale. Positive: they attract. Zero: independent. Negative: they repel.",
                   r"只看一个格子 $(x, y)$。**逐点互信息**（pointwise mutual information, PMI）是这两个值同时出现的频率比“若独立应有的频率”高多少，取对数。正：相互吸引；零：独立；负：相互排斥。")),
                (r'I(X;Y) = \sum_{x, y} P(x, y)\,\mathrm{pmi}(x, y)',
                 T(r"Mutual information is each cell's PMI weighted by how likely the cell is: the **expected PMI**, $E_{P(x,y)}[\mathrm{pmi}]$. Common cells count more than rare ones.",
                   r"互信息就是每个格子的 PMI 按该格出现的概率加权：**PMI 的期望** $E_{P(x,y)}[\mathrm{pmi}]$。常见的格子比罕见的格子权重大。"),
                 T(r"It is the KL divergence between $P(x, y)$ and $P(x)P(y)$, and KL divergence is never negative and is 0 only when the two are equal. That is why $I \ge 0$ and $I = 0$ exactly when independent.",
                   r"它是 $P(x, y)$ 与 $P(x)P(y)$ 之间的 KL 散度，而 KL 散度永远不为负，只有两者相等时才为 0。所以 $I \ge 0$，且恰在独立时 $I = 0$。")),
                (r'\frac{P(x, y)}{P(x)P(y)} = \frac{P(y \mid x)}{P(y)}',
                 T(r"Rewrite the ratio inside the log with the definition of conditional probability, $P(x, y) = P(y \mid x)P(x)$. The $P(x)$ cancels.",
                   r"用条件概率的定义 $P(x, y) = P(y \mid x)P(x)$ 改写对数里的比值，$P(x)$ 约掉了。")),
                (r'I = \sum_{x,y} P(x, y)\log_2 P(y \mid x) \;-\; \sum_{x,y} P(x, y)\log_2 P(y)',
                 T(r"Split the log of a ratio into a difference of two logs, and the sum into two sums.", r"把比值的对数拆成两个对数之差，求和也拆成两个。")),
                (r'\sum_{x,y} P(x, y)\log_2 P(y) = \sum_y P(y)\log_2 P(y) = -H(Y)',
                 T(r"In the second sum, summing the joint over $x$ gives the marginal $P(y)$. What is left is minus the entropy of $Y$.",
                   r"第二个求和里，对 $x$ 把联合概率加起来得到边缘 $P(y)$，剩下的正是 $Y$ 的熵的相反数。")),
                (r'\sum_{x,y} P(x, y)\log_2 P(y \mid x) = -H(Y \mid X)',
                 T(r"The first sum is minus the **conditional entropy**: the average uncertainty about $Y$ left once $X$ is known.",
                   r"第一个求和是**条件熵**（conditional entropy）的相反数：知道 $X$ 以后，$Y$ 还剩的平均不确定性。")),
                (r'I(X;Y) = H(Y) - H(Y \mid X)',
                 T(r"Put them together: uncertainty before knowing $X$ minus uncertainty after. This is exactly the **information gain** of splitting a decision tree on $X$ (parent entropy minus the weighted entropy of the children). So a decision tree's greedy split and a filter's ranking are the same computation.",
                   r"合起来：知道 $X$ 之前的不确定性减去之后的。这正是按 $X$ 分裂决策树的**信息增益**（父节点熵减去子节点熵的加权和）。所以决策树的贪心分裂和过滤法的排序，是同一个计算。")),
                (r'I(X;Y) = H(X) - H(X \mid Y)',
                 T(r"The formula is symmetric in $X$ and $Y$, so the same steps give this version. Mutual information is symmetric.", r"公式对 $X$ 和 $Y$ 对称，同样的步骤给出这个版本。互信息是对称的。"))],
               intro=T(r"Why the formula looks the way it does, and the link to the decision-tree lesson.", r"公式为什么长这样，以及它和决策树那一课的联系。"),
               skill=S_MI),
        derive('mi-worked', T('Worked: the deck\'s example, I(Y; X₂) in bits', '算例：课件的例子，I(Y; X₂)（以比特计）'),
               [(r'\hat P(Y{=}{-}1) = \hat P(Y{=}{+}1) = \tfrac{4}{8}',
                 T(r"The eight rows have four of each label. These are the marginals of $Y$.", r"八行里每个标签各四行，这是 $Y$ 的边缘分布。")),
                (r'\hat P(X_2{=}1) = \tfrac38,\;\; \hat P(X_2{=}2) = \tfrac28,\;\; \hat P(X_2{=}3) = \tfrac38',
                 T(r"Count how often each value of $X_2$ appears: value 1 three times, value 2 twice, value 3 three times.", r"数 $X_2$ 每个取值出现的次数：1 出现 3 次，2 出现 2 次，3 出现 3 次。")),
                (r'\hat P(-1, x_2) = \tfrac18,\; \tfrac28,\; \tfrac18 \quad (x_2 = 1, 2, 3)',
                 T(r"Count the joint cells, first those with $Y = -1$.", r"数联合格子，先数 $Y = -1$ 的。")),
                (r'\hat P(+1, x_2) = \tfrac28,\; 0,\; \tfrac28 \quad (x_2 = 1, 2, 3)',
                 T(r"Then $Y = +1$. The cell $(+1, 2)$ never occurs, so it will contribute nothing.", r"再数 $Y = +1$ 的。格子 $(+1, 2)$ 从未出现，所以它不贡献任何东西。")),
                (r'\frac{2/8}{(4/8)(3/8)} = \frac{4}{3}',
                 T(r"The ratio inside the log for the cell $(+1, 1)$: joint $2/8$ over the product of marginals $(4/8)(3/8)$. Above 1 means the pair occurs more often than independence predicts.",
                   r"格子 $(+1, 1)$ 对数里的比值：联合 $2/8$ 除以边缘乘积 $(4/8)(3/8)$。大于 1 表示这一对出现得比独立时更多。")),
                (r'\tfrac18\log_2\tfrac{1/8}{(4/8)(3/8)} = \tfrac18\log_2\tfrac23 = ' + f2(parts[0], 4),
                 T(r"Cell $(-1, 1)$: ratio $2/3 < 1$, so the term is negative (this pair is rarer than chance).", r"格子 $(-1, 1)$：比值 $2/3 < 1$，所以这一项为负（这一对比随机时更少见）。")),
                (r'\tfrac28\log_2\tfrac{2/8}{(4/8)(2/8)} = \tfrac28\log_2 2 = ' + f2(parts[1], 4),
                 T(r"Cell $(-1, 2)$: ratio 2, a whole bit above chance, weighted by $2/8$.", r"格子 $(-1, 2)$：比值 2，比随机多一个比特，权重 $2/8$。")),
                (r'\tfrac18\log_2\tfrac23 = ' + f2(parts[2], 4),
                 T(r"Cell $(-1, 3)$: the same as cell $(-1, 1)$.", r"格子 $(-1, 3)$：与格子 $(-1, 1)$ 相同。")),
                (r'\tfrac28\log_2\tfrac43 = ' + f2(parts[3], 4),
                 T(r"Cell $(+1, 1)$: with the ratio $4/3$ from above.", r"格子 $(+1, 1)$：用上面的比值 $4/3$。")),
                (r'\text{cell } (+1, 2):\;\; 0\cdot\log_2 0 = 0',
                 T(r"Probability 0 contributes 0 by convention.", r"概率为 0 的格子按约定贡献 0。")),
                (r'\tfrac28\log_2\tfrac43 = ' + f2(parts[5], 4),
                 T(r"Cell $(+1, 3)$: the same as cell $(+1, 1)$.", r"格子 $(+1, 3)$：与格子 $(+1, 1)$ 相同。")),
                (r'\hat I(Y; X_2) = ' + ' + '.join(f'({f2(v, 4)})' for v in parts if v) + ' = ' + f2(mi2, 4) + r'\text{ bits}',
                 T(r"Add the five non-zero terms. $X_2$ carries about 0.31 bits of the 1 bit of uncertainty in $Y$ (the entropy of a fair coin).",
                   r"把五个非零项加起来。$Y$ 本身有 1 比特的不确定性（公平硬币的熵），$X_2$ 带走了其中约 0.31 比特。"))],
               blank=(4, '4/3', T(r"The ratio inside the log for the cell $(+1, 1)$: joint over product of marginals.", r"格子 $(+1, 1)$ 对数里的比值：联合概率除以边缘概率的乘积。")),
               outro=T(r"Use $\log_2$ on the exam unless told otherwise; with a calculator, $\log_2 a = \ln a / \ln 2$.", r"考试里除非另说，都用 $\log_2$；计算器上 $\log_2 a = \ln a / \ln 2$。"),
               skill=S_MI),
        read('rank', T('Ranking all three features, and chi-squared', '三个特征排个序，再看卡方'),
             p(T(r"The same table has $X_1$ and $X_3$ too. Doing the same sum for each:", r"同一张表里还有 $X_1$ 和 $X_3$。同样做一遍求和：")),
             table([T('Feature', '特征'), T('$\\hat I(Y; X)$ (bits)', r"$\hat I(Y; X)$（比特）"), T('$\\chi^2$', r"$\chi^2$"), T('Why', '原因')],
                   ['$X_1$', f2(MI[1], 3), f2(CHI[1], 2), T('value 1 and 2 split both classes almost evenly', '取值 1、2 在两个类里几乎各占一半')],
                   ['$X_2$', f2(MI[2], 3), f2(CHI[2], 2), T('value 2 occurs only with $-1$, but 1 and 3 are mixed', '取值 2 只出现在 $-1$，但 1 和 3 混在一起')],
                   ['$X_3$', f2(MI[3], 3), f2(CHI[3], 2), T('value 1 occurs only with $-1$ (3 rows); value 2 is mostly $+1$', '取值 1 只出现在 $-1$（3 行）；取值 2 大多是 $+1$')]),
             p(T(r"Filter: rank $X_3 > X_2 > X_1$ and keep the top $k$. The number $k$ is not given by the filter: it is chosen, often by cross-validation.",
                 r"过滤：排序为 $X_3 > X_2 > X_1$，保留前 $k$ 个。$k$ 不由过滤法给出，需要另外选，常用交叉验证。")),
             h(T('Chi-squared', '卡方')),
             p(T(r"The **chi-squared test** asks the same question as MI in different units: is the contingency table what independence would produce? For each cell compare the observed count $O$ with the count $E = (\text{row total})(\text{column total})/n$ expected under independence:",
                 r"**卡方检验**（chi-squared）问的和互信息是同一个问题，只是单位不同：列联表是不是独立时该有的样子？每个格子拿观测计数 $O$ 与独立时的期望计数 $E = (\text{行合计})(\text{列合计})/n$ 比较：")),
             math_(r'\chi^2 = \sum_{\text{cells}}\frac{(O - E)^2}{E}'),
             p(T(r"For $X_2$: under independence, value 1 should appear 1.5 times with each label, value 2 once, value 3 1.5 times. Observed $(1, 2, 1)$ for $-1$ and $(2, 0, 2)$ for $+1$, so "
                 r"$\chi^2 = 4 \cdot \frac{0.5^2}{1.5} + 2\cdot\frac{1^2}{1} = " + f2(CHI[2], 2) + r"$. It has $(3-1)(2-1) = 2$ degrees of freedom; the 5% critical value is 5.99, so with only 8 rows none of the three features is statistically significant.",
                 r"以 $X_2$ 为例：独立时，取值 1 应在每个标签下各出现 1.5 次，取值 2 各 1 次，取值 3 各 1.5 次。观测到 $-1$ 为 $(1, 2, 1)$，$+1$ 为 $(2, 0, 2)$，于是 "
                 r"$\chi^2 = 4 \cdot \frac{0.5^2}{1.5} + 2\cdot\frac{1^2}{1} = " + f2(CHI[2], 2) + r"$。自由度 $(3-1)(2-1) = 2$，5% 临界值是 5.99，所以只有 8 行时三个特征都不显著。")),
             callout('note', T('Chi-squared and MI agree', '卡方和互信息是一回事的两面'),
                     T(r"For large $n$, $\chi^2 \approx G = 2n \ln 2 \cdot I$ (with $I$ in bits): the chi-squared statistic is MI, scaled by the sample size. Here $G = " + f2(G2, 2) + r"$ against $\chi^2 = " + f2(CHI[2], 2) + r"$ (small $n$, so only roughly equal). Both rank the three features the same way.",
                       r"当 $n$ 较大时，$\chi^2 \approx G = 2n \ln 2 \cdot I$（$I$ 以比特计）：卡方统计量就是按样本量放大的互信息。这里 $G = " + f2(G2, 2) + r"$，$\chi^2 = " + f2(CHI[2], 2) + r"$（$n$ 小，只是大致相等）。两者对三个特征排出同样的顺序。")),
             callout('warning', T('Many-valued features cheat', '取值很多的特征会作弊'),
                     T(r"A feature with a different value on every row (an ID) has estimated $\hat I = H(Y) = 1$ bit, the maximum, though it predicts nothing new. Empirical MI favours features with many values; decision trees correct this with the **gain ratio** (divide by the feature's own entropy).",
                       r"每行取值都不同的特征（比如 ID）估计出的 $\hat I = H(Y) = 1$ 比特，是最大值，可它对新数据毫无预测力。经验互信息偏爱取值多的特征；决策树用**增益率**（gain ratio，除以特征自身的熵）来修正。"))),
        derive('xor', T('Deeper: why a filter misses features that only work together', '深入：为什么过滤法会漏掉“合起来才有用”的特征'),
               [(r'y = x_1 \oplus x_2, \quad x_1, x_2 \in \{0, 1\}',
                 T(r"The label is 1 when exactly one of the two features is 1 (**XOR**, exclusive or). Take the four combinations $(x_1, x_2)$ as four equally likely rows.",
                   r"两个特征恰有一个为 1 时标签为 1（**异或**，XOR）。把四种组合 $(x_1, x_2)$ 当作四个等可能的行。")),
                (r'P(y{=}1 \mid x_1{=}0) = \tfrac12, \qquad P(y{=}1 \mid x_1{=}1) = \tfrac12',
                 T(r"Look at $x_1$ alone. Whether $x_1$ is 0 or 1, half the rows have label 1: the label is 1 when $x_2 = 1$, and $x_2$ is hidden.",
                   r"只看 $x_1$。不管 $x_1$ 是 0 还是 1，都有一半的行标签为 1：$x_2 = 1$ 时标签为 1，而 $x_2$ 被藏起来了。")),
                (r'P(y \mid x_1) = P(y) \;\Rightarrow\; I(Y; X_1) = 0',
                 T(r"The conditional equals the marginal, so $Y$ and $X_1$ are independent and the mutual information is exactly 0.", r"条件概率等于边缘概率，所以 $Y$ 与 $X_1$ 独立，互信息恰好为 0。")),
                (r'I(Y; X_2) = 0',
                 T(r"The same argument, by symmetry, for $x_2$. A univariate filter ranks both features at the bottom and throws them away.", r"对 $x_2$ 同样的论证（由对称性）。单变量过滤法把两个特征都排在最后，扔掉。")),
                (r'I(Y; X_1, X_2) = H(Y) - H(Y \mid X_1, X_2) = 1 - 0 = 1',
                 T(r"Now treat the pair as one variable: knowing both determines $y$ completely, so the conditional entropy is 0 and the pair carries the full bit.",
                   r"现在把这一对当作一个变量：两个都知道时 $y$ 完全确定，条件熵为 0，这一对带有全部的 1 比特。"))],
               intro=T(r"Slide 20 says univariate selection may fail. The smallest example where it must fail:", r"课件第 20 页说单变量选择可能失败。下面是必然失败的最小例子："),
               outro=T(r"A filter judges each feature alone, so it cannot see **interactions**. It also cannot see **redundancy**: two copies of the same good feature both score high, and both are kept. Wrappers, which score the subset, can see both.",
                       r"过滤法一次只评判一个特征，所以看不见**交互**（interaction）；它也看不见**冗余**（redundancy）：同一个好特征的两份拷贝都得高分，都被保留。给子集打分的包装法两者都看得见。"),
               skill=S_FIL),
        read('xor-fig', T('The picture of XOR', 'XOR 的图'),
             svg(drawn(fig_xor), T('Four points at the corners of a square: (0,0) and (1,1) have y=0, (0,1) and (1,0) have y=1.', '正方形四个角上的四个点：(0,0) 和 (1,1) 的 y=0，(0,1) 和 (1,0) 的 y=1。'),
                 T(r"Project onto $x_1$ alone (drop the vertical axis): at $x_1 = 0$ there is one point of each colour, and the same at $x_1 = 1$. Nothing separates the classes on one axis; in the plane, the two diagonals do.",
                   r"投影到 $x_1$ 一条轴（去掉竖轴）：$x_1 = 0$ 处两种颜色各一个点，$x_1 = 1$ 处也一样。单看一条轴分不开两类；在平面里，两条对角线就能分开。")),
             p(T(r"The same shape returns in the perceptron lesson: a linear model on the two features cannot separate XOR either. So an L1-regularised *linear* model would also drop both features. Selection and model must fit each other.",
                 r"同样的图形会在感知机那一课再出现：对这两个特征做线性模型同样分不开 XOR。所以 L1 正则的*线性*模型也会把两个特征都丢掉。选择方法和模型要互相配合。"))),
        read('subsets', T('Wrappers: the search space is a lattice of 2^d subsets', '包装法：搜索空间是 2^d 个子集组成的格'),
             chapter=T('Wrappers and embedded methods', '包装法与嵌入法'),
             *[
                 p(T(r"A **wrapper** treats the classifier as a black box and asks: *which subset of features gives the best validation performance?* Each candidate subset costs one **train-and-evaluate cycle**: train on the training set, score on the validation set.",
                     r"**包装法**（wrapper）把分类器当作黑盒，问：*哪个特征子集让验证集上的表现最好？* 每个候选子集花一次**训练—评估循环**：在训练集上训练，在验证集上打分。")),
                 svg(drawn(fig_lattice), T('The lattice of the 16 subsets of four features, as 4-bit strings (1 = feature chosen), in five rows by size 0 to 4 with 1, 4, 6, 4, 1 subsets. A blue path goes down from 0000 to 1111 adding one feature at a time; an orange path goes from 1111 to 0000 removing one at a time.',
                                           '四个特征的 16 个子集组成的格，用 4 位串表示（1 = 选中），按大小 0 到 4 排成五行，各有 1、4、6、4、1 个子集。蓝色路径从 0000 往下每次加一个特征走到 1111；橙色路径从 1111 每次去掉一个特征走到 0000。'),
                     T(r"Each box is a subset (position = feature, 1 = chosen). Blue: forward selection. Orange: backward elimination.", r"每个框是一个子集（位置 = 特征，1 = 选中）。蓝：前向选择。橙：后向消除。")),
                 p(T(r"How many boxes? Each feature is in or out, so $2^d$. Counting by size gives the same thing: $\binom{d}{0} + \binom{d}{1} + \dots + \binom{d}{d} = (1 + 1)^d = 2^d$ (the binomial theorem with both terms equal to 1).",
                     r"有多少个框？每个特征要么在要么不在，所以是 $2^d$。按大小数也得同一个结果：$\binom{d}{0} + \binom{d}{1} + \dots + \binom{d}{d} = (1 + 1)^d = 2^d$（二项式定理，两项都取 1）。")),
                 p(T(r"**Exhaustive search** tries every box and is guaranteed to find the best subset *for this learner on this validation set*. Its cost is what kills it. Say a fast learner (a decision tree on ~50 000 rows) takes 10 seconds per cycle:",
                     r"**穷举搜索**每个框都试一遍，保证找到*这个学习器在这个验证集上*最好的子集。它的代价让它没法用。假设一个很快的学习器（约 5 万行上的决策树）每次循环 10 秒：")),
                 table(['$d$', T('subsets $2^d$', '子集数 $2^d$'), T('time at 10 s each', '每次 10 秒共需'), T('forward selection', '前向选择')],
                       ['10', '1024', T(f'{hrs10:.1f} hours', f'{hrs10:.1f} 小时'), T(f'{fits_forward(10)} cycles ≈ {fits_forward(10) * sec / 60:.0f} min', f'{fits_forward(10)} 次 ≈ {fits_forward(10) * sec / 60:.0f} 分钟')],
                       ['60', f'{2 ** 60:.2e}', T(f'{hrs60:.1e} hours', f'{hrs60:.1e} 小时'), T(f'{fits_forward(60)} cycles ≈ {hrs_f60:.1f} hours', f'{fits_forward(60)} 次 ≈ {hrs_f60:.1f} 小时')]),
                 p(T(r"Exhaustive search is practical only for very few features. The wrappers in practice are **greedy** searches that walk one path through the lattice.",
                     r"穷举只对很少的特征可行。实际使用的包装法是**贪心**搜索：在格里只走一条路径。"))]),
        read('greedy', T('Forward selection and backward elimination', '前向选择与后向消除'),
             h(T('Forward selection (wrapper)', '前向选择（包装法）')),
             ol(T(r"Start from the empty set $S = \{\}$.", r"从空集 $S = \{\}$ 开始。"),
                T(r"For each feature not in $S$, train the model on $S \cup \{j\}$ and score it on the validation set.", r"对每个不在 $S$ 里的特征 $j$，在 $S \cup \{j\}$ 上训练并在验证集上打分。"),
                T(r"Add the best one to $S$.", r"把最好的那个加入 $S$。"),
                T(r"Repeat until nothing improves or $S$ is as big as wanted; keep the best subset seen.", r"重复，直到没有改进或者 $S$ 够大；保留见过的最好子集。")),
             p(T(r"**Pros:** performs best when the optimal subset is **small**. **Cons:** still $O(d^2)$ cycles; may converge to a sub-optimal (even bad) solution, since each choice is never undone; not feasible on large data sets.",
                 r"**优点：**最优子集**很小**时效果最好。**缺点：**仍要 $O(d^2)$ 次循环；每个选择不会撤销，可能收敛到次优（甚至很差）的解；大数据集上不可行。")),
             h(T('Backward elimination (wrapper)', '后向消除（包装法）')),
             p(T(r"The mirror image: start from all $d$ features; at each step train $|S|$ models, each with one feature removed, and drop the feature whose removal hurts least. **Pros:** removes most irrelevant attributes at the start; best when the optimal subset is **large**. **Cons:** the same: running time, sub-optimal solutions, not feasible on large data (and each early model has many features, so it is slower).",
                 r"镜像做法：从全部 $d$ 个特征开始；每一步训练 $|S|$ 个模型，每个去掉一个特征，丢掉去掉后伤害最小的那个。**优点：**一开始就去掉大部分无关属性；最优子集**较大**时最好。**缺点：**一样：运行时间、次优解、大数据集不可行（而且早期的模型特征很多，更慢）。")),
             p(T(r"**Example:** a decision tree grown with entropy is a forward selection in disguise: at each node it picks the feature that reduces entropy most, and never goes back.",
                 r"**例子：**按熵生长的决策树就是伪装的前向选择：每个节点选熵下降最多的特征，从不回头。")),
             callout('warning', T('Greedy forward selection and XOR', '贪心前向选择碰上 XOR'),
                     T(r"With the XOR pair of the last page and a weak third feature $x_3$, forward selection adds $x_3$ first. Then $x_1$ alone does not improve the score, nor does $x_2$ alone, so it stops. Only a search that tries $\{x_1, x_2\}$ together, such as backward elimination from the full set, finds the pair.",
                       r"碰上前面那对 XOR 特征和一个弱特征 $x_3$，前向选择先加 $x_3$。接着单独加 $x_1$ 不提升分数，单独加 $x_2$ 也不提升，于是停下。只有一次试一对 $\{x_1, x_2\}$ 的搜索，比如从全集开始的后向消除，才找得到这一对。"))),
        derive('fits', T('Deeper: how many model fits does forward selection need?', '深入：前向选择要拟合多少个模型？'),
               [(r'S = d + (d-1) + (d-2) + \dots + 2 + 1',
                 T(r"Step 1 tries each of the $d$ features alone: $d$ fits. Step 2 tries each of the $d - 1$ remaining features added to the chosen one: $d - 1$ fits. And so on, until the last feature is added: 1 fit.",
                   r"第 1 步把 $d$ 个特征各单独试一遍：$d$ 次拟合。第 2 步在已选的上面各加剩下的 $d - 1$ 个特征之一：$d - 1$ 次。依此类推，直到最后一个特征加入：1 次。")),
                (r'S = 1 + 2 + \dots + (d-1) + d',
                 T(r"The same sum written backwards.", r"同一个和，倒过来写。")),
                (r'2S = (d+1) + (d+1) + \dots + (d+1) = d\,(d+1)',
                 T(r"Add the two versions term by term: each column adds up to $d + 1$ and there are $d$ columns (Gauss's trick).", r"把两个版本逐项相加：每一列的和都是 $d + 1$，共有 $d$ 列（高斯的办法）。")),
                (r'S = \frac{d(d+1)}{2}',
                 T(r"Divide by 2. The cost grows like $d^2$, polynomial, against $2^d$ for the exhaustive search. Backward elimination has the same count: $d$ models with one feature removed, then $d - 1$, and so on.",
                   r"除以 2。代价约按 $d^2$ 增长，是多项式，穷举则是 $2^d$。后向消除的次数相同：先 $d$ 个去掉一个特征的模型，再 $d - 1$ 个，依此类推。")),
                (r'd = 4:\;\; \frac{4 \cdot 5}{2} = 10 \;\;(\text{vs } 2^4 = 16)',
                 T(r"The slides' four-feature picture: 10 cycles. For small $d$ the saving is small, and it explodes as $d$ grows.", r"课件里四个特征的图：10 次循环。$d$ 小时省得不多，$d$ 一大就省得惊人。")),
                (r'd = 100:\;\; \frac{100 \cdot 101}{2} = ' + str(fits_forward(100)) + r' \;\;(\text{vs } 2^{100} \approx 1.3 \times 10^{30})',
                 T(r"5050 fits is a few hours at 10 s each; $2^{100}$ is beyond the age of the universe.", r"5050 次拟合，按每次 10 秒算也就几个小时；$2^{100}$ 超过宇宙的年龄。")),
                (r'S_k = \sum_{i=0}^{k-1}(d - i) = kd - \tfrac{k(k-1)}{2}',
                 T(r"If you only want the best $k$ features, stop after $k$ steps; $S_k$ is the number of fits. For $d = 100$, $k = 5$: $500 - 10 = 490$ fits. Multiply any of these by the number of folds if every candidate is scored by $m$-fold cross-validation.",
                   r"如果只要最好的 $k$ 个特征，$k$ 步后就停；$S_k$ 是拟合次数。$d = 100$、$k = 5$：$500 - 10 = 490$ 次拟合。如果每个候选用 $m$ 折交叉验证打分，以上每个数还要乘 $m$。"))],
               intro=T(r"The lecture's claim, $d + (d-1) + \dots + 1 = d(d+1)/2$ cycles, derived.", r"课件的结论 $d + (d-1) + \dots + 1 = d(d+1)/2$ 次循环，现在推出来。"),
               skill=S_WRAP),
        read('assess', T('Assessing a subset, and the price of searching', '怎样评估一个子集，以及搜索的代价'),
             p(T(r"**Assessment.** Split the data into training, validation and test sets. For each feature subset, train on the training set; pick the subset that does best on the **validation** set; report the performance of that one on the **test** set. (With little data, replace the validation set by cross-validation.) Never judge a subset on the test set.",
                 r"**评估。**把数据分成训练集、验证集和测试集。对每个特征子集，在训练集上训练；选在**验证集**上最好的子集；用**测试集**报告它的表现。（数据少时，用交叉验证代替验证集。）绝不要用测试集来评判子集。")),
             p(T(r"**The price of searching.** The more subsets you compare on the same validation set, the more likely the winner is lucky: its validation error is flattering. A bound on the real (generalisation) error captures this:",
                 r"**搜索的代价。**在同一个验证集上比较的子集越多，赢家越可能只是运气好：它的验证误差偏乐观。真实（泛化）误差的一个界刻画了这点：")),
             math_(r'E_{\text{gen}} \;\le\; E_{\text{val}} + \sqrt{\frac{C}{n_{\text{val}}}}'),
             p(T(r"$E_{\text{gen}}$ is the real (generalisation) error, $E_{\text{val}}$ the validation error, $n_{\text{val}}$ the number of validation examples and $C$ the complexity of the search, roughly $\log(\text{number of subsets compared})$ (up to constants).",
                 r"$E_{\text{gen}}$ 是真实（泛化）误差，$E_{\text{val}}$ 是验证误差，$n_{\text{val}}$ 是验证样本数，$C$ 是搜索的复杂度，大致是 $\log(\text{比较过的子集数})$（相差一个常数）。")),
             table([T('Search', '搜索'), T('Subsets compared', '比较的子集数'), T('Complexity $C$', '复杂度 $C$')],
                   [T('all subsets', '所有子集'), '$2^d$', '$\\log 2^d = d$'],
                   [T('all subsets of size $k$', '所有大小为 $k$ 的子集'), '$\\binom{d}{k}$', '$\\approx k\\log d$']),
             p(T(r"So searching all subsets costs a penalty that grows linearly with $d$, while restricting to small subsets of size $k$ grows only like $k \log d$. Intuition: with few validation examples and many candidates, something will look good by chance. More validation data ($n_{\text{val}}$ up) shrinks the penalty.",
                 r"所以搜索全部子集，惩罚随 $d$ 线性增长；只限定在大小为 $k$ 的小子集，则只按 $k \log d$ 增长。直觉：验证样本少、候选多，总有一个碰巧看起来好。验证数据多（$n_{\text{val}}$ 增大）则惩罚变小。")),
             quiz(T(r"You select 10 features out of 5 000 genes using all 100 samples, **then** run 10-fold cross-validation on the 10 chosen features and get 95% accuracy. What is wrong?", r"你用全部 100 个样本从 5000 个基因里选出 10 个，**然后**对这 10 个特征做 10 折交叉验证，得到 95% 的准确率。问题在哪？"),
                  [(T(r"Nothing: cross-validation always gives an honest estimate", r"没问题：交叉验证总能给出诚实的估计"), T(r"Only if every step that looks at labels happens *inside* each fold. Here the selection already saw the labels of every fold's validation part.", r"只有所有看过标签的步骤都发生在每一折*内部*才是这样。这里选择时已经看过每一折验证部分的标签了。")),
                   (T(r"Selection saw the labels of the validation folds, so the 95% is optimistic; selection must be repeated inside each training fold", r"选择时已经看过验证折的标签，所以 95% 偏乐观；选择必须在每个训练折内部重做"), True),
                   (T(r"10 features are too few for 100 samples", r"100 个样本配 10 个特征太少了"), T(r"The number of features is not the problem; the leak is. With 5 000 candidates, some features correlate with the labels by chance, and picking them with all the labels makes any validation score look good.", r"问题不在特征数，而在泄漏。5000 个候选里总有些特征碰巧与标签相关，用全部标签去挑它们，任何验证分数都会好看。"))],
                  T(r"This is the classic selection-bias mistake (Hastie, Tibshirani & Friedman, *ESL* §7.10.2): feature selection is part of the model, so it belongs inside the cross-validation loop.", r"这是经典的选择偏差错误（Hastie、Tibshirani、Friedman，《ESL》§7.10.2）：特征选择是模型的一部分，所以要放在交叉验证的循环里面。"))),
        read('embedded', T('Embedded methods: select while training', '嵌入法：边训练边选'),
             p(T(r"An **embedded** method completes the selection inside the construction of the learning algorithm. Like a wrapper it measures how *useful* features are for predicting $Y$ and finishes with cross-validation, but its search is **guided by what the classifier knows**, so it does not train a new classifier for every candidate. It is similar to a wrapper and cheaper.",
                 r"**嵌入法**（embedded）把选择放进学习算法的构造里完成。和包装法一样，它衡量特征对预测 $Y$ 有多*有用*，最后用交叉验证；但它的搜索**由分类器已有的知识引导**，所以不必为每个候选训练新的分类器。它类似包装法，但便宜。")),
             table([T('Search', '搜索'), T('Wrapper (d = 4)', '包装法（d = 4）'), T('Embedded (d = 4)', '嵌入法（d = 4）')],
                   [T('forward', '前向'), T('trains a new classifier for every candidate: 10 cycles', '每个候选训练一个新分类器：10 次'), T('uses the classifier to judge candidates, trains only after adding one: 4 cycles', '用分类器判断候选，加入一个才训练：4 次')],
                   [T('backward', '后向'), T('trains a new classifier for every candidate removal: 10 cycles', '每个候选的去除都训练一个新分类器：10 次'), T('uses the classifier to judge, trains only after removing one: 4 cycles', '用分类器判断，去掉一个才训练：4 次')]),
             h(T('Example: recursive feature elimination (RFE) with an SVM', '例子：用 SVM 做递归特征消除（RFE）')),
             p(T(r"Hard-margin SVM on $(\mathbf{x}_i, y_i)$, $y_i \in \{-1, +1\}$: minimise $\tfrac12\lVert\boldsymbol\theta\rVert^2 = \tfrac12\sum_{j=1}^{d}\theta_j^2$ subject to $y_i(\boldsymbol\theta\cdot\mathbf{x}_i) \ge 1$. The weight $\theta_j$ says how much the model leans on feature $j$.",
                 r"硬间隔 SVM，数据 $(\mathbf{x}_i, y_i)$，$y_i \in \{-1, +1\}$：在约束 $y_i(\boldsymbol\theta\cdot\mathbf{x}_i) \ge 1$ 下最小化 $\tfrac12\lVert\boldsymbol\theta\rVert^2 = \tfrac12\sum_{j=1}^{d}\theta_j^2$。权重 $\theta_j$ 说明模型有多依赖特征 $j$。")),
             ol(T(r"Start with all features, $S = \{1, \dots, d\}$.", r"从全部特征 $S = \{1, \dots, d\}$ 开始。"),
                T(r"Train an SVM $\boldsymbol\theta$ on the features in $S$.", r"在 $S$ 里的特征上训练 SVM $\boldsymbol\theta$。"),
                T(r"Find the feature $j \in S$ with the smallest $\theta_j^2$.", r"找出 $S$ 里 $\theta_j^2$ 最小的特征 $j$。"),
                T(r"Remove it: $S = S - \{j\}$.", r"去掉它：$S = S - \{j\}$。"),
                T(r"Check that the validation error is not worse; if not, go back to step 2.", r"检查验证误差没有变差；没有的话，回到第 2 步。")),
             p(T(r"One training run per step ($d$ in total), because the weights themselves rank the features. The **wrapper** version of RFE does not use $\theta_j^2$: it trains and evaluates one model per candidate removal and keeps the removal whose model is best, which costs $d(d+1)/2$ runs.",
                 r"每步训练一次（共 $d$ 次），因为权重本身就给特征排了序。RFE 的**包装法**版本不用 $\theta_j^2$：对每个候选的去除各训练、评估一个模型，保留模型最好的那个去除，要 $d(d+1)/2$ 次训练。")),
             callout('warning', T('Weights are only comparable on comparable scales', '权重只有在尺度可比时才可比'),
                     T(r"Ranking features by $\theta_j^2$ assumes the features have comparable scales; standardise them first, or a feature measured in tiny units will get a huge weight for no reason.",
                       r"按 $\theta_j^2$ 给特征排序，默认各特征尺度可比；要先标准化，否则用很小单位度量的特征会无缘无故得到很大的权重。")),
             chapter=None),
        read('l1', T('L0 and L1 regularisation: make the model drop features itself', 'L0 与 L1 正则：让模型自己丢特征'),
             p(T(r"A different strategy: instead of searching over subsets, **change the objective** so that the training itself drives unneeded weights to exactly zero. A weight $\theta_j = 0$ means feature $j$ is not used.",
                 r"另一种策略：不在子集上搜索，而是**改变目标函数**，让训练本身把不需要的权重推到恰好为零。权重 $\theta_j = 0$ 就表示没用特征 $j$。")),
             p(T(r"The direct way: minimise the number of non-zero weights, the **L0 norm** (with $\delta$ the Kronecker delta, 1 if its two arguments are equal, else 0):",
                 r"最直接的做法：最小化非零权重的个数，即 **L0 范数**（$\delta$ 是 Kronecker delta，两个参数相等为 1，否则为 0）：")),
             math_(r'\min_{\boldsymbol\theta}\; \sum_{j=1}^{d}\bigl(1 - \delta(\theta_j, 0)\bigr) \quad\text{s.t.}\quad y_i(\boldsymbol\theta\cdot\mathbf{x}_i) \ge 1,\; i = 1..n'),
             p(T(r"Each term is 1 if $\theta_j \ne 0$ and 0 if $\theta_j = 0$. But this function is **not continuous** (it jumps at 0), so it is not convex and gradients tell us nothing. Amaldi and Kann (1998) showed that this feature selection problem is combinatorially hard: it may require going through all $2^d$ subsets.",
                 r"每一项在 $\theta_j \ne 0$ 时为 1，在 $\theta_j = 0$ 时为 0。但这个函数**不连续**（在 0 处跳变），所以不是凸的，梯度也说明不了什么。Amaldi 和 Kann（1998）证明这个特征选择问题是组合困难的：可能要把 $2^d$ 个子集都过一遍。")),
             p(T(r"The fix: replace the jump by its closest convex relative, the **L1 norm** (taxicab or Manhattan norm):", r"补救办法：用最接近它的凸函数替代那个跳变，即 **L1 范数**（出租车范数或曼哈顿范数）：")),
             math_(r'\min_{\boldsymbol\theta}\; \sum_{j=1}^{d}|\theta_j| \quad\text{s.t.}\quad y_i(\boldsymbol\theta\cdot\mathbf{x}_i) \ge 1,\; i = 1..n'),
             svg(drawn(fig_l0l1), T('Left: the L0 term, equal to 1 everywhere except exactly 0 where it drops to 0. Right: the L1 term |θ|, a V with its corner at 0.', '左：L0 项，除了恰好在 0 处降为 0，其他地方都等于 1。右：L1 项 |θ|，是在 0 处有尖角的 V 形。')),
             p(T(r"It is convex, so it can be minimised reliably, and the solution $\boldsymbol\theta^*$ usually has **few non-zero entries**. In practice it is added to the training loss with a weight $\lambda$ (as in the LASSO): $\text{loss}(\boldsymbol\theta) + \lambda\sum_j|\theta_j|$. The next page shows why the V's corner produces exact zeros.",
                 r"它是凸的，所以能可靠地最小化，解 $\boldsymbol\theta^*$ 通常**只有很少的非零项**。实际中它按权重 $\lambda$ 加到训练损失上（如 LASSO）：$\text{loss}(\boldsymbol\theta) + \lambda\sum_j|\theta_j|$。下一页说明为什么 V 的尖角会产生恰好为零的权重。"))),
        derive('lasso-zero', T('Deeper: why L1 gives exact zeros and L2 does not', '深入：为什么 L1 给出恰好的零而 L2 不会'),
               [(r'f(\theta) = \tfrac12(\theta - a)^2 + \lambda\,|\theta|',
                 T(r"One weight in its simplest form. $a$ is the value the weight would take with no penalty (the fit pulls $\theta$ towards $a$); $\lambda > 0$ is the penalty strength (it pulls $\theta$ towards 0). Take $a > 0$.",
                   r"一个权重的最简形式。$a$ 是没有惩罚时权重的取值（拟合项把 $\theta$ 拉向 $a$）；$\lambda > 0$ 是惩罚强度（把 $\theta$ 拉向 0）。取 $a > 0$。")),
                (r'\theta > 0:\;\; f\,'+"'"+r'(\theta) = \theta - a + \lambda = 0 \;\Rightarrow\; \theta = a - \lambda',
                 T(r"On the right of 0, $|\theta| = \theta$ and the function is smooth. Set the derivative to zero. This is a valid answer only if $a - \lambda > 0$, that is $a > \lambda$.",
                   r"在 0 的右边，$|\theta| = \theta$，函数光滑。令导数为 0。只有 $a - \lambda > 0$，即 $a > \lambda$ 时，这才是有效的解。")),
                (r'a \le \lambda:\;\; f\,'+"'"+r'(\theta) = \theta - a + \lambda \ge -a + \lambda \ge 0 ,\; \theta > 0',
                 T(r"If $a \le \lambda$ the slope is non-negative everywhere on the right of 0, so $f$ only increases there. The penalty's slope $\lambda$ beats the fit's pull $a$.",
                   r"若 $a \le \lambda$，在 0 的右边斜率处处不为负，所以 $f$ 在那里只会上升。惩罚的斜率 $\lambda$ 压过了拟合的拉力 $a$。")),
                (r'\theta < 0:\;\; f\,'+"'"+r'(\theta) = \theta - a - \lambda < 0',
                 T(r"On the left of 0, $a > 0$ and the slope is negative: $f$ decreases towards 0. So the minimum cannot lie on the left.", r"在 0 的左边，$a > 0$，斜率为负：$f$ 向 0 递减。所以最小值不会在左边。")),
                (r'\hat\theta_{L1} = \operatorname{sign}(a)\,\max(|a| - \lambda,\; 0)',
                 T(r"Together (and by symmetry for $a < 0$): **soft thresholding**. Shrink $a$ towards 0 by $\lambda$, and if that crosses 0, stop *at* 0. Whenever $|a| \le \lambda$, the weight is exactly zero: the V's corner traps it.",
                   r"合起来（$a < 0$ 时由对称性）：**软阈值**（soft thresholding）。把 $a$ 向 0 收缩 $\lambda$，如果越过 0，就停*在* 0。只要 $|a| \le \lambda$，权重就恰好为零：V 的尖角把它困住了。")),
                (r'\text{L2 penalty } \lambda\theta^2:\;\; \theta - a + 2\lambda\theta = 0 \;\Rightarrow\; \hat\theta_{L2} = \frac{a}{1 + 2\lambda}',
                 T(r"Compare the squared penalty. Its slope $2\lambda\theta$ shrinks to 0 as $\theta \to 0$, so it never overpowers the fit near 0: it shrinks every weight by a factor but never to exactly 0.",
                   r"对比平方惩罚。它的斜率 $2\lambda\theta$ 在 $\theta \to 0$ 时也趋于 0，所以在 0 附近压不过拟合项：它把每个权重按比例缩小，但绝不会缩到恰好为 0。")),
                (r'a = 0.8,\; \lambda = 1:\;\; \hat\theta_{L1} = 0,\;\; \hat\theta_{L2} = \tfrac{0.8}{3} = ' + f2(0.8 / 3, 3),
                 T(r"A weak feature (pull 0.8, penalty 1): L1 deletes it; L2 keeps a small weight. With $a = 3$: L1 gives 2, L2 gives 1. This is why L1 selects features and L2 (ridge) only shrinks them.",
                   r"一个弱特征（拉力 0.8，惩罚 1）：L1 把它删掉；L2 保留一个小权重。$a = 3$ 时：L1 给 2，L2 给 1。这就是 L1 能选特征而 L2（岭）只能收缩的原因。"))],
               intro=T(r"The slides say the L1 solution “usually has few non-zero entries”. One weight, one derivative, shows why.", r"课件只说 L1 的解“通常只有很少的非零项”。一个权重、一个导数，就能看出为什么。"),
               outro=T(r"In many dimensions the same picture is the L1 ball, a diamond whose corners sit on the axes: the loss contours usually first touch it at a corner, where some coordinates are 0.", r"在高维里，同样的图像就是 L1 球：一个角落在坐标轴上的菱形，损失等高线通常先碰到它的角，那里一些坐标为 0。"),
               skill=S_EMB),
        read('compare', T('Filter, wrapper, embedded: choosing between them', '过滤、包装、嵌入：怎么选'),
             table([T('Aspect', '方面'), T('Filter', '过滤法'), T('Wrapper', '包装法'), T('Embedded / regularised', '嵌入 / 正则')],
                   [T('Criterion', '准则'), T('feature (or subset) relevance to $Y$', '特征（或子集）与 $Y$ 的相关性'), T('subset usefulness for the classifier', '子集对分类器的有用程度'), T('subset usefulness, from the model itself', '子集的有用程度，来自模型本身')],
                   [T('Search', '搜索'), T('sort features (ranking, or nested subsets)', '给特征排序（排名，或嵌套子集）'), T('search the space of subsets; a new classifier for each candidate', '在子集空间里搜索；每个候选一个新分类器'), T('guided by the classifier; no retraining per candidate', '由分类器引导；每个候选不必重训')],
                   [T('Assessment', '评估'), T('none directly; maybe cross-validate $k$', '无直接评估；可能用交叉验证选 $k$'), T('cross-validation', '交叉验证'), T('cross-validation', '交叉验证')],
                   [T('Cost', '代价'), T('lowest, linear in $d$', '最低，和 $d$ 成线性'), T('highest: $d(d+1)/2$ cycles greedy, $2^d$ exhaustive', '最高：贪心 $d(d+1)/2$ 次，穷举 $2^d$'), T('between', '居中')],
                   [T('Sees interactions?', '看得见交互吗'), T('no (univariate)', '看不见（单变量）'), T('yes, for the subsets it tries', '看得见，对试过的子集'), T('as far as the model can use them', '模型能用到的范围内')],
                   [T('Examples', '例子'), T('information gain / MI, chi-square, correlation, S2N, ANOVA F', '信息增益 / 互信息、卡方、相关系数、S2N、ANOVA F'), T('forward selection, backward elimination', '前向选择、后向消除'), T('RFE with an SVM, L1 (LASSO)', '用 SVM 的 RFE、L1（LASSO）')]),
             h(T('In practice', '实践中')),
             ul(T(r"**No method is universally better**: the variable types, data distributions and learners vary too much.", r"**没有哪种方法普遍更好**：变量类型、数据分布、学习器差别太大。"),
                T(r"**Watch the complexity:** a univariate method may serve better than a multivariate one you cannot afford to finish.", r"**注意复杂度：**一个单变量方法，可能比一个你跑不完的多变量方法更实用。"),
                T(r"**Feature selection is not always necessary** to get good performance; some models (regularised, tree ensembles) cope with many features.", r"**特征选择并非总是必要：**有些模型（带正则的、树的集成）自己就能应付很多特征。")),
             quiz(T('Which pair is a wrapper and which a filter?', '下面哪一个是包装法，哪一个是过滤法？'),
                  [(T(r"Ranking genes by mutual information with the disease label (filter); trying gene sets and scoring each with a trained classifier (wrapper)", r"按与疾病标签的互信息给基因排序（过滤）；试基因集并用训练好的分类器给每个集打分（包装）"), True),
                   (T(r"Both are wrappers, since both end in a classifier", r"两个都是包装法，因为最后都要用分类器"), T(r"Whether a *classifier is used to score the features* decides it. A filter may feed its selected features to a classifier afterwards, but its ranking does not involve one.", r"关键是*有没有用分类器给特征打分*。过滤法选出的特征之后当然可以交给分类器，但它的排序过程不涉及分类器。")),
                   (T(r"The first is a wrapper because it uses the label", r"第一个是包装法，因为它用到了标签"), T(r"Both use the label (all supervised selection does). A filter scores a feature against the label with a statistic, not with a trained model.", r"两者都用标签（所有监督的选择都用）。过滤法用统计量比较特征与标签，不用训练好的模型。"))],
                  T(r"Filter: statistic, no classifier, cheap. Wrapper: classifier in the loop, expensive, sees interactions.", r"过滤：用统计量，不用分类器，便宜。包装：循环里有分类器，贵，看得见交互。"))),
        number('cp-forward', T('How many cycles?', '要多少次循环？'), S_WRAP,
               T(r"Forward selection (wrapper), $d = 20$ features, run all the way until every feature has been added, one train-evaluate cycle per candidate. How many cycles?", r"前向选择（包装法），$d = 20$ 个特征，一直做到所有特征都加入，每个候选一次训练—评估循环。共多少次循环？"),
               fits_forward(20),
               T(r"$20 + 19 + \dots + 1 = 20 \cdot 21 / 2 = 210$. (Exhaustive search would need $2^{20} = 1\,048\,576$.)", r"$20 + 19 + \dots + 1 = 20 \cdot 21 / 2 = 210$。（穷举要 $2^{20} = 1\,048\,576$ 次。）"),
               tolerance=0, purpose='practice', chapter=T('Exam practice', '考试练习')),
        number('cp-mi', T('Compute a mutual information', '算一个互信息'), S_MI,
               T(r"Eight instances with a binary feature $X$ and label $Y$: when $X = 1$ there are 4 instances, 3 with $Y = 1$ and 1 with $Y = 0$; when $X = 0$ there are 4 instances, 1 with $Y = 1$ and 3 with $Y = 0$. Compute $I(Y; X)$ in bits, to three decimals. (Hint: $I = H(Y) - H(Y \mid X)$.)",
                 r"八个实例，二值特征 $X$ 和标签 $Y$：$X = 1$ 有 4 个实例，其中 3 个 $Y = 1$、1 个 $Y = 0$；$X = 0$ 有 4 个实例，其中 1 个 $Y = 1$、3 个 $Y = 0$。求 $I(Y; X)$，以比特计，保留三位小数。（提示：$I = H(Y) - H(Y \mid X)$。）"),
               round(mi_cp, 3),
               T(r"$H(Y) = 1$ (4 and 4). Given $X$, each group has probabilities $(3/4, 1/4)$, entropy $-\frac34\log_2\frac34 - \frac14\log_2\frac14 = " + f2(h_bits([.75, .25]), 4) + r"$. So $I = 1 - " + f2(h_bits([.75, .25]), 4) + r" = " + f2(mi_cp, 4) + r"$ bits.",
                 r"$H(Y) = 1$（4 比 4）。给定 $X$，每组的概率是 $(3/4, 1/4)$，熵 $-\frac34\log_2\frac34 - \frac14\log_2\frac14 = " + f2(h_bits([.75, .25]), 4) + r"$。所以 $I = 1 - " + f2(h_bits([.75, .25]), 4) + r" = " + f2(mi_cp, 4) + r"$ 比特。"),
               tolerance=0.002, unit='bits', purpose='practice', hints=[T(r"Both groups have the same entropy, so $H(Y \mid X)$ equals that entropy.", r"两组的熵相同，所以 $H(Y \mid X)$ 就等于这个熵。")]),
        choice('cp-xor', T('Two features that only work together', '只有合起来才有用的两个特征'), S_FIL,
               T(r"Features $A$ and $B$ each have mutual information 0 with the label, but together they determine it (like XOR). Which statement is correct?", r"特征 $A$ 和 $B$ 各自与标签的互信息为 0，合起来却能决定标签（像 XOR）。下面哪句对？"),
               [(T(r"A univariate filter will rank both low and discard them; a wrapper that evaluates the pair together can keep them", r"单变量过滤法会把两者排得很低并丢掉；把这一对放在一起评估的包装法可以保留它们"), True),
                (T(r"The pair has mutual information 0 as well, because MI is additive over features", r"这一对的互信息也是 0，因为互信息对特征是可加的"), T(r"MI is not additive. $I(Y; A, B) = H(Y) - H(Y \mid A, B)$, which is the full $H(Y)$ here.", r"互信息不可加。$I(Y; A, B) = H(Y) - H(Y \mid A, B)$，这里等于整个 $H(Y)$。"), 'mi-additive'),
                (T(r"Greedy forward selection will always find them, because it tries every feature at step 1", r"贪心前向选择总能找到它们，因为第 1 步试了每个特征"), T(r"Each of them alone gives no gain at step 1, so forward selection prefers any feature with a little gain and may never try $\{A, B\}$.", r"每个单独加入都没有收益，所以第 1 步它偏爱任何有一点收益的特征，可能永远不会试 $\{A, B\}$。"), 'forward-optimal'),
                (T(r"A decision tree cannot use them, so they are useless for every model", r"决策树用不上它们，所以对任何模型都没用"), T(r"A tree can split on $A$ then on $B$ and reproduce XOR perfectly; the usefulness depends on the model, which is why wrappers ask the model.", r"决策树先按 $A$ 分、再按 $B$ 分，可以完美复现 XOR；有用与否取决于模型，所以包装法要问模型。"), 'useless')],
               T(r"A filter scores one feature at a time and cannot see interactions; a search over subsets can.", r"过滤法一次评一个特征，看不见交互；在子集上搜索的方法可以。")),
        choice('cp-pick', T('Which family?', '选哪一类？'), S_CMP,
               T(r"You have 20 000 gene-expression features and 150 patients, and need a first shortlist of about 200 genes in minutes, before trying any model. Which family fits best?", r"你有 20000 个基因表达特征和 150 个病人，要在几分钟内、先不试任何模型，得到约 200 个基因的初筛名单。哪一类最合适？"),
               [(T(r"A filter, e.g. rank by mutual information or ANOVA F-value and keep the top 200", r"过滤法，例如按互信息或 ANOVA F 值排序，取前 200"), True),
                (T(r"Exhaustive wrapper search over all subsets", r"对所有子集做穷举的包装法搜索"), T(r"$2^{20000}$ subsets: impossible. Even greedy forward selection needs about $2 \times 10^8$ fits.", r"$2^{20000}$ 个子集：不可能。就是贪心前向选择也要约 $2 \times 10^8$ 次拟合。"), 'wrapper-cheap'),
                (T(r"Backward elimination, because it removes irrelevant features first", r"后向消除，因为它先去掉无关特征"), T(r"It starts with all 20 000 features and trains up to 20 000 models at the first step. Far too slow here.", r"它从全部 20000 个特征开始，第一步就要训练多达 20000 个模型。这里慢得不可接受。"), 'backward-cheap'),
                (T(r"No selection: with 150 patients, more features always help", r"不做选择：150 个病人，特征越多越好"), T(r"With $d \gg n$ extra features mostly add noise and invite overfitting.", r"$d \gg n$ 时，多余的特征大多只增加噪声、招来过拟合。"), 'more-better')],
               T(r"Cost decides: with huge $d$, use a linear-time filter (or an embedded L1 model) first; wrappers are for small $d$ or a pre-shortlisted set.", r"代价决定：$d$ 巨大时先用线性时间的过滤法（或嵌入的 L1 模型）；包装法留给小的 $d$ 或已经初筛过的集合。")),
        text_q('cp-compare', T('Filter versus wrapper (Section A)', '过滤法与包装法（A 部分）'), S_CMP,
               T(r"Compare filter and wrapper feature selection. Give one advantage and one disadvantage of each. (3-4 lines)", r"比较过滤法和包装法的特征选择，各给出一个优点和一个缺点。（3-4 行）"),
               [T('Filter: independent of the classifier, scores features with a statistic (e.g. MI)', '过滤法：独立于分类器，用统计量（如互信息）打分'),
                T('Filter advantage: cheap, linear in the number of features', '过滤法优点：便宜，与特征数成线性'),
                T('Filter disadvantage: ignores interactions / redundancy and the specific model', '过滤法缺点：忽略交互和冗余，也不顾具体的模型'),
                T('Wrapper: trains the classifier on candidate subsets and scores them on validation data / CV', '包装法：在候选子集上训练分类器，用验证集 / 交叉验证打分'),
                T('Wrapper advantage: tuned to the model, can find interacting features; disadvantage: expensive ($d(d+1)/2$ fits greedy, $2^d$ exhaustive), may overfit validation data', '包装法优点：针对模型，能找到有交互的特征；缺点：昂贵（贪心 $d(d+1)/2$ 次拟合，穷举 $2^d$），可能过拟合验证集')],
               T('A filter ranks each feature by a statistic such as mutual information, independently of the classifier. It is cheap (linear in the number of features) but ignores feature interactions and the model that will be used. A wrapper trains the classifier on candidate feature subsets and scores them by validation performance or cross-validation. It is tuned to the model and can find interacting features, but it is expensive (d(d+1)/2 fits for greedy forward selection, 2^d for exhaustive search) and can overfit the validation set.',
                 'A filter ranks each feature by a statistic such as mutual information, independently of the classifier. It is cheap (linear in the number of features) but ignores feature interactions and the model that will be used. A wrapper trains the classifier on candidate feature subsets and scores them by validation performance or cross-validation. It is tuned to the model and can find interacting features, but it is expensive (d(d+1)/2 fits for greedy forward selection, 2^d for exhaustive search) and can overfit the validation set.'),
               T(r"Section A wants the contrast in one breath: what it uses (statistic vs classifier), then its cost and its blind spot.", r"A 部分要你一口气说出对比：各自用什么（统计量还是分类器），然后是代价和盲点。")),
        text_q('cp-design', T('Design: 5 000 features, 200 samples (Section C)', '设计题：5000 个特征，200 个样本（C 部分）'), S_CMP,
               T(r"A hospital wants to predict a disease from 5 000 gene-expression measurements of 200 patients, and a doctor wants a short, explainable list of genes. Design a feature-selection and evaluation pipeline and justify each choice. (A third of a page)",
                 r"一家医院要用 200 个病人的 5000 个基因表达测量来预测某种疾病，医生想要一份简短、可解释的基因清单。设计一条特征选择加评估的流程，并说明每个选择的理由。（约三分之一页）"),
               [T('Cheap filter first (MI / ANOVA F / correlation) to cut 5000 to a few hundred', '先用便宜的过滤法（互信息 / ANOVA F / 相关）把 5000 缩到几百'),
                T('Then an embedded L1 (LASSO) model or RFE, giving a sparse, readable gene list; wrapper too costly at this d', '再用嵌入的 L1（LASSO）模型或 RFE，得到稀疏、可读的基因清单；这个 d 下包装法太贵'),
                T('Do the selection inside each cross-validation training fold (otherwise leakage makes the estimate optimistic); keep a final test set untouched', '选择要在每个交叉验证的训练折内部做（否则泄漏使估计偏乐观）；保留一个最终测试集不动'),
                T('Choose the number of features k and the penalty by cross-validation; use stratified folds for imbalance', '用交叉验证选特征数 k 和惩罚系数；类别不平衡用分层折'),
                T('Check stability and interpretability: repeated selection should give similar genes; correlated genes may be interchangeable', '检查稳定性和可解释性：重复选择应得到相似的基因；相关的基因可能可互换')],
               T('(1) Filter: rank the 5000 genes by mutual information (or ANOVA F-value) with the label and keep a few hundred; this is linear in the number of features and fast. (2) Embedded: fit an L1-regularised logistic regression (LASSO) or SVM-RFE on those, which drives most weights to exactly zero and gives a short, readable gene list; a wrapper is too expensive at this d. (3) All selection and the choice of the number of features and of the penalty happen inside each training fold of cross-validation, with a separate test set kept untouched, otherwise leakage makes the accuracy look better than it is. (4) Use stratified folds if the classes are imbalanced, and check that repeated runs select similar genes, since correlated genes can substitute for each other.',
                 'A filter-then-embedded pipeline: (1) Filter: rank the 5000 genes by mutual information (or ANOVA F-value) with the label and keep a few hundred; linear in the number of features and fast. (2) Embedded: fit an L1-regularised logistic regression (LASSO) or SVM-RFE on those, which drives most weights to exactly zero and gives a short, readable gene list; a wrapper is too expensive at this d. (3) All selection, and the choice of the number of features and the penalty, happen inside each training fold of cross-validation, with a separate test set kept untouched, otherwise leakage makes the accuracy look better than it is. (4) Use stratified folds if the classes are imbalanced, and check that repeated runs select similar genes, since correlated genes can substitute for each other.'),
               T(r"Section C rewards a pipeline with reasons: cost (filter first), interpretability (L1), and honest evaluation (selection inside the folds).", r"C 部分看重有理由的流程：代价（先过滤）、可解释（L1）、评估诚实（选择放在折内）。")),
        read('remember', T('What to remember', '要记住的'), chapter=T('Review sheet', '复习卡'),
             *[
                 table([T('Family', '类别'), T('Idea', '想法'), T('Cost', '代价'), T('Weakness', '弱点')],
                       [T('Filter', '过滤'), T('score each feature (MI, $\\chi^2$, S2N, F, correlation), keep top $k$', '给每个特征打分（MI、$\\chi^2$、S2N、F、相关），保留前 $k$'), T('linear in $d$', '与 $d$ 线性'), T('misses interactions and redundancy', '漏掉交互与冗余')],
                       [T('Wrapper', '包装'), T('search subsets, score each by the trained classifier (CV)', '在子集上搜索，用训练好的分类器（交叉验证）给每个打分'), T('$d(d+1)/2$ greedy, $2^d$ exhaustive', '贪心 $d(d+1)/2$，穷举 $2^d$'), T('slow; greedy can be sub-optimal; overfits validation', '慢；贪心可能次优；过拟合验证集')],
                       [T('Embedded', '嵌入'), T('selection inside training (RFE with $\\theta_j^2$; L1 penalty)', '选择在训练内部完成（用 $\\theta_j^2$ 的 RFE；L1 惩罚）'), T('in between', '居中'), T('tied to one model type', '绑定一种模型')]),
                 math_(r'I(Y;X) = \sum_{y,x} P(y,x)\log_2\frac{P(y,x)}{P(y)P(x)} = E[\mathrm{pmi}] = H(Y) - H(Y\mid X)'),
                 ul(T(r"MI $= 0$ iff independent; MI = information gain; empirical MI favours many-valued features.", r"互信息 $= 0$ 当且仅当独立；互信息 = 信息增益；经验互信息偏爱取值多的特征。"),
                    T(r"Forward / backward selection: $d + (d-1) + \dots + 1 = d(d+1)/2$ cycles; all subsets: $2^d$ (the lattice).", r"前向 / 后向选择：$d + (d-1) + \dots + 1 = d(d+1)/2$ 次循环；所有子集：$2^d$（格）。"),
                    T(r"Forward is best when the optimal subset is small, backward when it is large; both are greedy and can be sub-optimal.", r"前向在最优子集小时最好，后向在最优子集大时最好；两者都是贪心，可能次优。"),
                    T(r"L0 counts non-zero weights (not convex, $2^d$ hard); L1 $\sum|\theta_j|$ is convex and gives exact zeros; L2 only shrinks.", r"L0 数非零权重（非凸，$2^d$ 难）；L1 $\sum|\theta_j|$ 是凸的并给出恰好的零；L2 只收缩。"),
                    T(r"Do selection inside each cross-validation fold; no method is universally best; selection is not always needed.", r"选择要在每个交叉验证折内部做；没有普遍最好的方法；并非总是需要特征选择。"))]),
    ]
    return dict(
        id=lid('features'), title=T('Feature selection: filters, wrappers, embedded', '特征选择：过滤、包装、嵌入'),
        description=T('Why select features, mutual information and chi-squared by hand, why filters miss interactions, what greedy wrappers cost in model fits, and how L1 regularisation selects while it trains.',
                      '为什么要选特征，手算互信息和卡方，过滤法为什么看不见交互，贪心包装法要花多少次模型拟合，以及 L1 正则如何边训练边选特征。'),
        minutes=45,
        skills=[{'id': S_WHY, 'name': T('Why select features; the families', '为什么选特征；各类方法')},
                {'id': S_FIL, 'name': T('Filters and their blind spots', '过滤法及其盲点')},
                {'id': S_MI, 'name': T('PMI, mutual information, information gain', 'PMI、互信息、信息增益')},
                {'id': S_WRAP, 'name': T('Wrappers: forward, backward, cost', '包装法：前向、后向、代价')},
                {'id': S_EMB, 'name': T('Embedded methods and L1 regularisation', '嵌入法与 L1 正则')},
                {'id': S_CMP, 'name': T('Choosing between the families', '在各类方法之间选择')}],
        misconceptions=[{'id': 'mi-additive', 'description': T('Thinking mutual information adds up over features, so features useless alone are useless together', '以为互信息对特征可加，单独没用的特征合起来也没用')},
                        {'id': 'forward-optimal', 'description': T('Thinking greedy forward selection finds the best subset', '以为贪心前向选择能找到最好的子集')},
                        {'id': 'wrapper-cheap', 'description': T('Underestimating the cost of wrappers on many features', '低估包装法在特征很多时的代价')},
                        {'id': 'select-then-cv', 'description': T('Selecting features on all the data and then cross-validating (leakage)', '先用全部数据选特征、再做交叉验证（泄漏）')}],
        steps=steps)


# ================================================================ lesson 2: anomaly detection
TEMP = [24.0, 28.9, 28.9, 29.0, 29.1, 29.1, 29.2, 29.2, 29.3, 29.4]      # slide 25
DECK1D = [1, 1.05, 1.1, 1.15, 1.2, 1.21, 1.3, 1.4, 1.45, 1.5, 4.55, 5.6, 6.8, 7.58, 8.6, 9.7, 10.3, 11.4, 12.3, 13.5]   # slide 39
PTS = {'A': (0, 1), 'B': (2, 0), 'C': (1, 0), 'D': (1, 1), 'E': (10, 6), 'F': (14, 4), 'G': (12, 0), 'H': (10, 0), 'I': (5, 2)}


def manhattan(p, q):
    return sum(abs(a - b) for a, b in zip(p, q))


def knn_of(q, data, k, dist):
    """The k nearest neighbours of q among data (q itself left out), as (distance, point)."""
    return sorted((dist(q, y), y) for y in data if y != q)[:k]


def density_1d(q, data, k):
    """The lecture's density: the inverse of the mean distance to the k nearest neighbours."""
    return 1 / (sum(d for d, _ in knn_of(q, data, k, lambda a, b: abs(a - b))) / k)


def inv_rel_density(q, data, k):
    """The lecture's outlier score: mean neighbour density over own density (the inverse of 'relative density')."""
    nn = knn_of(q, data, k, lambda a, b: abs(a - b))
    return (sum(density_1d(y, data, k) for _, y in nn) / k) / density_1d(q, data, k)


def lof_table(P, k, dist=manhattan):
    """Classic LOF (Breunig et al. 2000): k-distance, neighbourhood, reach-distance, lrd, LOF, for every point."""
    names = list(P)
    d = {(a, b): dist(P[a], P[b]) for a in names for b in names}
    kd = {a: sorted(d[a, b] for b in names if b != a)[k - 1] for a in names}
    nb = {a: [b for b in names if b != a and d[a, b] <= kd[a]] for a in names}
    reach = {(a, b): max(kd[b], d[a, b]) for a in names for b in names}
    lrd = {a: len(nb[a]) / sum(reach[a, b] for b in nb[a]) for a in names}
    lof = {a: sum(lrd[b] for b in nb[a]) / len(nb[a]) / lrd[a] for a in names}
    return d, kd, nb, reach, lrd, lof


def fig_pts(lang):
    f = Fig(620, 310, lang)
    ox, oy, sx, sy = 36, 276, 37, 36
    X = lambda x: ox + x * sx
    Yc = lambda y: oy - y * sy
    f.ellipse(X(1), Yc(0.5), 70, 52, BLUE, 0.1, BLUE)
    f.ellipse(X(12), Yc(3), 130, 120, GREEN, 0.08, GREEN)
    f.text(X(1), Yc(0.5) - 66, f.L('dense', '稠密'), 16, BLUE, 'middle')
    f.text(X(12) + 20, Yc(3) - 128, f.L('sparse', '稀疏'), 16, GREEN, 'middle')
    for q in ('B', 'D'):
        f.line(X(5), Yc(2), X(PTS[q][0]), Yc(PTS[q][1]), ORANGE, 1.8, '6 5')
    for n, (x, y) in PTS.items():
        col = ORANGE if n == 'I' else BLUE if x < 4 else GREEN
        f.circle(X(x), Yc(y), 8, col, '#ffffff', 1.6)
        f.text(X(x) + 12, Yc(y) - 9, n, 17, col, weight='bold')
    return f.svg()


def fig_mahal(lang):
    f = Fig(520, 380, lang)
    cx, cy, u = 260, 190, 56
    for k, op in ((3, 0.05), (2, 0.10)):
        rx, ry = k * 1.342 * u, k * 0.447 * u
        f.parts.append(f'<ellipse cx="{cx}" cy="{cy}" rx="{rx:.1f}" ry="{ry:.1f}" fill="{BLUE}" fill-opacity="{op}" stroke="{BLUE}" stroke-width="1.4" stroke-dasharray="5 5" transform="rotate(-45 {cx} {cy})"/>')
    r = 2 * 1.4142 * u
    f.parts.append(f'<circle cx="{cx}" cy="{cy}" r="{r:.1f}" fill="none" stroke="{MUTED}" stroke-width="1.4" stroke-dasharray="2 5"/>')
    f.cross(cx, cy, 7, INK)
    f.text(cx - 12, cy + 24, 'μ', 17, INK, 'end')
    for name, (x, y), col in (('A', (2, 2), GREEN), ('B', (2, -2), ORANGE)):
        px, py = cx + x * u, cy - y * u
        f.line(cx, cy, px, py, col, 2, '6 4')
        f.circle(px, py, 8, col, '#ffffff', 1.6)
        f.text(px + 12, py - 8, name, 18, col, weight='bold')
    f.text(cx + 150, cy - 168, 'D_{M} = 2.1', 15, GREEN)
    f.text(cx + 150, cy + 190 - 12, 'D_{M} = 6.3', 15, ORANGE)
    f.text(8, 24, f.L('same Euclidean distance', '欧氏距离相同'), 15, MUTED)
    return f.svg()


def L_anomaly():
    S_DEF, S_STAT, S_PROX, S_DENS, S_CLU, S_CMP = [f'anomaly.{k}' for k in ('definition', 'statistical', 'proximity', 'density', 'clustering', 'compare')]
    # -- imbalance (numbers computed here)
    N, A = 10000, 50
    normal = N - A
    fpr, rec = 0.02, 0.8
    tp, fp = round(rec * A), round(fpr * normal)
    fn, tn = A - tp, normal - fp
    prec = tp / (tp + fp)
    acc_det = (tp + tn) / N
    acc_zero = normal / N
    # -- the z-score example
    n = len(TEMP)
    mu = sum(TEMP) / n
    ss = sum((x - mu) ** 2 for x in TEMP)
    var = ss / n
    sd = sqrt(var)
    z_exact = abs(24.0 - mu) / sd
    z_slide = abs(24.0 - mu) / 1.51
    sd_s = sqrt(ss / (n - 1))
    z_s = abs(24.0 - mu) / sd_s
    zmax_pop = sqrt(n - 1)
    zmax_sam = (n - 1) / sqrt(n)
    G_CRIT = 2.29     # Grubbs two-sided, alpha 0.05, n = 10 (standard table value, 2.2900)
    # -- Mahalanobis
    # Sigma = [[1, .8], [.8, 1]]  ->  inverse = 1/0.36 * [[1, -.8], [-.8, 1]]
    det = 1 - 0.8 ** 2

    def md2(x, y):
        return (x * x - 2 * 0.8 * x * y + y * y) / det
    mdA, mdB = md2(2, 2), md2(2, -2)
    # -- k-distance table
    K1 = [1.0, 1.2, 1.4, 1.6, 1.8, 2.0, 8.0, 8.3]
    kn = {k: [sorted(abs(a - b) for j, b in enumerate(K1) if j != i)[k - 1] for i, a in enumerate(K1)] for k in (1, 2, 3)}
    # -- LOF
    d, kd, nb, reach, lrd, lof = lof_table(PTS, 2)
    assert nb['I'] == ['B', 'D'] and abs(lof['I'] - 10 / 3) < 1e-9
    # -- the deck's 1-D example
    ir05, ir4 = inv_rel_density(0.5, DECK1D, 2), inv_rel_density(4, DECK1D, 2)
    nn05 = knn_of(0.5, DECK1D, 2, lambda a, b: abs(a - b))
    nn4 = knn_of(4, DECK1D, 2, lambda a, b: abs(a - b))
    d05, d4 = density_1d(0.5, DECK1D, 2), density_1d(4, DECK1D, 2)
    # -- CBLOF
    sizes = [60, 30, 6]
    tot = sum(sizes)
    cum = [sum(sizes[:i + 1]) / tot for i in range(3)]
    cb_t1, cb_t2, cb_t3 = 6 * min(9.0, 6.0), 60 * 4.0, 30 * 1.0
    # -- checkpoints
    N2, A2 = 5000, 50
    tp2, fp2 = round(0.8 * A2), round(0.02 * (N2 - A2))
    prec2 = tp2 / (tp2 + fp2)
    CP_DATA = [1.0, 1.1, 1.3, 1.5, 5.0, 5.6, 6.4, 7.4]
    cp_ir = inv_rel_density(2.4, CP_DATA, 2)
    cp_md = sqrt(4 ** 2 / 4 + 2 ** 2 / 1)

    def r(v, k=1):
        return f'{v:.{k}f}'

    steps = [
        read('what', T('What an anomaly is', '什么是异常'),
             p(T(r"An **anomaly** (or outlier) is a data object that deviates so much from the normal objects that it looks as if a **different mechanism** generated it. A credit-card purchase in another country minutes after one at home; a sensor reading from a failing machine; a skin lesion among healthy ones.",
                 r"**异常**（anomaly，也叫离群点 outlier）是偏离正常对象很远、看上去像是由**另一种机制**产生的数据对象。比如在家刷卡几分钟后又在另一个国家刷了一笔；一台快坏的机器的传感器读数；一片健康皮肤上的一块病变。")),
             ul(T(r"**Uses:** banking and insurance fraud, bots and hacked accounts, intrusion and surveillance, sudden changes in customer behaviour, weather and seismic anomalies, melanoma checks, and cleaning outliers out of a data set before machine learning.", r"**用途：**银行和保险欺诈、机器人账号和被盗账号、入侵和监控、客户行为突变、气象和地震异常、黑色素瘤筛查，以及在机器学习之前把离群点从数据里清掉。"),
                T(r"**Not the same as noise.** Noise is random error in a measured value and should be removed *before* anomaly detection. An anomaly violates the mechanism that generates the normal data, and is often the interesting (even critical) part.", r"**和噪声不是一回事。**噪声是测量值里的随机误差，应当在做异常检测*之前*去掉。异常违背的是产生正常数据的机制，往往正是有趣（甚至关键）的部分。")),
             callout('note', T('The ozone hole that was filtered out', '被滤掉的臭氧空洞'),
                     T(r"In 1985 British Antarctic Survey data showed Antarctic ozone 10% below normal. NASA's Nimbus 7 satellite had recorded such values too, but the values were so low that a program treated them as noise and discarded them. Cleaning “noise” can delete the discovery.",
                       r"1985 年英国南极调查的数据显示南极臭氧比正常低 10%。NASA 的 Nimbus 7 卫星其实也记录到了这样的值，但数值低得离谱，被程序当作噪声丢掉了。清洗“噪声”可能把发现一并删掉。")),
             h(T('Three ways to pose the task', '提出任务的三种方式')),
             ol(T(r"Find all $\mathbf{x} \in D$ whose **anomaly score** is above a threshold $t$ (the score function and $t$ learned from labelled normal data).", r"找出 $D$ 中**异常分数**超过阈值 $t$ 的所有 $\mathbf{x}$（分数函数和 $t$ 从带标签的正常数据学得）。"),
                T(r"Find the **top-$n$** points by score $f(\mathbf{x})$: exploratory analysis, when you can only look at a few.", r"找出分数 $f(\mathbf{x})$ **最高的 $n$ 个**点：探索性分析，只能看有限几个时用。"),
                T(r"Given mostly normal unlabelled data $D$ and a **new point** $\mathbf{x}$, score $\mathbf{x}$ against $D$: points arriving one by one (a stream).", r"给定大部分正常的无标签数据 $D$ 和一个**新点** $\mathbf{x}$，对照 $D$ 给 $\mathbf{x}$ 打分：数据逐条到来（数据流）。")),
             chapter=T('What anomalies are and why they are hard', '什么是异常，为什么难')),
        read('types', T('Three types of anomaly', '三类异常'),
             table([T('Type', '类型'), T('Deviates from...', '偏离的是…'), T('Example', '例子'), T('Needs', '需要')],
                   [T('**Global / point**', '**全局 / 点异常**'), T('the rest of the whole data set', '整个数据集的其余部分'), T('an intrusion in network traffic', '网络流量里的一次入侵'), T('a good measure of deviation', '一个好的偏离度量')],
                   [T('**Contextual / conditional**', '**上下文 / 条件异常**'), T('what is normal *in its context*', '*它所处上下文里*的正常'), T('10 °C: normal in a Paris winter, odd in a Paris summer; and in Melbourne, 10 °C in a day is ordinary any time of year', '10 °C：在巴黎冬天正常，夏天反常；而在墨尔本，一天里出现 10 °C 并不稀奇'), T('a meaningful definition of context', '一个有意义的上下文定义')],
                   [T('**Collective**', '**集体异常**'), T('the data set, as a *group*; members may each look normal', '数据集，作为一个*群体*；成员单看可能都正常'), T('login attempts from many IPs in a short time; an odd subsequence in a time series', '短时间内来自许多 IP 的登录尝试；时间序列里一段奇怪的子序列'), T('relations among instances: sequence, space or graph', '实例之间的关系：序列、空间或图')]),
             p(T(r"**Contextual anomalies.** The attributes split into **contextual attributes** (they define the context: time, location) and **behavioural attributes** (what is judged: temperature). An object is a contextual anomaly if its behavioural attributes are unusual *given* its contextual ones. This generalises *local* anomalies, whose density deviates from its local area, because a context need not be spatial. The hard part is defining a meaningful context.",
                 r"**上下文异常。**属性分成**上下文属性**（定义上下文：时间、地点）和**行为属性**（被评判的：温度）。如果行为属性在*给定*上下文属性时不寻常，这个对象就是上下文异常。它推广了*局部*异常（密度和其局部区域差很多），因为上下文不一定是空间上的。难点是怎样定义有意义的上下文。")),
             p(T(r"**Collective anomalies.** Each member of the group may be unremarkable; the *group* is not. Detecting them needs the relationships between instances (sequential, spatial or graph data), not only each instance's own values.",
                 r"**集体异常。**群体里的每个成员单看也许平平无奇，*群体*却不平常。检测它们需要实例之间的关系（序列、空间或图数据），不能只看每个实例自己的取值。")),
             quiz(T('A heart rate of 120 beats/min is recorded for a patient who is asleep. Which type?', '一个睡着的病人心率记录为 120 次/分。是哪一类？'),
                  [(T(r"Global: 120 is above the average heart rate of everyone", r"全局异常：120 高于所有人的平均心率"), T(r"120 is perfectly normal during exercise, so by value alone it is not extreme. What makes it odd is the context (asleep).", r"运动时 120 完全正常，光看数值并不极端。让它反常的是上下文（睡着）。")),
                   (T(r"Collective: a run of high readings", r"集体异常：一连串偏高的读数"), T(r"The question describes one reading in a context, not a group that is odd only together.", r"题目描述的是一个上下文里的一个读数，不是只有放在一起才奇怪的一群。")),
                   (T(r"Contextual: the behavioural attribute (heart rate) is unusual given the contextual one (asleep)", r"上下文异常：行为属性（心率）在给定上下文属性（睡着）时反常"), True)],
                  T(r"Contextual attribute: state (asleep). Behavioural attribute: heart rate. Same value, different verdict.", r"上下文属性：状态（睡着）。行为属性：心率。同一个数值，不同的判决。"))),
        read('hard', T('Three settings, and why the task is hard', '三种设定，以及为什么这件事难'),
             p(T(r"What makes anomaly detection different from ordinary classification: anomalies are **rare**, often **unlabelled**, and the next kind of anomaly may look like none you have seen. The settings differ in what labels you have:",
                 r"异常检测和普通分类不同的地方：异常**很少**，往往**没有标签**，而且下一种异常也许和你见过的都不像。几种设定的区别在于手里有什么标签：")),
             table([T('Setting', '设定'), T('Labels', '标签'), T('How it works', '做法'), T('Challenges', '挑战')],
                   [T('**Supervised**', '**监督**'), T('both normal and anomaly', '正常和异常都有'), T('train a classifier on expert-labelled samples', '用专家标注的样本训练分类器'),
                    T('needs labels of both; classes very imbalanced (boost the anomaly class or make artificial anomalies); cannot detect unknown or emerging anomalies; accuracy is misleading, so aim for recall, which brings false positives', '两类标签都要；类别极不平衡（要加强异常类或造人工异常）；检测不到未知和新出现的异常；准确率会误导，要追求召回，这会带来误报')],
                   [T('**Semi-supervised**', '**半监督**'), T('normal only', '只有正常'), T('learn what normal looks like; anything outside the learned boundary (high residual, low probability) is flagged', '学“正常”的样子；落在学到的边界之外（残差大、概率低）的就标为异常'),
                    T('needs labelled normal data; high false-alarm rate, since a legitimate but unseen record looks like an anomaly', '需要有标签的正常数据；误报率高，因为合法但没见过的记录看上去像异常')],
                   [T('**Unsupervised**', '**无监督**'), T('none', '没有'), T('assume normal objects are clustered in groups with distinct features; an outlier is far from every group; build a profile of normal, flag what differs', '假设正常对象聚成有各自特征的群；离群点离每个群都远；建立“正常”的画像，标出与之不同的'),
                    T('normal activity may be diverse and share no pattern, while collective outliers may be very similar to each other; high false-positive rate and still misses real outliers', '正常活动可能很多样、没有共同模式，而集体离群点之间反而很像；误报率高，仍会漏掉真正的离群点')]),
             p(T(r"The rest of the lesson is the **unsupervised** toolbox: four families, each a different answer to *what does “far from normal” mean?*",
                 r"这一课剩下的是**无监督**的工具箱：四个类别，各自回答*“远离正常”是什么意思*。")),
             table([T('Family', '类别'), T('A point is an anomaly if...', '一个点是异常，如果…')],
                   [T('Statistical', '统计'), T('a model of the normal data gives it low probability', '正常数据的模型给它的概率很低')],
                   [T('Proximity', '邻近'), T('its nearest neighbours are far away', '它的最近邻很远')],
                   [T('Density', '密度'), T('it sits in a region of low density (relative to its neighbours)', '它所在区域的密度低（相对它的邻居）')],
                   [T('Clustering', '聚类'), T('it does not belong strongly to any large, dense cluster', '它不强烈属于任何大而密的簇')])),
        derive('imbalance', T('Deeper: why anomalies break standard supervised learning', '深入：为什么异常会让标准的监督学习失灵'),
               [(r'N = ' + f'{N:,}'.replace(',', r'\,') + r',\quad N_{a} = ' + str(A) + r'\;(' + r(A / N * 100) + r'\%)',
                 T(r"A card-fraud data set: 10 000 transactions, 50 of them fraudulent.", r"一个信用卡欺诈数据集：10000 笔交易，其中 50 笔是欺诈。")),
                (r'\text{accuracy}_{\text{always "normal"}} = \frac{' + str(normal) + r'}{' + str(N) + r'} = ' + r(acc_zero * 100, 1) + r'\%',
                 T(r"A “classifier” that never flags anything is right on every normal transaction. Its accuracy is 99.5%, and it has caught no fraud at all. Accuracy rewards the majority class.",
                   r"一个从不报警的“分类器”在所有正常交易上都对。它的准确率是 99.5%，却一笔欺诈也没抓到。准确率奖励的是多数类。")),
                (r'\text{recall} = \frac{TP}{TP + FN} = \frac{0}{50} = 0',
                 T(r"**Recall** is the share of real anomalies that are caught. For this classifier: 0. The goal is to catch as many anomalies as possible, so recall is the number to watch.", r"**召回率**（recall）是真异常里被抓到的比例。这个分类器：0。目标是尽可能多地抓出异常，所以要看的是召回率。")),
                (r'\text{recall } ' + r(rec) + r',\; \text{FPR } ' + r(fpr * 100, 0) + r'\%',
                 T(r"Now a detector that catches 80% of the frauds and wrongly flags 2% of the normal transactions, which sounds good.", r"现在有一个检测器：抓到 80% 的欺诈，同时错误地标出 2% 的正常交易。听上去不错。")),
                (r'TP = ' + str(tp) + r',\; FN = ' + str(fn) + r',\; FP = ' + str(fp) + r',\; TN = ' + str(tn),
                 T(r"Counts: $TP = 0.8 \times 50 = 40$; $FN = 10$; $FP = 0.02 \times 9950 = 199$ (2% of the normal ones); $TN = 9950 - 199 = 9751$.", r"计数：$TP = 0.8 \times 50 = 40$；$FN = 10$；$FP = 0.02 \times 9950 = 199$（正常交易的 2%）；$TN = 9950 - 199 = 9751$。")),
                (r'\text{P} = \frac{TP}{TP + FP} = \frac{' + str(tp) + r'}{' + str(tp + fp) + r'} = ' + r(prec * 100, 1) + r'\%',
                 T(r"**Precision** is the share of alerts that are real. Because normal transactions outnumber frauds 199 to 1, even a 2% false-positive rate buries the 40 true alerts under 199 false ones: about 5 in 6 alerts are false alarms.",
                   r"**精确率**（precision）是警报里真的那部分。因为正常交易比欺诈多 199 倍，即使误报率只有 2%，40 个真警报也会被 199 个假警报淹没：大约六个警报里有五个是误报。")),
                (r'\text{acc} = \frac{TP + TN}{N} = \frac{' + str(tp + tn) + r'}{' + str(N) + r'} = ' + r(acc_det * 100, 2) + r'\%',
                 T(r"The useful detector has *lower* accuracy ($" + r(acc_det * 100, 2) + r"\%$) than the useless one ($" + r(acc_zero * 100, 1) + r"\%$). Accuracy ranks them backwards.", r"有用的检测器准确率反而*更低*（$" + r(acc_det * 100, 2) + r"\%$ 对 $" + r(acc_zero * 100, 1) + r"\%$）。准确率把两者排反了。"))],
               intro=T(r"Why we do not simply train a classifier on “normal” versus “anomaly”.", r"为什么我们不直接训练一个“正常”对“异常”的分类器。"),
               outro=T(r"So: report **precision and recall** (and their trade-off as the threshold moves), not accuracy; expect false alarms to dominate unless the false-positive rate is tiny; and remember that a supervised model only knows the anomalies in its training set. These pressures are why the other settings exist.",
                       r"所以：报告**精确率和召回率**（以及阈值移动时二者的取舍），不要报告准确率；除非误报率极小，否则警报里多半是误报；还要记住，监督模型只认得训练集里出现过的异常。这些压力正是其他设定存在的原因。"),
               skill=S_DEF),
        read('stat', T('Statistical methods: a model of normal', '统计方法：给“正常”建模'),
             chapter=T('Statistical methods', '统计方法'),
             *[
                 p(T(r"**Idea.** Assume the normal data come from a **parametric distribution** $f(\mathbf{x}, \theta)$. Fit it. The density $f(\mathbf{x}, \theta)$ says how likely it is that $\mathbf{x}$ was generated by it: the **smaller**, the more likely $\mathbf{x}$ is an outlier.",
                     r"**想法。**假设正常数据来自某个**参数化分布** $f(\mathbf{x}, \theta)$，把它拟合出来。密度 $f(\mathbf{x}, \theta)$ 表示 $\mathbf{x}$ 由它产生的可能性：**越小**，$\mathbf{x}$ 越可能是离群点。")),
                 p(T(r"The first tool is not a formula but your eyes: a **boxplot** (1-D), **scatter plot** (2-D), **spin plot** (3-D). They are time-consuming and subjective, and stop working beyond three dimensions.",
                     r"第一个工具不是公式而是眼睛：**箱线图**（1 维）、**散点图**（2 维）、**旋转图**（3 维）。它们耗时又主观，超过三维就没法用了。")),
                 h(T('Univariate Gaussian: the z-score', '一维高斯：z 分数')),
                 p(T(r"Assume a normal distribution and estimate its parameters by **maximum likelihood** (the Gaussian MLE, the same estimates as in the probability lesson):", r"假设正态分布，用**最大似然**估计参数（高斯的最大似然估计，和概率那一课里的结果一样）：")),
                 math_(r'\mu = \frac1N\sum_{i=1}^{N}x_i \qquad \sigma = \sqrt{\frac1N\sum_{i=1}^{N}(x_i - \mu)^2}'),
                 p(T(r"Choose a confidence limit: $\mu \pm 3\sigma$ contains 99.7% of the data. The **z-score** counts how many standard deviations a point is from the mean:",
                     r"选一个置信界限：$\mu \pm 3\sigma$ 含 99.7% 的数据。**z 分数**数的是一个点离均值有几个标准差：")),
                 math_(r'z = \left|\frac{x - \mu}{\sigma}\right| \qquad z > 3 \Rightarrow \text{(99.7\%)}'),
                 callout('warning', T('The weak spot', '软肋'),
                         T(r"Everything depends on the assumption that the data really are (close to) Gaussian. Data with several modes or variable density are hard to model parametrically, and in high dimensions there is too little data to estimate the distribution.",
                           r"一切都取决于数据确实（接近）高斯这一假设。多峰或密度变化的数据很难用参数分布建模，高维时又没有足够的数据来估计分布。"))]),
        derive('z-worked', T('Worked: the slide\'s temperature example', '算例：课件里的温度例子'),
               [(r'x = \{24.0,\, 28.9,\, 28.9,\, 29.0,\, 29.1,\, 29.1,\, 29.2,\, 29.2,\, 29.3,\, 29.4\}, \quad N = 10',
                 T(r"Average temperatures. One value, 24.0, is well below the rest.", r"平均气温。有一个值 24.0 明显低于其他。")),
                (r'\mu = \frac{' + r(sum(TEMP), 1) + r'}{10} = ' + r(mu, 2),
                 T(r"The mean: add up and divide by $N$.", r"均值：加起来除以 $N$。")),
                (r'\sigma^2 = \frac{1}{10}\sum(x_i - \mu)^2 = \frac{' + r(ss, 3) + r'}{10} = ' + r(var, 3) + r', \quad \sigma = ' + r(sd, 3),
                 T(r"The MLE variance divides by $N$. The squared gaps sum to " + r(ss, 3) + r", and 24.0 alone contributes $(24 - 28.61)^2 = 21.25$. (The slide prints $\sigma^2 = 2.29$, $\sigma = 1.51$; recomputing from the ten values gives the numbers here.)",
                   r"最大似然的方差除以 $N$。平方差之和是 " + r(ss, 3) + r"，仅 24.0 一项就贡献 $(24 - 28.61)^2 = 21.25$。（课件印的是 $\sigma^2 = 2.29$、$\sigma = 1.51$；从这十个值重算得到的是这里的数。）")),
                (r'z(24.0) = \frac{|24.0 - ' + r(mu, 2) + r'|}{' + r(sd, 3) + r'} = ' + r(z_exact, 3),
                 T(r"The z-score of the suspect. With the slide's $\sigma = 1.51$ it is " + r(z_slide, 2) + r" ($> 3$, flagged); with the exact $\sigma$ it is " + r(z_exact, 3) + r", just *under* 3, so the 3-sigma rule does **not** flag it. The next derivation shows why it is so close.",
                   r"可疑点的 z 分数。用课件的 $\sigma = 1.51$ 是 " + r(z_slide, 2) + r"（$> 3$，被标出）；用精确的 $\sigma$ 是 " + r(z_exact, 3) + r"，刚好*低于* 3，3σ 规则**不会**标出它。下一段推导说明为什么这么接近。")),
                (r'z_{2..10} \le ' + r(max(abs(x - mu) / sd for x in TEMP[1:]), 2),
                 T(r"All other values are within about half a standard deviation of the mean: 24.0 is the only candidate. The lecture's conclusion (24 is an anomaly) is the intended reading; what a marker wants to see is $\mu$, $\sigma$, $z$ and the comparison with 3.",
                   r"其余值都在均值附近约半个标准差以内：24.0 是唯一的候选。课件的结论（24 是异常）是出题的本意；评分要看到的是 $\mu$、$\sigma$、$z$ 以及和 3 的比较。"))],
               skill=S_STAT),
        derive('z-bound', T('Deeper: a 3-sigma rule that can never fire', '深入：永远触发不了的 3σ 规则'),
               [(r'd = x_1 - \mu, \qquad e_i = x_i - \mu \;(i \ge 2), \qquad d + \sum_{i\ge2}e_i = 0',
                 T(r"Single out the point with the biggest gap $d$. Deviations from the mean always sum to zero, so the other $N - 1$ deviations sum to $-d$.", r"挑出离得最远的那个点，偏差为 $d$。离均值的偏差之和总是 0，所以其余 $N - 1$ 个偏差之和是 $-d$。")),
                (r'\sum_{i\ge 2}e_i^2 \;\ge\; \frac{\bigl(\sum_{i \ge 2} e_i\bigr)^2}{N - 1} = \frac{d^2}{N-1}',
                 T(r"For fixed total, the sum of squares is smallest when the $N - 1$ numbers are equal (Cauchy-Schwarz). So the others contribute at least $d^2/(N-1)$ to the variance.", r"总和固定时，这 $N - 1$ 个数全相等，平方和最小（柯西—施瓦茨）。所以其余点至少给方差贡献 $d^2/(N-1)$。")),
                (r'N\sigma^2 = d^2 + \sum_{i \ge 2}e_i^2 \;\ge\; d^2\Bigl(1 + \frac{1}{N-1}\Bigr) = \frac{N}{N-1}\,d^2',
                 T(r"Add the point's own $d^2$: the total squared deviation $N\sigma^2$ is at least $\frac{N}{N-1}d^2$.", r"加上这个点自己的 $d^2$：总平方偏差 $N\sigma^2$ 至少是 $\frac{N}{N-1}d^2$。")),
                (r'z^2 = \frac{d^2}{\sigma^2} \le N - 1 \;\Rightarrow\; z \le \sqrt{N-1}',
                 T(r"Rearranged: **no single point can be more than $\sqrt{N-1}$ standard deviations from the mean.** An outlier inflates the very $\sigma$ it is measured with.", r"整理得：**任何单个点离均值都不会超过 $\sqrt{N-1}$ 个标准差。**离群点会把用来衡量它的 $\sigma$ 自己撑大。")),
                (r'N = 10:\;\; z \le \sqrt{9} = 3 \quad\Rightarrow\quad z > 3\; \times',
                 T(r"With $\sigma$ as the MLE: for ten points the 3-sigma rule **can never flag anything**. The slide's $z = 3.04$ is impossible for ten points; the true value " + r(z_exact, 3) + r" is almost at the ceiling of 3, because 24.0 is as extreme as ten points allow. (With the sample standard deviation, dividing by $N - 1$, the ceiling is $(N-1)/\sqrt N = " + r(zmax_sam, 2) + r"$.)",
                   r"$\sigma$ 取最大似然估计时：十个点的 3σ 规则**永远标不出任何点**。课件里的 $z = 3.04$ 对十个点是不可能的；真实值 " + r(z_exact, 3) + r" 几乎已顶到 3 这个上限，因为 24.0 已是十个点所允许的极端。（用样本标准差，即除以 $N - 1$，上限是 $(N-1)/\sqrt N = " + r(zmax_sam, 2) + r"$。）")),
                (r'G = \frac{\max_i |x_i - \mu|}{\sigma} = ' + r(z_s, 2) + r' > G_{\text{crit}}(N{=}10,\, 5\%) \approx ' + r(G_CRIT, 2),
                 T(r"**Grubbs' test** uses the statistic $G = \max_i |x_i - \mu| / \sigma$ (here with the sample standard deviation $s = " + r(sd_s, 3) + r"$) but compares it with a critical value that **depends on $N$** (about 2.29 at the 5% level for $N = 10$, from tables). $G = " + r(z_s, 2) + r" > 2.29$: 24.0 is declared an outlier. For a single outlier in roughly normal data, this is the properly calibrated version of the z-score.",
                   r"**Grubbs 检验**用的统计量是 $G = \max_i |x_i - \mu| / \sigma$（这里取样本标准差 $s = " + r(sd_s, 3) + r"$），但拿它和一个**依赖 $N$** 的临界值比较（$N = 10$、5% 水平约为 2.29，查表得）。$G = " + r(z_s, 2) + r" > 2.29$：24.0 被判为离群点。对近似正态数据里的单个离群点，这是校准得当的 z 分数。"))],
               intro=T(r"The slide's example sits suspiciously close to $z = 3$. There is a reason.", r"课件的例子离 $z = 3$ 近得可疑。这是有原因的。"),
               skill=S_STAT),
        read('mahal', T('Several features: Mahalanobis distance', '多个特征：马氏距离'),
             p(T(r"With several features, assume a **multivariate normal** distribution: a mean vector $\boldsymbol\mu$ and a covariance matrix $\Sigma$ (for two features $\Sigma = \begin{pmatrix}\sigma(x,x) & \sigma(x,y)\\ \sigma(y,x) & \sigma(y,y)\end{pmatrix}$: variances on the diagonal, how the features vary together off it). The **Mahalanobis distance** measures how far a point is from the mean *in units of the data's own spread, in every direction*:",
                 r"有多个特征时，假设**多元正态分布**：均值向量 $\boldsymbol\mu$ 和协方差矩阵 $\Sigma$（两个特征时 $\Sigma = \begin{pmatrix}\sigma(x,x) & \sigma(x,y)\\ \sigma(y,x) & \sigma(y,y)\end{pmatrix}$：对角线是方差，非对角线是两个特征如何一起变化）。**马氏距离**（Mahalanobis distance）衡量一个点离均值多远，*单位是数据在每个方向上自己的散布*：")),
             math_(r'D_M(\mathbf{x}) = \sqrt{(\mathbf{x} - \boldsymbol\mu)^\top\,\Sigma^{-1}\,(\mathbf{x} - \boldsymbol\mu)}'),
             p(T(r"Read $\Sigma^{-1}$ as a rescaling: a gap along a direction in which the data vary a lot costs little; a gap across the data's narrow direction costs a lot. In one dimension $D_M = |x - \mu|/\sigma$, the z-score. A large $D_M$ means the point is unlikely under the distribution: a potential outlier.",
                 r"把 $\Sigma^{-1}$ 看作一次重新标度：沿着数据变化大的方向偏离，代价小；横着数据窄的方向偏离，代价大。一维时 $D_M = |x - \mu|/\sigma$，就是 z 分数。$D_M$ 大，说明这个点在该分布下不太可能：潜在的离群点。")),
             svg(drawn(fig_mahal), T('A tilted elliptical cloud of points with mean μ. Points A (up the long axis) and B (across the short axis) are on the same dashed circle around μ, so equally far in Euclidean distance. A is just outside the inner ellipse, D_M = 2.1; B is far outside, D_M = 6.3.',
                                     '以 μ 为均值的倾斜椭圆形点云。点 A（沿长轴方向）和 B（沿短轴方向）在围绕 μ 的同一个虚线圆上，欧氏距离相同。A 在内椭圆外一点点，D_M = 2.1；B 远在外面，D_M = 6.3。'),
                 T(r"Equal Euclidean distance, very different Mahalanobis distance.", r"欧氏距离相同，马氏距离差很多。")),
             p(T(r"The slide's scatter plot makes the same point with numbers: a point A at Euclidean distance 5.7 has Mahalanobis distance 5.9 ($\sqrt{35}$), while B, *farther* in Euclidean terms (7.1), has Mahalanobis distance only 4.9 ($\sqrt{24}$): B lies along the cloud's long axis, where large values are common.",
                 r"课件的散点图用数字说明同一件事：点 A 欧氏距离 5.7，马氏距离 5.9（$\sqrt{35}$）；而欧氏距离*更远*的 B（7.1），马氏距离只有 4.9（$\sqrt{24}$）：B 在点云的长轴方向上，那里出现大值很常见。")),
             h(T('Grubbs\' test on the distances', '对距离做 Grubbs 检验')),
             p(T(r"The Mahalanobis distances turn many features into one number per point. Treat that set of numbers as (roughly) normal and apply **Grubbs' test** to find a single univariate outlier: $G = \max_i |x_i - \mu|/\sigma$, as in the last page, compared with a critical value that depends on the number of points.",
                 r"马氏距离把许多特征变成每个点一个数。把这组数当作（近似）正态，用 **Grubbs 检验**找出单个一元离群点：$G = \max_i |x_i - \mu|/\sigma$，和上一页一样，并与一个依赖点数的临界值比较。")),
             callout('warning', T('Global anomalies only', '只对全局异常有效'),
                     T(r"Mahalanobis distance is mainly useful for **global** anomalies. It is much less effective for local, contextual or collective ones, because one Gaussian describes the whole data set.",
                       r"马氏距离主要对**全局**异常有用。对局部、上下文或集体异常效果差得多，因为一个高斯分布描述的是整个数据集。")),
             h(T('Statistical methods: pros and cons', '统计方法：优点与缺点')),
             table([T('Pros', '优点'), T('Cons', '缺点')],
                   [T('Well understood and well validated tests', '检验方法成熟、经过充分验证'), T('Data may be hard to model parametrically (several modes, variable density)', '数据可能很难参数化建模（多峰、密度变化）')],
                   [T('A quantitative degree of outlierness (a score)', '给出异常程度的定量度量（一个分数）'), T('In high dimensions there may be too little data to estimate the distribution', '高维时可能没有足够数据来估计分布')])),
        derive('mahal-worked', T('Worked: Euclidean versus Mahalanobis', '算例：欧氏距离与马氏距离'),
               [(r'\boldsymbol\mu = \mathbf{0}, \quad \Sigma = \begin{pmatrix}1 & 0.8\\0.8 & 1\end{pmatrix}',
                 T(r"Two features with variance 1 and correlation 0.8: when one is large, the other tends to be large too (the tilted cloud). A = (2, 2) and B = (2, -2).", r"两个特征，方差都为 1，相关系数 0.8：一个大时另一个也倾向于大（倾斜的点云）。A = (2, 2)，B = (2, −2)。")),
                (r'\Sigma^{-1} = \frac{1}{1 - 0.8^2}\begin{pmatrix}1 & -0.8\\-0.8 & 1\end{pmatrix} = \frac{1}{0.36}\begin{pmatrix}1 & -0.8\\-0.8 & 1\end{pmatrix}',
                 T(r"Invert the $2 \times 2$ matrix: swap the diagonal, negate the off-diagonal, divide by the determinant $1 - 0.64 = 0.36$.", r"求 $2 \times 2$ 矩阵的逆：交换对角线、非对角线取负、除以行列式 $1 - 0.64 = 0.36$。")),
                (r'\lVert A\rVert = \lVert B\rVert = \sqrt{8} = 2.83',
                 T(r"By plain distance the two points are equally far from the mean.", r"按普通距离，两点离均值一样远。")),
                (r'D_M^2(A) = \frac{2^2 - 2(0.8)(2)(2) + 2^2}{0.36} = \frac{1.6}{0.36} = ' + r(mdA, 2) + r', \quad D_M(A) = ' + r(sqrt(mdA), 2),
                 T(r"Expand $\mathbf{x}^\top\Sigma^{-1}\mathbf{x} = (x^2 - 1.6xy + y^2)/0.36$. For $(2, 2)$ the cross term *cancels* part of the squares: moving along the correlation is cheap.", r"展开 $\mathbf{x}^\top\Sigma^{-1}\mathbf{x} = (x^2 - 1.6xy + y^2)/0.36$。对 $(2, 2)$，交叉项*抵消*了一部分平方项：顺着相关方向走代价小。")),
                (r'D_M^2(B) = \frac{2^2 - 2(0.8)(2)(-2) + (-2)^2}{0.36} = \frac{14.4}{0.36} = ' + r(mdB, 0) + r', \quad D_M(B) = ' + r(sqrt(mdB), 2),
                 T(r"For $(2, -2)$ the cross term *adds*: going against the correlation is expensive.", r"对 $(2, -2)$，交叉项是*加上去*的：逆着相关方向走代价大。")),
                (r'\lambda_1 = 1.8 \;((1,1)), \;\; \lambda_2 = 0.2 \;((1,-1)): \;\; D_M^2(A) = \frac{2.83^2}{1.8}, \;\; D_M^2(B) = \frac{2.83^2}{0.2}',
                 T(r"Why: the covariance has two principal directions. Along $(1, 1)$ the variance is 1.8, along $(1, -1)$ only 0.2. $D_M^2$ divides each squared gap by the variance of its direction: A is entirely along the wide direction, B entirely along the narrow one.", r"原因：协方差有两个主方向。沿 $(1, 1)$ 方差是 1.8，沿 $(1, -1)$ 只有 0.2。$D_M^2$ 把每个方向上的平方偏差除以该方向的方差：A 完全在宽的方向上，B 完全在窄的方向上。"))],
               skill=S_STAT),
        read('prox', T('Proximity: far from your neighbours', '邻近方法：离邻居很远'),
             chapter=T('Proximity and density', '邻近与密度'),
             *[
                 p(T(r"**Idea.** An object is an anomaly if its nearest neighbours are far away: its proximity deviates from the proximity of most other objects. No distribution needed; defining a distance is easier than finding a distribution.",
                     r"**想法。**如果一个对象的最近邻很远，它就是异常：它的邻近程度与其他大多数对象很不一样。不需要分布；定义一个距离比找出一个分布容易。")),
                 p(T(r"**Common score:** the distance to the $k$-th nearest neighbour. The score is sensitive to $k$. Eight 1-D points, a tight group of six and a pair of anomalies at 8.0 and 8.3:",
                     r"**常用分数：**到第 $k$ 个最近邻的距离。分数对 $k$ 很敏感。八个一维点：紧凑的六个点，加上位于 8.0 和 8.3 的一对异常点：")),
                 table(['$x$'] + [str(v) for v in K1],
                       ['$k = 1$'] + [r(v, 1) for v in kn[1]],
                       ['$k = 2$'] + [r(v, 1) for v in kn[2]],
                       ['$k = 3$'] + [r(v, 1) for v in kn[3]]),
                 p(T(r"With $k = 1$ the pair protects itself: each is the other's nearest neighbour at 0.3, hardly worse than the normal 0.2, so **nothing** is flagged. With $k = 2$ the scores jump to 6.0 and 6.3. $k$ must exceed the size of any group of anomalies you want to find (a collective anomaly of $m$ points hides at $k < m$), but a $k$ that is too big mixes in other groups.",
                     r"$k = 1$ 时这一对互相保护：每个是对方的最近邻，距离 0.3，只比正常的 0.2 略大，所以**一个都标不出来**。$k = 2$ 时分数跳到 6.0 和 6.3。$k$ 必须大于你想找的任一异常群的大小（$m$ 个点的集体异常在 $k < m$ 时藏得住），但 $k$ 太大又会混进别的群。")),
                 h(T('Proximity: pros and cons', '邻近方法：优点与缺点')),
                 table([T('Pros', '优点'), T('Cons', '缺点')],
                       [T('A proximity measure is easier to define than a distribution', '邻近度量比分布更容易定义'), T('$O(n^2)$ complexity (all pairwise distances)', '$O(n^2)$ 复杂度（所有两两距离）')],
                       [T('A quantitative score', '定量的分数'), T('Sensitive to the choice of $k$', '对 $k$ 的选择敏感')],
                       [T('Deals naturally with multiple modes', '自然地处理多峰'), T('Does **not** work well if the data have widely variable density', '数据密度差别很大时**不**好用')])]),
        read('global', T('Why one global threshold fails when densities differ', '为什么密度不一时一个全局阈值会失效'),
             p(T(r"The last weakness is the important one. Here are nine points: a dense group A-D, a sparse group E-H, and a point I that sits some distance from the dense group but still in the gap.",
                 r"最后这个缺点是最要紧的。下面是九个点：稠密的一群 A–D，稀疏的一群 E–H，还有一个点 I，离稠密群有一段距离，但还在两群的空隙里。")),
             svg(drawn(fig_pts), T('Nine points on a grid. Four dense points A, B, C, D near the bottom left; four sparse points E, F, G, H spread out on the right; the point I in between, joined by dashed lines to its two nearest neighbours B and D.',
                                   '网格上的九个点。左下方四个稠密的点 A、B、C、D；右边四个分散的稀疏点 E、F、G、H；中间的点 I，用虚线连到它最近的两个邻居 B 和 D。')),
             p(T(r"Distance to the 2nd nearest neighbour (Manhattan distance $|\Delta x| + |\Delta y|$):", r"到第 2 个最近邻的距离（曼哈顿距离 $|\Delta x| + |\Delta y|$）：")),
             table([T('Point', '点')] + list(PTS), [T('2-distance', '2-距离')] + [str(kd[a]) for a in PTS]),
             p(T(r"I is the anomaly to the eye: its neighbours are about 5 away while the dense group's are 1-2 apart. But its score (5) is **lower** than that of every sparse point (6), who are perfectly normal for their group. A threshold that catches I (say, above 4) flags all of E-H as well; a threshold that spares E-H (above 6) lets I through. **No single threshold separates them.** A distance only means something relative to the local scale.",
                 r"在眼里 I 就是异常：它的邻居约 5 远，而稠密群里的点彼此只相距 1–2。可是它的分数（5）比每个稀疏点（6）都**低**，而稀疏点在它们那一群里完全正常。能抓住 I 的阈值（比如大于 4）也会把 E–H 全标出来；能放过 E–H 的阈值（大于 6）又会放过 I。**没有一个阈值能把它们分开。**距离只有相对局部的尺度才有意义。")),
             p(T(r"The same failure hits the statistical Gaussian (one distribution cannot fit two scales) and the basic density score. The fix: compare each point with *its own neighbourhood*.",
                 r"同样的失败也会落到统计的高斯方法（一个分布装不下两个尺度）和基本的密度分数上。补救办法：把每个点和*它自己的邻域*比。")),
             quiz(T('Which is the best summary of why a global kNN-distance threshold fails here?', '下面哪句最好地总结了为什么全局的 kNN 距离阈值在这里失效？'),
                  [(T(r"Normal points in a sparse group have larger kNN distances than an anomaly next to a dense group", r"稀疏群里的正常点，其 kNN 距离比紧挨着稠密群的异常点还大"), True),
                   (T(r"The Manhattan distance is the wrong metric; Euclidean distance would fix it", r"曼哈顿距离选错了；换欧氏距离就好了"), T(r"Changing the metric rescales distances but both groups keep their different scales; the ordering problem remains.", r"换度量只会重新标度距离，两群的尺度差别依然在，排序问题还在。")),
                   (T(r"$k = 2$ is too small; with $k = 8$ it works", r"$k = 2$ 太小；$k = 8$ 就行了"), T(r"A larger $k$ makes distances bigger everywhere and does not remove the difference of scale between the two groups.", r"更大的 $k$ 让所有距离都变大，两群的尺度差别并没有消除。"))],
                  T(r"The absolute distance conflates “far” with “in a sparse region”. Relative density (LOF) separates them.", r"绝对距离把“远”和“在稀疏区域”混为一谈。相对密度（LOF）把它们分开。"))),
        read('density', T('Density-based: absolute, then relative (LOF)', '基于密度：先绝对，再相对（LOF）'),
             p(T(r"**Idea.** Outliers are objects in regions of **low density**: the outlier score rises as the density around a point falls. Two simple densities: count the points within a fixed radius $d$; or take the **inverse of the mean distance to the $k$ nearest neighbours**:",
                 r"**想法。**离群点是处在**低密度**区域的对象：一个点周围的密度越低，异常分数越高。两个简单的密度：数固定半径 $d$ 内的点数；或者取**到 $k$ 个最近邻的平均距离的倒数**：")),
             math_(r'\text{density}(\mathbf{x}, k) = \Bigl(\frac1k\sum_{\mathbf{y}\in N(\mathbf{x}, k)}\text{distance}(\mathbf{x}, \mathbf{y})\Bigr)^{-1}'),
             p(T(r"$N(\mathbf{x}, k)$ is the set of the $k$ nearest neighbours of $\mathbf{x}$. Short distances mean high density. **Limitation:** these are *absolute* densities, so with variable density they fail exactly as in the last page.",
                 r"$N(\mathbf{x}, k)$ 是 $\mathbf{x}$ 的 $k$ 个最近邻的集合。距离短就是密度高。**局限：**这是*绝对*密度，所以在密度变化时会像上一页那样失败。")),
             p(T(r"**Local density (the Local Outlier Factor idea).** Compare each point's density with the average density of **its own neighbours**. The lecture's version:",
                 r"**局部密度（局部离群因子 LOF 的想法）。**把每个点的密度和**它自己邻居**的平均密度比。课件的版本：")),
             math_(r'\text{relative density}(\mathbf{x}, k) = \left(\frac{\text{density}(\mathbf{x}, k)}{\frac1k\sum_{\mathbf{y}\in N(\mathbf{x}, k)}\text{density}(\mathbf{y}, k)}\right)^{-1}'),
             p(T(r"Read it: own density divided by the neighbours' average density, **inverted**. So the score is $\bar\rho_{\text{neighbours}}/\rho_{\mathbf{x}}$:", r"读法：自己的密度除以邻居的平均密度，再**取倒数**。所以分数是 $\bar\rho_{\text{邻居}}/\rho_{\mathbf{x}}$：")),
             ul(T(r"$\approx 1$: as dense as the neighbours, normal;", r"$\approx 1$：和邻居一样密，正常；"),
                T(r"$\gg 1$: much sparser than the neighbours, an outlier, **even if the area is not low-density globally**;", r"$\gg 1$：比邻居稀疏得多，是离群点，**即使这一带在全局上并不是低密度**；"),
                T(r"$< 1$: denser than the neighbours (inside a cluster).", r"$< 1$：比邻居更密（在簇的内部）。")),
             h(T('The original LOF, with reachability distance', '原始的 LOF：用可达距离')),
             p(T(r"Breunig et al. (2000) smooth the distances. For a point $p$ and a number $k$:", r"Breunig 等人（2000）把距离做了平滑。对一个点 $p$ 和一个数 $k$：")),
             ul(T(r"**$k$-distance** $d_k(p)$: the distance from $p$ to its $k$-th nearest neighbour; $N_k(p)$ the points within it (at least $k$, more with ties).", r"**$k$-距离** $d_k(p)$：$p$ 到其第 $k$ 个最近邻的距离；$N_k(p)$ 是在这个距离之内的点（至少 $k$ 个，有并列时更多）。"),
                T(r"**Reachability distance** $\text{reach}_k(p, o) = \max\{d_k(o),\; d(p, o)\}$: the true distance, but never less than $o$'s own $k$-distance (so points inside a tight cluster all look equally far from each other, which stabilises the score).", r"**可达距离** $\text{reach}_k(p, o) = \max\{d_k(o),\; d(p, o)\}$：真实距离，但不小于 $o$ 自己的 $k$-距离（于是紧簇内的点彼此看起来一样远，让分数更稳定）。"),
                T(r"**Local reachability density** $\text{lrd}_k(p) = \Bigl(\frac{1}{|N_k(p)|}\sum_{o \in N_k(p)}\text{reach}_k(p, o)\Bigr)^{-1}$: the inverse of the mean reachability distance.", r"**局部可达密度** $\text{lrd}_k(p) = \Bigl(\frac{1}{|N_k(p)|}\sum_{o \in N_k(p)}\text{reach}_k(p, o)\Bigr)^{-1}$：平均可达距离的倒数。"),
                T(r"**LOF** $\text{LOF}_k(p) = \dfrac{1}{|N_k(p)|}\sum_{o \in N_k(p)}\dfrac{\text{lrd}_k(o)}{\text{lrd}_k(p)}$: the neighbours' density over $p$'s own.", r"**LOF** $\text{LOF}_k(p) = \dfrac{1}{|N_k(p)|}\sum_{o \in N_k(p)}\dfrac{\text{lrd}_k(o)}{\text{lrd}_k(p)}$：邻居的密度除以 $p$ 自己的密度。")),
             p(T(r"The lecture's score is the same idea with plain distances instead of reachability distances. Both: $\approx 1$ normal, $\gg 1$ outlier.", r"课件的分数是同一个想法，只是用普通距离代替可达距离。两者：$\approx 1$ 正常，$\gg 1$ 离群。")),
             h(T('Density: pros and cons', '密度方法：优点与缺点')),
             table([T('Pros', '优点'), T('Cons', '缺点')],
                   [T('A quantitative score', '定量的分数'), T('$O(n^2)$ complexity', '$O(n^2)$ 复杂度')],
                   [T('Works even if the data have variable density (the relative version)', '数据密度变化时也好用（相对版本）'), T('Parameters to choose: $k$ (neighbours) or $d$ (radius)', '要选参数：$k$（邻居数）或 $d$（半径）')])),
        derive('deck1d', T('Worked: the slide\'s 1-D example (2-NN, Manhattan)', '算例：课件的一维例子（2 近邻，曼哈顿距离）'),
               [(r'D = \{1, 1.05, \dots, 1.5 \,|\, 4.55, 5.6, \dots, 13.5\}',
                 T(r"The 20 values of the slide: a tight group of ten at 1-1.5 and a loose spread from 4.55 on. Score the two query points $x = 0.5$ and $x = 4$ (not in $D$) with $k = 2$.", r"课件的 20 个值：1–1.5 有十个点的紧簇，4.55 往后是松散的分布。对两个查询点 $x = 0.5$ 和 $x = 4$（不在 $D$ 里）用 $k = 2$ 打分。")),
                (r'N(0.5, 2) = \{1,\, 1.05\}, \quad \text{density}(0.5) = \Bigl(\tfrac{0.5 + 0.55}{2}\Bigr)^{-1} = ' + r(d05, 2),
                 T(r"The two nearest points to 0.5 are 1 (distance 0.5) and 1.05 (0.55). The mean distance is 0.525; density is its inverse (the slide's 1.9).", r"离 0.5 最近的两点是 1（距离 0.5）和 1.05（0.55）。平均距离 0.525；密度是它的倒数（课件的 1.9）。")),
                (r'\text{density}(1) = \Bigl(\tfrac{0.05 + 0.10}{2}\Bigr)^{-1} = ' + r(density_1d(1, DECK1D, 2), 1) + r', \;\; \text{density}(1.05) = \Bigl(\tfrac{0.05 + 0.05}{2}\Bigr)^{-1} = ' + r(density_1d(1.05, DECK1D, 2), 1),
                 T(r"The neighbours' own densities. Point 1 has neighbours 1.05 and 1.1; point 1.05 has neighbours 1 and 1.1. Both sit in the tight group, so their densities are high.", r"邻居自己的密度。点 1 的邻居是 1.05 和 1.1；点 1.05 的邻居是 1 和 1.1。两者都在紧簇里，所以密度很高。")),
                (r'\text{score}(0.5) = \frac{(13.33 + 20.00)/2}{' + r(d05, 3) + r'} = ' + r(ir05, 2),
                 T(r"Mean neighbour density over own density (the inverse of the slide's “relative density”). 0.5 is about **8.75 times sparser** than its neighbours. (The slide prints 9.1; rounding the densities does not give that, so 8.75 is the correct value. Either way, far above 1.)", r"邻居平均密度除以自己的密度（课件“相对密度”的倒数）。0.5 比它的邻居**稀疏约 8.75 倍**。（课件印的是 9.1；把密度四舍五入也得不到这个数，所以 8.75 才是对的。无论哪个，都远大于 1。）")),
                (r'N(4, 2) = \{4.55,\, 5.6\}, \quad \text{density}(4) = \Bigl(\tfrac{0.55 + 1.6}{2}\Bigr)^{-1} = ' + r(d4, 2),
                 T(r"For 4: the nearest points are 4.55 (0.55) and 5.6 (1.6).", r"对 4：最近的点是 4.55（0.55）和 5.6（1.6）。")),
                (r'\text{density}(4.55) = \Bigl(\tfrac{1.05 + 2.25}{2}\Bigr)^{-1} = ' + r(density_1d(4.55, DECK1D, 2), 2) + r', \;\; \text{density}(5.6) = \Bigl(\tfrac{1.05 + 1.2}{2}\Bigr)^{-1} = ' + r(density_1d(5.6, DECK1D, 2), 2),
                 T(r"Neighbour 4.55 has neighbours 5.6 and 6.8; neighbour 5.6 has 4.55 and 6.8. Both are in the loose region, so their densities are low (0.61 and 0.89).", r"邻居 4.55 的邻居是 5.6 和 6.8；邻居 5.6 的邻居是 4.55 和 6.8。两者都在松散的区域，所以密度很低（0.61 和 0.89）。")),
                (r'\text{score}(4) = \frac{(0.61 + 0.89)/2}{' + r(d4, 2) + r'} = ' + r(ir4, 2),
                 T(r"Score about 0.80 (the slide: 0.81, from rounded values). Below 1: 4 is about as dense as its neighbours, in a region where every point is far from every other. **Not an outlier**, although its absolute distances (0.55, 1.6) are much larger than 0.5's.", r"分数约 0.80（课件：0.81，由四舍五入的值得到）。小于 1：4 和它的邻居差不多一样密，处在一个每个点离其他点都很远的区域。**不是离群点**，尽管它的绝对距离（0.55、1.6）比 0.5 的大得多。"))],
               intro=T(r"Same recipe as the formula above, with every number computed.", r"套上面的公式，每个数都算出来。"),
               outro=T(r"The point of the example: 0.5 is next to a dense group, so it is an outlier **relative to its neighbourhood** (score 8.75); 4 has larger absolute distances but sits in a sparse region where that is normal (0.80).", r"例子的要点：0.5 紧挨着一个稠密群，所以**相对它的邻域**是离群点（8.75）；4 的绝对距离更大，但处在稀疏区域，那里这样是正常的（0.80）。"),
               skill=S_DENS),
        derive('lof-full', T('Worked: a full LOF by hand (k = 2)', '算例：手算一个完整的 LOF（k = 2）'),
               [(r'A(0,1),\, B(2,0),\, C(1,0),\, D(1,1);\;\; I(5,2)',
                 T(r"The points of the figure; Manhattan distance, $k = 2$. We compute $\text{LOF}(I)$, which needs the neighbours of $I$, then their neighbours. (The sparse group is $E(10,6), F(14,4), G(12,0), H(10,0)$.)", r"图里的点；曼哈顿距离，$k = 2$。我们算 $\text{LOF}(I)$，这要用到 $I$ 的邻居，再用到它们的邻居。（稀疏群是 $E(10,6), F(14,4), G(12,0), H(10,0)$。）")),
                (r'd(I,B) = ' + str(d['I', 'B']) + r',\; d(I,D) = ' + str(d['I', 'D']) + r',\; d(I,A) = ' + str(d['I', 'A']) + r',\; d(I,C) = ' + str(d['I', 'C']) + r'\;\Rightarrow\; N_2(I) = \{B, D\},\; d_2(I) = ' + str(kd['I']),
                 T(r"Distances from $I$ to the dense group: $|5-2| + |2-0| = 5$ to B, $4 + 1 = 5$ to D, 6 to A and C; to the sparse group it is at least 9. The two nearest are B and D, so $d_2(I) = 5$.", r"$I$ 到稠密群的距离：到 B 是 $|5-2| + |2-0| = 5$，到 D 是 $4 + 1 = 5$，到 A 和 C 是 6；到稀疏群至少 9。最近的两个是 B 和 D，所以 $d_2(I) = 5$。")),
                (r'd_2(B) = ' + str(kd['B']) + r',\;\; d_2(D) = ' + str(kd['D']),
                 T(r"The $k$-distances of the neighbours: B has C at distance 1 and D at 2, so $d_2(B) = 2$. D has A and C both at distance 1, so $d_2(D) = 1$.", r"邻居的 $k$-距离：B 到 C 是 1，到 D 是 2，所以 $d_2(B) = 2$。D 到 A、C 都是 1，所以 $d_2(D) = 1$。")),
                (r'\text{reach}(I,B) = \max\{d_2(B),\, d(I,B)\} = \max\{2, 5\} = 5,\;\; \text{reach}(I,D) = \max\{1, 5\} = 5',
                 T(r"Reachability distances from $I$: the larger of the neighbour's own $k$-distance and the true distance. Here the true distance (5) wins.", r"从 $I$ 出发的可达距离：邻居自己的 $k$-距离与真实距离中较大的那个。这里是真实距离（5）较大。")),
                (r'\text{lrd}(I) = \frac{2}{5 + 5} = \frac15',
                 T(r"Local reachability density: the number of neighbours over the sum of reachability distances (the inverse of their mean).", r"局部可达密度：邻居数除以可达距离之和（即平均值的倒数）。")),
                (r'\text{lrd}(B) = \frac{2}{\text{reach}(B,C) + \text{reach}(B,D)} = \frac{2}{1 + 2} = \frac23',
                 T(r"For B: $N_2(B) = \{C, D\}$; $\text{reach}(B,C) = \max\{d_2(C) = 1,\, 1\} = 1$ and $\text{reach}(B,D) = \max\{d_2(D) = 1,\, 2\} = 2$.", r"对 B：$N_2(B) = \{C, D\}$；$\text{reach}(B,C) = \max\{d_2(C) = 1,\, 1\} = 1$，$\text{reach}(B,D) = \max\{d_2(D) = 1,\, 2\} = 2$。")),
                (r'\text{lrd}(D) = \frac{2}{\text{reach}(D,A) + \text{reach}(D,C)} = \frac{2}{2 + 1} = \frac23',
                 T(r"For D: $N_2(D) = \{A, C\}$; $\text{reach}(D,A) = \max\{d_2(A) = 2,\, 1\} = 2$ and $\text{reach}(D,C) = \max\{d_2(C) = 1,\, 1\} = 1$.", r"对 D：$N_2(D) = \{A, C\}$；$\text{reach}(D,A) = \max\{d_2(A) = 2,\, 1\} = 2$，$\text{reach}(D,C) = \max\{d_2(C) = 1,\, 1\} = 1$。")),
                (r'\text{LOF}(I) = \frac{\tfrac12\bigl(\text{lrd}(B) + \text{lrd}(D)\bigr)}{\text{lrd}(I)} = \frac{2/3}{1/5} = \frac{10}{3} = ' + r(lof['I'], 2),
                 T(r"The neighbours are $\tfrac{2/3}{1/5} = 3.3$ times denser than $I$: a clear outlier.", r"邻居的密度是 $I$ 的 $\tfrac{2/3}{1/5} = 3.3$ 倍：明显的离群点。")),
                (r'\text{LOF}(A..H) = 1.0,\;\; \text{LOF}(I) = ' + r(lof['I'], 2),
                 T(r"The same steps for the others: every dense point has $\text{lrd} = 2/3$ and every sparse point $1/6$, each equal to its neighbours', so LOF is 1 for all eight. Compare the plain 2-distances (2, 2, 1, 1 | 6, 6, 6, 6 | 5): they would rank $I$ *below* the sparse points; LOF ranks it first.", r"对其他点做同样的步骤：每个稠密点的 lrd 是 $2/3$，每个稀疏点是 $1/6$，都和各自邻居的一样，所以八个点的 LOF 都是 1。对比普通的 2-距离（2, 2, 1, 1 | 6, 6, 6, 6 | 5）：它会把 $I$ 排在稀疏点*之后*；LOF 把它排在第一。"))],
               blank=(4, '1/5', T(r"The local reachability density of $I$: the number of neighbours over the sum of the two reachability distances.", r"$I$ 的局部可达密度：邻居数除以两个可达距离之和。")),
               skill=S_DENS),
        read('cluster', T('Clustering-based: do you belong to a big cluster?', '基于聚类：你属于某个大簇吗？'),
             chapter=T('Clustering-based, and putting it together', '基于聚类，以及汇总'),
             *[
                 p(T(r"**Idea.** Normal data belong to **large, dense clusters**. Outliers are objects that do not strongly belong to any cluster: they are far from every cluster centre, or they form a **small** cluster of their own (which extends the idea from single objects to groups). Cluster first, then score by cluster structure. The lecture's method, **CBLOF** (cluster-based local outlier factor):",
                     r"**想法。**正常数据属于**大而密的簇**。离群点是不强烈属于任何簇的对象：离每个簇中心都很远，或者自己组成一个**小**簇（这把“离群”的概念从单个对象推广到了群）。先聚类，再按簇的结构打分。课件的方法是 **CBLOF**（基于聚类的局部离群因子）：")),
                 ol(T(r"**Cluster** the data (e.g. k-means, Euclidean distance).", r"对数据**聚类**（如 k-means，欧氏距离）。"),
                    T(r"**Label clusters large or small.** Sort the clusters by size. Large clusters ($LC$) hold most of the data; small clusters ($SC$) few points. Two parameters: $\alpha$, a cumulative size threshold (e.g. 90% of the points), and $\beta$, a minimum size ratio between consecutive clusters (e.g. $5\times$). The large clusters are the biggest ones $C_1..C_b$ such that together they hold at least $\alpha$ of the points, or $|C_b|/|C_{b+1}| \ge \beta$.", r"**把簇标成大或小。**按大小给簇排序。大簇（$LC$）装了大部分数据；小簇（$SC$）只有少数点。两个参数：$\alpha$，累计大小阈值（如 90% 的点）；$\beta$，相邻簇之间的最小大小比（如 $5$ 倍）。大簇是最大的那几个 $C_1..C_b$，使它们合起来至少含 $\alpha$ 的点，或 $|C_b|/|C_{b+1}| \ge \beta$。"),
                    T(r"**Score** each point $t$ (formula below).", r"给每个点 $t$ **打分**（公式见下）。"),
                    T(r"**High CBLOF means high anomaly likelihood.**", r"**CBLOF 高，异常的可能性高。**")),
                 math_(r'\text{CBLOF}(t) = \begin{cases} |C_i|\cdot\text{distance}(t, C_i) & \text{if } C_i \in LC \;(t \in C_i)\\[2pt] |C_i|\cdot\min_{C_j \in LC}\text{distance}(t, C_j) & \text{if } C_i \in SC \;(t \in C_i)\end{cases}'),
                 p(T(r"For a point in a large cluster: the cluster's size times its distance to its own cluster (centre). For a point in a small cluster: its cluster's size times the distance to the *nearest large cluster*. Points in small isolated clusters, and distant points in large clusters, are flagged.",
                     r"大簇里的点：该簇的大小乘以到自己所在簇（中心）的距离。小簇里的点：该簇的大小乘以到*最近的大簇*的距离。小而孤立的簇里的点，以及大簇里的远点，会被标出。")),
                 h(T('Another formulation: two-phase filtering', '另一种做法：两阶段过滤')),
                 ul(T(r"**Point-level filtering:** iteratively remove points whose removal improves the clustering quality most: individual anomalies.", r"**点级过滤：**迭代地去掉对聚类质量改善最大的点：个体异常。"),
                    T(r"**Cluster-level filtering:** discard small clusters far from the others: group anomalies.", r"**簇级过滤：**丢弃离其他簇很远的小簇：群体异常。")),
                 h(T('Clustering: pros and cons', '聚类方法：优点与缺点')),
                 table([T('Pros', '优点'), T('Cons', '缺点')],
                       [T('Some clustering techniques are $O(n)$', '有些聚类技术是 $O(n)$'), T('Needs thresholds for large versus small clusters ($\\alpha$, $\\beta$)', '要给大簇、小簇定阈值（$\\alpha$、$\\beta$）')],
                       [T('Extends the notion of outlier from single objects to groups', '把离群的概念从单个对象推广到群'), T('Sensitive to the number of clusters chosen', '对所选簇数敏感')],
                       ['', T('Outliers may distort the clusters they are found with (they pull a k-means centre)', '离群点可能扭曲聚类本身（把 k-means 的中心拉歪）')])]),
        derive('cblof', T('Worked: CBLOF on three clusters', '算例：三个簇上的 CBLOF'),
               [(r'|C_1| = 60,\;\; |C_2| = 30,\;\; |C_3| = 6, \qquad N = ' + str(tot) + r', \;\; \alpha = 0.9, \;\; \beta = 5',
                 T(r"Three k-means clusters, sorted by size.", r"三个 k-means 簇，按大小排序。")),
                (r'\tfrac{60}{96} = ' + r(cum[0], 3) + r' < 0.9, \;\; \tfrac{60 + 30}{96} = ' + r(cum[1], 3) + r' \ge 0.9, \;\; \tfrac{|C_2|}{|C_3|} = 5 \ge \beta',
                 T(r"Cumulative size: $C_1$ alone holds 62.5%, below $\alpha$; $C_1$ and $C_2$ together hold 93.75%, above it. The size ratio $|C_2|/|C_3| = 5 \ge \beta$ also marks the break. So $LC = \{C_1, C_2\}$ and $SC = \{C_3\}$.", r"累计大小：$C_1$ 自己占 62.5%，低于 $\alpha$；$C_1$ 和 $C_2$ 合起来占 93.75%，超过了。大小比 $|C_2|/|C_3| = 5 \ge \beta$ 也标出了断点。于是 $LC = \{C_1, C_2\}$，$SC = \{C_3\}$。")),
                (r't_1 \in C_3:\;\; \text{CBLOF}(t_1) = 6\cdot\min\{9.0,\, 6.0\} = ' + r(cb_t1, 0),
                 T(r"A point of the small cluster, whose distances to the centres of $C_1$ and $C_2$ are 9.0 and 6.0: size of its cluster times the *nearest large cluster's* distance.", r"小簇里的点，它到 $C_1$、$C_2$ 中心的距离分别是 9.0 和 6.0：它所在簇的大小乘以*最近大簇*的距离。")),
                (r't_2 \in C_1,\; d = 4.0:\;\; \text{CBLOF}(t_2) = 60 \cdot 4.0 = ' + r(cb_t2, 0),
                 T(r"A far-out point of a large cluster: its cluster's size times the distance to its own centre.", r"大簇里的一个远点：它所在簇的大小乘以到自己簇中心的距离。")),
                (r't_3 \in C_2,\; d = 1.0:\;\; \text{CBLOF}(t_3) = 30 \cdot 1.0 = ' + r(cb_t3, 0),
                 T(r"A typical point of $C_2$.", r"$C_2$ 里的一个典型点。")),
                (r'\text{CBLOF}(t_2) = ' + r(cb_t2, 0) + r' > \text{CBLOF}(t_1) = ' + r(cb_t1, 0) + r' > \text{CBLOF}(t_3) = ' + r(cb_t3, 0),
                 T(r"Both $t_1$ and $t_2$ score above the typical point $t_3$. Notice the size factor: it makes far points of big clusters score very high. The slide's own plot shows it: the small cluster's points score about 31-32 while far-out points of the large clusters score 185-564. Read the scores by comparing them, not by a fixed meaning of “small cluster = high score”.",
                   r"$t_1$ 和 $t_2$ 的分数都高于典型点 $t_3$。注意大小这个因子：它让大簇里的远点分数非常高。课件自己的图就是这样：小簇的点约 31–32，而大簇里的远点是 185–564。读这些分数要靠相互比较，而不是认定“小簇 = 高分”。"))],
               skill=S_CLU),
        read('compare', T('The four families side by side', '四类方法放在一起'), chapter=T('Exam practice', '考试练习'),
             *[
                 table([T('Family', '类别'), T('Assumes / key idea', '假设 / 核心想法'), T('Score', '分数'), T('Strength', '长处'), T('Weakness', '短处')],
                       [T('Statistical', '统计'), T('normal data from a parametric distribution', '正常数据来自参数分布'), T('z-score, Mahalanobis, Grubbs', 'z 分数、马氏距离、Grubbs'), T('well-validated tests; a quantitative score', '检验成熟；定量分数'), T('wrong if the model assumption is wrong; multi-modal, variable density; high dimension', '模型假设错了就错；多峰、密度变化；高维')],
                       [T('Proximity', '邻近'), T('outliers are far from their neighbours', '离群点离邻居远'), T('distance to the $k$-th nearest neighbour', '到第 $k$ 个最近邻的距离'), T('no distribution; multi-modal ok', '不要分布；多峰没问题'), T('$O(n^2)$; sensitive to $k$; variable density', '$O(n^2)$；对 $k$ 敏感；密度变化')],
                       [T('Density', '密度'), T('outliers sit in low-density regions, relative to neighbours', '离群点在低密度区域，相对邻居而言'), T('(inverse) relative density, LOF', '（倒）相对密度、LOF'), T('works with variable density', '密度变化时也好用'), T('$O(n^2)$; choose $k$ or $d$', '$O(n^2)$；要选 $k$ 或 $d$')],
                       [T('Clustering', '聚类'), T('normal data are in large dense clusters', '正常数据在大而密的簇里'), T('CBLOF', 'CBLOF'), T('can be $O(n)$; finds groups too', '可以是 $O(n)$；也能找出群'), T('thresholds; number of clusters; outliers distort clusters', '阈值；簇数；离群点扭曲聚类')]),
                 quiz(T('Which family is best suited to this data: one tight cluster of 500 sensor readings and another loose cluster of 500, plus a few points just outside the tight cluster?', '下面这份数据最适合哪类方法：500 个传感器读数组成的一个紧簇，另一个 500 个读数组成的松散簇，再加几个刚好在紧簇外面的点？'),
                      [(T(r"Distance to the $k$-th neighbour with one global threshold", r"到第 $k$ 个邻居的距离，用一个全局阈值"), T(r"The loose cluster's normal points would have larger distances than the points just outside the tight one: no threshold works.", r"松散簇的正常点，距离会比紧簇外的那几个点还大：没有任何阈值行得通。")),
                       (T(r"A single Gaussian with z-scores", r"一个高斯分布加 z 分数"), T(r"Two clusters of different spread are not one Gaussian; the fitted $\sigma$ would be large and swallow the points.", r"两个散布不同的簇不是一个高斯；拟合出的 $\sigma$ 会很大，把那几个点吞掉。")),
                       (T(r"Local relative density (LOF): compare each point with its own neighbourhood", r"局部相对密度（LOF）：把每个点和它自己的邻域比"), True)],
                      T(r"Variable density is exactly what relative density was designed for.", r"密度变化正是相对密度被设计出来要处理的情形。"))]),
        number('cp-precision', T('Precision of a detector', '检测器的精确率'), S_DEF,
               T(r"A data set has " + f'{N2:,}' + r" transactions, of which " + str(A2) + r" are fraud. A detector catches 80% of the frauds and wrongly flags 2% of the normal transactions. What is its precision? Give a decimal to three places.",
                 r"一个数据集有 " + f'{N2:,}' + r" 笔交易，其中 " + str(A2) + r" 笔是欺诈。一个检测器抓到 80% 的欺诈，同时错误地标出 2% 的正常交易。它的精确率是多少？保留三位小数。"),
               round(prec2, 3),
               T(r"$TP = 0.8 \times " + str(A2) + r" = " + str(tp2) + r"$. The normal ones number $" + str(N2 - A2) + r"$, so $FP = 0.02 \times " + str(N2 - A2) + r" = " + str(fp2) + r"$. Precision $= " + str(tp2) + r"/(" + str(tp2) + r" + " + str(fp2) + r") = " + r(prec2, 3) + r"$: about 7 in 10 alerts are false.",
                 r"$TP = 0.8 \times " + str(A2) + r" = " + str(tp2) + r"$。正常交易有 $" + str(N2 - A2) + r"$ 笔，所以 $FP = 0.02 \times " + str(N2 - A2) + r" = " + str(fp2) + r"$。精确率 $= " + str(tp2) + r"/(" + str(tp2) + r" + " + str(fp2) + r") = " + r(prec2, 3) + r"$：十个警报里约七个是假的。"),
               tolerance=0.002, purpose='practice'),
        number('cp-lof1d', T('A relative-density score', '一个相对密度分数'), S_DENS,
               T(r"Data $D = \{1.0, 1.1, 1.3, 1.5, 5.0, 5.6, 6.4, 7.4\}$. Using the lecture's method with $k = 2$ (density = inverse of the mean distance to the 2 nearest neighbours; score = mean density of the neighbours divided by the point's own density), score the query point $x = 2.4$. Two decimals.",
                 r"数据 $D = \{1.0, 1.1, 1.3, 1.5, 5.0, 5.6, 6.4, 7.4\}$。用课件的方法，$k = 2$（密度 = 到 2 个最近邻的平均距离的倒数；分数 = 邻居的平均密度除以该点自己的密度），给查询点 $x = 2.4$ 打分。保留两位小数。"),
               round(cp_ir, 2),
               T(r"Nearest to 2.4: 1.5 (0.9) and 1.3 (1.1); mean 1.0, density " + r(density_1d(2.4, CP_DATA, 2), 2) + r". Neighbour 1.5 has neighbours 1.3 (0.2) and 1.1 (0.4): density " + r(density_1d(1.5, CP_DATA, 2), 2) + r". Neighbour 1.3 has 1.1 (0.2) and 1.5 (0.2): density " + r(density_1d(1.3, CP_DATA, 2), 2) + r". Mean neighbour density $(" + r(density_1d(1.5, CP_DATA, 2), 2) + r" + " + r(density_1d(1.3, CP_DATA, 2), 2) + r")/2$ divided by " + r(density_1d(2.4, CP_DATA, 2), 2) + r" gives $" + r(cp_ir, 2) + r"$: 2.4 is much sparser than its neighbours, an outlier.",
                 r"离 2.4 最近的是 1.5（0.9）和 1.3（1.1）；平均 1.0，密度 " + r(density_1d(2.4, CP_DATA, 2), 2) + r"。邻居 1.5 的邻居是 1.3（0.2）和 1.1（0.4）：密度 " + r(density_1d(1.5, CP_DATA, 2), 2) + r"。邻居 1.3 的邻居是 1.1（0.2）和 1.5（0.2）：密度 " + r(density_1d(1.3, CP_DATA, 2), 2) + r"。邻居平均密度 $(" + r(density_1d(1.5, CP_DATA, 2), 2) + r" + " + r(density_1d(1.3, CP_DATA, 2), 2) + r")/2$ 除以 " + r(density_1d(2.4, CP_DATA, 2), 2) + r" 得 $" + r(cp_ir, 2) + r"$：2.4 比它的邻居稀疏得多，是离群点。"),
               tolerance=0.03, purpose='practice'),
        number('cp-mahal', T('A Mahalanobis distance', '一个马氏距离'), S_STAT,
               T(r"Two features with mean $(0, 0)$ and covariance $\Sigma = \begin{pmatrix}4 & 0\\0 & 1\end{pmatrix}$. Find the Mahalanobis distance of the point $(4, 2)$. Two decimals.",
                 r"两个特征，均值 $(0, 0)$，协方差 $\Sigma = \begin{pmatrix}4 & 0\\0 & 1\end{pmatrix}$。求点 $(4, 2)$ 的马氏距离。保留两位小数。"),
               round(cp_md, 2),
               T(r"$\Sigma$ is diagonal, so $\Sigma^{-1} = \text{diag}(1/4, 1)$ and $D_M^2 = 4^2/4 + 2^2/1 = 4 + 4 = 8$, $D_M = \sqrt 8 = " + r(cp_md, 2) + r"$. (The Euclidean distance would be $\sqrt{20} = 4.47$: dividing by the variances shrinks the first feature's gap.)",
                 r"$\Sigma$ 是对角的，所以 $\Sigma^{-1} = \text{diag}(1/4, 1)$，$D_M^2 = 4^2/4 + 2^2/1 = 4 + 4 = 8$，$D_M = \sqrt 8 = " + r(cp_md, 2) + r"$。（欧氏距离是 $\sqrt{20} = 4.47$：除以方差把第一个特征的偏差缩小了。）"),
               tolerance=0.02, purpose='practice'),
        choice('cp-setting', T('Which setting?', '哪种设定？'), S_DEF,
               T(r"A bank has years of transactions that it is confident are legitimate, but almost no confirmed fraud examples, and fraud tactics keep changing. Which approach fits, and what is its main risk?", r"一家银行有多年被确认合法的交易记录，但几乎没有确认的欺诈样本，而且欺诈手法一直在变。哪种方法合适，主要风险是什么？"),
               [(T(r"Semi-supervised: learn a model of normal transactions and flag departures; the risk is false alarms on legitimate but unseen behaviour", r"半监督：学一个正常交易的模型，把偏离的标出来；风险是对合法但没见过的行为误报"), True),
                (T(r"Supervised: train a classifier of fraud versus legitimate; the risk is none, since the data is plentiful", r"监督：训练欺诈对合法的分类器；没有风险，因为数据很多"), T(r"There are almost no fraud labels, and a supervised model cannot detect new tactics it has not seen; classes would be extremely imbalanced.", r"几乎没有欺诈标签，监督模型也检测不到没见过的新手法；类别会极端不平衡。"), 'supervised-ok'),
                (T(r"Unsupervised: ignore the legitimacy labels because labels never help", r"无监督：忽略合法的标签，因为标签从来没用"), T(r"Knowing that the data is (almost) all normal is valuable: it lets us model normal directly instead of guessing it from mixed data.", r"知道数据（几乎）全是正常的很有价值：可以直接给正常建模，而不是在混合的数据里去猜。"), 'labels-useless'),
                (T(r"Supervised, but using accuracy to evaluate", r"监督，但用准确率评估"), T(r"Accuracy is misleading when anomalies are rare: always saying “normal” scores about 99.5%.", r"异常很少时准确率会误导：永远回答“正常”也能得约 99.5%。"), 'accuracy-ok')],
               T(r"Labels only for the normal class is the semi-supervised setting; its challenge is false alarms from legitimate novelty.", r"只有正常类的标签，是半监督设定；它的挑战是合法的新情况造成的误报。")),
        text_q('cp-metrics', T('Evaluating an anomaly detector (Section A)', '评估异常检测器（A 部分）'), S_DEF,
               T(r"A detector for rare anomalies (0.5% of the data) reaches 99.3% accuracy. Explain why this number may be misleading, and which metrics you would report instead. (2-3 lines)", r"一个针对稀有异常（占数据的 0.5%）的检测器达到 99.3% 的准确率。解释为什么这个数字可能误导，以及你会改报哪些指标。（2-3 行）"),
               [T('Classes are highly imbalanced: always predicting normal already gives 99.5% accuracy', '类别高度不平衡：永远预测正常已经有 99.5% 的准确率'),
                T('So 99.3% may be worse than the trivial baseline and may miss many anomalies', '所以 99.3% 可能比平凡基线还差，还可能漏掉许多异常'),
                T('Report recall (share of anomalies caught) and precision (share of alerts that are real), and their trade-off as the threshold moves', '报告召回率（抓到的异常占比）和精确率（警报里真的占比），以及阈值变化时二者的取舍')],
               T('The classes are extremely imbalanced: a trivial detector that always says "normal" already has 99.5% accuracy while catching no anomaly, so 99.3% is no better than doing nothing. Accuracy is dominated by the majority class. I would report recall (the fraction of true anomalies found) together with precision (the fraction of alerts that are real), and show how they trade off as the threshold changes, because raising recall usually increases false positives.',
                 'The classes are extremely imbalanced: a trivial detector that always says "normal" already has 99.5% accuracy while catching no anomaly, so 99.3% is no better than doing nothing. Accuracy is dominated by the majority class. I would report recall (the fraction of true anomalies found) together with precision (the fraction of alerts that are real), and show how they trade off as the threshold changes, because raising recall usually increases false positives.'),
               T(r"Name the imbalance, give the baseline number, name the metrics.", r"点出不平衡，给出基线的数，说出指标。")),
        text_q('cp-density', T('Why relative density? (Section A)', '为什么要相对密度？（A 部分）'), S_DENS,
               T(r"Explain why the distance to the $k$-th nearest neighbour can fail when the data contain regions of different density, and how local outlier factor (LOF) addresses this. (3 lines)", r"解释当数据含有不同密度的区域时，到第 $k$ 个最近邻的距离为什么会失败，以及局部离群因子（LOF）怎样解决。（3 行）"),
               [T('kNN distance is an absolute measure: points in a sparse region have large distances even when normal', 'kNN 距离是绝对度量：稀疏区域里的点即使正常距离也大'),
                T('So an anomaly next to a dense cluster can score lower than normal sparse points; no global threshold works', '所以紧邻稠密簇的异常得分可能比稀疏区的正常点还低；没有全局阈值行得通'),
                T('LOF compares a point\'s local density with the average density of its neighbours; about 1 is normal, much greater than 1 is an outlier', 'LOF 把一个点的局部密度和它邻居的平均密度比；约为 1 是正常，远大于 1 是离群')],
               T('The distance to the k-th neighbour is an absolute measure: normal points in a sparse region have large distances, so an anomaly beside a dense cluster can get a lower score than normal sparse points, and no single threshold separates them. LOF instead compares the local density of a point with the average density of its k nearest neighbours. A ratio near 1 means the point is as dense as its surroundings (normal); a ratio well above 1 means it is much sparser than its neighbours, so it is an outlier relative to its own neighbourhood.',
                 'The distance to the k-th neighbour is an absolute measure: normal points in a sparse region have large distances, so an anomaly beside a dense cluster can get a lower score than normal sparse points, and no single threshold separates them. LOF instead compares the local density of a point with the average density of its k nearest neighbours. A ratio near 1 means the point is as dense as its surroundings (normal); a ratio well above 1 means it is much sparser than its neighbours, so it is an outlier relative to its own neighbourhood.'),
               T(r"The key phrase is *relative to its neighbourhood*.", r"关键的一句是*相对它的邻域*。")),
        text_q('cp-design', T('Design: detecting faulty machines (Section C)', '设计题：检测故障机器（C 部分）'), S_CMP,
               T(r"A factory logs 20 sensor readings per second from 500 machines. Fewer than 0.1% of the time a machine is faulty, and these faults are almost never labelled. Design an anomaly detection approach: choose a setting and a method, say how you would score and evaluate it, and name two risks. (A third of a page)",
                 r"一家工厂每秒记录 500 台机器的 20 个传感器读数。机器出故障的时间不到 0.1%，而且这些故障几乎没有标注。设计一个异常检测方案：选择设定和方法，说明怎样打分和评估，并指出两个风险。（约三分之一页）"),
               [T('Setting: unsupervised or semi-supervised (labels of normal operation only); a supervised model is not possible', '设定：无监督或半监督（只有正常运行的标签）；监督模型不可行'),
                T('Contextual: normal depends on the machine and its operating mode, so model per machine/mode (contextual attributes) or use relative methods (LOF / cluster-based)', '上下文：正常取决于机器和运行模式，所以按机器/模式分别建模（上下文属性），或用相对方法（LOF / 基于聚类）'),
                T('Possibly collective anomalies: look at windows of time rather than single readings', '可能是集体异常：看时间窗口而不是单个读数'),
                T('Evaluate with a small labelled sample or injected faults: precision, recall, alert budget; not accuracy', '用少量标注样本或注入的故障评估：精确率、召回率、警报预算；不用准确率'),
                T('Risks: false alarms from legitimate new operating modes; concept drift; the contaminated "normal" training data', '风险：合法的新运行模式引起误报；概念漂移；“正常”训练数据被污染')],
               T('Setting: semi-supervised, trained on a period of normal operation, with an unsupervised check. Because normal depends on the machine and its operating mode, I would model each machine and mode separately (the contextual attributes), and score each time window of readings rather than single readings, since a fault often shows as a sequence (a collective anomaly). For the score I would use a local method such as LOF on window features, or a per-mode Gaussian with Mahalanobis distance if the data are roughly Gaussian, with the threshold set by the number of alerts maintenance can handle. Evaluation: with few or no labels, inject known faults or label a small sample and report precision and recall, never accuracy. Risks: false alarms when a legitimate new operating mode appears, and drift over time that makes the "normal" model stale (retrain regularly); also the normal training data may already contain undetected faults.',
                 'Setting: semi-supervised, trained on a period of normal operation, with an unsupervised check. Because normal depends on the machine and its operating mode, I would model each machine and mode separately (the contextual attributes), and score each time window of readings rather than single readings, since a fault often shows as a sequence (a collective anomaly). For the score I would use a local method such as LOF on window features, or a per-mode Gaussian with Mahalanobis distance if the data are roughly Gaussian, with the threshold set by the number of alerts maintenance can handle. Evaluation: with few or no labels, inject known faults or label a small sample and report precision and recall, never accuracy. Risks: false alarms when a legitimate new operating mode appears, and drift over time that makes the "normal" model stale (retrain regularly); also the normal training data may already contain undetected faults.'),
               T(r"Section C: pick the setting from the labels you have, match the method to the data (context, groups, density), say how you would evaluate with rare labels, and name the risks.", r"C 部分：由手里的标签选设定，让方法贴合数据（上下文、群、密度），说明标签很少时怎么评估，并点出风险。")),
        read('remember', T('What to remember', '要记住的'), chapter=T('Review sheet', '复习卡'),
             *[
                 ul(T(r"**Anomaly** = generated by a different mechanism; not noise. Types: **point**, **contextual** (contextual vs behavioural attributes), **collective** (needs relations among instances).", r"**异常** = 由另一种机制产生；不是噪声。类型：**点**、**上下文**（上下文属性与行为属性）、**集体**（需要实例间的关系）。"),
                    T(r"**Settings:** supervised (both labels, imbalance, accuracy misleading, aim for recall), semi-supervised (normal labels only, false alarms on unseen-but-legitimate), unsupervised (no labels, normal = clustered, false positives).", r"**设定：**监督（两类标签、不平衡、准确率误导、追求召回）、半监督（只有正常标签、对没见过但合法的行为误报）、无监督（没有标签、正常 = 成团、误报）。")),
                 math_(r'z = \Bigl|\frac{x - \mu}{\sigma}\Bigr|,\;\; D_M = \sqrt{(\mathbf{x} - \boldsymbol\mu)^\top\Sigma^{-1}(\mathbf{x} - \boldsymbol\mu)},\;\; G = \frac{\max_i |x_i - \mu|}{\sigma}'),
                 math_(r'\text{density}(\mathbf{x}, k) = \Bigl(\tfrac1k\sum_{\mathbf{y} \in N(\mathbf{x},k)}\text{distance}(\mathbf{x},\mathbf{y})\Bigr)^{-1},\;\; \text{score} = \frac{\overline{\text{density}}(N(\mathbf{x}, k))}{\text{density}(\mathbf{x}, k)}'),
                 math_(r'\text{LOF}_k(p) = \frac{1}{|N_k(p)|}\sum_{o}\frac{\text{lrd}_k(o)}{\text{lrd}_k(p)}, \quad \text{reach}_k(p,o) = \max\{d_k(o), d(p,o)\}, \quad \text{CBLOF}(t) = |C_i|\cdot\text{dist}'),
                 ul(T(r"z-score: $z > 3$ is the 99.7% rule, but $z \le \sqrt{N-1}$ always; Mahalanobis uses the covariance, and is for global anomalies; both need a (roughly) Gaussian model.", r"z 分数：$z > 3$ 是 99.7% 规则，但 $z \le \sqrt{N-1}$ 恒成立；马氏距离用协方差，针对全局异常；两者都要（大致）高斯的模型。"),
                    T(r"Proximity: distance to the $k$-th neighbour; $O(n^2)$, sensitive to $k$, fails when density varies. Density/LOF: relative to neighbours, $\approx 1$ normal, $\gg 1$ outlier. Clustering: small or distant-from-centre points, size-weighted.", r"邻近：到第 $k$ 个邻居的距离；$O(n^2)$，对 $k$ 敏感，密度变化时失败。密度/LOF：相对邻居，$\approx 1$ 正常，$\gg 1$ 离群。聚类：小簇或离中心远的点，按簇大小加权。"),
                    T(r"Evaluate with **precision and recall**, not accuracy.", r"评估用**精确率和召回率**，不用准确率。"))]),
    ]
    return dict(
        id=lid('anomaly'), title=T('Anomaly detection: statistical, proximity, density, clustering', '异常检测：统计、邻近、密度、聚类'),
        description=T('What counts as an anomaly and why it is hard to learn, then the four unsupervised families with every score computed by hand: z-score and Mahalanobis, k-th neighbour distance, relative density and a full LOF, and CBLOF.',
                      '什么算异常、为什么难学，然后是四类无监督方法，每个分数都手算：z 分数与马氏距离、第 k 邻居距离、相对密度与完整的 LOF、CBLOF。'),
        minutes=50,
        skills=[{'id': S_DEF, 'name': T('Anomaly types, settings, why it is hard', '异常的类型、设定、为什么难')},
                {'id': S_STAT, 'name': T('Statistical detection: z-score, Mahalanobis, Grubbs', '统计检测：z 分数、马氏距离、Grubbs')},
                {'id': S_PROX, 'name': T('Proximity-based detection', '基于邻近的检测')},
                {'id': S_DENS, 'name': T('Density-based detection and LOF', '基于密度的检测与 LOF')},
                {'id': S_CLU, 'name': T('Clustering-based detection (CBLOF)', '基于聚类的检测（CBLOF）')},
                {'id': S_CMP, 'name': T('Choosing a method', '选择方法')}],
        misconceptions=[{'id': 'supervised-ok', 'description': T('Thinking a standard supervised classifier solves anomaly detection', '以为标准的监督分类器就能解决异常检测')},
                        {'id': 'accuracy-ok', 'description': T('Reporting accuracy on rare-anomaly data', '在异常很稀有的数据上报告准确率')},
                        {'id': 'global-threshold', 'description': T('Using one distance threshold when densities differ', '密度不同时仍用一个距离阈值')},
                        {'id': 'labels-useless', 'description': T('Ignoring labels of normal data', '忽略正常数据的标签')}],
        steps=steps)


LESSONS = [L_features, L_anomaly]
