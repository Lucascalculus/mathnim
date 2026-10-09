// One GRPO group (E1). G answer cards to the same question, each graded right
// or wrong by a verifier (r = 1 or 0). The bars under the cards are the exact
// group-relative advantages Â_i = (r_i - r̄)/σ, or, in the 'length' phase, the
// relative push on each token of an answer under three ways of averaging the
// loss (per answer, per token, by a constant). The learner flips verdicts,
// drags lengths and switches the baseline, the std division and the
// aggregation; everything else follows from the formulas in math.ts.
// The "p" meter is a toy model (answers are just right/wrong) moved by the
// lesson's "update one step" action; it is labelled as such on the canvas.
import { Create, FadeIn, Indicate, LaggedStart, Scene, VGroup, ValueTracker, always_redraw, smooth } from 'manim-web';
import type { Mobject } from 'manim-web';
import { palette } from '../../theme';
import { define_visual } from '../../visual';
import { tex } from '../../linalg/kit';
import {
  Choice, LANG_SPEC, Toggle, VSwitch, clamp, label, label_at, live_number, pick, pick_shown, rect, resolve_lang, rrect, seg, tag, verdict_mark,
  type Lang, type P3,
} from './kit';
import { advantages, logit, sigmoid, token_weights, toy_step, zero_variance, type Agg } from './math';

export interface GrpoGroupParams extends Record<string, unknown> {
  G: number;
  right: number[];
  lengths: number[];
  baseline: boolean;
  std: boolean;
  agg: string;
  phase: string;
  p: number;
  lang: string;
}

const AGGS: Agg[] = ['sequence', 'token', 'constant'];
const PITCH = 1.34, X_LEFT = -6.35, MAX_LEN = 2000, L_MAX = 2048;
const CARD = { y0: 1.27, y1: 2.83, w: 1.18 };
const LEN_Y = 0.98, LEN_HALF = 0.56;
const PANEL_X = 4.1;
/** Chart: zero line and units per advantage (phase A) or per relative push (phase B). */
const CHART_A = { y0: -1.45, unit: 0.62 };
const CHART_B = { y0: -1.55, unit: 1.4 };

export const grpo_group = define_visual<GrpoGroupParams>({
  name: 'grpo_group',
  summary: "One GRPO group: G answer cards graded right/wrong; bars show the exact group-relative advantages (r - mean)/std, which all vanish when the group is all right or all wrong. Phase 'length' shows the per-token push under per-answer, per-token or constant averaging (GRPO's length bias). Student flips verdicts, drags lengths, switches baseline / std / aggregation.",
  topics: ['grpo', 'rlvr', 'advantage', 'baseline', 'rloo', 'reinforcement learning', 'length bias', 'dr grpo', 'dapo', 'fine-tuning'],
  params: {
    G: { type: 'integer', min: 4, max: 8, default: 8, doc: 'group size: answers sampled for one question (4-8)' },
    right: { type: 'vector', length: 8, min: 0, max: 1, default: [1, 1, 0, 0, 0, 0, 0, 0], doc: 'verdict of each answer: 1 right, 0 wrong (first G used)' },
    lengths: { type: 'vector', length: 8, min: 50, max: 2000, default: [220, 180, 300, 260, 100, 1000, 240, 280], doc: 'answer lengths in tokens (first G used; shown in the length phase)' },
    baseline: { type: 'boolean', default: true, doc: 'subtract the group mean (off = plain REINFORCE with 0/1 rewards)' },
    std: { type: 'boolean', default: true, doc: 'divide by the group standard deviation (population std)' },
    agg: { type: 'enum', values: AGGS, default: 'sequence', doc: "how the loss is averaged: 'sequence' (original GRPO, 1/|o_i|), 'token' (DAPO), 'constant' (Dr. GRPO)" },
    phase: { type: 'enum', values: ['advantage', 'length'], default: 'advantage', doc: "'advantage': bars are Â_i; 'length': bars are the relative push per token, lengths draggable" },
    p: { type: 'number', min: 0.05, max: 0.95, default: 0.3, doc: "toy model: this question's success rate, moved by update_step()" },
    lang: LANG_SPEC,
  },
  examples: [
    {},
    { lang: 'zh' },
    { right: [1, 1, 1, 1, 1, 1, 1, 1], lang: 'zh' },
    { right: [1, 0, 0, 0, 0, 0, 0, 0], std: false },
    { phase: 'length', lang: 'zh' },
    { phase: 'length', agg: 'token' },
    { G: 4, right: [1, 0, 1, 0, 0, 0, 0, 0], baseline: false, lang: 'zh' },
  ],
  ids: ['cards', 'bars', 'formula', 'stats', 'controls', 'zero_banner'],
  scene: (p) => build(p),
  explore: (scene: any, ui) => scene.attach(ui),
});

function build(p: GrpoGroupParams): Scene {
  const lang = resolve_lang(p.lang) as Lang;
  const G = p.G;
  const phaseB = p.phase === 'length';
  const shift = ((8 - G) * PITCH) / 2;
  const XC = (i: number) => X_LEFT + shift + i * PITCH;
  class GrpoGroup extends Scene {
    r = Array.from({ length: G }, () => ValueTracker(0));
    len = Array.from({ length: G }, () => ValueTracker(200));
    baseline = ValueTracker(p.baseline ? 1 : 0);
    std = ValueTracker(p.std ? 1 : 0);
    agg = ValueTracker(AGGS.indexOf(p.agg as Agg));
    theta = ValueTracker(logit(p.p));
    updates = ValueTracker(0);
    phase = p.phase;
    G = G;
    /** The lesson replaces this to turn interactions into world events. */
    on: (type: string, data?: Record<string, unknown>) => void = () => {};
    switches: VSwitch[] = [];
    baseline_t!: Toggle;
    std_t!: Toggle;
    agg_c!: Choice;
    cards_g!: VGroup;
    ui: any = null;

    rewards(): number[] {
      return this.r.map((t) => (t.get_value() > 0.5 ? 1 : 0));
    }
    lengths(): number[] {
      return this.len.map((t) => Math.round(t.get_value()));
    }
    opts() {
      return { baseline: this.baseline.get_value() > 0.5, std: this.std.get_value() > 0.5 };
    }
    adv(): number[] {
      return advantages(this.rewards(), this.opts());
    }
    agg_name(): Agg {
      return AGGS[Math.round(this.agg.get_value())];
    }
    /** Per-token push, relative to the largest one in the group (phase B bars). */
    push_rel(): number[] {
      const c = token_weights(this.adv(), this.lengths(), this.agg_name(), L_MAX);
      const m = Math.max(...c.map(Math.abs));
      return m > 0 ? c.map((x) => x / m) : c.map(() => 0);
    }
    /** Per-token push of the longest wrong answer divided by that of the shortest (phase B readout). */
    long_short_ratio(): number {
      const r = this.rewards(), L = this.lengths(), c = token_weights(this.adv(), L, this.agg_name(), L_MAX);
      const wrong = r.map((x, i) => i).filter((i) => r[i] === 0);
      if (wrong.length < 2) return NaN;
      const lo = wrong.reduce((a, i) => (L[i] < L[a] ? i : a), wrong[0]), hi = wrong.reduce((a, i) => (L[i] > L[a] ? i : a), wrong[0]);
      return c[lo] !== 0 ? c[hi] / c[lo] : NaN;
    }
    zero(): boolean {
      return zero_variance(this.rewards()) && this.opts().baseline;
    }
    k(): number {
      return this.rewards().reduce((a, b) => a + b, 0);
    }
    p_now(): number {
      return sigmoid(this.theta.get_value());
    }

    override construct() {
      const c = palette();
      this.r.forEach((t, i) => t.set_value(p.right[i] ?? 0));
      this.len.forEach((t, i) => t.set_value(p.lengths[i] ?? 200));
      this.track(...this.r, ...this.len, this.baseline, this.std, this.agg, this.theta, this.updates);

      // ---- the formula (top), the term that changes is indicated when a switch moves
      const fA = [
        tex('\\hat A_i = r_i', 36),
        tex('\\hat A_i = r_i - \\bar r', 36),
        tex('\\hat A_i = \\dfrac{r_i - \\bar r}{\\sigma}', 36),
      ];
      const fB = [
        tex('c_i = \\hat A_i \\,/\\, (G\\,|o_i|)', 36),
        tex('c_i = \\hat A_i \\,/\\, \\textstyle\\sum_j |o_j|', 36),
        tex('c_i = \\hat A_i \\,/\\, (G\\,L_{max})', 36),
      ];
      const fx = (XC(0) + XC(G - 1)) / 2 - 0.6;
      [...fA, ...fB].forEach((f) => f.move_to([fx, 3.36, 0]));
      const formula = phaseB
        ? pick_shown(fB, () => Math.round(this.agg.get_value()))
        : pick_shown(fA, () => (this.opts().baseline ? (this.opts().std ? 2 : 1) : 0));
      formula.name = 'formula';
      const fnote = label_at(phaseB ? pick(lang, 'push on every token of answer i', '回答 i 每个 token 受到的推力') : pick(lang, 'advantage of answer i', '回答 i 的优势'), fx + 1.85, 3.36, 22, c.muted);

      // ---- the cards
      const cards: Mobject[] = [];
      for (let i = 0; i < G; i++) {
        const x = XC(i), t = this.r[i];
        const body = always_redraw(() => rrect(x, (CARD.y0 + CARD.y1) / 2, CARD.w, CARD.y1 - CARD.y0, {
          stroke: t.get_value() > 0.5 ? c.good : c.coral, width: 2.5, fill: t.get_value() > 0.5 ? c.good : c.coral, fill_opacity: 0.07,
        }));
        const name = tex(`o_{${i + 1}}`, 28, c.ink).move_to([x - 0.36, 2.58, 0]);
        const mark = pick_shown([verdict_mark(false, 46).move_to([x - 0.12, 2.02, 0]), verdict_mark(true, 46).move_to([x - 0.12, 2.02, 0])], () => (t.get_value() > 0.5 ? 1 : 0));
        const bottom = phaseB
          ? live_number(() => this.adv()[i], [x - 0.12, 1.5], { decimals: 2, size: 22, anchor: 'center', signed: true, color: () => (this.adv()[i] >= 0 ? c.good : c.coral) })
          : pick_shown([tex('r = 0', 24, c.muted), tex('r = 1', 24, c.muted)].map((m) => m.move_to([x - 0.12, 1.5, 0])), () => (t.get_value() > 0.5 ? 1 : 0));
        const sw = new VSwitch(t, x + 0.4, 2.42, 1.64);
        this.switches.push(sw);
        cards.push(VGroup(body, name, mark, bottom, sw.group));
      }
      this.cards_g = VGroup(...cards);
      this.cards_g.name = 'cards';

      // ---- lengths (phase B)
      const length_rows: Mobject[] = [];
      if (phaseB) {
        for (let i = 0; i < G; i++) {
          const x = XC(i), t = this.len[i];
          const track = seg([x - LEN_HALF, LEN_Y], [x + LEN_HALF, LEN_Y], c.faint, 8);
          const fill = always_redraw(() => seg([x - LEN_HALF, LEN_Y], [x - LEN_HALF + Math.max(0.004, (2 * LEN_HALF * t.get_value()) / MAX_LEN), LEN_Y], c.purple, 8));
          const n = live_number(() => t.get_value(), [x, LEN_Y - 0.3], { decimals: 0, size: 20, anchor: 'center', color: c.purple });
          length_rows.push(VGroup(track, fill, n));
        }
      }

      // ---- the bars
      const CH = phaseB ? CHART_B : CHART_A;
      const value = (i: number) => (phaseB ? this.push_rel()[i] : this.adv()[i]);
      const zero_line = seg([XC(0) - 0.62, CH.y0], [XC(G - 1) + 0.62, CH.y0], c.muted, 2);
      const bars: Mobject[] = [];
      for (let i = 0; i < G; i++) {
        const x = XC(i);
        const bar = always_redraw(() => {
          const v = value(i), h = v * CH.unit;
          return rect(x - 0.26, CH.y0, x + 0.26, CH.y0 + h, v >= 0 ? c.good : c.coral, 0.85);
        });
        const num = always_redraw(() => {
          const v = value(i);
          const t = tex(`${v >= 0 ? '+' : '-'}${Math.abs(v).toFixed(2)}`, 22, v >= 0 ? c.good : c.coral);
          t.move_to([x, CH.y0 + v * CH.unit + (v >= 0 ? 0.24 : -0.24), 0]);
          if (Math.abs(v) < 0.005) t.move_to([x, CH.y0 + 0.24, 0]);
          return t;
        });
        bars.push(VGroup(bar, num));
      }
      const bars_g = VGroup(zero_line, ...bars);
      bars_g.name = 'bars';
      const chart_cap = label_at(
        phaseB ? pick(lang, 'purple: answer length in tokens · bars: push per token (largest = 1)', '紫条：回答长度（token 数）· 柱：每个 token 的推力（最大者 = 1）') : pick(lang, 'bars: the advantage Â of each answer', '柱：每个回答的优势 Â'),
        XC(0) - 0.6, -3.62, 20, c.muted);

      // ---- zero-variance banner
      const zero_banner = always_redraw(() => {
        const show = this.zero();
        const t = label(pick(lang, 'All the same: every advantage is 0. This group teaches nothing.', '全对或全错：每个优势都是 0，这一组什么也学不到。'), 22, c.ink);
        const w = Math.min(t.width + 0.4, 9.6);
        if (t.width > w - 0.3) t.scale((w - 0.3) / t.width);
        const xcen = (XC(0) + XC(G - 1)) / 2;
        t.move_to([xcen, CH.y0 + 0.62, 0]);
        const b = rrect(xcen, CH.y0 + 0.62, w, 0.5, { stroke: c.gold, width: 2, fill: c.gold, fill_opacity: 0.12 });
        const g = VGroup(b, t);
        if (!show) g.set_opacity(0);
        return g;
      });
      zero_banner.name = 'zero_banner';

      // ---- right panel: group statistics and controls
      const X = PANEL_X;
      const head = label_at(pick(lang, 'This group', '这一组'), X, 2.85, 24, c.ink, 'BOLD');
      const kline = VGroup(
        tex('k =', 28).move_to([X + 0.35, 2.35, 0]),
        live_number(() => this.k(), [X + 0.78, 2.35], { decimals: 0, size: 28 }),
        tex(`/\\,${G}`, 28).move_to([X + 1.35, 2.35, 0]),
        label_at(pick(lang, 'right', '个对'), X + 1.72, 2.35, 20, c.muted),
      );
      const rbar = VGroup(tex('\\bar r =', 28).move_to([X + 0.35, 1.9, 0]), live_number(() => this.k() / G, [X + 0.78, 1.9], { decimals: 3, size: 28 }));
      const sig = VGroup(tex('\\sigma =', 28).move_to([X + 0.35, 1.45, 0]), live_number(() => { const m = this.k() / G; return Math.sqrt(m * (1 - m)); }, [X + 0.78, 1.45], { decimals: 3, size: 28 }));
      const sum = VGroup(tex('\\textstyle\\sum_i \\hat A_i =', 28).move_to([X + 0.75, 1.0, 0]), live_number(() => this.adv().reduce((a, b) => a + b, 0), [X + 1.62, 1.0], { decimals: 2, size: 28 }));
      const stats = VGroup(head, kline, rbar, sig, sum);
      stats.name = 'stats';

      const controls = VGroup();
      controls.name = 'controls';
      const extra = VGroup();
      if (!phaseB) {
        this.baseline_t = new Toggle(this.baseline, X, 0.35, pick(lang, 'subtract r̄', '减去均值 r̄'), { size: 20 });
        this.std_t = new Toggle(this.std, X, -0.15, pick(lang, 'divide by σ', '除以标准差 σ'), { size: 20 });
        controls.add(this.baseline_t.group, this.std_t.group);
        // toy meter
        const mcap = label_at(pick(lang, 'success rate p', '这道题的正确率 p'), X, -0.8, 20, c.ink);
        const track = seg([X, -1.22], [X + 2.2, -1.22], c.faint, 12);
        const fill = always_redraw(() => seg([X, -1.22], [X + Math.max(0.01, 2.2 * this.p_now()), -1.22], c.accent, 12));
        const pnum = live_number(() => this.p_now(), [X + 2.32, -1.22], { decimals: 2, size: 24, color: c.accent });
        const ulab = label_at(pick(lang, 'updates:', '已更新：'), X, -1.66, 20, c.muted);
        const ucount = VGroup(ulab, live_number(() => this.updates.get_value(), [ulab.get_right()[0] + 0.15, -1.66], { decimals: 0, size: 22, color: c.muted }));
        extra.add(mcap, track, fill, pnum, ucount, tag(pick(lang, 'p: toy model', 'p：玩具模型'), X, -2.2, 18));
      } else {
        const acap = label_at(pick(lang, 'average the loss by', '损失怎么平均'), X, 0.4, 20, c.ink);
        this.agg_c = new Choice(this.agg, X, -0.08, [pick(lang, 'answer', '按回答'), pick(lang, 'token', '按 token'), pick(lang, 'const.', '常数')], { size: lang === 'zh' ? 18 : 17, cell: 0.95 });
        this.std_t = new Toggle(this.std, X, -0.72, pick(lang, 'divide by σ', '除以标准差 σ'), { size: 20 });
        controls.add(acap, this.agg_c.group, this.std_t.group);
        const rcap = label_at(pick(lang, 'per-token push:', '每个 token 的推力：'), X, -1.35, 18, c.ink);
        const rcap2 = label_at(pick(lang, 'longest ÷ shortest wrong', '最长错答 ÷ 最短错答'), X, -1.7, 18, c.ink);
        const ratio = live_number(() => { const v = this.long_short_ratio(); return Number.isFinite(v) ? v : 0; }, [X, -2.15], { decimals: 2, size: 30, color: c.purple });
        extra.add(rcap, rcap2, ratio);
      }
      const exact = tag(pick(lang, 'exact: the coefficients of one update', '精确计算：一步更新的系数'), 6.88, -3.62, 18, 'right');

      // ---- the story
      const rest = p.right.slice(0, G);
      this.r.forEach((t) => t.set_value(0));
      this.play(LaggedStart(...cards.map((m) => FadeIn(m, { shift: [0, -0.3, 0] })), { lag_ratio: 0.12 }), { run_time: 1.6 });
      this.play(FadeIn(formula), FadeIn(fnote), { run_time: 0.8 });
      this.play(...this.r.map((t, i) => t.animate.set_value(rest[i] ?? 0)), { run_time: 0.8 });
      if (phaseB) this.play(LaggedStart(...length_rows.map((m) => FadeIn(m)), { lag_ratio: 0.1 }), { run_time: 1 });
      this.play(FadeIn(stats), FadeIn(controls), FadeIn(extra), { run_time: 1 });
      this.play(Create(zero_line), LaggedStart(...bars.map((b) => FadeIn(b, { shift: [0, 0.2, 0] })), { lag_ratio: 0.08 }), FadeIn(chart_cap), FadeIn(exact), { run_time: 1.6 });
      this.add(zero_banner);
      this.wait(1);
      if (!phaseB) {
        // one more right answer: every bar moves (the baseline is the group mean)
        const flip = rest.findIndex((x) => !x);
        if (flip >= 0) {
          this.play(this.r[flip].animate.set_value(1), { run_time: 0.6 });
          this.play(Indicate(bars_g, { color: c.accent, scale_factor: 1.03 }), { run_time: 1 });
          this.wait(1);
          // all right: nothing left to learn
          this.play(...this.r.map((t) => t.animate.set_value(1)), { run_time: 0.8, rate_func: smooth });
          this.wait(1.6);
          this.play(...this.r.map((t, i) => t.animate.set_value(rest[i] ?? 0)), { run_time: 0.8 });
        }
      } else {
        const a0 = Math.round(this.agg.get_value());
        this.play(this.agg.animate.set_value(a0 === 0 ? 1 : 0), { run_time: 0.4 });
        this.play(Indicate(formula, { color: c.accent }), { run_time: 1 });
        this.wait(1.2);
        this.play(this.agg.animate.set_value(a0), { run_time: 0.4 });
      }
      this.add(this.cards_g, bars_g, formula, stats, controls, extra);
      this.wait(1.2);
    }

    // ---- used by explore() and by the lesson's world
    attach(ui: any): void {
      this.ui = ui;
      this.switches.forEach((sw, i) => sw.attach(ui, pick(lang, `verdict of answer ${i + 1}`, `回答 ${i + 1} 的对错`), (on) => this.on('flip', { i, right: on, k: this.k(), zero: this.zero() })));
      if (phaseB) {
        this.len.forEach((t, i) => {
          const x = XC(i);
          ui.add_handle({
            tracker: t,
            from_value: (v: number) => [x - LEN_HALF + (2 * LEN_HALF * v) / MAX_LEN, LEN_Y, 0],
            to_value: (pt: P3) => Math.round(clamp(((pt[0] - (x - LEN_HALF)) / (2 * LEN_HALF)) * MAX_LEN, 50, MAX_LEN) / 10) * 10,
            constraint: (pt: P3) => [clamp(pt[0], x - LEN_HALF, x + LEN_HALF), LEN_Y, 0],
            step: 50,
            radius: 0.3,
            label: pick(lang, `length of answer ${i + 1}`, `回答 ${i + 1} 的长度`),
            on_end: () => this.on('length', { i, len: Math.round(t.get_value()), ratio: this.long_short_ratio(), agg: this.agg_name() }),
          });
        });
        this.agg_c.attach(ui, pick(lang, 'how the loss is averaged', '损失的平均方式'), () => this.on('agg', { agg: this.agg_name(), ratio: this.long_short_ratio() }));
      } else {
        this.baseline_t.attach(ui, pick(lang, 'subtract the group mean', '减去组均值'), (on) => this.on('baseline', { on }));
      }
      this.std_t.attach(ui, pick(lang, 'divide by the standard deviation', '除以标准差'), (on) => this.on('std', { on, agg: this.agg_name(), ratio: this.long_short_ratio() }));
    }
    /** One GRPO step of the toy model. */
    update_step(): void {
      const before = this.p_now();
      const zero = this.zero();
      this.theta.set_value(toy_step(this.theta.get_value(), this.rewards(), this.opts(), 2.5));
      this.updates.set_value(this.updates.get_value() + 1);
      this.on('update', { zero, before, after: this.p_now(), k: this.k() });
    }
  }
  return new GrpoGroup();
}
