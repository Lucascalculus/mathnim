// The three solver families on M4's two-move cart QP (solvers2d.ts) reach the
// exact optimum of the kit's solver, and the numbers the M5 lesson quotes hold.
import { describe, expect, it } from 'vitest';
import { ROW_INDEX, ids_of, kkt_ok, slack_of, ROWS } from './qp2d';
import { active_set_path, admm_path, changes_of, exact, interior_start, ip_path, loop_states, most_violated } from './solvers2d';

const near = (a: number[], b: number[]) => Math.hypot(a[0] - b[0], a[1] - b[1]);
const STATES: [number, number][] = [[6.39, 1.75], [7.1, 1.9], [9, 0.2], [8, 0], [6, 1.5], [4, 0], [6.75, 1.79], [5.5589, 1.5695]];

describe('active set', () => {
  it('ends at the exact optimum with an optimal working set, from scratch', () => {
    for (const x0 of STATES) {
      const p = active_set_path(x0);
      const last = p[p.length - 1];
      expect(last.action).toBe('done');
      expect(near(last.z, exact(x0))).toBeLessThan(1e-9);
      expect(kkt_ok(x0, last.W)).toBe(true);
    }
  });
  it('the scene state (6.39, 1.75): add v1+, then add p2 (two changes)', () => {
    const p = active_set_path([6.39, 1.75]);
    expect(p.map((s) => s.action)).toEqual(['start', 'add', 'add', 'done']);
    expect(ids_of(p[p.length - 1].W).sort()).toEqual(['p2', 'v1+']);
    expect(changes_of(p)).toBe(2);
  });
  it('starting from the right working set takes no change at all', () => {
    const x0: [number, number] = [6.39, 1.75];
    const W = active_set_path(x0).at(-1)!.W;
    expect(changes_of(active_set_path(x0, W))).toBe(0);
  });
  it('most_violated finds the most broken row', () => {
    const x0 = [6.39, 1.75], z = [1.2, 0.5];
    const i = most_violated(x0, z);
    for (let j = 0; j < ROWS.length; j++) expect(slack_of(j, z, x0)).toBeLessThanOrEqual(slack_of(i, z, x0) + 1e-12);
  });
});

describe('interior point', () => {
  it('starts strictly inside and converges to the optimum in about ten steps', () => {
    for (const x0 of STATES) {
      const z0 = interior_start(x0)!;
      for (let i = 0; i < ROWS.length; i++) expect(slack_of(i, z0, x0)).toBeLessThan(0);
      const p = ip_path(x0);
      expect(near(p[p.length - 1].z, exact(x0))).toBeLessThan(1e-5);
      expect(p.length - 1).toBeLessThan(20);
      // every iterate stays strictly inside the polygon
      for (const s of p) for (let i = 0; i < ROWS.length; i++) expect(slack_of(i, s.z, x0)).toBeLessThan(1e-9);
    }
  });
});

describe('ADMM (OSQP iteration)', () => {
  it('reaches OSQP-accuracy (1e-3) with rho = 3 in tens of steps', () => {
    for (const x0 of STATES) {
      const p = admm_path(x0, { rho: 3 });
      const last = p[p.length - 1];
      expect(last.converged).toBe(true);
      expect(near(last.z, exact(x0))).toBeLessThan(3e-2); // modest accuracy: the stopping test is on residuals, not on z
      expect(p.length - 1).toBeLessThan(60);
    }
  });
  it('rho = 0.1 without scaling needs many more steps', () => {
    expect(admm_path([6.39, 1.75], { rho: 0.1 }).length).toBeGreaterThan(3 * admm_path([6.39, 1.75], { rho: 3 }).length);
  });
});

describe('the closed loop the world steps through', () => {
  it('samples 18-23: the optimal working sets the lesson describes', () => {
    const xs = loop_states(24);
    const opt = (k: number) => ids_of(active_set_path(xs[k]).at(-1)!.W).sort().join(',');
    expect(opt(18)).toBe('v1+,v2+');
    for (const k of [19, 20, 21]) expect(opt(k)).toBe('v1+,v2+');
    expect(opt(22)).toBe('v1+');
    expect(opt(23)).toBe('p2,v1+');
    // at 22 the kept set has a negative multiplier on v2+
    const W = [ROW_INDEX['v1+'], ROW_INDEX['v2+']];
    expect(kkt_ok(xs[22], W)).toBe(false);
    expect(kkt_ok(xs[21], W)).toBe(true);
  });
});
