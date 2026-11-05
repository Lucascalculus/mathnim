# Lesson 3 (lp-report): what the answer report says besides the plan. Decks: W1 (sensitivity analysis: reduced cost, shadow price,
# allowable increase and decrease, ranges of optimality and feasibility) and W2 (the MSI worked questions). Exam: 2025 Q1(ii)-(vi).
# Instrument: lp_report (Excel's sensitivity report, every cell tied to the picture). Numbers: lp_solve, checked by scipy.
from common import *
from l02_lp_formulate import DCI_ROWS

SK = 'mg.lp-report'
SHADER = [dict(a=[4, 3], op='<=', b=240, label=T('Electronic hours', '电子工时')), dict(a=[2, 1], op='<=', b=100, label=T('Assembly hours', '装配工时'))]
MSI_ROWS = [
    dict(a=[1, 1, 1, 1], op='=', b=1000, label=T('Total interviews', '访问总数')),
    dict(a=[1, 1, 0, 0], op='>=', b=400, label=T('Requirement 1: with children', '要求 1：有孩子的家庭')),
    dict(a=[0, 0, 1, 1], op='>=', b=400, label=T('Requirement 2: no children', '要求 2：没有孩子的家庭')),
    dict(a=[-1, 1, -1, 1], op='>=', b=0, label=T('Requirement 3: evening ≥ day', '要求 3：晚上不少于白天')),
    dict(a=[-.4, .6, 0, 0], op='>=', b=0, label=T('Requirement 4: 40% in the evening', '要求 4：有孩子的 40% 在晚上')),
    dict(a=[0, 0, -.6, .4], op='>=', b=0, label=T('Requirement 5: 60% in the evening', '要求 5：没孩子的 60% 在晚上')),
]
MSI_C = [20, 25, 18, 20]


def report(rows, obj, sense, names, **kw):
    return dict(rows=rows, obj=obj, sense=sense, vars=names, money='$', **kw)


def L_lp_report():
    sh = [(r['a'], r['op'], r['b']) for r in SHADER]
    s0 = lp_solve('max', [7, 5], sh)
    assert round(s0['obj']) == 410 and abs(s0['rows'][0]['shadow'] - 1.5) < 1e-9
    e = s0['rows'][0]
    assert (round(e['inc']), round(e['dec'])) == (60, 40)
    assert abs(s0['vars'][0]['inc'] - 3) < 1e-9 and abs(s0['vars'][0]['dec'] - 1 / 3) < 1e-9
    assert round(lp_solve('max', [7, 5], [([4, 3], '<=', 300), sh[1]])['obj']) == 500      # 300 hours: exactly the end of the stretch
    assert round(lp_solve('max', [7, 5], [([4, 3], '<=', 400), sh[1]])['obj']) == 500      # past it: nothing more to gain
    d = lp_solve('min', [10, 14, 6, 9], [(r['a'], r['op'], r['b']) for r in DCI_ROWS])
    sl, vr = d['rows'], d['vars']
    assert round(sl[2]['lhs']) == 580 and round(sl[3]['lhs']) == 1080
    assert abs(sl[3]['shadow'] + 0.375) < 1e-9 and abs(sl[3]['inc'] - 160 / 3) < 1e-9 and round(sl[3]['dec']) == 480 and round(sl[2]['dec']) == 20
    assert round(vr[3]['cost'] - vr[3]['dec'], 6) == 6 and abs(vr[3]['cost'] + vr[3]['inc'] - 34 / 3) < 1e-9
    d10 = lp_solve('min', [10, 14, 6, 10], [(r['a'], r['op'], r['b']) for r in DCI_ROWS])
    assert d10['obj'] == 2260 and d10['x'] == d['x']
    d1100 = lp_solve('min', [10, 14, 6, 9], [(r['a'], r['op'], r['b'] if k != 3 else 1100) for k, r in enumerate(DCI_ROWS)])
    assert abs(d1100['obj'] - d['obj'] + 7.5) < 1e-9
    d580 = lp_solve('min', [10, 14, 6, 9], [(r['a'], r['op'], r['b'] if k != 2 else 580) for k, r in enumerate(DCI_ROWS)])
    assert d580['x'] == d['x']
    ms = lp_solve('min', MSI_C, [(r['a'], r['op'], r['b']) for r in MSI_ROWS])
    mv, mr = ms['vars'], ms['rows']
    c11_lo, c11_hi = MSI_C[0] - mv[0]['dec'], MSI_C[0] + mv[0]['inc']
    assert (round(c11_lo, 2), round(c11_hi, 2)) == (15.33, 25.0) and mv[1]['inc'] >= 1e29 and round(MSI_C[1] - mv[1]['dec'], 6) == 20
    assert round(mr[1]['shadow'], 6) == 2.8 and round(mr[1]['rhs'] - mr[1]['dec']) == 0 and round(mr[1]['rhs'] + mr[1]['inc']) == 500
    ms500 = lp_solve('min', MSI_C, [(r['a'], r['op'], r['b'] if k != 1 else 500) for k, r in enumerate(MSI_ROWS)])
    assert abs(ms500['obj'] - ms['obj'] - 280) < 1e-9
    names4 = ['x11', 'x12', 'x21', 'x22']
    return dict(
        id=f'{CID}-lp-report',
        title=T('What the answer report tells you besides the plan', '答案报告除了计划，还告诉你什么'),
        description=T('A solver gives a plan and a table of numbers. Every number is the answer to a “what if”: touch it in Shader’s report, see what it does to the picture, then answer the exam’s own what-if questions about the DCI problem and a survey firm.',
                      '求解器给出一个计划和一张数字表。每个数都是某个“如果……会怎样”的答案：在 Shader 的报告里点一个数，看它在图上做了什么，再回答考试里关于 DCI 和一家调查公司的“如果”问题。'),
        minutes=50,
        skills=[{'id': SK, 'name': T('Reading a sensitivity report', '读灵敏度报告')}],
        misconceptions=[
            {'id': 'shadow-forever', 'description': T('Using a shadow price outside its allowable range', '在允许范围之外使用影子价格')},
            {'id': 'reduced-vs-shadow', 'description': T('Mixing up reduced cost (a variable) with shadow price (a limit)', '把递减成本（针对变量）和影子价格（针对限制）搞混')},
            {'id': 'ranges-together', 'description': T('Applying the allowable ranges to several changes at once', '把允许范围用在同时发生的多个变化上')},
        ],
        steps=[
            read('idea', T('The plan is one answer; the report is many more', '计划只是一个答案；报告里还有很多'),
                 p(T(r"A manager never stops at “make 30 and 40”. The next questions are always *what if*: what if the electronic department had more hours, what if the x-pod’s profit fell? Re-solving each time would be slow. The solver’s report answers them all at once, in a table with the same shape in every spreadsheet.",
                     r"经理不会满足于“做 30 个和 40 个”。接着问的永远是*如果*：如果电子车间多一些工时呢？如果 x-pod 的利润降了呢？每次都重新求解太慢。求解器的报告一次回答所有这些问题，而且每个电子表格里的表格式都一样。")),
                 frame('lp_report.html', T('Shader’s sensitivity report beside its plane. Touch a number: a slider moves it and the picture shows what it does.', 'Shader 的灵敏度报告和它的计划平面。点一个数：滑块会移动它，图上会显示结果。'),
                       caption=T(r"Touch any shaded number in the report, then move the slider. Green stretch: what the report promises.", r"点报告里任何一个数，然后移动滑块。绿色的一段：报告保证成立的范围。"),
                       **report(SHADER, [7, 5], 'max', ['x1', 'x2'], view=[60, 90], axes=[T('x-pods', 'x-pod 数'), T('BlueBerrys', 'BlueBerry 数')], var_names=[T('x-pods', 'x-pod'), T('BlueBerrys', 'BlueBerry')])),
                 chapter=T('Touch', '动手')),
            choice('predict_up', T('Sixty more hours', '多 60 个电子工时'), SK,
                   T(r"The electronic department’s shadow price is 1.5. Its hours go from 240 to 300. By how much does the best profit rise?", r"电子车间的影子价格是 1.5。它的工时从 240 增加到 300。最优利润增加多少？"),
                   [(T(r"\$60", r"\$60"), T(r"The shadow price is per extra **hour**: 60 hours are worth $60 \times 1.5$.", r"影子价格是每多一个**工时**的价值：60 个工时值 $60 \times 1.5$。"), None),
                    (T(r"\$90", r"\$90"), True),
                    (T(r"Nothing: electronic hours are not the problem.", r"没有变化：电子工时不是问题所在。"), T(r"The electronic limit binds, which is why its shadow price is positive.", r"电子这条限制是紧的，所以它的影子价格是正的。"), None)],
                   T(r"$60 \times 1.5 = 90$, and the answer from re-solving is 500, which is 90 more than 410. Within the allowable stretch (200 to 300) the shadow price is exact.", r"$60 \times 1.5 = 90$，重新求解得 500，比 410 多 90。在允许范围（200 到 300）内影子价格是精确的。")),
            choice('predict_past', T('A hundred and sixty more hours', '多 160 个电子工时'), SK,
                   T(r"Now the electronic hours go from 240 all the way to 400. Using the shadow price, someone says profit rises by $160 \times 1.5 = 240$. What really happens?", r"现在电子工时从 240 一路加到 400。有人用影子价格算：利润增加 $160 \times 1.5 = 240$。真实情况是？"),
                   [(T(r"Profit rises by 240, to 650.", r"利润增加 240，到 650。"), T(r"That uses the price outside its stretch. Try it in the picture: past 300 hours the electronic wall is no longer where the best plan sits.", r"这是在允许范围之外用了影子价格。到图上试试：超过 300 个工时，最优计划就不在电子这面墙上了。"), 'shadow-forever'),
                    (T(r"Profit rises only to 500: past 300 hours, assembly is the limit and extra electronic hours are worth nothing.", r"利润只涨到 500：超过 300 个工时，装配成了限制，多出来的电子工时一文不值。"), True),
                    (T(r"Profit falls.", r"利润下降。"), T(r"More hours never hurt.", r"多给工时不会变差。"), None)],
                   T(r"The shadow price is a promise only inside the allowable increase and decrease. At 400 hours all 100 assembly hours go to BlueBerrys (0, 100), profit 500: the electronic limit has gone slack.", r"影子价格只在允许的增量和减量之内才作数。400 个工时时，100 个装配工时全部用来做 BlueBerry（0, 100），利润 500：电子这条限制已经变松了。")),

            read('names', T('The names of the numbers', '这些数的名字'),
                 p(T(r"Every column of the report has one question behind it. Learn the question and the name follows.", r"报告的每一列背后都是一个问题。弄懂问题，名字就记住了。")),
                 table([T('In the report', '报告里的'), T('The question it answers', '它回答的问题'), T('In Shader’s picture', '在 Shader 的图里')],
                       [T('**Final value** (variable)', '**终值**（变量）'), T('what the plan makes', '计划做多少'), T('the best corner’s coordinates, $(30, 40)$', '最优角的坐标 $(30, 40)$')],
                       [T('**Reduced cost**', '**递减成本**'), T('how much a variable that is 0 must improve before it is worth making', '一个为 0 的变量，要改善多少才值得做'), T('0 for both here: both are already made. Not 0 only for products the plan skips', '这里两个都是 0：都已经在做。只有计划不做的产品才不是 0')],
                       [T('**Objective coefficient**, allowable increase and decrease', '**目标系数**，允许的增量和减量'), T('how far the profit (or cost) per unit can move before another corner wins: the **range of optimality**', '单位利润（或成本）能动多远，别的角才会赢：**最优性范围**'), T('how far the profit line can turn before it leaves the best corner', '利润线转多远才会离开最优角')],
                       [T('**Final value** (constraint)', '**终值**（约束）'), T('how much of the limit the plan uses', '计划用掉了这条限制的多少'), T('the gauge at the best plan; the **slack** is right-hand side minus this', '最优计划处的刻度条；**松弛量**是右端减去它')],
                       [T('**Shadow price**', '**影子价格**'), T('what one more unit of the limit is worth to the objective', '这条限制多一个单位，对目标值值多少'), T('how far the best value moves when the wall moves one unit; 0 for a slack limit', '墙移一个单位，最优值动多少；松的限制为 0')],
                       [T('**Right-hand side**, allowable increase and decrease', '**约束右端**，允许的增量和减量'), T('how far the limit can move before the shadow price stops being true: the **range of feasibility**', '限制能动多远，影子价格才不再成立：**可行性范围**'), T('how far the wall can slide before the best corner changes to another pair of walls', '墙滑多远，最优角才会换成另一对墙')]),
                 callout('note', T('1E+30', '1E+30'), T(r"Excel prints 1E+30 for “no limit”: the number can grow without ever changing the answer. Read it as infinity.", r"Excel 用 1E+30 表示“没有上限”：这个数怎么增大都不会改变答案。当作无穷大来读。")),
                 callout('note', T('In a minimisation', '最小化问题里'), T(r"The shadow price is the change of the **objective** per extra unit, with its sign: raising an “at least” requirement costs more (positive), giving a capacity more hours saves cost (negative). The ranges are read in the same way. The DCI report below has a shadow price of $-0.375$ for assembly: one more minute lowers the cost by 0.375.", r"影子价格是每多一个单位时**目标值**的变化，带符号：提高“至少”类的要求会让成本更高（正），给容量多几个工时会省成本（负）。范围的读法相同。下面 DCI 的报告里装配的影子价格是 $-0.375$：多一分钟，成本降 0.375。")),
                 chapter=T('Names', '命名')),
            choice('which', T('Which number?', '该看哪个数？'), SK,
                   T(r"A plan skips a product (its final value is 0). The manager asks: how much would that product’s profit have to rise before the plan makes it?", r"计划里有一种产品不做（终值为 0）。经理问：这种产品的利润要涨多少，计划才会做它？"),
                   [(T(r"Its reduced cost.", r"它的递减成本。"), True),
                    (T(r"The shadow price of a limit.", r"某条限制的影子价格。"), T(r"A shadow price belongs to a **limit** and says what one more unit of it is worth. A product that is skipped has a reduced cost.", r"影子价格属于一条**限制**，说的是它多一个单位值多少。不做的产品看的是递减成本。"), 'reduced-vs-shadow'),
                    (T(r"The allowable decrease of its right-hand side.", r"它的右端的允许减量。"), T(r"Variables have no right-hand side. The ranges are for coefficients or limits.", r"变量没有右端。范围是针对系数或限制的。"), None)],
                   T(r"Reduced cost: how much a variable at zero must improve before it earns a place in the plan. A limit’s shadow price is a different thing.", r"递减成本：取值为 0 的变量要改善多少才能进入计划。限制的影子价格是另一回事。"), purpose='check'),

            read('exam', T('The exam’s version: five questions from one report', '考试里的版本：同一份报告的五个问题'),
                 p(T(r"The DCI problem of lesson 2 comes back, with its report. Parts (ii) to (vi) are 18 of the question’s 25 marks, and every one is read off this table. Below the question is the same table, touchable.",
                     r"第 2 课的 DCI 问题又回来了，附上了它的报告。第 (ii) 到 (vi) 问占这道题 25 分里的 18 分，每一问都是从这张表里读出来的。题目下面是同一张表，可以动手。")),
                 paper(T('Question 1 (part)', '第 1 题（节选）'),
                       *ptxt("The sensitivity analysis report is shown as below. The model: minimise 10x11 + 14x12 + 6x21 + 9x22 subject to x11 + x12 = 100, x21 + x22 = 150, 4x11 + 3x21 ≤ 600, 6x11 + 8x21 ≤ 1080.\n(ii) For the optimal solution, how much injection-molding time is spent? (3 marks)\n(iii) For the optimal solution, how much assembly time is spent? (3 marks)\n(iv) Would the solution change if the injection-molding time available were only 580 minutes instead of 600 minutes? (4 marks)\n(v) What would the optimal solution be if the purchase cost for each model B case were increased from $9 to $10? (4 marks)\n(vi) How much would total cost increase or decrease if the assembly time available were 1100 minutes instead of 1080 minutes? (4 marks)",
                         "灵敏度分析报告见下。模型：最小化 10x11 + 14x12 + 6x21 + 9x22，约束为 x11 + x12 = 100、x21 + x22 = 150、4x11 + 3x21 ≤ 600、6x11 + 8x21 ≤ 1080。\n(ii) 在最优解下，用掉了多少注塑时间？（3 分）\n(iii) 在最优解下，用掉了多少装配时间？（3 分）\n(iv) 如果可用的注塑时间只有 580 分钟而不是 600 分钟，解会变吗？（4 分）\n(v) 如果每个 B 型号外壳的外购成本从 $9 涨到 $10，最优解是什么？（4 分）\n(vi) 如果可用的装配时间是 1100 分钟而不是 1080 分钟，总成本会增加还是减少多少？（4 分）")),
                 frame('lp_report.html', T('The DCI sensitivity report, as printed on the paper (the used minutes are hidden, as in the question). Touch a number to see what it promises.', '试卷上的 DCI 灵敏度报告（和题目一样，隐去了用掉的分钟数）。点一个数，看它保证什么。'),
                       caption=T(r"Same numbers as the paper. Touch the shadow price of assembly, then type 1100 under the slider.", r"和试卷上的数一样。点装配的影子价格，然后在滑块下面输入 1100。"),
                       **report(DCI_ROWS, [10, 14, 6, 9], 'min', names4, hide_final=[2, 3], var_names=[T('A made', 'A 生产'), T('A bought', 'A 外购'), T('B made', 'B 生产'), T('B bought', 'B 外购')])),
                 chapter=T('On the paper', '考卷上')),
            derive('q1ii', T('(ii) and (iii): the time spent', '(ii)、(iii)：用掉的时间'),
                   [(r"x_{11} = 100,\quad x_{21} = 60", T(r"The plan: read the final values of the cases made. (Cases bought use no plant time.)", r"计划：读出自己生产的件数的终值。（外购的件不占工厂时间。）")),
                    (r"4x_{11} + 3x_{21} = 4(100) + 3(60)", T(r"(ii) Put the plan into the injection-molding limit’s left side: 4 minutes per A, 3 per B.", r"(ii) 把计划代入注塑限制的左边：每个 A 用 4 分钟，每个 B 用 3 分钟。")),
                    (r"= 580", T(r"Injection-molding time spent. It is below the 600 available, which is why this limit’s shadow price is 0.", r"用掉的注塑时间。它低于可用的 600，所以这条限制的影子价格是 0。")),
                    (r"6x_{11} + 8x_{21} = 6(100) + 8(60) = 1080", T(r"(iii) The same for assembly: 6 per A, 8 per B. All 1080 minutes are used: this limit is binding, and its shadow price is not 0.", r"(iii) 装配同理：每个 A 用 6 分钟，每个 B 用 8 分钟。1080 分钟全部用完：这条限制是紧的，影子价格不是 0。"))],
                   outro=T(r"**Answer:** injection-molding 580 minutes, assembly 1,080 minutes.", r"**答案：** 注塑 580 分钟，装配 1,080 分钟。"),
                   blank=(2, '580', T(r"Work out $4(100) + 3(60)$.", r"算出 $4(100) + 3(60)$。")), skill=SK),
            derive('q1iv', T('(iv): 580 minutes instead of 600', '(iv)：注塑时间 580 分钟'),
                   [(r"600 - 580 = 20", T(r"The limit has 20 minutes of room: the plan uses 580 of 600. A limit with room has shadow price 0.", r"这条限制有 20 分钟的富余：计划用了 600 里的 580。有富余的限制影子价格为 0。")),
                    (r"600 - 20 = 580", T(r"Read the report: the right-hand side may fall by 20 before the shadow price stops being valid.", r"读报告：右端可以减少 20，之后影子价格才不再有效。")),
                    (r"600 - 20 = 580 \le 580 < \infty", T(r"The new value 580 is exactly at the lower end of the range of feasibility 580 to infinity, so it is still inside.", r"新的值 580 正好在可行性范围 580 到无穷大的下端，所以仍然在范围之内。")),
                    (r"\Delta x_{11} = \Delta x_{21} = 0", T(r"The plan still fits: 580 minutes are enough for 100 A and 60 B.", r"计划仍然放得下：580 分钟刚好够做 100 个 A 和 60 个 B。"))],
                   outro=T(r"**Answer:** No. The shadow price is 0, there is 20 minutes of slack, and 580 is inside the range from 580 to infinity.", r"**答案：** 不会。影子价格是 0，有 20 分钟的富余，而 580 在 580 到无穷大的范围内。"),
                   blank=(0, '20', T(r"Slack: $600 - 580$.", r"富余：$600 - 580$。")), skill=SK),
            derive('q1v', T('(v): model B purchase cost 10', '(v)：B 型号外购成本 10'),
                   [(r"9 - 3 \le c_{22} \le 9 + 2.33", T(r"This is a change in an objective coefficient, so use the range of optimality: the cost 9, with allowable decrease 3 and increase 2.33.", r"这是目标系数的变化，所以用最优性范围：成本 9，允许减量 3、允许增量 2.33。")),
                    (r"6 \le 10 \le 11.33", T(r"The new cost 10 is inside: another plan does not become cheaper, so the best plan does not change.", r"新成本 10 在范围内：别的计划不会变得更便宜，所以最优计划不变。")),
                    (r"x_{11} = 100,\ x_{12} = 0,\ x_{21} = 60,\ x_{22} = 90", T(r"The optimal solution is the same plan as before.", r"最优解就是原来的计划。")),
                    (r"z = 2170 + 90(10 - 9) = 2260", T(r"Only the total cost changes: each of the 90 purchased B cases now costs 1 more.", r"变的只有总成本：买的 90 个 B 外壳每个多花 1。"))],
                   outro=T(r"**Answer:** the solution stays $x_{11} = 100$, $x_{12} = 0$, $x_{21} = 60$, $x_{22} = 90$; the total cost rises from \$2,170 to \$2,260.", r"**答案：** 解不变：$x_{11} = 100$、$x_{12} = 0$、$x_{21} = 60$、$x_{22} = 90$；总成本从 \$2,170 涨到 \$2,260。"),
                   blank=(3, '2260', T(r"$2170 + 90 \times 1$.", r"$2170 + 90 \times 1$。")), skill=SK),
            derive('q1vi', T('(vi): 1100 assembly minutes', '(vi)：装配时间 1100 分钟'),
                   [(r"1080 \to 1100:\ +20", T(r"A change in a right-hand side: use the shadow price and the range of feasibility. The change is +20 minutes.", r"右端的变化：用影子价格和可行性范围。变化量是 +20 分钟。")),
                    (r"1080 - 480 \le 1100 \le 1080 + 53.33 = 1133.33", T(r"Is 1100 inside the range of feasibility (allowable decrease 480, allowable increase 53.33)? Yes, so the shadow price applies.", r"1100 在可行性范围（允许减量 480、允许增量 53.33）内吗？在，所以影子价格适用。")),
                    (r"20 \times (-0.375) = -7.5", T(r"Twenty extra minutes, each lowering the cost by 0.375.", r"多 20 分钟，每分钟让成本降 0.375。")),
                    (r"2170 - 7.5 = 2162.5", T(r"The new total cost, if you want it.", r"新的总成本（如果题目需要）。"))],
                   outro=T(r"**Answer:** the total cost **decreases** by \$7.50.", r"**答案：** 总成本**减少** \$7.50。"),
                   blank=(2, '-7.5', T(r"$20 \times (-0.375)$.", r"$20 \times (-0.375)$。")), skill=SK),
            read('answer', T('The full-mark answer, as it is written', '满分答案，写在卷子上是这样'),
                 paper(T('Question 1 (ii) to (vi), full marks', '第 1 题 (ii) 到 (vi)，满分写法'),
                       *ptxt("(ii) x11 = 100 and x21 = 60, so 4(100) + 3(60) = 580 minutes of injection-molding time are spent.\n(iii) 6(100) + 8(60) = 1,080 minutes of assembly time are spent.\n(iv) No. The shadow price is 0 and there is slack of 600 − 580 = 20. 580 lies between the lower limit 580 (600 − 20) and the upper limit infinity.\n(v) 10 lies between 6 (9 − 3) and 11.33 (9 + 2.33), so the solution stays x11 = 100, x12 = 0, x21 = 60, x22 = 90. Only the total cost changes, from $2,170 to $2,260.\n(vi) The shadow price is −0.375 and 1100 lies below the upper limit 1,133.33 (1080 + 53.33). Total cost changes by 20(−0.375) = −$7.50: it decreases by $7.50.",
                         "(ii) x11 = 100、x21 = 60，所以用掉的注塑时间是 4(100) + 3(60) = 580 分钟。\n(iii) 6(100) + 8(60) = 1,080 分钟的装配时间被用掉。\n(iv) 不会。影子价格为 0，富余量 600 − 580 = 20。580 在下限 580（600 − 20）和上限无穷大之间。\n(v) 10 在 6（9 − 3）和 11.33（9 + 2.33）之间，所以解不变：x11 = 100、x12 = 0、x21 = 60、x22 = 90。只有总成本变了，从 $2,170 变成 $2,260。\n(vi) 影子价格是 −0.375，1100 低于上限 1,133.33（1080 + 53.33）。总成本变化 20(−0.375) = −$7.50：减少 $7.50。"), answer=True),
                 callout('note', T('What earns the marks', '得分点'), T(r"Each part is worth 3 or 4 marks and the answers are one or two lines long. The marks are for: **the right number**, **the reason** (inside the range, shadow price 0) and **the units or direction** (a decrease of \$7.50, not −7.5 alone).", r"每一问 3 或 4 分，答案只有一两行。得分点是：**正确的数**、**理由**（在范围内、影子价格为 0）和**单位或方向**（减少 \$7.50，而不是光写 −7.5）。")),
                 chapter=T('The answer', '答案')),

            read('msi', T('One more report: the survey firm', '再来一份报告：调查公司'),
                 p(T(r"Market Survey Inc. must make 1,000 interviews for a client, split by households with and without children and by day and evening, at the lowest cost. The report has the same shape as DCI’s. Answer the four questions from it; the numbers are not written anywhere except in the table.",
                     r"Market Survey 公司要为客户做 1,000 次访问，按有孩子和没孩子的家庭、白天和晚上分开，成本最低。报告的形状和 DCI 的一样。用它回答四个问题；这些数只在表里，别处没写。")),
                 frame('lp_report.html', T('The sensitivity report of the survey problem: four variables (with children day and evening, without children day and evening) and six limits.', '调查问题的灵敏度报告：四个变量（有孩子的白天和晚上、没孩子的白天和晚上）和六条限制。'),
                       caption=T(r"Costs per interview: children day \$20, evening \$25; no children day \$18, evening \$20.", r"每次访问的成本：有孩子白天 \$20、晚上 \$25；没孩子白天 \$18、晚上 \$20。"),
                       **report(MSI_ROWS, MSI_C, 'min', ['x11', 'x12', 'x21', 'x22'], var_names=[T('children, day', '有孩子，白天'), T('children, evening', '有孩子，晚上'), T('no children, day', '没孩子，白天'), T('no children, evening', '没孩子，晚上')])),
                 chapter=T('Use it', '用一用')),
            number('msi_lo', T('Range of optimality', '最优性范围'), SK,
                   T(r"What is the lower end of the range of optimality for the interview cost of households **with children, day** (currently \$20)?", r"**有孩子、白天**的访问成本（现为 \$20）的最优性范围的下端是多少？"),
                   round(c11_lo, 2), T(rf"The allowable decrease is {n(mv[0]['dec'], 2)}: $20 - {n(mv[0]['dec'], 2)} = {n(c11_lo, 2)}$. (The upper end is $20 + {n(mv[0]['inc'], 0)} = 25$.)", rf"允许减量是 {n(mv[0]['dec'], 2)}：$20 - {n(mv[0]['dec'], 2)} = {n(c11_lo, 2)}$。（上端是 $20 + {n(mv[0]['inc'], 0)} = 25$。）"),
                   tolerance=0.01, purpose='practice'),
            choice('msi_c12', T('A dearer evening interview', '晚上的访问变贵'), SK,
                   T(r"The evening interview with children rises from \$25 to \$30. Does the current plan stay optimal?", r"有孩子、晚上的访问成本从 \$25 涨到 \$30。现在的计划还是最优的吗？"),
                   [(T(r"Yes: 30 is inside the range 20 to infinity.", r"是：30 在 20 到无穷大的范围内。"), True),
                    (T(r"No: the cost went up, so the plan must change.", r"不是：成本涨了，计划一定会变。"), T(r"The plan already uses this variable; a dearer cost matters only once it passes the upper end. Here the allowable increase is 1E+30: never.", r"计划已经在用这个变量；成本只有超过上端才有影响。这里允许增量是 1E+30：永远不会。"), None),
                    (T(r"Cannot tell without re-solving.", r"不重新求解就无法知道。"), T(r"That is exactly what the range of optimality is for.", r"最优性范围正是为此而设。"), None)],
                   T(r"The report gives the range for $c_{12}$: $25 - 5 = 20$ up to $25 + 1\text{E}{+}30$. 30 is inside, so the plan does not change.", r"报告给出 $c_{12}$ 的范围：从 $25 - 5 = 20$ 到 $25 + 1\text{E}{+}30$。30 在范围内，所以计划不变。"), purpose='practice'),
            number('msi_hi', T('Range of feasibility', '可行性范围'), SK,
                   T(r"What is the upper end of the range of feasibility for the right-hand side of Requirement 1 (currently 400 households with children)?", r"要求 1（现为 400 个有孩子的家庭）的右端的可行性范围的上端是多少？"),
                   500, T(r"$400 + 100 = 500$. (The lower end is $400 - 400 = 0$.)", r"$400 + 100 = 500$。（下端是 $400 - 400 = 0$。）"), tolerance=0.01, purpose='practice'),
            number('msi_cost', T('A bigger requirement', '要求提高'), SK,
                   T(r"Requirement 1 is raised from 400 to 500 households with children. By how much does the total interviewing cost increase, in dollars?", r"要求 1 从 400 提高到 500 个有孩子的家庭。总访问成本增加多少美元？"),
                   280, T(r"500 is inside the range (0 to 500), so the shadow price 2.8 applies: $100 \times 2.8 = 280$. Re-solving the model gives the same \$280.", r"500 在范围（0 到 500）内，所以适用影子价格 2.8：$100 \times 2.8 = 280$。重新求解模型也得到 \$280。"),
                   tolerance=0.01, unit=T('dollars', '美元'), purpose='practice'),

            read('traps', T('Traps', '易错点'),
                 callout('warning', T('One change at a time', '一次只能变一个'), T(r"Each allowable range assumes **only that number** changes and everything else stays as printed. If two costs move together, or a cost and a limit, the report does not promise anything: re-solve (or state that you cannot tell).", r"每个允许范围都假设**只有那个数**变化、别的都保持原样。如果两个成本一起动，或者一个成本和一条限制一起动，报告就不保证什么了：重新求解（或写明无法判断）。")),
                 callout('warning', T('Which range?', '用哪个范围？'), T(r"A change to a **cost or profit per unit** uses the range of optimality and changes the objective value but usually not the plan. A change to a **right-hand side** uses the range of feasibility and the shadow price, and changes the plan.", r"**单位成本或利润**的变化用最优性范围，通常改变目标值而不改变计划。**右端**的变化用可行性范围和影子价格，会改变计划。")),
                 callout('warning', T('Sign and words', '符号和措辞'), T(r"Say which way the objective moves. In a minimisation a negative shadow price on a capacity means more of it **lowers** cost. Write “decrease by \$7.50”, not just “−7.5”.", r"要说清目标值往哪边走。最小化问题里，容量的影子价格为负，意思是多给一些会让成本**降低**。写“减少 \$7.50”，不要只写“−7.5”。")),
                 callout('note', T('Where the numbers come from', '这些数从哪来'), T(r"In the exam the report is given. With LINDO choose Reports, Solution for the plan and Reports, Range for the same ranges. With Excel Solver tick “Sensitivity” in the results window and open Sensitivity Report 1.", r"考试里报告是给好的。LINDO 里用 Reports 的 Solution 看计划，用 Reports 的 Range 看这些范围。Excel Solver 里在结果窗口勾选“Sensitivity”，打开“Sensitivity Report 1”工作表。")),
                 chapter=T('Traps', '易错点')),

            choice('recall_units', T('Recall: whose time', '回忆：谁的时间'), SK,
                   T(r"A plant makes some parts and buys the rest. A limit for the plant’s machine minutes should count:", r"一家工厂有的零件自己做、其余的外购。工厂机器分钟数的限制应该计入："),
                   [(T(r"only the parts made in the plant.", r"只有工厂自己做的零件。"), True),
                    (T(r"all parts, made or bought.", r"所有零件，不论自己做还是外购。"), T(r"Bought parts never touch the plant’s machines.", r"外购的零件根本不上工厂的机器。"), 'bought-uses-plant'),
                    (T(r"the parts bought, because they are the costly ones.", r"外购的零件，因为它们更贵。"), T(r"Cost belongs in the objective, not in a time limit.", r"成本属于目标函数，不属于时间限制。"), 'mixed-units')],
                   T(r"A limit counts only what uses the resource, in the resource’s unit.", r"一条限制只计入会用到这项资源的东西，用这项资源的单位。"), purpose='check'),
            choice('recall_corner', T('Recall: what a shadow price is in the picture', '回忆：图里的影子价格'), SK,
                   T(r"In the plan plane, the shadow price of a binding limit is:", r"在计划平面里，一条紧的限制的影子价格是："),
                   [(T(r"how far the best value moves when that wall slides one unit.", r"那面墙滑一个单位，最优值移动多少。"), True),
                    (T(r"how far the best plan sits from that wall.", r"最优计划离那面墙有多远。"), T(r"A binding limit has the best plan on its wall: distance 0.", r"紧的限制的墙上就有最优计划：距离为 0。"), None),
                    (T(r"the slope of the profit line.", r"利润线的斜率。"), T(r"The slope comes from the objective coefficients, not from a limit.", r"斜率来自目标系数，不是来自某条限制。"), None)],
                   T(r"Slide the wall, watch the best value: that rate is the shadow price (inside its stretch).", r"滑动那面墙，看最优值：那个变化率就是影子价格（在允许范围内）。"), purpose='check'),
        ],
    )
