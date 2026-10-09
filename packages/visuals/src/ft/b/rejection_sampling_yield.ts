// Rejection sampling as a data source: sample n answers per problem, keep the
// correct ones (at most c per problem), train on what is kept. Three kinds of
// problems with assumed pass rates (an illustration): easy p = 0.9, medium 0.3,
// hard 0.02. Exact expectations: coverage 1 - (1 - p)^n, kept per problem
// E[min(X, c)] with X ~ Bin(n, p), the dataset's mix by kind, the sampling
// budget. Hard problems are 30% of the problems but ~1.5% of the data at n = 8:
// what is kept is what the model can already do. Bars per problem show one
// seeded draw. Explore: samples per problem n, cap c, extra samples m for the
// hard problems.
import { DashedLine, FadeIn, Indicate, MathTex, Scene, VGroup, VMobject, ValueTracker, always_redraw } from 'manim-web';
import { palette } from '../../theme';
import { define_visual } from '../../visual';
import { fit, label } from '../f/kit';
import { LANG_SPEC, choice, clamp, idx, pick, readout, rect, resolve_lang, seg, slider, type Lang } from './kit';

export interface RejectionSamplingYieldParams extends Record<string, unknown> {
  n: number;
  cap: string;
  hard_boost: number;
  p_easy: number;
  p_medium: number;
  p_hard: number;
  problems: number;
  lang: string;
}

/** log of n choose k. */
function lchoose(n: number, k: number): number {
  let s = 0;
  for (let i = 1; i <= k; i++) s += Math.log((n - k + i) / i);
  return s;
}
/** E[min(X, cap)] for X ~ Bin(n, p); cap = Infinity gives n·p. */
export function expected_kept(n: number, p: number, cap = Infinity): number {
  if (!Number.isFinite(cap) || cap >= n) return n * p;
  if (p <= 0) return 0;
  if (p >= 1) return Math.min(n, cap);
  let e = 0;
  for (let k = 0; k <= n; k++) {
    const pmf = Math.exp(lchoose(n, k) + k * Math.log(p) + (n - k) * Math.log(1 - p));
    e += Math.min(k, cap) * pmf;
  }
  return e;
}
/** Probability that at least one of n samples is correct. */
export const coverage = (n: number, p: number) => 1 - Math.pow(1 - p, n);

export interface Kind { share: number; p: number }
/** The dataset after rejection sampling: kept samples per kind, their shares, coverage, and the budget (samples drawn). */
export function rs_yield(kinds: Kind[], problems: number, n: number, cap: number, boost: number, hard_below = 0.1) {
  const per = kinds.map((k) => {
    const nk = k.p < hard_below ? n * boost : n;
    const count = k.share * problems;
    return { n: nk, count, kept: count * expected_kept(nk, k.p, cap), coverage: coverage(nk, k.p), drawn: count * nk };
  });
  const total = per.reduce((a, b) => a + b.kept, 0);
  return { per, total, shares: per.map((x) => (total > 0 ? x.kept / total : 0)), budget: per.reduce((a, b) => a + b.drawn, 0) };
}

const CAPS = [1, 2, 4, Infinity];
const BOOSTS = [1, 2, 4, 8];

export const rejection_sampling_yield = define_visual<RejectionSamplingYieldParams>({
  name: 'rejection_sampling_yield',
  summary: 'Rejection sampling (best-of-n, expert iteration) as SFT data: three kinds of problems with assumed pass rates (easy 0.9, medium 0.3, hard 0.02, an illustration). Exact expectations of coverage 1-(1-p)^n, kept samples E[min(X,c)], the dataset mix and the sampling budget; bars show one seeded draw of kept answers per problem. Controls: samples per problem n, cap c per problem, extra samples m for hard problems.',
  topics: ['fine-tuning', 'sft', 'rejection sampling', 'best-of-n', 'expert iteration', 'synthetic data', 'data'],
  params: {
    n: { type: 'integer', min: 1, max: 64, default: 8, doc: 'samples drawn per problem' },
    cap: { type: 'enum', values: ['1', '2', '4', 'none'], default: 'none', doc: 'keep at most this many correct answers per problem (none = keep all)' },
    hard_boost: { type: 'integer', min: 1, max: 8, default: 1, doc: 'multiply n by this for the hard problems (pass rate below 0.1): 1, 2, 4 or 8' },
    p_easy: { type: 'number', min: 0.5, max: 0.99, default: 0.9, doc: 'assumed pass rate of the easy problems (30% of the problems)' },
    p_medium: { type: 'number', min: 0.1, max: 0.6, default: 0.3, doc: 'assumed pass rate of the medium problems (40%)' },
    p_hard: { type: 'number', min: 0.005, max: 0.09, default: 0.02, doc: 'assumed pass rate of the hard problems (30%)' },
    problems: { type: 'integer', min: 20, max: 1000, default: 100, doc: 'number of problems' },
    lang: LANG_SPEC,
  },
  examples: [{}, { lang: 'zh' }, { cap: '1', n: 16 }, { cap: '1', hard_boost: 8, lang: 'zh' }, { n: 64, problems: 1000 }, { n: 1, cap: '1', lang: 'zh' }],
  ids: ['kinds', 'dataset_bar', 'coverage', 'budget', 'formula', 'controls', 'illustration_note'],
  scene: (p) => new RejectionScene(p, resolve_lang(p.lang)),
  explore: (scene: any, ui) => scene.attach(ui),
});

export class RejectionScene extends Scene {
  p: RejectionSamplingYieldParams;
  lang: Lang;
  /** Samples per problem. */
  n = ValueTracker(8);
  /** Index into caps [1, 2, 4, none]. */
  cap = ValueTracker(3);
  /** Index into boosts [1, 2, 4, 8] for the hard problems. */
  boost = ValueTracker(0);
  /** Seed of the illustrated draw (a world's "draw again" action bumps it). */
  seed = ValueTracker(1);
  kinds: Kind[];
  ctls: any[] = [];
  constructor(p: RejectionSamplingYieldParams, lang: Lang) {
    super();
    this.p = p;
    this.lang = lang;
    this.kinds = [{ share: 0.3, p: p.p_easy }, { share: 0.4, p: p.p_medium }, { share: 0.3, p: p.p_hard }];
  }
  n_now(): number {
    return Math.round(clamp(this.n.get_value(), 1, 64));
  }
  cap_now(): number {
    return CAPS[idx(this.cap, CAPS.length)];
  }
  boost_now(): number {
    return BOOSTS[idx(this.boost, BOOSTS.length)];
  }
  /** Exact expectations for the current settings. */
  stats() {
    return rs_yield(this.kinds, this.p.problems, this.n_now(), this.cap_now(), this.boost_now());
  }
  attach(ui: any): void {
    for (const c of this.ctls) c.attach(ui);
  }

  override construct() {
    const c = palette();
    const lang = this.lang;
    this.n.set_value(this.p.n);
    this.cap.set_value(['1', '2', '4', 'none'].indexOf(this.p.cap));
    this.boost.set_value(Math.max(0, BOOSTS.indexOf(this.p.hard_boost)));
    this.n.name = 'samples_per_problem';
    this.cap.name = 'cap';
    this.boost.name = 'hard_boost';
    this.track(this.n, this.cap, this.boost, this.seed);
    const cols = [c.good, c.accent, c.coral];
    const names = [pick(lang, 'easy', '简单'), pick(lang, 'medium', '中等'), pick(lang, 'hard', '难')];

    // ---- the three kinds: one seeded draw of kept answers for 10 example problems
    const BLK = { x0: -6.85, x1: -0.6, ys: [2.55, 0.55, -1.45], h: 1.15 };
    const titles = VGroup(...this.kinds.map((k, i) => {
      const s = pick(lang, `${names[i]}: ${Math.round(k.share * 100)}% of problems, pass rate p = ${k.p}`, `${names[i]}：占题目 ${Math.round(k.share * 100)}%，通过率 p = ${k.p}`);
      const m = fit(label(s, 22, cols[i]), 6.2, 0.4);
      return m.move_to([BLK.x0 + m.width / 2, BLK.ys[i] + BLK.h / 2 + 0.25, 0]);
    }));
    // a tiny seeded PRNG (mulberry32) so the draw is deterministic
    const rng = (s: number) => () => {
      s |= 0; s = (s + 0x6d2b79f5) | 0;
      let t = Math.imul(s ^ (s >>> 15), 1 | s);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
    const kept_draws = (): number[][] => {
      const r = rng(Math.round(this.seed.get_value()) * 7919 + 17);
      return this.kinds.map((k) => {
        const nk = k.p < 0.1 ? this.n_now() * this.boost_now() : this.n_now();
        return Array.from({ length: 10 }, () => {
          let x = 0;
          for (let j = 0; j < nk; j++) if (r() < k.p) x++;
          return Math.min(x, this.cap_now());
        });
      });
    };
    const draws = always_redraw(() => {
      const d = kept_draws();
      const cap = this.cap_now();
      const top = Math.max(1, ...d.flat(), Number.isFinite(cap) ? cap : 0);
      const g = VGroup();
      const bw = (BLK.x1 - BLK.x0) / 10;
      d.forEach((row, i) => {
        const y0 = BLK.ys[i] - BLK.h / 2;
        g.add(seg([BLK.x0, y0], [BLK.x1, y0], c.muted, 2));
        row.forEach((v, j) => {
          const h = (v / top) * BLK.h;
          if (v > 0) g.add(rect(BLK.x0 + j * bw + bw * 0.15, y0, bw * 0.7, h, cols[i], 0.85));
          else g.add(rect(BLK.x0 + j * bw + bw * 0.35, y0, bw * 0.3, 0.04, c.muted, 0.6));
        });
        if (Number.isFinite(cap) && cap <= top) {
          const y = y0 + (cap / top) * BLK.h;
          g.add(DashedLine([BLK.x0, y, 0], [BLK.x1, y, 0], { color: c.ink, stroke_width: 2, dash_length: 0.1 }) as unknown as VMobject);
        }
      });
      return g;
    });
    const kinds = VGroup(titles, draws);
    kinds.name = 'kinds';
    const note = fit(label(pick(lang, 'illustration: assumed pass rates; bars = answers kept for 10 example problems (one seeded draw)', '示意：通过率是假设的；柱子 = 10 道示例题各保留的答案数（一次固定种子的抽样）'), 20, c.muted), 13.6, 0.34);
    note.move_to([BLK.x0 + note.width / 2, -3.68, 0]);
    note.name = 'illustration_note';
    const cap_note = fit(label(pick(lang, 'dashed line = cap c', '虚线 = 每题上限 c'), 18, c.muted), 3, 0.3);
    cap_note.move_to([BLK.x0 + cap_note.width / 2, -2.95, 0]);

    // ---- the dataset (exact expectations)
    const DS = { x0: 0.3, x1: 6.85, y: 3.02, h: 0.42 };
    const ds_title = fit(label(pick(lang, 'the SFT dataset: kept answers by kind (expected)', 'SFT 数据集：各类题保留的答案占比（期望值）'), 22, c.ink), 6.5, 0.4);
    ds_title.move_to([DS.x0 + ds_title.width / 2, DS.y + 0.48, 0]);
    const ds_bar = always_redraw(() => {
      const sh = this.stats().shares;
      const g = VGroup();
      let x = DS.x0;
      sh.forEach((s, i) => {
        const w = s * (DS.x1 - DS.x0);
        g.add(rect(x, DS.y - DS.h / 2, w, DS.h, cols[i], 0.85, c.bg, 2));
        x += w;
      });
      return g;
    });
    const share_ro = VGroup(...[0, 1, 2].map((i) => readout(names[i], () => this.stats().shares[i] * 100, { x: DS.x0 + i * 2.2, y: DS.y - 0.55, decimals: 1, unit: '\\%', size: 22, color: cols[i], value_color: cols[i] })));
    const dataset_bar = VGroup(ds_title, ds_bar, share_ro);
    dataset_bar.name = 'dataset_bar';
    const cov_title = fit(label(pick(lang, 'problems with at least one correct answer', '至少有一个正确答案的题目比例'), 22, c.ink), 6.5, 0.4);
    cov_title.move_to([DS.x0 + cov_title.width / 2, 1.95, 0]);
    const cov_ro = VGroup(...[0, 1, 2].map((i) => readout(names[i], () => this.stats().per[i].coverage * 100, { x: DS.x0 + i * 2.2, y: 1.45, decimals: 1, unit: '\\%', size: 22, color: cols[i], value_color: cols[i] })));
    const cov = VGroup(cov_title, cov_ro);
    cov.name = 'coverage';
    const budget = readout(pick(lang, 'answers sampled (budget)', '采样的回答总数（预算）'), () => this.stats().budget, { x: DS.x0, y: 0.75, decimals: 0, size: 22 });
    budget.name = 'budget';
    const formula = (MathTex as any)('1-(1-p)^{n}', '\\qquad', '\\mathbb{E}[\\min(X, c)],\\ X\\sim\\mathrm{Bin}(n,p)', { font_size: 28, color: c.ink });
    formula.move_to([DS.x0 + formula.width / 2, 0.05, 0]);
    formula.name = 'formula';

    // ---- controls
    const n_ctl = slider(this.n, { x: 1.55, y: -0.85, width: 3.6, min: 1, max: 64, log: true, title: 'n', label: pick(lang, 'samples per problem n', '每题采样数 n'), decimals: 0, snap: (v) => Math.round(v), color: c.accent });
    const cap_ctl = choice(this.cap, ['c = 1', 'c = 2', 'c = 4', pick(lang, 'no cap', '不设上限')], { x: 0.55, y: -1.65, width: 2.6, size: 20, gap: 0.42, title: pick(lang, 'cap per problem', '每题上限') });
    const boost_ctl = choice(this.boost, ['×1', '×2', '×4', '×8'], { x: 3.75, y: -1.65, width: 3.0, size: 20, gap: 0.42, title: pick(lang, 'hard problems: n ×', '难题加采：n ×') });
    this.ctls = [n_ctl, cap_ctl, boost_ctl];
    const controls = VGroup(n_ctl.group, cap_ctl.group, boost_ctl.group);
    controls.name = 'controls';

    // ---- story
    const n0 = this.n.get_value(), cap0 = this.cap.get_value(), boost0 = this.boost.get_value();
    this.n.set_value(8);
    this.cap.set_value(3);
    this.boost.set_value(0);
    this.play(FadeIn(titles), { run_time: 0.8 });
    this.add(draws);
    this.play(FadeIn(note), FadeIn(cap_note), { run_time: 0.6 });
    for (const m of [...share_ro.submobjects, ...cov_ro.submobjects, budget]) (m as any).update(0);
    this.play(FadeIn(ds_title), FadeIn(share_ro), { run_time: 0.8 });
    this.add(ds_bar);
    this.play(Indicate(share_ro.submobjects[2], { color: c.coral, scale_factor: 1.2 }), { run_time: 0.9 });
    this.play(FadeIn(cov), FadeIn(budget), FadeIn(formula), { run_time: 0.8 });
    this.add(controls);
    this.wait(0.6);
    // more samples: everything grows, the mix does not change
    this.play(this.n.animate.set_value(32), { run_time: 2 });
    this.wait(0.5);
    // a cap per problem, then extra samples for the hard ones
    this.play(this.n.animate.set_value(8), this.cap.animate.set_value(0), { run_time: 1.4 });
    this.play(this.boost.animate.set_value(3), { run_time: 1.2 });
    this.play(Indicate(share_ro.submobjects[2], { color: c.coral, scale_factor: 1.2 }), { run_time: 0.9 });
    this.wait(0.6);
    this.play(this.n.animate.set_value(n0), this.cap.animate.set_value(cap0), this.boost.animate.set_value(boost0), { run_time: 1.2 });
    this.add(kinds, dataset_bar, cov, budget, formula, controls, note, cap_note);
    this.wait(0.8);
  }
}
