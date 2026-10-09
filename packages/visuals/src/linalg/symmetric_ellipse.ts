// A symmetric matrix maps the unit circle to an ellipse whose axes are its
// eigenvectors (always perpendicular), with semi-axes |λ1| and |λ2|. The
// matrix grows from I to S along (1 - t)I + tS, which has the same
// eigenvectors all the way, so the two eigen-spokes only stretch while every
// other spoke turns. Explore: drag the ends of the two axes (S stays symmetric).
import { Create, FadeIn, GrowArrow, Indicate, Scene, VGroup, VMobject, ValueTracker, Write, always_redraw, smooth, DOWN, LEFT, RIGHT } from 'manim-web';
import { palette } from '../theme';
import { define_visual } from '../visual';
import {
  LiveMatrix, PANEL, STAGE, backed, clamp, clipped, dodge, fit_plane, lattice_segments, live_arrow, path, plane_axes, readout, segment_points, snap, tex,
  type P3, type Plane,
  LANG_SPEC, mix, resolve_lang, zh_words,
} from './kit';
import { apply2, from_angle, mat2, sym_eig2, sym_from_axes, symmetrize, type Mat2, type Vec2 } from './math';

export interface SymmetricEllipseParams extends Record<string, unknown> {
  S: number[][];
  /** 'en', 'zh' or 'auto' (the learner's language). */
  lang: string;
}

export const symmetric_ellipse = define_visual<SymmetricEllipseParams>({
  name: 'symmetric_ellipse',
  summary: 'A symmetric S maps the unit circle to an ellipse whose axes are its perpendicular eigenvectors with half-lengths |λ| (why PCA can use eigenvectors). Student drags the axis ends; S stays symmetric.',
  topics: ['linear algebra', 'symmetric matrices', 'eigenvectors', 'spectral theorem', 'ellipse', 'pca'],
  params: {
    S: { type: 'matrix', rows: 2, cols: 2, min: -3, max: 3, default: [[2, 1], [1, 2]], doc: 'a symmetric matrix [[a, b], [b, d]] (if the two off-diagonal entries differ, their average is used). E.g. [[2,1],[1,2]] (λ = 3, 1), [[1.5,0],[0,1.5]] (circle), [[1,2],[2,1]] (λ = 3, -1), [[1,1],[1,1]] (λ = 2, 0: a segment)' },
    lang: LANG_SPEC,
  },
  examples: [{}, { S: [[2, 1], [1, 1.5]] }, { S: [[1.5, 0], [0, 1.5]] }, { S: [[1, 2], [2, 1]] }, { S: [[1, 1], [1, 1]] }, { lang: 'zh' }, { S: [[1.5, 0], [0, 1.5]], lang: 'zh' }],
  ids: ['unit_circle', 'spokes', 'ellipse', 'axis_1', 'axis_2', 'right_angle', 'matrix', 'lambda_readouts', 'spectral', 'message'],
  scene: (p) => {
    const S0 = symmetrize(mat2(p.S));
    const zh = resolve_lang(p.lang) === 'zh';
    const { values: [L1, L2], vectors: [q1] } = sym_eig2(S0);
    const phi0 = Math.atan2(q1[1], q1[0]);
    class SymmetricEllipse extends Scene {
      phi = ValueTracker(phi0);
      l1 = ValueTracker(1);
      l2 = ValueTracker(1);
      plane!: Plane;
      override construct() {
        const c = palette();
        const { phi, l1, l2 } = this;
        phi.name = 'axis_angle';
        l1.name = 'lambda_1';
        l2.name = 'lambda_2';
        this.track(phi, l1, l2);
        const S = (): Mat2 => sym_from_axes(phi.get_value(), l1.get_value(), l2.get_value());
        const Q1 = (): Vec2 => from_angle(phi.get_value()), Q2 = (): Vec2 => from_angle(phi.get_value() + Math.PI / 2);
        const plane = fit_plane(STAGE, [-2.5, 0], Math.max(1.2, Math.abs(L1), Math.abs(L2), 3) + 0.4, 1.3);
        this.plane = plane;

        const bg = path(c.faint, 1.5, 1);
        bg.points = segment_points(lattice_segments(plane, [[1, 0], [0, 1]], 'exclude'));
        const axes = plane_axes(plane, c.muted, 2, 0.6);
        const ring = (M: Mat2, n = 72): P3[] => Array.from({ length: n + 1 }, (_, k) => plane.pv(apply2(M, from_angle((2 * Math.PI * k) / n))));
        const circle = VMobject({ stroke_color: c.accent, stroke_width: 2.5, stroke_opacity: 0.5, fill_opacity: 0 });
        circle.set_points_smoothly(ring([[1, 0], [0, 1]]));
        circle.name = 'unit_circle';
        const ellipse = always_redraw(() => {
          const vm = VMobject({ stroke_color: c.accent, stroke_width: 4, fill_color: c.accent, fill_opacity: 0.1 });
          vm.set_points_smoothly(ring(S()));
          return vm;
        });
        ellipse.name = 'ellipse';
        // spokes: every 22.5°, the images of radii of the circle
        const spokes = always_redraw(() => {
          const M = S(), segs: [P3, P3][] = [];
          for (let k = 0; k < 16; k++) {
            const a = (k * Math.PI) / 8;
            // skip the ones on the eigen-directions (drawn separately)
            if (Math.abs(Math.sin(a - phi.get_value())) < 0.05 || Math.abs(Math.cos(a - phi.get_value())) < 0.05) continue;
            segs.push([plane.p(0, 0), plane.pv(apply2(M, from_angle(a)))]);
          }
          const vm = path(c.muted, 2, 0.7);
          vm.points = segment_points(segs);
          return vm;
        });
        spokes.name = 'spokes';
        const tips = always_redraw(() => {
          const M = S(), g = VGroup();
          for (let k = 0; k < 16; k++) {
            const q = plane.pv(apply2(M, from_angle((k * Math.PI) / 8)));
            const d = VMobject({ fill_color: c.muted, fill_opacity: 0.9, stroke_width: 0 });
            d.set_points_as_corners(Array.from({ length: 9 }, (_, i) => [q[0] + 0.05 * Math.cos((i * Math.PI) / 4), q[1] + 0.05 * Math.sin((i * Math.PI) / 4), 0]));
            g.add(d);
          }
          return g;
        });
        // the eigen-axes: S q = λ q, drawn both ways
        const ax1 = live_arrow(() => clipped(plane, [Q1()[0] * l1.get_value(), Q1()[1] * l1.get_value()]), c.gold, 6);
        const ax1b = live_arrow(() => clipped(plane, [-Q1()[0] * l1.get_value(), -Q1()[1] * l1.get_value()]), c.gold, 4, 0.2, () => 0.55);
        const ax2 = live_arrow(() => clipped(plane, [Q2()[0] * l2.get_value(), Q2()[1] * l2.get_value()]), c.teal, 6);
        const ax2b = live_arrow(() => clipped(plane, [-Q2()[0] * l2.get_value(), -Q2()[1] * l2.get_value()]), c.teal, 4, 0.2, () => 0.55);
        const axis_1 = VGroup(ax1, ax1b), axis_2 = VGroup(ax2, ax2b);
        axis_1.name = 'axis_1';
        axis_2.name = 'axis_2';
        const corner = always_redraw(() => {
          const r = 0.24, o = plane.p(0, 0), a = Q1(), b = Q2();
          const s1 = Math.sign(l1.get_value()) || 1, s2 = Math.sign(l2.get_value()) || 1;
          const vm = path(c.ink, 2.5, 0.8);
          vm.set_points_as_corners([[o[0] + s1 * a[0] * r, o[1] + s1 * a[1] * r, 0], [o[0] + (s1 * a[0] + s2 * b[0]) * r, o[1] + (s1 * a[1] + s2 * b[1]) * r, 0], [o[0] + s2 * b[0] * r, o[1] + s2 * b[1] * r, 0]]);
          return vm;
        });
        corner.name = 'right_angle';
        // labels at the axis ends, clear of each other
        const tipbox = (w: Vec2) => {
          const q = clipped(plane, w)[1];
          return { x0: q[0] - 0.22, x1: q[0] + 0.22, y0: q[1] - 0.22, y1: q[1] + 0.22 };
        };
        const spots = (u: () => Vec2, l: () => number) => {
          const out: P3[] = [];
          const w = u(), s = Math.abs(l()) + 0.55, n: Vec2 = [-w[1], w[0]];
          for (const [r, o] of [[s, 0], [s - 0.2, 0.45], [s - 0.2, -0.45], [-s, 0], [0.5 * s, 0.5], [0.5 * s, -0.5]] as [number, number][]) {
            const q: Vec2 = [w[0] * r * Math.sign(l() || 1) + n[0] * o, w[1] * r * Math.sign(l() || 1) + n[1] * o];
            if (plane.inside(q, 0.35)) out.push(plane.pv(q));
          }
          return out.length ? out : [plane.p(0.6, 0.6)];
        };
        const lab1 = backed(tex('\\lambda_1 \\vec q_1', 34, c.gold), 0.75);
        const lab2 = backed(tex('\\lambda_2 \\vec q_2', 34, c.teal), 0.75);
        const avoid = () => [tipbox([Q1()[0] * l1.get_value(), Q1()[1] * l1.get_value()]), tipbox([Q2()[0] * l2.get_value(), Q2()[1] * l2.get_value()])];
        dodge(lab1, () => spots(Q1, () => l1.get_value()), avoid);
        dodge(lab2, () => spots(Q2, () => l2.get_value()), () => [...avoid(), lab1]);

        // ---- panel
        const X0 = PANEL.x0 + 0.12;
        const at = (m: any, y: number) => m.move_to([X0 + m.width / 2, y, 0]);
        const mat = new LiveMatrix(() => S(), { decimals: 2, font_size: 38 });
        mat.name = 'matrix';
        const top = at(VGroup(tex('S =', 44), mat).arrange(RIGHT, { buff: 0.25 }), 2.85);
        mat.update(0);
        const sym = at(tex('S^{\\top} = S \\;\\Rightarrow\\; \\vec q_1 \\perp \\vec q_2', 36), 1.55);
        const r1 = readout('\\lambda_1 =', () => l1.get_value(), { decimals: 2, font_size: 38, color: c.gold });
        const r2 = readout('\\lambda_2 =', () => l2.get_value(), { decimals: 2, font_size: 38, color: c.teal });
        const lams = at(VGroup(r1, r2).arrange(DOWN, { buff: 0.22, aligned_edge: LEFT }), 0.35);
        lams.name = 'lambda_readouts';
        const spectral = at(tex('S = Q \\Lambda Q^{\\top}', 40), -0.95);
        spectral.name = 'spectral';
        const msg_main = zh
          ? VGroup(mix(['圆', ['\\to'], '椭圆：两条轴沿着'], 32), mix([['\\vec q_1, \\vec q_2'], '，半轴长', ['|\\lambda_1|, |\\lambda_2|']], 32)).arrange(DOWN, { buff: 0.1, aligned_edge: LEFT })
          : VGroup(tex('\\text{circle} \\to \\text{ellipse: axes along}', 32), tex('\\vec q_1, \\vec q_2\\text{, half-lengths } |\\lambda_1|, |\\lambda_2|', 32)).arrange(DOWN, { buff: 0.1, aligned_edge: LEFT });
        const msg_equal = zh
          ? VGroup(mix([['\\lambda_1 = \\lambda_2'], '：每个方向都是'], 32, c.gold), zh_words('特征向量（变成一个圆）', 32, c.gold)).arrange(DOWN, { buff: 0.1, aligned_edge: LEFT })
          : VGroup(tex('\\lambda_1 = \\lambda_2\\text{: every direction is}', 32, c.gold), tex('\\text{an eigenvector (a circle)}', 32, c.gold)).arrange(DOWN, { buff: 0.1, aligned_edge: LEFT });
        at(msg_main, -2.1);
        at(msg_equal, -2.1);
        const message = VGroup(msg_main, msg_equal);
        message.name = 'message';
        const equal = () => Math.abs(l1.get_value() - l2.get_value()) < 0.02;
        message.add_updater((m: any) => {
          const k = equal() ? 1 : 0;
          if (m._k === k) return;
          m._k = k;
          msg_main.set_opacity(1 - k);
          msg_equal.set_opacity(k);
        });

        // ---- the story
        this.add(bg, axes);
        this.play(Create(circle), FadeIn(top), { run_time: 1.2 });
        this.play(Create(spokes), FadeIn(tips), { run_time: 1 });
        this.play(GrowArrow(ax1), GrowArrow(ax1b), GrowArrow(ax2), GrowArrow(ax2b), { run_time: 1 });
        this.add(ellipse);
        this.bring_to_front(spokes, tips, ax1, ax1b, ax2, ax2b);
        r1.update(0);
        r2.update(0);
        this.play(FadeIn(lams), FadeIn(lab1), FadeIn(lab2), { run_time: 0.8 });
        // (1 - t) I + t S: same eigenvectors all the way; only the eigen-spokes keep their direction
        this.play(l1.animate.set_value(L1), l2.animate.set_value(L2), { run_time: 3.5, rate_func: smooth });
        this.play(Create(corner), Write(sym), { run_time: 1.2 });
        this.play(Indicate(ax1, { color: c.gold }), Indicate(ax2, { color: c.teal }), { run_time: 1 });
        this.play(Write(spectral), { run_time: 1 });
        message.update(0);
        this.play(FadeIn(message), { run_time: 1 });
        this.add(axis_1, axis_2, top);
        this.wait(1.5);
      }
    }
    return new SymmetricEllipse();
  },
  explore: (scene: any, ui, p) => {
    const plane: Plane = scene.plane, { phi, l1, l2 } = scene;
    const zh = resolve_lang(p.lang) === 'zh';
    const lim = (x: number) => clamp(snap(x, 0.05), -3, 3);
    // end of axis 1: turns the axes and sets λ1
    ui.add_handle({
      get: () => clipped(plane, [Math.cos(phi.get_value()) * l1.get_value(), Math.sin(phi.get_value()) * l1.get_value()])[1],
      set: (pt: P3) => {
        const q = plane.to_math(pt), r = Math.hypot(q[0], q[1]);
        if (r < 0.05) return;
        let a = Math.atan2(q[1], q[0]);
        // keep λ1's sign: if it is negative the arrow points the other way
        if (l1.get_value() < 0) a += Math.PI;
        const cur = phi.get_value();
        phi.set_value(cur + Math.atan2(Math.sin(a - cur), Math.cos(a - cur)));
        l1.set_value(lim(Math.sign(l1.get_value() || 1) * r));
      },
      step: plane.unit * 0.1,
      radius: 0.4,
      label: zh ? '第一条轴的端点（λ1 q1）' : 'the end of the first axis (λ1 q1)',
    });
    // end of axis 2: slides along the perpendicular line, sets λ2
    ui.add_handle({
      get: () => clipped(plane, [-Math.sin(phi.get_value()) * l2.get_value(), Math.cos(phi.get_value()) * l2.get_value()])[1],
      set: (pt: P3) => {
        const q = plane.to_math(pt), n: Vec2 = [-Math.sin(phi.get_value()), Math.cos(phi.get_value())];
        l2.set_value(lim(q[0] * n[0] + q[1] * n[1]));
      },
      step: plane.unit * 0.1,
      radius: 0.4,
      label: zh ? '第二条轴的端点（λ2 q2）' : 'the end of the second axis (λ2 q2)',
    });
  },
});

