// The fine-tuning course's world, shared by its lessons' pictures: a model as a stack of layers (plaster slabs), tokens
// as small blocks, documents and examples as cards, a printed card to draw a curve on, and the ink and labels on them.
import { box, type Solid, type SolidStyle } from '../../course_worlds';

/** A model: n layers stacked from y0 (each th thick, gap between), w across (x) and d deep (z), centred at (x, z). */
export function stack(x: number, z: number, n: number, o: { w?: number; d?: number; th?: number; gap?: number; y0?: number; style?: (i: number) => SolidStyle } = {}): { solids: Solid[]; top: number; y: (i: number) => number } {
  const w = o.w ?? 2.4, d = o.d ?? 1.6, th = o.th ?? 0.13, gap = o.gap ?? 0.34, y0 = o.y0 ?? 0;
  const y = (i: number) => y0 + i * gap;
  const solids = Array.from({ length: n }, (_, i) => box(x - w / 2, y(i), z - d / 2, x + w / 2, y(i) + th, z + d / 2, { shade: 0.5, bias: i * 0.01, ...(o.style?.(i) ?? {}) }));
  return { solids, top: y(n - 1) + th, y };
}
/** A token: a small block at (x, z); `wire` draws it in dashes (not counted). */
export const token = (x: number, z: number, o: SolidStyle = {}, s = 0.34, hgt = 0.3): Solid => box(x - s / 2, 0, z - s / 2, x + s / 2, hgt, z + s / 2, { shade: 0.6, ...o });
export { arrow3, card, curve, frame, ink, on, wash, words } from '../_kit';
