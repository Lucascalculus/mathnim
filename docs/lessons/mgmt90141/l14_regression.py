# Lesson 14 (regression): how to draw the best line and how good it is. Decks: W9 (the regression model, least squares, estimated equation,
# interpretation, coefficient of determination, correlation coefficient, SSE/SST/SSR; Armand's Pizza, the vice presidents' bonus).
# Exam: 2025 Q5(v)-(viii), 12 of the question's 25 marks. Instrument: reg_lab. Every number is computed with numpy below.
import numpy as np
from common import *

SK = 'mg.regression'


def ls(x, y):
    x, y = np.array(x, float), np.array(y, float)
    sxy, sxx = ((x - x.mean()) * (y - y.mean())).sum(), ((x - x.mean()) ** 2).sum()
    b1 = sxy / sxx; b0 = y.mean() - b1 * x.mean()
    sse = ((y - (b0 + b1 * x)) ** 2).sum(); sst = ((y - y.mean()) ** 2).sum()
    return dict(b1=b1, b0=b0, sse=sse, sst=sst, ssr=sst - sse, r2=1 - sse / sst, sxy=sxy, sxx=sxx, xm=x.mean(), ym=y.mean())


def L_regression():
    px = [2, 6, 8, 8, 12, 16, 20, 20, 22, 26]; py = [58, 105, 88, 118, 117, 137, 157, 169, 149, 202]
    A = ls(px, py)
    assert (round(A['sxy']), round(A['sxx']), round(A['b1'], 6), round(A['b0'], 6), round(A['sse']), round(A['sst']), round(A['ssr'])) == (2840, 568, 5, 60, 1530, 15730, 14200)
    assert round(A['r2'], 4) == .9027 and round(A['r2'] ** .5, 4) == .9501 and 60 + 5 * 16 == 140
    kx = [606, 660, 630, 672, 778, 616, 727, 810, 778, 820, 755, 710]; ky = [227, 240, 215, 231, 263, 220, 271, 284, 279, 272, 268, 278]
    Kg = ls(kx, ky)
    assert (round(Kg['sxy']), round(Kg['sxx']), Kg['xm'], Kg['ym']) == (18909, 63511, 713.5, 254.0)
    assert (round(Kg['b1'], 4), round(Kg['b0'], 3), round(Kg['ssr'], 2), round(Kg['sse'], 2), round(Kg['sst'])) == (.2977, 41.571, 5629.74, 1492.26, 7122)
    pred = Kg['b0'] + Kg['b1'] * 750
    assert round(pred, 1) == 264.9 and round(5629.74 / 7122, 2) == .79 and round((5629.74 / 7122) ** .5, 2) == .89
    sal = [135, 115, 146, 167, 165, 176, 98, 136, 163, 119]; bon = [12, 14, 16, 19, 22, 24, 7, 17, 18, 11]
    Vp = ls(sal, bon)
    assert (round(Vp['sxy']), round(Vp['sxx']), round(Vp['b1'], 4)) == (1114, 6046, .1843) and round(Vp['b0'] + Vp['b1'] * 120, 2) == 11.95
    return dict(
        id=f'{CID}-regression',
        title=T('How to draw the best line, and how good it is', '怎样画出最佳直线，以及它有多好'),
        description=T('Drag a line through a cloud of points and watch the squared errors. The best line is the one with the smallest total, r² says how much better it is than a flat line at the mean, and the exam’s kangaroo question puts the whole method on one page.',
                      '在一团点里拖一条直线，看误差的平方。最佳直线是总和最小的那条，r² 说明它比水平的均值线好多少，而考试里的袋鼠题把整套方法放在一页纸上。'),
        minutes=55,
        skills=[{'id': SK, 'name': T('Simple linear regression by least squares', '一元线性回归（最小二乘）')}],
        misconceptions=[{'id': 'r2-percent-correct', 'description': T('Reading r² as the percentage of predictions that are correct', '把 r² 当作预测正确的百分比')},
                        {'id': 'units-in-predict', 'description': T('Putting x into the equation in different units from the data', '代入方程的 x 和数据的单位不一致')},
                        {'id': 'causation', 'description': T('Reading a strong relationship as proof of cause', '把强的相关当作因果的证明')}],
        steps=[
            read('line', T('The line with the smallest mistakes', '错误最小的那条直线'),
                 p(T(r"Armand’s Pizza Parlors near ten campuses: $x$ is the student population (thousands), $y$ the quarterly sales (\$ thousands). A line predicts sales from students; the gap between a point and the line is that restaurant’s **error**. Each error is drawn as a square: big errors cost a lot, because squaring punishes them. Drag the line’s two ends and make the **sum of the squares** (SSE) as small as you can.", r"Armand’s Pizza 在十所大学附近的分店：$x$ 是学生人数（千人），$y$ 是季度销售额（千美元）。一条直线用学生人数预测销售额；一个点到直线的距离就是那家店的**误差**。每个误差画成一个正方形：大的误差代价很高，因为平方会惩罚它们。拖动直线的两端，让**平方和**（SSE）尽量小。")),
                 frame('reg_lab.html', T('Ten restaurants as points, a line you can bend, and the squared errors as squares.', '十家分店画成点，一条可以调整的直线，误差的平方画成正方形。'),
                       caption=T(r"Drag the two white ends up or down. Then press “Best line” to see what the least possible SSE is, and “Flat at the mean” for the baseline.", r"上下拖动两个白色的端点。然后按“最佳直线”看最小可能的 SSE，按“水平的均值线”看基线。"),
                       pts=[[a, b] for a, b in zip(px, py)], xlabel=T('students (thousands)', '学生人数（千人）'), ylabel=T('sales ($ thousands)', '销售额（千美元）'), xmin=0, xmax=28, ymin=0, ymax=220, start=[190, 40]),
                 chapter=T('Touch', '动手')),
            choice('predict', T('A flat line', '一条水平线'), SK,
                   T(r"The flat line at the mean of $y$ ignores the students completely. What are its SSE and its $r^2$?", r"在 $y$ 的均值处的水平线完全不管学生人数。它的 SSE 和 $r^2$ 是多少？"),
                   [(T(rf"Its SSE equals SST ({n(A['sst'], 0)}), so $r^2 = 0$: it explains none of the variation.", rf"它的 SSE 等于 SST（{n(A['sst'], 0)}），所以 $r^2 = 0$：它一点变化也没解释。"), True),
                    (T(r"$r^2 = 1$: the mean is the best guess.", r"$r^2 = 1$：均值是最好的猜测。"), T(r"$r^2 = 1$ means no error at all. The flat line has the biggest error of any sensible line.", r"$r^2 = 1$ 表示没有任何误差。水平线的误差在所有合理的直线里是最大的。"), 'r2-percent-correct'),
                    (T(r"It cannot be drawn.", r"画不出来。"), T(r"Press “Flat at the mean”: it is the baseline every regression has to beat.", r"按“水平的均值线”：它是每个回归都要打败的基线。"), None)],
                   T(r"SST is the squared error of the flat mean line; SSE is the squared error of your line; SSR = SST − SSE is how much your line improves on the mean. $r^2 = SSR/SST$.", r"SST 是水平均值线的平方误差；SSE 是你这条线的平方误差；SSR = SST − SSE 是你的线比均值线改进了多少。$r^2 = SSR/SST$。")),
            read('name', T('The best line, named', '最佳直线，命名'),
                 table([T('Name', '名字'), T('Formula (on the paper’s sheet)', '公式（试卷公式表上有）'), T('Armand’s', 'Armand’s')],
                       [T('Estimated equation', '估计方程'), '$\\hat y = b_0 + b_1 x$', '$\\hat y = 60 + 5x$'],
                       [T('Slope', '斜率'), '$b_1 = \\dfrac{\\sum (x_i - \\bar x)(y_i - \\bar y)}{\\sum (x_i - \\bar x)^2}$', '$2840 / 568 = 5$'],
                       [T('Intercept', '截距'), '$b_0 = \\bar y - b_1 \\bar x$', '$130 - 5(14) = 60$'],
                       ['SSE', '$\\sum (y_i - \\hat y_i)^2$', '1530'], ['SST', '$\\sum (y_i - \\bar y)^2$', '15730'], ['SSR', '$SST - SSE$', '14200'],
                       [T('Coefficient of determination', '决定系数'), '$r^2 = SSR / SST$', '$14200/15730 = 0.9027$'],
                       [T('Correlation', '相关系数'), '$r_{xy} = (\\text{sign of } b_1)\\sqrt{r^2}$', '$+\\sqrt{0.9027} = 0.9501$']),
                 p(T(r"**Meaning.** The slope is the change in $y$ for one more unit of $x$: here every extra thousand students goes with \$5 thousand more quarterly sales. The intercept is the predicted $y$ at $x = 0$ (here, a campus with no students: usually outside the data and not to be trusted). $r^2$ is the **share of the variation in $y$ that the line accounts for**: 90.3% here. It is **not** “90% of the predictions are right”. The sign of $r_{xy}$ is the sign of the slope, and $r_{xy}$ near $\pm 1$ is a strong straight-line relationship. Strong association is not proof of cause.", r"**含义。** 斜率是 $x$ 多一个单位时 $y$ 的变化：这里每多一千名学生，季度销售额多 \$5 千。截距是 $x = 0$ 时 $y$ 的预测值（这里是没有学生的校园：通常在数据范围之外，不可信）。$r^2$ 是**直线能解释的 $y$ 的变化所占的份额**：这里是 90.3%。它**不是**“90% 的预测是对的”。$r_{xy}$ 的符号和斜率的符号相同，$r_{xy}$ 接近 $\pm 1$ 表示很强的直线关系。强相关不等于因果。")),
                 p(T(r"**By hand with a calculator** (the exam allows only a Casio fx-82): fill a small table of $x_i - \bar x$, $y_i - \bar y$ and their products and squares, as in the lecture; or use the calculator’s two-variable statistics mode, which gives $\bar x$, $\bar y$, $b_0$ and $b_1$ directly (check the mode on your own calculator before the exam). Either way write the sums on the paper: the marks are for the working.", r"**用计算器手算**（考试只允许 Casio fx-82）：像课上那样列一张小表，算 $x_i - \bar x$、$y_i - \bar y$ 以及它们的乘积和平方；或者用计算器的双变量统计模式，它会直接给出 $\bar x$、$\bar y$、$b_0$ 和 $b_1$（考前在你自己的计算器上确认这个模式）。不管哪种，都要把各个和写在卷子上：分数是给过程的。")),
                 chapter=T('Names', '命名')),
            number('bonus', T('Vice presidents’ bonus', '副总裁的奖金'), SK,
                   T(r"For ten sales vice presidents the least-squares line of bonus on salary (both in \$ thousands) has $b_1 = 1114/6046$ and $b_0 = \bar y - b_1 \bar x$, with $\bar x = 142$ and $\bar y = 16$. Predict the bonus (in \$ thousands, two decimals) for a salary of \$120 thousand.", r"十位销售副总裁的奖金对年薪（均以千美元计）的最小二乘直线中，$b_1 = 1114/6046$，$b_0 = \bar y - b_1 \bar x$，其中 $\bar x = 142$，$\bar y = 16$。预测年薪 \$120 千的人的奖金（千美元，两位小数）。"),
                   round(Vp['b0'] + Vp['b1'] * 120, 2), T(rf"$b_1 = 0.1843$, $b_0 = 16 - 0.1843(142) = {n(Vp['b0'], 3)}$, so $\hat y = {n(Vp['b0'], 3)} + 0.1843(120) = 11.95$: about \$11,950. (Keep the unrounded slope in your calculator: $1114/6046$ times 120 is 22.11.)", rf"$b_1 = 0.1843$，$b_0 = 16 - 0.1843(142) = {n(Vp['b0'], 3)}$，所以 $\hat y = {n(Vp['b0'], 3)} + 0.1843(120) = 11.95$：约 \$11,950。（计算器里保留不取整的斜率：$1114/6046$ 乘 120 是 22.11。）"), tolerance=0.02, purpose='practice'),

            read('exam', T('The exam’s version: kangaroo noses', '考试里的版本：袋鼠的鼻子'),
                 p(T(r"The second half of Question 5. Twelve male eastern grey kangaroos: can nasal length predict nasal width? Four parts, 12 marks. The lab has the data: bend the line, then press “Best line” to check what you computed.", r"第 5 题的下半。十二只雄性东部灰袋鼠：鼻子的长度能预测宽度吗？四问，12 分。实验区里有这些数据：调整直线，再按“最佳直线”核对你算出来的结果。")),
                 paper(T('Question 5, simple regression · 12 marks', '第 5 题，一元回归 · 12 分'),
                       *ptxt("Eastern Grey Kangaroo is a marsupial mammal that belongs to a small group called macropods in Australia. For a quick research study, a scientist wanted to examine whether you could use nasal length (mm) to predict nasal width (mm) for male Eastern Grey Kangaroos. The table below shows a random group of 12 male Easter Grey Kangaroo’s nasal length and width.\n(v) Develop an estimated regression equation that can be used to predict nasal width (mm) for male Eastern Grey Kangaroos given the nasal length (mm). [6 marks]\n(vi) Using the regression equation found in part (v), interpret the slope coefficient. [2 marks]\n(vii) Using the regression equation found in part (v) to predict nasal width (mm) for male Eastern Grey Kangaroos given nasal length is 75 cm. [2 marks]\n(viii) Given that SSR = 5,629.74 and SSE = 1,492.26, compute the coefficient of determination r² and the sample correlation coefficient rxy. [2 marks]",
                             "东部灰袋鼠是澳大利亚一个叫大袋鼠类的小类群里的有袋哺乳动物。为了做一个快速的研究，一位科学家想检验能否用鼻子长度（毫米）预测雄性东部灰袋鼠的鼻子宽度（毫米）。下表是随机抽取的 12 只雄性东部灰袋鼠的鼻子长度和宽度。\n(v) 建立一个估计回归方程，用鼻子长度（毫米）预测雄性东部灰袋鼠的鼻子宽度（毫米）。[6 分]\n(vi) 用 (v) 中得到的回归方程，解释斜率系数。[2 分]\n(vii) 用 (v) 中得到的回归方程，预测鼻子长度为 75 厘米的雄性东部灰袋鼠的鼻子宽度（毫米）。[2 分]\n(viii) 已知 SSR = 5,629.74，SSE = 1,492.26，计算决定系数 r² 和样本相关系数 rxy。[2 分]")),
                 table([T('Kangaroo', '袋鼠'), T('Nasal length (mm)', '鼻长（毫米）'), T('Nasal width (mm)', '鼻宽（毫米）')], *[[str(i + 1), str(a), str(b)] for i, (a, b) in enumerate(zip(kx, ky))]),
                 frame('reg_lab.html', T('The twelve kangaroos: nasal width against nasal length, with a line you can bend.', '十二只袋鼠：鼻宽对鼻长，带一条可以调整的直线。'),
                       caption=T(r"Press “Best line”: its slope and intercept are what part (v) asks for.", r"按“最佳直线”：它的斜率和截距就是 (v) 要的。"),
                       pts=[[a, b] for a, b in zip(kx, ky)], xlabel=T('nasal length (mm)', '鼻长（毫米）'), ylabel=T('nasal width (mm)', '鼻宽（毫米）'), xmin=560, xmax=860, ymin=190, ymax=300, start=[215, 285]),
                 chapter=T('On the paper', '考卷上')),
            derive('q5v', T('(v): the equation', '(v)：回归方程'),
                   [(r"\bar x = \dfrac{8562}{12} = 713.5,\quad \bar y = \dfrac{3048}{12} = 254", T(r"The two means: the sums of the lengths and widths divided by 12.", r"两个均值：长度和宽度各自的总和除以 12。")),
                    (r"\sum (x_i - \bar x)(y_i - \bar y) = 18909,\quad \sum (x_i - \bar x)^2 = 63511", T(r"Fill the table (or the calculator’s statistics mode): the cross-products add to 18,909, the squared deviations of the lengths to 63,511.", r"填表（或用计算器的统计模式）：交叉乘积加起来是 18,909，长度的偏差平方加起来是 63,511。")),
                    (r"b_1 = \dfrac{18909}{63511} = 0.2977", T(r"The slope, from the formula sheet.", r"斜率，用公式表上的公式。")),
                    (r"b_0 = 254 - 0.2977(713.5) = 41.571", T(r"The intercept: $\bar y - b_1 \bar x$. Keep three or more decimals here: a rounded slope shifts the intercept.", r"截距：$\bar y - b_1 \bar x$。这里保留三位或更多小数：斜率取整会让截距偏掉。")),
                    (r"\hat y = 41.571 + 0.2977x", T(r"The estimated regression equation: $x$ is the nasal length and $\hat y$ the predicted nasal width, both in mm.", r"估计回归方程：$x$ 是鼻长，$\hat y$ 是预测的鼻宽，单位都是毫米。"))],
                   outro=T(r"**Answer:** $\hat y = 41.571 + 0.2977x$ (width and length in mm).", r"**答案：** $\hat y = 41.571 + 0.2977x$（宽度和长度单位都是毫米）。"),
                   blank=(2, '0.2977', T(r"$18909 / 63511$, four decimals.", r"$18909 / 63511$，四位小数。")), skill=SK),
            derive('q5vi', T('(vi) to (viii): interpret, predict, fit', '(vi) 到 (viii)：解释、预测、拟合'),
                   [(r"b_1 = 0.2977\ \text{mm per mm}", T(r"(vi) Say it in words, with units: each extra millimetre of nasal length goes with 0.2977 mm more nasal width.", r"(vi) 用文字加单位说出来：鼻子长度每多 1 毫米，鼻子宽度大约多 0.2977 毫米。")),
                    (r"75\ \text{cm} = 750\ \text{mm}", T(r"(vii) The trap: the equation is in mm, so convert first.", r"(vii) 陷阱：方程用的是毫米，所以先换算。")),
                    (r"\hat y = 41.571 + 0.2977(750) = 264.9", T(r"The predicted nasal width: about 265 mm. (750 mm is inside the data’s range 606 to 820: a safe prediction.)", r"预测的鼻子宽度：约 265 毫米。（750 毫米在数据范围 606 到 820 之内：预测是可靠的。）")),
                    (r"SST = SSR + SSE = 5629.74 + 1492.26 = 7122", T(r"(viii) The total sum of squares.", r"(viii) 总平方和。")),
                    (r"r^2 = \dfrac{5629.74}{7122} = 0.79,\quad r_{xy} = +\sqrt{0.79} = 0.89", T(r"The share explained, and the correlation with the sign of the slope (positive).", r"被解释的份额，以及带斜率符号（正）的相关系数。"))],
                   outro=T(r"**Answer:** (vi) about 0.30 mm of width per mm of length; (vii) about 265 mm; (viii) $r^2 = 0.79$, $r_{xy} = 0.89$: a strong positive relationship, with 79% of the variation in width accounted for by length.", r"**答案：** (vi) 每毫米长度对应约 0.30 毫米的宽度；(vii) 约 265 毫米；(viii) $r^2 = 0.79$，$r_{xy} = 0.89$：很强的正相关，长度解释了宽度变化的 79%。"),
                   blank=(2, '264.9', T(r"$41.571 + 0.2977 \times 750$, one decimal.", r"$41.571 + 0.2977 \times 750$，一位小数。")), skill=SK),
            choice('units', T('Seventy-five centimetres', '七十五厘米'), SK,
                   T(r"A student puts $x = 75$ straight into $\hat y = 41.571 + 0.2977x$ and gets 63.9. What went wrong?", r"一位同学把 $x = 75$ 直接代入 $\hat y = 41.571 + 0.2977x$，得到 63.9。哪里错了？"),
                   [(T(r"The equation was fitted with lengths in mm; 75 cm is 750 mm. A width of 64 mm is also far outside the data (215 to 284).", r"方程是用毫米的长度拟合的；75 厘米是 750 毫米。64 毫米的宽度也远在数据范围（215 到 284）之外。"), True),
                    (T(r"Nothing: the equation takes any unit.", r"没错：方程什么单位都行。"), T(r"The slope has a unit: mm of width per mm of length.", r"斜率是带单位的：每毫米长度对应多少毫米宽度。"), 'units-in-predict'),
                    (T(r"The intercept should have been subtracted.", r"截距应该减去。"), T(r"The equation is $b_0 + b_1 x$ as written.", r"方程就是写成的 $b_0 + b_1 x$。"), None)],
                   T(r"Always convert to the units the equation was built in, and sanity-check the answer against the data.", r"一定要换算成建方程时用的单位，并拿答案和数据比一比，看合不合理。"), purpose='check'),
            read('answer', T('The full-mark answers, as they are written', '满分答案，写在卷子上是这样'),
                 paper(T('Question 5 (v) to (viii), full marks', '第 5 题 (v) 到 (viii)，满分写法'),
                       *ptxt("(v) x̄ = 713.5, ȳ = 254. b1 = Σ(xi − x̄)(yi − ȳ) / Σ(xi − x̄)² = 18,909 / 63,511 = 0.2977. b0 = ȳ − b1 x̄ = 254 − 0.2977(713.5) = 41.571. ŷ = 41.571 + 0.2977x.\n(vi) For every 1 mm increase in nasal length of a male Eastern Grey Kangaroo, nasal width is expected to be 0.2977 mm greater.\n(vii) 75 cm = 750 mm. ŷ = 41.571 + 0.2977(750) = 264.9 mm.\n(viii) SST = SSR + SSE = 7,122. r² = SSR/SST = 5,629.74/7,122 = 0.79. rxy = +√0.79 = 0.89: a strong positive relationship between nasal length and nasal width.",
                             "(v) x̄ = 713.5，ȳ = 254。b1 = Σ(xi − x̄)(yi − ȳ) / Σ(xi − x̄)² = 18,909 / 63,511 = 0.2977。b0 = ȳ − b1 x̄ = 254 − 0.2977(713.5) = 41.571。ŷ = 41.571 + 0.2977x。\n(vi) 雄性东部灰袋鼠的鼻子长度每增加 1 毫米，预期鼻子宽度大 0.2977 毫米。\n(vii) 75 厘米 = 750 毫米。ŷ = 41.571 + 0.2977(750) = 264.9 毫米。\n(viii) SST = SSR + SSE = 7,122。r² = SSR/SST = 5,629.74/7,122 = 0.79。rxy = +√0.79 = 0.89：鼻子长度和宽度之间有很强的正相关。"), answer=True),
                 callout('note', T('What earns the marks', '得分点'), T(r"(v) is 6 marks: the means, the two sums, $b_1$, $b_0$, the equation, each written. (vi) needs the number with both units and the words “for every 1 mm increase”. (vii) needs the unit conversion. (viii) needs both $r^2$ and $r_{xy}$ with its sign.", r"(v) 占 6 分：均值、两个和、$b_1$、$b_0$、方程，每一步都要写出来。(vi) 需要带两个单位的数以及“每增加 1 毫米”这样的话。(vii) 需要单位换算。(viii) 要同时写 $r^2$ 和带符号的 $r_{xy}$。")),
                 chapter=T('The answer', '答案')),
            read('traps', T('Traps', '易错点'),
                 callout('warning', T('r² is not “percent correct”', 'r² 不是“正确的百分比”'), T(r"$r^2 = 0.79$ means the line accounts for 79% of the *variation* in $y$ around its mean. The predictions are never exactly right.", r"$r^2 = 0.79$ 的意思是这条线解释了 $y$ 围绕均值的*变化*的 79%。预测从来不是恰好正确的。")),
                 callout('warning', T('Association is not cause', '相关不是因果'), T(r"A strong line between nasal length and width says they move together, not that one makes the other.", r"鼻长和鼻宽之间的强直线关系说明它们同步变化，不说明谁导致了谁。")),
                 callout('warning', T('Stay inside the data', '待在数据范围之内'), T(r"Predicting far outside the range of $x$ in the data (a campus of 200,000 students) is extrapolation: the straight line may simply stop being true.", r"在远超出数据里 $x$ 的范围处预测（一个有 20 万学生的校园）叫外推：这条直线很可能不再成立。")),
                 chapter=T('Traps', '易错点')),
            choice('recall_z', T('Recall: reading the table', '回忆：查表'), SK,
                   T(r"$z = -1.49$ is looked up in the paper’s table at:", r"在试卷的表里，$z = -1.49$ 要在这里查："),
                   [(T(r"the negative page, row −1.4, column .09.", r"负数那页，行 −1.4、列 .09。"), True), (T(r"the positive page, row 1.4, column .09.", r"正数那页，行 1.4、列 .09。"), T(r"That is $z = +1.49$, area 0.9319.", r"那是 $z = +1.49$，面积 0.9319。"), 'negative-z-row'), (T(r"the negative page, row −1.5, column .01.", r"负数那页，行 −1.5、列 .01。"), T(r"Rows hold units and tenths, columns the hundredths, with no rounding up.", r"行是个位和十分位，列是百分位，不进位。"), 'negative-z-row')],
                   T(r"Row: units and tenths; column: hundredths.", r"行：个位和十分位；列：百分位。"), purpose='check'),
            choice('recall_binom', T('Recall: the binomial mean', '回忆：二项分布的均值'), SK,
                   T(r"With $n = 3$ customers each buying with probability 0.3, the expected number of buyers is:", r"3 位顾客，每位以 0.3 的概率购买，购买人数的期望是："),
                   [(r"$np = 0.9$", True), (r"$p = 0.3$", T(r"That is for one customer.", r"那是一位顾客的。"), None), (r"$np(1-p) = 0.63$", T(r"That is the variance.", r"那是方差。"), None)],
                   T(r"$E(x) = np$.", r"$E(x) = np$。"), purpose='check'),
        ],
    )
