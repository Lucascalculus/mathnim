// Certainty as a state of every mark (hollow → solid, NEXT.md): a guessed path is dashed and its dashes close up as it
// is established; a guessed point is a ring that fills from its edge; a guessed region has no tint, only a dashed
// edge; a guessed arrow's head is an outline. Held to what the pixels show, and to seeking.
import { beforeAll, describe, expect, it } from 'vitest';
import { createCanvas } from '@napi-rs/canvas';
import { Arrow, Figure, Marker, Path, Region, column, load_tex, set } from '../src/index';
import { use_node_canvas } from '../node';

beforeAll(async () => {
  use_node_canvas();
  await load_tex();
});

/** A figure with one mark in a plain plot, drawn at 400 × 300; returns the pixels and the plot (for coordinates). */
function draw_one(make: (fig: Figure) => { add: (P: ReturnType<Figure['plot']>) => void }, k: number | null) {
  const fig = new Figure();
  const P = fig.plot({ id: 'p', x: [0, 10], y: [0, 10], aspect: 'equal', axes: 'none', grid: false });
  const kp = fig.param('k', k ?? 1, { range: [0, 1] });
  (make(fig) as unknown as { add: (P: unknown, k: unknown) => void }).add(P, k === null ? undefined : kp);
  fig.layout(column([P]));
  fig.build();
  fig.layout_for(400, 300);
  const c = createCanvas(400, 300);
  fig.draw(c.getContext('2d') as unknown as CanvasRenderingContext2D, 1, { force: true });
  const d = c.getContext('2d').getImageData(0, 0, 400, 300).data;
  const ink = (x: number, y: number) => { const i = (Math.round(y) * 400 + Math.round(x)) * 4; return 255 - (d[i] + d[i + 1] + d[i + 2]) / 3; };
  return { ink, P };
}

describe('certainty: hollow → solid', () => {
  const path = (k: number | null) => draw_one(() => ({ add: (P: any, kk: any) => P.add(new Path([[1, 5], [9, 5]], { id: 'l', role: 'noun:cost', certain: kk })) }), k);
  it('a guessed path is dashed, and its dashes close up as it is established', () => {
    const gaps = (k: number | null) => {
      const { ink, P } = path(k), [x0, y] = P.P([1.5, 5]), [x1] = P.P([8.5, 5]);
      let n = 0;
      for (let x = x0; x < x1; x++) if (ink(x, y) < 40) n++;
      return n;
    };
    const g0 = gaps(0), g5 = gaps(0.5), g1 = gaps(1), gn = gaps(null);
    expect(g0).toBeGreaterThan(40);
    expect(g5).toBeLessThan(g0);
    expect(g5).toBeGreaterThan(0);
    expect(g1).toBe(0);
    expect(gn).toBe(0);
  });
  const dot = (k: number | null) => draw_one(() => ({ add: (P: any, kk: any) => P.add(new Marker([5, 5], { id: 'm', role: 'noun:cost', r: 9, certain: kk })) }), k);
  it('a guessed point is a ring that fills from its edge', () => {
    const at = (k: number | null, rr: number) => { const { ink, P } = dot(k), [x, y] = P.P([5, 5]); return ink(x + rr, y); };
    expect(at(0, 0)).toBeLessThan(10);         // the middle is paper
    expect(at(0, 8)).toBeGreaterThan(80);      // the ring is ink
    expect(at(0, 4)).toBeLessThan(10);
    expect(at(0.6, 4)).toBeGreaterThan(80);    // filling inward: 4 px in is ink by 0.6
    expect(at(0.6, 0)).toBeLessThan(10);       // the middle not yet
    expect(at(1, 0)).toBeGreaterThan(80);      // established: solid
    expect(at(null, 0)).toBeGreaterThan(80);
  });
  const region = (k: number | null) => draw_one(() => ({ add: (P: any, kk: any) => P.add(new Region([[2, 2], [8, 2], [8, 8], [2, 8]], { id: 'r', role: 'noun:feasible', fill: 0.3, edge: false, certain: kk })) }), k);
  it('a guessed region has no tint, only a dashed edge; established, it is tinted', () => {
    const inside = (k: number | null) => { const { ink, P } = region(k), [x, y] = P.P([5, 5]); return ink(x, y); };
    const edge_gaps = (k: number | null) => { const { ink, P } = region(k), [x0, y] = P.P([2.5, 2]), [x1] = P.P([7.5, 2]); let n = 0, any = 0; for (let x = x0; x < x1; x++) { const v = ink(x, y); if (v < 20) n++; if (v > 40) any++; } return { n, any }; };
    expect(inside(0)).toBeLessThan(5);
    expect(inside(1)).toBeGreaterThan(20);
    const e0 = edge_gaps(0);
    expect(e0.any).toBeGreaterThan(20);        // the edge is drawn although the role draws none
    expect(e0.n).toBeGreaterThan(20);          // and it is dashed
    expect(edge_gaps(1).any).toBe(0);          // established and edge: false: no edge
  });
  it("a guessed arrow's shaft is dashed and its head an outline", () => {
    const fig = (k: number) => draw_one(() => ({ add: (P: any, kk: any) => P.add(new Arrow([1, 5], [9, 5], { id: 'a', role: 'noun:cost', certain: kk })) }), k);
    const head_middle = (k: number) => { const { ink, P } = fig(k), [x, y] = P.P([9, 5]); return ink(x - 9, y); };
    expect(head_middle(0)).toBeLessThan(head_middle(1));
  });
  it('as a motion: converging in the script, and seeking back makes it a guess again', () => {
    const f = new Figure();
    const P = f.plot({ id: 'p', x: [0, 10], y: [0, 10], aspect: 'equal', axes: 'none', grid: false });
    const k = f.param('k', 0, { range: [0, 1] });
    P.add(new Marker([5, 5], { id: 'm', role: 'noun:cost', r: 9, certain: k }));
    f.layout(column([P]));
    f.script(set(k, 1, 'converge'));
    f.build();
    f.layout_for(400, 300);
    const c = createCanvas(400, 300), g = c.getContext('2d') as unknown as CanvasRenderingContext2D;
    const middle = () => { const [x, y] = P.P([5, 5]), d = c.getContext('2d').getImageData(Math.round(x), Math.round(y), 1, 1).data; return 255 - (d[0] + d[1] + d[2]) / 3; };
    f.at(0); f.draw(g, 1);
    expect(middle()).toBeLessThan(10);
    f.at(f.duration); f.draw(g, 1);
    expect(middle()).toBeGreaterThan(80);
    f.at(0); f.draw(g, 1);
    expect(middle()).toBeLessThan(10);
  });
});
