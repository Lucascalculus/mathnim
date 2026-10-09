// 2D geometry for interaction primitives (web extension, see docs/EXTENSIONS.md).
//
// Pure functions on [x, y, z] points (z is ignored and returned as 0), plus a
// few helpers that read mobject outlines. Used by dragdrop, cut and stamp.
import type { Mobject } from '../mobject/mobject';
import { VMobject } from '../mobject/types/vectorized_mobject';
import type { Point3D, Point3DLike } from '../utils/vector';

/** Axis-aligned box [xmin, xmax, ymin, ymax]. */
export type Box = [number, number, number, number];

const EPS = 1e-9;
const clamp01 = (x: number) => Math.min(1, Math.max(0, x));

/** Even-odd point-in-polygon test (the polygon is a list of vertices, not closed). */
export function point_in_polygon(p: Point3DLike, poly: readonly Point3DLike[]): boolean {
  let c = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i], b = poly[j];
    if (a[1] > p[1] !== b[1] > p[1] && p[0] < ((b[0] - a[0]) * (p[1] - a[1])) / (b[1] - a[1]) + a[0]) c = !c;
  }
  return c;
}

/** Signed area (shoelace): positive for counter-clockwise vertex order. */
export function polygon_area(poly: readonly Point3DLike[]): number {
  let s = 0;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) s += (poly[j][0] * poly[i][1] - poly[i][0] * poly[j][1]);
  return s / 2;
}

/** Area centroid of a simple polygon (vertex average for degenerate ones). */
export function polygon_centroid(poly: readonly Point3DLike[]): Point3D {
  const A = polygon_area(poly);
  if (Math.abs(A) < EPS) {
    const n = poly.length || 1;
    return [poly.reduce((s, p) => s + p[0], 0) / n, poly.reduce((s, p) => s + p[1], 0) / n, 0];
  }
  let cx = 0, cy = 0;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const f = poly[j][0] * poly[i][1] - poly[i][0] * poly[j][1];
    cx += (poly[j][0] + poly[i][0]) * f;
    cy += (poly[j][1] + poly[i][1]) * f;
  }
  return [cx / (6 * A), cy / (6 * A), 0];
}

/** Closest point to p on segment ab. */
export function closest_on_segment(p: Point3DLike, a: Point3DLike, b: Point3DLike): Point3D {
  const dx = b[0] - a[0], dy = b[1] - a[1], L2 = dx * dx + dy * dy;
  const t = L2 > EPS ? clamp01(((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / L2) : 0;
  return [a[0] + t * dx, a[1] + t * dy, 0];
}

/** Distance from p to segment ab. */
export function distance_to_segment(p: Point3DLike, a: Point3DLike, b: Point3DLike): number {
  const q = closest_on_segment(p, a, b);
  return Math.hypot(q[0] - p[0], q[1] - p[1]);
}

/** Distance from p to a polygon's boundary. */
export function distance_to_outline(p: Point3DLike, poly: readonly Point3DLike[]): number {
  let best = Infinity;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) best = Math.min(best, distance_to_segment(p, poly[j], poly[i]));
  return best;
}

/** 0 inside the polygon, else the distance to its boundary. */
export function polygon_distance(p: Point3DLike, poly: readonly Point3DLike[]): number {
  return point_in_polygon(p, poly) ? 0 : distance_to_outline(p, poly);
}

/** Bounding box of points. */
export function points_box(pts: readonly Point3DLike[]): Box {
  let xmin = Infinity, xmax = -Infinity, ymin = Infinity, ymax = -Infinity;
  for (const p of pts) {
    xmin = Math.min(xmin, p[0]);
    xmax = Math.max(xmax, p[0]);
    ymin = Math.min(ymin, p[1]);
    ymax = Math.max(ymax, p[1]);
  }
  return [xmin, xmax, ymin, ymax];
}

/** 0 inside the box, else the distance to it. */
export function box_distance(p: Point3DLike, b: Box): number {
  const dx = Math.max(b[0] - p[0], 0, p[0] - b[1]);
  const dy = Math.max(b[2] - p[1], 0, p[1] - b[3]);
  return Math.hypot(dx, dy);
}

/** Corners of a box, counter-clockwise from bottom-left. */
export function box_polygon(b: Box): Point3D[] {
  return [[b[0], b[2], 0], [b[1], b[2], 0], [b[1], b[3], 0], [b[0], b[3], 0]];
}

/** Which side of the directed line a -> b the point is on: > 0 left, < 0 right (twice the triangle area). */
export function side_of_line(p: Point3DLike, a: Point3DLike, b: Point3DLike): number {
  return (b[0] - a[0]) * (p[1] - a[1]) - (b[1] - a[1]) * (p[0] - a[0]);
}

/** Intersection of segments ab and cd, or null. */
export function segment_intersection(a: Point3DLike, b: Point3DLike, c: Point3DLike, d: Point3DLike): Point3D | null {
  const r = [b[0] - a[0], b[1] - a[1]], s = [d[0] - c[0], d[1] - c[1]];
  const den = r[0] * s[1] - r[1] * s[0];
  if (Math.abs(den) < EPS) return null;
  const t = ((c[0] - a[0]) * s[1] - (c[1] - a[1]) * s[0]) / den;
  const u = ((c[0] - a[0]) * r[1] - (c[1] - a[1]) * r[0]) / den;
  if (t < -EPS || t > 1 + EPS || u < -EPS || u > 1 + EPS) return null;
  return [a[0] + t * r[0], a[1] + t * r[1], 0];
}

/** Number of times segment ab crosses the polygon's boundary. */
export function segment_crossings(poly: readonly Point3DLike[], a: Point3DLike, b: Point3DLike): number {
  let n = 0;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) if (segment_intersection(a, b, poly[j], poly[i])) n++;
  return n;
}

// ---------------------------------------------------------------- mobjects

/** Bounding box of a mobject and its family (null when it has no points). */
export function mobject_box(m: Mobject): Box | null {
  let xmin = Infinity, xmax = -Infinity, ymin = Infinity, ymax = -Infinity;
  for (const f of m.get_family()) {
    const pts = f.points;
    for (let i = 0; i < pts.length; i += 3) {
      if (pts[i] < xmin) xmin = pts[i];
      if (pts[i] > xmax) xmax = pts[i];
      if (pts[i + 1] < ymin) ymin = pts[i + 1];
      if (pts[i + 1] > ymax) ymax = pts[i + 1];
    }
  }
  return xmin === Infinity ? null : [xmin, xmax, ymin, ymax];
}

/**
 * Outline of a VMobject as polygons, one per subpath: Bezier curves are
 * sampled (`samples_per_curve`), straight segments keep only their ends.
 */
export function vmobject_outlines(vm: VMobject, samples_per_curve = 12): Point3D[][] {
  return outlines(vm, samples_per_curve).map((o) => o.pts);
}

/** Subpath polygons and whether each was closed (its last point back on its first). */
function outlines(vm: VMobject, samples_per_curve: number): { pts: Point3D[]; closed: boolean }[] {
  const out: Point3D[][] = [];
  const pts = vm.points;
  const n = pts.length / 3;
  const k = vm.n_points_per_cubic_curve ?? 4;
  let cur: Point3D[] = [];
  const P = (i: number): Point3D => [pts[3 * i], pts[3 * i + 1], 0];
  const same = (p: Point3D, q: Point3D) => Math.abs(p[0] - q[0]) < 1e-7 && Math.abs(p[1] - q[1]) < 1e-7;
  for (let i = 0; i + k <= n; i += k) {
    const a = P(i), b = P(i + 1), c = P(i + 2), d = P(i + 3);
    if (cur.length && !same(cur[cur.length - 1], a)) {
      out.push(cur);
      cur = [];
    }
    if (!cur.length) cur.push(a);
    // a straight segment has its handles on the chord
    const straight = distance_to_segment(b, a, d) < 1e-6 && distance_to_segment(c, a, d) < 1e-6;
    const s = straight ? 1 : samples_per_curve;
    for (let j = 1; j <= s; j++) {
      const t = j / s, u = 1 - t;
      const q: Point3D = [
        u * u * u * a[0] + 3 * u * u * t * b[0] + 3 * u * t * t * c[0] + t * t * t * d[0],
        u * u * u * a[1] + 3 * u * u * t * b[1] + 3 * u * t * t * c[1] + t * t * t * d[1],
        0,
      ];
      if (!same(q, cur[cur.length - 1])) cur.push(q);
    }
  }
  if (cur.length) out.push(cur);
  // drop the closing duplicate of closed subpaths
  return out
    .map((poly) => {
      const closed = poly.length > 2 && same(poly[0], poly[poly.length - 1]);
      if (closed) poly.pop();
      return { pts: poly, closed };
    })
    .filter((o) => o.pts.length >= 2);
}

/**
 * A closed VMobject (Circle, Sector, Square, Polygon...) approximated as one
 * polygon: its first subpath, or the first family member that has points.
 */
export function vmobject_to_polygon(m: Mobject, samples_per_curve = 12): Point3D[] {
  for (const f of m.get_family()) {
    if (f instanceof VMobject && f.points.length) {
      const polys = vmobject_outlines(f, samples_per_curve);
      if (polys.length) return polys[0];
    }
  }
  return [];
}

/**
 * Distance from p to what is drawn of a mobject (any family member): 0 inside
 * a filled shape or on a stroke, else the distance to the nearest outline or
 * stroke edge; the box for non-vector mobjects. Members farther than `max`
 * (in their bounding box) are skipped; Infinity when nothing is within reach.
 */
export function mobject_distance(m: Mobject, p: Point3DLike, max = Infinity): number {
  let best = Infinity;
  for (const f of m.get_family()) {
    if (!f.points.length) continue;
    const b = mobject_box(f)!;
    const bd = box_distance(p, b);
    if (bd > Math.min(max, best)) continue;
    if (!(f instanceof VMobject)) {
      best = Math.min(best, bd);
      continue;
    }
    const filled = f.get_fill_opacity() > 0.05;
    const stroked = f.get_stroke_opacity() > 0.05 && f.get_stroke_width() > 0;
    if (!filled && !stroked) continue;
    const polys = outlines(f, 8);
    if (filled && polys.some((o) => o.pts.length >= 3 && point_in_polygon(p, o.pts))) return 0;
    const half = stroked ? (f.get_stroke_width() * 0.01) / 2 : 0;
    for (const { pts: poly, closed } of polys) {
      let d = Infinity;
      for (let i = 1; i < poly.length; i++) d = Math.min(d, distance_to_segment(p, poly[i - 1], poly[i]));
      if ((closed || filled) && poly.length >= 3) d = Math.min(d, distance_to_segment(p, poly[poly.length - 1], poly[0]));
      best = Math.min(best, Math.max(0, d - half));
    }
  }
  return best;
}

/** Is p on the mobject (see mobject_distance), within `tol` scene units? */
export function mobject_contains(m: Mobject, p: Point3DLike, tol = 0): boolean {
  return mobject_distance(m, p, tol) <= tol;
}
