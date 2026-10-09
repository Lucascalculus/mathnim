// The determinant as an area: the unit square spanned by î and ĵ becomes the
// parallelogram spanned by A's columns, and det A is its (signed) area. Then ĵ
// is turned onto î's line (the plane collapses, det = 0) and past it (the
// orientation flips, det < 0). Explore: drag î and ĵ.
import { Arc, Create, DrawBorderThenFill, FadeIn, Flash, GrowArrow, Scene, VGroup, Write, always_redraw, RIGHT, DOWN, LEFT } from 'manim-web';
import { palette } from '../theme';
import { define_visual } from '../visual';
import {
  LiveMatrix, MatrixTrackers, PANEL, STAGE, basis_arrows, basis_handles, basis_labels, filled_polygon, fit_plane, readout, switcher, tex, texs,
  transformed_grid, type P3, type Plane,
} from './kit';
import { angle_of, col, det2, from_angle, from_cols, mat2, norm2, wrap_pi, type Mat2, type Vec2 } from './math';

export interface DeterminantAreaParams extends Record<string, unknown> {
  A: number[][];
  show_collapse: boolean;
}

const I: Mat2 = [[1, 0], [0, 1]];
/** Below this |det| the plane counts as squashed. */
export const DET_ZERO = 0.05;

/** ĵ turned onto the line of î (same length), and mirrored past it: the collapse and the flip. */
export function collapse_and_flip(A: Mat2): { flat: Mat2; flipped: Mat2 } | null {
  const c1 = col(A, 0), c2 = col(A, 1);
  if (norm2(c1) < 0.3 || norm2(c2) < 0.3 || Math.abs(det2(A)) < DET_ZERO) return null;
  const a1 = angle_of(c1), a2 = angle_of(c2);
  // the direction of î's line closest to ĵ
  const onto = Math.abs(wrap_pi(a2 - a1)) <= Math.PI / 2 ? a1 : a1 + Math.PI;
  const d = wrap_pi(onto - a2);
  const r = norm2(c2);
  return { flat: from_cols(c1, from_angle(onto, r)), flipped: from_cols(c1, from_angle(onto + d, r)) };
}

export const determinant_area = define_visual<DeterminantAreaParams>({
  name: 'determinant_area',
  summary: "det A as area: the unit square becomes the parallelogram of A's columns with signed area det A; then ĵ turns onto î's line (det 0, plane squashed) and past it (det < 0, orientation flipped). Student drags î and ĵ.",
  topics: ['linear algebra', 'determinant', 'area', 'orientation', 'linear transformations'],
  params: {
    A: { type: 'matrix', rows: 2, cols: 2, min: -3, max: 3, default: [[1.5, 1], [0.5, 2]], doc: 'the matrix, rows first [[a, b], [c, d]]; det = ad - bc. Use parallel columns for det 0 and swapped orientation for det < 0' },
    show_collapse: { type: 'boolean', default: true, doc: 'after showing det A, turn ĵ onto î\'s line (det 0) and past it (det < 0), then back' },
  },
  examples: [{}, { A: [[1, 2], [0.5, 1]] }, { A: [[1, 2], [1, -1]] }, { A: [[3, 0], [0, 2]], show_collapse: false }],
  ids: ['grid', 'i_hat', 'j_hat', 'parallelogram', 'area_label', 'orientation', 'matrix', 'det_readout', 'det_formula', 'det_message'],
  scene: (p) => {
    const A = mat2(p.A);
    class DeterminantArea extends Scene {
      M = new MatrixTrackers(I);
      plane!: Plane;
      override construct() {
        const c = palette();
        const { M } = this;
        this.track(...M.t);
        const cf = collapse_and_flip(A);
        const reach = (m: Mat2) => Math.max(norm2(col(m, 0)), norm2(col(m, 1)), norm2([m[0][0] + m[0][1], m[1][0] + m[1][1]]));
        const extent = Math.max(2.3, reach(A), cf ? reach(cf.flipped) : 0) + 0.4;
        const plane = fit_plane(STAGE, [-2.5, 0], extent, 0.95);
        this.plane = plane;
        const det = () => det2(M.get());
        const sign_color = (d: number) => (d < -DET_ZERO ? c.purple : d > DET_ZERO ? c.gold : c.coral);

        const grid = transformed_grid(plane, () => M.get());
        grid.group.name = 'grid';
        const para = always_redraw(() => {
          const m = M.get(), o = plane.p(0, 0), a = plane.pv(col(m, 0)), b = plane.pv(col(m, 1));
          const s: P3 = [a[0] + b[0] - o[0], a[1] + b[1] - o[1], 0];
          const col_ = sign_color(det2(m));
          return filled_polygon([o, a, s, b], plane.box, col_, 0.3, col_, 3);
        });
        para.name = 'parallelogram';
        const [i_hat, j_hat] = basis_arrows(plane, M);
        const [li, lj] = basis_labels(plane, M, ['\\hat{\\imath}', '\\hat{\\jmath}']);
        // |det| written inside the parallelogram, while it is wide enough to hold it
        const area = readout('', () => Math.abs(det()), { decimals: 2, font_size: 34 });
        area.add_updater((m: any) => {
          const q = M.get(), w: Vec2 = [(q[0][0] + q[0][1]) / 2, (q[1][0] + q[1][1]) / 2];
          const side = Math.max(norm2(col(q, 0)), norm2(col(q, 1)), 1e-9);
          const thick = (Math.abs(det2(q)) / side) * plane.unit;
          const show = thick > 0.75 && plane.inside(w, 0.5) && Math.min(norm2(col(q, 0)), norm2(col(q, 1))) * plane.unit > 1.2;
          m.move_to(plane.pv(w));
          const k = show ? 1 : 0;
          if (m._k !== k) {
            m.set_opacity(k);
            m._k = k;
          }
        });
        area.name = 'area_label';
        // orientation: the short turn from î to ĵ
        const orient = always_redraw(() => {
          const m = M.get(), a1 = angle_of(col(m, 0)), sweep = wrap_pi(angle_of(col(m, 1)) - a1);
          const r = 0.55, d = det2(m);
          const arc: any = Arc({ radius: r, start_angle: a1, angle: Math.abs(sweep) < 0.25 ? 0.25 * Math.sign(sweep || 1) : sweep, arc_center: plane.p(0, 0), stroke_color: sign_color(d), stroke_width: 4 });
          arc.add_tip({ tip_length: 0.16 });
          if (Math.abs(sweep) < 0.3 || norm2(col(m, 0)) * plane.unit < 0.7 || norm2(col(m, 1)) * plane.unit < 0.7) arc.set_opacity(0);
          return arc;
        });
        orient.name = 'orientation';

        const mat = new LiveMatrix(() => M.get(), { decimals: 1, font_size: 44, colors: [c.good, c.coral] });
        mat.name = 'matrix';
        const X0 = PANEL.x0 + 0.12;
        const at = (m: any, y: number) => m.move_to([X0 + m.width / 2, y, 0]);
        const top = VGroup(tex('A =', 48), mat).arrange(RIGHT, { buff: 0.25 });
        at(top, 2.75);
        mat.update(0);
        const formula = at(texs([['\\det A', undefined], ['=', undefined], ['a', c.good], ['d', c.coral], ['-', undefined], ['b', c.coral], ['c', c.good]], 44), 1.3);
        formula.name = 'det_formula';
        const det_ro = at(readout('\\det A =', det, { decimals: 2, font_size: 48, color_of: sign_color }), 0.3);
        det_ro.name = 'det_readout';
        const msg = (a: string, b: string, color: string) => VGroup(tex(a, 36, color), tex(b, 36, color)).arrange(DOWN, { buff: 0.16, aligned_edge: LEFT });
        const message = switcher([
          msg('\\text{areas are scaled by } |\\det A|', '\\text{orientation is kept}', c.gold),
          msg('\\det A = 0:\\ \\text{the plane is}', '\\text{squashed onto a line}', c.coral),
          msg('\\det A < 0:\\ \\text{the orientation}', '\\text{is flipped}', c.purple),
        ], () => (det() > DET_ZERO ? 0 : det() < -DET_ZERO ? 2 : 1), [X0, -1.05]);
        message.name = 'det_message';

        this.play(Create(grid.group, { lag_ratio: 0.02 }), { run_time: 1.3 });
        this.play(GrowArrow(i_hat), GrowArrow(j_hat), FadeIn(li), FadeIn(lj), { run_time: 0.9 });
        area.update(0);
        this.play(DrawBorderThenFill(para), FadeIn(area), Create(orient), { run_time: 1.2 });
        this.play(Write(top), { run_time: 1 });
        this.bring_to_front(i_hat, j_hat, li, lj, area);
        this.play(M.morph(I, A, { run_time: 3 }));
        det_ro.update(0);
        this.play(Write(formula), FadeIn(det_ro), { run_time: 1.2 });
        message.update(0);
        this.play(FadeIn(message), { run_time: 0.8 });
        this.wait(1);
        if (p.show_collapse && cf) {
          this.play(M.morph(A, cf.flat, { run_time: 2.5 }));
          this.play(Flash(plane.p(0, 0), { color: c.coral, flash_radius: 0.4, line_length: 0.3 }), { run_time: 1 });
          this.wait(0.8);
          this.play(M.morph(cf.flat, cf.flipped, { run_time: 2 }));
          this.wait(1.2);
          this.play(M.morph(cf.flipped, A, { run_time: 2.5 }));
        } else if (Math.abs(det2(A)) <= DET_ZERO) {
          this.play(Flash(plane.p(0, 0), { color: c.coral, flash_radius: 0.4, line_length: 0.3 }), { run_time: 1 });
        }
        this.wait(1.5);
      }
    }
    return new DeterminantArea();
  },
  explore: (scene: any, ui) => {
    basis_handles(ui, scene.plane, scene.M);
  },
});
