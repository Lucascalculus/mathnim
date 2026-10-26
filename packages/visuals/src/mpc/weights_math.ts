// M3's numbers (pure, cached): what the weights of the quadratic cost do to the
// cart. The cart starts at rest at p = 0 and must stop at the flag p_ref = 6 m.
// The controller is MPC without limits and with a long horizon, which is the
// LQR feedback a = −K (x − x_ref) (derived in M3): Q = diag(1, q_v), R = r,
// Δt = 0.1 s. The position price is fixed at 1 because only the ratios of the
// weights matter. Simulation of the course's toy model (exact ZOH), not a real
// vehicle; |a| is NOT limited here (that is M4).
import { CART, double_integrator, dlqr, riccati_finite, type Mat, type Vec } from './math';

/** The M3 task and the two briefs of its world. */
export const W3 = {
  dt: CART.dt,
  /** The flag [m]; the cart starts at rest at 0. */
  p_ref: 6,
  /** Samples simulated (30 s; the plots show the first 20 s). */
  steps: 300,
  /** Samples shown on the plots (20 s). */
  shown: 200,
  /** "Arrived": within this distance of the flag [m] from then on. */
  tol: 0.05,
  /** Brief A (fast): arrives by this time [s], overshoot at most `over`. */
  fast_by: 5,
  /** Brief B (gentle): |a| never above this [m/s²], overshoot at most `over`, arrives by `gentle_by` (the best any weights do is about 11 s). */
  a_lim: 1,
  gentle_by: 14,
  /** Largest overshoot both briefs accept [m]. */
  over: 0.05,
  /** Slider ranges (log scale): the price of speed q_v and of effort r. */
  q_v: [0.01, 100] as const,
  r: [0.01, 100] as const,
} as const;

const { A, B } = double_integrator(W3.dt);

const gains = new Map<string, Vec>();
/** The LQR gain K = [k_p, k_v] for Q = diag(q_p, q_v), R = r on the cart (cached). */
export function weights_gain(q_v: number, r: number, q_p = 1): Vec {
  const key = `${q_p.toPrecision(8)}|${q_v.toPrecision(8)}|${r.toPrecision(8)}`;
  let K = gains.get(key);
  if (!K) {
    K = dlqr(A, B, [[q_p, 0], [0, q_v]], [[r]], { tol: 1e-12, max_iter: 20000 }).K[0];
    if (gains.size > 4000) gains.clear();
    gains.set(key, K);
  }
  return K;
}

/** One run of the feedback a = −K (x − x_ref) from rest at 0 to the flag, and its key numbers. */
export interface WeightsRun {
  K: Vec;
  /** States x_0..x_T (p, v) and inputs a_0..a_{T−1}. */
  x: Vec[];
  u: number[];
  /** Largest |a| (the first push, a_0 = 6 k_p, for these runs). */
  peak: number;
  /** How far past the flag it goes [m] (0 if never). */
  overshoot: number;
  /** First time [s] from which it stays within `tol` of the flag; null if not within the simulated 30 s. */
  arrival: number | null;
  /** The three parts of the cost J = Σ (p − p_ref)² + q_v v² + r a² over the run. */
  J: { track: number; speed: number; effort: number };
}

const runs = new Map<string, WeightsRun>();
/** The run for weights (q_v, r) (cached). */
export function weights_run(q_v: number, r: number, o: { q_p?: number; p_ref?: number; steps?: number } = {}): WeightsRun {
  const q_p = o.q_p ?? 1, p_ref = o.p_ref ?? W3.p_ref, steps = o.steps ?? W3.steps;
  const key = `${q_p.toPrecision(8)}|${q_v.toPrecision(8)}|${r.toPrecision(8)}|${p_ref}|${steps}`;
  const hit = runs.get(key);
  if (hit) return hit;
  const K = weights_gain(q_v, r, q_p);
  let x: Vec = [0, 0];
  const xs: Vec[] = [x], us: number[] = [];
  const J = { track: 0, speed: 0, effort: 0 };
  for (let k = 0; k < steps; k++) {
    const a = -(K[0] * (x[0] - p_ref) + K[1] * x[1]);
    J.track += q_p * (x[0] - p_ref) ** 2;
    J.speed += q_v * x[1] ** 2;
    J.effort += r * a * a;
    us.push(a);
    x = [A[0][0] * x[0] + A[0][1] * x[1] + B[0][0] * a, A[1][0] * x[0] + A[1][1] * x[1] + B[1][0] * a];
    xs.push(x);
  }
  let arrival: number | null = 0;
  for (let k = steps; k >= 0; k--) {
    if (Math.abs(xs[k][0] - p_ref) > W3.tol) {
      arrival = k === steps ? null : (k + 1) * W3.dt;
      break;
    }
  }
  const run: WeightsRun = {
    K, x: xs, u: us,
    peak: Math.max(...us.map(Math.abs)),
    overshoot: Math.max(0, ...xs.map((s) => s[0] - p_ref)),
    arrival, J,
  };
  if (runs.size > 600) runs.clear();
  runs.set(key, run);
  return run;
}

/** Brief A: arrives by 5 s with at most 5 cm overshoot. */
export const meets_fast = (w: WeightsRun): boolean => w.arrival !== null && w.arrival <= W3.fast_by + 1e-9 && w.overshoot <= W3.over + 1e-9;
/** Brief B: |a| never above 1 m/s², at most 5 cm overshoot, arrives by 14 s. */
export const meets_gentle = (w: WeightsRun): boolean => w.peak <= W3.a_lim + 1e-9 && w.overshoot <= W3.over + 1e-9 && w.arrival !== null && w.arrival <= W3.gentle_by + 1e-9;

/**
 * The continuous-time closed form for the same cart (ṗ = v, v̇ = a), good when
 * ωΔt ≪ 1: k_p = √(q_p/r), k_v = √(q_v/r + 2√(q_p/r)); the closed loop has
 * natural frequency ω = (q_p/r)^{1/4} and damping ζ = √(1/2 + q_v / (4√(q_p r))).
 * So q_p/r sets the pace and q_v/√(q_p r) the damping (with q_v = 0, ζ = 1/√2 for every r).
 */
export function continuous_lqr(q_v: number, r: number, q_p = 1): { K: Vec; omega: number; zeta: number } {
  const kp = Math.sqrt(q_p / r), kv = Math.sqrt(q_v / r + 2 * kp);
  return { K: [kp, kv], omega: Math.sqrt(kp), zeta: kv / (2 * Math.sqrt(kp)) };
}

/**
 * The unconstrained MPC gain K_N for every horizon N = 1..N_max (first row of
 * each), with terminal weight P: by the Riccati recursion backwards from P,
 * the gain with h steps to go is the first gain of a horizon-h MPC.
 */
export function gains_by_horizon(Q: Mat, R: Mat, P: Mat, N_max: number): Vec[] {
  const { K } = riccati_finite(A, B, Q, R, P, N_max);
  return Array.from({ length: N_max }, (_, i) => K[N_max - 1 - i][0]);
}
