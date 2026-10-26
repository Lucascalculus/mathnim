// M1's story (pure, cached): the cart starts at rest 10 m from a wall and must
// dock against it (p → p_max) without hitting it, with |a| ≤ a_max and
// |v| ≤ v_max. A horizon-N MPC (cost Σ (p − p_max)² + r a², hard constraints)
// is compared with a reactive PD controller. When the MPC's QP is infeasible
// (no plan in its window can keep p ≤ p_max) it brakes as hard as it can.
// Simulation of the course's toy model; numbers are not from a real vehicle.
import { CART, cart_step, double_integrator, make_mpc, simulate, type MpcPlan, type Vec } from './math';

export interface DockRun {
  /** States x_0..x_T (p, v): the run is padded with the final state up to `steps`. */
  x: Vec[];
  /** Applied accelerations a_0..a_{T-1}. */
  u: number[];
  /** What the MPC planned at each instant (null for the PD controller or after the run ended). */
  plans: (MpcPlan | null)[];
  /** First instant whose QP was infeasible (−1: never). */
  infeasible_k: number;
  /** First instant at which it brakes (a < −0.05). */
  brake_k: number;
  /** The instant the wall was hit, and the speed it was hit with. */
  crash_k: number;
  impact: number;
  /** The instant it came to rest against the wall (−1: never). */
  docked_k: number;
}
export interface DockOptions {
  a_max?: number;
  v_max?: number;
  wall?: number;
  /** Weight on the input (the position weight is 1). */
  r?: number;
  steps?: number;
}
const cache = new Map<string, DockRun>();

function finish(sim: ReturnType<typeof simulate>, steps: number, crash: { k: number; v: number }, extra: Partial<DockRun>, wall: number): DockRun {
  const x = sim.x.slice(), u = sim.u.map((a) => a[0]), plans = sim.plans.slice();
  while (x.length < steps + 1) {
    x.push(x[x.length - 1].slice());
    u.push(0);
    plans.push(null);
  }
  const brake_k = u.findIndex((a) => a < -0.05);
  const docked = crash.k < 0 ? x.findIndex((s) => Math.abs(s[0] - wall) < 5e-3 && Math.abs(s[1]) < 5e-3) : -1;
  return { x, u, plans, infeasible_k: -1, brake_k, crash_k: crash.k, impact: crash.v, docked_k: docked, ...extra };
}

/** The receding-horizon MPC with horizon N on the docking task. */
export function dock_run(N: number, o: DockOptions = {}): DockRun {
  const a_max = o.a_max ?? CART.a_max, v_max = o.v_max ?? CART.v_max, wall = o.wall ?? CART.p_max, r = o.r ?? 0.1, steps = o.steps ?? 90;
  const key = `mpc|${N}|${a_max}|${v_max}|${wall}|${r}|${steps}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const { A, B } = double_integrator(CART.dt);
  const mpc = make_mpc({ A, B, Q: [[1, 0], [0, 0]], R: [[r]], N, u_min: [-a_max], u_max: [a_max], x_min: [null, -v_max], x_max: [wall, v_max] });
  const crash = { k: -1, v: 0 };
  let infeasible_k = -1;
  const sim = simulate({
    x0: [0, 0], steps,
    control: (x, k) => {
      const plan = mpc.solve(x, { x_ref: [wall, 0] });
      if (plan.status !== 'optimal') {
        if (infeasible_k < 0) infeasible_k = k;
        return { u: [-a_max], plan, status: plan.status };
      }
      return { u: plan.U[0], plan };
    },
    plant: (x, u, k) => {
      const s = cart_step(x, u[0], { wall: wall + 1e-9 });
      if (s.crashed && s.impact > 1e-3) {
        crash.k = k + 1;
        crash.v = s.impact;
      }
      return s.crashed ? [wall, 0] : s.x;
    },
    // stop once it has hit the wall, or rests against it
    stop: (x) => crash.k >= 0 || (Math.abs(x[0] - wall) < 1e-4 && Math.abs(x[1]) < 1e-4),
  });
  const run = finish(sim, steps, crash, { infeasible_k }, wall);
  cache.set(key, run);
  return run;
}

/**
 * A reactive PD controller a = clip(kp (p_max − p) − kd v, ±a_max), with the
 * speed limit enforced by the actuator (no acceleration beyond v_max). It only
 * sees the error now: it has no idea how far braking takes.
 */
export function pd_run(kp: number, kd: number, o: DockOptions = {}): DockRun {
  const a_max = o.a_max ?? CART.a_max, v_max = o.v_max ?? CART.v_max, wall = o.wall ?? CART.p_max, steps = o.steps ?? 90;
  const key = `pd|${kp}|${kd}|${a_max}|${v_max}|${wall}|${steps}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const crash = { k: -1, v: 0 };
  const sim = simulate({
    x0: [0, 0], steps,
    control: (x) => {
      let a = Math.max(-a_max, Math.min(a_max, kp * (wall - x[0]) - kd * x[1]));
      if (x[1] + a * CART.dt > v_max) a = (v_max - x[1]) / CART.dt;
      return { u: [a] };
    },
    plant: (x, u, k) => {
      const s = cart_step(x, u[0], { wall: wall + 1e-9 });
      if (s.crashed && s.impact > 1e-3) {
        crash.k = k + 1;
        crash.v = s.impact;
      }
      return s.crashed ? [wall, 0] : s.x;
    },
    stop: (x) => crash.k >= 0 || (Math.abs(x[0] - wall) < 1e-4 && Math.abs(x[1]) < 1e-4),
  });
  const run = finish(sim, steps, crash, {}, wall);
  cache.set(key, run);
  return run;
}

/** The look-ahead the docking needs: the time to brake from v_max to rest, v_max / a_max, in steps. */
export const needed_steps = (o: DockOptions = {}): number => Math.round((o.v_max ?? CART.v_max) / (o.a_max ?? CART.a_max) / CART.dt);
/** The shortest horizon that docks without hitting the wall (searched, 1..max). */
export function shortest_safe_N(o: DockOptions = {}, max = 40): number {
  for (let N = 1; N <= max; N++) if (dock_run(N, o).crash_k < 0) return N;
  return -1;
}

// ---------------------------------------------------------------- M1's world: what the plan saw
/**
 * The instant whose plan M1's world shows: the last moment the cart could still
 * stop before the wall, i.e. the first k with p_k + v_k²/(2 a_max) ≥ wall − 2 cm
 * (on a crashing run this is where braking had to start; the 2 cm tolerance
 * puts docking runs, which shave a few mm/s off one sample earlier, at the
 * same instant, t = 5.0 s), or the first instant it brakes with at least half
 * the brakes, if that comes earlier. −1 if neither exists.
 */
export function shown_instant(run: DockRun, o: DockOptions = {}): { k: number; why: 'last-moment' | 'began-braking' } {
  const a = o.a_max ?? CART.a_max, wall = o.wall ?? CART.p_max;
  let kc = -1;
  for (let k = 0; k < run.plans.length; k++) {
    const pl = run.plans[k];
    if (!pl || pl.status !== 'optimal') continue;
    const [p, v] = run.x[k];
    if (p + (v > 0 ? (v * v) / (2 * a) : 0) >= wall - 0.02) {
      kc = k;
      break;
    }
  }
  // "began to brake" counts only clear braking (at least half the brakes), not a few mm/s shaved off
  const kb = run.u.findIndex((u, k) => u <= -0.5 * a && run.plans[k]?.status === 'optimal');
  if (kb >= 0 && (kc < 0 || kb < kc)) return { k: kb, why: 'began-braking' };
  return { k: kc, why: 'last-moment' };
}
/**
 * Where the plan made at instant k ends: its last predicted state (p_N, v_N),
 * the room left before the wall, and whether a stop still fits in that room
 * (v_N²/(2 a_max) ≤ room): a plan that ends "at the wall, still moving" hides
 * a crash just beyond its window.
 */
export function plan_end(run: DockRun, k: number, o: DockOptions = {}): { p: number; v: number; room: number; at_rest: boolean; can_stop: boolean } | null {
  const pl = run.plans[k];
  if (!pl || pl.status !== 'optimal') return null;
  const a = o.a_max ?? CART.a_max, wall = o.wall ?? CART.p_max;
  const [p, v] = pl.X[pl.X.length - 1];
  const room = Math.max(0, wall - p);
  return { p, v, room, at_rest: Math.abs(v) < 5e-3, can_stop: (v > 0 ? (v * v) / (2 * a) : 0) <= room + 1e-6 };
}

// ---------------------------------------------------------------- M1's figure: why only the first step
/** A run of the cart (with the wall): states, applied accelerations, crash or docking. */
export interface Trace {
  x: Vec[];
  u: number[];
  crash_k: number;
  impact: number;
  /** First instant at rest within 5 mm of the wall (−1: never). */
  docked_k: number;
}
export interface PushRuns {
  /** The plan made once at t = 0 and executed blindly (the push is not seen). */
  blind: Trace;
  /** The docking MPC re-planned every sample (it measures the pushed state). */
  replan: Trace;
  /** What the plan made at t = 0 predicted (x_0..x_N of the long plan). */
  plan0: Vec[];
  push_k: number;
  dv: number;
}
const push_cache = new Map<string, PushRuns>();
/**
 * An unexpected push (a gust from behind): at instant push_k the speed jumps by dv.
 * Compares the same plan maker used two ways: one long plan made at t = 0
 * (N_blind steps, long enough to dock) executed blindly, and the horizon-N MPC
 * re-planned from the measured state every sample. Plant: the exact cart with the wall.
 */
export function push_runs(o: { push_k?: number; dv?: number; N?: number; N_blind?: number; steps?: number } = {}): PushRuns {
  const push_k = o.push_k ?? 10, dv = o.dv ?? 0.3, N = o.N ?? 20, NB = o.N_blind ?? 80, steps = o.steps ?? 100;
  const key = `${push_k}|${dv}|${N}|${NB}|${steps}`;
  const hit = push_cache.get(key);
  if (hit) return hit;
  const { A, B } = double_integrator(CART.dt);
  const spec = { A, B, Q: [[1, 0], [0, 0]], R: [[0.1]], u_min: [-CART.a_max], u_max: [CART.a_max], x_min: [null, -CART.v_max], x_max: [CART.p_max, CART.v_max] };
  const ref = { x_ref: [CART.p_max, 0] };
  const run = (act: (x: Vec, k: number) => number): Trace => {
    const x: Vec[] = [[0, 0]], u: number[] = [];
    let crash_k = -1, impact = 0;
    for (let k = 0; k < steps; k++) {
      if (crash_k >= 0) {
        x.push(x[k].slice());
        u.push(0);
        continue;
      }
      const a = act(x[k], k);
      const s = cart_step(x[k], a, { wall: CART.p_max + 1e-9 });
      u.push(a);
      let nx = s.x;
      if (s.crashed && s.impact > 1e-3) {
        crash_k = k + 1;
        impact = s.impact;
        nx = [CART.p_max, 0];
      }
      if (k + 1 === push_k && crash_k < 0) nx = [nx[0], nx[1] + dv];
      x.push(nx);
    }
    const docked_k = crash_k >= 0 ? -1 : x.findIndex((s, i) => x.slice(i).every((y) => Math.abs(y[0] - CART.p_max) < 5e-3 && Math.abs(y[1]) < 5e-3));
    return { x, u, crash_k, impact, docked_k };
  };
  const long = make_mpc({ ...spec, N: NB });
  const p0 = long.solve([0, 0], ref);
  const blind = run((_x, k) => (k < NB ? p0.U[k][0] : 0));
  const mpc = make_mpc({ ...spec, N });
  const replan = run((x) => {
    const pl = mpc.solve(x, ref);
    return pl.status === 'optimal' ? pl.U[0][0] : -CART.a_max;
  });
  const out = { blind, replan, plan0: p0.X, push_k, dv };
  push_cache.set(key, out);
  return out;
}
