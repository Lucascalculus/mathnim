// The building blocks' shared kit: ticks that are nice numbers and say exactly as many decimals as they need, a plot
// that maps data to the canvas and draws its scaffolding (fine graphite axes, a dot at each major crossing instead of
// a grid), adaptive sampling of y = f(x) that breaks where the function breaks, the glass bead, and the marks of the
// grammar: hollow → solid, dashed → solid, true arrowheads, right-angle marks, hatching for what is taken away.
import { SANS, SERIF, C, GR, rgba } from './ui.js';

export const TICK = '#62666d';                       // graphite dark enough to read as text (5.7:1 on paper)
export const MINUS = '−';

// ---------- numbers ----------
// the step from 1, 2, 5 × 10^k that gives at most n ticks over span
export function nice_step(span, n) {
  const raw = span / Math.max(1, n), p = Math.pow(10, Math.floor(Math.log10(raw))), m = raw / p;
  return (m <= 1 ? 1 : m <= 2 ? 2 : m <= 5 ? 5 : 10) * p;
}
// decimals a step needs: 0.5 → 1, 0.25 never happens (steps are 1, 2, 5), 20 → 0
export const decimals_of = (step) => Math.max(0, -Math.floor(Math.log10(step) + 1e-9));
// a number as it is printed: a real minus sign, no "-0", exactly dec decimals
export function num(v, dec = 2) {
  const s = Math.abs(v).toFixed(dec);
  return (v < 0 && Number(s) !== 0 ? MINUS : '') + s;
}
// the tick values k·step inside [a, b], computed from integers so they are exact multiples
export function ticks(a, b, step) {
  const out = [], k0 = Math.ceil(a / step - 1e-9), k1 = Math.floor(b / step + 1e-9);
  for (let k = k0; k <= k1; k++) out.push(Number((k * step).toPrecision(12)));
  return out;
}
export const is_nice = (v, step) => Math.abs(v / step - Math.round(v / step)) < 1e-6;

// ---------- text ----------
const FONT = { sans: SANS, serif: SERIF };
export function text(g, s, x, y, o = {}) {
  g.save();
  g.font = `${o.italic ? 'italic ' : ''}${o.weight ?? 500} ${o.size ?? 12}px ${FONT[o.font ?? 'sans']}`;
  g.textAlign = o.align ?? 'left'; g.textBaseline = o.base ?? 'alphabetic';
  if (o.tabular) g.fontVariantNumeric = 'tabular-nums';
  if (o.halo) { g.lineJoin = 'round'; g.lineWidth = o.halo; g.strokeStyle = o.halo_color ?? C.paper; g.strokeText(s, x, y); }
  g.globalAlpha *= o.alpha ?? 1; g.fillStyle = o.color ?? C.ink; g.fillText(s, x, y);
  const w = g.measureText(s).width;
  g.restore();
  return w;
}
// a symbol of mathematics: serif italic, as it is set in a formula
export const sym = (g, s, x, y, o = {}) => text(g, s, x, y, { font: 'serif', italic: true, size: 15, weight: 400, ...o });
export function text_width(g, s, o = {}) {
  g.save(); g.font = `${o.italic ? 'italic ' : ''}${o.weight ?? 500} ${o.size ?? 12}px ${FONT[o.font ?? 'sans']}`;
  const w = g.measureText(s).width; g.restore(); return w;
}

// ---------- colour ----------
const rgb = (hex) => { const n = parseInt(hex.slice(1), 16); return [n >> 16, (n >> 8) & 255, n & 255]; };
// a pigment diluted toward paper: large forms get only a tint
export function tint(hex, t, a = 1) {
  const p = rgb(C.paper), q = rgb(hex);
  return `rgba(${p.map((v, i) => Math.round(v + (q[i] - v) * t)).join(',')},${a})`;
}

// ---------- a plot: data ↔ canvas, and its scaffolding ----------
export class Plot {
  // box in CSS px; x, y the data ranges; equal: one unit is as long on both axes (the box shrinks to keep it)
  constructor(box, x, y, o = {}) { this.o = o; this.set(box, x, y); }
  set(box, x, y) {
    this.box = { ...box }; this.x = x.slice(); this.y = y.slice();
    if (this.o.equal) {
      const sx = box.w / (x[1] - x[0]), sy = box.h / (y[1] - y[0]), s = Math.min(sx, sy);
      const w = s * (x[1] - x[0]), h = s * (y[1] - y[0]);
      this.box.x += (box.w - w) / 2; this.box.y += (box.h - h) / 2; this.box.w = w; this.box.h = h;
    }
    this.sx = this.box.w / (this.x[1] - this.x[0]); this.sy = this.box.h / (this.y[1] - this.y[0]);
    return this;
  }
  X(v) { return this.box.x + (v - this.x[0]) * this.sx; }
  Y(v) { return this.box.y + this.box.h - (v - this.y[0]) * this.sy; }
  P(p) { return [this.X(p[0]), this.Y(p[1])]; }
  ix(px) { return this.x[0] + (px - this.box.x) / this.sx; }
  iy(py) { return this.y[0] + (this.box.y + this.box.h - py) / this.sy; }
  inside(px, py, m = 0) { const b = this.box; return px >= b.x - m && px <= b.x + b.w + m && py >= b.y - m && py <= b.y + b.h + m; }
  clip(g, m = 0) { const b = this.box; g.beginPath(); g.rect(b.x - m, b.y - m, b.w + 2 * m, b.h + 2 * m); g.clip(); }
  // the steps the axes use: as many ticks as fit with room for their labels
  steps() {
    return { x: this.o.x_step ?? nice_step(this.x[1] - this.x[0], Math.max(2, Math.floor(this.box.w / 64))),
             y: this.o.y_step ?? nice_step(this.y[1] - this.y[0], Math.max(2, Math.floor(this.box.h / 44))) };
  }
  // where the axes run: through 0 when 0 is in range, else along the low edge
  axis_at() {
    const ax = this.y[0] <= 0 && this.y[1] >= 0 ? this.Y(0) : this.box.y + this.box.h;
    const ay = this.x[0] <= 0 && this.x[1] >= 0 ? this.X(0) : this.box.x;
    return { ax, ay };
  }
  // the scaffolding: axes, ticks with their numbers, a dot at each major crossing, the axis names in italic.
  // o.avoid: boxes {x, y, w, h} (CSS px) where something else is written; a tick number there gives way
  axes(g, o = {}) {
    const { x: xs, y: ys } = this.steps(), b = this.box, { ax, ay } = this.axis_at();
    const xd = decimals_of(xs), yd = decimals_of(ys), alpha = o.alpha ?? 1, avoid = o.avoid ?? [];
    const free = (x, y, w, h) => !avoid.some((a) => x < a.x + a.w + 3 && x + w > a.x - 3 && y < a.y + a.h + 3 && y + h > a.y - 3);
    g.save(); g.globalAlpha *= alpha;
    // the dot grid: precision without a net over the picture
    if (o.dots !== false) {
      g.fillStyle = GR(0.2);
      for (const u of ticks(this.x[0], this.x[1], xs)) for (const v of ticks(this.y[0], this.y[1], ys)) {
        const px = this.X(u), py = this.Y(v);
        if (Math.abs(py - ax) < 1 || Math.abs(px - ay) < 1) continue;
        g.beginPath(); g.arc(px, py, 0.95, 0, Math.PI * 2); g.fill();
      }
    }
    g.lineWidth = 0.9; g.strokeStyle = rgba(C.graphite, 0.9); g.lineCap = 'butt';
    g.beginPath(); g.moveTo(b.x, ax); g.lineTo(b.x + b.w, ax); g.moveTo(ay, b.y); g.lineTo(ay, b.y + b.h); g.stroke();
    const origin = Math.abs(ax - this.Y(0)) < 0.5 && Math.abs(ay - this.X(0)) < 0.5;
    g.beginPath();
    for (const u of ticks(this.x[0], this.x[1], xs)) { const px = this.X(u); g.moveTo(px, ax); g.lineTo(px, ax + 4); }
    for (const v of ticks(this.y[0], this.y[1], ys)) { const py = this.Y(v); g.moveTo(ay, py); g.lineTo(ay - 4, py); }
    g.stroke();
    if (o.numbers !== false) {
      for (const u of ticks(this.x[0], this.x[1], xs)) {
        if (origin && Math.abs(u) < 1e-12) continue;
        const px = this.X(u), s = num(u, xd), w = text_width(g, s, { size: 11, tabular: true }); if (px < b.x + 4 && ay < b.x + 1) continue;
        if (free(px - w / 2, ax + 8, w, 12)) text(g, s, px, ax + 17, { color: TICK, size: 11, align: 'center', tabular: true, halo: 3 });
      }
      for (const v of ticks(this.y[0], this.y[1], ys)) {
        if (origin && Math.abs(v) < 1e-12) continue;
        const py = this.Y(v), s = num(v, yd), w = text_width(g, s, { size: 11, tabular: true }); if (py > b.y + b.h - 4 && ax > b.y + b.h - 1) continue;
        if (free(ay - 8 - w, py - 5, w, 12)) text(g, s, ay - 8, py + 4, { color: TICK, size: 11, align: 'right', tabular: true, halo: 3 });
      }
      if (origin) text(g, '0', ay - 7, ax + 16, { color: TICK, size: 11, align: 'right', tabular: true, halo: 3 });
    }
    if (o.x_name) sym(g, o.x_name, b.x + b.w + 6, ax + 5, { color: C.ink2, size: 15 });
    if (o.y_name) sym(g, o.y_name, ay + 7, b.y + 6, { color: C.ink2, size: 15 });
    g.restore();
  }
}

// ---------- y = f(x), sampled adaptively ----------
// Each piece of the returned polylines is within tol px of the true curve at its midpoint; where the function is not
// finite, or jumps (still steep at the finest step), the curve is broken rather than joined across the gap. The
// returned array carries .breaks: [x0, x1] brackets (data x) around each break, for the caller to mark its ends.
export function sample(f, a, b, P, o = {}) {
  const tol = o.tol ?? 0.2, depth = o.depth ?? 14, n0 = o.n0 ?? 48, H = P.box.h;
  const lines = []; let cur = [], last_x = null, open_break = null;
  lines.breaks = [];
  const Y = (v) => { const y = P.Y(v); return y > 1e5 ? 1e5 : y < -1e5 ? -1e5 : y; };
  const ok = (v) => Number.isFinite(v);
  const cut = (rec = true) => { if (cur.length > 1) lines.push(cur); if (rec && cur.length && open_break === null) open_break = last_x; if (!rec) open_break = null; cur = []; };
  const put = (x, v) => {
    if (open_break !== null) { lines.breaks.push([open_break, x]); open_break = null; }
    const p = [P.X(x), Y(v)]; const l = cur[cur.length - 1]; if (!l || l[0] !== p[0] || l[1] !== p[1]) cur.push(p); last_x = x;
  };
  function seg(x0, f0, x1, f1, d) {
    const xm = (x0 + x1) / 2, fm = f(xm);
    if (!ok(f0) || !ok(f1) || !ok(fm)) {
      if (d >= depth) { cut(); if (ok(f1)) put(x1, f1); return; }
      seg(x0, f0, xm, fm, d + 1); seg(xm, fm, x1, f1, d + 1); return;
    }
    const p0 = [P.X(x0), Y(f0)], p1 = [P.X(x1), Y(f1)], pm = [P.X(xm), Y(fm)];
    const dx = p1[0] - p0[0], dy = p1[1] - p0[1], L = Math.hypot(dx, dy) || 1;
    const dev = Math.abs((pm[0] - p0[0]) * dy - (pm[1] - p0[1]) * dx) / L;
    // off the plot on both ends and the midpoint: no need for detail there
    const out = (p) => p[1] < P.box.y - H || p[1] > P.box.y + 2 * H;
    if (out(p0) && out(p1) && out(pm) && Math.sign(p0[1] - P.box.y) === Math.sign(p1[1] - P.box.y)) { cut(false); put(x1, f1); return; }
    // a jump: many pixels apart, and the midpoint sits with one end instead of between them (a smooth piece, however
    // steep, is straight at a small enough step, so its midpoint is halfway)
    const r = Math.abs(dy) > 1e-9 ? (pm[1] - p0[1]) / dy : 0.5;
    const jumpish = Math.abs(dy) > Math.max(3, tol * 8) && (r < 0.25 || r > 0.75);
    if ((dev > tol || jumpish) && d < depth) { seg(x0, f0, xm, fm, d + 1); seg(xm, fm, x1, f1, d + 1); return; }
    if (jumpish) { cut(); put(x1, f1); return; }   // still a jump at the finest step: the function breaks here
    put(x1, f1);
  }
  const h = (b - a) / n0; let x0 = a, f0 = f(a);
  if (ok(f0)) put(x0, f0);
  for (let i = 1; i <= n0; i++) { const x1 = a + i * h, f1 = f(x1); seg(x0, f0, x1, f1, 0); x0 = x1; f0 = f1; }
  cut();
  return lines;
}
export function polyline(g, pts) { g.beginPath(); pts.forEach((p, i) => (i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1]))); }
export function stroke_lines(g, lines, color, w = 2, o = {}) {
  g.save(); g.lineCap = 'round'; g.lineJoin = 'round'; g.lineWidth = w; g.strokeStyle = color; g.globalAlpha *= o.alpha ?? 1;
  for (const l of lines) { polyline(g, l); g.stroke(); }
  g.restore();
}

// ---------- marks ----------
const dpr_of = (g) => g.getTransform().a || 1;
// glass: where your hand is. The chevrons say which ways it moves: 'xy' (any), an angle in radians (along a line)
export function glass_bead(g, x, y, R = 12, lift = 0, o = {}) {
  const d = dpr_of(g);
  g.save(); g.globalAlpha *= o.alpha ?? 1;
  g.shadowColor = GR(0.2 + 0.08 * lift); g.shadowBlur = (9 + 8 * lift) * d; g.shadowOffsetY = (3 + 3 * lift) * d;
  g.beginPath(); g.arc(x, y, R, 0, Math.PI * 2);
  const gr = g.createLinearGradient(x, y - R, x, y + R);
  gr.addColorStop(0, 'rgba(255,255,255,0.95)'); gr.addColorStop(1, 'rgba(255,255,255,0.62)');
  g.fillStyle = gr; g.fill(); g.shadowColor = 'transparent';
  g.lineWidth = 0.75; g.strokeStyle = GR(0.2); g.stroke();
  g.beginPath(); g.arc(x, y, R - 1.2, Math.PI * 1.1, Math.PI * 1.9); g.lineWidth = 1.1; g.strokeStyle = '#fff'; g.stroke();
  if (o.core) { g.beginPath(); g.arc(x, y, 2.6, 0, Math.PI * 2); g.fillStyle = o.core; g.fill(); }
  const dir = o.dir ?? 'xy', angles = dir === 'xy' ? [0, Math.PI / 2, Math.PI, Math.PI * 1.5] : [dir, dir + Math.PI];
  for (const a of angles) {
    const cx = x + Math.cos(a) * (R - 4.5), cy = y + Math.sin(a) * (R - 4.5);
    g.beginPath(); g.moveTo(cx - Math.cos(a) * 2.2 - Math.sin(a) * 2.4, cy - Math.sin(a) * 2.2 + Math.cos(a) * 2.4); g.lineTo(cx, cy); g.lineTo(cx - Math.cos(a) * 2.2 + Math.sin(a) * 2.4, cy - Math.sin(a) * 2.2 - Math.cos(a) * 2.4);
    g.lineWidth = 1.1; g.lineCap = 'round'; g.lineJoin = 'round'; g.strokeStyle = GR(0.42); g.stroke();
  }
  g.restore();
}
// guessed or not included (k = 0, hollow) → true or included (k = 1, solid): the ring fills from its edge inward
export function ring_dot(g, x, y, r, color, k = 1, w = 1.8) {
  g.save();
  g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fillStyle = C.paper; g.fill();
  if (k > 0.01) { g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.arc(x, y, Math.max(0, r * (1 - k)), 0, Math.PI * 2, true); g.fillStyle = color; g.fill(); }
  g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.lineWidth = w; g.strokeStyle = color; g.stroke();
  g.restore();
}
// approximate (k = 0, dashed) → exact (k = 1, solid): the dashes close up
export function stroke_prov(g, path, color, k, w = 1.6, alpha = 1) {
  g.save(); g.lineCap = k > 0.98 ? 'round' : 'butt'; g.lineJoin = 'round'; g.lineWidth = w; g.strokeStyle = color; g.globalAlpha *= alpha;
  if (k < 0.98) g.setLineDash([4 + 26 * k * k, 4 - 3.4 * k]);
  path(); g.stroke(); g.restore();
}
// an arrow with a true head: the shaft stops where the head begins, the head's back is slightly concave
export function arrow(g, x0, y0, x1, y1, color, w = 2, head = 9) {
  const L = Math.hypot(x1 - x0, y1 - y0); if (L < 0.5) return;
  const ux = (x1 - x0) / L, uy = (y1 - y0) / L, hl = Math.min(head, L * 0.6), hw = hl * 0.42;
  const bx = x1 - ux * hl, by = y1 - uy * hl;
  g.save(); g.strokeStyle = color; g.fillStyle = color; g.lineWidth = w; g.lineCap = 'round';
  g.beginPath(); g.moveTo(x0, y0); g.lineTo(bx + ux * 0.5, by + uy * 0.5); g.stroke();
  g.beginPath(); g.moveTo(x1, y1); g.lineTo(bx - uy * hw, by + ux * hw); g.lineTo(bx + ux * hl * 0.18, by + uy * hl * 0.18); g.lineTo(bx + uy * hw, by - ux * hw); g.closePath(); g.fill();
  g.restore();
}
// the small square at a right angle: corner p, directions u and v (unit, canvas space)
export function right_angle(g, p, u, v, s = 8, color = GR(0.55)) {
  g.save(); g.strokeStyle = color; g.lineWidth = 0.9; g.lineJoin = 'miter';
  g.beginPath(); g.moveTo(p[0] + u[0] * s, p[1] + u[1] * s); g.lineTo(p[0] + (u[0] + v[0]) * s, p[1] + (u[1] + v[1]) * s); g.lineTo(p[0] + v[0] * s, p[1] + v[1] * s); g.stroke();
  g.restore();
}
// what is taken away or left over: graphite hatching inside a path
export function hatch(g, path, o = {}) {
  const sp = o.spacing ?? 5, a = o.angle ?? -Math.PI / 4, c = Math.cos(a), s = Math.sin(a);
  g.save(); path(); g.clip();
  const W = g.canvas.width, H = g.canvas.height, R = Math.hypot(W, H);
  g.strokeStyle = o.color ?? GR(0.32); g.lineWidth = o.width ?? 0.8; g.beginPath();
  for (let t = -R; t < R; t += sp) { const x = -s * t, y = c * t; g.moveTo(x - c * R, y - s * R); g.lineTo(x + c * R, y + s * R); }
  g.stroke(); g.restore();
}

// ---------- dragging ----------
// Things that can be held, nearest first within their reach. Each item: { hit(x, y) → distance or Infinity,
// down(x, y), move(x, y), up() }. Hover lifts a bead; the cursor says it can be held.
export function drags(el, items, on = {}) {
  const st = { hover: null, active: null };
  const at = (e) => { const r = el.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };
  const pick = (x, y) => { let best = null, bd = Infinity; for (const it of items()) { const d = it.hit(x, y); if (d < bd) { bd = d; best = it; } } return best; };
  el.addEventListener('pointerdown', (e) => {
    const [x, y] = at(e), it = pick(x, y); if (!it) return;
    st.active = it; el.setPointerCapture(e.pointerId); el.style.cursor = 'grabbing'; it.down?.(x, y); on.change?.();
  });
  el.addEventListener('pointermove', (e) => {
    const [x, y] = at(e);
    if (st.active) { st.active.move?.(x, y); on.change?.(); return; }
    const it = pick(x, y); if (it !== st.hover) { st.hover = it; el.style.cursor = it ? 'grab' : ''; on.change?.(); }
  });
  const end = () => { if (!st.active) return; st.active.up?.(); st.active = null; el.style.cursor = st.hover ? 'grab' : ''; on.change?.(); };
  el.addEventListener('pointerup', end); el.addEventListener('pointercancel', end);
  el.addEventListener('pointerleave', () => { if (!st.active && st.hover) { st.hover = null; el.style.cursor = ''; on.change?.(); } });
  return st;
}
