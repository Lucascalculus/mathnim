// What every course's pictures draw with, beyond the solids (course_worlds.js): ink and washes through world points,
// words at a world point, an arrow, and the frame a picture is fitted into. Not a lesson (the name starts with _).
import { PIG, box, cylinder_y, extrude, fit, label, poly, stroke_ink, stroke_prov, with_shadows, type Cam, type Pigment, type Solid, type SolidStyle, type V3 } from '../course_worlds';

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

// A diagram printed on a card (x across, y up, both 0..1), and amounts on it as tinted plates that rise as the camera
// turns: the economics course's cover, and every course that plots something.
export type QP = [number, number];
export interface Panel {
  card: Solid;
  /** A point of the diagram (q across, p up, both 0..1) on the card's face. */
  at(q: number, p: number, y?: number): V3;
  /** An amount: the region, a plate tinted pig, rising h as the camera turns (u). */
  plate(pts: QP[], pig: string, u: number, h?: number, tint?: number): Solid;
  /** Price and quantity axes, named. */
  axes(ctx: CanvasRenderingContext2D, cam: Cam, alpha: number, names?: [string, string]): void;
  /** A curve through diagram points. */
  line(ctx: CanvasRenderingContext2D, cam: Cam, pts: QP[], pig: Pigment, wd: number, alpha: number, dashed?: boolean): void;
  /** Words at a diagram point. */
  say(ctx: CanvasRenderingContext2D, cam: Cam, t: string, q: number, p: number, pig?: Pigment, size?: number, align?: CanvasTextAlign, weight?: number): void;
}
/** A card at (x0, z0), w wide and d deep, and how to draw a diagram on it. */
export function panel(x0 = 0, z0 = 0, w = 6, d = 4.1): Panel {
  const at = (q: number, p: number, y = 0.052): V3 => [x0 + 0.55 + q * (w - 1.1), y, z0 + d - 0.45 - p * (d - 0.9)];
  return {
    card: card(x0, z0, x0 + w, z0 + d, { bias: -10 }),
    at,
    plate: (pts, pig, u, h = 0.32, tint = 0.38) => extrude(pts.map(([q, p]) => at(q, p, 0.05)), [0, 0.004 + h * u, 0], { pig, k: 1, tint, shade: 0.6 }),
    axes(ctx, cam, alpha, names = ['Q', 'P']) {
      ink(ctx, cam, [at(0, 1.04), at(0, 0), at(1.04, 0)], PIG.ink, 1, 0.8 * alpha);
      if (alpha > 0.01) { words(ctx, cam, names[0], at(1.04, -0.11), PIG.ink, 11.5, 'center', alpha); words(ctx, cam, names[1], at(-0.07, 0.98), PIG.ink, 11.5, 'center', alpha); }
    },
    line: (ctx, cam, pts, pig, wd, alpha, dashed = false) => ink(ctx, cam, pts.map(([q, p]) => at(q, p)), pig, wd, alpha, dashed),
    say: (ctx, cam, t, q, p, pig = PIG.ink, size = 11, align = 'center', weight = 600) => words(ctx, cam, t, at(q, p), pig, size, align, 1, weight),
  };
}
/** Points along p = f(q) from q0 to q1. */
export const along = (f: (q: number) => number, q0: number, q1: number, n = 32): QP[] => Array.from({ length: n + 1 }, (_, i) => { const q = q0 + ((q1 - q0) * i) / n; return [q, f(q)]; });
/**
 * Ink that lies on the card: drawn under the plates once they rise (the card's own marks), over them while they lie
 * flat (at rest the plates are only tints). `draw(alpha)` draws every mark with its alpha scaled.
 */
export function card_ink(p: Panel, cam: Cam, u: number, draw: (ctx: CanvasRenderingContext2D, k: number) => void): (ctx: CanvasRenderingContext2D) => void {
  p.card.after = (ctx: CanvasRenderingContext2D) => draw(ctx, u);
  return (ctx) => { if (u < 0.999) draw(ctx, 1 - u); };
}


// Round things: points round a circle, a disc lying flat, the wedge of a disc. Points are (x, z): x to the right, z toward
// the viewer (down the picture from above); angles turn from +x toward +z.
export type P2 = [number, number];
/** The face of a plate (marks are drawn on it). */
export const Y = 0.052;
/** A point on the plate's face. */
export const at = (p: P2, y = Y): V3 => [p[0], y, p[1]];
/** Points round a circle from angle a0 to a1. */
export const arc = (c: P2, r: number, a0 = 0, a1 = Math.PI * 2, n = 72, y = Y): V3[] => Array.from({ length: n + 1 }, (_, i) => { const a = a0 + ((a1 - a0) * i) / n; return [c[0] + r * Math.cos(a), y, c[1] + r * Math.sin(a)]; });
/** The point at angle a on a circle. */
export const on_circle = (c: P2, r: number, a: number): P2 => [c[0] + r * Math.cos(a), c[1] + r * Math.sin(a)];
/** A disc lying flat (its marks, if any, drawn on it in order, before anything standing on it). */
export const disc = (c: P2, r: number, h = 0.05, o: SolidStyle = {}, marks?: (ctx: CanvasRenderingContext2D, cam: Cam) => void, y0 = 0): Solid => {
  const s = cylinder_y(c[0], c[1], r, y0, y0 + h, 72, { shade: 0.5, ...o });
  if (marks) s.after = marks;
  return s;
};
/** A wedge of a disc (centre c, radius r, from angle a0 to a1), y0 to y0 + h. */
export const wedge = (c: P2, r: number, a0: number, a1: number, y0: number, h: number, o: SolidStyle = {}): Solid =>
  extrude([[c[0], y0, c[1]], ...arc(c, r, a0, a1, 8, y0)], [0, h, 0], { shade: 0.6, ...o });
