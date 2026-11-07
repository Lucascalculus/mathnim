#!/usr/bin/env python3
# The engine zones' demo (docs/design/ENGINE-ZONES.md): what joined the engine from the design specimen, each in the
# zone it belongs to (图 figure, 物 world, 文 text), in the real lesson page. One lesson, written as Mathium lesson JSON
# in apps/mathnim/public/demo/engine-zones/, listed last on the home page under Test. Not a course.
#   python3 docs/lessons/engine-zones/build.py && node apps/mathnim/tools/demo_check.mjs engine-zones
import json
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, '..'))
from lesson_kit import T, p, read, visual  # noqa: E402

ROOT = os.path.abspath(os.path.join(HERE, '..', '..', '..'))
DEMO = os.path.join(ROOT, 'apps', 'mathnim', 'public', 'demo')
CID = 'engine-zones'
LID = f'{CID}-tour'
SKILL = {'id': f'{CID}.tour', 'name': T('The three zones', '三个区域'), 'description': T('Figure, world and text, as the engine draws them.', '图、物、文，引擎画出来的样子。')}


def why(claim, *because): return {'type': 'why', 'claim': claim, 'because': list(because)}
def because(text, *under, kind=None):
    n = {'text': text}
    if under: n['because'] = list(under)
    if kind: n['kind'] = kind
    return n
def steps(*lines, nouns=None):
    b = {'type': 'steps', 'lines': [{'tex': l[0], **({'why': l[1]} if len(l) > 1 else {})} for l in lines]}
    if nouns: b['nouns'] = nouns
    return b


def lesson():
    steps_ = [
        read('figure', T('Figure: the tangent develops', '图 · 切线显影'),
             p(T('Nobody draws the tangent here. The [secant](noun:value) through $P$ and a second point $Q$ is drawn again and again as $Q$ comes in, each one left behind in transparent ink. Where they all agree the ink is deepest, and that is the tangent; then it turns from a guess (dashed, hollow) into a fact (solid).',
                 '这里没有人画切线。过 $P$ 和另一点 $Q$ 的[割线](noun:value)随着 $Q$ 靠近一遍遍画出来，每一条都用透明墨水留在纸上。它们都同意的地方墨最深，那就是切线；最后它从猜测（虚线、空心）变成事实（实线）。')),
             visual('tangent_develop', explore=True, caption=T('First your guess: tilt the hollow line through $P$ and let go. Then the secants come in as $h$ is halved, on the [curve](noun:function) $f$.', '先猜：转动过 $P$ 的空心直线，松手。然后 $h$ 不断减半，割线一条条进来，落在[曲线](noun:function) $f$ 上。'), predict=True),
             p(T('Here $f(x) = 0.15x^3 - 0.9x + 0.6$ and $x_0 = -2$. The same slope worked out by hand, with $f\'$ in the colour of the slope, in the formula as in the figure:', '这里 $f(x) = 0.15x^3 - 0.9x + 0.6$，$x_0 = -2$。同一个斜率用手算出来，$f\'$ 用的是斜率的颜色，公式里和图里一样：')),
             steps((r"f'(x) = 0.45x^2 - 0.9", ), (r"f'(-2) = 0.45(-2)^2 - 0.9", T('put in $x_0 = -2$', '代入 $x_0 = -2$')), (r"f'(-2) = 0.45 \cdot 4 - 0.9", T('square $-2$', '$-2$ 平方')), (r"f'(-2) = 1.8 - 0.9", T('multiply', '相乘')), (r"f'(-2) = 0.9", T('subtract', '相减')), nouns={"f'": 'value'}),
             p(T('Try another function: the same picture works for any curve smooth at $P$.', '换一个函数：只要曲线在 $P$ 处光滑，同样的画面都成立。')),
             visual('tangent_develop', explore=False, caption=T('$f(x) = \\sin x$ at $x_0 = 0.5$.', '$f(x) = \\sin x$，$x_0 = 0.5$。'), fn='\\sin x', x0=0.5)),
        read('world', T('World: time as matter', '物 · 时间成为物质'),
             p(T('First a guess, before any explanation: where will this ball land? The hollow ring on the ground is your guess; letting go of it throws the ball, and the distance between your guess and the landing is drawn.',
                 '先猜，再听解释：这个球会落在哪里？地上的空心圆环就是你的猜测；松手就把球抛出去，你的猜测和实际落点之间差多远会画出来。')),
             visual('phys_throw', explore=True, caption=T('A guess is hollow until the world answers it.', '猜测在世界给出答案之前，都是空心的。'), predict=True),
             p(T('A thrown [ball](noun:ball) leaves its past on the paper: where it was every tenth of a second, and the next third of a second dashed, as a guess. Look at the spacing before any number. Across, the ghosts are evenly spaced; up, they close together toward the top and open out on the way down.',
                 '抛出去的[球](noun:ball)把它的过去留在纸上：每 0.1 秒所在的位置，以及接下来 0.35 秒的虚线，那是一个猜测。先别看数字，看间距。横着看，影子间隔均匀；竖着看，越接近顶点挤得越紧，下落时又拉开。')),
             visual('phys_throw', explore=True, caption=T('The last tenth of a second as its two legs: [across](noun:horizontal) never changes, [up](noun:vertical) shrinks to nothing at the top (ticked), then turns downward. Drag the arrow and let go to throw again.', '最近 0.1 秒拆成两段：[横向](noun:horizontal)始终不变，[竖直](noun:vertical)在顶点（刻线处）缩成零，然后转为向下。拖动箭头再松手，可以重新抛。')),
             p(T('Nothing pushes the ball sideways, so it keeps its horizontal speed; gravity takes the same amount off its vertical speed every tenth of a second. The parabola is just these two facts drawn together.',
                 '没有东西横着推球，所以水平速度保持不变；重力每 0.1 秒从竖直速度里减去同样多。抛物线不过是把这两件事画在一起。'))),
        read('text', T('Text: what a sentence can hold', '文 · 一句话里能装下什么'),
             p(T('The [derivative](def: the limit of the slopes of the secants as $h \\to 0$, when that limit exists; then $f$ is [differentiable](def: having a derivative there) at $x_0$) of $f$ at $x_0$ is the [slope](noun:value) the secants close onto[^cauchy]. In symbols it is the limit of one fraction:',
                 '$f$ 在 $x_0$ 处的[导数](def: 当 $h \\to 0$ 时割线斜率的极限（如果这个极限存在）；这时称 $f$ 在 $x_0$ [可导](def: 在那里导数存在))就是割线最后合拢到的那个[斜率](noun:value)[^cauchy]。写成符号，就是一个分式的极限：')),
             {'type': 'math', 'tex': r'\frac{f(x_0+h) - f(x_0)}{h}', 'parts': [
                 {'tex': r'\frac{f(x_0+h) - f(x_0)}{h}', 'says': T('the slope of the secant: how steep, between two points', '割线的斜率：两点之间有多陡'), 'parts': [
                     {'tex': 'f(x_0+h) - f(x_0)', 'says': T('the rise: how much higher the second point is', '升高：第二个点高出多少'), 'parts': [
                         {'tex': 'f(x_0+h)', 'says': T('the height at the second point', '第二个点的高度')},
                         {'tex': 'f(x_0)', 'says': T('the height at P', 'P 点的高度')}]},
                     {'tex': 'h', 'says': T('the run: how far apart the two points are', '水平距离：两点相距多远')}]}]},
             p(T("Bayes' rule, taken apart like an exploded drawing: pull it up, or tap it; tap a card that holds more to take it apart in turn.", '贝叶斯公式，像工程分解图一样拆开：往上拉，或点一下；装着更多的卡片可以再点开。')),
             {'type': 'math', 'tex': BAYES, 'parts': BAYES_PARTS, 'nouns': {'A': 'hypothesis', 'B': 'evidence'}},
             p(T('The same, apart in the plane (for comparison: no camera turn).', '同一个公式，在平面里拆开（对照：镜头不转）。')),
             {'type': 'math', 'tex': BAYES, 'parts': BAYES_PARTS, 'nouns': {'A': 'hypothesis', 'B': 'evidence'}, 'view': 'flat'},
             p(T('Take $f(x) = x^2$ at $x_0 = 1$. With the second point {{h = 1, 0.1..2, 0.1}} to the right, the secant rises {{= (1+h)^2 - 1, 2}} over that run: its slope is {{= ((1+h)^2 - 1)/h, 2}}. The closer the points, the closer that is to 2.',
                 '取 $f(x) = x^2$，$x_0 = 1$。第二个点在右边 {{h = 1, 0.1..2, 0.1}} 处时，割线在这段距离上升高 {{= (1+h)^2 - 1, 2}}，斜率是 {{= ((1+h)^2 - 1)/h, 2}}。两点越近，它就越接近 2。')),
             p(T('A matrix moves the plane. With $a$ = {{a = 1.5, -3..3, 0.1}}, $b$ = {{b = 1, -3..3, 0.1}}, $c$ = {{c = 0.5, -3..3, 0.1}} and $d$ = {{d = 2, -3..3, 0.1}}, the unit square becomes a [parallelogram](noun:determinant) whose area is $ad - bc$ = {{= a*d - b*c, 2}}. The numbers in the sentence and the numbers in the figure are the same numbers.',
                 '矩阵会移动整个平面。取 $a$ = {{a = 1.5, -3..3, 0.1}}，$b$ = {{b = 1, -3..3, 0.1}}，$c$ = {{c = 0.5, -3..3, 0.1}}，$d$ = {{d = 2, -3..3, 0.1}}，单位正方形变成一个[平行四边形](noun:determinant)，面积是 $ad - bc$ = {{= a*d - b*c, 2}}。句子里的数和图里的数是同一组数。')),
             {**visual('determinant_area', explore=True, caption=T('The [parallelogram](noun:determinant) of the columns of $A$.', '$A$ 的两列围成的[平行四边形](noun:determinant)。'), A=[[1.5, 1], [0.5, 2]], show_collapse=False), 'bind': {'a': 'a', 'b': 'b', 'c': 'c', 'd': 'd'}},
             steps((r'\lim_{h\to 0}\frac{(1+h)^2 - 1}{h}', ), (r'\lim_{h\to 0}\frac{2h + h^2}{h}', T('expand: the 1s cancel', '展开：两个 1 抵消')), (r'\lim_{h\to 0}\,(2 + h)', T('divide by $h$', '除以 $h$')), (r'2', T(r'let $h \to 0$', r'令 $h \to 0$'))),
             p(T('Solving an equation: each step does the same to both sides, and you see it done before it is worked out.', '解方程：每一步都对两边做同样的事；先看见它怎么做，再看它算出来。')),
             steps(('2x + 3 = 11',), ('2x = 8', T('take 3 from both sides', '两边减 3')), ('x = 4', T('divide both sides by 2', '两边除以 2')), nouns={'x': 'value'}),
             p(T('The same moves find the best slope $w$ of a line through data. First what is being made small, block by block (pull it up, or tap it):', '同样的动作也能求出过一组数据的直线的最佳斜率 $w$。先一块一块看要变小的是什么（往上拉，或点一下）：')),
             {'type': 'math', 'tex': r'L(w) = \frac{1}{n}\sum_i (w x_i - y_i)^2', 'parts': [
                 {'tex': r'\frac{1}{n}\sum_i', 'says': T('**average** over all n points', '**平均** 对全部 n 个点取平均')},
                 {'tex': '(w x_i - y_i)^2', 'says': T("point i's miss, squared: big misses count far more", '第 i 个点的偏差平方：大的偏差算得多得多'), 'parts': [
                     {'tex': 'w x_i - y_i', 'says': T('**miss** where the line says, minus where the point is', '**偏差** 直线给的值减去点的实际位置'), 'parts': [
                         {'tex': 'w x_i', 'says': T('the line at $x_i$', '直线在 $x_i$ 处的高度')},
                         {'tex': 'y_i', 'says': T('the point itself', '点本身的高度')}]}]}]},
             p(T('Then the derivation, from its mean squared error $L(w)$:', '然后是推导，从均方误差 $L(w)$ 出发：')),
             steps((r'L(w) = \frac{1}{n}\sum_i (w x_i - y_i)^2',),
                   (r"L'(w) = \frac{2}{n}\sum_i x_i\,(w x_i - y_i)", T("chain rule: the square's 2 comes down, the inside's slope $x_i$ comes out", '链式法则：平方的 2 落到前面，里面的斜率 $x_i$ 乘出来')),
                   (r'\frac{2}{n}\sum_i x_i\,(w x_i - y_i) = 0', T('at the lowest point the slope is 0', '最低点处斜率为 0')),
                   (r'\sum_i x_i\,(w x_i - y_i) = 0', T('multiply both sides by $n/2$', '两边乘以 $n/2$')),
                   (r'w\sum_i x_i^2 - \sum_i x_i y_i = 0', T('multiply out', '乘开')),
                   (r'w\sum_i x_i^2 = \sum_i x_i y_i', T(r'add $\sum_i x_i y_i$ to both sides', r'两边加上 $\sum_i x_i y_i$')),
                   (r'w = \frac{\sum_i x_i y_i}{\sum_i x_i^2}', T(r'divide both sides by $\sum_i x_i^2$', r'两边除以 $\sum_i x_i^2$')), nouns={'w': 'value'}),
             why(T('A function differentiable at $x_0$ is continuous there.', '在 $x_0$ 可导的函数，在那里一定连续。'),
                 because(T('$f(x_0+h) - f(x_0)$ is the quotient times $h$, and the product tends to $f\'(x_0) \\cdot 0 = 0$.', '$f(x_0+h) - f(x_0)$ 等于差商乘以 $h$，而这个乘积趋于 $f\'(x_0) \\cdot 0 = 0$。'),
                         because(T('The quotient tends to $f\'(x_0)$.', '差商趋于 $f\'(x_0)$。'),
                                 because(T('That is what differentiable means.', '可导的意思就是这个。'), kind='definition')),
                         because(T('A limit of a product is the product of the limits, when both exist.', '两个极限都存在时，乘积的极限等于极限的乘积。'), kind='assumption')),
                 because(T('So $f(x_0+h) \\to f(x_0)$: no jump at $x_0$.', '所以 $f(x_0+h) \\to f(x_0)$：在 $x_0$ 处没有跳跃。'),
                         because(T('Continuous at $x_0$ means exactly this.', '在 $x_0$ 连续说的正是这件事。'), kind='definition'))),
             {'type': 'details', 'summary': T('The other way round is false', '反过来不成立'), 'blocks': [
                 p(T('$|x|$ is continuous at 0 but has no derivative there: from the right the secants have slope 1, from the left −1.', '$|x|$ 在 0 处连续，却没有导数：从右边看割线斜率是 1，从左边看是 −1。')),
                 p(T('The two sides close onto different lines, so there is no one tangent.', '两边合拢到不同的直线上，所以没有唯一的切线。'))]},
             {'type': 'cite', 'key': 'cauchy', 'text': T('Cauchy, Cours d’analyse (1821): the derivative as the limit of a ratio of differences.', '柯西《分析教程》（1821）：把导数定义为差之比的极限。'), 'url': 'https://en.wikipedia.org/wiki/Cours_d%27analyse'}),
    ]
    return {'id': LID, 'mode': 'essay', 'title': T('The three zones (engine test)', '三个区域（引擎测试）'),
            'description': T('What joined the engine from the design specimen, each in its zone.', '从设计样本并入引擎的东西，各在各的区域。'),
            'minutes': 6, 'skills': [SKILL], 'misconceptions': [], 'steps': steps_}


BAYES = r'P(A\mid B) = \frac{P(B\mid A)\,P(A)}{P(B)}'
BAYES_PARTS = [
    {'tex': r'P(A\mid B)', 'says': T('**posterior** how believable $A$ is after $B$', '**后验** 看到 $B$ 之后，$A$ 有多可信')},
    {'tex': r'\frac{P(B\mid A)\,P(A)}{P(B)}', 'says': T("**update** the share of $B$'s cases in which $A$ also holds", '**更新** 在 $B$ 发生的情况里，$A$ 也成立的份额'), 'parts': [
        {'tex': r'P(B\mid A)\,P(A)', 'says': T('**joint** how often $A$ and $B$ happen together', '**联合** $A$ 和 $B$ 一起发生有多常见'), 'parts': [
            {'tex': r'P(B\mid A)', 'says': T('**likelihood** how likely $B$ is if $A$ holds', '**似然** 如果 $A$ 成立，看到 $B$ 的可能')},
            {'tex': 'P(A)', 'says': T('**prior** belief in $A$ before $B$', '**先验** 看到 $B$ 之前，对 $A$ 的相信')}]},
        {'tex': 'P(B)', 'says': T('**evidence** how common $B$ is anyway', '**证据** $B$ 本身有多常见')}]},
]


def build():
    out_dir = os.path.join(DEMO, CID)
    os.makedirs(out_dir, exist_ok=True)
    L = lesson()
    with open(os.path.join(out_dir, f'{LID}.json'), 'w', encoding='utf8') as f:
        json.dump(L, f, ensure_ascii=False, separators=(',', ':'))
    entry = {'id': LID, 'title': L['title'], 'summary': L['description'], 'minutes': L['minutes'],
             'meta': {'title': L['title'], 'mode': 'essay', 'langs': ['en', 'zh'], 'has_scene': False,
                      'kinds': sorted({s['kind'] for s in L['steps']}), 'skills': L['skills']}}
    course = {
        'id': CID,
        'title': T('Three zones (engine test)', '三个区域（引擎测试）'),
        'summary': T('Not a course: the design specimen\'s materials as they joined the engine, in figure, world and text.', '不是一门课：设计样本里的材质并入引擎后的样子，分在图、物、文三个区域。'),
        'audience': T('Reviewers of the engine.', '引擎的审阅者。'),
        'outcomes': [],
        'lang': 'en', 'mine': False, 'public': True, 'ready': True, 'test': True, 'packs': ['physics'],
        'origin': {'decks': 0, 'exams': 0, 'note': T('Written by an AI (Claude) as an engine test · not a course', '由 AI（Claude）为测试引擎而写 · 不是一门课')},
        'units': [{'title': T('Zones', '区域'), 'lessons': [LID]}], 'lessons': [entry], 'demo': True,
    }
    path = os.path.join(DEMO, 'courses.json')
    with open(path, encoding='utf8') as f:
        courses = json.load(f)
    courses = [c for c in courses if c.get('id') != CID] + [course]
    with open(path, 'w', encoding='utf8') as f:
        json.dump(courses, f, ensure_ascii=False, indent=1)
    print(f'{LID} -> {out_dir}; courses.json has {len(courses)} courses')


if __name__ == '__main__':
    build()
