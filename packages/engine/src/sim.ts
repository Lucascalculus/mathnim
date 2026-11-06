// Simulated time. A Sim integrates a system with a fixed step from the starting state its inputs give (params: a
// release angle, a damping), so the state at time t is a pure function of the inputs and t. That is what lets a
// simulation live on a figure's timeline: the script runs it (run(sim, 8)), a seek lands on exactly the state playing
// would have reached, and the same release replays the same trajectory, bit for bit. Checkpoints every `every` steps
// make a seek cost at most that many steps, whatever the distance.
//
// In explore, the player advances a running sim's clock in real time (in whole steps); a handle that holds it
// (hold_with) sets the starting state while it is held, and lets the run go when it is let go. A change to an input
// starts a new run: the clock goes back to 0 (the trajectory of a run is its inputs' alone, so a constant changed
// halfway cannot continue the old one; a figure that needs that records the change as an input).
//
//   const sim = fig.sim({ inputs: () => ({ th0: th0.value }), start: (i) => [i.th0, 0], dt: 1 / 240,
//     accel: (q, v, t, i, a) => { a[0] = -9.81 * Math.sin(q[0]); } });           // velocity Verlet by default
//   const bob = derive(() => sim.state.value[0]);
//   fig.script(reveal(...), run(sim, 8));
import type { Handle } from './kinds';
import type { Step } from './script';
import { Derived, derive, param, track, untracked, type Param, type Readable } from './state';

/**
 * How a step is taken. 'verlet' (velocity Verlet: second order, symplectic when the force depends on position only,
 * so energy stays bounded for ever), 'euler' (semi-implicit Euler for a second-order system: first order, symplectic;
 * explicit Euler for a first-order one), 'rk4' (classic Runge-Kutta: fourth order, not symplectic; energy drifts, slowly).
 */
export type Method = 'verlet' | 'euler' | 'rk4';

export interface SimSpec<I> {
  id?: string;
  /** What a run depends on, read from params: a change starts a new run (the clock goes back to 0). */
  inputs: () => I;
  /** The state at time 0: a second-order system's positions then velocities ([q..., v...]); a first-order one's y. */
  start: (i: I) => number[];
  /** A second-order system q'' = a(q, q', t): write a into `out`. */
  accel?: (q: Float64Array, v: Float64Array, t: number, i: I, out: Float64Array) => void;
  /** A first-order system y' = f(y, t): write f into `out`. */
  deriv?: (y: Float64Array, t: number, i: I, out: Float64Array) => void;
  /** Default 'verlet' for a second-order system, 'rk4' for a first-order one ('verlet' needs accel). */
  method?: Method;
  /** The step (s). 1/(60 k) puts every frame of a 60 fps timeline on a step: no state between steps is ever shown. */
  dt: number;
  /** The longest run (s): the clock stops there (default an hour). */
  max_t?: number;
  /** Steps between checkpoints (default: a quarter of a second's worth). */
  every?: number;
}

/** One step of a system, in place: y (the whole state) at time t → at t + dt. */
type Stepper = (y: Float64Array, t: number) => void;

/** The stepper for a spec (temporaries allocated once). */
export function make_stepper<I>(spec: SimSpec<I>, n: number, inputs: () => I): Stepper {
  const dt = spec.dt, method = spec.method ?? (spec.accel ? 'verlet' : 'rk4');
  if (spec.accel) {
    const d = n / 2, accel = spec.accel;
    const a0 = new Float64Array(d), a1 = new Float64Array(d), vp = new Float64Array(d);
    if (method === 'verlet') {
      return (y, t) => {
        const i = inputs(), q = y.subarray(0, d), v = y.subarray(d);
        accel(q, v, t, i, a0);
        for (let k = 0; k < d; k++) q[k] += v[k] * dt + 0.5 * a0[k] * dt * dt;
        // (a force that depends on velocity, a damping, sees the velocity predicted for the end of the step)
        for (let k = 0; k < d; k++) vp[k] = v[k] + a0[k] * dt;
        accel(q, vp, t + dt, i, a1);
        for (let k = 0; k < d; k++) v[k] += 0.5 * (a0[k] + a1[k]) * dt;
      };
    }
    if (method === 'euler') {
      return (y, t) => {
        const i = inputs(), q = y.subarray(0, d), v = y.subarray(d);
        accel(q, v, t, i, a0);
        for (let k = 0; k < d; k++) v[k] += a0[k] * dt;
        for (let k = 0; k < d; k++) q[k] += v[k] * dt;
      };
    }
    // rk4 on (q, v)' = (v, a)
    const f = (yy: Float64Array, t: number, out: Float64Array, i: I) => {
      out.set(yy.subarray(d), 0);
      accel(yy.subarray(0, d), yy.subarray(d), t, i, a0);
      out.set(a0, d);
    };
    return rk4_stepper(f, n, dt, inputs);
  }
  if (!spec.deriv) throw new Error('engine: a Sim needs accel (second order) or deriv (first order)');
  if (method === 'verlet') throw new Error("engine: 'verlet' needs a second-order system (accel)");
  const deriv = spec.deriv;
  if (method === 'euler') {
    const k1 = new Float64Array(n);
    return (y, t) => {
      deriv(y, t, inputs(), k1);
      for (let k = 0; k < n; k++) y[k] += k1[k] * dt;
    };
  }
  return rk4_stepper((yy, t, out, i) => deriv(yy, t, i, out), n, dt, inputs);
}
function rk4_stepper<I>(f: (y: Float64Array, t: number, out: Float64Array, i: I) => void, n: number, dt: number, inputs: () => I): Stepper {
  const k1 = new Float64Array(n), k2 = new Float64Array(n), k3 = new Float64Array(n), k4 = new Float64Array(n), tmp = new Float64Array(n);
  return (y, t) => {
    const i = inputs();
    f(y, t, k1, i);
    for (let k = 0; k < n; k++) tmp[k] = y[k] + 0.5 * dt * k1[k];
    f(tmp, t + 0.5 * dt, k2, i);
    for (let k = 0; k < n; k++) tmp[k] = y[k] + 0.5 * dt * k2[k];
    f(tmp, t + 0.5 * dt, k3, i);
    for (let k = 0; k < n; k++) tmp[k] = y[k] + dt * k3[k];
    f(tmp, t + dt, k4, i);
    for (let k = 0; k < n; k++) y[k] += (dt / 6) * (k1[k] + 2 * k2[k] + 2 * k3[k] + k4[k]);
  };
}

let sim_ids = 0;

export class Sim<I = unknown> {
  readonly id: string;
  /** Simulated seconds since the run started (a param: the script runs it, a seek sets it, explore advances it). */
  readonly clock: Param<number>;
  /** 1 while explore advances the clock in real time, else 0 (a param: the player wakes when it changes). */
  readonly running: Param<number>;
  /** The inputs of the current run. */
  readonly inputs: Derived<I>;
  /** The state at the clock (recomputed when the clock or an input changes; never mutated: a fresh array each time). */
  readonly state: Derived<Float64Array>;
  readonly dt: number;
  readonly max_t: number;
  /** Steps taken since the figure was made (a cost to report). */
  steps_taken = 0;
  private stepper: Stepper;
  private n: number;
  private every: number;
  private cps: Float64Array[] = [];
  private cur: { n: number; y: Float64Array } | null = null;
  private run_of = -1;
  private acc = 0;
  private wired = new Set<Param<unknown>>();
  private on_input = () => this.new_run();
  /** The inputs the cache was made with (what the stepper reads: no tracking inside the loop). */
  private inp!: I;

  constructor(public spec: SimSpec<I>) {
    this.id = spec.id ?? `sim${++sim_ids}`;
    this.dt = spec.dt;
    this.max_t = spec.max_t ?? 3600;
    this.every = spec.every ?? Math.max(1, Math.round(0.25 / spec.dt));
    this.clock = param(0, { name: `${this.id}.clock`, range: [0, this.max_t] });
    this.running = param(0, { name: `${this.id}.running`, range: [0, 1] });
    this.inputs = derive(spec.inputs, `${this.id}.inputs`);
    this.n = untracked(() => spec.start(this.inputs.value)).length;
    this.stepper = make_stepper(spec, this.n, () => this.inp);
    this.state = derive(() => {
      this.inputs.value;
      return this.at_step(this.step_of(this.clock.value)).slice();
    }, `${this.id}.state`);
    this.wire();
  }
  /** The step nearest a time (clock values are whole steps; a seek between frames lands on the nearest one). */
  step_of(t: number): number {
    return Math.max(0, Math.round(Math.min(t, this.max_t) / this.dt));
  }
  /** The state at time t of the current run (not tracked; the same as the clock would give at t). */
  at(t: number): Float64Array {
    return untracked(() => this.at_step(this.step_of(t)).slice());
  }
  /**
   * Samples of the run from t0 to t1, one every `every` seconds (default: every step): what a trace draws. Computed from
   * the checkpoint before t0, so it costs (t1 − t0) / dt steps and leaves the run's own cache as it was.
   */
  series(t0: number, t1: number, every = this.dt): { t: number; y: Float64Array }[] {
    return untracked(() => {
      const n0 = this.step_of(Math.max(0, t0)), n1 = this.step_of(Math.max(t0, t1)), stride = Math.max(1, Math.round(every / this.dt));
      this.sync();
      const y = this.from_checkpoint(n0);
      const out: { t: number; y: Float64Array }[] = [{ t: n0 * this.dt, y: y.slice() }];
      for (let m = n0; m < n1; ) {
        this.stepper(y, m * this.dt);
        this.steps_taken++;
        m++;
        if ((m - n0) % stride === 0 || m === n1) out.push({ t: m * this.dt, y: y.slice() });
      }
      return out;
    });
  }
  /** Let explore advance the clock (from where it is). */
  play(): void {
    if (this.clock.peek() >= this.max_t) this.clock.set(0, true);
    this.running.set(1);
  }
  pause(): void {
    this.running.set(0);
  }
  /** Back to the start of the run. */
  restart(): void {
    this.acc = 0;
    this.clock.set(0, true);
  }
  /** Advance the clock by `s` real seconds, in whole steps (the remainder waits for the next frame); stops at max_t. */
  advance(s: number): void {
    this.acc += s;
    const k = Math.floor(this.acc / this.dt + 1e-9);
    if (k <= 0) return;
    this.acc -= k * this.dt;
    const n = Math.min(this.step_of(this.max_t), this.step_of(this.clock.peek()) + k);
    this.clock.set(n * this.dt, true);
    if (n * this.dt >= this.max_t - 1e-9) this.running.set(0);
  }
  /**
   * A handle that holds the run: while it is held the run waits at its start (the handle sets the starting state);
   * when it is let go the run starts from there (drag to release).
   */
  hold_with(h: Handle): this {
    let held = false;
    h.state.listeners.add((v) => {
      if (v === 2 && !held) {
        held = true;
        this.running.set(0);
        this.restart();
      } else if (v !== 2 && held) {
        held = false;
        this.restart();
        this.running.set(1);
      }
    });
    return this;
  }

  // ---------------------------------------------------------------- the run
  /** An input changed: a new run, from its start. */
  private new_run(): void {
    this.acc = 0;
    this.clock.set(0, true);
    this.wire();
  }
  /** Listen to the params the inputs read (through derived values too), so a change starts a new run at once. */
  private wire(): void {
    const params = new Set<Param<unknown>>();
    const walk = (r: Readable<unknown>): void => {
      if (r instanceof Derived) for (const d of r.deps) walk(d);
      else params.add(r as Param<unknown>);
    };
    for (const d of track(() => this.spec.inputs()).deps) walk(d);
    for (const p of this.wired) if (!params.has(p)) p.listeners.delete(this.on_input);
    for (const p of params) if (!this.wired.has(p)) p.listeners.add(this.on_input);
    this.wired = params;
  }
  /** Drop the cache when the inputs are not the ones it was made with. */
  private sync(): void {
    const inp = this.inputs.peek(), v = this.inputs.version;
    if (v === this.run_of && this.cps.length) return;
    this.run_of = v;
    this.inp = inp;
    const y0 = Float64Array.from(this.spec.start(inp));
    if (y0.length !== this.n) throw new Error(`engine: sim '${this.id}' started with ${y0.length} numbers, not ${this.n}`);
    this.cps = [y0];
    this.cur = null;
  }
  /** A copy of the state at step n, integrated from the nearest checkpoint (or the last state) at or before it. */
  private from_checkpoint(n: number): Float64Array {
    const K = this.every, c = Math.min(Math.floor(n / K), this.cps.length - 1);
    let m: number, y: Float64Array;
    if (this.cur && this.cur.n <= n && this.cur.n >= c * K) [m, y] = [this.cur.n, this.cur.y.slice()];
    else [m, y] = [c * K, this.cps[c].slice()];
    while (m < n) {
      this.stepper(y, m * this.dt);
      this.steps_taken++;
      m++;
      // (each checkpoint is the state the steps from 0 reach: storing it on the way changes no result)
      if (m % K === 0 && m / K === this.cps.length) this.cps.push(y.slice());
    }
    return y;
  }
  private at_step(n: number): Float64Array {
    this.sync();
    const y = this.from_checkpoint(n);
    this.cur = { n, y };
    return y;
  }
}

/**
 * Run a sim for `dur` seconds of the script (simulated time passes at the script's pace): its clock moves on by dur at
 * one speed. Reduced motion keeps the time (the motion is the content).
 */
export const run = (sim: Sim<any>, dur: number): Step => ({ kind: 'set', param: sim.clock, to: 0, by: dur, intent: 'simulate', dur });
