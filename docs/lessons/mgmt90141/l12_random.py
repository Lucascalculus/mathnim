# Lesson 12 (random-variables): the average of an uncertain number and how spread out it is. Decks: W8 (discrete and continuous variables,
# probability distributions, expected value, variance, binomial; automobile sales, job satisfaction, Carolina Industries, Martin Clothing,
# the radar systems). Instrument: dist_lab. Numbers are computed below.
import math
from common import *

SK = 'mg.random-variables'


def stats(xs, f):
    mu = sum(x * p for x, p in zip(xs, f))
    var = sum((x - mu) ** 2 * p for x, p in zip(xs, f))
    return mu, var, math.sqrt(var)


def binom(n, p, x): return math.comb(n, x) * p ** x * (1 - p) ** (n - x)


def L_random():
    xs = [0, 1, 2, 3, 4, 5]; days = [54, 117, 72, 42, 12, 3]; f = [d / 300 for d in days]
    mu, var, sd = stats(xs, f)
    assert round(sum(f), 9) == 1 and round(mu, 9) == 1.5 and round(var, 9) == 1.25 and round(sd, 2) == 1.12 and round(f[3] + f[4] + f[5], 2) == .19
    dem, pr = [300, 400, 500, 600], [.20, .30, .35, .15]
    ed = sum(a * b for a, b in zip(dem, pr)); assert round(ed, 9) == 445 and 445 * 50 - 300 * 70 == 1250
    b3 = [binom(3, .3, x) for x in range(4)]
    assert round(b3[2], 3) == .189 and round(3 * .3, 3) == .9 and round(3 * .3 * .7, 3) == .63 and round(math.sqrt(.63), 2) == .79
    r2, r3 = 1 - binom(2, .9, 0), 1 - binom(3, .9, 0)
    assert round(r2, 4) == .99 and round(r3, 4) == .999
    sen, mid = [.05, .09, .03, .42, .41], [.04, .10, .12, .46, .28]
    assert round(sen[3] + sen[4], 2) == .83 and round(mid[3] + mid[4], 2) == .74
    return dict(
        id=f'{CID}-random-variables',
        title=T('The average of an uncertain number, and how spread out it is', '一个不确定的数的平均值，以及它有多分散'),
        description=T('A random variable puts numbers on what might happen. Balance a distribution on its mean, see why the mean can be a value that never occurs, and then use the binomial for “how many of n succeed”.',
                      '随机变量给可能发生的事配上数字。让一个分布在它的均值上保持平衡，看看为什么均值可以是一个永远不会出现的值，再用二项分布回答“n 次里成功几次”。'),
        minutes=45,
        skills=[{'id': SK, 'name': T('Random variables, expected value, variance and the binomial', '随机变量、期望、方差与二项分布')}],
        misconceptions=[{'id': 'mean-is-likeliest', 'description': T('Treating the expected value as the most likely value', '把期望值当作最可能的值')},
                        {'id': 'binomial-not-independent', 'description': T('Using the binomial when trials are not independent or p changes', '试验不独立或 p 会变时还用二项分布')},
                        {'id': 'at-least-one', 'description': T('Computing “at least one” by adding many terms instead of one minus none', '算“至少一次”时加很多项，而不是用 1 减去“一次也没有”')}],
        steps=[
            read('bars', T('Weighing a distribution', '给分布称重'),
                 p(T(r"A car agency recorded 300 days. On 54 of them no car was sold, on 117 one car, on 72 two, on 42 three, on 12 four and on 3 days five. Let $x$ be the cars sold on a day: a **random variable** (a number decided by chance). The bar at each value is its probability $f(x)$ (the days divided by 300). The red triangle marks the **mean**: the balance point of the bars.", r"一家汽车经销店记录了 300 天。其中 54 天一辆也没卖出，117 天卖了一辆，72 天两辆，42 天三辆，12 天四辆，3 天五辆。设 $x$ 是一天卖出的汽车数：这是一个**随机变量**（由偶然决定的数）。每个取值上的柱子是它的概率 $f(x)$（天数除以 300）。红三角标出**均值**：这些柱子的平衡点。")),
                 frame('dist_lab.html', T('The distribution of cars sold per day as bars, with its mean as the balance point.', '每天卖出汽车数的分布（柱状），均值是平衡点。'),
                       caption=T(r"Drag a bar up or down (or use the arrow keys): the balance point and the table move. The probabilities must add to 1.", r"上下拖动一根柱子（也可以用方向键）：平衡点和表会随之变化。概率之和必须是 1。"),
                       mode='free', xs=xs, probs=[round(v, 4) for v in f], ymax=0.5, xlabel=T('cars sold in a day', '一天卖出的汽车数')),
                 chapter=T('Touch', '动手')),
            choice('predict', T('A mean that never happens', '一个永远不会发生的均值'), SK,
                   T(r"The mean is 1.5 cars a day, but one car a day is the most likely value, and nobody ever sells 1.5 cars. Is the mean wrong?", r"均值是每天 1.5 辆，但最可能的值是一天一辆，而且谁也不会卖出 1.5 辆。均值错了吗？"),
                   [(T(r"No: the mean is the long-run average (and the balance point), not a value you expect to see on any one day.", r"没错：均值是长期平均值（也是平衡点），不是你预期某一天会看到的值。"), True),
                    (T(r"Yes: a mean must be a possible value.", r"错了：均值必须是一个可能的取值。"), T(r"Average family size 2.3 children is the same idea.", r"平均每个家庭 2.3 个孩子也是同样的道理。"), 'mean-is-likeliest'),
                    (T(r"The mean should equal the most likely value.", r"均值应该等于最可能的值。"), T(r"That holds only for symmetric shapes; here the long tail on the right pulls the mean up.", r"只有对称的形状才这样；这里右边的长尾把均值拉高了。"), 'mean-is-likeliest')],
                   T(r"Expected value: what you would average over very many days.", r"期望值：非常多天里你会得到的平均数。")),
            read('name', T('Names and the two formulas', '名字和两个公式'),
                 table([T('Word', '词'), T('Meaning', '意思'), T('Example', '例子')],
                       [T('**Discrete** random variable', '**离散**随机变量'), T('takes separate values (usually whole numbers)', '取一个个分开的值（通常是整数）'), T('cars sold; number defective', '卖出的汽车数；次品数')],
                       [T('**Continuous** random variable', '**连续**随机变量'), T('takes any value in an interval', '在一个区间里取任何值'), T('time between arrivals; ounces in a can', '到达间隔时间；罐里的盎司数')],
                       [T('**Probability function** $f(x)$', '**概率函数** $f(x)$'), T('probability of each value; $f(x) \\ge 0$ and $\\sum f(x) = 1$', '每个取值的概率；$f(x) \\ge 0$ 且 $\\sum f(x) = 1$'), T('$f(1) = 117/300 = 0.39$', '$f(1) = 117/300 = 0.39$')]),
                 math_(r"E(x) = \mu = \sum x\,f(x)\qquad \mathrm{Var}(x) = \sigma^2 = \sum (x - \mu)^2 f(x)\qquad \sigma = \sqrt{\sigma^2}"),
                 p(T(rf"The expected value is the values weighted by their probabilities: $0(0.18) + 1(0.39) + 2(0.24) + 3(0.14) + 4(0.04) + 5(0.01) = 1.5$ cars. The variance weights the squared distances from the mean: $\sigma^2 = {n(var, 2)}$ and $\sigma = {n(sd, 2)}$ cars. (The lecture’s table rounds each term and shows 1.26; the exact value is 1.25.) Compare with the sample formulas of lesson 7: here the whole distribution is known, so there is no $n - 1$. Also: the probability of selling 3 or more is $0.14 + 0.04 + 0.01 = 0.19$.", rf"期望值是各个取值按概率加权：$0(0.18) + 1(0.39) + 2(0.24) + 3(0.14) + 4(0.04) + 5(0.01) = 1.5$ 辆。方差是到均值距离的平方的加权：$\sigma^2 = {n(var, 2)}$，$\sigma = {n(sd, 2)}$ 辆。（课上的表把每一项取了整，得到 1.26；精确值是 1.25。）和第 7 课的样本公式比较：这里整个分布都是已知的，所以没有 $n - 1$。另外：卖出 3 辆及以上的概率是 $0.14 + 0.04 + 0.01 = 0.19$。")),
                 chapter=T('Names', '命名')),
            number('carolina', T('A monthly order', '每月的订货量'), SK,
                   T(r"Carolina Industries’ monthly demand is 300, 400, 500 or 600 units with probabilities 0.20, 0.30, 0.35, 0.15. If it orders the expected demand each month, how many units is that?", r"Carolina Industries 的月需求是 300、400、500 或 600 件，概率分别为 0.20、0.30、0.35、0.15。如果每月按期望需求订货，是多少件？"),
                   445, T(r"$300(0.20) + 400(0.30) + 500(0.35) + 600(0.15) = 60 + 120 + 175 + 90 = 445$ units.", r"$300(0.20) + 400(0.30) + 500(0.35) + 600(0.15) = 60 + 120 + 175 + 90 = 445$ 件。"), tolerance=0.01, purpose='practice'),
            number('carolina2', T('And a bad month', '再看一个坏月份'), SK,
                   T(r"Each unit demanded brings \$70 of revenue and each unit ordered costs \$50. It orders 445 units and demand turns out to be only 300. What is the loss in dollars?", r"每件需求带来 \$70 收入，每件订货花 \$50。订了 445 件，而需求只有 300 件。亏损多少美元？"),
                   1250, T(r"Cost: $445 \times 50 = 22{,}250$. Revenue: $300 \times 70 = 21{,}000$. Loss: $22{,}250 - 21{,}000 = 1{,}250$. The expected value of demand is a fine plan on average and still loses in a bad month.", r"成本：$445 \times 50 = 22{,}250$。收入：$300 \times 70 = 21{,}000$。亏损：$22{,}250 - 21{,}000 = 1{,}250$。按期望需求订货平均来说是好计划，在坏月份仍然会亏。"), tolerance=0.01, unit=T('dollars', '美元'), purpose='practice'),

            read('binomial', T('How many of n succeed: the binomial', 'n 次里成功几次：二项分布'),
                 p(T(r"Some random variables count successes in repeated trials. If there are $n$ identical trials, two outcomes each (success or failure), the same chance $p$ of success every time, and the trials are independent, the count follows the **binomial** distribution:", r"有些随机变量是在重复试验里数成功的次数。如果有 $n$ 次相同的试验，每次两种结果（成功或失败），每次成功的概率都是 $p$，而且各次试验相互独立，那么成功次数服从**二项分布**：")),
                 math_(r"f(x) = \binom{n}{x}\,p^{x}\,(1-p)^{n-x}\qquad E(x) = np\qquad \mathrm{Var}(x) = np(1-p)"),
                 frame('dist_lab.html', T('The binomial distribution with sliders for the number of trials n and the chance of success p.', '二项分布，带有试验次数 n 和成功概率 p 的滑块。'),
                       caption=T(r"A detection system finds an attack with probability 0.9. The green bars are “at least one system detects it”. Slide n and watch P(at least one).", r"一套探测系统发现袭击的概率是 0.9。绿色的柱子是“至少一套系统探测到”。移动 n，看 P(至少一套)。"),
                       mode='binomial', n=2, p=0.9, ymax=1, atleast=True, xlabel=T('systems that detect', '探测到的系统数')),
                 p(T(rf"Martin Clothing: each of the next 3 customers buys with probability 0.3. The chance that exactly 2 buy is $\binom{{3}}{{2}}(0.3)^2(0.7) = 3 \times 0.09 \times 0.7 = {n(b3[2], 3)}$; the mean is $np = 0.9$ customers and the variance $np(1-p) = 0.63$, so $\sigma = 0.79$. “At least one” is the quick one: $1 - $ (none) $= 1 - 0.1^n$: for 2 detection systems $0.99$, for 3 systems $0.999$.", rf"Martin 服装店：接下来 3 位顾客，每位购买的概率是 0.3。恰好 2 位购买的概率是 $\binom{{3}}{{2}}(0.3)^2(0.7) = 3 \times 0.09 \times 0.7 = {n(b3[2], 3)}$；均值是 $np = 0.9$ 位，方差 $np(1-p) = 0.63$，所以 $\sigma = 0.79$。“至少一次”有捷径：$1 - $（一次也没有）$= 1 - 0.1^n$：2 套探测系统是 $0.99$，3 套是 $0.999$。")),
                 chapter=T('Binomial', '二项分布')),
            number('radar3', T('Three radar systems', '三套雷达系统'), SK,
                   T(r"Each detection system finds an attack with probability 0.9, independently. With **three** installed, what is the probability that at least one detects it? (Four decimals.)", r"每套探测系统独立地以 0.9 的概率发现袭击。装**三套**，至少有一套发现的概率是多少？（四位小数）"),
                   round(r3, 4), T(r"The only way to fail is for all three to miss: $0.1^3 = 0.001$, so at least one detects with probability $1 - 0.001 = 0.999$. Two systems give 0.99: yes, recommend multiple systems, because each extra one cuts the chance of missing by a factor of ten.", r"唯一失败的情形是三套都漏掉：$0.1^3 = 0.001$，所以至少一套发现的概率是 $1 - 0.001 = 0.999$。两套是 0.99：是，推荐多套系统，因为每多一套，漏掉的概率就缩小到原来的十分之一。"), tolerance=0.00006, purpose='practice'),
            choice('binom_ok', T('Is it binomial?', '这是二项分布吗？'), SK,
                   T(r"Five cards are drawn **without replacement** from a deck and we count the hearts. Why is this not exactly binomial?", r"从一副牌里**不放回**地抽五张，数红桃的张数。为什么这不完全是二项分布？"),
                   [(T(r"After each card the chance of a heart changes: the trials are not independent and $p$ is not constant.", r"每抽一张，红桃的概率都在变：试验不独立，$p$ 也不是常数。"), True),
                    (T(r"Because there are five trials.", r"因为有五次试验。"), T(r"The number of trials can be anything.", r"试验次数可以是任何数。"), None),
                    (T(r"Because a card is a heart or not: that is three outcomes.", r"因为一张牌要么是红桃，要么不是：那是三种结果。"), T(r"Two outcomes (heart or not) is exactly what the binomial wants.", r"两种结果（红桃或不是）正是二项分布所要求的。"), 'binomial-not-independent')],
                   T(r"Four conditions: identical trials, two outcomes, constant $p$, independence.", r"四个条件：相同的试验、两种结果、$p$ 不变、相互独立。"), purpose='check'),
            read('satisfaction', T('A discrete distribution from percentages', '由百分比得到离散分布'),
                 p(T(r"Job satisfaction scores run from 1 (very dissatisfied) to 5 (very satisfied). Senior IS executives: 5%, 9%, 3%, 42%, 41% for scores 1 to 5. Middle managers: 4%, 10%, 12%, 46%, 28%. Divide the percentages by 100 and each column is a probability distribution (they add to 1). The probability of a score of 4 or 5 is $0.42 + 0.41 = 0.83$ for the executives and $0.46 + 0.28 = 0.74$ for the middle managers: senior executives are more satisfied.", r"工作满意度得分从 1（非常不满）到 5（非常满意）。信息系统高管：得分 1 到 5 的比例分别是 5%、9%、3%、42%、41%。中层经理：4%、10%、12%、46%、28%。把百分比除以 100，每一列就是一个概率分布（和为 1）。得分为 4 或 5 的概率：高管是 $0.42 + 0.41 = 0.83$，中层经理是 $0.46 + 0.28 = 0.74$：高管更满意。")),
                 chapter=T('Use it', '用一用')),
            read('traps', T('Traps', '易错点'),
                 callout('warning', T('Mean is not the likeliest', '均值不是最可能的值'), T(r"The expected value is a weighted average. It need not be a possible value and it need not be the mode.", r"期望值是加权平均数。它不一定是可能的取值，也不一定是众数。")),
                 callout('warning', T('At least one', '至少一次'), T(r"“At least one” $= 1 -$ “none”. One short term instead of $n$ long ones.", r"“至少一次” $= 1 -$ “一次也没有”。一个简单的项，而不是 $n$ 个复杂的项。")),
                 callout('note', T('Population versus sample', '总体与样本'), T(r"For a probability distribution (the whole population) the variance divides by nothing: it is weighted by $f(x)$. The $n - 1$ is only for a sample of data.", r"对概率分布（整个总体），方差不除以任何数：它按 $f(x)$ 加权。$n - 1$ 只用于数据样本。")),
                 chapter=T('Traps', '易错点')),
            choice('recall_cond', T('Recall: conditional probability', '回忆：条件概率'), SK,
                   T(r"“Given B” in $P(A \mid B)$ tells you to divide by:", r"$P(A \mid B)$ 里的“已知 B”要求你除以："),
                   [(T(r"$P(B)$.", r"$P(B)$。"), True), (T(r"$P(A)$.", r"$P(A)$。"), T(r"That would condition on A.", r"那是以 A 为条件。"), 'conditional-reversed'), (T(r"1.", r"1。"), T(r"Only if B is certain.", r"只有当 B 是必然时。"), None)],
                   T(r"Conditioning restricts to B and re-divides by B’s own total.", r"加条件就是把范围缩到 B，再除以 B 自己的总数。"), purpose='check'),
            choice('recall_evsi', T('Recall: EVPI', '回忆：EVPI'), SK,
                   T(r"The expected value (EV) of a decision uses the probabilities of the:", r"一个决策的期望值（EV）用的是以下哪些的概率："),
                   [(T(r"states of nature, weighting each payoff.", r"自然状态，给每个收益加权。"), True), (T(r"alternatives, because we choose them.", r"各个方案，因为是我们选的。"), T(r"We choose an alternative; chance picks the state.", r"方案是我们选的；状态是偶然决定的。"), 'evpi-vs-ev'), (T(r"payoffs, summing to 1.", r"收益，加起来是 1。"), T(r"Payoffs are values, not probabilities.", r"收益是数值，不是概率。"), None)],
                   T(r"EV = payoffs weighted by the probabilities of the states.", r"EV = 按各状态的概率加权的收益。"), purpose='check'),
        ],
    )
