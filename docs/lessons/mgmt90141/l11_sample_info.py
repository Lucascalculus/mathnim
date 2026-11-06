# Lesson 11 (sample-info): how to change your mind when the test comes back. Decks: W6 (sample information, Bayes' theorem and the tree flip,
# decision tree and rollback, EVSI, risk profile; PDC, Lin's land). Exam: 2025 Q4(iii)-(v), 21 marks. Instruments: bayes_flip, tree_roll.
# Numbers are computed below. Posteriors are rounded to two places before they are used in the tree, as the paper's answer does.
from common import *

SK = 'mg.sample-info'


def L(v): return dict(k='leaf', value=v)
def CH(label, kids): return dict(k='chance', l=label, c=kids)
def DE(label, kids): return dict(k='decision', l=label, c=kids)
def E(node, en, zh, p=None):
    node['e'] = T(en, zh)
    if p is not None: node['p'] = p
    return node


def posterior(prior, lik):
    """lik[s] is P(report | s) for one report. Returns (P(report), [P(s | report)])."""
    joint = [pr * l for pr, l in zip(prior, lik)]
    tot = sum(joint)
    return tot, [j / tot for j in joint]


def L_sample_info():
    # --- PDC: strong 0.8, weak 0.2; report F|strong 0.90, F|weak 0.25
    prior = [.8, .2]
    pF, postF = posterior(prior, [.9, .25])
    pU, postU = posterior(prior, [.1, .75])
    assert round(pF, 4) == .77 and round(pU, 4) == .23 and [round(x, 2) for x in postF] == [.94, .06] and [round(x, 2) for x in postU] == [.35, .65]
    V = [[8, 7], [14, 5], [20, -9]]
    ev2 = lambda post, i: round(post[0], 2) * V[i][0] + round(post[1], 2) * V[i][1]
    efs = [ev2(postF, i) for i in range(3)]
    eus = [ev2(postU, i) for i in range(3)]
    assert [round(x, 2) for x in efs] == [7.94, 13.46, 18.26] and [round(x, 2) for x in eus] == [7.35, 8.15, 1.15]
    ev_c = .77 * max(efs) + .23 * max(eus)
    assert round(ev_c, 2) == 15.93
    evsi = ev_c - 14.2
    efficiency = evsi / 3.2
    ev_c_exact = pF * max(sum(x * v for x, v in zip(postF, V[i])) for i in range(3)) + pU * max(sum(x * v for x, v in zip(postU, V[i])) for i in range(3))
    pdc_tree = DE(T('Research?', '做不做调研？'), [
        E(CH(T('Conduct the study', '做调研'), [
            E(DE(T('Report favourable', '报告有利'), [E(CH('', [E(L(8), 'Strong', '强', .94), E(L(7), 'Weak', '弱', .06)]), 'Small', '小'), E(CH('', [E(L(14), 'Strong', '强', .94), E(L(5), 'Weak', '弱', .06)]), 'Medium', '中'), E(CH('', [E(L(20), 'Strong', '强', .94), E(L(-9), 'Weak', '弱', .06)]), 'Large', '大')]), 'Favourable', '有利', .77),
            E(DE(T('Report unfavourable', '报告不利'), [E(CH('', [E(L(8), 'Strong', '强', .35), E(L(7), 'Weak', '弱', .65)]), 'Small', '小'), E(CH('', [E(L(14), 'Strong', '强', .35), E(L(5), 'Weak', '弱', .65)]), 'Medium', '中'), E(CH('', [E(L(20), 'Strong', '强', .35), E(L(-9), 'Weak', '弱', .65)]), 'Large', '大')]), 'Unfavourable', '不利', .23)]), 'Conduct', '做调研'),
        E(DE(T('No study', '不做调研'), [E(CH('', [E(L(8), 'Strong', '强', .8), E(L(7), 'Weak', '弱', .2)]), 'Small', '小'), E(CH('', [E(L(14), 'Strong', '强', .8), E(L(5), 'Weak', '弱', .2)]), 'Medium', '中'), E(CH('', [E(L(20), 'Strong', '强', .8), E(L(-9), 'Weak', '弱', .2)]), 'Large', '大')]), 'No study', '不做')])
    roll(pdc_tree, 'max')
    assert round(pdc_tree['v'], 2) == 15.93 and pdc_tree['best'] == 0
    # --- the exam: weather reports for the expressway
    pr = [.85, .15]
    lk = {'C': [.8, .1], 'O': [.2, .3], 'R': [0, .6]}
    post, pw = {}, {}
    for w, l in lk.items():
        pw[w], post[w] = posterior(pr, l)
    assert [round(pw[w], 3) for w in 'COR'] == [.695, .215, .09]
    assert [round(post['C'][0], 2), round(post['O'][0], 2), post['R'][0]] == [.98, .79, 0]
    q = {w: [round(x, 2) for x in post[w]] for w in 'COR'}
    ev_ew = {w: q[w][0] * 25 + q[w][1] * 45 for w in 'COR'}
    ev_qc = 30
    assert [round(ev_ew[w], 1) for w in 'COR'] == [25.4, 29.2, 45.0]
    choose = {w: ('EW' if ev_ew[w] < ev_qc else 'QC') for w in 'COR'}
    assert choose == {'C': 'EW', 'O': 'EW', 'R': 'QC'}
    total = sum(pw[w] * min(ev_ew[w], ev_qc) for w in 'COR')
    assert round(total, 1) == 26.6
    def weather(code, en, zh):
        qq = q[code]
        return E(DE('', [E(CH('', [E(L(30), 'Open', '畅通', qq[0]), E(L(30), 'Jammed', '堵车', qq[1])]), 'QC', 'QC'), E(CH('', [E(L(25), 'Open', '畅通', qq[0]), E(L(45), 'Jammed', '堵车', qq[1])]), 'EW', 'EW')]), en, zh, round(pw[code], 3))
    exam_tree = CH(T('Weather', '天气'), [weather('C', 'Clear', '晴'), weather('O', 'Overcast', '阴'), weather('R', 'Rain', '雨')])
    roll(exam_tree, 'min')
    assert round(exam_tree['v'], 1) == 26.6
    # --- Lin's land
    pL = [.25, .30, .45]
    fL = [.85, .5, .15]
    pFL, postFL = posterior(pL, fL)
    pUL, postUL = posterior(pL, [1 - x for x in fL])
    VL = {'corn': [30, 0, -35], 'soy': [10, 0, -5]}
    evL = lambda post: {k: sum(a * b for a, b in zip(post, v)) for k, v in VL.items()}
    EL0, ELF, ELU = evL(pL), evL(postFL), evL(postUL)
    best0 = max(max(EL0.values()), 5)
    bestF, bestU = max(max(ELF.values()), 5), max(max(ELU.values()), 5)
    ev_withL = pFL * bestF + pUL * bestU
    evsiL = ev_withL - best0
    assert best0 == 5 and bestF == ELF['corn'] and bestU == 5
    return dict(
        id=f'{CID}-sample-info',
        title=T('How to change your mind when the test comes back', '检测结果回来后，怎样改变看法'),
        description=T('A test result does not tell you the state; it moves the odds. Count 1000 cases to see why “90% reliable” does not mean “90% sure”, then do the exam’s weather question, draw its tree and roll it back to the best strategy.',
                      '检测结果不会告诉你状态，它只是移动了概率。数 1000 个样本，看清为什么“可靠率 90%”不等于“有 90% 把握”，再做考试里的天气题，画出它的树，倒推出最优策略。'),
        minutes=65,
        skills=[{'id': SK, 'name': T('Bayes’ theorem, decision trees and the value of sample information', '贝叶斯定理、决策树和样本信息的价值')}],
        misconceptions=[{'id': 'posterior-is-likelihood', 'description': T('Reading P(report | state) as P(state | report)', '把 P(报告 | 状态) 当成 P(状态 | 报告)')},
                        {'id': 'wrong-denominator', 'description': T('Dividing by the wrong total instead of the sum of the joint probabilities', '除以错误的总数，而不是联合概率之和')},
                        {'id': 'tree-forward', 'description': T('Choosing the best branch at each node going left to right, instead of rolling back from the payoffs', '从左往右在每个节点选最好的分支，而不是从收益倒推回来')}],
        steps=[
            read('flip', T('Counting a thousand cases', '数一千个样本'),
                 p(T(r"PDC can pay for a market study. The study is *usually* right: if demand really is strong, the report is favourable 90% of the time; if demand is weak, it is favourable 25% of the time (a false alarm). Before the study PDC thinks strong demand has probability 0.8. Suppose the report arrives **favourable**. How likely is strong demand now?", r"PDC 可以花钱做一次市场调研。调研*通常*是对的：需求确实强时，报告有 90% 的概率有利；需求弱时，也有 25% 的概率有利（误报）。调研之前，PDC 认为需求强的概率是 0.8。假设报告来了，结果**有利**。现在需求强的可能性有多大？")),
                 frame('bayes_flip.html', T('1000 imaginary cases split by the true state and the report; the chosen report is dark.', '1000 个假想的样本，按真实状态和报告分开；选中的报告是深色。'),
                       caption=T(r"Choose the report. Count the dark dots: how many are strong demand? Move the three sliders and watch the table.", r"选一种报告。数一数深色的点：多少是需求强？移动三个滑块，看表怎么变。"),
                       states=[T('Strong demand', '需求强'), T('Weak demand', '需求弱')], reports=[T('Favourable', '有利'), T('Unfavourable', '不利')], prior=prior, lik=[[.9, .1], [.25, .75]], sliders=True),
                 chapter=T('Touch', '动手')),
            choice('predict', T('How sure now?', '现在有多大把握？'), SK,
                   T(r"The report is favourable. The study is favourable 90% of the time when demand is strong. Is the probability of strong demand now 0.90?", r"报告有利。需求强时调研有 90% 的概率有利。现在需求强的概率就是 0.90 吗？"),
                   [(T(rf"No: it is {postF[0]:.3f}. Of 770 favourable reports, 720 come from strong demand and 50 from weak demand (false alarms).", rf"不是：是 {postF[0]:.3f}。770 个有利报告里，720 个来自需求强，50 个来自需求弱（误报）。"), True),
                    (T(r"Yes: a study that is right 90% of the time gives 90% confidence.", r"是：90% 正确的调研就给出 90% 的把握。"), T(r"“90%” is how often the report is favourable *given* strong demand. We want it the other way round: strong demand given a favourable report. They are different numbers.", r"“90%”是*在需求强时*报告有利的频率。我们要的正好反过来：报告有利时需求强的概率。两者是不同的数。"), 'posterior-is-likelihood'),
                    (T(r"No: it is still 0.80, a report changes nothing.", r"不是：仍然是 0.80，报告什么也改变不了。"), T(r"The report moves the odds, here upward, because strong demand makes a favourable report likelier.", r"报告会移动概率，这里是向上，因为需求强让有利报告更可能出现。"), None)],
                   T(r"Flipping the condition needs the whole picture: how many of **all** favourable reports are true ones. That is Bayes’ theorem.", r"把条件反过来，需要看全局：**所有**有利报告里有多少是真的。这就是贝叶斯定理。")),
            read('name', T('Bayes’ theorem in three steps', '贝叶斯定理，三步'),
                 p(T(r"You know the *prior* $P(s_j)$ (before the test) and the *likelihood* $P(\text{report} \mid s_j)$ (how the test behaves in each state). You want the *posterior* $P(s_j \mid \text{report})$. Make a table with one row per state:", r"你知道*先验* $P(s_j)$（检测之前），也知道*似然* $P(\text{报告} \mid s_j)$（检测在每种状态下怎么表现）。你要的是*后验* $P(s_j \mid \text{报告})$。画一张表，每个状态一行：")),
                 table([T('State', '状态'), T('Prior', '先验'), T('P(Favourable | state)', 'P(有利 | 状态)'), T('Joint', '联合'), T('Posterior', '后验')],
                       [T('Strong', '强'), '0.8', '0.90', '$0.8 \\times 0.90 = 0.72$', '$0.72 / 0.77 = 0.94$'],
                       [T('Weak', '弱'), '0.2', '0.25', '$0.2 \\times 0.25 = 0.05$', '$0.05 / 0.77 = 0.06$'],
                       [T('Total', '合计'), '1', '', '$P(F) = 0.77$', '1']),
                 ol(T(r"**Joint** = prior × likelihood, row by row.", r"**联合** = 先验 × 似然，逐行算。"), T(r"**Add** the joints: that total is $P(\text{report})$, the probability of seeing this report at all.", r"把联合概率**加起来**：这个总数就是 $P(\text{报告})$，也就是看到这种报告的概率。"), T(r"**Divide** each joint by that total: the posteriors, which add to 1.", r"用这个总数去**除**每个联合概率：得到后验，它们加起来是 1。")),
                 math_(r"P(s_j \mid F) = \frac{P(F \mid s_j)\,P(s_j)}{\sum_k P(F \mid s_k)\,P(s_k)}"),
                 callout('warning', T('The denominator', '分母'), T(r"The denominator is the **sum of the joint probabilities** (here 0.72 + 0.05), not the prior and not the likelihood. Using the wrong one is the commonest mistake.", r"分母是**联合概率之和**（这里是 0.72 + 0.05），不是先验，也不是似然。用错分母是最常见的错误。")),
                 chapter=T('Names', '命名')),
            number('pu', T('The other report', '另一种报告'), SK,
                   T(r"With the same study, what is the probability P(unfavourable) of an unfavourable report? (Joint probabilities: strong $0.8 \times 0.10$, weak $0.2 \times 0.75$.)", r"同一个调研，不利报告出现的概率 P(不利) 是多少？（联合概率：强 $0.8 \times 0.10$，弱 $0.2 \times 0.75$。）"),
                   round(pU, 2), T(r"$0.8 \times 0.10 + 0.2 \times 0.75 = 0.08 + 0.15 = 0.23$. The two reports’ probabilities must add to 1: $0.77 + 0.23$.", r"$0.8 \times 0.10 + 0.2 \times 0.75 = 0.08 + 0.15 = 0.23$。两种报告的概率必须加起来是 1：$0.77 + 0.23$。"), tolerance=0.005, purpose='practice'),

            read('exam3', T('The exam’s version: the weather', '考试里的版本：天气'),
                 p(T(r"Back to Rona and Jerry. Weather is the “test”: it does not decide whether the expressway is jammed, but it shifts the odds. The prior is 0.85 for open, 0.15 for jammed. The new information is how the weather behaves in each state, and there are **three** reports (clear, overcast, rain) instead of two, so the table has three blocks.", r"回到 Rona 和 Jerry。天气就是这里的“检测”：它不决定高速公路堵不堵，但会改变概率。先验是畅通 0.85、堵车 0.15。新信息是天气在每种状态下怎么表现，而且有**三种**报告（晴、阴、雨）而不是两种，所以表有三块。")),
                 paper(T('Question 4 (iii) · 6 marks', '第 4 题 (iii) · 6 分'),
                       *ptxt("In addition, they agreed that weather seemed to affect the traffic conditions on the expressway. Let C = clear; O = overcast; R = rain. The following conditional probabilities apply: P(C | s1) = 0.8, P(O | s1) = 0.2, P(R | s1) = 0.0; P(C | s2) = 0.1, P(O | s2) = 0.3, P(R | s2) = 0.6. (s1: the expressway is open; s2: it is jammed.)\n(iii) Apply the Bayes’ Theorem to compute joint probabilities and posterior probabilities. (6 marks)",
                             "此外，他们认为天气似乎会影响高速公路上的交通状况。设 C = 晴；O = 阴；R = 雨。条件概率如下：P(C | s1) = 0.8，P(O | s1) = 0.2，P(R | s1) = 0.0；P(C | s2) = 0.1，P(O | s2) = 0.3，P(R | s2) = 0.6。（s1：高速公路畅通；s2：堵车。）\n(iii) 应用贝叶斯定理计算联合概率和后验概率。（6 分）")),
                 frame('bayes_flip.html', T('The three weather reports of the carpool problem, with the table of joint and posterior probabilities for the report you choose.', '拼车问题的三种天气报告，以及你选中的报告的联合概率和后验概率表。'),
                       caption=T(r"Choose each report in turn: the table is what the exam asks you to write, one block per report.", r"依次选每种报告：这张表就是考试要你写的，每种报告一块。"),
                       states=[T('Open', '畅通'), T('Jammed', '堵车')], reports=[T('Clear', '晴'), T('Overcast', '阴'), T('Rain', '雨')], prior=pr, lik=[lk['C'][:1] + lk['O'][:1] + lk['R'][:1], lk['C'][1:] + lk['O'][1:] + lk['R'][1:]]),
                 chapter=T('On the paper', '考卷上')),
            derive('q4iii', T('(iii): joint and posterior probabilities', '(iii)：联合概率和后验概率'),
                   [(r"P(C \cap s_1) = 0.85 \times 0.8 = 0.68,\quad P(C \cap s_2) = 0.15 \times 0.1 = 0.015", T(r"Joint probabilities for a clear day: prior times likelihood, one for each state.", r"晴天的联合概率：先验乘似然，每个状态一个。")),
                    (r"P(C) = 0.68 + 0.015 = 0.695", T(r"Add them: the probability of a clear day.", r"加起来：晴天的概率。")),
                    (r"P(s_1 \mid C) = 0.68 / 0.695 = 0.98,\quad P(s_2 \mid C) = 0.02", T(r"Posteriors: each joint divided by that total. Given a clear day the expressway is very likely open.", r"后验：每个联合概率除以这个总数。晴天时高速公路很可能畅通。")),
                    (r"P(O) = 0.17 + 0.045 = 0.215,\quad P(s_1 \mid O) = 0.79,\ P(s_2 \mid O) = 0.21", T(r"Overcast: joints $0.85 \times 0.2 = 0.17$ and $0.15 \times 0.3 = 0.045$, then the same two steps.", r"阴天：联合概率 $0.85 \times 0.2 = 0.17$ 和 $0.15 \times 0.3 = 0.045$，再做同样的两步。")),
                    (r"P(R) = 0 + 0.09 = 0.09,\quad P(s_1 \mid R) = 0,\ P(s_2 \mid R) = 1", T(r"Rain: it never rains when the expressway is open ($P(R \mid s_1) = 0$), so rain means a jam for certain.", r"雨天：高速公路畅通时从不下雨（$P(R \mid s_1) = 0$），所以下雨就一定堵车。"))],
                   outro=T(r"**Answer:** $P(C) = 0.695$, $P(O) = 0.215$, $P(R) = 0.09$ (they add to 1), with the posteriors above.", r"**答案：** $P(C) = 0.695$、$P(O) = 0.215$、$P(R) = 0.09$（加起来是 1），后验如上。"),
                   blank=(2, '0.98', T(r"$0.68 / 0.695$, two decimals.", r"$0.68 / 0.695$，两位小数。")), skill=SK),

            read('q4iv', T('(iv): drawing the tree', '(iv)：画决策树'),
                 p(T(r"A decision tree reads left to right in time order. A **square** is a choice you make, a **circle** is something that happens to you. Here the weather comes first (circle), then Rona and Jerry choose a route (square), then the traffic (circle) with the **posterior** probabilities for that weather, then the minutes.", r"决策树按时间顺序从左往右读。**方块**是你的选择，**圆圈**是发生在你身上的事。这里先是天气（圆圈），然后 Rona 和 Jerry 选路线（方块），再是交通状况（圆圈），用的是那种天气下的**后验**概率，最后是分钟数。")),
                 paper(T('Question 4 (iv) · 5 marks', '第 4 题 (iv) · 5 分'), T('(iv) Draw a decision tree for this problem. (5 marks)', '(iv) 为这个问题画决策树。（5 分）')),
                 visual('mgmt_tree', T(r"The answer to (iv), drawn in time order: the weather, then the route, then the traffic with that weather’s posterior, then the minutes. QC = Queen City Avenue, EW = expressway.", r"(iv) 的答案，按时间顺序画出：先天气，再路线，再是带着该天气后验概率的路况，最后是分钟数。QC = Queen City 大道，EW = 高速公路。"),
                        explore=False, tree='carpool', story='draw'),
                 callout('note', T('What earns the five marks', '这五分怎么拿'), T(r"Correct shapes and order (weather first, then the choice, then the traffic), the branch labels, the probabilities on the chance branches (0.695, 0.215, 0.09 and the posteriors), the payoffs at the ends. Every chance node’s probabilities must add to 1.", r"形状和顺序正确（先天气，再选择，再路况）、分支标注、机会分支上的概率（0.695、0.215、0.09 和各后验）、末端的收益。每个机会节点的概率加起来必须是 1。")),
                 chapter=T('On the paper', '考卷上')),
            read('q4v', T('(v): rolling the tree back', '(v)：把树倒推回来'),
                 p(T(r"The tree is solved from the **right**, because the choices on the left depend on what the choices on the right are worth. At a circle, take the expected value of what follows. At a square, take the better branch (here the smaller time).", r"这棵树要从**右边**往左解，因为左边的选择取决于右边的选择值多少。在圆圈处，取后面各分支的期望值。在方块处，取较好的分支（这里是较小的时间）。")),
                 paper(T('Question 4 (v) · 10 marks', '第 4 题 (v) · 10 分'), T('(v) What is the optimal decision strategy, and what is the expected travel time? (10 marks)', '(v) 最优决策策略是什么？期望行程时间是多少？（10 分）')),
                 visual('mgmt_tree', T(r"Rolled back from the payoffs: into a circle, probability × minutes, added up; into a square, the routes’ times, the smaller kept and the other cut. The slider is P(open | overcast), the probability in violet.", r"从收益倒推回来：进圆圈的是概率 × 分钟，加起来；进方块的是两条路线的时间，留下较小的，另一条划掉。滑块是 P(畅通 | 阴)，也就是紫色的那个概率。"),
                        tree='carpool'),
                 p(T(r"Now the same rollback by hand, as the exam wants it written: type each node’s value, and for each square pick the branch.", r"现在亲手把同样的倒推做一遍，按考试要的写法：填每个节点的值，每个方块点出选的那条分支。")),
                 frame('tree_roll.html', T('The carpool tree: fill in the expected time at every node and mark the better route at every square.', '拼车的决策树：填每个节点的期望时间，并在每个方块处标出更好的路线。'),
                       caption=T(r"Work from the right. A circle: probability × minutes, added up. A square: the smaller of its branches’ values.", r"从右边做起。圆圈：概率 × 分钟，再加起来。方块：各分支的值里较小的那个。"),
                       tree=exam_tree, sense='min', unit=''),
                 chapter=T('On the paper', '考卷上')),
            derive('q4v_worked', T('(v), worked', '(v)：完整解法'),
                   [(r"EV(\text{EW} \mid C) = 0.98(25) + 0.02(45) = 25.4,\quad EV(\text{QC} \mid C) = 30", T(r"Clear day: expressway versus Queen City Avenue, each with the posterior probabilities of a clear day.", r"晴天：高速公路对 Queen City 大道，各用晴天的后验概率。")),
                    (r"EV(\text{EW} \mid O) = 0.79(25) + 0.21(45) = 29.2,\quad EV(\text{QC} \mid O) = 30", T(r"Overcast: the expressway is still a little faster on average.", r"阴天：高速公路平均仍然快一点。")),
                    (r"EV(\text{EW} \mid R) = 0(25) + 1(45) = 45,\quad EV(\text{QC} \mid R) = 30", T(r"Rain: a jam is certain, so the expressway takes 45 and Queen City Avenue 30.", r"雨天：一定堵车，高速公路 45 分钟，Queen City 大道 30 分钟。")),
                    (r"C \to \text{EW},\quad O \to \text{EW},\quad R \to \text{QC}", T(r"The strategy: at each square, the branch with the smaller expected time.", r"策略：在每个方块处，选期望时间较小的分支。")),
                    (r"0.695(25.4) + 0.215(29.2) + 0.09(30) = 26.6", T(r"The expected travel time of the whole strategy: the root circle, weather probabilities times the value of the best choice for each weather.", r"整个策略的期望行程时间：根上的圆圈，天气概率乘以每种天气下最好选择的值。"))],
                   outro=T(r"**Answer:** expressway if it is clear or overcast, Queen City Avenue if it rains; expected travel time 26.6 minutes (against 28 without the weather: the weather is worth 1.4 minutes).", r"**答案：** 晴天或阴天走高速公路，下雨走 Queen City 大道；期望行程时间 26.6 分钟（不看天气是 28 分钟：天气值 1.4 分钟）。"),
                   blank=(4, '26.6', T(r"$0.695(25.4) + 0.215(29.2) + 0.09(30)$, one decimal.", r"$0.695(25.4) + 0.215(29.2) + 0.09(30)$，一位小数。")), skill=SK),
            read('answer', T('The full-mark answers, as they are written', '满分答案，写在卷子上是这样'),
                 paper(T('Question 4 (iii) and (v), full marks', '第 4 题 (iii)(v)，满分写法'),
                       *ptxt("(iii) Joint: P(C ∩ s1) = 0.85 × 0.8 = 0.68; P(C ∩ s2) = 0.15 × 0.1 = 0.015; P(O ∩ s1) = 0.17; P(O ∩ s2) = 0.045; P(R ∩ s1) = 0; P(R ∩ s2) = 0.09.\nP(C) = 0.695; P(O) = 0.215; P(R) = 0.09.\nPosterior: P(s1 | C) = 0.98, P(s2 | C) = 0.02; P(s1 | O) = 0.79, P(s2 | O) = 0.21; P(s1 | R) = 0, P(s2 | R) = 1.\n(v) EV(EW | clear) = 25.4 and EV(QC | clear) = 30: Expressway. EV(EW | overcast) = 29.2 and EV(QC | overcast) = 30: Expressway. EV(EW | rain) = 45 and EV(QC | rain) = 30: Queen City.\nStrategy: if clear or overcast, take the expressway; if rain, take Queen City Avenue.\nExpected travel time = 0.695(25.4) + 0.215(29.2) + 0.09(30) = 26.6 minutes.",
                             "(iii) 联合概率：P(C ∩ s1) = 0.85 × 0.8 = 0.68；P(C ∩ s2) = 0.15 × 0.1 = 0.015；P(O ∩ s1) = 0.17；P(O ∩ s2) = 0.045；P(R ∩ s1) = 0；P(R ∩ s2) = 0.09。\nP(C) = 0.695；P(O) = 0.215；P(R) = 0.09。\n后验概率：P(s1 | C) = 0.98，P(s2 | C) = 0.02；P(s1 | O) = 0.79，P(s2 | O) = 0.21；P(s1 | R) = 0，P(s2 | R) = 1。\n(v) EV(EW | 晴) = 25.4，EV(QC | 晴) = 30：高速公路。EV(EW | 阴) = 29.2，EV(QC | 阴) = 30：高速公路。EV(EW | 雨) = 45，EV(QC | 雨) = 30：Queen City。\n策略：晴天或阴天走高速公路；下雨走 Queen City 大道。\n期望行程时间 = 0.695(25.4) + 0.215(29.2) + 0.09(30) = 26.6 分钟。"), answer=True),
                 callout('note', T('Rounding', '取整'), T(r"The paper’s answer rounds the posteriors to two decimals before using them (0.98, not 0.9784). Unrounded gives 25.43 for the first EV and 26.63 overall: the same answer to one decimal. Say which you used and keep at least two decimals in the middle of the working.", r"标准答案先把后验取到两位小数再用（0.98，不是 0.9784）。不取整得第一个 EV 是 25.43，总体是 26.63：保留一位小数结果相同。要写明你用的是哪种，中间过程至少保留两位小数。")),
                 chapter=T('The answer', '答案')),

            read('pdc', T('The same method with a research decision: PDC', '同样的方法，加上“要不要调研”：PDC'),
                 p(T(r"Now add the first decision: pay for the market study, or not? Roll back the tree: the study’s two reports (probabilities 0.77 and 0.23) each lead to a choice of size, and the no-study branch is the plain EV of the last lesson (14.2).", r"现在加上第一个决策：付费做市场调研，还是不做？把树倒推回来：调研的两种报告（概率 0.77 和 0.23）各自通向一个规模的选择，不做调研的分支就是上一课的普通 EV（14.2）。")),
                 frame('tree_roll.html', T('PDC’s tree with the study: roll it back from the payoffs.', '带调研的 PDC 决策树：从收益往左倒推。'),
                       caption=T(r"Posteriors rounded to two decimals, as in the lecture.", r"后验概率取两位小数，和课上一致。"), tree=pdc_tree, sense='max', unit='$'),
                 p(T(r"Rolled back, the study is worth having: 15.93 with it against 14.2 without. But that rests on how much a favourable report can be trusted, P(strong | favourable) = 0.94. How far can it fall before paying for the study is a mistake?", r"倒推下来，调研值得做：做是 15.93，不做是 14.2。但这取决于有利报告有多可信，也就是 P(需求强 | 有利) = 0.94。它降到多少，花钱做调研就不划算了？")),
                 visual('mgmt_tree', T(r"PDC rolled back. The slider is P(strong | favourable), in violet on the three branches it sets.", r"倒推后的 PDC 决策树。滑块是 P(需求强 | 有利)，就是三条分支上紫色的那个概率。"),
                        tree='pdc'),
                 quiz(T(r"Below about which value of P(strong | favourable) should PDC stop paying for the study?", r"P(需求强 | 有利) 大约低于多少时，PDC 就不该再花钱做调研了？"),
                      [(T('0.50', '0.50'), T(r"Much earlier than that: watch the root’s square as the slider comes down from 0.94.", r"比这早得多：把滑块从 0.94 往下拉，盯着根部的方块。")),
                       (T('0.70', '0.70'), T(r"At 0.70 a favourable report no longer justifies the large complex, but the study stopped paying earlier: the root’s square already cut it.", r"到 0.70，有利报告已经撑不起大型方案了；但调研更早就不划算了：根部的方块早已把它划掉。")),
                       (T('0.86', '0.86'), True)],
                      T(r"With the study, PDC expects $0.77 \times (20q - 9(1-q)) + 0.23 \times 8.15$ (large after a favourable report). That falls under the 14.2 of no study when $q$ drops below about 0.86: a study is only worth what its reports can be trusted for.", r"做调研时，PDC 的期望是 $0.77 \times (20q - 9(1-q)) + 0.23 \times 8.15$（报告有利时建大型）。$q$ 降到大约 0.86 以下，它就低于不做调研的 14.2：调研的价值，取决于它的报告有多可信。")),
                 chapter=T('The study', '调研')),
            number('evsi', T('What the study is worth', '调研值多少钱'), SK,
                   T(r"The best EV with the study is 15.93 and without it 14.2 (million dollars). What is EVSI, the expected value of sample information?", r"做调研的最好 EV 是 15.93，不做是 14.2（百万美元）。EVSI，也就是样本信息的期望值，是多少？"),
                   round(evsi, 2), T(rf"EVSI $= 15.93 - 14.2 = 1.73$ million: PDC should pay up to \$1.73 million for the study. With unrounded probabilities the study’s EV is {n(ev_c_exact, 2)} and EVSI {n(ev_c_exact - 14.2, 2)}: say which you used. Efficiency of the information is EVSI / EVPI $= 1.73 / 3.2 = {n(100 * efficiency, 0)}\%$: this study delivers about that share of what a perfect forecast would.", rf"EVSI $= 15.93 - 14.2 = 1.73$ 百万：PDC 为这次调研最多该付 \$173 万。用不取整的概率，做调研的 EV 是 {n(ev_c_exact, 2)}、EVSI 是 {n(ev_c_exact - 14.2, 2)}：要写明用的哪种。信息的效率是 EVSI / EVPI $= 1.73 / 3.2 = {n(100 * efficiency, 0)}\%$：这次调研带来的价值大约是完美预测的这个比例。"), tolerance=0.12, unit=T('million dollars', '百万美元'), purpose='practice'),
            read('risk', T('A risk profile', '风险轮廓'),
                 p(T(r"The expected value hides the spread. The **risk profile** of a strategy lists each possible payoff with its probability, found by multiplying along the branches. For PDC’s best strategy (study; large if favourable, medium if not):", r"期望值把波动藏起来了。一个策略的**风险轮廓**列出每个可能的收益和它的概率，沿着分支把概率乘起来得到。对 PDC 的最优策略（调研；报告有利建大型，不利建中型）：")),
                 table([T('Payoff (\\$ millions)', '收益（百万美元）'), T('How it happens', '怎么发生的'), T('Probability', '概率')],
                       ['20', T('favourable, then strong demand', '报告有利，需求强'), '$0.77 \\times 0.94 = 0.72$'],
                       ['−9', T('favourable, then weak demand', '报告有利，需求弱'), '$0.77 \\times 0.06 = 0.05$'],
                       ['14', T('unfavourable, then strong demand', '报告不利，需求强'), '$0.23 \\times 0.35 = 0.08$'],
                       ['5', T('unfavourable, then weak demand', '报告不利，需求弱'), '$0.23 \\times 0.65 = 0.15$'],
                       [T('Total', '合计'), '', '1.00']),
                 p(T(r"The expected value is 15.93, but there is a 5% chance of losing 9 million. A decision maker who cannot take that may prefer a safer strategy even with a lower EV.", r"期望值是 15.93，但有 5% 的概率亏 900 万。承受不了这个的决策者，即使 EV 较低，也可能更喜欢更稳妥的策略。")),
                 chapter=T('Risk', '风险')),
            number('lin', T('Lin’s land: what the broker is worth', 'Lin 的土地：经纪人值多少钱'), SK,
                   T(r"Lin can plant corn (profit \$30,000 if prices go up, 0 if they stay, −\$35,000 if they fall), plant soybeans (10,000, 0, −5,000), or graze (\$5,000 for sure). Prices go up, stay, down with probabilities 0.25, 0.30, 0.45. A broker’s report is favourable with probabilities 0.85, 0.50, 0.15 in those three states. What is EVSI of the broker’s report, in dollars?", r"Lin 可以种玉米（价格涨时赚 \$30,000，不变 0，跌时亏 \$35,000）、种大豆（10,000、0、−5,000），或者放牧（稳赚 \$5,000）。价格上涨、不变、下跌的概率是 0.25、0.30、0.45。经纪人的报告在这三种状态下有利的概率分别是 0.85、0.50、0.15。经纪人报告的 EVSI 是多少美元？"),
                   round(evsiL * 1000, 0), T(rf"Without the report, grazing is best: \$5,000. $P(F) = {n(pFL, 2)}$; given favourable the posteriors are {', '.join(n(x, 3) for x in postFL)} and corn is best with EV \${n(ELF['corn'] * 1000, 0)}; given unfavourable grazing is best (\$5,000). EV with the report $= {n(pFL, 2)}({n(bestF * 1000, 0)}) + {n(pUL, 2)}(5000) = {n(ev_withL * 1000, 0)}$, so EVSI $\approx$ \${n(evsiL * 1000, 0)}.", rf"没有报告时放牧最好：\$5,000。$P(F) = {n(pFL, 2)}$；报告有利时后验是 {', '.join(n(x, 3) for x in postFL)}，种玉米最好，EV \${n(ELF['corn'] * 1000, 0)}；报告不利时放牧最好（\$5,000）。有报告的 EV $= {n(pFL, 2)}({n(bestF * 1000, 0)}) + {n(pUL, 2)}(5000) = {n(ev_withL * 1000, 0)}$，所以 EVSI $\approx$ \${n(evsiL * 1000, 0)}。"),
                   tolerance=30, unit=T('dollars', '美元'), purpose='practice'),

            read('traps', T('Traps', '易错点'),
                 callout('warning', T('Roll back, do not go forward', '倒推，不要顺着选'), T(r"Never pick the best branch at the first square by looking at the first payoff you see. Solve the right-hand end first, then move left.", r"千万别在第一个方块处看到第一个收益就选最好的分支。先解右边的末端，再往左走。")),
                 callout('warning', T('Posterior is not likelihood', '后验不是似然'), T(r"The probabilities on the branches *after* the report are posteriors $P(s \mid \text{report})$; the ones given in the question are likelihoods $P(\text{report} \mid s)$. Mixing them up changes every number after it.", r"报告*之后*的分支上用的是后验 $P(s \mid \text{报告})$；题目里给出的是似然 $P(\text{报告} \mid s)$。搞混了，之后每个数都会错。")),
                 callout('note', T('Check', '自检'), T(r"The posteriors of one report add to 1; the probabilities of the reports add to 1; the overall EV is the weighted average of the nodes to its right.", r"同一种报告下的后验加起来是 1；各种报告的概率加起来是 1；总的 EV 是它右边各节点的加权平均。")),
                 chapter=T('Traps', '易错点')),
            choice('recall_evpi', T('Recall: EVPI and EVSI', '回忆：EVPI 与 EVSI'), SK,
                   T(r"EVPI is 3.2 million; a study’s EVSI is 1.73 million. What does that say?", r"EVPI 是 320 万；一次调研的 EVSI 是 173 万。这说明什么？"),
                   [(T(r"The study is worth less than perfect information, as every real study must be: here about half as much.", r"调研的价值比完全信息小，所有真实的调研都是这样：这里大约一半。"), True),
                    (T(r"The study is worth more than the crystal ball.", r"调研比水晶球更值钱。"), T(r"EVSI can never exceed EVPI.", r"EVSI 永远不会超过 EVPI。"), 'evpi-vs-ev'),
                    (T(r"One of the two numbers must be wrong.", r"两个数里一定有一个错了。"), T(r"They are consistent: EVSI ≤ EVPI.", r"它们是一致的：EVSI ≤ EVPI。"), None)],
                   T(r"EVSI ≤ EVPI always: a real test can only recover part of what certainty is worth.", r"EVSI ≤ EVPI 永远成立：真实的检测只能拿回确定性价值的一部分。"), purpose='check'),
            choice('recall_pattern', T('Recall: which shape', '回忆：哪种形状'), SK,
                   T(r"“If the converter ($A$) is built, the software ($B$) must be built too.” With yes/no variables:", r"“如果建了催化转化器（$A$），软件（$B$）也必须建。”用 0-1 变量表示："),
                   [(r"$y_A \le y_B$", True), (r"$y_A + y_B \le 1$", T(r"That forbids building both.", r"那是禁止两个都建。"), None), (r"$y_A + y_B = 2$", T(r"That forces both to be built.", r"那是强迫两个都建。"), None)],
                   T(r"“A only if B” is $y_A \le y_B$.", r"“只有 B 才 A”就是 $y_A \le y_B$。"), purpose='check'),
        ],
    )
