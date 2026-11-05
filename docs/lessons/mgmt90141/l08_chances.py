# Lesson 8 (chances): how to count and combine chances. Decks: W7 (counting rules, three ways to assign probability, events, complement, union,
# intersection, mutually exclusive, conditional probability, independence; the software company, the police promotions, the MBA survey).
# Instrument: area_table. Numbers are computed below.
import math
from common import *

SK = 'mg.chances'


def L_chances():
    police = [[288, 36], [672, 204]]
    assert (288 + 36, 960, 240, 1200) == (324, 288 + 672, 36 + 204, 1200)
    pA, pW, pAW = 324 / 1200, 240 / 1200, 36 / 1200
    assert round(pA, 2) == .27 and round(pAW / pW, 2) == .15 and round(288 / 960, 2) == .30
    S, W, SW = .30, .20, .12
    assert round(S + W - SW, 2) == .38 and round(1 - (S + W - SW), 2) == .62 and round(SW / W, 2) == .60
    mba = [[421, 393, 76], [400, 593, 46]]
    pQF, pQP, pQ = 421 / 890, 400 / 1039, 821 / 1929
    assert round(pQF, 3) == .473 and round(pQP, 3) == .385 and round(pQ, 3) == .426
    assert math.comb(5, 2) == 10 and 2 ** 3 == 8
    xray = [2, 5, 6, 4, 3]
    assert [round(v / 20, 2) for v in xray] == [.1, .25, .3, .2, .15]
    return dict(
        id=f'{CID}-chances',
        title=T('How to count and combine chances', '怎样数清并组合可能性'),
        description=T('A probability is a share of an area. Slide over a table of counts to see “and”, “or”, “not” and “given” as pieces of one picture, and the one test for whether two things are independent.',
                      '概率就是一块面积所占的比例。在一张计数表上操作，把“并且”“或者”“不是”“已知”看成同一幅图的几块，以及判断两件事是否独立的那个唯一的检验。'),
        minutes=45,
        skills=[{'id': SK, 'name': T('Probability: events, conditional probability, independence', '概率：事件、条件概率、独立性')}],
        misconceptions=[{'id': 'conditional-reversed', 'description': T('Confusing P(A | B) with P(B | A)', '把 P(A | B) 和 P(B | A) 搞反')},
                        {'id': 'add-without-overlap', 'description': T('Adding P(A) and P(B) for “A or B” without subtracting the overlap', '算“A 或 B”时把 P(A) 和 P(B) 直接相加，没有减去重叠')},
                        {'id': 'exclusive-is-independent', 'description': T('Treating mutually exclusive as independent', '把互斥当成独立')}],
        steps=[
            read('table', T('A police force, as a picture', '把一支警察队伍画成图'),
                 p(T(r"A police force has 1,200 officers: 960 men and 240 women. Over two years 324 were promoted: 288 men and 36 women. The picture is the whole force as a rectangle: columns by sex (a column is as wide as its group), and each column split into promoted and not promoted. Choose what **A** and **B** mean, and read the probabilities off the areas.", r"一支警察队伍有 1,200 名警官：960 名男性、240 名女性。两年里有 324 人获晋升：288 名男性、36 名女性。这幅图把整支队伍画成一个长方形：按性别分列（每列的宽度和这一组的人数成比例），每一列再分成晋升和未晋升。选好 **A** 和 **B** 是什么，从面积读出概率。")),
                 frame('area_table.html', T('The police force as an area: choose events A and B and read their probabilities off the picture.', '把警察队伍画成面积：选事件 A 和 B，从图上读它们的概率。'),
                       caption=T(r"Choose A (promoted) and B (women). Then press “Given B”: only B stays, and its own total becomes the new whole.", r"选 A（晋升）和 B（女性）。再按“已知 B”：只留下 B，它自己的总数成为新的整体。"),
                       rows=[T('Promoted', '晋升'), T('Not promoted', '未晋升')], cols=[T('Men', '男性'), T('Women', '女性')], counts=police),
                 chapter=T('Touch', '动手')),
            choice('predict', T('Do women get promoted less?', '女性晋升得更少吗？'), SK,
                   T(r"Overall, 27% of officers were promoted. Among the **women**, what share was promoted?", r"全体警官里 27% 获晋升。**女性**里获晋升的比例是多少？"),
                   [(T(r"15%: 36 of the 240 women. Lower than 27%, so being a woman and being promoted are not independent.", r"15%：240 名女性里有 36 人。低于 27%，所以“是女性”和“获晋升”不独立。"), True),
                    (T(r"3%: 36 of the 1,200 officers.", r"3%：1,200 名警官里的 36 人。"), T(r"That is P(woman and promoted), the overlap. “Among the women” restricts to the 240.", r"那是 P(女性且晋升)，即重叠部分。“女性里”要把范围缩到这 240 人。"), 'conditional-reversed'),
                    (T(r"27%: the same as for everyone.", r"27%：和所有人一样。"), T(r"Only if the two were independent. Check on the picture: the women’s promoted slice is thinner.", r"只有当两者独立时才是。看图：女性那一列里晋升的那条更薄。"), None)],
                   T(r"“Given B” means: throw away everything outside B and divide by B’s own total. 36/240 against 324/1200.", r"“已知 B”的意思是：把 B 以外的全部扔掉，除以 B 自己的总数。36/240 对 324/1200。")),
            read('name', T('The vocabulary, as areas', '词汇表，用面积来看'),
                 table([T('Word', '词'), T('In the picture', '在图里'), T('Rule', '规则'), T('Police example', '警察例子')],
                       [T('**Event** $A$', '**事件** $A$'), T('a piece of the area', '面积的一块'), '$P(A) = \\tfrac{n_A}{N}$', '$P(A) = 324/1200 = 0.27$'],
                       [T('**Complement** $A^c$', '**补事件** $A^c$'), T('everything outside $A$', '$A$ 之外的全部'), '$P(A^c) = 1 - P(A)$', '$0.73$'],
                       [T('**Intersection** $A \\cap B$', '**交** $A \\cap B$'), T('inside both', '同时在两者里面'), T('count of the overlap $/ N$', '重叠部分的数量 $/ N$'), '$P(A \\cap W) = 36/1200 = 0.03$'],
                       [T('**Union** $A \\cup B$', '**并** $A \\cup B$'), T('inside at least one', '至少在一个里面'), '$P(A \\cup B) = P(A) + P(B) - P(A \\cap B)$', '$0.27 + 0.20 - 0.03 = 0.44$'],
                       [T('**Mutually exclusive**', '**互斥**'), T('no overlap at all', '完全没有重叠'), '$P(A \\cap B) = 0$', T('promoted and not promoted', '晋升和未晋升')],
                       [T('**Conditional** $P(A \\mid B)$', '**条件概率** $P(A \\mid B)$'), T('keep only $B$, $B$ becomes the whole', '只留下 $B$，$B$ 成为整体'), '$P(A \\mid B) = \\dfrac{P(A \\cap B)}{P(B)}$', '$P(A \\mid W) = 0.03/0.20 = 0.15$'],
                       [T('**Independent**', '**独立**'), T('knowing $B$ does not change $A$', '知道 $B$ 不改变 $A$'), '$P(A \\mid B) = P(A)$, ' + 'or $P(A \\cap B) = P(A)P(B)$', T('$0.15 \\ne 0.27$: dependent', '$0.15 \\ne 0.27$：不独立')]),
                 p(T(r"Three ways to *get* a probability, which the exam can name: **classical** (all outcomes equally likely: a die, $1/6$ each), **relative frequency** (from data: the X-ray department had 0, 1, 2, 3, 4 patients waiting on 2, 5, 6, 4, 3 of 20 days, so $f = 0.10, 0.25, 0.30, 0.20, 0.15$) and **subjective** (a degree of belief: Tom puts 0.6 on his offer being accepted, Judy 0.8). Every probability is between 0 and 1 and the outcomes’ probabilities add to 1. Counting rules help with equally likely outcomes: three steps with 2 outcomes each give $2 \times 2 \times 2 = 8$; choosing 2 of 5 parts gives $\binom{5}{2} = 10$ combinations.", r"*得到*概率有三种办法，考试可能会点名：**经典法**（所有结果等可能：一颗骰子，每面 $1/6$）、**相对频率法**（来自数据：X 光科 20 天里有 2、5、6、4、3 天分别有 0、1、2、3、4 位病人在等，所以 $f = 0.10, 0.25, 0.30, 0.20, 0.15$）和**主观法**（信念的程度：Tom 认为他的报价被接受的概率是 0.6，Judy 认为是 0.8）。每个概率都在 0 和 1 之间，各个结果的概率加起来是 1。计数规则帮你处理等可能的结果：三步、每步 2 个结果，共 $2 \times 2 \times 2 = 8$ 种；从 5 个零件里选 2 个，有 $\binom{5}{2} = 10$ 种组合。")),
                 callout('warning', T('Exclusive is not independent', '互斥不等于独立'), T(r"Mutually exclusive events *depend* on each other as much as possible: if one happens, the other cannot. Independent events do not affect each other at all.", r"互斥的事件彼此*依赖*到了极点：一个发生，另一个就不可能发生。独立的事件则完全互不影响。")),
                 chapter=T('Names', '命名')),
            number('union', T('Leaving for either reason', '因为任一原因离职'), SK,
                   T(r"At a software company 30% of employees left because of salary, 20% because of their work assignment, and 12% gave **both** as reasons. What is the probability that an employee left for salary **or** work assignment (or both)?", r"一家软件公司里，30% 的员工因薪水离职，20% 因工作安排离职，12% 的人两个原因**都**有。一名员工因薪水**或**工作安排（或两者）离职的概率是多少？"),
                   round(S + W - SW, 2), T(r"$0.30 + 0.20 - 0.12 = 0.38$. The 12% who gave both are counted once, not twice. The probability of neither is $1 - 0.38 = 0.62$.", r"$0.30 + 0.20 - 0.12 = 0.38$。两个原因都有的那 12% 只算一次，不是两次。两者都不是的概率是 $1 - 0.38 = 0.62$。"), tolerance=0.005, purpose='practice'),
            number('cond', T('Given one reason', '已知一个原因'), SK,
                   T(r"Of the employees who left because of work assignment, what share also gave salary as a reason? That is $P(S \mid W)$.", r"因工作安排离职的员工里，也把薪水当作原因的占多少？也就是 $P(S \mid W)$。"),
                   round(SW / W, 2), T(r"$P(S \mid W) = P(S \cap W)/P(W) = 0.12/0.20 = 0.60$. Not $P(W \mid S) = 0.12/0.30 = 0.40$: the order matters.", r"$P(S \mid W) = P(S \cap W)/P(W) = 0.12/0.20 = 0.60$。不是 $P(W \mid S) = 0.12/0.30 = 0.40$：顺序很重要。"), tolerance=0.005, purpose='practice'),

            read('mba', T('Another table: why MBA students chose their school', '另一张表：MBA 学生为什么选这所学校'),
                 p(T(r"1,929 MBA students gave the first reason for applying to the school they joined. Is the reason independent of whether they study full time or part time?", r"1,929 名 MBA 学生说了他们申请所读学校的首要原因。这个原因和他们读全日制还是非全日制有关系吗？")),
                 frame('area_table.html', T('MBA students by study mode and first reason for choosing a school.', 'MBA 学生按学习方式和选校首要原因的分类。'),
                       caption=T(r"Let A be “quality” and B be “full time”, then compare P(A | B) with P(A).", r"设 A 为“质量”，B 为“全日制”，然后比较 P(A | B) 和 P(A)。"),
                       rows=[T('Quality', '学校质量'), T('Cost or convenience', '费用或便利'), T('Other', '其他')], cols=[T('Full time', '全日制'), T('Part time', '非全日制')], counts=[[421, 400], [393, 593], [76, 46]]),
                 chapter=T('Use it', '用一用')),
            number('mba_f', T('Full-time students and quality', '全日制学生和学校质量'), SK,
                   T(r"If a student is full time, what is the probability that school quality is the first reason? (Three decimals.)", r"如果一名学生是全日制，学校质量是首要原因的概率是多少？（三位小数）"),
                   round(pQF, 3), T(r"$421/890 = 0.473$. For part-time students it is $400/1039 = 0.385$; overall $821/1929 = 0.426$. Since $0.473 \ne 0.426$, the first reason and the study mode are **dependent**.", r"$421/890 = 0.473$。非全日制学生是 $400/1039 = 0.385$；全体是 $821/1929 = 0.426$。因为 $0.473 \ne 0.426$，首要原因和学习方式是**不独立**的。"), tolerance=0.0006, purpose='practice'),
            choice('indep', T('Independent?', '独立吗？'), SK,
                   T(r"Which statement is the correct test for two events $F$ and $Q$ being independent?", r"哪一句是检验两个事件 $F$ 和 $Q$ 独立的正确方法？"),
                   [(T(r"$P(Q \mid F) = P(Q)$: knowing $F$ leaves the chance of $Q$ unchanged.", r"$P(Q \mid F) = P(Q)$：知道 $F$ 并不改变 $Q$ 的可能性。"), True),
                    (T(r"$P(F \cap Q) = 0$.", r"$P(F \cap Q) = 0$。"), T(r"That is mutually exclusive.", r"那是互斥。"), 'exclusive-is-independent'),
                    (T(r"$P(Q \mid F) = P(F \mid Q)$.", r"$P(Q \mid F) = P(F \mid Q)$。"), T(r"These two are usually different, and equal only by accident.", r"这两个通常不同，相等只是巧合。"), 'conditional-reversed')],
                   T(r"Independence means conditioning changes nothing.", r"独立的意思是加上条件什么也不会改变。"), purpose='check'),
            read('traps', T('Traps', '易错点'),
                 callout('warning', T('Or means subtract the overlap', '“或”要减去重叠'), T(r"$P(A \cup B) = P(A) + P(B) - P(A \cap B)$. Adding only the first two counts the overlap twice.", r"$P(A \cup B) = P(A) + P(B) - P(A \cap B)$。只加前两项会把重叠算两次。")),
                 callout('warning', T('Which total?', '除以哪个总数？'), T(r"In $P(A \mid B)$ you divide by $P(B)$, **not** by the size of the whole group. This is the same move you will use for Bayes’ theorem in lesson 11.", r"$P(A \mid B)$ 要除以 $P(B)$，**不是**除以整个群体的大小。这和第 11 课的贝叶斯定理是同一个动作。")),
                 chapter=T('Traps', '易错点')),
            choice('recall_bayes', T('Recall: where this goes next', '回忆：接下来用在哪'), SK,
                   T(r"In lesson 11 the posterior $P(\text{strong} \mid \text{favourable})$ will be a conditional probability. Which total is its denominator?", r"第 11 课里的后验 $P(\text{强} \mid \text{有利})$ 是个条件概率。它的分母是哪个总数？"),
                   [(T(r"$P(\text{favourable})$: the overall chance of the report.", r"$P(\text{有利})$：报告出现的总概率。"), True), (T(r"$P(\text{strong})$: the prior.", r"$P(\text{强})$：先验。"), T(r"The condition is the report, so its probability is the denominator.", r"条件是报告，所以分母是它的概率。"), 'conditional-reversed'), (T(r"1.", r"1。"), T(r"Only when the report is certain.", r"只有当报告是必然的时候。"), None)],
                   T(r"Conditioning on the report: divide by the report’s probability.", r"以报告为条件：除以报告的概率。"), purpose='check'),
            choice('recall_sd', T('Recall: spread', '回忆：离散程度'), SK,
                   T(r"Two suppliers both deliver in 10.3 days on average, with s = 0.67 and s = 2.58. The more reliable one has:", r"两个供应商平均交货都是 10.3 天，标准差分别是 0.67 和 2.58。更可靠的那个是："),
                   [(T(r"s = 0.67: less spread.", r"s = 0.67：离散程度更小。"), True), (T(r"s = 2.58: more variety.", r"s = 2.58：变化更多。"), T(r"More spread is less predictable.", r"离散程度越大越不可预测。"), None), (T(r"Cannot say: the means are equal.", r"无法判断：平均数相等。"), T(r"Equal means is exactly when the spread decides.", r"平均数相等时，恰恰要靠离散程度来决定。"), 'same-mean-same')],
                   T(r"Smaller s with the same mean means more consistent.", r"平均数相同，s 越小越稳定。"), purpose='check'),
        ],
    )
