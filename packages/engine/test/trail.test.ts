// Time as matter (trail.ts): the path walked solid, ghosts at equal times that stay where they fell (spacing is speed),
// the path ahead dashed, moments ticked; a pure function of the time, from a position function or a simulation.
import { beforeAll, describe, expect, it } from 'vitest';
import { createCanvas } from '@napi-rs/canvas';
import { Figure, Trail, column, load_tex, run, type TrailOptions, type XY } from '../src/index';
import { use_node_canvas } from '../node';

beforeAll(async () => {
  use_node_canvas();
  await load_tex();
});

const W = 600, H = 300;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function figure(pos: (t: number, f: Figure) => XY | null, at: number, o: Partial<TrailOptions> = {}, x: [number, number] = [-0.2, 2.2]) {
  const fig = new Figure();
  const t = fig.param('t', at, { range: [0, 10] }), v = fig.param('v', 1, { range: [0, 5] });
  const P = fig.plot({ id: 'p', x, y: [-1, 1], axes: 'none', grid: false });
  P.add(new Trail((s) => pos(s, fig), { id: 'trail', role: 'noun:cost', at: t, ...o }));
  fig.layout(column([P]));
  fig.build();
  fig.layout_for(W, H);
  const c = createCanvas(W, H), g = c.getContext('2d') as unknown as CanvasRenderingContext2D;
  const draw = (force = true) => { fig.draw(g, 1, { force }); return c.getContext('2d').getImageData(0, 0, W, H).data.slice(); };
  const ink = (d: Uint8ClampedArray, px: number, py: number) => { const i = (Math.round(py) * W + Math.round(px)) * 4; return 255 - (d[i] + d[i + 1] + d[i + 2]) / 3; };
  return { fig, P, t, v, draw, ink };
}
const same = (a: Uint8ClampedArray, b: Uint8ClampedArray) => { let worst = 0; for (let i = 0; i < a.length; i++) worst = Math.max(worst, Math.abs(a[i] - b[i])); return worst; };
const along = (t: number): XY => [t, 0];

describe('time as matter', () => {
  it('ghosts at equal times on the path walked: ink 3 px off the path at each ghost, none between', () => {
    const { P, draw, ink } = figure(along, 1);
    const d = draw();
    for (const tt of [0.2, 0.5, 0.8]) {
      const [x, y] = P.P([tt, 0]);
      expect(ink(d, x, y - 3)).toBeGreaterThan(15);
      const [xm] = P.P([tt + 0.05, 0]);
      expect(ink(d, xm, y - 3)).toBeLessThan(ink(d, P.P([2.15, 0])[0], y - 3) + 3); // (against the bare paper on the same row)
      expect(ink(d, xm, y)).toBeGreaterThan(40); // the path itself
    }
    // the future is not drawn unless asked for
    const [xa, ya] = P.P([1.5, 0]);
    expect(ink(d, xa, ya)).toBeLessThan(ink(d, P.P([2.15, 0])[0], ya) + 3);
  });
  it('the ghosts stay where they fell as time goes on (they do not slide)', () => {
    const a = figure(along, 1), b = figure(along, 1.04);
    const da = a.draw(), db = b.draw();
    const [x, y] = a.P.P([0.5, 0]);
    expect(a.ink(da, x, y - 3)).toBeGreaterThan(10);
    expect(b.ink(db, x, y - 3)).toBeGreaterThan(10);
  });
  it('spacing is speed: a point that speeds up leaves its ghosts further and further apart', () => {
    const { P, draw, ink } = figure((t) => [0.5 * t * t, 0], 2);
    const d = draw();
    // count ghosts along the row 3 px above the path, in the slow first half and the fast second half
    const [x0, y] = P.P([0, 0]), [x1] = P.P([0.5, 0]), [x2] = P.P([2, 0]);
    const blobs = (a: number, b: number) => { let n = 0, on = false; for (let x = Math.round(a); x < b; x++) { const v = ink(d, x, y - 3) > 8; if (v && !on) n++; on = v; } return n; };
    const slow = blobs(x0 + 1, x1), fast = blobs(x1, x2);
    expect(slow).toBeGreaterThanOrEqual(1);
    // (half the time in each: 0..1 s covers 0..0.5, 1..2 s covers 0.5..2; ghosts overlap in the slow part, so fewer blobs per unit length but at least as many in time)
    expect((x1 - x0) / Math.max(1, slow)).toBeLessThan((x2 - x1) / fast);
  });
  it('the path ahead is dashed: gaps ahead of the point, none behind it', () => {
    const { P, draw, ink } = figure(along, 1, { ahead: 0.8, every: 0 });
    const d = draw();
    const gaps = (a: number, b: number) => { const [xa, y] = P.P([a, 0]), [xb] = P.P([b, 0]); let n = 0; for (let x = Math.round(xa); x < xb; x++) if (ink(d, x, y) < 15) n++; return n; };
    expect(gaps(0.1, 0.9)).toBe(0);
    expect(gaps(1.1, 1.7)).toBeGreaterThan(10);
  });
  it('the future stops where the motion ends', () => {
    const { P, draw, ink } = figure(along, 1, { ahead: 0.8, every: 0, until: 1.3 });
    const d = draw();
    const [x, y] = P.P([1.6, 0]), [xe] = P.P([1.2, 0]);
    let near = 0;
    for (let k = -6; k <= 6; k++) near = Math.max(near, ink(d, xe + k, y));
    expect(near).toBeGreaterThan(40);
    expect(ink(d, x, y)).toBeLessThan(ink(d, P.P([2.15, 0])[0], y) + 3);
  });
  it('only as much past as asked for', () => {
    const { P, draw, ink } = figure(along, 1, { past: 0.3 });
    const d = draw();
    const [x, y] = P.P([0.3, 0]), [x2] = P.P([0.85, 0]);
    expect(ink(d, x, y)).toBeLessThan(ink(d, P.P([2.15, 0])[0], y) + 3);
    expect(ink(d, x2, y)).toBeGreaterThan(40);
  });
  it('a moment is ticked across the path, faint while it is still ahead', () => {
    const solid = figure(along, 1, { ticks: [0.55], every: 0 }), ahead = figure(along, 1, { ticks: [1.3], every: 0, ahead: 0.5 });
    const ds = solid.draw(), da = ahead.draw();
    const [x, y] = solid.P.P([0.55, 0]), [xa] = ahead.P.P([1.3, 0]);
    const s = solid.ink(ds, x, y - 6), a = ahead.ink(da, xa, y - 6);
    expect(s).toBeGreaterThan(60);
    expect(a).toBeGreaterThan(10);
    expect(a).toBeLessThan(s);
  });
  it('seeking is exact: back from later, it is the picture drawn straight (the kept past is cut, not resampled wrong)', () => {
    const a = figure(along, 1.8, { ahead: 0.3 });
    a.draw();
    a.t.set(0.7, true);
    expect(same(a.draw(), figure(along, 0.7, { ahead: 0.3 }).draw())).toBe(0);
    a.t.set(1.9, true);
    expect(same(a.draw(), figure(along, 1.9, { ahead: 0.3 }).draw())).toBe(0);
  });
  it('when what the positions read changes, the past is sampled anew', () => {
    const pos = (t: number, f: Figure): XY => [t, 0.4 * Math.sin(3 * f.params.get('v')!.value as number * t)];
    const a = figure(pos, 1.5);
    a.draw();
    a.v.set(2, true);
    const moved = a.draw();
    const b = figure(pos, 1.5);
    b.v.set(2, true);
    expect(same(moved, b.draw())).toBe(0);
  });
  it('frame by frame in the renderer: the same pixels as a full redraw', () => {
    const a = figure(along, 0), b = figure(along, 0);
    let worst = 0;
    for (let i = 0; i <= 60; i++) {
      a.t.set(i / 30); b.t.set(i / 30);
      worst = Math.max(worst, same(a.draw(false), b.draw(true)));
    }
    expect(worst).toBeLessThanOrEqual(2);
  });
});

describe('time as matter: from a simulation', () => {
  /** A ball thrown up and to the right (a sim), its trail on the sim's clock. */
  function thrown() {
    const fig = new Figure();
    const vy = fig.param('vy', 4, { range: [0, 8] });
    const sim = fig.sim({ inputs: () => ({ vy: vy.value }), start: (i) => [0, 0, 1, i.vy], dt: 1 / 240, accel: (_q, _v, _t, _i, a) => { a[0] = 0; a[1] = -9.81; } });
    const P = fig.plot({ id: 'p', x: [-0.2, 2], y: [-0.4, 1.4], axes: 'none', grid: false });
    const tr = P.add(new Trail({ sim, xy: (y) => [y[0], y[1]] }, { id: 'trail', role: 'noun:cost', ahead: 0.3 }));
    fig.layout(column([P]));
    fig.script(run(sim, 1));
    fig.build();
    fig.layout_for(W, H);
    const c = createCanvas(W, H), g = c.getContext('2d') as unknown as CanvasRenderingContext2D;
    const at = (t: number) => { fig.at(t); fig.draw(g, 1); return c.getContext('2d').getImageData(0, 0, W, H).data.slice(); };
    return { fig, sim, P, tr, vy, at };
  }
  it('the ghosts lie on the parabola the sim integrates', () => {
    const { P, tr, at } = thrown();
    const d = at(0.8);
    const ink = (x: number, y: number) => { const i = (Math.round(y) * W + Math.round(x)) * 4; return 255 - (d[i] + d[i + 1] + d[i + 2]) / 3; };
    for (const t of [0.2, 0.4, 0.6]) {
      const [x, y] = P.P([t, 4 * t - 4.905 * t * t]);
      expect(ink(x, y)).toBeGreaterThan(30);
    }
    expect(tr.fine).toBeCloseTo(1 / 60, 9);
  });
  it('seeking on the timeline is exact, back and forth', () => {
    const { at } = thrown();
    const mid = at(0.5), end = at(1);
    expect(same(at(0.5), mid)).toBe(0);
    expect(same(at(1), end)).toBe(0);
    expect(same(mid, end)).toBeGreaterThan(0);
    const fresh = thrown().at(0.5);
    expect(same(mid, fresh)).toBe(0);
  });
  it("a change to the sim's inputs is a new run, and its trail is sampled anew", () => {
    const a = thrown();
    a.at(0.6);
    a.vy.set(6);
    const b = thrown();
    b.vy.set(6);
    // (the new run starts at 0: both clocks are back at the start; play both to the same time)
    expect(same(a.at(0.6), b.at(0.6))).toBe(0);
  });
});
