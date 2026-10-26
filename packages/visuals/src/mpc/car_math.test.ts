// M8's car: the model, the road, the NMPC and the numbers the lesson and its world state.
import { describe, expect, it } from 'vitest';
import {
  CAR, ROAD, bicycle_rhs, car_jacobians, car_rollout, car_step, gn_step, horizon_ref, linear_rollout,
  ms_gaps, nmpc_solve, plan_cost, road_at, shooting_iterates, slip, straight_guess, track_run,
} from './car_math';
import { car_result, CAR_BRIEF } from './car_track';

describe('the kinematic bicycle', () => {
  it('with steering held, the centre of gravity drives a circle of radius l_r / sin β', () => {
    const delta = 0.2, b = slip(delta), R = CAR.lr / Math.sin(b);
    const X = car_rollout([0, 0, 0, 5], Array.from({ length: 60 }, () => [0, delta]));
    // the centre: from the start, a quarter turn left of the velocity direction ψ + β
    const cx = -R * Math.sin(b), cy = R * Math.cos(b);
    for (const x of X) expect(Math.hypot(x[0] - cx, x[1] - cy)).toBeCloseTo(R, 6);
    expect(Math.tan(b)).toBeCloseTo((CAR.lr / (CAR.lf + CAR.lr)) * Math.tan(delta), 12);
  });
  it('one RK4 step of 0.1 s matches a fine integration to 1e-6', () => {
    const x0 = [1, 2, 0.3, 6], u = [1.5, -0.4];
    let x = x0.slice();
    for (let i = 0; i < 1000; i++) {
      const f = bicycle_rhs(x, u);
      x = x.map((v, j) => v + 1e-4 * f[j]);
    }
    const y = car_step(x0, u);
    for (let j = 0; j < 4; j++) expect(Math.abs(y[j] - x[j])).toBeLessThan(2e-3); // Euler reference, 1e-4 s
    let z = x0.slice();
    for (let i = 0; i < 10; i++) z = car_step(z, u, 0.01);
    for (let j = 0; j < 4; j++) expect(Math.abs(y[j] - z[j])).toBeLessThan(1e-6);
  });
  it('the Jacobians predict a small change to first order', () => {
    const x = [3, -1, 0.7, 5.5], u = [0.5, 0.2], dx = [1e-3, -2e-3, 1e-3, 3e-3], du = [-2e-3, 1e-3];
    const { A, B } = car_jacobians(x, u);
    const exact = car_step(x.map((v, i) => v + dx[i]), u.map((v, i) => v + du[i]));
    const base = car_step(x, u);
    for (let i = 0; i < 4; i++) {
      const lin = base[i] + A[i].reduce((s, a, j) => s + a * dx[j], 0) + B[i][0] * du[0] + B[i][1] * du[1];
      expect(Math.abs(lin - exact[i])).toBeLessThan(1e-5);
    }
  });
  it('linearised about driving straight, the model is exact for straight driving and wrong for a turn', () => {
    const x0 = [0, 0, 0, 6];
    const straight = straight_guess(20);
    const a = linear_rollout(x0, straight), b = car_rollout(x0, straight);
    expect(Math.hypot(a[20][0] - b[20][0], a[20][1] - b[20][1])).toBeLessThan(1e-9);
    const turn = Array.from({ length: 20 }, () => [0, 0.4]);
    const c = linear_rollout(x0, turn), d = car_rollout(x0, turn);
    expect(Math.hypot(c[20][0] - d[20][0], c[20][1] - d[20][1])).toBeCloseTo(7.94, 2);
    // the numbers on the lesson's first page: steering 0.2 rad held for 2 s at 6 m/s
    const s2 = Array.from({ length: 20 }, () => [0, 0.2]);
    const e = linear_rollout(x0, s2), f = car_rollout(x0, s2);
    expect(e[20][0]).toBeCloseTo(12, 6); // the linear model never slows its progress along x
    expect(f[20][0]).toBeCloseTo(10.02, 2);
    expect(Math.hypot(e[20][0] - f[20][0], e[20][1] - f[20][1])).toBeCloseTo(2.03, 2);
    expect(CAR.lr / Math.sin(slip(0.2))).toBeCloseTo(13.88, 2);
  });
});

describe('the S road', () => {
  it('straight 12 m, left R 9 m, straight 4 m, right R 9 m, straight 30 m', () => {
    expect(ROAD.length).toBeCloseTo(46 + 9 * Math.PI, 6);
    expect(road_at(ROAD, 12 + 4.5 * Math.PI).x).toBeCloseTo(21, 1); // samples every 5 cm
    expect(road_at(ROAD, 12 + 4.5 * Math.PI).y).toBeCloseTo(9, 1);
    expect(ROAD.x[ROAD.x.length - 1]).toBeCloseTo(60, 6);
    expect(ROAD.y[ROAD.y.length - 1]).toBeCloseTo(22, 6);
  });
  it('at 6 m/s the bends ask for v²/R = 4 m/s², under half of µg for µ = 1 (kinematic model still fair)', () => {
    const ay = CAR.v_ref ** 2 / 9;
    expect(ay).toBeCloseTo(4, 12);
    expect(ay).toBeLessThan(0.5 * 9.81);
  });
});

describe('one Gauss–Newton QP', () => {
  it('lowers the horizon cost from the straight-ahead guess, and its linear prediction matches the truth only near the guess', () => {
    const x0 = [12, 0, 0, 6], ref = horizon_ref(ROAD, 12, 20);
    const U0 = straight_guess(20);
    const st = gn_step(x0, U0, ref, [0, 0]);
    expect(plan_cost(x0, st.U, ref, [0, 0])).toBeLessThan(plan_cost(x0, U0, ref, [0, 0]));
    const truth = car_rollout(x0, st.U);
    const gap = Math.hypot(st.X_lin[20][0] - truth[20][0], st.X_lin[20][1] - truth[20][1]);
    expect(gap).toBeGreaterThan(0.5);
    const conv = nmpc_solve(x0, U0, ref, [0, 0], 'conv');
    expect(conv.step).toBeLessThan(1e-4);
    const t2 = car_rollout(x0, conv.U);
    expect(Math.hypot(conv.X_lin[20][0] - t2[20][0], conv.X_lin[20][1] - t2[20][1])).toBeLessThan(1e-3);
    for (const u of conv.U) {
      expect(u[0]).toBeGreaterThanOrEqual(CAR.a_min - 1e-9);
      expect(u[0]).toBeLessThanOrEqual(CAR.a_max + 1e-9);
      expect(Math.abs(u[1])).toBeLessThanOrEqual(CAR.delta_max + 1e-9);
    }
  });
});

describe('single vs multiple shooting (the shooting picture)', () => {
  const s = shooting_iterates();
  const cost = (U: number[][]) => plan_cost(s.x0, U, s.ref, [0, 0]);
  it('single shooting: cost 113.9 → 8.39 → 1.55 → 1.52; every iterate is a real trajectory', () => {
    const J = s.single.map((it) => cost(it.U));
    expect(J[0]).toBeCloseTo(113.93, 1);
    expect(J[1]).toBeCloseTo(8.39, 1);
    expect(J[2]).toBeCloseTo(1.545, 2);
    expect(J[3]).toBeCloseTo(1.519, 2);
    for (let i = 1; i < J.length; i++) expect(J[i]).toBeLessThanOrEqual(J[i - 1] + 1e-9);
  });
  it('multiple shooting: the gaps go 1.24 m → 2.6 mm → 0.01 mm, and both end at the same plan', () => {
    const g = s.multiple.map((it) => it.gap);
    expect(g[0]).toBeCloseTo(1.24, 2);
    expect(g[1]).toBeCloseTo(2.6e-3, 4);
    expect(g[2]).toBeLessThan(2e-5);
    expect(g[5]).toBeLessThan(1e-9);
    expect(Math.max(...ms_gaps(s.x0, s.multiple[5].S, s.multiple[5].U))).toBeLessThan(1e-9);
    // after one iteration, the node states laid near the road already give the inputs a cost of 1.54 (single shooting: 8.39)
    expect(cost(s.multiple[1].U)).toBeCloseTo(1.536, 2);
    const d = Math.max(...s.single[5].U.flatMap((u, k) => u.map((v, j) => Math.abs(v - s.multiple[5].U[k][j]))));
    expect(d).toBeLessThan(1e-5);
  });
});

describe('the closed loop on the S (the world)', () => {
  it('one QP per sample around the last plan shifted (RTI) stays within 9.2 cm, as good as converging', () => {
    const w1 = track_run('warm', 1), wc = track_run('warm', 'conv');
    expect(w1.max_e).toBeCloseTo(0.0924, 3);
    expect(wc.max_e).toBeCloseTo(0.0922, 3);
    expect(Math.abs(w1.max_e - wc.max_e)).toBeLessThan(0.001);
    expect(wc.mean_qps).toBeCloseTo(2.8, 1);
    expect(w1.mean_qps).toBe(1);
  });
  it('one QP around "straight ahead" cuts both corners by about 31–33 cm and slows to 5.1 m/s', () => {
    const c1 = track_run('cold', 1);
    expect(c1.max_e).toBeCloseTo(0.326, 3);
    expect(Math.max(...c1.e)).toBeCloseTo(0.326, 3); // inside of the left bend
    expect(Math.min(...c1.e)).toBeCloseTo(-0.306, 3); // inside of the right bend
    expect(Math.min(...c1.x.map((x) => x[3]))).toBeCloseTo(5.07, 2);
  });
  it('cold starts need more QPs: 2 → 12.2 cm, 3 → 9.4 cm, converged → 9.2 cm at 4.9 QPs per sample', () => {
    expect(track_run('cold', 2).max_e).toBeCloseTo(0.122, 3);
    expect(track_run('cold', 3).max_e).toBeCloseTo(0.094, 3);
    expect(track_run('cold', 'conv').max_e).toBeCloseTo(0.0922, 3);
    expect(track_run('cold', 'conv').mean_qps).toBeCloseTo(4.9, 1);
  });
  it("the QP's own prediction vs the plan's true motion at 2 s: warm ≈ 2 mm, cold one QP up to 3.2 m", () => {
    const gap = (r: ReturnType<typeof track_run>) => Math.max(...r.plans.map((p) => {
      const a = p.X_lin[p.X_lin.length - 1], b = p.X_true[p.X_true.length - 1];
      return Math.hypot(a[0] - b[0], a[1] - b[1]);
    }));
    expect(gap(track_run('warm', 1))).toBeLessThan(0.005);
    expect(gap(track_run('cold', 1))).toBeCloseTo(3.21, 2);
  });
  it('no setting leaves the ±1.5 m lane; the 15 cm brief separates them', () => {
    for (const g of ['warm', 'cold'] as const) for (const i of [1, 2, 3, 'conv'] as const) expect(track_run(g, i).left_lane_k).toBe(-1);
    expect(CAR_BRIEF).toBe(0.15);
    expect(car_result('cold', 1).in_brief).toBe(false);
    expect(car_result('warm', 1).in_brief).toBe(true);
    expect(car_result('cold', 2).in_brief).toBe(true);
  });
  it('a short horizon hides the cold-start problem (N = 5: 7.6 cm with one cold QP)', () => {
    expect(track_run('cold', 1, 5).max_e).toBeCloseTo(0.0756, 3);
  });
});
