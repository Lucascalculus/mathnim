// M2's math: the cart's prediction X = Φ x_0 + Γ U (bars_math.ts), checked
// against direct simulation, closed forms and the numbers the lesson states.
import { describe, expect, it } from 'vitest';
import { matvec, rollout, vadd } from './math';
import { BARS, DOCK_PLAN, bars_status, cart_euler, cart_model, cart_prediction, end_state, end_weights, euler_gap, free_response, path, predict, snap_u } from './bars_math';

const close = (a: number, b: number, tol = 1e-12) => expect(Math.abs(a - b)).toBeLessThan(tol);
const early = [-1, -1, -1, -1, -1, 0, 0, 0, 0, 0];
const late = [0, 0, 0, 0, 0, -1, -1, -1, -1, -1];
const even = new Array(10).fill(-0.5);

describe('the cart model', () => {
  it('exact ZOH gives A = [[1, dt], [0, 1]], B = [[dt²/2], [dt]]', () => {
    const { A, B } = cart_model();
    close(A[0][0], 1); close(A[0][1], 0.1); close(A[1][0], 0); close(A[1][1], 1);
    close(B[0][0], 0.005); close(B[1][0], 0.1);
  });
  it('Euler has the same A but misses B’s dt²/2', () => {
    const { A, B } = cart_euler();
    close(A[0][1], 0.1);
    close(B[0][0], 0); close(B[1][0], 0.1);
  });
});

describe('prediction matrices', () => {
  const { Phi, Gamma } = cart_prediction();
  it('Φ stacks A^k: rows [1, k dt] and [0, 1]', () => {
    for (let k = 1; k <= 10; k++) {
      close(Phi[2 * (k - 1)][0], 1); close(Phi[2 * (k - 1)][1], k * 0.1);
      close(Phi[2 * k - 1][0], 0); close(Phi[2 * k - 1][1], 1);
    }
  });
  it('Γ is lower-triangular: block (k, j) = A^{k-1-j} B = [(k − j − ½) dt², dt] for j < k, zero otherwise', () => {
    for (let k = 1; k <= 10; k++) for (let j = 0; j < 10; j++) {
      const pk = Gamma[2 * (k - 1)][j], vk = Gamma[2 * k - 1][j];
      if (j < k) { close(pk, (k - j - 0.5) * 0.01); close(vk, 0.1); }
      else { close(pk, 0); close(vk, 0); }
    }
  });
  it('Φ x0 + Γ U equals stepping the model, for random plans', () => {
    const { A, B } = cart_model();
    let seed = 7;
    const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647) * 2 - 1;
    for (let trial = 0; trial < 20; trial++) {
      const U = Array.from({ length: 10 }, () => snap_u(rnd()));
      const xs = rollout(A, B, [BARS.p0, BARS.v0], U.map((u) => [u]));
      const pr = predict(U);
      for (let k = 0; k <= 10; k++) { close(pr.p[k], xs[k][0], 1e-12); close(pr.v[k], xs[k][1], 1e-12); }
      const X = vadd(matvec(Phi, [BARS.p0, BARS.v0]), matvec(Gamma, U));
      close(X[18], pr.p[10]); close(X[19], pr.v[10]);
      const e = end_state(U);
      close(e.v, pr.v[10], 1e-12); close(e.p, pr.p[10], 1e-12);
    }
  });
  it('the last block row of Γ is the end weights: dt for v, (9.5 − j) dt² for p', () => {
    const w = end_weights();
    for (let j = 0; j < 10; j++) { close(Gamma[19][j], w.v[j]); close(Gamma[18][j], w.p[j]); close(w.p[j], (9.5 - j) * 0.01); }
  });
  it('the exact path between samples meets the samples', () => {
    const pts = path(DOCK_PLAN, undefined, undefined, 6);
    const pr = predict(DOCK_PLAN);
    for (let k = 0; k <= 10; k++) { close(pts[6 * k][1], pr.p[k], 1e-12); close(pts[6 * k][2], pr.v[k], 1e-12); }
  });
});

describe('the world (cart at 9.7 m, 0.5 m/s, wall at 10 m)', () => {
  it('free response coasts through the wall: p_10 = 10.2', () => {
    const f = free_response();
    close(f.p[10], 10.2, 1e-12); close(f.v[10], 0.5, 1e-12);
    expect(bars_status(new Array(10).fill(0)).docked).toBe(false);
  });
  it('the dock plan docks: Σu = −5, Σ(9.5 − j)u_j = −20', () => {
    const e = end_state(DOCK_PLAN);
    close(e.sum, -5, 1e-12); close(e.wsum, -20, 1e-12);
    const s = bars_status(DOCK_PLAN);
    expect(s.docked).toBe(true);
    expect(s.past_k).toBe(-1);
  });
  it('same total early vs late: both at rest, early stops 17.5 cm short, late ends 7.5 cm past the wall', () => {
    const a = bars_status(early), b = bars_status(late);
    expect(a.at_rest && b.at_rest).toBe(true);
    close(a.p_end, 9.825, 1e-9); close(b.p_end, 10.075, 1e-9);
    close(a.short_by, 0.175, 1e-9);
    expect(b.past_k).toBeGreaterThan(0);
    expect(b.docked).toBe(false);
  });
  it('even braking (−0.5 on every bar) stops 5 cm short', () => {
    const s = bars_status(even);
    expect(s.at_rest).toBe(true);
    close(s.p_end, 9.95, 1e-9);
    expect(s.docked).toBe(false);
  });
  it('stopping distance = v0 × the mean braking time t_c (input-weighted mid-times)', () => {
    for (const U of [DOCK_PLAN, early, late, even]) {
      const sum = U.reduce((s, u) => s + u, 0);
      const t_c = U.reduce((s, u, j) => s + u * (j + 0.5) * 0.1, 0) / sum;
      close(predict(U).p[10] - BARS.p0, BARS.v0 * t_c, 1e-12);
    }
    // docking needs t_c = 0.3 / 0.5 = 0.6 s
  });
  it('more than −5 in total reverses the cart (v_10 < 0)', () => {
    const U = [...DOCK_PLAN];
    U[9] = -0.5;
    expect(bars_status(U).v_end).toBeLessThan(0);
  });
});

describe('Euler versus exact', () => {
  it('from rest at 1 m/s² for 1 s: exact 0.5 m, Euler 0.45 m', () => {
    const g = euler_gap(1, 1, 0.1);
    close(g.exact, 0.5, 1e-12); close(g.euler, 0.45, 1e-12);
  });
  it('a plan that Euler’s model says docks really ends ½ dt² Σu = 2.5 cm short', () => {
    // Euler's p_10 = 10.2 + 0.01 Σ (9 − j) u_j: full braking on bars 3..7 makes that 10
    const E = cart_euler();
    const U = [0, 0, 0, -1, -1, -1, -1, -1, 0, 0];
    const xe = rollout(E.A, E.B, [BARS.p0, BARS.v0], U.map((u) => [u]));
    close(xe[10][0], 10.0, 1e-12); close(xe[10][1], 0, 1e-12);
    close(predict(U).p[10], 9.975, 1e-12);
  });
});
