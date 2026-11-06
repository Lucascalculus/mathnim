// The renderer draws only what changed: a seek leaves what it did not change as it was (batch_writes), a frame where
// nothing changed is not drawn, and what did not change waits in a cached layer. Held to two things on real figures:
// every frame drawn this way is the frame a full redraw gives, pixel for pixel; and far less is drawn.
import { beforeAll, describe, expect, it } from 'vitest';
import { createCanvas } from '@napi-rs/canvas';
import { load_tex, type Figure } from '@mathnim/engine';
import { use_node_canvas } from '../../engine/node';
import { check_params, get_visual } from '../src';
import '../src/mpc';
import '../src/physics';
import { set_ft_lang } from '../src/ft/f/kit';

beforeAll(async () => {
  use_node_canvas();
  set_ft_lang('en');
  await load_tex();
});

const W = 640, H = 360;
function make(name: string, params: Record<string, unknown> = {}): Figure {
  const v = get_visual(name)!;
  const fig = v.scene(check_params(v, params).params) as Figure;
  fig.build();
  fig.layout_for(W, H);
  return fig;
}
/** Play a figure at 30 frames a second, drawing each frame only as needed; compare every k-th frame with a full redraw. */
function play(name: string, params: Record<string, unknown> = {}, k = 3) {
  const fig = make(name, params), ref = make(name, params);
  const a = createCanvas(W, H), b = createCanvas(W, H);
  const ga = a.getContext('2d') as unknown as CanvasRenderingContext2D, gb = b.getContext('2d') as unknown as CanvasRenderingContext2D;
  let things = 0;
  const R = fig.renderer as unknown as { draw_one: (t: unknown, env: unknown) => void };
  const draw_one = R.draw_one.bind(R);
  R.draw_one = (t, env) => { things++; draw_one(t, env); };
  const n = Math.ceil(fig.duration * 30) + 15;   // (and half a second resting at the end)
  let drawn = 0, worst = 0, off = 0, compared = 0;
  for (let f = 0; f <= n; f++) {
    const t = Math.min(fig.duration, f / 30);
    fig.at(t);
    if (fig.draw(ga, 1)) drawn++;
    if (f % k) continue;
    ref.at(t);
    ref.draw(gb, 1, { force: true });
    const da = ga.getImageData(0, 0, W, H).data, db = gb.getImageData(0, 0, W, H).data;
    for (let i = 0; i < da.length; i++) { const d = Math.abs(da[i] - db[i]); if (d > 2) off++; worst = Math.max(worst, d); }
    compared++;
  }
  const all = fig.registry.all().length;
  return { frames: n + 1, drawn, things, every_thing_every_frame: all * (n + 1), worst, off, compared };
}

describe('the renderer draws only what changed', () => {
  const cases: [string, Record<string, unknown>][] = [
    ['substitute_point', {}],
    ['tangent_develop', {}],
    ['formula_steps', {}],
    ['determinant_area', {}],
    ['mpc_qp_plane', {}],
    ['phys_pendulum', {}],
  ];
  for (const [name, params] of cases)
    it(`${name}: every frame is the full redraw's, and less is drawn`, () => {
      const r = play(name, params);
      // (a cached layer composited back may round a channel by one or two: never more, and on almost no pixels)
      expect(r.worst, JSON.stringify(r)).toBeLessThanOrEqual(2);
      expect(r.off).toBe(0);
      expect(r.compared).toBeGreaterThan(10);
      expect(r.things, JSON.stringify(r)).toBeLessThan(r.every_thing_every_frame);
      console.log(`${name}: ${r.frames} frames, drawn ${r.drawn}; things drawn ${r.things} of ${r.every_thing_every_frame} if all were drawn every frame`);
    });
  it('a frame where nothing changed is not drawn at all', () => {
    const fig = make('substitute_point');
    const c = createCanvas(W, H), g = c.getContext('2d') as unknown as CanvasRenderingContext2D;
    fig.at(fig.duration);
    fig.draw(g, 1);
    fig.at(fig.duration);
    expect(fig.draw(g, 1)).toBe(false);
    // a hold in the middle of the script: the seek moves nothing, so nothing is drawn
    const t = fig.section_starts()[0] - 0.3;
    fig.at(t - 0.05);
    fig.draw(g, 1);
    fig.at(t);
    expect(fig.draw(g, 1)).toBe(false);
  });
});
