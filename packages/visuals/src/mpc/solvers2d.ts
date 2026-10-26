// M5: the three families of QP solvers, run on the two-move cart QP of M4
// (qp2d.ts), so that each one's iterates can be drawn in the plan plane.
//
//   min ½ zᵀHz + f(x₀)ᵀz   s.t.   g_i·z ≤ rhs_i(x₀)   (10 rows: motor, speed, wall)
//
// - active_set_path: a dual active-set method in the spirit of Goldfarb–Idnani
//   (the kit's solver, and quadprog): start from the no-limits plan (no limit
//   held), add the most broken limit, hold the limits in the working set as
//   equalities, drop a held limit whose multiplier is negative. Simplified:
//   when two limits are held and a third is broken (in 2D at most two lines
//   meet at a point), it swaps one of them out, choosing the swap that keeps
//   the multipliers non-negative. Each step solves one small KKT system.
// - ip_path: a primal–dual interior-point method (path following, fixed
//   centring σ, fraction-to-boundary 0.99) from a strictly feasible start; the
//   iterates stay inside the polygon and approach the optimum along the
//   central path. Each step factors a new KKT matrix.
// - admm_path: the OSQP iteration (Stellato et al. 2020, Algorithm 1) with
//   OSQP's defaults ρ = 0.1, σ = 1e-6, α = 1.6, no scaling and no adaptive ρ;
//   its stopping test (eps_abs = eps_rel = 1e-3). The matrix of its linear
//   system never changes, so it is factored once; each step is two triangular
//   solves and a clip.
// All three are exact enough to compare with solve_plan() (unit-tested).
import type { Mat, Vec } from './math';
import { solve } from './math';
import { COST, ROWS, cost, feasible_polygon, kkt_ok, lin, rhs, slack_of, solve_plan, working_set_point } from './qp2d';

export interface ActiveStep {
  /** Working set after this step (row indices, in the order they were added). */
  W: number[];
  /** Its point (the minimiser with W held as equalities) and multipliers (same order as W). */
  z: Vec;
  lambda: Vec;
  /** What this step did: 'start' (no limit held), 'add' row, 'drop' row, 'swap' (add `row`, drop `out`), 'done'. */
  action: 'start' | 'add' | 'drop' | 'swap' | 'done';
  row?: number;
  out?: number;
}
const TOL = 1e-7;
/** The most broken row at z (largest positive slack), or -1. */
export function most_violated(x0: Vec, z: Vec, skip: readonly number[] = []): number {
  let best = -1, bv = TOL;
  for (let i = 0; i < ROWS.length; i++) {
    if (skip.includes(i)) continue;
    const s = slack_of(i, z, x0);
    if (s > bv) {
      bv = s;
      best = i;
    }
  }
  return best;
}
/** The dual active-set walk from the working set W0 (default: nothing held). */
export function active_set_path(x0: Vec, W0: number[] = [], max_steps = 12): ActiveStep[] {
  let W = W0.slice();
  const first = working_set_point(x0, W);
  if (!first) throw new Error('W0 has no unique point');
  const out: ActiveStep[] = [{ W: W.slice(), z: first.z, lambda: first.lambda, action: 'start' }];
  for (let k = 0; k < max_steps; k++) {
    const cur = out[out.length - 1];
    // a held limit that pulls (negative multiplier): let it go
    let neg = -1, nv = -TOL;
    cur.lambda.forEach((l, j) => {
      if (l < nv) {
        nv = l;
        neg = j;
      }
    });
    if (neg >= 0) {
      const row = W[neg];
      W = W.filter((_, j) => j !== neg);
      const s = working_set_point(x0, W)!;
      out.push({ W: W.slice(), z: s.z, lambda: s.lambda, action: 'drop', row });
      continue;
    }
    const v = most_violated(x0, cur.z, W);
    if (v < 0) {
      out.push({ ...cur, W: W.slice(), action: 'done' });
      return out;
    }
    if (W.length < 2) {
      const s = working_set_point(x0, [...W, v]);
      if (s) {
        W = [...W, v];
        out.push({ W: W.slice(), z: s.z, lambda: s.lambda, action: 'add', row: v });
        continue;
      }
      // parallel to the held row: replace it
    }
    // swap: keep one held row (or none) with the new one, the choice with no negative multiplier and least cost
    let best: { W: number[]; z: Vec; lambda: Vec; out: number } | null = null;
    for (const keep of [...W.map((w) => [w]), []]) {
      const Wn = [...keep, v];
      const s = working_set_point(x0, Wn);
      if (!s || s.lambda.some((l) => l < -TOL)) continue;
      const o = W.find((w) => !keep.includes(w))!;
      if (!best || cost(s.z, x0) < cost(best.z, x0) - 1e-12) best = { W: Wn, z: s.z, lambda: s.lambda, out: o };
    }
    if (!best) break;
    W = best.W;
    out.push({ W: W.slice(), z: best.z, lambda: best.lambda, action: W.length === 1 && out[out.length - 1].W.length === 0 ? 'add' : 'swap', row: v, out: best.out });
  }
  return out;
}
/** Working-set changes of a path (an add or a drop counts 1, a swap 2). */
export const changes_of = (path: ActiveStep[]): number => path.reduce((s, p) => s + (p.action === 'add' || p.action === 'drop' ? 1 : p.action === 'swap' ? 2 : 0), 0);

export interface IpStep {
  z: Vec;
  /** Duality measure μ = sᵀλ / m. */
  mu: number;
}
/** A strictly feasible start: the centroid of the feasible polygon (null when there is no plan). */
export function interior_start(x0: Vec): Vec | null {
  const poly = feasible_polygon(x0, -3, 3);
  if (poly.length < 3) return null;
  let A = 0, cx = 0, cy = 0;
  for (let i = 0; i < poly.length; i++) {
    const [x1, y1] = poly[i], [x2, y2] = poly[(i + 1) % poly.length];
    const c = x1 * y2 - x2 * y1;
    A += c;
    cx += (x1 + x2) * c;
    cy += (y1 + y2) * c;
  }
  return [cx / (3 * A), cy / (3 * A)];
}
/**
 * Primal–dual interior point: Gz + s = h, s, λ > 0, Hz + f + Gᵀλ = 0, sᵢλᵢ = σμ.
 * Newton steps on these equations (eliminated to a 2×2 system), step length
 * 0.99 of the way to the boundary. Stops when μ < tol.
 */
export function ip_path(x0: Vec, o: { sigma?: number; tol?: number; max_iter?: number; start?: Vec } = {}): IpStep[] {
  const sigma = o.sigma ?? 0.1, tol = o.tol ?? 1e-8, max_iter = o.max_iter ?? 60;
  const z0 = o.start ?? interior_start(x0);
  if (!z0) return [];
  const G = ROWS.map((r) => r.g), h = ROWS.map((_, i) => rhs(i, x0)), f = lin(x0), H = COST.H, m = ROWS.length;
  let z = z0.slice();
  let s = G.map((g, i) => h[i] - g[0] * z[0] - g[1] * z[1]);
  // multipliers from the centring condition at the start: sᵢλᵢ = μ0
  const mu0 = 1;
  let lam = s.map((si) => mu0 / si);
  const out: IpStep[] = [{ z: z.slice(), mu: dotv(s, lam) / m }];
  for (let k = 0; k < max_iter; k++) {
    const mu = dotv(s, lam) / m;
    if (mu < tol) break;
    // residuals
    const rd = [H[0][0] * z[0] + H[0][1] * z[1] + f[0], H[1][0] * z[0] + H[1][1] * z[1] + f[1]];
    for (let i = 0; i < m; i++) {
      rd[0] += G[i][0] * lam[i];
      rd[1] += G[i][1] * lam[i];
    }
    const rp = G.map((g, i) => g[0] * z[0] + g[1] * z[1] + s[i] - h[i]);
    const rc = s.map((si, i) => si * lam[i] - sigma * mu);
    // eliminate: Δs = −rp − GΔz, Δλ = (−rc − λΔs)/s  →  (H + Gᵀ diag(λ/s) G) Δz = −rd − Gᵀ((λ rp − rc)/s)
    const M: Mat = [[H[0][0], H[0][1]], [H[1][0], H[1][1]]];
    const r = [-rd[0], -rd[1]];
    for (let i = 0; i < m; i++) {
      const d = lam[i] / s[i];
      M[0][0] += d * G[i][0] * G[i][0];
      M[0][1] += d * G[i][0] * G[i][1];
      M[1][0] += d * G[i][1] * G[i][0];
      M[1][1] += d * G[i][1] * G[i][1];
      const w = (lam[i] * rp[i] - rc[i]) / s[i];
      r[0] -= G[i][0] * w;
      r[1] -= G[i][1] * w;
    }
    const dz = solve(M, r);
    const ds = G.map((g, i) => -rp[i] - g[0] * dz[0] - g[1] * dz[1]);
    const dl = s.map((si, i) => (-rc[i] - lam[i] * ds[i]) / si);
    let a = 1;
    for (let i = 0; i < m; i++) {
      if (ds[i] < 0) a = Math.min(a, (-0.99 * s[i]) / ds[i]);
      if (dl[i] < 0) a = Math.min(a, (-0.99 * lam[i]) / dl[i]);
    }
    z = [z[0] + a * dz[0], z[1] + a * dz[1]];
    s = s.map((si, i) => si + a * ds[i]);
    lam = lam.map((li, i) => li + a * dl[i]);
    out.push({ z: z.slice(), mu: dotv(s, lam) / m });
  }
  return out;
}
const dotv = (a: Vec, b: Vec) => a.reduce((t, v, i) => t + v * b[i], 0);

export interface AdmmStep {
  /** The plan z^k, and OSQP's primal and dual residuals at it. */
  z: Vec;
  r_prim: number;
  r_dual: number;
  converged: boolean;
}
/**
 * The OSQP iteration on l ≤ Gz ≤ h with l = −∞ (Stellato et al. 2020, Alg. 1):
 *   (H + σI + ρGᵀG) z̃ = σz − f + Gᵀ(ρ y_k − λ)       [the same matrix every step: factor once]
 *   ỹ = G z̃;  z ← α z̃ + (1 − α) z;  y ← clip(α ỹ + (1 − α) y + λ/ρ, −∞, h);  λ ← λ + ρ(α ỹ + (1 − α) y_old − y)
 * Stops when ‖Gz − y‖∞ and ‖Hz + f + Gᵀλ‖∞ are below eps_abs + eps_rel·(scale) (OSQP's test).
 */
export function admm_path(x0: Vec, o: { rho?: number; sigma?: number; alpha?: number; eps?: number; max_iter?: number; z0?: Vec; y0?: Vec; lam0?: Vec } = {}): AdmmStep[] {
  const rho = o.rho ?? 0.1, sig = o.sigma ?? 1e-6, al = o.alpha ?? 1.6, eps = o.eps ?? 1e-3, max_iter = o.max_iter ?? 4000;
  const G = ROWS.map((r) => r.g), h = ROWS.map((_, i) => rhs(i, x0)), f = lin(x0), H = COST.H, m = ROWS.length;
  const K: Mat = [[H[0][0] + sig, H[0][1]], [H[1][0], H[1][1] + sig]];
  for (const g of G) {
    K[0][0] += rho * g[0] * g[0];
    K[0][1] += rho * g[0] * g[1];
    K[1][0] += rho * g[1] * g[0];
    K[1][1] += rho * g[1] * g[1];
  }
  let z = (o.z0 ?? [0, 0]).slice();
  let y = (o.y0 ?? G.map((g) => g[0] * z[0] + g[1] * z[1])).slice();
  let lam = (o.lam0 ?? new Array(m).fill(0)).slice();
  const out: AdmmStep[] = [{ z: z.slice(), r_prim: Infinity, r_dual: Infinity, converged: false }];
  for (let k = 0; k < max_iter; k++) {
    const r = [sig * z[0] - f[0], sig * z[1] - f[1]];
    for (let i = 0; i < m; i++) {
      const c = rho * y[i] - lam[i];
      r[0] += G[i][0] * c;
      r[1] += G[i][1] * c;
    }
    const zt = solve(K, r);
    const yt = G.map((g) => g[0] * zt[0] + g[1] * zt[1]);
    const zn = [al * zt[0] + (1 - al) * z[0], al * zt[1] + (1 - al) * z[1]];
    const yr = yt.map((v, i) => al * v + (1 - al) * y[i]);
    const yn = yr.map((v, i) => Math.min(h[i], v + lam[i] / rho));
    lam = lam.map((l, i) => l + rho * (yr[i] - yn[i]));
    z = zn;
    y = yn;
    // residuals (OSQP §3.4)
    const Gz = G.map((g) => g[0] * z[0] + g[1] * z[1]);
    const rp = Math.max(...Gz.map((v, i) => Math.abs(v - y[i])));
    const Hz = [H[0][0] * z[0] + H[0][1] * z[1], H[1][0] * z[0] + H[1][1] * z[1]];
    const Gl = [0, 0];
    for (let i = 0; i < m; i++) {
      Gl[0] += G[i][0] * lam[i];
      Gl[1] += G[i][1] * lam[i];
    }
    const rdv = [Hz[0] + f[0] + Gl[0], Hz[1] + f[1] + Gl[1]];
    const rd = Math.max(Math.abs(rdv[0]), Math.abs(rdv[1]));
    const ep = eps + eps * Math.max(Math.max(...Gz.map(Math.abs)), Math.max(...y.map(Math.abs)));
    const ed = eps + eps * Math.max(Math.abs(Hz[0]), Math.abs(Hz[1]), Math.abs(Gl[0]), Math.abs(Gl[1]), Math.abs(f[0]), Math.abs(f[1]));
    const ok = rp <= ep && rd <= ed;
    out.push({ z: z.slice(), r_prim: rp, r_dual: rd, converged: ok });
    if (ok) break;
    (out as any)._y = y;
  }
  (out as any).y = y;
  (out as any).lam = lam;
  return out;
}

/** The exact optimum (the kit's solver), for comparison. */
export const exact = (x0: Vec): Vec => solve_plan(x0).z;
export { kkt_ok, working_set_point };
