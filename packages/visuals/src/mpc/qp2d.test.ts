// The two-move cart QP (qp2d.ts): rows match the full 20-step model, the
// solution satisfies KKT, the explicit partition agrees with the solver.
import { describe, expect, it } from 'vitest';
import { horizon_cost, rollout, type Vec } from './math';
import {
  COST, Q2, ROWS, ROW_INDEX, clipped, contour, cost, critical_regions, feasible, feasible_polygon, horizon_J, ids_of, kkt_ok, law_a1, level_set, predicted, radius, region_of, rhs, row_segment, slack_of, solve_plan, unconstrained, working_set_point,
} from './qp2d';

/** Deterministic pseudo-random numbers. */
function rng(seed: number) {
  let s = seed >>> 0;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 2 ** 32);
}
const U_of = (z: Vec) => Array.from({ length: Q2.N }, (_, k) => [k < Q2.L ? z[0] : z[1]]);

describe('two-move QP', () => {
  it('the rows are the limits of the full model at t = 1 s and 2 s', () => {
    const r = rng(1);
    for (let t = 0; t < 20; t++) {
      const x0 = [4 + 6 * r(), -1 + 3 * r()], z = [-1 + 2 * r(), -1 + 2 * r()];
      const xs = rollout(COST.A, COST.B, x0, U_of(z));
      const lhs = (id: string) => ROWS[ROW_INDEX[id]].g[0] * z[0] + ROWS[ROW_INDEX[id]].g[1] * z[1] - ROWS[ROW_INDEX[id]].e[0] * x0[0] - ROWS[ROW_INDEX[id]].e[1] * x0[1];
      // row: g·z − e·x0 ≤ w, and g·z − e·x0 is the constrained quantity (or its negative), up to the constant
      expect(lhs('v1+')).toBeCloseTo(xs[10][1], 10);
      expect(-lhs('v1-')).toBeCloseTo(xs[10][1], 10);
      expect(lhs('v2+')).toBeCloseTo(xs[20][1], 10);
      expect(lhs('p1')).toBeCloseTo(xs[10][0], 10);
      expect(lhs('p2')).toBeCloseTo(xs[20][0], 10);
      expect(predicted(x0, z)[9][0]).toBeCloseTo(xs[10][0], 10);
      expect(predicted(x0, z)[19][1]).toBeCloseTo(xs[20][1], 10);
    }
  });
  it('the cost is the horizon cost J (up to a constant in x0)', () => {
    const x0 = [6.3, 0.8];
    const J = (z: Vec) => horizon_cost(COST.A, COST.B, COST.Q, COST.R, COST.Q, [x0[0] - Q2.p_ref, x0[1]], U_of(z));
    const za = [0.3, -0.4], zb = [-0.7, 0.9];
    expect(cost(za, x0) - cost(zb, x0)).toBeCloseTo(J(za) - J(zb), 9);
  });
  it('the no-limits plan minimises the cost; clipping saturates each move', () => {
    const x0 = [6, 0];
    const u = unconstrained(x0);
    for (const d of [[1e-3, 0], [0, 1e-3], [-1e-3, 1e-3]]) expect(cost([u[0] + d[0], u[1] + d[1]], x0)).toBeGreaterThan(cost(u, x0));
    expect(clipped(x0)).toEqual(u.map((v) => Math.max(-1, Math.min(1, v))));
  });
  it('known states: what the lesson text says', () => {
    // at rest 1.5 m short of the flag: the first move saturates, the second is positive (clipping says negative)
    const s = solve_plan([8, 0]);
    expect(s.z[0]).toBeCloseTo(1, 9);
    expect(s.z[1]).toBeGreaterThan(0.2);
    expect(clipped([8, 0])[1]).toBeLessThan(-0.4);
    expect(s.active.map((i) => ROWS[i].id)).toEqual(['a1+']);
    // fast and far: both speed limits, inputs not saturated
    const f = solve_plan([6, 1.5]);
    expect(f.active.map((i) => ROWS[i].id).sort()).toEqual(['v1+', 'v2+']);
    expect(f.z[0]).toBeCloseTo(0.5, 9);
    // fast near the flag: the wall at 2 s holds the plan back, no move at its limit
    const w = solve_plan([7, 2]);
    expect(w.active.map((i) => ROWS[i].id)).toEqual(['p2']);
    expect(Math.abs(w.z[0])).toBeLessThan(0.95);
    expect(Math.abs(w.z[1])).toBeLessThan(0.95);
    // too fast, too close: no plan at all
    expect(feasible([9.5, 1.8])).toBe(false);
  });
  it('the solution satisfies KKT and kkt_ok agrees', () => {
    const r = rng(7);
    for (let t = 0; t < 200; t++) {
      const x0 = [4 + 6 * r(), -1 + 3 * r()];
      const s = solve_plan(x0);
      if (s.status !== 'optimal') continue;
      for (let i = 0; i < ROWS.length; i++) expect(slack_of(i, s.z, x0)).toBeLessThan(1e-7);
      expect(kkt_ok(x0, s.active)).toBe(true);
      const wp = working_set_point(x0, s.active)!;
      expect(wp.z[0]).toBeCloseTo(s.z[0], 7);
      expect(wp.z[1]).toBeCloseTo(s.z[1], 7);
    }
  });
  it('a wrong working set fails the KKT test (violation or negative multiplier)', () => {
    const x0 = [6, 1.5];
    expect(kkt_ok(x0, [])).toBe(false); // the no-limits plan crosses the speed limit
    expect(kkt_ok(x0, [ROW_INDEX['v1+']])).toBe(false);
    expect(kkt_ok(x0, [ROW_INDEX['v1+'], ROW_INDEX['v2+']])).toBe(true);
    expect(working_set_point(x0, [ROW_INDEX['a1+'], ROW_INDEX['v1+']])).toBeNull(); // parallel rows
    expect(working_set_point(x0, [0, 2, 4])).toBeNull();
  });
  it('the level set passes through the point it is drawn through', () => {
    const x0 = [8, 0], s = solve_plan(x0);
    const pts = level_set(x0, s.z, 64);
    for (const p of pts) expect(cost(p, x0)).toBeCloseTo(cost(s.z, x0), 8);
  });
  it('the explicit partition agrees with the solver everywhere', () => {
    const box = { p: [4, 10] as [number, number], v: [-1, 2] as [number, number] };
    const regions = critical_regions(box);
    expect(regions.length).toBeGreaterThan(6);
    const r = rng(3);
    let checked = 0;
    for (let t = 0; t < 400; t++) {
      const x0 = [4 + 6 * r(), -1 + 3 * r()];
      const s = solve_plan(x0), reg = region_of(regions, x0);
      if (s.status !== 'optimal') {
        expect(reg).toBeNull();
        continue;
      }
      expect(reg).not.toBeNull();
      expect(law_a1(reg!, x0)).toBeCloseTo(s.z[0], 6);
      checked++;
    }
    expect(checked).toBeGreaterThan(300);
    // the unconstrained region exists and contains the flag at rest
    expect(region_of(regions, [9.4, 0.05])!.key).toBe('none');
  });
  it('rhs moves with the state as the formulas say', () => {
    expect(rhs(ROW_INDEX['v1+'], [5, 1.5])).toBeCloseTo(0.5, 12);
    expect(rhs(ROW_INDEX['p2'], [5, 1.5])).toBeCloseTo(2, 12);
  });
});

describe('what the M4 pictures draw', () => {
  it('contours are the level sets they claim to be: cost(z) = cost(c) + r²/2', () => {
    const x0 = [7.2, 1.1], c = unconstrained(x0);
    for (const r of [0.5, 2, 6]) for (const z of contour(x0, r, 40)) {
      expect(radius(z, x0)).toBeCloseTo(r, 9);
      expect(cost(z, x0) - cost(c, x0)).toBeCloseTo((r * r) / 2, 8);
    }
  });
  it('horizon_J is the docking cost of the 20-step model', () => {
    const r = rng(11);
    for (let t = 0; t < 10; t++) {
      const x0 = [5 + 4 * r(), 2 * r()], z = [-1 + 2 * r(), -1 + 2 * r()];
      expect(horizon_J(z, x0)).toBeCloseTo(horizon_cost(COST.A, COST.B, COST.Q, COST.R, COST.Q, [x0[0] - Q2.p_ref, x0[1]], U_of(z)), 9);
    }
  });
  it('the feasible polygon is exactly the plans that keep every limit', () => {
    const r = rng(5);
    for (let t = 0; t < 60; t++) {
      const x0 = [4 + 6 * r(), 2 * r()];
      const poly = feasible_polygon(x0);
      expect(poly.length > 0).toBe(feasible(x0));
      for (const v of poly) for (let i = 0; i < ROWS.length; i++) expect(slack_of(i, v, x0)).toBeLessThan(1e-9);
      // the best plan lies in it (convex: on the inner side of every edge)
      if (poly.length) {
        const z = solve_plan(x0).z;
        for (let i = 0; i < poly.length; i++) {
          const a = poly[i], b = poly[(i + 1) % poly.length];
          const cr = (b[0] - a[0]) * (z[1] - a[1]) - (b[1] - a[1]) * (z[0] - a[0]);
          const area2 = poly.reduce((s, q, k) => s + q[0] * poly[(k + 1) % poly.length][1] - poly[(k + 1) % poly.length][0] * q[1], 0);
          expect(Math.sign(area2) * cr).toBeGreaterThan(-1e-7);
        }
      }
    }
  });
  it('row_segment lies on the row and inside the square', () => {
    const x0 = [7, 1.5];
    for (let i = 0; i < ROWS.length; i++) {
      const s = row_segment(i, x0);
      if (!s) continue;
      for (const p of s) {
        expect(Math.abs(slack_of(i, p, x0))).toBeLessThan(1e-9);
        expect(Math.max(Math.abs(p[0]), Math.abs(p[1]))).toBeLessThanOrEqual(2 + 1e-9);
      }
    }
  });
  it('solve_plan on a subset of rows ignores the others; the empty subset is the no-limits plan', () => {
    const x0 = [7.1, 1.9];
    expect(solve_plan(x0, []).z).toEqual(unconstrained(x0));
    const box = ROWS.map((r, i) => (r.family === 'input' ? i : -1)).filter((i) => i >= 0);
    const s = solve_plan(x0, box);
    expect(s.z[0]).toBeGreaterThanOrEqual(-1 - 1e-9);
    expect(s.active.every((i) => box.includes(i))).toBe(true);
    // the wall binds once it is included
    expect(ids_of(solve_plan(x0).active)).toContain('p2');
  });
  it('the lesson’s claims about the world', () => {
    // entry state (9, 0.2): no limit active, the best plan is the no-limits plan
    expect(solve_plan([9, 0.2]).active).toEqual([]);
    // at rest 2 m before the flag: clipping brakes in the second second, the best plan keeps pushing
    const s = solve_plan([7, 0]), c = clipped([7, 0]);
    expect(c[1]).toBeLessThan(-0.5);
    expect(s.z[1]).toBeGreaterThan(0.5);
    // the wall acts on predictions: 2.9 m from the wall at 1.9 m/s, the wall row is active
    expect(ids_of(solve_plan([7.1, 1.9]).active)).toContain('p2');
    // right by the wall but slow: no wall row
    expect(ids_of(solve_plan([9.6, 0.2]).active).some((id) => id[0] === 'p')).toBe(false);
    // too fast, too close: no plan
    expect(feasible([9.3, 1.8])).toBe(false);
  });
});
