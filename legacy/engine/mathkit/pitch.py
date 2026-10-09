"""A top-down football pitch in real metres.

Pitch coordinates: x runs along the goal line (m), y is the distance from
the goal line into the field (m). The winger's run is the line x = 0.
"""
from __future__ import annotations

import numpy as np
from manim import (
    Arc, Circle, DashedLine, Dot, Line, Polygon, Rectangle, VGroup, VMobject,
)

from .theme import FAINT, GOLD, INK, PITCH_A, PITCH_B, PITCH_LINE


class Pitch(VGroup):
    def __init__(
        self,
        origin=(-6.17, 3.075),
        scale=0.21,
        x_range=(-3.0, 27.0),
        y_range=(-2.5, 30.0),
        posts=(9.0, 16.0),
        stripe=4.0,
        markings=True,
        **kwargs,
    ):
        super().__init__(**kwargs)
        self.origin = np.array([origin[0], origin[1], 0.0])
        self.s = scale
        self.xr, self.yr = x_range, y_range
        self.a, self.b = posts

        x0, x1 = x_range
        y0, y1 = y_range
        # grass stripes, parallel to the goal line
        grass = VGroup()
        y = 0.0
        k = 0
        while y < y1:
            h = min(stripe, y1 - y)
            grass.add(self.rect(x0, y, x1, y + h, PITCH_A if k % 2 == 0 else PITCH_B))
            y += h
            k += 1
        behind = self.rect(x0, y0, x1, 0, PITCH_A).set_fill(opacity=0.55)
        self.grass = VGroup(behind, grass)

        lw = 2.2
        lines = VGroup()
        lines.add(self.seg((x0, 0), (x1, 0), PITCH_LINE, lw * 1.3))  # goal line
        if markings:
            six_l, six_r = self.a - 5.5, self.b + 5.5
            lines.add(self.poly([(six_l, 0), (six_l, 5.5), (six_r, 5.5), (six_r, 0)], PITCH_LINE, lw))
            lines.add(self.seg((x0, 16.5), (x1, 16.5), PITCH_LINE, lw))  # penalty box edge (sides off-view)
            spot = ((self.a + self.b) / 2, 11.0)
            lines.add(Dot(self.p(*spot), radius=0.045, color=PITCH_LINE, fill_opacity=0.7))
            # penalty arc: the part of the 9.15 m circle outside the box
            t0 = np.arcsin((16.5 - 11) / 9.15)
            arc = VMobject(stroke_color=PITCH_LINE, stroke_width=lw)
            ts = np.linspace(t0, np.pi - t0, 40)
            arc.set_points_smoothly([self.p(spot[0] + 9.15 * np.cos(t), spot[1] + 9.15 * np.sin(t)) for t in ts])
            lines.add(arc)
        lines.set_stroke(opacity=0.5)
        self.lines = lines

        # goal net behind the goal line
        depth = 2.0
        net = VGroup()
        net.add(self.rect(self.a, -depth, self.b, 0, INK).set_fill(opacity=0.06).set_stroke(INK, 1.2, 0.5))
        for i in range(1, 14):
            xx = self.a + (self.b - self.a) * i / 14
            net.add(self.seg((xx, -depth), (xx, 0), INK, 0.8).set_stroke(opacity=0.22))
        for j in range(1, 4):
            yy = -depth * j / 4
            net.add(self.seg((self.a, yy), (self.b, yy), INK, 0.8).set_stroke(opacity=0.22))
        self.net = net

        self.post_a = Dot(self.p(self.a, 0), radius=0.085, color=GOLD)
        self.post_b = Dot(self.p(self.b, 0), radius=0.085, color=GOLD)
        self.mouth = self.seg((self.a, 0), (self.b, 0), GOLD, 5)

        self.path = DashedLine(self.p(0, 0), self.p(0, y1), dash_length=0.12, dashed_ratio=0.55,
                               color=INK, stroke_width=2.2).set_stroke(opacity=0.55)

        self.add(self.grass, self.lines, self.net, self.mouth, self.post_a, self.post_b)

    # coordinate helpers -------------------------------------------------
    def p(self, x, y):
        return self.origin + np.array([x * self.s, -y * self.s, 0.0])

    def A(self):
        return self.p(self.a, 0)

    def B(self):
        return self.p(self.b, 0)

    def rect(self, x0, y0, x1, y1, color):
        return Polygon(self.p(x0, y0), self.p(x1, y0), self.p(x1, y1), self.p(x0, y1),
                       fill_color=color, fill_opacity=1, stroke_width=0)

    def seg(self, a, b, color, width):
        return Line(self.p(*a), self.p(*b), color=color, stroke_width=width)

    def poly(self, pts, color, width):
        return VMobject(stroke_color=color, stroke_width=width).set_points_as_corners([self.p(*q) for q in pts])

    def circle_through_posts(self, k, color, width=3.0):
        """Circle through both posts with centre ((a+b)/2, k)."""
        cx = (self.a + self.b) / 2
        r = np.hypot(cx - self.a, k)
        return Circle(radius=r * self.s, color=color, stroke_width=width).move_to(self.p(cx, k))

    def theta(self, d: float) -> float:
        """Shooting angle in degrees from (0, d)."""
        if d <= 0:
            return 0.0
        return float(np.degrees(np.arctan(self.b / d) - np.arctan(self.a / d)))


def best_distance(a: float, b: float) -> float:
    return float(np.sqrt(a * b))
