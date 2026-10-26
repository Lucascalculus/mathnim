// M8's running example (docs/lessons/mpc, M8): a car tracking a curved road
// with the kinematic bicycle model, and a small nonlinear MPC for it.
//
// The model (Kong et al. 2015; Polack et al. 2018, eq. 1, after Rajamani 2012),
// state x = (X, Y, ψ, v), input u = (a, δ):
//   Ẋ = v cos(ψ + β),  Ẏ = v sin(ψ + β),  ψ̇ = (v / l_r) sin β,  v̇ = a,
//   β = atan( l_r / (l_f + l_r) · tan δ )   (slip angle at the centre of gravity),
// integrated over each sample with one RK4 step (Δt = 0.1 s, input held).
//
// The NMPC: tracking cost over N steps, bounds on a and δ, solved by
// Gauss–Newton SQP in single shooting (the decision variables are the N
// inputs; the states follow by simulation). One SQP iteration linearises the
// predicted trajectory around a guess Ū (A_k, B_k by central differences),
// stacks the sensitivities into G = ∂X/∂U, forms the QP in ΔU with the kit's
// solve_qp, and takes the full step U = Ū + ΔU. At every sample it starts from
//   - 'warm': the previous plan shifted by one step (the last input repeated), or
//   - 'cold': no steering and no acceleration ("drive straight ahead"),
// and runs `iters` QPs (1 = the real-time iteration of Diehl et al. 2002;
// 'conv' = until the step is tiny, at most 25). All numbers are toy numbers
// for the course (not a real vehicle); the plant is the same model, so every
// difference in the closed loop comes from the optimisation, not the model.
import { solve_qp, type Mat, type Vec } from './math';

/** Course numbers (toy car, not a real vehicle). */
export const CAR = {
  dt: 0.1,
  /** Distances from the centre of gravity to the front and rear axles [m]. */
  lf: 1.4,
  lr: 1.4,
  /** Steering limit [rad] (about 29°) and acceleration limits [m/s²]. */
  delta_max: 0.5,
  a_min: -4,
  a_max: 2,
  /** Reference speed along the road [m/s]: the S then peaks at about 4.3 m/s² of lateral acceleration, under 0.5 g. */
  v_ref: 6,
  /** Half the lane width [m]: the car "leaves its lane" when its centre is farther than this from the centre line. */
  lane: 1.5,
} as const;

// ---------------------------------------------------------------- the model
/** Slip angle at the centre of gravity for a front steering angle δ. */
export const slip = (delta: number): number => Math.atan((CAR.lr / (CAR.lf + CAR.lr)) * Math.tan(delta));
/** ẋ = f(x, u) of the kinematic bicycle. */
export function bicycle_rhs(x: Vec, u: Vec): Vec {
  const psi = x[2], v = x[3];
  const b = slip(u[1]);
  return [v * Math.cos(psi + b), v * Math.sin(psi + b), (v / CAR.lr) * Math.sin(b), u[0]];
}
/** One sample with the input held: x⁺ = F(x, u) (one RK4 step). */
export function car_step(x: Vec, u: Vec, dt: number = CAR.dt): Vec {
  const k1 = bicycle_rhs(x, u);
  const k2 = bicycle_rhs(x.map((v, i) => v + 0.5 * dt * k1[i]), u);
  const k3 = bicycle_rhs(x.map((v, i) => v + 0.5 * dt * k2[i]), u);
  const k4 = bicycle_rhs(x.map((v, i) => v + dt * k3[i]), u);
  return x.map((v, i) => v + (dt / 6) * (k1[i] + 2 * k2[i] + 2 * k3[i] + k4[i]));
}
/** The states x_0..x_N reached from x0 with inputs U (a "single shooting" simulation). */
export function car_rollout(x0: Vec, U: Vec[]): Vec[] {
  const X = [x0.slice()];
  for (const u of U) X.push(car_step(X[X.length - 1], u));
  return X;
}
/** A_k = ∂F/∂x and B_k = ∂F/∂u at (x, u), by central differences. */
export function car_jacobians(x: Vec, u: Vec): { A: Mat; B: Mat } {
  const h = 1e-6;
  const A: Mat = [[], [], [], []], B: Mat = [[], [], [], []];
  for (let j = 0; j < 4; j++) {
    const xp = x.slice(), xm = x.slice();
    xp[j] += h;
    xm[j] -= h;
    const fp = car_step(xp, u), fm = car_step(xm, u);
    for (let i = 0; i < 4; i++) A[i][j] = (fp[i] - fm[i]) / (2 * h);
  }
  for (let j = 0; j < 2; j++) {
    const up = u.slice(), um = u.slice();
    up[j] += h;
    um[j] -= h;
    const fp = car_step(x, up), fm = car_step(x, um);
    for (let i = 0; i < 4; i++) B[i][j] = (fp[i] - fm[i]) / (2 * h);
  }
  return { A, B };
}
/**
 * The same model linearised once, about driving straight along ψ = ψ₀ at speed v₀
 * with no steering (what a linear MPC built for that operating point predicts):
 * x⁺ = F(x̄) + A (x − x̄) + B (u − ū), with A, B taken at (x̄ = (X, Y, ψ₀, v₀), ū = 0).
 */
export function linear_rollout(x0: Vec, U: Vec[]): Vec[] {
  const { A, B } = car_jacobians([0, 0, x0[2], x0[3]], [0, 0]);
  const X = [x0.slice()];
  for (const u of U) {
    const x = X[X.length - 1];
    const xbar = [x[0], x[1], x0[2], x0[3]];
    const f = car_step(xbar, [0, 0]);
    const dx = x.map((v, i) => v - xbar[i]);
    X.push(f.map((v, i) => v + A[i].reduce((s, a, j) => s + a * dx[j], 0) + B[i][0] * u[0] + B[i][1] * u[1]));
  }
  return X;
}

// ---------------------------------------------------------------- the road
export type Segment = { straight: number } | { arc: number; angle: number };
export interface Road {
  /** Samples every `ds` metres of arc length: position, heading (unwrapped), curvature. */
  s: number[];
  x: number[];
  y: number[];
  psi: number[];
  kappa: number[];
  ds: number;
  length: number;
}
/** A road from straight pieces and circular arcs (radius > 0, angle > 0 turns left). */
export function make_road(segs: Segment[], start: { x: number; y: number; psi: number } = { x: 0, y: 0, psi: 0 }, ds = 0.05): Road {
  const r: Road = { s: [0], x: [start.x], y: [start.y], psi: [start.psi], kappa: [0], ds, length: 0 };
  let x = start.x, y = start.y, psi = start.psi, s = 0;
  for (const g of segs) {
    const L = 'straight' in g ? g.straight : g.arc * Math.abs(g.angle);
    const kap = 'straight' in g ? 0 : Math.sign(g.angle) / g.arc;
    const n = Math.max(1, Math.round(L / ds));
    const h = L / n;
    for (let i = 0; i < n; i++) {
      // exact integration of a constant-curvature piece
      if (kap === 0) {
        x += h * Math.cos(psi);
        y += h * Math.sin(psi);
      } else {
        const p2 = psi + kap * h;
        x += (Math.sin(p2) - Math.sin(psi)) / kap;
        y += (Math.cos(psi) - Math.cos(p2)) / kap;
        psi = p2;
      }
      s += h;
      r.s.push(s);
      r.x.push(x);
      r.y.push(y);
      r.psi.push(psi);
      r.kappa.push(kap);
    }
  }
  r.length = s;
  return r;
}
/** The point of the road at arc length s (linear between samples; continued straight beyond the end). */
export function road_at(r: Road, s: number): { x: number; y: number; psi: number; kappa: number } {
  if (s >= r.length) {
    const n = r.s.length - 1, d = s - r.length;
    return { x: r.x[n] + d * Math.cos(r.psi[n]), y: r.y[n] + d * Math.sin(r.psi[n]), psi: r.psi[n], kappa: 0 };
  }
  const f = Math.max(0, s) / r.ds;
  const i = Math.min(r.s.length - 2, Math.floor(f)), t = f - i;
  return { x: r.x[i] + t * (r.x[i + 1] - r.x[i]), y: r.y[i] + t * (r.y[i + 1] - r.y[i]), psi: r.psi[i] + t * (r.psi[i + 1] - r.psi[i]), kappa: r.kappa[i] };
}
/**
 * Project a position onto the road near arc length `s_guess` (a window from
 * 3 m behind to 12 m ahead): the arc length of the nearest point and the signed
 * lateral error (positive: left of the road).
 */
export function project(r: Road, px: number, py: number, s_guess: number): { s: number; e: number } {
  const i0 = Math.max(0, Math.floor((s_guess - 3) / r.ds)), i1 = Math.min(r.s.length - 1, Math.ceil((s_guess + 12) / r.ds));
  let best = i0, bd = Infinity;
  for (let i = i0; i <= i1; i++) {
    const d = (r.x[i] - px) ** 2 + (r.y[i] - py) ** 2;
    if (d < bd) {
      bd = d;
      best = i;
    }
  }
  const nx = -Math.sin(r.psi[best]), ny = Math.cos(r.psi[best]);
  return { s: r.s[best], e: (px - r.x[best]) * nx + (py - r.y[best]) * ny };
}

/** The course's road: straight, a 90° left bend, a short straight, a 90° right bend, then a straight (an S). */
export const S_ROAD: Segment[] = [{ straight: 12 }, { arc: 9, angle: Math.PI / 2 }, { straight: 4 }, { arc: 9, angle: -Math.PI / 2 }, { straight: 30 }];

// ---------------------------------------------------------------- the NMPC
export interface NmpcWeights {
  /** Position error [1/m²], heading error [1/rad²], speed error [s²/m²]. */
  q_pos: number;
  q_psi: number;
  q_v: number;
  /** Inputs (a, δ) and their changes from one step to the next. */
  r_a: number;
  r_d: number;
  s_a: number;
  s_d: number;
  /** Extra factor on the last predicted state. */
  terminal: number;
}
export const WEIGHTS: NmpcWeights = { q_pos: 1, q_psi: 1, q_v: 0.2, r_a: 0.05, r_d: 1, s_a: 0.1, s_d: 20, terminal: 3 };

/** One reference point per predicted state x_1..x_N: (X, Y, ψ, v). */
export type Ref = Vec[];
/** The reference for the horizon: N points ahead along the road from s0, spaced v_ref·Δt. */
export function horizon_ref(r: Road, s0: number, N: number, v_ref: number = CAR.v_ref): Ref {
  return Array.from({ length: N }, (_, k) => {
    const p = road_at(r, s0 + v_ref * CAR.dt * (k + 1));
    return [p.x, p.y, p.psi, v_ref];
  });
}
/** Horizon cost J(U) of a plan from x0 (the quantity every QP decreases). */
export function plan_cost(x0: Vec, U: Vec[], ref: Ref, u_prev: Vec, w: NmpcWeights = WEIGHTS): number {
  const X = car_rollout(x0, U);
  let J = 0;
  for (let k = 0; k < U.length; k++) {
    const x = X[k + 1], q = k === U.length - 1 ? w.terminal : 1;
    J += q * (w.q_pos * ((x[0] - ref[k][0]) ** 2 + (x[1] - ref[k][1]) ** 2) + w.q_psi * (x[2] - ref[k][2]) ** 2 + w.q_v * (x[3] - ref[k][3]) ** 2);
    const up = k ? U[k - 1] : u_prev;
    J += w.r_a * U[k][0] ** 2 + w.r_d * U[k][1] ** 2 + w.s_a * (U[k][0] - up[0]) ** 2 + w.s_d * (U[k][1] - up[1]) ** 2;
  }
  return J;
}

export interface GnStep {
  /** The new plan Ū + ΔU. */
  U: Vec[];
  /** What the QP's linearised model predicted for it: X̄ + G ΔU (x_0..x_N). */
  X_lin: Vec[];
  /** The guess's own trajectory X̄ (x_0..x_N), around which the model was linearised. */
  X_guess: Vec[];
  /** Size of the step, max |ΔU|. */
  step: number;
  status: string;
}
/**
 * One Gauss–Newton SQP iteration (single shooting): linearise the trajectory of
 * the guess Ū from x0, solve the QP for ΔU with the bounds on a and δ, and take
 * the full step.
 */
export function gn_step(x0: Vec, Ubar: Vec[], ref: Ref, u_prev: Vec, w: NmpcWeights = WEIGHTS): GnStep {
  const N = Ubar.length, n = 4, m = 2, nu = m * N;
  const Xb = car_rollout(x0, Ubar);
  const AB = Ubar.map((u, k) => car_jacobians(Xb[k], u));
  // G[k] (n × nu): ∂x_{k+1}/∂U, built forward: G_{k+1} = A_k G_k + [0 … B_k … 0]
  const G: Mat[] = [];
  let Gk: Mat = Array.from({ length: n }, () => new Array(nu).fill(0));
  for (let k = 0; k < N; k++) {
    const { A, B } = AB[k];
    const next: Mat = Array.from({ length: n }, () => new Array(nu).fill(0));
    for (let i = 0; i < n; i++) {
      for (let c = 0; c < nu; c++) {
        let s = 0;
        for (let j = 0; j < n; j++) s += A[i][j] * Gk[j][c];
        next[i][c] = s;
      }
      next[i][k * m] += B[i][0];
      next[i][k * m + 1] += B[i][1];
    }
    G.push(next);
    Gk = next;
  }
  // cost ½ ΔUᵀ H ΔU + fᵀ ΔU (Gauss–Newton: residuals linearised, H = 2 Σ JᵀWJ)
  const H: Mat = Array.from({ length: nu }, () => new Array(nu).fill(0));
  const f: Vec = new Array(nu).fill(0);
  const qd = [w.q_pos, w.q_pos, w.q_psi, w.q_v];
  for (let k = 0; k < N; k++) {
    const q = k === N - 1 ? w.terminal : 1;
    const e = Xb[k + 1].map((v, i) => v - ref[k][i]);
    const Gm = G[k];
    for (let i = 0; i < n; i++) {
      const wi = 2 * q * qd[i];
      if (!wi) continue;
      const row = Gm[i];
      for (let a = 0; a <= k * m + 1; a++) {
        if (!row[a]) continue;
        f[a] += wi * row[a] * e[i];
        for (let b = 0; b <= k * m + 1; b++) H[a][b] += wi * row[a] * row[b];
      }
    }
  }
  const ra = [w.r_a, w.r_d], sa = [w.s_a, w.s_d];
  for (let k = 0; k < N; k++) {
    for (let j = 0; j < m; j++) {
      const i = k * m + j;
      H[i][i] += 2 * ra[j];
      f[i] += 2 * ra[j] * Ubar[k][j];
      // rate term s (u_k − u_{k−1})²
      const prev = k ? Ubar[k - 1][j] : u_prev[j];
      const d = Ubar[k][j] - prev;
      H[i][i] += 2 * sa[j];
      f[i] += 2 * sa[j] * d;
      if (k) {
        const ip = (k - 1) * m + j;
        H[ip][ip] += 2 * sa[j];
        H[i][ip] -= 2 * sa[j];
        H[ip][i] -= 2 * sa[j];
        f[ip] -= 2 * sa[j] * d;
      }
    }
  }
  const lb: Vec = [], ub: Vec = [];
  for (let k = 0; k < N; k++) {
    lb.push(CAR.a_min - Ubar[k][0], -CAR.delta_max - Ubar[k][1]);
    ub.push(CAR.a_max - Ubar[k][0], CAR.delta_max - Ubar[k][1]);
  }
  const res = solve_qp({ H, f, lb, ub });
  const dU = res.status === 'optimal' ? res.x : new Array(nu).fill(0);
  const U = Ubar.map((u, k) => [u[0] + dU[2 * k], u[1] + dU[2 * k + 1]]);
  const X_lin = [x0.slice()];
  for (let k = 0; k < N; k++) {
    const d = G[k].map((row) => row.reduce((s, g, c) => s + g * dU[c], 0));
    X_lin.push(Xb[k + 1].map((v, i) => v + d[i]));
  }
  return { U, X_lin, X_guess: Xb, step: Math.max(...dU.map(Math.abs)), status: res.status };
}

export type Guess = 'warm' | 'cold';
export type Iters = 1 | 2 | 3 | 'conv';
export interface NmpcSolve {
  U: Vec[];
  X_lin: Vec[];
  X_guess: Vec[];
  /** QPs solved. */
  qps: number;
  step: number;
}
/** Run `iters` Gauss–Newton iterations from the guess (or until the step is below 1e-4, at most 25). */
export function nmpc_solve(x0: Vec, guess: Vec[], ref: Ref, u_prev: Vec, iters: Iters, w: NmpcWeights = WEIGHTS): NmpcSolve {
  const max = iters === 'conv' ? 25 : iters;
  let U = guess, last: GnStep | null = null, first: Vec[] | null = null, qps = 0;
  for (let i = 0; i < max; i++) {
    last = gn_step(x0, U, ref, u_prev, w);
    if (!first) first = last.X_guess;
    U = last.U;
    qps++;
    if (iters === 'conv' && last.step < 1e-4) break;
  }
  return { U, X_lin: last!.X_lin, X_guess: first!, qps, step: last!.step };
}

/** The guess for the next sample: the plan shifted by one step, its last input repeated. */
export const shift = (U: Vec[]): Vec[] => [...U.slice(1).map((u) => u.slice()), U[U.length - 1].slice()];
export const straight_guess = (N: number): Vec[] => Array.from({ length: N }, () => [0, 0]);

export interface TrackRun {
  guess: Guess;
  iters: Iters;
  N: number;
  /** States x_0..x_T of the car and applied inputs u_0..u_{T-1}. */
  x: Vec[];
  u: Vec[];
  /** Per sample: the plan's linearised prediction, the guess's trajectory, the true trajectory of the plan, and the reference. */
  plans: { X_lin: Vec[]; X_guess: Vec[]; X_true: Vec[]; ref: Ref }[];
  /** Signed lateral error at each instant [m] and the road's arc length at the car. */
  e: number[];
  s: number[];
  qps: number[];
  max_e: number;
  /** First instant with |e| above CAR.lane (−1: never). */
  left_lane_k: number;
  /** Mean QPs per sample. */
  mean_qps: number;
}

const runs = new Map<string, TrackRun>();
export const ROAD = make_road(S_ROAD);
/** Samples in a run (8 s: the S ends at 44 m, after about 7.4 s at 6 m/s). */
export const STEPS = 80;

/** The closed loop on the S road (cached): NMPC with horizon N, the given guess and QPs per sample. */
export function track_run(guess: Guess, iters: Iters, N = 20, steps: number = STEPS): TrackRun {
  const key = `${guess}|${iters}|${N}|${steps}`;
  const hit = runs.get(key);
  if (hit) return hit;
  const road = ROAD;
  let x: Vec = [road.x[0], road.y[0], road.psi[0], CAR.v_ref];
  const xs = [x], us: Vec[] = [], plans: TrackRun['plans'] = [], e: number[] = [], ss: number[] = [], qps: number[] = [];
  let s = 0, U = straight_guess(N), u_prev: Vec = [0, 0];
  let left = -1;
  const p0 = project(road, x[0], x[1], 0);
  s = p0.s;
  e.push(p0.e);
  ss.push(s);
  for (let k = 0; k < steps; k++) {
    const ref = horizon_ref(road, s, N);
    const g = k === 0 ? straight_guess(N) : guess === 'warm' ? shift(U) : straight_guess(N);
    const sol = nmpc_solve(x, g, ref, u_prev, iters);
    U = sol.U;
    plans.push({ X_lin: sol.X_lin, X_guess: sol.X_guess, X_true: car_rollout(x, U), ref });
    qps.push(sol.qps);
    const u = U[0];
    us.push(u);
    u_prev = u;
    x = car_step(x, u);
    xs.push(x);
    const p = project(road, x[0], x[1], s);
    s = p.s;
    e.push(p.e);
    ss.push(s);
    if (left < 0 && Math.abs(p.e) > CAR.lane) left = k + 1;
  }
  const run: TrackRun = {
    guess, iters, N, x: xs, u: us, plans, e, s: ss, qps,
    max_e: Math.max(...e.map(Math.abs)), left_lane_k: left,
    mean_qps: qps.reduce((a, b) => a + b, 0) / qps.length,
  };
  runs.set(key, run);
  return run;
}

// ---------------------------------------------------------------- multiple shooting (for the shooting picture)
export interface MsStep {
  /** Interval-start states s_1..s_N (s_0 = x0 is fixed) and inputs after the step. */
  S: Vec[];
  U: Vec[];
  /** Largest gap |F(s_k, u_k) − s_{k+1}| (position part, metres) after the step. */
  gap: number;
  status: string;
}
/** Position gaps |F(s_k, u_k) − s_{k+1}| of a multiple-shooting iterate (k = 0..N−1, s_0 = x0). */
export function ms_gaps(x0: Vec, S: Vec[], U: Vec[]): number[] {
  return U.map((u, k) => {
    const f = car_step(k ? S[k - 1] : x0, u);
    return Math.hypot(f[0] - S[k][0], f[1] - S[k][1]);
  });
}
/**
 * One Gauss–Newton iteration in multiple shooting: the decision variables are
 * the inputs and the interval-start states; the dynamics are equality
 * constraints s_{k+1} = F(s_k, u_k), linearised at the iterate (so gaps close
 * as the iterations converge). Same cost and bounds as gn_step: at the
 * solution both give the same plan.
 */
export function ms_gn_step(x0: Vec, Sb: Vec[], Ub: Vec[], ref: Ref, u_prev: Vec, w: NmpcWeights = WEIGHTS): MsStep {
  const N = Ub.length, n = 4, m = 2, nu = m * N, nz = nu + n * N;
  const H: Mat = Array.from({ length: nz }, () => new Array(nz).fill(0));
  const f: Vec = new Array(nz).fill(0);
  const ra = [w.r_a, w.r_d], sa = [w.s_a, w.s_d];
  for (let k = 0; k < N; k++) {
    for (let j = 0; j < m; j++) {
      const i = k * m + j;
      H[i][i] += 2 * ra[j] + 2 * sa[j];
      f[i] += 2 * ra[j] * Ub[k][j];
      const prev = k ? Ub[k - 1][j] : u_prev[j];
      const d = Ub[k][j] - prev;
      f[i] += 2 * sa[j] * d;
      if (k) {
        const ip = (k - 1) * m + j;
        H[ip][ip] += 2 * sa[j];
        H[i][ip] -= 2 * sa[j];
        H[ip][i] -= 2 * sa[j];
        f[ip] -= 2 * sa[j] * d;
      }
    }
  }
  const qd = [w.q_pos, w.q_pos, w.q_psi, w.q_v];
  for (let k = 0; k < N; k++) {
    const q = k === N - 1 ? w.terminal : 1;
    for (let i = 0; i < n; i++) {
      const c = nu + k * n + i;
      H[c][c] += 2 * q * qd[i];
      f[c] += 2 * q * qd[i] * (Sb[k][i] - ref[k][i]);
    }
  }
  // δs_{k+1} − A_k δs_k − B_k δu_k = F(s̄_k, ū_k) − s̄_{k+1}
  const Aeq: Mat = [], beq: Vec = [];
  for (let k = 0; k < N; k++) {
    const sk = k ? Sb[k - 1] : x0;
    const { A, B } = car_jacobians(sk, Ub[k]);
    const F = car_step(sk, Ub[k]);
    for (let i = 0; i < n; i++) {
      const row = new Array(nz).fill(0);
      row[nu + k * n + i] = 1;
      if (k) for (let j = 0; j < n; j++) row[nu + (k - 1) * n + j] -= A[i][j];
      row[k * m] -= B[i][0];
      row[k * m + 1] -= B[i][1];
      Aeq.push(row);
      beq.push(F[i] - Sb[k][i]);
    }
  }
  const lb: Vec = new Array(nz).fill(-Infinity), ub: Vec = new Array(nz).fill(Infinity);
  for (let k = 0; k < N; k++) {
    lb[2 * k] = CAR.a_min - Ub[k][0];
    lb[2 * k + 1] = -CAR.delta_max - Ub[k][1];
    ub[2 * k] = CAR.a_max - Ub[k][0];
    ub[2 * k + 1] = CAR.delta_max - Ub[k][1];
  }
  const res = solve_qp({ H, f, Aeq, beq, lb, ub });
  const z = res.status === 'optimal' ? res.x : new Array(nz).fill(0);
  const U = Ub.map((u, k) => [u[0] + z[2 * k], u[1] + z[2 * k + 1]]);
  const S = Sb.map((s, k) => s.map((v, i) => v + z[nu + k * n + i]));
  return { S, U, gap: Math.max(...ms_gaps(x0, S, U)), status: res.status };
}

export interface ShootingIterates {
  x0: Vec;
  ref: Ref;
  /** Single shooting: the inputs and the trajectory (x_0..x_N) of each iterate, from the guess (index 0) on. */
  single: { U: Vec[]; X: Vec[] }[];
  /** Multiple shooting: inputs, interval-start states s_1..s_N and the largest gap of each iterate. */
  multiple: { U: Vec[]; S: Vec[]; gap: number }[];
}
/**
 * Lateral offsets [m] of the multiple-shooting start states from the road: a
 * fixed, irregular pattern standing in for "states from rough data" (e.g. a
 * noisy recording of an earlier drive), so that the pieces visibly do not join
 * at first. RMD §8.5.2: the node states "can be initialised from data".
 */
export const MS_OFFSETS = (N: number): number[] => Array.from({ length: N }, (_, k) => 0.55 * Math.sin(1.9 * k + 0.7) + 0.25 * Math.sin(4.3 * k + 2.1));
/**
 * The shooting picture: one horizon of the car entering the first bend,
 * solved from scratch by both methods (`iters` Gauss–Newton iterations each).
 * Single shooting starts from "straight ahead" (U = 0); multiple shooting from
 * the same inputs but with its node states laid near the road (the reference
 * moved sideways by MS_OFFSETS, heading and speed as the reference's).
 */
export function shooting_iterates(iters = 5, N = 25, s0 = 6): ShootingIterates {
  const p = road_at(ROAD, s0);
  const x0 = [p.x, p.y, p.psi, CAR.v_ref];
  const ref = horizon_ref(ROAD, s0, N);
  const u_prev = [0, 0];
  let U = straight_guess(N);
  const single = [{ U, X: car_rollout(x0, U) }];
  for (let i = 0; i < iters; i++) {
    U = gn_step(x0, U, ref, u_prev).U;
    single.push({ U, X: car_rollout(x0, U) });
  }
  const off = MS_OFFSETS(N);
  let Um = straight_guess(N), S = ref.map((r, k) => [r[0] - off[k] * Math.sin(r[2]), r[1] + off[k] * Math.cos(r[2]), r[2], r[3]]);
  const multiple = [{ U: Um, S, gap: Math.max(...ms_gaps(x0, S, Um)) }];
  for (let i = 0; i < iters; i++) {
    const st = ms_gn_step(x0, S, Um, ref, u_prev);
    Um = st.U;
    S = st.S;
    multiple.push({ U: Um, S, gap: st.gap });
  }
  return { x0, ref, single, multiple };
}
