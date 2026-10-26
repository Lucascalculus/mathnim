// M2: the cart's prediction is linear in the planned inputs. The cart is 30 cm
// before the wall, coasting at 0.5 m/s. Ten bars are the planned accelerations
// u_0..u_9 (0.1 s each, held: zero-order hold); below them the predicted speed
// (a running sum of the bars) and position (a running sum of the speeds), each
// with the free response Φx_0 (every u = 0) dashed. The numbers under the bars
// are the position row of Γ (u_j's weight in p_10, in units of Δt²); on the
// right, the two end-of-horizon formulas with live values and the two goals
// (at rest at k = 10; at the wall, never past it). Simulation of the course's toy cart.
// Story 'still': the plan appears. 'early_late': five bars of −1 at the start,
// then the same five at the end (the early run stays as a faint copy): the same
// final speed, a different final position. Explore: drag any bar (snaps to 0.1).
import { FadeIn, Scene, UpdateFromAlphaFunc, VGroup, VMobject, ValueTracker, smooth } from 'manim-web';
import type { Mobject } from 'manim-web';
import { palette } from '../theme';
import { define_visual } from '../visual';
import { BARS, DOCK_PLAN, bars_status, end_state, free_response, path, predict, snap_u, type BarsStatus } from './bars_math';
import { LANG_SPEC, Plot, clamp, emit, fit, hatch, listen, live_label, pick, resolve_lang, tex, words, type Listener, type P3, type XY } from './kit';

export interface BarsParams extends Record<string, unknown> {
  plan: string;
  story: string;
  lang: string;
}

const N = BARS.N;
const PLANS: Record<string, readonly number[]> = {
  zero: new Array(N).fill(0),
  dock: DOCK_PLAN,
  early: [-1, -1, -1, -1, -1, 0, 0, 0, 0, 0],
  late: [0, 0, 0, 0, 0, -1, -1, -1, -1, -1],
  even: new Array(N).fill(-0.5),
};
const BX0 = -5.95, BX1 = 2.2; // the three panels
const RX0 = 3.35, RX1 = 6.95; // the formulas
const A_BOX = { x0: BX0, x1: BX1, y0: 1.7, y1: 2.95 };
const V_BOX = { x0: BX0, x1: BX1, y0: -0.6, y1: 0.7 };
const P_BOX = { x0: BX0, x1: BX1, y0: -2.95, y1: -1.3 };
const W_ROW = 1.33; // the weights under the bars

const fmt = (v: number, d: number) => (Math.abs(v) < 0.5 * 10 ** -d ? 0 : v).toFixed(d).replace('-', '−');

export const mpc_bars = define_visual<BarsParams>({
  name: 'mpc_bars',
  summary: 'The prediction X = Φx₀ + ΓU of the course’s toy cart (simulation): 10 bars of planned acceleration u_0..u_9 (0.1 s each, held), the predicted speed (running sum) and position (running sum of speeds) with the free response Φx₀ dashed, the weights 9.5..0.5 of each bar in p_10 (the position row of Γ), live v_10 = 0.5 + 0.1Σu and p_10 = 10.2 + 0.01Σ(9.5 − j)u_j, and two goals: at rest at k = 10, at the wall (10 m) and never past it. Start 9.7 m, 0.5 m/s. Student drags the bars.',
  topics: ['mpc', 'prediction', 'state space', 'discretization', 'zero-order hold', 'linear', 'double integrator'],
  params: {
    plan: { type: 'enum', values: ['zero', 'dock', 'early', 'late', 'even'], default: 'zero', doc: "the bars at the start: 'zero' coast, 'dock' a plan that docks, 'early'/'late' five bars of −1 at the start/end, 'even' −0.5 on every bar" },
    story: { type: 'enum', values: ['still', 'early_late'], default: 'still', doc: "'still': show the plan; 'early_late': brake −1 on the first five bars, then move the same braking to the last five (the early run stays faint)" },
    lang: LANG_SPEC,
  },
  examples: [{}, { lang: 'zh' }, { plan: 'dock' }, { plan: 'dock', lang: 'zh' }, { story: 'early_late' }, { story: 'early_late', lang: 'zh' }, { plan: 'even', lang: 'zh' }, { plan: 'late' }],
  ids: ['note', 'a_plot', 'bars', 'weights', 'v_plot', 'v_free', 'v_curve', 'p_plot', 'wall', 'p_free', 'p_curve', 'p_flag', 'model', 'v_formula', 'v_value', 'p_formula', 'p_value', 'goals', 'legend'],
  scene: (p) => {
    const lang = resolve_lang(p.lang);
    const L = (en: string, zh: string) => pick(lang, en, zh);
    class Bars extends Scene {
      /** The planned accelerations u_0..u_9 [m/s²] (on the 0.1 grid). */
      u: ValueTracker[] = (PLANS[p.plan] ?? PLANS.zero).map((v) => ValueTracker(v));
      ap!: Plot;
      plan(): number[] {
        return this.u.map((t) => t.get_value());
      }
      status(): BarsStatus {
        return bars_status(this.plan());
      }
      /** Set the plan (snapped). */
      set_plan(U: readonly number[]): void {
        U.forEach((v, j) => this.u[j].set_value(snap_u(v)));
      }
      /** Subscribe: f('bars', { j, sum, wsum, v_end, p_end, at_rest, past_k, docked, short_by }) when a bar is released. */
      listen(f: Listener): void {
        listen(this, f);
      }
      report(j: number): Record<string, unknown> {
        const U = this.plan(), s = bars_status(U), e = end_state(U);
        return { j, sum: +e.sum.toFixed(6), wsum: +e.wsum.toFixed(6), v_end: s.v_end, p_end: s.p_end, at_rest: s.at_rest, past_k: s.past_k, docked: s.docked, short_by: s.short_by };
      }
      override construct() {
        const c = palette();
        this.track(...this.u);
        const key = () => this.plan().map((v) => v.toFixed(4)).join(',');
        const pr = () => predict(this.plan());
        const pth = () => path(this.plan());
        const st = () => this.status();

        const note = words(L('simulation of a toy cart: |a| up to 1 m/s², each bar held for 0.1 s', '玩具小车的模拟：|a| 不超过 1 m/s²，每根柱子保持 0.1 秒'), 20, c.muted, -6.9, 3.68, { max_w: 9.6 });
        note.name = 'note';

        // ---- a: the bars
        const ap = new Plot({ box: A_BOX, x: [0, N], y: [-1.15, 1.15], y_ticks: [-1, 0, 1], y_label: { tex: 'a_k = u_k\\;(\\mathrm{m/s^2})' }, font: 22 });
        this.ap = ap;
        ap.group.name = 'a_plot';
        const bars = VGroup();
        for (let j = 0; j < N; j++) {
          const x0 = ap.X(j) + 0.07, x1 = ap.X(j + 1) - 0.07;
          bars.add(this.bar_rect(x0, x1, () => this.u[j].get_value(), c));
        }
        bars.name = 'bars';
        const weights = VGroup(...Array.from({ length: N }, (_, j) => {
          const m = tex(String(N - j - 0.5), 22, c.muted);
          m.move_to([ap.X(j + 0.5), W_ROW, 0]);
          return m as Mobject;
        }));
        const w_label = tex('\\times\\,\\Delta t^2', 22, c.muted);
        w_label.move_to([BX1 + 0.12 + w_label.width / 2, W_ROW, 0]);
        weights.add(w_label);
        weights.name = 'weights';

        // ---- v: the running sum
        const vp = new Plot({ box: V_BOX, x: [0, N], y: [-0.6, 1.1], y_ticks: [0, 0.5, 1], y_label: { tex: 'v_k\\;(\\mathrm{m/s})' }, font: 22 });
        vp.group.name = 'v_plot';
        const zero_v = vp.hline(0, c.muted, { width: 1.5, dash: false });
        vp.group.add(zero_v);
        const free = free_response();
        const v_free = vp.curve(free.v.map((v, k) => [k, v] as XY), { color: c.muted, width: 3, dash: true });
        v_free.name = 'v_free';
        const v_line = vp.live_curve(() => pth().map(([k, , v]) => [k, v] as XY), { color: c.teal, width: 4.5 }, key);
        const v_dots = this.dots(vp, () => pr().v, c.teal);
        const v_curve = VGroup(v_line, v_dots);
        v_curve.name = 'v_curve';

        // ---- p: the running sum of the speeds, the wall
        const pp = new Plot({ box: P_BOX, x: [0, N], y: [9.6, 10.5], y_ticks: [9.7, 10], x_ticks: [0, 2, 4, 6, 8, 10], x_label: { tex: 'k\\;(\\times\\,0.1\\,\\mathrm{s})' }, y_label: { tex: 'p_k\\;(\\mathrm{m})' }, font: 22 });
        pp.group.name = 'p_plot';
        const wall_y = pp.Y(BARS.wall);
        const wall = VGroup(pp.band(BARS.wall, 10.5, c.muted, 0.12), hatch({ x0: BX0, x1: BX1, y0: wall_y, y1: P_BOX.y1 }, c.faint, 0.22, 2), pp.hline(BARS.wall, c.ink, { width: 2.5, dash: false }),
          pp.note(L('wall', '墙'), 10.08, 10.38, c.ink, 20, 'left'));
        wall.name = 'wall';
        const p_free = pp.curve(free.p.map((v, k) => [k, v] as XY), { color: c.muted, width: 3, dash: true });
        p_free.name = 'p_free';
        const p_line = pp.live_curve(() => pth().map(([k, q]) => [k, q] as XY), { color: c.accent, width: 4.5 }, key);
        const p_dots = this.dots(pp, () => pr().p, c.accent, (q) => (q > BARS.wall + 0.01 ? c.coral : c.accent));
        const p_curve = VGroup(p_line, p_dots);
        p_curve.name = 'p_curve';
        // what the end looks like: past the wall, or short of it
        const p_flag = live_label(() => {
          const s = st();
          if (s.past_k > 0) return L(`past the wall from k = ${s.past_k}`, `从 k = ${s.past_k} 起穿过了墙`);
          if (s.at_rest && s.short_by > 0) return L(`stops ${(100 * s.short_by).toFixed(1)} cm short`, `离墙还差 ${(100 * s.short_by).toFixed(1)} cm 就停了`);
          return '';
        }, 20, () => (st().past_k > 0 ? c.coral : c.ink), (m) => m.move_to([BX1 - m.width / 2, P_BOX.y1 + 0.22, 0]));
        p_flag.name = 'p_flag';

        // ---- right: the formulas and the goals
        const W = RX1 - RX0;
        const model = fit(tex('X = \\Phi\\, x_0 + \\Gamma\\, U', 38, c.ink) as any, W);
        model.move_to([RX0 + model.width / 2, 3.2, 0]);
        model.name = 'model';
        const v_formula = fit(tex('v_{10} = 0.5 + 0.1 \\textstyle\\sum_j u_j', 32, c.teal) as any, W);
        v_formula.move_to([RX0 + v_formula.width / 2, 2.55, 0]);
        v_formula.name = 'v_formula';
        /** A TeX name and its live value, left edge at x. */
        const pair = (lhs: string, value: () => string, x: number, y: number, color: string) => {
          const l = tex(lhs, 28, c.muted);
          l.move_to([x + l.width / 2, y, 0]);
          const r = live_label(value, 24, color, (m) => m.move_to([x + l.width + 0.1 + m.width / 2, y, 0]));
          return VGroup(l, r);
        };
        const v_value = VGroup(
          pair('\\textstyle\\sum u_j', () => `= ${fmt(end_state(this.plan()).sum, 1)}`, RX0 + 0.1, 2.05, c.ink),
          pair('v_{10}', () => `= ${fmt(pr().v[N], 2)} m/s`, RX0 + 0.1, 1.6, c.teal),
        );
        v_value.name = 'v_value';
        const p_formula = fit(tex('p_{10} = 10.2 + 0.01 \\textstyle\\sum_j (9.5 - j)\\, u_j', 32, c.accent) as any, W);
        p_formula.move_to([RX0 + p_formula.width / 2, 1.0, 0]);
        p_formula.name = 'p_formula';
        const p_value = VGroup(
          pair('\\textstyle\\sum (9.5-j)\\,u_j', () => `= ${fmt(end_state(this.plan()).wsum, 2)}`, RX0 + 0.1, 0.5, c.ink),
          pair('p_{10}', () => `= ${fmt(pr().p[N], 3)} m`, RX0 + 0.1, 0.05, c.accent),
        );
        p_value.name = 'p_value';
        const goal = (y: number, en: string, zh: string, met: () => boolean) => {
          const t = words(L(en, zh), 22, c.ink, RX0 + 1.15, y, { max_w: RX1 - RX0 - 1.15 });
          const s = live_label(() => (met() ? L('met', '达成') : L('not yet', '未达成')), 22, () => (met() ? c.good : c.muted), (m) => m.move_to([RX0 + 0.1 + m.width / 2, y, 0]), { weight: 'BOLD' });
          return VGroup(t, s);
        };
        const goals = VGroup(
          words(L('goals', '目标'), 22, c.muted, RX0, -0.65),
          goal(-1.05, 'at rest at k = 10', 'k = 10 时停住', () => st().at_rest),
          goal(-1.45, 'at the wall, not past it', '停在墙边，不穿墙', () => st().docked),
        );
        goals.name = 'goals';
        const legend = VGroup(
          words(L('dashed: every u = 0 (coasting)', '虚线：所有 u = 0（一直滑行）'), 20, c.muted, RX0, -2.25, { max_w: W }),
          words(L('grey numbers under the bars:', '柱子下的灰色数字：'), 20, c.muted, RX0, -2.65, { max_w: W }),
          words(L('their weight in p at k = 10', '各自在 k = 10 时位置里的权重'), 20, c.muted, RX0, -3.0, { max_w: W }),
        );
        legend.name = 'legend';

        // ---- the story
        this.play(FadeIn(note), FadeIn(ap.group), FadeIn(vp.group), FadeIn(pp.group), FadeIn(wall), FadeIn(v_free), FadeIn(p_free), FadeIn(model), { run_time: 1 });
        this.play(FadeIn(bars), FadeIn(weights), FadeIn(v_curve), FadeIn(p_curve), FadeIn(v_formula), FadeIn(v_value), FadeIn(p_formula), FadeIn(p_value), FadeIn(goals), FadeIn(legend), { run_time: 1 });
        this.add(p_flag);
        if (p.story === 'early_late') {
          const morph = (to: readonly number[], run_time: number) => {
            const from = this.plan();
            this.play(UpdateFromAlphaFunc(this.u[0], (_m: unknown, a?: number) => {
              const s = a ?? 1;
              this.u.forEach((t, j) => t.set_value(from[j] + (to[j] - from[j]) * s));
            }, { run_time, rate_func: smooth }));
            this.set_plan(to);
          };
          this.wait(1);
          morph(PLANS.early, 2);
          this.wait(2.5);
          // keep the early run as a faint copy, then move the same braking late
          const e = predict(PLANS.early), ep = path(PLANS.early);
          const early_copy = VGroup(
            vp.curve(ep.map(([k, , v]) => [k, v] as XY), { color: c.teal, width: 3, opacity: 0.35 }),
            pp.curve(ep.map(([k, q]) => [k, q] as XY), { color: c.accent, width: 3, opacity: 0.35 }),
            pp.note(L('early', '早踩'), 10.08, e.p[N] - 0.02, c.accent, 20, 'left'),
          );
          early_copy.name = 'early_copy';
          this.play(FadeIn(early_copy), { run_time: 0.6 });
          morph(PLANS.late, 2.5);
          this.wait(1);
          const late_word = pp.note(L('late', '晚踩'), 10.08, predict(PLANS.late).p[N] + 0.06, c.coral, 20, 'left');
          this.play(FadeIn(late_word), { run_time: 0.5 });
          this.wait(3);
        } else {
          this.wait(6);
        }
      }
      /** A bar from 0 to u (coral when braking, purple when pushing), with a cap where the handle is. */
      bar_rect(x0: number, x1: number, u: () => number, c: ReturnType<typeof palette>): Mobject {
        const ap = this.ap;
        const g = VGroup();
        const body = this.live_box(() => [x0, Math.min(ap.Y(0), ap.Y(u())), x1, Math.max(ap.Y(0), ap.Y(u()))], () => (u() < -1e-9 ? c.coral : c.purple), 0.55);
        const cap = this.live_box(() => [x0, ap.Y(u()) - 0.035, x1, ap.Y(u()) + 0.035], () => (u() < -1e-9 ? c.coral : Math.abs(u()) < 1e-9 ? c.muted : c.purple), 1);
        g.add(body, cap);
        return g;
      }
      /** A filled box recomputed when its corners change. */
      live_box(f: () => [number, number, number, number], color: () => string, opacity: number): Mobject {
        return make_live_box(f, color, opacity);
      }
      /** Dots at the samples k = 0..N. */
      dots(plot: Plot, vals: () => number[], color: string, col?: (v: number) => string): Mobject {
        const g = VGroup();
        for (let k = 0; k <= N; k++) g.add(plot.live_dot(() => [k, vals()[k]] as XY, col ? undefined : color, 0.065) as Mobject);
        if (col) {
          g.submobjects.forEach((d: any, k: number) => {
            d.add_updater((m: any) => {
              const cc = col(vals()[k]);
              if (m._col === cc) return;
              m._col = cc;
              m.set_fill(cc, 1);
            });
          });
        }
        return g;
      }
    }
    return new Bars();
  },
  explore: (scene: any, ui, p) => {
    const L = (en: string, zh: string) => pick(resolve_lang(p.lang), en, zh);
    const ap: Plot = scene.ap;
    const lo = ap.Y(-BARS.a_max), hi = ap.Y(BARS.a_max);
    for (let j = 0; j < N; j++) {
      const x = ap.X(j + 0.5);
      ui.add_handle({
        get: (): P3 => [x, ap.Y(scene.u[j].get_value()), 0],
        set: (pt: P3) => {
          const v = snap_u(ap.data(pt)[1]);
          if (v !== scene.u[j].get_value()) scene.u[j].set_value(v);
        },
        constraint: (pt: P3): P3 => [x, clamp(pt[1], lo, hi), 0],
        step: (hi - ap.Y(0)) / 10,
        radius: 0.36,
        label: bar_label(j, L),
        on_end: () => emit(scene, 'bars', scene.report(j)),
      } as any);
    }
  },
});

/** The accessible name of bar j (also the lesson's cue). */
export function bar_label(j: number, L: (en: string, zh: string) => string): string {
  return L(`bar u${j}: acceleration from ${(j / 10).toFixed(1)} to ${((j + 1) / 10).toFixed(1)} s`, `柱子 u${j}：${(j / 10).toFixed(1)} 到 ${((j + 1) / 10).toFixed(1)} 秒的加速度`);
}

function make_live_box(f: () => [number, number, number, number], color: () => string, opacity: number): Mobject {
  const vm: any = VMobject({ fill_color: color(), fill_opacity: opacity, stroke_width: 0, stroke_color: color() });
  const upd = (m: any) => {
    const [x0, y0, x1, y1] = f();
    const col = color();
    const k = `${x0.toFixed(4)},${y0.toFixed(4)},${x1.toFixed(4)},${y1.toFixed(4)},${col}`;
    if (m._k === k) return;
    m._k = k;
    const top = Math.max(y1, y0 + 1e-4);
    m.set_points_as_corners([[x0, y0, 0], [x1, y0, 0], [x1, top, 0], [x0, top, 0], [x0, y0, 0]]);
    m.set_fill(col, opacity);
    m.set_stroke(col, 0);
  };
  upd(vm);
  vm.add_updater(upd);
  return vm;
}
