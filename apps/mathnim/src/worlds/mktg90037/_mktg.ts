// The marketing course's world, as on its cover: what a product is worth as a column seen from the front, the cost
// floor (ochre) below, the customer's value ceiling (teal) above, the price somewhere between; people as small
// figures (a body and a head); a firm as a plaster block. Shared by its lessons' pictures.
import { box, cylinder_y, type Solid, type SolidStyle } from '../../course_worlds';

/** A person standing at (x, z): body and head, hgt tall. */
export function person(x: number, z: number, o: SolidStyle = {}, hgt = 0.8): Solid[] {
  return [cylinder_y(x, z, 0.16, 0, hgt * 0.68, 16, { shade: 0.6, ...o }), cylinder_y(x, z, 0.12, hgt * 0.74, hgt, 16, { shade: 0.6, ...o, shadow: false })];
}
/** The cover's column at x: the cost floor up to cost, the value ceiling at value (a plate), the gap between in dashes. */
export function worth(x: number, cost: number, value: number, w = 0.9, o: { tint?: number } = {}): Solid[] {
  const h = w / 2;
  return [
    box(x - h, 0, -h, x + h, cost, h, { pig: 'ochre', k: 1, tint: 0.34 }),
    box(x - h, value, -h, x + h, value + 0.1, h, { pig: 'teal', k: 1, tint: o.tint ?? 0.55, shadow: false }),
    box(x - h, cost, -h, x + h, value, h, { kind: 'wire', pig: 'teal', solid: 0, alpha: 0.6 }),
  ];
}
