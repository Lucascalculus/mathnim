// The geometry course's world, shared by its lessons' pictures: figures drawn on plaster (a plate, a disc), ink
// circles and arcs, the mark of an angle, the wedge of a disc. Points are (x, z): x to the right, z toward the viewer
// (down the picture when seen from above); angles turn from +x toward +z.
import { cylinder_y, extrude, type Cam, type Pigment, type Solid, type SolidStyle, type V3 } from '../../course_worlds';
import { ink, wash } from '../_kit';

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
/** The angle at v between the directions to a and b: a small washed sector with an ink edge. */
export function angle(ctx: CanvasRenderingContext2D, cam: Cam, v: P2, a: P2, b: P2, r: number, pig: Pigment, alpha = 0.32): void {
  let a0 = Math.atan2(a[1] - v[1], a[0] - v[0]), a1 = Math.atan2(b[1] - v[1], b[0] - v[0]);
  if (a1 < a0) a1 += Math.PI * 2;
  if (a1 - a0 > Math.PI) [a0, a1] = [a1, a0 + Math.PI * 2];
  const rim = arc(v, r, a0, a1, 24);
  wash(ctx, cam, [at(v), ...rim], pig, alpha);
  ink(ctx, cam, rim, pig, 1.1, 0.85);
}
/** Where the bisector of the angle at v (toward a and b) is, d from v (for its name). */
export const in_angle = (v: P2, a: P2, b: P2, d: number): P2 => {
  const ua = Math.hypot(a[0] - v[0], a[1] - v[1]), ub = Math.hypot(b[0] - v[0], b[1] - v[1]);
  const m: P2 = [(a[0] - v[0]) / ua + (b[0] - v[0]) / ub, (a[1] - v[1]) / ua + (b[1] - v[1]) / ub], l = Math.hypot(m[0], m[1]);
  return [v[0] + (m[0] / l) * d, v[1] + (m[1] / l) * d];
};
