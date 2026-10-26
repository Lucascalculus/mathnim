// M7's world: the cart parked at the flag in a steady wind its model does not
// know (disturbance.ts, story 1). Left: the cart on a zoomed track (the wind's
// direction shown, its strength not), its position p(t) against the flag with
// the plan made at t = 10 s dashed, and the push a(t) it applies, with the push
// its model plans to hold at rest, u_s = −d̂, dashed. Right: the law
// a = u_s − K (x − x_s), the readouts (where it rests, the push it holds, K_p,
// d̂) and the three controls: the position weight q, the model's disturbance d̂
// set by hand, and where d̂ comes from (by hand / estimated online). The world's
// "new wind" action changes the wind (scene.new_wind()). Simulation of the toy cart.
// Explore: every release reports 'run' (scene.report()).
import { Create, FadeIn, Scene, UpdateFromAlphaFunc, VGroup, ValueTracker, linear } from 'manim-web';
import { palette } from '../theme';
import { define_visual } from '../visual';
import { OFFSET, offset_run, type OffsetRun } from './disturbance';
import { Choice, LANG_SPEC, Plot, StepSlider, Track, emit, listen, live_label, live_vm, pick, polys_points, resolve_lang, stroke, tex, visible_when, words, type Listener, type XY } from './kit';

export interface OffsetParams extends Record<string, unknown> {
  q: number;
  dhat: number;
  estimate: boolean;
  wind: number;
  story: string;
  lang: string;
}

/** The labels of the world's controls (the lesson's `cue` uses the same words). */
export const OFFSET_LABELS = {
  q: { en: 'q: weight on the distance to the flag', zh: 'q：离旗子距离的权重' },
  dhat: { en: 'd̂: the wind in the model, set by hand', zh: 'd̂：模型里的风，手动设定' },
  source: { en: 'd̂ comes from', zh: 'd̂ 从哪来' },
};
const T_END = OFFSET.steps * OFFSET.dt; // 12 s
const RX = 2.35, RX1 = 6.9;

/** Round a hand-set d̂ onto the slider's grid. */
export const snap_dhat = (v: number): number => Math.round(Math.min(OFFSET.dhat_range[1], Math.max(OFFSET.dhat_range[0], v)) / OFFSET.dhat_step) * OFFSET.dhat_step;
/** Centimetres with a sign, as the readouts show them. */
const cm = (m: number): string => {
  const v = Math.round(m * 1000) / 10;
  return `${v > 0 ? '+' : v < 0 ? '−' : ''}${Math.abs(v).toFixed(1)} cm`;
};
const signed = (v: number, d = 2): string => `${v < -5e-4 ? '−' : ''}${Math.abs(v).toFixed(d)}`;

export const mpc_offset = define_visual<OffsetParams>({
  name: 'mpc_offset',
  summary: 'World (simulation): the cart parked at a flag in a steady wind its MPC model does not know. The nominal MPC rests short of the flag at e = (d − d̂)/K_p, while each plan (dashed) still expects to get back. Student moves the position weight q (shrinks the offset, never removes it), sets the model’s disturbance d̂ by hand (d̂ = d removes it; the cart then holds a push u_s = −d̂), or lets d̂ be estimated online (offset-free MPC, integral action); the world can change the wind.',
  topics: ['mpc', 'offset-free', 'disturbance', 'integral action', 'steady-state error', 'estimation', 'control'],
  params: {
    q: { type: 'integer', min: 0, max: OFFSET.q_stops.length - 1, default: OFFSET.q_stops.indexOf(OFFSET.q_default), doc: `index of the position weight q in Q = diag(q, 0) on the stops ${OFFSET.q_stops.join(', ')} (default 3: q = 1, K_p = 2.79)` },
    dhat: { type: 'number', min: OFFSET.dhat_range[0], max: OFFSET.dhat_range[1], default: 0, doc: 'the hand-set disturbance d̂ in the model [m/s²] (used when estimate is off); the first wind is −0.3' },
    estimate: { type: 'boolean', default: false, doc: 'estimate d̂ online from each step’s prediction error (λ = 0.2) instead of using the hand-set value' },
    wind: { type: 'integer', min: 0, max: OFFSET.winds.length - 1, default: 0, doc: `which wind blows: ${OFFSET.winds.join(', ')} m/s² (negative = headwind)` },
    story: { type: 'enum', values: ['still', 'offset'], default: 'still', doc: "'still': draw the run once; 'offset': draw the nominal run, then point at the plan that still expects to reach the flag" },
    lang: LANG_SPEC,
  },
  examples: [
    {},
    { lang: 'zh' },
    { story: 'offset' },
    { story: 'offset', lang: 'zh' },
    { q: 6 },
    { q: 0, lang: 'zh' },
    { dhat: -0.3 },
    { dhat: 0.3, lang: 'zh' },
    { estimate: true },
    { estimate: true, wind: 2, lang: 'zh' },
    { wind: 3, q: 0 },
  ],
  ids: ['note', 'track', 'cart', 'wind', 'p_plot', 'flag_line', 'p_curve', 'plan', 'a_plot', 'a_curve', 'us_line', 'law', 'readout', 'q_slider', 'dhat_slider', 'source'],
  scene: (p) => {
    const lang = resolve_lang(p.lang);
    const L = (en: string, zh: string) => pick(lang, en, zh);
    const dt = OFFSET.dt;
    class Offset extends Scene {
      qi = ValueTracker(p.q);
      dh = ValueTracker(snap_dhat(p.dhat));
      est = ValueTracker(p.estimate ? 1 : 0);
      /** How many times the wind has changed (the wind blowing is winds[n % 4]). */
      wind_n = ValueTracker(p.wind);
      t_show = ValueTracker(T_END);
      q_slider!: StepSlider;
      d_slider!: StepSlider;
      choice!: Choice;
      q(): number {
        return OFFSET.q_stops[Math.round(this.qi.get_value())];
      }
      wind(): number {
        return OFFSET.winds[Math.round(this.wind_n.get_value()) % OFFSET.winds.length];
      }
      estimating(): boolean {
        return this.est.get_value() > 0.5;
      }
      run(): OffsetRun {
        return offset_run(this.q(), this.estimating(), { d: this.wind(), dhat: snap_dhat(this.dh.get_value()) });
      }
      /** Does the cart rest on the flag (within 5 mm, at rest)? */
      at_flag(): boolean {
        const r = this.run();
        return Math.abs(r.offset) < OFFSET.tol && Math.abs(r.x[OFFSET.steps][1]) < 1e-3;
      }
      /** The world's action: another wind (the learner is not told its strength). */
      new_wind(): void {
        this.wind_n.set_value(Math.round(this.wind_n.get_value()) + 1);
        emit(this, 'run', { ...this.report(), which: 'wind' });
      }
      /** What the current setting does (for the lesson's goals and detectors). */
      report(): Record<string, unknown> {
        const r = this.run();
        return { q: this.q(), estimate: this.estimating(), dhat: snap_dhat(this.dh.get_value()), wind_changes: Math.round(this.wind_n.get_value()), d: this.wind(), offset: r.offset, Kp: r.Kp, at_flag: this.at_flag() };
      }
      listen(f: Listener): void {
        listen(this, f);
      }
      override construct() {
        const c = palette();
        const { qi, dh, est, wind_n, t_show } = this;
        this.track(qi, dh, est, wind_n, t_show);
        const key = () => `${qi.get_value()}|${snap_dhat(dh.get_value()).toFixed(2)}|${est.get_value()}|${wind_n.get_value()}`;
        const key_t = () => `${key()}|${t_show.get_value().toFixed(3)}`;
        const R = () => this.run();
        const shown = () => Math.round(Math.min(T_END, t_show.get_value()) / dt);
        const p_at = (t: number) => {
          const r = R(), k = Math.min(OFFSET.steps - 1, Math.floor(t / dt + 1e-9)), tau = t - k * dt;
          const [p0, v0] = r.x[k], a = r.u[k] + r.d[k];
          return p0 + v0 * tau + 0.5 * a * tau * tau;
        };

        // ---- honest label
        const note = words(L('simulation of a toy cart; the wind is a steady push the model is not told about', '玩具小车的模拟；风是一股恒定的推力，模型并不知道'), 20, c.muted, -6.9, 3.62, { max_w: 13.8 });
        note.name = 'note';

        // ---- the track, zoomed around the flag
        const LX0 = -5.9, LX1 = 1.6;
        const track = new Track({ x0: LX0, x1: LX1, y: 2.3, p: [5.4, 6.4], tick: 0.1, label_every: 5, target: OFFSET.p_ref, cart_w: 0.8, cart_h: 0.36 });
        track.group.name = 'track';
        const cart = track.cart(() => Math.max(5.45, Math.min(6.4, p_at(Math.min(T_END, t_show.get_value())))));
        cart.name = 'cart';
        // the wind: three arrows ahead of the cart, pointing the way it pushes (strength not shown)
        const wind_arrows = live_vm(stroke(c.purple, 3.5), () => {
          const s = Math.sign(this.wind()), x = track.x_of(6.4) - 0.15, polys: XY[][] = [];
          for (const [dy, dx] of [[0.85, 0], [0.55, 0.25], [0.25, 0]] as const) {
            const y = 2.3 + dy, x1 = x - dx, x0 = x1 - 0.85;
            const [tail, head] = s < 0 ? [x1, x0] : [x0, x1];
            polys.push([[tail, y], [head, y]], [[head + 0.16 * (s < 0 ? 1 : -1), y + 0.11], [head, y], [head + 0.16 * (s < 0 ? 1 : -1), y - 0.11]]);
          }
          return polys_points(polys);
        }, () => `${Math.sign(this.wind())}`);
        const wind_word = live_label(() => (this.wind() < 0 ? L('headwind, strength unknown', '逆风，大小未知') : L('tailwind, strength unknown', '顺风，大小未知')), 20, c.purple, (m) => m.move_to([track.x_of(6.4) - 1.2 - m.width / 2, 3.25, 0]));
        const wind = VGroup(wind_arrows, wind_word);
        wind.name = 'wind';

        // ---- p(t)
        const pp = new Plot({ box: { x0: LX0, x1: LX1, y0: -0.2, y1: 1.4 }, x: [0, T_END], y: [5.45, 6.3], y_ticks: [5.5, 6], y_label: { tex: 'p\\;(\\mathrm{m})' }, font: 22 });
        pp.group.name = 'p_plot';
        const flag_line = VGroup(pp.hline(OFFSET.p_ref, c.good, { width: 2.5 }), pp.note(L('flag', '旗子'), 0.2, 6.17, c.good, 20, 'left'));
        flag_line.name = 'flag_line';
        const p_curve = pp.live_curve(() => R().x.slice(0, shown() + 1).map((x, k) => [k * dt, x[0]] as XY), { color: c.accent, width: 4.5 }, key_t);
        p_curve.name = 'p_curve';
        const kp = OFFSET.k_plan;
        const plan_curve = pp.live_curve(() => R().plan_p[kp].map((v, j) => [(kp + j) * dt, v] as XY), { color: c.accent, width: 3.5, dash: [0.12, 0.08] }, key);
        const plan_dot = pp.live_dot(() => [kp * dt, R().x[kp][0]], c.ink, 0.07);
        const plan_word = words(L('dashed: the plan made at t = 10 s', '虚线：t = 10 s 时做的计划'), 20, c.accent, pp.X(T_END), pp.Y(6.22), { align: 'right' });
        const plan = VGroup(plan_curve, plan_dot, plan_word);
        plan.name = 'plan';

        // ---- a(t) and the push the model plans to hold at rest
        const ap = new Plot({ box: { x0: LX0, x1: LX1, y0: -2.85, y1: -1.15 }, x: [0, T_END], y: [-0.7, 0.7], y_ticks: [-0.5, 0, 0.5], x_ticks: [0, 2, 4, 6, 8, 10, 12], x_label: { tex: 't\\;(\\mathrm{s})' }, y_label: { tex: 'a\\;(\\mathrm{m/s^2})' }, font: 22 });
        ap.group.name = 'a_plot';
        const a_curve = ap.live_stairs(() => R().u.slice(0, Math.max(1, shown())).map((u, k) => [k * dt, u] as XY), { color: c.coral, width: 4 }, key_t);
        a_curve.name = 'a_curve';
        const us_curve = ap.live_curve(() => R().dhat.slice(0, shown() + 1).map((v, k) => [k * dt, -v] as XY), { color: c.purple, width: 3, dash: [0.1, 0.07] }, key_t);
        const us_tex = tex('u_s = -\\hat d', 24, c.purple);
        us_tex.move_to([ap.X(T_END) - us_tex.width / 2, -0.8, 0]);
        const us_word = VGroup(us_tex, words(L('dashed: the push its model plans to hold at rest,', '虚线：模型打算停住时保持的推力'), 20, c.purple, ap.X(T_END) - us_tex.width - 0.12, -0.8, { align: 'right', max_w: LX1 - LX0 - 2.8 }));
        const us_line = VGroup(us_curve, us_word);
        us_line.name = 'us_line';

        // ---- right: the law and the readouts
        const law = VGroup(tex('a = u_s - K\\,(x - x_s)', 32, c.ink), tex('u_s = -\\hat d', 28, c.purple), tex('e = \\frac{d - \\hat d}{K_p}', 28, c.ink));
        law.submobjects[0].move_to([RX + law.submobjects[0].width / 2, 3.05, 0]);
        law.submobjects[1].move_to([RX + law.submobjects[1].width / 2, 2.45, 0]);
        law.submobjects[2].move_to([RX + 2.3 + law.submobjects[2].width / 2, 2.45, 0]);
        law.name = 'law';
        const rest = live_label(() => (this.at_flag() ? L('rests on the flag', '停在旗子上') : L(`rests ${cm(R().offset)} from the flag`, `停在离旗子 ${cm(R().offset)} 处`)), 26, () => (this.at_flag() ? c.good : c.coral), (m) => m.move_to([RX + m.width / 2, 1.8, 0]), { weight: 'BOLD', max_width: RX1 - RX });
        const holds = live_label(() => L(`holds a push of ${signed(R().u_end)} m/s²`, `保持推力 ${signed(R().u_end)} m/s²`), 22, c.coral, (m) => m.move_to([RX + m.width / 2, 1.38, 0]), { max_width: RX1 - RX });
        const kp_sym = tex('K_p =', 26, c.ink);
        kp_sym.move_to([RX + kp_sym.width / 2, 0.92, 0]);
        const kp_val = live_label(() => R().Kp.toFixed(2), 22, c.ink, (m) => m.move_to([RX + kp_sym.width + 0.12 + m.width / 2, 0.92, 0]));
        const dh_sym = tex('\\hat d =', 26, c.purple);
        dh_sym.move_to([RX + 2.0 + dh_sym.width / 2, 0.92, 0]);
        const dh_val = live_label(() => (this.estimating() ? L(`${signed(R().dhat[OFFSET.steps])} (estimated)`, `${signed(R().dhat[OFFSET.steps])}（估计值）`) : signed(snap_dhat(dh.get_value()))), 22, c.purple, (m) => m.move_to([RX + 2.0 + dh_sym.width + 0.12 + m.width / 2, 0.92, 0]), { max_width: RX1 - RX - 2.0 - dh_sym.width - 0.12 });
        const readout = VGroup(rest, holds, kp_sym, kp_val, dh_sym, dh_val);
        readout.name = 'readout';

        // ---- the controls
        const q_slider = new StepSlider(qi, { lo: 0, hi: OFFSET.q_stops.length - 1, step: 1, x0: RX + 0.2, x1: RX1 - 0.25, y: -0.05, color: c.accent, ticks: OFFSET.q_stops.map((_, i) => i) });
        this.q_slider = q_slider;
        const q_sym = tex('q', 28, c.accent);
        q_sym.move_to([RX + q_sym.width / 2, 0.42, 0]);
        const q_cap = VGroup(q_sym, words(L('weight on the distance to the flag', '离旗子距离的权重'), 22, c.muted, RX + q_sym.width + 0.15, 0.42, { max_w: 3.3 }));
        const q_val = live_label(() => `${this.q()}`, 24, c.accent, (m) => m.move_to([RX1 - m.width / 2, 0.42, 0]));
        const q_group = VGroup(q_slider.group, q_cap, q_val);
        q_group.name = 'q_slider';
        const d_slider = new StepSlider(dh, { lo: OFFSET.dhat_range[0], hi: OFFSET.dhat_range[1], step: OFFSET.dhat_step, x0: RX + 0.2, x1: RX1 - 0.25, y: -1.35, color: c.purple, ticks: [-0.6, -0.3, 0, 0.3, 0.6] });
        this.d_slider = d_slider;
        const d_ticks = VGroup(...[-0.6, 0, 0.6].map((v) => {
          const t = tex(v === 0 ? '0' : `${v < 0 ? '-' : '+'}${Math.abs(v)}`, 20, c.muted);
          t.move_to([d_slider.x_of(v), -1.68, 0]);
          return t;
        }));
        const d_sym = tex('\\hat d', 28, c.purple);
        d_sym.move_to([RX + d_sym.width / 2, -0.88, 0]);
        const d_cap = VGroup(d_sym, words(L('the wind in the model, set by hand', '模型里的风，手动设定'), 22, c.muted, RX + d_sym.width + 0.15, -0.88, { max_w: 3.25 }));
        const d_val = live_label(() => (this.estimating() ? '' : signed(snap_dhat(dh.get_value()))), 24, c.purple, (m) => m.move_to([RX1 - m.width / 2, -0.88, 0]));
        const d_group = VGroup(visible_when(VGroup(d_slider.group, d_ticks), () => !this.estimating(), 1), visible_when(VGroup(d_slider.group.copy()), () => this.estimating(), 0.25), d_cap, d_val);
        d_group.name = 'dhat_slider';
        const choice = new Choice({ tracker: est, values: [0, 1], labels: [L('by hand', '手动设定'), L('estimated online', '在线估计')], x0: RX, x1: RX1, y: -2.65 });
        this.choice = choice;
        const s_sym = tex('\\hat d', 28, c.purple);
        s_sym.move_to([RX + s_sym.width / 2, -2.17, 0]);
        const s_cap = VGroup(s_sym, words(L('comes from', '从哪来'), 22, c.muted, RX + s_sym.width + 0.15, -2.17));
        const s_note = live_label(() => (this.estimating() ? L('each step: estimate += 0.2 × (the acceleration the model missed)', '每一步：估计值 += 0.2 ×（模型没算到的加速度）') : ''), 20, c.muted, (m) => m.move_to([RX + m.width / 2, -3.2, 0]), { max_width: RX1 - RX });
        const source = VGroup(choice, s_cap, s_note);
        source.name = 'source';

        // ---- the story
        t_show.set_value(0);
        this.play(FadeIn(note), FadeIn(track.group), FadeIn(cart), FadeIn(wind), FadeIn(pp.group), FadeIn(flag_line), FadeIn(ap.group), { run_time: 1.1 });
        this.play(FadeIn(law), FadeIn(readout), FadeIn(q_group), FadeIn(d_group), FadeIn(source), { run_time: 0.9 });
        this.add(p_curve, a_curve, us_line);
        this.play(UpdateFromAlphaFunc(t_show, (_m: unknown, a?: number) => t_show.set_value((a ?? 1) * T_END), { run_time: p.story === 'offset' ? 5 : 2.5, rate_func: linear }));
        if (p.story === 'offset') this.wait(1);
        this.play(Create(plan_curve), FadeIn(plan_dot), FadeIn(plan_word), { run_time: 1.2 });
        this.wait(p.story === 'offset' ? 2.5 : 1);
        this.add(plan);
      }
    }
    return new Offset();
  },
  explore: (scene: any, ui, p) => {
    const lang = resolve_lang(p.lang);
    const report = (which: string) => () => emit(scene, 'run', { ...scene.report(), which });
    scene.q_slider.attach(ui, pick(lang, OFFSET_LABELS.q.en, OFFSET_LABELS.q.zh), { on_end: report('q') });
    scene.d_slider.attach(ui, pick(lang, OFFSET_LABELS.dhat.en, OFFSET_LABELS.dhat.zh), { on_end: report('dhat') });
    scene.choice.attach(ui, pick(lang, OFFSET_LABELS.source.en, OFFSET_LABELS.source.zh), () => report('source')());
  },
});
