# COMP90049 lessons 'naive-bayes' (deck 06) and 'linreg' (deck 07). Every number of a worked example is computed
# here (Fractions for the counting, floats for logs and densities), never typed by hand.
import math
from fractions import Fraction as Fr

from ml_kit import *  # noqa: F403

# ================================================================== naive Bayes: the deck's data and the arithmetic
FEATS = ['headache', 'cough', 'temp', 'sore']
VALS = {'headache': ['severe', 'mild', 'no'], 'cough': ['mild', 'severe'], 'temp': ['high', 'normal'], 'sore': ['yes', 'no']}
DATA = [('severe', 'mild', 'high', 'yes', 'Flu'), ('mild', 'severe', 'normal', 'yes', 'Cold'), ('severe', 'mild', 'normal', 'yes', 'Flu'),
        ('no', 'mild', 'normal', 'no', 'Cold'), ('severe', 'severe', 'normal', 'yes', 'Flu')]
CLASSES = ['Flu', 'Cold']


def n_cls(c): return sum(1 for r in DATA if r[4] == c)
def prior(c): return Fr(n_cls(c), len(DATA))


def lik(f, v, c, alpha=0):
    """P(feature f = v | class c) by counting, with add-alpha smoothing (alpha = 0: maximum likelihood)."""
    i = FEATS.index(f)
    cnt = sum(1 for r in DATA if r[4] == c and r[i] == v)
    return Fr(cnt + alpha, n_cls(c) + alpha * len(VALS[f]))


def score(c, x, alpha=0):
    s = prior(c)
    for f, v in zip(FEATS, x):
        s *= lik(f, v, c, alpha)
    return s


def tq(id, title, skill, prompt, kp, ma, explain):
    """A short-answer question: the exam is in English, so key points and model answer are English in both languages."""
    return text_q(id, title, skill, prompt, [T(k, k) for k in kp], T(ma, ma), explain)


def tf(q):
    """A Fraction as TeX."""
    q = Fr(q)
    if q.denominator == 1: return str(q.numerator)
    return r'\frac{%d}{%d}' % (q.numerator, q.denominator)


def fl(q, d=4): return f'{float(q):.{d}f}'.rstrip('0').rstrip('.') if float(q) != int(float(q)) else str(int(float(q)))


ANN = ('mild', 'mild', 'normal', 'yes')
BOB = ('severe', 'mild', 'high', 'no')
CARL = ('mild', 'severe', 'normal', 'yes')
ann_flu, ann_cold = score('Flu', ANN), score('Cold', ANN)
assert ann_flu == 0 and ann_cold == Fr(1, 20)
assert score('Flu', BOB) == 0 and score('Cold', BOB) == 0


def prod_tex(c, x, alpha=0):
    return r' \cdot '.join([tf(prior(c))] + [tf(lik(f, v, c, alpha)) for f, v in zip(FEATS, x)])


bob_flu_a, bob_cold_a = score('Flu', BOB, 1), score('Cold', BOB, 1)
carl_flu, carl_cold = score('Flu', CARL, 1), score('Cold', CARL, 1)
carl_post_cold = carl_cold / (carl_flu + carl_cold)
ann_ln = math.log(0.05)
CNT_H = {v: sum(1 for r in DATA if r[4] == 'Flu' and r[0] == v) for v in VALS['headache']}

# the counting problem of slide 8
NEED_2_20 = 2 * 2 ** 20
NEED_4_3_60 = 4 * 3 ** 60
POW = int(math.floor(math.log10(NEED_4_3_60)))

# underflow
under = 1.0
for _ in range(1000): under *= 1e-3
assert under == 0.0
LN_1000 = 1000 * math.log(1e-3)

# Gaussian NB on the deck's numeric example (slide 32)
G_HEAD = {'Flu': [0.8, 0.5, 0.9], 'Cold': [0.0, 0.3]}


def g_fit(v):
    mu = sum(v) / len(v)
    return mu, math.sqrt(sum((a - mu) ** 2 for a in v) / len(v))   # the deck divides by n (the maximum likelihood estimate)


def g_pdf(x, mu, s): return math.exp(-0.5 * ((x - mu) / s) ** 2) / math.sqrt(2 * math.pi * s * s)


MU_F, S_F = g_fit(G_HEAD['Flu'])
MU_C, S_C = g_fit(G_HEAD['Cold'])
PDF_F, PDF_C = g_pdf(0.8, MU_F, S_F), g_pdf(0.8, MU_C, S_C)

# log-odds example: two binary features (word 1 present, word 2 present), spam vs ham
PS, PH = 0.4, 0.6
P1S, P1H, P2S, P2H = 0.8, 0.2, 0.3, 0.6
W1 = math.log(P1S * (1 - P1H) / (P1H * (1 - P1S)))
W2 = math.log(P2S * (1 - P2H) / (P2H * (1 - P2S)))
B0 = math.log(PS / PH) + math.log((1 - P1S) / (1 - P1H)) + math.log((1 - P2S) / (1 - P2H))


def nb_logodds(x1, x2):
    f = lambda p, x: p if x else 1 - p
    return math.log(PS * f(P1S, x1) * f(P2S, x2)) - math.log(PH * f(P1H, x1) * f(P2H, x2))


for a in (0, 1):
    for b in (0, 1):
        assert abs(nb_logodds(a, b) - (B0 + W1 * a + W2 * b)) < 1e-12
LO_10 = B0 + W1
P_10 = 1 / (1 + math.exp(-LO_10))

# a word counted k times
DUP = [(k, 4 ** k / (1 + 4 ** k)) for k in (1, 2, 3, 5)]

# the parameter counts
NB_PARAMS_20 = 2 * 20 + 1
JOINT_PARAMS_20 = 2 * (2 ** 20 - 1) + 1


def fig_nb_model(lang):
    f = Fig(640, 270, lang)
    f.rect(240, 22, 160, 54, fill='#eef2fd', stroke=BLUE, sw=2, rx=27)
    f.text(320, 57, f.L('class y', '类别 y'), 20, BLUE, 'middle', 'bold')
    xs = [90, 230, 410, 550]
    for i, x in enumerate(xs):
        f.line(320, 76, x, 178, MUTED, 2, arrow=True)
        f.rect(x - 52, 180, 104, 52, fill='#ffffff', stroke=INK, sw=2, rx=26)
        f.text(x, 214, f'x_{{{i + 1}}}' if i < 3 else 'x_{F}', 20, INK, 'middle')
    f.text(320, 214, '···', 22, MUTED, 'middle')
    f.text(120, 120, f.L('P(x_{1}|y)', 'P(x_{1}|y)'), 16, ORANGE)
    f.text(430, 120, 'P(x_{F}|y)', 16, ORANGE)
    f.text(320, 258, f.L('no arrows between the features', '特征之间没有箭头'), 15, MUTED, 'middle')
    return f.svg()


def L_naive_bayes():
    P, EX, SM, GA, LG, LIN, PC = 'nb.derivation', 'nb.independence', 'nb.smoothing', 'nb.gaussian', 'nb.logspace', 'nb.linear', 'nb.proscons'
    EST = 'nb.estimation'
    flu_tbl = []
    for f in FEATS:
        for v in VALS[f]:
            flu_tbl.append([f'{f} = {v}', tf_s(lik(f, v, 'Flu')), tf_s(lik(f, v, 'Cold'))])
    steps = [
        # ------------------------------------------------------------ 1 what it is for
        read('what', T('The idea: classify by counting, and what counting needs', '想法：靠计数来分类，以及计数需要什么'),
             p(T(r"Given a new instance $\mathbf{x}$ (a bundle of feature values), which class $y$ is most likely? In probability language: pick $\hat y = \arg\max_y P(y \mid \mathbf{x})$. Naive Bayes is the classifier you get when you estimate that probability in the most frugal way possible.",
                 r"给一个新实例 $\mathbf{x}$（一组特征取值），哪个类别 $y$ 最可能？用概率的话说：取 $\hat y = \arg\max_y P(y \mid \mathbf{x})$。朴素贝叶斯就是用最省的办法去估计这个概率得到的分类器。")),
             p(T(r"The obvious way: look in the training data for instances **identical** to $\mathbf{x}$ and take the commonest class among them. The deck's three thought experiments show where this works and where it fails:",
                 r"最直接的办法：在训练数据里找和 $\mathbf{x}$ **完全一样**的实例，取其中最多的类别。课件的三个小实验说明它什么时候行、什么时候不行：")),
             table([T('Data', '数据'), T('Query', '要预测的'), T('What counting says', '计数的结论')],
                   [T('8 identical rows say yes, 1 row says no', '8 行相同的都说 yes，1 行说 no'), T('the same attributes as the 8 rows', '和那 8 行属性相同'), T('yes: plenty of evidence', 'yes：证据充分')],
                   [T('3 identical rows yes, 3 identical rows no', '3 行相同的 yes，3 行相同的 no'), T('those attributes', '这组属性'), T('a tie: yes and no equally likely', '平局：yes 和 no 一样可能')],
                   [T('no row matches the query at all', '没有任何一行和查询相同'), T('overcast, mild, high, not windy', 'overcast、mild、high、无风'), T('nothing to count: we must generalise from similar rows', '没得数：只能从相似的行去推广')]),
             p(T(r"The third case is the normal one. With $F$ attributes of $V$ values each and $C$ classes you would need to see every combination a few times, about $C\,V^F$ instances: for 20 binary attributes and 2 classes that is %s (over two million); for 60 three-valued attributes and 4 classes about $10^{%d}$. No data set is that big, so exact-match counting only works for instances we have already seen." % (f'{NEED_2_20:,}', POW),
                 r"第三种才是常态。$F$ 个属性、每个 $V$ 个取值、$C$ 个类别，每种组合都要见到几次，大约需要 $C\,V^F$ 个实例：20 个二值属性、2 个类别就是 %s（两百多万）；60 个三值属性、4 个类别大约 $10^{%d}$。没有数据集有这么大，所以“找完全相同的”只对见过的实例有用。" % (f'{NEED_2_20:,}', POW))),
             p(T(r"Naive Bayes's answer: do not count whole instances, count **one attribute at a time** and combine. The price is one assumption, and the whole lesson is about what it buys, what it costs, and how to repair its worst side effect (zero probabilities).",
                 r"朴素贝叶斯的办法：不数整个实例，而是**一次只数一个属性**，再把它们合起来。代价是一个假设；这一课讲它换来了什么、花掉了什么，以及怎么修补它最大的副作用（零概率）。")),
             quiz(T(r"A problem has 30 binary attributes and 2 classes. About how many training instances does exact-match counting need (at least one per combination)?", r"一个问题有 30 个二值属性、2 个类别。“完全匹配”式计数至少要多少训练实例（每种组合至少一个）？"),
                  [(T(r"$2 \times 30 = 60$", r"$2 \times 30 = 60$"), T(r"That counts the parameters of a model that treats attributes separately. Exact matching needs one instance per combination of values: $V^F$, not $V \times F$.", r"这是把属性分开处理时的参数个数。完全匹配要每种取值组合各一个，是 $V^F$，不是 $V \times F$。")),
                   (T(r"$2 \times 2^{30} \approx 2 \times 10^9$", r"$2 \times 2^{30} \approx 2 \times 10^9$"), True),
                   (T(r"$30^2 = 900$", r"$30^2 = 900$"), T(r"The number of combinations grows exponentially in the number of attributes, not as a square.", r"组合数随属性个数指数增长，不是平方。"))],
                  T(r"$C\,V^F = 2 \cdot 2^{30}$: every added attribute doubles the need. This is the curse that the independence assumption removes.", r"$C\,V^F = 2 \cdot 2^{30}$：每多一个属性，需求翻一倍。独立性假设要消灭的就是这个“维度灾难”。")),
             chapter=T('The model', '模型')),
        # ------------------------------------------------------------ 2 the derivation
        derive('derivation', T('From argmax P(y|x) to the naive Bayes rule', '从 argmax P(y|x) 推到朴素贝叶斯公式'),
               [(r"\hat y = \arg\max_{y} P(y \mid \mathbf{x})", T(r"The goal: among the classes, pick the one with the highest probability **given what we observed**. The trouble is that $P(y \mid \mathbf{x})$, a probability of a class given a whole bundle, cannot be counted (previous page).", r"目标：在所有类别里，选“在观察到 $\mathbf{x}$ 之后”概率最高的那个。麻烦是 $P(y \mid \mathbf{x})$ 是“给定整个特征组合时类别的概率”，数不出来（上一页）。")),
                (r"= \arg\max_{y} \frac{P(y)\,P(\mathbf{x} \mid y)}{P(\mathbf{x})}", T(r"Bayes' rule turns the question around: instead of *class given features*, we need *features given class* ($P(\mathbf{x} \mid y)$, the **likelihood**) and how common each class is ($P(y)$, the **prior**). Both are easier to count: fix the class, then look only at its instances.", r"贝叶斯公式把问题倒过来：不问“给定特征的类别”，而问“给定类别的特征”（$P(\mathbf{x} \mid y)$，**似然**）和各类别本身有多常见（$P(y)$，**先验**）。两者都好数：先固定类别，只看它的实例。"),
                 T(r"$P(\mathbf{x}\mid y)P(y) = P(\mathbf{x}, y) = P(y\mid \mathbf{x})P(\mathbf{x})$: the same joint probability written two ways. Divide by $P(\mathbf{x})$.", r"$P(\mathbf{x}\mid y)P(y) = P(\mathbf{x}, y) = P(y\mid \mathbf{x})P(\mathbf{x})$：同一个联合概率的两种写法，两边除以 $P(\mathbf{x})$。")),
                (r"= \arg\max_{y} P(y)\,P(\mathbf{x} \mid y)", T(r"Drop the denominator. $P(\mathbf{x})$, the probability of the evidence, does not contain $y$: it is the same number for every class, so it cannot change which class wins. (The scores that remain are no longer probabilities; to get probabilities divide each score by their sum.)", r"去掉分母。$P(\mathbf{x})$（证据本身的概率）里没有 $y$：对每个类别都是同一个数，改变不了谁最大。（剩下的分数不再是概率；想要概率，把每个分数除以它们的和。）")),
                (r"P(\mathbf{x} \mid y) = \prod_{m=1}^{F} P(x_m \mid x_1, \dots, x_{m-1}, y)", T(r"Still infeasible: $P(x_1, \dots, x_F \mid y)$ needs the whole bundle. The chain rule of probability is always true and splits it into one factor per feature, but the factor for $x_m$ still conditions on **all earlier features** as well as on $y$.", r"还是不可行：$P(x_1, \dots, x_F \mid y)$ 要整个组合。概率的链式法则永远成立，能把它拆成每个特征一个因子，但 $x_m$ 的因子仍然要以**前面所有特征**和 $y$ 为条件。")),
                (r"P(x_m \mid x_1, \dots, x_{m-1}, y) \;\approx\; P(x_m \mid y)", T(r"The naive assumption, the only approximation in the whole derivation: **once the class is known, the other features tell us nothing more about $x_m$**. Features are conditionally independent given the class. Each factor shrinks to a small table: one attribute against the class.", r"朴素假设，整个推导里唯一的近似：**类别一旦已知，其他特征就不再提供关于 $x_m$ 的信息**。给定类别，特征条件独立。每个因子缩成一张小表：一个属性对着类别。")),
                (r"\hat y = \arg\max_{y} P(y) \prod_{m=1}^{F} P(x_m \mid y)", T(r"The naive Bayes classifier: for each class multiply its prior by one likelihood per observed feature value, and choose the class with the largest product.", r"朴素贝叶斯分类器：对每个类别，把它的先验乘上每个观察到的特征取值各一个似然，取乘积最大的类别。"))],
               intro=T(r"Four moves, one of them an approximation. Watch which one.", r"四步，其中一步是近似。注意看是哪一步。"),
               outro=T(r"Only the fifth line is an assumption; everything else is exact. Note also what the assumption does *not* say: features need not be independent of each other overall, only independent **given the class** (next page).", r"只有第五行是假设，其余都是精确的。也要注意它**没有**说什么：特征整体上不必相互独立，只需要**给定类别**后独立（下一页）。"),
               skill=P),
        read('independence', T('The independence assumption: what it says and what it buys', '独立性假设：它说了什么，换来什么'),
             svg(drawn(fig_nb_model), T('Class y with arrows to features x1 ... xF; no arrows between features.', '类别 y 指向特征 x1 ... xF；特征之间没有箭头。')),
             p(T(r"The picture is the assumption: the class is the only parent of every feature. If you know $y$, the features are separate coin flips. If you do not know $y$, they are linked *through* $y$: in spam mail, seeing \"prize\" makes \"winner\" likelier because both signal spam. Conditional independence kills exactly that link once $y$ is given.",
                 r"这张图就是假设：类别是每个特征唯一的“父亲”。知道了 $y$，各特征就是互不相干的抛硬币；不知道 $y$，它们经由 $y$ 相连：垃圾邮件里看到 “prize” 会让 “winner” 更可能，因为两者都在暗示垃圾邮件。条件独立正好在给定 $y$ 后切断这条联系。")),
             callout('note', T('Exam wording: the step from the joint to the product', '考试里的说法：从联合到乘积这一步'),
                     T(r"The step $P(x_1, \dots, x_F \mid y) = \prod_m P(x_m \mid y)$ **implies** that, within one class, knowing some features' values does not change the probability of another feature's value. It **buys** a model of $F$ small tables per class instead of one table with $V^F$ cells, so it can be estimated from little data. It **costs** accuracy of the probabilities when features are in fact correlated within a class.",
                       r"从 $P(x_1, \dots, x_F \mid y)$ 到 $\prod_m P(x_m \mid y)$ 这一步，**意味着**：在同一类别内，知道某些特征的取值不会改变另一个特征取值的概率。它**换来**每个类别 $F$ 张小表，而不是一张有 $V^F$ 格的大表，所以少量数据就能估计。它**花掉**的是：特征在类内其实相关时，概率就不准了。")),
             table([T('Parameters to estimate', '要估计的参数个数'), T('Full joint $P(\\mathbf{x} \\mid y)$', '完整联合 $P(\\mathbf{x} \\mid y)$'), T('Naive Bayes', '朴素贝叶斯')],
                   [T('2 classes, 20 binary attributes', '2 个类别、20 个二值属性'), f'{JOINT_PARAMS_20:,}', f'{NB_PARAMS_20}'],
                   [T('in general (per class)', '一般情形（每类）'), r'$V^F - 1$', r'$F(V - 1)$']),
             p(T(r"The deck lists the other things naive Bayes assumes: the training instances are independent of each other, and the training and test data come from the **same distribution**. These are not specific to naive Bayes; most of the course assumes them.",
                 r"课件还列出朴素贝叶斯的其他假设：训练实例彼此独立，训练与测试数据来自**同一个分布**。这些并不是朴素贝叶斯独有的，这门课里大多数方法都默认它们。")),
             quiz(T('Which statement is the naive Bayes assumption?', '哪一条才是朴素贝叶斯的假设？'),
                  [(T('All features are independent of each other, always', '所有特征无条件地相互独立'), T(r"That is marginal independence, a much stronger claim and usually false. Naive Bayes only needs independence **given the class**.", r"这是无条件（边缘）独立，强得多，通常是假的。朴素贝叶斯只要求**给定类别**后独立。")),
                   (T('Given the class, features are independent of each other', '给定类别，特征之间相互独立'), True),
                   (T('The class does not depend on the features', '类别不依赖于特征'), T(r"Then classification would be pointless: the features are exactly what carry information about the class.", r"那分类就没意义了：特征正是承载类别信息的东西。"))],
                  T(r"Conditional independence given $y$: $P(x_1, x_2 \mid y) = P(x_1 \mid y)P(x_2 \mid y)$, while in general $P(x_1, x_2) \ne P(x_1)P(x_2)$.", r"给定 $y$ 的条件独立：$P(x_1, x_2 \mid y) = P(x_1 \mid y)P(x_2 \mid y)$，而一般 $P(x_1, x_2) \ne P(x_1)P(x_2)$。"))),
        read('generative', T('Why naive Bayes is a generative model', '为什么朴素贝叶斯是生成式模型'),
             p(T(r"Read the formula $P(y)\prod_m P(x_m \mid y)$ as a recipe for **making** an instance: first draw a class $y$ from the prior; then, given that class, draw each feature independently from its own table. That is the generative story. Multiplying out the recipe gives the **joint** distribution $P(\mathbf{x}, y)$ and classification is Bayes' rule on top.",
                 r"把公式 $P(y)\prod_m P(x_m \mid y)$ 读成“造”一个实例的配方：先按先验抽一个类别 $y$；再在该类别下，让每个特征从自己的表里各自独立地抽。这就是生成故事。把配方乘起来得到的是**联合**分布 $P(\mathbf{x}, y)$，分类则是在它上面用一次贝叶斯公式。")),
             table(['', T('Generative (naive Bayes)', '生成式（朴素贝叶斯）'), T('Discriminative (logistic regression, trees, k-NN)', '判别式（逻辑回归、决策树、k-NN）')],
                   [T('Models', '建模对象'), r'$P(\mathbf{x}, y) = P(y)P(\mathbf{x} \mid y)$', T(r'$P(y \mid \mathbf{x})$, or the boundary directly', r'$P(y \mid \mathbf{x})$，或直接建边界')],
                   [T('Can it generate data?', '能生成数据吗'), T('yes: sample $y$ then $\\mathbf{x}$', '能：先抽 $y$ 再抽 $\\mathbf{x}$'), T('no', '不能')],
                   [T('Uses the data for', '把数据用来'), T('describing how each class looks', '描述每个类别长什么样'), T('separating the classes', '把类别分开')],
                   [T('Typical strength', '典型优势'), T('little data, missing values, fast', '数据少、有缺失值、快'), T('usually more accurate with lots of data', '数据多时通常更准')]),
             p(T(r"Being generative is also why naive Bayes handles **missing values** gracefully: to ignore an unobserved feature, just leave its factor out of the product (summing it out of a model whose features are independent gives 1).",
                 r"生成式还有一个好处：能自然处理**缺失值**。要忽略一个没观察到的特征，只需把它那一项从乘积里去掉（对特征相互独立的模型把它求和消去，得到的就是 1）。"))),
        # ------------------------------------------------------------ estimation
        read('estimate', T('Training: the parameters are counts', '训练：参数就是计数'),
             p(T(r"The model has two kinds of numbers, both read off the training table by counting ($n(\cdot)$ is the number of training instances that satisfy the condition inside):", r"模型里有两类数，都从训练表里数出来（$n(\cdot)$ 表示满足括号内条件的训练实例个数）：")),
             math_(r"P(y = k) = \frac{n(y = k)}{N}, \qquad P(x_m = j \mid y = k) = \frac{n(x_m = j,\; y = k)}{n(y = k)}"),
             ul(T(r"**Prior** $P(y=k)$: the share of the training instances that have class $k$.", r"**先验** $P(y=k)$：训练实例里类别为 $k$ 的占比。"),
                T(r"**Likelihood** $P(x_m = j \mid y = k)$: among the instances of class $k$ only, the share whose feature $m$ equals $j$. The denominator is the class count, not $N$.", r"**似然** $P(x_m = j \mid y = k)$：只在类别 $k$ 的实例里，特征 $m$ 取 $j$ 的占比。分母是该类别的个数，不是 $N$。")),
             p(T(r"The distribution used for each factor depends on the attribute. The class prior is Bernoulli for 2 classes and categorical for $C$ classes. A feature given its class is Bernoulli (two values), categorical ($V$ values) or Gaussian (a number):",
                 r"每个因子用什么分布，取决于属性。类别先验：2 类用伯努利，$C$ 类用类别分布（categorical）。给定类别的特征：伯努利（两个取值）、类别分布（$V$ 个取值）或高斯（连续数值）：")),
             table([T('Feature type', '特征类型'), T('Distribution of $P(x_m \\mid y)$', '$P(x_m \\mid y)$ 的分布'), T('Parameters, per class and feature', '每个类别、每个特征的参数')],
                   [T('binary', '二值'), r'$p^{x_m}(1-p)^{1-x_m}$', r'$p_{m,k}$'],
                   [T('categorical, $V$ values', '类别型，$V$ 个取值'), r'$\prod_{j} p_{m,k,j}^{[x_m = j]}$', T(r'$p_{m,k,1}, \dots, p_{m,k,V}$, summing to 1', r'$p_{m,k,1}, \dots, p_{m,k,V}$，和为 1')],
                   [T('numeric', '数值'), r'$\frac{1}{\sqrt{2\pi\sigma^2_{m,k}}}\exp\!\big(-\frac{(x_m-\mu_{m,k})^2}{2\sigma^2_{m,k}}\big)$', r'$\mu_{m,k},\ \sigma_{m,k}$']),
             p(T(r"Why are the relative frequencies the right values? Because they are the maximum likelihood estimates; the next derivation shows it, and the deck's own binomial spam example is the two-valued special case (20 spam out of 100 emails gives $\hat\theta = 0.2$).",
                 r"为什么相对频率就是对的取值？因为它们是最大似然估计；下一页推导给出证明，课件里的二项垃圾邮件例子就是两个取值的特例（100 封里 20 封垃圾邮件，$\hat\theta = 0.2$）。"))),
        derive('mle', T('Why counting is maximum likelihood', '为什么计数就是最大似然'),
               [(r"\log P(D) = \sum_{i} \Big[\log P(y_i) + \sum_{m} \log P(x_{im} \mid y_i)\Big]", T(r"Under the naive Bayes model and independent instances, the log-likelihood of the training data is a **sum of separate terms**: one for the class prior, and one for each (feature, class) pair.", r"在朴素贝叶斯模型和实例独立的前提下，训练数据的对数似然是**一堆互不相干的项之和**：一项是类别先验，其余每个（特征，类别）一项。")),
                (r"\ell(\mathbf{p}) = \sum_{j=1}^{V} n_j \log p_j \quad \big(\textstyle\sum_{j} p_j = 1\big)", T(r"Because the terms do not share parameters, we can maximise each alone. Take one: feature $m$ within class $k$. Among the $n = n(y=k)$ instances, value $j$ occurred $n_j$ times, and each occurrence contributes $\log p_j$. The constraint says the $p_j$ form a distribution.", r"各项不共享参数，所以可以逐项单独最大化。取其中一项：类别 $k$ 内的特征 $m$。在 $n = n(y=k)$ 个实例里，取值 $j$ 出现了 $n_j$ 次，每次贡献 $\log p_j$。约束说的是 $p_j$ 构成一个分布。")),
                (r"\mathcal{L} = \sum_{j} n_j \log p_j - \lambda\Big(\sum_{j} p_j - 1\Big)", T(r"Handle the constraint with a Lagrange multiplier $\lambda$: add $\lambda$ times the constraint violation, then set all derivatives to zero.", r"用拉格朗日乘子 $\lambda$ 处理约束：加上 $\lambda$ 乘以约束的偏差，再令所有导数为零。")),
                (r"\frac{\partial \mathcal{L}}{\partial p_j} = \frac{n_j}{p_j} - \lambda = 0", T(r"Derivative with respect to one $p_j$: only the $j$-th term of each sum depends on it.", r"对某个 $p_j$ 求导：两个和里只有第 $j$ 项含它。")),
                (r"p_j = \frac{n_j}{\lambda}", T(r"So every $p_j$ is proportional to its count $n_j$. The remaining question is the proportionality constant.", r"所以每个 $p_j$ 都与它的计数 $n_j$ 成正比。剩下的是比例常数。")),
                (r"1 = \sum_j p_j = \frac{\sum_j n_j}{\lambda} = \frac{n}{\lambda} \;\Rightarrow\; \lambda = n", T(r"The probabilities must add to 1, and the counts add to $n$.", r"概率之和必须为 1，而计数之和是 $n$。")),
                (r"\hat p_j = \frac{n_j}{n} = \frac{n(x_m = j,\, y = k)}{n(y = k)}", T(r"The maximum likelihood estimate is the relative frequency, exactly the recipe of the previous page. The class prior is the same derivation with the class counts: $\hat P(y=k) = n(y=k)/N$.", r"最大似然估计就是相对频率，正是上一页的做法。类别先验是同样的推导，只是用类别计数：$\hat P(y=k) = n(y=k)/N$。"))],
               intro=T(r"Counting feels obvious; here is why it is also optimal, so that the zero counts later can be understood as a flaw of *maximum likelihood*, not of arithmetic.", r"计数看着理所当然；这里说明它为什么也是最优的，这样后面的零计数就能被理解为**最大似然**的毛病，而不是算术的毛病。"),
               outro=T(r"A zero count gives $\hat p_j = 0$: maximum likelihood is certain that anything unseen is impossible. Keep that in mind for smoothing.", r"计数为零就得到 $\hat p_j = 0$：最大似然断定没见过的东西不可能发生。带着这一点去看平滑。"),
               skill=EST),
        # ------------------------------------------------------------ worked example
        read('example', T('The deck\'s example: flu or cold?', '课件的例子：流感还是感冒？'),
             table([r'id', T('Headache', '头痛'), T('Cough', '咳嗽'), T('Temperature', '体温'), T('Sore', '喉痛'), T('Diagnosis', '诊断')],
                   *[[str(i + 1)] + list(r) for i, r in enumerate(DATA)]),
             p(T(r"In the formulas below, F stands for Flu and C for Cold. **Training** is counting. Priors: $P(\text{F}) = %s$, $P(\text{C}) = %s$. Likelihoods (each is a count in the class over the class count; Flu has 3 instances, Cold has 2):"
                 % (tf(prior('Flu')), tf(prior('Cold'))),
                 r"下面的公式里，F 代表 Flu，C 代表 Cold。**训练**就是计数。先验：$P(\text{F}) = %s$，$P(\text{C}) = %s$。似然（每个都是类内计数除以类别个数；Flu 有 3 个实例，Cold 有 2 个）："
                 % (tf(prior('Flu')), tf(prior('Cold'))))),
             table([T('Feature = value', '特征 = 取值'), r'$P(\cdot \mid \text{F})$', r'$P(\cdot \mid \text{C})$'], *flu_tbl),
             p(T(r"Two patients will walk in. Ann has a mild headache, mild cough, normal temperature and a sore throat; Bob has a severe headache, mild cough, high temperature and no sore throat.",
                 r"来两位病人。Ann：头痛 mild、咳嗽 mild、体温 normal、喉痛 yes；Bob：头痛 severe、咳嗽 mild、体温 high、无喉痛。"))),
        derive('ann', T('Ann: multiply and compare', 'Ann：相乘再比较'),
               [(r"\text{F: } " + prod_tex('Flu', ANN) + r" = 0", T(r"For Flu, take the prior and one likelihood per symptom of Ann. $P(\text{mild headache} \mid \text{F}) = 0$ because every Flu patient so far had a severe headache, so the whole product is 0.", r"对 Flu：取先验，再乘 Ann 每个症状的似然。$P(\text{mild 头痛} \mid \text{F}) = 0$，因为目前所有流感病人头痛都是 severe，整个乘积于是为 0。")),
                (r"\text{C: } " + prod_tex('Cold', ANN) + " = " + tf(ann_cold), T(r"For Cold: prior $\frac{2}{5}$; mild headache $\frac12$, mild cough $\frac12$, normal temperature $1$, sore $\frac12$. Multiply the five numbers.", r"对 Cold：先验 $\frac{2}{5}$；mild 头痛 $\frac12$、mild 咳嗽 $\frac12$、体温 normal $1$、喉痛 yes $\frac12$。五个数相乘。")),
                (r"0 < " + tf(ann_cold) + r" = 0.05 \;\Rightarrow\; \hat d = \text{C}", T(r"The larger score wins: predict Cold. (Normalising, $P(\text{C} \mid \text{Ann}) = 0.05/(0 + 0.05) = 1$: naive Bayes is *certain*. Remember that when we discuss calibration.)", r"分数大的赢：预测 Cold。（归一化后 $P(\text{C} \mid \text{Ann}) = 0.05/(0 + 0.05) = 1$：朴素贝叶斯“百分之百确定”。讨论校准时记住这一点。）"))],
               outro=T(r"The prediction is right, but only one zero decided it. Now Bob.", r"预测没问题，但决定它的只是一个零。再看 Bob。"), skill=EX),
        read('bob', T('Bob: when every score is zero', 'Bob：当所有分数都是零'),
             p(T(r"Bob: severe headache, mild cough, high temperature, no sore throat.", r"Bob：头痛 severe、咳嗽 mild、体温 high、无喉痛。")),
             math_(r"\text{F: } %s = 0 \qquad \text{C: } %s = 0" % (prod_tex('Flu', BOB), prod_tex('Cold', BOB))),
             p(T(r"Flu is killed by $P(\text{sore = no} \mid \text{F}) = 0$ (no Flu patient had *no* sore throat); Cold by two zeros (severe headache and high temperature were never seen in a Cold patient). Both scores are 0: the model cannot choose, although Bob's symptoms are plainly flu-like. This is the **zero-probability problem**: a single count of zero wipes out all the other (maybe very informative) factors.",
                 r"Flu 被 $P(\text{喉痛 = no} \mid \text{F}) = 0$ 一票否决（没有流感病人“没有喉痛”）；Cold 被两个零否决（感冒病人里从没见过头痛 severe 和体温 high）。两个分数都是 0：模型没法选，虽然 Bob 的症状明显像流感。这就是**零概率问题**：一个零计数就抹掉所有其他（可能很有信息量的）因子。")),
             p(T(r"The cause is the maximum likelihood estimate: with only 3 Flu patients, \"never seen\" is really \"seen fewer than about 1 time in 3\", not \"impossible\". The fix has a name: **no event is impossible**. Give every unseen combination a small positive probability, and keep the other probabilities a valid distribution.",
                 r"原因在最大似然估计：只有 3 个流感病人，“没见过”其实是“出现频率低于约三分之一”，而不是“不可能”。补救办法有个名字：**没有任何事件是不可能的**。给每个没见过的组合一个小的正概率，并保证其他概率仍然构成合法分布。")),
             h(T('Epsilon smoothing: the quick patch', 'ε 平滑：最快的补丁')),
             p(T(r"Simplest repair: wherever a likelihood is $0$, put a tiny constant $\varepsilon$ instead. Redo Bob:", r"最简单的补法：凡是似然为 $0$ 的地方，换成一个很小的常数 $\varepsilon$。重算 Bob：")),
             math_(r"\text{F: } \tfrac35 \cdot 1 \cdot \tfrac23 \cdot \tfrac13 \cdot \varepsilon = \tfrac{2}{15}\,\varepsilon \qquad \text{C: } \tfrac25 \cdot \varepsilon \cdot \tfrac12 \cdot \varepsilon \cdot \tfrac12 = \tfrac{1}{10}\,\varepsilon^{2}"),
             p(T(r"Flu has one $\varepsilon$, Cold has two. With $\varepsilon$ tiny, $\varepsilon^2 \ll \varepsilon$, so Flu wins: \"fewest $\varepsilon$'s wins\". That is sensible: Flu explains Bob's symptoms with one never-seen event, Cold needs two.",
                 r"Flu 里有一个 $\varepsilon$，Cold 里有两个。$\varepsilon$ 很小时 $\varepsilon^2 \ll \varepsilon$，所以 Flu 赢：“ε 最少的赢”。这很合理：Flu 只需要一个没见过的事件来解释 Bob 的症状，Cold 需要两个。")),
             p(T(r"How small? Smaller than $1/N$, the smallest probability any observed event can have (one count out of $N$). Then an unseen event is always rated less likely than a seen one, and since $1 + \varepsilon \approx 1$ we need not renormalise the other probabilities.",
                 r"多小？要小于 $1/N$，也就是任何见过的事件能有的最小概率（$N$ 个里一个）。这样没见过的事件总是比见过的更不可能；又因为 $1 + \varepsilon \approx 1$，其他概率不必重新归一化。")),
             p(T(r"The weakness: ε is arbitrary and comparisons reduce to counting ε's, so two unseen events are no longer told apart by anything else. Laplace smoothing does it more carefully.",
                 r"弱点：ε 是随意取的，比较退化成数 ε 的个数，两个没见过的事件之间再无别的区别。拉普拉斯平滑做得更细致。")),
             quiz(T(r"With $N = 1000$ training instances, which $\varepsilon$ fits epsilon smoothing?", r"$N = 1000$ 个训练实例时，ε 平滑该取哪个 $\varepsilon$？"),
                  [(T(r"$\varepsilon = 0.01$", r"$\varepsilon = 0.01$"), T(r"That is larger than $1/N = 0.001$: an event never seen would be rated *likelier* than one seen once.", r"这比 $1/N = 0.001$ 大：没见过的事件反而比见过一次的更可能。")),
                   (T(r"$\varepsilon = 10^{-9}$", r"$\varepsilon = 10^{-9}$"), True),
                   (T(r"$\varepsilon = 0.5$", r"$\varepsilon = 0.5$"), T(r"Far too large: it would swamp the real probabilities.", r"太大了：会淹没真实的概率。"))],
                  T(r"$\varepsilon \ll 1/N$, so unseen events rank below everything seen.", r"$\varepsilon \ll 1/N$，没见过的事件排在所有见过的之后。")),
             chapter=T('Zero probabilities and smoothing', '零概率与平滑')),
        read('laplace', T('Laplace smoothing: add pseudocounts', '拉普拉斯平滑：加伪计数'),
             p(T(r"Better: pretend you saw every value $\alpha$ extra times (a **pseudocount**) before looking at the data. Add $\alpha$ to every count; to keep the probabilities summing to 1, add $\alpha V$ to the denominator, where $V$ is the number of values the feature can take:",
                 r"更好的办法：假装在看数据之前，每个取值已经各见过 $\alpha$ 次（**伪计数**）。每个计数加 $\alpha$；为了让概率之和仍为 1，分母加 $\alpha V$，$V$ 是该特征能取的值的个数：")),
             math_(r"P(x_m = j \mid y = k) = \frac{n(x_m = j,\, y = k) + \alpha}{n(y = k) + \alpha V}"),
             p(T(r"$\alpha = 1$ is Laplace's add-one rule (every count goes up by one: 0 becomes 1, 1 becomes 2, so the order of counts is kept); a general $\alpha > 0$ is add-$\alpha$ (add-$k$) smoothing; $\alpha = 0$ is plain maximum likelihood. Headache given Flu, with $V = 3$ values and $\alpha = 1$:",
                 r"$\alpha = 1$ 是拉普拉斯的“加一”规则（每个计数加一：0 变 1，1 变 2，计数的大小顺序不变）；一般的 $\alpha > 0$ 叫加 $\alpha$（add-$k$）平滑；$\alpha = 0$ 就是普通最大似然。Flu 条件下的头痛，$V = 3$，$\alpha = 1$：")),
             table([T('Headache', '头痛'), T('Count in Flu (3)', 'Flu 内计数（共 3）'), T('Without smoothing', '不平滑'), T('With $\\alpha = 1$', '$\\alpha = 1$')],
                   *[[v, str(CNT_H[v]), tf_s(lik('headache', v, 'Flu')), r'$\frac{%d+1}{3+1\cdot 3} = $ ' % CNT_H[v] + tf_s(lik('headache', v, 'Flu', 1))] for v in VALS['headache']]),
             p(T(r"Check it sums to 1: $\frac46 + \frac16 + \frac16 = 1$. The big probability shrank ($1 \to \frac23$) and the zeros grew ($0 \to \frac16$): probability mass moved from what was seen to what was not.",
                 r"验证和为 1：$\frac46 + \frac16 + \frac16 = 1$。大的概率缩小了（$1 \to \frac23$），零的变大了（$0 \to \frac16$）：概率质量从见过的挪到了没见过的。")),
             ul(T(r"**With few instances the change is drastic, with many it is small:** $\frac{3+1}{3+3}$ moves a lot from $\frac33$, but $\frac{3000+1}{3000+3}$ hardly moves from $1$.", r"**实例少时变化剧烈，实例多时变化很小：**$\frac{3+1}{3+3}$ 离 $\frac33$ 很远，$\frac{3000+1}{3000+3}$ 几乎不动。"),
                T(r"**Variance goes down:** one odd observation moves the estimate less.", r"**方差下降：**一个异常观察对估计的影响变小。"),
                T(r"**Bias goes up:** it is no longer the maximum likelihood estimate; with a large $\alpha$ all values tend towards equally likely ($1/V$), ignoring the data.", r"**偏差上升：**它不再是最大似然估计；$\alpha$ 很大时所有取值趋向等可能（$1/V$），无视数据。"),
                T(r"Priors $P(y)$ are not normally smoothed in the deck; there are other schemes (Good-Turing, Kneser-Ney) outside this subject.", r"课件里类别先验 $P(y)$ 一般不平滑；还有别的平滑方法（Good-Turing、Kneser-Ney），不在本课范围。"))),
        derive('bob_laplace', T('Bob again, with add-one smoothing', 'Bob 再算一遍：加一平滑'),
               [(r"\text{F: } " + prod_tex('Flu', BOB, 1), T(r"Smooth each likelihood with $\alpha = 1$. Flu has 3 instances; headache has $V=3$ values, the other three attributes $V=2$. For example sore = no: $\frac{0+1}{3+2} = \frac15$. The prior stays $\frac35$.", r"每个似然都用 $\alpha = 1$ 平滑。Flu 有 3 个实例；头痛 $V=3$ 个取值，其他三个属性 $V=2$。例如喉痛 = no：$\frac{0+1}{3+2} = \frac15$。先验仍是 $\frac35$。")),
                (r"= " + tf(bob_flu_a) + r" \approx " + fl(bob_flu_a, 4), T(r"Multiply: a small but positive number.", r"相乘：一个小但为正的数。")),
                (r"\text{C: } " + prod_tex('Cold', BOB, 1), T(r"Same for Cold (2 instances): severe headache $\frac{0+1}{2+3} = \frac15$, high temperature $\frac{0+1}{2+2} = \frac14$.", r"Cold（2 个实例）同样处理：头痛 severe $\frac{0+1}{2+3} = \frac15$，体温 high $\frac{0+1}{2+2} = \frac14$。")),
                (r"= " + tf(bob_cold_a) + r" \approx " + fl(bob_cold_a, 4), T(r"Multiply.", r"相乘。")),
                (fl(bob_flu_a, 4) + (r" > " if bob_flu_a > bob_cold_a else r" < ") + fl(bob_cold_a, 4) + r" \;\Rightarrow\; \hat d = \text{F}", T(r"Flu's score is larger, so Bob is predicted to have the flu, as ε-smoothing also said. Unlike ε, the numbers now carry information from the counts.", r"Flu 的分数更大，预测 Bob 得流感，与 ε 平滑的结论一致。不同的是，现在的数字里带有计数提供的信息。"))],
               outro=T(r"Normalised, $P(\text{F} \mid \text{Bob}) = %s$: still not 0 or 1, as a diagnosis from five patients should be." % fl(bob_flu_a / (bob_flu_a + bob_cold_a), 3),
                       r"归一化后 $P(\text{F} \mid \text{Bob}) = %s$：不再是 0 或 1，五个病人得出的诊断本该如此。" % fl(bob_flu_a / (bob_flu_a + bob_cold_a), 3)),
               skill=SM),
        derive('map', T('Deeper: Laplace smoothing is a prior (MAP)', '深入：拉普拉斯平滑就是先验（MAP）'),
               [(r"p(\mathbf{p}) \;\propto\; \prod_{j=1}^{V} p_j^{\,a - 1}", T(r"Say before seeing data we believe the value probabilities $\mathbf{p} = (p_1, \dots, p_V)$ come from a **symmetric Dirichlet** with parameter $a$. The Dirichlet is the natural prior over a probability vector (the Beta distribution, for $V = 2$); $a = 1$ is flat, $a > 1$ prefers near-uniform vectors.", r"设在看数据之前，我们相信取值概率 $\mathbf{p} = (p_1, \dots, p_V)$ 来自参数为 $a$ 的**对称狄利克雷分布**。狄利克雷是概率向量的天然先验（$V = 2$ 时就是 Beta 分布）；$a = 1$ 是平的，$a > 1$ 偏好接近均匀的向量。")),
                (r"p(D \mid \mathbf{p}) \;\propto\; \prod_{j} p_j^{\,n_j}", T(r"The likelihood of the counts is what we maximised before: $n_j$ occurrences of value $j$.", r"计数的似然就是之前最大化的那个：取值 $j$ 出现 $n_j$ 次。")),
                (r"p(\mathbf{p} \mid D) \;\propto\; \prod_{j} p_j^{\,n_j + a - 1}", T(r"Posterior = prior $\times$ likelihood: the exponents just add. The prior acts like $a - 1$ **imaginary** occurrences of each value, seen before the real data.", r"后验 = 先验 $\times$ 似然：指数直接相加。先验的作用就像在真实数据之前，每个取值已经“虚拟地”出现过 $a - 1$ 次。")),
                (r"\mathcal{L} = \sum_{j} (n_j + a - 1)\log p_j - \lambda\Big(\sum_{j} p_j - 1\Big)", T(r"MAP (maximum a posteriori) maximises the posterior instead of the likelihood. Same method as before: take logs, add the Lagrange term for $\sum_j p_j = 1$.", r"MAP（最大后验）是最大化后验而不是似然。方法和之前一样：取对数，加上 $\sum_j p_j = 1$ 的拉格朗日项。")),
                (r"p_j = \frac{n_j + a - 1}{\lambda}, \quad \lambda = n + V(a - 1)", T(r"Setting $\partial\mathcal{L}/\partial p_j = 0$ gives $p_j$ proportional to $n_j + a - 1$; the constant $\lambda$ is the sum of these over $j$: $\sum_j n_j + V(a-1)$.", r"令 $\partial\mathcal{L}/\partial p_j = 0$ 得 $p_j$ 与 $n_j + a - 1$ 成正比；常数 $\lambda$ 是它们对 $j$ 的和：$\sum_j n_j + V(a-1)$。")),
                (r"\hat p_j^{\text{MAP}} = \frac{n_j + \alpha}{n + \alpha V}, \qquad \alpha = a - 1", T(r"This is **exactly add-$\alpha$ smoothing** with $\alpha = a - 1$. Laplace's add-one rule is the MAP estimate under a Dirichlet with $a = 2$, a mild prior that prefers probabilities away from 0 and 1. Smoothing is not a hack: it is Bayesian estimation with a prior.", r"这**正是**取 $\alpha = a - 1$ 的加 $\alpha$ 平滑。拉普拉斯的加一规则，就是 $a = 2$ 的狄利克雷先验下的 MAP 估计：一个温和的先验，偏好远离 0 和 1 的概率。平滑不是权宜之计，而是带先验的贝叶斯估计。"))],
               intro=T(r"Why add $\alpha$, and why $\alpha V$ underneath? Here is where it comes from.", r"为什么是加 $\alpha$、分母为什么加 $\alpha V$？来源在这里。"),
               outro=T(r"Two footnotes. (1) $\alpha = 0$ is $a = 1$, the flat prior: MAP then equals maximum likelihood. (2) Using the posterior **mean** instead of the mode gives $(n_j + a)/(n + aV)$; with $a = 1$ (flat prior) that is add-one, the version often called Laplace's rule of succession. Which one is \"Laplace\" differs between textbooks; in this subject, the formula above with $\alpha = 1$ is what you use.",
                       r"两点补充。(1) $\alpha = 0$ 即 $a = 1$，是平的先验：此时 MAP 等于最大似然。(2) 若用后验**均值**而非众数，得到 $(n_j + a)/(n + aV)$；取 $a = 1$（平的先验）就是加一，常被称作拉普拉斯的继承律。哪个叫“拉普拉斯”各教材说法不同；这门课里用上面的公式、$\alpha = 1$ 即可。"),
               skill=SM),
        # ------------------------------------------------------------ gaussian
        read('gaussian', T('Numeric attributes: Gaussian naive Bayes', '数值属性：高斯朴素贝叶斯'),
             p(T(r"For a numeric feature there is no table of values to count. Instead, for each class $k$ and feature $m$ assume a bell curve and learn its two parameters from the training instances **of that class**:",
                 r"数值特征没有“取值表”可数。于是对每个类别 $k$、每个特征 $m$ 假设一条钟形曲线，只用**该类别的**训练实例学它的两个参数：")),
             math_(r"\hat\mu_{m,k} = \frac{1}{n_k}\sum_{i \in k} x_{im}, \qquad \hat\sigma_{m,k} = \sqrt{\frac{1}{n_k}\sum_{i \in k}\big(x_{im} - \hat\mu_{m,k}\big)^2}"),
             p(T(r"Average the values; then average the squared distances from that mean and take the root. The deck divides by $n_k$ (the maximum likelihood estimate), not $n_k - 1$. Its example: headache scores of the three Flu patients are $0.8, 0.5, 0.9$, giving $\hat\mu = %.2f$ and $\hat\sigma = %.2f$." % (MU_F, S_F),
                 r"先对取值求平均，再对到均值的距离平方求平均，开根号。课件除以 $n_k$（最大似然估计），不是 $n_k - 1$。例子：三位流感病人的头痛得分是 $0.8, 0.5, 0.9$，得 $\hat\mu = %.2f$，$\hat\sigma = %.2f$。" % (MU_F, S_F))),
             p(T(r"Prediction plugs the value into the Gaussian density, in place of the table lookup:", r"预测时把取值代进高斯密度，代替查表：")),
             math_(r"P(x_m \mid y = k) = \frac{1}{\sqrt{2\pi\hat\sigma_{m,k}^2}}\exp\!\Big(-\frac{(x_m - \hat\mu_{m,k})^2}{2\hat\sigma_{m,k}^2}\Big)"),
             p(T(r"Example: headache score $0.8$. Flu has $\hat\mu = %.3f,\ \hat\sigma = %.3f$ and density %.3f; Cold (scores $0.0, 0.3$) has $\hat\mu = %.2f,\ \hat\sigma = %.2f$ and density %.4f. Flu fits far better (ratio about %.0f to 1), before the other features and priors are multiplied in."
                 % (MU_F, S_F, PDF_F, MU_C, S_C, PDF_C, PDF_F / PDF_C),
                 r"例：头痛得分 $0.8$。Flu 的 $\hat\mu = %.3f,\ \hat\sigma = %.3f$，密度 %.3f；Cold（得分 $0.0, 0.3$）的 $\hat\mu = %.2f,\ \hat\sigma = %.2f$，密度 %.4f。Flu 拟合得好得多（约 %.0f 比 1），这还没乘上其他特征和先验。"
                 % (MU_F, S_F, PDF_F, MU_C, S_C, PDF_C, PDF_F / PDF_C))),
             callout('warning', T('A density is not a probability', '密度不是概率'),
                     T(r"With a small $\sigma$ the density at the mean exceeds 1 (here %.2f). That is fine: densities integrate to 1, they need not be at most 1. Only the comparison between classes matters, and the factors still multiply." % PDF_F,
                       r"$\sigma$ 很小时，均值处的密度会大于 1（这里是 %.2f）。这没问题：密度的积分为 1，不必不超过 1。重要的只是各类别之间的比较，各因子照样相乘。" % PDF_F)),
             h(T('"Smoothing" for continuous features', '连续特征的“平滑”')),
             p(T(r"There are no unseen values to worry about, since the density is defined everywhere. The remaining danger is **zero variance**: if all instances of a class share the same value, $\hat\sigma = 0$ and the density divides by zero. Two fixes: (1) ignore the feature (safe if it is constant across all classes, since then it is a constant factor; a loss if it is constant only in some classes); (2) add a small $\varepsilon$ to the spread, e.g. a small fraction of the largest variance ($10^{-9}$ in scikit-learn).",
                 r"这里不用担心没见过的取值，因为密度处处有定义。剩下的危险是**方差为零**：某个类别的所有实例该特征取值相同，则 $\hat\sigma = 0$，密度出现除以零。两种办法：(1) 忽略该特征（如果它在所有类别里都是同一个常数，这没问题，因为它只是个常数因子；如果只在某些类别里为常数，就损失了信息）；(2) 给方差加一个很小的 $\varepsilon$，例如最大方差的一小部分（scikit-learn 用 $10^{-9}$）。")),
             quiz(T(r"A Gaussian naive Bayes feature has density 3.2 for class A and 0.4 for class B (same priors, no other features). What follows?", r"高斯朴素贝叶斯的某特征在类别 A 的密度是 3.2，在类别 B 是 0.4（先验相同、无其他特征）。能得出什么？"),
                  [(T(r"Impossible: a probability cannot exceed 1", r"不可能：概率不能大于 1"), T(r"It is a density, not a probability; density values above 1 are normal when $\sigma$ is small.", r"这是密度而不是概率；$\sigma$ 小时密度大于 1 很正常。")),
                   (T(r"Predict A: its score is larger", r"预测 A：它的分数更大"), True),
                   (T(r"Predict B, since 0.4 is closer to a valid probability", r"预测 B，因为 0.4 更像合法的概率"), T(r"Classification compares the scores; nothing needs to be at most 1.", r"分类只比较分数，没有什么必须不超过 1。"))],
                  T(r"Densities are compared directly, just like the table probabilities.", r"密度直接比较，和查表得到的概率一样。")),
             chapter=T('Numeric attributes, logs, and the linear view', '数值属性、对数与线性视角')),
        # ------------------------------------------------------------ logs
        read('logs', T('Working in log space', '在对数空间里算'),
             p(T(r"A real text classifier multiplies thousands of numbers below 1. A product of 1000 factors of $10^{-3}$ is $10^{-3000}$, far below the smallest double-precision number (about $10^{-308}$): the computer returns exactly **%s**, and every class ties at 0. This is **underflow**." % ('0.0'),
                 r"真实的文本分类器要把几千个小于 1 的数相乘。1000 个 $10^{-3}$ 的乘积是 $10^{-3000}$，远小于双精度能表示的最小数（约 $10^{-308}$）：计算机直接返回 **%s**，所有类别平手于 0。这就是**下溢**。" % ('0.0'))),
             p(T(r"The log turns the product into a sum, and since $\log$ is increasing, the winning class does not change:", r"取对数把乘积变成和；又因为 $\log$ 是递增函数，赢家不变：")),
             math_(r"\hat y = \arg\max_y \Big[\log P(y) + \sum_{m=1}^{F} \log P(x_m \mid y)\Big]"),
             p(T(r"The same 1000 factors now give $1000 \ln 10^{-3} = %.1f$, an ordinary number." % LN_1000, r"同样的 1000 个因子现在得到 $1000 \ln 10^{-3} = %.1f$，一个普通的数。" % LN_1000)),
             ul(T(r"Log scores are **negative** (logs of probabilities $\le 1$); the **larger** (closer to 0) wins. Ann's Cold score $0.05$ is $\ln 0.05 = %.4f$." % ann_ln, r"对数分数是**负数**（概率 $\le 1$ 的对数）；**越大**（越接近 0）越好。Ann 的 Cold 分数 $0.05$ 是 $\ln 0.05 = %.4f$。" % ann_ln),
                T(r"$\log 0$ is $-\infty$: an unsmoothed zero still breaks the computation, so smoothing is needed in log space too.", r"$\log 0 = -\infty$：没平滑的零照样会毁掉计算，所以对数空间里也需要平滑。"),
                T(r"Any base works as long as it is the same everywhere; the exam suggests practising logs on your calculator.", r"底数任意，只要全程一致；考试前建议用计算器练习对数。")),
             quiz(T(r"Why is it valid to compare log scores instead of the products?", r"为什么可以比较对数分数而不是乘积？"),
                  [(T(r"Because the logs of the probabilities add up to 1", r"因为概率的对数加起来等于 1"), T(r"Nothing of the sort: log scores are negative numbers; probabilities, not logs, sum to 1.", r"没这回事：对数分数是负数；和为 1 的是概率，不是对数。")),
                   (T(r"Because the log is a strictly increasing function, so it preserves which score is largest", r"因为对数是严格递增函数，不会改变哪个分数最大"), True),
                   (T(r"Because $\log P(\mathbf{x})$ cancels", r"因为 $\log P(\mathbf{x})$ 被约掉了"), T(r"$P(\mathbf{x})$ was already dropped before taking logs; the validity here comes from monotonicity.", r"$P(\mathbf{x})$ 在取对数之前就已经去掉了；这里成立靠的是单调性。"))],
                  T(r"$a < b \iff \log a < \log b$, so $\arg\max$ is unchanged.", r"$a < b \iff \log a < \log b$，所以 $\arg\max$ 不变。")),
             ),
        derive('linear', T('Deeper: the decision rule is linear in log space', '深入：决策规则在对数空间里是线性的'),
               [(r"\log\frac{P(y{=}1 \mid \mathbf{x})}{P(y{=}0 \mid \mathbf{x})} = \log\frac{P(y{=}1)}{P(y{=}0)} + \sum_{m}\log\frac{P(x_m \mid 1)}{P(x_m \mid 0)}", T(r"Take two classes and compare them by the **log-odds**: positive means class 1. The evidence $P(\mathbf{x})$ cancels in the ratio, and the naive product turns into a sum of per-feature log ratios.", r"取两个类别，用**对数几率**来比较：为正就是类别 1。证据 $P(\mathbf{x})$ 在比值里约掉，朴素乘积变成每个特征对数比的和。")),
                (r"P(x_m \mid y{=}k) = p_{m,k}^{\,x_m}(1 - p_{m,k})^{1 - x_m}", T(r"Now let every feature be binary ($x_m \in \{0, 1\}$, e.g. a word is present or not), with $p_{m,k} = P(x_m = 1 \mid y = k)$. The exponent trick $p^{x}(1-p)^{1-x}$ picks $p$ when $x = 1$ and $1-p$ when $x = 0$.", r"现在让每个特征都是二值（$x_m \in \{0, 1\}$，例如某个词出现与否），记 $p_{m,k} = P(x_m = 1 \mid y = k)$。指数技巧 $p^{x}(1-p)^{1-x}$ 在 $x = 1$ 时取 $p$，在 $x = 0$ 时取 $1-p$。")),
                (r"\log\frac{P(x_m \mid 1)}{P(x_m \mid 0)} = x_m \log\frac{p_{m,1}}{p_{m,0}} + (1 - x_m)\log\frac{1 - p_{m,1}}{1 - p_{m,0}}", T(r"Take the log of the ratio. Each feature's contribution is linear in its own value $x_m$, because $x_m$ sits in an exponent.", r"对比值取对数。每个特征的贡献都是它自己取值 $x_m$ 的线性函数，因为 $x_m$ 在指数位置上。")),
                (r"= x_m\, w_m + \log\frac{1 - p_{m,1}}{1 - p_{m,0}}, \quad w_m = \log\frac{p_{m,1}(1 - p_{m,0})}{p_{m,0}(1 - p_{m,1})}", T(r"Collect the terms with $x_m$. The weight $w_m$ is the **log odds ratio** of the feature: how many log-units of evidence for class 1 the presence of feature $m$ adds. It is positive if the feature is likelier in class 1.", r"把含 $x_m$ 的项合并。权重 $w_m$ 是该特征的**对数优势比**：特征 $m$ 出现时给类别 1 增加多少对数单位的证据。该特征在类别 1 里更常见时为正。")),
                (r"\log\frac{P(1 \mid \mathbf{x})}{P(0 \mid \mathbf{x})} = b + \sum_{m} w_m x_m, \quad b = \log\frac{P(1)}{P(0)} + \sum_m \log\frac{1 - p_{m,1}}{1 - p_{m,0}}", T(r"Sum over features. The result is a bias $b$ plus a weighted sum of the features: a **linear function of $\mathbf{x}$**. The decision rule \"predict 1 if $b + \mathbf{w}^\top\mathbf{x} > 0$\" has a flat boundary (a hyperplane), like a perceptron or logistic regression.", r"对特征求和。结果是偏置 $b$ 加上特征的加权和：$\mathbf{x}$ 的**线性函数**。决策规则“若 $b + \mathbf{w}^\top\mathbf{x} > 0$ 则预测 1”的边界是平的（超平面），和感知机、逻辑回归一样。")),
                (r"P(y{=}1 \mid \mathbf{x}) = \sigma\big(b + \mathbf{w}^\top\mathbf{x}\big) = \frac{1}{1 + e^{-(b + \mathbf{w}^\top\mathbf{x})}}", T(r"Solve the log-odds for the probability: that is the logistic (sigmoid) function. So binary naive Bayes has **the same functional form as logistic regression**. The difference is how the weights are found: naive Bayes computes each $w_m$ from counts, one feature at a time (generative); logistic regression fits all weights together to maximise $P(y \mid \mathbf{x})$ (discriminative).", r"把对数几率解成概率：就是逻辑（sigmoid）函数。所以二值朴素贝叶斯和**逻辑回归的函数形式相同**。区别在权重怎么得到：朴素贝叶斯用计数一个特征一个特征地算 $w_m$（生成式）；逻辑回归把所有权重放在一起去最大化 $P(y \mid \mathbf{x})$（判别式）。"))],
               outro=T(r"With more than two classes the rule is $\arg\max_k \,(b_k + \mathbf{w}_k^\top\mathbf{x})$: still linear scores. (Gaussian naive Bayes is linear too when the classes share variances; with class-specific variances the boundary becomes quadratic.)", r"多于两类时，规则是 $\arg\max_k \,(b_k + \mathbf{w}_k^\top\mathbf{x})$：仍是线性分数。（高斯朴素贝叶斯在各类方差相同时也是线性的；各类方差不同，边界变成二次曲线。）"),
               skill=LIN),
        read('linear_ex', T('The weights by hand', '手算权重'),
             p(T(r"A spam filter with two words. Prior $P(\text{spam}) = %.1f$. Word 1 appears in 80%% of spam and 20%% of ham; word 2 in 30%% of spam and 60%% of ham." % PS,
                 r"一个只有两个词的垃圾邮件过滤器。先验 $P(\text{spam}) = %.1f$。词 1 出现在 80%% 的垃圾邮件和 20%% 的正常邮件里；词 2 出现在 30%% 的垃圾邮件和 60%% 的正常邮件里。" % PS)),
             math_(r"w_1 = \ln\frac{0.8 \cdot 0.8}{0.2 \cdot 0.2} = \ln 16 = %.3f, \qquad w_2 = \ln\frac{0.3 \cdot 0.4}{0.6 \cdot 0.7} = %.3f" % (W1, W2)),
             math_(r"b = \ln\frac{0.4}{0.6} + \ln\frac{0.2}{0.8} + \ln\frac{0.7}{0.4} = %.3f" % B0),
             p(T(r"Word 1 pushes strongly towards spam ($+%.2f$), word 2 mildly towards ham ($%.2f$). An email containing only word 1 has log-odds $b + w_1 = %.3f$, i.e. $P(\text{spam}) = %.3f$; direct multiplication of the naive Bayes factors gives the same number (checked in code)."
                 % (W1, W2, LO_10, P_10),
                 r"词 1 强烈指向垃圾邮件（$+%.2f$），词 2 轻微指向正常邮件（$%.2f$）。只含词 1 的邮件，对数几率是 $b + w_1 = %.3f$，即 $P(\text{spam}) = %.3f$；把朴素贝叶斯的各因子直接相乘，得到同一个数（已在代码里核对）。"
                 % (W1, W2, LO_10, P_10))),
             quiz(T(r"In $b + \sum_m w_m x_m$, what does a weight $w_m$ near 0 tell you about feature $m$?", r"在 $b + \sum_m w_m x_m$ 里，权重 $w_m$ 接近 0 说明特征 $m$ 怎样？"),
                  [(T(r"The feature is rare", r"该特征很少见"), T(r"Rare features can still have a large $w_m$ (the ratio of its two class probabilities matters, not its size).", r"罕见的特征照样可以有很大的 $w_m$（起作用的是它在两类里概率的比值，而不是大小）。")),
                   (T(r"The feature is about equally likely in both classes, so it carries no evidence", r"该特征在两个类里差不多一样常见，所以不提供证据"), True),
                   (T(r"The feature always equals zero", r"该特征恒为 0"), T(r"$w_m \approx 0$ says $p_{m,1} \approx p_{m,0}$; the feature may take either value often.", r"$w_m \approx 0$ 说的是 $p_{m,1} \approx p_{m,0}$；该特征完全可以经常取两个值。"))],
                  T(r"$w_m = \log \frac{p_{m,1}(1-p_{m,0})}{p_{m,0}(1-p_{m,1})} = 0$ exactly when $p_{m,1} = p_{m,0}$.", r"$w_m = \log \frac{p_{m,1}(1-p_{m,0})}{p_{m,0}(1-p_{m,1})} = 0$ 当且仅当 $p_{m,1} = p_{m,0}$。"))),
        read('why_works', T('Deeper: a wrong model that still classifies well', '深入：错误的模型为什么还能分得好'),
             p(T(r"The deck calls the independence assumption \"nonsense\" and in the same breath says naive Bayes works surprisingly well. Both are true because of one distinction: **ranking the classes** versus **estimating the probabilities**.",
                 r"课件说独立性假设是“胡说”，同时又说朴素贝叶斯出奇地好。两者都对，因为有一个区分：**给类别排序**与**估计概率**。")),
             p(T(r"Suppose a word that signals spam (likelihood ratio 4 : 1, equal priors) appears in the email in $k$ perfectly correlated copies, for example the same word in several places, or several near-synonyms. Naive Bayes treats each copy as new evidence and multiplies the ratio $k$ times:",
                 r"设一个指向垃圾邮件的词（似然比 4 : 1，先验相等）在邮件里有 $k$ 个完全相关的副本，比如同一个词出现多处，或几个近义词。朴素贝叶斯把每个副本都当成新证据，把比值乘 $k$ 次：")),
             table([T('Copies $k$', '副本数 $k$'), T('Odds for spam (naive Bayes)', '垃圾邮件几率（朴素贝叶斯）'), T('$P(\\text{spam})$ it reports', '它报告的 $P(\\text{spam})$')],
                   *[[str(k), f'{4 ** k}', f'{pk:.3f}'] for k, pk in DUP]),
             p(T(r"The truth is odds of 4 (probability 0.80) whatever $k$ is. Naive Bayes gets the **direction** right (spam) but grows more and more **over-confident**: the probabilities are pushed towards 0 and 1, i.e. poorly **calibrated**. Classification only needs the sign of the log-odds, which is right as long as the errors do not overturn it; a decision threshold at 0 is robust to inflating the magnitude.",
                 r"真实情况不论 $k$ 是多少，都是几率 4（概率 0.80）。朴素贝叶斯得到了正确的**方向**（垃圾邮件），但**越来越过度自信**：概率被推向 0 和 1，也就是**校准**很差。分类只需要对数几率的符号；只要误差没有把符号翻过来，它就是对的；阈值在 0 处的决策对“幅度被放大”很稳健。")),
             ul(T(r"**What can break it:** strongly correlated features that point in *different* directions can outvote the truth; the product then favours the wrong class. Redundant features are the main enemy; feature selection helps.", r"**什么会让它失灵：**指向*不同*方向的强相关特征会把真相“投票”压倒，乘积偏向错误的类别。冗余特征是主要敌人，特征选择能帮忙。"),
                T(r"**When you need probabilities** (expected costs, thresholds, combining with other models), do not trust naive Bayes's numbers directly: recalibrate (Platt scaling, isotonic regression) on held-out data. A ranking measure (AUC, accuracy) can look good while a probability measure (log loss, calibration curve) looks bad.", r"**需要概率时**（期望代价、阈值、与别的模型组合），别直接信朴素贝叶斯给的数：在留出数据上重新校准（Platt 缩放、保序回归）。排序类指标（AUC、准确率）可能很好，概率类指标（对数损失、校准曲线）却很差。"),
                T(r"Domingos and Pazzani (1997) showed naive Bayes can be optimal for 0-1 loss even with strong dependences: it needs only that the correct class gets the highest score, not that the scores are right. The deck's phrase: \"we do not need the true distribution over $P(y \mid \mathbf{x})$, we just need to identify the most likely outcome.\"", r"Domingos 与 Pazzani（1997）证明：即使有很强的依赖，朴素贝叶斯在 0-1 损失下也可能是最优的：它只需要正确类别得分最高，并不需要分数本身对。课件的说法：不需要真实的 $P(y \mid \mathbf{x})$，只需认出最可能的结果。")),
             quiz(T(r"A naive Bayes spam filter reports $P(\text{spam}) = 0.999$ for 40% of the mails it flags, but only 80% of those are spam. What does this show?", r"一个朴素贝叶斯垃圾邮件过滤器，对它标记的邮件中 40% 报告 $P(\text{spam}) = 0.999$，但其中只有 80% 真的是垃圾邮件。这说明什么？"),
                  [(T(r"The model is poorly calibrated: its confidence is higher than its accuracy", r"模型校准差：它的自信超过了它的准确率"), True),
                   (T(r"The classification is wrong for those mails", r"这些邮件的分类是错的"), T(r"80% correct is a good accuracy; the problem is the *stated* probability 0.999, not the decisions.", r"80% 正确是不错的准确率；问题出在*报告的*概率 0.999，不在决策。")),
                   (T(r"Smoothing was set too low", r"平滑设得太小"), T(r"Smoothing affects unseen events; this over-confidence comes from multiplying correlated evidence.", r"平滑影响的是没见过的事件；这里的过度自信来自把相关的证据连乘。"))],
                  T(r"Calibration compares stated probability with observed frequency; naive Bayes tends to say 0.999 when the truth is lower.", r"校准比较的是报告的概率与实际频率；朴素贝叶斯常在真实概率更低时说 0.999。")),
             chapter=T('Strengths, weaknesses, practice', '优缺点与练习')),
        read('proscons', T('Pros and cons', '优点与缺点'),
             table([T('Advantages (deck)', '优点（课件）'), T('Why', '为什么')],
                   [T('Easy to build and estimate', '容易搭建和估计'), T('training is counting: one pass over the data, no iterations', '训练就是计数：扫一遍数据，不用迭代')],
                   [T('Scales to many features and data', '能扩展到大量特征和数据'), T('cost grows linearly in $F$ and $N$; the parameters are $F(V-1)$ per class, not $V^F$', '代价随 $F$ 和 $N$ 线性增长；参数是每类 $F(V-1)$ 个，不是 $V^F$')],
                   [T('Easy to explain a prediction', '容易解释一个预测'), T('each feature contributes one visible factor (or log-ratio weight)', '每个特征贡献一个看得见的因子（或对数比权重）')],
                   [T('Handles missing values naturally', '自然处理缺失值'), T('leave the missing feature\'s factor out of the product', '把缺失特征的因子从乘积里去掉')],
                   [T('A good starting point', '好的起点'), T('a fast baseline that works with little data', '快速的基线，数据少时也行')]),
             table([T('Disadvantages', '缺点'), T('Why', '为什么')],
                   [T('Independence assumption is usually false', '独立性假设通常不成立'), T('correlated features are counted twice; probabilities over-confident', '相关特征被重复计数；概率过度自信')],
                   [T('Zero probabilities', '零概率'), T('unseen (feature, class) pairs veto a class; needs smoothing', '没见过的（特征，类别）组合会一票否决某个类别；需要平滑')],
                   [T('Cannot learn feature interactions', '学不到特征间的交互'), T('the boundary is linear in log space; an XOR-like pattern is invisible to it', '边界在对数空间里是线性的；类似 XOR 的模式它看不见')],
                   [T('Numeric features need a distribution', '数值特征要假设分布'), T('a non-Gaussian feature is fitted badly by a bell curve; discretising loses detail', '非高斯的特征被钟形曲线拟合得很差；离散化又损失细节')]),
             p(T(r"Compare with the neighbours in this course: k-NN keeps all data and needs no training but cannot scale in $F$; decision trees choose features and model interactions but fragment the data; naive Bayes is the cheapest and most data-frugal, at the price of the independence assumption.",
                 r"和本课其他方法比：k-NN 保留所有数据、不用训练，但在 $F$ 上扩展不了；决策树能选特征、能建模交互，但会把数据切碎；朴素贝叶斯最便宜、最省数据，代价是独立性假设。"))),
        choice('p1', T('Check: which step is the approximation?', '检查：哪一步是近似？'), P,
               T(r"In the derivation $\hat y = \arg\max_y P(y \mid \mathbf{x}) \to \arg\max_y P(y)P(\mathbf{x}\mid y) \to \arg\max_y P(y)\prod_m P(x_m \mid y)$, which step is an approximation and not an identity?", r"在推导 $\hat y = \arg\max_y P(y \mid \mathbf{x}) \to \arg\max_y P(y)P(\mathbf{x}\mid y) \to \arg\max_y P(y)\prod_m P(x_m \mid y)$ 中，哪一步是近似而不是恒等？"),
               [(T(r"Applying Bayes' rule", r"用贝叶斯公式"), T(r"Bayes' rule is exact: it just rewrites the same joint probability.", r"贝叶斯公式是精确的：只是把同一个联合概率换个写法。"), 'bayes-approx'),
                (T(r"Dropping $P(\mathbf{x})$", r"去掉 $P(\mathbf{x})$"), T(r"Dropping the denominator does not change the $\arg\max$ because it is the same for every class; no approximation.", r"去掉分母不改变 $\arg\max$，因为它对每个类别相同；不是近似。"), 'evidence-approx'),
                (T(r"Replacing $P(\mathbf{x}\mid y)$ by the product of one-feature likelihoods", r"把 $P(\mathbf{x}\mid y)$ 换成单特征似然的乘积"), True)],
               T(r"Only the conditional independence assumption is an approximation; the rest is exact.", r"只有条件独立假设是近似；其余都是精确的。")),
        number('p2', T('Calculate: Laplace-smoothed score', '计算：拉普拉斯平滑后的分数'), SM,
               T(r"Use the deck's five patients. Carl has a **mild** headache, **severe** cough, **normal** temperature and **sore = yes**. With Laplace smoothing ($\alpha = 1$) on every likelihood and the prior left as it is, what is the unnormalised score of **Flu**? Give a decimal to 4 places.",
                 r"用课件里的五位病人。Carl：头痛 **mild**、咳嗽 **severe**、体温 **normal**、喉痛 **yes**。对所有似然用拉普拉斯平滑（$\alpha = 1$），先验不动，**Flu** 的未归一化分数是多少？写成小数，保留 4 位。"),
               float(carl_flu),
               T(r"Flu has 3 instances: headache mild $\frac{0+1}{3+3}$, cough severe $\frac{1+1}{3+2}$, temperature normal $\frac{2+1}{3+2}$, sore yes $\frac{3+1}{3+2}$; prior $\frac35$. Score $= %s \approx %s$." % (tf(carl_flu), fl(carl_flu, 4)),
                 r"Flu 有 3 个实例：头痛 mild $\frac{0+1}{3+3}$、咳嗽 severe $\frac{1+1}{3+2}$、体温 normal $\frac{2+1}{3+2}$、喉痛 yes $\frac{3+1}{3+2}$；先验 $\frac35$。分数 $= %s \approx %s$。" % (tf(carl_flu), fl(carl_flu, 4))),
               tolerance=0.0005, hints=[T(r"Each attribute has its own $V$: headache 3, the others 2.", r"每个属性有自己的 $V$：头痛 3，其他 2。")]),
        number('p3', T('Calculate: from scores to a probability', '计算：从分数到概率'), P,
               T(r"For Carl (previous question), the Cold score under the same smoothing is $%s$. Normalising the two scores, what is $P(\text{C} \mid \text{Carl})$? Three decimal places." % tf(carl_cold),
                 r"接上题，Carl 在同样平滑下的 Cold 分数是 $%s$。把两个分数归一化，$P(\text{C} \mid \text{Carl})$ 是多少？保留三位小数。" % tf(carl_cold)),
               float(carl_post_cold),
               T(r"Divide by the sum of the scores: $\frac{%s}{%s + %s} = %s$. The dropped $P(\mathbf{x})$ is exactly this sum." % (tf(carl_cold), tf(carl_flu), tf(carl_cold), fl(carl_post_cold, 4)),
                 r"除以分数之和：$\frac{%s}{%s + %s} = %s$。被去掉的 $P(\mathbf{x})$ 正是这个和。" % (tf(carl_cold), tf(carl_flu), tf(carl_cold), fl(carl_post_cold, 4))),
               tolerance=0.002),
        choice('p5', T('Check: what smoothing does', '检查：平滑做了什么'), SM,
               T(r"Compared with the maximum likelihood estimate, add-one smoothing on a small training set:", r"与最大似然估计相比，在小训练集上做加一平滑："),
               [(T(r"increases bias and reduces variance", r"增大偏差、减小方差"), True),
                (T(r"reduces bias, because it uses more information", r"减小偏差，因为用了更多信息"), T(r"The pseudocounts are information that is **not** in the data; they pull the estimate away from the data's frequencies, which is bias.", r"伪计数是**不在**数据里的信息；它把估计从数据频率处拉开，这就是偏差。"), 'smooth-bias'),
                (T(r"leaves both unchanged but avoids zeros", r"两者都不变，只是避免零"), T(r"Every estimate changes: the large probabilities shrink as the small ones grow. That is exactly a trade of variance for bias.", r"每个估计都变了：大的概率缩小，小的增大。这正是用方差换偏差。"), 'smooth-free')],
               T(r"Smoothing is a prior: it adds bias, but makes the estimate less sensitive to individual observations.", r"平滑就是先验：增加偏差，但让估计对个别观察不那么敏感。")),
        tq('p6', T('Short answer: why does it work?', '简答：为什么它还管用？'), 'nb.linear',
               T(r"Naive Bayes assumes the features are conditionally independent given the class, which is almost never true. Explain in 2-3 lines why it often still classifies well, and what it does badly.",
                 r"朴素贝叶斯假设特征在给定类别时条件独立，这几乎从不成立。用 2-3 行解释为什么它常常仍然分得好，以及它哪里做得不好。"),
               ['Classification only needs the correct class to have the highest score, not correct probabilities', 'Correlated features are double counted, so probabilities are over-confident (poorly calibrated)', 'Errors in the evidence often push all classes the same way, so the ranking survives'],
               'Classification only needs the correct class to receive the largest score, not accurate probabilities. Correlated features are counted several times, which makes the posterior probabilities over-confident (poorly calibrated), but the errors often push all classes in the same direction, so the argmax is unchanged. It does badly when dependent features point to different classes, and its probability outputs should not be trusted without calibration.',
               T(r"Name the distinction between ranking and calibration; mention double counting.", r"要点是“排序”与“校准”的区别，以及重复计数。")),
        tq('p7', T('Design question: a text classifier', '设计题：文本分类器'), 'nb.proscons',
               T(r"You must build a naive Bayes classifier that labels support emails as *urgent* or *not urgent*, using the words in each email (50,000-word vocabulary, 2,000 labelled emails). Describe, in a few lines: what the model is, how its parameters are estimated, how you deal with words not seen in the training emails of one class, how you make the computation numerically safe, and one weakness you would watch for.",
                 r"要用朴素贝叶斯把客服邮件分为*紧急*和*不紧急*，特征是邮件里的词（词表 5 万词，2000 封已标注邮件）。用几行话说明：模型是什么、参数怎么估计、对某类训练邮件里没出现过的词怎么办、怎样保证计算数值安全、以及一个要留意的弱点。"),
               ['Model: P(y) times product of P(word | y); choose the largest', 'Estimate by counting (relative frequencies per class)', 'Smoothing (add-one / add-alpha) for unseen words', 'Sum of log probabilities to avoid underflow', 'Weakness: conditional independence, correlated words, over-confident probabilities'],
               'Model: predict the class y that maximises P(y) multiplied by the product over the words of P(word | y), assuming words are conditionally independent given the class. Estimate P(y) as the fraction of emails in each class and P(word | y) as the relative frequency of the word among the emails of class y. Use add-one (Laplace) smoothing so a word unseen in one class does not make its probability zero. Add log probabilities instead of multiplying, to avoid underflow with thousands of small numbers. Weakness: words are correlated, so evidence is double counted and the probabilities are over-confident; the class decision is usually still fine.',
               T(r"A complete answer touches model, estimation, smoothing, logs, and a weakness.", r"完整的回答要涉及模型、估计、平滑、对数和一个弱点。")),
        read('remember', T('What to remember', '要记住的'),
             math_(r"\hat y = \arg\max_{y} P(y)\prod_{m=1}^{F} P(x_m \mid y) = \arg\max_y \Big[\log P(y) + \sum_m \log P(x_m \mid y)\Big]"),
             ul(T(r"**Derivation:** $\arg\max P(y \mid \mathbf{x})$ $\to$ Bayes' rule $\to$ drop $P(\mathbf{x})$ $\to$ conditional independence (the only approximation).", r"**推导：**$\arg\max P(y \mid \mathbf{x})$ $\to$ 贝叶斯公式 $\to$ 去掉 $P(\mathbf{x})$ $\to$ 条件独立（唯一的近似）。"),
                T(r"**Training:** priors and likelihoods by counting = maximum likelihood. Gaussian: per class mean and standard deviation.", r"**训练：**先验和似然靠计数 = 最大似然。高斯：每类的均值和标准差。"),
                T(r"**Zero counts:** $\varepsilon$-smoothing (fewest $\varepsilon$'s wins, $\varepsilon \ll 1/N$) or add-$\alpha$: $\frac{\text{count} + \alpha}{n(y) + \alpha V}$. Laplace = MAP with a Dirichlet prior. More bias, less variance.", r"**零计数：**ε 平滑（ε 最少的赢，$\varepsilon \ll 1/N$）或加 $\alpha$：$\frac{\text{count} + \alpha}{n(y) + \alpha V}$。拉普拉斯 = 狄利克雷先验下的 MAP。偏差更大、方差更小。"),
                T(r"**Logs:** sum of log probabilities against underflow; the largest log score wins.", r"**对数：**用对数概率求和防下溢；对数分数最大的赢。"),
                T(r"**Linear:** for binary features the log-odds is $b + \sum w_m x_m$, the form of logistic regression; fitted by counting instead.", r"**线性：**二值特征的对数几率是 $b + \sum w_m x_m$，与逻辑回归同形，只是用计数而不是优化来拟合。"),
                T(r"**Works anyway** because only the argmax matters; **but** probabilities are over-confident when features are correlated.", r"**仍然管用**，因为只有 argmax 重要；**但**特征相关时概率会过度自信。"),
                T(r"**Generative:** models $P(\mathbf{x}, y)$; handles missing values by dropping factors.", r"**生成式：**建模 $P(\mathbf{x}, y)$；缺失值靠去掉对应因子处理。"))),
    ]
    return dict(
        id=lid('naive-bayes'), title=T('Naive Bayes: counting, smoothing, and why it works', '朴素贝叶斯：计数、平滑，以及它为什么管用'),
        description=T('From argmax P(y|x) to the naive Bayes rule, estimation by counting, the zero-probability problem and smoothing (with Laplace as a Dirichlet prior), logs, the linear view and its limits.',
                      '从 argmax P(y|x) 推到朴素贝叶斯公式，计数估计，零概率问题与平滑（含拉普拉斯平滑作为狄利克雷先验），对数、线性视角及其局限。'),
        minutes=45,
        skills=[{'id': P, 'name': T('Derive the naive Bayes classifier', '推导朴素贝叶斯分类器')},
                {'id': EX, 'name': T('Conditional independence and its consequences', '条件独立及其后果')},
                {'id': EST, 'name': T('Estimate priors and likelihoods by counting (MLE)', '用计数（最大似然）估计先验与似然')},
                {'id': SM, 'name': T('Zero probabilities and smoothing', '零概率与平滑')},
                {'id': GA, 'name': T('Gaussian naive Bayes', '高斯朴素贝叶斯')},
                {'id': LG, 'name': T('Computing in log space', '在对数空间计算')},
                {'id': LIN, 'name': T('Naive Bayes as a linear classifier; calibration vs ranking', '朴素贝叶斯作为线性分类器；校准与排序')},
                {'id': PC, 'name': T('Strengths, weaknesses, generative view', '优缺点与生成式视角')}],
        misconceptions=[{'id': 'marginal-indep', 'description': T('Believing naive Bayes needs the features to be independent of each other, instead of independent given the class', '以为朴素贝叶斯要求特征彼此独立，而不是给定类别后独立')},
                        {'id': 'score-is-prob', 'description': T('Treating the unnormalised scores after dropping P(x) as probabilities', '把去掉 P(x) 之后未归一化的分数当成概率')},
                        {'id': 'zero-means-impossible', 'description': T('Reading a zero count as an impossible event rather than a small sample', '把零计数当成事件不可能，而不是样本太小')},
                        {'id': 'density-prob', 'description': T('Thinking a Gaussian density value must be at most 1', '以为高斯密度值必须不超过 1')}],
        steps=steps)


def tf_s(q):
    """A Fraction as plain text in a table cell: inline TeX."""
    q = Fr(q)
    return f'${tf(q)}$' if q.denominator != 1 else f'${q.numerator}$'



# ================================================================== linear regression: the deck's income data and the arithmetic
HRS = [40, 20, 60, 40, 45, 25, 40, 48, 40, 25]
INC = [58, 32, 87, 28, 63, 23, 36, 47, 47, 17]
N_I = len(HRS)
XB, YB = sum(HRS) / N_I, sum(INC) / N_I
SXY = sum((x - XB) * (y - YB) for x, y in zip(HRS, INC))
SXX = sum((x - XB) ** 2 for x in HRS)
B1 = SXY / SXX
B0 = YB - B1 * XB
RES = [y - (B0 + B1 * x) for x, y in zip(HRS, INC)]
RSS = sum(r * r for r in RES)
TSS = sum((y - YB) ** 2 for y in INC)
MSE_I, RMSE_I, MAE_I, R2_I = RSS / N_I, math.sqrt(RSS / N_I), sum(abs(r) for r in RES) / N_I, 1 - RSS / TSS
# the deck's slide 36/39 quotes (-13.13, 1.48): the minimum of a grid, not the exact least-squares solution
DECK_B0, DECK_B1 = -13.13, 1.48
MSE_DECK = sum((y - (DECK_B0 + DECK_B1 * x)) ** 2 for x, y in zip(HRS, INC)) / N_I
PRED_30 = B0 + B1 * 30
PRED_50 = B0 + B1 * 50
assert abs(B1 - 1.4774) < 1e-3 and abs(B0 + 12.786) < 1e-3

# normal equations by numpy-free solve for the toy used in gradient descent: x = 1..4, y = 2, 3, 5, 6
GX, GY = [1, 2, 3, 4], [2, 3, 5, 6]
G_ETA = 0.05


def grads(b0, b1, X=GX, Y=GY):
    n = len(X)
    r = [y - (b0 + b1 * x) for x, y in zip(X, Y)]
    return -2 / n * sum(r), -2 / n * sum(ri * x for ri, x in zip(r, X))


def gd_run(steps, eta=G_ETA, X=GX, Y=GY):
    b0 = b1 = 0.0
    out = [(b0, b1, None, None)]
    for _ in range(steps):
        g0, g1 = grads(b0, b1, X, Y)
        b0, b1 = b0 - eta * g0, b1 - eta * g1
        out.append((b0, b1, g0, g1))
    return out


GD = gd_run(2)
G0_1, G1_1 = GD[1][2], GD[1][3]
assert abs(G0_1 + 8) < 1e-12 and abs(G1_1 + 23.5) < 1e-12 and abs(GD[1][1] - 1.175) < 1e-12
GXB, GYB = sum(GX) / 4, sum(GY) / 4
G_CF1 = sum((x - GXB) * (y - GYB) for x, y in zip(GX, GY)) / sum((x - GXB) ** 2 for x in GX)
G_CF0 = GYB - G_CF1 * GXB
GD_LONG = gd_run(300)[-1]

# practice: one more gradient step on a different toy
PX, PY = [1, 2, 3], [3, 5, 4]
P_ETA = 0.1
p_g0, p_g1 = grads(0, 0, PX, PY)
P_B1 = -P_ETA * p_g1
P_B0 = -P_ETA * p_g0

# the learning rate on f(t) = (t - 1)^2: t <- t - eta * 2 (t - 1), started at t = 3
def lr_path(eta, k=4, t=3.0):
    out = [t]
    for _ in range(k):
        t = t - eta * 2 * (t - 1)
        out.append(t)
    return out


LR = {e: lr_path(e) for e in (0.1, 0.9, 1.1)}

# MSE by hand (practice)
MY, MP = [2, 4, 9], [3, 4, 6]
M_MSE = sum((a - b) ** 2 for a, b in zip(MY, MP)) / 3


def fig_fit(lang):
    pl = Plot(10, 65, 0, 100, 640, 400, left=76, right=96)
    pl.axes(lang == 'zh' and '工时' or 'hours', lang == 'zh' and '收入' or 'income', xticks=(20, 40, 60), yticks=(0, 50, 100))
    pl.curve(lambda x: B0 + B1 * x, 15, 62, BLUE, 3)
    for x, y in zip(HRS, INC):
        yh = B0 + B1 * x
        pl.seg((x, y), (x, yh), ORANGE, 2.5)
    for x, y in zip(HRS, INC):
        pl.dot(x, y, INK, 5.5)
    pl.text(62, B0 + B1 * 62, 'ŷ', BLUE, 20, 'start', dx=8, dy=6)
    pl.text(40, 58, 'ε', ORANGE, 18, 'start', dx=8, dy=-2)
    return pl.svg()


def L_linreg():
    MD, LS, MLE_, GDK, EV, PC = 'lr.model', 'lr.loss', 'lr.mle', 'lr.gd', 'lr.eval', 'lr.proscons'
    CF = 'lr.closedform'
    steps = [
        read('what', T('The model: a line (or hyperplane) through the data', '模型：穿过数据的一条线（或超平面）'),
             p(T(r"Regression predicts a **number**. Linear regression assumes the target is a weighted sum of the features plus a constant, so the data are summarised by a line in 2D and a hyperplane in higher dimensions. The deck predicts income (thousand dollars) from hours worked per week:",
                 r"回归预测的是一个**数**。线性回归假设目标等于各特征的加权和再加一个常数，所以数据被概括成二维里的一条直线、更高维里的一个超平面。课件用每周工时来预测收入（千美元）：")),
             table([T('Hours per week', '每周工时'), T('Income (thousand \\$)', '收入（千美元）')], *[[str(x), str(y)] for x, y in zip(HRS, INC)]),
             math_(r"\hat y = f(\mathbf{x}) = \beta_0 + \beta_1 x_1 + \dots + \beta_D x_D = \boldsymbol\beta^\top \mathbf{x} \qquad (x_0 = 1)"),
             ul(T(r"$y$: the **target** (dependent variable); $x_1, \dots, x_D$: the **features** (independent variables).", r"$y$：**目标**（因变量）；$x_1, \dots, x_D$：**特征**（自变量）。"),
                T(r"$\beta_0$: the **intercept** or bias, the prediction when all features are 0. $\beta_1, \dots, \beta_D$: the **weights**: $\beta_j$ is how much the prediction changes when $x_j$ grows by 1 and the other features stay fixed.", r"$\beta_0$：**截距**（偏置），所有特征为 0 时的预测。$\beta_1, \dots, \beta_D$：**权重**：$\beta_j$ 是 $x_j$ 增加 1、其他特征不变时预测的变化量。"),
                T(r"The trick $x_0 = 1$ folds the intercept into the dot product, so one formula $\boldsymbol\beta^\top\mathbf{x}$ covers everything. (The deck writes $\boldsymbol\beta$ where other lectures write $\boldsymbol\theta$.)", r"约定 $x_0 = 1$，把截距并进点积，一个式子 $\boldsymbol\beta^\top\mathbf{x}$ 就够了。（课件写 $\boldsymbol\beta$，别的讲座写 $\boldsymbol\theta$。）")),
             p(T(r"The deck's other examples use several features at once: income from age, years of education and hours worked. Two assumptions come with the model: the relationship really is **linear** (a one-unit change in a feature always changes the prediction by the same amount), and the features are **not highly correlated with each other**, or the weights become unstable (see the closed-form page).",
                 r"课件的另一些例子同时用多个特征：用年龄、受教育年数和工时预测收入。模型带着两条假设：关系确实是**线性**的（特征每变 1 个单位，预测总是变同样的量），以及特征之间**不能高度相关**，否则权重会不稳定（见闭式解那一页）。")),
             callout('warning', T('Interpolate, do not extrapolate', '只做内插，不要外推'),
                     T(r"Only predict inside the range of the training features (here 20 to 60 hours). Outside, nothing supports the line: the fitted line gives a **negative** income at 5 hours per week, and a straight line cannot keep going forever.", r"只在训练特征的范围内预测（这里是 20 到 60 小时）。范围之外没有数据支撑这条线：拟合出的线在每周 5 小时给出**负**收入，而直线不可能一直延伸下去。")),
             quiz(T(r"A line fitted on hours worked between 20 and 60 is used to predict income at 100 hours per week. What is the problem?", r"用工时在 20 到 60 之间拟合的直线，去预测每周 100 小时的收入。问题在哪？"),
                  [(T(r"None: a line is defined for every $x$", r"没问题：直线对每个 $x$ 都有定义"), T(r"Defined is not reliable: nothing in the data says the relationship stays linear out there (people at 100 hours may be burnt out, or paid by project).", r"有定义不等于可靠：数据里没有任何东西说明到那里关系还是线性的（100 小时的人也许已经透支，或者按项目拿钱）。")),
                   (T(r"Extrapolation: the model is untested outside the data range, so the prediction is unreliable", r"外推：模型在数据范围之外没有验证过，预测不可靠"), True),
                   (T(r"The intercept would be negative", r"截距会是负的"), T(r"The intercept is the value at 0 hours, which is another extrapolation, not the reason this one fails.", r"截距是 0 小时的取值，那本身也是外推，并不是这里出问题的原因。"))],
                  T(r"Interpolation (inside the observed range) is safe; extrapolation is a guess.", r"内插（在观测范围内）是安全的；外推只是猜测。")),
             chapter=T('The loss and the closed form', '损失函数与闭式解')),
        read('loss', T('What "best line" means: the loss', '“最好的线”是什么意思：损失函数'),
             svg(drawn(fig_fit), T('Ten income points, the least-squares line, and a vertical segment from each point to the line: the residual.', '十个收入点、最小二乘直线，以及每个点到直线的竖直线段：残差。')),
             p(T(r"Many lines pass near the points. To pick **the** best one, measure each line's mistakes. The mistake on instance $i$ is the **residual** $\varepsilon_i = y_i - \hat y_i$, the vertical gap between the point and the line (the orange segments). Positive when the line is too low, negative when too high; if we just added them, the signs would cancel, so we square them first:",
                 r"很多直线都从点附近经过。要选出**那一条**最好的，就得衡量每条线的错误。第 $i$ 个实例的错误是**残差** $\varepsilon_i = y_i - \hat y_i$，也就是点到直线的竖直距离（橙色线段）。线太低时为正，太高时为负；直接相加正负会抵消，所以先平方：")),
             math_(r"\text{RSS} = \sum_{i=1}^{n}(y_i - \hat y_i)^2, \qquad \text{MSE}(\boldsymbol\beta) = \frac{1}{n}\sum_{i=1}^{n}(y_i - \hat y_i)^2 = \frac{1}{n}\sum_{i=1}^{n}\big(y_i - \boldsymbol\beta^\top\mathbf{x}_i\big)^2"),
             p(T(r"**Training** the model means finding the $\boldsymbol\beta$ that minimises this loss. Why squares? They are always positive, large mistakes count much more than small ones (twice as far off costs four times), and the function is smooth, so calculus works (next pages). The deck lists the alternatives: **RSS** (the sum), **MSE** (the mean), **RMSE** ($\sqrt{\text{MSE}}$, back in the units of $y$), **MAE** (mean of $|y_i - \hat y_i|$); only MSE is used for training in this lecture, and the others come with evaluation.",
                 r"**训练**模型就是找让这个损失最小的 $\boldsymbol\beta$。为什么平方？它总为正，大错误比小错误重得多（偏差两倍，代价四倍），而且函数光滑，可以用微积分（下几页）。课件列出的其他选择：**RSS**（和）、**MSE**（均值）、**RMSE**（$\sqrt{\text{MSE}}$，回到 $y$ 的单位）、**MAE**（$|y_i - \hat y_i|$ 的均值）；这一讲只用 MSE 来训练，其他的属于评估。")),
             p(T(r"Picture the loss as a surface over the parameters $(\beta_0, \beta_1)$: for linear regression it is a smooth bowl with **one** lowest point (the deck draws it on slides 35-36). Training is finding the bottom of the bowl, which is what the next three pages do exactly (calculus) and, later, step by step (gradient descent).",
                 r"把损失想成参数 $(\beta_0, \beta_1)$ 上方的一张曲面：对线性回归它是一个光滑的碗，只有**一个**最低点（课件第 35-36 页画了它）。训练就是找到碗底：接下来精确地做（微积分），再后面一步一步地做（梯度下降）。"))),
        derive('calculus', T('Finding a minimum: set the derivative to zero', '找最小值：令导数为零'),
               [(r"f(\theta) = (\theta - 1)^2", T(r"A warm-up with one parameter. At a minimum a smooth function is flat: its slope is zero. So the recipe is: write the function, differentiate, set the derivative to zero, solve.", r"一个参数的热身。光滑函数在最小值处是平的：斜率为零。所以步骤是：写出函数，求导，令导数为零，解出来。")),
                (r"\frac{\partial f}{\partial \theta} = 2(\theta - 1) = 0 \;\Rightarrow\; \hat\theta = 1", T(r"The derivative is $2(\theta - 1)$; it is zero at $\theta = 1$. Because $f$ is a **convex** bowl, this flat point is the global minimum (for a concave function it would be the global maximum).", r"导数是 $2(\theta - 1)$，在 $\theta = 1$ 处为零。因为 $f$ 是**凸**的碗，这个平点就是全局最小（凹函数的话则是全局最大）。")),
                (r"\log \mathcal{L}(\theta) = \log C + x\log\theta + (N - x)\log(1 - \theta)", T(r"The same recipe for the deck's spam model: $x$ spam among $N$ emails, likelihood $C\,\theta^{x}(1-\theta)^{N-x}$, $\theta = P(\text{spam})$. To maximise it, take the log first: the log is increasing, so the best $\theta$ is the same, and the product becomes a sum (easier derivatives, no underflow).", r"同样的步骤用在课件的垃圾邮件模型上：$N$ 封里有 $x$ 封垃圾，似然 $C\,\theta^{x}(1-\theta)^{N-x}$，$\theta = P(\text{spam})$。要最大化它，先取对数：对数递增，最优的 $\theta$ 不变，乘积变成和（导数更好求，也不会下溢）。")),
                (r"\frac{\partial \log\mathcal{L}}{\partial\theta} = \frac{x}{\theta} - \frac{N - x}{1 - \theta} = 0", T(r"Differentiate: $\log C$ is a constant and disappears; $\log\theta$ gives $1/\theta$; $\log(1-\theta)$ gives $-1/(1-\theta)$ by the chain rule. Set it to zero.", r"求导：$\log C$ 是常数，消失；$\log\theta$ 的导数是 $1/\theta$；$\log(1-\theta)$ 由链式法则得 $-1/(1-\theta)$。令它为零。")),
                (r"x(1 - \theta) = (N - x)\,\theta \;\Rightarrow\; x = N\theta", T(r"Multiply through by $\theta(1-\theta)$ and expand: the $x\theta$ terms cancel.", r"两边乘以 $\theta(1-\theta)$ 并展开：$x\theta$ 项抵消。")),
                (r"\hat\theta = \frac{x}{N} = \frac{20}{100} = 0.2", T(r"The best $\theta$ is the observed fraction: 20 spam out of 100 emails gives 0.2. Same recipe, whatever the function.", r"最优的 $\theta$ 就是观察到的比例：100 封里 20 封垃圾邮件，得 0.2。不论函数是什么，步骤都一样。"))],
               intro=T(r"Training a model is optimisation: find the parameters that make an objective as small (a loss) or as large (a likelihood) as possible.", r"训练模型就是优化：找参数，使目标函数尽可能小（损失）或尽可能大（似然）。"),
               outro=T(r"Next, the same recipe with a vector $\boldsymbol\beta$ instead of a number $\theta$.", r"接下来，同样的步骤，只是 $\theta$ 换成向量 $\boldsymbol\beta$。"), skill=LS),
        derive('normal', T('The normal equation by matrix calculus', '用矩阵微积分推出正规方程'),
               [(r"\text{MSE}(\boldsymbol\beta) = \frac{1}{n}(\mathbf{y} - \mathbf{X}\boldsymbol\beta)^\top(\mathbf{y} - \mathbf{X}\boldsymbol\beta)", T(r"Stack the data. $\mathbf{X}$ is the $n \times (D+1)$ matrix whose row $i$ is $\mathbf{x}_i^\top$ (first column all ones); $\mathbf{y}$ is the vector of the $n$ targets. Then $\mathbf{X}\boldsymbol\beta$ is the vector of all predictions at once, $\mathbf{y} - \mathbf{X}\boldsymbol\beta$ the vector of residuals, and a vector times its own transpose is the sum of its squared entries: this is $\frac1n\sum_i \varepsilon_i^2$.", r"把数据堆起来。$\mathbf{X}$ 是 $n \times (D+1)$ 的矩阵，第 $i$ 行是 $\mathbf{x}_i^\top$（第一列全是 1）；$\mathbf{y}$ 是 $n$ 个目标组成的向量。于是 $\mathbf{X}\boldsymbol\beta$ 是所有预测的向量，$\mathbf{y} - \mathbf{X}\boldsymbol\beta$ 是残差向量，向量乘自己的转置就是各分量平方和：这正是 $\frac1n\sum_i \varepsilon_i^2$。")),
                (r"= \frac{1}{n}\big[\mathbf{y}^\top\mathbf{y} - \mathbf{y}^\top\mathbf{X}\boldsymbol\beta - \boldsymbol\beta^\top\mathbf{X}^\top\mathbf{y} + \boldsymbol\beta^\top\mathbf{X}^\top\mathbf{X}\boldsymbol\beta\big]", T(r"Expand the product like $(a-b)^2$, remembering that $(\mathbf{X}\boldsymbol\beta)^\top = \boldsymbol\beta^\top\mathbf{X}^\top$ (a transpose reverses the order).", r"像 $(a-b)^2$ 一样展开，注意 $(\mathbf{X}\boldsymbol\beta)^\top = \boldsymbol\beta^\top\mathbf{X}^\top$（转置会把顺序反过来）。")),
                (r"= \frac{1}{n}\big[\mathbf{y}^\top\mathbf{y} - 2\,\mathbf{y}^\top\mathbf{X}\boldsymbol\beta + \boldsymbol\beta^\top\mathbf{X}^\top\mathbf{X}\boldsymbol\beta\big]", T(r"The two middle terms are the same number: each is a $1 \times 1$ matrix (a scalar), and a scalar equals its own transpose. Combine them. This is the form on the deck's slide 37.", r"中间两项是同一个数：它们都是 $1 \times 1$ 矩阵（标量），而标量等于它自己的转置。合并。这就是课件第 37 页的形式。")),
                (r"\nabla_{\boldsymbol\beta}\,(\mathbf{a}^\top\boldsymbol\beta) = \mathbf{a}, \qquad \nabla_{\boldsymbol\beta}\,(\boldsymbol\beta^\top\mathbf{A}\boldsymbol\beta) = 2\mathbf{A}\boldsymbol\beta", T(r"Two rules of matrix calculus (gradient = the vector of partial derivatives). First: $\mathbf{a}^\top\boldsymbol\beta = \sum_j a_j\beta_j$, whose derivative with respect to $\beta_j$ is $a_j$. Second, for a **symmetric** matrix $\mathbf{A}$: the quadratic form $\boldsymbol\beta^\top\mathbf{A}\boldsymbol\beta$ is the multi-dimensional version of $a\beta^2$, whose derivative is $2a\beta$.", r"两条矩阵微积分规则（梯度 = 偏导数组成的向量）。第一条：$\mathbf{a}^\top\boldsymbol\beta = \sum_j a_j\beta_j$，对 $\beta_j$ 的导数是 $a_j$。第二条，$\mathbf{A}$ 为**对称**矩阵时：二次型 $\boldsymbol\beta^\top\mathbf{A}\boldsymbol\beta$ 是 $a\beta^2$ 的多维版本，导数是 $2a\beta$。"),
                 T(r"$\mathbf{X}^\top\mathbf{X}$ is symmetric: $(\mathbf{X}^\top\mathbf{X})^\top = \mathbf{X}^\top\mathbf{X}$. It plays the role of $\mathbf{A}$, and $\mathbf{a}^\top = \mathbf{y}^\top\mathbf{X}$, i.e. $\mathbf{a} = \mathbf{X}^\top\mathbf{y}$.", r"$\mathbf{X}^\top\mathbf{X}$ 是对称的：$(\mathbf{X}^\top\mathbf{X})^\top = \mathbf{X}^\top\mathbf{X}$。它扮演 $\mathbf{A}$，而 $\mathbf{a}^\top = \mathbf{y}^\top\mathbf{X}$，即 $\mathbf{a} = \mathbf{X}^\top\mathbf{y}$。")),
                (r"\frac{\partial\,\text{MSE}}{\partial\boldsymbol\beta} = \frac{1}{n}\big[-2\,\mathbf{X}^\top\mathbf{y} + 2\,\mathbf{X}^\top\mathbf{X}\boldsymbol\beta\big]", T(r"Differentiate term by term: $\mathbf{y}^\top\mathbf{y}$ has no $\boldsymbol\beta$, so its derivative is 0; the other two use the rules. This is slide 38.", r"逐项求导：$\mathbf{y}^\top\mathbf{y}$ 里没有 $\boldsymbol\beta$，导数为 0；另两项用上面两条规则。这是课件第 38 页。")),
                (r"\mathbf{X}^\top\mathbf{X}\,\boldsymbol\beta = \mathbf{X}^\top\mathbf{y}", T(r"Set the gradient to zero and drop the factor $2/n$. This is the **normal equation**: $D+1$ linear equations in the $D+1$ unknown weights.", r"令梯度为零，去掉因子 $2/n$。这就是**正规方程**：$D+1$ 个未知权重的 $D+1$ 个线性方程。")),
                (r"\hat{\boldsymbol\beta} = (\mathbf{X}^\top\mathbf{X})^{-1}\mathbf{X}^\top\mathbf{y}", T(r"Multiply both sides by the inverse of $\mathbf{X}^\top\mathbf{X}$, if it exists. This is the closed form: no iterations, one formula.", r"两边左乘 $\mathbf{X}^\top\mathbf{X}$ 的逆（如果存在）。这就是闭式解：不用迭代，一个公式。")),
                (r"\frac{\partial^2\,\text{MSE}}{\partial\boldsymbol\beta\,\partial\boldsymbol\beta^\top} = \frac{2}{n}\mathbf{X}^\top\mathbf{X} \succeq 0", T(r"Is the flat point a minimum, not a maximum or saddle? The second derivative (the Hessian) is $\frac2n\mathbf{X}^\top\mathbf{X}$. For any vector $\mathbf{v}$, $\mathbf{v}^\top\mathbf{X}^\top\mathbf{X}\mathbf{v} = \lVert\mathbf{X}\mathbf{v}\rVert^2 \ge 0$, so the Hessian is positive semi-definite: MSE is **convex**, a bowl, and any point with zero gradient is a global minimum.", r"这个平点是最小值，而不是最大值或鞍点吗？二阶导数（海森矩阵）是 $\frac2n\mathbf{X}^\top\mathbf{X}$。对任意向量 $\mathbf{v}$，$\mathbf{v}^\top\mathbf{X}^\top\mathbf{X}\mathbf{v} = \lVert\mathbf{X}\mathbf{v}\rVert^2 \ge 0$，所以海森矩阵半正定：MSE 是**凸**的（一个碗），梯度为零的点都是全局最小。"))],
               intro=T(r"The deck states this result and says its derivation is not examined (slides 37-38: \"the specific formulas will not be part of any assignment or exam\"). Doing it once makes the formula something you can rebuild, not memorise.", r"课件给出了这个结果，并说明推导不考（第 37-38 页：具体公式不会出现在作业或考试里）。亲手做一遍，公式就是可以重建的，而不是死记的。"),
               outro=T(r"The one thing worth remembering for the exam is the shape of the result: $\mathbf{X}^\top\mathbf{X}\boldsymbol\beta = \mathbf{X}^\top\mathbf{y}$, and that it needs $\mathbf{X}^\top\mathbf{X}$ to be invertible.", r"考试里值得记的是结果的形状：$\mathbf{X}^\top\mathbf{X}\boldsymbol\beta = \mathbf{X}^\top\mathbf{y}$，以及它要求 $\mathbf{X}^\top\mathbf{X}$ 可逆。"),
               skill=CF),
        derive('income_fit', T('The deck\'s income data, by hand', '手算课件的收入数据'),
               [(r"\bar x = \frac{%d}{10} = %.1f, \qquad \bar y = \frac{%d}{10} = %.1f" % (sum(HRS), XB, sum(INC), YB), T(r"With one feature the normal equation has a simple solution. First the two means. The best line always passes through the point $(\bar x, \bar y)$.", r"只有一个特征时，正规方程有简单的解。先算两个均值。最优直线一定经过点 $(\bar x, \bar y)$。")),
                (r"S_{xy} = \sum_i (x_i - \bar x)(y_i - \bar y) = %.1f, \qquad S_{xx} = \sum_i (x_i - \bar x)^2 = %.1f" % (SXY, SXX), T(r"$S_{xy}$ measures how $x$ and $y$ move together (positive here: more hours, more income); $S_{xx}$ measures how much $x$ varies.", r"$S_{xy}$ 衡量 $x$ 和 $y$ 怎么一起变（这里为正：工时多、收入高）；$S_{xx}$ 衡量 $x$ 自己的波动。")),
                (r"\hat\beta_1 = \frac{S_{xy}}{S_{xx}} = \frac{%.1f}{%.1f} = %.4f" % (SXY, SXX, B1), T(r"The slope is the covariance over the variance: each extra weekly hour is associated with about $%.2f$K more income." % B1, r"斜率是协方差除以方差：每周多工作一小时，对应收入约多 $%.2f$ 千美元。" % B1)),
                (r"\hat\beta_0 = \bar y - \hat\beta_1\bar x = %.1f - %.4f \cdot %.1f = %.2f" % (YB, B1, XB, B0), T(r"The line goes through $(\bar x, \bar y)$, so the intercept follows from the slope.", r"直线经过 $(\bar x, \bar y)$，所以截距可由斜率推出。")),
                (r"\hat y = %.2f + %.3f\,x" % (B0, B1), T(r"The fitted line. Hand-check the matrix formula? For one feature, $(\mathbf{X}^\top\mathbf{X})^{-1}\mathbf{X}^\top\mathbf{y}$ gives exactly these two numbers.", r"拟合出的直线。用矩阵公式核对？一个特征时，$(\mathbf{X}^\top\mathbf{X})^{-1}\mathbf{X}^\top\mathbf{y}$ 给出的正是这两个数。")),
                (r"\hat y(30) = %.2f + %.3f \cdot 30 = %.1f" % (B0, B1, PRED_30), T(r"A prediction inside the data range (20 to 60 hours): about %.1fK for 30 hours per week." % PRED_30, r"数据范围（20 到 60 小时）内的一个预测：每周 30 小时约 %.1f 千美元。" % PRED_30))],
               outro=T(r"A detail: slides 36 and 39 quote $-13.13 + 1.48x$, the lowest point found on a grid of $(\beta_0, \beta_1)$ values. The exact least-squares line is $%.2f + %.3f\,x$; its MSE is %.2f, the grid point's %.2f. If an exam gives you a line, use the numbers given; if it asks you to fit, use the formulas." % (B0, B1, MSE_I, MSE_DECK),
                       r"一个细节：课件第 36 和 39 页给的是 $-13.13 + 1.48x$，那是在 $(\beta_0, \beta_1)$ 网格上找到的最低点。精确的最小二乘直线是 $%.2f + %.3f\,x$，MSE 为 %.2f，网格点的是 %.2f。考试给你一条线就用给定的数；要你拟合就用公式。" % (B0, B1, MSE_I, MSE_DECK)),
               skill=CF),
        read('closed', T('When the closed form misbehaves', '闭式解什么时候出问题'),
             p(T(r"$\hat{\boldsymbol\beta} = (\mathbf{X}^\top\mathbf{X})^{-1}\mathbf{X}^\top\mathbf{y}$ needs $\mathbf{X}^\top\mathbf{X}$ to be invertible. It is not when one feature is an exact linear combination of the others (an hours column duplicated, or \"age in years\" and \"age in months\"): then infinitely many $\boldsymbol\beta$ give the same predictions and the normal equation has no unique solution. When features are **highly correlated** but not identical, the inverse exists but is numerically unstable: tiny changes in the data swing the weights wildly, and individual weights lose their meaning (the deck: \"the inverse matrix becomes unstable\"). This is **multicollinearity**.",
                 r"$\hat{\boldsymbol\beta} = (\mathbf{X}^\top\mathbf{X})^{-1}\mathbf{X}^\top\mathbf{y}$ 要求 $\mathbf{X}^\top\mathbf{X}$ 可逆。当某个特征是其他特征的精确线性组合时（工时那一列重复了一份，或同时放“年龄（岁）”和“年龄（月）”）它不可逆：有无穷多个 $\boldsymbol\beta$ 给出同样的预测，正规方程没有唯一解。特征**高度相关**但不完全相同时，逆存在，但数值上不稳定：数据的微小变化会让权重大幅摆动，单个权重失去意义（课件：逆矩阵变得不稳定）。这就是**多重共线性**。")),
             ul(T(r"**Remedies:** drop or combine redundant features; collect more varied data; or **regularise** (below).", r"**对策：**删除或合并冗余特征；收集更多样的数据；或**正则化**（见下）。"),
                T(r"The weights are also not comparable across features when the features have different units; scaling makes them comparable (and is essential for gradient descent).", r"特征单位不同时，权重之间没法比较；缩放后才可比（对梯度下降尤其必要）。")),
             details(T('Beyond the deck: ridge and lasso regularisation', '课件之外：岭回归与 lasso 正则化'),
                     p(T(r"**Ridge** adds a penalty on the size of the weights: minimise $\text{MSE} + \lambda\lVert\boldsymbol\beta\rVert^2$ (not penalising $\beta_0$). The solution is $(\mathbf{X}^\top\mathbf{X} + n\lambda\mathbf{I})^{-1}\mathbf{X}^\top\mathbf{y}$: adding a positive amount to the diagonal makes the matrix always invertible and stabilises correlated features. **Lasso** penalises $\sum_j|\beta_j|$ instead and drives some weights exactly to zero, which selects features (see the feature-selection lesson). $\lambda$ trades bias for variance, like $\alpha$ in smoothing.",
                         r"**岭回归**对权重大小加惩罚：最小化 $\text{MSE} + \lambda\lVert\boldsymbol\beta\rVert^2$（不惩罚 $\beta_0$）。解为 $(\mathbf{X}^\top\mathbf{X} + n\lambda\mathbf{I})^{-1}\mathbf{X}^\top\mathbf{y}$：对角线加一个正数，矩阵就一定可逆，相关特征也稳定下来。**Lasso** 改为惩罚 $\sum_j|\beta_j|$，会把一些权重压到恰好为零，从而选出特征（见特征选择一课）。$\lambda$ 用偏差换方差，类似平滑里的 $\alpha$。")),
                     p(T(r"Standard sources: Hastie, Tibshirani and Friedman, *The Elements of Statistical Learning*, ch. 3; Bishop, *PRML*, §3.1.4. This is beyond what lecture 7 covers.", r"标准参考：Hastie、Tibshirani、Friedman《统计学习基础》第 3 章；Bishop《模式识别与机器学习》§3.1.4。这超出了第 7 讲的内容。"))),
             chapter=T('Why least squares: the maximum likelihood view', '为什么用最小二乘：最大似然的视角')),
        derive('gauss', T('Deeper: least squares is maximum likelihood under Gaussian noise', '深入：最小二乘就是高斯噪声下的最大似然'),
               [(r"y_i = \boldsymbol\beta^\top\mathbf{x}_i + \varepsilon_i, \qquad \varepsilon_i \sim \mathcal{N}(0, \sigma^2)", T(r"A probabilistic story for the line: the target is the linear prediction plus noise. The noise is a bell curve with mean 0 and the same variance $\sigma^2$ for every instance, and independent between instances.", r"给这条线配一个概率故事：目标 = 线性预测 + 噪声。噪声是均值为 0、方差对所有实例都是 $\sigma^2$ 的钟形曲线，且实例之间相互独立。")),
                (r"p(y_i \mid \mathbf{x}_i; \boldsymbol\beta, \sigma) = \frac{1}{\sqrt{2\pi\sigma^2}}\exp\!\Big(-\frac{(y_i - \boldsymbol\beta^\top\mathbf{x}_i)^2}{2\sigma^2}\Big)", T(r"So $y_i$ is Gaussian with mean $\boldsymbol\beta^\top\mathbf{x}_i$ and variance $\sigma^2$. This is the Gaussian density of Lecture 4, evaluated at the actual target.", r"所以 $y_i$ 服从均值 $\boldsymbol\beta^\top\mathbf{x}_i$、方差 $\sigma^2$ 的高斯分布。这就是第 4 讲的高斯密度，在真实目标处取值。")),
                (r"\mathcal{L}(\boldsymbol\beta, \sigma) = \prod_{i=1}^{n} p(y_i \mid \mathbf{x}_i; \boldsymbol\beta, \sigma)", T(r"The likelihood of the whole data set: because the instances are independent, multiply the densities.", r"整个数据集的似然：实例独立，所以把各密度相乘。")),
                (r"\log\mathcal{L} = \sum_{i}\Big[-\tfrac12\log(2\pi\sigma^2) - \frac{(y_i - \boldsymbol\beta^\top\mathbf{x}_i)^2}{2\sigma^2}\Big]", T(r"Take the log (product to sum, and $\log e^{u} = u$ removes the exponential).", r"取对数（乘积变和，$\log e^{u} = u$ 去掉指数）。")),
                (r"= -\frac{n}{2}\log(2\pi\sigma^2) - \frac{1}{2\sigma^2}\sum_{i}(y_i - \boldsymbol\beta^\top\mathbf{x}_i)^2", T(r"Pull out the constants. The last sum is exactly the RSS.", r"提出常数。最后那个和正是 RSS。")),
                (r"\arg\max_{\boldsymbol\beta}\log\mathcal{L} = \arg\min_{\boldsymbol\beta}\ \text{RSS}(\boldsymbol\beta) = \arg\min_{\boldsymbol\beta}\ \text{MSE}(\boldsymbol\beta)", T(r"As far as $\boldsymbol\beta$ is concerned, the first term is a constant, and the second is minus a positive number times the RSS. Maximising the likelihood is minimising the sum of squared errors: **the least-squares line is the maximum likelihood line** (dividing by $n$ changes nothing).", r"就 $\boldsymbol\beta$ 而言，第一项是常数，第二项是“负的正数乘以 RSS”。最大化似然就是最小化误差平方和：**最小二乘直线就是最大似然直线**（除以 $n$ 不影响）。")),
                (r"\frac{\partial\log\mathcal{L}}{\partial\sigma^2} = -\frac{n}{2\sigma^2} + \frac{\text{RSS}}{2\sigma^4} = 0 \;\Rightarrow\; \hat\sigma^2 = \frac{\text{RSS}}{n} = \text{MSE}", T(r"A bonus: set the derivative with respect to the noise variance to zero. The estimated noise variance is the MSE of the best line, so the MSE is also the estimate of how noisy the data are.", r"附送一个结果：对噪声方差求导并令其为零。估计出的噪声方差就是最优直线的 MSE，所以 MSE 同时也是对“数据有多嘈杂”的估计。"))],
               intro=T(r"Why squared error and not, say, absolute error? One answer: a modelling assumption about the noise.", r"为什么是平方误差，而不是绝对误差之类？一个回答：它对应一个关于噪声的建模假设。"),
               skill=MLE_),
        read('mle_view', T('What the maximum likelihood view tells you', '最大似然视角告诉了你什么'),
             ul(T(r"**Squared error silently assumes Gaussian noise with constant variance.** Where that is wrong, least squares is not the natural choice.", r"**平方误差悄悄假设了方差恒定的高斯噪声。**这个假设不对时，最小二乘就不是自然的选择。"),
                T(r"**Outliers hurt.** A Gaussian has thin tails: a point far from the line is astronomically unlikely, so the fit bends towards it to make it less unlikely. In loss terms, a point 10 units off costs 100, ten points 1 unit off cost only 10. (The deck lists this as a weakness.) Assuming heavier-tailed **Laplace** noise gives absolute error (MAE), which is more robust.", r"**离群点伤害大。**高斯的尾巴很细：离直线很远的点几乎不可能出现，拟合于是向它弯过去，让它“没那么不可能”。用损失的话说：偏差 10 的点代价 100，十个偏差 1 的点才共 10。（课件把它列为缺点。）若假设尾巴更厚的**拉普拉斯**噪声，得到的就是绝对误差（MAE），更稳健。"),
                T(r"**Regularisation is a prior.** A Gaussian prior on the weights turns the maximum likelihood estimate into the MAP estimate, which is ridge regression: the same bridge as Laplace smoothing in the naive Bayes lesson.", r"**正则化就是先验。**给权重加高斯先验，最大似然估计就变成 MAP 估计，也就是岭回归：和朴素贝叶斯那一课里拉普拉斯平滑是同一座桥。")),
             quiz(T(r"A data set has a few extreme outliers. Which change reduces their influence on the fitted line?", r"数据集里有几个极端离群点。哪种改变能减小它们对拟合直线的影响？"),
                  [(T(r"Use MSE with a smaller learning rate", r"仍用 MSE，学习率调小"), T(r"The learning rate changes how fast we descend, not where the minimum is; the outliers still dominate the loss.", r"学习率只影响下降的快慢，不影响最小值的位置；离群点仍然主导损失。")),
                   (T(r"Use absolute error (MAE) instead of squared error", r"改用绝对误差（MAE）代替平方误差"), True),
                   (T(r"Add more features", r"增加特征"), T(r"More features give the model more freedom to chase the outliers; they do not reduce their weight in the loss.", r"更多特征让模型更自由地去迁就离群点，并不会减小它们在损失里的权重。"))],
                  T(r"Squared error penalises large residuals quadratically; absolute error only linearly.", r"平方误差对大残差按平方惩罚；绝对误差只按线性惩罚。")),
             chapter=T('Gradient descent', '梯度下降')),
        read('gd', T('Walking downhill: gradient descent', '沿着坡往下走：梯度下降'),
             p(T(r"The closed form is neat but uses a special fact (MSE has a solvable gradient equation). Most models, logistic regression and neural networks included, have no such formula. Gradient descent needs only the gradient: stand somewhere on the loss surface, feel which way is steepest **uphill** (the gradient $\nabla L$), and step the other way. Repeat.",
                 r"闭式解很漂亮，但它用了一个特殊事实（MSE 的梯度方程可以解出来）。大多数模型，包括逻辑回归和神经网络，都没有这样的公式。梯度下降只需要梯度：站在损失曲面上的某处，感觉哪个方向**上坡**最陡（梯度 $\nabla L$），朝相反方向迈一步，重复。")),
             math_(r"\boldsymbol\beta \;\leftarrow\; \boldsymbol\beta - \eta\,\nabla_{\boldsymbol\beta}\,\text{MSE}(\boldsymbol\beta), \qquad \nabla_{\boldsymbol\beta}\,\text{MSE} = \frac{2}{n}\mathbf{X}^\top(\mathbf{X}\boldsymbol\beta - \mathbf{y})"),
             ul(T(r"The gradient points uphill, so the **minus** sign makes us go downhill. At the minimum the gradient is 0 and the updates stop.", r"梯度指向上坡，所以**减号**让我们往下走。到了最小值，梯度为 0，更新自然停下。"),
                T(r"$\eta > 0$ is the **learning rate**, the step size. It is a setting you choose, not learned from the data.", r"$\eta > 0$ 是**学习率**，即步长。它是你选的设置，不是从数据里学到的。"),
                T(r"Because MSE is convex there is **one** valley: gradient descent cannot get stuck in a local minimum, whatever the start.", r"MSE 是凸的，只有**一个**谷：不论从哪出发，梯度下降都不会困在局部最小。")),
             p(T(r"This lecture sets up the idea (Lecture 8 develops iterative optimisation). What the learning rate does is easy to see on $f(\theta) = (\theta-1)^2$, whose update is $\theta \leftarrow \theta - 2\eta(\theta - 1)$, i.e. the distance to the minimum is multiplied by $1 - 2\eta$ each step. Starting at $\theta = 3$:",
                 r"这一讲只引入想法（第 8 讲会展开迭代优化）。学习率的作用在 $f(\theta) = (\theta-1)^2$ 上很容易看清：更新是 $\theta \leftarrow \theta - 2\eta(\theta - 1)$，即每步到最小值的距离乘以 $1 - 2\eta$。从 $\theta = 3$ 出发：")),
             table([T('Step', '步'), r'$\eta = 0.1$', r'$\eta = 0.9$', r'$\eta = 1.1$'],
                   *[[str(k)] + [f'{LR[e][k]:.3f}' for e in (0.1, 0.9, 1.1)] for k in range(5)]),
             p(T(r"$\eta = 0.1$: a steady crawl towards 1 (factor 0.8 per step). $\eta = 0.9$: overshoots to the other side each time but shrinks (factor $-0.8$). $\eta = 1.1$: factor $-1.2$, so each step lands **farther** away: divergence. Too small is slow, too large explodes; the loss should fall at each step, and if it rises, lower $\eta$.",
                 r"$\eta = 0.1$：稳稳地往 1 爬（每步因子 0.8）。$\eta = 0.9$：每次都冲到另一侧，但在缩小（因子 $-0.8$）。$\eta = 1.1$：因子 $-1.2$，每一步都落得**更远**：发散。太小则慢，太大则爆；损失应该每步下降，如果上升就调小 $\eta$。")),
             callout('note', T('Scale the features first', '先缩放特征'),
                     T(r"If one feature is in the thousands and another between 0 and 1, the loss bowl is a long narrow valley: a step size that is safe along the steep direction crawls along the flat one. Standardising each feature, $x \leftarrow (x - \text{mean})/\text{std}$, makes the bowl round, so one $\eta$ suits all weights. The closed form does not need scaling (the weights simply rescale).", r"如果一个特征在千的量级，另一个在 0 到 1 之间，损失的碗就是一道又长又窄的谷：在陡的方向上安全的步长，在平的方向上就慢得像爬。把每个特征标准化，$x \leftarrow (x - \text{均值})/\text{标准差}$，碗就变圆了，一个 $\eta$ 对所有权重都合适。闭式解不需要缩放（权重只是相应缩放）。"))),
        derive('grad', T('The gradient of MSE, one weight at a time', 'MSE 的梯度，一个权重一个权重地求'),
               [(r"\text{MSE} = \frac{1}{n}\sum_{i}\big(y_i - \beta_0 - \beta_1 x_i\big)^2", T(r"One feature, so two weights. $\hat y_i = \beta_0 + \beta_1 x_i$ inside the square.", r"一个特征，两个权重。平方里是 $\hat y_i = \beta_0 + \beta_1 x_i$。")),
                (r"\frac{\partial\,\text{MSE}}{\partial\beta_0} = \frac{1}{n}\sum_{i} 2\,(y_i - \hat y_i)\cdot(-1)", T(r"Chain rule: the derivative of $u^2$ is $2u$, times the derivative of the inside $u = y_i - \beta_0 - \beta_1 x_i$ with respect to $\beta_0$, which is $-1$.", r"链式法则：$u^2$ 的导数是 $2u$，乘以内部 $u = y_i - \beta_0 - \beta_1 x_i$ 对 $\beta_0$ 的导数，即 $-1$。")),
                (r"\frac{\partial\,\text{MSE}}{\partial\beta_0} = -\frac{2}{n}\sum_{i}(y_i - \hat y_i)", T(r"Tidy: minus twice the average residual. If the line is on average too low (positive residuals), the gradient is negative and the update $-\eta\cdot$gradient **raises** $\beta_0$.", r"整理：负的两倍平均残差。线平均偏低（残差为正）时，梯度为负，更新 $-\eta\cdot$梯度就会**抬高** $\beta_0$。")),
                (r"\frac{\partial\,\text{MSE}}{\partial\beta_1} = -\frac{2}{n}\sum_{i}(y_i - \hat y_i)\,x_i", T(r"For $\beta_1$ the inside's derivative is $-x_i$, so each residual is weighted by its feature value: the slope is corrected most by the instances with large $x_i$.", r"对 $\beta_1$，内部的导数是 $-x_i$，所以每个残差按其特征值加权：斜率主要由 $x_i$ 大的实例来修正。")),
                (r"\beta_0 \leftarrow \beta_0 + \frac{2\eta}{n}\sum_i \varepsilon_i, \qquad \beta_1 \leftarrow \beta_1 + \frac{2\eta}{n}\sum_i \varepsilon_i x_i", T(r"The update rule, with $\varepsilon_i = y_i - \hat y_i$: move each weight in the direction that reduces the residuals. For many features, $\beta_j \leftarrow \beta_j + \frac{2\eta}{n}\sum_i \varepsilon_i x_{ij}$, which is the matrix form $\frac{2}{n}\mathbf{X}^\top(\mathbf{X}\boldsymbol\beta - \mathbf{y})$ of the previous page.", r"更新规则，$\varepsilon_i = y_i - \hat y_i$：把每个权重朝能减小残差的方向移动。特征很多时，$\beta_j \leftarrow \beta_j + \frac{2\eta}{n}\sum_i \varepsilon_i x_{ij}$，也就是上一页的矩阵形式 $\frac{2}{n}\mathbf{X}^\top(\mathbf{X}\boldsymbol\beta - \mathbf{y})$。"))],
               skill=GDK),
        derive('gd_ex', T('Two steps of gradient descent by hand', '手算两步梯度下降'),
               [(r"(x, y):\ (1, 2),\ (2, 3),\ (3, 5),\ (4, 6), \qquad \boldsymbol\beta = (0, 0),\ \eta = %.2f" % G_ETA, T(r"A tiny data set, start at $\beta_0 = \beta_1 = 0$ (predict 0 everywhere), $\eta = 0.05$. All residuals are just the targets: $2, 3, 5, 6$.", r"一个很小的数据集，从 $\beta_0 = \beta_1 = 0$ 出发（处处预测 0），$\eta = 0.05$。所有残差就是目标本身：$2, 3, 5, 6$。")),
                (r"g_0 = -\tfrac{2}{4}(2 + 3 + 5 + 6) = %.1f" % G0_1, T(r"Gradient for $\beta_0$: minus twice the mean residual.", r"$\beta_0$ 的梯度：负的两倍平均残差。")),
                (r"g_1 = -\tfrac{2}{4}(2\cdot 1 + 3\cdot 2 + 5\cdot 3 + 6\cdot 4) = %.1f" % G1_1, T(r"Gradient for $\beta_1$: residuals weighted by $x$: $2 + 6 + 15 + 24 = 47$, times $-\frac24$.", r"$\beta_1$ 的梯度：残差乘以 $x$ 加权：$2 + 6 + 15 + 24 = 47$，再乘 $-\frac24$。")),
                (r"\beta_0 \leftarrow 0 - %.2f\cdot(%.1f) = %.2f" % (G_ETA, G0_1, GD[1][0]), T(r"Update: both gradients are negative (the line is too low), so both weights increase.", r"更新：两个梯度都是负的（线太低），所以两个权重都增加。")),
                (r"\beta_1 \leftarrow 0 - %.2f\cdot(%.1f) = %.3f" % (G_ETA, G1_1, GD[1][1]), T(r"The slope update. After one step the line is $%.2f + %.3f\,x$." % (GD[1][0], GD[1][1]), r"斜率的更新。一步之后直线是 $%.2f + %.3f\,x$。" % (GD[1][0], GD[1][1]))),
                (r"k{=}2:\ g = (%.3f,\ %.3f) \;\Rightarrow\; \boldsymbol\beta = (%.4f,\ %.4f)" % (GD[2][2], GD[2][3], GD[2][0], GD[2][1]), T(r"Repeat with the new residuals. The gradients are far smaller (the line is already close), so the steps shrink: gradient descent slows down as it nears the bottom.", r"用新的残差重复。梯度小得多（线已经很接近了），所以步子变小：梯度下降在接近谷底时自然放慢。"))],
               outro=T(r"After 300 steps the weights are $(%.3f,\ %.3f)$; the closed form gives $(%.3f,\ %.3f)$: the same line, reached by two routes." % (GD_LONG[0], GD_LONG[1], G_CF0, G_CF1),
                       r"300 步之后权重是 $(%.3f,\ %.3f)$；闭式解是 $(%.3f,\ %.3f)$：同一条直线，两条路到达。" % (GD_LONG[0], GD_LONG[1], G_CF0, G_CF1)),
               blank=(4, '%.3f' % GD[1][1], T(r"What is $\beta_1$ after one step? Compute $0 - 0.05 \cdot (-23.5)$.", r"一步之后 $\beta_1$ 是多少？算 $0 - 0.05 \cdot (-23.5)$。")), skill=GDK),
        read('compare', T('Closed form or gradient descent?', '闭式解还是梯度下降？'),
             table(['', T('Normal equation', '正规方程'), T('Gradient descent', '梯度下降')],
                   [T('Result', '结果'), T('the exact minimum in one shot', '一步到位的精确最小值'), T('approaches the minimum; stop when the loss stops falling', '逐步逼近最小值；损失不再下降时停')],
                   [T('Cost', '代价'), T(r'$O(nD^2)$ to form $\mathbf{X}^\top\mathbf{X}$, $O(D^3)$ to solve', r'构造 $\mathbf{X}^\top\mathbf{X}$ 要 $O(nD^2)$，求解要 $O(D^3)$'), T(r'$O(nD)$ per step, times the number of steps', r'每步 $O(nD)$，乘以步数')],
                   [T('Good when', '适用于'), T('few features (up to thousands), data fits in memory', '特征不多（至多几千），数据能放进内存'), T('many features or huge $n$ (use a random mini-batch per step: stochastic gradient descent)', '特征很多或 $n$ 极大（每步用随机小批量：随机梯度下降）')],
                   [T('Settings', '要设置的'), T('none', '无'), T('learning rate $\\eta$, number of steps; scale the features', '学习率 $\\eta$、步数；要缩放特征')],
                   [T('Problems', '问题'), T('singular or unstable $\\mathbf{X}^\\top\\mathbf{X}$ (collinearity)', '$\\mathbf{X}^\\top\\mathbf{X}$ 奇异或不稳定（共线性）'), T('slow if badly scaled; diverges if $\\eta$ is too big', '缩放不好时很慢；$\\eta$ 太大会发散')],
                   [T('Other models', '别的模型'), T('only linear least squares', '只适用于线性最小二乘'), T('works for any differentiable loss (logistic regression, neural networks)', '适用于任何可微损失（逻辑回归、神经网络）')]),
             p(T(r"In practice software rarely forms $(\mathbf{X}^\top\mathbf{X})^{-1}$ explicitly: it solves the equations with a numerically stable factorisation (QR or SVD). The formula is for understanding; the factorisation is for computing. Both approaches find the same line because the loss has only one valley.",
                 r"实际中软件很少真的去算 $(\mathbf{X}^\top\mathbf{X})^{-1}$，而是用数值稳定的分解（QR 或 SVD）来解方程。公式用于理解，分解用于计算。两种办法找到同一条线，因为这个损失只有一个谷。")),
             quiz(T(r"During gradient descent the training loss goes up at every step. What do you try first?", r"梯度下降时训练损失每步都在上升。你先试什么？"),
                  [(T(r"A larger learning rate, to move faster", r"更大的学习率，走得快一点"), T(r"A rising loss means the steps overshoot the valley; a larger step overshoots more.", r"损失上升说明步子冲过了谷；步子更大冲得更远。")),
                   (T(r"Switch to the closed form", r"改用闭式解"), T(r"That works for this model but does not answer the question; with a non-linear model there is no closed form to switch to.", r"对这个模型可行，但没回答问题；换成非线性模型就没有闭式解可换了。")),
                   (T(r"A smaller learning rate (and check the feature scales)", r"更小的学习率（并检查特征尺度）"), True)],
                  T(r"Divergence means $\eta$ is too large for the loss surface; lower it, or standardise features.", r"发散说明 $\eta$ 对这个损失曲面来说太大；调小它，或标准化特征。")),
             chapter=T('Evaluation, strengths and weaknesses', '评估、优缺点')),
        read('eval', T('How good is the line? RSS, MSE, RMSE, MAE, R²', '这条线有多好？RSS、MSE、RMSE、MAE、R²'),
             p(T(r"The same residuals give several summaries. On the income data with the fitted line:", r"同一组残差可以给出几种概括。对收入数据和拟合的直线：")),
             table([T('Measure', '指标'), T('Formula', '公式'), T('Value', '数值'), T('Reading', '怎么读')],
                   ['RSS', r'$\sum_i \varepsilon_i^2$', f'{RSS:.1f}', T('total squared error; grows with $n$', '总平方误差；随 $n$ 增长')],
                   ['MSE', r'$\text{RSS}/n$', f'{MSE_I:.2f}', T('average squared error; units of $y$ squared', '平均平方误差；单位是 $y$ 的平方')],
                   ['RMSE', r'$\sqrt{\text{MSE}}$', f'{RMSE_I:.2f}', T('typical error in the units of $y$: about 10.9 thousand dollars here', '以 $y$ 为单位的典型误差：这里约 10.9 千美元')],
                   ['MAE', r'$\frac1n\sum_i|\varepsilon_i|$', f'{MAE_I:.2f}', T('average absolute error; less dominated by outliers', '平均绝对误差；受离群点影响较小')],
                   [r'$R^2$', r'$1 - \text{RSS}/\text{TSS}$', f'{R2_I:.3f}', T('share of the variance of $y$ explained by the line', '直线解释掉的 $y$ 的方差占比')]),
             p(T(r"$\text{TSS} = \sum_i (y_i - \bar y)^2 = %.1f$ is the error of the dumbest model, always predicting the mean $\bar y$. So $R^2 = 1$ means a perfect fit, $R^2 = 0$ no better than the mean (it can go negative on new data for a model worse than the mean). Here the hours explain about %.0f%% of the variation in income." % (TSS, 100 * R2_I),
                 r"$\text{TSS} = \sum_i (y_i - \bar y)^2 = %.1f$ 是最笨的模型（永远预测均值 $\bar y$）的误差。所以 $R^2 = 1$ 是完美拟合，$R^2 = 0$ 不比均值好（在新数据上，比均值还差的模型 $R^2$ 可以为负）。这里工时解释了收入变化的约 %.0f%%。" % (TSS, 100 * R2_I))),
             callout('warning', T('Measure on data the model has not seen', '要在模型没见过的数据上衡量'),
                     T(r"Training $R^2$ never falls when you add features, even useless ones: a model can chase noise. Judge a regression on held-out data (the evaluation lesson), where the choice of metric and the train/test split matter.", r"加特征时训练集上的 $R^2$ 永远不会下降，哪怕特征毫无用处：模型可以在追噪声。回归模型要在留出数据上评判（评估一课），那里指标的选择和训练/测试划分才是关键。"))),
        read('proscons', T('Pros and cons', '优点与缺点'),
             table([T('Advantages (deck)', '优点（课件）'), T('Why', '为什么')],
                   [T('Simple and interpretable', '简单、可解释'), T('each weight is the effect of a feature, others fixed', '每个权重是其他特征不变时该特征的作用')],
                   [T('Exact closed form', '有精确的闭式解'), T('normal equations: no iterative training for small data', '正规方程：数据小时不用迭代训练')],
                   [T('Cheap at prediction time', '预测时很便宜'), T('one dot product', '一个点积')],
                   [T('Strong baseline', '强基线'), T('try it before anything fancier', '先试它，再试更花哨的')]),
             table([T('Disadvantages (deck)', '缺点（课件）'), T('Why', '为什么')],
                   [T('Assumes linearity', '假设线性'), T('curved relationships are missed unless you add transformed features', '弯曲的关系抓不住，除非加变换后的特征')],
                   [T('Multicollinearity', '多重共线性'), T('correlated features make $\\mathbf{X}^\\top\\mathbf{X}$ unstable and weights unreliable', '相关特征让 $\\mathbf{X}^\\top\\mathbf{X}$ 不稳定、权重不可靠')],
                   [T('Sensitive to outliers', '对离群点敏感'), T('squared error: one far point can tilt the line (Gaussian-noise assumption)', '平方误差：一个远点就能把线拉歪（高斯噪声假设）')],
                   [T('Extrapolation is unreliable', '外推不可靠'), T('the line has no support outside the data range', '数据范围之外这条线没有依据')],
                   [T('Normal equations costly for many features', '特征很多时正规方程代价大'), T('$O(D^3)$ to solve: use gradient descent', '求解 $O(D^3)$：改用梯度下降')])),
        number('q1', T('Calculate: a prediction', '计算：一个预测'), MD,
               T(r"Using the exact least-squares line of the income data, $\hat y = %.3f + %.4f\,x$, what is the predicted income (in thousands of dollars) for 50 hours per week? One decimal." % (B0, B1),
                 r"用收入数据的精确最小二乘直线 $\hat y = %.3f + %.4f\,x$，每周 50 小时的预测收入是多少（千美元）？保留一位小数。" % (B0, B1)),
               round(PRED_50, 1), T(r"$%.3f + %.4f \times 50 = %.1f$. It is inside the data range (20 to 60), so interpolation." % (B0, B1, PRED_50), r"$%.3f + %.4f \times 50 = %.1f$。在数据范围（20 到 60）之内，是内插。" % (B0, B1, PRED_50)),
               tolerance=0.15, unit='thousand USD'),
        number('q2', T('Calculate: one gradient step', '计算：一步梯度下降'), GDK,
               T(r"Fit $\hat y = \beta_0 + \beta_1 x$ to $(1, 3), (2, 5), (3, 4)$ by gradient descent on the MSE, starting at $\beta_0 = \beta_1 = 0$ with $\eta = 0.1$. What is $\beta_1$ after **one** step? Three decimals.",
                 r"用 MSE 的梯度下降，对 $(1, 3), (2, 5), (3, 4)$ 拟合 $\hat y = \beta_0 + \beta_1 x$，从 $\beta_0 = \beta_1 = 0$ 出发，$\eta = 0.1$。**一步**之后 $\beta_1$ 是多少？保留三位小数。"),
               round(P_B1, 3),
               T(r"Residuals at the start are the targets $3, 5, 4$. $g_1 = -\frac{2}{3}(3\cdot1 + 5\cdot2 + 4\cdot3) = %.4f$. So $\beta_1 = 0 - 0.1 \cdot g_1 = %.3f$ (and $\beta_0 = %.3f$)." % (p_g1, P_B1, P_B0),
                 r"起点的残差就是目标 $3, 5, 4$。$g_1 = -\frac{2}{3}(3\cdot1 + 5\cdot2 + 4\cdot3) = %.4f$。所以 $\beta_1 = 0 - 0.1 \cdot g_1 = %.3f$（$\beta_0 = %.3f$）。" % (p_g1, P_B1, P_B0)),
               tolerance=0.002, hints=[T(r"Weight each residual by its $x$: $3\cdot 1 + 5 \cdot 2 + 4 \cdot 3$.", r"每个残差乘上它的 $x$：$3\cdot 1 + 5 \cdot 2 + 4 \cdot 3$。")]),
        number('q3', T('Calculate: MSE and RMSE', '计算：MSE 与 RMSE'), LS,
               T(r"A model predicts $\hat y = 3, 4, 6$ for the true values $y = 2, 4, 9$. What is the MSE? Three decimals.", r"模型对真实值 $y = 2, 4, 9$ 预测 $\hat y = 3, 4, 6$。MSE 是多少？保留三位小数。"),
               round(M_MSE, 3), T(r"Residuals $-1, 0, 3$; squares $1, 0, 9$; mean $\frac{10}{3} = %.3f$. (RMSE $= %.3f$.) Note the one big miss supplies 90%% of the loss." % (M_MSE, math.sqrt(M_MSE)), r"残差 $-1, 0, 3$；平方 $1, 0, 9$；均值 $\frac{10}{3} = %.3f$。（RMSE $= %.3f$。）注意那一个大错误占了 90%% 的损失。" % (M_MSE, math.sqrt(M_MSE))), tolerance=0.002),
        choice('q4', T('Check: two identical features', '检查：两个一模一样的特征'), CF,
               T(r"You add a copy of an existing feature to $\mathbf{X}$ and use the normal equation. What happens?", r"你把一个已有的特征复制一列加进 $\mathbf{X}$，再用正规方程。会怎样？"),
               [(T(r"The fit improves because the feature now counts twice", r"拟合变好，因为这个特征现在算了两次"), T(r"The model can only combine the two columns as $(\beta_a + \beta_b)x$: no new information, no better fit.", r"模型只能把两列合并为 $(\beta_a + \beta_b)x$：没有新信息，也不会更好。"), 'copy-helps'),
                (T(r"$\mathbf{X}^\top\mathbf{X}$ is singular, so there is no unique solution", r"$\mathbf{X}^\top\mathbf{X}$ 奇异，没有唯一解"), True),
                (T(r"Nothing: the weights are just halved", r"没事：权重各减半就是"), T(r"Splitting the weight in half is one of infinitely many equally good solutions, which is exactly why the solution is not unique and the inverse does not exist.", r"权重各减半只是无穷多个同样好的解之一，这正说明解不唯一、逆不存在。"), 'copy-halves')],
               T(r"Identical columns make $\mathbf{X}$ rank deficient, so $\mathbf{X}^\top\mathbf{X}$ cannot be inverted; near-identical columns give an unstable inverse.", r"两列相同使 $\mathbf{X}$ 秩亏，$\mathbf{X}^\top\mathbf{X}$ 无法求逆；近乎相同则逆不稳定。")),
        choice('q5', T('Check: why the squares', '检查：为什么是平方'), MLE_,
               T(r"Minimising the sum of squared errors is exactly maximum likelihood when we assume that the noise is:", r"最小化误差平方和，恰好等价于最大似然，当我们假设噪声是："),
               [(T(r"Gaussian with constant variance, independent between instances", r"方差恒定的高斯噪声，实例之间独立"), True),
                (T(r"Laplace (double exponential)", r"拉普拉斯（双指数）分布"), T(r"That gives the sum of **absolute** errors (MAE).", r"那得到的是**绝对**误差之和（MAE）。"), 'laplace-ls'),
                (T(r"Uniform on $[-1, 1]$", r"$[-1, 1]$ 上的均匀分布"), T(r"A uniform noise gives a flat likelihood inside the range and zero outside: no squared error appears.", r"均匀噪声在范围内似然是平的、范围外为零：不会出现平方误差。"), 'uniform-ls')],
               T(r"Log-likelihood of Gaussian noise contains $-(y - \boldsymbol\beta^\top\mathbf{x})^2/(2\sigma^2)$: maximising it is minimising squares.", r"高斯噪声的对数似然里含 $-(y - \boldsymbol\beta^\top\mathbf{x})^2/(2\sigma^2)$：最大化它就是最小化平方和。")),
        choice('q6', T('Check: the learning rate', '检查：学习率'), GDK,
               T(r"On $f(\theta) = (\theta - 1)^2$ gradient descent multiplies the distance to the minimum by $1 - 2\eta$ each step. For which $\eta$ does it **diverge**?", r"对 $f(\theta) = (\theta - 1)^2$，梯度下降每步把到最小值的距离乘以 $1 - 2\eta$。$\eta$ 取哪个会**发散**？"),
               [(T(r"$\eta = 0.9$", r"$\eta = 0.9$"), T(r"$|1 - 1.8| = 0.8 < 1$: it overshoots from side to side but the distance shrinks, so it still converges.", r"$|1 - 1.8| = 0.8 < 1$：来回冲过头，但距离在缩小，所以仍然收敛。"), 'overshoot-diverges'),
                (T(r"$\eta = 1.1$", r"$\eta = 1.1$"), True),
                (T(r"$\eta = 0.01$", r"$\eta = 0.01$"), T(r"Factor $0.98$: very slow but converging. Too small is inefficient, not divergent.", r"因子 $0.98$：很慢但收敛。太小是低效，不是发散。"), 'small-diverges')],
               T(r"Divergence needs $|1 - 2\eta| > 1$, i.e. $\eta > 1$.", r"发散要求 $|1 - 2\eta| > 1$，即 $\eta > 1$。")),
        tq('q7', T('Short answer: closed form vs gradient descent', '简答：闭式解与梯度下降'), GDK,
           T(r"Compare the normal equation and gradient descent for fitting a linear regression: what does each need, and when would you prefer each? (2-3 lines)", r"比较用正规方程和梯度下降拟合线性回归：各需要什么，什么时候选哪个？（2-3 行）"),
           ['Normal equation: exact solution in one step, needs X^T X invertible, cost cubic in the number of features', 'Gradient descent: iterative, needs a learning rate and feature scaling, cheap per step, scales to many features or data', 'Prefer the closed form for few features; gradient descent for many features/large data or models without a closed form'],
           'The normal equation gives the exact minimiser of the MSE in one step, beta = (X^T X)^{-1} X^T y, but it needs X^T X to be invertible (no collinear features) and costs about cubic time in the number of features. Gradient descent repeatedly moves beta against the gradient with a learning rate eta; each step is cheap, it needs a good eta and scaled features, but it scales to many features and large data and works for models with no closed form. Use the normal equation for small problems and gradient descent for large ones; both reach the same line because MSE is convex.',
           T(r"Cover cost, invertibility, learning rate and when to use which.", r"要点：代价、可逆性、学习率，以及何时用哪个。")),
        tq('q8', T('Design question: predicting house prices', '设计题：预测房价'), CF,
           T(r"You want to predict house prices from 200 features (floor area, rooms, a few hundred neighbourhood measures, many of them strongly correlated). A few sales are mansions at ten times the typical price. Describe how you would use linear regression: the model and loss, how you fit it, what problems you expect from the data, and how you would evaluate the result.",
             r"要用 200 个特征（面积、房间数、几百项社区指标，其中很多彼此强相关）预测房价；有几笔豪宅成交价是普通房的十倍。说明你会怎样用线性回归：模型和损失、怎么拟合、预计数据会带来什么问题、怎样评估结果。"),
           ['Model price = beta^T x with MSE loss, fit by the normal equation or gradient descent (scaled features)', 'Correlated features: multicollinearity makes weights unstable; drop/combine features or use regularisation (ridge/lasso)', 'Outliers: squared error is sensitive; consider robust loss (MAE) or transforming the target (log price)', 'Evaluate on held-out data with RMSE/MAE and R^2; do not extrapolate beyond the data range'],
           'Model: price = beta_0 + sum_j beta_j x_j, trained by minimising the MSE, either with the normal equation or, with 200 features and many houses, gradient descent on standardised features. The strongly correlated neighbourhood features cause multicollinearity: X^T X is unstable and individual weights are unreliable, so I would drop or combine redundant features or add ridge or lasso regularisation. The mansions are outliers that squared error weights heavily; I would check their influence, consider a more robust loss such as MAE, or model log price. I would evaluate on a held-out test set with RMSE or MAE (in dollars) and R^2, and avoid predicting for houses far outside the training range.',
           T(r"Mention the model, fitting method, collinearity, outliers and held-out evaluation.", r"要点：模型、拟合方法、共线性、离群点和留出集评估。")),
        read('remember', T('What to remember', '要记住的'),
             math_(r"\hat y = \boldsymbol\beta^\top\mathbf{x}, \qquad \text{MSE} = \frac1n\sum_i (y_i - \hat y_i)^2, \qquad \mathbf{X}^\top\mathbf{X}\boldsymbol\beta = \mathbf{X}^\top\mathbf{y}, \qquad \boldsymbol\beta \leftarrow \boldsymbol\beta - \eta\nabla\text{MSE}"),
             ul(T(r"**Model:** weighted sum of features plus intercept (use $x_0 = 1$). Interpolate; do not extrapolate.", r"**模型：**特征的加权和加截距（取 $x_0 = 1$）。可以内插，不要外推。"),
                T(r"**Loss:** squared residuals (RSS, MSE; RMSE in the units of $y$; MAE less outlier-sensitive). Convex: one minimum.", r"**损失：**残差平方（RSS、MSE；RMSE 的单位与 $y$ 相同；MAE 对离群点不那么敏感）。凸：只有一个最小值。"),
                T(r"**Closed form:** $\hat{\boldsymbol\beta} = (\mathbf{X}^\top\mathbf{X})^{-1}\mathbf{X}^\top\mathbf{y}$, from setting the gradient $\frac2n(\mathbf{X}^\top\mathbf{X}\boldsymbol\beta - \mathbf{X}^\top\mathbf{y})$ to zero. Fails or is unstable with collinear features; costly ($O(D^3)$) for many features.", r"**闭式解：**$\hat{\boldsymbol\beta} = (\mathbf{X}^\top\mathbf{X})^{-1}\mathbf{X}^\top\mathbf{y}$，由令梯度 $\frac2n(\mathbf{X}^\top\mathbf{X}\boldsymbol\beta - \mathbf{X}^\top\mathbf{y})$ 为零得到。特征共线时失效或不稳定；特征很多时代价高（$O(D^3)$）。"),
                T(r"**Maximum likelihood:** least squares = MLE with independent Gaussian noise of constant variance; MAE would be Laplace noise; ridge a Gaussian prior.", r"**最大似然：**最小二乘 = 独立、方差恒定的高斯噪声下的 MLE；MAE 对应拉普拉斯噪声；岭回归对应高斯先验。"),
                T(r"**Gradient descent:** $\beta_j \leftarrow \beta_j + \frac{2\eta}{n}\sum_i \varepsilon_i x_{ij}$. Learning rate: too small is slow, too large diverges. Standardise features.", r"**梯度下降：**$\beta_j \leftarrow \beta_j + \frac{2\eta}{n}\sum_i \varepsilon_i x_{ij}$。学习率：太小慢，太大发散。要标准化特征。"),
                T(r"**Pros/cons:** interpretable, simple, exact; but linear only, collinearity, outliers, extrapolation.", r"**优缺点：**可解释、简单、有精确解；但只能线性，怕共线性、离群点和外推。"))),
    ]
    return dict(
        id=lid('linreg'), title=T('Linear regression: the loss, the closed form, and gradient descent', '线性回归：损失、闭式解与梯度下降'),
        description=T('The linear model and its squared-error loss, the normal equation derived by matrix calculus, least squares as maximum likelihood under Gaussian noise, gradient descent versus the closed form, and how to judge a fit.',
                      '线性模型与平方误差损失，用矩阵微积分推出正规方程，最小二乘即高斯噪声下的最大似然，梯度下降与闭式解的对比，以及怎样评判拟合。'),
        minutes=45,
        skills=[{'id': MD, 'name': T('The linear model and its assumptions', '线性模型及其假设')},
                {'id': LS, 'name': T('Squared-error loss and optimisation by derivatives', '平方误差损失与用导数优化')},
                {'id': CF, 'name': T('Closed-form solution: the normal equation', '闭式解：正规方程')},
                {'id': MLE_, 'name': T('Least squares as maximum likelihood', '最小二乘即最大似然')},
                {'id': GDK, 'name': T('Gradient descent and the learning rate', '梯度下降与学习率')},
                {'id': EV, 'name': T('Evaluating a regression', '评估回归')},
                {'id': PC, 'name': T('Strengths and weaknesses of linear regression', '线性回归的优缺点')}],
        misconceptions=[{'id': 'extrapolate', 'description': T('Trusting a linear fit outside the range of the training features', '在训练特征范围之外信任线性拟合')},
                        {'id': 'big-lr', 'description': T('Thinking a larger learning rate always converges faster', '以为学习率越大收敛越快')},
                        {'id': 'ls-no-assumption', 'description': T('Thinking squared error makes no assumption about the noise', '以为平方误差对噪声没有任何假设')},
                        {'id': 'collinear-fine', 'description': T('Ignoring correlated features when using the normal equation', '用正规方程时忽视相关特征')}],
        steps=steps)


LESSONS = [L_naive_bayes, L_linreg]
