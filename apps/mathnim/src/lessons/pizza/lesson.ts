// "The pizza deal": why a circle's area is πr² (about 15 minutes).
// Design: docs/lessons/pizza-circle-area.md
import {
  Axes, BraceBetweenPoints, Circle, Create, DecimalNumber, FadeIn, FadeOut, Indicate, LaggedStart, Line, Polygon, Rectangle, Scene,
  Square, ValueTracker, VGroup, Write, always_redraw, Dot, DOWN, LEFT, RIGHT, UP, mul,
} from 'manim-web';
import { Slider } from 'manim-web/ext/widgets';
import type { Lesson, LessonContext } from '@mathnim/core';
import { C } from '../best-angle/theme';
import { COL_X, FIG, P, T, bounds, fit, grid, offer, pizza, radius_square, rearranged_width, say, slices } from './figures';

const SCALE = 0.2; // scene units per inch for the pizza-deal scenes

/** Let the scene run until at least `seconds` (the length of its spoken narration + a breath). */
function hold(scene: Scene, seconds: number): void {
  const left = seconds - scene.time;
  if (left > 0.05) scene.wait(left);
}

// ---------------------------------------------------------------- 1. the deal
class Deal extends Scene {
  override construct() {
    const q = say('Same price. Which is more pizza?', 34).move_to([0, 3.3, 0]);
    const left = offer('One 16-inch pizza', [{ r: 1.45, at: [0, -0.1, 0] }], '$16', [-3.25, -0.35, 0]);
    const right = offer('Two 8-inch pizzas', [{ r: 0.725, at: [-1.15, -0.1, 0] }, { r: 0.725, at: [1.15, -0.1, 0] }], '$16', [3.25, -0.35, 0]);
    this.play(FadeIn(left, { shift: mul(0.3, UP) }), { run_time: 1 });
    this.play(FadeIn(right, { shift: mul(0.3, UP) }), { run_time: 1 });
    this.play(Write(q));
    this.wait(1.5);
    hold(this, 8.9);
  }
}

// ---------------------------------------------------------------- 3. measuring a circle
const R = 1.8;
class Measure extends Scene {
  override construct() {
    const c = FIG;
    const pz = pizza(R, c, { toppings: false });
    const radius = Line(c, [c[0] + R, c[1], 0], { color: C.accent, stroke_width: 5 });
    const rl = T('r', 40, C.accent).next_to(radius, DOWN, { buff: 0.12 });
    const sq = radius_square(R, c);
    const l1 = fit(say('A radius-square has side r,', 28), 6).move_to([COL_X, 1.4, 0]);
    const l2 = fit(say('so its area is', 28), 6).move_to([COL_X, 0.8, 0]);
    const l3 = T('r \\times r = r^2', 48, C.accent).move_to([COL_X, 0, 0]);
    const l4 = fit(say('How many of them make the whole circle?', 28, C.muted), 6).move_to([COL_X, -1.3, 0]);
    this.play(FadeIn(pz));
    this.play(Create(radius), Write(rl));
    this.play(Create(sq), FadeIn(l1), FadeIn(l2));
    this.play(Write(l3));
    this.wait(0.6);
    this.play(FadeIn(l4));
    this.wait(1);
    hold(this, 9.6);
  }
}

// ---------------------------------------------------------------- 5. between 2 and 4
class Bounds extends Scene {
  override construct() {
    const c = FIG;
    const circle = Circle({ radius: R, stroke_color: P.crust, stroke_width: 6, fill_color: P.cheese, fill_opacity: 0.85 }).move_to(c);
    const { outer, inner } = bounds(R, c);
    const quad = VGroup(...[[0, 0], [-1, 0], [-1, -1], [0, -1]].map(([dx, dy]) => radius_square(R, [c[0] + dx * R, c[1] + dy * R, 0], C.coral)));
    const t1 = T('\\text{outside square} = 4\\,r^2', 36, C.coral).move_to([COL_X, 1.7, 0]);
    const t2 = T('\\text{inside diamond} = 2\\,r^2', 36, C.good).move_to([COL_X, 0.8, 0]);
    const t3 = T('2\\,r^2 < \\text{circle} < 4\\,r^2', 40).move_to([COL_X, -0.3, 0]);
    const t4 = T('\\text{circle} \\approx 3.14\\,r^2', 48, C.accent).move_to([COL_X, -1.5, 0]);
    this.add(circle);
    this.play(Create(outer), LaggedStart(...quad.submobjects.map((m: any) => FadeIn(m)), { lag_ratio: 0.2 }), { run_time: 1.5 });
    this.play(Write(t1));
    this.play(FadeOut(quad), Create(inner));
    this.play(Write(t2));
    this.play(Write(t3));
    this.wait(0.5);
    this.play(Write(t4));
    this.play(Indicate(t4, { color: C.accent }));
    this.wait(1);
    hold(this, 10.7);
  }
}

// ---------------------------------------------------------------- 6. slice the pizza (explore)
const SR = 1.6;
const FROM = [-4.55, 1.0, 0], TO = [-2.55, 1.0, 0];
class SliceExplore extends Scene {
  n = ValueTracker(6);
  u = ValueTracker(0);
  sn!: any;
  su!: any;
  override construct() {
    const { n, u } = this;
    this.add(always_redraw(() => slices(n.get_value(), u.get_value(), SR, FROM, TO)));
    const look = { length: 4.4, color: C.accent, track_color: '#C9CBD3', stroke_width: 9, knob_radius: 0.17, font_size: 34 };
    this.sn = new Slider(n, { ...look, x_range: [4, 48], label: '\\text{slices}', decimals: 0 }).move_to([-2.5, -2.2, 0]);
    this.su = new Slider(u, { ...look, x_range: [0, 1], label: '\\text{rearrange}', decimals: 2 }).move_to([-2.5, -3.15, 0]);
    this.add(this.sn, this.su);
    const tips = VGroup(
      fit(say('1. Cut the pizza into more slices.', 26), 5.6),
      fit(say('2. Slide "rearrange" to line them up.', 26), 5.6),
      fit(say('What shape appears?', 26, C.muted), 5.6),
    ).arrange(DOWN, { aligned_edge: LEFT, buff: 0.3 }).move_to([COL_X + 0.2, 1.2, 0]);
    this.add(tips);
    this.wait(0.1);
  }
}

/** Rearranged slices as a still figure (n slices, fully lined up). */
function still(n: number, labels = false) {
  class Still extends Scene {
    override construct() {
      const r = 2.1, to = [0, 0.3, 0];
      const shape = slices(n, 1, r, FROM, to);
      this.add(shape);
      if (labels) {
        const w = rearranged_width(n, r), h = r * Math.cos(Math.PI / n);
        const x0 = to[0] - w / 2, y0 = to[1] - h / 2;
        const side = BraceBetweenPoints([x0, y0 + h, 0], [x0, y0, 0], { color: C.accent });
        const bottom = BraceBetweenPoints([x0, y0, 0], [x0 + w, y0, 0], { color: P.crust });
        this.add(side, T('r', 40, C.accent).next_to(side, LEFT, { buff: 0.12 }));
        this.add(bottom, T('\\tfrac{1}{2}\\,\\text{crust}', 32, P.crustText).next_to(bottom, DOWN, { buff: 0.12 }));
      }
      this.wait(0.1);
    }
  }
  return new Still();
}

// ---------------------------------------------------------------- 9. why πr²
class WhyPiR2 extends Scene {
  override construct() {
    const r = SR, to = [-2.3, 0.6, 0];
    const u = ValueTracker(0);
    const n = 40;
    this.add(always_redraw(() => slices(n, u.get_value(), r, FROM, to)));
    this.play(u.animate.set_value(1), { run_time: 2.5 });
    const w = rearranged_width(n, r), h = r * Math.cos(Math.PI / n);
    const x0 = to[0] - w / 2, y0 = to[1] - h / 2;
    const side = BraceBetweenPoints([x0, y0 + h, 0], [x0, y0, 0], { color: C.accent });
    const sl = T('r', 40, C.accent).next_to(side, LEFT, { buff: 0.12 });
    const bottom = BraceBetweenPoints([x0, y0, 0], [x0 + w, y0, 0], { color: P.crust });
    const bl = T('\\tfrac{1}{2} \\cdot 2\\pi r = \\pi r', 34, P.crustText).next_to(bottom, DOWN, { buff: 0.12 });
    this.play(Create(side), Write(sl));
    this.play(Create(bottom), Write(bl));
    const eq1 = T('A = \\text{width} \\times \\text{height}', 36).move_to([COL_X, 2.0, 0]);
    const eq2 = T('A = \\pi r \\times r', 44).move_to([COL_X, 1.0, 0]);
    const eq3 = T('A = \\pi r^2', 60, C.accent).move_to([COL_X, -0.2, 0]);
    const eq4 = T('\\approx 3.14 \\text{ radius-squares}', 34, C.muted).move_to([COL_X, -1.3, 0]);
    this.play(Write(eq1));
    this.play(Write(eq2));
    this.play(Write(eq3));
    this.play(Indicate(eq3, { color: C.accent }));
    this.play(FadeIn(eq4));
    this.wait(1);
    hold(this, 15.7);
  }
}

// ---------------------------------------------------------------- 10. sketch A(r)
class SketchFigure extends Scene {
  ax = Axes({
    x_range: [0, 3, 1], y_range: [0, 30, 10], x_length: 5.4, y_length: 4.4, tips: false,
    axis_config: { color: C.muted, stroke_width: 2, include_numbers: true, font_size: 26, decimal_number_config: { num_decimal_places: 0, color: C.muted } },
  }).move_to([2.9, -0.3, 0]);
  override construct() {
    const c = [-4.2, 0.2, 0];
    const circle = Circle({ radius: 1.2, stroke_color: P.crust, stroke_width: 5, fill_color: P.cheese, fill_opacity: 0.9 }).move_to(c);
    const rad = Line(c, [c[0] + 1.2, c[1], 0], { color: C.accent, stroke_width: 4 });
    this.add(circle, rad, T('r', 36, C.accent).next_to(rad, DOWN, { buff: 0.1 }));
    this.add(this.ax, T('A', 36, C.ink).next_to(this.ax.c2p(0, 30), UP, { buff: 0.15 }), T('r', 36, C.ink).next_to(this.ax.c2p(3, 0), RIGHT, { buff: 0.15 }));
    this.wait(0.1);
  }
}

// ---------------------------------------------------------------- 11. grow the circle (explore)
const GC = [-3.4, -0.3, 0], U = 1.25;
class GrowExplore extends Scene {
  r = ValueTracker(1);
  override construct() {
    const { r } = this;
    this.add(grid(U, GC[0] - 2.5 * U, GC[1] - 2.5 * U, 5 * U, 5 * U).set_stroke({ opacity: 0.6 }));
    this.add(Circle({ radius: U, stroke_color: C.muted, stroke_width: 2.5 }).move_to(GC).set_stroke({ opacity: 0.8 }));
    this.add(always_redraw(() => {
      const rr = r.get_value() * U;
      return VGroup(
        Circle({ radius: rr, stroke_color: P.crust, stroke_width: 6, fill_color: P.cheese, fill_opacity: 0.55 }).move_to(GC),
        Square({ side_length: rr, color: C.accent, fill_opacity: 0.15, stroke_width: 2.5 }).move_to([GC[0] + rr / 2, GC[1] + rr / 2, 0]),
        Line(GC, [GC[0] + rr, GC[1], 0], { color: C.accent, stroke_width: 4 }),
      );
    }));
    const rv = DecimalNumber(1, { num_decimal_places: 2, font_size: 44, color: C.accent });
    const av = DecimalNumber(Math.PI, { num_decimal_places: 2, font_size: 44, color: C.ink });
    const kv = DecimalNumber(1, { num_decimal_places: 2, font_size: 52, color: C.coral });
    const row = (label: string, v: any, color: string, y: number) => {
      const g = VGroup(T(label, 44, color), v);
      const place = () => g.arrange(RIGHT, { buff: 0.18 }).move_to([COL_X - 1.6, y, 0], { aligned_edge: LEFT });
      place();
      g.add_updater(place);
      return g;
    };
    rv.add_updater((m: any) => m.set_value(r.get_value()));
    av.add_updater((m: any) => m.set_value(Math.PI * r.get_value() ** 2));
    kv.add_updater((m: any) => m.set_value(r.get_value() ** 2));
    this.add(row('r =', rv, C.accent, 1.8), row('A = \\pi r^2 =', av, C.ink, 0.9), row('\\times\\ \\text{area} =', kv, C.coral, -0.2));
    this.add(fit(say('The grey circle is the original (r = 1).', 22, C.muted), 5.6).move_to([COL_X, -1.4, 0]));
    this.wait(0.1);
  }
}

// ---------------------------------------------------------------- 13. back to the deal
class Settle extends Scene {
  override construct() {
    const big = pizza(8 * SCALE, [-4.7, 1.0, 0]);
    const s1 = pizza(4 * SCALE, [-1.95, 1.55, 0]), s2 = pizza(4 * SCALE, [-1.95, 0.45, 0]);
    this.add(big, s1, s2);
    const l1 = T('\\pi \\cdot 8^2 \\approx 201\\ \\text{in}^2', 36).move_to([COL_X, 2.0, 0]);
    const l2 = T('2 \\cdot \\pi \\cdot 4^2 \\approx 101\\ \\text{in}^2', 36).move_to([COL_X, 1.0, 0]);
    this.play(Write(l1));
    this.play(Write(l2));
    // bars: area to scale
    const k = 4.6 / 201;
    const bar = (v: number, y: number, color: string) => Rectangle({ width: v * k, height: 0.55, color, fill_opacity: 0.85, stroke_width: 0 }).move_to([-6.2 + (v * k) / 2, y, 0]);
    const b1 = bar(201, -1.3, P.crust), b2 = bar(100.5, -2.2, P.cheese2);
    const bl1 = say('one 16-inch', 24).next_to(b1, RIGHT, { buff: 0.2 }), bl2 = say('two 8-inch', 24).next_to(b2, RIGHT, { buff: 0.2 });
    this.play(FadeIn(b1, { shift: mul(0.3, RIGHT) }), FadeIn(bl1));
    this.play(FadeIn(b2, { shift: mul(0.3, RIGHT) }), FadeIn(bl2));
    const verdict = T('\\text{The big pizza is } 2\\times\\text{ as much!}', 40, C.accent).move_to([COL_X, -0.4, 0]);
    this.play(Write(verdict));
    this.play(Indicate(verdict, { color: C.accent }));
    this.wait(1.2);
    hold(this, 16.8);
  }
}

// ---------------------------------------------------------------- 14/15. practice figures
function diameterFigure(ctx: LessonContext) {
  class Dia extends Scene {
    override construct() {
      const d = ctx.vars.d;
      const pz = pizza(1.9, FIG, { toppings: false });
      const line = Line([FIG[0] - 1.9, FIG[1], 0], [FIG[0] + 1.9, FIG[1], 0], { color: C.accent, stroke_width: 6 });
      const ends = VGroup(Dot(line.get_start(), { radius: 0.07, color: C.accent }), Dot(line.get_end(), { radius: 0.07, color: C.accent }));
      this.add(pz, line, ends, T(`\\text{diameter} = ${d}\\ \\text{in}`, 38, C.accent).next_to(pz, UP, { buff: 0.25 }));
      this.wait(0.1);
    }
  }
  return new Dia();
}
class HalfFigure extends Scene {
  override construct() {
    const c = FIG, r = 1.9;
    const half = Polygon(...Array.from({ length: 41 }, (_, i) => [c[0] + r * Math.cos((Math.PI * i) / 40), c[1] + r * Math.sin((Math.PI * i) / 40), 0]), { stroke_color: P.crust, stroke_width: 6, fill_color: P.cheese, fill_opacity: 1 });
    const rad = Line(c, [c[0] + r, c[1], 0], { color: C.accent, stroke_width: 5 });
    this.add(half, rad, T('r', 40, C.accent).next_to(rad, DOWN, { buff: 0.12 }));
    this.wait(0.1);
  }
}

// ---------------------------------------------------------------- 16. wrap-up
class Wrap extends Scene {
  override construct() {
    const rows = VGroup(
      VGroup(T('1.', 40, C.muted), fit(say('Slices line up into a rectangle πr wide and r tall.', 30), 9)).arrange(RIGHT, { buff: 0.3 }),
      VGroup(T('2.', 40, C.muted), T('A = \\pi r^2 \\approx 3.14\\,r^2', 44, C.accent)).arrange(RIGHT, { buff: 0.3 }),
      VGroup(T('3.', 40, C.muted), fit(say('Radius × k  →  area × k². Double the size, four times the pizza.', 30), 9)).arrange(RIGHT, { buff: 0.3 }),
    ).arrange(DOWN, { aligned_edge: LEFT, buff: 0.55 }).move_to([0, 0, 0]);
    for (const row of rows.submobjects) this.play(FadeIn(row, { shift: mul(0.2, UP) }), { run_time: 0.9 });
    this.wait(1.5);
    hold(this, 12.6);
  }
}

// ---------------------------------------------------------------- remediations
class RemScaling extends Scene {
  override construct() {
    const s = 1.1;
    const one = Square({ side_length: s, color: C.accent, fill_opacity: 0.2 }).move_to([-4.6, 0, 0]);
    const four = VGroup(...[[0, 0], [1, 0], [0, 1], [1, 1]].map(([i, j]) => Square({ side_length: s, color: C.coral, fill_opacity: 0.2 }).move_to([-2.6 + i * s, -0.55 + j * s, 0])));
    this.play(FadeIn(one));
    this.play(LaggedStart(...four.submobjects.map((m: any) => FadeIn(m)), { lag_ratio: 0.25 }));
    const t = VGroup(T('\\text{side} \\times 2', 40, C.ink), T('\\text{area} \\times 4', 48, C.coral)).arrange(DOWN, { buff: 0.35 }).move_to([COL_X, 0.4, 0]);
    this.play(Write(t));
    this.add(fit(say('A circle grows the same way: radius × 2 → area × 4.', 26, C.muted), 6).move_to([COL_X, -1.3, 0]));
    this.wait(1.2);
    hold(this, 7.4);
  }
}
class RemCrust extends Scene {
  override construct() {
    const pz = pizza(1.9, FIG, { toppings: false });
    const crust = Circle({ radius: 1.9, stroke_color: C.coral, stroke_width: 12 }).move_to(FIG);
    const t1 = T('2\\pi r = \\text{the crust (a length)}', 34, C.coral).move_to([COL_X, 1.0, 0]);
    const t2 = T('\\pi r^2 = \\text{the cheese (an area)}', 34, P.crustText).move_to([COL_X, -0.2, 0]);
    this.add(pz);
    this.play(Create(crust), Write(t1));
    this.play(FadeOut(crust), Indicate(pz, { color: P.cheese2, scale_factor: 1.05 }), Write(t2));
    this.wait(1.2);
    hold(this, 7.5);
  }
}

// ---------------------------------------------------------------- the lesson
export const lesson: Lesson = {
  id: 'pizza',
  title: 'The pizza deal: why a circle’s area is πr²',
  description: 'One 16-inch pizza or two 8-inch pizzas for the same price? Slice, rearrange, and find out why the area of a circle is πr².',
  skills: [
    { id: 'area-why', name: 'Explain $A = \\pi r^2$' },
    { id: 'area-scaling', name: 'Radius $\\times k$ → area $\\times k^2$' },
    { id: 'area-compute', name: 'Compute circle areas', prerequisites: ['area-why'] },
  ],
  misconceptions: [
    { id: 'linear-scaling', description: 'Doubling the radius doubles the area.', remediation: 'rem-scaling' },
    { id: 'more-pieces', description: 'More pizzas means more pizza, whatever their size.', remediation: 'rem-scaling' },
    { id: 'circumference-area', description: 'The area is 2πr - mixing up the crust (a length) with the pizza (an area).', remediation: 'rem-crust' },
    { id: 'diameter-radius', description: 'Using the diameter where the formula needs the radius.' },
    { id: 'four-squares', description: 'The circle is 4 radius-squares - that is the square around it.' },
  ],
  steps: [
    { id: 'deal', kind: 'scene', chapter: 'The deal', title: 'Friday night', scene: Deal, narration: 'Friday night deal: one 16-inch pizza, or two 8-inch pizzas, for the same price. Which one gives you more pizza?' },
    {
      id: 'bet', kind: 'checkpoint', skill: 'area-scaling', purpose: 'predict', confidence: true, title: 'Your bet',
      prompt: 'Same price. Which is **more pizza**?',
      question: {
        type: 'choice', options: [
          { id: 'big', label: 'The one 16-inch pizza', correct: true },
          { id: 'same', label: 'They are the same amount', misconception: 'linear-scaling' },
          { id: 'two', label: 'The two 8-inch pizzas', misconception: 'more-pieces' },
        ],
      },
      explain: 'Hold on to your bet - we will settle it at the end of the lesson.',
    },
    { id: 'measure', kind: 'scene', chapter: 'Measuring a circle', title: 'Radius-squares', scene: Measure, narration: 'To measure a circle, use its radius, r. A radius-square is a square with side r, so its area is r squared.' },
    {
      id: 'how-many', kind: 'checkpoint', skill: 'area-why', purpose: 'predict', title: 'How many squares?', reveal: 'bounds',
      prompt: 'How many radius-squares ($r^2$) make up the area of the circle?',
      question: {
        type: 'choice', options: [
          { id: '2', label: 'About 2' },
          { id: '3', label: 'A bit more than 3', correct: true },
          { id: '4', label: 'Exactly 4', misconception: 'four-squares', feedback: '4 radius-squares make the square *around* the circle - the corners stick out.' },
          { id: '6', label: 'About 6' },
        ],
      },
    },
    { id: 'bounds', kind: 'scene', scene: Bounds, branch_only: true, title: 'Between 2 and 4', narration: 'The square around the circle holds four radius-squares, and the diamond inside holds two. The circle is in between: about 3.14.' },
    {
      id: 'slice', kind: 'explore', chapter: 'Slice and rearrange', title: 'Slice the pizza', scene: () => new SliceExplore(),
      narration: 'Your turn. Cut the pizza into more and more slices, then line them up.',
      prompt: 'Use the two sliders: cut the pizza into **many** slices, then **rearrange** them. What shape appears?',
      setup: (scene: any, ui) => {
        scene.sn.attach(ui, { snap: 2, label: 'the slices slider', step: 2 });
        scene.su.attach(ui, { label: 'the rearrange slider', step: 0.05 });
      },
      goal: { check: (scene: any) => scene.n.get_value() >= 24 && scene.u.get_value() >= 0.95, message: 'Nice - with many slices it is almost a perfect rectangle.' },
      solve: (scene: any) => {
        scene.n.set_value(30);
        scene.u.set_value(1);
      },
    },
    {
      id: 'shape', kind: 'checkpoint', skill: 'area-why', purpose: 'check', title: 'What shape?', scene: () => still(48),
      prompt: 'With more and more slices, the rearranged pizza becomes a…',
      question: {
        type: 'choice', options: [
          { id: 'rect', label: 'Rectangle', correct: true },
          { id: 'para', label: 'Parallelogram', feedback: 'With few slices it leans like a parallelogram - with many slices the sides stand straight up.' },
          { id: 'tri', label: 'Triangle' },
          { id: 'circle', label: 'Circle again' },
        ],
      },
    },
    {
      id: 'area-expr', kind: 'checkpoint', skill: 'area-why', purpose: 'check', title: 'Its area', scene: () => still(48, true),
      prompt: 'The rectangle is $r$ tall. Its width is **half the crust**: $\\tfrac12 \\cdot 2\\pi r$. Write its area.',
      question: {
        type: 'expression', answer: 'pi*r^2', variables: ['r'], ranges: { r: [0.5, 5] },
        wrong: [
          { answer: '2*pi*r', misconception: 'circumference-area', feedback: '$2\\pi r$ is the whole crust - a length, not an area.' },
          { answer: 'pi*r', feedback: 'That is the width. Multiply by the height, $r$.' },
          { answer: '2*pi*r^2', feedback: 'The width is only *half* the crust.' },
        ],
      },
      hints: ['Area of a rectangle = width × height.', 'Width $= \\tfrac12 \\cdot 2\\pi r = \\pi r$, height $= r$.', '$\\pi r \\times r = \\;?$'],
    },
    { id: 'why', kind: 'scene', title: 'Why πr²', scene: WhyPiR2, narration: 'The slices make a rectangle. Its height is the radius, r. Its width is half the crust, pi r. So the area is pi r times r: pi r squared. About 3.14 radius-squares, just as we estimated.' },
    {
      id: 'sketch', kind: 'checkpoint', chapter: 'Bigger pizzas', skill: 'area-scaling', purpose: 'predict', title: 'Area vs radius', scene: () => new SketchFigure(),
      prompt: 'Sketch how the area $A$ grows as the radius $r$ goes from 0 to 3.',
      question: { type: 'sketch', f: (x) => Math.PI * x * x, x_range: [0.05, 3], y_range: [0, 30], axes: (s: any) => s.ax, pass: 0.65 },
    },
    {
      id: 'grow', kind: 'explore', title: 'Grow the pizza', scene: () => new GrowExplore(),
      narration: 'Now drag the edge of the pizza to change its radius. Watch how fast the area grows.',
      prompt: 'Drag the pizza’s edge. Find the radius that makes the area **2 times** the original.',
      setup: (scene: any, ui) => {
        ui.add_handle({
          tracker: scene.r, label: 'the pizza’s edge', step: 0.02,
          from_value: (v) => [GC[0] + v * U, GC[1], 0],
          to_value: (p) => Math.min(2.2, Math.max(0.4, (p[0] - GC[0]) / U)),
        });
      },
      goal: { check: (scene: any) => Math.abs(scene.r.get_value() ** 2 - 2) < 0.1, message: 'Double the area at r ≈ 1.41 - not at r = 2!' },
      solve: (scene: any) => scene.r.set_value(Math.SQRT2),
    },
    {
      id: 'factor', kind: 'checkpoint', skill: 'area-scaling', purpose: 'check', title: 'Scale factor',
      prompt: 'If the radius is multiplied by 2, the area is multiplied by…',
      question: { type: 'number', answer: 4, wrong: [{ answer: 2, misconception: 'linear-scaling', feedback: 'Area uses the radius twice ($r \\times r$), so the factor 2 counts twice.' }] },
      hints: ['Compare $\\pi r^2$ with $\\pi (2r)^2$.', '$(2r)^2 = 4r^2$.'],
    },
    { id: 'settle', kind: 'scene', chapter: 'The verdict', title: 'Back to the deal', scene: Settle, narration: 'Back to the deal. The big pizza has radius 8, so its area is 64 pi, about 201 square inches. Each small one has radius 4, about 50. Two of them make about 101. The big pizza is twice as much food.' },
    {
      id: 'shop', kind: 'checkpoint', chapter: 'Practice', skill: 'area-compute', purpose: 'practice', title: 'Your pizza shop', scene: diameterFigure,
      params: (rng) => ({ d: [10, 12, 14, 18][Math.floor(rng() * 4)] }),
      prompt: 'A {d}-inch pizza (pizza sizes are diameters). What is its area in square inches? Round to 1 decimal.',
      question: {
        type: 'number', answer: (v) => Math.PI * (v.d / 2) ** 2, tolerance: 0.3, unit: 'in²',
        wrong: [
          { answer: (v) => Math.PI * v.d ** 2, misconception: 'diameter-radius', feedback: 'Pizza sizes are diameters - the radius is half of {d}.' },
          { answer: (v) => Math.PI * v.d, misconception: 'circumference-area', feedback: 'That is the length of the crust, not the area.' },
        ],
      },
      hints: ['The radius is half the diameter.', 'r = {d} ÷ 2, then A = πr².'],
    },
    {
      id: 'half', kind: 'checkpoint', skill: 'area-compute', purpose: 'practice', title: 'Half a pizza', scene: () => new HalfFigure(),
      prompt: 'Write the area of half a pizza with radius $r$.',
      question: {
        type: 'expression', answer: 'pi*r^2/2', variables: ['r'], ranges: { r: [0.5, 5] },
        wrong: [
          { answer: 'pi*r^2', feedback: 'That is the whole pizza - take half.' },
          { answer: 'pi*r', misconception: 'circumference-area', feedback: 'That is half the crust - a length.' },
        ],
      },
      hints: ['Whole pizza: $\\pi r^2$.', 'Half of it: divide by 2.'],
    },
    { id: 'wrap', kind: 'scene', title: 'Remember', scene: Wrap, narration: 'Slices become a rectangle, pi r wide and r tall, so the area is pi r squared, about three radius-squares. And when the radius doubles, the area grows four times.' },
    { id: 'rem-scaling', kind: 'scene', branch_only: true, title: 'Size and area', scene: RemScaling, narration: 'Double the side of a square and it holds four of the old squares, not two. Circles grow the same way.' },
    { id: 'rem-crust', kind: 'scene', branch_only: true, title: 'Crust or cheese?', scene: RemCrust, narration: 'Two pi r is the crust, a length around the edge. Pi r squared is the cheese, the space inside.' },
  ],
};
