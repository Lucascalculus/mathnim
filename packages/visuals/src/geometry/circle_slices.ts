// Why a circle's area is πr²: cut it into n slices and line them up; the shape
// tends to a rectangle r high and πr wide.
import { Arc, BraceBetweenPoints, Circle, Create, DOWN, FadeIn, LEFT, Line, MathTex, Scene, Sector, VGroup, ValueTracker, Write, always_redraw } from 'manim-web';
import { Slider } from 'manim-web/ext/widgets';
import { palette } from '../theme';
import { define_visual } from '../visual';

const FROM = [-4.3, 0.75, 0];
const TO = [2.3, 0.75, 0];

/** Width of the lined-up slices (tends to πr). */
export function lined_up_width(n: number, r: number): number {
  n = Math.max(2, 2 * Math.round(n / 2));
  const s = 2 * r * Math.sin(Math.PI / n);
  return (n / 2) * s + s / 2;
}

/**
 * n slices of a circle of radius r, moved a fraction u (0..1) from the circle
 * (centred at `from`) into a row (centred at `to`): even slices tip up, odd
 * slices tip down, so each long edge is one half of the rim.
 */
export function slices(n: number, u: number, r: number, from: number[], to: number[]) {
  const c = palette();
  n = Math.max(2, 2 * Math.round(n / 2));
  const th = (2 * Math.PI) / n;
  const s = 2 * r * Math.sin(th / 2), h = r * Math.cos(th / 2);
  const width = (n / 2) * s + s / 2;
  const x0 = to[0] - width / 2, y0 = to[1] - h / 2;
  const e = u * u * (3 - 2 * u);
  const g = VGroup();
  for (let i = 0; i < n; i++) {
    const k = Math.floor(i / 2);
    const up = i % 2 === 0;
    const tip1 = up ? [x0 + k * s + s / 2, y0 + h, 0] : [x0 + k * s + s, y0, 0];
    const a0 = (i + 0.5) * th;
    let a1 = up ? -Math.PI / 2 : Math.PI / 2;
    while (a1 - a0 > Math.PI) a1 -= 2 * Math.PI;
    while (a0 - a1 > Math.PI) a1 += 2 * Math.PI;
    const a = a0 + (a1 - a0) * e;
    const tip = [from[0] + (tip1[0] - from[0]) * e, from[1] + (tip1[1] - from[1]) * e, 0];
    const sector = Sector({ radius: r, angle: th, start_angle: a - th / 2, fill_color: c.accent, fill_opacity: up ? 0.42 : 0.24, stroke_color: c.bg, stroke_width: n > 24 ? 1 : 2 });
    sector.shift(tip);
    const rim = Arc({ radius: r, start_angle: a - th / 2, angle: th, stroke_color: c.gold, stroke_width: 5 }).shift(tip);
    g.add(sector, rim);
  }
  return g;
}

export interface CircleSlicesParams extends Record<string, unknown> {
  n: number;
  r: number;
  show_formula: boolean;
}

export const circle_slices = define_visual<CircleSlicesParams>({
  name: 'circle_slices',
  summary: 'Cut a circle into n slices and line them up into a near-rectangle r high and πr wide, so A = πr·r = πr². Student drags "slices" and "line up" sliders.',
  topics: ['geometry', 'circles', 'area', 'pi'],
  params: {
    n: { type: 'integer', min: 4, max: 60, default: 24, doc: 'number of slices in the explanation (even)' },
    r: { type: 'number', min: 1, max: 2.1, default: 1.6, doc: 'radius in scene units' },
    show_formula: { type: 'boolean', default: true, doc: 'derive A = πr·r = πr² next to the shape' },
  },
  examples: [{}, { n: 8, r: 2.1 }, { n: 60, r: 1, show_formula: false }],
  ids: ['radius', 'slices', 'height_brace', 'width_brace', 'formula', 'slices_slider', 'line_up_slider'],
  scene: (p) => {
    class CircleSlices extends Scene {
      n = ValueTracker(p.n);
      u = ValueTracker(0);
      sn: any;
      su: any;
      override construct() {
        const c = palette(), { n, u } = this, r = p.r;
        const circle = Circle({ radius: r, stroke_color: c.gold, stroke_width: 5 }).move_to(FROM);
        const radius = Line(FROM, [FROM[0] + r, FROM[1], 0], { color: c.ink, stroke_width: 4 });
        const rl = MathTex('r', { font_size: 40, color: c.ink }).next_to(radius, DOWN, { buff: 0.12 });
        circle.name = 'circle';
        radius.name = 'radius';
        this.play(Create(circle), Create(radius), Write(rl));
        const cut = always_redraw(() => slices(n.get_value(), u.get_value(), r, FROM, TO));
        cut.name = 'slices';
        this.play(FadeIn(cut));
        this.remove(circle);
        this.play(u.animate.set_value(1), { run_time: 3 });
        const braces = always_redraw(() => {
          const k = Math.max(0, (u.get_value() - 0.8) / 0.2) ** 2;
          const w = lined_up_width(n.get_value(), r), h = r * Math.cos(Math.PI / Math.max(2, 2 * Math.round(n.get_value() / 2)));
          const x0 = TO[0] - w / 2, y0 = TO[1] - h / 2;
          const side = BraceBetweenPoints([x0, y0 + h, 0], [x0, y0, 0], { color: c.accent });
          const bottom = BraceBetweenPoints([x0, y0, 0], [x0 + w, y0, 0], { color: c.gold });
          const g = VGroup(
            side, MathTex('r', { font_size: 40, color: c.accent }).next_to(side, LEFT, { buff: 0.12 }),
            bottom, MathTex('\\tfrac{1}{2}\\cdot 2\\pi r = \\pi r', { font_size: 32, color: c.gold }).next_to(bottom, DOWN, { buff: 0.12 }),
          );
          g.submobjects[0].name = 'height_brace';
          g.submobjects[2].name = 'width_brace';
          return g.set_opacity(k);
        });
        this.add(braces);
        if (p.show_formula) {
          const eq = MathTex('A = \\pi r \\cdot r = \\pi r^2', { font_size: 46, color: c.ink }).move_to([TO[0], -2.05, 0]);
          eq.name = 'formula';
          this.play(Write(eq));
        }
        const look = { length: 3.2, color: c.accent, track_color: c.faint, stroke_width: 8, knob_radius: 0.16, font_size: 30 };
        this.sn = new Slider(n, { ...look, x_range: [4, 60], label: '\\text{slices}', decimals: 0 }).move_to([FROM[0] + 1.0, -2.25, 0]);
        this.su = new Slider(u, { ...look, x_range: [0, 1], label: '\\text{line up}', decimals: 2 }).move_to([FROM[0] + 1.0, -3.15, 0]);
        this.sn.name = 'slices_slider';
        this.su.name = 'line_up_slider';
        this.play(FadeIn(this.sn), FadeIn(this.su));
        this.wait(p.show_formula ? 1 : 2.5);
      }
    }
    return new CircleSlices();
  },
  explore: (scene: any, ui) => {
    scene.sn.attach(ui, { snap: 2, step: 2, label: 'the slices slider' });
    scene.su.attach(ui, { step: 0.05, label: 'the line-up slider' });
  },
});
