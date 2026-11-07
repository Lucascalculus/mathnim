// The business-analytics course's world, as on its cover: the plans you are allowed as a raised plate (viridian) on a
// printed card, the profit line, the corner; and, for its halves on chance and data, counts as small pegs and amounts as
// plates. Shared by its lessons' pictures.
import { PIG, type Cam } from '../../course_worlds';
import { ink, type Panel, type QP } from '../_kit';

/** The plate of allowed plans (x₁ across, x₂ up). */
export const CORNERS: QP[] = [[0, 0], [0, 0.82], [0.42, 0.74], [0.78, 0.38], [0.86, 0]];
/** The best corner for the profit 2x₁ + x₂. */
export const BEST: QP = [0.78, 0.38];
/** The line through a and b, drawn across the whole plot (a constraint's edge). */
export function edge_line(ctx: CanvasRenderingContext2D, cam: Cam, P: Panel, a: QP, b: QP, alpha = 0.5): void {
  const d: QP = [b[0] - a[0], b[1] - a[1]], pts: QP[] = [];
  for (let t = -3; t <= 4; t += 0.02) { const q = a[0] + d[0] * t, p = a[1] + d[1] * t; if (q >= -0.001 && q <= 1.04 && p >= -0.001 && p <= 1.04) pts.push([q, p]); }
  if (pts.length > 1) P.line(ctx, cam, [pts[0], pts[pts.length - 1]], PIG.graphite_t, 1, alpha);
}
/** Ink lines (text) on a card: rows from (x0, z0), each w·share long. */
export function text_lines(ctx: CanvasRenderingContext2D, cam: Cam, x0: number, z0: number, w: number, shares: number[], dz = 0.28, y = 0.052, alpha = 0.5): void {
  shares.forEach((s, i) => ink(ctx, cam, [[x0, y, z0 + i * dz], [x0 + w * s, y, z0 + i * dz]], PIG.graphite_t, 1.2, alpha));
}
