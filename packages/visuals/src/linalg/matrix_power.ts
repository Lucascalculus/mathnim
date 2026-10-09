// Applying A again and again: a fan of vectors swings towards the dominant
// eigenvector (the component along the other eigenvector shrinks by λ₂/λ₁
// every step). Then the grid switches to the eigenbasis, where A is just a
// stretch of each axis: A = PDP⁻¹, Aⁿ = PDⁿP⁻¹. Explore: scrub n with a slider
// and turn the starting fan.
import { Create, FadeIn, FadeOut, GrowArrow, Scene, VGroup, VMobject, ValueTracker, Write, always_redraw, smooth, DOWN, LEFT, RIGHT } from 'manim-web';
import { Slider } from 'manim-web/ext/widgets';
import { palette } from '../theme';
import { define_visual } from '../visual';
import {
  LiveMatrix, MatrixTrackers, PANEL, STAGE, backed, clamp, clip_line, clipped, dodge, fit_plane, live_arrow, path, readout, segment_points, tex,
  transformed_grid, type P3, type Plane,
} from './kit';
import { apply2, eig2, fmt, from_angle, from_cols, lerp_polar, mat2, norm2, type Mat2, type Vec2 } from './math';

export interface MatrixPowerParams extends Record<string, unknown> {
  A: number[][];
  steps: number;
  count: number;
  show_eigenbasis: boolean;
}

/** A^k v for k = 0..n. */
export function powers(A: Mat2, v: Vec2, n: number): Vec2[] {
  const out: Vec2[] = [v];
  for (let k = 0; k < n; k++) out.push(apply2(A, out[out.length - 1]));
  return out;
}
/** Should the fan be shown with lengths rescaled (only directions), because the true lengths blow up or vanish? */
export function needs_rescale(A: Mat2, n: number, r0: number, fan: Vec2[]): boolean {
  let big = 0, small = Infinity;
  for (const v of fan)
    for (const w of powers(A, v, n)) {
      big = Math.max(big, norm2(w));
      small = Math.min(small, norm2(w));
    }
  return big > 2.4 * r0 || small < 0.18 * r0;
}
/** The fan of start vectors: `count` directions spread over a full turn (offset by phase). */
export const fan_of = (count: number, r0: number, phase: number): Vec2[] => Array.from({ length: count }, (_, i) => from_angle(phase + (2 * Math.PI * i) / count + 0.35, r0));

export const matrix_power = define_visual<MatrixPowerParams>({
  name: 'matrix_power',
  summary: 'Aⁿv: a fan of vectors swings to the dominant eigenvector (power iteration); then the eigenbasis grid, where A only stretches each axis: A = PDP⁻¹, Aⁿ = PDⁿP⁻¹. Student scrubs n and turns the fan.',
  topics: ['linear algebra', 'eigenvectors', 'matrix powers', 'diagonalization', 'eigenbasis', 'power iteration'],
  params: {
    A: { type: 'matrix', rows: 2, cols: 2, min: -3, max: 3, default: [[0.9, 0.3], [0.2, 0.8]], doc: 'the matrix, rows first; default has λ₁ = 1.1 along (3, 2) and λ₂ = 0.6 along (1, -1). Lengths are rescaled automatically when Aⁿ grows or shrinks a lot' },
    steps: { type: 'integer', min: 1, max: 12, default: 8, doc: 'how many times A is applied' },
    count: { type: 'integer', min: 1, max: 8, default: 5, doc: 'number of starting vectors (spread around the circle)' },
    show_eigenbasis: { type: 'boolean', default: true, doc: 'afterwards switch the grid to the eigenbasis and show A = PDP⁻¹ as a pure stretch (skipped when A has no eigenbasis)' },
  },
  examples: [{}, { A: [[2, 1], [1, 2]], steps: 5 }, { A: [[1, 1], [0, 1]], steps: 10, count: 4 }, { A: [[0.8, -0.6], [0.6, 0.8]], steps: 12, show_eigenbasis: false }],
  ids: ['grid', 'fan', 'trails', 'eigenlines', 'matrix', 'power_readout', 'n_slider', 'why', 'eigenbasis_formula'],
  scene: (p) => {
    const A = mat2(p.A), steps = p.steps, count = p.count;
    const e = eig2(A);
    const r0 = 1.5;
    class MatrixPower extends Scene {
      n = ValueTracker(0);
      phase = ValueTracker(0);
      G = new MatrixTrackers([[1, 0], [0, 1]]);
      plane!: Plane;
      slider: any;
      r0 = r0;
      override construct() {
        const c = palette();
        const { n, phase, G } = this;
        n.name = 'power_n';
        phase.name = 'fan_phase';
        this.track(n, phase, ...G.t);
        const rescale = needs_rescale(A, steps, r0, fan_of(count, r0, 0));
        let ext = r0;
        if (!rescale) for (const v of fan_of(count, r0, 0)) for (const w of powers(A, v, steps)) ext = Math.max(ext, norm2(w));
        const plane = fit_plane(STAGE, [-2.5, 0], ext + 0.35, 1.05);
        this.plane = plane;
        const shown = (w: Vec2): Vec2 => (rescale ? (norm2(w) < 1e-12 ? w : [(w[0] / norm2(w)) * r0, (w[1] / norm2(w)) * r0]) : w);
        /** the fan after a (fractional) number of steps */
        const at_n = (v: Vec2, t: number): Vec2 => {
          const k = Math.floor(clamp(t, 0, steps)), f = clamp(t, 0, steps) - k;
          const pw = powers(A, v, Math.min(steps, k + 1));
          const a = shown(pw[k]), b = shown(pw[Math.min(k + 1, pw.length - 1)]);
          return f < 1e-9 ? a : lerp_polar(a, b, f);
        };
        const colors = [c.accent, c.teal, c.purple, c.coral, c.good];
        const fan = () => fan_of(count, r0, phase.get_value());

        const grid = transformed_grid(plane, () => G.get(), { line_opacity: 0.4 });
        grid.group.name = 'grid';
        const arrows = Array.from({ length: count }, (_, i) => live_arrow(() => clipped(plane, at_n(fan()[i], n.get_value())), colors[i % colors.length], 5));
        // where the fan starts (the first one is draggable)
        const seeds = always_redraw(() => VGroup(...fan().map((v, i) => {
          const q = plane.pv(v), r = i === 0 ? 0.11 : 0.07;
          const d = VMobject({ stroke_color: colors[i % colors.length], stroke_width: 2.5, fill_opacity: 0 });
          d.set_points_as_corners(Array.from({ length: 17 }, (_, k) => [q[0] + r * Math.cos((k * Math.PI) / 8), q[1] + r * Math.sin((k * Math.PI) / 8), 0]));
          return d;
        })));
        const fan_g = VGroup(...arrows);
        fan_g.name = 'fan';
        const trails = always_redraw(() => {
          const t = n.get_value(), g = VGroup();
          fan().forEach((v, i) => {
            const pts: P3[] = [];
            for (let k = 0; k <= Math.floor(t); k++) pts.push(plane.pv(at_n(v, k)));
            pts.push(plane.pv(at_n(v, t)));
            const vm = VMobject({ stroke_color: colors[i % colors.length], stroke_width: 2.5, stroke_opacity: 0.55, fill_opacity: 0 });
            vm.set_points_as_corners(pts.length > 1 ? pts : [pts[0], pts[0]]);
            g.add(vm);
          });
          return g;
        });
        trails.name = 'trails';
        // eigenlines
        const dirs: { u: Vec2; l: number; main: boolean }[] = [];
        if (e.kind === 'distinct') {
          const i = Math.abs(e.values[0]) >= Math.abs(e.values[1]) ? 0 : 1;
          dirs.push({ u: e.vectors[i], l: e.values[i], main: Math.abs(e.values[i]) > Math.abs(e.values[1 - i]) + 1e-9 });
          dirs.push({ u: e.vectors[1 - i], l: e.values[1 - i], main: false });
        } else if (e.kind === 'repeated') dirs.push({ u: e.vectors[0], l: e.values[0], main: true });
        const box = { x0: STAGE.x0 + 0.05, x1: STAGE.x1 - 0.05, y0: STAGE.y0 + 0.05, y1: STAGE.y1 - 0.05 };
        const lines = dirs.map((d) => {
          const l = path(d.main ? c.gold : c.muted, d.main ? 4.5 : 3, d.main ? 0.9 : 0.8);
          const seg = clip_line(plane.p(0, 0), [d.u[0], d.u[1]], box);
          l.points = segment_points(seg ? [seg] : []);
          return l;
        });
        const eigenlines = VGroup(...lines);
        eigenlines.name = 'eigenlines';
        const line_labels = dirs.map((d, i) => {
          const lab = backed(tex(dirs.length === 1 ? `\\lambda = ${fmt(d.l)}` : `\\lambda_{${i + 1}} = ${fmt(d.l)}`, 32, d.main ? c.gold : c.muted), 0.8);
          const spots: P3[] = [];
          for (const r of [plane.reach() * 0.85, -plane.reach() * 0.85, plane.reach() * 0.55, -plane.reach() * 0.55]) for (const off of [0.32, -0.32]) {
            const q: Vec2 = [d.u[0] * r - d.u[1] * off, d.u[1] * r + d.u[0] * off];
            if (plane.inside(q, 0.45)) spots.push(plane.pv(q));
          }
          return dodge(lab, spots.length ? spots : [plane.p(0.5, 0.5)], () => [...arrows.map((a) => {
            const q = a.get_end();
            return { x0: q[0] - 0.25, x1: q[0] + 0.25, y0: q[1] - 0.25, y1: q[1] + 0.25 };
          })]);
        });

        // ---- panel
        const X0 = PANEL.x0 + 0.12;
        const at = (m: any, y: number) => m.move_to([X0 + m.width / 2, y, 0]);
        const mat = new LiveMatrix(() => A, { decimals: 1, font_size: 40 });
        mat.name = 'matrix';
        const top = at(VGroup(tex('A =', 44), mat).arrange(RIGHT, { buff: 0.25 }), 2.85);
        mat.update(0);
        const pw = at(VGroup(tex('A^n \\vec v', 40), readout('n =', () => Math.round(n.get_value()), { decimals: 0, font_size: 40 })).arrange(RIGHT, { buff: 0.5 }), 1.65);
        pw.name = 'power_readout';
        const note = rescale ? at(tex('\\text{(lengths rescaled: only directions)}', 26, c.muted), 1.1) : null;
        const slider: any = new Slider(n, { x_range: [0, steps], length: 2.8, color: c.accent, track_color: c.faint, stroke_width: 7, knob_radius: 0.14, label: 'n', decimals: 0, font_size: 34 });
        const ts = slider.track.get_start();
        slider.shift([PANEL.x0 + 0.85 - ts[0], -3.4 - ts[1], 0]);
        slider.name = 'n_slider';
        this.slider = slider;
        let why: any;
        if (e.kind === 'distinct' && dirs[0].main) {
          const ratio = Math.abs(dirs[1].l / dirs[0].l);
          why = VGroup(
            tex(`\\text{each step the } \\lambda_2 \\text{ part shrinks}`, 30, c.ink),
            tex(`\\text{by } |\\lambda_2 / \\lambda_1| = ${fmt(ratio)}\\text{, so } A^n\\vec v`, 30, c.ink),
            tex(`\\text{lines up with the } \\lambda_1 \\text{ line}`, 30, c.gold),
          ).arrange(DOWN, { buff: 0.1, aligned_edge: LEFT });
        } else if (e.kind === 'complex') {
          why = VGroup(tex('\\text{complex } \\lambda\\text{: no direction wins,}', 30, c.coral), tex('\\text{the vectors keep turning}', 30, c.coral)).arrange(DOWN, { buff: 0.1, aligned_edge: LEFT });
        } else if (e.kind === 'repeated') {
          why = VGroup(tex('\\text{one eigenline: vectors creep}', 30, c.ink), tex('\\text{towards it, but no eigenbasis}', 30, c.ink)).arrange(DOWN, { buff: 0.1, aligned_edge: LEFT });
        } else if (e.kind === 'scalar') {
          why = tex('\\text{every direction is an eigenvector}', 30, c.gold);
        } else {
          why = VGroup(tex('|\\lambda_1| = |\\lambda_2|\\text{: no single}', 30, c.ink), tex('\\text{direction wins}', 30, c.ink)).arrange(DOWN, { buff: 0.1, aligned_edge: LEFT });
        }
        at(why, 0.35);
        why.name = 'why';

        // ---- the story
        this.play(Create(grid.group, { lag_ratio: 0.02 }), FadeIn(top), { run_time: 1.2 });
        pw.update(0);
        this.play(...arrows.map((a) => GrowArrow(a)), FadeIn(pw), ...(note ? [FadeIn(note)] : []), { run_time: 1 });
        slider.update(0);
        this.play(FadeIn(slider), { run_time: 0.5 });
        this.add(trails, seeds);
        this.bring_to_front(...arrows);
        for (let k = 1; k <= steps; k++) this.play(n.animate.set_value(k), { run_time: k <= 2 ? 1 : 0.7, rate_func: smooth });
        if (lines.length) this.play(...lines.map((l) => Create(l)), ...line_labels.map((l) => FadeIn(l)), { run_time: 1 });
        this.play(FadeIn(why), { run_time: 1 });
        this.wait(0.8);
        let formula: any = null;
        if (p.show_eigenbasis && e.kind === 'distinct') {
          const q1 = dirs[0].u, q2 = dirs[1].u, l1 = dirs[0].l, l2 = dirs[1].l;
          const P = from_cols(q1, q2);
          formula = VGroup(
            tex('\\text{in the eigenbasis } \\vec q_1, \\vec q_2\\text{:}', 30, c.ink),
            tex('A = P D P^{-1}', 34, c.ink),
            tex('A^n = P D^n P^{-1}', 34, c.ink),
            tex(`D^n = \\begin{bmatrix} ${fmt(l1)}^n & 0 \\\\ 0 & ${fmt(l2)}^n \\end{bmatrix}`, 34, c.gold),
          ).arrange(DOWN, { buff: 0.16, aligned_edge: LEFT });
          at(formula, -1.72);
          formula.name = 'eigenbasis_formula';
          // the grid of the eigenbasis after n steps: P Dⁿ (between whole steps, entry by entry)
          const grid_at = (t: number): Mat2 => {
            const T = rescale ? 0 : clamp(t, 0, steps), k = Math.floor(T), f = T - k;
            const d1 = l1 ** k + (l1 ** (k + 1) - l1 ** k) * f, d2 = l2 ** k + (l2 ** (k + 1) - l2 ** k) * f;
            return from_cols([q1[0] * d1, q1[1] * d1], [q2[0] * d2, q2[1] * d2]);
          };
          this.play(FadeOut(trails), FadeOut(why), n.animate.set_value(0), { run_time: 1 });
          this.play(G.morph([[1, 0], [0, 1]], P, { run_time: 2 }), Write(formula.submobjects[0]), { run_time: 2 });
          this.play(Write(formula.submobjects[1]), Write(formula.submobjects[2]), { run_time: 1.2 });
          // from now on the eigen-grid follows n: A only stretches q1 by λ1 and q2 by λ2
          G.t[0].add_updater(() => G.set(grid_at(n.get_value())));
          this.play(n.animate.set_value(1), FadeIn(formula.submobjects[3]), { run_time: 2 });
          this.wait(0.5);
          this.play(n.animate.set_value(steps), { run_time: Math.min(4, 0.5 * steps), rate_func: smooth });
          this.play(FadeIn(trails), FadeIn(why), { run_time: 0.8 });
          this.add(formula);
        }
        this.add(fan_g, eigenlines, VGroup(...line_labels));
        this.wait(1.5);
      }
    }
    return new MatrixPower();
  },
  explore: (scene: any, ui) => {
    const s = scene.slider, plane: Plane = scene.plane;
    s.attach(ui, { step: 1, label: 'the power n' });
    ui.add_handle({
      tracker: scene.phase,
      from_value: (ph: number) => plane.pv(from_angle(ph + 0.35, scene.r0)),
      to_value: (pt: P3) => {
        const q = plane.to_math(pt), a = Math.atan2(q[1], q[0]) - 0.35, cur = scene.phase.get_value();
        return cur + Math.atan2(Math.sin(a - cur), Math.cos(a - cur));
      },
      step: Math.PI / 60,
      radius: 0.4,
      label: 'the start of the first vector (turns the whole fan)',
    });
  },
});
