// A pendulum that is integrated, not scripted (the physics stress test, docs/design/PHYSICS-STRESS.md). The bob is
// pulled out to a release angle and let go; the engine's Sim integrates θ'' = −(g/L) sin θ (and its small-angle model
// θ'' = −(g/L) θ, the dashed ghost) with velocity Verlet, so a seek, a replay and the doctor all see the same swing.
// Beside it: the angle against time (a sweep that starts again every 10 s) and where the energy is (potential and
// kinetic, their sum the release's). In explore the swing goes on; the learner catches the bob, pulls it to another
// angle and lets go. `strobe`: exposures of the bob at equal times, as on Marey's plates (close where it is slow).
// The physics is pendulum.ts (tested); this file only draws it.
import {
  Dots, Figure, Marker, Path, Region, Sim, beat, column, derive, over, reveal, row, run, set, t, type XY,
} from '@mathnim/engine';
import { define_figure } from '../visual';
import { LANG_SPEC, figure_lang } from '../mpc/kit';
import * as PD from './pendulum';

export interface PendulumParams extends Record<string, unknown> {
  release: number;
  damping: number;
  strobe: boolean;
  lang: string;
}

const RAD = Math.PI / 180;
/** The sweep of the angle trace (s). */
const SWEEP = 10;
/** The scripted run (s): 2304 steps, a whole number of frames. */
const RUN = 9.6;
const deg = (r: number) => r / RAD;
const f1 = (v: number) => v.toFixed(1), f2 = (v: number) => v.toFixed(2);

/** What the checks found (and the doc quotes): kept per release so the lint does not integrate the same minute again. */
const checked = new Map<string, { drift: number; drift_small: number; replay: boolean; period: number | null; exact: number }>();
export function pendulum_checks(th0: number, damping: number): { drift: number; drift_small: number; replay: boolean; period: number | null; exact: number } {
  const key = `${th0}|${damping}`;
  const hit = checked.get(key);
  if (hit) return hit;
  const make = () => new Sim(PD.pendulum_spec(() => ({ th0, damping })));
  // a minute, every step: the energy of each pendulum against its start
  const probe = make(), s = probe.series(0, 60), E0 = PD.kinetic(0) + PD.potential(th0), Es0 = PD.potential_small(th0);
  let drift = 0, drift_small = 0;
  for (const x of s) {
    drift = Math.max(drift, Math.abs(PD.kinetic(x.y[2]) + PD.potential(x.y[0]) - E0) / (E0 || 1));
    drift_small = Math.max(drift_small, Math.abs(PD.kinetic(x.y[3]) + PD.potential_small(x.y[1]) - Es0) / (Es0 || 1));
  }
  // played a frame at a time, then seeked back and forward, against a fresh run sent straight to the moment
  const a = make();
  for (let f = 0; f <= 60 * 20; f++) a.clock.set(f / 60, true), a.state.peek();
  const played = [...a.state.peek()];
  a.clock.set(5, true);
  a.state.peek();
  a.clock.set(20, true);
  const replay = played.every((v, i) => v === a.state.peek()[i]) && played.every((v, i) => v === make().at(20)[i]);
  const period = PD.measured_period(s.map((x) => x.t), s.map((x) => x.y[0]));
  const out = { drift, drift_small, replay, period, exact: PD.period(th0) };
  checked.set(key, out);
  return out;
}

export function pendulum_figure(p: PendulumParams): Figure {
  const lang = figure_lang(p.lang);
  const L = (en: string, zh: string) => (lang === 'zh' ? zh : en);
  const fig = new Figure({ lang });
  const release = Math.max(-175, Math.min(175, p.release)) * RAD, damping = Math.max(0, p.damping);

  // ---- state: the angle it is let go at (the hand sets it; the script pulls the bob out to it), and the run
  const th0 = fig.param('th0', 0.0001, { range: [-175 * RAD, 175 * RAD], doc: 'the release angle (rad)', says: t('the release angle', '释放角') });
  const sim = fig.sim(PD.pendulum_spec(() => ({ th0: th0.value, damping })));
  const S = derive(() => sim.state.value, 'the swing');
  const at = (th: number): XY => [PD.L * Math.sin(th), -PD.L * Math.cos(th)];
  const bob_xy = () => at(S.value[0]);

  // ---- the pendulum
  const stage = fig.plot({ id: 'stage', x: [-1.22, 1.22], y: [-1.22, 1.22], aspect: 'equal', axes: 'none', grid: false, priority: 2, says: t('a pendulum, 1 m long', '一个 1 米长的单摆') });
  const swing = stage.add(new Path(() => {
    const a = Math.abs(th0.value), n = 48;
    return a < 1e-3 ? [] : Array.from({ length: n + 1 }, (_, k) => at(-a + (2 * a * k) / n));
  }, { id: 'swing', role: 'scaffold', says: t('the arc the bob swings on', '摆锤走过的弧') }));
  // (Marey's plate: the bob a tenth of a second apart over the last second, the oldest faintest; close where it is slow)
  const exposures = derive(() => {
    if (!p.strobe) return [] as Float64Array[];
    const c = sim.clock.value;
    sim.state.value;
    return c <= 0 ? [] : sim.series(Math.max(0, c - 1), c, 0.1).slice(0, -1).map((x) => x.y);
  }, 'exposures');
  const strobe_rods = stage.add(new Path(() => exposures.value.map((y) => [[0, 0], at(y[0])] as XY[]), { id: 'strobe_rods', role: 'ghost:bob' }));
  const strobe_bobs = stage.add(new Dots(() => exposures.value.map((y) => at(y[0])), { id: 'strobe_bobs', role: 'noun:bob', r: 7, style: { fill_alpha: 0.16 }, says: t('the bob every tenth of a second', '每 0.1 秒拍下的摆锤') }));
  const model_rod = stage.add(new Path(() => [[0, 0], at(S.value[1])], { id: 'model_rod', role: 'predicted:small-angle', z: 2.2 }));
  const model_bob = stage.add(new Marker(() => at(S.value[1]), { id: 'model_bob', role: 'guess:small-angle', shape: 'ring', r: 11, z: 2.6, says: t('the small-angle model: sin θ taken as θ', '小角度模型：把 sin θ 当成 θ') }));
  const rod = stage.add(new Path(() => [[0, 0], bob_xy()], { id: 'rod', role: 'noun:bob', z: 2.4 }));
  const pivot = stage.add(new Marker([0, 0], { id: 'pivot', role: 'noun:bob', r: 4, says: t('the pivot', '悬点') }));
  const bob = stage.add(new Marker(bob_xy, { id: 'bob', role: 'noun:bob', r: 12, z: 3, says: t('the bob, 1 kg', '摆锤，1 千克') }));
  const hand = fig.handle(stage, th0, null, {
    id: 'bob_handle', says: t('the bob: pull it out and let go', '摆锤：拉开再松手'),
    to: (d) => [Math.atan2(d[0], -d[1])], at: () => stage.P(bob_xy()),
    on_end: () => {
      const a = th0.peek();
      fig.tell({ kind: 'state', text: L(`released at ${f1(deg(a))}°: the period is ${f2(PD.period(a))} s, the small-angle model says ${f2(PD.T0)} s`, `从 ${f1(deg(a))}° 松手：周期 ${f2(PD.period(a))} 秒，小角度模型给出 ${f2(PD.T0)} 秒`) });
    },
  });
  sim.hold_with(hand);

  // ---- the angle against time: a sweep that starts again every SWEEP seconds
  const trace = fig.plot({
    id: 'trace', x: [0, SWEEP], y: [-180, 180], x_ticks: [0, 2, 4, 6, 8, 10], y_ticks: [-180, -90, 0, 90, 180],
    x_label: 't\\ (\\mathrm{s})', y_label: '\\theta\\ (^\\circ)', aspect: 2.6, phone_aspect: 2.2,
    says: t('the angle over time', '角度随时间的变化'),
  });
  const sweep = derive(() => {
    const c = sim.clock.value, k0 = Math.floor(c / SWEEP + 1e-9) * SWEEP;
    sim.state.value;
    return c <= 0 ? [] : sim.series(k0, c, 1 / 60).map((x) => ({ t: x.t - k0, y: x.y }));
  }, 'the sweep');
  const trace_model = trace.add(new Path(() => sweep.value.map((x): XY => [x.t, deg(x.y[1])]), { id: 'trace_model', role: 'predicted:small-angle', says: t('the small-angle model', '小角度模型') }));
  const trace_real = trace.add(new Path(() => sweep.value.map((x): XY => [x.t, deg(x.y[0])]), { id: 'trace_real', role: 'noun:bob', says: t('the pendulum', '单摆') }));
  const now = trace.add(new Marker(() => {
    const w = sweep.value;
    return w.length ? [w[w.length - 1].t, deg(w[w.length - 1].y[0])] : null;
  }, { id: 'now', role: 'noun:bob', r: 4.5 }));

  // ---- the energy: one bar as long as the release's energy, the potential part and the kinetic part
  const E0 = () => PD.potential(th0.value);
  const pe = derive(() => PD.potential(S.value[0])), ke = derive(() => PD.kinetic(S.value[2]));
  const bar = fig.plot({ id: 'energy', x: [0, 1], y: [0, 1], axes: 'none', grid: false, aspect: 12, max_aspect: 0.1, says: t('where the energy is', '能量在哪里') });
  const share = (v: number) => (E0() > 1e-9 ? Math.min(1.02, v / E0()) : 0);
  const rect = (a: number, b: number): XY[] => (b - a < 1e-6 ? [] : [[a, 0.12], [b, 0.12], [b, 0.88], [a, 0.88]]);
  const whole = bar.add(new Path(() => (E0() > 1e-9 ? [[0, 0.06], [1, 0.06], [1, 0.94], [0, 0.94]] : []), { id: 'energy_whole', role: 'ghost:energy', closed: true, says: t('the energy at the release', '松手时的能量') }));
  const pe_bar = bar.add(new Region(() => rect(0, share(pe.value)), { id: 'pe_bar', role: 'region:potential', edge: false, style: { fill_alpha: 0.5 }, says: t('potential energy', '势能') }));
  const ke_bar = bar.add(new Region(() => rect(share(pe.value), share(pe.value) + share(ke.value)), { id: 'ke_bar', role: 'region:kinetic', edge: false, style: { fill_alpha: 0.5 }, says: t('kinetic energy', '动能') }));
  const pe_word = fig.readout([{ text: t('potential', '势能') }, { gap: 0.3 }, { value: () => pe.value, decimals: 2, template: '00.00' }, { gap: 0.15 }, { text: 'J' }], { id: 'pe_value', role: 'noun:potential', kind: 'caption' });
  const ke_word = fig.readout([{ text: t('kinetic', '动能') }, { gap: 0.3 }, { value: () => ke.value, decimals: 2, template: '00.00' }, { gap: 0.15 }, { text: 'J' }], { id: 'ke_value', role: 'noun:kinetic', kind: 'caption' });

  // ---- the numbers: the release, the period it swings with, and the one the small-angle model predicts
  // (live numbers as value parts: a number inside TeX is typeset again each time it changes, ~1.5 ms a frame)
  const release_word = fig.readout([{ tex: '\\theta_0 =' }, { value: () => deg(th0.value), decimals: 1, template: '−000.0' }, { tex: '^\\circ' }], { id: 'release', kind: 'caption' });
  const period_word = fig.readout([{ tex: 'T =' }, { value: () => PD.period(th0.value), decimals: 2, template: '0.00' }, { tex: '\\mathrm{s}' }], { id: 'period', role: 'noun:bob', kind: 'caption', says: t('the period at this release', '这个释放角下的周期') });
  const t0_word = fig.readout([{ tex: '2\\pi\\sqrt{L/g} =' }, { gap: 0.2 }, { tex: `${f2(PD.T0)}\\ \\mathrm{s}` }], { id: 'period_model', role: 'noun:small-angle', kind: 'caption', says: t('the small-angle period', '小角度周期') });

  const numbers = column([row([release_word, period_word], { gap: 18, phone: 'row' }), t0_word], { gap: 2 });
  const energy = column([bar, row([pe_word, ke_word], { gap: 18, phone: 'row' })], { gap: 4 });
  fig.layout(row([stage, column([trace, energy, numbers], { gap: 12 })], { weights: [1.1, 1], gap: 22 }), {
    phone: column([stage, trace, energy, column([release_word, row([period_word, t0_word], { gap: 14, phone: 'row' })], { gap: 2 })], { gap: 10 }),
  });

  // ---- checks: energy kept, the run deterministic, the period the exact one
  fig.check('energy drifts under 0.1 % over 60 simulated seconds (no damping)', () => {
    if (damping > 0) return null;
    const c = pendulum_checks(th0.peek(), 0);
    return c.drift < 1e-3 && c.drift_small < 1e-3 ? null : `drift ${(c.drift * 100).toFixed(3)} % (model ${(c.drift_small * 100).toFixed(3)} %)`;
  });
  fig.check('the same release gives the same trajectory, played, seeked or replayed', () => (pendulum_checks(th0.peek(), damping).replay ? null : 'a seek and a replay disagree'));
  fig.check('the measured period is the exact one (within 0.1 %)', () => {
    if (damping > 0 || Math.abs(th0.peek()) < 1 * RAD) return null;
    const c = pendulum_checks(th0.peek(), 0);
    return c.period !== null && Math.abs(c.period - c.exact) / c.exact < 1e-3 ? null : `measured ${c.period}, exact ${c.exact}`;
  });
  fig.report_with(() => ({ release_deg: deg(th0.peek()), damping, time: sim.clock.peek(), angle_deg: deg(sim.state.peek()[0]), period: PD.period(th0.peek()), small_angle_period: PD.T0 }));

  // ---- the script: the scene, the bob pulled out to the release, then let go for RUN seconds
  fig.script(
    over(0.7, reveal(stage, pivot, rod, bob, model_rod, model_bob, swing, strobe_rods, strobe_bobs, trace, trace_real, trace_model, now, bar, whole, pe_bar, ke_bar, pe_word, ke_word, release_word, period_word, t0_word)),
    set(th0, release, 'travel'),
    beat(),
    run(sim, RUN),
  );
  return fig;
}

export const phys_pendulum = define_figure<PendulumParams>({
  name: 'phys_pendulum',
  summary: 'A pendulum integrated with velocity Verlet (θ″ = −(g/L) sin θ), beside its small-angle model (θ″ = −(g/L) θ), released from an angle: the angle against time, where the energy is (potential and kinetic), the exact period beside 2π√(L/g). In explore the learner catches the swinging bob, pulls it to an angle and lets go; at large angles the real one falls behind the model.',
  topics: ['pendulum', 'simple harmonic motion', 'small-angle approximation', 'period', 'energy conservation', 'numerical integration'],
  params: {
    release: { type: 'number', min: -175, max: 175, default: 120, doc: 'the release angle in degrees (from straight down)' },
    damping: { type: 'number', min: 0, max: 2, default: 0, doc: 'a damping rate c in θ″ = −(g/L) sin θ − c θ′ (1/s); 0: none' },
    strobe: { type: 'boolean', default: false, doc: 'exposures of the bob every 0.1 s over the last second (as on Marey’s chronophotographs)' },
    lang: LANG_SPEC,
  },
  examples: [{}, { lang: 'zh' }, { release: 20 }, { release: 170, strobe: true }, { release: 90, damping: 0.4, lang: 'zh' }],
  ids: ['stage', 'bob', 'rod', 'model_bob', 'trace', 'trace_real', 'trace_model', 'energy', 'pe_bar', 'ke_bar', 'period', 'period_model'],
  figure: pendulum_figure,
  // the swing goes on from where the script left it; the learner may catch it
  explore: (fig) => fig.sims[0]?.play(),
});
