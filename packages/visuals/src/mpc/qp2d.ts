// The cart's MPC cut down to two decisions, so the QP can be drawn (M4, M5).
// The plan may change the acceleration only once: a₁ for the first second,
// a₂ for the second (move blocking: u_k = a₁ for k < 10, u_k = a₂ for
// 10 ≤ k < 20, Δt = 0.1 s). The cost is the course's docking cost summed over
// all 20 samples, J = Σ (p_k − p_ref)² + r a_k² + (p_20 − p_ref)², with the
// flag at p_ref = 9.5 m, half a metre before the wall. The limits are checked
// at the end of each move (t = 1 s and 2 s): |a| ≤ 1, |v| ≤ 2, p ≤ 10.
// Everything is exact: the double integrator is integrated exactly under a
// held input, and the QP is solved with the kit's Goldfarb–Idnani solver.
//
//   QP in z = (a₁, a₂):  min ½ zᵀ H z + f(x₀)ᵀ z   s.t.  G z ≤ w + E x₀
//
// Also here: the level sets of the cost (ellipses), the clipped no-limits
// plan, the equality-constrained optimum for a chosen working set (M5's
// active-set world), and the exact partition of the state plane into critical
// regions (the explicit MPC law, Bemporad et al. 2002) by enumerating active sets.
import { CART, condense, double_integrator, inv_spd, matmul, matvec, solve, solve_qp, transpose, type Mat, type Vec } from './math';

export type Family = 'input' | 'speed' | 'wall';
export interface Row {
  /** Short id: 'a1+', 'a1-', 'a2+', 'a2-', 'v1+', 'v1-', 'v2+', 'v2-', 'p1', 'p2'. */
  id: string;
  family: Family;
  /** g · z ≤ w + e · x0. */
  g: [number, number];
  w: number;
  e: [number, number];
  /** TeX for the limit as the learner reads it (e.g. a_1 \le 1, v(1\,s) \le 2). */
  tex: string;
}

/** Course numbers for this picture. */
export const Q2 = {
  dt: CART.dt,
  /** Samples per move. */
  L: 10,
  N: 20,
  p_ref: 9.5,
  r: 0.1,
  a_max: CART.a_max,
  v_max: CART.v_max,
  wall: CART.p_max,
} as const;

/** The constraint rows (fixed; the right-hand sides move with x0 through e). */
export const ROWS: Row[] = (() => {
  const { a_max: A, v_max: V, wall: W } = Q2;
  // v(1 s) = v0 + a1, v(2 s) = v0 + a1 + a2, p(1 s) = p0 + v0 + a1/2, p(2 s) = p0 + 2 v0 + 1.5 a1 + 0.5 a2
  return [
    { id: 'a1+', family: 'input', g: [1, 0], w: A, e: [0, 0], tex: 'a_1 \\le 1' },
    { id: 'a1-', family: 'input', g: [-1, 0], w: A, e: [0, 0], tex: 'a_1 \\ge -1' },
    { id: 'a2+', family: 'input', g: [0, 1], w: A, e: [0, 0], tex: 'a_2 \\le 1' },
    { id: 'a2-', family: 'input', g: [0, -1], w: A, e: [0, 0], tex: 'a_2 \\ge -1' },
    { id: 'v1+', family: 'speed', g: [1, 0], w: V, e: [0, -1], tex: 'v(1\\,\\mathrm{s}) \\le 2' },
    { id: 'v1-', family: 'speed', g: [-1, 0], w: V, e: [0, 1], tex: 'v(1\\,\\mathrm{s}) \\ge -2' },
    { id: 'v2+', family: 'speed', g: [1, 1], w: V, e: [0, -1], tex: 'v(2\\,\\mathrm{s}) \\le 2' },
    { id: 'v2-', family: 'speed', g: [-1, -1], w: V, e: [0, 1], tex: 'v(2\\,\\mathrm{s}) \\ge -2' },
    { id: 'p1', family: 'wall', g: [0.5, 0], w: W, e: [-1, -1], tex: 'p(1\\,\\mathrm{s}) \\le 10' },
    { id: 'p2', family: 'wall', g: [1.5, 0.5], w: W, e: [-1, -2], tex: 'p(2\\,\\mathrm{s}) \\le 10' },
  ];
})();
export const ROW_INDEX: Record<string, number> = Object.fromEntries(ROWS.map((r, i) => [r.id, i]));

/** The cost of the two-move plan: H (2x2), and f(x0) = F (x0 − x_ref). Built once. */
export const COST = (() => {
  const { A, B } = double_integrator(Q2.dt);
  const Q = [[1, 0], [0, 0]], R = [[Q2.r]];
  const c = condense(A, B, Q, R, Q, Q2.N);
  const T: Mat = Array.from({ length: Q2.N }, (_, k) => (k < Q2.L ? [1, 0] : [0, 1]));
  const Tt = transpose(T);
  const H = matmul(matmul(Tt, c.H), T);
  const F = matmul(Tt, c.F);
  const Hinv = inv_spd(H);
  /** The no-limits plan is z = −K (x0 − x_ref). */
  const K = matmul(Hinv, F);
  return { A, B, Q, R, T, H, F, Hinv, K, cond: c };
})();

export const x_ref = (): Vec => [Q2.p_ref, 0];
export const lin = (x0: Vec): Vec => matvec(COST.F, [x0[0] - Q2.p_ref, x0[1]]);
/** Right-hand side of row i at state x0. */
export const rhs = (i: number, x0: Vec): number => ROWS[i].w + ROWS[i].e[0] * x0[0] + ROWS[i].e[1] * x0[1];
/** g_i · z − rhs_i (positive = violated). */
export const slack_of = (i: number, z: Vec, x0: Vec): number => ROWS[i].g[0] * z[0] + ROWS[i].g[1] * z[1] - rhs(i, x0);
/** ½ zᵀHz + fᵀz (the cost minus a constant). */
export function cost(z: Vec, x0: Vec): number {
  const f = lin(x0), H = COST.H;
  return 0.5 * (z[0] * (H[0][0] * z[0] + H[0][1] * z[1]) + z[1] * (H[1][0] * z[0] + H[1][1] * z[1])) + f[0] * z[0] + f[1] * z[1];
}
/** The best plan if there were no limits: −H⁻¹ f(x0) (M3's linear law). */
export const unconstrained = (x0: Vec): Vec => matvec(COST.Hinv, lin(x0)).map((v) => -v);
/** The no-limits plan with each move clipped to |a| ≤ 1 (what a saturating actuator does). */
export const clipped = (x0: Vec): Vec => unconstrained(x0).map((v) => Math.max(-Q2.a_max, Math.min(Q2.a_max, v)));

export interface Plan2 {
  status: 'optimal' | 'infeasible' | 'max_iter';
  z: Vec;
  /** Multiplier of each row (0 when inactive). */
  lambda: Vec;
  /** Indices of the active rows. */
  active: number[];
}
const TOL = 1e-7;
/** The best plan with the limits (exact); `rows` keeps only some limits (indices into ROWS, default all). */
export function solve_plan(x0: Vec, rows?: readonly number[]): Plan2 {
  const use = rows ?? ROWS.map((_, i) => i);
  if (!use.length) return { status: 'optimal', z: unconstrained(x0), lambda: new Array(ROWS.length).fill(0), active: [] };
  const A = use.map((i) => ROWS[i].g.slice());
  const b = use.map((i) => rhs(i, x0));
  const res = solve_qp({ H: COST.H, f: lin(x0), A, b }, { Hinv: COST.Hinv });
  const lambda = new Array(ROWS.length).fill(0);
  use.forEach((i, k) => (lambda[i] = res.lambda[k]));
  // report as active the rows with a positive multiplier, or exactly tight (degenerate vertices)
  const active = res.status === 'optimal' ? use.filter((i, k) => res.lambda[k] > TOL || (res.active.includes(k) && Math.abs(slack_of(i, res.x, x0)) < 1e-9)) : [];
  return { status: res.status, z: res.x, lambda, active };
}
/** Is there any plan at all (does the QP have a solution)? */
export const feasible = (x0: Vec): boolean => solve_plan(x0).status === 'optimal';

/** The 20 predicted positions p_1..p_20 of the plan z from x0 (for the cart's ghost dots). */
export function predicted(x0: Vec, z: Vec): Vec[] {
  const out: Vec[] = [];
  let p = x0[0], v = x0[1];
  for (let k = 0; k < Q2.N; k++) {
    const a = k < Q2.L ? z[0] : z[1];
    p += v * Q2.dt + 0.5 * a * Q2.dt * Q2.dt;
    v += a * Q2.dt;
    out.push([p, v]);
  }
  return out;
}

/**
 * Points of the level set {z : cost(z) = cost(z_through)} (an ellipse centred at
 * the no-limits plan), `n` points, closed. `scale` multiplies its radius.
 */
export function level_set(x0: Vec, z_through: Vec, n = 96, scale = 1): [number, number][] {
  return contour(x0, radius(z_through, x0) * scale, n);
}
/** The "radius" of a plan in the cost's own metric: √((z − c)ᵀ H (z − c)), c the no-limits plan. cost(z) = cost(c) + r²/2. */
export function radius(z: Vec, x0: Vec): number {
  const c = unconstrained(x0), H = COST.H;
  const d = [z[0] - c[0], z[1] - c[1]];
  return Math.sqrt(Math.max(0, d[0] * (H[0][0] * d[0] + H[0][1] * d[1]) + d[1] * (H[1][0] * d[0] + H[1][1] * d[1])));
}
/** The cost contour {z : (z − c)ᵀ H (z − c) = r²} around the no-limits plan c (closed, n + 1 points). */
export function contour(x0: Vec, r: number, n = 96): [number, number][] {
  const c = unconstrained(x0), H = COST.H;
  // H = L Lᵀ; z = c + r L⁻ᵀ (cos t, sin t)
  const l11 = Math.sqrt(H[0][0]), l21 = H[1][0] / l11, l22 = Math.sqrt(Math.max(1e-12, H[1][1] - l21 * l21));
  const pts: [number, number][] = [];
  for (let k = 0; k <= n; k++) {
    const t = (2 * Math.PI * k) / n, u = r * Math.cos(t), v = r * Math.sin(t);
    // solve Lᵀ y = (u, v): Lᵀ = [[l11, l21], [0, l22]]
    const y1 = v / l22, y0 = (u - l21 * y1) / l11;
    pts.push([c[0] + y0, c[1] + y1]);
  }
  return pts;
}
/** The plans that keep every limit at x0, inside the square [lo, hi]² (a convex polygon; [] when there is none). */
export function feasible_polygon(x0: Vec, lo = -2, hi = 2): [number, number][] {
  let poly: [number, number][] = [[lo, lo], [hi, lo], [hi, hi], [lo, hi]];
  for (let i = 0; i < ROWS.length && poly.length; i++) poly = clip_half(poly, ROWS[i].g, rhs(i, x0));
  return poly.length >= 3 && poly_area(poly) > 1e-9 ? poly : [];
}
/** The line g·z = rhs of row i at x0, clipped to the square [lo, hi]² (null when it misses it). */
export function row_segment(i: number, x0: Vec, lo = -2, hi = 2): [[number, number], [number, number]] | null {
  const [g0, g1] = ROWS[i].g, b = rhs(i, x0);
  const pts: [number, number][] = [];
  const push = (p: [number, number]) => {
    if (p[0] >= lo - 1e-9 && p[0] <= hi + 1e-9 && p[1] >= lo - 1e-9 && p[1] <= hi + 1e-9 && !pts.some((q) => Math.hypot(q[0] - p[0], q[1] - p[1]) < 1e-9)) pts.push(p);
  };
  if (Math.abs(g1) > 1e-12) for (const x of [lo, hi]) push([x, (b - g0 * x) / g1]);
  if (Math.abs(g0) > 1e-12) for (const y of [lo, hi]) push([(b - g1 * y) / g0, y]);
  return pts.length >= 2 ? [pts[0], pts[1]] : null;
}
/** Ids of rows ('a1+', 'p2', ...). */
export const ids_of = (W: readonly number[]): string[] => W.map((i) => ROWS[i].id);
/**
 * The docking cost J of the plan z itself: Σ_{k<20} (p_k − p_ref)² + r a_k² + (p_20 − p_ref)²
 * (cost() is this minus a constant that depends only on x0).
 */
export function horizon_J(z: Vec, x0: Vec): number {
  const xs = [[x0[0], x0[1]], ...predicted(x0, z)];
  let J = 0;
  for (let k = 0; k <= Q2.N; k++) {
    J += (xs[k][0] - Q2.p_ref) ** 2;
    if (k < Q2.N) J += Q2.r * (k < Q2.L ? z[0] : z[1]) ** 2;
  }
  return J;
}

/**
 * The minimiser of the cost with the rows in W held as equalities, and their
 * multipliers (KKT: Hz + f + Σ λ_i g_i = 0). `null` when W has more than two
 * rows or dependent rows (no unique point: in 2D at most two independent
 * constraints can hold with equality).
 */
export function working_set_point(x0: Vec, W: number[]): { z: Vec; lambda: Vec } | null {
  const f = lin(x0), H = COST.H, m = W.length;
  if (m === 0) return { z: unconstrained(x0), lambda: [] };
  if (m > 2) return null;
  const G = W.map((i) => ROWS[i].g);
  if (m === 2 && Math.abs(G[0][0] * G[1][1] - G[0][1] * G[1][0]) < 1e-9) return null;
  // [H Gᵀ; G 0] [z; λ] = [−f; b]
  const n = 2 + m;
  const M: Mat = Array.from({ length: n }, () => new Array(n).fill(0));
  const r: Vec = new Array(n).fill(0);
  for (let i = 0; i < 2; i++) {
    for (let j = 0; j < 2; j++) M[i][j] = H[i][j];
    for (let k = 0; k < m; k++) M[i][2 + k] = G[k][i];
    r[i] = -f[i];
  }
  for (let k = 0; k < m; k++) {
    M[2 + k][0] = G[k][0];
    M[2 + k][1] = G[k][1];
    r[2 + k] = rhs(W[k], x0);
  }
  const s = solve(M, r);
  return { z: [s[0], s[1]], lambda: s.slice(2) };
}

/** Is the working set W optimal at x0 (its point satisfies every row, and all its multipliers are ≥ 0)? */
export function kkt_ok(x0: Vec, W: number[], tol = 1e-7): boolean {
  const s = working_set_point(x0, W);
  if (!s) return false;
  if (s.lambda.some((l) => l < -tol)) return false;
  return ROWS.every((_, i) => W.includes(i) || slack_of(i, s.z, x0) <= tol);
}

// ---------------------------------------------------------------- critical regions (explicit MPC)
export type Poly = [number, number][];
export interface Region {
  /** Active rows (indices, sorted). */
  W: number[];
  /** The polygon in the (p0, v0) plane, clipped to the box. */
  poly: Poly;
  /** The law on this region: z = Kz x0 + kz (2x2 and 2), so a₁ = Kz[0]·x0 + kz[0]. */
  Kz: Mat;
  kz: Vec;
  /** Families of the active rows, e.g. 'none', 'input', 'speed+input'. */
  key: string;
}
/** Clip a convex polygon by the half-plane a·x ≤ b (Sutherland–Hodgman). */
export function clip_half(poly: Poly, a: [number, number], b: number): Poly {
  const out: Poly = [];
  const val = (p: [number, number]) => a[0] * p[0] + a[1] * p[1] - b;
  for (let i = 0; i < poly.length; i++) {
    const P = poly[i], Qp = poly[(i + 1) % poly.length];
    const vp = val(P), vq = val(Qp);
    if (vp <= 0) out.push(P);
    if ((vp < 0 && vq > 0) || (vp > 0 && vq < 0)) {
      const t = vp / (vp - vq);
      out.push([P[0] + t * (Qp[0] - P[0]), P[1] + t * (Qp[1] - P[1])]);
    }
  }
  return out;
}
export const poly_area = (p: Poly): number => Math.abs(p.reduce((s, q, i) => s + q[0] * p[(i + 1) % p.length][1] - p[(i + 1) % p.length][0] * q[1], 0)) / 2;

/** The family key of an active set. */
export function family_key(W: number[]): string {
  if (!W.length) return 'none';
  const fs = [...new Set(W.map((i) => ROWS[i].family))];
  const order: Family[] = ['wall', 'speed', 'input'];
  return order.filter((f) => fs.includes(f)).join('+');
}

/**
 * The exact partition of the box [p_lo, p_hi] × [v_lo, v_hi] of initial states
 * into critical regions: for each candidate active set W (at most two
 * independent rows), z and λ are affine in x0; the region is where λ ≥ 0 and
 * every other row holds. States in no region have no feasible plan.
 */
export function critical_regions(box: { p: [number, number]; v: [number, number] }, min_area = 1e-6): Region[] {
  const rect: Poly = [[box.p[0], box.v[0]], [box.p[1], box.v[0]], [box.p[1], box.v[1]], [box.p[0], box.v[1]]];
  const sets: number[][] = [[]];
  for (let i = 0; i < ROWS.length; i++) {
    sets.push([i]);
    for (let j = i + 1; j < ROWS.length; j++) sets.push([i, j]);
  }
  const out: Region[] = [];
  for (const W of sets) {
    // affine maps x0 -> (z, λ): evaluate at three points (exact for affine maps)
    const at = (x0: Vec) => working_set_point(x0, W);
    const s0 = at([0, 0]), s1 = at([1, 0]), s2 = at([0, 1]);
    if (!s0 || !s1 || !s2) continue;
    const aff = (get: (s: { z: Vec; lambda: Vec }) => number): { a: [number, number]; c: number } => {
      const c0 = get(s0);
      return { a: [get(s1) - c0, get(s2) - c0], c: c0 };
    };
    let poly = rect;
    // λ_k ≥ 0  ⇔  −(a·x + c) ≤ 0
    for (let k = 0; k < W.length && poly.length; k++) {
      const l = aff((s) => s.lambda[k]);
      poly = clip_half(poly, [-l.a[0], -l.a[1]], l.c);
    }
    // other rows: g·z(x) − w − e·x ≤ 0
    for (let i = 0; i < ROWS.length && poly.length; i++) {
      if (W.includes(i)) continue;
      const g = ROWS[i].g;
      const zz = aff((s) => g[0] * s.z[0] + g[1] * s.z[1]);
      poly = clip_half(poly, [zz.a[0] - ROWS[i].e[0], zz.a[1] - ROWS[i].e[1]], ROWS[i].w - zz.c);
    }
    if (poly.length < 3 || poly_area(poly) < min_area) continue;
    const z0 = s0.z, Kz: Mat = [[s1.z[0] - z0[0], s2.z[0] - z0[0]], [s1.z[1] - z0[1], s2.z[1] - z0[1]]];
    out.push({ W: W.slice(), poly, Kz, kz: z0.slice(), key: family_key(W) });
  }
  return out;
}
/** The region containing x0 (or null: no feasible plan). */
export function region_of(regions: Region[], x0: Vec): Region | null {
  const inside = (poly: Poly) => {
    let sgn = 0;
    for (let i = 0; i < poly.length; i++) {
      const a = poly[i], b = poly[(i + 1) % poly.length];
      const cr = (b[0] - a[0]) * (x0[1] - a[1]) - (b[1] - a[1]) * (x0[0] - a[0]);
      if (Math.abs(cr) < 1e-12) continue;
      const s = Math.sign(cr);
      if (sgn && s !== sgn) return false;
      sgn = s;
    }
    return true;
  };
  return regions.find((r) => inside(r.poly)) ?? null;
}
/** The first move a₁ of the explicit law on a region at x0. */
export const law_a1 = (r: Region, x0: Vec): number => r.Kz[0][0] * x0[0] + r.Kz[0][1] * x0[1] + r.kz[0];

// ---------------------------------------------------------------- the explicit law on a map of states (M4)
/** The map's ranges: positions 4–10 m (the wall at 10), speeds 0–2 m/s. */
export const MAP = { p: [4, 10] as [number, number], v: [0, 2] as [number, number] };
let REGIONS: Region[] | null = null;
/** The exact partition of the map (computed once). */
export const map_regions = (): Region[] => (REGIONS ??= critical_regions(MAP));

/** Which colour family a region gets: the "strongest" active limit (wall > speed > motor), or none. */
export const region_family = (r: Region): 'none' | 'input' | 'speed' | 'wall' => (r.key === 'none' ? 'none' : (r.key.split('+')[0] as 'input' | 'speed' | 'wall'));

/** The no-limits law's first move, −K (x₀ − x_ref) (M3's linear feedback). */
export const free_a1 = (p: number, v: number): number => -(COST.K[0][0] * (p - Q2.p_ref) + COST.K[0][1] * v);

/**
 * The explicit law along the slice v₀ = v: points (p, a₁) and the kinks (where
 * the slice enters another region), from p_lo to p_hi; stops where no plan exists.
 */
export function slice_law(v: number, p_lo = MAP.p[0], p_hi = MAP.p[1], n = 240): { pts: [number, number][]; kinks: [number, number][]; end: number } {
  const regs = map_regions();
  const pts: [number, number][] = [], kinks: [number, number][] = [];
  let prev: Region | null = null, end = p_hi;
  for (let i = 0; i <= n; i++) {
    const p = p_lo + ((p_hi - p_lo) * i) / n;
    const r = region_of(regs, [p, v]);
    if (!r) {
      // the boundary of feasibility: refine it and stop
      if (prev) {
        let a = p - (p_hi - p_lo) / n, b = p;
        for (let k = 0; k < 40; k++) {
          const m = (a + b) / 2;
          if (region_of(regs, [m, v])) a = m;
          else b = m;
        }
        const r2 = region_of(regs, [a, v]) ?? prev;
        pts.push([a, law_a1(r2, [a, v])]);
        end = a;
      } else end = p;
      break;
    }
    if (prev && r !== prev) {
      // refine the crossing: the law is continuous, so either side gives the same a₁ there
      let a = p - (p_hi - p_lo) / n, b = p;
      for (let k = 0; k < 40; k++) {
        const m = (a + b) / 2;
        if (region_of(regs, [m, v]) === prev) a = m;
        else b = m;
      }
      const q = (a + b) / 2, val = law_a1(prev, [q, v]);
      pts.push([q, val]);
      if (Math.abs(law_a1(r, [q + 1e-6, v]) - val) < 1e-4 && slope(prev, v) !== slope(r, v)) kinks.push([q, val]);
    }
    pts.push([p, law_a1(r, [p, v])]);
    prev = r;
  }
  return { pts, kinks, end };
}
const slope = (r: Region, _v: number): string => r.Kz[0][0].toFixed(6);
