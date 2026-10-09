// Rotations have no real eigenvectors: starting from a matrix with two
// eigenlines, one entry is dragged until A turns every vector. The eigenlines
// swing together, merge and vanish; the direction field (arrow at x along Ax)
// starts to swirl; an orbit v, Av, A²v, ... circles the origin; and the
// eigenvalues become complex, λ = re ± i·im = |λ|e^{±iθ} (stretch |λ|, turn θ).
// Explore: drag î and ĵ into and out of a rotation.
import { Create, FadeIn, Flash, GrowArrow, Scene, VGroup, VMobject, Write, always_redraw, DOWN, LEFT, RIGHT } from 'manim-web';
import { palette } from '../theme';
import { define_visual } from '../visual';
import {
  LiveMatrix, MatrixTrackers, PANEL, STAGE, basis_arrows, basis_handles, basis_labels, clip_line, fit_plane, live_row, path, readout, segment_points, tex, transformed_grid,
  type P3, type Plane,
} from './kit';
import { apply2, det2, eig2, mat2, norm2, sym_eig2, symmetrize, trace2, unit2, type Mat2, type Vec2 } from './math';

export interface RotationNoEigenParams extends Record<string, unknown> {
  A: number[][];
  show_orbit: boolean;
}

const lerp2 = (a: Mat2, b: Mat2, t: number): Mat2 => [[a[0][0] + (b[0][0] - a[0][0]) * t, a[0][1] + (b[0][1] - a[0][1]) * t], [a[1][0] + (b[1][0] - a[1][0]) * t, a[1][1] + (b[1][1] - a[1][1]) * t]];
const disc2 = (m: Mat2) => trace2(m) ** 2 - 4 * det2(m);
/**
 * Where the story starts: a symmetric matrix with two clear eigenlines (A's
 * symmetric part, shifted to be positive definite and pulled apart), from
 * which a straight path leads to A without passing a singular matrix. Also the
 * point t on the path where the eigenlines merge (null when they never do).
 */
export function start_path(A: Mat2): { S: Mat2; merge: number | null } {
  const { values: [, m2], vectors: [q1, q2] } = sym_eig2(symmetrize(A));
  const s = Math.max(0.8 - m2, 0.3), g = 0.5;
  const sym = symmetrize(A);
  const S: Mat2 = [
    [sym[0][0] + s + g * (q1[0] * q1[0] - q2[0] * q2[0]), sym[0][1] + g * (q1[0] * q1[1] - q2[0] * q2[1])],
    [sym[1][0] + g * (q1[1] * q1[0] - q2[1] * q2[0]), sym[1][1] + s + g * (q1[1] * q1[1] - q2[1] * q2[1])],
  ];
  let merge: number | null = null;
  if (disc2(S) > 0 && disc2(A) < 0) {
    let lo = 0, hi = 1;
    for (let k = 0; k < 60; k++) {
      const mid = (lo + hi) / 2;
      if (disc2(lerp2(S, A, mid)) > 0) lo = mid;
      else hi = mid;
    }
    merge = (lo + hi) / 2;
  }
  return { S, merge };
}
/** Smallest |det| along the straight path from S to A (the path should stay invertible). */
export function min_det_on_path(S: Mat2, A: Mat2): number {
  let m = Infinity;
  for (let k = 0; k <= 100; k++) m = Math.min(m, Math.abs(det2(lerp2(S, A, k / 100))));
  return m;
}
/** A start vector whose orbit v, Av, A²v, ... makes about one turn inside a plane of the given reach. */
export function orbit_start(A: Mat2, reach: number): Vec2 {
  const e = eig2(A), dir = unit2([1, 0.25]);
  if (e.kind !== 'complex') return [dir[0] * 1.6, dir[1] * 1.6];
  const n = Math.min(13, Math.ceil((2 * Math.PI) / Math.max(0.2, e.theta)) + 1);
  const r = e.r > 1 ? Math.max(0.45, (0.8 * reach) / e.r ** (n - 1)) : 0.8 * reach;
  return [dir[0] * r, dir[1] * r];
}

/** Segments (shafts) and triangles (tips) of the direction field: at each lattice point x, a short arrow along Ax. */
export function field_points(plane: Plane, A: Mat2, len = 0.44, tip = 0.14): { shafts: Float64Array; tips: Float64Array } {
  const shafts: [P3, P3][] = [], tris: P3[][] = [];
  const b = plane.box;
  const m0 = plane.to_math([b.x0, b.y0]), m1 = plane.to_math([b.x1, b.y1]);
  const step = plane.unit < 0.55 ? 2 : 1;
  for (let x = Math.ceil(m0[0] / step) * step; x <= m1[0]; x += step)
    for (let y = Math.ceil(m0[1] / step) * step; y <= m1[1]; y += step) {
      if (x === 0 && y === 0) continue;
      if (!plane.inside([x, y], 0.35)) continue;
      const w = apply2(A, [x, y]);
      if (norm2(w) < 1e-9) continue;
      const u = unit2(w), q = plane.p(x, y);
      const s: P3 = [q[0] - (u[0] * len) / 2, q[1] - (u[1] * len) / 2, 0], e: P3 = [q[0] + (u[0] * len) / 2, q[1] + (u[1] * len) / 2, 0];
      const base: P3 = [e[0] - u[0] * tip, e[1] - u[1] * tip, 0];
      shafts.push([s, base]);
      tris.push([e, [base[0] - u[1] * tip * 0.55, base[1] + u[0] * tip * 0.55, 0], [base[0] + u[1] * tip * 0.55, base[1] - u[0] * tip * 0.55, 0], e]);
    }
  const tips = new Float64Array(tris.length * 3 * 12);
  let k = 0;
  for (const t of tris)
    for (let i = 0; i < 3; i++) {
      const a = t[i], c = t[i + 1];
      for (let j = 0; j < 4; j++) {
        const f = j / 3;
        tips[k++] = a[0] + (c[0] - a[0]) * f;
        tips[k++] = a[1] + (c[1] - a[1]) * f;
        tips[k++] = 0;
      }
    }
  return { shafts: segment_points(shafts), tips };
}
/** v, Av, A²v, ... while inside the plane's box (at most n points). */
export function orbit(plane: Plane, A: Mat2, v: Vec2, n = 14): Vec2[] {
  const out: Vec2[] = [v];
  let w = v;
  for (let k = 1; k < n; k++) {
    w = apply2(A, w);
    if (!plane.inside(w, 0.15) || norm2(w) * plane.unit < 0.05) break;
    out.push(w);
  }
  return out;
}

export const rotation_no_eigen = define_visual<RotationNoEigenParams>({
  name: 'rotation_no_eigen',
  summary: 'Complex eigenvalues: A is moved into a rotation; its eigenlines merge and vanish, the field of Ax swirls, an orbit v, Av, A²v... circles, and λ = a ± bi = |λ|e^{±iθ} (stretch |λ|, turn θ). Student drags î and ĵ.',
  topics: ['linear algebra', 'eigenvalues', 'complex eigenvalues', 'rotation', 'eigenvectors'],
  params: {
    A: { type: 'matrix', rows: 2, cols: 2, min: -3, max: 3, default: [[1, -1], [1, 1]], doc: 'the (rotation-like) matrix, rows first [[a, b], [c, d]]; complex eigenvalues when (a−d)² + 4bc < 0, e.g. [[0,-1],[1,0]] (turn 90°), [[1,-1],[1,1]] (turn 45°, stretch √2). A matrix with real eigenvalues is shown for contrast' },
    show_orbit: { type: 'boolean', default: true, doc: 'draw the orbit v, Av, A²v, ... of one vector' },
  },
  examples: [{}, { A: [[0, -1], [1, 0]] }, { A: [[0.8, -1.2], [0.6, 0.9]], show_orbit: false }, { A: [[2, 1], [1, 2]] }],
  ids: ['grid', 'i_hat', 'j_hat', 'field', 'eigenlines', 'orbit', 'matrix', 'char_poly', 'discriminant', 'eigenvalues', 'polar', 'message'],
  scene: (p) => {
    const A = mat2(p.A);
    const { S, merge } = start_path(A);
    class RotationNoEigen extends Scene {
      M = new MatrixTrackers([[1, 0], [0, 1]]);
      plane!: Plane;
      override construct() {
        const c = palette();
        const { M } = this;
        this.track(...M.t);
        const plane = fit_plane(STAGE, [-2.5, 0], 3.3, 1.05);
        this.plane = plane;
        const grid = transformed_grid(plane, () => M.get(), { line_opacity: 0.35 });
        grid.group.name = 'grid';
        const [bi, bj] = basis_arrows(plane, M, 6);
        const [li, lj] = basis_labels(plane, M, ['A\\hat{\\imath}', 'A\\hat{\\jmath}'], 34);
        // the direction field
        const shafts = path(c.teal, 2.5, 0.85), tips = VMobject({ fill_color: c.teal, fill_opacity: 0.85, stroke_width: 0 });
        const upd_field = () => {
          const f = field_points(plane, M.get());
          shafts.points = f.shafts;
          tips.points = f.tips;
        };
        upd_field();
        shafts.add_updater(() => upd_field());
        const field = VGroup(shafts, tips);
        field.name = 'field';
        // real eigenlines (fade out as they merge)
        const eigenlines = always_redraw(() => {
          const e = eig2(M.get());
          const dirs: Vec2[] = e.kind === 'distinct' ? e.vectors : e.kind === 'repeated' ? [e.vectors[0], e.vectors[0]] : [[1, 0], [0, 1]];
          const box = { x0: plane.box.x0 + 0.05, x1: plane.box.x1 - 0.05, y0: plane.box.y0 + 0.05, y1: plane.box.y1 - 0.05 };
          const segs = dirs.map((u) => clip_line(plane.p(0, 0), [u[0], u[1]], box) ?? [plane.p(0, 0), plane.p(0.01, 0)]);
          const l = path(c.gold, 5, e.kind === 'complex' || e.kind === 'scalar' ? 0 : 0.95);
          l.points = segment_points(segs as [P3, P3][]);
          return l;
        });
        eigenlines.name = 'eigenlines';
        // one orbit
        const v0: Vec2 = orbit_start(A, plane.reach());
        const orbit_mob = always_redraw(() => {
          const pts = orbit(plane, M.get(), v0).map((q) => plane.pv(q));
          const vm = VMobject({ stroke_color: c.coral, stroke_width: 3, stroke_opacity: 0.8, fill_opacity: 0 });
          vm.set_points_as_corners(pts.length > 1 ? pts : [pts[0], pts[0]]);
          const dots = pts.map((q, k) => {
            const d = VMobject({ fill_color: c.coral, fill_opacity: 1, stroke_width: 0 });
            const r = k === 0 ? 0.1 : 0.075;
            d.set_points_as_corners(Array.from({ length: 13 }, (_, i) => [q[0] + r * Math.cos((i * Math.PI) / 6), q[1] + r * Math.sin((i * Math.PI) / 6), 0]));
            return d;
          });
          while (dots.length < 14) dots.push(VMobject({ fill_opacity: 0, stroke_width: 0 }).set_points_as_corners([pts[0], pts[0]]) as any);
          return VGroup(vm, ...dots);
        });
        orbit_mob.name = 'orbit';

        // ---- panel
        const X0 = PANEL.x0 + 0.12;
        const at = (m: any, y: number) => m.move_to([X0 + m.width / 2, y, 0]);
        const mat = new LiveMatrix(() => M.get(), { decimals: 1, font_size: 40, colors: [c.good, c.coral] });
        mat.name = 'matrix';
        const top = at(VGroup(tex('A =', 44), mat).arrange(RIGHT, { buff: 0.25 }), 2.85);
        mat.update(0);
        const poly = at(tex('\\lambda^2 - (\\operatorname{tr} A)\\,\\lambda + \\det A = 0', 34), 1.6);
        poly.name = 'char_poly';
        const disc = () => trace2(M.get()) ** 2 - 4 * det2(M.get());
        const disc_ro = at(readout('(\\operatorname{tr} A)^2 - 4\\det A =', disc, { decimals: 2, font_size: 34, color_of: (x) => (x < -1e-3 ? c.coral : c.gold) }), 0.85);
        disc_ro.name = 'discriminant';
        // eigenvalues: real pair or complex pair, whichever applies
        const lam = () => eig2(M.get());
        const real_ro = at(VGroup(
          readout('\\lambda_1 =', () => { const e = lam(); return e.kind === 'complex' ? 0 : e.values[0]; }, { decimals: 2, font_size: 38, color: c.gold }),
          readout('\\lambda_2 =', () => { const e = lam(); return e.kind === 'complex' ? 0 : e.values[1]; }, { decimals: 2, font_size: 38, color: c.gold }),
        ).arrange(RIGHT, { buff: 0.45 }), 0.0);
        const cplx_ro = live_row([
          readout('\\lambda =', () => { const e = lam(); return e.kind === 'complex' ? e.re : 0; }, { decimals: 2, font_size: 38, color: c.coral }),
          tex('\\pm', 38, c.coral),
          readout('', () => { const e = lam(); return e.kind === 'complex' ? e.im : 0; }, { decimals: 2, font_size: 38, color: c.coral }),
          tex('i', 38, c.coral),
        ], [X0, 0.0]);
        const eigenvalues = VGroup(real_ro, cplx_ro);
        eigenvalues.name = 'eigenvalues';
        const polar = at(VGroup(
          readout('|\\lambda| =', () => { const e = lam(); return e.kind === 'complex' ? e.r : 0; }, { decimals: 2, font_size: 34, color: c.coral }),
          tex('\\text{stretch per step}', 30, c.muted),
          readout('\\theta = \\arg\\lambda =', () => { const e = lam(); return e.kind === 'complex' ? (e.theta * 180) / Math.PI : 0; }, { decimals: 1, font_size: 34, color: c.coral, unit: '^\\circ' }),
          tex('\\text{turn per step}', 30, c.muted),
        ).arrange(DOWN, { buff: 0.12, aligned_edge: LEFT }), -1.55);
        polar.name = 'polar';
        const msg_real = at(VGroup(tex('\\text{gold lines: arrows point straight}', 30, c.gold), tex('\\text{out, so } A\\vec v = \\lambda\\vec v', 30, c.gold)).arrange(DOWN, { buff: 0.1, aligned_edge: LEFT }), -3.3);
        const msg_cplx = at(VGroup(tex('\\text{every vector is turned:}', 30, c.coral), tex('\\text{no real eigenvector}', 30, c.coral)).arrange(DOWN, { buff: 0.1, aligned_edge: LEFT }), -3.3);
        const message = VGroup(msg_real, msg_cplx);
        message.name = 'message';
        const show = (m: any, on: boolean) => {
          if (m._on === on) return;
          m._on = on;
          m.set_opacity(on ? 1 : 0);
        };
        const vis = VGroup();
        vis.add_updater(() => {
          const complex = lam().kind === 'complex';
          show(real_ro, !complex);
          show(cplx_ro, complex);
          show(polar, complex);
          show(msg_real, !complex);
          show(msg_cplx, complex);
        });

        // ---- the story
        this.play(Create(grid.group, { lag_ratio: 0.02 }), FadeIn(top), { run_time: 1.2 });
        this.add(vis);
        this.play(M.morph([[1, 0], [0, 1]], S, { run_time: 2 }), GrowArrow(bi), GrowArrow(bj), FadeIn(li), FadeIn(lj));
        for (const m of [disc_ro, real_ro, cplx_ro, polar]) m.update(0);
        vis.update(0);
        this.play(FadeIn(field), Create(eigenlines), Write(poly), FadeIn(disc_ro), FadeIn(eigenvalues), FadeIn(message), { run_time: 1.5 });
        this.add(polar);
        this.wait(0.8);
        // straight from S to A: watch the eigenlines swing together, merge and vanish
        if (merge !== null) {
          const Mm = lerp2(S, A, merge);
          this.play(M.lerp(S, Mm, { run_time: 3 }));
          this.play(Flash(plane.p(0, 0), { color: c.gold, flash_radius: 0.4 }), { run_time: 0.8 });
          this.play(M.lerp(Mm, A, { run_time: 2.5 }));
        } else this.play(M.lerp(S, A, { run_time: 3.5 }));
        this.wait(0.6);
        if (p.show_orbit) {
          this.play(Create(orbit_mob), { run_time: 2.5 });
          this.wait(0.8);
        }
        this.wait(1.5);
      }
    }
    return new RotationNoEigen();
  },
  explore: (scene: any, ui) => {
    basis_handles(ui, scene.plane, scene.M, 3);
  },
});
