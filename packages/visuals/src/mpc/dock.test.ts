// M1's docking story: the numbers the lesson and its world state.
import { describe, expect, it } from 'vitest';
import { dock_run, pd_run, plan_end, push_runs, shortest_safe_N, shown_instant } from './dock';

describe('docking against the wall (M1)', () => {
  it('with brakes of 1 m/s², look-aheads up to 1.8 s hit the wall and 1.9 s docks', () => {
    expect(dock_run(5).impact).toBeCloseTo(1.55, 2);
    expect(dock_run(10).impact).toBeCloseTo(1.0, 2);
    expect(dock_run(15).impact).toBeCloseTo(0.54, 2);
    expect(dock_run(18).crash_k).toBeGreaterThan(0);
    expect(dock_run(18).impact).toBeCloseTo(0.14, 2);
    for (const N of [19, 20, 30]) {
      const r = dock_run(N);
      expect(r.crash_k).toBe(-1);
      expect(r.docked_k).toBeGreaterThan(0);
      expect(r.docked_k * 0.1).toBeLessThan(7.5);
    }
    expect(shortest_safe_N()).toBe(19);
  });
  it('half the braking needs twice the look-ahead: 40 steps (4 s)', () => {
    const o = { a_max: 0.5, steps: 100 };
    expect(dock_run(39, o).crash_k).toBeGreaterThan(0);
    expect(dock_run(40, o).crash_k).toBe(-1);
    expect(dock_run(40, o).docked_k).toBeGreaterThan(0);
    expect(dock_run(40, o).docked_k).toBeLessThanOrEqual(100);
    expect(shortest_safe_N(o, 50)).toBe(40);
    expect(shortest_safe_N({ a_max: 0.8 }, 40)).toBe(25);
  });
  it('the plan made at the last moment it could stop: short windows end at the wall still moving', () => {
    for (const N of [10, 15, 18]) {
      const r = dock_run(N);
      const s = shown_instant(r);
      expect(s.why).toBe('last-moment');
      expect(r.x[s.k][0]).toBeCloseTo(8, 6); // 2 m from the wall at 2 m/s
      const e = plan_end(r, s.k)!;
      expect(e.can_stop).toBe(false);
      expect(e.v).toBeGreaterThan(0.1);
    }
    // the docking runs show the same instant (t = 5.0 s, 2 m from the wall at 2 m/s)
    for (const N of [19, 20, 25]) expect(shown_instant(dock_run(N)).k).toBe(50);
    // 19 and 20 steps: the window holds (nearly) the whole stop, so the first step is full braking;
    // the plan still ends at the wall slightly moving (0.19 and 0.10 m/s), and the next re-plans finish the stop
    for (const [N, vN] of [[19, 0.191], [20, 0.099]]) {
      const r = dock_run(N), k = shown_instant(r).k;
      expect(r.plans[k]!.U[0][0]).toBeCloseTo(-1, 3);
      expect(plan_end(r, k)!.v).toBeCloseTo(vN, 3);
    }
    // 23 steps and more: the plan ends at rest against the wall
    for (const N of [23, 30]) {
      const r = dock_run(N), e = plan_end(r, shown_instant(r).k)!;
      expect(e.at_rest).toBe(true);
      expect(e.can_stop).toBe(true);
    }
    // 18 steps: brakes 0.95 instead of 1 at the last moment, and hits at 0.14 m/s
    const r18 = dock_run(18);
    expect(r18.plans[shown_instant(r18).k]!.U[0][0]).toBeCloseTo(-0.949, 3);
  });
  it('a reactive PD: aggressive gains hit, cautious ones crawl, tuned ones dock but only for the brakes they were tuned on', () => {
    const steps = 100;
    expect(pd_run(1, 1, { steps }).impact).toBeCloseTo(1.17, 2);
    const cautious = pd_run(0.5, 1.4, { steps });
    expect(cautious.crash_k).toBe(-1);
    expect(cautious.x[90][0]).toBeCloseTo(9.73, 2);
    const tuned = pd_run(2.5, 3.05, { steps });
    expect(tuned.crash_k).toBe(-1);
    const within = (r: { x: number[][] }) => r.x.findIndex((x, i) => r.x.slice(i).every((y) => Math.abs(y[0] - 10) < 0.02 && Math.abs(y[1]) < 0.05));
    expect(within(tuned)).toBe(76);
    expect(within(dock_run(20, { steps }))).toBe(70);
    const weak = pd_run(2.5, 3.05, { a_max: 0.5, steps });
    expect(weak.impact).toBeCloseTo(1.33, 2);
  });
  it('an unexpected push: the plan executed blindly hits the wall, the re-planned one docks', () => {
    const r = push_runs();
    expect(r.plan0[r.plan0.length - 1][0]).toBeCloseTo(10, 2); // the t = 0 plan itself docks
    expect(r.blind.crash_k).toBeGreaterThan(0);
    expect(r.blind.impact).toBeCloseTo(1.92, 2);
    expect(r.replan.crash_k).toBe(-1);
    expect(r.replan.docked_k).toBeGreaterThan(0);
    expect(r.replan.x[10][1]).toBeCloseTo(1.3, 9); // the push is measured at t = 1 s
  });
});
