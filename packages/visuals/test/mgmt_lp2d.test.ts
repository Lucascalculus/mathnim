import { describe, expect, it } from 'vitest';
import { PROBLEMS, binds, corners, level_in_feasible, polygon, runs_away, solve, value } from '../src/mgmt/lp2d';

const near = (p: number[] | undefined, q: number[]) => expect(p && [p[0], p[1]].map((v) => +v.toFixed(6))).toEqual(q);

describe('Shader Electronics (the lecturer\'s example)', () => {
  const P = PROBLEMS.shader;
  it('has the four corners and the best is 30 x-pods, 40 BlueBerrys, $410', () => {
    expect(corners(P).map((c) => c.map(Math.round))).toEqual(expect.arrayContaining([[0, 0], [50, 0], [30, 40], [0, 80]]));
    const s = solve(P);
    expect(s.status).toBe('optimal');
    near(s.best, [30, 40]);
    expect(s.z).toBeCloseTo(410, 9);
    expect(s.ties).toHaveLength(1);
  });
  it('both walls bind at the best plan', () => {
    expect(P.limits.map((l) => binds(l, [30, 40]))).toEqual([true, true]);
    expect(P.limits.map((l) => binds(l, [10, 10]))).toEqual([false, false]);
  });
  it('the feasible polygon is the four corners', () => {
    expect(polygon(P)).toHaveLength(4);
  });
  it('the profit line at $410 touches the region in one point; at $300 it crosses it; at $420 it misses', () => {
    const touch = level_in_feasible(P, 410)!;
    near(touch[0], [30, 40]); near(touch[1], [30, 40]);
    const cross = level_in_feasible(P, 300)!;
    expect(cross).not.toBeNull();
    for (const q of cross) expect(value(P, q)).toBeCloseTo(300, 6);
    expect(level_in_feasible(P, 420)).toBeNull();
  });
});

describe('the special cases', () => {
  it('alternative optima: two corners tie on the electronic wall', () => {
    const s = solve(PROBLEMS.alternative);
    expect(s.status).toBe('optimal');
    expect(s.z).toBeCloseTo(240, 9);
    expect(s.ties.map((p) => p.map(Math.round))).toEqual(expect.arrayContaining([[0, 80], [30, 40]]));
  });
  it('infeasible: no plan keeps every limit', () => {
    expect(solve(PROBLEMS.infeasible).status).toBe('infeasible');
    expect(polygon(PROBLEMS.infeasible)).toHaveLength(0);
  });
  it('unbounded: only minimums', () => {
    expect(runs_away(PROBLEMS.unbounded)).toBe(true);
    expect(solve(PROBLEMS.unbounded).status).toBe('unbounded');
  });
  it('redundant: the extra limit changes nothing', () => {
    const s = solve(PROBLEMS.redundant);
    near(s.best, [30, 40]);
    expect(corners(PROBLEMS.redundant)).toHaveLength(corners(PROBLEMS.shader).length);
    expect(PROBLEMS.redundant.limits.map((l) => binds(l, [30, 40]))).toEqual([true, true, false]);
  });
});

describe('Consolidated Electronics (a minimisation)', () => {
  const P = PROBLEMS.consolidated;
  it('the cheapest plan is 8 teaming and 17 problem-solving programs, $216 000', () => {
    const s = solve(P);
    expect(s.status).toBe('optimal');
    near(s.best, [8, 17]);
    expect(s.z).toBeCloseTo(216000, 6);
  });
  it('the region is closed by the consultant\'s days, and the cost line first touches it at the best corner', () => {
    expect(polygon(P)).toHaveLength(4);
    expect(level_in_feasible(P, 216000)).not.toBeNull();
    expect(level_in_feasible(P, 215000)).toBeNull(); // cheaper than the best: no allowed plan
    expect(level_in_feasible(P, 300000)).not.toBeNull();
  });
  it('the limits that hold the best plan are the manager\'s teaming minimum and the senior-level total', () => {
    expect(P.limits.map((l) => binds(l, [8, 17]))).toEqual([false, true, false, true]);
  });
});
