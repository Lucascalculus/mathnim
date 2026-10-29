// M8's world: a nonlinear MPC drives a toy car along an S-shaped road
// (kinematic bicycle model, car_math.ts). Each sample, the NMPC linearises the
// car around a guess, solves a QP for the correction, and (optionally) repeats.
// The learner moves the two causes of real-time NMPC quality:
//   - what the QP is built around: "straight ahead" (cold: no steering, no
//     braking, from the current state) or "the last plan, shifted" (warm);
//   - how many QPs per sample: 1 (the real-time iteration), 2, 3, or until
//     the step is tiny ("converged").
// and an instant to inspect. Left: the road from above, the driven path, the
// car, and at the inspected instant the plan's four curves: the reference
// points (dots), the guess the QP was linearised around (dotted), what the
// last QP predicted (dashed), and what that plan really does (thin solid).
// Right: the lateral error e(t) against the ±15 cm brief, and the run's
// numbers. All a simulation of a toy car (not a real vehicle); the plant is the
// controller's own model, so every difference comes from the optimisation.
import { FadeIn, Scene, UpdateFromAlphaFunc, VGroup, VMobject, ValueTracker, linear, smooth } from 'manim-web';
import { palette } from '../theme';
import { define_visual } from '../visual';
import { CAR, ROAD, STEPS, track_run, type Guess, type Iters, type TrackRun } from './car_math';
import { Choice, LANG_SPEC, Plot, StepSlider, dash_polys, emit, listen, live_label, live_vm, pick, poly_points, polyline, polys_points, resolve_lang, stroke, words, type Listener, type XY } from './kit';
import { aside } from '../aside';

export interface CarTrackParams extends Record<string, unknown> {
  guess: string;
  iters: string;
  t: number;
  story: string;
  lang: string;
}

/** The brief of the world: stay within this distance of the lane centre [m]. */
export const CAR_BRIEF = 0.15;
/** The world's controls (the lesson's `cue` names them the same way). */
export const CAR_LABELS = {
  guess: { en: 'what the QP is built around', zh: 'QP 围绕什么建立' },
  iters: { en: 'QPs per sample', zh: '每个采样解几个 QP' },
  t: { en: 'instant to inspect', zh: '查看的时刻' },
};
export const ITERS: Iters[] = [1, 2, 3, 'conv'];
const T_END = (STEPS - 1) * CAR.dt;

/** What one setting does (for the lesson's goals and detectors). */
export interface CarResult {
  guess: Guess;
  iters: Iters;
  max_e: number;
  mean_qps: number;
  min_v: number;
  in_brief: boolean;
}
export function car_result(guess: Guess, iters: Iters): CarResult {
  const r = track_run(guess, iters);
  return { guess, iters, max_e: r.max_e, mean_qps: r.mean_qps, min_v: Math.min(...r.x.map((x) => x[3])), in_brief: r.max_e <= CAR_BRIEF };
}

// ---- the map: road coordinates [m] to scene units (equal scale)
const MAP = { x0: -6.9, y0: -3.0, scale: 0.235, xmin: -2.0, ymin: -2.5 };
/** The part of the road drawn [m]: plan curves are cut where they leave it (they never cross the panels). */
const VIEW = { xmax: 35.5, ymax: 24.6 };
const M = (x: number, y: number): XY => [MAP.x0 + (x - MAP.xmin) * MAP.scale, MAP.y0 + (y - MAP.ymin) * MAP.scale];
const MAP_X1 = M(VIEW.xmax, 0)[0];
/** A curve's points up to where it first leaves the drawn part of the road. */
function in_view(X: number[][]): number[][] {
  const i = X.findIndex((q) => q[0] > VIEW.xmax || q[1] > VIEW.ymax);
  return i < 0 ? X : X.slice(0, i);
}
const RX = 2.3, RX1 = 6.9;

/** The road's centre line and lane edges as scene polylines. */
function road_lines(): { centre: XY[]; left: XY[]; right: XY[] } {
  const centre: XY[] = [], left: XY[] = [], right: XY[] = [];
  const s_max = 35.5 - ROAD.x[0];
  for (let i = 0; i < ROAD.s.length; i += 6) {
    const x = ROAD.x[i], y = ROAD.y[i], nx = -Math.sin(ROAD.psi[i]), ny = Math.cos(ROAD.psi[i]);
    if (x > 35.5 || ROAD.s[i] > s_max + 40) break;
    centre.push(M(x, y));
    left.push(M(x + CAR.lane * nx, y + CAR.lane * ny));
    right.push(M(x - CAR.lane * nx, y - CAR.lane * ny));
  }
  return { centre, left, right };
}
/** The car's outline (4.2 m × 1.8 m, centred at its centre of gravity) at (X, Y, ψ), in scene units. */
function car_outline(x: number, y: number, psi: number): XY[] {
  const L = 2.1, W = 0.9, c = Math.cos(psi), s = Math.sin(psi);
  const pts: [number, number][] = [[L, W * 0.75], [L * 0.8, W], [-L, W], [-L, -W], [L * 0.8, -W], [L, -W * 0.75]];
  const out = pts.map(([a, b]) => M(x + a * c - b * s, y + a * s + b * c));
  return [...out, out[0]];
}

export const mpc_car_track = define_visual<CarTrackParams>({
  name: 'mpc_car_track',
  summary: 'World: a nonlinear MPC (Gauss–Newton SQP, horizon 2 s) drives a toy car (kinematic bicycle) along an S road, simulation. Left: the road from above, the driven path, the car, and at an inspected instant the reference points, the guess the QP was linearised around (dotted), what the last QP predicted (dashed) and what that plan really does (thin). Right: lateral error e(t) against a ±15 cm brief and the run’s numbers. One QP built around "straight ahead" (cold) cuts the corners by about 33 cm and slows to 5.1 m/s; one QP around the last plan shifted (warm, the real-time iteration) stays within 9 cm, as good as iterating to convergence. Student switches the guess and the QPs per sample, and drags the inspected instant.',
  topics: ['mpc', 'nonlinear mpc', 'nmpc', 'real-time iteration', 'rti', 'sqp', 'warm start', 'path tracking', 'kinematic bicycle', 'control'],
  params: {
    guess: { type: 'enum', values: ['cold', 'warm'], default: 'cold', doc: "what each sample's first QP is linearised around: 'cold' = straight ahead with no steering or braking from the current state; 'warm' = the last plan shifted by one step (the real-time iteration's guess)" },
    iters: { type: 'enum', values: ['1', '2', '3', 'conv'], default: '1', doc: "QPs (Gauss–Newton steps) per sample: '1' = real-time iteration, 'conv' = until the step is below 1e-4 (at most 25)" },
    t: { type: 'number', min: 0, max: 7.9, default: 3.2, doc: 'the instant [s] whose plan is drawn (the first bend is entered near 2 s, the second near 4.8 s)' },
    story: { type: 'enum', values: ['drive', 'still'], default: 'drive', doc: "'drive': the car drives the whole S with its plan drawn live, then the view returns to t; 'still': draw the state at t at once" },
    lang: LANG_SPEC,
  },
  examples: [
    {},
    { lang: 'zh' },
    { guess: 'warm', story: 'still' },
    { guess: 'warm', iters: '1', lang: 'zh', story: 'still' },
    { guess: 'cold', iters: '2', t: 6.0, story: 'still' },
    { guess: 'cold', iters: 'conv', t: 5.2, lang: 'zh', story: 'still' },
    { guess: 'warm', iters: 'conv', t: 0.5, story: 'still' },
    { guess: 'cold', iters: '3', t: 7.9, lang: 'zh', story: 'still' },
  ],
  ids: ['note', 'road', 'driven', 'car', 'reference', 'guess_curve', 'qp_curve', 'true_curve', 'legend', 'gap', 'guess_choice', 'iters_choice', 'e_plot', 'e_curve', 'brief_band', 'readout', 'time_slider'],
  scene: (p) => {
    const lang = resolve_lang(p.lang);
    const L = (en: string, zh: string) => pick(lang, en, zh);
    class CarTrack extends Scene {
      guess = ValueTracker(p.guess === 'warm' ? 1 : 0);
      iters = ValueTracker(Math.max(0, ITERS.findIndex((i) => String(i) === p.iters)));
      t = ValueTracker(Math.min(T_END, Math.max(0, p.t)));
      guess_choice!: Choice;
      iters_choice!: Choice;
      slider!: StepSlider;
      g(): Guess {
        return this.guess.get_value() >= 0.5 ? 'warm' : 'cold';
      }
      it(): Iters {
        return ITERS[Math.max(0, Math.min(3, Math.round(this.iters.get_value())))];
      }
      run(): TrackRun {
        return track_run(this.g(), this.it());
      }
      /** The learner's current setting and what it does. */
      result(): CarResult {
        return car_result(this.g(), this.it());
      }
      listen(f: Listener): void {
        listen(this, f);
      }
      override construct() {
        const c = palette();
        const { guess, iters, t } = this;
        this.track(guess, iters, t);
        const t_final = t.get_value();
        if (p.story === 'drive') t.set_value(0);
        const run = () => this.run();
        const k_of = () => Math.min(STEPS - 1, Math.floor(t.get_value() / CAR.dt + 1e-9));
        const setting = () => `${guess.get_value() >= 0.5 ? 1 : 0}|${Math.round(iters.get_value())}`;
        const key_k = () => `${setting()}|${k_of()}`;
        const key_t = () => `${setting()}|${t.get_value().toFixed(3)}`;
        /** The car's state at time t (linear between samples, for a smooth drive). */
        const state_at = (tt: number) => {
          const x = run().x, f = Math.min(STEPS, tt / CAR.dt), k = Math.min(STEPS - 1, Math.floor(f)), a = f - k;
          return x[k].map((v, i) => v + a * (x[k + 1][i] - v));
        };

        // ---- honest label
        const note = aside(this, words(L('simulation of a toy car (kinematic bicycle, 6 m/s, horizon 2 s) that obeys the controller’s own model; the 15 cm brief is a toy number', '玩具小车的模拟（运动学自行车模型，6 m/s，预测时域 2 秒），小车遵循的就是控制器的模型；15 cm 的要求是教学用的玩具数字'), 19, c.muted, -6.9, 3.72, { max_w: 13.8 }));
        note.name = 'note';

        // ---- the road
        const rl = road_lines();
        const road = VGroup(polyline(rl.left, c.muted, 2.5), polyline(rl.right, c.muted, 2.5), polyline(rl.centre, c.faint, 2.5, { dash: [0.16, 0.12] }));
        road.name = 'road';
        const lane_word = words(L('lane: ±1.5 m (no run leaves it)', '车道：±1.5 m（所有设置都没出车道）'), 19, c.muted, M(6, -2.2)[0], M(6, -2.2)[1]);
        road.add(lane_word);

        // ---- what the car did, and the car
        const driven = live_vm(stroke(c.accent, 3.5), () => {
          const x = run().x, k = k_of();
          const pts: XY[] = x.slice(0, k + 1).map((s) => M(s[0], s[1]));
          const now = state_at(t.get_value());
          pts.push(M(now[0], now[1]));
          return poly_points(pts);
        }, key_t);
        driven.name = 'driven';
        const car = live_vm(VMobject({ fill_color: c.accent, fill_opacity: 0.85, stroke_color: c.ink, stroke_width: 2 }), () => {
          const s = state_at(t.get_value());
          return poly_points(car_outline(s[0], s[1], s[2]));
        }, key_t);
        car.name = 'car';

        // ---- the plan at instant k: reference, guess, QP prediction, truth
        const plan = () => run().plans[k_of()];
        const ref_dots = live_vm(VMobject({ fill_color: c.good, fill_opacity: 1, stroke_width: 0, stroke_color: c.good }), () => {
          const r = 0.045, segs: XY[][] = [];
          for (const q of in_view(plan().ref)) {
            const [cx, cy] = M(q[0], q[1]);
            segs.push([[cx - r, cy - r], [cx + r, cy - r], [cx + r, cy + r], [cx - r, cy + r], [cx - r, cy - r]]);
          }
          return polys_points(segs);
        }, key_k);
        ref_dots.name = 'reference';
        const curve_pts = (X: number[][]) => in_view(X).map((s) => M(s[0], s[1]));
        const guess_curve = live_vm(stroke(c.muted, 3), () => polys_points(dash_polys(curve_pts(plan().X_guess), 0.05, 0.08)), key_k);
        guess_curve.name = 'guess_curve';
        const true_curve = live_vm(stroke(c.ink, 2.5), () => poly_points(curve_pts(plan().X_true)), key_k);
        true_curve.name = 'true_curve';
        const qp_curve = live_vm(stroke(c.purple, 4), () => polys_points(dash_polys(curve_pts(plan().X_lin), 0.15, 0.1)), key_k);
        qp_curve.name = 'qp_curve';

        // ---- the legend, in the map's empty top-left corner
        const LX = -6.75, LW = 4.2;
        const sample = (y: number, kind: 'dots' | 'dotted' | 'dashed' | 'thin' | 'solid') => {
          const a: XY = [LX, y], b: XY = [LX + 0.45, y];
          if (kind === 'dots') return VGroup(...[0.05, 0.22, 0.39].map((dx) => polyline([[LX + dx - 0.04, y], [LX + dx + 0.04, y]], c.good, 7)));
          if (kind === 'dotted') return polyline([a, b], c.muted, 3, { dash: [0.05, 0.08] });
          if (kind === 'dashed') return polyline([a, b], c.purple, 4, { dash: [0.15, 0.1] });
          if (kind === 'thin') return polyline([a, b], c.ink, 2.5);
          return polyline([a, b], c.accent, 3.5);
        };
        const row = (y: number, kind: Parameters<typeof sample>[1], en: string, zh: string) => VGroup(sample(y, kind), words(L(en, zh), 19, c.ink, LX + 0.6, y, { max_w: LW - 0.6 }));
        const legend = VGroup(
          live_label(() => L(`the plan made at t = ${(k_of() * CAR.dt).toFixed(1)} s:`, `t = ${(k_of() * CAR.dt).toFixed(1)} s 时做的计划：`), 20, c.ink, (m) => m.move_to([LX + m.width / 2, 3.15, 0]), { weight: 'BOLD' }),
          row(2.72, 'dots', 'reference points (20, every 0.1 s)', '参考点（20 个，每 0.1 秒一个）'),
          row(2.34, 'dotted', 'the guess the QP is built around', 'QP 围绕的猜测轨迹'),
          row(1.96, 'dashed', 'what the QP predicted', 'QP 预测的轨迹'),
          row(1.58, 'thin', 'what that plan really does', '这个计划实际的轨迹'),
          row(1.2, 'solid', 'where the car went', '小车实际走过的路'),
        );
        legend.name = 'legend';
        // how far the QP's prediction is from the truth at the end of the horizon
        const gap_m = () => {
          const pl = plan(), a = pl.X_lin[pl.X_lin.length - 1], b = pl.X_true[pl.X_true.length - 1];
          return Math.hypot(a[0] - b[0], a[1] - b[1]);
        };
        const gap = live_label(() => {
          const g = gap_m();
          return g < 0.05 ? L('prediction = truth (off by under 5 cm)', '预测 = 实际（相差不到 5 cm）') : L(`prediction off by ${g.toFixed(1)} m at 2 s`, `2 秒处预测偏了 ${g.toFixed(1)} m`);
        }, 20, () => (gap_m() < 0.05 ? c.good : c.purple), (m) => m.move_to([LX + m.width / 2, 0.8, 0]), { max_width: LW, weight: 'BOLD' });
        gap.name = 'gap';

        // ---- controls: the guess and the QPs per sample
        const cap = (s: string, y: number) => words(s, 21, c.muted, RX, y, { max_w: RX1 - RX });
        this.guess_choice = new Choice({ tracker: guess, values: [0, 1], labels: [L('straight ahead', '直行'), L('last plan, shifted', '上一个计划，平移')], x0: RX, x1: RX1, y: 2.85, font_size: 21 });
        const guess_choice = VGroup(cap(pick(lang, CAR_LABELS.guess.en, CAR_LABELS.guess.zh), 3.27), this.guess_choice);
        guess_choice.name = 'guess_choice';
        this.iters_choice = new Choice({ tracker: iters, values: [0, 1, 2, 3], labels: ['1', '2', '3', L('converge', '到收敛')], x0: RX, x1: RX1, y: 1.9, font_size: 21 });
        const iters_choice = VGroup(cap(pick(lang, CAR_LABELS.iters.en, CAR_LABELS.iters.zh), 2.32), this.iters_choice);
        iters_choice.name = 'iters_choice';

        // ---- e(t) against the brief
        const E = new Plot({ box: { x0: RX + 0.55, x1: RX1 - 0.05, y0: -0.75, y1: 1.0 }, x: [0, 8], y: [-40, 48], y_ticks: [-30, -15, 0, 15, 30], x_ticks: [0, 2, 4, 6, 8], y_label: L('lateral error e (cm), + = left', '横向误差 e（cm），+ 为偏左'), x_label: { tex: 't\\;(\\mathrm{s})' }, font: 19 });
        E.group.name = 'e_plot';
        const brief_band = E.band(-100 * CAR_BRIEF, 100 * CAR_BRIEF, c.good, 0.13);
        brief_band.name = 'brief_band';
        const e_curve = E.live_curve(() => run().e.slice(0, k_of() + 1).map((e, k) => [k * CAR.dt, 100 * e] as XY), { color: c.accent, width: 3.5 }, key_k);
        e_curve.name = 'e_curve';
        const cursor = E.cursor(() => k_of() * CAR.dt, c.muted, 2);
        // the bends, under the time axis
        const bends = VGroup(E.note(L('bend 1', '弯 1'), 2.0, 42, c.muted, 17), E.note(L('bend 2', '弯 2'), 4.9, 42, c.muted, 17));

        // ---- the run's numbers
        const res = () => this.result();
        const readout = VGroup(
          live_label(() => L(`largest |e|: ${Math.round(100 * res().max_e)} cm`, `最大 |e|：${Math.round(100 * res().max_e)} cm`), 22, () => (res().in_brief ? c.good : c.coral), (m) => m.move_to([RX + m.width / 2, -1.72, 0]), { weight: 'BOLD', max_width: RX1 - RX }),
          live_label(() => L(`toy brief: within ${Math.round(100 * CAR_BRIEF)} cm — ${res().in_brief ? 'met' : 'not met'}`, `玩具要求：不超过 ${Math.round(100 * CAR_BRIEF)} cm，${res().in_brief ? '达到' : '未达到'}`), 20, () => (res().in_brief ? c.good : c.coral), (m) => m.move_to([RX + m.width / 2, -2.12, 0]), { max_width: RX1 - RX }),
          live_label(() => L(`QPs per sample: ${res().mean_qps.toFixed(1)} on average`, `每个采样平均解 ${res().mean_qps.toFixed(1)} 个 QP`), 22, c.ink, (m) => m.move_to([RX + m.width / 2, -2.6, 0]), { max_width: RX1 - RX }),
          live_label(() => L(`slowest speed: ${res().min_v.toFixed(1)} m/s (asked: 6)`, `最低车速：${res().min_v.toFixed(1)} m/s（要求 6）`), 22, () => (res().min_v < 5.8 ? c.coral : c.ink), (m) => m.move_to([RX + m.width / 2, -3.05, 0]), { max_width: RX1 - RX }),
        );
        readout.name = 'readout';

        // ---- the inspected instant
        this.slider = new StepSlider(t, { lo: 0, hi: T_END, step: 0.1, x0: -4.6, x1: MAP_X1 - 0.1, y: -3.55, ticks: [0, 2, 4, 6] });
        const t_caption = live_label(() => L(`inspect t = ${(k_of() * CAR.dt).toFixed(1)} s`, `查看 t = ${(k_of() * CAR.dt).toFixed(1)} s`), 21, c.ink, (m) => m.move_to([-6.85 + m.width / 2, -3.55, 0]));
        const time_slider = VGroup(this.slider.group, t_caption);
        time_slider.name = 'time_slider';

        // ---- the story
        this.play(FadeIn(note), FadeIn(road), FadeIn(E.group), FadeIn(brief_band), FadeIn(guess_choice), FadeIn(iters_choice), { run_time: 1.2 });
        this.add(driven, car, guess_curve, true_curve, qp_curve, ref_dots, e_curve, cursor, bends);
        this.play(FadeIn(legend), FadeIn(gap), FadeIn(time_slider), FadeIn(readout), { run_time: 0.8 });
        if (p.story === 'drive') {
          this.play(UpdateFromAlphaFunc(t, (_m: unknown, a?: number) => t.set_value((a ?? 1) * T_END), { run_time: 9, rate_func: linear }));
          this.wait(0.8);
          const from = t.get_value();
          this.play(UpdateFromAlphaFunc(t, (_m: unknown, a?: number) => t.set_value(from + (t_final - from) * (a ?? 1)), { run_time: 1.2, rate_func: smooth }));
        }
        this.wait(1.5);
      }
    }
    return new CarTrack();
  },
  explore: (scene: any, ui, p) => {
    const lang = resolve_lang(p.lang);
    const report = () => emit(scene, 'setting', { ...scene.result() });
    scene.guess_choice.attach(ui, pick(lang, CAR_LABELS.guess.en, CAR_LABELS.guess.zh), report);
    scene.iters_choice.attach(ui, pick(lang, CAR_LABELS.iters.en, CAR_LABELS.iters.zh), report);
    scene.slider.attach(ui, pick(lang, CAR_LABELS.t.en, CAR_LABELS.t.zh), { on_end: () => emit(scene, 'inspect', { t: scene.t.get_value() }) });
  },
});
