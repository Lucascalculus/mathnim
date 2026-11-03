// Shared pieces for the formula-and-figure materials (explode, brush, units, ripple, tangle): a fitted 2D canvas,
// a style injector, plane geometry for the layout tests (segments, convex polygons), and the odometer: a number
// drawn as digit wheels that roll continuously and carry the way a mechanical counter does.
import { SANS, SERIF, C, roundrect } from '../../lib/ui.js';
export { SANS, SERIF, C, roundrect };

export const GR = (a) => `rgba(26,27,31,${a})`;
export const rgba = (hex, a) => { const n = parseInt(hex.slice(1), 16); return `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},${a})`; };

export function css_once(id, text) {
  if (document.getElementById(id)) return;
  const st = document.createElement('style'); st.id = id; st.textContent = text; document.head.append(st);
}

export function fit2d(canvas, ctx) {
  const r = canvas.getBoundingClientRect(), dpr = Math.min(2, devicePixelRatio || 1);
  canvas.width = Math.max(2, Math.round(r.width * dpr)); canvas.height = Math.max(2, Math.round(r.height * dpr));
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  return { W: r.width, H: r.height, dpr };
}

// ---- plane geometry (points are [x, y]) ----
const cr = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
// proper or touching intersection of segments ab and cd
export function seg_x(a, b, c, d) {
  const d1 = cr(c, d, a), d2 = cr(c, d, b), d3 = cr(a, b, c), d4 = cr(a, b, d);
  if (((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) && ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0))) return true;
  const on = (p, q, r) => Math.min(p[0], q[0]) - 1e-9 <= r[0] && r[0] <= Math.max(p[0], q[0]) + 1e-9 && Math.min(p[1], q[1]) - 1e-9 <= r[1] && r[1] <= Math.max(p[1], q[1]) + 1e-9;
  return (d1 === 0 && on(c, d, a)) || (d2 === 0 && on(c, d, b)) || (d3 === 0 && on(a, b, c)) || (d4 === 0 && on(a, b, d));
}
// is p inside convex polygon (any winding)?
export function in_poly(p, poly) {
  let s = 0;
  for (let i = 0; i < poly.length; i++) { const c = cr(poly[i], poly[(i + 1) % poly.length], p); if (c !== 0) { if (s === 0) s = Math.sign(c); else if (Math.sign(c) !== s) return false; } }
  return true;
}
export function seg_poly(a, b, poly) {
  if (in_poly(a, poly) || in_poly(b, poly)) return true;
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

// ---- the odometer ----
// A counter value x (continuous, in units of the last shown digit). Wheel k shows floor(x / 10^k) mod 10, and turns
// only while every wheel below it is passing from 9 to 0: the carry of a mechanical counter. So at an integer x every
// wheel rests exactly on a digit, and a wheel is between digits only while it is being carried.
export function wheel(x, k) {
  const p = Math.pow(10, k), q = Math.floor(x / p), below = x - q * p;   // what the lower wheels hold, 0 ≤ below < p
  const carry = k === 0 ? below : Math.max(0, below - (p - 1));         // the last unit of the lower wheels turns this one
  return ((q % 10) + 10) % 10 + carry;                                    // 0 ≤ position < 10 (9.x rolls into 0)
}

css_once('fx-odo', `
.fx-odo{display:inline-flex;align-items:baseline;white-space:nowrap;font-variant-numeric:tabular-nums;vertical-align:baseline}
.fx-odo .w{position:relative;display:inline-block;overflow:hidden;height:1.06em;line-height:1.06em;vertical-align:-0.22em;transition:width .28s cubic-bezier(.16,1,.3,1);
  -webkit-mask-image:linear-gradient(transparent 0,#000 14%,#000 86%,transparent 100%);mask-image:linear-gradient(transparent 0,#000 14%,#000 86%,transparent 100%)}
.fx-odo .w .s{position:absolute;left:0;right:0;top:0;will-change:transform}
.fx-odo .w .ph{visibility:hidden}
.fx-odo .w .s i{display:block;height:1.06em;font-style:normal;text-align:center}
.fx-odo .f{display:inline-block}
.fx-odo .w.blur .s{filter:blur(.06em);opacity:.5}
`);

// A DOM odometer. fmt: { places (digits after the point), group (thousands separator), min_int (int digits kept) }.
// set(x) takes the value in real units; each wheel's strip is moved to its exact wheel() position.
export class Odometer {
  constructor(el, o = {}) {
    this.el = el; this.places = o.places || 0; this.group = o.group ?? ','; this.min_int = o.min_int || 1; this.max_int = o.max_int || 6;
    this.suffix = o.suffix || ''; el.classList.add('fx-odo'); el.innerHTML = '';
    this.wheels = []; this.seps = [];
    const n = this.max_int + this.places;
    // wheels from the highest place down; a point before the decimals; separators every three integer places
    for (let i = n - 1; i >= 0; i--) {
      const w = document.createElement('span'); w.className = 'w';
      const s = document.createElement('span'); s.className = 's';
      s.innerHTML = Array.from({ length: 11 }, (_, d) => `<i>${d % 10}</i>`).join('');
      const ph = document.createElement('span'); ph.className = 'ph'; ph.textContent = '0';
      w.append(ph, s); el.append(w); this.wheels[i] = { w, s, pos: 0, shown: true };
      const int_place = i - this.places;
      if (this.places && i === this.places) { const f = document.createElement('span'); f.className = 'f'; f.textContent = '.'; el.append(f); }
      if (this.group && int_place > 0 && int_place % 3 === 0) { const f = document.createElement('span'); f.className = 'f sep'; f.textContent = this.group; el.append(f); this.seps.push({ f, place: int_place }); }
    }
    if (this.suffix) { const f = document.createElement('span'); f.className = 'f'; f.textContent = this.suffix; el.append(f); }
    this.x = NaN; this.digit_w = 0;
  }
  measure() { const i = this.wheels[0].s.querySelector('i'); const w = i.getBoundingClientRect().width; if (w) this.digit_w = w; }
  // how many integer wheels show: as many as the larger of the two integers the counter is between
  // x in counter units; the integer wheels shown are those of the larger of the two counts x lies between
  int_digits(x) { const hi = Math.ceil(Math.abs(x) - 1e-9), p = Math.pow(10, this.places); return Math.max(this.min_int, String(Math.floor(hi / p)).length); }
  set(value) {
    const x = Math.round(value * Math.pow(10, this.places) * 1e6) / 1e6;   // counter units, rounded off float dust
    if (x === this.x) { if (this.blurred) { this.blurred = false; for (const W of this.wheels) W.w.classList.remove('blur'); } return; }
    const dx = Math.abs(x - (isNaN(this.x) ? x : this.x)); this.x = x;
    if (!this.digit_w) this.measure();
    const show = this.int_digits(x) + this.places;
    for (let k = 0; k < this.wheels.length; k++) {
      const W = this.wheels[k], pos = wheel(Math.max(0, x), k); W.pos = pos;
      // a wheel turning faster than half a digit per frame is a blur, as a real drum is
      const fast = dx / Math.pow(10, k) > 0.5; if (fast !== W.w.classList.contains('blur')) W.w.classList.toggle('blur', fast); if (fast) this.blurred = true;
      W.s.style.transform = `translateY(${(-pos * 1.06).toFixed(5)}em)`;
      const on = k < show; if (on !== W.shown) { W.shown = on; W.w.style.width = on ? '' : '0px'; W.w.style.opacity = on ? '1' : '0'; }
    }
    for (const s of this.seps) s.f.style.display = s.place < show - this.places ? '' : 'none';
  }
  // the digits the wheels rest on (null if any shown wheel is between digits)
  reading() {
    let out = '';
    for (let k = this.wheels.length - 1; k >= 0; k--) {
      const W = this.wheels[k]; if (!W.shown) continue;
      if (Math.abs(W.pos - Math.round(W.pos)) > 1e-6) return null;
      out += String(Math.round(W.pos) % 10);
      if (this.places && k === this.places) out += '.';
    }
    return out;
  }
}
