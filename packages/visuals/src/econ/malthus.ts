// Q6 of the ECON90015 mock exam: the Malthusian model. Output Y = A·f(N) with f(N) = 3√N (diminishing
// returns to labour, land and capital fixed); income per person Y/N is the slope of the line from the
// origin to the point on the curve; the population grows while Y/N is above subsistence y* = 1.5 and
// shrinks while it is below, so it settles where the curve meets the ray of slope y*: N* = 4A².
// The story: a wave of immigrants moves the economy right (a flatter ray, income below subsistence), the
// population falls back to N*; then better technology lifts the curve, the population grows until income
// per person is back at y*: more people, the same living standard. Drag the population along the curve,
// and the technology A.
import { Create, FadeIn, Circle, Scene, UpdateFromAlphaFunc, VGroup, ValueTracker, smooth } from 'manim-web';
import { palette } from '../theme';
import { define_visual } from '../visual';
import { aside } from '../aside';
import { LANG_SPEC, Plot, StepSlider, clamp, emit, follow, live_fill, live_label, live_vm, num, pick, poly_points, resolve_lang, stroke, tex, words, type P3, type XY } from './kit';

export interface MalthusParams extends Record<string, unknown> {
  story: string;
  lang: string;
}

const YS = 1.5;
export const output = (A: number, N: number) => A * 3 * Math.sqrt(Math.max(0, N));
/** The Malthusian equilibrium population: A·3√N = y*·N. */
export const n_star = (A: number) => (2 * A) ** 2;

export const econ_malthus = define_visual<MalthusParams>({
  name: 'econ_malthus',
  summary: 'The Malthusian trap (ECON90015 Q6: Y = A·3√N, subsistence y* = 1.5): income per person is the slope of the ray from the origin; drag the population along the production curve to see whether births or deaths win and where it returns, and raise the technology A to see more people at the same living standard.',
  topics: ['economics', 'malthus', 'growth', 'population', 'diminishing returns', 'subsistence', 'macroeconomics'],
  params: {
    story: { type: 'enum', values: ['both', 'immigration', 'technology'], default: 'both', doc: "what the scene plays: a wave of immigrants returning to N*, better technology (more people, same income per person), or both" },
    lang: LANG_SPEC,
  },
  examples: [{}, { lang: 'zh' }, { story: 'immigration' }, { story: 'technology', lang: 'zh' }],
  ids: ['plot', 'production', 'subsistence', 'point', 'ray', 'drift', 'readout', 'technology'],
  scene: (p) => {
    const lang = resolve_lang(p.lang);
    const L = (en: string, zh: string) => pick(lang, en, zh);
    class Malthus extends Scene {
      A = new ValueTracker(1);
      N = new ValueTracker(4);
      plot!: Plot;
      slider!: StepSlider;
      override construct() {
        const c = palette();
        const { A, N } = this;
        this.track(A, N);
        const a = () => A.get_value(), n = () => Math.max(0.2, N.get_value());
        const y = () => output(a(), n());
        const ns = () => n_star(a());
        const key = () => `${a().toFixed(4)}|${n().toFixed(4)}`;
        const income = () => y() / n();
        aside(this, words(L('a toy production curve, Y = 3A√N; subsistence y* = 1.5', '示意的生产曲线 Y = 3A√N；生存收入 y* = 1.5'), 20, c.muted, -6.9, 3.6));

        const P = new Plot({ box: { x0: -6.0, x1: 0.5, y0: -2.7, y1: 3.0 }, x: [0, 10], y: [0, 14], x_label: { tex: 'N' }, y_label: { tex: 'Y' }, font: 24 });
        this.plot = P;
        P.group.name = 'plot';
        const xs = Array.from({ length: 81 }, (_, i) => i / 8);
        const curve = P.live_curve(() => xs.map((x) => [x, output(a(), x)] as XY), { color: c.accent, width: 4.5 }, () => a().toFixed(4));
        const curve_tag = tex('Y = A f(N)', 26, c.accent);
        follow(curve_tag, () => [P.X(10) + 0.14 + curve_tag.width / 2, P.Y(output(a(), 10))]);
        const production = VGroup(curve, curve_tag);
        production.name = 'production';
        const ray0 = P.curve([[0, 0], [14 / YS, 14]], { color: c.good, width: 3.5 });
        const ray0_tag = tex('y^*', 30, c.good).move_to([P.X(14 / YS) + 0.3, P.box.y1 - 0.15, 0]);
        const subsistence = VGroup(ray0, ray0_tag);
        subsistence.name = 'subsistence';
        // the economy now, and its income per person as the slope of the ray to it
        const ray = P.live_curve(() => [[0, 0], [10, 10 * income()]], { color: c.gold, width: 3, dash: true }, key);
        // named at its top end
        const ray_tag = follow(tex('Y/N', 26, c.gold), () => {
          const x = Math.min(10, 13.2 / income());
          return [P.X(x) + 0.45, P.Y(x * income())];
        });
        const ray_tag_vis = (m: any) => {
          const upd = (x: any) => {
            // hidden on the subsistence ray (y* names both) and where it would sit on the curve's own name
            const x_end = Math.min(10, 13.2 / income());
            const on_curve_tag = x_end > 9.99 && Math.abs(P.Y(x_end * income()) - P.Y(output(a(), 10))) < 0.42;
            const k = Math.abs(income() - YS) > 0.2 && !on_curve_tag ? 1 : 0;
            if (x._vis !== k) {
              x._vis = k;
              x.set_opacity(k);
            }
          };
          upd(m);
          m.add_updater(upd);
          return m;
        };
        ray_tag_vis(ray_tag);
        const ray_g = VGroup(ray, ray_tag);
        ray_g.name = 'ray';
        const guides = VGroup(
          P.live_curve(() => [[n(), 0], [n(), y()]], { color: c.muted, width: 2, dash: true }, key),
          P.live_curve(() => [[0, y()], [n(), y()]], { color: c.muted, width: 2, dash: true }, key),
        );
        const dot = follow(Circle({ radius: 0.13, color: c.ink, fill_opacity: 1, stroke_width: 0 }), () => P.P(n(), y()));
        const star = VGroup(
          follow(Circle({ radius: 0.07, color: c.good, fill_opacity: 1, stroke_width: 0 }), () => P.P(ns(), YS * ns())),
          live_label(() => 'N*', 24, c.good, (t) => t.move_to([P.X(ns()), P.box.y0 - 0.14 - t.height / 2, 0])),
        );
        const point = VGroup(guides, dot, star);
        point.name = 'point';
        // where the population is heading: an arrow along the axis toward N*
        const AY = P.box.y0 + 0.28;
        const dir = () => Math.sign(ns() - n()) * (Math.abs(ns() - n()) > 0.05 ? 1 : 0);
        const shaft = live_vm(stroke(c.coral, 5), () => (dir() ? poly_points([[P.X(n()), AY], [P.X(ns()) - dir() * 0.2, AY]]) : new Float64Array(0)), key);
        const head = live_fill(() => (dir() ? [[P.X(ns()), AY], [P.X(ns()) - dir() * 0.26, AY + 0.13], [P.X(ns()) - dir() * 0.26, AY - 0.13]] : []), c.coral, 1, key);
        const tint = (m: any, col: () => string) => {
          const upd = (x: any) => {
            const k = col();
            if (x._col !== k) {
              x._col = k;
              x.set_stroke?.({ color: k });
              x.set_fill?.({ color: k });
            }
          };
          upd(m);
          m.add_updater(upd);
          return m;
        };
        const arrow_col = () => (dir() < 0 ? c.coral : c.good);
        const drift = VGroup(tint(shaft, arrow_col), tint(head, arrow_col));
        drift.name = 'drift';

        // in words
        const X0 = 1.95;
        const row = (yy: number, f: () => string, col: string | (() => string)) => live_label(f, 26, col, (t) => t.move_to([X0 + t.width / 2, yy, 0]), { max_width: 4.9 });
        const state = () => (dir() < 0 ? 'below' : dir() > 0 ? 'above' : 'at');
        const readout = VGroup(
          row(2.9, () => `${L('income per person', '人均收入')} Y/N = ${num(income(), 2)}`, c.gold),
          row(2.35, () => `${L('subsistence', '生存收入')} y* = ${num(YS, 2)}`, c.good),
          row(1.55, () => ({ below: L('below subsistence: deaths > births', '低于生存水平：死亡多于出生'), above: L('above subsistence: births > deaths', '高于生存水平：出生多于死亡'), at: L('at subsistence: births = deaths', '正好生存水平：出生 = 死亡') })[state()], () => (state() === 'below' ? c.coral : state() === 'above' ? c.good : c.ink)),
          row(1.0, () => ({ below: L(`N falls back to N* = ${num(ns())}`, `N 回落到 N* = ${num(ns())}`), above: L(`N grows to N* = ${num(ns())}`, `N 增长到 N* = ${num(ns())}`), at: L(`N stays at N* = ${num(ns())}`, `N 停在 N* = ${num(ns())}`) })[state()], c.ink),
        );
        readout.name = 'readout';
        this.slider = new StepSlider(A, { lo: 0.8, hi: 1.4, step: 0.05, x0: X0 + 2.2, x1: 6.6, y: -2.3, color: c.accent });
        const a_tag = live_label(() => `${L('technology', '技术')} A = ${num(a(), 2)}`, 26, c.accent, (t) => t.move_to([X0 + t.width / 2, -1.75, 0]));
        const technology = VGroup(this.slider.group, a_tag);
        technology.name = 'technology';

        const tween = (t: ValueTracker, to: number, run_time: number) => {
          const from = t.get_value();
          this.play(UpdateFromAlphaFunc(t, (_m: unknown, u?: number) => t.set_value(from + (to - from) * (u ?? 1))), { run_time, rate_func: smooth });
        };
        this.play(FadeIn(P.group), Create(ray0), { run_time: 1.2 });
        // (live parts are added, not faded: a fade copies them and they change underneath)
        this.add(production, point, ray_g, drift);
        this.play(FadeIn(ray0_tag), { run_time: 0.5 });
        this.add(readout.update(0));
        this.wait(0.8);
        if (p.story !== 'technology') {
          tween(N, 7.5, 0.8); // a wave of immigrants
          this.wait(1);
          tween(N, 4, 3); // deaths exceed births until income per person is back at y*
          this.wait(0.6);
        }
        this.play(FadeIn(this.slider.group), { run_time: 0.5 });
        this.add(a_tag.update(0));
        if (p.story !== 'immigration') {
          tween(A, 1.25, 1.2); // a better plough: the curve rises, income per person above y*
          this.wait(0.6);
          tween(N, n_star(1.25), 2.6); // births exceed deaths until it is back at y*: more people, same income
        }
        this.add(production, subsistence, point, ray_g, drift, readout, technology);
        this.wait(1.6);
      }
    }
    return new Malthus();
  },
  explore: (scene: any, ui, p) => {
    const L = (en: string, zh: string) => pick(resolve_lang(p.lang), en, zh);
    const P: Plot = scene.plot;
    const report = () => {
      const A = scene.A.get_value(), N = scene.N.get_value();
      return { A, N, income: output(A, N) / N, n_star: n_star(A) };
    };
    const n_of = (x: number) => clamp(Math.round(P.data([x, 0])[0] * 4) / 4, 0.5, 10);
    ui.add_handle({
      get: (): P3 => P.P(scene.N.get_value(), output(scene.A.get_value(), scene.N.get_value())),
      set: (pt: P3) => scene.N.set_value(n_of(pt[0])),
      constraint: (pt: P3): P3 => {
        const N = n_of(pt[0]);
        return P.P(N, output(scene.A.get_value(), N));
      },
      step: P.X(0.25) - P.X(0),
      radius: 0.38,
      label: L('the population', '人口'),
      on_end: () => emit(scene, 'malthus', report()),
    });
    scene.slider.attach(ui as any, L('technology A', '技术 A'), { on_end: () => emit(scene, 'malthus', report()) });
  },
});
