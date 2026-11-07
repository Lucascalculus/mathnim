// The economics course's world, as on its cover: a printed card with price up and quantity across, the curves in ink,
// and amounts of money as tinted plates on it (surplus, rent, deadweight loss). Seen from above at rest, the diagram;
// as the camera turns, the plates rise: an area is an amount, and the bigger one stands taller in mass.
import { PIG, extrude, type Cam, type Pigment, type Solid, type V3 } from '../../course_worlds';
import { card, ink, words } from '../_kit';

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
