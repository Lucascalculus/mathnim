// Dimensionality reduction: a seeded, elongated 3D point cloud in a
// ThreeDScene. The camera orbits to show its shape, PCA finds three axes (the
// eigenvectors of the 3x3 covariance, by Jacobi), the first two span a plane,
// every point drops onto it, and the camera turns to look straight at the
// plane: the 2D picture that keeps most of the variance.
// Explore: turn and tilt the camera, slide between the cloud and its projection.
import { Cone, Dot, Line3D, FadeIn, LaggedStart, RoundedRectangle, ThreeDScene, ThreeDVMobject, VGroup, VMobject, ValueTracker, Write, smooth, DOWN, LEFT, UP, DEGREES } from 'manim-web';
import { Slider } from 'manim-web/ext/widgets';
import { palette } from '../theme';
import { define_visual } from '../visual';
import { readout, segment_points, tex, words, type P3 } from './kit';
import { pca, project_onto, rotation3, white_noise } from './math';

export interface Pca3dParams extends Record<string, unknown> {
  n: number;
  elongation: number;
  flatness: number;
  seed: number;
}

const S1 = 1.1;
/** Points are kept within this many standard deviations (a trimmed Gaussian), so the plane can hold them all. */
const TRIM = 2.3;

/** Camera angles (phi, theta, gamma) that look straight along `normal` with `across` horizontal on screen. */
export function view_along(normal: number[], across: number[]): { phi: number; theta: number; gamma: number } {
  let n = normal;
  if (n[2] < 0) n = n.map((x) => -x);
  const phi = Math.acos(Math.max(-1, Math.min(1, n[2]))), theta = Math.atan2(n[1], n[0]);
  // screen direction of `across` for gamma = 0: R = Rx(-phi) Rz(-theta - 90°)
  const a = -theta - Math.PI / 2, ca = Math.cos(a), sa = Math.sin(a);
  const x1 = ca * across[0] - sa * across[1], y1 = sa * across[0] + ca * across[1], z1 = across[2];
  const cp = Math.cos(-phi), sp = Math.sin(-phi);
  const y2 = cp * y1 - sp * z1;
  const alpha = Math.atan2(y2, x1);
  return { phi, theta, gamma: -alpha };
}

/** A seeded Gaussian cloud, pulled in to at most TRIM standard deviations (whitened norm), scaled and rotated. */
export function trimmed_cloud(n: number, sigmas: [number, number, number], seed: number, R: number[][]): number[][] {
  return white_noise(n, 3, seed).map((z) => {
    const r = Math.hypot(z[0], z[1], z[2]), k = r > TRIM ? TRIM / r : 1;
    const s = [z[0] * k * sigmas[0], z[1] * k * sigmas[1], z[2] * k * sigmas[2]];
    return [0, 1, 2].map((i) => R[i][0] * s[0] + R[i][1] * s[1] + R[i][2] * s[2]);
  });
}

export const pca_3d = define_visual<Pca3dParams>({
  name: 'pca_3d',
  summary: 'PCA in 3D: an elongated point cloud, camera orbit, the three principal axes with their share of variance, points dropped onto the PC1-PC2 plane, camera looking straight at it (variance kept). Student turns/tilts the camera and slides the projection.',
  topics: ['pca', 'principal component analysis', 'dimensionality reduction', 'statistics', 'eigenvectors', 'linear algebra', '3d'],
  params: {
    n: { type: 'integer', min: 30, max: 250, default: 120, doc: 'number of points' },
    elongation: { type: 'number', min: 0.2, max: 1, default: 0.55, doc: 'spread along the 2nd axis relative to the 1st' },
    flatness: { type: 'number', min: 0.03, max: 1, default: 0.18, doc: 'spread along the 3rd axis relative to the 1st (small = a flat pancake that a plane captures well; 1 = no good plane)' },
    seed: { type: 'integer', min: 1, max: 9999, default: 5, doc: 'random seed (same seed, same cloud)' },
  },
  examples: [{}, { flatness: 0.05, elongation: 0.8, n: 200 }, { flatness: 0.9, elongation: 0.95, n: 80, seed: 2 }, { flatness: 0.3, elongation: 0.25, n: 60 }],
  ids: ['points', 'pc_axes', 'plane', 'drops', 'variance_bars', 'kept_readout', 'title', 'turn_slider', 'tilt_slider', 'project_slider'],
  scene: (p) => {
    const R = rotation3(0.75, -0.5, 0.65);
    const data = trimmed_cloud(p.n, [S1, S1 * p.elongation, S1 * p.flatness], p.seed, R);
    const P = pca(data);
    const [c1, c2, c3] = P.components;
    const proj = data.map((q) => project_onto(q, P.mean, [c1, c2]));
    const view = view_along(c3, c1);
    class Pca3d extends ThreeDScene {
      s = ValueTracker(0);
      sliders: any[] = [];
      override construct() {
        const c = palette();
        const cam: any = this.camera;
        cam.should_apply_shading = false;
        const { s } = this;
        s.name = 'projection';
        this.track(s);
        this.set_camera_orientation({ phi: 68 * DEGREES, theta: -50 * DEGREES, zoom: 1.15 });

        // ---- the cloud (flat dots that face the camera, depth sorted, dimmer when far)
        const dots = data.map((q) => {
          const d: any = Dot([q[0], q[1], q[2]], { radius: 0.06, color: c.accent, fill_opacity: 0.9 });
          d.shade_in_3d = true;
          return d;
        });
        const points = VGroup(...dots);
        points.name = 'points';
        points.add_updater((g: any) => {
          const t = s.get_value(), M = cam.generate_rotation_matrix();
          // only when the projection or the view changed (the key lives on the group, so snapshots stay consistent)
          const key = `${t.toFixed(4)}|${M[2].map((x: number) => x.toFixed(3)).join(',')}`;
          if (g._key === key) return;
          g._key = key;
          dots.forEach((d: any, i) => {
            const a = data[i], b = proj[i];
            const q: P3 = [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
            d.move_to(q);
            const depth = M[2][0] * q[0] + M[2][1] * q[1] + M[2][2] * q[2];
            const k = Math.round(Math.min(1, Math.max(0.35, 0.68 + depth * 0.14)) * 20) / 20;
            if (d._k !== k) {
              d.set_fill({ opacity: k });
              d._k = k;
            }
          });
        });
        // ---- principal axes, 2σ long (at least visible)
        // web: Arrow3D's cone uses the default surface resolution (about 1000 faces); a low-resolution cone is enough here
        const axis = (u: number[], sd: number, color: string) => {
          const L = Math.max(0.45, 2 * sd), h = 0.24;
          const end = P.mean.map((x, i) => x + u[i] * L) as P3, base = P.mean.map((x, i) => x + u[i] * (L - h)) as P3;
          const shaft = Line3D({ start: P.mean, end: base, thickness: 0.022, color, resolution: [1, 8] });
          const tip: any = Cone({ base_radius: 0.07, height: h, direction: u, resolution: [1, 10], fill_color: color, fill_opacity: 1, stroke_width: 0, checkerboard_colors: false });
          tip.shift(end);
          return VGroup(shaft, tip);
        };
        const sd = P.values.map((v) => Math.sqrt(v));
        const pc_axes = VGroup(axis(c1, sd[0], c.gold), axis(c2, sd[1], c.teal), axis(c3, sd[2], c.coral));
        pc_axes.name = 'pc_axes';
        // ---- the plane of PC1 and PC2, as tiles (so the depth sort works)
        const tiles: any[] = [];
        // big enough to hold every projected point
        const along = (u: number[]) => Math.max(...proj.map((q) => Math.abs(q.reduce((acc, x, k) => acc + (x - P.mean[k]) * u[k], 0))));
        const A = Math.max(2 * sd[0], along(c1)) + 0.25, B = Math.max(2 * sd[1], 0.5 * sd[0], along(c2)) + 0.25, K = 6;
        for (let i = 0; i < K; i++)
          for (let j = 0; j < K; j++) {
            const corner = (u: number, v: number) => P.mean.map((m, k) => m + c1[k] * (-A + (2 * A * u) / K) + c2[k] * (-B + (2 * B * v) / K)) as P3;
            const t: any = ThreeDVMobject({ fill_color: c.accent, fill_opacity: 0.16, stroke_color: c.accent, stroke_width: 0.8, stroke_opacity: 0.45 });
            t.set_points_as_corners([corner(i, j), corner(i + 1, j), corner(i + 1, j + 1), corner(i, j + 1), corner(i, j)]);
            tiles.push(t);
          }
        const plane = VGroup(...tiles);
        plane.name = 'plane';
        // ---- drop lines while projecting
        const drops = VMobject({ stroke_color: c.muted, stroke_width: 1.2, stroke_opacity: 0.55, fill_opacity: 0 });
        drops.add_updater((m: any) => {
          const t = s.get_value();
          if (m._t === t) return;
          m._t = t;
          const k = t > 0.001 && t < 0.999 ? 1 : 0;
          const segs = data.map((a, i) => {
            const b = proj[i], q: P3 = [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
            return [q, b as P3] as [P3, P3];
          });
          m.points = segment_points(segs);
          m.set_stroke({ opacity: 0.55 * k });
        });
        drops.name = 'drops';

        // ---- fixed-in-frame overlays
        const title = VGroup(words('3D data', 36, c.ink), tex('\\to\\ \\text{the best plane}', 36, c.ink)).arrange(DOWN, { buff: 0.12, aligned_edge: LEFT });
        title.move_to([-6.85 + title.width / 2, 3.35, 0]);
        title.name = 'title';
        // variance bars: share of each principal axis
        const colors = [c.gold, c.teal, c.coral];
        const BX = 4.55, BW = 0.62, BH = 2.3, BY = -0.35;
        const bars = VGroup();
        P.explained.forEach((f, i) => {
          const h = Math.max(0.02, BH * f), x = BX + i * (BW + 0.25);
          const r = RoundedRectangle({ width: BW, height: h, corner_radius: Math.min(0.08, h / 2), fill_color: colors[i], fill_opacity: 0.85, stroke_width: 0 });
          r.move_to([x, BY + h / 2, 0]);
          const pct = tex(`${Math.round(f * 100)}\\%`, 28, colors[i]).next_to(r, UP, { buff: 0.1 });
          const lab = tex(`\\text{PC}_{${i + 1}}`, 28, colors[i]).move_to([x, BY - 0.3, 0]);
          bars.add(r, pct, lab);
        });
        const bars_title = words('share of variance', 28, c.muted).move_to([BX + BW + 0.25, BY + BH + 0.75, 0]);
        const variance_bars = VGroup(bars_title, bars);
        variance_bars.name = 'variance_bars';
        const kept = VGroup(
          tex(`\\text{plane keeps } ${Math.round((P.explained[0] + P.explained[1]) * 100)}\\%`, 32, c.ink),
          tex(`\\text{loses } ${Math.round(P.explained[2] * 100)}\\%\\ (\\text{PC}_3)`, 28, c.coral),
        ).arrange(DOWN, { buff: 0.12, aligned_edge: LEFT });
        kept.move_to([BX - BW / 2 + kept.width / 2 - 0.05, BY - 1.1, 0]);
        kept.name = 'kept_readout';
        const sl = (tr: any, range: [number, number], label: string, y: number, name: string) => {
          const sd_: any = new Slider(tr, { x_range: range, length: 1.55, color: c.accent, track_color: c.faint, stroke_width: 6, knob_radius: 0.13, label, show_value: false, font_size: 28 });
          const t0 = sd_.track.get_start();
          sd_.shift([-5.15 - t0[0], y - t0[1], 0]);
          sd_.name = name;
          return sd_;
        };
        const turn = sl(cam.theta_tracker, [-Math.PI, Math.PI], '\\text{turn}', 1.25, 'turn_slider');
        const tilt = sl(cam.phi_tracker, [0, Math.PI / 2], '\\text{tilt}', 0.65, 'tilt_slider');
        const flat = sl(s, [0, 1], '\\text{project}', 0.05, 'project_slider');
        this.sliders = [turn, tilt, flat];
        const legend = VGroup(
          tex('\\text{PC}_1, \\text{PC}_2, \\text{PC}_3:', 28, c.muted),
          tex('\\text{eigenvectors of } \\Sigma_{3\\times 3}', 28, c.muted),
        ).arrange(DOWN, { buff: 0.08, aligned_edge: LEFT });
        legend.move_to([-6.85 + legend.width / 2, 2.25, 0]);

        // ---- the story
        this.add_fixed_orientation_mobjects(...dots);
        this.remove(...dots);
        this.add_fixed_in_frame_mobjects(title);
        this.play(Write(title), LaggedStart(...dots.map((d) => FadeIn(d)), { lag_ratio: 1.5 / dots.length }), { run_time: 2 });
        this.add(points);
        // orbit: the cloud is flat
        this.play(cam.theta_tracker.animate.set_value(-50 * DEGREES + 70 * DEGREES), cam.phi_tracker.animate.set_value(78 * DEGREES), { run_time: 4, rate_func: smooth });
        this.add_fixed_in_frame_mobjects(legend, variance_bars);
        this.play(...pc_axes.submobjects.map((a) => FadeIn(a)), FadeIn(legend), FadeIn(variance_bars), { run_time: 1.5 });
        this.play(FadeIn(plane), { run_time: 1.2 });
        this.add(drops);
        this.play(s.animate.set_value(1), { run_time: 3, rate_func: smooth });
        // look straight at the plane
        let th = view.theta;
        const cur = cam.theta_tracker.get_value();
        while (th - cur > Math.PI) th -= 2 * Math.PI;
        while (cur - th > Math.PI) th += 2 * Math.PI;
        this.move_camera({ phi: view.phi, theta: th, gamma: view.gamma, run_time: 3 });
        this.add_fixed_in_frame_mobjects(kept);
        this.play(FadeIn(kept), { run_time: 1 });
        this.wait(0.8);
        this.move_camera({ phi: 70 * DEGREES, theta: th + 40 * DEGREES, gamma: 0, run_time: 2.5 });
        // same view, angle back in (-π, π] so the turn slider can show it
        cam.theta_tracker.set_value(Math.atan2(Math.sin(th + 40 * DEGREES), Math.cos(th + 40 * DEGREES)));
        this.add_fixed_in_frame_mobjects(turn, tilt, flat);
        this.play(FadeIn(turn), FadeIn(tilt), FadeIn(flat), { run_time: 0.8 });
        this.add(pc_axes);
        this.wait(1.2);
      }
    }
    return new Pca3d();
  },
  explore: (scene: any, ui) => {
    const [turn, tilt, flat] = scene.sliders;
    turn.attach(ui, { step: 5 * DEGREES, label: 'turn the camera' });
    tilt.attach(ui, { step: 3 * DEGREES, label: 'tilt the camera' });
    flat.attach(ui, { step: 0.05, label: 'project onto the plane' });
  },
});

