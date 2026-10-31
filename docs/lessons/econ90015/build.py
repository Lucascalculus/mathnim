#!/usr/bin/env python3
# Builds the ECON90015 demo course (README.md here): eight lessons as Mathnim lesson JSON in
# apps/mathnim/public/demo/econ90015/, and its entry in apps/mathnim/public/demo/courses.json.
#   python3 docs/lessons/econ90015/build.py && node apps/mathnim/tools/demo_check.mjs econ90015
# The diagrams are drawn from the same functions the questions use, so every point is where the
# numbers put it.
import json
import math
import os

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..', '..'))
DEMO = os.path.join(ROOT, 'apps', 'mathnim', 'public', 'demo')
CID = 'econ90015'


def T(en, zh):
    return {'en': en, 'zh': zh}


# ---------------------------------------------------------------- blocks and steps (packages/core content.ts, schema.ts)
def p(t): return {'type': 'p', 'text': t}
def h(t): return {'type': 'h', 'text': t}
def ul(*items): return {'type': 'list', 'items': list(items)}
def ol(*items): return {'type': 'list', 'items': list(items), 'ordered': True}
def math_(tex): return {'type': 'math', 'tex': tex}
def table(head, *rows): return {'type': 'table', 'head': list(head), 'rows': [list(r) for r in rows]}
def callout(kind, title, body): return {'type': 'callout', 'kind': kind, 'title': title, 'body': body}
def details(summary, *blocks): return {'type': 'details', 'summary': summary, 'blocks': list(blocks)}
def svg(markup, alt, caption=None):
    b = {'type': 'svg', 'svg': markup, 'alt': alt}
    if caption: b['caption'] = caption
    return b


def visual(name, caption=None, explore=True, **params):
    """An interactive figure from @mathnim/visuals' econ pack (loaded by the course entry's `packs`)."""
    b = {'type': 'visual', 'name': name, 'explore': explore}
    if params: b['params'] = params
    if caption: b['caption'] = caption
    return b


def quiz(prompt, options, explain):
    """A small question inside a page: options are (label, True) for the right one or (label, why it is wrong)."""
    opts = []
    for o in options:
        d = {'label': o[0]}
        if o[1] is True: d['correct'] = True
        elif o[1]: d['feedback'] = o[1]
        opts.append(d)
    return {'type': 'quiz', 'prompt': prompt, 'options': opts, 'explain': explain}


def read(id, title, *blocks, chapter=None):
    s = {'kind': 'read', 'id': id, 'title': title, 'blocks': list(blocks)}
    if chapter: s['chapter'] = chapter
    return s


def derive(id, title, lines, intro=None, outro=None, chapter=None, blank=None, skill=None):
    """A worked solution revealed line by line; `blank` = (line, answer, prompt[, variables]) leaves one line for the learner."""
    s = {'kind': 'derive', 'id': id, 'title': title, 'lines': [{'tex': tex, 'why': why} for tex, why in lines]}
    if intro: s['intro'] = intro
    if outro: s['outro'] = outro
    if chapter: s['chapter'] = chapter
    if blank:
        s['blank'] = {'line': blank[0], 'answer': blank[1], 'prompt': blank[2]}
        if len(blank) > 3: s['blank']['variables'] = blank[3]
    if skill: s['skill'] = skill
    return s


def number(id, title, skill, prompt, answer, explain, tolerance=None, unit=None, hints=(), purpose='practice', chapter=None):
    q = {'type': 'number', 'answer': answer}
    if tolerance is not None: q['tolerance'] = tolerance
    if unit: q['unit'] = unit
    s = {'kind': 'checkpoint', 'id': id, 'title': title, 'skill': skill, 'purpose': purpose, 'prompt': prompt, 'question': q, 'explain': explain}
    if hints: s['hints'] = list(hints)
    if chapter: s['chapter'] = chapter
    return s


def choice(id, title, skill, prompt, options, explain, purpose='check', chapter=None):
    opts = []
    for i, o in enumerate(options):
        d = {'id': chr(97 + i), 'label': o[0]}
        if o[1] is True: d['correct'] = True
        elif o[1]: d['feedback'] = o[1]
        if len(o) > 2 and o[2]: d['misconception'] = o[2]
        opts.append(d)
    s = {'kind': 'checkpoint', 'id': id, 'title': title, 'skill': skill, 'purpose': purpose, 'prompt': prompt, 'question': {'type': 'choice', 'options': opts}, 'explain': explain}
    if chapter: s['chapter'] = chapter
    return s


def text_q(id, title, skill, prompt, key_points, model_answer, explain, chapter=None):
    s = {'kind': 'checkpoint', 'id': id, 'title': title, 'skill': skill, 'purpose': 'check', 'prompt': prompt,
         'question': {'type': 'text', 'rubric': {'key_points': key_points, 'model_answer': model_answer, 'min_points': max(1, len(key_points) - 1)}}, 'explain': explain}
    if chapter: s['chapter'] = chapter
    return s


# ---------------------------------------------------------------- diagrams
INK, MUTED, BLUE, ORANGE, PURPLE, GREEN, GOLD = '#1f2328', '#6b7077', '#2f5bd3', '#c2410c', '#7c3aed', '#0f766e', '#b7791f'


class Plot:
    """Data coordinates -> a 640 x 400 SVG; the plot box leaves room for the axis labels."""

    def __init__(self, x0, x1, y0, y1, w=640, h=400, left=64, right=40, top=38, bottom=52):
        self.x0, self.x1, self.y0, self.y1 = x0, x1, y0, y1
        self.w, self.h, self.l, self.r, self.t, self.b = w, h, left, right, top, bottom
        self.parts = []

    def X(self, x): return self.l + (x - self.x0) / (self.x1 - self.x0) * (self.w - self.l - self.r)
    def Y(self, y): return self.h - self.b - (y - self.y0) / (self.y1 - self.y0) * (self.h - self.t - self.b)
    def pt(self, x, y): return f'{self.X(x):.1f},{self.Y(y):.1f}'

    def curve(self, f, a, b, color, width=3, dash=None, n=60):
        pts = ' '.join(self.pt(a + (b - a) * i / n, f(a + (b - a) * i / n)) for i in range(n + 1))
        d = f' stroke-dasharray="{dash}"' if dash else ''
        self.parts.append(f'<polyline points="{pts}" fill="none" stroke="{color}" stroke-width="{width}" stroke-linecap="round" stroke-linejoin="round"{d}/>')

    def seg(self, a, b, color, width=2, dash=None):
        d = f' stroke-dasharray="{dash}"' if dash else ''
        self.parts.append(f'<line x1="{self.X(a[0]):.1f}" y1="{self.Y(a[1]):.1f}" x2="{self.X(b[0]):.1f}" y2="{self.Y(b[1]):.1f}" stroke="{color}" stroke-width="{width}" stroke-linecap="round"{d}/>')

    def area(self, pts, color, opacity=0.18):
        self.parts.append(f'<polygon points="{" ".join(self.pt(x, y) for x, y in pts)}" fill="{color}" fill-opacity="{opacity}" stroke="none"/>')

    def dot(self, x, y, color=INK, r=5):
        self.parts.append(f'<circle cx="{self.X(x):.1f}" cy="{self.Y(y):.1f}" r="{r}" fill="{color}"/>')

    def text(self, x, y, s, color=INK, size=17, anchor='start', dx=0, dy=0, weight=None):
        w = f' font-weight="{weight}"' if weight else ''
        self.parts.append(f'<text x="{self.X(x) + dx:.1f}" y="{self.Y(y) + dy:.1f}" font-size="{size}" fill="{color}" text-anchor="{anchor}"{w}>{s}</text>')

    def guide(self, x, y):
        """Dashed lines from a point to both axes."""
        self.seg((x, y), (x, self.y0), MUTED, 1.5, '5 5')
        self.seg((x, y), (self.x0, y), MUTED, 1.5, '5 5')

    def axes(self, xlabel, ylabel, xticks=(), yticks=()):
        ax = [
            f'<line x1="{self.l}" y1="{self.h - self.b}" x2="{self.w - self.r + 14}" y2="{self.h - self.b}" stroke="{INK}" stroke-width="2"/>',
            f'<line x1="{self.l}" y1="{self.h - self.b}" x2="{self.l}" y2="{self.t - 10}" stroke="{INK}" stroke-width="2"/>',
            f'<text x="{self.w - self.r + 18}" y="{self.h - self.b + 6}" font-size="18" fill="{INK}" font-style="italic">{xlabel}</text>',
            f'<text x="{self.l - 8}" y="{self.t - 14}" font-size="18" fill="{INK}" text-anchor="end" font-style="italic">{ylabel}</text>',
        ]
        for v in xticks:
            ax.append(f'<text x="{self.X(v):.1f}" y="{self.h - self.b + 22}" font-size="15" fill="{MUTED}" text-anchor="middle">{v}</text>')
        for v in yticks:
            ax.append(f'<text x="{self.l - 8}" y="{self.Y(v) + 5:.1f}" font-size="15" fill="{MUTED}" text-anchor="end">{v}</text>')
        self.parts = ax + self.parts

    def svg(self):
        body = ''.join(self.parts)
        return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {self.w} {self.h}" font-family="sans-serif">'
                f'<rect width="{self.w}" height="{self.h}" fill="#ffffff"/>{body}</svg>')


def fig_quota():
    P = Plot(0, 125, 0, 64)
    P.area([(0, 30), (60, 30), (60, 10), (0, 10)], ORANGE, 0.16)
    P.area([(60, 30), (100, 10), (60, 10)], BLUE, 0.2)
    P.curve(lambda q: 60 - q / 2, 0, 120, BLUE)
    P.curve(lambda q: q / 10, 0, 60, ORANGE)
    P.curve(lambda q: q / 10, 60, 125, ORANGE, 2, '6 6')
    P.seg((60, 6), (60, 62), ORANGE, 3)
    P.guide(100, 10)
    P.guide(60, 30)
    P.dot(100, 10, BLUE)
    P.dot(60, 30, ORANGE)
    P.text(30, 20, 'A', ORANGE, 20, 'middle', dy=6, weight='600')
    P.text(72, 17, 'B', BLUE, 20, 'middle', dy=6, weight='600')
    P.text(116, 4, 'D', BLUE, 18)
    P.text(122, 12.5, 'S', ORANGE, 18, dy=-10)
    P.text(60, 60, 'Q = 60', ORANGE, 16, dx=8)
    P.axes('Q', 'p', xticks=(60, 100, 120), yticks=(10, 30, 60))
    return P.svg()


def fig_cost():
    P = Plot(0, 40, 0, 260)
    ac = lambda q: q * q - 50 * q + 750
    mc = lambda q: 3 * q * q - 100 * q + 750
    P.curve(ac, 15, 35, BLUE)
    P.curve(mc, 21.9, 27.25, ORANGE)
    P.guide(25, 125)
    P.dot(25, 125, INK)
    P.text(35, ac(35), 'LRAC', BLUE, 17, dx=8, dy=5)
    P.text(27.25, 252, 'LMC', ORANGE, 17, dx=6)
    P.text(25, 125, 'min LRAC = 125', INK, 16, dx=16, dy=32)
    P.axes('q', '$', xticks=(15, 25, 35), yticks=(125, 225))
    return P.svg()


def fig_monopoly():
    P = Plot(0, 310, 0, 640)
    P.area([(108, 384), (108, 168), (180, 240)], PURPLE, 0.2)
    P.curve(lambda q: 600 - 2 * q, 0, 300, BLUE)
    P.curve(lambda q: 600 - 4 * q, 0, 150, PURPLE)
    P.curve(lambda q: 60 + q, 0, 300, ORANGE)
    P.guide(108, 384)
    P.seg((108, 384), (108, 168), MUTED, 1.5, '5 5')
    P.seg((180, 240), (180, 0), MUTED, 1.5, '5 5')
    P.dot(108, 384, BLUE)
    P.dot(108, 168, ORANGE)
    P.dot(180, 240, INK, 4)
    P.text(132, 262, 'DWL', PURPLE, 15, 'middle', weight='600')
    P.text(300, 0, 'D', BLUE, 18, dx=-4, dy=-10)
    P.text(150, 0, 'MR', PURPLE, 18, dx=6, dy=-10)
    P.text(300, 360, 'MC', ORANGE, 18, dx=-30, dy=-10)
    P.text(108, 384, 'p = 384', BLUE, 16, dx=10, dy=-8)
    P.axes('Q', 'p', xticks=(108, 180, 300), yticks=(168, 240, 384, 600))
    return P.svg()


def entry_q(p):
    """One Q5 firm's output at price p (the rising branch of LMC = p)."""
    return (100 + math.sqrt(1000 + 12 * p)) / 6


def entry_sr_price(n, a):
    """Short-run price with n firms and demand Q = a − 4p (bisection on n·q(p) = a − 4p, p >= 125)."""
    lo, hi = 125.0, 600.0
    for _ in range(60):
        mid = (lo + hi) / 2
        if n * entry_q(mid) > a - 4 * mid: hi = mid
        else: lo = mid
    return (lo + hi) / 2


def fig_entry():
    P = Plot(1600, 2600, 0, 280, left=70)
    pb = entry_sr_price(76, 2800)
    qb = 2800 - 4 * pb
    P.seg((1600, 125), (2600, 125), GREEN, 3, '8 6')
    P.curve(lambda q: (2400 - q) / 4, 1600, 2400, BLUE, 3)
    P.curve(lambda q: (2800 - q) / 4, 1700, 2600, BLUE, 3)
    for n, col in ((76, ORANGE), (92, ORANGE)):
        pts = ' '.join(P.pt(n * entry_q(pp), pp) for pp in [125 + 2.5 * i for i in range(61)])
        P.parts.append(f'<polyline points="{pts}" fill="none" stroke="{col}" stroke-width="3" stroke-linejoin="round"/>')
    P.guide(qb, pb)
    for x, y, lab, dx, dy in ((1900, 125, 'A', -16, -10), (qb, pb, 'B', 10, -8), (2300, 125, 'C', -18, 22)):
        P.dot(x, y, INK)
        P.text(x, y, lab, INK, 18, dx=dx, dy=dy, weight='600')
    P.text(2400, 0, 'D₀', BLUE, 17, dx=4, dy=-8)
    P.text(2600, 50, 'D₁', BLUE, 17, dx=-26, dy=-14)
    P.text(76 * entry_q(270), 270, '76 firms', ORANGE, 15, 'end', dx=-8, dy=4)
    P.text(92 * entry_q(270), 270, '92', ORANGE, 15, dx=6, dy=4)
    P.text(2600, 125, 'LRS', GREEN, 16, 'end', dy=-10)
    P.axes('Q', 'p', xticks=(1900, 2300), yticks=(125, round(pb)))
    return P.svg()


def fig_packages():
    P = Plot(0, 25, 0, 26)
    P.area([(0, 0), (0, 16), (2, 14), (2, 0)], GREEN, 0.22)
    P.area([(0, 16), (0, 24), (2, 22), (2, 14)], GOLD, 0.3)
    P.curve(lambda q: 24 - q, 0, 24, BLUE)
    P.curve(lambda q: 16 - q, 0, 16, PURPLE)
    P.seg((0, 6), (25, 6), ORANGE, 2.5)
    P.guide(18, 6)
    P.seg((2, 22), (2, 0), MUTED, 1.5, '5 5')
    P.dot(18, 6, BLUE)
    P.text(1, 7, 'T₂', GREEN, 18, 'middle', weight='600')
    P.text(1, 19, 'R', GOLD, 18, 'middle', dy=6, weight='600')
    P.text(22, 2, 'D₁', BLUE, 18, dx=6)
    P.text(14, 2, 'D₂', PURPLE, 18, dx=6)
    P.text(25, 6, 'MC', ORANGE, 17, dx=-30, dy=-8)
    P.axes('q', 'p', xticks=(2, 18), yticks=(6, 16, 24))
    return P.svg()


def fig_cournot():
    P = Plot(0, 520, 0, 520)
    P.seg((120, 0), (0, 480), BLUE, 3)
    P.seg((0, 192), (480, 0), ORANGE, 3)
    P.guide(80, 160)
    P.dot(80, 160, INK)
    for x, y, c in ((120, 0, BLUE), (0, 480, BLUE), (0, 192, ORANGE), (480, 0, ORANGE)):
        P.dot(x, y, c, 4)
    P.text(20, 400, 'R₁', BLUE, 19, dx=10, weight='600')
    P.text(380, 40, 'R₂', ORANGE, 19, dy=-10, weight='600')
    P.text(80, 160, '(80, 160)', INK, 16, dx=10, dy=-10)
    P.axes('q₁', 'q₂', xticks=(80, 120, 480), yticks=(160, 192, 480))
    return P.svg()


def fig_malthus(immigration=False):
    P = Plot(0, 10, 0, 10.5)
    f = lambda n: 3 * math.sqrt(n)
    P.curve(f, 0, 10, BLUE, 3, n=120)
    P.seg((0, 0), (6.6, 9.9), GREEN, 2.5)
    P.guide(4, 6)
    P.dot(4, 6, INK)
    P.text(10, f(10), 'Y = A·f(N, K)', BLUE, 16, 'end', dy=50)
    P.text(6.6, 9.9, 'y*', GREEN, 18, dx=8, weight='600')
    if immigration:
        n1 = 7.0
        P.seg((0, 0), (9.0, f(n1) / n1 * 9.0), GOLD, 2, '7 6')
        P.guide(n1, f(n1))
        P.dot(n1, f(n1), GOLD)
        P.text(9.0, f(n1) / n1 * 9.0, 'Y₁/N₁', GOLD, 16, dx=6, dy=4)
        P.seg((n1 - 0.25, 1.2), (4.35, 1.2), GOLD, 2.5)
        P.parts.append(f'<polygon points="{P.X(4.3):.1f},{P.Y(1.2):.1f} {P.X(4.6):.1f},{P.Y(1.2) - 7:.1f} {P.X(4.6):.1f},{P.Y(1.2) + 7:.1f}" fill="{GOLD}"/>')
        P.axes('N', 'Y')
        P.text(4, 0, 'N*', INK, 16, 'middle', dy=22)
        P.text(n1, 0, 'N₁', GOLD, 16, 'middle', dy=22)
    else:
        P.axes('N', 'Y')
        P.text(4, 0, 'N*', INK, 16, 'middle', dy=22)
    P.text(0, 6, 'Y*', INK, 16, 'end', dx=-8, dy=5)
    return P.svg()


# ---------------------------------------------------------------- the lessons
CH = lambda en, zh: T(en, zh)


def L_map():
    return dict(
        id=f'{CID}-map', title=T('The whole exam on one page', '整张试卷，一页看完'),
        description=T('Six questions, two moves: what each question tests and the idea that unlocks it.', '六道题，两招：每道题考什么，靠哪个想法解开。'),
        minutes=8,
        skills=[{'id': 'e15.map', 'name': T('Reading the exam', '读懂这张卷子')}],
        steps=[
            read('two-moves', T('Six questions, two moves', '六道题，两招'),
                 p(T('This mock exam has 100 marks over six questions. They look different, but almost every mark comes from two moves you already know from calculus.',
                     '这张模考六道题、共 100 分。题目看着各不相同，可几乎每一分都来自两招，而这两招你在微积分里早就会了。')),
                 ul(T('**Optimise at the margin.** Keep adding units while one more unit brings in more than it costs; stop where the two are equal. For a firm that is $MR = MC$ (marginal revenue = marginal cost). It answers Q2, Q3, Q4 and Q5.',
                      '**在边际上求最优。** 多做一个单位，只要带来的比花掉的多，就继续做；两者相等时停下。对厂商来说就是 $MR = MC$（边际收益 marginal revenue = 边际成本 marginal cost）。第 2、3、4、5 题都靠它。'),
                    T('**Add up areas.** What buyers gain, what sellers earn, what a tax raises and what is lost are areas between curves (integrals, mostly triangles). It answers Q1c and Q2c.',
                      '**把面积加起来。** 买方得到的、卖方赚到的、税收收上来的、白白损失的，都是曲线之间的面积（积分，大多就是三角形）。第 1c、2c 题靠它。')),
                 p(T('Q6 is the one exception: a macro model you argue on a diagram, with no numbers.', '第 6 题是唯一的例外：一个宏观模型，在图上讲道理，不用算数。')),
                 table([T('Q', '题'), T('What happens', '题面'), T('Idea', '考点'), T('Tool', '工具'), T('Marks', '分值')],
                       ['1', T('A quota on imported wind turbines', '进口风机配额'), T('Welfare: who gains, who loses', '福利：谁得谁失'), T('areas', '面积'), '16'],
                       ['2', T('A monopolist, then a 25% tax', '垄断厂商，再加 25% 的税'), T('Monopoly; tax incidence', '垄断；税负归宿'), T('$MR = MC$; areas', '$MR = MC$；面积'), '25'],
                       ['3', T('Two kinds of customers', '两类顾客'), T('Price discrimination', '价格歧视'), T('$MR = MC$ per market; packages', '每个市场 $MR = MC$；套餐'), '19'],
                       ['4', T('Two firms choose outputs', '两家厂商定产量'), T('Cournot duopoly', '古诺双寡头'), T('best responses', '最优反应'), '20'],
                       ['5', T('Many small firms, in the long run', '很多小厂商，长期'), T('Free entry', '自由进入'), T('min AC', '平均成本最低点'), '8'],
                       ['6', T('Population and output', '人口与产出'), T('The Malthusian trap', '马尔萨斯陷阱'), T('a ray from the origin', '过原点的射线'), '12'])),
            read('dictionary', T('Economics, translated into maths', '把经济学翻译成数学'),
                 p(T('Most of the vocabulary is calculus you already know under another name. Keep this table open while you revise.',
                     '这门课的大部分术语，其实是你熟悉的微积分换了个名字。复习时把这张表放在手边。')),
                 table([T('Economics', '经济学'), T('Maths', '数学'), T('Where', '出现在')],
                       [T('Demand $Q = a - bp$; inverse demand $p(Q)$', '需求 $Q = a - bp$；反需求 $p(Q)$'), T('a decreasing line; $p(Q)$ is what a buyer will pay for the $Q$-th unit', '一条递减直线；$p(Q)$ 是第 $Q$ 个单位买方最多愿意付的钱'), T('all', '所有题')],
                       [T('Marginal revenue $MR$', '边际收益 $MR$'), '$\\frac{d}{dQ}\\left[p(Q)\\,Q\\right]$', 'Q2, Q3, Q4'],
                       [T('Marginal cost $MC$', '边际成本 $MC$'), "$C'(Q)$", 'Q2–Q5'],
                       [T('Consumer surplus $CS$', '消费者剩余 $CS$'), '$\\int_0^Q p(x)\\,dx - p\\,Q$', 'Q1, Q2'],
                       [T('Equilibrium', '均衡'), T('the solution of a system: supply = demand, or two best responses at once', '一个方程组的解：供给 = 需求，或两个最优反应同时成立'), 'Q1, Q4'],
                       [T('Elasticity $\\varepsilon$', '弹性 $\\varepsilon$'), '$\\frac{dQ}{dp}\\cdot\\frac{p}{Q} = \\frac{d\\ln Q}{d\\ln p}$', 'Q3, Q5'],
                       [T('Best response (reaction function)', '最优反应（反应函数）'), '$q_1^*(q_2) = \\arg\\max_{q_1}\\pi_1(q_1, q_2)$', 'Q4'],
                       [T('Long-run competitive price', '长期竞争价格'), '$\\min_q AC(q)$', 'Q5'])),
            read('plan', T('How to use this course in 48 hours', '48 小时怎么用这门课'),
                 p(T('The lessons follow the ideas, not the question numbers: markets first (Q1, Q5), then market power (Q2, Q3, Q4), then growth (Q6). Every lesson has the same five parts, so you always know where you are:',
                     '课按想法排，不按题号：先讲市场（第 1、5 题），再讲市场势力（第 2、3、4 题），最后讲增长（第 6 题）。每课都是同样的五部分，随时知道自己在哪：')),
                 ol(T('**In short**: the answers, and the few ideas the question needs.', '**速览**：答案，以及这道题要用到的几个想法。'),
                    T('**The ideas**: each idea from the ground up, with a figure you can drag. Small questions in the page catch the classic mistakes before the exam does.', '**背后的想法**：每个想法从头讲起，配一张可以拖动的图。页面里的小问题，赶在考试之前替你踩一遍经典的坑。'),
                    T('**Worked solution**: the exam answer line by line. One line in each is left for you to fill in.', '**完整解法**：按考试答法一行行写出来。每段解法留一行给你自己填。'),
                    T('**The wider topic**: what else this kind of question can ask (tariffs, Stackelberg, two-part tariffs...), worked with the same numbers.', '**这类题的全貌**：同一类题还可能怎么问（关税、斯塔克尔伯格、两部定价……），用同一组数讲完。'),
                    T('**Your turn**: two or three questions with new numbers.', '**你来**：两三道换了数的题。')),
                 table([T('Time you have', '你有多少时间'), T('Do this', '这样用')],
                       [T('48 hours', '48 小时'), T('Day 1: this map, then Markets, Long run and Monopoly. Day 2: Price discrimination, Cournot, Malthus, then the drill twice: once open-book, once timed (20 minutes).', '第一天：这张地图，然后市场、长期竞争、垄断。第二天：价格歧视、古诺、马尔萨斯，最后把练习做两遍：一遍开卷，一遍限时（20 分钟）。')],
                       [T('6 hours', '6 小时'), T('Each lesson\'s "In short", "The ideas" and "Worked solution"; skip the wider topic; then the drill.', '每课只看“速览”“背后的想法”“完整解法”，跳过全貌；最后做练习。')],
                       [T('30 minutes', '30 分钟'), T('Each "In short", then the one-page method sheet in the last lesson.', '每课的“速览”，再看最后一课的一页方法表。')]),
                 ul(T('**In the exam**, write the condition before the number (for example "$MR = MC$: $600 - 4Q = 60 + Q$"). If the arithmetic slips, the method still earns marks.',
                      '**考试时**，先写条件再代数（比如“$MR = MC$：$600 - 4Q = 60 + Q$”）。就算算错了，思路分还在。'),
                    T('Do the quick, certain parts first (Q5, Q4, Q2a, Q3a); leave Q3b (the packages) for when you are warmed up: it is the hardest idea in the paper.',
                      '先做稳拿的（第 5 题、第 4 题、2a、3a）；3b（套餐）留到手热了再做，它是整张卷子最难的想法。')),
                 callout('note', T('The exam is in English', '考试是英文的'),
                         T('The Chinese version of this course keeps the English terms beside the Chinese, so you can write your answers in the words the examiner expects.',
                           '中文版里专业词后面都留着英文，方便你直接用阅卷人熟悉的词作答。')),
                 chapter=T('The map', '地图')),
        ],
    )


def L_markets():
    M, S = 'e15.market', 'e15.welfare'
    return dict(
        id=f'{CID}-markets', title=T('Markets and who gains: the turbine quota (Q1)', '市场与得失：风机进口配额（第 1 题）'),
        description=T('Demand and supply as values and costs, surplus as areas, externalities, and why a quota on imports costs USF 2000.', '把需求和供给读成价值和成本，用面积算剩余，外部性，以及进口配额为什么让 USF 亏 2000。'),
        minutes=24,
        skills=[{'id': M, 'name': T('Supply, demand and equilibrium', '供给、需求与均衡')}, {'id': S, 'name': T('Welfare accounting', '福利核算')}],
        misconceptions=[{'id': 'price-from-supply', 'description': T('With a quota, reading the price off the supply curve instead of the demand curve', '有配额时，用供给曲线而不是需求曲线来定价格')},
                        {'id': 'rent-is-ours', 'description': T("Counting the quota rent as the importing country's gain", '把配额租金算成进口国自己的收益')}],
        steps=[
            read('glance', T('Answers at a glance', '一眼看答案'),
                 table([T('Part', '小问'), T('Answer', '答案'), T('In one line', '一句话')],
                       ['a', '$p = 10$, $Q = 100$', T('supply meets demand', '供给等于需求')],
                       ['b', '$p = 30$, $Q = 60$', T('only 60 can come in; buyers bid the price up the demand curve', '只能进 60 台，买家沿需求曲线把价格抬上去')],
                       ['c', T('$-2000$ (3500 → 1500)', '$-2000$（3500 → 1500）'), T('consumers lose 1600, the cleaner air loses 400; the higher price goes to foreign sellers', '消费者少 1600，清洁空气少 400；涨价的钱流向外国卖家')]),
                 h(T('What this question needs', '这道题要用到的想法')),
                 ol(T('A demand curve is a list of values, a supply curve a list of costs.', '需求曲线是一串价值，供给曲线是一串成本。'),
                    T('Surplus is an area: value minus price for buyers, price minus cost for sellers.', '剩余是面积：买方是价值减价格，卖方是价格减成本。'),
                    T('An externality is value (or harm) to people outside the sale.', '外部性是买卖双方以外的人得到的价值（或损害）。'),
                    T('A quota fixes the quantity; demand then sets the price, and the gap between the two prices is the quota rent.', '配额卡住数量；价格于是由需求定，两个价格之间的差就是配额租金。'),
                    T('"Social benefit" counts only the people of the country asked about.', '“社会收益”只算题目问的那个国家的人。')),
                 chapter=T('Q1 in short', '第 1 题速览')),
            read('curves', T('Demand is value, supply is cost', '需求是价值，供给是成本'),
                 p(T('Read the demand curve backwards: solve $Q = 120 - 2p$ for $p$ and you get $p = 60 - Q/2$, what a buyer will pay for the $Q$-th turbine. The first one is worth up to \\$60 to someone; the 100th is worth only \\$10. A downward slope just says: the more there already are, the less one more is worth.',
                     '把需求曲线倒过来读：从 $Q = 120 - 2p$ 解出 $p = 60 - Q/2$，这是第 $Q$ 台风机买方最多愿付的价钱。第 1 台有人愿意出 60 美元；第 100 台只值 10 美元。向下倾斜说的就是：已经有的越多，再多一台就越不值钱。')),
                 p(T("The supply curve $Q = 10p$, read backwards ($p = Q/10$), is what it costs Middle Kingdom's sellers to send one more turbine: their marginal cost. At any price they ship every unit that costs them less than the price.",
                     '供给曲线 $Q = 10p$ 倒过来（$p = Q/10$），是中央王国（MK）的卖家多送一台的成本，也就是他们的边际成本。在任何价格下，凡是成本低于价格的台数，他们都会送。')),
                 p(T('Where the two curves cross, the last turbine sold is worth exactly what it costs: that is the competitive equilibrium. Two words the exam likes:',
                     '两条曲线相交处，卖出的最后一台的价值正好等于它的成本：这就是竞争均衡。考试爱用的两个词：')),
                 ul(T('**A movement along a curve** happens when the price changes: buyers buy less at a higher price.', '**沿着曲线移动**（movement along）是价格变了：价格高了，买方就少买。'),
                    T('**A shift of a curve** happens when anything else changes: income, tastes, the price of a substitute (demand); technology, input prices, the number of sellers (supply). A tax or a subsidy can be drawn as a shift.', '**曲线移动**（shift）是别的东西变了：收入、偏好、替代品的价格（需求）；技术、投入品价格、卖家数量（供给）。税和补贴也可以画成曲线的移动。')),
                 chapter=T('The ideas', '背后的想法')),
            read('surplus', T('Surplus: value, counted as areas', '剩余：用面积来数价值'),
                 ul(T("**Consumer surplus** (CS) = what buyers would have paid minus what they paid: the area under demand and above the price. For a straight demand line it is a triangle, $\\tfrac12 \\times Q \\times (\\text{intercept} - p)$.",
                      '**消费者剩余**（consumer surplus, CS）= 买方愿付的 − 实付的：需求曲线之下、价格之上的面积。需求是直线时就是个三角形，$\\tfrac12 \\times Q \\times (\\text{截距} - p)$。'),
                    T('**Producer surplus** (PS) = what sellers get minus their costs: the area above supply and below the price.', '**生产者剩余**（producer surplus, PS）= 卖方收入 − 成本：供给曲线之上、价格之下的面积。'),
                    T('**Total surplus** = CS + PS (+ tax revenue, + externalities): the area between demand and supply up to the quantity traded. With no externality, the free market maximises it: every unit worth more than it costs is traded, and no other.', '**总剩余** = CS + PS（+ 税收，+ 外部性）：成交量以内、需求与供给之间的面积。没有外部性时，自由市场让它最大：价值高于成本的每一单位都成交，其余的都不成交。'),
                    T('**Deadweight loss** (DWL) = total surplus lost when the quantity is pushed away from that point, by a tax, a quota or a monopolist. It is always a triangle pointing at the efficient quantity.', '**无谓损失**（deadweight loss, DWL）= 数量被税、配额或垄断推离那个点时，总剩余少掉的部分。它总是一个指向有效数量的三角形。')),
                 callout('warning', T('The question that decides Q1c: whose surplus counts?', '决定 1c 的关键：谁的剩余算数？'),
                         T('"USF Social Benefit" counts only people in USF: its consumers, its government and the cleaner air. USF has no turbine makers, and Middle Kingdom\'s sellers are foreign, so their producer surplus is **not** counted. Every extra dollar USF pays them is a loss to USF.',
                           '“USF 社会收益”只算 USF 境内的人：消费者、政府、清洁空气。USF 自己不造风机，中央王国的卖家是外国人，他们的生产者剩余**不算**。USF 多付给他们的每一块钱，都是 USF 的损失。'))),
            read('externality', T('Externalities: value outside the sale', '外部性：买卖之外的价值'),
                 p(T('Each turbine gives USF citizens \\$10 of cleaner air, but the buyer does not count it when deciding. So the value of one more turbine to USF is the demand curve **plus 10**: $p = 70 - Q/2$, the dashed green line in the next figure.',
                     '每台风机给 USF 居民带来 10 美元的清洁空气，可买家做决定时不算这一份。所以多一台风机对 USF 的价值是需求曲线**再加 10**：$p = 70 - Q/2$，也就是下一张图里的绿色虚线。')),
                 ul(T('**Positive externality** (cleaner air, vaccination, education): the market buys too little. The classic fix is a **Pigouvian subsidy** equal to the external benefit per unit.', '**正外部性**（清洁空气、疫苗、教育）：市场买得太少。经典的办法是**庇古补贴**（Pigouvian subsidy），每单位补贴等于外部收益。'),
                    T('**Negative externality** (pollution, congestion): the market buys too much. The fix is a **Pigouvian tax** equal to the external harm per unit.', '**负外部性**（污染、拥堵）：市场买得太多。办法是**庇古税**（Pigouvian tax），每单位税等于外部损害。'),
                    T('In welfare sums, add (or subtract) the externality per unit times the quantity: here $+10 \\times Q$.', '算福利时，加上（或减去）每单位外部性 × 数量：这里是 $+10 \\times Q$。')),
                 p(T('If the sellers were USF\'s own firms, the best quantity would be where value to USF meets cost, $70 - Q/2 = Q/10$, so $Q \\approx 117$: more than the free market\'s 100. But here the sellers are foreign, and that changes the sum (see "the wider topic").',
                     '如果卖家是 USF 自己的厂商，最优数量在对 USF 的价值等于成本处：$70 - Q/2 = Q/10$，$Q \\approx 117$，比自由市场的 100 多。可这里卖家是外国人，账就不一样了（见“这类题的全貌”）。'))),
            read('see', T('The quota, as areas you can move', '配额：一组可以拖动的面积'),
                 visual('econ_quota', T('Drag the quota. Gold $A$: what USF buyers pay above the free-trade price on the turbines they still buy. Purple $B$: the value lost on the turbines no longer bought. Green: their lost cleaner air. Right: USF social benefit against the quota; switch to selling the licences to keep the rent at home.',
                                       '拖动配额。金色 $A$：USF 买家在仍然买的那些风机上多付的钱（比自由贸易价格高出的部分）。紫色 $B$：不再买的那些风机丢掉的价值。绿色：它们带走的清洁空气。右边：USF 社会收益随配额的变化；切换成“拍卖许可证”，租金就留在国内。')),
                 p(T('The quota fixes the **quantity** at 60. The sellers would happily ship more at 30, but they may not; so the price is whatever makes buyers want exactly 60, read off the **demand** curve.',
                     '配额卡住的是**数量**：60 台。价格 30 时卖家很想多送，可是不许；所以价格就是让买家恰好只想要 60 台的那个价，从**需求**曲线上读。')),
                 quiz(T('Under the quota of 60, which curve gives the price buyers pay?', '配额 60 台时，买家付的价格从哪条曲线读？'),
                      [(T('Demand: $60 = 120 - 2p$, so $p = 30$', '需求：$60 = 120 - 2p$，$p = 30$'), True),
                       (T('Supply: $60 = 10p$, so $p = 6$', '供给：$60 = 10p$，$p = 6$'), T('That is the lowest price at which MK would send 60, not what buyers pay. At 6, buyers would want 108 turbines but only 60 exist, so they bid the price up.', '这是 MK 愿意送 60 台的最低价，不是买家付的价。价格 6 时买家想要 108 台，可只有 60 台，他们会把价格抬上去。')),
                       (T('Neither: the price stays at the free-trade 10', '都不是：价格还是自由贸易时的 10'), T('At 10 buyers want 100 turbines, but only 60 may come in: the shortage pushes the price up.', '价格 10 时买家想要 100 台，可只许进 60 台：短缺会把价格推高。'))],
                      T('With the quantity fixed, buyers compete for the 60 turbines until only 60 are wanted: $p = 30$. The gap between 30 and the sellers\' price 6 is the **quota rent**, $(30 - 6) \\times 60 = 1440$, and it goes to whoever holds the import licences.',
                        '数量被卡死后，买家争抢这 60 台，直到只有 60 台被需要：$p = 30$。30 与卖家价格 6 之间的差是**配额租金**（quota rent），$(30 - 6) \\times 60 = 1440$，归持有进口许可证的人。'))),
            derive('q1a', T('Q1a: the competitive equilibrium', '1a：竞争均衡'),
                   [('120 - 2p = 10p', T('Buyers want as many as sellers ship.', '买方想买的 = 卖方愿卖的。')),
                    ('12p = 120 \\;\\Rightarrow\\; p = 10', T('Solve for the price.', '解出价格。')),
                    ('Q = 10 \\times 10 = 100', T('Either curve gives the quantity (demand: $120 - 20 = 100$).', '任一条曲线都给出数量（需求：$120 - 20 = 100$）。'))],
                   blank=(2, '100', T('With $p = 10$, how many turbines are traded?', '$p = 10$ 时成交多少台？')), skill=M,
                   chapter=T('Worked solution', '完整解法')),
            derive('q1b', T('Q1b: the quota of 60', '1b：60 台的配额'),
                   [('Q = 60', T('At most 60 can be imported, and at the old price buyers want 100, so the quota binds.', '最多进口 60 台，而原价下买方想要 100 台，所以配额是紧的。')),
                    ('60 = 120 - 2p \\;\\Rightarrow\\; p = 30', T('With the quantity fixed, the **demand** curve sets the price: 30 is the price at which buyers want exactly 60.', '数量被卡死后，由**需求**曲线定价：价格到 30 时，买方恰好只想要 60 台。')),
                    ('10 \\times 30 = 300 > 60', T('Check: at 30, MK would like to ship 300, so the quota really is what limits the market.', '检验：价格 30 时 MK 想送 300 台，确实是配额在卡数量。'))]),
            derive('q1c', T('Q1c: USF social benefit, before and after', '1c：配额前后的 USF 社会收益'),
                   [('CS_0 = \\tfrac12 \\times 100 \\times (60 - 10) = 2500', T('Subscript 0: free trade. The triangle under demand ($p = 60 - Q/2$) and above $p = 10$.', '下标 0：自由贸易。需求线（$p = 60 - Q/2$）之下、$p = 10$ 之上的三角形。')),
                    ('SB_0 = 2500 + 10 \\times 100 = 3500', T('Add the cleaner air: \\$10 for each of the 100 turbines. No USF producers, no tax revenue.', '加上清洁空气：100 台每台 10 美元。USF 没有生产者，也没有税收。')),
                    ('CS_1 = \\tfrac12 \\times 60 \\times (60 - 30) = 900', T('Subscript 1: with the quota. The smaller triangle above the new price 30.', '下标 1：有配额。新价格 30 之上的小三角形。')),
                    ('SB_1 = 900 + 10 \\times 60 = 1500', T('Only 60 turbines clean the air now. The quota rent goes to MK sellers, not to USF.', '现在只有 60 台在清洁空气。配额租金归 MK 卖家，不归 USF。')),
                    ('\\Delta SB = 1500 - 3500 = -2000', T('USF is **2000 worse off** with the quota.', '有了配额，USF **少了 2000**。'))],
                   blank=(2, '900', T('Consumer surplus with the quota: the triangle above $p = 30$, up to $Q = 60$.', '有配额时的消费者剩余：$p = 30$ 之上、到 $Q = 60$ 为止的三角形。')), skill=S),
            read('where', T('Where the 2000 went', '这 2000 去哪了'),
                 table([T('Piece', '部分'), T('Size', '大小'), T('What it is', '是什么')],
                       [T('$A$, rectangle', '$A$，矩形'), '$20 \\times 60 = 1200$', T('USF buyers pay \\$20 more on each of the 60 turbines they still buy; it goes to MK sellers', 'USF 买家仍买的 60 台每台多付 20 美元，流向 MK 卖家')],
                       [T('$B$, triangle', '$B$，三角形'), '$\\tfrac12 \\times 20 \\times 40 = 400$', T('the value of the 40 turbines no longer bought, above their free-trade price', '不再买的那 40 台，高出自由贸易价格的那部分价值')],
                       [T('Cleaner air', '清洁空气'), '$10 \\times 40 = 400$', T('the 40 missing turbines no longer clean the air', '少掉的 40 台不再清洁空气')],
                       [T('Total', '合计'), '$2000$', T('CS falls 1600 ($A + B$), the externality 400', '消费者剩余少 1600（$A + B$），外部收益少 400')]),
                 p(T('Writing the answer this way, piece by piece, earns the method marks even if one number slips, and shows the examiner you know *why* USF loses.',
                     '按块写答案，就算某个数算错，思路分也拿得到，还能让阅卷人看到你知道 USF *为什么*亏。')),
                 quiz(T('Compared with free trade, who is better off with the quota?', '和自由贸易相比，配额让谁过得更好？'),
                      [(T("Middle Kingdom's sellers", '中央王国（MK）的卖家'), True),
                       (T('USF consumers', 'USF 消费者'), T('They pay 30 instead of 10 and buy 40 fewer turbines: they lose 1600.', '他们付 30 而不是 10，还少买了 40 台：少了 1600。')),
                       (T('The USF government', 'USF 政府'), T('Only if it sold the import licences. As set, the quota raises no revenue.', '只有在出售进口许可证时才会。按题目设定，配额不带来任何收入。')),
                       (T('Nobody: the quota only moves money around', '没人：配额只是把钱挪了个地方'), T('Some of it is moved (to MK), but $B$ and 400 of cleaner air are simply lost.', '有一部分是挪了（挪给 MK），但 $B$ 和 400 的清洁空气是真没了。'))],
                      T('MK sellers now get \\$30 for turbines they would sell for \\$6 or less. Their gain is the whole rent, 1440: the rectangle $A$ plus the strip from 6 to 10 that they used to give away at the free-trade price.',
                        'MK 卖家对那些 6 美元以下就愿意卖的风机收到 30 美元。他们得到全部租金 1440：矩形 $A$，加上 6 到 10 之间那一条（自由贸易时他们按 10 卖，现在多拿了）。'))),
            read('tariff', T('A tariff instead, and who keeps the rent', '换成关税：租金归谁'),
                 p(T('A quota and a tariff can cut imports to the same 60. The difference is who keeps the gap between the buyers\' price and the sellers\' price.', '配额和关税都能把进口压到 60 台。区别在于：买方价格和卖方价格之间的那道差，归谁。')),
                 table([T('Policy', '政策'), T('Imports', '进口'), T('Buyers pay', '买方付'), T('MK gets', 'MK 得'), T('USF keeps', 'USF 留下'), T('USF change', 'USF 变化')],
                       [T('Quota 60, rent to MK', '配额 60，租金归 MK'), '60', '30', '30', '0', '$-2000$'],
                       [T('Quota 60, licences auctioned', '配额 60，拍卖许可证'), '60', '30', '6', '$1440$', '$-560$'],
                       [T('Tariff 24 per turbine', '每台 24 的关税'), '60', '30', '6', '$1440$', '$-560$']),
                 p(T('A tariff of $t$: buyers pay $p_s + t$ when sellers get $p_s$, so solve $120 - 2(p_s + t) = 10p_s$. With $t = 24$: $p_s = 6$, buyers pay 30, imports 60, and the revenue $24 \\times 60 = 1440$ stays in USF. A quota whose rent goes abroad is like a tariff whose revenue is handed to the foreign sellers.',
                     '每台征 $t$ 的关税：卖方得 $p_s$ 时买方付 $p_s + t$，解 $120 - 2(p_s + t) = 10p_s$。$t = 24$ 时：$p_s = 6$，买方付 30，进口 60，税收 $24 \\times 60 = 1440$ 留在 USF。租金流到国外的配额，就像把关税收入交给了外国卖家。')),
                 h(T('Beyond the exam: here even a tariff cannot help USF', '超出考试：这里连关税也帮不了 USF')),
                 p(T('Two forces pull in opposite directions. The cleaner air says *import more*. But USF is the only buyer of MK\'s turbines, and buying one more raises the price on every unit (supply slopes up), which says *import less*. USF\'s welfare, counting what it pays MK at the supply price $Q/10$:',
                     '两股力量方向相反。清洁空气说*多进口*。可 USF 是 MK 风机的唯一买家，多买一台会抬高每一台的价格（供给向上倾斜），这又说*少进口*。把按供给价 $Q/10$ 付给 MK 的钱算进去，USF 的福利是：')),
                 math_('W(Q) = \\int_0^Q \\left(60 - \\tfrac{x}{2}\\right)dx + 10Q - \\frac{Q}{10}\\,Q, \\qquad W\'(Q) = 70 - 0.5Q - 0.2Q = 0 \\;\\Rightarrow\\; Q = 100'),
                 p(T('It peaks at exactly $Q = 100$, the free-trade quantity: the two forces cancel, so no quota or tariff can help USF (the gold curve in the figure above peaks at 100). With no externality, the peak would be at $Q \\approx 86$, and a small tariff would raise USF\'s welfare at MK\'s expense: the "optimal tariff" of a large buyer.',
                     '它恰好在 $Q = 100$，也就是自由贸易数量处最大：两股力量抵消了，任何配额或关税都帮不了 USF（上面那张图里金色曲线的最高点就在 100）。如果没有外部性，最高点在 $Q \\approx 86$，一点小关税就能以 MK 为代价提高 USF 的福利：这就是大买家的“最优关税”。')),
                 chapter=T('The wider topic', '这类题的全貌')),
            read('traps', T('Traps, and how the question could change', '易错点，以及题目可能怎么变'),
                 h(T('Traps', '易错点')),
                 ul(T('Reading the quota price off the **supply** curve. Under a quota the buyers set the price: use **demand**.', '用**供给**曲线读配额价格。配额下由买方定价：用**需求**曲线。'),
                    T('Counting the rectangle $A$ as a transfer *inside* USF. Here it goes abroad, so it is a loss for USF.', '把矩形 $A$ 当成 USF *内部*的转移。这里它流到了国外，所以是 USF 的损失。'),
                    T('Forgetting the externality on the turbines that are no longer bought (the second 400).', '忘了不再买的那些风机也带走了外部收益（第二个 400）。')),
                 h(T('If they change it', '如果题目变了')),
                 table([T('Change', '变化'), T('What to do', '怎么做')],
                       [T('A tariff of $t$ per unit', '每单位 $t$ 的关税'), T('Buyers pay $p_s + t$; solve demand at $p_s + t$ = supply at $p_s$. Add the revenue $t \\times Q$ to USF.', '买方付 $p_s + t$；令需求（按 $p_s + t$）= 供给（按 $p_s$）。把税收 $t \\times Q$ 加到 USF。')],
                       [T('USF sells the import licences', 'USF 出售进口许可证'), T('Add the rent $(p_b - p_s) \\times Q$ to USF.', '把租金 $(p_b - p_s) \\times Q$ 加到 USF。')],
                       [T('A harmful externality (pollution)', '有害外部性（污染）'), T('Subtract the harm per unit times $Q$; now restricting imports can *raise* welfare.', '减去每单位危害 × $Q$；这时限制进口反而可能*提高*福利。')],
                       [T('USF also has its own producers', 'USF 也有本国生产者'), T('Their producer surplus counts: a quota then moves surplus from USF buyers to USF producers.', '他们的生产者剩余要算：配额就把剩余从本国买方转给本国生产者。')])),
            number('try', T('Your turn: a quota with new numbers', '你来：换个数的配额'), S,
                   T('Demand is $Q = 200 - 4p$, imports are supplied by $Q = 6p$, a quota allows 60 units, and each unit gives USF \\$5 of external benefit. By how much does USF social benefit change with the quota? (Negative if USF is worse off.)',
                     '需求 $Q = 200 - 4p$，进口供给 $Q = 6p$，配额 60 台，每台给 USF 带来 5 美元外部收益。配额让 USF 社会收益变化多少？（变差就填负数。）'),
                   -1650,
                   T('Free trade: $200 - 4p = 6p$ gives $p = 20$, $Q = 120$; inverse demand $p = 50 - Q/4$; $SB = \\tfrac12 \\times 120 \\times 30 + 5 \\times 120 = 2400$. Quota: $p = (200 - 60)/4 = 35$; $SB = \\tfrac12 \\times 60 \\times 15 + 5 \\times 60 = 750$. Change $= -1650$: rectangle $15 \\times 60 = 900$, triangle $\\tfrac12 \\times 15 \\times 60 = 450$, air $5 \\times 60 = 300$.',
                     '自由贸易：$200 - 4p = 6p$ 得 $p = 20$、$Q = 120$；反需求 $p = 50 - Q/4$；$SB = \\tfrac12 \\times 120 \\times 30 + 5 \\times 120 = 2400$。配额：$p = (200 - 60)/4 = 35$；$SB = \\tfrac12 \\times 60 \\times 15 + 5 \\times 60 = 750$。变化 $= -1650$：矩形 $15 \\times 60 = 900$、三角形 $\\tfrac12 \\times 15 \\times 60 = 450$、空气 $5 \\times 60 = 300$。'),
                   tolerance=1,
                   hints=[T('Price under the quota: put $Q = 60$ into the demand curve.', '配额下的价格：把 $Q = 60$ 代进需求曲线。'), T('Social benefit = consumer surplus + \\$5 per unit. The foreign sellers do not count.', '社会收益 = 消费者剩余 + 每台 5 美元。外国卖家不算。')],
                   chapter=T('Your turn', '你来')),
            number('try-tariff', T('Your turn: a tariff', '你来：关税'), M,
                   T('Back to Q1 (demand $Q = 120 - 2p$, supply $Q = 10p$). USF puts a tariff of \\$6 on each imported turbine. How many turbines are imported?',
                     '回到第 1 题（需求 $Q = 120 - 2p$，供给 $Q = 10p$）。USF 对每台进口风机征 6 美元关税。进口多少台？'),
                   90, T('Buyers pay $p_s + 6$: $120 - 2(p_s + 6) = 10p_s$, so $108 = 12p_s$, $p_s = 9$ and $Q = 90$. Buyers pay 15.', '买方付 $p_s + 6$：$120 - 2(p_s + 6) = 10p_s$，$108 = 12p_s$，$p_s = 9$，$Q = 90$。买方付 15。'),
                   tolerance=0.5, hints=[T('The sellers get $p_s$, the buyers pay $p_s + 6$: put each price in its own curve.', '卖方得 $p_s$，买方付 $p_s + 6$：每个价格代进各自的曲线。')]),
            number('try-tariff-sb', T('Your turn: USF with the tariff', '你来：关税下的 USF'), S,
                   T('With that \\$6 tariff (90 imported, buyers pay 15), what is USF social benefit? Count consumer surplus, the cleaner air (\\$10 per turbine) and the tariff revenue.',
                     '征 6 美元关税（进口 90 台，买方付 15）时，USF 社会收益是多少？算上消费者剩余、清洁空气（每台 10 美元）和关税收入。'),
                   3465, T('$CS = \\tfrac12 \\times 90 \\times (60 - 15) = 2025$, air $= 900$, revenue $= 6 \\times 90 = 540$; total 3465, only 35 below free trade. Most of what buyers pay extra comes back as revenue.',
                            '$CS = \\tfrac12 \\times 90 \\times (60 - 15) = 2025$，空气 $= 900$，税收 $= 6 \\times 90 = 540$；合计 3465，只比自由贸易少 35。买家多付的大部分又作为税收回来了。'),
                   tolerance=1),
        ],
    )


def L_longrun():
    S, E = 'e15.longrun', 'e15.elasticity'
    pb = entry_sr_price(76, 2800)
    qb = entry_q(pb)
    return dict(
        id=f'{CID}-longrun', title=T('Many small firms in the long run (Q5)', '长期里的完全竞争（第 5 题）'),
        description=T('Cost curves, why free entry pins the price at the bottom of average cost, and how to read an elasticity.', '成本曲线，为什么自由进入把价格钉在平均成本最低点，以及怎么读弹性。'),
        minutes=18,
        skills=[{'id': S, 'name': T('Long-run competitive supply', '长期竞争供给')}, {'id': E, 'name': T('Price elasticity of demand', '需求价格弹性')}],
        misconceptions=[{'id': 'supply-is-mc', 'description': T("Taking the firm's LMC curve as the long-run industry supply", '把单个厂商的 LMC 曲线当成长期行业供给')}],
        steps=[
            read('glance', T('Answers at a glance', '一眼看答案'),
                 table([T('Part', '小问'), T('Answer', '答案')],
                       ['a', T('long-run supply: horizontal at $p = 125$ (each firm makes $q = 25$, the bottom of its average cost)', '长期供给：$p = 125$ 处的水平线（每家厂商做 $q = 25$，平均成本的最低点）')],
                       ['b', T('$\\varepsilon = -4 \\times \\tfrac{125}{1900} \\approx -0.26$: inelastic (the market buys 1900, from 76 firms)', '$\\varepsilon = -4 \\times \\tfrac{125}{1900} \\approx -0.26$：缺乏弹性（市场买 1900，由 76 家厂商供给）')]),
                 h(T('What this question needs', '这道题要用到的想法')),
                 ol(T('Average and marginal cost, and why marginal cost cuts average cost at its lowest point.', '平均成本和边际成本，以及为什么边际成本在平均成本最低点穿过它。'),
                    T('A competitive firm takes the price as given and produces where $p = MC$.', '竞争厂商把价格当作给定，在 $p = MC$ 处生产。'),
                    T('Free entry and exit drive profit to zero in the long run: $p = \\min AC$.', '自由进入和退出让长期利润归零：$p = \\min AC$。'),
                    T('Elasticity: the percentage response of quantity to price, and what it says about spending.', '弹性：数量对价格的百分比反应，以及它对总支出意味着什么。')),
                 chapter=T('Q5 in short', '第 5 题速览')),
            read('costs', T('Three cost curves, one picture', '三条成本曲线，一张图'),
                 p(T('From total cost $C(q)$ come average cost $AC = C/q$ and marginal cost $MC = C\'(q)$. In the **short run** some inputs are fixed (a factory), so cost splits into fixed cost $F$ and variable cost $VC(q)$, with average variable cost $AVC = VC/q$. In the **long run** every input can change, so every cost is variable; Q5\'s $LRTC$ has no fixed part.',
                     '由总成本 $C(q)$ 得到平均成本 $AC = C/q$ 和边际成本 $MC = C\'(q)$。**短期**里有些投入是固定的（比如工厂），成本分成固定成本 $F$ 和可变成本 $VC(q)$，平均可变成本 $AVC = VC/q$。**长期**里所有投入都能调整，所以成本全是可变的；第 5 题的 $LRTC$ 没有固定部分。')),
                 p(T('Marginal cost cuts average cost exactly at its minimum, because', '边际成本恰好在平均成本的最低点穿过它，因为')),
                 math_('\\frac{d}{dq}\\left(\\frac{C}{q}\\right) = \\frac{C\'(q)\\,q - C}{q^2} = \\frac{MC - AC}{q}'),
                 p(T('so $AC$ falls while $MC < AC$ and rises once $MC > AC$ (a new exam score below your average pulls the average down).', '所以 $MC < AC$ 时 $AC$ 下降，$MC > AC$ 时 $AC$ 上升（一次低于平均分的成绩会把平均分拉低）。')),
                 svg(fig_cost(), T('The U-shaped long-run average cost LRAC = q² − 50q + 750 reaches its minimum of 125 at q = 25, where the rising long-run marginal cost LMC crosses it.',
                                   'U 形的长期平均成本 LRAC = q² − 50q + 750 在 q = 25 处达到最低 125，上升的长期边际成本 LMC 正好在这里穿过它。'),
                     T('Blue: $LRAC$. Orange: $LMC$, which crosses it at its lowest point.', '蓝色：$LRAC$。橙色：$LMC$，在最低点穿过它。')),
                 chapter=T('The ideas', '背后的想法')),
            read('firm', T('One small firm: p = MC, and when to shut down', '一家小厂商：p = MC，以及什么时候停产'),
                 ul(T('**Price taker.** One firm among many cannot move the price; selling one more unit brings in exactly $p$. So it keeps producing while $p > MC$ and stops where $p = MC$ (on the rising part of $MC$). Its supply curve is its $MC$ curve.', '**价格接受者。** 众多厂商中的一家影响不了价格；多卖一个就多收 $p$。所以只要 $p > MC$ 就继续生产，在 $p = MC$ 处停（在 $MC$ 上升的那段）。它的供给曲线就是它的 $MC$ 曲线。'),
                    T('**Profit** $= (p - AC) \\times q$: positive when the price is above average cost at the chosen $q$.', '**利润** $= (p - AC) \\times q$：在所选的 $q$ 处价格高于平均成本时为正。'),
                    T('**Shutdown (short run).** The fixed cost is paid either way, so the firm keeps producing as long as the price covers average **variable** cost: it shuts down when $p < \\min AVC$. Its short-run supply is $MC$ above $\\min AVC$.', '**停产（短期）。** 固定成本反正要付，所以只要价格能覆盖平均**可变**成本就继续生产：$p < \\min AVC$ 时停产。短期供给是 $\\min AVC$ 以上的那段 $MC$。'),
                    T('**Exit (long run).** With no fixed costs, a firm leaves when $p < \\min AC$.', '**退出（长期）。** 没有固定成本时，$p < \\min AC$ 厂商就离开。')),
                 quiz(T('In the short run a firm\'s price is above its average variable cost but below its average total cost. What should it do?', '短期里，某厂商的价格高于平均可变成本、但低于平均总成本。它该怎么办？'),
                      [(T('Keep producing where $p = MC$: it loses money, but less than if it shut down', '继续在 $p = MC$ 处生产：会亏，但比停产亏得少'), True),
                       (T('Shut down at once: it is making a loss', '马上停产：它在亏钱'), T('If it shuts down it still pays the whole fixed cost. Producing covers the variable cost and part of the fixed cost, so the loss is smaller.', '停产了固定成本照付。继续生产能收回可变成本，还能补一部分固定成本，亏得更少。')),
                       (T('Raise its price to cover average cost', '提价到能覆盖平均成本'), T('A competitive firm cannot: at any price above the market price it sells nothing.', '竞争厂商做不到：价格一高于市场价就一个也卖不出去。'))],
                      T('Shut down only when the price no longer covers average variable cost. Between $\\min AVC$ and $\\min AC$ the firm produces at a loss in the short run, and leaves the industry in the long run if the price stays there.',
                        '只有价格连平均可变成本都覆盖不了时才停产。价格在 $\\min AVC$ 和 $\\min AC$ 之间时，短期里亏着也要生产；如果价格一直这样，长期就退出行业。'))),
            read('entry', T('Why the long-run price is the bottom of AC', '为什么长期价格是 AC 的最低点'),
                 ol(T('If $p > AC$, firms make a profit, new firms enter, supply grows and the price falls. If $p < AC$, firms exit and the price rises. In the long run profit is zero: $p = AC$.', '若 $p > AC$，有利润，新厂商进来，供给增加，价格下降。若 $p < AC$，有人退出，价格上升。长期利润为零：$p = AC$。'),
                    T('Each firm also produces where $p = MC$. Both at once, $p = MC = AC$, happens only at the bottom of $AC$.', '每家厂商同时在 $p = MC$ 处生产。两者同时成立，$p = MC = AC$，只可能在 $AC$ 的最低点。'),
                    T('With identical firms, the industry grows by adding firms at that same cost, so the long-run supply curve is **horizontal** at $p = \\min AC$ (a "constant-cost industry"). The number of firms is market output over each firm\'s output.', '厂商都一样时，行业扩张靠增加厂商，成本不变，所以长期供给曲线是 $p = \\min AC$ 处的一条**水平线**（“成本不变行业”）。厂商数 = 市场产量 ÷ 每家产量。')),
                 svg(fig_entry(), T(f'Market diagram. Demand D0 meets the flat long-run supply at A (Q = 1900, p = 125, 76 firms). Demand rises to D1: with 76 firms the short-run supply is steep, so the price jumps to about {pb:.0f} at B. Profit attracts entry until 92 firms supply 2300 at p = 125 again, at C.',
                                    f'市场图。需求 D0 与水平的长期供给交于 A（Q = 1900，p = 125，76 家厂商）。需求增加到 D1：76 家厂商的短期供给很陡，价格跳到约 {pb:.0f}（B 点）。利润吸引新厂商进入，直到 92 家厂商在 p = 125 供给 2300（C 点）。'),
                     T(f'Demand rises from $D_0$ to $D_1$. **Short run**: the 76 firms move up their $MC$ curves and the price jumps to about {pb:.0f} ($B$); each earns about {round((pb - (qb * qb - 50 * qb + 750)) * qb, -2):,.0f}. **Long run**: the profit attracts entry until the price is back at 125 ($C$, 92 firms). The long-run supply $LRS$ is the flat line through $A$ and $C$.',
                       f'需求从 $D_0$ 增加到 $D_1$。**短期**：76 家厂商沿各自的 $MC$ 往上走，价格跳到约 {pb:.0f}（$B$）；每家赚约 {round((pb - (qb * qb - 50 * qb + 750)) * qb, -2):,.0f}。**长期**：利润吸引新厂商进入，直到价格回到 125（$C$，92 家）。长期供给 $LRS$ 就是过 $A$ 和 $C$ 的那条水平线。')),
                 callout('note', T('Zero profit is not "no money"', '利润为零不等于“没赚钱”'),
                         T('Economic cost includes the normal return the owners could earn elsewhere, so zero economic profit means the firm earns exactly that return: no more, no less, and so no reason to enter or leave.',
                           '经济成本里包括了业主在别处能挣到的正常回报，所以经济利润为零意味着厂商正好挣到这份回报：不多不少，也就没有理由进入或退出。'))),
            derive('q5a', T('Q5a: the long-run supply curve', '5a：长期供给曲线'),
                   [('AC(q) = \\frac{C}{q} = q^2 - 50q + 750', T('Divide total cost by $q$.', '总成本除以 $q$。')),
                    ('\\frac{dAC}{dq} = 2q - 50 = 0 \\;\\Rightarrow\\; q = 25', T('The bottom of the U.', 'U 形的底。')),
                    ('AC(25) = 625 - 1250 + 750 = 125', T('The lowest average cost.', '最低的平均成本。')),
                    ('LMC(25) = 1875 - 2500 + 750 = 125 = AC(25)', T('Check with the exam\'s hint: $LMC = LRAC$ at the minimum.', '用题目提示检验：最低点处 $LMC = LRAC$。')),
                    ('p = 125 \\quad (\\forall Q)', T('For any market quantity: the long-run industry supply curve is horizontal at 125.', '不论市场数量多少：长期行业供给曲线是 125 处的水平线。'))],
                   intro=T('Shortcut from the hint: setting $LMC = AC$, $3q^2 - 100q + 750 = q^2 - 50q + 750$, gives $2q^2 = 50q$, so $q = 25$ directly.', '提示里的捷径：令 $LMC = AC$，$3q^2 - 100q + 750 = q^2 - 50q + 750$，即 $2q^2 = 50q$，直接得 $q = 25$。'),
                   blank=(2, '125', T('The lowest average cost: $AC(25)$.', '最低的平均成本：$AC(25)$。')), skill=S,
                   chapter=T('Worked solution', '完整解法')),
            read('elasticity', T('Elasticity: how strongly buyers react', '弹性：买方反应有多强'),
                 p(T('The (point) price elasticity of demand is the percentage change in quantity per percentage change in price:', '（点）需求价格弹性 = 价格变 1% 时数量变百分之几：')),
                 math_('\\varepsilon = \\frac{dQ}{dp}\\cdot\\frac{p}{Q} = \\frac{d\\ln Q}{d\\ln p}'),
                 ul(T('On a straight demand line the slope $dQ/dp$ is constant, but $p/Q$ changes, so the elasticity is different at every point: always say **where** you evaluate it. High up the line (high price, few units) demand is elastic; low down it is inelastic.', '直线需求上斜率 $dQ/dp$ 不变，但 $p/Q$ 在变，所以每一点的弹性都不同：一定要说清**在哪一点**算。直线上端（价高量少）富有弹性，下端缺乏弹性。'),
                    T('$|\\varepsilon| < 1$: **inelastic** (quantity barely moves). $|\\varepsilon| > 1$: **elastic**. $|\\varepsilon| = 1$: unit elastic.', '$|\\varepsilon| < 1$：**缺乏弹性**（数量几乎不动）。$|\\varepsilon| > 1$：**富有弹性**。$|\\varepsilon| = 1$：单位弹性。'),
                    T('**Spending** $pQ$ rises with the price when demand is inelastic and falls when it is elastic, because $\\frac{d(pQ)}{dp} = Q(1 + \\varepsilon)$. The same fact gives a monopolist\'s $MR = p(1 + 1/\\varepsilon)$ (next lesson).', '**总支出** $pQ$：缺乏弹性时随价格上升，富有弹性时随价格下降，因为 $\\frac{d(pQ)}{dp} = Q(1 + \\varepsilon)$。同一个事实给出垄断者的 $MR = p(1 + 1/\\varepsilon)$（下一课）。'),
                    T('Demand is more elastic with close substitutes, for goods that take a big share of the budget, and over a longer time.', '有相近替代品、占预算比重大、时间更长时，需求更有弹性。'),
                    T('Demand elasticity is negative. Some courses quote its absolute value; write the sign and say which you mean.', '需求弹性是负数。有的课本报绝对值；写上符号，并说清楚你用的是哪种。')),
                 quiz(T('At $p = 125$ demand is inelastic ($\\varepsilon \\approx -0.26$). If the price rose by 1%, total spending on the good would…', '$p = 125$ 处需求缺乏弹性（$\\varepsilon \\approx -0.26$）。价格涨 1%，花在这种商品上的总支出会……'),
                      [(T('rise, by about 0.74%', '上升，约 0.74%'), True),
                       (T('fall, because people buy less', '下降，因为人们买少了'), T('They buy only about 0.26% less while paying 1% more per unit, so they spend more in total.', '他们只少买约 0.26%，每单位却多付 1%，所以总共花得更多。')),
                       (T('stay the same', '不变'), T('That is the unit-elastic case, $\\varepsilon = -1$.', '那是单位弹性的情形，$\\varepsilon = -1$。'))],
                      T('Spending changes by about $1\\% + \\varepsilon \\times 1\\% = 1 - 0.26 = 0.74\\%$. Inelastic demand: a higher price raises spending.', '总支出约变 $1\\% + \\varepsilon \\times 1\\% = 1 - 0.26 = 0.74\\%$。缺乏弹性：涨价让总支出增加。'))),
            derive('q5b', T('Q5b: elasticity at the long-run equilibrium', '5b：长期均衡处的弹性'),
                   [('Q = 2400 - 4 \\times 125 = 1900', T('The market buys this much at the long-run price.', '长期价格下市场买这么多。')),
                    ('\\frac{dQ}{dp} = -4', T('The slope of demand.', '需求的斜率。')),
                    ('\\varepsilon = -4 \\times \\frac{125}{1900} = -\\frac{5}{19} \\approx -0.26', T('Inelastic: a 1% rise in price cuts quantity by about 0.26%.', '缺乏弹性：价格涨 1%，数量只减约 0.26%。')),
                    ('n = \\frac{1900}{25} = 76', T('Not asked, but often next: the number of firms is market output over each firm\'s output.', '没问，但常是下一问：厂商数 = 市场产量 ÷ 每家产量。'))],
                   blank=(0, '1900', T('How much does the market buy at the long-run price 125?', '长期价格 125 下市场买多少？')), skill=E),
            read('traps', T('Traps, and how the question could change', '易错点，以及题目可能怎么变'),
                 h(T('Traps', '易错点')),
                 ul(T('Giving the firm\'s $LMC$ as the industry\'s long-run supply. With free entry the industry curve is flat at $\\min AC$.', '把厂商的 $LMC$ 当成行业长期供给。有自由进入时，行业供给是 $\\min AC$ 处的一条平线。'),
                    T('Computing the elasticity of **supply** (infinite here, since it is flat) instead of demand.', '算成了**供给**弹性（这里是无穷大，因为是平的），而不是需求弹性。'),
                    T('Mixing $q$ (one firm) and $Q$ (the market).', '把 $q$（一家厂商）和 $Q$（整个市场）混在一起。')),
                 h(T('If they change it', '如果题目变了')),
                 ul(T('**Short run**: the industry supply is the number of firms times each firm\'s $MC$ above $\\min AVC$; a demand shift moves the price (point $B$ in the figure).', '**问短期**：行业供给 = 厂商数 × 每家在 $\\min AVC$ 以上的那段 $MC$；需求变动会改变价格（图中的 $B$ 点）。'),
                    T('**A per-unit tax $t$ on every firm**: $AC$ shifts up by $t$, so the long-run price rises by exactly $t$ and buyers pay all of it (supply is flat).', '**对每家厂商每单位征税 $t$**：$AC$ 整体上移 $t$，长期价格正好涨 $t$，全部由买方负担（因为供给是平的）。'),
                    T('**Demand shifts**: the long-run price stays at $\\min AC$; only the number of firms changes.', '**需求变动**：长期价格仍在 $\\min AC$；变的只是厂商数量。'),
                    T('**Rising input prices as the industry grows** (an increasing-cost industry): the long-run supply slopes up.', '**行业扩张时投入品变贵**（成本递增行业）：长期供给向上倾斜。')),
                 chapter=T('The wider topic', '这类题的全貌')),
            number('try-price', T('Your turn: the long-run price', '你来：长期价格'), S,
                   T('Each firm has $C = q^3 - 20q^2 + 150q$. What is the long-run competitive price?', '每家厂商 $C = q^3 - 20q^2 + 150q$。长期竞争价格是多少？'),
                   50, T('$AC = q^2 - 20q + 150$, minimised at $q = 10$, where $AC = 100 - 200 + 150 = 50$.', '$AC = q^2 - 20q + 150$，在 $q = 10$ 处最小，$AC = 100 - 200 + 150 = 50$。'),
                   tolerance=0.01, hints=[T('Find the bottom of $AC = C/q$.', '求 $AC = C/q$ 的最低点。')], chapter=T('Your turn', '你来')),
            number('try-firms', T('Your turn: how many firms', '你来：有多少家厂商'), S,
                   T('Same firms as Q5 (each makes 25 at the bottom of $AC = 125$), but market demand is $Q = 3000 - 4p$. How many firms are there in the long run?', '厂商和第 5 题一样（每家在 $AC$ 最低点 125 处做 25），但市场需求是 $Q = 3000 - 4p$。长期里有多少家厂商？'),
                   100, T('$Q = 3000 - 4 \\times 125 = 2500$, and $2500 / 25 = 100$ firms. The price is still 125: demand changes the number of firms, not the long-run price.', '$Q = 3000 - 4 \\times 125 = 2500$，$2500 / 25 = 100$ 家。价格仍是 125：需求改变的是厂商数，不是长期价格。'),
                   tolerance=0.01),
            number('try-elasticity', T('Your turn: an elasticity', '你来：算弹性'), E,
                   T('Demand is $Q = 1000 - 5p$. What is the point elasticity at $p = 50$? (Give the signed value, to two decimals.)', '需求 $Q = 1000 - 5p$。$p = 50$ 处的点弹性是多少？（带符号，保留两位小数。）'),
                   -0.33, T('$Q = 750$, so $\\varepsilon = -5 \\times 50/750 = -1/3 \\approx -0.33$: inelastic.', '$Q = 750$，$\\varepsilon = -5 \\times 50/750 = -1/3 \\approx -0.33$：缺乏弹性。'),
                   tolerance=0.01),
        ],
    )


def L_monopoly():
    S, X = 'e15.monopoly', 'e15.tax'
    return dict(
        id=f'{CID}-monopoly', title=T('One seller, and a tax on its price (Q2)', '一家独大，再收一道税（第 2 题）'),
        description=T('Where market power comes from, monopoly from MR = MC, its deadweight loss, how a tax tilts or shifts the demand the seller sees, and who really pays.', '市场势力从哪来，用 MR = MC 解垄断，垄断的无谓损失，税怎样转动或平移卖方看到的需求，以及税到底谁付。'),
        minutes=24,
        skills=[{'id': S, 'name': T('Monopoly pricing', '垄断定价')}, {'id': X, 'name': T('Tax incidence', '税负归宿')}],
        misconceptions=[{'id': 'price-from-mr', 'description': T('Reading the monopoly price off the MR curve instead of the demand curve', '从 MR 曲线而不是需求曲线读垄断价格')},
                        {'id': 'buyers-pay-tax', 'description': T('Assuming the buyers pay the whole tax because it is added to their price', '以为税加在买方价格上，就全由买方付')}],
        steps=[
            read('glance', T('Answers at a glance', '一眼看答案'),
                 table([T('Part', '小问'), T('Answer', '答案')],
                       ['a', T('$Q = 108$, $p = 384$, profit $29{,}160$', '$Q = 108$，$p = 384$，利润 $29{,}160$')],
                       ['b', T('$Q = 100$; the seller gets $320$, buyers pay $400$; profit $21{,}000$', '$Q = 100$；卖方得 $320$，买方付 $400$；利润 $21{,}000$')],
                       ['c', T('tax $80$ per unit: buyers $+16$, the monopolist $-64$, so the monopolist pays 80%; government $+8{,}000$', '每单位税 $80$：买方 $+16$，垄断者 $-64$，垄断者承担 80%；政府 $+8{,}000$')]),
                 h(T('What this question needs', '这道题要用到的想法')),
                 ol(T('Marginal revenue: why it is below the price for a single seller.', '边际收益：为什么对独家卖方来说它低于价格。'),
                    T('$MR = MC$ for the quantity; the demand curve for the price.', '用 $MR = MC$ 定数量；用需求曲线定价格。'),
                    T('A tax changes the demand the seller sees: a percentage tax rotates it, a per-unit tax shifts it.', '税会改变卖方看到的需求：百分比税让它转动，从量税让它平移。'),
                    T('Incidence: who pays a tax is decided by how far each price moves, not by who hands over the money.', '税负归宿：税由谁付，看两边价格各动了多少，不看钱是谁交的。')),
                 chapter=T('Q2 in short', '第 2 题速览')),
            read('power', T('Where market power comes from', '市场势力从哪来'),
                 p(T('A monopolist is the only seller of a good with no close substitute, protected by a **barrier to entry**: otherwise its profit would attract rivals (the previous lesson). The usual barriers:',
                     '垄断者是某种没有相近替代品的商品的唯一卖家，并且有**进入壁垒**（barrier to entry）保护：否则它的利润会引来对手（上一课）。常见的壁垒：')),
                 ul(T('**Legal**: patents, copyrights, licences, a state franchise.', '**法律**：专利、版权、执照、政府特许经营。'),
                    T('**Economies of scale**: one firm can supply the whole market more cheaply than two (a **natural monopoly**: water pipes, power grids).', '**规模经济**：一家厂商供应整个市场比两家更便宜（**自然垄断**：自来水管网、电网）。'),
                    T('**Control of a key input**, or **network effects** (a platform worth more the more people use it).', '**控制关键投入品**，或者**网络效应**（用的人越多越值钱的平台）。')),
                 p(T('Unlike a competitive firm, the monopolist faces the whole downward-sloping demand curve, so it chooses the price (or, equivalently, the quantity).', '和竞争厂商不同，垄断者面对的是整条向下倾斜的需求曲线，所以它可以定价格（等价地说，定数量）。')),
                 chapter=T('The ideas', '背后的想法')),
            read('mr', T('Why a monopolist stops before p = MC', '为什么垄断者在 p = MC 之前就停'),
                 p(T('To sell one more unit, a monopolist must lower the price on **every** unit it sells. So the revenue from one more unit is the price, minus what is lost on all the others:',
                     '想多卖一个，垄断者得把**所有**单位的价格都降下来。所以多卖一个带来的收入 = 这个单位的价格 − 其他所有单位少收的钱：')),
                 math_('MR = \\frac{d}{dQ}\\left[p(Q)\\,Q\\right] = p + Q\\,\\frac{dp}{dQ} = p\\left(1 + \\frac{1}{\\varepsilon}\\right) < p'),
                 ul(T('For a straight inverse demand $p = a - bQ$: $MR = a - 2bQ$, the same intercept with twice the slope.', '直线反需求 $p = a - bQ$ 时：$MR = a - 2bQ$，截距相同，斜率翻倍。'),
                    T('Profit $\\pi = pQ - C(Q)$ is highest where $MR = MC$. That gives $Q$; then read the price off the **demand** curve, not off $MR$.', '利润 $\\pi = pQ - C(Q)$ 在 $MR = MC$ 处最大。由此得 $Q$；价格再从**需求**曲线上读，不是从 $MR$ 上读。'),
                    T('Since $MC > 0$, $MR > 0$, so $|\\varepsilon| > 1$: a monopolist always prices where demand is **elastic**. The markup follows the **Lerner rule**: $\\frac{p - MC}{p} = \\frac{1}{|\\varepsilon|}$.', '因为 $MC > 0$，所以 $MR > 0$，即 $|\\varepsilon| > 1$：垄断者总在需求**富有弹性**的地方定价。加价幅度由**勒纳法则**（Lerner rule）决定：$\\frac{p - MC}{p} = \\frac{1}{|\\varepsilon|}$。')),
                 svg(fig_monopoly(), T('Demand p = 600 − 2Q, marginal revenue MR = 600 − 4Q and marginal cost MC = 60 + Q. MR meets MC at Q = 108, where MR = MC = 168; the price read off demand above it is 384. Demand meets MC at Q = 180, p = 240; the shaded triangle between Q = 108 and 180 is the deadweight loss.',
                                       '需求 p = 600 − 2Q、边际收益 MR = 600 − 4Q、边际成本 MC = 60 + Q。MR 与 MC 交于 Q = 108，此处 MR = MC = 168；正上方需求曲线给出价格 384。需求与 MC 交于 Q = 180、p = 240；Q 在 108 到 180 之间的阴影三角形是无谓损失。'),
                     T('Find $Q$ where $MR$ meets $MC$, then go **up** to the demand curve for the price. The shaded triangle is what the monopoly costs society.', '在 $MR$ 与 $MC$ 的交点找 $Q$，再**往上**到需求曲线读价格。阴影三角形是垄断让社会损失的部分。')),
                 h(T('What the monopoly costs: deadweight loss', '垄断的代价：无谓损失')),
                 p(T('A competitive market would go on to $Q = 180$, where demand meets $MC$ ($600 - 2Q = 60 + Q$, $p = 240$). The units from 108 to 180 are worth more to buyers than they cost to make, but the monopolist does not sell them, because selling them would lower its price on all the others. The lost surplus is the triangle $\\tfrac12 \\times (384 - 168) \\times (180 - 108) = 7{,}776$. This is why governments regulate monopolies (for example a price cap at $p = 240$, which makes the monopolist produce 180).',
                     '竞争市场会一直做到 $Q = 180$，即需求等于 $MC$ 处（$600 - 2Q = 60 + Q$，$p = 240$）。108 到 180 之间的那些单位，买方心里的价值高于生产成本，垄断者却不卖，因为多卖会压低其余所有单位的价格。损失的剩余是三角形 $\\tfrac12 \\times (384 - 168) \\times (180 - 108) = 7{,}776$。这就是政府管制垄断的原因（比如把价格上限定在 $p = 240$，垄断者就会生产 180）。'))),
            derive('q2a', T('Q2a: output, price and profit', '2a：产量、价格与利润'),
                   [('p = 600 - 2Q', T('Inverse demand: solve $Q = 300 - \\tfrac12 p$ for $p$.', '反需求：从 $Q = 300 - \\tfrac12 p$ 解出 $p$。')),
                    ('MR = 600 - 4Q', T('Twice the slope.', '斜率翻倍。')),
                    ('600 - 4Q = 60 + Q \\;\\Rightarrow\\; Q = 108', T('$MR = MC$.', '$MR = MC$。')),
                    ('p = 600 - 2 \\times 108 = 384', T('Price from the demand curve.', '价格从需求曲线读。')),
                    ('C = 60 \\times 108 + \\tfrac12 \\times 108^2 = 12{,}312', T('Total cost at $Q = 108$.', '$Q = 108$ 时的总成本。')),
                    ('\\pi = 384 \\times 108 - 12{,}312 = 29{,}160', T('Profit = revenue − cost.', '利润 = 收入 − 成本。'))],
                   blank=(2, '108', T('Solve $MR = MC$: $600 - 4Q = 60 + Q$.', '解 $MR = MC$：$600 - 4Q = 60 + Q$。')), skill=S,
                   chapter=T('Worked solution', '完整解法')),
            read('check-a', T('Check in ten seconds', '十秒自检'),
                 ul(T('$MR(108) = 600 - 432 = 168$ and $MC(108) = 60 + 108 = 168$: equal.', '$MR(108) = 600 - 432 = 168$，$MC(108) = 60 + 108 = 168$：相等。'),
                    T('Lerner: $\\varepsilon = -\\tfrac12 \\times \\tfrac{384}{108} \\approx -1.78$, and $\\tfrac{384 - 168}{384} = 0.5625 = \\tfrac{1}{1.78}$: elastic, as it must be.', '勒纳：$\\varepsilon = -\\tfrac12 \\times \\tfrac{384}{108} \\approx -1.78$，而 $\\tfrac{384 - 168}{384} = 0.5625 = \\tfrac{1}{1.78}$：富有弹性，本该如此。')),
                 quiz(T('The monopolist produces 108. Someone writes the price as 168. What went wrong?', '垄断者生产 108。有人把价格写成 168。错在哪？'),
                      [(T('168 is marginal revenue (= MC) at 108; the price is on the demand curve: 384', '168 是 108 处的边际收益（= MC）；价格要在需求曲线上读：384'), True),
                       (T('Nothing: at the optimum the price equals marginal cost', '没错：最优点处价格等于边际成本'), T('That is a competitive firm. A monopolist\'s price is above its marginal cost: here 384 against 168.', '那是竞争厂商。垄断者的价格高于边际成本：这里是 384 对 168。')),
                       (T('The price should be 240, where demand meets MC', '价格应该是 240，即需求与 MC 相交处'), T('240 is the competitive price. The monopolist sells fewer units at a higher price.', '240 是竞争价格。垄断者卖得更少、价格更高。'))],
                      T('$MR = MC$ gives the quantity. Buyers then pay what the demand curve says they will pay for 108 units: $600 - 2 \\times 108 = 384$.', '$MR = MC$ 给出数量。买家付的是需求曲线上 108 个单位对应的价格：$600 - 2 \\times 108 = 384$。'))),
            read('tilt', T('A tax tilts, or shifts, the demand the seller sees', '税会“转动”或“平移”卖方看到的需求'),
                 p(T('Buyers pay $1.25p$ when the seller gets $p$. Put the buyers\' price into demand: $Q = 300 - \\tfrac12(1.25p)$, so the seller faces', '卖方收 $p$ 时，买方付 $1.25p$。把买方价格代进需求：$Q = 300 - \\tfrac12(1.25p)$，于是卖方面对的是')),
                 math_('p = \\frac{600 - 2Q}{1.25} = 480 - 1.6Q'),
                 p(T('Every point of demand is scaled down by the factor $1/1.25 = 0.8$: the curve **rotates** down around the quantity axis. A per-unit tax $t$ (the one usually done in class) instead **shifts** it down in parallel: $p = 600 - 2Q - t$. Either way, redo $MR = MC$ with the curve the seller actually faces.',
                     '需求上每一点都乘以 $1/1.25 = 0.8$：曲线绕数量轴往下**转**。课上常做的从量税 $t$ 则是往下**平移**：$p = 600 - 2Q - t$。不管哪种，都用卖方真正面对的曲线重做 $MR = MC$。')),
                 visual('econ_monopoly_tax', T('Drag the tax and switch its kind. Dashed: what the seller keeps. Purple: the seller\'s marginal revenue. The thick bar at the chosen quantity is the tax per unit: blue above the old price 384 is paid by buyers, orange below it by the monopolist. The same slider position is the same 80 per unit at $\\tau = 25\\%$.',
                                                '拖动税率，切换税的种类。虚线：卖方实得。紫线：卖方的边际收益。所选数量处的粗竖条就是每单位税：旧价格 384 之上的蓝色部分由买方承担，之下的橙色部分由垄断者承担。滑块在同一位置时，两种税在 $\\tau = 25\\%$ 处都是每单位 80。'))),
            derive('q2b', T('Q2b: the monopolist with the 25% tax', '2b：征 25% 税后的垄断者'),
                   [('p = 480 - 1.6Q', T('The demand the seller faces.', '卖方面对的需求。')),
                    ('MR = 480 - 3.2Q', T('Twice the slope again.', '同样斜率翻倍。')),
                    ('480 - 3.2Q = 60 + Q \\;\\Rightarrow\\; Q = 100', T('$MR = MC$. Cost is unchanged by the tax.', '$MR = MC$。税不改变成本。')),
                    ('p = 480 - 160 = 320, \\qquad 1.25 \\times 320 = 400', T('The seller gets 320; buyers pay 400 (check: $600 - 2 \\times 100 = 400$ on the original demand).', '卖方拿 320；买方付 400（检验：原需求 $600 - 2 \\times 100 = 400$）。')),
                    ('\\pi = 320 \\times 100 - (6000 + 5000) = 21{,}000', T('Profit uses the **seller\'s** price.', '利润用**卖方**价格算。'))],
                   blank=(2, '100', T('Solve $MR = MC$ with the tax: $480 - 3.2Q = 60 + Q$.', '有税时解 $MR = MC$：$480 - 3.2Q = 60 + Q$。')), skill=X),
            derive('q2c', T('Q2c: who pays, and what the government gets', '2c：谁付税，政府得多少'),
                   [('t = p_b - p_s = 400 - 320 = 80', T('The tax per unit is the gap between the buyers\' price $p_b$ and the seller\'s price $p_s$ (25% of 320).', '每单位税就是买方价格 $p_b$ 与卖方价格 $p_s$ 之差（320 的 25%）。')),
                    ('\\Delta p_b = 400 - 384 = +16', T('Buyers pay 16 more than before the tax.', '买方比税前多付 16。')),
                    ('\\Delta p_s = 320 - 384 = -64', T('The seller gets 64 less.', '卖方少拿 64。')),
                    ('\\tfrac{64}{80} = 80\\%', T('The monopolist bears 80% of the tax: it pays more of it.', '垄断者承担了 80% 的税：大部分是它付的。')),
                    ('80 \\times 100 = 8{,}000', T('Government finances improve by 8,000 (there was no tax before).', '政府财政改善 8,000（原来没有税）。'))],
                   blank=(1, '16', T('How much more do buyers pay per unit than before the tax?', '买方每单位比税前多付多少？')), skill=X),
            read('welfare', T('The whole welfare picture', '完整的福利账'),
                 table([T('Who', '谁'), T('Before', '税前'), T('After', '税后'), T('Change', '变化')],
                       [T('Consumers', '消费者'), '$11{,}664$', '$10{,}000$', '$-1{,}664$'],
                       [T('Monopolist', '垄断者'), '$29{,}160$', '$21{,}000$', '$-8{,}160$'],
                       [T('Government', '政府'), '$0$', '$8{,}000$', '$+8{,}000$'],
                       [T('Total', '合计'), '$40{,}824$', '$39{,}000$', '$-1{,}824$']),
                 p(T('By prices (16 against 64) or by losses (1,664 against 8,160), the answer is the same: the monopolist bears most of it. The 1,824 lost by everyone is the deadweight loss of the tax: the 8 units between 100 and 108 that were worth more to buyers than they cost to make.',
                     '按价格（16 对 64）还是按损失（1,664 对 8,160）看，结论一样：大头由垄断者承担。所有人一起少了的 1,824 是这道税的无谓损失：100 到 108 之间那 8 个单位，买方心里的价值高于生产成本，却不再生产了。'))),
            read('incidence', T('Who pays a tax, in any market', '任何市场里，税由谁付'),
                 ul(T('**The rule of incidence**: the side that can less easily walk away pays more. In a competitive market the buyers\' share is $\\frac{\\varepsilon_s}{\\varepsilon_s - \\varepsilon_d}$ (supply elasticity over the gap between the two elasticities): inelastic buyers pay most; with flat supply (Q5) buyers pay all of it.', '**税负归宿规则**：越不容易走开的一方付得越多。竞争市场里买方承担的份额是 $\\frac{\\varepsilon_s}{\\varepsilon_s - \\varepsilon_d}$（供给弹性除以两个弹性之差）：买方缺乏弹性时付大头；供给是水平线（第 5 题）时买方全付。'),
                    T('**It does not matter who hands the money over.** A tax collected from sellers or from buyers ends with the same prices and the same shares.', '**钱是谁交的不重要。** 向卖方收还是向买方收，最后的价格和分担比例都一样。'),
                    T('**A monopolist** re-solves $MR = MC$; the buyers\' share depends on the slopes of demand and $MC$ and on the kind of tax. Here a percentage tax put 20% on buyers, the same 80 per unit as a per-unit tax would put 40% on them (try it in the figure).', '**垄断者**会重解 $MR = MC$；买方份额取决于需求和 $MC$ 的斜率，以及税的种类。这里百分比税让买方承担 20%，同样每单位 80 的从量税会让买方承担 40%（在上面的图里试试）。'),
                    T('**A lump-sum tax or a tax on profit** changes neither $MR$ nor $MC$, so the monopolist keeps the same $Q$ and $p$; it just earns less. No deadweight loss.', '**定额税或利润税**既不改变 $MR$ 也不改变 $MC$，垄断者的 $Q$ 和 $p$ 都不变，只是赚得少了。没有无谓损失。')),
                 details(T('Beyond the exam: here a percentage tax beats a per-unit tax', '超出考试：这里百分比税比从量税好'),
                         p(T('Charge the same 80 as a per-unit tax: the seller faces $p = 520 - 2Q$, $MR = 520 - 4Q = 60 + Q$, so $Q = 92$ and revenue is $80 \\times 92 = 7{,}360$. The percentage tax raised more (8,000) **and** kept more output (100). A percentage tax lowers the seller\'s marginal revenue less where its price is low, so it distorts a monopolist\'s output less.',
                             '换成每单位 80 的从量税：卖方面对 $p = 520 - 2Q$，$MR = 520 - 4Q = 60 + Q$，得 $Q = 92$，税收 $80 \\times 92 = 7{,}360$。百分比税收得更多（8,000），**而且**保住了更多产量（100）。百分比税在卖方价格低的地方压低边际收益更少，所以对垄断产量的扭曲更小。'))),
                 h(T('Traps', '易错点')),
                 ul(T('Using the buyers\' price (400) in the profit. The monopolist only keeps 320.', '用买方价格（400）算利润。垄断者只拿到 320。'),
                    T('Substituting $p - 0.25$ or $p + 25$ for the percentage tax. It multiplies: $1.25p$.', '把百分比税写成 $p - 0.25$ 或 $p + 25$。它是乘法：$1.25p$。'),
                    T('Assuming buyers pay the tax because it is "added to their price". Incidence is decided by how far each price moves.', '以为税“加在买方价格上”就由买方付。归宿看的是两边价格各动了多少。')),
                 chapter=T('The wider topic', '这类题的全貌')),
            number('try-q', T('Your turn: a 20% tax', '你来：20% 的税'), X,
                   T('A monopolist has $MC = 20 + 2Q$ and buyers\' demand $p = 200 - Q$. The government adds a 20% tax: buyers pay $1.2p$ when the seller gets $p$. What output does the monopolist choose?',
                     '垄断者 $MC = 20 + 2Q$，买方需求 $p = 200 - Q$。政府加征 20% 的税：卖方收 $p$ 时买方付 $1.2p$。垄断者选多少产量？'),
                   40, T('The seller faces $p = (200 - Q)/1.2$, so $MR = (200 - 2Q)/1.2$. Setting $MR = 20 + 2Q$: $200 - 2Q = 24 + 2.4Q$, so $Q = 40$. The seller gets $160/1.2 \\approx 133.33$ and buyers pay 160.',
                         '卖方面对 $p = (200 - Q)/1.2$，所以 $MR = (200 - 2Q)/1.2$。令 $MR = 20 + 2Q$：$200 - 2Q = 24 + 2.4Q$，得 $Q = 40$。卖方得 $160/1.2 \\approx 133.33$，买方付 160。'),
                   tolerance=0.01, hints=[T('Write the demand the seller sees: divide the buyers\' price by 1.2.', '写出卖方看到的需求：把买方价格除以 1.2。')], chapter=T('Your turn', '你来')),
            number('try-share', T("Your turn: the buyers' share", '你来：买方承担几成'), X,
                   T('In the same market, without the tax the monopolist sells 45 at $p = 155$. What percentage of the tax do buyers bear?', '同一个市场，没有税时垄断者以 $p = 155$ 卖 45 个。买方承担了这道税的百分之几？'),
                   18.75, T('Tax per unit $= 160 - 133.33 = 26.67$. Buyers\' price rose $160 - 155 = 5$; $5/26.67 = 18.75\\%$. The monopolist bears the other 81.25%.', '每单位税 $= 160 - 133.33 = 26.67$。买方价格涨了 $160 - 155 = 5$；$5/26.67 = 18.75\\%$。其余 81.25% 由垄断者承担。'),
                   tolerance=0.3, unit='%'),
            number('try-dwl', T('Your turn: the cost of a monopoly', '你来：垄断的代价'), S,
                   T('Demand is $p = 100 - Q$ and marginal cost is constant at 20. What is the deadweight loss of the monopoly, compared with competition?', '需求 $p = 100 - Q$，边际成本恒为 20。和竞争相比，垄断的无谓损失是多少？'),
                   800, T('Monopoly: $100 - 2Q = 20$, $Q = 40$, $p = 60$. Competition: $p = 20$, $Q = 80$. DWL $= \\tfrac12 \\times (60 - 20) \\times (80 - 40) = 800$.', '垄断：$100 - 2Q = 20$，$Q = 40$，$p = 60$。竞争：$p = 20$，$Q = 80$。无谓损失 $= \\tfrac12 \\times (60 - 20) \\times (80 - 40) = 800$。'),
                   tolerance=0.5, hints=[T('The triangle between demand and $MC$, from the monopoly quantity to the competitive one.', '需求与 $MC$ 之间、从垄断数量到竞争数量的那个三角形。')]),
        ],
    )


def L_discrimination():
    S3, S2 = 'e15.third', 'e15.second'
    return dict(
        id=f'{CID}-discrimination', title=T('Different prices for different buyers (Q3)', '看人定价（第 3 题）'),
        description=T('The three degrees of price discrimination by what the seller knows: third degree (one MR = MC per market), second degree (packages that make each type pick its own), first degree and two-part tariffs, with the profits side by side.', '按卖方知道多少分出的三级价格歧视：三级（每个市场 MR = MC）、二级（让每类人自己挑套餐）、一级与两部定价，利润并排比较。'),
        minutes=26,
        skills=[{'id': S3, 'name': T('Third-degree price discrimination', '三级价格歧视')}, {'id': S2, 'name': T('Second-degree price discrimination (packages)', '二级价格歧视（套餐）')}],
        misconceptions=[{'id': 'full-value', 'description': T('Charging the high type its full value, which makes it switch to the small package', '向高需求类型收取全部价值，结果它改买小套餐')},
                        {'id': 'efficient-low', 'description': T('Giving the low type the quantity where its demand meets MC, ignoring the rent paid to the high type', '给低需求类型 MC 处的有效数量，忽略了要付给高类型的信息租金')}],
        steps=[
            read('glance', T('Answers at a glance', '一眼看答案'),
                 table([T('Part', '小问'), T('Answer', '答案')],
                       ['a', T('Type 1: $Q_1 = 9$, $p_1 = 15$, $\\varepsilon_1 = -\\tfrac53$. Type 2: $Q_2 = 5$, $p_2 = 11$, $\\varepsilon_2 = -2.2$. Profit $106$.', '类型 1：$Q_1 = 9$，$p_1 = 15$，$\\varepsilon_1 = -\\tfrac53$。类型 2：$Q_2 = 5$，$p_2 = 11$，$\\varepsilon_2 = -2.2$。利润 $106$。')],
                       ['b', T('Package 1: 18 units for \\$254. Package 2: 2 units for \\$30. Profit $164$ (one buyer of each type).', '套餐 1：18 个，254 美元。套餐 2：2 个，30 美元。利润 $164$（每类各一位买家）。')]),
                 h(T('What this question needs', '这道题要用到的想法')),
                 ol(T('What makes price discrimination possible, and its three degrees.', '价格歧视要什么条件，以及它的三个等级。'),
                    T('Third degree: treat each group as its own monopoly market.', '三级：把每一组当成一个单独的垄断市场。'),
                    T('Second degree: a menu that makes each type choose its own package; the high type keeps an information rent.', '二级：一份菜单，让每类人自己挑自己的套餐；高类型留下信息租金。'),
                    T('The value of a package is the area under a buyer\'s demand.', '一个套餐的价值是买家需求曲线下的面积。')),
                 chapter=T('Q3 in short', '第 3 题速览')),
            read('degrees', T('Three degrees, one question: what does the seller know?', '三个等级，一个问题：卖方知道多少？'),
                 p(T('Price discrimination needs three things: market power (a price above $MC$ to play with), a way to **sort** buyers (by group, or by letting them choose), and **no resale** (otherwise those who pay little resell to those who pay a lot).', '价格歧视要三个条件：市场势力（价格高于 $MC$，才有空间）、能把买家**分开**（按组别，或者让他们自己选）、**不能转卖**（否则低价买的人会转卖给高价买的人）。')),
                 table([T('Degree', '等级'), T('The seller knows', '卖方知道'), T('So it', '所以它'), T('Profit here', '本题利润')],
                       [T('none (one price)', '不歧视（统一价）'), T('only total demand', '只知道总需求'), T('sets one price, $p = 13$', '定一个价，$p = 13$'), '$98$'],
                       [T('third', '三级'), T('each buyer\'s group', '每个买家属于哪组'), T('sets one price per group', '每组一个价'), '$106$'],
                       [T('second', '二级'), T('that two kinds exist, not who is who', '知道有两类人，但分不清谁是谁'), T('offers a menu and lets buyers pick', '给出菜单，让买家自己挑'), '$164$'],
                       [T('first', '一级'), T('each buyer\'s full demand', '每个买家完整的需求'), T('charges each the most it would pay', '向每个人收他最多愿付的钱'), '$212$']),
                 p(T('Second degree beats third here not because the seller knows more, but because it sells **packages** (all-or-nothing deals) rather than a price per unit, which captures most of each buyer\'s surplus. What stops it reaching 212 is the one thing it does not know: who is who.',
                     '这里二级比三级赚得多，不是因为卖方知道得更多，而是因为它卖的是**套餐**（要么全买、要么不买），而不是按单价卖，于是能拿走每个买家大部分的剩余。它到不了 212，就差在它唯一不知道的那件事：谁是谁。')),
                 details(T('Where the uniform price 13 comes from', '统一价 13 是怎么来的'),
                         p(T('With one price below 16 both types buy, so add the demands: $Q = (24 - p) + (16 - p) = 40 - 2p$, or $p = 20 - Q/2$. Then $MR = 20 - Q = 6$ gives $Q = 14$, $p = 13$ and profit $(13 - 6) \\times 14 = 98$. (Selling only to type 1 at its monopoly price 15 earns $9 \\times 9 = 81$: less.)',
                             '价格低于 16 时两类人都买，把需求加起来：$Q = (24 - p) + (16 - p) = 40 - 2p$，即 $p = 20 - Q/2$。$MR = 20 - Q = 6$ 得 $Q = 14$，$p = 13$，利润 $(13 - 6) \\times 14 = 98$。（只卖给类型 1、定它的垄断价 15，赚 $9 \\times 9 = 81$：更少。）'))),
                 chapter=T('The ideas', '背后的想法')),
            read('third', T('Third degree: one MR = MC per market', '三级：每个市场各自 MR = MC'),
                 p(T('With a constant marginal cost the two markets do not interact, so treat each as its own monopoly: $MR_i = MC$ in each. The result follows the Lerner rule, $\\frac{p_i - MC}{p_i} = \\frac{1}{|\\varepsilon_i|}$: the **less elastic** market gets the **higher** price. Students and pensioners pay less because they are more price-sensitive.',
                     '边际成本为常数时两个市场互不影响，把每个都当成一个单独的垄断：各自 $MR_i = MC$。结果符合勒纳法则 $\\frac{p_i - MC}{p_i} = \\frac{1}{|\\varepsilon_i|}$：**弹性越小**的市场价格**越高**。学生和老人票便宜，是因为他们对价格更敏感。'))),
            derive('q3a', T('Q3a: third-degree prices', '3a：三级价格歧视'),
                   [('p_1 = 24 - Q_1,\\quad MR_1 = 24 - 2Q_1 = 6 \\;\\Rightarrow\\; Q_1 = 9,\\; p_1 = 15', T('Market 1.', '市场 1。')),
                    ('p_2 = 16 - Q_2,\\quad MR_2 = 16 - 2Q_2 = 6 \\;\\Rightarrow\\; Q_2 = 5,\\; p_2 = 11', T('Market 2.', '市场 2。')),
                    ('\\varepsilon_1 = -1 \\times \\tfrac{15}{9} = -\\tfrac53, \\qquad \\varepsilon_2 = -1 \\times \\tfrac{11}{5} = -2.2', T('$dQ_i/dp_i = -1$ in both; evaluate at each market\'s own price and quantity.', '两边 $dQ_i/dp_i = -1$；各自在自己的价格和数量处算。')),
                    ('\\pi = (15 - 6) \\times 9 + (11 - 6) \\times 5 = 81 + 25 = 106', T('Profit = margin × quantity, summed.', '利润 = 每单位利润 × 数量，再相加。'))],
                   outro=T('Check with Lerner: $\\tfrac{15 - 6}{15} = 0.6 = \\tfrac{1}{5/3}$ and $\\tfrac{11 - 6}{11} \\approx 0.455 = \\tfrac{1}{2.2}$.', '用勒纳检验：$\\tfrac{15 - 6}{15} = 0.6 = \\tfrac{1}{5/3}$，$\\tfrac{11 - 6}{11} \\approx 0.455 = \\tfrac{1}{2.2}$。'),
                   blank=(3, '106', T('Total profit: margin times quantity in each market, added.', '总利润：每个市场的单位利润乘数量，再相加。')), skill=S3,
                   chapter=T('Worked solution', '完整解法')),
            read('packages', T('Second degree: packages, and the two constraints that bind', '二级：套餐，以及两个起作用的约束'),
                 ul(T('**What a package is worth.** $q$ units are worth the area under a buyer\'s demand up to $q$: $V_1(q) = 24q - \\tfrac{q^2}{2}$ and $V_2(q) = 16q - \\tfrac{q^2}{2}$.',
                      '**套餐值多少。** $q$ 个单位对买家的价值 = 需求曲线下从 0 到 $q$ 的面积：$V_1(q) = 24q - \\tfrac{q^2}{2}$，$V_2(q) = 16q - \\tfrac{q^2}{2}$。'),
                    T('**The low type pays its full value:** $T_2 = V_2(q_2)$, so it is just willing to buy (its **participation constraint** binds).',
                      '**低需求类型付满它的价值：** $T_2 = V_2(q_2)$，它刚好愿意买（**参与约束** participation constraint 是紧的）。'),
                    T('**The high type must not prefer package 2.** It values package 2 at $V_1(q_2)$, more than type 2 does by $8q_2$ (its demand is 8 higher at every unit). So package 1 must leave it at least that much: $T_1 = V_1(q_1) - 8q_2$ (its **incentive constraint** binds). That $8q_2$ is the **information rent**: what the seller pays for not knowing who is who.',
                      '**高需求类型不能更想要套餐 2。** 它对套餐 2 的估值 $V_1(q_2)$ 比类型 2 高 $8q_2$（它的需求每个单位都高 8）。所以套餐 1 至少得给它留这么多：$T_1 = V_1(q_1) - 8q_2$（**激励约束** incentive constraint 是紧的）。这 $8q_2$ 就是**信息租金**（information rent）：卖方为“分不清谁是谁”付的代价。'),
                    T('**Two rules follow.** No distortion at the top: type 1 gets the efficient amount, where its demand meets $MC$. Shrink the bottom: each extra unit for type 2 brings in its value minus $MC$, but raises the rent by 8, so stop where $16 - q_2 - 6 = 8$.',
                      '**由此得两条规则。** 顶端不扭曲：类型 1 拿有效数量，即它的需求与 $MC$ 相交处。底端缩量：给类型 2 每多一个单位，赚它的价值减 $MC$，但租金多 8，所以停在 $16 - q_2 - 6 = 8$。')),
                 visual('econ_screening', T('Drag the size of package 2. Green $T_2$: what type 2 pays. Gold $R$: the rent type 1 must be left. Right: one more unit in package 2 earns $D_2 - MC$ and costs $D_1 - D_2 = 8$ of rent; the profit is highest where the two lines cross.',
                                            '拖动套餐 2 的大小。绿色 $T_2$：类型 2 付的钱。金色 $R$：必须留给类型 1 的租金。右边：套餐 2 再加一个单位，赚 $D_2 - MC$，多付 $D_1 - D_2 = 8$ 的租金；两条线相交处利润最高。'))),
            derive('q3b', T('Q3b: the two packages', '3b：两个套餐'),
                   [('24 - q_1 = 6 \\;\\Rightarrow\\; q_1 = 18', T('No distortion at the top.', '顶端不扭曲。')),
                    ('\\pi(q_2) = \\left[V_1(18) - 8q_2 - 6 \\times 18\\right] + \\left[V_2(q_2) - 6q_2\\right]', T('Profit from both packages, with the binding constraints already in the prices.', '两个套餐的利润，价格里已经用上了两个紧约束。')),
                    ('\\pi\'(q_2) = -8 + (16 - q_2) - 6 = 0 \\;\\Rightarrow\\; q_2 = 2', T('Shrink the bottom until the gain from one more unit equals the rent it costs.', '底端缩量，直到多一个单位的收益等于它多付的租金。')),
                    ('T_2 = V_2(2) = 32 - 2 = 30', T('Type 2 pays all it is worth to it.', '类型 2 付满它的价值。')),
                    ('T_1 = V_1(18) - 8 \\times 2 = 270 - 16 = 254', T('Type 1 keeps a rent of 16.', '类型 1 留下 16 的租金。')),
                    ('\\pi = (254 - 108) + (30 - 12) = 164', T('Revenue minus the cost of the units in each package.', '收入减去每个套餐里那些单位的成本。'))],
                   blank=(2, '2', T('Set $\\pi\'(q_2) = 0$: $-8 + (16 - q_2) - 6 = 0$.', '令 $\\pi\'(q_2) = 0$：$-8 + (16 - q_2) - 6 = 0$。')), skill=S2),
            read('check-b', T('Check that each type picks its own package', '检查：每类人都选了自己的套餐'),
                 table([T('Buyer', '买家'), T('Takes package 1', '选套餐 1'), T('Takes package 2', '选套餐 2'), T('Picks', '会选')],
                       [T('Type 1', '类型 1'), '$270 - 254 = 16$', '$46 - 30 = 16$', T('1 (indifferent)', '1（无差异）')],
                       [T('Type 2', '类型 2'), '$128 - 254 < 0$', '$30 - 30 = 0$', '2']),
                 ul(T('Type 1 values package 2 at $V_1(2) = 46$ and package 1 at $V_1(18) = 270$; type 2 values package 1 at $V_2(16) = 128$ (it would not want more than 16). Indifferent buyers are assumed to take the package meant for them.', '类型 1 对套餐 2 估值 $V_1(2) = 46$，对套餐 1 估值 $V_1(18) = 270$；类型 2 对套餐 1 估值 $V_2(16) = 128$（多于 16 个它也不要）。无差异时，默认买家选为他设计的套餐。'),
                    T('Selling only to type 1 (18 units for 270) would earn $270 - 108 = 162 < 164$: serving both is better, just.', '只卖给类型 1（18 个卖 270）赚 $270 - 108 = 162 < 164$：两类都卖更好，但只好一点点。'),
                    T('Package 1 costs $254/18 \\approx 14.1$ per unit, package 2 costs $15$: a quantity discount, which is how second-degree pricing looks in real life.', '套餐 1 每单位约 $254/18 \\approx 14.1$，套餐 2 每单位 $15$：数量折扣，这就是现实中二级价格歧视的样子。')),
                 quiz(T('Suppose the seller charged type 1 its full value, 270, for package 1. What would happen?', '假设卖方对套餐 1 收类型 1 的全部价值 270。会发生什么？'),
                      [(T('Type 1 would switch to package 2 and keep a surplus of 16 there', '类型 1 会改买套餐 2，在那里留下 16 的剩余'), True),
                       (T('Type 1 would still buy package 1: it is worth 270 to it', '类型 1 仍会买套餐 1：对它值 270'), T('It would be indifferent about buying package 1 (surplus 0), but package 2 gives it $46 - 30 = 16$. It takes package 2.', '买套餐 1 剩余为 0，而套餐 2 给它 $46 - 30 = 16$。它会选套餐 2。')),
                       (T('Profit would rise to 270 − 108 + 18 = 180', '利润会升到 270 − 108 + 18 = 180'), T('Only if type 1 kept buying package 1, which it does not.', '前提是类型 1 继续买套餐 1，可它不会。'))],
                      T('That is why package 1 must leave type 1 the rent it could get from package 2: $T_1 = 270 - 16 = 254$.', '这就是为什么套餐 1 必须给类型 1 留下它从套餐 2 能得到的租金：$T_1 = 270 - 16 = 254$。'))),
            read('wider', T('First degree and two-part tariffs', '一级价格歧视与两部定价'),
                 ul(T('**First degree** (perfect): each buyer pays its full value for every unit. Output is efficient (each buyer gets up to where its demand meets $MC$), there is no deadweight loss, and consumer surplus is zero. Here: $V_1(18) - 108 = 162$ from type 1 and $V_2(10) - 60 = 50$ from type 2, total 212.', '**一级**（完全）价格歧视：每个买家为每个单位付满价值。产量有效（每个买家都买到需求等于 $MC$ 处），没有无谓损失，消费者剩余为零。本题：类型 1 贡献 $V_1(18) - 108 = 162$，类型 2 贡献 $V_2(10) - 60 = 50$，合计 212。'),
                    T('**Two-part tariff** (an entry fee plus a price per unit) for identical buyers: set the price per unit at $MC$, so each buys the efficient amount, and take the whole consumer surplus as the fee. With only type 1: price 6, fee $\\tfrac12 \\times 18 \\times 18 = 162$. Gyms, theme parks and phone plans work this way.', '对相同买家用**两部定价**（入场费 + 单价）：单价定在 $MC$，每人买有效数量，再用入场费拿走全部消费者剩余。只有类型 1 时：单价 6，入场费 $\\tfrac12 \\times 18 \\times 18 = 162$。健身房、主题公园、手机套餐都是这样。'),
                    T('With different buyers a two-part tariff faces the same problem as packages: a fee high enough for type 1 drives type 2 away.', '买家不同时，两部定价和套餐面临同样的问题：对类型 1 够高的入场费会把类型 2 赶走。')),
                 h(T('Traps, and how the question could change', '易错点，以及题目可能怎么变')),
                 ul(T('Giving type 2 its efficient amount, 10 units: that ignores the rent the seller pays type 1 for every unit in package 2.', '给类型 2 有效数量 10 个：忽略了套餐 2 里每个单位都要多付给类型 1 的租金。'),
                    T('In third degree, writing the elasticity at the wrong point, or without its sign.', '三级里在错误的点算弹性，或者丢了负号。'),
                    T('Different numbers of each type ($n_1$ and $n_2$): the bottom rule becomes $16 - q_2 - 6 = 8\\,\\tfrac{n_1}{n_2}$; when that pushes $q_2$ to 0, serve only type 1.', '两类人数不同（$n_1$ 和 $n_2$）：底端规则变成 $16 - q_2 - 6 = 8\\,\\tfrac{n_1}{n_2}$；如果这使 $q_2$ 变成 0，就只卖给类型 1。'),
                    T('Increasing marginal cost in third degree: set $MR_1 = MR_2 = MC(Q_1 + Q_2)$ together.', '三级里边际成本递增：联立 $MR_1 = MR_2 = MC(Q_1 + Q_2)$。')),
                 chapter=T('The wider topic', '这类题的全貌')),
            number('try-third', T('Your turn: third degree', '你来：三级价格歧视'), S3,
                   T('Demands are $Q_1 = 30 - p_1$ and $Q_2 = 20 - 2p_2$, and $MC = 4$. With third-degree price discrimination, what is the total profit?', '需求 $Q_1 = 30 - p_1$、$Q_2 = 20 - 2p_2$，$MC = 4$。三级价格歧视下总利润是多少？'),
                   187, T('Market 1: $MR = 30 - 2Q_1 = 4$, so $Q_1 = 13$, $p_1 = 17$. Market 2: $p_2 = 10 - Q_2/2$, $MR = 10 - Q_2 = 4$, so $Q_2 = 6$, $p_2 = 7$. Profit $= 13 \\times 13 + 3 \\times 6 = 187$.',
                          '市场 1：$MR = 30 - 2Q_1 = 4$，$Q_1 = 13$，$p_1 = 17$。市场 2：$p_2 = 10 - Q_2/2$，$MR = 10 - Q_2 = 4$，$Q_2 = 6$，$p_2 = 7$。利润 $= 13 \\times 13 + 3 \\times 6 = 187$。'),
                   tolerance=0.5, hints=[T('Write market 2 as inverse demand first: $p_2 = 10 - Q_2/2$.', '先把市场 2 写成反需求：$p_2 = 10 - Q_2/2$。')], chapter=T('Your turn', '你来')),
            number('try-second', T('Your turn: two packages', '你来：两个套餐'), S2,
                   T('Type A has demand $20 - q$, type B has $12 - q$, $MC = 2$, one buyer of each. What total price $T_A$ should package A carry?', '类型 A 需求 $20 - q$，类型 B 需求 $12 - q$，$MC = 2$，每类一位买家。套餐 A 的总价 $T_A$ 应定多少？'),
                   182, T('$q_A = 18$ (where $20 - q = 2$). The gap between the demands is 8, so $12 - q_B - 2 = 8$ gives $q_B = 2$ and $T_B = 24 - 2 = 22$. $V_A(18) = 360 - 162 = 198$, so $T_A = 198 - 8 \\times 2 = 182$. Profit $= 146 + 18 = 164$.',
                          '$q_A = 18$（$20 - q = 2$ 处）。两条需求相差 8，$12 - q_B - 2 = 8$ 得 $q_B = 2$，$T_B = 24 - 2 = 22$。$V_A(18) = 360 - 162 = 198$，所以 $T_A = 198 - 8 \\times 2 = 182$。利润 $= 146 + 18 = 164$。'),
                   tolerance=0.5, hints=[T('First $q_A$ (no distortion at the top), then $q_B$ (shrink the bottom), then the prices.', '先定 $q_A$（顶端不扭曲），再定 $q_B$（底端缩量），最后定价格。')]),
            number('try-two-part', T('Your turn: a two-part tariff', '你来：两部定价'), S2,
                   T('Identical buyers each have demand $p = 30 - q$, and $MC = 10$. With the best two-part tariff, what is the entry fee per buyer?', '买家都一样，每人需求 $p = 30 - q$，$MC = 10$。最优两部定价下，每人的入场费是多少？'),
                   200, T('Price per unit $= MC = 10$, so each buys 20; the fee takes the whole consumer surplus, $\\tfrac12 \\times 20 \\times (30 - 10) = 200$.', '单价 $= MC = 10$，每人买 20；入场费拿走全部消费者剩余：$\\tfrac12 \\times 20 \\times (30 - 10) = 200$。'),
                   tolerance=0.5),
        ],
    )


def L_cournot():
    S, G = 'e15.cournot', 'e15.games'
    return dict(
        id=f'{CID}-cournot', title=T('Two firms guessing each other (Q4)', '两家厂商互相猜（第 4 题）'),
        description=T('Games and Nash equilibrium, best responses, how to draw them, and how Cournot compares with a cartel, a leader (Stackelberg) and competition.', '博弈与纳什均衡、最优反应、怎么画出来，以及古诺与卡特尔、领导者（斯塔克尔伯格）、完全竞争的比较。'),
        minutes=22,
        skills=[{'id': S, 'name': T('Cournot competition', '古诺竞争')}, {'id': G, 'name': T('Nash equilibrium', '纳什均衡')}],
        misconceptions=[{'id': 'forget-rival', 'description': T("Leaving the rival's output out of a firm's price when deriving its MR", '推 MR 时忘了价格里还有对手的产量')}],
        steps=[
            read('glance', T('Answers at a glance', '一眼看答案'),
                 table([T('Part', '小问'), T('Answer', '答案')],
                       ['a', T('$R_1:\\ q_1 = 120 - 0.25\\,q_2$ and $R_2:\\ q_2 = 192 - 0.4\\,q_1$', '$R_1：q_1 = 120 - 0.25\\,q_2$，$R_2：q_2 = 192 - 0.4\\,q_1$')],
                       ['b', T('$R_1$ crosses the axes at $q_1 = 120$ and $q_2 = 480$; $R_2$ at $q_2 = 192$ and $q_1 = 480$', '$R_1$ 与坐标轴交于 $q_1 = 120$、$q_2 = 480$；$R_2$ 交于 $q_2 = 192$、$q_1 = 480$')],
                       ['c', T('$q_1 = 80$, $q_2 = 160$, $p = 26$', '$q_1 = 80$，$q_2 = 160$，$p = 26$')]),
                 h(T('What this question needs', '这道题要用到的想法')),
                 ol(T('A game: players, strategies, payoffs; a best response; a Nash equilibrium.', '博弈：参与者、策略、收益；最优反应；纳什均衡。'),
                    T('Cournot: firms choose quantities, and the price depends on the total.', '古诺：厂商选产量，价格取决于总产量。'),
                    T('A reaction function is $MR = MC$ with the rival\'s output held fixed.', '反应函数就是固定对手产量时的 $MR = MC$。'),
                    T('The equilibrium is where the reaction functions cross.', '均衡在两条反应函数的交点。')),
                 chapter=T('Q4 in short', '第 4 题速览')),
            read('games', T('Games and Nash equilibrium in five minutes', '五分钟讲清博弈与纳什均衡'),
                 p(T('When one firm\'s profit depends on what another does, each must guess the other: that is a **game**. It has players, the strategies each can choose, and the payoff each gets from every combination.',
                     '当一家厂商的利润取决于另一家怎么做时，双方都得猜对方：这就是**博弈**（game）。它有参与者、每人能选的策略，以及每种组合下每人的收益。')),
                 ul(T('**Best response**: my best strategy given what the other does.', '**最优反应**（best response）：给定对方怎么做，我的最好策略。'),
                    T('**Nash equilibrium**: a strategy for each player such that each is a best response to the others. Nobody gains by changing alone, so once there, nobody moves.', '**纳什均衡**（Nash equilibrium）：每个参与者各选一个策略，使每人的策略都是对其他人的最优反应。谁单独改都不会更好，所以到了那里就没人再动。')),
                 p(T('Example: two identical firms, $p = 120 - Q$, no costs. Each can produce 30 (half of the monopoly output: a cartel) or 40. Profits (firm 1, firm 2):',
                     '例子：两家相同的厂商，$p = 120 - Q$，没有成本。每家可以生产 30（垄断产量的一半：卡特尔）或 40。利润（厂商 1，厂商 2）：')),
                 table(['', T('Firm 2: 30', '厂商 2：30'), T('Firm 2: 40', '厂商 2：40')],
                       [T('Firm 1: 30', '厂商 1：30'), '$1800,\\ 1800$', '$1500,\\ 2000$'],
                       [T('Firm 1: 40', '厂商 1：40'), '$2000,\\ 1500$', '$1600,\\ 1600$']),
                 quiz(T('What is the Nash equilibrium of this game?', '这个博弈的纳什均衡是什么？'),
                      [(T('Both produce 40 and earn 1600 each', '都生产 40，各赚 1600'), True),
                       (T('Both produce 30 and earn 1800 each', '都生产 30，各赚 1800'), T('Both would be better off there, but it is not stable: if the other produces 30, producing 40 earns 2000 instead of 1800.', '那里两家都更好，可是不稳定：对方生产 30 时，自己生产 40 能赚 2000 而不是 1800。')),
                       (T('One produces 30 and the other 40', '一家生产 30，另一家生产 40'), T('The firm producing 30 would rather produce 40 (1600 instead of 1500).', '生产 30 的那家更想生产 40（1600 而不是 1500）。'))],
                      T('Whatever the other does, 40 is better (2000 > 1800 and 1600 > 1500), so both produce 40, although both would earn more at 30. This is the **prisoner\'s dilemma**, and it is why cartels are hard to keep: each member gains by secretly producing more.',
                        '不管对方怎么做，40 都更好（2000 > 1800，1600 > 1500），所以两家都生产 40，尽管都生产 30 两家都赚得更多。这就是**囚徒困境**（prisoner\'s dilemma），也是卡特尔难以维持的原因：每个成员偷偷多生产都能多赚。')),
                 chapter=T('The ideas', '背后的想法')),
            read('idea', T('Cournot: best responses with quantities', '古诺：用产量做最优反应'),
                 ul(T('Both firms sell into one market, so the price depends on the **total**: $p = 50 - 0.1(q_1 + q_2)$. Each firm\'s profit depends on the other\'s choice.', '两家卖进同一个市场，价格取决于**总量**：$p = 50 - 0.1(q_1 + q_2)$。每家的利润都受对方选择影响。'),
                    T('**Reaction function** (best response): for each output the rival might choose, the output that maximises my profit, $q_1^*(q_2) = \\arg\\max_{q_1}\\pi_1(q_1, q_2)$. It comes from $\\partial\\pi_1/\\partial q_1 = 0$, which is $MR_1 = MC_1$ with $q_2$ held fixed.',
                      '**反应函数**（最优反应）：对手可能选的每个产量，对应一个使我利润最大的产量，$q_1^*(q_2) = \\arg\\max_{q_1}\\pi_1(q_1, q_2)$。由 $\\partial\\pi_1/\\partial q_1 = 0$ 求出，也就是把 $q_2$ 固定后的 $MR_1 = MC_1$。'),
                    T('The more the rival produces, the lower the price I can get, so the less I want to produce: reaction functions slope **down**.', '对手产得越多，我能卖的价格越低，我就越不想多产：反应函数**向下**倾斜。'),
                    T('**Cournot (Nash) equilibrium**: each firm\'s output is a best response to the other\'s. On the diagram it is where the two reaction functions cross.', '**古诺（纳什）均衡**：每家的产量都是对对方产量的最优反应。在图上就是两条反应函数的交点。')),
                 visual('econ_cournot', T('Drag the starting outputs (the purple dot). Firm 1 replies first (a move across to $R_1$), then firm 2 (a move up or down to $R_2$), and so on: from anywhere, the replies close in on $(80, 160)$, the one point where both are already replying best.',
                                          '拖动起始产量（紫色点）。厂商 1 先回应（横着走到 $R_1$），然后厂商 2（竖着走到 $R_2$），如此反复：不管从哪出发，回应都会逼近 $(80, 160)$，也就是双方都已经在做最优反应的那一点。'))),
            derive('q4a', T('Q4a: the two reaction functions', '4a：两条反应函数'),
                   [('p = 50 - 0.1(q_1 + q_2)', T('Inverse demand from $Q = 500 - 10p$.', '由 $Q = 500 - 10p$ 得反需求。')),
                    ('MR_1 = \\frac{\\partial (p\\,q_1)}{\\partial q_1} = 50 - 0.2q_1 - 0.1q_2', T('Differentiate firm 1\'s revenue with $q_2$ held fixed. The rival\'s output stays in.', '固定 $q_2$ 对厂商 1 的收入求导。对手的产量要留在式子里。')),
                    ('50 - 0.2q_1 - 0.1q_2 = 0.2q_1 + 2 \\;\\Rightarrow\\; q_1 = 120 - 0.25\\,q_2', T('$MR_1 = MC_1$, solved for $q_1$: firm 1\'s reaction function.', '$MR_1 = MC_1$ 解出 $q_1$：厂商 1 的反应函数。')),
                    ('50 - 0.1q_1 - 0.2q_2 = 0.05q_2 + 2 \\;\\Rightarrow\\; q_2 = 192 - 0.4\\,q_1', T('The same for firm 2.', '厂商 2 同理。'))],
                   blank=(1, '50 - 0.2*q_1 - 0.1*q_2', T('Firm 1\'s marginal revenue, with $q_2$ held fixed (type `q_1` and `q_2`).', '固定 $q_2$ 时厂商 1 的边际收益（输入 `q_1` 和 `q_2`）。'), ['q_1', 'q_2']), skill=S,
                   chapter=T('Worked solution', '完整解法')),
            read('draw', T('Q4b: drawing them', '4b：画出来'),
                 ol(T('Put $q_1$ on the horizontal axis and $q_2$ on the vertical one, and label them.', '横轴 $q_1$，纵轴 $q_2$，标上名字。'),
                    T('Each reaction function is a straight line: find where it hits each axis. $R_1$: $q_1 = 120$ when $q_2 = 0$, and $q_1 = 0$ when $q_2 = 480$. $R_2$: $q_2 = 192$ when $q_1 = 0$, and $q_2 = 0$ when $q_1 = 480$.',
                      '每条反应函数都是直线：求它与两轴的交点。$R_1$：$q_2 = 0$ 时 $q_1 = 120$，$q_2 = 480$ 时 $q_1 = 0$。$R_2$：$q_1 = 0$ 时 $q_2 = 192$，$q_1 = 480$ 时 $q_2 = 0$。'),
                    T('Draw both lines, label which is which, write the four intercepts, and mark the crossing point.', '画出两条线，标明哪条是哪条，写上四个截距，标出交点。')),
                 svg(fig_cournot(), T('In the plane with q1 across and q2 up, R1 runs from (120, 0) to (0, 480) and R2 from (0, 192) to (480, 0). They cross at (80, 160).',
                                     '横轴 q1、纵轴 q2 的平面上，R1 从 (120, 0) 连到 (0, 480)，R2 从 (0, 192) 连到 (480, 0)。两线交于 (80, 160)。'),
                     T('$R_1$ is the steep line (firm 1\'s choice, read across), $R_2$ the flat one. They cross at the Cournot equilibrium.', '$R_1$ 是陡的那条（厂商 1 的选择，横着读），$R_2$ 是平的那条。交点就是古诺均衡。'))),
            derive('q4c', T('Q4c: the equilibrium', '4c：均衡'),
                   [('q_1 = 120 - 0.25(192 - 0.4\\,q_1) = 72 + 0.1\\,q_1', T('Put $R_2$ into $R_1$.', '把 $R_2$ 代进 $R_1$。')),
                    ('0.9\\,q_1 = 72 \\;\\Rightarrow\\; q_1 = 80', T('Solve.', '解出来。')),
                    ('q_2 = 192 - 0.4 \\times 80 = 160', T('Back into $R_2$.', '代回 $R_2$。')),
                    ('p = 50 - 0.1 \\times 240 = 26', T('Price from the total, $Q = 240$ (or $240 = 500 - 10p$).', '由总量 $Q = 240$ 得价格（或 $240 = 500 - 10p$）。'))],
                   blank=(2, '160', T('Firm 2\'s output: put $q_1 = 80$ into $R_2$.', '厂商 2 的产量：把 $q_1 = 80$ 代进 $R_2$。')), skill=S),
            read('check', T('Check, and why firm 2 makes more', '自检，以及为什么厂商 2 做得多'),
                 ul(T('Firm 1: $MR_1 = 50 - 16 - 16 = 18$ and $MC_1 = 0.2 \\times 80 + 2 = 18$. Firm 2: $MR_2 = 50 - 8 - 32 = 10$ and $MC_2 = 0.05 \\times 160 + 2 = 10$.', '厂商 1：$MR_1 = 50 - 16 - 16 = 18$，$MC_1 = 0.2 \\times 80 + 2 = 18$。厂商 2：$MR_2 = 50 - 8 - 32 = 10$，$MC_2 = 0.05 \\times 160 + 2 = 10$。'),
                    T('Firm 2\'s marginal cost rises four times more slowly, so it is cheaper to expand: it produces twice as much.', '厂商 2 的边际成本上升慢四倍，扩产更便宜：所以它的产量是厂商 1 的两倍。'),
                    T('Why the crossing is where they end up: each round of replies shrinks the distance to (80, 160) by the product of the slopes, $0.25 \\times 0.4 = 0.1$, so it converges fast (the figure above).', '为什么最后会落在交点：每一轮回应，离 (80, 160) 的距离缩小为原来的两条斜率之积 $0.25 \\times 0.4 = 0.1$，很快就收敛了（见上面的图）。'))),
            read('compare', T('Cournot among the other market structures', '古诺与其他市场结构的比较'),
                 p(T('With Q4\'s own demand and costs:', '用第 4 题自己的需求和成本：')),
                 table([T('Structure', '结构'), T('How', '怎么做'), '$q_1$', '$q_2$', '$p$'],
                       [T('Cartel', '卡特尔'), T('maximise joint profit: $MR$ of the total $= MC_1 = MC_2$', '最大化联合利润：总量的 $MR = MC_1 = MC_2$'), '$40$', '$160$', '$30$'],
                       [T('Stackelberg (firm 1 leads)', '斯塔克尔伯格（厂商 1 先动）'), T('firm 1 puts $R_2$ into its own profit, then maximises', '厂商 1 把 $R_2$ 代进自己的利润，再求最大'), '$90$', '$156$', '$25.4$'],
                       [T('Cournot', '古诺'), T('both best-respond at once', '双方同时最优反应'), '$80$', '$160$', '$26$'],
                       [T('Competition', '完全竞争'), T('each sets $p = MC$', '每家都 $p = MC$'), '$68.6$', '$274.3$', '$15.7$']),
                 ul(T('**Stackelberg**: the leader commits first, knowing the follower will best-respond. Firm 1 faces $p = 50 - 0.1(q_1 + 192 - 0.4q_1) = 30.8 - 0.06q_1$, so $MR = 30.8 - 0.12q_1 = 0.2q_1 + 2$ gives $q_1 = 90$. Moving first pays: the leader produces more and earns more (1,296 against 1,280).', '**斯塔克尔伯格**：领导者先承诺产量，知道跟随者会做最优反应。厂商 1 面对 $p = 50 - 0.1(q_1 + 192 - 0.4q_1) = 30.8 - 0.06q_1$，于是 $MR = 30.8 - 0.12q_1 = 0.2q_1 + 2$，得 $q_1 = 90$。先动有利：领导者产得更多、赚得更多（1,296 对 1,280）。'),
                    T('**Cartel**: total output is lowest and the price highest (joint profit 4,800 against 4,480), but each firm gains by producing more than agreed: the prisoner\'s dilemma above.', '**卡特尔**：总产量最低、价格最高（联合利润 4,800 对 4,480），但每家多产都能多赚：就是上面的囚徒困境。'),
                    T('**Bertrand** (firms choose prices, identical goods, equal constant costs): undercutting continues until $p = MC$, so two firms are enough for the competitive price.', '**伯特兰**（厂商选价格、产品相同、成本相同且不变）：互相压价，直到 $p = MC$；两家就足以达到竞争价格。'),
                    T('As the number of Cournot firms grows, the outcome moves from monopoly toward competition.', '古诺厂商越多，结果就越从垄断走向竞争。')),
                 h(T('Traps', '易错点')),
                 ul(T('Dropping $q_2$ from firm 1\'s price before differentiating: $MR_1$ must be $50 - 0.2q_1 - 0.1q_2$.', '求导前把 $q_2$ 从厂商 1 的价格里丢了：$MR_1$ 必须是 $50 - 0.2q_1 - 0.1q_2$。'),
                    T('Drawing $R_1$ as if it gave $q_2$: it gives $q_1$, so it is the steep line in the $(q_1, q_2)$ plane.', '把 $R_1$ 当成给出 $q_2$ 的函数来画：它给的是 $q_1$，在 $(q_1, q_2)$ 平面里是陡的那条。'),
                    T('Forgetting the price in part c: the question asks for it too.', 'c 问忘了算价格：题目也要价格。')),
                 chapter=T('The wider topic', '这类题的全貌')),
            number('try', T('Your turn: unequal costs', '你来：成本不同'), S,
                   T('Demand is $p = 100 - (q_1 + q_2)$, $MC_1 = 10$ and $MC_2 = 20$. What is $q_1$ in the Cournot equilibrium? (Two decimals.)', '需求 $p = 100 - (q_1 + q_2)$，$MC_1 = 10$，$MC_2 = 20$。古诺均衡里 $q_1$ 是多少？（保留两位小数。）'),
                   33.33, T('$R_1$: $100 - 2q_1 - q_2 = 10$, so $q_1 = 45 - q_2/2$. $R_2$: $100 - q_1 - 2q_2 = 20$, so $q_2 = 40 - q_1/2$. Then $q_1 = 25 + q_1/4$, $q_1 = 33.33$, $q_2 = 23.33$, $p = 43.33$.',
                            '$R_1$：$100 - 2q_1 - q_2 = 10$，$q_1 = 45 - q_2/2$。$R_2$：$100 - q_1 - 2q_2 = 20$，$q_2 = 40 - q_1/2$。于是 $q_1 = 25 + q_1/4$，$q_1 = 33.33$，$q_2 = 23.33$，$p = 43.33$。'),
                   tolerance=0.02, hints=[T('Write both reaction functions, then substitute one into the other.', '写出两条反应函数，再把一条代进另一条。')], chapter=T('Your turn', '你来')),
            number('try-leader', T('Your turn: a leader', '你来：领导者'), S,
                   T('Demand $p = 100 - (q_1 + q_2)$, both firms have $MC = 10$, and firm 1 chooses first (Stackelberg). What is $q_1$?', '需求 $p = 100 - (q_1 + q_2)$，两家 $MC = 10$，厂商 1 先选（斯塔克尔伯格）。$q_1$ 是多少？'),
                   45, T('Follower: $q_2 = 45 - q_1/2$. Leader faces $p = 100 - q_1 - 45 + q_1/2 = 55 - q_1/2$, so $MR = 55 - q_1 = 10$ and $q_1 = 45$ ($q_2 = 22.5$, $p = 32.5$). In Cournot each would make 30.',
                         '跟随者：$q_2 = 45 - q_1/2$。领导者面对 $p = 100 - q_1 - 45 + q_1/2 = 55 - q_1/2$，$MR = 55 - q_1 = 10$，$q_1 = 45$（$q_2 = 22.5$，$p = 32.5$）。古诺下每家各产 30。'),
                   tolerance=0.1, hints=[T('Put the follower\'s reaction function into the leader\'s price first.', '先把跟随者的反应函数代进领导者的价格。')]),
            number('try-nash', T('Your turn: a best response', '你来：最优反应'), G,
                   T('In the 30-or-40 game above, firm 2 produces 30. How much does firm 1 earn by playing its best response?', '在上面那个 30 或 40 的博弈里，厂商 2 生产 30。厂商 1 做最优反应能赚多少？'),
                   2000, T('Against 30, producing 40 earns $40 \\times (120 - 70) = 2000$, more than $30 \\times 60 = 1800$.', '对方生产 30 时，自己生产 40 赚 $40 \\times (120 - 70) = 2000$，比 $30 \\times 60 = 1800$ 多。'),
                   tolerance=0.5),
        ],
    )


def L_malthus():
    S = 'e15.malthus'
    return dict(
        id=f'{CID}-malthus', title=T('The Malthusian trap (Q6)', '马尔萨斯陷阱（第 6 题）'),
        description=T('Income per person as a slope, why population returns to the same point after any shock, what to draw for the marks, and what finally broke the trap.', '人均收入是一条斜率，为什么任何冲击之后人口都回到原点，为拿分要画什么，以及最后是什么打破了陷阱。'),
        minutes=16,
        skills=[{'id': S, 'name': T('The Malthusian model', '马尔萨斯模型')}],
        misconceptions=[{'id': 'more-output-richer', 'description': T('Thinking that more total output means a higher standard of living', '以为总产出多了，生活水平就高了')}],
        steps=[
            read('glance', T('Answers at a glance', '一眼看答案'),
                 ul(T('**a.** Draw a ray from the origin whose slope is subsistence income $y^*$. The equilibrium $(N^*, Y^*)$ is where it meets $Y = A f(N, K)$.', '**a.** 从原点画一条斜率为生存收入 $y^*$ 的射线。均衡 $(N^*, Y^*)$ 是它与 $Y = A f(N, K)$ 的交点。'),
                    T('**b.** Immigrants move the economy right along the curve to $N_1$. Output rises, but output per person falls below $y^*$ (diminishing returns), so deaths exceed births and the population shrinks back to $N^*$, with output back at $Y^*$.',
                      '**b.** 移民让经济沿曲线右移到 $N_1$。总产出上升，但人均产出降到 $y^*$ 以下（边际收益递减），于是死亡多于出生，人口缩回 $N^*$，产出也回到 $Y^*$。')),
                 h(T('What this question needs', '这道题要用到的想法')),
                 ol(T('Diminishing returns to labour when land and capital are fixed.', '土地和资本固定时，劳动的边际收益递减。'),
                    T('Income per person $Y/N$ as the slope of a ray from the origin.', '人均收入 $Y/N$ 是一条过原点射线的斜率。'),
                    T('Population that grows above subsistence and shrinks below it.', '人口在生存水平之上增长、之下减少。')),
                 chapter=T('Q6 in short', '第 6 题速览')),
            read('slope', T('Income per person is a slope', '人均收入就是一条斜率'),
                 p(T('For a point $(N, Y)$ on the curve, income per person $Y/N$ is the slope of the line from the origin to that point. The production curve is concave (each extra worker adds less, because land and capital are fixed), so these rays get **flatter** as you move right: more people, less each.',
                     '对曲线上的一点 $(N, Y)$，人均收入 $Y/N$ 就是原点到这一点连线的斜率。生产曲线是凹的（土地和资本固定，每多一个劳动力增加的产出越来越少），所以越往右这条射线越**平**：人越多，每人分得越少。')),
                 h(T('The two assumptions that make the trap', '构成陷阱的两个假设')),
                 ol(T('**Diminishing returns to labour** with fixed technology $A$ and capital (or land) $K$: the concave curve.', '**劳动的边际收益递减**，技术 $A$ 和资本（或土地）$K$ 固定：凹的曲线。'),
                    T('**Population responds to income per person**: above subsistence $y^*$, births exceed deaths and $N$ grows; below it, $N$ shrinks.', '**人口随人均收入变化**：高于生存水平 $y^*$ 时出生多于死亡，$N$ 增长；低于时 $N$ 减少。')),
                 p(T('So the economy settles where $Y/N = y^*$: on the ray with slope $y^*$. Left of $N^*$ the curve is above the ray and the population grows; right of it the curve is below and the population shrinks. Both push toward $N^*$: the equilibrium is **stable**.',
                     '于是经济停在 $Y/N = y^*$ 处：斜率为 $y^*$ 的那条射线上。$N^*$ 左边曲线在射线上方，人口增长；右边曲线在射线下方，人口减少。两边都往 $N^*$ 推：这个均衡是**稳定**的。')),
                 visual('econ_malthus', T('The scene plays a wave of immigrants, then a better technology. Then drag the population along the curve: the gold ray\'s slope is income per person, and the arrow shows where the population heads. Raise the technology $A$: the population grows until income per person is back at $y^*$.',
                                          '画面先演一波移民，再演一次技术进步。然后沿曲线拖动人口：金色射线的斜率就是人均收入，箭头指向人口要去的方向。提高技术 $A$：人口会一直增长，直到人均收入回到 $y^*$。')),
                 chapter=T('The ideas', '背后的想法')),
            read('q6a', T('Q6a: the Malthusian equilibrium', '6a：马尔萨斯均衡'),
                 svg(fig_malthus(False), T('The concave production curve Y = A·f(N, K) and a straight ray from the origin with slope y*, the subsistence income. They meet at (N*, Y*), marked with dashed lines to both axes.',
                                           '凹的生产曲线 Y = A·f(N, K)，以及从原点出发、斜率为生存收入 y* 的直线射线。两者交于 (N*, Y*)，用虚线连到两轴。'),
                     T('What earns the marks: the ray labelled with its slope $y^*$, the crossing point, and $N^*$ and $Y^*$ marked on the axes.', '拿分的要点：射线标明斜率 $y^*$，标出交点，并在两轴上标 $N^*$ 和 $Y^*$。')),
                 p(T('Say in one sentence why it is an equilibrium: at $N^*$ income per person equals subsistence, so births equal deaths and the population stays put.', '用一句话说明它为什么是均衡：在 $N^*$ 处人均收入等于生存水平，出生等于死亡，人口不再变。')),
                 chapter=T('Worked solution', '完整解法')),
            read('q6b', T('Q6b: a wave of immigrants', '6b：一波移民'),
                 svg(fig_malthus(True), T('The same curve and ray. A point further right at N1 has a flatter dashed ray from the origin, so income per person there, Y1/N1, is below y*. An arrow along the N axis points from N1 back to N*.',
                                          '同样的曲线和射线。更靠右的 N1 处，原点到它的虚线射线更平，所以那里的人均收入 Y1/N1 低于 y*。N 轴上一支箭头从 N1 指回 N*。'),
                     T('Show the jump to $N_1$, the flatter ray (income per person below $y^*$), and the arrow back to $N^*$.', '画出跳到 $N_1$、更平的射线（人均收入低于 $y^*$），以及回到 $N^*$ 的箭头。')),
                 callout('note', T('A model answer for the box', '答题框里可以这样写'),
                         T('Immigration raises the population from $N^*$ to $N_1$. With fixed technology and capital, diminishing returns mean output rises less than in proportion, so income per person falls below the subsistence level $y^*$. Below subsistence, the death rate exceeds the birth rate and the population declines. It keeps declining until income per person is back at $y^*$, at the original $N^*$ and $Y^*$. In the long run the immigration changes nothing: the standard of living is pinned at subsistence.',
                           '移民使人口从 $N^*$ 增加到 $N_1$。技术和资本不变，边际收益递减，产出增加的比例小于人口，所以人均收入降到生存水平 $y^*$ 以下。低于生存水平时死亡率高于出生率，人口下降，一直降到人均收入回到 $y^*$，即原来的 $N^*$ 和 $Y^*$。长期看，移民什么也没改变：生活水平被钉在生存水平。'))),
            read('shocks', T('Every shock, the same way', '任何冲击，同一套分析'),
                 p(T('The exam can swap the immigrants for any other shock. Ask two questions: does it move the **point** along the curve, or move the **curve** (or the ray)? Then follow income per person.', '考试可以把移民换成别的冲击。问两个问题：它是让**点**沿曲线动，还是让**曲线**（或射线）动？然后跟着人均收入走。')),
                 table([T('Shock', '冲击'), T('Right after', '刚发生时'), T('Long run', '长期')],
                       [T('Immigration', '移民'), T('$N$ up, $Y/N$ down', '$N$ 增加，$Y/N$ 下降'), T('back to $N^*$, $y^*$', '回到 $N^*$、$y^*$')],
                       [T('A plague or war', '瘟疫或战争'), T('$N$ down, $Y/N$ up', '$N$ 减少，$Y/N$ 上升'), T('back to $N^*$, $y^*$', '回到 $N^*$、$y^*$')],
                       [T('Better technology ($A$ up) or more land', '技术进步（$A$ 提高）或更多土地'), T('curve up, $Y/N$ up', '曲线上移，$Y/N$ 上升'), T('more people, same $y^*$', '人更多，$y^*$ 不变')],
                       [T('Higher subsistence norm (later marriage, fewer births at each income)', '生存标准提高（晚婚，同样收入下出生更少）'), T('steeper ray', '射线变陡'), T('fewer people, richer: $Y/N$ rises to the new $y^*$', '人更少、更富：$Y/N$ 升到新的 $y^*$')]),
                 quiz(T('People start to marry later, so at every income fewer children are born; the population is stable only at a higher income per person. In the long run…', '人们开始晚婚，同样收入下出生的孩子更少；人口只有在更高的人均收入下才稳定。长期里……'),
                      [(T('income per person is higher and the population smaller', '人均收入更高，人口更少'), True),
                       (T('nothing changes: everything returns to the old $N^*$', '什么都不变：一切回到原来的 $N^*$'), T('That holds for shocks that move the point along the curve. This one moves the ray: the new equilibrium is where the steeper ray meets the curve.', '那是让点沿曲线动的冲击才成立。这个冲击让射线动了：新均衡在更陡的射线与曲线的交点。')),
                       (T('the population is larger, as with better technology', '人口更多，和技术进步一样'), T('Better technology moves the curve up and keeps $y^*$. Here $y^*$ itself rises, and the steeper ray meets the curve further left.', '技术进步让曲线上移、$y^*$ 不变。这里是 $y^*$ 本身上升，更陡的射线在更靠左的地方与曲线相交。'))],
                      T('The only way out of the trap inside this model is to change the population rule itself: a steeper ray meets the concave curve at a smaller $N$, where income per person is higher.', '在这个模型里，走出陷阱的唯一办法是改变人口规则本身：更陡的射线在更小的 $N$ 处与凹曲线相交，那里人均收入更高。'))),
            read('escape', T('What finally broke the trap', '最后是什么打破了陷阱'),
                 ul(T('In the Malthusian world, better technology only buys more people at the same living standard: for most of history, average income barely moved.', '在马尔萨斯世界里，技术进步只换来更多的人，生活水平不变：人类历史的大部分时间里，平均收入几乎没变。'),
                    T('Modern growth escaped because technology kept improving faster than population, and population growth stopped tracking income (the **demographic transition**: richer families had fewer children).', '现代增长走出了陷阱：技术进步一直快于人口增长，而且人口增长不再跟着收入走（**人口转变** demographic transition：越富的家庭孩子越少）。'),
                    T('In exam answers, keep the language of the model: "diminishing returns", "subsistence", "birth and death rates", "returns to the original equilibrium".', '答题时用模型的术语：“边际收益递减 diminishing returns”“生存水平 subsistence”“出生率和死亡率 birth and death rates”“回到原来的均衡 returns to the original equilibrium”。')),
                 chapter=T('The wider topic', '这类题的全貌')),
            text_q('explain', T('Say it in your own words', '用你自己的话说'), S,
                   T('In two or three sentences: what happens in the Malthusian model after a large wave of immigration, and why?', '用两三句话：马尔萨斯模型里来了一大波移民之后会发生什么？为什么？'),
                   [T('Output per person falls below subsistence, because of diminishing returns to labour', '因为劳动的边际收益递减，人均产出降到生存水平以下'),
                    T('Below subsistence, deaths exceed births, so the population falls', '低于生存水平时死亡多于出生，人口下降'),
                    T('In the long run population, output and income per person return to their original levels', '长期里人口、产出和人均收入都回到原来的水平')],
                   T('Immigration raises population, and with diminishing returns output per person falls below subsistence. Then deaths exceed births and the population falls back until income per person returns to subsistence, at the original population and output.',
                     '移民增加了人口，由于边际收益递减，人均产出降到生存水平以下。于是死亡多于出生，人口回落，直到人均收入回到生存水平，人口和产出也回到原来的水平。'),
                   T('Three links: diminishing returns (income per person falls), the population rule (deaths exceed births), and the return to the same equilibrium.', '三个环节：边际收益递减（人均收入下降）、人口规则（死亡多于出生）、回到同一个均衡。'),
                   chapter=T('Your turn', '你来')),
            choice('technology', T('A better plough', '更好的犁'), S,
                   T('A new farming technology raises $A$. In the Malthusian long run, what happens to income per person?', '一项新的农业技术提高了 $A$。在马尔萨斯的长期里，人均收入会怎样？'),
                   [(T('It returns to subsistence, with a larger population', '回到生存水平，人口更多'), True),
                    (T('It rises permanently', '永久提高'), T('Only for a while: above subsistence the population grows until income per person is back at $y^*$.', '只是暂时的：高于生存水平时人口增长，直到人均收入回到 $y^*$。'), 'more-output-richer'),
                    (T('It falls below subsistence', '降到生存水平以下'), T('More output per worker cannot lower income per person; it raises it, until the population catches up.', '每个劳动力产出更多，不会降低人均收入；它会先提高，直到人口追上来。'))],
                   T('The curve shifts up, income per person rises above $y^*$, the population grows, and the economy settles on the same ray at a larger $N$ and $Y$.', '曲线上移，人均收入高于 $y^*$，人口增长，经济停在同一条射线上，$N$ 和 $Y$ 都更大。')),
            number('try-nstar', T('Your turn: where it settles', '你来：停在哪'), S,
                   T('Output is $Y = 6\\sqrt{N}$ and subsistence income is $y^* = 2$. What is the Malthusian equilibrium population $N^*$?', '产出 $Y = 6\\sqrt{N}$，生存收入 $y^* = 2$。马尔萨斯均衡人口 $N^*$ 是多少？'),
                   9, T('On the ray $Y = 2N$: $6\\sqrt{N} = 2N$, so $\\sqrt{N} = 3$ and $N^* = 9$ ($Y^* = 18$).', '在射线 $Y = 2N$ 上：$6\\sqrt{N} = 2N$，$\\sqrt{N} = 3$，$N^* = 9$（$Y^* = 18$）。'),
                   tolerance=0.01, hints=[T('Income per person is $Y/N = 6/\\sqrt{N}$; set it equal to $y^*$.', '人均收入 $Y/N = 6/\\sqrt{N}$；令它等于 $y^*$。')]),
        ],
    )


def L_drill():
    D = 'e15.drill'
    return dict(
        id=f'{CID}-drill', title=T('One-page method sheet, and a 20-minute drill', '一页方法表，加 20 分钟练习'),
        description=T('Every method in one table, then eight questions with new numbers.', '所有方法一张表，再加八道换了数的题。'),
        minutes=25,
        skills=[{'id': D, 'name': T('The whole exam', '整张试卷')}],
        steps=[
            read('sheet', T('The method sheet', '方法表'),
                 table([T('Question type', '题型'), T('Method', '方法'), T('Ten-second check', '十秒自检')],
                       [T('Equilibrium', '均衡'), T('$Q_d = Q_s$; price, then quantity from either curve', '$Q_d = Q_s$；先求价格，再用任一条曲线求数量'), T('both curves give the same $Q$', '两条曲线给出同一个 $Q$')],
                       [T('Quota', '配额'), T('$Q =$ quota; price from **demand**', '$Q =$ 配额；价格从**需求**读'), T('the quota is below the free-trade quantity', '配额小于自由贸易数量')],
                       [T('Tariff $t$', '关税 $t$'), T('demand at $p_s + t$ = supply at $p_s$; revenue $tQ$ stays at home', '需求（按 $p_s + t$）= 供给（按 $p_s$）；税收 $tQ$ 留在国内'), T('$p_b - p_s = t$', '$p_b - p_s = t$')],
                       [T('Welfare', '福利'), T('$CS = \\tfrac12 Q(\\text{intercept} - p)$; add externality × $Q$, tax revenue; count only the country\'s people', '$CS = \\tfrac12 Q(\\text{截距} - p)$；加外部性 × $Q$、税收；只算本国人'), T('the change splits into rectangles and triangles', '变化能拆成矩形和三角形')],
                       [T('Deadweight loss', '无谓损失'), T('triangle between demand and $MC$ (or supply), from the actual $Q$ to the efficient $Q$', '需求与 $MC$（或供给）之间、从实际 $Q$ 到有效 $Q$ 的三角形'), T('it points at the efficient quantity', '三角形尖端指向有效数量')],
                       [T('Monopoly', '垄断'), T('inverse demand → $MR$ (twice the slope) → $MR = MC$ → price from demand → profit $= pQ - C$', '反需求 → $MR$（斜率翻倍）→ $MR = MC$ → 价格从需求读 → 利润 $= pQ - C$'), T('$\\frac{p - MC}{p} = \\frac{1}{|\\varepsilon|}$', '$\\frac{p - MC}{p} = \\frac{1}{|\\varepsilon|}$')],
                       [T('Tax on a monopolist', '对垄断者征税'), T('percentage: seller\'s demand $= p_{\\text{buyer}}/(1 + \\tau)$; per unit: $p_{\\text{buyer}} - t$; redo $MR = MC$', '百分比：卖方需求 $= p_{\\text{买}}/(1 + \\tau)$；从量：$p_{\\text{买}} - t$；重做 $MR = MC$'), T('incidence = how far each price moved', '归宿 = 两边价格各动了多少')],
                       [T('Third degree', '三级歧视'), T('$MR_i = MC$ in each market', '每个市场 $MR_i = MC$'), T('the less elastic market pays more', '弹性小的市场价格高')],
                       [T('Second degree (packages)', '二级（套餐）'), T('high: efficient $q$; low: $D_{\\text{low}} - MC = $ gap; $T_{\\text{low}} = V_{\\text{low}}$; $T_{\\text{high}} = V_{\\text{high}} - $ rent', '高类型：有效数量；低类型：$D_{\\text{低}} - MC = $ 差距；$T_{\\text{低}} = V_{\\text{低}}$；$T_{\\text{高}} = V_{\\text{高}} - $ 租金'), T('the high type is indifferent between the packages', '高类型对两个套餐无差异')],
                       [T('Two-part tariff', '两部定价'), T('price per unit $= MC$; fee $=$ consumer surplus at that price', '单价 $= MC$；入场费 $=$ 该价格下的消费者剩余'), T('the fee is a triangle', '入场费是个三角形')],
                       [T('Cournot', '古诺'), T('$MR_i$ with the rival fixed $= MC_i$ → reaction functions → solve both', '固定对手产量的 $MR_i = MC_i$ → 反应函数 → 联立求解'), T('$MR_i = MC_i$ at the answer, for both firms', '答案处两家都满足 $MR_i = MC_i$')],
                       [T('Stackelberg', '斯塔克尔伯格'), T("put the follower's $R_2$ into the leader's price, then $MR_1 = MC_1$", '把跟随者的 $R_2$ 代进领导者的价格，再令 $MR_1 = MC_1$'), T('the leader produces more than in Cournot', '领导者产量比古诺多')],
                       [T('Short-run firm', '短期厂商'), T('$p = MC$ above $\\min AVC$; shut down below it', '$\\min AVC$ 以上 $p = MC$；低于它就停产'), T('profit $= (p - AC)q$', '利润 $= (p - AC)q$')],
                       [T('Long-run competition', '长期竞争'), T('$\\min AC$ (or $LMC = AC$); supply flat there; firms $= Q/q$', '$\\min AC$（或 $LMC = AC$）；供给在那里是平的；厂商数 $= Q/q$'), T('$LMC = AC$ at that $q$', '那个 $q$ 处 $LMC = AC$')],
                       [T('Elasticity', '弹性'), T('$\\frac{dQ}{dp}\\cdot\\frac{p}{Q}$ at the stated point', '在指定点算 $\\frac{dQ}{dp}\\cdot\\frac{p}{Q}$'), T('negative for demand', '需求弹性为负')],
                       [T('Malthus', '马尔萨斯'), T('ray of slope $y^*$; diminishing returns; birth and death rates; back to $N^*$', '斜率 $y^*$ 的射线；边际收益递减；出生率与死亡率；回到 $N^*$'), T('the long run ends on the same ray', '长期总回到同一条射线')]),
                 chapter=T('Method sheet', '方法表')),
            number('d1', T('Quota price', '配额价格'), D, T('Demand $Q = 90 - 3p$, import supply $Q = 6p$. A quota allows 30 units. What is the market price?', '需求 $Q = 90 - 3p$，进口供给 $Q = 6p$。配额 30 个。市场价格是多少？'),
                   20, T('Free trade gives $Q = 60$, so the quota binds. From demand: $30 = 90 - 3p$, so $p = 20$.', '自由贸易 $Q = 60$，配额是紧的。由需求：$30 = 90 - 3p$，$p = 20$。'), tolerance=0.01, purpose='check', chapter=T('Drill', '练习')),
            number('d2', T('Monopoly profit', '垄断利润'), D, T('Demand $p = 100 - Q$, constant marginal cost 20, no fixed cost. What is the monopoly profit?', '需求 $p = 100 - Q$，边际成本恒为 20，没有固定成本。垄断利润是多少？'),
                   1600, T('$MR = 100 - 2Q = 20$, so $Q = 40$ and $p = 60$; profit $= (60 - 20) \\times 40 = 1600$.', '$MR = 100 - 2Q = 20$，$Q = 40$，$p = 60$；利润 $= (60 - 20) \\times 40 = 1600$。'), tolerance=0.5, purpose='check'),
            number('d3', T('A 50% tax', '50% 的税'), D, T('Same monopolist ($p = 100 - Q$ for buyers, $MC = 20$). A 50% tax means buyers pay $1.5p$ when the seller gets $p$. What price do buyers pay?', '同一个垄断者（买方需求 $p = 100 - Q$，$MC = 20$）。50% 的税：卖方收 $p$ 时买方付 $1.5p$。买方付多少？'),
                   65, T('Seller faces $p = (100 - Q)/1.5$, $MR = (100 - 2Q)/1.5 = 20$, so $Q = 35$; buyers pay $100 - 35 = 65$ (the seller keeps $43.33$).', '卖方面对 $p = (100 - Q)/1.5$，$MR = (100 - 2Q)/1.5 = 20$，$Q = 35$；买方付 $100 - 35 = 65$（卖方拿 $43.33$）。'), tolerance=0.01, purpose='check'),
            number('d4', T('Third degree', '三级歧视'), D, T('Markets $p_1 = 40 - Q_1$ and $p_2 = 30 - 2Q_2$, $MC = 10$. What price is charged in market 2?', '市场 $p_1 = 40 - Q_1$、$p_2 = 30 - 2Q_2$，$MC = 10$。市场 2 定什么价？'),
                   20, T('$MR_2 = 30 - 4Q_2 = 10$, so $Q_2 = 5$ and $p_2 = 20$ (market 1: $Q_1 = 15$, $p_1 = 25$).', '$MR_2 = 30 - 4Q_2 = 10$，$Q_2 = 5$，$p_2 = 20$（市场 1：$Q_1 = 15$，$p_1 = 25$）。'), tolerance=0.01, purpose='check'),
            number('d5', T('Symmetric Cournot', '对称古诺'), D, T('Two identical firms, demand $p = 120 - (q_1 + q_2)$, zero marginal cost. What is the Cournot price?', '两家相同的厂商，需求 $p = 120 - (q_1 + q_2)$，边际成本为零。古诺价格是多少？'),
                   40, T('$MR_1 = 120 - 2q_1 - q_2 = 0$; by symmetry $q_1 = q_2 = 40$, $Q = 80$, $p = 40$.', '$MR_1 = 120 - 2q_1 - q_2 = 0$；对称时 $q_1 = q_2 = 40$，$Q = 80$，$p = 40$。'), tolerance=0.01, purpose='check'),
            number('d6', T('Long-run price', '长期价格'), D, T('Each firm has $C = q^3 - 10q^2 + 40q$. What is the long-run competitive price?', '每家厂商 $C = q^3 - 10q^2 + 40q$。长期竞争价格是多少？'),
                   15, T('$AC = q^2 - 10q + 40$ is lowest at $q = 5$: $25 - 50 + 40 = 15$.', '$AC = q^2 - 10q + 40$ 在 $q = 5$ 处最低：$25 - 50 + 40 = 15$。'), tolerance=0.01, purpose='check'),
            number('d7', T('Elasticity', '弹性'), D, T('Demand $Q = 600 - 3p$. What is the point elasticity at $p = 50$? (Signed, two decimals.)', '需求 $Q = 600 - 3p$。$p = 50$ 处的点弹性是多少？（带符号，两位小数。）'),
                   -0.33, T('$Q = 450$; $\\varepsilon = -3 \\times 50/450 = -1/3$.', '$Q = 450$；$\\varepsilon = -3 \\times 50/450 = -1/3$。'), tolerance=0.01, purpose='check'),
            choice('d8', T('A plague', '一场瘟疫'), D, T('In a Malthusian economy, a plague kills a third of the population. What happens to income per person right after, and in the long run?', '马尔萨斯经济里，一场瘟疫夺走了三分之一的人口。之后人均收入马上怎样？长期又怎样？'),
                   [(T('It rises at first, then returns to subsistence as the population recovers', '先上升，随着人口恢复又回到生存水平'), True),
                    (T('It falls, because output falls', '下降，因为产出下降了'), T('Output falls less than population (diminishing returns run in reverse), so output per person rises.', '产出下降的比例小于人口（边际收益递减反过来起作用），所以人均产出上升。'), None),
                    (T('It rises permanently', '永久上升'), T('Above subsistence, births exceed deaths: the population grows back until income per person is at $y^*$ again.', '高于生存水平时出生多于死亡：人口会长回来，直到人均收入又回到 $y^*$。'), None)],
                   T('Fewer people on the same land: each produces more, so income per person rises above $y^*$; then the population grows back to $N^*$.', '同样的土地上人少了：每人产出更多，人均收入高于 $y^*$；然后人口长回到 $N^*$。')),
        ],
    )


LESSONS = [L_map, L_markets, L_longrun, L_monopoly, L_discrimination, L_cournot, L_malthus, L_drill]
UNITS = [
    (T('Start here', '从这里开始'), [f'{CID}-map']),
    (T('Markets', '市场'), [f'{CID}-markets', f'{CID}-longrun']),
    (T('Market power', '市场势力'), [f'{CID}-monopoly', f'{CID}-discrimination', f'{CID}-cournot']),
    (T('Growth', '增长'), [f'{CID}-malthus']),
    (T('Before the exam', '考前'), [f'{CID}-drill']),
]


def build():
    out_dir = os.path.join(DEMO, CID)
    os.makedirs(out_dir, exist_ok=True)
    entries = []
    for make in LESSONS:
        L = make()
        lesson = {'id': L['id'], 'mode': 'essay', 'title': L['title'], 'description': L['description'], 'minutes': L['minutes'],
                  'skills': L['skills'], 'misconceptions': L.get('misconceptions', []), 'steps': L['steps']}
        with open(os.path.join(out_dir, f'{L["id"]}.json'), 'w', encoding='utf8') as f:
            json.dump(lesson, f, ensure_ascii=False, separators=(',', ':'))
        entries.append({'id': L['id'], 'title': L['title'], 'summary': L['description'], 'minutes': L['minutes'],
                        'meta': {'title': L['title'], 'mode': 'essay', 'langs': ['en', 'zh'], 'has_scene': False,
                                 'kinds': sorted({s['kind'] for s in L['steps']}), 'skills': L['skills']}})
    course = {
        'id': CID,
        'title': T('ECON90015 mock exam, explained', 'ECON90015 模考精讲'),
        'summary': T('Every question of the mock exam worked through, and every idea behind it explained from the ground up: welfare and trade policy, costs and entry, monopoly and taxes, price discrimination, games and oligopoly, the Malthusian trap.', '把模考的每道题讲透，再把每道题背后的知识从头讲清：福利与贸易政策、成本与进入、垄断与税、价格歧视、博弈与寡头、马尔萨斯陷阱。'),
        'audience': T('Students about to sit the exam who know university maths but have seen little of the course; a quick review, not a first course.',
                      '快要考试、会大学数学但没怎么上过这门课的同学；这是快速复习，不是入门课。'),
        'outcomes': [T('Solve each type of question in the paper with a method you can check', '每类题都有一个能自检的解法'),
                     T('Explain the idea behind each answer, in the words the examiner expects', '用阅卷人期待的术语讲清每个答案背后的道理'),
                     T('Recognise the traps and the twists a real exam can add', '认得出易错点，以及真题可能加的变化')],
        'lang': 'en', 'mine': False, 'public': True, 'ready': True, 'packs': ['econ'], 'origin': {'decks': 0, 'exams': 1, 'note': T('Written by an AI (Claude) from 1 practice exam · not edited by a person', '由 AI（Claude）根据 1 份模拟题编写 · 未经人工修改')},
        'units': [{'title': t, 'lessons': ids} for t, ids in UNITS],
        'lessons': entries, 'demo': True,
    }
    path = os.path.join(DEMO, 'courses.json')
    with open(path, encoding='utf8') as f:
        courses = json.load(f)
    courses = [c for c in courses if c.get('id') != CID] + [course]
    with open(path, 'w', encoding='utf8') as f:
        json.dump(courses, f, ensure_ascii=False, indent=1)
    print(f'{len(entries)} lessons -> {out_dir}; courses.json has {len(courses)} courses')


if __name__ == '__main__':
    build()
