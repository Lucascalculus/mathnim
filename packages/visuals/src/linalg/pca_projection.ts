// The first principal component as "the direction the data is most spread
// along": a line through the mean turns, every point is projected onto it,
// and the variance of the projections is plotted against the angle. The
// maximum is exactly at the top eigenvector of the covariance matrix (value
// λ1), and along + across always adds up to the total variance.
// Explore: turn the line yourself.
import { Create, Dot, FadeIn, Flash, GrowArrow, LaggedStart, NumberLine, Rectangle, Scene, VGroup, VMobject, ValueTracker, Write, always_redraw, linear, smooth, DOWN, LEFT, RIGHT } from 'manim-web';
import { palette } from '../theme';
import { define_visual } from '../visual';
import { LiveMatrix, PANEL, backed, clamp, clip_line, fit_plane, lattice_segments, live_arrow, path, plane_axes, readout, segment_points, tex, type Box, type P3, type Plane } from './kit';
import { cloud2, cov2, fmt, from_angle, projection_variance, sym_eig2, type Vec2 } from './math';

export interface PcaProjectionParams extends Record<string, unknown> {
  correlation: number;
  spread: number;
  aspect: number;
  n: number;
  seed: number;
}

const DATA_BOX: Box = { x0: -6.95, x1: -0.45, y0: -3.85, y1: 3.85 };
const PLOT = { x0: 0.95, x1: 6.45, y0: 0.35, y1: 3.2 };

/** Angle (radians, in [0, π)) of the top principal direction of 2D points. */
export function top_direction(points: Vec2[]): number {
  const { cov } = cov2(points);
  const q = sym_eig2(cov).vectors[0];
  return ((Math.atan2(q[1], q[0]) % Math.PI) + Math.PI) % Math.PI;
}

export const pca_projection = define_visual<PcaProjectionParams>({
  name: 'pca_projection',
  summary: "PCA as greatest spread: a line through the mean turns, points project onto it, the variance of the projections is plotted against the angle; the maximum λ₁ is exactly at Σ's top eigenvector, and along + across = total. Student turns the line.",
  topics: ['pca', 'principal component analysis', 'statistics', 'variance', 'eigenvectors', 'covariance', 'linear algebra'],
  params: {
    correlation: { type: 'number', min: -0.99, max: 0.99, default: 0.75, doc: 'correlation of x and y (exact in the sample)' },
    spread: { type: 'number', min: 0.3, max: 2, default: 1.1, doc: 'standard deviation of x' },
    aspect: { type: 'number', min: 0.3, max: 3, default: 0.8, doc: 'standard deviation of y divided by that of x' },
    n: { type: 'integer', min: 10, max: 200, default: 50, doc: 'number of points' },
    seed: { type: 'integer', min: 1, max: 9999, default: 11, doc: 'random seed (same seed, same cloud)' },
  },
  examples: [{}, { correlation: 0.05, aspect: 1, n: 80 }, { correlation: 0.98, spread: 1.3, n: 40 }, { correlation: -0.5, spread: 0.8, aspect: 1.8, n: 120, seed: 5 }],
  ids: ['points', 'mean', 'line', 'projections', 'plot', 'plot_dot', 'variance_bar', 'angle_readout', 'along_readout', 'across_readout', 'cov_matrix', 'top_eigenvector', 'conclusion'],
  scene: (p) => {
    const data = cloud2({ n: p.n, correlation: p.correlation, spread: p.spread, aspect: p.aspect, seed: p.seed });
    const { cov } = cov2(data);
    const { values: [L1, L2], vectors: [q1] } = sym_eig2(cov);
    const th1 = top_direction(data);
    const total = L1 + L2;
    class PcaProjection extends Scene {
      /** Angle of the top principal direction (radians, in [0, π)): where the spread is largest. */
      phi1 = th1;
      th = ValueTracker(0);
      trace = ValueTracker(0);
      plane!: Plane;
      override construct() {
        const c = palette();
        const { th, trace } = this;
        th.name = 'line_angle';
        this.track(th, trace);
        let ext = 1;
        for (const q of data) ext = Math.max(ext, Math.hypot(q[0], q[1]));
        const plane = fit_plane(DATA_BOX, [-3.7, 0], ext + 0.3, 1.25);
        this.plane = plane;
        const th0 = th1 - (75 * Math.PI) / 180;
        th.set_value(th0);
        trace.set_value(th0);
        const u = (): Vec2 => from_angle(th.get_value());
        const var_along = (a: number) => projection_variance(data, from_angle(a));

        const bg = path(c.faint, 1.5, 1);
        bg.points = segment_points(lattice_segments(plane, [[1, 0], [0, 1]], 'exclude', plane.unit < 0.6 ? 2 : 1));
        const axes = plane_axes(plane, c.muted, 2, 0.6);
        const r = p.n > 120 ? 0.05 : 0.065;
        const dots = data.map((q) => Dot(plane.pv(q), { radius: r, color: c.accent, fill_opacity: 0.9 }));
        const points = VGroup(...dots);
        points.name = 'points';
        const mean = Dot(plane.p(0, 0), { radius: 0.09, color: c.ink });
        mean.name = 'mean';
        const box = { x0: DATA_BOX.x0 + 0.05, x1: DATA_BOX.x1 - 0.05, y0: DATA_BOX.y0 + 0.05, y1: DATA_BOX.y1 - 0.05 };
        const line = always_redraw(() => {
          const d = u(), seg = clip_line(plane.p(0, 0), [d[0], d[1]], box)!;
          const l = path(c.gold, 4, 0.95);
          l.points = segment_points([seg]);
          return l;
        });
        line.name = 'line';
        // perpendicular drops and projected points
        const projections = always_redraw(() => {
          const d = u(), segs: [P3, P3][] = [], feet: P3[] = [];
          for (const q of data) {
            const t = q[0] * d[0] + q[1] * d[1], f: Vec2 = [t * d[0], t * d[1]];
            segs.push([plane.pv(q), plane.pv(f)]);
            feet.push(plane.pv(f));
          }
          const drops = path(c.muted, 1.5, 0.55);
          drops.points = segment_points(segs);
          const marks = VMobject({ fill_color: c.gold, fill_opacity: 0.95, stroke_width: 0 });
          const pts: number[] = [];
          for (const q of feet) {
            // small diamonds on the line
            const s = 0.06, corners = [[q[0] + s, q[1]], [q[0], q[1] + s], [q[0] - s, q[1]], [q[0], q[1] - s], [q[0] + s, q[1]]];
            for (let k = 0; k < 4; k++) {
              const a = corners[k], b = corners[k + 1];
              for (let j = 0; j < 4; j++) pts.push(a[0] + ((b[0] - a[0]) * j) / 3, a[1] + ((b[1] - a[1]) * j) / 3, 0);
            }
          }
          marks.points = Float64Array.from(pts);
          return VGroup(drops, marks);
        });
        projections.name = 'projections';
        const handle_r = Math.min(plane.reach() * 0.9, 3.2);
        const knob = always_redraw(() => Dot(plane.pv([u()[0] * handle_r, u()[1] * handle_r]), { radius: 0.12, color: c.gold }));

        // ---- the plot: variance of the projections against the angle (0..180°)
        const X = (a: number) => PLOT.x0 + ((((a % Math.PI) + Math.PI) % Math.PI) / Math.PI) * (PLOT.x1 - PLOT.x0);
        const vmax = L1 * 1.12;
        const Y = (v: number) => PLOT.y0 + (v / vmax) * (PLOT.y1 - PLOT.y0);
        const theta_axis: any = NumberLine({
          x_range: [0, 180, 45], length: PLOT.x1 - PLOT.x0, include_numbers: true, font_size: 24, color: c.muted, stroke_width: 2, include_tip: false,
          decimal_number_config: { num_decimal_places: 0, color: c.muted, unit: '^\\circ' },
        });
        theta_axis.shift([PLOT.x0 - theta_axis.number_to_point(0)[0], PLOT.y0 - theta_axis.number_to_point(0)[1], 0]);
        const ylab = tex('\\text{variance along}', 28, c.gold).rotate(Math.PI / 2).move_to([PLOT.x0 - 0.35, (PLOT.y0 + PLOT.y1) / 2 + 0.1, 0]);
        const yaxis = path(c.muted, 2, 0.7);
        yaxis.points = segment_points([[[PLOT.x0, PLOT.y0, 0], [PLOT.x0, PLOT.y1 + 0.1, 0]]]);
        const curve = always_redraw(() => {
          const a0 = th0, a1 = Math.max(th0 + 0.005, trace.get_value());
          const pieces: P3[][] = [[]];
          const N = Math.max(2, Math.ceil(((a1 - a0) / Math.PI) * 180));
          let last = -1;
          for (let k = 0; k <= N; k++) {
            const a = a0 + ((a1 - a0) * k) / N, x = X(a);
            if (last >= 0 && x < last - 0.5) pieces.push([]);
            pieces[pieces.length - 1].push([x, Y(var_along(a)), 0]);
            last = x;
          }
          const vm = VMobject({ stroke_color: c.gold, stroke_width: 4, fill_opacity: 0 });
          const pts: number[] = [];
          for (const pc of pieces) {
            if (pc.length < 2) continue;
            for (let k = 0; k + 1 < pc.length; k++) {
              const a = pc[k], b = pc[k + 1];
              for (let j = 0; j < 4; j++) pts.push(a[0] + ((b[0] - a[0]) * j) / 3, a[1] + ((b[1] - a[1]) * j) / 3, 0);
            }
          }
          vm.points = Float64Array.from(pts);
          if (!pts.length) vm.set_points_as_corners([[PLOT.x0, PLOT.y0, 0], [PLOT.x0, PLOT.y0, 0]]);
          return vm;
        });
        const plot = VGroup(theta_axis, yaxis, ylab, curve);
        plot.name = 'plot';
        const plot_dot = always_redraw(() => Dot([X(th.get_value()), Y(var_along(th.get_value())), 0], { radius: 0.1, color: c.gold }));
        plot_dot.name = 'plot_dot';
        // along + across = total, as one bar
        const BAR = { x0: PLOT.x0, x1: PLOT.x1, y: -0.45, h: 0.32 };
        const bar = always_redraw(() => {
          const a = var_along(th.get_value()), w = ((BAR.x1 - BAR.x0) * a) / total;
          const along = Rectangle({ width: Math.max(0.01, w), height: BAR.h, fill_color: c.gold, fill_opacity: 0.85, stroke_width: 0 }).move_to([BAR.x0 + w / 2, BAR.y, 0]);
          const across = Rectangle({ width: Math.max(0.01, BAR.x1 - BAR.x0 - w), height: BAR.h, fill_color: c.muted, fill_opacity: 0.45, stroke_width: 0 }).move_to([BAR.x0 + w + (BAR.x1 - BAR.x0 - w) / 2, BAR.y, 0]);
          return VGroup(along, across);
        });
        const bar_caption = tex(`\\text{along} + \\text{across} = \\text{total} = ${fmt(total)}`, 28, c.muted).move_to([(BAR.x0 + BAR.x1) / 2, BAR.y - 0.42, 0]);
        const variance_bar = VGroup(bar, bar_caption);
        variance_bar.name = 'variance_bar';
        const deg = (a: number) => ((((a % Math.PI) + Math.PI) % Math.PI) * 180) / Math.PI;
        const ang_ro = readout('\\theta =', () => deg(th.get_value()), { decimals: 1, font_size: 34, unit: '^\\circ' });
        const along_ro = readout('\\text{along} =', () => var_along(th.get_value()), { decimals: 2, font_size: 34, color: c.gold });
        const across_ro = readout('\\text{across} =', () => total - var_along(th.get_value()), { decimals: 2, font_size: 34, color: c.muted });
        ang_ro.name = 'angle_readout';
        along_ro.name = 'along_readout';
        across_ro.name = 'across_readout';
        const X0 = PLOT.x0 - 0.2;
        const at = (m: any, y: number) => m.move_to([X0 + m.width / 2, y, 0]);
        at(ang_ro, -1.45);
        at(along_ro, -2.05);
        at(across_ro, -2.65);
        const mat = new LiveMatrix(() => cov, { decimals: 2, font_size: 30 });
        mat.name = 'cov_matrix';
        const sig = VGroup(tex('\\Sigma =', 34), mat).arrange(RIGHT, { buff: 0.18 });
        sig.move_to([PLOT.x1 - sig.width / 2, -2.05, 0]);
        mat.update(0);
        // Σ's top eigenvector, drawn from the mean
        const ev = live_arrow(() => [plane.p(0, 0), plane.pv([q1[0] * 2 * Math.sqrt(L1), q1[1] * 2 * Math.sqrt(L1)])], c.coral, 6);
        ev.name = 'top_eigenvector';
        const conclusion = at(VGroup(
          tex(`\\text{max} = \\lambda_1 = ${fmt(L1)}\\text{, along the top}`, 30, c.coral),
          tex(`\\text{eigenvector of } \\Sigma \\text{ (min} = \\lambda_2 = ${fmt(L2)}\\text{)}`, 30, c.coral),
        ).arrange(DOWN, { buff: 0.1, aligned_edge: LEFT }), -3.45);
        conclusion.name = 'conclusion';
        const max_mark = VGroup(
          Dot([X(th1), Y(L1), 0], { radius: 0.08, color: c.coral }),
          backed(tex(`\\lambda_1`, 30, c.coral), 0.8).move_to([X(th1), Y(L1) + 0.32, 0]),
        );

        // ---- the story
        this.add(bg, axes);
        this.play(LaggedStart(...dots.map((d) => FadeIn(d, { scale: 0.3 })), { lag_ratio: 1.5 / Math.max(1, dots.length) }), { run_time: 1.8 });
        this.add(points);
        this.play(FadeIn(mean, { scale: 1.5 }), Create(line), { run_time: 1 });
        this.play(Create(projections), FadeIn(knob), { run_time: 1.2 });
        for (const m of [ang_ro, along_ro, across_ro]) m.update(0);
        this.play(Create(theta_axis), Create(yaxis), Write(ylab), FadeIn(bar), FadeIn(bar_caption), FadeIn(ang_ro), FadeIn(along_ro), FadeIn(across_ro), { run_time: 1.4 });
        this.add(curve, plot_dot);
        // turn the line half a turn: the curve of variance against angle
        this.play(th.animate.set_value(th0 + Math.PI), trace.animate.set_value(th0 + Math.PI), { run_time: 7, rate_func: linear });
        // back to the maximum
        this.play(th.animate.set_value(th1 + Math.PI), { run_time: 2, rate_func: smooth });
        this.play(Flash([X(th1), Y(L1), 0], { color: c.coral, flash_radius: 0.3 }), FadeIn(max_mark), FadeIn(sig), { run_time: 1 });
        this.play(GrowArrow(ev), { run_time: 1 });
        this.play(FadeIn(conclusion), { run_time: 1 });
        this.add(plot, variance_bar, VGroup(max_mark, sig));
        this.wait(1.5);
      }
    }
    return new PcaProjection();
  },
  explore: (scene: any, ui) => {
    const plane: Plane = scene.plane, th = scene.th;
    const R = Math.min(plane.reach() * 0.9, 3.2);
    ui.add_handle({
      tracker: th,
      from_value: (a: number) => plane.pv(from_angle(a, R)),
      to_value: (pt: P3) => {
        const q = plane.to_math(pt), a = Math.atan2(q[1], q[0]), cur = th.get_value();
        return cur + Math.atan2(Math.sin(a - cur), Math.cos(a - cur));
      },
      step: Math.PI / 90,
      radius: 0.45,
      label: 'the end of the projection line',
    });
    void clamp;
  },
});
