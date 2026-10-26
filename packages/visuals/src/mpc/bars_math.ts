// M2's pure math (no drawing): the cart's prediction over a short horizon as
// X = Φ x_0 + Γ U, with A and B from the exact zero-order-hold discretization
// (the kit's c2d), the exact path between the samples, the two numbers at the
// end of the horizon in closed form, and what the world checks (at rest, at the
// wall, past the wall). Also Euler's error for the read page's figure and the
// checks. Conventions: docs/lessons/mpc/KIT.md (X = (x_1..x_N), x_0 not in X).
import { CART, DOUBLE_INTEGRATOR_C, c2d, euler, matvec, prediction_matrices, vadd, type Mat, type Vec } from './math';

/** The world: 10 planned accelerations (1 s) for the cart 30 cm before the wall, coasting at 0.5 m/s. */
export const BARS = { N: 10, dt: CART.dt, p0: 9.7, v0: 0.5, wall: CART.p_max, a_max: CART.a_max, snap: 0.1 } as const;
/** Tolerances of the world's goals: at rest within 0.006 m/s (the 0.1 grid makes v_N exact), at the wall within 1 cm. */
export const TOL = { v: 0.006, p: 0.01 } as const;

/** The cart's discrete model, computed (not typed in) by exact ZOH: A = e^{A_c Δt}, B = ∫ e^{A_c s} ds B_c. */
export function cart_model(dt: number = BARS.dt): { A: Mat; B: Mat } {
  return c2d(DOUBLE_INTEGRATOR_C.A, DOUBLE_INTEGRATOR_C.B, dt);
}
/** The same model by forward Euler (A = I + A_c Δt, B = B_c Δt): it misses B's Δt²/2. */
export function cart_euler(dt: number = BARS.dt): { A: Mat; B: Mat } {
  return euler(DOUBLE_INTEGRATOR_C.A, DOUBLE_INTEGRATOR_C.B, dt);
}

const mats = new Map<string, { Phi: Mat; Gamma: Mat }>();
/** Φ and Γ of the cart for horizon N (cached). */
export function cart_prediction(N: number = BARS.N, dt: number = BARS.dt): { Phi: Mat; Gamma: Mat } {
  const key = `${N}|${dt}`;
  let m = mats.get(key);
  if (!m) {
    const { A, B } = cart_model(dt);
    m = prediction_matrices(A, B, N);
    mats.set(key, m);
  }
  return m;
}

export interface Prediction {
  /** Positions and velocities at k = 0..N (index 0 is x_0). */
  p: number[];
  v: number[];
}
/** The predicted states x_0..x_N for planned accelerations U, computed as Φ x_0 + Γ U. */
export function predict(U: readonly number[], x0: Vec = [BARS.p0, BARS.v0], dt: number = BARS.dt): Prediction {
  const N = U.length;
  const { Phi, Gamma } = cart_prediction(N, dt);
  const X = vadd(matvec(Phi, x0), matvec(Gamma, U.slice()));
  const p = [x0[0]], v = [x0[1]];
  for (let k = 0; k < N; k++) {
    p.push(X[2 * k]);
    v.push(X[2 * k + 1]);
  }
  return { p, v };
}
/** The prediction with every input zero: Φ x_0 alone. */
export function free_response(N: number = BARS.N, x0: Vec = [BARS.p0, BARS.v0], dt: number = BARS.dt): Prediction {
  return predict(new Array(N).fill(0), x0, dt);
}

/**
 * The exact path between the samples (the input is held through each sample, so
 * v is linear and p quadratic inside it): `sub` points per sample, as [k, p, v]
 * with k fractional (k = t / Δt).
 */
export function path(U: readonly number[], x0: Vec = [BARS.p0, BARS.v0], dt: number = BARS.dt, sub = 6): [number, number, number][] {
  const out: [number, number, number][] = [[0, x0[0], x0[1]]];
  let p = x0[0], v = x0[1];
  U.forEach((a, k) => {
    for (let s = 1; s <= sub; s++) {
      const tau = (s / sub) * dt;
      out.push([k + s / sub, p + v * tau + 0.5 * a * tau * tau, v + a * tau]);
    }
    p += v * dt + 0.5 * a * dt * dt;
    v += a * dt;
  });
  return out;
}

/**
 * The last block row of Γ for the cart, divided out: u_j enters the final speed
 * with weight Δt (every input the same) and the final position with weight
 * (N − j − ½) Δt² (earlier inputs more). This is what the world's formulas show.
 */
export function end_weights(N: number = BARS.N, dt: number = BARS.dt): { v: number[]; p: number[] } {
  return { v: new Array(N).fill(dt), p: Array.from({ length: N }, (_, j) => (N - j - 0.5) * dt * dt) };
}
/** The end of the horizon in closed form: v_N = v_0 + Δt Σu, p_N = p_0 + NΔt v_0 + Δt² Σ (N − j − ½) u_j. */
export function end_state(U: readonly number[], x0: Vec = [BARS.p0, BARS.v0], dt: number = BARS.dt): { sum: number; wsum: number; v: number; p: number; p_free: number } {
  const N = U.length;
  const sum = U.reduce((s, u) => s + u, 0);
  const wsum = U.reduce((s, u, j) => s + (N - j - 0.5) * u, 0);
  const p_free = x0[0] + N * dt * x0[1];
  return { sum, wsum, v: x0[1] + dt * sum, p: p_free + dt * dt * wsum, p_free };
}

/** First instant k (1..N) at which the predicted position is past the wall by more than `tol`, or -1. */
export function first_past(p: readonly number[], wall: number = BARS.wall, tol: number = TOL.p): number {
  for (let k = 1; k < p.length; k++) if (p[k] > wall + tol) return k;
  return -1;
}

export interface BarsStatus {
  v_end: number;
  p_end: number;
  sum: number;
  /** v_N = 0 (within TOL.v). */
  at_rest: boolean;
  /** First k past the wall (more than 1 cm), or -1. */
  past_k: number;
  /** At rest, never past the wall, and within 1 cm of it at k = N. */
  docked: boolean;
  /** At rest, never past the wall, but more than 1 cm before it [m] (0 otherwise). */
  short_by: number;
}
/** What the world checks for a plan U. */
export function bars_status(U: readonly number[], x0: Vec = [BARS.p0, BARS.v0]): BarsStatus {
  const pr = predict(U, x0);
  const N = U.length;
  const v_end = pr.v[N], p_end = pr.p[N];
  const at_rest = Math.abs(v_end) < TOL.v;
  const past_k = first_past(pr.p);
  const near = Math.abs(p_end - BARS.wall) <= TOL.p + 1e-9;
  const docked = at_rest && past_k < 0 && near;
  const short_by = at_rest && past_k < 0 && !near && p_end < BARS.wall ? BARS.wall - p_end : 0;
  return { v_end, p_end, sum: U.reduce((s, u) => s + u, 0), at_rest, past_k, docked, short_by };
}
/** Snap an acceleration to the world's grid (0.1 m/s²) within ±a_max. */
export const snap_u = (u: number): number => Math.max(-BARS.a_max, Math.min(BARS.a_max, Math.round(u / BARS.snap) / Math.round(1 / BARS.snap) + 0));

/** A plan that docks (coast 0.3 s, brake, ease off): Σu = −5 and Σ(9.5 − j)u_j = −20. */
export const DOCK_PLAN: readonly number[] = [0, 0, 0, -0.5, -1, -1, -1, -1, -0.5, 0];

/**
 * Distance after T seconds from rest under a constant acceleration a, by the
 * exact model and by forward Euler (p_{k+1} = p_k + Δt v_k): Euler loses
 * ½ a Δt² per step, ½ a Δt T in all.
 */
export function euler_gap(a: number, T: number, dt: number): { exact: number; euler: number; steps: number } {
  const steps = Math.round(T / dt);
  let p = 0, v = 0;
  for (let k = 0; k < steps; k++) {
    p += dt * v;
    v += dt * a;
  }
  return { exact: 0.5 * a * T * T, euler: p, steps };
}
