# Lesson 15 (multiple-regression): what changes with several predictors, and how to read the output. Decks: W10 (multiple regression, coefficients
# held-fixed, R², adjusted R², correlation matrix, multicollinearity, F test, t tests, a dummy variable; Butler Trucking, the Olympics,
# Johnson Filtration). Exam: the Subaru past paper (the multiple-regression variant of Question 5). Instrument: reg_output.
# Every number is computed with numpy and scipy.stats below, and the Subaru output is checked against the printed Excel output.
import numpy as np
from scipy import stats as st
from common import *

SK = 'mg.multiple-regression'


def ols(X, y):
    X = np.c_[np.ones(len(y)), np.array(X, float)]; y = np.array(y, float)
    n, k = X.shape; p = k - 1
    b = np.linalg.lstsq(X, y, rcond=None)[0]; r = y - X @ b
    sse, sst = (r ** 2).sum(), ((y - y.mean()) ** 2).sum(); ssr = sst - sse
    s2 = sse / (n - k); se = np.sqrt(np.diag(s2 * np.linalg.inv(X.T @ X)))
    tt = b / se; pv = 2 * st.t.sf(abs(tt), n - k); tc = st.t.ppf(.975, n - k)
    r2 = ssr / sst; adj = 1 - (1 - r2) * (n - 1) / (n - p - 1); F = (ssr / p) / s2
    return dict(b=b, se=se, t=tt, p=pv, lo=b - tc * se, hi=b + tc * se, r2=r2, adj=adj, F=F, sigF=st.f.sf(F, p, n - p - 1), sse=sse, ssr=ssr, sst=sst, n=n, pp=p, se_reg=np.sqrt(s2))


def out_params(m):
    return dict(multR=float(np.sqrt(m['r2'])), r2=m['r2'], adjr2=m['adj'], se=m['se_reg'], n=m['n'], df=[m['pp'], m['n'] - m['pp'] - 1, m['n'] - 1], ss=[m['ssr'], m['sse'], m['sst']],
                ms=[m['ssr'] / m['pp'], m['sse'] / (m['n'] - m['pp'] - 1)], F=m['F'], sigF=m['sigF'],
                coef=[dict(b=m['b'][i], se=m['se'][i], t=m['t'][i], p=m['p'][i], lo=m['lo'][i], hi=m['hi'][i]) for i in range(len(m['b']))])


SUB = [[52, 137856, 5, 2, 1356], [38, 58965, 1, 3, 723], [33, 80727, 2, 5, 926], [41, 136526, 5, 4, 1235], [42, 125693, 5, 4, 1325], [48, 65895, 2, 5, 789], [52, 118562, 4, 5, 1106], [40, 120349, 4, 1, 1156], [27, 89222, 2, 4, 923], [29, 76318, 1, 4, 865],
       [45, 135693, 4, 4, 1311], [43, 112489, 5, 5, 1123], [38, 162487, 5, 5, 1425], [28, 68596, 3, 2, 985], [35, 133652, 4, 5, 1032], [55, 88569, 2, 4, 897], [61, 136617, 4, 2, 1156], [58, 156232, 4, 5, 1522], [46, 138956, 5, 2, 1245], [35, 98722, 5, 5, 1320]]


def L_multiple():
    D = np.array(SUB, float); Y = D[:, 4]
    S = ols(D[:, :4], Y)
    # checked against the Excel output printed in the past paper
    assert abs(S['r2'] - 0.831140463) < 1e-8 and abs(S['adj'] - 0.786111254) < 1e-8 and abs(S['se_reg'] - 103.1302784) < 1e-6 and abs(S['F'] - 18.457807) < 1e-5
    assert abs(S['b'][0] - 449.2382981) < 1e-6 and abs(S['b'][2] - 0.003810133) < 1e-8 and abs(S['p'][2] - 0.014395156) < 1e-8 and abs(S['p'][3] - 0.030980754) < 1e-8 and abs(S['sigF'] - 1.16357e-05) < 1e-9
    nested = [ols(D[:, c], Y) for c in ([1], [1, 2], [1, 2, 0], [1, 2, 0, 3])]
    assert nested[2]['adj'] < nested[1]['adj'] and nested[3]['adj'] < nested[2]['adj'] and nested[2]['r2'] > nested[1]['r2']
    pred3 = 449.238 - .409 * 44 + .004 * 96523 + 67.126 * 4          # the paper's own rounding to three places
    pred_exact = float(S['b'][:4] @ np.array([1, 44, 96523, 4]))
    assert round(pred3, 3) == 1085.838 and round(pred_exact, 1) == 1067.5
    # Butler Trucking
    bm, bd, bt = [100, 50, 100, 100, 50, 80, 75, 65, 90, 90], [4, 3, 4, 2, 2, 2, 3, 4, 3, 2], [9.3, 4.8, 8.9, 6.5, 4.2, 6.2, 7.4, 6.0, 7.6, 6.1]
    Bu = ols(np.c_[bm, bd], bt)
    assert (round(Bu['b'][1], 4), round(Bu['b'][2], 4), round(Bu['r2'], 4), round(Bu['adj'], 4)) == (.0611, .9234, .9038, .8763)
    # Olympics
    gni = [5370, 45580, 14400, 34370, 33820, 33340, 24750, 34600, 29900, 33470, 6810, 39500, 5050, 30100, 1540]
    life = [73, 78, 67, 79, 79, 81, 79, 82, 81, 81, 68, 80, 72, 80, 53]
    pop = [1324.7, 304.5, 141.9, 61.3, 82.2, 21.3, 48.6, 127.7, 59.9, 62.0, 46.2, 16.4, 2.7, 46.5, 38.0]
    medals = [100, 110, 72, 47, 40, 45, 31, 25, 28, 40, 28, 16, 11, 17, 14]
    rg = float(np.corrcoef(gni, life)[0, 1]); rpop = float(np.corrcoef(pop, medals)[0, 1])
    assert rg > .7
    # Johnson Filtration with a dummy variable (mechanical = 1, electrical = 0)
    jm, jt, jy = [2, 6, 8, 3, 2, 7, 9, 8, 4, 6], [0, 1, 0, 1, 0, 0, 1, 1, 0, 0], [2.9, 3.0, 4.8, 1.8, 2.9, 4.9, 4.2, 4.8, 4.4, 4.5]
    Jo = ols(np.c_[jm, jt], jy)
    data_rows = [[str(i + 1)] + [f'{int(v):,}' if k == 1 else f'{int(v)}' for k, v in enumerate(r)] for i, r in enumerate(SUB)]
    tasks = [
        dict(q=T('(iii) Which number says whether mean taxable income is a significant predictor of sales?', '(iii) 哪个数说明平均应税收入是不是销量的显著预测变量？'), cell='p:2', explain=T(r"Its p-value, 0.0144, is below 0.05: significant.", r"它的 p 值 0.0144 小于 0.05：显著。")),
        dict(q=T('(iii) And which number tells you how many more units one extra dollar of income goes with?', '(iii) 哪个数说明收入每多一美元，销量多多少？'), cell='b:2', explain=T(r"The coefficient 0.0038: one more dollar goes with 0.0038 more units, so \$1,000 goes with about 3.8 (the paper rounds to 4).", r"系数 0.0038：多一美元，销量多 0.0038，所以多 \$1,000 约多 3.8（试卷取整为 4）。")),
        dict(q=T('(iv) Which number is the p-value of the F test: is the model useful at all?', '(iv) 哪个数是 F 检验的 p 值：这个模型到底有没有用？'), cell='sigF', explain=T(r"Significance F is far below 0.05: at least one variable really predicts sales.", r"Significance F 远小于 0.05：至少有一个变量确实能预测销量。")),
        dict(q=T('(v) Which number describes the overall fit while allowing for the number of variables?', '(v) 哪个数在考虑变量个数的前提下描述整体拟合程度？'), cells=['adjr2', 'r2'], explain=T(r"Adjusted R² = 0.786 (the paper accepts R² = 0.831 too): the variables explain about 79% of the variation in sales.", r"调整后的 R² = 0.786（试卷也接受 R² = 0.831）：这些变量解释了销量变化的约 79%。")),
        dict(q=T('(vi) Which number is the suburb rating’s coefficient: units of sales per rating point, others fixed?', '(vi) 哪个数是郊区评级的系数：评级每多一级，销量多多少（其他不变）？'), cell='b:3', explain=T(r"67.126: one rating point richer goes with about 67 more units, holding the other variables fixed.", r"67.126：评级每高一级，销量约多 67，其他变量保持不变。")),
        dict(q=T('(vi) And which number says that coefficient is significant?', '(vi) 哪个数说明这个系数是显著的？'), cell='p:3', explain=T(r"Its p-value 0.031 is below 0.05.", r"它的 p 值 0.031 小于 0.05。")),
    ]
    return dict(
        id=f'{CID}-multiple-regression',
        title=T('What changes with several predictors, and how to read the output', '预测变量变多以后有什么变化，以及怎么读输出'),
        description=T('Touch every cell of a real regression output and learn what question each answers. Then see why R² can only go up and adjusted R² can fall, and read the Subaru past paper’s output the way the examiner wants: significance, size and fit.',
                      '点一遍真实回归输出里的每个格子，弄清每个格子回答什么问题。再看为什么 R² 只会上升而调整后的 R² 会下降，并按阅卷人的要求读 Subaru 往年真题的输出：显著性、大小和拟合。'),
        minutes=60,
        skills=[{'id': SK, 'name': T('Multiple regression: reading the output', '多元回归：读输出')}],
        misconceptions=[{'id': 'r2-always-better', 'description': T('Adding variables because R² rises', '因为 R² 上升就继续加变量')},
                        {'id': 'coef-alone', 'description': T('Reading a coefficient as the effect of that variable alone, ignoring “others held fixed”', '把系数当作这个变量单独的作用，忽略“其他变量保持不变”')},
                        {'id': 'f-vs-t', 'description': T('Using the t test for the whole model or the F test for one variable', '用 t 检验判断整个模型，或用 F 检验判断单个变量')}],
        steps=[
            read('butler', T('Two predictors: travel time of a delivery driver', '两个预测变量：送货司机的行驶时间'),
                 p(T(r"Butler Trucking estimates a driver’s daily travel time $y$ (hours) from the miles driven $x_1$ and the number of deliveries $x_2$, using ten assignments. Excel returns the table below. Do not read it; **touch** it. Every number answers one question, and you will meet the same table in the exam.", r"Butler Trucking 用十次任务的数据，根据行驶里程 $x_1$ 和送货次数 $x_2$ 来估计司机一天的行驶时间 $y$（小时）。Excel 给出下面这张表。别去读它；**点**它。每个数回答一个问题，考试里你会碰到同样的表。")),
                 frame('reg_output.html', T('The regression output for Butler Trucking, as Excel prints it. Touch any number to learn what it is.', 'Butler Trucking 的回归输出，和 Excel 打印的一样。点任何一个数，了解它是什么。'),
                       caption=T(r"Start with R Square, Significance F and the P-values.", r"先看 R Square、Significance F 和各个 P-value。"),
                       out=out_params(Bu), vars=[T('Miles travelled', '行驶里程'), T('Number of deliveries', '送货次数')]),
                 chapter=T('Touch', '动手')),
            choice('predict', T('A coefficient with a condition', '带条件的系数'), SK,
                   T(rf"The coefficient of miles is {n(Bu['b'][1], 4)} (hours per mile). What does it mean?", rf"里程的系数是 {n(Bu['b'][1], 4)}（小时每英里）。它是什么意思？"),
                   [(T(rf"With the number of deliveries held fixed, each extra mile goes with {n(Bu['b'][1], 4)} more hours of travel.", rf"在送货次数保持不变时，每多一英里，行驶时间多 {n(Bu['b'][1], 4)} 小时。"), True),
                    (T(r"Each extra mile adds that many hours, whatever else changes.", r"不管其他变量怎么变，每多一英里就增加这么多小时。"), T(r"In multiple regression every coefficient is read with the other variables held fixed; it would change if another variable were dropped.", r"多元回归里每个系数都是在其他变量保持不变的前提下解读的；去掉别的变量，它就会变。"), 'coef-alone'),
                    (T(r"Miles explain that share of the variation in travel time.", r"里程解释了行驶时间变化的这个份额。"), T(r"That is what $R^2$ is for, not a coefficient.", r"那是 $R^2$ 的作用，不是系数的。"), None)],
                   T(r"“Holding the other variables constant” belongs to every coefficient of a multiple regression.", r"“其他变量保持不变”属于多元回归里的每一个系数。")),
            read('name', T('The cells of the output, named', '输出里的各个格子，命名'),
                 table([T('Cell', '格子'), T('Question it answers', '它回答的问题'), T('Rule', '规则')],
                       [T('**Coefficients** $b_i$', '**系数** $b_i$'), T('what one more unit of $x_i$ does to $y$, others fixed', '$x_i$ 多一个单位对 $y$ 做了什么，其他不变'), T('say it with units', '要带单位说')],
                       [T('**R Square** $R^2$', '**R Square** $R^2$'), T('the share of the variation in $y$ the model explains', '模型解释的 $y$ 的变化所占份额'), T('never falls when a variable is added', '加变量时永远不会下降')],
                       [T('**Adjusted R Square**', '**Adjusted R Square**'), T('the same, penalised for the number of variables $p$', '同样的意思，但按变量个数 $p$ 做了惩罚'), '$1 - (1 - R^2)\\dfrac{n-1}{n-p-1}$'],
                       [T('**F** and **Significance F**', '**F** 和 **Significance F**'), T('is the model as a whole any use? (the F test)', '整个模型到底有没有用？（F 检验）'), T('Significance F < 0.05: yes', 'Significance F < 0.05：有用')],
                       [T('**t Stat** and **P-value** per variable', '每个变量的 **t Stat** 和 **P-value**'), T('is this variable useful given the others? (a t test per variable)', '在有其他变量的前提下，这个变量有没有用？（每个变量一个 t 检验）'), T('P-value < 0.05: significant', 'P-value < 0.05：显著')],
                       [T('**Lower / Upper 95%**', '**Lower / Upper 95%**'), T('a range for the true coefficient', '真实系数的一个范围'), T('contains 0: not significant', '包含 0：不显著')],
                       [T('**Standard Error** of the regression', '回归的**标准误差**'), T('typical size of a prediction error, in the units of $y$', '预测误差的典型大小，单位和 $y$ 相同'), T('smaller is tighter', '越小越紧')]),
                 p(T(r"**Two tests, two questions.** The **F test** asks about the whole model; the **t tests** ask about one variable each. A model can be useful overall with some useless variables in it: here, in the exam’s output, two of the four variables are not significant while Significance F is tiny.", r"**两种检验，两个问题。** **F 检验**问整个模型；**t 检验**每次问一个变量。一个模型整体有用，里面却可以有没用的变量：在考试的输出里，四个变量中有两个不显著，而 Significance F 却非常小。")),
                 chapter=T('Names', '命名')),

            read('adding', T('More variables always raise R²', '变量越多，R² 越高'),
                 p(T(r"On the Subaru data (20 quarters, sales in units), add the variables one at a time, best first: income, then suburb rating, then buyer age, then car colour. $R^2$ climbs every time, even for variables that predict nothing. Adjusted $R^2$ pays for each extra variable and **falls** when it does not earn its place.", r"在 Subaru 的数据上（20 个季度，销量以台计），一次加一个变量，最好的先加：收入、然后郊区评级、然后购车者年龄、最后车的颜色。$R^2$ 每次都上升，哪怕那个变量什么也预测不了。调整后的 $R^2$ 为每个多加的变量付代价，如果它没有挣到位置就会**下降**。")),
                 table([T('Variables in the model', '模型里的变量'), '$R^2$', T('Adjusted $R^2$', '调整后的 $R^2$')],
                       *[[nm, n(m['r2'], 4), n(m['adj'], 4)] for nm, m in zip([T('income', '收入'), T('income, suburb rating', '收入、郊区评级'), T('income, suburb rating, age', '收入、郊区评级、年龄'), T('income, suburb rating, age, colour', '收入、郊区评级、年龄、颜色')], nested)]),
                 chapter=T('Adding variables', '加变量')),
            choice('adj', T('Which fit number?', '该看哪个拟合数？'), SK,
                        T(r"You add a variable and $R^2$ rises from 0.8298 to 0.8302 while adjusted $R^2$ falls from 0.8098 to 0.7983. Should the variable stay?", r"你加了一个变量，$R^2$ 从 0.8298 升到 0.8302，调整后的 $R^2$ 却从 0.8098 降到 0.7983。这个变量该留吗？"),
                        [(T(r"No: the tiny rise in $R^2$ is not worth the extra variable; adjusted $R^2$ says the model got worse.", r"不该留：$R^2$ 那一点点上升不值得多一个变量；调整后的 $R^2$ 说明模型变差了。"), True),
                         (T(r"Yes: $R^2$ went up.", r"该留：$R^2$ 上升了。"), T(r"$R^2$ cannot go down when you add a variable, so it cannot tell a good addition from a useless one.", r"加变量时 $R^2$ 不可能下降，所以它分不出好的加法和没用的加法。"), 'r2-always-better'),
                         (T(r"It does not matter.", r"无所谓。"), T(r"Adjusted $R^2$ is exactly the number that matters here.", r"这里恰好要看调整后的 $R^2$。"), None)],
                        T(r"Compare models with adjusted $R^2$ (or the p-values): not with $R^2$.", r"比较模型要用调整后的 $R^2$（或各 p 值）：不要用 $R^2$。"), purpose='check'),
            number('adjbutler', T('Adjusted R² of Butler', 'Butler 的调整后 R²'), SK,
                   T(r"Butler’s model has $R^2 = 0.9038$, $n = 10$ drivers’ assignments and $p = 2$ variables. What is the adjusted $R^2$? (Four decimals.)", r"Butler 的模型 $R^2 = 0.9038$，$n = 10$ 次任务，$p = 2$ 个变量。调整后的 $R^2$ 是多少？（四位小数）"),
                   round(1 - (1 - .9038) * 9 / 7, 4), T(r"$1 - (1 - 0.9038)\dfrac{10 - 1}{10 - 2 - 1} = 1 - 0.0962 \times \dfrac{9}{7} = 0.8763$.", r"$1 - (1 - 0.9038)\dfrac{10 - 1}{10 - 2 - 1} = 1 - 0.0962 \times \dfrac{9}{7} = 0.8763$。"), tolerance=0.0006, purpose='practice'),

            read('exam', T('The exam’s version: Subaru’s orders', '考试里的版本：Subaru 的订货'),
                 p(T(r"Multiple regression can be the other variant of Question 5. The question gives an Excel output and asks you to *read* it. Six parts: the questions are on top of the table. Click the cell that answers each: it checks you and says what the examiner wants.", r"多元回归可能是第 5 题的另一种变体。题目给出一份 Excel 输出，要你*读*它。六问：问题在表的上方。点出回答每一问的格子：它会核对你，并说出阅卷人要什么。")),
                 paper(T('Past paper, multiple regression · 15 marks', '往年真题，多元回归 · 15 分'),
                       *ptxt("Subaru Australia wants to forecast the number of units of Subaru WRX (all variants) to order from Japan for 2020 using data from its past sales and knowledge about their previous customers. The table shows the number of WRX units sold in the past 20 quarters, the average age of buyers, their mean taxable income, the most indicative suburb profile rating of buyers (1 = poorest postcode, 5 = wealthiest postcode), and the most popular colour purchased during that quarter (1 = Black, 2 = Blue, 3 = Red, 4 = Silver, 5 = White). A regression output from Excel with Sales in units as the dependent variable is also shown. An alpha of .05 was used. (Use three decimal places).\n(i) Develop an estimated regression equation that can be used to predict sales given buyer’s average age, mean taxable income, suburb profile rating and colour of car purchased. (2 marks)\n(ii) Disregarding the colour of the car purchased, use the regression equation to predict the sales in units that can be expected if the average age of buyers is 44 with a mean taxable income of $96,523 and a suburb profile rating of 4. (2 marks)\n(iii) What conclusion can you draw from the Mean taxable income variable? How many more units can be sold by increasing this variable by $1,000? (4 marks)\n(iv) What does Significance F mean? Explain its purpose and meaning in the model. (2 marks)\n(v) Describe the overall fit of the model. (2 marks)\n(vi) What is the significance of the coefficient of the Suburb profile rating variable? How would you interpret its coefficient and its influence on sales? (3 marks)",
                             "Subaru Australia 想利用过去的销售数据和对以往客户的了解，预测 2020 年要从日本订购多少台 Subaru WRX（所有版本）。下表给出了过去 20 个季度 WRX 的销量、购买者平均年龄、平均应税收入、购买者最有代表性的郊区档次评级（1 = 最穷的邮编区，5 = 最富的邮编区），以及该季度最受欢迎的购车颜色（1 = 黑，2 = 蓝，3 = 红，4 = 银，5 = 白）。同时给出了以销量为因变量的 Excel 回归输出。显著性水平取 .05。（保留三位小数）。\n(i) 建立估计回归方程，用购买者平均年龄、平均应税收入、郊区档次评级和购车颜色预测销量。（2 分）\n(ii) 不考虑购车颜色，用回归方程预测：购买者平均年龄 44 岁、平均应税收入 $96,523、郊区档次评级为 4 时，预期的销量（台）。（2 分）\n(iii) 你能从平均应税收入这个变量得出什么结论？这个变量增加 $1,000，能多卖多少台？（4 分）\n(iv) Significance F 是什么意思？说明它在模型中的作用和含义。（2 分）\n(v) 描述模型的整体拟合情况。（2 分）\n(vi) 郊区档次评级变量的系数的显著性如何？你如何解释它的系数及其对销量的影响？（3 分）")),
                 table([T('Qtr', '季度'), T('Buyer average age', '购买者平均年龄'), T('Mean taxable income (AUD\\$)', '平均应税收入（澳元）'), T('Suburb profile rating', '郊区档次评级'), T('Colour', '颜色'), T('Sales (units)', '销量（台）')], *data_rows),
                 frame('reg_output.html', T('The Subaru regression output as Excel prints it, with the exam’s questions: click the cell that answers each.', 'Subaru 的回归输出（和 Excel 打印的一样），带着考试的各问：点出回答每一问的格子。'),
                       out=out_params(S), vars=[T('Buyer average age (years)', '购买者平均年龄（岁）'), T('Mean taxable income (AUD$)', '平均应税收入（澳元）'), T('Suburb profile rating', '郊区档次评级'), T('Colour of car purchased', '购车颜色')], tasks=tasks),
                 chapter=T('On the paper', '考卷上')),
            derive('sub_i', T('(i) and (ii): the equation and a prediction', '(i)(ii)：方程和预测'),
                   [(r"\hat y = 449.238 - 0.409x_1 + 0.004x_2 + 67.126x_3 + 5.334x_4", T(r"(i) Read the Coefficients column, to three decimals, as the question asks: the intercept first, then one coefficient per variable ($x_1$ age, $x_2$ income, $x_3$ suburb rating, $x_4$ colour).", r"(i) 按题目要求，把 Coefficients 一列读成三位小数：先是截距，再是每个变量一个系数（$x_1$ 年龄、$x_2$ 收入、$x_3$ 郊区评级、$x_4$ 颜色）。")),
                    (r"\hat y = 449.238 - 0.409(44) + 0.004(96523) + 67.126(4)", T(r"(ii) Leave out colour, as told, and put in the three values.", r"(ii) 按要求去掉颜色，代入三个值。")),
                    (r"= 449.238 - 17.996 + 386.092 + 268.504", T(r"Work out each term.", r"算出每一项。")),
                    (r"= 1085.838", T(r"About 1,086 units. With the unrounded income coefficient 0.00381 the prediction is about 1,068 (the income term is 367.8 instead of 386.1): rounding a small coefficient moves the answer, so follow the question’s “three decimal places” and say so.", r"约 1,086 台。如果用不取整的收入系数 0.00381，预测值约是 1,068（收入项是 367.8 而不是 386.1）：把一个小系数取整会让答案偏移，所以要照题目的“三位小数”，并写明这一点。"))],
                   outro=T(r"**Answer:** (i) as above; (ii) about 1,086 units (to three decimals of the coefficients).", r"**答案：** (i) 如上；(ii) 约 1,086 台（系数取三位小数）。"),
                   blank=(2, '1085.838', T(r"$449.238 - 17.996 + 386.092 + 268.504$.", r"$449.238 - 17.996 + 386.092 + 268.504$。")), skill=SK),
            read('answer', T('The full-mark answers to (iii) to (vi), as they are written', '(iii) 到 (vi) 的满分答案，写在卷子上是这样'),
                 paper(T('Subaru, (iii) to (vi), full marks', 'Subaru，(iii) 到 (vi)，满分写法'),
                       *ptxt("(iii) The p-value of mean taxable income, 0.0144, is less than 0.05, so it is a significant (strong) predictor of sales. Its coefficient is about 0.004: every extra dollar of mean taxable income is associated with 0.004 more units, so a $1,000 increase gives about 4 more units sold, holding the other variables constant.\n(iv) Significance F (1.16E−05 = 0.0000116) is the p-value of the F test of the whole model. Since it is less than 0.05, at least one of the independent variables is a significant predictor of sales: the model as a whole is useful.\n(v) Adjusted R² = 0.786: the independent variables together explain about 78.6% of the variation in unit sales, a strong fit (R² = 0.831 is also acceptable).\n(vi) The p-value of suburb profile rating (0.031) is less than 0.05, so the coefficient is significant. The coefficient is 67.126: for each one-point increase in the rating, sales are about 67 units higher on average, all other variables held constant: the wealthier the suburb, the more units are sold.",
                             "(iii) 平均应税收入的 p 值 0.0144 小于 0.05，所以它是销量的显著（强）预测变量。它的系数约为 0.004：平均应税收入每多一美元，销量多 0.004 台，所以增加 $1,000 约多卖 4 台，其他变量保持不变。\n(iv) Significance F（1.16E−05 = 0.0000116）是整个模型的 F 检验的 p 值。因为它小于 0.05，至少有一个自变量是销量的显著预测变量：模型整体是有用的。\n(v) 调整后的 R² = 0.786：自变量合起来解释了销量变化的约 78.6%，拟合很好（R² = 0.831 也可接受）。\n(vi) 郊区档次评级的 p 值 0.031 小于 0.05，所以这个系数是显著的。系数是 67.126：评级每高一级，平均销量约高 67 台，其他变量保持不变：郊区越富，卖得越多。"), answer=True),
                 callout('note', T('The three things every part wants', '每一问都要的三样东西'), T(r"**Significance** (compare the p-value with 0.05), **size** (the coefficient with units, “holding others constant”) and **fit** ($R^2$ or adjusted $R^2$ in words). Always quote the number you used.", r"**显著性**（把 p 值和 0.05 比）、**大小**（带单位的系数，“其他变量保持不变”）和**拟合**（用文字说 $R^2$ 或调整后的 $R^2$）。一定要引用你用的那个数。")),
                 chapter=T('The answer', '答案')),
            choice('ftest', T('Two tests', '两个检验'), SK,
                   T(r"In the Subaru output, Significance F is 0.0000116 but the age and colour variables have p-values 0.88 and 0.77. Is that a contradiction?", r"Subaru 的输出里，Significance F 是 0.0000116，但年龄和颜色这两个变量的 p 值是 0.88 和 0.77。这矛盾吗？"),
                   [(T(r"No: the F test says at least one variable helps; the t tests say which. Income and suburb rating help; age and colour add nothing.", r"不矛盾：F 检验说至少有一个变量有用；t 检验说是哪些。收入和郊区评级有用；年龄和颜色没有贡献。"), True),
                    (T(r"Yes: if the model is significant every variable must be.", r"矛盾：模型显著，每个变量就都应该显著。"), T(r"The F test is about the group, each t test about one variable.", r"F 检验针对整体，每个 t 检验针对一个变量。"), 'f-vs-t'),
                    (T(r"Yes: one of the two tests must be wrong.", r"矛盾：两个检验里有一个错了。"), T(r"They answer different questions.", r"它们回答的是不同的问题。"), 'f-vs-t')],
                   T(r"F: is the model useful? t: is this variable useful (given the others)?", r"F：模型有没有用？t：这个变量（在有其他变量时）有没有用？"), purpose='check'),

            read('collinear', T('When predictors are correlated with each other', '当预测变量彼此相关'),
                 p(T(rf"At the 2008 Olympics, medals won by 15 top countries were related to population, national income per person (GNI) and life expectancy. The **correlation matrix** shows how each pair of variables moves together. GNI and life expectancy have $r = {n(rg, 2)}$: they carry much the same information, so the regression cannot tell their separate effects apart. That is **multicollinearity**. The rule of thumb: a correlation above $+0.7$ or below $-0.7$ between two **predictors** is a warning; the easiest fix is to drop one of them.", rf"2008 年奥运会上，15 个领先国家的奖牌数与人口、人均国民收入（GNI）和预期寿命有关。**相关矩阵**显示每一对变量如何一起变化。GNI 和预期寿命的相关系数 $r = {n(rg, 2)}$：它们携带的信息大同小异，所以回归分不清它们各自的作用。这就是**多重共线性**。经验规则：两个**预测变量**之间的相关系数大于 $+0.7$ 或小于 $-0.7$ 是个警告；最简单的办法是去掉其中一个。")),
                 callout('note', T('A dummy variable', '虚拟变量'), T(rf"Qualitative predictors become 0/1 variables. Johnson Filtration predicts repair time from months since service ($x_1$) and repair type ($x_2 = 1$ mechanical, $0$ electrical): $\hat y = {n(Jo['b'][0], 3)} + {n(Jo['b'][1], 4)}x_1 {'+' if Jo['b'][2] > 0 else '−'} {n(abs(Jo['b'][2]), 4)}x_2$. The dummy’s coefficient is the difference in repair time between the two types at the same months: {'mechanical repairs take about ' + n(abs(Jo['b'][2]), 2) + ' hours less' if Jo['b'][2] < 0 else 'mechanical repairs take about ' + n(Jo['b'][2], 2) + ' hours more'}.", rf"定性的预测变量要变成 0/1 变量。Johnson Filtration 用距上次维修的月数（$x_1$）和维修类型（$x_2 = 1$ 为机械，$0$ 为电气）预测维修时间：$\hat y = {n(Jo['b'][0], 3)} + {n(Jo['b'][1], 4)}x_1 {'+' if Jo['b'][2] > 0 else '−'} {n(abs(Jo['b'][2]), 4)}x_2$。虚拟变量的系数是月数相同时两种类型维修时间的差：{'机械维修约少用 ' + n(abs(Jo['b'][2]), 2) + ' 小时' if Jo['b'][2] < 0 else '机械维修约多用 ' + n(Jo['b'][2], 2) + ' 小时'}。")),
                 chapter=T('Correlated predictors', '相关的预测变量')),
            choice('collinear_q', T('What to do', '怎么办'), SK,
                   T(rf"GNI and life expectancy correlate at {n(rg, 2)}. What is the sensible reaction?", rf"GNI 和预期寿命的相关系数是 {n(rg, 2)}。合理的做法是："),
                   [(T(r"Keep one of the two: with both, the coefficients of each are unreliable.", r"留下两者之一：两个都放进去，各自的系数都不可靠。"), True),
                    (T(r"Keep both: more variables always give a better model.", r"两个都留：变量越多模型总是越好。"), T(r"Correlated predictors make each coefficient unstable and hard to interpret.", r"相关的预测变量会让每个系数都不稳定、难以解释。"), 'r2-always-better'),
                    (T(r"Drop the dependent variable.", r"去掉因变量。"), T(r"The problem is between predictors, not with y.", r"问题出在预测变量之间，不在 y。"), None)],
                   T(r"Multicollinearity is correlation among the predictors, not between a predictor and y.", r"多重共线性是预测变量之间的相关，不是预测变量和 y 之间的相关。"), purpose='practice'),
            read('traps', T('Traps', '易错点'),
                 callout('warning', T('Holding others fixed', '其他变量保持不变'), T(r"Say it every time you interpret a coefficient in a multiple regression. It is a mark.", r"每次解释多元回归的系数都要说这句话。它是个得分点。")),
                 callout('warning', T('Which test', '哪个检验'), T(r"Whole model: Significance F. One variable: its own P-value. Do not swap them.", r"整个模型：Significance F。一个变量：它自己的 P-value。不要对调。")),
                 callout('warning', T('Association, not cause', '相关不是因果'), T(r"Income is associated with sales; it does not follow that raising buyers’ incomes would raise sales. The paper rewards “is associated with”.", r"收入和销量相关；不能由此推出提高购买者收入就会提高销量。试卷喜欢“与……相关”这种说法。")),
                 chapter=T('Traps', '易错点')),
            choice('recall_r2', T('Recall: r²', '回忆：r²'), SK,
                   T(r"For a simple regression $r^2 = 0.79$ means:", r"一元回归里 $r^2 = 0.79$ 的意思是："),
                   [(T(r"the line accounts for 79% of the variation in $y$.", r"这条线解释了 $y$ 的变化的 79%。"), True), (T(r"79% of the predictions are exactly right.", r"79% 的预测完全正确。"), T(r"That is not what it measures.", r"它度量的不是这个。"), 'r2-percent-correct'), (T(r"$x$ causes 79% of $y$.", r"$x$ 导致了 $y$ 的 79%。"), T(r"Correlation is not cause.", r"相关不是因果。"), 'causation')],
                   T(r"$r^2$ = SSR / SST: the share of variation explained.", r"$r^2$ = SSR / SST：被解释的变化所占的份额。"), purpose='check'),
            choice('recall_bayes', T('Recall: Bayes’ denominator', '回忆：贝叶斯的分母'), SK,
                   T(r"The posterior probability is a joint probability divided by:", r"后验概率是联合概率除以："),
                   [(T(r"the sum of the joint probabilities (the probability of the report).", r"联合概率之和（报告的概率）。"), True), (T(r"the prior.", r"先验。"), T(r"That is not the total of the report.", r"那不是报告的总概率。"), 'wrong-denominator'), (T(r"1.", r"1。"), T(r"Only if the report is certain.", r"只有当报告是必然时。"), None)],
                   T(r"Divide by P(report).", r"除以 P(报告)。"), purpose='check'),
        ],
    )
