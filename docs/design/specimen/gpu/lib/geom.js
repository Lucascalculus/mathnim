// Plane geometry (points are [x, y]): what the layout tests need to prove that leaders, labels and glyphs never
// cross, and an element's box in the coordinates of its container.
const cr = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
// proper or touching intersection of segments ab and cd
export function seg_x(a, b, c, d) {
  const d1 = cr(c, d, a), d2 = cr(c, d, b), d3 = cr(a, b, c), d4 = cr(a, b, d);
  if (((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) && ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0))) return true;
  const on = (p, q, r) => Math.min(p[0], q[0]) - 1e-9 <= r[0] && r[0] <= Math.max(p[0], q[0]) + 1e-9 && Math.min(p[1], q[1]) - 1e-9 <= r[1] && r[1] <= Math.max(p[1], q[1]) + 1e-9;
  return (d1 === 0 && on(c, d, a)) || (d2 === 0 && on(c, d, b)) || (d3 === 0 && on(a, b, c)) || (d4 === 0 && on(a, b, d));
}
// is p inside a convex polygon (any winding)?
function in_convex(p, poly) {
  let s = 0;
  for (let i = 0; i < poly.length; i++) { const c = cr(poly[i], poly[(i + 1) % poly.length], p); if (c !== 0) { if (s === 0) s = Math.sign(c); else if (Math.sign(c) !== s) return false; } }
  return true;
}
export function seg_poly(a, b, poly) {
  if (in_convex(a, poly) || in_convex(b, poly)) return true;
  for (let i = 0; i < poly.length; i++) if (seg_x(a, b, poly[i], poly[(i + 1) % poly.length])) return true;
  return false;
}
// convex polygons overlap (separating axis)
export function poly_x(P, Q) {
  for (const S of [P, Q]) for (let i = 0; i < S.length; i++) {
    const a = S[i], b = S[(i + 1) % S.length], n = [b[1] - a[1], a[0] - b[0]];
    let p0 = Infinity, p1 = -Infinity, q0 = Infinity, q1 = -Infinity;
    for (const v of P) { const d = v[0] * n[0] + v[1] * n[1]; p0 = Math.min(p0, d); p1 = Math.max(p1, d); }
    for (const v of Q) { const d = v[0] * n[0] + v[1] * n[1]; q0 = Math.min(q0, d); q1 = Math.max(q1, d); }
    if (p1 < q0 || q1 < p0) return false;
  }
  return true;
}
export const rect_poly = (x, y, w, h, m = 0) => [[x - m, y - m], [x + w + m, y - m], [x + w + m, y + h + m], [x - m, y + h + m]];
// grow a convex polygon about its centroid by m pixels (approximately, by pushing vertices outward)
export function grow(poly, m) {
  const cx = poly.reduce((s, p) => s + p[0], 0) / poly.length, cy = poly.reduce((s, p) => s + p[1], 0) / poly.length;
  return poly.map(([x, y]) => { const d = Math.hypot(x - cx, y - cy) || 1; return [x + (x - cx) / d * m, y + (y - cy) / d * m]; });
}
// the point of a convex polygon's boundary nearest to p
export function nearest_on(poly, p) {
  let best = null, bd = Infinity;
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i], b = poly[(i + 1) % poly.length], dx = b[0] - a[0], dy = b[1] - a[1];
    const t = Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / (dx * dx + dy * dy || 1)));
    const q = [a[0] + dx * t, a[1] + dy * t], d = Math.hypot(q[0] - p[0], q[1] - p[1]);
    if (d < bd) { bd = d; best = q; }
  }
  return best;
}
export function hull(pts) {
  const p = pts.slice().sort((a, b) => a[0] - b[0] || a[1] - b[1]), lo = [], up = [];
  for (const q of p) { while (lo.length >= 2 && cr(lo[lo.length - 2], lo[lo.length - 1], q) <= 0) lo.pop(); lo.push(q); }
  for (const q of p.reverse()) { while (up.length >= 2 && cr(up[up.length - 2], up[up.length - 1], q) <= 0) up.pop(); up.push(q); }
  return lo.slice(0, -1).concat(up.slice(0, -1));
}

// an element's box in the coordinates of a container (CSS px)
export function box_in(el, wrap) {
  const r = el.getBoundingClientRect(), w = wrap.getBoundingClientRect();
  return { x: r.left - w.left, y: r.top - w.top, w: r.width, h: r.height, cx: r.left - w.left + r.width / 2, cy: r.top - w.top + r.height / 2 };
}
export const inside_box = (b, x, y, pad = 0) => x >= b.x - pad && x <= b.x + b.w + pad && y >= b.y - pad && y <= b.y + b.h + pad;
