// "The best angle to shoot" - a complete Mathnim lesson.
// Engage (predict) -> explore (drag) -> explain (circles) -> generalise
// (formula, new numbers), with remediation for the common wrong ideas.
import {
  Create, DashedLine, FadeIn, FadeOut, MathTex, Scene, Text, TransformMatchingTex, ValueTracker, VGroup, Write, always_redraw,
  Dot, Line, Indicate, LEFT, UP, DOWN, mul,
} from 'manim-web';
import type { Lesson, LessonContext } from '@mathnim/core';
import { AngleGraph, FAR, NEAR, Pitch, best, circle_through_posts, fit, readout, theta } from './figures';
import { C } from './theme';

const T = (s: string, size = 30, color = C.ink) => MathTex(s, { font_size: size, color });
const say = (s: string, size = 26, color = C.ink) => Text(s, { font_size: size, color, font: 'sans-serif' });

// ---------------------------------------------------------------- scenes
/** A winger runs in; the goal first opens up, then closes again. */
class Hook extends Scene {
  override construct() {
    const pitch = new Pitch();
    const d = ValueTracker(29);
    const cone = always_redraw(() => pitch.cone(d.get_value()));
    const title = say('Where should she shoot from?', 34).move_to([3.4, 3.55, 0]);
    this.play(FadeIn(pitch.grass), Create(pitch.lines), FadeIn(pitch.net), { run_time: 1 });
    this.play(Create(pitch.run), FadeIn(pitch.posts), Write(title));
    this.add(cone, readout(d));
    this.play(d.animate.set_value(12), { run_time: 3 });
    this.play(d.animate.set_value(1.2), { run_time: 3 });
    this.wait(0.5);
  }
}

/** The whole curve: angle against distance, with the peak marked. */
class Reveal extends Scene {
  override construct() {
    const pitch = new Pitch();
    const graph = new AngleGraph();
    const d = ValueTracker(29);
    this.add(pitch, graph);
    const cone = always_redraw(() => pitch.cone(d.get_value()));
    const dot = always_redraw(() => Dot(graph.point(d.get_value()), { radius: 0.07, color: C.accent }));
    const trace = always_redraw(() => graph.curve(Math.max(d.get_value(), 0.06), 29.9));
    this.add(trace, cone, dot);
    this.play(d.animate.set_value(0.06), { run_time: 5, rate_func: (t: number) => t });
    const peak = graph.point(best());
    const guide = VGroup(
      DashedLine(graph.ax.c2p(best(), 0), peak, { color: C.muted, stroke_width: 2 }),
      DashedLine(graph.ax.c2p(0, theta(best())), peak, { color: C.muted, stroke_width: 2 }),
    );
    const lab = T(`d = 12\\,\\text{m},\\ \\theta \\approx ${theta(best()).toFixed(1)}^\\circ`, 28, C.accent).next_to(peak, UP, { buff: 0.25 });
    this.play(d.animate.set_value(best()), Create(guide), FadeIn(lab, { shift: mul(0.2, UP) }), { run_time: 1.5 });
    this.play(Indicate(lab, { color: C.accent }));
    this.wait(0.5);
  }
}

/** Live figure for the drag exploration. */
function exploreScene(ctx: LessonContext) {
  class Explore extends Scene {
    d = ValueTracker(26);
    pitch = new Pitch();
    override construct() {
      const { pitch, d } = this;
      const graph = new AngleGraph();
      const curve = graph.curve(0.06, 29.9, C.faint, 3);
      this.add(pitch, graph, curve, readout(d));
      this.add(always_redraw(() => pitch.cone(d.get_value())));
      this.add(always_redraw(() => Dot(graph.point(d.get_value()), { radius: 0.08, color: C.accent })));
      this.add(always_redraw(() => DashedLine(graph.ax.c2p(d.get_value(), 0), graph.point(d.get_value()), { color: C.accent, stroke_width: 2 })));
      this.wait(0.1);
    }
  }
  void ctx;
  return new Explore();
}

/** Why 12? Circles through both posts: the one that just touches the run line. */
class Circles extends Scene {
  override construct() {
    const pitch = new Pitch();
    this.add(pitch);
    const note = (s: string) => fit(say(s, 26), 6).move_to([3.5, 2.6, 0]);
    let caption = note('Every point on this circle sees the goal at the same angle.');
    const cx = (NEAR + FAR) / 2, cy = 14, r = Math.hypot(cx - NEAR, cy);
    const big = circle_through_posts(pitch, cy, C.muted);
    this.play(Create(big), FadeIn(caption));
    const onBig = (deg: number) => pitch.p(cx + r * Math.cos((deg * Math.PI) / 180), cy + r * Math.sin((deg * Math.PI) / 180));
    const cones = [120, 160, 200].map((t) => {
      const P = onBig(t);
      return VGroup(Line(P, pitch.A(), { color: C.muted, stroke_width: 2 }), Line(P, pitch.B(), { color: C.muted, stroke_width: 2 }), Dot(P, { radius: 0.06, color: C.ink }));
    });
    this.play(...cones.map((c) => Create(c)), { run_time: 1.5 });
    this.wait(0.5);
    const next = note('A smaller circle sees it at a bigger angle...');
    this.play(FadeOut(VGroup(...cones)), FadeOut(caption), FadeIn(next));
    caption = next;
    const small = circle_through_posts(pitch, 8, C.coral);
    this.play(Create(small));
    const last = note('...but this one misses her run. The best circle just touches it.');
    this.play(FadeOut(caption), FadeIn(last));
    const touching = circle_through_posts(pitch, best(), C.accent);
    this.play(Create(touching), { run_time: 1.5 });
    this.play(FadeIn(pitch.cone(best())));
    const where = T('d = 12\\,\\text{m}', 40, C.accent).move_to([3.5, 1.4, 0]);
    this.play(Write(where));
    this.wait(0.8);
  }
}

/** From the touching circle to d = sqrt(ab). */
class Formula extends Scene {
  override construct() {
    const pitch = new Pitch();
    this.add(pitch, circle_through_posts(pitch, best(), C.accent), pitch.cone(best()));
    const lines = [
      T('d^2 = a \\cdot b', 44),
      T('d^2 = 9 \\cdot 16', 44),
      T('d = \\sqrt{9 \\cdot 16} = 12', 44),
    ];
    const hint = fit(say('tangent length² = product of the two distances', 24, C.muted), 6).move_to([3.5, 1.6, 0]);
    lines.forEach((l) => l.move_to([3.5, 0.4, 0]));
    this.play(FadeIn(hint), Write(lines[0]));
    this.wait(0.8);
    this.next_section(); // (a section per beat, §, of the narration: the picture waits there for the voice)
    this.play(TransformMatchingTex(lines[0], lines[1]));
    this.wait(0.6);
    this.play(TransformMatchingTex(lines[1], lines[2]));
    const general = T('d_{\\text{best}} = \\sqrt{a\\,b}', 52, C.accent).move_to([3.5, -1.3, 0]);
    this.play(Write(general));
    this.wait(1);
  }
}

/** Remediation: right on the goal line the angle is zero. */
class TooClose extends Scene {
  override construct() {
    const pitch = new Pitch();
    const d = ValueTracker(6);
    this.add(pitch, readout(d), always_redraw(() => pitch.cone(Math.max(d.get_value(), 0.05))));
    const note = fit(say('On the goal line both posts are straight ahead, so the angle is 0°.', 26), 6).move_to([3.5, 1.2, 0]);
    this.next_section();
    this.play(d.animate.set_value(0.05), { run_time: 2.5 });
    this.play(FadeIn(note));
    this.wait(1);
  }
}
/** Remediation: the middle of 9 and 16 (12.5) is not the best point. */
class NotTheAverage extends Scene {
  override construct() {
    const graph = new AngleGraph();
    this.add(graph, graph.curve());
    const p1 = Dot(graph.point(12.5), { color: C.coral }), p2 = Dot(graph.point(12), { color: C.accent });
    const l1 = T(`\\theta(12.5) = ${theta(12.5).toFixed(2)}^\\circ`, 34, C.coral).move_to([-3.6, 1.4, 0]);
    const l2 = T(`\\theta(12) = ${theta(12).toFixed(2)}^\\circ`, 34, C.accent).move_to([-3.6, 0.5, 0]);
    const why = VGroup(
      say('The best distance is the geometric mean', 24),
      T('\\sqrt{9 \\cdot 16} = 12', 34, C.accent),
      say('not the average', 24, C.muted),
      T('\\tfrac{9+16}{2} = 12.5', 34, C.coral),
    ).arrange(DOWN, { buff: 0.18 }).move_to([-3.6, -1.1, 0]);
    this.play(FadeIn(p1), Write(l1));
    this.next_section();
    this.play(FadeIn(p2), Write(l2));
    this.play(FadeIn(why));
    this.wait(1);
  }
}

/** Question figure: pitch + empty axes (for the sketch prediction). */
function sketchFigure() {
  class SketchFig extends Scene {
    graph = new AngleGraph();
    override construct() {
      this.add(new Pitch(), this.graph);
      this.wait(0.1);
    }
  }
  return new SketchFig();
}
/** Question figure for a new pair of posts. */
function variantFigure(ctx: LessonContext) {
  class Variant extends Scene {
    override construct() {
      const pitch = new Pitch({ a: ctx.vars.a, b: ctx.vars.b });
      this.add(pitch, pitch.cone(Math.max(3, best(ctx.vars.a, ctx.vars.b) * 1.6)));
      this.wait(0.1);
    }
  }
  return new Variant();
}

// ---------------------------------------------------------------- lesson
export const lesson: Lesson = {
  id: 'best-angle',
  title: 'The best angle to shoot',
  description: 'A winger runs parallel to the touchline. Where is the goal widest in her view - and why?',
  skills: [
    { id: 'angle-reasoning', name: 'Reason about viewing angles' },
    { id: 'inscribed-angle', name: 'Inscribed angle theorem', prerequisites: ['angle-reasoning'] },
    { id: 'geometric-mean', name: 'Best distance $d=\\sqrt{ab}$', prerequisites: ['inscribed-angle'] },
  ],
  misconceptions: [
    { id: 'closer-better', description: 'Closer to the goal line always means a wider view.', remediation: 'too-close' },
    { id: 'far-wide', description: 'Far away you can see "more" of the goal.' },
    { id: 'constant', description: 'The goal is the same size, so the angle never changes.' },
    { id: 'average', description: 'The best spot is halfway between the posts\' distances (the average).', remediation: 'not-average' },
  ],
  steps: [
    { id: 'hook', kind: 'scene', chapter: 'The question', scene: Hook, narration: 'She runs straight in, 9 m from the near post. The goal is 7 m wide. Watch the angle θ.' },
    {
      id: 'predict-where', kind: 'checkpoint', skill: 'angle-reasoning', purpose: 'predict', confidence: true,
      prompt: 'Along her run, where is the shooting angle $\\theta$ **largest**?', reveal: 'reveal',
      question: {
        type: 'choice', options: [
          { id: 'close', label: 'As close to the goal line as possible', misconception: 'closer-better', feedback: 'Very close, the posts line up in front of her - look at the last frame.' },
          { id: 'middle', label: 'Somewhere in between', correct: true },
          { id: 'far', label: 'As far out as possible', misconception: 'far-wide' },
          { id: 'same', label: 'It is the same everywhere', misconception: 'constant' },
        ],
      },
    },
    {
      id: 'predict-graph', kind: 'checkpoint', skill: 'angle-reasoning', purpose: 'predict', scene: sketchFigure,
      prompt: 'Sketch how $\\theta$ changes with her distance $d$ from the goal line.',
      question: { type: 'sketch', f: (x) => theta(Math.max(x, 0.01)), x_range: [0.5, 29.5], y_range: [0, 20], axes: (s: any) => s.graph.ax },
    },
    { id: 'reveal', kind: 'scene', scene: Reveal, branch_only: true, narration: 'The angle rises, peaks near 12 m at about 16.3°, then falls to zero on the goal line.' },
    {
      id: 'explore', kind: 'explore', chapter: 'Explore', scene: exploreScene,
      prompt: 'Move the player along her run to find the distance with the **largest** angle.',
      setup: (scene: any, ui) => {
        ui.add_handle({
          tracker: scene.d, label: 'the player',
          from_value: (v) => scene.pitch.p(0, v), to_value: (p) => Math.min(29.5, Math.max(0.2, scene.pitch.d_of(p))),
          radius: 0.5, step: 0.25,
        });
      },
      goal: { check: (scene: any) => theta(scene.d.get_value()) > theta(best()) - 0.1, message: 'You found the peak: about 12 m, θ ≈ 16.3°' },
      solve: (scene: any) => scene.d.set_value(best()),
    },
    {
      id: 'best-d', kind: 'checkpoint', skill: 'angle-reasoning', purpose: 'check',
      prompt: 'To the nearest metre, how far from the goal line is the best spot?',
      question: {
        type: 'number', answer: 12, tolerance: 0.5, unit: 'm',
        wrong: [{ answer: 12.5, misconception: 'average', feedback: '12.5 is the average of 9 and 16 - close, but not the peak.' }],
      },
      hints: ['Use what you saw when dragging: where did the readout stop increasing?', 'It is a little less than halfway between 9 and 16.'],
    },
    { id: 'circles', kind: 'scene', chapter: 'Why?', scene: Circles, narration: 'Points on one circle through both posts all see the goal at the same angle. Smaller circle, bigger angle.' },
    {
      id: 'why-tangent', kind: 'checkpoint', skill: 'inscribed-angle', purpose: 'check',
      prompt: 'Why is the best spot where the circle **just touches** her run?',
      question: {
        type: 'choice', shuffle: true, options: [
          { id: 'smallest', label: 'It is the smallest circle through both posts that still reaches her run - smaller circle, bigger angle.', correct: true },
          { id: 'center', label: 'Because the circle\'s centre is on her run.', feedback: 'The centre is at x = 12.5, not on her run (x = 0).' },
          { id: 'biggest', label: 'It is the biggest circle, so it sees the most goal.', feedback: 'Bigger circles see the goal at a smaller angle.' },
        ],
      },
      hints: ['Compare the angle from a big circle and from a small one.'],
    },
    { id: 'formula', kind: 'scene', chapter: 'The formula', scene: Formula, narration: 'For a tangent from her run: d² = a·b. § So d = √(9·16) = 12.' },
    {
      id: 'general', kind: 'checkpoint', skill: 'geometric-mean', purpose: 'check',
      prompt: 'Posts at distances $a$ and $b$ from her run. Write the best distance $d$.',
      question: {
        type: 'expression', answer: 'sqrt(a*b)', variables: ['a', 'b'], ranges: { a: [1, 10], b: [11, 20] },
        wrong: [
          { answer: '(a+b)/2', misconception: 'average', feedback: 'That is the average of a and b.' },
          { answer: 'b-a', feedback: 'That is the width of the goal.' },
        ],
      },
      hints: ['Start from $d^2 = a \\cdot b$.', 'Take the square root of both sides.'],
    },
    {
      id: 'variant', kind: 'checkpoint', skill: 'geometric-mean', purpose: 'check', scene: variantFigure,
      params: (rng) => {
        const pairs = [[4, 9], [8, 18], [5, 20], [3, 12], [6, 24], [2, 18]];
        const [a, b] = pairs[Math.floor(rng() * pairs.length)];
        return { a, b };
      },
      prompt: 'New pitch: the posts are {a} m and {b} m from her run. What is the best distance, in metres?',
      question: {
        type: 'number', answer: (v) => Math.sqrt(v.a * v.b), tolerance: 0.05, unit: 'm',
        wrong: [{ answer: (v) => (v.a + v.b) / 2, misconception: 'average', feedback: 'That is the average of {a} and {b}.' }],
      },
      hints: ['$d = \\sqrt{a\\,b}$', '$\\sqrt{ {a} \\cdot {b} }$'],
    },
    // remediation detours (only reached by branching)
    { id: 'too-close', kind: 'scene', scene: TooClose, branch_only: true, narration: 'Closer is not always better: § on the goal line the angle shrinks to nothing.' },
    { id: 'not-average', kind: 'scene', scene: NotTheAverage, branch_only: true, narration: 'The average 12.5 m § gives a slightly smaller angle than 12 m.' },
  ],
};
