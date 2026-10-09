// Where do the quantisation levels go? One block of weights containing an
// outlier, twice: on the real value axis (top), where the grid of levels is
// stretched to ±absmax of the block, and divided by its absmax (bottom), where
// the weights sit among the levels and the bars below count how many land on
// each level. Dragging the outlier is changing that one weight: absmax grows,
// the grid spreads out and the other weights fall onto the few levels near 0.
// Smaller blocks keep the damage inside one block, at 32/B bits per weight
// for the scales (8/B + 32/(256B) with double quantisation). NF4 puts its 16
// levels at normal quantiles, denser near 0.
// Story: the block appears on both axes, the weights snap to the levels.
// Explore: drag the outlier; switch format, block size, data, double quant.
import { Create, Dot, FadeIn, Scene, VGroup, VMobject, ValueTracker, smooth, linear, RIGHT } from 'manim-web';
import type { Mobject } from 'manim-web';
import { palette } from '../../theme';
import { define_visual } from '../../visual';
import { LANG_SPEC, pick, resolve_lang, type Lang } from '../f/kit';
import { gaussian, rng } from '../../linalg/math';
import { switcher, tex } from '../../linalg/kit';
import { at_left, at_right, caption, Choice, clamp, dashes, emit, line, listen, live_label, live_line, rects_points, txt, type Listener, type P3, type UiLike } from './kit';
import { FORMATS, levels_of, quant_stats, type Format, type QuantStats } from './quant';
import { REAL_ROW } from './quant_data';

export interface QuantLevelsParams extends Record<string, unknown> {
  format: string;
  block: number;
  outlier_sigma: number;
  data: string;
  double_quant: boolean;
  seed: number;
  lang: string;
}

const N = 4096;
/** Index of the outlier (in the first block for every block size). */
export const OUTLIER_IX = 5;
const BLOCKS = [32, 64, 256, 1024, 4096];
const DATA = ['gaussian', 'real_row'] as const;
/** Top: value axis in σ units; bottom: the block divided by its absmax. */
const AX = { x0: -6.2, x1: 2.2, y: 2.6, h: 0.5, range: 26 };
const BX = { x0: -5.5, x1: 1.65, y0: -0.45, y1: 1.72, down: 0.95 };
const PX = 2.95, PX1 = 6.92;

/** The 4096 weights: seeded N(0, 0.02²) or the real row; σ is their standard deviation. */
export function weights(data: 'gaussian' | 'real_row', seed: number): { w: number[]; sigma: number } {
  if (data === 'real_row') {
    const w = REAL_ROW.slice(0, N), m = w.reduce((s, x) => s + x, 0) / w.length;
    return { w, sigma: Math.sqrt(w.reduce((s, x) => s + (x - m) ** 2, 0) / w.length) };
  }
  const g = gaussian(rng(seed));
  return { w: Array.from({ length: N }, () => 0.02 * g()), sigma: 0.02 };
}
/** The weights with the outlier set to `k`σ (k = 0: that weight is exactly 0). */
export function with_outlier(w: readonly number[], sigma: number, k: number): number[] {
  const x = w.slice();
  x[OUTLIER_IX] = k * sigma;
  return x;
}

export const quant_levels = define_visual<QuantLevelsParams>({
  name: 'quant_levels',
  summary: 'Blockwise absmax quantisation: one block of weights with an outlier, on the value axis (the grid of levels stretched to ±absmax) and divided by absmax (weights among the levels, counts per level below). Dragging the outlier stretches the grid so the other weights collapse onto the levels near 0; smaller blocks contain the damage at 32/B bits per weight (double quantisation: 8/B + 32/(256B)); NF4 levels sit at normal quantiles. Readouts: MSE of all other weights, levels used, share quantised to 0, scale overhead. Student drags the outlier and switches format (int4/NF4/int8), block size, data and double quantisation.',
  topics: ['quantization', 'qlora', 'nf4', 'int4', 'blockwise quantization', 'outliers', 'double quantization', 'fine-tuning'],
  params: {
    format: { type: 'enum', values: [...FORMATS], default: 'int4', doc: "'int4' uniform absmax (levels k/7, k = -7..7), 'nf4' (16 levels at normal quantiles with an exact 0), 'int8' (k/127, for comparison)" },
    block: { type: 'integer', min: 0, max: 4096, default: 0, doc: 'block size B: 32, 64, 256, 1024, or 0 (= 4096, one scale for the whole tensor); other values snap to the nearest' },
    outlier_sigma: { type: 'number', min: 0, max: 25, default: 0, doc: 'the outlier weight in units of σ (0-25; 25σ = 0.5 for N(0, 0.02²)); it sits in the first block' },
    data: { type: 'enum', values: [...DATA], default: 'gaussian', doc: "'gaussian' seeded N(0, 0.02²) x 4096 (simulation), or 'real_row' 4096 real weights (the first 4096 of a row of layer 12's mlp.down_proj of Qwen2.5-0.5B)" },
    double_quant: { type: 'boolean', default: false, doc: 'double quantisation of the scales: overhead 8/B + 32/(256B) bits instead of 32/B (B = 64: 0.127 instead of 0.5)' },
    seed: { type: 'integer', min: 1, max: 9999, default: 7, doc: 'seed of the gaussian data' },
    lang: LANG_SPEC,
  },
  examples: [
    {},
    { outlier_sigma: 25, lang: 'zh' },
    { outlier_sigma: 25, block: 64 },
    { format: 'nf4', block: 64, lang: 'zh' },
    { format: 'int8', outlier_sigma: 12, block: 256, double_quant: true },
    { data: 'real_row', format: 'nf4', block: 32, outlier_sigma: 20, double_quant: true, lang: 'zh' },
  ],
  ids: ['value_axis', 'outlier', 'block_axis', 'level_lines', 'count_bars', 'formula', 'format_control', 'block_control', 'data_control', 'dq_control', 'outlier_readout', 'mse_readout', 'levels_readout', 'zero_readout', 'overhead_readout', 'legend'],
  scene: (p) => {
    const lang: Lang = resolve_lang(p.lang);
    const L = (en: string, zh: string) => pick(lang, en, zh);
    const near_block = (b: number) => (b <= 0 ? 4096 : BLOCKS.reduce((q, x) => (Math.abs(Math.log(x / b)) < Math.abs(Math.log(q / b)) ? x : q), BLOCKS[0]));
    const DATASETS = { gaussian: weights('gaussian', p.seed), real_row: weights('real_row', p.seed) };
    class QuantLevels extends Scene {
      /** 0 int4, 1 NF4, 2 int8. */
      format = ValueTracker(Math.max(0, FORMATS.indexOf(p.format as any)));
      /** Block size B (32, 64, 256, 1024, 4096 = whole tensor). */
      block = ValueTracker(near_block(p.block));
      /** The outlier weight, in units of σ (0-25). */
      outlier = ValueTracker(p.outlier_sigma);
      /** 0 seeded gaussian, 1 real row. */
      data = ValueTracker(Math.max(0, DATA.indexOf(p.data as any)));
      /** Double quantisation of the scales: 0 off, 1 on. */
      dq = ValueTracker(p.double_quant ? 1 : 0);
      /** Story: how far the weights have snapped onto the levels (0-1); 1 after the story. */
      snap = ValueTracker(0);
      controls: Choice[] = [];
      fmt(): Format {
        return FORMATS[clamp(Math.round(this.format.get_value()), 0, 2)];
      }
      B(): number {
        return near_block(this.block.get_value());
      }
      set_data(): { w: number[]; sigma: number } {
        return DATASETS[DATA[clamp(Math.round(this.data.get_value()), 0, 1)]];
      }
      /** The weights now (with the outlier). */
      x(): number[] {
        const d = this.set_data();
        return with_outlier(d.w, d.sigma, this.outlier.get_value());
      }
      /** Quantise with the current settings, or with some of them changed (e.g. { B: 4096 } for the whole-tensor baseline). */
      stats(o: { format?: Format; B?: number; outlier?: number; dq?: boolean } = {}): QuantStats {
        const d = this.set_data(), x = with_outlier(d.w, d.sigma, o.outlier ?? this.outlier.get_value());
        return quant_stats(x, o.format ?? this.fmt(), o.B ?? this.B(), o.dq ?? this.dq.get_value() > 0.5, OUTLIER_IX);
      }
      /** σ of the data (0.02 for the gaussian). */
      sigma(): number {
        return this.set_data().sigma;
      }
      /** Subscribe to the learner's changes: f('outlier' | 'format' | 'block' | 'data' | 'dq', { value }) when a drag or click ends. */
      listen(f: Listener): void {
        listen(this, f);
      }
      override construct() {
        const c = palette();
        const { snap } = this;
        this.track(this.format, this.block, this.outlier, this.data, this.dq, snap);
        // the story grows the outlier from 0 (set before the live parts are built, so nothing rebuilds mid-animation)
        const k0 = this.outlier.get_value();
        this.outlier.set_value(0);
        let cache_key = '', cache: QuantStats | null = null;
        const key = () => `${this.fmt()}|${this.B()}|${Math.round(this.data.get_value())}|${this.outlier.get_value().toFixed(3)}|${this.dq.get_value() > 0.5}`;
        const st = () => {
          const k = key();
          if (k !== cache_key || !cache) {
            cache_key = k;
            cache = this.stats();
          }
          return cache;
        };
        const unit = (AX.x1 - AX.x0) / (2 * AX.range);
        const XA = (v_sigma: number) => (AX.x0 + AX.x1) / 2 + v_sigma * unit;
        const XB = (t: number) => BX.x0 + ((t + 1) / 2) * (BX.x1 - BX.x0);
        (this as any).XA = XA;

        // ---- top: the block on the value axis (σ units), grid stretched to ±absmax
        const ax_line = line([AX.x0, AX.y], [AX.x1, AX.y], c.muted, 2);
        const ax_ticks = VMobject({ stroke_color: c.muted, stroke_width: 2, fill_opacity: 0 });
        const segs: number[][][] = [];
        for (let k = -25; k <= 25; k += 5) segs.push([[XA(k), AX.y], [XA(k), AX.y - (k === 0 ? 0.16 : 0.09)]]);
        ax_ticks.set_points_as_corners([[0, 0, 0], [0, 0, 0]]);
        ax_ticks.points = Float64Array.from(segs.flatMap(([a, b]) => [0, 1, 2, 3].flatMap((j) => [a[0] + ((b[0] - a[0]) * j) / 3, a[1] + ((b[1] - a[1]) * j) / 3, 0])));
        const ax_caption = live_label(() => L(`the block on the value axis (ticks every 5σ, σ = ${this.sigma().toFixed(3)})`, `这一块在数值轴上（刻度每 5σ，σ = ${this.sigma().toFixed(3)}）`), 24, c.muted, (t) => at_left(t, -6.85, 3.66), { max_width: 8.6 });
        const top = VGroup();
        const draw_top = (g: any) => {
          const k = `${key()}`;
          if (g._key === k) return;
          g._key = k;
          const s = st(), d = this.set_data(), x = this.x(), B = this.B(), sg = d.sigma;
          const levels = levels_of(this.fmt());
          // mini histogram of the other weights of the block (0.5σ bins)
          const bins = new Array<number>(2 * AX.range * 2).fill(0);
          for (let i = 0; i < Math.min(B, N); i++) {
            if (i === OUTLIER_IX) continue;
            const b = Math.floor((x[i] / sg + AX.range) * 2);
            if (b >= 0 && b < bins.length) bins[b]++;
          }
          const mx = Math.max(1, ...bins);
          const hist = VMobject({ fill_color: c.muted, fill_opacity: 0.7, stroke_width: 0 });
          hist.points = rects_points(bins.flatMap((n, b) => (n ? [[XA(b / 2 - AX.range), AX.y, XA((b + 1) / 2 - AX.range), AX.y + (AX.h * n) / mx]] : [])));
          // the grid: levels × absmax
          const am = s.absmax / sg;
          const ticks = VMobject({ stroke_color: c.accent, stroke_width: levels.length > 40 ? 1 : 2, stroke_opacity: levels.length > 40 ? 0.35 : 0.8, fill_opacity: 0 });
          ticks.points = Float64Array.from(levels.flatMap((l) => {
            const xx = XA(l * am);
            return [0, 1, 2, 3].flatMap((j) => [xx, AX.y + 0.02 + ((AX.h + 0.05) * j) / 3, 0]);
          }));
          // from ±absmax on the value axis to the ends of the block axis below
          const conn = VGroup(dashes([XA(-am), AX.y - 0.05], [BX.x0, BX.y1 + 0.1], c.muted, 1.5, 0.1, 0.08, 0.7), dashes([XA(am), AX.y - 0.05], [BX.x1, BX.y1 + 0.1], c.muted, 1.5, 0.1, 0.08, 0.7));
          g.submobjects = [hist, ticks, conn];
        };
        draw_top(top);
        top.add_updater(draw_top);
        const outlier_dot = VGroup();
        const draw_dot = (g: any) => {
          const v = this.outlier.get_value(), k = v.toFixed(3);
          if (g._key === k) return;
          g._key = k;
          const x = XA(v);
          g.submobjects = [Dot([x, AX.y, 0], { radius: 0.13, color: c.coral }), txt(L('outlier', '异常值'), 24, c.coral).move_to([clamp(x, AX.x0 + 0.5, AX.x1 - 0.5), AX.y + AX.h + 0.14, 0])];
        };
        draw_dot(outlier_dot);
        outlier_dot.add_updater(draw_dot);
        outlier_dot.name = 'outlier';
        const value_axis = VGroup(ax_line, ax_ticks, top, ax_caption);
        value_axis.name = 'value_axis';

        // ---- bottom: the block ÷ absmax, the levels, and how many land on each
        const b_axis = line([BX.x0, BX.y0], [BX.x1, BX.y0], c.muted, 2);
        const b_ends = VGroup(at_right(txt('−absmax', 24, c.muted), BX.x0 - 0.1, BX.y0), at_left(txt('+absmax', 24, c.muted), BX.x1 + 0.1, BX.y0));
        const level_lines = VGroup();
        const draw_levels = (g: any) => {
          const k = this.fmt();
          if (g._key === k) return;
          g._key = k;
          const levels = levels_of(k), dense = levels.length > 40;
          const vm = VMobject({ stroke_color: c.accent, stroke_width: dense ? 1 : 2.2, stroke_opacity: dense ? 0.3 : 0.75, fill_opacity: 0 });
          vm.points = Float64Array.from(levels.flatMap((l) => (l === 0 ? [] : [0, 1, 2, 3].flatMap((j) => [XB(l), BX.y0 + ((BX.y1 - BX.y0) * j) / 3, 0]))));
          g.submobjects = [vm, line([XB(0), BX.y0], [XB(0), BX.y1], c.ink, 2.5)];
        };
        draw_levels(level_lines);
        level_lines.add_updater(draw_levels);
        level_lines.name = 'level_lines';
        const b_hist = VGroup();
        const draw_bhist = (g: any) => {
          const k = key();
          if (g._key === k) return;
          g._key = k;
          const s = st(), x = this.x(), B = Math.min(this.B(), N), nb = 80;
          const bins = new Array<number>(nb).fill(0);
          for (let i = 0; i < B; i++) bins[clamp(Math.floor(((x[i] / (s.absmax || 1) + 1) / 2) * nb), 0, nb - 1)]++;
          const mx = Math.max(1, ...bins);
          const vm = VMobject({ fill_color: c.muted, fill_opacity: 0.75, stroke_width: 0 });
          const w = (BX.x1 - BX.x0) / nb;
          vm.points = rects_points(bins.flatMap((n, b) => (n ? [[BX.x0 + b * w + 0.005, BX.y0, BX.x0 + (b + 1) * w - 0.005, BX.y0 + ((BX.y1 - BX.y0 - 0.15) * n) / mx]] : [])));
          g.submobjects = [vm];
        };
        draw_bhist(b_hist);
        b_hist.add_updater(draw_bhist);
        const count_bars = VGroup();
        const draw_counts = (g: any) => {
          const k = `${key()}|${snap.get_value().toFixed(3)}`;
          if (g._key === k) return;
          g._key = k;
          const s = st(), levels = levels_of(this.fmt()), sn = snap.get_value();
          const mx = Math.max(1, ...s.counts);
          let gap = Infinity;
          for (let i = 1; i < levels.length; i++) gap = Math.min(gap, XB(levels[i]) - XB(levels[i - 1]));
          const bw = Math.min(0.16, gap * 0.7);
          const vm = VMobject({ fill_color: c.accent, fill_opacity: 0.85, stroke_width: 0 });
          vm.points = rects_points(s.counts.flatMap((n, i) => (n ? [[XB(levels[i]) - bw / 2, BX.y0 - 0.05 - (BX.down * n * sn) / mx, XB(levels[i]) + bw / 2, BX.y0 - 0.05]] : [])));
          const kids: Mobject[] = [vm];
          if (sn >= 0.999 && levels.length <= 16) {
            // numbers under the bars, biggest first, skipping any that would touch a placed one
            const order = s.counts.map((n, i) => [n, i]).filter((q) => q[0] > 0).sort((a, b) => b[0] - a[0]);
            const rows: [number, number][][] = [[], []];
            for (const [n, i] of order) {
              const t = txt(String(n), 24, c.accent), xx = XB(levels[i]), hw = t.width / 2 + 0.04;
              // two staggered rows; a number with no room in either is left out (its bar still shows it)
              const row = rows.findIndex((pl) => !pl.some(([a, b]) => xx - hw < b && xx + hw > a));
              if (row < 0) continue;
              rows[row].push([xx - hw, xx + hw]);
              kids.push(t.move_to([xx, BX.y0 - BX.down - 0.3 - 0.3 * row, 0]));
            }
          }
          g.submobjects = kids;
        };
        draw_counts(count_bars);
        count_bars.add_updater(draw_counts);
        count_bars.name = 'count_bars';
        const block_axis = VGroup(b_hist, b_axis, b_ends);
        block_axis.name = 'block_axis';
        // the rule in use, with its numbers
        // the rule in use (one static formula per format) and its numbers (live, cheap Latin text)
        const rules = (['int4', 'nf4', 'int8'] as Format[]).map((f) => {
          if (f !== 'nf4') return at_left(tex(`\\hat w = s\\cdot\\operatorname{round}(w/s),\\quad s = \\text{absmax}/${f === 'int8' ? 127 : 7}`, 30), -6.85, -2.5);
          const m = tex('\\hat w = \\text{absmax}\\cdot q,', 30);
          const words = txt(L('q = the NF4 level nearest to w / absmax', 'q = 离 w / absmax 最近的 NF4 格点'), 24, c.ink);
          return at_left(VGroup(m, words).arrange(RIGHT, { buff: 0.2 }), -6.85, -2.5);
        });
        const rule = switcher(rules, () => FORMATS.indexOf(this.fmt()), [-6.85, -2.5]);
        const nums = live_line([() => {
          const s = st(), f = this.fmt();
          return f === 'nf4' ? `absmax = ${s.absmax.toFixed(3)}` : `absmax = ${s.absmax.toFixed(3)}    s = ${(s.absmax / (f === 'int8' ? 127 : 7)).toFixed(4)}`;
        }], -6.85, -2.98, 26, c.ink);
        const formula = VGroup(rule, nums);
        formula.name = 'formula';
        const legend = at_left(txt(L('above: the weights of this block ÷ absmax   below: how many land on each level', '上：这一块的权重 ÷ absmax　下：落在每个格点上的个数'), 24, c.muted), -6.85, -3.5);
        if (legend.width > 9.6) legend.scale(9.6 / legend.width).align_to([-6.85, 0, 0], [-1, 0, 0]);
        legend.name = 'legend';

        // ---- panel: switches and readouts
        const mk = (tracker: ValueTracker, labels: string[], y: number, o: { values?: number[]; x0?: number; log?: boolean } = {}) => {
          const ch = new Choice({ tracker, labels, values: o.values, log: o.log, x0: o.x0 ?? PX, x1: PX1, y });
          this.controls.push(ch);
          return ch;
        };
        const fmt_c = mk(this.format, ['int4', 'NF4', 'int8'], 3.18);
        const blk_c = mk(this.block, ['32', '64', '256', '1024', L('all', '整体')], 2.26, { values: BLOCKS, log: true });
        const dat_c = mk(this.data, ['N(0, 0.02²)', L('real row', '真实权重')], 1.34);
        const dq_c = mk(this.dq, [L('off', '关'), L('on', '开')], 0.55, { x0: 5.55 });
        fmt_c.name = 'format_control';
        blk_c.name = 'block_control';
        dat_c.name = 'data_control';
        dq_c.name = 'dq_control';
        const caps = VGroup(
          live_label(() => L(`format (${levels_of(this.fmt()).length} levels)`, `格式（${levels_of(this.fmt()).length} 个格点）`), 24, c.muted, (t) => at_left(t, PX, 3.6)),
          caption(L('block size B', '块大小 B'), PX, 2.68),
          live_label(() => (Math.round(this.data.get_value()) === 1 ? L('data: Qwen2.5-0.5B, layer 12 down_proj', '数据：Qwen2.5-0.5B 第 12 层 down_proj') : L('data: simulated, fixed seed', '数据：模拟（固定种子）')), 24, c.muted, (t) => at_left(t, PX, 1.76), { max_width: PX1 - PX }),
          caption(L('double quant.', '双重量化'), PX, 0.55),
        );
        const ro = (f: () => string, y: number, col: string, size = 24, name?: string) => {
          const m = live_label(f, size, col, (t) => at_left(t, PX, y), { max_width: PX1 - PX });
          if (name) m.name = name;
          return m;
        };
        const out_ro = live_line([L('outlier w =', '异常值 w ='), () => {
          const v = this.outlier.get_value();
          return `${v.toFixed(1)}σ = ${(v * this.sigma()).toFixed(3)}`;
        }], PX, -0.1, 26, c.coral);
        out_ro.name = 'outlier_readout';
        const mse_cap = caption(L('MSE, all other weights', '其余所有权重的均方误差'), PX, -0.62);
        const mse_val = VGroup();
        const draw_mse = (g: any) => {
          const m = st().mse, k = m.toPrecision(3);
          if (g._key === k) return;
          g._key = k;
          // a × 10^e in Text (the exponent raised and smaller): cheap to rebuild while dragging
          let e = Math.floor(Math.log10(m || 1e-30)), mm = (m / 10 ** e).toFixed(2);
          if (+mm >= 10) {
            e += 1;
            mm = (m / 10 ** e).toFixed(2);
          }
          const base = at_left(txt(m === 0 ? '0' : `${mm} × 10`, 34, c.ink, { weight: 'BOLD' }), PX, -1.07);
          const exp = txt(`${e < 0 ? '−' : ''}${Math.abs(e)}`, 24, c.ink, { weight: 'BOLD' });
          exp.move_to([base.get_center()[0] + base.width / 2 + 0.06 + exp.width / 2, -1.07 + base.height * 0.45, 0]);
          g.submobjects = m === 0 ? [base] : [base, exp];
        };
        draw_mse(mse_val);
        mse_val.add_updater(draw_mse);
        const mse_ro = VGroup(mse_cap, mse_val);
        mse_ro.name = 'mse_readout';
        // label on the left, value on the right edge of the panel
        const pair = (label: string, value: () => string, y: number) => {
          const v = live_label(value, 26, c.ink, (t) => at_right(t, PX1, y), { weight: 'BOLD' });
          const l = txt(label, 24, c.ink);
          const room = PX1 - PX - 1.2;
          if (l.width > room) l.scale(room / l.width);
          return VGroup(at_left(l, PX, y), v);
        };
        const block_head = caption(L("in the outlier's block:", '异常值所在的这一块：'), PX, -1.62);
        const lv_ro = pair(L('levels used', '用到的格点'), () => `${st().levels_used} / ${st().levels_total}`, -2.02);
        lv_ro.name = 'levels_readout';
        const z_ro = pair(L('quantised to 0', '变成 0 的比例'), () => `${(100 * st().zero_frac).toFixed(0)}%`, -2.42);
        z_ro.name = 'zero_readout';
        const oh_ro = VGroup(
          live_label(() => (this.dq.get_value() > 0.5 ? L('8-bit scales (double quant.)', '8 位缩放系数（双重量化）') : L('one fp32 scale per block', '每块一个 fp32 缩放系数')), 24, c.muted, (t) => at_left(t, PX, -2.98), { max_width: PX1 - PX }),
          pair(L('overhead, bits / weight', '开销（比特 / 权重）'), () => st().overhead.toFixed(3), -3.4),
        );
        oh_ro.name = 'overhead_readout';
        const note = block_head;

        // ---- the story
        this.play(FadeIn(VGroup(...this.controls)), FadeIn(caps), { run_time: 1 });
        this.play(Create(ax_line), FadeIn(ax_ticks), FadeIn(ax_caption), FadeIn(top), FadeIn(outlier_dot), { run_time: 1.4 });
        this.play(Create(b_axis), FadeIn(b_ends), FadeIn(b_hist), FadeIn(level_lines), { run_time: 1.4 });
        this.add(count_bars);
        this.play(snap.animate.set_value(1), FadeIn(formula), { run_time: 1.6, rate_func: smooth });
        this.play(FadeIn(legend), FadeIn(out_ro), FadeIn(mse_ro), FadeIn(lv_ro), FadeIn(z_ro), FadeIn(oh_ro), FadeIn(note), { run_time: 1 });
        if (k0 > 0) {
          // the outlier grows: absmax follows it, the grid spreads, the other weights collapse onto the middle levels
          this.wait(0.6);
          this.play(this.outlier.animate.set_value(k0), { run_time: 3, rate_func: linear });
        }
        this.add(value_axis, outlier_dot, block_axis, level_lines, count_bars, formula, legend, VGroup(...this.controls), caps);
        this.wait(k0 > 0 ? 1.5 : 2.5);
      }
    }
    return new QuantLevels();
  },
  explore: (scene: any, ui) => {
    const XA = scene.XA as (v: number) => number;
    ui.add_handle({
      tracker: scene.outlier,
      from_value: (v: number): P3 => [XA(v), AX.y, 0],
      to_value: (pt: P3) => clamp(Math.round(((pt[0] - XA(0)) / (XA(1) - XA(0))) * 2) / 2, 0, 25),
      constraint: (pt: P3): P3 => [clamp(pt[0], XA(0), XA(25)), AX.y, 0],
      step: 0.5,
      radius: 0.4,
      label: 'the outlier weight (its value in σ)',
      on_end: () => emit(scene, 'outlier', { value: scene.outlier.get_value() }),
    });
    const u = ui as unknown as UiLike;
    const [f, b, d, q] = scene.controls as Choice[];
    f.attach(u, 'the number format: int4, NF4 or int8', (v) => emit(scene, 'format', { value: v }));
    b.attach(u, 'the block size B', (v) => emit(scene, 'block', { value: v }));
    d.attach(u, 'the data: simulated gaussian or a real row', (v) => emit(scene, 'data', { value: v }));
    q.attach(u, 'double quantisation of the scales on or off', (v) => emit(scene, 'dq', { value: v }));
  },
});
