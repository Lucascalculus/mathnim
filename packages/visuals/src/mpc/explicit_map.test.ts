// The explicit-MPC picture (explicit_map.ts): the slice law is the QP's answer,
// piecewise affine, and equals the no-limits law where no limit is active.
import { describe, expect, it } from 'vitest';
import { region_of, solve_plan } from './qp2d';
import { MAP, free_a1, map_regions, slice_law } from './explicit_map';
import { qp_view } from './qp_plane';

describe('explicit MPC map', () => {
  it('the regions cover every feasible state, and only those', () => {
    const regs = map_regions();
    expect(regs.length).toBe(12);
    for (let p = MAP.p[0]; p <= MAP.p[1]; p += 0.137) {
      for (let v = MAP.v[0]; v <= MAP.v[1]; v += 0.091) {
        const ok = solve_plan([p, v]).status === 'optimal';
        expect(!!region_of(regs, [p, v])).toBe(ok);
      }
    }
  });
  it('along a slice the law is the QP solution, continuous, and kinks only at region changes', () => {
    for (const v of [0, 0.6, 1.5, 1.9]) {
      const { pts, kinks, end } = slice_law(v);
      for (const [p, a1] of pts) if (p < end - 1e-6) expect(a1).toBeCloseTo(solve_plan([p, v]).z[0], 6);
      for (let i = 1; i < pts.length; i++) expect(Math.abs(pts[i][1] - pts[i - 1][1])).toBeLessThan(0.2); // no jumps
      expect(kinks.length).toBeGreaterThan(0);
    }
  });
  it('where no limit is active the MPC law is the no-limits law (M3)', () => {
    const regs = map_regions();
    const r = regs.find((x) => x.key === 'none')!;
    for (const x0 of [[8.8, 0.3], [9.2, 0.1], [8.6, 0.9]]) {
      expect(region_of(regs, x0)).toBe(r);
      expect(solve_plan(x0).z[0]).toBeCloseTo(free_a1(x0[0], x0[1]), 9);
    }
  });
  it('qp_view reports what the world needs', () => {
    const v = qp_view([7, 0]);
    expect(v.flip).toBe(true);
    expect(v.wall).toBe(false);
    expect(qp_view([7.1, 1.9]).wall).toBe(true);
    expect(qp_view([9.3, 1.8]).feasible).toBe(false);
    expect(qp_view([9, 0.2]).ids).toEqual([]);
    expect(v.J_clip).toBeGreaterThan(v.J_best);
  });
});
