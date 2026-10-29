// M7, estimation (disturbance.ts, story 2): the cart speeds up, cruises and
// slows down, pushed by random unmodelled accelerations, and only its position
// is measured, with noise (5 cm). Left, top: its speed, the speed from
// differencing two noisy measurements, and the Kalman filter's estimate.
// Left, bottom: the position error of each measurement and of the filter.
// Right: one correction step as three bells: the prediction (variance P⁻),
// the measurement (variance V) and their combination, which sits L_p of the
// way from the prediction to the measurement. Simulation of the toy cart; the
// measurement in the bells is an illustrative value.
import { Create, FadeIn, Scene, UpdateFromAlphaFunc, VGroup, ValueTracker, linear } from 'manim-web';
import { palette } from '../theme';
import { define_visual } from '../visual';
import { KALMAN, kalman_run, rms } from './disturbance';
import { LANG_SPEC, Plot, live_vm, pick, polyline, polys_points, resolve_lang, stroke, tex, words, type XY } from './kit';
import { aside } from '../aside';

export interface KalmanViewParams extends Record<string, unknown> {
  lang: string;
}

/** The numbers the scene shows (also used by the lesson text and tested). */
export function kalman_numbers() {
  const k = kalman_run();
  const T = KALMAN.steps;
  return {
    run: k,
    /** RMS speed error of differencing and of the filter [m/s]. */
    v_diff_rms: rms(k.v_diff.map((v, i) => v - k.x[i][1])),
    v_est_rms: rms(k.est.map((e, i) => e[1] - k.x[i][1])),
    /** RMS position error of the raw measurement and of the filter [m]. */
    p_meas_rms: rms(k.y.map((y, i) => y - k.x[i][0])),
    p_est_rms: rms(k.est.map((e, i) => e[0] - k.x[i][0])),
    /** The settled position gain and the settled standard deviations [m]: prediction, measurement, combined. */
    Lp: k.L[T][0],
    s_pred: Math.sqrt(k.var_pred[T]),
    s_meas: KALMAN.sigma_y,
    s_est: Math.sqrt(k.var_est[T]),
  };
}
/** The illustrative measurement in the bells: 6 cm from the prediction. */
export const BELL_Y = 6;

const gauss_pts = (mu: number, s: number, x0: number, x1: number): XY[] => {
  const out: XY[] = [];
  for (let i = 0; i <= 120; i++) {
    const x = x0 + ((x1 - x0) * i) / 120;
    out.push([x, Math.exp(-0.5 * ((x - mu) / s) ** 2) / (s * Math.sqrt(2 * Math.PI))]);
  }
  return out;
};

export const mpc_kalman = define_visual<KalmanViewParams>({
  name: 'mpc_kalman',
  summary: 'Scene (simulation): a Kalman filter on the toy cart measured in position only, with 5 cm noise. Speed from differencing two noisy measurements is useless (RMS about 0.8 m/s); the filter, which predicts with the model and corrects with each measurement, tracks it to about 0.12 m/s. Right: one correction as three bells (prediction, measurement, combined): the estimate moves L_p ≈ 0.29 of the way to the measurement. No handles.',
  topics: ['mpc', 'kalman filter', 'state estimation', 'noise', 'observer', 'control'],
  params: { lang: LANG_SPEC },
  examples: [{}, { lang: 'zh' }],
  ids: ['note', 'v_legend', 'v_plot', 'v_true', 'v_diff', 'v_est', 'p_legend', 'p_plot', 'p_meas', 'p_est', 'steps', 'bells', 'gain', 'scores'],
  scene: (p) => {
    const lang = resolve_lang(p.lang);
    const L = (en: string, zh: string) => pick(lang, en, zh);
    const n = kalman_numbers(), k = n.run, dt = KALMAN.dt, T_END = KALMAN.steps * dt;
    class Kalman extends Scene {
      /** How far the measurements and the filter's estimate have been drawn [s]. */
      t_meas = ValueTracker(T_END);
      t_est = ValueTracker(T_END);
      override construct() {
        const c = palette();
        const { t_meas, t_est } = this;
        this.track(t_meas, t_est);
        const upto = (tr: typeof t_meas) => () => Math.round(Math.min(T_END, tr.get_value()) / dt);
        const shown = upto(t_meas), shown_e = upto(t_est);
        const key = () => `${shown()}`, key_e = () => `${shown_e()}`;

        const note = aside(this, words(L('simulation of a toy cart: random pushes it does not model; only the position is measured, with 5 cm of noise', '玩具小车的模拟：有模型里没有的随机推力；只测位置，噪声 5 cm'), 20, c.muted, -6.9, 3.62, { max_w: 13.8 }));
        note.name = 'note';
        const LX0 = -6.1, LX1 = 1.3;

        // ---- speed
        const leg = (y: number, items: [string, string, boolean][]) => {
          const parts = [];
          let x = LX0 - 0.6;
          for (const [s, col, dashed] of items) {
            parts.push(polyline([[x, y], [x + 0.4, y]], col, 4, dashed ? { dash: [0.08, 0.06] } : {}));
            const w = words(s, 20, col === c.ink ? c.ink : col, x + 0.5, y);
            parts.push(w);
            x += 0.5 + w.width + 0.35;
          }
          return VGroup(...parts);
        };
        const v_title = words(L('speed v (m/s):', '速度 v（m/s）：'), 20, c.ink, LX0 - 0.6, 3.15, { weight: 'BOLD' });
        const v_items = leg(3.15, [[L('true', '真实'), c.ink, false], [L('differencing y', '对 y 差分'), c.coral, false], [L('Kalman', '卡尔曼'), c.accent, false]]);
        v_items.shift([v_title.width + 0.3, 0, 0]);
        const v_legend = VGroup(v_title, v_items);
        v_legend.name = 'v_legend';
        const vp = new Plot({ box: { x0: LX0, x1: LX1, y0: 0.75, y1: 2.75 }, x: [0, T_END], y: [-1, 2.5], y_ticks: [-1, 0, 1, 2], x_ticks: [0, 1, 2, 3, 4, 5, 6], x_label: { tex: 't\\;(\\mathrm{s})' }, font: 20 });
        vp.group.name = 'v_plot';
        const v_true = vp.live_curve(() => k.x.slice(0, shown() + 1).map((x, i) => [i * dt, x[1]] as XY), { color: c.ink, width: 3 }, key);
        v_true.name = 'v_true';
        const v_diff = vp.live_curve(() => k.v_diff.slice(1, shown() + 1).map((v, i) => [(i + 1) * dt, v] as XY), { color: c.coral, width: 2.2, opacity: 0.85 }, key);
        v_diff.name = 'v_diff';
        const v_est = vp.live_curve(() => k.est.slice(0, shown_e() + 1).map((e, i) => [i * dt, e[1]] as XY), { color: c.accent, width: 4.5 }, key_e);
        v_est.name = 'v_est';

        // ---- position error (cm)
        const p_title = words(L('position error (cm):', '位置误差（cm）：'), 20, c.ink, LX0 - 0.6, -0.4, { weight: 'BOLD' });
        const dots_leg = VGroup(
          live_vm(stroke(c.coral, 2.5), () => polys_points([[[0, 0.07], [0.07, 0], [0, -0.07], [-0.07, 0], [0, 0.07]].map(([a, b]) => [a + LX0 - 0.4, b - 0.4] as XY)])),
          words(L('each measurement y', '每次测量 y'), 20, c.coral, LX0 - 0.1, -0.4),
        );
        const p_items = VGroup(dots_leg);
        const est_leg = VGroup(polyline([[0, -0.4], [0.4, -0.4]], c.accent, 4), words(L('Kalman estimate', '卡尔曼估计'), 20, c.accent, 0.5, -0.4));
        est_leg.shift([LX0 - 0.1 + (dots_leg.submobjects[1] as any).width + 0.35, 0, 0]);
        p_items.add(est_leg);
        p_items.shift([p_title.width + 0.3, 0, 0]);
        const p_legend = VGroup(p_title, p_items);
        p_legend.name = 'p_legend';
        const pp = new Plot({ box: { x0: LX0, x1: LX1, y0: -2.75, y1: -0.85 }, x: [0, T_END], y: [-15, 15], y_ticks: [-10, 0, 10], x_ticks: [0, 1, 2, 3, 4, 5, 6], x_label: { tex: 't\\;(\\mathrm{s})' }, font: 20 });
        pp.group.name = 'p_plot';
        const zero = pp.hline(0, c.muted, { width: 2, dash: false });
        const p_meas = live_vm(stroke(c.coral, 2.2), () => polys_points(k.y.slice(0, shown() + 1).map((y, i) => {
          const x = pp.X(i * dt), v = pp.Y(Math.max(-15, Math.min(15, (y - k.x[i][0]) * 100))), r = 0.05;
          return [[x, v + r], [x + r, v], [x, v - r], [x - r, v], [x, v + r]] as XY[];
        })), key);
        p_meas.name = 'p_meas';
        const p_est = pp.live_curve(() => k.est.slice(0, shown_e() + 1).map((e, i) => [i * dt, (e[0] - k.x[i][0]) * 100] as XY), { color: c.accent, width: 4 }, key_e);
        p_est.name = 'p_est';

        // ---- right: the two steps and one correction as bells
        const RX = 2.35, RX1 = 6.9;
        const s1 = words(L('1. predict with the model', '1. 用模型预测'), 22, c.accent, RX, 3.1, { weight: 'BOLD', max_w: RX1 - RX });
        const f1 = tex('\\hat x^-_k = A\\hat x_{k-1} + B u_{k-1}', 26, c.ink);
        f1.move_to([RX + f1.width / 2, 2.62, 0]);
        const s2 = words(L('2. correct with the measurement', '2. 用测量修正'), 22, c.good, RX, 2.1, { weight: 'BOLD', max_w: RX1 - RX });
        const f2 = tex('\\hat x_k = \\hat x^-_k + L\\,(y_k - C\\hat x^-_k)', 26, c.ink);
        f2.move_to([RX + f2.width / 2, 1.62, 0]);
        const steps = VGroup(s1, f1, s2, f2);
        steps.name = 'steps';
        const bp = new Plot({ box: { x0: RX + 0.1, x1: RX1 - 0.1, y0: -1.45, y1: 0.7 }, x: [-12, 19], y: [0, 0.17], x_ticks: [0, BELL_Y], x_fmt: (v) => (v === 0 ? '\\hat p^-' : 'y'), grid: false, font: 22 });
        const sp = n.s_pred * 100, sm = n.s_meas * 100, se = n.s_est * 100, mu = n.Lp * BELL_Y;
        const b_pred = bp.curve(gauss_pts(0, sp, -12, 19), { color: c.accent, width: 4 });
        const b_meas = bp.curve(gauss_pts(BELL_Y, sm, -12, 19), { color: c.coral, width: 4 });
        const b_est = bp.curve(gauss_pts(mu, se, -12, 19), { color: c.good, width: 5 });
        const peak = (s: number) => 1 / (s * Math.sqrt(2 * Math.PI));
        const w_pred = bp.note(L('prediction', '预测'), -3.8, 0.108, c.accent, 18, 'right');
        const w_meas = bp.note(L('measured', '测量'), BELL_Y + 2.8, 0.074, c.coral, 18, 'left');
        const w_est = bp.note(L('combined', '合起来'), mu + 0.4, peak(se) * 1.07, c.good, 20, 'left');
        const mu_line = bp.vline(mu, c.good, { width: 2.5 });
        const bells_title = words(L('one correction, in position (cm):', '一次修正，位置方向（cm）：'), 20, c.muted, RX, 1.0, { max_w: RX1 - RX });
        const bells = VGroup(bells_title, bp.group, b_pred, b_meas, w_pred, w_meas);
        bells.name = 'bells';
        const gain = VGroup(
          tex(`L_p = \\frac{P^-}{P^- + V} \\approx ${n.Lp.toFixed(2)}`, 26, c.good),
          words(L(`the estimate moves ${Math.round(n.Lp * 100)}% of the way to y`, `估计值朝 y 挪了 ${Math.round(n.Lp * 100)}% 的路`), 20, c.good, RX, -2.72, { max_w: RX1 - RX }),
        );
        gain.submobjects[0].move_to([RX + gain.submobjects[0].width / 2, -2.2, 0]);
        gain.name = 'gain';
        const scores = words(L(`speed error (RMS): differencing ${n.v_diff_rms.toFixed(2)}, filter ${n.v_est_rms.toFixed(2)} m/s`, `速度误差（均方根）：差分 ${n.v_diff_rms.toFixed(2)}，滤波 ${n.v_est_rms.toFixed(2)} m/s`), 20, c.ink, RX, -3.2, { max_w: RX1 - RX });
        scores.name = 'scores';

        // ---- the story
        t_meas.set_value(0);
        t_est.set_value(0);
        this.play(FadeIn(note), FadeIn(v_legend), FadeIn(vp.group), FadeIn(p_legend), FadeIn(pp.group), FadeIn(zero), FadeIn(steps), { run_time: 1.2 });
        this.add(v_true, v_diff, p_meas);
        this.play(UpdateFromAlphaFunc(t_meas, (_m: unknown, a?: number) => t_meas.set_value((a ?? 1) * T_END), { run_time: 4, rate_func: linear }));
        this.wait(0.8);
        this.add(v_est, p_est);
        this.play(UpdateFromAlphaFunc(t_est, (_m: unknown, a?: number) => t_est.set_value((a ?? 1) * T_END), { run_time: 3.5, rate_func: linear }));
        this.play(FadeIn(scores), { run_time: 0.6 });
        this.play(FadeIn(bells), { run_time: 1 });
        this.wait(0.6);
        this.play(Create(b_est), FadeIn(mu_line), FadeIn(w_est), { run_time: 1.2 });
        this.play(FadeIn(gain), { run_time: 0.8 });
        this.wait(2);
        this.add(b_est, mu_line, w_est);
      }
    }
    return new Kalman();
  },
});
