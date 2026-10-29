// The receding-horizon loop on the running example (M1, and the course's
// feature picture): the cart must dock against the wall. At every instant the
// controller plans N steps (dashed: predicted positions; the strip: the planned
// accelerations), applies only the first, the window slides one step, and it
// plans again from the new measurement. Three slow loops, a fast-forward while
// the wall comes into view (braking enters the plan from its far end), three
// more slow loops, then the rest of the run. A simulation of the course's toy model.
import { Create, FadeIn, Scene, UpdateFromAlphaFunc, VGroup, ValueTracker, linear } from 'manim-web';
import { palette } from '../theme';
import { define_visual } from '../visual';
import { CART } from './math';
import { dock_run } from './dock';
import { HorizonStrip, LANG_SPEC, Plot, Track, live_label, pick, resolve_lang, tex, visible_when, words, type XY } from './kit';
import { aside } from '../aside';

export interface RecedingLoopParams extends Record<string, unknown> {
  N: number;
  lang: string;
}

/** Position of the cart at fractional instant kf (exact within a sample: constant acceleration). */
export function position_at(run: ReturnType<typeof dock_run>, kf: number): number {
  const k = Math.min(run.u.length - 1, Math.max(0, Math.floor(kf + 1e-9)));
  const tau = Math.max(0, Math.min(1, kf - k)) * CART.dt, [p, v] = run.x[k];
  return p + v * tau + 0.5 * run.u[k] * tau * tau;
}

export const mpc_receding_loop = define_visual<RecedingLoopParams>({
  name: 'mpc_receding_loop',
  summary: 'The receding-horizon loop on the cart docking against a wall (simulation): at every instant the MPC plans N steps (dashed predicted positions; a strip of N planned accelerations), applies only the first, the window slides one step and it re-plans. With N ≥ 19 (about the 2 s it takes to brake from 2 m/s) it docks; shorter horizons hit the wall. No handles.',
  topics: ['mpc', 'model predictive control', 'receding horizon', 'control', 'planning'],
  params: {
    N: { type: 'integer', min: 8, max: 30, default: 20, doc: 'horizon in steps of 0.1 s (20 = 2 s, the time it needs to brake from 2 m/s; 19 still docks, 18 and below hit the wall)' },
    lang: LANG_SPEC,
  },
  examples: [{}, { lang: 'zh' }, { N: 12, lang: 'zh' }, { N: 30 }],
  ids: ['track', 'cart', 'plan_dots', 'plot', 'past', 'plan', 'window', 'wall_band', 'strip', 'clock', 'outcome', 'note'],
  scene: (p) => {
    const lang = resolve_lang(p.lang);
    const L = (en: string, zh: string) => pick(lang, en, zh);
    const N = p.N;
    const run = dock_run(N);
    const T = run.x.length - 1;
    const end_k = run.crash_k >= 0 ? run.crash_k : run.docked_k >= 0 ? run.docked_k : T;
    /** The plan at instant k (inputs and predicted positions), or a held one past the end. */
    const plan_at = (k: number) => run.plans[Math.min(k, end_k - 1)] ?? run.plans[0]!;
    class RecedingLoop extends Scene {
      /** The current instant, fractional while the window slides. */
      kf = ValueTracker(0);
      strip!: HorizonStrip;
      override construct() {
        const c = palette();
        const kf = this.kf;
        const strip = new HorizonStrip({
          x0: -5.6, y: -2.72, cell_w: 12.1 / N, cell_h: 0.8, N, k: kf, u_max: CART.a_max,
          plan: (k) => plan_at(k).U.map((u) => u[0]),
          words: [L('apply the first', '只执行第一步'), L(`the rest of the plan (${N} steps = ${(N * CART.dt).toFixed(1)} s)`, `其余是计划（共 ${N} 步 = ${(N * CART.dt).toFixed(1)} 秒）`)],
        });
        this.strip = strip;
        this.track(kf, strip.blend);
        const ki = () => Math.min(end_k, Math.floor(kf.get_value() + 1e-9));
        const frac = () => kf.get_value() - Math.floor(kf.get_value() + 1e-9);
        // the predicted positions: at an integer instant with blend < 1, the old plan shifted morphing into the new one
        const plan_X = (): number[] => {
          const k = ki(), now = plan_at(k).X.map((x) => x[0]), bl = strip.blend.get_value();
          if (frac() > 1e-9 || bl >= 1 || k === 0 || k >= end_k) return now;
          const prev = plan_at(k - 1).X.map((x) => x[0]).slice(1);
          prev.push(prev[prev.length - 1]);
          return now.map((v, i) => prev[i] + (v - prev[i]) * bl);
        };
        const live = () => kf.get_value() < end_k - 1e-9;

        // ---- the track
        const track = new Track({ x0: -5.6, x1: 6.0, y: 2.45, p: [0, CART.p_max], wall: CART.p_max, label_every: 2 });
        track.group.name = 'track';
        const cart = track.cart(() => position_at(run, Math.min(kf.get_value(), end_k)));
        cart.name = 'cart';
        const dots = track.ghosts(() => (live() ? plan_X().slice(1) : []), c.accent, 0.055);
        dots.name = 'plan_dots';

        // ---- the plot: position against time
        const plot = new Plot({
          box: { x0: -5.6, x1: 6.5, y0: -1.45, y1: 1.35 }, x: [0, 8], y: [0, 11.5],
          x_ticks: [0, 2, 4, 6, 8], y_ticks: [0, 5, 10], x_label: { tex: 't\\;(\\mathrm{s})' }, y_label: { tex: 'p\\;(\\mathrm{m})' },
        });
        plot.group.name = 'plot';
        const band = plot.band(CART.p_max, 11.5, c.coral, 0.14);
        const band_word = plot.note(L('wall', '墙'), 7.95, 10.75, c.coral, 20, 'right');
        const wall_band = VGroup(band, band_word);
        wall_band.name = 'wall_band';
        const t_now = () => Math.min(kf.get_value(), end_k) * CART.dt;
        const window = plot.vband(t_now, () => t_now() + N * CART.dt, c.accent, 0.08);
        window.name = 'window';
        const past = plot.live_curve(() => {
          const k = ki(), pts: XY[] = run.x.slice(0, k + 1).map((x, j) => [j * CART.dt, x[0]]);
          if (live()) pts.push([kf.get_value() * CART.dt, position_at(run, kf.get_value())]);
          return pts;
        }, { color: c.accent, width: 5 }, () => kf.get_value().toFixed(4));
        past.name = 'past';
        const plan = plot.live_curve(() => (live() ? plan_X().map((pp, j) => [(ki() + j) * CART.dt, pp] as XY) : []), { color: c.accent, width: 4, dash: [0.13, 0.09] }, () => `${kf.get_value().toFixed(4)}|${strip.blend.get_value().toFixed(4)}`);
        plan.name = 'plan';
        const now_line = plot.cursor(t_now, c.muted, 2);
        // the legend sits top left, where the curve never goes (it is still low there)
        const legend = VGroup(
          plot.curve([[0.25, 9.0], [0.6, 9.0]], { color: c.accent, width: 5 }), plot.note(L('what happened', '已经发生的'), 0.7, 9.0, c.ink, 20),
          plot.curve([[0.25, 7.6], [0.6, 7.6]], { color: c.accent, width: 4, dash: [0.13, 0.09] }), plot.note(L('what it plans now', '此刻的计划'), 0.7, 7.6, c.ink, 20),
        );
        // the strip's scale: a bar up is speeding up (+1 m/s²), down is braking (−1 m/s²)
        const strip_label = tex('a', 30, c.accent);
        strip_label.move_to([-6.85, -2.72, 0]);
        const s_hi = tex('+1', 22, c.muted), s_lo = tex('-1', 22, c.muted);
        s_hi.move_to([-6.12 - s_hi.width / 2, -2.42, 0]);
        s_lo.move_to([-6.12 - s_lo.width / 2, -3.02, 0]);
        strip.group.add(strip_label, s_hi, s_lo);
        strip.group.name = 'strip';

        // ---- readouts and the honest label
        const clock = live_label(() => `t = ${(Math.min(kf.get_value(), end_k) * CART.dt).toFixed(1)} s`, 24, c.ink, (m) => m.move_to([6.6 - m.width / 2, 3.62, 0]));
        clock.name = 'clock';
        const note = aside(this, words(L('simulation of a toy cart: |a| up to 1 m/s², |v| up to 2 m/s', '玩具小车的模拟：|a| 不超过 1 m/s²，|v| 不超过 2 m/s'), 20, c.muted, -6.9, 3.62));
        note.name = 'note';
        const outcome_text = run.crash_k >= 0
          ? L(`hits the wall at ${run.impact.toFixed(2)} m/s`, `以 ${run.impact.toFixed(2)} m/s 撞上墙`)
          : L('docked: at rest against the wall', '停稳：靠在墙边');
        // inside the plot, top left, where the curve never goes (it is still low there)
        const outcome = visible_when(words(outcome_text, 24, run.crash_k >= 0 ? c.coral : c.good, plot.X(0.25), plot.Y(5.9)), () => kf.get_value() >= end_k - 1e-9);
        outcome.name = 'outcome';

        // ---- the story
        this.play(FadeIn(track.group), FadeIn(cart), FadeIn(plot.group), FadeIn(wall_band), FadeIn(note), FadeIn(clock), { run_time: 1.2 });
        this.add(now_line);
        this.next_section(); // (a section per beat, §, of the narration: the picture waits there for the voice)
        this.play(FadeIn(strip.group), FadeIn(window), { run_time: 0.9 });
        this.play(Create(plan), FadeIn(dots), FadeIn(legend), { run_time: 1.3 });
        this.add(past);
        this.wait(1.2);
        const loop = (times: number) => {
          for (let i = 0; i < times; i++) {
            this.play(strip.shift(0.9));
            this.play(strip.replan(0.7));
            this.wait(0.3);
          }
        };
        const forward = (to: number, run_time: number) => {
          const k0 = kf.get_value();
          this.play(UpdateFromAlphaFunc(kf, (_m: unknown, a?: number) => kf.set_value(k0 + (to - k0) * (a ?? 1)), { run_time, rate_func: linear }));
        };
        this.next_section();
        loop(3);
        // fast-forward until the far end of the window starts to see the braking it will need
        const brake_seen = Math.max(4, Math.min(end_k - 6, (run.brake_k >= 0 ? run.brake_k : end_k) - N + 1));
        this.next_section();
        forward(brake_seen, 3.5);
        this.next_section();
        loop(3);
        forward(end_k, 3);
        this.add(outcome);
        this.wait(1);
      }
    }
    return new RecedingLoop();
  },
});
