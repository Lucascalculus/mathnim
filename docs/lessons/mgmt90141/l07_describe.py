# Lesson 7 (describe-data): how to say what a pile of numbers looks like. Decks: W7 (mean, median, mode, percentiles, quartiles, range, IQR,
# variance, standard deviation; bank salaries, graduates' salaries, at-home workers, Dawson and Clark). The paper's formula sheet gives the
# sample variance and standard deviation. Instrument: dot_plot. Numbers are computed below with the course's own percentile rule.
import math
from common import *

SK = 'mg.describe'


def pctl(data, p):
    s = sorted(data); n = len(s); i = p / 100 * n
    return (s[int(i) - 1] + s[int(i)]) / 2 if i == int(i) else s[math.ceil(i) - 1]


def mean(d): return sum(d) / len(d)
def svar(d): m = mean(d); return sum((x - m) ** 2 for x in d) / (len(d) - 1)


def L_describe():
    bank = [50, 25, 20, 80, 20, 30, 4500]
    assert pctl(bank, 50) == 30 and round(mean(bank), 1) == 675.0
    grads = [3450, 3550, 3650, 3480, 3355, 3310, 3490, 3730, 3540, 3925, 3520, 3480]
    assert (mean(grads), pctl(grads, 50), pctl(grads, 25), pctl(grads, 75), pctl(grads, 85)) == (3540, 3505, 3465, 3600, 3730)
    assert sum((x - 3540) ** 2 for x in grads) == 301850
    s_g = math.sqrt(svar(grads))
    daw = [11, 10, 9, 10, 11, 11, 10, 11, 10, 10]; cla = [8, 10, 13, 7, 10, 11, 10, 7, 15, 12]
    assert (round(mean(daw), 6), round(mean(cla), 6)) == (10.3, 10.3) and round(sum((x - 10.3) ** 2 for x in daw), 6) == 4.1 and round(sum((x - 10.3) ** 2 for x in cla), 6) == 60.1
    sd_d, sd_c = math.sqrt(svar(daw)), math.sqrt(svar(cla))
    assert (round(sd_d, 2), round(sd_c, 2)) == (0.67, 2.58) and (pctl(daw, 75) - pctl(daw, 25), pctl(cla, 75) - pctl(cla, 25)) == (1, 4)
    home = [18, 54, 20, 46, 25, 48, 53, 27, 26, 37, 40, 36, 42, 25, 27, 33, 28, 40, 45, 25]
    assert (mean(home), pctl(home, 50), pctl(home, 25), pctl(home, 75), pctl(home, 32)) == (34.75, 34.5, 25.5, 43.5, 27)
    return dict(
        id=f'{CID}-describe-data',
        title=T('How to say what a pile of numbers looks like', '怎样说清一堆数字长什么样'),
        description=T('Two numbers for the middle, two for the spread: the ones that survive an outlier and the ones that do not. Drag dots to see which number moves, then compute them the way the exam expects, with a calculator and the sample formula.',
                      '描述中间的两个数、描述离散程度的两个数：哪些经得起极端值、哪些经不起。拖动圆点，看哪个数在动；然后按考试的要求，用计算器和样本公式算出来。'),
        minutes=45,
        skills=[{'id': SK, 'name': T('Describing data: location and spread', '描述数据：位置与离散程度')}],
        misconceptions=[{'id': 'mean-always', 'description': T('Using the mean to summarise data with an extreme value', '数据里有极端值，还用平均数来概括')},
                        {'id': 'divide-by-n', 'description': T('Dividing the sum of squared deviations by n instead of n − 1 for a sample', '样本方差除以 n 而不是 n − 1')},
                        {'id': 'same-mean-same', 'description': T('Thinking two groups with the same mean are alike', '以为平均数相同的两组就差不多')}],
        steps=[
            read('robust', T('One huge salary', '一份巨大的工资'),
                 p(T(r"A bank has seven staff. Six earn £20k to £80k a year; the seventh, the CEO, earns £4.5 million. The dots are the salaries (in £ thousands); the red triangle is the **mean** and the green bar the **median**. Drag the CEO’s dot and watch both.", r"一家银行有七名员工。六个人年薪在 £20k 到 £80k 之间；第七个是 CEO，年薪 £450 万。圆点是各人的工资（单位千英镑）；红三角是**平均数**，绿杠是**中位数**。拖动 CEO 的圆点，看两者怎么动。")),
                 frame('dot_plot.html', T('Seven salaries on a line, with their mean and median.', '一条线上的七份工资，以及它们的平均数和中位数。'),
                       caption=T(r"Drag a dot sideways (the arrow keys work too).", r"左右拖动圆点（也可以用方向键）。"),
                       lo=0, hi=5000, snap=10, unit='£', show=['mean', 'median'], sets=[dict(name=T('Salaries (£ thousands)', '工资（千英镑）'), data=bank)]),
                 chapter=T('Touch', '动手')),
            choice('predict', T('Which one moves?', '哪个在动？'), SK,
                   T(r"The CEO’s pay is cut from £4.5 million to £100k. What happens to the median and the mean?", r"CEO 的年薪从 £450 万降到 £10 万。中位数和平均数会怎样？"),
                   [(T(rf"The median stays at £30k; the mean falls from about £{n(mean(bank), 0)}k to about £{n(mean([50, 25, 20, 80, 20, 30, 100]), 0)}k.", rf"中位数仍是 £30k；平均数从约 £{n(mean(bank), 0)}k 降到约 £{n(mean([50, 25, 20, 80, 20, 30, 100]), 0)}k。"), True),
                    (T(r"Both fall by the same amount.", r"两者下降同样多。"), T(r"The median only looks at the middle value; the CEO is not in the middle either way.", r"中位数只看中间那个值；CEO 不管怎样都不在中间。"), 'mean-always'),
                    (T(r"Neither changes.", r"都不变。"), T(r"The mean adds every value, so it follows the CEO.", r"平均数把每个值都加进去，所以会跟着 CEO 走。"), None)],
                   T(r"The mean is pulled by every value, extremes most. The median is the middle one and ignores how far the ends go: it is *robust*.", r"平均数受每个值影响，极端值影响最大。中位数是中间那个，不管两端有多远：它是*稳健*的。")),
            read('name', T('Location and spread, named', '位置与离散，命名'),
                 table([T('Measure', '度量'), T('How to get it', '怎么得到'), T('Survives an outlier?', '经得起极端值吗？')],
                       [T('**Mean** $\\bar x$ (population $\\mu$)', '**平均数** $\\bar x$（总体 $\\mu$）'), T('add up, divide by $n$', '加起来，除以 $n$'), T('no', '经不起')],
                       [T('**Median**', '**中位数**'), T('the middle value of the sorted data (odd $n$); the average of the two middle values (even $n$)', '排序后的中间值（$n$ 为奇数）；中间两个值的平均（$n$ 为偶数）'), T('yes', '经得起')],
                       [T('**Mode**', '**众数**'), T('the most frequent value', '出现次数最多的值'), T('yes', '经得起')],
                       [T('**$p$th percentile**', '**第 $p$ 百分位数**'), T('sort; $i = \\tfrac{p}{100} n$; if $i$ is not whole, round **up** to that position; if whole, average positions $i$ and $i+1$', '排序；$i = \\tfrac{p}{100} n$；$i$ 不是整数就**向上**取整到那个位置；是整数就取第 $i$ 和第 $i+1$ 位的平均'), T('yes', '经得起')],
                       [T('**Quartiles** Q1, Q2, Q3', '**四分位数** Q1、Q2、Q3'), T('the 25th, 50th, 75th percentiles', '第 25、50、75 百分位数'), T('yes', '经得起')],
                       [T('**Range**', '**极差**'), T('largest − smallest', '最大值 − 最小值'), T('no', '经不起')],
                       [T('**IQR**', '**四分位距**'), T('Q3 − Q1: the range of the middle half', 'Q3 − Q1：中间一半数据的极差'), T('yes', '经得起')],
                       [T('**Variance** $s^2$, **standard deviation** $s$', '**方差** $s^2$、**标准差** $s$'), T('$s^2 = \\dfrac{\\sum (x_i - \\bar x)^2}{n - 1}$, $s = \\sqrt{s^2}$', '$s^2 = \\dfrac{\\sum (x_i - \\bar x)^2}{n - 1}$，$s = \\sqrt{s^2}$'), T('no', '经不起')]),
                 p(T(r"For a **sample** divide by $n - 1$, not $n$: that makes $s^2$ an unbiased estimate of the population variance (the formula sheet of the paper gives it). The variance is in squared units (dollars squared); the standard deviation takes the square root and is back in dollars. Numbers computed from a sample are *statistics*; from a whole population, *parameters*.", r"**样本**要除以 $n - 1$，不是 $n$：这样 $s^2$ 才是总体方差的无偏估计（试卷的公式表里有）。方差的单位是平方单位（美元的平方）；标准差开方后又回到美元。由样本算出的数叫*统计量*；由整个总体算出的叫*参数*。")),
                 callout('note', T('The graduates’ salaries as the lecture works it', '课上的例子：毕业生起薪'), T(rf"Twelve starting salaries: mean \${n(mean(grads), 0)}; median \${n(pctl(grads, 50), 0)}; mode \$3,480; Q1 \${n(pctl(grads, 25), 0)}, Q3 \${n(pctl(grads, 75), 0)}, IQR \$135; 85th percentile: $i = 0.85 \times 12 = 10.2$, round up to the 11th value, \$3,730; $\sum (x - \bar x)^2 = 301{{,}}850$, so $s^2 = 301850/11 = {n(svar(grads), 1)}$ and $s = \${n(s_g, 2)}$.", rf"十二份起薪：平均数 \${n(mean(grads), 0)}；中位数 \${n(pctl(grads, 50), 0)}；众数 \$3,480；Q1 \${n(pctl(grads, 25), 0)}，Q3 \${n(pctl(grads, 75), 0)}，IQR \$135；第 85 百分位数：$i = 0.85 \times 12 = 10.2$，向上取整到第 11 个值，\$3,730；$\sum (x - \bar x)^2 = 301{{,}}850$，所以 $s^2 = 301850/11 = {n(svar(grads), 1)}$，$s = \${n(s_g, 2)}$。")),
                 chapter=T('Names', '命名')),

            read('spread', T('Same mean, different suppliers', '平均数相同，供应商不同'),
                 p(T(r"A purchasing agent orders from two suppliers. Both deliver in 10.3 days on average. Which is more reliable? The means cannot say; the spread can.", r"采购员向两个供应商订货。两家的平均交货时间都是 10.3 天。哪家更可靠？平均数回答不了，离散程度能回答。")),
                 frame('dot_plot.html', T('Lead times of two suppliers with the same mean, with the box of the middle half and the standard deviation.', '两个平均数相同的供应商的交货时间，带有中间一半的方框和标准差。'),
                       caption=T(r"Move a dot of Clark’s to the middle and watch the IQR and s shrink.", r"把 Clark 的一个圆点移到中间，看 IQR 和 s 缩小。"),
                       lo=6, hi=16, snap=1, unit='', show=['mean', 'median', 'quartiles', 'sd'], sets=[dict(name='Dawson', data=daw), dict(name='Clark', data=cla)]),
                 chapter=T('Spread', '离散程度')),
            derive('sd_dawson', T('Dawson’s standard deviation, by hand', 'Dawson 的标准差，手算'),
                   [(r"\bar x = \dfrac{103}{10} = 10.3", T(r"The ten lead times add up to 103 days.", r"十个交货时间加起来是 103 天。")),
                    (r"\sum (x_i - \bar x)^2 = 4.1", T(r"Each deviation from 10.3, squared: $0.49, 0.09, 1.69, \ldots$; their sum is 4.1.", r"每个数与 10.3 的偏差的平方：$0.49, 0.09, 1.69, \ldots$；加起来是 4.1。")),
                    (r"s^2 = \dfrac{4.1}{10 - 1} = 0.4556", T(r"Divide by $n - 1 = 9$, not 10.", r"除以 $n - 1 = 9$，不是 10。")),
                    (r"s = \sqrt{0.4556} = 0.67", T(r"The standard deviation, back in days. (Clark’s is 2.58.)", r"标准差，单位又回到天。（Clark 的是 2.58。）"))],
                   outro=T(r"**Answer:** Dawson $s = 0.67$ days and IQR 1 day; Clark $s = 2.58$ days and IQR 4 days. Dawson is the more consistent and reliable supplier: both measures of spread are smaller, with the same mean.", r"**答案：** Dawson 的 $s = 0.67$ 天、IQR 为 1 天；Clark 的 $s = 2.58$ 天、IQR 为 4 天。Dawson 更稳定可靠：平均数相同，两个离散度量都更小。"),
                   blank=(2, '0.4556', T(r"$4.1 / 9$, four decimals.", r"$4.1 / 9$，四位小数。")), skill=SK),
            choice('same_mean', T('Same mean', '平均数相同'), SK,
                   T(r"Dawson and Clark both average 10.3 days. What does that tell you about which supplier to pick?", r"Dawson 和 Clark 的平均交货时间都是 10.3 天。这对选哪个供应商有什么帮助？"),
                   [(T(r"Nothing about reliability: you need the spread (IQR or s).", r"对可靠性没有帮助：要看离散程度（IQR 或 s）。"), True),
                    (T(r"They are equally reliable.", r"两家一样可靠。"), T(r"The same average hides a very different spread: 4 days against 1 day IQR.", r"相同的平均数藏着非常不同的离散程度：IQR 一个是 4 天，一个是 1 天。"), 'same-mean-same'),
                    (T(r"Pick the one with the larger range.", r"选极差大的那个。"), T(r"A larger range means *less* consistent.", r"极差大意味着*更不*稳定。"), None)],
                   T(r"A mean says where the middle is, not how far from it a delivery can land.", r"平均数说中间在哪儿，不说一次交货能偏离它多远。"), purpose='check'),

            read('workshop', T('Twenty at-home workers', '二十位在家工作的人'),
                 p(T(r"Ages of 20 people who work from home: 18, 20, 25, 25, 25, 26, 27, 27, 28, 33, 36, 37, 40, 40, 42, 45, 46, 48, 53, 54 (sorted). Mean 34.75, mode 25, median $(33 + 36)/2 = 34.5$: the at-home workers are only slightly younger than the median adult (36). For the quartiles, $n = 20$: $i = 0.25 \times 20 = 5$ is whole, so Q1 averages the 5th and 6th values.", r"20 位在家工作的人的年龄（已排序）：18, 20, 25, 25, 25, 26, 27, 27, 28, 33, 36, 37, 40, 40, 42, 45, 46, 48, 53, 54。平均数 34.75，众数 25，中位数 $(33 + 36)/2 = 34.5$：在家工作的人只比成年人的中位年龄（36）略年轻一点。算四分位数，$n = 20$：$i = 0.25 \times 20 = 5$ 是整数，所以 Q1 取第 5 和第 6 个值的平均。")),
                 chapter=T('Use it', '用一用')),
            number('q3', T('The third quartile', '第三四分位数'), SK, T(r"For those 20 ages, what is Q3 (the 75th percentile)?", r"这 20 个年龄的 Q3（第 75 百分位数）是多少？"),
                   pctl(home, 75), T(r"$i = 0.75 \times 20 = 15$ is a whole number, so average the 15th and 16th values: $(42 + 45)/2 = 43.5$.", r"$i = 0.75 \times 20 = 15$ 是整数，所以取第 15 和第 16 个值的平均：$(42 + 45)/2 = 43.5$。"), tolerance=0.01, purpose='practice'),
            number('p32', T('The 32nd percentile', '第 32 百分位数'), SK, T(r"What is the 32nd percentile of the 20 ages?", r"这 20 个年龄的第 32 百分位数是多少？"),
                   pctl(home, 32), T(r"$i = 0.32 \times 20 = 6.4$ is not whole, so round up to the 7th value: 27. At least 32% of these people are 27 or younger.", r"$i = 0.32 \times 20 = 6.4$ 不是整数，向上取整到第 7 个值：27。这些人里至少有 32% 是 27 岁或更小。"), tolerance=0.01, purpose='practice'),
            read('traps', T('Traps', '易错点'),
                 callout('warning', T('n − 1', 'n − 1'), T(r"A sample variance divides by $n - 1$. The exam gives the formula, but a calculator’s “σₙ” key divides by $n$: use the key for the **sample** standard deviation (written s, sx or sₙ₋₁ depending on the model) and check the answer once by hand.", r"样本方差要除以 $n - 1$。考试会给公式，但计算器上的“σₙ”键是除以 $n$：要用**样本**标准差键（不同型号写作 s、sx 或 sₙ₋₁），并且手算验证一次。")),
                 callout('warning', T('Sort first, round up', '先排序，向上取整'), T(r"Percentiles are read from the **sorted** list. A non-whole index is always rounded **up**.", r"百分位数要从**排好序的**数据里读。不是整数的位置一律**向上**取整。")),
                 callout('note', T('Say it in words', '要用话说出来'), T(r"A mark is usually given for the sentence: “Dawson’s lead times are more consistent because both IQR and s are smaller.”", r"通常有一分是给那句话的：“Dawson 的交货时间更稳定，因为 IQR 和 s 都更小。”")),
                 chapter=T('Traps', '易错点')),
            choice('recall_evpi', T('Recall: EVPI', '回忆：EVPI'), SK,
                   T(r"EVwoPI is 28 and EVwPI is 25.75 for a travel-time problem. EVPI is:", r"一个行程时间问题里 EVwoPI 是 28，EVwPI 是 25.75。EVPI 是："),
                   [(T(r"2.25: the absolute difference.", r"2.25：绝对差。"), True), (T(r"−2.25: the signed difference.", r"−2.25：带符号的差。"), T(r"EVPI uses the absolute value.", r"EVPI 用绝对值。"), None), (T(r"25.75.", r"25.75。"), T(r"That is EVwPI, not the gap.", r"那是 EVwPI，不是差额。"), 'evpi-vs-ev')],
                   T(r"EVPI = |EVwPI − EVwoPI|.", r"EVPI = |EVwPI − EVwoPI|。"), purpose='check'),
            choice('recall_shadow', T('Recall: a range', '回忆：一个范围'), SK,
                   T(r"A report gives a cost coefficient 9 with allowable increase 2.33 and allowable decrease 3. The current plan stays optimal for a cost between:", r"报告给出成本系数 9，允许增量 2.33，允许减量 3。当成本在什么范围内，现有计划仍然最优："),
                   [(T(r"6 and 11.33.", r"6 到 11.33。"), True), (T(r"6.67 and 12.", r"6.67 到 12。"), T(r"That swaps the increase and decrease.", r"那是把增量和减量弄反了。"), None), (T(r"0 and 9.", r"0 到 9。"), T(r"The range runs both ways from the coefficient.", r"范围是从系数向两边延伸。"), None)],
                   T(r"$9 - 3 = 6$ and $9 + 2.33 = 11.33$.", r"$9 - 3 = 6$，$9 + 2.33 = 11.33$。"), purpose='check'),
        ],
    )
