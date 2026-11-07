// Each course's world, for the home page's course pictures (from the home-page prototype "平面", Lucas 2026-11-07:
// "我喜欢B平面的那些2D-3D的动画"). The specimen's study models (public/p/0y7r2k8c6i/index.html, "物"): white plaster
// forms under one camera and one high light, ink marks on them, the camera that turns to look straight down (影). One
// small world per course, drawn from its running example. Nothing loops: a world is drawn when its state changes.
// (Plain JS as the specimen writes it; its types are in course_worlds.d.ts.)
export const DPR = Math.min(window.devicePixelRatio || 1, 3);
const P3 = CSS.supports('color', 'color(display-p3 1 0 0)');
export const RM = matchMedia('(prefers-reduced-motion: reduce)').matches;
export const SANS = '-apple-system, BlinkMacSystemFont, "PingFang SC", "Hiragino Sans GB", "Noto Sans SC", sans-serif';
export const PIG = {
  ink: [0.102, 0.106, 0.122], graphite: [0.553, 0.569, 0.596], graphite_t: [0.384, 0.4, 0.427], paper: [0.984, 0.98, 0.969],
  cobalt: [0.17, 0.35, 0.85], ochre: [0.8, 0.54, 0.14], teal: [0.07, 0.54, 0.63], violet: [0.42, 0.31, 0.79],
  viridian: [0.1, 0.54, 0.42], vermilion: [0.93, 0.27, 0.13],
};
export const css = (c, a = 1) => P3
  ? `color(display-p3 ${c[0].toFixed(4)} ${c[1].toFixed(4)} ${c[2].toFixed(4)} / ${a.toFixed(3)})`
  : `rgba(${Math.round(c[0] * 255)},${Math.round(c[1] * 255)},${Math.round(c[2] * 255)},${a.toFixed(3)})`;
export const mix = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
export const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
export const lerp = (a, b, t) => a + (b - a) * t;
export const expo = (t) => (t >= 1 ? 1 : 1 - Math.pow(2, -10 * t));
export const inout = (t) => (t < 0.5 ? 4 * t ** 3 : 1 - Math.pow(-2 * t + 2, 3) / 2);
export const drive = (t) => (t < 0.5 ? 16 * t ** 5 : 1 - Math.pow(-2 * t + 2, 5) / 2);

// ---------- one animation loop; nothing loops by itself ----------
const tweens = new Set(), dirty = new Set();
let raf = 0;
const kick = () => { if (!raf) raf = requestAnimationFrame(frame); };
function frame(t) {
  raf = 0;
  for (const tw of [...tweens]) {
    if (t < tw.t0) continue;
    const u = clamp((t - tw.t0) / tw.dur, 0, 1);
    tw.fn(tw.ease(u), u);
    if (u >= 1) { tweens.delete(tw); tw.done && tw.done(); }
  }
  for (const f of [...dirty]) { dirty.delete(f); f(); }
  if (tweens.size || dirty.size) kick();
}
export function tween(dur, fn, o = {}) { const tw = { t0: performance.now() + (o.delay || 0), dur: RM ? 150 : dur, fn, ease: o.ease || expo, done: o.done }; tweens.add(tw); kick(); return tw; }
export const stop = (tw) => tw && tweens.delete(tw);
export function redraw(f) { dirty.add(f); kick(); }
export function setup(canvas, w, h) {
  canvas.width = Math.round(w * DPR); canvas.height = Math.round(h * DPR);
  canvas.style.width = w + 'px'; canvas.style.height = h + 'px';
  const ctx = canvas._ctx || (canvas._ctx = canvas.getContext('2d', P3 ? { colorSpace: 'display-p3' } : undefined));
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  return ctx;
}
/** A value that follows its target with a short tween: hover, attention, a camera turn. */
export function follower(v, paint) {
  const o = { v, to: v, tw: null };
  o.set = (to, dur = 380, ease = expo) => {
    if (to === o.to) return; o.to = to; stop(o.tw);
    const from = o.v; o.tw = tween(dur, (e) => { o.v = lerp(from, to, e); paint(); }, { ease });
  };
  return o;
}

// ---------- marks ----------
export const poly = (ctx, pts, close) => () => { ctx.beginPath(); pts.forEach((p, i) => (i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]))); if (close) ctx.closePath(); };
export const seg = (ctx, x0, y0, x1, y1) => () => { ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); };
export function stroke_ink(ctx, path, pigment, w, alpha = 1) {
  ctx.save(); ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.lineWidth = w; ctx.strokeStyle = css(pigment, alpha); path(); ctx.stroke(); ctx.restore();
}
export const stroke_faint = (ctx, path, w = 0.7, alpha = 0.55) => stroke_ink(ctx, path, PIG.graphite, w, alpha);
// predicted (k = 0, dashed) becomes what happened (k = 1, solid): the dashes close up
export function stroke_prov(ctx, path, pigment, k, w, alpha = 1) {
  ctx.save(); ctx.lineCap = k > 0.98 ? 'round' : 'butt'; ctx.lineJoin = 'round'; ctx.lineWidth = w; ctx.strokeStyle = css(pigment, alpha);
  if (k < 0.98) ctx.setLineDash([lerp(4, 30, k * k), lerp(4, 0.6, k)]);
  path(); ctx.stroke(); ctx.restore();
}
// guessed (k = 0, hollow) becomes true (k = 1, solid): the ring fills from its edge inward
export function ring_dot(ctx, x, y, r, pigment, k, w = 1.8) {
  ctx.save();
  ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fillStyle = 'rgba(255,255,255,0.92)'; ctx.fill();
  if (k > 0.01) { ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.arc(x, y, Math.max(0, r * (1 - k)), 0, Math.PI * 2, true); ctx.fillStyle = css(pigment); ctx.fill(); }
  ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.lineWidth = w; ctx.strokeStyle = css(pigment); ctx.stroke();
  ctx.restore();
}
export function label(ctx, text, x, y, pigment, size = 12, weight = 500, align = 'left', base = 'alphabetic', alpha = 1) {
  ctx.save(); ctx.font = `${weight} ${size}px ${SANS}`; ctx.textAlign = align; ctx.textBaseline = base;
  ctx.fillStyle = css(pigment, alpha); ctx.fillText(text, x, y); ctx.restore();
}
export function dim2(ctx, p, q, text, off = 16, alpha = 0.8) {
  stroke_ink(ctx, seg(ctx, p[0], p[1], q[0], q[1]), PIG.ink, 0.75, alpha);
  const an = Math.atan2(q[1] - p[1], q[0] - p[0]);
  for (const [x, y, d] of [[p[0], p[1], 1], [q[0], q[1], -1]]) stroke_ink(ctx, poly(ctx, [[x + d * 5 * Math.cos(an - 0.45), y + d * 5 * Math.sin(an - 0.45)], [x, y], [x + d * 5 * Math.cos(an + 0.45), y + d * 5 * Math.sin(an + 0.45)]]), PIG.ink, 0.75, alpha);
  if (text) label(ctx, text, (p[0] + q[0]) / 2 - Math.sin(an) * off, (p[1] + q[1]) / 2 + Math.cos(an) * off + 4, PIG.ink, 12, 500, 'center', 'alphabetic', alpha);
}

// ---------- study models: white forms, one high light, one camera ----------
export const PLASTER = [0.972, 0.966, 0.952];
const nrm = (v) => { const l = Math.hypot(v[0], v[1], v[2]) || 1; return [v[0] / l, v[1] / l, v[2] / l]; };
export const LIGHT = nrm([-0.35, 1.0, 0.32]);
export const WORLD = { az: -0.5, el: 0.66 };
const v_sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const v_add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const v_mul = (a, s) => [a[0] * s, a[1] * s, a[2] * s];
const v_dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const centroid = (pts) => { const c = [0, 0, 0]; for (const p of pts) { c[0] += p[0]; c[1] += p[1]; c[2] += p[2]; } return [c[0] / pts.length, c[1] / pts.length, c[2] / pts.length]; };
function newell(pts) {
  const n = [0, 0, 0];
  for (let i = 0; i < pts.length; i++) { const a = pts[i], b = pts[(i + 1) % pts.length]; n[0] += (a[1] - b[1]) * (a[2] + b[2]); n[1] += (a[2] - b[2]) * (a[0] + b[0]); n[2] += (a[0] - b[0]) * (a[1] + b[1]); }
  return nrm(n);
}
export function extrude(base, off, o = {}) {
  const top = base.map((p) => v_add(p, off));
  const faces = [{ pts: base.slice() }, { pts: top.slice() }];
  for (let i = 0; i < base.length; i++) { const j = (i + 1) % base.length; faces.push({ pts: [base[i], base[j], top[j], top[i]] }); }
  const pts = [...base, ...top], c = centroid(pts);
  for (const f of faces) { let n = newell(f.pts); if (v_dot(n, v_sub(centroid(f.pts), c)) < 0) n = v_mul(n, -1); f.n = n; }
  return { faces, pts, c, ...o };
}
export const box = (x0, y0, z0, x1, y1, z1, o) => extrude([[x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1]], [0, y1 - y0, 0], o);
export function obox(cx, cz, len, wid, y0, y1, ang, o) {
  const c = Math.cos(ang), s = Math.sin(ang), hl = len / 2, hw = wid / 2;
  return extrude([[-hl, -hw], [hl, -hw], [hl, hw], [-hl, hw]].map(([u, v]) => [cx + u * c - v * s, y0, cz + u * s + v * c]), [0, y1 - y0, 0], o);
}
export function cylinder_y(cx, cz, r, y0, y1, n, o) { const base = []; for (let i = 0; i < n; i++) { const a = i / n * Math.PI * 2; base.push([cx + r * Math.cos(a), y0, cz + r * Math.sin(a)]); } return extrude(base, [0, y1 - y0, 0], o); }
export function camera(az, el) {
  const ca = Math.cos(az), sa = Math.sin(az), ce = Math.cos(el), se = Math.sin(el);
  const cam = { s: 1, ox: 0, oy: 0, view: [sa * ce, se, ca * ce] };
  cam.raw = (q) => { const xr = q[0] * ca - q[2] * sa, zr = q[0] * sa + q[2] * ca; return [xr, -(q[1] * ce - zr * se), zr * ce + q[1] * se]; };
  cam.p = (q) => { const r = cam.raw(q); return [cam.ox + cam.s * r[0], cam.oy + cam.s * r[1], r[2]]; };
  return cam;
}
/** The one camera, turned toward straight above by `top` (0 = the world view, 1 = the plan). */
// the reading view: straight above for what lies flat (a track, a card, a network), front-on for what stands up (a stack, a column)
export const turned = (top = 0, front = false) => { const t = inout(clamp(top, 0, 1)), cam = camera(lerp(WORLD.az, 0, t), lerp(WORLD.el, front ? 0.02 : Math.PI / 2 - 1e-4, t)); cam.shadow = 1 - 0.8 * t; return cam; };
const cast = (p, y0 = 0) => { const t = (p[1] - y0) / LIGHT[1]; return [p[0] - LIGHT[0] * t, y0, p[2] - LIGHT[2] * t]; };
export const with_shadows = (pts) => pts.concat(pts.filter((p) => p[1] > 0.05).map((p) => cast(p)));
export function fit(cam, pts, x, y, w, h, scale_cap = Infinity) {
  let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
  for (const q of pts) { const r = cam.raw(q); x0 = Math.min(x0, r[0]); x1 = Math.max(x1, r[0]); y0 = Math.min(y0, r[1]); y1 = Math.max(y1, r[1]); }
  cam.s = Math.min(w / (x1 - x0), h / (y1 - y0), scale_cap);
  cam.ox = x + (w - cam.s * (x1 - x0)) / 2 - cam.s * x0;
  cam.oy = y + (h - cam.s * (y1 - y0)) / 2 - cam.s * y0;
  return cam;
}
function hull2(P) {
  const p = P.slice().sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const cr = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lo = [], up = [];
  for (const q of p) { while (lo.length >= 2 && cr(lo[lo.length - 2], lo[lo.length - 1], q) <= 0) lo.pop(); lo.push(q); }
  for (const q of p.reverse()) { while (up.length >= 2 && cr(up[up.length - 2], up[up.length - 1], q) <= 0) up.pop(); up.push(q); }
  return lo.slice(0, -1).concat(up.slice(0, -1));
}
function soft_fill(ctx, path, alpha, blur, dx = 0, dy = 0) {
  ctx.save();
  ctx.shadowColor = css(PIG.ink, alpha); ctx.shadowBlur = blur * DPR;
  ctx.shadowOffsetX = (4000 + dx) * DPR; ctx.shadowOffsetY = dy * DPR;
  ctx.translate(-4000, 0); ctx.fillStyle = '#000'; path(); ctx.fill();
  ctx.restore();
}
const shade = (base, n) => { const l = clamp(v_dot(n, LIGHT), 0, 1), s = 0.74 + 0.27 * l; return [base[0] * s, base[1] * s, base[2] * s]; };
export function render(ctx, cam, solids, ground) {
  ground && ground();
  for (const s of solids) {
    if (s.kind === 'wire' || s.shadow === false) continue;
    const c2 = s.pts.map((p) => { const q = cam.p(cast(p)); return [q[0], q[1]]; });
    soft_fill(ctx, poly(ctx, hull2(c2), true), 0.09 * (s.shade ?? 1) * (cam.shadow ?? 1), 9);
    if (Math.min(...s.pts.map((p) => p[1])) < 0.02) {
      const foot = hull2(s.pts.filter((p) => p[1] < 0.02).map((p) => { const q = cam.p(p); return [q[0], q[1]]; }));
      if (foot.length > 2) soft_fill(ctx, poly(ctx, foot, true), 0.2 * (s.shade ?? 1), 2.2, 0.4, 0.8);
    }
  }
  const order = solids.map((s) => ({ s, d: cam.p(s.c)[2] + (s.bias || 0) })).sort((a, b) => a.d - b.d);
  for (const { s } of order) { draw_solid(ctx, cam, s); s.after && s.after(ctx, cam); }
}
function draw_solid(ctx, cam, s) {
  const faces = s.faces.filter((f) => v_dot(f.n, cam.view) > 1e-3).map((f) => ({ f, pp: f.pts.map(cam.p) }));
  faces.sort((a, b) => a.pp.reduce((m, q) => m + q[2], 0) / a.pp.length - b.pp.reduce((m, q) => m + q[2], 0) / b.pp.length);
  const k = s.k ?? 1, a = s.alpha ?? 1;
  for (const { f, pp } of faces) {
    const path = poly(ctx, pp, true);
    if (s.kind === 'wire') { stroke_prov(ctx, path, s.pig ? PIG[s.pig] : PIG.graphite_t, s.solid ?? 0, 0.9, a); continue; }
    const base = s.pig ? mix(PLASTER, PIG[s.pig], k * (s.tint ?? 0.6)) : PLASTER;
    ctx.fillStyle = css(shade(base, f.n), a); path(); ctx.fill();
    ctx.lineWidth = 0.6; ctx.lineJoin = 'round'; ctx.strokeStyle = css(PIG.ink, 0.15 * a); path(); ctx.stroke();
  }
}
export function text3(ctx, cam, s, q, pigment, size = 12, weight = 500, align = 'center', alpha = 1) { const p = cam.p(q); label(ctx, s, p[0], p[1], pigment, size, weight, align, 'alphabetic', alpha); }

// =====================================================================
// One small world per course, drawn from its running example.
// st: { lang, hover (0..1), top (0..1, the camera turned to straight above), parts: [0..1 per unit, learned],
//       pad: [l, t, r, b] }. A part takes its pigment when the unit that names it is learned; the protagonist (named
//       in the course's title) has its colour from the start.
// =====================================================================
const zh = (st) => st.lang === 'zh';
const P = (st, i) => clamp((st.parts?.[i] ?? 0) + (st.hover ?? 0) * 0.18 * (st.parts?.[i] >= 1 ? 0 : 1), 0, 1);
const area = (w, h, st, d = [12, 18, 12, 18]) => { const p = st.pad ?? d; return [p[0], p[1], w - p[0] - p[2], h - p[1] - p[3]]; };

function mpc_solids(o) {
  const S = [];
  const track = box(o.x0, 0, -0.55, 10.0, 0.09, 0.55);
  track.after = (ctx, cam) => {
    for (let m = Math.ceil(o.x0); m <= 10; m++) { const a = cam.p([m, 0.09, 0.55]), b = cam.p([m, 0.09, 0.36]); stroke_ink(ctx, seg(ctx, a[0], a[1], b[0], b[1]), PIG.ink, 0.7, 0.5); }
    const g0 = cam.p([9.5, 0.091, -0.55]), g1 = cam.p([9.5, 0.091, 0.55]);
    stroke_ink(ctx, seg(ctx, g0[0], g0[1], g1[0], g1[1]), o.goal_k > 0.5 ? PIG.viridian : PIG.graphite_t, 1.4, 0.9);
  };
  S.push(track);
  S.push(box(10.0, 0, -0.95, 10.18, 1.2, 0.95, { pig: 'ochre', k: o.wall_k, tint: 0.34, bias: -0.2 }));
  const cart = (p, kind, pig, solid, alpha) => [box(p - 0.92, 0.09, -0.32, p, 0.5, 0.32, { kind, pig, k: 1, solid, alpha, tint: 0.55 })];
  S.push(...cart(o.p, 'model', 'cobalt', 1, 1));
  for (const f of o.fut || []) S.push(...cart(f.p, 'wire', f.pig, f.solid ?? 0, f.alpha));
  return S;
}

export const WORLDS = {
  // the cart on the track, its plan (dashed: predicted), the goal line and the wall
  mpc(ctx, w, h, st) {
    const cam = turned(st.top), p = st.cart ?? 5.4, [x, y, ww, hh] = area(w, h, st, [10, 14, 10, 18]);
    const fut = [{ p: p + 0.95, alpha: 0.9 }, { p: p + 1.8, alpha: 0.65 }].map((f) => ({ ...f, pig: 'cobalt', solid: st.plan_k ?? 0 }));
    fit(cam, st.frame ?? with_shadows(mpc_solids({ x0: 2.4, p: 4, fut: [] }).flatMap((o) => o.pts)), x, y, ww, hh);
    render(ctx, cam, mpc_solids({ x0: 2.4, p, wall_k: P(st, 1), goal_k: P(st, 0) > 0.5 ? 1 : 0, fut }));
    text3(ctx, cam, zh(st) ? '目标' : 'goal', [9.5, 0.1, (st.top ?? 0) > 0.5 ? -0.75 : 0.95], P(st, 0) > 0.5 ? PIG.viridian : PIG.graphite_t, 12, 600);
    if (P(st, 1) > 0.5) text3(ctx, cam, zh(st) ? '墙' : 'wall', [10.1, 1.32, -0.6], PIG.ochre, 12, 600);
    if (st.push) {   // an unknown steady push on the cart (the real-systems unit): dashed until learned
      const kp = P(st, 2), a = cam.p([p - 2.35, 0.3, 0]), b = cam.p([p - 1.05, 0.3, 0]), an = Math.atan2(b[1] - a[1], b[0] - a[0]);
      stroke_prov(ctx, seg(ctx, a[0], a[1], b[0], b[1]), kp > 0.5 ? PIG.teal : PIG.graphite_t, kp, 1.6, 0.9);
      stroke_ink(ctx, poly(ctx, [[b[0] - 7 * Math.cos(an - 0.5), b[1] - 7 * Math.sin(an - 0.5)], b, [b[0] - 7 * Math.cos(an + 0.5), b[1] - 7 * Math.sin(an + 0.5)]]), kp > 0.5 ? PIG.teal : PIG.graphite_t, 1.6, 0.9);
    }
    const d0 = cam.p([p, 0.02, 0.9]), d1 = cam.p([10.0, 0.02, 0.9]);
    if (st.dims !== false) dim2(ctx, d0, d1, (zh(st) ? '距墙 ' : '') + (10 - p).toFixed(1) + (zh(st) ? ' 米' : ' m to the wall'), (st.top ?? 0) > 0.5 ? 14 : -16);
    return cam;
  },
  // a model's layers, one slid out like a drawer: the LoRA adapter beside it
  ft(ctx, w, h, st) {
    const cam = turned(st.top, true), S = [], n = 8, gap = 0.36, [x, y, ww, hh] = area(w, h, st, [12, 22, 12, 12]);
    const lora = P(st, 3);
    for (let i = 0; i < n; i++) {
      const yy = 0.06 + i * gap, dx = i === 5 ? 1.4 : 0;
      S.push(box(dx, yy, 0, 3.4 + dx, yy + 0.12, 2.1, { shade: 0.5, bias: i * 0.01 }));
      if (i === 5) S.push(box(3.5, yy + 0.12, 0.25, 4.65, yy + 0.17, 0.6, { pig: 'violet', k: 1, tint: 0.9, shadow: false, bias: 0.6 }));
    }
    fit(cam, with_shadows(S.flatMap((o) => o.pts)), x, y, ww, hh);
    render(ctx, cam, S);
    text3(ctx, cam, 'LoRA', [4.95, 0.06 + 5 * gap + 0.1, 0.4], PIG.violet, 12.5, 650, 'left', 0.55 + 0.45 * lora);
    return cam;
  },
  // a circle cut into sectors, laid out as a rectangle: πr
  geo(ctx, w, h, st) {
    const cam = turned(st.top), S = [], r = 1.2, n = 12, half = Math.PI / n, th = 0.12, [x, y, ww, hh] = area(w, h, st, [12, 18, 12, 30]);
    const sector = (ax, az, phi, gp, o) => {
      const cx = ax + gp * Math.cos(phi), cz = az + gp * Math.sin(phi), pts = [[cx, 0, cz]];
      for (let i = 0; i <= 6; i++) { const t = phi - half + i / 6 * 2 * half; pts.push([cx + r * Math.cos(t), 0, cz + r * Math.sin(t)]); }
      return extrude(pts, [0, th, 0], o);
    };
    for (let i = 0; i < n; i++) S.push(sector(0, 0, (i + 0.5) * 2 * half, 0.04, { pig: i % 2 ? null : 'teal', k: 1, tint: 0.7 }));
    const arc = Math.PI * r / (n / 2), x0 = r + 0.75, ch = r * Math.cos(half);
    for (let j = 0; j < n / 2; j++) {
      S.push(sector(x0 + (j + 0.5) * arc, -ch / 2, Math.PI / 2, 0.02, { pig: 'teal', k: P(st, 0), tint: 0.7 }));
      S.push(sector(x0 + (j + 1) * arc, ch / 2, -Math.PI / 2, 0.02, {}));
    }
    fit(cam, with_shadows(S.flatMap((o) => o.pts)), x, y, ww, hh);
    render(ctx, cam, S);
    const zd = ch / 2 + 0.75;
    if (st.dims !== false) dim2(ctx, cam.p([x0, 0, zd]), cam.p([x0 + n / 2 * arc + arc / 2, 0, zd]), 'πr', -16);
    return cam;
  },
  // routers on a table, one packet on its way; the hops behind it are drawn, the ones ahead dashed
  it(ctx, w, h, st) {
    const cam = turned(st.top), S = [], [x, y, ww, hh] = area(w, h, st, [12, 22, 12, 12]);
    const N = { A: [0, 1.5], r1: [1.7, 0.25], r2: [1.5, 2.75], r3: [3.4, 1.35], r4: [3.7, 3.2], r5: [5.1, 0.05], r6: [5.4, 2.25], B: [7.0, 1.1] };
    const links = [['A', 'r1'], ['A', 'r2'], ['r1', 'r3'], ['r2', 'r3'], ['r2', 'r4'], ['r3', 'r5'], ['r3', 'r6'], ['r4', 'r6'], ['r5', 'B'], ['r6', 'B'], ['r1', 'r5']];
    const path = ['A', 'r1', 'r3', 'r6', 'B'];
    const done = (st.parts ?? []).reduce((s, v) => s + v, 0) / Math.max(1, (st.parts ?? []).length);
    const along = clamp(0.3 + done * 3.4 + (st.hover ?? 0) * 0.25, 0.05, 3.95), hops = Math.floor(along), packet = along - hops;
    const hop_of = (a, b) => { const i = path.indexOf(a), j = path.indexOf(b); return i >= 0 && j >= 0 && Math.abs(i - j) === 1 ? Math.min(i, j) : -1; };
    for (const [key, [px, pz]] of Object.entries(N)) {
      if (key === 'A' || key === 'B') S.push(box(px - 0.34, 0, pz - 0.24, px + 0.34, 0.42, pz + 0.24));
      else S.push(cylinder_y(px, pz, 0.22, 0, 0.18, 20, {}));
    }
    const [a, b] = [N[path[hops]], N[path[hops + 1]]];
    const qx = lerp(a[0], b[0], packet), qz = lerp(a[1], b[1], packet), ang = Math.atan2(b[1] - a[1], b[0] - a[0]);
    S.push(obox(qx, qz, 0.42, 0.2, 0, 0.16, ang, { pig: 'violet', k: 1, tint: 0.9 }));
    fit(cam, with_shadows(S.flatMap((o) => o.pts)), x, y, ww, hh);
    render(ctx, cam, S, () => {
      for (const [p, q] of links) {
        const hop = hop_of(p, q), A = cam.p([N[p][0], 0, N[p][1]]), B = cam.p([N[q][0], 0, N[q][1]]);
        if (hop >= 0 && hop < hops) stroke_ink(ctx, seg(ctx, A[0], A[1], B[0], B[1]), PIG.violet, 1.6);
        else if (hop >= 0) stroke_prov(ctx, seg(ctx, A[0], A[1], B[0], B[1]), PIG.violet, 0, 1.1, 0.8);
        else stroke_faint(ctx, seg(ctx, A[0], A[1], B[0], B[1]), 0.8, 0.6);
      }
    });
    return cam;
  },
  // a printed card: supply, demand, the tax wedge
  econ(ctx, w, h, st) {
    const cam = turned(st.top), W = 6, Dd = 4.1, card = box(0, 0, 0, W, 0.05, Dd), [x, y, ww, hh] = area(w, h, st, [14, 16, 14, 10]);
    fit(cam, with_shadows(card.pts), x, y, ww, hh);
    render(ctx, cam, [card]);
    const Pp = (q, p) => cam.p([0.55 + q * (W - 1.1), 0.05, Dd - 0.45 - p * (Dd - 0.9)]);
    const L2 = (pts, pigment, wd, alpha) => stroke_ink(ctx, poly(ctx, pts.map(([q, p]) => Pp(q, p))), pigment, wd, alpha);
    const F = (pts, pigment, a) => { ctx.fillStyle = css(pigment, a); poly(ctx, pts.map(([q, p]) => Pp(q, p)), true)(); ctx.fill(); };
    const Dm = (q) => 0.9 - 0.92 * q + 0.2 * q * q, Sp = (q) => 0.1 + 0.7 * q, St = (q) => Sp(q) + 0.2;
    const solve = (f, f2) => { let a = 0, b = 1; for (let i = 0; i < 40; i++) { const m = (a + b) / 2; (f(m) - f2(m) > 0 ? (a = m) : (b = m)); } return (a + b) / 2; };
    const qe = solve(Dm, Sp), pe = Dm(qe), base = 0.25 + 0.75 * P(st, 1);
    const curve = (f, a, b) => Array.from({ length: 41 }, (_, i) => { const q = lerp(a, b, i / 40); return [q, f(q)]; });
    F([[0, Dm(0)], ...curve(Dm, 0, qe), [qe, pe], [0, pe]], PIG.teal, 0.16 * base);
    F([[0, pe], [qe, pe], ...curve(Sp, qe, 0)], PIG.ochre, 0.16 * base);
    ctx.save(); poly(ctx, curve(St, 0, 0.9).map(([q, p]) => Pp(q, p)))(); ctx.setLineDash([4, 4]); ctx.lineWidth = 1; ctx.strokeStyle = css(PIG.graphite_t, 0.9); ctx.stroke(); ctx.restore();
    L2([[0, 1.02], [0, 0], [1.02, 0]], PIG.ink, 1);
    L2(curve(Dm, 0.02, 0.98), PIG.ink, 1.5);
    L2(curve(Sp, 0, 0.98), PIG.ink, 1.5);
    const e = Pp(qe, pe); ring_dot(ctx, e[0], e[1], 4.5, PIG.viridian, 1, 1.4);
    const lb = (t, q, p, pg = PIG.ink) => { const a = Pp(q, p); label(ctx, t, a[0], a[1], pg, 12, 600); };
    lb('P', -0.07, 0.98); lb('Q', 0.98, -0.1); lb('D', 0.99, Dm(0.98) - 0.01); lb('S', 0.99, Sp(0.98)); lb('S + t', 0.91, St(0.9) + 0.02, PIG.graphite_t);
    return cam;
  },
  // labelled examples as small forms on a card, and the line a model draws between them (dashed until learned)
  ml(ctx, w, h, st) {
    const cam = turned(st.top), W = 6, Dd = 4.1, S = [], [x, y, ww, hh] = area(w, h, st, [14, 16, 14, 10]);
    const card = box(0, 0, 0, W, 0.05, Dd); S.push(card);
    let s = 11; const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
    const k1 = P(st, 1), k2 = P(st, 2);
    const cnt = [0, 0];
    for (let i = 0; i < 600 && cnt[0] + cnt[1] < 30; i++) {
      const cx = 0.45 + rnd() * 5.1, cz = 0.4 + rnd() * 3.3, side = cx - (3.0 - (cz - 2.05) * 0.35);
      if (Math.abs(side) < 0.3 || Math.hypot(cx - 3.05, cz - 2.15) < 0.5 || cnt[side < 0 ? 0 : 1] >= 15) continue;
      cnt[side < 0 ? 0 : 1]++;
      S.push(side < 0 ? cylinder_y(cx, cz, 0.13, 0.05, 0.32, 14, { pig: 'cobalt', k: 1, tint: 0.3 + 0.3 * k1 }) : box(cx - 0.12, 0.05, cz - 0.12, cx + 0.12, 0.27, cz + 0.12, { pig: 'ochre', k: 1, tint: 0.3 + 0.3 * k1 }));
    }
    fit(cam, with_shadows(S.flatMap((o) => o.pts)), x, y, ww, hh);
    render(ctx, cam, S, null);
    const a = cam.p([3.6, 0.051, 0.25]), b = cam.p([2.35, 0.051, 3.85]);
    stroke_prov(ctx, seg(ctx, a[0], a[1], b[0], b[1]), PIG.ink, k2, 1.4, 0.85);
    const q = cam.p([3.05, 0.051, 2.15]); ring_dot(ctx, q[0], q[1], 5, PIG.ink, 0, 1.4);
    return cam;
  },
  // what a product is worth: the cost floor, the value ceiling, and a price somewhere between
  value(ctx, w, h, st) {
    const cam = turned(st.top, true), S = [], [x, y, ww, hh] = area(w, h, st, [14, 18, 14, 14]);
    const k = P(st, 1), kp = P(st, 4);
    S.push(box(0, 0, 0, 1.3, 0.9, 1.3, { pig: 'ochre', k: 1, tint: 0.32 }));            // the cost floor: what it takes to make
    S.push(box(0, 2.35, 0, 1.3, 2.47, 1.3, { pig: 'teal', k, tint: 0.55, shadow: false })); // the value ceiling: what the customer thinks it is worth
    const ghost = box(0, 0.9, 0, 1.3, 2.35, 1.3, { kind: 'wire', pig: 'teal', solid: 0, alpha: 0.75 });
    S.push(ghost);
    fit(cam, with_shadows(S.flatMap((o) => o.pts)), x, y, ww, hh);
    render(ctx, cam, S);
    // the price: a line around the column, somewhere between the floor and the ceiling (the front corner is x = 0, z = 1.3)
    const pr = lerp(1.3, 1.9, kp), a = cam.p([0, pr, 0]), b = cam.p([0, pr, 1.3]), c = cam.p([1.3, pr, 1.3]);
    stroke_ink(ctx, poly(ctx, [a, b, c]), PIG.ink, 1.4, 0.9);
    text3(ctx, cam, zh(st) ? '价值' : 'value', [1.45, 2.5, 1.35], k > 0.5 ? PIG.teal : PIG.graphite_t, 12, 600, 'left');
    text3(ctx, cam, zh(st) ? '价格' : 'price', [1.45, pr + 0.06, 1.35], PIG.ink, 12, 600, 'left');
    text3(ctx, cam, zh(st) ? '成本' : 'cost', [1.45, 0.5, 1.35], PIG.ochre, 12, 600, 'left');
    return cam;
  },
  // the plans you are allowed: a raised plate; the profit line slides until it last touches it, at a corner
  lp(ctx, w, h, st) {
    const cam = turned(st.top), W = 6, Dd = 4.1, S = [], [x, y, ww, hh] = area(w, h, st, [14, 18, 14, 10]);
    S.push(box(0, 0, 0, W, 0.05, Dd));
    const O = (u, v) => [0.7 + u * 4.4, 0.05, Dd - 0.6 - v * 3.0];
    const corners = [[0, 0], [0, 0.82], [0.42, 0.74], [0.78, 0.38], [0.86, 0]];
    const k = P(st, 0);
    S.push(extrude(corners.map(([u, v]) => O(u, v)), [0, 0.2, 0], { pig: 'viridian', k: 1, tint: 0.22 + 0.2 * k }));
    fit(cam, with_shadows(S.flatMap((o) => o.pts)), x, y, ww, hh);
    render(ctx, cam, S);
    const ax = (u, v) => { const p = O(u, v); return cam.p([p[0], 0.051, p[2]]); };
    stroke_ink(ctx, poly(ctx, [ax(0, 1.08), ax(0, 0), ax(1.08, 0)]), PIG.ink, 1, 0.8);
    // the iso-profit line through the best corner (0.78, 0.38): 2u + v = const
    const best = [0.78, 0.38], c0 = 2 * best[0] + best[1];
    const L = (t) => { const u = t, v = c0 - 2 * t; const p = O(u, v); return cam.p([p[0], 0.252, p[2]]); };
    { const a = L(0.5), b = L(0.97); stroke_prov(ctx, seg(ctx, a[0], a[1], b[0], b[1]), PIG.ink, k, 1.3, 0.85); }
    const bc = O(best[0], best[1]), q = cam.p([bc[0], 0.25, bc[2]]); ring_dot(ctx, q[0], q[1], 5, PIG.viridian, k, 1.5);
    const lb = (t, u, v) => { const p = ax(u, v); label(ctx, t, p[0], p[1], PIG.ink, 12, 600, 'center'); };
    lb('x₁', 1.12, -0.07); lb('x₂', -0.06, 1.12);
    return cam;
  },
};
