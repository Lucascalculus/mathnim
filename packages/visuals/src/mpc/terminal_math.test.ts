// M6: the numbers the lesson and its visuals state (toy cart simulation).
import { describe, expect, it } from 'vitest';
import { CART, cart_step, double_integrator, eigvals, make_mpc } from './math';
import { C_TERM, brake_offsets, brake_to_rest, dock_lqr, doomed, p_feasible, p_safe, soft_run, term_run, terminal_spec, trap_interval, type Mode } from './terminal_math';

const { A, B } = double_integrator(0.1);
const qp_feasible = (p: number, v: number, N: number, mode: Mode): boolean => {
  const mpc = make_mpc({ A, B, Q: [[1, 0], [0, 0]], R: [[0.1]], N, u_min: [-1], u_max: [1], x_min: [null, -2], x_max: [10, 2], ...terminal_spec(mode) });
  return mpc.solve([p, v], { x_ref: [10, 0] }).status === 'optimal';
};

describe('M6: the LQR of the docking cost', () => {
  it('has complex closed-loop eigenvalues 0.875 ± 0.111i, so it overshoots', () => {
    const { K, Acl } = dock_lqr();
    expect(K[0][0]).toBeCloseTo(2.789, 3);
    expect(K[0][1]).toBeCloseTo(2.362, 3);
    const ev = eigvals(Acl);
    expect(ev[0][0]).toBeCloseTo(0.875, 3);
    expect(Math.abs(ev[0][1])).toBeCloseTo(0.111, 3);
  });
  it('starting at rest just short of the wall, the unconstrained LQR passes the wall: no neighbourhood of the target keeps p within 10', () => {
    const { K } = dock_lqr();
    for (const d of [0.001, 0.01, 0.1]) {
      let x = [10 - d, 0], pmax = -Infinity;
      for (let k = 0; k < 100; k++) {
        const a = -(K[0][0] * (x[0] - 10) + K[0][1] * x[1]);
        x = [x[0] + 0.1 * x[1] + 0.005 * a, x[1] + 0.1 * a];
        pmax = Math.max(pmax, x[0]);
      }
      expect(pmax).toBeGreaterThan(10);
    }
  });
});

describe('M6: the exact feasible sets', () => {
  it('the braking rollout predicts the QP status on a grid (no terminal ingredient and the terminal set)', () => {
    for (const mode of ['none', 'set'] as Mode[]) for (const N of [3, 5, 12]) {
      for (let v = -0.2; v <= 2.4; v += 0.2) {
        const edge = p_feasible(v, N, mode)!;
        for (const dp of [-0.03, 0.03]) {
          const p = Number.isFinite(edge) ? edge + dp : 5;
          if (p < 0 || p > 10) continue;
          expect(qp_feasible(p, v, N, mode)).toBe(Number.isFinite(edge) && dp < 0);
        }
      }
    }
  });
  it('N = 5 at 2 m/s: the trap is p between 8 and 9.125 m', () => {
    const t = trap_interval(2, 5, 'none')!;
    expect(t[0]).toBeCloseTo(8, 9);
    expect(t[1]).toBeCloseTo(9.125, 9);
    expect(p_safe(2)).toBeCloseTo(8, 9);
  });
  it('the trap exists exactly while the window is shorter than the stop (N·Δt below v/a), here at 2 m/s for N up to 19', () => {
    for (let N = 2; N <= 19; N++) expect(trap_interval(2, N, 'none')).not.toBeNull();
    for (const N of [20, 25, 40]) expect(trap_interval(2, N, 'none')).toBeNull();
  });
  it('the terminal set has no trap for any N: its feasible set lies inside "a stop is possible"', () => {
    for (const N of [2, 5, 8, 19]) for (let v = 0; v <= 2.1; v += 0.05) {
      const e = p_feasible(v, N, 'set')!;
      if (Number.isFinite(e)) expect(Math.min(e, 10)).toBeLessThanOrEqual(p_safe(v) + 5e-3); // between samples a cart slower than aΔt can pass a sampled limit by up to (aΔt)²/2a = 5 mm
      expect(trap_interval(v, N, 'set')).toBeNull();
    }
  });
  it('the braking rollout never goes below −v_max', () => {
    expect(Math.min(...brake_offsets(-1.9, 10).v)).toBeGreaterThanOrEqual(-2 - 1e-12);
  });
});

describe('M6: X_f = {p + 1.95 v up to 10, the state limits} is control invariant under "brake to rest"', () => {
  it('c = v_max/a_max − Δt/2 = 1.95 s', () => expect(C_TERM).toBeCloseTo(1.95, 12));
  it('every grid state in X_f stays in X_f, keeps |a| within 1 and never reaches the wall moving', () => {
    let n = 0, bad = 0;
    for (let p = 0; p <= 10 + 1e-9; p += 0.1) for (let v = -2; v <= 2 + 1e-9; v += 0.04) {
      if (p + C_TERM * v > 10 + 1e-12) continue;
      let x = [p, v];
      for (let k = 0; k < 25; k++) {
        const a = brake_to_rest(x[1]);
        const s = cart_step(x, a, { wall: 10 + 1e-9 });
        x = s.x;
        if (Math.abs(a) > 1 + 1e-12 || s.crashed || x[0] > 10 + 1e-9 || Math.abs(x[1]) > 2 + 1e-9 || x[0] + C_TERM * x[1] > 10 + 1e-9) bad++;
      }
      if (doomed(p, v)) bad++;
      n++;
    }
    expect(bad).toBe(0);
    expect(n).toBeGreaterThan(1500);
  });
  it('at 2 m/s on the edge, one braking step lands exactly on the edge again (why c is 1.95 and not 2)', () => {
    const x = [10 - 2 * C_TERM, 2];
    const s = cart_step(x, -1);
    expect(s.x[0] + C_TERM * s.x[1]).toBeCloseTo(10, 12);
  });
});

describe('M6: the closed-loop runs', () => {
  it('nothing at the end: N = 5 is in the trap from t = 5.1 s, infeasible from 5.6 s and hits at 1.55 m/s', () => {
    const r = term_run(5, 'none');
    expect(r.trap_k).toBe(51);
    expect(r.infeasible_k).toBe(56);
    expect(r.crash_k).toBe(61);
    expect(r.impact).toBeCloseTo(1.55, 2);
    expect(r.shown_k).toBe(50);
  });
  it('nothing at the end: N up to 18 hits, 19 docks at 7.3 s (M1)', () => {
    expect(term_run(8, 'none').impact).toBeCloseTo(1.18, 2);
    expect(term_run(15, 'none').impact).toBeCloseTo(0.54, 2);
    expect(term_run(18, 'none').crash_k).toBeGreaterThan(0);
    expect(term_run(19, 'none').crash_k).toBe(-1);
    expect(term_run(19, 'none').docked_k).toBe(73);
  });
  it('the LQR terminal cost alone still hits for N = 2..19 (N = 5 at 1.01 m/s)', () => {
    for (let N = 2; N <= 19; N++) expect(term_run(N, 'cost').crash_k).toBeGreaterThan(0);
    expect(term_run(5, 'cost').impact).toBeCloseTo(1.01, 2);
    expect(term_run(20, 'cost').crash_k).toBe(-1);
  });
  it('the terminal set: never infeasible, never in the trap, docks for every N (N = 2: 16.7 s, 5: 12.0 s, 8: 8.3 s)', () => {
    for (let N = 2; N <= 20; N++) {
      const r = term_run(N, 'set');
      expect(r.infeasible_k).toBe(-1);
      expect(r.doomed_k).toBe(-1);
      expect(r.crash_k).toBe(-1);
      expect(r.docked_k).toBeGreaterThan(0);
    }
    expect(term_run(2, 'set').docked_k).toBe(167);
    expect(term_run(5, 'set').docked_k).toBe(120);
    expect(term_run(8, 'set').docked_k).toBe(83);
  });
  it('end at the target: infeasible at rest for N up to 69 (the cart never starts), docks from N = 70 at 7.1 s', () => {
    for (const N of [5, 19, 40, 69]) {
      const r = term_run(N, 'end');
      expect(r.infeasible_k).toBe(0);
      expect(r.started).toBe(false);
    }
    const r = term_run(70, 'end');
    expect(r.infeasible_k).toBe(-1);
    expect(r.docked_k).toBe(71);
  });
  it('the shortest manoeuvre to the target from rest is 7 s: 2 s accelerating, 3 s at 2 m/s, 2 s braking (so N = 70)', () => {
    expect(2 * (0.5 * 2 * 2) + 3 * 2).toBeCloseTo(10, 12);
    expect(CART.v_max / CART.a_max).toBe(2);
  });
});

describe('M6: a soft speed limit (N = 20, wall hard, a gust of +0.4 m/s at t = 3 s)', () => {
  it('hard: the QP is infeasible for 3 samples after the gust', () => {
    const r = soft_run(null);
    expect(r.feasible.filter((f) => !f).length).toBe(3);
    expect(r.crash_k).toBe(-1);
  });
  it('l1 = 1000: the same motion as hard, with slacks 0.3, 0.2, 0.1, and always feasible', () => {
    const h = soft_run(null), s = soft_run(1000);
    expect(s.feasible.every((f) => f)).toBe(true);
    expect(s.v.length).toBe(h.v.length);
    s.v.forEach((v, i) => expect(v).toBeCloseTo(h.v[i], 3));
    expect(s.slack.slice(30, 33).map((x) => +x.toFixed(3))).toEqual([0.3, 0.2, 0.1]);
  });
  it('l1 = 10 is a suggestion: without any gust the cart cruises at 2.78 m/s', () => {
    const s = soft_run(10, { push_k: 999 });
    expect(Math.max(...s.v)).toBeCloseTo(2.78, 2);
    expect(Math.max(...soft_run(1000, { push_k: 999 }).v)).toBeCloseTo(2, 6);
  });
});
