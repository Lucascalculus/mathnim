// M7's numbers (disturbance.ts): the offset of a nominal MPC is (d − d̂)/K_p, a
// larger position weight shrinks it but never removes it, the disturbance
// estimate removes it for every wind, the estimate's error shrinks by (1 − λ)
// per step (a running sum of prediction errors: integral action), the
// detectability rank test (B_d = B works, an output bias does not), the Kalman
// filter (the right trust is best, it beats differencing), and the tube
// (feedback keeps the error inside the precomputed widths; tightening the wall
// keeps every run off it).
import { describe, expect, it } from 'vitest';
import { double_integrator, matvec, steady_target } from './math';
import {
  KALMAN, MODEL, OFFSET, TUBE, augmented_rank_matrix, det3, disturbance_history, kalman_run, offset_formula, offset_mpc, offset_run, rms, tube_follow, tube_gain, tube_nominal, tube_widths,
} from './disturbance';

const { A, B } = double_integrator(0.1);
const T = OFFSET.steps;

describe('the offset of a nominal MPC', () => {
  it('rests at d / K_p for every weight on the slider', () => {
    for (const q of OFFSET.q_stops) {
      const r = offset_run(q, false);
      expect(Math.abs(r.offset - offset_formula(OFFSET.d, r.Kp))).toBeLessThan(5e-4);
      expect(Math.abs(r.x[T][1])).toBeLessThan(1e-3); // at rest
      expect(Math.abs(r.u_end + OFFSET.d)).toBeLessThan(1e-3); // holding a push of −d
    }
  });
  it('equals the LQR law u = u_s − K (x − x_s) while the limits are not reached', () => {
    const m = offset_mpc(1);
    for (const x0 of [[5.9, 0], [6.1, -0.2], [5.7, 0.3]]) {
      for (const dh of [0, -0.3]) {
        const tg = steady_target(A, B, MODEL.C, [OFFSET.p_ref], { Bd: B, d: [dh] });
        const plan = m.solve(x0, tg.x, tg.u[0], dh);
        const lqr = tg.u[0] - (m.K[0][0] * (x0[0] - tg.x[0]) + m.K[0][1] * (x0[1] - tg.x[1]));
        expect(Math.abs(plan.U[0] - lqr)).toBeLessThan(1e-7);
      }
    }
  });
  it('shrinks with a larger q but stays above 3 cm on the slider', () => {
    const offs = OFFSET.q_stops.map((q) => -offset_run(q, false).offset);
    for (let i = 1; i < offs.length; i++) expect(offs[i]).toBeLessThan(offs[i - 1]);
    expect(Math.min(...offs)).toBeGreaterThan(0.03);
    expect(offs[OFFSET.q_stops.indexOf(1)]).toBeCloseTo(0.1076, 3);
  });
  it('with a hand-set d̂ rests at (d − d̂) / K_p, and not at all off the flag when d̂ = d', () => {
    for (const dh of [-0.1, 0.3, -0.5]) {
      const r = offset_run(1, false, { dhat: dh });
      expect(Math.abs(r.offset - offset_formula(OFFSET.d, r.Kp, dh))).toBeLessThan(5e-4);
    }
    const exact = offset_run(1, false, { dhat: OFFSET.d });
    expect(Math.max(...exact.x.map((s) => Math.abs(s[0] - OFFSET.p_ref)))).toBeLessThan(1e-9);
  });
  it('plans to get back to the flag even while it rests short of it', () => {
    const r = offset_run(1, false);
    const plan = r.plan_p[OFFSET.k_plan];
    expect(plan[0] - OFFSET.p_ref).toBeLessThan(-0.1);
    expect(Math.abs(plan[OFFSET.N] - OFFSET.p_ref)).toBeLessThan(0.01);
  });
});

describe('offset-free MPC', () => {
  it('rests on the flag for every wind and every weight', () => {
    for (const d of OFFSET.winds) {
      for (const q of OFFSET.q_stops) {
        const r = offset_run(q, true, { d });
        expect(Math.abs(r.offset)).toBeLessThan(OFFSET.tol / 5);
        expect(Math.abs(r.dhat[T] - d)).toBeLessThan(1e-4);
        expect(Math.abs(r.u_end + d)).toBeLessThan(1e-3);
      }
    }
  });
  it('shrinks the estimate’s error by (1 − λ) every step: a running sum of prediction errors', () => {
    const r = offset_run(1, true);
    for (let k = 0; k < 30; k++) {
      const e0 = r.dhat[k] - r.d[k], e1 = r.dhat[k + 1] - r.d[k];
      expect(Math.abs(e1 - (1 - OFFSET.lambda) * e0)).toBeLessThan(1e-9);
    }
  });
  it('shifts the target to hold u_s = −d̂ at the flag (steady_target with B_d = B)', () => {
    const tg = steady_target(A, B, MODEL.C, [6], { Bd: B, d: [-0.3] });
    expect(tg.x[0]).toBeCloseTo(6, 12);
    expect(tg.x[1]).toBeCloseTo(0, 12);
    expect(tg.u[0]).toBeCloseTo(0.3, 12);
    const next = matvec(A, tg.x).map((v, i) => v + B[i][0] * (tg.u[0] - 0.3));
    expect(next[0]).toBeCloseTo(6, 12);
  });
  it('passes the detectability test with B_d = B and fails it with an output bias (RMD Lemma 1.8)', () => {
    expect(det3(augmented_rank_matrix(B.map((r) => r[0]), 0))).toBeCloseTo(0.01, 12); // Δt²
    expect(det3(augmented_rank_matrix([0, 0], 1))).toBe(0);
  });
});

describe('the Kalman filter', () => {
  const avg = (trust: number) => {
    let ve = 0, n = 0;
    for (let s = 1; s <= 60; s++) {
      const k = kalman_run({ trust, seed: s, steps: 120 });
      for (let i = 20; i <= 120; i++) {
        ve += (k.est[i][1] - k.x[i][1]) ** 2;
        n++;
      }
    }
    return Math.sqrt(ve / n);
  };
  it('is best with the true noise ratio (trust = 1)', () => {
    const v1 = avg(1);
    expect(v1).toBeLessThan(avg(0.1));
    expect(v1).toBeLessThan(avg(10));
  });
  it('estimates the speed far better than differencing the measurements', () => {
    const k = kalman_run();
    const diff = rms(k.v_diff.map((v, i) => v - k.x[i][1]));
    const est = rms(k.est.map((e, i) => e[1] - k.x[i][1]));
    expect(est).toBeLessThan(diff / 4);
    expect(rms(k.est.map((e, i) => e[0] - k.x[i][0]))).toBeLessThan(rms(k.y.map((y, i) => y - k.x[i][0])));
  });
  it('settles to a constant gain, a fixed fraction of the way to each measurement', () => {
    const k = kalman_run();
    expect(Math.abs(k.L[KALMAN.steps][0] - k.L[KALMAN.steps - 5][0])).toBeLessThan(1e-3);
    expect(k.L[KALMAN.steps][0]).toBeGreaterThan(0.2);
    expect(k.L[KALMAN.steps][0]).toBeLessThan(0.4);
    // corrected = predicted + L (y − predicted)
    const i = 30;
    expect(k.est[i][0]).toBeCloseTo(k.pred[i][0] + k.L[i][0] * (k.y[i] - k.pred[i][0]), 12);
  });
});

describe('the tube', () => {
  it('keeps the feedback error inside the precomputed widths for every disturbance history', () => {
    const h = tube_widths();
    const nom = tube_nominal(true);
    for (let s = 0; s < TUBE.runs; s++) {
      const f = tube_follow(nom, disturbance_history(TUBE.seed + 101 * s), true);
      for (const e of f.e) {
        expect(Math.abs(e[0])).toBeLessThanOrEqual(h.p + 1e-9);
        expect(Math.abs(e[1])).toBeLessThanOrEqual(h.v + 1e-9);
      }
      for (let k = 0; k < f.u.length; k++) expect(Math.abs(f.u[k])).toBeLessThanOrEqual(1 + 1e-9);
    }
  });
  it('stays off the wall only with feedback and the tightened wall', () => {
    const cross = (tight: boolean, fb: boolean) => {
      const nom = tube_nominal(tight);
      let n = 0;
      for (let s = 0; s < TUBE.runs; s++) if (Math.max(...tube_follow(nom, disturbance_history(TUBE.seed + 101 * s), fb).p) > 10) n++;
      return n;
    };
    expect(cross(false, false)).toBeGreaterThan(0);
    expect(cross(false, true)).toBeGreaterThan(0);
    expect(cross(true, true)).toBe(0);
  });
  it('has a stable ancillary loop', () => {
    const { AK } = tube_gain();
    const tr = AK[0][0] + AK[1][1], det = AK[0][0] * AK[1][1] - AK[0][1] * AK[1][0];
    // both eigenvalues inside the unit circle (Jury test for 2 × 2)
    expect(Math.abs(det)).toBeLessThan(1);
    expect(Math.abs(tr)).toBeLessThan(1 + det);
  });
});
