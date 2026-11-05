# Lesson 10 (expected-value): what information is worth. Decks: W5 (probabilities, expected value, EVwPI, EVwoPI, EVPI; PDC, Hudson).
# Exam: 2025 Q4(i)-(ii). Instrument: evpi_lines. Numbers are computed below, never typed.
from common import *

SK = 'mg.expected-value'


def ev(V, p, i): return sum(pj * v for pj, v in zip(p, V[i]))


def evpi(V, p, sense):
    pick = max if sense == 'max' else min
    evs = [ev(V, p, i) for i in range(len(V))]
    wopi = pick(evs)
    wpi = sum(pj * pick(col) for pj, col in zip(p, zip(*V)))
    return evs, wopi, wpi, abs(wpi - wopi)


def L_expected():
    pdc_V, pdc_p = [[8, 7], [14, 5], [20, -9]], [.8, .2]
    e, wo, wp, vp = evpi(pdc_V, pdc_p, 'max')
    assert [round(x, 6) for x in e] == [7.8, 12.2, 14.2] and round(wp, 6) == 17.4 and round(vp, 6) == 3.2
    rj_V, rj_p = [[30, 30], [25, 45]], [.85, .15]
    re_, rwo, rwp, rvp = evpi(rj_V, rj_p, 'min')
    assert [round(x, 6) for x in re_] == [30, 28] and round(rwp, 6) == 25.75 and round(rwo, 6) == 28 and round(rvp, 6) == 2.25
    hud_V, hud_p = [[650, 650, 600], [900, 600, 300], [800, 650, 500]], [.2, .5, .3]
    he, hwo, hwp, hvp = evpi(hud_V, hud_p, 'min')
    assert [round(x, 6) for x in he] == [635, 570, 635] and round(hwp, 6) == 520 and round(hvp, 6) == 50
    return dict(
        id=f'{CID}-expected-value',
        title=T('What information is worth', '信息值多少钱'),
        description=T('With probabilities, a payoff table gives an expected value per choice. Then ask the best question in decision analysis: what would a perfectly reliable crystal ball be worth? Move the probability and see it as a gap between two lines, then do the exam’s carpool question.',
                      '有了概率，收益表就给出每个选择的期望值。然后问决策分析里最好的问题：一个绝对可靠的水晶球值多少钱？移动概率，把它看成两条线之间的缝隙，再做考试里的拼车题。'),
        minutes=45,
        skills=[{'id': SK, 'name': T('Expected value and the value of perfect information', '期望值与完全信息的价值')}],
        misconceptions=[{'id': 'evpi-vs-ev', 'description': T('Confusing the expected value of the best choice with the expected value with perfect information', '把最优选择的期望值和有完全信息时的期望值搞混')},
                        {'id': 'max-in-min', 'description': T('Using max in the EVPI formulas for a cost or time problem', '在成本或时间问题里，EVPI 的公式还用 max')}],
        steps=[
            read('ball', T('A crystal ball', '一个水晶球'),
                 p(T(r"PDC thinks demand is strong with probability 0.8 and weak with probability 0.2. Each building size is now a gamble with an **expected value** (EV): the payoffs weighted by how likely they are. The medium complex: $0.8 \times 14 + 0.2 \times 5 = 12.2$. Each line in the picture is one building size’s EV as the probability of strong demand moves from 0 to 1.", r"PDC 认为需求强的概率是 0.8，弱的概率是 0.2。每种楼盘规模现在是一场赌局，有一个**期望值**（EV）：收益按各自发生的可能性加权。中型楼盘：$0.8 \times 14 + 0.2 \times 5 = 12.2$。图里的每条线是一种楼盘规模的 EV，横轴是需求强的概率从 0 到 1。")),
                 frame('evpi_lines.html', T('Expected value of each choice against the probability of strong demand. The thick black line is the best EV you can get by choosing before you know; the dashed line is what a crystal ball is worth.', '每个选择的期望值随需求强的概率的变化。黑色粗线是你在知道之前选能得到的最好期望值；虚线是有水晶球时的期望值。'),
                       caption=T(r"Slide the probability. The green bar is the gap between the dashed line and the thick line: the most a perfect forecast could add.", r"移动概率。绿色的条是虚线和粗线之间的缝隙：一个完美预测最多能增加多少。"),
                       alts=[T('Small', '小型'), T('Medium', '中型'), T('Large', '大型')], states=[T('strong demand', '需求强'), T('weak demand', '需求弱')], V=pdc_V, unit='$', sense='max', p=0.8),
                 chapter=T('Touch', '动手')),
            choice('where_gap', T('Where is the crystal ball worth most?', '水晶球在哪里最值钱？'), SK,
                   T(r"Moving the probability of strong demand from 0 to 1: where is the crystal ball worth the **most**?", r"把需求强的概率从 0 移到 1：水晶球在哪里最值钱？"),
                   [(T(r"Where you are least sure which choice is best: the middle, where two lines cross.", r"在你最拿不准哪个选择最好的地方：中间，两条线交叉的地方。"), True),
                    (T(r"Where demand is certain: knowing for sure is most valuable there.", r"需求确定的地方：那里确切知道最有价值。"), T(r"If demand is certain, you already know it: the gap is 0 at both ends.", r"需求确定时你本来就知道了：两端的缝隙都是 0。"), 'evpi-vs-ev'),
                    (T(r"Nowhere: the gap is the same everywhere.", r"哪里都一样：缝隙处处相同。"), T(r"Drag the slider: it widens and narrows.", r"拖一下滑块：它会变宽变窄。"), None)],
                   T(r"A forecast is worth something only when it can change your mind. Where one choice is clearly best, it cannot.", r"预测只有在能让你改主意时才有价值。某个选择明显最好的地方，它改不了你的主意。")),
            read('name', T('The four numbers and what each one says', '四个数，各自说什么'),
                 table([T('Name', '名字'), T('In words', '用话说'), T('PDC (probability of strong 0.8)', 'PDC（需求强的概率 0.8）')],
                       [T('**EV** of a choice', '一个选择的 **EV**'), T('its payoffs, each times its probability, added up', '它的各个收益，各乘以概率，再加起来'), '$12.2$ (medium)'],
                       [T('**EVwoPI**', '**EVwoPI**'), T('EV *without* perfect information: the best of the choices’ EVs (choose before you know)', '*没有*完全信息时的 EV：各选择 EV 里最好的（先选后知道）'), '$14.2$ (large)'],
                       [T('**EVwPI**', '**EVwPI**'), T('EV *with* perfect information: in each state take the best payoff, then weight by the probability of the state', '*有*完全信息时的 EV：每个状态取最好的收益，再按状态的概率加权'), '$0.8 \\times 20 + 0.2 \\times 7 = 17.4$'],
                       [T('**EVPI**', '**EVPI**'), T('the value of perfect information: $|\\text{EVwPI} - \\text{EVwoPI}|$ (the most you should pay for any forecast)', '完全信息的价值：$|\\text{EVwPI} - \\text{EVwoPI}|$（任何预测你最多该付的钱）'), '$17.4 - 14.2 = 3.2$ ' + '(\\$ millions)']),
                 math_(r"EV(d_i) = \sum_j P(s_j)\,V_{ij}\qquad EVwPI = \sum_j P(s_j)\,\max_i V_{ij}\qquad EVPI = |EVwPI - EVwoPI|"),
                 callout('warning', T('Cost problems: max becomes min', '成本问题：max 变成 min'), T(r"The formula sheet is written for maximisation (profit). For a cost or travel-time problem “best” means smallest: use $\min$ in EVwoPI and in EVwPI. The absolute value in EVPI takes care of the sign.", r"公式表是按最大化（利润）写的。成本或行程时间问题里“最好”是最小：EVwoPI 和 EVwPI 里都用 $\min$。EVPI 里的绝对值负责处理符号。")),
                 chapter=T('Names', '命名')),
            number('evpi_pdc', T('PDC’s EVPI', 'PDC 的 EVPI'), SK,
                   T(r"With the probabilities 0.8 and 0.2, the best EV is 14.2. The best payoff is 20 in strong demand and 7 in weak demand. What is EVPI, in \$ millions?", r"概率是 0.8 和 0.2，最好的 EV 是 14.2。强需求下最好的收益是 20，弱需求下是 7。EVPI 是多少百万美元？"),
                   round(vp, 6), T(r"EVwPI $= 0.8(20) + 0.2(7) = 17.4$; EVPI $= 17.4 - 14.2 = 3.2$ million: PDC should pay at most \$3.2 million for a perfect forecast.", r"EVwPI $= 0.8(20) + 0.2(7) = 17.4$；EVPI $= 17.4 - 14.2 = 3.2$ 百万：PDC 为一个完美预测最多该付 \$320 万。"), tolerance=0.005, purpose='practice'),

            read('exam', T('The exam’s version: the carpool', '考试里的版本：拼车'),
                 p(T(r"Rona and Jerry choose a route. The numbers are minutes, so this is a *minimisation*: every “best” is the smallest. Part (i) takes the EVs and chooses; part (ii) is the crystal ball.", r"Rona 和 Jerry 选路线。数字是分钟，所以是*最小化*：每个“最好”都是最小的。第 (i) 问算 EV 并选择；第 (ii) 问是水晶球。")),
                 paper(T('Question 4 (i) and (ii) · 4 marks', '第 4 题 (i)(ii) · 4 分'),
                       *ptxt("To save on expenses, Rona and Jerry agreed to form a carpool for traveling to and from work. Rona preferred to use the somewhat longer but more consistent Queen City Avenue. Although Jerry preferred the quicker expressway, he agreed with Rona that they should take Queen City Avenue if the expressway had a traffic jam. The following payoff table provides the one-way time estimate in minutes for traveling to or from work. Based on their experience with traffic problems, Rona and Jerry agreed on a 0.15 probability that the expressway would be jammed.\nDecision alternative, state of nature: Queen City Avenue: expressway open 30, expressway jammed 30. Expressway: open 25, jammed 45.\n(i) Determine the optimal decision for Rona and Jerry if they wish to minimize the travel time. (2 marks)\n(ii) What is the expected value of perfect information? (2 marks)",
                             "为了省钱，Rona 和 Jerry 约好拼车上下班。Rona 更喜欢走稍远但更稳定的 Queen City 大道。Jerry 虽然更喜欢更快的高速公路，但同意如果高速公路堵车就走 Queen City 大道。下面的收益表给出了上班或下班单程所需的时间估计（分钟）。根据他们遇到交通问题的经验，Rona 和 Jerry 认为高速公路堵车的概率是 0.15。\n决策方案，自然状态：Queen City 大道：高速公路畅通 30，堵车 30。高速公路：畅通 25，堵车 45。\n(i) 如果他们想让行程时间最短，确定 Rona 和 Jerry 的最优决策。（2 分）\n(ii) 完全信息的期望值是多少？（2 分）")),
                 frame('evpi_lines.html', T('The carpool problem as lines: expected minutes of each route against the probability that the expressway is open.', '拼车问题画成线：每条路线的期望分钟数随高速畅通概率的变化。'),
                       caption=T(r"Probability the expressway is open: 0.85. The gap is what knowing the traffic in advance would save.", r"高速畅通的概率：0.85。缝隙是提前知道路况能省的时间。"),
                       alts=[T('Queen City Avenue', 'Queen City 大道'), T('Expressway', '高速公路')], states=[T('expressway open', '高速畅通'), T('expressway jammed', '高速堵车')], V=rj_V, unit='', sense='min', p=0.85),
                 chapter=T('On the paper', '考卷上')),
            derive('q4i', T('(i): the best route', '(i)：最好的路线'),
                   [(r"EV(\text{QC}) = 0.85(30) + 0.15(30)", T(r"Queen City Avenue takes 30 minutes whether the expressway is open or jammed.", r"不论高速畅通还是堵车，走 Queen City 大道都是 30 分钟。")),
                    (r"= 30", T(r"Expected travel time on Queen City Avenue.", r"走 Queen City 大道的期望时间。")),
                    (r"EV(\text{EW}) = 0.85(25) + 0.15(45) = 28", T(r"The expressway: 25 minutes when open (probability 0.85) and 45 when jammed (0.15).", r"高速公路：畅通（概率 0.85）时 25 分钟，堵车（0.15）时 45 分钟。")),
                    (r"\min(30, 28) = 28 \Rightarrow \text{EW}", T(r"They want the least time, so choose the smaller expected time: the expressway.", r"他们要时间最短，所以选期望时间较小的：高速公路。"))],
                   outro=T(r"**Answer:** take the expressway; the expected time is 28 minutes (against 30 by Queen City Avenue).", r"**答案：** 走高速公路；期望时间 28 分钟（走 Queen City 大道是 30 分钟）。"),
                   blank=(2, '28', T(r"$0.85(25) + 0.15(45)$.", r"$0.85(25) + 0.15(45)$。")), skill=SK),
            derive('q4ii', T('(ii): the crystal ball', '(ii)：水晶球'),
                   [(r"EVwPI = 0.85(25) + 0.15(30)", T(r"With a perfect forecast they take the faster route in each state: 25 minutes if the expressway will be open, 30 (Queen City Avenue) if jammed. Weight by the probabilities of the states.", r"有完美预测时，每种状态下他们都走更快的路线：高速公路畅通就是 25 分钟，堵车就走 Queen City 大道 30 分钟。再按状态的概率加权。")),
                    (r"= 25.75", T(r"The expected time with perfect information.", r"有完全信息时的期望时间。")),
                    (r"EVwoPI = \min(30, 28) = 28", T(r"Without it, the best they can do is the expressway’s 28.", r"没有它，他们最好也就是高速公路的 28。")),
                    (r"EVPI = |25.75 - 28| = 2.25", T(r"The absolute value, so the sign does not matter: 2.25 minutes saved per trip on average.", r"取绝对值，所以符号不重要：平均每趟省 2.25 分钟。"))],
                   outro=T(r"**Answer:** EVPI is 2.25 minutes.", r"**答案：** EVPI 是 2.25 分钟。"),
                   blank=(1, '25.75', T(r"$0.85(25) + 0.15(30)$.", r"$0.85(25) + 0.15(30)$。")), skill=SK),
            read('answer', T('The full-mark answer, as it is written', '满分答案，写在卷子上是这样'),
                 paper(T('Question 4 (i) and (ii), full marks', '第 4 题 (i)(ii)，满分写法'),
                       *ptxt("(i) Let QC = Queen City Avenue; EW = Expressway.\nEV(QC) = 0.85(30) + 0.15(30) = 30 minutes\nEV(EW) = 0.85(25) + 0.15(45) = 28 minutes\nDecision = Expressway (the smaller expected time).\n(ii) EVwPI = 0.85(25) + 0.15(30) = 25.75 minutes\nEVwoPI = min(30, 28) = 28 minutes\nEVPI = |25.75 − 28| = 2.25 minutes",
                             "(i) 设 QC = Queen City 大道；EW = 高速公路。\nEV(QC) = 0.85(30) + 0.15(30) = 30 分钟\nEV(EW) = 0.85(25) + 0.15(45) = 28 分钟\n决策 = 高速公路（期望时间较小）。\n(ii) EVwPI = 0.85(25) + 0.15(30) = 25.75 分钟\nEVwoPI = min(30, 28) = 28 分钟\nEVPI = |25.75 − 28| = 2.25 分钟"), answer=True),
                 callout('note', T('What earns the marks', '得分点'), T(r"Four marks, four short lines. Write each EV with the probabilities and payoffs visible (so a slip in the arithmetic loses one mark, not four), name the decision, and write the units: minutes.", r"四分，四行。每个 EV 都把概率和收益写出来（这样算错一步只丢一分，不丢四分），写出决策，并写上单位：分钟。")),
                 chapter=T('The answer', '答案')),
            number('hudson_evpi', T('Three states: Hudson’s EVPI', '三个状态：Hudson 的 EVPI'), SK,
                   T(r"Hudson’s annual costs (\$ thousands) under high, medium, low demand (probabilities 0.2, 0.5, 0.3): own staff 650, 650, 600; outsourcing 900, 600, 300; combination 800, 650, 500. What is EVPI?", r"Hudson 在高、中、低需求（概率 0.2、0.5、0.3）下的年成本（千美元）：自己的员工 650、650、600；外包 900、600、300；混合 800、650、500。EVPI 是多少？"),
                   round(hvp, 6), T(rf"EVs: 635, 570, 635, so the best is outsourcing at 570 (minimum). Perfect information takes the cheapest cost in each state: $0.2(650) + 0.5(600) + 0.3(300) = 520$. EVPI $= |520 - 570| = 50$ thousand dollars.", rf"各 EV：635、570、635，所以最好的是外包，570（取最小）。完全信息下每个状态取最便宜的成本：$0.2(650) + 0.5(600) + 0.3(300) = 520$。EVPI $= |520 - 570| = 50$ 千美元。"), tolerance=0.005, purpose='practice'),
            choice('evpi_bound', T('How much would you pay?', '你愿意付多少？'), SK,
                   T(r"A consultant offers a forecast of PDC’s demand for \$4 million. EVPI is \$3.2 million. Should PDC buy it?", r"一位顾问以 \$400 万的价格出售 PDC 需求的预测。EVPI 是 \$320 万。PDC 该买吗？"),
                   [(T(r"No: even a perfect forecast adds only 3.2 million, and a real forecast is not perfect.", r"不该：哪怕是完美预测也只增加 320 万，而真实的预测并不完美。"), True),
                    (T(r"Yes: 3.2 million is a big gain, and the forecast is probably good.", r"该：320 万的收益很大，预测大概也不错。"), T(r"The price is more than the most it could ever add.", r"价格高于它可能带来的最大增加值。"), 'evpi-vs-ev'),
                    (T(r"It depends on the payoffs only, not on EVPI.", r"只看收益，和 EVPI 无关。"), T(r"EVPI is exactly the upper limit on what information is worth.", r"EVPI 恰好就是信息价值的上限。"), None)],
                   T(r"EVPI is a ceiling: any real forecast is worth less than it.", r"EVPI 是个天花板：任何真实的预测都不值那么多。"), purpose='check'),
            read('traps', T('Traps', '易错点'),
                 callout('warning', T('EVwPI is not the best EV', 'EVwPI 不是最好的 EV'), T(r"EVwoPI is the best of the choices’ EVs (one choice for all states). EVwPI takes the best payoff in **each state** separately. EVwPI is always at least as good as EVwoPI, so EVPI is never negative.", r"EVwoPI 是各选择 EV 里最好的（所有状态都用同一个选择）。EVwPI 是**每个状态**分别取最好的收益。EVwPI 总不比 EVwoPI 差，所以 EVPI 永远不是负的。")),
                 callout('warning', T('Use the probabilities of the states', '用状态的概率'), T(r"In EVwPI the weights are the probabilities of the *states* (the traffic being open or jammed), not of the choices.", r"EVwPI 里的权重是*状态*（路况畅通或堵车）的概率，不是选择的概率。")),
                 chapter=T('Traps', '易错点')),
            choice('recall_regret', T('Recall: regret', '回忆：后悔'), SK,
                   T(r"For a cost table, the regret of a cell is:", r"成本表里，一个格子的后悔值是："),
                   [(T(r"the cell’s cost minus the smallest cost in its column.", r"这个格子的成本减去它所在列最小的成本。"), True),
                    (T(r"the largest cost in its column minus the cell’s cost.", r"它所在列最大的成本减去这个格子的成本。"), T(r"With costs the best is the smallest, so regret is measured from the smallest.", r"成本里最好的是最小的，所以后悔值从最小的算起。"), 'max-in-min'),
                    (T(r"the cell’s cost minus zero.", r"这个格子的成本减 0。"), T(r"Regret is never measured against zero.", r"后悔值从来不是和 0 比。"), 'regret-is-loss')],
                   T(r"Regret is the gap to the best choice in the same state.", r"后悔值是同一状态下和最好选择的差距。"), purpose='check'),
            choice('recall_dummy2', T('Recall: shadow price', '回忆：影子价格'), SK,
                   T(r"A report says an assembly limit’s shadow price is −0.375 in a cost-minimising model. One more minute of assembly time:", r"报告说，在成本最小化模型里，装配限制的影子价格是 −0.375。多一分钟装配时间："),
                   [(T(r"lowers the cost by 0.375 (inside the allowable stretch).", r"让成本降低 0.375（在允许范围内）。"), True),
                    (T(r"raises the cost by 0.375.", r"让成本升高 0.375。"), T(r"The sign is the change of the objective: negative means cost falls.", r"符号就是目标值的变化：负就是成本下降。"), 'shadow-forever'),
                    (T(r"changes nothing: the number is negative.", r"没有变化：这个数是负的。"), T(r"A shadow price of 0 would mean no change; the sign says the direction.", r"影子价格为 0 才是没有变化；符号说的是方向。"), None)],
                   T(r"The sign gives the direction of the objective’s change.", r"符号给出目标值变化的方向。"), purpose='check'),
        ],
    )
