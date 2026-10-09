// Forgetting as a toy model with two parameters (labelled as one). The old
// task is a bowl around the base model θ0 = (0, 0); the new task is a long
// trough: steep across (θ1 must reach 2), almost flat along it (θ2 drifts
// slowly towards 3). Training = gradient descent on
//   (1 - ρ) L_new + ρ L_old        (ρ = replay: the share of old data mixed in).
// Exact gradient steps: the steep direction converges fast; afterwards the
// point keeps drifting along the trough at a speed ∝ η, and the old loss keeps
// rising although the new loss is flat. A little replay pins the direction the
// new task does not care about, at almost no cost. Preset B: the old task does
// not care about θ2 either - the point moves far and forgets little, so
// distance in parameters is not forgetting (RL's Razor: forgetting tracks the
// change in behaviour, KL(π0‖π) on the new task, not the weight change).
import { FadeIn, Indicate, MathTex, Scene, VGroup, VMobject, ValueTracker, always_redraw } from 'manim-web';
import { palette } from '../../theme';
import { define_visual } from '../../visual';
import { fit, label } from '../f/kit';
import { LANG_SPEC, choice, clamp, idx, pick, readout, resolve_lang, seg, slider, type Lang } from './kit';

export interface TwoValleysParams extends Record<string, unknown> {
  lr: number;
  replay: number;
  preset: string;
  lang: string;
}

/** The two quadratic losses (old task: diag(1, h2) bowl at 0; new task: trough at θ1 = 2, slowly to θ2 = 3). */
export const H_NEW = [8, 0.02];
export const NEW_MIN = [2, 3];
export const h_old = (preset: number) => [1, preset === 1 ? 0.05 : 1];
export const L_new = (t: readonly number[]) => 0.5 * H_NEW[0] * (t[0] - NEW_MIN[0]) ** 2 + 0.5 * H_NEW[1] * (t[1] - NEW_MIN[1]) ** 2;
export const L_old = (t: readonly number[], preset = 0) => 0.5 * h_old(preset)[0] * t[0] ** 2 + 0.5 * h_old(preset)[1] * t[1] ** 2;
/** k gradient-descent steps on (1-ρ) L_new + ρ L_old from t; returns every point visited (t excluded). */
export function gd(t: readonly number[], k: number, lr: number, rho: number, preset = 0): number[][] {
  const ho = h_old(preset);
  let [x, y] = t;
  const out: number[][] = [];
  for (let i = 0; i < k; i++) {
    const gx = (1 - rho) * H_NEW[0] * (x - NEW_MIN[0]) + rho * ho[0] * x;
    const gy = (1 - rho) * H_NEW[1] * (y - NEW_MIN[1]) + rho * ho[1] * y;
    x -= lr * gx;
    y -= lr * gy;
    if (!Number.isFinite(x) || Math.abs(x) > 1e6) {
      x = Math.sign(x || 1) * 1e6;
      out.push([x, y]);
      break;
    }
    out.push([x, y]);
  }
  return out;
}

const PLOT = { x0: -6.7, x1: -0.9, y0: -2.85, y1: 3.0 }; // the parameter plane's box
const VIEW = { lo: [-1, -1], hi: [4, 4.6] };
const TS = { x0: 0.75, x1: 6.7, top: [3.0, 0.5], h: 1.75, max_steps: 3000 };

export const two_valleys_forgetting = define_visual<TwoValleysParams>({
  name: 'two_valleys_forgetting',
  summary: 'Forgetting as a two-parameter toy model: an old-task bowl around the base model and a new-task trough (steep across, nearly flat along). Gradient steps on (1-ρ)·L_new + ρ·L_old (ρ = replay) are exact; the path, L_new and L_old over steps grow as training runs. Shows: after the new loss is flat the point keeps drifting (speed ∝ learning rate) and the old loss keeps rising; replay pins the drift cheaply; preset B shows distance moved is not forgetting. Controls: learning rate, replay, preset; lessons add "train 100 steps".',
  topics: ['fine-tuning', 'catastrophic forgetting', 'learning rate', 'replay', 'optimization', 'toy model'],
  params: {
    lr: { type: 'number', min: 0.005, max: 0.3, default: 0.02, doc: 'learning rate η (the steep direction diverges above 2/8 = 0.25 without replay)' },
    replay: { type: 'number', min: 0, max: 0.9, default: 0, doc: 'ρ, the share of old-task data mixed into training' },
    preset: { type: 'enum', values: ['A', 'B'], default: 'A', doc: "'A': the old task cares about both parameters; 'B': the old task barely cares about θ2 (moving far need not mean forgetting)" },
    lang: LANG_SPEC,
  },
  examples: [{}, { lang: 'zh' }, { lr: 0.2 }, { replay: 0.3, lr: 0.05, lang: 'zh' }, { preset: 'B' }, { lr: 0.3, lang: 'zh' }],
  ids: ['plane', 'contours', 'path', 'point', 'series', 'readouts', 'formula', 'controls', 'toy_note'],
  scene: (p) => new TwoValleysScene(p, resolve_lang(p.lang)),
  explore: (scene: any, ui) => scene.attach(ui),
});

export class TwoValleysScene extends Scene {
  p: TwoValleysParams;
  lang: Lang;
  /** Learning rate η. */
  lr = ValueTracker(0.02);
  /** Replay share ρ. */
  rho = ValueTracker(0);
  /** 0 = preset A, 1 = preset B. */
  preset = ValueTracker(0);
  /** Current parameters and the number of steps taken. */
  t1 = ValueTracker(0);
  t2 = ValueTracker(0);
  steps = ValueTracker(0);
  /** The history (every point visited) lives on this group (`_hist`), replaced (never mutated) on each change. */
  hist_group!: VGroup;
  ctls: any[] = [];
  constructor(p: TwoValleysParams, lang: Lang) {
    super();
    this.p = p;
    this.lang = lang;
  }
  theta(): number[] {
    return [this.t1.get_value(), this.t2.get_value()];
  }
  preset_now(): number {
    return idx(this.preset, 2);
  }
  history(): number[][] {
    return (this.hist_group as any)?._hist ?? [[0, 0]];
  }
  l_new(): number {
    return L_new(this.theta());
  }
  l_old(): number {
    return L_old(this.theta(), this.preset_now());
  }
  distance(): number {
    const t = this.theta();
    return Math.hypot(t[0], t[1]);
  }
  diverged(): boolean {
    return Math.abs(this.t1.get_value()) > 1e3;
  }
  /** Run k exact gradient steps with the current η, ρ and preset (a world's "train 100 steps"). */
  train(k = 100): void {
    if (this.diverged()) return;
    const pts = gd(this.theta(), k, clamp(this.lr.get_value(), 0.001, 0.5), clamp(this.rho.get_value(), 0, 0.95), this.preset_now());
    const last = pts[pts.length - 1];
    (this.hist_group as any)._hist = [...this.history(), ...pts];
    this.t1.set_value(last[0]);
    this.t2.set_value(last[1]);
    this.steps.set_value(this.steps.get_value() + pts.length);
  }
  /** Back to the base model. */
  reset(): void {
    (this.hist_group as any)._hist = [[0, 0]];
    this.t1.set_value(0);
    this.t2.set_value(0);
    this.steps.set_value(0);
  }
  attach(ui: any): void {
    for (const c of this.ctls) c.attach(ui);
  }

  override construct() {
    const c = palette();
    const lang = this.lang;
    this.lr.set_value(this.p.lr);
    this.rho.set_value(this.p.replay);
    this.preset.set_value(this.p.preset === 'B' ? 1 : 0);
    this.lr.name = 'learning_rate';
    this.rho.name = 'replay';
    this.preset.name = 'preset';
    this.track(this.lr, this.rho, this.preset, this.t1, this.t2, this.steps);
    this.hist_group = VGroup();
    (this.hist_group as any)._hist = [[0, 0]];

    // ---- the parameter plane
    const sx = (PLOT.x1 - PLOT.x0) / (VIEW.hi[0] - VIEW.lo[0]), sy = (PLOT.y1 - PLOT.y0) / (VIEW.hi[1] - VIEW.lo[1]);
    const P = (x: number, y: number): [number, number, number] => [PLOT.x0 + (x - VIEW.lo[0]) * sx, PLOT.y0 + (y - VIEW.lo[1]) * sy, 0];
    const inside = (q: number[]) => q[0] >= PLOT.x0 && q[0] <= PLOT.x1 && q[1] >= PLOT.y0 && q[1] <= PLOT.y1;
    const frame = VMobject({ stroke_color: c.faint, stroke_width: 2, fill_opacity: 0 });
    frame.set_points_as_corners([[PLOT.x0, PLOT.y0, 0], [PLOT.x1, PLOT.y0, 0], [PLOT.x1, PLOT.y1, 0], [PLOT.x0, PLOT.y1, 0], [PLOT.x0, PLOT.y0, 0]]);
    const axes = VGroup(seg(P(VIEW.lo[0], 0), P(VIEW.hi[0], 0), c.muted, 2, 0.7), seg(P(0, VIEW.lo[1]), P(0, VIEW.hi[1]), c.muted, 2, 0.7));
    const ax_x = (MathTex as any)('\\theta_1', { font_size: 30, color: c.muted }).move_to([PLOT.x1 - 0.2, P(0, 0)[1] - 0.3, 0]);
    const ax_y = (MathTex as any)('\\theta_2', { font_size: 30, color: c.muted }).move_to([P(0, 0)[0] - 0.32, PLOT.y1 - 0.2, 0]);
    /** An ellipse (centre, half-axes) as polylines clipped to the plot box. */
    const ellipse = (cx: number, cy: number, a: number, b: number, color: string, opacity: number): VMobject => {
      const vm = VMobject({ stroke_color: color, stroke_width: 2.5, stroke_opacity: opacity, fill_opacity: 0 });
      const pts: number[] = [];
      let prev: number[] | null = null;
      for (let k = 0; k <= 360; k++) {
        const th = (k / 360) * 2 * Math.PI, q = P(cx + a * Math.cos(th), cy + b * Math.sin(th));
        if (prev && inside(prev) && inside(q)) for (let j = 0; j < 4; j++) pts.push(prev[0] + ((q[0] - prev[0]) * j) / 3, prev[1] + ((q[1] - prev[1]) * j) / 3, 0);
        prev = q;
      }
      vm.points = Float64Array.from(pts.length ? pts : [PLOT.x0, PLOT.y0, 0, PLOT.x0, PLOT.y0, 0, PLOT.x0, PLOT.y0, 0, PLOT.x0, PLOT.y0, 0]);
      return vm;
    };
    const levels = [0.25, 1, 2.5, 5];
    const contours = always_redraw(() => {
      const ho = h_old(this.preset_now());
      return VGroup(
        ...levels.map((L) => ellipse(0, 0, Math.sqrt((2 * L) / ho[0]), Math.sqrt((2 * L) / ho[1]), c.purple, 0.55)),
        ...levels.map((L) => ellipse(NEW_MIN[0], NEW_MIN[1], Math.sqrt((2 * L) / H_NEW[0]), Math.sqrt((2 * L) / H_NEW[1]), c.teal, 0.7)),
      );
    });
    contours.name = 'contours';
    const base_dot = VGroup(
      VMobject({ fill_color: c.ink, fill_opacity: 1, stroke_width: 0 }).set_points_as_corners([P(-0.06, -0.06), P(0.06, -0.06), P(0.06, 0.06), P(-0.06, 0.06), P(-0.06, -0.06)]),
    );
    const base_lab = fit(label(pick(lang, 'base model θ0', '基座 θ0'), 22, c.ink), 2.2, 0.38).move_to([P(0, 0)[0] + 0.85, P(0, 0)[1] - 0.32, 0]);
    const old_lab = fit(label(pick(lang, 'old task (purple)', '旧任务（紫）'), 22, c.purple), 2.6, 0.38).move_to([PLOT.x0 + 1.2, PLOT.y0 + 0.3, 0]);
    const new_lab = fit(label(pick(lang, 'new task trough (teal)', '新任务的槽（青）'), 22, c.teal), 2.8, 0.38).move_to([P(2, 0)[0] + 0.4, PLOT.y1 - 0.25, 0]);
    const plane = VGroup(frame, axes, ax_x, ax_y, base_dot, base_lab, old_lab, new_lab);
    plane.name = 'plane';
    const path = always_redraw(() => {
      void this.steps.get_value();
      const h = this.history();
      const vm = VMobject({ stroke_color: c.coral, stroke_width: 3.5, fill_opacity: 0 });
      const pts: number[] = [];
      // thin the path for drawing (at most ~400 segments)
      const stride = Math.max(1, Math.floor(h.length / 400));
      let prev = P(h[0][0], h[0][1]);
      for (let i = stride; i < h.length + stride; i += stride) {
        const q0 = h[Math.min(i, h.length - 1)], q = P(clamp(q0[0], -50, 50), clamp(q0[1], -50, 50));
        if (inside(prev) && inside(q)) for (let j = 0; j < 4; j++) pts.push(prev[0] + ((q[0] - prev[0]) * j) / 3, prev[1] + ((q[1] - prev[1]) * j) / 3, 0);
        prev = q;
        if (i >= h.length - 1) break;
      }
      vm.points = Float64Array.from(pts.length ? pts : [...P(0, 0), ...P(0, 0), ...P(0, 0), ...P(0, 0)]);
      if (!pts.length) vm.set_opacity(0);
      return vm;
    });
    path.name = 'path';
    const point = always_redraw(() => {
      const t = this.theta(), q = P(clamp(t[0], VIEW.lo[0], VIEW.hi[0]), clamp(t[1], VIEW.lo[1], VIEW.hi[1]));
      const vm = VMobject({ fill_color: c.coral, fill_opacity: 1, stroke_color: c.bg, stroke_width: 2 });
      const r = 0.12;
      vm.set_points_as_corners(Array.from({ length: 17 }, (_, k) => [q[0] + r * Math.cos((k / 16) * 2 * Math.PI), q[1] + r * Math.sin((k / 16) * 2 * Math.PI), 0]));
      return vm;
    });
    point.name = 'point';

    // ---- the two losses over training steps
    const series = always_redraw(() => {
      void this.steps.get_value();
      const h = this.history(), pre = this.preset_now();
      const n = h.length - 1, maxs = Math.max(TS.max_steps, n);
      const g = VGroup();
      const draw = (top: number, f: (t: number[]) => number, ymax: number, color: string) => {
        g.add(seg([TS.x0, top - TS.h], [TS.x1, top - TS.h], c.muted, 2), seg([TS.x0, top - TS.h], [TS.x0, top], c.muted, 2));
        const vm = VMobject({ stroke_color: color, stroke_width: 3.5, fill_opacity: 0 });
        const pts: number[] = [];
        const stride = Math.max(1, Math.floor(n / 300));
        let prev: number[] | null = null;
        for (let i = 0; i <= n; i += stride) {
          const q = [TS.x0 + (i / maxs) * (TS.x1 - TS.x0), top - TS.h + clamp(f(h[i]) / ymax, 0, 1) * TS.h, 0];
          if (prev) for (let j = 0; j < 4; j++) pts.push(prev[0] + ((q[0] - prev[0]) * j) / 3, prev[1] + ((q[1] - prev[1]) * j) / 3, 0);
          prev = q;
        }
        if (pts.length) {
          vm.points = Float64Array.from(pts);
          g.add(vm);
        }
      };
      draw(TS.top[0], (t) => L_new(t), 16.1, c.teal);
      draw(TS.top[1], (t) => L_old(t, pre), 7, c.purple);
      return g;
    });
    const s_new = fit(label(pick(lang, 'new-task loss', '新任务 loss'), 22, c.teal), 3, 0.38).move_to([TS.x0 + 1.0, TS.top[0] + 0.25, 0]);
    const s_old = fit(label(pick(lang, 'old-task loss (forgetting)', '旧任务 loss（遗忘）'), 22, c.purple), 3.6, 0.38).move_to([TS.x0 + 1.5, TS.top[1] + 0.25, 0]);
    const s_x = fit(label(pick(lang, 'training steps →', '训练步数 →'), 20, c.muted), 2.4, 0.35).move_to([TS.x1 - 1.0, TS.top[1] - TS.h - 0.22, 0]);
    const series_g = VGroup(series, s_new, s_old, s_x);
    series_g.name = 'series';

    // ---- readouts and controls
    const ro = VGroup(
      readout(pick(lang, 'steps', '步数'), () => this.steps.get_value(), { x: 0.75, y: -1.85, decimals: 0, size: 22 }),
      readout(pick(lang, 'new loss', '新 loss'), () => Math.min(99, this.l_new()), { x: 2.75, y: -1.85, decimals: 2, size: 22, value_color: c.teal }),
      readout(pick(lang, 'old loss', '旧 loss'), () => Math.min(99, this.l_old()), { x: 4.75, y: -1.85, decimals: 2, size: 22, value_color: c.purple }),
      readout(pick(lang, 'distance moved |θ − θ0|', '参数移动距离 |θ − θ0|'), () => Math.min(99, this.distance()), { x: 0.75, y: -2.4, decimals: 2, size: 22 }),
    );
    ro.name = 'readouts';
    const formula = (MathTex as any)('\\min_\\theta\\ (1-\\rho)\\,L_{new} + \\rho\\,L_{old}', { font_size: 28, color: c.ink });
    formula.move_to([0.75 + formula.width / 2, -3.1, 0]);
    formula.name = 'formula';
    const lr_ctl = slider(this.lr, { x: 4.6, y: -2.9, width: 1.15, min: 0.005, max: 0.3, log: true, title: 'η', decimals: 3, color: c.coral });
    const rho_ctl = slider(this.rho, { x: 4.6, y: -3.5, width: 1.15, min: 0, max: 0.9, title: 'ρ', decimals: 2, color: c.purple });
    const preset_ctl = choice(this.preset, [pick(lang, 'A: the old task cares about θ1 and θ2', 'A：旧任务两个方向都在乎'), pick(lang, 'B: the old task barely cares about θ2', 'B：旧任务几乎不在乎 θ2')], { x: -6.55, y: -3.25, width: 5.8, size: 20, gap: 0.38 });
    this.ctls = [lr_ctl, rho_ctl, preset_ctl];
    const controls = VGroup(lr_ctl.group, rho_ctl.group, preset_ctl.group);
    controls.name = 'controls';
    const note = fit(label(pick(lang, 'toy model: 2 parameters, exact gradient steps', '示意模型：2 个参数，精确的梯度下降'), 20, c.muted), 6, 0.36);
    note.move_to([6.7 - note.width / 2, 3.65, 0]);
    note.name = 'toy_note';

    // ---- story: small η, then 10× η, then replay
    const lr0 = this.lr.get_value(), rho0 = this.rho.get_value();
    this.play(FadeIn(plane), FadeIn(note), { run_time: 0.8 });
    this.add(contours);
    this.wait(0.6);
    this.add(this.hist_group, path, point, series_g);
    for (const m of ro.submobjects) (m as any).update(0);
    this.play(FadeIn(ro), FadeIn(formula), { run_time: 0.6 });
    this.add(controls);
    this.lr.set_value(0.02);
    this.rho.set_value(0);
    for (let k = 0; k < 10; k++) {
      this.train(100);
      this.wait(0.25);
    }
    this.play(Indicate(ro.submobjects[2], { color: c.purple, scale_factor: 1.15 }), { run_time: 0.8 });
    this.reset();
    this.play(this.lr.animate.set_value(0.2), { run_time: 0.8 });
    for (let k = 0; k < 10; k++) {
      this.train(100);
      this.wait(0.25);
    }
    this.play(Indicate(ro.submobjects[2], { color: c.purple, scale_factor: 1.15 }), { run_time: 0.8 });
    this.reset();
    this.play(this.lr.animate.set_value(0.05), this.rho.animate.set_value(0.3), { run_time: 0.8 });
    for (let k = 0; k < 10; k++) {
      this.train(200);
      this.wait(0.25);
    }
    this.wait(0.6);
    this.reset();
    this.play(this.lr.animate.set_value(lr0), this.rho.animate.set_value(rho0), { run_time: 0.8 });
    this.add(plane, contours, this.hist_group, path, point, series_g, ro, formula, controls, note);
    this.wait(0.6);
  }
}
