// What the contrastive (InfoNCE / MultipleNegativesRankingLoss) loss does to
// embeddings: unit vectors on a circle - a query q, its positive d⁺ and
// in-batch negatives n₁..n₅. Bars show the softmax weights w_j = softmax(q·d/τ);
// the short arrows at the tips are one gradient step (the push ∝ w_j/τ). Low τ
// sends almost all of the push to the most similar negative - and if that
// "negative" is really relevant (a false negative), it is pushed hardest.
// Exact gradients on toy 2D vectors (lesson A2b, derivation D-A2-5).
// Explore: the τ slider and the query's direction; the lesson's actions train,
// reveal the true labels, filter the false negative and reset.
import { Circle, Dot, FadeIn, MathTex, Rectangle, Scene, VGroup, ValueTracker, smooth } from 'manim-web';
import { constrain } from 'manim-web/ext/interact';
import { Slider } from 'manim-web/ext/widgets';
import { arrow } from '../../linalg/kit';
import { palette } from '../../theme';
import { define_visual } from '../../visual';
import { fit, label, LANG_SPEC, live, pick, resolve_lang, type Lang } from '../f/kit';
import { angle_deg, grad_docs, grad_query, loss, push_shares, sgd_step, tangential, unit, weights } from './infonce';

export interface ContrastiveParams extends Record<string, unknown> {
  tau: number;
  n_neg: number;
  false_negative: boolean;
  lr: number;
  lang: string;
}

const C = [-3.75, -0.25];
const R = 2.75;
/** Angles (degrees) of q, d⁺ and the negatives n₁..n₅ (n₁ is the most similar: the false negative when enabled). */
const START = { q: 90, docs: [128, 108, 57, 12, -42, 205] };
const deg = (d: number) => (d * Math.PI) / 180;
const LT: [number, number] = [Math.log10(0.03), 0]; // log10 τ range
const MAX_STEP = 0.15; // radians: one step never turns a vector more than this (toy setting, shown on the canvas)

export const contrastive_infonce = define_visual<ContrastiveParams>({
  name: 'contrastive_infonce',
  summary: 'InfoNCE / in-batch-negatives loss on 2D unit vectors: query, positive, negatives; bars are softmax weights softmax(q·d/τ), arrows at the tips are one exact gradient step. Low temperature sends nearly all push to the most similar negative - a false negative gets pushed hardest. Student moves τ and the query; train / reveal / filter actions in the lesson.',
  topics: ['contrastive learning', 'infonce', 'embeddings', 'rag', 'hard negatives', 'temperature', 'fine-tuning'],
  params: {
    tau: { type: 'number', min: 0.03, max: 1, default: 0.5, doc: 'temperature τ (sentence-transformers MNRL uses scale = 1/τ = 20, i.e. τ = 0.05)' },
    n_neg: { type: 'integer', min: 1, max: 5, default: 5, doc: 'number of in-batch negatives (batch size - 1)' },
    false_negative: { type: 'boolean', default: true, doc: 'n₁, the negative most similar to q, is really relevant (revealed by the lesson)' },
    lr: { type: 'number', min: 0.001, max: 0.05, default: 0.008, doc: 'learning rate of one training step (on the angles)' },
    lang: LANG_SPEC,
  },
  examples: [{}, { lang: 'zh', tau: 0.05 }, { tau: 1, n_neg: 2 }, { tau: 0.1, false_negative: false, lang: 'zh' }],
  ids: ['circle', 'query', 'positive', 'negatives', 'pushes', 'bars', 'formula', 'readouts', 'tau_slider'],
  scene: (p) => {
    const lang: Lang = resolve_lang(p.lang);
    const L = (en: string, zh: string) => pick(lang, en, zh);
    const N = 1 + p.n_neg;
    class Contrastive extends Scene {
      lt = ValueTracker(Math.log10(p.tau));
      aq = ValueTracker(deg(START.q));
      ad = START.docs.slice(0, N).map((a) => ValueTracker(deg(a)));
      filt = ValueTracker(0);
      rev = ValueTracker(0);
      steps = ValueTracker(0);
      st!: any;
      fn = p.false_negative;
      // ---- the state, read by the lesson's goals and detectors
      tau = () => 10 ** this.lt.get_value();
      q = () => unit(this.aq.get_value());
      docs = () => this.ad.map((t) => unit(t.get_value()));
      active = () => this.ad.map((_, j) => !(this.filt.get_value() > 0.5 && this.fn && j === 1));
      w = () => weights(this.q(), this.docs(), this.tau(), this.active());
      shares = () => push_shares(this.q(), this.docs(), this.tau(), this.active());
      L = () => loss(this.q(), this.docs(), this.tau(), this.active());
      /** Angle (degrees) between q and candidate j. */
      angle_to_q = (j: number) => angle_deg(this.aq.get_value(), this.ad[j].get_value());
      /** The angles after `n` training steps (pure: nothing is changed). */
      after = (n: number) => {
        let q = this.aq.get_value(), d = this.ad.map((t) => t.get_value());
        for (let i = 0; i < n; i++) {
          const s = sgd_step(q, d, this.tau(), p.lr, this.active());
          const cap = (a: number, b: number) => a + Math.max(-MAX_STEP, Math.min(MAX_STEP, b - a));
          q = cap(q, s.q);
          d = d.map((a, j) => cap(a, s.docs[j]));
        }
        return { q, d };
      };
      reset = () => {
        this.aq.set_value(deg(START.q));
        this.ad.forEach((t, j) => t.set_value(deg(START.docs[j])));
        this.steps.set_value(0);
      };
      override construct() {
        const c = palette();
        this.track(this.lt, this.aq, ...this.ad, this.filt, this.rev, this.steps);
        const P = (a: number, r = R) => [C[0] + r * Math.cos(a), C[1] + r * Math.sin(a), 0];
        const circle = Circle({ radius: R, color: c.faint, stroke_width: 3 }).move_to([C[0], C[1], 0]);
        const centre = Dot([C[0], C[1], 0], { radius: 0.05, color: c.muted });
        circle.name = 'circle';
        const name = (j: number) => (j === 0 ? 'd^+' : `n_${j}`);
        const nm = (j: number, size: number, color: string) => MathTex(name(j), { font_size: size, color });
        const is_fn = (j: number) => this.fn && j === 1;
        const col = (j: number) => (j === 0 ? c.good : is_fn(j) && this.rev.get_value() > 0.5 ? c.teal : c.coral);
        // every live group keeps the same structure on every frame (always_redraw pairs children by position)
        const vkey = (j: number) => () => `${this.ad[j].get_value().toFixed(4)}|${this.rev.get_value()}|${this.active()[j]}`;
        const vec = (j: number) => live(vkey(j), () => {
          const a = this.ad[j].get_value(), filtered = !this.active()[j], shown = is_fn(j) && this.rev.get_value() > 0.5;
          const lab = nm(j, 34, col(j)).move_to(P(a, R + 0.38));
          const note = label(L('really relevant', '其实相关'), 24, col(j)).next_to(lab, [0, 1, 0], { buff: 0.08 });
          if (!shown) note.set_opacity(0);
          const g = VGroup(arrow(P(a, 0), P(a), col(j), j === 0 ? 6 : 5, 0.22), lab, note);
          if (filtered) g.set_opacity(0.3);
          return g;
        });
        const qv = live(() => this.aq.get_value().toFixed(4), () => {
          const a = this.aq.get_value();
          return VGroup(arrow(P(a, 0), P(a, R * 0.92), c.ink, 8, 0.26), label('q', 30, c.ink, { weight: 'BOLD' }).move_to(P(a + 0.16, R * 0.62)));
        });
        qv.name = 'query';
        const pos = vec(0);
        pos.name = 'positive';
        const negs = VGroup(...Array.from({ length: N - 1 }, (_, k) => vec(k + 1)));
        negs.name = 'negatives';
        // one gradient step drawn at every tip (scaled x5 so it can be seen)
        const state_key = () => `${this.aq.get_value().toFixed(4)}|${this.ad.map((t) => t.get_value().toFixed(4)).join(',')}|${this.lt.get_value().toFixed(4)}|${this.filt.get_value()}|${this.rev.get_value()}`;
        const pushes = live(state_key, () => {
          const q = this.q(), docs = this.docs(), tau = this.tau(), act = this.active();
          const g = grad_docs(q, docs, tau, act);
          const one = (from: number, da: number, r: number, color: string, on: boolean) => {
            const show = on && Math.abs(da) >= 0.02;
            const m = arrow(P(from, r), P(from + (show ? da : 0.05), r), color, 5, 0.18);
            if (!show) m.set_opacity(0);
            return m;
          };
          const ms: any[] = docs.map((_, j) => {
            const a = this.ad[j].get_value();
            const da = Math.max(-MAX_STEP, Math.min(MAX_STEP, -p.lr * tangential(a, g[j]))) * 5;
            return one(a, da, R, j === 0 ? c.good : c.gold, act[j]);
          });
          const gq = grad_query(q, docs, tau, act), aq = this.aq.get_value();
          ms.push(one(aq, Math.max(-MAX_STEP, Math.min(MAX_STEP, -p.lr * tangential(aq, gq))) * 5, R * 0.92, c.gold, true));
          return VGroup(...ms);
        });
        pushes.name = 'pushes';

        // ---- right panel: softmax weights as bars
        const BX = 1.75, BW = 3.0, ROW = 0.44, Y0 = 3.05;
        const bars_title = label(L('softmax weights  w = softmax(q·d / τ)', 'softmax 权重  w = softmax(q·d / τ)'), 24, c.muted).move_to([0, 3.62, 0]).align_to([0.55, 0, 0], [-1, 0, 0]);
        const bars = live(() => `${this.w().map((x) => x.toFixed(3)).join(',')}|${this.filt.get_value()}|${this.rev.get_value()}`, () => {
          const w = this.w(), act = this.active(), ms: any[] = [];
          for (let j = 0; j < N; j++) {
            const y = Y0 - j * ROW;
            ms.push(nm(j, 30, col(j)).move_to([BX - 0.75, y, 0]));
            ms.push(Rectangle({ width: BW, height: 0.26, stroke_width: 0, fill_color: c.faint, fill_opacity: 1 }).move_to([BX + BW / 2, y, 0]));
            const wj = act[j] ? w[j] : 0, bw = Math.max(0.01, BW * wj);
            ms.push(Rectangle({ width: bw, height: 0.26, stroke_width: 0, fill_color: col(j), fill_opacity: wj > 0.002 ? 0.9 : 0 }).move_to([BX + bw / 2, y, 0]));
            ms.push(label(act[j] ? wj.toFixed(2) : L('filtered', '已过滤'), 22, c.ink).move_to([BX + BW + 0.55, y, 0]));
          }
          return VGroup(...ms);
        });
        bars.name = 'bars';
        // ---- the formula of the push, with τ live
        const formula = live(() => this.tau().toFixed(3), () => MathTex(`\\text{push on } n_j \\;=\\; -\\nabla_{n_j}\\mathcal L \\;=\\; -\\frac{w_j}{\\tau}\\,q,\\quad \\tau = ${this.tau().toFixed(this.tau() < 0.1 ? 3 : 2)}`, { font_size: 30, color: c.ink }).move_to([3.75, 0.05, 0]));
        formula.name = 'formula';
        const readouts = live(() => `${this.L().toFixed(2)}|${this.shares().map((x) => x.toFixed(2)).join(',')}|${Math.round(this.steps.get_value())}|${this.filt.get_value()}`, () => {
          const sh = this.shares();
          let jmax = 1;
          for (let j = 2; j < N; j++) if (sh[j] > sh[jmax]) jmax = j;
          const rows = VGroup(
            MathTex(`\\mathcal L = -\\log w_0 = ${this.L().toFixed(2)}`, { font_size: 30, color: c.ink }),
            fit(VGroup(label(L('most of the push goes to', '负例推力最集中在'), 24, c.ink), MathTex(`${name(jmax)}\\;\\;${Math.round(100 * sh[jmax])}\\%`, { font_size: 30, color: col(jmax) })).arrange([1, 0, 0], { buff: 0.15 }), 6.2),
            fit(label(`${L('steps trained', '已训练步数')}: ${Math.round(this.steps.get_value())}   ${L('filter', '过滤假负例')}: ${this.filt.get_value() > 0.5 ? L('on', '开') : L('off', '关')}`, 24, c.muted), 6.2),
          );
          rows.arrange([0, -1, 0], { buff: 0.2, aligned_edge: [-1, 0, 0] });
          rows.move_to([0, -1.05, 0]).align_to([0.55, 0, 0], [-1, 0, 0]);
          return rows;
        });
        readouts.name = 'readouts';
        const look = { length: 3.6, color: c.accent, track_color: c.faint, stroke_width: 8, knob_radius: 0.15, label: null, show_value: false };
        this.st = new Slider(this.lt, { ...look, x_range: LT }).move_to([3.95, -2.75, 0]);
        const st_cap = label(L('temperature τ (drag; log scale)', '温度 τ（拖动，对数刻度）'), 24, c.muted).move_to([0, -2.32, 0]).align_to([0.55, 0, 0], [-1, 0, 0]);
        const tau_slider = VGroup(this.st, st_cap);
        tau_slider.name = 'tau_slider';
        const honest = fit(label(L('toy model: 2D unit vectors; gradients exact; each step capped at 8°, push arrows drawn 5x', '示意：二维单位向量；梯度精确计算；每步最多转 8°，推力箭头放大 5 倍'), 22, c.muted), 13.4).move_to([0, -3.68, 0]);

        // ---- the story
        this.play(FadeIn(circle), FadeIn(centre), { run_time: 0.8 });
        this.play(FadeIn(qv), FadeIn(pos), FadeIn(negs), { run_time: 1.4 });
        this.play(FadeIn(bars_title), FadeIn(bars), { run_time: 1 });
        this.play(FadeIn(pushes), FadeIn(formula), FadeIn(readouts), FadeIn(honest), { run_time: 1.2 });
        this.play(FadeIn(tau_slider), { run_time: 0.6 });
        // cool down, then warm up: watch the push gather on the most similar negative
        this.play(this.lt.animate.set_value(Math.log10(0.05)), { run_time: 3, rate_func: smooth });
        this.wait(0.8);
        this.play(this.lt.animate.set_value(Math.log10(p.tau)), { run_time: 2, rate_func: smooth });
        this.wait(1);
      }
    }
    return new Contrastive();
  },
  explore: (scene: any, ui) => {
    scene.st.attach(ui, { step: 0.05, label: 'temperature tau (log scale)' });
    ui.add_handle({
      tracker: scene.aq,
      from_value: (a: number) => [C[0] + R * 0.92 * Math.cos(a), C[1] + R * 0.92 * Math.sin(a), 0],
      to_value: (pt: number[]) => {
        const a = Math.atan2(pt[1] - C[1], pt[0] - C[0]), cur = scene.aq.get_value();
        return cur + Math.atan2(Math.sin(a - cur), Math.cos(a - cur));
      },
      constraint: constrain.on_circle([C[0], C[1], 0], R * 0.92),
      step: Math.PI / 90,
      radius: 0.4,
      label: 'the query vector q',
    });
  },
});
