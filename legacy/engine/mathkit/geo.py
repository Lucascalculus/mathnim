"""Geometry building blocks: angle wedges, tick marks, labelled points."""
from __future__ import annotations

from functools import lru_cache

import numpy as np
from manim import (
    DOWN, LEFT, ORIGIN, RIGHT, UP, Arc, Circle, Dot, Line, Polygon, Sector, Text, VGroup, VMobject,
)

from .tex import Tex
from .theme import BG, FONT, INK, MUTED, PANEL, PANEL_EDGE, TEAL


def P(x, y):
    return np.array([x, y, 0.0])


def unit(v):
    n = np.linalg.norm(v)
    return v / n if n > 1e-9 else v


def heading(v):
    return float(np.arctan2(v[1], v[0]))


def angle_at(vertex, p1, p2) -> float:
    """Unsigned angle p1-vertex-p2 in radians."""
    a = unit(np.asarray(p1) - vertex)
    b = unit(np.asarray(p2) - vertex)
    return float(np.arccos(np.clip(np.dot(a, b), -1, 1)))


def deg(x: float) -> float:
    return float(np.degrees(x))


def on_circle(center, r, degrees):
    t = np.radians(degrees)
    return np.asarray(center) + r * np.array([np.cos(t), np.sin(t), 0.0])


@lru_cache(maxsize=4096)
def _tex_cached(parts: tuple, font_size: float, color: str):
    return Tex(*parts, font_size=font_size, color=color)


def T(*parts, font_size=40, color=INK, **colors) -> Tex:
    """Memoised Tex. Keyword args colour parts by index: T('a','=','b', c0=GOLD)."""
    mob = _tex_cached(tuple(parts), float(font_size), str(color)).copy()
    for k, col in colors.items():
        mob[int(k[1:])].set_fill(col)
    return mob


def label(text, font_size=28, color=INK, weight="MEDIUM", **kw) -> Text:
    return Text(text, font=FONT, font_size=font_size, color=color, weight=weight, **kw)


def wedge(vertex, p1, p2, radius=0.5, color=TEAL, opacity=0.32, stroke=3.0, reflex=False) -> VGroup:
    """Filled angle sector with an outline arc from ray v->p1 to ray v->p2."""
    vertex = np.asarray(vertex)
    a1 = heading(np.asarray(p1) - vertex)
    a2 = heading(np.asarray(p2) - vertex)
    d = (a2 - a1 + np.pi) % (2 * np.pi) - np.pi
    if reflex:
        d = d - np.sign(d) * 2 * np.pi
    sector = Sector(radius=radius, start_angle=a1, angle=d, arc_center=vertex,
                    fill_color=color, fill_opacity=opacity, stroke_width=0)
    arc = Arc(radius=radius, start_angle=a1, angle=d, arc_center=vertex,
              color=color, stroke_width=stroke)
    return VGroup(sector, arc)


def bisector_point(vertex, p1, p2, dist, reflex=False):
    vertex = np.asarray(vertex)
    d = unit(unit(np.asarray(p1) - vertex) + unit(np.asarray(p2) - vertex))
    if reflex:
        d = -d
    return vertex + d * dist


def angle_tag(vertex, p1, p2, mob, dist=0.8, reflex=False):
    return mob.move_to(bisector_point(vertex, p1, p2, dist, reflex))


def ticks(p, q, n=1, color=INK, size=0.13, gap=0.07, width=3.0) -> VGroup:
    p, q = np.asarray(p), np.asarray(q)
    m = (p + q) / 2
    d = unit(q - p)
    nrm = np.array([-d[1], d[0], 0])
    g = VGroup()
    for i in range(n):
        off = (i - (n - 1) / 2) * gap
        c = m + d * off
        g.add(Line(c - nrm * size / 2, c + nrm * size / 2, color=color, stroke_width=width))
    return g


def right_angle(vertex, p1, p2, size=0.22, color=INK, width=2.5) -> VMobject:
    v = np.asarray(vertex)
    a = unit(np.asarray(p1) - v) * size
    b = unit(np.asarray(p2) - v) * size
    return VMobject(color=color, stroke_width=width).set_points_as_corners([v + a, v + a + b, v + b])


def glow_dot(point, color=INK, r=0.075, glow=True) -> VGroup:
    g = VGroup()
    if glow:
        for k, op in ((4.2, 0.07), (2.8, 0.12), (1.8, 0.2)):
            g.add(Dot(point, radius=r * k, color=color, fill_opacity=op, stroke_width=0))
    g.add(Dot(point, radius=r, color=color, stroke_width=0))
    return g


def point_label(name, point, direction=UP, buff=0.2, color=INK, font_size=38) -> Tex:
    t = T(name, font_size=font_size, color=color)
    return t.move_to(np.asarray(point) + unit(np.asarray(direction, dtype=float)) * (buff + 0.12))


def panel(mob, buff=0.28, corner=0.16, opacity=0.92) -> VGroup:
    from manim import RoundedRectangle
    box = RoundedRectangle(
        width=mob.width + 2 * buff, height=mob.height + 2 * buff, corner_radius=corner,
        fill_color=PANEL, fill_opacity=opacity, stroke_color=PANEL_EDGE, stroke_width=1.5,
    ).move_to(mob)
    return VGroup(box, mob)


def chip(text, color, font_size=24) -> VGroup:
    from manim import RoundedRectangle
    t = label(text, font_size=font_size, color=color, weight="SEMIBOLD")
    box = RoundedRectangle(width=t.width + 0.36, height=t.height + 0.22, corner_radius=(t.height + 0.22) / 2,
                           fill_color=color, fill_opacity=0.14, stroke_color=color, stroke_width=1.2).move_to(t)
    return VGroup(box, t)
