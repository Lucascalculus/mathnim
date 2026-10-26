// M3: what the weights of the quadratic cost do. The cart starts at rest at
// 0 m and must stop at the flag at 6 m. The controller is MPC without limits
// and with a long horizon, i.e. the fixed feedback a = −K (x − x_ref) with the
// LQR gain of Q = diag(1, q_v), R = r (weights_math.ts). Left: the cart on the
// track, its position p(t) (the flag dashed, the overshoot and the arrival time
// marked) and its acceleration a(t) against the motor's ±1 m/s² band, which the
// controller does NOT know about. Right: the cost with its two prices (sliders),
// the gain they give, and the run's numbers next to two briefs (A fast,
// B gentle) when `briefs` is on. A simulation of the course's toy cart.
// Story 'still': the run is drawn once. 'sweep_r': then r sweeps from cheap to
// expensive effort and back (the reveal of M3's prediction).
// Explore: drag q_v and r (log sliders); every release reports 'weights'.
import { FadeIn, Scene, UpdateFromAlphaFunc, VGroup, ValueTracker, linear, smooth } from 'manim-web';
import type { Mobject } from 'manim-web';
import { palette } from '../theme';
import { define_visual } from '../visual';
import { LANG_SPEC, Plot, StepSlider, Track, emit, fit, label, listen, live_label, pick, resolve_lang, tex, words, type Listener, type XY } from './kit';
import { W3, meets_fast, meets_gentle, weights_run, type WeightsRun } from './weights_math';

export interface WeightsParams extends Record<string, unknown> {
  q_v: number;
  r: number;
  story: string;
  briefs: boolean;
  lang: string;
}

/** A price as the readout shows it. */
export const fmt_w = (v: number): string => (v >= 9.95 ? v.toFixed(0) : v >= 0.995 ? v.toFixed(1) : v >= 0.0995 ? v.toFixed(2) : v.toFixed(3));
/** Snap to the sliders' grid (0.05 decades). */
export const snap_w = (v: number): number => 10 ** (Math.round(Math.log10(Math.min(100, Math.max(0.01, v))) / 0.05) * 0.05);

const LEFT = { x0: -5.8, x1: 1.55 };
const PX = 2.25; // right panel, left edge
const PX1 = 6.95;
const T_PLOT = 20;

export const mpc_weights = define_visual<WeightsParams>({
  name: 'mpc_weights',
  summary: 'The quadratic cost J = Σ (p − 6)² + q_v v² + r a² on the cart (simulation): MPC without limits = the fixed feedback a = −K(x − x_ref). Shows the cart, p(t) with overshoot and arrival time, a(t) against a ±1 m/s² band the controller does not know about, the gain K, and two briefs (fast: by 5 s with < 5 cm overshoot; gentle: |a| < 1, < 5 cm, by 14 s). Student drags the prices q_v (speed) and r (effort) on log sliders.',
  topics: ['mpc', 'lqr', 'quadratic cost', 'weights', 'tuning', 'control'],
  params: {
    q_v: { type: 'number', min: 0.01, max: 100, default: 0.01, doc: 'price of speed q_v in Q = diag(1, q_v) (log scale 0.01–100): it damps the motion; with q_v near 0 the overshoot is about 26 cm for every r' },
    r: { type: 'number', min: 0.01, max: 100, default: 0.1, doc: 'price of effort R = r (log scale 0.01–100): larger r is slower and gentler; the first push is 6·k_p' },
    story: { type: 'enum', values: ['still', 'sweep_r'], default: 'still', doc: "'still': draw the run once; 'sweep_r': then sweep r from 0.1 up to 100, down to 0.01 and back (same shape, different pace)" },
    briefs: { type: 'boolean', default: true, doc: 'show the two briefs (A fast, B gentle) next to the run’s numbers' },
    lang: LANG_SPEC,
  },
  examples: [
    {},
    { lang: 'zh' },
    { story: 'sweep_r', briefs: false },
    { story: 'sweep_r', briefs: false, lang: 'zh' },
    { q_v: 0.32, r: 0.1, lang: 'zh' },
    { q_v: 6.3, r: 50 },
    { q_v: 100, r: 100, lang: 'zh' },
    { q_v: 0.01, r: 0.01 },
  ],
  ids: ['note', 'track', 'cart', 'p_plot', 'p_curve', 'flag_line', 'overshoot', 'arrival', 'a_plot', 'a_curve', 'limit_band', 'push_note', 'formula', 'q_v_slider', 'r_slider', 'gain', 'table'],
  scene: (p) => {
    const lang = resolve_lang(p.lang);
    const L = (en: string, zh: string) => pick(lang, en, zh);
    class Weights extends Scene {
      /** The prices (their values; the sliders move in log steps of 0.05 decades). */
      q_v = ValueTracker(snap_w(p.q_v));
      r = ValueTracker(snap_w(p.r));
      /** How much of the run is drawn [s] (the story draws it once; 20 = all). */
      t_show = ValueTracker(T_PLOT);
      sliders: StepSlider[] = [];
      /** The current run. */
      run(): WeightsRun {
        return weights_run(this.q_v.get_value(), this.r.get_value());
      }
      fast(): boolean {
        return meets_fast(this.run());
      }
      gentle(): boolean {
        return meets_gentle(this.run());
      }
      /** Subscribe to the learner's changes: f('weights', { which, q_v, r, peak, overshoot, arrival, fast, gentle }) when a drag ends. */
      listen(f: Listener): void {
        listen(this, f);
      }
      /** The report sent when a slider is released. */
      report(which: 'q_v' | 'r'): Record<string, unknown> {
        const w = this.run();
        return { which, q_v: this.q_v.get_value(), r: this.r.get_value(), peak: w.peak, overshoot: w.overshoot, arrival: w.arrival ?? 99, fast: meets_fast(w), gentle: meets_gentle(w) };
      }
      override construct() {
        const c = palette();
        const { q_v, r, t_show } = this;
        this.track(q_v, r, t_show);
        // the story draws the run once from t = 0 (set before the live parts are built)
        t_show.set_value(0);
        const key = () => `${q_v.get_value().toFixed(6)}|${r.get_value().toFixed(6)}|${t_show.get_value().toFixed(3)}`;
        const run = () => this.run();
        /** States and inputs up to the drawn time. */
        const shown = () => Math.round(Math.min(T_PLOT, t_show.get_value()) / W3.dt);
        const p_at = (t: number) => {
          const w = run(), k = Math.min(W3.steps - 1, Math.floor(t / W3.dt + 1e-9)), tau = t - k * W3.dt;
          const [p0, v0] = w.x[k];
          return p0 + v0 * tau + 0.5 * w.u[k] * tau * tau;
        };

        // ---- honest label
        const note = words(L('simulation of a toy cart; nothing in the controller limits |a|', '玩具小车的模拟；控制器里没有任何对 |a| 的限制'), 20, c.muted, -6.9, 3.62, { max_w: LEFT.x1 + 6.9 - 0.1 });
        note.name = 'note';

        // ---- the track: start at 0, the flag at 6
        const track = new Track({ x0: LEFT.x0, x1: LEFT.x1, y: 2.6, p: [0, 8], target: W3.p_ref, label_every: 2 });
        track.group.name = 'track';
        const cart = track.cart(() => p_at(Math.min(T_PLOT, t_show.get_value())));
        cart.name = 'cart';

        // ---- p(t)
        const pp = new Plot({ box: { x0: LEFT.x0, x1: LEFT.x1, y0: 0.05, y1: 1.55 }, x: [0, T_PLOT], y: [0, 7.5], y_ticks: [0, 3, 6], y_label: { tex: 'p\\;(\\mathrm{m})' }, font: 22 });
        pp.group.name = 'p_plot';
        const flag_line = VGroup(pp.hline(W3.p_ref, c.good, { width: 2.5 }), pp.note(L('flag', '旗子'), 0.3, 6.85, c.good, 20, 'left'));
        flag_line.name = 'flag_line';
        const p_curve = pp.live_curve(() => run().x.slice(0, shown() + 1).map((x, k) => [k * W3.dt, x[0]] as XY), { color: c.accent, width: 4.5 }, key);
        p_curve.name = 'p_curve';
        // the overshoot: a mark at the highest point and its size
        const t_peak = () => {
          const xs = run().x;
          let k = 0;
          for (let i = 1; i < xs.length; i++) if (xs[i][0] > xs[k][0]) k = i;
          return k * W3.dt;
        };
        const has_over = () => run().overshoot >= 0.01 && t_peak() <= Math.min(T_PLOT - 0.5, t_show.get_value());
        const over_mark = pp.live_curve(() => (has_over() ? [[t_peak() - 0.9, W3.p_ref + run().overshoot], [t_peak() + 0.9, W3.p_ref + run().overshoot]] as XY[] : []), { color: c.coral, width: 3 }, key);
        // right of the mark, and clear of the arrival line when that is close
        const over_left = () => {
          const x = pp.X(t_peak() + 0.9) + 0.1, a = run().arrival;
          return a !== null && a <= T_PLOT && Math.abs(pp.X(a) - x) < 1.1 ? Math.max(x, pp.X(a) + 0.12) : x;
        };
        const over_text = live_label(() => (has_over() ? `+${Math.round(100 * run().overshoot)} cm` : ''), 22, c.coral, (m) => m.move_to([Math.min(over_left() + m.width / 2, LEFT.x1 - m.width / 2), pp.Y(W3.p_ref + run().overshoot) + 0.24, 0]));
        const overshoot = VGroup(over_mark, over_text);
        overshoot.name = 'overshoot';
        // the arrival: within ±5 cm from then on
        const arr_t = () => run().arrival;
        const arr_vis = () => arr_t() !== null && arr_t()! <= T_PLOT && arr_t()! <= t_show.get_value() + 1e-9;
        const arr_line = pp.live_curve(() => (arr_vis() ? [[arr_t()!, 0], [arr_t()!, 7.5]] as XY[] : []), { color: c.ink, width: 2, dash: [0.1, 0.08] }, key);
        const arr_text = live_label(() => (arr_vis() ? L(`arrives ${arr_t()!.toFixed(1)} s`, `${arr_t()!.toFixed(1)} 秒到达`) : ''), 22, c.ink, (m) => {
          const x = pp.X(arr_t() ?? 0);
          m.move_to([x + 0.12 + m.width / 2 > LEFT.x1 ? x - 0.12 - m.width / 2 : x + 0.12 + m.width / 2, pp.Y(1.4), 0]);
        });
        const arrival = VGroup(arr_line, arr_text);
        arrival.name = 'arrival';

        // ---- a(t) against the motor's ±1 band
        const ap = new Plot({ box: { x0: LEFT.x0, x1: LEFT.x1, y0: -2.8, y1: -0.75 }, x: [0, T_PLOT], y: [-3, 3], y_ticks: [-3, -1, 1, 3], x_ticks: [0, 5, 10, 15, 20], x_label: { tex: 't\\;(\\mathrm{s})' }, y_label: { tex: 'a\\;(\\mathrm{m/s^2})' }, font: 22 });
        ap.group.name = 'a_plot';
        const limit_band = VGroup(ap.band(-W3.a_lim, W3.a_lim, c.good, 0.12), ap.hline(0, c.muted, { width: 1.5, dash: false }),
          ap.note(L('shaded: the motor’s real limit ±1', '阴影：电机真实的上限 ±1'), T_PLOT, -2.45, c.good, 20, 'right'));
        limit_band.name = 'limit_band';
        const a_curve = ap.live_stairs(() => run().u.slice(0, Math.max(1, shown())).map((a, k) => [k * W3.dt, a] as XY), { color: c.coral, width: 4 }, key);
        a_curve.name = 'a_curve';
        const push_note = live_label(() => (run().peak > 3 ? L(`first push ${run().peak.toFixed(1)} m/s², above the chart`, `第一下推力 ${run().peak.toFixed(1)} m/s²，超出图外`) : ''), 22, c.coral, (m) => m.move_to([ap.X(4.5) + m.width / 2, ap.Y(2.3), 0]));
        push_note.name = 'push_note';

        // ---- right: the cost, its two prices, the gain
        const formula = fit(tex('J = \\sum_k (p_k - 6)^2 + q_v\\, v_k^2 + r\\, a_k^2', 38) as any, PX1 - PX);
        formula.move_to([PX + formula.width / 2, 3.45, 0]);
        formula.name = 'formula';
        const mk_slider = (t: ValueTracker, y: number, name: string, en: string, zh: string, color: string) => {
          const s = new StepSlider(t, { lo: 0.01, hi: 100, step: 0.05, log: true, x0: PX + 0.2, x1: PX1 - 0.25, y, color, ticks: [0.01, 0.1, 1, 10, 100] });
          this.sliders.push(s);
          const cap = VGroup(tex(name, 34, color), label(L(en, zh), 24, c.muted));
          cap.submobjects[1].set_color(c.muted);
          (cap.submobjects[0] as Mobject).move_to([PX + (cap.submobjects[0] as Mobject).width / 2, y + 0.48, 0]);
          (cap.submobjects[1] as Mobject).move_to([PX + (cap.submobjects[0] as Mobject).width + 0.18 + (cap.submobjects[1] as Mobject).width / 2, y + 0.48, 0]);
          const val = live_label(() => `= ${fmt_w(t.get_value())}`, 24, color, (m) => m.move_to([PX1 - m.width / 2, y + 0.48, 0]));
          const g = VGroup(s.group, cap, val);
          return g;
        };
        const qv_s = mk_slider(q_v, 2.3, 'q_v', 'price of speed', '速度的价格', c.purple);
        qv_s.name = 'q_v_slider';
        const r_s = mk_slider(r, 1.25, 'r', 'price of effort', '用力的价格', c.coral);
        r_s.name = 'r_slider';
        const law = tex('a = -K\\,(x - x_{\\mathrm{ref}})', 32, c.ink);
        law.move_to([PX + law.width / 2, 0.55, 0]);
        const gain_val = live_label(() => {
          const K = run().K;
          return `K = [${K[0].toFixed(2)}, ${K[1].toFixed(2)}]`;
        }, 26, c.accent, (m) => m.move_to([PX + m.width / 2, 0.08, 0]));
        const gain = VGroup(law, gain_val);
        gain.name = 'gain';

        // ---- the run's numbers, and the briefs
        const COL = p.briefs ? { now: 3.98, a: 5.12, b: 6.3 } : { now: 4.6, a: 0, b: 0 };
        const rows_y = [-1.0, -1.45, -1.9];
        const head_y = -0.55;
        const t_arr = () => (run().arrival === null ? L('> 30 s', '> 30 秒') : L(`${run().arrival!.toFixed(1)} s`, `${run().arrival!.toFixed(1)} 秒`));
        const put = <T extends Mobject>(m: T, x: number, y: number, align: 'left' | 'center' = 'center'): T => {
          m.move_to([align === 'left' ? x + m.width / 2 : x, y, 0]);
          return m;
        };
        const row_names = [L('arrives', '到达'), L('overshoot', '超调'), L('peak |a|', '最大 |a|')];
        const table = VGroup(...row_names.map((s, i) => put(words(s, 22, c.muted, 0, 0), PX, rows_y[i], 'left')));
        table.add(put(words(L('this run', '这一次'), 22, c.ink, 0, 0, { weight: 'BOLD' }), COL.now, head_y));
        table.add(
          live_label(t_arr, 22, c.ink, (m) => m.move_to([COL.now, rows_y[0], 0])),
          live_label(() => `${Math.round(100 * run().overshoot)} cm`, 22, c.ink, (m) => m.move_to([COL.now, rows_y[1], 0])),
          live_label(() => run().peak.toFixed(2), 22, c.ink, (m) => m.move_to([COL.now, rows_y[2], 0])),
        );
        if (p.briefs) {
          const w = () => run();
          const arr_ok = (lim: number) => w().arrival !== null && w().arrival! <= lim + 1e-9;
          const over_ok = () => w().overshoot <= W3.over + 1e-9;
          table.add(put(fit(words(L('A fast', 'A 要快'), 22, c.ink, 0, 0, { weight: 'BOLD' }), 1.15), COL.a, head_y));
          table.add(put(fit(words(L('B gentle', 'B 要柔'), 22, c.ink, 0, 0, { weight: 'BOLD' }), 1.15), COL.b, head_y));
          // a limit of a brief, coloured by whether this run keeps it
          const cell = (s: string, x: number, y: number, good: () => boolean) => {
            const m: any = put(tex(s, 30, c.ink), x, y);
            const upd = (o: any) => {
              const k = good() ? 1 : 0;
              if (o._ok === k) return;
              o._ok = k;
              o.set_color(k ? c.good : c.coral);
            };
            upd(m);
            m.add_updater(upd);
            return m;
          };
          table.add(
            cell('\\le 5\\,\\mathrm{s}', COL.a, rows_y[0], () => arr_ok(W3.fast_by)), cell('\\le 14\\,\\mathrm{s}', COL.b, rows_y[0], () => arr_ok(W3.gentle_by)),
            cell('\\le 5\\,\\mathrm{cm}', COL.a, rows_y[1], over_ok), cell('\\le 5\\,\\mathrm{cm}', COL.b, rows_y[1], over_ok),
            cell('\\le 1', COL.b, rows_y[2], () => w().peak <= W3.a_lim + 1e-9),
          );
          const status = (x: number, met: () => boolean) => live_label(() => (met() ? L('met', '达成') : L('not yet', '未达成')), 22, () => (met() ? c.good : c.muted), (m) => m.move_to([x, -2.4, 0]), { weight: 'BOLD', max_width: 1.0 });
          table.add(put(words(L('brief', '任务'), 22, c.muted, 0, 0), PX, -2.4, 'left'), status(COL.a, () => this.fast()), status(COL.b, () => this.gentle()));
        }
        table.name = 'table';
        const hint = words(L('arrives: from then on within ±5 cm of the flag', '到达：此后一直在旗子 ±5 cm 以内'), 20, c.muted, PX, -2.95, { max_w: PX1 - PX });

        // ---- the story
        const r_end = r.get_value();
        this.play(FadeIn(note), FadeIn(track.group), FadeIn(cart), FadeIn(pp.group), FadeIn(flag_line), FadeIn(ap.group), FadeIn(limit_band), { run_time: 1.2 });
        this.play(FadeIn(formula), FadeIn(qv_s), FadeIn(r_s), FadeIn(gain), FadeIn(table), FadeIn(hint), { run_time: 1.0 });
        this.add(p_curve, a_curve, overshoot, arrival, push_note);
        this.play(UpdateFromAlphaFunc(t_show, (_m: unknown, a?: number) => t_show.set_value((a ?? 1) * T_PLOT), { run_time: 3, rate_func: linear }));
        this.wait(1);
        if (p.story === 'sweep_r') {
          const sweep = (to: number, run_time: number) => {
            const l0 = Math.log10(r.get_value()), l1 = Math.log10(to);
            this.play(UpdateFromAlphaFunc(r, (_m: unknown, a?: number) => r.set_value(10 ** (l0 + (l1 - l0) * (a ?? 1))), { run_time, rate_func: smooth }));
          };
          sweep(100, 6);
          this.wait(1.5);
          sweep(0.01, 4);
          this.wait(1);
          sweep(r_end, 1.5);
          this.wait(1.5);
        }
        this.add(VGroup(track.group, cart), pp.group, p_curve, flag_line, overshoot, arrival, ap.group, limit_band, a_curve, push_note, formula, qv_s, r_s, gain, table, hint);
        this.wait(p.story === 'sweep_r' ? 0.5 : 2);
      }
    }
    return new Weights();
  },
  explore: (scene: any, ui, p) => {
    const L = (en: string, zh: string) => pick(resolve_lang(p.lang), en, zh);
    const [qv_s, r_s] = scene.sliders as StepSlider[];
    qv_s.attach(ui as any, L('q_v: the price of speed', 'q_v：速度的价格'), { on_end: () => emit(scene, 'weights', scene.report('q_v')) });
    r_s.attach(ui as any, L('r: the price of effort', 'r：用力的价格'), { on_end: () => emit(scene, 'weights', scene.report('r')) });
  },
});
