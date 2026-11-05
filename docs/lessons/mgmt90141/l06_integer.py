# Lesson 6 (integer): why you cannot just round, and what a yes/no variable is. Decks: W4 (pure, binary and mixed integer; Princess Brides,
# the university projects, Quemo Chemical, Martin-Beck) and "Additional constraints" (if-then, at most one, k of n, big M).
# The 2025 paper has no integer question; the skills are the same formulation skills. Instruments: lp_plane (lattice), logic_check.
# The engine is LP only, so integer optima are found by enumerating the whole-number or yes/no plans and checked by scipy's milp.
import itertools
from common import *

SK = 'mg.integer'
BRIDES = [dict(a=[390, 240], op='<=', b=1800, label=T('Weekly budget', '每周预算')), dict(a=[1, 0], op='>=', b=2, label=T('At least 2 prime-time ads', '黄金时段广告至少 2 条')), dict(a=[0, 1], op='<=', b=6, label=T('At most 6 off-peak ads', '非黄金时段广告至多 6 条'))]


def L_integer():
    # Princess Brides: the LP answer, the rounded answers, the best whole-number answer
    lp = lp_solve('max', [8200, 5100], [(r['a'], r['op'], r['b']) for r in BRIDES])
    feas = lambda x1, x2: 390 * x1 + 240 * x2 <= 1800 and x1 >= 2 and x2 <= 6
    ints = [(8200 * a + 5100 * b, a, b) for a in range(0, 8) for b in range(0, 9) if feas(a, b)]
    best_int = max(ints)
    assert (round(lp['x'][0], 6), round(lp['x'][1], 6)) == (2, 4.25) and round(lp['obj']) == 38075
    assert not feas(2, 5) and feas(2, 4) and 8200 * 2 + 5100 * 4 == 36800 and best_int == (37900, 4, 1)
    from scipy.optimize import milp, LinearConstraint, Bounds
    r = milp([-8200, -5100], constraints=LinearConstraint([[390, 240]], -float('inf'), 1800), integrality=[1, 1], bounds=Bounds([2, 0], [float('inf'), 6]))
    assert round(-r.fun) == 37900
    # Quemo: 8 yes/no combinations
    NPV, Y1, Y2 = [25000, 18000, 32000], [8000, 6000, 12000], [7000, 4000, 8000]
    ok = lambda c: sum(a * b for a, b in zip(Y1, c)) <= 20000 and sum(a * b for a, b in zip(Y2, c)) <= 16000 and sum(c) <= 2 and c[1] >= c[0]
    qs = sorted(((sum(a * b for a, b in zip(NPV, c)), c) for c in itertools.product([0, 1], repeat=3) if ok(c)), reverse=True)
    q_best = qs[0]
    # the university projects: 256 combinations
    IMP = [.191, .107, .091, .094, .126, .132, .116, .144]
    COST, SPACE, TH, TS = [71400, 57000, 50000, 35700, 4300, 2100, 6400, 28600], [12500, 2500, 10800, 625], [24, 6, 15, 12], [6, 12, 9]
    uni = max((sum(a * b for a, b in zip(IMP, c)), c) for c in itertools.product([0, 1], repeat=8)
              if sum(a * b for a, b in zip(COST, c)) <= 150000 and sum(a * b for a, b in zip(SPACE, c[:4])) <= 25000 and sum(a * b for a, b in zip(TH, c[:4])) <= 36
              and sum(a * b for a, b in zip(TS, c[4:7])) <= 24 and sum(c) >= 4 and sum(c[:4]) >= 1 and sum(c[4:]) >= 1)
    # Martin-Beck: fixed-charge location. For each choice of the four new plants solve the shipping LP; the cheapest total is the answer.
    FIX, CAP = [175000, 300000, 375000, 500000], [10000, 20000, 30000, 40000]
    SH = [[5, 2, 3], [4, 3, 4], [9, 7, 5], [10, 4, 2], [8, 4, 3]]
    best_mb = None
    for y in itertools.product([0, 1], repeat=4):
        caps = [CAP[i] * y[i] for i in range(4)] + [30000]
        cs = [c for row in SH for c in row]
        rows = [([1 if k // 3 == i else 0 for k in range(15)], '<=', caps[i]) for i in range(5)] + [([1 if k % 3 == j else 0 for k in range(15)], '=', d) for j, d in enumerate([30000, 20000, 20000])]
        s = lp_solve('min', cs, rows)
        if s['status'] != 'optimal': continue
        tot = s['obj'] + sum(f * v for f, v in zip(FIX, y))
        if best_mb is None or tot < best_mb[0] - 1e-9: best_mb = (tot, y, s['x'])
    mb = best_mb
    names = [T('Detroit', '底特律'), T('Toledo', '托莱多'), T('Denver', '丹佛'), T('Kansas City', '堪萨斯城')]
    plants = ', '.join(n_.__getitem__('en') for n_, v in zip(names, mb[1]) if v)
    plants_zh = '、'.join(n_['zh'] for n_, v in zip(names, mb[1]) if v)
    stm = lambda en, zh, f: dict(label=T(en, zh), allowed=[list(c) for c in itertools.product([0, 1], repeat=3) if f(c)])
    STM = [stm('The converter (x1) only if the software (x2) is bought too', '催化转化器（x1）只有在也买软件（x2）时才买', lambda c: c[0] <= c[1]),
           stm('At most one of the converter and the software', '催化转化器和软件至多买一个', lambda c: c[0] + c[1] <= 1),
           stm('At most two of the three projects', '三个项目至多做两个', lambda c: sum(c) <= 2),
           stm('The converter and the warehouse together, or neither', '催化转化器和仓库要么一起做，要么都不做', lambda c: c[0] == c[2]),
           stm('Exactly one of the three projects', '三个项目正好做一个', lambda c: sum(c) == 1)]
    return dict(
        id=f'{CID}-integer',
        title=T('Why you cannot just round, and what a yes/no variable is', '为什么不能直接四舍五入，以及“是/否”变量是什么'),
        description=T('Half an advertisement makes no sense. See why rounding an LP answer can lose, then turn yes/no decisions into 0-1 variables and write “only if”, “at most one” and “fixed cost” as lines a solver can use.',
                      '半条广告没有意义。看看为什么把 LP 的答案四舍五入可能吃亏，再把“做不做”的决策变成 0-1 变量，把“只有……才……”“至多一个”“固定成本”写成求解器能用的行。'),
        minutes=40,
        skills=[{'id': SK, 'name': T('Integer and binary models', '整数规划与 0-1 模型')}],
        misconceptions=[{'id': 'round-it', 'description': T('Rounding an LP answer to get the integer answer', '把 LP 答案四舍五入当作整数答案')},
                        {'id': 'y-without-link', 'description': T('Adding a yes/no variable for a fixed cost without linking it to the quantity', '为固定成本加了 0-1 变量，却没有把它和数量连起来')}],
        steps=[
            read('round', T('A fraction of an advertisement', '半条广告'),
                 p(T(r"Princess Brides, a wedding planner, buys radio ads. A prime-time ad costs \$390 and reaches 8,200 people; an off-peak ad costs \$240 and reaches 5,100. The weekly budget is \$1,800, she wants at least 2 prime-time ads, and the station sells at most 6 off-peak ads. Goal: the largest audience. The blue dots are the plans that use whole ads.", r"婚礼策划公司 Princess Brides 买电台广告。一条黄金时段广告 \$390，触达 8,200 人；一条非黄金时段广告 \$240，触达 5,100 人。每周预算 \$1,800，她要求黄金时段广告至少 2 条，电台非黄金时段广告最多卖 6 条。目标：触达的人最多。蓝点是用整条广告的那些计划。")),
                 frame('lp_plane.html', T('The plan plane with the whole-number plans marked as dots.', '标出了整数计划（蓝点）的计划平面。'),
                       caption=T(r"Press the button: the green ring is the LP’s best plan, the gold ring the best whole-number plan.", r"按按钮：绿圈是 LP 的最优计划，金圈是最好的整数计划。"),
                       rows=BRIDES, obj=[8200, 5100], sense='max', view=[7, 9], tools='plan,sweep', lattice=True, snap=1, start=[3, 3], money='', axes=[T('prime-time ads', '黄金时段广告'), T('off-peak ads', '非黄金时段广告')], measure=T('Audience', '触达人数'), corners=False),
                 chapter=T('Touch', '动手')),
            choice('round_it', T('Round the LP answer?', '把 LP 答案四舍五入？'), SK,
                   T(rf"The LP’s best plan is 2 prime-time and 4.25 off-peak ads, reaching 38,075 people. A manager says: round 4.25 to 4 and you are done, 2 and 4, reaching {n(8200 * 2 + 5100 * 4, 0)}. Is that the best whole-number plan?", rf"LP 的最优计划是 2 条黄金时段和 4.25 条非黄金时段广告，触达 38,075 人。经理说：把 4.25 四舍五入成 4 就行了，2 条和 4 条，触达 {n(8200 * 2 + 5100 * 4, 0)} 人。这是最好的整数计划吗？"),
                   [(T(rf"No. 4 prime-time and 1 off-peak is allowed and reaches {n(best_int[0], 0)}: the best whole-number plan can be far from the LP’s corner.", rf"不是。4 条黄金时段加 1 条非黄金时段是允许的，触达 {n(best_int[0], 0)}：最好的整数计划可能离 LP 的角很远。"), True),
                    (T(r"Yes: the nearest whole numbers are always best.", r"是：最近的整数总是最好的。"), T(r"The picture shows the blue dots: the best one is not the nearest to the corner.", r"图上有蓝点：最好的那个并不是离角最近的。"), 'round-it'),
                    (T(r"Rounding up (2 and 5) is better.", r"向上取整（2 和 5）更好。"), T(r"2 prime-time and 5 off-peak costs \$1,980: over the \$1,800 budget. Rounding up can leave the allowed set.", r"2 条加 5 条要 \$1,980：超出 \$1,800 的预算。向上取整可能走出允许区域。"), 'round-it')],
                   T(r"Rounding can break a limit (rounding up) or leave profit on the table (rounding down). Integer programming searches the whole-number plans themselves.", r"取整可能破坏某条限制（向上取）或白白丢掉收益（向下取）。整数规划搜索的是整数计划本身。")),
            read('names', T('Three kinds of integer program', '三种整数规划'),
                 table([T('Kind', '种类'), T('Variables', '变量'), T('In Solver or LINDO', '在 Solver 或 LINDO 里'), T('Example', '例子')],
                       [T('**Pure integer**', '**纯整数**'), T('whole numbers $\\ge 0$', '整数 $\\ge 0$'), T('Solver: int; LINDO: GIN', 'Solver：int；LINDO：GIN'), T('how many ads', '买几条广告')],
                       [T('**Binary** (0-1)', '**0-1**（二元）'), T('0 or 1: no or yes', '0 或 1：否或是'), T('Solver: bin; LINDO: INT', 'Solver：bin；LINDO：INT'), T('build the project or not', '做不做这个项目')],
                       [T('**Mixed**', '**混合**'), T('some whole or 0-1, some continuous', '一些是整数或 0-1，一些连续'), T('both settings', '两种设置都用'), T('open a plant (0-1) and ship units (any number)', '开不开工厂（0-1）、运多少件（任意数）')]),
                 p(T(r"The picture is not a polygon with corners any more but a cloud of dots, so the “best plan is at a corner” rule is gone. Solvers search cleverly among the dots, which is why they are slower than for LPs. The LP answer is still useful: it is an upper bound for a maximisation (no whole-number plan can beat it).", r"图不再是带角的多边形，而是一团点，所以“最优计划在角上”的规则不再成立。求解器在这些点里聪明地搜索，所以比解 LP 慢。LP 的答案仍然有用：对最大化问题，它是上界（没有整数计划能超过它）。")),
                 chapter=T('Names', '命名')),

            read('yesno', T('A yes/no variable, and what each statement keeps', '“是/否”变量，以及每句话保留什么'),
                 p(T(r"Quemo Chemical may build any of three projects: a catalytic converter ($x_1$), a software program ($x_2$), a warehouse expansion ($x_3$). Each variable is 1 if the project is built and 0 if not, so three projects give 8 combinations. Every statement in words removes some of the 8, and the line you write must remove exactly those.", r"Quemo Chemical 可以做三个项目中的任何几个：催化转化器（$x_1$）、软件（$x_2$）、仓库扩建（$x_3$）。每个变量是 1 表示做、0 表示不做，所以三个项目有 8 种组合。每句话都会排除其中几种，你写的那一行必须正好排除这些。")),
                 frame('logic_check.html', T('Write the line for each statement; the eight combinations show which stay and which go.', '为每句话写一行；八种组合会显示哪些保留、哪些被排除。'),
                       caption=T(r"Choose a statement, write its line (for example with + and ≤), and check. Blue edge: the combinations that should stay.", r"选一句话，写出它的行（比如用 + 和 ≤），然后检查。蓝边：应该保留的组合。"),
                       vars=['x1', 'x2', 'x3'], statements=STM),
                 chapter=T('Yes or no', '是或否')),
            read('quemo', T('Quemo, solved', 'Quemo，解出来'),
                 p(T(rf"The company has \$20,000 in year 1 and \$16,000 in year 2. The converter costs 8,000 then 7,000 and has a net present value of \$25,000; the software 6,000 then 4,000 and \$18,000; the warehouse 12,000 then 8,000 and \$32,000. At most two projects, and the converter only if the software is bought. The lines are: $8000x_1 + 6000x_2 + 12000x_3 \le 20000$, $7000x_1 + 4000x_2 + 8000x_3 \le 16000$, $x_1 + x_2 + x_3 \le 2$, $x_2 - x_1 \ge 0$, all 0 or 1.", rf"公司第一年有 \$20,000，第二年有 \$16,000。催化转化器第一年 8,000、第二年 7,000，净现值 \$25,000；软件 6,000 和 4,000，\$18,000；仓库 12,000 和 8,000，\$32,000。至多两个项目，且催化转化器只有在买了软件时才能做。各行：$8000x_1 + 6000x_2 + 12000x_3 \le 20000$、$7000x_1 + 4000x_2 + 8000x_3 \le 16000$、$x_1 + x_2 + x_3 \le 2$、$x_2 - x_1 \ge 0$，全部取 0 或 1。")),
                 chapter=T('Yes or no', '是或否')),
            number('quemo_npv', T('The best set of projects', '最好的项目组合'), SK,
                   T(r"With those lines, what is the largest total net present value (in dollars)?", r"按这些行，最大的总净现值是多少美元？"),
                   q_best[0], T(rf"Of the 8 combinations, {len(qs)} keep every line; the best builds the projects (x1, x2, x3) = {q_best[1]}, for \${n(q_best[0], 0)}. The warehouse and the software together fit both years’ funds; the converter cannot come without the software.", rf"8 种组合里有 {len(qs)} 种守住了所有的行；最好的是 (x1, x2, x3) = {q_best[1]}，净现值 \${n(q_best[0], 0)}。仓库和软件一起，两年的资金都够；催化转化器离不开软件。"),
                   tolerance=0.01, unit=T('dollars', '美元'), purpose='practice'),

            read('fixed', T('A fixed cost: yes/no with a quantity', '固定成本：是/否与数量'),
                 p(T(r"Martin-Beck has a St. Louis plant (30,000 units) and may build new plants in Detroit (fixed cost \$175,000, capacity 10,000), Toledo (\$300,000, 20,000), Denver (\$375,000, 30,000) and Kansas City (\$500,000, 40,000). Boston, Atlanta and Houston want 30,000, 20,000 and 20,000 units. Which plants should be built, and what is shipped?", r"Martin-Beck 在圣路易斯有一家工厂（30,000 件），可以在底特律（固定成本 \$175,000，产能 10,000）、托莱多（\$300,000，20,000）、丹佛（\$375,000，30,000）和堪萨斯城（\$500,000，40,000）新建工厂。波士顿、亚特兰大、休斯敦分别要 30,000、20,000、20,000 件。哪些工厂要建，各运什么？")),
                 table([T('Shipping cost per unit', '每件运费'), T('Boston', '波士顿'), T('Atlanta', '亚特兰大'), T('Houston', '休斯敦')],
                       [T('Detroit', '底特律'), '5', '2', '3'], [T('Toledo', '托莱多'), '4', '3', '4'], [T('Denver', '丹佛'), '9', '7', '5'], [T('Kansas City', '堪萨斯城'), '10', '4', '2'], [T('St. Louis (existing)', '圣路易斯（现有）'), '8', '4', '3']),
                 p(T(r"Two kinds of variable: $y_i = 1$ if the new plant $i$ is built (0 otherwise), and $x_{ij}$ units shipped from plant $i$ to centre $j$. They must be **linked**: a plant that is not built ships nothing. That link is the whole idea:", r"两类变量：$y_i = 1$ 表示新工厂 $i$ 建了（否则 0），以及 $x_{ij}$ 表示从工厂 $i$ 运到中心 $j$ 的件数。必须把它们**连起来**：没建的工厂什么也运不出。这个连接就是全部的想法：")),
                 math_(r"x_{11} + x_{12} + x_{13} \le 10000\,y_1"),
                 p(T(r"If $y_1 = 0$ the right side is 0, so Detroit ships nothing; if $y_1 = 1$ the limit is Detroit’s capacity, 10,000. The objective adds the fixed cost only for the plants built: $\text{shipping} + 175000y_1 + 300000y_2 + 375000y_3 + 500000y_4$. The number in front of $y_i$ is the capacity: it plays the part of a very big number “M” that is only as big as it needs to be.", r"若 $y_1 = 0$，右边是 0，底特律什么也运不出；若 $y_1 = 1$，限制就是底特律的产能 10,000。目标函数只为建了的工厂加固定成本：运输成本 $+ 175000y_1 + 300000y_2 + 375000y_3 + 500000y_4$。$y_i$ 前面的数就是产能：它起着“很大的数 M”的作用，只是恰好够大。")),
                 chapter=T('Fixed cost', '固定成本')),
            choice('link', T('Without the link', '没有连接'), SK,
                   T(r"A student adds the fixed costs $175000y_1 + \ldots$ to the objective but forgets the line $x_{11} + x_{12} + x_{13} \le 10000y_1$ (keeping only Detroit’s capacity as a plain 10,000 limit). What does the solver do?", r"一位同学把固定成本 $175000y_1 + \ldots$ 加进了目标函数，却忘了 $x_{11} + x_{12} + x_{13} \le 10000y_1$ 这一行（只保留了底特律产能 10,000 这条普通限制）。求解器会怎么做？"),
                   [(T(r"It sets every $y_i$ to 0, ships from the plants anyway and pays no fixed cost.", r"它把每个 $y_i$ 都设成 0，照样从各工厂发货，却不付固定成本。"), True),
                    (T(r"It builds every plant.", r"它把每个工厂都建了。"), T(r"Building costs money and nothing in the model asks for it.", r"建厂要花钱，模型里没有任何东西要求建。"), None),
                    (T(r"The model is infeasible.", r"模型无可行解。"), T(r"It is feasible; the fixed cost is simply never forced.", r"是有可行解的；固定成本只是从来没被强制要求。"), 'y-without-link')],
                   T(r"A yes/no variable only means something once a line ties it to the thing it switches on.", r"一个“是/否”变量，只有当一条限制把它和它所开关的东西连起来，才有意义。"), purpose='check'),
            number('mb', T('The cheapest network', '最省的网络'), SK,
                   T(r"With the fixed costs and shipping, what is the least total annual cost (in dollars) over all choices of new plants?", r"算上固定成本和运输成本，所有新建工厂的选择中，最低的年总成本是多少美元？"),
                   round(mb[0]), T(rf"Trying all 16 combinations of new plants (and the shipping LP for each) gives the least total {usd(mb[0], 0)}, building: {plants}. The solver reaches the same by branch and bound.", rf"把新建工厂的 16 种组合都试一遍（每种解一个运输 LP），最低总成本是 {usd(mb[0], 0)}，建：{plants_zh}。求解器用分支定界得到同样的结果。"),
                   tolerance=1, unit=T('dollars', '美元'), purpose='practice'),

            read('extra', T('The four extra lines', '另外四种线'),
                 table([T('In words', '用文字说'), T('Line', '行'), T('Why it works', '为什么对')],
                       [T('$A$ only if $B$ (if-then)', '$A$ 只有在 $B$ 时才做（如果……那么）'), '$y_A \\le y_B$', T('$y_A = 1$ forces $y_B = 1$; $y_A = 0$ allows either', '$y_A = 1$ 逼出 $y_B = 1$；$y_A = 0$ 时两者都行')],
                       [T('At most one of $A$, $B$', '$A$、$B$ 至多一个'), '$y_A + y_B \\le 1$', T('both 1 would sum to 2', '都是 1 就加到 2')],
                       [T('At most $k$ of $n$', 'n 个里至多 $k$ 个'), '$y_1 + \\ldots + y_n \\le k$', T('the sum counts how many are chosen', '总和就是选了几个')],
                       [T('Exactly one of $n$', 'n 个里正好一个'), '$y_1 + \\ldots + y_n = 1$', T('an equality instead of ≤', '用等号而不是 ≤')],
                       [T('Quantity $x$ only if $y = 1$', '数量 $x$ 只有在 $y = 1$ 时才有'), '$x \\le M y$', T('$M$ is any number at least as big as $x$ can ever be (the plant’s capacity)', '$M$ 是不小于 $x$ 可能取值的任意数（比如产能）')]),
                 p(T(r"The deck’s warehouse example uses three yes/no variables per warehouse and a penalty for being used below a minimum throughput: the same “big M” links, one for “is it used”, one for “is it under the minimum”. Each one is a line of the last kind.", r"课件里的仓库例子，每个仓库用三个是/否变量，外加使用量低于最低吞吐量时的罚金：同样是“大 M”的连接，一个管“有没有用”，一个管“是不是低于最低量”。每个都是最后一种线。")),
                 chapter=T('Extra lines', '另外几种线')),
            number('uni', T('Eight projects', '八个项目'), SK,
                   T(r"A university can pick among 4 hardware and 4 software projects (budget \$150,000, space 25,000, hardware time 36, software time 24; at least 4 projects, at least one of each kind). The importance ratings are 0.191, 0.107, 0.091, 0.094 (hardware) and 0.126, 0.132, 0.116, 0.144 (software); costs 71,400, 57,000, 50,000, 35,700, 4,300, 2,100, 6,400, 28,600; hardware space 12,500, 2,500, 10,800, 625; hardware time 24, 6, 15, 12; software time 6, 12, 9, none for the 8th. What is the largest total importance? (three decimals)", r"一所大学要在 4 个硬件项目和 4 个软件项目里选（预算 \$150,000，空间 25,000，硬件工时 36，软件工时 24；至少 4 个项目，每类至少一个）。重要性评分是 0.191、0.107、0.091、0.094（硬件）和 0.126、0.132、0.116、0.144（软件）；成本 71,400、57,000、50,000、35,700、4,300、2,100、6,400、28,600；硬件占用空间 12,500、2,500、10,800、625；硬件工时 24、6、15、12；软件工时 6、12、9，第 8 个不占。最大的总重要性是多少？（三位小数）"),
                   round(uni[0], 3), T(rf"With 8 yes/no variables there are 256 combinations; checking each against the lines gives the best {n(uni[0], 3)}, choosing the projects {[i + 1 for i, v in enumerate(uni[1]) if v]}.", rf"8 个是/否变量有 256 种组合；逐个按各行检查，最好的是 {n(uni[0], 3)}，选的项目是 {[i + 1 for i, v in enumerate(uni[1]) if v]}。"),
                   tolerance=0.0006, purpose='practice'),
            choice('recall_round', T('Recall: when a limit binds', '回忆：紧的限制'), SK,
                   T(r"In an LP, the best plan always sits at a corner. In an integer program:", r"在 LP 里，最优计划总在角上。在整数规划里："),
                   [(T(r"Not necessarily: the best whole-number plan can be inside the allowed set.", r"不一定：最好的整数计划可能在允许区域内部。"), True),
                    (T(r"Still always at a corner.", r"仍然总在角上。"), T(r"The best dot of the lattice is usually not a corner.", r"点阵里最好的那个点通常不是角。"), None),
                    (T(r"Always at the rounded corner.", r"总在四舍五入后的那个角。"), T(r"The first page of this lesson shows it is not.", r"这一课第一页就说明不是。"), 'round-it')],
                   T(r"The corner rule belongs to continuous variables.", r"“在角上”这条规则属于连续变量。"), purpose='check'),
            choice('recall_dummy', T('Recall: which dummy', '回忆：哪种虚拟项'), SK,
                   T(r"Total supply is 800 and total demand is 600. The transportation table needs:", r"总供应是 800，总需求是 600。运输表需要："),
                   [(T(r"a dummy destination of 200, at cost 0.", r"一个 200 的虚拟需求地，运费为 0。"), True),
                    (T(r"a dummy origin of 200, at cost 0.", r"一个 200 的虚拟供应地，运费为 0。"), T(r"A dummy origin is for the case where demand is larger.", r"虚拟供应地用于需求更大的情形。"), 'dummy-wrong-side'),
                    (T(r"a dummy destination of 200 with a high cost.", r"一个 200 的虚拟需求地，运费很高。"), T(r"Nothing is really shipped to a dummy: its cost is 0.", r"没有东西真的运给虚拟项：它的运费是 0。"), 'dummy-wrong-side')],
                   T(r"Surplus supply goes to a dummy destination.", r"多余的供应去虚拟需求地。"), purpose='check'),
        ],
    )
