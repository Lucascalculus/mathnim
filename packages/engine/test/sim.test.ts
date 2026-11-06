// Simulated time (sim.ts), vector fields and streamlines (vectors.ts), a handle held to a curve, and the 3D view's
// solids, labels and screen-plane drags (view3d.ts): what the physics stress test (docs/design/PHYSICS-STRESS.md) added.
import { beforeAll, describe, expect, it } from 'vitest';
import {
  Figure, Handle3D, Path, Sim, VectorField, View3D, beat, column, handle3d, make_stepper, param, reveal, run, set, stage, streamline, wait,
  type P3, type XY,
} from '../src/index';
import { lint_figure, render_figure, use_node_canvas } from '../node';

beforeAll(() => use_node_canvas());

// a harmonic oscillator q'' = -w² q, energy ½v² + ½w²q²
const W = 2 * Math.PI;
const osc = (method: 'verlet' | 'euler' | 'rk4', dt = 1 / 240) => {
  const amp = param(1, { name: 'amp' });
  const sim = new Sim({ inputs: () => ({ a: amp.value }), start: (i) => [i.a, 0], accel: (q, _v, _t, _i, a) => { a[0] = -W * W * q[0]; }, method, dt });
  return { sim, amp };
};
const energy = (y: Float64Array) => 0.5 * y[1] * y[1] + 0.5 * W * W * y[0] * y[0];

describe('a simulation on the timeline', () => {
  it('velocity Verlet keeps the energy of an oscillator within its bound over a minute (no drift)', () => {
    const { sim } = osc('verlet');
    const E0 = energy(sim.at(0));
    let worst = 0;
    for (const s of sim.series(0, 60, 1 / 60)) worst = Math.max(worst, Math.abs(energy(s.y) - E0) / E0);
    // (the bound is (w dt)² / 8 ≈ 9e-5 for w = 2π, dt = 1/240)
    expect(worst).toBeLessThan(2e-4);
    // and the end of the minute is no worse than the first period: bounded, not growing
    let first = 0;
    for (const s of sim.series(0, 1, 1 / 240)) first = Math.max(first, Math.abs(energy(s.y) - E0) / E0);
    expect(worst).toBeLessThan(first * 1.05 + 1e-12);
  });
  it('semi-implicit Euler stays bounded too; RK4 follows the exact solution closely', () => {
    const e = osc('euler'), r = osc('rk4');
    const E0 = energy(e.sim.at(0));
    expect(Math.abs(energy(e.sim.at(60)) - E0) / E0).toBeLessThan(0.05);
    expect(Math.abs(r.sim.at(10)[0] - Math.cos(W * 10))).toBeLessThan(1e-6);
  });
  it('integrates a first-order system with RK4 (exponential decay)', () => {
    const k = param(0.5);
    const sim = new Sim({ inputs: () => k.value, start: () => [1], deriv: (y, _t, kk, out) => { out[0] = -kk * y[0]; }, dt: 1 / 120 });
    expect(sim.at(4)[0]).toBeCloseTo(Math.exp(-2), 9);
    expect(() => new Sim({ inputs: () => 0, start: () => [1], deriv: (y, _t, _i, o) => { o[0] = y[0]; }, method: 'verlet', dt: 0.1 })).toThrow();
  });
  it('is deterministic: a seek lands on exactly the state playing reaches, from any direction, and a replay is bit for bit', () => {
    const { sim } = osc('verlet');
    // play forward a frame at a time
    for (let f = 0; f <= 60 * 37; f++) sim.clock.set(f / 60, true);
    const played = sim.state.peek();
    // seek back and forth, then to the same moment
    sim.clock.set(3.5, true);
    sim.state.peek();
    sim.clock.set(59, true);
    sim.state.peek();
    sim.clock.set(37, true);
    expect([...sim.state.peek()]).toEqual([...played]);
    // a fresh sim with the same inputs, straight to the moment
    expect([...osc('verlet').sim.at(37)]).toEqual([...played]);
    // the series agrees with seeks
    const s = sim.series(36, 37, 0.5);
    expect([...s[s.length - 1].y]).toEqual([...played]);
    // a seek costs at most one checkpoint interval
    const before = sim.steps_taken;
    sim.at(12.34);
    expect(sim.steps_taken - before).toBeLessThanOrEqual(60);
  });
  it('starts a new run when an input changes (the clock goes back to 0), and a held handle waits then releases', () => {
    const { sim, amp } = osc('verlet');
    sim.clock.set(2, true);
    amp.set(0.5);
    expect(sim.clock.peek()).toBe(0);
    expect(sim.state.peek()[0]).toBe(0.5);
    // the player's live clock: whole steps, the remainder kept
    sim.play();
    sim.advance(1 / 60 + 1 / 1000);
    expect(sim.clock.peek()).toBeCloseTo(4 / 240, 12);
    sim.advance(0.0035);
    expect(sim.clock.peek()).toBeCloseTo(5 / 240, 12);
    // a handle holds it: held → paused at its start; let go → runs from there
    const f = new Figure(), P = f.plot({ id: 'p', x: [-1, 1], y: [-1, 1] });
    const h = f.handle(P, amp, null, { id: 'h' });
    sim.hold_with(h);
    h.state.set(2);
    expect([sim.running.peek(), sim.clock.peek()]).toEqual([0, 0]);
    amp.set(0.8);
    h.state.set(1);
    expect([sim.running.peek(), sim.clock.peek(), sim.state.peek()[0]]).toEqual([1, 0, 0.8]);
    // the clock stops at the longest run
    const short = new Sim({ inputs: () => 0, start: () => [1, 0], accel: (q, _v, _t, _i, a) => { a[0] = -q[0]; }, dt: 0.01, max_t: 0.05 });
    short.play();
    short.advance(1);
    expect([short.clock.peek(), short.running.peek()]).toEqual([0.05, 0]);
  });
  it('runs in a script: seeking the timeline gives the same state as the sim at that time; the release travels first', () => {
    const f = new Figure();
    const th0 = f.param('th0', 0.2, { range: [-3, 3] });
    const sim = f.sim({ inputs: () => ({ th0: th0.value }), start: (i) => [i.th0, 0], accel: (q, _v, _t, _i, a) => { a[0] = -9.81 * Math.sin(q[0]); }, dt: 1 / 240 });
    const P = f.plot({ id: 'p', x: [-1.2, 1.2], y: [-1.2, 1.2], aspect: 'equal', axes: 'none', grid: false });
    const rod = P.add(new Path(() => [[0, 0], [Math.sin(sim.state.value[0]), -Math.cos(sim.state.value[0])]], { id: 'rod', role: 'noun:bob' }));
    f.layout(column([P]));
    f.script(reveal(rod), set(th0, 1.2, 'travel'), beat(), run(sim, 6), wait(0.5));
    f.build();
    expect(f.duration).toBeGreaterThan(6);
    const t_run = f.section_starts()[0];
    f.at(t_run + 2.5);
    const via_timeline = sim.state.peek()[0];
    expect(sim.clock.peek()).toBeCloseTo(2.5, 9);
    // the same moment of the same release, straight from a fresh sim
    const probe = new Sim({ inputs: () => ({ th0: 1.2 }), start: (i) => [i.th0, 0], accel: (q, _v, _t, _i, a) => { a[0] = -9.81 * Math.sin(q[0]); }, dt: 1 / 240 });
    expect(via_timeline).toBe(probe.at(2.5)[0]);
    // back before the release: the clock and the angle are back too
    f.at(0.1);
    expect(sim.clock.peek()).toBe(0);
    expect(th0.peek()).toBeLessThan(1.2);
    f.at(t_run + 2.5);
    expect(sim.state.peek()[0]).toBe(via_timeline);
    // the script's log says the run
    expect(f.timeline!.log.some((l) => l.what.includes('simulate') && l.what.includes('+6'))).toBe(true);
    expect(lint_figure(f).filter((i) => i.severity === 'error')).toEqual([]);
  });
});

describe('steppers', () => {
  it('take the documented steps', () => {
    // one Verlet step of q'' = -q from (1, 0) with dt = 0.1: q = 1 - 0.005, v = -0.5 (a0 + a1) dt
    const st = make_stepper({ inputs: () => 0, start: () => [1, 0], accel: (q, _v, _t, _i, a) => { a[0] = -q[0]; }, dt: 0.1 }, 2, () => 0);
    const y = Float64Array.from([1, 0]);
    st(y, 0);
    expect(y[0]).toBeCloseTo(0.995, 12);
    expect(y[1]).toBeCloseTo(-0.5 * (1 + 0.995) * 0.1, 12);
  });
});

describe('vector fields and streamlines', () => {
  const swirl = (x: number, y: number): XY => [-y, x];
  const out = (x: number, y: number): XY => [x / (x * x + y * y) ** 1.5, y / (x * x + y * y) ** 1.5];
  it('a streamline of a rotation closes on itself; one of a source leaves exactly at the edge', () => {
    const a = streamline(swirl, [1, 0], { h: 0.01, bounds: { x: [-2, 2], y: [-2, 2] } });
    expect(a.end).toBe('loop');
    expect(a.length).toBeCloseTo(2 * Math.PI, 1);
    for (const p of a.pts) expect(Math.hypot(p[0], p[1])).toBeCloseTo(1, 5);
    const b = streamline(out, [0.1, 0.05], { h: 0.02, bounds: { x: [-2, 2], y: [-1, 1] } });
    expect(b.end).toBe('edge');
    const last = b.pts[b.pts.length - 1];
    expect(Math.max(Math.abs(last[0]) - 2, Math.abs(last[1]) - 1)).toBeCloseTo(0, 9);
    // radial: the direction never changes
    const ang = Math.atan2(0.05, 0.1);
    for (const p of b.pts) expect(Math.atan2(p[1], p[0])).toBeCloseTo(ang, 6);
    // against the field it runs back into the source and stops there
    const c = streamline(out, [1, 0.5], { h: 0.02, dir: -1, stop: (p) => Math.hypot(p[0], p[1]) < 0.05 });
    expect(c.end).toBe('stop');
    // a field with no direction: a stall
    expect(streamline(() => [0, 0], [0, 0]).end).toBe('stall');
  });
  it('draws a grid of arrows that follows the screen, and arrowheads along a path', () => {
    const f = new Figure();
    const P = f.plot({ id: 'p', x: [-2, 2], y: [-1, 1], aspect: 'equal', axes: 'none', grid: false });
    const vf = P.add(new VectorField(out, { id: 'vf', role: 'noun:field' }));
    P.add(new Path(() => [[-1.5, -0.5], [1.5, 0.5]], { id: 'line', role: 'noun:field', heads: [0.5] }));
    f.layout(column([P]));
    render_figure(f, 960, 540);
    const wide = vf.count;
    render_figure(f, 360);
    expect(wide).toBeGreaterThan(150);
    expect(vf.count).toBeLessThan(wide / 3);
    expect(lint_figure(f).filter((i) => i.severity === 'error')).toEqual([]);
  });
});

describe('a handle held to a curve', () => {
  it('maps the pointer to its params with `to` (an angle on a circle)', () => {
    const f = new Figure();
    const th = f.param('th', 0, { range: [-3, 3] });
    const P = f.plot({ id: 'p', x: [-1.2, 1.2], y: [-1.2, 1.2], aspect: 'equal', axes: 'none' });
    const h = f.handle(P, th, null, { id: 'bob', to: (d) => [Math.atan2(d[0], -d[1])], at: () => P.P([Math.sin(th.value), -Math.cos(th.value)]) });
    f.layout(column([P]));
    f.layout_for(600, 600);
    h.move_to(P.P([1, 0]));
    expect(th.peek()).toBeCloseTo(Math.PI / 2, 9);
    h.move_to(P.P([-0.3, -0.3]));
    expect(th.peek()).toBeCloseTo(-Math.PI / 4, 9);
    const c = h.center(), want = P.P([Math.sin(-Math.PI / 4), -Math.cos(-Math.PI / 4)]);
    expect(Math.hypot(c[0] - want[0], c[1] - want[1])).toBeLessThan(1e-9);
  });
});

describe('the 3D view: solids, labels on 3D points, drags in the screen plane', () => {
  const scene = () => {
    const f = new Figure();
    const phi = f.param('phi', 1.1, { range: [0, Math.PI] }), theta = f.param('theta', -1, { range: [-Math.PI, Math.PI] });
    const st = stage({ id: 'st' });
    const v = st.add(new View3D({ phi, theta }, { id: 'v', size: 2.5, radius: 3.6, obstacles: true }));
    f.layout(column([st]), { pad: 0 });
    return { f, st, v, phi, theta };
  };
  it('the screen axes are the camera’s: right × up = out, and px() lands where project() says', () => {
    const { f, v } = scene();
    f.layout_for(960, 540);
    const { right, up, out } = v.screen_axes();
    const c = [right[1] * up[2] - right[2] * up[1], right[2] * up[0] - right[0] * up[2], right[0] * up[1] - right[1] * up[0]];
    c.forEach((x, i) => expect(x).toBeCloseTo(out[i], 12));
    // a point moved along `right` moves right on the screen, along `up` moves up, along `out` not at all
    const p: P3 = [0.3, -0.2, 0.5], a = v.px(p);
    const r = v.px([p[0] + right[0], p[1] + right[1], p[2] + right[2]]), u = v.px([p[0] + up[0], p[1] + up[1], p[2] + up[2]]), o = v.px([p[0] + out[0], p[1] + out[1], p[2] + out[2]]);
    expect(r[0] - a[0]).toBeCloseTo(v.px_per_unit(), 9);
    expect(r[1] - a[1]).toBeCloseTo(0, 9);
    expect(a[1] - u[1]).toBeCloseTo(v.px_per_unit(), 9);
    expect(Math.hypot(o[0] - a[0], o[1] - a[1])).toBeLessThan(1e-9);
  });
  it('a bar shows only its faces turned to the viewer, and pieces put a line through it in the right order', () => {
    const { f, v, phi, theta } = scene();
    v.bar([0, 0, 0], [2, 0, 0], { half: [0.1, 0.1], segments: 4, role: 'region:lever' });
    v.line([1, 0, -1.5], [1, 0, 1.5], { role: 'scaffold', pieces: 12 });
    f.build();
    phi.set(Math.PI / 2, true); // looking along +y (theta -π/2 puts +x right): the -y face is the one we see
    theta.set(-Math.PI / 2, true);
    render_figure(f, 960, 540);
    const drawn = (v as unknown as { prims: unknown[] }).prims.length;
    // 4 segments × 4 long faces + 2 caps = 18 faces; facing us: 1 long face per segment (4); the caps and the rest are
    // edge-on or away. And 12 pieces of the line.
    expect(drawn).toBe(4 + 12);
    expect(lint_figure(f).filter((i) => i.severity === 'error')).toEqual([]);
  });
  it('a 3D handle drags its point in the plane of the screen, through whatever the figure holds it to', () => {
    const { f, st, v } = scene();
    const fx = f.param('fx', 1, { range: [-2, 2] }), fy = f.param('fy', 0, { range: [-2, 2] }), fz = f.param('fz', 0, { range: [-2, 2] });
    const get = (): P3 => [fx.value, fy.value, fz.value];
    const h = handle3d(f, st, v, { id: 'tip', get, put: (p) => { fx.set(p[0]); fy.set(p[1]); fz.set(p[2]); }, params: [fx, fy] });
    expect(h).toBeInstanceOf(Handle3D);
    v.arrow([0, 0, 0], get, { role: 'noun:force' });
    f.layout_for(960, 540);
    const a = v.px(get()), k = v.px_per_unit(), before = get();
    h.drag_by(30, -20);
    const b = v.px(get());
    expect(b[0] - a[0]).toBeCloseTo(30, 6);
    expect(b[1] - a[1]).toBeCloseTo(-20, 6);
    // the depth (along `out`) did not change
    const { out } = v.screen_axes(), d = (p: P3) => p[0] * out[0] + p[1] * out[1] + p[2] * out[2];
    expect(d(get())).toBeCloseTo(d(before), 9);
    expect(k).toBeGreaterThan(10);
  });
});
