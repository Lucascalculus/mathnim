// A rank-1 update W = W₀ + u vᵀ (one column u of B times one row vᵀ of A in
// LoRA's ΔW = BA) acting on the plane. The grid of W₀ morphs into the grid of
// W; every input x changes by u (v·x): always along u, by an amount that only
// depends on the part of x along v. Inputs on the line perpendicular to v are
// not changed at all.
// Story: u and v appear, the grid morphs, the unchanged line lights up, then a
// probe x travels once around and its change follows.
// Explore: drag the tips of u, v and x.
import { Create, FadeIn, GrowArrow, Scene, UpdateFromAlphaFunc, VGroup, ValueTracker, Write, linear, smooth, DOWN, LEFT, RIGHT } from 'manim-web';
import { palette } from '../../theme';
import { define_visual } from '../../visual';
import { LANG_SPEC, pick, resolve_lang, type Lang } from '../f/kit';
import { LiveMatrix, PANEL, STAGE, backed, clip_line, clipped, fit_plane, live_arrow, live_path, path, readout, segment_points, tex, texs, transformed_grid, MatrixTrackers, type Plane } from '../../linalg/kit';
import { apply2, dot2, mat2, norm2, type Mat2, type Vec2 } from '../../linalg/math';
import { clamp, emit, listen, tip_labels, txt, type Listener, type P3 } from './kit';

export interface RankOneUpdateParams extends Record<string, unknown> {
  W0: number[][];
  u: number[];
  v: number[];
  x: number[];
  show_null_line: boolean;
  lang: string;
}

const RANGE = 3;
const snap = (x: number) => Math.round(x * 10) / 10;

/** W₀ + t·u vᵀ. */
export function rank_one(W0: Mat2, u: Vec2, v: Vec2, t = 1): Mat2 {
  return [[W0[0][0] + t * u[0] * v[0], W0[0][1] + t * u[0] * v[1]], [W0[1][0] + t * u[1] * v[0], W0[1][1] + t * u[1] * v[1]]];
}
/** The change of the output for input x: u (v·x). */
export const change_of = (u: Vec2, v: Vec2, x: Vec2): Vec2 => [u[0] * dot2(v, x), u[1] * dot2(v, x)];
/** Largest entry difference between two matrices (for goals such as "make [[1, 1], [0, 1]]"). */
export const mat_dist = (a: Mat2, b: Mat2): number => Math.max(...[0, 1].flatMap((i) => [0, 1].map((j) => Math.abs(a[i][j] - b[i][j]))));

export const rank_one_update = define_visual<RankOneUpdateParams>({
  name: 'rank_one_update',
  summary: 'A rank-1 update W = W₀ + u vᵀ on the plane (LoRA with r = 1: u is the column of B, vᵀ the row of A). The grid of W₀ morphs into W; any input x changes by u(v·x), always along u; inputs on the line perpendicular to v do not change. Student drags u, v and a probe x.',
  topics: ['lora', 'low rank', 'rank one', 'fine-tuning', 'linear algebra', 'outer product'],
  params: {
    W0: { type: 'matrix', rows: 2, cols: 2, min: -2, max: 2, default: [[1, 0], [0, 1]], doc: 'the frozen matrix W₀ (rows first); e.g. [[1,0],[0,1]] or [[1.2,0.3],[0.1,0.9]]' },
    u: { type: 'vector', length: 2, min: -3, max: 3, default: [0.5, 1], doc: 'output direction u (the column of B): every change points along u' },
    v: { type: 'vector', length: 2, min: -3, max: 3, default: [1, 0], doc: 'input direction v (the row of A): only the part of x along v matters' },
    x: { type: 'vector', length: 2, min: -3, max: 3, default: [1, 1], doc: 'the probe input x' },
    show_null_line: { type: 'boolean', default: true, doc: 'highlight the line perpendicular to v (inputs there are unchanged)' },
    lang: LANG_SPEC,
  },
  examples: [
    {},
    { u: [1, 0], v: [0, 1], x: [1, 0], lang: 'zh' },
    { W0: [[1.2, 0.3], [0.1, 0.9]], u: [-0.6, 0.8], v: [0.7, 0.7], x: [-1, 1.5] },
    { u: [0, 0], v: [1, 1], x: [2, -1], lang: 'zh' },
    { u: [2.5, -1], v: [0, 0], x: [-2, -2], show_null_line: false },
  ],
  ids: ['grid', 'grid_W0', 'arrow_u', 'arrow_v', 'arrow_x', 'arrow_W0x', 'arrow_change', 'arrow_Wx', 'null_line', 'labels', 'title_formula', 'uv_matrix', 'W_matrix', 'formula', 'dot_readout', 'rule'],
  scene: (p) => {
    const lang: Lang = resolve_lang(p.lang);
    const L = (en: string, zh: string) => pick(lang, en, zh);
    const W0: Mat2 = mat2(p.W0);
    const identity = W0[0][0] === 1 && W0[0][1] === 0 && W0[1][0] === 0 && W0[1][1] === 1;
    class RankOneUpdate extends Scene {
      /** u = (u[0], u[1]): the column of B (output direction). */
      u: [ValueTracker, ValueTracker] = [ValueTracker(p.u[0]), ValueTracker(p.u[1])];
      /** v = (v[0], v[1]): the row of A (input direction). */
      v: [ValueTracker, ValueTracker] = [ValueTracker(p.v[0]), ValueTracker(p.v[1])];
      /** The probe input x. */
      x: [ValueTracker, ValueTracker] = [ValueTracker(p.x[0]), ValueTracker(p.x[1])];
      /** The frozen W₀ (four trackers a, b, c, d). */
      W0 = new MatrixTrackers(W0);
      /** How much of the update is applied (0 = W₀, 1 = W₀ + u vᵀ); 1 after the story. */
      t = ValueTracker(0);
      /** Story flags (trackers, so seeking is exact): the probe and the unchanged line are shown. */
      probe_on = ValueTracker(0);
      null_on = ValueTracker(0);
      plane!: Plane;
      uv = (): Vec2 => [this.u[0].get_value(), this.u[1].get_value()];
      vv = (): Vec2 => [this.v[0].get_value(), this.v[1].get_value()];
      xv = (): Vec2 => [this.x[0].get_value(), this.x[1].get_value()];
      /** The current W = W₀ + t·u vᵀ. */
      W(): Mat2 {
        return rank_one(this.W0.get(), this.uv(), this.vv(), this.t.get_value());
      }
      /** u vᵀ. */
      delta_W(): Mat2 {
        return rank_one([[0, 0], [0, 0]], this.uv(), this.vv(), 1);
      }
      /** v·x. */
      vx(): number {
        return dot2(this.vv(), this.xv());
      }
      /** The change of the probe's output, t·u(v·x). */
      change(): Vec2 {
        const d = change_of(this.uv(), this.vv(), this.xv()), t = this.t.get_value();
        return [d[0] * t, d[1] * t];
      }
      /** Set u, v, x at once (any of them). */
      set(o: { u?: Vec2; v?: Vec2; x?: Vec2 }): void {
        for (const k of ['u', 'v', 'x'] as const) if (o[k]) (this as any)[k].forEach((tr: ValueTracker, i: number) => tr.set_value(o[k]![i]));
      }
      /** Subscribe to the learner's drags: f('u' | 'v' | 'x', { value: [x, y] }) when a drag ends. */
      listen(f: Listener): void {
        listen(this, f);
      }
      override construct() {
        const c = palette();
        const { t } = this;
        this.track(...this.u, ...this.v, ...this.x, ...this.W0.t, t, this.probe_on, this.null_on);
        const probe = () => this.probe_on.get_value() > 0.5;
        const plane = fit_plane(STAGE, [-2.5, 0], 3.6, 1.05);
        this.plane = plane;
        const box = { x0: STAGE.x0 + 0.08, x1: STAGE.x1 - 0.08, y0: STAGE.y0 + 0.08, y1: STAGE.y1 - 0.08 };
        const grid = transformed_grid(plane, () => this.W());
        // with W₀ ≠ I, W₀'s own grid is the reference (no third, square grid)
        const grid_named = identity ? grid.group : VGroup(grid.lines, grid.axes);
        grid_named.name = 'grid';
        // W₀'s own grid (faint) when it is not the identity: the "before" picture
        const g0 = transformed_grid(plane, () => this.W0.get(), { background: false, line_opacity: 0.35, width: 1.5 });
        g0.lines.set_stroke({ color: c.muted });
        g0.axes.set_stroke({ color: c.muted, opacity: 0.5 });
        const grid_W0 = identity ? VGroup() : g0.group;
        grid_W0.name = 'grid_W0';
        // the unchanged line: perpendicular to v
        const null_line = live_path(path(c.purple, 6, 0.85), () => {
          const v = this.vv();
          if (norm2(v) < 0.05 || !p.show_null_line) return new Float64Array(0);
          const seg = clip_line(plane.p(0, 0), [-v[1], v[0]], box);
          return seg ? segment_points([seg]) : new Float64Array(0);
        }, () => `${this.vv()[0].toFixed(4)},${this.vv()[1].toFixed(4)}`);
        null_line.name = 'null_line';

        const arrow_u = live_arrow(() => clipped(plane, this.uv()), c.coral, 7);
        const arrow_v = live_arrow(() => clipped(plane, this.vv()), c.good, 7);
        const arrow_x = live_arrow(() => clipped(plane, this.xv()), c.gold, 6);
        const W0x = (): Vec2 => apply2(this.W0.get(), this.xv());
        const Wx = (): Vec2 => apply2(this.W(), this.xv());
        const arrow_W0x = live_arrow(() => clipped(plane, W0x()), c.muted, 5, 0.22, () => (identity ? 0 : 0.9));
        const arrow_Wx = live_arrow(() => clipped(plane, Wx()), c.accent, 6);
        // the change u(v·x), from the tip of W₀x to the tip of Wx (along u)
        const arrow_change = live_arrow(() => {
          const a = plane.pv(W0x()), b = plane.pv(Wx());
          const seg = clip_line(a, [b[0] - a[0], b[1] - a[1]], box, 0, 1);
          return seg ? [seg[0], seg[1]] : [a, a];
        }, c.coral, 5, 0.2);
        arrow_u.name = 'arrow_u';
        arrow_v.name = 'arrow_v';
        arrow_x.name = 'arrow_x';
        arrow_W0x.name = 'arrow_W0x';
        arrow_Wx.name = 'arrow_Wx';
        arrow_change.name = 'arrow_change';

        // labels beyond the tips, never on top of each other
        const lab = (s: string, col: string, size = 40) => backed(tex(s, size, col), 0.8);
        const l_u = lab('\\vec u', c.coral), l_v = lab('\\vec v', c.good), l_x = lab('\\vec x', c.gold, 38);
        const l_W0x = lab('W_0\\vec x', c.muted, 34), l_Wx = lab('W\\vec x', c.accent, 36);
        const null_words = backed(txt(L('inputs here: unchanged', '这条线上的输入不变'), 24, c.purple), 0.85);
        const vec_tip = (w: () => Vec2) => () => clipped(plane, w()) as [P3, P3];
        const null_tip = (): [P3, P3] => {
          // a point on the unchanged line, the label pushed sideways (along v) so it does not sit on the line
          const v = this.vv(), n = norm2(v) || 1, d: Vec2 = [-v[1] / n, v[0] / n], s = d[1] < 0 ? -1 : 1;
          const r = plane.reach() * 0.72, q: Vec2 = [s * d[0] * r, s * d[1] * r];
          return [plane.pv([q[0] - v[0] / n, q[1] - v[1] / n]), plane.pv(q)];
        };
        const labels = tip_labels([
          { m: l_v, tip: vec_tip(this.vv) },
          { m: l_u, tip: vec_tip(this.uv) },
          { m: l_x, tip: vec_tip(this.xv), visible: probe },
          { m: l_W0x, tip: vec_tip(W0x), visible: () => !identity && probe(), optional: true },
          { m: l_Wx, tip: vec_tip(Wx), visible: () => probe() && norm2(this.change()) > 0.04 },
          { m: null_words, tip: null_tip, visible: () => p.show_null_line && norm2(this.vv()) >= 0.05 && this.null_on.get_value() > 0.5, optional: true },
        ], box, () => {
          // keep the words off the unchanged line itself
          const v = this.vv(), n = norm2(v);
          if (n < 0.05 || !p.show_null_line) return [];
          const out = [];
          for (let k = -14; k <= 14; k++) {
            const q = plane.pv([(-v[1] / n) * k * 0.3, (v[0] / n) * k * 0.3]);
            out.push({ x0: q[0] - 0.06, x1: q[0] + 0.06, y0: q[1] - 0.06, y1: q[1] + 0.06 });
          }
          return out;
        });
        labels.name = 'labels';

        // ---- panel: u, v, u vᵀ, W, the formula and v·x
        const X0 = PANEL.x0 + 0.05;
        const at = (m: any, y: number) => m.move_to([X0 + m.width / 2, y, 0]);
        const title = texs([['W'], ['='], ['W_0'], ['+'], ['\\vec u', c.coral], ['\\vec v^{\\top}', c.good]], 40);
        title.name = 'title_formula';
        const lm = (get: () => number[][], colors?: (string | null)[]) => new LiveMatrix(get, { decimals: 1, font_size: 30, colors, col_gap: 0.3, row_gap: 0.22, width_hint: -8.8 });
        const col_u = lm(() => [[this.uv()[0]], [this.uv()[1]]], [c.coral]);
        const row_v = lm(() => [[this.vv()[0], this.vv()[1]]], [c.good, c.good]);
        const u_eq = VGroup(texs([['\\vec u', c.coral], ['=']], 34), col_u).arrange(RIGHT, { buff: 0.15 });
        const v_eq = VGroup(texs([['\\vec v^{\\top}', c.good], ['=']], 34), row_v).arrange(RIGHT, { buff: 0.15 });
        const uv_line = VGroup(u_eq, v_eq).arrange(RIGHT, { buff: 0.45 });
        const uv_mat = lm(() => this.delta_W(), [c.coral, c.coral]);
        const uv_eq = VGroup(texs([['\\vec u', c.coral], ['\\vec v^{\\top}', c.good], ['=']], 34), uv_mat).arrange(RIGHT, { buff: 0.15 });
        uv_eq.name = 'uv_matrix';
        const W0_mat = lm(() => this.W0.get(), [c.muted, c.muted]);
        const W0_eq = VGroup(tex('W_0 =', 34, c.muted), W0_mat).arrange(RIGHT, { buff: 0.15 });
        W0_eq.name = 'W0_matrix';
        const W_mat = lm(() => this.W());
        const W_eq = VGroup(tex('W =', 34), W_mat).arrange(RIGHT, { buff: 0.15 });
        W_eq.name = 'W_matrix';
        const formula = texs([['W\\vec x', c.accent], ['='], ['W_0\\vec x', c.muted], ['+'], ['\\vec u', c.coral], ['\\,(\\vec v\\cdot\\vec x)', c.good]], 36);
        formula.name = 'formula';
        const dot_ro = readout('\\vec v\\cdot\\vec x =', () => this.vx(), { decimals: 2, font_size: 34, color: c.good });
        dot_ro.name = 'dot_readout';
        const rule = VGroup(
          txt(L('the change is always along u;', '改动总是沿 u 的方向；'), 24, c.ink),
          txt(L('its size is set by v·x alone', '大小只由 v·x 决定'), 24, c.ink),
        ).arrange(DOWN, { buff: 0.1, aligned_edge: LEFT });
        // stack the panel rows from the top, evenly spaced, each at most the panel's width
        const rows_ = [title, uv_line, uv_eq, ...(identity ? [] : [W0_eq]), W_eq, formula, dot_ro, rule];
        for (const r of rows_) if (r.width > PANEL.x1 - X0) r.scale((PANEL.x1 - X0) / r.width);
        const room = 7.55 - rows_.reduce((q, r) => q + r.height, 0), gap = room / (rows_.length - 1);
        let ytop = 3.78;
        for (const r of rows_) {
          at(r, ytop - r.height / 2);
          ytop -= r.height + gap;
        }
        for (const m of [col_u, row_v, uv_mat, W0_mat, W_mat]) m.update(0);
        rule.name = 'rule';

        // ---- the story
        if (identity) this.add(grid.background);
        this.play(Create(VGroup(grid.lines, grid.axes), { lag_ratio: 0.02 }), FadeIn(grid_W0), { run_time: 1.2 });
        this.add(labels);
        this.play(GrowArrow(arrow_v), GrowArrow(arrow_u), FadeIn(title), FadeIn(uv_line), { run_time: 1.2 });
        this.play(FadeIn(uv_eq), ...(identity ? [] : [FadeIn(W0_eq)]), FadeIn(W_eq), { run_time: 0.9 });
        this.play(t.animate.set_value(1), { run_time: 3, rate_func: smooth });
        this.null_on.set_value(1);
        this.play(Create(null_line), { run_time: 1.2 });
        this.probe_on.set_value(1);
        this.play(GrowArrow(arrow_x), GrowArrow(arrow_W0x), GrowArrow(arrow_Wx), FadeIn(arrow_change), { run_time: 1.2 });
        dot_ro.update(0);
        this.play(Write(formula), FadeIn(dot_ro), { run_time: 1.2 });
        // the probe goes once around: the change stays along u and vanishes on the purple line
        const x0 = this.xv(), r0 = Math.max(1, norm2(x0)), a0 = Math.atan2(x0[1], x0[0]);
        const r1 = Math.min(r0, 2.4);
        this.play(UpdateFromAlphaFunc(this.x[0], (_m: unknown, al?: number) => {
          const a = a0 + 2 * Math.PI * (al ?? 1), k = Math.sin(Math.PI * (al ?? 1)) ** 2, r = r0 + (r1 - r0) * k;
          const q: Vec2 = (al ?? 1) >= 1 ? x0 : [r * Math.cos(a), r * Math.sin(a)];
          this.x[0].set_value(q[0]);
          this.x[1].set_value(q[1]);
        }, { run_time: 6, rate_func: linear }));
        this.play(FadeIn(rule), { run_time: 1 });
        this.add(grid_named, title, uv_line, uv_eq, ...(identity ? [] : [W0_eq]), W_eq, formula, dot_ro, rule);
        this.wait(1.5);
      }
    }
    return new RankOneUpdate();
  },
  explore: (scene: any, ui, p) => {
    const L = (en: string, zh: string) => pick(resolve_lang(p.lang), en, zh);
    const plane: Plane = scene.plane;
    const box = { x0: STAGE.x0 + 0.25, x1: STAGE.x1 - 0.25, y0: STAGE.y0 + 0.25, y1: STAGE.y1 - 0.25 };
    const handle = (key: 'u' | 'v' | 'x', label: string) => {
      const tr: [ValueTracker, ValueTracker] = scene[key];
      ui.add_handle({
        get: (): P3 => {
          const w: Vec2 = [tr[0].get_value(), tr[1].get_value()];
          return plane.inside(w, 0.05) ? plane.pv(w) : clipped(plane, w)[1];
        },
        set: (pt: P3) => {
          const [a, b] = plane.to_math(pt);
          tr[0].set_value(clamp(snap(a), -RANGE, RANGE));
          tr[1].set_value(clamp(snap(b), -RANGE, RANGE));
        },
        constraint: (pt: P3): P3 => [clamp(pt[0], box.x0, box.x1), clamp(pt[1], box.y0, box.y1), 0],
        step: plane.unit * 0.1,
        radius: 0.4,
        label,
        on_end: () => emit(scene, key, { value: [tr[0].get_value(), tr[1].get_value()] }),
      });
    };
    // the probe first, so it wins when it sits on top of u or v
    handle('x', L('the probe input x', '探针输入 x'));
    handle('u', L('the tip of u, the column of B: the direction every change points in', 'u 的箭头尖（B 的一列）：所有改动指向的方向'));
    handle('v', L('the tip of v, the row of A: the input direction that is measured', 'v 的箭头尖（A 的一行）：被读取的输入方向'));
  },
});
