// The MPC course's pure math (math.ts): discretization, prediction matrices,
// the condensed QP, LQR, the QP solver and the receding-horizon loop, checked
// against closed forms, scipy's DARE solution, brute-force active-set
// enumeration and the KKT conditions.
import { describe, expect, it } from 'vitest';
import {
  CART, DOUBLE_INTEGRATOR_C, c2d, cart_step, condense, dlqr, double_integrator, dot, eigvals, euler, expm, horizon_cost, inv, kkt_residual,
  make_mpc, matmul, matvec, max_abs, prediction_matrices, receding_horizon, riccati_finite, rollout, solve, solve_qp, spectral_radius, stack,
  steady_target, stopping_distance, sub, transpose, unconstrained_gain, unstack, type Mat, type QP, type Vec,
} from './math';

const close = (a: number, b: number, eps = 1e-9) => expect(Math.abs(a - b)).toBeLessThan(eps);
const flat = (A: unknown): number[] => (Array.isArray(A) ? A.flatMap(flat) : [A as number]);
const close_m = (A: unknown, B: unknown, eps = 1e-9) => {
  const a = flat(A), b = flat(B);
  expect(a.length).toBe(b.length);
  expect(Math.max(0, ...a.map((v, i) => Math.abs(v - b[i])))).toBeLessThan(eps);
};
/** A seeded uniform generator (mulberry32). */
function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

describe('discretization', () => {
  it('ZOH of the double integrator is A = [[1, dt], [0, 1]], B = [dt²/2, dt]', () => {
    const { A, B } = double_integrator(0.1);
    const e = c2d(DOUBLE_INTEGRATOR_C.A, DOUBLE_INTEGRATOR_C.B, 0.1);
    close_m(e.A, A, 1e-14);
    close_m(e.B, B, 1e-14);
    close(B[0][0], 0.005, 1e-15);
    // Euler misses the dt²/2 term: position does not feel this sample's acceleration
    const eu = euler(DOUBLE_INTEGRATOR_C.A, DOUBLE_INTEGRATOR_C.B, 0.1);
    close(eu.B[0][0], 0, 1e-15);
    close_m(eu.A, A, 1e-15);
  });
  it('a first-order lag: A = e^{a dt}, B = (e^{a dt} − 1) b / a', () => {
    const e = c2d([[-2]], [[3]], 0.1);
    close(e.A[0][0], Math.exp(-0.2), 1e-14);
    close(e.B[0][0], ((Math.exp(-0.2) - 1) * 3) / -2, 1e-14);
  });
  it('an oscillator turns into a rotation, and expm handles large norms', () => {
    const e = c2d([[0, 1], [-1, 0]], [[0], [1]], 0.7);
    close_m(e.A, [[Math.cos(0.7), Math.sin(0.7)], [-Math.sin(0.7), Math.cos(0.7)]], 1e-13);
    close_m(e.B, [[1 - Math.cos(0.7)], [Math.sin(0.7)]], 1e-13);
    const E = expm([[0, 20], [-20, 0]]);
    close_m(E, [[Math.cos(20), Math.sin(20)], [-Math.sin(20), Math.cos(20)]], 1e-10);
  });
  it('the exact model matches the continuous motion under constant acceleration', () => {
    const { A, B } = double_integrator(CART.dt);
    const xs = rollout(A, B, [0, 0], Array.from({ length: 10 }, () => [1]));
    close(xs[10][0], 0.5, 1e-12); // ½ a t² at t = 1 s
    close(xs[10][1], 1, 1e-12);
  });
});

describe('eigenvalues', () => {
  it('2×2, 3×3 and 4×4 matrices with known spectra', () => {
    const e2 = eigvals([[0, -1], [1, 0]]).sort((a, b) => a[1] - b[1]);
    close(e2[0][1], -1);
    close(e2[1][1], 1);
    const e3 = eigvals([[2, 1, 0], [0, 3, 1], [0, 0, 5]]).map((z) => z[0]).sort();
    close_m(e3, [2, 3, 5], 1e-8);
    // companion matrix of (λ − 0.5)(λ + 0.25)(λ² + 0.81): roots 0.5, −0.25, ±0.9i
    const c = [1, -0.25, 0.685, -0.2025, -0.10125]; // λ⁴ + c1 λ³ + …
    const C: Mat = [[-c[1], -c[2], -c[3], -c[4]], [1, 0, 0, 0], [0, 1, 0, 0], [0, 0, 1, 0]];
    const e4 = eigvals(C);
    const re = e4.filter((z) => z[1] === 0).map((z) => z[0]).sort((a, b) => a - b);
    close_m(re, [-0.25, 0.5], 1e-8);
    close(spectral_radius(C), 0.9, 1e-8);
  });
});

describe('prediction matrices', () => {
  it('X = Φ x0 + Γ U equals simulating the model step by step', () => {
    const { A, B } = double_integrator(0.1);
    const r = rng(3);
    const N = 7, x0 = [1.3, -0.4];
    const U = Array.from({ length: N }, () => [r() * 2 - 1]);
    const { Phi, Gamma } = prediction_matrices(A, B, N);
    const X = matvec(Phi, x0).map((v, i) => v + dot(Gamma[i], stack(U)));
    close_m(unstack(X, 2), rollout(A, B, x0, U).slice(1), 1e-12);
    // Γ is block lower triangular: u_j does not act on x_i for i ≤ j
    expect(Gamma[0][1]).toBe(0);
    close(Gamma[2 * 3][0], 0.1 * 0.1 * 3.5, 1e-12); // x_4 position from u_0: A³B = [dt²/2 + 3dt², dt]
  });
  it('with two inputs and a 3-state model', () => {
    const r = rng(9);
    const A: Mat = [[0.9, 0.2, 0], [0, 0.8, 0.1], [0.1, 0, 0.7]], B: Mat = [[1, 0], [0, 0.5], [0.3, 1]];
    const N = 5, x0 = [1, -1, 0.5];
    const U = Array.from({ length: N }, () => [r() - 0.5, r() - 0.5]);
    const { Phi, Gamma } = prediction_matrices(A, B, N);
    const X = matvec(Phi, x0).map((v, i) => v + dot(Gamma[i], stack(U)));
    close_m(unstack(X, 3), rollout(A, B, x0, U).slice(1), 1e-12);
  });
  it('the condensed QP is the horizon cost up to a constant in x0', () => {
    const { A, B } = double_integrator(0.1);
    const Q = [[2, 0], [0, 0.5]], R = [[0.3]], P = [[5, 1], [1, 3]];
    const N = 12, x0 = [-2, 0.7];
    const c = condense(A, B, Q, R, P, N);
    const r = rng(5);
    const J0 = horizon_cost(A, B, Q, R, P, x0, Array.from({ length: N }, () => [0]));
    for (let trial = 0; trial < 5; trial++) {
      const U = Array.from({ length: N }, () => [r() * 4 - 2]);
      const u = stack(U);
      const qp = 0.5 * dot(u, matvec(c.H, u)) + dot(matvec(c.F, x0), u);
      close(horizon_cost(A, B, Q, R, P, x0, U) - J0, qp, 1e-9);
    }
  });
});

describe('LQR', () => {
  const { A, B } = double_integrator(0.1);
  it('matches scipy.linalg.solve_discrete_are on the cart', () => {
    const cases: [Mat, Mat, Mat, Mat][] = [
      // Q, R, P (scipy), K (scipy)
      [[[1, 0], [0, 0]], [[0.1]], [[8.468409703533574, 3.1622776601683955], [3.1622776601683955, 2.5198323992553098]], [[2.788857174991714, 2.361718516246891]]],
      [[[10, 0], [0, 1]], [[1]], [[90.77561471417724, 31.662280397974833], [31.662280397974833, 27.658515643889476]], [[2.762349966226607, 2.5075401623990783]]],
      [[[1, 0], [0, 1]], [[1]], [[17.834931322188982, 10.012492197250417], [10.012492197250417, 17.85658646032886]], [[0.9170745631140964, 1.6355961850466336]]],
    ];
    for (const [Q, R, P, K] of cases) {
      const s = dlqr(A, B, Q, R);
      expect(s.converged).toBe(true);
      close_m(s.P, P, 1e-7 * max_abs(P));
      close_m(s.K, K, 1e-8);
      expect(spectral_radius(sub(A, matmul(B, s.K)))).toBeLessThan(1);
    }
  });
  it('the scalar Riccati equation has a closed form', () => {
    const a = 1.2, b = 1, q = 1, r = 1;
    const c1 = r - q * b * b - a * a * r;
    const P = (-c1 + Math.sqrt(c1 * c1 + 4 * b * b * q * r)) / (2 * b * b);
    const s = dlqr([[a]], [[b]], [[q]], [[r]]);
    close(s.P[0][0], P, 1e-9);
    close(s.K[0][0], (a * b * P) / (r + b * b * P), 1e-9);
  });
  it('the unconstrained MPC is linear feedback u0 = −K_N x0, and K_N = Riccati K_0 → LQR K as N grows', () => {
    const Q = [[1, 0], [0, 0.2]], R = [[0.5]];
    const lqr = dlqr(A, B, Q, R);
    let prev = Infinity;
    for (const N of [1, 2, 5, 10, 20, 40, 80]) {
      const K_mpc = unconstrained_gain(condense(A, B, Q, R, Q, N));
      const K_ric = riccati_finite(A, B, Q, R, Q, N).K[0];
      close_m(K_mpc, K_ric, 1e-8);
      const gap = max_abs(sub(K_ric, lqr.K));
      expect(gap).toBeLessThanOrEqual(prev + 1e-12);
      prev = gap;
    }
    expect(prev).toBeLessThan(1e-3);
    // with the LQR cost-to-go as terminal weight, any horizon gives the LQR gain exactly
    for (const N of [1, 3, 10]) close_m(unconstrained_gain(condense(A, B, Q, R, lqr.P, N)), lqr.K, 1e-8);
  });
});

/** Every active set of a small QP (brute force): the feasible KKT point with λ ≥ 0 is the optimum. */
function brute_qp(qp: QP): Vec | null {
  const n = qp.H.length, A = qp.A ?? [], b = qp.b ?? [];
  let best: Vec | null = null, best_obj = Infinity;
  for (let mask = 0; mask < 1 << A.length; mask++) {
    const W = A.map((_, i) => i).filter((i) => mask & (1 << i));
    if (W.length > n) continue;
    // [H Aᵀ; A 0][x; λ] = [−f; b]
    const K: Mat = [], rhs: Vec = [];
    for (let i = 0; i < n; i++) K.push([...qp.H[i], ...W.map((w) => A[w][i])]), rhs.push(-qp.f[i]);
    for (const w of W) K.push([...A[w], ...W.map(() => 0)]), rhs.push(b[w]);
    let z: Vec;
    try {
      z = solve(K, rhs);
    } catch {
      continue;
    }
    const x = z.slice(0, n), lam = z.slice(n);
    if (lam.some((l) => l < -1e-9) || A.some((row, i) => dot(row, x) > b[i] + 1e-9)) continue;
    const obj = 0.5 * dot(x, matvec(qp.H, x)) + dot(qp.f, x);
    if (obj < best_obj) {
      best_obj = obj;
      best = x;
    }
  }
  return best;
}

describe('QP solver (Goldfarb–Idnani)', () => {
  it('without constraints it returns −H⁻¹f', () => {
    const H = [[4, 1], [1, 3]], f = [1, -2];
    const r = solve_qp({ H, f });
    close_m(r.x, matvec(inv(H), f).map((v) => -v), 1e-12);
    expect(r.status).toBe('optimal');
  });
  it('a bound in 1D clips the minimum, with the multiplier from the slope', () => {
    // min ½ 2x² − 6x s.t. x ≤ 1: unconstrained x = 3, so x = 1 and μ = 6 − 2 = 4
    const r = solve_qp({ H: [[2]], f: [-6], ub: [1] });
    close(r.x[0], 1, 1e-12);
    close(r.mu_ub[0], 4, 1e-12);
    expect(r.active_ub).toEqual([0]);
  });
  it('projecting a point onto a half-plane', () => {
    const c = [2, 1], a = [1, 1], bb = 1; // min ½|x − c|² s.t. aᵀx ≤ 1
    const r = solve_qp({ H: [[1, 0], [0, 1]], f: c.map((v) => -v), A: [a], b: [bb] });
    const k = (dot(a, c) - bb) / dot(a, a);
    close_m(r.x, [c[0] - k * a[0], c[1] - k * a[1]], 1e-12);
    close(r.lambda[0], k, 1e-12);
  });
  it('an equality constraint and its multiplier', () => {
    const qp: QP = { H: [[1, 0], [0, 1]], f: [0, 0], Aeq: [[1, 1]], beq: [1] };
    const r = solve_qp(qp);
    close_m(r.x, [0.5, 0.5], 1e-12);
    close(r.nu[0], -0.5, 1e-12);
    expect(kkt_residual(qp, r).stationarity).toBeLessThan(1e-12);
    // the other orientation (unconstrained minimum on the other side)
    const qp2: QP = { H: [[1, 0], [0, 1]], f: [-3, -3], Aeq: [[1, 1]], beq: [1] };
    const r2 = solve_qp(qp2);
    close_m(r2.x, [0.5, 0.5], 1e-12);
    expect(kkt_residual(qp2, r2).stationarity).toBeLessThan(1e-12);
  });
  it('matches brute-force active-set enumeration on 300 random problems, and meets KKT', () => {
    const r = rng(42);
    let with_active = 0;
    for (let t = 0; t < 300; t++) {
      const n = 2 + (t % 3), mc = 2 + (t % 5);
      const M = Array.from({ length: n }, () => Array.from({ length: n }, () => r() * 2 - 1));
      const H = matmul(M, transpose(M)).map((row, i) => row.map((v, j) => v + (i === j ? 0.2 : 0)));
      const qp: QP = {
        H, f: Array.from({ length: n }, () => r() * 4 - 2),
        A: Array.from({ length: mc }, () => Array.from({ length: n }, () => r() * 2 - 1)),
        b: Array.from({ length: mc }, () => r() * 1.5),
      };
      const res = solve_qp(qp), ref = brute_qp(qp);
      expect(res.status).toBe('optimal'); // b ≥ 0: x = 0 is feasible
      expect(ref).not.toBeNull();
      close_m(res.x, ref!, 1e-7);
      const k = kkt_residual(qp, res);
      expect(Math.max(k.stationarity, k.primal, k.dual, k.complementarity)).toBeLessThan(1e-8);
      if (res.active.length) with_active++;
    }
    expect(with_active).toBeGreaterThan(100);
  });
  it('degenerate and redundant constraints (a vertex with three active rows in 2D)', () => {
    // min ½|x − (3, 3)|² s.t. x1 ≤ 1, x2 ≤ 1, x1 + x2 ≤ 2 (all three meet at (1, 1))
    const qp: QP = { H: [[1, 0], [0, 1]], f: [-3, -3], A: [[1, 0], [0, 1], [1, 1]], b: [1, 1, 2] };
    const res = solve_qp(qp);
    close_m(res.x, [1, 1], 1e-10);
    const k = kkt_residual(qp, res);
    expect(Math.max(k.stationarity, k.primal, k.dual, k.complementarity)).toBeLessThan(1e-9);
  });
  it('reports infeasible problems', () => {
    expect(solve_qp({ H: [[1]], f: [0], lb: [1], ub: [0] }).status).toBe('infeasible');
    expect(solve_qp({ H: [[1, 0], [0, 1]], f: [0, 0], A: [[1, 1], [-1, 0], [0, -1]], b: [1, -1, -1] }).status).toBe('infeasible');
    expect(solve_qp({ H: [[1, 0], [0, 1]], f: [0, 0], Aeq: [[1, 1], [1, 1]], beq: [0, 1] }).status).toBe('infeasible');
  });
  it('a horizon-40 box-constrained MPC QP: KKT to 1e-8', () => {
    const { A, B } = double_integrator(0.1);
    const c = condense(A, B, [[1, 0], [0, 0.1]], [[0.01]], [[1, 0], [0, 0.1]], 40);
    const qp: QP = { H: c.H, f: matvec(c.F, [-8, 0]), lb: new Array(40).fill(-1), ub: new Array(40).fill(1) };
    const res = solve_qp(qp);
    expect(res.status).toBe('optimal');
    const k = kkt_residual(qp, res);
    expect(Math.max(k.stationarity, k.primal, k.dual, k.complementarity)).toBeLessThan(1e-8);
    expect(res.active_ub.length).toBeGreaterThan(5); // it saturates at full acceleration first
  });
});

describe('linear MPC and the receding-horizon loop', () => {
  const { A, B } = double_integrator(CART.dt);
  const Q = [[1, 0], [0, 0.1]], R = [[0.1]];
  it('without active constraints it applies the unconstrained gain', () => {
    const mpc = make_mpc({ A, B, Q, R, N: 15, u_min: [-10], u_max: [10] });
    const x0 = [0.3, -0.1];
    const plan = mpc.solve(x0);
    close(plan.U[0][0], -dot(unconstrained_gain(mpc.cond)[0], x0), 1e-10);
    expect(plan.saturated).toEqual([]);
    // the plan's states are the model's prediction
    close_m(plan.X, rollout(A, B, x0, plan.U), 1e-12);
  });
  it('drives the cart to the target within the limits, and the first input is what is applied', () => {
    const mpc = make_mpc({ A, B, Q, R, P: dlqr(A, B, Q, R).P, N: 20, u_min: [-CART.a_max], u_max: [CART.a_max], x_min: [null, -CART.v_max], x_max: [CART.p_max, CART.v_max] });
    const sim = receding_horizon(mpc, { x0: [0, 0], steps: 150, solve: () => ({ x_ref: [6, 0] }) });
    expect(sim.status.every((s) => s === 'optimal')).toBe(true);
    for (const u of sim.u) expect(Math.abs(u[0])).toBeLessThanOrEqual(CART.a_max + 1e-9);
    for (const x of sim.x) expect(Math.abs(x[1])).toBeLessThanOrEqual(CART.v_max + 1e-6);
    close(sim.x[150][0], 6, 1e-3);
    sim.plans.forEach((p, k) => close(p!.U[0][0], sim.u[k][0], 1e-15));
  });
  it('rate limits and terminal sets are respected', () => {
    // 1.5 m in 2.5 s needs full acceleration almost at once: with the rate limit it is impossible; in 4 s it is not
    const spec = { A, B, Q, R, u_min: [-1], u_max: [1], du_max: [0.2], terminal: { G: [[1, 0], [-1, 0], [0, 1], [0, -1]], w: [0.05, 0.05, 0.05, 0.05] } };
    expect(make_mpc({ ...spec, N: 25 }).solve([-1.5, 0], { u_prev: [0] }).status).toBe('infeasible');
    const plan = make_mpc({ ...spec, N: 40 }).solve([-1.5, 0], { u_prev: [0] });
    expect(plan.status).toBe('optimal');
    let prev = 0;
    for (const u of plan.U) {
      expect(Math.abs(u[0] - prev)).toBeLessThanOrEqual(0.2 + 1e-9);
      prev = u[0];
    }
    const xN = plan.X[40];
    expect(Math.max(Math.abs(xN[0]), Math.abs(xN[1]))).toBeLessThanOrEqual(0.05 + 1e-9);
  });
  it('a wall that cannot be avoided: hard constraints are infeasible, soft ones bend', () => {
    // 1 m from the wall at 2 m/s with |a| ≤ 1 needs 2 m to stop
    const spec = { A, B, Q, R, N: 30, u_min: [-1], u_max: [1], x_max: [CART.p_max, null] };
    const x0 = [CART.p_max - 1, 2];
    expect(make_mpc(spec).solve(x0, { x_ref: [CART.p_max, 0] }).status).toBe('infeasible');
    const soft = make_mpc({ ...spec, soft: { l1: 1e4, l2: 10 } }).solve(x0, { x_ref: [CART.p_max, 0] });
    expect(soft.status).toBe('optimal');
    expect(soft.slack).toBeGreaterThan(0.5);
    close(soft.U[0][0], -1, 1e-9); // it brakes as hard as it can
    // where the hard problem is feasible, the soft one has the same solution
    const x1 = [CART.p_max - 3, 2];
    const hard = make_mpc(spec).solve(x1, { x_ref: [CART.p_max, 0] });
    const soft1 = make_mpc({ ...spec, soft: { l1: 1e4, l2: 10 } }).solve(x1, { x_ref: [CART.p_max, 0] });
    expect(hard.status).toBe('optimal');
    close_m(soft1.U, hard.U, 1e-6);
    close(soft1.slack, 0, 1e-9);
  });
});

describe('the cart as a plant', () => {
  it('stops at the wall and reports the impact speed', () => {
    const r = cart_step([9.95, 1], 0, { wall: 10 });
    expect(r.crashed).toBe(true);
    close(r.impact, 1, 1e-12);
    expect(r.x).toEqual([10, 0]);
    const ok = cart_step([5, 1], -1, { wall: 10 });
    expect(ok.crashed).toBe(false);
    close(ok.x[0], 5 + 0.1 - 0.005, 1e-12);
  });
  it('a constant slope is a disturbance on the input, and the steady input cancels it', () => {
    const { A, B } = double_integrator(0.1);
    const t = steady_target(A, B, [[1, 0]], [3], { Bd: B, d: [-0.4] });
    close_m(t.x, [3, 0], 1e-12);
    close(t.u[0], 0.4, 1e-12);
    close(stopping_distance(2, 1), 2, 1e-15);
  });
});
