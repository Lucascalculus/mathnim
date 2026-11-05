# Lesson 13 (normal): how likely is "between these two"? Decks: W8 (normal and standard normal distribution, z, the table both ways, the tyre
# guarantee, financial managers' pay). Exam: 2025 Q5(i)-(iv), 13 of the question's 25 marks. Instrument: normal_area, which reads the real
# table (the paper's Appendices 1 and 2: cumulative probability to four places). Numbers are computed with common.ztable.
from common import *

SK = 'mg.normal'


def L_normal():
    mu, sd = 409000, 19500
    z1 = round((380000 - mu) / sd, 2); p1 = ztable(z1)
    assert (z1, p1) == (-1.49, 0.0681)
    zb, za = round((450000 - mu) / sd, 2), round((370000 - mu) / sd, 2); p2 = round(ztable(zb) - ztable(za), 4)
    assert (zb, za, ztable(zb), ztable(za), p2) == (2.10, -2.0, 0.9821, 0.0228, 0.9593)
    zlo, zhi = z_from_table(0.10), z_from_table(0.90)
    assert (zlo, zhi) == (-1.28, 1.28) and (mu + zlo * sd, mu + zhi * sd) == (384040.0, 433960.0)
    z385 = round((385000 - mu) / sd, 2); p385 = ztable(z385); target = round(p385 + 0.4503, 4)
    zd = z_from_table(target); d = mu + zd * sd
    assert (z385, p385, target, zd, round(d)) == (-1.23, 0.1093, 0.5596, 0.15, 411925)
    # the lecture's tyre: mu 36,500, sigma 5,000
    tz = round((40000 - 36500) / 5000, 2); tr_gt = round(1 - ztable(tz), 4); g = 36500 + z_from_table(0.10) * 5000
    assert (tz, tr_gt, g) == (0.7, 0.2420, 30100)
    mu2, sd2 = 32.62, 2.32
    z30, z35 = round((30 - mu2) / sd2, 2), round((35 - mu2) / sd2, 2)
    pay = round(ztable(z35) - ztable(z30), 4); top = mu2 + z_from_table(0.90) * sd2
    assert (z30, z35, pay) == (-1.13, 1.03, 0.7193) and round(top, 2) == 35.59
    return dict(
        id=f'{CID}-normal',
        title=T('How likely is “between these two”?', '“落在这两个值之间”的可能性有多大？'),
        description=T('The normal curve answers almost every “how likely” question about a measurement. Slide the edges, see the area, and read the same number off the table of the paper: forwards for a probability, backwards for a cut-off.',
                      '正态曲线几乎能回答所有关于测量值的“有多大可能”的问题。移动两条边，看面积，再从试卷上的那张表里读出同样的数：正着读得概率，倒着读得分界值。'),
        minutes=55,
        skills=[{'id': SK, 'name': T('The normal distribution and the z table', '正态分布与 z 表')}],
        misconceptions=[{'id': 'height-not-area', 'description': T('Reading a normal probability as the height of the curve', '把正态概率当作曲线的高度')},
                        {'id': 'table-is-left', 'description': T('Forgetting that the table gives the area to the left', '忘了表给的是左边的面积')},
                        {'id': 'negative-z-row', 'description': T('Splitting a negative z into row and column wrongly', '把负的 z 拆成行和列时拆错')}],
        steps=[
            read('area', T('Probability is an area', '概率是面积'),
                 p(T(r"A tyre company road-tested its new tyre: the lifetime is normal with mean 36,500 miles and standard deviation 5,000 miles. The curve is a picture of how the lifetimes are spread; the **area** under it between two values is the share of tyres that last that long. The whole area is 1, half lies on each side of the mean.", r"一家轮胎公司对新轮胎做了路试：寿命服从正态分布，均值 36,500 英里，标准差 5,000 英里。曲线画的是寿命的分布；它在两个值之间的**面积**，就是寿命落在这个范围里的轮胎所占的比例。总面积是 1，均值两边各占一半。")),
                 frame('normal_area.html', T('A normal curve with draggable edges: the shaded area, the z value and the place in the table update as you move.', '一条可以拖动边的正态曲线：移动时，阴影面积、z 值和它在表里的位置都会更新。'),
                       caption=T(r"Drag the edge of the shaded part. Under the curve: the working in the exam’s own steps. Below: the table, with the cell used.", r"拖动阴影的边。曲线下面是按考试步骤写出的算式。再下面是那张表，用到的格子被标出来。"),
                       mu=36500, sd=5000, unit='', mode='left', a=33000, b=42000, modes=['left', 'between', 'right']),
                 chapter=T('Touch', '动手')),
            choice('predict', T('Wider or taller?', '更宽还是更高？'), SK,
                   T(r"Two tyre makers have the same mean lifetime. The standard deviation is bigger for maker B. Which curve is lower and wider, and which has the larger **area** under it?", r"两家轮胎厂的平均寿命相同。B 厂的标准差更大。哪条曲线更矮更宽？哪条曲线下的**面积**更大？"),
                   [(T(r"B’s curve is lower and wider; both areas are exactly 1.", r"B 的曲线更矮更宽；两个面积都恰好是 1。"), True),
                    (T(r"B’s curve is lower, so B’s area is smaller.", r"B 的曲线更矮，所以 B 的面积更小。"), T(r"Every probability distribution has total area 1; spreading it out lowers it.", r"每个概率分布的总面积都是 1；摊开了，高度就降低了。"), 'height-not-area'),
                    (T(r"B’s curve is taller and narrower.", r"B 的曲线更高更窄。"), T(r"Larger $\sigma$ means more spread: wider and lower.", r"$\sigma$ 越大越分散：更宽更矮。"), None)],
                   T(r"A probability is an area, never a height. $\sigma$ sets how wide the same area is spread.", r"概率是面积，不是高度。$\sigma$ 决定同样的面积摊得有多宽。")),
            read('name', T('The standard normal and the table', '标准正态与那张表'),
                 p(T(r"There is a different normal curve for every $\mu$ and $\sigma$, but the table covers one: the **standard normal** (mean 0, standard deviation 1). To use it, convert your value into **how many standard deviations from the mean it is**:", r"每一对 $\mu$ 和 $\sigma$ 都有一条不同的正态曲线，但表只覆盖一条：**标准正态**（均值 0、标准差 1）。要用它，先把你的值换算成**离均值有几个标准差**：")),
                 math_(r"z = \dfrac{x - \mu}{\sigma}"),
                 ol(T(r"Compute $z$ and round to **two decimals**.", r"算出 $z$，取**两位小数**。"), T(r"Split it for the table: the row is the units and tenths ($-1.4$), the column the hundredths (.09). For a negative $z$, use the **negative** page: $-1.49$ is row $-1.4$, column .09.", r"为查表把它拆开：行是个位和十分位（$-1.4$），列是百分位（.09）。负的 $z$ 要用**负数**那一页：$-1.49$ 是行 $-1.4$、列 .09。"), T(r"The entry is the area **to the left** of $z$: $P(Z < z)$.", r"表里的数是 $z$ **左边**的面积：$P(Z < z)$。")),
                 table([T('You want', '你要'), T('Do this', '这样做')],
                       ['$P(X < x)$', T('table value at $z$', '$z$ 处的表值')], ['$P(X > x)$', T('$1 -$ table value at $z$', '$1 -$ $z$ 处的表值')], ['$P(a < X < b)$', T('table($z_b$) $-$ table($z_a$)', '表($z_b$) $-$ 表($z_a$)')],
                       [T('a cut-off for a given area $p$ on the left', '左边面积为 $p$ 的分界值'), T('find $p$ **inside** the table, read its $z$, then $x = \\mu + z\\sigma$', '在表**里面**找 $p$，读出它的 $z$，再算 $x = \\mu + z\\sigma$')]),
                 p(T(r"Three landmarks, which you can use without the table: about **68.3%** of values lie within one $\sigma$ of the mean, **95.4%** within two and **99.7%** within three.", r"三个不用查表的路标：大约 **68.3%** 的值落在均值一个 $\sigma$ 以内，**95.4%** 在两个以内，**99.7%** 在三个以内。")),
                 callout('warning', T('Reading backwards', '倒着读'), T(r"For a cut-off you search the *body* of the table for the area and read the $z$ from the row and column. If the exact area is not there, take the closest entry (for 0.10 the closest is 0.1003, $z = -1.28$).", r"求分界值时，要在表的*正文*里找面积，再从行和列读出 $z$。如果没有正好的面积，取最接近的那个（0.10 最接近的是 0.1003，$z = -1.28$）。")),
                 chapter=T('Names', '命名')),
            number('tyre', T('Over 40,000 miles', '超过 40,000 英里'), SK,
                   T(r"With mean 36,500 and standard deviation 5,000, what is the probability that a tyre lasts **more than** 40,000 miles? (Four decimals.)", r"均值 36,500，标准差 5,000，一只轮胎寿命**超过** 40,000 英里的概率是多少？（四位小数）"),
                   tr_gt, T(r"$z = (40{,}000 - 36{,}500)/5{,}000 = 0.70$. The table gives $P(Z < 0.70) = 0.7580$, the area on the left, so the right tail is $1 - 0.7580 = 0.2420$.", r"$z = (40{,}000 - 36{,}500)/5{,}000 = 0.70$。表给出 $P(Z < 0.70) = 0.7580$，是左边的面积，所以右尾是 $1 - 0.7580 = 0.2420$。"), tolerance=0.00006, purpose='practice'),
            number('guarantee', T('A guarantee mileage', '保证里程'), SK,
                   T(r"The company will refund tyres that fail before a guaranteed mileage, and wants no more than 10% to qualify. What guarantee, in miles?", r"公司会对没有达到保证里程就坏掉的轮胎退款，希望符合条件的不超过 10%。保证里程应该是多少英里？"),
                   g, T(r"The area on the left is 0.10; the closest table entry is 0.1003, at $z = -1.28$. Then $x = 36{,}500 + (-1.28)(5{,}000) = 30{,}100$ miles.", r"左边的面积是 0.10；最接近的表值是 0.1003，对应 $z = -1.28$。于是 $x = 36{,}500 + (-1.28)(5{,}000) = 30{,}100$ 英里。"), tolerance=1, purpose='practice'),

            read('exam', T('The exam’s version: Victoria’s mortgages', '考试里的版本：维多利亚州的房贷'),
                 p(T(r"Question 5 has two halves. The first half is the normal distribution: four parts, 13 marks. The tool now has the mortgage numbers: change the edge, or switch to “find x from an area” for parts (iii) and (iv).", r"第 5 题分两半。上半是正态分布：四问，13 分。工具里现在是房贷的数字：改变边的位置，或者切换到“由面积求 x”来做 (iii) 和 (iv)。")),
                 paper(T('Question 5, normal distribution · 13 marks', '第 5 题，正态分布 · 13 分'),
                       *ptxt("As per the Australian Bureau of Statistics, the average 2018 mortgage sizes in Victoria, Australia is approximately $409,000. Assume mortgage sizes vary with standard deviations of $19,500 and that it is normally distributed.\n(i) What is the probability that the mortgage size falls below $380,000? [2 marks]\n(ii) What is the probability that the mortgage size fall between $370,000 and $450,000? [3 marks]\n(iii) The State Government of Victoria wants to know the range of mortgage sizes fall in between the lower and upper 10% of the mortgage sizes. Calculate the lower and upper limits of the range. [4 marks]\n(iv) Find the value of d such that the probability between $385,000 and d will have a probability of 0.4503. In other words, find the value of d such that P(385,000 < X < d) = 0.4503, where X represents the 2018 mortgage sizes in Victoria, Australia. [4 marks]",
                             "据澳大利亚统计局的数据，2018 年澳大利亚维多利亚州的平均房贷金额约为 $409,000。假设房贷金额的标准差为 $19,500，并且服从正态分布。\n(i) 房贷金额低于 $380,000 的概率是多少？[2 分]\n(ii) 房贷金额在 $370,000 和 $450,000 之间的概率是多少？[3 分]\n(iii) 维多利亚州政府想知道落在房贷金额最低 10% 和最高 10% 之间的房贷金额范围。计算这个范围的下限和上限。[4 分]\n(iv) 求 d 的值，使得 $385,000 到 d 之间的概率为 0.4503。换句话说，求 d 使得 P(385,000 < X < d) = 0.4503，其中 X 表示维多利亚州 2018 年的房贷金额。[4 分]")),
                 frame('normal_area.html', T('The mortgage distribution: mean 409,000, standard deviation 19,500, with the table of the paper.', '房贷分布：均值 409,000，标准差 19,500，附试卷上的那张表。'),
                       caption=T(r"Parts (i) and (ii): drag the edges to 380,000 and to 370,000 and 450,000. Parts (iii) and (iv): “Find x from an area”.", r"(i)(ii)：把边拖到 380,000，以及 370,000 和 450,000。(iii)(iv)：“由面积求 x”。"),
                       mu=mu, sd=sd, unit='$', mode='left', a=380000, b=450000, p=0.10, **{'from': 385000}),
                 chapter=T('On the paper', '考卷上')),
            derive('q5i', T('(i) and (ii): areas', '(i)(ii)：求面积'),
                   [(r"z = \dfrac{380000 - 409000}{19500} = -1.49", T(r"(i) Convert 380,000 to a $z$: how many standard deviations below the mean.", r"(i) 把 380,000 换成 $z$：比均值低几个标准差。")),
                    (r"P(X < 380000) = P(Z < -1.49) = 0.0681", T(r"The table: negative page, row −1.4, column .09. This is already the area on the left, which is what “below” asks for.", r"查表：负数那页，行 −1.4、列 .09。这已经是左边的面积，正是“低于”所要的。")),
                    (r"z_b = \dfrac{450000 - 409000}{19500} = 2.10,\quad z_a = \dfrac{370000 - 409000}{19500} = -2.00", T(r"(ii) Two values, so two $z$’s.", r"(ii) 两个值，所以两个 $z$。")),
                    (r"P(370000 < X < 450000) = 0.9821 - 0.0228", T(r"Between = (area left of the upper value) minus (area left of the lower value).", r"之间 =（上界左边的面积）减去（下界左边的面积）。")),
                    (r"= 0.9593", T(r"About 96% of mortgages lie between the two.", r"大约 96% 的房贷落在两者之间。"))],
                   outro=T(r"**Answer:** (i) 0.0681; (ii) 0.9593.", r"**答案：** (i) 0.0681；(ii) 0.9593。"),
                   blank=(3, '0.9593', T(r"$0.9821 - 0.0228$.", r"$0.9821 - 0.0228$。")), skill=SK),
            derive('q5iii', T('(iii) and (iv): finding the cut-off', '(iii)(iv)：求分界值'),
                   [(r"P(X < a) = 0.10 \;\Rightarrow\; z = -1.28", T(r"(iii) The lower 10% means 0.10 of the area on the left. Search the body of the table: the closest entry to 0.10 is 0.1003, at $z = -1.28$.", r"(iii) 最低的 10% 就是左边的面积为 0.10。在表的正文里找：最接近 0.10 的是 0.1003，对应 $z = -1.28$。")),
                    (r"a = 409000 + (-1.28)(19500) = 384040", T(r"Turn $z$ back into dollars: mean plus $z$ standard deviations.", r"把 $z$ 换回美元：均值加上 $z$ 个标准差。")),
                    (r"P(X < b) = 0.90 \;\Rightarrow\; z = 1.28,\quad b = 409000 + 1.28(19500) = 433960", T(r"The upper 10% has 0.90 to its left; by symmetry $z = +1.28$.", r"最高的 10% 左边是 0.90；由对称性 $z = +1.28$。")),
                    (r"P(Z < z_a) = P(Z < -1.23) = 0.1093", T(r"(iv) The area left of 385,000: $z = (385000 - 409000)/19500 = -1.23$, table 0.1093.", r"(iv) 385,000 左边的面积：$z = (385000 - 409000)/19500 = -1.23$，表值 0.1093。")),
                    (r"P(Z < z_d) = 0.1093 + 0.4503 = 0.5596 \;\Rightarrow\; z_d = 0.15", T(r"Between = left of $d$ minus left of 385,000, so the area left of $d$ is 0.1093 + 0.4503. The table has exactly 0.5596 at $z = 0.15$.", r"之间 = $d$ 左边减去 385,000 左边，所以 $d$ 左边的面积是 0.1093 + 0.4503。表里正好在 $z = 0.15$ 处有 0.5596。")),
                    (r"d = 409000 + 0.15(19500) = 411925", T(r"Back to dollars.", r"换回美元。"))],
                   outro=T(r"**Answer:** (iii) \$384,040 and \$433,960; (iv) $d = \$411{,}925$.", r"**答案：** (iii) \$384,040 和 \$433,960；(iv) $d = \$411{,}925$。"),
                   blank=(5, '411925', T(r"$409000 + 0.15 \times 19500$.", r"$409000 + 0.15 \times 19500$。")), skill=SK),
            read('answer', T('The full-mark answers, as they are written', '满分答案，写在卷子上是这样'),
                 paper(T('Question 5 (i) to (iv), full marks', '第 5 题 (i) 到 (iv)，满分写法'),
                       *ptxt("(i) P(X < 380,000) = P(Z < (380,000 − 409,000)/19,500) = P(Z < −1.49) = 0.0681\n(ii) P(370,000 < X < 450,000) = P(X < 450,000) − P(X < 370,000) = P(Z < 2.10) − P(Z < −2.00) = 0.9821 − 0.0228 = 0.9593\n(iii) P(X < a) = 0.10: from the table z = −1.28, so a = 409,000 + (−1.28)(19,500) = $384,040. P(X < b) = 0.90: z = 1.28, so b = 409,000 + 1.28(19,500) = $433,960.\n(iv) P(385,000 < X < d) = P(X < d) − P(X < 385,000) = 0.4503. P(X < 385,000) = P(Z < −1.23) = 0.1093, so P(Z < z_d) = 0.5596, z_d = 0.15, d = 409,000 + 0.15(19,500) = $411,925.",
                             "(i) P(X < 380,000) = P(Z < (380,000 − 409,000)/19,500) = P(Z < −1.49) = 0.0681\n(ii) P(370,000 < X < 450,000) = P(X < 450,000) − P(X < 370,000) = P(Z < 2.10) − P(Z < −2.00) = 0.9821 − 0.0228 = 0.9593\n(iii) P(X < a) = 0.10：查表 z = −1.28，所以 a = 409,000 + (−1.28)(19,500) = $384,040。P(X < b) = 0.90：z = 1.28，所以 b = 409,000 + 1.28(19,500) = $433,960。\n(iv) P(385,000 < X < d) = P(X < d) − P(X < 385,000) = 0.4503。P(X < 385,000) = P(Z < −1.23) = 0.1093，所以 P(Z < z_d) = 0.5596，z_d = 0.15，d = 409,000 + 0.15(19,500) = $411,925。"), answer=True),
                 callout('note', T('What earns the marks', '得分点'), T(r"Write the conversion to $z$ with the numbers in it, the table value you read, and the final answer in the original units. Marks go for each of the three, so a wrong table read costs one mark, not all of them.", r"写出代入数字的 $z$ 换算、你查到的表值，以及用原单位表示的最终答案。三者各有分，所以查错一个表值只丢一分，不会全丢。")),
                 chapter=T('The answer', '答案')),
            number('pay', T('Financial managers’ pay', '财务经理的薪酬'), SK,
                   T(r"Hourly pay of financial managers is normal with mean \$32.62 and standard deviation \$2.32. What is the probability that a manager earns **between \$30 and \$35**? (Four decimals; round each $z$ to two decimals first.)", r"财务经理的时薪服从正态分布，均值 \$32.62，标准差 \$2.32。一位经理时薪**在 \$30 到 \$35 之间**的概率是多少？（四位小数；每个 $z$ 先取两位小数。）"),
                   pay, T(r"$z = (30 - 32.62)/2.32 = -1.13$ and $z = (35 - 32.62)/2.32 = 1.03$. Table: $0.8485 - 0.1292 = 0.7193$. For the top 10%: $z = 1.28$, so the hourly rate is $32.62 + 1.28(2.32) = \$35.59$.", r"$z = (30 - 32.62)/2.32 = -1.13$，$z = (35 - 32.62)/2.32 = 1.03$。查表：$0.8485 - 0.1292 = 0.7193$。最高的 10%：$z = 1.28$，所以时薪是 $32.62 + 1.28(2.32) = \$35.59$。"), tolerance=0.00006, purpose='practice'),
            read('traps', T('Traps', '易错点'),
                 callout('warning', T('Area, not height', '是面积，不是高度'), T(r"A normal probability is always an area. The height of the curve at a point is not a probability.", r"正态概率永远是面积。曲线在一点的高度不是概率。")),
                 callout('warning', T('Left, left, left', '左边、左边、左边'), T(r"The table is the area to the **left**. “Above” and “more than”: $1 -$ table. “Between”: subtract two table values.", r"表是**左边**的面积。“高于”“超过”：$1 -$ 表值。“之间”：两个表值相减。")),
                 callout('warning', T('Negative z', '负的 z'), T(r"A negative $z$ lives on the negative page: $-1.49$ is row $-1.4$, column .09. Mixing it up with 1.49 gives 0.9319 instead of 0.0681.", r"负的 $z$ 在负数那页：$-1.49$ 是行 $-1.4$、列 .09。和 1.49 搞混就会得到 0.9319 而不是 0.0681。")),
                 chapter=T('Traps', '易错点')),
            choice('recall_binom', T('Recall: at least one', '回忆：至少一次'), SK,
                   T(r"A machine fails a test with probability 0.05 each time, independently. In 4 tests, the probability that it fails at least once is:", r"一台机器每次测试独立地以 0.05 的概率不合格。4 次测试里至少不合格一次的概率是："),
                   [(r"$1 - 0.95^4$", True), (r"$4 \times 0.05$", T(r"That adds the chances and double counts the cases where it fails twice or more.", r"那是把概率相加，会把失败两次或更多次的情形重复算。"), 'at-least-one'), (r"$0.05^4$", T(r"That is the chance it fails *every* time.", r"那是它*每次*都不合格的概率。"), None)],
                   T(r"“At least one” is 1 minus “none”.", r"“至少一次”是 1 减去“一次也没有”。"), purpose='check'),
            choice('recall_sd', T('Recall: sample standard deviation', '回忆：样本标准差'), SK,
                   T(r"The paper’s formula sheet gives the sample variance. What does it divide the sum of squared deviations by?", r"试卷的公式表给出了样本方差。它把偏差平方和除以什么？"),
                   [(r"$n - 1$", True), (r"$n$", T(r"That is for a whole population.", r"那是用于整个总体的。"), 'divide-by-n'), (r"$n + 1$", T(r"No formula uses this.", r"没有哪个公式用它。"), None)],
                   T(r"Sample: $n - 1$.", r"样本：$n - 1$。"), purpose='check'),
        ],
    )
