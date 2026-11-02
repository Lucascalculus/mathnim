# The predicted exam questions (a unit of the ECON90015 course, built by build.py): eight questions in the mock's
# style on what this subject teaches every year, each taught the same way as the mock's questions. The lessons
# live in pq_markets.py, pq_power.py and pq_macro.py; their shared titles and diagrams in pq_common.py.
from pq_common import *  # noqa: F401,F403
from pq_macro import L_pq_growth, L_pq_macro
from pq_markets import L_pq_costs, L_pq_pollution, L_pq_tax
from pq_power import L_pq_games, L_pq_oligopoly, L_pq_pricing

CID = 'econ90015'


def L_pq_start():
    return dict(
        id=f'{CID}-pq-start', title=T('Start here: eight predicted questions', '从这里开始：八道预测题'),
        description=T('Where the predictions come from, what each question covers that the mock did not, and how to use them.', '这些预测从哪里来，每道题覆盖了哪些模考没考的内容，以及怎么用。'),
        minutes=8,
        skills=[{'id': 'e15.pq.map', 'name': T('Reading the predicted questions', '读懂这组预测题')}],
        steps=[
            read('why', T('What the mock leaves out', '模考漏掉了什么'),
                 p(T(r"The mock exam asks six questions, but the course teaches more than six things. A real paper is written from the whole course, so you should expect questions on topics the mock never touched, and twists on the ones it did. This unit predicts them: eight questions written in the mock's style, each taught exactly like the mock's questions, from the ground up.",
                     r"模考出了六道题，但这门课讲的远不止六样东西。真题是从整门课里出的，所以要准备好模考没碰过的话题，以及模考考过的话题的变化。这个单元就做这件事：按模考的风格写了八道题，每道都像模考的题一样从头讲起。")),
                 h(T('Where the predictions come from', '预测从哪里来')),
                 ul(T(r"**The subject's learning outcomes** (the University of Melbourne Handbook, 2026): competitive markets; economies of scale, scope and learning; perfect competition, monopoly, monopolistic competition and oligopoly; game theory; measures of cost; external costs and the policies against them: taxes, quantitative restrictions and tradeable emissions permits; the macroeconomic environment and government policy.",
                        r"**这门课的学习目标**（墨尔本大学课程手册，2026）：竞争市场；规模、范围和学习经济；完全竞争、垄断、垄断竞争和寡头；博弈论；成本的各种度量；外部成本及其政策：征税、数量限制和可交易排放许可；宏观经济环境和政府政策。"),
                    T(r"**What the lectures actually covered** in recent runs, from the topic lists of students' notes (2022 and 2024): GDP; supply and demand; equilibrium and elasticities; welfare; externalities and taxes; production and cost; perfect competition; single-price monopoly; non-uniform pricing (price discrimination, two-part pricing, bundling); oligopoly and game theory; long-run growth; and money, inflation, interest rates and fiscal and monetary policy.",
                      r"**近几年课上实际讲了什么**，来自学生笔记的目录（2022 和 2024 年）：GDP；供给与需求；均衡与弹性；福利；外部性与税；生产与成本；完全竞争；单一价格垄断；非统一定价（价格歧视、两部收费、捆绑）；寡头与博弈论；长期增长；以及货币、通胀、利率和财政与货币政策。"),
                    T(r"**The mock itself**: its style (numbers that come out clean, a diagram in most questions, explanations worth marks) and its hints, such as question 2's remark that the class worked a per-unit tax.",
                      r"**模考本身**：它的风格（数字算出来很整齐，多数题要画图，解释也给分）和它的提示，比如第 2 题提到课上做过从量税。")),
                 callout('warning', T('Predictions, not leaks', '是预测，不是泄题'),
                         T(r"We have not seen the lecture slides or past papers, so treat these as practice on the likeliest topics, not as the exam. Question 8 (GDP and money) is the least certain.", r"我们没有看过课件或往年真题，所以把它们当作最可能考的话题上的练习，而不是考题本身。第 8 题（GDP 与货币）把握最小。"))),
            read('questions', T('The eight questions', '八道题'),
                 table([T('Question', '题'), T('Topic', '话题'), T('Next to the mock', '和模考的关系'), T('Marks', '分值')],
                       ['1', T('A per-unit tax and a price ceiling in a competitive market', '竞争市场里的从量税和价格上限'), T('Deeper: the mock’s question 1 used a quota; this is the tax the class worked, plus incidence and elasticity of supply', '加深：模考第 1 题用的是配额；这里是课上做过的从量税，加上税负归宿和供给弹性'), '18'],
                       ['2', T('Pollution: a Pigouvian tax, and tradeable permits', '污染：庇古税和可交易排放许可'), T('New: named in the learning outcomes, not in the mock', '新：学习目标里点名，模考没考'), '20'],
                       ['3', T('A firm in the short run: shutdown, supply, entry', '短期里的厂商：停产、供给、进入'), T('Deeper: the mock’s question 5 was the long run only', '加深：模考第 5 题只讲长期'), '18'],
                       ['4', T('Two-part tariffs and bundling', '两部收费和捆绑'), T('New: the rest of non-uniform pricing', '新：非统一定价的其余部分'), '18'],
                       ['5', T('Cournot, Stackelberg, a cartel and Bertrand', '古诺、斯塔克尔伯格、卡特尔和伯特兰'), T('Deeper: the mock asked Cournot only', '加深：模考只考了古诺'), '20'],
                       ['6', T('Games: a payoff matrix and an entry game', '博弈：收益矩阵和进入博弈'), T('New: game theory beyond Cournot', '新：古诺之外的博弈论'), '16'],
                       ['7', T('Malthus with numbers, a plague, the escape', '带数字的马尔萨斯、瘟疫、走出陷阱'), T('Deeper: the mock’s question 6 had no numbers', '加深：模考第 6 题没有数字'), '14'],
                       ['8', T('GDP, inflation and money', 'GDP、通胀和货币'), T('New: the macroeconomics the mock left out', '新：模考没考的宏观部分'), '14']),
                 p(T(r"The order follows the course: markets, then firms, then pricing power, then strategy, then the whole economy. Each lesson stands on its own, so you can start with the topic you are least sure of.",
                     r"顺序跟着课程走：先市场，再厂商，再定价权，再策略，最后整个经济。每一课都自成一体，可以先从你最没把握的话题开始。"))),
            read('how', T('How to use them', '怎么用'),
                 ol(T(r"**Try the question first.** Each lesson opens with the question as it could be printed. Cover the rest and attempt it on paper, as in the exam.", r"**先自己做。** 每一课都以题目开头。把后面盖住，像考试那样先在纸上做一遍。"),
                    T(r"**Then read part by part.** Each part teaches the idea it needs from the beginning, then solves it with every line explained; you do the key step.", r"**再一问一问地读。** 每一问先把需要的想法从头讲清，再逐行讲解解法；关键一步由你来做。"),
                    T(r"**Compare with the full-mark answer**, written as you would write it in the exam, with where the marks are.", r"**对照满分答案**，按考试时该写的样子写出，并说明分数在哪里。"),
                    T(r"**The wider topic and your turn**: the twists a paper can add, and new numbers to practise.", r"**这类题的全貌和你来**：卷子可能加的变化，以及换了数的练习。"))),
        ],
    )


PREDICT_LESSONS = [mixed(f) for f in (L_pq_start, L_pq_tax, L_pq_pollution, L_pq_costs, L_pq_pricing, L_pq_oligopoly, L_pq_games, L_pq_growth, L_pq_macro)]
PREDICT_UNIT = T('Predicted exam questions', '预测考题精讲')
