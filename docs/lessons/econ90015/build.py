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


def paper(title, *paras, answer=False):
    """Text as it stands on the exam paper (in English), the Chinese under it in the Chinese course."""
    b = {'type': 'paper', 'title': title, 'lang': 'en', 'paras': list(paras)}
    if answer: b['answer'] = True
    return b


def derive(id, title, lines, intro=None, outro=None, chapter=None, blank=None, skill=None):
    """
    A worked solution revealed line by line. Each line is (tex, say) or (tex, say, why): `say` is the step
    in words, shown above it; `why` a further reason behind a button. `blank` = (line, answer, prompt[,
    variables]) leaves one line for the learner.
    """
    def line(x):
        d = {'tex': x[0]}
        if len(x) > 1 and x[1]: d['say'] = x[1]
        if len(x) > 2 and x[2]: d['why'] = x[2]
        return d
    s = {'kind': 'derive', 'id': id, 'title': title, 'lines': [line(x) for x in lines]}
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


def fig_demand():
    P = Plot(0, 125, 0, 64)
    P.curve(lambda q: 60 - q / 2, 0, 120, BLUE)
    for q in (20, 60, 100):
        P.seg((q, 0), (q, 60 - q / 2), BLUE, 2, '4 5')
        P.dot(q, 60 - q / 2, BLUE)
    P.text(20, 50, 'the 20th: worth 50', INK, 15, dx=10, dy=-6)
    P.text(60, 30, 'the 60th: worth 30', INK, 15, dx=10, dy=-6)
    P.text(100, 10, 'the 100th: worth 10', INK, 15, dx=-4, dy=-14)
    P.text(116, 4, 'D', BLUE, 18)
    P.axes('Q', 'p', xticks=(20, 60, 100, 120), yticks=(10, 30, 50, 60))
    return P.svg()


def fig_market():
    P = Plot(0, 125, 0, 64)
    P.curve(lambda q: 60 - q / 2, 0, 120, BLUE)
    P.curve(lambda q: q / 10, 0, 125, ORANGE)
    P.guide(100, 10)
    P.dot(100, 10, INK)
    P.text(100, 10, 'E', INK, 18, dx=-6, dy=-14, weight='600')
    P.text(116, 4, 'D', BLUE, 18)
    P.text(122, 12.5, 'S', ORANGE, 18, dy=-10)
    P.axes('Q', 'p', xticks=(100, 120), yticks=(10, 60))
    return P.svg()


def fig_quota_price():
    P = Plot(0, 125, 0, 64)
    P.curve(lambda q: 60 - q / 2, 0, 120, BLUE)
    P.curve(lambda q: q / 10, 0, 125, ORANGE)
    P.seg((60, 0), (60, 62), ORANGE, 3)
    P.guide(60, 30)
    P.seg((0, 6), (60, 6), MUTED, 1.5, '5 5')
    P.dot(100, 10, MUTED, 4)
    P.dot(60, 30, BLUE)
    P.dot(60, 6, ORANGE)
    P.text(60, 30, 'buyers pay 30', BLUE, 15, dx=10, dy=-8)
    P.text(60, 6, 'sellers would ship it for 6', ORANGE, 15, dx=10, dy=18)
    P.text(60, 60, 'quota: 60', ORANGE, 15, dx=8)
    P.text(116, 4, 'D', BLUE, 18)
    P.text(122, 12.5, 'S', ORANGE, 18, dy=-10)
    P.axes('Q', 'p', xticks=(60, 100, 120), yticks=(6, 30, 60))
    return P.svg()


def fig_cs():
    P = Plot(0, 125, 0, 64)
    P.area([(0, 60), (0, 10), (100, 10)], BLUE, 0.14)
    P.area([(0, 60), (0, 30), (60, 30)], BLUE, 0.3)
    P.curve(lambda q: 60 - q / 2, 0, 120, BLUE)
    P.seg((0, 10), (100, 10), INK, 2)
    P.seg((0, 30), (60, 30), INK, 2)
    P.dot(100, 10, INK, 4)
    P.dot(60, 30, INK, 4)
    P.text(14, 38, '900', INK, 16, 'middle', weight='600')
    P.text(40, 17, '2500 in all', INK, 16, 'middle', weight='600')
    P.text(116, 4, 'D', BLUE, 18)
    P.axes('Q', 'p', xticks=(60, 100, 120), yticks=(10, 30, 60))
    return P.svg()


def fig_mr():
    P = Plot(0, 165, 0, 640)
    P.area([(0, 400), (100, 400), (100, 360), (0, 360)], ORANGE, 0.35)
    P.area([(100, 360), (120, 360), (120, 0), (100, 0)], GREEN, 0.28)
    P.curve(lambda q: 600 - 2 * q, 0, 160, BLUE)
    P.dot(100, 400, INK, 4)
    P.dot(120, 360, INK, 4)
    P.seg((100, 400), (100, 0), MUTED, 1.5, '5 5')
    P.text(50, 380, 'lost: 100 × 40 = 4,000', ORANGE, 15, 'middle', dy=6, weight='600')
    P.text(110, 180, 'gained', GREEN, 15, 'middle', weight='600')
    P.text(110, 140, '20 × 360', GREEN, 14, 'middle')
    P.text(110, 105, '= 7,200', GREEN, 14, 'middle')
    P.text(160, 280, 'D', BLUE, 18, dx=-6, dy=-10)
    P.axes('Q', 'p', xticks=(100, 120), yticks=(360, 400, 600))
    return P.svg()


def fig_malthus_curve():
    P = Plot(0, 10, 0, 10.5)
    P.curve(lambda n: 3 * math.sqrt(n), 0, 10, BLUE, 3, n=120)
    P.text(10, 3 * math.sqrt(10), 'Y = A·f(N, K)', BLUE, 16, 'end', dy=50)
    P.axes('N', 'Y')
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
# Every lesson follows the learner (README.md): the question as printed and a slow read of it; then
# part by part, the idea that part needs from the ground up and the solution with every line said in
# words; then a full-mark answer as written on the paper, the wider topic, and practice.
Q_CH = lambda: T('The question', '题目')
PART = lambda x: T(f'Part ({x})', f'({x}) 小问')
PAPER_CH = lambda: T('On the exam paper', '写在卷面上')
WIDER_CH = lambda: T('The wider topic', '这类题的全貌')
TRY_CH = lambda: T('Your turn', '你来')


def L_map():
    return dict(
        id=f'{CID}-map', title=T('Start here: the exam, and how we will learn it', '从这里开始：这张试卷，以及我们怎么学'),
        description=T('What the six questions are about, why the lessons come in this order, and the two ideas that run through almost every mark.', '六道题各讲什么，课为什么按这个顺序排，以及贯穿几乎每一分的两个想法。'),
        minutes=10,
        skills=[{'id': 'e15.map', 'name': T('Reading the exam', '读懂这张卷子')}],
        steps=[
            read('exam', T('What this exam asks', '这张试卷考什么'),
                 p(T(r"This course is built on one mock exam for ECON90015, Semester 1, 2026: six questions, 100 marks, all in English. You do not need to have taken the course. You need what a first year of university maths gives you, derivatives and solving equations; every idea of economics the questions use is taught here from the beginning.",
                     r"这门课围绕 ECON90015 的一份模拟考试（2026 年第一学期）展开：六道题，共 100 分，全英文。你不需要上过这门课，只需要大一数学的底子：会求导、会解方程。题目里用到的每个经济学想法，这里都从头讲起。")),
                 p(T(r"Here is what each question is about, as a story. Each lesson starts with its question exactly as printed.", r"先看看每道题讲的是一件什么事。每一课都从这道题的原文开始。")),
                 table([T('Question', '题'), T('The situation', '题目里发生的事'), T('Marks', '分值')],
                       ['1', T('A country buys all its wind turbines from abroad. Its government then limits how many may come in. Who gains and who loses, in dollars?', '一个国家的风机全靠进口。政府随后限制进口数量。谁得谁失，各多少钱？'), '16'],
                       ['2', T('A firm is the only seller of its product. The government then taxes every sale. What does the firm do, and who really pays the tax?', '一家厂商是某种产品的唯一卖家。政府随后对每笔销售征税。厂商会怎么做？税到底是谁付的？'), '25'],
                       ['3', T('One seller, two kinds of customers. Can it charge them differently, and how, when it cannot tell them apart?', '一个卖家，两类顾客。能不能向他们收不同的价？分不清谁是谁的时候又该怎么收？'), '19'],
                       ['4', T('Two firms share a market. Each decides how much to produce, knowing the other is deciding too.', '两家厂商共享一个市场。每家都要决定生产多少，并且知道对方也在做同样的决定。'), '20'],
                       ['5', T('An industry of many small firms, any of which can come or go. Where does the price end up?', '一个行业里有很多小厂商，谁都可以进来或离开。价格最后会停在哪？'), '8'],
                       ['6', T('A whole economy over centuries: what happens to population and living standards when more people arrive?', '一整个经济体，跨越几百年：人口增加了，人口和生活水平会怎样？'), '12'])),
            read('order', T('Why the lessons come in this order', '为什么按这个顺序学'),
                 p(T(r"The lessons do not follow the question numbers. They follow the order in which the ideas build on each other, so that every lesson only uses what came before:",
                     r"课的顺序不按题号，而按想法之间的依赖：每一课只用到前面讲过的东西。")),
                 ol(T(r"**Question 1, markets.** What demand and supply curves are, how a market finds its price, and how to measure in dollars who gains. Everything after this uses it.", r"**第 1 题，市场。** 需求曲线和供给曲线到底是什么，市场怎么定出价格，以及怎么用钱衡量谁得了好处。后面每一课都要用到。"),
                    T(r"**Question 5, firms and costs.** What it costs a firm to produce, how a firm that cannot affect the price decides how much to make, and why competition drives the price down to cost.", r"**第 5 题，厂商与成本。** 厂商生产要花多少成本，一家影响不了价格的厂商怎么决定产量，以及竞争为什么把价格压到成本。"),
                    T(r"**Question 2, one seller.** A monopolist can choose its price. It uses the market of question 1 and the costs of question 5. Then a tax.", r"**第 2 题，独家卖方。** 垄断者可以自己定价。要用到第 1 题的市场和第 5 题的成本。然后加一道税。"),
                    T(r"**Question 3, one seller, many prices.** The monopolist of question 2 charges different buyers differently.", r"**第 3 题，独家卖方，多种价格。** 第 2 题的垄断者向不同买家收不同的价。"),
                    T(r"**Question 4, two sellers.** Each firm reasons like the monopolist of question 2, but must also guess the other.", r"**第 4 题，两家卖方。** 每家都像第 2 题的垄断者那样思考，还得猜对方。"),
                    T(r"**Question 6, the whole economy.** A different kind of question (macroeconomics, argued on a diagram); it stands on its own.", r"**第 6 题，整个经济。** 另一类题（宏观经济学，在图上讲道理）；它自成一体。")),
                 h(T('Two ideas you will meet in almost every question', '几乎每道题都会遇到的两个想法')),
                 p(T(r"**Decide at the margin.** *Marginal* means *of one more unit*. A bakery asks of each extra loaf: does it bring in more than it costs to bake? If the 50th loaf sells for \$3 and costs \$2 to bake, bake it. If the 80th sells for \$3 but costs \$3.50, do not. The best number of loaves is where one more brings in exactly what it costs. In calculus: profit is highest where its derivative is zero, and the derivative of profit is *what one more unit brings in minus what it costs*.",
                     r"**在边际上做决定。** *边际*（marginal）的意思是*多一个单位的*。面包店对每多烤一个面包都问：它带来的钱比烤它的成本多吗？第 50 个面包卖 3 美元、成本 2 美元，就烤；第 80 个卖 3 美元、成本 3.5 美元，就不烤。最好的数量，是再多一个带来的钱恰好等于它的成本。用微积分说：利润在导数为零处最大，而利润的导数就是*多一个单位带来的钱减去它的成本*。")),
                 p(T(r"**Gains are areas.** If you would pay up to \$8 for something and it costs \$5, you are \$3 better off. Add such gains over everyone who buys and you get an area between a curve and a price line on a diagram. In calculus: an integral; in this exam almost always a triangle or a rectangle.",
                     r"**好处是面积。** 一样东西你最多愿意出 8 美元，结果只花了 5 美元，你就多得了 3 美元。把所有买家的这种好处加起来，在图上就是曲线和价格线之间的一块面积。用微积分说：一个积分；在这张卷子里几乎都是三角形或矩形。")),
                 p(T(r"If these sound abstract now, that is fine: each comes back with real numbers, in the question that needs it.", r"现在听起来抽象也没关系：每个想法都会在需要它的那道题里，带着具体的数回来。"))),
            read('how', T('How each lesson works', '每一课怎么走'),
                 ol(T(r"**The question**, as printed (in English, with the Chinese under it), then a slow read: what each sentence tells you and what each part asks.", r"**题目**原文（英文，下面附中文），然后慢慢读一遍：每句话告诉你什么，每一小问在问什么。"),
                    T(r"**Part by part.** First the idea that part needs, from the ground up, with a figure you can drag where moving it shows more than words; then the solution, with every line said in words. You do the key step yourself.", r"**一小问一小问地来。** 先把这一问需要的想法从头讲清，拖动比文字更能说明问题的地方配一张可以拖的图；再给出解法，每一行都用文字讲明白。关键的一步由你自己来做。"),
                    T(r"**On the exam paper**: a full-mark answer, written the way you would write it in the exam.", r"**写在卷面上**：一份满分答案，按考试时该写的样子写出来。"),
                    T(r"**The wider topic**: what else an exam on this topic can ask, taught the same way.", r"**这类题的全貌**：这个话题下考试还可能问什么，同样讲清楚。"),
                    T(r"**Your turn**: questions with new numbers.", r"**你来**：换了数的题。")),
                 p(T(r"The last lesson puts every method on one page and gives you a drill to do under time.", r"最后一课把所有方法放在一页上，再给你一组限时练习。")),
                 callout('note', T('The exam is in English', '考试是英文的'),
                         T(r"The Chinese version of this course keeps the English terms beside the Chinese, and every model answer is in English, so you can write in the words the examiner expects.",
                           r"这门课的中文版在专业词旁边保留英文，满分答案也用英文写，方便你直接用阅卷人熟悉的词作答。"))),
        ],
    )


def L_markets():
    M, S = 'e15.market', 'e15.welfare'
    return dict(
        id=f'{CID}-markets', title=T('Markets and who gains: the turbine quota (Q1)', '市场与得失：风机进口配额（第 1 题）'),
        description=T('Demand as values and supply as costs, how a market finds its price, what a quota does to it, and how to count in dollars who gains and who loses.', '把需求读成价值、把供给读成成本，市场怎么定出价格，配额对它做了什么，以及怎么用钱算清谁得谁失。'),
        minutes=50,
        skills=[{'id': M, 'name': T('Supply, demand and equilibrium', '供给、需求与均衡')}, {'id': S, 'name': T('Welfare accounting', '福利核算')}],
        misconceptions=[{'id': 'price-from-supply', 'description': T('With a quota, reading the price off the supply curve instead of the demand curve', '有配额时，用供给曲线而不是需求曲线来定价格')},
                        {'id': 'rent-is-ours', 'description': T("Counting the quota rent as the importing country's gain", '把配额租金算成进口国自己的收益')}],
        steps=[
            read('question', T('Question 1, as printed', '第 1 题原文'),
                 paper(T('Question 1 · 16 marks', '第 1 题 · 16 分'),
                       T(r"Suppose the United States of Freedom (USF) market demand for wind turbines is $Q = 120 - 2p$. However, the USF does not produce wind turbines but imports them from Middle Kingdom (MK). The MK market supply of wind turbines to USF is $Q = 10p$ where $p$ is the price of a wind turbine in the USF.",
                         r"假设自由合众国（USF）的风机市场需求为 $Q = 120 - 2p$。不过 USF 自己不生产风机，而是从中央王国（MK）进口。MK 向 USF 供应风机的市场供给为 $Q = 10p$，其中 $p$ 是风机在 USF 的价格。"),
                       T(r"**a.** Find the (competitive) market equilibrium price and output of USF wind turbines. (4 marks)", r"**a.** 求 USF 风机的（竞争）市场均衡价格和产量。（4 分）"),
                       T(r"**b.** Suppose the USF government sets a quota, a limit on imports of wind turbines, of 60 wind turbines. Find the new market price and output of USF wind turbines. (4 marks)", r"**b.** 假设 USF 政府设定配额（对风机进口数量的限制）为 60 台。求 USF 风机新的市场价格和产量。（4 分）"),
                       T(r"**c.** Suppose due to the cleaner air, each wind turbine in USF benefits USF citizens by \$10. Do welfare analysis to determine how much better or worse off USF is overall (USF Social Benefit) with the quota compared to the competitive solution. Assume no changes to other markets. (8 marks)",
                         r"**c.** 假设由于空气更清洁，USF 的每台风机给 USF 居民带来 10 美元的好处。做福利分析，判断与竞争均衡相比，有配额时 USF 整体（USF 社会收益）好了还是差了、差多少。假设其他市场不受影响。（8 分）")),
                 h(T('Reading it slowly', '慢慢读一遍')),
                 p(T(r"The story: USF wants wind turbines but makes none. Every turbine comes from one other country, MK. Two formulas describe the two sides of the market:",
                     r"故事是这样的：USF 需要风机，但自己一台也不造，所有风机都来自另一个国家 MK。两个式子描述了市场的两边：")),
                 ul(T(r"$Q = 120 - 2p$ is **demand**: how many turbines USF's buyers want when the price is $p$. At $p = 10$ they want $120 - 20 = 100$; at $p = 30$, 60; at $p = 60$, none. The higher the price, the fewer they want.",
                      r"$Q = 120 - 2p$ 是**需求**（demand）：价格为 $p$ 时，USF 的买家想买多少台。$p = 10$ 时想买 $120 - 20 = 100$ 台；$p = 30$ 时 60 台；$p = 60$ 时一台也不要。价格越高，想买的越少。"),
                    T(r"$Q = 10p$ is **supply**: how many turbines MK's sellers are willing to ship to USF when the price is $p$. At $p = 10$, 100; at $p = 30$, 300. The higher the price, the more they offer.",
                      r"$Q = 10p$ 是**供给**（supply）：价格为 $p$ 时，MK 的卖家愿意向 USF 送多少台。$p = 10$ 时 100 台；$p = 30$ 时 300 台。价格越高，愿意卖的越多。"),
                    T(r"$p$ is one price in both formulas: what a buyer in USF pays is what the seller receives. Nothing (no tax, no transport cost) comes between them.",
                      r"两个式子里的 $p$ 是同一个价格：USF 买家付多少，卖家就收多少，中间没有税，也没有运费。"),
                    T(r"$Q$ is a number of turbines (in some period, say a year). The exam gives no units for the price; read it as dollars.", r"$Q$ 是风机的台数（在某段时间里，比如一年）。题目没给价格的单位，按美元理解即可。")),
                 p(T(r"The three parts ask: (a) at what price and quantity does the market settle on its own? (b) The government caps imports at 60: what happens to the price? (c) Measured in dollars, is USF as a whole better or worse off because of the cap? Part (c) adds one new fact: each turbine gives USF's citizens \$10 of cleaner air.",
                     r"三个小问分别在问：(a) 没人干预时，市场停在什么价格和数量？(b) 政府把进口限制在 60 台：价格会怎样？(c) 用钱来算，这个限制让 USF 整体变好还是变差？(c) 还多给了一个事实：每台风机给 USF 居民带来 10 美元的清洁空气。")),
                 p(T(r"To answer them you need four ideas, which this lesson builds one at a time: what demand and supply curves really are, and where they meet (a); how a quota sets the price (b); how to measure gains in money, and whose gains count (c).",
                     r"要答这三问，需要四个想法，这一课一个一个地搭起来：需求曲线和供给曲线到底是什么、它们在哪相交 (a)；配额怎样决定价格 (b)；怎样用钱衡量好处，以及谁的好处算数 (c)。")),
                 chapter=Q_CH()),
            read('demand', T('Demand: what each turbine is worth to buyers', '需求：每台风机对买家值多少'),
                 paper(T('Part (a) · 4 marks', '(a) 小问 · 4 分'), T(r"Find the (competitive) market equilibrium price and output of USF wind turbines.", r"求 USF 风机的（竞争）市场均衡价格和产量。")),
                 p(T(r"Demand $Q = 120 - 2p$ answers the question *at price $p$, how many are bought?* Turn it around and it answers a more useful one: *for the $Q$-th turbine, what is the most some buyer would pay?* Solve for $p$:",
                     r"需求 $Q = 120 - 2p$ 回答的是：*价格为 $p$ 时买多少台？* 把它倒过来，就回答一个更有用的问题：*第 $Q$ 台风机，最多有人愿意出多少钱？* 解出 $p$：")),
                 math_(r'p = 60 - \tfrac{Q}{2}'),
                 p(T(r"This is called **inverse demand**. Picture all of USF's potential buyers lined up from the keenest to the least keen. The first turbine goes to someone who would pay up to about \$60 for it (a farm on a windy hill). The 20th goes to someone who would pay 50, the 60th to someone who would pay 30, the 100th to someone who would pay only 10. Demand slopes down not because anyone becomes stingy, but because each further turbine goes to a buyer who values it less.",
                     r"这叫**反需求**（inverse demand）。想象把 USF 所有潜在买家从最想要的到最不想要的排成一队。第 1 台风机给最想要的人，他最多愿出约 60 美元（比如风大的山坡上的农场）。第 20 台给愿出 50 的人，第 60 台给愿出 30 的人，第 100 台给只愿出 10 的人。需求曲线向下倾斜，不是因为谁变小气了，而是因为每多一台，都落到一个更不看重它的买家手里。")),
                 svg(fig_demand(), T('The demand line p = 60 − Q/2 falls from 60 at Q = 0 to 0 at Q = 120. Marked points: the 20th turbine is worth 50, the 60th 30, the 100th 10.',
                                     '需求线 p = 60 − Q/2 从 Q = 0 处的 60 降到 Q = 120 处的 0。标出的点：第 20 台值 50，第 60 台值 30，第 100 台值 10。'),
                     T(r"Read the demand curve sideways: the height above each $Q$ is what the $Q$-th turbine is worth to the buyer who gets it.", r"把需求曲线横着读：每个 $Q$ 上方的高度，就是第 $Q$ 台风机对得到它的那位买家值多少钱。")),
                 p(T(r"Hold on to this reading, demand as a list of **values**: it is the key to part (c), where we add those values up.", r"记住这种读法，需求是一串**价值**：到 (c) 我们要把这些价值加起来，靠的就是它。")),
                 chapter=PART('a')),
            read('supply', T('Supply: what it costs to send one more', '供给：多送一台要花多少'),
                 p(T(r"Supply $Q = 10p$, turned around, is $p = Q/10$: the price at which the $Q$-th turbine is offered. The 10th turbine is offered once the price reaches 1, the 100th once it reaches 10, the 300th once it reaches 30.",
                     r"供给 $Q = 10p$ 倒过来是 $p = Q/10$：第 $Q$ 台风机在什么价格下会被送来。价格到 1，第 10 台就会被送来；到 10，第 100 台；到 30，第 300 台。")),
                 p(T(r"Why does it take a higher price to get more turbines? Because they are not all equally cheap to make and ship. The cheapest are offered first; more turbines need costlier factories, overtime, longer shipping. A seller ships a turbine when the price at least covers what that turbine costs. So supply, read this way, is a list of **costs**: $p = Q/10$ is the cost of the $Q$-th turbine.",
                     r"为什么要更高的价格才能得到更多风机？因为风机的制造和运输成本并不一样低。最便宜的先送来；再多就要用更贵的工厂、加班、更远的运输。卖家只有在价格至少能覆盖这台风机的成本时才会送。所以这样读，供给就是一串**成本**：$p = Q/10$ 是第 $Q$ 台风机的成本。")),
                 callout('note', T('"Marginal" means "of one more unit"', '“边际”就是“多一个单位的”'),
                         T(r"The cost of one more unit is called **marginal cost** ($MC$). For a seller it is the derivative of total cost: how much total cost rises when output rises by one. A competitive supply curve is a marginal cost curve. You will meet the word *marginal* in every question.",
                           r"多生产一个单位的成本叫**边际成本**（marginal cost, $MC$）。对卖家来说，它是总成本的导数：产量多 1，总成本多多少。竞争市场的供给曲线就是一条边际成本曲线。*边际*这个词，每道题都会遇到。")),
                 svg(fig_market(), T('Demand D falls from 60; supply S rises from the origin as p = Q/10. They cross at E, Q = 100 and p = 10.', '需求 D 从 60 往下走；供给 S 从原点沿 p = Q/10 往上走。两者交于 E：Q = 100，p = 10。'),
                     T(r"Demand (blue) is a list of values, supply (orange) a list of costs. They cross at $E$.", r"需求（蓝）是一串价值，供给（橙）是一串成本。两者交于 $E$。"))),
            read('equilibrium', T('Where the market settles', '市场停在哪'),
                 p(T(r"Put the two sides together. At any price, compare how many buyers want with how many sellers offer:", r"把两边放在一起。在每个价格下，比较买家想买多少、卖家愿卖多少：")),
                 table([T('Price', '价格'), T('Buyers want', '买家想买'), T('Sellers offer', '卖家愿卖'), T('So', '于是')],
                       ['20', '80', '200', T('120 turbines go unsold: sellers cut their prices', '120 台卖不掉：卖家降价')],
                       ['5', '110', '50', T('60 buyers miss out: they offer more, and the price rises', '60 位买家买不到：他们出价更高，价格上涨')],
                       ['10', '100', '100', T('everyone who wants one at 10 gets one, and nothing pushes the price', '在 10 这个价格上想买的都买到了，没有力量再推动价格')]),
                 p(T(r"The price stops moving only where the quantity demanded equals the quantity supplied. That point is the **equilibrium**, and finding it is solving two equations, $Q = 120 - 2p$ and $Q = 10p$, for the two unknowns $p$ and $Q$.",
                     r"只有在需求量等于供给量的地方，价格才不再变动。这一点叫**均衡**（equilibrium）。求它，就是解两个方程 $Q = 120 - 2p$ 和 $Q = 10p$，求两个未知数 $p$ 和 $Q$。")),
                 p(T(r"The same point in the language of values and costs: the 100th turbine is worth 10 to its buyer and costs 10 to ship. Every turbine before it is worth more than it costs, so it is traded; every turbine after it would cost more than it is worth, so it is not. The competitive equilibrium trades exactly the turbines that are worth more than they cost. Remember this in part (c).",
                     r"用价值和成本的语言说同一点：第 100 台风机对买家值 10，送来也要花 10。它之前的每一台，价值都高于成本，于是成交；它之后的每一台，成本都会高于价值，于是不成交。竞争均衡恰好成交了所有“值得”的风机。到 (c) 要记得这一点。")),
                 quiz(T(r"Suppose the price were 15. What would happen next?", r"假如价格是 15。接下来会发生什么？"),
                      [(T(r"Sellers offer 150 but buyers want only 90, so unsold turbines push the price down", r"卖家愿卖 150 台，买家只想买 90 台，卖不掉的风机把价格往下压"), True),
                       (T(r"Buyers want more than sellers offer, so the price rises", r"买家想买的比卖家愿卖的多，价格上涨"), T(r"Check both formulas at 15: buyers want $120 - 30 = 90$, sellers offer $10 \times 15 = 150$. There are more turbines than buyers.", r"在 15 处两个式子都算一下：买家想买 $120 - 30 = 90$，卖家愿卖 $10 \times 15 = 150$。风机比买家多。")),
                       (T(r"Nothing: any price can be an equilibrium", r"什么也不会发生：任何价格都可以是均衡"), T(r"At 15 the two sides disagree by 60 turbines; sellers who cannot sell will cut prices.", r"在 15 处两边差了 60 台；卖不出去的卖家会降价。"))],
                      T(r"Above the equilibrium price there is a **surplus** (more offered than wanted) and the price falls; below it there is a **shortage** and the price rises. Only at $p = 10$ do the two agree.",
                        r"价格高于均衡时出现**过剩**（surplus，供大于求），价格下降；低于均衡时出现**短缺**（shortage），价格上升。只有在 $p = 10$ 处两边一致。"))),
            derive('q1a', T('Part (a), worked', '(a) 小问：完整解法'),
                   [('120 - 2p = 10p', T(r"In equilibrium the number buyers want equals the number sellers offer. Both depend on the same price $p$, so set the two formulas equal:", r"均衡时，买家想买的台数等于卖家愿卖的台数。两边都取决于同一个价格 $p$，所以令两个式子相等：")),
                    ('120 = 12p', T(r"Collect the $p$ terms on one side by adding $2p$ to both sides:", r"两边同加 $2p$，把含 $p$ 的项放到一边：")),
                    ('p = 10', T(r"Divide by 12. This is the equilibrium price: the one price at which nobody is left wanting and nothing is left over.", r"两边除以 12。这就是均衡价格：唯一一个既没有人买不到、也没有货剩下的价格。")),
                    ('Q = 10 \\times 10 = 100', T(r"Put the price into either formula for the quantity. Supply gives $10 \times 10$; demand gives $120 - 2 \times 10$, the same 100 (a quick check worth doing).", r"把价格代进任一个式子求数量。供给给出 $10 \times 10$；需求给出 $120 - 2 \times 10$，同样是 100（顺手验算一下）。"))],
                   outro=T(r"**Answer:** the competitive equilibrium price is \$10, and 100 turbines are bought and sold.", r"**答案：** 竞争均衡价格为 10 美元，成交 100 台。"),
                   skill=M),
            read('quota', T('A quota: a cap on how many may come in', '配额：进口数量的上限'),
                 paper(T('Part (b) · 4 marks', '(b) 小问 · 4 分'), T(r"Suppose the USF government sets a quota, a limit on imports of wind turbines, of 60 wind turbines. Find the new market price and output of USF wind turbines.", r"假设 USF 政府设定配额（对风机进口数量的限制）为 60 台。求 USF 风机新的市场价格和产量。")),
                 p(T(r"A **quota** is a law: no more than 60 turbines may be imported. Governments set quotas to protect their own producers, to save foreign currency, or as a bargaining chip in trade talks. (USF has no turbine makers to protect; remember this in part (c).)",
                     r"**配额**（quota）是一条法律：进口不得超过 60 台。政府设配额，可能是为了保护本国生产者、节省外汇，或者在贸易谈判里当筹码。（USF 没有风机厂商可保护；到 (c) 要记得这一点。）")),
                 p(T(r"**Does the cap bite?** Without it, 100 turbines would be traded (part a). 60 is less than 100, so the quota **binds**: exactly 60 will be traded. (A quota of 150 would change nothing.)",
                     r"**这个上限卡得住吗？** 没有它时会成交 100 台（(a) 小问）。60 小于 100，所以配额是**紧的**（binding）：正好成交 60 台。（如果配额是 150 台，什么都不会变。）")),
                 p(T(r"**What happens to the price?** Walk through it. At the old price of 10, buyers still want 100 turbines, but only 60 can be had. Forty would-be buyers miss out, and some of them offer more. The price climbs. It stops climbing when the number of turbines buyers want has fallen to exactly 60. Which price is that? The one on the **demand** curve at $Q = 60$: $60 = 120 - 2p$, so $p = 30$.",
                     r"**价格会怎样？** 一步步看。在原来的价格 10 下，买家仍然想要 100 台，可只能得到 60 台。40 位想买的人买不到，其中有人愿意多出钱，价格就往上涨。涨到买家想要的台数正好降到 60 时才停。这是哪个价格？是**需求**曲线上 $Q = 60$ 处的价格：$60 = 120 - 2p$，$p = 30$。")),
                 p(T(r"**Why not the supply curve?** MK's sellers would happily ship far more than 60 at any price above 6, but they are not allowed to. Once the quantity is fixed by law, supply no longer decides anything: buyers' willingness to pay sets the price.",
                     r"**为什么不看供给曲线？** 只要价格高于 6，MK 的卖家就乐意送远不止 60 台，可法律不许。数量一旦被法律定死，供给就不再决定任何事：价格由买家愿付多少来定。")),
                 svg(fig_quota_price(), T('Demand and supply with a vertical quota line at Q = 60. On demand at Q = 60 the price is 30; on supply at Q = 60 it is 6. The old equilibrium at Q = 100, p = 10 is shown in grey.',
                                          '需求和供给，以及 Q = 60 处的竖直配额线。需求在 Q = 60 处对应价格 30；供给在 Q = 60 处对应 6。原来的均衡 Q = 100、p = 10 用灰点表示。'),
                     T(r"With the quantity fixed at 60, go **up** from 60 to the demand curve: buyers pay 30. Sellers would have shipped that 60th turbine for 6.", r"数量定在 60 后，从 60 **往上**找到需求曲线：买家付 30。卖家其实 6 块钱就愿意送第 60 台。")),
                 quiz(T('Under the quota of 60, which curve gives the price buyers pay?', '配额 60 台时，买家付的价格从哪条曲线读？'),
                      [(T(r"Demand: $60 = 120 - 2p$, so $p = 30$", r"需求：$60 = 120 - 2p$，$p = 30$"), True),
                       (T(r"Supply: $60 = 10p$, so $p = 6$", r"供给：$60 = 10p$，$p = 6$"), T(r"That is the lowest price at which MK would send 60, not what buyers pay. At 6, buyers would want 108 turbines but only 60 exist, so they bid the price up.", r"这是 MK 愿意送 60 台的最低价，不是买家付的价。价格 6 时买家想要 108 台，可只有 60 台，他们会把价格抬上去。")),
                       (T(r"Neither: the price stays at the free-trade 10", r"都不是：价格还是自由贸易时的 10"), T(r"At 10 buyers want 100 turbines, but only 60 may come in: the shortage pushes the price up.", r"价格 10 时买家想要 100 台，可只许进 60 台：短缺会把价格推高。"))],
                      T(r"With the quantity fixed, buyers compete for the 60 turbines until only 60 are wanted: $p = 30$.", r"数量被卡死后，买家争抢这 60 台，直到只有 60 台被需要：$p = 30$。")),
                 h(T('Who pockets the gap: the quota rent', '中间的差价归谁：配额租金')),
                 p(T(r"Buyers pay 30 for each turbine, yet sellers would have shipped the 60th for 6. The gap, $30 - 6 = 24$ on each of the 60 turbines, $24 \times 60 = 1440$ in all, is called the **quota rent**. It goes to whoever holds the right to bring turbines in. The question does not say USF sells import licences, so the usual reading is that MK's sellers sell at the market price of 30 and keep the rent. That matters in part (c).",
                     r"买家每台付 30，而卖家 6 块钱就愿意送第 60 台。这个差价，60 台每台 $30 - 6 = 24$，合计 $24 \times 60 = 1440$，叫**配额租金**（quota rent）。它归手里有进口权的人。题目没说 USF 出售进口许可证，通常的理解是 MK 的卖家按市场价 30 卖出、自己拿走租金。这在 (c) 里很要紧。")),
                 chapter=PART('b')),
            derive('q1b', T('Part (b), worked', '(b) 小问：完整解法'),
                   [('Q = 60 < 100', T(r"First check that the quota binds: without it 100 turbines would be traded (part a), more than the 60 allowed. So exactly 60 are traded.", r"先检查配额是否紧：没有配额时成交 100 台（(a) 小问），多于允许的 60 台。所以正好成交 60 台。")),
                    ('60 = 120 - 2p', T(r"With the quantity fixed at 60, the price is whatever makes buyers want exactly 60: put $Q = 60$ into **demand**.", r"数量定在 60 后，价格就是让买家恰好只想要 60 台的那个价：把 $Q = 60$ 代进**需求**。")),
                    ('p = 30', T(r"Solve: $2p = 60$.", r"解出来：$2p = 60$。")),
                    ('10 \\times 30 = 300 > 60', T(r"A check worth one line in the exam: at 30, MK would like to ship 300, far more than 60. So it really is the quota, not the sellers, that limits the market.", r"值得在卷面上写一行的检验：价格 30 时 MK 想送 300 台，远多于 60。所以卡住市场的确实是配额，而不是卖家。"))],
                   outro=T(r"**Answer:** with the quota the price rises to \$30 and only 60 turbines are traded.", r"**答案：** 有配额时价格升到 30 美元，只成交 60 台。"),
                   skill=M),
            read('surplus', T('Counting gains in dollars: consumer surplus', '用钱数好处：消费者剩余'),
                 paper(T('Part (c) · 8 marks', '(c) 小问 · 8 分'), T(r"Suppose due to the cleaner air, each wind turbine in USF benefits USF citizens by \$10. Do welfare analysis to determine how much better or worse off USF is overall (USF Social Benefit) with the quota compared to the competitive solution. Assume no changes to other markets.",
                                                                          r"假设由于空气更清洁，USF 的每台风机给 USF 居民带来 10 美元的好处。做福利分析，判断与竞争均衡相比，有配额时 USF 整体（USF 社会收益）好了还是差了、差多少。假设其他市场不受影响。")),
                 p(T(r"Part (c) asks whether USF is better or worse off *overall*, in dollars. **Welfare analysis** means: add up, in dollars, what each group of people gains from the market, before and after the change, and compare. Start with the buyers.",
                     r"(c) 问的是 USF *整体*用钱算是好了还是差了。**福利分析**（welfare analysis）就是：用钱把每一群人从这个市场得到的好处加起来，变化前后各算一遍，再比较。先从买家算起。")),
                 p(T(r"A buyer who would pay up to \$50 for a turbine but pays only \$10 is \$40 better off: what the turbine is worth to them minus what they paid. That gain is called **consumer surplus**.",
                     r"一位最多愿出 50 美元的买家只付了 10 美元，就多得了 40 美元：风机对他的价值减去他实际付的钱。这份好处叫**消费者剩余**（consumer surplus, CS）。")),
                 p(T(r"Now add it up over all buyers at the free-trade price of 10. The first turbine is worth about 60 and costs its buyer 10: a gain of about 50. The 20th is worth 50: gain 40. And so on down to the 100th, worth 10: gain 0. The gains fall evenly from 50 to 0 over 100 turbines, so they average 25, and the total is $25 \times 100 = 2500$.",
                     r"现在把自由贸易价格 10 下所有买家的好处加起来。第 1 台对买家值约 60，他付 10：多得约 50。第 20 台值 50：多得 40。依此类推，直到第 100 台，值 10：多得 0。100 台的好处从 50 均匀降到 0，平均是 25，总共 $25 \times 100 = 2500$。")),
                 p(T(r"On the diagram each turbine's gain is the height between the demand curve (its value) and the price line (what was paid), so adding them up is the **area** between the two: a triangle with base 100 and height $60 - 10 = 50$, and $\tfrac12 \times 100 \times 50 = 2500$. For a straight demand line:",
                     r"在图上，每台风机的好处是需求曲线（它的价值）和价格线（实付的钱）之间的高度，把它们加起来就是两者之间的**面积**：底 100、高 $60 - 10 = 50$ 的三角形，$\tfrac12 \times 100 \times 50 = 2500$。需求是直线时：")),
                 math_(r'CS = \tfrac12 \times Q \times (a - p)'),
                 p(T(r"Here $a$ is the *demand intercept*, 60: the price at which nobody would buy. (In calculus, $CS = \int_0^Q \left(60 - \tfrac{x}{2} - p\right)dx$, which gives the same triangle.) With the quota, the price is 30 and only 60 are bought, so the triangle is smaller: $\tfrac12 \times 60 \times (60 - 30) = 900$.",
                     r"这里 $a$ 是*需求截距* 60，也就是没人愿意买的那个价格。（用微积分写是 $CS = \int_0^Q \left(60 - \tfrac{x}{2} - p\right)dx$，算出来是同一个三角形。）有配额时价格 30、只买 60 台，三角形就小了：$\tfrac12 \times 60 \times (60 - 30) = 900$。")),
                 svg(fig_cs(), T('Demand with two price lines. The large light triangle under demand and above p = 10, out to Q = 100, has area 2500. The small dark triangle above p = 30, out to Q = 60, has area 900.',
                                 '需求曲线和两条价格线。需求之下、p = 10 之上、到 Q = 100 的浅色大三角形面积为 2500。p = 30 之上、到 Q = 60 的深色小三角形面积为 900。'),
                     T(r"Consumer surplus is the area under demand and above the price: 2500 at the free-trade price, only 900 under the quota.", r"消费者剩余是需求之下、价格之上的面积：自由贸易时 2500，有配额时只剩 900。")),
                 p(T(r"Sellers have a surplus too, **producer surplus**: on each unit, the price minus what it cost them; on the diagram, the area above the supply curve and below the price. Whether it counts here is the subject of the next page.",
                     r"卖家也有剩余，叫**生产者剩余**（producer surplus, PS）：每个单位的价格减去它的成本；在图上是供给曲线之上、价格之下的面积。它在这里算不算，是下一页的话题。")),
                 chapter=PART('c')),
            read('whose', T('Whose gains count: USF social benefit', '谁的好处算数：USF 社会收益'),
                 p(T(r"**USF Social Benefit** is the total gain of the people of USF. Go through everyone this market touches:", r"**USF 社会收益**（USF Social Benefit）是 USF 这个国家的人得到的全部好处。把这个市场牵涉到的人逐一过一遍：")),
                 table([T('Who', '谁'), T('Their gain', '他们的好处'), T('In USF social benefit?', '算进 USF 社会收益吗？')],
                       [T('USF buyers', 'USF 买家'), T('consumer surplus', '消费者剩余'), T('**yes**', '**算**')],
                       [T('USF turbine makers', 'USF 风机厂商'), T('producer surplus', '生产者剩余'), T('there are none', '根本没有')],
                       [T('USF government', 'USF 政府'), T('tax or licence revenue', '税收或许可证收入'), T('yes, but the quota as set raises none', '算，但题目里的配额没带来任何收入')],
                       [T("MK's sellers", 'MK 的卖家'), T('producer surplus, quota rent', '生产者剩余、配额租金'), T('**no**: they are foreign', '**不算**：他们是外国人')],
                       [T('USF citizens breathing cleaner air', '呼吸清洁空气的 USF 居民'), T(r"\$10 for each turbine in use", r"每台在用的风机 10 美元"), T('**yes**', '**算**')]),
                 p(T(r"The last row is new in part (c). It is an **externality**: an effect of a deal on people outside it. The farmer who buys a turbine weighs only what it is worth to the farm; the neighbours who breathe cleaner air did not buy it and are not asked. So the market ignores this \$10 per turbine, but USF's welfare must include it: add $10 \times$ (number of turbines).",
                     r"最后一行是 (c) 新加的。它叫**外部性**（externality）：一笔交易对交易之外的人的影响。买风机的农场只考虑风机对自己值多少；呼吸到清洁空气的邻居没买、也没人问他们。所以市场不考虑这每台 10 美元，可 USF 的福利必须把它算进去：加上 $10 \times$（风机台数）。")),
                 p(T(r"Why foreign sellers do not count: the question asks about USF. Whatever MK's sellers gain is MK's gain. Every dollar USF's buyers pay them is a dollar that leaves USF.",
                     r"为什么外国卖家不算：题目问的是 USF。MK 卖家得到的好处是 MK 的。USF 买家付给他们的每一块钱，都是离开 USF 的一块钱。")),
                 quiz(T(r"Under the quota, MK's sellers earn a quota rent of 1440. Is it part of USF social benefit?", r"有配额时，MK 的卖家赚到 1440 的配额租金。它算进 USF 社会收益吗？"),
                      [(T(r"No: it is paid by USF's buyers to MK's sellers, so it is a loss to USF", r"不算：它是 USF 买家付给 MK 卖家的，对 USF 是损失"), True),
                       (T(r"Yes: the turbines are sold in USF", r"算：风机是在 USF 卖的"), T(r"Where the sale happens does not matter; whose pocket the money ends in does. The rent ends in MK.", r"在哪儿卖不重要，钱最后进了谁的口袋才重要。租金进了 MK 的口袋。")),
                       (T(r"Only if USF's government taxes it", r"只有 USF 政府对它征税时才算"), T(r"Taxing it would bring some of it back to USF, but the question has no such tax: as set, none of it stays.", r"征税能拿回一部分，可题目里没有这样的税：按题目设定，一分也留不下。"))],
                      T(r"Social benefit counts only the people of the country asked about. Had USF auctioned the import licences, the 1440 would have stayed home as government revenue (the wider topic below).",
                        r"社会收益只算题目问的那个国家的人。如果 USF 拍卖进口许可证，这 1440 就会作为政府收入留在国内（见后面的“这类题的全貌”）。"))),
            read('see', T('The quota, as areas you can move', '配额：一组可以拖动的面积'),
                 p(T(r"Before the numbers, see what the quota does to USF. Comparing free trade (price 10, 100 turbines) with the quota (price 30, 60 turbines), USF loses three pieces:",
                     r"先别急着算数，看看配额对 USF 做了什么。把自由贸易（价格 10，100 台）和配额（价格 30，60 台）相比，USF 失去了三块：")),
                 ul(T(r"**$A$ (gold rectangle):** on the 60 turbines still bought, buyers now pay 30 instead of 10. That extra \$20 each goes to MK's sellers.", r"**$A$（金色矩形）：** 仍在买的 60 台，买家现在每台付 30 而不是 10。多付的这 20 美元流向 MK 的卖家。"),
                    T(r"**$B$ (purple triangle):** the 40 turbines no longer bought were worth more to buyers than the free-trade price. That value is simply gone.", r"**$B$（紫色三角形）：** 不再买的那 40 台，对买家的价值本来高于自由贸易价格。这份价值就这么没了。"),
                    T(r"**Green:** those 40 turbines also no longer clean the air: \$10 each.", r"**绿色：** 那 40 台也不再清洁空气：每台 10 美元。")),
                 visual('econ_quota', T(r"Drag the quota. Gold $A$: what USF buyers pay above the free-trade price on the turbines they still buy. Purple $B$: the value lost on the turbines no longer bought. Green: their lost cleaner air. Right: USF social benefit against the quota; switch to selling the licences to keep the rent at home.",
                                        r"拖动配额。金色 $A$：USF 买家在仍然买的那些风机上多付的钱（比自由贸易价格高出的部分）。紫色 $B$：不再买的那些风机丢掉的价值。绿色：它们带走的清洁空气。右边：USF 社会收益随配额的变化；切换成“拍卖许可证”，租金就留在国内。")),
                 p(T(r"Things to notice as you drag: the tighter the quota, the larger all three pieces; and on the right, USF social benefit is highest with no binding quota at all.", r"拖的时候留意：配额卡得越紧，三块都越大；右边的 USF 社会收益在配额不起作用时最高。"))),
            derive('q1c', T('Part (c), worked', '(c) 小问：完整解法'),
                   [('CS_0 = \\tfrac12 \\times 100 \\times (60 - 10) = 2500', T(r"Subscript 0 means free trade (part a). Consumer surplus is the triangle under demand ($p = 60 - Q/2$, intercept 60) and above the price 10, out to 100 turbines.", r"下标 0 表示自由贸易（(a) 小问）。消费者剩余是需求线（$p = 60 - Q/2$，截距 60）之下、价格 10 之上、到 100 台为止的三角形。")),
                    ('SB_0 = 2500 + 10 \\times 100 = 3500', T(r"$SB$ is USF social benefit. Add the cleaner air, \$10 for each of the 100 turbines. USF has no producers and the government collects nothing, so this is all of it.", r"$SB$ 是 USF 社会收益。加上清洁空气：100 台每台 10 美元。USF 没有生产者，政府也没有收入，所以这就是全部。")),
                    ('CS_1 = \\tfrac12 \\times 60 \\times (60 - 30) = 900', T(r"Subscript 1 means with the quota (part b). The smaller triangle above the new price 30, out to 60 turbines.", r"下标 1 表示有配额（(b) 小问）。新价格 30 之上、到 60 台为止的小三角形。")),
                    ('SB_1 = 900 + 10 \\times 60 = 1500', T(r"Only 60 turbines clean the air now. The quota rent ($24 \times 60 = 1440$) goes to MK's sellers, so it is **not** added.", r"现在只有 60 台在清洁空气。配额租金（$24 \times 60 = 1440$）归 MK 卖家，所以**不**加。")),
                    ('\\Delta SB = SB_1 - SB_0 = 1500 - 3500 = -2000', T(r"The change in USF social benefit: after minus before.", r"USF 社会收益的变化：之后减之前。"))],
                   outro=T(r"**Answer:** USF is \$2000 worse off with the quota.", r"**答案：** 有配额时 USF 少了 2000 美元。"),
                   blank=(2, '900', T(r"Consumer surplus with the quota: the triangle above $p = 30$, out to $Q = 60$, under demand with intercept 60.", r"有配额时的消费者剩余：截距为 60 的需求线之下、$p = 30$ 之上、到 $Q = 60$ 为止的三角形。")), skill=S),
            read('where', T('Where the 2000 went', '这 2000 去哪了'),
                 p(T(r"Splitting the loss into the pieces you saw in the figure shows *why* USF loses, and it is the best way to set out the answer in the exam:", r"把损失拆成图里那几块，就能看出 USF *为什么*亏，这也是考试里最好的写法：")),
                 table([T('Piece', '部分'), T('Size', '大小'), T('What it is', '是什么')],
                       [T('$A$, rectangle', '$A$，矩形'), '$20 \\times 60 = 1200$', T('USF buyers pay \\$20 more on each of the 60 turbines they still buy; it goes to MK sellers', 'USF 买家仍买的 60 台每台多付 20 美元，流向 MK 卖家')],
                       [T('$B$, triangle', '$B$，三角形'), '$\\tfrac12 \\times 20 \\times 40 = 400$', T('the value of the 40 turbines no longer bought, above their free-trade price', '不再买的那 40 台，高出自由贸易价格的那部分价值')],
                       [T('Cleaner air', '清洁空气'), '$10 \\times 40 = 400$', T('the 40 missing turbines no longer clean the air', '少掉的 40 台不再清洁空气')],
                       [T('Total', '合计'), '$2000$', T('consumer surplus falls by 1600 ($A + B$), the external benefit by 400', '消费者剩余少 1600（$A + B$），外部收益少 400')]),
                 p(T(r"$A + B = 1600$ is exactly $2500 - 900$, the fall in consumer surplus, and $400$ is $1000 - 600$, the fall in the external benefit: the two routes agree. The triangle $B$ is a **deadweight loss**: value that nobody gets, because turbines worth more than they cost are no longer traded.",
                     r"$A + B = 1600$ 正好是 $2500 - 900$，消费者剩余的减少；$400$ 是 $1000 - 600$，外部收益的减少：两种算法对得上。三角形 $B$ 是**无谓损失**（deadweight loss）：谁也得不到的价值，因为一些价值高于成本的风机不再成交了。")),
                 quiz(T('Compared with free trade, who is better off with the quota?', '和自由贸易相比，配额让谁过得更好？'),
                      [(T("Middle Kingdom's sellers", '中央王国（MK）的卖家'), True),
                       (T('USF consumers', 'USF 消费者'), T('They pay 30 instead of 10 and buy 40 fewer turbines: they lose 1600.', '他们付 30 而不是 10，还少买了 40 台：少了 1600。')),
                       (T('The USF government', 'USF 政府'), T('Only if it sold the import licences. As set, the quota raises no revenue.', '只有在出售进口许可证时才会。按题目设定，配额不带来任何收入。')),
                       (T('Nobody: the quota only moves money around', '没人：配额只是把钱挪了个地方'), T('Some of it is moved (to MK), but $B$ and 400 of cleaner air are simply lost.', '有一部分是挪了（挪给 MK），但 $B$ 和 400 的清洁空气是真没了。'))],
                      T(r"MK sellers now get \$30 for turbines they would sell for \$6 or less. Their gain is the whole rent, 1440: the rectangle $A$ plus the strip from 6 to 10 that they used to give away at the free-trade price.",
                        r"MK 卖家对那些 6 美元以下就愿意卖的风机收到 30 美元。他们得到全部租金 1440：矩形 $A$，加上 6 到 10 之间那一条（自由贸易时他们按 10 卖，现在多拿了）。"))),
            read('paper-answer', T('A full-mark answer', '一份满分答案'),
                 p(T(r"Here is how the whole question can be written in the exam. Notice the pattern: say the condition, then put in the numbers, then say what the number means.", r"整道题在考场上可以这样写。注意这个套路：先写条件，再代数，最后说这个数是什么意思。")),
                 paper(T('Question 1 · a full-mark answer', '第 1 题 · 满分答案'),
                       T(r"**a.** In equilibrium quantity demanded equals quantity supplied: $120 - 2p = 10p$, so $p = 10$ and $Q = 10(10) = 100$.", r"**a.** 均衡时需求量等于供给量：$120 - 2p = 10p$，所以 $p = 10$，$Q = 10(10) = 100$。"),
                       T(r"**b.** The quota (60) is below the free-trade quantity (100), so it binds: $Q = 60$. With quantity fixed, the price is set by demand: $60 = 120 - 2p$, so $p = 30$. (At $p = 30$ MK would supply 300 > 60, so the quota is what limits imports.)",
                         r"**b.** 配额（60）小于自由贸易数量（100），所以是紧的：$Q = 60$。数量固定后由需求定价：$60 = 120 - 2p$，所以 $p = 30$。（$p = 30$ 时 MK 愿供给 300 > 60，所以限制进口的是配额。）"),
                       T(r"**c.** USF Social Benefit = consumer surplus + external benefit (USF has no producers; the quota rent goes to MK's sellers). Free trade: $CS = \tfrac12(100)(60 - 10) = 2500$, external benefit $= 10 \times 100 = 1000$, $SB = 3500$. Quota: $CS = \tfrac12(60)(60 - 30) = 900$, external benefit $= 10 \times 60 = 600$, $SB = 1500$. USF is worse off by $3500 - 1500 = 2000$: consumers lose 1600 (area $A = 20 \times 60 = 1200$ paid to MK as quota rent, and deadweight loss $B = \tfrac12 \times 20 \times 40 = 400$), and the external benefit falls by $10 \times 40 = 400$.",
                         r"**c.** USF 社会收益 = 消费者剩余 + 外部收益（USF 没有生产者；配额租金归 MK 卖家）。自由贸易：$CS = \tfrac12(100)(60 - 10) = 2500$，外部收益 $= 10 \times 100 = 1000$，$SB = 3500$。配额：$CS = \tfrac12(60)(60 - 30) = 900$，外部收益 $= 10 \times 60 = 600$，$SB = 1500$。USF 差了 $3500 - 1500 = 2000$：消费者少 1600（面积 $A = 20 \times 60 = 1200$ 作为配额租金付给 MK，无谓损失 $B = \tfrac12 \times 20 \times 40 = 400$），外部收益少 $10 \times 40 = 400$。"),
                       answer=True),
                 p(T(r"Draw the diagram beside it: demand and supply, the vertical quota line at 60, the prices 10 and 30, and the areas $A$ and $B$ labelled. Marks are given for the method, so the conditions written before the numbers earn marks even if a number slips.",
                     r"旁边配一张图：需求和供给，60 处的竖直配额线，价格 10 和 30，标出面积 $A$ 和 $B$。方法本身就有分，所以先写条件再代数，就算某个数算错，也能拿到思路分。")),
                 chapter=PAPER_CH()),
            read('tariff', T('A tariff instead of a quota', '换成关税'),
                 p(T(r"A **tariff** is a tax on imports: the government takes \$$t$ on every turbine that comes in. Now there are two prices: buyers pay $p_b$, sellers receive $p_s$, and the tariff is the gap, $p_b = p_s + t$. Buyers react to what *they* pay, sellers to what *they* receive, so the market settles where demand at $p_b$ equals supply at $p_s$:",
                     r"**关税**（tariff）是对进口征的税：每进来一台风机，政府收 $t$ 美元。于是有了两个价格：买家付 $p_b$，卖家收 $p_s$，关税就是中间的差，$p_b = p_s + t$。买家看*自己*付多少，卖家看*自己*收多少，所以市场停在“按 $p_b$ 的需求 = 按 $p_s$ 的供给”处：")),
                 math_(r'120 - 2(p_s + t) = 10p_s'),
                 p(T(r"Which tariff cuts imports to the same 60 as the quota? Sellers ship 60 when $p_s = 6$; buyers want 60 when $p_b = 30$; so $t = 24$. Prices and quantity are exactly as under the quota. The difference is who keeps the gap: the tariff's $24 \times 60 = 1440$ is revenue for USF's government, which counts in USF social benefit. A quota whose rent goes abroad is like a tariff whose revenue is handed to the foreign sellers.",
                     r"多大的关税能把进口压到和配额一样的 60 台？卖家在 $p_s = 6$ 时送 60 台；买家在 $p_b = 30$ 时要 60 台；所以 $t = 24$。价格和数量和配额完全一样。区别在于差价归谁：关税的 $24 \times 60 = 1440$ 是 USF 政府的收入，要算进 USF 社会收益。租金流到国外的配额，就像把关税收入交给了外国卖家。")),
                 table([T('Policy', '政策'), T('Imports', '进口'), T('Buyers pay', '买方付'), T('MK gets', 'MK 得'), T('USF keeps', 'USF 留下'), T('USF change', 'USF 变化')],
                       [T('Quota 60, rent to MK', '配额 60，租金归 MK'), '60', '30', '30', '0', '$-2000$'],
                       [T('Quota 60, licences auctioned', '配额 60，拍卖许可证'), '60', '30', '6', '$1440$', '$-560$'],
                       [T('Tariff 24 per turbine', '每台 24 的关税'), '60', '30', '6', '$1440$', '$-560$']),
                 p(T(r"If USF **auctions the import licences**, importers bid up to the rent each licence is worth, 24, so the 1440 goes to USF's government: the same as the tariff. Even then USF loses 560. It still loses the deadweight loss $B$ (400) and the cleaner air of the 40 missing turbines (400), but it now gains 240 from MK: MK's sellers receive only 6 instead of 10 on 60 turbines. $-400 - 400 + 240 = -560$.",
                     r"如果 USF **拍卖进口许可证**，进口商会出价到每张许可证值的租金 24，于是 1440 归 USF 政府：和关税一样。即便如此 USF 仍少 560。无谓损失 $B$（400）和少掉的 40 台风机带走的清洁空气（400）照样损失，但它现在从 MK 那里赚回 240：MK 的卖家 60 台每台只拿 6 而不是 10。$-400 - 400 + 240 = -560$。")),
                 chapter=WIDER_CH()),
            read('externality', T('Externalities, and what else the question could change', '外部性，以及题目还可能怎么变'),
                 p(T(r"**Externalities, more generally.** A *positive* externality (cleaner air, vaccination, education) means the market buys too little, because buyers ignore the benefit to others. A *negative* one (pollution, traffic) means it buys too much. The classic fix, named after the economist Pigou, is to make the buyer feel the external effect: a **Pigouvian subsidy** equal to the external benefit per unit, or a **Pigouvian tax** equal to the external harm per unit.",
                     r"**更一般的外部性。** *正*外部性（清洁空气、疫苗、教育）意味着市场买得太少，因为买家不考虑对别人的好处。*负*外部性（污染、拥堵）意味着买得太多。经典的办法以经济学家庇古命名：让买家自己感受到外部影响。每单位补贴等于外部收益，叫**庇古补贴**（Pigouvian subsidy）；每单位征税等于外部损害，叫**庇古税**（Pigouvian tax）。")),
                 p(T(r"Had USF made its own turbines, the best quantity for USF would be where value to USF (demand plus the \$10 of air) meets cost: $70 - Q/2 = Q/10$, about 117 turbines, more than the market's 100, and a subsidy of \$10 per turbine would get it there.",
                     r"如果 USF 自己造风机，对 USF 最好的数量在“对 USF 的价值（需求加 10 美元空气）= 成本”处：$70 - Q/2 = Q/10$，约 117 台，比市场的 100 台多；每台补贴 10 美元就能做到。")),
                 h(T('If the question changes', '如果题目变了')),
                 ul(T(r"**USF also has its own producers.** Their producer surplus now counts. A quota then moves surplus from USF's buyers to USF's producers, and only the deadweight triangles are lost.", r"**USF 也有本国生产者。** 他们的生产者剩余要算。这时配额是把剩余从本国买家转给本国生产者，真正损失的只有无谓损失的三角形。"),
                    T(r"**A harmful externality** (each turbine causes \$10 of noise, say). Subtract it instead of adding it; then fewer turbines can *raise* welfare.", r"**有害的外部性**（比如每台风机造成 10 美元的噪音）。把它减掉而不是加上；这时少一些风机反而可能*提高*福利。"),
                    T(r"**A quota that does not bind** (above 100): nothing changes, and the welfare change is zero. Always check first.", r"**配额不紧**（高于 100）：什么都不变，福利变化为零。一定先检查。")),
                 h(T('Traps', '易错点')),
                 ul(T(r"Reading the quota price off the **supply** curve. Under a quota the buyers set the price: use **demand**.", r"用**供给**曲线读配额价格。配额下由买方定价：用**需求**曲线。"),
                    T(r"Counting the rectangle $A$ as a transfer *inside* USF. Here it goes abroad, so it is a loss for USF.", r"把矩形 $A$ 当成 USF *内部*的转移。这里它流到了国外，所以是 USF 的损失。"),
                    T(r"Forgetting the externality on the turbines that are no longer bought (the second 400).", r"忘了不再买的那些风机也带走了外部收益（第二个 400）。")),
                 details(T('Beyond the exam: here even a tariff cannot help USF', '超出考试：这里连关税也帮不了 USF'),
                         p(T(r"Two forces pull in opposite directions. The cleaner air says *import more*. But USF is the only buyer of MK's turbines, and buying one more raises the price of every unit (supply slopes up), which says *import less*. USF's welfare, counting what it pays MK at the supply price $Q/10$:",
                             r"两股力量方向相反。清洁空气说*多进口*。可 USF 是 MK 风机的唯一买家，多买一台会抬高每一台的价格（供给向上倾斜），这又说*少进口*。把按供给价 $Q/10$ 付给 MK 的钱算进去，USF 的福利是：")),
                         math_(r"W(Q) = \int_0^Q \left(60 - \tfrac{x}{2}\right)dx + 10Q - \frac{Q}{10}\,Q"),
                         math_(r"W'(Q) = 70 - 0.5Q - 0.2Q = 0 \;\Rightarrow\; Q = 100"),
                         p(T(r"It peaks at exactly $Q = 100$, the free-trade quantity: the two forces cancel, so no quota or tariff can help USF (the gold curve in the figure peaks at 100). With no externality the peak would be at $Q \approx 86$, and a small tariff would raise USF's welfare at MK's expense: the *optimal tariff* of a large buyer.",
                             r"它恰好在 $Q = 100$，也就是自由贸易数量处最大：两股力量抵消了，任何配额或关税都帮不了 USF（图里金色曲线的最高点就在 100）。如果没有外部性，最高点在 $Q \approx 86$，一点小关税就能以 MK 为代价提高 USF 的福利：这就是大买家的*最优关税*。")))),
            number('try', T('Your turn: a quota with new numbers', '你来：换个数的配额'), S,
                   T(r"Demand is $Q = 200 - 4p$, imports are supplied by $Q = 6p$, a quota allows 60 units, and each unit gives USF \$5 of external benefit. By how much does USF social benefit change with the quota? (Negative if USF is worse off.)",
                     r"需求 $Q = 200 - 4p$，进口供给 $Q = 6p$，配额 60 台，每台给 USF 带来 5 美元外部收益。配额让 USF 社会收益变化多少？（变差就填负数。）"),
                   -1650,
                   T(r"Free trade: $200 - 4p = 6p$ gives $p = 20$, $Q = 120$; inverse demand $p = 50 - Q/4$; $SB = \tfrac12 \times 120 \times 30 + 5 \times 120 = 2400$. Quota: $p = (200 - 60)/4 = 35$; $SB = \tfrac12 \times 60 \times 15 + 5 \times 60 = 750$. Change $= -1650$: rectangle $15 \times 60 = 900$, triangle $\tfrac12 \times 15 \times 60 = 450$, air $5 \times 60 = 300$.",
                     r"自由贸易：$200 - 4p = 6p$ 得 $p = 20$、$Q = 120$；反需求 $p = 50 - Q/4$；$SB = \tfrac12 \times 120 \times 30 + 5 \times 120 = 2400$。配额：$p = (200 - 60)/4 = 35$；$SB = \tfrac12 \times 60 \times 15 + 5 \times 60 = 750$。变化 $= -1650$：矩形 $15 \times 60 = 900$、三角形 $\tfrac12 \times 15 \times 60 = 450$、空气 $5 \times 60 = 300$。"),
                   tolerance=1,
                   hints=[T(r"Price under the quota: put $Q = 60$ into the demand curve.", r"配额下的价格：把 $Q = 60$ 代进需求曲线。"), T(r"Social benefit = consumer surplus + \$5 per unit. The foreign sellers do not count.", r"社会收益 = 消费者剩余 + 每台 5 美元。外国卖家不算。")],
                   chapter=TRY_CH()),
            number('try-tariff', T('Your turn: a tariff', '你来：关税'), M,
                   T(r"Back to question 1 (demand $Q = 120 - 2p$, supply $Q = 10p$). USF puts a tariff of \$6 on each imported turbine. How many turbines are imported?",
                     r"回到第 1 题（需求 $Q = 120 - 2p$，供给 $Q = 10p$）。USF 对每台进口风机征 6 美元关税。进口多少台？"),
                   90, T(r"Buyers pay $p_s + 6$: $120 - 2(p_s + 6) = 10p_s$, so $108 = 12p_s$, $p_s = 9$ and $Q = 90$. Buyers pay 15.", r"买方付 $p_s + 6$：$120 - 2(p_s + 6) = 10p_s$，$108 = 12p_s$，$p_s = 9$，$Q = 90$。买方付 15。"),
                   tolerance=0.5, hints=[T(r"The sellers get $p_s$, the buyers pay $p_s + 6$: put each price in its own curve.", r"卖方得 $p_s$，买方付 $p_s + 6$：每个价格代进各自的曲线。")]),
            number('try-tariff-sb', T('Your turn: USF with the tariff', '你来：关税下的 USF'), S,
                   T(r"With that \$6 tariff (90 imported, buyers pay 15), what is USF social benefit? Count consumer surplus, the cleaner air (\$10 per turbine) and the tariff revenue.",
                     r"征 6 美元关税（进口 90 台，买方付 15）时，USF 社会收益是多少？算上消费者剩余、清洁空气（每台 10 美元）和关税收入。"),
                   3465, T(r"$CS = \tfrac12 \times 90 \times (60 - 15) = 2025$, air $= 900$, revenue $= 6 \times 90 = 540$; total 3465, only 35 below free trade. Most of what buyers pay extra comes back as revenue.",
                            r"$CS = \tfrac12 \times 90 \times (60 - 15) = 2025$，空气 $= 900$，税收 $= 6 \times 90 = 540$；合计 3465，只比自由贸易少 35。买家多付的大部分又作为税收回来了。"),
                   tolerance=1),
        ],
    )


def L_longrun():
    S, E = 'e15.longrun', 'e15.elasticity'
    pb = entry_sr_price(76, 2800)
    qb = entry_q(pb)
    return dict(
        id=f'{CID}-longrun', title=T('Many small firms in the long run (Q5)', '长期里的完全竞争（第 5 题）'),
        description=T("A firm's costs (total, average, marginal), how a firm that cannot move the price decides how much to make, why entry and exit pin the long-run price at the bottom of average cost, and what an elasticity measures.", '厂商的成本（总成本、平均成本、边际成本），影响不了价格的厂商怎么决定产量，进入和退出为什么把长期价格钉在平均成本最低点，以及弹性衡量的是什么。'),
        minutes=40,
        skills=[{'id': S, 'name': T('Long-run competitive supply', '长期竞争供给')}, {'id': E, 'name': T('Price elasticity of demand', '需求价格弹性')}],
        misconceptions=[{'id': 'supply-is-mc', 'description': T("Taking the firm's LMC curve as the long-run industry supply", '把单个厂商的 LMC 曲线当成长期行业供给')}],
        steps=[
            read('question', T('Question 5, as printed', '第 5 题原文'),
                 paper(T('Question 5 · 8 marks', '第 5 题 · 8 分'),
                       T(r"In a perfectly competitive industry, each firm has the following long run (Total) Cost function, $C$, and Marginal Cost function, $LMC$: $C = q^3 - 50q^2 + 750q$ and $LMC = 3q^2 - 100q + 750$, where $q$ is the firm's output.",
                         r"在一个完全竞争行业里，每家厂商的长期（总）成本函数 $C$ 和边际成本函数 $LMC$ 为：$C = q^3 - 50q^2 + 750q$，$LMC = 3q^2 - 100q + 750$，其中 $q$ 是厂商的产量。"),
                       T(r"**a.** Find the long-run market supply curve for this industry. Hint: What do you know about LMC and LRAC in a perfectly competitive market in the long run? (6 marks)", r"**a.** 求这个行业的长期市场供给曲线。提示：在完全竞争市场的长期里，关于 LMC 和 LRAC 你知道什么？（6 分）"),
                       T(r"**b.** The market demand function is $Q = 2400 - 4p$ where $Q$ is the market output and $p$ is the market price. What is the (point) elasticity of market demand at the long-run competitive market equilibrium? (2 marks)", r"**b.** 市场需求函数为 $Q = 2400 - 4p$，其中 $Q$ 是市场产量，$p$ 是市场价格。长期竞争市场均衡处的（点）需求弹性是多少？（2 分）")),
                 h(T('Reading it slowly', '慢慢读一遍')),
                 ul(T(r"**A perfectly competitive industry**: many small firms making the same product. No single firm is big enough to move the market price, and any firm can enter the industry or leave it. Each of these words matters below.", r"**完全竞争行业**（perfectly competitive industry）：很多小厂商生产同样的产品。没有哪一家大到能影响市场价格，而且任何厂商都可以进入或离开这个行业。下面每个词都会用到。"),
                    T(r"**$C = q^3 - 50q^2 + 750q$** is a firm's total cost of making $q$ units. **Long run** means every input can be adjusted (the firm can build a bigger factory or none at all), so there is no fixed part: making nothing costs nothing, $C(0) = 0$.", r"**$C = q^3 - 50q^2 + 750q$** 是一家厂商生产 $q$ 个单位的总成本。**长期**（long run）意味着所有投入都能调整（可以盖更大的厂，也可以一个都不要），所以没有固定的部分：不生产就不花钱，$C(0) = 0$。"),
                    T(r"**$LMC$** is long-run marginal cost: the cost of one more unit, the derivative of $C$. (Check: differentiating $C$ gives $3q^2 - 100q + 750$.) The hint also names **$LRAC$**, long-run average cost: cost per unit, $C/q$.", r"**$LMC$** 是长期边际成本：多生产一个单位的成本，即 $C$ 的导数。（验证：对 $C$ 求导得 $3q^2 - 100q + 750$。）提示里还提到 **$LRAC$**，长期平均成本：每单位的成本，$C/q$。"),
                    T(r"Lower-case $q$ is **one firm's** output; capital $Q$ is the **whole market's**. Keeping them apart is half the question.", r"小写 $q$ 是**一家厂商**的产量；大写 $Q$ 是**整个市场**的产量。分清这两个，这道题就做了一半。")),
                 p(T(r"Part (a) asks for the **long-run market supply curve**: for each price, how much the whole industry would supply once firms have had time to enter or leave. Part (b) asks how sensitive buyers are to the price at the point where the market ends up.",
                     r"(a) 问的是**长期市场供给曲线**：在每个价格下，等厂商有足够时间进入或离开之后，整个行业会供给多少。(b) 问的是市场最终停下的那一点上，买家对价格有多敏感。")),
                 p(T(r"The ideas you need, in order: three ways of looking at cost; how one firm in a competitive market decides; what entry and exit do to the price; and, for (b), elasticity.", r"需要的想法，依次是：看成本的三个角度；竞争市场里的一家厂商怎么做决定；进入和退出对价格做了什么；以及 (b) 要用的弹性。")),
                 chapter=Q_CH()),
            read('costs', T("A firm's costs: total, average, marginal", '厂商的成本：总成本、平均成本、边际成本'),
                 paper(T('Part (a) · 6 marks', '(a) 小问 · 6 分'), T(r"Find the long-run market supply curve for this industry. Hint: What do you know about LMC and LRAC in a perfectly competitive market in the long run?", r"求这个行业的长期市场供给曲线。提示：在完全竞争市场的长期里，关于 LMC 和 LRAC 你知道什么？")),
                 p(T(r"There are three ways to look at the same cost, and the question uses all three:", r"同一份成本有三个看法，这道题三个都要用：")),
                 ul(T(r"**Total cost** $C(q)$: everything it costs to make $q$ units.", r"**总成本** $C(q)$：生产 $q$ 个单位总共要花的钱。"),
                    T(r"**Average cost** $AC = C(q)/q$: the cost per unit. (The question calls it $LRAC$.)", r"**平均成本** $AC = C(q)/q$：每个单位摊到的成本。（题目里叫 $LRAC$。）"),
                    T(r"**Marginal cost** $MC = C'(q)$: the extra cost of one more unit. (The question calls it $LMC$.)", r"**边际成本** $MC = C'(q)$：多生产一个单位要多花的钱。（题目里叫 $LMC$。）")),
                 p(T(r"With the question's own cost function, near the outputs that matter:", r"用题目自己的成本函数，在要紧的那段产量附近算一算：")),
                 table([T('Output $q$', '产量 $q$'), T('Average cost $C/q$', '平均成本 $C/q$'), T('Marginal cost $C\'(q)$', '边际成本 $C\'(q)$'), T('So the average…', '所以平均成本……')],
                       ['23', '129', '37', T('falls (the next unit costs less than the average)', '在下降（下一个单位比平均便宜）')],
                       ['25', '125', '125', T('is at its lowest', '处在最低点')],
                       ['27', '129', '237', T('rises (the next unit costs more than the average)', '在上升（下一个单位比平均贵）')],
                       ['30', '150', '450', T('rises', '在上升')]),
                 p(T(r"Look at the last column. When the next unit costs less than the current average, it pulls the average down; when it costs more, it pushes the average up. (It is like your average mark: a test below your average lowers it.) So the marginal cost curve crosses the average cost curve exactly at the bottom of average cost, here at $q = 25$, where both are 125.",
                     r"看最后一列。下一个单位比当前平均便宜，就把平均拉低；比平均贵，就把平均推高。（就像你的平均分：一次低于平均分的考试会把它拉低。）所以边际成本曲线恰好在平均成本的最低点穿过平均成本曲线，这里就是 $q = 25$，两者都是 125。")),
                 p(T(r"The same fact in calculus: differentiate the average with the quotient rule,", r"用微积分说同一件事：用商的求导法则对平均成本求导，")),
                 math_(r"\frac{d}{dq}\left(\frac{C}{q}\right) = \frac{C'(q)\,q - C}{q^2} = \frac{MC - AC}{q}"),
                 p(T(r"Read it term by term: the slope of $AC$ has the sign of $MC - AC$. Negative (falling) while $MC < AC$, positive (rising) once $MC > AC$, and zero, the bottom, exactly where $MC = AC$. That is what the hint is pointing at.",
                     r"逐项读：$AC$ 的斜率和 $MC - AC$ 同号。$MC < AC$ 时为负（在降），$MC > AC$ 时为正（在升），恰好在 $MC = AC$ 处为零，也就是最低点。题目的提示指的就是这个。")),
                 svg(fig_cost(), T('The U-shaped long-run average cost LRAC = q² − 50q + 750 reaches its minimum of 125 at q = 25, where the rising long-run marginal cost LMC crosses it.',
                                   'U 形的长期平均成本 LRAC = q² − 50q + 750 在 q = 25 处达到最低 125，上升的长期边际成本 LMC 正好在这里穿过它。'),
                     T(r"Blue: average cost, U-shaped. Orange: marginal cost, crossing it at its lowest point.", r"蓝色：平均成本，U 形。橙色：边际成本，在最低点穿过它。")),
                 callout('note', T('A classroom cost function', '一个课堂用的成本函数'),
                         T(r"This cubic only behaves like a real cost near its lowest average cost (for small $q$ its marginal cost even turns negative, which no real factory has). That is all the question needs, so do not worry about the rest of the curve.",
                           r"这个三次函数只在平均成本最低点附近才像真实的成本（$q$ 很小时它的边际成本甚至是负的，真实的工厂不会这样）。题目只需要这一段，其余部分不必在意。")),
                 chapter=PART('a')),
            read('firm', T('One small firm: it takes the price, and produces where p = MC', '一家小厂商：接受价格，在 p = MC 处生产'),
                 p(T(r"In a perfectly competitive industry each firm is tiny. Whatever it does, the market price $p$ stays where it is. It can sell as much as it likes at $p$, and nothing at all above $p$ (buyers would go to the identical product next door). So it does not choose a price; it **takes** the price and chooses how much to make. It is a **price taker**.",
                     r"在完全竞争行业里，每家厂商都很小。不管它怎么做，市场价格 $p$ 都不动。它按 $p$ 想卖多少就卖多少，价格只要高于 $p$，一个也卖不掉（买家会去隔壁买一模一样的东西）。所以它不选价格，而是**接受**价格，只选产量。它是**价格接受者**（price taker）。")),
                 p(T(r"How much does it make? Decide at the margin. One more unit brings in $p$ and costs $MC$. If $p > MC$, making it adds to profit; if $p < MC$, it subtracts. So the firm keeps adding units until $p = MC$. In calculus: profit $\pi = pq - C(q)$, and $\frac{d\pi}{dq} = p - C'(q) = 0$ gives $p = MC$.",
                     r"它生产多少？在边际上做决定。多一个单位带来 $p$，花掉 $MC$。$p > MC$ 时多做这一个能增加利润；$p < MC$ 时会减少利润。所以厂商一直加产量，直到 $p = MC$。用微积分说：利润 $\pi = pq - C(q)$，令 $\frac{d\pi}{dq} = p - C'(q) = 0$，得 $p = MC$。")),
                 p(T(r"Its profit is the margin per unit times the number of units: $\pi = (p - AC) \times q$. With this question's costs: if the price were 237, the firm would produce where $MC = 237$, at $q = 27$, where $AC = 129$; profit $(237 - 129) \times 27 = 2916$. If the price were 125, it would produce 25, where $AC = 125$: profit zero.",
                     r"它的利润 = 每单位赚的 × 单位数：$\pi = (p - AC) \times q$。用这道题的成本：如果价格是 237，厂商在 $MC = 237$ 处生产，即 $q = 27$，此时 $AC = 129$；利润 $(237 - 129) \times 27 = 2916$。如果价格是 125，它生产 25，此时 $AC = 125$：利润为零。"))),
            read('entry', T('Entry and exit: why the long-run price is the bottom of average cost', '进入与退出：为什么长期价格是平均成本的最低点'),
                 p(T(r"Suppose the price is 237 and every firm earns 2916. Others notice. In the long run anyone can set up a factory with the same costs, so new firms **enter**. More firms supply more, and the price falls. As long as the price is above the lowest average cost, firms still make a profit and entry continues. If the price fell below it, firms would make losses and some would **exit**, and the price would rise again.",
                     r"假设价格是 237，每家厂商都赚 2916。别人看到了。长期里谁都可以用同样的成本开一家厂，于是新厂商**进入**（entry）。厂商多了，供给多了，价格就下降。只要价格还高于最低平均成本，厂商就还有利润，进入就会继续。如果价格跌到它下面，厂商就会亏损，一部分会**退出**（exit），价格又会回升。")),
                 p(T(r"The only price where nobody wants to come or go is the one where profit is exactly zero: $p = AC$. At the same time each firm produces where $p = MC$. Both at once means $MC = AC$, and that happens only at the bottom of average cost. Here: $q = 25$ and $p = 125$. This is the hint's answer: in the long run, $LMC = LRAC$.",
                     r"唯一一个谁都不想进、也不想走的价格，是利润恰好为零的价格：$p = AC$。同时，每家厂商都在 $p = MC$ 处生产。两者同时成立，就是 $MC = AC$，而这只发生在平均成本的最低点。这里就是 $q = 25$、$p = 125$。这就是提示的答案：长期里 $LMC = LRAC$。")),
                 p(T(r"Now the **long-run market supply curve**: at what price will the industry supply any given quantity in the long run? Always at 125. If buyers want more, more identical firms enter, each making 25 at a cost of 125 per unit; if they want less, firms leave. The quantity changes, the price does not: the long-run supply curve is a **horizontal line at $p = 125$**. (An industry like this is called a *constant-cost industry*.)",
                     r"再看**长期市场供给曲线**：长期里，行业在什么价格下供给某个数量？永远是 125。买家想要更多，就有更多一模一样的厂商进来，每家做 25，每单位成本 125；想要更少，就有厂商离开。数量在变，价格不变：长期供给曲线是 **$p = 125$ 处的一条水平线**。（这样的行业叫*成本不变行业*，constant-cost industry。）")),
                 svg(fig_entry(), T(f'Market diagram. Demand D0 meets the flat long-run supply at A (Q = 1900, p = 125, 76 firms). Demand rises to D1: with 76 firms the short-run supply is steep, so the price jumps to about {pb:.0f} at B. Profit attracts entry until 92 firms supply 2300 at p = 125 again, at C.',
                                    f'市场图。需求 D0 与水平的长期供给交于 A（Q = 1900，p = 125，76 家厂商）。需求增加到 D1：76 家厂商的短期供给很陡，价格跳到约 {pb:.0f}（B 点）。利润吸引新厂商进入，直到 92 家厂商在 p = 125 供给 2300（C 点）。'),
                     T(f'The whole story on one diagram. Demand rises from $D_0$ to $D_1$. **Short run**: the 76 firms can only move up their $MC$ curves, so the price jumps to about {pb:.0f} ($B$) and each earns about {round((pb - (qb * qb - 50 * qb + 750)) * qb, -2):,.0f}. **Long run**: the profit attracts entry until the price is back at 125 ($C$, 92 firms). The flat line through $A$ and $C$ is the long-run supply.',
                       f'整个故事画在一张图上。需求从 $D_0$ 增加到 $D_1$。**短期**：76 家厂商只能沿各自的 $MC$ 往上走，价格跳到约 {pb:.0f}（$B$），每家赚约 {round((pb - (qb * qb - 50 * qb + 750)) * qb, -2):,.0f}。**长期**：利润吸引新厂商进入，直到价格回到 125（$C$，92 家）。过 $A$ 和 $C$ 的那条水平线就是长期供给。')),
                 callout('note', T('Zero profit is not "no money"', '利润为零不等于“没赚钱”'),
                         T(r"Economists count as a cost the normal return the owners could earn elsewhere. Zero *economic* profit means the firm earns exactly that return: no more, no less, so no reason to come or go.",
                           r"经济学把业主在别处能挣到的正常回报也算作成本。*经济*利润为零，意味着厂商正好挣到这份回报：不多不少，所以没有理由进来或离开。")),
                 quiz(T(r"Demand for this industry's product doubles and stays doubled. In the long run, the price is…", r"这个行业产品的需求翻了一倍，并且一直保持。长期里价格会……"),
                      [(T(r"125 again: twice as many firms, each still making 25", r"回到 125：厂商数翻倍，每家仍做 25"), True),
                       (T(r"higher, because buyers want more", r"更高，因为买家想要更多"), T(r"Only in the short run. The profit at a higher price draws in new firms until the price is back at the bottom of average cost.", r"只在短期里。更高价格下的利润会吸引新厂商进来，直到价格回到平均成本最低点。")),
                       (T(r"lower, because more firms compete", r"更低，因为竞争的厂商更多了"), T(r"Below 125 every firm would make a loss and some would leave. Entry stops at 125, not below.", r"低于 125 每家都会亏，一部分会离开。进入停在 125，不会更低。"))],
                      T(r"With identical firms and free entry, demand decides how many firms there are, not the long-run price.", r"厂商都一样、进入自由时，需求决定的是厂商数量，而不是长期价格。"))),
            derive('q5a', T('Part (a), worked', '(a) 小问：完整解法'),
                   [('LRAC = \\frac{C}{q} = q^2 - 50q + 750', T(r"Average cost is total cost divided by output: divide each term of $C = q^3 - 50q^2 + 750q$ by $q$.", r"平均成本 = 总成本 ÷ 产量：把 $C = q^3 - 50q^2 + 750q$ 的每一项都除以 $q$。")),
                    ('3q^2 - 100q + 750 = q^2 - 50q + 750', T(r"In the long run each firm produces where $p = LMC$ and entry makes $p = LRAC$, so $LMC = LRAC$:", r"长期里每家厂商在 $p = LMC$ 处生产，进入又使 $p = LRAC$，所以 $LMC = LRAC$：")),
                    ('2q^2 = 50q \\;\\Rightarrow\\; q = 25', T(r"The 750s cancel; subtract to get $2q^2 - 50q = 0$, that is $2q(q - 25) = 0$. The firm produces something, so $q = 25$. (The same point as setting the slope of $LRAC$ to zero: $2q - 50 = 0$.)", r"750 消掉了；移项得 $2q^2 - 50q = 0$，即 $2q(q - 25) = 0$。厂商要生产，所以 $q = 25$。（和令 $LRAC$ 的斜率为零 $2q - 50 = 0$ 得到的是同一点。）")),
                    ('LRAC(25) = 625 - 1250 + 750 = 125', T(r"The lowest average cost: put $q = 25$ into $LRAC$. This is the long-run price, where profit is zero.", r"最低平均成本：把 $q = 25$ 代进 $LRAC$。这就是长期价格，此时利润为零。")),
                    ('p = 125', T(r"Whatever quantity the market wants, enough firms each make 25 at 125 per unit: the long-run market supply curve is horizontal at 125.", r"不管市场要多少，都由足够多的厂商各做 25、每单位 125 来供给：长期市场供给曲线是 125 处的水平线。"))],
                   outro=T(r"**Answer:** the long-run market supply curve is horizontal (perfectly elastic) at $p = 125$; each firm produces 25 units.", r"**答案：** 长期市场供给曲线是 $p = 125$ 处的水平线（完全弹性）；每家厂商生产 25 个单位。"),
                   blank=(0, 'q^2 - 50*q + 750', T(r"Average cost: divide $C = q^3 - 50q^2 + 750q$ by $q$.", r"平均成本：用 $q$ 去除 $C = q^3 - 50q^2 + 750q$。")), skill=S),
            read('elasticity', T('Elasticity: how strongly buyers react to the price', '弹性：买家对价格的反应有多强'),
                 paper(T('Part (b) · 2 marks', '(b) 小问 · 2 分'), T(r"The market demand function is $Q = 2400 - 4p$ where $Q$ is the market output and $p$ is the market price. What is the (point) elasticity of market demand at the long-run competitive market equilibrium?", r"市场需求函数为 $Q = 2400 - 4p$，其中 $Q$ 是市场产量，$p$ 是市场价格。长期竞争市场均衡处的（点）需求弹性是多少？")),
                 p(T(r"How sensitive are buyers to the price? The slope of demand says: each \$1 on the price, 4 fewer units. But is 4 units a lot? It is if they buy 10, hardly anything if they buy 1900. And “\$1” depends on the currency. **Elasticity** fixes both by using percentages: by what percentage does the quantity change when the price rises by 1%?",
                     r"买家对价格有多敏感？需求的斜率说：价格每涨 1 美元，少买 4 个单位。可 4 个单位算多吗？如果只买 10 个，那很多；如果买 1900 个，几乎不算什么。而且“1 美元”还取决于用什么货币。**弹性**（elasticity）用百分比把这两个问题都解决了：价格涨 1% 时，数量变百分之几？")),
                 math_(r"\varepsilon = \frac{\%\Delta Q}{\%\Delta p} = \frac{dQ/Q}{dp/p} = \frac{dQ}{dp}\cdot\frac{p}{Q}"),
                 p(T(r"Read the last form as two pieces: $\frac{dQ}{dp}$ is the slope of demand (here $-4$, the same everywhere on a straight line); $\frac{p}{Q}$ says *where* on the curve you are. So the elasticity is different at every point of a straight demand line, and you must always say at which point you evaluate it. That is why the question says *point* elasticity, *at the long-run equilibrium*.",
                     r"最后一种写法分两块读：$\frac{dQ}{dp}$ 是需求的斜率（这里是 $-4$，直线上处处相同）；$\frac{p}{Q}$ 说明你在曲线上的*哪一点*。所以同一条直线需求上，每一点的弹性都不一样，必须说清在哪一点算。这就是题目说*点*弹性、*在长期均衡处*的原因。")),
                 p(T(r"Two points on this question's demand: at $p = 500$, $Q = 400$ and $\varepsilon = -4 \times \frac{500}{400} = -5$: a 1% higher price loses 5% of the buyers. At $p = 125$, $Q = 1900$ and $\varepsilon \approx -0.26$: a 1% higher price loses only about a quarter of 1%.",
                     r"这道题的需求上取两点：$p = 500$ 时 $Q = 400$，$\varepsilon = -4 \times \frac{500}{400} = -5$：价格高 1%，买家少 5%。$p = 125$ 时 $Q = 1900$，$\varepsilon \approx -0.26$：价格高 1%，买家只少约 0.26%。")),
                 ul(T(r"$|\varepsilon| > 1$: demand is **elastic** (quantity reacts more than the price). $|\varepsilon| < 1$: **inelastic**. $|\varepsilon| = 1$: unit elastic.", r"$|\varepsilon| > 1$：需求**富有弹性**（数量的反应比价格大）。$|\varepsilon| < 1$：**缺乏弹性**。$|\varepsilon| = 1$：单位弹性。"),
                    T(r"Demand elasticity is negative (higher price, fewer bought). Some textbooks quote its absolute value; write the sign and say which you mean.", r"需求弹性是负数（价格高，买得少）。有的课本报绝对值；写上符号，并说清楚用的是哪种。"),
                    T(r"**Spending** $pQ$: when the price rises 1%, spending changes by about $(1 + \varepsilon)\%$, because $\frac{d(pQ)}{dp} = Q + p\frac{dQ}{dp} = Q(1 + \varepsilon)$. With inelastic demand a higher price raises spending; with elastic demand it lowers it. You will use this in question 2.", r"**总支出** $pQ$：价格涨 1% 时，总支出约变 $(1 + \varepsilon)\%$，因为 $\frac{d(pQ)}{dp} = Q + p\frac{dQ}{dp} = Q(1 + \varepsilon)$。缺乏弹性时涨价让总支出增加；富有弹性时让它减少。第 2 题会用到。"),
                    T(r"Demand is more elastic when there are close substitutes, when the good takes a big share of the budget, and over a longer time.", r"有相近替代品、占预算比重大、时间更长时，需求更有弹性。")),
                 quiz(T(r"At $p = 125$ demand is inelastic ($\varepsilon \approx -0.26$). If the price rose by 1%, total spending on the good would…", r"$p = 125$ 处需求缺乏弹性（$\varepsilon \approx -0.26$）。价格涨 1%，花在这种商品上的总支出会……"),
                      [(T('rise, by about 0.74%', '上升，约 0.74%'), True),
                       (T('fall, because people buy less', '下降，因为人们买少了'), T(r"They buy only about 0.26% less while paying 1% more per unit, so they spend more in total.", r"他们只少买约 0.26%，每单位却多付 1%，所以总共花得更多。")),
                       (T('stay the same', '不变'), T(r"That is the unit-elastic case, $\varepsilon = -1$.", r"那是单位弹性的情形，$\varepsilon = -1$。"))],
                      T(r"Spending changes by about $1\% + \varepsilon \times 1\% = 1 - 0.26 = 0.74\%$. Inelastic demand: a higher price raises spending.", r"总支出约变 $1\% + \varepsilon \times 1\% = 1 - 0.26 = 0.74\%$。缺乏弹性：涨价让总支出增加。")),
                 chapter=PART('b')),
            derive('q5b', T('Part (b), worked', '(b) 小问：完整解法'),
                   [('Q = 2400 - 4 \\times 125 = 1900', T(r"The long-run equilibrium is where demand meets the flat long-run supply, at $p = 125$. Put that price into demand for the quantity the market buys:", r"长期均衡在需求与水平的长期供给相交处，即 $p = 125$。把这个价格代进需求，得市场买的数量：")),
                    ('\\frac{dQ}{dp} = -4', T(r"The slope of demand: each \$1 on the price, 4 fewer units bought.", r"需求的斜率：价格每涨 1 美元，少买 4 个单位。")),
                    ('\\varepsilon = \\frac{dQ}{dp}\\cdot\\frac{p}{Q} = -4 \\times \\frac{125}{1900} \\approx -0.26', T(r"The point elasticity: the slope times price over quantity, at this point.", r"点弹性：斜率乘以这一点的价格与数量之比。")),
                    ('n = \\frac{1900}{25} = 76', T(r"Not asked, but often the next question: the number of firms is market output over each firm's output.", r"没问，但常是下一问：厂商数 = 市场产量 ÷ 每家产量。"))],
                   outro=T(r"**Answer:** $\varepsilon \approx -0.26$. Demand is inelastic at the long-run equilibrium: a 1% rise in the price would cut the quantity bought by only about 0.26%.", r"**答案：** $\varepsilon \approx -0.26$。长期均衡处需求缺乏弹性：价格涨 1%，购买量只减少约 0.26%。"),
                   blank=(0, '1900', T(r"How much does the market buy at the long-run price of 125?", r"长期价格 125 下市场买多少？")), skill=E),
            read('paper-answer', T('A full-mark answer', '一份满分答案'),
                 paper(T('Question 5 · a full-mark answer', '第 5 题 · 满分答案'),
                       T(r"**a.** In the long run, free entry and exit drive economic profit to zero, so $p = LRAC$; each firm also maximises profit where $p = LMC$. Hence $LMC = LRAC$, which holds at the minimum of $LRAC$. $LRAC = C/q = q^2 - 50q + 750$. Setting $3q^2 - 100q + 750 = q^2 - 50q + 750$ gives $2q^2 = 50q$, so $q = 25$, and $LRAC(25) = 125$. The long-run market supply curve is horizontal (perfectly elastic) at $p = 125$: any quantity is supplied at 125 by firms each producing 25.",
                         r"**a.** 长期里自由进入和退出使经济利润为零，所以 $p = LRAC$；每家厂商又在 $p = LMC$ 处最大化利润。因此 $LMC = LRAC$，这在 $LRAC$ 的最低点成立。$LRAC = C/q = q^2 - 50q + 750$。令 $3q^2 - 100q + 750 = q^2 - 50q + 750$ 得 $2q^2 = 50q$，所以 $q = 25$，$LRAC(25) = 125$。长期市场供给曲线是 $p = 125$ 处的水平线（完全弹性）：任何数量都由每家生产 25 的厂商以 125 的价格供给。"),
                       T(r"**b.** At the long-run equilibrium $p = 125$, so $Q = 2400 - 4(125) = 1900$. $\varepsilon = \frac{dQ}{dp}\cdot\frac{p}{Q} = -4 \times \frac{125}{1900} \approx -0.26$: demand is inelastic at this point.",
                         r"**b.** 长期均衡处 $p = 125$，所以 $Q = 2400 - 4(125) = 1900$。$\varepsilon = \frac{dQ}{dp}\cdot\frac{p}{Q} = -4 \times \frac{125}{1900} \approx -0.26$：该点需求缺乏弹性。"),
                       answer=True),
                 p(T(r"Six marks for (a) are mostly for the reasoning: say *why* $p = LRAC$ (entry and exit) and *why* $p = LMC$ (price taking), not just the number.", r"(a) 的 6 分大多给推理：要说清*为什么* $p = LRAC$（进入与退出）和*为什么* $p = LMC$（价格接受者），而不只是给出数字。")),
                 chapter=PAPER_CH()),
            read('wider', T('The short run, and other twists', '短期，以及其他变化'),
                 h(T('The short run: when to shut down', '短期：什么时候停产')),
                 p(T(r"In the **short run** some inputs cannot be changed: the factory is already built, and its cost $F$ must be paid whether the firm produces or not. Cost splits into this **fixed cost** and a **variable cost** $VC(q)$, with average variable cost $AVC = VC/q$.",
                     r"**短期**（short run）里有些投入改不了：工厂已经建好，它的成本 $F$ 不管生产不生产都得付。成本于是分成**固定成本**（fixed cost）和**可变成本** $VC(q)$，平均可变成本 $AVC = VC/q$。")),
                 p(T(r"Should a firm that is losing money stop producing? Not necessarily. If it stops, it still pays $F$. If it produces, it pays $F$ plus the variable cost, but earns revenue. Producing is better as long as revenue covers the variable cost, that is, as long as $p \geq AVC$. So in the short run a firm **shuts down** only when $p < \min AVC$; in the long run, with no fixed costs, it **exits** when $p < \min AC$.",
                     r"亏钱的厂商该停产吗？不一定。停产了 $F$ 照付。生产的话要付 $F$ 加可变成本，但有收入。只要收入能覆盖可变成本，也就是 $p \geq AVC$，生产就更好。所以短期里厂商只有在 $p < \min AVC$ 时才**停产**（shut down）；长期没有固定成本，$p < \min AC$ 时就**退出**（exit）。")),
                 quiz(T(r"In the short run a firm's price is above its average variable cost but below its average total cost. What should it do?", r"短期里，某厂商的价格高于平均可变成本、但低于平均总成本。它该怎么办？"),
                      [(T(r"Keep producing where $p = MC$: it loses money, but less than if it shut down", r"继续在 $p = MC$ 处生产：会亏，但比停产亏得少"), True),
                       (T('Shut down at once: it is making a loss', '马上停产：它在亏钱'), T(r"If it shuts down it still pays the whole fixed cost. Producing covers the variable cost and part of the fixed cost, so the loss is smaller.", r"停产了固定成本照付。继续生产能收回可变成本，还能补一部分固定成本，亏得更少。")),
                       (T('Raise its price to cover average cost', '提价到能覆盖平均成本'), T(r"A competitive firm cannot: at any price above the market price it sells nothing.", r"竞争厂商做不到：价格一高于市场价就一个也卖不出去。"))],
                      T(r"Shut down only when the price no longer covers average variable cost. Between $\min AVC$ and $\min AC$ the firm produces at a loss in the short run, and leaves the industry in the long run if the price stays there.",
                        r"只有价格连平均可变成本都覆盖不了时才停产。价格在 $\min AVC$ 和 $\min AC$ 之间时，短期里亏着也要生产；如果价格一直这样，长期就退出行业。")),
                 h(T('If the question changes', '如果题目变了')),
                 ul(T(r"**It asks for the short-run supply.** The industry supply is the number of firms times each firm's $MC$ curve above $\min AVC$. A rise in demand then raises the price (point $B$ in the market diagram).", r"**问短期供给。** 行业供给 = 厂商数 × 每家在 $\min AVC$ 以上的那段 $MC$。这时需求增加会抬高价格（市场图里的 $B$ 点）。"),
                    T(r"**A tax of $t$ on every unit.** Each firm's average cost rises by $t$, so its lowest point rises by $t$: the long-run price rises by exactly $t$, and buyers pay all of it, because supply is flat.", r"**每单位征税 $t$。** 每家厂商的平均成本整体上移 $t$，最低点也上移 $t$：长期价格正好涨 $t$，全部由买家负担，因为供给是平的。"),
                    T(r"**Input prices rise as the industry grows** (an *increasing-cost industry*). Then each new firm costs more than the last, and the long-run supply slopes up.", r"**行业扩张时投入品变贵**（*成本递增行业*）。这时每家新厂商的成本都比上一家高，长期供给向上倾斜。")),
                 h(T('Traps', '易错点')),
                 ul(T(r"Giving one firm's $LMC$ curve as the industry's long-run supply. With free entry the industry curve is flat at $\min LRAC$.", r"把一家厂商的 $LMC$ 曲线当成行业长期供给。有自由进入时，行业供给是 $\min LRAC$ 处的一条平线。"),
                    T(r"Computing the elasticity of **supply** (infinite here, since it is flat) instead of demand.", r"算成了**供给**弹性（这里是无穷大，因为是平的），而不是需求弹性。"),
                    T(r"Mixing up $q$ (one firm) and $Q$ (the market).", r"把 $q$（一家厂商）和 $Q$（整个市场）混在一起。")),
                 chapter=WIDER_CH()),
            number('try-price', T('Your turn: the long-run price', '你来：长期价格'), S,
                   T(r"Each firm has $C = q^3 - 20q^2 + 150q$. What is the long-run competitive price?", r"每家厂商 $C = q^3 - 20q^2 + 150q$。长期竞争价格是多少？"),
                   50, T(r"$AC = q^2 - 20q + 150$, lowest where $2q - 20 = 0$, at $q = 10$: $AC = 100 - 200 + 150 = 50$.", r"$AC = q^2 - 20q + 150$，在 $2q - 20 = 0$ 即 $q = 10$ 处最低：$AC = 100 - 200 + 150 = 50$。"),
                   tolerance=0.01, hints=[T(r"Find the bottom of $AC = C/q$.", r"求 $AC = C/q$ 的最低点。")], chapter=TRY_CH()),
            number('try-firms', T('Your turn: how many firms', '你来：有多少家厂商'), S,
                   T(r"Same firms as question 5 (each makes 25 at the bottom of $AC = 125$), but market demand is $Q = 3000 - 4p$. How many firms are there in the long run?", r"厂商和第 5 题一样（每家在 $AC$ 最低点 125 处做 25），但市场需求是 $Q = 3000 - 4p$。长期里有多少家厂商？"),
                   100, T(r"$Q = 3000 - 4 \times 125 = 2500$, and $2500 / 25 = 100$ firms. The price is still 125: demand changes the number of firms, not the long-run price.", r"$Q = 3000 - 4 \times 125 = 2500$，$2500 / 25 = 100$ 家。价格仍是 125：需求改变的是厂商数，不是长期价格。"),
                   tolerance=0.01),
            number('try-elasticity', T('Your turn: an elasticity', '你来：算弹性'), E,
                   T(r"Demand is $Q = 1000 - 5p$. What is the point elasticity at $p = 50$? (Give the signed value, to two decimals.)", r"需求 $Q = 1000 - 5p$。$p = 50$ 处的点弹性是多少？（带符号，保留两位小数。）"),
                   -0.33, T(r"$Q = 750$, so $\varepsilon = -5 \times 50/750 = -1/3 \approx -0.33$: inelastic.", r"$Q = 750$，$\varepsilon = -5 \times 50/750 = -1/3 \approx -0.33$：缺乏弹性。"),
                   tolerance=0.01),
        ],
    )


def L_monopoly():
    S, X = 'e15.monopoly', 'e15.tax'
    return dict(
        id=f'{CID}-monopoly', title=T('One seller, and a tax on its price (Q2)', '一家独大，再收一道税（第 2 题）'),
        description=T('Why a single seller earns less from one more sale than its price, how it picks its output with MR = MC, how a tax changes the demand it sees, and who really pays the tax.', '为什么独家卖方多卖一个赚到的比价格少，它怎样用 MR = MC 定产量，税怎样改变它看到的需求，以及税到底谁付。'),
        minutes=50,
        skills=[{'id': S, 'name': T('Monopoly pricing', '垄断定价')}, {'id': X, 'name': T('Tax incidence', '税负归宿')}],
        misconceptions=[{'id': 'price-from-mr', 'description': T('Reading the monopoly price off the MR curve instead of the demand curve', '从 MR 曲线而不是需求曲线读垄断价格')},
                        {'id': 'buyers-pay-tax', 'description': T('Assuming the buyers pay the whole tax because it is added to their price', '以为税加在买方价格上，就全由买方付')}],
        steps=[
            read('question', T('Question 2, as printed', '第 2 题原文'),
                 paper(T('Question 2 · 25 marks', '第 2 题 · 25 分'),
                       T(r"A monopolist has the total cost $C$ and marginal cost $MC$ functions: $C = 60Q + \tfrac12 Q^2$ and $MC = 60 + Q$, where $Q$ is output. The market demand is $Q = 300 - \tfrac12 p$, where $p$ is the output price.",
                         r"某垄断者的总成本函数 $C$ 和边际成本函数 $MC$ 为：$C = 60Q + \tfrac12 Q^2$，$MC = 60 + Q$，其中 $Q$ 是产量。市场需求为 $Q = 300 - \tfrac12 p$，其中 $p$ 是产品价格。"),
                       T(r"**a.** Find the monopolist's profit-maximizing output, price, and profit. (10 marks)", r"**a.** 求垄断者利润最大化时的产量、价格和利润。（10 分）"),
                       T(r"**b.** The government now imposes a tax that is 25% of the monopolist's price $p$. So, letting $p$ be the price the monopolist (seller) gets, $1.25p$ is the price the consumers (buyers) pay. Find the monopolist's profit-maximizing output, price, and profit with the tax. (8 marks) Notice this is not a per unit tax it is a percentage tax, so use the relation between the buyer and seller price given above, not the one we did in class. Otherwise, the steps are the same.",
                         r"**b.** 政府现在征收垄断者价格 $p$ 的 25% 作为税。也就是说，设垄断者（卖方）得到的价格为 $p$，消费者（买方）付的价格为 $1.25p$。求征税后垄断者利润最大化的产量、价格和利润。（8 分）注意这不是从量税，而是百分比税，所以要用上面给出的买卖双方价格关系，而不是课上讲的那种。除此之外步骤相同。"),
                       T(r"**c.** Find who pays more of the tax, the consumers or the monopolist. Also, find the change in government finances from the tax. (7 marks)", r"**c.** 求税的大头由谁承担，消费者还是垄断者。另外求这道税给政府财政带来的变化。（7 分）")),
                 h(T('Reading it slowly', '慢慢读一遍')),
                 ul(T(r"**A monopolist** is the only seller of its product. Unlike the small firms of question 5, it is not a price taker: it faces all the buyers in the market.", r"**垄断者**（monopolist）是某种产品的唯一卖家。和第 5 题的小厂商不同，它不是价格接受者：它面对的是市场上全部的买家。"),
                    T(r"**$C = 60Q + \tfrac12 Q^2$** is its total cost of making $Q$ units. **$MC = 60 + Q$** is its derivative, the cost of one more unit: the first units cost about 60 each, and each further unit costs a little more than the last.", r"**$C = 60Q + \tfrac12 Q^2$** 是它生产 $Q$ 个单位的总成本。**$MC = 60 + Q$** 是它的导数，多生产一个单位的成本：最初几个单位每个约 60，之后每多一个都比上一个贵一点。"),
                    T(r"**$Q = 300 - \tfrac12 p$** is market demand, as in question 1: at price $p$, buyers want this many.", r"**$Q = 300 - \tfrac12 p$** 是市场需求，和第 1 题一样：价格为 $p$ 时买家想买这么多。"),
                    T(r"Part (b) introduces **two prices**: $p$ is what the monopolist receives, $1.25p$ what buyers pay; the government keeps the difference, $0.25p$ per unit.", r"(b) 引入了**两个价格**：$p$ 是垄断者收到的，$1.25p$ 是买家付的；差价 $0.25p$ 每单位归政府。")),
                 p(T(r"The ideas you need: why a single seller is different, and the rule it uses to pick its output (a); how a tax changes the demand the seller faces (b); and how to tell who bears a tax (c).", r"需要的想法：独家卖方为什么不一样，以及它用来定产量的规则 (a)；税怎样改变卖方面对的需求 (b)；怎样判断税由谁承担 (c)。")),
                 chapter=Q_CH()),
            read('power', T('One seller: to sell more, it must cut its price', '独家卖方：想多卖，就得降价'),
                 paper(T('Part (a) · 10 marks', '(a) 小问 · 10 分'), T(r"Find the monopolist's profit-maximizing output, price, and profit.", r"求垄断者利润最大化时的产量、价格和利润。")),
                 p(T(r"A monopoly exists only if rivals cannot come in, otherwise its profit would attract them (question 5). Something must block entry: a patent or licence, control of a key input, or economies of scale so strong that one firm can supply the whole market more cheaply than two (water pipes, power grids).",
                     r"垄断能存在，前提是对手进不来，否则它的利润会把对手吸引进来（第 5 题）。得有东西挡住进入：专利或执照、控制关键的投入品，或者规模经济强到一家供应整个市场比两家更便宜（自来水管网、电网）。")),
                 p(T(r"Now the crucial difference from question 5. The small firm could sell as much as it liked at the market price. The monopolist faces the whole downward-sloping demand curve. Write demand the other way round, as the price buyers will pay for a given quantity:",
                     r"现在看它和第 5 题最关键的不同。小厂商按市场价想卖多少就卖多少。垄断者面对的是整条向下倾斜的需求曲线。把需求倒过来写，写成买家对一定数量愿付的价格：")),
                 math_(r"Q = 300 - \tfrac12 p \quad\Longleftrightarrow\quad p = 600 - 2Q"),
                 p(T(r"If it wants to sell 100 units, the most it can charge is $600 - 200 = 400$. To sell 120, it must drop to 360. Choosing a quantity *is* choosing a price: the monopolist picks a point on the demand curve. Which point maximises its profit?",
                     r"想卖 100 个，最多只能定 $600 - 200 = 400$。想卖 120 个，就得降到 360。选数量*就是*选价格：垄断者是在需求曲线上挑一个点。挑哪个点利润最大？")),
                 chapter=PART('a')),
            read('mr', T('Marginal revenue: what one more sale really brings in', '边际收益：多卖一个到底多赚多少'),
                 p(T(r"Try it with numbers. Selling 100 units at 400 brings in $400 \times 100 = 40{,}000$. To sell 101, the price must fall to 398, bringing in $398 \times 101 = 40{,}198$. One more unit added only **198** to revenue, not 398. Where did the other 200 go?",
                     r"用数试一试。按 400 卖 100 个，收入 $400 \times 100 = 40{,}000$。想卖 101 个，价格得降到 398，收入 $398 \times 101 = 40{,}198$。多卖一个，收入只多了 **198**，而不是 398。另外 200 去哪了？")),
                 p(T(r"The new unit sells for 398, but the price also fell by 2 on the 100 units the monopolist was already selling: $-2 \times 100 = -200$. So $398 - 200 = 198$. Selling one more means cutting the price on every unit, not just the new one.",
                     r"新的这一个卖了 398，可原来那 100 个的价格也降了 2：$-2 \times 100 = -200$。所以 $398 - 200 = 198$。多卖一个，意味着每一个的价格都要降，而不只是新的那一个。")),
                 svg(fig_mr(), T('Demand p = 600 − 2Q. Going from Q = 100 at p = 400 to Q = 120 at p = 360: the green rectangle (20 more units at 360, 7,200) is gained; the orange strip (40 less on each of the first 100 units, 4,000) is lost.',
                                 '需求 p = 600 − 2Q。从 Q = 100、p = 400 走到 Q = 120、p = 360：绿色矩形（多卖的 20 个按 360 算，7,200）是赚到的；橙色窄条（前 100 个每个少收 40，4,000）是失去的。'),
                     T(r"Going from 100 to 120 units: gain the green rectangle, lose the orange strip. Revenue rises by $7{,}200 - 4{,}000 = 3{,}200$, about 160 per extra unit, far below the price of 360.", r"从 100 个到 120 个：赚到绿色矩形，失去橙色窄条。收入增加 $7{,}200 - 4{,}000 = 3{,}200$，每多一个约 160，远低于价格 360。")),
                 p(T(r"The extra revenue from one more unit is called **marginal revenue**, $MR$. In calculus it is the derivative of total revenue $R = p \times Q$:", r"多卖一个单位带来的额外收入叫**边际收益**（marginal revenue, $MR$）。用微积分说，它是总收入 $R = p \times Q$ 的导数：")),
                 math_(r"R(Q) = (600 - 2Q)\,Q = 600Q - 2Q^2"),
                 math_(r"MR = \frac{dR}{dQ} = 600 - 4Q"),
                 p(T(r"Check: at $Q = 100$, $MR = 600 - 400 = 200$, close to the 198 we found by hand (the derivative is the exact version of *one more unit*). Notice the pattern, which holds for any straight demand line $p = a - bQ$: $R = aQ - bQ^2$, so $MR = a - 2bQ$. **Same intercept, twice the slope.** You will use this rule in every remaining question.",
                     r"验证：$Q = 100$ 时 $MR = 600 - 400 = 200$，和手算的 198 很接近（导数是“多一个单位”的精确版本）。注意这个规律，对任何直线需求 $p = a - bQ$ 都成立：$R = aQ - bQ^2$，所以 $MR = a - 2bQ$。**截距相同，斜率翻倍。** 后面每道题都会用到这条规则。"))),
            read('rule', T('The best output: MR = MC, then the price from demand', '最优产量：MR = MC，再从需求读价格'),
                 p(T(r"Now decide at the margin, exactly as the small firm did, but with marginal revenue in place of the price. One more unit brings in $MR$ and costs $MC$. If $MR > MC$, it adds to profit: produce it. If $MR < MC$, it loses money: do not. So profit is highest where", r"现在在边际上做决定，和小厂商一样，只是把价格换成边际收益。多一个单位带来 $MR$，花掉 $MC$。$MR > MC$ 就增加利润：做。$MR < MC$ 就亏钱：不做。所以利润在下面这一点最大：")),
                 math_(r"MR = MC"),
                 p(T(r"(In calculus: profit $\pi = R(Q) - C(Q)$, and $\frac{d\pi}{dQ} = MR - MC = 0$.) For the small firm of question 5, $MR$ was just the price, so the same rule gave $p = MC$. For the monopolist, $MR$ is below the price, so it stops earlier, at a smaller output and a higher price.",
                     r"（用微积分说：利润 $\pi = R(Q) - C(Q)$，$\frac{d\pi}{dQ} = MR - MC = 0$。）对第 5 题的小厂商，$MR$ 就是价格，所以同一条规则给出 $p = MC$。对垄断者，$MR$ 低于价格，所以它停得更早：产量更小，价格更高。")),
                 p(T(r"$MR = MC$ tells the monopolist **how many** to sell. The **price** is then whatever buyers will pay for that many: read it off the **demand** curve, not off $MR$. On the diagram: find where $MR$ crosses $MC$, then go straight **up** to the demand curve.",
                     r"$MR = MC$ 告诉垄断者卖**多少**。**价格**则是买家为这么多愿付的钱：从**需求**曲线上读，而不是从 $MR$ 上读。在图上：找到 $MR$ 与 $MC$ 的交点，然后竖直**往上**走到需求曲线。")),
                 svg(fig_monopoly(), T('Demand p = 600 − 2Q, marginal revenue MR = 600 − 4Q and marginal cost MC = 60 + Q. MR meets MC at Q = 108, where MR = MC = 168; the price read off demand above it is 384. Demand meets MC at Q = 180, p = 240; the shaded triangle between Q = 108 and 180 is the deadweight loss.',
                                       '需求 p = 600 − 2Q、边际收益 MR = 600 − 4Q、边际成本 MC = 60 + Q。MR 与 MC 交于 Q = 108，此处 MR = MC = 168；正上方需求曲线给出价格 384。需求与 MC 交于 Q = 180、p = 240；Q 在 108 到 180 之间的阴影三角形是无谓损失。'),
                     T(r"Find $Q$ where $MR$ meets $MC$, then go **up** to demand for the price. (The shaded triangle comes back in the wider topic.)", r"在 $MR$ 与 $MC$ 的交点找 $Q$，再**往上**到需求曲线读价格。（阴影三角形在“这类题的全貌”里再讲。）")),
                 quiz(T(r"The monopolist produces 108, where $MR = MC = 168$. Someone writes the price as 168. What went wrong?", r"垄断者生产 108，此处 $MR = MC = 168$。有人把价格写成 168。错在哪？"),
                      [(T(r"168 is marginal revenue (= MC) at 108; the price is on the demand curve: 384", r"168 是 108 处的边际收益（= MC）；价格要在需求曲线上读：384"), True),
                       (T(r"Nothing: at the optimum the price equals marginal cost", r"没错：最优点处价格等于边际成本"), T(r"That is a price taker. A monopolist's price is above its marginal cost: here 384 against 168.", r"那是价格接受者。垄断者的价格高于边际成本：这里是 384 对 168。")),
                       (T(r"The price should be 240, where demand meets MC", r"价格应该是 240，即需求与 MC 相交处"), T(r"240 is the price competition would give. The monopolist sells fewer units at a higher price.", r"240 是竞争会给出的价格。垄断者卖得更少、价格更高。"))],
                      T(r"$MR = MC$ gives the quantity. Buyers then pay what the demand curve says they will pay for 108 units: $600 - 2 \times 108 = 384$.", r"$MR = MC$ 给出数量。买家付的是需求曲线上 108 个单位对应的价格：$600 - 2 \times 108 = 384$。"))),
            derive('q2a', T('Part (a), worked', '(a) 小问：完整解法'),
                   [('p = 600 - 2Q', T(r"Write demand as the price buyers pay for $Q$ units (inverse demand): from $Q = 300 - \tfrac12 p$, $\tfrac12 p = 300 - Q$, and double both sides.", r"把需求写成买家对 $Q$ 个单位愿付的价格（反需求）：由 $Q = 300 - \tfrac12 p$ 得 $\tfrac12 p = 300 - Q$，两边乘 2。")),
                    ('R = pQ = 600Q - 2Q^2', T(r"Total revenue $R$ is the price times the number sold.", r"总收入 $R$ = 价格 × 卖出的数量。")),
                    ('MR = \\frac{dR}{dQ} = 600 - 4Q', T(r"Marginal revenue is the derivative of revenue: same intercept as demand, twice the slope.", r"边际收益是收入的导数：截距与需求相同，斜率翻倍。")),
                    ('600 - 4Q = 60 + Q \\;\\Rightarrow\\; Q = 108', T(r"Profit is highest where one more unit brings in exactly what it costs, $MR = MC$, with $MC = 60 + Q$ from the question. Collect terms: $5Q = 540$.", r"利润在多一个单位带来的恰好等于它的成本处最大，$MR = MC$，其中 $MC = 60 + Q$ 由题目给出。移项：$5Q = 540$。")),
                    ('p = 600 - 2 \\times 108 = 384', T(r"The price is what buyers pay for 108 units: read it off **demand**, not off $MR$.", r"价格是买家为 108 个单位愿付的钱：从**需求**上读，不是从 $MR$ 上读。")),
                    ('C = 60(108) + \\tfrac12 (108)^2 = 12{,}312', T(r"Total cost of making 108 units, from $C = 60Q + \tfrac12 Q^2$: $6480 + 5832$.", r"生产 108 个单位的总成本，由 $C = 60Q + \tfrac12 Q^2$ 得：$6480 + 5832$。")),
                    ('\\pi = 41{,}472 - 12{,}312 = 29{,}160', T(r"Profit $\pi$ is revenue minus cost. Revenue is $384 \times 108 = 41{,}472$.", r"利润 $\pi$ = 收入 − 成本。收入是 $384 \times 108 = 41{,}472$。"))],
                   outro=T(r"**Answer:** the monopolist produces 108 units, charges 384 and earns a profit of 29,160. (Check: $MR(108) = 600 - 432 = 168$ and $MC(108) = 60 + 108 = 168$.)", r"**答案：** 垄断者生产 108 个，定价 384，利润 29,160。（验证：$MR(108) = 600 - 432 = 168$，$MC(108) = 60 + 108 = 168$。）"),
                   blank=(2, '600 - 4*Q', T(r"Marginal revenue: differentiate $R = 600Q - 2Q^2$ with respect to $Q$.", r"边际收益：把 $R = 600Q - 2Q^2$ 对 $Q$ 求导。")), skill=S),
            read('tax', T('A tax on the price: two prices instead of one', '对价格征税：一个价格变成两个'),
                 paper(T('Part (b) · 8 marks', '(b) 小问 · 8 分'), T(r"The government now imposes a tax that is 25% of the monopolist's price $p$. So, letting $p$ be the price the monopolist (seller) gets, $1.25p$ is the price the consumers (buyers) pay. Find the monopolist's profit-maximizing output, price, and profit with the tax. Notice this is not a per unit tax it is a percentage tax, so use the relation between the buyer and seller price given above, not the one we did in class. Otherwise, the steps are the same.",
                                                                          r"政府现在征收垄断者价格 $p$ 的 25% 作为税。也就是说，设垄断者（卖方）得到的价格为 $p$，消费者（买方）付的价格为 $1.25p$。求征税后垄断者利润最大化的产量、价格和利润。注意这不是从量税，而是百分比税，所以要用上面给出的买卖双方价格关系，而不是课上讲的那种。除此之外步骤相同。")),
                 p(T(r"Before the tax, what the buyer paid was what the seller got. Now the government stands between them: for every unit, the seller gets $p$, the buyer pays $1.25p$, and the government keeps $0.25p$.", r"征税前，买家付多少，卖家就拿多少。现在政府站在了中间：每个单位，卖家拿 $p$，买家付 $1.25p$，政府留下 $0.25p$。")),
                 p(T(r"**Buyers react to what they pay.** Their demand has not changed; it is still $Q = 300 - \tfrac12(\text{what they pay})$, and what they pay is $1.25p$: $Q = 300 - \tfrac12(1.25p)$.", r"**买家看自己付多少。** 他们的需求没变，仍是 $Q = 300 - \tfrac12(\text{他们付的价})$，而他们付的是 $1.25p$：$Q = 300 - \tfrac12(1.25p)$。")),
                 p(T(r"**The seller cares about what it gets.** So rewrite demand in terms of the seller's price. For $Q$ units buyers will pay $600 - 2Q$; the seller gets that divided by 1.25:", r"**卖家看自己拿多少。** 所以把需求改写成卖家价格的形式。卖 $Q$ 个，买家愿付 $600 - 2Q$；卖家拿到的是它除以 1.25：")),
                 math_(r"p = \frac{600 - 2Q}{1.25} = 480 - 1.6Q"),
                 p(T(r"This is **the demand curve the seller sees**. Every point of the original demand is scaled down by the same factor, $1/1.25 = 0.8$: the curve **rotates** down (its intercept falls from 600 to 480, its slope from 2 to 1.6). The tax per unit is largest where the price is high and shrinks to nothing where the price is zero.",
                     r"这就是**卖方看到的需求曲线**。原来需求上的每一点都按同一个比例 $1/1.25 = 0.8$ 缩小：曲线往下**转**（截距从 600 降到 480，斜率从 2 降到 1.6）。每单位的税在价格高的地方最大，价格为零的地方缩为零。")),
                 p(T(r"The exam's note mentions the tax *done in class*: a **per-unit tax** of $t$ on every unit, whatever the price. Then the seller gets $600 - 2Q - t$: the curve **shifts** down in parallel by $t$. Either way, the method is the same: the monopolist redoes $MR = MC$ with the curve it actually faces. Its cost of production does not change, because the tax is taken out of the price, not added to the cost of making a unit.",
                     r"题目的注释提到*课上讲的*税：**从量税**，不管价格多少，每单位收 $t$。这时卖家拿到 $600 - 2Q - t$：曲线整体往下**平移** $t$。不管哪种，方法都一样：垄断者用它真正面对的曲线重做 $MR = MC$。生产成本不变，因为税是从价格里扣的，不是加在生产成本上。")),
                 visual('econ_monopoly_tax', T(r"Drag the tax and switch its kind. Dashed: what the seller keeps. Purple: the seller's marginal revenue. The thick bar at the chosen quantity is the tax per unit: blue above the old price 384 is paid by buyers, orange below it by the monopolist. The same slider position is the same 80 per unit at $\tau = 25\%$.",
                                                r"拖动税率，切换税的种类。虚线：卖方实得。紫线：卖方的边际收益。所选数量处的粗竖条就是每单位税：旧价格 384 之上的蓝色部分由买方承担，之下的橙色部分由垄断者承担。滑块在同一位置时，两种税在 $\tau = 25\%$ 处都是每单位 80。")),
                 chapter=PART('b')),
            derive('q2b', T('Part (b), worked', '(b) 小问：完整解法'),
                   [('Q = 300 - \\tfrac12 (1.25p)', T(r"The seller gets $p$ and buyers pay $1.25p$. Buyers' demand depends on what they pay:", r"卖家拿 $p$，买家付 $1.25p$。买家的需求取决于他们付的价：")),
                    ('p = \\frac{600 - 2Q}{1.25} = 480 - 1.6Q', T(r"Solve for the seller's price $p$: this is the demand curve as the seller sees it.", r"解出卖家的价格 $p$：这就是卖家看到的需求曲线。")),
                    ('MR = 480 - 3.2Q', T(r"The seller's marginal revenue from that curve: same intercept, twice the slope.", r"由这条曲线得卖家的边际收益：截距相同，斜率翻倍。")),
                    ('480 - 3.2Q = 60 + Q \\;\\Rightarrow\\; Q = 100', T(r"The tax does not change the cost of production, so $MC = 60 + Q$ as before. Set $MR = MC$ and collect terms: $4.2Q = 420$.", r"税不改变生产成本，所以 $MC = 60 + Q$ 不变。令 $MR = MC$ 并移项：$4.2Q = 420$。")),
                    ('p = 480 - 1.6 \\times 100 = 320', T(r"The seller's price, from the seller's demand curve.", r"卖家的价格，从卖家的需求曲线读。")),
                    ('1.25 \\times 320 = 400', T(r"Buyers pay 25% more. (Check on the original demand: for 100 units buyers pay $600 - 2 \times 100 = 400$.)", r"买家多付 25%。（用原需求验证：买 100 个单位，买家付 $600 - 2 \times 100 = 400$。）")),
                    ('C = 60(100) + \\tfrac12 (100)^2 = 11{,}000', T(r"Total cost of 100 units (the tax does not change it).", r"100 个单位的总成本（税不改变它）。")),
                    ('\\pi = 320 \\times 100 - 11{,}000 = 21{,}000', T(r"Profit uses the price the seller **keeps**, 320, not what buyers pay.", r"利润用卖家**拿到**的价格 320 算，不是买家付的价。"))],
                   outro=T(r"**Answer:** with the tax the monopolist produces 100 units, receives 320 per unit (buyers pay 400), and earns 21,000.", r"**答案：** 征税后垄断者生产 100 个，每个拿到 320（买家付 400），利润 21,000。"),
                   blank=(1, '480 - 1.6*Q', T(r"The demand the seller sees: buyers pay $600 - 2Q$; the seller gets that divided by 1.25.", r"卖家看到的需求：买家付 $600 - 2Q$；卖家拿到的是它除以 1.25。")), skill=X),
            read('incidence', T('Who really pays a tax', '税到底是谁付的'),
                 paper(T('Part (c) · 7 marks', '(c) 小问 · 7 分'), T(r"Find who pays more of the tax, the consumers or the monopolist. Also, find the change in government finances from the tax.", r"求税的大头由谁承担，消费者还是垄断者。另外求这道税给政府财政带来的变化。")),
                 p(T(r"The law says the tax is collected on the sale. But who hands the money to the government is not who **bears** it. The burden of a tax falls on whoever ends up worse off because of it, and that is measured by how far each side's price moved.",
                     r"按法律，税是在交易时收的。可是谁把钱交给政府，并不等于谁**承担**了它。税的负担落在因它而变差的人身上，衡量的办法是看两边的价格各变了多少。")),
                 p(T(r"Before the tax both sides faced one price, 384. After it, buyers pay 400 and the seller keeps 320. The tax per unit is the gap, $400 - 320 = 80$. Of those 80, buyers bear the 16 by which their price rose, and the monopolist bears the 64 by which its price fell. So the monopolist pays $64/80 = 80\%$ of the tax, even though it is added to the buyers' price.",
                     r"征税前两边面对同一个价格 384。征税后买家付 400，卖家拿 320。每单位税就是这个差，$400 - 320 = 80$。这 80 里，买家承担的是他们价格涨的 16，垄断者承担的是它价格降的 64。所以虽然税加在买家价格上，垄断者却承担了 $64/80 = 80\%$。")),
                 p(T(r"Why so much on the seller? The monopolist had already pushed the price as high as it profitably could. Passing the whole tax on would lose too many buyers, so it absorbs most of it.", r"为什么卖家承担这么多？垄断者本来就把价格推到了有利可图的最高处。把税全部转嫁出去会流失太多买家，所以它自己吞下了大部分。")),
                 p(T(r"**Government finances**: before, nothing; after, 80 on each of the 100 units sold: $80 \times 100 = 8000$.", r"**政府财政**：之前什么也没有；之后，卖出的 100 个每个 80：$80 \times 100 = 8000$。")),
                 quiz(T(r"Buyers hand over 400 per unit, of which 80 goes to the government. Who bears most of the tax?", r"买家每单位交出 400，其中 80 归政府。税的大头由谁承担？"),
                      [(T(r"The monopolist: its price fell by 64, the buyers' rose by only 16", r"垄断者：它的价格降了 64，买家的只涨了 16"), True),
                       (T(r"The buyers: they pay the 400 that includes the tax", r"买家：他们付的 400 里含着税"), T(r"Paying the money is not bearing the burden. Without the tax they would have paid 384, so the tax costs them only 16 a unit.", r"交钱不等于承担。没有税时他们本来就付 384，所以税每单位只让他们多付 16。")),
                       (T(r"Half each: the tax is shared equally", r"一半一半：税是平分的"), T(r"Shares follow how far each price moves, here 16 against 64, not a rule of halves.", r"份额看两边价格各动了多少，这里是 16 对 64，不是对半分。"))],
                      T(r"Incidence is measured against the price before the tax: buyers $400 - 384 = 16$, monopolist $384 - 320 = 64$.", r"税负归宿要和税前价格比：买家 $400 - 384 = 16$，垄断者 $384 - 320 = 64$。")),
                 chapter=PART('c')),
            derive('q2c', T('Part (c), worked', '(c) 小问：完整解法'),
                   [('t = p_b - p_s = 400 - 320 = 80', T(r"Write $p_b$ for the buyers' price and $p_s$ for the seller's. The tax per unit is the gap between them (25% of 320).", r"用 $p_b$ 表示买家价格，$p_s$ 表示卖家价格。每单位税就是两者之差（320 的 25%）。")),
                    ('\\Delta p_b = 400 - 384 = +16', T(r"How much more buyers pay than before the tax.", r"买家比征税前多付多少。")),
                    ('\\Delta p_s = 320 - 384 = -64', T(r"How much less the seller gets than before the tax.", r"卖家比征税前少拿多少。")),
                    ('\\frac{64}{80} = 80\\%, \\qquad \\frac{16}{80} = 20\\%', T(r"The shares of the tax: the monopolist bears 80%, the buyers 20%.", r"税的分担：垄断者承担 80%，买家 20%。")),
                    ('80 \\times 100 = 8000', T(r"Government finances improve by the tax per unit times the units sold (there was no tax before).", r"政府财政改善 = 每单位税 × 卖出数量（原来没有税）。"))],
                   outro=T(r"**Answer:** the monopolist pays more of the tax (64 of the 80 per unit, 80%); consumers pay 16 (20%). Government revenue rises by 8,000.", r"**答案：** 税的大头由垄断者承担（每单位 80 中的 64，即 80%）；消费者承担 16（20%）。政府收入增加 8,000。"),
                   blank=(1, '16', T(r"How much more do buyers pay per unit than before the tax?", r"买家每单位比税前多付多少？")), skill=X),
            read('welfare', T('The whole welfare picture', '完整的福利账'),
                 p(T(r"Part (c) is answered by the prices, but the same story shows in everyone's surplus, computed as in question 1 (consumer surplus: the triangle under demand above the buyers' price; before the tax $\tfrac12 \times 108 \times (600 - 384)$, after it $\tfrac12 \times 100 \times (600 - 400)$):",
                     r"(c) 用价格就答完了，但同一个故事也体现在每个人的剩余上，算法和第 1 题一样（消费者剩余：需求之下、买家价格之上的三角形；税前 $\tfrac12 \times 108 \times (600 - 384)$，税后 $\tfrac12 \times 100 \times (600 - 400)$）：")),
                 table([T('Who', '谁'), T('Before', '税前'), T('After', '税后'), T('Change', '变化')],
                       [T('Consumers', '消费者'), '$11{,}664$', '$10{,}000$', '$-1{,}664$'],
                       [T('Monopolist', '垄断者'), '$29{,}160$', '$21{,}000$', '$-8{,}160$'],
                       [T('Government', '政府'), '$0$', '$8{,}000$', '$+8{,}000$'],
                       [T('Total', '合计'), '$40{,}824$', '$39{,}000$', '$-1{,}824$']),
                 p(T(r"By prices (16 against 64) or by losses (1,664 against 8,160), the monopolist bears most of the tax. The 1,824 lost by everyone together is the **deadweight loss** of the tax: the 8 units between 100 and 108 that were worth more to buyers than they cost to make, and are no longer made.",
                     r"按价格（16 对 64）还是按损失（1,664 对 8,160）看，大头都由垄断者承担。所有人一起少了的 1,824 是这道税的**无谓损失**：100 到 108 之间那 8 个单位，买家心里的价值高于生产成本，却不再生产了。"))),
            read('paper-answer', T('A full-mark answer', '一份满分答案'),
                 paper(T('Question 2 · a full-mark answer', '第 2 题 · 满分答案'),
                       T(r"**a.** Inverse demand: $p = 600 - 2Q$, so $TR = 600Q - 2Q^2$ and $MR = 600 - 4Q$. Profit is maximised where $MR = MC$: $600 - 4Q = 60 + Q$, so $Q = 108$. Price from demand: $p = 600 - 2(108) = 384$. $TC = 60(108) + \tfrac12(108)^2 = 12{,}312$, so profit $= 384(108) - 12{,}312 = 29{,}160$.",
                         r"**a.** 反需求：$p = 600 - 2Q$，所以 $TR = 600Q - 2Q^2$，$MR = 600 - 4Q$。利润在 $MR = MC$ 处最大：$600 - 4Q = 60 + Q$，$Q = 108$。价格由需求得：$p = 600 - 2(108) = 384$。$TC = 60(108) + \tfrac12(108)^2 = 12{,}312$，利润 $= 384(108) - 12{,}312 = 29{,}160$。"),
                       T(r"**b.** Buyers pay $1.25p$, so $Q = 300 - \tfrac12(1.25p)$ and the monopolist faces $p = (600 - 2Q)/1.25 = 480 - 1.6Q$. $MR = 480 - 3.2Q = 60 + Q$ gives $Q = 100$. The monopolist receives $p = 480 - 160 = 320$; consumers pay $1.25 \times 320 = 400$. Profit $= 320(100) - [60(100) + \tfrac12(100)^2] = 21{,}000$.",
                         r"**b.** 买家付 $1.25p$，所以 $Q = 300 - \tfrac12(1.25p)$，垄断者面对 $p = (600 - 2Q)/1.25 = 480 - 1.6Q$。$MR = 480 - 3.2Q = 60 + Q$ 得 $Q = 100$。垄断者得 $p = 480 - 160 = 320$；消费者付 $1.25 \times 320 = 400$。利润 $= 320(100) - [60(100) + \tfrac12(100)^2] = 21{,}000$。"),
                       T(r"**c.** Tax per unit $= 400 - 320 = 80$. Consumers' price rises by $400 - 384 = 16$; the monopolist's falls by $384 - 320 = 64$. The monopolist pays more of the tax (80%, against 20% for consumers). Government revenue increases by $80 \times 100 = 8{,}000$.",
                         r"**c.** 每单位税 $= 400 - 320 = 80$。消费者价格上涨 $400 - 384 = 16$；垄断者价格下降 $384 - 320 = 64$。税的大头由垄断者承担（80%，消费者 20%）。政府收入增加 $80 \times 100 = 8{,}000$。"),
                       answer=True),
                 p(T(r"A sketch of demand, $MR$ and $MC$ with $Q = 108$ and $p = 384$ marked earns marks too, and catches the mistake of reading the price off $MR$.", r"画一张需求、$MR$、$MC$ 的草图，标出 $Q = 108$ 和 $p = 384$，也能得分，还能防止从 $MR$ 上读价格的错误。")),
                 chapter=PAPER_CH()),
            read('dwl', T('What a monopoly costs, and taxes in general', '垄断的代价，以及一般的税'),
                 h(T('The deadweight loss of monopoly', '垄断的无谓损失')),
                 p(T(r"A competitive industry with the same costs would produce where demand meets $MC$: $600 - 2Q = 60 + Q$, so $Q = 180$ and $p = 240$. The units from 108 to 180 are worth more to buyers than they cost to make, but the monopolist does not sell them, because selling them would lower its price on all the others. The surplus lost is the shaded triangle in the diagram: $\tfrac12 \times (384 - 168) \times (180 - 108) = 7{,}776$. This is why governments regulate monopolies (a price cap of 240 would make the monopolist produce 180).",
                     r"成本相同的竞争行业会在需求等于 $MC$ 处生产：$600 - 2Q = 60 + Q$，$Q = 180$，$p = 240$。108 到 180 之间的那些单位，买家心里的价值高于生产成本，垄断者却不卖，因为多卖会压低其余所有单位的价格。损失的剩余就是图里的阴影三角形：$\tfrac12 \times (384 - 168) \times (180 - 108) = 7{,}776$。这就是政府管制垄断的原因（把价格上限定在 240，垄断者就会生产 180）。")),
                 h(T('The markup rule', '加价法则')),
                 p(T(r"With elasticity (question 5), marginal revenue has a neat form: $MR = p\left(1 + \frac{1}{\varepsilon}\right)$. Setting it equal to $MC$ gives the **Lerner rule**, $\frac{p - MC}{p} = \frac{1}{|\varepsilon|}$: the less elastic the demand, the higher the markup. Since $MC > 0$, $MR > 0$, so a monopolist always prices where demand is elastic. Check here: $\varepsilon = -\tfrac12 \times \tfrac{384}{108} \approx -1.78$ and $\tfrac{384 - 168}{384} = 0.5625 = \tfrac{1}{1.78}$.",
                     r"有了弹性（第 5 题），边际收益可以写成 $MR = p\left(1 + \frac{1}{\varepsilon}\right)$。令它等于 $MC$ 就得到**勒纳法则**（Lerner rule）$\frac{p - MC}{p} = \frac{1}{|\varepsilon|}$：需求越缺乏弹性，加价越高。因为 $MC > 0$，所以 $MR > 0$，垄断者总在需求富有弹性的地方定价。这里验证：$\varepsilon = -\tfrac12 \times \tfrac{384}{108} \approx -1.78$，而 $\tfrac{384 - 168}{384} = 0.5625 = \tfrac{1}{1.78}$。")),
                 h(T('Who pays a tax, in any market', '任何市场里，税由谁付')),
                 ul(T(r"**The side that can less easily walk away pays more.** In a competitive market the buyers' share is $\frac{\varepsilon_s}{\varepsilon_s - \varepsilon_d}$ (supply elasticity over the gap between the two elasticities): inelastic buyers pay most; with flat supply (question 5) buyers pay all of it.", r"**越不容易走开的一方付得越多。** 竞争市场里买方承担的份额是 $\frac{\varepsilon_s}{\varepsilon_s - \varepsilon_d}$（供给弹性除以两个弹性之差）：买方缺乏弹性时付大头；供给是水平线时（第 5 题）买方全付。"),
                    T(r"**It does not matter who hands the money over.** A tax collected from sellers or from buyers ends with the same prices and the same shares.", r"**钱是谁交的不重要。** 向卖方收还是向买方收，最后的价格和分担比例都一样。"),
                    T(r"**A lump-sum tax or a tax on profit** changes neither $MR$ nor $MC$, so the monopolist keeps the same $Q$ and $p$ and just earns less. No deadweight loss.", r"**定额税或利润税**既不改变 $MR$ 也不改变 $MC$，垄断者的 $Q$ 和 $p$ 都不变，只是赚得少了。没有无谓损失。")),
                 details(T('Beyond the exam: here a percentage tax beats a per-unit tax', '超出考试：这里百分比税比从量税好'),
                         p(T(r"Charge the same 80 as a per-unit tax: the seller faces $p = 520 - 2Q$, $MR = 520 - 4Q = 60 + Q$, so $Q = 92$ and revenue is $80 \times 92 = 7{,}360$. The percentage tax raised more (8,000) **and** kept more output (100). A percentage tax lowers the seller's marginal revenue less where its price is low, so it distorts a monopolist's output less. (Try both in the figure above.)",
                             r"换成每单位 80 的从量税：卖方面对 $p = 520 - 2Q$，$MR = 520 - 4Q = 60 + Q$，得 $Q = 92$，税收 $80 \times 92 = 7{,}360$。百分比税收得更多（8,000），**而且**保住了更多产量（100）。百分比税在卖方价格低的地方压低边际收益更少，所以对垄断产量的扭曲更小。（在上面的图里两种都试试。）"))),
                 h(T('Traps', '易错点')),
                 ul(T(r"Using the buyers' price (400) in the profit. The monopolist keeps only 320.", r"用买方价格（400）算利润。垄断者只拿到 320。"),
                    T(r"Writing the percentage tax as $p - 0.25$ or $p + 25$. It multiplies: $1.25p$.", r"把百分比税写成 $p - 0.25$ 或 $p + 25$。它是乘法：$1.25p$。"),
                    T(r"Assuming buyers pay the tax because it is added to their price. Incidence is decided by how far each price moves.", r"以为税加在买方价格上就由买方付。归宿看的是两边价格各动了多少。")),
                 chapter=WIDER_CH()),
            number('try-q', T('Your turn: a 20% tax', '你来：20% 的税'), X,
                   T(r"A monopolist has $MC = 20 + 2Q$ and buyers' demand $p = 200 - Q$. The government adds a 20% tax: buyers pay $1.2p$ when the seller gets $p$. What output does the monopolist choose?",
                     r"垄断者 $MC = 20 + 2Q$，买方需求 $p = 200 - Q$。政府加征 20% 的税：卖方收 $p$ 时买方付 $1.2p$。垄断者选多少产量？"),
                   40, T(r"The seller faces $p = (200 - Q)/1.2$, so $MR = (200 - 2Q)/1.2$. Setting $MR = 20 + 2Q$: $200 - 2Q = 24 + 2.4Q$, so $Q = 40$. The seller gets $160/1.2 \approx 133.33$ and buyers pay 160.",
                         r"卖方面对 $p = (200 - Q)/1.2$，所以 $MR = (200 - 2Q)/1.2$。令 $MR = 20 + 2Q$：$200 - 2Q = 24 + 2.4Q$，得 $Q = 40$。卖方得 $160/1.2 \approx 133.33$，买方付 160。"),
                   tolerance=0.01, hints=[T(r"Write the demand the seller sees: divide the buyers' price by 1.2.", r"写出卖方看到的需求：把买方价格除以 1.2。")], chapter=TRY_CH()),
            number('try-share', T("Your turn: the buyers' share", '你来：买方承担几成'), X,
                   T(r"In the same market, without the tax the monopolist sells 45 at $p = 155$. What percentage of the tax do buyers bear?", r"同一个市场，没有税时垄断者以 $p = 155$ 卖 45 个。买方承担了这道税的百分之几？"),
                   18.75, T(r"Tax per unit $= 160 - 133.33 = 26.67$. Buyers' price rose $160 - 155 = 5$; $5/26.67 = 18.75\%$. The monopolist bears the other 81.25%.", r"每单位税 $= 160 - 133.33 = 26.67$。买方价格涨了 $160 - 155 = 5$；$5/26.67 = 18.75\%$。其余 81.25% 由垄断者承担。"),
                   tolerance=0.3, unit='%'),
            number('try-dwl', T('Your turn: the cost of a monopoly', '你来：垄断的代价'), S,
                   T(r"Demand is $p = 100 - Q$ and marginal cost is constant at 20. What is the deadweight loss of the monopoly, compared with competition?", r"需求 $p = 100 - Q$，边际成本恒为 20。和竞争相比，垄断的无谓损失是多少？"),
                   800, T(r"Monopoly: $100 - 2Q = 20$, $Q = 40$, $p = 60$. Competition: $p = 20$, $Q = 80$. Deadweight loss $= \tfrac12 \times (60 - 20) \times (80 - 40) = 800$.", r"垄断：$100 - 2Q = 20$，$Q = 40$，$p = 60$。竞争：$p = 20$，$Q = 80$。无谓损失 $= \tfrac12 \times (60 - 20) \times (80 - 40) = 800$。"),
                   tolerance=0.5, hints=[T(r"The triangle between demand and $MC$, from the monopoly quantity to the competitive one.", r"需求与 $MC$ 之间、从垄断数量到竞争数量的那个三角形。")]),
        ],
    )


def L_discrimination():
    S3, S2 = 'e15.third', 'e15.second'
    return dict(
        id=f'{CID}-discrimination', title=T('Different prices for different buyers (Q3)', '看人定价（第 3 题）'),
        description=T('When a seller can charge buyers differently, by group (third degree) or by letting them choose from a menu of packages (second degree), and why the high type keeps an information rent.', '卖家什么时候能向不同买家收不同的价：按组别（三级），或者让买家从一份套餐菜单里自己挑（二级），以及为什么高需求类型能留下信息租金。'),
        minutes=50,
        skills=[{'id': S3, 'name': T('Third-degree price discrimination', '三级价格歧视')}, {'id': S2, 'name': T('Second-degree price discrimination (packages)', '二级价格歧视（套餐）')}],
        misconceptions=[{'id': 'full-value', 'description': T('Charging the high type its full value, which makes it switch to the small package', '向高需求类型收取全部价值，结果它改买小套餐')},
                        {'id': 'efficient-low', 'description': T('Giving the low type the quantity where its demand meets MC, ignoring the rent paid to the high type', '给低需求类型 MC 处的有效数量，忽略了要付给高类型的信息租金')}],
        steps=[
            read('question', T('Question 3, as printed', '第 3 题原文'),
                 paper(T('Question 3 · 19 marks', '第 3 题 · 19 分'),
                       T(r"A monopolist sells its output to two types of customers (Type 1 and Type 2). The demand from Type 1 and Type 2 customers are, respectively, $Q_1 = 24 - p_1$ and $Q_2 = 16 - p_2$. The monopolist's total cost function is $C = 6Q$, where $Q$ is the monopolist's total output.",
                         r"某垄断者把产品卖给两类顾客（类型 1 和类型 2）。类型 1 和类型 2 的需求分别为 $Q_1 = 24 - p_1$ 和 $Q_2 = 16 - p_2$。垄断者的总成本函数为 $C = 6Q$，其中 $Q$ 是垄断者的总产量。"),
                       T(r"**a.** Suppose the monopolist can identify which market the customer belongs to and is able to prevent re-sale. Therefore, the monopolist decides to use third-degree price discrimination. Find the monopoly third-degree price discrimination profit maximizing output, price and elasticity of demand for each market and the overall monopoly profit. (8 marks)",
                         r"**a.** 假设垄断者能识别顾客属于哪个市场，并且能阻止转卖。于是垄断者决定实行三级价格歧视。求三级价格歧视下利润最大化时每个市场的产量、价格和需求弹性，以及垄断者的总利润。（8 分）"),
                       T(r"**b.** Now suppose, the monopolist either cannot identify which market the customer belongs to or is unable to prevent re-sale. Therefore, the monopolist decides to use second-degree price discrimination. It decides to do this by offering two package deals: Package 1 is $Q_1$ units of output for a total price of \$$T_1$ that it wants to sell to Type 1 customers. Package 2 is $Q_2$ units of output for a total price of \$$T_2$ that it wants to sell to Type 2 customers. Find the monopoly second-degree price discrimination profit maximizing package output and (total) price for each package and the overall monopoly profit. (11 marks)",
                         r"**b.** 现在假设垄断者要么识别不了顾客属于哪个市场，要么阻止不了转卖。于是它决定实行二级价格歧视，方式是提供两个套餐：套餐 1 是 $Q_1$ 个单位、总价 $T_1$ 美元，想卖给类型 1 顾客；套餐 2 是 $Q_2$ 个单位、总价 $T_2$ 美元，想卖给类型 2 顾客。求二级价格歧视下利润最大化时每个套餐的数量和（总）价格，以及垄断者的总利润。（11 分）")),
                 h(T('Reading it slowly', '慢慢读一遍')),
                 ul(T(r"Two **types** of customers with different demands. Type 1's demand is higher: at every price it wants 8 more units than type 2 (compare $24 - p$ with $16 - p$).", r"两**类**顾客，需求不同。类型 1 的需求更高：在任何价格下都比类型 2 多要 8 个单位（比较 $24 - p$ 和 $16 - p$）。"),
                    T(r"**$C = 6Q$**: every unit costs 6 to make, however many are made. So marginal cost is constant: $MC = 6$.", r"**$C = 6Q$**：每个单位的生产成本都是 6，做多少都一样。所以边际成本是常数：$MC = 6$。"),
                    T(r"In (a) the seller can tell the types apart and stop one type reselling to the other. In (b) it cannot, so it offers two **packages**, each a fixed number of units for a total price, and lets every customer choose.", r"(a) 里卖家分得清两类人，也能阻止一类转卖给另一类。(b) 里做不到，于是它提供两个**套餐**，每个套餐是固定数量、一个总价，让每位顾客自己挑。"),
                    T(r"In (b), read each demand as **one customer** of that type (the usual reading of this question). With many customers of each type the method is the same.", r"(b) 里把每条需求理解成该类型的**一位顾客**（这道题通常的理解）。每类有很多顾客时，方法不变。")),
                 p(T(r"The ideas you need: what price discrimination is and when it is possible; third degree, which is question 2's monopoly applied to each group (a); what a package is worth to a buyer, and how to design a menu that each type sorts itself into (b).", r"需要的想法：价格歧视是什么、什么时候做得到；三级价格歧视，也就是对每一组用第 2 题的垄断方法 (a)；一个套餐对买家值多少，以及怎样设计一份让每类人自己对号入座的菜单 (b)。")),
                 chapter=Q_CH()),
            read('degrees', T('Charging different buyers different prices', '向不同的买家收不同的价'),
                 paper(T('Part (a) · 8 marks', '(a) 小问 · 8 分'), T(r"Suppose the monopolist can identify which market the customer belongs to and is able to prevent re-sale. Therefore, the monopolist decides to use third-degree price discrimination. Find the monopoly third-degree price discrimination profit maximizing output, price and elasticity of demand for each market and the overall monopoly profit.",
                                                                           r"假设垄断者能识别顾客属于哪个市场，并且能阻止转卖。于是垄断者决定实行三级价格歧视。求三级价格歧视下利润最大化时每个市场的产量、价格和需求弹性，以及垄断者的总利润。")),
                 p(T(r"The monopolist of question 2 charged everyone one price. But buyers differ, and one price leaves money on the table: some buyers would have paid more, and some who did not buy would have bought at a lower price. **Price discrimination** means charging different buyers (or different units) different prices. Student discounts, airline fares, bulk discounts and software tiers are all forms of it.",
                     r"第 2 题的垄断者对所有人收同一个价。可买家各不相同，一个价格会把钱留在桌上：有人本来愿意多付，有人在更低的价格下本来会买。**价格歧视**（price discrimination）就是向不同的买家（或不同的单位）收不同的价。学生折扣、机票价格、批量折扣、软件分档，都是它的形式。")),
                 p(T(r"It needs three things: **market power** (a price above cost to play with; a price taker has none), a way to **sort** buyers (by group, or by letting them choose), and **no resale** (otherwise those who buy cheaply sell to those who would pay more).", r"它需要三个条件：**市场势力**（有高于成本的价格空间；价格接受者没有）、能把买家**分开**（按组别，或者让他们自己选），以及**不能转卖**（否则低价买的人会转卖给愿付高价的人）。")),
                 p(T(r"Economists sort it into three degrees by **what the seller knows**:", r"经济学按**卖家知道多少**把它分成三级：")),
                 table([T('Degree', '等级'), T('The seller knows', '卖家知道'), T('So it', '所以它'), T('In this question', '在本题中')],
                       [T('third', '三级'), T("each buyer's group", '每位买家属于哪一组'), T('sets one price per group', '每组一个价'), T('part (a)', '(a) 小问')],
                       [T('second', '二级'), T('that the types exist, but not who is who', '知道有这几类人，但分不清谁是谁'), T('offers a menu and lets buyers pick', '给出菜单，让买家自己挑'), T('part (b)', '(b) 小问')],
                       [T('first', '一级'), T("each buyer's whole demand", '每位买家完整的需求'), T('charges each the most it would pay', '向每个人收他最多愿付的钱'), T('the wider topic', '这类题的全貌')]),
                 chapter=PART('a')),
            read('third', T('Third degree: a separate monopoly in each market', '三级：每个市场各是一个垄断'),
                 p(T(r"If the seller knows who belongs to which group and resale is impossible, the two groups are two separate markets. Because every unit costs 6 whatever happens in the other market, a decision in market 1 does not affect the cost in market 2. So the seller simply treats each market as its own monopoly, exactly as in question 2: $MR_1 = MC$ in market 1 and $MR_2 = MC$ in market 2.",
                     r"如果卖家知道谁属于哪一组，又没法转卖，两组人就是两个分开的市场。因为不管另一个市场怎样，每个单位的成本都是 6，市场 1 的决定不影响市场 2 的成本。所以卖家把每个市场都当成一个单独的垄断来做，和第 2 题一模一样：市场 1 里 $MR_1 = MC$，市场 2 里 $MR_2 = MC$。")),
                 p(T(r"Market 1: inverse demand $p_1 = 24 - Q_1$, so by the rule of question 2 (same intercept, twice the slope) $MR_1 = 24 - 2Q_1$. Market 2: $p_2 = 16 - Q_2$ and $MR_2 = 16 - 2Q_2$.", r"市场 1：反需求 $p_1 = 24 - Q_1$，按第 2 题的规则（截距相同，斜率翻倍）$MR_1 = 24 - 2Q_1$。市场 2：$p_2 = 16 - Q_2$，$MR_2 = 16 - 2Q_2$。")),
                 p(T(r"Which market gets the higher price? The one where buyers react less to the price. That is the Lerner rule of question 2, $\frac{p_i - MC}{p_i} = \frac{1}{|\varepsilon_i|}$: the **less elastic** market gets the **higher** markup. Students and pensioners get discounts because they are more price-sensitive, not because sellers are kind.",
                     r"哪个市场价格更高？买家对价格反应更小的那个。这就是第 2 题的勒纳法则 $\frac{p_i - MC}{p_i} = \frac{1}{|\varepsilon_i|}$：**弹性越小**的市场，加价**越高**。学生和老人能打折，是因为他们对价格更敏感，而不是卖家心善。")),
                 p(T(r"The question also asks for each market's **elasticity**: use question 5's formula $\varepsilon = \frac{dQ}{dp}\cdot\frac{p}{Q}$, evaluated at each market's own price and quantity.", r"题目还要每个市场的**弹性**：用第 5 题的公式 $\varepsilon = \frac{dQ}{dp}\cdot\frac{p}{Q}$，在各自市场的价格和数量处算。"))),
            derive('q3a', T('Part (a), worked', '(a) 小问：完整解法'),
                   [('MR_1 = 24 - 2Q_1 = 6 \\;\\Rightarrow\\; Q_1 = 9', T(r"Market 1 as a monopoly: inverse demand $p_1 = 24 - Q_1$ gives $MR_1 = 24 - 2Q_1$; set it equal to $MC = 6$.", r"把市场 1 当成垄断：反需求 $p_1 = 24 - Q_1$ 给出 $MR_1 = 24 - 2Q_1$；令它等于 $MC = 6$。")),
                    ('p_1 = 24 - 9 = 15', T(r"Type 1's price from its demand curve.", r"类型 1 的价格，从它的需求曲线读。")),
                    ('MR_2 = 16 - 2Q_2 = 6 \\;\\Rightarrow\\; Q_2 = 5', T(r"Market 2 the same way: $p_2 = 16 - Q_2$, so $MR_2 = 16 - 2Q_2$.", r"市场 2 同理：$p_2 = 16 - Q_2$，所以 $MR_2 = 16 - 2Q_2$。")),
                    ('p_2 = 16 - 5 = 11', T(r"Type 2's price from its demand curve.", r"类型 2 的价格，从它的需求曲线读。")),
                    ('\\varepsilon_1 = \\frac{dQ_1}{dp_1}\\cdot\\frac{p_1}{Q_1} = -1 \\times \\frac{15}{9} = -\\frac53', T(r"Elasticity in market 1 at its own point. From $Q_1 = 24 - p_1$ the slope is $-1$.", r"市场 1 在它自己那一点的弹性。由 $Q_1 = 24 - p_1$，斜率为 $-1$。")),
                    ('\\varepsilon_2 = -1 \\times \\frac{11}{5} = -2.2', T(r"Elasticity in market 2. It is more elastic, so it gets the lower price, as the Lerner rule says.", r"市场 2 的弹性。它更有弹性，所以价格更低，正如勒纳法则所说。")),
                    ('\\pi = 9 \\times 9 + 5 \\times 5 = 106', T(r"Profit: in each market, the margin over cost times the quantity, added up. Market 1 earns $15 - 6 = 9$ on each of 9 units, market 2 earns $11 - 6 = 5$ on each of 5.", r"利润：每个市场里，每单位比成本多赚的 × 数量，再相加。市场 1 每个赚 $15 - 6 = 9$、卖 9 个，市场 2 每个赚 $11 - 6 = 5$、卖 5 个。"))],
                   outro=T(r"**Answer:** market 1: $Q_1 = 9$, $p_1 = 15$, $\varepsilon_1 = -5/3$; market 2: $Q_2 = 5$, $p_2 = 11$, $\varepsilon_2 = -2.2$; total profit 106. (Check with Lerner: $\frac{15 - 6}{15} = 0.6 = \frac{1}{5/3}$ and $\frac{11 - 6}{11} \approx 0.455 = \frac{1}{2.2}$.)",
                           r"**答案：** 市场 1：$Q_1 = 9$，$p_1 = 15$，$\varepsilon_1 = -5/3$；市场 2：$Q_2 = 5$，$p_2 = 11$，$\varepsilon_2 = -2.2$；总利润 106。（用勒纳检验：$\frac{15 - 6}{15} = 0.6 = \frac{1}{5/3}$，$\frac{11 - 6}{11} \approx 0.455 = \frac{1}{2.2}$。）"),
                   blank=(4, '-5/3', T(r"The elasticity in market 1: the slope $\frac{dQ_1}{dp_1}$ times $\frac{p_1}{Q_1}$ at $p_1 = 15$, $Q_1 = 9$.", r"市场 1 的弹性：斜率 $\frac{dQ_1}{dp_1}$ 乘以 $p_1 = 15$、$Q_1 = 9$ 处的 $\frac{p_1}{Q_1}$。")), skill=S3),
            read('value', T('What a package is worth to a buyer', '一个套餐对买家值多少'),
                 paper(T('Part (b) · 11 marks', '(b) 小问 · 11 分'), T(r"Now suppose, the monopolist either cannot identify which market the customer belongs to or is unable to prevent re-sale. Therefore, the monopolist decides to use second-degree price discrimination. It decides to do this by offering two package deals: Package 1 is $Q_1$ units of output for a total price of \$$T_1$ that it wants to sell to Type 1 customers. Package 2 is $Q_2$ units of output for a total price of \$$T_2$ that it wants to sell to Type 2 customers. Find the monopoly second-degree price discrimination profit maximizing package output and (total) price for each package and the overall monopoly profit.",
                                                                            r"现在假设垄断者要么识别不了顾客属于哪个市场，要么阻止不了转卖。于是它决定实行二级价格歧视，方式是提供两个套餐：套餐 1 是 $Q_1$ 个单位、总价 $T_1$ 美元，想卖给类型 1 顾客；套餐 2 是 $Q_2$ 个单位、总价 $T_2$ 美元，想卖给类型 2 顾客。求二级价格歧视下利润最大化时每个套餐的数量和（总）价格，以及垄断者的总利润。")),
                 p(T(r"Now the seller cannot tell who is who. It can no longer say *type 1 pays this, type 2 pays that*. What it can do is offer a **menu**: package 1 is $Q_1$ units for a total of $T_1$, package 2 is $Q_2$ units for $T_2$. Every customer looks at the menu and takes whichever is better for them, or nothing. The seller's job is to design the menu so that type 1 *chooses* package 1 and type 2 *chooses* package 2. That is why it is called **screening**, or **self-selection**: the buyers sort themselves.",
                     r"现在卖家分不清谁是谁，不能再说“类型 1 付这个价，类型 2 付那个价”。它能做的，是给出一份**菜单**：套餐 1 是 $Q_1$ 个单位、总价 $T_1$，套餐 2 是 $Q_2$ 个单位、总价 $T_2$。每位顾客看着菜单，挑对自己更好的那个，或者都不买。卖家要设计的，就是让类型 1 *自己选*套餐 1、类型 2 *自己选*套餐 2。所以这叫**筛选**（screening）或**自选择**（self-selection）：买家自己把自己分开。")),
                 p(T(r"To design a menu we need to know what a package is worth to each type. Take type 2, with demand $16 - q$. Its first unit is worth about 16 to it, the second about 15, and so on: each further unit is worth a bit less. The value of a whole package of $q$ units is the sum of those values: the **area under its demand curve** from 0 to $q$ (question 1's idea, demand as a list of values):",
                     r"设计菜单，先得知道一个套餐对每类人值多少。以类型 2 为例，需求是 $16 - q$。第 1 个单位对它值约 16，第 2 个约 15，依此类推：每多一个都更不值钱一点。$q$ 个单位的整个套餐值多少，就是把这些价值加起来：从 0 到 $q$、**需求曲线下的面积**（第 1 题的想法：需求是一串价值）：")),
                 math_(r"V_2(q) = \int_0^q (16 - x)\,dx = 16q - \tfrac12 q^2"),
                 math_(r"V_1(q) = \int_0^q (24 - x)\,dx = 24q - \tfrac12 q^2"),
                 p(T(r"Some values: 2 units are worth $V_2(2) = 32 - 2 = 30$ to type 2; 10 units are worth $V_2(10) = 160 - 50 = 110$. To type 1, 18 units are worth $V_1(18) = 432 - 162 = 270$, and 10 units are worth $V_1(10) = 240 - 50 = 190$.",
                     r"算几个：2 个单位对类型 2 值 $V_2(2) = 32 - 2 = 30$；10 个单位值 $V_2(10) = 160 - 50 = 110$。对类型 1，18 个单位值 $V_1(18) = 432 - 162 = 270$，10 个单位值 $V_1(10) = 240 - 50 = 190$。")),
                 p(T(r"A buyer takes a package of $q$ units at a total price $T$ only if $V(q) \geq T$, and among the packages it takes the one with the largest **surplus** $V(q) - T$. Everything in part (b) follows from these two sentences.", r"买家只有在 $V(q) \geq T$ 时才会买一个 $q$ 个单位、总价 $T$ 的套餐；在几个套餐之间，它挑**剩余** $V(q) - T$ 最大的那个。(b) 小问的一切都从这两句话推出来。")),
                 chapter=PART('b')),
            read('first-try', T('A first try, and why it fails', '先试一个方案，看它为什么不行'),
                 p(T(r"If the seller *could* tell the types apart, it would give each type every unit worth more than its cost of 6, and charge the whole value. Type 1's demand $24 - q$ is above 6 up to $q = 18$; type 2's $16 - q$ up to $q = 10$. So the obvious menu is:", r"如果卖家*分得清*两类人，它会给每类人所有价值高于成本 6 的单位，并收走全部价值。类型 1 的需求 $24 - q$ 在 $q = 18$ 之前都高于 6；类型 2 的 $16 - q$ 在 $q = 10$ 之前高于 6。于是一份显而易见的菜单是：")),
                 ul(T(r"Package 1: 18 units for $V_1(18) = 270$.", r"套餐 1：18 个，卖 $V_1(18) = 270$。"),
                    T(r"Package 2: 10 units for $V_2(10) = 110$.", r"套餐 2：10 个，卖 $V_2(10) = 110$。")),
                 p(T(r"But the seller cannot tell them apart, and every customer may take either package. What does a type 1 customer do? Package 1 gives it $270 - 270 = 0$. Package 2 is worth $V_1(10) = 190$ to it and costs 110: a surplus of **80**. Type 1 takes package 2. The menu fails.",
                     r"可是卖家分不清，每位顾客两个套餐都可以拿。类型 1 顾客会怎么做？套餐 1 给它 $270 - 270 = 0$。套餐 2 对它值 $V_1(10) = 190$，只要 110：剩余 **80**。类型 1 会拿套餐 2。这份菜单失败了。")),
                 quiz(T(r"Package 2 is 10 units for 110. What is it worth to a type 1 customer?", r"套餐 2 是 10 个、卖 110。它对类型 1 顾客值多少？"),
                      [(T(r"190, the area under type 1's demand up to 10 units", r"190，类型 1 的需求曲线下到 10 个单位为止的面积"), True),
                       (T(r"110, its price", r"110，它的价格"), T(r"The price is what it costs; the value comes from the buyer's own demand: $24 \times 10 - \tfrac12 \times 10^2 = 190$.", r"价格是要付的钱；价值来自买家自己的需求：$24 \times 10 - \tfrac12 \times 10^2 = 190$。")),
                       (T(r"270, as package 1 is", r"270，和套餐 1 一样"), T(r"270 is what 18 units are worth to type 1. Package 2 has only 10.", r"270 是 18 个单位对类型 1 的价值。套餐 2 只有 10 个。"))],
                      T(r"Type 1 values every unit 8 more than type 2 does, so 10 units are worth $110 + 8 \times 10 = 190$ to it: a surplus of 80 at the price of 110.", r"类型 1 对每个单位都比类型 2 多估 8，所以 10 个单位对它值 $110 + 8 \times 10 = 190$：按 110 买有 80 的剩余。")),
                 p(T(r"To keep type 1 on package 1, the seller must leave it at least the surplus it could get from package 2: $T_1 = 270 - 80 = 190$. Profit is then $(190 - 108) + (110 - 60) = 132$, where 108 and 60 are the costs of the 18 and 10 units. The 80 handed to type 1 is called an **information rent**: what the seller pays for not knowing who is who.",
                     r"要让类型 1 留在套餐 1，卖家必须至少给它留下它从套餐 2 能得到的剩余：$T_1 = 270 - 80 = 190$。这时利润是 $(190 - 108) + (110 - 60) = 132$，其中 108 和 60 是 18 个和 10 个单位的成本。留给类型 1 的这 80 叫**信息租金**（information rent）：卖家为“分不清谁是谁”付出的代价。"))),
            read('shrink', T('The fix: make the small package smaller', '办法：把小套餐做得更小'),
                 p(T(r"Where does the rent come from? From package 2: type 1 values each unit of it 8 more than type 2 does, so the rent is $V_1(q_2) - V_2(q_2) = 8q_2$. A smaller package 2 is less tempting to type 1, and the rent shrinks.", r"租金从哪来？来自套餐 2：类型 1 对其中每个单位都比类型 2 多估 8，所以租金是 $V_1(q_2) - V_2(q_2) = 8q_2$。套餐 2 越小，对类型 1 的诱惑越小，租金就越少。")),
                 p(T(r"But a smaller package 2 also earns less from type 2. So weigh it unit by unit, at the margin. One more unit in package 2:", r"可是套餐 2 小了，从类型 2 那里赚得也少。所以一个单位一个单位地在边际上权衡。套餐 2 多放一个单位：")),
                 ul(T(r"**earns** its value to type 2 minus its cost: $(16 - q_2) - 6 = 10 - q_2$;", r"**赚到**它对类型 2 的价值减去成本：$(16 - q_2) - 6 = 10 - q_2$；"),
                    T(r"**costs** 8 more of rent that must be left to type 1 in package 1's price.", r"**多付** 8 的租金，要在套餐 1 的价格里让给类型 1。")),
                 p(T(r"Keep adding units while $10 - q_2 > 8$, and stop where they are equal: $q_2 = 2$. The figure shows the trade-off; drag the size of package 2 and watch the profit.", r"只要 $10 - q_2 > 8$ 就继续加，两者相等时停下：$q_2 = 2$。下图展示这个权衡；拖动套餐 2 的大小，看利润怎么变。")),
                 visual('econ_screening', T(r"Drag the size of package 2. Green $T_2$: what type 2 pays. Gold $R$: the rent type 1 must be left. Right: one more unit in package 2 earns $D_2 - MC$ and costs $D_1 - D_2 = 8$ of rent; the profit is highest where the two lines cross.",
                                            r"拖动套餐 2 的大小。绿色 $T_2$：类型 2 付的钱。金色 $R$：必须留给类型 1 的租金。右边：套餐 2 再加一个单位，赚 $D_2 - MC$，多付 $D_1 - D_2 = 8$ 的租金；两条线相交处利润最高。")),
                 p(T(r"And package 1? Making it bigger or smaller does not change the rent (the rent comes from package 2), so it should contain every unit type 1 values above cost: 18. Economists summarise the design in two rules, with two names worth knowing for the exam:", r"那套餐 1 呢？它变大变小都不影响租金（租金来自套餐 2），所以它应包含类型 1 估值高于成本的所有单位：18 个。经济学把这个设计总结成两条规则，有两个名字值得在考试里用：")),
                 ul(T(r"**No distortion at the top**: the high type gets the efficient quantity. **Shrink the bottom**: the low type gets less than its efficient quantity (2 instead of 10), to cut the rent.", r"**顶端不扭曲**（no distortion at the top）：高类型拿有效数量。**底端缩量**：低类型拿得比有效数量少（2 而不是 10），以减少租金。"),
                    T(r"The two binding constraints: type 2 pays its full value, $T_2 = V_2(q_2)$ (its **participation constraint**: it is just willing to buy); type 1 is just indifferent between the packages, $V_1(18) - T_1 = V_1(q_2) - T_2$ (its **incentive compatibility constraint**).", r"两个紧的约束：类型 2 付满它的价值，$T_2 = V_2(q_2)$（它的**参与约束** participation constraint：刚好愿意买）；类型 1 对两个套餐刚好无差异，$V_1(18) - T_1 = V_1(q_2) - T_2$（它的**激励相容约束** incentive compatibility constraint）。"))),
            derive('q3b', T('Part (b), worked', '(b) 小问：完整解法'),
                   [('24 - q_1 = 6 \\;\\Rightarrow\\; q_1 = 18', T(r"Package 1 gets every unit type 1 values above the cost of 6: up to where its demand meets $MC$ (no distortion at the top).", r"套餐 1 包含类型 1 估值高于成本 6 的所有单位：到它的需求与 $MC$ 相交处为止（顶端不扭曲）。")),
                    ('T_2 = V_2(q_2) = 16q_2 - \\tfrac12 q_2^2', T(r"Type 2 pays the whole value of its package, so it is just willing to buy (participation).", r"类型 2 付满它套餐的全部价值，刚好愿意买（参与约束）。")),
                    ('T_1 = V_1(18) - 8q_2 = 270 - 8q_2', T(r"Type 1 must be left the surplus it could get from package 2, $V_1(q_2) - V_2(q_2) = 8q_2$ (incentive compatibility).", r"必须给类型 1 留下它从套餐 2 能得到的剩余，$V_1(q_2) - V_2(q_2) = 8q_2$（激励相容）。")),
                    ('\\pi = (T_1 - 108) + (T_2 - 6q_2)', T(r"Profit from the two packages: each price minus the cost of its units, at 6 per unit (package 1's 18 units cost 108).", r"两个套餐的利润：各自的价格减去其中单位的成本，每个 6（套餐 1 的 18 个单位成本 108）。")),
                    ('\\pi = 162 - 8q_2 + 10q_2 - \\tfrac12 q_2^2', T(r"Put in the two prices and collect terms: package 1 brings $270 - 8q_2 - 108$, package 2 brings $16q_2 - \tfrac12 q_2^2 - 6q_2$.", r"代入两个价格并合并：套餐 1 带来 $270 - 8q_2 - 108$，套餐 2 带来 $16q_2 - \tfrac12 q_2^2 - 6q_2$。")),
                    ('\\frac{d\\pi}{dq_2} = -8 + 10 - q_2 = 0 \\;\\Rightarrow\\; q_2 = 2', T(r"Choose $q_2$ to maximise profit: set the derivative to zero. It reads: one more unit in package 2 costs 8 of rent and earns $10 - q_2$ from type 2.", r"选 $q_2$ 让利润最大：令导数为零。它的意思是：套餐 2 多一个单位，多付 8 的租金，从类型 2 多赚 $10 - q_2$。")),
                    ('T_2 = 32 - 2 = 30, \\quad T_1 = 270 - 16 = 254', T(r"The two total prices, with $q_2 = 2$.", r"代入 $q_2 = 2$，得两个总价。")),
                    ('\\pi = (254 - 108) + (30 - 12) = 164', T(r"Profit: each package's price minus the cost of its units.", r"利润：每个套餐的价格减去其中单位的成本。"))],
                   outro=T(r"**Answer:** package 1 is 18 units for \$254, package 2 is 2 units for \$30, and profit is 164 (one customer of each type).", r"**答案：** 套餐 1 是 18 个、254 美元，套餐 2 是 2 个、30 美元，利润 164（每类一位顾客）。"),
                   blank=(5, '2', T(r"Set the derivative to zero: $-8 + 10 - q_2 = 0$. What is $q_2$?", r"令导数为零：$-8 + 10 - q_2 = 0$。$q_2$ 是多少？")), skill=S2),
            read('check-b', T('Check that each type picks its own package', '检查：每类人都选了自己的套餐'),
                 table([T('Buyer', '买家'), T('Takes package 1', '选套餐 1'), T('Takes package 2', '选套餐 2'), T('Picks', '会选')],
                       [T('Type 1', '类型 1'), '$270 - 254 = 16$', '$46 - 30 = 16$', T('1 (indifferent)', '1（无差异）')],
                       [T('Type 2', '类型 2'), '$128 - 254 < 0$', '$30 - 30 = 0$', '2']),
                 ul(T(r"Type 1 values package 2 at $V_1(2) = 48 - 2 = 46$ and package 1 at $V_1(18) = 270$; type 2 values package 1 at $V_2(16) = 128$ (it would not want more than 16). An indifferent buyer is assumed to take the package meant for it.", r"类型 1 对套餐 2 估值 $V_1(2) = 48 - 2 = 46$，对套餐 1 估值 $V_1(18) = 270$；类型 2 对套餐 1 估值 $V_2(16) = 128$（多于 16 个它也不要）。无差异时，默认买家选为他设计的那个。"),
                    T(r"Selling only to type 1 (18 units for 270) would earn $270 - 108 = 162 < 164$: serving both is better, just.", r"只卖给类型 1（18 个卖 270）赚 $270 - 108 = 162 < 164$：两类都卖更好，但只好一点点。"),
                    T(r"Package 1 costs $254/18 \approx 14.1$ per unit, package 2 costs 15 per unit: a quantity discount. This is how second-degree pricing looks in real life.", r"套餐 1 每单位约 $254/18 \approx 14.1$，套餐 2 每单位 15：数量折扣。这就是现实中二级价格歧视的样子。")),
                 quiz(T(r"Suppose the seller charged type 1 its full value, 270, for package 1. What would happen?", r"假设卖方对套餐 1 收类型 1 的全部价值 270。会发生什么？"),
                      [(T(r"Type 1 would switch to package 2 and keep a surplus of 16 there", r"类型 1 会改买套餐 2，在那里留下 16 的剩余"), True),
                       (T(r"Type 1 would still buy package 1: it is worth 270 to it", r"类型 1 仍会买套餐 1：对它值 270"), T(r"Package 1 would leave it nothing, but package 2 gives it $46 - 30 = 16$. It takes package 2.", r"套餐 1 什么也不给它留，而套餐 2 给它 $46 - 30 = 16$。它会选套餐 2。")),
                       (T(r"Profit would rise to 270 − 108 + 18 = 180", r"利润会升到 270 − 108 + 18 = 180"), T(r"Only if type 1 kept buying package 1, which it does not.", r"前提是类型 1 继续买套餐 1，可它不会。"))],
                      T(r"That is why package 1 must leave type 1 the rent it could get from package 2: $T_1 = 270 - 16 = 254$.", r"这就是为什么套餐 1 必须给类型 1 留下它从套餐 2 能得到的租金：$T_1 = 270 - 16 = 254$。"))),
            read('paper-answer', T('A full-mark answer', '一份满分答案'),
                 paper(T('Question 3 · a full-mark answer', '第 3 题 · 满分答案'),
                       T(r"**a.** $MC = 6$. With third-degree discrimination each market sets $MR_i = MC$. Market 1: $p_1 = 24 - Q_1$, $MR_1 = 24 - 2Q_1 = 6$, so $Q_1 = 9$, $p_1 = 15$, $\varepsilon_1 = \frac{dQ_1}{dp_1}\cdot\frac{p_1}{Q_1} = -1 \times \frac{15}{9} = -\frac53$. Market 2: $MR_2 = 16 - 2Q_2 = 6$, so $Q_2 = 5$, $p_2 = 11$, $\varepsilon_2 = -1 \times \frac{11}{5} = -2.2$. Profit $= (15 - 6)(9) + (11 - 6)(5) = 106$. The more elastic market (2) pays the lower price.",
                         r"**a.** $MC = 6$。三级价格歧视下每个市场 $MR_i = MC$。市场 1：$p_1 = 24 - Q_1$，$MR_1 = 24 - 2Q_1 = 6$，所以 $Q_1 = 9$，$p_1 = 15$，$\varepsilon_1 = \frac{dQ_1}{dp_1}\cdot\frac{p_1}{Q_1} = -1 \times \frac{15}{9} = -\frac53$。市场 2：$MR_2 = 16 - 2Q_2 = 6$，所以 $Q_2 = 5$，$p_2 = 11$，$\varepsilon_2 = -1 \times \frac{11}{5} = -2.2$。利润 $= (15 - 6)(9) + (11 - 6)(5) = 106$。弹性更大的市场 2 价格更低。"),
                       T(r"**b.** Value of $q$ units: $V_1(q) = 24q - \tfrac12 q^2$, $V_2(q) = 16q - \tfrac12 q^2$. Type 2's participation constraint binds: $T_2 = V_2(Q_2)$. Type 1's incentive constraint binds: $T_1 = V_1(Q_1) - [V_1(Q_2) - V_2(Q_2)] = V_1(Q_1) - 8Q_2$. No distortion at the top: $24 - Q_1 = 6$, so $Q_1 = 18$. Profit $= 270 - 8Q_2 - 108 + 16Q_2 - \tfrac12 Q_2^2 - 6Q_2$; $d\pi/dQ_2 = 2 - Q_2 = 0$, so $Q_2 = 2$. $T_2 = 32 - 2 = 30$, $T_1 = 270 - 16 = 254$. Profit $= (254 - 108) + (30 - 12) = 164$.",
                         r"**b.** $q$ 个单位的价值：$V_1(q) = 24q - \tfrac12 q^2$，$V_2(q) = 16q - \tfrac12 q^2$。类型 2 的参与约束是紧的：$T_2 = V_2(Q_2)$。类型 1 的激励约束是紧的：$T_1 = V_1(Q_1) - [V_1(Q_2) - V_2(Q_2)] = V_1(Q_1) - 8Q_2$。顶端不扭曲：$24 - Q_1 = 6$，$Q_1 = 18$。利润 $= 270 - 8Q_2 - 108 + 16Q_2 - \tfrac12 Q_2^2 - 6Q_2$；$d\pi/dQ_2 = 2 - Q_2 = 0$，所以 $Q_2 = 2$。$T_2 = 32 - 2 = 30$，$T_1 = 270 - 16 = 254$。利润 $= (254 - 108) + (30 - 12) = 164$。"),
                       answer=True),
                 p(T(r"Part (b) carries 11 marks, most of them for the two constraints. Name them and write them out before the numbers, as above.", r"(b) 有 11 分，大部分给那两个约束。像上面那样，先写出约束、叫出名字，再代数。")),
                 chapter=PAPER_CH()),
            read('wider', T('First degree, two-part tariffs, and every pricing side by side', '一级价格歧视、两部定价，以及所有定价方式的对比'),
                 p(T(r"**First degree** (perfect discrimination): the seller knows each buyer's whole demand and charges the full value of every unit. Each buyer gets every unit worth more than its cost (type 1: 18 units, type 2: 10), so there is no deadweight loss, but consumer surplus is zero: the seller takes everything. Here: $V_1(18) - 108 = 162$ from type 1 and $V_2(10) - 60 = 50$ from type 2, 212 in all.",
                     r"**一级价格歧视**（完全价格歧视）：卖家知道每个买家完整的需求，每个单位都收满价值。每个买家都拿到所有价值高于成本的单位（类型 1：18 个，类型 2：10 个），所以没有无谓损失，但消费者剩余为零：卖家拿走了一切。本题：类型 1 贡献 $V_1(18) - 108 = 162$，类型 2 贡献 $V_2(10) - 60 = 50$，合计 212。")),
                 p(T(r"**Two-part tariff**: an entry fee plus a price per unit (gyms, theme parks, phone plans). With identical buyers the best design is to set the price per unit at $MC$, so each buyer buys the efficient amount, and take the whole consumer surplus as the fee. With only type 1: price 6, fee $\tfrac12 \times 18 \times (24 - 6) = 162$. With different buyers it runs into the problem of part (b): a fee high enough for type 1 drives type 2 away.",
                     r"**两部定价**（two-part tariff）：入场费加单价（健身房、主题公园、手机套餐）。买家都一样时，最好的设计是把单价定在 $MC$，让每个买家买有效数量，再用入场费拿走全部消费者剩余。只有类型 1 时：单价 6，入场费 $\tfrac12 \times 18 \times (24 - 6) = 162$。买家不同时，它就碰上 (b) 的问题：对类型 1 够高的入场费会把类型 2 赶走。")),
                 table([T('Pricing', '定价方式'), T('The seller knows', '卖家知道'), T('Profit here', '本题利润')],
                       [T('one price for all', '统一价'), T('only total demand', '只知道总需求'), '$98$'],
                       [T('third degree', '三级'), T("each buyer's group", '每位买家的组别'), '$106$'],
                       [T('second degree (packages)', '二级（套餐）'), T('that two types exist', '知道有两类人'), '$164$'],
                       [T('first degree', '一级'), T("each buyer's whole demand", '每位买家完整的需求'), '$212$']),
                 p(T(r"Second degree beats third here not because the seller knows more (it knows less), but because it sells **packages**, all-or-nothing deals that capture most of each buyer's surplus, rather than a price per unit. What stops it reaching 212 is the one thing it does not know: who is who. The gap, $212 - 164 = 48$, is the 16 of rent left to type 1 plus the 32 of profit lost by shrinking package 2.",
                     r"这里二级比三级赚得多，不是因为卖家知道得更多（它知道得更少），而是因为它卖的是**套餐**，要么全买、要么不买，能拿走每个买家大部分的剩余，而不是按单价卖。它到不了 212，差就差在它唯一不知道的那件事：谁是谁。两者之差 $212 - 164 = 48$，就是留给类型 1 的 16 租金，加上缩小套餐 2 少赚的 32。")),
                 details(T('Where the single price 13 comes from', '统一价 13 是怎么来的'),
                         p(T(r"With one price below 16 both types buy, so add the demands: $Q = (24 - p) + (16 - p) = 40 - 2p$, or $p = 20 - Q/2$. Then $MR = 20 - Q = 6$ gives $Q = 14$, $p = 13$ and profit $(13 - 6) \times 14 = 98$. (Selling only to type 1 at its monopoly price 15 earns $9 \times 9 = 81$: less.)",
                             r"价格低于 16 时两类人都买，把需求加起来：$Q = (24 - p) + (16 - p) = 40 - 2p$，即 $p = 20 - Q/2$。$MR = 20 - Q = 6$ 得 $Q = 14$，$p = 13$，利润 $(13 - 6) \times 14 = 98$。（只卖给类型 1、定它的垄断价 15，赚 $9 \times 9 = 81$：更少。）"))),
                 h(T('Traps, and how the question could change', '易错点，以及题目可能怎么变')),
                 ul(T(r"Giving type 2 its efficient amount, 10 units. That ignores the rent the seller pays type 1 for every unit in package 2.", r"给类型 2 有效数量 10 个：忽略了套餐 2 里每个单位都要多付给类型 1 的租金。"),
                    T(r"In third degree, writing the elasticity at the wrong point, or without its sign.", r"三级里在错误的点算弹性，或者丢了负号。"),
                    T(r"**Different numbers of each type** ($n_1$ of type 1, $n_2$ of type 2): one more unit in package 2 earns $n_2(10 - q_2)$ and costs $8n_1$ of rent, so stop where $10 - q_2 = 8\,\tfrac{n_1}{n_2}$. When that pushes $q_2$ to 0, serve only type 1.", r"**两类人数不同**（类型 1 有 $n_1$ 位，类型 2 有 $n_2$ 位）：套餐 2 多一个单位，赚 $n_2(10 - q_2)$，多付 $8n_1$ 的租金，所以停在 $10 - q_2 = 8\,\tfrac{n_1}{n_2}$ 处。如果这使 $q_2$ 变成 0，就只卖给类型 1。"),
                    T(r"**Marginal cost that rises** in third degree: the markets are no longer separate; set $MR_1 = MR_2 = MC(Q_1 + Q_2)$ together.", r"三级里**边际成本递增**：两个市场不再独立；联立 $MR_1 = MR_2 = MC(Q_1 + Q_2)$。")),
                 chapter=WIDER_CH()),
            number('try-third', T('Your turn: third degree', '你来：三级价格歧视'), S3,
                   T(r"Demands are $Q_1 = 30 - p_1$ and $Q_2 = 20 - 2p_2$, and $MC = 4$. With third-degree price discrimination, what is the total profit?", r"需求 $Q_1 = 30 - p_1$、$Q_2 = 20 - 2p_2$，$MC = 4$。三级价格歧视下总利润是多少？"),
                   187, T(r"Market 1: $MR = 30 - 2Q_1 = 4$, so $Q_1 = 13$, $p_1 = 17$. Market 2: $p_2 = 10 - Q_2/2$, $MR = 10 - Q_2 = 4$, so $Q_2 = 6$, $p_2 = 7$. Profit $= 13 \times 13 + 3 \times 6 = 187$.",
                          r"市场 1：$MR = 30 - 2Q_1 = 4$，$Q_1 = 13$，$p_1 = 17$。市场 2：$p_2 = 10 - Q_2/2$，$MR = 10 - Q_2 = 4$，$Q_2 = 6$，$p_2 = 7$。利润 $= 13 \times 13 + 3 \times 6 = 187$。"),
                   tolerance=0.5, hints=[T(r"Write market 2 as inverse demand first: $p_2 = 10 - Q_2/2$.", r"先把市场 2 写成反需求：$p_2 = 10 - Q_2/2$。")], chapter=TRY_CH()),
            number('try-second', T('Your turn: two packages', '你来：两个套餐'), S2,
                   T(r"Type A has demand $20 - q$, type B has $12 - q$, $MC = 2$, one buyer of each. What total price $T_A$ should package A carry?", r"类型 A 需求 $20 - q$，类型 B 需求 $12 - q$，$MC = 2$，每类一位买家。套餐 A 的总价 $T_A$ 应定多少？"),
                   182, T(r"$q_A = 18$ (where $20 - q = 2$). The gap between the demands is 8, so $12 - q_B - 2 = 8$ gives $q_B = 2$ and $T_B = 24 - 2 = 22$. $V_A(18) = 360 - 162 = 198$, so $T_A = 198 - 8 \times 2 = 182$. Profit $= 146 + 18 = 164$.",
                          r"$q_A = 18$（$20 - q = 2$ 处）。两条需求相差 8，$12 - q_B - 2 = 8$ 得 $q_B = 2$，$T_B = 24 - 2 = 22$。$V_A(18) = 360 - 162 = 198$，所以 $T_A = 198 - 8 \times 2 = 182$。利润 $= 146 + 18 = 164$。"),
                   tolerance=0.5, hints=[T(r"First $q_A$ (no distortion at the top), then $q_B$ (shrink the bottom), then the prices.", r"先定 $q_A$（顶端不扭曲），再定 $q_B$（底端缩量），最后定价格。")]),
            number('try-two-part', T('Your turn: a two-part tariff', '你来：两部定价'), S2,
                   T(r"Identical buyers each have demand $p = 30 - q$, and $MC = 10$. With the best two-part tariff, what is the entry fee per buyer?", r"买家都一样，每人需求 $p = 30 - q$，$MC = 10$。最优两部定价下，每人的入场费是多少？"),
                   200, T(r"Price per unit $= MC = 10$, so each buys 20; the fee takes the whole consumer surplus, $\tfrac12 \times 20 \times (30 - 10) = 200$.", r"单价 $= MC = 10$，每人买 20；入场费拿走全部消费者剩余：$\tfrac12 \times 20 \times (30 - 10) = 200$。"),
                   tolerance=0.5),
        ],
    )


def L_cournot():
    S, G = 'e15.cournot', 'e15.games'
    return dict(
        id=f'{CID}-cournot', title=T('Two firms guessing each other (Q4)', '两家厂商互相猜（第 4 题）'),
        description=T("Games and Nash equilibrium, a firm's best reply to its rival's output, how to draw and solve the two replies, and how Cournot compares with a cartel, a leader and competition.", '博弈与纳什均衡，厂商对对手产量的最优反应，怎样画出并解出两条反应函数，以及古诺与卡特尔、领导者、完全竞争的比较。'),
        minutes=45,
        skills=[{'id': S, 'name': T('Cournot competition', '古诺竞争')}, {'id': G, 'name': T('Nash equilibrium', '纳什均衡')}],
        misconceptions=[{'id': 'forget-rival', 'description': T("Leaving the rival's output out of a firm's price when deriving its MR", '推 MR 时忘了价格里还有对手的产量')}],
        steps=[
            read('question', T('Question 4, as printed', '第 4 题原文'),
                 paper(T('Question 4 · 20 marks', '第 4 题 · 20 分'),
                       T(r"Let the market demand be $Q = 500 - 10p$, where $p$ is the market price and $Q$ is the market output. There are two firms in the market (firm 1 has output $q_1$ and firm 2 has output $q_2$). Firm 1 has the marginal cost function: $MC_1 = 0.2q_1 + 2$. Firm 2 has the marginal cost function: $MC_2 = 0.05q_2 + 2$. The two firms are Cournot competitors.",
                         r"设市场需求为 $Q = 500 - 10p$，其中 $p$ 是市场价格，$Q$ 是市场产量。市场上有两家厂商（厂商 1 的产量为 $q_1$，厂商 2 的产量为 $q_2$）。厂商 1 的边际成本函数为 $MC_1 = 0.2q_1 + 2$。厂商 2 的边际成本函数为 $MC_2 = 0.05q_2 + 2$。两家厂商进行古诺竞争。"),
                       T(r"**a.** Define the Cournot reaction function. Find the Cournot reaction function for each firm. (8 marks)", r"**a.** 给出古诺反应函数的定义。求每家厂商的古诺反应函数。（8 分）"),
                       T(r"**b.** Draw the reaction functions for both firms. (Be sure to label which is which and indicate the value of the reaction functions where they cross the axes). (6 marks)", r"**b.** 画出两家厂商的反应函数。（务必标明哪条是哪条，并标出反应函数与坐标轴交点的值。）（6 分）"),
                       T(r"**c.** Find the Cournot (Nash) equilibrium firm outputs and market price $p$. (6 marks)", r"**c.** 求古诺（纳什）均衡时两家厂商的产量和市场价格 $p$。（6 分）")),
                 h(T('Reading it slowly', '慢慢读一遍')),
                 ul(T(r"**Two firms, one market.** They sell the same product, so there is one price, and it depends on the **total** output $Q = q_1 + q_2$: the more both produce together, the lower the price.", r"**两家厂商，一个市场。** 它们卖同样的产品，所以只有一个价格，而且它取决于**总**产量 $Q = q_1 + q_2$：两家一起产得越多，价格越低。"),
                    T(r"**Different costs.** Firm 1's marginal cost rises by 0.2 with each unit, firm 2's by only 0.05: firm 2 can expand more cheaply.", r"**成本不同。** 厂商 1 每多一个单位边际成本涨 0.2，厂商 2 只涨 0.05：厂商 2 扩产更便宜。"),
                    T(r"**Cournot competitors**: each firm chooses **how much to produce**, at the same time as the other, taking the other's output as given. Neither is a price taker (each is big enough to move the price), and neither is a monopolist (the other is there).", r"**古诺竞争**（Cournot competitors）：每家厂商选择**生产多少**，和对方同时决定，并把对方的产量当作给定。谁都不是价格接受者（各自都大到能影响价格），也都不是垄断者（对方在那儿）。")),
                 p(T(r"Part (a) asks first for a **definition**, so the words matter as well as the maths. Part (b) is a drawing, part (c) a calculation. The ideas: what a game and a Nash equilibrium are; a firm's best reply to its rival; and where the two replies meet.", r"(a) 先要一个**定义**，所以文字和数学同样重要。(b) 是画图，(c) 是计算。需要的想法：博弈和纳什均衡是什么；厂商对对手的最优反应；以及两条反应在哪里相交。")),
                 chapter=Q_CH()),
            read('games', T('When your best choice depends on your rival', '当你的最好选择取决于对手'),
                 paper(T('Part (a) · 8 marks', '(a) 小问 · 8 分'), T(r"Define the Cournot reaction function. Find the Cournot reaction function for each firm.", r"给出古诺反应函数的定义。求每家厂商的古诺反应函数。")),
                 p(T(r"In every question so far, a decision-maker faced something that did not react: a market price, or a demand curve. Here firm 1's profit depends on what firm 2 does, and firm 2's on what firm 1 does. Each has to think about the other. Situations like this are called **games**: a set of **players**, the **strategies** each can choose, and the **payoff** each gets from every combination of choices.",
                     r"到目前为止，每道题里做决定的人面对的都是不会回应的东西：一个市场价格，或者一条需求曲线。这里厂商 1 的利润取决于厂商 2 怎么做，厂商 2 的利润也取决于厂商 1。每一方都得考虑对方。这样的局面叫**博弈**（game）：一组**参与者**（players），每人能选的**策略**（strategies），以及每种选择组合下每人得到的**收益**（payoffs）。")),
                 ul(T(r"**Best response**: my best strategy, given what the other player does.", r"**最优反应**（best response）：给定对方怎么做，我的最好策略。"),
                    T(r"**Nash equilibrium**: a choice for each player such that each is a best response to the others'. Nobody gains by changing alone, so once there, nobody moves.", r"**纳什均衡**（Nash equilibrium）：每个参与者各选一个策略，使每人的策略都是对其他人的最优反应。谁单独改变都不会更好，所以到了那里就没人再动。")),
                 p(T(r"A small example. Two identical firms face $p = 120 - Q$ and have no costs. Each can produce 30 (half the monopoly output, as if they had agreed to share it) or 40. Profits are price times own output; for each pair of choices (firm 1's profit, firm 2's profit):",
                     r"一个小例子。两家相同的厂商面对 $p = 120 - Q$，没有成本。每家可以生产 30（垄断产量的一半，好像两家约好平分）或 40。利润 = 价格 × 自己的产量；每种选择组合下（厂商 1 的利润，厂商 2 的利润）：")),
                 table(['', T('Firm 2: 30', '厂商 2：30'), T('Firm 2: 40', '厂商 2：40')],
                       [T('Firm 1: 30', '厂商 1：30'), '$1800,\\ 1800$', '$1500,\\ 2000$'],
                       [T('Firm 1: 40', '厂商 1：40'), '$2000,\\ 1500$', '$1600,\\ 1600$']),
                 quiz(T('What is the Nash equilibrium of this game?', '这个博弈的纳什均衡是什么？'),
                      [(T('Both produce 40 and earn 1600 each', '都生产 40，各赚 1600'), True),
                       (T('Both produce 30 and earn 1800 each', '都生产 30，各赚 1800'), T(r"Both would be better off there, but it is not stable: if the other produces 30, producing 40 earns 2000 instead of 1800.", r"那里两家都更好，可是不稳定：对方生产 30 时，自己生产 40 能赚 2000 而不是 1800。")),
                       (T('One produces 30 and the other 40', '一家生产 30，另一家生产 40'), T(r"The firm producing 30 would rather produce 40 (1600 instead of 1500).", r"生产 30 的那家更想生产 40（1600 而不是 1500）。"))],
                      T(r"Whatever the other does, 40 is better (2000 > 1800 and 1600 > 1500), so both produce 40, although both would earn more at 30. This is the **prisoner's dilemma**, and it is why cartels are hard to keep: each member gains by secretly producing more.",
                        r"不管对方怎么做，40 都更好（2000 > 1800，1600 > 1500），所以两家都生产 40，尽管都生产 30 两家都赚得更多。这就是**囚徒困境**（prisoner's dilemma），也是卡特尔难以维持的原因：每个成员偷偷多生产都能多赚。")),
                 p(T(r"Question 4 is the same kind of game, except that each firm can choose *any* output, not just 30 or 40. So instead of a table, each firm's best response is a formula.", r"第 4 题是同一类博弈，只是每家可以选*任何*产量，而不只是 30 或 40。所以每家的最优反应不再是一张表，而是一个公式。")),
                 chapter=PART('a')),
            read('reaction', T("A firm's best reply to its rival's output", '厂商对对手产量的最优反应'),
                 p(T(r"Write demand as a price: from $Q = 500 - 10p$, $p = 50 - 0.1Q = 50 - 0.1(q_1 + q_2)$. Firm 1's revenue is this price times its own output, $p\,q_1$.", r"把需求写成价格：由 $Q = 500 - 10p$，$p = 50 - 0.1Q = 50 - 0.1(q_1 + q_2)$。厂商 1 的收入是这个价格乘以它自己的产量，$p\,q_1$。")),
                 p(T(r"Now put yourself in firm 1's place and **suppose** firm 2 produces 100. Then the price firm 1 can get is $p = 50 - 0.1(q_1 + 100) = 40 - 0.1q_1$. Firm 1 is like a monopolist on what is left of the demand: same intercept, twice the slope, so $MR_1 = 40 - 0.2q_1$. Setting $MR_1 = MC_1$: $40 - 0.2q_1 = 0.2q_1 + 2$, so $q_1 = 95$.",
                     r"现在站在厂商 1 的位置，**假设**厂商 2 生产 100。那么厂商 1 能卖的价格是 $p = 50 - 0.1(q_1 + 100) = 40 - 0.1q_1$。厂商 1 就像是剩下那部分需求上的垄断者：截距相同，斜率翻倍，$MR_1 = 40 - 0.2q_1$。令 $MR_1 = MC_1$：$40 - 0.2q_1 = 0.2q_1 + 2$，得 $q_1 = 95$。")),
                 p(T(r"Suppose instead firm 2 produces 200. Then $p = 30 - 0.1q_1$, $MR_1 = 30 - 0.2q_1 = 0.2q_1 + 2$, and $q_1 = 70$. The more firm 2 produces, the lower the price firm 1 can get, and the less firm 1 wants to produce.",
                     r"再假设厂商 2 生产 200。那么 $p = 30 - 0.1q_1$，$MR_1 = 30 - 0.2q_1 = 0.2q_1 + 2$，得 $q_1 = 70$。厂商 2 产得越多，厂商 1 能卖的价格越低，厂商 1 就越不想多产。")),
                 p(T(r"Doing this for **every** possible $q_2$ at once gives a formula for firm 1's best output as a function of $q_2$. That function is firm 1's **reaction function** (or best-response function), written $q_1 = R_1(q_2)$. Here is the definition the exam asks for:",
                     r"对**每一个**可能的 $q_2$ 一次做完，就得到一个公式：厂商 1 的最好产量作为 $q_2$ 的函数。这个函数就是厂商 1 的**反应函数**（reaction function，或最优反应函数），记作 $q_1 = R_1(q_2)$。考试要的定义是：")),
                 callout('note', T('Definition', '定义'),
                         T(r"A firm's Cournot **reaction function** gives its profit-maximising output for each output its rival might choose, taking the rival's output as given.", r"一家厂商的古诺**反应函数**，给出对手可能选择的每一个产量下，它利润最大化的产量（把对手的产量当作给定）。")),
                 p(T(r"To find it in general, keep $q_2$ as a letter. Firm 1's revenue is $(50 - 0.1q_1 - 0.1q_2)\,q_1$. Its marginal revenue is the derivative with respect to its **own** output $q_1$, holding $q_2$ fixed (a partial derivative, $\partial/\partial q_1$): $MR_1 = 50 - 0.2q_1 - 0.1q_2$. The rival's output stays in it. Then $MR_1 = MC_1$ solved for $q_1$ is the reaction function.",
                     r"一般地求它，就把 $q_2$ 留成字母。厂商 1 的收入是 $(50 - 0.1q_1 - 0.1q_2)\,q_1$。它的边际收益是对**自己**的产量 $q_1$ 求导，同时保持 $q_2$ 不变（偏导数 $\partial/\partial q_1$）：$MR_1 = 50 - 0.2q_1 - 0.1q_2$。对手的产量留在式子里。然后解 $MR_1 = MC_1$ 求出 $q_1$，就是反应函数。"))),
            derive('q4a', T('Part (a), worked', '(a) 小问：完整解法'),
                   [('p = 50 - 0.1(q_1 + q_2)', T(r"Inverse demand: from $Q = 500 - 10p$, $10p = 500 - Q$, and $Q = q_1 + q_2$.", r"反需求：由 $Q = 500 - 10p$，$10p = 500 - Q$，且 $Q = q_1 + q_2$。")),
                    ('R_1 = p\\,q_1 = 50q_1 - 0.1q_1^2 - 0.1q_1q_2', T(r"Firm 1's revenue: the price times its own output.", r"厂商 1 的收入：价格乘以它自己的产量。")),
                    ('MR_1 = \\frac{\\partial R_1}{\\partial q_1} = 50 - 0.2q_1 - 0.1q_2', T(r"Marginal revenue: differentiate with respect to $q_1$, holding the rival's $q_2$ fixed. The rival's output stays in.", r"边际收益：对 $q_1$ 求导，保持对手的 $q_2$ 不变。对手的产量要留在式子里。")),
                    ('50 - 0.2q_1 - 0.1q_2 = 0.2q_1 + 2', T(r"Firm 1 produces where its marginal revenue equals its marginal cost, $MR_1 = MC_1$:", r"厂商 1 在边际收益等于边际成本处生产，$MR_1 = MC_1$：")),
                    ('0.4q_1 = 48 - 0.1q_2 \\;\\Rightarrow\\; q_1 = 120 - 0.25\\,q_2', T(r"Solve for $q_1$: move the $q_1$ terms to one side, then divide by 0.4. This is firm 1's reaction function $R_1$.", r"解出 $q_1$：把含 $q_1$ 的项移到一边，再除以 0.4。这就是厂商 1 的反应函数 $R_1$。")),
                    ('MR_2 = 50 - 0.1q_1 - 0.2q_2', T(r"Firm 2 the same way: its revenue is $p\,q_2$, differentiated with respect to its own $q_2$ with $q_1$ held fixed.", r"厂商 2 同理：它的收入是 $p\,q_2$，对自己的 $q_2$ 求导，保持 $q_1$ 不变。")),
                    ('50 - 0.1q_1 - 0.2q_2 = 0.05q_2 + 2', T(r"$MR_2 = MC_2$:", r"$MR_2 = MC_2$：")),
                    ('0.25q_2 = 48 - 0.1q_1 \\;\\Rightarrow\\; q_2 = 192 - 0.4\\,q_1', T(r"Solve for $q_2$: firm 2's reaction function $R_2$.", r"解出 $q_2$：厂商 2 的反应函数 $R_2$。"))],
                   outro=T(r"**Answer:** $R_1$: $q_1 = 120 - 0.25\,q_2$; $R_2$: $q_2 = 192 - 0.4\,q_1$. (Check against the examples: $q_2 = 100$ gives $q_1 = 95$, $q_2 = 200$ gives $q_1 = 70$.)", r"**答案：** $R_1$：$q_1 = 120 - 0.25\,q_2$；$R_2$：$q_2 = 192 - 0.4\,q_1$。（和前面的例子核对：$q_2 = 100$ 时 $q_1 = 95$，$q_2 = 200$ 时 $q_1 = 70$。）"),
                   blank=(2, '50 - 0.2*q_1 - 0.1*q_2', T(r"Firm 1's marginal revenue: differentiate $R_1$ with respect to $q_1$, holding $q_2$ fixed (type `q_1` and `q_2`).", r"厂商 1 的边际收益：把 $R_1$ 对 $q_1$ 求导，保持 $q_2$ 不变（输入 `q_1` 和 `q_2`）。"), ['q_1', 'q_2']), skill=S),
            read('draw', T('Drawing the reaction functions', '画出反应函数'),
                 paper(T('Part (b) · 6 marks', '(b) 小问 · 6 分'), T(r"Draw the reaction functions for both firms. (Be sure to label which is which and indicate the value of the reaction functions where they cross the axes).", r"画出两家厂商的反应函数。（务必标明哪条是哪条，并标出反应函数与坐标轴交点的值。）")),
                 ol(T(r"Put $q_1$ on the horizontal axis and $q_2$ on the vertical axis, and label both.", r"横轴 $q_1$，纵轴 $q_2$，两个轴都标上名字。"),
                    T(r"Each reaction function is a straight line, so two points fix it: where it hits each axis. $R_1$: if $q_2 = 0$, $q_1 = 120$; and $q_1 = 0$ when $0.25q_2 = 120$, at $q_2 = 480$. $R_2$: if $q_1 = 0$, $q_2 = 192$; and $q_2 = 0$ when $0.4q_1 = 192$, at $q_1 = 480$.",
                      r"每条反应函数都是直线，两个点就能定下来：它和两轴的交点。$R_1$：$q_2 = 0$ 时 $q_1 = 120$；$0.25q_2 = 120$ 即 $q_2 = 480$ 时 $q_1 = 0$。$R_2$：$q_1 = 0$ 时 $q_2 = 192$；$0.4q_1 = 192$ 即 $q_1 = 480$ 时 $q_2 = 0$。"),
                    T(r"Draw both lines, write which is $R_1$ and which is $R_2$, write the four intercepts, and mark where they cross.", r"画出两条线，标明哪条是 $R_1$、哪条是 $R_2$，写上四个截距，标出交点。")),
                 svg(fig_cournot(), T('In the plane with q1 across and q2 up, R1 runs from (120, 0) to (0, 480) and R2 from (0, 192) to (480, 0). They cross at (80, 160).',
                                     '横轴 q1、纵轴 q2 的平面上，R1 从 (120, 0) 连到 (0, 480)，R2 从 (0, 192) 连到 (480, 0)。两线交于 (80, 160)。'),
                     T(r"$R_1$ is the steep line: it gives $q_1$ (across) for each $q_2$ (up). $R_2$ is the flat one. They cross at the equilibrium of part (c).", r"$R_1$ 是陡的那条：对每个 $q_2$（纵向）给出 $q_1$（横向）。$R_2$ 是平的那条。交点就是 (c) 的均衡。")),
                 p(T(r"Why is $R_1$ the steep one? It tells firm 1's output, measured across, for each output of firm 2, measured up. Firm 1 cuts back by only 0.25 for each unit firm 2 adds, so a big move up the vertical axis gives a small move across: a steep line. Drawing $R_1$ as if it gave $q_2$ is a common way to lose these marks.",
                     r"为什么 $R_1$ 是陡的那条？它给出的是厂商 1 的产量（横向量），对应厂商 2 的每个产量（纵向量）。厂商 2 每多一个，厂商 1 只减 0.25，所以纵轴上走一大步，横向只走一小步：一条陡线。把 $R_1$ 当成给出 $q_2$ 的函数来画，是这几分最常丢的方式。")),
                 chapter=PART('b')),
            read('nash', T('Where both are replying best: the crossing', '双方都在最优反应的地方：交点'),
                 paper(T('Part (c) · 6 marks', '(c) 小问 · 6 分'), T(r"Find the Cournot (Nash) equilibrium firm outputs and market price $p$.", r"求古诺（纳什）均衡时两家厂商的产量和市场价格 $p$。")),
                 p(T(r"A Nash equilibrium is a pair of outputs where **each** firm's output is its best reply to the other's. On the diagram, firm 1 is replying best only on $R_1$, firm 2 only on $R_2$. Both at once: where the two lines cross. In maths: solve the two reaction functions together.",
                     r"纳什均衡是一对产量，使**每一家**的产量都是对对方产量的最优反应。在图上，厂商 1 只有在 $R_1$ 上才是最优反应，厂商 2 只有在 $R_2$ 上。两者同时成立：两条线的交点。用数学说：把两条反应函数联立求解。")),
                 p(T(r"Why would the firms end up there? Imagine they start anywhere and take turns replying. Firm 1 moves across to its best reply on $R_1$, then firm 2 moves up or down to its best reply on $R_2$, and so on. Each round brings them closer to the crossing. Drag the starting point and watch:",
                     r"为什么两家会走到那里？想象它们从任意一点出发，轮流回应。厂商 1 横着走到 $R_1$ 上它的最优反应，然后厂商 2 竖着走到 $R_2$ 上它的最优反应，如此反复。每一轮都离交点更近。拖动起点看看：")),
                 visual('econ_cournot', T(r"Drag the starting outputs (the purple dot). Firm 1 replies first (a move across to $R_1$), then firm 2 (a move up or down to $R_2$), and so on: from anywhere, the replies close in on $(80, 160)$, the one point where both are already replying best.",
                                          r"拖动起始产量（紫色点）。厂商 1 先回应（横着走到 $R_1$），然后厂商 2（竖着走到 $R_2$），如此反复：不管从哪出发，回应都会逼近 $(80, 160)$，也就是双方都已经在做最优反应的那一点。")),
                 p(T(r"Each round shrinks the distance to the crossing to $0.25 \times 0.4 = 0.1$ of what it was (the product of the two slopes), which is why the path closes in so fast.", r"每一轮，离交点的距离缩小为原来的 $0.25 \times 0.4 = 0.1$（两条斜率之积），所以路径收敛得这么快。")),
                 chapter=PART('c')),
            derive('q4c', T('Part (c), worked', '(c) 小问：完整解法'),
                   [('q_1 = 120 - 0.25(192 - 0.4\\,q_1)', T(r"Both reaction functions hold at once. Put firm 2's reaction function into firm 1's:", r"两条反应函数同时成立。把厂商 2 的反应函数代进厂商 1 的：")),
                    ('q_1 = 120 - 48 + 0.1\\,q_1 = 72 + 0.1\\,q_1', T(r"Multiply out the bracket: $0.25 \times 192 = 48$ and $0.25 \times 0.4 = 0.1$.", r"展开括号：$0.25 \times 192 = 48$，$0.25 \times 0.4 = 0.1$。")),
                    ('0.9\\,q_1 = 72 \\;\\Rightarrow\\; q_1 = 80', T(r"Collect the $q_1$ terms and solve.", r"把含 $q_1$ 的项合并，解出来。")),
                    ('q_2 = 192 - 0.4 \\times 80 = 160', T(r"Put $q_1 = 80$ back into firm 2's reaction function.", r"把 $q_1 = 80$ 代回厂商 2 的反应函数。")),
                    ('p = 50 - 0.1 \\times (80 + 160) = 26', T(r"The market price from the total output, $Q = 240$ (or from $240 = 500 - 10p$).", r"由总产量 $Q = 240$ 得市场价格（或由 $240 = 500 - 10p$）。"))],
                   outro=T(r"**Answer:** $q_1 = 80$, $q_2 = 160$, $p = 26$.", r"**答案：** $q_1 = 80$，$q_2 = 160$，$p = 26$。"),
                   blank=(3, '160', T(r"Firm 2's output: put $q_1 = 80$ into $R_2$.", r"厂商 2 的产量：把 $q_1 = 80$ 代进 $R_2$。")), skill=S),
            read('check', T('Check, and why firm 2 makes more', '自检，以及为什么厂商 2 做得多'),
                 ul(T(r"At the answer each firm must satisfy its own $MR = MC$. Firm 1: $MR_1 = 50 - 16 - 16 = 18$ and $MC_1 = 0.2 \times 80 + 2 = 18$. Firm 2: $MR_2 = 50 - 8 - 32 = 10$ and $MC_2 = 0.05 \times 160 + 2 = 10$. Both hold.", r"答案处每家都要满足自己的 $MR = MC$。厂商 1：$MR_1 = 50 - 16 - 16 = 18$，$MC_1 = 0.2 \times 80 + 2 = 18$。厂商 2：$MR_2 = 50 - 8 - 32 = 10$，$MC_2 = 0.05 \times 160 + 2 = 10$。都成立。"),
                    T(r"Firm 2's marginal cost rises four times more slowly than firm 1's, so expanding is cheaper for it: it produces twice as much.", r"厂商 2 的边际成本上升得比厂商 1 慢四倍，扩产对它更便宜：所以它的产量是厂商 1 的两倍。"),
                    T(r"Profits, if there are no fixed costs (total cost $0.1q_1^2 + 2q_1$ and $0.025q_2^2 + 2q_2$): firm 1 earns $26 \times 80 - 800 = 1280$, firm 2 earns $26 \times 160 - 960 = 3200$.", r"利润（假设没有固定成本，总成本为 $0.1q_1^2 + 2q_1$ 和 $0.025q_2^2 + 2q_2$）：厂商 1 赚 $26 \times 80 - 800 = 1280$，厂商 2 赚 $26 \times 160 - 960 = 3200$。"))),
            read('paper-answer', T('A full-mark answer', '一份满分答案'),
                 paper(T('Question 4 · a full-mark answer', '第 4 题 · 满分答案'),
                       T(r"**a.** A firm's Cournot reaction function gives its profit-maximising output for each output of its rival, taking the rival's output as given. Inverse demand: $p = 50 - 0.1(q_1 + q_2)$. Firm 1: $TR_1 = 50q_1 - 0.1q_1^2 - 0.1q_1q_2$, $MR_1 = 50 - 0.2q_1 - 0.1q_2$. $MR_1 = MC_1$: $50 - 0.2q_1 - 0.1q_2 = 0.2q_1 + 2$, so $q_1 = 120 - 0.25q_2$. Firm 2: $MR_2 = 50 - 0.1q_1 - 0.2q_2 = 0.05q_2 + 2$, so $q_2 = 192 - 0.4q_1$.",
                         r"**a.** 一家厂商的古诺反应函数给出：对手每一个产量下，它利润最大化的产量（把对手的产量当作给定）。反需求：$p = 50 - 0.1(q_1 + q_2)$。厂商 1：$TR_1 = 50q_1 - 0.1q_1^2 - 0.1q_1q_2$，$MR_1 = 50 - 0.2q_1 - 0.1q_2$。$MR_1 = MC_1$：$50 - 0.2q_1 - 0.1q_2 = 0.2q_1 + 2$，所以 $q_1 = 120 - 0.25q_2$。厂商 2：$MR_2 = 50 - 0.1q_1 - 0.2q_2 = 0.05q_2 + 2$，所以 $q_2 = 192 - 0.4q_1$。"),
                       T(r"**b.** (Diagram with $q_1$ on the horizontal axis and $q_2$ on the vertical.) $R_1$ is a straight line from $(120, 0)$ to $(0, 480)$; $R_2$ from $(0, 192)$ to $(480, 0)$. Both labelled; they cross at $(80, 160)$.",
                         r"**b.** （画图：横轴 $q_1$，纵轴 $q_2$。）$R_1$ 是从 $(120, 0)$ 到 $(0, 480)$ 的直线；$R_2$ 从 $(0, 192)$ 到 $(480, 0)$。两条线都标名；交于 $(80, 160)$。"),
                       T(r"**c.** Solving the reaction functions together: $q_1 = 120 - 0.25(192 - 0.4q_1) = 72 + 0.1q_1$, so $q_1 = 80$ and $q_2 = 192 - 0.4(80) = 160$. $Q = 240$ and $p = 50 - 0.1(240) = 26$.",
                         r"**c.** 联立两条反应函数：$q_1 = 120 - 0.25(192 - 0.4q_1) = 72 + 0.1q_1$，所以 $q_1 = 80$，$q_2 = 192 - 0.4(80) = 160$。$Q = 240$，$p = 50 - 0.1(240) = 26$。"),
                       answer=True),
                 p(T(r"The definition in (a) earns marks on its own: write it in words before any algebra. In (b) the marks are for the labels: which line is which, the four intercepts and the crossing point.", r"(a) 里的定义本身就有分：先用文字写出来，再做代数。(b) 的分给标注：哪条线是哪条、四个截距和交点。")),
                 chapter=PAPER_CH()),
            read('compare', T('Cournot among the other ways two firms can compete', '古诺与两家厂商的其他竞争方式'),
                 p(T(r"Cournot is one way two firms can behave. With question 4's own demand and costs, here is how it compares with three others:", r"古诺只是两家厂商行为的一种方式。用第 4 题自己的需求和成本，把它和另外三种比一比：")),
                 table([T('Structure', '结构'), T('How', '怎么做'), '$q_1$', '$q_2$', '$p$'],
                       [T('Cartel', '卡特尔'), T('maximise joint profit: $MR$ of the total $= MC_1 = MC_2$', '最大化联合利润：总量的 $MR = MC_1 = MC_2$'), '$40$', '$160$', '$30$'],
                       [T('Stackelberg (firm 1 leads)', '斯塔克尔伯格（厂商 1 先动）'), T('firm 1 puts $R_2$ into its own price, then maximises', '厂商 1 把 $R_2$ 代进自己的价格，再求最大'), '$90$', '$156$', '$25.4$'],
                       [T('Cournot', '古诺'), T('both best-respond at once', '双方同时最优反应'), '$80$', '$160$', '$26$'],
                       [T('Competition', '完全竞争'), T('each sets $p = MC$', '每家都 $p = MC$'), '$68.6$', '$274.3$', '$15.7$']),
                 ul(T(r"**Cartel**: the firms agree to act as one monopolist and split the profit. Total output is lowest and the price highest (joint profit 4,800 against Cournot's 4,480). But each firm gains by secretly producing more than agreed: the prisoner's dilemma from the start of this lesson.", r"**卡特尔**（cartel）：两家约定像一个垄断者那样行动、再分利润。总产量最低、价格最高（联合利润 4,800，古诺是 4,480）。但每家偷偷多产都能多赚：就是本课开头的囚徒困境。"),
                    T(r"**Stackelberg**: one firm (the leader) commits to its output first, knowing the follower will then best-respond. So the leader puts the follower's reaction function into its own price: $p = 50 - 0.1(q_1 + 192 - 0.4q_1) = 30.8 - 0.06q_1$. Then $MR = 30.8 - 0.12q_1 = 0.2q_1 + 2$ gives $q_1 = 90$, and the follower replies $q_2 = 192 - 36 = 156$. Moving first pays: the leader produces more and earns more (1,296 against 1,280).", r"**斯塔克尔伯格**（Stackelberg）：一家（领导者）先承诺产量，并且知道跟随者随后会做最优反应。所以领导者把跟随者的反应函数代进自己的价格：$p = 50 - 0.1(q_1 + 192 - 0.4q_1) = 30.8 - 0.06q_1$。于是 $MR = 30.8 - 0.12q_1 = 0.2q_1 + 2$，得 $q_1 = 90$，跟随者回应 $q_2 = 192 - 36 = 156$。先动有利：领导者产得更多、赚得更多（1,296 对 1,280）。"),
                    T(r"**Competition**: each firm behaves as a price taker, $p = MC_1 = MC_2$. Output is largest and the price lowest.", r"**完全竞争**：每家都当价格接受者，$p = MC_1 = MC_2$。产量最大，价格最低。"),
                    T(r"**Bertrand** (firms choose prices, identical goods, equal constant costs): each undercuts the other until $p = MC$, so two firms are enough for the competitive price. Whether firms compete in quantities or prices changes the answer completely.", r"**伯特兰**（Bertrand，厂商选价格、产品相同、成本相同且不变）：互相压价，直到 $p = MC$；两家就足以达到竞争价格。厂商是比产量还是比价格，答案完全不同。"),
                    T(r"As the number of Cournot firms grows, the outcome moves from monopoly toward competition.", r"古诺厂商越多，结果就越从垄断走向竞争。")),
                 h(T('Traps', '易错点')),
                 ul(T(r"Dropping $q_2$ from firm 1's price before differentiating: $MR_1$ must be $50 - 0.2q_1 - 0.1q_2$.", r"求导前把 $q_2$ 从厂商 1 的价格里丢了：$MR_1$ 必须是 $50 - 0.2q_1 - 0.1q_2$。"),
                    T(r"Drawing $R_1$ as if it gave $q_2$: it gives $q_1$, so it is the steep line in the $(q_1, q_2)$ plane.", r"把 $R_1$ 当成给出 $q_2$ 的函数来画：它给的是 $q_1$，在 $(q_1, q_2)$ 平面里是陡的那条。"),
                    T(r"Forgetting the price in part (c): the question asks for it too.", r"(c) 问忘了算价格：题目也要价格。")),
                 chapter=WIDER_CH()),
            number('try', T('Your turn: unequal costs', '你来：成本不同'), S,
                   T(r"Demand is $p = 100 - (q_1 + q_2)$, $MC_1 = 10$ and $MC_2 = 20$. What is $q_1$ in the Cournot equilibrium? (Two decimals.)", r"需求 $p = 100 - (q_1 + q_2)$，$MC_1 = 10$，$MC_2 = 20$。古诺均衡里 $q_1$ 是多少？（保留两位小数。）"),
                   33.33, T(r"$R_1$: $100 - 2q_1 - q_2 = 10$, so $q_1 = 45 - q_2/2$. $R_2$: $100 - q_1 - 2q_2 = 20$, so $q_2 = 40 - q_1/2$. Then $q_1 = 25 + q_1/4$, $q_1 = 33.33$, $q_2 = 23.33$, $p = 43.33$.",
                            r"$R_1$：$100 - 2q_1 - q_2 = 10$，$q_1 = 45 - q_2/2$。$R_2$：$100 - q_1 - 2q_2 = 20$，$q_2 = 40 - q_1/2$。于是 $q_1 = 25 + q_1/4$，$q_1 = 33.33$，$q_2 = 23.33$，$p = 43.33$。"),
                   tolerance=0.02, hints=[T(r"Write both reaction functions, then substitute one into the other.", r"写出两条反应函数，再把一条代进另一条。")], chapter=TRY_CH()),
            number('try-leader', T('Your turn: a leader', '你来：领导者'), S,
                   T(r"Demand $p = 100 - (q_1 + q_2)$, both firms have $MC = 10$, and firm 1 chooses first (Stackelberg). What is $q_1$?", r"需求 $p = 100 - (q_1 + q_2)$，两家 $MC = 10$，厂商 1 先选（斯塔克尔伯格）。$q_1$ 是多少？"),
                   45, T(r"Follower: $q_2 = 45 - q_1/2$. Leader faces $p = 100 - q_1 - 45 + q_1/2 = 55 - q_1/2$, so $MR = 55 - q_1 = 10$ and $q_1 = 45$ ($q_2 = 22.5$, $p = 32.5$). In Cournot each would make 30.",
                         r"跟随者：$q_2 = 45 - q_1/2$。领导者面对 $p = 100 - q_1 - 45 + q_1/2 = 55 - q_1/2$，$MR = 55 - q_1 = 10$，$q_1 = 45$（$q_2 = 22.5$，$p = 32.5$）。古诺下每家各产 30。"),
                   tolerance=0.1, hints=[T(r"Put the follower's reaction function into the leader's price first.", r"先把跟随者的反应函数代进领导者的价格。")]),
            number('try-nash', T('Your turn: a best response', '你来：最优反应'), G,
                   T(r"In the 30-or-40 game at the start of this lesson, firm 2 produces 30. How much does firm 1 earn by playing its best response?", r"在本课开头那个 30 或 40 的博弈里，厂商 2 生产 30。厂商 1 做最优反应能赚多少？"),
                   2000, T(r"Against 30, producing 40 earns $40 \times (120 - 70) = 2000$, more than $30 \times 60 = 1800$.", r"对方生产 30 时，自己生产 40 赚 $40 \times (120 - 70) = 2000$，比 $30 \times 60 = 1800$ 多。"),
                   tolerance=0.5),
        ],
    )


def L_malthus():
    S = 'e15.malthus'
    return dict(
        id=f'{CID}-malthus', title=T('The Malthusian trap (Q6)', '马尔萨斯陷阱（第 6 题）'),
        description=T('Diminishing returns, income per person as the slope of a ray, why population returns to the same point after a wave of immigrants, and what to draw and write for the marks.', '边际收益递减，人均收入是一条射线的斜率，为什么一波移民之后人口会回到原处，以及为拿分要画什么、写什么。'),
        minutes=30,
        skills=[{'id': S, 'name': T('The Malthusian model', '马尔萨斯模型')}],
        misconceptions=[{'id': 'more-output-richer', 'description': T('Thinking that more total output means a higher standard of living', '以为总产出多了，生活水平就高了')}],
        steps=[
            read('question', T('Question 6, as printed', '第 6 题原文'),
                 paper(T('Question 6 · 12 marks', '第 6 题 · 12 分'),
                       T(r"Let the economy's production function be $Y = Af(N, K)$ where $Y$ is real GDP, $N$ is the population (and labour), $K$ is the stock of capital, $A$ is a measure of the state of technology, and $f$ is the production function for the economy. (We make no distinction between labour and population $N$ and so standard of living and labour productivity are the same: $\frac{Y}{N}$.)",
                         r"设经济的生产函数为 $Y = Af(N, K)$，其中 $Y$ 是实际 GDP，$N$ 是人口（也是劳动力），$K$ 是资本存量，$A$ 衡量技术水平，$f$ 是经济的生产函数。（我们不区分劳动力和人口 $N$，所以生活水平和劳动生产率是一回事：$\frac{Y}{N}$。）"),
                       T(r"Suppose the relationship between real GDP ($Y$) and population ($N$) (for a given stock of capital and state of technology) is shown in the diagram below. [Figure 1]", r"假设实际 GDP（$Y$）与人口（$N$）之间的关系（在资本存量和技术水平给定时）如下图所示。[图 1]"),
                       T(r"**a.** Suppose this economy is in a Malthusian world. Show the Malthusian equilibrium output and population - put your answer in the diagram above. Note: there are no numbers here, just make up an equilibrium, but show it correctly on the diagram. (4 marks)", r"**a.** 假设这个经济处于马尔萨斯世界。在上面的图中标出马尔萨斯均衡的产出和人口。注意：这里没有数字，自己设一个均衡即可，但要在图上正确地表示出来。（4 分）"),
                       T(r"**b.** But now there is a large number of immigrants that enter the country. Show this on the diagram on the next page and explain in the box on the next page what is happening using the Malthusian explanation. (8 marks)", r"**b.** 现在有大量移民进入这个国家。在下一页的图上表示出来，并在下一页的答题框里用马尔萨斯的解释说明发生了什么。（8 分）")),
                 svg(fig_malthus_curve(), T('Figure 1, redrawn: output Y rises with population N, quickly at first and then more and more slowly.', '图 1（重画）：产出 Y 随人口 N 上升，开始快，后来越来越慢。'),
                     T(r"Figure 1, redrawn: output against population, with capital and technology fixed.", r"图 1（重画）：资本和技术固定时，产出与人口的关系。")),
                 h(T('Reading it slowly', '慢慢读一遍')),
                 ul(T(r"This is **macroeconomics**: a whole economy, over a very long time (think centuries before the industrial revolution), rather than one market.", r"这是**宏观经济学**：一整个经济体，跨越很长的时间（想象工业革命之前的几百年），而不是一个市场。"),
                    T(r"**$Y = Af(N, K)$**: total output depends on the number of people working, $N$, the capital (and land) they work with, $K$, and the technology $A$, which multiplies everything.", r"**$Y = Af(N, K)$**：总产出取决于干活的人数 $N$、他们用的资本（和土地）$K$，以及技术 $A$，技术把一切都乘上一个倍数。"),
                    T(r"**$Y/N$**, output per person, is the **standard of living**: how much each person has.", r"**$Y/N$**，人均产出，就是**生活水平**：每个人能分到多少。"),
                    T(r"The figure holds $K$ and $A$ fixed and shows how $Y$ changes as $N$ changes. The question gives no numbers: the answer is a drawing and an explanation.", r"图里 $K$ 和 $A$ 固定，只看 $N$ 变化时 $Y$ 怎么变。题目没有数字：答案是一张图加一段解释。")),
                 p(T(r"The ideas you need: why the curve bends (diminishing returns); how to see $Y/N$ on the diagram; and Malthus's rule for how population responds to living standards. With those, both parts are a matter of drawing the right line and telling the story in the right order.", r"需要的想法：曲线为什么会弯（边际收益递减）；怎样在图上看出 $Y/N$；以及马尔萨斯关于人口怎样随生活水平变化的规则。有了这些，两个小问就是画对一条线、按对顺序讲好一个故事。")),
                 chapter=Q_CH()),
            read('returns', T('More people on the same land: diminishing returns', '同一块地上人越来越多：边际收益递减'),
                 paper(T('Part (a) · 4 marks', '(a) 小问 · 4 分'), T(r"Suppose this economy is in a Malthusian world. Show the Malthusian equilibrium output and population - put your answer in the diagram above. Note: there are no numbers here, just make up an equilibrium, but show it correctly on the diagram.", r"假设这个经济处于马尔萨斯世界。在上面的图中标出马尔萨斯均衡的产出和人口。注意：这里没有数字，自己设一个均衡即可，但要在图上正确地表示出来。")),
                 p(T(r"Picture a farming village with a fixed amount of land and tools. The first few workers produce a lot: there is plenty of land for each. Add more workers and output keeps rising, but each new worker adds less than the one before, because the land is shared among more hands. This is **diminishing returns to labour**: with $K$ and $A$ fixed, each extra person adds less output.",
                     r"想象一个农村，土地和工具的数量是固定的。最初几个劳动力产出很多：每人都有大片的地。再加人，产出还在涨，但每个新来的人增加的都比上一个少，因为同样的地被更多双手分着种。这就是**劳动的边际收益递减**（diminishing returns to labour）：$K$ 和 $A$ 不变时，每多一个人增加的产出越来越少。")),
                 p(T(r"On the diagram, the extra output from one more person is the **slope** of the curve. Diminishing returns means the slope keeps falling: the curve rises but bends over. That is the shape of Figure 1 (mathematically, $f$ is concave in $N$).", r"在图上，多一个人带来的额外产出就是曲线的**斜率**。边际收益递减意味着斜率越来越小：曲线在升，但越来越弯。这就是图 1 的形状（用数学说，$f$ 对 $N$ 是凹的）。")),
                 p(T(r"Better technology (higher $A$) or more capital or land lifts the whole curve: every number of people produces more.", r"技术进步（$A$ 提高），或者资本、土地增加，会把整条曲线往上抬：同样的人数能产出更多。")),
                 chapter=PART('a')),
            read('slope', T('Income per person is a slope', '人均收入就是一条斜率'),
                 p(T(r"The question is about the standard of living, $Y/N$, but the diagram shows $Y$ and $N$. How do you see $Y/N$ on it? Take any point $(N, Y)$ on the curve and draw a straight line from the origin to it. The slope of that line is rise over run: $Y/N$. **Income per person is the slope of the ray from the origin.**",
                     r"题目问的是生活水平 $Y/N$，可图上画的是 $Y$ 和 $N$。怎么在图上看出 $Y/N$？在曲线上任取一点 $(N, Y)$，从原点画一条直线连到它。这条线的斜率是“纵向变化 ÷ 横向变化”：$Y/N$。**人均收入就是从原点出发的射线的斜率。**")),
                 p(T(r"Now move right along the curve. Because the curve bends over, the rays to points further right get **flatter**: more people, less each. Total output rises, but output per person falls. This one picture is the heart of the whole question.", r"现在沿曲线往右走。因为曲线越来越弯，连到更右边的点的射线就越来越**平**：人越多，每人分得越少。总产出在涨，人均产出在降。这一张图就是整道题的核心。")),
                 quiz(T(r"Two points on the curve: at the second, there are more people and more total output. What do you know about the standard of living there?", r"曲线上有两点：第二点人更多、总产出也更多。那里的生活水平怎样？"),
                      [(T(r"It is lower: the ray to it is flatter, because each extra person added less than the average", r"更低：连到它的射线更平，因为每多一个人增加的都低于平均"), True),
                       (T(r"It is higher: there is more output", r"更高：产出更多"), T(r"More output shared among even more people. Look at the slope of the ray, not the height of the point.", r"更多的产出，被更多的人分。看射线的斜率，而不是点的高度。")),
                       (T(r"The same: output and population rose together", r"一样：产出和人口一起涨了"), T(r"They rose, but not in proportion: with diminishing returns output rises less than population.", r"一起涨了，但不成比例：边际收益递减时，产出涨得比人口慢。"))],
                      T(r"With diminishing returns, each extra person adds less than the current average, which pulls the average, $Y/N$, down (the same logic as average and marginal cost in question 5).", r"边际收益递减时，每多一个人增加的产出低于当前平均，于是把平均（$Y/N$）拉低（和第 5 题平均成本与边际成本的道理一样）。"))),
            read('rule', T("Malthus's rule: population follows living standards", '马尔萨斯的规则：人口跟着生活水平走'),
                 p(T(r"Thomas Malthus (1798) added a rule for how population moves. There is a **subsistence** level of income, $y^*$: just enough for the population to replace itself.", r"托马斯·马尔萨斯（1798）加了一条人口怎么变的规则。存在一个**生存水平**（subsistence）的收入 $y^*$：刚好够人口维持自身的更替。")),
                 ul(T(r"If income per person is **above** $y^*$, people eat better, marry earlier, more children survive: births exceed deaths and the population **grows**.", r"人均收入**高于** $y^*$ 时，人们吃得更好、结婚更早、更多孩子活下来：出生多于死亡，人口**增长**。"),
                    T(r"If it is **below** $y^*$, hunger and disease raise deaths and reduce births: the population **shrinks**.", r"**低于** $y^*$ 时，饥饿和疾病让死亡增加、出生减少：人口**减少**。"),
                    T(r"Only when it **equals** $y^*$ do births equal deaths, and the population stays put.", r"只有**等于** $y^*$ 时，出生才等于死亡，人口才不再变。")),
                 p(T(r"On the diagram, income per person equals $y^*$ on the ray from the origin with **slope $y^*$**. The economy settles where that ray meets the production curve: population $N^*$, output $Y^*$. That point is the **Malthusian equilibrium**.", r"在图上，人均收入等于 $y^*$ 的点都在一条从原点出发、**斜率为 $y^*$** 的射线上。经济停在这条射线与生产曲线的交点：人口 $N^*$、产出 $Y^*$。这一点就是**马尔萨斯均衡**（Malthusian equilibrium）。")),
                 p(T(r"It is **stable**. To the left of $N^*$ the curve is above the ray: income per person is above subsistence, so the population grows toward $N^*$. To the right the curve is below the ray: income is below subsistence, so the population shrinks toward $N^*$. From either side, it comes back.", r"它是**稳定**的。$N^*$ 左边曲线在射线上方：人均收入高于生存水平，人口增长，向 $N^*$ 靠拢。右边曲线在射线下方：收入低于生存水平，人口减少，也向 $N^*$ 靠拢。从哪一边出发，都会回来。")),
                 visual('econ_malthus', T(r"The scene plays a wave of immigrants, then a better technology. Then drag the population along the curve: the gold ray's slope is income per person, and the arrow shows where the population heads. Raise the technology $A$: the population grows until income per person is back at $y^*$.",
                                          r"画面先演一波移民，再演一次技术进步。然后沿曲线拖动人口：金色射线的斜率就是人均收入，箭头指向人口要去的方向。提高技术 $A$：人口会一直增长，直到人均收入回到 $y^*$。")),
                 p(T(r"(The figure uses a made-up curve, $Y = 3A\sqrt{N}$ with $y^* = 1.5$, so it can move. The exam has no numbers; only the shapes matter.)", r"（这张图用了一条编出来的曲线 $Y = 3A\sqrt{N}$、$y^* = 1.5$，好让它能动起来。考试没有数字，只看形状。）"))),
            read('q6a', T('Part (a), worked: what to draw', '(a) 小问：要画什么'),
                 svg(fig_malthus(False), T('The concave production curve Y = A·f(N, K) and a straight ray from the origin with slope y*, the subsistence income. They meet at (N*, Y*), marked with dashed lines to both axes.',
                                           '凹的生产曲线 Y = A·f(N, K)，以及从原点出发、斜率为生存收入 y* 的直线射线。两者交于 (N*, Y*)，用虚线连到两轴。'),
                     T(r"What earns the marks: the ray from the origin labelled with its slope $y^*$, the point where it meets the curve, and $N^*$ and $Y^*$ marked on the axes.", r"拿分的要点：从原点出发的射线并标明斜率 $y^*$，它与曲线的交点，以及在两轴上标出 $N^*$ 和 $Y^*$。")),
                 ol(T(r"Draw a straight line from the origin that cuts the curve. Label it $y^*$ (subsistence income per person, its slope).", r"从原点画一条与曲线相交的直线。标上 $y^*$（生存水平的人均收入，即它的斜率）。"),
                    T(r"Mark the point where it meets the curve.", r"标出它和曲线的交点。"),
                    T(r"Drop dashed lines to both axes and label them $N^*$ (equilibrium population) and $Y^*$ (equilibrium output).", r"向两轴画虚线，标上 $N^*$（均衡人口）和 $Y^*$（均衡产出）。"),
                    T(r"Add one sentence: at $N^*$ income per person $Y^*/N^*$ equals subsistence $y^*$, so births equal deaths and the population is constant.", r"再写一句话：在 $N^*$ 处，人均收入 $Y^*/N^*$ 等于生存水平 $y^*$，出生等于死亡，人口不变。"))),
            read('q6b', T('A wave of immigrants, step by step', '一波移民，一步一步看'),
                 paper(T('Part (b) · 8 marks', '(b) 小问 · 8 分'), T(r"But now there is a large number of immigrants that enter the country. Show this on the diagram on the next page and explain in the box on the next page what is happening using the Malthusian explanation.", r"现在有大量移民进入这个国家。在下一页的图上表示出来，并在下一页的答题框里用马尔萨斯的解释说明发生了什么。")),
                 p(T(r"Ask first: does the shock move the **curve**, or move the economy **along** it? Immigrants are more people, with the same land, capital and technology. The curve stays where it is; the economy moves right along it, from $N^*$ to a larger $N_1$. Then follow the chain:", r"先问：这个冲击是让**曲线**动，还是让经济**沿着**曲线动？移民就是更多的人，土地、资本和技术不变。曲线不动；经济沿曲线往右，从 $N^*$ 移到更大的 $N_1$。然后顺着这条链走：")),
                 ol(T(r"**Output rises**, from $Y^*$ to $Y_1$: more people produce more.", r"**产出上升**，从 $Y^*$ 到 $Y_1$：人多了，产出也多了。"),
                    T(r"**Income per person falls below subsistence**: because of diminishing returns, output rises less than in proportion to the population. The ray to the new point is flatter than $y^*$.", r"**人均收入降到生存水平以下**：因为边际收益递减，产出上升的比例小于人口。连到新点的射线比 $y^*$ 平。"),
                    T(r"**Deaths exceed births**: below subsistence, the population starts to fall.", r"**死亡多于出生**：低于生存水平，人口开始下降。"),
                    T(r"**Back to the start**: the population keeps falling, back along the curve, until income per person is back at $y^*$, at the original $N^*$ and $Y^*$.", r"**回到原点**：人口一直下降，沿曲线往回走，直到人均收入回到 $y^*$，也就是原来的 $N^*$ 和 $Y^*$。")),
                 svg(fig_malthus(True), T('The same curve and ray. A point further right at N1 has a flatter dashed ray from the origin, so income per person there, Y1/N1, is below y*. An arrow along the N axis points from N1 back to N*.',
                                          '同样的曲线和射线。更靠右的 N1 处，原点到它的虚线射线更平，所以那里的人均收入 Y1/N1 低于 y*。N 轴上一支箭头从 N1 指回 N*。'),
                     T(r"Show the jump to $N_1$, the flatter ray (income per person below $y^*$), and the arrow back to $N^*$.", r"画出跳到 $N_1$、更平的射线（人均收入低于 $y^*$），以及回到 $N^*$ 的箭头。")),
                 p(T(r"The lesson of the model: in a Malthusian world, more people cannot make anyone better off in the long run, and neither can anything that only changes the number of people. The standard of living is pinned at subsistence.", r"这个模型的结论：在马尔萨斯世界里，人多了，长期里不能让任何人过得更好；任何只改变人数的事情也都不能。生活水平被钉在生存线上。")),
                 chapter=PART('b')),
            read('paper-answer', T('A full-mark answer', '一份满分答案'),
                 paper(T('Question 6 · a full-mark answer', '第 6 题 · 满分答案'),
                       T(r"**a.** (Diagram: a ray from the origin with slope $y^*$, the subsistence level of income per person, meeting $Y = Af(N, K)$ at $(N^*, Y^*)$, with $N^*$ and $Y^*$ marked on the axes.) In the Malthusian equilibrium, income per person $Y^*/N^*$ equals subsistence $y^*$, so the birth rate equals the death rate and population is constant.",
                         r"**a.** （图：从原点出发、斜率为生存水平人均收入 $y^*$ 的射线，与 $Y = Af(N, K)$ 交于 $(N^*, Y^*)$，两轴上标出 $N^*$ 和 $Y^*$。）在马尔萨斯均衡处，人均收入 $Y^*/N^*$ 等于生存水平 $y^*$，所以出生率等于死亡率，人口不变。"),
                       T(r"**b.** (Diagram: the move along the curve from $N^*$ to $N_1$, the flatter ray $Y_1/N_1 < y^*$, and an arrow back to $N^*$.) Immigration raises the population from $N^*$ to $N_1$. With capital and technology fixed, diminishing returns to labour mean output rises less than in proportion, so income per person falls below the subsistence level $y^*$. Below subsistence, the death rate exceeds the birth rate and the population declines. It keeps declining until income per person is back at $y^*$, at the original $N^*$ and $Y^*$. In the long run the immigration has no effect: the standard of living returns to subsistence.",
                         r"**b.** （图：沿曲线从 $N^*$ 移到 $N_1$，更平的射线 $Y_1/N_1 < y^*$，以及回到 $N^*$ 的箭头。）移民使人口从 $N^*$ 增加到 $N_1$。资本和技术不变，劳动的边际收益递减，产出增加的比例小于人口，所以人均收入降到生存水平 $y^*$ 以下。低于生存水平时死亡率高于出生率，人口下降，一直降到人均收入回到 $y^*$，即原来的 $N^*$ 和 $Y^*$。长期看移民没有影响：生活水平回到生存水平。"),
                       answer=True),
                 p(T(r"Eight marks for (b) means the examiner wants the chain, link by link: diminishing returns, income below subsistence, deaths exceed births, back to the same equilibrium. Use those words.", r"(b) 有 8 分，意味着阅卷人要看到这条链的每一环：边际收益递减、收入低于生存水平、死亡多于出生、回到同一个均衡。用这些词。")),
                 chapter=PAPER_CH()),
            read('shocks', T('Every shock, the same way', '任何冲击，同一套分析'),
                 p(T(r"The exam can swap the immigrants for any other shock. Ask the same two questions: does it move the **point** along the curve, or move the **curve** (or the ray)? Then follow income per person.", r"考试可以把移民换成别的冲击。问同样两个问题：它是让**点**沿曲线动，还是让**曲线**（或射线）动？然后跟着人均收入走。")),
                 table([T('Shock', '冲击'), T('Right after', '刚发生时'), T('Long run', '长期')],
                       [T('Immigration', '移民'), T('$N$ up, $Y/N$ down', '$N$ 增加，$Y/N$ 下降'), T('back to $N^*$, $y^*$', '回到 $N^*$、$y^*$')],
                       [T('A plague or war', '瘟疫或战争'), T('$N$ down, $Y/N$ up', '$N$ 减少，$Y/N$ 上升'), T('back to $N^*$, $y^*$', '回到 $N^*$、$y^*$')],
                       [T('Better technology ($A$ up) or more land', '技术进步（$A$ 提高）或更多土地'), T('curve up, $Y/N$ up', '曲线上移，$Y/N$ 上升'), T('more people, same $y^*$', '人更多，$y^*$ 不变')],
                       [T('Higher subsistence norm (later marriage, fewer births at each income)', '生存标准提高（晚婚，同样收入下出生更少）'), T('steeper ray', '射线变陡'), T('fewer people, richer: $Y/N$ rises to the new $y^*$', '人更少、更富：$Y/N$ 升到新的 $y^*$')]),
                 p(T(r"Better technology is the striking row. Income per person rises at first, so the population grows, and it keeps growing until income per person is back at subsistence. The economy ends with more people, the same standard of living: progress turns into people, not prosperity.", r"技术进步那一行最值得注意。人均收入先上升，于是人口增长，一直增长到人均收入回到生存水平。经济最后人更多、生活水平不变：进步变成了人口，而不是富裕。")),
                 quiz(T(r"People start to marry later, so at every income fewer children are born; the population is stable only at a higher income per person. In the long run…", r"人们开始晚婚，同样收入下出生的孩子更少；人口只有在更高的人均收入下才稳定。长期里……"),
                      [(T(r"income per person is higher and the population smaller", r"人均收入更高，人口更少"), True),
                       (T(r"nothing changes: everything returns to the old $N^*$", r"什么都不变：一切回到原来的 $N^*$"), T(r"That holds for shocks that move the point along the curve. This one moves the ray: the new equilibrium is where the steeper ray meets the curve.", r"那是让点沿曲线动的冲击才成立。这个冲击让射线动了：新均衡在更陡的射线与曲线的交点。")),
                       (T(r"the population is larger, as with better technology", r"人口更多，和技术进步一样"), T(r"Better technology moves the curve up and keeps $y^*$. Here $y^*$ itself rises, and the steeper ray meets the curve further left.", r"技术进步让曲线上移、$y^*$ 不变。这里是 $y^*$ 本身上升，更陡的射线在更靠左的地方与曲线相交。"))],
                      T(r"The only way out of the trap inside this model is to change the population rule itself: a steeper ray meets the concave curve at a smaller $N$, where income per person is higher.", r"在这个模型里，走出陷阱的唯一办法是改变人口规则本身：更陡的射线在更小的 $N$ 处与凹曲线相交，那里人均收入更高。")),
                 h(T('What finally broke the trap', '最后是什么打破了陷阱')),
                 ul(T(r"For most of history, average income barely moved: better technology bought more people, not better lives, just as the model says.", r"人类历史的大部分时间里，平均收入几乎没变：技术进步换来的是更多的人，而不是更好的生活，正如模型所说。"),
                    T(r"Modern growth escaped because technology kept improving faster than population, and population growth stopped tracking income: richer families chose to have fewer children (the **demographic transition**).", r"现代增长走出了陷阱：技术进步一直快于人口增长，而且人口增长不再跟着收入走：越富的家庭选择要越少的孩子（**人口转变** demographic transition）。"),
                    T(r"In exam answers, keep the language of the model: *diminishing returns*, *subsistence*, *birth and death rates*, *returns to the original equilibrium*.", r"答题时用模型的术语：*边际收益递减 diminishing returns*、*生存水平 subsistence*、*出生率和死亡率 birth and death rates*、*回到原来的均衡 returns to the original equilibrium*。")),
                 chapter=WIDER_CH()),
            text_q('explain', T('Say it in your own words', '用你自己的话说'), S,
                   T(r"In two or three sentences: what happens in the Malthusian model after a large wave of immigration, and why?", r"用两三句话：马尔萨斯模型里来了一大波移民之后会发生什么？为什么？"),
                   [T('Output per person falls below subsistence, because of diminishing returns to labour', '因为劳动的边际收益递减，人均产出降到生存水平以下'),
                    T('Below subsistence, deaths exceed births, so the population falls', '低于生存水平时死亡多于出生，人口下降'),
                    T('In the long run population, output and income per person return to their original levels', '长期里人口、产出和人均收入都回到原来的水平')],
                   T(r"Immigration raises population, and with diminishing returns output per person falls below subsistence. Then deaths exceed births and the population falls back until income per person returns to subsistence, at the original population and output.",
                     r"移民增加了人口，由于边际收益递减，人均产出降到生存水平以下。于是死亡多于出生，人口回落，直到人均收入回到生存水平，人口和产出也回到原来的水平。"),
                   T(r"Three links: diminishing returns (income per person falls), the population rule (deaths exceed births), and the return to the same equilibrium.", r"三个环节：边际收益递减（人均收入下降）、人口规则（死亡多于出生）、回到同一个均衡。"),
                   chapter=TRY_CH()),
            choice('technology', T('A better plough', '更好的犁'), S,
                   T(r"A new farming technology raises $A$. In the Malthusian long run, what happens to income per person?", r"一项新的农业技术提高了 $A$。在马尔萨斯的长期里，人均收入会怎样？"),
                   [(T(r"It returns to subsistence, with a larger population", r"回到生存水平，人口更多"), True),
                    (T(r"It rises permanently", r"永久提高"), T(r"Only for a while: above subsistence the population grows until income per person is back at $y^*$.", r"只是暂时的：高于生存水平时人口增长，直到人均收入回到 $y^*$。"), 'more-output-richer'),
                    (T(r"It falls below subsistence", r"降到生存水平以下"), T(r"More output per worker cannot lower income per person; it raises it, until the population catches up.", r"每个劳动力产出更多，不会降低人均收入；它会先提高，直到人口追上来。"))],
                   T(r"The curve shifts up, income per person rises above $y^*$, the population grows, and the economy settles on the same ray at a larger $N$ and $Y$.", r"曲线上移，人均收入高于 $y^*$，人口增长，经济停在同一条射线上，$N$ 和 $Y$ 都更大。")),
            number('try-nstar', T('Your turn: where it settles', '你来：停在哪'), S,
                   T(r"Output is $Y = 6\sqrt{N}$ and subsistence income is $y^* = 2$. What is the Malthusian equilibrium population $N^*$?", r"产出 $Y = 6\sqrt{N}$，生存收入 $y^* = 2$。马尔萨斯均衡人口 $N^*$ 是多少？"),
                   9, T(r"On the ray $Y = 2N$: $6\sqrt{N} = 2N$, so $\sqrt{N} = 3$ and $N^* = 9$ ($Y^* = 18$).", r"在射线 $Y = 2N$ 上：$6\sqrt{N} = 2N$，$\sqrt{N} = 3$，$N^* = 9$（$Y^* = 18$）。"),
                   tolerance=0.01, hints=[T(r"Income per person is $Y/N = 6/\sqrt{N}$; set it equal to $y^*$.", r"人均收入 $Y/N = 6/\sqrt{N}$；令它等于 $y^*$。")]),
        ],
    )


def L_drill():
    D = 'e15.drill'
    return dict(
        id=f'{CID}-drill', title=T('Every method on one page, and a drill', '所有方法一页纸，再加一组练习'),
        description=T('A review sheet of every method in the course, then eight questions with new numbers to do under time.', '把整门课的方法汇成一张复习表，再做八道换了数的限时题。'),
        minutes=30,
        skills=[{'id': D, 'name': T('The whole exam', '整张试卷')}],
        steps=[
            read('sheet', T('The method sheet', '方法表'),
                 p(T(r"Everything the course taught, one row per method, for reviewing what you have already understood. If a row does not make sense, go back to its lesson rather than memorising it.", r"整门课讲过的东西，一个方法一行，用来复习你已经弄懂的内容。哪一行看不明白，就回到对应的那一课，而不是硬背。")),
                 table([T('Question type', '题型'), T('Method', '方法'), T('Ten-second check', '十秒自检')],
                       [T('Equilibrium (Q1)', '均衡（第 1 题）'), T('$Q_d = Q_s$; price, then quantity from either curve', '$Q_d = Q_s$；先求价格，再用任一条曲线求数量'), T('both curves give the same $Q$', '两条曲线给出同一个 $Q$')],
                       [T('Quota (Q1)', '配额（第 1 题）'), T('$Q =$ quota; price from **demand**', '$Q =$ 配额；价格从**需求**读'), T('the quota is below the free-trade quantity', '配额小于自由贸易数量')],
                       [T('Tariff $t$ (Q1)', '关税 $t$（第 1 题）'), T('demand at $p_s + t$ = supply at $p_s$; revenue $tQ$ stays at home', '需求（按 $p_s + t$）= 供给（按 $p_s$）；税收 $tQ$ 留在国内'), T('$p_b - p_s = t$', '$p_b - p_s = t$')],
                       [T('Welfare (Q1)', '福利（第 1 题）'), T('$CS = \\tfrac12 Q(\\text{intercept} - p)$; add externality × $Q$ and tax revenue; count only the country\'s people', '$CS = \\tfrac12 Q(\\text{截距} - p)$；加外部性 × $Q$ 和税收；只算本国人'), T('the change splits into rectangles and triangles', '变化能拆成矩形和三角形')],
                       [T('Deadweight loss', '无谓损失'), T('triangle between demand and $MC$ (or supply), from the actual $Q$ to the efficient $Q$', '需求与 $MC$（或供给）之间、从实际 $Q$ 到有效 $Q$ 的三角形'), T('it points at the efficient quantity', '三角形尖端指向有效数量')],
                       [T('Short-run firm (Q5)', '短期厂商（第 5 题）'), T('$p = MC$ above $\\min AVC$; shut down below it', '$\\min AVC$ 以上 $p = MC$；低于它就停产'), T('profit $= (p - AC)q$', '利润 $= (p - AC)q$')],
                       [T('Long-run competition (Q5)', '长期竞争（第 5 题）'), T('$\\min AC$ (or $LMC = AC$); supply flat there; firms $= Q/q$', '$\\min AC$（或 $LMC = AC$）；供给在那里是平的；厂商数 $= Q/q$'), T('$LMC = AC$ at that $q$', '那个 $q$ 处 $LMC = AC$')],
                       [T('Elasticity (Q5)', '弹性（第 5 题）'), T('$\\frac{dQ}{dp}\\cdot\\frac{p}{Q}$ at the stated point', '在指定点算 $\\frac{dQ}{dp}\\cdot\\frac{p}{Q}$'), T('negative for demand', '需求弹性为负')],
                       [T('Monopoly (Q2)', '垄断（第 2 题）'), T('inverse demand → $MR$ (twice the slope) → $MR = MC$ → price from demand → profit $= pQ - C$', '反需求 → $MR$（斜率翻倍）→ $MR = MC$ → 价格从需求读 → 利润 $= pQ - C$'), T('$\\frac{p - MC}{p} = \\frac{1}{|\\varepsilon|}$', '$\\frac{p - MC}{p} = \\frac{1}{|\\varepsilon|}$')],
                       [T('Tax on a monopolist (Q2)', '对垄断者征税（第 2 题）'), T('percentage: seller\'s demand $= p_{\\text{buyer}}/(1 + \\tau)$; per unit: $p_{\\text{buyer}} - t$; redo $MR = MC$', '百分比：卖方需求 $= p_{\\text{买}}/(1 + \\tau)$；从量：$p_{\\text{买}} - t$；重做 $MR = MC$'), T('incidence = how far each price moved', '归宿 = 两边价格各动了多少')],
                       [T('Third degree (Q3)', '三级歧视（第 3 题）'), T('$MR_i = MC$ in each market', '每个市场 $MR_i = MC$'), T('the less elastic market pays more', '弹性小的市场价格高')],
                       [T('Second degree, packages (Q3)', '二级，套餐（第 3 题）'), T('value = area under demand; high type: efficient $q$; low type: $D_{\\text{low}} - MC = $ gap; $T_{\\text{low}} = V_{\\text{low}}$; $T_{\\text{high}} = V_{\\text{high}} - $ rent', '价值 = 需求下的面积；高类型：有效数量；低类型：$D_{\\text{低}} - MC = $ 差距；$T_{\\text{低}} = V_{\\text{低}}$；$T_{\\text{高}} = V_{\\text{高}} - $ 租金'), T('the high type is indifferent between the packages', '高类型对两个套餐无差异')],
                       [T('Two-part tariff', '两部定价'), T('price per unit $= MC$; fee $=$ consumer surplus at that price', '单价 $= MC$；入场费 $=$ 该价格下的消费者剩余'), T('the fee is a triangle', '入场费是个三角形')],
                       [T('Cournot (Q4)', '古诺（第 4 题）'), T('$MR_i$ with the rival fixed $= MC_i$ → reaction functions → solve both', '固定对手产量的 $MR_i = MC_i$ → 反应函数 → 联立求解'), T('$MR_i = MC_i$ at the answer, for both firms', '答案处两家都满足 $MR_i = MC_i$')],
                       [T('Stackelberg', '斯塔克尔伯格'), T("put the follower's $R_2$ into the leader's price, then $MR_1 = MC_1$", '把跟随者的 $R_2$ 代进领导者的价格，再令 $MR_1 = MC_1$'), T('the leader produces more than in Cournot', '领导者产量比古诺多')],
                       [T('Malthus (Q6)', '马尔萨斯（第 6 题）'), T('ray of slope $y^*$; diminishing returns; birth and death rates; back to $N^*$', '斜率 $y^*$ 的射线；边际收益递减；出生率与死亡率；回到 $N^*$'), T('the long run ends on the same ray', '长期总回到同一条射线')]),
                 chapter=T('Method sheet', '方法表')),
            number('d1', T('Quota price', '配额价格'), D, T(r"Demand $Q = 90 - 3p$, import supply $Q = 6p$. A quota allows 30 units. What is the market price?", r"需求 $Q = 90 - 3p$，进口供给 $Q = 6p$。配额 30 个。市场价格是多少？"),
                   20, T(r"Free trade gives $Q = 60$, so the quota binds. From demand: $30 = 90 - 3p$, so $p = 20$.", r"自由贸易 $Q = 60$，配额是紧的。由需求：$30 = 90 - 3p$，$p = 20$。"), tolerance=0.01, purpose='check', chapter=T('Drill', '练习')),
            number('d2', T('Monopoly profit', '垄断利润'), D, T(r"Demand $p = 100 - Q$, constant marginal cost 20, no fixed cost. What is the monopoly profit?", r"需求 $p = 100 - Q$，边际成本恒为 20，没有固定成本。垄断利润是多少？"),
                   1600, T(r"$MR = 100 - 2Q = 20$, so $Q = 40$ and $p = 60$; profit $= (60 - 20) \times 40 = 1600$.", r"$MR = 100 - 2Q = 20$，$Q = 40$，$p = 60$；利润 $= (60 - 20) \times 40 = 1600$。"), tolerance=0.5, purpose='check'),
            number('d3', T('A 50% tax', '50% 的税'), D, T(r"Same monopolist ($p = 100 - Q$ for buyers, $MC = 20$). A 50% tax means buyers pay $1.5p$ when the seller gets $p$. What price do buyers pay?", r"同一个垄断者（买方需求 $p = 100 - Q$，$MC = 20$）。50% 的税：卖方收 $p$ 时买方付 $1.5p$。买方付多少？"),
                   65, T(r"Seller faces $p = (100 - Q)/1.5$, $MR = (100 - 2Q)/1.5 = 20$, so $Q = 35$; buyers pay $100 - 35 = 65$ (the seller keeps $43.33$).", r"卖方面对 $p = (100 - Q)/1.5$，$MR = (100 - 2Q)/1.5 = 20$，$Q = 35$；买方付 $100 - 35 = 65$（卖方拿 $43.33$）。"), tolerance=0.01, purpose='check'),
            number('d4', T('Third degree', '三级歧视'), D, T(r"Markets $p_1 = 40 - Q_1$ and $p_2 = 30 - 2Q_2$, $MC = 10$. What price is charged in market 2?", r"市场 $p_1 = 40 - Q_1$、$p_2 = 30 - 2Q_2$，$MC = 10$。市场 2 定什么价？"),
                   20, T(r"$MR_2 = 30 - 4Q_2 = 10$, so $Q_2 = 5$ and $p_2 = 20$ (market 1: $Q_1 = 15$, $p_1 = 25$).", r"$MR_2 = 30 - 4Q_2 = 10$，$Q_2 = 5$，$p_2 = 20$（市场 1：$Q_1 = 15$，$p_1 = 25$）。"), tolerance=0.01, purpose='check'),
            number('d5', T('Symmetric Cournot', '对称古诺'), D, T(r"Two identical firms, demand $p = 120 - (q_1 + q_2)$, zero marginal cost. What is the Cournot price?", r"两家相同的厂商，需求 $p = 120 - (q_1 + q_2)$，边际成本为零。古诺价格是多少？"),
                   40, T(r"$MR_1 = 120 - 2q_1 - q_2 = 0$; by symmetry $q_1 = q_2 = 40$, $Q = 80$, $p = 40$.", r"$MR_1 = 120 - 2q_1 - q_2 = 0$；对称时 $q_1 = q_2 = 40$，$Q = 80$，$p = 40$。"), tolerance=0.01, purpose='check'),
            number('d6', T('Long-run price', '长期价格'), D, T(r"Each firm has $C = q^3 - 10q^2 + 40q$. What is the long-run competitive price?", r"每家厂商 $C = q^3 - 10q^2 + 40q$。长期竞争价格是多少？"),
                   15, T(r"$AC = q^2 - 10q + 40$ is lowest at $q = 5$: $25 - 50 + 40 = 15$.", r"$AC = q^2 - 10q + 40$ 在 $q = 5$ 处最低：$25 - 50 + 40 = 15$。"), tolerance=0.01, purpose='check'),
            number('d7', T('Elasticity', '弹性'), D, T(r"Demand $Q = 600 - 3p$. What is the point elasticity at $p = 50$? (Signed, two decimals.)", r"需求 $Q = 600 - 3p$。$p = 50$ 处的点弹性是多少？（带符号，两位小数。）"),
                   -0.33, T(r"$Q = 450$; $\varepsilon = -3 \times 50/450 = -1/3$.", r"$Q = 450$；$\varepsilon = -3 \times 50/450 = -1/3$。"), tolerance=0.01, purpose='check'),
            choice('d8', T('A plague', '一场瘟疫'), D, T(r"In a Malthusian economy, a plague kills a third of the population. What happens to income per person right after, and in the long run?", r"马尔萨斯经济里，一场瘟疫夺走了三分之一的人口。之后人均收入马上怎样？长期又怎样？"),
                   [(T(r"It rises at first, then returns to subsistence as the population recovers", r"先上升，随着人口恢复又回到生存水平"), True),
                    (T(r"It falls, because output falls", r"下降，因为产出下降了"), T(r"Output falls less than population (diminishing returns run in reverse), so output per person rises.", r"产出下降的比例小于人口（边际收益递减反过来起作用），所以人均产出上升。"), None),
                    (T(r"It rises permanently", r"永久上升"), T(r"Above subsistence, births exceed deaths: the population grows back until income per person is at $y^*$ again.", r"高于生存水平时出生多于死亡：人口会长回来，直到人均收入又回到 $y^*$。"), None)],
                   T(r"Fewer people on the same land: each produces more, so income per person rises above $y^*$; then the population grows back to $N^*$.", r"同样的土地上人少了：每人产出更多，人均收入高于 $y^*$；然后人口长回到 $N^*$。")),
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
        'summary': T('The mock exam question by question: each question as printed, every idea it needs taught from the beginning, every line of the solution explained, then a full-mark answer, the wider topic and practice.',
                     '一道题一道题地讲这份模考：先看题目原文，再把它需要的每个想法从头讲起，解法每一行都讲明白，最后是满分答案、这类题的全貌和练习。'),
        'audience': T('Students preparing for the exam who know university maths (derivatives, solving equations) but have not taken the course.',
                      '准备考试、会大学数学（求导、解方程）但没上过这门课的同学。'),
        'outcomes': [T('Understand every idea behind the six questions, from the ground up', '从头弄懂六道题背后的每个想法'),
                     T('Solve each type of question with a method you can check, and write it the way the examiner expects', '每类题都有能自检的解法，并按阅卷人期待的方式写出来'),
                     T('Handle the twists a real exam can add', '应对真题可能加的各种变化')],
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
