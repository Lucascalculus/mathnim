"""Shared figures for the 'best angle to shoot' lesson.

Every scene that shows the pitch uses the same placement, and every circle
scene uses the same circle, so the student never has to re-orient between
segments (reduces extraneous load).
"""
from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))

import numpy as np  # noqa: E402
from manim import *  # noqa: E402,F401,F403
from mathkit import *  # noqa: E402,F401,F403

# ---------------------------------------------------------------- pitch
PITCH_KW = dict(origin=(-6.17, 3.075), scale=0.21)
NEAR, FAR = 9.0, 16.0
BEST = 12.0


def make_pitch(**kw):
    return Pitch(**{**PITCH_KW, **kw})


def player_token(point, color=INK):
    return VGroup(
        Dot(point, radius=0.24, color=color, fill_opacity=0.12, stroke_width=0),
        Dot(point, radius=0.115, color=color, stroke_color=BG, stroke_width=2.5),
    )


def view_cone(pitch: Pitch, d: float, arc_r=0.8, number=True, token=True, font_size=30,
              color=TEAL, cone_opacity=0.17):
    P_ = pitch.p(0, d)
    A_, B_ = pitch.A(), pitch.B()
    g = VGroup()
    g.add(Polygon(P_, A_, B_, fill_color=color, fill_opacity=cone_opacity, stroke_width=0))
    g.add(Line(P_, A_, color=color, stroke_width=2.5), Line(P_, B_, color=color, stroke_width=2.5))
    if d > 0.4:
        g.add(wedge(P_, A_, B_, radius=arc_r, color=color, opacity=0.45))
    if number:
        lab = T(f"{pitch.theta(d):.1f}^\\circ", font_size=font_size, color=color)
        lab.next_to(P_, DR, buff=0.12).shift(RIGHT * 0.12)
        g.add(lab)
    if token:
        g.add(player_token(P_))
    return g


def dimension(p, q, text, side=UP, color=MUTED, buff=0.18, font_size=28):
    """Engineering-style dimension line between p and q with a label."""
    p, q = np.asarray(p), np.asarray(q)
    d = unit(q - p)
    n = np.array([-d[1], d[0], 0])
    g = VGroup(
        Line(p, q, color=color, stroke_width=2),
        Line(p - n * 0.1, p + n * 0.1, color=color, stroke_width=2),
        Line(q - n * 0.1, q + n * 0.1, color=color, stroke_width=2),
    )
    lab = label(text, font_size=font_size, color=color) if isinstance(text, str) else text
    lab.next_to(g[0], side, buff=buff)
    g.add(lab)
    return g


class AngleGraph(VGroup):
    """theta(d) for the pitch, on the right half of the frame."""

    def __init__(self, pitch: Pitch, center=RIGHT * 3.75 + DOWN * 0.35, **kwargs):
        super().__init__(**kwargs)
        self.pitch = pitch
        ax = Axes(
            x_range=[0, 30, 5], y_range=[0, 20, 5], x_length=5.6, y_length=4.4, tips=False,
            axis_config={"color": MUTED, "stroke_width": 2, "include_numbers": False, "tick_size": 0.06},
        ).move_to(center)
        self.ax = ax
        nums = VGroup()
        for x in range(0, 31, 5):
            nums.add(T(str(x), font_size=24, color=MUTED).next_to(ax.c2p(x, 0), DOWN, buff=0.16))
        for y in (5, 10, 15, 20):
            nums.add(T(f"{y}^\\circ", font_size=24, color=MUTED).next_to(ax.c2p(0, y), LEFT, buff=0.14))
        xl = label("distance from goal line, d (m)", 22, MUTED).next_to(ax.x_axis, DOWN, buff=0.55)
        yl = VGroup(T(r"\theta", font_size=32, color=TEAL), label("shooting angle", 22, MUTED)).arrange(RIGHT, buff=0.14)
        yl.next_to(ax.c2p(0, 20), UP, buff=0.22).align_to(ax, LEFT).shift(LEFT * 0.35)
        grid = VGroup(*[
            DashedLine(ax.c2p(0, y), ax.c2p(30, y), dash_length=0.05, color=FAINT, stroke_width=1)
            for y in (5, 10, 15, 20)
        ])
        self.frame_parts = VGroup(grid, ax, nums, xl, yl)
        self.add(self.frame_parts)

    def curve(self, d0=0.02, d1=30, color=TEAL, width=4):
        return self.ax.plot(lambda d: self.pitch.theta(d), x_range=[d0, max(d1, d0 + 0.01), 0.05],
                            color=color, stroke_width=width)

    def point(self, d):
        return self.ax.c2p(d, self.pitch.theta(d))


def readout(d: float, th: float, font_size=34):
    a = T("d", "=", f"{d:.1f}", r"\,\text{m}", font_size=font_size)
    b = T(r"\theta", "=", f"{th:.1f}^\\circ", font_size=font_size, c0=TEAL, c2=TEAL)
    return VGroup(a, b).arrange(RIGHT, buff=0.6)


# ---------------------------------------------------------------- circle
O_C = np.array([-2.9, -0.15, 0.0])
R_C = 2.75
A_DEG, B_DEG = 230.0, 310.0  # chord AB at the bottom; central angle 80, inscribed 40


def cpt(deg_):
    return on_circle(O_C, R_C, deg_)


def base_circle():
    return Circle(radius=R_C, color=BLUE, stroke_width=3.5).move_to(O_C)


def chord_ab():
    return Line(cpt(A_DEG), cpt(B_DEG), color=GOLD, stroke_width=5)


def minor_arc(width=9, color=GOLD):
    return Arc(radius=R_C, start_angle=np.radians(A_DEG), angle=np.radians(B_DEG - A_DEG),
               arc_center=O_C, color=color, stroke_width=width)


def major_arc(width=9, color=TEAL):
    return Arc(radius=R_C, start_angle=np.radians(B_DEG), angle=np.radians(360 - (B_DEG - A_DEG)),
               arc_center=O_C, color=color, stroke_width=width)


def ab_labels(font_size=38):
    return VGroup(
        point_label("A", cpt(A_DEG), cpt(A_DEG) - O_C, font_size=font_size, color=GOLD),
        point_label("B", cpt(B_DEG), cpt(B_DEG) - O_C, font_size=font_size, color=GOLD),
    )


def ab_dots():
    return VGroup(Dot(cpt(A_DEG), radius=0.08, color=GOLD), Dot(cpt(B_DEG), radius=0.08, color=GOLD))


def inscribed(p_deg, radius=0.62, number=False, font_size=30):
    P_ = cpt(p_deg)
    A_, B_ = cpt(A_DEG), cpt(B_DEG)
    g = VGroup(
        Line(P_, A_, color=TEAL, stroke_width=3), Line(P_, B_, color=TEAL, stroke_width=3),
        wedge(P_, A_, B_, radius=radius, color=TEAL, opacity=0.4),
    )
    if number:
        g.add(T(f"{deg(angle_at(P_, A_, B_)):.1f}^\\circ", font_size=font_size, color=TEAL)
              .move_to(bisector_point(P_, A_, B_, radius + 0.5)))
    g.add(Dot(P_, radius=0.08, color=INK))
    return g


def central(radius=0.5, reflex=False, color=CORAL):
    A_, B_ = cpt(A_DEG), cpt(B_DEG)
    return VGroup(
        Line(O_C, A_, color=color, stroke_width=3), Line(O_C, B_, color=color, stroke_width=3),
        wedge(O_C, A_, B_, radius=radius, color=color, opacity=0.4, reflex=reflex),
    )


def eq_column(*rows, buff=0.42, x=3.55, top=2.2):
    g = VGroup(*rows).arrange(DOWN, buff=buff, aligned_edge=LEFT)
    g.move_to(RIGHT * x).to_edge(UP, buff=4 - top)
    return g
