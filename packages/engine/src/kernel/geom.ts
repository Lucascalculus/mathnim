// Small geometry: boxes in CSS pixels (y down), segments, and the 2D context type the renderer draws with (the
// browser's, or @napi-rs/canvas's in node).

export type XY = [number, number];
export interface Box { x: number; y: number; w: number; h: number }
export type Ctx2D = CanvasRenderingContext2D;

export const box = (x: number, y: number, w: number, h: number): Box => ({ x, y, w, h });
export const right = (b: Box): number => b.x + b.w;
export const bottom = (b: Box): number => b.y + b.h;
export const center = (b: Box): XY => [b.x + b.w / 2, b.y + b.h / 2];
export const inflate = (b: Box, d: number): Box => ({ x: b.x - d, y: b.y - d, w: b.w + 2 * d, h: b.h + 2 * d });
export const contains = (b: Box, p: XY): boolean => p[0] >= b.x && p[0] <= b.x + b.w && p[1] >= b.y && p[1] <= b.y + b.h;
/** Area of the overlap of two boxes (0 when they do not overlap). */
export function overlap(a: Box, b: Box): number {
  const w = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x), h = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);
  return w > 0 && h > 0 ? w * h : 0;
}
export const union = (a: Box, b: Box): Box => {
  const x = Math.min(a.x, b.x), y = Math.min(a.y, b.y);
  return { x, y, w: Math.max(a.x + a.w, b.x + b.w) - x, h: Math.max(a.y + a.h, b.y + b.h) - y };
};
export function bounds_of(pts: readonly XY[]): Box {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const [x, y] of pts) {
    if (x < x0) x0 = x;
    if (y < y0) y0 = y;
    if (x > x1) x1 = x;
    if (y > y1) y1 = y;
  }
  return x0 === Infinity ? { x: 0, y: 0, w: 0, h: 0 } : { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
}
/** Does segment p–q cross box b? (Liang–Barsky) */
export function segment_hits_box(p: XY, q: XY, b: Box): boolean {
  let t0 = 0, t1 = 1;
  const dx = q[0] - p[0], dy = q[1] - p[1];
  const edges: [number, number][] = [[-dx, p[0] - b.x], [dx, b.x + b.w - p[0]], [-dy, p[1] - b.y], [dy, b.y + b.h - p[1]]];
  for (const [pp, qq] of edges) {
    if (pp === 0) {
      if (qq < 0) return false;
    } else {
      const r = qq / pp;
      if (pp < 0) {
        if (r > t1) return false;
        if (r > t0) t0 = r;
      } else {
        if (r < t0) return false;
        if (r < t1) t1 = r;
      }
    }
  }
  return true;
}
export const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;
export const clamp = (x: number, a: number, b: number): number => Math.max(a, Math.min(b, x));

/** About n round tick values covering [lo, hi] (1, 2 or 5 times a power of ten apart). */
export function nice_ticks(lo: number, hi: number, n = 5): number[] {
  const span = hi - lo;
  if (!(span > 0)) return [lo];
  const raw = span / Math.max(1, n), p10 = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 5, 10].map((k) => k * p10).find((s) => s >= raw * 0.999) ?? 10 * p10;
  const out: number[] = [];
  for (let v = Math.ceil(lo / step - 1e-9) * step; v <= hi + step * 1e-9; v += step) out.push(+v.toFixed(10));
  return out;
}

// ---------------------------------------------------------------- convex polygons (what a drawing with cards seen at
// an angle needs to prove that its leaders, labels and glyphs never cross; from the specimen's lib/geom.js)
const cross3 = (o: XY, a: XY, b: XY): number => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
/** Do segments ab and cd cross or touch? */
export function seg_cross(a: XY, b: XY, c: XY, d: XY): boolean {
  const d1 = cross3(c, d, a), d2 = cross3(c, d, b), d3 = cross3(a, b, c), d4 = cross3(a, b, d);
  if (((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) && ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0))) return true;
  const on = (p: XY, q: XY, r: XY) => Math.min(p[0], q[0]) - 1e-9 <= r[0] && r[0] <= Math.max(p[0], q[0]) + 1e-9 && Math.min(p[1], q[1]) - 1e-9 <= r[1] && r[1] <= Math.max(p[1], q[1]) + 1e-9;
  return (d1 === 0 && on(c, d, a)) || (d2 === 0 && on(c, d, b)) || (d3 === 0 && on(a, b, c)) || (d4 === 0 && on(a, b, d));
}
/** Is p inside a convex polygon (either winding)? */
export function in_convex(p: XY, poly: readonly XY[]): boolean {
  let s = 0;
  for (let i = 0; i < poly.length; i++) {
    const c = cross3(poly[i], poly[(i + 1) % poly.length], p);
    if (c !== 0) { if (s === 0) s = Math.sign(c); else if (Math.sign(c) !== s) return false; }
  }
  return true;
}
/** Does segment ab meet a convex polygon? */
export function seg_poly(a: XY, b: XY, poly: readonly XY[]): boolean {
  if (in_convex(a, poly) || in_convex(b, poly)) return true;
  for (let i = 0; i < poly.length; i++) if (seg_cross(a, b, poly[i], poly[(i + 1) % poly.length])) return true;
  return false;
}
/** Do two convex polygons overlap? (separating axes) */
export function poly_cross(P: readonly XY[], Q: readonly XY[]): boolean {
  for (const S of [P, Q]) for (let i = 0; i < S.length; i++) {
    const a = S[i], b = S[(i + 1) % S.length], n = [b[1] - a[1], a[0] - b[0]];
    let p0 = Infinity, p1 = -Infinity, q0 = Infinity, q1 = -Infinity;
    for (const v of P) { const d = v[0] * n[0] + v[1] * n[1]; if (d < p0) p0 = d; if (d > p1) p1 = d; }
    for (const v of Q) { const d = v[0] * n[0] + v[1] * n[1]; if (d < q0) q0 = d; if (d > q1) q1 = d; }
    if (p1 < q0 || q1 < p0) return false;
  }
  return true;
}
/** A box as a polygon, grown by m. */
export const rect_poly = (x: number, y: number, w: number, h: number, m = 0): XY[] => [[x - m, y - m], [x + w + m, y - m], [x + w + m, y + h + m], [x - m, y + h + m]];
/** A convex polygon grown about its centroid by about m (its vertices pushed outward). */
export function grow_poly(poly: readonly XY[], m: number): XY[] {
  const cx = poly.reduce((s, p) => s + p[0], 0) / poly.length, cy = poly.reduce((s, p) => s + p[1], 0) / poly.length;
  return poly.map(([x, y]) => { const d = Math.hypot(x - cx, y - cy) || 1; return [x + ((x - cx) / d) * m, y + ((y - cy) / d) * m] as XY; });
}
/** The point of a convex polygon's boundary nearest p. */
export function nearest_on(poly: readonly XY[], p: XY): XY {
  let best: XY = poly[0], bd = Infinity;
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i], b = poly[(i + 1) % poly.length], dx = b[0] - a[0], dy = b[1] - a[1];
    const t = Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / (dx * dx + dy * dy || 1)));
    const q: XY = [a[0] + dx * t, a[1] + dy * t], d = Math.hypot(q[0] - p[0], q[1] - p[1]);
    if (d < bd) { bd = d; best = q; }
  }
  return best;
}
/** The convex hull of points (monotone chain). */
export function hull(pts: readonly XY[]): XY[] {
  const p = pts.slice().sort((a, b) => a[0] - b[0] || a[1] - b[1]), lo: XY[] = [], up: XY[] = [];
  for (const q of p) { while (lo.length >= 2 && cross3(lo[lo.length - 2], lo[lo.length - 1], q) <= 0) lo.pop(); lo.push(q); }
  for (const q of p.reverse()) { while (up.length >= 2 && cross3(up[up.length - 2], up[up.length - 1], q) <= 0) up.pop(); up.push(q); }
  return lo.slice(0, -1).concat(up.slice(0, -1));
}
/** A polygon's bounding box as [x0, y0, x1, y1]. */
export function poly_bounds(poly: readonly XY[]): [number, number, number, number] {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const [x, y] of poly) { if (x < x0) x0 = x; if (y < y0) y0 = y; if (x > x1) x1 = x; if (y > y1) y1 = y; }
  return [x0, y0, x1, y1];
}
