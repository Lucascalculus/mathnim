# COMP90049 lessons: the machine learning concepts (deck 02) and probability (deck 04). Coverage: coverage/basics.md.
import math
import statistics as st
from itertools import product

from ml_kit import *  # noqa: F401,F403

_read = read


_quiz = quiz
_quiz_count = [0]


def quiz(prompt, options, explain):  # the right option moves around from quiz to quiz
    opts = list(options)
    i = next(k for k, o in enumerate(opts) if o[1] is True)
    j = [1, 2, 0, 1, 0, 2][_quiz_count[0] % 6] % len(opts)
    _quiz_count[0] += 1
    opts[i], opts[j] = opts[j], opts[i]
    return _quiz(prompt, opts, explain)


def read(id, title, *blocks, chapter=None, skill=None):  # a read page carries no skill; the argument only documents it
    return _read(id, title, *blocks, chapter=chapter)


# ================================================================ lesson 1: concepts
# ---- numbers of the worked examples, all computed here
WEATHER = [  # the deck's weather.nominal, first ten rows are training, last four evaluation (slide 23)
    ('sunny', 'hot', 'high', 'FALSE', 'no'), ('sunny', 'hot', 'high', 'TRUE', 'no'), ('overcast', 'hot', 'high', 'FALSE', 'yes'),
    ('rainy', 'mild', 'high', 'FALSE', 'yes'), ('rainy', 'cool', 'normal', 'FALSE', 'yes'), ('rainy', 'cool', 'normal', 'TRUE', 'no'),
    ('overcast', 'cool', 'normal', 'TRUE', 'yes'), ('sunny', 'mild', 'high', 'FALSE', 'no'), ('sunny', 'cool', 'normal', 'FALSE', 'yes'),
    ('rainy', 'mild', 'normal', 'FALSE', 'yes'),
    ('sunny', 'mild', 'normal', 'TRUE', 'yes'), ('overcast', 'mild', 'high', 'TRUE', 'yes'), ('overcast', 'hot', 'normal', 'FALSE', 'yes'),
    ('rainy', 'mild', 'high', 'TRUE', 'no')]
CLASSIFIED = ['no', 'yes', 'yes', 'yes']  # the deck's predictions for the four evaluation rows
EVAL = WEATHER[10:]
CORRECT = sum(c == r[4] for c, r in zip(CLASSIFIED, EVAL))
TEMP_TRUE, TEMP_PRED = [75, 72, 81, 71], [68.8, 71.2, 79.6, 78.5]  # slide 27
TEMP_ERR = [round(abs(a - b), 1) for a, b in zip(TEMP_TRUE, TEMP_PRED)]
MAE = sum(TEMP_ERR) / 4

INC = [20, 22, 25, 27, 30, 33, 36, 40, 200]  # incomes in thousands, one outlier
INC_MIN, INC_MAX = min(INC), max(INC)
INC_W = (INC_MAX - INC_MIN) / 3
INC_EDGES = [INC_MIN + INC_W * k for k in range(4)]


def eq_width_bin(x, lo, hi, n):
    return min(int((x - lo) / ((hi - lo) / n)), n - 1)


INC_BINS = [sum(eq_width_bin(x, INC_MIN, INC_MAX, 3) == k for x in INC) for k in range(3)]
INC_SORTED = sorted(INC)
INC_FREQ = [INC_SORTED[0:3], INC_SORTED[3:6], INC_SORTED[6:9]]
INC_CUTS = [(INC_FREQ[0][-1] + INC_FREQ[1][0]) / 2, (INC_FREQ[1][-1] + INC_FREQ[2][0]) / 2]

Z = [2, 4, 4, 4, 5, 5, 7, 9]
Z_MU, Z_SD = st.mean(Z), st.pstdev(Z)
Z_MIN, Z_MAX = min(Z), max(Z)

MISS = [2, 4, 8, 10]  # observed values; the fifth is missing
MISS_MU = st.mean(MISS)
MISS_VAR0 = st.pvariance(MISS)
MISS_VAR1 = st.pvariance(MISS + [MISS_MU])

AGES = [21, 23, 24, 25, 29, 31, 34, 38, 60]  # practice
AGE_W = (max(AGES) - min(AGES)) / 3
AGE_FIRST = sum(eq_width_bin(a, min(AGES), max(AGES), 3) == 0 for a in AGES)
PZ = [4, 6, 6, 8, 8, 10, 12, 14]
PZ_Z = (14 - st.mean(PZ)) / st.pstdev(PZ)

N_ATTR = 3
N_INST = 2 ** N_ATTR
N_FUNC = 2 ** N_INST
N_SEEN = 5
N_LEFT = 2 ** (N_INST - N_SEEN)
assert (N_INST, N_FUNC, N_LEFT) == (8, 256, 8)
assert INC_BINS == [8, 0, 1] and AGE_FIRST == 6 and AGE_W == 13 and CORRECT == 2 and Z_MU == 5 and Z_SD == 2
assert INC_CUTS == [26, 34.5] and (MISS_VAR0, MISS_VAR1) == (10, 8)


# ---- figures
def fig_dataset(lang):
    f = Fig(640, 330, lang)
    cols = [f.L('Outlook', '天气'), f.L('Temp', '温度'), f.L('Humidity', '湿度'), f.L('Windy', '有风'), f.L('Play', '去玩')]
    x0, y0, cw, ch = 20, 70, 104, 40
    for j, c in enumerate(cols):
        last = j == 4
        f.rect(x0 + j * cw, y0, cw, ch, fill='#e8f0fe' if not last else '#fdecdc', stroke=LINE, sw=1.4, rx=0)
        f.text(x0 + j * cw + cw / 2, y0 + 26, c, 17, INK, 'middle', '600')
    for i, r in enumerate(WEATHER[:4]):
        for j, v in enumerate(r):
            f.rect(x0 + j * cw, y0 + ch * (i + 1), cw, ch, fill='#ffffff' if j < 4 else '#fff6ee', stroke=LINE, sw=1.4, rx=0)
            f.text(x0 + j * cw + cw / 2, y0 + ch * (i + 1) + 26, v, 17, INK, 'middle')
    f.text(x0 + 2 * cw, 36, f.L('attributes (features)', '属性（特征）'), 18, BLUE, 'middle', '600')
    f.line(x0 + 8, 50, x0 + 4 * cw - 8, 50, BLUE, 2)
    f.text(x0 + 4.5 * cw, 36, f.L('concept (label)', '概念（标签）'), 18, ORANGE, 'middle', '600')
    f.line(x0 + 4 * cw + 8, 50, x0 + 5 * cw - 8, 50, ORANGE, 2)
    yb = y0 + ch * 5 + 34
    f.line(x0 + cw * 5 + 18, y0 + ch * 2.5, x0 + cw * 5 + 4, y0 + ch * 2.5, PURPLE, 2, arrow=True)
    f.text(x0 + cw * 5 + 22, y0 + ch * 2.5 + 6, f.L('instance', '实例'), 18, PURPLE, 'start', '600')
    f.text(x0, yb, f.L('feature vector of the first instance:', '第一个实例的特征向量：'), 16, MUTED)
    f.text(x0 + 320, yb, '(sunny, hot, high, FALSE)', 18, BLUE, 'start', '600')
    return f.svg()


def fig_bins(lang):
    f = Fig(640, 280, lang)
    lo, hi, X0, X1 = INC_MIN, INC_MAX, 50, 590
    px = lambda v: X0 + (v - lo) / (hi - lo) * (X1 - X0)
    for title, y, edges, colour in ((f.L('equal width', '等宽'), 80, INC_EDGES, BLUE), (f.L('equal frequency', '等频'), 190, [lo] + INC_CUTS + [hi], GREEN)):
        f.text(X0, y - 44, title, 18, colour, 'start', '600')
        f.line(X0 - 10, y, X1 + 10, y, INK, 2)
        for e in edges:
            f.line(px(e), y - 22, px(e), y + 22, colour, 3, '6 4' if e not in (lo, hi) else None)
        for i, v in enumerate(INC):
            f.circle(px(v), y + (-8 if i % 2 else 8), 5, colour, '#ffffff', 1.5)
        for i, (a, b) in enumerate(zip(edges, edges[1:])):
            n = sum(a <= v < b or (b == hi and v == hi) for v in INC)
            f.text((px(a) + px(b)) / 2, y + 46 + 22 * (i % 2), f'n = {n}', 17, INK, 'middle')
    return f.svg()


def lagrange(pts, x):
    s = 0
    for i, (xi, yi) in enumerate(pts):
        t = yi
        for j, (xj, _) in enumerate(pts):
            if i != j:
                t *= (x - xj) / (xi - xj)
        s += t
    return s


FIT_PTS = [(0.5, 0.6), (1.2, 1.4), (2, 1.1), (2.8, 2.0), (3.6, 1.6), (4.4, 2.9), (5.2, 2.4)]


def fig_fit(lang):
    L = lambda en, zh: zh if lang == 'zh' else en
    pl = Plot(0, 5.8, -0.5, 4.6)
    pl.curve(lambda x: lagrange(FIT_PTS, x), 0.5, 5.2, ORANGE, 3, n=120)
    pl.curve(lambda x: 0.45 + 0.37 * x, 0.2, 5.6, BLUE, 3.5)
    for x, y in FIT_PTS:
        pl.dot(x, y, INK, 6)
    pl.text(5.7, 1.45, L('simple model', '简单模型'), BLUE, 17, 'end')
    pl.text(0.2, 4.0, L('memorises every point', '把每个点都背下来'), ORANGE, 17, 'start')
    pl.axes('x', 'y')
    return pl.svg()


def L_concepts():
    V, SET, AT, CV, GEN, BIAS = 'concepts.vocab', 'concepts.settings', 'concepts.attrs', 'concepts.convert', 'concepts.generalise', 'concepts.bias'
    cls_rows = [[r[0], r[1], r[2], r[3], r[4], c, '✓' if c == r[4] else '✗'] for r, c in zip(EVAL, CLASSIFIED)]
    reg_rows = [[str(a), str(b), str(e)] for a, b, e in zip(TEMP_TRUE, TEMP_PRED, TEMP_ERR)]
    return dict(
        id=lid('concepts'), title=T('Machine learning concepts: data, types and generalisation', '机器学习的基本概念：数据、属性类型与泛化'),
        description=T('The vocabulary of the subject, the learning settings, how to convert between attribute types and what each choice costs, and why a model is judged on data it has not seen.',
                      '这门课的词汇、各种学习设定、属性类型怎么互相转换及每种选择的代价，以及为什么要用没见过的数据来评判模型。'),
        minutes=40,
        skills=[{'id': V, 'name': T('Instances, attributes, labels', '实例、属性、标签')}, {'id': SET, 'name': T('Learning settings and tasks', '学习设定与任务')},
                {'id': AT, 'name': T('Attribute types', '属性类型')}, {'id': CV, 'name': T('Converting and cleaning attributes', '属性转换与清洗')},
                {'id': GEN, 'name': T('Generalisation and held-out data', '泛化与留出数据')}, {'id': BIAS, 'name': T('Inductive bias', '归纳偏置')}],
        misconceptions=[
            {'id': 'integer-codes', 'description': T('Coding a nominal attribute as 0, 1, 2, ... and feeding it to a numeric model as if the order and gaps meant something', '把名义属性编成 0, 1, 2, ... 当数字喂给数值模型，好像顺序和间隔有意义')},
            {'id': 'train-fit', 'description': T('Judging a model by its fit to the training data', '用模型对训练数据的拟合程度来评判模型')},
            {'id': 'bins-free', 'description': T('Treating discretisation as harmless: the bins throw information away and the cut points are a modelling choice', '以为离散化无伤大雅：分箱会丢信息，切点本身就是建模选择')},
            {'id': 'missing-random', 'description': T('Assuming every missing value is missing at random', '以为所有缺失值都是随机缺失')}],
        steps=[
            read('vocab', T('The vocabulary: instance, attribute, concept', '词汇：实例、属性、概念'),
                 p(T(r"Machine learning is learning from examples. Everything in the subject is built on three words, and the weather table below (the deck's running example, Quinlan 1986) shows all of them.",
                     r"机器学习就是从例子里学。这门课的一切都建在三个词上，下面的天气表（讲义里一直用的例子，Quinlan 1986）把它们都摆出来了。")),
                 svg(drawn(fig_dataset), T('The weather table: each row is an instance, the first four columns are attributes, the last column Play is the concept to learn. The first row as a feature vector is (sunny, hot, high, FALSE).',
                                           '天气表：每一行是一个实例，前四列是属性，最后一列 Play 是要学的概念。第一行写成特征向量就是 (sunny, hot, high, FALSE)。')),
                 table([T('Word', '词'), T('Meaning', '意思'), T('In the table', '在表里'), T('Symbol', '记号')],
                       [T('instance (example)', '实例（样本）'), T('one thing we have measured: an image, a sensor reading, a purchase', '我们测过的一个对象：一张图、一次传感器读数、一笔购买'), T('one row', '一行'), r'$\mathbf{x}^{(i)}$'],
                       [T('attribute (feature)', '属性（特征）'), T('one measured aspect; lets us compare and contrast instances', '被测量的一个方面，让我们能比较实例'), T('one column', '一列'), r'$x_j$'],
                       [T('concept (label, class)', '概念（标签、类别）'), T('the thing we aim to learn', '我们想学会的东西'), T('column Play', 'Play 这一列'), r'$y$'],
                       [T('feature vector', '特征向量'), T('the attribute values of one instance, stacked', '一个实例的属性值排在一起'), r'$(\text{sunny},\text{hot},\text{high},\text{FALSE})$', r'$\mathbf{x}=(x_1,\dots,x_F)$']),
                 p(T(r"A training set is $N$ pairs $(\mathbf{x}^{(i)}, y^{(i)})$. Learning means: from these pairs, find a rule that predicts $y$ for a new $\mathbf{x}$ whose label we do not know. The rest of the subject is about which rules, how to find them, and how to tell whether they are any good.",
                     r"训练集是 $N$ 对 $(\mathbf{x}^{(i)}, y^{(i)})$。学习的意思是：从这些对子里找出一条规则，对一个标签未知的新 $\mathbf{x}$ 预测 $y$。这门课其余的内容，就是在讲有哪些规则、怎么找、怎么判断它们好不好。")),
                 chapter=T('The vocabulary and the settings', '词汇与学习设定')),
            read('settings', T('Which kind of learning? Start from the labels', '哪一种学习？先看有没有标签'),
                 p(T(r"The first design decision of any project is whether you have labels, and what kind. The deck's concepts are four, and they sort into two families.",
                     r"任何项目的第一个设计决定，就是有没有标签、是什么标签。讲义里的“概念”有四种，分成两大家族。")),
                 table([T('Setting', '设定'), T('What is given', '给了什么'), T('What we learn', '要学什么'), T('Deck example', '讲义例子')],
                       [T('**Classification** (supervised)', '**分类**（监督）'), T('labelled instances, label is a discrete class', '带标签的实例，标签是离散类别'), T('map an instance to its class', '把实例映射到类别'), T('Play = yes/no; spam / not spam; digit 0-9', 'Play = yes/no；垃圾邮件；数字 0-9')],
                       [T('**Regression** (supervised)', '**回归**（监督）'), T('labelled instances, label is a number', '带标签的实例，标签是一个数'), T('map an instance to a number', '把实例映射到一个数'), T("tomorrow's temperature, 12°C", '明天的温度 12°C')],
                       [T('**Clustering** (unsupervised)', '**聚类**（无监督）'), T('instances only', '只有实例'), T('groups of similar instances', '相似实例形成的组'), T('groups of similar students; customer segmentation', '相似的学生群；客户细分')],
                       [T('**Association learning** (unsupervised)', '**关联学习**（无监督）'), T('instances only', '只有实例'), T('which attribute values occur together', '哪些属性值会一起出现'), T('milk and bread bought together, so butter is likely too (market basket, "beer and diapers")', '牛奶和面包一起买，黄油也很可能被买（购物篮分析，“啤酒与尿布”）')]),
                 p(T(r"**Supervised** learning has prior knowledge of the classes: it learns from labelled data to predict a label or a number for new, unseen instances. **Unsupervised** learning has no inventory of classes: it discovers hidden patterns, groups or relationships in unlabelled data. The deck lists more unsupervised flavours: **anomaly detection** (find instances that do not fit), **dimensionality reduction** (fewer features that keep what matters) and **market basket analysis**.",
                     r"**监督学习**事先知道有哪些类别：用带标签的数据学习，给新的、没见过的实例预测一个标签或一个数。**无监督学习**没有类别清单：在没有标签的数据里发现隐藏的模式、分组或关系。讲义列出的无监督“口味”还有：**异常检测**（找出不合群的实例）、**降维**（用更少的特征保住要紧的信息）和**购物篮分析**。")),
                 h(T('Deciding which type to use', '怎么决定用哪一类')),
                 table([T('Question', '问题'), T('Answer', '回答'), T('Setting', '设定'), T('Typical methods (deck)', '常见方法（讲义）')],
                       [T('Labelled data?', '有标签数据吗？'), T('yes, a category', '有，是类别'), T('classification', '分类'), T('neural network, logistic regression, random forest, naive Bayes, SVM', '神经网络、逻辑回归、随机森林、朴素贝叶斯、SVM')],
                       [T('(same question)', '（同上）'), T('yes, a quantity', '有，是数量'), T('regression', '回归'), T('SVM, neural network, ridge, random forest, lasso', 'SVM、神经网络、岭回归、随机森林、lasso')],
                       [T('no: group or fewer dimensions?', '没有：要分组还是要降维？'), T('group', '分组'), T('clustering', '聚类'), T('k-means, Gaussian mixture, DBSCAN, spectral, hierarchical', 'k-means、高斯混合、DBSCAN、谱聚类、层次聚类')],
                       [T('(same question)', '（同上）'), T('fewer dimensions', '降维'), T('dimensionality reduction', '降维'), T('PCA, LDA, Isomap, autoencoder', 'PCA、LDA、Isomap、自编码器')]),
                 p(T(r"The deck's fuller taxonomy adds two more families. **Semi-supervised** learning has a *few* labels and many unlabelled instances (text classification, lane-finding on GPS data). **Reinforcement** learning has no fixed labelled set: an agent acts, receives rewards, and learns a policy (optimised marketing, driverless cars). Both return in later lessons.",
                     r"讲义里更完整的分类还多两个家族。**半监督**学习有*少量*标签和大量无标签实例（文本分类、GPS 数据的车道检测）。**强化**学习没有固定的带标签数据集：智能体行动、得到奖励、学出一个策略（营销优化、自动驾驶）。两者在后面的课里还会出现。")),
                 callout('note', T('The mall scenario (slide 17)', '商场场景（第 17 页）'),
                         T(r"You run a mall with a membership system and hold only customer ID, date of birth and transactions. You do not know income, gender or who the VIPs are. You want to know *who your customers are*. With no labels this is **clustering**: find groups of customers who behave alike, then name them yourself. Success is judged subjectively (are the groups useful for marketing?), so evaluation is the hard part.",
                           r"你开一家有会员系统的商场，手里只有客户编号、出生日期和交易记录；不知道收入、性别，也不知道谁是 VIP。你想弄清“我的客户是谁”。没有标签，这就是**聚类**：找出行为相似的客户群，再自己给它们起名。好不好只能主观判断（这些群对营销有用吗），所以评估是难点。")),
                 quiz(T('A bank has 10,000 past loans, each marked "repaid" or "defaulted", and wants to score new applicants. Which setting?', '银行有 1 万笔过去的贷款，每笔都标了“已还”或“违约”，想给新的申请人打分。是哪种设定？'),
                      [(T('Clustering, because the loans fall into two groups', '聚类，因为贷款分成两组'), T('The two groups are given as labels. Clustering is for when nobody tells you the groups.', '这两组是作为标签给定的。聚类用在没人告诉你分组的时候。')),
                       (T('Classification: labelled data, discrete label', '分类：有标签的数据，标签离散'), True),
                       (T('Regression, because we output a score', '回归，因为输出一个分数'), T('The *label* is discrete (repaid/defaulted). A probability score is still a classifier output; regression means the true label is a number.', '*标签*是离散的（已还/违约）。概率分数仍是分类器的输出；回归指的是真实标签本身是个数。'))],
                      T('Ask two questions: are there labels? are they discrete or numeric?', '问两个问题：有没有标签？标签是离散的还是数值的？'))),
            read('class-reg', T('Classification vs regression, on the weather data', '分类与回归，用天气数据看'),
                 p(T(r"Both are supervised and both are scored on **held-out** instances whose labels we know but the model has not seen. The deck splits the 14 weather rows: the first 10 are *training data*, the last 4 *evaluation data*. A classifier trained on the 10 rows predicts Play for the 4:",
                     r"两者都是监督学习，都在**留出**的实例上打分：我们知道这些实例的标签，模型没见过。讲义把 14 行天气数据分开：前 10 行是*训练数据*，后 4 行是*评估数据*。用前 10 行训练出的分类器，给后 4 行预测 Play：")),
                 table([T('Outlook', '天气'), T('Temp', '温度'), T('Humidity', '湿度'), T('Windy', '有风'), T('True', '真实'), T('Classified', '预测'), ''], *cls_rows),
                 p(T(rf"A prediction is simply right or wrong: {CORRECT} of 4 are right. Regression is different. Here the label is the temperature in degrees and the deck's model predicts the four evaluation rows:",
                     rf"分类的预测非对即错：4 个里对 {CORRECT} 个。回归不同。这里的标签是温度（度数），讲义里的模型对四个评估行的预测是：")),
                 table([T('Actual', '实际'), T('Predicted', '预测'), T('Error', '误差')], *reg_rows),
                 p(T(r"Nobody expects 75.0 exactly; a prediction is 'correct' when it is acceptably close. That is the real difference. In classification we can **enumerate** all possible labels and a prediction must hit the right one. In regression there are infinitely many possible labels, and we ask how far off we were. So the scores differ too: accuracy-style counts for classes, an average of the errors for numbers (here $(6.2+0.8+1.4+7.5)/4 = " + f"{MAE:.3f}" + r"$, the mean absolute error, met again in the evaluation lesson).",
                     r"没人指望正好是 75.0；预测“足够接近”就算对。这才是真正的区别。分类里我们能**列举**所有可能的标签，预测必须命中正确的那一个。回归里可能的标签有无穷多个，我们问的是差了多远。所以打分方式也不同：类别用对错的计数，数值用误差的平均（这里 $(6.2+0.8+1.4+7.5)/4 = " + f"{MAE:.3f}" + r"$，即平均绝对误差，评估那一课还会再见）。")),
                 quiz(T("Predicting the number of customers tomorrow (0, 1, 2, ...) is…", '预测明天的客流量（0, 1, 2, ...）属于……'),
                      [(T('Classification, because the values are integers we could list', '分类，因为取值是整数，可以列出来'), T('The list never ends, and being off by 3 is much better than being off by 300. Closeness matters, so it is regression.', '这个列表没有尽头，而且差 3 远好过差 300。“接近”有意义，所以是回归。')),
                       (T('Clustering, because customers come in groups', '聚类，因为客户分成各种群'), T('We are given the true counts of past days, so it is supervised.', '过去每天的真实人数是已知的，所以是监督学习。')),
                       (T('Regression: an ordered quantity where being close counts', '回归：有序的数量，越接近越好'), True)],
                      T('Test: can you list every label, and is a wrong label simply wrong? Then classification. Is "nearly right" meaningful? Then regression.', '判别法：能不能列出所有标签，错了就是错了？那是分类。“差不多对”有意义吗？那是回归。')),
                 skill=SET),
            read('heldout', T('Training, evaluation and why they are kept apart', '训练数据、评估数据，以及为什么要分开'),
                 p(T(r"A supervised learner is handed **training data** and builds a model from it. We then measure success on **evaluation (held-out) data**: instances whose labels we know, but which the model never saw while learning. In the weather table the split is the horizontal line after row 10.",
                     r"监督学习算法拿到**训练数据**，从中建出模型。然后我们在**评估（留出）数据**上衡量成功：这些实例的标签我们知道，但学习期间模型从没见过。天气表里，分界线就是第 10 行之后那条横线。")),
                 p(T(r"Why not just score the model on the training rows? Because the model has seen those answers. A model that simply stores the table scores 10 of 10 on them and tells you nothing about a new day. The held-out rows play the role of the future, and the score on them is our estimate of how the model will do in use. This idea, generalisation, is the heart of the last chapter.",
                     r"为什么不直接在训练行上打分？因为这些答案模型已经见过。一个把表原样存起来的模型，在训练行上 10 题全对，却完全说明不了新的一天会怎样。留出行扮演“未来”，在它们上的得分就是我们对模型实际表现的估计。这个想法就是泛化，最后一章的核心。")),
                 quiz(T('You tune a model until its accuracy on the 4 evaluation rows is as high as possible, then report that accuracy. What is wrong?', '你不停调模型，直到它在 4 个评估行上的准确率最高，然后报告这个准确率。错在哪？'),
                      [(T('Nothing: held-out data is always an honest estimate', '没错：留出数据永远是诚实的估计'), T('Only if it was not used for any decision. Tuning on it makes it part of the training process.', '前提是没用它做过任何决定。拿它来调模型，它就成了训练过程的一部分。')),
                       (T('The evaluation rows were used to make choices, so they no longer stand in for unseen data', '评估行被用来做选择了，不再能代表没见过的数据'), True),
                       (T('The accuracy should be reported on the training rows instead', '应该报告训练行上的准确率'), T('That is the number that is optimistic by construction.', '那个数字天生乐观。'))],
                      T('Hold out data that nothing, including your own tuning, has touched. Later lessons give it a name: a validation set for tuning, a test set for the final report.', '留出的数据，任何东西（包括你自己的调参）都不能碰过。后面的课会给它们起名：调参用验证集，最终汇报用测试集。')),
                 skill=GEN),
            read('attr-types', T('Three kinds of attribute', '三种属性'),
                 p(T(r"What you may *do* with an attribute's values decides which models can use it. There are three kinds; the first two are **discrete**, the last is **continuous**. Class labels have the same three kinds.",
                     r"你能对一个属性的值*做什么*，决定了哪些模型能用它。属性有三种；前两种是**离散**的，最后一种是**连续**的。类别标签也是这三种。")),
                 table([T('Type', '类型'), T('What the values are', '值是什么'), T('Allowed', '允许的运算'), T('Example', '例子')],
                       [T('**Nominal** (categorical)', '**名义**（类别）'), T('distinct symbols; only names. A two-valued one is a Boolean / dichotomy', '互不相同的符号，只是名字。只有两个值的叫布尔 / 二分'), T('equality test only', '只能判相等'), r'$\{\text{red},\text{orange},\text{yellow}\}$; $\{\text{yes},\text{no}\}$'],
                       [T('**Ordinal**', '**序数**'), T('an explicit order, but no distance between values', '有明确的顺序，但值之间没有距离'), T('equal, and < >', '判相等，比大小'), r'$\text{hot} > \text{mild} > \text{cool}$'],
                       [T('**Numeric**', '**数值**'), T('real or integer quantities with mathematical meaning', '有数学意义的实数或整数'), T('all arithmetic', '所有算术'), T('temperature, height, number of customers', '温度、身高、客流量')]),
                 p(T(r"Ordinal values rank but do not measure: $\text{hot} - \text{cool} \ne \text{mild}$, because the gaps between levels are unknown. An ordinal rule such as 'temperature < hot → play = yes' is fine; averaging two levels is not. The boundary between nominal and ordinal is sometimes blurred: is outlook {sunny, overcast, rainy} ordered? Decide by whether an order is meaningful for the task.",
                     r"序数值只排序、不度量：$\text{hot} - \text{cool} \ne \text{mild}$，因为各级之间的间隔未知。“temperature < hot → play = yes”这样的序数规则没问题；把两个等级取平均就不行。名义和序数的界线有时模糊：outlook {sunny, overcast, rainy} 有顺序吗？看这个顺序对任务有没有意义。")),
                 quiz(T('Which type is a postcode such as 3010?', '邮政编码（如 3010）是哪种类型？'),
                      [(T('Numeric, it is made of digits', '数值，它由数字组成'), T('Subtracting two postcodes means nothing; 3010 is not 3 times 1000. Digits do not make a quantity.', '两个邮编相减没意义；3010 不是 1000 的 3 倍。写成数字不等于是数量。')),
                       (T('Ordinal, bigger codes come later', '序数，大的邮编排后面'), T('The order of codes is an accident of how they were handed out, not a ranking of anything.', '邮编的先后只是编号分配的偶然，并不是任何意义上的排名。')),
                       (T('Nominal: a name for a place, only equality is meaningful', '名义：一个地方的名字，只有相等有意义'), True)],
                      T('The deck\'s quick quiz: blood type (A, B, AB, O) is nominal, movie rating 1★-5★ and T-shirt size XS-XL are ordinal, postcode is nominal.', '讲义的小测验答案：血型（A, B, AB, O）是名义，电影评分 1★-5★ 和 T 恤尺码 XS-XL 是序数，邮编是名义。')),
                 chapter=T('Attributes and converting them', '属性与属性转换'), skill=AT),
            read('model-match', T('When the attribute and the model do not fit', '属性和模型对不上时'),
                 p(T(r"Most algorithms assume a certain attribute type. The deck's list:",
                     r"多数算法默认某种属性类型。讲义的清单：")),
                 table([T('Model', '模型'), T('Takes', '吃什么')],
                       [T('Naive Bayes', '朴素贝叶斯'), T('nominal or numeric', '名义或数值')],
                       [T('Linear / logistic regression', '线性 / 逻辑回归'), T('numeric', '数值')],
                       [T('Perceptron, neural networks', '感知机、神经网络'), T('numeric', '数值')]),
                 p(T(r"If your data has the wrong type (or a mix of types), there are exactly three ways out:", r"数据类型不对（或各种类型混着），只有三条出路：")),
                 ol(T(r"**Select** only the attributes of the right type. Cheap, but you throw information away.", r"**挑选**类型对的属性。便宜，但会丢信息。"),
                    T(r"**Change the model's assumptions** to match the data: for example a naive Bayes with a categorical distribution for nominal and a Gaussian for numeric attributes.", r"**改模型的假设**去适应数据：比如朴素贝叶斯对名义属性用类别分布、对数值属性用高斯分布。"),
                    T(r"**Change the attributes** to match the model: convert nominal to numeric, or numeric to nominal. The next pages do this.", r"**改属性**去适应模型：名义转数值，或数值转名义。接下来几页就做这件事。")),
                 skill=AT),
            read('encode', T('Nominal to numeric: why one-hot', '名义转数值：为什么要 one-hot'),
                 p(T(r"The obvious conversion is to number the categories: red, blue, green, orange, pink become 0, 1, 2, 3, 4. It is simple and compact, but it quietly says things that are false.",
                     r"最顺手的办法是给类别编号：red, blue, green, orange, pink 变成 0, 1, 2, 3, 4。简单又省空间，但它悄悄说了一些假话。")),
                 ul(T(r"An **arbitrary order**: green (2) $>$ blue (1)?", r"**随意的顺序**：green (2) $>$ blue (1)？"),
                    T(r"A **meaningless distance**: pink $-$ red $= 4$, but blue $-$ red $= 1$, as if blue were four times more like red than pink is.", r"**没意义的距离**：pink $-$ red $= 4$，而 blue $-$ red $= 1$，仿佛 blue 比 pink 像 red 四倍。")),
                 p(T(r"**One-hot encoding** gives each category its own 0/1 column and puts a single 1 in the column of the category present:",
                     r"**one-hot 编码**给每个类别一个自己的 0/1 列，只在出现的那个类别的列里放一个 1：")),
                 table([T('colour', '颜色'), 'is_red', 'is_blue', 'is_green', 'is_orange', 'is_pink'],
                       ['red', '1', '0', '0', '0', '0'], ['blue', '0', '1', '0', '0', '0'], ['pink', '0', '0', '0', '0', '1']),
                 p(T(r"Now every pair of different colours is exactly the same distance apart, $\sqrt{2}$ (two coordinates differ by 1), so no colour is closer to another than to any other: that is precisely what 'nominal' means. The price, from the deck: the number of features grows with the number of categories (higher dimension), and most entries are 0 (**sparse** data). A 'postcode' attribute with 2,000 values becomes 2,000 columns.",
                     r"现在任意两种不同的颜色距离完全一样，都是 $\sqrt{2}$（两个坐标各差 1），没有哪个颜色和谁更近：这正是“名义”的含义。代价（讲义指出）：特征数随类别数增长（维度变高），而且大部分取值是 0（**稀疏**）。一个有 2000 个取值的“邮编”属性会变成 2000 列。")),
                 details(T('A detail worth knowing', '一个值得知道的细节'),
                         p(T(r"With a bias term, the columns add up to 1 for every row, so one column is redundant (the 'dummy variable trap' of linear regression). Dropping one column ($k-1$ columns for $k$ categories) removes it. An *ordinal* attribute may sensibly be coded 1, 2, 3 when the levels are roughly evenly spaced; that is a judgement, not a rule.",
                             r"带偏置项时，每一行的各列加起来恒为 1，所以有一列是多余的（线性回归的“虚拟变量陷阱”）。去掉一列（$k$ 个类别用 $k-1$ 列）即可。*序数*属性在各级间隔大致均匀时可以合理地编成 1, 2, 3；这是判断，不是定律。"))),
                 skill=CV),
            read('discretise', T('Numeric to nominal: discretisation', '数值转名义：离散化'),
                 p(T(r"**Discretisation** groups numeric values into a fixed set of categories: house prices become {low, medium, high}. Two decisions: how many categories, and where the boundaries go. The deck gives three ways to place boundaries.",
                     r"**离散化**把数值归入固定的几个类别：房价变成 {低, 中, 高}。要做两个决定：分几类，边界放哪。讲义给了三种放边界的办法。")),
                 table([T('Method', '方法'), T('How', '怎么做'), T('Pros', '优点'), T('Cons', '缺点')],
                       [T('**Equal width**', '**等宽**'), T('find min and max; $n$ bins each of width $(\\max-\\min)/n$', '找最小最大值；分成 $n$ 个箱，每箱宽 $(\\max-\\min)/n$'), T('simple, interpretable', '简单、好解释'), T('unequal data distribution; sensitive to outliers', '数据分布不均；对异常值敏感')],
                       [T('**Equal frequency**', '**等频**'), T('sort; cut into $n$ bins with the same number of items (use rank order)', '排序；切成 $n$ 个箱，每箱个数相同（按名次）'), T('robust to outliers; keeps the data distribution; avoids sparse intervals', '对异常值稳健；保持数据分布；避免稀疏区间'), T('loses interpretability; can be inconsistent; information loss', '难解释；可能不一致；信息损失')],
                       [T('**Clustering**', '**聚类**'), T('group the values into $n$ clusters, e.g. with k-means', '把值聚成 $n$ 类，例如用 k-means'), T('boundaries follow the natural groups', '边界跟着自然分组走'), T('needs $n$ (or a way to choose it); one more model to run', '要给定 $n$（或想办法选）；多跑一个模型')]),
                 p(T(r"The deck's equal-width example: education years range from 6 to 18, so with $n=3$ the width is $(18-6)/3 = 4$ and the bins are $[6,10)$, $[10,14)$, $[14,18]$; with $n=2$ the width is 6: $[6,12)$, $[12,18]$. The last bin is closed so the maximum has a home.",
                     r"讲义的等宽例子：受教育年数从 6 到 18，$n=3$ 时宽度是 $(18-6)/3 = 4$，三个箱是 $[6,10)$、$[10,14)$、$[14,18]$；$n=2$ 时宽度是 6：$[6,12)$、$[12,18]$。最后一个箱是闭区间，这样最大值才有归宿。")),
                 svg(drawn(fig_bins), T(f'Nine incomes on a number line, 20 to 200. Equal width: bins hold {INC_BINS[0]}, {INC_BINS[1]}, {INC_BINS[2]} items. Equal frequency: 3, 3, 3 items.',
                                        f'数轴上的 9 个收入，20 到 200。等宽：三个箱分别有 {INC_BINS[0]}、{INC_BINS[1]}、{INC_BINS[2]} 个。等频：各 3 个。')),
                 skill=CV),
            derive('bins-worked', T('Both binnings by hand', '两种分箱手算一遍'),
                   [(f'\\min = {INC_MIN},\\ \\max = {INC_MAX}', T(r"Nine incomes in thousands of dollars: 20, 22, 25, 27, 30, 33, 36, 40, 200. The 200 is an outlier. Equal width needs the extremes.", r"九个收入（千美元）：20, 22, 25, 27, 30, 33, 36, 40, 200。200 是异常值。等宽要用到最小和最大值。")),
                    (f'w = \\frac{{{INC_MAX} - {INC_MIN}}}{{3}} = {INC_W:g}', T(r"Bin width is range divided by number of bins.", r"箱宽 = 极差 / 箱数。")),
                    (f'[{INC_MIN},{INC_EDGES[1]:g}),\\ [{INC_EDGES[1]:g},{INC_EDGES[2]:g}),\\ [{INC_EDGES[2]:g},{INC_MAX}]', T(r"Add the width to the minimum repeatedly to get the edges.", r"从最小值起，每次加一个箱宽，得到各边界。")),
                    (f'n_1,n_2,n_3 = {INC_BINS[0]},\\ {INC_BINS[1]},\\ {INC_BINS[2]}', T(r"Count the items per bin. One outlier stretched the range, so eight of nine incomes land in the same bin and the middle bin is empty: the bins describe the outlier, not the data.", r"数每个箱里有几个。一个异常值撑大了范围，九个收入里八个落进同一个箱，中间箱是空的：这些箱描述的是异常值，不是数据。")),
                    (r'9 / 3 = 3', T(r"Equal frequency: sort (already sorted) and give each bin the same count.", r"等频：排序（这里已经排好），每个箱分同样多的个数。")),
                    (f'\\{{20,22,25\\}},\\ \\{{27,30,33\\}},\\ \\{{36,40,200\\}}', T(r"The bins by rank. The 200 now sits harmlessly with 36 and 40.", r"按名次分的箱。200 现在安安稳稳地和 36、40 待在一起。")),
                    (f'c_1 = {INC_CUTS[0]:g},\\ c_2 = {INC_CUTS[1]:g}', T(r"Put each cut halfway between the last item of one bin and the first of the next: $(25+27)/2$ and $(33+36)/2$. New data are binned with these cuts.", r"每个切点放在相邻两箱的交界处的中间：$(25+27)/2$ 和 $(33+36)/2$。新数据就按这两个切点分箱。"))],
                   outro=T(r"Equal width gave 8 / 0 / 1, equal frequency 3 / 3 / 3. Neither is 'right'; they answer different questions, which the next page looks at.", r"等宽得到 8 / 0 / 1，等频得到 3 / 3 / 3。哪个都不是“对”的；它们回答不同的问题，下一页细看。"),
                   blank=(1, f'{INC_W:g}', T(r"Width of one equal-width bin for these nine incomes (min 20, max 200, 3 bins).", r"这九个收入的等宽箱宽度（最小 20，最大 200，3 个箱）。")), skill=CV),
            read('bins-cost', T('Deeper: what each discretisation choice costs', '深入：每种离散化选择的代价'),
                 p(T(r"Discretisation is not a neutral reformatting. It is a modelling decision, and each part of it has a price.", r"离散化不是中立的格式转换，而是一个建模决定，每一部分都有代价。")),
                 h(T('1. All information inside a bin is destroyed', '1. 箱子里面的信息全部丢掉')),
                 p(T(r"After binning, 33 and 36 become the same value, while 33 and 34.6 (a cut at 34.5) become different values. The model sees a **step**, not a slope: two nearly identical incomes are treated as opposites, and two far apart as equal. Narrow bins lose less, but then each bin has few instances, estimates per bin are noisy, and there are more parameters to learn (overfitting risk). Wide bins are stable but crude. The number of bins is a bias-variance knob in its own right.",
                     r"分箱之后，33 和 36 变成同一个值，而 33 和 34.6（切点在 34.5）却变成不同的值。模型看到的是**台阶**而不是斜坡：几乎一样的两个收入被当成相反，相差很远的两个被当成相等。箱窄，丢得少，但每箱实例少，每箱的估计噪声大，要学的参数也更多（过拟合风险）。箱宽，稳定但粗糙。箱数本身就是一个偏差-方差旋钮。")),
                 h(T('2. Equal width inherits the shape of the data', '2. 等宽继承了数据的形状')),
                 p(T(r"Its boundaries depend only on min and max, so one outlier moves every boundary (8 / 0 / 1 above), and a skewed variable like income leaves the tail bins nearly empty. Its virtue: the bins have a meaning you can state ('\\$20k wide'), and the same cut points can be reused on new data.",
                     r"它的边界只取决于最小值和最大值，所以一个异常值就会挪动所有边界（上面的 8 / 0 / 1），收入这类偏斜变量会让尾部的箱几乎为空。它的好处：箱有可陈述的含义（“每箱 2 万”），同样的切点可以直接用到新数据上。")),
                 h(T('3. Equal frequency inherits the sample', '3. 等频继承了样本')),
                 p(T(r"Its cut points are quantiles of *this* sample, so they are robust to outliers and every bin has enough instances. But a bin may stretch from 36 to 200: the label 'high' covers very different people, and it is hard to say in words what the bin means. If many values are tied, identical values must be split across bins or kept together, making sizes unequal (the 'inconsistency' of the deck). And the cuts must be fitted on the training data only and then applied unchanged to test data; recomputing quantiles on the test set leaks information.",
                     r"它的切点是*这个*样本的分位数，所以对异常值稳健、每个箱都有足够的实例。但一个箱可能从 36 一直伸到 200：标签“高”涵盖了差别很大的人，也很难用话说清这个箱是什么意思。若有很多相同的值，相同的值要么被劈到不同箱、要么留在一起，箱的大小就不一样了（讲义里的“不一致”）。切点只能用训练数据确定，再原样用到测试数据；在测试集上重算分位数会泄漏信息。")),
                 h(T('4. Clustering, or using the label', '4. 聚类，或者利用标签')),
                 p(T(r"Boundaries from clustering follow natural gaps, at the price of another model and a choice of $n$. A supervised variant (choose cuts that best separate the classes, e.g. by information gain) usually loses the least for classification, but it uses the labels, so it must also be fitted on training data only.",
                     r"聚类得到的边界顺着自然的缺口走，代价是多一个模型、还要选 $n$。监督式的变体（选最能分开类别的切点，比如用信息增益）对分类通常丢得最少，但它用了标签，所以同样只能在训练数据上确定。")),
                 quiz(T('Incomes are very skewed (a few billionaires). You discretise into 4 bins and want each bin to be usable by a model. Which is the better default, and what do you give up?', '收入非常偏斜（有几个亿万富翁）。你把它离散成 4 个箱，希望每个箱模型都能用。哪个是更好的默认选择，代价是什么？'),
                      [(T('Equal width: bins are easy to state, and sparse bins are harmless', '等宽：箱好表述，稀疏的箱也无所谓'), T('Sparse bins are exactly the problem: with a few extreme incomes, most bins hold no data and one holds almost everyone, so the model cannot tell ordinary incomes apart.', '稀疏的箱恰恰是问题：有几个极端收入，多数箱里没有数据，而一个箱装了几乎所有人，模型分不出普通收入之间的差别。')),
                       (T('Equal frequency: every bin has enough data and outliers cannot move the cuts; you give up a simple meaning for each bin', '等频：每个箱数据够多，异常值挪不动切点；代价是每个箱不再有简单的含义'), True),
                       (T('Neither: never discretise numeric data', '都不要：永远别离散化数值数据'), T('Sometimes you must (a model that needs nominal input), and it can help with non-linear effects. The point is to know the cost, not to ban it.', '有时必须（模型只吃名义输入），而且它能帮着表达非线性。要点是知道代价，不是一概禁止。'))],
                      T('The choice depends on what you need: a bin you can state in words (equal width) or bins a model can learn from (equal frequency).', '看你需要什么：能用话讲清的箱（等宽），还是模型学得动的箱（等频）。')),
                 skill=CV),
            derive('scaling', T('Putting numeric attributes on one scale', '把数值属性放到同一个尺度上'),
                   [(f'\\mu = \\frac{{{" + ".join(map(str, Z))}}}{{{len(Z)}}} = {Z_MU:g}', T(r"Eight values. Standardisation needs the mean $\mu$ of the attribute.", r"八个值。标准化先要这个属性的均值 $\mu$。")),
                    (f'\\sigma = \\sqrt{{\\tfrac{{1}}{{{len(Z)}}}\\sum (x-\\mu)^2}} = \\sqrt{{{st.pvariance(Z):g}}} = {Z_SD:g}', T(r"and its standard deviation $\sigma$ (the squared distances are 9, 1, 1, 1, 0, 0, 4, 16, which sum to 32; divided by 8 is 4).", r"再要标准差 $\sigma$（离差平方依次是 9, 1, 1, 1, 0, 0, 4, 16，和为 32；除以 8 得 4）。")),
                    (f"x' = \\frac{{x - \\mu}}{{\\sigma}}\\ \\Rightarrow\\ x=9:\\ \\frac{{9-{Z_MU:g}}}{{{Z_SD:g}}} = {(9 - Z_MU) / Z_SD:g}", T(r"The z-score says how many standard deviations the value lies from the mean. The result has mean 0 and standard deviation 1, and keeps the shape of the data (an outlier remains an outlier).", r"z 分数表示这个值离均值有几个标准差。结果的均值为 0、标准差为 1，数据的形状不变（异常值仍是异常值）。")),
                    (f"x' = \\frac{{x - \\min}}{{\\max - \\min}}\\ \\Rightarrow\\ x=5:\\ \\frac{{5-{Z_MIN}}}{{{Z_MAX}-{Z_MIN}}} = {(5 - Z_MIN) / (Z_MAX - Z_MIN):.3f}", T(r"Min-max scaling squeezes the data into exactly $[0,1]$: the minimum goes to 0, the maximum to 1. It is sensitive to a single extreme value, which fixes the whole scale.", r"min-max 缩放把数据压进恰好 $[0,1]$：最小值变 0，最大值变 1。它对单个极端值敏感，因为极端值决定了整个尺度。"))],
                   intro=T(r"Why bother? If one attribute is the weight in grams (thousands) and another the price in dollars (tens), any method that adds up differences across attributes (distances in k-NN, gradient steps) is dominated by the big numbers. Rescaling lets each attribute count fairly. Take the eight values 2, 4, 4, 4, 5, 5, 7, 9.",
                           r"为什么要缩放？如果一个属性是以克计的重量（上千），另一个是以美元计的价格（几十），任何把各属性的差异加起来的方法（k-NN 的距离、梯度步长）都会被大数字主导。重新缩放让每个属性公平地算数。取八个值 2, 4, 4, 4, 5, 5, 7, 9。"),
                   outro=T(r"Fit $\mu,\sigma$ (or min, max) on the training data and reuse them on the test data, never recompute them there.", r"$\mu,\sigma$（或最小、最大值）在训练数据上确定，在测试数据上沿用，不要在那里重算。"),
                   blank=(2, f'{(9 - Z_MU) / Z_SD:g}', T(r"The z-score of x = 9.", r"x = 9 的 z 分数。")), skill=CV),
            read('messy', T('Real data is messy: missing values', '真实数据很乱：缺失值'),
                 p(T(r"Data comes from several departments with different conventions, periods and errors, and must be assembled and cleaned before any model sees it. The biggest issue is **missing values**: unknown, unrecorded or irrelevant entries, caused by broken equipment, changes in experimental design or merged datasets.",
                     r"数据来自几个部门，约定、时间段、错误各不相同，在任何模型看到之前都要先拼起来、清理干净。最大的问题是**缺失值**：未知、没记录或不相关的条目，原因可能是设备故障、实验设计改变、数据集合并。")),
                 table([T('Kind', '种类'), T('Meaning', '含义'), T('Consequence', '后果')],
                       [T('**MAR** missing at random', '**MAR** 随机缺失'), T('the chance a value is missing is unrelated to any measured variable and to the missing value itself; no rule predicts what is missing', '值缺失的概率与任何已测变量和缺失值本身无关；没有规则能预测缺了什么'), T('most algorithms assume this; simple imputation is acceptable', '多数算法都假定这一点；简单填补尚可接受')],
                       [T('**MNAR** missing not at random', '**MNAR** 非随机缺失'), T('missingness depends on the value itself (even after controlling for other variables): a rule can predict what is missing', '缺失取决于值本身（即使控制了其他变量）：有规则能预测缺了什么'), T('the fact that it is missing carries information (a medical test not ordered); filling it in hides this', '“缺失”这件事本身带有信息（没开的医学检查）；填上就把信息抹掉了')]),
                 p(T(r"**Disguised missing data** is a missing value that was filled with a default: everyone born on 1 January, every email xx@xx.com. Look for suspicious values using domain knowledge. **Inaccurate data** (typos, sensor faults, outliers) must be found the same way.",
                     r"**伪装的缺失数据**是用默认值填上的缺失：所有人都生于 1 月 1 日，所有邮箱都是 xx@xx.com。要靠领域知识找可疑的值。**不准确的数据**（笔误、传感器故障、异常值）也要这样找出来。")),
                 p(T(rf"**Simple imputation** fills a gap with the mean, median or mode of the attribute. It is easy and keeps every record. Its cost, which the deck names: it biases other statistics. Observed values {MISS} have mean {MISS_MU:g} and variance {MISS_VAR0:g}. Fill a missing fifth value with the mean {MISS_MU:g} and the variance falls to {MISS_VAR1:g}: the filled-in point sits exactly in the middle and adds no spread, so the data look less variable than they are. The median is more robust to outliers; the mode is for nominal attributes.",
                     rf"**简单填补**用该属性的均值、中位数或众数填上缺口。简单，且保留了每条记录。它的代价（讲义点明）：会扭曲其他统计量。已观测的值 {MISS} 均值 {MISS_MU:g}、方差 {MISS_VAR0:g}。把缺失的第五个值填成均值 {MISS_MU:g}，方差就掉到 {MISS_VAR1:g}：填进去的点正落在中间，不增加任何离散度，数据看上去比实际更集中。中位数对异常值更稳健；众数用于名义属性。")),
                 p(T(r"Finally, **get to know the data**: histograms for nominal attributes (does the distribution match what you know?), scatter plots for numeric attributes (any obvious outliers?), 2-D and 3-D plots for dependencies, domain experts for what the values mean, and a sample if there is too much to inspect.",
                     r"最后，**了解你的数据**：名义属性看直方图（分布和你的认知一致吗？），数值属性看散点图（有明显的异常值吗？），2 维、3 维图看依赖关系，问领域专家这些值的含义，数据太多就取样看。")),
                 quiz(T('In a clinic dataset, "blood glucose" is missing for patients the doctor judged healthy. Which is it, and what follows?', '在一份诊所数据里，医生认为健康的病人没有测“血糖”。这是哪种缺失，会怎样？'),
                      [(T('MNAR: missingness depends on the patient\'s condition, so "missing" itself is informative; filling with the mean would hide that', 'MNAR：缺失取决于病人的状况，“缺失”本身就有信息；用均值填就把这一点藏起来了'), True),
                       (T('MAR: some values are always lost', 'MAR：总有些值会丢'), T('Under MAR the chance of a gap is unrelated to the patient\'s state. Here a rule (the doctor\'s judgement) predicts the gap.', 'MAR 下出现缺口的概率与病人状况无关。这里有一条规则（医生的判断）能预测缺口。')),
                       (T('Disguised missing data, since glucose is a default', '伪装的缺失，因为血糖是个默认值'), T('Disguised missing data has a fake value filled in. Here the field is simply empty.', '伪装的缺失是被填上了假值。这里字段只是空着。'))],
                      T('Add an indicator attribute "was measured" so the model can use the missingness as a feature.', '再加一个“是否测过”的指示属性，让模型把缺失当成一个特征来用。')),
                 skill=CV),
            read('learning', T('Deeper: what a model is, and what learning does', '深入：模型是什么，学习做了什么'),
                 p(T(r"A **model** is a function $f$ that maps an instance's features to a prediction, $\hat{y} = f(\mathbf{x})$. **Learning** (training) is choosing $f$ from a family of candidate functions, the **hypothesis space**, using the training data. A k-NN, a decision tree and a logistic regression are three different families; inside a family, the parameters ($\boldsymbol\theta$, tree splits) are what training sets.",
                     r"**模型**是一个函数 $f$，把实例的特征映射成预测 $\hat{y} = f(\mathbf{x})$。**学习**（训练）就是用训练数据，从一族候选函数，即**假设空间**里挑出 $f$。k-NN、决策树、逻辑回归是三个不同的函数族；在一个函数族里，训练要定的是参数（$\boldsymbol\theta$、树的分裂）。")),
                 p(T(r"What should 'a good $f$' mean? There is one trivial answer: a lookup table that stores every training row has zero error on the training data. On the weather table it scores 10/10, and it has no idea what to say about a rainy, cool, high-humidity day it has not stored. It has **memorised**, not learned. The same happens with curves:",
                     r"“好的 $f$”该是什么意思？有一个平凡的答案：把每个训练行都存下来的查找表，在训练数据上误差为零。在天气表上它 10 题全对，却完全不知道没存过的“雨天、凉、湿度高”该说什么。它是**背下来**了，不是学会了。曲线也一样：")),
                 svg(drawn(fig_fit), T('Seven noisy points. A straight line follows the trend; a degree-6 curve passes through every point but swings wildly between them.', '七个带噪声的点。直线跟随趋势；6 次曲线穿过每个点，但在点与点之间剧烈摆动。'),
                     T(r"The wiggly curve has zero training error, and it would predict badly between and beyond the points.", r"弯弯曲曲的曲线训练误差为零，但在点与点之间和点以外预测得很差。")),
                 chapter=T('Learning is not memorising', '学习不是背诵'), skill=GEN),
            read('generalise', T('Deeper: why generalisation, not training fit, is the goal', '深入：为什么目标是泛化，而不是拟合训练数据'),
                 p(T(r"We assume the data are **independent and identically distributed (i.i.d.)** draws from some unknown distribution $P(\mathbf{x}, y)$, and the future instances come from the same one. The thing we truly care about is the **generalisation error**: the expected loss of $f$ on a *fresh* draw,",
                     r"我们假定数据是从某个未知分布 $P(\mathbf{x}, y)$ **独立同分布（i.i.d.）**抽出来的，未来的实例也来自同一个分布。我们真正在意的是**泛化误差**：$f$ 在一次*新*抽样上的期望损失，")),
                 math_(r'R(f) = \mathbb{E}_{(\mathbf{x},y)\sim P}\,[\,\ell(f(\mathbf{x}), y)\,]'),
                 p(T(r"where $\ell$ is the loss (0 for a right class and 1 for a wrong one, or squared error). $R(f)$ cannot be computed, because $P$ is unknown. What we can compute is the **training error**, the average of $\ell$ over the training rows. It is an *optimistic* estimate of $R(f)$, because $f$ was chosen precisely so that this number is small: the more flexible the family, the better it can be fitted to the noise in these particular rows, and the wider the gap between the two numbers.",
                     r"其中 $\ell$ 是损失（分类对为 0、错为 1，或平方误差）。$R(f)$ 算不出来，因为 $P$ 未知。能算的是**训练误差**，即训练行上 $\ell$ 的平均。它是 $R(f)$ 的一个*过于乐观*的估计，因为 $f$ 正是为了让这个数小而选出来的：函数族越灵活，越能贴合这几行里的噪声，两个数之间的差距就越大。")),
                 p(T(r"That is why held-out data is used: rows that took no part in choosing $f$ are an honest sample from $P$, so their average loss is an unbiased estimate of $R(f)$. Compare the two failure modes:",
                     r"这就是为什么要用留出数据：没参与挑选 $f$ 的行是从 $P$ 里诚实抽出的样本，它们上的平均损失是 $R(f)$ 的无偏估计。比较两种失败：")),
                 table([T('Aspect', '方面'), T('Underfitting', '欠拟合'), T('Overfitting', '过拟合')],
                       [T('model', '模型'), T('too simple (straight line through a curve)', '太简单（用直线去拟合曲线）'), T('too flexible (stores the noise)', '太灵活（把噪声也存下来）')],
                       [T('training error', '训练误差'), T('high', '高'), T('very low', '很低')],
                       [T('held-out error', '留出误差'), T('high', '高'), T('high', '高')],
                       [T('signature', '特征'), T('both errors high and close', '两个误差都高且接近'), T('large gap between the two', '两者差距很大')]),
                 p(T(r"Choosing a model because its *training* error is smallest therefore always picks the most flexible one. Models are chosen by held-out performance, and the goal is the best $R(f)$ you can get from a finite sample.",
                     r"所以，若按*训练*误差最小来选模型，永远会选中最灵活的那个。选模型要看留出数据上的表现，目标是在有限样本下得到尽可能好的 $R(f)$。")),
                 quiz(T('A model has 100% accuracy on the training data and 60% on held-out data. Which statement is the best reading?', '一个模型在训练数据上准确率 100%，在留出数据上 60%。哪种解读最好？'),
                      [(T('It is overfitted: it fits the training rows, noise included, but does not generalise', '过拟合：它把训练行连同噪声都拟合了，但不能泛化'), True),
                       (T('It is excellent, since it is perfect on the data it knows', '它很出色，因为在已知数据上完美'), T('Perfect on known data is cheap (a lookup table does it). What counts is the unseen data: 60%.', '在已知数据上完美很容易（查找表就行）。要紧的是没见过的数据：60%。')),
                       (T('Underfitted: the model is too simple', '欠拟合：模型太简单'), T('An underfitted model is also poor on the *training* data. Here training is perfect and the gap is the signal.', '欠拟合的模型在*训练*数据上也不好。这里训练数据上是完美的，差距才是信号。'))],
                      T('A large gap between training and held-out performance is the signature of overfitting.', '训练和留出表现之间差距很大，就是过拟合的标志。')),
                 skill=GEN),
            derive('bias-count', T('Deeper: why learning needs an assumption, by counting functions', '深入：数一数函数，看学习为什么必须有假设'),
                   [(f'2^{N_ATTR} = {N_INST}', T(r"Take $3$ yes/no attributes. Each attribute doubles the number of distinct instances, so there are 8 possible instances in total.", r"取 $3$ 个是/否属性。每个属性让不同实例的数目翻倍，所以一共有 8 种可能的实例。")),
                    (f'2^{{{N_INST}}} = {N_FUNC}', T(r"A rule gives each of the 8 instances a label yes or no, independently. That makes $2^8$ possible rules (Boolean functions). This is the hypothesis space if we allow *any* rule.", r"一条规则给 8 个实例各自独立地打上 yes 或 no。所以有 $2^8$ 条可能的规则（布尔函数）。若不加任何限制，这就是假设空间。")),
                    (f'2^{{{N_INST}-{N_SEEN}}} = {N_LEFT}', T(r"Five training rows fix five of the labels. The rules that agree with all five are those that label the remaining three instances freely: $2^3 = 8$ of them, and they disagree with each other on those three.", r"五个训练行固定了五个标签。与这五个都吻合的规则，就是对剩下三个实例随便打标签的那些：$2^3 = 8$ 条，它们在这三个实例上互相矛盾。")),
                    (r'2^{10} = 1024,\ 2^{1024}', T(r"With 10 attributes there are 1024 instances and about $10^{308}$ rules. No dataset you will ever have covers more than a sliver of the instance space.", r"10 个属性时有 1024 个实例，约 $10^{308}$ 条规则。你能拿到的任何数据集都只覆盖实例空间的一小条。")),
                    (r"D \;\not\Rightarrow\; \hat{y}(\mathbf{x}')", T(r"So the data alone can never say what to predict on an unseen instance. Something else must pick one rule among the many that fit: this extra something is the **inductive bias**.", r"所以，仅凭数据永远说不出对没见过的实例该预测什么。必须有别的东西在所有吻合的规则里挑一条：这个“别的东西”就是**归纳偏置**。"))],
                   outro=T(r"This is a version of the 'no free lunch' idea: averaged over all possible problems, no learner beats any other. A learner is good only on problems whose structure matches its bias.", r"这是“没有免费午餐”思想的一个版本：在所有可能的问题上取平均，没有哪种学习算法能胜过别的。一个学习算法只在结构和它的偏置相配的问题上才好用。"),
                   intro=T(r"Why must a learner assume something? Count the possible rules for a tiny problem.", r"为什么学习算法必须假设点什么？数一数一个很小的问题里有多少条可能的规则。"), skill=BIAS),
            read('bias-kinds', T('Deeper: inductive bias, the bet every model makes', '深入：归纳偏置，每个模型下的注'),
                 p(T(r"**Inductive bias** is the set of assumptions a learner uses to prefer one hypothesis over the others that fit the data equally well. It comes in two forms: a **restriction bias** limits the hypothesis space (only straight lines, only trees of depth 3); a **preference bias** allows many hypotheses but ranks them (choose the smallest tree that fits, the smallest weights, the shortest description).",
                     r"**归纳偏置**是学习算法用来在同样吻合数据的多个假设中偏爱其一的那套假设。有两种形式：**限制偏置**缩小假设空间（只许直线、只许深度 3 的树）；**偏好偏置**允许很多假设但给它们排序（选吻合数据的最小的树、最小的权重、最短的描述）。")),
                 p(T(r"The methods of this subject are, in this light, different bets about what a good rule looks like:",
                     r"从这个角度看，这门课的各种方法，就是对“好规则长什么样”下的不同赌注：")),
                 table([T('Learner', '学习算法'), T('The bet it makes', '它下的赌注'), T('Good when… / bad when…', '什么时候好 / 什么时候差')],
                       ['k-NN', T('close instances have the same label', '靠近的实例标签相同'), T('classes form compact regions / irrelevant or badly scaled attributes ruin "close"', '类别形成紧凑的区域 / 无关或尺度不一的属性会毁掉“靠近”')],
                       [T('Decision tree', '决策树'), T('the label depends on a few attributes, through axis-aligned yes/no tests; prefer small trees', '标签只由少数几个属性，经轴对齐的是/否检验决定；偏好小树'), T('rule-like data / diagonal boundaries need many splits', '规则式的数据 / 斜的边界要很多次分裂')],
                       [T('Naive Bayes', '朴素贝叶斯'), T('attributes are independent given the class', '给定类别后各属性相互独立'), T('many weak, unrelated clues, e.g. words / strongly correlated attributes get counted twice', '很多弱而不相关的线索，如单词 / 强相关的属性会被重复计数')],
                       [T('Linear / logistic regression, perceptron', '线性 / 逻辑回归、感知机'), T('the label changes smoothly and additively with the attributes; a straight boundary', '标签随属性平滑、可加地变化；边界是直的'), T('roughly linear data / XOR-like data', '大致线性的数据 / 类似 XOR 的数据')]),
                 p(T(r"A model with a **strong** bias (few hypotheses) cannot fit much, so it may *underfit*, but needs little data to pick one. A model with a **weak** bias (many hypotheses) can fit almost anything, so it may *overfit*, and needs much more data. Choosing a model is choosing a bias that matches your problem; there is no bias that is right for all of them. This is the thread behind the bias-variance lesson later.",
                     r"**强**偏置（假设很少）的模型拟合不了多少东西，可能*欠拟合*，但只要很少数据就能选定一个。**弱**偏置（假设很多）的模型几乎什么都能拟合，可能*过拟合*，需要多得多的数据。选模型就是选一个与你的问题相配的偏置；没有一种偏置对所有问题都对。这条线索会在后面的偏差-方差一课里接上。")),
                 skill=BIAS),
            number('p-width', T('Equal-width bins', '等宽分箱'), CV,
                   T(rf"Ages of nine customers: {', '.join(map(str, AGES))}. Discretise into 3 equal-width bins. How many customers fall in the first bin? (The last bin is closed on the right.)",
                     rf"九位客户的年龄：{', '.join(map(str, AGES))}。离散成 3 个等宽的箱。第一个箱里有几位客户？（最后一个箱右端闭合。）"),
                   AGE_FIRST,
                   T(rf"Width $= ({max(AGES)}-{min(AGES)})/3 = {AGE_W:g}$, so the bins are $[21,34)$, $[34,47)$, $[47,60]$. Ages below 34: 21, 23, 24, 25, 29, 31, which is {AGE_FIRST}. (The 60 stretches the range: bin 2 holds only 34 and 38, bin 3 only 60.)",
                     rf"宽度 $= ({max(AGES)}-{min(AGES)})/3 = {AGE_W:g}$，三个箱是 $[21,34)$、$[34,47)$、$[47,60]$。34 岁以下的：21, 23, 24, 25, 29, 31，共 {AGE_FIRST} 个。（60 撑大了范围：第二个箱里只有 34 和 38，第三个箱里只有 60。）"),
                   tolerance=0, hints=[T('Width first, then edges.', '先算宽度，再算边界。')], chapter=T('Exam practice', '考试练习')),
            number('p-z', T('A z-score', 'z 分数'), CV,
                   T(rf"An attribute has values {', '.join(map(str, PZ))}. Standardise the value 14 (use the population standard deviation, dividing by 8). Give the z-score to 2 decimals.",
                     rf"某属性的取值是 {', '.join(map(str, PZ))}。把值 14 标准化（用总体标准差，即除以 8）。答案取两位小数。"),
                   round(PZ_Z, 2),
                   T(rf"$\mu = {st.mean(PZ):g}$; squared deviations sum to {sum((v - st.mean(PZ)) ** 2 for v in PZ):g}, so $\sigma = \sqrt{{{sum((v - st.mean(PZ)) ** 2 for v in PZ) / 8:g}}} = {st.pstdev(PZ):.4f}$; $z = (14-{st.mean(PZ):g})/{st.pstdev(PZ):.4f} = {PZ_Z:.2f}$.",
                     rf"$\mu = {st.mean(PZ):g}$；离差平方和为 {sum((v - st.mean(PZ)) ** 2 for v in PZ):g}，所以 $\sigma = \sqrt{{{sum((v - st.mean(PZ)) ** 2 for v in PZ) / 8:g}}} = {st.pstdev(PZ):.4f}$；$z = (14-{st.mean(PZ):g})/{st.pstdev(PZ):.4f} = {PZ_Z:.2f}$。"),
                   tolerance=0.02),
            choice('c-encode', T('Colour for k-NN', '给 k-NN 编码颜色'), CV,
                   T('A k-NN classifier measures Euclidean distance between instances. One attribute is shirt colour {red, green, blue}. How should it be given to the model?', 'k-NN 分类器用欧氏距离衡量实例之间的远近。其中一个属性是衬衫颜色 {red, green, blue}。该怎么交给模型？'),
                   [(T('Code red = 0, green = 1, blue = 2 in one column', '一列里编码 red = 0, green = 1, blue = 2'), T('Then red is closer to green than to blue, a distance that exists only because of the numbering.', '这样 red 离 green 比离 blue 近，这个距离只是编号编出来的。'), 'integer-codes'),
                    (T('One-hot: three 0/1 columns, so all different colours are equally far apart', 'one-hot：三个 0/1 列，所有不同的颜色距离相等'), True),
                    (T('Drop the attribute, because a distance cannot use a nominal attribute', '丢掉这个属性，因为距离用不了名义属性'), T('Dropping is allowed (one of the three options) but loses information; one-hot keeps it.', '丢掉是允许的（三条出路之一），但会丢信息；one-hot 能保住它。'))],
                   T('Integer codes invent an order and distances; one-hot keeps nominal values equally far apart, at the cost of more columns.', '整数编码凭空造出顺序和距离；one-hot 让名义值彼此等距，代价是列数变多。')),
            choice('c-mnar', T('Which kind of missing?', '哪种缺失？'), CV,
                   T('In a survey, high earners are far more likely to leave "income" blank. A colleague fills the blanks with the mean income. What is the main problem?', '在一次调查里，高收入者更常把“收入”留空。同事用平均收入填空。主要问题是什么？'),
                   [(T('The data are MNAR, so the mean is too low and "blank" is itself informative', '数据是 MNAR，所以均值偏低，而且“留空”本身有信息'), True),
                    (T('Mean imputation changes the data type to nominal', '均值填补会把数据类型变成名义'), T('The type stays numeric. The issue is the bias, not the type.', '类型仍是数值。问题在偏差，不在类型。'), 'missing-random'),
                    (T('The data are MAR, so the mean is unbiased but the variance is too large', '数据是 MAR，所以均值无偏、方差偏大'), T('Not MAR: the chance of a gap depends on the value. And imputation shrinks the variance, it does not enlarge it.', '不是 MAR：缺口的概率取决于值本身。而且填补会让方差变小，不会变大。'), 'missing-random')],
                   T('When missingness depends on the value, filling with the mean of the observed values is biased low here, and the model loses the signal that blank means high.', '当缺失取决于值本身，用已观测值的均值去填，在这里会偏低，模型也丢了“空白意味着高”这个信号。')),
            text_q('t-bins', T('Equal width or equal frequency?', '等宽还是等频？'), CV,
                   T('Compare equal-width and equal-frequency discretisation: give one advantage and one disadvantage of each. (Section A style, 3-4 lines.)', '比较等宽和等频离散化：各给出一个优点和一个缺点。（A 部分风格，3-4 行。）'),
                   [T('Equal width: simple and interpretable bins', '等宽：简单、好解释'), T('Equal width: sensitive to outliers / unequal counts per bin', '等宽：对异常值敏感 / 各箱个数不均'),
                    T('Equal frequency: robust to outliers, similar counts per bin', '等频：对异常值稳健，各箱个数相近'), T('Equal frequency: bins hard to interpret, information loss / ties make it inconsistent', '等频：箱难解释、信息损失 / 相同值使其不一致')],
                   T('Equal width splits the range [min, max] into n bins of the same width. It is simple and the bins are easy to interpret, but one outlier stretches the range, so most data can fall in one bin. Equal frequency puts the same number of instances in each bin, so it is robust to outliers and every bin has data, but the bin widths vary, so a bin is hard to describe, and detail inside a bin is lost.',
                     'Equal width splits the range [min, max] into n bins of the same width. It is simple and the bins are easy to interpret, but one outlier stretches the range, so most data can fall in one bin. Equal frequency puts the same number of instances in each bin, so it is robust to outliers and every bin has data, but the bin widths vary, so a bin is hard to describe, and detail inside a bin is lost.'),
                   T('Name the property each method is built on (the range, the count) and follow it to its consequence.', '指出每种方法依据的是什么（范围、个数），再顺着推出后果。')),
            text_q('t-heldout', T('Why hold data out?', '为什么要留出数据？'), GEN,
                   T('A model has 98% accuracy on its training data. Explain in 2-3 lines why this does not tell us how it will perform in use, and what we do instead.', '一个模型在训练数据上准确率为 98%。用 2-3 行解释为什么这说明不了它实际使用时的表现，以及应该怎么做。'),
                   [T('Training data was used to fit the model, so training accuracy is optimistic', '训练数据参与了拟合，训练准确率偏乐观'), T('Overfitting / memorising noise does not generalise', '过拟合 / 记住噪声不能泛化'), T('Evaluate on held-out data the model has not seen', '在模型没见过的留出数据上评估')],
                   T('The model was fitted to the training data, so its accuracy there is optimistic: a flexible model can memorise the noise and still fail on new data (overfitting). What we care about is generalisation, so we measure accuracy on held-out data that was not used in training or tuning, which stands in for unseen data.',
                     'The model was fitted to the training data, so its accuracy there is optimistic: a flexible model can memorise the noise and still fail on new data (overfitting). What we care about is generalisation, so we measure accuracy on held-out data that was not used in training or tuning, which stands in for unseen data.'),
                   T('Three points: optimistic, overfitting, held-out data.', '三个要点：乐观、过拟合、留出数据。')),
            text_q('t-mall', T('Design: the mall customers', '设计题：商场客户'), SET,
                   T('A mall wants to understand its members from customer ID, date of birth and transaction history, with no other information. Propose an approach: which learning setting, which attributes you would build and how you would prepare them, and how you would judge success. (Section C style, about a third of a page.)',
                     '商场想只凭客户编号、出生日期和交易记录来了解会员，没有其他信息。提出一个方案：用哪种学习设定，构造哪些属性、怎样预处理，怎样判断成功。（C 部分风格，约三分之一页。）'),
                   [T('Unsupervised: clustering of customers (no labels)', '无监督：对客户聚类（没有标签）'), T('Attributes from the data: age from date of birth, spend, frequency, recency; numeric, so scale them (standardise)', '从数据构造属性：由出生日期得年龄、消费额、频率、最近一次消费；数值型，需缩放（标准化）'),
                    T('Handle missing or suspicious values (disguised missing, e.g. default birthdays)', '处理缺失或可疑的值（伪装的缺失，如默认生日）'), T('Evaluation is subjective: inspect and name clusters, check they are useful for marketing', '评估是主观的：查看并命名各群，检查对营销是否有用')],
                   T('This is an unsupervised problem: there are no labels, so I would cluster customers (for example with k-means or hierarchical clustering). From the raw data I would build numeric attributes per customer: age (from the date of birth), total spend, number of visits and days since the last visit. Because the attributes have very different scales, I would standardise them (z-score) so that no attribute dominates the distance. I would check for disguised missing data such as many members born on 1 January, and decide how to impute or drop them. Success cannot be measured against labels, so I would examine each cluster\'s profile, give it a meaning (such as frequent low spenders) and judge whether it supports different marketing actions, perhaps also checking that clusters are stable across runs.',
                     'This is an unsupervised problem: there are no labels, so I would cluster customers (for example with k-means or hierarchical clustering). From the raw data I would build numeric attributes per customer: age (from the date of birth), total spend, number of visits and days since the last visit. Because the attributes have very different scales, I would standardise them (z-score) so that no attribute dominates the distance. I would check for disguised missing data such as many members born on 1 January, and decide how to impute or drop them. Success cannot be measured against labels, so I would examine each cluster\'s profile, give it a meaning (such as frequent low spenders) and judge whether it supports different marketing actions, perhaps also checking that clusters are stable across runs.'),
                   T('A design answer: setting, attributes with preparation, and evaluation, each justified in one sentence.', '设计题的答法：设定、属性及其预处理、评估，每一项用一句话说明理由。')),
            read('remember', T('What to remember', '要记住的'),
                 table([T('Topic', '话题'), T('The point', '要点')],
                       [T('Vocabulary', '词汇'), T('instance = row, attribute/feature = column, concept = the label to learn; feature vector $\\mathbf{x}$', '实例 = 行，属性/特征 = 列，概念 = 要学的标签；特征向量 $\\mathbf{x}$')],
                       [T('Settings', '设定'), T('supervised: classification (discrete label), regression (numeric label); unsupervised: clustering, association, anomaly detection, dimensionality reduction', '监督：分类（离散标签）、回归（数值标签）；无监督：聚类、关联、异常检测、降维')],
                       [T('Classification vs regression', '分类 vs 回归'), T('can all labels be listed (right or wrong) vs infinitely many (close enough)', '标签能否全部列出（对或错） vs 有无穷多（够接近就行）')],
                       [T('Types', '类型'), T('nominal: =; ordinal: = and order, no distances; numeric: all arithmetic', '名义：=；序数：= 和顺序，无距离；数值：所有算术')],
                       [T('Nominal to numeric', '名义转数值'), T('integer codes invent order and distance; one-hot is fair but adds columns and sparsity', '整数编码凭空造出顺序和距离；one-hot 公平，但增加列数和稀疏性')],
                       [T('Numeric to nominal', '数值转名义'), T('equal width: $(\\max-\\min)/n$, simple, outlier-sensitive; equal frequency: same count, robust, hard to interpret; clustering', '等宽：$(\\max-\\min)/n$，简单，怕异常值；等频：个数相同，稳健，难解释；聚类')],
                       [T('Scaling', '缩放'), T('z-score $(x-\\mu)/\\sigma$; min-max $(x-\\min)/(\\max-\\min)$; fit on training data', 'z 分数 $(x-\\mu)/\\sigma$；min-max $(x-\\min)/(\\max-\\min)$；在训练数据上确定')],
                       [T('Missing', '缺失'), T('MAR vs MNAR, disguised missing; mean/median/mode imputation shrinks variance', 'MAR vs MNAR，伪装的缺失；均值/中位数/众数填补会让方差变小')],
                       [T('Generalisation', '泛化'), T('goal = error on unseen data; training error is optimistic; evaluate on held-out data', '目标 = 没见过的数据上的误差；训练误差偏乐观；在留出数据上评估')],
                       [T('Inductive bias', '归纳偏置'), T('data alone never fixes the rule; each model bets on a structure; strong bias underfits, weak bias overfits', '光靠数据定不下规则；每个模型都押注一种结构；偏置强则欠拟合，偏置弱则过拟合')])),
        ])


# ================================================================ lesson 2: probability
from fractions import Fraction as Fr

# ---- numbers
MOVIE = {'romance': (0.05, 0.1, 0.3), 'thriller': (0.1, 0.2, 0.1), 'comedy': (0.1, 0.025, 0.025)}  # columns EU, NA, AUS (slide 12)
GENRES, MARKETS = list(MOVIE), ['EU', 'NA', 'AUS']
P_GENRE = {g: round(sum(MOVIE[g]), 4) for g in GENRES}
P_MARKET = [round(sum(MOVIE[g][j] for g in GENRES), 4) for j in range(3)]
assert P_GENRE == {'romance': 0.45, 'thriller': 0.4, 'comedy': 0.15} and P_MARKET == [0.25, 0.325, 0.425]
P_ROM_GIVEN_AUS = 0.3 / P_MARKET[2]
P_AUS_GIVEN_ROM = 0.3 / P_GENRE['romance']

# conditional independence example: C = hot day (prob 0.5); A = ice cream bought, B = sunburn
PC = {'hot': 0.5, 'cold': 0.5}
PA = {'hot': 0.8, 'cold': 0.2}
PB = {'hot': 0.6, 'cold': 0.1}
CI_A = sum(PC[c] * PA[c] for c in PC)
CI_B = sum(PC[c] * PB[c] for c in PC)
CI_AB = sum(PC[c] * PA[c] * PB[c] for c in PC)
assert abs(CI_A - 0.5) < 1e-12 and abs(CI_B - 0.35) < 1e-12 and abs(CI_AB - 0.25) < 1e-12
CI_PROD = CI_A * CI_B

STUDY = 0.3 * 0.6 / 0.2
STUDY2 = 0.3 * 0.6 / 0.4
assert abs(STUDY - 0.9) < 1e-12 and abs(STUDY2 - 0.45) < 1e-12
TAXI_RED, TAXI_OR, TAXI_ACC = 0.15, 0.85, 0.8
TAXI = TAXI_RED * TAXI_ACC / (TAXI_RED * TAXI_ACC + TAXI_OR * (1 - TAXI_ACC))
assert abs(TAXI - 120 / 290) < 1e-12

# practice: a test for a disease
PREV, SENS, FPR = 0.02, 0.9, 0.08
DIS = PREV * SENS / (PREV * SENS + (1 - PREV) * FPR)
BIN5 = math.comb(5, 3) * 0.4 ** 3 * 0.6 ** 2
ENT3 = -sum(q * math.log2(q) for q in (0.6, 0.3, 0.1))
H09 = -0.9 * math.log2(0.9) - 0.1 * math.log2(0.1)
H_PLAY = -(9 / 14) * math.log2(9 / 14) - (5 / 14) * math.log2(5 / 14)
assert abs(BIN5 - 0.2304) < 1e-9 and abs(Fr(10, 7776) - Fr(5, 3888)) == 0

MLE_N, MLE_K = 10, 7
LIK = lambda th, n, k: th ** k * (1 - th) ** (n - k)
ROLLS = [2, 3, 4, 3, 5, 3]
assert sum(ROLLS) == 20
MAP_A, MAP_B, MAP_N = 21, 81, 100
MAP = (MAP_A + 0 - 1) / (MAP_A + MAP_B + MAP_N - 2)
assert abs(MAP - 0.1) < 1e-12


def norm_pdf(x, mu, sd):
    return math.exp(-((x - mu) ** 2) / (2 * sd * sd)) / (sd * math.sqrt(2 * math.pi))


def fig_cards(lang):
    f = Fig(640, 330, lang)
    suits = [('♥', f.L('hearts', '红桃'), True), ('♦', f.L('diamonds', '方块'), True), ('♣', f.L('clubs', '梅花'), False), ('♠', f.L('spades', '黑桃'), False)]
    ranks = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K']
    x0, y0, cw, ch = 112, 56, 30, 46
    for j, r in enumerate(ranks):
        f.text(x0 + j * cw + cw / 2, y0 - 10, r, 15, MUTED, 'middle')
    for i, (sym, name, red) in enumerate(suits):
        f.text(x0 - 10, y0 + i * ch + 30, f'{sym} {name}', 16, ORANGE if red else INK, 'end')
        for j in range(13):
            fill = '#fbdcc8' if (i == 0 and red) else ('#fdf1e8' if red else '#eceef1')
            f.rect(x0 + j * cw, y0 + i * ch, cw, ch, fill, '#ffffff', 1.5, 0)
    f.rect(x0, y0, 13 * cw, 2 * ch, 'none', ORANGE, 3, 3)
    f.rect(x0, y0, 13 * cw, ch, 'none', ORANGE, 3, 3)
    xr = x0 + 13 * cw + 14
    f.text(xr, y0 + 22, f.L('hearts: 13', '红桃：13'), 17, ORANGE, 'start', '600')
    f.text(xr, y0 + ch + 44, f.L('red: 26', '红色：26'), 17, ORANGE, 'start', '600')
    f.text(x0, y0 + 4 * ch + 42, f.L('P(heart | red) = 13 / 26', 'P(红桃 | 红色) = 13 / 26'), 20, INK, 'start', '600')
    f.text(x0, y0 + 4 * ch + 72, f.L('P(heart, red) = 13 / 52', 'P(红桃, 红色) = 13 / 52'), 17, MUTED)
    return f.svg()


def fig_gauss(lang):
    L = lambda en, zh: zh if lang == 'zh' else en
    pl = Plot(-5, 8, 0, 0.5)
    for mu, sd, col, name, tx, ty in ((0, 1, BLUE, 'μ = 0, σ = 1', -4.8, 0.36), (0, 2, ORANGE, 'μ = 0, σ = 2', -4.8, 0.28), (3, 1, GREEN, 'μ = 3, σ = 1', 4.0, 0.36)):
        pl.curve(lambda x, m=mu, s=sd: norm_pdf(x, m, s), -5, 8, col, 3.5, n=160)
        pl.text(tx, ty, name, col, 17, 'start')
    pl.axes('x', 'p(x)', xticks=(-4, -2, 0, 2, 4, 6, 8))
    return pl.svg()


def fig_lik(lang):
    L = lambda en, zh: zh if lang == 'zh' else en
    pl = Plot(0, 1, 0, 1.18)
    for n, k, col in ((10, 7, BLUE), (100, 70, ORANGE)):
        m = LIK(k / n, n, k)
        pl.curve(lambda t, n=n, k=k, m=m: LIK(t, n, k) / m, 0.001, 0.999, col, 3.5, n=200)
    pl.guide(0.7, 1.0)
    pl.dot(0.7, 1.0, INK, 6)
    pl.text(0.7, 1.0, 'θ̂ = 0.7', INK, 18, 'start', dx=10, dy=-10)
    pl.text(0.18, 0.55, 'N = 10, k = 7', BLUE, 17, 'start')
    pl.text(0.12, 1.08, 'N = 100, k = 70', ORANGE, 17, 'start')
    pl.axes('θ', L('L(θ), relative', 'L(θ)，相对值'), xticks=(0, 0.25, 0.5, 0.75, 1))
    return pl.svg()


def L_probability():
    R, BY, DS, ML, EN = 'probability.rules', 'probability.bayes', 'probability.dists', 'probability.mle', 'probability.entropy'
    mt_rows = [[g] + [f'{v:g}' for v in MOVIE[g]] + [f'{P_GENRE[g]:g}'] for g in GENRES] + [['P(B)'] + [f'{v:g}' for v in P_MARKET] + ['1']]
    return dict(
        id=lid('probability'), title=T('Probability and maximum likelihood, from the definition', '概率与最大似然：从定义出发'),
        description=T('The rules of probability derived from one definition, Bayes\' rule and its base-rate trap, the distributions of the subject, expectation, maximum likelihood by calculus, and entropy as expected surprise.',
                      '从一条定义推出全部概率规则，贝叶斯公式及其“基础概率”陷阱，这门课用到的分布，期望，用微积分求最大似然，以及把熵讲成“期望的惊讶”。'),
        minutes=45,
        skills=[{'id': R, 'name': T('Rules of probability', '概率规则')}, {'id': BY, 'name': T("Bayes' rule", '贝叶斯公式')}, {'id': DS, 'name': T('Distributions and expectation', '分布与期望')},
                {'id': ML, 'name': T('Maximum likelihood', '最大似然')}, {'id': EN, 'name': T('Entropy', '熵')}],
        misconceptions=[
            {'id': 'reverse-conditional', 'description': T('Treating P(A|B) as P(B|A)', '把 P(A|B) 当成 P(B|A)')},
            {'id': 'base-rate', 'description': T('Ignoring the prior (base rate) when the evidence is imperfect', '证据不完美时忽略先验（基础概率）')},
            {'id': 'disjoint-independent', 'description': T('Thinking disjoint events are independent', '以为互斥事件就是独立事件')},
            {'id': 'density-is-probability', 'description': T('Reading a density value as a probability', '把密度值当成概率')},
            {'id': 'likelihood-is-posterior', 'description': T('Reading the likelihood of a parameter as the probability that the parameter is right', '把参数的似然当成“参数正确的概率”')}],
        steps=[
            read('why', T('Why probability, and what you must write from memory', '为什么要概率，以及哪些公式要默写'),
                 p(T(r"Look at the typical tasks: document $\to$ spam or not, handwritten digit $\to$ 0-9, purchase history $\to$ which book to recommend. In each, the honest answer is not 'it is spam' but 'it is spam with probability 0.9'. Probability is the language that lets a model say how sure it is, because data are few, noisy, or both.",
                     r"看看典型任务：文档 $\to$ 是不是垃圾邮件，手写数字 $\to$ 0-9，购买记录 $\to$ 推荐哪本书。在每个任务里，诚实的回答不是“它是垃圾邮件”，而是“它有 0.9 的概率是垃圾邮件”。数据又少又吵（或两者兼有）的时候，概率就是让模型说出“有多确定”的语言。")),
                 ul(T(r"**Uncertainty** from few observations and noisy data.", r"**不确定性**：来自观测太少、数据有噪声。"),
                    T(r"**Features follow distributions**: we model how a class generates its attribute values.", r"**特征服从分布**：我们为“一个类别怎样产生属性值”建模。"),
                    T(r"**Soft predictions**: 'we are 60% confident Bob will like this book'.", r"**软预测**：“我们有 60% 的把握 Bob 会喜欢这本书”。")),
                 p(T(r"A probabilistic model formalises a hypothesis as a distribution and uses the laws of probability to derive predictions (George Box: all models are wrong, some are useful). This lesson is the toolbox: the laws, the distributions, how to fit a distribution to data (maximum likelihood), and entropy, which leads straight into decision trees.",
                     r"概率模型把假设形式化为分布，再用概率定律推出预测（George Box：所有模型都是错的，但有些有用）。这一课就是工具箱：定律、分布、怎样让分布去拟合数据（最大似然），以及通向决策树的熵。")),
                 callout('warning', T('The exam gives you no probability formulas', '考试不给概率公式'),
                         T(r"Lecture 23: formulas are printed next to each question **except probability**. So this lesson derives each rule from the one before, because a rule you can derive is a rule you can reproduce. A recall page near the end lists what to write from memory.",
                           r"第 23 讲：每道题旁边都会印公式，**唯独概率除外**。所以这一课把每条规则都从前一条推出来，能推出来的规则就能默写出来。接近结尾有一页默写清单。")),
                 chapter=T('The rules of probability', '概率的规则')),
            read('basics', T('Events, joint and conditional probability', '事件、联合概率与条件概率'),
                 p(T(r"$P(A=a)$ is the probability that the random variable $A$ takes the value $a$: the fraction of times the event is true over many independent trials. It lies in $[0,1]$, a certain event has probability 1, an impossible one 0, and over a set of mutually exclusive, exhaustive outcomes the probabilities sum to 1. We often write $P(x)$ for $P(A=x)$, and $P(A)$ for the whole distribution over $A$ (a histogram).",
                     r"$P(A=a)$ 是随机变量 $A$ 取值 $a$ 的概率：很多次独立试验中该事件为真的比例。它落在 $[0,1]$ 内，必然事件为 1，不可能事件为 0，一组互斥且穷尽的结果，概率之和为 1。常把 $P(A=x)$ 简写成 $P(x)$，而 $P(A)$ 表示 $A$ 的整个分布（一张直方图）。")),
                 p(T(r"The deck's world is a deck of 52 cards: 13 ranks in 4 suits, hearts and diamonds red, clubs and spades black.", r"讲义的世界是一副 52 张的牌：4 种花色、各 13 个点数，红桃和方块是红色，梅花和黑桃是黑色。")),
                 table([T('Event', '事件'), T('Probability', '概率'), T('Why', '为什么')],
                       [T('queen', 'Q'), '$4/52 = 1/13$', T('4 queens', '4 张 Q')], [T('heart', '红桃'), '$13/52 = 1/4$', T('13 hearts', '13 张红桃')], [T('red', '红色'), '$26/52 = 1/2$', T('hearts + diamonds', '红桃 + 方块')],
                       [T('ace or king', 'A 或 K'), '$4/52 + 4/52 = 8/52$', T('disjoint: no card is both, so add', '互斥：没有牌既是 A 又是 K，所以相加')]),
                 p(T(r"For disjoint events $P(A \text{ or } B) = P(A) + P(B)$. If they can overlap, the overlap is counted twice and must be taken off once: $P(A \text{ or } B) = P(A) + P(B) - P(A, B)$ (ace or heart: $4/52 + 13/52 - 1/52 = 16/52$).",
                     r"互斥事件满足 $P(A \text{ 或 } B) = P(A) + P(B)$。若两者可能重叠，重叠部分被数了两次，要减掉一次：$P(A \text{ 或 } B) = P(A) + P(B) - P(A, B)$（A 或红桃：$4/52 + 13/52 - 1/52 = 16/52$）。")),
                 h(T('Joint and conditional', '联合与条件')),
                 p(T(r"The **joint** probability $P(A,B) = P(A \cap B)$ is the probability that both happen: $P(\text{ace}, \text{spade}) = 1/52$, $P(\text{heart}, \text{red}) = 13/52$. The **conditional** probability asks the question inside a smaller world: *given that $B$ is true, how likely is $A$?*",
                     r"**联合**概率 $P(A,B) = P(A \cap B)$ 是两件事都发生的概率：$P(\text{A}, \text{黑桃}) = 1/52$，$P(\text{红桃}, \text{红色}) = 13/52$。**条件**概率是在一个更小的世界里发问：*已知 $B$ 为真，$A$ 有多大可能？*")),
                 math_(r'P(A \mid B) = \frac{P(A, B)}{P(B)}'),
                 p(T(r"Read it as two steps. Throw away every outcome where $B$ is false (the denominator $P(B)$ is the size of the world that remains). Of that world, count the part where $A$ is also true (the numerator). In the picture: of the 26 red cards, 13 are hearts.",
                     r"分两步读。把 $B$ 为假的结果全部扔掉（分母 $P(B)$ 就是剩下的世界的大小）。在这个世界里，数 $A$ 也为真的那一部分（分子）。看图：26 张红牌里，13 张是红桃。")),
                 svg(drawn(fig_cards), T('A 13 by 4 grid of the 52 cards. The two red rows are outlined (26 cards), the hearts row inside them is the darker row (13 cards). P(heart | red) = 13/26, P(heart, red) = 13/52.',
                                         '52 张牌排成 13 乘 4 的格子。两个红色行（26 张）用框标出，其中的红桃行颜色更深（13 张）。P(红桃 | 红色) = 13/26，P(红桃, 红色) = 13/52。')),
                 p(T(r"The conditional is **not symmetric**: $P(\text{heart} \mid \text{red}) = 13/26 = 1/2$, but $P(\text{red} \mid \text{heart}) = 13/13 = 1$. Confusing the two is the most common mistake in this topic.",
                     r"条件概率**不对称**：$P(\text{红桃} \mid \text{红色}) = 13/26 = 1/2$，但 $P(\text{红色} \mid \text{红桃}) = 13/13 = 1$。把两者弄混是这个话题里最常见的错误。")),
                 quiz(T(r"What is $P(\text{ace} \mid \text{spade})$?", r"$P(\text{A} \mid \text{黑桃})$ 是多少？"),
                      [(T(r"$1/52$", r"$1/52$"), T(r"That is the joint $P(\text{ace}, \text{spade})$. For the conditional, restrict to the 13 spades first.", r"那是联合概率 $P(\text{A}, \text{黑桃})$。条件概率要先把范围限制到 13 张黑桃。")),
                       (T(r"$1/13$: one ace among the 13 spades", r"$1/13$：13 张黑桃里有一张 A"), True),
                       (T(r"$4/52$", r"$4/52$"), T(r"That is $P(\text{ace})$ in the whole deck, ignoring the information that the card is a spade.", r"那是整副牌里的 $P(\text{A})$，没用上“这张牌是黑桃”这条信息。"))],
                      T(r"$P(\text{ace} \mid \text{spade}) = \frac{1/52}{13/52} = \frac{1}{13}$. It equals $P(\text{ace})$ too: knowing the suit tells you nothing about the rank. That is independence, next.", r"$P(\text{A} \mid \text{黑桃}) = \frac{1/52}{13/52} = \frac{1}{13}$。它也等于 $P(\text{A})$：知道花色并不告诉你点数。这就是独立性，下一页讲。")),
                 skill=R),
            read('indep', T('Independence and conditional independence', '独立与条件独立'),
                 p(T(r"$A$ and $B$ are **independent** exactly when the joint is the product of the parts:", r"$A$ 与 $B$ **独立**，当且仅当联合概率等于各自概率的乘积：")),
                 math_(r'P(A, B) = P(A)\,P(B) \quad\Longleftrightarrow\quad P(A \mid B) = P(A)'),
                 p(T(r"The second form says what it means: learning $B$ does not change your belief about $A$ (divide the first form by $P(B)$ to see they are the same). The deck's two cases:",
                     r"第二种写法说出了它的含义：知道 $B$ 并不改变你对 $A$ 的信念（把第一种写法两边除以 $P(B)$ 就得到第二种）。讲义的两个例子：")),
                 table([T('Pair', '一对事件'), T('Joint', '联合'), T('Product', '乘积'), T('So', '结论')],
                       [T('ace, spade', 'A, 黑桃'), '$1/52$', r'$\frac{4}{52}\times\frac{13}{52} = \frac{1}{52}$', T('independent', '独立')],
                       [T('heart, red', '红桃, 红色'), '$13/52 = 1/4$', r'$\frac{26}{52}\times\frac{13}{52} = \frac{1}{8}$', T('dependent: red makes heart twice as likely', '不独立：红色让红桃的可能性翻倍')]),
                 callout('warning', T('Disjoint is not independent', '互斥不等于独立'),
                         T(r"If $A$ and $B$ are disjoint and both possible, then $P(A,B) = 0 \ne P(A)P(B)$. They are as dependent as can be: if one happens the other cannot.", r"若 $A$ 与 $B$ 互斥且都有可能发生，则 $P(A,B) = 0 \ne P(A)P(B)$。它们依赖得不能再依赖了：一个发生，另一个就不可能发生。")),
                 h(T('Conditional independence', '条件独立')),
                 p(T(r"$A$ and $B$ are **conditionally independent given $C$** if, once $C$ is known, $B$ tells nothing more about $A$:", r"如果已知 $C$ 之后，$B$ 不再提供关于 $A$ 的任何信息，就说 $A$ 与 $B$ **在给定 $C$ 时条件独立**：")),
                 math_(r'P(A, B \mid C) = P(A \mid C)\,P(B \mid C) \quad\Longleftrightarrow\quad P(A \mid B, C) = P(A \mid C)'),
                 p(T(rf"The two notions are separate: neither implies the other. Example: it is hot with probability 0.5. On a hot day, ice cream is bought ($A$) with probability {PA['hot']:g}, sunburn ($B$) occurs with probability {PB['hot']:g}; on a cold day {PA['cold']:g} and {PB['cold']:g}. Given the temperature, the two are independent by construction.",
                     rf"这是两个独立的概念：谁也推不出谁。例子：天热的概率为 0.5。热天买冰淇淋（$A$）的概率为 {PA['hot']:g}，晒伤（$B$）的概率为 {PB['hot']:g}；冷天分别为 {PA['cold']:g} 和 {PB['cold']:g}。给定温度，两者按构造独立。")),
                 p(T(rf"But without the temperature: $P(A) = {CI_A:g}$, $P(B) = {CI_B:g}$, $P(A,B) = 0.5(0.8)(0.6) + 0.5(0.2)(0.1) = {CI_AB:g}$, while $P(A)P(B) = {CI_PROD:.3f}$. Ice cream and sunburn are dependent, because heat drives both; conditioning on the heat removes the link.",
                     rf"但不看温度：$P(A) = {CI_A:g}$，$P(B) = {CI_B:g}$，$P(A,B) = 0.5(0.8)(0.6) + 0.5(0.2)(0.1) = {CI_AB:g}$，而 $P(A)P(B) = {CI_PROD:.3f}$。冰淇淋和晒伤是相关的，因为天热同时推动了两者；给定温度就切断了这条联系。")),
                 p(T(r"Remember this shape: **a common cause makes effects dependent; conditioning on the cause makes them independent again.** Naive Bayes assumes exactly this, that the attributes are independent given the class.", r"记住这个形状：**共同的原因使结果相关；给定原因后它们又独立了。**朴素贝叶斯假设的正是这个：给定类别后，各属性相互独立。")),
                 quiz(T('Which statement is correct?', '下面哪个说法正确？'),
                      [(T('Disjoint events with positive probability are independent', '概率为正的互斥事件是独立的'), T('Disjoint means $P(A,B)=0$, but $P(A)P(B)>0$. They are dependent.', '互斥意味着 $P(A,B)=0$，而 $P(A)P(B)>0$。它们是相关的。')),
                       (T('If $A$ and $B$ are independent they are independent given any $C$', '如果 $A$ 与 $B$ 独立，则对任何 $C$ 它们都条件独立'), T('Not in general: two fair coins are independent, but given $C$ = "the two coins agree" they are completely dependent.', '一般不成立：两枚公平硬币相互独立，但给定 $C$ =“两枚硬币结果相同”，它们就完全相关了。')),
                       (T('Conditional independence given $C$ does not imply plain independence (the temperature example)', '给定 $C$ 的条件独立并不意味着无条件独立（温度的例子）'), True)],
                      T('Independence and conditional independence are different properties; either can hold without the other.', '独立与条件独立是不同的性质，一个成立时另一个不一定成立。')),
                 skill=R),
            read('marg', T('Marginalisation: summing a variable out', '边缘化：把一个变量求和消掉'),
                 p(T(r"Sometimes you hold a joint table and want the probability of $A$ alone, whatever $B$ is. Every outcome of $A$ happens together with exactly one outcome of $B$, so add up over all of them:", r"有时你手里是一张联合分布表，想知道的只是 $A$ 本身的概率，不管 $B$ 是什么。$A$ 的每个结果都恰好和 $B$ 的一个结果同时发生，所以把它们全加起来：")),
                 math_(r'P(A) = \sum_{b} P(A, B=b)'),
                 p(T(r"The deck's example: the probability that a movie succeeds, by genre $A$ and market $B$. The margins of the table are the sums of its rows and columns (hence the name).", r"讲义的例子：一部电影成功的概率，按类型 $A$ 和市场 $B$ 划分。表的边缘就是各行各列的和（“边缘”由此得名）。")),
                 table([T('A \\ B', 'A \\ B')] + MARKETS + ['P(A)'], *mt_rows),
                 p(T(rf"Summing a row gives the genre: romance $0.05+0.1+0.3 = {P_GENRE['romance']:g}$. Summing a column gives the market: AUS $0.3+0.1+0.025 = {P_MARKET[2]:g}$. Both margins add to 1. Conditionals come out of the same table: $P(\text{{romance}} \mid \text{{AUS}}) = 0.3/{P_MARKET[2]:g} = {P_ROM_GIVEN_AUS:.3f}$, while $P(\text{{AUS}} \mid \text{{romance}}) = 0.3/{P_GENRE['romance']:g} = {P_AUS_GIVEN_ROM:.3f}$: a different number, as the asymmetry says.",
                     rf"一行加起来是类型：浪漫片 $0.05+0.1+0.3 = {P_GENRE['romance']:g}$。一列加起来是市场：AUS $0.3+0.1+0.025 = {P_MARKET[2]:g}$。两条边缘之和都是 1。条件概率也出自这张表：$P(\text{{浪漫}} \mid \text{{AUS}}) = 0.3/{P_MARKET[2]:g} = {P_ROM_GIVEN_AUS:.3f}$，而 $P(\text{{AUS}} \mid \text{{浪漫}}) = 0.3/{P_GENRE['romance']:g} = {P_AUS_GIVEN_ROM:.3f}$：数字不同，这正是不对称性。")),
                 p(T(r"Combine marginalisation with the product rule (next page) and you get the **law of total probability**, the denominator of Bayes' rule: $P(A) = \sum_b P(A \mid b)\,P(b)$.", r"把边缘化和乘法规则（下一页）合起来，就得到**全概率公式**，也就是贝叶斯公式的分母：$P(A) = \sum_b P(A \mid b)\,P(b)$。")),
                 quiz(T(r"In the table, what is $P(B=\text{NA})$?", r"表里 $P(B=\text{NA})$ 是多少？"),
                      [(T(r"$0.2$", r"$0.2$"), T(r"That is one cell, thriller in NA. Sum the whole NA column.", r"那只是一个格子（NA 的惊悚片）。要把整个 NA 列加起来。")),
                       (T(r"$0.4$", r"$0.4$"), T(r"That is the thriller row total $P(\text{thriller})$, not the NA column.", r"那是惊悚片这一行的合计 $P(\text{惊悚})$，不是 NA 这一列。")),
                       (T(r"$0.1 + 0.2 + 0.025 = 0.325$", r"$0.1 + 0.2 + 0.025 = 0.325$"), True)],
                      T(r"Column sums are the market probabilities: 0.25, 0.325, 0.425.", r"列和就是各市场的概率：0.25, 0.325, 0.425。")),
                 skill=R),
            derive('chain', T('Product rule and chain rule, from the definition', '乘法规则与链式法则：从定义推出'),
                   [(r'P(A \mid B) = \frac{P(A, B)}{P(B)}', T(r"The definition of the conditional probability: the share of the world where $B$ holds in which $A$ holds too.", r"条件概率的定义：在 $B$ 成立的世界里，$A$ 也成立的那一份。")),
                    (r'P(A, B) = P(A \mid B)\,P(B)', T(r"Multiply both sides by $P(B)$. This is the **product rule**: to have both, first have $B$, then $A$ within it.", r"两边乘以 $P(B)$。这就是**乘法规则**：要两者都发生，先有 $B$，再在其中有 $A$。")),
                    (r'P(A, B) = P(B \mid A)\,P(A)', T(r"Swap the roles. $P(A,B)$ and $P(B,A)$ are the same event, so the same joint can be built in either order.", r"把角色对调。$P(A,B)$ 与 $P(B,A)$ 是同一个事件，所以同一个联合概率可以按任一顺序搭起来。")),
                    (r'P(A_1, A_2, A_3) = P(A_1)\,P(A_2 \mid A_1)\,P(A_3 \mid A_1, A_2)', T(r"Apply the product rule twice: treat $(A_1, A_2)$ as one event, then split it.", r"用两次乘法规则：把 $(A_1, A_2)$ 看作一个事件，再把它拆开。")),
                    (r'P(A_1, \dots, A_n) = \prod_{i=1}^{n} P(A_i \mid A_1, \dots, A_{i-1})', T(r"Continue: this is the **chain rule**. Each factor conditions on everything before it. It makes no assumption: it is always true.", r"一直这样做下去，就是**链式法则**。每个因子都以它之前的全部为条件。它不含任何假设，永远成立。")),
                    (r'P(K_1, K_2) = \frac{4}{52}\cdot\frac{3}{51} = \frac{1}{221}', T(r"The deck's example: two kings in a row without replacement. After one king is gone, 3 kings remain among 51 cards.", r"讲义的例子：不放回地连抽两张 K。抽走一张 K 后，51 张牌里剩 3 张 K。")),
                    (r'P(M, T, S) = P(T)\,P(S \mid T)\,P(M \mid T, S)', T(r"The deck's example with $M$ = July, $T$ = 5 degrees, $S$ = sick. The order is free: any ordering of the variables gives a correct factorisation. Some are more natural (July causes 5 degrees causes sickness) and easier to estimate, but all are equal.", r"顺序是自由的：变量的任何排列都给出正确的分解。有些更自然（七月导致 5 度导致生病），也更容易估计，但它们全都相等。"))],
                   outro=T(r"Keep the picture: a joint probability is a product of conditionals. Naive Bayes will simplify each factor with an independence assumption.", r"记住这个图景：联合概率是若干条件概率的乘积。朴素贝叶斯会用独立性假设来化简每一个因子。"),
                   blank=(5, '1/221', T(r"Probability of drawing two kings in a row without replacement (give a fraction).", r"不放回连抽两张 K 的概率（写成分数）。")), skill=R),
            derive('bayes', T("Bayes' rule, derived", '贝叶斯公式的推导'),
                   [(r'P(A \mid B)\,P(B) = P(B \mid A)\,P(A)', T(r"Both sides equal the joint $P(A,B)$ by the product rule, one in each order.", r"由乘法规则，两边都等于联合概率 $P(A,B)$，只是顺序不同。")),
                    (r'P(A \mid B) = \frac{P(B \mid A)\,P(A)}{P(B)}', T(r"Divide by $P(B)$. This is **Bayes' rule**: it turns a conditional around.", r"除以 $P(B)$。这就是**贝叶斯公式**：把条件概率“翻个面”。")),
                    (r'\underbrace{P(A \mid B)}_{①} = \frac{\overbrace{P(B \mid A)}^{②}\ \overbrace{P(A)}^{③}}{\underbrace{P(B)}_{④}}', T(r"The four names. $A$ is the hypothesis, $B$ the evidence. ① Posterior: belief in $A$ after the evidence. ② Likelihood: how probable the evidence is if $A$ is true. ③ Prior: belief in $A$ before the evidence. ④ Evidence: how common $B$ is overall.", r"四个名字。$A$ 是假设，$B$ 是证据。① 后验：看到证据后对 $A$ 的信念。② 似然：若 $A$ 为真，证据有多可能。③ 先验：看到证据前对 $A$ 的信念。④ 证据项：$B$ 总体上有多常见。")),
                    (r'P(B) = \sum_{a} P(B, a) = \sum_{a} P(B \mid a)\,P(a)', T(r"The denominator is not a new quantity: marginalise the joint over all hypotheses, then use the product rule on each term.", r"分母不是新量：把联合概率对所有假设边缘化，再对每一项用乘法规则。")),
                    (r"P(a \mid B) = \frac{P(B \mid a)\,P(a)}{\sum_{a'} P(B \mid a')\,P(a')}", T(r"The full form, with a sum over the hypotheses $a'$ in the denominator. It is what you use when the evidence $P(B)$ is not given.", r"完整形式，分母对各个假设 $a'$ 求和。证据 $P(B)$ 没给出时就用它。")),
                    (r'P(a \mid B) \propto P(B \mid a)\,P(a)', T(r"The denominator is the same for every $a$, so it only rescales until the posteriors sum to 1. To compare hypotheses, compare likelihood times prior.", r"分母对每个 $a$ 都一样，它只是把后验缩放到总和为 1。比较各个假设，只要比较似然乘先验。"))],
                   intro=T(r"Everything needed is on the previous page: the definition of the conditional, the product rule, and marginalisation.", r"需要的东西上一页都有了：条件概率的定义、乘法规则和边缘化。"),
                   outro=T(r"Why this matters for learning: $P(B \mid A)$ ('how does the class produce these features?') is easy to estimate from data; $P(A \mid B)$ ('which class, given these features?') is what we want. Bayes' rule is the bridge, and it is the heart of naive Bayes.", r"它对学习的意义：$P(B \mid A)$（“这个类别怎样产生这些特征？”）容易从数据里估计；$P(A \mid B)$（“看到这些特征，是哪个类别？”）才是我们想要的。贝叶斯公式就是桥梁，也是朴素贝叶斯的核心。"), skill=BY),
            read('bayes-ex', T("Bayes' rule at work, and the base-rate trap", '贝叶斯公式用起来：基础概率陷阱'),
                 p(T(r"The deck's example. Estimate the probability that a student studied hard ($S$) given that they got an H1 ($H$). Known: $P(S) = 0.3$ (prior rate of hard-working students), $P(H \mid S) = 0.6$, $P(H) = 0.2$ (measured).", r"讲义的例子。已知一个学生拿了 H1（$H$），估计他努力学习（$S$）的概率。已知：$P(S) = 0.3$（努力学生的先验比例），$P(H \mid S) = 0.6$，$P(H) = 0.2$（实测）。")),
                 math_(rf'P(S \mid H) = \frac{{P(S)\,P(H \mid S)}}{{P(H)}} = \frac{{0.3 \times 0.6}}{{0.2}} = {STUDY:g}'),
                 p(T(rf"The deck asks: what if $P(H) = 0.4$? Then $0.3 \times 0.6 / 0.4 = {STUDY2:g}$. A larger denominator means H1s are common anyway, so an H1 is weaker evidence of hard work. Sanity check the inputs: $P(H) \ge P(H, S) = 0.3 \times 0.6 = 0.18$, so $0.2$ is possible but only just; $P(H)=0.15$ would be impossible and would give a posterior above 1.",
                     rf"讲义追问：如果 $P(H) = 0.4$ 呢？则 $0.3 \times 0.6 / 0.4 = {STUDY2:g}$。分母越大，说明 H1 本来就常见，所以 H1 对“努力学习”的证明力就越弱。顺手检查输入：$P(H) \ge P(H, S) = 0.3 \times 0.6 = 0.18$，所以 $0.2$ 是可能的，但已很勉强；$P(H)=0.15$ 就不可能了，算出的后验会超过 1。")),
                 p(T(r"The classic trap is **base-rate neglect**: answering with the likelihood and forgetting the prior. The posterior needs both. A test that is right 90% of the time, for a condition that 2% of people have, still mostly flags healthy people, because healthy people are 49 times more common. The taxi problem on the next page makes this exact.", r"经典陷阱是**忽视基础概率**：只用似然回答，忘了先验。后验两者都需要。一个 90% 准确的检测，针对只有 2% 的人患有的病，标出来的仍然多数是健康人，因为健康人多 49 倍。下一页的出租车问题把这一点算清楚。")),
                 quiz(T(r"A cause is rare (prior 1%) but a test for it has likelihood $P(\text{positive} \mid \text{cause}) = 0.99$. Which statement holds?", r"某病因很少见（先验 1%），但检测的似然 $P(\text{阳性} \mid \text{病因}) = 0.99$。哪个说法成立？"),
                      [(T(r"The posterior is 0.99, since the test is accurate", r"后验是 0.99，因为检测很准"), T(r"That is the likelihood, $P(\text{positive} \mid \text{cause})$, not the posterior $P(\text{cause} \mid \text{positive})$.", r"那是似然 $P(\text{阳性} \mid \text{病因})$，不是后验 $P(\text{病因} \mid \text{阳性})$。")),
                       (T(r"The posterior can be small: it depends on the prior and on how often the test is positive without the cause", r"后验可能很小：取决于先验，以及没有病因时检测也呈阳性的频率"), True),
                       (T(r"The posterior is 0.01, the prior", r"后验是 0.01，也就是先验"), T(r"The prior is only where you start. A positive result raises it, by how much depends on the evidence.", r"先验只是起点。阳性结果会把它抬高，抬多少取决于证据。"))],
                      T(r"Posterior $\propto$ likelihood $\times$ prior: a tiny prior can cancel a strong likelihood.", r"后验 $\propto$ 似然 $\times$ 先验：很小的先验可以抵消很强的似然。")),
                 skill=BY),
            derive('taxi', T('The taxi-cab problem', '出租车问题'),
                   [(r'1000 = 150 + 850', T(r"Start with a concrete city of 1000 cabs: 15% are red (150) and 85% orange (850). Counting people is easier than multiplying probabilities.", r"想象一座有 1000 辆出租车的城市：15% 红色（150 辆）、85% 橙色（850 辆）。数“多少辆”比乘概率容易。")),
                    (r'150 \times 0.8 = 120', T(r"The witness is wrong 20% of the time, so right 80%. Of the 150 red cabs, 120 are correctly called red.", r"目击者 20% 的时候会错，所以 80% 对。150 辆红车里，120 辆被正确地说成红色。")),
                    (r'850 \times 0.2 = 170', T(r"Of the 850 orange cabs, 170 are wrongly called red.", r"850 辆橙车里，170 辆被错说成红色。")),
                    (r'120 + 170 = 290', T(r"The witness says 'red' for 290 cabs in all. This is the evidence $P(R=\text{red})$ times 1000.", r"目击者一共对 290 辆车说“红色”。这就是证据项 $P(R=\text{红})$ 乘以 1000。")),
                    (r'P(C{=}r \mid R{=}r) = \frac{120}{290} \approx 0.41', T(r"Here $C$ is the true colour, $R$ the reported one, $r$ = red. Among the cabs called red, 120 really are red. Most people answer 80%: they use the likelihood and ignore that red cabs are rare.", r"这里 $C$ 是真实颜色，$R$ 是报告的颜色，$r$ 表示红。在被说成红色的车里，真的是红色的有 120 辆。多数人回答 80%：他们只用了似然，忽略了红车本来就少。")),
                    (r'\frac{0.15 \times 0.8}{0.15 \times 0.8 + 0.85 \times 0.2} = \frac{0.12}{0.29}', T(r"The same in Bayes' rule with the evidence expanded by marginalisation. The numerator is the red-and-called-red mass, the denominator adds orange-and-called-red.", r"同样的事用贝叶斯公式写：证据项用边缘化展开。分子是“红色且被说成红”的份额，分母再加上“橙色且被说成红”。"))],
                   intro=T(r"Taxi-cab problem (Tversky and Kahneman, 1972): 85% of cabs are orange, 15% red. An eyewitness says the cab in an accident was red, and is wrong 20% of the time. What is the probability it was red?", r"出租车问题（Tversky 和 Kahneman，1972）：85% 的出租车是橙色，15% 是红色。目击者说肇事车是红色，他有 20% 的时候会说错。这辆车真是红色的概率是多少？"),
                   outro=T(rf"**Answer:** $0.12/0.29 = {TAXI:.3f}$, about 41%. The report moves the belief from 15% to 41%, a lot, but not to 80%.", rf"**答案：** $0.12/0.29 = {TAXI:.3f}$，约 41%。证词把信念从 15% 推到了 41%，推得很多，但远没有到 80%。"),
                   blank=(3, '290', T(r"How many of the 1000 cabs does the witness call red?", r"1000 辆车里，目击者会把几辆说成红色？")), skill=BY),
            read('rv', T('Random variables, distributions and the Gaussian', '随机变量、分布与高斯分布'),
                 p(T(r"A **random variable** is a variable whose value is the outcome of a random phenomenon, and its **distribution** says how likely each outcome is. A **discrete** variable takes countably many values (heads in coin flips, the card rank); a **continuous** one takes values on a continuum (the height of a student).",
                     r"**随机变量**是取值由随机现象的结果决定的变量，它的**分布**说明每个结果有多可能。**离散**变量取可数个值（抛硬币的正面数、牌的点数）；**连续**变量在连续区间里取值（学生的身高）。")),
                 p(T(r"For a discrete variable the distribution is a table of probabilities that sum to 1. For a continuous one there are infinitely many values, each with probability 0, so we use a **density** $p(x)$: probabilities are *areas* under it, $P(a \le X \le b) = \int_a^b p(x)\,dx$, and the total area is 1.",
                     r"离散变量的分布是一张总和为 1 的概率表。连续变量有无穷多个取值，每个值的概率都是 0，所以用**密度** $p(x)$：概率是密度曲线下的*面积*，$P(a \le X \le b) = \int_a^b p(x)\,dx$，总面积为 1。")),
                 callout('warning', T('A density value is not a probability', '密度值不是概率'),
                         T(r"A density can exceed 1: a Gaussian with $\sigma = 0.1$ has peak height about 3.99, yet it is still a valid distribution because its area is 1. Only areas are probabilities.", r"密度可以大于 1：$\sigma = 0.1$ 的高斯分布峰值约 3.99，但它仍是合法的分布，因为面积是 1。只有面积才是概率。")),
                 p(T(r"The **Gaussian (normal)** distribution is the continuous, symmetric, bell-shaped one, with two parameters: the mean $\mu$ (the most typical value, the centre) and the standard deviation $\sigma$ (the spread; $\sigma^2$ is the variance).", r"**高斯（正态）分布**是连续、对称、钟形的分布，有两个参数：均值 $\mu$（最典型的值，中心）和标准差 $\sigma$（离散程度；$\sigma^2$ 是方差）。")),
                 math_(r'p(x;\mu,\sigma) = \frac{1}{\sigma\sqrt{2\pi}}\exp\!\Big(-\frac{(x-\mu)^2}{2\sigma^2}\Big)'),
                 ul(T(r"$(x-\mu)^2/\sigma^2$: the squared distance from the centre, measured in units of $\sigma$. The minus sign makes the height fall as $x$ moves away.", r"$(x-\mu)^2/\sigma^2$：到中心的距离的平方，以 $\sigma$ 为单位。负号让 $x$ 离中心越远，高度越低。"),
                    T(r"$\frac{1}{\sigma\sqrt{2\pi}}$: the constant that makes the total area exactly 1. A wider curve (larger $\sigma$) must be lower.", r"$\frac{1}{\sigma\sqrt{2\pi}}$：让总面积恰为 1 的常数。曲线越宽（$\sigma$ 越大）就必须越矮。"),
                    T(r"Rule of thumb: about 68% of the area lies within $\mu \pm \sigma$, 95% within $\mu \pm 2\sigma$.", r"经验法则：约 68% 的面积在 $\mu \pm \sigma$ 之内，95% 在 $\mu \pm 2\sigma$ 之内。")),
                 svg(drawn(fig_gauss), T('Three Gaussian curves: mu 0 sigma 1 (blue), mu 0 sigma 2 (orange, wider and lower), mu 3 sigma 1 (green, shifted right).', '三条高斯曲线：μ=0、σ=1（蓝）；μ=0、σ=2（橙，更宽更矮）；μ=3、σ=1（绿，右移）。')),
                 quiz(T(r"Keeping $\mu$, you double $\sigma$. What happens to the peak height of the density?", r"保持 $\mu$ 不变，把 $\sigma$ 加倍。密度的峰值高度怎样变？"),
                      [(T(r"It doubles", r"加倍"), T(r"The prefactor is $1/(\sigma\sqrt{2\pi})$, with $\sigma$ in the denominator: a wider curve is lower, since the area must stay 1.", r"前面的系数是 $1/(\sigma\sqrt{2\pi})$，$\sigma$ 在分母里：曲线变宽就变矮，因为面积必须保持 1。")),
                       (T(r"It halves", r"减半"), True),
                       (T(r"It stays the same; only the tails change", r"不变，只有尾部变化"), T(r"At $x=\mu$ the exponent is 0, so the height is exactly the prefactor, which changes with $\sigma$.", r"$x=\mu$ 时指数为 0，高度恰好是前面的系数，它随 $\sigma$ 变化。"))],
                      T(r"Peak height is $1/(\sigma\sqrt{2\pi})$: halved when $\sigma$ doubles.", r"峰值高度是 $1/(\sigma\sqrt{2\pi})$：$\sigma$ 加倍则减半。"), ),
                 chapter=T('Distributions', '分布'), skill=DS),
            read('ladder', T('Bernoulli, binomial, categorical, multinomial', '伯努利、二项、类别、多项分布'),
                 p(T(r"Four discrete distributions form a small table. Rows: one trial or many. Columns: two outcomes or more.", r"四个离散分布组成一张小表。行：一次试验还是多次。列：两个结果还是更多。")),
                 table(['', T('2 outcomes', '2 个结果'), T('$K > 2$ outcomes', '$K > 2$ 个结果')],
                       [T('1 trial', '1 次试验'), T('**Bernoulli**', '**伯努利**'), T('**Categorical**', '**类别分布**')],
                       [T('$N$ trials (counts)', '$N$ 次试验（计数）'), T('**Binomial**', '**二项分布**'), T('**Multinomial**', '**多项分布**')]),
                 h(T('Bernoulli: one coin', '伯努利：一枚硬币')),
                 math_(r'P(X = x;\,p) = p^{x}(1-p)^{1-x}, \quad x \in \{0,1\}'),
                 p(T(r"Just a compact way to write two cases: $x=1$ gives $p^1(1-p)^0 = p$ (success), $x=0$ gives $p^0(1-p)^1 = 1-p$ (failure). The exponents switch the unwanted factor off.", r"只是把两种情形写成一个式子：$x=1$ 得 $p^1(1-p)^0 = p$（成功），$x=0$ 得 $p^0(1-p)^1 = 1-p$（失败）。指数把不需要的那个因子“关掉”。")),
                 h(T('Binomial: the number of successes in $N$ independent Bernoulli trials', '二项：$N$ 次独立伯努利试验里的成功次数')),
                 math_(r'P(X = x;\,N,p) = \frac{N!}{x!\,(N-x)!}\,p^{x}(1-p)^{N-x}'),
                 ul(T(r"$p^{x}(1-p)^{N-x}$: the probability of **one particular sequence** with $x$ successes (trials multiply because they are independent).", r"$p^{x}(1-p)^{N-x}$：某**一个特定序列**（恰有 $x$ 次成功）的概率（试验独立，所以相乘）。"),
                    T(r"$\frac{N!}{x!(N-x)!} = \binom{N}{x}$: the **number of sequences** that have $x$ successes. Each has the same probability, so multiply.", r"$\frac{N!}{x!(N-x)!} = \binom{N}{x}$：有 $x$ 次成功的**序列个数**。每个序列概率相同，所以相乘。")),
                 h(T('Categorical and multinomial: a die instead of a coin', '类别与多项：用骰子代替硬币')),
                 p(T(r"A single roll of a $K$-sided die is **categorical** with probabilities $p_1,\dots,p_K$ (summing to 1): $P(X=k) = p_k$. Repeat $N$ times and count how often each face came up, $x_1,\dots,x_K$ (with $\sum_k x_k = N$): the counts are **multinomial**.",
                     r"掷一次 $K$ 面骰子是**类别分布**，各面概率 $p_1,\dots,p_K$（和为 1）：$P(X=k) = p_k$。重复 $N$ 次，数每个面出现了几次 $x_1,\dots,x_K$（$\sum_k x_k = N$）：这些计数服从**多项分布**。")),
                 math_(r'P(x_1,\dots,x_K;\,\mathbf{p}) = \frac{(x_1+\dots+x_K)!}{x_1!\cdots x_K!}\prod_{k=1}^{K} p_k^{\,x_k}'),
                 p(T(r"Same structure as the binomial: the product $\prod p_k^{x_k}$ is the probability of one particular sequence with those counts, and the fraction counts the sequences. (The deck writes the categorical as that bare product; it is the probability of one specific sequence, without the counting factor.) Special cases: $K=2$ gives the binomial, $N=1$ gives the categorical, $N=1, K=2$ the Bernoulli. The multinomial is the workhorse of text models: word counts in a document.",
                     r"结构和二项一样：乘积 $\prod p_k^{x_k}$ 是具有这些计数的某一个特定序列的概率，分式数的是序列的个数。（讲义把类别分布写成那个裸乘积；它是一个特定序列的概率，没有计数因子。）特例：$K=2$ 是二项，$N=1$ 是类别，$N=1, K=2$ 是伯努利。多项分布是文本模型的主力：一篇文档里的词频。")),
                 skill=DS),
            derive('count', T('Binomial and multinomial by counting', '用计数算二项和多项'),
                   [(r'P(\text{HHT}) = \tfrac12\cdot\tfrac12\cdot\tfrac12 = \tfrac18', T(r"The deck's coin: 2 heads in 3 tosses of a fair coin. First the probability of one particular sequence, say HHT. Tosses are independent, so multiply.", r"讲义的硬币例子：公平硬币抛 3 次，恰好 2 次正面。先算某一个特定序列（比如 HHT）的概率。各次独立，所以相乘。")),
                    (r'\binom{3}{2} = \frac{3!}{2!\,1!} = 3', T(r"How many sequences have 2 heads? HHT, HTH, THH: three. The formula chooses which 2 of the 3 positions hold the heads.", r"有几个序列恰有 2 次正面？HHT、HTH、THH：三个。公式是在 3 个位置里选出哪 2 个放正面。")),
                    (r'P(X=2;\,3,\tfrac12) = 3 \times \tfrac18 = \tfrac38', T(r"Each of the three sequences has probability 1/8; add them (they are disjoint events).", r"三个序列各有 1/8 的概率；把它们加起来（它们是互斥事件）。")),
                    (r'\left(\tfrac16\right)^{5} = \tfrac{1}{7776}', T(r"Now the deck's die: roll a fair die 5 times; probability of exactly 3 ones and 2 fives. One particular sequence, e.g. 1,1,1,5,5: every roll has probability 1/6, five rolls.", r"再看讲义的骰子：公平骰子掷 5 次，恰好 3 个一点和 2 个五点。某一个特定序列（如 1,1,1,5,5）：每次掷出的概率都是 1/6，共 5 次。")),
                    (r'\frac{5!}{3!\,2!\,0!\,0!\,0!\,0!} = \frac{120}{12} = 10', T(r"The number of orderings of three 1s and two 5s. The four faces that never appear contribute $0! = 1$.", r"三个 1 和两个 5 有多少种排法。四个从未出现的面各贡献 $0! = 1$。")),
                    (r'P = 10 \times \tfrac{1}{7776} = \tfrac{5}{3888}', T(r"Orderings times the probability of one sequence.", r"排法数乘以单个序列的概率。"))],
                   outro=T(r"Both answers have the same shape: (number of arrangements) $\times$ (probability of one arrangement).", r"两个答案是同一个形状：（排列数）$\times$（单个排列的概率）。"),
                   blank=(2, '3/8', T(r"Probability of exactly 2 heads in 3 fair tosses (a fraction).", r"公平硬币抛 3 次恰好 2 次正面的概率（分数）。")), skill=DS),
            derive('expect', T('Deeper: expectation and variance', '深入：期望与方差'),
                   [(r'\mathbb{E}[X] = \sum_{x} x\,P(X=x)', T(r"The **expectation** is the average of the values, each weighted by its probability: the long-run mean over many repetitions.", r"**期望**是各个取值按概率加权的平均：重复很多次后的长期均值。")),
                    (r'\mathbb{E}[D] = \tfrac16(1+2+3+4+5+6) = 3.5', T(r"A fair die $D$. Note that the expectation need not be a value the variable can take.", r"公平骰子 $D$。注意期望不必是变量能取到的值。")),
                    (r'\mathbb{E}[B] = 1\cdot p + 0\cdot(1-p) = p', T(r"A Bernoulli variable $B$ is 1 with probability $p$, else 0.", r"伯努利变量 $B$ 以概率 $p$ 取 1，否则取 0。")),
                    (r'\mathbb{E}[X+Y] = \mathbb{E}[X] + \mathbb{E}[Y]', T(r"**Linearity**: the expectation of a sum is the sum of expectations. It needs no independence.", r"**线性性**：和的期望等于期望之和。不需要独立。")),
                    (r'\mathbb{E}[X] = Np', T(r"A binomial count $X$ is a sum of $N$ Bernoulli variables, so its expectation is $N$ times $p$. For the deck's spam model, $N=100$ and $\theta=0.2$ give 20 spam emails expected in an inbox.", r"二项计数 $X$ 是 $N$ 个伯努利变量之和，所以期望是 $N$ 乘 $p$。讲义的垃圾邮件模型里，$N=100$、$\theta=0.2$，一个收件箱预期有 20 封垃圾邮件。")),
                    (r'\mathbb{E}[f(X)] = \sum_{x} f(x)\,P(x)', T(r"The expectation of a function of $X$: weight $f(x)$, not $x$. This is how an **expected loss** (the generalisation error) and, below, entropy are defined.", r"$X$ 的函数的期望：加权的是 $f(x)$ 而不是 $x$。**期望损失**（泛化误差）和后面的熵都是这样定义的。")),
                    (r'\mathrm{Var}[X] = \mathbb{E}\big[(X-\mu)^2\big] = \mathbb{E}[X^2] - \mu^2', T(r"The **variance** is the expected squared distance from the mean $\mu$; expanding the square gives the second form. For a Bernoulli, $\mathbb{E}[X^2] = p$, so $\mathrm{Var} = p - p^2 = p(1-p)$; independent trials add, so a binomial has $Np(1-p)$ (16 for the spam model).", r"**方差**是到均值 $\mu$ 的距离平方的期望；把平方展开得到第二种写法。伯努利有 $\mathbb{E}[X^2] = p$，所以 $\mathrm{Var} = p - p^2 = p(1-p)$；独立试验的方差相加，所以二项是 $Np(1-p)$（垃圾邮件模型里是 16）。"))],
                   outro=T(r"For the Gaussian, $\mathbb{E}[X] = \mu$ and $\mathrm{Var}[X] = \sigma^2$, which is why those are its parameters.", r"高斯分布有 $\mathbb{E}[X] = \mu$、$\mathrm{Var}[X] = \sigma^2$，这就是它的参数叫这两个名字的原因。"),
                   blank=(1, '3.5', T(r"Expectation of a fair die.", r"公平骰子的期望。")), skill=DS),
            read('mle-idea', T('Fitting a distribution: the likelihood', '拟合分布：似然'),
                 p(T(r"The deck's model: an email is spam with probability $\theta$. The number of spam emails in an inbox of $N=100$ is $X \sim \text{Binomial}(N=100, \theta)$. To predict anything we need $\theta$, but it is unknown. What we have is data: an inbox with $x$ spam emails.",
                     r"讲义的模型：一封邮件是垃圾邮件的概率为 $\theta$。$N=100$ 封邮件的收件箱里的垃圾邮件数是 $X \sim \text{Binomial}(N=100, \theta)$。要预测任何东西都需要 $\theta$，但它未知。我们手里有的是数据：一个收件箱里有 $x$ 封垃圾邮件。")),
                 p(T(r"Turn the question around. The probability $P(X=x;N,\theta)$ has two inputs, the data $x$ and the parameter $\theta$. Probability fixes $\theta$ and asks about the data. The **likelihood** fixes the data and asks how well each $\theta$ explains them:",
                     r"把问题倒过来。概率 $P(X=x;N,\theta)$ 有两个输入：数据 $x$ 和参数 $\theta$。“概率”固定 $\theta$、问数据；**似然**固定数据、问每个 $\theta$ 对数据解释得有多好：")),
                 math_(r'L(\theta) = P(X = x;\,N,\theta), \qquad \hat\theta_{\text{MLE}} = \arg\max_{\theta}\, L(\theta)'),
                 p(T(rf"The **maximum likelihood estimate (MLE)** is the $\theta$ under which the observed data were most probable. Take {MLE_K} spam emails in {MLE_N}: with $\theta = 0.7$, $L = \binom{{{MLE_N}}}{{{MLE_K}}}\,0.7^{{{MLE_K}}}\,0.3^{{{MLE_N - MLE_K}}} = {math.comb(MLE_N, MLE_K) * LIK(0.7, MLE_N, MLE_K):.3f}$; with $\theta = 0.5$, only ${math.comb(MLE_N, MLE_K) * LIK(0.5, MLE_N, MLE_K):.3f}$. The curve of $L$ against $\theta$ peaks at $0.7$, and with ten times the data it peaks at the same place but much more sharply: more data, more certainty.",
                     rf"**最大似然估计（MLE）**是使观测数据最可能出现的那个 $\theta$。取 {MLE_N} 封里有 {MLE_K} 封垃圾邮件：$\theta = 0.7$ 时 $L = \binom{{{MLE_N}}}{{{MLE_K}}}\,0.7^{{{MLE_K}}}\,0.3^{{{MLE_N - MLE_K}}} = {math.comb(MLE_N, MLE_K) * LIK(0.7, MLE_N, MLE_K):.3f}$；$\theta = 0.5$ 时只有 ${math.comb(MLE_N, MLE_K) * LIK(0.5, MLE_N, MLE_K):.3f}$。$L$ 对 $\theta$ 的曲线在 $0.7$ 处达到峰值；数据多十倍，峰值位置不变，但尖得多：数据越多，越确定。")),
                 svg(drawn(fig_lik), T('Likelihood of theta for 7 spam in 10 emails (blue) and 70 in 100 (orange), each scaled to peak 1. Both peak at theta 0.7; the larger sample is much narrower.', 'θ 的似然曲线：10 封里 7 封垃圾（蓝）和 100 封里 70 封（橙），各自缩放到峰值为 1。两者都在 θ=0.7 处最高，样本大的那条窄得多。')),
                 callout('warning', T('A likelihood is not a probability of $\\theta$', '似然不是 $\\theta$ 的概率'),
                         T(r"$L(\theta)$ does not sum or integrate to 1 over $\theta$, and it does not say how probable it is that $\theta = 0.7$. It says how probable the *data* are if $\theta = 0.7$. To get a probability of $\theta$ you need a prior and Bayes' rule (MAP, below).", r"$L(\theta)$ 对 $\theta$ 求和或积分并不等于 1，它也没说“$\theta = 0.7$ 有多可能”。它说的是：如果 $\theta = 0.7$，*数据*有多可能。要得到 $\theta$ 本身的概率，需要先验和贝叶斯公式（下面的 MAP）。")),
                 chapter=T('Maximum likelihood', '最大似然'), skill=ML),
            derive('mle-bern', T('Deeper: MLE of a Bernoulli parameter, by calculus', '深入：用微积分求伯努利参数的 MLE'),
                   [(r'L(\theta) = \prod_{i=1}^{N} \theta^{x_i}(1-\theta)^{1-x_i} = \theta^{k}(1-\theta)^{N-k}', T(r"Independent flips multiply. Each flip contributes the Bernoulli factor. Collecting exponents, $k = \sum_i x_i$ counts the heads. (The binomial coefficient would only add a constant that does not depend on $\theta$.)", r"独立的抛掷相乘。每次抛掷贡献一个伯努利因子。合并指数，$k = \sum_i x_i$ 是正面的次数。（二项系数只会多出一个与 $\theta$ 无关的常数。）")),
                    (r'\ell(\theta) = \log L = k\log\theta + (N-k)\log(1-\theta)', T(r"Take the log. It turns the product into a sum, which is easier to differentiate, and it avoids numbers like $10^{-300}$. Since $\log$ is increasing, $\ell$ and $L$ peak at the same $\theta$.", r"取对数。它把乘积变成和，更容易求导，也避免出现 $10^{-300}$ 这样的小数。因为 $\log$ 单调递增，$\ell$ 与 $L$ 在同一个 $\theta$ 处取最大。")),
                    (r'\frac{d\ell}{d\theta} = \frac{k}{\theta} - \frac{N-k}{1-\theta}', T(r"Differentiate. The derivative of $\log(1-\theta)$ is $-1/(1-\theta)$ by the chain rule.", r"求导。$\log(1-\theta)$ 的导数按链式法则是 $-1/(1-\theta)$。")),
                    (r'\frac{k}{\theta} = \frac{N-k}{1-\theta}', T(r"At the maximum the slope is zero. Move one term across: the 'pull' of the heads equals the 'pull' of the tails.", r"最大值处斜率为零。把一项移到另一边：正面的“拉力”等于反面的“拉力”。")),
                    (r'k(1-\theta) = (N-k)\theta \ \Rightarrow\ k = N\theta', T(r"Cross-multiply; the $k\theta$ terms cancel.", r"交叉相乘；$k\theta$ 项互相抵消。")),
                    (r'\hat\theta = \frac{k}{N}', T(r"The MLE is the **relative frequency** of heads: the fraction you observed.", r"MLE 就是正面的**相对频率**：你观测到的那个比例。")),
                    (r'\frac{d^2\ell}{d\theta^2} = -\frac{k}{\theta^2} - \frac{N-k}{(1-\theta)^2} < 0', T(r"The second derivative is negative everywhere, so $\ell$ is concave and this stationary point is the maximum, not a minimum.", r"二阶导数处处为负，所以 $\ell$ 是凹函数，这个驻点是最大值，不是最小值。")),
                    (rf'N = {MLE_N},\ k = {MLE_K}:\ \hat\theta = {MLE_K}/{MLE_N} = {MLE_K / MLE_N:g}', T(r"The curve of the previous page peaks exactly here.", r"上一页的曲线正好在这里达到峰值。"))],
                   outro=T(r"So 'estimate the probability by the frequency' is not a rule of thumb: it is the maximiser of the likelihood.", r"所以“用频率估计概率”不是经验法则，而是似然函数的最大点。"),
                   blank=(7, f'{MLE_K / MLE_N:g}', T(r"The MLE of the heads probability for 7 heads in 10 flips.", r"10 次抛掷 7 次正面时，正面概率的 MLE。")), skill=ML),
            derive('mle-cat', T('Deeper: MLE of a categorical distribution, with a Lagrange multiplier', '深入：用拉格朗日乘子求类别分布的 MLE'),
                   [(r'\ell(\mathbf{p}) = \sum_{k=1}^{K} n_k \log p_k', T(r"A $K$-sided die rolled $N$ times, face $k$ seen $n_k$ times ($\sum_k n_k = N$). The likelihood is $\prod_k p_k^{n_k}$ (up to a constant counting factor); its log is this sum.", r"掷一个 $K$ 面骰子 $N$ 次，第 $k$ 面出现 $n_k$ 次（$\sum_k n_k = N$）。似然是 $\prod_k p_k^{n_k}$（差一个常数的计数因子）；取对数就是这个和。")),
                    (r'\max_{\mathbf{p}}\ \ell(\mathbf{p}), \qquad \sum_k p_k = 1', T(r"The task is to maximise $\ell$ under the constraint. This time we cannot simply set derivatives to zero: without a constraint, $\ell$ grows by making every $p_k$ bigger. The probabilities must sum to 1.", r"任务是在约束下最大化 $\ell$。这次不能直接令导数为零：没有约束的话，把每个 $p_k$ 都变大，$\ell$ 就会增大。概率之和必须为 1。")),
                    (r'\mathcal{L}(\mathbf{p},\lambda) = \sum_k n_k \log p_k - \lambda\Big(\sum_k p_k - 1\Big)', T(r"The **Lagrangian** adds the constraint with a multiplier $\lambda$. At the constrained maximum, all partial derivatives of $\mathcal{L}$ vanish, and the derivative in $\lambda$ gives back the constraint itself.", r"**拉格朗日函数**用乘子 $\lambda$ 把约束加进去。在带约束的最大值处，$\mathcal{L}$ 的所有偏导数都为零，对 $\lambda$ 的偏导数就是约束本身。")),
                    (r'\frac{\partial\mathcal{L}}{\partial p_k} = \frac{n_k}{p_k} - \lambda = 0', T(r"Differentiate with respect to one $p_k$: only its own term of the sums survives.", r"对某个 $p_k$ 求导：两个和里只剩它自己那一项。")),
                    (r'p_k = \frac{n_k}{\lambda}', T(r"Solve for $p_k$: every probability is proportional to its count; $\lambda$ is the common scale.", r"解出 $p_k$：每个概率都与它的计数成正比；$\lambda$ 是共同的比例。")),
                    (r'1 = \sum_k p_k = \frac{\sum_k n_k}{\lambda} = \frac{N}{\lambda} \ \Rightarrow\ \lambda = N', T(r"Use the constraint to find the scale: the probabilities must add to 1, which fixes $\lambda$ at the total count.", r"用约束定出比例：概率之和必须为 1，由此 $\lambda$ 等于总次数。")),
                    (r'\hat{p}_k = \frac{n_k}{N}', T(r"Each face's MLE is its **relative frequency**. With $K=2$ this is the Bernoulli result of the last page. It is also what naive Bayes does when it estimates $P(\text{word} \mid \text{class})$ by counting.", r"每个面的 MLE 就是它的**相对频率**。$K=2$ 时就是上一页的伯努利结果。朴素贝叶斯用数数估计 $P(\text{词} \mid \text{类})$ 时做的也是这件事。")),
                    (rf'n = {tuple(ROLLS)},\ N = {sum(ROLLS)}:\ \hat{{p}}_5 = {ROLLS[4]}/{sum(ROLLS)} = {ROLLS[4] / sum(ROLLS):g}', T(r"Twenty rolls of a six-sided die gave the counts 2, 3, 4, 3, 5, 3 for faces 1 to 6. The estimate for face 5.", r"六面骰子掷 20 次，点数 1 到 6 的次数是 2, 3, 4, 3, 5, 3。第 5 面的估计值。"))],
                   outro=T(r"The multiplier $\lambda = N$ is the price of the constraint: how much the maximum of $\ell$ would rise per unit of extra probability mass allowed.", r"乘子 $\lambda = N$ 是约束的“价格”：每多允许一个单位的概率质量，$\ell$ 的最大值能增加多少。"),
                   blank=(7, f'{ROLLS[4] / sum(ROLLS):g}', T(r"The MLE of the probability of face 5.", r"第 5 面概率的 MLE。")), skill=ML),
            read('mle-trouble', T('Where MLE goes wrong, and the nudge from a prior', 'MLE 哪里不行，以及先验的“轻推”'),
                 p(T(r"MLE is one choice of estimator among many. Its weakness appears with little data. Suppose the only inbox we have contains no spam: $\hat\theta = 0/100 = 0$, so $P(\text{spam}) = 0$ and $P(\text{not spam}) = 1$: 'spam emails do not exist'. One empty sample does not justify such certainty.",
                     r"MLE 只是众多估计方法中的一种。数据少时它的弱点就暴露了。假设我们仅有的那个收件箱里没有垃圾邮件：$\hat\theta = 0/100 = 0$，于是 $P(\text{垃圾}) = 0$、$P(\text{非垃圾}) = 1$：“垃圾邮件不存在”。一个空样本撑不起这样的确定。")),
                 p(T(r"We usually do believe something beforehand (say, about 20 of 100 emails are spam). Treat $\theta$ itself as unknown with a **prior** $P(\theta)$ and apply Bayes' rule to get a **posterior** over $\theta$:",
                     r"我们事先通常是有看法的（比如 100 封里大约 20 封是垃圾邮件）。把 $\theta$ 本身当成未知量，给它一个**先验** $P(\theta)$，再用贝叶斯公式得到 $\theta$ 的**后验**：")),
                 math_(r'P(\theta \mid X = x) = \frac{P(\theta)\,P(X=x \mid \theta)}{P(X=x)}, \qquad \hat\theta_{\text{MAP}} = \arg\max_\theta\, P(\theta \mid X=x)'),
                 p(T(rf"The **maximum a posteriori (MAP)** estimate is the peak of the posterior. For a Bernoulli parameter with a Beta$(a,b)$ prior it is $(a + k - 1)/(a + b + N - 2)$ (a standard result). A prior Beta$({MAP_A},{MAP_B})$ encodes '20 spam in 100 imaginary emails'; with 0 spam in our 100 real ones: $({MAP_A}+0-1)/({MAP_A}+{MAP_B}+{MAP_N}-2) = 20/200 = {MAP:g}$.",
                     rf"**最大后验（MAP）**估计是后验的峰值。对带 Beta$(a,b)$ 先验的伯努利参数，它是 $(a + k - 1)/(a + b + N - 2)$（标准结果）。先验 Beta$({MAP_A},{MAP_B})$ 相当于“100 封想象的邮件里有 20 封垃圾”；我们真实的 100 封里 0 封垃圾：$({MAP_A}+0-1)/({MAP_A}+{MAP_B}+{MAP_N}-2) = 20/200 = {MAP:g}$。")),
                 p(T(r"The estimate moved from $0$ to $0.1$, halfway between the data (0) and the belief (0.2), because we had as much real as imaginary data. With 10,000 real emails the prior would barely count.",
                     r"估计从 $0$ 移到了 $0.1$，正好在数据（0）和看法（0.2）的中间，因为真实数据和想象数据一样多。真实邮件有 10000 封时，先验就几乎不起作用了。")),
                 p(T(r"Read the prior as **pseudo-counts**: imaginary observations added to the real ones. You will meet this again as Laplace smoothing in naive Bayes. MLE is MAP with a flat prior.", r"把先验读成**伪计数**：加在真实观测之上的想象观测。你会在朴素贝叶斯里再次遇到它，名字是拉普拉斯平滑。MLE 就是先验平坦时的 MAP。")),
                 details(T('MLE of a Gaussian, in four lines', '高斯分布的 MLE，四行'),
                         p(T(r"Data $x_1,\dots,x_N$ independent from $\mathcal{N}(\mu,\sigma^2)$. Log-likelihood:", r"数据 $x_1,\dots,x_N$ 独立取自 $\mathcal{N}(\mu,\sigma^2)$。对数似然：")),
                         math_(r'\ell(\mu,\sigma) = -N\log\sigma - \tfrac{N}{2}\log 2\pi - \frac{1}{2\sigma^2}\sum_i (x_i-\mu)^2'),
                         math_(r'\frac{\partial\ell}{\partial\mu} = \frac{1}{\sigma^2}\sum_i (x_i-\mu) = 0 \ \Rightarrow\ \hat\mu = \frac1N\sum_i x_i'),
                         p(T(r"Setting $\partial\ell/\partial\sigma = 0$ in the same way gives $\hat\sigma^2 = \frac1N\sum_i (x_i-\hat\mu)^2$. The MLE of the mean is the sample mean; the MLE of the variance divides by $N$, not $N-1$ (it is slightly biased low). This is also why least squares and the Gaussian are tied together in linear regression.",
                             r"用同样的办法令 $\partial\ell/\partial\sigma = 0$，得 $\hat\sigma^2 = \frac1N\sum_i (x_i-\hat\mu)^2$。均值的 MLE 是样本均值；方差的 MLE 除以 $N$ 而不是 $N-1$（略微偏小）。线性回归里最小二乘与高斯噪声的联系也由此而来。"))),
                 skill=ML),
            derive('entropy', T('Entropy as expected surprise', '熵：期望的惊讶'),
                   [(r's(x) = -\log_2 P(x)', T(r"How surprised are you when $x$ happens? Not at all if $P(x)=1$ (0 bits); a little for a likely event; a lot for a rare one. $-\log_2 P(x)$ measures it in **bits**: a fair coin landing heads is 1 bit, a 1-in-1024 event is 10 bits.", r"$x$ 发生时你有多惊讶？$P(x)=1$ 时毫不惊讶（0 比特）；常见事件只有一点点；罕见事件非常惊讶。$-\log_2 P(x)$ 用**比特**来度量：公平硬币出现正面是 1 比特，千分之一的事件是 10 比特。")),
                    (r's(x,y) = -\log_2\big(P(x)P(y)\big) = s(x) + s(y)', T(r"Why a logarithm? Two independent events: probabilities multiply, and we want surprises to add. The log turns products into sums, and it is the only sensible measure with this property.", r"为什么是对数？两个独立事件：概率相乘，而我们希望惊讶程度相加。对数把乘积变成和，满足这个性质的合理度量只有它。")),
                    (r'H(X) = \mathbb{E}[s(X)] = -\sum_{x} P(x)\log_2 P(x)', T(r"**Entropy** is the average surprise of the variable, the expectation of $s(X)$: surprise of each outcome weighted by how often it occurs. High entropy = unpredictable, low entropy = predictable.", r"**熵**是这个变量的平均惊讶，即 $s(X)$ 的期望：每个结果的惊讶按它出现的频率加权。熵高 = 难以预测，熵低 = 容易预测。")),
                    (r'H(\tfrac12,\tfrac12) = -2\cdot\tfrac12\log_2\tfrac12 = 1', T(r"A fair coin: each outcome is 1 bit and they are equally likely.", r"公平硬币：每个结果是 1 比特，且概率相等。")),
                    (rf'H(0.9,\,0.1) = -0.9\log_2 0.9 - 0.1\log_2 0.1 = 0.137 + 0.332 = {H09:.3f}', T(r"A biased coin: the common outcome (0.15 bits) is rarely a surprise, the rare one (3.32 bits) is a big one but seldom happens. The average is far below 1.", r"一枚偏心硬币：常见的结果（0.15 比特）几乎不让人惊讶，罕见的结果（3.32 比特）很惊讶但很少发生。平均值远低于 1。")),
                    (r'H(\tfrac14,\tfrac14,\tfrac14,\tfrac14) = \log_2 4 = 2', T(r"Uniform over $K$ outcomes has entropy $\log_2 K$, the maximum possible for $K$ outcomes: nothing is more predictable than anything else. A fair die: $\log_2 6 = 2.585$. A certain outcome: $H = 0$ (with $0\log 0 := 0$).", r"$K$ 个结果均匀分布的熵是 $\log_2 K$，是 $K$ 个结果能达到的最大值：没有哪个结果比别的更好预测。公平骰子：$\log_2 6 = 2.585$。确定的结果：$H = 0$（约定 $0\log 0 := 0$）。")),
                    (rf'H(\tfrac{{9}}{{14}},\tfrac{{5}}{{14}}) = -\tfrac{{9}}{{14}}\log_2\tfrac{{9}}{{14}} - \tfrac{{5}}{{14}}\log_2\tfrac{{5}}{{14}} = {H_PLAY:.3f}', T(r"The weather data of the concepts lesson has 9 'yes' and 5 'no' in the Play column.", r"“基本概念”一课的天气数据里，Play 这一列有 9 个 yes、5 个 no。"))],
                   intro=T(r"The deck stops at probability, but the next lectures need one more idea from it, and it comes straight from expectation.", r"讲义讲到概率为止，但后面几讲还需要从中再引出一个想法，它直接来自期望。"),
                   outro=T(r"**The bridge to decision trees:** a good question to ask about an instance is one whose answer removes the most surprise about its label. Information gain is the entropy of the label before the question minus its average entropy after. Also: the MLE of a categorical distribution is exactly the distribution that minimises the cross-entropy to the observed frequencies, which is the loss of logistic regression later.", r"**通向决策树的桥：**对一个实例最值得问的问题，是答案能消除关于标签的最多惊讶的那个。信息增益就是提问前标签的熵，减去提问后的平均熵。另外：类别分布的 MLE，恰好就是与观测频率的交叉熵最小的那个分布，而交叉熵正是后面逻辑回归的损失。"),
                   blank=(5, '2', T(r"The entropy in bits of a uniform distribution over 4 outcomes.", r"4 个结果均匀分布的熵（比特）。")), skill=EN, chapter=T('Entropy', '熵')),
            read('recall', T('Write it from memory', '默写'),
                 p(T(r"The exam prints no probability formulas. Cover this page, write each item below on paper, then open the item to compare. Do it again tomorrow.", r"考试不印任何概率公式。盖住这一页，把下面每一项默写在纸上，再展开对照。明天再来一遍。")),
                 details(T('Conditional probability', '条件概率'), math_(r'P(A \mid B) = \frac{P(A, B)}{P(B)}')),
                 details(T('Product rule (both orders) and chain rule', '乘法规则（两种顺序）与链式法则'), math_(r'P(A,B) = P(A \mid B)P(B) = P(B \mid A)P(A)'), math_(r'P(A_1,\dots,A_n) = \prod_i P(A_i \mid A_1,\dots,A_{i-1})')),
                 details(T('Marginalisation and total probability', '边缘化与全概率'), math_(r'P(A) = \sum_b P(A, b) = \sum_b P(A \mid b)\,P(b)')),
                 details(T('Independence and conditional independence', '独立与条件独立'), math_(r'P(A,B) = P(A)P(B)'), math_(r'P(A,B \mid C) = P(A \mid C)\,P(B \mid C)')),
                 details(T("Bayes' rule with the evidence expanded", '展开证据项的贝叶斯公式'), math_(r"P(A \mid B) = \frac{P(B \mid A)\,P(A)}{\sum_{a'} P(B \mid a')\,P(a')}")),
                 details(T('Bernoulli and binomial', '伯努利与二项'), math_(r'P(x;p) = p^x(1-p)^{1-x}'), math_(r'P(x;N,p) = \frac{N!}{x!(N-x)!}\,p^x(1-p)^{N-x}')),
                 details(T('Multinomial', '多项分布'), math_(r'P(x_1,\dots,x_K;\mathbf{p}) = \frac{(\sum_k x_k)!}{x_1!\cdots x_K!}\prod_k p_k^{x_k}')),
                 details(T('Gaussian density', '高斯密度'), math_(r'p(x;\mu,\sigma) = \frac{1}{\sigma\sqrt{2\pi}}\,e^{-\frac{(x-\mu)^2}{2\sigma^2}}')),
                 details(T('Expectation and variance', '期望与方差'), math_(r'\mathbb{E}[X] = \sum_x x\,P(x), \qquad \mathrm{Var}[X] = \mathbb{E}[X^2] - \mathbb{E}[X]^2')),
                 details(T('MLE of Bernoulli and categorical', '伯努利与类别分布的 MLE'), math_(r'\hat\theta = \frac{k}{N}, \qquad \hat p_k = \frac{n_k}{N}')),
                 details(T('Posterior and MAP', '后验与 MAP'), math_(r'P(\theta \mid X) = \frac{P(\theta)\,P(X \mid \theta)}{P(X)}, \qquad \hat\theta_{\text{MAP}} = \arg\max_\theta P(\theta \mid X)')),
                 details(T('Entropy', '熵'), math_(r'H(X) = -\sum_x P(x)\log_2 P(x)')),
                 chapter=T('Exam practice', '考试练习'), skill=R),
            number('p-bayes', T('A test for a rare disease', '稀有疾病的检测'), BY,
                   T(rf"2% of a population has a disease. A test is positive for 90% of those who have it, and also for 8% of those who do not. A person tests positive. What is the probability they have the disease? (3 decimals)",
                     rf"人群中 2% 患有某种疾病。检测对患者 90% 呈阳性，对非患者也有 8% 呈阳性。某人检测呈阳性。他患病的概率是多少？（三位小数）"),
                   round(DIS, 3),
                   T(rf"Bayes with the evidence expanded: $\frac{{0.02 \times 0.9}}{{0.02 \times 0.9 + 0.98 \times 0.08}} = \frac{{0.018}}{{0.018 + 0.0784}} = {DIS:.3f}$. Check with 10,000 people: 200 ill, 180 of them positive; 9,800 healthy, 784 positive; $180/(180+784)$.",
                     rf"用展开证据项的贝叶斯公式：$\frac{{0.02 \times 0.9}}{{0.02 \times 0.9 + 0.98 \times 0.08}} = \frac{{0.018}}{{0.018 + 0.0784}} = {DIS:.3f}$。用 10000 人验算：200 人患病，180 人阳性；9800 人健康，784 人阳性；$180/(180+784)$。"),
                   tolerance=0.002, hints=[T('Prior 0.02, likelihood 0.9; the evidence adds the false positives.', '先验 0.02，似然 0.9；证据项要加上假阳性。')]),
            number('p-binom', T('A binomial probability', '二项概率'), DS,
                   T(r"A coin with $P(\text{heads}) = 0.4$ is tossed 5 times. What is the probability of exactly 3 heads? (4 decimals)", r"一枚 $P(\text{正面}) = 0.4$ 的硬币抛 5 次。恰好 3 次正面的概率是多少？（四位小数）"),
                   round(BIN5, 4),
                   T(rf"$\binom{{5}}{{3}}\,0.4^3\,0.6^2 = 10 \times 0.064 \times 0.36 = {BIN5:.4f}$. Ten sequences, each of probability $0.4^3 0.6^2$.", rf"$\binom{{5}}{{3}}\,0.4^3\,0.6^2 = 10 \times 0.064 \times 0.36 = {BIN5:.4f}$。十个序列，每个概率 $0.4^3 0.6^2$。"),
                   tolerance=0.0005),
            number('p-entropy', T('Entropy by hand', '手算熵'), EN,
                   T(r"A label takes three values with probabilities 0.6, 0.3 and 0.1. Compute its entropy in bits (log base 2, 2 decimals).", r"某标签取三个值，概率分别为 0.6、0.3、0.1。求它的熵（比特，以 2 为底，两位小数）。"),
                   round(ENT3, 2),
                   T(rf"$-(0.6\log_2 0.6 + 0.3\log_2 0.3 + 0.1\log_2 0.1) = 0.442 + 0.521 + 0.332 = {ENT3:.3f}$. On a calculator: $\log_2 x = \ln x / \ln 2$.", rf"$-(0.6\log_2 0.6 + 0.3\log_2 0.3 + 0.1\log_2 0.1) = 0.442 + 0.521 + 0.332 = {ENT3:.3f}$。计算器上：$\log_2 x = \ln x / \ln 2$。"),
                   tolerance=0.01, hints=[T('Each term is minus p times log2 p; all three logs are negative.', '每一项是 −p·log2 p；三个对数都是负的。')]),
            choice('c-cond', T('Which equation is Bayes\' rule?', '哪个等式是贝叶斯公式？'), BY,
                   T(r"Pick the correct statement.", r"选出正确的说法。"),
                   [(T(r"$P(A \mid B) = P(B \mid A)$ whenever $A$ and $B$ are both possible", r"只要 $A$ 与 $B$ 都可能发生，就有 $P(A \mid B) = P(B \mid A)$"), T(r"They are equal only if $P(A) = P(B)$. $P(\text{heart} \mid \text{red}) = 1/2$ but $P(\text{red} \mid \text{heart}) = 1$.", r"只有 $P(A) = P(B)$ 时才相等。$P(\text{红桃} \mid \text{红色}) = 1/2$，而 $P(\text{红色} \mid \text{红桃}) = 1$。"), 'reverse-conditional'),
                    (T(r"$P(A \mid B) = P(B \mid A)\,P(A)$", r"$P(A \mid B) = P(B \mid A)\,P(A)$"), T(r"The evidence term is missing: divide by $P(B)$, or the result need not sum to 1.", r"漏了证据项：要除以 $P(B)$，否则结果的总和不一定是 1。"), 'base-rate'),
                    (T(r"$P(A \mid B) = P(B \mid A)\,P(A) / P(B)$", r"$P(A \mid B) = P(B \mid A)\,P(A) / P(B)$"), True),
                    (T(r"$P(A \mid B) = P(A)\,P(B)$", r"$P(A \mid B) = P(A)\,P(B)$"), T(r"That is the independence formula for the joint $P(A,B)$, not a conditional.", r"那是联合概率 $P(A,B)$ 的独立性公式，不是条件概率。"), 'disjoint-independent')],
                   T(r"Both product rules give $P(A,B)$; dividing by $P(B)$ leaves Bayes' rule.", r"两种乘法规则都给出 $P(A,B)$；除以 $P(B)$ 就得到贝叶斯公式。")),
            text_q('t-bayes', T("Bayes' rule in words", '用话说贝叶斯公式'), BY,
                   T("Write down Bayes' rule, name each of its four parts, and say in one line why it is useful for classification. (Section A style.)", "写出贝叶斯公式，说出它四个部分的名称，并用一句话说明它为什么对分类有用。（A 部分风格。）"),
                   [T('P(A|B) = P(B|A)P(A) / P(B)', 'P(A|B) = P(B|A)P(A) / P(B)'), T('Posterior, likelihood, prior, evidence (normalising constant)', '后验、似然、先验、证据（归一化常数）'),
                    T('P(B) = sum over a of P(B|a)P(a)', 'P(B) = Σ_a P(B|a)P(a)'), T('Lets us get P(class | features) from P(features | class) and the class prior', '让我们由 P(特征|类别) 和类别先验得到 P(类别|特征)')],
                   T("P(A|B) = P(B|A) P(A) / P(B). Here P(A|B) is the posterior (belief in hypothesis A after seeing evidence B), P(B|A) the likelihood (how probable the evidence is if A is true), P(A) the prior (belief before the evidence) and P(B) the evidence, a normalising constant equal to the sum over all hypotheses a of P(B|a)P(a). In classification it lets us compute P(class | features), which we want, from P(features | class), which is easy to estimate from training data, and the class prior.",
                     "P(A|B) = P(B|A) P(A) / P(B). Here P(A|B) is the posterior (belief in hypothesis A after seeing evidence B), P(B|A) the likelihood (how probable the evidence is if A is true), P(A) the prior (belief before the evidence) and P(B) the evidence, a normalising constant equal to the sum over all hypotheses a of P(B|a)P(a). In classification it lets us compute P(class | features), which we want, from P(features | class), which is easy to estimate from training data, and the class prior."),
                   T('Formula, four names, and the purpose. Each is a mark.', '公式、四个名称、用途，每项一分。')),
            text_q('t-mle', T('Maximum likelihood: what, how, weakness', '最大似然：是什么、怎么求、弱点'), ML,
                   T('Explain maximum likelihood estimation for the probability of heads of a coin, from 7 heads in 10 tosses. Say what is maximised, why we take the log, what the answer is, and one weakness. (Section A/B style, 4-6 lines.)', '以 10 次抛硬币 7 次正面为例，解释对正面概率的最大似然估计。说明最大化的是什么、为什么取对数、答案是多少，以及一个弱点。（A/B 部分风格，4-6 行。）'),
                   [T('Maximise the likelihood of the data, P(data; theta) = theta^7 (1-theta)^3', '最大化数据的似然 P(data; θ) = θ^7 (1-θ)^3'), T('Log turns the product into a sum, easier derivative, same maximiser, avoids underflow', '取对数把乘积变成和，求导更容易，最大点不变，避免下溢'),
                    T('Derivative zero gives theta = k/N = 0.7 (relative frequency)', '导数为零得 θ = k/N = 0.7（相对频率）'), T('Weakness: little data gives extreme estimates (0 heads gives 0); fix with a prior (MAP)', '弱点：数据少时估计极端（0 次正面得 0）；用先验（MAP）修正')],
                   T("MLE chooses the parameter theta that makes the observed data most probable, i.e. it maximises the likelihood L(theta) = theta^7 (1-theta)^3. We maximise the log-likelihood 7 log theta + 3 log(1-theta) instead: the log turns the product into a sum, is easier to differentiate, has the same maximiser because log is increasing, and avoids numerical underflow. Setting the derivative 7/theta - 3/(1-theta) to zero gives theta = 7/10 = 0.7, the relative frequency. A weakness: with little data the estimate can be extreme, for example 0 heads in 5 tosses gives theta = 0, claiming tails is certain; a prior and MAP estimation (or smoothing) corrects this.",
                     "MLE chooses the parameter theta that makes the observed data most probable, i.e. it maximises the likelihood L(theta) = theta^7 (1-theta)^3. We maximise the log-likelihood 7 log theta + 3 log(1-theta) instead: the log turns the product into a sum, is easier to differentiate, has the same maximiser because log is increasing, and avoids numerical underflow. Setting the derivative 7/theta - 3/(1-theta) to zero gives theta = 7/10 = 0.7, the relative frequency. A weakness: with little data the estimate can be extreme, for example 0 heads in 5 tosses gives theta = 0, claiming tails is certain; a prior and MAP estimation (or smoothing) corrects this."),
                   T('Four marks: what is maximised, why log, the answer, a weakness.', '四分：最大化什么、为什么取对数、答案、弱点。')),
            read('remember2', T('What to remember', '要记住的'),
                 table([T('Topic', '话题'), T('The point', '要点')],
                       [T('Conditional', '条件概率'), T('$P(A\\mid B) = P(A,B)/P(B)$; not symmetric', '$P(A\\mid B) = P(A,B)/P(B)$；不对称')],
                       [T('Product, chain', '乘法、链式'), T('$P(A,B) = P(A\\mid B)P(B)$; $P(A_1..A_n) = \\prod_i P(A_i\\mid A_{<i})$, any order, no assumption', '$P(A,B) = P(A\\mid B)P(B)$；$P(A_1..A_n) = \\prod_i P(A_i\\mid A_{<i})$，任意顺序，无需假设')],
                       [T('Marginal', '边缘'), T('$P(A) = \\sum_b P(A,b) = \\sum_b P(A\\mid b)P(b)$', '$P(A) = \\sum_b P(A,b) = \\sum_b P(A\\mid b)P(b)$')],
                       [T('Independence', '独立'), T('$P(A,B) = P(A)P(B)$; conditional: given $C$; neither implies the other; disjoint $\\ne$ independent', '$P(A,B) = P(A)P(B)$；条件独立：给定 $C$；互不蕴含；互斥 $\\ne$ 独立')],
                       [T("Bayes", '贝叶斯'), T('posterior = likelihood $\\times$ prior / evidence; beware the base rate', '后验 = 似然 $\\times$ 先验 / 证据；当心基础概率')],
                       [T('Distributions', '分布'), T('Bernoulli $p^x(1-p)^{1-x}$; binomial $\\binom{N}{x}p^x(1-p)^{N-x}$; multinomial $\\frac{N!}{\\prod x_k!}\\prod p_k^{x_k}$; Gaussian $\\mu,\\sigma$', '伯努利 $p^x(1-p)^{1-x}$；二项 $\\binom{N}{x}p^x(1-p)^{N-x}$；多项 $\\frac{N!}{\\prod x_k!}\\prod p_k^{x_k}$；高斯 $\\mu,\\sigma$')],
                       [T('Expectation', '期望'), T('$\\sum x P(x)$; linear; Bernoulli $p$, binomial $Np$', '$\\sum x P(x)$；线性；伯努利 $p$，二项 $Np$')],
                       [T('MLE', 'MLE'), T('maximise $\\log L$; Bernoulli $k/N$; categorical $n_k/N$ (Lagrange); fails with little data', '最大化 $\\log L$；伯努利 $k/N$；类别 $n_k/N$（拉格朗日）；数据少时不可靠')],
                       [T('MAP', 'MAP'), T('posterior $\\propto$ prior $\\times$ likelihood; prior = pseudo-counts', '后验 $\\propto$ 先验 $\\times$ 似然；先验 = 伪计数')],
                       [T('Entropy', '熵'), T('$-\\sum P\\log_2 P$ = expected surprise; max $\\log_2 K$ for uniform; 0 if certain', '$-\\sum P\\log_2 P$ = 期望的惊讶；均匀时最大 $\\log_2 K$；确定时为 0')])),
        ])


LESSONS = [L_concepts, L_probability]
