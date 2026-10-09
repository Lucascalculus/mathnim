// Figures shared by every scene of the lesson. Same placement everywhere, so
// the learner never has to re-orient between steps.
import {
  Axes, Circle, DashedLine, DecimalNumber, Dot, Line, MathTex, Polygon, Text, VGroup, VMobject, DOWN, LEFT, RIGHT, UP, type ValueTracker,
} from 'manim-web';
import { C } from './theme';

export const NEAR = 9, FAR = 16;
/** Shooting angle (degrees) at distance d from the goal line, posts at a and b from the run line. */
export const theta = (d: number, a = NEAR, b = FAR) => ((Math.atan(b / d) - Math.atan(a / d)) * 180) / Math.PI;
export const best = (a = NEAR, b = FAR) => Math.sqrt(a * b);

/** Pitch coordinates (metres: x along the goal line, y out from it) -> scene. */
export class Pitch extends VGroup {
  declare ox: number;
  declare oy: number;
  declare s: number;
  declare a: number;
  declare b: number;
  declare grass: any;
  declare lines: any;
  declare net: any;
  declare run: any;
  declare posts: any;
  constructor(o: { a?: number; b?: number; origin?: [number, number]; scale?: number } = {}) {
    super();
    this.a = o.a ?? NEAR;
    this.b = o.b ?? FAR;
    [this.ox, this.oy] = o.origin ?? [-6.35, 3.2];
    this.s = o.scale ?? 0.205;
    const x0 = -2.5, x1 = this.b + 9, y1 = 31;
    const grass = VGroup();
    for (let y = 0, k = 0; y < y1; y += 4, k++) grass.add(this.rect(x0, y, x1, Math.min(y + 4, y1), k % 2 ? C.grassB : C.grassA));
    this.grass = grass;
    const lines = VGroup(
      Line(this.p(x0, 0), this.p(x1, 0), { color: C.line, stroke_width: 4 }),
      this.rect(this.a - 5.5, 0, this.b + 5.5, 5.5, null).set_stroke({ color: C.line, width: 3 }),
    );
    this.lines = lines;
    this.net = this.rect(this.a, -2, this.b, 0, C.ink).set_fill({ opacity: 0.05 }).set_stroke({ color: C.ink, width: 1.2, opacity: 0.35 });
    this.posts = VGroup(Dot(this.A(), { radius: 0.07, color: C.ink }), Dot(this.B(), { radius: 0.07, color: C.ink }));
    this.run = DashedLine(this.p(0, 30), this.p(0, 0), { color: C.muted, stroke_width: 2.5, dash_length: 0.12 });
    this.add(this.grass, this.lines, this.net, this.run, this.posts);
  }
  p(x: number, y: number): [number, number, number] {
    return [this.ox + this.s * x, this.oy - this.s * y, 0];
  }
  A() {
    return this.p(this.a, 0);
  }
  B() {
    return this.p(this.b, 0);
  }
  /** Distance d of a scene point projected onto the run line. */
  d_of(point: number[]): number {
    return (this.oy - point[1]) / this.s;
  }
  rect(xa: number, ya: number, xb: number, yb: number, fill: string | null) {
    const r = Polygon(this.p(xa, ya), this.p(xb, ya), this.p(xb, yb), this.p(xa, yb), { stroke_width: 0 });
    if (fill) r.set_fill({ color: fill, opacity: 1 });
    else r.set_fill({ opacity: 0 });
    return r;
  }
  /** The player's view of the goal: cone, sight lines, angle arc, token. */
  cone(d: number, o: { color?: string; label?: boolean } = {}) {
    const color = o.color ?? C.accent;
    const P = this.p(0, d), A = this.A(), B = this.B();
    const g = VGroup(
      Polygon(P, A, B, { stroke_width: 0 }).set_fill({ color, opacity: 0.12 }),
      Line(P, A, { color, stroke_width: 2.5 }),
      Line(P, B, { color, stroke_width: 2.5 }),
    );
    if (d > 0.3) {
      const r = 0.75;
      const a1 = Math.atan2(A[1] - P[1], A[0] - P[0]), a2 = Math.atan2(B[1] - P[1], B[0] - P[0]);
      const arc = VMobject({ stroke_color: color, stroke_width: 3 });
      const n = 16;
      arc.set_points_smoothly(Array.from({ length: n + 1 }, (_, i) => {
        const t = a2 + ((a1 - a2) * i) / n;
        return [P[0] + r * Math.cos(t), P[1] + r * Math.sin(t), 0];
      }));
      g.add(arc);
    }
    g.add(token(P));
    return g;
  }
}
export function token(P: number[], color = C.ink) {
  return VGroup(
    Dot(P, { radius: 0.2, color, fill_opacity: 0.12, stroke_width: 0 }),
    Dot(P, { radius: 0.1, color, stroke_color: '#FFFFFF', stroke_width: 2.5 }),
  );
}

/** theta(d) axes on the right half of the frame. */
export class AngleGraph extends VGroup {
  declare ax: any;
  declare a: number;
  declare b: number;
  constructor(o: { a?: number; b?: number } = {}) {
    super();
    this.a = o.a ?? NEAR;
    this.b = o.b ?? FAR;
    const ax = Axes({
      x_range: [0, 30, 5], y_range: [0, 20, 5], x_length: 5.6, y_length: 4.2, tips: false,
      axis_config: { color: C.muted, stroke_width: 2, include_numbers: true, font_size: 24, tick_size: 0.05, decimal_number_config: { num_decimal_places: 0, color: C.muted } },
    }).move_to([3.75, -0.6, 0]);
    this.ax = ax;
    const xl = Text('distance from goal line, d (m)', { font_size: 22, color: C.muted, font: 'sans-serif' }).next_to(ax.x_axis, DOWN, { buff: 0.5 });
    const yl = MathTex('\\theta\\ (^\\circ)', { font_size: 30, color: C.accent }).next_to(ax.c2p(0, 20), UP, { buff: 0.2 });
    this.add(ax, xl, yl);
  }
  curve(d0 = 0.05, d1 = 30, color = C.accent, width = 4) {
    return this.ax.plot((d: number) => theta(d, this.a, this.b), { x_range: [d0, Math.max(d1, d0 + 0.01), 0.05], color, stroke_width: width });
  }
  point(d: number) {
    return this.ax.c2p(d, theta(d, this.a, this.b));
  }
}

/** Live "d = 12.0 m   θ = 16.3°" readout bound to a tracker (left-aligned, so digits do not push it around). */
export function readout(d: ValueTracker, a = NEAR, b = FAR) {
  const dv = DecimalNumber(d.get_value(), { num_decimal_places: 1, font_size: 44, color: C.ink });
  const tv = DecimalNumber(theta(d.get_value(), a, b), { num_decimal_places: 1, font_size: 44, color: C.accent, unit: '^\\circ' });
  const row1 = VGroup(MathTex('d =', { font_size: 44, color: C.ink }), dv, MathTex('\\text{m}', { font_size: 40, color: C.muted }));
  const row2 = VGroup(MathTex('\\theta =', { font_size: 44, color: C.accent }), tv);
  const left: [number, number, number] = [0.6, 2.8, 0];
  const place = () => {
    row1.arrange(RIGHT, { buff: 0.12 }).move_to(left, { aligned_edge: LEFT });
    row2.arrange(RIGHT, { buff: 0.12 }).next_to(row1, RIGHT, { buff: 0.8 });
  };
  const g = VGroup(row1, row2);
  g.add_updater(() => {
    dv.set_value(d.get_value());
    tv.set_value(theta(d.get_value(), a, b));
    place();
  });
  place();
  return g;
}

/** The circle through both posts that touches the run line at distance d. */
export function circle_through_posts(pitch: Pitch, center_y: number, color = C.gold) {
  const cx = (pitch.a + pitch.b) / 2;
  const r = Math.hypot(cx - pitch.a, center_y);
  const c = pitch.p(cx, center_y);
  return Circle({ radius: r * pitch.s, color, stroke_width: 3 }).move_to(c);
}

/** Shrink m to at most `w` wide (text columns). */
export function fit<T extends { width: number; scale_to_fit_width(w: number): unknown }>(m: T, w = 6): T {
  if (m.width > w) m.scale_to_fit_width(w);
  return m;
}
/** Centre of the right-hand text column. */
export const COL: [number, number, number] = [3.5, 0, 0];
