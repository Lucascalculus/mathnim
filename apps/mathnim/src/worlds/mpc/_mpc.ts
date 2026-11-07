// The MPC course's world, shared by its lessons' pictures: the cart on its track, the wall, a planned position (a cart
// drawn in dashes: predicted), the goal line; and the frame every picture is fitted into.
import { PIG, box, fit, seg, stroke_ink, with_shadows, type Cam, type Solid, type SolidStyle } from '../../course_worlds';

/** The track from x0 to x1 (metres), its metre ticks along the near edge. */
export function track(x0: number, x1: number, goal?: number): Solid {
  const t = box(x0, 0, -0.55, x1, 0.09, 0.55);
  t.after = (ctx: CanvasRenderingContext2D, cam: Cam) => {
    for (let m = Math.ceil(x0); m <= x1; m++) {
      const a = cam.p([m, 0.09, 0.55]), b = cam.p([m, 0.09, 0.36]);
      stroke_ink(ctx, seg(ctx, a[0], a[1], b[0], b[1]), PIG.ink, 0.7, 0.45);
    }
    if (goal != null) {
      const g0 = cam.p([goal, 0.091, -0.55]), g1 = cam.p([goal, 0.091, 0.55]);
      stroke_ink(ctx, seg(ctx, g0[0], g0[1], g1[0], g1[1]), PIG.viridian, 1.4, 0.9);
    }
  };
  return t;
}
/** The wall at x (its face toward the cart). */
export const wall = (x: number, o: SolidStyle = {}): Solid => box(x, 0, -0.95, x + 0.18, 1.2, 0.95, { pig: 'ochre', k: 1, tint: 0.34, bias: -0.2, ...o });
/** The cart, its nose at p. */
export const cart = (p: number, o: SolidStyle = {}): Solid => box(p - 0.92, 0.09, -0.32, p, 0.5, 0.32, { pig: 'cobalt', k: 1, tint: 0.55, ...o });
/** A planned position of the cart: drawn in dashes (predicted); `solid` 1 closes the dashes (it happened). */
export const ghost = (p: number, solid = 0, alpha = 0.8, pig = 'cobalt'): Solid => box(p - 0.92, 0.09, -0.32, p, 0.5, 0.32, { kind: 'wire', pig, solid, alpha });

/** Fit what is drawn into the picture, with room round it (px: left, top, right, bottom). */
export function frame(cam: Cam, solids: Solid[], w: number, h: number, pad: [number, number, number, number] = [14, 16, 14, 18], extra: [number, number, number][] = []): Cam {
  return fit(cam, with_shadows(solids.flatMap((s) => s.pts)).concat(extra), pad[0], pad[1], w - pad[0] - pad[2], h - pad[1] - pad[3]);
}
/** An arrow in ink from a to b (screen px). */
export function arrow(ctx: CanvasRenderingContext2D, a: number[], b: number[], pig = PIG.ink, wd = 1.5, alpha = 1): void {
  stroke_ink(ctx, seg(ctx, a[0], a[1], b[0], b[1]), pig, wd, alpha);
  const an = Math.atan2(b[1] - a[1], b[0] - a[0]), l = 6.5;
  stroke_ink(ctx, () => { ctx.beginPath(); ctx.moveTo(b[0] - l * Math.cos(an - 0.5), b[1] - l * Math.sin(an - 0.5)); ctx.lineTo(b[0], b[1]); ctx.lineTo(b[0] - l * Math.cos(an + 0.5), b[1] - l * Math.sin(an + 0.5)); }, pig, wd, alpha);
}
