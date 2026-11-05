# Lesson 9 (payoff): what to do when you cannot say how likely each future is. Decks: W5 (alternatives, states, consequences, payoff tables,
# optimistic, conservative and minimax-regret criteria; PDC, Southland, Hudson). Instrument: payoff_dial. No 2025 question lives only here
# (Q4 gives probabilities), but Q4(i) starts from the same table. Numbers are computed below.
from common import *

SK = 'mg.payoff'
PDC = dict(alts=[T('Small complex', '小型楼盘'), T('Medium complex', '中型楼盘'), T('Large complex', '大型楼盘')], states=[T('Strong demand', '需求强'), T('Weak demand', '需求弱')], V=[[8, 7], [14, 5], [20, -9]])
SOUTH = dict(alts=[T('Small plant', '小工厂'), T('Large plant', '大工厂')], states=[T('Low', '低需求'), T('Medium', '中需求'), T('High', '高需求')], V=[[150, 200, 200], [50, 200, 500]])
HUDSON = dict(alts=[T('Own staff', '自己的员工'), T('Outsourcing', '外包'), T('Combination', '混合')], states=[T('High', '高需求'), T('Medium', '中需求'), T('Low', '低需求')], V=[[650, 650, 600], [900, 600, 300], [800, 650, 500]])


def criteria(V, sense):
    better = max if sense == 'max' else min
    worse = min if sense == 'max' else max
    opt = [better(r) for r in V]
    con = [worse(r) for r in V]
    cols = list(zip(*V))
    regret = [[abs(better(cols[j]) - V[i][j]) for j in range(len(cols))] for i in range(len(V))]
    mr = [max(r) for r in regret]
    pick = lambda vals, how: min(range(len(vals)), key=lambda i: (-vals[i] if how == 'max' else vals[i]))
    return dict(opt=opt, con=con, regret=regret, mr=mr, w_opt=pick(opt, sense), w_con=pick(con, sense), w_reg=pick(mr, 'min'))


def L_payoff():
    c = criteria(PDC['V'], 'max')
    s = criteria(SOUTH['V'], 'max')
    h = criteria(HUDSON['V'], 'min')
    assert (c['w_opt'], c['w_con'], c['w_reg']) == (2, 0, 1) and c['mr'] == [12, 6, 16] and c['regret'] == [[12, 0], [6, 2], [0, 16]]
    assert (s['w_opt'], s['w_con'], s['w_reg']) == (1, 0, 1) and s['mr'] == [300, 100]
    assert (h['w_opt'], h['w_con']) == (1, 0)
    # the dial: where the choice flips between the medium and the large complex, and between small and medium
    def score(i, a): return a * max(PDC['V'][i]) + (1 - a) * min(PDC['V'][i])
    flips = [round(a / 1000, 3) for a in range(1, 1000) if max(range(3), key=lambda i: score(i, a / 1000)) != max(range(3), key=lambda i: score(i, (a - 1) / 1000))]
    assert len(flips) == 2
    return dict(
        id=f'{CID}-payoff',
        title=T('What to do when you cannot say how likely each future is', '说不出每种未来有多大可能时怎么办'),
        description=T('A payoff table with no probabilities has three honest answers: the optimist’s, the pessimist’s and the one that minimises regret. Slide a dial from pessimist to optimist and watch the choice change, then do the same on two more tables.',
                      '没有概率的收益表有三个老实的答案：乐观者的、悲观者的、使后悔最小的。把拨盘从悲观拨向乐观，看选择怎么变，再在另外两张表上做一遍。'),
        minutes=40,
        skills=[{'id': SK, 'name': T('Choosing without probabilities', '没有概率时的选择')}],
        misconceptions=[{'id': 'regret-is-loss', 'description': T('Reading regret as a loss in the payoff table rather than the gap to the best choice in that state', '把后悔读成收益表里的亏损，而不是“同一状态下与最好选择的差距”')},
                        {'id': 'criteria-agree', 'description': T('Expecting the three criteria to give one answer', '以为三种准则会给出同一个答案')}],
        steps=[
            read('table', T('A decision with a table', '一张表的决策'),
                 p(T(r"Pittsburgh Development Corporation owns land and must pick the size of a luxury condominium complex: **small** (30 units), **medium** (60) or **large** (90). Whether it pays depends on something it does not control: **strong** or **weak** demand. The table gives the profit, in \$ millions, for each pair. The three words to know are in bold: the *decision alternatives* are what PDC chooses, the *states of nature* are what happens to it, the *payoff* is the result of each pair.", r"Pittsburgh Development Corporation 有一块地，要选高档公寓楼盘的规模：**小**（30 套）、**中**（60 套）或**大**（90 套）。赚不赚钱取决于它控制不了的事：需求**强**还是**弱**。表里是每种组合的利润，单位百万美元。要认的三个词：*决策方案*是 PDC 自己选的，*自然状态*是发生在它身上的事，*收益*是每种组合的结果。")),
                 frame('payoff_dial.html', T('The PDC payoff table with a dial from the pessimist (worst case only) to the optimist (best case only).', 'PDC 的收益表，带一个从悲观者（只看最坏）到乐观者（只看最好）的拨盘。'),
                       caption=T(r"Slide the dial. Each bar is the alternative’s score: a mix of its best and worst payoff. The dark bar wins.", r"拖动拨盘。每根条是该方案的得分：它的最好和最坏收益的混合。深色的条胜出。"),
                       unit='$', sense='max', mode='dial', alpha=0.5, **PDC),
                 chapter=T('Touch', '动手')),
            choice('predict', T('Where does the choice change?', '选择在哪里变？'), SK,
                   T(rf"At optimism 0 (worst case only) the dial picks one complex; at optimism 1 (best case only), another. How many different complexes does it pick on the way, and at roughly which optimism does the first switch happen? (From the dial.)", rf"乐观度为 0（只看最坏）时拨盘选一种楼盘；乐观度为 1（只看最好）时选另一种。一路拨过去，它一共会选几种楼盘？第一次切换大约发生在乐观度多少？（看拨盘。）"),
                   [(T(rf"Three, switching near {flips[0]:.2f} and {flips[1]:.2f}: small, then medium, then large.", rf"三种，大约在 {flips[0]:.2f} 和 {flips[1]:.2f} 处切换：先小、再中、最后大。"), True),
                    (T(r"Two: only the extremes matter.", r"两种：只有两端有意义。"), T(r"The medium complex wins in a whole stretch of the middle.", r"中间有一整段是中型楼盘胜出。"), 'criteria-agree'),
                    (T(r"One: the large complex always wins, it has the biggest payoff.", r"一种：大型楼盘总是赢，它的收益最大。"), T(r"It also has the worst loss (−9), which counts heavily for a pessimist.", r"它也有最大的亏损（−9），悲观者会看得很重。"), None)],
                   T(rf"The score of an alternative is $\alpha \cdot \text{{best}} + (1-\alpha)\cdot \text{{worst}}$. Small: $\alpha \cdot 8 + (1-\alpha) \cdot 7$, medium: $\alpha \cdot 14 + (1-\alpha)\cdot 5$, large: $\alpha \cdot 20 - (1-\alpha) \cdot 9$. They cross at {flips[0]:.3f} and {flips[1]:.3f}.", rf"一个方案的得分是 $\alpha \cdot \text{{最好}} + (1-\alpha)\cdot \text{{最坏}}$。小：$\alpha \cdot 8 + (1-\alpha) \cdot 7$，中：$\alpha \cdot 14 + (1-\alpha)\cdot 5$，大：$\alpha \cdot 20 - (1-\alpha) \cdot 9$。它们在 {flips[0]:.3f} 和 {flips[1]:.3f} 处交叉。")),
            read('name', T('The three criteria, named', '三条准则，起名字'),
                 p(T(r"The two ends of the dial are the first two criteria. The third has no end of the dial: it asks how much you would **regret** each choice.", r"拨盘的两端就是前两条准则。第三条不在拨盘上：它问的是你会为每个选择**后悔**多少。")),
                 table([T('Criterion', '准则'), T('Rule', '规则'), T('PDC', 'PDC'), T('Who thinks so', '谁会这么想')],
                       [T('**Optimistic** (maximax)', '**乐观**（maximax）'), T('best payoff of each alternative; take the largest', '每个方案的最好收益；取最大的'), T('8, 14, 20 → large', '8、14、20 → 大型'), T('a risk-taker', '敢冒险的人')],
                       [T('**Conservative** (maximin)', '**保守**（maximin）'), T('worst payoff of each alternative; take the best of them', '每个方案的最坏收益；取其中最好的'), T('7, 5, −9 → small', '7、5、−9 → 小型'), T('someone who cannot afford a loss', '亏不起的人')],
                       [T('**Minimax regret**', '**最小最大后悔**'), T('regret of each cell; largest regret of each alternative; take the smallest', '每个格子的后悔值；每个方案的最大后悔；取最小的'), T('12, 6, 16 → medium', '12、6、16 → 中型'), T('someone who hates saying “if only”', '讨厌说“早知道”的人')]),
                 p(T(r"**Regret** (opportunity loss) of a cell is the best payoff in its column (its state of nature) minus the cell’s payoff: how much you gave up compared with what you would have chosen if you had known the state. In strong demand the best payoff is 20, so the small complex’s regret is $20 - 8 = 12$.", r"一个格子的**后悔值**（机会损失）是它所在列（也就是它的自然状态）的最好收益减去这个格子的收益：和“早知道这个状态就会选的那个”相比，你放弃了多少。需求强时最好的收益是 20，所以小型楼盘的后悔值是 $20 - 8 = 12$。")),
                 frame('payoff_dial.html', T('The regret table of PDC.', 'PDC 的后悔值表。'), caption=T(r"Press “Regret”: red cells are each alternative’s largest regret.", r"点“后悔”：红色格子是每个方案的最大后悔。"), unit='$', sense='max', mode='reg', **PDC),
                 chapter=T('Names', '命名')),
            number('regret_med', T('A regret by hand', '手算一个后悔值'), SK,
                   T(r"In weak demand, what is the regret of building the **large** complex?", r"需求弱时，建**大型**楼盘的后悔值是多少？"),
                   16, T(r"The best payoff in weak demand is 7 (small complex). The large complex gives −9, so the regret is $7 - (-9) = 16$.", r"需求弱时最好的收益是 7（小型楼盘）。大型楼盘是 −9，所以后悔值是 $7 - (-9) = 16$。"), tolerance=0.01, purpose='practice'),
            choice('criteria_answer', T('Which one is right?', '哪个对？'), SK,
                   T(r"For PDC the optimist builds large, the conservative builds small and the regret rule builds medium. Which criterion is correct?", r"对 PDC，乐观者建大型，保守者建小型，后悔准则建中型。哪条准则是对的？"),
                   [(T(r"None is “correct”: they answer different attitudes to risk. The exam asks you to apply the named criterion, or to say which you recommend and why.", r"没有哪条“对”：它们回答的是对风险的不同态度。考试会让你用指定的那条准则，或者让你说出你推荐哪条、为什么。"), True),
                    (T(r"The optimistic one, since it has the biggest payoff.", r"乐观准则，因为它的收益最大。"), T(r"That is a choice about attitude, not a fact about the table.", r"那是态度的选择，不是表的事实。"), 'criteria-agree'),
                    (T(r"The regret one, since it is the only one that uses every cell.", r"后悔准则，因为只有它用到了每个格子。"), T(r"It does use every cell, but that does not make it the right attitude for everyone.", r"它确实用到每个格子，但这不代表它对每个人都是对的态度。"), 'criteria-agree')],
                   T(r"Without probabilities there is no single best answer: the criterion is a statement about the decision maker.", r"没有概率就没有唯一的最优答案：准则是对决策者的一个说明。"), purpose='check'),

            read('south', T('Two more tables', '再看两张表'),
                 p(T(r"Southland Corporation must build a **small** or **large** plant for a new product; demand will be **low, medium or high** (profits in \$ millions). Apply the three criteria.", r"Southland 公司要为新产品建**小**工厂或**大**工厂；需求会是**低、中、高**（利润单位百万美元）。用三条准则各做一遍。")),
                 frame('payoff_dial.html', T('Southland’s payoff table.', 'Southland 的收益表。'), unit='$', sense='max', mode='opt', **SOUTH),
                 chapter=T('Use it', '用一用')),
            number('south_reg', T('Southland’s regret', 'Southland 的后悔'), SK,
                   T(r"What is the largest regret of the **small** plant (the number the regret rule compares)?", r"**小**工厂的最大后悔值是多少（后悔准则要比较的那个数）？"),
                   s['mr'][0], T(rf"In high demand the best payoff is 500 and the small plant gives 200: regret 300. Its other regrets are 0, so its largest is 300; the large plant’s largest is 100 (low demand: $150 - 50$). The regret rule builds the **large** plant.", rf"高需求时最好的收益是 500，小工厂是 200：后悔值 300。它的其他后悔值是 0，所以最大的是 300；大工厂最大的是 100（低需求：$150 - 50$）。后悔准则选**大**工厂。"), tolerance=0.01, purpose='practice'),
            read('hudson', T('Costs instead of profits', '成本而不是利润'),
                 p(T(r"Hudson Corporation runs a data-processing operation with its **own staff**, by **outsourcing** or with a **combination**. The table gives annual cost in \$ thousands under high, medium and low demand. Now *smaller is better*, so every rule flips: the optimist takes the **smallest** cost, the conservative guards against the **largest**, and regret is the cost minus the **smallest** cost in that column.", r"Hudson 公司的数据处理业务可以用**自己的员工**、**外包**或**混合**。表里是高、中、低需求下的年成本，单位千美元。这次*越小越好*，所以每条规则都要反过来：乐观者取**最小**的成本，保守者防备**最大**的成本，后悔值是成本减去这一列里**最小**的成本。")),
                 frame('payoff_dial.html', T('Hudson’s cost table, where smaller is better.', 'Hudson 的成本表，越小越好。'), unit='$', sense='min', mode='con', **HUDSON),
                 chapter=T('Use it', '用一用')),
            choice('hudson_con', T('The conservative manager', '保守的经理'), SK,
                   T(r"Which staffing option does the conservative criterion choose for Hudson (costs: own staff 650, 650, 600; outsourcing 900, 600, 300; combination 800, 650, 500)?", r"保守准则会为 Hudson 选哪种用人方式（成本：自己的员工 650、650、600；外包 900、600、300；混合 800、650、500）？"),
                   [(T(r"Own staff: its worst cost, 650, is the smallest of the worst costs (650, 900, 800).", r"自己的员工：它最坏的成本 650，是各方案最坏成本（650、900、800）里最小的。"), True),
                    (T(r"Outsourcing: it has the smallest cost of all, 300.", r"外包：它有全表最小的成本 300。"), T(r"That is the optimist’s reasoning (the best case).", r"那是乐观者的想法（最好情形）。"), 'criteria-agree'),
                    (T(r"Combination: it is in the middle.", r"混合：它在中间。"), T(r"A conservative criterion looks at the worst cost of each option, not at the middle.", r"保守准则看每个方案的最坏成本，不看中间。"), None)],
                   T(r"With costs the “worst” is the largest. Own staff’s largest cost, 650, is below outsourcing’s 900 and the combination’s 800.", r"成本问题里“最坏”是最大的。自己员工的最大成本 650，低于外包的 900 和混合的 800。"), purpose='practice'),

            read('traps', T('Traps', '易错点'),
                 callout('warning', T('Costs flip every rule', '成本把每条规则都反过来'), T(r"With costs (or travel times) the best is the smallest. Optimistic: the smallest cost. Conservative: the best of the largest costs, so the smallest of the maxima. Regret: cost minus the smallest cost of the column.", r"成本（或行程时间）里最好的是最小的。乐观：最小的成本。保守：最大成本里最好的，也就是最大值里最小的。后悔：成本减去这一列最小的成本。")),
                 callout('warning', T('Regret is not a loss', '后悔不是亏损'), T(r"A cell can have a profit of 8 and a regret of 12. Regret is measured against the best payoff in the same column, never against zero.", r"一个格子可以利润是 8、后悔值却是 12。后悔值是和同一列的最好收益比，从来不是和 0 比。")),
                 callout('note', T('When there are probabilities', '有概率的时候'), T(r"If the question gives probabilities of the states, you use them: next lesson. These three criteria are for “no probabilities”.", r"如果题目给了各状态的概率，就要用：下一课。这三条准则是用于“没有概率”的情形。")),
                 chapter=T('Traps', '易错点')),
            choice('recall_dummy', T('Recall: a dummy', '回忆：虚拟项'), SK,
                   T(r"Total demand is 800 and total supply 600. A dummy origin of 200 with cost 0 is added. What does it stand for?", r"总需求 800，总供应 600。加了一个 200、运费 0 的虚拟供应地。它代表什么？"),
                   [(T(r"The demand that goes unmet: nothing is really shipped.", r"没有被满足的需求：什么也没有真的运出。"), True),
                    (T(r"A new factory.", r"一家新工厂。"), T(r"Nothing is built; the dummy only balances the table.", r"什么也没建；虚拟项只是把表补平。"), None),
                    (T(r"Extra stock in the warehouses.", r"仓库里多出来的库存。"), T(r"That would be a dummy destination (surplus supply).", r"那是虚拟需求地（多余的供应）。"), 'dummy-wrong-side')],
                   T(r"The dummy origin soaks up the shortfall at cost 0.", r"虚拟供应地以 0 成本吸收缺口。"), purpose='check'),
            choice('recall_limit', T('Recall: a yes/no line', '回忆：是/否的行'), SK,
                   T(r"“Build $A$ only if $B$ is built” with yes/no variables $y_A$ and $y_B$ is:", r"用 0-1 变量 $y_A$、$y_B$ 表示“只有建了 $B$ 才建 $A$”："),
                   [(r"$y_A \le y_B$", True), (r"$y_A + y_B \le 1$", T(r"That says at most one of them.", r"那是说至多一个。"), None), (r"$y_A \ge y_B$", T(r"That reads “B only if A”: the wrong way round.", r"那读成“只有 A 才 B”：方向反了。"), None)],
                   T(r"If $y_A = 1$ the line forces $y_B = 1$.", r"若 $y_A = 1$，这一行逼出 $y_B = 1$。"), purpose='check'),
        ],
    )
