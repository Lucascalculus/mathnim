// The numbers M7's scenes and lesson text quote (kalman_view.ts, tube_view.ts).
import { describe, expect, it } from 'vitest';
import { kalman_numbers } from './kalman_view';
import { tube_panels } from './tube_view';

describe('M7 scene numbers', () => {
  it('Kalman: differencing about 0.8 m/s RMS, the filter about 0.12, gain about 0.29', () => {
    const n = kalman_numbers();
    expect(n.v_diff_rms).toBeCloseTo(0.8, 1);
    expect(n.v_est_rms).toBeCloseTo(0.12, 2);
    expect(n.Lp).toBeCloseTo(0.29, 2);
    expect(n.p_est_rms).toBeLessThan(n.p_meas_rms);
    // the combined bell: L_p = P⁻ / (P⁻ + V), posterior variance L_p V
    expect(n.Lp).toBeCloseTo(n.s_pred ** 2 / (n.s_pred ** 2 + n.s_meas ** 2), 9);
    expect(n.s_est ** 2).toBeCloseTo(n.Lp * n.s_meas ** 2, 9);
  });
  it('tube: 4, 8 and 0 of 12 runs cross the wall; the width is 18 cm', () => {
    const p = tube_panels();
    expect([p.open.n_cross, p.feedback.n_cross, p.tight.n_cross]).toEqual([4, 8, 0]);
    expect(Math.round(p.widths.p * 100)).toBe(18);
  });
});
