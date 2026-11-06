// A ball thrown, with time as matter (the engine's Trail): the path it walked, ghosts of it every tenth of a second,
// and the path ahead dashed. The ghosts say what the equations say without a number: across, they are evenly spaced
// (nothing pushes sideways, so the horizontal speed stays); up, they close together toward the top and open out on
// the way down (gravity takes the same 0.98 m/s off the vertical speed every tenth of a second). The last tenth of a
// second is drawn as its two legs, Δx in one colour and Δy in another, with their numbers beside: Δx never changes,
// Δy shrinks to nothing at the top (ticked) and grows again, downward. The motion is integrated (the engine's Sim,
// velocity Verlet, exact for a constant force); in explore the learner drags the aim and lets go to throw again.
import { Arrow, Figure, Gap, Marker, Path, Trail, beat, column, derive, guess, reveal, row, run, t, wait, type Thing, type XY } from '@mathnim/engine';
import { define_figure } from '../visual';
import { LANG_SPEC, figure_lang } from '../mpc/kit';

export interface ThrowParams extends Record<string, unknown> {
  speed: number;
  angle: number;
  predict: boolean;
  lang: string;
}

const G = 9.81, EVERY = 0.1, AIM = 0.25, MAX_SPEED = 8;
const RAD = Math.PI / 180;
/** The flight time of a throw from the ground with vertical speed vy (s). */
const flight = (vy: number) => Math.max(0, (2 * vy) / G);
const f2 = (v: number) => v.toFixed(2);

export function throw_figure(p: Partial<ThrowParams> = {}): Figure {
  const lang = figure_lang(p.lang);
  const L = (en: string, zh: string) => (lang === 'zh' ? zh : en);
  const fig = new Figure({ lang });
  const speed = Math.max(1, Math.min(MAX_SPEED, p.speed ?? 7)), angle = Math.max(10, Math.min(85, p.angle ?? 60)) * RAD;

  // ---- state: the velocity it is thrown with (the hand sets it), and the flight
  const sp = fig.param('speed', speed, { range: [1, MAX_SPEED], doc: 'the speed thrown with (m/s)', says: t('the speed of the throw', '抛出的速率') });
  const ang = fig.param('angle', angle, { range: [10 * RAD, 85 * RAD], doc: 'the angle thrown at (rad)', says: t('the angle of the throw', '抛出的角度') });
  const vx = derive(() => sp.value * Math.cos(ang.value), 'the horizontal speed'), vy = derive(() => sp.value * Math.sin(ang.value), 'the vertical speed');
  const sim = fig.sim({
    id: 'throw', inputs: () => ({ vx: vx.value, vy: vy.value }), start: (i) => [0, 0, i.vx, i.vy], dt: 1 / 240, max_t: 2 * MAX_SPEED / G + 0.5,
    accel: (_q, _v, _t, _i, a) => { a[0] = 0; a[1] = -G; },
  });
  const T = derive(() => flight(vy.value), 'the flight time');
  // (the ball lands and stays: what is shown stops at the landing, the clock may run on)
  const shown = derive(() => Math.min(sim.clock.value, T.value), 'the time shown');
  const S = derive(() => (sim.clock.value <= T.value ? sim.state.value : sim.at(T.value)), 'the ball');
  const ball_xy = (): XY => [S.value[0], Math.max(0, S.value[1])];
  const pos = (tt: number): XY => [vx.value * tt, vy.value * tt - 0.5 * G * tt * tt];

  // ---- the world: the ground, the throw, the ball
  // (the window fits the throw it is made with, with room; a throw the hand aims is kept inside it)
  const range0 = (speed * speed * Math.sin(2 * angle)) / G, top0 = (speed * Math.sin(angle)) ** 2 / (2 * G);
  const X1 = Math.max(3, range0 * 1.3 + 0.4), Y1 = Math.max(1.6, top0 * 1.45 + 0.35, (X1 + 0.6) * 0.3);
  const stage = fig.plot({ id: 'stage', x: [-0.6, X1], y: [p.predict ? -0.85 : -0.4, Y1], aspect: 'equal', axes: 'none', grid: false, priority: 2, says: t('a ball thrown from the ground', '从地面抛出的球') });
  const ground = stage.add(new Path([[-0.6, 0], [X1, 0]], { id: 'ground', role: 'scaffold', says: t('the ground', '地面') }));
  const trail = stage.add(new Trail({ sim, xy: (y) => [y[0], y[1]] }, {
    id: 'trail', role: 'noun:ball', at: shown, every: EVERY, ahead: 0.35, until: T, r: 5,
    ticks: () => [T.value / 2, T.value],
    says: t('where the ball was every 0.1 s, and where it is going', '球每 0.1 秒所在的位置，以及它接下来的去向'),
  }));
  // the last tenth of a second, as its two legs: across, then up (or down)
  const legs = derive(() => {
    const k = Math.floor(shown.value / EVERY + 1e-9);
    if (k < 1) return null;
    const a = pos((k - 1) * EVERY), b = pos(k * EVERY);
    return { a, b, corner: [b[0], a[1]] as XY };
  }, 'the last tenth of a second');
  const leg_x = stage.add(new Path(() => (legs.value ? [legs.value.a, legs.value.corner] : []), { id: 'leg_x', role: 'noun:horizontal', width: 2.4, says: t('how far it went across in that tenth of a second', '这 0.1 秒里横向走了多远') }));
  const leg_y = stage.add(new Path(() => (legs.value ? [legs.value.corner, legs.value.b] : []), { id: 'leg_y', role: 'noun:vertical', width: 2.4, says: t('how far it went up or down in that tenth of a second', '这 0.1 秒里竖直走了多远') }));
  const aim = stage.add(new Arrow([0, 0], () => [vx.value * AIM, vy.value * AIM], { id: 'aim', role: 'noun:ball', width: 2, says: t('the throw: its velocity (where it would be in a quarter of a second without gravity)', '抛出的速度（没有重力时，0.25 秒后球会在哪里）') }));
  const ball = stage.add(new Marker(ball_xy, { id: 'ball', role: 'noun:ball', r: 9, z: 3, says: t('the ball', '球') }));
  // (predict: the throw is the figure's, the hand guesses where it lands instead of aiming)
  const hand = p.predict ? null : fig.handle(stage, sp, ang, {
    id: 'aim_handle', says: t('the throw: drag to aim, let go to throw', '抛出：拖动瞄准，松手抛出'),
    // (the tip of the arrow is the velocity times AIM)
    to: (d) => {
      const a = Math.max(10 * RAD, Math.min(85 * RAD, Math.atan2(d[1], d[0])));
      // (as fast as the hand says, but no faster than lands inside the window and tops out under its edge)
      const fit = Math.min(Math.sqrt(((X1 - 0.3) * G) / Math.max(1e-6, Math.sin(2 * a))), Math.sqrt((2 * G * (Y1 - 0.3)) / Math.sin(a) ** 2));
      return [Math.max(1, Math.min(MAX_SPEED, fit, Math.hypot(d[0], d[1]) / AIM)), a];
    },
    at: () => stage.P([vx.peek() * AIM, vy.peek() * AIM]),
    on_end: () => {
      const v = sp.peek(), a = ang.peek() / RAD;
      fig.tell({ kind: 'state', text: L(`thrown at ${f2(v)} m/s, ${a.toFixed(0)}°: across ${f2(vx.peek() * EVERY)} m every 0.1 s, the top after ${f2(T.peek() / 2)} s`, `以 ${f2(v)} 米/秒、${a.toFixed(0)}° 抛出：每 0.1 秒横向走 ${f2(vx.peek() * EVERY)} 米，${f2(T.peek() / 2)} 秒后到最高点`) });
    },
  });
  if (hand) sim.hold_with(hand);

  // ---- predict first: where will it land? A hollow ring on the ground, let go to throw; then the gap, said
  let predicted: { fresh: ReturnType<typeof guess>['fresh']; things: Thing[] } | null = null;
  if (p.predict) {
    const range = () => (2 * vx.value * vy.value) / G, tol = Math.max(0.12, range0 * 0.04);
    const land = fig.param('land', Math.max(0.4, range0 * 0.3), { range: [0.2, X1 - 0.2], doc: 'the guess of where it lands (m)' });
    const g = guess(fig, stage, land, {
      id: 'landing', role: 'noun:ball', at: (v) => [v, 0], to: (d) => Math.max(0.2, Math.min(X1 - 0.2, d[0])), truth: range, tolerance: tol,
      says: t('your guess: where the ball lands (drag it, let go to throw)', '你的猜测：球落在哪里（拖动它，松手就抛）'),
    });
    g.on_commit(() => { sim.restart(); sim.play(); });
    const said = derive(() => (g.committed.value ? Math.max(0, Math.min(1, (sim.clock.value - T.value) / 0.35)) : 0), 'the gap shown');
    const gap = stage.add(new Gap(() => [g.guessed.value, -0.22], () => [range(), -0.22], {
      id: 'gap', role: 'noun:ball', shown: said,
      text: () => {
        const e = g.error.value, d = f2(Math.abs(e));
        return Math.abs(e) <= tol ? L('right there', '正中') : e < 0 ? L(`${d} m short`, `近了 ${d} 米`) : L(`${d} m long`, `远了 ${d} 米`);
      },
      says: t('how far the guess was from where it landed', '猜测和实际落点相差多远'),
    }));
    predicted = { fresh: g.fresh, things: [g.ring, gap] };
  }

  // ---- the numbers: the two legs of the last tenth of a second
  const dx_word = fig.readout([{ tex: '\\Delta x =' }, { value: () => (legs.value ? legs.value.b[0] - legs.value.a[0] : vx.value * EVERY), decimals: 2, template: '0.00' }, { tex: '\\mathrm{m}' }], { id: 'dx', role: 'noun:horizontal', kind: 'display', says: t('across, in the last 0.1 s', '最近 0.1 秒横向走的距离') });
  const dy_word = fig.readout([{ tex: '\\Delta y =' }, { value: () => (legs.value ? legs.value.b[1] - legs.value.a[1] : vy.value * EVERY - 0.5 * G * EVERY * EVERY), decimals: 2, template: '−0.00' }, { tex: '\\mathrm{m}' }], { id: 'dy', role: 'noun:vertical', kind: 'display', says: t('up (or down), in the last 0.1 s', '最近 0.1 秒竖直走的距离（向上为正）') });
  const per = fig.readout([{ text: t('every 0.1 s', '每 0.1 秒') }], { id: 'per', kind: 'caption' });
  fig.layout(row([stage, column([dx_word, dy_word, per], { gap: 6 })], { weights: [3, 1], align: 'center', gap: 18 }), {
    phone: column([row([dx_word, dy_word], { gap: 16, phone: 'row' }), stage], { gap: 8 }),
  });

  // ---- checks: the integration is the parabola, the spacing across is constant
  fig.check('the integrated flight is the parabola x = vₓt, y = v_y t − gt²/2 (within 1 mm at the landing)', () => {
    // (at the step nearest the landing: the clock is in whole steps)
    const tl = sim.step_of(T.peek()) * sim.dt, land = sim.at(tl), exact = vx.peek() * tl, h = vy.peek() * tl - 0.5 * G * tl * tl;
    return Math.abs(land[0] - exact) < 1e-3 && Math.abs(land[1] - h) < 1e-3 ? null : `at ${tl.toFixed(3)} s it is at (${land[0].toFixed(4)}, ${land[1].toFixed(4)}), not (${exact.toFixed(4)}, ${h.toFixed(4)})`;
  });
  fig.check('the ghosts are evenly spaced across: Δx is the same for every tenth of a second', () => {
    const xs = sim.series(0, T.peek(), EVERY).map((s) => s.y[0]);
    let worst = 0;
    for (let i = 2; i < xs.length - 1; i++) worst = Math.max(worst, Math.abs(xs[i] - xs[i - 1] - (xs[1] - xs[0])));
    return worst < 1e-9 ? null : `Δx varies by ${worst.toExponential(1)} m`;
  });
  fig.report_with(() => ({ speed: sp.peek(), angle_deg: ang.peek() / RAD, time: shown.peek(), flight_time: T.peek(), top_at: T.peek() / 2, range: (2 * vx.peek() * vy.peek()) / G, dx_per_tenth: vx.peek() * EVERY }));

  if (predicted) {
    // (the throw waits for the guess: the script only sets the scene, and a replay starts the guess and the throw again)
    fig.script(predicted.fresh(sim.clock, sim.running), reveal(stage, ground, aim, ball, trail, leg_x, leg_y, dx_word, dy_word, per, ...predicted.things), wait(0.6));
    return fig;
  }
  fig.script(
    reveal(stage, ground, aim, ball, trail, leg_x, leg_y, dx_word, dy_word, per),
    wait(0.6),
    beat(),
    run(sim, flight(speed * Math.sin(angle)) + 0.05),
    wait(0.8),
  );
  return fig;
}

export const phys_throw = define_figure<ThrowParams>({
  name: 'phys_throw',
  summary: 'A ball thrown from the ground (integrated), with its past as ghosts every 0.1 s and its next 0.35 s dashed: evenly spaced across, closing up toward the top and opening out on the way down. The last tenth of a second is drawn as its legs Δx (constant) and Δy (shrinking to 0 at the top, then negative), with their numbers. In explore the learner drags the aim and lets go to throw again.',
  topics: ['projectile motion', 'kinematics', 'gravity', 'velocity components', 'equal time intervals', 'parabola'],
  params: {
    speed: { type: 'number', min: 1, max: MAX_SPEED, default: 7, doc: 'the speed it is thrown with (m/s)' },
    angle: { type: 'number', min: 10, max: 85, default: 60, doc: 'the angle above the ground it is thrown at (degrees)' },
    predict: { type: 'boolean', default: false, doc: 'predict first: the learner drags a hollow ring to where they think it lands and lets go to throw; the gap to the landing is drawn and said (and reported to the lesson)' },
    lang: LANG_SPEC,
  },
  examples: [{}, { lang: 'zh' }, { speed: 8, angle: 30 }, { speed: 6, angle: 80, lang: 'zh' }, { predict: true }, { predict: true, angle: 40, lang: 'zh' }],
  ids: ['stage', 'ground', 'trail', 'leg_x', 'leg_y', 'aim', 'ball', 'dx', 'dy'],
  figure: (p) => throw_figure(p),
  // the ball waits where it landed; the hand aims (the handle) and the throw runs again when it lets go (hold_with)
  explore: (fig) => fig.sims[0]?.pause(),
});
