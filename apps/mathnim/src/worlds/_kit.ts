// What every course's pictures draw with, beyond the solids (course_worlds.js): ink and washes through world points,
// words at a world point, an arrow, and the frame a picture is fitted into. Not a lesson (the name starts with _).
import { PIG, box, fit, label, poly, stroke_ink, stroke_prov, with_shadows, type Cam, type Pigment, type Solid, type SolidStyle, type V3 } from '../course_worlds';

/** A card lying flat (a document, an example, the paper a plot or a figure is printed on). */
export const card = (x0: number, z0: number, x1: number, z1: number, o: SolidStyle = {}, y0 = 0, th = 0.05): Solid => box(x0, y0, z0, x1, y0 + th, z1, { shade: 0.5, ...o });
/** A point on a card's face: u across (0 left, 1 right), v up the plot (0 bottom, 1 top: the far edge). */
export const on = (c: [number, number, number, number], u: number, v: number, y = 0.052): V3 => [c[0] + u * (c[2] - c[0]), y, c[3] - v * (c[3] - c[1])];
/** The curve v = f(u) on a card, as points. */
export const curve = (c: [number, number, number, number], f: (u: number) => number, u0 = 0, u1 = 1, n = 48, y = 0.052): V3[] => Array.from({ length: n + 1 }, (_, i) => { const u = u0 + ((u1 - u0) * i) / n; return on(c, u, f(u), y); });

/** Ink through world points (solid, or in dashes: predicted). */
export function ink(ctx: CanvasRenderingContext2D, cam: Cam, pts: V3[], pig: Pigment = PIG.ink, wd = 1.4, alpha = 1, dashed = false): void {
  const path = poly(ctx, pts.map((q) => cam.p(q)));
  if (dashed) stroke_prov(ctx, path, pig, 0, wd, alpha); else stroke_ink(ctx, path, pig, wd, alpha);
}
/** A filled region (world points). */
export function wash(ctx: CanvasRenderingContext2D, cam: Cam, pts: V3[], pig: Pigment, alpha = 0.18): void {
  ctx.save(); ctx.fillStyle = `rgba(${Math.round(pig[0] * 255)},${Math.round(pig[1] * 255)},${Math.round(pig[2] * 255)},${alpha})`; poly(ctx, pts.map((q) => cam.p(q)), true)(); ctx.fill(); ctx.restore();
}
/** Words at a world point. */
export function words(ctx: CanvasRenderingContext2D, cam: Cam, t: string, q: V3, pig: Pigment = PIG.ink, size = 11.5, align: CanvasTextAlign = 'center', alpha = 1, weight = 600): void {
  const p = cam.p(q); label(ctx, t, p[0], p[1], pig, size, weight, align, 'alphabetic', alpha);
}
/** An arrow in ink between world points. */
export function arrow3(ctx: CanvasRenderingContext2D, cam: Cam, a: V3, b: V3, pig: Pigment = PIG.ink, wd = 1.3, alpha = 1, dashed = false): void {
  const p = cam.p(a), q = cam.p(b);
  ink(ctx, cam, [a, b], pig, wd, alpha, dashed);
  const an = Math.atan2(q[1] - p[1], q[0] - p[0]), l = 6;
  stroke_ink(ctx, () => { ctx.beginPath(); ctx.moveTo(q[0] - l * Math.cos(an - 0.5), q[1] - l * Math.sin(an - 0.5)); ctx.lineTo(q[0], q[1]); ctx.lineTo(q[0] - l * Math.cos(an + 0.5), q[1] - l * Math.sin(an + 0.5)); }, pig, wd, alpha);
}
/** Fit what is drawn (and any extra points: words, ink) into the picture, with room round it (px: left, top, right, bottom). */
export function frame(cam: Cam, solids: Solid[], w: number, h: number, pad: [number, number, number, number] = [14, 16, 14, 16], extra: V3[] = []): Cam {
  return fit(cam, with_shadows(solids.flatMap((s) => s.pts)).concat(extra), pad[0], pad[1], w - pad[0] - pad[2], h - pad[1] - pad[3]);
}
/** A pigment by name (undefined: the graphite of plain marks). */
export const pig_of = (name?: string): Pigment => (name ? PIG[name] : PIG.graphite_t);
