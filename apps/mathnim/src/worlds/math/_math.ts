// The geometry course's world, shared by its lessons' pictures: figures drawn on plaster (a plate, a disc), ink
// circles and arcs, the mark of an angle, the wedge of a disc. Points are (x, z): x to the right, z toward the viewer
// (down the picture when seen from above); angles turn from +x toward +z.
import { type Cam, type Pigment } from '../../course_worlds';
import { ink, wash } from '../_kit';

export { arc, at, disc, on_circle, wedge, Y, type P2 } from '../_kit';
import { arc, at, type P2 } from '../_kit';

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
