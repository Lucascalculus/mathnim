// Is a 3-point gain real? Two checkpoints with true accuracies p_A < p_B are
// scored on an eval set of n questions. The observed gap Δ̂ = p̂_B - p̂_A is a
// draw from a distribution (normal approximation, exact formula) centred on
// the true gap; the shaded part left of 0 is the chance the better model
// looks worse. Independent analysis: SE = √((p_A q_A + p_B q_B)/n). Paired
// (same questions, the models disagree on a fraction δ): SE = √((δ - Δ²)/n).
// "Re-run" draws a new eval set (a seeded simulation) and stamps its Δ̂.
import { DashedLine, FadeIn, Indicate, MathTex, Scene, VGroup, VMobject, ValueTracker, always_redraw } from 'manim-web';
import { palette } from '../../theme';
import { define_visual } from '../../visual';
import { fit, label } from '../f/kit';
import { LANG_SPEC, choice, clamp, idx, pick, readout, rect, resolve_lang, seg, slider, type Lang } from './kit';

export interface EvalNoiseParams extends Record<string, unknown> {
  n: number;
  p_a: number;
  gap: number;
  paired: boolean;
  discord: number;
  lang: string;
}

/** Standard error of the observed gap (as a fraction). */
export function se_gap(n: number, pa: number, pb: number, paired: boolean, discord: number): number {
  if (paired) {
    const g = pb - pa;
    return Math.sqrt(Math.max(1e-12, discord - g * g) / n);
  }
  return Math.sqrt((pa * (1 - pa) + pb * (1 - pb)) / n);
}
/** Standard normal CDF (Abramowitz-Stegun 7.1.26 via erf). */
export function phi(z: number): number {
  const t = 1 / (1 + 0.3275911 * Math.abs(z) / Math.SQRT2);
  const y = 1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-(z * z) / 2);
  return z >= 0 ? 0.5 * (1 + y) : 0.5 * (1 - y);
}
/** Probability that the better model (B) scores lower on the eval set. */
export const flip_prob = (n: number, pa: number, pb: number, paired: boolean, discord: number) => phi(-(pb - pa) / se_gap(n, pa, pb, paired, discord));
/** Smallest n with flip probability below `target` (independent analysis). */
export const n_for_flip = (pa: number, pb: number, target = 0.05) => {
  // Φ(-g/SE) < target  <=>  g/SE > z  <=>  n > z² (p_A q_A + p_B q_B) / g²
  const z = 1.6448536, g = pb - pa;
  return Math.ceil((z * z * (pa * (1 - pa) + pb * (1 - pb))) / (g * g));
};

/** mulberry32: a small seeded PRNG. */
const rng = (s: number) => () => {
  s |= 0; s = (s + 0x6d2b79f5) | 0;
  let t = Math.imul(s ^ (s >>> 15), 1 | s);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};
/** One simulated eval run: the observed gap p̂_B - p̂_A. */
export function simulate_gap(seed: number, n: number, pa: number, pb: number, paired: boolean, discord: number): number {
  const r = rng(seed);
  let d = 0;
  if (paired) {
    const g = pb - pa, b_only = (discord + g) / 2;
    for (let i = 0; i < n; i++) {
      const u = r();
      if (u < b_only) d++;
      else if (u < discord) d--;
    }
  } else for (let i = 0; i < n; i++) d += (r() < pb ? 1 : 0) - (r() < pa ? 1 : 0);
  return d / n;
}

const AX = { x0: -6.4, x1: 6.4, lo: -20, hi: 25, y: 0.55, H: 2.5 };

export const eval_noise = define_visual<EvalNoiseParams>({
  name: 'eval_noise',
  summary: "Is a small eval gain real? The observed gap between two checkpoints on n questions is drawn from a normal curve centred on the true gap (exact formula); the shaded area below 0 is the chance the better model looks worse. Independent SE = √((p_A q_A + p_B q_B)/n), paired SE = √((δ - Δ²)/n). Re-running an eval (seeded simulation) stamps one observed gap. Controls: n, independent/paired, disagreement δ.",
  topics: ['evaluation', 'statistics', 'confidence interval', 'fine-tuning', 'checkpoint selection', 'llm'],
  params: {
    n: { type: 'integer', min: 10, max: 5000, default: 200, doc: 'questions in the eval set (e.g. 30 for AIME, 200 for a small held-out set)' },
    p_a: { type: 'number', min: 0.05, max: 0.9, default: 0.7, doc: 'true accuracy of the old checkpoint A' },
    gap: { type: 'number', min: 0.005, max: 0.15, default: 0.03, doc: 'true gain of B over A (0.03 = 3 points)' },
    paired: { type: 'boolean', default: false, doc: 'paired analysis (both models on the same questions, per-question differences) instead of comparing two independent accuracies' },
    discord: { type: 'number', min: 0.02, max: 0.5, default: 0.1, doc: 'paired only: fraction of questions where the two models disagree (must exceed the gap)' },
    lang: LANG_SPEC,
  },
  examples: [{}, { lang: 'zh' }, { n: 1300 }, { paired: true, lang: 'zh' }, { n: 30, p_a: 0.4, gap: 0.05 }, { n: 5000, paired: true, discord: 0.05 }],
  ids: ['axis', 'curve', 'flip_area', 'true_gap', 'runs', 'readouts', 'formula', 'controls', 'note'],
  scene: (p) => new EvalNoiseScene(p, resolve_lang(p.lang)),
  explore: (scene: any, ui) => scene.attach(ui),
});

export class EvalNoiseScene extends Scene {
  p: EvalNoiseParams;
  lang: Lang;
  /** Questions in the eval set. */
  n = ValueTracker(200);
  /** 0 = independent, 1 = paired. */
  paired = ValueTracker(0);
  /** Paired: fraction of questions where the models disagree. */
  discord = ValueTracker(0.1);
  /** Number of re-runs so far (the runs themselves are kept on `run_group`). */
  runs = ValueTracker(0);
  run_group!: VGroup;
  ctls: any[] = [];
  constructor(p: EvalNoiseParams, lang: Lang) {
    super();
    this.p = p;
    this.lang = lang;
  }
  pa() { return this.p.p_a; }
  pb() { return Math.min(0.99, this.p.p_a + this.p.gap); }
  n_now() { return Math.round(clamp(this.n.get_value(), 10, 5000)); }
  is_paired() { return idx(this.paired, 2) === 1; }
  discord_now() { return Math.max(this.p.gap + 0.005, clamp(this.discord.get_value(), 0.02, 0.5)); }
  se() { return se_gap(this.n_now(), this.pa(), this.pb(), this.is_paired(), this.discord_now()); }
  flip() { return flip_prob(this.n_now(), this.pa(), this.pb(), this.is_paired(), this.discord_now()); }
  key() { return `${this.n_now()}|${this.is_paired() ? 1 : 0}|${this.is_paired() ? this.discord_now().toFixed(3) : ''}`; }
  /** The runs for the current settings. */
  current_runs(): number[] {
    const all: { key: string; d: number }[] = (this.run_group as any)._runs ?? [];
    return all.filter((r) => r.key === this.key()).map((r) => r.d);
  }
  /** Re-run the eval on a fresh set of questions (seeded simulation); returns the observed gap. */
  rerun(): number {
    const all: { key: string; d: number }[] = (this.run_group as any)._runs ?? [];
    const k = Math.round(this.runs.get_value()) + 1;
    const d = simulate_gap(k * 2654435761 + this.n_now() * 97 + (this.is_paired() ? 7 : 0), this.n_now(), this.pa(), this.pb(), this.is_paired(), this.discord_now());
    // a new array each time, so earlier snapshots keep their own list
    (this.run_group as any)._runs = [...all, { key: this.key(), d }];
    this.runs.set_value(k);
    return d;
  }
  attach(ui: any): void {
    for (const c of this.ctls) c.attach(ui);
  }

  override construct() {
    const c = palette();
    const lang = this.lang;
    this.n.set_value(this.p.n);
    this.paired.set_value(this.p.paired ? 1 : 0);
    this.discord.set_value(Math.max(this.p.discord, this.p.gap + 0.01));
    this.n.name = 'eval_size';
    this.paired.name = 'paired';
    this.discord.name = 'disagreement';
    this.track(this.n, this.paired, this.discord, this.runs);
    const X = (pts: number) => AX.x0 + ((pts - AX.lo) / (AX.hi - AX.lo)) * (AX.x1 - AX.x0);

    // ---- axis of the observed gap (points)
    const ticks = [-20, -10, 0, 10, 20];
    const axis = VGroup(
      seg([AX.x0, AX.y], [AX.x1, AX.y], c.ink, 2),
      ...ticks.map((t) => seg([X(t), AX.y - 0.08], [X(t), AX.y + 0.08], c.ink, 2)),
      ...ticks.map((t) => (MathTex as any)(`${t > 0 ? '+' : ''}${t}`, { font_size: 26, color: c.muted }).move_to([X(t), AX.y - 0.32, 0])),
    );
    const ax_lab = fit(label(pick(lang, 'observed gap B − A on the eval set (points)', '评测集上观测到的差距 B − A（分）'), 22, c.muted), 7, 0.4);
    ax_lab.move_to([AX.x1 - ax_lab.width / 2, AX.y - 0.72, 0]);
    axis.add(ax_lab);
    axis.name = 'axis';

    // ---- the sampling distribution (peak-normalised), the area below 0 shaded
    const curve_pts = () => {
      const s = this.se() * 100, g = this.p.gap * 100, pts: number[][] = [];
      for (let k = 0; k <= 240; k++) {
        const x = AX.lo + ((AX.hi - AX.lo) * k) / 240, z = (x - g) / s;
        pts.push([X(x), AX.y + AX.H * Math.exp(-0.5 * z * z), 0]);
      }
      return pts;
    };
    const curve = always_redraw(() => {
      const vm = VMobject({ stroke_color: c.accent, stroke_width: 4, fill_opacity: 0 });
      vm.set_points_as_corners(curve_pts());
      return vm;
    });
    curve.name = 'curve';
    const flip_area = always_redraw(() => {
      const pts = curve_pts().filter((q) => q[0] <= X(0));
      const g = VGroup();
      if (pts.length > 1) {
        const area = VMobject({ fill_color: c.coral, fill_opacity: 0.3, stroke_width: 0 });
        area.set_points_as_corners([[pts[0][0], AX.y, 0], ...pts, [X(0), AX.y, 0], [pts[0][0], AX.y, 0]]);
        g.add(area);
        area.set_stroke({ color: c.coral, width: 2, opacity: 0.9 });
      }
      return g;
    });
    flip_area.name = 'flip_area';
    const true_gap = VGroup(
      DashedLine([X(this.p.gap * 100), AX.y, 0], [X(this.p.gap * 100), AX.y + AX.H + 0.15, 0], { color: c.good, stroke_width: 3, dash_length: 0.1 }) as unknown as VMobject,
    );
    const tg_lab = fit(label(pick(lang, `true gap +${(this.p.gap * 100).toFixed(1)}`, `真实差距 +${(this.p.gap * 100).toFixed(1)}`), 22, c.good), 3, 0.4);
    tg_lab.move_to([X(this.p.gap * 100) + 0.15 + tg_lab.width / 2, AX.y + AX.H + 0.2, 0]);
    true_gap.add(tg_lab);
    true_gap.name = 'true_gap';
    const zero_lab = fit(label(pick(lang, 'B looks worse', 'B 看起来更差'), 20, c.coral), 2.4, 0.35);
    zero_lab.move_to([X(0) - 0.1 - zero_lab.width / 2, AX.y + AX.H + 0.2, 0]);

    // ---- re-runs: one dot per simulated eval set, stacked in 1-point bins below the axis
    this.run_group = VGroup();
    (this.run_group as any)._runs = [];
    const dots = always_redraw(() => {
      void this.runs.get_value();
      const g = VGroup(), count = new Map<number, number>();
      for (const d of this.current_runs()) {
        const pts = d * 100, bin = Math.round(clamp(pts, AX.lo, AX.hi));
        const k = count.get(bin) ?? 0;
        count.set(bin, k + 1);
        const col = pts < 0 ? c.coral : c.accent;
        g.add(rect(X(bin) - 0.09, AX.y - 1.1 - k * 0.2, 0.18, 0.16, col, 0.9));
      }
      return g;
    });
    this.run_group.add(dots);
    this.run_group.name = 'runs';
    const tally = always_redraw(() => {
      void this.runs.get_value();
      const r = this.current_runs(), lost = r.filter((d) => d < 0).length;
      const s = r.length
        ? pick(lang, `re-runs: ${r.length} · B came out behind: ${lost}`, `重新评测 ${r.length} 次 · B 落后 ${lost} 次`)
        : pick(lang, 're-run the eval to draw new question sets', '重新评测一次 = 换一份新的评测题');
      const m = fit(label(s, 22, r.length ? c.ink : c.muted), 6.5, 0.4);
      return m.move_to([-6.85 + m.width / 2, -1.95, 0]);
    });

    // ---- readouts, formula, controls
    const ro_se = readout(pick(lang, 'standard error of the gap (points)', '差距的标准误（分）'), () => this.se() * 100, { x: -6.85, y: -2.6, decimals: 1, size: 22 });
    const ro_ci = readout(pick(lang, '95% interval ± (points)', '95% 区间 ±（分）'), () => 1.96 * this.se() * 100, { x: -6.85, y: -3.15, decimals: 1, size: 22 });
    const ro_flip = readout(pick(lang, 'chance B looks worse', 'B 看起来更差的概率'), () => this.flip() * 100, { x: -6.85, y: -3.7, decimals: 1, size: 22, unit: '\\%', value_color: c.coral });
    const readouts = VGroup(ro_se, ro_ci, ro_flip);
    readouts.name = 'readouts';
    const f_ind = (MathTex as any)('\\mathrm{SE}=\\sqrt{\\frac{p_A q_A+p_B q_B}{n}}', { font_size: 28, color: c.ink });
    const f_pair = (MathTex as any)('\\mathrm{SE}=\\sqrt{\\frac{\\delta-\\Delta^2}{n}}', { font_size: 28, color: c.ink });
    f_ind.move_to([-1.55 + f_ind.width / 2, -2.75, 0]);
    f_pair.move_to([-1.55 + f_pair.width / 2, -3.5, 0]);
    const formula = VGroup(f_ind, f_pair);
    formula.add_updater(() => {
      const p = this.is_paired();
      f_ind.set_opacity(p ? 0.3 : 1);
      f_pair.set_opacity(p ? 1 : 0.3);
    });
    formula.name = 'formula';
    const n_ctl = slider(this.n, { x: 3.25, y: -1.95, width: 2.55, min: 10, max: 5000, log: true, title: 'n', decimals: 0, snap: (v) => Math.round(v) });
    const pair_ctl = choice(this.paired, [pick(lang, 'independent', '独立比较'), pick(lang, 'paired (same questions)', '配对（同一批题）')], { x: 2.45, y: -2.75, width: 3.6, size: 20, gap: 0.42 });
    const d_ctl = slider(this.discord, { x: 3.25, y: -3.65, width: 2.55, min: 0.02, max: 0.5, title: 'δ', decimals: 2 });
    this.ctls = [n_ctl, pair_ctl, d_ctl];
    d_ctl.group.add_updater((m: any) => m.set_opacity(this.is_paired() ? 1 : 0.35));
    const controls = VGroup(n_ctl.group, pair_ctl.group, d_ctl.group);
    controls.name = 'controls';
    const note = fit(label(pick(lang, `p_A = ${this.p.p_a}, p_B = ${this.pb().toFixed(2)}; curve: normal approximation; re-runs: seeded simulation`, `p_A = ${this.p.p_a}，p_B = ${this.pb().toFixed(2)}；曲线：正态近似；重新评测：固定种子的模拟`), 18, c.muted), 7.5, 0.32);
    note.move_to([6.85 - note.width / 2, 3.72, 0]);
    note.name = 'note';

    // ---- story
    const n0 = this.n.get_value(), p0 = this.paired.get_value();
    this.n.set_value(200);
    this.paired.set_value(0);
    this.play(FadeIn(axis), FadeIn(note), { run_time: 0.8 });
    this.add(curve);
    this.play(FadeIn(true_gap), { run_time: 0.6 });
    this.add(flip_area);
    this.play(FadeIn(zero_lab), { run_time: 0.6 });
    for (const m of readouts.submobjects) (m as any).update(0);
    this.play(FadeIn(readouts), FadeIn(formula), { run_time: 0.8 });
    this.add(this.run_group, tally, controls);
    for (let k = 0; k < 8; k++) {
      this.rerun();
      this.wait(0.3);
    }
    this.play(Indicate(ro_flip, { color: c.coral, scale_factor: 1.1 }), { run_time: 0.8 });
    this.play(this.paired.animate.set_value(1), { run_time: 1 });
    this.wait(0.6);
    this.play(this.paired.animate.set_value(0), this.n.animate.set_value(n_for_flip(this.pa(), this.pb())), { run_time: 2 });
    this.play(Indicate(ro_flip, { color: c.coral, scale_factor: 1.1 }), { run_time: 0.8 });
    this.play(this.n.animate.set_value(n0), this.paired.animate.set_value(p0), { run_time: 1.2 });
    this.add(axis, curve, flip_area, true_gap, zero_lab, this.run_group, tally, readouts, formula, controls, note);
    this.wait(0.8);
  }
}
