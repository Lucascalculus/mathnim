#!/usr/bin/env python3
# Builds the final-exam units of the Internet Technologies demo course (COMP90007, course id 5hujdkdkkm;
# README.md here) as Mathnim lesson JSON in apps/mathnim/public/demo/5hujdkdkkm/: the sample questions of
# the review lectures (this file), the practice exam (practice.py) and the classic hard problems (hard.py).
# They replace the course's exam units
# in apps/mathnim/public/demo/courses.json; the other units (generated from the lecture slides) are left
# as they are.
#   python3 docs/lessons/comp90007/build.py && node apps/mathnim/tools/demo_check.mjs 5hujdkdkkm
import json
import os
import sys

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..', '..'))
DEMO = os.path.join(ROOT, 'apps', 'mathnim', 'public', 'demo')
CID = '5hujdkdkkm'
# the lesson this unit replaced (fifteen bare questions; its file was removed with the first build)
OLD = [f'{CID}-practice']

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))
from lesson_kit import *  # noqa: E402,F403  (T, the block and step helpers, the colours, Plot)

with open(os.path.join(DEMO, 'courses.json'), encoding='utf8') as _f:
    _course = next(c for c in json.load(_f) if c['id'] == CID)
# the course's own skills (the generated lessons name them), so what is practised here counts for them
_SKILLS = {}
for _l in _course['lessons']:
    for _s in _l['meta']['skills']:
        _SKILLS.setdefault(_s['id'], _s)


def skills(*ids):
    return [_SKILLS[i] for i in ids]


# ---------------------------------------------------------------- drawings
# Every drawing is made once per language (the words differ) and shown as an image: labels on things,
# no sentences (the caption says what happens). Wide enough for the text column, with type that stays
# readable at phone width.
RED_SOFT, GREEN_SOFT, BLUE_SOFT, GREY_SOFT, LINE = '#fbe4d8', '#d5ece8', '#dfe7fa', '#eef0f2', '#c9ccd1'


def esc(s):
    return s.replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;')


def rich(s, size):
    """Escaped text where X_{y} writes y as a subscript and X^{y} as a superscript."""
    out, i = '', 0
    s = esc(s)
    while i < len(s):
        if s.startswith('_{', i) or s.startswith('^{', i):
            j = s.index('}', i)
            shift = 'sub' if s[i] == '_' else 'super'
            out += f'<tspan baseline-shift="{shift}" font-size="{round(size * 0.72)}">{s[i + 2:j]}</tspan>'
            i = j + 1
        else:
            out += s[i]
            i += 1
    return out


class Fig:
    """A drawing w x h (SVG user units) in one language; L(en, zh) picks the words."""

    def __init__(self, w, h, lang):
        self.w, self.h, self.lang = w, h, lang
        self.parts, self.heads = [], set()

    def L(self, en, zh):
        return zh if self.lang == 'zh' else en

    def rect(self, x, y, w, h, fill='#ffffff', stroke=INK, sw=1.6, rx=6, dash=None):
        d = f' stroke-dasharray="{dash}"' if dash else ''
        st = f' stroke="{stroke}" stroke-width="{sw}"' if stroke else ''
        self.parts.append(f'<rect x="{x:.1f}" y="{y:.1f}" width="{w:.1f}" height="{h:.1f}" rx="{rx}" fill="{fill}"{st}{d}/>')

    def circle(self, cx, cy, r, fill='#ffffff', stroke=INK, sw=1.6):
        st = f' stroke="{stroke}" stroke-width="{sw}"' if stroke else ''
        self.parts.append(f'<circle cx="{cx:.1f}" cy="{cy:.1f}" r="{r}" fill="{fill}"{st}/>')

    def ellipse(self, cx, cy, rx, ry, fill, opacity=0.12, stroke=None):
        st = f' stroke="{stroke}" stroke-width="1.4" stroke-dasharray="5 5"' if stroke else ''
        self.parts.append(f'<ellipse cx="{cx:.1f}" cy="{cy:.1f}" rx="{rx}" ry="{ry}" fill="{fill}" fill-opacity="{opacity}"{st}/>')

    def text(self, x, y, s, size=17, color=INK, anchor='start', weight=None):
        w = f' font-weight="{weight}"' if weight else ''
        self.parts.append(f'<text x="{x:.1f}" y="{y:.1f}" font-size="{size}" fill="{color}" text-anchor="{anchor}"{w}>{rich(s, size)}</text>')

    def line(self, x1, y1, x2, y2, color=INK, width=2, dash=None, arrow=False):
        d = f' stroke-dasharray="{dash}"' if dash else ''
        m = ''
        if arrow:
            hid = 'h' + color.lstrip('#')
            if hid not in self.heads:
                self.heads.add(hid)
                self.parts.insert(0, f'<defs><marker id="{hid}" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M0 0 L10 5 L0 10 z" fill="{color}"/></marker></defs>')
            m = f' marker-end="url(#{hid})"'
        self.parts.append(f'<line x1="{x1:.1f}" y1="{y1:.1f}" x2="{x2:.1f}" y2="{y2:.1f}" stroke="{color}" stroke-width="{width}" stroke-linecap="round"{d}{m}/>')

    def cross(self, x, y, r=8, color=ORANGE):
        self.line(x - r, y - r, x + r, y + r, color, 3)
        self.line(x - r, y + r, x + r, y - r, color, 3)

    def svg(self):
        return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {self.w} {self.h}" font-family="sans-serif">'
                f'<rect width="{self.w}" height="{self.h}" fill="#ffffff"/>{"".join(self.parts)}</svg>')


def drawn(fn, *args):
    """A drawing in both languages."""
    return T(fn('en', *args), fn('zh', *args))


def fig_share(lang):
    """Slotted ALOHA's slots against the bit-map protocol's reservations and turns."""
    F = Fig(600, 312, lang)
    F.text(24, 28, F.L('contention · slotted ALOHA', '竞争 · 时隙 ALOHA'), 18, INK, weight='600')
    for i, who in enumerate(['A', '', 'B C', 'D', 'A D', '', 'C', 'B']):
        x = 24 + 69 * i
        if not who: F.rect(x, 42, 62, 56, '#ffffff', LINE, 1.4, dash='5 4')
        elif ' ' in who:
            F.rect(x, 42, 62, 56, RED_SOFT, ORANGE)
            F.text(x + 31, 66, who, 17, ORANGE, 'middle', '600')
            F.cross(x + 31, 82, 6)
        else:
            F.rect(x, 42, 62, 56, GREEN_SOFT, GREEN)
            F.text(x + 31, 77, who, 19, GREEN, 'middle', '600')
    F.line(24, 116, 572, 116, MUTED, 1.6, arrow=True)
    F.text(572, 136, F.L('time', '时间'), 15, MUTED, 'end')
    F.text(24, 170, F.L('collision-free · bit-map', '无冲突 · 位图协议'), 18, INK, weight='600')
    for period in (0, 1):
        x0 = 24 + period * 384
        for b in range(8):
            on = period == 0 and b in (1, 3, 6)
            F.rect(x0 + 18 * b, 184, 18, 56, GREY_SOFT, MUTED, 1.2, rx=2)
            F.text(x0 + 18 * b + 9, 218, '1' if on else '0', 14, INK if on else MUTED, 'middle', '600' if on else None)
        if period == 0:
            for k, st in enumerate((1, 3, 6)):
                F.rect(x0 + 144 + 80 * k, 184, 80, 56, GREEN_SOFT, GREEN)
                F.text(x0 + 184 + 80 * k, 219, str(st), 19, GREEN, 'middle', '600')
    F.text(24 + 72, 262, F.L('reservations', '预约位'), 15, MUTED, 'middle')
    F.text(24 + 264, 262, F.L('frames, in turn', '按顺序发的帧'), 15, MUTED, 'middle')
    for k, (fill, stroke, word) in enumerate(((GREEN_SOFT, GREEN, F.L('a frame gets through', '帧成功送达')), (RED_SOFT, ORANGE, F.L('collision', '冲突')), (GREY_SOFT, MUTED, F.L('overhead', '开销')))):
        x = 24 + 200 * k
        F.rect(x, 298 - 13, 16, 16, fill, stroke, 1.2, rx=3)
        F.text(x + 24, 298, word, 15, INK)
    return F.svg()


def fig_ports(lang):
    """An arriving segment: the IP address finds the host, the port the process."""
    F = Fig(600, 320, lang)
    F.rect(160, 16, 424, 292, '#ffffff', INK, 1.8, rx=12)
    F.text(178, 46, F.L('host', '主机') + '  128.250.1.7', 18, INK, weight='600')
    for k, (name, port) in enumerate(((F.L('web server', '网页服务器'), '80'), (F.L('mail server', '邮件服务器'), '25'), (F.L('browser', '浏览器'), '52311'))):
        x = 178 + 136 * k
        hit = k == 0
        F.rect(x, 66, 124, 64, BLUE_SOFT if hit else '#ffffff', BLUE if hit else MUTED, 1.8 if hit else 1.4)
        F.text(x + 62, 93, name, 16, INK, 'middle')
        F.text(x + 62, 117, F.L('port', '端口') + ' ' + port, 15, BLUE if hit else MUTED, 'middle', '600' if hit else None)
    F.rect(178, 214, 388, 46, GREY_SOFT, MUTED, 1.4)
    F.text(372, 243, F.L('TCP / UDP: by port', 'TCP / UDP：看端口'), 16, INK, 'middle')
    F.line(240, 212, 240, 136, BLUE, 2.6, arrow=True)
    F.text(252, 180, F.L('port → process', '端口 → 进程'), 15, BLUE)
    F.rect(10, 204, 132, 62, '#ffffff', INK, 1.6)
    F.text(76, 230, '128.250.1.7', 15, INK, 'middle')
    F.text(76, 252, F.L('port', '端口') + ' 80', 15, BLUE, 'middle', '600')
    F.line(142, 237, 176, 237, INK, 2.2, arrow=True)
    F.text(76, 292, F.L('IP address → host', 'IP 地址 → 主机'), 15, MUTED, 'middle')
    return F.svg()


def fig_rpc_lost(lang):
    """A lost request and a lost reply look the same to the client: silence, then a timeout."""
    F = Fig(600, 300, lang)
    for k, title in enumerate((F.L('(a) the request is lost', '(a) 请求丢了'), F.L('(b) the reply is lost', '(b) 回复丢了'))):
        o = 310 * k
        c, s = o + 44, o + 246
        F.text(o + 8, 24, title, 17, INK, weight='600')
        F.text(c, 54, F.L('client', '客户端'), 15, MUTED, 'middle')
        F.text(s, 54, F.L('server', '服务器'), 15, MUTED, 'middle')
        F.line(c, 64, c, 276, MUTED, 1.6)
        F.line(s, 64, s, 276, MUTED, 1.6)
        if k == 0:
            F.line(c, 84, c + 96, 116, BLUE, 2.4)
            F.cross(c + 104, 119)
        else:
            F.line(c, 84, s, 124, BLUE, 2.4, arrow=True)
            F.rect(s - 92, 132, 84, 36, GREEN_SOFT, GREEN, 1.6)
            F.text(s - 50, 156, F.L('runs it', '执行了'), 15, GREEN, 'middle', '600')
            F.line(s, 176, s - 96, 208, BLUE, 2.4)
            F.cross(s - 104, 211)
        F.line(c - 10, 244, c + 10, 244, ORANGE, 3)
        F.text(c + 16, 249, F.L('timeout', '超时'), 15, ORANGE, weight='600')
    return F.svg()


def fig_tahoe(lang):
    """The Tahoe question's window, round by round: the timeout at 16, then slow start up to the new threshold 8."""
    w = [1, 2, 4, 8, 10, 11, 12, 13, 14, 15, 16, 1, 2, 4, 8, 9]
    P = Plot(0, 15.5, 0, 18.5, left=96, right=60)
    P.seg((0, 10), (10, 10), MUTED, 2, '6 6')
    P.seg((11, 8), (15.5, 8), GREEN, 2, '6 6')
    for i in range(len(w) - 1):
        if i != 10: P.seg((i, w[i]), (i + 1, w[i + 1]), BLUE, 3)
    P.seg((10, 16), (11, 1), ORANGE, 2, '4 5')
    for i, v in enumerate(w): P.dot(i, v, ORANGE if i == 10 else BLUE, 4.5)
    L = (lambda en, zh: zh if lang == 'zh' else en)
    P.text(10, 16, L('timeout', '超时'), ORANGE, 16, 'middle', dy=-14, weight='600')
    P.text(0.2, 10, L('old threshold 10', '旧阈值 10'), MUTED, 15, dy=-8)
    P.text(15.5, 8, L('new threshold 8', '新阈值 8'), GREEN, 15, 'end', dy=22, weight='600')
    for i, v, dx, dy in ((12, 2, 12, 16), (13, 4, 12, 14), (14, 8, -12, -8), (15, 9, 0, -12)):
        P.text(i, v, str(v), BLUE, 15, 'end' if dx < 0 else 'middle' if dx == 0 else 'start', dx=dx, dy=dy)
    P.axes('RTT', 'cwnd (KB)', xticks=(0, 5, 10, 15), yticks=(8, 10, 16))
    return P.svg()


def fig_dns(lang):
    """Resolving robot.cs.washington.edu: the local name server asks down the tree, one referral at a time."""
    F = Fig(600, 390, lang)
    F.rect(16, 296, 186, 50, '#ffffff', INK, 1.6)
    F.text(109, 327, F.L('your computer', '你的电脑'), 16, INK, 'middle')
    F.rect(16, 156, 186, 50, BLUE_SOFT, BLUE, 1.8)
    F.text(109, 187, F.L('local name server', '本地域名服务器'), 16, INK, 'middle', '600')
    F.line(96, 294, 96, 210, INK, 2, arrow=True)
    F.line(124, 210, 124, 294, GREEN, 2.2, arrow=True)
    F.text(88, 258, '1', 15, INK, 'end', '600')
    F.text(132, 258, '10', 15, GREEN, weight='600')
    for k, name in enumerate((F.L('root', '根'), 'edu', 'washington.edu', 'cs.washington.edu')):
        y = 14 + 80 * k
        last = k == 3
        F.rect(392, y, 194, 46, GREEN_SOFT if last else '#ffffff', GREEN if last else INK, 1.6)
        F.text(489, y + 29, name, 16, INK, 'middle', '600' if last else None)
        ya, yb = 181 - 8, 181 + 8
        F.line(204, ya, 388, y + 17, INK, 1.6, arrow=True)
        F.line(388, y + 31, 204, yb, MUTED if not last else GREEN, 1.6, dash=None if last else '5 4', arrow=True)
        F.text(388 - 8, y + 12, str(2 + 2 * k), 16, INK, 'end', '600')
        F.text(388 - 8, y + 46, str(3 + 2 * k), 16, GREEN if last else MUTED, 'end', '600')
    F.text(300, 378, F.L('looking up', '查询') + ' robot.cs.washington.edu', 15, MUTED, 'middle')
    return F.svg()


def fig_http(lang):
    """Three ways to fetch a page with one HTML file and two images, counted in round trips."""
    F = Fig(600, 442, lang)
    RT = 46
    titles = (F.L('non-persistent', '非持久'), F.L('persistent', '持久'), F.L('pipelined', '持久＋流水线'))
    plans = (
        [('syn', 1), ('html', 1), ('syn', 1), ('img', 1), ('syn', 1), ('img', 1)],
        [('syn', 1), ('html', 1), ('img', 1), ('img', 1)],
        [('syn', 1), ('html', 1), ('img', 2)],
    )
    col = {'syn': MUTED, 'html': BLUE, 'img': PURPLE}
    for k, (title, plan) in enumerate(zip(titles, plans)):
        o = 200 * k
        c, s = o + 34, o + 166
        F.text(o + 100, 22, title, 16, INK, 'middle', '600')
        F.text(c, 46, F.L('client', '客户'), 15, MUTED, 'middle')
        F.text(s, 46, F.L('server', '服务器'), 15, MUTED, 'middle')
        F.line(c, 54, c, 372, LINE, 1.6)
        F.line(s, 54, s, 372, LINE, 1.6)
        y = 64
        for kind, n in plan:
            for j in range(n):
                d = 7 * j
                F.line(c, y + d, s, y + d + RT / 2 - 4, col[kind], 2.2, arrow=True)
                F.line(s, y + d + RT / 2, c, y + d + RT - 4, col[kind], 2.2, '5 4' if kind == 'syn' else None, arrow=True)
            y += RT + 7 * (n - 1)
        F.text(o + 100, 400, f'{len(plan)} RTT', 18, INK, 'middle', '600')
    for k, (kind, word) in enumerate((('syn', F.L('TCP handshake', 'TCP 握手')), ('html', 'HTML'), ('img', F.L('image', '图片')))):
        x = 24 + 190 * k
        F.line(x, 422, x + 26, 422, col[kind], 3)
        F.text(x + 34, 428, word, 16, INK)
    return F.svg()


def fig_mail(lang):
    """Alice's mail to Bob: submitted and transferred by SMTP, collected by IMAP or POP3."""
    F = Fig(600, 176, lang)
    boxes = (('Alice', F.L('user agent', '用户代理')), ('Alice', F.L('mail server', '邮件服务器')), ('Bob', F.L('mail server', '邮件服务器')), ('Bob', F.L('user agent', '用户代理')))
    xs = (8, 160, 312, 464)
    for (who, what), x in zip(boxes, xs):
        server = 'server' in what or '服务器' in what
        F.rect(x, 52, 128, 64, GREY_SOFT if server else '#ffffff', INK, 1.6)
        F.text(x + 64, 78, who, 16, INK, 'middle', '600')
        F.text(x + 64, 102, what, 15, MUTED, 'middle')
    for (a, b), proto, word in zip(((136, 160), (288, 312), (440, 464)), ('SMTP', 'SMTP', 'IMAP / POP3'), (F.L('submission', '提交'), F.L('transfer', '传送'), F.L('final delivery', '最终投递'))):
        F.line(a + 2, 84, b - 2, 84, BLUE, 2.4, arrow=True)
        F.text((a + b) / 2, 38, proto, 15, BLUE, 'middle', '600')
        F.text((a + b) / 2, 142, word, 15, MUTED, 'middle')
    return F.svg()


def fig_modes(lang):
    """Chained CBC against counter mode, block 4 highlighted: what it depends on, and what depends on it."""
    F = Fig(600, 400, lang)
    xs = [70 + 112 * i for i in range(5)]
    F.text(8, 22, F.L('chained (CBC)', '链式（CBC）'), 17, INK, weight='600')
    for i, x in enumerate(xs):
        hot = i == 3
        after = i == 4
        st = ORANGE if hot else (ORANGE if after else INK)
        F.rect(x - 24, 34, 48, 28, '#ffffff', MUTED, 1.4)
        F.text(x, 54, f'P_{{{i + 1}}}', 16, INK, 'middle')
        F.line(x, 62, x, 76, INK, 1.6, arrow=True)
        F.circle(x, 86, 10, '#ffffff', INK, 1.6)
        F.text(x, 92, '⊕', 17, INK, 'middle')
        F.line(x, 96, x, 108, INK, 1.6, arrow=True)
        F.rect(x - 28, 110, 56, 30, RED_SOFT if hot else '#ffffff', st, 2.2 if (hot or after) else 1.4, dash='5 4' if after else None)
        F.text(x, 131, 'E_{K}', 16, INK, 'middle')
        F.line(x, 140, x, 154, INK, 1.6, arrow=True)
        F.rect(x - 24, 156, 48, 28, RED_SOFT if hot else GREY_SOFT, st, 2.2 if (hot or after) else 1.4, dash='5 4' if after else None)
        F.text(x, 176, f'C_{{{i + 1}}}', 16, INK, 'middle')
        if i < 4:
            feed = ORANGE if i >= 2 else MUTED
            F.line(x + 24, 170, xs[i + 1] - 12, 90, feed, 2 if i >= 2 else 1.6, arrow=True)
    F.text(xs[0] - 50, 90, 'IV', 15, MUTED, 'middle')
    F.line(xs[0] - 38, 86, xs[0] - 12, 86, MUTED, 1.6, arrow=True)
    F.text(8, 226, F.L('counter mode', '计数器模式'), 17, INK, weight='600')
    for i, x in enumerate(xs):
        hot = i == 3
        st = ORANGE if hot else INK
        F.rect(x - 34, 238, 68, 28, '#ffffff', st, 2.2 if hot else 1.4)
        F.text(x, 258, f'IV+{i}', 15, INK, 'middle')
        F.line(x, 266, x, 280, INK, 1.6, arrow=True)
        F.rect(x - 28, 282, 56, 30, RED_SOFT if hot else '#ffffff', st, 2.2 if hot else 1.4)
        F.text(x, 303, 'E_{K}', 16, INK, 'middle')
        F.line(x, 312, x, 326, INK, 1.6, arrow=True)
        F.circle(x, 336, 10, '#ffffff', INK, 1.6)
        F.text(x, 342, '⊕', 17, INK, 'middle')
        F.text(x - 34, 341, f'P_{{{i + 1}}}', 14, MUTED, 'end')
        F.line(x - 32, 336, x - 12, 336, MUTED, 1.4, arrow=True)
        F.line(x, 346, x, 358, INK, 1.6, arrow=True)
        F.rect(x - 24, 360, 48, 28, RED_SOFT if hot else GREY_SOFT, st, 2.2 if hot else 1.4)
        F.text(x, 380, f'C_{{{i + 1}}}', 16, INK, 'middle')
    return F.svg()


AUTH = [  # (from, to, en, zh): the seven messages of the public-key authentication protocol (Tanenbaum Fig. 8-43)
    ('A', 'D', 'Give me E_{B}', '请给我 E_{B}'),
    ('D', 'A', 'Here is E_{B}', '这是 E_{B}'),
    ('A', 'B', 'E_{B}(A, R_{A})', 'E_{B}(A, R_{A})'),
    ('B', 'D', 'Give me E_{A}', '请给我 E_{A}'),
    ('D', 'B', 'Here is E_{A}', '这是 E_{A}'),
    ('B', 'A', 'E_{A}(R_{A}, R_{B}, K_{S})', 'E_{A}(R_{A}, R_{B}, K_{S})'),
    ('A', 'B', 'K_{S}(R_{B})', 'K_{S}(R_{B})'),
]


def fig_auth(lang, printed=False):
    """The seven messages; as printed on the paper (English), or with where each side becomes sure."""
    F = Fig(600, 446 if not printed else 418, lang if not printed else 'en')
    X = {'A': 70, 'D': 300, 'B': 530}
    for k, name in (('A', 'Alice'), ('D', F.L('Directory', '目录')), ('B', 'Bob')):
        F.rect(X[k] - 56, 10, 112, 34, GREY_SOFT, INK, 1.6)
        F.text(X[k], 33, name, 17, INK, 'middle', '600')
        F.line(X[k], 44, X[k], 406, LINE, 1.8)
    for n, (a, b, en, zh) in enumerate(AUTH, 1):
        y = 40 + 50 * n
        hot = not printed and n in (3, 6)
        col = BLUE if hot else INK
        right = X[b] > X[a]
        x1, x2 = X[a] + (4 if right else -4), X[b] - (6 if right else -6)
        F.line(x1, y, x2, y, col, 2.2 if hot else 1.8, arrow=True)
        word = f'{n}   ' + F.L(en, zh) if right else F.L(en, zh) + f'   {n}'
        F.text(X[a] + 12 if right else X[a] - 12, y - 8, word, 17, col, 'start' if right else 'end', '600' if hot else None)
    if not printed:
        F.circle(X['A'], 40 + 50 * 6, 6, GREEN, None)
        F.text(X['A'] + 12, 40 + 50 * 6 + 21, F.L('Alice is sure: Bob', 'Alice 确认：是 Bob'), 16, GREEN, weight='600')
        F.circle(X['B'], 40 + 50 * 7, 6, GREEN, None)
        F.text(X['B'] - 12, 40 + 50 * 7 + 22, F.L('Bob is sure: Alice', 'Bob 确认：是 Alice'), 16, GREEN, 'end', '600')
    return F.svg()


def fig_tree(lang):
    """The adaptive tree walk over eight stations; B, D and G are ready, probed in five slots."""
    F = Fig(600, 262, lang)
    pos = {1: (300, 28), 2: (150, 88), 3: (450, 88)}
    for k in range(4): pos[4 + k] = (75 + 150 * k, 148)
    for a, b in ((1, 2), (1, 3), (2, 4), (2, 5), (3, 6), (3, 7)):
        F.line(*pos[a], *pos[b], LINE, 2)
    leaves = 'ABCDEFGH'
    for i, s in enumerate(leaves):
        x = 37.5 + 75 * i
        F.line(pos[4 + i // 2][0], pos[4 + i // 2][1], x, 206, LINE, 2)
    slot = {1: '1', 2: '2', 4: '3', 5: '4', 3: '5'}
    for n, (x, y) in pos.items():
        hot = n in slot
        F.circle(x, y, 16, RED_SOFT if n in (1, 2) else ('#ffffff'), ORANGE if n in (1, 2) else INK, 1.8 if hot else 1.4)
        F.text(x, y + 6, str(n), 15, INK, 'middle')
        if hot:
            F.circle(x + 24, y - 14, 11, ORANGE, None)
            F.text(x + 24, y - 9, slot[n], 13, '#ffffff', 'middle', '600')
    for i, s in enumerate(leaves):
        x = 37.5 + 75 * i
        ready = s in 'BDG'
        F.rect(x - 18, 206, 36, 32, BLUE_SOFT if ready else '#ffffff', BLUE if ready else MUTED, 1.8 if ready else 1.2)
        F.text(x, 228, s, 16, BLUE if ready else MUTED, 'middle', '600' if ready else None)
    F.text(592, 256, F.L('● slot of the probe', '● 第几个时隙探查'), 15, ORANGE, 'end')
    return F.svg()


def fig_terminals(lang):
    """Hidden terminals (A and C cannot hear each other but both reach B) and exposed ones (B and C hear each other but send apart)."""
    F = Fig(600, 268, lang)
    F.text(8, 22, F.L('hidden terminals', '隐藏终端'), 16, INK, weight='600')
    xs = (110, 300, 490)
    F.ellipse(xs[0], 72, 230, 34, BLUE, 0.1, BLUE)
    F.ellipse(xs[2], 72, 230, 34, PURPLE, 0.1, PURPLE)
    for x, s in zip(xs, 'ABC'):
        F.circle(x, 72, 15, '#ffffff', INK, 1.8)
        F.text(x, 78, s, 16, INK, 'middle', '600')
    F.line(xs[0] + 18, 64, xs[1] - 22, 64, BLUE, 2.2, arrow=True)
    F.line(xs[2] - 18, 64, xs[1] + 22, 64, PURPLE, 2.2, arrow=True)
    F.cross(xs[1], 104, 7)
    F.text(8, 156, F.L('exposed terminals', '暴露终端'), 16, INK, weight='600')
    xs = (60, 230, 370, 540)
    F.ellipse(xs[1], 214, 190, 32, BLUE, 0.1, BLUE)
    F.ellipse(xs[2], 214, 190, 32, PURPLE, 0.1, PURPLE)
    for x, s in zip(xs, 'ABCD'):
        F.circle(x, 214, 15, '#ffffff', INK, 1.8)
        F.text(x, 220, s, 16, INK, 'middle', '600')
    F.line(xs[1] - 18, 206, xs[0] + 20, 206, BLUE, 2.2, arrow=True)
    F.line(xs[2] + 18, 206, xs[3] - 20, 206, PURPLE, 2.2, arrow=True)
    F.text(300, 258, F.L('both can send at once', '可以同时发'), 14, GREEN, 'middle', '600')
    return F.svg()


# ---------------------------------------------------------------- the lessons
# Every lesson follows the learner (README.md): the question as printed and a slow read of it; the ideas
# it needs from the ground up; the answer built link by link, then a full-mark answer as written on the
# paper; the wider topic; practice.
Q_CH = lambda: T('The question', '题目')
IDEAS_CH = lambda: T('The ideas', '需要的想法')
PAPER_CH = lambda: T('On the exam paper', '写在卷面上')
WIDER_CH = lambda: T('The wider topic', '这类题的全貌')
TRY_CH = lambda: T('Your turn', '你来')
R1 = lambda n, extra=None: T(f'Review (1) · Sample question {n}' + (f' ({extra[0]})' if extra else ''), f'复习课 (1) · 样题 {n}' + (f'（{extra[1]}）' if extra else ''))
R2 = lambda n: T(f'Review (2) · Sample question {n}', f'复习课 (2) · 样题 {n}')


def L_start():
    return dict(
        id=f'{CID}-exam-start', title=T('Start here: the sample questions, and how we will learn them', '从这里开始：这些样题，以及我们怎么学'),
        description=T('What the ten sample questions of the review lectures ask, why the lessons come in this order, and the two habits that earn the marks in a short answer.', '复习课的十道样题各问什么，课为什么按这个顺序排，以及简答题拿分的两个习惯。'),
        minutes=10,
        skills=[{'id': 'it-exam.map', 'name': T('Reading the exam', '读懂考题')}],
        steps=[
            read('exam', T('What the final exam asks', '期末考什么'),
                 p(T(r"In Week 12, both review lectures end with sample questions of the kind the final exam asks. Review (1) has three; two of them are questions 5 and 16 of the practice exam. Review (2) has seven, with the lecturer's answers. Together they visit every part of the course: sharing a channel, the transport layer, congestion control, DNS, the web, email and multimedia, and security.",
                     r"第 12 周的两节复习课，最后都给了样题，题型就是期末会考的那种。复习课 (1) 有三道，其中两道是模拟卷的第 5 题和第 16 题；复习课 (2) 有七道，附了老师的答案。合起来正好走遍整门课：共享信道、传输层、拥塞控制、DNS、网页、邮件和多媒体、网络安全。")),
                 p(T(r"Here is each question as a story. Every lesson starts with its question exactly as printed.", r"先用一句话看看每道题讲的是一件什么事。每一课都从题目原文开始。")),
                 table([T('Question', '题'), T('The situation', '题目里发生的事'), T('Lesson', '在哪一课')],
                       [T('R1 · 1', '复1 · 1'), T('A busy office network: when everyone wants to send, which way of sharing the cable wastes less?', '一个很忙的办公室网络：大家都想发的时候，哪种共用电缆的办法浪费更少？'), T('A busy shared channel', '忙碌的共享信道')],
                       [T('R2 · 1', '复2 · 1'), T('A program on one computer wants to talk to a program on another. What does it need to know?', '一台电脑上的程序想和另一台电脑上的程序说话。它需要知道什么？'), T('Reaching a process', '找到一个进程')],
                       [T('R2 · 2', '复2 · 2'), T('Calling a function on a remote server: when is the light, unreliable UDP the better carrier, and when TCP?', '调用远程服务器上的函数：什么时候用轻而不可靠的 UDP 更好，什么时候用 TCP？'), T('Reaching a process', '找到一个进程')],
                       [T('R2 · 3', '复2 · 3'), T('TCP has just lost a segment. How fast does it dare to send for the next four round trips?', 'TCP 刚丢了一个报文段。接下来四个往返，它敢发多快？'), T('Congestion control', '拥塞控制')],
                       [T('R2 · 4', '复2 · 4'), T('Every DNS server in the world crashes at once. What can you still do online?', '全世界的 DNS 服务器同时崩溃。你还能在网上做什么？'), T('Opening a web page', '打开一个网页')],
                       [T('R2 · 5', '复2 · 5'), T('One connection kept open for a whole web page: what it saves, and what it costs.', '为整个网页保持一条连接不断开：省了什么，又付出了什么。'), T('Opening a web page', '打开一个网页')],
                       [T('R2 · 6', '复2 · 6'), T("Email's protocol, SMTP: one strength and one weakness.", '邮件协议 SMTP：一个优点，一个缺点。'), T('Email and multimedia', '邮件与多媒体')],
                       [T('R2 · 7', '复2 · 7'), T('Why music and video are compressed in a way that throws information away.', '为什么音乐和视频要用会丢信息的方式压缩。'), T('Email and multimedia', '邮件与多媒体')],
                       [T('R1 · 2', '复1 · 2'), T('An encrypted file must be read from the middle. Which way of running the cipher allows it?', '一个加密文件要从中间开始读。密码用哪种工作方式才行？'), T('Encrypting a file', '给文件加密')],
                       [T('R1 · 3', '复1 · 3'), T('Seven messages between Alice, a directory and Bob: after which one can Alice be sure she is talking to Bob?', 'Alice、目录和 Bob 之间的七条消息：到哪一条，Alice 能确定对面是 Bob？'), T('Proving who you are', '证明你是谁')])),
            read('order', T('Why the lessons come in this order', '为什么按这个顺序学'),
                 p(T(r"The lessons follow the layers from the cable up, so each one only uses what came before:", r"课的顺序从电缆往上，沿着网络的层次走，每一课只用到前面讲过的东西：")),
                 ol(T(r"**A busy shared channel** (the MAC sublayer): computers that share one cable or one radio channel must decide who speaks.", r"**忙碌的共享信道**（MAC 子层）：共用一根电缆或一个无线信道的电脑，得决定谁来说话。"),
                    T(r"**Reaching a process** (the transport layer): ports, and what UDP and TCP each promise.", r"**找到一个进程**（传输层）：端口，以及 UDP 和 TCP 各自承诺了什么。"),
                    T(r"**Congestion control**: how TCP decides how fast to send. It needs the TCP of lesson 2.", r"**拥塞控制**：TCP 怎么决定发多快。要用到第 2 课的 TCP。"),
                    T(r"**Opening a web page** (DNS and HTTP): first the name becomes an address, then the page comes over TCP. It needs lessons 2 and 3.", r"**打开一个网页**（DNS 和 HTTP）：先把名字变成地址，再通过 TCP 把网页取回来。要用到第 2、3 课。"),
                    T(r"**Email and multimedia**: two more applications, each with its own trade-offs.", r"**邮件与多媒体**：另外两种应用，各有各的取舍。"),
                    T(r"**Encrypting a file** and **proving who you are**: security, which stands on its own.", r"**给文件加密**和**证明你是谁**：网络安全，自成一块。"))),
            read('habits', T('What earns the marks in a short answer', '简答题的分从哪来'),
                 p(T(r"Almost every one of these questions says *briefly explain*. The answer is two to four sentences, and each sentence must carry a reason. Two habits help almost every time.",
                     r"这些题几乎都写着 *briefly explain*（简要解释）。答案两到四句话，但每句话都得带着理由。有两个习惯几乎每次都管用。")),
                 h(T('Which one, and when', '选哪个，在什么条件下')),
                 p(T(r"Half of the questions ask you to choose between two designs: contention or collision-free, UDP or TCP, a connection kept open or closed, lossy or lossless, counter mode or a chained mode. Neither design is simply better: each buys something and pays for it. A full-mark answer names the choice, the condition that makes it right, and the mechanism. For example: *under high load, collision-free, because stations that send when ready collide constantly, while stations that take turns never collide.*",
                     r"一半的题要你在两种设计之间选：竞争还是无冲突，UDP 还是 TCP，连接保持还是关掉，有损还是无损，计数器模式还是链式模式。没有哪种设计是单纯更好的：每种都换来了一些东西，也为此付了代价。满分答案要说出选哪个、在什么条件下选它对、以及背后的机制。比如：*高负载时选无冲突，因为有帧就发的站会不停地撞车，而轮流发的站永远不会撞。*")),
                 h(T('What exactly it does, and what follows when it is gone', '它到底做什么，没了它会怎样')),
                 p(T(r"The other half ask about one piece: DNS, a port, a random number inside a protocol. Say its one job precisely, then follow the consequences step by step. For example: *DNS turns names into addresses; without it, nothing that starts from a name can find its server, but anything that already has the address still works.*",
                     r"另一半问的是某一个部件：DNS、端口、协议里的一个随机数。先准确说出它的那一项职责，再一步一步推后果。比如：*DNS 把名字翻译成地址；没有它，凡是从名字出发的都找不到服务器，但已经知道地址的照样能用。*")),
                 p(T(r"Each lesson ends with an answer written the way it would earn full marks, and says where the marks are.", r"每一课最后都有一份按满分标准写的答案，并说明分在哪里。"))),
            read('how', T('How each lesson works', '每一课怎么走'),
                 ol(T(r"**The question**, as printed (in English, with the Chinese under it), then a slow read: what each term means and what exactly is asked.", r"**题目**原文（英文，下面附中文），然后慢慢读一遍：每个术语是什么意思，到底在问什么。"),
                    T(r"**The ideas** the question needs, from the ground up, with figures; you can drag some of them.", r"**需要的想法**，从头讲起，配上图；有些图可以拖动。"),
                    T(r"**On the exam paper**: the answer built link by link, then written out as a full-mark answer.", r"**写在卷面上**：一环一环把答案搭起来，再写成一份满分答案。"),
                    T(r"**The wider topic**: what else the exam can ask here, taught the same way.", r"**这类题的全貌**：这个话题下考试还可能问什么，同样讲清楚。"),
                    T(r"**Your turn**: new questions. Some you answer in your own words, and the tutor marks them against the points an examiner looks for.", r"**你来**：新的题。有些要你用自己的话作答，由助教按阅卷人看重的要点来批改。")),
                 p(T(r"The last lesson puts every answer pattern on one page, with a drill to do under time.", r"最后一课把所有答题套路放在一页上，再加一组限时练习。")),
                 callout('note', T('The exam is in English', '考试是英文的'),
                         T(r"The Chinese version keeps the English terms beside the Chinese, and every full-mark answer is in English, so you can write in the words the examiner expects.",
                           r"中文版在专业词旁边保留英文，满分答案也用英文写，方便你直接用阅卷人熟悉的词作答。"))),
        ],
    )


def L_mac():
    M, W, X = '8zg9fk.mac-families', '8zg9fk.adaptive-tree-walk', '8zg9fk.maca-wireless'
    return dict(
        id=f'{CID}-exam-mac', title=T('A busy shared channel: contention or collision-free? (R1 · 1)', '忙碌的共享信道：竞争还是无冲突？（复1 · 1）'),
        description=T('Why stations on one channel need rules, what contention and collision-free protocols each waste, how that waste changes with the load, and a full-mark answer.', '共用一条信道为什么需要规则，竞争协议和无冲突协议各自浪费在哪，浪费怎样随负载变化，以及一份满分答案。'),
        minutes=40,
        skills=skills(M, W, X),
        misconceptions=[{'id': 'collision-free-always', 'description': T('Thinking a collision-free protocol is better at every load', '以为无冲突协议在任何负载下都更好')}],
        steps=[
            read('question', T('The question, as printed', '题目原文'),
                 paper(R1(1, ('practice exam, Q5', '模拟卷第 5 题')),
                       T(r"If a LAN is under high load, would it be more efficient to use a contention protocol or a collision-free protocol in the MAC sublayer? Briefly explain your answer.",
                         r"如果一个局域网处于高负载，在 MAC 子层使用竞争协议还是无冲突协议效率更高？简要解释你的答案。")),
                 h(T('Reading it slowly', '慢慢读一遍')),
                 ul(T(r"**A LAN** (local area network) is a network inside one building or campus. The classic picture: many computers on one shared cable, or on one Wi-Fi channel. Whatever one of them sends, all the others hear.", r"**局域网**（LAN, local area network）是一栋楼或一个校园里的网络。经典的样子：很多台电脑接在同一根电缆上，或者用同一个 Wi-Fi 信道。其中一台发的东西，其他所有机器都听得到。"),
                    T(r"**The MAC sublayer** (medium access control) is the lower part of the data link layer. It has one job: decide who may send next on the shared channel.", r"**MAC 子层**（medium access control，介质访问控制）是数据链路层的下半部分。它只有一项职责：决定共享信道上下一个由谁来发。"),
                    T(r"**High load**: many stations have frames waiting to be sent, much of the time. (A *station* is any computer on the channel; a *frame* is one unit of data it sends.)", r"**高负载**（high load）：很多站在很多时候都有帧等着发。（*站* station 是信道上的任何一台电脑；*帧* frame 是它发出的一个数据单位。）"),
                    T(r"**Contention protocol** and **collision-free protocol** are the two families of rules the question compares. Both are built from the ground up below.", r"**竞争协议**（contention protocol）和**无冲突协议**（collision-free protocol）是题目要比较的两类规则。下面从头把两者搭起来。"),
                    T(r"**More efficient**: the channel's time is the resource. Efficiency is the share of that time spent carrying frames that arrive intact, rather than sitting idle, being lost in collisions, or spent on overhead.", r"**效率更高**：信道的时间就是资源。效率是这些时间里真正在运送完好帧的比例，其余的时间要么空着，要么耗在冲突上，要么花在开销上。")),
                 p(T(r"So the question asks: when many stations want to send, which family of rules wastes less of the channel, and why? You need three ideas: why one channel needs rules at all; what each family does and what it wastes; and how that waste grows or shrinks with the load.",
                     r"所以题目问的是：很多站都想发的时候，哪一类规则浪费的信道更少？为什么？需要三个想法：一条信道为什么非要规则不可；两类规则各自怎么做、浪费在哪；以及这种浪费怎样随负载增减。")),
                 chapter=Q_CH()),
            read('channel', T('One channel, many stations', '一条信道，很多台机器'),
                 p(T(r"Picture an office where twenty computers share one cable. A frame on the cable reaches every computer, and the one it is addressed to keeps it. If two computers send at the same moment, their signals add up on the wire and neither frame can be read: a **collision**. Both frames are lost and must be sent again.",
                     r"想象一间办公室，二十台电脑共用一根电缆。电缆上的一个帧会到达每一台电脑，地址对得上的那台把它收下。如果两台电脑同时发，它们的信号在线上叠在一起，两个帧都没法读了：这就是**冲突**（collision）。两个帧都丢了，都得重发。")),
                 p(T(r"The simplest fix is to divide the channel in advance: each computer gets its own time slot (TDM) or its own frequency band (FDM). That suits a fixed group that sends steadily, like phone calls. But computer traffic is **bursty**: a machine is silent for minutes, then sends a burst. With a fixed division, the slots of silent machines go unused while a busy machine waits for its own small share. So a LAN shares its channel **dynamically**, deciding moment by moment who sends. There are two families of rules for doing that.",
                     r"最简单的办法是事先把信道切开：每台电脑分到自己的时隙（TDM）或频段（FDM）。这适合一群固定的、持续在发的用户，比如打电话。可电脑的流量是**突发的**（bursty）：一台机器沉默好几分钟，然后突然发一阵。固定切分时，沉默机器的那份空着没人用，忙的机器却只能等自己那一小份。所以局域网**动态地**分享信道，每时每刻决定谁来发。做法分两大类。")),
                 svg(drawn(fig_share), T('Top: eight time slots of slotted ALOHA; some carry one station\'s frame, two hold collisions (B with C, A with D), two are empty. Bottom: a bit-map round; reservation bits 1, 3 and 6 are set, then stations 1, 3 and 6 send their frames in order, then the next reservation period.',
                                           '上：时隙 ALOHA 的八个时隙；有的装着一个站的帧，两个是冲突（B 和 C、A 和 D），两个空着。下：位图协议的一轮；预约位 1、3、6 被置 1，随后站 1、3、6 依次发帧，接着是下一轮预约。'),
                     T(r"Top: in contention, a station sends when it has a frame, and two in the same slot destroy each other. Bottom: in a collision-free protocol, stations first reserve, then send in turn.",
                       r"上：竞争方式下，有帧就发，两个站落在同一个时隙就互相毁掉。下：无冲突方式下，先预约，再轮流发。")),
                 chapter=IDEAS_CH()),
            read('contention', T('Contention: send when ready, sort out collisions afterwards', '竞争：有帧就发，冲突了再说'),
                 p(T(r"**Contention protocols** let a station send as soon as it has a frame, without asking anyone. If its frame collides, it waits a random time and tries again (random, so that the two that collided do not collide again). The family, as the course lists it:",
                     r"**竞争协议**让一个站一有帧就发，不用问任何人。如果帧撞了，就等一段随机的时间再试（随机，是为了让撞过的两个站不要再撞一次）。课上列出的这一家子：")),
                 ul(T(r"**ALOHA**: send whenever you have a frame.", r"**ALOHA**：有帧就发。"),
                    T(r"**Slotted ALOHA**: time is cut into slots and a frame may start only at the start of a slot, so two frames collide only if they pick the same slot.", r"**时隙 ALOHA**（slotted ALOHA）：时间切成时隙，帧只能在时隙开头开始发，所以只有两个帧挑了同一个时隙才会撞。"),
                    T(r"**CSMA** (carrier sense multiple access): listen first, and do not start while someone else is sending.", r"**CSMA**（载波侦听多路访问）：先听，别人在发的时候不开口。"),
                    T(r"**CSMA/CD** (with collision detection): also stop the moment a collision is heard, so less time is wasted. Classic Ethernet works this way.", r"**CSMA/CD**（带冲突检测）：一听到冲突就立刻停，少浪费时间。经典以太网就是这么做的。")),
                 p(T(r"**At light load this is ideal.** A station with a frame almost always finds the channel free and sends at once: no waiting, no overhead.",
                     r"**负载轻时，这再理想不过。**有帧的站几乎总能碰上空闲的信道，马上就发：不用等，也没有开销。")),
                 p(T(r"**At high load it falls apart.** Count it for slotted ALOHA. Say that on average $G$ frames are sent per slot, counting the retries. A slot carries a frame only when exactly one station sends in it; when two or more do, the slot is a collision. If stations send independently of each other, the share of slots that carry a frame is",
                     r"**负载一高，它就垮了。**拿时隙 ALOHA 算一算。设平均每个时隙有 $G$ 个帧在发（重发的也算）。只有恰好一个站在某个时隙发，这个时隙才运送了一个帧；两个以上，就是冲突。如果各站彼此独立地发，运送了帧的时隙所占的比例是")),
                 math_(r'S = G\,e^{-G}'),
                 p(T(r"and the rest are collisions or empty. In numbers:", r"其余的时隙不是冲突就是空着。具体的数：")),
                 table([T('Frames sent per slot, $G$', '每个时隙发的帧数 $G$'), T('Slots that carry a frame', '运送了帧的时隙'), T('Collisions', '冲突'), T('Empty', '空着')],
                       ['0.25', '19%', '3%', '78%'], ['1', '37%', '26%', '37%'], ['2', '27%', '59%', '14%'], ['4', '7%', '91%', '2%']),
                 p(T(r"Past $G = 1$, the share of useful slots **falls** as the load rises: soon almost every slot is a collision. Worse, every collided frame is sent again, which raises $G$ further: under heavy load a contention protocol feeds its own collisions. (Slotted ALOHA's best is 37%, at $G = 1$; plain ALOHA's best is 18%. Listening first and stopping on a collision make each collision much cheaper, but the trend stays: the more stations are ready, the more often they collide.)",
                     r"$G$ 超过 1 以后，负载越高，有用的时隙反而**越少**：很快几乎每个时隙都是冲突。更糟的是，每个撞掉的帧都要重发，又把 $G$ 推得更高：重负载下，竞争协议是在给自己制造冲突。（时隙 ALOHA 最好也只有 37%，在 $G = 1$ 处；纯 ALOHA 最好只有 18%。先听再发、撞了就停，能让每次冲突便宜得多，但趋势不变：准备发的站越多，撞得越频繁。）"))),
            read('collision-free', T('Collision-free: reserve, then take turns', '无冲突：先预约，再轮流'),
                 p(T(r"**Collision-free protocols** decide who sends *before* anyone sends, so frames never collide. The two in the course:",
                     r"**无冲突协议**在任何人发之前就先定好谁来发，所以帧永远不会撞。课上讲了两种：")),
                 ul(T(r"**The bit-map protocol**: each round starts with a reservation period of $N$ one-bit slots, one per station. Station $j$ puts a 1 in slot $j$ if it has a frame. Everyone hears the whole bit map, so afterwards every station knows the order, and the ready stations send one after another (the bottom of the figure above).",
                      r"**位图协议**（bit-map protocol）：每一轮先有一个预约期，含 $N$ 个一位的时隙，每个站一个。站 $j$ 有帧要发，就在第 $j$ 个时隙里放一个 1。所有站都听得到整个位图，所以预约期一过，大家都知道顺序，有帧的站依次发（上面那张图的下半部分）。"),
                    T(r"**Binary countdown**: stations broadcast their addresses bit by bit, starting from the highest bit; a station that sent a 0 but sees a 1 drops out. The highest address left sends. It costs only $\log_2 N$ bits per frame.",
                      r"**二进制倒计数**（binary countdown）：各站从最高位开始，一位一位地广播自己的地址；发了 0 却看到 1 的站退出。剩下的最高地址的站来发。每帧只花 $\log_2 N$ 位。")),
                 p(T(r"What they waste is **overhead**. The reservation bits are paid every round, whether or not anyone has something to send, and a station with a frame must wait for the reservation period and for its turn, even when the channel is otherwise empty. How much that costs depends on the load, and it is worth counting.",
                     r"它们浪费在**开销**（overhead）上。不管有没有人要发，每一轮都要付预约位；有帧的站即使碰上空荡荡的信道，也得等预约期过完、等轮到自己。这笔开销有多大取决于负载，值得算一算。"))),
            derive('bitmap', T('How efficient the bit-map protocol is', '位图协议的效率有多高'),
                   [(r'T = N + k\,d', T(r"Take $N$ stations, and frames that each last $d$ bit-slots. One round lasts $T$: the $N$ reservation slots plus one frame from each of the $k$ stations that set their bit.", r"设有 $N$ 个站，每帧占 $d$ 个位时隙。一轮的长度 $T$：$N$ 个预约时隙，加上置了 1 的 $k$ 个站各发一帧。")),
                    (r'\eta = \frac{k\,d}{N + k\,d}', T(r"The efficiency $\eta$ is the share of the round spent carrying frames.", r"效率 $\eta$ 是一轮里用来运送帧的时间所占的比例。")),
                    (r'\eta = \frac{d}{d + N}', T(r"**Light load**: only one station has a frame ($k = 1$), so one frame pays for the whole reservation period.", r"**负载轻**：只有一个站有帧（$k = 1$），一个帧要独自负担整个预约期。")),
                    (r'\eta = \frac{N d}{N d + N} = \frac{d}{d + 1}', T(r"**High load**: every station has a frame ($k = N$). The $N$ reservation bits are now shared by $N$ frames: one bit per frame.", r"**负载高**：每个站都有帧（$k = N$）。$N$ 个预约位由 $N$ 个帧分摊：每帧一位。")),
                    (r'\frac{500}{500 + 64} \approx 0.89', T(r"With 64 stations and frames of 500 bits: at light load, 11% of the channel goes on reservations,", r"代入 64 个站、每帧 500 位：负载轻时，11% 的信道花在预约上，")),
                    (r'\frac{500}{500 + 1} \approx 0.998', T(r"and at high load only 0.2%.", r"负载高时只有 0.2%。"))],
                   blank=(2, 'd/(d+N)', T(r"Light load: one frame per round ($k = 1$). Write the efficiency in terms of $d$ and $N$.", r"负载轻：每轮只有一个帧（$k = 1$）。用 $d$ 和 $N$ 写出效率。"), ['d', 'N']),
                   outro=T(r"A collision-free protocol gets *better* as the load rises: its fixed overhead is shared by more frames. A contention protocol gets *worse*: more ready stations, more collisions. That contrast is the whole answer.",
                           r"无冲突协议负载越高越*好*：固定的开销由更多的帧分摊。竞争协议负载越高越*差*：准备发的站越多，撞得越多。这个对比就是整道题的答案。"),
                   skill=M),
            read('load', T('Both, as the load rises', '负载升高时，两者对比'),
                 visual('it_mac_load', T(r"Drag the load $G$, the frames offered per frame time. Slotted ALOHA's useful share peaks at 37% and then falls as collisions take over; a collision-free protocol (bit-map) carries everything offered until the channel is full, losing only its reservation bits. The bars show what the channel's time is spent on.",
                                         r"拖动负载 $G$，即每个帧时间里要发的帧数。时隙 ALOHA 的有效比例在 37% 处到顶，之后冲突占了上风，比例一路下降；无冲突协议（位图）把要发的帧全部送达，直到信道占满，只损失预约位。下面的条显示信道的时间都花在了哪里。")),
                 p(T(r"The course's slide puts it in two lines: under low loads, collision-free methods are less attractive because of their overhead; under higher loads, contention methods are less attractive because of the many collisions. Each becomes inefficient, at opposite ends.",
                     r"课件用两句话说了这件事：负载低时，无冲突方法因为开销而不划算；负载高时，竞争方法因为冲突太多而不划算。两者都会变得低效，只是在相反的两头。")),
                 table([T('Protocol', '协议'), T('Light load', '负载轻'), T('High load', '负载高')],
                       [T('Contention', '竞争'), T('sends at once; collisions are rare', '马上就发；很少冲突'), T('mostly collisions and retries', '大多是冲突和重发')],
                       [T('Collision-free', '无冲突'), T('reservations paid for few frames; waits for its turn on an empty channel', '为很少的帧付预约开销；信道空着也得等轮次'), T('no collisions; overhead shared by many frames', '没有冲突；开销由很多帧分摊')],
                       [T('Better', '更好的'), T('contention', '竞争'), T('collision-free', '无冲突')]),
                 quiz(T(r"A collision-free protocol never wastes time on collisions. Why is it not the better choice at every load?", r"无冲突协议从不在冲突上浪费时间。为什么它不是在任何负载下都更好？"),
                      [(T(r"At light load its reservations are paid for few frames, and a station waits for its turn on an empty channel", r"负载轻时，预约开销只由很少的帧负担，而且信道空着，有帧的站也得等轮次"), True),
                       (T(r"Collisions still happen during the reservation period", r"预约期里还是会冲突"), T(r"No: in the bit-map protocol each station has a reservation slot of its own, so even the reservations never collide.", r"不会：位图协议里每个站有自己专属的预约时隙，连预约都不会撞。")),
                       (T(r"It carries fewer frames than contention at high load", r"高负载时它运送的帧比竞争协议少"), T(r"The opposite: at high load it uses almost the whole channel, while contention loses most of it to collisions.", r"正相反：高负载时它几乎用满整条信道，而竞争协议的大部分信道都耗在冲突上。"))],
                      T(r"Its cost is fixed per round. Shared by many frames it is almost nothing; paid by one frame it is the main cost, and every sender waits.", r"它的开销每轮固定。由很多帧分摊时几乎为零；由一个帧独自负担时就成了主要成本，而且每个发送者都得等。"))),
            read('paper-answer', T('A full-mark answer', '一份满分答案'),
                 p(T(r"The answer is a chain of four links; each becomes a sentence on the paper:", r"答案是四环相扣的一条链，每一环在卷面上写成一句话：")),
                 ol(T(r"**The choice**: a collision-free protocol.", r"**结论**：无冲突协议。"),
                    T(r"**What high load means here**: many stations have frames to send at the same time.", r"**高负载在这里意味着什么**：很多站同时有帧要发。"),
                    T(r"**Why contention fails**: stations send when ready, so with many ready they collide often; colliding frames are destroyed and must be sent again, so much of the channel time is wasted, and the retries add yet more load.", r"**竞争协议为什么不行**：各站有帧就发，准备发的站一多就频繁冲突；撞了的帧被毁掉，必须重发，大量信道时间被浪费，重发又进一步加重负载。"),
                    T(r"**Why collision-free wins**: stations take turns (by reservation, or by address), so nothing collides, and the fixed overhead is shared by many frames.", r"**无冲突协议为什么更好**：各站轮流发（靠预约或靠地址），什么都不会撞，固定的开销由很多帧分摊。")),
                 paper(T('Review (1), Q1 · a full-mark answer', '复习课 (1) 第 1 题 · 满分答案'),
                       T(r"A collision-free protocol is more efficient. Under high load many stations have frames to send at the same time, so a contention protocol (e.g. slotted ALOHA or CSMA) would suffer frequent collisions: the colliding frames are destroyed and must be retransmitted, wasting much of the channel's capacity. A collision-free protocol (e.g. the bit-map protocol) lets each station transmit in turn, so no collisions occur, and its reservation overhead is shared among many frames. (Under low load the reverse holds: a contention protocol can send immediately, while the collision-free overhead dominates.)",
                         r"无冲突协议效率更高。高负载时很多站同时有帧要发，竞争协议（如时隙 ALOHA 或 CSMA）会频繁冲突：撞了的帧被毁掉，必须重传，浪费大量信道容量。无冲突协议（如位图协议）让每个站轮流发送，不会发生冲突，而且预约开销由很多帧分摊。（负载低时情况相反：竞争协议可以马上发送，而无冲突协议的开销占了大头。）"),
                       answer=True),
                 p(T(r"The last sentence is not asked for, but one line that says when the answer flips shows the examiner you understand the trade-off rather than a memorised fact. The marks are in the mechanism: *collisions waste the channel* and *taking turns avoids them*; the bare word *collision-free* earns little on its own.",
                     r"最后一句题目没问，但用一句话说明答案在什么时候反过来，能让阅卷人看出你懂的是这个取舍，而不是背了一个结论。分在机制上：*冲突浪费信道*、*轮流发避免冲突*；光写一个“无冲突”拿不到多少分。")),
                 chapter=PAPER_CH()),
            read('tree', T('Limited contention: the best of both ends', '有限竞争：两头的好处都要'),
                 p(T(r"If contention is best at light load and collision-free at high load, can one protocol do both? **Limited contention** protocols try. They let stations contend, but in small groups, so a collision involves few stations and is quickly resolved. The course's example is the **adaptive tree walk**.",
                     r"既然竞争协议在负载轻时最好、无冲突协议在负载高时最好，能不能有一个协议两头都占？**有限竞争**（limited contention）协议就是这么想的：让各站竞争，但分成小组来争，这样一次冲突只牵涉很少的站，很快就能解决。课上的例子是**自适应树遍历**（adaptive tree walk）。")),
                 p(T(r"Put the stations at the leaves of a binary tree. In the first slot every ready station may send. If exactly one does, it gets through. If they collide, the search goes down the tree, depth first: in the next slot only the stations under node 2 may send, then those under node 4, and so on. Each slot probes one group: a group with exactly one ready station gets its frame through, and a group that collides is split in two.",
                     r"把各站放在一棵二叉树的叶子上。第一个时隙里，所有准备好的站都可以发。恰好只有一个，它就成功了。撞了，就沿着树往下、深度优先地找：下一个时隙只许节点 2 下面的站发，再下一个只许节点 4 下面的，依此类推。每个时隙探查一个组：组里恰好一个站准备好，它的帧就成功送出；组里撞了，就再一分为二。")),
                 svg(drawn(fig_tree), T('A binary tree: node 1 at the top, nodes 2 and 3, nodes 4 to 7, and stations A to H at the leaves. B, D and G are ready. Probe order: slot 1 at node 1, slot 2 at node 2 (both collisions), slot 3 at node 4, slot 4 at node 5, slot 5 at node 3.',
                                          '一棵二叉树：顶上是节点 1，下面是节点 2、3，再下面是节点 4 到 7，叶子是站 A 到 H。B、D、G 准备好了。探查顺序：时隙 1 在节点 1，时隙 2 在节点 2（两次都冲突），时隙 3 在节点 4，时隙 4 在节点 5，时隙 5 在节点 3。'),
                     T(r"The course's Example 2: B, D and G are ready. Slot 1, everyone: collision. Slot 2, node 2 (A to D): B and D collide. Slot 3, node 4: B alone sends. Slot 4, node 5: D sends. Slot 5, node 3 (E to H): G sends.",
                       r"课上的例 2：B、D、G 准备好了。时隙 1，所有站：冲突。时隙 2，节点 2（A 到 D）：B 和 D 冲突。时隙 3，节点 4：只有 B，发送成功。时隙 4，节点 5：D 发送。时隙 5，节点 3（E 到 H）：G 发送。")),
                 p(T(r"At light load the first slot usually holds one station or none, so it behaves like contention. At high load the search quickly narrows to groups of one, so it behaves like a collision-free protocol. (The course's Example 1: only D and G are ready. Slot 1 collides; slot 2, node 2, holds D alone; slot 3, node 3, holds G alone: three slots.)",
                     r"负载轻时，第一个时隙里通常只有一个站或没有站，它表现得像竞争协议。负载高时，搜索很快缩到只有一个站的小组，它表现得像无冲突协议。（课上的例 1：只有 D 和 G 准备好。时隙 1 冲突；时隙 2，节点 2 里只有 D；时隙 3，节点 3 里只有 G：一共三个时隙。）")),
                 chapter=WIDER_CH()),
            read('csma', T('Listening first, how eagerly, and on the air', '先听再发、有多心急，以及无线的情形'),
                 p(T(r"The CSMA variants differ in what a station does when it hears the channel busy:", r"CSMA 的几个变种，区别在于听到信道忙时怎么办：")),
                 ul(T(r"**1-persistent**: keep listening, and send the instant the channel goes idle.", r"**1-坚持**（1-persistent）：一直听着，信道一空闲马上发。"),
                    T(r"**Non-persistent**: if busy, wait a random time before listening again.", r"**非坚持**（non-persistent）：信道忙就等一段随机时间再去听。"),
                    T(r"**p-persistent** (slotted): when idle, send with probability $p$; otherwise wait for the next slot and check again.", r"**p-坚持**（p-persistent，分时隙）：信道空闲时以概率 $p$ 发送，否则等到下一个时隙再看。")),
                 p(T(r"The course's comparison: CSMA beats ALOHA, and **being less persistent is better under high load**. It is the same story as the question. With 1-persistent CSMA, every station that was waiting pounces the instant the channel frees up, so under high load they collide almost every time; waiting a random time spreads them out.",
                     r"课上的比较：CSMA 比 ALOHA 好，而且**高负载时越不心急越好**。道理和这道题一样。1-坚持 CSMA 下，所有在等的站会在信道空出来的那一刻同时扑上去，高负载时几乎每次都撞；随机等一会儿，就把它们错开了。")),
                 p(T(r"**Collision detection** (CSMA/CD) shortens each collision: a station stops as soon as it hears one, so a collision costs a short contention slot instead of a whole frame. **Switched Ethernet** removes the problem altogether: each cable joins one computer to its own switch port, so there is no shared channel to contend for.",
                     r"**冲突检测**（CSMA/CD）缩短了每次冲突：站一听到冲突就停，一次冲突只损失一个很短的竞争时隙，而不是一整个帧。**交换式以太网**干脆把问题消掉了：每根电缆只把一台电脑接到交换机的一个端口上，没有共享的信道，也就无所谓争抢。")),
                 h(T('On the air: you cannot hear every collision', '无线上：不是每次冲突都听得到')),
                 p(T(r"On a wireless LAN a station hears only the stations within its range, and what matters is a collision at the *receiver*. Two problems follow:", r"在无线局域网里，一个站只听得到范围内的站，而要紧的是*接收方*那里有没有冲突。于是有两个问题：")),
                 svg(drawn(fig_terminals), T('Hidden terminals: A, B and C in a row; A and C both send to B but are out of each other\'s range, and collide at B. Exposed terminals: A, B, C and D in a row; B sends to A and C sends to D; B and C hear each other, yet both transfers can go on at once.',
                                               '隐藏终端：A、B、C 排成一行；A 和 C 都在向 B 发，但彼此听不到，于是在 B 处冲突。暴露终端：A、B、C、D 排成一行；B 发给 A，C 发给 D；B 和 C 互相听得到，可两次传输其实可以同时进行。'),
                     T(r"**Hidden terminals**: A and C cannot hear each other, so carrier sense tells neither that the other is sending, and their frames collide at B. **Exposed terminals**: B and C hear each other, so carrier sense holds one of them back, although B → A and C → D would not interfere.",
                       r"**隐藏终端**：A 和 C 彼此听不到，载波侦听告诉不了谁对方在发，两个帧在 B 处撞上。**暴露终端**：B 和 C 互相听得到，载波侦听会让其中一个闭嘴，可 B → A 和 C → D 其实互不干扰。")),
                 p(T(r"**MACA** solves both by talking about the receiver. The sender first sends a short **RTS** (request to send); the receiver answers with a short **CTS** (clear to send), which carries the length of the coming frame. Every station that hears the CTS is near the receiver, so it stays quiet for that long. A station that hears only the RTS is near the sender but not the receiver, so it may send. The CTS silences hidden terminals; exposed terminals stay free.",
                     r"**MACA** 把注意力放到接收方，两个问题一起解决。发送方先发一个短的 **RTS**（request to send，请求发送）；接收方回一个短的 **CTS**（clear to send，允许发送），里面带着接下来那个帧的长度。凡是听到 CTS 的站都在接收方附近，就在这段时间里保持安静。只听到 RTS 的站在发送方附近、不在接收方附近，照样可以发。CTS 让隐藏终端闭嘴，暴露终端则不受限制。"))),
            text_q('try-light', T('Your turn: a quiet LAN', '你来：一个安静的局域网'), M,
                   T(r"A LAN connects 40 sensors, each of which sends a short reading a few times an hour. Would a contention protocol or a collision-free protocol be more efficient here? Briefly explain.",
                     r"一个局域网连着 40 个传感器，每个每小时发几条简短的读数。这里用竞争协议还是无冲突协议效率更高？简要解释。"),
                   [T('A contention protocol', '竞争协议'),
                    T('The load is light, so collisions are rare and a sensor can send at once', '负载很轻，冲突很少，传感器可以马上发'),
                    T('A collision-free protocol would pay its reservation overhead (and the wait for a turn) for very few frames', '无冲突协议要为很少的帧付预约开销，还要等轮次')],
                   T(r"A contention protocol. The load is light, so collisions are rare and a sensor can send its reading as soon as it has one. A collision-free protocol would spend most of the channel on reservations that nobody uses, and make every sensor wait for its turn.",
                     r"竞争协议。负载很轻，冲突很少，传感器一有读数就能马上发。无冲突协议会把大部分信道花在没人用的预约上，还要让每个传感器等轮次。"),
                   T(r"The same trade-off as the exam question, at the other end of the load: contention costs nothing when collisions are rare, while a collision-free protocol's overhead is fixed per round.",
                     r"和考题是同一个取舍，只是在负载的另一头：冲突很少时竞争几乎不花代价，而无冲突协议的开销每轮都是固定的。"),
                   chapter=TRY_CH()),
            choice('try-tree', T('Your turn: both ends at once', '你来：两头兼顾'), W,
                   T(r"Which protocol behaves like a contention protocol at light load and like a collision-free one at high load?", r"哪个协议在负载轻时像竞争协议，在负载高时像无冲突协议？"),
                   [(T('The adaptive tree walk', '自适应树遍历'), True),
                    (T('Binary countdown', '二进制倒计数'), T(r"That is collision-free at every load: it spends $\log_2 N$ bits on the countdown before every frame.", r"它在任何负载下都是无冲突的：每帧之前都要花 $\log_2 N$ 位倒计数。")),
                    (T('1-persistent CSMA', '1-坚持 CSMA'), T(r"Contention at every load, and the worst of the CSMA family under high load: every waiting station pounces at once.", r"任何负载下都是竞争，而且高负载时是 CSMA 里最差的：所有等着的站会同时扑上去。")),
                    (T('Slotted ALOHA', '时隙 ALOHA'), T(r"Contention at every load: at high load most of its slots are collisions.", r"任何负载下都是竞争：高负载时大多数时隙是冲突。"))],
                   T(r"The adaptive tree walk lets everyone contend in the first slot, which is cheap when few are ready, and splits a colliding group in two at each step, so under heavy load it ends up giving each station a slot of its own.",
                     r"自适应树遍历在第一个时隙让大家一起争，准备发的站少时很省；一旦撞了就一步步把组一分为二，所以重负载时最后等于给每个站一个专属的时隙。")),
            number('try-aloha', T('Your turn: slotted ALOHA at G = 2', '你来：G = 2 的时隙 ALOHA'), M,
                   T(r"In slotted ALOHA, $G = 2$ frames are sent per slot on average. What share of the slots carry a frame successfully? (A decimal, such as 0.37.)", r"时隙 ALOHA 里，平均每个时隙发 $G = 2$ 个帧。有多大比例的时隙成功运送了一个帧？（写成小数，比如 0.37。）"),
                   0.27, T(r"$S = 2e^{-2} \approx 0.27$: only 27% of the slots are useful, and about 59% are collisions.", r"$S = 2e^{-2} \approx 0.27$：只有 27% 的时隙有用，约 59% 是冲突。"),
                   tolerance=0.01, hints=[T(r"A slot is useful when exactly one frame is sent in it: $S = G e^{-G}$.", r"恰好有一个帧在发的时隙才有用：$S = G e^{-G}$。")]),
            choice('try-maca', T('Your turn: who stays quiet', '你来：谁该闭嘴'), X,
                   T(r"With MACA, A sends an RTS to B and B answers with a CTS. Station E hears B's CTS but not A's RTS. What should E do?", r"在 MACA 下，A 向 B 发 RTS，B 回了 CTS。站 E 听到了 B 的 CTS，却没听到 A 的 RTS。E 该怎么做？"),
                   [(T(r"Stay quiet until A's frame to B has been sent: E is near the receiver", r"保持安静，直到 A 发给 B 的帧发完：E 在接收方附近"), True),
                    (T(r"Send freely: it cannot hear A, so it cannot disturb A", r"随便发：它听不到 A，也就干扰不到 A"), T(r"What matters is the receiver. E reaches B, so its frame would collide with A's at B: E is a hidden terminal.", r"要紧的是接收方。E 的信号能到 B，它的帧会在 B 处和 A 的撞上：E 是隐藏终端。")),
                    (T(r"Send an RTS of its own at once", r"马上发一个自己的 RTS"), T(r"The CTS announced how long B will be receiving; until then anything E sends reaches B and spoils A's frame.", r"CTS 已经说明了 B 要接收多久；在这之前 E 发什么都会到 B，毁掉 A 的帧。"))],
                   T(r"Hearing the CTS means being near the receiver: stay quiet for the length the CTS announced. Hearing only the RTS means being near the sender only: sending is safe.", r"听到 CTS，说明在接收方附近：在 CTS 声明的时长内保持安静。只听到 RTS，说明只在发送方附近：可以放心发。")),
        ],
    )


def L_transport():
    A, K, U, C = 'uk72ey.addressing', 'uk72ey.sockets', '4952m9.udp', '4952m9.tcp-service-model'
    Q1, Q2 = T('Question 1: reaching a process', '第 1 题：找到一个进程'), T('Question 2: RPC over UDP or TCP', '第 2 题：RPC 用 UDP 还是 TCP')
    return dict(
        id=f'{CID}-exam-transport', title=T('Reaching a process, and RPC over UDP or TCP (R2 · 1, 2)', '找到一个进程，以及 RPC 用 UDP 还是 TCP（复2 · 1、2）'),
        description=T('Why an IP address is not enough to reach a program, what ports and sockets add, what UDP and TCP each promise, and why idempotence decides the RPC question.', '为什么光有 IP 地址找不到一个程序，端口和套接字补上了什么，UDP 和 TCP 各承诺了什么，以及为什么幂等性决定了 RPC 那道题。'),
        minutes=40,
        skills=skills(A, K, U, C),
        misconceptions=[{'id': 'ip-is-enough', 'description': T('Thinking an IP address alone reaches a program', '以为光凭 IP 地址就能找到一个程序')},
                        {'id': 'tcp-always', 'description': T('Thinking TCP is always the better choice because it is reliable', '以为 TCP 可靠，所以总是更好的选择')}],
        steps=[
            read('q1', T('Question 1, as printed', '第 1 题原文'),
                 paper(R2(1), T(r"What information is used by a process running on one host to connect to a process running on another host?",
                                r"一台主机上运行的进程，要连接另一台主机上运行的进程，用的是什么信息？")),
                 h(T('Reading it slowly', '慢慢读一遍')),
                 ul(T(r"**A host** is a computer on the network. **A process** is a running program: your browser, a web server, a mail server. One host runs many processes at once.", r"**主机**（host）是网络上的一台电脑。**进程**（process）是一个正在运行的程序：你的浏览器、一个网页服务器、一个邮件服务器。一台主机同时运行着很多进程。"),
                    T(r"**Connect**: start a conversation, as a browser does with a web server.", r"**连接**（connect）：建立一次对话，就像浏览器和网页服务器之间那样。"),
                    T(r"So the question asks: what *address* does one running program use to name another running program on a different computer?", r"所以题目问的是：一个运行中的程序，用什么*地址*来指明另一台电脑上的另一个运行中的程序？")),
                 p(T(r"Two ideas answer it: what the network layer's address, the IP address, can and cannot do; and the piece the transport layer adds, the port, which programs use through sockets.",
                     r"两个想法就能回答：网络层的地址（IP 地址）能做什么、不能做什么；以及传输层补上的那一块，端口，程序通过套接字来用它。")),
                 chapter=Q1),
            read('ports', T('An IP address finds the host; a port finds the process', 'IP 地址找到主机，端口找到进程'),
                 p(T(r"The network layer delivers a packet to a **host**, named by its **IP address**, such as 128.250.1.7. But a packet is not meant for the host as a whole; it is meant for one program on it. A server may run a web server, a mail server and a DNS server at the same time; your laptop runs a browser with several tabs, a mail client and a chat app. When a segment arrives, which of them gets it?",
                     r"网络层把一个包送到一台**主机**，主机用它的 **IP 地址**来命名，比如 128.250.1.7。可一个包并不是发给整台主机的，而是发给上面的某一个程序。一台服务器可能同时运行着网页服务器、邮件服务器和 DNS 服务器；你的笔记本上开着有好几个标签页的浏览器、邮件客户端、聊天软件。一个报文段到了，该交给谁？")),
                 p(T(r"The transport layer adds a second, smaller address: the **port**, a 16-bit number from 0 to 65535. A process that wants to receive *binds* to a port, and the transport layer hands every arriving segment to the process bound to its destination port. Carrying many conversations through one IP address and sorting them apart again on arrival is called **multiplexing** and **demultiplexing**.",
                     r"传输层加了第二个、更小的地址：**端口**（port），一个 16 位的数，从 0 到 65535。想接收数据的进程先*绑定*（bind）一个端口，传输层把每个到达的报文段交给绑定在它目的端口上的那个进程。让很多路对话共用一个 IP 地址、到达时再把它们分开，叫**复用**（multiplexing）和**分用**（demultiplexing）。")),
                 svg(drawn(fig_ports), T('A segment addressed to 128.250.1.7, port 80, arrives at host 128.250.1.7, which runs a web server on port 80, a mail server on port 25 and a browser on port 52311. The transport layer passes it to the web server.',
                                           '一个发往 128.250.1.7、端口 80 的报文段到达主机 128.250.1.7。主机上运行着端口 80 的网页服务器、端口 25 的邮件服务器和端口 52311 的浏览器。传输层把它交给网页服务器。'),
                     T(r"The IP address gets the segment to the host; the transport layer reads the destination port and hands it to the process bound to that port.", r"IP 地址把报文段送到主机；传输层读出目的端口，把它交给绑定在这个端口上的进程。")),
                 p(T(r"The course's names for the two: the network layer's address is an **NSAP** (network service access point), which on the Internet is the IP address; the transport layer's is a **TSAP** (transport service access point), which on the Internet is the port.",
                     r"课上对这两者的叫法：网络层的地址叫 **NSAP**（network service access point，网络服务访问点），在互联网上就是 IP 地址；传输层的叫 **TSAP**（transport service access point，传输服务访问点），在互联网上就是端口。")),
                 table([T('Ports', '端口'), T('Range', '范围'), T('Used for', '用途')],
                       [T('Well-known', '知名端口'), '0–1023', T('standard servers: 80 HTTP, 443 HTTPS, 25 SMTP, 53 DNS', '标准服务器：80 HTTP、443 HTTPS、25 SMTP、53 DNS')],
                       [T('Registered', '注册端口'), '1024–49151', T('other services that registered a number', '登记过号码的其他服务')],
                       [T('Dynamic', '动态端口'), '49152–65535', T("a client's own port, picked for each connection", '客户端自己的端口，每次连接临时选一个')]),),
            read('sockets', T('Sockets: how a program uses it', '套接字：程序怎么用它'),
                 p(T(r"A program reaches all this through a **socket**: a transport endpoint, created by the program and handed to the operating system. The server and the client do different things with theirs:",
                     r"程序通过**套接字**（socket）来用这一切：套接字是一个传输端点，由程序创建、交给操作系统管理。服务器和客户端拿它做的事不一样：")),
                 {'type': 'code', 'lang': 'text', 'code': 'SERVER                         CLIENT\nsocket()                       socket()\nbind(port 80)\nlisten()\naccept()   <-- connection -->  connect(128.250.1.7, 80)\nreceive() / send()             send() / receive()\nclose()                        close()'},
                 p(T(r"The server calls **bind** to attach its socket to a known port (80 for the web), so that others can find it, then **listen** and **accept** to wait for connections. The client needs no fixed port: the operating system gives its socket a free one. To **connect**, the client names exactly two things: the server's **IP address**, and the **port** the server's socket is bound to.",
                     r"服务器调用 **bind** 把套接字绑定到一个大家都知道的端口（网页是 80），好让别人找得到，然后用 **listen** 和 **accept** 等待连接。客户端不需要固定的端口：操作系统给它的套接字随便分一个空闲的。要 **connect**（连接），客户端只需要说出两样东西：服务器的 **IP 地址**，以及服务器套接字绑定的那个**端口**。")),
                 p(T(r"A TCP connection is then identified by four numbers: (source IP, source port, destination IP, destination port). That is how one web server on port 80 keeps thousands of clients apart: every connection differs in the client's address or port.",
                     r"一条 TCP 连接于是由四个数确定：（源 IP，源端口，目的 IP，目的端口）。一个在端口 80 上的网页服务器，就是靠这个把成千上万个客户端区分开的：每条连接的客户端地址或端口都不一样。")),
                 quiz(T(r"A server runs a web server on port 80 and a mail server on port 25. A segment arrives addressed to the server's IP address. How does it reach the mail server rather than the web server?", r"一台服务器在端口 80 运行网页服务器，在端口 25 运行邮件服务器。一个报文段发到了这台服务器的 IP 地址。它怎么到了邮件服务器而不是网页服务器？"),
                      [(T(r"Its destination port is 25", r"它的目的端口是 25"), True),
                       (T(r"The IP address says which program it is for", r"IP 地址说明了它是给哪个程序的"), T(r"One IP address names the whole host; every process on that host shares it.", r"一个 IP 地址指的是整台主机；主机上的所有进程共用它。")),
                       (T(r"The mail server reads every segment and keeps its own", r"邮件服务器读每个报文段，把自己的留下"), T(r"The transport layer sorts segments by destination port before any program sees them.", r"在任何程序看到之前，传输层就已经按目的端口把报文段分好了。"))],
                      T(r"Demultiplexing by port: the transport layer reads the destination port of each segment and passes it to the socket bound to that port.", r"按端口分用：传输层读出每个报文段的目的端口，交给绑定在这个端口上的套接字。"))),
            read('q1-answer', T('Question 1: a full-mark answer', '第 1 题：满分答案'),
                 p(T(r"Two links: the IP address finds the host; the port, to which the destination process's socket is bound, finds the process on that host.", r"两环：IP 地址找到主机；目的进程的套接字所绑定的端口，找到这台主机上的那个进程。")),
                 paper(T('Review (2), Q1 · a full-mark answer', '复习课 (2) 第 1 题 · 满分答案'),
                       T(r"It uses the IP address of the destination host and the port number to which the socket of the destination process is bound. The IP address (the network-layer address, NSAP) gets the segments to the right host; since many processes on that host share its IP address, the port number (the transport-layer address, TSAP) identifies which process should receive them.",
                         r"它用的是目的主机的 IP 地址，以及目的进程的套接字所绑定的端口号。IP 地址（网络层地址，NSAP）把报文段送到正确的主机；由于这台主机上的很多进程共用它的 IP 地址，端口号（传输层地址，TSAP）指明由哪个进程来接收。"),
                       answer=True),
                 p(T(r"The lecturer's answer is a single line: *the IP address and the port number to which the socket in the destination process is bound*. Keep the words *to which the socket is bound*: the port belongs to the destination process, which bound to it so that it could be found.",
                     r"老师的答案只有一行：*the IP address and the port number to which the socket in the destination process is bound*。*to which the socket is bound* 这几个词要留着：端口属于目的进程，是它为了能被找到而绑定的。")),),
            read('q2', T('Question 2, as printed', '第 2 题原文'),
                 paper(R2(2), T(r"Remote Procedure Call (RPC) allows a client to invoke a procedure (e.g., a function) in a remote server. Several RPC implementations provide the client with the option to use RPC implemented over UDP or RPC implemented over TCP. Under what conditions will a client prefer to use RPC over UDP, and under what conditions will they prefer to use RPC over TCP? Explain your answer.",
                                r"远程过程调用（RPC）让客户端可以调用远程服务器上的过程（例如一个函数）。有些 RPC 实现让客户端可以选择基于 UDP 的 RPC 或基于 TCP 的 RPC。在什么条件下客户端会更愿意用基于 UDP 的 RPC，在什么条件下更愿意用基于 TCP 的 RPC？解释你的答案。")),
                 h(T('Reading it slowly', '慢慢读一遍')),
                 ul(T(r"**RPC** (remote procedure call): the client calls a function as if it were local, say `get_balance(42)`. Behind the scenes the call becomes a request message to a server; the server runs the function and sends the result back in a reply message.", r"**RPC**（remote procedure call，远程过程调用）：客户端像调用本地函数一样调用一个函数，比如 `get_balance(42)`。背后，这次调用变成发给服务器的一条请求消息；服务器执行这个函数，再用一条回复消息把结果送回来。"),
                    T(r"Each call is one small request and one small reply, and RPC can carry them over either transport protocol.", r"每次调用就是一条小请求加一条小回复，RPC 可以用两种传输协议中的任何一种来运送。"),
                    T(r"**Under what conditions** asks for the property that tips the choice, in each direction; **explain** asks why it tips it.", r"**在什么条件下**问的是让天平倾向某一边的那个性质，两个方向都要说；**解释**问的是为什么会倾向那边。")),
                 p(T(r"The ideas: what UDP and TCP each promise; what a lost message does to a call; and one property of a procedure, *idempotence*, which decides whether losing a message is harmless.",
                     r"需要的想法：UDP 和 TCP 各承诺了什么；丢了一条消息，对一次调用意味着什么；以及过程的一个性质——*幂等性*，它决定了丢消息是否无害。")),
                 chapter=Q2),
            read('udp-tcp', T('What UDP and TCP each promise', 'UDP 和 TCP 各承诺了什么'),
                 p(T(r"**UDP** adds almost nothing to IP: ports, so a datagram reaches the right process, and an optional checksum. It makes no promise that a datagram arrives, arrives once, or arrives in order. In exchange it costs nothing to start: the very first datagram can carry the request, and neither side keeps any state.",
                     r"**UDP** 在 IP 之上几乎什么都没加：只有端口（让数据报到达正确的进程）和一个可选的校验和。它不保证数据报一定到达、只到一次、按顺序到。作为交换，它启动起来毫无代价：第一个数据报就可以带着请求，双方也都不用保存任何状态。")),
                 p(T(r"**TCP** builds a reliable byte stream on top of the unreliable network. Lost segments are retransmitted, segments that arrive out of order are put back in order, and **duplicate segments are recognised by their sequence numbers and discarded**, so each byte is delivered exactly once. The price: before any data, a three-way handshake costs one round trip (RTT), and both ends keep connection state (buffers, timers, sequence numbers) until the connection is released.",
                     r"**TCP** 在不可靠的网络上搭出一条可靠的字节流。丢了的报文段会重传，乱序到达的会重新排好，**重复的报文段会凭序号认出来并丢弃**，所以每个字节恰好送达一次。代价是：传数据之前，三次握手要花一个往返时间（RTT），而且两端都要一直保存连接状态（缓冲区、计时器、序号），直到连接释放。")),
                 table([T('When', '情形'), 'UDP', 'TCP'],
                       [T('A lost message', '消息丢了'), T('stays lost', '就丢了'), T('retransmitted until delivered', '重传，直到送达')],
                       [T('A duplicate', '重复的消息'), T('delivered twice', '会被交付两次'), T('recognised and discarded', '被认出并丢弃')],
                       [T('Order', '顺序'), T('any', '不保证'), T('kept', '保持')],
                       [T('Before the first request', '第一条请求之前'), T('nothing', '什么都不用'), T('a handshake: one RTT', '一次握手：一个 RTT')],
                       [T('State at each end', '两端的状态'), T('none', '没有'), T('a connection', '一条连接')]),),
            read('lost', T('When a call gets no reply', '一次调用没收到回复'),
                 p(T(r"Over UDP, the client sends its request and waits. If no reply comes before a timeout, the only thing it can do is send the request again. But think about what may have happened:",
                     r"用 UDP 时，客户端发出请求就等着。超时了还没收到回复，它唯一能做的就是再发一次请求。但想想可能发生了什么：")),
                 svg(drawn(fig_rpc_lost), T('Two timelines. (a) The request is lost on the way; the server never runs the procedure; the client times out. (b) The request arrives, the server runs the procedure, the reply is lost; the client times out.',
                                              '两条时间线。(a) 请求在路上丢了；服务器根本没有执行；客户端超时。(b) 请求到了，服务器执行了这个过程，回复丢了；客户端超时。'),
                     T(r"To the client both look the same: silence, then a timeout. In (a) the server never ran the procedure; in (b) it already did. If the client calls again, in (b) the procedure runs twice.",
                       r"在客户端看来两种情况一模一样：一片安静，然后超时。(a) 里服务器从没执行过；(b) 里它已经执行了。客户端再调用一次的话，(b) 里这个过程就执行了两次。")),
                 p(T(r"The client cannot tell (a) from (b). So whether retrying is safe comes down to one question: **what happens if the procedure runs twice?**", r"客户端分不清 (a) 和 (b)。所以重试安不安全，归结为一个问题：**这个过程执行两次会怎样？**")),
                 h(T('Idempotent procedures', '幂等的过程')),
                 p(T(r"A procedure is **idempotent** if running it several times has the same effect as running it once.", r"如果一个过程执行多次的效果和执行一次一样，它就是**幂等的**（idempotent）。")),
                 table([T('Procedure', '过程'), T('Twice the same as once?', '执行两次和一次一样吗？')],
                       [T('read the balance of account 42', '读取 42 号账户的余额'), T('yes: it changes nothing', '一样：它什么都不改变')],
                       [T('set the thermostat to 21 °C', '把恒温器设为 21 °C'), T('yes: the second call sets the same value', '一样：第二次设的还是同一个值')],
                       [T('delete the file report.txt', '删除文件 report.txt'), T('yes: the second finds it already gone', '一样：第二次发现它已经没了')],
                       [T('add 100 dollars to account 42', '给 42 号账户加 100 元'), T('no: 200 dollars are added', '不一样：加了 200 元')],
                       [T('append a line to the log', '往日志末尾加一行'), T('no: the line appears twice', '不一样：这一行出现两次')],
                       [T('create a new order', '新建一个订单'), T('no: two orders', '不一样：两个订单')]),
                 quiz(T(r"Which of these calls is idempotent?", r"下面哪个调用是幂等的？"),
                      [(T(r"set the user's email address to x@example.com", r"把用户的邮箱设为 x@example.com"), True),
                       (T(r"send a text message to Bob", r"给 Bob 发一条短信"), T(r"Run twice, Bob gets two messages.", r"执行两次，Bob 就收到两条。")),
                       (T(r"increase the page's view count by one", r"把页面的浏览次数加一"), T(r"Run twice, the count goes up by two.", r"执行两次，次数加了二。"))],
                      T(r"Setting something to a given value is idempotent: the second call finds it already set. Anything that *adds*, *sends* or *creates* is not.", r"把某样东西设成一个给定的值是幂等的：第二次调用发现它已经是这个值了。凡是*增加*、*发送*、*新建*的都不是。"))),
            read('q2-answer', T('Question 2: a full-mark answer', '第 2 题：满分答案'),
                 p(T(r"The answer comes in two halves, each with its reason:", r"答案分两半，每一半都带着理由：")),
                 ol(T(r"**UDP, when the procedure is idempotent.** If no reply arrives, the client simply calls again: even if the first request did run, running it again does no harm. UDP then saves what TCP would cost: the round trip of the handshake before the first request, and the operating system's work of keeping a connection.",
                      r"**过程是幂等的，用 UDP。** 收不到回复，客户端就再调用一次：即使第一次请求其实已经执行了，再执行一次也无害。这时 UDP 省下了 TCP 要付的代价：第一条请求之前握手的那个往返，以及操作系统维护一条连接的开销。"),
                    T(r"**TCP, when the procedure is not idempotent.** A repeated request could run it twice: pay twice, order twice. TCP retransmits for the client, and detects and discards duplicate segments, so each request is delivered exactly once.",
                      r"**过程不是幂等的，用 TCP。** 重发请求可能让它执行两次：扣两次钱，下两次单。TCP 替客户端重传，并且认出、丢弃重复的报文段，所以每条请求恰好送达一次。")),
                 paper(T('Review (2), Q2 · a full-mark answer', '复习课 (2) 第 2 题 · 满分答案'),
                       T(r"If the remote procedure is idempotent (it can be executed several times without harm), the client prefers RPC over UDP: when no response arrives within a timeout, it simply invokes the procedure again, and even if the first request was executed and only the reply was lost, executing it again does no harm. UDP avoids the round trip needed to set up a TCP connection and the operating-system overhead of maintaining one, so each call is quicker and cheaper.",
                         r"如果远程过程是幂等的（执行多次也无害），客户端更愿意用基于 UDP 的 RPC：超时还没收到回复，就再调用一次；即使第一次请求其实已执行、只是回复丢了，再执行一次也无害。UDP 省去了建立 TCP 连接所需的那个往返，以及维护连接的操作系统开销，所以每次调用更快、更省。"),
                       T(r"If the procedure is not idempotent (e.g. transferring money), the client prefers RPC over TCP: TCP guarantees that segments are delivered exactly once, because it detects and rejects duplicate segments, so a retransmitted request cannot make the procedure run twice.",
                         r"如果过程不是幂等的（例如转账），客户端更愿意用基于 TCP 的 RPC：TCP 能检测并拒绝重复的报文段，保证报文段恰好送达一次，所以重传的请求不会让过程执行两次。"),
                       answer=True),
                 p(T(r"Where the marks are: the word *idempotent* with what it means, why retrying is or is not safe, and what each protocol saves or guarantees. *UDP is fast, TCP is reliable* without idempotence misses the point of the question.",
                     r"分在这些地方：*幂等*这个词以及它的意思，为什么重试安全或不安全，以及每种协议省下了什么、保证了什么。只写“UDP 快、TCP 可靠”而不提幂等，就没答到点子上。")),
                 details(T('Beyond the exam: what TCP does not guarantee', '超出考试：TCP 保证不了的事'),
                         p(T(r"TCP removes duplicates within one connection. If the connection itself breaks in the middle of a call (the server crashes, the network goes down), the client still cannot know whether the procedure ran, and calling again on a new connection could run it twice. Systems that must never repeat an action give each request a unique id, and the server remembers which ids it has already carried out (*at-most-once* semantics).",
                             r"TCP 只在一条连接之内去重。如果连接本身在调用中途断了（服务器崩溃、网络中断），客户端照样不知道过程有没有执行，在新连接上再调一次就可能执行两次。绝不能重复执行的系统会给每条请求一个唯一编号，服务器记住哪些编号已经执行过（*至多一次* at-most-once 语义）。"))),),
            read('choose', T('Choosing a transport, in general', '一般地，怎样选传输协议'),
                 p(T(r"The RPC question is one case of a general trade-off. Choose UDP when one of these holds; otherwise TCP.", r"RPC 这道题是一个一般性取舍的特例。满足下面任何一条，就选 UDP；否则选 TCP。")),
                 ul(T(r"**The exchange is one small request and one small reply, and repeating it is harmless.** DNS is the classic case: a lookup fits in one datagram and asking again is harmless, so DNS runs over UDP on port 53 and simply retransmits a lost query. A TCP handshake would double the time of every lookup.",
                      r"**一来一回各一条小消息，重复也无害。** DNS 是经典例子：一次查询装得进一个数据报，再问一次也无害，所以 DNS 跑在 UDP 的 53 端口上，查询丢了就重发。要是用 TCP 握手，每次查询的时间都会翻倍。"),
                    T(r"**Late data is useless.** In a phone call or a live game, a sample that arrives after its moment cannot be played, and TCP's retransmission would only delay everything behind it. Such applications use UDP (often with RTP) and hide the losses instead.",
                      r"**迟到的数据没有用。** 打电话或玩实时游戏时，错过时刻才到的数据已经没法播放了，TCP 的重传只会拖慢后面的所有数据。这类应用用 UDP（常配合 RTP），丢了就设法掩盖过去。"),
                    T(r"**The application wants its own control** over retries, ordering and timing.", r"**应用想自己掌控**重传、顺序和时机。")),
                 p(T(r"Choose TCP when every byte must arrive, once and in order: web pages, email, file transfer, remote login. The course's slide sums UDP up: useful when an application needs low overhead, or wants to implement its own control over reliability, ordering, retransmission and timing.",
                     r"每个字节都必须恰好到一次、按顺序到的，选 TCP：网页、邮件、文件传输、远程登录。课件对 UDP 的总结是：适合需要低开销的应用，或想自己控制可靠性、顺序、重传和时机的应用。")),
                 h(T('Opening a TCP connection', 'TCP 连接是怎么建立的')),
                 p(T(r"The **three-way handshake**: the client sends a connection request (SYN) carrying its starting sequence number; the server acknowledges it and sends its own (SYN + ACK); the client acknowledges that (ACK). Both sides contribute a fresh sequence number, so an old, delayed duplicate of a request cannot open a connection by mistake. Data can start only after the first round trip: that round trip is what an idempotent RPC over UDP saves.",
                     r"**三次握手**：客户端发一个连接请求（SYN），带着自己的起始序号；服务器确认它，并发出自己的起始序号（SYN + ACK）；客户端再确认（ACK）。双方各出一个新的序号，所以一个延迟到达的旧请求副本不会误开一条连接。数据要等第一个往返之后才能开始传：基于 UDP 的幂等 RPC 省下的，正是这个往返。")),
                 chapter=WIDER_CH()),
            choice('try-port', T('Your turn: the client\'s port', '你来：客户端的端口'), A,
                   T(r"A browser on your laptop connects to a web server on port 80. Which port does the browser's own socket use?", r"你笔记本上的浏览器连接一个端口 80 的网页服务器。浏览器自己的套接字用哪个端口？"),
                   [(T(r"A free port the operating system picks, such as 52311", r"操作系统挑的一个空闲端口，比如 52311"), True),
                    (T(r"Port 80, the same as the server", r"80，和服务器一样"), T(r"80 is the server's well-known port, so that clients can find it. The client's port only has to be free on the laptop.", r"80 是服务器的知名端口，好让客户端找得到它。客户端的端口只要在笔记本上没被占用就行。"), 'ip-is-enough'),
                    (T(r"None: only servers have ports", r"没有：只有服务器才有端口"), T(r"Every TCP or UDP endpoint has a port: the server's replies need one to find their way back to the browser.", r"每个 TCP 或 UDP 端点都有端口：服务器的回复要靠它找回浏览器。"))],
                   T(r"The server binds to a well-known port; the client is given a free (dynamic) port. The connection is the four numbers together: the laptop's IP and port, the server's IP and 80.", r"服务器绑定知名端口；客户端被分配一个空闲的（动态）端口。连接就是这四个数合在一起：笔记本的 IP 和端口，服务器的 IP 和 80。"),
                   chapter=TRY_CH()),
            choice('try-idempotent', T('Your turn: safe to retry over UDP', '你来：用 UDP 重试也安全'), U,
                   T(r"Which remote procedure can safely run over UDP, with the client simply calling again after a timeout?", r"哪个远程过程可以放心跑在 UDP 上，超时了客户端就再调一次？"),
                   [(T(r"`get_price(item)`", r"`get_price(item)`"), True),
                    (T(r"`place_order(item)`", r"`place_order(item)`"), T(r"Not idempotent: if only the reply was lost, a retry places a second order.", r"不幂等：如果只是回复丢了，重试会再下一单。"), 'tcp-always'),
                    (T(r"`add_points(user, 10)`", r"`add_points(user, 10)`"), T(r"Not idempotent: a repeated call adds 20 points.", r"不幂等：重复调用会加 20 分。")),
                    (T(r"`send_email(to, text)`", r"`send_email(to, text)`"), T(r"Not idempotent: the email could arrive twice.", r"不幂等：邮件可能收到两封。"))],
                   T(r"Reading a price changes nothing, so running it twice is the same as once. The others add, create or send something, so they need TCP's exactly-once delivery.", r"读价格不改变任何东西，执行两次和一次一样。其他几个都会增加、新建或发送东西，需要 TCP 恰好一次的送达。")),
            text_q('try-dns', T('Your turn: why DNS uses UDP', '你来：DNS 为什么用 UDP'), U,
                   T(r"DNS lookups normally travel over UDP rather than TCP. Explain why this is a good choice.", r"DNS 查询通常走 UDP 而不是 TCP。解释为什么这是个好选择。"),
                   [T('A lookup is one small request and one small reply', '一次查询就是一条小请求加一条小回复'),
                    T('Repeating a lookup is harmless (idempotent), so a lost query is simply sent again', '重复查询无害（幂等），丢了就再发一次'),
                    T('UDP avoids the TCP handshake round trip and connection state, so a lookup is about twice as fast', 'UDP 省去 TCP 握手的往返和连接状态，查询大约快一倍')],
                   T(r"A DNS lookup is a single small query and a single small reply, and asking the same question twice is harmless (it is idempotent), so if a query or its reply is lost the client just sends the query again. Over UDP the query goes out at once; TCP would first need a handshake, a whole extra round trip, plus connection state at both ends, roughly doubling the time of every lookup.",
                     r"一次 DNS 查询就是一条小请求、一条小回复，同一个问题问两次也无害（它是幂等的），所以查询或回复丢了，客户端再发一次就行。用 UDP，查询马上就发出去；用 TCP 得先握手，多出整整一个往返，两端还要维护连接状态，每次查询的时间大约翻倍。"),
                   T(r"The same reasoning as the RPC question: idempotent and small, so retrying is safe and the handshake is pure cost.", r"和 RPC 那道题同一个道理：幂等而且小，所以重试安全，握手纯属额外开销。")),
        ],
    )


def L_tahoe():
    P, S, A, R = 'fvccxy.congestion-principle', 'fvccxy.slow-start', 'fvccxy.additive-increase', 'fvccxy.tahoe-reno'
    return dict(
        id=f'{CID}-exam-tahoe', title=T('Congestion control: TCP Tahoe after a timeout (R2 · 3)', '拥塞控制：TCP Tahoe 超时之后（复2 · 3）'),
        description=T('Why TCP limits its own speed, how slow start and additive increase grow the window, what Tahoe does on a timeout, the four round trips worked line by line, and how Reno differs.', 'TCP 为什么要自己限速，慢启动和加法增大怎样让窗口变大，Tahoe 遇到超时怎么做，逐行算出那四个往返，以及 Reno 有什么不同。'),
        minutes=35,
        skills=skills(P, S, A, R),
        misconceptions=[{'id': 'old-threshold', 'description': T('Computing the new threshold from the old threshold instead of the window at the loss', '用旧阈值而不是丢包时的窗口来算新阈值')},
                        {'id': 'double-past', 'description': T('Doubling the window past the slow start threshold', '过了慢启动阈值还在翻倍')}],
        steps=[
            read('question', T('The question, as printed', '题目原文'),
                 paper(R2(3), T(r"Assume TCP Tahoe is being used and the slow start threshold is currently set to 10KB. A segment timeout occurs when the congestion window is 16KB. What will the slow start threshold be after this timeout? After the timeout, the congestion window is reset to 1. What is the congestion window for the following 4 round trips if no further loss occurs?",
                                r"假设使用的是 TCP Tahoe，慢启动阈值当前设为 10KB。拥塞窗口为 16KB 时发生了一次报文段超时。超时之后慢启动阈值是多少？超时后拥塞窗口被重置为 1。如果之后不再丢包，接下来 4 个往返的拥塞窗口各是多少？")),
                 h(T('Reading it slowly', '慢慢读一遍')),
                 ul(T(r"**TCP Tahoe** is one version of TCP's congestion control; it is built from the ground up below.", r"**TCP Tahoe** 是 TCP 拥塞控制的一个版本；下面从头把它搭起来。"),
                    T(r"**The congestion window** (cwnd, written $W$ here): how much data the sender may have in the network, sent but not yet acknowledged. A bigger window means sending faster.", r"**拥塞窗口**（congestion window，cwnd，这里记作 $W$）：发送方最多可以有多少数据在网络里——已经发出、还没被确认。窗口越大，发得越快。"),
                    T(r"**The slow start threshold** (ssthresh, written $S$): the window size at which TCP stops growing fast and starts growing carefully.", r"**慢启动阈值**（slow start threshold，ssthresh，这里记作 $S$）：窗口长到这个大小，TCP 就不再快速增长，改为小心地增长。"),
                    T(r"**A segment timeout**: the acknowledgement of a segment did not come back in time. TCP takes it as a sign that the network is congested.", r"**报文段超时**（segment timeout）：某个报文段的确认没有按时回来。TCP 把它当作网络拥塞的信号。"),
                    T(r"**Units.** The question gives sizes in KB, then resets the window *to 1*: it counts in segments of 1 KB each. So 16 KB is 16 segments and the threshold of 10 KB is 10 segments.", r"**单位。**题目用 KB 给大小，后面又说窗口重置为 *1*：它是按每段 1 KB 的报文段来数的。所以 16 KB 就是 16 个报文段，阈值 10 KB 就是 10 个。"),
                    T(r"**A round trip** (RTT): the time to send a window of data and get its acknowledgements back. TCP adjusts the window once per round trip.", r"**往返**（round trip，RTT）：发出一窗数据、收回它们的确认所用的时间。TCP 每个往返调整一次窗口。")),
                 p(T(r"Two parts: the new threshold, and the window over the next four round trips. The ideas: why TCP limits its own speed at all, how slow start and additive increase grow the window, and what Tahoe does on a timeout.",
                     r"两问：新的阈值，以及接下来四个往返的窗口。需要的想法：TCP 为什么要自己限速，慢启动和加法增大怎样让窗口长大，以及 Tahoe 遇到超时怎么办。")),
                 chapter=Q_CH()),
            read('why', T('Why TCP slows itself down', 'TCP 为什么要自己放慢'),
                 p(T(r"Routers have queues. When more traffic arrives than a link can carry, the queue fills, delays grow, and in the end packets are dropped. Senders whose packets were dropped time out and retransmit, adding yet more traffic: the network can end up busy carrying copies while little useful data, **goodput**, gets through. That is **congestion**.",
                     r"路由器里有队列。到达的流量超过链路能承载的，队列就会填满，延迟变长，最后开始丢包。包被丢掉的发送方超时重传，又加了更多流量：网络可能忙着运送重复的副本，真正有用的数据（**有效吞吐量** goodput）却没多少能通过。这就是**拥塞**（congestion）。")),
                 p(T(r"Nobody in the network tells a TCP sender how fast to go. So TCP probes: it raises its rate while all goes well, and cuts it back when a segment is lost, reading **loss as the signal** of congestion. The rate is set by the congestion window: about one window of data per round trip.",
                     r"网络里没有谁会告诉 TCP 发送方该发多快。于是 TCP 自己试探：一切顺利就提速，丢了报文段就降速，**把丢包当作拥塞的信号**。速度由拥塞窗口决定：每个往返大约发一窗的数据。")),
                 p(T(r"Do not confuse it with flow control. Flow control protects the *receiver*: its window is the space left in the receiver's buffer. Congestion control protects the *network* along the whole path. The sender keeps both windows and obeys the smaller.",
                     r"别和流量控制混在一起。流量控制保护的是*接收方*：它的窗口是接收方缓冲区剩下的空间。拥塞控制保护的是整条路径上的*网络*。发送方两个窗口都记着，按小的那个来发。")),
                 chapter=IDEAS_CH()),
            read('grow', T('Two ways to grow: slow start and additive increase', '两种增长：慢启动和加法增大'),
                 p(T(r"**Slow start.** A connection starts with $W = 1$ segment. Each segment that is acknowledged adds one segment to the window. In the first round trip one segment is acknowledged: $W = 2$. In the next, two are: $W = 4$. Then 8, then 16: **the window doubles every round trip**. It is *slow* only at its start; it grows exponentially, to find the network's capacity quickly.",
                     r"**慢启动**（slow start）。连接开始时 $W = 1$ 个报文段。每确认一个报文段，窗口就加一个报文段。第一个往返确认了 1 个：$W = 2$。下一个往返确认 2 个：$W = 4$。然后 8，然后 16：**窗口每个往返翻一倍**。它只是*起点*慢；增长是指数式的，为的是尽快摸到网络的容量。")),
                 p(T(r"**The threshold.** Doubling cannot go on forever: it would overshoot and cause losses. So when the window reaches the slow start threshold $S$, TCP switches to **additive increase** (also called congestion avoidance): **one more segment per round trip**. Careful, linear growth, close to the level where trouble started last time.",
                     r"**阈值。**不能一直翻倍下去：会冲过头，造成丢包。所以窗口一到慢启动阈值 $S$，TCP 就改成**加法增大**（additive increase，也叫拥塞避免）：**每个往返只加一个报文段**。在上次出问题的水平附近，小心地线性增长。")),
                 table([T('Round trip', '往返'), '0', '1', '2', '3', '4', '5', '6'],
                       [T('Window, threshold 8', '窗口（阈值 8）'), '1', '2', '4', '8', '9', '10', '11'],
                       [T('Phase', '阶段'), T('start', '开始'), T('doubling', '翻倍'), T('doubling', '翻倍'), T('reaches 8', '到 8'), '+1', '+1', '+1'])),
            read('loss', T('What Tahoe does when a segment times out', 'Tahoe 遇到超时怎么做'),
                 p(T(r"On a loss, Tahoe does two things at once:", r"一旦丢包，Tahoe 同时做两件事：")),
                 ol(T(r"**The threshold becomes half the current window**: $S = W/2$. The window at the moment of the loss was too big for the network; half of it is a level that was safe, and the new place to slow down. (This is the *multiplicative decrease* in AIMD, additive increase, multiplicative decrease.)",
                      r"**阈值变为当前窗口的一半**：$S = W/2$。丢包那一刻的窗口对网络来说太大了；它的一半是一个安全的水平，也是下次该放慢的地方。（这就是 AIMD——加法增大、乘法减小——里的*乘法减小*。）"),
                    T(r"**The window goes back to 1** and slow start begins again.", r"**窗口回到 1**，重新开始慢启动。")),
                 p(T(r"Notice what is **not** used: the old threshold. Once a loss happens, the old threshold has done its job; the new one depends only on the window at the moment of the loss.",
                     r"注意**没有**用到的东西：旧的阈值。一旦丢包，旧阈值就完成了使命；新阈值只取决于丢包那一刻的窗口。")),
                 visual('it_tahoe', T(r"The question's connection, round by round. Drag the moment of the loss along the curve: the new threshold is always half the window at that moment. Switch to Reno, and to three duplicate ACKs, to see the gentler reaction of the wider topic.",
                                      r"题目里这条连接，一个往返一个往返地画出来。沿曲线拖动丢包的时刻：新阈值总是那一刻窗口的一半。切换到 Reno，再切换到“三个重复确认”，就能看到后面“全貌”里讲的那种温和反应。")),
                 quiz(T(r"The threshold was 10 KB and the window 16 KB when the timeout happened. What is the new threshold?", r"超时发生时，阈值是 10 KB，窗口是 16 KB。新阈值是多少？"),
                      [(T('8 KB', '8 KB'), True),
                       (T('5 KB', '5 KB'), T(r"That halves the old threshold. Tahoe halves the window at the moment of the loss.", r"这是把旧阈值减半了。Tahoe 减半的是丢包那一刻的窗口。")),
                       (T('10 KB', '10 KB'), T(r"The threshold is replaced at every loss; the old 10 KB plays no part.", r"每次丢包都会换掉阈值；旧的 10 KB 不起任何作用。"))],
                      T(r"$16 / 2 = 8$: the window at the moment of the loss, halved.", r"$16 / 2 = 8$：丢包那一刻的窗口，减半。"))),
            derive('q3', T('The question, worked', '这道题：完整解法'),
                   [(r"S' = W/2", T(r"On a timeout, Tahoe sets the new threshold, written $S'$, to half the window at that moment.", r"超时时，Tahoe 把新阈值（记作 $S'$）设为那一刻窗口的一半。")),
                    (r"S' = 16/2 = 8\ \text{KB}", T(r"The window was 16 KB. The old threshold, 10 KB, plays no part.", r"窗口是 16 KB。旧阈值 10 KB 不参与计算。")),
                    (r'W = 1', T(r"The window is reset to 1 segment (1 KB), and slow start begins again.", r"窗口重置为 1 个报文段（1 KB），重新开始慢启动。")),
                    (r'W = 2', T(r"After the 1st round trip: the one segment is acknowledged, so the window doubles. $2 < 8$: still slow start.", r"第 1 个往返后：那 1 个报文段被确认，窗口翻倍。$2 < 8$：还在慢启动。")),
                    (r'W = 4', T(r"After the 2nd: it doubles again.", r"第 2 个往返后：再翻倍。")),
                    (r'W = 8', T(r"After the 3rd: it doubles to 8, which reaches the threshold. From here on, additive increase.", r"第 3 个往返后：翻倍到 8，正好到达阈值。从这里起改为加法增大。")),
                    (r'W = 9', T(r"After the 4th. The window has reached the threshold, so the rule has changed.", r"第 4 个往返后。窗口已经到了阈值，规则变了。"))],
                   blank=(6, '9', T(r"After the 4th round trip: the window has reached the threshold of 8. What is it now?", r"第 4 个往返后：窗口已经到了阈值 8。现在是多少？")),
                   outro=T(r"From the threshold on, additive increase adds one segment per round trip instead of doubling. **Answer:** the threshold becomes 8 KB, and over the next four round trips the window is 2, 4, 8 and 9 KB.", r"到了阈值，加法增大每个往返只加一个报文段，不再翻倍。**答案：**阈值变为 8 KB；接下来四个往返，窗口依次是 2、4、8、9 KB。"),
                   skill=S),
            read('paper-answer', T('A full-mark answer', '一份满分答案'),
                 p(T(r"The chain: the rule on a timeout (half the window, back to 1); the number (8 KB, not from the old threshold); slow start doubling up to the threshold; additive increase after it.", r"答案链：超时时的规则（窗口减半、回到 1）；算出的数（8 KB，与旧阈值无关）；慢启动翻倍到阈值；之后加法增大。")),
                 paper(T('Review (2), Q3 · a full-mark answer', '复习课 (2) 第 3 题 · 满分答案'),
                       T(r"On a timeout, TCP Tahoe sets the slow start threshold to half of the current congestion window: 16 KB / 2 = 8 KB (the old threshold of 10 KB is not used).",
                         r"超时时，TCP Tahoe 把慢启动阈值设为当前拥塞窗口的一半：16 KB / 2 = 8 KB（旧阈值 10 KB 不用）。"),
                       T(r"After the window is reset to 1, slow start doubles it every round trip until it reaches the threshold, and then additive increase adds one segment per round trip: 1 RTT after the reset, cwnd = 2 KB; 2 RTT, cwnd = 4 KB; 3 RTT, cwnd = 8 KB (the threshold is reached, so TCP switches to additive increase); 4 RTT, cwnd = 9 KB.",
                         r"窗口重置为 1 后，慢启动每个往返让它翻倍，直到到达阈值，之后加法增大每个往返加一个报文段：重置后 1 个 RTT，cwnd = 2 KB；2 个 RTT，cwnd = 4 KB；3 个 RTT，cwnd = 8 KB（到达阈值，TCP 改为加法增大）；4 个 RTT，cwnd = 9 KB。"),
                       answer=True),
                 svg(drawn(fig_tahoe), T('The congestion window against round trips: slow start from 1 to 8, capped at the old threshold 10, additive increase to 16, a timeout at 16, then 1, 2, 4, 8 and 9 under the new threshold 8.',
                                           '拥塞窗口随往返的变化：慢启动从 1 到 8，在旧阈值 10 处封顶，加法增大到 16，在 16 处超时，然后在新阈值 8 下依次是 1、2、4、8、9。'),
                     T(r"The question's connection: the timeout at 16, the new threshold at 8, and the four round trips after the reset.", r"题目里的连接：16 处超时，新阈值 8，以及重置后的四个往返。")),
                 p(T(r"The classic slip is 16 after the fourth round trip: doubling past the threshold. Write the switch to additive increase in words, as the lecturer's answer does; it shows you know why the fourth step is +1.",
                     r"最常见的错是第四个往返写成 16：过了阈值还在翻倍。像老师的答案那样，用文字写出“改为加法增大”；这说明你知道第四步为什么只是 +1。")),
                 chapter=PAPER_CH()),
            read('reno', T('TCP Reno: not every loss sends you back to 1', 'TCP Reno：不是每次丢包都退回 1'),
                 p(T(r"A timeout means nothing has come back for a long time: the network may be badly congested. But a loss is often noticed earlier and more gently. When one segment is lost and the ones after it still arrive, the receiver keeps acknowledging the last byte it has in order, so the sender sees **duplicate acknowledgements**. Three duplicate ACKs mean one segment is missing while the data behind it is still flowing.",
                     r"超时意味着很久都没有任何东西回来：网络可能堵得很厉害。但丢包常常能更早、更温和地被发现。一个报文段丢了，后面的却照样到达，接收方会一直确认它按序收到的最后一个字节，于是发送方看到**重复确认**（duplicate ACK）。三个重复确认说明缺了一个报文段，而它后面的数据还在流动。")),
                 p(T(r"**Fast retransmit**: resend the missing segment at once, without waiting for the timeout. (Tahoe does this too, but then still drops the window to 1.)", r"**快速重传**（fast retransmit）：不等超时，马上重发缺的那个报文段。（Tahoe 也这么做，但之后仍把窗口降到 1。）")),
                 p(T(r"**TCP Reno** adds **fast recovery**: after three duplicate ACKs it sets the threshold to half the window as usual, but then continues *from the new threshold* with additive increase, skipping slow start. Only a timeout, or the start of a connection, sends Reno back to a window of 1. Its window then traces a sawtooth: up by one each round trip, halved at each loss.",
                     r"**TCP Reno** 加上了**快速恢复**（fast recovery）：三个重复确认之后，照常把阈值设为窗口的一半，但接着*从新阈值*开始加法增大，跳过慢启动。只有超时（以及连接刚开始时）才会让 Reno 的窗口回到 1。于是它的窗口画出一条锯齿：每个往返加一，每次丢包减半。")),
                 table([T('Event', '事件'), 'Tahoe', 'Reno'],
                       [T('connection starts', '连接开始'), T('$W = 1$, slow start', '$W = 1$，慢启动'), T('the same', '相同')],
                       [T('three duplicate ACKs', '三个重复确认'), T('$S = W/2$, $W = 1$, slow start', '$S = W/2$，$W = 1$，慢启动'), T('$S = W/2$, $W = S$, then +1 per RTT', '$S = W/2$，$W = S$，之后每个 RTT 加 1')],
                       [T('timeout', '超时'), T('$S = W/2$, $W = 1$, slow start', '$S = W/2$，$W = 1$，慢启动'), T('the same as Tahoe', '和 Tahoe 相同')]),
                 p(T(r"With the question's numbers, under Reno and three duplicate ACKs instead of a timeout: the threshold is 8 KB and the window goes straight to 8 KB, then 9, 10, 11 and 12 over the next four round trips.",
                     r"用题目的数，如果是 Reno、信号是三个重复确认而不是超时：阈值 8 KB，窗口直接变成 8 KB，接下来四个往返是 9、10、11、12。")),
                 p(T(r"Why halve, and add one? Additive increase with multiplicative decrease is the rule under which connections that share a bottleneck drift towards equal shares: each loss cuts the bigger window by more, while both grow at the same pace.",
                     r"为什么是减半、加一？在加法增大、乘法减小这条规则下，共用同一个瓶颈的几条连接会逐渐趋向平分带宽：每次丢包，大窗口被砍掉的更多，而两边增长的速度一样。")),
                 chapter=WIDER_CH()),
            number('try-thresh', T('Your turn: a new threshold', '你来：新的阈值'), R,
                   T(r"TCP Tahoe, segments of 1 KB. The slow start threshold is 20 KB, and a timeout occurs when the congestion window is 32 KB. What is the new threshold, in KB?", r"TCP Tahoe，每个报文段 1 KB。慢启动阈值是 20 KB，拥塞窗口为 32 KB 时发生超时。新阈值是多少 KB？"),
                   16, T(r"Half the window at the timeout: $32 / 2 = 16$ KB. The old 20 KB plays no part.", r"超时时窗口的一半：$32 / 2 = 16$ KB。旧的 20 KB 不参与。"),
                   tolerance=0, unit='KB', hints=[T(r"Which number does Tahoe halve: the old threshold, or the window at the timeout?", r"Tahoe 减半的是哪个数：旧阈值，还是超时时的窗口？")], chapter=TRY_CH()),
            number('try-window', T('Your turn: five round trips later', '你来：五个往返之后'), S,
                   T(r"The same connection: after the timeout the window is reset to 1 and no further loss occurs. What is the window after the 5th round trip, in KB?", r"同一条连接：超时后窗口重置为 1，之后不再丢包。第 5 个往返后窗口是多少 KB？"),
                   17, T(r"Slow start: 2, 4, 8, 16 after four round trips, reaching the threshold of 16; then additive increase: 17 after the fifth.", r"慢启动：四个往返后依次是 2、4、8、16，到达阈值 16；然后加法增大：第五个往返后是 17。"),
                   tolerance=0, unit='KB', hints=[T(r"Double until the window reaches 16, then add one per round trip.", r"翻倍到 16，之后每个往返加一。")]),
            number('try-reno', T('Your turn: Reno and duplicate ACKs', '你来：Reno 和重复确认'), R,
                   T(r"Now TCP Reno, threshold 20 KB, window 32 KB, and the loss is signalled by three duplicate ACKs instead of a timeout. What is the congestion window right after, in KB?", r"现在是 TCP Reno，阈值 20 KB，窗口 32 KB，丢包的信号是三个重复确认而不是超时。紧接着拥塞窗口是多少 KB？"),
                   16, T(r"Fast recovery: the threshold becomes $32/2 = 16$ and the window starts from the threshold, 16 KB, then grows by 1 KB per round trip.", r"快速恢复：阈值变为 $32/2 = 16$，窗口从阈值 16 KB 开始，之后每个往返加 1 KB。"),
                   tolerance=0, unit='KB'),
            choice('try-signal', T('Your turn: why gentler', '你来：为什么更温和'), R,
                   T(r"Why does Reno treat three duplicate ACKs more gently than a timeout?", r"为什么 Reno 对三个重复确认的反应比对超时更温和？"),
                   [(T(r"Duplicate ACKs show later segments still arriving: data is flowing and only one segment is missing", r"重复确认说明后面的报文段还在到达：数据在流动，只缺了一个"), True),
                    (T(r"Duplicate ACKs mean the receiver's buffer is full", r"重复确认说明接收方的缓冲区满了"), T(r"A full buffer is flow control, signalled by the receiver's window. Duplicate ACKs come from a gap in the data.", r"缓冲区满属于流量控制，由接收方的窗口告知。重复确认来自数据里的一个缺口。")),
                    (T(r"A timeout is usually a false alarm", r"超时通常是误报"), T(r"A timeout means nothing came back for a long time: the strongest sign of congestion TCP has.", r"超时意味着很久什么都没回来：这是 TCP 能得到的最强的拥塞信号。"))],
                   T(r"Each duplicate ACK is triggered by a segment that did arrive, so the path still carries data: halving the window is enough. A timeout gives no such evidence, so both Tahoe and Reno start again from 1.", r"每个重复确认都是由一个确实到达了的报文段触发的，说明路径还在运送数据：窗口减半就够了。超时没有这样的证据，所以 Tahoe 和 Reno 都从 1 重新开始。")),
        ],
    )


def L_web():
    D, R, Z, N, H = 'bsjyg8.dns-purpose', 'bsjyg8.dns-resolution', 'bsjyg8.dns-zones', 'r96uqr.non-persistent-http', 'r96uqr.persistent-http-pipelining'
    Q4, Q5 = T('Question 4: no DNS', '第 4 题：没有 DNS'), T('Question 5: persistent HTTP', '第 5 题：持久 HTTP')
    return dict(
        id=f'{CID}-exam-web', title=T('Opening a web page: with no DNS, and over one connection (R2 · 4, 5)', '打开一个网页：没有 DNS，以及只用一条连接（复2 · 4、5）'),
        description=T('What DNS does and what still works without it; how a page is fetched over TCP, what a persistent connection saves in round trips, and the catch of deciding when to close it.', 'DNS 做什么，没了它还有什么能用；网页是怎样通过 TCP 取回来的，持久连接省下多少往返，以及什么时候关连接这个难处。'),
        minutes=40,
        skills=skills(D, R, Z, N, H),
        misconceptions=[{'id': 'dns-is-internet', 'description': T('Thinking the Internet itself stops working without DNS', '以为没有 DNS，互联网本身就停了')},
                        {'id': 'forget-handshake', 'description': T('Counting round trips without the TCP handshake', '数往返时忘了 TCP 握手')}],
        steps=[
            read('q4', T('Question 4, as printed', '第 4 题原文'),
                 paper(R2(4), T(r"Consider a situation in which a cyberterrorist makes all the DNS servers in the world crash simultaneously. How does this change one's ability to use the Internet?",
                                r"设想一个网络恐怖分子让全世界的 DNS 服务器同时崩溃。这会怎样改变人们使用互联网的能力？")),
                 h(T('Reading it slowly', '慢慢读一遍')),
                 ul(T(r"**DNS** (the Domain Name System) is the service that turns names such as www.unimelb.edu.au into IP addresses. It is built below from the ground up.", r"**DNS**（Domain Name System，域名系统）是把 www.unimelb.edu.au 这样的名字翻译成 IP 地址的服务。下面从头讲。"),
                    T(r"**All the DNS servers in the world, simultaneously**: every name server, from the root servers to your provider's local one, at once. No other name server is left to fall back on.", r"**全世界所有的 DNS 服务器，同时**：从根服务器到你网络服务商的本地服务器，全部一起。没有任何别的域名服务器可以兜底。"),
                    T(r"**How does this change one's ability to use the Internet**: what stops working, what still works, and what that means for an ordinary user.", r"**怎样改变使用互联网的能力**：什么停了，什么还能用，这对普通用户意味着什么。")),
                 p(T(r"The ideas: what DNS does and who uses it; how a lookup works; and which parts of the Internet never ask DNS at all.", r"需要的想法：DNS 做什么、谁在用它；一次查询是怎么完成的；以及互联网的哪些部分根本不找 DNS。")),
                 chapter=Q4),
            read('dns', T('What DNS does', 'DNS 做什么'),
                 p(T(r"Packets are addressed by IP address, such as 121.7.106.83. People use names, such as www.google.com. DNS translates between them: **name resolution** finds the IP address for a host name. Opening www.someschool.edu/index.html, as the course's slide walks through it:",
                     r"包是按 IP 地址寻址的，比如 121.7.106.83。人用的是名字，比如 www.google.com。DNS 负责在两者之间翻译：**域名解析**（name resolution）为一个主机名找到它的 IP 地址。打开 www.someschool.edu/index.html 时，按课件的步骤：")),
                 ol(T(r"The browser takes the host name, www.someschool.edu, out of the URL and hands it to the DNS client on the same machine.", r"浏览器从 URL 里取出主机名 www.someschool.edu，交给本机的 DNS 客户端。"),
                    T(r"The DNS client sends a query with the name to a DNS server, and eventually receives a reply with the IP address.", r"DNS 客户端把名字放进一个查询发给 DNS 服务器，最后收到带着 IP 地址的回复。"),
                    T(r"Only now can the browser open a TCP connection to port 80 at that address.", r"直到这时，浏览器才能向这个地址的 80 端口建立 TCP 连接。")),
                 p(T(r"Almost everything that starts from a name uses DNS: the browser for every new site, a mail server to find where to deliver mail for a domain (its mail server record), most apps for their servers.",
                     r"几乎一切从名字出发的事都要用 DNS：浏览器每打开一个新网站，邮件服务器为某个域名找投递地址（它的邮件服务器记录），大多数应用找自己的服务器。")),
                 p(T(r"DNS is a distributed database arranged as a tree. **Root name servers** know the servers of the top-level domains; **top-level domain servers** (com, edu, au and so on) know the servers of the zones below them; each organisation's **authoritative name servers** know its own hosts. Your provider's **local name server** does the asking for you and **caches** each answer for a while (every record carries a time to live, TTL).",
                     r"DNS 是一个排成树形的分布式数据库。**根域名服务器**知道各顶级域的服务器；**顶级域服务器**（com、edu、au 等）知道它下面各区域的服务器；每个机构的**权威域名服务器**知道自己的主机。你的网络服务商的**本地域名服务器**替你去问，并把每个答案**缓存**一段时间（每条记录都带着生存时间 TTL）。")),
                 svg(drawn(fig_dns), T('Your computer asks the local name server (1). The local name server asks the root (2), edu (4), washington.edu (6) and cs.washington.edu (8); each of the first three replies with a referral (3, 5, 7), and the last with the address (9), which goes back to your computer (10).',
                                         '你的电脑问本地域名服务器 (1)。本地域名服务器依次问根 (2)、edu (4)、washington.edu (6)、cs.washington.edu (8)；前三个各回复一个“去问谁”的指引 (3, 5, 7)，最后一个回复地址 (9)，地址再送回你的电脑 (10)。'),
                     T(r"Looking up robot.cs.washington.edu, as in the course's slide: the local name server walks down the tree, one referral at a time, until a server knows the address.", r"查询 robot.cs.washington.edu，和课件里一样：本地域名服务器沿着树往下走，一次一个指引，直到某台服务器知道这个地址。")),),
            read('q4-reason', T('What breaks, and what does not', '哪些坏了，哪些没坏'),
                 p(T(r"Go through the layers. Does anything below the application layer need DNS? Routers forward packets by IP address; TCP connects to an IP address and a port; neither ever asks DNS. So **the network itself keeps working**: packets still flow to any address.",
                     r"一层一层地看。应用层以下有谁需要 DNS 吗？路由器按 IP 地址转发包；TCP 连接的是 IP 地址加端口；它们从不找 DNS。所以**网络本身照常工作**：包照样能送到任何地址。")),
                 p(T(r"What breaks is one step: **name → address**. A browser given www.unimelb.edu.au cannot find the server; an email to someone at unimelb.edu.au cannot find the mail server. You could still reach a server by typing its IP address instead of its name, but people do not know the addresses of the services they use (and the addresses change).",
                     r"坏掉的是一步：**名字 → 地址**。浏览器拿着 www.unimelb.edu.au 找不到服务器；发给 unimelb.edu.au 某人的邮件找不到邮件服务器。你仍然可以输入 IP 地址代替名字去访问服务器，可人们并不知道自己用的那些服务的地址（而且地址还会变）。")),
                 p(T(r"So: possible in principle, nearly impossible in practice for most users.", r"所以：原则上还能用，实际上对大多数人几乎没法用。")),
                 quiz(T(r"All DNS servers have crashed. Which of these still works?", r"所有 DNS 服务器都崩溃了。下面哪个还能正常进行？"),
                      [(T(r"A video call that was already connected", r"一个早已接通的视频通话"), True),
                       (T(r"Sending an email to a friend at another university", r"给另一所大学的朋友发邮件"), T(r"Your mail server must look up the mail server of your friend's domain, which needs DNS.", r"你的邮件服务器得查朋友那个域名的邮件服务器，这需要 DNS。")),
                       (T(r"Opening a news site you have never visited", r"打开一个从没去过的新闻网站"), T(r"A new name has never been looked up, so no cache holds its address.", r"新名字从没查过，没有哪个缓存里有它的地址。"))],
                      T(r"The call's addresses were found before the crash, and packets between them need only IP and TCP or UDP. Anything that still has to turn a name into an address stops.", r"通话双方的地址是在崩溃之前就查好的，它们之间的包只需要 IP 和 TCP 或 UDP。凡是还得把名字翻译成地址的事，都停了。"))),
            read('q4-answer', T('Question 4: a full-mark answer', '第 4 题：满分答案'),
                 paper(T('Review (2), Q4 · a full-mark answer', '复习课 (2) 第 4 题 · 满分答案'),
                       T(r"DNS maps human-readable domain names to IP addresses. If all DNS servers crashed, domain names could no longer be resolved, although IP routing and transport connections do not depend on DNS, so packets would still be delivered to IP addresses. Web pages could then only be reached by typing the IP address of the server instead of its domain name (and email could not be delivered, since finding a domain's mail server needs DNS). Since most users do not know the IP addresses of the servers they use, the Internet would become extremely inefficient, if not virtually impossible, to use for most people.",
                         r"DNS 把人能读懂的域名映射成 IP 地址。如果所有 DNS 服务器都崩溃，域名将无法解析；但 IP 路由和传输层连接并不依赖 DNS，所以包照样能送到 IP 地址。这时只能输入服务器的 IP 地址而不是域名来访问网页（邮件也投递不了，因为找一个域的邮件服务器需要 DNS）。由于大多数用户不知道自己所用服务器的 IP 地址，对大多数人来说，互联网会变得极其低效，甚至几乎无法使用。"),
                       answer=True),
                 p(T(r"Where the marks are: what DNS does; that the network still works by address; the practical consequence for users. *The Internet stops* is wrong, and loses the mark for understanding what DNS is.",
                     r"分在这些地方：DNS 做什么；网络按地址照常工作；对用户的实际后果。写“互联网停了”是错的，也就丢了“懂得 DNS 是什么”的那一分。")),
                 details(T('Beyond the exam: the caches would buy some hours', '超出考试：缓存还能撑几个小时'),
                         p(T(r"Answers already cached, in your computer, your browser or your provider's local name server, keep working until their TTL runs out, which ranges from minutes to a day. So the failure would spread over hours as caches emptied. The real DNS is built against this: the 13 root server identities are each served by many machines around the world.",
                             r"已经缓存了的答案（在你的电脑、浏览器或网络服务商的本地域名服务器里）在 TTL 用完之前照样有效，从几分钟到一天不等。所以故障会随着缓存一个个过期，在几个小时里逐渐蔓延。真实的 DNS 早就防着这一点：13 个根服务器标识，每一个背后都是分布在世界各地的许多台机器。"))),),
            read('q5', T('Question 5, as printed', '第 5 题原文'),
                 paper(R2(5), T(r"What are the benefits of persistent HTTP connections, and what is the main challenge associated with them?", r"持久 HTTP 连接有什么好处？与之相关的主要难点是什么？")),
                 h(T('Reading it slowly', '慢慢读一遍')),
                 ul(T(r"**HTTP**: the browser (the client) asks a web server for *objects* (the HTML file, each image, each script), one request and one response per object, carried over TCP.", r"**HTTP**：浏览器（客户端）向网页服务器请求*对象*（HTML 文件、每张图片、每个脚本），每个对象一个请求、一个响应，用 TCP 运送。"),
                    T(r"**Persistent** or not: whether one TCP connection carries one object, or many.", r"**持久**与否：一条 TCP 连接只运送一个对象，还是运送很多个。"),
                    T(r"The question asks for *benefits*, plural, and *the main challenge*, one.", r"题目问的是*好处*（复数），以及*主要难点*（一个）。")),
                 p(T(r"The ideas: how a page is fetched, what each TCP connection costs in round trips and resources, and why keeping a connection open raises the question of when to close it.", r"需要的想法：网页是怎么取回来的，每条 TCP 连接在往返和资源上要花多少，以及为什么一旦保持连接，就要面对什么时候关的问题。")),
                 chapter=Q5),
            read('http', T('One connection per object, or one for all', '每个对象一条连接，还是全都走一条'),
                 p(T(r"A web page is a base HTML file plus the objects it refers to. The course's example: home.html with 10 JPEG images, 11 objects in all, all on the same server.", r"一个网页是一个基础 HTML 文件，加上它引用的各个对象。课上的例子：home.html 带 10 张 JPEG 图片，一共 11 个对象，都在同一台服务器上。")),
                 p(T(r"**Non-persistent HTTP**: each object gets a TCP connection of its own. Open it (one round trip for the handshake), send the request and get the first bytes back (a second round trip, plus the time to transmit the file), close it. That is **2 RTTs per object**, and the server sets up and tears down a connection, with its buffers and state, every time.",
                     r"**非持久 HTTP**：每个对象单独一条 TCP 连接。建立连接（握手一个往返），发请求、收回响应的头几个字节（第二个往返，再加上传完文件的时间），关闭。**每个对象 2 个 RTT**，而且服务器每次都要建立、拆除一条连接及其缓冲区和状态。")),
                 p(T(r"**Persistent HTTP**: the server leaves the connection open after a response, and the next requests to that server use it. One handshake serves the whole page. With **pipelining**, the client sends each request as soon as it finds the reference in the HTML, without waiting for the previous response.",
                     r"**持久 HTTP**：服务器发完响应后不关连接，之后发给这台服务器的请求都走它。整个页面只握一次手。加上**流水线**（pipelining），客户端在 HTML 里一看到引用就发出请求，不必等上一个响应回来。")),
                 svg(drawn(fig_http), T('Three client-server timelines for an HTML file and two images. Non-persistent: handshake, request, three times: 6 RTT. Persistent: one handshake, then one request each: 4 RTT. Pipelined: one handshake, the HTML, then both image requests together: 3 RTT.',
                                          '一个 HTML 文件加两张图片的三种客户端-服务器时间线。非持久：握手、请求，重复三次：6 个 RTT。持久：握手一次，再每个对象一个请求：4 个 RTT。流水线：握手一次，取 HTML，再把两个图片请求一起发：3 个 RTT。'),
                     T(r"A page with one HTML file and two images, counted in round trips (transmission time left out).", r"一个 HTML 文件加两张图片的页面，按往返次数来数（不计传输时间）。")),),
            derive('rtt', T('Counting the round trips of a page', '数一个页面要几个往返'),
                   [(r'11 \times 2 = 22', T(r"The course's page: an HTML file and 10 images, transmission time left out. **Non-persistent**: each of the 11 objects needs its own handshake and its own request, 2 RTTs each.", r"课上的页面：一个 HTML 文件加 10 张图片，不计传输时间。**非持久**：11 个对象各要自己的握手和请求，每个 2 个 RTT。")),
                    (r'1 + 1 + 10 = 12', T(r"**Persistent, one request at a time**: one handshake, one round trip for the HTML, then one for each image.", r"**持久，一次一个请求**：握手一次，HTML 一个往返，然后每张图片一个往返。")),
                    (r'1 + 1 + 1 = 3', T(r"**Persistent with pipelining**: the 10 image requests go out together, and their responses come back in about one round trip.", r"**持久加流水线**：10 个图片请求一起发出，它们的响应大约在一个往返里全部回来。"))],
                   blank=(1, '12', T(r"Persistent, one request at a time: one handshake, then one round trip per object, for 11 objects. How many RTTs?", r"持久、一次一个请求：握手一次，再每个对象一个往返，一共 11 个对象。几个 RTT？")),
                   outro=T(r"TCP gains as well. A connection that stays open keeps the congestion window it has grown; every new connection starts slow start from 1 again (the congestion control lesson).", r"TCP 本身也受益。一直开着的连接保留着已经长大的拥塞窗口；每条新连接都要从 1 重新慢启动（见拥塞控制那一课）。"),
                   skill=H),
            read('close', T('The catch: when to close', '难处：什么时候关'),
                 p(T(r"A persistent connection has to be closed by someone, some time. The server cannot know whether the user will click another link on this site in two seconds, or never. So it closes a connection that has been idle for a while; the response in the course's slide announces `Keep-Alive: timeout=10`.",
                     r"持久连接总得有人、在某个时候把它关掉。服务器没法知道用户是两秒后会点这个网站的下一个链接，还是再也不来了。所以它会关掉空闲了一段时间的连接；课件里那个响应写着 `Keep-Alive: timeout=10`。")),
                 ul(T(r"**Kept open too long**: every idle connection holds memory, a socket and TCP state on the server. With thousands of visitors, idle connections use up the server's resources and limit how many new clients it can serve.", r"**开得太久**：每条空闲连接都在服务器上占着内存、一个套接字和 TCP 状态。访客成千上万时，空闲连接会耗尽服务器的资源，限制它能服务的新客户端数量。"),
                    T(r"**Closed too soon**: the next request must open a new connection, paying the handshake and slow start again, and the benefit is lost.", r"**关得太早**：下一个请求又得建新连接，重新付握手和慢启动的代价，好处就没了。")),
                 quiz(T(r"A busy server keeps idle persistent connections open for ten minutes. What goes wrong?", r"一台很忙的服务器把空闲的持久连接保留十分钟。会出什么问题？"),
                      [(T(r"Thousands of idle connections tie up its memory and sockets, so it struggles to accept new clients", r"成千上万条空闲连接占着内存和套接字，它很难再接受新客户端"), True),
                       (T(r"Pages load more slowly for returning users", r"回头的用户打开页面更慢"), T(r"For a user who comes back within ten minutes, the open connection makes the page faster.", r"对十分钟内回来的用户，开着的连接让页面更快。")),
                       (T(r"Responses arrive out of order", r"响应会乱序到达"), T(r"TCP keeps the order within a connection, however long it stays open.", r"不管连接开多久，TCP 都保证一条连接内的顺序。"))],
                      T(r"The cost of a persistent connection is paid by the server while the connection sits idle; the benefit comes only if the client uses it again. The timeout is the trade-off between the two.", r"持久连接的代价由服务器在连接空闲期间承担；好处只有客户端再次用到它时才有。超时时间就是在这两者之间的权衡。"))),
            read('q5-answer', T('Question 5: a full-mark answer', '第 5 题：满分答案'),
                 p(T(r"Benefits, each with its reason, then the one challenge, with both sides of it:", r"先写好处，每条带着理由；再写那一个难点，两面都要说到：")),
                 paper(T('Review (2), Q5 · a full-mark answer', '复习课 (2) 第 5 题 · 满分答案'),
                       T(r"Persistent HTTP reuses the same TCP connection for multiple requests and responses between a client and a server. This reduces overhead, since a new TCP connection (with its handshake round trip and the server resources it needs) is not set up for every object, and it increases request throughput and lowers delay, especially with pipelining, where the client sends requests without waiting for each response.",
                         r"持久 HTTP 让客户端和服务器之间的多个请求和响应复用同一条 TCP 连接。这减少了开销，因为不必为每个对象新建一条 TCP 连接（以及它的握手往返和所需的服务器资源）；同时提高了请求吞吐量、降低了延迟，在流水线方式下尤其明显——客户端不必等每个响应回来就发出下一个请求。"),
                       T(r"The main challenge is deciding when to close the connection: keeping it open too long wastes server resources on idle connections, while closing it too soon loses the performance benefit, because the next request must open a new connection.",
                         r"主要难点是决定什么时候关闭连接：开得太久，空闲连接浪费服务器资源；关得太早，下一个请求又得建新连接，性能上的好处就没了。"),
                       answer=True),),
            read('dns-wider', T('More DNS the exam can ask', '考试还可能问的 DNS'),
                 h(T('Why not one central DNS server?', '为什么不用一台中央 DNS 服务器？')),
                 p(T(r"The course's slide gives four reasons, each worth a sentence: the **traffic volume** of every lookup in the world would swamp one server; it would be a **single point of failure** (the attack in question 4 would need only one target); it would be **distant** from most users, so every lookup would be slow; and one database for every host on Earth would be impossible to **maintain**. A hierarchy of zones spreads the load, the risk and the upkeep, and lets each organisation run its own names.",
                     r"课件给了四条理由，每条值得写一句：全世界所有查询的**流量**会压垮一台服务器；它会成为**单点故障**（第 4 题里的攻击只需要打一个目标）；它离大多数用户都**很远**，每次查询都慢；一个装着地球上所有主机的数据库根本没法**维护**。按区域分层，把负载、风险和维护工作都分散开，也让每个机构管理自己的名字。")),
                 h(T('Recursive and iterative queries', '递归查询和迭代查询')),
                 p(T(r"In a **recursive** query, the server asked does all the work and returns the final answer: that is what your computer asks of the local name server. In an **iterative** query, the server asked replies with a referral, *I do not know, but ask this server*: that is how the root, edu and washington.edu servers answer the local name server in the figure above. Lookups run over UDP on port 53, and a lost query is simply sent again.",
                     r"**递归**查询里，被问的服务器包揽所有工作，返回最终答案：你的电脑问本地域名服务器就是这样。**迭代**查询里，被问的服务器只回一个指引：*我不知道，但你去问这台*：上图里根、edu、washington.edu 回答本地域名服务器就是这样。查询走 UDP 的 53 端口，丢了就重发。")),
                 chapter=WIDER_CH()),
            read('http-wider', T('More HTTP the exam can ask', '考试还可能问的 HTTP'),
                 ul(T(r"**Parallel connections.** Browsers also open several non-persistent connections at once to fetch objects in parallel. That cuts the waiting, but multiplies the handshakes and the server's connections.", r"**并行连接。**浏览器也会同时开好几条非持久连接，并行地取对象。这减少了等待，但握手次数和服务器上的连接数都成倍增加。"),
                    T(r"**Cookies.** HTTP is stateless: each request stands on its own. A site that wants to recognise you sends `Set-cookie: 1678` once; your browser then adds `Cookie: 1678` to every later request to that site, and the site looks the number up in its database.", r"**Cookie。**HTTP 是无状态的：每个请求都是独立的。网站想认出你，就先发一次 `Set-cookie: 1678`；之后你的浏览器在发往这个网站的每个请求里都带上 `Cookie: 1678`，网站再拿这个号去自己的数据库里查。"),
                    T(r"**Web caches** (proxy servers) answer requests with stored copies. They cut response time, network traffic and the load on the origin server; their difficulty is keeping the copies fresh.", r"**网页缓存**（代理服务器）用存下来的副本回答请求。它们缩短响应时间、减少网络流量、减轻源服务器的负担；难处在于让副本保持最新。"))),
            number('try-np', T('Your turn: a non-persistent page', '你来：非持久地取一个页面'), N,
                   T(r"A page has a base HTML file and 5 images, all on one server. With non-persistent HTTP, fetching one object at a time, how many RTTs does the whole page take? (Leave out transmission time.)", r"一个页面有一个基础 HTML 文件和 5 张图片，都在同一台服务器上。用非持久 HTTP、一次取一个对象，整个页面要几个 RTT？（不计传输时间。）"),
                   12, T(r"6 objects × 2 RTTs (a handshake and a request each) = 12.", r"6 个对象 × 2 个 RTT（各一次握手、一次请求）= 12。"),
                   tolerance=0, hints=[T(r"Count the objects first, the HTML included.", r"先数对象，HTML 也算一个。")], chapter=TRY_CH()),
            number('try-pipe', T('Your turn: the same page, pipelined', '你来：同一页面，用流水线'), H,
                   T(r"The same page over one persistent connection with pipelining. How many RTTs?", r"同一个页面，用一条持久连接加流水线。几个 RTT？"),
                   3, T(r"One handshake, one round trip for the HTML, then the 5 image requests together in one more: 3.", r"握手一个，HTML 一个，再把 5 个图片请求一起发，又一个：3。"),
                   tolerance=0),
            text_q('try-central', T('Your turn: why DNS is spread out', '你来：DNS 为什么是分散的'), Z,
                   T(r"Why is DNS run as a distributed hierarchy of name servers rather than as one central server? Give two reasons.", r"DNS 为什么由一个分层的、分布式的域名服务器体系来运行，而不是一台中央服务器？给出两条理由。"),
                   [T('One server could not handle the traffic of every lookup', '一台服务器扛不住所有查询的流量'),
                    T('One server would be a single point of failure', '一台服务器会成为单点故障'),
                    T('A central server would be far from most users (slow), and one database of every host could not be maintained', '中央服务器离大多数用户很远（慢），而且一个包含所有主机的数据库无法维护')],
                   T(r"A single server would have to answer every lookup in the world, far more traffic than one machine can carry; it would be a single point of failure, so one crash or attack would stop name resolution everywhere; it would be far away from most users, making every lookup slow; and one database of every host would be impossible to keep up to date. A hierarchy of zones spreads the load and the risk, and lets each organisation maintain its own names.",
                     r"一台服务器得回答全世界的每一次查询，流量远超一台机器的承受能力；它会是单点故障，一次崩溃或攻击就让各地的域名解析全停；它离大多数用户都很远，每次查询都慢；一个包含所有主机的数据库也不可能维护得过来。按区域分层能分散负载和风险，也让每个机构自己维护自己的名字。"),
                   T(r"Any two of: traffic volume, single point of failure, distance, maintenance, each with a word on why.", r"四条里任选两条：流量、单点故障、距离、维护，每条说一句为什么。")),
            choice('try-iterative', T('Your turn: a referral', '你来：一个指引'), R,
                   T(r"Looking up robot.cs.washington.edu, the root server answers the local name server with *ask the edu server*. What kind of query is that?", r"查询 robot.cs.washington.edu 时，根服务器回复本地域名服务器：*去问 edu 服务器*。这是哪种查询？"),
                   [(T(r"Iterative: the server replies with a referral instead of the final answer", r"迭代查询：服务器回复一个指引，而不是最终答案"), True),
                    (T(r"Recursive: the root does the work on the asker's behalf", r"递归查询：根服务器替提问者包办"), T(r"A recursive server would return the final address itself, as the local name server does for your computer.", r"递归的话，服务器会自己把最终地址找来返回，就像本地域名服务器替你的电脑做的那样。")),
                    (T(r"A cached answer", r"一个缓存的答案"), T(r"A cached answer would be the address itself; a referral only says whom to ask next.", r"缓存的答案就是地址本身；指引只说下一个该问谁。"))],
                   T(r"Root and top-level servers answer iteratively, which keeps them light: each reply is one step down the tree. The local name server makes the whole walk, recursively on behalf of its users.", r"根服务器和顶级域服务器用迭代方式回答，这让它们负担很轻：每次回复只往树下走一步。整条路由本地域名服务器替它的用户递归地走完。")),
        ],
    )


SMTP_DIALOGUE = '''S: 220 mail.unimelb.edu.au ESMTP ready
C: HELO laptop.example.com
S: 250 Hello laptop.example.com
C: MAIL FROM:<alice@example.com>
S: 250 OK
C: RCPT TO:<bob@unimelb.edu.au>
S: 250 OK
C: DATA
S: 354 End data with <CR><LF>.<CR><LF>
C: From: alice@example.com
C: To: bob@unimelb.edu.au
C: Subject: Exam
C:
C: See you at nine.
C: .
S: 250 OK: queued
C: QUIT
S: 221 Bye'''


def L_mail():
    E, M, F, C, J = '4ndan6.email-architecture', '4ndan6.smtp-transfer', '4ndan6.message-format-mime', '4ndan6.multimedia-compression', '4ndan6.jitter-buffer'
    Q6, Q7 = T('Question 6: SMTP', '第 6 题：SMTP'), T('Question 7: lossy compression', '第 7 题：有损压缩')
    return dict(
        id=f'{CID}-exam-mail', title=T('Email and multimedia: SMTP, and lossy compression (R2 · 6, 7)', '邮件与多媒体：SMTP 与有损压缩（复2 · 6、7）'),
        description=T('How an email travels and what an SMTP conversation looks like, which gives its strength and its weakness; what lossy compression gives up and why multimedia needs it; then MIME, mailboxes and streaming.', '一封邮件怎么走、一次 SMTP 对话长什么样，它的优点和缺点就在里面；有损压缩放弃了什么，多媒体为什么离不开它；再看 MIME、收信和流媒体。'),
        minutes=35,
        skills=skills(E, M, F, C, J),
        misconceptions=[{'id': 'lossy-is-worse', 'description': T('Thinking lossy compression just means lower quality, without saying the result is an approximation', '以为有损压缩只是“质量更差”，没说出结果是对原数据的近似')}],
        steps=[
            read('q6', T('Question 6, as printed', '第 6 题原文'),
                 paper(R2(6), T(r"Name one advantage and one disadvantage of SMTP.", r"说出 SMTP 的一个优点和一个缺点。")),
                 h(T('Reading it slowly', '慢慢读一遍')),
                 ul(T(r"**SMTP** (Simple Mail Transfer Protocol) carries email from your mail program to your mail server, and from mail server to mail server.", r"**SMTP**（Simple Mail Transfer Protocol，简单邮件传输协议）把邮件从你的邮件程序送到你的邮件服务器，再在邮件服务器之间传送。"),
                    T(r"**One advantage and one disadvantage**: two items. Each is a property of the protocol, plus why it helps or hurts.", r"**一个优点和一个缺点**：两项。每一项都是协议的一个特性，再加上它为什么有利或有害。")),
                 p(T(r"Both come straight out of what an SMTP conversation looks like, so that is where the lesson goes: how a message travels, and then one conversation, line by line.", r"两项都直接来自 SMTP 对话的样子，所以这一课就从这里走：先看一封邮件怎么走，再一行一行地看一次对话。")),
                 chapter=Q6),
            read('path', T('How an email travels', '一封邮件怎么走'),
                 p(T(r"Email has two kinds of programs. **User agents** are what you read and write mail in (Outlook, the Mail app). **Message transfer agents** (MTAs), also called mail servers, move mail from the sender's side to the receiver's.", r"邮件系统里有两类程序。**用户代理**（user agent）是你读写邮件的程序（Outlook、手机上的邮件）。**邮件传输代理**（MTA，message transfer agent），也叫邮件服务器，负责把邮件从发件方送到收件方。")),
                 svg(drawn(fig_mail), T("Four boxes in a row: Alice's user agent, Alice's mail server, Bob's mail server, Bob's user agent. SMTP carries the message for submission and for transfer; IMAP or POP3 for final delivery.",
                                          '一排四个方框：Alice 的用户代理、Alice 的邮件服务器、Bob 的邮件服务器、Bob 的用户代理。提交和传送用 SMTP；最终投递用 IMAP 或 POP3。'),
                     T(r"Submission (SMTP, port 587, with a password) and transfer between servers (SMTP, port 25); final delivery to Bob's program by IMAP or POP3.", r"提交（SMTP，端口 587，需要密码）和服务器之间的传送（SMTP，端口 25）；最终投递到 Bob 的程序用 IMAP 或 POP3。")),
                 p(T(r"Why not SMTP all the way to Bob? SMTP *pushes* a message to a server that must be up to accept it. Bob's laptop is often off or asleep, so the message waits in his always-on mail server until his user agent *pulls* it with IMAP or POP3.",
                     r"为什么不一路用 SMTP 送到 Bob 手里？SMTP 是把邮件*推*给一台必须在线才能接收的服务器。Bob 的笔记本常常关着或休眠，所以邮件先在他那台一直在线的邮件服务器里等着，直到他的用户代理用 IMAP 或 POP3 把它*拉*下来。"))),
            read('dialogue', T('One SMTP conversation', '一次 SMTP 对话'),
                 p(T(r"Here is Alice's server handing a message to Bob's, over a TCP connection to port 25. Lines from the client start with C:, from the server with S:.", r"下面是 Alice 的服务器通过一条到 25 端口的 TCP 连接，把一封邮件交给 Bob 的服务器。C: 开头的是客户端发的，S: 开头的是服务器发的。")),
                 {'type': 'code', 'lang': 'text', 'code': SMTP_DIALOGUE},
                 p(T(r"Two things stand out, and they are the answer.", r"有两点很显眼，它们就是答案。")),
                 ul(T(r"**Every line is plain ASCII text.** Commands are words (HELO, MAIL FROM, RCPT TO, DATA, QUIT); replies are a three-digit code and a phrase. A person can read the exchange, type it by hand to test a server, and see at once where it went wrong. That makes SMTP easy to develop, test and debug, and easy to implement.",
                      r"**每一行都是纯 ASCII 文本。**命令是单词（HELO、MAIL FROM、RCPT TO、DATA、QUIT）；回复是一个三位数的代码加一句话。人能直接读懂整个过程，能手敲命令去测试一台服务器，出错时一眼看出错在哪。所以 SMTP 容易开发、测试、调试，也容易实现。"),
                    T(r"**The client waits for a reply after every command.** Greeting, sender, recipient, DATA, the message, QUIT: about six round trips for one email. Over a long-distance link, most of the time goes on waiting.",
                      r"**客户端每发一条命令都要等回复。**问候、发件人、收件人、DATA、正文、QUIT：一封邮件大约六个往返。在长距离的链路上，大部分时间都花在等待上。")),
                 p(T(r"A third property is in the course too: SMTP was designed for 7-bit ASCII text. Images, attachments and non-Latin text must first be encoded as ASCII (MIME, usually base64), which makes them about a third larger.",
                     r"课上还讲了第三个特性：SMTP 是为 7 位 ASCII 文本设计的。图片、附件和非拉丁文字得先编码成 ASCII（MIME，通常是 base64），体积会大约增加三分之一。"))),
            read('q6-answer', T('Question 6: a full-mark answer', '第 6 题：满分答案'),
                 paper(T('Review (2), Q6 · a full-mark answer', '复习课 (2) 第 6 题 · 满分答案'),
                       T(r"Advantage: SMTP is a simple, text-based (ASCII) protocol. Its commands and replies are human-readable, so it is easy to implement, test and debug; one can even type the commands by hand.",
                         r"优点：SMTP 是一个简单的、基于文本（ASCII）的协议。它的命令和回复人都能读懂，因此容易实现、测试和调试；甚至可以手工敲命令。"),
                       T(r"Disadvantage: it needs several back-and-forth command/response exchanges for every email (HELO, MAIL FROM, RCPT TO, DATA, ...), each waiting for a reply, which adds round trips and delay. (Also accepted: it carries only 7-bit ASCII, so binary content needs MIME encoding such as base64, which enlarges messages.)",
                         r"缺点：每封邮件都需要多次一来一回的命令/响应交换（HELO、MAIL FROM、RCPT TO、DATA……），每次都要等回复，增加了往返次数和延迟。（也可以写：它只能传 7 位 ASCII，二进制内容需要 base64 这类 MIME 编码，邮件会变大。）"),
                       answer=True),
                 p(T(r"For each item, name the property and say why it is good or bad. *SMTP is simple* alone is half an answer; *simple and text-based, so easy to read, debug and implement* is a whole one.", r"每一项都要说出特性，并说明为什么好或不好。只写“SMTP 很简单”是半个答案；写“简单、基于文本，所以容易读、调试和实现”才是完整的。"))),
            read('q7', T('Question 7, as printed', '第 7 题原文'),
                 paper(R2(7), T(r"What is lossy compression? Why is it important for encoding multimedia data?", r"什么是有损压缩？为什么它对多媒体数据的编码很重要？")),
                 h(T('Reading it slowly', '慢慢读一遍')),
                 ul(T(r"**Compression** encodes data in fewer bits at the source; **decoding** at the destination turns it back into something usable.", r"**压缩**是在发送端用更少的位来编码数据；在接收端**解码**，再把它还原成能用的样子。"),
                    T(r"**What is**: a definition. **Why is it important for multimedia**: the reason that applies to audio, images and video in particular.", r"**什么是**：要一个定义。**为什么对多媒体重要**：要的是专门针对音频、图像和视频的理由。")),
                 chapter=Q7),
            read('lossy', T('Lossless and lossy', '无损与有损'),
                 p(T(r"**Lossless** compression gives back exactly the original when decoded (ZIP, PNG, FLAC). It works by finding structure in the data, such as repeats and patterns. For text, programs and spreadsheets nothing else will do: a single changed bit can break them.",
                     r"**无损**压缩解码后得到的和原来一模一样（ZIP、PNG、FLAC）。它靠找出数据里的结构来压缩，比如重复和规律。文本、程序、电子表格只能用它：改动一位就可能把它们弄坏。")),
                 p(T(r"**Lossy** compression gives back only an **approximation** of the original. The aim is to throw away what matters least. For multimedia that works remarkably well, for two reasons.", r"**有损**压缩解码后只得到原数据的**近似**。目标是扔掉最不要紧的部分。对多媒体，这一招非常管用，原因有两个。")),
                 ol(T(r"**Multimedia is huge.** CD-quality sound is 44,100 samples per second × 16 bits × 2 channels ≈ 1.4 Mbit/s. Uncompressed HD video is 1920 × 1080 pixels × 24 bits × 30 frames per second ≈ 1.5 Gbit/s, far more than a home connection carries. Lossless compression shrinks such data only about twofold.",
                       r"**多媒体数据量巨大。**CD 音质的声音是每秒 44,100 个采样 × 16 位 × 2 声道 ≈ 1.4 Mbit/s。不压缩的高清视频是 1920 × 1080 像素 × 24 位 × 每秒 30 帧 ≈ 1.5 Gbit/s，远超家庭网络能承载的。无损压缩只能把这类数据缩小两倍左右。"),
                    T(r"**People cannot perceive all of it.** **Perceptual encoding** exploits the limits of our eyes and ears: a quiet sound right next to a loud one of similar pitch is masked and can be dropped (MP3); fine detail in colour matters less than in brightness (JPEG); much of each video frame repeats the one before (H.264). Throw that away and the result looks and sounds almost the same.",
                      r"**人感知不到其中很多部分。****感知编码**（perceptual encoding）利用的是眼睛和耳朵的局限：一个响亮的声音旁边、音高相近的轻声会被掩盖，可以去掉（MP3）；颜色的细节没有亮度的细节那么重要（JPEG）；视频的每一帧大部分和上一帧重复（H.264）。把这些扔掉，看起来、听起来几乎一样。")),
                 table([T('Media', '媒体'), T('Uncompressed', '未压缩'), T('Lossy, typical', '有损压缩，常见'), T('Ratio', '压缩比')],
                       [T('CD-quality music', 'CD 音质音乐'), '1.4 Mbit/s', T('MP3, 128 kbit/s', 'MP3，128 kbit/s'), '≈ 11×'],
                       [T('HD video, 1080p', '高清视频 1080p'), '1.5 Gbit/s', T('H.264, about 5 Mbit/s', 'H.264，约 5 Mbit/s'), '≈ 300×']),
                 p(T(r"That is the trade the course's slide names: accepting a small loss of information buys a large payoff in the compression ratio.", r"这就是课件里说的那笔交易：接受一点点信息损失，换来压缩比上的巨大收益。")),
                 quiz(T(r"Which of these must be compressed losslessly?", r"下面哪个必须用无损压缩？"),
                      [(T(r"A program you download and run", r"一个你下载来运行的程序"), True),
                       (T(r"A song for streaming", r"一首用来在线播放的歌"), T(r"Lossy is fine: the parts dropped are ones the ear does not notice.", r"有损就可以：扔掉的是耳朵察觉不到的部分。")),
                       (T(r"A photo on a web page", r"网页上的一张照片"), T(r"Lossy is fine, and usual (JPEG): small changes to pixels are invisible.", r"有损就可以，而且很常见（JPEG）：像素上的微小变化看不出来。"))],
                      T(r"A program must come back bit for bit: one changed byte can crash it. Sound and pictures only have to look and sound right to a person.", r"程序必须一位不差地还原：改了一个字节就可能崩溃。声音和图片只要在人看来、听来是对的就行。"))),
            read('q7-answer', T('Question 7: a full-mark answer', '第 7 题：满分答案'),
                 paper(T('Review (2), Q7 · a full-mark answer', '复习课 (2) 第 7 题 · 满分答案'),
                       T(r"In a lossy compression system the decoded data is only an approximation of the original data, not an exact copy (unlike lossless compression, where the original is reconstructed exactly).",
                         r"在有损压缩系统里，解码得到的数据只是原数据的近似，而不是精确的副本（无损压缩则能精确还原原数据）。"),
                       T(r"It is important for multimedia because audio, images and video are very large, and lossy systems based on perceptual encoding discard information that human eyes and ears barely notice. Accepting a small loss of information gives a much larger compression ratio (about 10 times for music, hundreds of times for video) than lossless methods can, which greatly reduces the bandwidth and storage multimedia needs.",
                         r"它对多媒体很重要，因为音频、图像和视频的数据量非常大，而基于感知编码的有损系统扔掉的是人眼和人耳几乎察觉不到的信息。接受一点信息损失，就能得到比无损方法大得多的压缩比（音乐约 10 倍，视频可达数百倍），大大降低多媒体所需的带宽和存储。"),
                       answer=True),
                 p(T(r"The definition earns its mark with the word *approximation*. The reason earns its marks with *perceptual* (what is dropped is what people do not notice) and *compression ratio* (what is gained).", r"定义那一分靠*近似*这个词。理由那几分靠*感知*（扔掉的是人察觉不到的）和*压缩比*（换来了什么）。"))),
            read('mime', T('MIME, and fetching the mail', 'MIME，以及收信'),
                 p(T(r"**MIME** (Multipurpose Internet Mail Extensions) is how mail carries more than English text. It adds headers that say what the body is (`Content-Type: image/jpeg`) and how it was wrapped for the trip (`Content-Transfer-Encoding: base64`), and lets one message hold several parts, such as text and an attachment. **Base64** turns every 3 bytes into 4 ASCII characters, so an attachment travels about 4/3 of its size.",
                     r"**MIME**（多用途互联网邮件扩展）让邮件能装下英文文本以外的东西。它加了一些头部，说明正文是什么（`Content-Type: image/jpeg`）、为了运送包装成了什么样（`Content-Transfer-Encoding: base64`），还让一封邮件可以由好几个部分组成，比如正文加一个附件。**Base64** 把每 3 个字节变成 4 个 ASCII 字符，所以附件在路上的大小约为原来的 4/3。")),
                 p(T(r"**Final delivery.** **POP3** downloads the mail to one device and, usually, removes it from the server. **IMAP** keeps the mail on the server, with folders, so several devices see the same mailbox. **Webmail** (Gmail) is a user agent made of web pages: your browser talks HTTP to the mail service, which still uses SMTP between mail servers.",
                     r"**最终投递。****POP3** 把邮件下载到一台设备上，通常还会从服务器上删掉。**IMAP** 把邮件留在服务器上，带文件夹，几台设备看到的是同一个邮箱。**网页邮箱**（比如 Gmail）是一个由网页组成的用户代理：浏览器和邮件服务之间说 HTTP，而邮件服务器之间仍然用 SMTP。")),
                 chapter=WIDER_CH()),
            read('streaming', T('Streaming: jitter, buffers and lost packets', '流媒体：抖动、缓冲和丢包'),
                 p(T(r"Packets of a stream do not arrive at an even pace: the delay varies from packet to packet. That variation is **jitter**. A player that played each packet the moment it arrived would stutter, so it first fills a **buffer** and plays from it at a steady pace. The trade-off, from the course: a **small buffer** starts quickly but stalls when jitter is large; a **large buffer** makes you wait at the start but rides out the jitter.",
                     r"一个流里的包不是匀速到达的：每个包的延迟都不一样。这种变化叫**抖动**（jitter）。播放器要是包一到就播，就会一卡一卡的，所以它先攒满一个**缓冲区**，再从里面匀速播放。课上讲的取舍：**小缓冲区**开播快，但抖动大时会卡住；**大缓冲区**开头要等，但能扛住抖动。")),
                 p(T(r"Lost packets are handled without retransmission where time matters: **forward error correction** sends extra data, such as one parity packet (the XOR of four data packets) from which any one of the four can be rebuilt; **error concealment** at the receiver fills a gap, for example by interpolating between frames. A live call keeps its buffer small and skips late packets, which is why it runs over RTP and UDP.",
                     r"在讲究时效的场合，丢包不靠重传来处理：**前向纠错**（FEC）多发一些数据，比如每四个数据包配一个校验包（四个包的异或），丢了其中任何一个都能恢复；接收方的**错误掩盖**（error concealment）把缺口补上，比如在前后两帧之间插值。实时通话的缓冲区很小，迟到的包直接跳过，所以它跑在 RTP 和 UDP 上。"))),
            choice('try-pull', T('Your turn: pushing and pulling mail', '你来：推邮件和拉邮件'), E,
                   T(r"Why does Bob's user agent collect his mail with IMAP or POP3, rather than having it delivered to his laptop by SMTP?", r"为什么 Bob 的用户代理用 IMAP 或 POP3 来收信，而不是让邮件通过 SMTP 直接送到他的笔记本上？"),
                   [(T(r"SMTP pushes mail to a server that must be up to accept it, and Bob's laptop is often off", r"SMTP 是把邮件推给一台必须在线才能接收的服务器，而 Bob 的笔记本常常关着"), True),
                    (T(r"SMTP cannot carry attachments", r"SMTP 运不了附件"), T(r"With MIME encoding it can; that is how every attachment travels between servers.", r"用 MIME 编码就能运；服务器之间的附件都是这么走的。")),
                    (T(r"IMAP is faster than SMTP", r"IMAP 比 SMTP 快"), T(r"Speed is not the reason. The receiving end of SMTP has to be online when the mail is sent.", r"原因不在速度。SMTP 的接收端必须在发信的那一刻在线。"))],
                   T(r"Mail waits in Bob's always-on server; his user agent pulls it whenever he is online.", r"邮件在 Bob 那台一直在线的服务器上等着；他的用户代理什么时候上线，什么时候拉下来。"),
                   chapter=TRY_CH()),
            number('try-base64', T('Your turn: an attachment in transit', '你来：路上的附件'), F,
                   T(r"A 300 KB photo is attached to an email and encoded in base64. About how large is it in transit, in KB?", r"一封邮件附带一张 300 KB 的照片，用 base64 编码。它在路上大约多大，以 KB 计？"),
                   400, T(r"Base64 turns every 3 bytes into 4 characters: $300 \times 4/3 = 400$ KB.", r"base64 把每 3 个字节变成 4 个字符：$300 \times 4/3 = 400$ KB。"),
                   tolerance=5, unit='KB'),
            number('try-ratio', T('Your turn: how much MP3 saves', '你来：MP3 省了多少'), C,
                   T(r"CD-quality audio is 1411 kbit/s. Encoded as MP3 at 128 kbit/s, what is the compression ratio? (One decimal.)", r"CD 音质的音频是 1411 kbit/s。编码成 128 kbit/s 的 MP3，压缩比是多少？（保留一位小数。）"),
                   11.0, T(r"$1411 / 128 \approx 11.0$: the MP3 is about eleven times smaller, and most listeners cannot tell.", r"$1411 / 128 \approx 11.0$：MP3 小了大约十一倍，大多数听众听不出区别。"),
                   tolerance=0.15),
            text_q('try-buffer', T('Your turn: why the player waits', '你来：播放器为什么要等'), J,
                   T(r"Why does a video player wait a few seconds before it starts to play a stream?", r"为什么视频播放器在开始播放一个流之前要先等几秒？"),
                   [T('To fill a buffer before playing', '为了在播放前先填满缓冲区'),
                    T('Packets arrive with varying delay (jitter); the buffer absorbs it so playback stays smooth', '包到达的延迟各不相同（抖动）；缓冲区把它吸收掉，播放才平稳'),
                    T('A larger buffer means a longer wait at the start but fewer stalls', '缓冲区越大，开头等得越久，但卡顿越少')],
                   T(r"It is filling a playout buffer. Packets arrive with varying delay (jitter), so playing each one as it arrives would stall whenever one is late; playing from a buffer at a steady pace hides the variation. The bigger the buffer, the longer the wait at the start but the fewer the stalls.",
                     r"它在填播放缓冲区。包到达的延迟时快时慢（抖动），要是来一个播一个，只要有一个迟到就会卡住；从缓冲区里匀速地播，就把这种变化藏起来了。缓冲区越大，开头等得越久，但卡顿越少。"),
                   T(r"The buffer trades start-up delay for smoothness: that trade is what the question is after.", r"缓冲区是用开播的延迟换平稳：题目要的就是这个取舍。")),
        ],
    )


def L_cipher():
    Y, M, K = '3kgkap.symmetric-des-aes', '3kgkap.cipher-modes', '3kgkap.keystream-reuse'
    return dict(
        id=f'{CID}-exam-cipher', title=T('Encrypting a file you read from the middle: cipher modes (R1 · 2)', '从中间读的加密文件：密码的工作模式（复1 · 2）'),
        description=T('What a block cipher does to a file, why plain ECB leaks patterns, why chained modes make random access hard, how counter mode makes every block independent, and the one rule counter mode must never break.', '分组密码怎样处理一个文件，为什么直接用 ECB 会泄露规律，为什么链式模式让随机访问变难，计数器模式怎样让每一块各自独立，以及计数器模式绝不能破的那条规矩。'),
        minutes=35,
        skills=skills(Y, M, K),
        misconceptions=[{'id': 'ecb-random', 'description': T('Choosing ECB for random access without seeing that it reveals repeated blocks', '为了随机访问选 ECB，却没看到它会暴露重复的块')}],
        steps=[
            read('question', T('The question, as printed', '题目原文'),
                 paper(R1(2, ('practice exam, Q16', '模拟卷第 16 题')),
                       T(r"An encrypted file needs to be accessed in non-sequential order. Which cipher mode is best suited to encrypting this file, and briefly explain why.",
                         r"一个加密文件需要按非顺序的方式访问。哪种密码工作模式最适合加密这个文件？简要解释原因。")),
                 h(T('Reading it slowly', '慢慢读一遍')),
                 ul(T(r"**An encrypted file**: a file on disk, encrypted with a symmetric block cipher such as AES (the same key encrypts and decrypts).", r"**加密文件**：磁盘上的一个文件，用 AES 这类对称分组密码加密（加密和解密用同一个密钥）。"),
                    T(r"**Accessed in non-sequential order**: random access. A database file, or a video in which you jump to minute 40: you want block 1000 without going through blocks 1 to 999, and perhaps you want to change it and write it back.", r"**按非顺序访问**：随机访问。比如一个数据库文件，或者一段视频你想直接跳到第 40 分钟：你要第 1000 块，而不想从第 1 块走到第 999 块，也许还要改了它再写回去。"),
                    T(r"**Cipher mode**: the rule for applying a block cipher to a long run of blocks. The course names five: electronic code book, cipher block chaining, cipher feedback, stream cipher and counter mode.", r"**密码工作模式**（cipher mode）：把分组密码用在一长串块上的规则。课上讲了五种：电子密码本、密码块链接、密码反馈、流密码和计数器模式。")),
                 p(T(r"The ideas: what the plainest mode does and why it is not enough; why chaining blocks together, the usual fix, gets in the way of random access; and how counter mode avoids both problems.", r"需要的想法：最朴素的模式怎么做、为什么不够；通常的补救办法——把块串起来——为什么妨碍了随机访问；以及计数器模式怎样同时避开这两个问题。")),
                 chapter=Q_CH()),
            read('block', T('A block cipher, and the trouble with using it plainly', '分组密码，以及直接用它的毛病'),
                 p(T(r"A block cipher encrypts one fixed-size block at a time: 64 bits for DES, 128 bits for AES. With key $K$, it turns a plaintext block $P$ into a ciphertext block $C = E_K(P)$, and $D_K(C) = P$ turns it back. A file is many blocks, $P_1, P_2, P_3, \dots$",
                     r"分组密码一次加密一个固定大小的块：DES 是 64 位，AES 是 128 位。用密钥 $K$，它把明文块 $P$ 变成密文块 $C = E_K(P)$，$D_K(C) = P$ 再把它变回来。一个文件就是很多块：$P_1, P_2, P_3, \dots$")),
                 p(T(r"The plainest way is **electronic code book (ECB)** mode: encrypt each block on its own, $C_i = E_K(P_i)$. Random access is easy, since block 1000 is just $E_K(P_{1000})$. But the same plaintext block always gives the same ciphertext block. Files are full of repeats (headers, blank areas, records with the same fields), so an eavesdropper sees where the repeats are, and can even swap or replay blocks without knowing the key. The course's slide: the same text leads to the same ciphertext, unless something else is done.",
                     r"最朴素的方式是**电子密码本**（ECB）模式：每块单独加密，$C_i = E_K(P_i)$。随机访问很容易，第 1000 块就是 $E_K(P_{1000})$。但同样的明文块总是变成同样的密文块。文件里到处是重复（文件头、空白区域、字段相同的记录），窃听者能看出哪里重复，甚至不知道密钥也能调换或重放某些块。课件的说法：同样的文本得到同样的密文，除非另想办法。")),
                 chapter=IDEAS_CH()),
            read('chained', T('Chained modes: each block depends on the one before', '链式模式：每块都依赖前一块'),
                 p(T(r"**Cipher block chaining (CBC)**: before encrypting a block, XOR it with the previous ciphertext block; the first block is XORed with a random **initialisation vector** (IV): $C_i = E_K(P_i \oplus C_{i-1})$. Identical plaintext blocks now give different ciphertext.",
                     r"**密码块链接**（CBC）：加密一个块之前，先把它和前一个密文块做异或；第一块和一个随机的**初始化向量**（IV）异或：$C_i = E_K(P_i \oplus C_{i-1})$。这样一来，相同的明文块会得到不同的密文。")),
                 p(T(r"**Cipher feedback (CFB)** works a byte at a time, which suits data produced a byte at a time, such as keystrokes. A register holding the last 8 bytes of ciphertext is encrypted, and one byte of the result is XORed with the next plaintext byte. So each byte depends on the 8 ciphertext bytes before it (and a single wrong bit in the ciphertext spoils 9 bytes of the decrypted text).",
                     r"**密码反馈**（CFB）一次处理一个字节，适合一个字节一个字节产生的数据，比如击键。一个存着最近 8 个密文字节的寄存器被加密，结果中的一个字节和下一个明文字节异或。所以每个字节都依赖它前面的 8 个密文字节（密文里错一位，解密出来就会坏掉 9 个字节）。")),
                 svg(drawn(fig_modes), T('Top, CBC: five blocks; each ciphertext block feeds the XOR of the next block; block 4 and the arrow into it from C3 are highlighted, and block 5 is dashed. Bottom, counter mode: five independent columns, IV+i encrypted and XORed with P_i to give C_i; only block 4 is highlighted.',
                                           '上，CBC：五个块；每个密文块都送进下一块的异或；第 4 块以及从 C3 进来的箭头被标出，第 5 块是虚线。下，计数器模式：五列互不相关，IV+i 加密后与 P_i 异或得到 C_i；只有第 4 块被标出。'),
                     T(r"Top: in CBC, block 4 needs $C_3$, and its own $C_4$ feeds block 5, so changing block 4 changes every block after it. Bottom: in counter mode, block 4 needs only the key, the IV and its own number.",
                       r"上：CBC 里，第 4 块需要 $C_3$，它自己的 $C_4$ 又送进第 5 块，所以改动第 4 块，后面的每一块都跟着变。下：计数器模式里，第 4 块只需要密钥、IV 和它自己的编号。")),
                 p(T(r"For random access, this chaining gets in the way. To decrypt a block in the middle, you must also fetch the ciphertext before it (for CFB, the 8 preceding bytes). And to change a block in the middle, you would have to re-encrypt everything after it, because each block feeds the next.",
                     r"对随机访问来说，这种链接碍事了。要解密中间的一块，得把它前面的密文也取来（CFB 是前面 8 个字节）。要改中间的一块，就得把它后面的全部重新加密，因为每一块都喂给下一块。"))),
            read('counter', T('Stream cipher mode and counter mode', '流密码模式和计数器模式'),
                 p(T(r"A different idea: do not run the data through the cipher at all. Encrypt something else to make a **keystream**, and XOR the keystream with the data. XOR with the same keystream again undoes it, so decryption is the same operation as encryption.",
                     r"换个思路：根本不让数据过密码算法。加密另外一样东西，得到一串**密钥流**（keystream），再把密钥流和数据异或。再用同一串密钥流异或一次就还原了，所以解密和加密是同一个操作。")),
                 p(T(r"**Stream cipher mode** makes the keystream by encrypting the IV, then encrypting the result, and so on. The keystream does not depend on the data, but block 1000's piece of it can only be reached by computing the 999 before it.",
                     r"**流密码模式**先加密 IV，再加密得到的结果，如此反复，生成密钥流。密钥流和数据无关，但第 1000 块对应的那段，只有把前面 999 段都算一遍才拿得到。")),
                 p(T(r"**Counter mode** encrypts the IV plus the block's number instead:", r"**计数器模式**加密的是 IV 加上块的编号：")),
                 math_(r'C_i = P_i \oplus E_K(\mathrm{IV} + i)'),
                 p(T(r"Block $i$ depends on nothing but the key, the IV and $i$. To read block 1000, compute $E_K(\mathrm{IV} + 1000)$ and XOR it with $C_{1000}$: one encryption, and no other block touched. To change block 1000, do the same and write it back; nothing else changes.",
                     r"第 $i$ 块只取决于密钥、IV 和 $i$。要读第 1000 块，算出 $E_K(\mathrm{IV} + 1000)$，和 $C_{1000}$ 异或：一次加密，不碰任何别的块。要改第 1000 块，同样算一次再写回去；别的都不用动。")),
                 table([T('Mode', '模式'), T('Block $i$ needs', '第 $i$ 块需要'), T('Read one block', '读一块'), T('Change one block', '改一块'), T('Repeats hidden?', '重复被藏住？')],
                       ['ECB', T('nothing else', '别的都不需要'), T('yes', '能'), T('yes', '能'), T('**no**', '**不能**')],
                       ['CBC', T('the ciphertext block before it', '前一个密文块'), T('with one more block', '多取一块就行'), T('no: all later blocks change', '不行：后面的块全变'), T('yes', '能')],
                       ['CFB', T('the 8 ciphertext bytes before it', '前面 8 个密文字节'), T('with 8 more bytes', '多取 8 个字节就行'), T('no: all later bytes change', '不行：后面的字节全变'), T('yes', '能')],
                       [T('Stream cipher', '流密码'), T('the keystream from the start', '从头算起的密钥流'), T('after computing from the start', '从头算一遍之后'), T('after computing from the start', '从头算一遍之后'), T('yes', '能')],
                       [T('Counter', '计数器'), T('only its number $i$', '只需要编号 $i$'), T('**yes**', '**能**'), T('**yes**', '**能**'), T('yes', '能')]),
                 quiz(T(r"ECB also lets you decrypt block 1000 on its own. Why is counter mode still the better answer?", r"ECB 也能单独解密第 1000 块。为什么答案仍然是计数器模式？"),
                      [(T(r"In ECB identical plaintext blocks give identical ciphertext blocks, which reveals patterns", r"ECB 里相同的明文块得到相同的密文块，会暴露规律"), True),
                       (T(r"ECB cannot decrypt a single block", r"ECB 没法单独解密一块"), T(r"It can: each block is encrypted on its own. The trouble is what that reveals.", r"能：每块都是单独加密的。问题在于这会暴露什么。")),
                       (T(r"ECB is slower", r"ECB 更慢"), T(r"Speed is not the issue; both need one block encryption per block.", r"问题不在速度；两者每块都只需要一次分组加密。"))],
                      T(r"Counter mode keeps ECB's independence of blocks but, because each block's number goes into the cipher, two identical plaintext blocks come out different.", r"计数器模式保留了 ECB 各块独立的好处，但因为每块的编号都进了密码算法，两个相同的明文块加密出来是不一样的。"))),
            read('paper-answer', T('A full-mark answer', '一份满分答案'),
                 ol(T(r"**The choice**: counter mode.", r"**结论**：计数器模式。"),
                    T(r"**The mechanism**: each block is XORed with $E_K(\mathrm{IV} + i)$, which depends only on the block's position, so any block can be encrypted or decrypted on its own.", r"**机制**：每块和 $E_K(\mathrm{IV} + i)$ 异或，它只取决于这一块的位置，所以任何一块都能单独加密或解密。"),
                    T(r"**The contrast**: chained modes (CBC, CFB) make each block depend on the ciphertext before it, so a block in the middle cannot be handled on its own.", r"**对比**：链式模式（CBC、CFB）让每块都依赖它前面的密文，中间的块没法单独处理。")),
                 paper(T('Review (1), Q2 · a full-mark answer', '复习课 (1) 第 2 题 · 满分答案'),
                       T(r"Counter mode is best suited. In counter mode the cipher encrypts the initialisation vector plus the block number, and the result is XORed with the plaintext block, so each block can be encrypted or decrypted on its own, based only on its location in the file, without processing any other block. Chained modes such as cipher block chaining or cipher feedback make each block depend on the ciphertext before it (cipher feedback needs the 8 preceding bytes of ciphertext), so accessing a block in the middle requires other parts of the file, and changing one block would change all the blocks after it. (ECB would allow random access but reveals repeated plaintext blocks.)",
                         r"计数器模式最合适。计数器模式加密的是初始化向量加上块号，再把结果和明文块异或，所以每一块都能只根据它在文件中的位置单独加密或解密，不需要处理任何别的块。密码块链接、密码反馈这类链式模式让每一块都依赖它前面的密文（密码反馈需要前面 8 个字节的密文），访问中间的一块就得用到文件的其他部分，而且改动一块会让它后面的所有块都跟着变。（ECB 虽然也能随机访问，但会暴露重复的明文块。）"),
                       answer=True),
                 p(T(r"The lecturer's answer names the contrast with cipher feedback explicitly. Naming one chained mode and why it fails is what turns *counter mode* into an explanation.", r"老师的答案特意点出了和密码反馈模式的对比。说出一种链式模式以及它为什么不行，才让“计数器模式”成为一个解释。")),
                 chapter=PAPER_CH()),
            read('reuse', T('Never the same keystream twice', '同一串密钥流绝不能用两次'),
                 p(T(r"Counter mode and stream cipher mode share a weakness the course calls the **keystream reuse attack**. If two messages are encrypted with the same key and the same IV, they are XORed with the same keystream $K_0$. An eavesdropper XORs the two ciphertexts, and the keystream cancels out:",
                     r"计数器模式和流密码模式有一个共同的弱点，课上叫它**密钥流重用攻击**（keystream reuse attack）。如果两条消息用同一个密钥、同一个 IV 加密，它们就是和同一串密钥流 $K_0$ 异或的。窃听者把两段密文异或，密钥流就抵消了：")),
                 math_(r'(P_0 \oplus K_0) \oplus (Q_0 \oplus K_0) = P_0 \oplus Q_0'),
                 p(T(r"What is left is the XOR of the two plaintexts. Knowing or guessing either one (a standard header, a common word) reveals the other. So the IV must never repeat under the same key: choose keys and IVs independently and at random, and never reuse a counter value. For an encrypted file that is rewritten, that means a fresh IV when the file is re-encrypted.",
                     r"剩下的是两段明文的异或。知道或猜出其中一段（一个标准文件头、一个常见的词），另一段就暴露了。所以同一个密钥下 IV 绝不能重复：密钥和 IV 要独立、随机地选，计数器的值也绝不能重用。对一个会被重写的加密文件来说，就是重新加密时要换一个新的 IV。")),
                 chapter=WIDER_CH()),
            read('which', T('Which mode for which job', '什么工作用什么模式'),
                 table([T('The job', '要做的事'), T('Mode', '模式'), T('Why', '为什么')],
                       [T('A file read and written at random places', '一个在任意位置读写的文件'), T('counter', '计数器'), T('each block on its own', '每块各自独立')],
                       [T('Keystrokes, encrypted as they are typed', '击键，边敲边加密'), 'CFB', T('works a byte at a time', '一次处理一个字节')],
                       [T('A noisy link, where one bad bit should not spread', '有噪声的链路，错一位不该扩散'), T('stream cipher or counter', '流密码或计数器'), T('a wrong ciphertext bit flips just one plaintext bit', '密文错一位，明文也只错一位')],
                       [T('Encrypting on many processors at once', '在许多处理器上同时加密'), T('counter', '计数器'), T('no block waits for another', '没有哪一块要等别的块')],
                       [T('Anything with repeated blocks', '任何有重复块的数据'), T('anything but ECB', '除了 ECB 都行'), T('ECB shows the repeats', 'ECB 会把重复暴露出来')]),
                 p(T(r"Error spread is a favourite comparison. In CBC a wrong bit in one ciphertext block garbles that whole block and flips one bit in the next; in CFB it spoils 9 bytes; in stream cipher and counter mode it flips only the one matching plaintext bit, because the keystream does not depend on the ciphertext.",
                     r"错误扩散是考题里常比的一项。CBC 里一个密文块错一位，会把这一整块弄乱，并让下一块错一位；CFB 里会坏掉 9 个字节；流密码和计数器模式里只让对应的那一位明文出错，因为密钥流不依赖密文。"))),
            choice('try-keys', T('Your turn: keystrokes', '你来：击键'), M,
                   T(r"A remote terminal encrypts each keystroke the moment it is typed, one byte at a time. Which mode fits best?", r"一个远程终端在每次击键时立即加密，一次一个字节。哪种模式最合适？"),
                   [(T(r"Cipher feedback (CFB)", r"密码反馈（CFB）"), True),
                    (T(r"Cipher block chaining (CBC)", r"密码块链接（CBC）"), T(r"CBC encrypts whole blocks of 16 bytes (AES); it would have to wait for 16 keystrokes before sending anything.", r"CBC 加密的是整块（AES 是 16 字节）；它得等攒够 16 次击键才能发出去。")),
                    (T(r"Electronic code book (ECB)", r"电子密码本（ECB）"), T(r"Also block by block, and it would encrypt the same key the same way every time.", r"同样是一整块一整块地来，而且同一个按键每次都加密成同样的东西。"))],
                   T(r"CFB works byte by byte, so each keystroke can be encrypted and sent at once. The course's slide names exactly this use.", r"CFB 一个字节一个字节地处理，每次击键都能马上加密发出。课件举的正是这个用法。"),
                   chapter=TRY_CH()),
            choice('try-reuse', T('Your turn: the same key and IV twice', '你来：同一个密钥和 IV 用了两次'), K,
                   T(r"Two files are encrypted in counter mode with the same key and the same IV. What can an eavesdropper who has both ciphertexts compute, without the key?", r"两个文件用计数器模式、同一个密钥和同一个 IV 加密。拿到两段密文的窃听者，不用密钥能算出什么？"),
                   [(T(r"The XOR of the two plaintexts", r"两段明文的异或"), True),
                    (T(r"Nothing: without the key the ciphertexts are random", r"什么也算不出：没有密钥，密文就是随机的"), T(r"Each is random on its own, but they were made with the same keystream, which cancels out when the two are XORed.", r"单看每一段是随机的，但它们用的是同一串密钥流，两段一异或，密钥流就抵消了。")),
                    (T(r"The key", r"密钥"), T(r"The key stays hidden; what leaks is the relation between the plaintexts, which is often enough.", r"密钥仍然是安全的；泄露的是两段明文之间的关系，而这往往就够了。"))],
                   T(r"$(P \oplus K) \oplus (Q \oplus K) = P \oplus Q$. With a guess at either file, the other follows.", r"$(P \oplus K) \oplus (Q \oplus K) = P \oplus Q$。猜出其中一个文件，另一个就出来了。")),
            number('try-cfb', T('Your turn: one wrong bit in CFB', '你来：CFB 里错了一位'), M,
                   T(r"In cipher feedback mode with an 8-byte register, one bit of the ciphertext is corrupted. How many bytes of the decrypted text are affected?", r"在使用 8 字节寄存器的密码反馈模式里，密文有一位出错。解密后的文本有几个字节受影响？"),
                   9, T(r"The byte itself, plus the next 8, during which the wrong byte sits in the register: 9.", r"它自己那个字节，再加上后面 8 个——在这期间出错的字节一直待在寄存器里：一共 9 个。"),
                   tolerance=0),
            text_q('try-ecb', T('Your turn: why not ECB', '你来：为什么不用 ECB'), M,
                   T(r"ECB mode allows random access too. Explain why it is still a poor choice for encrypting a large image or database file.", r"ECB 模式也能随机访问。解释为什么用它来加密一个大的图像或数据库文件仍然不好。"),
                   [T('In ECB the same plaintext block always gives the same ciphertext block', 'ECB 里同样的明文块总是得到同样的密文块'),
                    T('Large files contain many repeated blocks, so the patterns stay visible to an eavesdropper', '大文件里有很多重复的块，规律对窃听者仍然可见'),
                    T('An attacker can also swap or replay blocks; counter mode gives random access without this', '攻击者还能调换或重放块；计数器模式能随机访问却没有这个问题')],
                   T(r"In ECB each block is encrypted on its own with the same key, so identical plaintext blocks give identical ciphertext blocks. An image has large areas of the same colour and a database has records with the same fields, so the structure of the data remains visible, and an attacker can swap or replay blocks. Counter mode keeps random access but mixes each block's position into its encryption, so repeated blocks look different.",
                     r"ECB 用同一个密钥单独加密每一块，相同的明文块得到相同的密文块。图像里有大片相同的颜色，数据库里有字段相同的记录，于是数据的结构依然看得出来，攻击者还能调换或重放块。计数器模式保留了随机访问，又把每块的位置混进了它的加密，重复的块看起来就不一样了。"),
                   T(r"Random access is not the only requirement of a good mode: hiding repeats is the reason modes beyond ECB exist.", r"随机访问不是好模式的唯一要求：藏住重复，正是 ECB 之外那些模式存在的理由。")),
        ],
    )


def L_auth():
    B, A, C, D = '3kgkap.public-key-basics', '3kgkap.authentication-protocols', '3kgkap.certificates-pki', '3kgkap.diffie-hellman-mitm'
    return dict(
        id=f'{CID}-exam-auth', title=T('Proving who is on the other end: public-key authentication (R1 · 3)', '证明对面是谁：公钥认证（复1 · 3）'),
        description=T('What public and private keys make possible, why a challenge must be a fresh random number, the seven messages one at a time, and what goes wrong if the directory can be faked.', '公钥和私钥让什么成为可能，为什么挑战必须是新鲜的随机数，七条消息一条一条地看，以及目录被冒充时会出什么事。'),
        minutes=35,
        skills=skills(B, A, C, D),
        misconceptions=[{'id': 'key-is-proof', 'description': T("Thinking that receiving Bob's public key proves Alice is talking to Bob", '以为拿到了 Bob 的公钥，就证明 Alice 在和 Bob 说话')}],
        steps=[
            read('question', T('The question, as printed', '题目原文'),
                 paper(R1(3), T(r"In public-key cryptography authentication as shown below, at what point can Alice be confident that she is communicating with Bob? Briefly explain your answer. [Figure]",
                                r"在下图所示的公钥密码认证中，Alice 到哪一步可以确信她是在和 Bob 通信？简要解释你的答案。[图]")),
                 svg(fig_auth('en', True), T('Three lifelines, Alice, Directory and Bob, and seven numbered messages between them.', '三条生命线 Alice、Directory（目录）和 Bob，以及它们之间七条编了号的消息。'),
                     T(r"The figure on the paper, redrawn.", r"试卷上的图，重画。")),
                 h(T('Reading it slowly', '慢慢读一遍')),
                 ul(T(r"**Alice** and **Bob** want to talk securely. The **Directory** is a trusted server that hands out public keys (in practice, certificates for them).", r"**Alice** 和 **Bob** 想安全地通信。**Directory**（目录）是一台可信的服务器，负责分发公钥（实际中分发的是公钥的证书）。"),
                    T(r"$E_A$ and $E_B$ are Alice's and Bob's **public keys**. $E_B(X)$ means $X$ encrypted with Bob's public key, which only Bob's private key can open.", r"$E_A$ 和 $E_B$ 是 Alice 和 Bob 的**公钥**。$E_B(X)$ 表示用 Bob 的公钥加密的 $X$，只有 Bob 的私钥能打开。"),
                    T(r"$R_A$ and $R_B$ are random numbers chosen by Alice and by Bob for this run of the protocol. $K_S$ is a fresh **session key** for the conversation that follows, and $K_S(X)$ is $X$ encrypted with it.", r"$R_A$ 和 $R_B$ 是 Alice 和 Bob 为这一次协议各自选的随机数。$K_S$ 是给接下来那段对话用的新**会话密钥**，$K_S(X)$ 是用它加密的 $X$。"),
                    T(r"**At what point**: after which message. **Be confident**: nobody but Bob could have produced what she has received.", r"**到哪一步**：哪一条消息之后。**确信**：除了 Bob，没有谁能造出她收到的东西。")),
                 p(T(r"The ideas: what a public and a private key allow; how a challenge and its response prove who someone is, and why the challenge must be fresh; then the seven messages, asking of each one what it proves to Alice.", r"需要的想法：公钥和私钥能做到什么；挑战和应答怎样证明一个人的身份，为什么挑战必须是新的；然后逐条看这七条消息，问每一条向 Alice 证明了什么。")),
                 chapter=Q_CH()),
            read('pk', T('Public keys: anyone can lock, only one can open', '公钥：谁都能锁，只有一个人能开'),
                 p(T(r"In public-key cryptography each person has two keys: a **public key** $E$, which anyone may know, and a **private key** $D$, known only to its owner, with $D(E(P)) = P$. Anyone can encrypt a message for Bob with $E_B$; only Bob, who holds $D_B$, can decrypt it. Think of a padlock that anyone can snap shut, but only Bob has the key for.",
                     r"在公钥密码里，每个人有两把钥匙：一把**公钥** $E$，谁都可以知道；一把**私钥** $D$，只有主人自己知道，并且 $D(E(P)) = P$。谁都可以用 $E_B$ 给 Bob 加密一条消息；只有握着 $D_B$ 的 Bob 能解开。就像一把谁都能按上的挂锁，钥匙却只在 Bob 手里。")),
                 p(T(r"That gives a test for whether someone is Bob: lock up a number with $E_B$, and see whether the other side can tell you what it was. Only Bob can.", r"这就有了一个检验对方是不是 Bob 的办法：用 $E_B$ 锁住一个数，看对方能不能告诉你它是多少。只有 Bob 能。")),
                 chapter=IDEAS_CH()),
            read('nonce', T('Challenge and response: why the number must be fresh', '挑战与应答：为什么这个数必须是新的'),
                 p(T(r"**Authentication** means verifying that the partner you are talking to is who it claims to be. The usual pattern: one side sends a **challenge** that only the real partner can answer, and checks the **response**.",
                     r"**认证**（authentication）就是核实和你通信的一方确实是它自称的那个人。常见的做法：一方发出一个只有真正的对方才答得上的**挑战**（challenge），再检查对方的**应答**（response）。")),
                 p(T(r"The challenge must be a **nonce**: a random number used only once. Suppose Alice reused an old challenge. An intruder, Trudy, who had recorded an earlier run could simply replay Bob's old answer, without being able to decrypt anything. A fresh random $R_A$, chosen by Alice a moment ago, has never been answered before; so an answer containing it was made *now*, by someone who could read the challenge.",
                     r"挑战必须是一个**一次性随机数**（nonce）。假设 Alice 用了一个旧的挑战。录下了以前某次过程的入侵者 Trudy，什么都不用解密，只要把 Bob 当时的回答重放一遍就行。而 Alice 刚刚才选出来的新随机数 $R_A$ 从来没被回答过；所以凡是包含它的回答，都是*此刻*、由能读懂这个挑战的人做出来的。"))),
            read('walk', T('The seven messages, one at a time', '七条消息，一条一条看'),
                 svg(drawn(fig_auth), T('The same seven messages, with messages 3 and 6 highlighted. A mark on Alice\'s lifeline at message 6 reads: Alice is sure, Bob. A mark on Bob\'s lifeline at message 7 reads: Bob is sure, Alice.',
                                          '同样的七条消息，第 3 条和第 6 条被标出。Alice 的生命线在第 6 条处有一个标记：Alice 确认，是 Bob。Bob 的生命线在第 7 条处有一个标记：Bob 确认，是 Alice。'),
                     T(r"Message 3 locks Alice's fresh $R_A$ with Bob's public key; message 6 brings it back. From then on, Alice knows who is on the other end.", r"第 3 条用 Bob 的公钥锁住 Alice 新选的 $R_A$；第 6 条把它带了回来。从这时起，Alice 知道对面是谁了。")),
                 table([T('Message', '消息'), T('What happens', '发生了什么'), T('What it proves to Alice', '向 Alice 证明了什么')],
                       ['1, 2', T("Alice asks the directory for Bob's public key and gets it.", 'Alice 向目录要 Bob 的公钥，拿到了。'), T("nothing about who is talking: anyone can ask the directory for Bob's key", '证明不了对面是谁：谁都能向目录要 Bob 的公钥')],
                       ['3', T('Alice sends her name and a fresh $R_A$, locked with $E_B$.', 'Alice 发出自己的名字和一个新的 $R_A$，用 $E_B$ 锁住。'), T('nothing yet: she sent it. But now only Bob can know $R_A$', '还没有：这是她自己发的。但从此只有 Bob 能知道 $R_A$')],
                       ['4, 5', T("Bob gets Alice's public key from the directory.", 'Bob 从目录拿到 Alice 的公钥。'), T('nothing to Alice', '对 Alice 没有证明什么')],
                       ['6', T('Bob sends $R_A$, his own fresh $R_B$ and a new session key $K_S$, locked with $E_A$.', 'Bob 发回 $R_A$、他自己新选的 $R_B$ 和一个新会话密钥 $K_S$，用 $E_A$ 锁住。'), T('**it is Bob**: only the holder of $D_B$ could have read $R_A$ from message 3, and $R_A$ is new, so this is no replay', '**是 Bob**：只有握着 $D_B$ 的人才能从第 3 条里读出 $R_A$，而 $R_A$ 是新的，所以不是重放')],
                       ['7', T('Alice returns $R_B$, encrypted with $K_S$.', 'Alice 用 $K_S$ 加密，送回 $R_B$。'), T('(to Bob) only Alice could read $R_B$ and $K_S$ in message 6, so now Bob is sure of Alice', '（对 Bob）只有 Alice 能读出第 6 条里的 $R_B$ 和 $K_S$，所以现在 Bob 确认了 Alice')]),
                 quiz(T(r"Why can Alice not be sure after message 2, when the trusted directory hands her Bob's public key?", r"第 2 条消息之后，可信的目录已经把 Bob 的公钥给了 Alice。为什么她还不能确定？"),
                      [(T(r"Having Bob's public key proves nothing about who is on the other end: anyone can ask for it", r"拿到 Bob 的公钥，证明不了对面是谁：谁都能要到它"), True),
                       (T(r"The directory might be Bob in disguise", r"目录可能是 Bob 假扮的"), T(r"The directory is trusted here. The point is that a public key is public.", r"这里目录是可信的。关键在于公钥本来就是公开的。")),
                       (T(r"She can: the directory is trusted", r"她能确定：目录是可信的"), T(r"The directory vouches for the key, not for whoever Alice ends up talking to.", r"目录担保的是这把公钥，而不是 Alice 最后在跟谁说话。"))],
                      T(r"A public key lets Alice *test* Bob (message 3); the test is passed only when the answer comes back (message 6).", r"公钥让 Alice 能*考验* Bob（第 3 条）；要等答案回来（第 6 条），考验才算通过。"))),
            read('paper-answer', T('A full-mark answer', '一份满分答案'),
                 ol(T(r"**The point**: after message 6.", r"**结论**：第 6 条消息之后。"),
                    T(r"**Why only Bob**: in message 3 Alice encrypted $R_A$ with Bob's public key $E_B$, so only Bob, with the matching private key, can extract it.", r"**为什么只能是 Bob**：第 3 条里 Alice 用 Bob 的公钥 $E_B$ 加密了 $R_A$，只有握着对应私钥的 Bob 能取出它。"),
                    T(r"**The evidence**: message 6 brings $R_A$ back to her.", r"**证据**：第 6 条把 $R_A$ 带回给了她。"),
                    T(r"**Why not a replay**: $R_A$ is a fresh random number she chose for this run.", r"**为什么不是重放**：$R_A$ 是她这一次新选的随机数。")),
                 paper(T('Review (1), Q3 · a full-mark answer', '复习课 (1) 第 3 题 · 满分答案'),
                       T(r"Alice can be confident that she is communicating with Bob after message 6. In message 3 she sent her random number $R_A$ encrypted with Bob's public key $E_B$, so only Bob, who holds the matching private key, can extract $R_A$. Message 6 returns $R_A$ to her; since $R_A$ is a fresh random number chosen for this session, the message cannot be a replay of an old one, so it must have come from Bob. (Bob, in turn, can be sure of Alice only after message 7, when she returns $R_B$, which only she could decrypt from message 6.)",
                         r"Alice 在第 6 条消息之后可以确信她在和 Bob 通信。在第 3 条里，她把随机数 $R_A$ 用 Bob 的公钥 $E_B$ 加密后发出，只有持有对应私钥的 Bob 能取出 $R_A$。第 6 条把 $R_A$ 送回给她；由于 $R_A$ 是为这次会话新选的随机数，这条消息不可能是旧消息的重放，所以它一定来自 Bob。（反过来，Bob 要到第 7 条之后才能确信对方是 Alice：她送回了 $R_B$，而只有她能从第 6 条里解密出 $R_B$。）"),
                       answer=True),
                 p(T(r"The lecturer's answer is one sentence: after message 6, because only Bob can extract $R_A$, given that Alice encrypted it with Bob's public key in message 3. Add the freshness of $R_A$, and the answer also rules out a replay.", r"老师的答案就一句话：第 6 条之后，因为 Alice 在第 3 条里用 Bob 的公钥加密了 $R_A$，只有 Bob 能取出它。再加上 $R_A$ 是新的这一点，答案还排除了重放。")),
                 chapter=PAPER_CH()),
            read('directory', T('What if the directory can be faked? Certificates', '目录要是能被冒充呢？证书'),
                 p(T(r"Everything rests on message 2 really containing Bob's key. Suppose Trudy sits between Alice and the directory and answers message 1 with her own public key $E_T$. Alice locks $R_A$ for Trudy; Trudy reads it, forwards the conversation to the real Bob under the real keys, and reads everything that passes: a **man-in-the-middle attack**.",
                     r"一切都建立在第 2 条消息里真的是 Bob 的公钥这个前提上。假设 Trudy 夹在 Alice 和目录之间，用她自己的公钥 $E_T$ 回答第 1 条。Alice 就把 $R_A$ 锁给了 Trudy；Trudy 读出它，再用真正的公钥把对话转给真正的 Bob，中间经过的一切她都看得到：这就是**中间人攻击**（man-in-the-middle attack）。")),
                 p(T(r"The fix is a **certificate**: a document that binds a public key to a name, signed by a **certification authority** (CA) that Alice already trusts (the format is X.509). Trudy can copy a certificate but cannot forge the CA's signature on a false one. CAs certify one another in a hierarchy, the **public key infrastructure** (PKI), so Alice needs to trust only the root.",
                     r"办法是**证书**（certificate）：一份把公钥和名字绑在一起的文件，由 Alice 已经信任的**证书颁发机构**（CA）签名（格式是 X.509）。Trudy 可以复制一份证书，却伪造不了 CA 在假证书上的签名。CA 之间按层级相互认证，构成**公钥基础设施**（PKI），Alice 只需要信任最顶上的那一个。")),
                 p(T(r"The same attack works on an unauthenticated **Diffie-Hellman** key exchange: Trudy runs one exchange with Alice and another with Bob, and holds both keys. That is why keys agreed over the network must be tied to identities, by certificates or a shared secret.",
                     r"同样的攻击也能用在没有认证的 **Diffie-Hellman** 密钥交换上：Trudy 跟 Alice 做一次交换、跟 Bob 再做一次，两把密钥都攥在她手里。所以在网上协商出的密钥，必须通过证书或共享秘密和身份绑在一起。")),
                 chapter=WIDER_CH()),
            read('shared', T('With a shared secret key instead', '换成共享密钥'),
                 p(T(r"If Alice and Bob already share a secret key $K_{AB}$, the same idea works with symmetric encryption: Alice sends her name; Bob sends a fresh challenge $R_B$; Alice returns $K_{AB}(R_B)$, which only someone who knows $K_{AB}$ can produce; then Alice sends her own challenge $R_A$ and Bob returns $K_{AB}(R_A)$. Each side proves it knows the key by encrypting the other's fresh number.",
                     r"如果 Alice 和 Bob 已经共享一把秘密密钥 $K_{AB}$，同样的思路换成对称加密也行：Alice 报上名字；Bob 发一个新的挑战 $R_B$；Alice 回 $K_{AB}(R_B)$，只有知道 $K_{AB}$ 的人才造得出来；然后 Alice 发出自己的挑战 $R_A$，Bob 回 $K_{AB}(R_A)$。双方都靠加密对方的新随机数来证明自己知道这把密钥。")),
                 p(T(r"Two principles from the course run through both protocols: use the long-term keys as little as possible, and **choose a new session key for every connection** (the $K_S$ of message 6). Then a key that leaks exposes one conversation, and the long-term keys are never used on bulk data, where public-key encryption would also be far too slow.",
                     r"课上的两条原则贯穿这两个协议：尽量少用长期密钥，**每次连接都选一把新的会话密钥**（就是第 6 条里的 $K_S$）。这样一把密钥泄露，只会暴露一次对话；长期密钥也从不用来加密大量数据——用公钥加密大量数据也实在太慢。"))),
            choice('try-bob', T("Your turn: Bob's side", '你来：Bob 这边'), A,
                   T(r"In the same protocol, after which message can Bob be confident that he is talking to Alice?", r"在同一个协议里，Bob 到哪一条消息之后可以确信他在和 Alice 说话？"),
                   [(T(r"After message 7", r"第 7 条之后"), True),
                    (T(r"After message 3", r"第 3 条之后"), T(r"Anyone can encrypt the name *Alice* and a number with Bob's public key: message 3 proves nothing about its sender.", r"谁都能用 Bob 的公钥加密“Alice”这个名字和一个数：第 3 条证明不了发送者是谁。"), 'key-is-proof'),
                    (T(r"After message 5", r"第 5 条之后"), T(r"Getting Alice's public key is like Alice getting Bob's: it proves nothing about who is talking.", r"拿到 Alice 的公钥，和 Alice 拿到 Bob 的公钥一样：证明不了对面是谁。"))],
                   T(r"In message 6 Bob locked his fresh $R_B$ with Alice's public key. Message 7 returns it, so it was read by the holder of Alice's private key: Alice.", r"第 6 条里，Bob 用 Alice 的公钥锁住了他新选的 $R_B$。第 7 条把它送了回来，说明读到它的是 Alice 私钥的主人：Alice。"),
                   chapter=TRY_CH()),
            text_q('try-nonce', T('Your turn: why fresh', '你来：为什么要新的'), A,
                   T(r"Why must $R_A$ be a fresh random number, rather than a number Alice reuses in every run?", r"为什么 $R_A$ 必须是新的随机数，而不能是 Alice 每次都重复使用的同一个数？"),
                   [T('If $R_A$ were reused, Trudy could replay a recorded message 6 from an earlier run', '如果 $R_A$ 重复使用，Trudy 可以重放以前录下的第 6 条消息'),
                    T('A replay needs no private key, so it would fool Alice without Bob being there', '重放不需要私钥，所以 Bob 不在场也能骗过 Alice'),
                    T('A fresh, unpredictable $R_A$ means the answer must be made now, by someone who decrypted message 3', '新的、不可预测的 $R_A$ 意味着回答必须是此刻、由解密了第 3 条的人做出的')],
                   T(r"If Alice reused $R_A$, an intruder who recorded an earlier run could replay Bob's old message 6, which contains that same $R_A$, without being able to decrypt anything, and Alice would believe she was talking to Bob. A fresh random $R_A$ has never appeared before, so a message that returns it must have been made now, by someone who could decrypt message 3, that is, by Bob.",
                     r"如果 Alice 重复使用 $R_A$，录下了以前某次过程的入侵者可以把 Bob 当时的第 6 条（里面正是同一个 $R_A$）重放一遍，什么都不用解密，Alice 就会以为自己在和 Bob 说话。新的随机 $R_A$ 以前从没出现过，所以送回它的消息一定是此刻做出来的，做它的人能解密第 3 条，也就是 Bob。"),
                   T(r"Freshness is what turns *someone once knew $R_A$* into *Bob knows $R_A$ now*.", r"“新”这一点，把“曾经有人知道 $R_A$”变成了“Bob 此刻知道 $R_A$”。")),
            choice('try-mitm', T('Your turn: a fake directory', '你来：假冒的目录'), C,
                   T(r"Trudy intercepts message 1 and answers it with her own public key in place of Bob's. What does this allow, and what prevents it?", r"Trudy 截住第 1 条消息，用她自己的公钥冒充 Bob 的公钥回答。这让她能做什么？什么能防住？"),
                   [(T(r"She can read $R_A$ and pose as Bob in the middle; a certificate signed by a trusted CA prevents it", r"她能读出 $R_A$，在中间冒充 Bob；由可信 CA 签名的证书能防住"), True),
                    (T(r"Nothing: Bob's reply in message 6 would expose her", r"什么也做不了：第 6 条 Bob 的回复会揭穿她"), T(r"Alice's message 3 goes to Trudy, who answers message 6 herself with the right $R_A$: Alice sees nothing wrong.", r"Alice 的第 3 条会到 Trudy 手里，Trudy 自己带着正确的 $R_A$ 回复第 6 条：Alice 看不出任何问题。")),
                    (T(r"She can learn Bob's private key", r"她能得到 Bob 的私钥"), T(r"Private keys never travel. She does not need Bob's: Alice is using hers.", r"私钥从不在网上传。她也不需要 Bob 的私钥：Alice 用的是她的公钥。"))],
                   T(r"Authentication with public keys is only as good as the binding between key and name: certificates and the PKI provide it.", r"用公钥做认证，可靠程度取决于公钥和名字之间的绑定：证书和 PKI 提供的正是这个。")),
        ],
    )


def L_drill():
    D = 'it-exam.drill'
    return dict(
        id=f'{CID}-exam-drill', title=T('Every answer pattern on one page, and a drill', '所有答题套路一页纸，再加一组练习'),
        description=T('What each kind of question needs in its answer and the slip that loses the mark, then ten quick questions to do under time.', '每类题的答案里必须有什么、丢分的常见错，再做十道限时小题。'),
        minutes=25,
        skills=[{'id': D, 'name': T('The sample questions, all together', '所有样题合在一起')}],
        steps=[
            read('sheet', T('The answer patterns', '答题套路'),
                 p(T(r"Everything this unit taught, one row per kind of question, for reviewing what you have already understood. If a row does not make sense, go back to its lesson rather than memorising it.",
                     r"这一单元讲过的东西，一类题一行，用来复习你已经弄懂的内容。哪一行看不明白，就回到对应的那一课，而不是硬背。")),
                 table([T('Question', '题型'), T('The answer must contain', '答案里必须有'), T('The slip', '常见的错')],
                       [T('Contention or collision-free', '竞争还是无冲突'), T('high load: collision-free (no collisions, overhead shared by many frames); low load: contention (sends at once)', '高负载：无冲突（不冲突，开销由很多帧分摊）；低负载：竞争（马上就发）'), T('the choice without the mechanism', '只有结论没有机制')],
                       [T('Limited contention', '有限竞争'), T('the tree walk probes groups depth first: contention at light load, one station per slot at heavy load', '树遍历深度优先地探查各组：负载轻时像竞争，负载重时每个时隙一个站'), T('probing groups in the wrong order', '探查顺序弄错')],
                       [T('Hidden and exposed terminals', '隐藏终端和暴露终端'), T('collisions matter at the receiver; RTS from the sender, CTS from the receiver; hear the CTS, stay quiet', '冲突要看接收方；发送方发 RTS，接收方回 CTS；听到 CTS 就保持安静'), T('relying on carrier sense at the sender', '指望发送方的载波侦听')],
                       [T('Reaching a process', '找到一个进程'), T('the IP address (the host) and the port the destination socket is bound to (the process)', 'IP 地址（找主机）和目的套接字绑定的端口（找进程）'), T('the IP address alone', '只写 IP 地址')],
                       [T('UDP or TCP for RPC', 'RPC 用 UDP 还是 TCP'), T('idempotent: UDP (a retry is harmless; saves the handshake and the connection state); not idempotent: TCP (duplicates discarded, exactly once)', '幂等：UDP（重试无害；省握手和连接状态）；不幂等：TCP（丢弃重复，恰好一次）'), T('*UDP is fast, TCP is reliable*, with no idempotence', '只写“UDP 快、TCP 可靠”，不提幂等')],
                       [T('Tahoe timeout', 'Tahoe 超时'), T('threshold = half the window at the loss; window back to 1; double each RTT up to the threshold; then +1 per RTT', '阈值 = 丢包时窗口的一半；窗口回到 1；每个 RTT 翻倍到阈值；之后每个 RTT 加 1'), T('using the old threshold; doubling past the threshold', '用了旧阈值；过了阈值还在翻倍')],
                       [T('Reno', 'Reno'), T('three duplicate ACKs: threshold = half, window = threshold, then +1 per RTT; a timeout: as Tahoe', '三个重复确认：阈值减半，窗口 = 阈值，之后每个 RTT 加 1；超时：和 Tahoe 一样'), T('treating a timeout like duplicate ACKs', '把超时当成重复确认来处理')],
                       [T('No DNS', '没有 DNS'), T('names cannot be resolved; IP and TCP still work; only by typing addresses, impractical for most users; email stops too', '名字无法解析；IP 和 TCP 照常工作；只能输入地址访问，对大多数人不现实；邮件也停了'), T('*the Internet stops*', '“互联网停了”')],
                       [T('Persistent HTTP', '持久 HTTP'), T('one TCP connection for many objects: fewer handshakes, less overhead, higher throughput (pipelining); challenge: when to close (too long wastes resources, too soon loses the benefit)', '一条 TCP 连接运送多个对象：握手少、开销小、吞吐量高（流水线）；难点：什么时候关（太久浪费资源，太早失去好处）'), T('only one side of the closing trade-off', '关连接的取舍只说了一面')],
                       [T('Counting RTTs', '数 RTT'), T('non-persistent: 2 per object; persistent: 1 + 1 per object; pipelined: 1 + 1 + 1', '非持久：每个对象 2 个；持久：1 + 每个对象 1 个；流水线：1 + 1 + 1'), T('forgetting the handshake', '忘了握手')],
                       ['SMTP', T('+ simple, text-based: easy to read, debug, implement; − several round trips per email (or 7-bit ASCII, so MIME is needed)', '+ 简单、基于文本：容易读、调试、实现；− 每封邮件好几个往返（或：只有 7 位 ASCII，需要 MIME）'), T('a property without saying why it helps or hurts', '只说特性，不说为什么好或不好')],
                       [T('Lossy compression', '有损压缩'), T('decoded data approximates the original; perceptual encoding drops what people do not notice; a small loss buys a large compression ratio', '解码结果是原数据的近似；感知编码扔掉人察觉不到的部分；一点损失换来很大的压缩比'), T('*lower quality*, without *approximation*', '只写“质量更低”，不写“近似”')],
                       [T('Cipher mode for random access', '随机访问用哪种密码模式'), T('counter: each block from $E_K(\\mathrm{IV} + i)$ alone; chained modes need the ciphertext before (CFB: 8 bytes); ECB leaks repeats', '计数器：每块只靠 $E_K(\\mathrm{IV} + i)$；链式模式需要前面的密文（CFB：8 个字节）；ECB 暴露重复'), T('choosing ECB', '选了 ECB')],
                       [T('Public-key authentication', '公钥认证'), T('Alice: after message 6 ($R_A$ back; only Bob could decrypt message 3; fresh, so no replay); Bob: after message 7', 'Alice：第 6 条之后（$R_A$ 回来了；只有 Bob 能解密第 3 条；是新的，所以不是重放）；Bob：第 7 条之后'), T('after message 2 or 3', '写成第 2 或第 3 条之后')]),
                 chapter=T('Answer patterns', '答题套路')),
            choice('d1', T('Light load', '负载轻'), D, T(r"A LAN is lightly loaded. Which kind of MAC protocol wastes less of the channel?", r"一个局域网负载很轻。哪类 MAC 协议浪费的信道更少？"),
                   [(T('Contention', '竞争协议'), True), (T('Collision-free', '无冲突协议'), T(r"Its reservations are paid every round, even when almost nobody sends.", r"它每轮都要付预约开销，哪怕几乎没人发。"))],
                   T(r"Collisions are rare, so sending at once costs nothing; reservations would be pure overhead.", r"冲突很少，马上就发几乎没有代价；预约纯属开销。"), chapter=T('Drill', '练习')),
            choice('d2', T('A process on another host', '另一台主机上的进程'), D, T(r"What does a client name to connect to a server process?", r"客户端要连接一个服务器进程，需要指明什么？"),
                   [(T(r"The server's IP address and the port its socket is bound to", r"服务器的 IP 地址，以及它的套接字绑定的端口"), True),
                    (T(r"The server's IP address", r"服务器的 IP 地址"), T(r"That reaches the host; the port picks the process.", r"这只能到达主机；端口才能选中进程。")),
                    (T(r"The server's MAC address and the port", r"服务器的 MAC 地址和端口"), T(r"A MAC address only matters on one link; across the Internet, hosts are named by IP address.", r"MAC 地址只在一条链路上有意义；跨越互联网，主机靠 IP 地址来指明。"))],
                   T(r"IP address for the host, port for the process.", r"IP 地址找主机，端口找进程。")),
            choice('d3', T('A transfer over RPC', '用 RPC 转账'), D, T(r"`transfer(100, from_account, to_account)` is called by RPC. UDP or TCP?", r"用 RPC 调用 `transfer(100, from_account, to_account)`。UDP 还是 TCP？"),
                   [(T(r"TCP: it is not idempotent", r"TCP：它不是幂等的"), True),
                    (T(r"UDP: it is a small request", r"UDP：它只是一个小请求"), T(r"Small, but a retry after a lost reply would transfer the money twice.", r"是小，但回复丢了之后再重试，钱就转了两次。"))],
                   T(r"Running it twice moves 200; TCP's duplicate detection delivers the request exactly once.", r"执行两次就转了 200；TCP 的去重保证请求恰好送达一次。")),
            number('d4', T('A new threshold', '新的阈值'), D, T(r"TCP Tahoe, 1 KB segments. A timeout occurs when the window is 8 KB. What is the new slow start threshold, in KB?", r"TCP Tahoe，每个报文段 1 KB。窗口为 8 KB 时发生超时。新的慢启动阈值是多少 KB？"),
                   4, T(r"$8 / 2 = 4$ KB.", r"$8 / 2 = 4$ KB。"), tolerance=0, unit='KB', purpose='check'),
            number('d5', T('Four round trips later', '四个往返之后'), D, T(r"The same connection: the window is reset to 1 and no loss follows. What is the window after the 4th round trip, in KB?", r"同一条连接：窗口重置为 1，之后不再丢包。第 4 个往返后窗口是多少 KB？"),
                   6, T(r"2, 4 (the threshold is reached), then 5, 6.", r"2、4（到达阈值），然后 5、6。"), tolerance=0, unit='KB', purpose='check'),
            number('d6', T('Round trips of a page', '一个页面的往返'), D, T(r"A base HTML file and 3 images on one server, one persistent connection, no pipelining. How many RTTs, leaving out transmission time?", r"一台服务器上一个基础 HTML 文件和 3 张图片，一条持久连接，不用流水线。不计传输时间，要几个 RTT？"),
                   5, T(r"One handshake, then one round trip for each of the 4 objects: $1 + 4 = 5$.", r"握手一个，然后 4 个对象各一个往返：$1 + 4 = 5$。"), tolerance=0, purpose='check'),
            choice('d7', T('No DNS', '没有 DNS'), D, T(r"Every DNS server has crashed. Which still works?", r"所有 DNS 服务器都崩溃了。哪个还能用？"),
                   [(T(r"Connecting to a server by typing its IP address", r"输入服务器的 IP 地址来连接它"), True),
                    (T(r"Opening www.unimelb.edu.au for the first time", r"第一次打开 www.unimelb.edu.au"), T(r"A name that has to be looked up cannot be resolved.", r"要查询的名字解析不了。")),
                    (T(r"Emailing a friend at another domain", r"给另一个域的朋友发邮件"), T(r"Finding the friend's mail server needs DNS.", r"找朋友的邮件服务器需要 DNS。"))],
                   T(r"Routing and TCP work by address; only the translation from names is gone.", r"路由和 TCP 按地址工作；没了的只是从名字到地址的翻译。")),
            choice('d8', T('Lossless or lossy', '无损还是有损'), D, T(r"Which file must be compressed losslessly?", r"哪个文件必须用无损压缩？"),
                   [(T(r"A spreadsheet of exam marks", r"一张考试成绩的电子表格"), True),
                    (T(r"A recorded lecture video", r"一段录好的讲课视频"), T(r"Perceptual encoding suits video: nobody notices what it drops.", r"视频适合感知编码：没人会注意到扔掉的部分。")),
                    (T(r"A podcast", r"一期播客"), T(r"Lossy audio, as in MP3, is the usual choice.", r"有损音频（比如 MP3）是常规选择。"))],
                   T(r"A changed digit in a spreadsheet is an error; a dropped masked sound is not noticed.", r"表格里改了一个数字就是错误；扔掉一个被掩盖的声音，没人会察觉。")),
            choice('d9', T('A database file', '一个数据库文件'), D, T(r"A database file is encrypted and read and written at random places. Which mode?", r"一个数据库文件被加密，会在任意位置读写。用哪种模式？"),
                   [(T('Counter mode', '计数器模式'), True),
                    (T('Cipher block chaining', '密码块链接'), T(r"Changing one block would change every block after it.", r"改一块，后面的块全都要变。")),
                    (T('Electronic code book', '电子密码本'), T(r"Random access, but identical records show as identical ciphertext.", r"能随机访问，但相同的记录会变成相同的密文。"))],
                   T(r"Each block from $E_K(\mathrm{IV} + i)$ alone: read or rewrite any block on its own.", r"每块只靠 $E_K(\mathrm{IV} + i)$：任何一块都能单独读写。")),
            choice('d10', T("Bob's certainty", 'Bob 的确认'), D, T(r"In the seven-message protocol, which message convinces Bob that he is talking to Alice?", r"在那个七条消息的协议里，哪一条让 Bob 确信他在和 Alice 说话？"),
                   [(T('Message 7', '第 7 条'), True), (T('Message 3', '第 3 条'), T(r"Anyone can send Alice's name encrypted with Bob's public key.", r"谁都能用 Bob 的公钥加密 Alice 的名字发过来。")), (T('Message 6', '第 6 条'), T(r"Message 6 is Bob's own; it convinces Alice.", r"第 6 条是 Bob 自己发的；它让 Alice 确信。"))],
                   T(r"Message 7 returns $R_B$, which only the holder of Alice's private key could read from message 6.", r"第 7 条送回了 $R_B$，只有 Alice 私钥的主人才能从第 6 条里读出它。")),
        ],
    )


LESSONS = [L_start, L_mac, L_transport, L_tahoe, L_web, L_mail, L_cipher, L_auth, L_drill]
UNIT = T('Final exam: the sample questions, explained', '期末复习：样题精讲')


def build():
    from practice import PRACTICE_LESSONS, PRACTICE_UNIT  # imported here: they draw with this file's helpers
    from hard import HARD_LESSONS, HARD_UNIT
    out_dir = os.path.join(DEMO, CID)
    units = []
    entries = []
    for title, makers in ((UNIT, LESSONS), (PRACTICE_UNIT, PRACTICE_LESSONS), (HARD_UNIT, HARD_LESSONS)):
        ids = []
        for make in makers:
            L = make()
            lesson = {'id': L['id'], 'mode': 'essay', 'title': L['title'], 'description': L['description'], 'minutes': L['minutes'],
                      'skills': L['skills'], 'misconceptions': L.get('misconceptions', []), 'steps': L['steps']}
            with open(os.path.join(out_dir, f'{L["id"]}.json'), 'w', encoding='utf8') as f:
                json.dump(lesson, f, ensure_ascii=False, separators=(',', ':'))
            entries.append({'id': L['id'], 'title': L['title'], 'summary': L['description'], 'minutes': L['minutes'],
                            'meta': {'title': L['title'], 'mode': 'essay', 'langs': ['en', 'zh'], 'has_scene': False,
                                     'kinds': sorted({s['kind'] for s in L['steps']}), 'skills': L['skills']}})
            ids.append(L['id'])
        units.append({'title': title, 'lessons': ids})
    path = os.path.join(DEMO, 'courses.json')
    with open(path, encoding='utf8') as f:
        courses = json.load(f)
    course = next(c for c in courses if c['id'] == CID)
    drop = set(OLD) | {e['id'] for e in entries}
    # the generated units stay; the exam units (the last ones) are replaced
    course['units'] = [u for u in course['units'] if not set(u['lessons']) & drop] + units
    course['lessons'] = [l for l in course['lessons'] if l['id'] not in drop] + entries
    course['packs'] = ['it']
    course['origin']['note'] = T('Generated from 20 lecture decks; the final-exam units written by an AI (Claude) from the sample questions of the two review lectures, the practice exam and the slides\' worked examples · not edited by a person',
                                 '根据 20 份课件生成；期末复习单元由 AI（Claude）根据两节复习课的样题、模拟卷和课件中的例题编写 · 未经人工修改')
    with open(path, 'w', encoding='utf8') as f:
        json.dump(courses, f, ensure_ascii=False, indent=1)
    print(f'{len(entries)} lessons -> {out_dir}; the course now has {len(course["lessons"])} lessons in {len(course["units"])} units')


if __name__ == '__main__':
    build()
