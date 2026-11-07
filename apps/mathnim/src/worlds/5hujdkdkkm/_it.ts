// The Internet Technologies course's world, as on its cover: hosts as plaster boxes, routers as low cylinders, links in
// ink, a packet as a violet slab on its way; people as small figures (a body and a head), a key as a ring and a bar.
// Shared by its lessons' pictures.
import { PIG, box, cylinder_y, obox, type Cam, type Solid, type SolidStyle } from '../../course_worlds';
import { ink } from '../_kit';

/** A host (a computer) at (x, z). */
export const host = (x: number, z: number, hgt = 0.42, o: SolidStyle = {}): Solid => box(x - 0.34, 0, z - 0.24, x + 0.34, hgt, z + 0.24, { shade: 0.6, ...o });
/** A router at (x, z). */
export const router = (x: number, z: number, hgt = 0.18, o: SolidStyle = {}): Solid => cylinder_y(x, z, 0.22, 0, hgt, 20, { shade: 0.6, ...o });
/** A packet at (x, z) heading at angle ang (radians, in the ground plane), y0 above the ground. */
export const packet = (x: number, z: number, ang = 0, y0 = 0, o: SolidStyle = {}, len = 0.42): Solid => obox(x, z, len, 0.2, y0, y0 + 0.16, ang, { pig: 'violet', k: 1, tint: 0.85, ...o });
/** A person standing at (x, z): body and head, hgt tall. */
export function person(x: number, z: number, o: SolidStyle = {}, hgt = 0.8): Solid[] {
  return [cylinder_y(x, z, 0.16, 0, hgt * 0.68, 16, { shade: 0.6, ...o }), cylinder_y(x, z, 0.12, hgt * 0.74, hgt, 16, { shade: 0.6, ...o, shadow: false })];
}
/** A key lying flat at (x, z), pointing +x: its ring and its bar with two teeth. */
export function key(x: number, z: number, pig: string, hgt = 0.08): Solid[] {
  const o = { pig, k: 1, tint: 0.6 };
  return [cylinder_y(x, z, 0.22, 0, hgt, 18, o), box(x + 0.18, 0, z - 0.05, x + 0.9, hgt, z + 0.05, o), box(x + 0.62, 0, z + 0.05, x + 0.7, hgt, z + 0.17, o), box(x + 0.8, 0, z + 0.05, x + 0.88, hgt, z + 0.17, o)];
}
/** A link between two ground points, in ink. */
export const link = (ctx: CanvasRenderingContext2D, cam: Cam, a: [number, number], b: [number, number], pig = PIG.ink, wd = 1.1, alpha = 0.6, dashed = false): void =>
  ink(ctx, cam, [[a[0], 0.01, a[1]], [b[0], 0.01, b[1]]], pig, wd, alpha, dashed);

// Small drawings of the course's topics, for the pages that show many questions at once (the starts, the drill): a
// few ink strokes in the square (x0, z0) to (x0 + s, z0 + s) on a face at height y.
export function it_glyph(ctx: CanvasRenderingContext2D, cam: Cam, name: string, x0: number, z0: number, s: number, y = 0.052, alpha = 0.9): void {
  const P = (a: number, b: number): [number, number, number] => [x0 + s * (0.15 + 0.7 * a), y, z0 + s * (0.15 + 0.7 * b)];
  const L = (pts: [number, number][], pig = PIG.ink, wd = 1.1, dashed = false) => ink(ctx, cam, pts.map(([a, b]) => P(a, b)), pig, wd, alpha, dashed);
  const V = PIG.violet;
  switch (name) {
    case 'signal': L([[0, 0.7], [0.2, 0.7], [0.2, 0.3], [0.45, 0.3], [0.45, 0.7], [0.6, 0.7], [0.6, 0.3], [1, 0.3]], V, 1.4); break;
    case 'frame': L([[0, 0.5], [1, 0.5]], PIG.ink, 5); L([[0.25, 0.5], [0.75, 0.5]], V, 5); break;
    case 'bus': L([[0, 0.5], [1, 0.5]]); L([[0.2, 0.5], [0.2, 0.2]]); L([[0.5, 0.5], [0.5, 0.8]]); L([[0.8, 0.5], [0.8, 0.2]]); L([[0.42, 0.42], [0.58, 0.58]], PIG.ochre, 1.4); L([[0.42, 0.58], [0.58, 0.42]], PIG.ochre, 1.4); break;
    case 'window': for (let i = 0; i < 6; i++) L([[i / 6 + 0.02, 0.5], [(i + 1) / 6 - 0.02, 0.5]], i === 2 ? PIG.ochre : V, 5); L([[0.3, 0.3], [0.85, 0.3]], PIG.ink, 1, true); break;
    case 'prefix': L([[0, 0.3], [0.7, 0.3]], PIG.cobalt, 4); L([[0, 0.55], [0.45, 0.55]], PIG.cobalt, 4); L([[0, 0.8], [0.85, 0.8]], PIG.teal, 4); break;
    case 'graph': L([[0.1, 0.5], [0.4, 0.15], [0.8, 0.3], [0.9, 0.8], [0.4, 0.8], [0.1, 0.5]]); L([[0.4, 0.15], [0.4, 0.8]]); L([[0.1, 0.5], [0.4, 0.15], [0.8, 0.3]], V, 1.6); break;
    case 'ports': L([[0, 0.1], [0, 0.9], [0.5, 0.9], [0.5, 0.1], [0, 0.1]]); for (let i = 0; i < 3; i++) L([[0.5, 0.25 + i * 0.25], [0.62, 0.25 + i * 0.25]], i === 1 ? V : PIG.ink, 2); L([[1, 0.5], [0.66, 0.5]], V, 1.4); break;
    case 'saw': L([[0, 0.9], [0.15, 0.4], [0.35, 0.15], [0.35, 0.6], [0.6, 0.35], [0.6, 0.65], [0.85, 0.4], [0.85, 0.7], [1, 0.55]], V, 1.4); break;
    case 'tahoe': L([[0, 0.9], [0.15, 0.5], [0.3, 0.2], [0.3, 0.9], [0.45, 0.6], [0.55, 0.45], [1, 0.25]], V, 1.4); L([[0, 0.55], [1, 0.55]], PIG.ink, 0.8, true); break;
    case 'rtt': L([[0.1, 0], [0.1, 1]]); L([[0.9, 0], [0.9, 1]]); L([[0.1, 0.1], [0.9, 0.3], [0.1, 0.5], [0.9, 0.7], [0.1, 0.9]], V, 1.2); break;
    case 'mail': L([[0, 0.25], [1, 0.25], [1, 0.8], [0, 0.8], [0, 0.25], [0.5, 0.55], [1, 0.25]], V, 1.2); break;
    case 'blocks': for (let i = 0; i < 4; i++) { L([[i * 0.26, 0.4], [i * 0.26 + 0.2, 0.4], [i * 0.26 + 0.2, 0.65], [i * 0.26, 0.65], [i * 0.26, 0.4]], i === 2 ? V : PIG.ink, 1.1); if (i) L([[i * 0.26 - 0.06, 0.3], [i * 0.26 + 0.05, 0.3]], PIG.ochre, 1); } break;
    case 'keys': L([[0.1, 0.4], [0.3, 0.4]], PIG.teal, 4); L([[0.3, 0.4], [0.75, 0.4]], PIG.teal, 1.6); L([[0.1, 0.7], [0.3, 0.7]], PIG.cobalt, 4); L([[0.3, 0.7], [0.75, 0.7]], PIG.cobalt, 1.6); break;
    case 'fragment': L([[0, 0.3], [1, 0.3]], V, 4); L([[0, 0.7], [0.3, 0.7]], V, 4); L([[0.35, 0.7], [0.65, 0.7]], V, 4); L([[0.7, 0.7], [1, 0.7]], V, 4); break;
    case 'cidr': L([[0, 0.5], [0.5, 0.5]], PIG.cobalt, 5); L([[0.52, 0.5], [0.75, 0.5]], PIG.teal, 5); L([[0.77, 0.5], [1, 0.5]], PIG.ochre, 5); L([[0, 0.3], [0.75, 0.3]], PIG.ink, 1, true); break;
    case 'satellite': L([[0.1, 0.9], [0.5, 0.1], [0.9, 0.9]], V, 1.2); L([[0.42, 0.1], [0.58, 0.1]], PIG.ink, 3); break;
    case 'codes': for (let i = 0; i < 7; i++) L([[i / 7 + 0.02, 0.5], [(i + 1) / 7 - 0.02, 0.5]], [0, 1, 3].includes(i) ? PIG.teal : PIG.ink, 5); break;
    case 'ethernet': L([[0.1, 0.1], [0.9, 0.5], [0.1, 0.9]], V, 1.2); L([[0.1, 0.1], [0.1, 0.9]], PIG.ink, 3); break;
    case 'dns': L([[0.5, 0.15], [0.2, 0.5], [0.1, 0.85]]); L([[0.5, 0.15], [0.8, 0.5]]); L([[0.2, 0.5], [0.35, 0.85]]); break;
    case 'mitm': L([[0, 0.5], [0.4, 0.5]], PIG.teal, 1.4); L([[0.6, 0.5], [1, 0.5]], PIG.teal, 1.4); L([[0.42, 0.5], [0.58, 0.5]], PIG.ochre, 4); break;
    case 'auth': L([[0, 0.35], [1, 0.35]], V, 1.2); L([[1, 0.65], [0, 0.65]], PIG.cobalt, 1.2); break;
    case 'physical': L([[0, 0.8], [0.25, 0.8], [0.25, 0.55], [0.5, 0.55], [0.5, 0.2], [0.75, 0.2], [0.75, 0.4], [1, 0.4]], V, 1.4); break;
  }
}
