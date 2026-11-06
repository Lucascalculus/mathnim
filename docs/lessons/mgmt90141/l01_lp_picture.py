# Lesson 1 (lp-picture): what a plan is, and why the best one sits in a corner. Decks: W1 (business analytics, LP elements,
# assumptions, Shader Electronics, special cases). The figure is the engine's mgmt_lp_plane (packages/visuals/src/mgmt/lp_plane.ts:
# a plan, the profit line or a wall in the hand); every number is solved by common.lp_solve.
from common import *

SK = 'mg.lp-picture'


def plane(caption, problem='shader', tool='look', story='shown', **extra):
    """The plan plane on the engine: problem is one of lp2d.PROBLEMS (shader, alternative, infeasible, unbounded, redundant)."""
    return visual('mgmt_lp_plane', caption, problem=problem, tool=tool, story=story, **extra)


def L_lp_picture():
    shader = [([4, 3], '<=', 240), ([2, 1], '<=', 100)]
    r = lp_solve('max', [7, 5], shader)
    assert abs(r['obj'] - 410) < 1e-9 and [round(v) for v in r['x']] == [30, 40]
    # the greedy plans of the prediction page, and the swaps that beat them
    assert 7 * 50 == 350 and 5 * 80 == 400
    assert lp_solve('max', [7, 5], shader + [([1, 1], '<=', 120)])['obj'] == 410          # packing never binds
    assert lp_solve('max', [7, 5], [([4, 3], '<=', 250), ([2, 1], '<=', 100)])['obj'] == 425   # 10 more electronic hours
    assert lp_solve('max', [4, 3], shader)['obj'] == 240                                    # profit parallel to the electronic wall
    assert lp_solve('max', [7, 5], shader + [([1, 0], '>=', 60)])['status'] == 'infeasible'
    assert lp_solve('max', [7, 5], [([1, 1], '>=', 30), ([1, 0], '>=', 10)])['status'] == 'unbounded'
    return dict(
        id=f'{CID}-lp-picture',
        title=T('What a plan is, and why the best one sits in a corner', '什么是“计划”，为什么最好的计划总在角上'),
        description=T('Shader Electronics has two products and two departments with limited hours. You hold plans in your hand, slide a profit line over them, and see why only corners need checking and which limits matter.',
                      'Shader Electronics 有两种产品、两个工时有限的车间。你亲手拿着各种“计划”，把利润线推过它们，看清为什么只需要检查角点、哪些限制真正起作用。'),
        minutes=35,
        skills=[{'id': SK, 'name': T('Reading a linear program as a picture', '把线性规划当作一幅图来读')}],
        misconceptions=[
            {'id': 'greedy-product', 'description': T('Making as much as possible of the product with the higher profit per unit', '把单位利润更高的产品尽量多做')},
            {'id': 'best-in-the-middle', 'description': T('Believing the best plan is a balanced one in the middle of the allowed set', '以为最优计划是可行域中间那种“均衡”的计划')},
            {'id': 'every-limit-matters', 'description': T('Believing every limit in the model holds the best plan', '以为模型里的每条限制都卡住了最优计划')},
        ],
        steps=[
            read('story', T('A manager’s question', '经理的问题'),
                 p(T(r"Shader Electronics makes two products: the **x-pod**, a portable music player, and the **BlueBerry**, a phone with a colour screen. Each needs time in two departments, and each department has only so many hours this period.",
                     r"Shader Electronics 生产两种产品：**x-pod**（便携式音乐播放器）和 **BlueBerry**（彩屏手机）。每种产品都要占用两个车间的工时，而每个车间这个周期的工时是有限的。")),
                 table([T('Per unit', '每件'), T('x-pod', 'x-pod'), T('BlueBerry', 'BlueBerry'), T('Hours available', '可用工时')],
                       [T('Electronic hours', '电子工时'), '4', '3', '240'],
                       [T('Assembly hours', '装配工时'), '2', '1', '100'],
                       [T('Profit', '利润'), '\\$7', '\\$5', '—']),
                 p(T(r"The manager asks: *how many of each should we make to earn the most?* Making more of one leaves fewer hours for the other, so this is a question about **how to split** limited hours. Every possible answer is a pair of numbers, x-pods and BlueBerrys. Call such a pair a **plan**.",
                     r"经理问：*每种做多少，才能赚得最多？* 一种做多了，另一种能用的工时就少了，所以这是在问**怎样分配**有限的工时。每个可能的答案都是一对数：x-pod 几个、BlueBerry 几个。这样的一对数叫一个**计划**。")),
                 quiz(T(r"Could Shader make **40 x-pods and 40 BlueBerrys** this period?", r"这个周期里，Shader 能做 **40 个 x-pod 和 40 个 BlueBerry** 吗？"),
                      [(T(r"Yes. It would earn \$480.", r"能。它会赚 \$480。"), T(r"\$480 is what it *would* earn, but the hours do not exist: the plan needs 280 electronic hours (240 available) and 120 assembly hours (100 available).", r"\$480 是它*会*赚的钱，但工时不够：这个计划要 280 个电子工时（只有 240）和 120 个装配工时（只有 100）。")),
                       (T(r"No: it runs out of electronic hours only.", r"不能：只是电子工时不够。"), T(r"Check assembly too: $2 \cdot 40 + 1 \cdot 40 = 120$, and only 100 are available.", r"再看装配：$2 \cdot 40 + 1 \cdot 40 = 120$，只有 100。")),
                       (T(r"No: it runs out of both.", r"不能：两个车间的工时都不够。"), True)],
                      T(r"Electronic: $4 \cdot 40 + 3 \cdot 40 = 280 > 240$. Assembly: $2 \cdot 40 + 1 \cdot 40 = 120 > 100$. A plan has to keep **every** limit at the same time.",
                        r"电子：$4 \cdot 40 + 3 \cdot 40 = 280 > 240$。装配：$2 \cdot 40 + 1 \cdot 40 = 120 > 100$。一个计划必须**同时**守住**每一条**限制。")),
                 chapter=T('The decision', '要做的决策')),

            read('touch', T('Every point is a plan', '每个点都是一个计划'),
                 plane(T(r"Each point is a plan: $x_1$ x-pods and $x_2$ BlueBerrys. The two lines are the departments’ hours; the green set is every plan that keeps both. The numbers: what the plan in hand earns, and how much of each department it uses.",
                         r"每个点是一个计划：$x_1$ 个 x-pod、$x_2$ 个 BlueBerry。两条线是两个车间的工时；绿色区域是同时守住两条限制的全部计划。数字是手里这个计划赚多少、各用了每个车间多少工时。"),
                       tool='plan', story='build', plan=[20, 20]),
                 p(T(r"Inside the green set both departments have hours to spare. **On** a line, that department is used up completely. **Past** a line, the plan asks for hours that do not exist.",
                     r"绿色区域里，两个车间都有富余。**落在**线上，那个车间的工时正好用完。**越过**线，这个计划要的工时就不存在了。")),
                 chapter=T('Touch', '动手')),
            number('earns', T('What a plan earns', '一个计划赚多少'), SK,
                   T(r"The plan with 20 x-pods and 40 BlueBerrys: how much profit does it earn?", r"20 个 x-pod 加 40 个 BlueBerry 的计划，利润是多少？"),
                   340, T(r"$7 \cdot 20 + 5 \cdot 40 = 140 + 200 = 340$. It is allowed: electronic $4 \cdot 20 + 3 \cdot 40 = 200 \le 240$, assembly $2 \cdot 20 + 1 \cdot 40 = 80 \le 100$.",
                          r"$7 \cdot 20 + 5 \cdot 40 = 140 + 200 = 340$。它是允许的：电子 $4 \cdot 20 + 3 \cdot 40 = 200 \le 240$，装配 $2 \cdot 20 + 1 \cdot 40 = 80 \le 100$。"),
                   tolerance=0.01, unit=T('dollars', '美元'), purpose='practice'),

            choice('predict', T('Where is the best plan?', '最好的计划在哪里？'), SK,
                   T(r"Of all the allowed plans, which kind earns the most? Decide before you look.", r"在所有允许的计划里，哪一类赚得最多？先想好，再往下看。"),
                   [(T(r"As many x-pods as possible (50 x-pods, no BlueBerrys), because an x-pod earns more per unit.", r"x-pod 尽量多做（50 个，不做 BlueBerry），因为 x-pod 每件赚得多。"),
                     T(r"That plan earns \$350 and leaves 40 electronic hours idle. Swap one x-pod for two BlueBerrys: assembly hours balance ($-2 + 2$), the idle electronic hours cover the extra 2, and profit rises by $10 - 7 = 3$. Keep swapping until electronic hours run out too.",
                       r"这个计划赚 \$350，还有 40 个电子工时闲着。拿一个 x-pod 换两个 BlueBerry：装配工时刚好抵消（$-2 + 2$），闲着的电子工时够用，利润涨 $10 - 7 = 3$。一直换到电子工时也用完为止。"), 'greedy-product'),
                    (T(r"Only BlueBerrys, as many as the electronic hours allow (80).", r"只做 BlueBerry，做到电子工时用完（80 个）。"),
                     T(r"That plan earns \$400 and leaves 20 assembly hours idle. Replace 4 BlueBerrys by 3 x-pods: the same 12 electronic hours, 2 more assembly hours, and profit rises by $21 - 20 = 1$.",
                       r"这个计划赚 \$400，还有 20 个装配工时闲着。把 4 个 BlueBerry 换成 3 个 x-pod：电子工时同样是 12，装配多用 2 个，利润涨 $21 - 20 = 1$。"), 'greedy-product'),
                    (T(r"A balanced plan in the middle of the green set, with hours left in both departments.", r"绿色区域中间的一个“均衡”计划，两个车间都还有富余。"),
                     T(r"Hours left over earn nothing: from any plan with spare hours in both departments you can make a little more of something and earn more. The best plan cannot be inside.",
                       r"剩下的工时不赚钱：只要两个车间都有富余，就总能多做一点什么、多赚一点。最好的计划不可能在里面。"), 'best-in-the-middle'),
                    (T(r"A plan that uses up the hours of both departments.", r"把两个车间的工时都用完的计划。"), True)],
                   T(r"The next page shows why: the best plan is where a profit line leaves the green set last.", r"下一页会让你看到原因：最好的计划是利润线最后离开绿色区域的地方。")),

            read('sweep', T('Sliding the profit line', '推动利润线'),
                 p(T(r"A profit of \$300 can be reached by many plans: every point on the line $7x_1 + 5x_2 = 300$ earns exactly that. A profit of \$350 is another line, parallel to the first and further out.",
                     r"很多计划都能赚到 \$300：直线 $7x_1 + 5x_2 = 300$ 上的每个点正好赚这么多。\$350 是另一条线，和第一条平行、更靠外。")),
                 plane(T(r"The profit line for the level in hand. Thick: the plans on it that are allowed.", r"手里这个利润水平对应的利润线。粗的部分：线上被允许的计划。"),
                       tool='sweep', level=100),
                 p(T(r"As the line slides out, its thick part shrinks. The last allowed plan it touches is the **best plan**. The green set has straight sides, so the line always leaves it at a **corner**, or along a whole edge if the line is parallel to that edge.",
                     r"线往外推，粗的部分越来越短。它最后碰到的那个被允许的计划就是**最优计划**。绿色区域的边是直的，所以线总是在**角**上离开；线和某条边平行时，就沿着整条边离开。")),
                 chapter=T('Find the best', '找最好的')),
            choice('why_corner', T('Why a corner?', '为什么是角？'), SK,
                   T(r"Why does the last plan the profit line touches have to be a corner (or a whole edge)?", r"为什么利润线最后碰到的那个计划一定是个角（或一整条边）？"),
                   [(T(r"Profit lines are parallel and move out together, and a straight line sliding over a polygon leaves it last at a corner.", r"利润线互相平行、一起往外推，而一条直线扫过多边形，最后离开的地方是个角。"), True),
                    (T(r"Because corners are where the most hours are used.", r"因为角上用的工时最多。"), T(r"Using the most hours is not the reason. A profit line can leave along a whole edge, and the edge’s ends are corners too.", r"用工时最多不是原因。利润线也可能沿整条边离开，而边的两端同样是角。")),
                    (T(r"Because the profit line is curved and touches the set at a point.", r"因为利润线是弯的，只在一点碰到区域。"), T(r"Every limit and the profit are linear: straight lines only.", r"每条限制和利润都是线性的：只有直线。"))],
                   T(r"This is why a solver only has to look at corners, however many variables there are.", r"这就是为什么不管有多少变量，求解器只需要看角点。"), purpose='check'),

            read('corners', T('Only the corners need checking', '只需要检查角点'),
                 plane(T(r"The four corners of the allowed set and what each earns.", r"允许区域的四个角，以及每个角赚多少。"), best=True, corners=True),
                 p(T(r"So there is no need to try every plan: find the corners, work out the profit at each, take the largest. A corner is where two lines meet, so you find it by solving their two equations together.",
                     r"所以没必要试遍所有计划：找出各个角，算出每个角的利润，取最大的。角是两条线相交的地方，解这两条线的方程组就能找到它。")),
                 table([T('Corner', '角'), T('Where', '位置'), T('Profit', '利润')],
                       ['$(0, 0)$', T('both axes', '两条坐标轴'), '\\$0'],
                       ['$(50, 0)$', T('assembly line meets the $x_1$ axis', '装配线与 $x_1$ 轴'), '\\$350'],
                       ['$(30, 40)$', T('electronic and assembly lines meet', '电子线与装配线'), '\\$410'],
                       ['$(0, 80)$', T('electronic line meets the $x_2$ axis', '电子线与 $x_2$ 轴'), '\\$400']),
                 chapter=T('Corners', '角点')),
            number('corner', T('Find the corner', '找出这个角'), SK,
                   T(r"The electronic line $4x_1 + 3x_2 = 240$ and the assembly line $2x_1 + x_2 = 100$ meet at one point. What is $x_1$ there?", r"电子线 $4x_1 + 3x_2 = 240$ 和装配线 $2x_1 + x_2 = 100$ 交于一点。那里的 $x_1$ 是多少？"),
                   30, T(r"Multiply the second equation by 3: $6x_1 + 3x_2 = 300$. Subtract the first: $2x_1 = 60$, so $x_1 = 30$ and $x_2 = 100 - 60 = 40$.",
                         r"把第二个方程乘 3：$6x_1 + 3x_2 = 300$。减去第一个方程：$2x_1 = 60$，所以 $x_1 = 30$，$x_2 = 100 - 60 = 40$。"),
                   tolerance=0.01, purpose='practice'),

            read('walls', T('Which limits matter', '哪些限制起作用'),
                 p(T(r"At the best plan both departments’ hours are used up. Now move the walls and watch the best plan and its profit.", r"在最优计划处两个车间的工时都用完了。现在移动这两面墙，看最优计划和它的利润怎么变。")),
                 plane(T(r"Each wall can be moved. Thick walls are the limits that hold the best plan.", r"每面墙都可以移动。粗的墙是卡住最优计划的那些限制。"), tool='walls', best=True),
                 p(T(r"A limit the best plan uses up completely is **binding**. A limit with hours left over is **slack**. Moving a binding wall changes the best profit; moving a slack wall changes nothing.",
                     r"最优计划把某条限制用完，这条限制就是**紧的**（binding）；还有富余的是**松的**（slack）。移动紧的墙，最优利润会变；移动松的墙，什么都不变。")),
                 chapter=T('Binding and slack', '紧与松')),
            number('ten_more', T('Ten more electronic hours', '多 10 个电子工时'), SK,
                   T(r"Electronic hours go up from 240 to 250. By how much does the best profit rise?", r"电子工时从 240 增加到 250。最优利润增加多少？"),
                   15, T(r"The new corner solves $4x_1 + 3x_2 = 250$ and $2x_1 + x_2 = 100$: $x_1 = 25$, $x_2 = 50$, profit $7 \cdot 25 + 5 \cdot 50 = 425$, which is \$15 more than \$410: \$1.50 per extra hour. The report calls it the **shadow price** (lesson 3).",
                         r"新的角满足 $4x_1 + 3x_2 = 250$ 和 $2x_1 + x_2 = 100$：$x_1 = 25$，$x_2 = 50$，利润 $7 \cdot 25 + 5 \cdot 50 = 425$，比 \$410 多 \$15：每多一个电子工时多赚 \$1.50。报告里把它叫作**影子价格**（第 3 课）。"),
                   tolerance=0.01, unit=T('dollars', '美元'), purpose='practice'),
            read('slack', T('A limit that never binds', '一条永远不起作用的限制'),
                 plane(T(r"A third limit: packing capacity, 120 units.", r"第三条限制：包装能力 120 件。"), problem='redundant', tool='walls', best=True),
                 p(T(r"The best plan packs only $30 + 40 = 70$ units, so packing is **slack**: there is room to spare, and moving its wall changes nothing. Such a limit is called redundant when it can never bind.",
                     r"最优计划只包 $30 + 40 = 70$ 件，所以包装是**松的**：有富余，移动它的墙什么都不变。一条永远不会起作用的限制叫作冗余的。")),
                 chapter=T('Binding and slack', '紧与松')),
            choice('slack_q', T('Packing capacity rises', '包装能力提高'), SK,
                   T(r"Packing capacity rises from 120 to 150 units. What happens to the best profit?", r"包装能力从 120 件提高到 150 件。最优利润会怎样？"),
                   [(T(r"It rises.", r"上升。"), T(r"Only a binding limit can raise profit when relaxed. The best plan packs 70 of the 120 units, so 50 are idle.", r"只有紧的限制放松才会提高利润。最优计划只包 120 件里的 70 件，有 50 件闲着。"), 'every-limit-matters'),
                    (T(r"It stays at \$410.", r"保持 \$410 不变。"), True),
                    (T(r"It falls.", r"下降。"), T(r"Relaxing a limit never makes the best plan worse: every old plan is still allowed.", r"放松限制不会让最优计划变差：原来允许的计划仍然都允许。"), None)],
                   T(r"The best plan uses 70 of 120 packing units: slack. A slack limit can be moved without changing the best plan.", r"最优计划只用了 120 件包装能力里的 70 件：松的。松的限制随便移动，最优计划都不变。"), purpose='check'),

            read('cases', T('Three ways a picture surprises you', '图会给你的三种意外'),
                 p(T(r"The picture does not always have one best corner. Here are the three surprises the exam can ask about.", r"图并不总是有唯一的最优角。下面是考试可能问到的三种意外。")),
                 plane(T(r"Profit $4x_1 + 3x_2$ is parallel to the electronic wall.", r"利润 $4x_1 + 3x_2$ 和电子线平行。"), problem='alternative', tool='sweep', level=240, best=True),
                 p(T(r"**Alternative optima.** The profit line leaves along a whole edge, so many plans tie at \$240. A solver reports one corner of that edge; any plan between its two ends is just as good.",
                     r"**多个最优解。** 利润线沿着整条边离开，所以很多计划并列在 \$240。求解器只报告这条边的一个端点；两端之间的任何计划一样好。")),
                 plane(T(r"A contract demands at least 60 x-pods, but assembly allows only 50.", r"合同要求至少 60 个 x-pod，但装配最多只允许 50 个。"), problem='infeasible', best=True),
                 p(T(r"**Infeasible.** No plan keeps every limit, so there is no best plan. The fix is in the model or in the promises, not in the solver.", r"**无可行解。** 没有任何计划能同时守住所有限制，所以没有最优计划。要改的是模型或承诺，不是求解器。")),
                 plane(T(r"Only minimums: the allowed set runs off the page.", r"只有下限：允许区域一直延伸出画面。"), problem='unbounded', best=True),
                 p(T(r"**Unbounded.** Profit can grow forever. In a real business this means a limit is missing from the model, never that profit is infinite.", r"**无界。** 利润可以无限增大。在真实的业务里，这说明模型漏了某条限制，而不是利润真的无限。")),
                 quiz(T(r"A solver reports **infeasible**. What does the picture look like?", r"求解器报告**无可行解**。图是什么样的？"),
                      [(T(r"The allowed set is empty: the limits contradict each other.", r"允许区域是空的：限制互相矛盾。"), True),
                       (T(r"The allowed set runs off the page.", r"允许区域一直延伸出画面。"), T(r"That is **unbounded**: profit has no top.", r"那是**无界**：利润没有上限。")),
                       (T(r"The profit line is parallel to a wall.", r"利润线和某面墙平行。"), T(r"That gives many best plans (alternative optima), not none.", r"那是有很多最优计划（多个最优解），不是没有。"))],
                      T(r"Infeasible: no plan keeps every limit, the allowed set is empty.", r"无可行解：没有任何计划能守住所有限制，允许区域是空的。")),
                 chapter=T('Special cases', '特殊情况')),

            read('name', T('Now the names', '现在给它们命名'),
                 p(T(r"Everything you did has a name, and the exam uses the names. The picture and the model are one thing seen twice.", r"你做过的每件事都有名字，考试要用这些名字。图和模型是同一件事的两种样子。")),
                 table([T('Part of an LP', 'LP 的部分'), T('In the picture', '在图里'), T('Shader’s', 'Shader 的')],
                       [T('**Decision variables**: what you choose', '**决策变量**：你要决定的量'), T('the two axes', '两条坐标轴'), T('$x_1$ = x-pods, $x_2$ = BlueBerrys', '$x_1$ = x-pod 数，$x_2$ = BlueBerry 数')],
                       [T('**Objective function**: what you maximise or minimise', '**目标函数**：要最大化或最小化的量'), T('the profit line’s slope, and which way is “more”', '利润线的斜率，和哪边是“更多”'), '$z = 7x_1 + 5x_2$'],
                       [T('**Constraints**: the limits', '**约束**：各种限制'), T('the walls', '那些墙'), '$4x_1 + 3x_2 \\le 240$, $2x_1 + x_2 \\le 100$'],
                       [T('**Non-negativity**', '**非负约束**'), T('the axes as walls', '作为墙的坐标轴'), '$x_1, x_2 \\ge 0$'],
                       [T('**Feasible region**, **optimal solution**', '**可行域**、**最优解**'), T('the allowed set, and its best corner', '允许区域，和它最好的角'), T('$(30, 40)$, $z = 410$', '$(30, 40)$，$z = 410$')]),
                 math_(r"\begin{aligned}\max\; z &= 7x_1 + 5x_2\\ 4x_1 + 3x_2 &\le 240\\ 2x_1 + x_2 &\le 100\\ x_1,\, x_2 &\ge 0\end{aligned}"),
                 p(T(r"Three assumptions keep the picture straight. It is **deterministic**: every number (the profits, the hours per unit, the hours available) is known for certain. It is **proportional**: twice the units need twice the hours and earn twice the profit. It is **divisible**: a fraction of a unit is allowed. “Programming” here means *modelling*, not coding. LP helps managers share out resources, the four M and a T: machinery, labour, money, materials and time.",
                     r"三条假设让这幅图保持“直”。**确定性**：每个数（利润、单位工时、可用工时）都是已知的。**成比例**：单位数翻倍，工时和利润也翻倍。**可分**：可以做不足一个的零头。这里的 “programming” 是*建模*，不是写代码。LP 帮经理分配资源：设备、人力、资金、材料和时间。")),
                 table([T('Kind of analytics', '分析的种类'), T('It answers', '它回答'), T('In this subject', '在这门课里')],
                       [T('Descriptive', '描述性'), T('what happened?', '发生了什么？'), T('descriptive statistics, probability, distributions (weeks 7 and 8)', '描述统计、概率、分布（第 7、8 周）')],
                       [T('Predictive', '预测性'), T('what will happen?', '会发生什么？'), T('simple and multiple regression (weeks 9 and 10)', '一元和多元回归（第 9、10 周）')],
                       [T('Prescriptive', '规范性'), T('what should we do?', '该怎么做？'), T('linear and integer programming, decision analysis (weeks 1 to 6)', '线性和整数规划、决策分析（第 1 到 6 周）')]),
                 chapter=T('Names', '命名')),

            choice('recall_a', T('Recall: where the best plan sits', '回忆：最优计划在哪'), SK,
                   T(r"A profit line slides out over an allowed set. Where does it leave it?", r"一条利润线从里往外扫过一个允许区域。它在哪里离开？"),
                   [(T(r"At a corner, or along a whole edge if parallel to it.", r"在一个角上；和某条边平行时，沿整条边。"), True),
                    (T(r"In the middle, where the limits are balanced.", r"在中间，限制取得平衡的地方。"), T(r"Spare hours earn nothing; the line is still moving out there.", r"富余的工时不赚钱；线在那里还能继续往外。"), 'best-in-the-middle'),
                    (T(r"At the plan with the most of the dearer product.", r"在尽量多做利润更高那个产品的计划上。"), T(r"The swaps on the prediction page beat it.", r"预测页里的“换”能打败它。"), 'greedy-product')],
                   T(r"Corner, or an edge: the first place a straight line can no longer stay inside a polygon.", r"角，或一条边：直线刚好无法再待在多边形里的地方。"), purpose='check'),
            choice('recall_b', T('Recall: slack or binding', '回忆：松还是紧'), SK,
                   T(r"At the best plan, a department uses 70 of its 120 hours. Moving that limit to 130 hours changes the best profit by:", r"在最优计划处，某个车间用了 120 个工时里的 70 个。把这条限制移到 130 个工时，最优利润变化：")
                   , [(T(r"Nothing: the limit is slack.", r"没有变化：这条限制是松的。"), True),
                      (T(r"Ten hours times the profit per hour.", r"10 个工时乘以每工时利润。"), T(r"That is for a binding limit. This one has 50 hours idle.", r"那是紧的限制才会有的。这条还闲着 50 个工时。"), 'every-limit-matters'),
                      (T(r"It falls by ten hours’ worth.", r"减少 10 个工时的价值。"), T(r"More hours never hurt.", r"多给工时不会变差。"), None)],
                   T(r"70 of 120 used: slack. Only a binding limit changes the best profit when moved.", r"120 里用了 70：松。只有紧的限制移动时才改变最优利润。"), purpose='check'),
        ],
    )
