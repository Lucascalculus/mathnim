// The economics course's world, as on its cover: a printed card with price up and quantity across, the curves in ink,
// and amounts of money as tinted plates on it (surplus, rent, deadweight loss). Seen from above at rest, the diagram;
// as the camera turns, the plates rise: an area is an amount, and the bigger one stands taller in mass.
import { PIG, type Cam, type V3 } from '../../course_worlds';
import { along, ink, type QP } from '../_kit';
export { along, card_ink, panel, type Panel, type QP } from '../_kit';

// Small diagrams, for the pages that show many questions at once (the map, the drill, the predicted questions): each
// a few strokes, (q, p) in 0..1, with its pigment (undefined: ink).
type Stroke = [QP[], string?, boolean?];
const lin = (a: QP, b: QP): QP[] => [a, b];
export const GLYPHS: Record<string, Stroke[]> = {
  quota: [[lin([0, 0.95], [0.95, 0])], [lin([0, 0], [1, 0.45])], [lin([0.42, 0], [0.42, 1]), 'cobalt']],
  monopoly: [[lin([0, 0.95], [1, 0.1])], [lin([0, 0.95], [0.55, 0]), 'graphite_t'], [lin([0, 0.25], [1, 0.25]), 'cobalt']],
  two: [[lin([0, 0.95], [0.95, 0]), 'cobalt'], [lin([0, 0.6], [0.6, 0]), 'teal'], [lin([0, 0.2], [1, 0.2])]],
  cournot: [[lin([0.5, 0], [0, 1]), 'cobalt'], [lin([0, 0.5], [1, 0]), 'ochre']],
  longrun: [[along((q) => 0.25 + 1.6 * (q - 0.5) ** 2, 0.1, 0.9, 12)], [lin([0, 0.25], [1, 0.25]), 'viridian', true]],
  malthus: [[lin([0, 0.15], [1, 0.75]), 'cobalt'], [along((q) => 0.85 - 0.8 * q + 0.2 * q * q, 0, 1, 10), 'ochre']],
  tax: [[lin([0, 0.95], [0.95, 0])], [lin([0, 0.05], [1, 0.75])], [lin([0, 0.3], [1, 1]), 'graphite_t', true]],
  pollution: [[lin([0, 0.95], [1, 0.1]), 'cobalt'], [lin([0, 0.05], [1, 0.9]), 'ochre'], [lin([0, 0.5], [0.52, 0.5]), undefined, true]],
  costs: [[along((q) => 0.3 + 0.9 * (q - 0.5) ** 2, 0.05, 0.95, 12), 'cobalt'], [along((q) => 0.36 + 3 * (q - 0.3) ** 2, 0.12, 0.48, 8), 'graphite_t'], [along((q) => 0.36 + 3 * (q - 0.7) ** 2, 0.52, 0.88, 8), 'graphite_t']],
  pricing: [[lin([0, 0.95], [0.95, 0])], [lin([0, 0.2], [1, 0.2]), 'cobalt'], [[[0, 0.95], [0.75, 0.2], [0, 0.2], [0, 0.95]], 'cobalt']],
  oligopoly: [[lin([0, 0.5], [1, 0]), 'ochre'], [lin([0.5, 0], [0, 1]), 'cobalt', true]],
  games: [[lin([0.5, 0.05], [0.5, 0.95])], [lin([0.05, 0.5], [0.95, 0.5])], [[[0.05, 0.05], [0.95, 0.05], [0.95, 0.95], [0.05, 0.95], [0.05, 0.05]]]],
  growth: [[along((q) => 0.15 + 0.03 * Math.sin(q * 30) + (q > 0.65 ? 2.6 * (q - 0.65) ** 1.6 : 0), 0, 1, 30), 'cobalt']],
  macro: [[[[0, 0], [0.4, 0], [0.4, 0.9], [0, 0.9], [0, 0]], 'cobalt'], [[[0.55, 0], [1, 0], [1, 0.8], [0.55, 0.8], [0.55, 0]], 'ochre']],
};
/** A small diagram drawn in the square (x0, z0) to (x0 + s, z0 + s) on a card's face. */
export function glyph(ctx: CanvasRenderingContext2D, cam: Cam, name: string, x0: number, z0: number, s: number, alpha = 1, y = 0.052): void {
  const m = 0.16 * s, at = (q: number, p: number): V3 => [x0 + m + q * (s - 2 * m), y, z0 + s - m - p * (s - 2 * m)];
  ink(ctx, cam, [at(0, 1), at(0, 0), at(1, 0)], PIG.ink, 0.8, 0.45 * alpha);
  for (const [pts, pig, dashed] of GLYPHS[name]) ink(ctx, cam, pts.map(([q, p]) => at(q, p)), pig ? PIG[pig] : PIG.ink, 1.1, 0.9 * alpha, dashed);
}
