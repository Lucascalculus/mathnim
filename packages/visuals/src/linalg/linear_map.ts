// "A matrix is where the basis vectors land": a 2x2 matrix acting on the grid.
// The grid, î and ĵ morph from the identity to A while the matrix entries
// follow; then a vector v = x î + y ĵ is shown landing on x (Aî) + y (Aĵ).
// Explore: drag the tips of î and ĵ; grid, matrix and Av follow live.
import { Create, FadeIn, FadeOut, Flash, GrowArrow, Indicate, Scene, VGroup, Write, always_redraw, DOWN, LEFT, RIGHT } from 'manim-web';
import { palette } from '../theme';
import { define_visual } from '../visual';
import { LANG_SPEC, MatrixTrackers, LiveMatrix, PANEL, STAGE, backed, basis_arrows, basis_handles, basis_labels, clip_segment, clipped, dashed, fit_plane, follow_tip, live_arrow, mix, resolve_lang, tex, texs, transformed_grid, visible_when, zh_words, type Plane } from './kit';
import { apply2, det2, fmt, mat2, norm2, type Mat2, type Vec2 } from './math';

export interface LinearMapParams extends Record<string, unknown> {
  A: number[][];
  v: number[];
  show_vector: boolean;
  /** 'en', 'zh' or 'auto' (the learner's language). */
  lang: string;
}

const I: Mat2 = [[1, 0], [0, 1]];

export const linear_map = define_visual<LinearMapParams>({
  name: 'linear_map',
  summary: "A 2x2 matrix acting on the grid: î and ĵ move to A's columns (a matrix is where the basis vectors land); optionally v = xî + yĵ lands on x·Aî + y·Aĵ. Student drags the tips of î and ĵ; grid and matrix entries follow.",
  topics: ['linear algebra', 'matrices', 'linear transformations', 'basis vectors'],
  params: {
    A: { type: 'matrix', rows: 2, cols: 2, min: -3, max: 3, default: [[2, -1], [1, 1]], doc: 'the matrix, rows first: [[a, b], [c, d]]; î lands on (a, c), ĵ on (b, d)' },
    v: { type: 'vector', length: 2, min: -3, max: 3, default: [-1, 2], doc: 'the example vector v = x î + y ĵ that is followed through the map' },
    show_vector: { type: 'boolean', default: true, doc: 'show v and the step Av = x(Aî) + y(Aĵ); false keeps only grid, î, ĵ and the matrix' },
    lang: LANG_SPEC,
  },
  examples: [{}, { A: [[0, -1], [1, 0]], v: [2, 1] }, { A: [[1, 2], [0.5, 1]], show_vector: false }, { A: [[1, 2], [1, -1]], v: [1, 1] }, { lang: 'zh' }, { A: [[1, 2], [0.5, 1]], show_vector: false, lang: 'zh' }],
  ids: ['grid', 'i_hat', 'j_hat', 'matrix', 'columns_text', 'vector_v', 'combination'],
  scene: (p) => {
    const A = mat2(p.A), v: Vec2 = [p.v[0], p.v[1]];
    const zh = resolve_lang(p.lang) === 'zh';
    class LinearMap extends Scene {
      M = new MatrixTrackers(I);
      plane!: Plane;
      override construct() {
        const c = palette();
        const { M } = this;
        this.track(...M.t);
        const Av = apply2(A, v);
        const extent = Math.max(2.4, norm2([A[0][0], A[1][0]]), norm2([A[0][1], A[1][1]]), ...(p.show_vector ? [norm2(v), norm2(Av)] : [])) + 0.5;
        const plane = fit_plane(STAGE, [-2.5, 0], extent, 0.95);
        this.plane = plane;
        const grid = transformed_grid(plane, () => M.get());
        grid.group.name = 'grid';
        const ci = () => M.col(0), cj = () => M.col(1);
        const [i_hat, j_hat] = basis_arrows(plane, M);
        const box = { x0: STAGE.x0 + 0.1, x1: STAGE.x1 - 0.1, y0: STAGE.y0 + 0.1, y1: STAGE.y1 - 0.1 };
        const [li, lj] = basis_labels(plane, M, ['\\hat{\\imath}', '\\hat{\\jmath}']);
        const mat = new LiveMatrix(() => M.get(), { decimals: 1, font_size: 44, colors: [c.good, c.coral] });
        mat.name = 'matrix';
        const eqA = tex('A =', 48);
        VGroup(eqA, mat).arrange(RIGHT, { buff: 0.25 }).move_to([PANEL.x0 + 0.1, 2.75, 0], { aligned_edge: LEFT });
        mat.update(0);
        const X0 = PANEL.x0 + 0.12;
        const at = (m: any, y: number) => m.move_to([X0 + m.width / 2, y, 0]);

        this.play(Create(grid.group, { lag_ratio: 0.02 }), { run_time: 1.4 });
        this.play(GrowArrow(i_hat), GrowArrow(j_hat), FadeIn(li), FadeIn(lj), { run_time: 1 });
        this.play(Write(eqA), FadeIn(mat), { run_time: 1 });
        this.wait(0.4);

        // the example vector, as a combination of î and ĵ
        let va: any = null, eq_v: any = null;
        const Vt = () => apply2(M.get(), v);
        // coefficients as a reader writes them: î + 2ĵ, −î, 2ĵ ...
        const coef = (k: number, first: boolean) => (k === 1 ? (first ? '' : '+') : k === -1 ? '-' : `${!first && k >= 0 ? '+' : ''}${fmt(k)}`);
        const combo = (lhs: [string, string], a: [string, string], b: [string, string], size: number) => {
          const parts: [string, string?][] = [lhs, ['=']];
          if (v[0] !== 0) parts.push([coef(v[0], true)], a);
          if (v[1] !== 0) parts.push([coef(v[1], v[0] === 0)], b);
          if (v[0] === 0 && v[1] === 0) parts.push(['\\vec 0']);
          return texs(parts.filter((q) => q[0] !== ''), size);
        };
        if (p.show_vector) {
          va = live_arrow(() => clipped(plane, Vt()), c.gold, 6);
          va.name = 'vector_v';
          const lv = follow_tip(backed(tex('\\vec v', 40, c.gold), 0.75), () => clipped(plane, Vt()), 0.1, box);
          // x î then y ĵ, drawn head to tail (they move with the grid)
          const legs = always_redraw(() => {
            const a = plane.p(0, 0), m = apply2(M.get(), [v[0], 0]), e = Vt();
            const seg1 = clip_segment(a, plane.pv(m), plane.box), seg2 = clip_segment(plane.pv(m), plane.pv(e), plane.box);
            return VGroup(dashed(seg1?.[0] ?? a, seg1?.[1] ?? a, c.good, 4), dashed(seg2?.[0] ?? a, seg2?.[1] ?? a, c.coral, 4));
          });
          eq_v = at(combo(['\\vec v', c.gold], ['\\hat{\\imath}', c.good], ['\\hat{\\jmath}', c.coral], 44), -0.3);
          this.play(Create(legs), { run_time: 1.2 });
          this.play(GrowArrow(va), FadeIn(lv), Write(eq_v), { run_time: 1.2 });
          this.wait(0.5);
        }

        // the transformation: columns turn and stretch to A's columns
        this.play(M.morph(I, A, { run_time: 3 }));
        const [lAi, lAj] = basis_labels(plane, M, ['A\\hat{\\imath}', 'A\\hat{\\jmath}'], 38);
        this.play(FadeOut(li), FadeOut(lj), FadeIn(lAi), FadeIn(lAj), { run_time: 0.8 });
        const w1 = at(zh ? mix(['第 1 列', ['= A\\hat{\\imath}']], 38, c.good) : texs([['\\text{column 1} = A\\hat{\\imath}', c.good]], 38), 1.4);
        const w2 = at(zh ? mix(['第 2 列', ['= A\\hat{\\jmath}']], 38, c.coral) : texs([['\\text{column 2} = A\\hat{\\jmath}', c.coral]], 38), 0.78);
        const where = VGroup(w1, w2);
        where.name = 'columns_text';
        const up = [0, 0.15, 0];
        this.play(Indicate(mat.entries[0][0], { color: c.good, scale_factor: 1.3 }), Indicate(mat.entries[1][0], { color: c.good, scale_factor: 1.3 }), FadeIn(w1, { shift: up }), Flash(clipped(plane, ci())[1], { color: c.good, flash_radius: 0.25 }), { run_time: 1.2 });
        this.play(Indicate(mat.entries[0][1], { color: c.coral, scale_factor: 1.3 }), Indicate(mat.entries[1][1], { color: c.coral, scale_factor: 1.3 }), FadeIn(w2, { shift: up }), Flash(clipped(plane, cj())[1], { color: c.coral, flash_radius: 0.25 }), { run_time: 1.2 });
        this.add(where);
        if (!p.show_vector) {
          // when the columns are parallel the whole plane lands on one line (shown live while dragging)
          const flat = zh
            ? VGroup(zh_words('两列平行：整个平面', 34, c.coral), zh_words('落到同一条直线上', 34, c.coral)).arrange(DOWN, { buff: 0.12, aligned_edge: LEFT })
            : VGroup(tex('\\text{columns parallel: the whole}', 34, c.coral), tex('\\text{plane lands on one line}', 34, c.coral)).arrange(DOWN, { buff: 0.12, aligned_edge: LEFT });
          flat.move_to([X0 + flat.width / 2, -0.4, 0]);
          flat.name = 'collapse_note';
          visible_when(flat, () => Math.abs(det2(M.get())) < 0.05);
          this.add(flat);
          this.wait(0.6);
        }

        if (p.show_vector && eq_v) {
          const Av = apply2(A, v);
          const eq_Av = at(combo(['A\\vec v', c.gold], ['A\\hat{\\imath}', c.good], ['A\\hat{\\jmath}', c.coral], 44), -1.2);
          // live: stays right while the student drags î and ĵ
          const col_v = new LiveMatrix(() => { const w = Vt(); return [[w[0]], [w[1]]]; }, { decimals: 1, font_size: 44, colors: [c.gold] });
          const res = VGroup(tex('=', 44), col_v).arrange(RIGHT, { buff: 0.2 });
          col_v.update(0);
          at(res, -2.55).shift([0.55, 0, 0]);
          this.play(Write(eq_Av), { run_time: 1.2 });
          this.play(FadeIn(res, { shift: [0.2, 0, 0] }), Flash(clipped(plane, Av)[1], { color: c.gold, flash_radius: 0.3 }), { run_time: 1.2 });
          const combination = VGroup(eq_v, eq_Av, res);
          combination.name = 'combination';
          this.add(combination);
        }
        this.wait(1.5);
      }
    }
    return new LinearMap();
  },
  explore: (scene: any, ui, p) => {
    basis_handles(ui, scene.plane, scene.M, 3, STAGE, resolve_lang(p.lang));
  },
});
