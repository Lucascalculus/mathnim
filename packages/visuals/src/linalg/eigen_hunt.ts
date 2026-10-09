// Hunting for eigenvectors: a probe v turns around the unit circle while Av is
// drawn (its tip traces the image ellipse). Whenever Av lines up with v, the
// moment is highlighted, the eigenline is drawn and λ = ±|Av|/|v| is read off.
// Explore: drag v around the circle yourself.
import { Arc, Circle, Create, FadeIn, Flash, GrowArrow, Indicate, Scene, VGroup, VMobject, ValueTracker, Write, always_redraw, linear, DOWN, LEFT, RIGHT } from 'manim-web';
import { palette } from '../theme';
import { define_visual } from '../visual';
import {
  LiveMatrix, PANEL, STAGE, backed, clip_line, dodge, clipped, fit_plane, follow_tip, lattice_segments, live_arrow, path, plane_axes, readout, segment_points, switcher, tex,
  type P3, type Plane,
} from './kit';
import { angle_between, apply2, dot2, eig2, fmt, from_angle, line_angle, mat2, norm2, type Mat2, type Vec2 } from './math';

export interface EigenHuntParams extends Record<string, unknown> {
  A: number[][];
}

/** Degrees between v and Av folded to [0, 90]: 0 when they lie on one line (either way). */
export function misalignment(A: Mat2, v: Vec2): number {
  const a = (angle_between(v, apply2(A, v)) * 180) / Math.PI;
  return Math.min(a, 180 - a);
}
/** Signed stretch along v: Av·v/|v|² (= λ when v is an eigenvector). */
export const stretch = (A: Mat2, v: Vec2): number => dot2(apply2(A, v), v) / Math.max(1e-12, dot2(v, v));
/** The largest |Av| for |v| = 1 (the image ellipse's semi-major axis). */
export function max_stretch(A: Mat2): number {
  let m = 0;
  for (let k = 0; k < 360; k++) m = Math.max(m, norm2(apply2(A, from_angle((k * Math.PI) / 180))));
  return m;
}

export const eigen_hunt = define_visual<EigenHuntParams>({
  name: 'eigen_hunt',
  summary: 'Hunting eigenvectors: a probe v turns around the unit circle with Av drawn; when they line up the eigenline is highlighted and λ = ±|Av|/|v| is read off (also repeated, λI and complex = never lines up). Student drags v.',
  topics: ['linear algebra', 'eigenvalues', 'eigenvectors', 'linear transformations'],
  params: {
    A: { type: 'matrix', rows: 2, cols: 2, min: -3, max: 3, default: [[3, 1], [0, 2]], doc: 'the matrix, rows first [[a, b], [c, d]]; e.g. [[3,1],[0,2]] (λ = 3, 2), [[1,2],[2,1]] (λ = 3, -1), [[2,1],[0,2]] (one eigenline), [[0,-1],[1,0]] (none)' },
  },
  examples: [{}, { A: [[1, 2], [2, 1]] }, { A: [[2, 1], [0, 2]] }, { A: [[1, -1], [1, 1]] }, { A: [[1.5, 0], [0, 1.5]] }],
  ids: ['unit_circle', 'probe_v', 'image_Av', 'trace', 'eigenlines', 'matrix', 'angle_readout', 'stretch_readout', 'found'],
  scene: (p) => {
    const A = mat2(p.A);
    const e = eig2(A);
    class EigenHunt extends Scene {
      th = ValueTracker(0);
      trace_end = ValueTracker(0);
      plane!: Plane;
      override construct() {
        const c = palette();
        const { th, trace_end } = this;
        th.name = 'probe_angle';
        this.track(th, trace_end);
        const plane = fit_plane(STAGE, [-2.5, 0], Math.max(1.6, max_stretch(A)) + 0.45, 1.25);
        this.plane = plane;
        const V = (): Vec2 => from_angle(th.get_value());
        const AV = (): Vec2 => apply2(A, V());
        // directions (angles in [0, π)) where Av lines up with v
        const dirs: { angle: number; lambda: number }[] =
          e.kind === 'distinct' ? e.vectors.map((u, i) => ({ angle: line_angle(u), lambda: e.values[i] })) : e.kind === 'repeated' ? [{ angle: line_angle(e.vectors[0]), lambda: e.values[0] }] : [];
        dirs.sort((a, b) => a.angle - b.angle);
        const t0 = dirs.length ? dirs[0].angle - (55 * Math.PI) / 180 : (80 * Math.PI) / 180;
        th.set_value(t0);
        trace_end.set_value(t0);

        const bg = path(c.faint, 1.5, 1);
        bg.points = segment_points(lattice_segments(plane, [[1, 0], [0, 1]], 'exclude'));
        const axes = plane_axes(plane, c.muted, 2, 0.6);
        const circle = Circle({ radius: plane.unit, arc_center: plane.p(0, 0), stroke_color: c.accent, stroke_width: 2.5, stroke_opacity: 0.45 });
        circle.name = 'unit_circle';
        const trace = always_redraw(() => {
          const a = t0, b = Math.max(t0 + 0.01, trace_end.get_value());
          const n = Math.max(2, Math.ceil(((b - a) * 180) / Math.PI / 3));
          const pts = Array.from({ length: n + 1 }, (_, k) => plane.pv(apply2(A, from_angle(a + ((b - a) * k) / n))));
          const vm = VMobject({ stroke_color: c.coral, stroke_width: 3, stroke_opacity: 0.55, fill_opacity: 0 });
          vm.set_points_smoothly(pts);
          if (b - a < 0.02) vm.set_opacity(0);
          return vm;
        });
        trace.name = 'trace';
        const v_arrow = live_arrow(() => clipped(plane, V()), c.accent, 6);
        v_arrow.name = 'probe_v';
        const av_arrow = live_arrow(() => clipped(plane, AV()), c.coral, 6);
        av_arrow.name = 'image_Av';
        const box = { x0: STAGE.x0 + 0.1, x1: STAGE.x1 - 0.1, y0: STAGE.y0 + 0.1, y1: STAGE.y1 - 0.1 };
        // labels beyond the tips; when v and Av overlap, v's label goes to the side
        const lv = follow_tip(backed(tex('\\vec v', 38, c.accent), 0.75), () => {
          const [a, b] = clipped(plane, V());
          const side = misalignment(A, V()) < 12 ? Math.PI / 2 : 0;
          const d = from_angle(th.get_value() + side);
          return [[b[0] - d[0], b[1] - d[1], 0], b];
        }, 0.12, box);
        const lav = follow_tip(backed(tex('A\\vec v', 38, c.coral), 0.75), () => {
          const w = AV();
          if (norm2(w) * plane.unit < 0.3) {
            const q = plane.p(0, 0);
            return [[q[0], q[1] + 1, 0], [q[0], q[1] - 0.2, 0]];
          }
          return clipped(plane, w);
        }, 0.12, box);
        // the angle between v and Av
        const turn = always_redraw(() => {
          const a1 = th.get_value(), w = AV();
          let sweep = Math.atan2(w[1], w[0]) - a1;
          sweep = Math.atan2(Math.sin(sweep), Math.cos(sweep));
          const r = 0.42 * Math.min(1, plane.unit);
          const arc = Arc({ radius: r, start_angle: a1, angle: Math.abs(sweep) < 0.02 ? 0.02 : sweep, arc_center: plane.p(0, 0), stroke_color: c.muted, stroke_width: 3 });
          if (Math.abs(sweep) < 0.05 || norm2(w) < 0.05) arc.set_opacity(0);
          return arc;
        });
        // the "lined up" highlight at v's tip
        const ring = always_redraw(() => {
          const k = Math.max(0, 1 - misalignment(A, V()) / 2.5);
          const ring = Circle({ radius: 0.2, arc_center: clipped(plane, V())[1], stroke_color: c.gold, stroke_width: 5 });
          ring.set_stroke({ opacity: k });
          return ring;
        });

        const X0 = PANEL.x0 + 0.12;
        const at = (m: any, y: number) => m.move_to([X0 + m.width / 2, y, 0]);
        const mat = new LiveMatrix(() => A, { decimals: 1, font_size: 40 });
        mat.name = 'matrix';
        const top = at(VGroup(tex('A =', 44), mat).arrange(RIGHT, { buff: 0.25 }), 2.85);
        mat.update(0);
        const goal = at(tex('A\\vec v = \\lambda \\vec v\\ ?', 44, c.ink), 1.55);
        const ang = at(readout('\\text{angle}(\\vec v, A\\vec v) =', () => (angle_between(V(), AV()) * 180) / Math.PI, { decimals: 1, font_size: 36, unit: '^\\circ', color_of: () => (misalignment(A, V()) < 1 ? c.gold : c.ink) }), 0.6);
        ang.name = 'angle_readout';
        const str = at(readout('|A\\vec v| / |\\vec v| =', () => norm2(AV()), { decimals: 2, font_size: 36 }), -0.2);
        str.name = 'stretch_readout';

        // what was found
        const found = VGroup();
        found.name = 'found';
        const found_items: any[] = [];
        if (e.kind === 'complex') {
          found_items.push(VGroup(tex('\\text{never lines up:}', 36, c.coral), tex('\\text{no real eigenvector}', 36, c.coral)).arrange(DOWN, { buff: 0.14, aligned_edge: LEFT }));
        } else if (e.kind === 'scalar') {
          found_items.push(VGroup(tex('\\text{always lined up:}', 36, c.gold), tex(`A = ${fmt(e.values[0])}I,\\ \\lambda = ${fmt(e.values[0])}`, 38, c.gold)).arrange(DOWN, { buff: 0.14, aligned_edge: LEFT }));
        } else {
          if (e.kind === 'repeated') found_items.push(tex(`\\lambda_1 = \\lambda_2 = ${fmt(e.values[0])}`, 42, c.gold));
          else dirs.forEach((d, i) => found_items.push(d.lambda < -1e-9 ? tex(`\\lambda_{${i + 1}} = ${fmt(d.lambda)}\\ \\ \\text{(}A\\vec v\\text{ flips)}`, 38, c.gold) : tex(`\\lambda_{${i + 1}} = ${fmt(d.lambda)}`, 42, c.gold)));
          if (e.kind === 'repeated') found_items.push(tex('\\text{(one eigenline only)}', 32, c.muted));
        }
        let fy = -1.2;
        for (const f of found_items) {
          at(f, fy - f.height / 2);
          fy -= f.height + 0.3;
        }
        const lines: any[] = dirs.map((d) => {
          const u = from_angle(d.angle);
          const seg = clip_line(plane.p(0, 0), [u[0], u[1]], { x0: STAGE.x0 + 0.05, x1: STAGE.x1 - 0.05, y0: STAGE.y0 + 0.05, y1: STAGE.y1 - 0.05 })!;
          const l = path(c.gold, 4, 0.85);
          l.points = segment_points([seg]);
          return l;
        });
        const eigenlines = VGroup(...lines);
        eigenlines.name = 'eigenlines';
        // λ labels on the lines, at whichever spot is clear of the moving labels
        const line_labels = dirs.map((d, i) => {
          const u = from_angle(d.angle), n: Vec2 = [-u[1], u[0]];
          const lab = backed(tex(`\\lambda = ${fmt(d.lambda)}`, 34, c.gold), 0.8);
          const spots: P3[] = [];
          for (const r of [Math.max(1, d.lambda) + 1, -(Math.max(1, -d.lambda) + 1), 2.2, -2.2, 1.4, -1.4])
            for (const off of i % 2 ? [-0.34, 0.34] : [0.34, -0.34]) {
              const q: Vec2 = [u[0] * r + n[0] * off, u[1] * r + n[1] * off];
              if (plane.inside(q, 0.5)) spots.push(plane.pv(q));
            }
          if (!spots.length) spots.push(plane.pv([n[0] * 0.5, n[1] * 0.5]));
          return { lab, spots };
        });
        const moving = () => [lv, lav, bbox_of_tip(clipped(plane, V())[1]), bbox_of_tip(clipped(plane, AV())[1])];
        const bbox_of_tip = (q: P3) => ({ x0: q[0] - 0.2, x1: q[0] + 0.2, y0: q[1] - 0.2, y1: q[1] + 0.2 });
        const placed = line_labels.map(({ lab, spots }, i) => dodge(lab, spots, () => [...moving(), ...line_labels.slice(0, i).map((l) => l.lab)]));
        this.add(bg, axes);
        this.play(Create(circle), Write(top), { run_time: 1.2 });
        this.add(trace);
        this.play(GrowArrow(v_arrow), FadeIn(lv), { run_time: 0.8 });
        this.play(GrowArrow(av_arrow), FadeIn(lav), Write(goal), { run_time: 1 });
        ang.update(0);
        str.update(0);
        this.play(FadeIn(ang), FadeIn(str), FadeIn(turn), { run_time: 0.8 });
        this.add(ring);
        const speed = (40 * Math.PI) / 180; // radians per second
        let cur = t0;
        const go = (to: number) => {
          if (to - cur < 1e-3) return;
          this.play(th.animate.set_value(to), trace_end.animate.set_value(to), { run_time: Math.max(0.6, (to - cur) / speed), rate_func: linear });
          cur = to;
        };
        dirs.forEach((d, i) => {
          let target = d.angle;
          while (target < cur) target += Math.PI;
          go(target);
          this.play(Flash(clipped(plane, V())[1], { color: c.gold, flash_radius: 0.3, line_length: 0.25 }), Create(lines[i]), { run_time: 0.9 });
          this.play(FadeIn(placed[i]), FadeIn(found_items[i]), { run_time: 0.7 });
          this.wait(0.5);
        });
        go(t0 + Math.PI);
        // the rest of the image ellipse
        this.play(trace_end.animate.set_value(t0 + 2 * Math.PI), th.animate.set_value(t0 + 2 * Math.PI), { run_time: 3, rate_func: linear });
        cur = t0 + 2 * Math.PI;
        for (const f of found_items.slice(dirs.length)) this.play(FadeIn(f), { run_time: 0.8 });
        // group what was found (members are already on screen)
        found.add(...placed, ...found_items);
        this.add(eigenlines, found);
        if (e.kind === 'scalar') this.play(Indicate(found_items[0], { color: c.gold }), { run_time: 1 });
        // rest on the first eigenvector found
        if (dirs.length) this.play(th.animate.set_value(t0 + 2 * Math.PI + ((dirs[0].angle - t0) % Math.PI + Math.PI) % Math.PI), { run_time: 1.5 });
        this.wait(1.5);
      }
    }
    return new EigenHunt();
  },
  explore: (scene: any, ui) => {
    const plane: Plane = scene.plane;
    ui.add_handle({
      tracker: scene.th,
      from_value: (a: number) => plane.pv(from_angle(a)),
      to_value: (pt: P3) => {
        const q = plane.to_math(pt), a = Math.atan2(q[1], q[0]);
        // keep the tracker continuous (no jump at ±π)
        const cur = scene.th.get_value();
        return cur + Math.atan2(Math.sin(a - cur), Math.cos(a - cur));
      },
      step: Math.PI / 90,
      radius: 0.45,
      label: 'the tip of the probe vector v',
    });
  },
});
