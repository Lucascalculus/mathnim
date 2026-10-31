// Q3b of the ECON90015 mock exam: second-degree price discrimination with two packages. Type 1's demand
// is 24 − q, type 2's 16 − q, MC = 6, one buyer of each; the seller cannot tell them apart. Package 1 is
// 18 units (where D1 meets MC: no distortion at the top). Drag the size q2 of package 2: type 2 pays the
// whole area under its demand (T2, green), but type 1 could take package 2 too and would value it 8q2
// more, so package 1's price must leave type 1 that much (the rent R, gold). Right, one unit at a time:
// one more unit in package 2 earns D2 − MC = 10 − q2 and costs D1 − D2 = 8 of rent; the area between
// the two lines is the profit above 162, largest where they cross, q2 = 2.
import { Create, FadeIn, Circle, Scene, UpdateFromAlphaFunc, VGroup, ValueTracker, smooth } from 'manim-web';
import { palette } from '../theme';
import { define_visual } from '../visual';
import { aside } from '../aside';
import { LANG_SPEC, Plot, between, drag_x, emit, follow, live_fill, live_label, num, pick, resolve_lang, tex, words } from './kit';

export interface ScreeningParams extends Record<string, unknown> {
  q2: number;
  lang: string;
}

/** The two packages when package 2 has q2 units (package 1: 18 units). */
export function packages(q2: number) {
  const T2 = 16 * q2 - (q2 * q2) / 2, R = 8 * q2, T1 = 270 - R;
  const gain = T2 - 6 * q2;
  return { T1, T2, R, gain, profit: T1 - 108 + gain };
}

export const econ_screening = define_visual<ScreeningParams>({
  name: 'econ_screening',
  summary: 'Two packages for two kinds of buyers (ECON90015 Q3b: demands 24 − q and 16 − q, MC = 6): drag the size of the small package and see what the low type pays (area under its demand), the rent the high type must be left (the strip between the demands), and the profit, highest where one more unit earns as much as it costs in rent (q2 = 2).',
  topics: ['economics', 'price discrimination', 'second degree', 'screening', 'information rent', 'packages', 'menu pricing'],
  params: {
    q2: { type: 'number', min: 0, max: 10, default: 2, doc: 'the size of the small package the scene ends on (2 is best; 10 is where its demand meets MC)' },
    lang: LANG_SPEC,
  },
  examples: [{}, { lang: 'zh' }, { q2: 0 }, { q2: 10, lang: 'zh' }, { q2: 5 }],
  ids: ['market', 'demands', 'mc', 'package1', 'package2', 'areas', 'tradeoff', 'readout'],
  scene: (p) => {
    const lang = resolve_lang(p.lang);
    const L = (en: string, zh: string) => pick(lang, en, zh);
    class Screening extends Scene {
      q2 = new ValueTracker(10);
      plot!: Plot;
      override construct() {
        const c = palette();
        const { q2 } = this;
        this.track(q2);
        const q = () => q2.get_value();
        const key = () => q().toFixed(3);
        const pk = () => packages(q());
        aside(this, words(L('the numbers of Q3b; one buyer of each type', '第 3b 题的数；每类一位买家'), 20, c.muted, -6.9, 3.6));

        // ---- the two demands
        const P = new Plot({ box: { x0: -6.2, x1: 0.2, y0: -2.6, y1: 2.8 }, x: [0, 25], y: [0, 26], x_ticks: [18], y_ticks: [6, 16, 24], x_label: { tex: 'q' }, y_label: { tex: 'p' }, font: 24 });
        this.plot = P;
        P.group.name = 'market';
        const d1 = P.curve([[0, 24], [24, 0]], { color: c.accent, width: 4.5 }), d2 = P.curve([[0, 16], [16, 0]], { color: c.purple, width: 4.5 });
        const d_tags = VGroup(tex('D_1', 30, c.accent).move_to([P.X(23) + 0.35, P.Y(2.4), 0]), tex('D_2', 30, c.purple).move_to([P.X(15) + 0.35, P.Y(2.4), 0]));
        const demands = VGroup(d1, d2, d_tags);
        demands.name = 'demands';
        const mc_line = P.curve([[0, 6], [25, 6]], { color: c.coral, width: 3.5 });
        const mc_tag = tex('MC', 28, c.coral).move_to([P.X(23.5), P.Y(6) + 0.3, 0]);
        const mc = VGroup(mc_line, mc_tag);
        mc.name = 'mc';
        const pack1 = VGroup(P.curve([[18, 0], [18, 6]], { color: c.accent, width: 2.5, dash: true }), Circle({ radius: 0.08, color: c.accent, fill_opacity: 1, stroke_width: 0 }).move_to(P.P(18, 6)));
        pack1.name = 'package1';

        // ---- package 2: its size, what type 2 pays, and the rent type 1 keeps
        const t2 = live_fill(() => between(P, (x) => 16 - x, () => 0, 0, q()), c.good, 0.26, key);
        const rent = live_fill(() => between(P, (x) => 24 - x, (x) => 16 - x, 0, q()), c.gold, 0.42, key);
        const shown = (f: () => boolean, m: any) => {
          const upd = (x: any) => {
            const k = f() ? 1 : 0;
            if (x._vis !== k) {
              x._vis = k;
              x.set_opacity(k);
            }
          };
          upd(m);
          m.add_updater(upd);
          return m;
        };
        const t2_tag = shown(() => q() >= 1, follow(tex('T_2', 30, c.good), () => P.P(q() / 2, 3)));
        const r_tag = shown(() => q() >= 1, follow(tex('R', 30, c.gold), () => P.P(q() / 2, 20 - q() / 2)));
        const areas = VGroup(t2, rent, t2_tag, r_tag);
        areas.name = 'areas';
        const line2 = P.live_curve(() => [[q(), 0], [q(), 24 - q()]], { color: c.good, width: 3.5 }, key);
        const knob = follow(Circle({ radius: 0.12, color: c.good, fill_opacity: 1, stroke_width: 0 }), () => P.P(q(), 24 - q()));
        const package2 = VGroup(line2, knob);
        package2.name = 'package2';

        // ---- the trade-off, one unit at a time: what one more unit in package 2 earns (D2 above MC)
        // against the rent it costs (the gap D1 − D2 = 8); the shaded area between them is the profit above 162
        const R = new Plot({ box: { x0: 1.4, x1: 6.6, y0: -2.6, y1: 0.95 }, x: [0, 10], y: [0, 11], x_ticks: [2, 10], y_ticks: [0, 8], x_label: { tex: 'q_2' }, font: 24 });
        const earn = R.curve([[0, 10], [10, 0]], { color: c.good, width: 4.5 });
        const cost = R.curve([[0, 8], [10, 8]], { color: c.gold, width: 4.5 });
        const earn_tag = tex('D_2 - MC', 26, c.good).move_to([R.X(6.4), R.Y(2.2), 0]);
        const cost_tag = tex('D_1 - D_2', 26, c.gold);
        cost_tag.move_to([R.X(10) - cost_tag.width / 2, R.Y(8) + 0.3, 0]);
        const gap_up = live_fill(() => between(R, (x) => 10 - x, () => 8, 0, Math.min(q(), 2)), c.good, 0.3, key);
        const gap_dn = live_fill(() => (q() > 2 ? between(R, () => 8, (x) => 10 - x, 2, q()) : []), c.coral, 0.25, key);
        const now = R.live_curve(() => [[q(), 0], [q(), Math.max(8, 10 - q())]], { color: c.muted, width: 2, dash: true }, key);
        const e_dot = R.live_dot(() => [q(), 10 - q()], c.good, 0.09), c_dot = R.live_dot(() => [q(), 8], c.gold, 0.09);
        const tradeoff = VGroup(R.group, gap_up, gap_dn, earn, cost, earn_tag, cost_tag, now, e_dot, c_dot);
        tradeoff.name = 'tradeoff';
        const row = (y: number, f: () => string, col: string) => live_label(f, 26, col, (t) => t.move_to([1.4 + t.width / 2, y, 0]), { max_width: 5.4 });
        const readout = VGroup(
          row(3.3, () => L(`package 2: ${num(q())} units for ${num(pk().T2)}`, `套餐 2：${num(q())} 个，卖 ${num(pk().T2)}`), c.good),
          row(2.75, () => L(`package 1: 18 units for 270 − ${num(pk().R)} = ${num(pk().T1)}`, `套餐 1：18 个，卖 270 − ${num(pk().R)} = ${num(pk().T1)}`), c.accent),
          row(2.2, () => `${L('profit', '利润')} = 162 + ${num(pk().gain)} − ${num(pk().R)} = ${num(pk().profit)}`, c.ink),
          row(1.65, () => L(`one more unit in package 2: +${num(10 - q())} − 8`, `套餐 2 再加一个：+${num(10 - q())} − 8`), c.muted),
        );
        readout.name = 'readout';

        this.play(FadeIn(P.group), Create(d1), Create(d2), Create(mc_line), { run_time: 1.4 });
        this.play(FadeIn(d_tags), FadeIn(mc_tag), FadeIn(pack1), { run_time: 0.6 });
        // (live parts are added, not faded: a fade copies them and they change underneath)
        this.add(areas, package2);
        this.wait(0.8);
        this.play(FadeIn(R.group), Create(earn), Create(cost), FadeIn(earn_tag), FadeIn(cost_tag), { run_time: 1.2 });
        this.add(gap_up.update(0), gap_dn.update(0), now.update(0), e_dot.update(0), c_dot.update(0), readout.update(0));
        this.play(UpdateFromAlphaFunc(q2, (_m: unknown, a?: number) => q2.set_value(10 + (p.q2 - 10) * (a ?? 1))), { run_time: 3.2, rate_func: smooth });
        this.add(demands, mc, pack1, areas, package2, tradeoff, readout);
        this.wait(2);
      }
    }
    return new Screening();
  },
  explore: (scene: any, ui, p) => {
    const L = (en: string, zh: string) => pick(resolve_lang(p.lang), en, zh);
    drag_x(ui, scene.plot, scene.q2, (x) => 24 - x, { lo: 0, hi: 10, step: 0.5, label: L('size of package 2', '套餐 2 的大小'), on_end: () => emit(scene, 'packages', { q2: scene.q2.get_value(), ...packages(scene.q2.get_value()) }) });
  },
});
