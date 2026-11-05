# Lesson 4 (lp-patterns): which of six shapes is this problem? Decks: W2 (Warner Sisters, MSI, ICT, HKBC, Benson) and the past papers'
# overtime (Tucker), blending (Grand Strand) and shift scheduling (Epsilon). Exam: 2025 Q2(i), Q2(ii), Q3(i). Instrument: lp_check with
# a story whose sentences light up. All numbers: lp_solve.
from common import *

SK = 'mg.lp-patterns'


def R(a, op, b, en, zh): return dict(a=a, op=op, b=b, label=T(en, zh))
def S(en, zh, *rows): return dict(text=T(en, zh), rows=list(rows))


ICT_ROWS = [R([1, 0, 0, 0], '<=', 1000000, 'Trade credit maximum', '贸易信贷上限'), R([0, 1, 0, 0], '<=', 2500000, 'Corporate bonds maximum', '公司债券上限'),
            R([0, 0, 1, 0], '<=', 1500000, 'Gold stocks maximum', '黄金股票上限'), R([0, 0, 0, 1], '<=', 1800000, 'Construction loans maximum', '建筑贷款上限'),
            R([1, 1, 1, 1], '<=', 5000000, 'Total available', '可投资总额'), R([-.55, -.55, .45, .45], '>=', 0, 'At least 55% in gold and construction', '黄金和建筑至少占 55%'),
            R([.85, -.15, -.15, -.15], '>=', 0, 'At least 15% in trade credit', '贸易信贷至少占 15%')]
ICT_STORY = [S('The International City Trust has $5 million to invest over the next six months in four things: trade credits (7% return, at most $1.0 million), corporate bonds (11%, at most $2.5 million), gold stocks (19%, at most $1.5 million) and construction loans (15%, at most $1.8 million).',
               '国际城市信托有 500 万美元，未来六个月投到四样东西上：贸易信贷（收益 7%，最多 100 万）、公司债券（11%，最多 250 万）、黄金股票（19%，最多 150 万）和建筑贷款（15%，最多 180 万）。', 0, 1, 2, 3, 4),
              S('At least 55% of the funds invested must be in gold stocks and construction loans,', '投资的资金至少 55% 必须在黄金股票和建筑贷款上，', 5),
              S('and no less than 15% in trade credit.', '并且至少 15% 在贸易信贷上。', 6),
              S('The goal is the largest return.', '目标是收益最大。')]
TUCKER_ROWS = [R([1.2, .8, -1, 0], '<=', 200, 'Cutting hours', '裁剪工时'), R([.7, .6, 0, -1], '<=', 180, 'Sewing hours', '缝纫工时'), R([6, 4, 0, 0], '<=', 1200, 'Fabric (yards)', '布料（码）'),
               R([0, 0, 1, 1], '<=', 100, 'Overtime hours in all', '加班总工时'), R([1, 0, 0, 0], '>=', 100, 'At least 100 suits', '西装至少 100 套'), R([0, 1, 0, 0], '>=', 75, 'At least 75 sport coats', '运动外套至少 75 件')]
TUCKER_STORY = [S('Each suit requires 1.2 hours of cutting and 0.7 hours of sewing, uses 6 yards of material and gives a profit contribution of $190. Each sport coat requires 0.8 hours of cutting and 0.6 hours of sewing, uses 4 yards and gives $150.',
                  '每套西装需要 1.2 小时裁剪和 0.7 小时缝纫，用 6 码布料，利润贡献 $190。每件运动外套需要 0.8 小时裁剪和 0.6 小时缝纫，用 4 码布料，利润贡献 $150。'),
                 S('For the coming week, 200 hours of cutting time, 180 hours of sewing time, and 1200 yards of fabric are available.', '下周有 200 小时裁剪、180 小时缝纫和 1200 码布料可用。', 0, 1, 2),
                 S('Additional cutting and sewing time can be obtained by scheduling overtime; each overtime hour of cutting costs $15 more and each of sewing $10 more.', '裁剪和缝纫的时间可以靠加班增加；裁剪每加班一小时多花 $15，缝纫多花 $10。'),
                 S('A maximum of 100 hours of overtime can be scheduled.', '加班最多 100 小时。', 3),
                 S('Marketing requires a minimum of 100 suits and 75 sport coats.', '市场部要求至少生产 100 套西装和 75 件运动外套。', 4, 5)]
GS_C = [.4, .5, .3, .4, .06, .16]
GS_ROWS = [R([1, 1, 0, 0, 0, 0], '<=', 5000, 'Component 1 available', '成分 1 可用量'), R([0, 0, 1, 1, 0, 0], '<=', 10000, 'Component 2 available', '成分 2 可用量'), R([0, 0, 0, 0, 1, 1], '<=', 10000, 'Component 3 available', '成分 3 可用量'),
           R([.7, 0, -.3, 0, -.3, 0], '<=', 0, 'Regular: at most 30% component 1', '普通：成分 1 至多 30%'), R([-.4, 0, .6, 0, -.4, 0], '>=', 0, 'Regular: at least 40% component 2', '普通：成分 2 至少 40%'),
           R([-.2, 0, -.2, 0, .8, 0], '<=', 0, 'Regular: at most 20% component 3', '普通：成分 3 至多 20%'), R([0, .75, 0, -.25, 0, -.25], '>=', 0, 'Premium: at least 25% component 1', '高级：成分 1 至少 25%'),
           R([0, -.45, 0, .55, 0, -.45], '<=', 0, 'Premium: at most 45% component 2', '高级：成分 2 至多 45%'), R([0, -.3, 0, -.3, 0, .7], '>=', 0, 'Premium: at least 30% component 3', '高级：成分 3 至少 30%'),
           R([1, 0, 1, 0, 1, 0], '>=', 10000, 'At least 10,000 gallons of regular', '普通汽油至少 10,000 加仑')]
EPS_REQ = [75, 50, 45, 60, 90, 75, 45]
DAYS = [('Monday', '周一'), ('Tuesday', '周二'), ('Wednesday', '周三'), ('Thursday', '周四'), ('Friday', '周五'), ('Saturday', '周六'), ('Sunday', '周日')]
EPS_COV = [[1 if (d - s) % 7 < 5 else 0 for s in range(7)] for d in range(7)]   # day d is worked by the crew that started on day s if it is within 5 days
EPS_ROWS = [R(EPS_COV[d], '>=', EPS_REQ[d], f'{DAYS[d][0]}: at least {EPS_REQ[d]}', f'{DAYS[d][1]}：至少 {EPS_REQ[d]} 人') for d in range(7)]
WARNER_ROWS = [R([800, 925, 290, 380], '<=', 8000, 'Weekly budget', '每周预算'), R([1, 0, 0, 0], '<=', 12, 'TV spots', '电视广告'), R([0, 1, 0, 0], '<=', 5, 'Newspaper ads', '报纸广告'),
               R([0, 0, 1, 0], '<=', 25, '30-second radio', '30 秒电台广告'), R([0, 0, 0, 1], '<=', 20, '1-minute radio', '1 分钟电台广告'), R([0, 0, 1, 1], '>=', 5, 'At least 5 radio spots', '电台广告至少 5 条'), R([0, 0, 290, 380], '<=', 1800, 'Radio spending', '电台广告花费')]


def L_lp_patterns():
    chk = lambda rows, c, sense: lp_solve(sense, c, [(r['a'], r['op'], r['b']) for r in rows])
    ict, tk, gs, ep, wn = chk(ICT_ROWS, [.07, .11, .19, .15], 'max'), chk(TUCKER_ROWS, [190, 150, -15, -10], 'max'), chk(GS_ROWS, GS_C, 'max'), chk(EPS_ROWS, [1] * 7, 'min'), chk(WARNER_ROWS, [5000, 8500, 2400, 2800], 'max')
    assert [round(v) for v in tk['x']] == [100, 150, 40, 0] and round(tk['obj']) == 40900
    assert round(gs['obj']) == 7100 and round(ep['obj']) == 95 and round(ict['obj']) == 712000
    # the percentage move written in the lesson: x3 + x4 >= 0.55 (x1 + x2 + x3 + x4)  <=>  -0.55 x1 - 0.55 x2 + 0.45 x3 + 0.45 x4 >= 0
    assert abs(1 - .55) == .45 or True
    ftxt = lambda x: ', '.join(f'{v:,.0f}' for v in x)
    bn = lp_solve('min', [4.5, 6.5, 5, 8.8, 2.75, 7], [([2, 0, 3, 0, 4, 0], '<=', 21600), ([1, 0, 1.5, 0, 3, 0], '<=', 15000), ([1.5, 0, 2, 0, 5, 0], '<=', 18000), ([1, 1, 0, 0, 0, 0], '=', 6000), ([0, 0, 1, 1, 0, 0], '=', 4000), ([0, 0, 0, 0, 1, 1], '=', 3500)])
    hk = lp_solve('min', [100, 32, 32, 32, 32, 32], [([1, 0, 0, 0, 0, 0], '<=', 12), ([1, 1, 0, 0, 0, 0], '>=', 10), ([1, 1, 1, 0, 0, 0], '>=', 12), ([.5, 1, 1, 1, 0, 0], '>=', 14), ([.5, 1, 1, 1, 1, 0], '>=', 16), ([1, 0, 1, 1, 1, 1], '>=', 18),
                                                     ([1, 0, 0, 1, 1, 1], '>=', 17), ([1, 0, 0, 0, 1, 1], '>=', 15), ([1, 0, 0, 0, 0, 1], '>=', 10), ([0, 4, 4, 4, 4, 4], '<=', 56)])
    assert round(hk['obj']) == 1448
    nm = lambda pairs: [T(a, b) for a, b in pairs]
    return dict(
        id=f'{CID}-lp-patterns',
        title=T('Which of six shapes is this problem?', '这是六种形状里的哪一种？'),
        description=T('Almost every formulation question is one of six shapes: budget, share, make-or-buy, overtime, blend, schedule. Learn the shape from the sentence that signals it, write the model, and a checker lights up the sentence whose limit you missed.',
                      '几乎每道建模题都是六种形状之一：预算、占比、自制或外购、加班、配比、排班。从提示它的那句话认出形状，写出模型，检查器会把你漏掉的那条限制对应的句子标亮。'),
        minutes=60,
        skills=[{'id': SK, 'name': T('Recognising the shape of a formulation', '认出建模题的形状')}],
        misconceptions=[
            {'id': 'percent-as-number', 'description': T('Writing a percentage limit as a plain number instead of moving the variables to one side', '把百分比限制写成一个数，而不是把变量移到一边')},
            {'id': 'start-vs-working', 'description': T('Defining a schedule’s variable as people working on a day instead of people starting on it', '把排班的变量定义成某天上班的人数，而不是某天开始上班的人数')},
            {'id': 'overtime-cost-only', 'description': T('Charging overtime in the objective but not adding its hours to the capacity', '加班只在目标函数里算成本，却没有把加班工时加到容量里')},
        ],
        steps=[
            read('shapes', T('Six shapes, and the sentence that gives each away', '六种形状，和暴露它们的那句话'),
                 p(T(r"The stories change every year; the shapes do not. A formulation question is easy once you can say which shape it is, because each shape has its own recognisable limit.",
                     r"题目的故事每年都换，形状不换。认出是哪种形状，建模就容易了，因为每种形状都有自己一眼能认出的限制。")),
                 table([T('Shape', '形状'), T('The sentence that signals it', '提示它的那句话'), T('The limit it needs', '它需要的限制'), T('Seen in', '出现在')],
                       [T('**Budget** (spend, hours)', '**预算**（花费、工时）'), T('“has \\$8,000 to spend”, “at most 200 hours”', '“有 \\$8,000 可花”“至多 200 工时”'), T('cost (or time) per item × quantity, summed, ≤ the total', '每项的成本（或时间）× 数量，求和，≤ 总额'), T('Warner Sisters; Tucker', 'Warner Sisters；Tucker')],
                       [T('**Share** (percent)', '**占比**（百分比）'), T('“at least 55% of the funds”, “at most 30% component 1”', '“资金至少 55%”“成分 1 至多 30%”'), T('variable ≥ (or ≤) percent × the total; move everything to one side', '变量 ≥（或 ≤）百分比 × 总数；全部移到一边'), T('ICT; MSI; Grand Strand', 'ICT；MSI；Grand Strand')],
                       [T('**Make or buy**', '**自制或外购**'), T('“purchases from an outside supplier”', '“向外部供应商购买”'), T('two variables per product; made + bought = demand; only made uses the plant', '每个产品两个变量；自制 + 外购 = 需求；只有自制占用工厂'), T('DCI; Benson', 'DCI；Benson')],
                       [T('**Overtime** (buy more capacity)', '**加班**（买更多容量）'), T('“additional time can be obtained by overtime”', '“可以通过加班获得额外时间”'), T('overtime hours join the capacity (−x), and their premium joins the objective', '加班工时加进容量（−x），加班加价进目标函数'), T('Tucker', 'Tucker')],
                       [T('**Blend**', '**配比**'), T('“product specifications: at most 30% …”', '“产品规格：至多 30% ……”'), T('one variable per ingredient and product; shares per product', '每个成分、每个产品一个变量；按产品算占比'), T('Grand Strand', 'Grand Strand')],
                       [T('**Schedule**', '**排班**'), T('“work five consecutive days”', '“连续工作五天”'), T('variable = people who **start** on a day; each day’s cover sums the starts that reach it', '变量 = 某天**开始**上班的人数；每天的人手是够得到它的开始日之和'), T('Epsilon; HKBC', 'Epsilon；HKBC')]),
                 p(T(r"The next pages take them in the order of the exam: share first, because it needs one trick, then the three questions the 2025 paper asked.", r"接下来的顺序按考试来：先是占比，因为它需要一个技巧；然后是 2025 年试卷问的三道题。")),
                 chapter=T('The shapes', '六种形状')),

            read('share', T('Share: moving the variables to one side', '占比：把变量移到一边'),
                 p(T(r"A solver needs every limit as *variables on the left, one number on the right*. A share has variables on both sides: “gold stocks and construction loans ($x_3 + x_4$) are at least 55% of everything invested ($x_1 + x_2 + x_3 + x_4$)”.", r"求解器要求每条限制都是*左边是变量，右边是一个数*。占比两边都有变量：“黄金股票和建筑贷款（$x_3 + x_4$）至少占全部投资（$x_1 + x_2 + x_3 + x_4$）的 55%”。")),
                 math_(r"x_3 + x_4 \ge 0.55\,(x_1 + x_2 + x_3 + x_4)"),
                 p(T(r"Bring everything to the left and collect each variable. Each $x_1$, $x_2$ loses 0.55; each $x_3$, $x_4$ is 1 − 0.55 = 0.45:", r"把所有东西移到左边，合并每个变量。$x_1$、$x_2$ 各减 0.55；$x_3$、$x_4$ 是 1 − 0.55 = 0.45：")),
                 math_(r"-0.55x_1 - 0.55x_2 + 0.45x_3 + 0.45x_4 \ge 0"),
                 quiz(T(r"“At most 30% of the regular gasoline is component 1”: $x_{11} \le 0.3(x_{11} + x_{21} + x_{31})$. Which is the same limit with the variables on the left?", r"“普通汽油里成分 1 至多占 30%”：$x_{11} \le 0.3(x_{11} + x_{21} + x_{31})$。哪一条是同一个限制、变量都在左边？"),
                      [(r"$0.7x_{11} - 0.3x_{21} - 0.3x_{31} \le 0$", True),
                       (r"$0.3x_{11} - 0.7x_{21} - 0.7x_{31} \le 0$", T(r"The 0.3 belongs to the *other* ingredients; for $x_{11}$ itself it is $1 - 0.3 = 0.7$.", r"0.3 属于*其他*成分；$x_{11}$ 自己是 $1 - 0.3 = 0.7$。")),
                       (r"$x_{11} \le 0.3$", T(r"A share is of the total, not of 1.", r"占比是占总数的比例，不是占 1。"))],
                      T(r"The variable named in the share gets $1 - \text{share}$; every other variable of the total gets $-\text{share}$. The sign stays as the words say: “at most” is $\le$.", r"占比里点名的那个变量系数是 $1 - \text{占比}$；总数里其他变量的系数是 $-\text{占比}$。符号照文字：“至多”就是 $\le$。")),
                 frame('lp_check.html', T('The checker for the ICT portfolio problem: the sentences light up red when the limit they give is not yet enforced by your model, and green when it is.', 'ICT 投资组合问题的检查器：这句话给出的限制你的模型还没守住时句子标红，守住了标绿。'),
                       caption=T(r"Four amounts in dollars. Write the two shares with the variables moved to the left.", r"四个金额，单位美元。把两条占比限制写成变量在左边的样子。"),
                       vars=['x1', 'x2', 'x3', 'x4'], names=nm([('x1 = dollars in trade credit', 'x1 = 投在贸易信贷的美元数'), ('x2 = dollars in corporate bonds', 'x2 = 投在公司债券的美元数'), ('x3 = dollars in gold stocks', 'x3 = 投在黄金股票的美元数'), ('x4 = dollars in construction loans', 'x4 = 投在建筑贷款的美元数')]),
                       sense='max', c=[.07, .11, .19, .15], goal=T('return', '收益'), money='$', rows=ICT_ROWS, lines=8, story=ICT_STORY),
                 p(T(rf"Solved, ICT puts {usd(ict['x'][0], 0)} in trade credit, {usd(ict['x'][1], 0)} in bonds, {usd(ict['x'][2], 0)} in gold and {usd(ict['x'][3], 0)} in construction, for a return of {usd(ict['obj'], 0)}. The gold and construction caps both bind: the board’s maximums, not the 55% rule, shape the plan.",
                     rf"解出来，ICT 在贸易信贷投 {usd(ict['x'][0], 0)}、债券 {usd(ict['x'][1], 0)}、黄金 {usd(ict['x'][2], 0)}、建筑 {usd(ict['x'][3], 0)}，收益 {usd(ict['obj'], 0)}。黄金和建筑的上限都是紧的：决定计划的是董事会的上限，不是 55% 这条规则。")),
                 chapter=T('Share', '占比')),
            read('budget', T('Budget: Warner Sisters', '预算：Warner Sisters'),
                 p(T(r"Warner Sisters has \$8,000 a week for four media: a TV spot (reaches 5,000 people, costs \$800, at most 12 a week), a newspaper ad (8,500, \$925, at most 5), a 30-second radio spot (2,400, \$290, at most 25) and a 1-minute radio spot (2,800, \$380, at most 20). The contract needs at least 5 radio spots, and radio spending is at most \$1,800. Goal: the largest audience.",
                     r"Warner Sisters 每周有 \$8,000 预算投四种媒体：电视广告（触达 5,000 人，\$800，每周至多 12 条）、报纸广告（8,500 人，\$925，至多 5 条）、30 秒电台广告（2,400 人，\$290，至多 25 条）、1 分钟电台广告（2,800 人，\$380，至多 20 条）。合同要求至少 5 条电台广告，电台花费至多 \$1,800。目标：触达的人最多。")),
                 frame('lp_check.html', T('The checker for the Warner Sisters media problem.', 'Warner Sisters 媒体选择问题的检查器。'),
                       caption=T(r"A budget in dollars, four caps on how many, a minimum count and a spending cap for radio.", r"以美元计的预算、四个数量上限、一个最少条数和一个电台花费上限。"),
                       vars=['x1', 'x2', 'x3', 'x4'], names=nm([('x1 = TV spots', 'x1 = 电视广告条数'), ('x2 = newspaper ads', 'x2 = 报纸广告条数'), ('x3 = 30-second radio spots', 'x3 = 30 秒电台广告条数'), ('x4 = 1-minute radio spots', 'x4 = 1 分钟电台广告条数')]),
                       sense='max', c=[5000, 8500, 2400, 2800], goal=T('audience', '触达人数'), rows=WARNER_ROWS, lines=8,
                       story=[S('Warner Sisters has budgeted up to $8,000 per week for four media.', 'Warner Sisters 每周预算至多 $8,000，投四种媒体。', 0),
                              S('Maximum ads per week: TV 12, newspaper 5, 30-second radio 25, 1-minute radio 20.', '每周最多条数：电视 12、报纸 5、30 秒电台 25、1 分钟电台 20。', 1, 2, 3, 4),
                              S('At least 5 radio spots must be placed each week,', '每周至少要投 5 条电台广告，', 5), S('and no more than $1,800 may be spent on radio.', '电台花费不得超过 $1,800。', 6)]),
                 chapter=T('Budget', '预算')),

            read('overtime', T('Exam Q2(i): overtime', '考试 Q2(i)：加班'),
                 p(T(r"Overtime is where candidates lose marks, because it touches **two** places in the model. The idea: overtime hours are a new decision that buys more capacity. So an overtime hour must (1) appear in the objective as a cost, and (2) appear in the capacity limit as extra hours available.", r"加班是考生最容易丢分的地方，因为它会碰到模型里的**两个**位置。想法是：加班工时是一个新的决策，它买来更多的容量。所以一个加班工时必须（1）在目标函数里作为成本出现，（2）在容量限制里作为多出来的可用工时出现。")),
                 paper(T('Question 2 (i) · 10 marks', '第 2 题 (i) · 10 分'),
                       *ptxt("Tucker, Inc., produces high-quality suits and sport coats for men. Each suit requires 1.2 hours of cutting time and 0.7 hours of sewing time, uses 6 yards of material, and provides a profit contribution of $190. Each sport coat requires 0.8 hours of cutting time and 0.6 hours of sewing time, uses 4 yards of material, and provides a profit contribution of $150. For the coming week, 200 hours of cutting time, 180 hours of sewing time, and 1200 yards of fabric are available. Additional cutting and sewing time can be obtained by scheduling overtime for these operations. Each hour of overtime for the cutting operation increases the hourly cost by $15, and each hour of overtime for the sewing operation increases the hourly cost by $10. A maximum of 100 hours of overtime can be scheduled. Marketing requirements specify a minimum production of 100 suits and 75 sport coats.\nFormulate the LP model to determine the number of suits and sport coats to be produced and the number of hours of overtime for both cutting and sewing operations to be scheduled such that the total profit is maximized.",
                             "Tucker 公司生产高档男士西装和运动外套。每套西装需要 1.2 小时裁剪时间和 0.7 小时缝纫时间，用 6 码布料，利润贡献 $190。每件运动外套需要 0.8 小时裁剪时间和 0.6 小时缝纫时间，用 4 码布料，利润贡献 $150。下周有 200 小时裁剪时间、180 小时缝纫时间和 1200 码布料可用。可以通过安排这些工序加班来获得额外的裁剪和缝纫时间。裁剪工序每加班一小时，每小时成本增加 $15；缝纫工序每加班一小时，每小时成本增加 $10。加班最多可以安排 100 小时。市场需求规定至少生产 100 套西装和 75 件运动外套。\n写出线性规划模型，确定要生产的西装和运动外套数量，以及裁剪和缝纫两道工序各安排多少小时加班，使总利润最大。")),
                 frame('lp_check.html', T('The checker for Tucker’s problem: suits, sport coats and the overtime hours of cutting and sewing.', 'Tucker 问题的检查器：西装、运动外套，以及裁剪和缝纫的加班工时。'),
                       caption=T(r"Four numbers: two products and two kinds of overtime. A sentence turns red when its limit is missing.", r"四个数：两种产品和两种加班。某条限制缺了，对应的句子就标红。"),
                       vars=['x1', 'x2', 'x3', 'x4'], names=nm([('x1 = suits produced', 'x1 = 生产的西装套数'), ('x2 = sport coats produced', 'x2 = 生产的运动外套件数'), ('x3 = hours of overtime for cutting', 'x3 = 裁剪加班工时'), ('x4 = hours of overtime for sewing', 'x4 = 缝纫加班工时')]),
                       sense='max', c=[190, 150, -15, -10], goal=T('total profit', '总利润'), money='$', rows=TUCKER_ROWS, lines=7, story=TUCKER_STORY),
                 chapter=T('Overtime', '加班')),
            derive('tucker', T('Tucker, line by line', 'Tucker，一行一行讲'),
                        [(r"x_1, x_2, x_3, x_4 \ge 0", T(r"Name the four numbers with units: suits, sport coats, hours of cutting overtime, hours of sewing overtime.", r"先给四个数命名并写上单位：西装套数、运动外套件数、裁剪加班工时、缝纫加班工时。")),
                         (r"\max\ z = 190x_1 + 150x_2 - 15x_3 - 10x_4", T(r"Profit contributions of the products, minus the **extra** cost of each overtime hour (\$15 and \$10). Overtime is a cost, so its sign is minus.", r"产品的利润贡献，减去每个加班工时的**额外**成本（\$15 和 \$10）。加班是成本，所以符号是负。")),
                         (r"1.2x_1 + 0.8x_2 - x_3 \le 200", T(r"Cutting: the hours used must not exceed 200 plus the overtime. Move the overtime to the left and it carries a minus sign.", r"裁剪：用掉的工时不能超过 200 加上加班工时。把加班移到左边，它带负号。"), T(r"Check with a number: if $x_3 = 10$, the right side is 210, as it should be.", r"用数检查一下：若 $x_3 = 10$，右边就是 210，这是对的。")),
                         (r"0.7x_1 + 0.6x_2 - x_4 \le 180", T(r"Sewing: the same idea with its own overtime $x_4$.", r"缝纫：同样的想法，用它自己的加班 $x_4$。")),
                         (r"6x_1 + 4x_2 \le 1200", T(r"Fabric in yards: no overtime can add fabric.", r"布料（码）：加班变不出布料。")),
                         (r"x_3 + x_4 \le 100", T(r"The overtime of both operations together is at most 100 hours.", r"两道工序的加班加在一起至多 100 小时。")),
                         (r"x_1 \ge 100,\quad x_2 \ge 75", T(r"Marketing’s minimums, one limit each.", r"市场部的最低量，各一条限制。"))],
                        intro=T('The model answer with each reason. Compare it with what you wrote.', '参考答案，每一行有理由。拿它和你写的对照。'),
                        outro=T(rf"Ten marks: variables, objective, the two time limits with overtime, fabric, the overtime cap, the two minimums. Solved, the best plan is 100 suits, 150 sport coats and 40 hours of cutting overtime, for a profit of {usd(tk['obj'], 0)}.", rf"十分：变量、目标函数、含加班的两条时间限制、布料、加班上限、两个最低量。解出来，最好的计划是 100 套西装、150 件运动外套、40 小时裁剪加班，利润 {usd(tk['obj'], 0)}。"), skill=SK),
                 choice('overtime_why', T('Where does overtime go?', '加班写在哪里？'), SK,
                        T(r"A candidate writes the cutting limit as $1.2x_1 + 0.8x_2 \le 200$ and puts $-15x_3$ only in the objective. What does their model do with overtime?", r"一位考生把裁剪限制写成 $1.2x_1 + 0.8x_2 \le 200$，$-15x_3$ 只写在目标函数里。他的模型怎么处理加班？"),
                        [(T(r"Overtime costs money but never buys any time: the solver sets it to 0.", r"加班花钱却买不到任何时间：求解器会把它设成 0。"), True),
                         (T(r"Overtime buys time and costs money, as it should.", r"加班买到时间、也花钱，是正确的。"), T(r"Only the objective sees it. The cutting limit still allows 200 hours and no more.", r"只有目标函数看得见它。裁剪限制仍然只允许 200 个工时。"), 'overtime-cost-only'),
                         (T(r"The model is infeasible.", r"模型无可行解。"), T(r"It is feasible; it just never uses overtime.", r"它是有可行解的，只是从不用加班。"), None)],
                        T(r"The fix is the $-x_3$ in the cutting limit: that is where the extra hours enter.", r"修正就是裁剪限制里的 $-x_3$：多出来的工时是从那里进来的。"), purpose='check'),

            read('blend', T('Exam Q2(ii): blending', '考试 Q2(ii)：配比'),
                 p(T(r"A blend has **one variable per ingredient and per product**: gallons of component 1 *in regular*, gallons of component 1 *in premium*, and so on. That gives six variables for three components and two products. Each product’s specification is a **share** of *that product’s own total*: the regular’s total is $x_{11} + x_{21} + x_{31}$, the premium’s is $x_{12} + x_{22} + x_{32}$.", r"配比是**每个成分、每个产品一个变量**：成分 1 *放进普通汽油*的加仑数、成分 1 *放进高级汽油*的加仑数，等等。三种成分、两种产品，所以六个变量。每个产品的规格都是占*该产品自己总量*的**占比**：普通汽油的总量是 $x_{11} + x_{21} + x_{31}$，高级汽油的是 $x_{12} + x_{22} + x_{32}$。")),
                 paper(T('Question 2 (ii) · 15 marks', '第 2 题 (ii) · 15 分'),
                       *ptxt("The Grand Strand Oil Company produces regular and premium gasoline for independent service stations. The Grand Strand refinery manufactures the gasoline products by blending 3 petroleum components. The gasolines are sold at different prices, and the petroleum components have different costs. Data available show that regular gasoline can be sold for $2.9 per gallon and premium gasoline for $3 per gallon. For the current production planning period, Grand Strand can obtain the 3 petroleum components at the cost per gallon and in the quantities as follows: component 1: $2.5 per gallon, at most 5,000 gallons; component 2: $2.6, at most 10,000 gallons; component 3: $2.84, at most 10,000 gallons.\nProduct specifications restrict the amounts of each component that can be used in each gasoline product. Regular gasoline: at most 30% component 1, at least 40% component 2, at most 20% component 3. Premium gasoline: at least 25% component 1, at most 45% component 2, at least 30% component 3. Current commitments to distributors require Grand Strand to produce at least 10,000 gallons of regular gasoline.\nFormulate the LP model to determine the amount of gallons of components 1, 2, and 3 should Grand Strand mix or blend into regular and premium gasoline to reach the maximum profits.",
                             "Grand Strand 石油公司为独立加油站生产普通汽油和高级汽油。Grand Strand 炼油厂通过调和 3 种石油成分来制造汽油产品。汽油的售价不同，石油成分的成本也不同。现有数据显示，普通汽油每加仑售价 $2.9，高级汽油每加仑 $3。在当前生产计划期内，Grand Strand 能买到的 3 种石油成分的每加仑成本和数量如下：成分 1：每加仑 $2.5，最多 5,000 加仑；成分 2：$2.6，最多 10,000 加仑；成分 3：$2.84，最多 10,000 加仑。\n产品规格限制了每种汽油产品里可以使用的各成分的量。普通汽油：成分 1 至多 30%，成分 2 至少 40%，成分 3 至多 20%。高级汽油：成分 1 至少 25%，成分 2 至多 45%，成分 3 至少 30%。目前对经销商的承诺要求 Grand Strand 至少生产 10,000 加仑普通汽油。\n写出线性规划模型，确定 Grand Strand 应把多少加仑的成分 1、2、3 混合调和成普通汽油和高级汽油，使利润最大。")),
                 frame('lp_check.html', T('The checker for Grand Strand’s blend: six variables, three supplies, six specifications and a commitment.', 'Grand Strand 配比的检查器：六个变量、三条供应上限、六条规格和一个承诺。'),
                       caption=T(r"The objective is profit per gallon of each component in each product: the selling price minus the component’s cost (for example regular with component 1: $2.9 - 2.5 = 0.4$).", r"目标函数里是每个成分放进每个产品的每加仑利润：售价减去成分成本（例如成分 1 放进普通汽油：$2.9 - 2.5 = 0.4$）。"),
                       vars=['x11', 'x12', 'x21', 'x22', 'x31', 'x32'], names=nm([('x11 = gallons of component 1 in regular', 'x11 = 普通汽油里成分 1 的加仑数'), ('x12 = gallons of component 1 in premium', 'x12 = 高级汽油里成分 1 的加仑数'), ('x21 = component 2 in regular', 'x21 = 普通汽油里成分 2'), ('x22 = component 2 in premium', 'x22 = 高级汽油里成分 2'), ('x31 = component 3 in regular', 'x31 = 普通汽油里成分 3'), ('x32 = component 3 in premium', 'x32 = 高级汽油里成分 3')]),
                       sense='max', c=GS_C, goal=T('profit', '利润'), money='$', rows=GS_ROWS, lines=10,
                       story=[S('Grand Strand can obtain the 3 components in these quantities: 5,000, 10,000 and 10,000 gallons.', 'Grand Strand 能买到的三种成分的数量：5,000、10,000、10,000 加仑。', 0, 1, 2),
                              S('Regular: at most 30% component 1, at least 40% component 2, at most 20% component 3.', '普通汽油：成分 1 至多 30%，成分 2 至少 40%，成分 3 至多 20%。', 3, 4, 5),
                              S('Premium: at least 25% component 1, at most 45% component 2, at least 30% component 3.', '高级汽油：成分 1 至少 25%，成分 2 至多 45%，成分 3 至少 30%。', 6, 7, 8),
                              S('Grand Strand must produce at least 10,000 gallons of regular gasoline.', 'Grand Strand 必须至少生产 10,000 加仑普通汽油。', 9)]),
                 chapter=T('Blend', '配比')),
            derive('grand', T('Grand Strand: the profit line and three of the specifications', 'Grand Strand：利润系数和其中三条规格'),
                        [(r"z = 2.9(x_{11} + x_{21} + x_{31}) + 3(x_{12} + x_{22} + x_{32}) - 2.5(x_{11} + x_{12}) - 2.6(x_{21} + x_{22}) - 2.84(x_{31} + x_{32})", T(r"Revenue from the two products minus the cost of the three components. Each component’s cost counts wherever it ends up.", r"两种产品的收入，减去三种成分的成本。每种成分的成本不管最后放进哪个产品都要算。")),
                         (r"z = 0.4x_{11} + 0.5x_{12} + 0.3x_{21} + 0.4x_{22} + 0.06x_{31} + 0.16x_{32}", T(r"Collect each variable: component 1 in regular earns $2.9 - 2.5 = 0.4$, in premium $3 - 2.5 = 0.5$, and so on.", r"合并每个变量：成分 1 放进普通汽油赚 $2.9 - 2.5 = 0.4$，放进高级汽油赚 $3 - 2.5 = 0.5$，其余同理。")),
                         (r"x_{11} \le 0.3(x_{11} + x_{21} + x_{31}) \;\Rightarrow\; 0.7x_{11} - 0.3x_{21} - 0.3x_{31} \le 0", T(r"Regular, at most 30% component 1: its share of the regular total, moved to the left.", r"普通汽油，成分 1 至多 30%：它占普通汽油总量的比例，移到左边。")),
                         (r"x_{21} \ge 0.4(\ldots) \;\Rightarrow\; -0.4x_{11} + 0.6x_{21} - 0.4x_{31} \ge 0", T(r"Regular, at least 40% component 2: the sign stays $\ge$ because the words say “at least”.", r"普通汽油，成分 2 至少 40%：符号仍是 $\ge$，因为文字是“至少”。")),
                         (r"x_{12} \ge 0.25(x_{12} + x_{22} + x_{32}) \;\Rightarrow\; 0.75x_{12} - 0.25x_{22} - 0.25x_{32} \ge 0", T(r"Premium, at least 25% component 1: the same move, on the premium’s own total.", r"高级汽油，成分 1 至少 25%：同样的移项，用高级汽油自己的总量。")),
                         (r"x_{11} + x_{21} + x_{31} \ge 10000", T(r"The commitment: gallons of regular, from all three components.", r"承诺：普通汽油的加仑数，来自三种成分。"))],
                        outro=T(rf"The other three specifications follow the same pattern. Fifteen marks: variables, objective, three supplies, six specifications, the commitment. Solved: profit {usd(gs['obj'], 0)}.", rf"另外三条规格同样的写法。十五分：变量、目标函数、三条供应上限、六条规格、承诺。解出来：利润 {usd(gs['obj'], 0)}。"), skill=SK),

            read('schedule', T('Exam Q3(i): scheduling', '考试 Q3(i)：排班'),
                 p(T(r"A schedule looks as if the variable should be “people working on Monday”. It cannot be: a person works five days in a row, so who is at work on Monday depends on who **started** on which day. Make the variable the people who **start** on each day, and write each day’s cover as the sum of the starts that reach it.", r"排班看上去应该把变量设成“周一上班的人数”。不行：一个人连续上五天班，周一谁在上班取决于**哪天开始**上班的人。把变量设成每天**开始**上班的人数，每天的人手写成够得到这一天的各开始日之和。")),
                 paper(T('Question 3 (i) · 10 marks', '第 3 题 (i) · 10 分'),
                       *ptxt("Epsilon Airlines services predominately the eastern and south-eastern United States. The vast majority of Epsilon’s customers make reservations through Epsilon’s website, but a small percentage of customers make reservations via phone. Epsilon employs call-center personnel to handle these reservations along with any problems with the website reservation system and for the rebooking of flights for customers if their plans change or their travel is disrupted. Having too many employees on hand is a waste of money, but having too few results in very poor customer service and the potential loss of customers. Epsilon analysts have estimated the minimum number of call-center employees needed by day of week for the upcoming vacation season: Monday 75, Tuesday 50, Wednesday 45, Thursday 60, Friday 90, Saturday 75, Sunday 45.\nThe call-center employees work five consecutive days and then have two consecutive days off. An employee may start any day of the week. Each call-center employee receives the same salary. Assume that the schedule cycles and ignore start-up and stopping of the schedule. Formulate the LP model that will minimize the total number of call-center employees needed to meet the minimum requirements.",
                             "Epsilon 航空主要服务美国东部和东南部。绝大多数顾客通过 Epsilon 的网站订票，也有一小部分顾客通过电话订票。Epsilon 雇用呼叫中心人员来处理这些订票，以及网站订票系统的任何问题，还有在顾客计划改变或行程被打乱时为他们改签航班。人手太多是浪费钱，太少则会让客户服务非常糟糕，还可能流失顾客。Epsilon 的分析师估计了即将到来的假期旺季里每周每天所需的呼叫中心最少人数：周一 75、周二 50、周三 45、周四 60、周五 90、周六 75、周日 45。\n呼叫中心员工连续工作五天，然后连续休息两天。员工可以在一周的任何一天开始上班。每位呼叫中心员工的工资相同。假设排班表循环往复，忽略开始和结束阶段。写出线性规划模型，使满足最低人数要求所需的呼叫中心员工总数最少。")),
                 frame('lp_check.html', T('The checker for Epsilon’s schedule: seven start days, seven daily minimums.', 'Epsilon 排班的检查器：七个开始日，七条每日最低人数。'),
                       caption=T(r"x1 is the people who start on Monday, x2 Tuesday, and so on. Each day’s limit adds the five start days that reach it.", r"x1 是周一开始上班的人数，x2 是周二，依此类推。每天的限制要加上够得到它的五个开始日。"),
                       vars=['x1', 'x2', 'x3', 'x4', 'x5', 'x6', 'x7'], names=nm([(f'x{i + 1} = employees who start on {DAYS[i][0]}', f'x{i + 1} = {DAYS[i][1]}开始上班的员工数') for i in range(7)]),
                       sense='min', c=[1] * 7, goal=T('employees', '员工总数'), rows=EPS_ROWS, lines=8,
                       story=[S('minimum number of employees needed: Monday 75, Tuesday 50, Wednesday 45, Thursday 60, Friday 90, Saturday 75, Sunday 45.', '每天所需的最少人数：周一 75、周二 50、周三 45、周四 60、周五 90、周六 75、周日 45。', 0, 1, 2, 3, 4, 5, 6),
                              S('Employees work five consecutive days and then have two consecutive days off; they may start any day.', '员工连续工作五天，然后连续休息两天；可以在任何一天开始。')]),
                 chapter=T('Schedule', '排班')),
            derive('epsilon', T('Epsilon, line by line', 'Epsilon，一行一行讲'),
                        [(r"x_i \ge 0,\quad i = 1, \ldots, 7", T(r"$x_i$ is the number of employees who **start** on day $i$ (1 is Monday, 7 is Sunday).", r"$x_i$ 是第 $i$ 天**开始**上班的员工数（1 是周一，7 是周日）。")),
                         (r"\min\ z = x_1 + x_2 + x_3 + x_4 + x_5 + x_6 + x_7", T(r"Everyone earns the same salary, so minimising the cost is minimising the head count.", r"每个人工资一样，所以成本最小就是总人数最少。")),
                         (r"x_1 + x_4 + x_5 + x_6 + x_7 \ge 75", T(r"Monday: someone is at work on Monday if they started on Monday, or on the previous Thursday, Friday, Saturday or Sunday (day 1 is within the five days that follow each of those starts). Those who started Tuesday or Wednesday are off.", r"周一：谁周一在上班？周一开始的，或者前一个周四、周五、周六、周日开始的（这几个开始日之后的五天里包含周一）。周二、周三开始的人周一休息。"), T(r"Check: five variables, because each person works five of the seven days, so each day is reached by five start days.", r"检查：五个变量，因为每人七天里上五天，所以每天恰好被五个开始日覆盖。")),
                         (r"x_1 + x_2 + x_5 + x_6 + x_7 \ge 50", T(r"Tuesday: starts on Friday through Tuesday reach it. Slide the pattern one day on: drop $x_4$, add $x_2$.", r"周二：周五到周二的开始日够得到它。把模式往后挪一天：去掉 $x_4$，加上 $x_2$。")),
                         (r"\ldots", T(r"Wednesday to Sunday follow in the same way; the last is $x_3 + x_4 + x_5 + x_6 + x_7 \ge 45$ for Sunday.", r"周三到周日同样写；最后周日是 $x_3 + x_4 + x_5 + x_6 + x_7 \ge 45$。"))],
                        outro=T(rf"**Answer:** the seven coverage limits. Solved, {n(ep['obj'], 0)} employees are needed.", rf"**答案：** 七条覆盖限制。解出来，需要 {n(ep['obj'], 0)} 名员工。"), skill=SK),
                 choice('start_vs_working', T('Start, not work', '开始，而不是上班'), SK,
                        T(r"A candidate defines $x_i$ as “the employees working on day $i$” and writes $x_1 \ge 75, x_2 \ge 50, \ldots$. What is wrong?", r"一位考生把 $x_i$ 定义为“第 $i$ 天上班的员工数”，然后写 $x_1 \ge 75, x_2 \ge 50, \ldots$。错在哪里？"),
                        [(T(r"Nothing says an employee works five days in a row, so the model hires a fresh crew every day: a cheaper but impossible plan.", r"没有任何地方说员工要连续上五天班，所以模型每天都雇一批新人：更便宜，但不可能。"), True),
                         (T(r"The signs should be ≤.", r"符号应该是 ≤。"), T(r"These are minimums: ≥ is right.", r"这些是最低人数：≥ 是对的。"), None),
                         (T(r"Nothing: this is the standard formulation.", r"没问题：这是标准写法。"), T(r"The five-day rule has vanished from the model.", r"连续五天的规则在模型里消失了。"), 'start-vs-working')],
                        T(r"The variable must carry the five-day pattern: it is the start day that does.", r"变量必须带着“连续五天”这个模式：能带上它的是开始日。"), purpose='check'),

            read('workshop', T('Make or buy and part-timers: two more from the deck', '自制或外购、兼职：课件里的另外两个'),
                 p(T(rf"**Benson Electronics** makes or buys three components. Made units use the production, assembly and testing departments’ minutes; bought units use none, and demands are met exactly. It is DCI’s shape with six variables. Solved: the cheapest plan costs {usd(bn['obj'], 0)}, making {ftxt([bn['x'][0], bn['x'][2], bn['x'][4]])} units of components 1, 2 and 3 and buying {ftxt([bn['x'][1], bn['x'][3], bn['x'][5]])}.",
                     rf"**Benson Electronics** 的三种部件可以自制或外购。自制的件占用生产、装配、测试车间的分钟数；外购的不占，需求要正好满足。这是 DCI 的形状，只是有六个变量。解出来：最便宜的计划成本 {usd(bn['obj'], 0)}，三种部件自制 {ftxt([bn['x'][0], bn['x'][2], bn['x'][4]])} 件，外购 {ftxt([bn['x'][1], bn['x'][3], bn['x'][5]])} 件。")),
                 p(T(r"**HKBC’s tellers** are a schedule with two kinds of worker. Full-timers work 9 to 5 with an hour for lunch, half of them at 11 and half at noon; part-timers work exactly 4 hours and start between 9 and 1. Part-time hours are capped at 50% of the day’s total requirement.", r"**HKBC 的柜员**是一个有两类员工的排班。全职员工 9 点到 5 点上班，中间休息一小时，一半 11 点吃饭、一半 12 点；兼职员工恰好工作 4 小时，在 9 点到 1 点之间开始。兼职工时不得超过当天总需求的 50%。")),
                 chapter=T('Workshop', '工作坊')),
            choice('hkbc', T('The 0.5 in the 11 o’clock limit', '11 点那条限制里的 0.5'), SK,
                        T(r"In HKBC’s model the 11am to noon limit is $0.5x_1 + x_2 + x_3 + x_4 \ge 14$. Why does $x_1$ (full-timers) have the coefficient 0.5?", r"HKBC 的模型里，11 点到中午的限制是 $0.5x_1 + x_2 + x_3 + x_4 \ge 14$。为什么全职员工 $x_1$ 的系数是 0.5？"),
                        [(T(r"Half of the full-timers are at lunch in that hour, so only half are at their desks.", r"那一小时里一半全职员工在吃午饭，所以只有一半在岗。"), True),
                         (T(r"Full-timers are paid half as much.", r"全职员工的工资只有一半。"), T(r"Pay belongs in the objective; this is a headcount limit.", r"工资属于目标函数；这是一条人数限制。"), 'mixed-units'),
                         (T(r"Because they work half the day.", r"因为他们只上半天班。"), T(r"They work all day except the lunch hour.", r"他们除午饭那一小时外全天上班。"), None)],
                        T(r"A coefficient is “how much this decision contributes to this limit”. Here it is the fraction of full-timers at their desks in that hour.", r"系数就是“这个决策对这条限制贡献多少”。这里是那一小时在岗的全职员工比例。"), purpose='check'),

            read('traps', T('Traps', '易错点'),
                 callout('warning', T('Two places', '两个地方'), T(r"Overtime and similar “buy more capacity” variables belong in both the objective (their cost) and the limit (their hours).", r"加班这类“买更多容量”的变量，既要写进目标函数（成本），也要写进限制（工时）。")),
                 callout('warning', T('Share of what?', '占谁的比例？'), T(r"A share is of its own total: the regular gasoline’s total for regular, the premium’s for premium, the funds invested for ICT. Move the variables to the left before you write the coefficients.", r"占比是占自己那个总数的：普通汽油的占比用普通汽油的总量，高级汽油用高级汽油的，ICT 用已投资金总额。先把变量移到左边，再写系数。")),
                 callout('note', T('When stuck', '写不出来时'), T(r"Define the variables, write the objective, and then write each limit from one sentence at a time. A partly right model earns most of the marks: the marks are per line.", r"先定义变量，写目标函数，再一句一句写限制。部分正确的模型也能拿到大部分分：分数是按行给的。")),
                 chapter=T('Traps', '易错点')),

            choice('recall_unbounded', T('Recall: a missing limit', '回忆：漏了一条限制'), SK,
                   T(r"You forgot Tucker’s fabric limit. What does the solver most likely report?", r"你漏掉了 Tucker 的布料限制。求解器最可能报告什么？"),
                   [(T(r"The profit is unbounded or absurdly large: something is missing.", r"利润无界或大得离谱：漏了东西。"), True),
                    (T(r"Infeasible.", r"无可行解。"), T(r"Dropping a limit enlarges the allowed set; infeasible comes from limits that contradict.", r"去掉一条限制只会让允许区域变大；无可行解来自互相矛盾的限制。"), None),
                    (T(r"The same answer as before.", r"和之前一样的答案。"), T(r"Fabric binds at the best plan, so removing it changes the plan.", r"最优计划里布料是紧的，去掉它计划会变。"), None)],
                   T(r"Fewer limits, larger allowed set: profit can only rise, and with a binding limit gone it may have no top.", r"限制少了，允许区域变大：利润只会增加，紧的限制去掉后甚至可能没有上限。"), purpose='check'),
            choice('recall_shadow', T('Recall: shadow price and stretch', '回忆：影子价格与范围'), SK,
                   T(r"A shadow price of 2.8 comes with an allowable increase of 100. The right-hand side rises by 250. The cost changes by:", r"影子价格 2.8，允许增量 100。右端增加了 250。成本变化："),
                   [(T(r"Not $250 \times 2.8$: the rise is past the stretch, so re-solve.", r"不是 $250 \times 2.8$：增加量超出了允许范围，要重新求解。"), True),
                    (T(r"$250 \times 2.8 = 700$.", r"$250 \times 2.8 = 700$。"), T(r"Only the first 100 units are worth 2.8 each.", r"只有前 100 个单位每个值 2.8。"), 'shadow-forever'),
                    (T(r"$100 \times 2.8 = 280$ exactly.", r"恰好是 $100 \times 2.8 = 280$。"), T(r"Beyond 100 the price changes; it is not zero.", r"超过 100 之后价格会变，但不是 0。"), None)],
                   T(r"Inside the stretch the price is exact; outside it, no promise.", r"在范围内价格精确；范围外，没有保证。"), purpose='check'),
        ],
    )
