# COMP90049: the first lesson (the exam and the map of the subject) and the last (method sheet and drill).
# Every number in the drill is computed here, never typed in by hand.
import math
import os
import sys

sys.path.insert(0, os.path.dirname(__file__))
from ml_kit import *  # noqa: E402,F403

S1, S2 = 'start.exam', 'start.map'
D_A, D_B, D_C = 'drill.short', 'drill.method', 'drill.design'


ZH_KP = {
    'a1': ['生成式建模 P(x, y)（或 P(x | y) 与 P(y)）；判别式直接建模 P(y | x) 或边界',
           '生成式能生成新样本，但需要更多数据、分类效果常常较弱',
           '判别式专注预测，通常更准，但不能生成数据',
           '例子：朴素贝叶斯（生成式）；逻辑回归、SVM、决策树（判别式）'],
    'a2': ['假设：给定类别时，特征条件独立',
           '于是 P(x1..xn | c) 分解为 P(xi | c) 的乘积',
           '好处：参数少（每个特征一张小表），用计数就能估计，不必估计所有特征的联合分布',
           '叫“朴素”，是因为特征往往相关（如词），但它常常仍然分得不错'],
    'a3': ['P(词 | 垃圾) = 0 会让整个乘积、也就是 P(垃圾 | x) 变成 0，不论其他词怎么说',
           '拉普拉斯给每个计数加伪计数 alpha：(count + alpha) / (n_c + alpha V)，没有概率为 0',
           '代价：引入偏差（不再是极大似然估计）；好处：方差更低'],
    'a4': ['Bagging：并行、在自助采样上训练相互独立的分类器；Boosting：串行，每个重点关注前一个分错的样本（重新加权）',
           'Bagging：等权投票或平均；Boosting：按分类器准确度（alpha）加权投票',
           'Bagging 主要降低方差；boosting 主要降低偏差',
           'Boosting 更容易过拟合（噪声标签），也不能并行'],
    'a5': ['一次切分的估计带噪声，取决于哪些样本落在测试集；k 折对 k 次切分取平均，方差更小',
           '每个样本测试一次、训练 k-1 次：数据利用充分',
           '分层：每折保持类别比例，稀有类出现在每一折里，估计更稳定'],
    'a6': ['这条规则需要每个单元的真实目标：theta <- theta + eta y x 只在 y 已知处有效',
           'MLP 的隐藏单元没有已知目标，只有输出层有 y',
           '改用反向传播：用链式法则把输出误差传回每个权重，再做梯度下降（激活函数需可导）'],
    'a7': ['Filter：用与分类器无关的统计量给特征打分（如 MI、PMI），便宜',
           'Filter 的缺点：不考虑分类器，也不考虑特征间的相互作用和冗余',
           'Wrapper：训练并评估分类器来搜索特征子集（如顺序前向选择、后向消除）',
           'Wrapper 的缺点：开销大（要拟合很多次模型），选择可能对验证数据过拟合'],
    'a8': ['k-means 只收敛到 WCSS 的局部最小值，取决于初始中心',
           '多次重启，保留 WCSS 最低的解'],
    'a9': ['各组的真正例率相等：对所有 a，P(yhat=1 | y=1, A=a) 相同',
           '各组的假正例率也相等：对所有 a，P(yhat=1 | y=0, A=a) 相同',
           'Equal opportunity 只要求第一条（真正例中的 TPR 相等）；equalised odds 是两条都要，条件更强'],
    'c1': ['把问题说清：二分类、严重不均衡（2%）、正例极少（6 个）、特征数相对正例很多，所以高方差模型会过拟合',
           '选低方差的简单模型（如正则化逻辑回归或朴素贝叶斯）加特征选择，理由是正例太少；可用半监督或主动学习利用 20,000 条无标签记录，并说明注意事项',
           '评估：分层交叉验证（每折都要有正例）；用患病类的 precision、recall、F1 或 PR 曲线，不用准确率（全猜健康就有 98%）',
           '指出风险并给对策：如特征选择放在每一折内部以避免泄漏；自训练会强化自己的错误（确认偏差）；阈值按漏诊的代价来定',
           '与基线（多数类）比较，并说明哪种错误更要紧（漏诊）'],
    'c2': ['诊断：高方差 / 过拟合（训练误差低，与验证误差差距大）；未剪枝的树在拟合噪声',
           '改动 1、2，各说理由：降低复杂度（限制最大深度或剪枝）、减少特征（按 MI/信息增益过滤）、或增加数据（差距随数据增多缓慢收窄）',
           '改动 3：bagging / 随机森林对许多棵树取平均，降低方差（boosting 针对偏差，所以不是首选）',
           '预期效果：训练误差略升，验证误差下降，差距缩小；用交叉验证评估',
           '如果两个误差都约 25% 且接近：高偏差 / 欠拟合；对策反过来（更复杂的模型、更多特征、boosting）'],
}
_text_q = text_q


def text_q(id, title, skill, prompt, key_points, model_answer, explain):
    """Key points in both languages; the model answer in English in both (the exam is written in English)."""
    kp = [T(a, b) for a, b in zip(key_points, ZH_KP[id])]
    return _text_q(id, title, skill, prompt, kp, T(model_answer, model_answer + '\n\n（考试用英文作答，以上是一份英文参考答案。）'), explain)


def F(s, **kw):
    """Fill <<name>> in a string with a value."""
    for k, v in kw.items():
        s = s.replace(f'<<{k}>>', str(v))
    return s


def TF(en, zh, **kw):
    return T(F(en, **kw), F(zh, **kw))


def H(*ps):
    return -sum(p * math.log2(p) for p in ps if p > 0)


def r(x, n=3):
    return f'{x:.{n}f}'


# ================================================================ lesson 1: start
def taxonomy_fig(lang):
    f = Fig(900, 500, lang)
    L = f.L
    rows = [
        (('Probabilistic', '概率型'), ('how likely?', '有多大可能？'), 'NB, LR',
         ('Geometric', '几何型'), ('where in space?', '在空间的哪里？'), 'k-NN, SVM, perceptron'),
        (('Discriminative', '判别式'), ('models P(y | x), the boundary', '直接建模 P(y | x)'), 'LR, SVM, trees, MLP',
         ('Generative', '生成式'), ('models P(x, y), what each class looks like', '建模 P(x, y)，各类长什么样'), 'NB'),
        (('Linear', '线性'), ('boundary is linear in x', '边界是 x 的线性函数'), 'NB, LR, perceptron, linear SVM',
         ('Non-linear', '非线性'), ('boundary is not linear in x', '边界不是 x 的线性函数'), 'k-NN, trees, MLP, kernel SVM'),
        (('Parametric', '参数式'), ('parameters fixed in number', '参数个数固定'), 'NB, LR, MLP',
         ('Non-parametric', '非参数式'), ('parameters grow with the data', '参数随数据增长'), 'k-NN, trees, SVM'),
    ]
    for i, (a, ah, am, b, bh, bm) in enumerate(rows):
        y = 12 + i * 122
        for x, (t, hint, models), col in ((12, (a, ah, am), BLUE), (462, (b, bh, bm), ORANGE)):
            f.rect(x, y, 426, 108, fill=SOFT, stroke=col, sw=2, rx=10)
            f.text(x + 16, y + 30, L(*t), 21, col, weight='bold')
            f.text(x + 16, y + 57, L(*hint), 15, MUTED)
            f.text(x + 16, y + 90, models, 18, INK, weight='bold')
    return f.svg()


def L_start():
    # the facts of lecture 23, as numbers
    per_mark = 120 / 100
    return dict(
        id=lid('start'), title=T('Start here: the exam and the map of the subject', '从这里开始：考试与整门课的地图'),
        description=T('What the exam asks and how to spend your time, the three ingredients of machine learning, every model placed on four axes, and how the course is laid out.',
                      '考试怎么考、时间怎么分，机器学习的三个要素，每个模型在四条轴上的位置，以及这门课怎么排。'),
        minutes=12,
        skills=[{'id': S1, 'name': T('The exam: format and strategy', '考试：形式与策略')},
                {'id': S2, 'name': T('The model map: four axes, every model placed', '模型地图：四条轴，每个模型的位置')}],
        misconceptions=[{'id': 'formulas-all-given', 'description': T('Believing every formula is printed beside the question (probability rules are not)', '以为所有公式都会印在题旁（概率公式不会）')},
                        {'id': 'nb-not-linear', 'description': T('Thinking naive Bayes has a non-linear boundary because it multiplies probabilities', '因为朴素贝叶斯要把概率相乘，就以为它的边界是非线性的')}],
        steps=[
            read('exam', T('The exam in one page', '一页看懂考试'),
                 p(T(r"You know the methods; the exam asks for them in a particular way. Lecture 23 gives the format: **2 hours plus 15 minutes of reading time**, closed book, pen and paper, any **non-programmable calculator**. It is **100 marks, 50% of your grade**, you attempt every question, and the questions carry different weights.",
                     r"方法你已经学过，考试有它自己的问法。第 23 讲给出的形式：**2 小时，外加 15 分钟阅读时间**，闭卷，纸笔作答，可以带**不可编程的计算器**。**满分 100，占总成绩 50%**，每题都要做，各题分值不同。")),
                 table([T('Section', '部分'), T('What it asks', '问什么'), T('How you answer', '怎么答')],
                       [T('**A** short answers', '**A** 简答'), T('Explain or compare ideas of the subject; sometimes a small calculation', '解释或比较概念；有时带一点小计算'), T('1-3 handwritten lines', '手写 1-3 行')],
                       [T('**B** methods', '**B** 方法题'), T('Like the workshops: run a method on a small example', '像 workshop：在小例子上把方法算一遍'), T('show the working; sometimes describe the logic in words', '写出计算过程；偶尔用文字描述思路')],
                       [T('**C** design and application', '**C** 设计与应用'), T('Like the assignments: choose and justify methods for a described problem', '像作业：为一个描述出来的问题选方法并说明理由'), T('one third of a page or more; attempt last', '至少三分之一页；留到最后做')]),
                 p(T(F(r"The time works out to about <<m>> minutes per mark (120 minutes for 100 marks), so a 4-mark short answer deserves about 5 minutes and a Section C answer worth 15 marks about 18. Do not spend 10 minutes on a 3-mark calculation.", m=r(per_mark, 1)),
                     F(r"时间算下来大约每分 <<m>> 分钟（100 分 120 分钟）：4 分的简答配 5 分钟左右，15 分的 C 题配 18 分钟左右。别在一道 3 分的计算上花 10 分钟。", m=r(per_mark, 1)))),
                 chapter=T('The exam', '考试')),
            read('formulas', T('What is printed, what you must know', '题旁印什么，你得自己会什么'),
                 p(T(r"The formula a question needs is **printed beside it**, with one exception: **probability**. So you will not be given Bayes' rule, the definition of conditional probability, the chain rule or the rule for independence. They are the few things to memorise exactly.",
                     r"一道题要用的公式会**印在题旁**，唯一的例外是**概率**：贝叶斯公式、条件概率的定义、链式法则、独立性的写法，都不会给你。这是少数必须背熟的东西。")),
                 math_(r"P(A \mid B) = \frac{P(A, B)}{P(B)}, \qquad P(A \mid B) = \frac{P(B \mid A)\,P(A)}{P(B)}, \qquad P(A, B) = P(A)P(B) \;\; (A \perp B)"),
                 p(T(r"What is tested is then **understanding a formula** (what each term does, what changes if you change it) and **using it** (plugging in numbers correctly). A printed formula does not say which one to use, so knowing the methods still matters.",
                     r"考的是两件事：**读懂公式**（每一项起什么作用，改动它会怎样）和**用它**（把数代对）。印出来的公式不会告诉你该用哪一个，所以方法本身还是要懂。")),
                 quiz(T('Which of these will you have to write from memory?', '下面哪个需要你凭记忆写出来？'),
                      [(T(r"The entropy formula $H = -\sum_x P(x)\log_2 P(x)$", r"熵的公式 $H = -\sum_x P(x)\log_2 P(x)$"), T('It is a formula of the subject, so it is printed next to the question.', '这是本课的公式，会印在题旁。')),
                       (T(r"The AdaBoost classifier weight $\alpha = \tfrac12\ln\frac{1-\varepsilon}{\varepsilon}$", r"AdaBoost 的分类器权重 $\alpha = \tfrac12\ln\frac{1-\varepsilon}{\varepsilon}$"), T('Also printed: only probability formulas are withheld.', '同样会印出来：只有概率公式不给。')),
                       (T(r"Bayes' rule $P(A \mid B) = P(B \mid A)P(A)/P(B)$", r"贝叶斯公式 $P(A \mid B) = P(B \mid A)P(A)/P(B)$"), True),
                       (T(r"The perceptron update $\theta \leftarrow \theta + \eta y \mathbf{x}$", r"感知机更新 $\theta \leftarrow \theta + \eta y \mathbf{x}$"), T('Printed beside the question, like every non-probability formula.', '和所有非概率公式一样，印在题旁。'))],
                      T(r"Probability is the one exception the lecture names. Naive Bayes, smoothing and entropy all rest on it, so these rules are worth knowing cold.", r"第 23 讲点名的唯一例外就是概率。朴素贝叶斯、平滑、熵都建在它上面，这几条要背熟。")),
                 h(T('What the lecturer recommends', '讲师的建议')),
                 ul(T(r"**Practise logs on your calculator.** Entropy and information gain use $\log_2$; know how to get it ($\log_2 x = \ln x/\ln 2$).", r"**在计算器上练对数。** 熵和信息增益用 $\log_2$；要知道怎么按出来（$\log_2 x = \ln x/\ln 2$）。"),
                    T(r"**Do not get stuck in a calculation.** Leave the arithmetic, keep the setup: marks go to method.", r"**不要卡在计算里。** 算不下去就留着，把式子列对：分数给方法。"),
                    T(r"**Do not write irrelevant things.** No points for effort; a wrong extra sentence can cost you.", r"**别写无关的东西。** 不按努力给分；多写一句错的反而可能扣分。"),
                    T(r"**Memorise concepts, test yourself often.** Section A is won by short, exact explanations.", r"**概念要记牢，常常自测。** A 部分靠短而准的解释拿分。"))),
            read('ingredients', T('Three ingredients', '三个要素'),
                 p(T(r"Lecture 23 sums the subject up as three ingredients. Every method you meet is a particular choice for each.", r"第 23 讲把整门课归成三个要素。每个方法都是对这三样的一种具体选择。")),
                 table([T('Ingredient', '要素'), T('What it is', '是什么'), T('The distinctions to know', '要会区分的')],
                       [T('**Data**', '**数据**'), T('What we learn from', '用来学习的东西'),
                        T('discrete vs continuous · big vs small · labelled vs unlabelled · public vs sensitive', '离散 vs 连续 · 大数据 vs 小数据 · 有标签 vs 无标签 · 公开 vs 敏感')],
                       [T('**Models**', '**模型**'), T('A function from inputs to outputs whose parameters are unknown', '从输入到输出的函数，参数未知'),
                        T('probabilistic vs geometric · discriminative vs generative · linear vs non-linear · parametric vs non-parametric', '概率型 vs 几何型 · 判别式 vs 生成式 · 线性 vs 非线性 · 参数式 vs 非参数式')],
                       [T('**Learning**', '**学习**'), T('Finding the best parameters for a given task', '为给定任务找到最好的参数'),
                        T('supervised · unsupervised · semi-supervised and active · self-supervised', '监督 · 无监督 · 半监督与主动学习 · 自监督')]),
                 p(T(r"The rest of this page is about the middle row: the four model distinctions are the most examinable part of the map, and the one place where a wrong answer is easy to give.", r"后面几页讲中间那一行：模型的四组区分最容易考，也最容易答错。")),
                 chapter=T('The map', '地图')),
            read('taxonomy', T('Every model on four axes', '每个模型在四条轴上的位置'),
                 svg(drawn(taxonomy_fig), T('The four axes of the model map with the models on each side: probabilistic (NB, LR) against geometric (k-NN, SVM, perceptron); discriminative (LR, SVM, trees, MLP) against generative (NB); linear (NB, LR, perceptron, linear SVM) against non-linear (k-NN, trees, MLP, kernel SVM); parametric (NB, LR, MLP) against non-parametric (k-NN, trees, SVM).',
                                           '模型地图的四条轴及各自两侧的模型：概率型（NB、LR）对几何型（k-NN、SVM、感知机）；判别式（LR、SVM、决策树、MLP）对生成式（NB）；线性（NB、LR、感知机、线性 SVM）对非线性（k-NN、决策树、MLP、核 SVM）；参数式（NB、LR、MLP）对非参数式（k-NN、决策树、SVM）。')),
                 p(T(r"This is lecture 23's classification, exactly. Each axis asks one question of a model: how it reasons (**how likely** or **where in space**), what it learns (**P(y | x)** or **P(x, y)**), what shape its boundary has, and whether its size is fixed before it sees the data.",
                     r"这就是第 23 讲的分类，原样照录。每条轴问模型一个问题：它怎么推理（**有多大可能**还是**在空间的哪里**），它学什么（**P(y | x)** 还是 **P(x, y)**），边界是什么形状，以及它的大小在见到数据之前是否已经固定。")),
                 quiz(T('Naive Bayes is...', '朴素贝叶斯是……'),
                      [(T('geometric, discriminative, non-linear, non-parametric', '几何型、判别式、非线性、非参数式'), T('That describes k-NN-like models; naive Bayes is the opposite on every axis except one.', '这描述的是类似 k-NN 的模型；朴素贝叶斯几乎每条轴都相反。')),
                       (T('probabilistic, generative, linear, parametric', '概率型、生成式、线性、参数式'), True),
                       (T('probabilistic, discriminative, linear, parametric', '概率型、判别式、线性、参数式'), T('That is logistic regression. Naive Bayes models $P(\\mathbf{x} \\mid c)P(c)$, the joint, so it is generative.', '这是逻辑回归。朴素贝叶斯建模的是 $P(\\mathbf{x} \\mid c)P(c)$，也就是联合分布，所以是生成式。')),
                       (T('probabilistic, generative, non-linear, parametric', '概率型、生成式、非线性、参数式'), T('Multiplying probabilities looks non-linear, but in log space the score is a sum, so the boundary is linear. See the next page.', '概率相乘看着像非线性，但取对数后得分是求和，边界是线性的。见下一页。'))],
                      T(r"Naive Bayes: probabilistic, generative, linear, parametric. The odd one out is *linear*, which the next page explains.", r"朴素贝叶斯：概率型、生成式、线性、参数式。最容易想错的是*线性*，下一页解释。"))),
            read('table', T('The table, and the reasons behind it', '总表，以及背后的理由'),
                 table([T('Model', '模型'), T('Prob. / geom.', '概率 / 几何'), T('Discr. / gen.', '判别 / 生成'), T('Linear?', '线性？'), T('Parametric?', '参数式？')],
                       ['k-NN', T('geometric', '几何'), T('discr. †', '判别 †'), T('non-linear', '非线性'), T('non-param.', '非参数')],
                       [T('Decision tree', '决策树'), '—', T('discr.', '判别'), T('non-linear', '非线性'), T('non-param.', '非参数')],
                       [T('Naive Bayes', '朴素贝叶斯'), T('probabilistic', '概率'), T('generative', '生成'), T('linear', '线性'), T('parametric', '参数')],
                       [T('Linear regression †', '线性回归 †'), '—', T('discr.', '判别'), T('linear', '线性'), T('parametric', '参数')],
                       [T('Logistic regression', '逻辑回归'), T('probabilistic', '概率'), T('discr.', '判别'), T('linear', '线性'), T('parametric', '参数')],
                       [T('Perceptron', '感知机'), T('geometric', '几何'), T('discr. †', '判别 †'), T('linear', '线性'), T('parametric †', '参数 †')],
                       [T('SVM, linear kernel', 'SVM，线性核'), T('geometric', '几何'), T('discr.', '判别'), T('linear', '线性'), T('non-param.', '非参数')],
                       [T('SVM, non-linear kernel', 'SVM，非线性核'), T('geometric', '几何'), T('discr.', '判别'), T('non-linear', '非线性'), T('non-param.', '非参数')],
                       ['MLP', '—', T('discr.', '判别'), T('non-linear', '非线性'), T('parametric', '参数')],
                       [T('Ensembles †', '集成 †'), '—', '—', T('non-linear', '非线性'), T('inherit from the base models', '随基础模型')]),
                 p(T(r"† = lecture 23 does not place this one; the entry is the standard answer. A dash = not placed, because the model fits either side or the choice depends on how it is used.",
                     r"† = 第 23 讲没有给出这一项，填的是通行答案。短横线 = 没有分类：模型两边都说得通，或取决于怎么用。")),
                 h(T('Why each is where it is', '每个为什么在那里')),
                 ul(T(r"**Naive Bayes is linear.** The score is $\log P(c) + \sum_i \log P(x_i \mid c)$: a sum of one term per feature, which is linear in the (indicator) features. The boundary is where two such sums are equal, a linear function of $\mathbf{x}$ again.", r"**朴素贝叶斯是线性的。** 得分是 $\log P(c) + \sum_i \log P(x_i \mid c)$：每个特征一项求和，对（指示）特征是线性的。边界是两个这样的和相等的地方，仍是 $\mathbf{x}$ 的线性函数。"),
                    T(r"**Logistic regression is probabilistic and discriminative.** It models $P(y=1 \mid \mathbf{x};\theta) = \sigma(\theta^\top \mathbf{x})$ directly, and $P(y=0 \mid \mathbf{x}) = 1 - $ that. It never models how $\mathbf{x}$ is distributed.", r"**逻辑回归是概率型、判别式。** 它直接建模 $P(y=1 \mid \mathbf{x};\theta) = \sigma(\theta^\top \mathbf{x})$，而 $P(y=0 \mid \mathbf{x})$ 就是 1 减它。它从不建模 $\mathbf{x}$ 本身怎么分布。"),
                    T(r"**k-NN is non-parametric.** There are no parameters to fit: the model *is* the stored training set, which grows with $N$. $k$ and the distance are hyperparameters you choose.", r"**k-NN 是非参数式。** 没有要拟合的参数：模型*就是*存下来的训练集，随 $N$ 增大。$k$ 和距离函数是你选的超参数。"),
                    T(r"**Decision trees are non-parametric.** The number of splits and leaves is not fixed in advance; it grows with the data. **Max depth** is a hyperparameter that *caps* that growth, in the way $k$ tunes k-NN; it does not turn the tree into a fixed-size parametric model.", r"**决策树是非参数式。** 分裂和叶子的个数不是事先定好的，而是随数据增长。**最大深度**是一个超参数，它*限制*增长，就像 $k$ 调节 k-NN；它并没有把树变成固定大小的参数模型。"),
                    T(r"**SVM is listed as non-parametric.** In its dual form the prediction is a sum over training points, $f(\mathbf{x}) = \sum_i \alpha_i y_i K(\mathbf{x}_i, \mathbf{x}) + b$, and the support vectors typically grow with the data. A *linear* SVM is also linear: the axes are independent, so one model can be linear and non-parametric.", r"**SVM 被列为非参数式。** 在对偶形式里，预测是对训练点求和：$f(\mathbf{x}) = \sum_i \alpha_i y_i K(\mathbf{x}_i, \mathbf{x}) + b$，支持向量一般随数据增多。*线性* SVM 同时也是线性的：四条轴相互独立，一个模型可以既线性又非参数。"),
                    T(r"**The MLP is parametric** (the architecture fixes the number of weights) **and non-linear**, thanks to its activations; without them a stack of layers collapses to one linear map.", r"**MLP 是参数式**（结构决定了权重个数）**且非线性**，靠的是激活函数；没有激活函数，多层会塌成一个线性映射。")),
                 callout('note', T('The lecture warns the terms are ambiguous', '讲义自己说这些词有歧义'),
                         T(r"Several definitions of parametric exist. In the exam, use lecture 23's: *parametric* = a fixed number of parameters whatever the amount of training data; *non-parametric* = the parameters grow with the data.",
                           r"“参数式”有好几种定义。考试里用第 23 讲的：*参数式* = 参数个数固定，与训练数据量无关；*非参数式* = 参数随数据增长。")),
                 details(T('Why naive Bayes is linear: the log-odds', '为什么朴素贝叶斯是线性的：对数几率'),
                         p(T(r"Take binary features $x_i \in \{0, 1\}$ and two classes, with $p_{ic} = P(x_i = 1 \mid c)$. Predict class 1 when the log-odds are positive.", r"取二值特征 $x_i \in \{0, 1\}$ 和两个类，$p_{ic} = P(x_i = 1 \mid c)$。对数几率为正时预测类 1。")),
                         math_(r"\log\frac{P(c_1 \mid \mathbf{x})}{P(c_0 \mid \mathbf{x})} = \log\frac{P(c_1)}{P(c_0)} + \sum_i \Big[ x_i \log\frac{p_{i1}}{p_{i0}} + (1 - x_i)\log\frac{1 - p_{i1}}{1 - p_{i0}} \Big]"),
                         p(T(r"Each bracket is $a_i + w_i x_i$ with $w_i = \log\frac{p_{i1}(1 - p_{i0})}{p_{i0}(1 - p_{i1})}$, so the whole thing is $b + \sum_i w_i x_i$: a linear function of $\mathbf{x}$, the same form as logistic regression's $\theta^\top\mathbf{x}$. The two models fit the weights differently (counting versus gradient descent), which is why NB is generative and LR discriminative even though both are linear.",
                             r"每个方括号都是 $a_i + w_i x_i$，其中 $w_i = \log\frac{p_{i1}(1 - p_{i0})}{p_{i0}(1 - p_{i1})}$，整体就是 $b + \sum_i w_i x_i$：$\mathbf{x}$ 的线性函数，和逻辑回归的 $\theta^\top\mathbf{x}$ 同一个形式。两者求权重的方式不同（数数 vs 梯度下降），所以 NB 是生成式、LR 是判别式，尽管都是线性的。")))),
            read('course', T('How this course goes', '这门课怎么走'),
                 p(T(r"Not the slides' order, but the order the ideas build on each other. Seven units, 22 lessons.", r"不按讲义顺序，而按想法之间的依赖。七个单元，共 22 课。")),
                 table([T('Unit', '单元'), T('Lessons', '课'), T('What goes deep', '深入的地方')],
                       [T('Foundations', '基础'), T('start, concepts, probability', '起点、基本概念、概率'), T('inductive bias; Bayes from the definition; MLE; entropy as expected surprise', '归纳偏置；从定义推贝叶斯；极大似然；熵 = 期望惊讶度')],
                       [T('Classic classifiers', '经典分类器'), T('k-NN, trees, naive Bayes', 'k-NN、决策树、朴素贝叶斯'), T('curse of dimensionality; information gain = mutual information; smoothing as a prior', '维数灾难；信息增益 = 互信息；平滑即先验')],
                       [T('Linear models', '线性模型'), T('linear regression, logistic regression, SVM', '线性回归、逻辑回归、SVM'), T('normal equation; cross-entropy and its gradient; margin, dual and kernels', '正规方程；交叉熵及其梯度；间隔、对偶与核')],
                       [T('Evaluation and features', '评估与特征'), T('evaluation, bias-variance, feature selection', '评估、偏差-方差、特征选择'), T('micro/macro by hand; the decomposition; PMI, MI, wrappers', '手算微平均/宏平均；偏差-方差分解；PMI、MI、wrapper')],
                       [T('Neural networks and ensembles', '神经网络与集成'), T('perceptron, MLP, backpropagation, ensembles', '感知机、MLP、反向传播、集成'), T('update rule as SGD; the delta rule by the chain rule; AdaBoost weights derived', '更新规则即 SGD；用链式法则推 delta 规则；AdaBoost 权重推导')],
                       [T('Beyond supervised learning', '监督学习之外'), T('clustering, semi-supervised and active, self-supervised, anomaly detection, fairness', '聚类、半监督与主动学习、自监督、异常检测、公平性'), T('k-means convergence; query strategies; contrastive loss; LOF; fairness criteria as conditional probabilities', 'k-means 收敛性；查询策略；对比损失；LOF；把公平性准则写成条件概率')],
                       [T('Before the exam', '考前'), T('the drill', '练习'), T('a method sheet; Section A, B and C practice', '方法表；A、B、C 部分练习')]),
                 h(T('Every lesson has the same shape', '每一课的形状都一样')),
                 ol(T(r"**Purpose.** What the method is for, in a picture and a sentence.", r"**目的。** 方法用来干什么，一张图加一句话。"),
                    T(r"**Mechanics.** The formulas, with what each term does.", r"**机制。** 公式，以及每一项起什么作用。"),
                    T(r"**Derivations.** The results the slides only state, done line by line.", r"**推导。** 讲义只给结论的地方，一行一行推出来。"),
                    T(r"**An exam-style calculation.** Small numbers, by hand, the way Section B asks.", r"**一道考试风格的计算。** 小数字，手算，按 B 部分的问法。"),
                    T(r"**Deeper.** The topic the slides gesture at.", r"**深入。** 讲义点到为止的话题。"),
                    T(r"**Traps.** The classic mistakes, as small questions.", r"**陷阱。** 经典错误，做成小问题。"),
                    T(r"**Practice.** Section A and B style questions, sometimes a Section C one.", r"**练习。** A、B 部分风格的题，有时有一道 C。"),
                    T(r"**What to remember.** The comparison you would put on a review sheet.", r"**要记住的。** 你会写在复习小抄上的对比。")),
                 p(T(r"The last lesson collects every calculation family on one sheet and gives you a drill under exam conditions. Go through the lessons in order the first time; use the drill to find what to revisit.", r"最后一课把所有计算类型放在一张表上，再给你一套考试条件下的练习。第一遍按顺序走；用练习来找出该回头看的地方。")),
                 chapter=T('The course', '课程')),
        ],
    )


# ================================================================ lesson 2: drill
# -- numbers
# information gain: 12 instances, 8 yes / 4 no; a binary feature gives (4 yes, 0 no) and (4 yes, 4 no)
H_par = H(8 / 12, 4 / 12)
IG = H_par - (4 / 12) * H(1.0) - (8 / 12) * H(0.5, 0.5)
# gain ratio: IG = 0.30, a three-valued feature with groups 6, 4, 2 of 12
IG2 = 0.30
SI2 = H(6 / 12, 4 / 12, 2 / 12)
GR2 = IG2 / SI2
# naive Bayes (Bernoulli, Laplace alpha=1, V=2): spam 6, ham 4; offer in 5 spam / 1 ham; meeting in 1 spam / 3 ham; x = (offer 1, meeting 0)
n_s, n_h = 6, 4
p_off_s, p_off_h = (5 + 1) / (n_s + 2), (1 + 1) / (n_h + 2)
p_nomeet_s, p_nomeet_h = ((n_s - 1) + 1) / (n_s + 2), ((n_h - 3) + 1) / (n_h + 2)
sc_s = (n_s / 10) * p_off_s * p_nomeet_s
sc_h = (n_h / 10) * p_off_h * p_nomeet_h
NB_POST = sc_s / (sc_s + sc_h)
# k-NN: query (3,3), k=3, inverse distance
KNN_PTS = [((3, 4), 'A'), ((6, 3), 'B'), ((3, 7), 'B'), ((0, 0), 'A'), ((9, 9), 'A')]
q = (3, 3)
dist = sorted((math.dist(q, pt), c, pt) for pt, c in KNN_PTS)[:3]
W = {}
for d, c, _ in dist:
    W[c] = W.get(c, 0) + 1 / d
# logistic regression step
sig = lambda z: 1 / (1 + math.exp(-z))
theta = [-1.0, 2.0, 0.5]
xx = [1.0, 1.0, 2.0]
z_lr = sum(a * b for a, b in zip(theta, xx))
p_lr = sig(z_lr)
eta_lr = 0.5
theta2_new = theta[2] - eta_lr * (p_lr - 0) * xx[2]
# perceptron: theta=(0.5,-1,1), x=(1,2,1), y=+1, eta=0.5
th_p, x_p, y_p, eta_p = [0.5, -1.0, 1.0], [1.0, 2.0, 1.0], 1, 0.5
z_p = sum(a * b for a, b in zip(th_p, x_p))
th_p2 = [a + eta_p * y_p * b for a, b in zip(th_p, x_p)]
z_p2 = sum(a * b for a, b in zip(th_p2, x_p))
nx2 = sum(b * b for b in x_p)
# SVM
w_svm = (6, 8)
width = 2 / math.hypot(*w_svm)
# macro-F1 on a confusion matrix (rows actual)
CM = [[8, 1, 1], [2, 6, 2], [0, 1, 9]]
def prf(cm):
    out = []
    for k in range(len(cm)):
        tp = cm[k][k]
        fp = sum(cm[i][k] for i in range(len(cm))) - tp
        fn = sum(cm[k]) - tp
        pr, rc = tp / (tp + fp), tp / (tp + fn)
        out.append((pr, rc, 2 * pr * rc / (pr + rc)))
    return out
PRF = prf(CM)
MACRO_F1 = sum(x[2] for x in PRF) / 3
ACC = sum(CM[k][k] for k in range(3)) / sum(map(sum, CM))
# PMI
PMI = math.log2((30 / 200) / ((40 / 200) * (50 / 200)))
# k-means 1-D
PTS = [1, 2, 6, 7, 12]
cents = [2, 7]
assign = [min(range(2), key=lambda j: abs(x - cents[j])) for x in PTS]
cl2 = [x for x, a in zip(PTS, assign) if a == 1]
C2 = sum(cl2) / len(cl2)
# AdaBoost
eps = 0.2
alpha = 0.5 * math.log((1 - eps) / eps)
w_ok_raw, w_bad_raw = 0.2 * math.exp(-alpha), 0.2 * math.exp(alpha)
Z = 4 * w_ok_raw + w_bad_raw
W_OK = w_ok_raw / Z
W_BAD = w_bad_raw / Z
# backprop: 1-1-1 network, sigmoid, binary cross-entropy, x=1, w=0.5, v=1, y=1, eta=1
bx, bw, bv, by, beta = 1.0, 0.5, 1.0, 1.0, 1.0
bz1 = bw * bx
ba1 = sig(bz1)
bz2 = bv * ba1
bout = sig(bz2)
bL = -(by * math.log(bout) + (1 - by) * math.log(1 - bout))
bd2 = bout - by
bgv = bd2 * ba1
bd1 = bd2 * bv * ba1 * (1 - ba1)
bgw = bd1 * bx
bw_new, bv_new = bw - beta * bgw, bv - beta * bgv

LOGS = {k: math.log2(k) for k in (3, 5, 6, 7)}


def L_drill():
    return dict(
        id=lid('drill'), title=T('The drill: a method sheet and practice for every section', '练习：方法表，以及 A、B、C 三部分的练习'),
        description=T('Every calculation family on one sheet, then Section A short answers, Section B calculations with fresh numbers and a backpropagation step, and two Section C design questions.',
                      '所有计算类型汇成一张表；然后是 A 部分简答、B 部分换了数的计算（含一步反向传播）、以及两道 C 部分设计题。'),
        minutes=55,
        skills=[{'id': D_A, 'name': T('Section A: explain and compare in a few lines', 'A 部分：几行话解释与比较')},
                {'id': D_B, 'name': T('Section B: the calculations by hand', 'B 部分：手算')},
                {'id': D_C, 'name': T('Section C: design and justify', 'C 部分：设计并说明理由')}],
        misconceptions=[{'id': 'accuracy-on-imbalance', 'description': T('Judging a classifier on imbalanced data by accuracy', '在类别不均衡的数据上用准确率评价分类器')},
                        {'id': 'micro-vs-macro', 'description': T('Confusing micro and macro averaging', '混淆微平均与宏平均')},
                        {'id': 'bagging-boosting', 'description': T('Mixing up what bagging and boosting reduce', '把 bagging 和 boosting 各自降低什么弄反')}],
        steps=[
            read('how', T('How to use this lesson', '怎么用这一课'),
                 p(T(r"Four parts, in the order of the exam: **the method sheet**, then **A** (short answers), **B** (calculations) and **C** (design). Calculations use fresh numbers; the answers are computed, and each question says how to round.",
                     r"四部分，顺序和考试一致：**方法表**，然后 **A**（简答）、**B**（计算）、**C**（设计）。计算题用全新的数；答案都是算出来的，每题注明怎么取整。")),
                 p(T(r"Try each one under time: about 1.2 minutes per mark, so a 2-mark short answer is 2-3 minutes and a calculation worth 6 marks about 7. If a row of the sheet does not make sense, go back to its lesson instead of memorising it.",
                     r"每题限时做：大约每分 1.2 分钟，2 分的简答 2-3 分钟，6 分的计算约 7 分钟。方法表里哪一行看不明白，就回到对应的课，别硬背。")),
                 chapter=T('Method sheet', '方法表')),
            read('sheet1', T('Sheet 1: information and probability', '方法表 1：信息与概率'),
                 table([T('Family', '类型'), T('Formula', '公式'), T('Check you can do', '你可以做的检验')],
                       [T('Entropy, information gain, gain ratio', '熵、信息增益、增益率'),
                        r"$H(S) = -\sum_c p_c \log_2 p_c$ · $\mathrm{IG} = H(S) - \sum_v \frac{n_v}{n} H(S_v)$ · $\mathrm{SI} = -\sum_v \frac{n_v}{n}\log_2\frac{n_v}{n}$ · $\mathrm{GR} = \mathrm{IG}/\mathrm{SI}$",
                        T(r"$0 \le H \le \log_2(\text{classes})$; a pure node has $H = 0$; $0 \le \mathrm{IG} \le H(S)$", r"$0 \le H \le \log_2(\text{类数})$；纯节点 $H = 0$；$0 \le \mathrm{IG} \le H(S)$")],
                       [T('PMI and MI', 'PMI 与 MI'),
                        r"$\mathrm{PMI}(x, y) = \log_2\frac{P(x,y)}{P(x)P(y)}$ · $\mathrm{MI} = \sum_{x,y} P(x,y)\,\mathrm{PMI}(x,y)$",
                        T(r"independent $\Rightarrow$ PMI $= 0$; MI $\ge 0$ always, PMI can be negative", r"独立 $\Rightarrow$ PMI $= 0$；MI 永远 $\ge 0$，PMI 可以为负")],
                       [T('Naive Bayes with smoothing', '带平滑的朴素贝叶斯'),
                        r"$\hat{c} = \arg\max_c P(c)\prod_i P(x_i \mid c)$ · $P(x_i = j \mid c) = \frac{n(x_i = j, c) + \alpha}{n(c) + \alpha V}$",
                        T(r"each smoothed distribution sums to 1 over the $V$ values; compare unnormalised scores, divide by their sum only if asked for a probability; use logs for many features", r"平滑后每个分布在 $V$ 个取值上和为 1；比较未归一化的得分，只有题目要概率时才除以它们的和；特征多时用对数")],
                       [T('Logistic regression: prediction and a gradient step', '逻辑回归：预测与一步梯度'),
                        r"$z = \theta^\top\mathbf{x}$ · $\hat{y} = \sigma(z)$ · $\theta \leftarrow \theta - \eta\,(\hat{y} - y)\,\mathbf{x}$",
                        T(r"$\hat{y} > 0.5 \iff z > 0$; the step moves $\hat{y}$ toward $y$; features with $x_j = 0$ do not change", r"$\hat{y} > 0.5 \iff z > 0$；这一步让 $\hat{y}$ 靠近 $y$；$x_j = 0$ 的特征权重不变")]),
                 callout('note', T('Logs on the calculator', '计算器上的对数'),
                         T(F(r"$\log_2 x = \ln x / \ln 2$. Worth knowing: $\log_2 3 = <<a>>$, $\log_2 5 = <<b>>$, $\log_2 6 = <<c>>$, $\log_2 7 = <<d>>$. Entropies: $H(\tfrac12, \tfrac12) = 1$, $H(\tfrac13, \tfrac23) = <<e>>$, $H(\tfrac14, \tfrac34) = <<f>>$, $H(\tfrac15, \tfrac45) = <<g>>$.",
                              a=r(LOGS[3]), b=r(LOGS[5]), c=r(LOGS[6]), d=r(LOGS[7]), e=r(H(1 / 3, 2 / 3)), f=r(H(1 / 4, 3 / 4)), g=r(H(1 / 5, 4 / 5))),
                           F(r"$\log_2 x = \ln x / \ln 2$。值得记住：$\log_2 3 = <<a>>$，$\log_2 5 = <<b>>$，$\log_2 6 = <<c>>$，$\log_2 7 = <<d>>$。几个熵：$H(\tfrac12, \tfrac12) = 1$，$H(\tfrac13, \tfrac23) = <<e>>$，$H(\tfrac14, \tfrac34) = <<f>>$，$H(\tfrac15, \tfrac45) = <<g>>$。",
                              a=r(LOGS[3]), b=r(LOGS[5]), c=r(LOGS[6]), d=r(LOGS[7]), e=r(H(1 / 3, 2 / 3)), f=r(H(1 / 4, 3 / 4)), g=r(H(1 / 5, 4 / 5)))))),
            read('sheet2', T('Sheet 2: geometry and neural networks', '方法表 2：几何与神经网络'),
                 table([T('Family', '类型'), T('Formula', '公式'), T('Check you can do', '你可以做的检验')],
                       [T('Distances and k-NN voting', '距离与 k-NN 投票'),
                        T(r"Euclidean $\sqrt{\sum_j (a_j - b_j)^2}$ · Manhattan $\sum_j |a_j - b_j|$ · Hamming: number of differing values · weight $w_j = \frac{1}{d_j + \epsilon}$", r"欧氏距离 $\sqrt{\sum_j (a_j - b_j)^2}$ · 曼哈顿距离 $\sum_j |a_j - b_j|$ · 汉明距离：取值不同的个数 · 权重 $w_j = \frac{1}{d_j + \epsilon}$"),
                        T(r"take the $k$ smallest distances; with weights, add $w_j$ per class; scale features first; $k$ odd avoids binary ties", r"取最小的 $k$ 个距离；加权时按类累加 $w_j$；先缩放特征；二分类 $k$ 取奇数可避免平票")],
                       [T('Perceptron update', '感知机更新'),
                        r"$\hat{y} = \mathrm{sign}(\theta^\top\mathbf{x})$ · if $\hat{y} \ne y$: $\theta \leftarrow \theta + \eta\,y\,\mathbf{x}$ (labels $\pm 1$, $x_0 = 1$)",
                        T(r"after the update $y\,\theta^\top\mathbf{x}$ grew by $\eta\lVert\mathbf{x}\rVert^2$; correct points leave $\theta$ alone", r"更新后 $y\,\theta^\top\mathbf{x}$ 增加了 $\eta\lVert\mathbf{x}\rVert^2$；分对的点不改 $\theta$")],
                       [T('SVM margin', 'SVM 间隔'),
                        T(r"constraints $y_i(\mathbf{w}^\top\mathbf{x}_i + b) \ge 1$ · margin width $= 2/\lVert\mathbf{w}\rVert$ · distance of $\mathbf{x}$ to the boundary $= |\mathbf{w}^\top\mathbf{x} + b|/\lVert\mathbf{w}\rVert$", r"约束 $y_i(\mathbf{w}^\top\mathbf{x}_i + b) \ge 1$ · 间隔宽度 $= 2/\lVert\mathbf{w}\rVert$ · $\mathbf{x}$ 到边界的距离 $= |\mathbf{w}^\top\mathbf{x} + b|/\lVert\mathbf{w}\rVert$"),
                        T(r"support vectors have $y_i(\mathbf{w}^\top\mathbf{x}_i + b) = 1$ exactly; a larger $\lVert\mathbf{w}\rVert$ means a narrower margin", r"支持向量恰好满足 $y_i(\mathbf{w}^\top\mathbf{x}_i + b) = 1$；$\lVert\mathbf{w}\rVert$ 越大间隔越窄")],
                       [T('One backpropagation step', '一步反向传播'),
                        T(r"forward $z^{(l)} = W^{(l)}a^{(l-1)}$, $a^{(l)} = g(z^{(l)})$ · output (sigmoid + cross-entropy) $\delta^{(L)} = \hat{y} - y$ · hidden $\delta^{(l)} = \big(W^{(l+1)\top}\delta^{(l+1)}\big)\odot g'(z^{(l)})$ · $\partial L/\partial W^{(l)} = \delta^{(l)}a^{(l-1)\top}$ · $W \leftarrow W - \eta\,\partial L/\partial W$", r"前向 $z^{(l)} = W^{(l)}a^{(l-1)}$，$a^{(l)} = g(z^{(l)})$ · 输出层（sigmoid + 交叉熵）$\delta^{(L)} = \hat{y} - y$ · 隐藏层 $\delta^{(l)} = \big(W^{(l+1)\top}\delta^{(l+1)}\big)\odot g'(z^{(l)})$ · $\partial L/\partial W^{(l)} = \delta^{(l)}a^{(l-1)\top}$ · $W \leftarrow W - \eta\,\partial L/\partial W$"),
                        T(r"sigmoid: $g' = a(1 - a)$; shapes: $\delta^{(l)}$ has one entry per unit of layer $l$; the loss should drop after the step", r"sigmoid：$g' = a(1 - a)$；形状：$\delta^{(l)}$ 在第 $l$ 层每个单元各一项；这一步之后损失应当下降")]),
                 p(T(r"The formulas are printed in the exam. What the sheet adds is the check in the last column: a ten-second test that catches most arithmetic slips.", r"考试里这些公式会印出来。方法表多出来的是最后一列：十秒钟的检验，能抓住大部分算错的地方。"))),
            read('sheet3', T('Sheet 3: evaluation, ensembles, clustering', '方法表 3：评估、集成、聚类'),
                 table([T('Family', '类型'), T('Formula', '公式'), T('Check you can do', '你可以做的检验')],
                       [T('Precision, recall, F1; macro and micro', '精确率、召回率、F1；宏平均与微平均'),
                        T(r"$P = \frac{TP}{TP + FP}$ · $R = \frac{TP}{TP + FN}$ · $F_1 = \frac{2PR}{P + R}$ · macro: average the per-class values · micro: pool $TP, FP, FN$ over classes first", r"$P = \frac{TP}{TP + FP}$ · $R = \frac{TP}{TP + FN}$ · $F_1 = \frac{2PR}{P + R}$ · 宏平均：对各类的值取平均 · 微平均：先把各类的 $TP, FP, FN$ 汇总"),
                        T(r"precision reads a column of the confusion matrix, recall a row; with one label per instance micro-$F_1$ equals accuracy; macro treats classes equally, micro treats instances equally", r"精确率读混淆矩阵的列，召回率读行；每个样本一个标签时，微平均 $F_1$ 等于准确率；宏平均平等对待类别，微平均平等对待样本")],
                       [T('Bias and variance: which remedy', '偏差与方差：用什么药'),
                        T(r"high bias (train and validation error both high): more complex model, add features, boosting · high variance (big gap): simpler model, fewer features, more data, bagging", r"高偏差（训练和验证误差都高）：更复杂的模型、加特征、boosting · 高方差（差距大）：更简单的模型、少特征、更多数据、bagging"),
                        T(r"read the learning curve: the gap between the curves says variance, the height of both says bias", r"读学习曲线：两条线的差距看方差，两条线的高度看偏差")],
                       [T('AdaBoost weights', 'AdaBoost 权重'),
                        r"$\varepsilon = \sum_j w_j[\,h(\mathbf{x}_j) \ne y_j]$ · $\alpha = \tfrac12\ln\frac{1 - \varepsilon}{\varepsilon}$ · $w_j \leftarrow w_j e^{-\alpha y_j h(\mathbf{x}_j)}/Z$",
                        T(r"$\alpha > 0$ iff $\varepsilon < 0.5$; after normalising, the misclassified instances hold total weight exactly $0.5$", r"$\alpha > 0$ 当且仅当 $\varepsilon < 0.5$；归一化之后，分错的样本总权重恰好是 $0.5$")],
                       [T('k-means', 'k-means'),
                        T(r"assign each point to the nearest centroid · $\mu_k \leftarrow$ mean of its points · $\mathrm{WCSS} = \sum_k\sum_{x \in C_k}\lVert x - \mu_k\rVert^2$", r"每个点分给最近的中心 · $\mu_k \leftarrow$ 该簇各点的均值 · $\mathrm{WCSS} = \sum_k\sum_{x \in C_k}\lVert x - \mu_k\rVert^2$"),
                        T(r"WCSS never increases from one step to the next; run from several starts and keep the lowest", r"WCSS 一步一步不会上升；多个初值各跑一遍，留下最低的")],
                       [T('Hierarchical linkage', '层次聚类的连接方式'),
                        T(r"single $= \min d(a, b)$ · complete $= \max d(a, b)$ · average $=$ mean of all pairwise $d(a, b)$, over $a \in A, b \in B$", r"单连接 $= \min d(a, b)$ · 全连接 $= \max d(a, b)$ · 平均连接 $=$ 所有成对 $d(a, b)$ 的均值，$a \in A, b \in B$"),
                        T(r"single $\le$ average $\le$ complete, always; merge the pair with the smallest linkage", r"始终有 单连接 $\le$ 平均 $\le$ 全连接；合并连接距离最小的一对")])),
            # ------------------------------------------------ Section A
            read('a_intro', T('Section A: short answers', 'A 部分：简答'),
                 p(T(r"One to three lines each. A full-mark answer states the difference or the reason, not the textbook around it. Write your own answer first, then compare with the key points.",
                     r"每题一到三行。满分答案只说区别或理由，不抄一段教科书。先自己写，再对照要点。")),
                 chapter=T('Section A', 'A 部分')),
            text_q('a1', T('Generative vs discriminative', '生成式 vs 判别式'), D_A,
                   T('Compare generative and discriminative classifiers. Name one example of each. [3 marks]', '比较生成式与判别式分类器，各举一个例子。[3 分]'),
                   ['Generative models P(x, y) (or P(x | y) and P(y)); discriminative models P(y | x) or the boundary directly', 'Generative can generate new samples and handles a class-conditional story; needs more data / often a worse classifier', 'Discriminative focuses on prediction and is often more accurate; cannot generate data', 'Examples: naive Bayes (generative); logistic regression, SVM, trees (discriminative)'],
                   'A generative classifier models the joint distribution P(x, y), e.g. P(x | y)P(y) as in naive Bayes, so it can generate new samples but needs more data and is often a weaker classifier. A discriminative classifier models P(y | x) or the boundary directly, e.g. logistic regression, which usually predicts better but cannot generate data.',
                   T('Say what each one models, then what that buys or costs. The two examples show you know the difference.', '先说各自建模什么，再说得失。两个例子表明你真懂了区别。')),
            text_q('a2', T('Why "naive"', '为什么叫“朴素”'), D_A,
                   T('Why is naive Bayes called "naive", and what does the assumption make possible? [3 marks]', '朴素贝叶斯为什么叫“朴素”？这个假设使什么成为可能？[3 分]'),
                   ['The assumption: features are conditionally independent given the class', 'So P(x1..xn | c) factorises into a product of P(xi | c)', 'Possible: few parameters (one small table per feature) and counting estimates; avoids estimating the joint over all features', 'Naive because features are usually correlated (e.g. words), yet it often still classifies well'],
                   'It assumes the features are conditionally independent given the class, so P(x1, ..., xn | c) = prod_i P(xi | c). This replaces one huge joint distribution by n small tables that can be estimated by counting, which makes it cheap and workable with little data. It is naive because real features (e.g. words) are usually correlated.',
                   T('The mark is for "conditionally independent given the class" and for what the factorisation buys. Not just "features are independent".', '得分点是“给定类别时条件独立”以及分解带来什么。只写“特征独立”不够。')),
            text_q('a3', T('Smoothing', '平滑'), D_A,
                   T('A word never appears in the spam training emails. What goes wrong in naive Bayes, and how does Laplace smoothing fix it? What does it cost? [3 marks]', '某个词在垃圾邮件训练集里从没出现过。朴素贝叶斯会出什么问题？拉普拉斯平滑怎么修复？代价是什么？[3 分]'),
                   ['P(word | spam) = 0 makes the whole product, hence P(spam | x), zero whatever the other words say', 'Laplace adds a pseudocount alpha to every count: (count + alpha) / (n_c + alpha V), so no probability is zero', 'Cost: bias (no longer the maximum likelihood estimate); gain: lower variance'],
                   'An unseen word gives P(word | spam) = 0, which zeroes the product so the email can never be classified as spam, however spammy the other words. Laplace smoothing adds a pseudocount alpha to each count, P = (count + alpha) / (n_spam + alpha V), so nothing is impossible. It adds some bias (it is no longer the maximum likelihood estimate) but lowers variance.',
                   T('Three beats: the zero kills the product, the pseudocount formula, bias for variance.', '三个要点：零概率毁掉乘积，伪计数公式，用偏差换方差。')),
            text_q('a4', T('Bagging vs boosting', 'Bagging 与 boosting 的对比'), D_A,
                   T('Compare bagging and boosting: how are the base classifiers built, how are they combined, and which error does each mainly reduce? [4 marks]', '比较 bagging 和 boosting：基础分类器怎么构造、怎么合并、各自主要降低哪种误差？[4 分]'),
                   ['Bagging: parallel, independent classifiers on bootstrap samples; Boosting: sequential, each focuses on instances the previous got wrong (reweighting)', 'Bagging: simple (equal) vote or average; Boosting: weighted vote by classifier accuracy (alpha)', 'Bagging mainly reduces variance; boosting mainly reduces bias', 'Boosting is more prone to overfitting (noisy labels) and is not parallelisable'],
                   'Bagging trains independent classifiers in parallel on bootstrap samples and combines them by a simple vote or average, which mainly reduces variance. Boosting trains classifiers sequentially, each concentrating on the instances the previous ones got wrong, and combines them by a vote weighted by each classifier\'s accuracy, which mainly reduces bias; it is more prone to overfitting.',
                   T('Four contrasts in two lines: parallel/sequential, equal/weighted vote, variance/bias, and the overfitting caveat.', '两行里四组对比：并行/串行，等权/加权投票，方差/偏差，再加过拟合这个提醒。')),
            text_q('a5', T('Why cross-validation', '为什么用交叉验证'), D_A,
                   T('Why do we use k-fold cross-validation instead of a single train/test split, and why should the folds be stratified for classification? [3 marks]', '为什么用 k 折交叉验证而不是只切一次训练/测试集？分类时为什么折要分层？[3 分]'),
                   ['A single split gives a noisy estimate that depends on which instances landed in the test set; k-fold averages over k splits, so lower variance', 'Every instance is used for testing once and for training k-1 times: uses the data efficiently', 'Stratified: each fold keeps the class proportions, so rare classes appear in every fold and estimates are stable'],
                   'One split gives an estimate that depends on luck in which instances are held out. k-fold cross-validation tests on every instance once and averages k estimates, so it is less variable and uses the data efficiently. Stratifying keeps the class proportions in every fold, so rare classes are present in each test fold.',
                   T('Name the problem (one lucky split), then the fix (average over k), then stratification.', '先说问题（一次切分靠运气），再说解法（k 次平均），最后说分层。')),
            text_q('a6', T('Perceptron rule and the MLP', '感知机规则与 MLP'), D_A,
                   T('Why can the perceptron learning rule not be used to train a multi-layer perceptron? What is used instead? [3 marks]', '为什么不能用感知机学习规则来训练多层感知机？实际用什么？[3 分]'),
                   ['The rule needs the true target for each unit: theta <- theta + eta y x only works where y is known', 'In an MLP the hidden units have no known target; only the output layer has y', 'Instead: backpropagation applies the chain rule to propagate the output error back to every weight, and gradient descent updates them (needs a differentiable activation)'],
                   'The perceptron rule compares a unit\'s output with its true target, but in an MLP only the output layer has targets; hidden units have none. Backpropagation instead uses the chain rule to send the output error back as error terms delta to every layer, giving the gradient of the loss for each weight, which gradient descent then uses to update them. This needs differentiable activations.',
                   T('The missing piece is the target of the hidden units. Backprop supplies it through the chain rule.', '缺的是隐藏单元的目标。反向传播用链式法则把它补上。')),
            text_q('a7', T('Filter vs wrapper', 'Filter 与 wrapper 的对比'), D_A,
                   T('Contrast filter and wrapper feature selection. Give one example of each and one disadvantage of each. [4 marks]', '对比 filter 与 wrapper 特征选择，各举一例并各说一个缺点。[4 分]'),
                   ['Filter: scores features with a statistic independent of any classifier (e.g. MI, PMI); cheap', 'Filter weakness: ignores the classifier and feature interactions / redundancy', 'Wrapper: searches subsets by training and evaluating the classifier (e.g. sequential forward selection, backward elimination)', 'Wrapper weakness: expensive (many model fits), risk of overfitting the selection to the validation data'],
                   'A filter scores each feature by a statistic that does not involve the classifier, e.g. mutual information with the class; it is cheap but ignores the classifier and interactions between features. A wrapper searches feature subsets by training and evaluating the classifier, e.g. sequential forward selection; it fits the classifier but is expensive and can overfit the validation data.',
                   T('Each side needs: what it uses to score, an example, a weakness. The classic contrast is cost versus fit to the classifier.', '每一边都要：用什么打分、一个例子、一个缺点。经典对比是成本 vs 贴合分类器。')),
            text_q('a8', T('Restarting k-means', 'k-means 为什么要多次初始化'), D_A,
                   T('Why is k-means usually run several times from different initial centroids? [2 marks]', 'k-means 为什么通常要用不同初始中心跑多次？[2 分]'),
                   ['k-means only converges to a local minimum of WCSS, which depends on the initial centroids', 'Run several restarts and keep the solution with the lowest WCSS'],
                   'Each iteration lowers the within-cluster sum of squares, but the objective is not convex, so k-means stops in a local minimum that depends on the starting centroids. Running it several times and keeping the run with the lowest WCSS gives a better clustering.',
                   T('Two ideas only: local optimum, and keep the best of several runs. Two marks, two lines.', '只有两点：局部最优，以及多次取最好。两分，两行。')),
            text_q('a9', T('Equalised odds', '等化的赔率'), D_A,
                   T('State what equalised odds requires of a classifier with respect to a protected attribute, and say how it differs from equal opportunity. [3 marks]', '说明 equalised odds 对分类器关于受保护属性的要求，并说明它和 equal opportunity 的区别。[3 分]'),
                   ['True positive rate is equal across groups: P(yhat=1 | y=1, A=a) the same for all a', 'False positive rate is equal across groups too: P(yhat=1 | y=0, A=a) the same for all a', 'Equal opportunity requires only the first (equal TPR among the truly positive); equalised odds is the stronger condition of both'],
                   'Equalised odds requires the same true positive rate and the same false positive rate in every group, i.e. P(yhat = 1 | y, A = a) does not depend on a for y = 0 and for y = 1. Equal opportunity asks only for equal true positive rates, so equalised odds is the stronger condition.',
                   T('Write the condition as a conditional probability given the true label; that is what separates it from predictive parity (conditioning on the prediction).', '把条件写成“给定真实标签”的条件概率；这正是它和 predictive parity（条件是预测）的区别。')),
            # ------------------------------------------------ Section B
            read('b_intro', T('Section B: the calculations', 'B 部分：计算'),
                 p(T(r"Show the setup, not only the answer; the marks are for the method. Each question below has fresh numbers and says how to round. The explanation shows the working you would write.",
                     r"写出式子，不要只写答案：分数给方法。下面每题数字都是新的，题目说明怎么取整。解析里是你该写的过程。")),
                 chapter=T('Section B', 'B 部分')),
            number('b1', T('Information gain', '信息增益'), D_B,
                   T(r"A node holds 12 instances, 8 positive and 4 negative. A binary feature splits it into a branch with 4 instances (all positive) and a branch with 8 instances (4 positive, 4 negative). Compute the information gain in bits. [4 marks] Answer to 3 decimal places.",
                     r"一个节点有 12 个样本，8 正 4 负。一个二值特征把它分成两个分支：一支 4 个样本（全是正例），另一支 8 个样本（4 正 4 负）。计算信息增益（单位 bit）。[4 分] 保留 3 位小数。"),
                   round(IG, 3),
                   TF(r"$H(\text{parent}) = H(\tfrac23, \tfrac13) = <<h>>$. The pure branch has $H = 0$; the balanced one has $H = 1$. $\mathrm{IG} = <<h>> - \tfrac{4}{12}\cdot 0 - \tfrac{8}{12}\cdot 1 = <<ig>>$.",
                      r"$H(\text{父节点}) = H(\tfrac23, \tfrac13) = <<h>>$。纯分支 $H = 0$，均衡分支 $H = 1$。$\mathrm{IG} = <<h>> - \tfrac{4}{12}\cdot 0 - \tfrac{8}{12}\cdot 1 = <<ig>>$。", h=r(H_par, 4), ig=r(IG)),
                   tolerance=0.002, unit='bit', hints=[T(r"Weight each branch's entropy by its share of the 12 instances.", r"每个分支的熵按它占 12 个样本的比例加权。")], purpose='check'),
            number('b2', T('Gain ratio', '增益率'), D_B,
                   T(r"A three-valued feature splits 12 instances into groups of 6, 4 and 2, and its information gain is 0.30 bits. Compute its gain ratio. [3 marks] Answer to 3 decimal places.",
                     r"一个三值特征把 12 个样本分成 6、4、2 三组，它的信息增益是 0.30 bit。计算它的增益率。[3 分] 保留 3 位小数。"),
                   round(GR2, 3),
                   TF(r"$\mathrm{SI} = -(\tfrac12\log_2\tfrac12 + \tfrac13\log_2\tfrac13 + \tfrac16\log_2\tfrac16) = <<si>>$, so $\mathrm{GR} = 0.30/\mathrm{SI} = <<gr>>$. Splitting into many groups raises SplitInfo, which is how gain ratio punishes it.",
                      r"$\mathrm{SI} = -(\tfrac12\log_2\tfrac12 + \tfrac13\log_2\tfrac13 + \tfrac16\log_2\tfrac16) = <<si>>$，所以 $\mathrm{GR} = 0.30/<<si>> = <<gr>>$。分成的组越多 SplitInfo 越大，增益率就是这样惩罚它的。", si=r(SI2, 4), gr=r(GR2)),
                   tolerance=0.003, purpose='check'),
            number('b3', T('Naive Bayes with Laplace', '带拉普拉斯平滑的朴素贝叶斯'), D_B,
                   T(r"Training set: 10 emails, 6 spam and 4 ham. The word *offer* appears in 5 spam and 1 ham emails; the word *meeting* in 1 spam and 3 ham emails (binary features, absent otherwise). Using naive Bayes with Laplace smoothing ($\alpha = 1$, $V = 2$ for each feature; the priors are the plain proportions), compute $P(\text{spam} \mid \text{offer present, meeting absent})$. [6 marks] Answer to 3 decimal places.",
                     r"训练集 10 封邮件，6 封垃圾、4 封正常。词 *offer* 出现在 5 封垃圾邮件和 1 封正常邮件里；词 *meeting* 出现在 1 封垃圾邮件和 3 封正常邮件里（二值特征）。用带拉普拉斯平滑（每个特征 $\alpha = 1$，$V = 2$；先验用直接的比例）的朴素贝叶斯，计算 $P(\text{垃圾} \mid \text{有 offer、没有 meeting})$。[6 分] 保留 3 位小数。"),
                   round(NB_POST, 3),
                   TF(r"Spam: $P(\text{offer}\mid s) = \frac{5+1}{6+2} = <<a>>$, $P(\text{no meeting}\mid s) = \frac{5+1}{6+2} = <<b>>$, score $= 0.6 \times <<a>> \times <<b>> = <<ss>>$. Ham: $P(\text{offer}\mid h) = \frac{1+1}{4+2} = <<c>>$, $P(\text{no meeting}\mid h) = \frac{1+1}{4+2} = <<d>>$, score $= 0.4 \times <<c>> \times <<d>> = <<sh>>$. Normalise: $<<ss>>/(<<ss>> + <<sh>>) = <<post>>$.",
                      r"垃圾：$P(\text{offer}\mid s) = \frac{5+1}{6+2} = <<a>>$，$P(\text{没 meeting}\mid s) = \frac{5+1}{6+2} = <<b>>$，得分 $= 0.6 \times <<a>> \times <<b>> = <<ss>>$。正常：$P(\text{offer}\mid h) = \frac{1+1}{4+2} = <<c>>$，$P(\text{没 meeting}\mid h) = \frac{1+1}{4+2} = <<d>>$，得分 $= 0.4 \times <<c>> \times <<d>> = <<sh>>$。归一化：$<<ss>>/(<<ss>> + <<sh>>) = <<post>>$。",
                      a=r(p_off_s, 2), b=r(p_nomeet_s, 2), c=r(p_off_h, 4), d=r(p_nomeet_h, 4), ss=r(sc_s, 4), sh=r(sc_h, 4), post=r(NB_POST)),
                   tolerance=0.002, hints=[T(r"For the absent word you need $P(\text{absent} \mid c)$: the count of emails *without* it, plus 1.", r"没出现的词要用 $P(\text{没出现} \mid c)$：*没有*该词的邮件数，加 1。")], purpose='check'),
            number('b4', T('Weighted k-NN', '加权 k-NN'), D_B,
                   T(r"Training points (Euclidean distance): A at (3, 4), B at (6, 3), B at (3, 7), A at (0, 0), A at (9, 9). Classify the query (3, 3) with $k = 3$ and weights $w = 1/d$. What is the total weight of class B among the three neighbours? [4 marks] Answer to 3 decimal places.",
                     r"训练点（欧氏距离）：A 在 (3, 4)，B 在 (6, 3)，B 在 (3, 7)，A 在 (0, 0)，A 在 (9, 9)。对查询点 (3, 3) 取 $k = 3$、权重 $w = 1/d$ 分类。三个近邻里类别 B 的总权重是多少？[4 分] 保留 3 位小数。"),
                   round(W['B'], 3),
                   TF(r"Distances: (3,4) is 1, (6,3) is 3, (3,7) is 4, so these are the three nearest. Class A: $1/1 = <<a>>$. Class B: $1/3 + 1/4 = <<b>>$. Plain majority voting would pick B (2 votes to 1), but weighted voting picks A, because the A point is much closer.",
                      r"距离：(3,4) 是 1，(6,3) 是 3，(3,7) 是 4，所以这三个是最近的。类别 A：$1/1 = <<a>>$。类别 B：$1/3 + 1/4 = <<b>>$。简单多数投票会选 B（2 票对 1 票），加权投票却选 A，因为 A 的那个点近得多。", a=r(W['A'], 1), b=r(W['B'])),
                   tolerance=0.002, purpose='check'),
            number('b5', T('A logistic regression step', '逻辑回归的一步梯度'), D_B,
                   T(r"A logistic regression has $\theta = (\theta_0, \theta_1, \theta_2) = (-1, 2, 0.5)$. For the instance $\mathbf{x} = (1, 1, 2)$ (the first 1 is the bias input) with label $y = 0$, take one gradient descent step on the cross-entropy loss with $\eta = 0.5$. What is the new $\theta_2$? [5 marks] Answer to 3 decimal places.",
                     r"逻辑回归 $\theta = (\theta_0, \theta_1, \theta_2) = (-1, 2, 0.5)$。对样本 $\mathbf{x} = (1, 1, 2)$（第一个 1 是偏置输入），标签 $y = 0$，在交叉熵损失上做一步梯度下降，$\eta = 0.5$。新的 $\theta_2$ 是多少？[5 分] 保留 3 位小数。"),
                   round(theta2_new, 3),
                   TF(r"$z = -1 + 2 + 0.5\cdot 2 = <<z>>$, $\hat{y} = \sigma(<<z>>) = <<p>>$. The gradient for $\theta_2$ is $(\hat{y} - y)x_2 = <<p>> \times 2 = <<g>>$. $\theta_2 \leftarrow 0.5 - 0.5 \times <<g>> = <<n>>$. The model was confidently wrong ($\hat{y} \approx 0.88$, $y = 0$), so the weight on the large feature moves down a lot.",
                      r"$z = -1 + 2 + 0.5\cdot 2 = <<z>>$，$\hat{y} = \sigma(<<z>>) = <<p>>$。$\theta_2$ 的梯度是 $(\hat{y} - y)x_2 = <<p>> \times 2 = <<g>>$。$\theta_2 \leftarrow 0.5 - 0.5 \times <<g>> = <<n>>$。模型错得很自信（$\hat{y} \approx 0.88$，$y = 0$），所以大特征上的权重降得很多。",
                      z=r(z_lr, 0), p=r(p_lr, 4), g=r(p_lr * 2, 4), n=r(theta2_new)),
                   tolerance=0.003, hints=[T(r"First $z = \theta^\top\mathbf{x}$ and $\hat{y} = \sigma(z)$; then $\theta_j \leftarrow \theta_j - \eta(\hat{y} - y)x_j$.", r"先算 $z = \theta^\top\mathbf{x}$ 和 $\hat{y} = \sigma(z)$；再 $\theta_j \leftarrow \theta_j - \eta(\hat{y} - y)x_j$。")], purpose='check'),
            number('b6', T('A perceptron update', '感知机更新'), D_B,
                   T(r"A perceptron has $\theta = (0.5, -1, 1)$ (bias first), labels $\pm 1$, and the instance $\mathbf{x} = (1, 2, 1)$ has $y = +1$. It is misclassified, so update with $\eta = 0.5$. What is $\theta^\top\mathbf{x}$ after the update? [3 marks] Answer to 1 decimal place.",
                     r"感知机 $\theta = (0.5, -1, 1)$（偏置在前），标签取 $\pm 1$，样本 $\mathbf{x} = (1, 2, 1)$ 的 $y = +1$。它被分错了，用 $\eta = 0.5$ 更新。更新后 $\theta^\top\mathbf{x}$ 是多少？[3 分] 保留 1 位小数。"),
                   round(z_p2, 1),
                   TF(r"Before: $\theta^\top\mathbf{x} = 0.5 - 2 + 1 = <<z>>$ (negative, so predicted $-1$, wrong). Update: $\theta \leftarrow \theta + 0.5 \cdot (+1)\cdot\mathbf{x} = (<<t0>>, <<t1>>, <<t2>>)$. After: $<<t0>> + 2\cdot <<t1>> + <<t2>> = <<z2>>$. Check: it grew by $\eta\lVert\mathbf{x}\rVert^2 = 0.5 \times <<n>> = <<d>>$, from $<<z>>$ to $<<z2>>$.",
                      r"更新前：$\theta^\top\mathbf{x} = 0.5 - 2 + 1 = <<z>>$（为负，预测 $-1$，错）。更新：$\theta \leftarrow \theta + 0.5 \cdot (+1)\cdot\mathbf{x} = (<<t0>>, <<t1>>, <<t2>>)$。更新后：$<<t0>> + 2\cdot <<t1>> + <<t2>> = <<z2>>$。检验：它增加了 $\eta\lVert\mathbf{x}\rVert^2 = 0.5 \times <<n>> = <<d>>$，从 $<<z>>$ 到 $<<z2>>$。",
                      z=r(z_p, 1), t0=r(th_p2[0], 2), t1=r(th_p2[1], 2), t2=r(th_p2[2], 2), z2=r(z_p2, 1), n=int(nx2), d=r(eta_p * nx2, 1)),
                   tolerance=0.05, purpose='check'),
            number('b7', T('SVM margin', 'SVM 间隔'), D_B,
                   T(r"A linear SVM has $\mathbf{w} = (6, 8)$ and $b = -5$. What is the width of the margin, the distance between the hyperplanes $\mathbf{w}^\top\mathbf{x} + b = \pm 1$? [2 marks] Answer to 2 decimal places.",
                     r"一个线性 SVM 的 $\mathbf{w} = (6, 8)$，$b = -5$。间隔的宽度，也就是超平面 $\mathbf{w}^\top\mathbf{x} + b = \pm 1$ 之间的距离，是多少？[2 分] 保留 2 位小数。"),
                   round(width, 2),
                   TF(r"$\lVert\mathbf{w}\rVert = \sqrt{36 + 64} = 10$, so the width is $2/\lVert\mathbf{w}\rVert = <<w>>$. ($b$ moves the boundary but does not change the width.) The point $(1, 1)$ gives $\mathbf{w}^\top\mathbf{x} + b = 9 \ge 1$: it is far outside the margin, at distance $9/10 = 0.9$ from the boundary.",
                      r"$\lVert\mathbf{w}\rVert = \sqrt{36 + 64} = 10$，所以宽度是 $2/\lVert\mathbf{w}\rVert = <<w>>$。（$b$ 平移边界，不改变宽度。）点 $(1, 1)$ 的 $\mathbf{w}^\top\mathbf{x} + b = 9 \ge 1$：远在间隔之外，到边界的距离是 $9/10 = 0.9$。", w=r(width, 2)),
                   tolerance=0.005, purpose='check'),
            number('b8', T('Macro-F1', '宏平均 F1'), D_B,
                   T(r"A 3-class classifier has this confusion matrix (rows = actual class, columns = predicted), classes X, Y, Z: X = (8, 1, 1), Y = (2, 6, 2), Z = (0, 1, 9). Compute the macro-averaged $F_1$ (average the three per-class $F_1$ values). [5 marks] Answer to 3 decimal places.",
                     r"一个三分类器的混淆矩阵（行 = 真实类别，列 = 预测类别），类别 X、Y、Z：X = (8, 1, 1)，Y = (2, 6, 2)，Z = (0, 1, 9)。计算宏平均 $F_1$（三个类别的 $F_1$ 取平均）。[5 分] 保留 3 位小数。"),
                   round(MACRO_F1, 3),
                   TF(r"Per class (precision from the column, recall from the row): X: $P = 8/10 = <<px>>$, $R = 8/10 = <<rx>>$, $F_1 = <<fx>>$. Y: $P = 6/8 = <<py>>$, $R = 6/10 = <<ry>>$, $F_1 = <<fy>>$. Z: $P = 9/12 = <<pz>>$, $R = 9/10 = <<rz>>$, $F_1 = <<fz>>$. Macro-$F_1 = (<<fx>> + <<fy>> + <<fz>>)/3 = <<m>>$. (Micro-$F_1$ would be the accuracy $23/30 = <<acc>>$.)",
                      r"逐类（精确率看列，召回率看行）：X：$P = 8/10 = <<px>>$，$R = 8/10 = <<rx>>$，$F_1 = <<fx>>$。Y：$P = 6/8 = <<py>>$，$R = 6/10 = <<ry>>$，$F_1 = <<fy>>$。Z：$P = 9/12 = <<pz>>$，$R = 9/10 = <<rz>>$，$F_1 = <<fz>>$。宏平均 $F_1 = (<<fx>> + <<fy>> + <<fz>>)/3 = <<m>>$。（微平均 $F_1$ 就是准确率 $23/30 = <<acc>>$。）",
                      px=r(PRF[0][0], 2), rx=r(PRF[0][1], 2), fx=r(PRF[0][2], 3), py=r(PRF[1][0], 3), ry=r(PRF[1][1], 2), fy=r(PRF[1][2], 3),
                      pz=r(PRF[2][0], 2), rz=r(PRF[2][1], 2), fz=r(PRF[2][2], 3), m=r(MACRO_F1), acc=r(ACC)),
                   tolerance=0.003, purpose='check'),
            number('b9', T('PMI', 'PMI'), D_B,
                   T(r"Among 200 documents, the word *goal* occurs in 40, the class *sport* has 50 documents, and 30 documents are both. Compute $\mathrm{PMI}(\textit{goal}, \textit{sport})$ in bits. [3 marks] Answer to 2 decimal places.",
                     r"200 篇文档中，词 *goal* 出现在 40 篇里，类别 *sport* 有 50 篇，两者同时成立的有 30 篇。计算 $\mathrm{PMI}(\textit{goal}, \textit{sport})$（单位 bit）。[3 分] 保留 2 位小数。"),
                   round(PMI, 2),
                   TF(r"$P(\text{goal}, \text{sport}) = 30/200 = 0.15$, $P(\text{goal}) = 0.2$, $P(\text{sport}) = 0.25$. $\mathrm{PMI} = \log_2\frac{0.15}{0.2 \times 0.25} = \log_2 3 = <<v>>$. Positive: the word occurs with the class three times as often as chance (independence would give 0).",
                      r"$P(\text{goal}, \text{sport}) = 30/200 = 0.15$，$P(\text{goal}) = 0.2$，$P(\text{sport}) = 0.25$。$\mathrm{PMI} = \log_2\frac{0.15}{0.2 \times 0.25} = \log_2 3 = <<v>>$。为正：这个词和该类同时出现的频率是随机情形的三倍（独立时为 0）。", v=r(PMI, 3)),
                   tolerance=0.01, unit='bit', purpose='check'),
            number('b10', T('A k-means step', 'k-means 的一步'), D_B,
                   T(r"One-dimensional data 1, 2, 6, 7, 12 and $k = 2$ with initial centroids 2 and 7. Assign each point to its nearest centroid and recompute. What is the new position of the second centroid (the one that started at 7)? [3 marks] Answer to 2 decimal places.",
                     r"一维数据 1, 2, 6, 7, 12，$k = 2$，初始中心 2 和 7。把每个点分给最近的中心，再重新计算。第二个中心（原来在 7 的那个）的新位置是多少？[3 分] 保留 2 位小数。"),
                   round(C2, 2),
                   TF(r"Distances: 1 and 2 are nearest to centroid 2; 6 (distance 4 vs 1), 7 and 12 are nearest to centroid 7. New second centroid $= (6 + 7 + 12)/3 = <<c>>$; the first becomes $(1 + 2)/2 = 1.5$. The next assignment would stay the same, so k-means stops.",
                      r"距离：1 和 2 离中心 2 最近；6（距离 4 对 1）、7、12 离中心 7 最近。新的第二个中心 $= (6 + 7 + 12)/3 = <<c>>$；第一个变成 $(1 + 2)/2 = 1.5$。下一次分配不会变，k-means 就此停止。", c=r(C2, 2)),
                   tolerance=0.01, purpose='check'),
            number('b11', T('AdaBoost reweighting', 'AdaBoost 重新加权'), D_B,
                   T(r"AdaBoost starts with 5 instances of weight 0.2 each. The first classifier misclassifies exactly one of them. After updating and normalising, what is the weight of each correctly classified instance? [4 marks] Answer to 3 decimal places.",
                     r"AdaBoost 开始时 5 个样本权重各为 0.2。第一个分类器恰好分错其中一个。更新并归一化后，每个分对样本的权重是多少？[4 分] 保留 3 位小数。"),
                   round(W_OK, 3),
                   TF(r"$\varepsilon = 0.2$, so $\alpha = \tfrac12\ln(0.8/0.2) = <<a>>$. Correct: $0.2 e^{-\alpha} = <<o>>$ each (four of them); wrong: $0.2 e^{\alpha} = <<b>>$. The total is $Z = <<z>>$. Normalised: correct $= <<wo>>$ each, wrong $= <<wb>>$. The misclassified instance now carries weight $0.5$, as always after a round.",
                      r"$\varepsilon = 0.2$，所以 $\alpha = \tfrac12\ln(0.8/0.2) = <<a>>$。分对的：每个 $0.2 e^{-\alpha} = <<o>>$（共四个）；分错的：$0.2 e^{\alpha} = <<b>>$。总和 $Z = <<z>>$。归一化后：分对的每个 $= <<wo>>$，分错的 $= <<wb>>$。分错的那个现在占 $0.5$，每一轮之后都是这样。",
                      a=r(alpha), o=r(w_ok_raw, 2), b=r(w_bad_raw, 2), z=r(Z, 2), wo=r(W_OK, 3), wb=r(W_BAD, 3)),
                   tolerance=0.002, purpose='check'),
            derive('b12', T('A full backpropagation step', '完整的一步反向传播'),
                   [
                       (r"z_1 = w\,x = " + r(bz1, 1), T('Forward: the hidden unit sees $x = 1$ through the weight $w = 0.5$.', '前向：隐藏单元通过权重 $w = 0.5$ 看到 $x = 1$。')),
                       (r"a_1 = \sigma(z_1) = " + r(ba1, 4), T('Then the sigmoid squashes it.', '再过 sigmoid。')),
                       (r"z_2 = v\,a_1 = " + r(bz2, 4), T('Forward: the output unit has weight $v = 1$.', '前向：输出单元的权重是 $v = 1$。')),
                       (r"\hat{y} = \sigma(z_2) = " + r(bout, 4), T('The same sigmoid. The label is $y = 1$, so the prediction is too low.', '同样的 sigmoid。标签是 $y = 1$，所以预测偏低。')),
                       (r"L = -\log\hat{y} = " + r(bL, 4), T('Loss: binary cross-entropy with $y = 1$ keeps only the first term.', '损失：二元交叉熵，$y = 1$ 时只剩第一项。')),
                       (r"\delta_2 = \hat{y} - y = " + r(bd2, 4), T('Backward: for a sigmoid output with cross-entropy, the output error term is simply prediction minus target.', '反向：sigmoid 输出加交叉熵时，输出层的误差项就是预测减目标。'),
                        T('The sigmoid derivative $\\hat{y}(1 - \\hat{y})$ cancels with the cross-entropy derivative $-y/\\hat{y} + (1 - y)/(1 - \\hat{y})$.', 'sigmoid 的导数 $\\hat{y}(1 - \\hat{y})$ 和交叉熵的导数 $-y/\\hat{y} + (1 - y)/(1 - \\hat{y})$ 恰好约掉。')),
                       (r"\delta_1 = \delta_2\,v\,a_1(1 - a_1) = " + r(bd1, 4), T('Backward: send $\\delta_2$ back through $v$, then multiply by the sigmoid slope $a_1(1 - a_1)$ of the hidden unit. Write this expression with $d$ for $\\delta_2$, $v$ the weight and $a$ for $a_1$.', '反向：把 $\\delta_2$ 经过 $v$ 送回，再乘隐藏单元的 sigmoid 斜率 $a_1(1 - a_1)$。用 $d$ 表示 $\\delta_2$，$v$ 为权重，$a$ 表示 $a_1$，写出这个表达式。')),
                       (r"\partial L/\partial v = \delta_2\,a_1 = " + r(bgv, 4), T('Gradients: a weight\'s gradient is its unit\'s error term times what came in along that weight.', '梯度：权重的梯度 = 所在单元的误差项 × 沿这个权重进来的值。')),
                       (r"\partial L/\partial w = \delta_1\,x = " + r(bgw, 4), T('The same rule for the hidden weight; its input is $x = 1$.', '隐藏层的权重同一条规则；它的输入是 $x = 1$。')),
                       (r"v \leftarrow " + r(bv_new, 4), T('Update with $\\eta = 1$: both gradients are negative, so both weights rise and $\\hat{y}$ moves toward 1.', '用 $\\eta = 1$ 更新：两个梯度都为负，所以两个权重都上升，$\\hat{y}$ 向 1 靠近。')),
                       (r"w \leftarrow " + r(bw_new, 4), None),
                   ],
                   intro=T(r"A network with one input $x = 1$, one hidden sigmoid unit (weight $w = 0.5$) and one sigmoid output unit (weight $v = 1$), trained with binary cross-entropy on the target $y = 1$. Do one step of backpropagation with $\eta = 1$. [8 marks]",
                           r"一个网络：输入 $x = 1$，一个 sigmoid 隐藏单元（权重 $w = 0.5$），一个 sigmoid 输出单元（权重 $v = 1$），用二元交叉熵训练，目标 $y = 1$。用 $\eta = 1$ 做一步反向传播。[8 分]"),
                   outro=TF(r"With the new weights the output rises from <<a>> to <<b>>, and the loss falls from <<l0>> to <<l1>>. Always do this check: the loss must go down after a small enough step.",
                            r"用新权重，输出从 <<a>> 升到 <<b>>，损失从 <<l0>> 降到 <<l1>>。这个检验每次都要做：步子足够小，损失必然下降。",
                            a=r(bout, 4), b=r(sig(bv_new * sig(bw_new * bx)), 4), l0=r(bL, 4), l1=r(-math.log(sig(bv_new * sig(bw_new * bx))), 4)),
                   blank=(6, 'd*v*a*(1-a)', T(r"Write $\delta_1$ in terms of $d = \delta_2$, $v$ and $a = a_1$.", r"用 $d = \delta_2$、$v$ 和 $a = a_1$ 写出 $\delta_1$。")), skill=D_B),
            # ------------------------------------------------ Section C
            read('c_intro', T('Section C: design and justify', 'C 部分：设计并说明理由'),
                 p(T(r"A third of a page or more. These questions have no single right answer; marks go to a *structure* the marker can follow, and every choice tied to a property of the data or the method.",
                     r"至少三分之一页。这类题没有唯一的标准答案；分数给一个阅卷人跟得上的*结构*，以及每个选择都有数据或方法的某个性质作依据。")),
                 ol(T(r"**Restate the problem in ML terms**: task, data, the constraint that matters (imbalance, few labels, noise, interpretability).", r"**用机器学习的话重述问题**：任务、数据、最要紧的约束（不均衡、标签少、噪声、可解释性）。"),
                    T(r"**Choose a method and say why**, tying each reason to a property: bias/variance, assumptions, cost, interpretability.", r"**选方法并说理由**，每条理由对应一个性质：偏差/方差、假设、成本、可解释性。"),
                    T(r"**Say how you will evaluate**: the metric (and why not accuracy), the strategy (cross-validation, hold-out), the baseline.", r"**说明怎么评估**：指标（以及为什么不用准确率）、策略（交叉验证、留出）、基线。"),
                    T(r"**Name a risk and the remedy**: leakage, overfitting, confirmation bias, fairness.", r"**点出一个风险和对策**：泄漏、过拟合、确认偏差、公平性。")),
                 p(T(r"Do not write everything you know about the topic: write what this problem needs.", r"不要把知道的全写上：只写这个问题需要的。")),
                 chapter=T('Section C', 'C 部分')),
            text_q('c1', T('A rare disease with few labels', '标签很少的罕见病'), D_C,
                   T('A hospital wants to predict a rare disease (about 2% of patients) from 40 laboratory measurements. It has 300 labelled patients (6 with the disease) and 20,000 unlabelled records. Choose and justify a learning approach and an evaluation strategy, and name one risk. [12 marks]',
                     '医院想根据 40 项化验指标预测一种罕见病（约 2% 的病人患病）。手上有 300 个有标签的病人（其中 6 人患病）和 20,000 条无标签记录。选择并论证一种学习方法和评估策略，并指出一个风险。[12 分]'),
                   ['Frames the problem: binary classification, severe class imbalance (2%), very few positives (6), many features relative to positives, so high-variance models overfit', 'Chooses a low-variance, simple model (e.g. regularised logistic regression or naive Bayes) with feature selection; justified by few positives; may add semi-supervised or active learning for the 20,000 unlabelled records, with a caveat', 'Evaluation: stratified cross-validation (every fold needs positives); metrics precision, recall, F1 on the disease class or a precision-recall curve, not accuracy (always predicting healthy gives 98%)', 'Names a risk with a remedy: e.g. select features inside each fold to avoid leakage; self-training can reinforce its own errors (confirmation bias); threshold chosen for the cost of a missed case', 'Compares with a baseline (majority class) and says which error matters more (a missed disease)'],
                   'Problem: binary classification with severe imbalance (2%) and only 6 positives among 300 labelled patients, with 40 features. A flexible model would overfit the 6 positives, so I would use a low-variance model such as L2-regularised logistic regression or naive Bayes, after a filter selection of features (e.g. mutual information with the label) to cut the dimension. The 20,000 unlabelled records could help through self-training or active learning (asking a doctor to label the most uncertain cases), but self-training can reinforce its own mistakes, so I would only add high-confidence labels and check their effect.\nEvaluation: accuracy is useless here (always predicting "healthy" gives 98%). I would report precision, recall and F1 on the disease class, and a precision-recall curve, because missing a patient is the costly error; the decision threshold is chosen for that cost. With so few positives I would use stratified k-fold cross-validation so every fold contains positives, compared with a majority-class baseline.\nRisk: leakage. Feature selection and any scaling must be done inside each training fold, otherwise the estimate is optimistic.',
                   T('A full-mark answer follows the four-part structure: the problem in ML terms, the choice and its reasons, the evaluation with its metric, a risk with its remedy.', '满分答案按四部分结构走：用机器学习的话重述问题、选择及理由、带指标的评估、一个风险及对策。')),
            text_q('c2', T('Reading a learning curve', '读一条学习曲线'), D_C,
                   T('An unpruned decision tree on 300 features has a training error near 2% and a validation error near 25%. As the training set grows from 100 to 5,000 instances the two curves move closer but a large gap remains. Diagnose the problem and propose and justify three changes. How would the curves change if the fixes work, and how would the diagnosis differ if both errors were about 25%? [12 marks]',
                     '一棵没有剪枝的决策树，在 300 个特征上训练误差约 2%，验证误差约 25%。训练集从 100 增加到 5,000 个样本时，两条曲线靠近了一些，但仍有很大差距。诊断问题，并提出并论证三项改动。如果这些改动有效，曲线会怎样变化？如果两个误差都约为 25%，诊断会有什么不同？[12 分]'),
                   ['Diagnosis: high variance / overfitting (low training error, large gap to validation error); an unpruned tree fits noise', 'Fix 1 and 2, each justified: reduce complexity (limit max depth or prune), reduce features (filter by MI/information gain), or add data (the gap is closing slowly with more data)', 'Fix 3: bagging / random forest averages many trees and reduces variance (boosting targets bias, so not the first choice)', 'Expected effect: training error rises slightly, validation error falls, gap narrows; evaluate with cross-validation', 'If both errors were about 25% and close: high bias / underfitting; fixes would go the other way (more complex model, more features, boosting)'],
                   'Diagnosis: the training error is tiny and the validation error is far higher, with a persistent gap, so the model has high variance (overfitting): an unpruned tree can memorise noise in 300 features.\nChanges: (1) Limit the complexity of the tree, by a maximum depth or pruning, which stops it fitting noise. (2) Reduce the number of features, e.g. keep those with the highest information gain / mutual information with the label, since many irrelevant features give the tree more chances to split on noise. (3) Use bagging (a random forest): averaging trees trained on bootstrap samples reduces variance without raising bias much. More data would also help, since the gap was still closing at 5,000 instances, but it is often costly.\nExpected effect: training error goes up a little, validation error goes down, and the two curves get closer. I would check this with cross-validation, choosing the depth by validation error.\nIf both errors were about 25% and close together, the problem would be high bias (underfitting): the model is too simple for the data. The fixes reverse: a more complex model, more informative features, or boosting. More data alone would not help.',
                   T('The structure is diagnosis, then fixes tied to the diagnosis, then the expected effect, then the contrast case. Every fix names the reason it works.', '结构：先诊断，再给与诊断相符的改动，然后是预期效果，最后对比另一种情形。每项改动都说出它为什么有效。')),
        ],
    )


LESSONS = [L_start, L_drill]
