// Q1 of the ECON90015 mock exam: a quota on imported wind turbines. USF buyers' demand p = 60 − Q/2,
// Middle Kingdom's sellers' supply p = Q/10, and each turbine gives USF `ext` of cleaner air (the
// dashed curve D + ext is what one more turbine is worth to USF). Drag the quota: the price comes off
// the demand curve; A (gold) is what buyers pay above the free-trade price on the turbines still
// bought, B (purple) the value lost on the turbines no longer bought, the green strip their lost air.
// Right: USF's social benefit against the quota. With the licences sold, the rent between the buyers'
// price and the sellers' price stays in USF; even then the best quota is the free-trade quantity,
// because the cleaner air and USF's power as the only buyer cancel (when ext = 10).
import { Create, FadeIn, Circle, Scene, UpdateFromAlphaFunc, VGroup, ValueTracker, smooth } from 'manim-web';
import { palette } from '../theme';
import { define_visual } from '../visual';
import { aside } from '../aside';
import { Choice, LANG_SPEC, Plot, between, drag_x, emit, follow, live_fill, live_label, money, pick, resolve_lang, round_ticks, tex, words, type XY } from './kit';

export interface QuotaParams extends Record<string, unknown> {
  quota: number;
  ext: number;
  licences: boolean;
  lang: string;
}

/** The market and USF's accounts at a quota q (no effect at q >= 100, the free-trade quantity). */
export function quota_market(q: number, ext: number) {
  const Q = Math.min(q, 100), p = 60 - Q / 2, s = Q / 10;
  const cs = (Q * Q) / 4, air = ext * Q, rent = (p - s) * Q;
  return { Q, p, s, cs, air, rent, sb: cs + air, sb_lic: cs + air + rent, sb0: 2500 + 100 * ext };
}

export const econ_quota = define_visual<QuotaParams>({
  name: 'econ_quota',
  summary: 'Import quota welfare (ECON90015 Q1: demand p = 60 − Q/2, import supply p = Q/10, external benefit per unit): drag the quota and see the price off demand, the extra paid on units still bought (A), the value and cleaner air lost on units no longer bought (B), and USF social benefit against the quota, with or without selling the import licences.',
  topics: ['economics', 'welfare', 'quota', 'trade policy', 'consumer surplus', 'externality', 'quota rent'],
  params: {
    quota: { type: 'number', min: 10, max: 120, default: 60, doc: 'the quota the scene ends on (units); 100 or more does not bind' },
    ext: { type: 'number', min: 0, max: 20, default: 10, doc: 'external benefit to USF per turbine (10 in the exam)' },
    licences: { type: 'boolean', default: false, doc: 'start with the import licences sold, so the quota rent stays in USF' },
    lang: LANG_SPEC,
  },
  examples: [{}, { lang: 'zh' }, { quota: 20, licences: true }, { quota: 100, ext: 0 }, { quota: 30, ext: 20, licences: true, lang: 'zh' }],
  ids: ['market', 'demand', 'social_value', 'supply', 'quota_line', 'areas', 'price', 'welfare', 'readout', 'licences'],
  scene: (p) => {
    const lang = resolve_lang(p.lang);
    const L = (en: string, zh: string) => pick(lang, en, zh);
    const e = p.ext;
    class Quota extends Scene {
      q = new ValueTracker(120);
      lic = new ValueTracker(p.licences ? 1 : 0);
      choice!: Choice;
      plot!: Plot;
      override construct() {
        const c = palette();
        const { q, lic } = this;
        this.track(q, lic);
        const m = () => quota_market(q.get_value(), e);
        const sold = () => lic.get_value() > 0.5;
        const key = () => `${q.get_value().toFixed(3)}|${sold()}`;
        aside(this, words(L('the numbers of Q1; one buyer country (USF), one seller country (MK)', '第 1 题的数；一个买方国家（USF），一个卖方国家（MK）'), 20, c.muted, -6.9, 3.6));

        // ---- the market
        const ymax = 64 + e;
        const P = new Plot({ box: { x0: -6.25, x1: -0.6, y0: -2.45, y1: 2.55 }, x: [0, 125], y: [0, ymax], x_ticks: [50, 100], y_ticks: [10], x_label: { tex: 'Q' }, y_label: { tex: 'p' }, font: 24 });
        this.plot = P;
        P.group.name = 'market';
        const d_curve = P.curve([[0, 60], [120, 0]], { color: c.accent, width: 4.5 });
        const d_tag = tex('D', 30, c.accent).move_to([P.X(122) + 0.18, P.Y(3), 0]);
        const demand = VGroup(d_curve, d_tag);
        demand.name = 'demand';
        const social_curve = P.curve([[0, 60 + e], [120 + 2 * e, 0]], { color: c.good, width: 3, dash: true });
        const social_tag = tex(`D + ${e}`, 26, c.good);
        social_tag.move_to([P.X(74) + social_tag.width / 2, P.Y(60 + e - 37) + 0.34, 0]);
        const social = VGroup(social_curve, social_tag);
        social.name = 'social_value';
        const s_solid = P.live_curve(() => [[0, 0], [m().Q, m().s]], { color: c.coral, width: 4.5 }, key);
        const s_dash = P.live_curve(() => [[m().Q, m().Q / 10], [125, 12.5]], { color: c.coral, width: 3, dash: true, opacity: 0.6 }, key);
        const s_tag = tex('S', 30, c.coral).move_to([P.X(125) + 0.2, P.Y(12.5), 0]);
        const supply = VGroup(s_solid, s_dash, s_tag);
        supply.name = 'supply';
        const free = VGroup(P.curve([[100, 0], [100, 10]], { color: c.muted, width: 2, dash: true }), P.curve([[0, 10], [100, 10]], { color: c.muted, width: 2, dash: true }), Circle({ radius: 0.07, color: c.ink, fill_opacity: 1, stroke_width: 0 }).move_to(P.P(100, 10)));

        // the quota: a vertical line with a knob at the top (the handle)
        const top = ymax - 3;
        const qline = P.live_curve(() => [[q.get_value(), 0], [q.get_value(), top]], { color: c.coral, width: 3.5 }, () => q.get_value().toFixed(3));
        const knob = follow(Circle({ radius: 0.12, color: c.coral, fill_opacity: 1, stroke_width: 0 }), () => P.P(q.get_value(), top));
        const qlabel = live_label(() => `${L('quota', '配额')} ${Math.round(q.get_value())}`, 24, c.coral, (t) => {
          const x = P.X(q.get_value());
          t.move_to([q.get_value() > 92 ? x - 0.2 - t.width / 2 : x + 0.2 + t.width / 2, P.Y(top), 0]);
        });
        const quota_line = VGroup(qline, knob, qlabel);
        quota_line.name = 'quota_line';

        // the areas: consumer surplus kept, A (or the rent, licences sold), B and the lost air
        const cs = live_fill(() => between(P, (x) => 60 - x / 2, () => m().p, 0, m().Q), c.accent, 0.12, key);
        const a = live_fill(() => between(P, () => m().p, () => (sold() ? m().s : 10), 0, m().Q), c.gold, 0.4, key);
        const b = live_fill(() => between(P, (x) => 60 - x / 2, () => 10, m().Q, 100), c.purple, 0.32, key);
        const air = live_fill(() => between(P, (x) => 60 + e - x / 2, (x) => 60 - x / 2, m().Q, 100), c.good, 0.3, key);
        const show = (f: () => boolean, t: any) => {
          const upd = (x: any) => {
            const k = f() ? 1 : 0;
            if (x._vis !== k) {
              x._vis = k;
              x.set_opacity(k);
            }
          };
          upd(t);
          t.add_updater(upd);
          return t;
        };
        const binds = () => m().Q < 99.5;
        const a_tag = show(() => binds() && m().Q > 12, follow(tex('A', 30, c.gold), () => P.P(m().Q / 2, (m().p + (sold() ? m().s : 10)) / 2)));
        const b_tag = show(() => m().Q < 88, follow(tex('B', 30, c.purple), () => P.P(m().Q + (100 - m().Q) * 0.3, 10 + (60 - (m().Q + (100 - m().Q) * 0.3) / 2 - 10) * 0.35)));
        const areas = VGroup(cs, a, b, air, a_tag, b_tag);
        areas.name = 'areas';
        const pdot = follow(Circle({ radius: 0.08, color: c.accent, fill_opacity: 1, stroke_width: 0 }), () => P.P(m().Q, m().p));
        const pguide = P.live_curve(() => [[0, m().p], [m().Q, m().p]], { color: c.accent, width: 2, dash: true }, key);
        // the price is read on the axis, where the dashed line from the point meets it
        const plabel = live_label(() => (m().p > 14 ? `${Math.round(m().p * 10) / 10}` : ''), 24, c.accent, (t) => t.move_to([P.box.x0 - 0.12 - t.width / 2, P.Y(m().p), 0]));
        const price = VGroup(pguide, pdot, plabel);
        price.name = 'price';

        // ---- USF's social benefit against the quota
        const curve_no = (x: number) => quota_market(x, e).sb, curve_lic = (x: number) => quota_market(x, e).sb_lic;
        const xs = Array.from({ length: 121 }, (_, i) => 5 + i);
        const hi = Math.max(...xs.map(curve_lic)) * 1.12;
        const R = new Plot({ box: { x0: 1.2, x1: 6.6, y0: -2.45, y1: 2.55 }, x: [0, 125], y: [0, hi], x_ticks: [50, 100], y_ticks: round_ticks(hi), y_fmt: (v) => money(v), x_label: L('quota', '配额'), y_label: L('USF social benefit', 'USF 社会收益'), font: 24 });
        const sb0 = quota_market(100, e).sb0;
        const free_line = VGroup(R.hline(sb0, c.muted, { width: 2 }), R.note(L('free trade', '自由贸易'), 4, sb0 + hi * 0.05, c.muted, 22));
        const curve = (f: (x: number) => number, color: string, on: () => boolean) => {
          const vm = R.curve(xs.map((x) => [x, f(x)] as XY), { color, width: 4.5 });
          const upd = (x: any) => {
            const k = on() ? 1 : 0;
            if (x._on !== k) {
              x._on = k;
              x.set_stroke({ opacity: k ? 1 : 0.28, width: k ? 4.5 : 3 });
            }
          };
          upd(vm);
          vm.add_updater(upd);
          return vm;
        };
        const sb_dot = R.live_dot(() => [q.get_value(), sold() ? curve_lic(q.get_value()) : curve_no(q.get_value())], c.ink, 0.09);
        const curves = VGroup(curve(curve_no, c.coral, () => !sold()), curve(curve_lic, c.gold, sold));
        const welfare = VGroup(R.group, free_line, curves, sb_dot);
        welfare.name = 'welfare';
        const now = () => (sold() ? m().sb_lic : m().sb);
        const readout = live_label(() => `${money(now())}  (${money(now() - sb0, true) || '0'})`, 28, () => (now() < sb0 - 0.5 ? c.coral : c.ink), (t) => t.move_to([R.box.x1 - t.width / 2, R.Y(hi * 0.12), 0]));
        readout.name = 'readout';
        this.choice = new Choice({ tracker: lic, labels: [L('rent goes to MK', '租金归 MK'), L('licences sold', '拍卖许可证')], x0: 1.2, x1: 6.6, y: 3.42, font_size: 24 });
        this.choice.name = 'licences';

        this.play(FadeIn(P.group), Create(d_curve), Create(s_solid), Create(s_dash), Create(social_curve), { run_time: 1.4 });
        this.play(FadeIn(d_tag), FadeIn(s_tag), FadeIn(social_tag), FadeIn(free), { run_time: 0.6 });
        // (live parts are added, not faded: a fade copies them and they change underneath)
        this.add(areas, price, quota_line);
        this.wait(0.4);
        this.play(UpdateFromAlphaFunc(q, (_m: unknown, t?: number) => q.set_value(120 + (p.quota - 120) * (t ?? 1))), { run_time: 2.8, rate_func: smooth });
        this.play(FadeIn(R.group), FadeIn(free_line), FadeIn(curves), FadeIn(this.choice), { run_time: 1 });
        // brought up to date first: a mobject added after its tracker moved still shows where it was built
        this.add(sb_dot.update(0), readout.update(0));
        this.add(demand, supply, social, areas, price, quota_line, welfare, readout, this.choice);
        this.wait(2.5);
      }
    }
    return new Quota();
  },
  explore: (scene: any, ui, p) => {
    const L = (en: string, zh: string) => pick(resolve_lang(p.lang), en, zh);
    const report = () => {
      const m = quota_market(scene.q.get_value(), p.ext), sold = scene.lic.get_value() > 0.5;
      return { quota: scene.q.get_value(), licences: sold, price: m.p, social_benefit: sold ? m.sb_lic : m.sb, change: (sold ? m.sb_lic : m.sb) - m.sb0 };
    };
    drag_x(ui, scene.plot, scene.q, 64 + p.ext - 3, { lo: 10, hi: 120, step: 5, label: L('the quota', '配额'), on_end: () => emit(scene, 'quota', report()) });
    scene.choice.attach(ui as any, L('who gets the quota rent', '配额租金归谁'), () => emit(scene, 'quota', report()));
  },
});
