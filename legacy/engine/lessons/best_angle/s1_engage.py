"""Engage + Explore: the real-world hook, the slider exploration, the bridge to circles."""
from common import *  # noqa: F401,F403


def fact_row(icon, text):
    slot = Rectangle(width=0.5, height=0.42, stroke_opacity=0, fill_opacity=0)
    icon.move_to(slot)
    return VGroup(VGroup(slot, icon), label(text, 26, INK, weight="MEDIUM")).arrange(RIGHT, buff=0.22)


class S01_Hook(LessonScene):
    def construct(self):
        pitch = make_pitch()
        title = label("The best angle to shoot", 46, weight="SEMIBOLD").move_to(RIGHT * 3.75 + UP * 3.05)

        self.play(FadeIn(pitch.grass), run_time=0.8)
        self.play(Create(pitch.lines), FadeIn(pitch.net), run_time=1.0)
        self.play(Create(pitch.mouth), GrowFromCenter(pitch.post_a), GrowFromCenter(pitch.post_b),
                  FadeIn(title, shift=UP * 0.2), run_time=0.9)

        d = ValueTracker(29.0)
        token = always_redraw(lambda: player_token(pitch.p(0, d.get_value())))
        with self.say("A winger is sprinting toward the goal line.") as t:
            self.play(FadeIn(token, scale=0.5), Create(pitch.path), run_time=1.0)
            self.play(d.animate.set_value(23), run_time=max(t.duration - 1.0, 0.5), rate_func=smooth)

        y_dim = -1.15
        dim9 = dimension(pitch.p(0, y_dim), pitch.p(NEAR, y_dim), "9 m", color=INK, buff=0.08, font_size=24)
        dim7 = dimension(pitch.p(NEAR, y_dim), pitch.p(FAR, y_dim), "7 m", color=GOLD, buff=0.08, font_size=24)
        mouth_icon = Line(LEFT * 0.22, RIGHT * 0.22, color=GOLD, stroke_width=6)
        run_icon = DashedLine(UP * 0.2, DOWN * 0.2, dash_length=0.07, color=INK, stroke_width=3)
        wedge_icon = wedge(ORIGIN, RIGHT * 0.5 + UP * 0.12, RIGHT * 0.5 + UP * 0.42, radius=0.42, opacity=0.5).shift(LEFT * 0.2)
        rows = VGroup(
            fact_row(mouth_icon, "The goal is 7 m wide"),
            fact_row(run_icon, "Her run: 9 m from the near post"),
            fact_row(wedge_icon, "θ = her shooting angle"),
        ).arrange(DOWN, buff=0.38, aligned_edge=LEFT).move_to(RIGHT * 3.75 + UP * 1.35)

        with self.say("Her run is a straight line, 9 meters from the near post, and the goal is 7 meters wide.") as t:
            self.play(Create(dim9), FadeIn(rows[1], shift=LEFT * 0.2), run_time=t.duration * 0.45)
            self.play(Create(dim7), FadeIn(rows[0], shift=LEFT * 0.2), run_time=t.duration * 0.4)

        cone = always_redraw(lambda: view_cone(pitch, d.get_value(), number=False))
        big = always_redraw(lambda: T(r"\theta", "=", f"{pitch.theta(d.get_value()):.1f}^\\circ", font_size=64,
                                      c0=TEAL, c2=TEAL).move_to(RIGHT * 3.75 + DOWN * 0.55))
        with self.say("From way out here, the goal looks narrow. It fills only a thin slice of her view: this angle, θ.") as t:
            self.remove(token)
            self.play(FadeIn(cone), run_time=1.0)
            self.play(FadeIn(rows[2], shift=LEFT * 0.2), FadeIn(big), run_time=1.0)

        with self.say("As she runs in, the angle opens up.") as t:
            self.play(d.animate.set_value(14), run_time=t.duration, rate_func=smooth)

        with self.say("But get too close, and it narrows again. Right on the goal line, she can't see into the goal at all.") as t:
            self.play(d.animate.set_value(0.0), run_time=t.duration * 0.9, rate_func=smooth)

        q = panel(VGroup(
            chip("PREDICT", GOLD, 22),
            label("Where on her run is θ largest?", 30, INK, weight="SEMIBOLD"),
        ).arrange(DOWN, buff=0.22), buff=0.3).move_to(RIGHT * 3.75 + DOWN * 2.35)
        with self.say("So somewhere in between, the goal looks as wide as it possibly can. Where is that sweet spot?") as t:
            self.play(d.animate.set_value(18), run_time=t.duration * 0.55, rate_func=smooth)
            self.play(FadeIn(q, shift=UP * 0.2), run_time=0.8)
        self.wait(0.6)

        self.hotspot(pitch.mouth, "goal", "The goal mouth: 7 m between the posts")
        self.hotspot(big, "theta", "θ: the angle between her lines of sight to the two posts")


class S02_Explore(LessonScene):
    """Silent scrub video. Slider value d maps linearly to video time."""

    def construct(self):
        pitch = make_pitch()
        graph = AngleGraph(pitch)
        d = ValueTracker(0.0)
        self.add(pitch, pitch.path, graph)

        def trace():
            v = d.get_value()
            return graph.curve(0.02, v) if v > 0.1 else VMobject()

        def drop():
            v = d.get_value()
            if v < 0.1:
                return VMobject()
            return DashedLine(graph.ax.c2p(v, 0), graph.point(v), dash_length=0.06, color=TEAL,
                              stroke_width=1.5).set_stroke(opacity=0.6)

        self.add(
            always_redraw(trace),
            always_redraw(drop),
            always_redraw(lambda: view_cone(pitch, d.get_value(), number=False)),
            always_redraw(lambda: glow_dot(graph.point(d.get_value()), TEAL, r=0.07)),
            always_redraw(lambda: readout(d.get_value(), pitch.theta(d.get_value())).move_to(RIGHT * 3.75 + UP * 3.25)),
        )
        self.param(name="d", min=0, max=30, unit="m", label="Distance from the goal line")
        self.play(d.animate.set_value(30), run_time=12, rate_func=linear)
        self.wait(1 / 30)


class S03_Bridge(LessonScene):
    def construct(self):
        pitch = make_pitch()
        graph = AngleGraph(pitch)
        full = graph.curve(0.02, 30)
        cone = view_cone(pitch, BEST, number=False)
        dot = glow_dot(graph.point(BEST), TEAL, r=0.07)
        ro = readout(BEST, pitch.theta(BEST)).move_to(RIGHT * 3.75 + UP * 3.25)
        self.add(pitch, pitch.path, graph, full, cone, dot, ro)

        peak_lines = VGroup(
            DashedLine(graph.ax.c2p(BEST, 0), graph.point(BEST), dash_length=0.06, color=TEAL, stroke_width=1.5),
            DashedLine(graph.ax.c2p(0, pitch.theta(BEST)), graph.point(BEST), dash_length=0.06, color=TEAL, stroke_width=1.5),
        )
        with self.say("Dragging finds the peak: about 12 meters out, where the angle tops out near 16.3°.") as t:
            self.play(Create(peak_lines), run_time=1.2)
            self.play(Indicate(dot, color=TEAL, scale_factor=1.6), Indicate(ro, color=TEAL, scale_factor=1.08), run_time=1.4)

        # "Move the goal and we'd have to measure again."
        alt = Pitch(**PITCH_KW, posts=(12.0, 20.0))
        alt_curve = DashedVMobject(graph.ax.plot(lambda v: alt.theta(v), x_range=[0.05, 30, 0.05]),
                                   num_dashes=60).set_color(GOLD)
        alt_peak = np.sqrt(12 * 20)
        qmark = T("?", font_size=48, color=GOLD).next_to(graph.ax.c2p(alt_peak, alt.theta(alt_peak)), UP, buff=0.15)
        ghost_mouth = alt.mouth.copy().set_stroke(opacity=0.9)
        ghost_posts = VGroup(alt.post_a.copy(), alt.post_b.copy())
        with self.say("But why 12? Move the goal, or change her run, and we would have to measure all over again.") as t:
            self.play(FadeOut(cone), FadeOut(peak_lines), run_time=0.5)
            self.play(TransformFromCopy(pitch.mouth, ghost_mouth), TransformFromCopy(VGroup(pitch.post_a, pitch.post_b), ghost_posts),
                      Create(alt_curve), run_time=t.duration * 0.5)
            self.play(FadeIn(qmark, scale=1.5), run_time=0.6)

        with self.say("Mathematicians want to see why. And the key is a surprisingly simple fact about circles.") as t:
            self.play(FadeOut(VGroup(ghost_mouth, ghost_posts, alt_curve, qmark, graph, full, dot, ro)),
                      pitch.grass.animate.set_opacity(0.25), pitch.lines.animate.set_stroke(opacity=0.15),
                      pitch.net.animate.set_opacity(0.1), run_time=1.2)
            P_ = pitch.p(0, BEST)
            circ = pitch.circle_through_posts(BEST, BLUE, width=4)
            tri = VGroup(Line(P_, pitch.A(), color=TEAL, stroke_width=3), Line(P_, pitch.B(), color=TEAL, stroke_width=3),
                         wedge(P_, pitch.A(), pitch.B(), radius=0.8, opacity=0.45), player_token(P_))
            self.play(FadeIn(tri), run_time=0.6)
            self.play(Create(circ), run_time=t.duration * 0.45)
            labs = VGroup(
                point_label("A", pitch.A(), UP + LEFT * 0.4, color=GOLD, font_size=34),
                point_label("B", pitch.B(), UP + RIGHT * 0.4, color=GOLD, font_size=34),
                point_label("P", P_, LEFT, color=INK, font_size=34).shift(RIGHT * 0.05),
            )
            self.play(FadeIn(labs), run_time=0.6)
        self.wait(0.4)
