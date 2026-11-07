// The machine-learning course's world, as on its cover: labelled examples as small forms on a card, one class round
// (cobalt cylinders), the other square (ochre blocks), unlabelled ones as grey dots; what a model draws in ink.
// Shared by its lessons' pictures.
import { box, cylinder_y, type Solid, type SolidStyle } from '../../course_worlds';

/** An example of class 0 (round, cobalt) or 1 (square, ochre), standing on a card's face. */
export function form(x: number, z: number, cls: number, hgt = 0.26, s = 0.13, o: SolidStyle = {}): Solid {
  return cls === 0
    ? cylinder_y(x, z, s, 0.05, 0.05 + hgt, 14, { pig: 'cobalt', k: 1, tint: 0.5, ...o })
    : box(x - s * 0.92, 0.05, z - s * 0.92, x + s * 0.92, 0.05 + hgt * 0.85, z + s * 0.92, { pig: 'ochre', k: 1, tint: 0.5, ...o });
}
/** An unlabelled example: a low grey stud. */
export const dot = (x: number, z: number, hgt = 0.04): Solid => cylinder_y(x, z, 0.08, 0.05, 0.05 + hgt, 10, { pig: 'ink', k: 1, tint: 0.12, shadow: false });
/** Fixed pseudo-random numbers (the same picture every time). */
export const rnd = (i: number): number => { const v = Math.sin(i * 127.1 + 311.7) * 43758.5453; return v - Math.floor(v); };
/** n points round (cx, cz), spread s, as [x, z]. */
export const cloud = (seed: number, n: number, cx: number, cz: number, s: number): [number, number][] =>
  Array.from({ length: n }, (_, i) => { const r = Math.sqrt(-2 * Math.log(rnd(seed + i) * 0.96 + 0.03)) * s, t = rnd(seed + i + 500) * Math.PI * 2; return [cx + r * Math.cos(t), cz + r * Math.sin(t)]; });
