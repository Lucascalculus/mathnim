// Development (cases.ts): a family of cases in transparent ink, deepest where they agree. Held to what it must show (the
// secants' agreement is the tangent), to its film (growing, going back, a change to what the cases read, a fraction),
// and to seeking.
import { beforeAll, describe, expect, it } from 'vitest';
import { createCanvas } from '@napi-rs/canvas';
import { Cases, Figure, column, load_tex, set, type XY } from '../src/index';
import { use_node_canvas } from '../node';

beforeAll(async () => {
  use_node_canvas();
  await load_tex();
});

const f = (x: number) => 0.15 * x ** 3 - 0.9 * x + 0.6, fp = (x: number) => 0.45 * x * x - 0.9;
const COUNT = 48, H0 = 2, level = (j: number) => H0 * 2 ** (-j / 4);
/** The secant through (x0, f(x0)) and (x0 + h_j, …), across the plot. */
const secant = (x0: number) => (j: number): XY[] => { const h = level(j), m = (f(x0 + h) - f(x0)) / h; return [[-3.3, f(x0) + m * (-3.3 - x0)], [3.3, f(x0) + m * (3.3 - x0)]]; };

function figure(n: number, x0 = -2, W = 640, H = 400, dpr = 1) {
  const fig = new Figure();
  const upto = fig.param('upto', n, { range: [0, COUNT] }), xp = fig.param('x0', x0, { range: [-3, 3] });
  const P = fig.plot({ id: 'p', x: [-3.3, 3.3], y: [-1.6, 2.8], axes: 'none', grid: false });
  const cases = P.add(new Cases((j) => secant(xp.value)(j), { id: 'secants', role: 'noun:cost', count: COUNT, upto }));
  fig.layout(column([P]));
  fig.build();
  fig.layout_for(W, H);
  const c = createCanvas(W * dpr, H * dpr), g = c.getContext('2d') as unknown as CanvasRenderingContext2D;
  const draw = () => { fig.draw(g, dpr, { force: true }); return c.getContext('2d').getImageData(0, 0, W * dpr, H * dpr).data; };
  return { fig, P, cases, upto, xp, draw, W, H };
}
const same = (a: Uint8ClampedArray, b: Uint8ClampedArray) => { let worst = 0; for (let i = 0; i < a.length; i++) worst = Math.max(worst, Math.abs(a[i] - b[i])); return worst; };

describe('development: cases in transparent ink', () => {
  it('where the secants agree is the tangent: the deepest ink in each column lies on it', () => {
    const { P, draw, W } = figure(COUNT);
    const d = draw();
    const ink = (x: number, y: number) => 255 - d[(y * W + x) * 4];
    let worst = 0, n = 0;
    const x0 = -2, px0 = P.P([x0, f(x0)])[0];
    for (const dd of [40, 60, 100, 140, -60, -100]) {
      const px = Math.round(px0 + dd);
      const unit = P.P([1, 0])[0] - P.P([0, 0])[0], xc = x0 + (px + 0.5 - px0) / unit, tangent_y = P.P([xc, f(x0) + fp(x0) * (xc - x0)])[1];
      // (only where the tangent is inside the plot: beyond its edge the deepest ink belongs to other secants)
      if (tangent_y < P.data.y + 4 || tangent_y > P.data.y + P.data.h - 4) continue;
      let best = 0, at = 0;
      for (let y = 0; y < 400; y++) { const v = ink(px, y); if (v > best) { best = v; at = y; } }
      worst = Math.max(worst, Math.abs(at + 0.5 - tangent_y));
      n++;
    }
    expect(n).toBeGreaterThanOrEqual(4);
    expect(worst).toBeLessThan(2);
  });
  it('the film grows with upto, and going back draws it anew: the same picture as drawn straight', () => {
    const a = figure(10);
    a.draw();
    a.upto.set(30, true); a.draw();
    a.upto.set(15, true);
    const back = a.draw();
    const fresh = figure(15).draw();
    expect(same(back, fresh)).toBe(0);
  });
  it('when what the cases read changes, the film is drawn anew', () => {
    const a = figure(COUNT, -2);
    a.draw();
    a.xp.set(1, true);
    const moved = a.draw();
    expect(same(moved, figure(COUNT, 1).draw())).toBe(0);
  });
  it('a fraction fades the last case in', () => {
    const solo = (n: number) => figure(n);
    // (one case alone: compare its strength at 0.5 and 1 on a pixel of its own)
    const one = solo(1).draw(), half = solo(0.5).draw(), none = solo(0).draw();
    let i_best = 0, v_best = 0;
    for (let i = 0; i < one.length; i += 4) { const v = 255 - one[i]; if (v > v_best) { v_best = v; i_best = i; } }
    // (against the paper under it: ink is how much darker than the bare figure a pixel is)
    const bare = 255 - none[i_best], full = v_best - bare, v_half = 255 - half[i_best] - bare;
    expect(full).toBeGreaterThan(10);
    expect(v_half).toBeGreaterThan(full * 0.3);
    expect(v_half).toBeLessThan(full * 0.7);
  });
  it('at twice the pixels it is the same picture, scaled (the film is in device pixels)', () => {
    const a = figure(COUNT, -2, 320, 200, 2).draw(), b = figure(COUNT, -2, 320, 200, 2).draw();
    expect(same(a, b)).toBe(0);
  });
  it('in a script: seeking is exact, back and forth', () => {
    const fig = new Figure();
    const upto = fig.param('upto', 0, { range: [0, COUNT] });
    const P = fig.plot({ id: 'p', x: [-3.3, 3.3], y: [-1.6, 2.8], axes: 'none', grid: false });
    P.add(new Cases((j) => secant(-2)(j), { id: 'secants', role: 'noun:cost', count: COUNT, upto }));
    fig.layout(column([P]));
    fig.script(set(upto, COUNT, 'linear', 3));
    fig.build();
    fig.layout_for(640, 400);
    const c = createCanvas(640, 400), g = c.getContext('2d') as unknown as CanvasRenderingContext2D;
    const at = (t: number) => { fig.at(t); fig.draw(g, 1); return c.getContext('2d').getImageData(0, 0, 640, 400).data.slice(); };
    const mid = at(1.5), end = at(3);
    expect(same(at(1.5), mid)).toBe(0);
    expect(same(at(3), end)).toBe(0);
    expect(same(mid, end)).toBeGreaterThan(0);
  });
});
