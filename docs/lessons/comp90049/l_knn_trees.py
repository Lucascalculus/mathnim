# COMP90049 lessons `knn` (deck 03) and `trees` (deck 05). Every number in a worked example is computed here.
import random
from math import log2, sqrt

from ml_kit import *  # noqa: F401,F403

try:
    import numpy as np
except ImportError:  # the curse-of-dimensionality plot needs it; the lessons build without
    np = None


def fx(x, n=2):
    """A number as text with n decimals (a plain minus sign, no trailing 'negative zero')."""
    s = f'{x:.{n}f}'
    return s[1:] if s.startswith('-') and float(s) == 0 else s


# ==================================================================================================
#                                              k-NEAREST NEIGHBOURS
# ==================================================================================================
def l1(a, b): return sum(abs(x - y) for x, y in zip(a, b))
def l2(a, b): return sqrt(sum((x - y) ** 2 for x, y in zip(a, b)))
def dot(a, b): return sum(x * y for x, y in zip(a, b))
def cosine(a, b): return dot(a, b) / (sqrt(dot(a, a)) * sqrt(dot(b, b)))


# the deck's four-feature pair (slides 23-24)
KA, KB = [2.0, 1.4, 4.6, 5.5], [1.0, 2.4, 6.6, 2.5]
# the deck's three documents (slide 26)
DOC1, DOC2, DOC3 = [200, 300, 200], [300, 200, 100], [50, 40, 25]
# the deck's fruit (slides 15-21): red yellow round curved sweet small ('?' read as a match, as the deck does)
APPLE = [1, 0, 1, 0, 1, 0]
BANANA = [0, 1, 0, 1, 1, 0]
hamming_ab = sum(x != y for x, y in zip(APPLE, BANANA))                   # 4
smd_ab = 1 - sum(x == y for x, y in zip(APPLE, BANANA)) / 6              # 2/3
JA, JB = {'red', 'round', 'sweet'}, {'yellow', 'curved', 'sweet'}
jaccard_ab = 1 - len(JA & JB) / len(JA | JB)                             # 4/5
dice_ab = 2 * len(JA & JB) / (len(JA) + len(JB))                         # 1/3
# the deck's ratings (slides 27-28)
RA, RB = [2 / 4, 0 / 4, 1 / 4], [4 / 4, 3 / 4, 4 / 4]

# voting example (slides 30-35): (class, distance) of the K=4 neighbours
VOTE = [('red', 0.0), ('blue', 1.0), ('blue', 1.5), ('blue', 1.5)]
EPS = 1e-5


def inv_w(d): return 1 / (d + EPS)
def invlin_w(d, dmin, dmax): return (dmax - d) / (dmax - dmin)


inv_red = inv_w(0.0)
inv_blue = sum(inv_w(d) for c, d in VOTE if c == 'blue')
lin_red = invlin_w(0.0, 0.0, 1.5)
lin_blue = sum(invlin_w(d, 0.0, 1.5) for c, d in VOTE if c == 'blue')

# scaling example: a query and two customers, age in years and income in dollars
SQ, SA, SB = (30, 50000), (31, 58000), (60, 50500)
AGE_RANGE, INC_RANGE = (18, 70), (20000, 120000)


def mm(v, lo, hi): return (v - lo) / (hi - lo)


def scaled(p): return (mm(p[0], *AGE_RANGE), mm(p[1], *INC_RANGE))


raw_dA, raw_dB = l2(SQ, SA), l2(SQ, SB)
sc_dA, sc_dB = l2(scaled(SQ), scaled(SA)), l2(scaled(SQ), scaled(SB))

# curse of dimensionality: nearest / farthest distance of 100 uniform points from a uniform query (seeded)
CURSE_D = [1, 2, 5, 10, 20, 50, 100, 200, 500, 1000]


def curse_ratios():
    if np is None:
        return {d: 0.0 for d in CURSE_D}
    rng = np.random.default_rng(1)
    out = {}
    for d in CURSE_D:
        pts = rng.random((200, 100, d))
        q = rng.random((200, 1, d))
        dist = np.sqrt(((pts - q) ** 2).sum(axis=2))
        out[d] = float((dist.min(axis=1) / dist.max(axis=1)).mean())
    return out


CURSE = curse_ratios()
REL_SPREAD = lambda d: 6 * sqrt(7 / 180) / sqrt(d)  # noqa: E731


# --------------------------------------------------------------------------------------- figures
def fig_l1_l2(lang):
    f = Fig(520, 330, lang)
    ox, oy, s = 60, 290, 50  # origin and unit
    X = lambda x: ox + x * s  # noqa: E731
    Y = lambda y: oy - y * s  # noqa: E731
    for i in range(0, 7):
        f.line(X(i), Y(0), X(i), Y(6), LINE, 1)
    for j in range(0, 7):
        f.line(X(0), Y(j), X(6.2), Y(j), LINE, 1)
    a, b = (1, 5), (5, 3)
    f.line(X(a[0]), Y(a[1]), X(b[0]), Y(a[1]), BLUE, 4)
    f.line(X(b[0]), Y(a[1]), X(b[0]), Y(b[1]), BLUE, 4)
    f.line(X(a[0]), Y(a[1]), X(b[0]), Y(b[1]), ORANGE, 4)
    f.circle(X(a[0]), Y(a[1]), 7, INK)
    f.circle(X(b[0]), Y(b[1]), 7, INK)
    f.text(X(a[0]) - 6, Y(a[1]) - 14, 'a', 20, INK, 'end', 'bold')
    f.text(X(b[0]) + 12, Y(b[1]) + 6, 'b', 20, INK, 'start', 'bold')
    f.text(X(3), Y(5) - 12, f'L1: 4 + 2 = 6', 18, BLUE, 'middle')
    f.text(X(2.2), Y(3.8), f'L2 = {fx(l2(a, b))}', 18, ORANGE, 'end')
    return f.svg()


def knn_data():
    rnd = random.Random(7)
    pts = []
    for _ in range(16):
        pts.append((min(.97, max(.03, rnd.gauss(.36, .15))), min(.97, max(.03, rnd.gauss(.40, .17))), 0))
    for _ in range(15):
        pts.append((min(.97, max(.03, rnd.gauss(.64, .15))), min(.97, max(.03, rnd.gauss(.60, .17))), 1))
    return pts


KNN_PTS = knn_data()


def knn_predict(x, y, k):
    ds = sorted(KNN_PTS, key=lambda p: (p[0] - x) ** 2 + (p[1] - y) ** 2)[:k]
    return 1 if sum(p[2] for p in ds) * 2 > k else 0


def fig_knn_regions(lang):
    f = Fig(690, 250, lang)
    n, size, top = 36, 200, 36
    cols = ['#cfe0ff', '#ffdcc7']
    dots = [BLUE, ORANGE]
    for pi, (k, title) in enumerate([(1, 'k = 1'), (7, 'k = 7'), (len(KNN_PTS), 'k = N')]):
        ox = 14 + pi * (size + 24)
        f.text(ox + size / 2, 26, title, 18, INK, 'middle', 'bold')
        cell = size / n
        f.rect(ox, top, size, size, cols[0], None, 0, 0)
        d = ''
        for j in range(n):
            i = 0
            while i < n:
                if knn_predict((i + .5) / n, 1 - (j + .5) / n, k) == 1:
                    i0 = i
                    while i < n and knn_predict((i + .5) / n, 1 - (j + .5) / n, k) == 1:
                        i += 1
                    d += f'M{ox + i0 * cell:.1f} {top + j * cell:.1f}h{(i - i0) * cell + .4:.1f}v{cell + .4:.1f}h-{(i - i0) * cell + .4:.1f}z'
                else:
                    i += 1
        if d:
            f.parts.append(f'<path d="{d}" fill="{cols[1]}"/>')
        f.rect(ox, top, size, size, 'none', INK, 1.6, 0)
        for x, y, c in KNN_PTS:
            f.circle(ox + x * size, top + (1 - y) * size, 4.2, dots[c], '#ffffff', 1.2)
    return f.svg()


def fig_curse(lang):
    pl = Plot(0, 3.2, 0, 1.0, left=64, right=30)
    pts = [(__import__('math').log10(d), CURSE[d]) for d in CURSE_D]
    pl.curve(lambda x: 0, 0, 0, INK, 0)
    poly = ' '.join(pl.pt(x, y) for x, y in pts)
    pl.parts.append(f'<polyline points="{poly}" fill="none" stroke="{BLUE}" stroke-width="3" stroke-linejoin="round"/>')
    for x, y in pts:
        pl.dot(x, y, BLUE, 5)
    pl.seg((0, 1), (3.2, 1), MUTED, 1.5, '6 6')
    for d in (1, 10, 100, 1000):
        lx = __import__('math').log10(d)
        pl.text(lx, 0, str(d), MUTED, 15, 'middle', 0, 24)
    pl.axes('d', 'ratio', (), (0, .5, 1))
    return pl.svg()


# ---------------------------------------------------------------------------------------- the lesson
def L_knn():
    S = lambda s: f'knn.{s}'  # noqa: E731
    ex_a, ex_b = [3, 1, 4], [1, 5, 2]
    ex_l2, ex_l1 = l2(ex_a, ex_b), l1(ex_a, ex_b)
    cos12, cos23 = cosine(DOC1, DOC2), cosine(DOC2, DOC3)
    rA, rB = l1(RA, RB), l2(RA, RB)
    # practice vote: neighbours (class, distance)
    pv = [('A', 1.0), ('B', 2.0), ('B', 3.0), ('A', 5.0)]
    pv_lin = {c: sum(invlin_w(d, 1.0, 5.0) for cc, d in pv if cc == c) for c in 'AB'}
    pv_inv = {c: sum(inv_w(d) for cc, d in pv if cc == c) for c in 'AB'}
    assert pv_lin['B'] > pv_lin['A'] and pv_inv['A'] > pv_inv['B']
    return dict(
        id=lid('knn'), title=T('k-nearest neighbours', 'k 近邻（k-nearest neighbours）'),
        description=T('The method that just remembers: how it predicts, every distance and voting rule on the exam, how to choose k, and why scaling and high dimensions break it.',
                      '什么都不学、只靠记忆的方法：怎么预测，考试里的每一种距离和投票规则，k 怎么选，以及为什么特征缩放和高维会把它搞坏。'),
        minutes=40,
        skills=[{'id': S('algorithm'), 'name': T('The k-NN algorithm and lazy learning', 'k 近邻算法与惰性学习')},
                {'id': S('distance'), 'name': T('Distances and similarities by hand', '手算各种距离与相似度')},
                {'id': S('voting'), 'name': T('Voting schemes and ties', '投票规则与平局')},
                {'id': S('k'), 'name': T('Choosing k: the bias-variance knob', '选 k：偏差-方差旋钮')},
                {'id': S('scaling'), 'name': T('Scaling features', '特征缩放')},
                {'id': S('curse'), 'name': T('The curse of dimensionality', '维度灾难')}],
        misconceptions=[{'id': 'euclid-everywhere', 'description': T('Using raw Euclidean distance on features with different units', '对单位不同的特征直接用欧氏距离')},
                        {'id': 'k-by-training-error', 'description': T('Picking k by training error (k = 1 always wins)', '用训练误差选 k（k = 1 永远最好）')},
                        {'id': 'close-in-high-d', 'description': T('Believing the nearest neighbour is still near in very high dimensions', '以为维度很高时最近邻仍然很近')}],
        steps=[
            read('idea', T('What it is: predict by remembering', '它是什么：靠记忆来预测'),
                 p(T(r"**k-nearest neighbours** (k-NN) is the one method that does no learning in the usual sense. Training means *store every example*. To predict a new instance, find the $k$ stored instances closest to it and let them answer.",
                     r"**k 近邻**（k-NN）是唯一一个不做“学习”的方法。训练就是**把所有样本存起来**。预测新样本时，找出离它最近的 $k$ 个存下的样本，让它们来回答。")),
                 ol(T(r"Compute the distance from the test instance to every training instance.", r"算出测试样本到每一个训练样本的距离。"),
                    T(r"Keep the $k$ closest: the *neighbours*.", r"留下最近的 $k$ 个，它们是“近邻”。"),
                    T(r"Combine their labels: **classification** returns the most common class; **regression** returns the average value.",
                      r"合并它们的标签：**分类**返回最常见的类别；**回归**返回平均值。")),
                 p(T(r"Everything else is a choice you must make, and the deck calls them the four problems. Each one is a section of this lesson, and each is a typical exam question:",
                     r"除此之外，一切都是要你自己做的选择，课件把它们叫做四个问题。每一个都是本课的一节，也都是考试的常见题：")),
                 table([T('Problem', '问题'), T('Choices', '选项'), T('Where', '在哪一节')],
                       [T('1. Represent a point', '1. 怎么表示一个点'), T('feature vector; nominal, ordinal, numeric', '特征向量；名义、有序、数值'), T('Representing', '表示')],
                       [T('2. Measure distance', '2. 怎么量距离'), T('Hamming, Jaccard, L1, L2, cosine', 'Hamming、Jaccard、L1、L2、余弦'), T('Distances', '距离')],
                       [T('3. Neighbours disagree', '3. 近邻意见不一'), T('majority, inverse distance, inverse linear', '多数票、反距离、反线性距离'), T('Voting', '投票')],
                       [T('4. Choose k', '4. 怎么选 k'), T('small k: jagged; large k: smooth', '小 k：锯齿；大 k：平滑'), T('Choosing k', '选 k')]),
                 callout('note', T('Why it is a model at all', '为什么它也算一个模型'),
                         T(r"The stored data plus a fixed distance and a fixed voting rule *is* the model. The regions of space where the answer changes are never written down; they exist implicitly in the data. This is **lazy** (instance-based) learning; we return to it at the end.",
                           r"存下的数据，加上固定的距离和固定的投票规则，*就是*这个模型。答案发生变化的那些区域从不被写下来，只隐含在数据里。这叫**惰性**（lazy，基于实例）学习，最后一节再回来讲它。")),
                 chapter=T('The method', '方法')),
            read('represent', T('Representing a point: the feature vector', '表示一个点：特征向量'),
                 p(T(r"Distance needs numbers, so every instance becomes a **feature vector**. The deck's golf data has four features and one label (instance a: sunny, hot, high, FALSE → no); row a is the vector (sunny, hot, high, FALSE). Three kinds of feature need three treatments:",
                     r"距离需要数字，所以每个样本都变成一个**特征向量**。课件里的高尔夫数据有四个特征和一个标签（样本 a：晴、热、高、FALSE → no），a 行就是向量（sunny, hot, high, FALSE）。三种特征，三种处理：")),
                 table([T('Type', '类型'), T('Meaning', '含义'), T('Becomes', '变成')],
                       [T('Nominal', '名义'), T('values with no order (colour, shape)', '没有顺序的取值（颜色、形状）'), T('one 0/1 column per value (one-hot)', '每个取值一列 0/1（独热）')],
                       [T('Ordinal', '有序'), T('values with an order (ratings)', '有顺序的取值（评分）'), T('normalised rank in [0, 1]', '归一化的名次，落在 [0, 1]')],
                       [T('Numerical', '数值'), T('real numbers, vectors', '实数、向量'), T('itself (after scaling)', '本身（缩放之后）')]),
                 p(T(r"The deck's fruit example turns nominal features into a 0/1 vector. Colours, shapes and tastes become six columns; an apple is red, round, sweet:",
                     r"课件的水果例子把名义特征变成 0/1 向量。颜色、形状、口味展开成六列；苹果是红、圆、甜：")),
                 table([T('instance', '样本'), 'red', 'yellow', 'round', 'curved', 'sweet', 'small'],
                       ['apple', '1', '0', '1', '0', '1', '?'], ['banana', '0', '1', '0', '1', '1', '?'], ['cherry', '1', '0', '1', '0', '1', '1']),
                 p(T(r"The feature vector has $6$ entries. The deck leaves the apple's and banana's size as `?` (missing) and reads it as a match when comparing them. Note what one-hot does: it makes every pair of different values equally far apart, which is exactly right for nominal data (red is not “closer” to yellow than to blue).",
                     r"特征向量有 $6$ 个分量。课件把苹果和香蕉的“大小”留成 `?`（缺失），比较它们时当作匹配。注意独热做了什么：任意两个不同取值之间距离都一样，对名义数据这正合适（红色并不比蓝色更“靠近”黄色）。"))),
            read('nominal', T('Distances for 0/1 features: Hamming, matching, Jaccard', '0/1 特征的距离：Hamming、匹配、Jaccard'),
                 p(T(r"For two instances $a, b$ of $m$ nominal (0/1) features, three measures count agreement in different ways. Work them on apple vs banana from the previous page.",
                     r"两个有 $m$ 个名义（0/1）特征的样本 $a, b$，有三种数“是否一致”的方式。在上一页的苹果和香蕉上算一遍。")),
                 h(T('Hamming distance', 'Hamming 距离')),
                 math_(r"d(a,b) = \sum_{i=1}^{m} \mathbb{I}(a_i \neq b_i)"),
                 p(T(r"Count the positions where they differ. Apple vs banana: red, yellow, round and curved differ; sweet agrees; the missing size is read as a match. So $d = %d$." % hamming_ab,
                     r"数两个向量不同的位置。苹果与香蕉：红、黄、圆、弯都不同；甜相同；缺失的大小当作一致。所以 $d = %d$。" % hamming_ab)),
                 h(T('Simple matching distance', '简单匹配距离')),
                 math_(r"d = 1 - \frac{k}{m}"),
                 p(T(r"Here $k$ is the number of matching features and $m$ the total number of features. Same idea as Hamming, but a fraction, so it lies in $[0,1]$: $k = 2$ matches out of $m = 6$ gives $d = 1 - 2/6 = 2/3$.",
                     r"这里 $k$ 是匹配的特征数，$m$ 是特征总数。想法同 Hamming，但是个比例，落在 $[0,1]$：$6$ 个特征里 $2$ 个匹配，$d = 1 - 2/6 = 2/3$。")),
                 h(T('Jaccard distance', 'Jaccard 距离')),
                 math_(r"d = 1 - J = 1 - \frac{|A \cap B|}{|A \cup B|} = 1 - \frac{|A \cap B|}{|A| + |B| - |A \cap B|}"),
                 p(T(r"Treat each instance as the **set** of features that are on: $A = \{\text{red, round, sweet}\}$, $B = \{\text{yellow, curved, sweet}\}$. They share one element and together have five, so $J = 1/5$ and $d = 4/5$.",
                     r"把每个样本看成“开着的特征”的**集合**：$A = \{\text{red, round, sweet}\}$，$B = \{\text{yellow, curved, sweet}\}$。它们共有 1 个元素，合起来 5 个，所以 $J = 1/5$，$d = 4/5$。")),
                 callout('warning', T('Why Jaccard exists: shared zeros say nothing', '为什么要有 Jaccard：共同的 0 说明不了什么'),
                         T(r"Matching counts 0-0 as agreement, Jaccard ignores it. Two shoppers who both did not buy among 10,000 products have almost everything in common, which is useless. For sparse 0/1 data (baskets, word presence) use Jaccard; when 0 and 1 are equally informative (male/female) use matching or Hamming.",
                           r"匹配距离把 0-0 也算作一致，Jaccard 不算。两位顾客在一万种商品里都没买的那些，几乎占了全部，毫无信息。稀疏的 0/1 数据（购物篮、词是否出现）用 Jaccard；0 和 1 同样有信息量（男/女）时用匹配或 Hamming。")),
                 details(T('Beyond the deck: Dice', '课件之外：Dice'),
                         p(T(r"The Dice coefficient $2|A\cap B|/(|A|+|B|)$ also ignores shared zeros but weights the overlap twice; here $2\cdot 1/6 = 1/3$. It is a monotone function of Jaccard, so for ranking neighbours the two give the same order.",
                             r"Dice 系数 $2|A\cap B|/(|A|+|B|)$ 同样忽略共同的 0，但把重叠算两次；这里是 $2\cdot 1/6 = 1/3$。它是 Jaccard 的单调函数，用来给近邻排序，两者给出同样的顺序。"))),
                 quiz(T(r"Instances $a = (1,0,0,0,0,1)$ and $b = (1,0,0,0,0,0)$. Which statement is true?", r"样本 $a = (1,0,0,0,0,1)$ 与 $b = (1,0,0,0,0,0)$。下面哪句话对？"),
                      [(T(r"Simple matching distance is $1/6$; Jaccard distance is $1/2$.", r"简单匹配距离是 $1/6$；Jaccard 距离是 $1/2$。"), True),
                       (T(r"Both are $1/6$.", r"两者都是 $1/6$。"), T(r"Jaccard drops the four shared zeros: only the two 1-positions count, $A \cap B = 1$, $A \cup B = 2$, so $d = 1/2$.", r"Jaccard 不算那四个共同的 0：只看两个 1 的位置，$A \cap B = 1$，$A \cup B = 2$，所以 $d = 1/2$。")),
                       (T(r"Hamming distance is $1/6$.", r"Hamming 距离是 $1/6$。"), T(r"Hamming is a count, not a fraction: it is $1$. Dividing by $m$ gives the simple matching distance.", r"Hamming 是个计数，不是比例：它是 $1$。除以 $m$ 才是简单匹配距离。"))],
                      T(r"Matching: 5 of 6 agree, so $1 - 5/6 = 1/6$. Jaccard: $1 - 1/2$. Same pair, very different distances; the choice should follow what a 0 means.",
                        r"匹配：6 个里 5 个一致，$1 - 5/6 = 1/6$。Jaccard：$1 - 1/2$。同一对样本，距离差很多；该怎么选，取决于 0 代表什么。")),
                 chapter=T('Distances', '距离')),
            read('numeric', T('Distances for numbers: Manhattan, Euclidean, cosine', '数值特征的距离：曼哈顿、欧氏、余弦'),
                 p(T(r"For numeric vectors $a, b$ of $F$ features the deck gives three. The first two measure how far apart the points are; the third measures the angle between them.",
                     r"对 $F$ 个特征的数值向量 $a, b$，课件给了三种。前两种量点与点相隔多远；第三种量它们之间的夹角。")),
                 math_(r"d_{L1}(a,b) = \sum_{i=1}^{F} |a_i - b_i| \qquad d_{L2}(a,b) = \sqrt{\sum_{i=1}^{F} (a_i - b_i)^2}"),
                 svg(drawn(fig_l1_l2), T('Two points a = (1,5) and b = (5,3). Manhattan distance follows the grid, 4 + 2 = 6. Euclidean distance is the straight line, 4.47.', '两点 a = (1,5) 与 b = (5,3)。曼哈顿距离沿格子走，4 + 2 = 6；欧氏距离是直线，4.47。')),
                 ul(T(r"**Manhattan** (L1, city-block): walk along the axes and add up each feature's gap. One huge gap counts only linearly.", r"**曼哈顿**（L1，街区）：沿坐标轴走，把每个特征的差距加起来。一个很大的差距只按线性计入。"),
                    T(r"**Euclidean** (L2): the straight line. Squaring makes a large gap in one feature count much more than several small gaps.", r"**欧氏**（L2）：直线距离。平方让某个特征上的大差距比几个小差距重要得多。")),
                 p(T(r"The deck's pair: $a = (2.0, 1.4, 4.6, 5.5)$, $b = (1.0, 2.4, 6.6, 2.5)$. The gaps are $1, 1, 2, 3$, so $d_{L1} = 1+1+2+3 = %d$ and $d_{L2} = \sqrt{1+1+4+9} = \sqrt{15} = %s$." % (l1(KA, KB), fx(l2(KA, KB), 3)),
                     r"课件里的一对：$a = (2.0, 1.4, 4.6, 5.5)$，$b = (1.0, 2.4, 6.6, 2.5)$。各特征的差是 $1, 1, 2, 3$，所以 $d_{L1} = 1+1+2+3 = %d$，$d_{L2} = \sqrt{1+1+4+9} = \sqrt{15} = %s$。" % (l1(KA, KB), fx(l2(KA, KB), 3)))),
                 h(T('Cosine: the angle, not the length', '余弦：看夹角，不看长度')),
                 math_(r"\cos(a,b) = \frac{a\cdot b}{\lVert a\rVert\,\lVert b\rVert} = \frac{\sum_i a_i b_i}{\sqrt{\sum_i a_i^2}\sqrt{\sum_i b_i^2}} \qquad d(a,b) = 1 - \cos(a,b)"),
                 p(T(r"Divide each vector by its own length, then take the inner product. What is left is only the **direction**. Use it when the length is an accident: a long and a short document about the same topic have different word counts but point the same way; a high- and a low-resolution image of the same scene likewise.",
                     r"先把每个向量除以自己的长度，再做内积。剩下的只有**方向**。长度只是偶然时就用它：同一主题的长文档和短文档词数不同，但方向一致；同一场景的高分辨率和低分辨率图像也是这样。")),
                 quiz(T(r"Document $b$ is document $a$ with every word count multiplied by 10 (ten times as long). Which distances between $a$ and $b$ are zero?", r"文档 $b$ 是文档 $a$ 的每个词频乘以 10（长了十倍）。$a$ 与 $b$ 之间哪些距离为零？"),
                      [(T(r"Euclidean and Manhattan", r"欧氏和曼哈顿"), T(r"They grow with the length: the gap in every coordinate is now 9 times the old count. Only the direction is shared.", r"它们随长度增长：每个坐标上的差现在是原词频的 9 倍。共享的只有方向。")),
                       (T(r"Cosine only", r"只有余弦"), True),
                       (T(r"All three", r"三个都是"), T(r"L1 and L2 see two points far apart on the same ray; only cosine ignores how far along the ray they are.", r"L1 和 L2 看到的是同一条射线上相隔很远的两点；只有余弦不管它们在射线上走了多远。"))],
                      T(r"$\cos(a, 10a) = 1$, so $d = 0$. The two points are far apart in space yet identical in direction.", r"$\cos(a, 10a) = 1$，所以 $d = 0$。两点在空间里相隔很远，方向却完全一样。")),
                 details(T('Beyond the deck: all of these are one family', '课件之外：它们是同一族'),
                         p(T(r"Minkowski distance $\left(\sum_i |a_i - b_i|^p\right)^{1/p}$ gives L1 at $p = 1$ and L2 at $p = 2$; as $p \to \infty$ it becomes the largest single gap (Chebyshev). Larger $p$ lets one big gap dominate more.",
                             r"闵可夫斯基距离 $\left(\sum_i |a_i - b_i|^p\right)^{1/p}$，$p = 1$ 是 L1，$p = 2$ 是 L2；$p \to \infty$ 时就是最大的那一个差（切比雪夫）。$p$ 越大，单个大差距越占主导。"))),
                 ),
            derive('cosine-derive', T('Deeper: cosine distance, and why it is a Euclidean distance in disguise', '深入：余弦距离，以及它为什么是“伪装的欧氏距离”'),
                   [(r"\hat a = \dfrac{a}{\lVert a\rVert}, \quad \hat b = \dfrac{b}{\lVert b\rVert}", T(r"Scale each vector to length 1. This throws away the length and keeps the direction.", r"把每个向量缩放到长度 1。长度被丢掉，方向被留下。")),
                    (r"\lVert \hat a - \hat b\rVert^2 = \lVert\hat a\rVert^2 + \lVert\hat b\rVert^2 - 2\,\hat a\cdot\hat b", T(r"Expand the squared Euclidean distance of the two unit vectors: $(u - v)\cdot(u - v)$.", r"展开两个单位向量的欧氏距离平方：$(u - v)\cdot(u - v)$。")),
                    (r"= 1 + 1 - 2\cos(a,b)", T(r"Both lengths are 1, and $\hat a\cdot\hat b$ is exactly $\cos(a,b)$.", r"两个长度都是 1，而 $\hat a\cdot\hat b$ 恰好就是 $\cos(a,b)$。")),
                    (r"= 2\,\bigl(1 - \cos(a,b)\bigr) = 2\,d_{\cos}(a,b)", T(r"The bracket is the cosine distance. So on unit-length vectors, cosine distance is half the squared Euclidean distance.", r"括号里就是余弦距离。所以在单位向量上，余弦距离就是欧氏距离平方的一半。"),
                     T(r"Consequence: if you normalise every vector to length 1 first, nearest neighbours under L2 and under cosine are the same. Cosine k-NN is Euclidean k-NN on normalised data.", r"推论：先把所有向量归一化到长度 1，L2 下的近邻和余弦下的近邻就是同一批。余弦 k-NN 就是归一化数据上的欧氏 k-NN。")),
                    (r"\cos(d_1, d_2) = \dfrac{200\cdot 300 + 300\cdot 200 + 200\cdot 100}{\sqrt{200^2 + 300^2 + 200^2}\,\sqrt{300^2 + 200^2 + 100^2}} = %s" % fx(cos12),
                     T(r"The deck's documents (word counts of three words): doc1 = (200, 300, 200), doc2 = (300, 200, 100). Numerator %d, lengths $%s$ and $%s$." % (dot(DOC1, DOC2), fx(sqrt(dot(DOC1, DOC1)), 1), fx(sqrt(dot(DOC2, DOC2)), 1)),
                       r"课件里的文档（三个词的词频）：doc1 = (200, 300, 200)，doc2 = (300, 200, 100)。分子 %d，长度 $%s$ 和 $%s$。" % (dot(DOC1, DOC2), fx(sqrt(dot(DOC1, DOC1)), 1), fx(sqrt(dot(DOC2, DOC2)), 1)))),
                    (r"d(d_1, d_2) = 1 - %s = %s" % (fx(cos12), fx(1 - cos12)), T(r"Small: the two documents mostly use the three words in similar proportions.", r"很小：两篇文档里三个词的比例大致相近。")),
                    (r"\cos(d_2, d_3) = \dfrac{300\cdot 50 + 200\cdot 40 + 100\cdot 25}{\sqrt{300^2 + 200^2 + 100^2}\,\sqrt{50^2 + 40^2 + 25^2}} = %s, \quad d = %s" % (fx(cosine(DOC2, DOC3)), fx(1 - cosine(DOC2, DOC3))),
                     T(r"doc3 is much shorter (50, 40, 25) yet points almost exactly the way doc2 does. Under L2 it would be far from doc2; under cosine it is the closest pair.", r"doc3 短得多（50, 40, 25），方向却和 doc2 几乎一样。用 L2 它离 doc2 很远；用余弦它们是最近的一对。"))],
                   intro=T(r"Cosine looks different from L1 and L2, but it is nearly one of them. Show how, then do the deck's document example.", r"余弦看起来和 L1、L2 不同，其实几乎就是其中一个。先推出这点，再算课件里的文档例子。"),
                   skill=S('distance')),
            read('ordinal', T('Ordinal features: normalised ranks', '有序特征：归一化名次'),
                 p(T(r"A rating from $-2$ to $2$ has an order but no meaningful gaps: is the step from 0 to 1 the same size as from $-2$ to $-1$? Do not use the raw numbers as if they were measurements. The deck's recipe:",
                     r"从 $-2$ 到 $2$ 的评分有顺序，但“差多少”没有意义：从 0 到 1 和从 $-2$ 到 $-1$ 一样大吗？不要把原始数字当作测量值来用。课件的做法：")),
                 ol(T(r"Sort the possible values and give each a rank $r \in \{0, \dots, m\}$ ($m$ is the largest rank).", r"把可能的取值排序，给每个取值一个名次 $r \in \{0, \dots, m\}$（$m$ 是最大名次）。"),
                    T(r"Map the rank to an evenly spaced value $z = r/m \in [0,1]$.", r"把名次映射成均匀间隔的数 $z = r/m \in [0,1]$。"),
                    T(r"Apply a numeric distance (for example Euclidean) to the $z$ values.", r"对 $z$ 用数值距离（比如欧氏）。")),
                 p(T(r"Ratings $-2, -1, 0, 1, 2$ have ranks $0, 1, 2, 3, 4$, so $m = 4$. Two cars rated on safety, comfort, convenience: A = $(0, -2, -1)$ and B = $(2, 1, 2)$. Ranks: A = $(2, 0, 1)$, B = $(4, 3, 4)$. Normalised: A = $(%s, %s, %s)$, B = $(%s, %s, %s)$."
                     % tuple(fx(v) for v in RA + RB),
                     r"评分 $-2, -1, 0, 1, 2$ 的名次是 $0, 1, 2, 3, 4$，所以 $m = 4$。两辆车按安全、舒适、便利打分：A = $(0, -2, -1)$，B = $(2, 1, 2)$。名次：A = $(2, 0, 1)$，B = $(4, 3, 4)$。归一化：A = $(%s, %s, %s)$，B = $(%s, %s, %s)$。"
                     % tuple(fx(v) for v in RA + RB))),
                 p(T(r"Then $d_{L1} = %s + %s + %s = %s$ and $d_{L2} = \sqrt{%s + %s + %s} = %s$." % (fx(abs(RA[0] - RB[0])), fx(abs(RA[1] - RB[1])), fx(abs(RA[2] - RB[2])), fx(rA), fx((RA[0] - RB[0]) ** 2, 4), fx((RA[1] - RB[1]) ** 2, 4), fx((RA[2] - RB[2]) ** 2, 4), fx(rB)),
                     r"于是 $d_{L1} = %s + %s + %s = %s$，$d_{L2} = \sqrt{%s + %s + %s} = %s$。" % (fx(abs(RA[0] - RB[0])), fx(abs(RA[1] - RB[1])), fx(abs(RA[2] - RB[2])), fx(rA), fx((RA[0] - RB[0]) ** 2, 4), fx((RA[1] - RB[1]) ** 2, 4), fx((RA[2] - RB[2]) ** 2, 4), fx(rB)))),
                 p(T(r"One side effect is useful: every ordinal feature now lives on the same $[0,1]$ scale, which is the next worry (scaling) solved in advance.",
                     r"顺带有个好处：每个有序特征现在都在同一个 $[0,1]$ 尺度上，后面要讲的缩放问题也就提前解决了。"))),
            read('voting', T('When neighbours disagree: three voting rules', '近邻意见不一：三种投票规则'),
                 p(T(r"Once the $k$ neighbours are found, each casts a vote for its own class, with a weight $w_j$. The class with the largest **total weight** wins. (For regression, the prediction is the weighted average $\sum_j w_j y_j / \sum_j w_j$.)",
                     r"找到 $k$ 个近邻后，每个近邻为自己的类别投票，票重为 $w_j$。**总票重**最大的类别获胜。（回归则取加权平均 $\sum_j w_j y_j / \sum_j w_j$。）")),
                 table([T('Rule', '规则'), T('Weight of neighbour j', '第 j 个近邻的票重'), T('Idea', '想法')],
                       [T('Majority', '多数票'), '$w_j = 1$', T('every neighbour counts the same', '每个近邻一样重')],
                       [T('Inverse distance', '反距离'), r'$w_j = \dfrac{1}{d_j + \epsilon}$', T('closer counts more, without limit', '越近越重，没有上限')],
                       [T('Inverse linear distance', '反线性距离'), r'$w_j = \dfrac{d_k - d_j}{d_k - d_1}$', T('nearest gets 1, farthest of the k gets 0', '最近的得 1，k 个里最远的得 0')]),
                 ul(T(r"$\epsilon$ is a tiny constant (the deck uses $10^{-10}$ or $10^{-5}$) that keeps $1/d$ finite when a neighbour sits exactly on the query ($d = 0$).", r"$\epsilon$ 是个很小的常数（课件用 $10^{-10}$ 或 $10^{-5}$），当某个近邻恰好落在查询点上（$d = 0$）时防止 $1/d$ 变成无穷。"),
                    T(r"In inverse linear distance, $d_1$ is the smallest and $d_k$ the largest distance among the $k$ neighbours. The weights are a straight line from 1 down to 0, so the farthest neighbour never counts and the rule needs $d_k \neq d_1$.", r"反线性距离里，$d_1$ 是 $k$ 个近邻中最小的距离，$d_k$ 是最大的。权重是从 1 线性降到 0 的一条直线，所以最远的那个近邻不起作用，并且要求 $d_k \neq d_1$。"),
                    T(r"Inverse distance is a very strong rule: a neighbour at distance $\approx 0$ gets weight $10^5$ and outvotes everyone. Inverse linear is gentler.", r"反距离是很强的规则：距离 $\approx 0$ 的近邻拿到 $10^5$ 的权重，一个人就压过所有人。反线性要温和得多。")),
                 p(T(r"The deck's example has $K = 4$ neighbours: one red at distance 0 and three blue at distances 1, 1.5, 1.5. Three rules, three recipes, and not the same answer. Next page: the arithmetic.",
                     r"课件里的例子有 $K = 4$ 个近邻：一个红色在距离 0，三个蓝色分别在距离 1、1.5、1.5。三种规则，三种算法，答案并不一样。下一页算一遍。")),
                 chapter=T('Voting and k', '投票与 k')),
            derive('voting-calc', T('The deck\'s voting example, line by line', '课件的投票例子，一行一行算'),
                   [(r"W_R = 1, \quad W_B = 1 + 1 + 1 = 3", T(r"Majority vote: all weights 1, count heads. $W_R$ and $W_B$ are the total weights of red and blue. Blue has three neighbours, red one, so blue wins.", r"权重全是 1，数人头。$W_R$、$W_B$ 是红、蓝的总票重。蓝色三个近邻，红色一个，蓝色获胜。")),
                    (r"w_1 = \dfrac{1}{0 + 10^{-5}} = %s" % f'{inv_red:,.0f}'.replace(',', r'\,'), T(r"Inverse distance, $\epsilon = 10^{-5}$. The red neighbour sits at distance 0, so its weight is huge.", r"反距离，$\epsilon = 10^{-5}$。红色近邻在距离 0，权重极大。")),
                    (r"w_2 = \dfrac{1}{1 + \epsilon} \approx 1.0, \quad w_3 = w_4 = \dfrac{1}{1.5 + \epsilon} \approx 0.67", T(r"The three blue weights, one for each neighbour.", r"三个蓝色近邻各自的权重。")),
                    (r"W_B \approx 1.0 + 0.67 + 0.67 = %s" % fx(inv_blue), T(r"Add up the blue votes (the deck prints 2.34 after rounding each term up). Red $\approx 100000$ beats blue $\approx 2.3$: **red wins**.", r"把蓝色的票相加（课件把每项进位后写成 2.34）。红 $\approx 100000$ 压倒蓝 $\approx 2.3$：**红色获胜**。")),
                    (r"w_j = \dfrac{d_k - d_j}{d_k - d_1} = \dfrac{1.5 - d_j}{1.5 - 0}", T(r"Inverse linear distance: here $d_1 = 0$ (red) and $d_k = 1.5$ (the farthest), so each weight is $(1.5 - d_j)/1.5$.", r"反线性距离：这里 $d_1 = 0$（红色），$d_k = 1.5$（最远的），所以每个权重是 $(1.5 - d_j)/1.5$。")),
                    (r"W_R = \dfrac{1.5 - 0}{1.5} = 1", T(r"The nearest neighbour always gets exactly 1.", r"最近的近邻永远恰好得 1。")),
                    (r"W_B = \dfrac{1.5-1}{1.5} + \dfrac{1.5-1.5}{1.5} + \dfrac{1.5-1.5}{1.5} = \dfrac{1}{3}", T(r"The two blue neighbours at the maximum distance get weight 0. Only the one at distance 1 counts. (The deck rounds this to 0.3.)", r"处在最大距离的两个蓝色近邻得权重 0，只有距离 1 的那个起作用。（课件把它舍入成 0.3。）")),
                    (r"W_R = 1 > \tfrac{1}{3} = W_B", T(r"Compare totals: red 1, blue 0.33, so red wins. Two of the three rules pick red, and majority picks blue. The same neighbours can give different predictions depending on the rule.", r"比较总票重：红 1，蓝 0.33，红色获胜。三种规则里两种选红，多数票选蓝。同样的近邻，规则不同，预测可以不同。"))],
                   intro=T(r"Neighbours (class, distance): (red, 0), (blue, 1), (blue, 1.5), (blue, 1.5). Compute the winner under each rule.", r"近邻（类别，距离）：(red, 0)、(blue, 1)、(blue, 1.5)、(blue, 1.5)。求每种规则下的赢家。"),
                   blank=(6, '1/3', T(r"Blue's total weight under inverse linear distance: the weights are $(1.5 - d_j)/1.5$ for $d_j = 1, 1.5, 1.5$.", r"反线性距离下蓝色的总票重：权重是 $(1.5 - d_j)/1.5$，$d_j = 1, 1.5, 1.5$。")),
                   skill=S('voting')),
            read('ties', T('Ties: tied distances and tied votes', '平局：距离相同与票数相同'),
                 p(T(r"The deck shows two kinds of tie on a plot of points. Both are real, and an answer must say how you resolve them; the slides give no single rule, so these are the standard options.",
                     r"课件在散点图上给出两种平局。两种都真实存在，答题时要说明怎么处理；课件没有给唯一的规则，下面是通行的做法。")),
                 table([T('Tie', '平局'), T('Example', '例子'), T('Standard ways out', '通行的解决办法')],
                       [T('Tied distances', '距离相同'), T('1-NN, but two points are exactly as close', '1-NN，但有两个点一样近'),
                        T('take both (the neighbourhood grows beyond k); or pick at random; or keep the one stored first', '两个都取（近邻数超过 k）；或随机选；或取先存的那个')],
                       [T('Tied votes', '票数相同'), T('2-NN, one neighbour of each class', '2-NN，每类各一个近邻'),
                        T('use an odd k (two classes); or drop to k−1 / grow to k+1 until broken; or use distance weights; or pick the class more common in training (the prior); or random', '用奇数 k（两类时）；或降到 k−1 / 升到 k+1 直到打破；或用距离加权；或取训练集里更常见的类（先验）；或随机')]),
                 p(T(r"Distance-weighted voting breaks most vote ties for free, because two neighbours are almost never at exactly the same distance. That is one practical reason to prefer it.",
                     r"按距离加权的投票几乎白送地打破了票数相同的平局，因为两个近邻几乎不会恰好一样远。这是选用它的一个实际理由。")),
                 quiz(T(r"A 3-class problem with $k = 3$ and neighbours of classes A, B, C (one each). Choosing an odd $k$ avoided the tie. Why not?", r"3 类问题，$k = 3$，近邻的类别是 A、B、C 各一个。选了奇数 $k$ 却没避免平局。为什么？"),
                      [(T(r"$k$ must be a multiple of the number of classes.", r"$k$ 必须是类别数的倍数。"), T(r"Not so: a multiple of 3 still allows 2-2-2 splits. No $k$ rules out ties for 3+ classes.", r"不对：3 的倍数仍可能 2-2-2 平分。类别数 ≥ 3 时没有哪个 $k$ 能排除平局。")),
                       (T(r"Odd $k$ never helps.", r"奇数 $k$ 从不起作用。"), T(r"It does help for two classes: $k$ neighbours split $a + b = k$, and with $k$ odd, $a \neq b$.", r"两类时有用：$k$ 个近邻分成 $a + b = k$，$k$ 为奇数则 $a \neq b$。")),
                       (T(r"An odd $k$ only prevents ties when there are two classes.", r"奇数 $k$ 只在两类时才能避免平局。"), True)],
                      T(r"With two classes an odd $k$ guarantees a winner; with three or more you still need a tie rule (weights, prior, random).", r"两类时奇数 $k$ 保证有赢家；三类或更多仍需要平局规则（加权、先验、随机）。"))),
            read('choosing-k', T('Choosing k', '选 k'),
                 p(T(r"$k$ decides how local the answer is. $k = 1$: the single nearest point. $k = N$: every training point, whatever the query. The figure runs both extremes and a middle value on the same data.",
                     r"$k$ 决定答案有多“局部”。$k = 1$：只看最近的一个点。$k = N$：不管查询点在哪，都看全部训练点。下图在同一份数据上跑这两个极端和一个中间值。")),
                 svg(drawn(fig_knn_regions), T('Decision regions of k-NN on 31 points of two classes, for k = 1, k = 7, k = N. k = 1 is jagged with islands around single points; k = 7 is smooth; k = N colours the whole plane with the majority class.',
                                               '两类共 31 个点上 k 近邻的决策区域，k = 1、k = 7、k = N。k = 1 锯齿状，围着单个点形成孤岛；k = 7 平滑；k = N 整个平面都是多数类的颜色。')),
                 ul(T(r"**Small $k$**: a jagged boundary that follows every point, including the noisy and mislabelled ones. We capture noise, so test performance drops.", r"**小 $k$**：边界锯齿状，紧跟每一个点，包括噪声点和标错的点。我们把噪声也学进去了，测试表现下降。"),
                    T(r"**Large $k$**: a smooth boundary, but it risks grouping together unrelated classes; test performance drops again.", r"**大 $k$**：边界平滑，但可能把无关的类别混在一起；测试表现又会下降。"),
                    T(r"**$k = N$**: every query gets the same answer, the most common class in the training set. That is the **Zero-R** baseline of the trees lesson, ignoring all features.", r"**$k = N$**：每个查询得到同一个答案，即训练集中最常见的类别。这就是决策树那一课的 **Zero-R** 基线，完全不看特征。")),
                 p(T(r"So test error against $k$ is U-shaped. **Choose $k$ on held-out data** (a validation set or cross-validation), never on the training set: with $k = 1$ every training point is its own nearest neighbour, so training error is $0$ and $k = 1$ always “wins” there. Try odd values for two classes, and keep $k$ well below $N$.",
                     r"所以测试误差随 $k$ 变化呈 U 形。**用留出数据选 $k$**（验证集或交叉验证），不要用训练集：$k = 1$ 时每个训练点的最近邻就是它自己，训练误差为 $0$，$k = 1$ 在训练集上永远“最好”。两类时试奇数值，并让 $k$ 远小于 $N$。")),
                 quiz(T(r"You pick $k$ by lowest training error. Which $k$ do you get, and why is that a mistake?", r"你按训练误差最低来选 $k$。会选到哪个 $k$，为什么是错的？"),
                      [(T(r"$k = N$: it uses all the data.", r"$k = N$：它用了全部数据。"), T(r"$k = N$ ignores the query completely, so it does worst on training data, not best.", r"$k = N$ 完全不看查询点，训练数据上反而最差。")),
                       (T(r"A middle $k$ near $\sqrt{N}$, which is always optimal.", r"$\sqrt{N}$ 附近的中间值，它总是最优。"), T(r"There is no universally optimal $k$; it depends on the data and has to be validated.", r"并不存在放之四海皆准的最优 $k$；它取决于数据，必须用验证来定。")),
                       (T(r"$k = 1$: each training point finds itself, so training error is 0. It says nothing about new data.", r"$k = 1$：每个训练点找到的就是自己，训练误差为 0。这对新数据什么也没说明。"), True)],
                      T(r"Training error only tells you how well the data was memorised. Use a validation set to choose $k$.", r"训练误差只说明数据被记住了多少。要用验证集来选 $k$。"))),
            derive('bias-variance', T('Deeper: why k is a bias-variance knob', '深入：为什么 k 是偏差-方差旋钮'),
                   [(r"y = f(x) + \varepsilon, \quad \mathbb{E}[\varepsilon] = 0, \ \mathrm{Var}(\varepsilon) = \sigma^2", T(r"The model of the data: the truth $f$ plus independent noise of variance $\sigma^2$. We predict at a fixed query $x_0$.", r"数据的模型：真实函数 $f$ 加上方差为 $\sigma^2$ 的独立噪声。我们在固定的查询点 $x_0$ 上预测。")),
                    (r"\hat y = \dfrac{1}{k}\sum_{i \in N_k(x_0)} y_i = \dfrac{1}{k}\sum_{i} \bigl(f(x_i) + \varepsilon_i\bigr)", T(r"k-NN regression averages the $k$ neighbours' labels. Each label carries its own noise $\varepsilon_i$.", r"k-NN 回归对 $k$ 个近邻的标签取平均。每个标签带着自己的噪声 $\varepsilon_i$。")),
                    (r"b = \dfrac{1}{k}\sum_i f(x_i) - f(x_0)", T(r"The bias $b$: the noise averages to zero, so the prediction is off on average only because the neighbours' true values differ from $f(x_0)$. For $k=1$ this gap is small (the neighbour is very close); as $k$ grows the neighbours lie farther out and the gap grows. For $k = N$ it is $\bar f - f(x_0)$.", r"偏差 $b$：噪声平均为零，所以预测平均而言出偏差，只是因为近邻的真值与 $f(x_0)$ 不同。$k = 1$ 时这个差很小（近邻很近）；$k$ 增大，近邻越来越远，差变大。$k = N$ 时是 $\bar f - f(x_0)$。")),
                    (r"\mathrm{Var}(\hat y) = \dfrac{1}{k^2}\sum_{i=1}^{k} \mathrm{Var}(\varepsilon_i) = \dfrac{\sigma^2}{k}", T(r"Independent noises: the variance of a sum is the sum of variances, and the factor $1/k$ is squared. Averaging $k$ noisy numbers divides the variance by $k$.", r"噪声相互独立：和的方差是方差的和，系数 $1/k$ 要平方。把 $k$ 个带噪的数取平均，方差就除以 $k$。")),
                    (r"\mathbb{E}\bigl[(y_0 - \hat y)^2\bigr] = \sigma^2 + b^2 + \dfrac{\sigma^2}{k}", T(r"The expected squared error at $x_0$ splits into noise we can never remove, squared bias, and variance.", r"在 $x_0$ 处的期望平方误差分成三块：永远去不掉的噪声、偏差的平方、方差。")),
                    (r"\mathrm{Var}\,\bigl|_{k=1} = \sigma^2, \qquad \mathrm{Var}\,\bigl|_{k=N} = \dfrac{\sigma^2}{N}", T(r"At $k = 1$ the variance is the largest ($\sigma^2$), at $k = N$ the smallest but with the largest bias. The knob: raising $k$ cuts the variance like $1/k$ and raises the bias. The best $k$ balances the two. This is the same picture as the figure: $k=1$ is jagged because it has high variance; $k=N$ is flat because it has high bias.", r"$k = 1$ 方差最大（$\sigma^2$），$k = N$ 方差最小但偏差最大。旋钮：升高 $k$，方差按 $1/k$ 下降，偏差上升。最优的 $k$ 在二者之间取平衡。这就是上图的另一种说法：$k=1$ 锯齿是因为方差大；$k=N$ 一片平是因为偏差大。"))],
                   intro=T(r"The U-shaped test error is not a coincidence. Show it for k-NN regression with a few lines, assuming the training inputs are fixed.", r"U 形的测试误差并非巧合。用几行推导在 k-NN 回归上把它写出来，假设训练输入固定。"),
                   skill=S('k')),
            read('scaling', T('Scaling: the biggest feature wins', '缩放：数值最大的特征说了算'),
                 chapter=T('Scaling and many dimensions', '缩放与高维'),
                 *[p(T(r"Distance adds the features' gaps up, so a feature measured in big numbers shouts over one measured in small numbers, whatever each is worth. The units are arbitrary (income in dollars or in thousands of dollars?), so the answer must not depend on them.",
                       r"距离把各特征的差距加起来，所以用大数字量的特征会盖过用小数字量的特征，不管它们各自有多重要。单位是任意的（收入用美元还是千美元？），答案不该依赖单位。")),
                   p(T(r"A numeric example. The query is a customer aged %d with income \$%s. Customer A is aged %d with income \$%s; customer B is aged %d with income \$%s."
                       % (SQ[0], f'{SQ[1]:,}', SA[0], f'{SA[1]:,}', SB[0], f'{SB[1]:,}'),
                       r"一个数值例子。查询客户 %d 岁，收入 %s 美元。客户 A %d 岁，收入 %s 美元；客户 B %d 岁，收入 %s 美元。" % (SQ[0], f'{SQ[1]:,}', SA[0], f'{SA[1]:,}', SB[0], f'{SB[1]:,}'))),
                   table([T('Distance to', '到…的距离'), T('raw Euclidean', '原始欧氏距离'), T('after min-max scaling', '最小-最大缩放后')],
                         [T('A (1 year apart)', 'A（年龄差 1 岁）'), fx(raw_dA, 1), fx(sc_dA, 3)],
                         [T('B (30 years apart)', 'B（年龄差 30 岁）'), fx(raw_dB, 1), fx(sc_dB, 3)],
                         [T('nearest', '最近的'), 'B', 'A']),
                   p(T(r"Raw: income gaps are in the thousands, age gaps in the tens, so age is invisible and the 30-year-older B is “closest”. Min-max scaling with ranges age $[%d, %d]$, income $[%s, %s]$ maps both to $[0,1]$, and now A, nearly the same age, is nearest. The flip changes the prediction."
                       % (AGE_RANGE + (f'{INC_RANGE[0]:,}', f'{INC_RANGE[1]:,}')),
                       r"原始数据里，收入差是几千，年龄差是几十，年龄几乎看不见，于是大了 30 岁的 B 成了“最近”。用年龄范围 $[%d, %d]$、收入范围 $[%s, %s]$ 做最小-最大缩放，两者都落在 $[0,1]$，年龄几乎相同的 A 才是最近的。这一翻转改变了预测。"
                       % (AGE_RANGE + (f'{INC_RANGE[0]:,}', f'{INC_RANGE[1]:,}')))),
                   math_(r"x' = \frac{x - x_{\min}}{x_{\max} - x_{\min}} \qquad x' = \frac{x - \mu}{s}"),
                   ul(T(r"**Min-max** (the first formula) puts every feature in $[0,1]$ but one outlier squeezes all the others together.", r"**最小-最大**（第一个公式）把每个特征放进 $[0,1]$，但一个离群点会把其余的点全挤在一起。"),
                      T(r"**z-score** (the second; mean 0, standard deviation 1) is steadier under outliers.", r"**z 分数**（第二个；均值 0、标准差 1）对离群点更稳。"),
                      T(r"Compute $x_{\min}, x_{\max}$ (or $\mu, s$) **on the training data only** and apply the same numbers to the test instance; otherwise information leaks from the test set.", r"$x_{\min}, x_{\max}$（或 $\mu, s$）**只用训练数据**来算，再把同样的数用到测试样本上；否则测试集的信息会泄漏。"),
                      T(r"Scaling is also a way to say what matters: multiplying a feature by 2 after scaling doubles its say in the distance.", r"缩放也是表达“什么重要”的方式：缩放后把某个特征乘以 2，它在距离里的话语权就翻倍。")),
                   quiz(T(r"Features: height in metres (1.5-2.0) and weight in grams (50,000-100,000). With raw Euclidean distance, which feature decides the neighbours?", r"特征：身高（米，1.5-2.0）和体重（克，50,000-100,000）。用原始欧氏距离，哪个特征决定近邻？"),
                        [(T(r"Height: it is the more informative one.", r"身高：它信息量更大。"), T(r"Distance does not know which feature is informative; it only sees the size of the numbers.", r"距离并不知道哪个特征有信息，它只看数字的大小。")),
                         (T(r"Weight: its gaps are about $10^4$ times bigger.", r"体重：它的差距大约是 $10^4$ 倍。"), True),
                         (T(r"Neither: Euclidean distance is scale-invariant.", r"都不是：欧氏距离与尺度无关。"), T(r"It is the opposite: rescaling a feature changes the distances, so changes the neighbours.", r"恰恰相反：改变特征的尺度会改变距离，从而改变近邻。"))],
                        T(r"Scale first. Then both features contribute comparably.", r"先缩放。之后两个特征的贡献才相当。"))]),
            read('curse', T('Deeper: the curse of dimensionality', '深入：维度灾难'),
                 p(T(r"k-NN trusts that near points are alike. In many dimensions, *nothing is near*. Two things happen at once:",
                     r"k-NN 相信“靠得近的点相似”。维度很多时，*没有什么是近的*。同时发生两件事：")),
                 h(T('1. You need to reach far to catch a few points', '1. 要伸得很远才能抓到几个点')),
                 p(T(r"Points uniform in the unit cube $[0,1]^d$. A small cube that catches 10% of the data has edge length $0.1^{1/d}$:",
                     r"点在单位立方体 $[0,1]^d$ 中均匀分布。能装下 10% 数据的小立方体，边长是 $0.1^{1/d}$：")),
                 table(['d', '1', '2', '10', '100'], [T('edge length', '边长'), fx(.1 ** (1 / 1), 3), fx(.1 ** (1 / 2), 3), fx(.1 ** (1 / 10), 3), fx(.1 ** (1 / 100), 3)]),
                 p(T(r"At $d = 100$ the “neighbourhood” spans 98% of the range of every coordinate: it is not a neighbourhood any more.",
                     r"$d = 100$ 时，这个“邻域”在每个坐标上都占去 98% 的范围：它已经不是邻域了。")),
                 h(T('2. All distances become the same', '2. 所有距离都变得一样')),
                 p(T(r"Draw 100 uniform points and a query. The table is the average of (nearest distance) / (farthest distance) over 200 trials (seeded simulation). If it is near 0, “nearest” means something. If near 1, it does not.",
                     r"取 100 个均匀分布的点和一个查询点。表中是 200 次试验里（最近距离）/（最远距离）的平均（固定随机种子的模拟）。接近 0，“最近”才有意义；接近 1，就没有了。")),
                 table(['d', '2', '10', '100', '1000'], [T('nearest / farthest', '最近 / 最远'), fx(CURSE[2], 2), fx(CURSE[10], 2), fx(CURSE[100], 2), fx(CURSE[1000], 2)]),
                 svg(drawn(fig_curse), T('The average ratio of nearest to farthest distance among 100 random points rises towards 1 as the dimension d grows from 1 to 1000.', '100 个随机点中，最近距离与最远距离之比的平均值，随维度 d 从 1 增到 1000 而趋近于 1。')),
                 p(T(r"The next page proves why the ratio tends to 1. Practical consequences:", r"下一页证明为什么这个比值趋于 1。实际的后果：")),
                 ul(T(r"Irrelevant features are poison: each adds noise to the distance and pushes everything toward the same value.", r"无关特征是毒药：每多一个，距离里就多一份噪声，把一切推向同一个值。"),
                    T(r"Fixes: select or reduce features (feature selection, PCA), use more data (the amount needed grows exponentially with $d$), or use a measure suited to sparse data (cosine).", r"对策：特征选择或降维（PCA）、增加数据（所需数据量随 $d$ 指数增长），或用适合稀疏数据的度量（余弦）。"),
                    T(r"Real data often lies near a low-dimensional surface, which is why k-NN still works on images with thousands of pixels.", r"真实数据往往靠近一个低维曲面，这就是 k-NN 在有上千像素的图像上仍然有效的原因。"))),
            derive('curse-derive', T('Deeper: why distances concentrate', '深入：距离为什么会集中'),
                   [(r"D^2 = \sum_{j=1}^{d} Z_j, \quad Z_j = (x_j - y_j)^2", T(r"Two independent uniform points $x, y \in [0,1]^d$. The squared distance is a sum of $d$ terms, one per coordinate. The terms are independent and identically distributed.", r"两个独立的均匀点 $x, y \in [0,1]^d$。距离平方是 $d$ 项之和，每个坐标一项。这些项独立同分布。")),
                    (r"\mathbb{E}[Z_j] = \mathrm{Var}(x_j) + \mathrm{Var}(y_j) = \tfrac{1}{12} + \tfrac{1}{12} = \tfrac{1}{6}", T(r"For independent $x, y$ with the same mean, $\mathbb{E}[(x-y)^2] = \mathrm{Var}(x) + \mathrm{Var}(y)$. A uniform variable on $[0,1]$ has variance $1/12$.", r"独立且均值相同的 $x, y$，$\mathbb{E}[(x-y)^2] = \mathrm{Var}(x) + \mathrm{Var}(y)$。$[0,1]$ 上的均匀变量方差是 $1/12$。")),
                    (r"\mathrm{Var}(Z_j) = \mathbb{E}[(x-y)^4] - \tfrac{1}{36} = \tfrac{1}{15} - \tfrac{1}{36} = \tfrac{7}{180}", T(r"The fourth moment of $x - y$ (a triangular density on $[-1,1]$) is $1/15$. Subtract the square of the mean.", r"$x - y$（$[-1,1]$ 上的三角形密度）的四阶矩是 $1/15$。减去均值的平方。")),
                    (r"\mathbb{E}[D^2] = \dfrac{d}{6}, \qquad \mathrm{Var}(D^2) = \dfrac{7d}{180}", T(r"A sum of $d$ independent terms: means add, variances add.", r"$d$ 个独立项之和：均值相加，方差相加。")),
                    (r"\dfrac{\mathrm{sd}(D^2)}{\mathbb{E}[D^2]} = \dfrac{\sqrt{7d/180}}{d/6} = \dfrac{6\sqrt{7/180}}{\sqrt d} \approx \dfrac{1.18}{\sqrt d}", T(r"The relative spread. The mean grows like $d$ but the standard deviation only like $\sqrt d$, so the spread shrinks like $1/\sqrt d$. At $d = 100$: 12%; at $d = 1000$: 3.7%.", r"相对离散程度。均值按 $d$ 增长，标准差只按 $\sqrt d$ 增长，所以离散程度按 $1/\sqrt d$ 缩小。$d = 100$：12%；$d = 1000$：3.7%。")),
                    (r"D \approx \sqrt{d/6}, \quad \dfrac{d_{\min}}{d_{\max}} \to 1 \ (d \to \infty)", T(r"Every distance is almost the same, so the nearest point is hardly nearer than the farthest. “Nearest” carries almost no information, and the vote of the $k$ nearest is close to a vote of random points.", r"每一对点的距离几乎一样，最近的点并不比最远的近多少。“最近”几乎没有信息，$k$ 个最近邻的投票和随机点的投票差不多。"))],
                   intro=T(r"Why does the nearest / farthest ratio in the table tend to 1? It is the law of large numbers applied to a sum over coordinates.", r"表里的“最近 / 最远”为什么趋于 1？这是大数定律用在各坐标的和上。"),
                   skill=S('curse')),
            read('lazy', T('Lazy against eager, and the verdict', '惰性与积极，以及最后的评价'),
                 table([T('Aspect', '方面'), T('Lazy (instance-based)', '惰性（基于实例）'), T('Eager', '积极')],
                       [T('At training time', '训练时'), T('store the data; no learning', '存数据，不学习'), T('fit a model to the labelled data', '用带标签的数据拟合模型')],
                       [T('What is fixed', '固定的是什么'), T('a distance function and a prediction rule', '距离函数和预测规则'), T('a learned model (parameters, tree, ...)', '学出来的模型（参数、树……）')],
                       [T('At prediction time', '预测时'), T('compare the test instance with every stored instance', '把测试样本与每个存下的样本比较'), T('apply the model: usually fast', '套用模型：通常很快')],
                       [T('Example', '例子'), 'k-NN', T('decision trees, naive Bayes, regression, SVM, neural nets', '决策树、朴素贝叶斯、回归、SVM、神经网络')]),
                 ul(T(r"**No assumptions**: k-NN does not assume a shape for the boundary. It is *non-parametric*: its complexity grows with the data, not fixed in advance.", r"**没有假设**：k-NN 不预设边界的形状。它是*非参数*的：复杂度随数据增长，而不是事先固定。"),
                    T(r"**No training**: new data evolves the model immediately; you just add a row.", r"**不用训练**：新数据立刻改变模型，加一行就行。"),
                    T(r"**Cost**: each prediction scans all $N$ instances ($O(NF)$ time) and the whole data set must be kept in memory. Expensive for large or growing data (indexes such as k-d trees help in low dimensions; they fail in the high dimensions above).", r"**代价**：每次预测要扫描全部 $N$ 个样本（$O(NF)$ 时间），整份数据都得放在内存里。数据大或不断增长时很贵（k-d 树这类索引在低维时有用，在上面说的高维里失效）。")),
                 table([T('Pros', '优点'), T('Cons', '缺点')],
                       [T('Intuitive and simple', '直观、简单'), T('Which distance function is best?', '哪个距离函数最好？')],
                       [T('No assumptions about the data', '对数据不做假设'), T('How to combine several neighbours?', '怎么合并多个近邻？')],
                       [T('Classification and regression', '分类和回归都行'), T('How to choose k?', '怎么选 k？')],
                       [T('No training: adapts at once to new data', '没有训练：立刻适应新数据'), T('Expensive for large or growing data sets', '数据大或持续增长时代价高')]),
                 p(T(r"Add to the deck's cons the two we proved: it needs scaled features and it degrades in high dimensions.", r"在课件列出的缺点之外，再加上我们证明过的两条：需要缩放特征，并且在高维下性能下降。")),
                 chapter=T('Verdict', '评价')),
            number('p-dist', T('Practice: two distances', '练习：两个距离'), S('distance'),
                   T(r"$a = (%d, %d, %d)$ and $b = (%d, %d, %d)$. What is their Euclidean distance? Round to 2 decimals." % tuple(ex_a + ex_b), r"$a = (%d, %d, %d)$，$b = (%d, %d, %d)$。它们的欧氏距离是多少？保留 2 位小数。" % tuple(ex_a + ex_b)),
                   round(ex_l2, 2),
                   T(r"Gaps $%d, %d, %d$; squares $4 + 16 + 4 = 24$; $\sqrt{24} = %s$. The Manhattan distance is $2 + 4 + 2 = %d$." % (ex_a[0] - ex_b[0], ex_a[1] - ex_b[1], ex_a[2] - ex_b[2], fx(ex_l2, 3), ex_l1),
                     r"各差为 $%d, %d, %d$；平方和 $4 + 16 + 4 = 24$；$\sqrt{24} = %s$。曼哈顿距离是 $2 + 4 + 2 = %d$。" % (ex_a[0] - ex_b[0], ex_a[1] - ex_b[1], ex_a[2] - ex_b[2], fx(ex_l2, 3), ex_l1)),
                   tolerance=0.01, chapter=T('Exam practice', '考试练习')),
            number('p-vote', T('Practice: inverse linear distance', '练习：反线性距离'), S('voting'),
                   T(r"$k = 4$ neighbours (class, distance): (A, 1), (B, 2), (B, 3), (A, 5). Using inverse linear distance weights, what is the total weight of class B?",
                     r"$k = 4$ 个近邻（类别，距离）：(A, 1)、(B, 2)、(B, 3)、(A, 5)。用反线性距离权重，B 类的总票重是多少？"),
                   round(pv_lin['B'], 2),
                   T(r"$d_1 = 1$, $d_k = 5$, so $w = (5 - d)/4$: A gets $1$ and $0$ (total %s), B gets $0.75$ and $0.5$ (total %s). **B wins** though both classes have two neighbours. Majority voting would tie; inverse distance would pick A (%s against %s)."
                     % (fx(pv_lin['A']), fx(pv_lin['B']), fx(pv_inv['A']), fx(pv_inv['B'])),
                     r"$d_1 = 1$，$d_k = 5$，所以 $w = (5 - d)/4$：A 得 $1$ 和 $0$（共 %s），B 得 $0.75$ 和 $0.5$（共 %s）。虽然两类都是两个近邻，**B 获胜**。多数票会平局；反距离会选 A（%s 对 %s）。"
                     % (fx(pv_lin['A']), fx(pv_lin['B']), fx(pv_inv['A']), fx(pv_inv['B']))),
                   tolerance=0.01),
            choice('p-n', T('Practice: k equal to N', '练习：k 等于 N'), S('k'),
                   T(r"A k-NN classifier is run with $k = N$ (the number of training instances), majority vote. What does it predict for a new instance?", r"用 $k = N$（训练样本总数）、多数票运行 k-NN 分类器。它对新样本预测什么？"),
                   [(T(r"The class of the nearest training instance.", r"最近训练样本的类别。"), T(r"That is $k = 1$. With $k = N$ the neighbours are everyone.", r"那是 $k = 1$。$k = N$ 时近邻是所有人。"), 'k-confusion'),
                    (T(r"The majority class of the whole training set, for every query.", r"整个训练集的多数类，对每个查询都一样。"), True),
                    (T(r"A smooth boundary that separates the classes best.", r"一条把各类分得最好的平滑边界。"), T(r"There is no boundary: the answer never changes with the query. It is maximal bias, and the Zero-R baseline.", r"根本没有边界：答案不随查询点变化。这是偏差最大，也就是 Zero-R 基线。"), 'smooth-is-good'),
                    (T(r"It overfits the most.", r"它过拟合得最厉害。"), T(r"The opposite: it underfits the most (high bias, zero adaptivity). $k = 1$ overfits the most.", r"相反：它欠拟合得最厉害（高偏差，毫无适应性）。过拟合最厉害的是 $k = 1$。"), 'overfit-underfit')],
                   T(r"With $k = N$ every training instance votes, whatever the query: the prediction is the training majority class.", r"$k = N$ 时每个训练样本都投票，与查询点无关：预测就是训练集的多数类。")),
            choice('p-curse', T('Practice: what high dimensions do', '练习：高维做了什么'), S('curse'),
                   T(r"You add 900 irrelevant random features to a k-NN problem with 10 informative ones, and the data set size stays the same. What happens, and why?", r"在一个有 10 个有用特征的 k-NN 问题上再加 900 个无关的随机特征，数据量不变。会发生什么，为什么？"),
                   [(T(r"Accuracy improves: more features give more information.", r"准确率提高：更多特征带来更多信息。"), T(r"Irrelevant features carry no information, only noise that enters every distance.", r"无关特征没有信息，只给每个距离加噪声。"), 'more-is-better'),
                    (T(r"Nothing changes: distance ignores features that do not matter.", r"没有变化：距离会忽略不重要的特征。"), T(r"Distance cannot tell which features matter; each of the 900 adds its share to the sum.", r"距离分不出哪些特征重要；900 个特征每个都往和里加一份。"), 'distance-picks'),
                    (T(r"Accuracy drops: the 900 noise coordinates dominate the distances, which concentrate, so the neighbours stop being the truly similar points.", r"准确率下降：900 个噪声坐标主导了距离，而距离会集中，近邻不再是真正相似的点。"), True),
                    (T(r"Only training time increases, the predictions stay the same.", r"只是训练时间变长，预测不变。"), T(r"k-NN has no training time, and the neighbours themselves change.", r"k-NN 没有训练时间，而且近邻本身变了。"), 'only-cost')],
                   T(r"This is the curse of dimensionality seen as feature noise. Feature selection or scaling down the irrelevant features is the cure.", r"这就是特征噪声形态的维度灾难。对策是特征选择，或把无关特征的尺度压下去。")),
            text_q('p-explain', T('Practice: Section A, explain', '练习：A 部分，简答'), S('k'),
                   T(r"Explain how the choice of $k$ affects a k-NN classifier, and how you would choose it.", r"解释 $k$ 的选择如何影响 k-NN 分类器，以及你怎么选 $k$。"),
                   [T(r"small k: jagged boundary, fits noise, high variance (overfits)", r"小 k：边界锯齿，拟合噪声，高方差（过拟合）"),
                    T(r"large k: smooth boundary, may merge classes, high bias (underfits); k = N is the majority class", r"大 k：边界平滑，可能混淆类别，高偏差（欠拟合）；k = N 就是多数类"),
                    T(r"choose k on validation data / cross-validation, not training error", r"用验证数据或交叉验证选 k，不要用训练误差")],
                   T(r"A small k gives a jagged decision boundary that follows noise: low bias but high variance, so it overfits. A large k gives a smooth boundary that may group unrelated classes: high bias, low variance; with k = N every query gets the majority class. I would choose k by validation or cross-validation (never by training error, where k = 1 is always perfect), trying odd values for two classes.",
                     r"k 小，决策边界锯齿状、跟着噪声走：偏差低、方差高，所以过拟合。k 大，边界平滑，可能把不相关的类别混在一起：偏差高、方差低；k = N 时每个查询都得到多数类。我会用验证集或交叉验证选 k（不能用训练误差，因为那样 k = 1 永远完美），两类时试奇数值。"),
                   T(r"Name both failure modes, say which is bias and which is variance, and say that k is chosen on held-out data.", r"两种失败方式都要写，说清哪个是偏差哪个是方差，并说明 k 是在留出数据上选的。")),
            text_q('p-design', T('Practice: Section C, design', '练习：C 部分，设计'), S('distance'),
                   T(r"You must classify short customer reviews as positive or negative with k-NN. Describe how you would represent the reviews, which distance you would use and why, how you would vote, and one weakness you expect.",
                     r"你要用 k-NN 把简短的顾客评论分成正面或负面。说明：怎么表示评论，用什么距离、为什么，怎么投票，以及你预计的一个弱点。"),
                   [T(r"represent: word-count (or presence) vector over a vocabulary", r"表示：基于词表的词频（或有无）向量"),
                    T(r"cosine distance: removes the effect of review length (or Jaccard for presence)", r"余弦距离：去掉评论长短的影响（有无向量可用 Jaccard）"),
                    T(r"vote: odd k chosen by cross-validation, possibly distance-weighted", r"投票：用交叉验证选奇数 k，可按距离加权"),
                    T(r"weakness: high-dimensional sparse vectors (distances concentrate), slow prediction on large data", r"弱点：高维稀疏向量（距离集中），数据大时预测慢")],
                   T(r"I would represent each review as a bag-of-words vector of word counts over a vocabulary (optionally with stop words removed). Reviews differ greatly in length, so I would use cosine distance, which compares the direction of the vectors, not their magnitude. I would use k nearest neighbours with odd k chosen by cross-validation, and weight votes by inverse linear distance to break ties. Weaknesses: the vectors are high-dimensional and sparse, so distances concentrate and many words are irrelevant (feature selection would help), and every prediction scans the whole training set.",
                     r"我把每条评论表示为基于词表的词袋词频向量（可去掉停用词）。评论长短差别很大，所以用余弦距离，它比较向量的方向而不是大小。用 k 近邻，k 取奇数并用交叉验证选定，投票按反线性距离加权以打破平局。弱点：向量维度高且稀疏，距离会集中，许多词也无关（特征选择会有帮助），而且每次预测都要扫描整个训练集。"),
                   T(r"Four things marked: representation, distance with its reason, voting and k, a weakness. Nothing about the model that is not asked.", r"四项给分：表示、距离及理由、投票与 k、一个弱点。不要写没问的内容。")),
            read('remember', T('What to remember', '要记住的'),
                 table([T('Measure', '度量'), T('Formula', '公式'), T('For', '适用')],
                       ['Hamming', r'$\sum_i \mathbb{I}(a_i \ne b_i)$', T('nominal 0/1; a count', '名义 0/1；一个计数')],
                       [T('Simple matching', '简单匹配'), r'$1 - k/m$', T('nominal 0/1; 0-0 counts', '名义 0/1；0-0 也算一致')],
                       ['Jaccard', r'$1 - |A\cap B|/|A\cup B|$', T('sparse 0/1; 0-0 ignored', '稀疏 0/1；忽略 0-0')],
                       ['L1', r'$\sum_i |a_i - b_i|$', T('numeric', '数值')],
                       ['L2', r'$\sqrt{\sum_i (a_i - b_i)^2}$', T('numeric', '数值')],
                       [T('Cosine', '余弦'), r'$1 - \dfrac{a\cdot b}{\lVert a\rVert \lVert b\rVert}$', T('direction matters, length does not', '看方向、不看长度')]),
                 ul(T(r"Voting: majority $w=1$; inverse distance $1/(d+\epsilon)$; inverse linear $(d_k - d_j)/(d_k - d_1)$. Regression: average of the neighbours. Break ties with odd $k$, weights, prior, or randomly.", r"投票：多数票 $w=1$；反距离 $1/(d+\epsilon)$；反线性 $(d_k - d_j)/(d_k - d_1)$。回归：近邻取平均。平局用奇数 $k$、加权、先验或随机来破。"),
                    T(r"$k$: small = jagged, high variance; large = smooth, high bias; $k = N$ = majority class. Choose it on validation data. Variance of the average is $\sigma^2/k$.", r"$k$：小 = 锯齿、高方差；大 = 平滑、高偏差；$k = N$ = 多数类。用验证数据选。平均的方差是 $\sigma^2/k$。"),
                    T(r"Scale features (fit the scaler on training data only). In high dimensions distances concentrate: nearest $\approx$ farthest.", r"要缩放特征（缩放参数只用训练数据拟合）。高维时距离集中：最近 $\approx$ 最远。"),
                    T(r"Lazy: store everything, no training, no assumptions, expensive prediction. Ordinal features: normalised rank $r/m$.", r"惰性：存下一切、不训练、无假设、预测代价高。有序特征：归一化名次 $r/m$。")),
                 chapter=T('Review sheet', '复习单')),
        ],
    )


# ==================================================================================================
#                                              DECISION TREES
# ==================================================================================================
def ent(counts):
    n = sum(counts)
    return -sum(c / n * log2(c / n) for c in counts if c)


GOLF = [('sunny', 'hot', 'high', 'FALSE', 'no'), ('sunny', 'hot', 'high', 'TRUE', 'no'), ('overcast', 'hot', 'high', 'FALSE', 'yes'),
        ('rainy', 'mild', 'high', 'FALSE', 'yes'), ('rainy', 'cool', 'normal', 'FALSE', 'yes'), ('rainy', 'cool', 'normal', 'TRUE', 'no'),
        ('overcast', 'cool', 'normal', 'TRUE', 'yes'), ('sunny', 'mild', 'high', 'FALSE', 'no'), ('sunny', 'cool', 'normal', 'FALSE', 'yes'),
        ('rainy', 'mild', 'normal', 'FALSE', 'yes'), ('sunny', 'mild', 'normal', 'TRUE', 'yes'), ('overcast', 'mild', 'high', 'TRUE', 'yes'),
        ('overcast', 'hot', 'normal', 'FALSE', 'yes'), ('rainy', 'mild', 'high', 'TRUE', 'no')]
ATTRS = ['outlook', 'temp', 'humidity', 'windy']


def counts_yn(rows):
    return [sum(r[-1] == 'yes' for r in rows), sum(r[-1] == 'no' for r in rows)]


def split_stats(rows, a, label=-1):
    """(information gain, conditional entropy, split info) of attribute index a over rows; label = class column."""
    n = len(rows)
    classes = sorted({r[label] for r in rows})
    h0 = ent([sum(r[label] == c for r in rows) for c in classes])
    cond, sizes = 0.0, []
    for v in sorted({r[a] for r in rows}):
        sub = [r for r in rows if r[a] == v]
        cond += len(sub) / n * ent([sum(r[label] == c for r in sub) for c in classes])
        sizes.append(len(sub))
    return h0 - cond, cond, ent(sizes)


H_PLAY = ent([9, 5])
STATS = {n: split_stats(GOLF, i) for i, n in enumerate(ATTRS)}
SUNNY = [r for r in GOLF if r[0] == 'sunny']
RAINY = [r for r in GOLF if r[0] == 'rainy']
SUNNY_IG = {n: split_stats(SUNNY, i)[0] for i, n in enumerate(ATTRS) if i}
RAINY_IG = {n: split_stats(RAINY, i)[0] for i, n in enumerate(ATTRS) if i}
# an identifier attribute: 14 distinct values, one row each
ID_ROWS = [(i,) + r for i, r in enumerate(GOLF)]
ID_STATS = split_stats(ID_ROWS, 0, label=-1)
AVG_IG = sum(STATS[n][0] for n in ATTRS) / 4
# One-R error counts per attribute
ONE_R = {}
for i, n in enumerate(ATTRS):
    errs = 0
    for v in {r[i] for r in GOLF}:
        c = counts_yn([r for r in GOLF if r[i] == v])
        errs += min(c)
    ONE_R[n] = errs
# mutual information from the joint table, for the outlook attribute
def mutual_info(rows, a):
    n = len(rows)
    mi = 0.0
    for v in {r[a] for r in rows}:
        for c in ('yes', 'no'):
            pj = sum(1 for r in rows if r[a] == v and r[-1] == c) / n
            if pj:
                pa = sum(1 for r in rows if r[a] == v) / n
                pc = sum(1 for r in rows if r[-1] == c) / n
                mi += pj * log2(pj / (pa * pc))
    return mi


MI_OUT = mutual_info(GOLF, 0)

# the deck's income data (slides 51-56): age, edu-num, hours per week, income > 50K (class) and income in K (regression)
INC = [(31, 13, 40, '>50K', 65), (31, 9, 20, '<=50K', 30), (25, 13, 60, '>50K', 90), (70, 9, 40, '>50K', 55), (39, 9, 45, '<=50K', 50),
       (20, 10, 25, '<=50K', 40), (25, 9, 40, '<=50K', 45), (22, 9, 48, '<=50K', 45), (25, 13, 40, '>50K', 60), (61, 10, 25, '<=50K', 35)]


def thr_gain(rows, col, t):
    left = [r for r in rows if r[col] <= t]
    right = [r for r in rows if r[col] > t]
    cl = [sum(r[3] == c for r in left) for c in ('>50K', '<=50K')]
    cr = [sum(r[3] == c for r in right) for c in ('>50K', '<=50K')]
    cp = [sum(r[3] == c for r in rows) for c in ('>50K', '<=50K')]
    return ent(cp) - (len(left) * ent(cl) + len(right) * ent(cr)) / len(rows), cl, cr


EDU_95, EDU_115 = thr_gain(INC, 1, 9.5), thr_gain(INC, 1, 11.5)
LEFT = [r for r in INC if r[1] <= 11]
AGE_65 = thr_gain(LEFT, 0, 65)


def ssr(vals):
    m = sum(vals) / len(vals)
    return sum((v - m) ** 2 for v in vals)


Y_ALL = [r[4] for r in INC]
Y_R = [r[4] for r in INC if r[1] > 11]
Y_L = [r[4] for r in INC if r[1] <= 11]
Y_LL = [r[4] for r in INC if r[1] <= 11 and r[0] <= 65]
Y_LR = [r[4] for r in INC if r[1] <= 11 and r[0] > 65]
SSR_0, SSR_1, SSR_2 = ssr(Y_ALL), ssr(Y_L) + ssr(Y_R), ssr(Y_LL) + ssr(Y_LR) + ssr(Y_R)
mean = lambda v: sum(v) / len(v)  # noqa: E731


# --------------------------------------------------------------------------------------- figures
def box(f, cx, cy, w, h, text, fill='#ffffff', stroke=INK, size=17, color=INK):
    f.rect(cx - w / 2, cy - h / 2, w, h, fill, stroke, 1.8, 8)
    f.text(cx, cy + size * .35, text, size, color, 'middle')


def fig_entropy(lang):
    pl = Plot(0, 1, 0, 1.1, left=64, right=34)
    H2 = lambda q: 0 if q in (0, 1) else -(q * log2(q) + (1 - q) * log2(1 - q))  # noqa: E731
    pl.curve(H2, 0, 1, BLUE, 3.5, n=120)
    pl.seg((.5, 0), (.5, 1), MUTED, 1.5, '5 5')
    pl.dot(.5, 1, BLUE, 6)
    pl.dot(9 / 14, H2(9 / 14), ORANGE, 6)
    pl.text(.5, 1, '1 bit', BLUE, 16, 'middle', 0, -14)
    pl.text(9 / 14, H2(9 / 14), 'play: 0.94', ORANGE, 16, 'start', 12, -12)
    pl.text(0, 0, '0', MUTED, 15, 'middle', 0, 24)
    pl.text(1, 0, '1', MUTED, 15, 'middle', 0, 24)
    pl.axes('p', 'H', (), (0, .5, 1))
    return pl.svg()


def fig_golf_tree(lang):
    f = Fig(680, 340, lang)
    o = 20  # left margin so no box is cut
    box(f, 320 + o, 40, 140, 44, 'Outlook', '#eef2ff')
    kids = [(110, 'sunny', 'Humidity'), (320, 'overcast', None), (530, 'rainy', 'Windy')]
    for x, v, nm in kids:
        f.line(320 + o, 62, x + o, 138, INK, 1.8)
        f.text(o + (320 + x) / 2 + (-22 if x < 320 else 22 if x > 320 else 8), 96, v, 16, MUTED, 'end' if x < 320 else 'start')
    box(f, 110 + o, 160, 130, 44, 'Humidity', '#eef2ff')
    box(f, 530 + o, 160, 110, 44, 'Windy', '#eef2ff')
    box(f, 320 + o, 160, 110, 44, f'yes (4)', '#e6f4ea', GREEN)
    for x, label, cnt, ok in [(50, 'normal', 'yes (2)', True), (172, 'high', 'no (3)', False), (470, 'FALSE', 'yes (3)', True), (592, 'TRUE', 'no (2)', False)]:
        px = 110 if x < 300 else 530
        f.line(px + o, 182, x + o, 258, INK, 1.8)
        f.text(o + (px + x) / 2 + (-8 if x < px else 8), 226, label, 16, MUTED, 'end' if x < px else 'start')
        box(f, x + o, 282, 100, 44, cnt, '#e6f4ea' if ok else '#fdeadf', GREEN if ok else ORANGE)
    return f.svg()


def fig_income_tree(lang):
    f = Fig(720, 340, lang)
    o = 30
    box(f, 150 + o, 44, 170, 44, 'Edu-num', '#eef2ff')
    f.line(150 + o, 66, 70 + o, 128, INK, 1.8)
    f.line(150 + o, 66, 250 + o, 128, INK, 1.8)
    f.text(96 + o, 100, '≤ 11', 16, MUTED, 'end')
    f.text(222 + o, 100, '> 11', 16, MUTED)
    box(f, 70 + o, 150, 120, 44, 'Age', '#eef2ff')
    box(f, 250 + o, 150, 110, 44, '>50K', '#fdeadf', ORANGE)
    f.line(70 + o, 172, 30 + o, 238, INK, 1.8)
    f.line(70 + o, 172, 130 + o, 238, INK, 1.8)
    f.text(44 + o, 208, '≤ 65', 16, MUTED, 'end')
    f.text(110 + o, 208, '> 65', 16, MUTED)
    box(f, 36 + o, 262, 100, 44, '≤50K', '#e3ecff', BLUE)
    box(f, 140 + o, 262, 100, 44, '>50K', '#fdeadf', ORANGE)
    # the regions: x = age 15..75, y = edu-num 8..14
    ox, oy, w, h = 410, 296, 280, 240
    X = lambda a: ox + (a - 15) / 60 * w  # noqa: E731
    Y = lambda e: oy - (e - 8) / 6 * h  # noqa: E731
    f.rect(X(15), Y(14), X(75) - X(15), Y(11) - Y(14), '#fdeadf', None, 0, 0)
    f.rect(X(65), Y(11), X(75) - X(65), Y(8) - Y(11), '#fdeadf', None, 0, 0)
    f.rect(X(15), Y(11), X(65) - X(15), Y(8) - Y(11), '#e3ecff', None, 0, 0)
    f.rect(X(15), Y(14), X(75) - X(15), Y(8) - Y(14), 'none', INK, 1.6, 0)
    f.line(X(15), Y(11), X(75), Y(11), INK, 2.2, '7 5')
    f.line(X(65), Y(11), X(65), Y(8), INK, 2.2, '7 5')
    for a, e, _, c, _y in INC:
        f.circle(X(a), Y(e), 6, ORANGE if c == '>50K' else BLUE, '#ffffff', 1.6)
    f.text(ox + w / 2, oy + 30, 'Age', 17, INK, 'middle')
    f.text(ox - 12, oy - h - 10, 'Edu-num', 17, INK, 'start')
    f.text(X(15) - 8, Y(11) + 5, '11', 15, MUTED, 'end')
    f.text(X(65), oy + 16, '65', 15, MUTED, 'middle')
    return f.svg()


# ---------------------------------------------------------------------------------------- the lesson
def L_trees():
    S = lambda s: f'trees.{s}'  # noqa: E731
    pf = fx  # shorthand
    # practice numbers
    p_ig = ent([4, 4]) - (4 / 8 * ent([3, 1]) + 4 / 8 * ent([1, 3]))
    p_si = ent([2, 2, 4])
    return dict(
        id=lid('trees'), title=T('Decision trees', '决策树（decision trees）'),
        description=T('Build a tree by asking the question that removes the most uncertainty: entropy, information gain, gain ratio, stopping and pruning, numeric splits, regression trees, and why gain is mutual information.',
                      '每一步问那个最能消除不确定性的问题来建树：熵、信息增益、增益率、停止与剪枝、数值特征的切分、回归树，以及为什么信息增益就是互信息。'),
        minutes=45,
        skills=[{'id': S('id3'), 'name': T('The ID3 algorithm and baselines', 'ID3 算法与基线')},
                {'id': S('entropy'), 'name': T('Entropy and information gain by hand', '手算熵与信息增益')},
                {'id': S('gainratio'), 'name': T('Gain ratio and the many-values bias', '增益率与多取值偏差')},
                {'id': S('overfit'), 'name': T('Stopping, overfitting and pruning', '停止、过拟合与剪枝')},
                {'id': S('numeric'), 'name': T('Numeric attributes and regression trees', '数值特征与回归树')}],
        misconceptions=[{'id': 'ig-many-values', 'description': T('Believing the attribute with the highest information gain is always best, even an ID-like one', '以为信息增益最大的特征总是最好，哪怕它像个编号')},
                        {'id': 'tree-optimal', 'description': T('Thinking ID3 finds the smallest or best tree', '以为 ID3 能找到最小或最好的树')},
                        {'id': 'pure-is-good', 'description': T('Growing until every leaf is pure and trusting the 100% training accuracy', '一直长到每个叶子都纯，并相信 100% 的训练准确率')}],
        steps=[
            read('idea', T('What it is: a tree of questions', '它是什么：一棵提问的树'),
                 p(T(r"A **decision tree** classifies an instance by asking a series of questions about its features, one at a time. Each answer sends it down a branch, until it reaches a **leaf** that holds the answer. It is a nested if-else, and it is learned from data. The deck's running example is the golf data: play or not, from the weather.",
                     r"**决策树**对样本逐个提问它的特征，每个回答把它送进一条分支，直到到达装着答案的**叶子**。它就是嵌套的 if-else，并且是从数据里学出来的。课件的贯穿例子是高尔夫数据：根据天气决定打不打球。")),
                 table(['id', 'Outlook', 'Temp', 'Humidity', 'Windy', 'Play?'],
                       *[[str(i + 1)] + list(r) for i, r in enumerate(GOLF)]),
                 ul(T(r"**Root node**: the first question. **Internal node**: a question about one feature. **Branch**: one answer. **Leaf**: a prediction (a pure leaf has a single class).", r"**根节点**：第一个问题。**内部节点**：关于某个特征的问题。**分支**：一个回答。**叶子**：一个预测（纯叶子只含一个类别）。"),
                    T(r"New instance 15: (rainy, cool, high, FALSE), play unknown. The tree on a later page answers it.", r"新样本 15：（rainy, cool, high, FALSE），是否打球未知。后面一页的树会回答它。")),
                 chapter=T('The idea', '想法')),
            read('baselines', T('Two baselines: Zero-R and One-R', '两个基线：Zero-R 与 One-R'),
                 p(T(r"Before building anything clever, know what a trivial model scores. **Zero-R** ignores all features and predicts the most frequent label: always “yes” gets $9/14 \approx 64\%$ on the golf data. It is the baseline every classifier must beat (also what k-NN becomes at $k = N$).",
                     r"在建任何精巧的模型之前，先知道平凡模型能拿多少分。**Zero-R** 不看任何特征，直接预测最常见的标签：永远答 “yes”，在高尔夫数据上是 $9/14 \approx 64\%$。每个分类器都必须胜过它（k-NN 在 $k = N$ 时就变成它）。")),
                 p(T(r"**One-R** (a decision *stump*, a tree of depth 1) uses just one feature: for each value of that feature predict the majority label, and keep the feature with the fewest mistakes on the training data. Errors per feature (out of 14):",
                     r"**One-R**（决策*树桩*，深度为 1 的树）只用一个特征：对该特征的每个取值预测多数标签，保留训练数据上错误最少的特征。每个特征的错误数（共 14 个）：")),
                 table([T('Feature', '特征'), T('Errors', '错误'), T('Accuracy', '准确率')], *[[n, f'{ONE_R[n]}/14', f'{14 - ONE_R[n]}/14'] for n in ATTRS]),
                 p(T(r"Outlook and Humidity tie at 4 mistakes (a stump on Outlook: sunny → no, overcast → yes, rainy → yes). Both stumps still leave impure leaves: sunny has 2 yes and 3 no. Add more branches under the impure leaves, and the tree grows.",
                     r"Outlook 和 Humidity 并列，各错 4 个（Outlook 树桩：sunny → no，overcast → yes，rainy → yes）。两个树桩都还留有不纯的叶子：sunny 里有 2 个 yes、3 个 no。在不纯的叶子下面继续加分支，树就长大了。")),
                 p(T(r"That raises the real question: *which feature should each node ask about?* Mistake counts are too crude for this; we need a smoother measure of purity: entropy.", r"这就引出真正的问题：*每个节点该问哪个特征？* 用错误数来选太粗了；我们需要更细腻的纯度度量：熵。"))),
            read('greedy', T('Growing a tree: ID3, a greedy heuristic', '长一棵树：ID3，一种贪心启发式'),
                 p(T(r"The best tree (smallest, with purest leaves) is **NP-hard** to find: there is no known fast way. So ID3 (Quinlan, 1986) uses a heuristic: *at each node, split on the attribute that makes the children as pure as possible*.",
                     r"最好的树（最小、叶子最纯）是 **NP 难**的：没有已知的快速办法。所以 ID3（Quinlan, 1986）用启发式：*在每个节点上，按能让子节点最纯的那个属性来切分*。")),
                 ol(T(r"If all instances at the node have one class, make a leaf with that class. Stop.", r"如果节点里所有样本类别相同，就做成这个类别的叶子，停止。"),
                    T(r"If there are no attributes left (or another stopping rule fires), make a leaf with the majority class.", r"如果没有属性可用了（或别的停止规则触发），就做一个多数类的叶子。"),
                    T(r"Otherwise choose the attribute with the highest **information gain** (defined next), make it the node's question, and make one branch per value.", r"否则选**信息增益**最高的属性（下面定义），把它作为这个节点的问题，每个取值一条分支。"),
                    T(r"Send each instance down its branch and repeat from step 1 on every child: **recursive divide and conquer**.", r"把每个样本送进对应分支，对每个子节点从第 1 步重来：**递归的分治**。")),
                 ul(T(r"**Greedy, no backtracking**: ID3 searches the space of all trees from the empty tree toward more elaborate ones, committing to each choice. It is not guaranteed to find the globally best tree. (The hypothesis space is every possible tree: it can represent any function of the discrete features.)", r"**贪心、不回溯**：ID3 在所有树构成的空间里从空树出发，朝越来越复杂的树搜索，每一步选定就不再改。不保证找到全局最优的树。（假设空间是所有可能的树，它能表示离散特征上的任何函数。）"),
                    T(r"**Occam's razor** is the stated reason to want the *smallest* tree: few short hypotheses exist, so a short one that fits the data is unlikely to be a coincidence. Against: there are many ways to define “small” hypothesis sets.", r"想要*最小*的树，依据是**奥卡姆剃刀**：短的假设很少，所以一个能拟合数据的短假设不太可能是巧合。反方观点：“小”的假设集有很多种定义方式。"))),
            read('entropy', T('Entropy: how surprised are we?', '熵：我们会有多惊讶？'),
                 chapter=T('Entropy and information gain', '熵与信息增益'),
                 *[p(T(r"To say “purer” in numbers we need a measure of uncertainty. Start with surprise. A rare event, if it happens, is big news; a near-certain event tells you nothing. The **self-information** of an outcome with probability $p(x)$ is",
                       r"要把“更纯”变成数字，需要一个衡量不确定性的量。先从惊讶说起。罕见的事发生了是大新闻；几乎必然的事发生了没什么好说的。概率为 $p(x)$ 的结果的**自信息**是")),
                   math_(r"I(x) = -\log_2 p(x) \quad \text{bits}"),
                   p(T(r"Probability $1/2$: 1 bit. Probability $1/8$: 3 bits. Probability $1$: 0 bits. **Entropy** is the average surprise when the outcome is drawn from the distribution itself:",
                       r"概率 $1/2$：1 比特。概率 $1/8$：3 比特。概率 $1$：0 比特。**熵**就是结果按这个分布自己抽出来时的平均惊讶：")),
                   math_(r"H(X) = -\sum_{i=1}^{m} P(X = i)\,\log_2 P(X = i), \qquad 0\log_2 0 := 0"),
                   ul(T(r"Two-headed coin: $H = -(1\cdot\log_2 1 + 0) = 0$. No surprise at all.", r"两面都是正面的硬币：$H = -(1\cdot\log_2 1 + 0) = 0$。毫无惊讶。"),
                      T(r"Fair coin: $H = -(0.5\log_2 0.5 + 0.5\log_2 0.5) = 1$ bit. The most uncertain two-outcome case.", r"均匀硬币：$H = -(0.5\log_2 0.5 + 0.5\log_2 0.5) = 1$ 比特。两种结果里最不确定的情形。"),
                      T(r"Golf, 9 yes and 5 no: $H(\text{play}) = -\tfrac{9}{14}\log_2\tfrac{9}{14} - \tfrac{5}{14}\log_2\tfrac{5}{14} = %s$." % pf(H_PLAY, 3), r"高尔夫，9 个 yes、5 个 no：$H(\text{play}) = -\tfrac{9}{14}\log_2\tfrac{9}{14} - \tfrac{5}{14}\log_2\tfrac{5}{14} = %s$。" % pf(H_PLAY, 3))),
                   svg(drawn(fig_entropy), T('Entropy of a two-class node as a function of the probability p of one class: zero at p = 0 and p = 1, one bit at p = 1/2. The golf node (9/14 yes) sits at 0.94.', '两类节点的熵随其中一类的概率 p 变化：p = 0 和 p = 1 时为零，p = 1/2 时为 1 比特。高尔夫节点（9/14 为 yes）在 0.94。')),
                   p(T(r"So entropy is $0$ for a pure node and largest ($\log_2 m$ for $m$ classes) when the classes are evenly mixed. That is exactly the purity measure we wanted. On the exam, compute $\log_2 x = \ln x / \ln 2$ on the calculator, and practise it.",
                       r"所以纯节点的熵是 $0$，类别均匀混合时最大（$m$ 个类别时是 $\log_2 m$）。这正是我们想要的纯度度量。考试时用计算器算 $\log_2 x = \ln x / \ln 2$，并且要练熟。"))]),
            read('infogain', T('Information gain: the reduction in entropy', '信息增益：熵的减少量'),
                 p(T(r"After splitting on attribute $A$, each child has its own entropy. The **conditional entropy** is their average, weighted by how many instances each child receives:",
                     r"按属性 $A$ 切分后，每个子节点有自己的熵。**条件熵**是它们的平均，权重是每个子节点分到的样本比例：")),
                 math_(r"H(R \mid A) = \sum_{a} P(A = a)\, H(R \mid A = a)"),
                 p(T(r"Here $R$ is the class (for golf, play). The **information gain** is how much uncertainty about the class the attribute removes:",
                     r"这里 $R$ 是类别（高尔夫里是 play）。**信息增益**就是这个属性消除了多少关于类别的不确定性：")),
                 math_(r"IG(R, A) = H(R) - H(R \mid A)"),
                 p(T(r"ID3 computes it for every attribute at a node and takes the biggest. In words: *how much does knowing $A$ help in predicting $R$?* The weighting matters: a tiny pure child should not count as much as a big pure one."
                     , r"ID3 对节点上每个属性都算一遍，取最大的。用话说：*知道 $A$ 对预测 $R$ 有多大帮助？* 加权很重要：一个很小的纯子节点，不应该和一个很大的纯子节点同样重要。"))),
            derive('ig-calc', T('Information gain of Outlook, from scratch', '从头算 Outlook 的信息增益'),
                   [(r"H(C) = -\tfrac{9}{14}\log_2\tfrac{9}{14} - \tfrac{5}{14}\log_2\tfrac{5}{14}", T(r"Let $C$ be the class (play). Start with the entropy at the root: 9 yes and 5 no out of 14.", r"设 $C$ 为类别（play）。从根节点的熵开始：14 个里 9 个 yes、5 个 no。")),
                    (r"= %s + %s = %s" % (pf(-9 / 14 * log2(9 / 14), 3), pf(-5 / 14 * log2(5 / 14), 3), pf(H_PLAY, 3)), T(r"Each term is $-p\log_2 p$ (each is positive, because $\log_2 p<0$). Sum: 0.940 bits.", r"每一项是 $-p\log_2 p$（都是正的，因为 $\log_2 p<0$）。相加：0.940 比特。")),
                    (r"S:\ (2,3), \qquad R:\ (3,2), \qquad O:\ (4,0)", T(r"Split on Outlook. S, R, O are the sunny, rainy and overcast branches, written as (yes, no) counts: 5 sunny days, 5 rainy days, 4 overcast days.", r"按 Outlook 切分。S、R、O 是晴、雨、阴三条分支，写成（yes, no）的个数：5 个晴天、5 个雨天、4 个阴天。")),
                    (r"H(S) = -\tfrac{2}{5}\log_2\tfrac{2}{5} - \tfrac{3}{5}\log_2\tfrac{3}{5} = %s" % pf(ent([2, 3]), 3), T(r"Entropy of the sunny branch. The rainy branch has the same counts swapped (3 and 2), so the same entropy.", r"晴天分支的熵。雨天分支的数字对调（3 和 2），所以熵相同。")),
                    (r"H(R) = %s" % pf(ent([3, 2]), 3), T(r"Symmetric: the entropy does not care which class is which.", r"对称：熵不关心哪个类是哪个。")),
                    (r"H(O) = -1\cdot\log_2 1 - 0 = 0", T(r"Overcast is a pure node: all 4 are yes. Pure means zero entropy.", r"阴天是个纯节点：4 个全是 yes。纯就是熵为零。")),
                    (r"H(C\mid A) = \tfrac{5}{14}(%s) + \tfrac{5}{14}(%s) + \tfrac{4}{14}(0) = %s" % (pf(ent([2, 3]), 3), pf(ent([3, 2]), 3), pf(STATS['outlook'][1], 3)), T(r"With $A$ = Outlook: the weighted average of the three child entropies, weights $5/14$, $5/14$, $4/14$. (The deck rounds this to 0.693.)", r"$A$ 是 Outlook：三个子节点的熵的加权平均，权重 $5/14$、$5/14$、$4/14$。（课件舍入成 0.693。）")),
                    (r"IG(C, A) = %s - %s = %s" % (pf(H_PLAY, 3), pf(STATS['outlook'][1], 3), pf(STATS['outlook'][0], 3)), T(r"The gain: 0.247 bits of uncertainty about play removed by asking about Outlook.", r"增益：问了 Outlook，关于 play 的不确定性消除了 0.247 比特。")),
                    (r"IG_O = %s,\ IG_H = %s,\ IG_W = %s,\ IG_T = %s" % tuple(pf(STATS[n][0], 3) for n in ('outlook', 'humidity', 'windy', 'temp')), T(r"The same recipe on the other three attributes (subscripts O, H, W, T: Outlook, Humidity, Windy, Temperature; Temperature's conditional entropy is 0.911; the deck's slide prints 0.991, a slip: its own gain 0.029 matches 0.911). Outlook is the biggest: **it becomes the root**.", r"对另外三个属性用同样的方法（下标 O、H、W、T：Outlook、Humidity、Windy、Temperature；Temperature 的条件熵是 0.911；课件那页印成 0.991，是笔误：它自己给的增益 0.029 对应的是 0.911）。Outlook 最大：**它成为根节点**。"))],
                   intro=T(r"Choose the root of the golf tree. Compute the information gain of each attribute, in full for Outlook, in log base 2.", r"选高尔夫树的根节点。算每个属性的信息增益，Outlook 完整地算，以 2 为底取对数。"),
                   blank=(5, '0', T(r"What is the entropy of the overcast node (4 yes, 0 no)?", r"阴天节点（4 个 yes、0 个 no）的熵是多少？")),
                   skill=S('entropy')),
            read('grow', T('The tree grows: the recursion by hand', '树长出来：手算递归'),
                 p(T(r"Overcast is pure: a leaf. Sunny (5 rows) and rainy (5 rows) are not; repeat the recipe inside each, using only its rows. The gains:",
                     r"阴天是纯的：做叶子。晴天（5 行）和雨天（5 行）不纯；在各自内部只用它的行把同样的方法再做一遍。增益是：")),
                 table([T('Attribute', '属性'), T('inside sunny', '在 sunny 内'), T('inside rainy', '在 rainy 内')],
                       *[[n, pf(SUNNY_IG[n], 3), pf(RAINY_IG[n], 3)] for n in ('temp', 'humidity', 'windy')]),
                 p(T(r"Inside sunny, Humidity splits it perfectly (normal: 2 yes, high: 3 no; gain $= 0.971 = H$ of the node). Inside rainy, Windy does (FALSE: 3 yes, TRUE: 2 no). (The deck prints 0.018 for the small gains, from rounding 0.952; exactly they are 0.020.) Both children are now pure.",
                     r"在 sunny 内，Humidity 切得干干净净（normal：2 个 yes；high：3 个 no；增益 $= 0.971$，等于该节点的熵）。在 rainy 内是 Windy（FALSE：3 个 yes；TRUE：2 个 no）。（课件把小的增益印成 0.018，是 0.952 舍入所致；精确值是 0.020。）两个子节点现在都纯了。")),
                 svg(drawn(fig_golf_tree), T('The golf decision tree: Outlook at the root; sunny asks Humidity (normal: yes, high: no); overcast is yes; rainy asks Windy (FALSE: yes, TRUE: no). Leaves show the number of training rows.', '高尔夫决策树：根是 Outlook；sunny 问 Humidity（normal：yes，high：no）；overcast 是 yes；rainy 问 Windy（FALSE：yes，TRUE：no）。叶子标出训练行数。')),
                 ul(T(r"**Predict instance 15** (rainy, cool, high, FALSE): Outlook = rainy → ask Windy → FALSE → **yes**.", r"**预测样本 15**（rainy, cool, high, FALSE）：Outlook = rainy → 问 Windy → FALSE → **yes**。"),
                    T(r"Temperature never appears: it was never the best question, so the tree ignores it. A tree selects features as a side effect of growing.", r"Temperature 从未出现：它从来不是最好的问题，所以树没用它。树在生长的同时顺带做了特征选择。"),
                    T(r"A categorical attribute is used at most once on any root-to-leaf path: after splitting on it, every branch has a single value.", r"一个类别型属性在任一条从根到叶的路径上最多用一次：切分之后，每条分支里它都只有一个取值。")),
                 details(T('Missing values (beyond the deck)', '缺失值（课件之外）'),
                         p(T(r"Textbook options (C4.5, CART): send a case with a missing value down every branch with fractional weights proportional to the branch sizes; or use *surrogate splits* that mimic the main split on another attribute; or fill with the most common value. The deck does not cover this.",
                             r"教科书里的做法（C4.5、CART）：把缺失值的样本按各分支大小的比例，以分数权重送进所有分支；或用*替代切分*，在另一个属性上模仿主切分；或用最常见的值填充。课件没有涉及这个。")))),
            read('gainratio', T('Information gain\'s weakness, and gain ratio', '信息增益的弱点，与增益率'),
                 chapter=T('Gain ratio', '增益率'),
                 *[p(T(r"Suppose we add an attribute **id** (1 to 14) to the golf data. Splitting on it gives 14 children of one instance each, every one pure: $H(\text{play}\mid\text{id}) = 0$, so $IG = H(\text{play}) = %s$, higher than any real attribute. And useless: it just memorises the rows, and a new instance has an id nobody has seen." % pf(ID_STATS[0], 3),
                       r"假设给高尔夫数据加一个属性 **id**（1 到 14）。按它切分得到 14 个子节点，每个只有一个样本，全是纯的：$H(\text{play}\mid\text{id}) = 0$，所以 $IG = H(\text{play}) = %s$，比任何真实属性都高。却毫无用处：它只是把每行背下来，新样本的 id 没人见过。" % pf(ID_STATS[0], 3))),
                   p(T(r"The same bias, milder, hits any attribute with many values: a small subset is more likely to be pure by luck. The result is **fragmentation** (few instances per branch) and **overfitting**. **Gain ratio** (C4.5) divides by the **split information**, the entropy of the split itself (how evenly instances spread over the values):",
                       r"同样的偏差，程度较轻，也会影响任何取值很多的属性：小子集更容易碰巧纯。结果是**碎片化**（每条分支样本很少）和**过拟合**。**增益率**（C4.5）除以**分裂信息**，即切分本身的熵（样本在各取值上分布得多均匀）：")),
                   math_(r"SI(R, A) = H(A) = -\sum_{a} P(a)\log_2 P(a), \qquad GR(R, A) = \frac{IG(R, A)}{SI(R, A)}"),
                   p(T(r"Outlook splits 14 into $5, 5, 4$: $SI = -\left[\tfrac{5}{14}\log_2\tfrac{5}{14}\cdot 2 + \tfrac{4}{14}\log_2\tfrac{4}{14}\right] = %s$, so $GR = %s / %s = %s$." % (pf(STATS['outlook'][2], 3), pf(STATS['outlook'][0], 3), pf(STATS['outlook'][2], 3), pf(STATS['outlook'][0] / STATS['outlook'][2], 3)),
                       r"Outlook 把 14 个分成 $5, 5, 4$：$SI = -\left[\tfrac{5}{14}\log_2\tfrac{5}{14}\cdot 2 + \tfrac{4}{14}\log_2\tfrac{4}{14}\right] = %s$，所以 $GR = %s / %s = %s$。" % (pf(STATS['outlook'][2], 3), pf(STATS['outlook'][0], 3), pf(STATS['outlook'][2], 3), pf(STATS['outlook'][0] / STATS['outlook'][2], 3)))),
                   table([T('Attribute', '属性'), 'IG', 'SI', 'GR'],
                         *[[n, pf(STATS[n][0], 3), pf(STATS[n][2], 3), pf(STATS[n][0] / STATS[n][2], 3)] for n in ATTRS],
                         ['id (14 values)', pf(ID_STATS[0], 3), pf(ID_STATS[2], 3), pf(ID_STATS[0] / ID_STATS[2], 3)]),
                   ul(T(r"A many-valued, evenly spread attribute has a large $SI$ (the id has $\log_2 14 = %s$), which shrinks its ratio." % pf(log2(14), 3), r"取值很多、分布均匀的属性 $SI$ 很大（id 的是 $\log_2 14 = %s$），这就压低了它的比值。" % pf(log2(14), 3)),
                      T(r"But gain ratio is not a complete cure: here the id's ratio ($%s$) still beats Outlook's ($%s$). Real C4.5 therefore first keeps only attributes whose gain is at least the average ($%s$ over the four real ones: Outlook and Humidity survive), then takes the best ratio among them. Pure identifiers should simply be removed from the data." % (pf(ID_STATS[0] / ID_STATS[2], 3), pf(STATS['outlook'][0] / STATS['outlook'][2], 3), pf(AVG_IG, 3)),
                        r"但增益率也不是万灵药：这里 id 的比值（$%s$）仍然高于 Outlook 的（$%s$）。真正的 C4.5 因此先只保留增益不低于平均值的属性（四个真实属性的平均是 $%s$：Outlook 和 Humidity 留下），再在其中取比值最大的。纯粹的编号列应当直接从数据里删掉。" % (pf(ID_STATS[0] / ID_STATS[2], 3), pf(STATS['outlook'][0] / STATS['outlook'][2], 3), pf(AVG_IG, 3))))]),
            derive('mi-derive', T('Deeper: information gain is mutual information', '深入：信息增益就是互信息'),
                   [(r"H(R) = -\sum_{a,r} p(a,r)\,\log p(r)", T(r"Write the class entropy as a sum over both $a$ and $r$. This is allowed because $\sum_a p(a,r) = p(r)$: adding up the joint over $a$ gives the marginal.", r"把类别的熵写成对 $a$ 和 $r$ 两个变量的求和。这样写合法，因为 $\sum_a p(a,r) = p(r)$：联合分布对 $a$ 求和得到边缘分布。")),
                    (r"H(R\mid A) = -\sum_{a,r} p(a,r)\,\log p(r\mid a)", T(r"The conditional entropy $-\sum_a p(a)\sum_r p(r\mid a)\log p(r\mid a)$, using $p(a)\,p(r\mid a) = p(a,r)$.", r"条件熵 $-\sum_a p(a)\sum_r p(r\mid a)\log p(r\mid a)$，用 $p(a)\,p(r\mid a) = p(a,r)$。")),
                    (r"IG = H(R) - H(R\mid A) = \sum_{a,r} p(a,r)\,\bigl[\log p(r\mid a) - \log p(r)\bigr]", T(r"Subtract. The minus signs flip so both logs sit inside one bracket.", r"相减。两个负号翻转，两个对数放进同一个括号。")),
                    (r"= \sum_{a,r} p(a,r)\,\log\dfrac{p(r\mid a)}{p(r)}", T(r"A difference of logs is the log of a ratio.", r"对数之差是比值的对数。")),
                    (r"= \sum_{a,r} p(a,r)\,\log\dfrac{p(a,r)}{p(a)\,p(r)}", T(r"Replace $p(r\mid a)$ by $p(a,r)/p(a)$. The fraction now compares the joint probability with what it would be if $A$ and $R$ were independent.", r"把 $p(r\mid a)$ 换成 $p(a,r)/p(a)$。这个分数是在比较联合概率与“若 $A$ 和 $R$ 独立时它应有的值”。")),
                    (r"= \mathrm{KL}\bigl(p(a,r)\,\Vert\,p(a)p(r)\bigr) = I(R;A)", T(r"This is the definition of **mutual information**: the KL divergence between the true joint distribution and the product of the marginals. Information gain *is* mutual information (the deck's own parenthesis says so).", r"这就是**互信息**的定义：真实联合分布与边缘分布乘积之间的 KL 散度。信息增益*就是*互信息（课件自己的括号里也这么写）。")),
                    (r"I(R;A) \ge 0, \qquad I(R;A) = 0 \iff A \perp R", T(r"KL divergence is never negative and is zero only when the two distributions agree, i.e. when the joint factorises. So $IG = 0$ means the attribute is independent of the class in the data, and splitting on it cannot help (the deck: “no improvement”).", r"KL 散度不为负，且仅在两个分布相等（联合分布能分解）时为零。所以 $IG = 0$ 表示在这份数据里该属性与类别独立，按它切分毫无帮助（课件：“no improvement”）。")),
                    (r"I(R;A) = H(A) - H(A\mid R) \le H(A)", T(r"Mutual information is symmetric, so the gain can also be written with the roles swapped. Since $H(A\mid R) \ge 0$, the gain never exceeds the attribute's own entropy $H(A) = SI$. That is the reason for gain ratio: $GR = IG/H(A) \in [0, 1]$ is the fraction of the attribute's own uncertainty that is about the class, and an attribute with huge $H(A)$ (many values) cannot score high on it just by being huge.", r"互信息是对称的，所以增益也可以把角色对调着写。因为 $H(A\mid R) \ge 0$，增益永远不会超过属性自己的熵 $H(A) = SI$。这就是增益率的理由：$GR = IG/H(A) \in [0, 1]$ 是属性自身的不确定性里与类别有关的那一部分；取值极多（$H(A)$ 巨大）的属性不能靠“大”来拿高分。")),
                    (r"\sum_{a,r} p(a,r)\log_2\dfrac{p(a,r)}{p(a)p(r)} = %s" % pf(MI_OUT, 3), T(r"Check on the golf data with $A$ = Outlook: summing the six cells (outlook, play) of the joint table gives the same 0.247 as $H(\text{play}) - H(\text{play}\mid\text{outlook})$.", r"在高尔夫数据上验证，取 $A$ = Outlook：把联合表里（outlook, play）六个格子加起来，得到的 0.247 与 $H(\text{play}) - H(\text{play}\mid\text{outlook})$ 相同。"))],
                   intro=T(r"Information gain looks like a bookkeeping trick. Show that it is a standard quantity of information theory, and what that tells us.", r"信息增益看起来像个记账技巧。证明它是信息论里的标准量，并看这能告诉我们什么。"),
                   skill=S('gainratio')),
            read('stopping', T('When to stop, overfitting and pruning', '何时停止、过拟合与剪枝'),
                 chapter=T('Practical trees', '实用的树'),
                 *[p(T(r"Grown without limit, ID3 splits until every leaf is pure, which always works on the training data and is exactly the id-attribute trap in slow motion: deep nodes hold 2-3 instances, so the tree memorises noise. It **overfits**: training accuracy near 100%, worse on new data.",
                       r"不加限制地长，ID3 会一直切到每个叶子都纯，这在训练数据上总能做到，正是 id 属性陷阱的慢镜头：深处的节点只有 2、3 个样本，树把噪声背了下来。它**过拟合**：训练准确率接近 100%，新数据上更差。")),
                   h(T('Stopping rules (pre-pruning)', '停止规则（预剪枝）')),
                   ul(T(r"All instances at the node share a class (pure leaf).", r"节点里所有样本同一类别（纯叶子）。"),
                      T(r"The gain (or gain ratio) of the best attribute is below a threshold $\theta$: very small improvements are not worth a split. The deck's version: stop if purity $> \tau$.", r"最好属性的增益（或增益率）低于阈值 $\theta$：很小的改进不值得再切。课件的说法：纯度 $> \tau$ 就停。"),
                      T(r"Too few instances at the node, or a maximum depth reached.", r"节点里样本太少，或达到最大深度。"),
                      T(r"**No attributes left** with mixed classes: fall back to the majority class (ties are unclear). This may be evidence that the attributes are insufficient for the problem.", r"**没有属性可用**但类别还是混的：退回多数类（平局怎么办不明确）。这也可能说明这些属性不足以解决问题。")),
                   h(T('Pruning (post-pruning)', '剪枝（后剪枝）')),
                   p(T(r"Grow the full tree, then cut back branches with few instances or small gains. Two textbook ways to decide: **reduced-error pruning** replaces a subtree by a leaf whenever accuracy on a held-out validation set does not drop; **cost-complexity pruning** minimises $R(T) + \alpha\,|\text{leaves}(T)|$, error plus a price per leaf. In both, the choice is made on data the tree did not see.",
                       r"先长成完整的树，再剪掉样本少或增益小的分支。教科书里决定怎么剪的两种做法：**降低错误剪枝**，只要留出的验证集上准确率没有下降，就把子树换成叶子；**代价复杂度剪枝**，最小化 $R(T) + \alpha\,|\text{叶子数}(T)|$，即误差加每片叶子的价格。两者都是在树没见过的数据上做决定。")),
                   quiz(T(r"A tree reaches 100% training accuracy and 72% validation accuracy. You prune it and get 95% training, 80% validation. What happened?", r"一棵树训练准确率 100%、验证准确率 72%。剪枝后训练 95%、验证 80%。发生了什么？"),
                        [(T(r"The pruned tree is worse: it lost training accuracy.", r"剪枝后的树更差：训练准确率下降了。"), T(r"Training accuracy of an overfitted tree is not the goal. The pruned tree generalises better, which is the point.", r"过拟合的树的训练准确率不是目标。剪枝后的树泛化更好，这才是目的。")),
                         (T(r"The full tree had memorised noise; the pruned tree removed it, which costs training accuracy but gains validation accuracy.", r"完整的树背下了噪声；剪枝去掉了它，训练准确率下降，验证准确率上升。"), True),
                         (T(r"The validation set must be wrong.", r"验证集一定出错了。"), T(r"A drop on training with a gain on held-out data is the normal signature of removing overfitting.", r"训练下降而留出数据上升，是去掉过拟合的典型特征。"))],
                        T(r"Judge pruning on held-out data. The point is not to fit the training set better.", r"剪枝要在留出数据上评判，而不是为了更好地拟合训练集。"))]),
            read('numeric', T('Numeric attributes: thresholds', '数值属性：阈值'),
                 p(T(r"A numeric attribute has no list of values to branch on, so the node asks a yes/no question: is $x \le t$? The tree is **binary**: left child for $x \le t$, right child for $x > t$. The algorithm finds the threshold $t$ with the best gain (or gain ratio). Only thresholds between neighbouring sorted values where the class changes need trying (midpoints).",
                     r"数值属性没有一串取值可供分支，所以节点问一个是非题：是否 $x \le t$？树是**二叉**的：$x \le t$ 进左孩子，$x > t$ 进右孩子。算法找增益（或增益率）最好的阈值 $t$。只需要试那些相邻排序值之间、类别发生变化的位置（取中点）。")),
                 p(T(r"The deck's income data (10 people; class: income $>$ 50K or $\le$ 50K). Edu-num takes values 9, 10, 13, so the candidate thresholds are $9.5$ and $11.5$. $H$ of the root: 4 of 10 are $>$ 50K, $H = %s$." % pf(ent([4, 6]), 3),
                     r"课件的收入数据（10 个人；类别：收入 $>$ 50K 或 $\le$ 50K）。Edu-num 取值 9、10、13，所以候选阈值是 $9.5$ 和 $11.5$。根节点的 $H$：10 个里 4 个 $>$ 50K，$H = %s$。" % pf(ent([4, 6]), 3))),
                 table([T('Threshold', '阈值'), T('Left (≤ t): >50K / ≤50K', '左（≤ t）：>50K / ≤50K'), T('Right: >50K / ≤50K', '右：>50K / ≤50K'), 'IG'],
                       ['9.5', '%d / %d' % tuple(EDU_95[1]), '%d / %d' % tuple(EDU_95[2]), pf(EDU_95[0], 3)],
                       ['11.5 (≤ 11)', '%d / %d' % tuple(EDU_115[1]), '%d / %d' % tuple(EDU_115[2]), pf(EDU_115[0], 3)]),
                 p(T(r"$t = 11$ wins: everyone with Edu-num $> 11$ (3 people) earns $> 50$K, a pure leaf. In the left child (7 people, one earner above 50K, aged 70), Age with $t = 65$ separates the last one: gain $%s$, and both leaves are pure. That is the deck's two-level tree." % pf(AGE_65[0], 3),
                     r"$t = 11$ 获胜：Edu-num $> 11$ 的 3 个人收入全部 $> 50$K，一个纯叶子。左孩子里（7 人，其中一个年龄 70 的收入高于 50K），按 Age 取 $t = 65$ 把最后一个分出来：增益 $%s$，两个叶子都纯。这就是课件的两层树。" % pf(AGE_65[0], 3))),
                 ul(T(r"Unlike a categorical attribute, a numeric one **can be reused** lower in the tree with another threshold.", r"和类别属性不同，数值属性**可以在树的更深处用另一个阈值再次使用**。"),
                    T(r"Cost: a split sees only an order, not distances, so some information about the numbers is lost (a listed con of trees).", r"代价：切分只用到顺序，不用数值间的距离，所以数字里的一些信息丢掉了（树的已知缺点之一）。"),
                    T(r"Beware of a numeric id-like attribute: with $N$ distinct values there are $N - 1$ thresholds to try, and the best one will look good by chance. The same many-values bias applies.", r"小心像编号一样的数值属性：$N$ 个不同取值就有 $N - 1$ 个阈值可试，最好的那个会碰巧看起来很好。同样的多取值偏差在这里也存在。"))),
            read('shape', T('The shape of a tree: axis-parallel boxes', '树的形状：与坐标轴平行的方块'),
                 p(T(r"Every question looks at one feature, so every split is a line parallel to an axis. The leaves of a tree on numeric features are **rectangles** (boxes in more dimensions). Left: the income tree. Right: the same tree as regions of the (Age, Edu-num) plane, with the ten training people.",
                     r"每个问题只看一个特征，所以每次切分都是平行于某根坐标轴的线。数值特征上树的叶子是**矩形**（高维里是方盒）。左：收入树。右：同一棵树在（Age, Edu-num）平面上划出的区域，以及十个训练样本。")),
                 svg(drawn(fig_income_tree), T('Left: the tree Edu-num <= 11, then Age <= 65, with leaves <=50K, >50K, >50K. Right: the same split as regions of the Age and Edu-num plane, two dashed axis-parallel lines, with the ten training points coloured by class.', '左：树 Edu-num <= 11，再 Age <= 65，叶子为 <=50K、>50K、>50K。右：同一次切分在 Age 与 Edu-num 平面上的区域，两条虚线与坐标轴平行；十个训练点按类别着色。')),
                 ul(T(r"**Good**: a boundary that depends on one feature at a time, or on combinations like “Edu-num high or Age very high”, is cheap.", r"**擅长**：边界一次只依赖一个特征，或像“Edu-num 高，或者 Age 非常大”这样的组合，代价很小。"),
                    T(r"**Awkward**: a diagonal boundary (like $x_1 + x_2 > 1$) needs a staircase of many axis-parallel steps. A linear model draws it with one line.", r"**不擅长**：斜的边界（比如 $x_1 + x_2 > 1$）需要许多与坐标轴平行的小台阶拼成阶梯；线性模型一条线就画出来了。"),
                    T(r"**Non-parametric**: there is no fixed set of numbers that defines the model. The depth, shape and number of leaves are set by the data: more data gives more leaves. (k-NN is also non-parametric; logistic regression has a fixed parameter count.)", r"**非参数**：没有一组固定的数来定义模型。深度、形状和叶子数由数据决定：数据越多，叶子越多。（k-NN 也是非参数的；逻辑回归的参数个数是固定的。）"),
                    T(r"**Unstable**: change a few training rows and the root may change, so the whole tree does. High variance, which is the opening for ensembles (random forests).", r"**不稳定**：改动几行训练数据，根节点可能就变了，整棵树随之改变。方差高，这正是集成方法（随机森林）的切入点。"))),
            read('regression', T('Deeper: regression trees, with a mean in each leaf', '深入：回归树，叶子里放均值'),
                 p(T(r"For a numeric target the same machinery works with two changes. A leaf predicts the **mean** of its training targets. And purity is measured by the **sum of squared residuals** (SSR) $\sum (y_i - \bar y)^2$ in each child instead of entropy: choose the split that reduces total SSR the most. Regression trees are binary, like trees on numeric features.",
                     r"目标是数值时，同一套机制只改两处。叶子预测其训练目标的**均值**。纯度用每个子节点里的**残差平方和**（SSR）$\sum (y_i - \bar y)^2$ 来量，而不是熵：选能让总 SSR 减少最多的切分。回归树是二叉的，和数值特征上的树一样。")),
                 p(T(r"The deck's incomes (in K): Edu-num $> 11$ holds 65, 90, 60, so the leaf is $(65 + 90 + 60)/3 = %s$. Edu-num $\le 11$ then splits on Age at 65: the seven others have ages $\le 65$ except one (income 55). The $\le 65$ leaf: $(30 + 50 + 40 + 45 + 45 + 35)/6 = %s$; the $> 65$ leaf: $55$." % (pf(mean(Y_R)), pf(mean(Y_LL))),
                     r"课件里的收入（单位 K）：Edu-num $> 11$ 的是 65、90、60，所以叶子是 $(65 + 90 + 60)/3 = %s$。Edu-num $\le 11$ 的再按 Age 在 65 处切：其余七人除一人（收入 55）外年龄都 $\le 65$。$\le 65$ 的叶子：$(30 + 50 + 40 + 45 + 45 + 35)/6 = %s$；$> 65$ 的叶子：$55$。" % (pf(mean(Y_R)), pf(mean(Y_LL))))),
                 table([T('Tree', '树'), T('Total SSR', '总 SSR')],
                       [T('no split (one leaf, mean %s)' % pf(mean(Y_ALL)), '不切分（一个叶子，均值 %s）' % pf(mean(Y_ALL))), pf(SSR_0, 1)],
                       [T('after Edu-num ≤ 11', '按 Edu-num ≤ 11 切分后'), pf(SSR_1, 1)],
                       [T('after also Age ≤ 65', '再按 Age ≤ 65 切分后'), pf(SSR_2, 1)]),
                 p(T(r"Each split lowers the SSR. As with classification, stopping rules and pruning decide when the improvement is too small. Next: why the leaf value is the mean.", r"每次切分都让 SSR 下降。和分类一样，由停止规则和剪枝来决定何时改进太小。下面：为什么叶子的值就是均值。"))),
            derive('mean-derive', T('Deeper: why a regression leaf predicts the mean', '深入：为什么回归叶子预测均值'),
                   [(r"S(c) = \sum_{i=1}^{n} (y_i - c)^2", T(r"A leaf must give one number $c$ for all $n$ instances that reach it. Its cost is the sum of squared residuals.", r"叶子要为到达它的 $n$ 个样本给出同一个数 $c$。它的代价是残差平方和。")),
                    (r"\dfrac{dS}{dc} = -2\sum_{i=1}^{n} (y_i - c)", T(r"Differentiate: the chain rule brings down the factor 2 and the inner derivative $-1$.", r"求导：链式法则带出系数 2 和内层导数 $-1$。")),
                    (r"-2\Bigl(\sum_i y_i - n\,c\Bigr) = 0", T(r"Set to zero (a parabola in $c$, so this is its minimum). Summing the constant $c$ over $n$ terms gives $nc$.", r"令其为零（$S$ 是关于 $c$ 的抛物线，所以这里是最小值）。把常数 $c$ 加 $n$ 次得 $nc$。")),
                    (r"c = \dfrac{1}{n}\sum_{i} y_i = \bar y", T(r"The best constant is the mean. This is why the leaf holds the mean, and why SSR is the matching purity measure: after choosing the mean, $S$ is exactly the variance times $n$.", r"最好的常数就是均值。这就是叶子里放均值的原因，也是 SSR 成为配套的纯度度量的原因：取了均值之后，$S$ 恰好是方差乘以 $n$。"))],
                   intro=T(r"The deck says a regression leaf outputs the mean. Show that the mean is the best single prediction under squared error.", r"课件说回归叶子输出均值。证明在平方误差下均值就是最好的单个预测。"),
                   skill=S('numeric')),
            read('proscons', T('Pros, cons and variants', '优缺点与变体'),
                 table([T('Pros', '优点'), T('Cons', '缺点')],
                       [T('Highly regarded among basic learners', '基础学习器里评价很高'), T('Prone to overfitting (grow until pure, memorise noise)', '容易过拟合（长到纯，把噪声背下来）')],
                       [T('Fast to train, even faster to predict', '训练快，预测更快'), T('Loses information on continuous variables (only order is used)', '连续变量上损失信息（只用到顺序）')],
                       [T('Very transparent: probably the most interpretable classifier', '非常透明：大概是最容易解释的分类器'), T('Complex calculation with many classes', '类别很多时计算复杂')],
                       [T('Works with mixed nominal and numeric features, needs no scaling', '名义与数值特征可混用，不需要缩放'), T('No guarantee of the globally optimal tree (greedy, NP-hard)', '不保证全局最优的树（贪心，NP 难）')],
                       [T('Selects features as it grows', '长的同时做特征选择'), T('Information gain is biased toward many-valued attributes', '信息增益偏向取值多的属性')]),
                 ul(T(r"**Oblivious decision trees**: the same attribute at every node of a layer (a compact, regular tree).", r"**遗忘决策树**（oblivious）：同一层所有节点用同一个属性（紧凑、规整的树）。"),
                    T(r"**Random tree**: each node sees only a random sample of the attributes, which helps against irrelevant attributes. It is the basis of the random forest (ensembles lesson).", r"**随机树**：每个节点只看属性的一个随机样本，有助于应付无关属性。它是随机森林的基础（集成学习一课）。"),
                    T(r"Compare with k-NN: both are non-parametric, but a tree is eager (the work is done once, at training) and k-NN is lazy.", r"和 k-NN 比较：两者都是非参数的，但树是积极学习（工作在训练时一次做完），k-NN 是惰性的。"))),
            number('p-ig', T('Practice: an information gain', '练习：一个信息增益'), S('entropy'),
                   T(r"A node has 8 instances: 4 yes and 4 no. Splitting on attribute $A$ gives child $a$: 3 yes, 1 no and child $b$: 1 yes, 3 no. What is the information gain in bits? Round to 3 decimals.",
                     r"一个节点有 8 个样本：4 个 yes、4 个 no。按属性 $A$ 切分，子节点 $a$：3 个 yes、1 个 no；子节点 $b$：1 个 yes、3 个 no。信息增益是多少比特？保留 3 位小数。"),
                   round(p_ig, 3),
                   T(r"$H(\text{node}) = 1$. $H(a) = H(b) = -\tfrac34\log_2\tfrac34 - \tfrac14\log_2\tfrac14 = %s$. Both children have weight $4/8$, so $H(R\mid A) = %s$ and $IG = 1 - %s = %s$." % (pf(ent([3, 1]), 3), pf(ent([3, 1]), 3), pf(ent([3, 1]), 3), pf(p_ig, 3)),
                     r"$H(\text{节点}) = 1$。$H(a) = H(b) = -\tfrac34\log_2\tfrac34 - \tfrac14\log_2\tfrac14 = %s$。两个子节点权重都是 $4/8$，所以 $H(R\mid A) = %s$，$IG = 1 - %s = %s$。" % (pf(ent([3, 1]), 3), pf(ent([3, 1]), 3), pf(ent([3, 1]), 3), pf(p_ig, 3))),
                   tolerance=0.002, chapter=T('Exam practice', '考试练习')),
            number('p-si', T('Practice: split information', '练习：分裂信息'), S('gainratio'),
                   T(r"An attribute with three values splits 8 instances into groups of 2, 2 and 4. What is its split information $SI$ in bits?", r"一个有三个取值的属性把 8 个样本分成 2、2、4 三组。它的分裂信息 $SI$ 是多少比特？"),
                   round(p_si, 3),
                   T(r"$SI = H(\tfrac14, \tfrac14, \tfrac12) = -2\cdot\tfrac14\log_2\tfrac14 - \tfrac12\log_2\tfrac12 = 1 + 0.5 = %s$. Then $GR = IG / SI$; for instance an information gain of 0.3 would give a gain ratio of $%s$." % (pf(p_si, 3), pf(0.3 / p_si, 3)),
                     r"$SI = H(\tfrac14, \tfrac14, \tfrac12) = -2\cdot\tfrac14\log_2\tfrac14 - \tfrac12\log_2\tfrac12 = 1 + 0.5 = %s$。然后 $GR = IG / SI$；比如增益 0.3 对应的增益率是 $%s$。" % (pf(p_si, 3), pf(0.3 / p_si, 3))),
                   tolerance=0.002),
            choice('p-id', T('Practice: the id attribute', '练习：id 属性'), S('gainratio'),
                   T(r"A data set has an attribute “customer id”, unique for every row. ID3 with information gain picks it at the root. What is the problem?", r"数据里有个“客户编号”属性，每行唯一。用信息增益的 ID3 把它选作根节点。问题在哪？"),
                   [(T(r"Its information gain is zero, so it should never be chosen.", r"它的信息增益是零，不该被选。"), T(r"The opposite: every child is pure, so the gain equals the whole class entropy, the maximum possible.", r"相反：每个子节点都纯，增益等于整个类别熵，是可能的最大值。"), 'ig-zero'),
                    (T(r"It splits perfectly, so the tree will generalise perfectly.", r"它切得完美，所以树的泛化也会完美。"), T(r"Perfect on training data only: a new customer has an unseen id, so the split says nothing about them.", r"只是对训练数据完美：新客户的编号没见过，这个切分对他们什么也说明不了。"), 'perfect-is-general'),
                    (T(r"Information gain is biased toward many-valued attributes; the tree memorises rows. Gain ratio reduces this, and the id should be removed.", r"信息增益偏向取值多的属性，树把每行背了下来。增益率可以缓解，而且该删掉这个 id。"), True),
                    (T(r"Information gain cannot handle nominal attributes.", r"信息增益处理不了名义属性。"), T(r"It handles them well; the problem is the number of values, not the type.", r"它处理得很好；问题在取值的个数，不在类型。"), 'wrong-type')],
                   T(r"Many values means tiny, trivially pure children. Split information penalises it ($\log_2 N$ for an id), and identifiers carry no generalisable information.", r"取值多就意味着很小、轻易就纯的子节点。分裂信息会惩罚它（id 是 $\log_2 N$），而且编号没有可推广的信息。")),
            choice('p-over', T('Practice: an overfitted tree', '练习：过拟合的树'), S('overfit'),
                   T(r"A fully grown tree has 100% training accuracy and 70% test accuracy. Which action most directly addresses this?", r"一棵完全长成的树，训练准确率 100%，测试准确率 70%。哪个做法最直接地解决问题？"),
                   [(T(r"Grow it deeper so it also fits the remaining noise.", r"长得更深，把剩下的噪声也拟合掉。"), T(r"It already fits all of the training data; deeper means more memorising.", r"它已经拟合了全部训练数据；更深只会背得更多。"), 'deeper'),
                    (T(r"Prune it, or stop earlier (a minimum gain, depth or leaf size), choosing the amount on validation data.", r"剪枝，或更早停止（最小增益、深度或叶子大小），并用验证数据决定程度。"), True),
                    (T(r"Switch from gain ratio to information gain.", r"从增益率换成信息增益。"), T(r"Information gain favours many-valued attributes, so it would typically make the fragmentation worse.", r"信息增益偏向取值多的属性，通常会让碎片化更严重。"), 'reverse'),
                    (T(r"Nothing: 100% training accuracy shows the tree is correct.", r"什么也不用做：训练准确率 100% 说明树是对的。"), T(r"Training accuracy of a tree that grows until pure is guaranteed and says nothing about new data.", r"长到纯为止的树，训练准确率是必然的，对新数据什么也说明不了。"), 'train-is-truth')],
                   T(r"The gap between 100% and 70% is overfitting. Restrict complexity and pick the setting on held-out data.", r"100% 与 70% 的差距就是过拟合。限制复杂度，并在留出数据上选定设置。")),
            text_q('p-explain', T('Practice: Section A, explain', '练习：A 部分，简答'), S('gainratio'),
                   T(r"Explain why information gain prefers attributes with many values, and how gain ratio addresses this.", r"解释为什么信息增益偏好取值多的属性，以及增益率怎样解决这个问题。"),
                   [T(r"many values give small subsets that are likely to be pure by chance, so conditional entropy is low and gain is high", r"取值多会产生小子集，很容易碰巧纯，所以条件熵低、增益高"),
                    T(r"this leads to fragmentation and overfitting (an id attribute gets the maximum gain but does not generalise)", r"导致碎片化与过拟合（id 属性得到最大增益却不能推广）"),
                    T(r"gain ratio divides the gain by the split information, the entropy of the partition, which is large for many evenly sized branches", r"增益率把增益除以分裂信息，即划分本身的熵，分支多而均匀时它很大")],
                   T(r"Information gain is the reduction in class entropy after splitting. An attribute with many values creates many small subsets, which are more likely to be pure by chance, so the conditional entropy is low and the gain high, even for an identifier that cannot generalise. This causes fragmentation and overfitting. Gain ratio divides the information gain by the split information, the entropy of how the instances are spread across the attribute's values. That is large for attributes with many evenly sized branches, so it penalises them.",
                     r"信息增益是切分之后类别熵的减少量。取值多的属性产生许多小子集，这些子集更容易碰巧纯，因此条件熵低、增益高，哪怕是一个无法推广的编号。这造成碎片化和过拟合。增益率把信息增益除以分裂信息，即样本在属性各取值上分布的熵。分支多而均匀时它很大，所以起到惩罚作用。"),
                   T(r"Say why many values look good (small pure subsets), the consequence (overfitting), and what the divisor is.", r"要写出为什么取值多看起来好（小而纯的子集）、后果（过拟合），以及除数是什么。")),
            text_q('p-design', T('Practice: Section C, design', '练习：C 部分，设计'), S('overfit'),
                   T(r"A bank wants a decision tree to predict loan default from age, income (numeric) and occupation (nominal, 40 values). Describe how the tree handles each type of attribute, which choices you make to avoid overfitting, and one reason the bank may prefer a tree to another model.",
                     r"一家银行想用决策树根据年龄、收入（数值）和职业（名义，40 个取值）预测贷款违约。说明树怎样处理每一类属性，你为避免过拟合做了哪些选择，以及银行可能偏好树而不是别的模型的一个理由。"),
                   [T(r"numeric: binary splits x <= t, threshold chosen by gain (or gain ratio); may be reused", r"数值：二叉切分 x <= t，阈值按增益（或增益率）选；可重复使用"),
                    T(r"nominal with 40 values: one branch per value, so use gain ratio (or group values) because information gain is biased to many values", r"40 个取值的名义属性：每个取值一条分支，应使用增益率（或合并取值），因为信息增益偏向取值多的"),
                    T(r"overfitting: stop early (min gain, depth, leaf size) or prune using validation data", r"过拟合：提早停止（最小增益、深度、叶子大小）或用验证数据剪枝"),
                    T(r"reason for trees: interpretable, transparent rules a customer or regulator can follow", r"选树的理由：可解释、透明，客户或监管者能看懂规则")],
                   T(r"For age and income the tree uses binary splits x <= t, trying thresholds between sorted values and keeping the one with the best information gain; the same attribute can be split again lower down. Occupation has 40 values, and plain information gain would favour it because of the many small branches, so I would use gain ratio or merge rare occupations into groups. To avoid overfitting I would not grow until the leaves are pure: I would set a minimum gain, maximum depth and minimum leaf size, or prune the full tree, with the amount chosen on a validation set. A bank may prefer a tree because its decisions are transparent rules that can be explained to customers and regulators.",
                     r"对年龄和收入，树使用二叉切分 x <= t，在排序后相邻取值之间试阈值，保留信息增益最好的；同一属性在更深处可以再次切分。职业有 40 个取值，普通信息增益会因为分支多而小偏向它，所以我用增益率，或把稀有职业合并成组。为避免过拟合，我不会长到叶子全纯：设定最小增益、最大深度和最小叶子大小，或对完整的树剪枝，程度在验证集上选定。银行可能偏好树，因为它的决策是透明的规则，能向客户和监管者解释。"),
                   T(r"Four marks: numeric handling, the many-valued nominal attribute, a concrete overfitting control, a reason for trees.", r"四项给分：数值属性的处理、多取值名义属性、具体的过拟合控制、选树的理由。")),
            read('remember', T('What to remember', '要记住的'),
                 math_(r"H(X) = -\sum_x P(x)\log_2 P(x), \quad IG(R,A) = H(R) - \sum_a P(a)H(R\mid A=a), \quad GR = \frac{IG}{H(A)}"),
                 ul(T(r"**ID3**: recursive divide and conquer, greedy, no backtracking, not globally optimal (NP-hard). Choose the attribute with the highest information gain, one branch per value, stop at pure nodes, no attributes, or small gain.", r"**ID3**：递归分治，贪心、不回溯、不保证全局最优（NP 难）。选信息增益最大的属性，每个取值一条分支，在纯节点、没有属性或增益很小时停止。"),
                    T(r"**Entropy** is 0 for a pure node, $\log_2 m$ at most. **IG = mutual information** $\ge 0$, $= 0$ iff independent, $\le H(A)$. Golf: $H = 0.940$; IG Outlook 0.247, Humidity 0.152, Windy 0.048, Temp 0.029; Outlook is the root.", r"**熵**：纯节点为 0，最大 $\log_2 m$。**IG = 互信息** $\ge 0$，独立时 $= 0$，$\le H(A)$。高尔夫：$H = 0.940$；Outlook 0.247、Humidity 0.152、Windy 0.048、Temp 0.029；Outlook 作根。"),
                    T(r"**Weakness of IG**: bias to many values, fragmentation, overfitting. **Gain ratio** $= IG/SI$ with $SI = H(A)$. Outlook: $SI = 1.577$, $GR = 0.156$.", r"**IG 的弱点**：偏向多取值、碎片化、过拟合。**增益率** $= IG/SI$，$SI = H(A)$。Outlook：$SI = 1.577$，$GR = 0.156$。"),
                    T(r"**Overfitting**: stop early (min gain, depth, leaf size) or prune (reduced-error, cost-complexity) on validation data.", r"**过拟合**：提早停止（最小增益、深度、叶子大小），或在验证数据上剪枝（降低错误、代价复杂度）。"),
                    T(r"**Numeric**: binary splits $x \le t$, best threshold between sorted values, reusable. **Regression tree**: SSR criterion, leaf = mean (it minimises squared error), binary.", r"**数值**：二叉切分 $x \le t$，在排序值之间找最佳阈值，可重复使用。**回归树**：SSR 准则，叶子 = 均值（它最小化平方误差），二叉。"),
                    T(r"**Boundary**: axis-parallel boxes; diagonal boundaries are awkward. **Non-parametric**, interpretable, fast, unstable. Variants: oblivious trees, random trees (random forest). Baselines: Zero-R (majority), One-R (stump).", r"**边界**：与坐标轴平行的方块；斜边界不擅长。**非参数**、可解释、快、不稳定。变体：遗忘决策树、随机树（随机森林）。基线：Zero-R（多数类）、One-R（树桩）。")),
                 chapter=T('Review sheet', '复习单')),
        ],
    )


LESSONS = [L_knn, L_trees]
