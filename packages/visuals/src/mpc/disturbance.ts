// M7 "When the model is wrong" (docs/lessons/mpc/research-c.md §1–3): pure
// math, no drawing. Three stories on the course's cart (Δt = 0.1 s,
// x = [p, v], u = a, model x⁺ = A x + B u):
//
// 1. Offset. A steady headwind (or a slope) adds an unknown constant
//    acceleration d: the real cart is x⁺ = A x + B (u + d) (cart_step's d).
//    A nominal MPC keeps planning with d = 0 and comes to rest short of its
//    target, at offset e = d / K_p (K_p: the position entry of its gain); a
//    model that assumes d̂ rests at (d − d̂) / K_p.
//    With a disturbance estimate (augmented model x⁺ = A x + B (u + d̂),
//    d̂⁺ = d̂ + λ·(what happened − what the model predicted)) and the target
//    shifted to u_s = −d̂ (steady_target with B_d = B), the offset vanishes.
//    In this story the controller reads p and v exactly, so the offset is the
//    model's fault alone.
// 2. Estimation. Only p is measured, with noise: a Kalman filter predicts with
//    the model and corrects with the measurement, weighted by the covariances
//    (here W for the process and V for the measurement, so that Q and R stay
//    the cost weights).
// 3. Tube. A bounded disturbance |w| ≤ w̄ and a hard wall: a nominal plan with
//    tightened limits plus the feedback u = ū − K (x − x̄) keeps the real cart
//    in a tube around the plan (Mayne, Seron & Raković 2005; RMD §3.5). The
//    course writes feedback as u = −K x, so A_K = A − B K (RMD: A + B K).
// All numbers are course numbers for a toy cart, not measurements.
import { dock_run, type DockRun } from './dock';
import {
  CART, cart_step, condense, dlqr, double_integrator, inv_spd, matmul, matvec, rollout, solve_qp, steady_target, sub, transpose, vsub,
  type Mat, type Vec,
} from './math';

const { A, B } = double_integrator(CART.dt);
export const MODEL = { A, B, C: [[1, 0]] as Mat };

// ---------------------------------------------------------------- 1. offset
/** The offset story's numbers. */
export const OFFSET = {
  dt: CART.dt,
  /** The flag: the cart starts parked here and should stay. */
  p_ref: 6,
  /** The headwind, as an acceleration [m/s²] (a 1.75° slope pulls back as much: 9.81 · sin 1.75° ≈ 0.3). */
  d: -0.3,
  /** The winds the world's "new wind" button steps through (the first is d); the learner is not told them. */
  winds: [-0.3, -0.12, 0.2, -0.45],
  /** The wind blows from this instant on (0: from the start, while the cart is parked at the flag). */
  k_on: 0,
  /** The range and step of the hand-set disturbance d̂ (the world's slider). */
  dhat_range: [-0.6, 0.6],
  dhat_step: 0.01,
  /** Length of a run (t = 12 s). */
  steps: 120,
  /** Horizon (2 s) and input weight; the position weight q is the learner's. */
  N: 20,
  r: 0.1,
  /** The position weights the slider offers (Q = diag(q, 0)), and the default. */
  q_stops: [0.1, 0.2, 0.5, 1, 2, 5, 10],
  q_default: 1,
  /** How much of each step's prediction error the estimate takes in (0 < λ ≤ 1). */
  lambda: 0.2,
  /** The instant whose plan is drawn as "what the model expects" (t = 10 s). */
  k_plan: 100,
  /** "On the flag": within 5 mm. */
  tol: 0.005,
} as const;

/** The MPC of the offset story for weight q: Q = diag(q, 0), R = r, P = the LQR cost-to-go, |a| ≤ a_max. */
export interface OffsetMpc {
  q: number;
  /** The LQR gain (u = −K x near rest; the MPC equals it while |a| stays below a_max). */
  K: Mat;
  Kp: number;
  /**
   * Plan from x0 towards the steady target (x_s, u_s) with the model
   * x⁺ = A x + B (u + d̂). Returns the inputs and the predicted states x_0..x_N.
   */
  solve(x0: Vec, x_s: Vec, u_s: number, dhat: number): { U: number[]; X: Vec[]; status: string };
}
const mpc_cache = new Map<number, OffsetMpc>();
export function offset_mpc(q: number): OffsetMpc {
  const hit = mpc_cache.get(q);
  if (hit) return hit;
  const { N, r } = OFFSET;
  const Q: Mat = [[q, 0], [0, 0]], R: Mat = [[r]];
  const { K, P } = dlqr(A, B, Q, R);
  const c = condense(A, B, Q, R, P, N);
  const Hinv = inv_spd(c.H);
  const GtQ = matmul(transpose(c.Gamma), c.Qbar);
  // In the net acceleration w = u + d̂ the model is the nominal x⁺ = A x + B w, the
  // input target is w_s = u_s + d̂, and |u| ≤ a_max becomes −a_max + d̂ ≤ w ≤ a_max + d̂.
  const solve = (x0: Vec, x_s: Vec, u_s: number, dhat: number) => {
    const ws = u_s + dhat;
    const e = vsub(matvec(c.Phi, x0), Array.from({ length: N }, () => x_s).flat());
    const f = matvec(GtQ, e).map((v, i) => 2 * v - 2 * c.Rbar[i][i] * ws);
    const lb = new Array(N).fill(-CART.a_max + dhat), ub = new Array(N).fill(CART.a_max + dhat);
    const res = solve_qp({ H: c.H, f, lb, ub }, { Hinv });
    const W = res.x;
    return { U: W.map((w) => w - dhat), X: rollout(A, B, x0, W.map((w) => [w])), status: res.status };
  };
  const m: OffsetMpc = { q, K, Kp: K[0][0], solve };
  mpc_cache.set(q, m);
  return m;
}

export interface OffsetRun {
  q: number;
  estimate: boolean;
  Kp: number;
  /** True states x_0..x_T (T = OFFSET.steps). */
  x: Vec[];
  /** Applied accelerations u_0..u_{T-1}. */
  u: number[];
  /** The disturbance the controller's model used at each instant (the hand-set value when it does not estimate), d̂_0..d̂_T. */
  dhat: number[];
  /** The true disturbance at each instant (0 before the wind starts). */
  d: number[];
  /** The predicted positions of the plan made at each instant k: p̂_{k}, …, p̂_{k+N}. */
  plan_p: number[][];
  /** Where it rests: p_T − p_ref (negative: short of the flag). */
  offset: number;
  /** The push it holds at the end, u_{T−1}. */
  u_end: number;
}
const run_cache = new Map<string, OffsetRun>();
/**
 * One closed-loop run: parked at the flag, the headwind blows from k_on on.
 * `estimate` off: the model's disturbance is the fixed hand-set `dhat` (0: the
 * nominal MPC, which knows nothing of the wind). On: the estimate starts at 0 and
 * learns from every step's prediction error (offset-free MPC).
 */
export function offset_run(q: number, estimate: boolean, o: { d?: number; dhat?: number; lambda?: number; steps?: number } = {}): OffsetRun {
  const d = o.d ?? OFFSET.d, lambda = o.lambda ?? OFFSET.lambda, steps = o.steps ?? OFFSET.steps, hand = estimate ? 0 : o.dhat ?? 0;
  const key = `${q}|${estimate}|${d}|${hand}|${lambda}|${steps}`;
  const hit = run_cache.get(key);
  if (hit) return hit;
  const mpc = offset_mpc(q);
  const x: Vec[] = [[OFFSET.p_ref, 0]], u: number[] = [], dh: number[] = [hand], dd: number[] = [], plan_p: number[][] = [];
  for (let k = 0; k < steps; k++) {
    const xk = x[k], dhat = dh[k];
    // the target: where the model (with d̂) can rest at the flag
    const tgt = steady_target(A, B, MODEL.C, [OFFSET.p_ref], { Bd: B, d: [dhat] });
    const plan = mpc.solve(xk, tgt.x, tgt.u[0], dhat);
    const uk = plan.U[0];
    u.push(uk);
    plan_p.push(plan.X.map((s) => s[0]));
    const dk = k >= OFFSET.k_on ? d : 0;
    dd.push(dk);
    const xn = cart_step(xk, uk, { d: dk }).x;
    x.push(xn);
    // what the model predicted for this step, and the acceleration it could not explain
    const pred = matvec(A, xk).map((v, i) => v + B[i][0] * (uk + dhat));
    const surprise = (xn[1] - pred[1]) / OFFSET.dt;
    dh.push(estimate ? dhat + lambda * surprise : hand);
  }
  const run: OffsetRun = { q, estimate, Kp: mpc.Kp, x, u, dhat: dh, d: dd, plan_p, offset: x[steps][0] - OFFSET.p_ref, u_end: u[steps - 1] };
  run_cache.set(key, run);
  return run;
}
/** The steady-state offset of a controller with gain K_p against a constant d when its model assumes d̂: e = (d − d̂) / K_p. */
export const offset_formula = (d: number, Kp: number, dhat = 0): number => (d - dhat) / Kp;

/**
 * Detectability of the augmented model (RMD Lemma 1.8): rank [[I − A, −B_d], [C, C_d]]
 * must be n + n_d. For the cart with one disturbance this 3 × 3 matrix must be invertible.
 */
export function augmented_rank_matrix(Bd: Vec, Cd: number): Mat {
  return [
    [1 - A[0][0], -A[0][1], -Bd[0]],
    [-A[1][0], 1 - A[1][1], -Bd[1]],
    [MODEL.C[0][0], MODEL.C[0][1], Cd],
  ];
}
export const det3 = (M: Mat): number =>
  M[0][0] * (M[1][1] * M[2][2] - M[1][2] * M[2][1]) - M[0][1] * (M[1][0] * M[2][2] - M[1][2] * M[2][0]) + M[0][2] * (M[1][0] * M[2][1] - M[1][1] * M[2][0]);

// ---------------------------------------------------------------- random numbers (seeded)
/** A small seeded generator (mulberry32): the same seed gives the same "noise" on every machine. */
export function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
/** Standard normal samples from a uniform generator (Box–Muller). */
export function gauss(u: () => number): () => number {
  return () => Math.sqrt(-2 * Math.log(Math.max(1e-12, u()))) * Math.cos(2 * Math.PI * u());
}

// ---------------------------------------------------------------- 2. Kalman filter
/** The estimation story's numbers. */
export const KALMAN = {
  dt: CART.dt,
  /** Position sensor noise (standard deviation) [m]. */
  sigma_y: 0.05,
  /** Unmodelled acceleration per step (standard deviation) [m/s²]: bumps, wind. */
  sigma_a: 0.3,
  steps: 60,
  seed: 7,
} as const;
/** The commanded acceleration at instant k: speed up, cruise, slow down (the filter knows it). */
export const kalman_input = (k: number): number => (k < 15 ? 0.6 : k < 35 ? 0 : k < 50 ? -0.5 : 0);

export interface KalmanRun {
  /** True states, measurements y_k = p_k + noise, and the filter's estimates after each correction. */
  x: Vec[];
  y: number[];
  /** x̂⁻_k (predicted, before y_k) and x̂_k (after the correction), k = 0..T. */
  pred: Vec[];
  est: Vec[];
  /** Position variances before and after each correction, and the gain L_k = [L_p, L_v]. */
  var_pred: number[];
  var_est: number[];
  L: Vec[];
  /** Velocity from differencing the measurements, (y_k − y_{k−1}) / Δt (NaN at k = 0). */
  v_diff: number[];
}
/**
 * The cart with random unmodelled accelerations (std sigma_a), measured in
 * position only (std sigma_y), and a Kalman filter on [p, v] with
 * W = B Bᵀ sigma_a² and V = sigma_y². `trust` scales V (bigger: trust the sensor less).
 */
export function kalman_run(o: { sigma_y?: number; sigma_a?: number; steps?: number; seed?: number; trust?: number } = {}): KalmanRun {
  const sy = o.sigma_y ?? KALMAN.sigma_y, sa = o.sigma_a ?? KALMAN.sigma_a, T = o.steps ?? KALMAN.steps;
  const g = gauss(rng(o.seed ?? KALMAN.seed));
  const W: Mat = matmul(B, transpose(B)).map((r) => r.map((v) => v * sa * sa));
  const V = sy * sy * (o.trust ?? 1);
  const x: Vec[] = [[0, 0]], y: number[] = [], pred: Vec[] = [], est: Vec[] = [], var_pred: number[] = [], var_est: number[] = [], L: Vec[] = [], v_diff: number[] = [];
  // the filter starts from the known start (at rest at 0) with an honest uncertainty
  let xh: Vec = [0, 0];
  let P: Mat = [[sy * sy * 4, 0], [0, 0.25]];
  for (let k = 0; k <= T; k++) {
    if (k > 0) {
      const u = kalman_input(k - 1);
      x.push(cart_step(x[k - 1], u, { d: sa * g() }).x);
      // predict with the model
      xh = matvec(A, xh).map((v, i) => v + B[i][0] * u);
      P = matmul(matmul(A, P), transpose(A)).map((r, i) => r.map((v, j) => v + W[i][j]));
    }
    const yk = x[k][0] + sy * g();
    y.push(yk);
    v_diff.push(k ? (yk - y[k - 1]) / KALMAN.dt : NaN);
    pred.push(xh.slice());
    var_pred.push(P[0][0]);
    // correct with the measurement: L = P⁻Cᵀ (C P⁻ Cᵀ + V)⁻¹, C = [1, 0]
    const S = P[0][0] + V;
    const Lk = [P[0][0] / S, P[1][0] / S];
    const innov = yk - xh[0];
    xh = [xh[0] + Lk[0] * innov, xh[1] + Lk[1] * innov];
    P = [
      [(1 - Lk[0]) * P[0][0], (1 - Lk[0]) * P[0][1]],
      [P[1][0] - Lk[1] * P[0][0], P[1][1] - Lk[1] * P[0][1]],
    ];
    est.push(xh.slice());
    var_est.push(P[0][0]);
    L.push(Lk);
  }
  return { x, y, pred, est, var_pred, var_est, L, v_diff };
}
/** RMS of a list (NaN entries skipped). */
export function rms(v: number[]): number {
  const f = v.filter((a) => Number.isFinite(a));
  return Math.sqrt(f.reduce((s, a) => s + a * a, 0) / Math.max(1, f.length));
}

// ---------------------------------------------------------------- 3. tube
/** The tube story's numbers. */
export const TUBE = {
  dt: CART.dt,
  /** Bound on the unknown acceleration [m/s²]. */
  w_max: 0.15,
  /** Weights of the ancillary feedback u = ū − K (x − x̄). */
  Q: [[1, 0], [0, 0]] as Mat,
  R: [[1]] as Mat,
  /** Horizon of the nominal docking MPC, and the run length. */
  N: 30,
  steps: 90,
  /** Number of random disturbance histories drawn, and the seed. */
  runs: 12,
  seed: 3,
} as const;

/** The ancillary gain (dlqr) and its closed loop A_K = A − B K. */
export function tube_gain(): { K: Mat; AK: Mat } {
  const { K } = dlqr(A, B, TUBE.Q, TUBE.R);
  return { K, AK: sub(A, matmul(B, K)) };
}
/**
 * Half-widths of the disturbance-invariant set S = Σ_j A_K^j B [−w̄, w̄] (RMD §3.5) in
 * position, speed and in the feedback's input K e: the support of the sum,
 * Σ_j |c A_K^j B| w̄, summed until the terms vanish.
 */
export function tube_widths(w_max: number = TUBE.w_max): { p: number; v: number; u: number } {
  const { K, AK } = tube_gain();
  let M: Mat = [[1, 0], [0, 1]];
  let p = 0, v = 0, u = 0;
  for (let j = 0; j < 5000; j++) {
    const c = matmul(M, B);
    const cp = Math.abs(c[0][0]), cv = Math.abs(c[1][0]), cu = Math.abs(K[0][0] * c[0][0] + K[0][1] * c[1][0]);
    p += cp;
    v += cv;
    u += cu;
    if (cp + cv + cu < 1e-12) break;
    M = matmul(AK, M);
  }
  return { p: p * w_max, v: v * w_max, u: u * w_max };
}
/** The nominal docking plan: M1's docking MPC on the nominal model, with the input and speed limits tightened, and optionally the wall. */
export function tube_nominal(tighten_wall: boolean): DockRun {
  const h = tube_widths();
  return dock_run(TUBE.N, { a_max: CART.a_max - h.u, v_max: CART.v_max - h.v, wall: tighten_wall ? CART.p_max - h.p : CART.p_max, steps: TUBE.steps });
}
/** A bounded disturbance history: values uniform in [−w̄, w̄], each held for 5–14 steps. */
export function disturbance_history(seed: number, steps: number = TUBE.steps, w_max: number = TUBE.w_max): number[] {
  const u = rng(seed), out: number[] = [];
  while (out.length < steps) {
    const w = (2 * u() - 1) * w_max, hold = 5 + Math.floor(u() * 10);
    for (let i = 0; i < hold && out.length < steps; i++) out.push(w);
  }
  return out;
}
/**
 * The real cart following a nominal plan under a disturbance history: open loop
 * (apply ū as planned) or with the feedback u = ū − K (x − x̄). No wall stops it
 * (the drawing shows where it would hit). Returns the positions p_0..p_T and the inputs.
 */
export function tube_follow(nom: DockRun, w: number[], feedback: boolean): { p: number[]; u: number[]; e: Vec[] } {
  const { K } = tube_gain();
  let x: Vec = nom.x[0].slice();
  const p: number[] = [x[0]], us: number[] = [], e: Vec[] = [[0, 0]];
  for (let k = 0; k < nom.u.length && k < w.length; k++) {
    const xb = nom.x[k];
    const err = [x[0] - xb[0], x[1] - xb[1]];
    const uk = nom.u[k] - (feedback ? K[0][0] * err[0] + K[0][1] * err[1] : 0);
    us.push(uk);
    x = cart_step(x, uk, { d: w[k] }).x;
    p.push(x[0]);
    e.push([x[0] - nom.x[k + 1][0], x[1] - nom.x[k + 1][1]]);
  }
  return { p, u: us, e };
}
