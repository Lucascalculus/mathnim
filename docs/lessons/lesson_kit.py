# Shared by the build scripts of the exam courses (docs/lessons/<course>/build.py): Mathium lesson JSON written
# from Python. T() is a two-language string; the block and step helpers follow packages/core (content.ts,
# schema.ts); Plot draws a data diagram as SVG.
#   import sys, os; sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..')); from lesson_kit import *


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
    """An interactive figure from a pack of @mathnim/visuals (loaded by the course entry's `packs`)."""
    b = {'type': 'visual', 'name': name, 'explore': explore}
    if params: b['params'] = params
    if caption: b['caption'] = caption
    return b


def frame(src, alt, caption=None, height=None, **params):
    """A self-contained instrument (an HTML page under apps/mathnim/public/frames/) in a sandboxed frame; for what needs typing, tables or drag and drop."""
    b = {'type': 'frame', 'src': src, 'alt': alt}
    if params: b['params'] = params
    if height: b['height'] = height
    if caption: b['caption'] = caption
    return b


def code(lang, source, caption=None):
    b = {'type': 'code', 'lang': lang, 'code': source}
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
