# Lesson 17 (drill): can you do it against the clock? Fifteen new-number questions across the whole subject, mixed on purpose so the
# neighbouring ideas have to be told apart. Every answer is computed below (LP with the engine and scipy, the rest with plain arithmetic
# and the paper's table); nothing is the paper's own numbers.
import math
from common import *
from l05_network import transport

SK = 'mg.drill'


def L_drill():
    # D1: a bakery to formulate (a percentage limit and a minimum)
    rows1 = [([2, 4], '<=', 120), ([1, 1.5], '<=', 90), ([0, 1], '>=', 10), ([.4, -.6], '<=', 0)]
    bk = lp_solve('max', [3, 5], rows1)
    BK_ROWS = [dict(a=[2, 4], op='<=', b=120, label=T('Oven minutes', '烤箱分钟数')), dict(a=[1, 1.5], op='<=', b=90, label=T('Flour (kg)', '面粉（公斤）')),
               dict(a=[0, 1], op='>=', b=10, label=T('At least 10 cakes', '蛋糕至少 10 个')), dict(a=[.4, -.6], op='<=', b=0, label=T('Bread at most 60% of all items', '面包至多占全部的 60%'))]
    # D2: a report to read
    rows2 = [([3, 2], '<=', 240), ([1, 1], '<=', 100), ([1, 0], '<=', 70)]
    ch = lp_solve('max', [40, 30], rows2)
    assert ch['status'] == 'optimal'
    RP_ROWS = [dict(a=[3, 2], op='<=', b=240, label=T('Wood (boards)', '木料（块）')), dict(a=[1, 1], op='<=', b=100, label=T('Carpenter hours', '木工工时')), dict(a=[1, 0], op='<=', b=70, label=T('Demand for chairs', '椅子的需求量'))]
    sh_w = ch['rows'][0]['shadow']; inc_w = ch['rows'][0]['inc']
    up30 = lp_solve('max', [40, 30], [([3, 2], '<=', 270), rows2[1], rows2[2]])
    assert abs((up30['obj'] - ch['obj']) - 30 * sh_w) < 1e-6 and inc_w >= 30
    # D3: balance
    tp = transport([[4, 6, 5], [3, 7, 4]], [500, 400], [300, 350, 400])
    # D4: EVPI on a cost table
    V = [[40, 70], [55, 50]]; p1 = .6
    evs = [p1 * a + (1 - p1) * b for a, b in V]; wopi = min(evs); wpi = p1 * min(V[0][0], V[1][0]) + (1 - p1) * min(V[0][1], V[1][1]); evpi = abs(wpi - wopi)
    assert (round(evs[0], 6), round(evs[1], 6), round(wpi, 6), round(evpi, 6)) == (52, 53, 44, 8)
    # D5: Bayes
    pdef = .3 * .02 + .7 * .05; pA = .3 * .02 / pdef
    assert round(pdef, 3) == .041 and round(pA, 3) == .146
    # D6: a small tree
    tree = dict(k='decision', l=T('Launch?', '要不要推出？'), c=[
        dict(k='chance', l=T('Launch', '推出'), e=T('Launch', '推出'), c=[dict(k='leaf', value=100, e=T('Success', '成功'), p=.6), dict(k='leaf', value=-40, e=T('Failure', '失败'), p=.4)]),
        dict(k='chance', l=T('Partner', '找合作方'), e=T('Partner', '合作'), c=[dict(k='leaf', value=70, e=T('Success', '成功'), p=.5), dict(k='leaf', value=10, e=T('Failure', '失败'), p=.5)]),
        dict(k='leaf', value=20, e=T('Do nothing', '什么都不做'))])
    roll(tree, 'max')
    assert [round(c['v'], 2) for c in tree['c']] == [44, 40, 20] and tree['best'] == 0
    # D7, D8: the normal
    z62 = round((62 - 50) / 8, 2); p62 = round(1 - ztable(z62), 4); top10 = 50 + z_from_table(.90) * 8
    assert (z62, p62) == (1.5, .0668) and round(top10, 2) == 60.24
    # D9: regression from sums
    b1 = 240 / 80; b0 = 55 - b1 * 10; yh = b0 + b1 * 12; r2 = 720 / (720 + 80)
    assert (b1, b0, yh) == (3, 25, 61) and r2 == .9
    # D10: describe
    data = [12, 15, 11, 18, 14, 20, 13, 16]; s = sorted(data)
    q1, q3 = (s[1] + s[2]) / 2, (s[5] + s[6]) / 2
    assert (q1, q3, q3 - q1) == (12.5, 17, 4.5)
    # D11, D12
    pc = 30 / 100; atl = 1 - .8 ** 5
    assert round(atl, 4) == .6723
    # D15: criteria
    PV = [[50, 30], [80, 10], [120, -20]]
    reg = [[max(c) - v for v, c in zip(row, zip(*PV))] for row in PV]; mr = [max(r) for r in reg]
    assert mr == [70, 40, 50] and min(range(3), key=lambda i: mr[i]) == 1
    return dict(
        id=f'{CID}-drill',
        title=T('Can you do it against the clock?', '计时的话，你做得出来吗？'),
        description=T('Fifteen questions on new numbers, from every part of the subject, in mixed order on purpose. About 1.2 minutes a mark: give yourself 40 minutes for all of them, with the formula sheet and the table in mind and a Casio fx-82 in hand.',
                      '十五道换了数的题，来自这门课的每个部分，故意打乱顺序。大约每分 1.2 分钟：把全部做完给自己 40 分钟，想着公式表和那张表，手里拿一台 Casio fx-82。'),
        minutes=45,
        skills=[{'id': SK, 'name': T('The whole exam, mixed', '整张试卷，混合题')}],
        steps=[
            read('start', T('Fifteen questions, mixed', '十五道题，混在一起'),
                 p(T(r"The questions come in a mixed order, as an exam’s do not: formulation, a report, a table to balance, a decision, a distribution, a regression. Work each as you would on the paper: write the line, then the number. If an answer surprises you, the explanation names the lesson to reread. First, a formulation: the checker is here too, as in lesson 2.", r"这些题的顺序是混合的，就像真正的考试一样：建模、读报告、补平一张表、做决策、分布、回归。每道题都像在试卷上那样做：先写算式，再写数。如果答案让你意外，解释里会说出该重读哪一课。先是一道建模题：检查器也在这里，和第 2 课一样。")),
                 p(T(r"A bakery makes bread (profit \$3 each) and cakes (profit \$5 each). The oven has 120 minutes: bread takes 2, a cake 4. Flour is 90 kg: bread uses 1 kg, a cake 1.5 kg. At least 10 cakes must be made, and bread must be **at most 60%** of all the items made. Maximise profit.", r"一家面包店做面包（每个利润 \$3）和蛋糕（每个利润 \$5）。烤箱有 120 分钟：面包用 2 分钟，蛋糕用 4 分钟。面粉 90 公斤：面包用 1 公斤，蛋糕用 1.5 公斤。蛋糕至少要做 10 个，并且面包**至多占**全部产品的 **60%**。求利润最大。")),
                 frame('lp_check.html', T('The checker for the bakery.', '面包店的检查器。'), vars=['b', 'c'], names=[T('b = loaves of bread', 'b = 面包的个数'), T('c = cakes', 'c = 蛋糕的个数')], sense='max', c=[3, 5], goal=T('profit', '利润'), money='$', rows=BK_ROWS, lines=5),
                 chapter=T('Formulate', '建模')),
            number('d1', T('The bakery’s best profit', '面包店的最大利润'), SK, T(r"Solved, what is the bakery’s largest profit in dollars?", r"解出来，面包店的最大利润是多少美元？"),
                   round(bk['obj'], 2), T(rf"The optimum is {n(bk['x'][0], 2)} loaves and {n(bk['x'][1], 2)} cakes, profit {usd(bk['obj'], 2)}. The percentage limit is $b \le 0.6(b + c)$, which becomes $0.4b - 0.6c \le 0$ (lesson 4).", rf"最优解是 {n(bk['x'][0], 2)} 个面包和 {n(bk['x'][1], 2)} 个蛋糕，利润 {usd(bk['obj'], 2)}。百分比限制是 $b \le 0.6(b + c)$，移项后是 $0.4b - 0.6c \le 0$（第 4 课）。"), tolerance=0.02, unit=T('dollars', '美元'), purpose='check'),
            number('d4', T('What a forecast is worth', '一个预测值多少钱'), SK,
                   T(r"Two routes cost (in minutes) 40 or 70 for route A and 55 or 50 for route B, in light or heavy traffic. Heavy traffic has probability 0.4. What is EVPI?", r"两条路线在畅通或拥堵时的用时（分钟）：A 路线 40 或 70，B 路线 55 或 50。拥堵的概率是 0.4。EVPI 是多少？"),
                   evpi, T(r"EV(A) $= 0.6(40) + 0.4(70) = 52$, EV(B) $= 0.6(55) + 0.4(50) = 53$, so EVwoPI $= \min = 52$. EVwPI $= 0.6(40) + 0.4(50) = 44$ (the smaller time in each state). EVPI $= |44 - 52| = 8$ minutes. (Lesson 10.)", r"EV(A) $= 0.6(40) + 0.4(70) = 52$，EV(B) $= 0.6(55) + 0.4(50) = 53$，所以 EVwoPI $= \min = 52$。EVwPI $= 0.6(40) + 0.4(50) = 44$（每个状态取较小的时间）。EVPI $= |44 - 52| = 8$ 分钟。（第 10 课。）"), tolerance=0.01, purpose='check'),
            read('report', T('A report to read', '一份要读的报告'),
                 p(T(r"A workshop makes chairs (profit \$40) and tables (\$30). Wood: 3 boards a chair, 2 a table, 240 available. Carpenter hours: 1 each, 100 available. Demand: at most 70 chairs. Here is the sensitivity report of its best plan.", r"一家作坊做椅子（利润 \$40）和桌子（\$30）。木料：椅子 3 块、桌子 2 块，共 240 块。木工工时：各 1 小时，共 100 小时。需求：椅子至多 70 把。下面是它的最优计划的灵敏度报告。")),
                 frame('lp_report.html', T('The sensitivity report of the workshop.', '作坊的灵敏度报告。'), rows=RP_ROWS, obj=[40, 30], sense='max', vars=['x1', 'x2'], money='$', view=[90, 130], axes=[T('chairs', '椅子'), T('tables', '桌子')], var_names=[T('chairs', '椅子'), T('tables', '桌子')]),
                 chapter=T('Read a report', '读报告')),
            number('d2', T('Thirty more boards', '多 30 块木料'), SK, T(r"The wood supply rises from 240 to 270 boards. By how much does the best profit change, in dollars? (Use the report; check the 270 is inside the allowable stretch.)", r"木料从 240 块增加到 270 块。最大利润变化多少美元？（用报告；检查 270 在允许范围之内。）"),
                   round(30 * sh_w, 2), T(rf"The shadow price of wood is {n(sh_w, 2)} and the allowable increase is {n(inc_w, 2)}, so +30 is inside: $30 \times {n(sh_w, 2)} = {n(30 * sh_w, 2)}$. (Lesson 3.)", rf"木料的影子价格是 {n(sh_w, 2)}，允许增量是 {n(inc_w, 2)}，所以 +30 在范围内：$30 \times {n(sh_w, 2)} = {n(30 * sh_w, 2)}$。（第 3 课。）"), tolerance=0.02, unit=T('dollars', '美元'), purpose='check'),
            choice('d3', T('A table that does not balance', '一张不平衡的表'), SK,
                   T(r"Two plants supply 500 and 400 units; three customers demand 300, 350 and 400. What does the transportation table need?", r"两个工厂供应 500 和 400 件；三个客户需求 300、350 和 400 件。运输表需要什么？"),
                   [(T(rf"A dummy origin of {n(sum([300, 350, 400]) - 900, 0)} units with cost 0: demand (1,050) exceeds supply (900).", rf"一个 {n(sum([300, 350, 400]) - 900, 0)} 件、运费为 0 的虚拟供应地：需求（1,050）超过供应（900）。"), True),
                    (T(r"A dummy destination of 150 units.", r"一个 150 件的虚拟需求地。"), T(r"That is for surplus supply; here demand is larger.", r"那是用于供应有剩的；这里是需求更大。"), 'dummy-wrong-side'),
                    (T(r"Nothing: the table solves as it is.", r"什么都不用：表这样就能解。"), T(r"Total supply must be able to meet total demand.", r"总供应必须能和总需求对上。"), None)],
                   T(r"Short on supply: add a dummy origin of the shortfall at cost 0 (lesson 5).", r"供应不足：加一个数量等于缺口、运费为 0 的虚拟供应地（第 5 课）。"), purpose='check'),
            read('tree', T('A small tree', '一棵小树'),
                 p(T(r"A firm can launch a product (success 0.6 gives 100, failure 0.4 gives −40), find a partner (success 0.5 gives 70, failure 0.5 gives 10) or do nothing (20). Roll it back.", r"一家公司可以推出产品（成功概率 0.6 得 100，失败概率 0.4 得 −40）、找合作方（成功概率 0.5 得 70，失败概率 0.5 得 10），或者什么都不做（20）。把它倒推出来。")),
                 frame('tree_roll.html', T('Roll the tree back: the value of each chance node and the best choice.', '把树倒推回来：每个机会节点的值，以及最好的选择。'), tree=tree, sense='max', unit='$'),
                 chapter=T('Decide', '决策')),
            choice('d15', T('Three attitudes to risk', '三种风险态度'), SK,
                   T(r"Profits for three options in two states: A: 50, 30; B: 80, 10; C: 120, −20. Which option does the **minimax regret** rule choose?", r"三个方案在两种状态下的利润：A：50、30；B：80、10；C：120、−20。**最小最大后悔**准则选哪个？"),
                   [(T(r"B: the largest regrets are A 70, B 40, C 50, and B’s 40 is the smallest.", r"B：最大后悔值是 A 70、B 40、C 50，B 的 40 最小。"), True),
                    (T(r"C: it has the biggest payoff.", r"C：它的收益最大。"), T(r"That is the optimistic rule. Regret compares each cell with the best of its column.", r"那是乐观准则。后悔值是把每个格子和它所在列的最好值比较。"), 'criteria-agree'),
                    (T(r"A: it has the best worst case.", r"A：它的最坏情形最好。"), T(r"That is the conservative rule.", r"那是保守准则。"), 'criteria-agree')],
                   T(r"Regrets: state 1 (best 120): 70, 40, 0; state 2 (best 30): 0, 20, 50. Maxima: 70, 40, 50 (lesson 9).", r"后悔值：状态 1（最好 120）：70、40、0；状态 2（最好 30）：0、20、50。各行最大值：70、40、50（第 9 课）。"), purpose='check'),
            number('d5', T('Which machine?', '哪台机器？'), SK,
                   T(r"Machine A makes 30% of the parts, 2% of its parts are defective; machine B makes 70%, 5% of its parts are defective. A part is found defective. What is the probability it came from machine A? (Three decimals.)", r"机器 A 生产 30% 的零件，其中 2% 是次品；机器 B 生产 70%，其中 5% 是次品。发现一个零件是次品。它来自机器 A 的概率是多少？（三位小数）"),
                   round(pA, 3), T(r"Joint: A and defective $0.3 \times 0.02 = 0.006$; B and defective $0.7 \times 0.05 = 0.035$. Total $P(\text{defective}) = 0.041$. Posterior $0.006/0.041 = 0.146$ (lesson 11). Machine B makes the larger share *and* the worse parts, so most defects are its.", r"联合概率：A 且次品 $0.3 \times 0.02 = 0.006$；B 且次品 $0.7 \times 0.05 = 0.035$。总的 $P(\text{次品}) = 0.041$。后验 $0.006/0.041 = 0.146$（第 11 课）。B 产量更大，*而且*零件更差，所以大部分次品是它的。"), tolerance=0.0006, purpose='check'),
            number('d7', T('Above 62', '高于 62'), SK, T(r"A measurement is normal with mean 50 and standard deviation 8. What is the probability that it is **above** 62? (Four decimals.)", r"某个测量值服从正态分布，均值 50，标准差 8。它**高于** 62 的概率是多少？（四位小数）"),
                   p62, T(r"$z = (62 - 50)/8 = 1.50$; table 0.9332; above: $1 - 0.9332 = 0.0668$ (lesson 13).", r"$z = (62 - 50)/8 = 1.50$；查表 0.9332；高于：$1 - 0.9332 = 0.0668$（第 13 课）。"), tolerance=0.00006, purpose='check'),
            number('d8', T('The top tenth', '最高的十分之一'), SK, T(r"For the same measurement, what value cuts off the top 10%? (Use $z = 1.28$; two decimals.)", r"同一个测量值，多大的值把最高的 10% 切出来？（用 $z = 1.28$；两位小数）"),
                   round(top10, 2), T(r"The area to the left is 0.90, whose closest table entry is at $z = 1.28$: $50 + 1.28 \times 8 = 60.24$.", r"左边的面积是 0.90，最接近的表值在 $z = 1.28$：$50 + 1.28 \times 8 = 60.24$。"), tolerance=0.006, purpose='check'),
            number('d9', T('A prediction from the sums', '由各个和做预测'), SK,
                   T(r"For a simple regression: $\bar x = 10$, $\bar y = 55$, $\sum (x_i - \bar x)(y_i - \bar y) = 240$, $\sum (x_i - \bar x)^2 = 80$. Predict $y$ for $x = 12$.", r"一元回归：$\bar x = 10$，$\bar y = 55$，$\sum (x_i - \bar x)(y_i - \bar y) = 240$，$\sum (x_i - \bar x)^2 = 80$。预测 $x = 12$ 时的 $y$。"),
                   yh, T(r"$b_1 = 240/80 = 3$; $b_0 = 55 - 3(10) = 25$; $\hat y = 25 + 3(12) = 61$ (lesson 14). If SSR is 720 and SSE 80, $r^2 = 720/800 = 0.90$.", r"$b_1 = 240/80 = 3$；$b_0 = 55 - 3(10) = 25$；$\hat y = 25 + 3(12) = 61$（第 14 课）。如果 SSR 是 720、SSE 是 80，则 $r^2 = 720/800 = 0.90$。"), tolerance=0.01, purpose='check'),
            number('d10', T('The interquartile range', '四分位距'), SK, T(r"Find the IQR of 12, 15, 11, 18, 14, 20, 13, 16 (sorted first; the course’s percentile rule).", r"求 12、15、11、18、14、20、13、16 的四分位距（先排序；按课上的百分位规则）。"),
                   q3 - q1, T(r"Sorted: 11, 12, 13, 14, 15, 16, 18, 20. $i = 0.25 \times 8 = 2$ is whole, so Q1 averages the 2nd and 3rd values: 12.5. $i = 6$: Q3 averages the 6th and 7th: $(16 + 18)/2 = 17$. IQR $= 17 - 12.5 = 4.5$ (lesson 7).", r"排序：11, 12, 13, 14, 15, 16, 18, 20。$i = 0.25 \times 8 = 2$ 是整数，所以 Q1 取第 2 和第 3 个值的平均：12.5。$i = 6$：Q3 取第 6 和第 7 个的平均：$(16 + 18)/2 = 17$。IQR $= 17 - 12.5 = 4.5$（第 7 课）。"), tolerance=0.01, purpose='check'),
            number('d11', T('A conditional probability', '一个条件概率'), SK,
                   T(r"Of 100 online customers, 30 bought; of 200 in-store customers, 80 bought. What is $P(\text{bought} \mid \text{online})$?", r"100 位网购顾客里有 30 人买了；200 位到店顾客里有 80 人买了。$P(\text{买了} \mid \text{网购})$ 是多少？"),
                   pc, T(r"Restrict to the online customers and divide by their own total: $30/100 = 0.30$. (Not $30/300$, not $30/110$: lesson 8.)", r"把范围限制在网购顾客，除以他们自己的总数：$30/100 = 0.30$。（不是 $30/300$，也不是 $30/110$：第 8 课。）"), tolerance=0.005, purpose='check'),
            number('d12', T('At least one fault', '至少一个故障'), SK,
                   T(r"Each of 5 independent tests finds a fault with probability 0.2. What is the probability that at least one test finds one? (Four decimals.)", r"5 次独立的测试，每次发现故障的概率是 0.2。至少一次发现故障的概率是多少？（四位小数）"),
                   round(atl, 4), T(r"$1 - 0.8^5 = 1 - 0.3277 = 0.6723$ (lesson 12).", r"$1 - 0.8^5 = 1 - 0.3277 = 0.6723$（第 12 课）。"), tolerance=0.00006, purpose='check'),
            choice('d13', T('Reading an output', '读一份输出'), SK,
                   T(r"A multiple regression has adjusted $R^2 = 0.62$ and Significance F $= 0.003$. One variable has a P-value of 0.40. Which statement is best?", r"一个多元回归的调整后 $R^2 = 0.62$，Significance F $= 0.003$。有一个变量的 P-value 是 0.40。哪句话最好？"),
                   [(T(r"The model as a whole is useful (Significance F below 0.05), but that variable is not significant: consider dropping it.", r"模型整体是有用的（Significance F 小于 0.05），但那个变量不显著：可以考虑去掉它。"), True),
                    (T(r"Every variable is significant because the model is.", r"模型显著，所以每个变量都显著。"), T(r"F tests the group, each t test one variable.", r"F 检验整体，每个 t 检验一个变量。"), 'f-vs-t'),
                    (T(r"The model is useless because one P-value is large.", r"一个 P 值大，所以模型没用。"), T(r"One weak variable does not undo a significant F.", r"一个弱变量推翻不了显著的 F。"), 'f-vs-t')],
                   T(r"Whole model: Significance F. One variable: its own P-value (lesson 15).", r"整个模型：Significance F。一个变量：它自己的 P-value（第 15 课）。"), purpose='check'),
            choice('d14', T('At most two of four', '四个里至多两个'), SK,
                   T(r"“Of four projects, at most two may be built.” With yes/no variables $y_1, \ldots, y_4$:", r"“四个项目里至多建两个。”用 0-1 变量 $y_1, \ldots, y_4$ 表示："),
                   [(r"$y_1 + y_2 + y_3 + y_4 \le 2$", True), (r"$y_1 + y_2 + y_3 + y_4 \ge 2$", T(r"That says at least two.", r"那是至少两个。"), None), (r"$y_1 y_2 y_3 y_4 \le 2$", T(r"A product is not linear; and not what is meant.", r"乘积不是线性的，也不是要表达的意思。"), None)],
                   T(r"The sum counts how many are built (lesson 6).", r"总和就是建了几个（第 6 课）。"), purpose='check'),
            read('end', T('How did it go?', '做得怎么样？'),
                 p(T(r"Count what you got without looking at an explanation. Fewer than ten: reread the lessons named in the explanations of the ones you lost, then do this set again in a week. Ten or more: do the 2025 paper in lesson 16’s order against a real clock, with only a pen, the formula sheet and a Casio fx-82.", r"数一数你没看解释就做对了几道。少于十道：重读你丢分的那几道的解释里点名的课，一周后再做一遍这套题。十道或更多：按第 16 课的顺序，对着真正的钟，只用一支笔、公式表和一台 Casio fx-82，做一遍 2025 年的试卷。")),
                 chapter=T('Finish', '收尾')),
        ],
    )
