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
             visual('tangent_develop', explore=False, caption=T('The [curve](noun:function) $f$, the point $P$, and the secants as $h$ is halved.', '[曲线](noun:function) $f$、点 $P$，以及 $h$ 不断减半时的割线。')),
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
        read('text', T('Text: a definition in its sentence, a chain of why', '文 · 句子里的定义，一串为什么'),
             p(T('The [derivative](def: the limit of $\\dfrac{f(x_0+h)-f(x_0)}{h}$ as $h \\to 0$, when that limit exists; then $f$ is [differentiable](def: having a derivative) at $x_0$) of $f$ at $x_0$ is the [slope](noun:value) the secants close onto. Tap a dotted word: its definition opens where you are reading, and the sentence carries on after it.',
                 '$f$ 在 $x_0$ 处的[导数](def: 当 $h \\to 0$ 时 $\\dfrac{f(x_0+h)-f(x_0)}{h}$ 的极限（如果这个极限存在）；这时称 $f$ 在 $x_0$ [可导](def: 导数存在)) 就是割线最后合拢到的那个[斜率](noun:value)。点一下带虚线的词：定义就在你正在读的地方展开，读完句子照常往下走。')),
             why(T('A function differentiable at $x_0$ is continuous there.', '在 $x_0$ 可导的函数，在那里一定连续。'),
                 because(T('$f(x_0+h) - f(x_0)$ is the quotient times $h$, and the product tends to $f\'(x_0) \\cdot 0 = 0$.', '$f(x_0+h) - f(x_0)$ 等于差商乘以 $h$，而这个乘积趋于 $f\'(x_0) \\cdot 0 = 0$。'),
                         because(T('The quotient tends to $f\'(x_0)$.', '差商趋于 $f\'(x_0)$。'),
                                 because(T('That is what differentiable means.', '可导的意思就是这个。'), kind='definition')),
                         because(T('A limit of a product is the product of the limits, when both exist.', '两个极限都存在时，乘积的极限等于极限的乘积。'), kind='assumption')),
                 because(T('So $f(x_0+h) \\to f(x_0)$: no jump at $x_0$.', '所以 $f(x_0+h) \\to f(x_0)$：在 $x_0$ 处没有跳跃。'),
                         because(T('Continuous at $x_0$ means exactly this.', '在 $x_0$ 连续说的正是这件事。'), kind='definition'))),
             p(T('The rings are hollow while a reason is only claimed; open one and it fills. The chain stops where there is nothing left to ask: a definition, or an assumption we agree to take.',
                 '一个理由只是被断言时，圆环是空心的；打开它，它就填满。链条停在无可再问的地方：一个定义，或一个我们同意接受的假设。')),
             steps((r'\frac{d}{dx}\,x^2', ), (r'\lim_{h\to 0}\frac{(x+h)^2 - x^2}{h}', T('the definition', '按定义')), (r'\lim_{h\to 0}\frac{2xh + h^2}{h}', T('expand, $x^2$ cancels', '展开，$x^2$ 抵消')), (r'\lim_{h\to 0}\,(2x + h)', T('divide by $h$', '除以 $h$')), (r'2x', T('let $h \to 0$', '令 $h \to 0$')))),
    ]
    return {'id': LID, 'mode': 'essay', 'title': T('The three zones (engine test)', '三个区域（引擎测试）'),
            'description': T('What joined the engine from the design specimen, each in its zone.', '从设计样本并入引擎的东西，各在各的区域。'),
            'minutes': 6, 'skills': [SKILL], 'misconceptions': [], 'steps': steps_}


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
