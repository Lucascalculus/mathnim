# The drawing helpers of the COMP90049 lessons (README.md here), taken from the COMP90007 build: Fig draws one
# language of an SVG, drawn() makes the { en, zh } pair. lid() names a lesson of this course.
#   from ml_kit import *     (after lesson_kit, which it re-exports)
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))
from lesson_kit import *  # noqa: E402,F403  (T, the block and step helpers, the colours, Plot)

CID = 'comp90049'
LINE = '#c9ccd1'
SOFT = '#f4f5f7'


def lid(slug):
    return f'{CID}-{slug}'


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
