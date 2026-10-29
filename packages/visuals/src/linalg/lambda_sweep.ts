// Why det(A - λI) = 0: the grid under A - λI next to the curve det(A - λI)
// against λ. As λ sweeps, exactly when the curve crosses zero the grid
// collapses onto a line, and the vectors squashed to 0 are the eigenvectors
// of A for that λ. Explore: drag the λ slider (it snaps onto the roots).
import { Create, Dot, FadeIn, Flash, NumberLine, Scene, VGroup, VMobject, ValueTracker, Write, always_redraw, linear, smooth, RIGHT } from 'manim-web';
import { Slider } from 'manim-web/ext/widgets';
import { palette } from '../theme';
import { define_visual } from '../visual';
import {
  LiveMatrix, MatrixTrackers, basis_arrows, clamp, clip_line, dashed, filled_polygon, fit_plane, readout, tex, texs, transformed_grid, backed, path, segment_points, dodge,
  type Box, type P3, type Plane,
} from './kit';
import { char_poly, col, det2, eig2, fmt, mat2, norm2, null_vector, shift2, trace2, type Mat2 } from './math';

export interface LambdaSweepParams extends Record<string, unknown> {
  A: number[][];
}

const I: Mat2 = [[1, 0], [0, 1]];
/** Left: the plane under A - λI. */
const LEFT_BOX: Box = { x0: -6.95, x1: -0.5, y0: -1.95, y1: 3.85 };
/** Right: the graph of det(A - λI). */
const GRAPH = { x0: 0.75, x1: 6.45, y0: -1.05, y1: 2.45 };

/** The λ interval shown: the real roots with some room, or around Re λ when they are complex. */
export function lambda_range(A: Mat2): [number, number] {
  const e = eig2(A);
  let lo: number, hi: number;
  if (e.kind === 'complex') [lo, hi] = [e.re - 2.5, e.re + 2.5];
  else [lo, hi] = [Math.min(...e.values) - 1.3, Math.max(...e.values) + 1.3];
  if (hi - lo < 4) {
    const m = (lo + hi) / 2;
    [lo, hi] = [m - 2, m + 2];
  }
  return [Math.floor(lo * 2) / 2, Math.ceil(hi * 2) / 2];
}

export const lambda_sweep = define_visual<LambdaSweepParams>({
  name: 'lambda_sweep',
  summary: 'Why det(A − λI) = 0: the grid under A − λI beside the curve det(A − λI) against λ; exactly at a root the grid collapses onto a line and the vectors sent to 0 are the eigenvectors. Student drags a λ slider.',
  topics: ['linear algebra', 'eigenvalues', 'characteristic polynomial', 'determinant', 'eigenvectors'],
  params: {
    A: { type: 'matrix', rows: 2, cols: 2, min: -3, max: 3, default: [[3, 1], [0, 2]], doc: 'the matrix, rows first [[a, b], [c, d]]; the curve is λ² − (a+d)λ + (ad − bc). E.g. [[2,1],[1,2]] (roots 1, 3), [[2,1],[0,2]] (double root), [[1,-1],[1,1]] (no real root)' },
  },
  examples: [{}, { A: [[2, 1], [1, 2]] }, { A: [[2, 1], [0, 2]] }, { A: [[1, -1], [1, 1]] }, { A: [[1, 2], [2, 1]] }],
  ids: ['grid', 'parallelogram', 'null_line', 'matrix', 'curve', 'curve_dot', 'lambda_slider', 'lambda_readout', 'det_readout', 'equation', 'roots'],
  scene: (p) => {
    const A = mat2(p.A);
    const e = eig2(A);
    const [lo, hi] = lambda_range(A);
    const roots = e.kind === 'complex' ? [] : e.kind === 'distinct' ? [...e.values].sort((a, b) => a - b) : [e.values[0]];
    class LambdaSweep extends Scene {
      lam = ValueTracker(lo);
      M = new MatrixTrackers(I);
      slider: any;
      roots = roots;
      lo = lo;
      hi = hi;
      x_of!: (l: number) => number;
      y_of!: (y: number) => number;
      override construct() {
        const c = palette();
        const { lam, M } = this;
        lam.name = 'lambda';
        this.track(lam, ...M.t);
        const B = () => M.get();
        const syncB = () => M.set(shift2(A, lam.get_value()));

        // ---- left: the plane under A - λI
        let ext = 1.2;
        for (let k = 0; k <= 40; k++) {
          const m = shift2(A, lo + ((hi - lo) * k) / 40);
          ext = Math.max(ext, norm2(col(m, 0)), norm2(col(m, 1)));
        }
        const plane: Plane = fit_plane(LEFT_BOX, [-3.72, 0.95], Math.min(ext, 3.6) + 0.35, 0.95);
        const grid = transformed_grid(plane, B);
        grid.group.name = 'grid';
        const sign_color = (d: number) => (d < -0.02 ? c.purple : d > 0.02 ? c.gold : c.coral);
        const para = always_redraw(() => {
          const m = B(), o = plane.p(0, 0), a = plane.pv(col(m, 0)), b = plane.pv(col(m, 1));
          const d = det2(m);
          return filled_polygon([o, a, [a[0] + b[0] - o[0], a[1] + b[1] - o[1]], b], plane.box, sign_color(d), 0.28, sign_color(d), 2.5);
        });
        para.name = 'parallelogram';
        const [bi, bj] = basis_arrows(plane, M, 6);
        // the vectors that A - λI squashes to 0 (only near a root)
        const near = () => clamp(1 - Math.abs(det2(B())) / 0.12, 0, 1);
        const null_line = always_redraw(() => {
          const n = null_vector(B(), 0.25) ?? [1, 0];
          const seg = clip_line(plane.p(0, 0), [n[0], n[1]], { x0: plane.box.x0 + 0.05, x1: plane.box.x1 - 0.05, y0: plane.box.y0 + 0.05, y1: plane.box.y1 - 0.05 });
          const l = path(c.gold, 5, 1);
          l.points = segment_points(seg ? [seg] : [[plane.p(0, 0), plane.p(0.01, 0)]]);
          l.set_stroke({ opacity: 0.95 * near() });
          return l;
        });
        null_line.name = 'null_line';
        const null_label = backed(tex('\\vec v \\mapsto \\vec 0', 34, c.gold), 0.8);
        null_label.add_updater((m: any) => {
          const n = null_vector(B(), 0.25) ?? [1, 0];
          const r = Math.min(plane.reach() * 0.72, 2.6);
          const spots = [[n[0] * r - n[1] * 0.38, n[1] * r + n[0] * 0.38], [-n[0] * r + n[1] * 0.38, -n[1] * r - n[0] * 0.38]].map((q) => plane.pv(q));
          const best = spots.find((s) => s[1] < plane.box.y1 - 0.3 && s[1] > plane.box.y0 + 0.3 && s[0] > plane.box.x0 + 0.5 && s[0] < plane.box.x1 - 0.5) ?? spots[0];
          m.move_to(best);
          const k = Math.round(near() * 20) / 20;
          if (m._k !== k) {
            m.set_opacity(k);
            m.background_rectangle?.set_fill({ opacity: 0.8 * k });
            m._k = k;
          }
        });
        const mat = new LiveMatrix(B, { decimals: 2, font_size: 34 });
        mat.name = 'matrix';
        const mrow = VGroup(tex('A - \\lambda I =', 38), mat).arrange(RIGHT, { buff: 0.22 }).move_to([-3.72, -2.95, 0]);
        mat.update(0);

        // ---- right: the curve det(A - λI) against λ
        const f = (l: number) => char_poly(A, l);
        const vertex = f(trace2(A) / 2);
        const ends = Math.max(f(lo), f(hi));
        const ylo = Math.min(0, vertex) - 0.15 * Math.max(1, ends - Math.min(0, vertex));
        const yhi = Math.max(0.5, ends) + 0.1 * Math.max(1, ends - Math.min(0, vertex));
        const x_of = (l: number) => GRAPH.x0 + ((l - lo) / (hi - lo)) * (GRAPH.x1 - GRAPH.x0);
        const y_of = (y: number) => GRAPH.y0 + ((y - ylo) / (yhi - ylo)) * (GRAPH.y1 - GRAPH.y0);
        this.x_of = x_of;
        this.y_of = y_of;
        // integer ticks on the λ axis (a NumberLine), on a line that spans the whole range
        const step = hi - lo > 7 ? 2 : 1;
        const t0 = Math.ceil(lo / step) * step, t1 = Math.floor(hi / step) * step;
        const scale = (GRAPH.x1 - GRAPH.x0) / (hi - lo);
        const axis: any = NumberLine({
          x_range: [t0, t1, step], length: (t1 - t0) * scale, include_numbers: true, font_size: 26, color: c.muted, stroke_width: 2, include_tip: false,
          decimal_number_config: { num_decimal_places: 0, color: c.muted },
        });
        axis.shift([x_of(t0) - axis.number_to_point(t0)[0], y_of(0) - axis.number_to_point(t0)[1], 0]);
        const axis_line = path(c.muted, 2, 1);
        axis_line.points = segment_points([[[GRAPH.x0, y_of(0), 0], [GRAPH.x1, y_of(0), 0]]]);
        const lam_label = tex('\\lambda', 36, c.ink).move_to([GRAPH.x1 + 0.25, y_of(0) + 0.03, 0]);
        const yaxis = dashed([x_of(lo), GRAPH.y0 - 0.1, 0], [x_of(lo), GRAPH.y1 + 0.1, 0], c.muted, 2, 0.08, 0.6);
        const ylab = tex('\\det(A - \\lambda I)', 30, c.accent).rotate(Math.PI / 2).move_to([GRAPH.x0 - 0.3, (GRAPH.y0 + GRAPH.y1) / 2 + 0.3, 0]);
        const curve = VMobject({ stroke_color: c.accent, stroke_width: 5, fill_opacity: 0 });
        curve.set_points_smoothly(Array.from({ length: 121 }, (_, k) => {
          const l = lo + ((hi - lo) * k) / 120;
          return [x_of(l), y_of(clamp(f(l), ylo, yhi)), 0];
        }));
        curve.name = 'curve';
        const dot = always_redraw(() => {
          const l = lam.get_value(), y = f(l);
          return Dot([x_of(l), y_of(clamp(y, ylo, yhi)), 0], { radius: 0.11, color: sign_color(y) });
        });
        dot.name = 'curve_dot';
        const drop = always_redraw(() => {
          const l = lam.get_value();
          return dashed([x_of(l), y_of(0), 0], [x_of(l), y_of(clamp(f(l), ylo, yhi)), 0], c.muted, 2.5, 0.08);
        });
        // the slider sits under the axis, knob exactly below the dot
        const slider: any = new Slider(lam, { x_range: [lo, hi], length: GRAPH.x1 - GRAPH.x0, color: c.accent, track_color: c.faint, stroke_width: 7, knob_radius: 0.15, label: null, show_value: false });
        slider.move_to([(GRAPH.x0 + GRAPH.x1) / 2, -1.95, 0]);
        slider.name = 'lambda_slider';
        this.slider = slider;
        const lam_ro = readout('\\lambda =', () => lam.get_value(), { decimals: 2, font_size: 38 });
        lam_ro.name = 'lambda_readout';
        const det_ro = readout('\\det(A - \\lambda I) =', () => f(lam.get_value()), { decimals: 2, font_size: 38, color_of: sign_color });
        det_ro.name = 'det_readout';
        lam_ro.move_to([GRAPH.x0 + lam_ro.width / 2, -2.75, 0]);
        det_ro.move_to([GRAPH.x0 + det_ro.width / 2, -3.45, 0]);
        const eq1 = texs([['A\\vec v = \\lambda \\vec v', undefined], ['\\iff', c.muted], ['(A - \\lambda I)\\vec v = \\vec 0', undefined]], 36);
        eq1.move_to([(GRAPH.x0 + GRAPH.x1) / 2, 3.5, 0]);
        const equation = VGroup(eq1);
        equation.name = 'equation';
        const roots_group = VGroup();
        roots_group.name = 'roots';

        // ---- the story
        syncB();
        M.set(I);
        this.play(Create(grid.group, { lag_ratio: 0.02 }), Create(axis_line), Create(axis), FadeIn(lam_label), FadeIn(yaxis), { run_time: 1.4 });
        this.play(M.morph(I, shift2(A, lo), { run_time: 2 }), FadeIn(bi), FadeIn(bj), Create(curve), Write(ylab), { run_time: 2 });
        lam_ro.update(0);
        det_ro.update(0);
        mat.update(0);
        this.play(FadeIn(para), FadeIn(mrow), FadeIn(dot), FadeIn(drop), FadeIn(slider), FadeIn(lam_ro), FadeIn(det_ro), { run_time: 1 });
        this.next_section(); // (a section per beat, §, of the narration: the picture waits there for the voice)
        this.play(Write(eq1), { run_time: 1.2 });
        // from now on A - λI follows λ
        M.t[0].add_updater(() => syncB());
        this.add(null_line, null_label);
        this.bring_to_front(bi, bj);
        let cur = lo;
        const speed = 0.9;
        roots.forEach((r, i) => {
          if (i === 1) this.next_section(); // ("exactly at the eigenvalues": the second root)
          this.play(lam.animate.set_value(r), { run_time: Math.max(1, (r - cur) / speed), rate_func: i === 0 ? smooth : smooth });
          cur = r;
          const tag = backed(tex(e.kind === 'distinct' ? `\\lambda_{${i + 1}} = ${fmt(r)}` : `\\lambda = ${fmt(r)}`, 32, c.gold), 0.8);
          // below the tick numbers, on the outer side of the root (where the curve is above the axis)
          const side = roots.length === 2 ? (i === 0 ? -1 : 1) : 0;
          tag.move_to([x_of(r) + side * (tag.width / 2 - 0.15), y_of(0) - 0.82, 0]);
          if (tag.get_center()[0] + tag.width / 2 > GRAPH.x1 + 0.3) tag.shift([GRAPH.x1 + 0.3 - tag.get_center()[0] - tag.width / 2, 0, 0]);
          if (tag.get_center()[0] - tag.width / 2 < GRAPH.x0 - 0.3) tag.shift([GRAPH.x0 - 0.3 - tag.get_center()[0] + tag.width / 2, 0, 0]);
          const root_dot = Dot([x_of(r), y_of(0), 0], { radius: 0.09, color: c.gold });
          this.play(Flash([x_of(r), y_of(0), 0], { color: c.gold, flash_radius: 0.25 }), Flash(plane.p(0, 0), { color: c.gold, flash_radius: 0.35 }), FadeIn(root_dot), FadeIn(tag), { run_time: 1 });
          roots_group.add(root_dot, tag);
          if (i === 0) {
            const eq2 = texs([['\\text{a vector goes to } \\vec 0', undefined], ['\\iff', c.muted], ['\\det(A - \\lambda I) = 0', c.gold]], 34);
            eq2.move_to([(GRAPH.x0 + GRAPH.x1) / 2, 2.98, 0]);
            this.next_section();
            this.play(Write(eq2), { run_time: 1.2 });
            equation.add(eq2);
          }
          this.wait(0.8);
        });
        this.play(lam.animate.set_value(hi - 0.25), { run_time: Math.max(1, (hi - 0.25 - cur) / speed), rate_func: linear });
        if (!roots.length) {
          const none = VGroup(tex('\\det(A - \\lambda I) > 0 \\text{ for every real } \\lambda', 32, c.coral), tex('\\text{no collapse: no real eigenvalue}', 32, c.coral)).arrange([0, -1, 0], { buff: 0.12 });
          none.move_to([(GRAPH.x0 + GRAPH.x1) / 2, 2.85, 0]);
          this.play(FadeIn(none), { run_time: 1 });
          equation.add(none);
          this.play(lam.animate.set_value(e.kind === 'complex' ? e.re : lo), { run_time: 2 });
        } else {
          this.play(lam.animate.set_value(roots[0]), { run_time: 2 });
        }
        this.add(equation, roots_group);
        this.wait(1.5);
      }
    }
    return new LambdaSweep();
  },
  explore: (scene: any, ui) => {
    const s = scene.slider, lam = scene.lam;
    ui.add_handle({
      mobject: s.knob,
      get: () => s.knob.get_center(),
      set: (pt: P3) => {
        let v = s.value_of(pt);
        // the roots are sticky, so the collapse is easy to hit
        for (const r of scene.roots) if (Math.abs(v - r) < 0.06) v = r;
        lam.set_value(v);
      },
      constraint: (pt: P3) => {
        const a = s.track.get_start(), b = s.track.get_end();
        return [clamp(pt[0], a[0], b[0]), a[1], 0];
      },
      step: (scene.x_of(scene.lo + 0.05) - scene.x_of(scene.lo)),
      radius: 0.35,
      label: 'the λ slider',
    });
  },
});
