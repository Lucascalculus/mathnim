// M1's world: how far ahead must the plan look? The cart docks against the
// wall with a horizon-N MPC (dock.ts). The learner moves the cause, the
// look-ahead N (and, second, the brakes), and sees the whole closed-loop run:
//   - top: position p(t), solid, against the wall band;
//   - below: the applied accelerations a(t), solid stairs, with the limits shaded;
//   - dashed in both, inside the shaded window: the plan the controller made
//     at the last moment it could still stop (or when it began braking, if earlier).
// A window shorter than the stop lets that plan stay off the wall by braking
// gently (or not at all) and arriving at the wall still moving as the window
// ends: the crash lies beyond the plan's end. Simulation of the course's toy model.
import { Create, FadeIn, Scene, VGroup, ValueTracker } from 'manim-web';
import { palette } from '../theme';
import { define_visual } from '../visual';
import { CART } from './math';
import { dock_run, plan_end, shown_instant, type DockRun } from './dock';
import { Choice, LANG_SPEC, Plot, StepSlider, emit, fill_box, listen, live_label, pick, polyline, resolve_lang, visible_when, words, type Listener, type XY } from './kit';

export interface DockHorizonParams extends Record<string, unknown> {
  N: number;
  brakes: string;
  lang: string;
}

/** The labels of the world's two controls (the lesson's `cue` names them the same way). */
export const DOCK_LABELS = {
  N: { en: 'look-ahead N (steps of 0.1 s)', zh: '预测时域 N（每步 0.1 秒）' },
  brakes: { en: 'brakes: largest deceleration', zh: '刹车：最大减速度' },
};
/** Runs are 10 s long (the plot's width); every run here ends (hits or docks) before that. */
const STEPS = 100;
const N_MIN = 2, N_MAX = 45;

/** Everything the world shows for one (N, a_max): the run, the plan it shows and what that plan says. */
export interface DockView {
  N: number;
  a: number;
  run: DockRun;
  /** Instant of the shown plan and why that one. */
  k: number;
  why: 'last-moment' | 'began-braking';
  /** The shown plan's first step (applied at instant k), its end state and the room left there. */
  u0: number;
  end: ReturnType<typeof plan_end>;
  /** Where the run ends (crash, docking or the plot's end), as an instant. */
  end_k: number;
}
const views = new Map<string, DockView>();
export function dock_view(N: number, a: number): DockView {
  const key = `${N}|${a}`;
  const hit = views.get(key);
  if (hit) return hit;
  const o = { a_max: a, steps: STEPS };
  const run = dock_run(N, o);
  const s = shown_instant(run, o);
  const pl = s.k >= 0 ? run.plans[s.k] : null;
  const end_k = run.crash_k >= 0 ? run.crash_k : run.docked_k >= 0 ? run.docked_k : STEPS;
  const v: DockView = { N, a, run, k: s.k, why: s.why, u0: pl ? pl.U[0][0] : 0, end: s.k >= 0 ? plan_end(run, s.k, o) : null, end_k };
  views.set(key, v);
  return v;
}

export const mpc_dock_horizon = define_visual<DockHorizonParams>({
  name: 'mpc_dock_horizon',
  summary: 'World: the docking cart (simulation) with a horizon-N MPC. Top: position against time with the wall; below: the accelerations with the limits. Dashed in a shaded window: the plan made at the last moment the cart could still stop, with its first step and where it ends. Short windows brake gently or not at all and hit the wall; N ≥ 19 (1.9 s) docks with brakes of 1 m/s², N ≥ 40 with 0.5 m/s². Student drags N and switches the brakes.',
  topics: ['mpc', 'model predictive control', 'horizon', 'receding horizon', 'constraints', 'control'],
  params: {
    N: { type: 'integer', min: N_MIN, max: N_MAX, default: 10, doc: 'look-ahead in steps of 0.1 s (2–45); with brakes 1 the shortest that docks is 19, with brakes 0.5 it is 40' },
    brakes: { type: 'enum', values: ['1', '0.5'], default: '1', doc: "largest deceleration in m/s²: '1' (the course cart) or '0.5' (half as strong)" },
    lang: LANG_SPEC,
  },
  examples: [{}, { lang: 'zh' }, { N: 19 }, { N: 40, brakes: '0.5', lang: 'zh' }, { N: 30, brakes: '0.5' }, { N: 2, lang: 'zh' }, { N: 45 }],
  ids: ['plot_p', 'plot_a', 'wall_band', 'limits', 'window', 'past_p', 'past_a', 'plan_p', 'plan_a', 'first_step', 'start_dot', 'end_dot', 'legend', 'readout', 'outcome', 'note', 'slider', 'brakes'],
  scene: (p) => {
    const lang = resolve_lang(p.lang);
    const L = (en: string, zh: string) => pick(lang, en, zh);
    const dt = CART.dt;
    class DockHorizon extends Scene {
      N = ValueTracker(p.N);
      a = ValueTracker(p.brakes === '0.5' ? 0.5 : 1);
      slider!: StepSlider;
      choice!: Choice;
      view = (): DockView => dock_view(Math.round(this.N.get_value()), this.a.get_value() < 0.75 ? 0.5 : 1);
      /** What the learner's current setting does (for the lesson's goals and detectors). */
      result(): { N: number; a: number; crashed: boolean; impact: number; docked_t: number } {
        const v = this.view();
        return { N: v.N, a: v.a, crashed: v.run.crash_k >= 0, impact: v.run.impact, docked_t: v.run.docked_k >= 0 ? v.run.docked_k * dt : -1 };
      }
      listen(f: Listener): void {
        listen(this, f);
      }
      override construct() {
        const c = palette();
        this.track(this.N, this.a);
        const key = () => `${Math.round(this.N.get_value())}|${this.a.get_value()}`;
        const V = this.view;

        // ---- the two panels share the time axis
        const box_p = { x0: -5.6, x1: 2.5, y0: 0.3, y1: 2.95 }, box_a = { x0: -5.6, x1: 2.5, y0: -1.95, y1: -0.45 };
        const P = new Plot({ box: box_p, x: [0, 10], y: [0, 11.5], y_ticks: [0, 5, 10], y_label: { tex: 'p\\;(\\mathrm{m})' } });
        const A = new Plot({ box: box_a, x: [0, 10], y: [-1.2, 1.2], y_ticks: [-1, 0, 1], x_ticks: [0, 2, 4, 6, 8, 10], x_label: { tex: 't\\;(\\mathrm{s})' }, y_label: { tex: 'a\\;(\\mathrm{m/s^2})' }, zero_axis: false });
        P.group.name = 'plot_p';
        A.group.name = 'plot_a';
        const wall_band = VGroup(P.band(CART.p_max, 11.5, c.coral, 0.14), P.note(L('wall', '墙'), 9.9, 10.75, c.coral, 20, 'right'));
        wall_band.name = 'wall_band';
        // the acceleration limits: beyond ±a_max is shaded (two versions, one shown per brakes setting)
        const lim = (a: number) => VGroup(A.band(a, 1.2, c.coral, 0.12), A.band(-1.2, -a, c.coral, 0.12));
        const limits = VGroup(visible_when(lim(1), () => this.a.get_value() >= 0.75, 0.12), visible_when(lim(0.5), () => this.a.get_value() < 0.75, 0.12));
        limits.name = 'limits';

        // ---- the window of the shown plan, in both panels
        const t_k = () => Math.max(0, V().k) * dt;
        const window = VGroup(P.vband(t_k, () => t_k() + V().N * dt, c.accent, 0.08), A.vband(t_k, () => t_k() + V().N * dt, c.accent, 0.08));
        window.name = 'window';

        // ---- what happened: solid
        const past_pts = (): XY[] => {
          const v = V();
          return v.run.x.slice(0, v.end_k + 1).map((x, j) => [j * dt, x[0]] as XY);
        };
        const past_p = P.live_curve(past_pts, { color: c.accent, width: 5 }, key);
        past_p.name = 'past_p';
        const past_a = A.live_stairs(() => {
          const v = V();
          return v.run.u.slice(0, v.end_k).map((u, j) => [j * dt, u] as XY);
        }, { color: c.accent, width: 4 }, key);
        past_a.name = 'past_a';

        // ---- the shown plan: dashed
        const plan = () => {
          const v = V();
          return v.k >= 0 ? v.run.plans[v.k] : null;
        };
        const plan_p = P.live_curve(() => {
          const pl = plan(), k = V().k;
          return pl ? pl.X.map((x, j) => [(k + j) * dt, x[0]] as XY) : [];
        }, { color: c.accent, width: 4, dash: [0.13, 0.09] }, key);
        plan_p.name = 'plan_p';
        const plan_a = A.live_stairs(() => {
          const pl = plan(), k = V().k;
          return pl ? pl.U.map((u, j) => [(k + j) * dt, u[0]] as XY) : [];
        }, { color: c.accent, width: 3.5, dash: [0.1, 0.07] }, key);
        plan_a.name = 'plan_a';
        // the plan's first step, the one applied now: outlined
        const first = fill_box(0, 0, 0.1, 0.1, c.accent, 0, { stroke: c.ink, width: 3 });
        first.add_updater((m: any) => {
          const k = key();
          if (m._key === k) return;
          m._key = k;
          const v = V(), x0 = A.X(t_k()), x1 = A.X(t_k() + dt), y0 = A.Y(Math.min(0, v.u0)), y1 = A.Y(Math.max(0, v.u0));
          m.set_points_as_corners([[x0 - 0.03, y0 - 0.04, 0], [x1 + 0.03, y0 - 0.04, 0], [x1 + 0.03, y1 + 0.04, 0], [x0 - 0.03, y1 + 0.04, 0], [x0 - 0.03, y0 - 0.04, 0]]);
        });
        first.name = 'first_step';
        const start_dot = P.live_dot(() => (V().k >= 0 ? [t_k(), V().run.x[V().k][0]] : null), c.ink, 0.075);
        start_dot.name = 'start_dot';
        // where the run ends: coral where it hit the wall, green where it came to rest
        const end_at = (crashed: boolean) => () => {
          const v = V();
          return v.end_k < STEPS && (v.run.crash_k >= 0) === crashed ? ([v.end_k * dt, v.run.x[v.end_k][0]] as XY) : null;
        };
        const end_dot = VGroup(P.live_dot(end_at(true), c.coral, 0.1), P.live_dot(end_at(false), c.good, 0.1));
        end_dot.name = 'end_dot';

        // ---- the right column: outcome, legend, what the plan says
        const RX = 3.0;
        const outcome = live_label(() => {
          const v = V();
          return v.run.crash_k >= 0 ? L(`hits the wall at ${v.run.impact.toFixed(2)} m/s`, `以 ${v.run.impact.toFixed(2)} m/s 撞墙`) : L(`docks at t = ${(v.run.docked_k * dt).toFixed(1)} s`, `t = ${(v.run.docked_k * dt).toFixed(1)} s 时停稳`);
        }, 28, () => (V().run.crash_k >= 0 ? c.coral : c.good), (m) => m.move_to([RX + m.width / 2, 2.75, 0]), { max_width: 3.6 });
        outcome.name = 'outcome';
        const sample = (y: number, dash: boolean) => polyline([[RX, y], [RX + 0.5, y]], c.accent, dash ? 4 : 5, dash ? { dash: [0.13, 0.09] } : {});
        const legend = VGroup(
          sample(2.1, false), words(L('what the cart did', '小车实际的运动'), 22, c.ink, RX + 0.65, 2.1, { max_w: 2.95 }),
          sample(1.6, true),
          live_label(() => L(`its plan at t = ${t_k().toFixed(1)} s`, `t = ${t_k().toFixed(1)} s 时它做的计划`), 22, c.ink, (m) => m.move_to([RX + 0.65 + m.width / 2, 1.6, 0])),
          live_label(() => (V().why === 'last-moment' ? L('(last chance to stop in time)', '（还来得及刹停的最后时刻）') : L('(when it began to brake)', '（它开始刹车的时刻）')), 20, c.muted, (m) => m.move_to([RX + 0.65 + m.width / 2, 1.22, 0]), { max_width: 3.2 }),
        );
        legend.name = 'legend';
        const a_txt = (a: number) => (a === 1 ? '1' : '0.5');
        const readout = VGroup(
          words(L('what that plan says:', '这个计划说：'), 22, c.muted, RX, 0.55),
          live_label(() => {
            const v = V(), b = -v.u0;
            if (b < 0.005) return L('first step: no braking', '第一步：不刹车');
            if (b >= v.a - 0.005) return L(`first step: full brakes, ${a_txt(v.a)} m/s²`, `第一步：全力刹车 ${a_txt(v.a)} m/s²`);
            return L(`first step: brake ${b.toFixed(2)} of ${a_txt(v.a)} m/s²`, `第一步：刹车 ${b.toFixed(2)}（最大 ${a_txt(v.a)}）`);
          }, 22, () => (-V().u0 >= V().a - 0.005 ? c.good : c.ink), (m) => m.move_to([RX + m.width / 2, 0.05, 0]), { max_width: 3.85 }),
          live_label(() => {
            const e = V().end;
            if (!e) return '';
            if (e.at_rest) return L('its end: at rest', '结尾：停住了');
            if (e.room < 1e-3) return L(`its end: at the wall, ${e.v.toFixed(2)} m/s`, `结尾：到墙边，还有 ${e.v.toFixed(2)} m/s`);
            return L(`its end: ${e.room.toFixed(2)} m short, ${e.v.toFixed(2)} m/s`, `结尾：离墙 ${e.room.toFixed(2)} m，${e.v.toFixed(2)} m/s`);
          }, 22, () => (V().end?.at_rest ? c.good : V().run.crash_k >= 0 ? c.coral : c.ink), (m) => m.move_to([RX + m.width / 2, -0.4, 0]), { max_width: 3.85 }),
        );
        readout.name = 'readout';

        // ---- the honest label and the controls
        const note = live_label(() => L(`simulation of a toy cart: |v| up to 2 m/s, brakes up to ${a_txt(this.a.get_value() < 0.75 ? 0.5 : 1)} m/s²`, `玩具小车的模拟：|v| 不超过 2 m/s，刹车不超过 ${a_txt(this.a.get_value() < 0.75 ? 0.5 : 1)} m/s²`), 20, c.muted, (m) => m.move_to([-6.9 + m.width / 2, 3.6, 0]));
        note.name = 'note';
        const slider = new StepSlider(this.N, { lo: N_MIN, hi: N_MAX, step: 1, x0: -5.4, x1: 2.3, y: -3.4, ticks: [10, 20, 30, 40] });
        this.slider = slider;
        const n_caption = live_label(() => {
          const N = Math.round(this.N.get_value());
          return L(`look-ahead N = ${N} steps = ${(N * dt).toFixed(1)} s`, `预测时域 N = ${N} 步 = ${(N * dt).toFixed(1)} 秒`);
        }, 24, c.ink, (m) => m.move_to([-5.6 + m.width / 2, -2.85, 0]));
        const s_group = VGroup(slider.group, n_caption);
        s_group.name = 'slider';
        const choice = new Choice({ tracker: this.a, values: [1, 0.5], labels: ['1 m/s²', '0.5 m/s²'], x0: RX, x1: 6.85, y: -3.4 });
        this.choice = choice;
        const b_group = VGroup(choice, words(L('brakes (largest deceleration)', '刹车（最大减速度）'), 22, c.muted, RX, -2.85, { max_w: 3.55 }));
        b_group.name = 'brakes';

        // ---- the story: the run, then the plan that decided it
        this.add(limits);
        this.play(FadeIn(P.group), FadeIn(A.group), FadeIn(wall_band), FadeIn(note), FadeIn(s_group), FadeIn(b_group), { run_time: 1.1 });
        this.play(Create(past_p), Create(past_a), { run_time: 2 });
        this.add(end_dot);
        this.play(FadeIn(outcome), { run_time: 0.6 });
        this.play(FadeIn(window), FadeIn(start_dot), Create(plan_p), Create(plan_a), { run_time: 1.6 });
        this.play(FadeIn(first), FadeIn(legend), FadeIn(readout), { run_time: 1 });
        this.wait(1.8);
      }
    }
    return new DockHorizon();
  },
  explore: (scene: any, ui, p) => {
    const lang = resolve_lang(p.lang);
    const released = () => emit(scene, 'released', scene.result());
    scene.slider.attach(ui, pick(lang, DOCK_LABELS.N.en, DOCK_LABELS.N.zh), { on_end: released });
    scene.choice.attach(ui, pick(lang, DOCK_LABELS.brakes.en, DOCK_LABELS.brakes.zh), () => released());
  },
});
