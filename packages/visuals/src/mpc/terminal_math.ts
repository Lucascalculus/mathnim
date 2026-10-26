// M6 (pure math): why a short-sighted MPC crashes although every QP it solved
// was feasible, and what the terminal ingredients change. The cart docks against
// the wall as in M1 (Q = diag(1, 0), R = 0.1, |a| up to 1, |v| up to 2, p up to 10,
// target p = 10, Δt = 0.1 s). Four choices for the end of the plan:
//   'none'  nothing beyond the state limits on x_N (M1's controller);
//   'cost'  terminal cost x_Nᵀ P x_N with P the LQR cost-to-go (dlqr);
//   'set'   terminal set X_f = {p + c v up to 10} (plus the state limits), c = v_max/a_max − Δt/2,
//           which is control invariant under "brake to rest";
//   'end'   x_N = target (the classic terminal equality constraint).
// When a QP is infeasible the cart brakes to rest (the fallback). Everything is a
// simulation of the course's toy cart; nothing is measured.
import { CART, cart_step, condense, dlqr, double_integrator, make_mpc, solve_qp, type Mat, type Vec } from './math';

export type Mode = 'none' | 'cost' | 'set' | 'end';
export const MODES: Mode[] = ['none', 'cost', 'set', 'end'];
const { A, B } = double_integrator(CART.dt);
const Q: Mat = [[1, 0], [0, 0]], R: Mat = [[0.1]];
const WALL = CART.p_max, AMAX = CART.a_max, VMAX = CART.v_max, DT = CART.dt;

/** The LQR of the docking cost: gain, cost-to-go P and closed-loop matrix. */
export function dock_lqr(): { K: Mat; P: Mat; Acl: Mat } {
  const l = dlqr(A, B, Q, R);
  const Acl = A.map((row, i) => row.map((v, j) => v - B[i][0] * l.K[0][j]));
  return { K: l.K, P: l.P, Acl };
}
/** The slope of the terminal set's edge: p + C_TERM·v up to p_max. */
export const C_TERM = VMAX / AMAX - DT / 2;

/** The terminal pieces make_mpc gets for a mode. */
export function terminal_spec(mode: Mode): { P?: Mat; terminal?: { G: Mat; w: Vec } } {
  if (mode === 'cost') return { P: dock_lqr().P };
  if (mode === 'set') return { terminal: { G: [[1, C_TERM]], w: [WALL] } };
  if (mode === 'end') return { terminal: { G: [[1, 0], [-1, 0], [0, 1], [0, -1]], w: [WALL, -WALL, 0, 0] } };
  return {};
}

/** The fallback when a QP is infeasible: brake to rest (as hard as allowed, never past v = 0). */
export const brake_to_rest = (v: number): number => Math.max(-AMAX, Math.min(AMAX, -v / DT));

/** Is a crash certain from (p, v)? Even full braking at a_max needs v²/(2 a_max) of room. */
export const doomed = (p: number, v: number): boolean => p + (v > 0 ? (v * v) / (2 * AMAX) : 0) > WALL + 1e-4;
/** The largest p from which a stop is still possible at speed v (the edge of "crash certain"). */
export const p_safe = (v: number): number => WALL - (v > 0 ? (v * v) / (2 * AMAX) : 0);

/**
 * The braking rollout every limit check uses: full braking, clamped so that
 * v never goes below −v_max. It gives the smallest p_k and v_k any allowed
 * input sequence can reach at every k at once, so a plan exists iff this one
 * keeps the limits (and, in 'set' mode, ends in X_f). Offsets from (0, v).
 */
export function brake_offsets(v: number, N: number): { dp: number[]; v: number[] } {
  const dp: number[] = [], vs: number[] = [];
  let p = 0, w = v;
  for (let k = 0; k < N; k++) {
    const a = Math.max(-AMAX, (-VMAX - w) / DT);
    p += w * DT + 0.5 * a * DT * DT;
    w += a * DT;
    dp.push(p);
    vs.push(w);
  }
  return { dp, v: vs };
}
/**
 * The edge of the feasible set X_N at speed v: the QP at (p, v) has a solution
 * iff p is at most this (−Infinity when no p works, i.e. v_1 would exceed v_max).
 * Exact for 'none', 'cost' (the same set) and 'set'; 'end' is not covered (null).
 */
export function p_feasible(v: number, N: number, mode: Mode): number | null {
  if (mode === 'end') return null;
  const b = brake_offsets(v, N);
  if (b.v.some((w) => w > VMAX + 1e-12)) return -Infinity;
  let p = WALL - Math.max(...b.dp);
  if (mode === 'set') p = Math.min(p, WALL - (b.dp[N - 1] + C_TERM * b.v[N - 1]));
  return p;
}
/** The trap at speed v: p in (p_safe, min(p_feasible, wall)) where the QP is still feasible but a crash is certain (null: none). */
export function trap_interval(v: number, N: number, mode: Mode): [number, number] | null {
  const hi = p_feasible(v, N, mode);
  if (hi === null || !Number.isFinite(hi)) return null;
  const lo = p_safe(v), top = Math.min(hi, WALL);
  // gaps of a few mm are only sampling: between samples a slow cart can pass a limit checked at the samples
  return top > lo + 2e-3 ? [lo, top] : null;
}

// ---------------------------------------------------------------- closed-loop runs
export interface TermRun {
  N: number;
  mode: Mode;
  /** States x_0..x_T (the run stops at the crash or at docking). */
  x: Vec[];
  /** Applied accelerations. */
  u: number[];
  /** Per instant: was the QP feasible? */
  feasible: boolean[];
  /** Per instant: the plan's predicted states x_0..x_N (null when infeasible). */
  plans: (Vec[] | null)[];
  /** First instant with an infeasible QP (−1: never). */
  infeasible_k: number;
  /** First instant from which a crash is certain (−1: never). */
  doomed_k: number;
  /** First instant in the trap: crash certain although the QP was feasible (−1: never). */
  trap_k: number;
  crash_k: number;
  impact: number;
  docked_k: number;
  /** Did it ever move? (False when the QP is infeasible at rest at the start.) */
  started: boolean;
  /** The instant whose plan the picture shows: the last moment it could still stop (crashing runs) or when it began to brake. */
  shown_k: number;
}
const cache = new Map<string, TermRun>();
export const RUN_STEPS = 200;

/** The horizon-N docking MPC with the given end-of-plan choice, from rest at p = 0 (cached). */
export function term_run(N: number, mode: Mode, steps = RUN_STEPS): TermRun {
  const key = `${N}|${mode}|${steps}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const mpc = make_mpc({ A, B, Q, R, N, u_min: [-AMAX], u_max: [AMAX], x_min: [null, -VMAX], x_max: [WALL, VMAX], ...terminal_spec(mode) });
  const x: Vec[] = [[0, 0]], u: number[] = [], feasible: boolean[] = [], plans: (Vec[] | null)[] = [];
  let crash_k = -1, impact = 0, docked_k = -1;
  for (let k = 0; k < steps; k++) {
    const xk = x[k];
    const pl = mpc.solve(xk, { x_ref: [WALL, 0] });
    const ok = pl.status === 'optimal';
    feasible.push(ok);
    plans.push(ok ? pl.X : null);
    const a = ok ? pl.U[0][0] : brake_to_rest(xk[1]);
    u.push(a);
    const s = cart_step(xk, a, { wall: WALL + 1e-9 });
    if (s.crashed && s.impact > 1e-3) {
      crash_k = k + 1;
      impact = s.impact;
      x.push([WALL, s.impact]);
      break;
    }
    x.push(s.x);
    // infeasible at rest and braking keeps it at rest: nothing will ever change
    if (!ok && Math.abs(xk[1]) < 1e-12 && Math.abs(s.x[1]) < 1e-12 && Math.abs(s.x[0] - xk[0]) < 1e-12) break;
    if (Math.abs(s.x[0] - WALL) < 5e-3 && Math.abs(s.x[1]) < 5e-3) {
      docked_k = k + 1;
      break;
    }
  }
  const infeasible_k = feasible.indexOf(false);
  const doomed_k = x.slice(0, feasible.length).findIndex((s) => doomed(s[0], s[1]));
  let trap_k = -1;
  for (let k = 0; k < feasible.length; k++) if (feasible[k] && doomed(x[k][0], x[k][1])) { trap_k = k; break; }
  const started = x.some((s) => s[0] > 1e-6);
  let shown_k = -1;
  if (crash_k >= 0) {
    for (let k = 0; k < feasible.length; k++) if (!doomed(x[k][0], x[k][1])) shown_k = k;
    while (shown_k > 0 && !feasible[shown_k]) shown_k--;
  } else {
    shown_k = u.findIndex((a, k) => a <= -0.5 * AMAX && feasible[k]);
  }
  const run: TermRun = { N, mode, x, u, feasible, plans, infeasible_k, doomed_k, trap_k, crash_k, impact, docked_k, started, shown_k };
  cache.set(key, run);
  return run;
}

// ---------------------------------------------------------------- soft speed limit
export interface SoftRun {
  /** Speeds v_0..v_T and positions. */
  v: number[];
  p: number[];
  /** Per instant: was the QP feasible (always, when soft)? */
  feasible: boolean[];
  /** Largest slack the plan used, per instant. */
  slack: number[];
  crash_k: number;
}
const soft_cache = new Map<string, SoftRun>();
/**
 * The docking MPC (N = 20) with the speed limit softened and the wall kept hard:
 * v_k up to v_max + s_k, s_k ≥ 0, cost + l1·Σ s_k + l2·Σ s_k². `l1 = null` keeps
 * the speed limit hard (the QP can then be infeasible: brake to rest). At instant
 * push_k a gust adds dv to the speed (past the limit).
 */
export function soft_run(l1: number | null, o: { push_k?: number; dv?: number; steps?: number; N?: number; l2?: number } = {}): SoftRun {
  const N = o.N ?? 20, push_k = o.push_k ?? 30, dv = o.dv ?? 0.4, steps = o.steps ?? 80, l2 = o.l2 ?? 1;
  const key = `${l1}|${N}|${push_k}|${dv}|${steps}|${l2}`;
  const hit = soft_cache.get(key);
  if (hit) return hit;
  const cond = condense(A, B, Q, R, Q, N);
  const soft = l1 !== null;
  const nz = N + (soft ? N : 0);
  const H: Mat = Array.from({ length: nz }, (_, i) => Array.from({ length: nz }, (_, j) => (i < N && j < N ? cond.H[i][j] : i === j ? 2 * l2 : 0)));
  const lb = new Array(nz).fill(-AMAX), ub = new Array(nz).fill(AMAX);
  for (let s = N; s < nz; s++) {
    lb[s] = 0;
    ub[s] = Infinity;
  }
  const v: number[] = [0], p: number[] = [0], feasible: boolean[] = [], slack: number[] = [];
  let x: Vec = [0, 0], crash_k = -1;
  for (let k = 0; k < steps; k++) {
    const e = cond.Phi.map((row, r) => row[0] * x[0] + row[1] * x[1] - (r % 2 === 0 ? WALL : 0));
    const f0 = cond.Gamma[0].map((_, j) => 2 * cond.Gamma.reduce((s, g, r) => s + g[j] * cond.Qbar[r].reduce((t, q, c) => t + q * e[c], 0), 0));
    const f = [...f0, ...new Array(nz - N).fill(soft ? l1 : 0)];
    const Ar: Mat = [], br: Vec = [];
    for (let i = 0; i < N; i++) {
      const rp = 2 * i, rv = 2 * i + 1;
      const xp = cond.Phi[rp][0] * x[0] + cond.Phi[rp][1] * x[1], xv = cond.Phi[rv][0] * x[0] + cond.Phi[rv][1] * x[1];
      // wall (hard): p_{i+1} up to the wall
      Ar.push([...cond.Gamma[rp], ...new Array(nz - N).fill(0)]);
      br.push(WALL - xp);
      // speed limit: v_{i+1} up to v_max (+ s_i when soft); v_{i+1} at least −v_max (hard)
      const row = [...cond.Gamma[rv], ...new Array(nz - N).fill(0)];
      if (soft) row[N + i] = -1;
      Ar.push(row);
      br.push(VMAX - xv);
      Ar.push([...cond.Gamma[rv].map((g) => -g), ...new Array(nz - N).fill(0)]);
      br.push(VMAX + xv);
    }
    const r = solve_qp({ H, f, A: Ar, b: br, lb, ub });
    const ok = r.status === 'optimal';
    feasible.push(ok);
    slack.push(ok && soft ? Math.max(0, ...r.x.slice(N)) : 0);
    const a = ok ? r.x[0] : brake_to_rest(x[1]);
    const s = cart_step(x, a, { wall: WALL + 1e-9 });
    if (s.crashed && s.impact > 1e-3) {
      crash_k = k + 1;
      v.push(s.impact);
      p.push(WALL);
      break;
    }
    x = s.x;
    if (k + 1 === push_k) x = [x[0], x[1] + dv];
    v.push(x[1]);
    p.push(x[0]);
  }
  const out = { v, p, feasible, slack, crash_k };
  soft_cache.set(key, out);
  return out;
}
