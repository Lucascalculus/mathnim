// Q2 of the ECON90015 mock exam: a monopolist (buyers' demand p = 600 − 2Q, MC = 60 + Q) and a tax.
// A percentage tax τ means the seller keeps p_b/(1 + τ): the demand it sees ROTATES down about the
// quantity axis; a per-unit tax t SHIFTS it down by t. Either way the monopolist sets its own MR = MC on
// the curve it sees. Drag the tax (one slider: τ = v, or t = 320v, so the same position is the same
// 80 per unit at τ = 25%): the gap between what buyers pay and what the seller keeps is the tax per
// unit, and the bar splits it into the buyers' share (above the old price 384) and the monopolist's.
import { Create, FadeIn, Circle, Scene, UpdateFromAlphaFunc, VGroup, ValueTracker, smooth } from 'manim-web';
import { palette } from '../theme';
import { define_visual } from '../visual';
import { aside } from '../aside';
import { Choice, LANG_SPEC, Plot, StepSlider, emit, fill_box, follow, live_label, live_vm, money, num, pick, poly_points, resolve_lang, stroke, tex, words } from './kit';

export interface MonopolyTaxParams extends Record<string, unknown> {
  kind: string;
  size: number;
  lang: string;
}

const P0 = 384, Q0 = 108, TS0 = 40824;
/** The monopolist's choice under a tax: kind 'percent' (τ = v) or 'unit' (t = 320v). */
export function monopoly_tax(kind: 'percent' | 'unit', v: number) {
  const pct = kind === 'percent';
  const tau = v, t = 320 * v;
  const Q = pct ? (540 - 60 * tau) / (5 + tau) : (540 - t) / 5;
  const pb = 600 - 2 * Q, ps = pct ? pb / (1 + tau) : pb - t;
  const tax = pb - ps;
  const seen = (x: number) => (pct ? (600 - 2 * x) / (1 + tau) : 600 - 2 * x - t);
  const mr = (x: number) => (pct ? (600 - 4 * x) / (1 + tau) : 600 - 4 * x - t);
  const ts = 540 * Q - 1.5 * Q * Q;
  return { Q, pb, ps, tax, seen, mr, buyers: pb - P0, seller: P0 - ps, revenue: tax * Q, dwl: TS0 - ts };
}

export const econ_monopoly_tax = define_visual<MonopolyTaxParams>({
  name: 'econ_monopoly_tax',
  summary: 'A tax on a monopolist (ECON90015 Q2: demand p = 600 − 2Q, MC = 60 + Q): drag the tax and switch percentage (the demand the seller sees rotates) or per unit (it shifts); the monopolist re-solves MR = MC, and a bar splits the tax per unit between buyers and the monopolist, with output, revenue and the deadweight loss.',
  topics: ['economics', 'monopoly', 'tax incidence', 'ad valorem tax', 'per-unit tax', 'marginal revenue', 'deadweight loss'],
  params: {
    kind: { type: 'enum', values: ['percent', 'unit'], default: 'percent', doc: "'percent': buyers pay (1 + τ) times what the seller keeps; 'unit': buyers pay t more" },
    size: { type: 'number', min: 0, max: 0.6, default: 0.25, doc: 'the tax the scene ends on: τ = size (0.25 = 25%), or t = 320 × size per unit (0.25 → 80)' },
    lang: LANG_SPEC,
  },
  examples: [{}, { lang: 'zh' }, { kind: 'unit' }, { kind: 'unit', size: 0.6, lang: 'zh' }, { size: 0.05 }, { size: 0.6 }],
  ids: ['plot', 'demand', 'seen', 'mr', 'mc', 'outcome', 'kind', 'slider', 'share', 'numbers'],
  scene: (p) => {
    const lang = resolve_lang(p.lang);
    const L = (en: string, zh: string) => pick(lang, en, zh);
    class MonopolyTax extends Scene {
      kind = new ValueTracker(p.kind === 'unit' ? 1 : 0);
      v = new ValueTracker(0);
      choice!: Choice;
      slider!: StepSlider;
      override construct() {
        const c = palette();
        const { kind, v } = this;
        this.track(kind, v);
        const k = () => (kind.get_value() > 0.5 ? 'unit' : 'percent') as 'percent' | 'unit';
        const m = () => monopoly_tax(k(), v.get_value());
        const key = () => `${k()}|${v.get_value().toFixed(4)}`;
        aside(this, words(L('the numbers of Q2', '第 2 题的数'), 20, c.muted, -6.9, 3.6));

        // ---- the market as the monopolist sees it
        const P = new Plot({ box: { x0: -6.1, x1: 0.3, y0: -2.6, y1: 2.9 }, x: [0, 310], y: [0, 640], x_label: { tex: 'Q' }, y_label: { tex: 'p' }, font: 24 });
        P.group.name = 'plot';
        const d_curve = P.curve([[0, 600], [300, 0]], { color: c.accent, width: 4.5 });
        const d_tag = tex('D', 30, c.accent).move_to([P.X(300) + 0.22, P.Y(28), 0]);
        const demand = VGroup(d_curve, d_tag);
        demand.name = 'demand';
        const seen_curve = P.live_curve(() => [[0, m().seen(0)], [310, m().seen(310)]], { color: c.accent, width: 3, dash: true, opacity: 0.75 }, key);
        // named under the dashed curve, ending where it is 150 high: a free corner for every tax
        const seen_tag = live_label(() => L('seller keeps', '卖方实得'), 24, c.accent, (t) => {
          const qa = k() === 'percent' ? (600 - 150 * (1 + v.get_value())) / 2 : (600 - 320 * v.get_value() - 150) / 2;
          t.move_to([P.X(qa) - 0.12 - t.width / 2, P.Y(150) - 0.3, 0]);
        });
        const seen = VGroup(seen_curve, seen_tag);
        seen.name = 'seen';
        const mr_curve = P.live_curve(() => [[0, m().mr(0)], [160, m().mr(160)]], { color: c.purple, width: 4 }, key);
        const mr_tag = follow(tex('MR', 28, c.purple), () => {
          const x0 = Math.max(0, (k() === 'unit' ? 600 - 320 * v.get_value() : 600) / 4);
          return [P.X(x0) + 0.15, P.Y(0) + 0.32];
        });
        const mr = VGroup(mr_curve, mr_tag);
        mr.name = 'mr';
        const mc_curve = P.curve([[0, 60], [310, 370]], { color: c.coral, width: 4 });
        const mc_tag = tex('MC', 28, c.coral).move_to([P.X(300) + 0.1, P.Y(360) + 0.32, 0]);
        const mc = VGroup(mc_curve, mc_tag);
        mc.name = 'mc';
        // without the tax: Q = 108, p = 384
        const before = VGroup(
          Circle({ radius: 0.07, color: c.muted, fill_opacity: 1, stroke_width: 0 }).move_to(P.P(Q0, P0)),
          words(L('no tax', '无税'), 22, c.muted, P.X(Q0) + 0.18, P.Y(P0) + 0.3),
          P.curve([[0, P0], [Q0, P0]], { color: c.muted, width: 1.8, dash: true }),
        );
        // the outcome: buyers' price on D, what the seller keeps below it, the tax as the gap
        const guide_b = P.live_curve(() => [[0, m().pb], [m().Q, m().pb]], { color: c.accent, width: 2, dash: true }, key);
        const guide_s = P.live_curve(() => [[0, m().ps], [m().Q, m().ps]], { color: c.coral, width: 2, dash: true }, key);
        const q_line = P.live_curve(() => [[m().Q, 0], [m().Q, m().ps]], { color: c.muted, width: 2, dash: true }, key);
        const gap_b = live_vm(stroke(c.accent, 9), () => poly_points([[P.X(m().Q), P.Y(P0)], [P.X(m().Q), P.Y(m().pb)]]), key);
        const gap_s = live_vm(stroke(c.coral, 9), () => poly_points([[P.X(m().Q), P.Y(m().ps)], [P.X(m().Q), P.Y(P0)]]), key);
        const dot_b = follow(Circle({ radius: 0.09, color: c.accent, fill_opacity: 1, stroke_width: 0 }), () => P.P(m().Q, m().pb));
        const dot_s = follow(Circle({ radius: 0.09, color: c.coral, fill_opacity: 1, stroke_width: 0 }), () => P.P(m().Q, m().ps));
        const lab_b = live_label(() => num(m().pb), 24, c.accent, (t) => t.move_to([P.box.x0 - 0.12 - t.width / 2, P.Y(m().pb) + (m().tax < 30 ? 0.14 : 0), 0]));
        const lab_s = live_label(() => (m().tax < 2 ? '' : num(m().ps)), 24, c.coral, (t) => t.move_to([P.box.x0 - 0.12 - t.width / 2, P.Y(m().ps) - (m().tax < 30 ? 0.14 : 0), 0]));
        const lab_q = live_label(() => num(m().Q), 24, c.ink, (t) => t.move_to([P.X(m().Q), P.box.y0 - 0.12 - t.height / 2, 0]));
        const outcome = VGroup(guide_b, guide_s, q_line, gap_s, gap_b, dot_s, dot_b, lab_b, lab_s, lab_q);
        outcome.name = 'outcome';

        // ---- the tax: its kind and size
        const RX0 = 1.35, RX1 = 6.6;
        this.choice = new Choice({ tracker: kind, labels: [L('percentage', '百分比税'), L('per unit', '从量税')], x0: RX0, x1: RX1, y: 3.35, font_size: 24 });
        this.choice.name = 'kind';
        this.slider = new StepSlider(v, { lo: 0, hi: 0.6, step: 0.05, x0: RX0 + 1.75, x1: RX1, y: 2.5, color: c.gold });
        const size_tag = live_label(() => (k() === 'percent' ? `τ = ${Math.round(v.get_value() * 100)}%` : `t = ${Math.round(320 * v.get_value())}`), 26, c.gold, (t) => t.move_to([RX0 + t.width / 2, 2.5, 0]));
        const slider = VGroup(this.slider.group, size_tag);
        slider.name = 'slider';

        // ---- who pays: the tax per unit split at the old price
        const BW = RX1 - RX0, BY = 1.45;
        const share_b = () => (m().tax > 1e-6 ? m().buyers / m().tax : 0);
        const bar_bg = fill_box(RX0, BY - 0.22, RX1, BY + 0.22, c.faint, 1);
        const bar_b = live_vm(fill_box(RX0, BY - 0.22, RX0 + 0.01, BY + 0.22, c.accent, 0.85), () => poly_points([[RX0, BY - 0.22], [RX0 + BW * share_b(), BY - 0.22], [RX0 + BW * share_b(), BY + 0.22], [RX0, BY + 0.22], [RX0, BY - 0.22]]), key);
        const bar_s = live_vm(fill_box(RX0, BY - 0.22, RX0 + 0.01, BY + 0.22, c.coral, 0.85), () => (m().tax > 1e-6 ? poly_points([[RX0 + BW * share_b(), BY - 0.22], [RX1, BY - 0.22], [RX1, BY + 0.22], [RX0 + BW * share_b(), BY + 0.22], [RX0 + BW * share_b(), BY - 0.22]]) : new Float64Array(0)), key);
        const pct = (x: number) => `${Math.round(x * 100)}%`;
        const who_b = live_label(() => (m().tax > 1e-6 ? `${L('buyers', '买方')} ${money(m().buyers, true)} · ${pct(share_b())}` : L('no tax', '无税')), 24, c.accent, (t) => t.move_to([RX0 + t.width / 2, BY - 0.55, 0]));
        const who_s = live_label(() => (m().tax > 1e-6 ? `${L('monopolist', '垄断者')} ${money(-m().seller, true)} · ${pct(1 - share_b())}` : ''), 24, c.coral, (t) => t.move_to([RX1 - t.width / 2, BY - 0.95, 0]));
        const share = VGroup(bar_bg, bar_b, bar_s, who_b, who_s);
        share.name = 'share';
        const row = (y: number, f: () => string, col = c.ink) => live_label(f, 26, col, (t) => t.move_to([RX0 + t.width / 2, y, 0]), { max_width: BW });
        const numbers = VGroup(
          row(-0.3, () => `${L('tax per unit', '每单位税')} ${num(m().tax)} = ${num(m().pb)} − ${num(m().ps)}`, c.gold),
          row(-0.9, () => `Q = ${num(m().Q)}  (${L('108 without the tax', '无税时 108')})`),
          row(-1.5, () => `${L('tax revenue', '税收')} ${money(m().revenue)}`),
          row(-2.1, () => `${L('deadweight loss', '无谓损失')} ${money(m().dwl)}`, c.muted),
        );
        numbers.name = 'numbers';

        this.play(FadeIn(P.group), Create(d_curve), Create(mc_curve), { run_time: 1.3 });
        this.play(FadeIn(d_tag), FadeIn(mc_tag), FadeIn(before), { run_time: 0.6 });
        // (live parts are added, not faded: a fade copies them and they change underneath)
        this.add(seen, mr, outcome);
        this.wait(0.6);
        this.play(FadeIn(this.choice), FadeIn(this.slider.group), { run_time: 0.6 });
        this.add(size_tag.update(0), share.update(0), numbers.update(0));
        this.play(UpdateFromAlphaFunc(v, (_m: unknown, a?: number) => v.set_value(p.size * (a ?? 1))), { run_time: 3, rate_func: smooth });
        this.add(demand, mc, slider, share, numbers, this.choice);
        this.wait(2.5);
      }
    }
    return new MonopolyTax();
  },
  explore: (scene: any, ui, p) => {
    const L = (en: string, zh: string) => pick(resolve_lang(p.lang), en, zh);
    const report = () => {
      const kind = scene.kind.get_value() > 0.5 ? 'unit' : 'percent';
      const m = monopoly_tax(kind, scene.v.get_value());
      return { kind, size: scene.v.get_value(), Q: m.Q, buyers_price: m.pb, seller_price: m.ps, buyers_share: m.tax > 0 ? m.buyers / m.tax : 0, revenue: m.revenue };
    };
    scene.choice.attach(ui as any, L('kind of tax', '税的种类'), () => emit(scene, 'monopoly_tax', report()));
    scene.slider.attach(ui as any, L('size of the tax', '税的大小'), { on_end: () => emit(scene, 'monopoly_tax', report()) });
  },
});
