# Lesson 5 (network): how things flow, and what a dummy is. Decks: W3 (transportation, unbalanced cases with dummies, assignment, transshipment,
# the two workshops). Exam: 2025 Q3(ii), 15 marks. Instrument: flow_net (ship, balance, assign, build). Numbers: lp_solve.
from common import *

SK = 'mg.network'
TCOST = [[3, 6, 6, 7, 4], [6, 5, 6, 15, 8], [5, 3, 10, 6, 7], [4, 4, 7, 8, 9]]
TSUP, TDEM = [16000, 11000, 9000, 8000], [12000, 8000, 10000, 8000, 6000]
WCOST = [[8, 9, 3], [2, 6, 2], [3, 5, 12], [10, 7, 9]]
ACOST = [[8, 6, 2, 4, 3], [6, 7, 11, 10, 7], [3, 5, 7, 6, 4], [5, 10, 12, 9, 7], [7, 12, 5, 7, 8]]
TV = [[5000, 3000, 6000, 4000], [7500, 8000, 7000, 5500], [8500, 5000, 6500, 8000], [7000, 6000, 6500, 5000], [7000, 8000, 3000, 6000], [6000, 4000, 4500, 7000]]
HC = [[4, 7, None, None, None, None], [8, 5, None, None, None, None], [5, 6, None, None, None, 7], [0, 2, 6, 4, 8, 4], [2, 0, 3, 6, 7, 7]]
HS, HD = [400, 600, 300, 1300, 1300], [1300, 1300, 300, 300, 300, 400]


def transport(cost, sup, dem, sense='min', eq_sup=False):
    idx = [(i, j) for i in range(len(cost)) for j in range(len(cost[0])) if cost[i][j] is not None]
    rows = [([1 if p[0] == i else 0 for p in idx], '=' if eq_sup else '<=', s) for i, s in enumerate(sup)] + [([1 if p[1] == j else 0 for p in idx], '=', d) for j, d in enumerate(dem)]
    return lp_solve(sense, [cost[i][j] for i, j in idx], rows)


def greedy(cost, sup, dem):
    """Ship as much as possible along the cheapest remaining cell, again and again."""
    s, d, z = list(sup), list(dem), 0
    cells = sorted((cost[i][j], i, j) for i in range(len(cost)) for j in range(len(cost[0])))
    for c, i, j in cells:
        q = min(s[i], d[j]); z += q * c; s[i] -= q; d[j] -= q
    return z


def L_network():
    tr = transport(TCOST, TSUP, TDEM)
    gz = greedy(TCOST, TSUP, TDEM)
    assert gz > tr['obj'], 'the greedy trap must lose'
    wcost = WCOST + [[0, 0, 0]]
    wk = transport(wcost, [150] * 4 + [200], [300, 250, 250])
    asg = transport(ACOST, [1] * 5, [1] * 5, eq_sup=True)
    tvc = [r + [0, 0] for r in TV] if False else [list(r) + [0, 0] for r in TV]   # columns: 4 slots + 2 dummy slots (supply side = programs)
    tv = transport([[TV[p][s] for s in range(4)] + [0, 0] for p in range(6)], [1] * 6, [1] * 6, sense='max', eq_sup=True)
    hr = transport(HC, HS, HD)
    assert hr['status'] == 'optimal'
    # the exam's table: five origins (3 plants + 2 warehouses), six destinations (2 warehouses + 4 customers), each warehouse's buffer = total supply
    assert sum(HS[:3]) == 1300 == sum(HD[2:])
    r_greedy = round(gz)
    M = 'M'
    return dict(
        id=f'{CID}-network',
        title=T('How things flow, and what a dummy is', '东西怎么流动，“虚拟”是什么'),
        description=T('Shipping, assigning and transshipping are one picture: a table of costs, supplies on the side, demands along the bottom. You ship by hand, add a dummy to balance a table, assign workers, and build the exam’s transshipment table cell by cell.',
                      '运输、指派和转运其实是同一幅图：一张成本表，旁边是供应，下面是需求。你亲手运货，用虚拟项把表补平，指派工人，再一格一格建出考试里的转运表。'),
        minutes=55,
        skills=[{'id': SK, 'name': T('Transportation, assignment and transshipment tables', '运输、指派和转运表')}],
        misconceptions=[
            {'id': 'cheapest-cell-first', 'description': T('Believing that filling the cheapest cell first gives the cheapest plan', '以为先填最便宜的格子就能得到最便宜的方案')},
            {'id': 'dummy-wrong-side', 'description': T('Adding the dummy on the wrong side, or giving it a cost', '把虚拟项加在错误的一侧，或者给它一个运费')},
            {'id': 'transship-no-buffer', 'description': T('Forgetting that a warehouse is both a destination and an origin, with a capacity equal to the total flow', '忘了仓库既是需求地又是供应地，容量等于总流量')},
        ],
        steps=[
            read('ship', T('Ship it yourself', '亲手把货运出去'),
                 p(T(r"Four suppliers hold 16,000, 11,000, 9,000 and 8,000 units. Five customers want 12,000, 8,000, 10,000, 8,000 and 6,000. The number in each cell is the cost of sending **one unit** from that supplier to that customer. Find a plan that meets every demand for the least cost.", r"四个供应商手里分别有 16,000、11,000、9,000、8,000 件货。五个客户分别要 12,000、8,000、10,000、8,000、6,000 件。每个格子里的数是从那个供应商运**一件**到那个客户的成本。找一个满足所有需求、成本最低的方案。")),
                 frame('flow_net.html', T('A transportation table you fill in: type the units shipped on each route; the totals and the cost update.', '一张你来填的运输表：在每条路线上填运量，合计和成本会随之更新。'),
                       caption=T(r"Each supplier may ship up to its supply (at most), each customer must receive exactly its demand.", r"每个供应商最多运出它的供应量，每个客户必须正好收到它的需求量。"),
                       mode='ship', rows=[T(f'Supplier {i + 1}', f'供应商 {i + 1}') for i in range(4)], cols=[T(f'Customer {j + 1}', f'客户 {j + 1}') for j in range(5)], cost=TCOST, supply=TSUP, demand=TDEM, money='$'),
                 chapter=T('Touch', '动手')),
            choice('greedy', T('Cheapest cell first?', '先填最便宜的格子？'), SK,
                   T(rf"A clerk fills the table greedily: find the cheapest cell, ship as much as possible there, then the next cheapest cell, and so on. It meets every demand. Is it the cheapest plan? (The best plan costs {usd(tr['obj'], 0)}.)", rf"一位职员用贪心法填表：找最便宜的格子，在那里尽量多运，再找下一个最便宜的格子，依此类推。每个需求都满足了。这是最便宜的方案吗？（最优方案成本是 {usd(tr['obj'], 0)}。）"),
                   [(T(rf"No: it costs {usd(r_greedy, 0)}, more than the best. A cheap cell can use up a supply that a dearer cell badly needs.", rf"不是：它的成本是 {usd(r_greedy, 0)}，比最优高。一个便宜的格子可能用掉了别处更需要的供应。"), True),
                    (T(r"Yes: always taking the cheapest route cannot be beaten.", r"是：每次都走最便宜的路线不会被超过。"), T(r"Try it: after the cheapest cells are full, the last customers can only be served by the dearest routes.", r"试一下：最便宜的格子填满之后，最后几个客户只能走最贵的路线。"), 'cheapest-cell-first'),
                    (T(r"Cannot tell without solving the LP.", r"不解 LP 就没法知道。"), T(r"You can: the greedy plan is a valid plan, and a valid plan costing more than the best proves it is not best. The solver is what finds the best.", r"可以知道：贪心方案是个有效方案，成本比最优高就说明它不是最优。找出最优的是求解器。"), None)],
                   T(r"Cheapest-cell-first is easy to do by hand and often wrong; an LP weighs every route against every other at once.", r"先填最便宜的格子手算容易，但常常是错的；LP 是把每条路线和其他所有路线同时比较。")),
            read('name', T('The table is an LP', '这张表就是一个 LP'),
                 p(T(r"Every cell is a decision, $x_{ij}$: units sent from supplier $i$ to customer $j$. The table’s edges are the limits, and the pattern never changes: each row sends out at most its supply, each column receives exactly its demand.", r"每个格子是一个决策 $x_{ij}$：从供应商 $i$ 运到客户 $j$ 的数量。表的边就是限制，模式永远不变：每一行运出的最多是它的供应量，每一列收到的正好是它的需求量。")),
                 math_(r"\begin{aligned}\min\ z &= \sum_{i}\sum_{j} c_{ij}\,x_{ij}\\ \sum_{j} x_{ij} &\le s_i\\ \sum_{i} x_{ij} &= d_j\\ x_{ij} &\ge 0\end{aligned}"),
                 table([T('Problem', '问题'), T('Table', '表'), T('Row limit', '行限制'), T('Column limit', '列限制')],
                       [T('**Transportation**', '**运输**'), T('suppliers × customers', '供应商 × 客户'), T('≤ supply $s_i$', '≤ 供应量 $s_i$'), T('= demand $d_j$', '= 需求量 $d_j$')],
                       [T('**Assignment**', '**指派**'), T('workers × tasks', '工人 × 任务'), T('= 1 (each worker, one task)', '= 1（每人一个任务）'), T('= 1 (each task, one worker)', '= 1（每个任务一个人）')],
                       [T('**Transshipment**', '**转运**'), T('origins × destinations, warehouses on both sides', '供应地 × 需求地，仓库两边都有'), T('≤ supply (warehouse: the buffer)', '≤ 供应（仓库：缓冲量）'), T('= demand (warehouse: the buffer)', '= 需求（仓库：缓冲量）')]),
                 p(T(rf"The best plan for the table you just filled costs {usd(tr['obj'], 0)}. Assignment is a transportation table in which every supply and demand is 1, so the answers are 0 or 1.", rf"你刚才填的那张表，最优方案成本是 {usd(tr['obj'], 0)}。指派问题是每个供应和需求都是 1 的运输表，所以答案是 0 或 1。")),
                 chapter=T('Names', '命名')),

            read('dummy', T('When the table does not balance', '表不平衡的时候'),
                 p(T(r"A solver needs total supply to be able to match total demand. Four factories can each make 150 units (600 in all); three warehouses ask for 300, 250 and 250 (800 in all). The table is short by 200. Add a **dummy** to take up the difference, and choose the right side.", r"求解器需要总供应能和总需求对上。四家工厂每家最多能做 150 件（共 600）；三个仓库要 300、250、250（共 800）。表缺 200。加一个**虚拟项**把差额补上，并选对加在哪一侧。")),
                 frame('flow_net.html', T('Balance a table: choose a dummy origin or a dummy destination, and type its amount.', '把表补平：选加虚拟供应地还是虚拟需求地，并填它的数量。'),
                       mode='balance', rows=[T(f'Factory {i + 1}', f'工厂 {i + 1}') for i in range(4)], cols=[T(f'Warehouse {j + 1}', f'仓库 {j + 1}') for j in range(3)], cost=WCOST, supply=[150] * 4, demand=[300, 250, 250], money='$'),
                 table([T('Case', '情形'), T('Add', '加'), T('Its amount', '数量'), T('Its costs', '运费')],
                       [T('Capacity > requirement', '供应 > 需求'), T('a dummy **destination**', '虚拟**需求地**'), T('capacity − requirement', '供应 − 需求'), T('0', '0')],
                       [T('Requirement > capacity', '需求 > 供应'), T('a dummy **origin**', '虚拟**供应地**'), T('requirement − capacity', '需求 − 供应'), T('0', '0')]),
                 chapter=T('Dummy', '虚拟项')),
            number('wk_cost', T('The cheapest way to ship 600 of the 800', '运 600 件、最省的方案'), SK,
                   T(r"The four factories supply the warehouses as cheaply as possible, with the costs 8 9 3 / 2 6 2 / 3 5 12 / 10 7 9 (factories 1 to 4 against warehouses 1 to 3). A dummy origin of 200 units with zero costs balances the table. What is the least shipping cost?", r"四家工厂以最低成本供应仓库，运费为 8 9 3 / 2 6 2 / 3 5 12 / 10 7 9（工厂 1 到 4 对仓库 1 到 3）。一个 200 件、运费为 0 的虚拟供应地把表补平。最低运输成本是多少？"),
                   round(wk['obj']), T(rf"With the dummy origin the table balances (800 against 800). The least cost is {usd(wk['obj'], 0)}; the 200 units the dummy ‘ships’ are the demand that goes unmet, at cost 0.", rf"加上虚拟供应地，表平衡了（800 对 800）。最低成本是 {usd(wk['obj'], 0)}；虚拟项“运”的 200 件就是没有被满足的需求，成本为 0。"),
                   tolerance=0.01, unit=T('dollars', '美元'), purpose='practice'),

            read('assign', T('Assignment: one worker, one task', '指派：一人一事'),
                 p(T(r"Five workers, five tasks, and the cost of worker $i$ doing task $j$. Choose one cell in each row and each column so that the total is least. Click a cell to give that worker that task.", r"五个工人、五项任务，以及工人 $i$ 做任务 $j$ 的成本。每行每列各选一个格子，使总成本最低。点一个格子，就是把那项任务交给那个工人。")),
                 frame('flow_net.html', T('An assignment table: choose one cell per row and per column.', '指派表：每行每列选一个格子。'),
                       mode='assign', rows=[T(f'Worker {i + 1}', f'工人 {i + 1}') for i in range(5)], cols=[T(f'Task {j + 1}', f'任务 {j + 1}') for j in range(5)], cost=ACOST, supply=[1] * 5, demand=[1] * 5, money='$'),
                 chapter=T('Assignment', '指派')),
            number('asg', T('The cheapest assignment', '最便宜的指派'), SK,
                   T(r"What is the least total cost of assigning the five workers to the five tasks (costs 8 6 2 4 3 / 6 7 11 10 7 / 3 5 7 6 4 / 5 10 12 9 7 / 7 12 5 7 8)?", r"把五个工人指派到五项任务，最低总成本是多少（成本 8 6 2 4 3 / 6 7 11 10 7 / 3 5 7 6 4 / 5 10 12 9 7 / 7 12 5 7 8）？"),
                   round(asg['obj']), T(rf"The assignment LP (every row and column equal to 1) has least cost {usd(asg['obj'], 0)}.", rf"指派 LP（每行每列都等于 1）的最低成本是 {usd(asg['obj'], 0)}。"), tolerance=0.01, unit=T('dollars', '美元'), purpose='practice'),
            number('tv', T('Six programs, four slots', '六个节目，四个时段'), SK,
                   T(r"A TV station has 4 time slots and 6 candidate programs; revenue by program for slots 1 to 4: Home Improvement 5000 3000 6000 4000; World News 7500 8000 7000 5500; NASCAR Live 8500 5000 6500 8000; Wall Street Today 7000 6000 6500 5000; Hollywood Briefings 7000 8000 3000 6000; Ramundo & Son 6000 4000 4500 7000. To make the table square, two dummy slots with zero revenue are added. The maximum total revenue is:", r"电视台有 4 个时段、6 个候选节目；各节目在时段 1 到 4 的广告收入：Home Improvement 5000 3000 6000 4000；World News 7500 8000 7000 5500；NASCAR Live 8500 5000 6500 8000；Wall Street Today 7000 6000 6500 5000；Hollywood Briefings 7000 8000 3000 6000；Ramundo & Son 6000 4000 4500 7000。为了让表成为方阵，加了两个收入为 0 的虚拟时段。最大总收入是："),
                   round(tv['obj']), T(rf"Six programs against four real and two dummy slots: the two programs that get dummy slots are simply not shown. Maximum revenue {usd(tv['obj'], 0)}.", rf"六个节目对四个真实时段加两个虚拟时段：分到虚拟时段的两个节目就是不播。最大收入 {usd(tv['obj'], 0)}。"), tolerance=0.01, unit=T('dollars', '美元'), purpose='practice'),

            read('exam', T('The exam’s version: Herman’s warehouses', '考试里的版本：Herman 的仓库'),
                 p(T(r"A transshipment problem: goods may pass through a warehouse on the way. The trick is to treat each warehouse as **both** an origin and a destination. As an origin it can ship up to the total flow; as a destination it must receive that same amount, because everything it receives it also ships on. That amount, the **buffer**, is the total supply (1,300 here), and the warehouse to itself costs 0.", r"转运问题：货可以在途中经过仓库。诀窍是把每个仓库**同时**当作供应地和需求地。作为供应地，它最多能运出总流量；作为需求地，它必须收到同样的量，因为收到的都会再运走。这个量叫**缓冲量**，就是总供应（这里是 1,300），仓库发往它自己的运费是 0。")),
                 paper(T('Question 3 (ii) · 15 marks', '第 3 题 (ii) · 15 分'),
                       *ptxt("The distribution system for the Herman Company consists of three plants, two warehouses, and four customers. Plant capacities and shipping costs per unit (in $) from each plant to each warehouse are as follows: Plant 1: to warehouse 1 costs 4, to warehouse 2 costs 7, capacity 400; Plant 2: 8 and 5, capacity 600; Plant 3: 5 and 6, capacity 300.\nCustomer demand and shipping costs per unit (in $) from each warehouse to each customer are as follows: Warehouse 1: to customers 1 to 4 costs 6, 4, 8, 4; Warehouse 2: 3, 6, 7, 7; demand of customers 1 to 4: 300, 300, 300, 400.\nSuppose that shipments between the two warehouses are permitted at $2 per unit and that direct shipments can be made from Plant 3 to Customer 4 at a cost of $7 per unit. Construct a transportation table for the transshipment problem. Then, formulate the LP model for the problem. (Hints: use P1, P2, and P3 to denote the plants, use W4 and W5 to denote the warehouses, and use C6, C7, C8, and C9 to denote the customers.)",
                             "Herman 公司的配送系统由三个工厂、两个仓库和四个客户组成。各工厂的产能以及从每个工厂到每个仓库的单位运费（美元）如下：工厂 1：到仓库 1 运费 4，到仓库 2 运费 7，产能 400；工厂 2：8 和 5，产能 600；工厂 3：5 和 6，产能 300。\n客户需求以及从每个仓库到每个客户的单位运费（美元）如下：仓库 1：到客户 1 至 4 的运费为 6、4、8、4；仓库 2：3、6、7、7；客户 1 至 4 的需求：300、300、300、400。\n假设两个仓库之间允许运输，每单位 $2，并且可以从工厂 3 直接运给客户 4，每单位 $7。为这个转运问题建一张运输表，然后写出 LP 模型。（提示：用 P1、P2、P3 表示工厂，W4、W5 表示仓库，C6、C7、C8、C9 表示客户。）")),
                 frame('flow_net.html', T('Build the transportation table of the Herman transshipment problem: costs in the cells, supplies on the right, demands at the bottom.', '建 Herman 转运问题的运输表：成本填在格子里，供应在右边，需求在下面。'),
                       caption=T(r"Rows: three plants and two warehouses. Columns: two warehouses and four customers. Check marks the cells you have right.", r"行：三个工厂和两个仓库。列：两个仓库和四个客户。检查会标出你填对的格子。"),
                       mode='build', rows=['P1', 'P2', 'P3', 'W4', 'W5'], cols=['W4', 'W5', 'C6', 'C7', 'C8', 'C9'], ref=dict(cost=HC, supply=HS, demand=HD), money='$'),
                 chapter=T('On the paper', '考卷上')),
            derive('herman', T('The model, line by line', '模型，一行一行讲'),
                   [(r"x_{ij} \ge 0", T(r"$x_{ij}$ is the units sent from origin $i$ (P1, P2, P3, W4, W5) to destination $j$ (W4, W5, C6 to C9). A plant cannot ship to a customer unless there is a road, so those cells are set to 0.", r"$x_{ij}$ 是从供应地 $i$（P1、P2、P3、W4、W5）运到需求地 $j$（W4、W5、C6 到 C9）的数量。没有路的地方不能运，所以那些格子设为 0。")),
                    (r"\min\ z = 4x_{14} + 7x_{15} + 8x_{24} + 5x_{25} + 5x_{34} + 6x_{35} + 7x_{39} + 2x_{45} + 6x_{46} + 4x_{47} + 8x_{48} + 4x_{49} + 2x_{54} + 3x_{56} + 6x_{57} + 7x_{58} + 7x_{59}", T(r"Add up cost × units over every allowed route. $x_{44}$ and $x_{55}$ (a warehouse to itself) cost 0, so they do not appear.", r"把每条允许路线的成本 × 运量加起来。$x_{44}$ 和 $x_{55}$（仓库发往自己）运费为 0，所以不出现。")),
                    (r"x_{14} + x_{15} \le 400,\ \ x_{24} + x_{25} \le 600,\ \ x_{34} + x_{35} + x_{39} \le 300", T(r"Plants: each ships at most its capacity (P3 has the extra direct route $x_{39}$).", r"工厂：每个最多运出它的产能（P3 多一条直达路线 $x_{39}$）。")),
                    (r"x_{44} + x_{45} + x_{46} + x_{47} + x_{48} + x_{49} \le 1300,\ \ x_{54} + x_{55} + x_{56} + x_{57} + x_{58} + x_{59} \le 1300", T(r"Warehouses as origins: each can ship out at most the buffer, 1,300.", r"仓库作为供应地：每个最多运出缓冲量 1,300。")),
                    (r"x_{14} + x_{24} + x_{34} + x_{44} + x_{54} = 1300,\ \ x_{15} + x_{25} + x_{35} + x_{45} + x_{55} = 1300", T(r"Warehouses as destinations: each receives exactly the buffer. (Whatever is not really passed on goes to $x_{44}$, the warehouse to itself.)", r"仓库作为需求地：每个正好收到缓冲量。（没有真正转运出去的部分，落在 $x_{44}$，也就是仓库发往它自己。）")),
                    (r"x_{16} + x_{26} + x_{36} + x_{46} + x_{56} = 300,\ \ \ldots,\ \ x_{19} + x_{29} + x_{39} + x_{49} + x_{59} = 400", T(r"Customers: exactly their demand (300, 300, 300, 400).", r"客户：正好是他们的需求（300、300、300、400）。"))],
                   outro=T(rf"Fifteen marks: the table (about half), then the objective and the three kinds of limit. With the table built, solving gives a least shipping cost of {usd(hr['obj'], 0)}.", rf"十五分：表（约一半），然后是目标函数和三类限制。表建好之后，解出来最低运输成本是 {usd(hr['obj'], 0)}。"), skill=SK),
            read('answer', T('The table as it is written on the paper', '写在卷子上的那张表'),
                 table(['', 'W4', 'W5', 'C6', 'C7', 'C8', 'C9', T('Supply', '供应')],
                       *[[nm] + [(M if v is None else str(v)) for v in HC[i]] + [str(HS[i])] for i, nm in enumerate(['P1', 'P2', 'P3', 'W4', 'W5'])],
                       [T('Demand', '需求')] + [str(d) for d in HD] + ['']),
                 p(T(r"M stands for a route that does not exist (the exam’s answer writes ∞). The two warehouses’ supply and demand are both 1,300, the total supply: that is what lets goods pass through.", r"M 表示不存在的路线（标准答案写成 ∞）。两个仓库的供应和需求都是 1,300，也就是总供应：这样货才能从仓库穿过。")),
                 chapter=T('The answer', '答案')),

            read('traps', T('Traps', '易错点'),
                 callout('warning', T('Dummy costs and sides', '虚拟项的运费和位置'), T(r"A dummy always costs 0 (nothing is shipped). Surplus supply gets a dummy destination; surplus demand gets a dummy origin.", r"虚拟项的运费永远是 0（什么都没运）。供应有剩，加虚拟需求地；需求有剩，加虚拟供应地。")),
                 callout('warning', T('Blocked routes', '不通的路线'), T(r"A route that does not exist is not “0”: 0 would be the cheapest of all. Give it a huge cost M, or fix the variable at 0.", r"不存在的路线不能写成“0”：0 会成为最便宜的路线。给它一个巨大的成本 M，或者把变量固定为 0。")),
                 callout('note', T('Assignment is not special', '指派不特殊'), T(r"An assignment is the transportation LP with every supply and demand equal to 1. The same table, the same limits.", r"指派就是供应和需求都为 1 的运输 LP。同一张表，同样的限制。")),
                 chapter=T('Traps', '易错点')),
            choice('recall_patterns', T('Recall: which shape', '回忆：哪种形状'), SK,
                   T(r"“Each employee works five consecutive days, then has two days off.” Which shape is this?", r"“每位员工连续工作五天，然后休息两天。”这是哪种形状？"),
                   [(T(r"A schedule: the variable is the people who start on each day.", r"排班：变量是每天开始上班的人数。"), True),
                    (T(r"A blend.", r"配比。"), T(r"A blend has shares of a product’s own total.", r"配比是占产品自己总量的占比。"), None),
                    (T(r"A transportation table.", r"运输表。"), T(r"There is nothing moved from places to places.", r"这里没有从一个地方运到另一个地方的东西。"), None)],
                   T(r"Consecutive days is the signal of a schedule.", r"“连续几天”是排班的信号。"), purpose='check'),
            choice('recall_shadow2', T('Recall: slack and shadow price', '回忆：松弛与影子价格'), SK,
                   T(r"A limit’s final value is 580 against a right-hand side of 600. Its shadow price is:", r"一条限制的终值是 580，右端是 600。它的影子价格是："),
                   [(T(r"0: it has room to spare.", r"0：它有富余。"), True),
                    (T(r"Positive: it is nearly full.", r"正的：它快满了。"), T(r"Nearly full is not full: only a binding limit is priced.", r"快满不是满：只有紧的限制才有价。"), None),
                    (T(r"20, the slack.", r"20，也就是松弛量。"), T(r"Slack is in units of the limit; the shadow price is in units of the objective per unit of the limit.", r"松弛量的单位是这条限制的单位；影子价格的单位是目标值每单位限制。"), 'reduced-vs-shadow')],
                   T(r"Slack means shadow price 0.", r"有松弛，影子价格就是 0。"), purpose='check'),
        ],
    )
