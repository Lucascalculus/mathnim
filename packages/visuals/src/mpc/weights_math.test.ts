// M3's numbers (weights_math.ts): the LQR gain against scipy's DARE, the
// unconstrained MPC gain against the condensed QP, the facts the lesson states
// (only ratios matter; with no price on speed the overshoot does not depend on r;
// the first push is 6 k_p; K_N → K_LQR, and with P = P_∞ every horizon gives K_LQR),
// and the two briefs of the world (not met at entry, met by the scripted solution).
import { describe, expect, it } from 'vitest';
import { condense, dlqr, double_integrator, unconstrained_gain } from './math';
import { W3, continuous_lqr, gains_by_horizon, meets_fast, meets_gentle, weights_gain, weights_run } from './weights_math';

const { A, B } = double_integrator(0.1);
const close = (a: number, b: number, eps = 1e-9) => expect(Math.abs(a - b)).toBeLessThan(eps);

describe('the M3 gain', () => {
  it('matches scipy solve_discrete_are (values from scipy 1.18)', () => {
    const cases: [number, number, [number, number]][] = [
      [0, 0.1, [2.788857174991714, 2.361718516246891]],
      [0.01, 0.1, [2.7861026946729917, 2.37693690946954]],
      [1, 1, [0.9170745631140964, 1.6355961850466336]],
      [0.3, 0.1, [2.71503688378765, 2.764326563862072]],
      [10, 10 ** 1.75, [0.12898021001798715, 0.6513980087464305]],
    ];
    for (const [qv, r, K] of cases) {
      const k = weights_gain(qv, r);
      close(k[0], K[0], 1e-8);
      close(k[1], K[1], 1e-8);
    }
  });
  it('is the unconstrained MPC gain of a long horizon (first rows of H⁻¹F)', () => {
    const Q = [[1, 0], [0, 0.3]], R = [[0.1]];
    const KN = unconstrained_gain(condense(A, B, Q, R, Q, 80))[0];
    const K = weights_gain(0.3, 0.1);
    close(KN[0], K[0], 1e-6);
    close(KN[1], K[1], 1e-6);
  });
  it('depends only on the ratios of the weights', () => {
    const a = dlqr(A, B, [[1, 0], [0, 2]], [[0.5]]).K[0], b = dlqr(A, B, [[10, 0], [0, 20]], [[5]]).K[0];
    close(a[0], b[0], 1e-9);
    close(a[1], b[1], 1e-9);
    expect(weights_gain(2, 0.5, 1)).toEqual(weights_gain(2, 0.5, 1));
  });
  it('is close to the continuous closed form when the loop is slow (ωΔt small)', () => {
    const c = continuous_lqr(10, 100), d = weights_gain(10, 100);
    expect(Math.abs(d[0] - c.K[0]) / c.K[0]).toBeLessThan(0.05);
    expect(Math.abs(d[1] - c.K[1]) / c.K[1]).toBeLessThan(0.05);
    close(continuous_lqr(0, 3).zeta, Math.SQRT1_2, 1e-12);
  });
});

describe('the M3 runs', () => {
  it('the first push is a_0 = 6 k_p and it is the largest', () => {
    for (const [qv, r] of [[0.01, 0.1], [1, 1], [10, 50]]) {
      const w = weights_run(qv, r);
      close(w.u[0], W3.p_ref * w.K[0], 1e-12);
      close(w.peak, Math.abs(w.u[0]), 1e-12);
    }
  });
  it('with (almost) no price on speed the overshoot hardly depends on r: about 26 cm', () => {
    const o = [0.1, 1, 10, 100].map((r) => weights_run(0.01, r).overshoot);
    for (const v of o) expect(v).toBeGreaterThan(0.2);
    expect(Math.max(...o) - Math.min(...o)).toBeLessThan(0.04);
  });
  it('a larger r is slower and gentler: 100× r gives about a tenth of the push', () => {
    const a = weights_run(0.01, 0.1), b = weights_run(0.01, 10);
    expect(b.peak / a.peak).toBeGreaterThan(0.08);
    expect(b.peak / a.peak).toBeLessThan(0.13);
    expect(b.arrival!).toBeGreaterThan(2.5 * a.arrival!);
  });
  it('the briefs: neither at entry (r = 0.1, q_v = 0.01); the solution meets each', () => {
    const entry = weights_run(0.01, 0.1);
    expect(meets_fast(entry)).toBe(false);
    expect(meets_gentle(entry)).toBe(false);
    expect(meets_fast(weights_run(10 ** -0.5, 0.1))).toBe(true);
    expect(meets_gentle(weights_run(10 ** 0.8, 10 ** 1.7))).toBe(true);
    // making everything expensive is not enough: too slow
    expect(meets_gentle(weights_run(100, 100))).toBe(false);
    // and no weights meet both: the gentle runs need more than 5 s
    for (let i = 0; i <= 40; i++) for (let j = 0; j <= 40; j++) {
      const w = weights_run(10 ** (-2 + 0.1 * j), 10 ** (-2 + 0.1 * i));
      expect(meets_fast(w) && meets_gentle(w)).toBe(false);
    }
  });
  it('within the motor limit the best trip takes about 11 s, over twice the shortest possible (2√6 ≈ 4.9 s)', () => {
    // the slider grid (0.05 decades) where |a| can stay within 1: r from 10 to 100, q_v from 1 to 100
    let best = Infinity;
    for (let i = 60; i <= 80; i++) for (let j = 40; j <= 80; j++) {
      const w = weights_run(10 ** (-2 + 0.05 * j), 10 ** (-2 + 0.05 * i));
      if (w.peak <= 1 && w.overshoot <= 0.05 && w.arrival !== null) best = Math.min(best, w.arrival);
    }
    expect(best).toBeGreaterThan(10.5);
    expect(best).toBeLessThan(11.5);
    expect(2 * Math.sqrt(W3.p_ref / W3.a_lim)).toBeCloseTo(4.899, 3);
  });
});

describe('K_N against the horizon', () => {
  const Q = [[1, 0], [0, 0]], R = [[0.1]];
  const K = dlqr(A, B, Q, R).K[0];
  it('with P = Q it converges to the LQR gain (scipy: N = 5 → [1.171, 0.444], N = 20 → [2.701, 2.323])', () => {
    const g = gains_by_horizon(Q, R, Q, 60);
    close(g[4][0], 1.171, 1e-3);
    close(g[4][1], 0.444, 1e-3);
    close(g[19][0], 2.701, 1e-3);
    close(g[19][1], 2.323, 1e-3);
    close(g[59][0], K[0], 1e-3);
    const cond = unconstrained_gain(condense(A, B, Q, R, Q, 20))[0];
    close(g[19][0], cond[0], 1e-9);
    close(g[19][1], cond[1], 1e-9);
  });
  it('with P = P_∞ every horizon gives the LQR gain', () => {
    const P = dlqr(A, B, Q, R).P;
    for (const k of gains_by_horizon(Q, R, P, 30)) {
      close(k[0], K[0], 1e-8);
      close(k[1], K[1], 1e-8);
    }
  });
});
