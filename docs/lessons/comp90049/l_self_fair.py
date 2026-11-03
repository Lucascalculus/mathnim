# COMP90049 lessons `self` (deck 20, self-supervised learning) and `fairness` (deck 22, bias and fairness).
# Every number in the worked examples is computed here (see the helpers), never typed by hand.
import math

from ml_kit import *  # noqa: F401,F403


# ---------------------------------------------------------------- small helpers
_read = read
_table = table
_text_q = text_q

KP_ZH = {
    'Self-supervised builds a target (label) from the data itself and trains with a loss, like supervised learning': '自监督：目标（标签）由数据自己造，用损失训练，像监督学习',
    'Unsupervised has no target: it finds structure (clusters, density)': '无监督：没有目标，找结构（簇、密度）',
    'Semi-supervised uses a few human labels together with many unlabelled instances in one training': '半监督：在同一次训练里把少量人工标签和大量无标注样本一起用',
    'Self-supervised pre-trains a representation on unlabelled data, then a few labels are used for the downstream task': '自监督：先在无标注数据上预训练表示，再用少量标签做下游任务',
    'Pretext on the 2M unlabelled images: masked patch reconstruction or contrastive learning with augmentations': '在 200 万无标注图上做前置任务：遮块还原，或带增强的对比学习',
    'Augmentations chosen so that diagnostic information survives (small crops, mild brightness/contrast; not strong colour or flips that change anatomy)': '增强要保住诊断信息（小裁剪、轻微亮度/对比度；不用改变解剖结构的强烈变色或翻转）',
    'Pre-train the encoder, freeze it, train a small classifier head on the 300 labels (linear probe), optionally fine-tune with a small learning rate': '预训练编码器，冻结，用 300 个标签训练小分类头（线性探测），可选再用小学习率微调',
    'Evaluate on a held-out labelled set from other patients / hospitals, compare with training from scratch on the 300 labels': '在其他病人/医院的留出标注集上评估，并与只用 300 个标签从头训练作比较',
    'Risk: shortcut (scanner or text markers learned), augmentation removing the sign, or bias of the data': '风险：走捷径（学到机器或文字标记）、增强抹掉病征、数据偏差',
    'Demographic parity: P(Yhat=1|A) equal across groups, independent of the true label Y': '人口统计均等：各群体 P(Ŷ=1|A) 相等，与真实标签 Y 无关',
    'Equal opportunity: TPR (equivalently FNR) equal across groups, uses Y among truly positive instances': '机会均等：各群体 TPR（等价于 FNR）相等，在真正的正例里用到 Y',
    'Demographic parity suits cases where representation matters; it can grant wrong people in one group': '人口统计均等适合代表性重要的场景；可能在一个群体里批错人',
    'Equal opportunity suits cases where you do not want to miss qualified people; it accepts unfairness already in the labels': '机会均等适合不想漏掉合格者的场景；它接受标签里已有的不公平',
    'Sources: historical bias (past decisions reflect old discrimination) and measurement bias (hiring decision is a proxy for applicant quality); also proxies such as postcode or school': '来源：历史偏差（过去的决定反映旧歧视）和测量偏差（录用决定只是申请人质量的代理）；还有邮编、学校等代理变量',
    'Criterion with reason, e.g. equal opportunity: qualified applicants of each group should be equally likely to be shortlisted (or demographic parity if representation is the goal)': '选一个准则并说明理由，如机会均等：各群体里合格申请人入围的机会应相同（若目标是代表性则选人口统计均等）',
    'Pre-processing: reweigh or resample so A and Y look independent; in-processing: add a fairness constraint or penalty; post-processing: group-specific thresholds': '预处理：重加权或重采样使 A 与 Y 看起来独立；训练中：加公平约束或惩罚；后处理：分群阈值',
    'Mention that removing gender alone does not work because of proxies, and the trade-off with accuracy': '提到只删性别无效（代理变量），以及与准确率的取舍',
}


def text_q(id, title, skill, prompt, key_points, model_answer, explain, chapter=None):
    return _text_q(id, title, skill, prompt, [T(k, KP_ZH[k]) for k in key_points], T(model_answer, model_answer), explain, chapter=chapter)


def table(head, *rows):
    cell = lambda c: c if isinstance(c, (str, dict)) else str(c)  # noqa: E731
    return _table([cell(c) for c in head], *[[cell(c) for c in r] for r in rows])


def read(id, title, *blocks, chapter=None, skill=None):
    """read() that accepts (and ignores) a skill, so the pages can name what they teach."""
    return _read(id, title, *blocks, chapter=chapter)


def S(en, zh, **kw):
    """T() with @name@ placeholders filled in (so numbers are computed, and TeX braces stay untouched)."""
    for k, v in kw.items():
        en = en.replace(f'@{k}@', str(v))
        zh = zh.replace(f'@{k}@', str(v))
    return T(en, zh)


def f(x, n=3):
    s = f'{x:.{n}f}'
    return s.replace('-', '-')


def softmax(u):
    m = max(u)
    e = [math.exp(x - m) for x in u]
    z = sum(e)
    return [x / z for x in e]


def nce(s, tau):
    """InfoNCE for one anchor: s[0] is the positive, the rest negatives. Returns (p, loss, grad wrt s)."""
    p = softmax([x / tau for x in s])
    loss = -math.log(p[0])
    grad = [(p[0] - 1) / tau] + [x / tau for x in p[1:]]
    return p, loss, grad


# ================================================================ LESSON 1: self-supervised learning
SIM = [0.8, 0.5, 0.1, -0.3]
TAUS = [1.0, 0.5, 0.1]
NCE = {t: nce(SIM, t) for t in TAUS}
P5, L5, G5 = NCE[0.5]
E5 = [math.exp(x / 0.5) for x in SIM]
Z5 = sum(E5)
FALSE_NEG = [0.5, 0.9, 0.1, -0.3]   # the "positive" is less similar than a false negative
FN_LOSS = {t: nce(FALSE_NEG, t)[1] for t in (1.0, 0.1)}
PRACT_S = [0.6, 0.4, 0.2, 0.0]
PRACT_L = nce(PRACT_S, 0.5)[1]

# next-token example: the model's probability for the token that really came next
NTP = [('the', 'cat', 0.05), ('the cat', 'sat', 0.2), ('the cat sat', 'on', 0.5), ('the cat sat on', 'the', 0.4), ('the cat sat on the', 'mat', 0.1)]
NTP_SUM = sum(-math.log(p) for _, _, p in NTP)
NTP_MEAN = NTP_SUM / len(NTP)
NTP_PPL = math.exp(NTP_MEAN)

# sparsity of n-grams
V = 50_000
CTX5 = V ** 4

# attention toy example (d = 2)
ATT_Q = (1.0, 0.5)
ATT_K = {'trophy': (2.0, 1.0), 'suitcase': (1.0, 1.0), 'big': (0.0, 1.0)}
ATT_V = {'trophy': 4.0, 'suitcase': 1.0, 'big': 2.0}
ATT_SC = {k: (ATT_Q[0] * v[0] + ATT_Q[1] * v[1]) / math.sqrt(2) for k, v in ATT_K.items()}
ATT_W = dict(zip(ATT_SC, softmax(list(ATT_SC.values()))))
ATT_OUT = sum(ATT_W[k] * ATT_V[k] for k in ATT_W)

# decoding example after "the cat sat on the"
DEC = [('mat', 0.45), ('floor', 0.25), ('sofa', 0.15), ('roof', 0.10), ('moon', 0.05)]
TOPK2 = [q / (DEC[0][1] + DEC[1][1]) for _, q in DEC[:2]]
cum, k_p = 0.0, 0
for _, pr in DEC:
    cum += pr
    k_p += 1
    if cum >= 0.8:
        break
TOPP_SET = DEC[:k_p]
TOPP_NORM = [q / sum(r_ for _, r_ in TOPP_SET) for _, q in TOPP_SET]


def fig_pipeline(lang):
    g = Fig(700, 372, lang)
    L = g.L

    def row(y, title, enc_label, head_label, tgt, enc_fill, head_fill, left):
        g.text(14, y, title, 18, INK, weight='bold')
        y0 = y + 22
        g.rect(14, y0, 120, 80, SOFT, LINE)
        g.text(74, y0 + 36, left[0], 16, INK, 'middle')
        g.text(74, y0 + 58, left[1], 16, MUTED, 'middle')
        g.line(136, y0 + 40, 166, y0 + 40, INK, 2, arrow=True)
        g.rect(168, y0 - 6, 120, 92, enc_fill, BLUE, 2.4)
        g.text(228, y0 + 36, 'Encoder', 18, INK, 'middle', 'bold')
        g.text(228, y0 + 60, enc_label, 15, MUTED, 'middle')
        g.line(290, y0 + 40, 318, y0 + 40, INK, 2, arrow=True)
        g.rect(320, y0 - 14, 36, 108, '#dbe5ff', BLUE, 1.6)
        g.text(338, y0 + 106, L('Representation', '表示'), 14, BLUE, 'middle')
        g.line(358, y0 + 40, 388, y0 + 40, INK, 2, arrow=True)
        g.rect(390, y0 + 4, 112, 72, head_fill, ORANGE if head_fill != '#ffffff' else MUTED, 2.2)
        g.text(446, y0 + 46, head_label, 16, INK, 'middle', 'bold')
        g.line(504, y0 + 40, 534, y0 + 40, INK, 2, arrow=True)
        g.rect(536, y0 + 4, 150, 72, '#ffffff', GREEN, 2)
        g.text(611, y0 + 36, tgt[0], 15, INK, 'middle')
        g.text(611, y0 + 58, tgt[1], 15, INK, 'middle')

    row(24, L('1 · Pretext task: no labels', '1 · 前置任务：不需要标注'), L('trained', '训练'), L('Pretext head', '前置任务头'),
        (L('Target made', '目标由数据'), L('from the data', '自己生成')), '#e9efff', '#fff1e8',
        (L('Many', '大量'), L('unlabelled', '无标注数据')))
    row(212, L('2 · Downstream task: a few labels', '2 · 下游任务：只要少量标注'), L('frozen', '冻结'), L('Small head', '小分类头'),
        (L('Human labels', '人工标注'), L('(few)', '（很少）')), '#eef0f3', '#fff1e8',
        (L('Few', '少量'), L('labelled', '有标注数据')))
    g.line(228, 140, 228, 192, GREEN, 3, arrow=True, dash='6 5')
    g.text(242, 170, L('copy weights', '权重复制过来'), 15, GREEN)
    return g.svg()


def fig_simclr(lang):
    g = Fig(700, 330, lang)
    L = g.L
    g.rect(10, 130, 90, 70, SOFT, LINE)
    g.text(55, 170, L('image x', '图像 x'), 16, INK, 'middle')
    for y, nm in ((50, "t"), (210, "t'")):
        g.line(102, 165, 130, y + 30, INK, 2, arrow=True)
        g.rect(132, y, 100, 62, '#ffffff', INK, 1.6)
        g.text(182, y + 28, L('view', '视图'), 15, MUTED, 'middle')
        g.text(182, y + 50, f'{nm}(x)', 16, INK, 'middle')
        g.line(234, y + 31, 270, y + 31, INK, 2, arrow=True)
        g.rect(272, y, 100, 62, '#e9efff', BLUE, 2.2)
        g.text(322, y + 28, L('encoder', '编码器'), 15, INK, 'middle')
        g.text(322, y + 50, 'f', 17, BLUE, 'middle', 'bold')
        g.line(374, y + 31, 410, y + 31, INK, 2, arrow=True)
        g.rect(412, y, 90, 62, '#fff1e8', ORANGE, 2.2)
        g.text(457, y + 28, L('project', '投影'), 15, INK, 'middle')
        g.text(457, y + 50, 'g', 17, ORANGE, 'middle', 'bold')
        g.line(504, y + 31, 540, y + 31, INK, 2, arrow=True)
    g.circle(560, 81, 20, '#ffffff', GREEN, 3)
    g.text(560, 87, 'z_{i}', 16, INK, 'middle')
    g.circle(560, 241, 20, '#ffffff', GREEN, 3)
    g.text(560, 247, 'z_{j}', 16, INK, 'middle')
    g.line(560, 104, 560, 216, GREEN, 3.5, arrow=True)
    g.line(560, 216, 560, 104, GREEN, 3.5, arrow=True)
    g.text(548, 165, L('pull together', '拉近'), 16, GREEN, 'end')
    g.circle(660, 160, 20, '#ffffff', ORANGE, 3)
    g.text(660, 166, 'z_{k}', 16, INK, 'middle')
    g.line(578, 92, 646, 146, ORANGE, 2.5, dash='6 5', arrow=True)
    g.text(660, 198, L('other', '批内'), 15, ORANGE, 'middle')
    g.text(660, 216, L('images', '其他图像'), 15, ORANGE, 'middle')
    g.text(660, 238, L('push apart', '推远'), 16, ORANGE, 'middle')
    return g.svg()


def fig_tau(lang):
    g = Fig(700, 330, lang)
    L = g.L
    base, hmax = 262, 190
    for pi, t in enumerate(TAUS):
        p = NCE[t][0]
        x0 = 20 + pi * 228
        g.text(x0 + 90, 30, f'τ = {t:g}', 19, INK, 'middle', 'bold')
        for k, (pk, sk) in enumerate(zip(p, SIM)):
            x = x0 + 10 + k * 46
            hh = max(pk * hmax, 1.5)
            g.rect(x, base - hh, 34, hh, BLUE if k == 0 else ORANGE, None, rx=3)
            g.text(x + 17, base - hh - 7, f'{pk:.2f}', 14, INK, 'middle')
            g.text(x + 17, base + 20, f'{sk:g}', 14, MUTED, 'middle')
        g.line(x0, base, x0 + 196, base, INK, 1.6)
    g.rect(190, 296, 14, 14, BLUE, None, rx=2)
    g.text(210, 309, L('positive', '正样本'), 15, INK)
    g.rect(300, 296, 14, 14, ORANGE, None, rx=2)
    g.text(320, 309, L('negatives', '负样本'), 15, INK)
    g.text(430, 309, L('under each bar: cosine similarity', '柱下：余弦相似度'), 15, MUTED)
    return g.svg()


def L_self():
    SK = 'self.setting'
    PR = 'self.pretext'
    CT = 'self.contrastive'
    NC = 'self.infonce'
    TR = 'self.transfer'
    LM = 'self.lm'
    TF = 'self.transformer'
    LL = 'self.llm'
    p1, p2, p3, p4 = NCE[1.0], NCE[0.5], NCE[0.1], None
    share = {t: NCE[t][2][1] / sum(NCE[t][2][1:]) for t in TAUS}
    return dict(
        id=lid('self'),
        title=T('Self-supervised learning: labels from the data itself', '自监督学习：从数据本身造标签'),
        description=T('Why unlabelled data is enough to learn from, pretext tasks, the contrastive (InfoNCE) loss term by term with numbers, why the representations transfer, and how next-token prediction becomes a language model.',
                      '为什么没有标注也能学，前置任务有哪些，对比损失（InfoNCE）逐项拆开并带数字算一遍，表示为什么能迁移，以及“预测下一个词”怎么变成语言模型。'),
        minutes=45,
        skills=[{'id': SK, 'name': T('Learning settings compared', '各种学习设定的区别')},
                {'id': PR, 'name': T('Pretext tasks and the pretrain-then-transfer pipeline', '前置任务与预训练—迁移流程')},
                {'id': CT, 'name': T('Contrastive learning', '对比学习')},
                {'id': NC, 'name': T('The InfoNCE loss and temperature', 'InfoNCE 损失与温度')},
                {'id': TR, 'name': T('Why representations transfer', '表示为什么能迁移')},
                {'id': LM, 'name': T('Next-token prediction and language models', '下一词预测与语言模型')},
                {'id': TF, 'name': T('Transformer: positions, attention, decoding', 'Transformer：位置、注意力、解码')},
                {'id': LL, 'name': T('LLM training: pre-train then fine-tune', '大模型训练：预训练再微调')}],
        misconceptions=[{'id': 'ssl-is-unsup', 'description': T('Treating self-supervised learning as just unsupervised learning (it has a target and a loss; the goal is a reusable representation)', '把自监督当成普通的无监督学习（它有目标和损失，目的是得到可复用的表示）')},
                        {'id': 'ssl-needs-no-labels', 'description': T('Believing no labels are ever needed (the downstream task still needs a few)', '以为从头到尾都不需要标注（下游任务仍要少量标注）')},
                        {'id': 'low-tau-better', 'description': T('Thinking a smaller temperature is always better (it concentrates the push on hard negatives, including false ones)', '以为温度越小越好（它把力集中在难负样本上，包括被误判的负样本）')},
                        {'id': 'lm-supervised', 'description': T('Thinking a language model needs human-written labels for next-token prediction', '以为下一词预测需要人工写的标签')}],
        steps=[
            read('why', T('Why: labels are expensive, raw data is not', '为什么：标注贵，原始数据便宜'),
                 p(T("Supervised learning is limited by labels. A label costs a person's time (a doctor reading a scan, a student marking sentences); raw images and raw text are nearly free. **Self-supervised learning (SSL)** takes the one thing that is abundant and *manufactures* the labels from it: **supervision does not have to come from humans.**",
                     "监督学习被标注卡住：一条标签要花人的时间（医生看片子、学生标句子），而原始图片和文本几乎是免费的。**自监督学习 (self-supervised learning, SSL)** 就是用最充裕的东西——数据本身——去*造*标签：**监督信号不一定要来自人。**")),
                 table([T('Learning', '学习方式'), T('Input', '输入'), T('Target', '目标')],
                       [T('Supervised', '监督'), T('data', '数据'), T('human-provided label', '人给的标签')],
                       [T('Self-supervised', '自监督'), T('data with a part removed or corrupted', '被遮掉/破坏一部分的数据'), T('the missing / original part', '被遮掉的/原来的那部分')]),
                 p(T("Example from the lecture: hide a patch of a cat photo and ask the model to predict it. The label (the patch) came from the image itself, with no annotation. To get it right the model must learn texture, shape and what a cat's eye looks like. *We never told it 'cat'; it works it out because it has to.*",
                     "讲义里的例子：把猫图里的一小块遮掉，让模型把它预测出来。标签（那一小块）来自图片本身，没有任何人工标注。要预测对，模型必须学会纹理、形状、猫眼长什么样。*没人告诉它“这是猫”，是任务逼着它自己弄明白的。*")),
                 chapter=T('The idea', '基本思路')),
            read('settings', T('Where SSL sits among the learning settings', 'SSL 在各种学习设定中的位置'),
                 table([T('Setting', '设定'), T('Data', '数据'), T('Where the learning signal comes from', '学习信号来自'), T('Goal', '目标')],
                       [T('Supervised', '监督'), T('all labelled', '全部有标注'), T('human labels', '人工标签'), T('predict y', '预测 y')],
                       [T('Unsupervised', '无监督'), T('no labels', '无标注'), T('no target; structure in x (clusters, density)', '没有目标，只用 x 的结构（簇、密度）'), T('find structure', '找结构')],
                       [T('Semi-supervised', '半监督'), T('few labelled + many unlabelled, used together', '少量有标注 + 大量无标注，一起用'), T('the few labels, plus assumptions about unlabelled x', '少量标签，加上对无标注 x 的假设'), T('predict y better', '更好地预测 y')],
                       [T('Active', '主动学习'), T('unlabelled pool, labels bought on request', '无标注池，按需买标签'), T('human labels for the chosen few', '为挑出的少数样本人工标注'), T('fewest labels', '用最少标注')],
                       [T('Self-supervised', '自监督'), T('no labels for pre-training; few for the task', '预训练不要标注；任务阶段要少量'), T('a target built from x itself', '由 x 自己造的目标'), T('a reusable representation', '可复用的表示')]),
                 p(T("Two contrasts the exam likes. **Versus unsupervised:** SSL *has* a target and a loss, trained by gradient descent exactly like supervised learning; what is unsupervised is only where the target comes from. And its product is a representation for later use, not the answer to the pretext task. **Versus semi-supervised:** semi-supervised learning mixes labelled and unlabelled data in *one* training (self-training, graph methods); SSL learns on unlabelled data in a *first stage*, then a second stage uses labels.",
                     "考试常问两组对比。**对无监督：** SSL *有*目标、有损失，用梯度下降训练，和监督学习一样；“无监督”的只是目标从哪来。而且它的产出是一个留给后面用的表示，不是前置任务本身的答案。**对半监督：** 半监督把有/无标注数据放在*同一次*训练里（自训练、图方法）；SSL 先在无标注数据上学*第一阶段*，第二阶段才用标签。")),
                 quiz(T("A model is trained to colour in grey-scale photos, using the original colour photos as targets. Which setting is this?", "用原来的彩色照片当目标，训练模型给灰度照片上色。这属于哪种设定？"),
                      [(T('Unsupervised: there are no labels', '无监督：没有标签'), T("There is a target (the original colours) and a loss. Unsupervised methods have no target at all.", '它有目标（原色）和损失；无监督方法根本没有目标。')),
                       (T('Self-supervised: the target is made from the data', '自监督：目标由数据本身造出'), True),
                       (T('Semi-supervised: a few labels guide it', '半监督：有少量标签指导'), T("No human label is used here; semi-supervised learning needs some labelled instances.", '这里没用任何人工标签；半监督需要一部分有标注的样本。'))],
                      T("The colour photo gives both the input (grey version) and the target (the colours). No human labelled anything, yet there is a loss to minimise.", '彩色照片既给出输入（灰度版）又给出目标（颜色）。没有人工标注，却有损失可以最小化。'))),
            read('pipeline', T('Two stages: pretext task, then downstream task', '两个阶段：前置任务，然后下游任务'),
                 svg(drawn(fig_pipeline), T('Stage 1 trains an encoder on unlabelled data with a pretext task; stage 2 freezes it and trains a small head on a few labels.', '第一阶段用前置任务在无标注数据上训练编码器；第二阶段冻结它，只用少量标注训练小分类头。')),
                 p(T("**Pretext task:** the made-up task whose labels come free from the data. Its only purpose is to force the **encoder** (an FNN, a Transformer, ...) to produce a useful **representation**. **Downstream task:** the task we actually care about, with few human labels. The encoder is **frozen** (kept as learned) and only a small fully-connected layer on top is trained. That is far cheaper than training from scratch on many labels: we 'warm-start' from the pretext task.",
                     "**前置任务 (pretext task)：** 标签免费来自数据的“自造任务”。它唯一的作用是逼**编码器**（FNN、Transformer 等）学出有用的**表示 (representation)**。**下游任务 (downstream task)：** 我们真正关心的任务，只有少量人工标签。编码器被**冻结**（保持学到的样子），只训练它上面一个小的全连接层。这比用大量标签从头训练便宜得多：我们从前置任务“热启动”。")),
                 table([T('Transfer mode', '迁移方式'), T('What is trained on the labels', '用标签训练的部分'), T('When', '何时用')],
                       [T('Linear probe (as in the lecture)', '线性探测（讲义里的做法）'), T('only the new small layer; encoder frozen', '只训练新加的小层；编码器冻结'), T('very few labels; also a test of how good the representation is', '标签极少；也是检验表示好坏的方法')],
                       [T('Fine-tuning', '微调'), T('all weights, starting from the pre-trained ones, small learning rate', '所有权重，从预训练值出发，用小学习率'), T('more labels; best accuracy', '标签较多；精度最高')]),
                 skill=PR),
            read('three', T('Three ways to build the labels', '造标签的三种办法'),
                 table([T('Family', '类别'), T('The label is...', '标签是……'), T('How', '做法'), T('Example', '例子')],
                       [T('Masked prediction', '遮挡预测'), T('the missing piece', '被遮掉的部分'), T('hide part of the input, reconstruct it', '遮住输入的一部分，把它还原'), T('missing image patch (lecture); BERT masks words', '缺失的图块（讲义）；BERT 遮词')],
                       [T('Contrastive learning', '对比学习'), T('the relationship: same or different', '关系：相同还是不同'), T('same dog, different photo: pull closer; dog vs cat: push apart', '同一条狗的不同照片：拉近；狗和猫：推远'), T('SimCLR (next page)', 'SimCLR（下一页）')],
                       [T('Autoregressive prediction', '自回归预测'), T('the next word', '下一个词'), T('given all previous tokens, predict the next one', '给定之前所有词，预测下一个'), T('GPT-style language models', 'GPT 类语言模型')]),
                 details(T('More pretext tasks you may meet (textbook, not in the deck)', '其他常见前置任务（教科书内容，讲义没有）'),
                         ul(T("**Rotation prediction:** rotate the image by 0/90/180/270 degrees, classify which; to answer, the model must recognise what is up in a scene.", "**旋转预测：** 把图旋转 0/90/180/270 度，分类是哪一种；要答对就得认出场景里什么是“上”。"),
                            T("**Jigsaw:** cut the image into tiles, shuffle, predict the permutation; requires knowing how parts of an object fit.", "**拼图：** 把图切成块并打乱，预测排列；需要知道物体各部分怎么拼。"),
                            T("**Colourisation, inpainting:** predict the colours or the removed region from the rest.", "**上色、补全：** 由其余部分预测颜色或被抠掉的区域。"),
                            T("**Masked language modelling:** mask about 15% of the words, predict them from both sides (BERT).", "**掩码语言模型：** 遮住约 15% 的词，用左右两侧上下文预测（BERT）。"))),
                 p(T("All three share the recipe: **change or hide something in the data; the unchanged data is the answer.**", "三种办法套路相同：**对数据做点改动或遮挡，没改动的原数据就是答案。**")),
                 skill=PR),
            read('contrastive', T('Contrastive learning: pull the same, push the different', '对比学习：同类拉近，不同类推远'),
                 svg(drawn(fig_simclr), T('A SimCLR-style pipeline: two augmented views of one image go through the same encoder f and a projection g; their outputs z_i, z_j are pulled together and pushed away from the outputs of other images.', 'SimCLR 式流程：同一张图的两个增强视图经过同一个编码器 f 和投影 g；输出 z_i、z_j 被拉近，并与其他图像的输出推远。')),
                 p(T("There is no 'next word' or 'missing patch' to predict here. The label is a **relationship**. Take an image and make two random **augmentations** of it (crop, flip, colour change, blur): these two views form a **positive pair**. Views of *other* images in the batch are **negatives**. Train so that positives get similar embeddings and negatives get dissimilar ones.",
                     "这里没有“下一个词”或“缺失的块”要预测，标签是一种**关系**。取一张图，做两种随机**增强**（裁剪、翻转、变色、模糊）：这两个视图是一个**正样本对 (positive pair)**；同一批里*别的*图像的视图是**负样本 (negatives)**。训练目标：正样本嵌入相似，负样本嵌入不相似。")),
                 ul(T("**Augmentations carry the bias:** they say what should be ignored (position, colour) and so what is kept (the object).", "**增强决定偏置：** 它规定了应该忽略什么（位置、颜色），也就决定了留下什么（物体本身）。"),
                    T("**Projection head g** (SimCLR, textbook): the loss is computed on z = g(f(x)); after pre-training g is thrown away and the encoder output is used downstream.", "**投影头 g**（SimCLR，教科书内容）：损失在 z = g(f(x)) 上算；预训练完扔掉 g，下游使用编码器输出。"),
                    T("**Negatives come free** from the same batch: with N images there are 2N views, and each view has 2(N−1) negatives.", "**负样本从同一批里免费得到：** N 张图有 2N 个视图，每个视图有 2(N−1) 个负样本。")),
                 skill=CT),
            derive('infonce', T('The contrastive loss (InfoNCE) term by term', '对比损失（InfoNCE）逐项推导'),
                   [(r"s_k = \frac{z_a^\top z_k}{\lVert z_a\rVert\,\lVert z_k\rVert}",
                     T("Compare the anchor $a$ with each candidate $k$ by **cosine similarity**: 1 if they point the same way, 0 if unrelated, −1 if opposite. Candidate 0 is the positive, candidates 1..K are negatives.", "用**余弦相似度**比较锚点 $a$ 和每个候选 $k$：方向相同为 1，无关为 0，相反为 −1。候选 0 是正样本，1..K 是负样本。"),
                     T("Normalising means only direction counts; the loss cannot be lowered just by making vectors longer.", "归一化之后只有方向有意义；不能靠把向量拉长来降低损失。")),
                    (r"u_k = s_k / \tau", T("Divide by the **temperature** $\\tau > 0$. It will control how sharply the loss separates a small lead from a large one.", "除以**温度** $\\tau > 0$。它控制损失对“小领先”和“大领先”区分得多尖锐。")),
                    (r"p_k = \frac{e^{u_k}}{\sum_{j=0}^{K} e^{u_j}}",
                     T("Softmax over the $K+1$ candidates. $p_0$ is the model's probability that the positive is the true partner of the anchor: we have turned the problem into a **classification** with one correct class.", "对 $K+1$ 个候选做 softmax。$p_0$ 是模型认为“正样本才是锚点真伙伴”的概率：问题变成了只有一个正确类的**分类**。")),
                    (r"\mathcal{L} = -\ln p_0 = -\ln \frac{e^{s_0/\tau}}{\sum_{j=0}^{K} e^{s_j/\tau}}",
                     T("The usual cross-entropy with the positive as the right class. This is **InfoNCE**; SimCLR calls it NT-Xent (normalised temperature-scaled cross-entropy).", "就是以正样本为正确类的交叉熵。这就是 **InfoNCE**；SimCLR 叫它 NT-Xent（归一化、带温度的交叉熵）。")),
                    (r"\mathcal{L} = \underbrace{-\frac{s_0}{\tau}}_{(1)} + \underbrace{\ln \sum_{j=0}^{K} e^{s_j/\tau}}_{(2)}",
                     T("Split the log. **(1), the numerator:** rewards a high similarity to the positive (pull). **(2), the denominator:** a smooth maximum of *all* similarities; any candidate that looks like the anchor raises it (push). The positive is inside the denominator too, so the loss cannot be driven down by inflating everything.", "把对数拆开。**(1) 分子：** 奖励与正样本的高相似度（拉）。**(2) 分母：** 对*所有*相似度取平滑最大值；任何长得像锚点的候选都会把它抬高（推）。正样本自己也在分母里，所以不能靠把所有相似度一起抬高来降低损失。")),
                    (r"\frac{\partial \mathcal{L}}{\partial s_0} = -\frac{1-p_0}{\tau}",
                     T("Gradient on the positive's similarity: negative, so gradient descent *raises* $s_0$. The pull fades as $p_0 \\to 1$.", "对正样本相似度的梯度：为负，所以梯度下降会*抬高* $s_0$。当 $p_0 \\to 1$ 时拉力渐弱。")),
                    (r"\frac{\partial \mathcal{L}}{\partial s_k} = +\frac{p_k}{\tau} \quad (k \ge 1)",
                     T("Each negative is pushed down with strength $p_k$: the ones that currently look most like the anchor (**hard negatives**) are pushed hardest, easy ones hardly at all.", "每个负样本以强度 $p_k$ 被往下推：现在最像锚点的那些（**难负样本**）推得最狠，容易的几乎不推。")),
                    (r"s_0 = s_1 = \dots = s_K \ \Rightarrow\ \mathcal{L} = \ln(K+1)",
                     T("Sanity check: if the model cannot tell the candidates apart, every $p_j = 1/(K+1)$, which is the 'know nothing' level $\\ln(K+1)$.", "自检：如果模型完全分不出候选，则每个 $p_j = 1/(K+1)$，损失就是“什么都不知道”的水平 $\\ln(K+1)$。"))],
                   intro=T("Instead of inventing separate attract and repel terms, treat the job as a multiple-choice question: *among 1 positive and K negatives, which one is the true partner of this anchor?*", "不去分别发明“吸引项”和“排斥项”，而是把任务当成一道选择题：*在 1 个正样本和 K 个负样本里，哪一个才是这个锚点的真伙伴？*"),
                   outro=T("In a batch the loss is averaged over all anchors. Pull and push come from one formula: numerator pulls, denominator pushes.", "在一个批里，对所有锚点取平均。拉和推出自同一个式子：分子拉，分母推。"),
                   skill=NC),
            derive('infonce-calc', T('InfoNCE for one anchor, by hand', '手算一个锚点的 InfoNCE'),
                   [(r"s = (0.8,\ 0.5,\ 0.1,\ -0.3)",
                     T("One anchor, one positive (0.8) and three negatives. The first negative (0.5) is a hard one: nearly as similar as the positive. Take $\\tau = 0.5$.", "一个锚点，一个正样本（0.8）和三个负样本。第一个负样本（0.5）是难的：几乎和正样本一样相似。取 $\\tau = 0.5$。")),
                    (r"u = s/\tau = (1.6,\ 1.0,\ 0.2,\ -0.6)", T("Divide every similarity by $\\tau$.", "每个相似度除以 $\\tau$。")),
                    (S(r"e^{u} = (@a@,\ @b@,\ @c@,\ @d@)", '', a=f(E5[0]), b=f(E5[1]), c=f(E5[2]), d=f(E5[3]))['en'], T("Exponentiate (calculator).", "取指数（用计算器）。")),
                    (S(r"\sum_j e^{u_j} \approx @z@", '', z=f(Z5))['en'], T("The denominator: add the four.", "分母：四项相加。")),
                    (S(r"p_0 = \frac{e^{1.6}}{@z@} = @p@", '', z=f(Z5), p=f(P5[0]))['en'], T("The positive's softmax probability: numerator over denominator.", "正样本的 softmax 概率：分子除以分母。")),
                    (S(r"\mathcal{L} = -\ln p_0 = @l@", '', l=f(L5))['en'], T("Take $-\\ln$. For comparison the 'know nothing' level is $\\ln 4 = 1.386$.", "取 $-\\ln$。对照：“什么都不知道”的水平是 $\\ln 4 = 1.386$。")),
                    (S(r"\frac{\partial\mathcal{L}}{\partial s} = (@g0@,\ +@g1@,\ +@g2@,\ +@g3@)", '', g0=f(G5[0], 2), g1=f(G5[1], 2), g2=f(G5[2], 2), g3=f(G5[3], 2))['en'],
                     T("The gradients: the positive is pulled up with $(1-p_0)/\\tau$; each negative is pushed down with $p_k/\\tau$. The hard negative takes half of the push. They sum to zero: total pull equals total push.", "梯度：正样本以 $(1-p_0)/\\tau$ 被拉高；每个负样本以 $p_k/\\tau$ 被压低。难负样本承担了一半的推力。它们加起来为零：总拉力等于总推力。"))],
                   blank=(4, 'exp(1.6)/(exp(1.6)+exp(1)+exp(0.2)+exp(-0.6))', T(r"Write $p_0$ as a fraction of the four exponentials from $u$.", r"把 $p_0$ 写成关于 $u$ 的四个指数项的分式。")),
                   intro=T("The recipe is the same as the exam would ask: similarities in, loss out. Natural log throughout.", "套路和考试会问的一样：给相似度，求损失。全程自然对数。"),
                   skill=NC),
            read('tau', T('What the temperature does', '温度 τ 在做什么'),
                 svg(drawn(fig_tau), T('The same four similarities turned into softmax probabilities at three temperatures: the lower the temperature, the more the positive and the hardest negative take everything.', '同样四个相似度在三个温度下变成的 softmax 概率：温度越低，概率越集中到正样本和最难的负样本上。')),
                 table([T('τ', 'τ'), T('p of positive', '正样本概率'), T('loss', '损失'), T('share of the push on the hardest negative', '推力中落在最难负样本上的比例')],
                       *[[f'{t:g}', f(NCE[t][0][0]), f(NCE[t][1]), f'{share[t] * 100:.0f}%'] for t in TAUS]),
                 p(T("**Lower τ** sharpens the softmax: differences are magnified, the loss and its gradient care almost only about the *hardest* negatives, which helps the model learn fine distinctions. **Higher τ** flattens it: all negatives are treated alike, and as $\\tau \\to \\infty$ the loss tends to $\\ln(K+1)$ with a weak signal.",
                     "**τ 变小**让 softmax 更尖：差异被放大，损失和梯度几乎只关心*最难*的负样本，有利于学到细微区别。**τ 变大**让它变平：所有负样本一视同仁，$\\tau \\to \\infty$ 时损失趋于 $\\ln(K+1)$，信号很弱。")),
                 callout('warning', T('Smaller is not simply better', 'τ 并不是越小越好'),
                         T(
                             f"Suppose the 'hardest negative' is a *false negative*: another photo of the same dog that happens to be in the batch. With similarities (0.5, 0.9, 0.1, −0.3) the loss is {f(FN_LOSS[1.0], 2)} at τ = 1 but {f(FN_LOSS[0.1], 2)} at τ = 0.1, and nearly all the push goes to that very photo. A low temperature punishes label noise hardest.",
                             f"假设“最难的负样本”其实是*假负样本*：批里恰好有同一条狗的另一张照片。相似度 (0.5, 0.9, 0.1, −0.3) 时，τ = 1 的损失是 {f(FN_LOSS[1.0], 2)}，τ = 0.1 却是 {f(FN_LOSS[0.1], 2)}，而且几乎所有推力都砸在那张照片上。温度低，对标签噪声的惩罚最重。")),
                 quiz(T("You lower τ from 0.5 to 0.1 on the same similarities. What changes?", "同样的相似度，τ 从 0.5 降到 0.1，会怎样？"),
                      [(T('The push is spread more evenly over all negatives', '推力在所有负样本之间分得更均匀'), T("That is what a *higher* τ does. Lower τ concentrates it.", "那是*更高*的 τ 的效果；τ 低会更集中。")),
                       (T('The push concentrates on the hardest negative', '推力更集中在最难的负样本上'), True),
                       (T('The loss can no longer go below ln(K+1)', '损失再也低不过 ln(K+1)'), T("ln(K+1) is the loss at *no* discrimination, and lower τ lets the loss go lower, not stay higher.", "ln(K+1) 是毫无区分度时的损失；τ 越低，损失反而可以更低。"))],
                      T("Softmax with a small temperature is nearly an argmax: only the biggest similarities matter, so the gradient lands on the hardest negative.", "小温度的 softmax 接近 argmax：只有最大的相似度才起作用，梯度就落在最难的负样本上。")),
                 skill=NC),
            read('transfer', T('Why these representations transfer', '为什么这样学到的表示能迁移'),
                 p(T("Nobody asked the encoder to recognise dogs, yet a linear layer on top of it can. The reason is in what the pretext task *forces*:", "没人要求编码器认识狗，但在它上面加一层线性层就能认。原因在于前置任务*逼着*它做什么：")),
                 ul(T("**Contrastive:** to put two crops/colour-shifted views of one photo close together, the encoder must keep what survives those changes (shape, parts, texture of the object) and drop what does not (position, exact colour). To keep different photos apart it must keep what distinguishes them. What survives *and* distinguishes is mostly semantic.", "**对比：** 要让同一张照片的两个裁剪/变色视图靠近，编码器就必须保留经得住这些变化的东西（物体的形状、部件、纹理），丢掉经不住的（位置、确切颜色）；要把不同照片分开，就必须保留能区分它们的东西。既经得住变化*又*能区分的，多半是语义。"),
                    T("**Masked / autoregressive:** to fill in a patch you must know what objects look like; to predict a next word you need grammar, facts and common sense. The deepest regularities of the data are what lower the loss.", "**遮挡/自回归：** 要补出一块图，得知道物体长什么样；要预测下一个词，得懂语法、事实和常识。数据里最深的规律才能降低损失。"),
                    T("**Pretext and downstream need the same information.** The downstream labels (cat, dog) depend on exactly the structure that the encoder had to learn, so a small head suffices.", "**前置任务和下游任务需要同样的信息。** 下游标签（猫、狗）依赖的正是编码器被迫学会的结构，所以小小的头就够了。")),
                 math_(r"I(x_a; x_b) \;\ge\; \ln(K+1) - \mathcal{L}"),
                 p(T("The deeper reason (van den Oord et al., 2018; textbook): minimising InfoNCE *maximises a lower bound on the mutual information between the two views*. The shared information of two views of the same thing is its content. The bound cannot exceed $\\ln(K+1)$, so more negatives (a bigger batch) let the model capture more.",
                     "更深的原因（van den Oord 等，2018；教科书内容）：最小化 InfoNCE 就是在*最大化两个视图之间互信息的下界*。同一事物的两个视图共有的信息就是它的内容。这个下界不会超过 $\\ln(K+1)$，所以负样本越多（批越大），模型能抓到的越多。")),
                 callout('warning', T('When transfer fails', '什么时候迁移会失败'),
                         T("(1) The pretext can be solved with a **shortcut** that has nothing to do with meaning (for jigsaw, the colour fringes at tile edges give the answer away). (2) The augmentation **throws away what the downstream task needs** (colour jitter ruins a task that classifies ripeness by colour). (3) The pre-training data differs from the target data. SSL representations also inherit the **biases of the data** they were trained on (see the fairness lesson).",
                           "(1) 前置任务能用与语义无关的**捷径**解出来（拼图里，块边缘的色边就泄露了答案）。(2) 增强**丢掉了下游任务需要的信息**（用颜色判断成熟度的任务，颜色抖动就毁了它）。(3) 预训练数据和目标数据差太远。SSL 学到的表示还会继承训练数据里的**偏差**（见公平性那一课）。")),
                 skill=TR),
            derive('ntp', T('Why next-token prediction is self-supervised', '为什么“预测下一个词”是自监督'),
                   [(r"x_{1:T} = (x_1, x_2, \dots, x_T)", T("A text of $T$ tokens (words or word pieces). No label anywhere.", "一段含 $T$ 个词元 (token) 的文本。哪里都没有标签。")),
                    (r"x_{<t} \ \longrightarrow\ x_t, \qquad t = 1, \dots, T", T("At every position $t$, the words before it are the input and the word that really comes next is the target. One text gives $T$ labelled examples for free. **That is why it is self-supervised: the label comes from the data itself.**", "在每个位置 $t$，它前面的词是输入，真正出现的下一个词是目标。一段文本免费给出 $T$ 个带标签的样本。**这就是它属于自监督的原因：标签来自数据本身。**")),
                    (r"p_\theta(x_{1:T}) = \prod_{t=1}^{T} p_\theta(x_t \mid x_{<t})", T("The chain rule of probability: exact, no assumption. A bigram model would keep only $x_{t-1}$; an LLM conditions on the whole left context.", "概率的链式法则：精确成立，不需要任何假设。二元模型只保留 $x_{t-1}$；大模型以整个左侧上下文为条件。")),
                    (r"\mathcal{L}(\theta) = -\sum_{t=1}^{T} \ln p_\theta(x_t \mid x_{<t})", T("Cross-entropy between the model's next-token distribution and the one-hot true token, summed over positions. It equals the **negative log-likelihood of the text**, so training is maximum likelihood estimation, as in the probability lesson.", "模型的下一词分布与独热真实词之间的交叉熵，对各位置求和。它就是**文本的负对数似然**，所以训练就是极大似然估计，和概率那一课一样。")),
                    (r"\mathcal{L} = -\ln 0.05 - \ln 0.2 - \ln 0.5 - \ln 0.4 - \ln 0.1 = " + f(NTP_SUM, 3),
                     T("Example on 'the cat sat on the mat'. Probabilities the model gave to the true next word: cat|the = 0.05, sat|the cat = 0.2, on|...sat = 0.5, the|...on = 0.4, mat|...the = 0.1. Add the five $-\\ln p$.", "例子：“the cat sat on the mat”。模型给真实下一个词的概率：cat|the = 0.05，sat|the cat = 0.2，on|…sat = 0.5，the|…on = 0.4，mat|…the = 0.1。把五个 $-\\ln p$ 加起来。")),
                    (r"\bar{\mathcal{L}} = " + f(NTP_SUM, 3) + r"/5 = " + f(NTP_MEAN, 3) + r", \quad \mathrm{PPL} = e^{" + f(NTP_MEAN, 3) + r"} = " + f(NTP_PPL, 2),
                     T("Per-token loss, and its exponential, the **perplexity**: the model is as unsure as if it chose uniformly among about 5.5 words at each step. Lower is better.", "每个词元的平均损失，及其指数——**困惑度 (perplexity)**：模型的不确定程度，相当于每一步在约 5.5 个词里均匀乱猜。越低越好。"))],
                   blank=(4, '-ln(0.05)-ln(0.2)-ln(0.5)-ln(0.4)-ln(0.1)', T("Write the total loss as a sum of the five $-\\ln p$ terms.", "把总损失写成五项 $-\\ln p$ 之和。")),
                   intro=T("A sentence already contains its own labels. Take 'the cat sat on the mat'.", "一个句子里已经带着它自己的标签。以“the cat sat on the mat”为例。"),
                   outro=T("Because the Transformer decoder only looks left (it cannot peek at the answer), all $T$ predictions of a text are computed in a single pass. GPT-3 needed no other supervision than this.", "Transformer 解码器只看左边（不能偷看答案），所以一段文本的 $T$ 个预测一次前向就能全算出来。GPT-3 除此之外没用别的监督。"),
                   skill=LM),
            read('ngram', T('From counting to a neural language model', '从数数到神经语言模型'),
                 p(T("A **language model** gives the probability of the next word. The oldest way is counting.", "**语言模型**给出下一个词的概率。最古老的办法是数数。")),
                 table([T('Model', '模型'), T('Looks at', '看什么'), T('Estimated by', '怎么估计'), T('Problem', '问题')],
                       [T('Bigram', '二元 (bigram)'), T('the previous word only', '只看前一个词'), T('P(w | prev) = count(prev, w) / count(prev)', 'P(w | 前一词) = count(前一词, w) / count(前一词)'), T("'sweet ___': cake 22%, smell 14%, potato 12% (lecture): weak context", "“sweet ___”：cake 22%、smell 14%、potato 12%（讲义）：上下文太少")],
                       [T('n-gram (3, 4, 5)', 'n 元'), T('the previous n−1 words', '前 n−1 个词'), T('the same counting', '同样数数'), T("'home sweet ___': home 95%. Better, but sparse.", "“home sweet ___”：home 95%。更好，但数据稀疏。")],
                       [T('LLM (Transformer)', '大模型 (Transformer)'), T('the whole left context', '整个左侧上下文'), T('a neural network trained by next-token loss', '用下一词损失训练的神经网络'), T('needs lots of data and compute', '需要大量数据与算力')]),
                 p(S("**Why n-grams fail:** with a vocabulary of V = @v@ words, a 5-gram has V⁴ = @c@ different 4-word contexts, while even 10¹³ training tokens could cover only a tiny fraction of them. Most contexts were never seen, so counting gives no estimate. Sentences like *'The water wasn't just hot, it was ___'* or *'The square root of 9 is ___'* need a model that **generalises** from what it has seen, not one that only counts.",
                       "**n 元为什么不行：** 词表 V = @v@ 时，5 元组有 V⁴ = @c@ 种 4 词上下文，而哪怕 10¹³ 个训练词元也只能覆盖其中极小一部分。绝大多数上下文从没见过，数数就给不出估计。像 *“The water wasn't just hot, it was ___”*、*“The square root of 9 is ___”* 这样的句子，需要的是能从见过的东西中**泛化**的模型，而不是只会数数的。",
                       v=f'{V:,}', c=f'{CTX5:.2e}'.replace('e+', '×10^'))),
                 quiz(T("Why does a 5-gram model fail on long, rare contexts while a neural LM does not?", "为什么 5 元模型在长而罕见的上下文上失灵，神经语言模型却不会？"),
                      [(T('Counts for unseen contexts are zero or undefined; a neural net shares what it learned between similar contexts', '没见过的上下文计数为零或无定义；神经网络把学到的东西在相似上下文间共享'), True),
                       (T('A neural net memorises every sentence it saw', '神经网络把见过的每句话都背下来'), T("Memorising would fail on new contexts just as counting does; the gain is generalisation.", "死记同样会在新上下文上失败；神经网络的好处是泛化。")),
                       (T('N-grams cannot use unlabelled text', 'n 元模型不能用无标注文本'), T("They use only raw text; the problem is sparsity, not labels.", "它们用的就是原始文本；问题在稀疏，而不在标签。"))],
                      T("Estimating by counting needs each context to have been seen. A neural LM represents words as vectors, so similar contexts get similar predictions.", "靠数数估计，要求每个上下文都见过。神经语言模型把词表示成向量，相似的上下文得到相似的预测。")),
                 skill=LM, chapter=T('Language models', '语言模型')),
            read('needs', T('What model do we actually need?', '我们究竟需要什么样的模型？'),
                 p(T("Three needs from the lecture: capture the **relationship between words** (meaning, order); handle **long-range dependencies** (what was said ten words ago can matter now); and **generalise** to combinations never seen. A plain FNN fails the first two:", "讲义里的三个需求：抓住**词与词的关系**（含义、顺序）；处理**长程依赖**（十个词前说的话现在可能还重要）；对没见过的组合**泛化**。普通 FNN 前两条都做不到：")),
                 ul(T("**No order.** An FNN on a bag of words treats 'The dog is chasing the cat' and 'The cat is chasing the dog' as the same input; it does not care which word is $x_1$ and which is $x_3$.", "**没有顺序。** 词袋输入的 FNN 把“The dog is chasing the cat”和“The cat is chasing the dog”当成同一个输入；它不在乎哪个词是 $x_1$、哪个是 $x_3$。"),
                    T("**No links within a layer.** Nodes only connect across layers, so there is no way to relate 'it' to 'trophy' in 'The trophy didn't fit in the suitcase because it was too big' (and to 'suitcase' if the last word is 'small'). That needs common sense about relations.", "**同层节点没有连接。** 节点只在层与层之间相连，所以没法把“The trophy didn't fit in the suitcase because it was too big”里的 it 和 trophy 联系起来（结尾换成 small，it 就指 suitcase）。这需要关于关系的常识。")),
                 table([T('Need', '需求'), T('What the Transformer adds', 'Transformer 的对策')],
                       [T('Order of words', '词序'), T('**positional encoding**', '**位置编码**')],
                       [T('Relationships across the sentence', '整句话里的关系'), T('**attention**', '**注意力**')],
                       [T('New combinations', '新组合'), T('training on billions of sentences', '在数十亿句子上训练')]),
                 skill=TF),
            read('position', T('Positional encoding: telling the model where each word is', '位置编码：告诉模型每个词在哪'),
                 p(T("Each token first becomes a dense vector (its **embedding**; the same word always gives the same vector). Then a **positional vector** of alternating sines and cosines is *added*, so the model receives a vector that mixes *what* the word is with *where* it is. 'the' at position 0 and 'the' at position 3 now have different vectors.", "每个词元先变成一个稠密向量（**词嵌入**；同一个词总得到同一个向量）。然后*加上*一个由正弦、余弦交替组成的**位置向量**，模型拿到的向量就同时含有这个词*是什么*和*在哪*。位置 0 的 the 和位置 3 的 the 现在向量不同了。")),
                 math_(r"PE_{(pos,\,2i)} = \sin\!\Big(\frac{pos}{10000^{2i/d}}\Big), \quad PE_{(pos,\,2i+1)} = \cos\!\Big(\frac{pos}{10000^{2i/d}}\Big)"),
                 table([T('position', '位置'), '0', '1', '2', '3', '4'],
                       [T('sin(pos)', 'sin(pos)')] + [f(math.sin(k), 2) for k in range(5)],
                       [T('cos(pos)', 'cos(pos)')] + [f(math.cos(k), 2) for k in range(5)]),
                 p(T("The table is the first sine/cosine pair (the one drawn in the lecture); other pairs use slower frequencies, like the hands of a clock, so every position gets its own pattern. The formula is the original Transformer paper's (Vaswani et al., 2017; textbook, the exam only needs the idea).", "表里是第一对正弦/余弦（讲义里画的那一对）；其他对用更慢的频率，像钟表的各根指针，于是每个位置都有独一无二的图案。公式来自原始 Transformer 论文（Vaswani 等，2017；教科书内容，考试只需要想法）。")),
                 skill=TF),
            derive('attention', T('Attention: query, keys, weights', '注意力：查询、键、权重'),
                   [(r"q_i = W_Q x_i, \quad k_j = W_K x_j, \quad v_j = W_V x_j",
                     T("Every token makes three vectors with learned matrices. **Query** $q$: what I am looking for ('who am I referring to?'). **Key** $k$: what I can offer. **Value** $v$: the content I hand over if chosen.", "每个词元用学出来的矩阵造三个向量。**查询** $q$：我在找什么（“我指的是谁？”）。**键** $k$：我能提供什么。**值** $v$：被选中时交出去的内容。")),
                    (r"a_{ij} = \frac{q_i \cdot k_j}{\sqrt{d}}",
                     T("Compare the query of token $i$ with the key of token $j$ by a dot product: a better match gives a bigger score. Dividing by $\\sqrt{d}$ stops scores growing with the vector size $d$.", "用点积比较词 $i$ 的查询和词 $j$ 的键：匹配越好，分数越大。除以 $\\sqrt{d}$ 是为了不让分数随向量维度 $d$ 变大。")),
                    (r"w_{ij} = \frac{e^{a_{ij}}}{\sum_{j'} e^{a_{ij'}}}",
                     T("Softmax over the tokens: positive weights that sum to 1. These are the line thicknesses in the lecture's picture (.45 on 'trophy', .15 on 'big'). It is the same softmax as in InfoNCE, with $\\sqrt{d}$ playing the role of the temperature.", "对各词做 softmax：权重为正且和为 1。就是讲义图里线的粗细（trophy 上 .45，big 上 .15）。和 InfoNCE 里是同一个 softmax，只是 $\\sqrt{d}$ 扮演了温度。")),
                    (r"o_i = \sum_j w_{ij}\, v_j",
                     T("The new vector of token $i$ is the weighted mix of the values. 'it' now carries information from 'trophy': a **contextually rich embedding**.", "词 $i$ 的新向量是各值按权重的加权和。现在“it”带上了“trophy”的信息：**富含上下文的嵌入**。")),
                    (S(r"a = (@a@,\ @b@,\ @c@)", '', a=f(ATT_SC['trophy']), b=f(ATT_SC['suitcase']), c=f(ATT_SC['big']))['en'],
                     T("Toy numbers (not the lecture's), $d = 2$: $q = (1, 0.5)$ for 'it'; keys trophy $(2,1)$, suitcase $(1,1)$, big $(0,1)$. Dot products 2.5, 1.5, 0.5, each divided by $\\sqrt{2}$.", "玩具数字（不是讲义的），$d = 2$：“it”的 $q = (1, 0.5)$；键 trophy $(2,1)$、suitcase $(1,1)$、big $(0,1)$。点积 2.5、1.5、0.5，各除以 $\\sqrt{2}$。")),
                    (S(r"w = (@a@,\ @b@,\ @c@)", '', a=f(ATT_W['trophy']), b=f(ATT_W['suitcase']), c=f(ATT_W['big']))['en'],
                     T("Softmax of the three scores. 'trophy' wins.", "对三个分数做 softmax。trophy 胜出。")),
                    (S(r"o = @a@\cdot 4 + @b@\cdot 1 + @c@\cdot 2 = @o@", '', a=f(ATT_W['trophy']), b=f(ATT_W['suitcase']), c=f(ATT_W['big']), o=f(ATT_OUT))['en'],
                     T("With one-number values 4, 1, 2 the output is dominated by the trophy's value.", "取一维的值 4、1、2，输出主要由 trophy 的值决定。"))],
                   blank=(5, 'exp(2.5/sqrt(2))/(exp(2.5/sqrt(2))+exp(1.5/sqrt(2))+exp(0.5/sqrt(2)))', T("Write the weight on 'trophy' from the three dot products 2.5, 1.5, 0.5.", "由三个点积 2.5、1.5、0.5 写出 trophy 的权重。")),
                   intro=T("When the model reads 'it', each other word is asked how relevant it is. Query against keys, then mix.", "模型读到“it”时，要问其他每个词有多相关。用查询去对键，然后混合。"),
                   outro=T("In practice several attention sets run in parallel (multi-head), and in a decoder the weights on *later* tokens are forced to zero, so the model cannot peek at the word it must predict.", "实际中会并行跑多组注意力（多头）；解码器里对*后面*词元的权重被强制为零，模型就不能偷看要预测的那个词。"),
                   skill=TF),
            read('block', T('The Transformer block and how text is generated', 'Transformer 模块与文本生成'),
                 table([T('Part', '部分'), T('What it does', '作用')],
                       [T('Input embedding', '输入嵌入'), T('each token (vocabulary item) becomes a dense vector', '每个词元（词表项）变成稠密向量')],
                       [T('Positional encoding', '位置编码'), T('added to carry position', '加进去以带上位置')],
                       [T('N × [attention, feedforward]', 'N 层 [注意力, 前馈]'), T('each with layer norm and a residual connection (the stream that carries the vector); attention adds context', '各带层归一化和残差连接（携带向量的主干）；注意力加入上下文')],
                       [T('Unembedding', '反嵌入'), T('projects the hidden vector to one score per vocabulary word', '把隐藏向量投影成词表里每个词一个分数')],
                       [T('Softmax', 'softmax'), T('scores to a probability distribution', '把分数变成概率分布')]),
                 h(T('Autoregressive decoding', '自回归解码')),
                 ol(T("Feed the whole context $x_1..x_T$ to the decoder.", "把整个上下文 $x_1..x_T$ 喂给解码器。"),
                    T("Get $p(w \\mid x_1..x_T)$ over the vocabulary.", "得到词表上的 $p(w \\mid x_1..x_T)$。"),
                    T("Choose $x_{T+1}$ from it (greedy, top-k or top-p).", "从中选出 $x_{T+1}$（贪心、top-k 或 top-p）。"),
                    T("Append it to the context, $T \\leftarrow T+1$, repeat until the end-of-sequence token.", "把它接到上下文后面，$T \\leftarrow T+1$，重复直到出现结束符。")),
                 p(S("Next-word distribution after 'the cat sat on the': mat 0.45, floor 0.25, sofa 0.15, roof 0.10, moon 0.05.", "“the cat sat on the”之后的下一词分布：mat 0.45、floor 0.25、sofa 0.15、roof 0.10、moon 0.05。")),
                 table([T('Rule', '规则'), T('Picks from', '从哪里选'), T('Result here', '这里的结果')],
                       [T('Greedy (argmax)', '贪心 (argmax)'), T('the single most probable token', '概率最高的那个词元'), T('mat', 'mat')],
                       [T('Top-k, k = 2', 'top-k，k = 2'), T('the k most probable, renormalised', '概率最高的 k 个，重新归一化'), T(f'mat {TOPK2[0]:.3f}, floor {TOPK2[1]:.3f}', f'mat {TOPK2[0]:.3f}、floor {TOPK2[1]:.3f}')],
                       [T('Top-p (nucleus), p = 0.8', 'top-p（核采样），p = 0.8'), T('the smallest set whose cumulative probability exceeds p, renormalised', '累计概率超过 p 的最小集合，重新归一化'),
                        T(', '.join(f'{w} {q:.3f}' for (w, _), q in zip(TOPP_SET, TOPP_NORM)), '、'.join(f'{w} {q:.3f}' for (w, _), q in zip(TOPP_SET, TOPP_NORM)))]),
                 p(T("Greedy is repeatable but dull; sampling gives variety, and top-k / top-p stop it picking absurd rare tokens.", "贪心可重复但呆板；采样带来多样性，top-k / top-p 则避免抽到离谱的罕见词。")),
                 skill=TF),
            read('llm', T('From a pre-trained model to an assistant', '从预训练模型到助手'),
                 ol(T("**Pre-train** on raw, unlabelled text by next-token prediction. GPT-1 (Radford) and BERT (Devlin) both appeared around 2018: GPT predicts left to right; BERT, 'bidirectional', fills in masked words using both sides.", "在原始无标注文本上用下一词预测**预训练**。GPT-1（Radford）和 BERT（Devlin）都出现在 2018 年前后：GPT 从左到右预测；BERT 是“双向”的，用两侧上下文补出被遮的词。"),
                    T("**It learns tasks without being told.** To predict the next word well across billions of sentences the model must learn facts, reasoning, language and common sense. Raw web text already contains tasks matched together, such as a question followed by its answer. GPT-3 needed no extra supervised learning: just predict the next token.", "**没人教它也学到了任务。** 要在数十亿句子上把下一个词预测好，模型必须学会事实、推理、语言和常识。原始网页文本里本来就有成对的任务，比如问题后面跟着答案。GPT-3 不需要额外的监督学习：只预测下一个词元。"),
                    T("**Fine-tune** so that it answers questions (not just completes sentences), follows instructions and behaves safely. Alignment methods named in the lecture: prompt-tuning, reinforcement learning from human feedback (RLHF), adapters / parameter-efficient fine-tuning.", "**微调**，让它会回答问题（而不只是续写句子）、遵循指令、行为安全。讲义提到的对齐方法：提示调优 (prompt-tuning)、基于人类反馈的强化学习 (RLHF)、适配器/参数高效微调。")),
                 callout('note', T('What an LLM is (the lecture summary)', '大语言模型是什么（讲义小结）'),
                         T("A Transformer with many layers (50 or more blocks), used as an autoregressive decoder, pre-trained in a self-supervised way, then trained and aligned further. It is not a new paradigm: it is self-supervised learning at enormous scale.", "一个层数很多（50 块以上）的 Transformer，当作自回归解码器使用，用自监督方式预训练，再进一步训练和对齐。它不是新范式：是规模巨大的自监督学习。")),
                 p(T("Scale (lecture): roughly 10 TB of text, 6,000 GPUs for 12 days, about \\$2M and 10²⁴ FLOPs, giving a parameter file of about 140 GB. It is so expensive that the weights are updated only once a year or every few years.", "规模（讲义）：约 10 TB 文本、6000 块 GPU 跑 12 天、约 200 万美元、10²⁴ 次浮点运算，得到约 140 GB 的参数文件。贵到权重一年甚至几年才更新一次。")),
                 skill=LL),
            read('proscons', T('Pros and cons of self-supervised learning', '自监督学习的优缺点'),
                 table([T('Pros', '优点'), T('Cons', '缺点')],
                       [T('No labelling cost for pre-training: raw data is abundant', '预训练不需要标注成本：原始数据很充裕'), T('Needs a well-designed pretext task / augmentation; a poor one learns the wrong thing or a shortcut', '要精心设计前置任务/增强；设计不好会学错东西或走捷径')],
                       [T('Big unlabelled data gives general representations that transfer to many tasks', '大量无标注数据学出通用表示，可迁移到很多任务'), T('Very expensive in data and compute (the LLM numbers above)', '数据和算力都很贵（见上面大模型的数字）')],
                       [T('The downstream task needs only a few labels and a small head', '下游任务只需少量标签和一个小头'), T('Quality is judged indirectly, only through the downstream task', '质量只能通过下游任务间接评判')],
                       [T('Scales: more data and bigger models keep improving it', '可扩展：数据更多、模型更大就持续变好'), T('Learns the biases of its data; contrastive methods need many negatives and suffer from false negatives', '会学到数据里的偏差；对比方法需要很多负样本，且受假负样本困扰')]),
                 chapter=T('Practice and review', '练习与回顾')),
            choice('p-which', T('Which one is self-supervised?', '哪一个是自监督？'), SK,
                   T('Which of these is self-supervised learning?', '下面哪一个是自监督学习？'),
                   [(T('Self-training: label the unlabelled data with the model, then retrain', '自训练：用模型给无标注数据打标签，再重训'), T("That is semi-supervised: it starts from a labelled set and the pseudo-labels come from the *model's predictions*, not from the structure of the data.", "那是半监督：它从一个有标注的集合出发，伪标签来自*模型的预测*，而不是数据本身的结构。")),
                    (T('Hide 15% of the words in a text and train the model to recover them', '遮住文本里 15% 的词，训练模型把它们还原'), True),
                    (T('Run k-means on unlabelled images to find groups', '对无标注图像做 k-means 找簇'), T("k-means has no target built from the data; it is unsupervised.", "k-means 没有从数据造出的目标；它是无监督。")),
                    (T('Ask an expert to label the images the model is least sure of', '请专家给模型最没把握的图像打标签'), T("That is active learning: the labels still come from a human.", "那是主动学习：标签仍然来自人。"))],
                   T("The text itself supplies the answers (the masked words), so no human labelled anything, and there is a target and a loss.", "文本自己提供了答案（被遮的词），没有人标注，且有目标和损失。")),
            number('p-nce', T('InfoNCE by hand', '手算 InfoNCE'), NC,
                   S("An anchor has cosine similarities (@a@, @b@, @c@, @d@) with its positive and three negatives, in that order. With temperature τ = 0.5, compute the InfoNCE loss (natural log). Round to 3 decimals.",
                     "一个锚点和它的正样本及三个负样本的余弦相似度依次为 (@a@, @b@, @c@, @d@)。温度 τ = 0.5，求 InfoNCE 损失（自然对数）。保留 3 位小数。", a=PRACT_S[0], b=PRACT_S[1], c=PRACT_S[2], d=PRACT_S[3]),
                   round(PRACT_L, 3),
                   T("Exponentials of $s/0.5$: $e^{1.2}, e^{0.8}, e^{0.4}, e^{0}$ = 3.320, 2.226, 1.492, 1. Sum 8.037. $p_0 = 3.320/8.037 = 0.413$; loss $= -\\ln 0.413 = 0.884$.", "$s/0.5$ 的指数：$e^{1.2}, e^{0.8}, e^{0.4}, e^{0}$ = 3.320、2.226、1.492、1，和 8.037。$p_0 = 3.320/8.037 = 0.413$；损失 $= -\\ln 0.413 = 0.884$。"),
                   tolerance=0.01),
            choice('p-tau', T('Lowering the temperature', '降低温度'), NC,
                   T('In the InfoNCE loss, what is the main effect of making the temperature τ much smaller?', '在 InfoNCE 损失中，把温度 τ 调得很小，主要效果是什么？'),
                   [(T('All negatives are weighted equally', '所有负样本权重相等'), T("That is the large-τ limit, where softmax is flat.", "那是 τ 很大时的极限，softmax 趋平。")),
                    (T('The positive pair is pulled together less', '正样本对被拉近的力度变小'), T("The pull on the positive is $(1-p_0)/\\tau$; it does not weaken because τ is small.", "对正样本的拉力是 $(1-p_0)/\\tau$，不会因 τ 小而变弱。")),
                    (T('The gradient concentrates on the hardest negatives, which also makes false negatives hurt more', '梯度集中在最难的负样本上，因此假负样本的伤害也更大'), True),
                    (T('The loss becomes independent of the negatives', '损失变得与负样本无关'), T("The negatives stay in the denominator; only the *hardest* ones dominate it.", "负样本仍在分母里，只是*最难*的那些占了主导。"))],
                   T("A small τ makes softmax nearly an argmax: the push goes to the most similar negative, which may really be a same-class instance.", "τ 小则 softmax 接近 argmax：推力给了最相似的负样本，而它很可能其实是同类样本。")),
            choice('p-ntp', T('Why next-token prediction is self-supervised', '为什么下一词预测属于自监督'), LM,
                   T('Why is training a GPT-style model on raw text called self-supervised?', '为什么在原始文本上训练 GPT 类模型称为自监督？'),
                   [(T('Annotators write the next word for each context', '标注员为每个上下文写出下一个词'), T("No annotator is involved; the text already contains the next word.", "没有标注员；文本里本来就有下一个词。")),
                    (T('The model labels its own outputs and learns from them', '模型给自己的输出打标签再学习'), T("That is self-training (semi-supervised). Here the target is the real next token in the data, not the model's guess.", "那是自训练（半监督）。这里的目标是数据里真实的下一个词元，不是模型的猜测。")),
                    (T('It is unsupervised: there is no loss function', '它是无监督：没有损失函数'), T("There is a loss: cross-entropy with the true next token.", "有损失：与真实下一词元的交叉熵。")),
                    (T('The target (the next token) is taken from the data itself, so no human labels are needed', '目标（下一个词元）取自数据本身，不需要人工标注'), True)],
                   T("Every position of every text is a free (context, next word) example.", "每段文本的每个位置都是一个免费的（上下文，下一个词）样本。")),
            number('p-topp', T('Top-p sampling', 'top-p 采样'), TF,
                   T("After 'the cat sat on the' the model gives: mat 0.45, floor 0.25, sofa 0.15, roof 0.10, moon 0.05. With top-p sampling, p = 0.8, what is the probability of 'mat' after renormalising? Round to 3 decimals.",
                     "“the cat sat on the”之后模型给出：mat 0.45、floor 0.25、sofa 0.15、roof 0.10、moon 0.05。用 p = 0.8 的 top-p 采样，重新归一化后 mat 的概率是多少？保留 3 位小数。"),
                   round(TOPP_NORM[0], 3),
                   T("Cumulative: 0.45, 0.70, 0.85. The smallest set exceeding 0.8 is {mat, floor, sofa} (total 0.85). Renormalise: 0.45 / 0.85 = 0.529.", "累计：0.45、0.70、0.85。超过 0.8 的最小集合是 {mat, floor, sofa}（总和 0.85）。重新归一化：0.45 / 0.85 = 0.529。"),
                   tolerance=0.002),
            text_q('p-compare', T('SSL vs unsupervised vs semi-supervised', 'SSL 对比无监督、半监督'), SK,
                   T('In 2-3 lines: how does self-supervised learning differ from unsupervised and from semi-supervised learning?', '用 2-3 行回答：自监督学习与无监督、半监督有什么区别？'),
                   ['Self-supervised builds a target (label) from the data itself and trains with a loss, like supervised learning', 'Unsupervised has no target: it finds structure (clusters, density)', 'Semi-supervised uses a few human labels together with many unlabelled instances in one training', 'Self-supervised pre-trains a representation on unlabelled data, then a few labels are used for the downstream task'],
                   'Self-supervised learning creates its own labels from the data (e.g. a masked word or the next token) and trains with a normal loss, aiming at a representation that is reused later with a few labels. Unsupervised learning has no target at all and just finds structure such as clusters. Semi-supervised learning mixes a few human labels with many unlabelled instances in a single training procedure.',
                   T("Marking: the target comes from the data (SSL) vs no target (unsupervised) vs few human labels used together with unlabelled data (semi).", "评分点：目标来自数据（SSL）、没有目标（无监督）、少量人工标签与无标注数据一起用（半监督）。")),
            text_q('p-design', T('Design: X-rays with few labels (Section C style)', '设计题：标注很少的 X 光片（C 部分风格）'), PR,
                   T("A hospital has 2 million unlabelled chest X-rays and only 300 with a diagnosis label. Design a self-supervised approach to build a diagnosis classifier. Say which pretext task and augmentations you would use, what you freeze, how you evaluate, and one risk.", "一家医院有 200 万张无标注胸片，只有 300 张有诊断标签。设计一个自监督方案来建诊断分类器。说明用什么前置任务和增强、冻结什么、怎么评估，以及一个风险。"),
                   ['Pretext on the 2M unlabelled images: masked patch reconstruction or contrastive learning with augmentations', 'Augmentations chosen so that diagnostic information survives (small crops, mild brightness/contrast; not strong colour or flips that change anatomy)', 'Pre-train the encoder, freeze it, train a small classifier head on the 300 labels (linear probe), optionally fine-tune with a small learning rate', 'Evaluate on a held-out labelled set from other patients / hospitals, compare with training from scratch on the 300 labels', 'Risk: shortcut (scanner or text markers learned), augmentation removing the sign, or bias of the data'],
                   'Pre-train an encoder on the 2M unlabelled X-rays, either by reconstructing masked patches or contrastively (two augmented views of one X-ray are a positive pair, other patients are negatives). I would use mild augmentations (small crops, brightness and contrast jitter) so that the diagnostic signs survive, and avoid ones that change anatomy. Then freeze the encoder and train a small classifier head on the 300 labels (a linear probe), perhaps fine-tuning later with a small learning rate. I would evaluate on a held-out labelled set from different patients or hospitals and compare with a model trained from scratch on the 300 labels. Main risk: the encoder learns shortcuts such as scanner artefacts or text markers, or the pre-training data is biased towards one hospital.',
                   T("A strong answer links each choice to the pipeline: pretext, augmentation as bias, frozen encoder plus head, fair evaluation, risk.", "好答案把每个选择对应到流程：前置任务、作为偏置的增强、冻结编码器加小头、公平评估、风险。")),
            read('remember', T('What to remember', '要记住的'),
                 ul(T("**SSL:** make labels from the data (hide, corrupt, relate, next word); stage 1 pretext on unlabelled data → encoder; stage 2 frozen encoder + small head on few labels (or fine-tune).", "**SSL：** 用数据自己造标签（遮挡、破坏、关系、下一个词）；第一阶段在无标注数据上做前置任务 → 编码器；第二阶段冻结编码器加小头，用少量标签（或微调）。"),
                    T("**Three families:** masked prediction, contrastive (same/different), autoregressive (next token).", "**三类：** 遮挡预测、对比（相同/不同）、自回归（下一词）。"),
                    T("**vs others:** unsupervised has no target; semi-supervised mixes few labels with unlabelled data in one training; active asks a human for labels.", "**对比：** 无监督没有目标；半监督在一次训练里混用少量标签和无标注数据；主动学习向人要标签。")),
                 math_(r"\mathcal{L} = -\ln\frac{e^{s_0/\tau}}{\sum_{j=0}^{K} e^{s_j/\tau}}, \quad \frac{\partial\mathcal{L}}{\partial s_0} = -\frac{1-p_0}{\tau}, \quad \frac{\partial\mathcal{L}}{\partial s_k} = \frac{p_k}{\tau}"),
                 ul(T("Numerator pulls the positive, denominator pushes everything; low τ focuses on hard (and false) negatives; $\\mathcal{L} = \\ln(K+1)$ at no discrimination.", "分子拉正样本，分母推所有；τ 低则聚焦难（和假）负样本；毫无区分时 $\\mathcal{L} = \\ln(K+1)$。"),
                    T("**Next-token loss** $= -\\sum_t \\ln p(x_t \\mid x_{<t})$: self-supervised, MLE of the text.", "**下一词损失** $= -\\sum_t \\ln p(x_t \\mid x_{<t})$：自监督，文本的极大似然。"),
                    T("**Transformer:** positional encoding (order) + attention softmax(q·k/√d) mixing values (relations) + unembedding + softmax; decode by greedy / top-k / top-p until eos.", "**Transformer：** 位置编码（顺序）+ 注意力 softmax(q·k/√d) 混合值（关系）+ 反嵌入 + softmax；用贪心/top-k/top-p 解码直到 eos。"),
                    T("**LLM:** pre-train (self-supervised) then fine-tune / align (prompt-tuning, RLHF, adapters).", "**大模型：** 预训练（自监督）再微调/对齐（提示调优、RLHF、适配器）。"))),
        ])


# ================================================================ LESSON 2: bias and fairness
# The deck's credit example (slides 27, 29, 31): 12 martians (6 creditworthy) and 18 humans (6 creditworthy), and
# three sets of "granted credit" predictions, each tuned to one criterion. Counts are read off the slide figures.
POP = {'m': dict(n=12, pos=6), 'h': dict(n=18, pos=6)}
SCEN = {  # group -> (TP, FP)
    'dp': {'m': (1, 3), 'h': (5, 1)},
    'pp': {'m': (2, 2), 'h': (3, 3)},
    'eo': {'m': (4, 1), 'h': (4, 1)},
}


def cm(group, scen):
    tp, fp = SCEN[scen][group]
    n, pos = POP[group]['n'], POP[group]['pos']
    return dict(tp=tp, fp=fp, fn=pos - tp, tn=n - pos - fp, n=n, pos=pos)


def rates(c):
    pred = c['tp'] + c['fp']
    return dict(sel=pred / c['n'], tpr=c['tp'] / c['pos'], fpr=c['fp'] / (c['n'] - c['pos']), ppv=c['tp'] / pred, acc=(c['tp'] + c['tn']) / c['n'])


R = {s: {g: rates(cm(g, s)) for g in 'mh'} for s in SCEN}
ACC_ALL = {s: sum(cm(g, s)['tp'] + cm(g, s)['tn'] for g in 'mh') / 30 for s in SCEN}


def frac(a, b):
    return f'{a}/{b}'


# the impossibility example
PA, PB = 0.5, 0.2
TPR0, FPR0 = 0.8, 0.2


def ppv_of(p, tpr, fpr):
    return tpr * p / (tpr * p + fpr * (1 - p))


def fpr_for(p, ppv, tpr):
    return p / (1 - p) * (1 - ppv) / ppv * tpr


PPV_A0, PPV_B0 = ppv_of(PA, TPR0, FPR0), ppv_of(PB, TPR0, FPR0)
FPR_B1 = fpr_for(PB, PPV_A0, TPR0)
PPV_B1 = ppv_of(PB, TPR0, FPR_B1)

# fairness through unawareness: the classifier sees only the postcode Z
P_M = 0.3
P_Z1 = {'m': 0.8, 'h': 0.2}   # P(Z = 1 | A)
Y_Z = {1: 0.3, 2: 0.7}        # historical approval rate by postcode (what the model learns from X = Z)
P_Z1_all = P_M * P_Z1['m'] + (1 - P_M) * P_Z1['h']
P_M_given_Z1 = P_M * P_Z1['m'] / P_Z1_all
SEL_M = 1 - P_Z1['m']          # approved if Z = 2 (0.7 > 0.5)
SEL_H = 1 - P_Z1['h']

# reweighing on the deck's 30 applicants
CELLS = {(g, y): (POP[g]['pos'] if y == 1 else POP[g]['n'] - POP[g]['pos']) for g in 'mh' for y in (1, 0)}
D = 30
P_A = {g: POP[g]['n'] / D for g in 'mh'}
P_Y1 = sum(POP[g]['pos'] for g in 'mh') / D
W = {(g, y): P_A[g] * (P_Y1 if y == 1 else 1 - P_Y1) / (CELLS[(g, y)] / D) for g in 'mh' for y in (1, 0)}
WPOS = {g: W[(g, 1)] * CELLS[(g, 1)] / (W[(g, 1)] * CELLS[(g, 1)] + W[(g, 0)] * CELLS[(g, 0)]) for g in 'mh'}

# post-processing: group-specific thresholds
SCORES = dict(
    m=dict(pos=[.9, .8, .6, .45, .4, .3], neg=[.7, .5, .35, .25, .2, .1]),
    h=dict(pos=[.95, .85, .75, .65, .55, .35], neg=[.6, .5, .45, .4, .3, .3, .25, .2, .15, .1, .1, .05]),
)


def thr_stats(g, t):
    P, N = SCORES[g]['pos'], SCORES[g]['neg']
    tp, fp = sum(x >= t for x in P), sum(x >= t for x in N)
    return dict(tpr=tp / len(P), fpr=fp / len(N), acc=(tp + len(N) - fp) / (len(P) + len(N)), n=len(P) + len(N), tp=tp, fp=fp)


T_SINGLE = {g: thr_stats(g, 0.5) for g in 'mh'}
T_GROUP = {'m': thr_stats('m', 0.4), 'h': thr_stats('h', 0.5)}
ACC_SINGLE = sum(T_SINGLE[g]['acc'] * T_SINGLE[g]['n'] for g in 'mh') / 30
ACC_GROUP = sum(T_GROUP[g]['acc'] * T_GROUP[g]['n'] for g in 'mh') / 30

# evaluation-bias example
EV = [(900, 0.95), (100, 0.70)]
EV_ALL = sum(n * a for n, a in EV) / sum(n for n, _ in EV)

# practice numbers
PX = dict(a=dict(tp=45, fn=15, fp=20, tn=120), b=dict(tp=24, fn=16, fp=10, tn=50))
PX_TPR = {k: v['tp'] / (v['tp'] + v['fn']) for k, v in PX.items()}
PX_GAP = abs(PX_TPR['a'] - PX_TPR['b'])


def fig_bias_pipeline(lang):
    g = Fig(700, 340, lang)
    L = g.L
    xs = [10, 200, 390, 580]
    names = [L('World', '现实世界'), L('Data', '数据'), L('Model', '模型'), L('Individuals', '个人')]
    for x, nm in zip(xs, names):
        g.rect(x, 170, 110, 60, SOFT, INK, 2)
        g.text(x + 55, 207, nm, 18, INK, 'middle', 'bold')
    for i, lab in enumerate((L('measure', '采集'), L('learn', '学习'), L('action', '决策'))):
        g.line(xs[i] + 112, 200, xs[i + 1] - 2, 200, INK, 2.5, arrow=True)
        g.text((xs[i] + xs[i + 1] + 110) / 2, 192, lab, 15, MUTED, 'middle')
    g.line(635, 232, 635, 290, ORANGE, 2.5)
    g.line(635, 290, 255, 290, ORANGE, 2.5)
    g.line(255, 290, 255, 234, ORANGE, 2.5, arrow=True)
    g.text(445, 316, L('feedback loop', '反馈回路'), 16, ORANGE, 'middle')
    tags = {1: [L('historical', '历史偏差'), L('representation', '代表性偏差'), L('measurement', '测量偏差')],
            2: [L('model fit', '模型拟合'), L('loss function', '损失函数')],
            3: [L('evaluation', '评估偏差'), L('deployment', '部署偏差')]}
    for i, items in tags.items():
        for r, t in enumerate(items):
            y = 128 - r * 38
            g.rect(xs[i] - 6, y - 22, 122, 30, '#fff1e8', ORANGE, 1.6, rx=8)
            g.text(xs[i] + 55, y - 1, t, 15, INK, 'middle')
    return g.svg()


def fig_conflict(lang):
    g = Fig(700, 340, lang)
    L = g.L
    base, hmax = 270, 190

    def panel(x0, title, vals):
        g.text(x0 + 150, 30, title, 17, INK, 'middle', 'bold')
        for k, (nm, a, b) in enumerate(vals):
            xa = x0 + 14 + k * 98
            for dx, v, col in ((0, a, BLUE), (38, b, ORANGE)):
                hh = max(v * hmax, 1.5)
                g.rect(xa + dx, base - hh, 32, hh, col, None, rx=3)
                g.text(xa + dx + 16, base - hh - 7, f'{v:.2f}', 14, INK, 'middle')
            g.text(xa + 35, base + 22, nm, 16, INK, 'middle')
        g.line(x0, base, x0 + 305, base, INK, 1.6)

    panel(20, L('Equal error rates', '错误率相等'), [('TPR', TPR0, TPR0), ('FPR', FPR0, FPR0), ('PPV', PPV_A0, PPV_B0)])
    panel(370, L('Equal PPV', 'PPV 相等'), [('TPR', TPR0, TPR0), ('FPR', FPR0, FPR_B1), ('PPV', PPV_A0, PPV_B1)])
    g.rect(20, 306, 14, 14, BLUE, None, rx=2)
    g.text(40, 319, L(f'group A (base rate {PA:g})', f'群体 A（基础率 {PA:g}）'), 15, INK)
    g.rect(300, 306, 14, 14, ORANGE, None, rx=2)
    g.text(320, 319, L(f'group B (base rate {PB:g})', f'群体 B（基础率 {PB:g}）'), 15, INK)
    return g.svg()


def L_fairness():
    SRC = 'fairness.sources'
    UNAW = 'fairness.unawareness'
    CRIT = 'fairness.criteria'
    CONF = 'fairness.conflict'
    MIT = 'fairness.mitigation'
    mt = lambda g, s: cm(g, s)  # noqa: E731
    return dict(
        id=lid('fairness'),
        title=T('Bias and fairness: where it comes from, how to measure it, what to do', '偏差与公平：从哪来、怎么量、怎么办'),
        description=T('Sources of bias along the ML pipeline, why removing the sensitive attribute is not enough, the group fairness criteria computed from confusion matrices, why they cannot all hold when base rates differ, and mitigation before, during and after training.',
                      '机器学习流程中偏差的来源，为什么去掉敏感属性不够，用混淆矩阵算各个群体公平准则，为什么基础率不同时它们不能同时成立，以及训练前、中、后的缓解办法。'),
        minutes=45,
        skills=[{'id': SRC, 'name': T('Sources of bias', '偏差的来源')},
                {'id': UNAW, 'name': T('Fairness through unawareness and proxies', '“不知道敏感属性”式公平与代理变量')},
                {'id': CRIT, 'name': T('Fairness criteria from confusion matrices', '用混淆矩阵计算公平准则')},
                {'id': CONF, 'name': T('Why fairness criteria conflict', '公平准则为什么冲突')},
                {'id': MIT, 'name': T('Mitigation: pre-, in-, post-processing', '缓解：预处理、训练中、后处理')}],
        misconceptions=[{'id': 'remove-A', 'description': T('Believing that deleting the sensitive attribute makes a model fair', '以为删掉敏感属性模型就公平')},
                        {'id': 'one-fairness', 'description': T('Thinking there is one correct fairness criterion that all classifiers can satisfy', '以为存在一个所有分类器都能满足的“唯一正确”公平准则')},
                        {'id': 'acc-is-fair', 'description': T('Judging a model by overall accuracy only', '只看总体准确率来评价模型')},
                        {'id': 'dp-uses-y', 'description': T('Forgetting that demographic parity ignores the true label Y', '忘了人口统计均等不看真实标签 Y')}],
        steps=[
            read('why', T('ML in the world: what can go wrong', '机器学习落地：会出什么问题'),
                 p(T("ML is used for medical diagnosis, language generation, hate-speech detection, stock prediction, insurance suggestions, spam and malware detection, predictive policing, and in the legal domain. The lecture opens with a 'quick (and biased) press review' of headlines, about: an AI tool with dual-use risk (2024); Uber and Amazon paying different wages for the same work through AI (2023); a Dutch court ruling that a welfare surveillance system violates human rights (2020); and police facial recognition that cannot tell Black people apart. The question is always: *what can possibly go wrong?*",
                     "机器学习被用在医疗诊断、语言生成、仇恨言论检测、股市预测、保险推荐、垃圾邮件/恶意软件检测、预测性警务和法律领域。讲义开头是一段“快速（且有偏）的新闻回顾”，标题大致是：一个有双重用途风险的 AI 工具（2024）；Uber 和 Amazon 用 AI 对同样的工作付不同的工资（2023）；荷兰法院裁定福利监控系统违反人权（2020）；警方人脸识别分不清黑人。问题永远是：*会出什么问题？*")),
                 callout('note', T('A case study: Amazon same-day delivery (lecture)', '案例：Amazon 当日达（讲义）'),
                         T("Amazon trained a model to decide which zip codes get same-day delivery, with the goal of minimising cost and maximising efficiency. No one asked it to discriminate, but the served areas turned out to follow income. Then a **feedback loop** starts: lower-income areas order less, so they get no same-day service, so they order even less, so they get even less priority.",
                           "Amazon 训练了一个模型来决定哪些邮编提供当日达，目标是降低成本、提高效率。没人要它歧视，但被服务的区域却跟收入走。随后出现**反馈回路**：低收入区下单少，所以没有当日达，于是下单更少，优先级更低。")),
                 chapter=T('Where bias comes from', '偏差从哪来')),
            read('humans-data', T('Bias in humans and in data', '人的偏差与数据的偏差'),
                 p(T("Models learn from data made by people, so human biases arrive twice: in the world the data records, and in how it is collected.", "模型从人造的数据里学，所以人的偏差来两次：一次在数据所记录的世界里，一次在数据的收集方式里。")),
                 table([T('Source', '来源'), T('What it is', '是什么'), T('Example (lecture)', '例子（讲义）'), T('What to do', '怎么办')],
                       [T('Human: out-group homogeneity', '人：外群体同质性'), T('seeing out-group members as less nuanced than our own', '觉得外群体成员比自己人单调'), T('stereotypes, prejudice', '刻板印象、偏见'), '—'],
                       [T('Human: correlation fallacy', '人：相关性谬误'), T('mistaking co-occurrence for causation', '把同时出现当成因果'), T('chocolate consumption and Nobel laureates', '巧克力消费与诺贝尔奖得主'), '—'],
                       [T('Historical bias', '历史偏差'), T('even a random sample reflects the world as it was, with its biases we do not want to carry forward', '哪怕随机抽样也反映过去的世界，连同我们不想延续的偏见'), T('image search for "professor" vs "nurse"', '搜“professor”和“nurse”的图片'), T('Know your domain', '了解你的领域')],
                       [T('Representation / reporting bias', '代表性/报告偏差'), T('data does not represent the whole population: minorities under-represented; obvious facts under-reported, anomalies and positive results over-reported', '数据不能代表全体：少数群体不足；显而易见的事实少被报告，异常和正面结果被过度报告'), T('Gordon & Van Durme (2013)', 'Gordon 与 Van Durme (2013) 的论文'), T('Represent all groups fairly', '公平地代表所有群体')],
                       [T('Measurement bias', '测量偏差'), T('(1) noisy measurement that is not random across groups; (2) a noisy proxy taken for the label of interest; (3) oversimplifying the quantity', '(1) 噪声不是随机地分布在各群体间；(2) 把带噪的代理当成真正关心的标签；(3) 把量过度简化'), T('arrest records more detailed in some postcodes; "hiring decision" as a proxy for "applicant quality"; politics as Democrat vs Republican only', '各邮编逮捕记录详略不一；用“录用决定”代替“申请人质量”；把政治倾向只分成民主党/共和党'), T('Know your task', '了解你的任务')]),
                 skill=SRC),
            read('model-eval', T('Bias in models, evaluation and deployment', '模型、评估与部署中的偏差'),
                 svg(drawn(fig_bias_pipeline), T('The ML pipeline: world, data, model, individuals, with a feedback loop; orange tags show where each kind of bias enters.', '机器学习流程：现实世界、数据、模型、个人，加上反馈回路；橙色标签表示各种偏差在哪里进入。')),
                 table([T('Where', '位置'), T('Bias', '偏差'), T('Remedy (lecture)', '对策（讲义）')],
                       [T('Model', '模型'), T('**Model fit:** weak models have high bias; unjustified assumptions', '**模型拟合：** 弱模型偏差大；不合理的假设'), T('carefully consider model assumptions; model groups separately', '仔细考虑模型假设；对各群体分别建模')],
                       [T('Model', '模型'), T('**Biased loss:** 0/1 loss tolerates errors in the minority class on highly imbalanced data', '**有偏的损失：** 数据高度不平衡时，0/1 损失容忍少数类的错误'), T('carefully choose loss functions', '仔细选择损失函数')],
                       [T('Evaluation', '评估'), T('test set unrepresentative; overfitting to a popular benchmark; a metric that hides minorities (high accuracy though non-Caucasian faces are missed)', '测试集不具代表性；对热门基准过拟合；掩盖少数群体的指标（准确率高，但认不出非白人面孔）'), T('choose metrics and test sets carefully; use several metrics', '仔细选指标和测试集；用多个指标')],
                       [T('Deployment', '部署'), T('a system used in ways it was not intended for; end-users not educated', '系统被用于设计之外的用途；使用者没有被教育'), '—']),
                 quiz(T(f"A model is {EV[0][1]:.0%} accurate on a majority group of {EV[0][0]} people and {EV[1][1]:.0%} on a minority group of {EV[1][0]}. What is the overall accuracy, and what does it hide?", f"一个模型在 {EV[0][0]} 人的多数群体上准确率 {EV[0][1]:.0%}，在 {EV[1][0]} 人的少数群体上 {EV[1][1]:.0%}。总体准确率是多少，它掩盖了什么？"),
                      [(T(f'{(EV[0][1] + EV[1][1]) / 2:.1%}, the average of the two', f'{(EV[0][1] + EV[1][1]) / 2:.1%}，两个准确率的平均'), T("The groups have different sizes, so the overall accuracy is the size-weighted average, not the plain mean.", "两个群体大小不同，总体准确率是按人数加权的平均，不是简单平均。")),
                       (T(f'{EV_ALL:.1%}; the 25-point gap for the minority is invisible in it', f'{EV_ALL:.1%}；少数群体 25 个百分点的差距在其中看不出来'), True),
                       (T(f'{EV[1][1]:.0%}, the worst group decides', f'{EV[1][1]:.0%}，由最差的群体决定'), T("Overall accuracy is not the minimum; it is dominated by the larger group.", "总体准确率不是最小值，而是被大群体主导。"))],
                      T(f"(900 × 0.95 + 100 × 0.70) / 1000 = {EV_ALL:.3f}. A single average hides how much worse the model is for the small group: this is **evaluation bias**, so report metrics per group.", f"(900 × 0.95 + 100 × 0.70) / 1000 = {EV_ALL:.3f}。一个平均数掩盖了小群体上模型差多少：这就是**评估偏差**，所以要按群体分别报告指标。")),
                 skill=SRC),
            read('notation', T('Sensitive attributes and the metrics we will use', '敏感属性与要用到的指标'),
                 p(T("Notation: **X** the non-sensitive features, **A** the sensitive attribute with discrete values (male/female, old/young, ...), **Y** the true label, **Ŷ** the predicted label. The groups are the values of A. It is rarely clear which attributes are sensitive, and the choice matters a lot.", "记号：**X** 非敏感特征，**A** 取离散值的敏感属性（男/女、老/少……），**Y** 真实标签，**Ŷ** 预测标签。群体就是 A 的各个取值。哪些属性算敏感往往不明确，而这个选择影响很大。")),
                 table(['', T('Ŷ = 1', 'Ŷ = 1'), T('Ŷ = 0', 'Ŷ = 0')],
                       [T('Y = 1', 'Y = 1'), T('TP', '真阳性 TP'), T('FN', '假阴性 FN')],
                       [T('Y = 0', 'Y = 0'), T('FP', '假阳性 FP'), T('TN', '真阴性 TN')]),
                 math_(r"\text{PPV} = \frac{TP}{TP+FP}, \qquad \text{TPR} = \frac{TP}{TP+FN}, \qquad \text{FNR} = \frac{FN}{TP+FN} = 1-\text{TPR}, \qquad \text{FPR} = \frac{FP}{FP+TN}"),
                 p(T("**The running example** (lecture): a bank classifier decides *grant credit / no credit*. Features: credit history, job, wealth. The protected attribute is the applicant's species: **martians** (minority) or **humans** (majority). Fairness means making fair decisions for both. For fairness criteria we compute these metrics **separately for each group** and compare.", "**贯穿的例子**（讲义）：银行分类器决定*批/不批信贷*。特征：信用记录、工作、财富。受保护属性是申请人的物种：**火星人**（少数）或**人类**（多数）。公平就是对两类人都做出公平的决定。公平准则要求把这些指标**按群体分别算**再比较。")),
                 skill=CRIT),
            derive('unaware', T('Fairness through unawareness fails: proxies', '“不看敏感属性”为什么行不通：代理变量'),
                   [(r"P(\hat{Y}_n \mid X_n, A_n) \approx P(\hat{Y}_n \mid X_n)",
                     T("**Fairness through unawareness:** hide the sensitive features, train on $X$ only and remove $A$. The hope: if $A$ is not an input it cannot matter.", "**“不看敏感属性”式公平：** 把敏感特征藏起来，只用 $X$ 训练、去掉 $A$。希望：$A$ 不是输入，就不会有影响。")),
                    (r"P(Z{=}1 \mid A{=}m) = 0.8, \quad P(Z{=}1 \mid A{=}h) = 0.2, \quad P(A{=}m) = 0.3",
                     T("But $X$ may be correlated with $A$. Say the only feature is the postcode $Z$ (1 or 2), and martians mostly live in postcode 1 (the lecture's hint: schools and education on Mars differ from Earth's). 30% of applicants are martians.", "但 $X$ 可能和 $A$ 相关。设唯一的特征是邮编 $Z$（1 或 2），火星人大多住在邮编 1（讲义的提示：火星的学校和教育水平与地球不同）。30% 的申请人是火星人。")),
                    (S(r"P(A{=}m \mid Z{=}1) = \frac{0.3 \cdot 0.8}{0.3 \cdot 0.8 + 0.7 \cdot 0.2} = @a@", '', a=f(P_M_given_Z1))['en'],
                     T("Bayes: the postcode *reveals* the group. Knowing $Z = 1$ makes 'martian' about 63% likely, against a 30% prior. $A$ is redundantly encoded in $X$: $Z$ is a **proxy**.", "贝叶斯：邮编*暴露*了群体。知道 $Z=1$，“火星人”的可能性约 63%，先验只有 30%。$A$ 被冗余地编码在 $X$ 里：$Z$ 是一个**代理变量 (proxy)**。")),
                    (r"P(Y{=}1 \mid Z{=}1) = 0.3, \quad P(Y{=}1 \mid Z{=}2) = 0.7",
                     T("Historical bias: in the training data, applicants from postcode 1 were approved less often. A model with only $Z$ learns exactly this, and predicts 'grant' for postcode 2 only (0.7 > 0.5).", "历史偏差：训练数据里，邮编 1 的申请人被批准得少。只用 $Z$ 的模型恰好学到这点，只对邮编 2 预测“批”（0.7 > 0.5）。")),
                    (S(r"\big(P(\hat{Y}{=}1 \mid m),\ P(\hat{Y}{=}1 \mid h)\big) = (@m@,\ @h@) \ ", '', m=f(SEL_M, 1), h=f(SEL_H, 1))['en'],
                     T("The grant rate by group: the model never saw $A$, yet martians get credit 20% of the time and humans 80%: a **four-fold gap**. Unawareness made no difference to the outcome.", "各群体的批准率：模型从没见过 $A$，可火星人只有 20% 获批，人类 80%：差了**四倍**。“不知道”对结果毫无改善。"))],
                   blank=(2, '0.3*0.8/(0.3*0.8+0.7*0.2)', T("Write $P(A{=}m \\mid Z{=}1)$ with Bayes' rule from the numbers above.", "用贝叶斯公式和上面的数字写出 $P(A{=}m \\mid Z{=}1)$。")),
                   outro=T("So hiding $A$ is not enough: remove it *and* every proxy and you often lose the useful features too. Fairness has to be **measured** with $A$ in hand, which is what the criteria do. Note that fairness *through awareness* uses $A$ to check and correct.", "所以光藏起 $A$ 不够：把它*和*所有代理变量都删掉，往往有用的特征也没了。公平必须在手里有 $A$ 的情况下去**度量**，这就是各种准则做的事。注意“通过知道来公平 (fairness through awareness)”正是用 $A$ 来检查和纠正。"),
                   skill=UNAW),
            read('criteria', T('The four fairness criteria', '四个公平准则'),
                 table([T('Criterion', '准则'), T('Condition', '条件'), T('Equalises', '要求相等的量'), T('Use when', '适用于'), T('Limitation', '局限')],
                       [T('**Group fairness / demographic parity** (independence)', '**群体公平 / 人口统计均等**（独立性）'), r'$\hat{Y} \perp A$: $P(\hat{Y}{=}1 \mid A{=}m) = P(\hat{Y}{=}1 \mid A{=}h)$', T('the rate of positive decisions', '给出正向决定的比率'), T('representation matters', '代表性重要时'), T('ignores Y: may grant the right people in one group and wrong ones in the other; can harm the minority\'s reputation', '不看 Y：可能在一个群体里批对的人，在另一个里批错的人；可能伤害少数群体的声誉')],
                       [T('**Predictive parity** (sufficiency)', '**预测均等**（充分性）'), r'$P(Y{=}1 \mid \hat{Y}{=}1, A{=}m) = P(Y{=}1 \mid \hat{Y}{=}1, A{=}h)$', T('PPV (precision)', 'PPV（精确率）'), T('the score itself matters: it should mean the same across groups', '分数本身重要：它在各群体里应有同样含义'), T('takes Y into account, but accepts and amplifies unfairness in the ground truth', '用到了 Y，但接受并放大真实标签里已有的不公平')],
                       [T('**Equal opportunity** (part of separation)', '**机会均等**（分离性的一半）'), T(r'$P(\hat{Y}{=}0 \mid Y{=}1, A{=}m) = P(\hat{Y}{=}0 \mid Y{=}1, A{=}h)$, i.e. equal FNR (and TPR)', r'$P(\hat{Y}{=}0 \mid Y{=}1, A{=}m) = P(\hat{Y}{=}0 \mid Y{=}1, A{=}h)$，即 FNR（和 TPR）相等'), T('FNR / TPR', 'FNR / TPR'), T("you do not want to miss a qualified person", "不想漏掉任何一个合格的人"), T('same limitation as predictive parity', '局限同预测均等')],
                       [T('**Individual fairness**', '**个体公平**'), r'$P(\hat{Y}_i{=}1 \mid A_i, X_i) \approx P(\hat{Y}_j{=}1 \mid A_j, X_j)$ if $s(X_i, X_j) > \theta$', T('scores of similar individuals', '相似个体的得分'), T('you can define similarity of people', '能定义人与人的相似度时'), T('needs a similarity function sim() (often non-trivial) and a threshold θ', '需要相似度函数 sim()（常常很难定）和阈值 θ')]),
                 callout('note', T('Beyond the deck (textbook)', '讲义之外（教科书内容）'),
                         T("The textbook names the three families: **independence** ($\\hat{Y} \\perp A$, demographic parity), **separation** ($\\hat{Y} \\perp A \\mid Y$: equal TPR *and* equal FPR, called **equalised odds**; equal opportunity is its TPR half) and **sufficiency** ($Y \\perp A \\mid \\hat{Y}$: equal PPV and equal NPV; predictive parity is its PPV half). The conflict result in a later page is about these.",
                           "教科书把它们分成三类：**独立性**（$\\hat{Y} \\perp A$，人口统计均等）、**分离性**（$\\hat{Y} \\perp A \\mid Y$：TPR *和* FPR 都相等，称**均等化赔率 (equalised odds)**；机会均等是它的 TPR 一半）、**充分性**（$Y \\perp A \\mid \\hat{Y}$：PPV 和 NPV 都相等；预测均等是它的 PPV 一半）。后面的冲突结论讲的就是这些。")),
                 skill=CRIT, chapter=T('Measuring fairness', '度量公平')),
            derive('example', T('Worked example: the credit classifier, three ways', '算例：信贷分类器，三种预测'),
                   [(r"p_m = \frac{6}{12} = 0.50, \qquad p_h = \frac{6}{18} = 0.33",
                     T("The ground truth of the lecture example. Martians (m): 12 applicants, 6 would repay. Humans (h): 18, of whom 6 would repay. So the **base rates** $p$ differ: 0.50 vs 0.33.", "讲义例子的真实情况。火星人 (m)：12 人，6 人会还款。人类 (h)：18 人，其中 6 人会还款。所以**基础率** $p$ 不同：0.50 对 0.33。")),
                    (S(r"m:\ (TP, FP) = (@a@, @b@), \qquad h:\ (TP, FP) = (@c@, @d@)", '', a=mt('m', 'dp')['tp'], b=mt('m', 'dp')['fp'], c=mt('h', 'dp')['tp'], d=mt('h', 'dp')['fp'])['en'],
                     T("The first classifier grants credit to 4 martians (1 truly good, 3 not) and 6 humans (5 good, 1 not). Counting the circles on the slide.", "第一个分类器批给 4 个火星人（1 个真的好，3 个不好）和 6 个人类（5 个好，1 个不好）。数的是讲义图里的圆点。")),
                    (S(r"P(\hat{Y}{=}1 \mid A) = \frac{4}{12} = @a@, \quad \frac{6}{18} = @b@", '', a=f(R['dp']['m']['sel']), b=f(R['dp']['h']['sel']))['en'],
                     T("**Demographic parity**: grant rate per group. Equal (1/3): satisfied.", "**人口统计均等**：各群体的批准率。相等（1/3）：满足。")),
                    (S(r"\text{TPR} = \frac{1}{6} = @a@ \ \text{vs}\ \frac{5}{6} = @b@", '', a=f(R['dp']['m']['tpr']), b=f(R['dp']['h']['tpr']))['en'],
                     T("**Equal opportunity**: of those who would repay, how many are granted? 17% of good martians against 83% of good humans: violated.", "**机会均等**：会还款的人里有多少被批？好火星人 17%，好人类 83%：不满足。")),
                    (S(r"\text{PPV} = \frac{1}{4} = @a@ \ \text{vs}\ \frac{5}{6} = @b@", '', a=f(R['dp']['m']['ppv']), b=f(R['dp']['h']['ppv']))['en'],
                     T("**Predictive parity**: of those granted, how many are good? 25% of granted martians, 83% of granted humans: violated. This is the lecture's warning about demographic parity: it grants the right humans but mostly the wrong martians 'without any penalty', which also damages the minority's reputation.", "**预测均等**：被批的人里有多少是好的？被批火星人 25%，被批人类 83%：不满足。这正是讲义对人口统计均等的警告：批对了人类，却大多批错了火星人，而“毫无惩罚”，还会损害少数群体的声誉。"))],
                   blank=(2, '4/12', T("Write the martians' grant rate $P(\\hat{Y}{=}1 \\mid A{=}m)$ as a fraction.", "把火星人的批准率 $P(\\hat{Y}{=}1 \\mid A{=}m)$ 写成分数。")),
                   intro=T("Take the lecture's example, with its picture turned into counts. Each of the three classifiers is built to satisfy one criterion.", "拿讲义的例子，把它的图变成计数。三个分类器各自被调成满足一个准则。"),
                   skill=CRIT),
            read('example-all', T('The same people, three classifiers: which criterion holds?', '同样的人，三个分类器：哪个准则成立？'),
                 table([T('Classifier', '分类器'), T('Group', '群体'), 'TP', 'FP', 'FN', 'TN', T('grant rate', '批准率'), 'TPR', 'FPR', 'PPV'],
                       *[[nm, T('martians', '火星人') if g == 'm' else T('humans', '人类'), c['tp'], c['fp'], c['fn'], c['tn'], f(r['sel'], 2), f(r['tpr'], 2), f(r['fpr'], 2), f(r['ppv'], 2)]
                         for s, nm in (('dp', T('1 (demographic parity)', '1（人口统计均等）')), ('pp', T('2 (predictive parity)', '2（预测均等）')), ('eo', T('3 (equal opportunity)', '3（机会均等）')))
                         for g in 'mh' for c, r in [(cm(g, s), R[s][g])]]),
                 ul(T(f"**1** equalises the grant rate (0.33 = 0.33) but TPR and PPV are far apart.", f"**1** 批准率相等（0.33 = 0.33），但 TPR 和 PPV 差得很远。"),
                    T(f"**2** has PPV 0.50 = 0.50 (and the same grant rates, 4/12 = 6/18) but TPR is {R['pp']['m']['tpr']:.2f} vs {R['pp']['h']['tpr']:.2f}.", f"**2** PPV 0.50 = 0.50（批准率也同样 4/12 = 6/18），但 TPR 是 {R['pp']['m']['tpr']:.2f} 对 {R['pp']['h']['tpr']:.2f}。"),
                    T(f"**3** has TPR 0.67 = 0.67 but the grant rates differ ({R['eo']['m']['sel']:.2f} vs {R['eo']['h']['sel']:.2f}).", f"**3** TPR 0.67 = 0.67，但批准率不同（{R['eo']['m']['sel']:.2f} 对 {R['eo']['h']['sel']:.2f}）。")),
                 p(T(f"The criteria give *different* verdicts on the same people. Accuracy also differs: {ACC_ALL['dp']:.2f}, {ACC_ALL['pp']:.2f}, {ACC_ALL['eo']:.2f} overall; refusing everyone would already score {18 / 30:.2f}. The lecture's message: **no fair free lunch**.", f"同样的人，几个准则给出*不同*的结论。准确率也不同：整体分别是 {ACC_ALL['dp']:.2f}、{ACC_ALL['pp']:.2f}、{ACC_ALL['eo']:.2f}；全部拒绝也有 {18 / 30:.2f}。讲义的信息：**没有公平的免费午餐**。")),
                 callout('note', T('A hint of what comes next', '后面要讲什么的伏笔'),
                         T("Classifier 3 happens to have equal TPR *and* equal PPV (both 4/5 = 0.80 in its two groups' granted lists), yet its FPR is 0.17 vs 0.08. That is no accident: with different base rates it cannot be otherwise. The next chapter shows why.", "分类器 3 碰巧 TPR *和* PPV 都相等（两个群体被批名单里都是 4/5 = 0.80），但 FPR 是 0.17 对 0.08。这不是巧合：基础率不同时就只能如此。下一章讲为什么。")),
                 skill=CRIT),
            derive('conflict', T('Why the criteria conflict: one identity', '为什么准则会冲突：一个恒等式'),
                   [(r"\text{PPV} = \frac{TP}{TP + FP} = \frac{\text{TPR}\cdot p}{\text{TPR}\cdot p + \text{FPR}\cdot(1-p)}",
                     T("Write PPV with the group's **base rate** $p = P(Y{=}1 \\mid A)$. Out of $N$ people, $Np$ are positive, so $TP = \\text{TPR}\\cdot Np$; $N(1-p)$ are negative, so $FP = \\text{FPR}\\cdot N(1-p)$. $N$ cancels.", "用群体的**基础率** $p = P(Y{=}1 \\mid A)$ 写出 PPV。$N$ 个人里，$Np$ 个正例，所以 $TP = \\text{TPR}\\cdot Np$；$N(1-p)$ 个负例，所以 $FP = \\text{FPR}\\cdot N(1-p)$。$N$ 约掉。")),
                    (r"\frac{1}{\text{PPV}} = 1 + \frac{\text{FPR}}{\text{TPR}}\cdot\frac{1-p}{p}",
                     T("Invert and split the fraction.", "取倒数并拆开分式。")),
                    (r"\frac{1-\text{PPV}}{\text{PPV}} = \frac{\text{FPR}}{\text{TPR}}\cdot\frac{1-p}{p}",
                     T("Subtract 1 from both sides.", "两边减 1。")),
                    (r"\text{FPR} = \frac{p}{1-p}\cdot\frac{1-\text{PPV}}{\text{PPV}}\cdot\text{TPR}",
                     T("Solve for FPR. **This ties the four quantities together** in every group.", "解出 FPR。**这个式子在每个群体里把四个量绑在一起。**")),
                    (r"\text{PPV}_A = \text{PPV}_B,\ \text{TPR}_A = \text{TPR}_B \ \Rightarrow\ \frac{\text{FPR}_A}{\text{FPR}_B} = \frac{p_A/(1-p_A)}{p_B/(1-p_B)}",
                     T("Demand predictive parity **and** equal opportunity in two groups. Then FPR is forced to differ by the ratio of the base-rate odds. If $p_A \\ne p_B$ the FPRs differ, unless FPR is 0 in both (which needs PPV = 1: a perfect classifier) or TPR = 0 (a useless one).", "要求两个群体同时满足预测均等**和**机会均等。那么 FPR 被迫相差基础率赔率之比。只要 $p_A \\ne p_B$，FPR 就不同；除非两边 FPR 都是 0（这要求 PPV = 1：完美分类器）或 TPR = 0（无用的分类器）。"))],
                   blank=(3, 'p/(1-p)*(1-PPV)/PPV*TPR', T("Solve the previous line for FPR.", "把上一行解出 FPR。"), ['PPV', 'TPR']),
                   intro=T("With different base rates, group fairness criteria cannot all hold for an imperfect classifier. Here is the reason, from the definitions of PPV, TPR and FPR.", "基础率不同时，对一个不完美的分类器，各群体公平准则不可能同时成立。下面从 PPV、TPR、FPR 的定义出发说明原因。"),
                   outro=T("This is the **impossibility result** (Kleinberg et al. 2016; Chouldechova 2017; textbook). The same style of argument shows demographic parity and equalised odds conflict too: a perfect classifier has $\\hat{Y} = Y$, so its grant rate equals the base rate and differs between groups.", "这就是**不可能性结果**（Kleinberg 等 2016；Chouldechova 2017；教科书内容）。同样的论证可以说明人口统计均等和均等化赔率也冲突：完美分类器的 $\\hat{Y} = Y$，批准率等于基础率，而基础率在各群体间不同。"),
                   skill=CONF, chapter=T('Deeper: why they conflict', '深入：为什么冲突')),
            read('conflict-numbers', T('The conflict in numbers', '用数字看冲突'),
                 p(S("Two groups with different base rates: group A has 50% positives, group B 20%. Take a classifier with the **same error rates** in both: TPR = 0.8, FPR = 0.2. Per 1000 people:", "两个群体基础率不同：A 有 50% 正例，B 有 20%。取一个两群体**错误率相同**的分类器：TPR = 0.8，FPR = 0.2。每 1000 人：")),
                 table(['', T('positives', '正例'), 'TP', 'FN', T('negatives', '负例'), 'FP', 'TN', 'PPV'],
                       ['A', 500, 400, 100, 500, 100, 400, f(PPV_A0, 2)],
                       ['B', 200, 160, 40, 800, 160, 640, f(PPV_B0, 2)]),
                 p(T(f"Equal TPR and FPR (equalised odds) holds, but PPV is {PPV_A0:.2f} for A and {PPV_B0:.2f} for B: a 'grant' means much less in B, because B has few positives and the same 20% of the many negatives are wrongly granted. To raise B's PPV to {PPV_A0:.2f} while keeping TPR = 0.8, the identity says FPR for B must be {FPR_B1:.2f}: B's FPR is now {FPR_B1:.2f} vs A's {FPR0:.2f}. Predictive parity and equal FPR cannot be had together.",
                     f"TPR、FPR 相等（均等化赔率）成立，但 A 的 PPV 是 {PPV_A0:.2f}，B 只有 {PPV_B0:.2f}：在 B 里“批”的含金量低得多，因为 B 正例少，而庞大的负例里同样的 20% 被错批。想在 TPR = 0.8 不变时把 B 的 PPV 提到 {PPV_A0:.2f}，由恒等式 B 的 FPR 必须是 {FPR_B1:.2f}：B 的 FPR 是 {FPR_B1:.2f}，A 的是 {FPR0:.2f}。预测均等与 FPR 相等不能兼得。")),
                 svg(drawn(fig_conflict), T('Left: equal TPR and FPR gives unequal PPV. Right: forcing equal PPV (with equal TPR) makes the false positive rates unequal.', '左：TPR 与 FPR 相等，则 PPV 不等。右：强行让 PPV 相等（TPR 相等），则假阳性率不等。')),
                 callout('note', T('So what do we do?', '那怎么办？'),
                         T("There is no neutral answer: choose the criterion that matches the harm. The textbook example is a recidivism-risk score (COMPAS): its makers stressed equal PPV across groups, critics stressed unequal false positive rates, and both were right about their own criterion. The escape routes are equal base rates or a perfect classifier, neither of which a real problem gives. The lecture's advice is to know what matters (representation, the meaning of the score, missing a qualified person) and to trade off against accuracy.",
                           "没有中立的答案：要按所关心的伤害来选准则。教科书里的例子是再犯风险评分（COMPAS）：开发方强调各群体 PPV 相同，批评者强调假阳性率不同，两边对各自的准则都没说错。出路只有基础率相等或完美分类器，现实问题两者都不给。讲义的建议是：先弄清什么重要（代表性、分数的含义、不漏掉合格者），再和准确率做权衡。")),
                 skill=CONF),
            derive('reweigh', T('Pre-processing: resampling and reweighing', '预处理：重采样与重加权'),
                   [(r"P_{e}(A{=}a, Y{=}1) = P(A{=}a)\,P(Y{=}1)",
                     T("What we would see **if $A$ and $Y$ were independent**: the product of the margins.", "**如果 $A$ 与 $Y$ 独立**，我们会看到什么：边缘概率之积。")),
                    (r"P_{o}(A{=}a, Y{=}1) = \frac{\#(Y{=}1, A{=}a)}{|D|}",
                     T("What the data shows: the actual share of that cell.", "数据里实际的占比：该格子的比例。")),
                    (r"W(x_i, a_i, y_i) = \frac{P_{e}(A{=}a_i, Y{=}y_i)}{P_{o}(A{=}a_i, Y{=}y_i)}",
                     T("Weigh each instance by expected over observed: over-represented cells (more than independence predicts) get weight below 1, under-represented cells above 1. The lecture states it for $Y{=}1$; the same holds for $Y{=}0$.", "每个样本的权重是期望除以观察：被过度代表的格子（比独立时多）权重小于 1，不足的格子大于 1。讲义对 $Y{=}1$ 写出，$Y{=}0$ 同理。")),
                    (S(r"|D| = 30, \quad P(A{=}m) = @pm@, \quad P(Y{=}1) = @py@", '', pm=f(P_A['m'], 2), py=f(P_Y1, 2))['en'],
                     T("On the lecture's 30 applicants: 12 martians, 12 good in total (6 + 6).", "用讲义的 30 个申请人：12 个火星人，共 12 个好人（6 + 6）。")),
                    (S(r"W(m,1) = \frac{@pm@ \cdot @py@}{6/30} = @w@", '', pm=f(P_A['m'], 1), py=f(P_Y1, 1), w=f(W[('m', 1)], 2))['en'],
                     T("Good martians are over-represented: they make up 0.20 of the data, but only 0.16 if $A$ and $Y$ were independent. So the weight is below 1.", "好的火星人在数据里占 0.20，而独立时只应占 0.16：被过度代表，所以权重小于 1。")),
                    (S(r"W(m,0) = @a@, \quad W(h,1) = @b@, \quad W(h,0) = @c@", '', a=f(W[('m', 0)], 2), b=f(W[('h', 1)], 2), c=f(W[('h', 0)], 2))['en'],
                     T("The other three cells in the same way. Bad martians and good humans, which are rarer than independence predicts, get weight 1.2.", "其余三个格子同样算。比独立时更少见的“差火星人”和“好人类”，权重是 1.2。")),
                    (S(r"P_w(Y{=}1 \mid m) = \frac{6 \cdot @a@}{6 \cdot @a@ + 6 \cdot @b@} = @r@, \quad P_w(Y{=}1 \mid h) = @s@", '', a=f(W[('m', 1)], 1), b=f(W[('m', 0)], 1), r=f(WPOS['m'], 2), s=f(WPOS['h'], 2))['en'],
                     T("Check: in the weighted data both groups have the same positive rate, 0.40 = $P(Y{=}1)$. Any model trained on it sees no link between $A$ and $Y$.", "检验：加权后的数据里，两个群体的正例率相同，都是 0.40 = $P(Y{=}1)$。在它上面训练的模型看不到 $A$ 和 $Y$ 之间的联系。"))],
                   blank=(4, '0.4*0.4/0.2', T("Compute $W(m,1)$: expected $0.4 \\cdot 0.4$ over observed $6/30$.", "算 $W(m,1)$：期望 $0.4 \\cdot 0.4$ 除以观察 $6/30$。")),
                   intro=T("Pre-processing fixes the data before any model sees it. **Balancing**: up-sample the minority group or down-sample the majority. **Re-weighting**: keep all instances, give each a weight that makes $A$ and $Y$ look independent.", "预处理在任何模型见到数据之前修数据。**平衡：** 对少数群体过采样，或对多数群体欠采样。**重加权：** 保留所有样本，给每个样本一个权重，让 $A$ 和 $Y$ 看起来独立。"),
                   skill=MIT, chapter=T('Making models fairer', '让模型更公平')),
            read('in-post', T('In-processing and post-processing', '训练中处理与后处理'),
                 h(T('2. Training / optimisation (in-processing)', '2. 训练/优化（训练中处理）')),
                 math_(r"\min_{\boldsymbol\theta}\ \mathcal{L}(\boldsymbol\theta)"),
                 math_(r"P(\hat{Y}{=}1 \mid A{=}m) = P(\hat{Y}{=}1 \mid A{=}h)"),
                 p(T("Use a fairness criterion as a **constraint** while training (minimise the loss *subject to* the second line) (the lecture's example: logistic regression with demographic parity). **Pro:** fairness is built directly into training. **Con:** the optimisation problem is more complex. (Textbook variants: add the unfairness as a penalty term to the loss, or train an adversary that tries to predict $A$ from the model's output while the model tries to fool it.)", "训练时把公平准则当作**约束**（在满足第二行的前提下最小化损失；讲义的例子：带人口统计均等约束的逻辑回归）。**优点：** 公平直接放进训练。**缺点：** 优化问题更复杂。（教科书变体：把不公平程度当惩罚项加进损失；或训练一个对手，从模型输出去预测 $A$，模型则努力骗过它。）")),
                 h(T('3. Post-processing', '3. 后处理')),
                 p(T("Change the predictions of a trained model, for example choose the threshold θ per group, or give a special rule to instances with $P(\\hat{y}) \\approx 0.5$.", "改动已训练模型的预测，比如按群体分别选阈值 θ，或对 $P(\\hat{y}) \\approx 0.5$ 的样本给特殊规则。")),
                 table(['', T('threshold', '阈值'), 'TPR', 'FPR', T('accuracy', '准确率')],
                       [T('martians, one threshold', '火星人，统一阈值'), '0.5', f(T_SINGLE['m']['tpr'], 2), f(T_SINGLE['m']['fpr'], 2), f(T_SINGLE['m']['acc'], 2)],
                       [T('humans, one threshold', '人类，统一阈值'), '0.5', f(T_SINGLE['h']['tpr'], 2), f(T_SINGLE['h']['fpr'], 2), f(T_SINGLE['h']['acc'], 2)],
                       [T('martians, own threshold', '火星人，自己的阈值'), '0.4', f(T_GROUP['m']['tpr'], 2), f(T_GROUP['m']['fpr'], 2), f(T_GROUP['m']['acc'], 2)],
                       [T('humans, unchanged', '人类，不变'), '0.5', f(T_GROUP['h']['tpr'], 2), f(T_GROUP['h']['fpr'], 2), f(T_GROUP['h']['acc'], 2)]),
                 p(T(f"Toy scores for 12 martians and 18 humans (the lecture's sizes). With a single threshold 0.5 the TPR is {T_SINGLE['m']['tpr']:.2f} for martians and {T_SINGLE['h']['tpr']:.2f} for humans. Lowering the martians' threshold to 0.4 gives both {T_GROUP['m']['tpr']:.2f}: **equal opportunity**. The price: martians' FPR rises to {T_GROUP['m']['fpr']:.2f} (humans: {T_GROUP['h']['fpr']:.2f}), so equalised odds still fails, as the identity predicts. Here the overall accuracy happens to rise from {ACC_SINGLE:.2f} to {ACC_GROUP:.2f} because 0.5 was a poor threshold for martians; in general a constraint cannot beat the best unconstrained accuracy.",
                     f"12 个火星人和 18 个人类（讲义的人数）的玩具分数。统一阈值 0.5 时，火星人 TPR {T_SINGLE['m']['tpr']:.2f}，人类 {T_SINGLE['h']['tpr']:.2f}。把火星人的阈值降到 0.4，两者都是 {T_GROUP['m']['tpr']:.2f}：**机会均等**。代价：火星人的 FPR 升到 {T_GROUP['m']['fpr']:.2f}（人类 {T_GROUP['h']['fpr']:.2f}），所以均等化赔率仍然不成立，正如恒等式预言的。这里总体准确率恰好从 {ACC_SINGLE:.2f} 升到 {ACC_GROUP:.2f}，是因为 0.5 对火星人本来就不合适；一般来说，约束不可能超过无约束时的最佳准确率。")),
                 skill=MIT),
            read('stages', T('The three stages and the trade-off', '三个阶段与取舍'),
                 table([T('Stage', '阶段'), T('What changes', '改什么'), T('Pros', '优点'), T('Cons', '缺点')],
                       [T('Pre-processing', '预处理'), T('the data: up/down-sample, reweigh', '数据：过/欠采样、重加权'), T('any model afterwards; fairness before learning', '之后可用任何模型；在学习之前就公平'), T('the fix is indirect: the model may still find proxies', '修正是间接的：模型仍可能找到代理变量')],
                       [T('In-processing', '训练中'), T('the objective: constraint or penalty', '目标：约束或惩罚'), T('fairness directly part of training', '公平直接成为训练的一部分'), T('more complex optimisation; model-specific', '优化更复杂；依赖具体模型')],
                       [T('Post-processing', '后处理'), T('the predictions: thresholds per group', '预测：按群体的阈值'), T('model-independent; works with black-box and proprietary models', '与模型无关；黑箱/专有模型也能用'), T('needs the protected attribute at test time', '测试时需要受保护属性')]),
                 p(T("**No fair free lunch** (lecture, Hardt et al. 2016): the 'fair' predictions differ under different criteria, it is difficult and in some cases provably impossible to satisfy them all, and there is often a trade-off between fairness and overall performance. In their loan example, how many *non-defaulters* get a loan in each ethnic group is very different under max-profit, a single threshold, equal opportunity, equalised odds and demographic parity: the choice of criterion changes who gets the loan.", "**没有公平的免费午餐**（讲义，Hardt 等 2016）：“公平”的预测在不同准则下不同；要全部满足很难，有时被证明不可能；公平与整体表现之间常常要取舍。在他们的贷款例子里，各族群里*不违约者*拿到贷款的比例，在利润最大、单一阈值、机会均等、均等化赔率和人口统计均等下相差很大：选哪个准则，就改变了谁能贷到款。")),
                 skill=MIT),
            choice('p-which', T('Which criterion?', '选哪个准则？'), CRIT,
                   T("A hospital screening model must not miss sick patients in any group. Which criterion matches that aim best?", "医院的筛查模型不能漏掉任何群体里的病人。哪个准则最贴合这个目标？"),
                   [(T('Demographic parity', '人口统计均等'), T("That equalises the rate of positive predictions and ignores who is truly sick.", "它让正向预测的比率相等，不管谁真的有病。")),
                    (T('Predictive parity', '预测均等'), T("That equalises how often a positive prediction is right (PPV), not how many sick people are caught.", "它让阳性预测的正确率 (PPV) 相等，而不是抓到多少病人。")),
                    (T('Equal opportunity: the same TPR in every group', '机会均等：各群体 TPR 相同'), True),
                    (T('Fairness through unawareness', '“不看敏感属性”式公平'), T("Hiding the attribute does not control any error rate, and proxies leak it anyway.", "藏起属性并不控制任何错误率，代理变量照样泄露它。"))],
                   T("'Do not miss a qualified person' is a statement about the true positives caught: TPR (FNR) per group.", "“不漏掉合格的人”说的是抓到的真阳性：每个群体的 TPR（FNR）。")),
            number('p-gap', T('Equal opportunity gap', '机会均等差距'), CRIT,
                   T(f"Group A has TP = {PX['a']['tp']}, FN = {PX['a']['fn']}, FP = {PX['a']['fp']}, TN = {PX['a']['tn']}. Group B has TP = {PX['b']['tp']}, FN = {PX['b']['fn']}, FP = {PX['b']['fp']}, TN = {PX['b']['tn']}. What is the absolute difference in TPR between the groups (the equal-opportunity gap)? Give it as a decimal.",
                     f"群体 A：TP = {PX['a']['tp']}，FN = {PX['a']['fn']}，FP = {PX['a']['fp']}，TN = {PX['a']['tn']}。群体 B：TP = {PX['b']['tp']}，FN = {PX['b']['fn']}，FP = {PX['b']['fp']}，TN = {PX['b']['tn']}。两群体 TPR 之差的绝对值（机会均等差距）是多少？用小数表示。"),
                   round(PX_GAP, 4),
                   T(f"TPR = TP/(TP+FN): A {PX['a']['tp']}/{PX['a']['tp'] + PX['a']['fn']} = {PX_TPR['a']:.2f}; B {PX['b']['tp']}/{PX['b']['tp'] + PX['b']['fn']} = {PX_TPR['b']:.2f}. Difference {PX_GAP:.2f}. FP and TN are not used.", f"TPR = TP/(TP+FN)：A {PX['a']['tp']}/{PX['a']['tp'] + PX['a']['fn']} = {PX_TPR['a']:.2f}；B {PX['b']['tp']}/{PX['b']['tp'] + PX['b']['fn']} = {PX_TPR['b']:.2f}。差 {PX_GAP:.2f}。FP 和 TN 用不到。"),
                   tolerance=0.005),
            number('p-weight', T('A reweighing weight', '一个重加权的权重'), MIT,
                   T("In a data set of 30 applicants, 12 belong to group m and 6 of the 12 have Y = 1; in total 12 of the 30 have Y = 1. Using $W = P_{e}(A{=}a, Y{=}y)/P_{o}(A{=}a, Y{=}y)$, what is the weight of an instance with A = m and Y = 1?",
                     "30 个申请人的数据里，12 个属于群体 m，其中 6 个 Y = 1；30 个人里总共 12 个 Y = 1。用 $W = P_{e}(A{=}a, Y{=}y)/P_{o}(A{=}a, Y{=}y)$，A = m 且 Y = 1 的样本权重是多少？"),
                   round(W[('m', 1)], 3),
                   T("Expected: $(12/30)(12/30) = 0.16$. Observed: $6/30 = 0.20$. Weight $= 0.16/0.20 = 0.8$.", "期望：$(12/30)(12/30) = 0.16$。观察：$6/30 = 0.20$。权重 $= 0.16/0.20 = 0.8$。"),
                   tolerance=0.005),
            choice('p-unaware', T('Why unawareness fails', '“不看属性”为什么失败'), UNAW,
                   T('Why can a classifier trained without the sensitive attribute A still treat groups differently?', '没有敏感属性 A 训练的分类器，为什么仍可能区别对待各群体？'),
                   [(T('Other features in X are correlated with A (proxies), and historical bias in the labels is still learned', 'X 里的其他特征与 A 相关（代理变量），标签里的历史偏差仍被学到'), True),
                    (T('Classifiers secretly guess A from random noise', '分类器从随机噪声里偷偷猜出 A'), T("It is not noise: it is real correlation between features such as postcode and group.", "不是噪声：是邮编之类特征与群体之间的真实相关。")),
                    (T('Removing A makes the model underfit, which is unfair', '去掉 A 会让模型欠拟合，所以不公平'), T("Underfitting is a separate matter; the issue here is information that survives in X.", "欠拟合是另一回事；这里的问题是信息仍留在 X 里。")),
                    (T('It does not fail: removing A guarantees demographic parity', '它不会失败：去掉 A 就保证人口统计均等'), T("Nothing guarantees that. In the postcode example the grant rates were 0.2 vs 0.8.", "没有任何保证。邮编的例子里批准率是 0.2 对 0.8。"))],
                   T("Information about A is redundantly encoded in X, and the labels carry the history. The model recovers both.", "A 的信息被冗余地编码在 X 里，标签又带着历史。模型两者都能还原。")),
            choice('p-conflict', T('The impossibility result', '不可能性结果'), CONF,
                   T('Two groups have different base rates. Which combination can an imperfect classifier NOT satisfy together (in general)?', '两个群体基础率不同。一个不完美的分类器（一般而言）不能同时满足下面哪一组？'),
                   [(T('Equal TPR and equal FPR in both groups', '两群体 TPR 相等且 FPR 相等'), T("That is equalised odds; it can be satisfied on its own (then PPV differs).", "那是均等化赔率；单独可以满足（此时 PPV 会不同）。")),
                    (T('Equal PPV together with equal TPR and equal FPR', 'PPV 相等，同时 TPR 相等、FPR 相等'), True),
                    (T('Equal accuracy in both groups', '两群体准确率相等'), T("Nothing in the identity rules that out.", "恒等式并不排除它。")),
                    (T('Equal TPR alone', '只要 TPR 相等'), T("A single criterion on its own can usually be met, for instance by adjusting thresholds.", "单个准则通常可以满足，例如调阈值。"))],
                   T("$\\text{FPR} = \\frac{p}{1-p}\\frac{1-\\text{PPV}}{\\text{PPV}}\\text{TPR}$: with equal PPV and TPR, FPR must differ when $p$ differs.", "$\\text{FPR} = \\frac{p}{1-p}\\frac{1-\\text{PPV}}{\\text{PPV}}\\text{TPR}$：PPV 和 TPR 相等时，$p$ 不同则 FPR 必不同。")),
            choice('p-post', T('Which stage, and what is the catch?', '哪个阶段，代价是什么？'), MIT,
                   T('A bank cannot retrain its proprietary scoring model, so it applies a different score threshold to each group to equalise TPR. What stage is this and what is its main drawback?', '银行无法重训其专有评分模型，于是对各群体用不同的分数阈值来使 TPR 相等。这是哪个阶段，主要缺点是什么？'),
                   [(T('Pre-processing; it changes the training data', '预处理；它改变训练数据'), T("The training data and model are untouched here.", "这里训练数据和模型都没动。")),
                    (T('In-processing; it makes the optimisation harder', '训练中处理；它让优化更难'), T("There is no training involved at all.", "这里根本不涉及训练。")),
                    (T('Post-processing; it needs the protected attribute at prediction time', '后处理；预测时需要受保护属性'), True),
                    (T('Post-processing; it only works with logistic regression', '后处理；只适用于逻辑回归'), T("The opposite: it is model-independent and works even for black boxes.", "恰好相反：它与模型无关，黑箱也适用。"))],
                   T("It changes only the predictions (model-independent), but the group must be known when predicting.", "它只改预测（与模型无关），但预测时必须知道群体。")),
            text_q('p-compare', T('Demographic parity vs equal opportunity', '人口统计均等 vs 机会均等'), CRIT,
                   T('In 2-3 lines: compare demographic parity and equal opportunity. Say what each equalises and when each is appropriate.', '用 2-3 行比较人口统计均等和机会均等：各自让什么相等，各适用于什么情形。'),
                   ['Demographic parity: P(Yhat=1|A) equal across groups, independent of the true label Y', 'Equal opportunity: TPR (equivalently FNR) equal across groups, uses Y among truly positive instances', 'Demographic parity suits cases where representation matters; it can grant wrong people in one group', 'Equal opportunity suits cases where you do not want to miss qualified people; it accepts unfairness already in the labels'],
                   'Demographic parity requires the same rate of positive predictions in every group, P(Yhat=1 | A=a), whatever the true label; it fits cases where representation matters but can give the right people to one group and the wrong ones to another. Equal opportunity requires the same true positive rate (equivalently the same false negative rate) in every group, so qualified people are equally likely to be found; it uses the true label, which means it also accepts any unfairness already in the ground truth.',
                   T("Marking: what is equalised (grant rate vs TPR), whether Y is used, and a use case for each.", "评分点：各自让什么相等（批准率 vs TPR）、是否用到 Y，以及各自的使用场景。")),
            text_q('p-design', T('Design: a hiring screen (Section C style)', '设计题：简历筛选系统（C 部分风格）'), MIT,
                   T("A company wants an ML system to shortlist job applicants, trained on ten years of its own past hiring decisions. Identify two sources of bias, say which fairness criterion you would monitor and why, and propose one mitigation at each of the three stages.", "公司想用机器学习给求职者筛选入围名单，用自己十年的招聘决定来训练。指出两个偏差来源，说明你会监测哪个公平准则及原因，并在三个阶段各提出一项缓解措施。"),
                   ['Sources: historical bias (past decisions reflect old discrimination) and measurement bias (hiring decision is a proxy for applicant quality); also proxies such as postcode or school', 'Criterion with reason, e.g. equal opportunity: qualified applicants of each group should be equally likely to be shortlisted (or demographic parity if representation is the goal)', 'Pre-processing: reweigh or resample so A and Y look independent; in-processing: add a fairness constraint or penalty; post-processing: group-specific thresholds', 'Mention that removing gender alone does not work because of proxies, and the trade-off with accuracy'],
                   'Two sources: historical bias (ten years of past decisions carry the discrimination of the past) and measurement bias (the hiring decision is only a noisy proxy for applicant quality), plus proxies such as school or postcode that encode gender or ethnicity, so just dropping the attribute is not enough. I would monitor equal opportunity: applicants who would perform well should have the same chance of being shortlisted in every group, so the TPR per group should match, and I would report all metrics per group, not only overall accuracy. Mitigation: pre-processing by reweighing instances so the protected attribute and the label are independent; in-processing by training with an equal-opportunity constraint; post-processing by choosing a score threshold per group (which needs the attribute at decision time). Each step trades some accuracy for fairness, and not all criteria can be satisfied together when base rates differ.',
                   T("A strong answer names the sources, picks one criterion with a reason, covers all three stages, and mentions proxies and the trade-off.", "好答案要点：写出偏差来源，选一个准则并说明理由，三个阶段都覆盖，并提到代理变量和取舍。")),
            read('remember', T('What to remember', '要记住的'),
                 ul(T("**Sources of bias:** historical, representation/reporting, measurement (data); model fit and loss (model); evaluation; deployment; plus the feedback loop. Human biases: out-group homogeneity, correlation fallacy.", "**偏差来源：** 历史、代表性/报告、测量（数据）；模型拟合与损失（模型）；评估；部署；还有反馈回路。人的偏差：外群体同质性、相关性谬误。"),
                    T("**Unawareness** (drop A) fails: proxies encode A and labels carry history.", "**不看属性**（去掉 A）会失败：代理变量编码了 A，标签带着历史。")),
                 table([T('Criterion', '准则'), T('Equalises', '相等的量'), T('Formula', '公式'), T('Ignores Y?', '看 Y 吗？')],
                       [T('Demographic parity', '人口统计均等'), T('grant rate', '批准率'), r'$P(\hat{Y}{=}1 \mid A)$', T('yes, ignores', '不看')],
                       [T('Predictive parity', '预测均等'), 'PPV', r'$P(Y{=}1 \mid \hat{Y}{=}1, A)$', T('uses Y', '看 Y')],
                       [T('Equal opportunity', '机会均等'), 'TPR / FNR', r'$P(\hat{Y}{=}1 \mid Y{=}1, A)$', T('uses Y', '看 Y')],
                       [T('Equalised odds', '均等化赔率'), 'TPR and FPR', r'$P(\hat{Y}{=}1 \mid Y, A)$', T('uses Y', '看 Y')],
                       [T('Individual', '个体公平'), T('scores of similar people', '相似的人的得分'), r'$s(X_i,X_j) > \theta$', '—']),
                 math_(r"\text{FPR} = \frac{p}{1-p}\cdot\frac{1-\text{PPV}}{\text{PPV}}\cdot\text{TPR}"),
                 p(T("Different base rates $p$ therefore rule out equal PPV, equal TPR and equal FPR all at once.", "所以基础率 $p$ 不同，就不可能 PPV、TPR、FPR 同时都相等。")),
                 ul(T("**Mitigation:** pre (resample, reweigh $W = P_{e}/P_{o}$), in (constraint or penalty), post (group thresholds: model-independent, needs A at test time).", "**缓解：** 预处理（重采样、重加权 $W = P_{e}/P_{o}$）、训练中（约束或惩罚）、后处理（分群阈值：与模型无关，测试时需要 A）。"),
                    T("**No fair free lunch:** criteria conflict and trade off against accuracy; choose by the harm to avoid; report metrics per group.", "**没有公平的免费午餐：** 准则相互冲突，并与准确率取舍；按要避免的伤害来选；分群报告指标。")),
                 chapter=T('Practice and review', '练习与回顾')),
        ])


LESSONS = [L_self, L_fairness]
