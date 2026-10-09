// Padding vs packing: four examples of different lengths, three ways to batch
// them. Padding: four rows padded to the longest (waste = 1 - Σn / (4·max n)).
// Naive packing: one row, plain causal attention - later examples attend to
// earlier, unrelated ones (cross-example cells = 1 - Σ n_k(n_k+1) / (N(N+1))).
// Boundary-aware packing: one row, position_ids restart at every example and a
// variable-length attention kernel keeps each example to itself: no waste, no
// cross-attention. All numbers are exact.
// Explore: drag the end of each example; pick the batching.
import { DecimalNumber, FadeIn, GrowFromEdge, Indicate, LaggedStart, MathTex, Scene, VGroup, VMobject, ValueTracker, always_redraw, LEFT } from 'manim-web';
import { palette } from '../../theme';
import { define_visual } from '../../visual';
import { box, fit, label } from '../f/kit';
import { LANG_SPEC, choice, clamp, hatch, idx, pick, readout, rect, resolve_lang, seg, type Lang } from './kit';

export interface AttentionMaskPackingParams extends Record<string, unknown> {
  lengths: number[];
  mode: string;
  lang: string;
}

/** Fraction of a padded batch (rows padded to the longest) that is padding. */
export function padding_waste(n: readonly number[]): number {
  const mx = Math.max(...n), s = n.reduce((a, b) => a + b, 0);
  return mx > 0 ? 1 - s / (n.length * mx) : 0;
}
/** Fraction of the causal attention cells of one packed row that cross example boundaries (naive packing). */
export function cross_fraction(n: readonly number[]): number {
  const N = n.reduce((a, b) => a + b, 0);
  if (N <= 0) return 0;
  const within = n.reduce((a, k) => a + k * (k + 1), 0);
  return 1 - within / (N * (N + 1));
}
/** position_ids of a packed row: one ramp (naive) or a ramp per example (boundary-aware). */
export function position_ids(n: readonly number[], boundary: boolean): number[] {
  const out: number[] = [];
  let p = 0;
  for (const k of n) for (let i = 0; i < k; i++) out.push(boundary ? i : p++);
  return out;
}

const MAXN = 512, MINN = 8;
const BAR = { x0: -5.95, x1: 0.35, ys: [3.12, 2.66, 2.2, 1.74], h: 0.32 };
const MAT = { x0: 1.55, y1: 3.6, S: 3.3 };
const MODES = 3;

export const attention_mask_packing = define_visual<AttentionMaskPackingParams>({
  name: 'attention_mask_packing',
  summary: 'Padding vs packing for SFT: four examples of adjustable length batched by padding (waste = 1 - Σn/(4·max n)), naive packing (one row, causal attention crosses examples: 1 - Σn(n+1)/(N(N+1)) of the cells) or boundary-aware packing (position_ids restart, varlen attention: no waste, no cross-talk). Shows the batch, the attention matrix and position_ids. Drag the example ends; pick the batching.',
  topics: ['fine-tuning', 'sft', 'packing', 'padding', 'attention mask', 'position ids', 'throughput'],
  params: {
    lengths: { type: 'vector', length: 4, min: MINN, max: MAXN, default: [300, 60, 120, 40], doc: 'token counts of the four examples (8-512), e.g. [256,256,256,256] (equal: naive packing crosses 75% of cells) or [480,16,16,16] (padding wastes 72%)' },
    mode: { type: 'enum', values: ['pad', 'naive', 'boundary'], default: 'naive', doc: "'pad' (rows padded to the longest), 'naive' (packed, plain causal attention), 'boundary' (packed, position_ids reset + varlen attention)" },
    lang: LANG_SPEC,
  },
  examples: [{}, { lengths: [256, 256, 256, 256], lang: 'zh' }, { lengths: [480, 16, 16, 16], mode: 'pad' }, { mode: 'boundary', lang: 'zh' }, { lengths: [8, 8, 8, 8], mode: 'pad' }, { lengths: [512, 512, 512, 512], mode: 'naive', lang: 'zh' }],
  ids: ['examples', 'batch_view', 'attention_matrix', 'position_ids', 'mode_switch', 'waste_readout', 'cross_readout', 'formula'],
  scene: (p) => new PackingScene(p, resolve_lang(p.lang)),
  explore: (scene: any, ui) => scene.attach(ui),
});

export class PackingScene extends Scene {
  p: AttentionMaskPackingParams;
  lang: Lang;
  /** Token counts of the four examples. */
  n = [ValueTracker(300), ValueTracker(60), ValueTracker(120), ValueTracker(40)];
  /** 0 = padding, 1 = naive packing, 2 = boundary-aware packing. */
  mode = ValueTracker(1);
  mode_ctl: any;
  constructor(p: AttentionMaskPackingParams, lang: Lang) {
    super();
    this.p = p;
    this.lang = lang;
  }
  lengths(): number[] {
    return this.n.map((t) => Math.round(clamp(t.get_value(), MINN, MAXN)));
  }
  waste(): number {
    return padding_waste(this.lengths());
  }
  cross(): number {
    return cross_fraction(this.lengths());
  }
  mode_index(): number {
    return idx(this.mode, MODES);
  }
  /** Fraction of attention cells that cross examples in the current batching (0 unless naive). */
  cross_now(): number {
    return this.mode_index() === 1 ? this.cross() : 0;
  }
  /** Fraction of the batch that is padding in the current batching (0 when packed, padding-free). */
  waste_now(): number {
    return this.mode_index() === 0 ? this.waste() : 0;
  }
  set_lengths(v: number[]): void {
    v.forEach((x, i) => this.n[i].set_value(x));
  }
  attach(ui: any): void {
    const x_of = (v: number) => BAR.x0 + (clamp(v, MINN, MAXN) / MAXN) * (BAR.x1 - BAR.x0);
    this.n.forEach((t, i) => {
      ui.add_handle({
        tracker: t,
        from_value: (v: number) => [x_of(v), BAR.ys[i], 0],
        to_value: (pt: number[]) => Math.round(clamp(((pt[0] - BAR.x0) / (BAR.x1 - BAR.x0)) * MAXN, MINN, MAXN) / 8) * 8,
        step: 8,
        radius: 0.35,
        label: `${pick(this.lang, 'length of example', '样本长度')} ${i + 1}`,
      });
    });
    this.mode_ctl.attach(ui);
  }

  override construct() {
    const c = palette();
    const lang = this.lang;
    this.n.forEach((t, i) => {
      t.set_value(this.p.lengths[i] ?? 64);
      t.name = `length_${i + 1}`;
    });
    this.mode.set_value(['pad', 'naive', 'boundary'].indexOf(this.p.mode));
    this.mode.name = 'batching';
    this.track(this.mode, ...this.n);
    const cols = [c.accent, c.teal, c.purple, c.gold];

    // ---- the four examples (their ends are the handles)
    const ex_title = fit(label(pick(lang, 'four examples (tokens)', '四条样本（token 数）'), 22, c.muted), 6, 0.4);
    ex_title.move_to([-6.85 + ex_title.width / 2, 3.62, 0]);
    const x_of = (v: number) => BAR.x0 + (clamp(v, MINN, MAXN) / MAXN) * (BAR.x1 - BAR.x0);
    const bars = always_redraw(() => VGroup(...this.n.map((t, i) => rect(BAR.x0, BAR.ys[i] - BAR.h / 2, x_of(t.get_value()) - BAR.x0, BAR.h, cols[i], 0.85))));
    const tags = VGroup(...[0, 1, 2, 3].map((i) => fit(label(`#${i + 1}`, 22, cols[i]), 0.6, 0.35).move_to([-6.5, BAR.ys[i], 0])));
    const vals = VGroup(...this.n.map((t, i) => {
      const d: any = DecimalNumber(Math.round(t.get_value()), { num_decimal_places: 0, font_size: 24, color: c.ink });
      d._v = NaN;
      const upd = () => {
        const v = Math.round(clamp(t.get_value(), MINN, MAXN));
        if (d._v !== v) {
          d.set_value(v);
          d._v = v;
        }
        d.move_to([Math.min(x_of(v) + 0.12 + d.width / 2, 1.25 - d.width / 2), BAR.ys[i], 0]);
      };
      upd();
      d.add_updater(upd);
      return d;
    }));
    const examples = VGroup(ex_title, tags, bars, vals);
    examples.name = 'examples';

    // ---- what the GPU gets
    const view_title = always_redraw(() => {
      const k = this.mode_index();
      const s = [pick(lang, 'padded batch: 4 rows (grey = padding)', '填充：4 行（灰色是填充）'), pick(lang, 'one packed row, plain causal attention', '打包成一行，普通因果注意力'), pick(lang, 'one packed row, position_ids restart', '打包成一行，position_ids 逐条重置')][k];
      const m = fit(label(s, 22, c.muted), 7.6, 0.4);
      return m.move_to([-6.85 + m.width / 2, 1.18, 0]);
    });
    const VIEW = { x0: -6.85, x1: 0.6 };
    const batch_view = always_redraw(() => {
      const n = this.lengths(), k = this.mode_index();
      const g = VGroup();
      if (k === 0) {
        const mx = Math.max(...n), sc = (VIEW.x1 - VIEW.x0) / mx;
        n.forEach((len, i) => {
          const y = 0.78 - i * 0.4;
          g.add(rect(VIEW.x0, y - 0.15, len * sc, 0.3, cols[i], 0.85));
          if (mx - len > 0) {
            g.add(rect(VIEW.x0 + len * sc, y - 0.15, (mx - len) * sc, 0.3, c.muted, 0.22));
            g.add(hatch(VIEW.x0 + len * sc, y - 0.15, (mx - len) * sc, 0.3, c.muted, 0.18, 1.2, 0.6));
          }
        });
      } else {
        const N = n.reduce((a, b) => a + b, 0), sc = (VIEW.x1 - VIEW.x0) / N;
        let x = VIEW.x0;
        n.forEach((len, i) => {
          g.add(rect(x, 0.12, len * sc, 0.42, cols[i], 0.85));
          if (i > 0) g.add(seg([x, 0.04], [x, 0.62], c.ink, 2));
          x += len * sc;
        });
      }
      return g;
    });
    // position_ids of the packed row (a ramp, or a ramp per example)
    const PID = { y0: -1.95, h: 1.05 };
    const pid_plot = always_redraw(() => {
      const n = this.lengths(), k = this.mode_index();
      const g = VGroup();
      if (k === 0) return g;
      const N = n.reduce((a, b) => a + b, 0), sc = (VIEW.x1 - VIEW.x0) / N, top = Math.max(...(k === 2 ? n : [N]));
      g.add(seg([VIEW.x0, PID.y0], [VIEW.x1, PID.y0], c.muted, 2));
      let x = VIEW.x0, p0 = 0;
      n.forEach((len, i) => {
        const a = k === 2 ? 0 : p0, b = a + len - 1;
        const vm = seg([x, PID.y0 + (a / top) * PID.h], [x + len * sc, PID.y0 + (b / top) * PID.h], cols[i], 4);
        g.add(vm);
        x += len * sc;
        p0 += len;
      });
      return g;
    });
    const pid_label = always_redraw(() => {
      const m = fit(label('position_ids', 20, c.muted), 2.4, 0.35);
      m.move_to([VIEW.x0 + m.width / 2, PID.y0 + PID.h + 0.2, 0]);
      if (this.mode_index() === 0) m.set_opacity(0);
      return m;
    });
    const batch_g = VGroup(view_title, batch_view);
    batch_g.name = 'batch_view';
    const pid_g = VGroup(pid_plot, pid_label);
    pid_g.name = 'position_ids';

    // ---- the causal attention matrix of what the model sees
    const S = MAT.S, X0 = MAT.x0, Y1 = MAT.y1;
    const frame = box(X0 + S / 2, Y1 - S / 2, S, S, { stroke: c.muted, width: 2, fill: c.bg, fill_opacity: 0 , radius: 0.02 });
    const matrix = always_redraw(() => {
      const n = this.lengths(), k = this.mode_index();
      const N = n.reduce((a, b) => a + b, 0), u = S / N;
      const g = VGroup();
      let off = 0;
      n.forEach((len, i) => {
        // the example's own causal triangle (query rows i, key columns <= i)
        const x = X0 + off * u, y = Y1 - off * u;
        const tri = VMobject({ fill_color: cols[i], fill_opacity: 0.55, stroke_width: 0 });
        tri.set_points_as_corners([[x, y, 0], [x, y - len * u, 0], [x + len * u, y - len * u, 0], [x, y, 0]]);
        g.add(tri);
        // cells where its queries see earlier examples
        if (off > 0) {
          const rx = X0, ry = y - len * u, rw = off * u, rh = len * u;
          if (k === 1) {
            g.add(rect(rx, ry, rw, rh, c.coral, 0.32));
            g.add(hatch(rx, ry, rw, rh, c.coral, 0.16, 1.2, 0.85));
          } else g.add(rect(rx, ry, rw, rh, c.faint, 0.0, c.faint, 0));
        }
        off += len;
      });
      return g;
    });
    const mat_title = fit(label(pick(lang, 'attention: query rows × key columns', '注意力：行是 query，列是 key'), 20, c.muted), S + 0.6, 0.35);
    mat_title.move_to([X0 + S / 2, Y1 - S - 0.25, 0]);
    const legend = VGroup(
      rect(5.15, 2.9, 0.32, 0.32, c.accent, 0.55),
      fit(label(pick(lang, 'own example', '本条样本'), 20, c.ink), 1.3, 0.3).move_to([6.2, 3.06, 0]),
      rect(5.15, 2.35, 0.32, 0.32, c.coral, 0.32),
      hatch(5.15, 2.35, 0.32, 0.32, c.coral, 0.1, 1.2, 0.85),
      fit(label(pick(lang, 'other examples', '其他样本'), 20, c.ink), 1.3, 0.3).move_to([6.2, 2.51, 0]),
    );
    const attention_matrix = VGroup(frame, matrix, mat_title, legend);
    attention_matrix.name = 'attention_matrix';

    // ---- the batching switch and the two numbers
    this.mode_ctl = choice(this.mode, [pick(lang, 'padding', '填充（padding）'), pick(lang, 'naive packing', '直接打包'), pick(lang, 'packing + boundaries', '按边界打包')], { x: 1.75, y: -0.35, width: 4.2, size: 22, gap: 0.44 });
    this.mode_ctl.group.name = 'mode_switch';
    const waste_ro = readout(pick(lang, 'padding waste', '填充浪费'), () => this.waste_now() * 100, { x: 1.55, y: -1.95, decimals: 0, unit: '\\%', size: 22, value_color: c.muted });
    waste_ro.name = 'waste_readout';
    const cross_ro = readout(pick(lang, 'cross-example attention C', '跨样本注意力 C'), () => this.cross_now() * 100, { x: 1.55, y: -2.5, decimals: 0, unit: '\\%', size: 22, value_color: c.coral });
    cross_ro.name = 'cross_readout';
    const formula = (MathTex as any)('C = 1 - \\frac{\\sum_k n_k(n_k+1)}{N(N+1)}', { font_size: 28, color: c.ink });
    formula.move_to([1.55 + formula.width / 2, -3.25, 0]);
    formula.name = 'formula';
    const note = fit(label(pick(lang, 'exact counts', '精确计算'), 18, c.muted), 2.5, 0.3);
    note.move_to([6.85 - note.width / 2, -3.7, 0]);

    // ---- story: naive packing, then equal lengths, then boundaries
    const start = this.lengths(), start_mode = this.mode.get_value();
    this.mode.set_value(1);
    this.play(FadeIn(ex_title), FadeIn(tags), { run_time: 0.6 });
    this.add(bars, vals);
    this.play(GrowFromEdge(bars, LEFT), { run_time: 1 });
    this.add(view_title, batch_view);
    this.play(FadeIn(frame), FadeIn(mat_title), FadeIn(legend), { run_time: 0.8 });
    this.add(matrix);
    waste_ro.update(0);
    cross_ro.update(0);
    this.play(FadeIn(waste_ro), FadeIn(cross_ro), FadeIn(formula), FadeIn(note), { run_time: 0.8 });
    this.add(this.mode_ctl.group, pid_g);
    this.wait(0.8);
    this.play(...this.n.map((t) => t.animate.set_value(256)), { run_time: 2 });
    this.play(Indicate(cross_ro, { color: c.coral, scale_factor: 1.1 }), { run_time: 0.8 });
    this.play(this.mode.animate.set_value(0), { run_time: 0.8 });
    this.play(this.n[0].animate.set_value(480), this.n[1].animate.set_value(16), this.n[2].animate.set_value(16), this.n[3].animate.set_value(16), { run_time: 2 });
    this.play(Indicate(waste_ro, { color: c.muted, scale_factor: 1.1 }), { run_time: 0.8 });
    this.play(this.mode.animate.set_value(2), { run_time: 0.8 });
    this.wait(1);
    this.play(...this.n.map((t, i) => t.animate.set_value(start[i])), this.mode.animate.set_value(start_mode), { run_time: 1.2 });
    this.add(examples, batch_g, pid_g, attention_matrix, this.mode_ctl.group, waste_ro, cross_ro, formula, note);
    this.wait(0.8);
    void LaggedStart;
  }
}
