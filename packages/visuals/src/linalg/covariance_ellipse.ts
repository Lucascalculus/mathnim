// The shape of data: a seeded 2D cloud, its mean, the sign of
// (x - x̄)(y - ȳ) for every point (why covariance is positive or negative),
// the covariance matrix Σ, and the 1σ and 2σ ellipses (axes along Σ's
// eigenvectors, half-lengths k·√λ). Explore: drag the ringed points; the mean,
// Σ and the ellipses follow live.
import { Create, Dot, FadeIn, LaggedStart, Scene, VGroup, VMobject, ValueTracker, Write, always_redraw, interpolate_color, DOWN, LEFT, RIGHT } from 'manim-web';
import { palette } from '../theme';
import { define_visual } from '../visual';
import { LiveMatrix, PANEL, STAGE, backed, clamp, dashed, fit_plane, lattice_segments, live_row, path, plane_axes, readout, segment_points, tex, type P3, type Plane } from './kit';
import { cloud2, correlation_of, cov2, from_angle, inv2, sym_eig2, type Mat2, type Vec2 } from './math';

export interface CovarianceEllipseParams extends Record<string, unknown> {
  correlation: number;
  spread: number;
  aspect: number;
  n: number;
  seed: number;
}

/** Points of the k-sigma ellipse of a covariance matrix around a mean. */
export function sigma_ellipse(mean: Vec2, cov: Mat2, k: number, samples = 96): Vec2[] {
  const { values: [l1, l2], vectors: [q1, q2] } = sym_eig2(cov);
  const a = k * Math.sqrt(Math.max(0, l1)), b = k * Math.sqrt(Math.max(0, l2));
  return Array.from({ length: samples + 1 }, (_, i) => {
    const t = (2 * Math.PI * i) / samples, ca = a * Math.cos(t), sb = b * Math.sin(t);
    return [mean[0] + ca * q1[0] + sb * q2[0], mean[1] + ca * q1[1] + sb * q2[1]];
  });
}
/** Squared Mahalanobis distance of p from the mean. */
export function mahalanobis2(p: Vec2, mean: Vec2, cov: Mat2): number {
  const ci = inv2(cov);
  if (!ci) return Infinity;
  const d: Vec2 = [p[0] - mean[0], p[1] - mean[1]];
  return d[0] * (ci[0][0] * d[0] + ci[0][1] * d[1]) + d[1] * (ci[1][0] * d[0] + ci[1][1] * d[1]);
}
/**
 * Up to k well spread points to offer as handles: in whitened coordinates
 * (where the cloud is round), the farthest point in each of k angular sectors,
 * so they sit all around the ellipse even for a thin cloud.
 */
export function handle_picks(points: Vec2[], k: number): number[] {
  const { mean, cov } = cov2(points);
  const { values: [l1, l2], vectors: [q1, q2] } = sym_eig2(cov);
  const white = points.map((p): Vec2 => {
    const d: Vec2 = [p[0] - mean[0], p[1] - mean[1]];
    return [(d[0] * q1[0] + d[1] * q1[1]) / Math.sqrt(Math.max(1e-9, l1)), (d[0] * q2[0] + d[1] * q2[1]) / Math.sqrt(Math.max(1e-9, l2))];
  });
  const out: number[] = [];
  for (let s = 0; s < k; s++) {
    let best = -1, bd = -1;
    white.forEach((p, i) => {
      const a = (Math.atan2(p[1], p[0]) + 2 * Math.PI) % (2 * Math.PI);
      if (Math.floor((a / (2 * Math.PI)) * k) !== s) return;
      const d = Math.hypot(p[0], p[1]);
      if (d > bd) (bd = d), (best = i);
    });
    if (best >= 0) out.push(best);
  }
  return out;
}

export const covariance_ellipse = define_visual<CovarianceEllipseParams>({
  name: 'covariance_ellipse',
  summary: "The shape of 2D data: a seeded cloud, its mean, points coloured by the sign of (x − x̄)(y − ȳ), the covariance matrix Σ live, and the 1σ/2σ ellipses along Σ's eigenvectors. Student drags points.",
  topics: ['statistics', 'covariance', 'correlation', 'variance', 'linear algebra', 'pca'],
  params: {
    correlation: { type: 'number', min: -0.99, max: 0.99, default: 0.7, doc: 'correlation of x and y (the sample correlation is exactly this)' },
    spread: { type: 'number', min: 0.3, max: 2, default: 1, doc: 'standard deviation of x' },
    aspect: { type: 'number', min: 0.3, max: 3, default: 0.8, doc: 'standard deviation of y divided by that of x' },
    n: { type: 'integer', min: 10, max: 300, default: 80, doc: 'number of points' },
    seed: { type: 'integer', min: 1, max: 9999, default: 7, doc: 'random seed (same seed, same cloud)' },
  },
  examples: [{}, { correlation: 0, aspect: 1, n: 120 }, { correlation: 0.97, spread: 1.4, n: 60 }, { correlation: -0.6, spread: 0.6, aspect: 2, n: 200, seed: 3 }],
  ids: ['points', 'mean', 'quadrants', 'sigma_1', 'sigma_2', 'principal_axes', 'cov_matrix', 'mean_readout', 'cov_readout', 'corr_readout', 'cov_formula', 'counts', 'draggable'],
  scene: (p) => {
    const data = cloud2({ n: p.n, correlation: p.correlation, spread: p.spread, aspect: p.aspect, seed: p.seed });
    class CovarianceEllipse extends Scene {
      tint = ValueTracker(0);
      plane!: Plane;
      dots: any[] = [];
      picks: number[] = [];
      override construct() {
        const c = palette();
        const { tint } = this;
        this.track(tint);
        let ext = 1;
        for (const q of data) ext = Math.max(ext, Math.abs(q[0]), Math.abs(q[1]));
        const plane = fit_plane(STAGE, [-2.5, 0], ext + 0.35, 1.2);
        this.plane = plane;
        const bg = path(c.faint, 1.5, 1);
        bg.points = segment_points(lattice_segments(plane, [[1, 0], [0, 1]], 'exclude', plane.unit < 0.6 ? 2 : 1));
        const axes = plane_axes(plane, c.muted, 2, 0.7);
        const r = p.n > 150 ? 0.05 : 0.065;
        const dots = data.map((q) => Dot(plane.pv(q), { radius: r, color: c.accent, fill_opacity: 0.9 }));
        this.dots = dots;
        const points = VGroup(...dots);
        points.name = 'points';
        // statistics of the dots as they are now (cached on the group, so snapshots stay consistent)
        const stats = (): { mean: Vec2; cov: Mat2 } => {
          const g: any = points;
          const key = dots.map((d) => { const q = d.get_center(); return `${q[0].toFixed(4)},${q[1].toFixed(4)}`; }).join(';');
          if (g._key !== key) {
            g._key = key;
            g._stats = cov2(dots.map((d) => plane.to_math(d.get_center())));
          }
          return g._stats;
        };
        // colour by the sign of (x - x̄)(y - ȳ)
        points.add_updater(() => {
          const { mean } = stats(), k = Math.round(tint.get_value() * 20) / 20;
          for (const d of dots) {
            const q = plane.to_math(d.get_center()), s = (q[0] - mean[0]) * (q[1] - mean[1]);
            const target = s >= 0 ? c.gold : c.purple;
            const key = `${target}${k}`;
            if (d._ck === key) continue;
            d._ck = key;
            d.set_fill(k >= 1 ? target : interpolate_color(c.accent as any, target as any, k));
          }
        });
        const mean_mark = always_redraw(() => {
          const q = plane.pv(stats().mean), s = 0.16;
          const vm = path(c.ink, 4, 1);
          vm.points = segment_points([[[q[0] - s, q[1] - s, 0], [q[0] + s, q[1] + s, 0]], [[q[0] - s, q[1] + s, 0], [q[0] + s, q[1] - s, 0]]]);
          return vm;
        });
        mean_mark.name = 'mean';
        const quadrants = always_redraw(() => {
          const q = plane.pv(stats().mean), b = plane.box;
          return VGroup(dashed([b.x0 + 0.05, q[1], 0], [b.x1 - 0.05, q[1], 0], c.muted, 2, 0.1, 0.8), dashed([q[0], b.y0 + 0.05, 0], [q[0], b.y1 - 0.05, 0], c.muted, 2, 0.1, 0.8));
        });
        quadrants.name = 'quadrants';
        const ellipse = (k: number, color: string, width: number) => always_redraw(() => {
          const { mean, cov } = stats();
          const vm = VMobject({ stroke_color: color, stroke_width: width, fill_opacity: 0 });
          vm.set_points_smoothly(sigma_ellipse(mean, cov, k).map((q) => plane.pv(q)));
          return vm;
        });
        const e1 = ellipse(1, c.accent, 4), e2 = ellipse(2, c.accent, 2.5);
        e1.name = 'sigma_1';
        e2.name = 'sigma_2';
        const principal = always_redraw(() => {
          const { mean, cov } = stats(), { values: [l1, l2], vectors: [q1, q2] } = sym_eig2(cov);
          const a = 2 * Math.sqrt(Math.max(0, l1)), b = 2 * Math.sqrt(Math.max(0, l2));
          const P = (u: Vec2, s: number): P3 => plane.pv([mean[0] + u[0] * s, mean[1] + u[1] * s]);
          return VGroup(dashed(P(q1, -a), P(q1, a), c.gold, 3, 0.12, 0.9), dashed(P(q2, -b), P(q2, b), c.teal, 3, 0.12, 0.9));
        });
        principal.name = 'principal_axes';
        const lab = (k: number) => {
          const t = backed(tex(`${k}\\sigma`, 32, c.accent), 0.8);
          t.add_updater((m: any) => {
            // just outside the ellipse, a little way round from the end of its long axis
            const { mean, cov } = stats(), { values: [l1, l2], vectors: [q1, q2] } = sym_eig2(cov);
            const a = k * Math.sqrt(Math.max(0, l1)), b = k * Math.sqrt(Math.max(0, l2)), t0 = 0.45;
            const e: Vec2 = [mean[0] + a * Math.cos(t0) * q1[0] + b * Math.sin(t0) * q2[0], mean[1] + a * Math.cos(t0) * q1[1] + b * Math.sin(t0) * q2[1]];
            const nrm: Vec2 = [b * Math.cos(t0) * q1[0] + a * Math.sin(t0) * q2[0], b * Math.cos(t0) * q1[1] + a * Math.sin(t0) * q2[1]];
            const len = Math.hypot(nrm[0], nrm[1]) || 1, off = (m.height / 2 + 0.12) / plane.unit + 0.08;
            m.move_to(plane.pv([e[0] + (nrm[0] / len) * off, e[1] + (nrm[1] / len) * off]));
          });
          return t;
        };
        const l1s = lab(1), l2s = lab(2);
        // draggable points, ringed
        const picks = handle_picks(data, Math.min(6, p.n));
        this.picks = picks;
        const rings = always_redraw(() => VGroup(...picks.map((i) => {
          const q = dots[i].get_center(), rr = 0.17;
          const vm = path(c.ink, 2.5, 0.9);
          vm.set_points_as_corners(Array.from({ length: 21 }, (_, k) => [q[0] + rr * Math.cos((k * Math.PI) / 10), q[1] + rr * Math.sin((k * Math.PI) / 10), 0]));
          return vm;
        })));
        rings.name = 'draggable';

        // ---- panel
        const X0 = PANEL.x0 + 0.12;
        const at = (m: any, y: number) => m.move_to([X0 + m.width / 2, y, 0]);
        const mat = new LiveMatrix(() => stats().cov, { decimals: 2, font_size: 36 });
        mat.name = 'cov_matrix';
        const top = at(VGroup(tex('\\Sigma =', 44), mat).arrange(RIGHT, { buff: 0.25 }), 2.85);
        mat.update(0);
        const mean_ro = live_row([
          readout('\\bar x =', () => stats().mean[0], { decimals: 2, font_size: 36 }),
          readout('\\bar y =', () => stats().mean[1], { decimals: 2, font_size: 36 }),
        ], [X0, 1.6], 0.5);
        mean_ro.name = 'mean_readout';
        const sign_col = (v: number) => (v >= 0 ? c.gold : c.purple);
        const cov_ro = at(readout('\\operatorname{cov}(x, y) =', () => stats().cov[0][1], { decimals: 2, font_size: 36, color_of: sign_col }), 0.85);
        cov_ro.name = 'cov_readout';
        const corr_ro = at(readout('r =', () => correlation_of(stats().cov), { decimals: 2, font_size: 36, color_of: sign_col }), 0.2);
        corr_ro.name = 'corr_readout';
        const formula = at(tex('\\operatorname{cov} = \\tfrac{1}{n-1}\\sum (x_i - \\bar x)(y_i - \\bar y)', 32), -0.6);
        formula.name = 'cov_formula';
        const legend = at(VGroup(tex('\\text{gold: product} > 0', 30, c.gold), tex('\\text{purple: product} < 0', 30, c.purple)).arrange(DOWN, { buff: 0.08, aligned_edge: LEFT }), -1.45);
        const inside = (k: number) => () => {
          const { mean, cov } = stats();
          return dots.filter((d) => mahalanobis2(plane.to_math(d.get_center()), mean, cov) <= k * k).length;
        };
        const counts = VGroup(
          readout(`\\text{inside } 1\\sigma\\text{:}`, inside(1), { decimals: 0, font_size: 32, color: c.accent }),
          readout(`\\text{inside } 2\\sigma\\text{:}`, inside(2), { decimals: 0, font_size: 32, color: c.accent }),
        ).arrange(DOWN, { buff: 0.12, aligned_edge: LEFT });
        const counts_note = tex(`\\text{of } ${p.n}\\ \\ (\\text{Gaussian: } 39\\%,\\ 86\\%)`, 26, c.muted);
        at(counts, -2.7);
        at(counts_note, -3.55);
        const counts_g = VGroup(counts, counts_note);
        counts_g.name = 'counts';

        // ---- the story
        this.add(bg, axes);
        this.play(LaggedStart(...dots.map((d) => FadeIn(d, { scale: 0.3 })), { lag_ratio: 1.5 / Math.max(1, dots.length) }), { run_time: 2 });
        this.add(points);
        mean_ro.update(0);
        this.play(FadeIn(mean_mark, { scale: 1.6 }), FadeIn(mean_ro), { run_time: 1 });
        this.play(Create(quadrants), tint.animate.set_value(1), FadeIn(legend), { run_time: 1.5 });
        cov_ro.update(0);
        corr_ro.update(0);
        this.play(Write(formula), FadeIn(cov_ro), FadeIn(corr_ro), { run_time: 1.5 });
        this.play(FadeIn(top), { run_time: 1 });
        this.wait(0.6);
        this.play(Create(e1), FadeIn(l1s), { run_time: 1.2 });
        this.play(Create(e2), FadeIn(l2s), { run_time: 1.2 });
        this.bring_to_front(l1s, l2s);
        this.play(Create(principal), { run_time: 1 });
        counts.update(0);
        this.play(FadeIn(counts_g), FadeIn(rings), { run_time: 1 });
        this.bring_to_front(points, rings, mean_mark, l1s, l2s);
        this.wait(1.5);
      }
    }
    return new CovarianceEllipse();
  },
  explore: (scene: any, ui) => {
    const plane: Plane = scene.plane;
    const b = plane.box;
    for (const i of scene.picks) {
      const d = scene.dots[i];
      ui.add_handle({
        mobject: d,
        get: () => d.get_center(),
        set: (pt: P3) => d.move_to([clamp(pt[0], b.x0 + 0.15, b.x1 - 0.15), clamp(pt[1], b.y0 + 0.15, b.y1 - 0.15), 0]),
        step: plane.unit * 0.1,
        radius: 0.3,
        highlight: false,
        label: `data point ${i + 1}`,
      });
    }
  },
});
