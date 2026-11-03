// D8 · A shape morph that keeps its area. A shape changes into another the way a lump of clay would: outlines are
// matched by arc length with the best cyclic alignment, interpolated, and every in-between is rescaled about its
// centroid so its area is exactly the same. Circle, triangle, star, a glyph, a square: tap for the next. The target
// waits as a dashed outline (predicted, hollow). Canvas 2D only.
// As a library primitive: Transform(A, B, keep="area") for any two closed shapes.
import { scheduler } from '../../lib/gl.js';
import { Spring, SANS } from '../../lib/ui.js';

export const meta = {
  id: 'shapemorph',
  name: { zh: '保面积的变形', en: 'A morph that keeps its area' },
  means: { zh: '一个形状像一团黏土那样变成另一个：中间的每一帧面积都一样，只是被捏成了不同的样子。', en: 'One shape becomes another as a lump of clay would: every in-between has the same area, only pressed into a different form.' },
  test: { zh: '变形过程中每一帧的面积相同（误差 < 0.1%）', en: 'Every in-between frame has the same area (within 0.1 %)' },
};

const NP = 360;
const area = (P) => { let a = 0; for (let i = 0; i < P.length; i++) { const p = P[i], q = P[(i + 1) % P.length]; a += p[0] * q[1] - q[0] * p[1]; } return a / 2; };
const centroid = (P) => { let cx = 0, cy = 0, a = 0; for (let i = 0; i < P.length; i++) { const p = P[i], q = P[(i + 1) % P.length], c = p[0] * q[1] - q[0] * p[1]; a += c; cx += (p[0] + q[0]) * c; cy += (p[1] + q[1]) * c; } return [cx / (3 * a), cy / (3 * a)]; };
function resample(P, n = NP) {
  const L = [0]; for (let i = 1; i <= P.length; i++) L.push(L[i - 1] + Math.hypot(P[i % P.length][0] - P[i - 1][0], P[i % P.length][1] - P[i - 1][1]));
  const T = L[L.length - 1], out = []; let j = 0;
  for (let i = 0; i < n; i++) { const s = i / n * T; while (L[j + 1] < s) j++; const t = (s - L[j]) / (L[j + 1] - L[j] || 1), a = P[j], b = P[(j + 1) % P.length]; out.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]); }
  return out;
}
// every shape: counter-clockwise, unit area, centred on 0
function normalise(P) { P = resample(P); if (area(P) < 0) P.reverse(); const c = centroid(P), k = 1 / Math.sqrt(Math.abs(area(P))); return P.map((p) => [(p[0] - c[0]) * k, (p[1] - c[1]) * k]); }
function polygon(n, r = 1, rot = -Math.PI / 2) { return Array.from({ length: n }, (_, i) => [r * Math.cos(rot + i / n * 2 * Math.PI), r * Math.sin(rot + i / n * 2 * Math.PI)]); }
function star(k = 5) { return Array.from({ length: 2 * k }, (_, i) => { const r = i % 2 ? 0.42 : 1, a = -Math.PI / 2 + i / (2 * k) * 2 * Math.PI; return [r * Math.cos(a), r * Math.sin(a)]; }); }
function glyph(ch) {
  const S = 300, cv = document.createElement('canvas'); cv.width = cv.height = S;
  const g = cv.getContext('2d', { willReadFrequently: true }); g.fillStyle = '#000'; g.font = `700 260px "Noto Serif", "DejaVu Serif", Georgia, serif`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(ch, S / 2, S / 2 + 10);
  const a = g.getImageData(0, 0, S, S).data, on = (x, y) => x >= 0 && y >= 0 && x < S && y < S && a[(y * S + x) * 4 + 3] > 127;
  let sx = -1, sy = -1; outer: for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) if (on(x, y)) { sx = x; sy = y; break outer; }
  const D = [[1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1], [0, -1], [1, -1]], pts = []; let x = sx, y = sy, d = 6;
  for (let k = 0; k < 20000; k++) { pts.push([x / S * 2 - 1, y / S * 2 - 1]); let f = false; for (let i = 0; i < 8; i++) { const dd = (d + 6 + i) % 8; if (on(x + D[dd][0], y + D[dd][1])) { x += D[dd][0]; y += D[dd][1]; d = dd; f = true; break; } } if (!f || (x === sx && y === sy && k > 2)) break; }
  return pts;
}
// align B to A: the cyclic shift of B's points that is closest to A
function align(A, B) {
  let best = 0, bd = Infinity;
  for (let s = 0; s < NP; s += 2) { let d = 0; for (let i = 0; i < NP; i += 6) { const p = A[i], q = B[(i + s) % NP]; d += (p[0] - q[0]) ** 2 + (p[1] - q[1]) ** 2; } if (d < bd) { bd = d; best = s; } }
  return B.slice(best).concat(B.slice(0, best));
}
// the in-between at t, by intrinsic interpolation (Sederberg et al. 1993): each edge's length and direction are
// interpolated, the outline is rebuilt edge by edge, and the closure error is shared out by length; then it is
// rescaled about its centroid back to unit area. Interpolating points directly pinches; this does not.
function edges(P) { const out = []; let prev = null; for (let i = 0; i < P.length; i++) { const a = P[i], b = P[(i + 1) % P.length], l = Math.hypot(b[0] - a[0], b[1] - a[1]); let th = Math.atan2(b[1] - a[1], b[0] - a[0]); if (prev !== null) { while (th - prev > Math.PI) th -= 2 * Math.PI; while (th - prev < -Math.PI) th += 2 * Math.PI; } out.push([l, th]); prev = th; } return out; }
export function between(A, B, t) {
  const EA = edges(A), EB = edges(B); let off = 0; while (EB[0][1] + off - EA[0][1] > Math.PI) off -= 2 * Math.PI; while (EB[0][1] + off - EA[0][1] < -Math.PI) off += 2 * Math.PI;
  const E = EA.map(([la, ta], i) => [la + (EB[i][0] - la) * t, ta + (EB[i][1] + off - ta) * t]);
  let ex = 0, ey = 0, tl = 0; for (const [l, th] of E) { ex += l * Math.cos(th); ey += l * Math.sin(th); tl += l; }
  const P0 = [A[0][0] + (B[0][0] - A[0][0]) * t, A[0][1] + (B[0][1] - A[0][1]) * t], P = [P0];
  for (let i = 0; i < E.length - 1; i++) { const [l, th] = E[i], q = P[P.length - 1]; P.push([q[0] + l * Math.cos(th) - ex * l / tl, q[1] + l * Math.sin(th) - ey * l / tl]); }
  const a = area(P), c = centroid(P), k = 1 / Math.sqrt(Math.abs(a));
  return P.map((p) => [(p[0] - c[0]) * k, (p[1] - c[1]) * k]);
}

export function make({ stage, canvas, hud, lang }) {
  const zh = lang === 'zh', ctx = canvas.getContext('2d');
  let W = 0, H = 0, dpr = 1;
  const names = zh ? ['圆', '三角形', '星', 'π', '正方形'] : ['circle', 'triangle', 'star', 'π', 'square'];
  const raw = [polygon(180), polygon(3), star(5), glyph('π'), polygon(4, 1, Math.PI / 4)];
  const shapes = raw.map(normalise);
  let from = 0, to = 1; const T = new Spring(0, 0.8, 0.92);
  let B = align(shapes[from], shapes[to]);
  function fit() { const r = canvas.getBoundingClientRect(); dpr = Math.min(2, devicePixelRatio || 1); canvas.width = Math.round(r.width * dpr); canvas.height = Math.round(r.height * dpr); W = r.width; H = r.height; }
  function draw() {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.fillStyle = '#fbfaf7'; ctx.fillRect(0, 0, W, H);
    const s = Math.min(W, H) * 0.3, cx = W / 2, cy = H / 2, tf = (p) => [cx + p[0] * s, cy + p[1] * s];
    const path = (P) => { ctx.beginPath(); P.forEach((p, i) => { const q = tf(p); i ? ctx.lineTo(...q) : ctx.moveTo(...q); }); ctx.closePath(); };
    // the target waits, dashed
    if (T.x < 0.999) { path(B); ctx.setLineDash([3, 5]); ctx.strokeStyle = 'rgba(26,27,31,.35)'; ctx.lineWidth = 1.2; ctx.stroke(); ctx.setLineDash([]); }
    // the clay: one ink body with a soft shadow and a hairline edge
    const P = between(shapes[from], B, Math.max(0, Math.min(1, T.x)));
    ctx.save(); ctx.shadowColor = 'rgba(26,27,31,.25)'; ctx.shadowBlur = 22; ctx.shadowOffsetY = 10; path(P); ctx.fillStyle = '#23252b'; ctx.fill(); ctx.restore();
    path(P); const g = ctx.createLinearGradient(cx - s, cy - s, cx + s, cy + s); g.addColorStop(0, 'rgba(255,255,255,.10)'); g.addColorStop(0.5, 'rgba(255,255,255,0)'); ctx.fillStyle = g; ctx.fill();
    ctx.fillStyle = 'rgba(26,27,31,.6)'; ctx.font = `500 15px ${SANS}`; ctx.textAlign = 'center'; ctx.fillText(`${names[from]} → ${names[to]}`, cx, H - 40);
    hud.innerHTML = `${zh ? '面积' : 'area'} <b>${(Math.abs(area(P))).toFixed(4)}</b>`;
  }
  const sched = scheduler((dt) => { const b = T.step(dt); draw(); if (!b && T.target === 1) { from = to; to = (to + 1) % shapes.length; B = align(shapes[from], shapes[to]); T.snap(0); draw(); } return b; });
  canvas.addEventListener('pointerdown', () => { T.to(1); sched.wake(); });
  fit(); draw();
  return {
    visible: (v) => sched.set_visible(v), resize: () => { fit(); draw(); },
    demo() { T.to(1); sched.wake(); },
    at(i, t) { from = i; to = (i + 1) % shapes.length; B = align(shapes[from], shapes[to]); T.snap(t); draw(); },
    async accept() {
      let worst = 0;
      for (let i = 0; i < shapes.length; i++) { const A = shapes[i], Bb = align(A, shapes[(i + 1) % shapes.length]); for (let t = 0; t <= 1.0001; t += 0.05) worst = Math.max(worst, Math.abs(Math.abs(area(between(A, Bb, t))) - 1)); }
      return { pass: worst < 0.001, value: `${zh ? '面积最大偏差' : 'largest area deviation'} ${(worst * 100).toExponential(1)}%` };
    },
  };
}
