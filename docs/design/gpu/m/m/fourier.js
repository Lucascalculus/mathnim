// M5 · Fourier series in machined steel. A closed curve (here the outline of a glyph, traced from the font) is a sum of
// circles turning at whole-number speeds. Each circle is a lathe-turned steel washer: its concentric tool marks catch
// the one light as a radial spoke (anisotropic reflection); the last pin draws in ink on the paper. Drag sideways to
// choose how many terms; the partial sums converge, Gibbs ripples and all.
// As a library primitive: epicycles(path, n) for any closed path, the DFT computed in place.
import { scheduler } from '../../lib/gl.js';
import { SANS } from '../../lib/ui.js';

export const meta = {
  id: 'fourier',
  name: { zh: '傅里叶级数 · 车削钢', en: 'Fourier series in machined steel' },
  means: { zh: '任何闭合曲线都是一串匀速转动的圆之和；圆越多，越接近。每个圆是车床车出来的钢盘。', en: 'Any closed curve is a sum of circles turning at steady speeds; the more circles, the closer. Each is a lathe-turned steel disc.' },
  test: { zh: '误差随项数单调下降（帕塞瓦尔）；用全部系数重建，误差 < 0.5 像素', en: 'Error falls with every term (Parseval); all coefficients rebuild the curve within 0.5 px' },
  wide: true,
};

// the outline of a glyph, as an ordered closed path of M points (marching around the edge of its raster)
function glyph_path(ch, M = 512) {
  const S = 360, cv = document.createElement('canvas'); cv.width = cv.height = S;
  const g = cv.getContext('2d', { willReadFrequently: true }); g.fillStyle = '#000'; g.font = `600 300px "Noto Serif", "DejaVu Serif", Georgia, serif`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(ch, S / 2, S / 2 + 10);
  const a = g.getImageData(0, 0, S, S).data, on = (x, y) => x >= 0 && y >= 0 && x < S && y < S && a[(y * S + x) * 4 + 3] > 127;
  // Moore-neighbour tracing of the outer boundary
  let sx = -1, sy = -1; outer: for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) if (on(x, y)) { sx = x; sy = y; break outer; }
  const dirs = [[1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1], [0, -1], [1, -1]];
  const pts = []; let x = sx, y = sy, d = 6;
  for (let k = 0; k < 20000; k++) {
    pts.push([x, y]);
    let found = false;
    for (let i = 0; i < 8; i++) { const dd = (d + 6 + i) % 8, nx = x + dirs[dd][0], ny = y + dirs[dd][1]; if (on(nx, ny)) { x = nx; y = ny; d = dd; found = true; break; } }
    if (!found || (x === sx && y === sy && k > 2)) break;
  }
  // resample to M points evenly by arc length, centred, scaled to unit size
  const len = [0]; for (let i = 1; i <= pts.length; i++) { const p = pts[i % pts.length], q = pts[i - 1]; len.push(len[i - 1] + Math.hypot(p[0] - q[0], p[1] - q[1])); }
  const L = len[len.length - 1], out = []; let j = 0;
  for (let i = 0; i < M; i++) { const s = i / M * L; while (len[j + 1] < s) j++; const t = (s - len[j]) / (len[j + 1] - len[j] || 1), p = pts[j % pts.length], q = pts[(j + 1) % pts.length]; out.push([(p[0] + (q[0] - p[0]) * t - S / 2) / S * 2, -(p[1] + (q[1] - p[1]) * t - S / 2) / S * 2]); }
  return out;
}
// the discrete Fourier transform, terms sorted by size (largest circle first)
function dft(z) {
  const M = z.length, out = [];
  for (let k = -M / 2; k < M / 2; k++) { let re = 0, im = 0; for (let n = 0; n < M; n++) { const a = -2 * Math.PI * k * n / M; re += z[n][0] * Math.cos(a) - z[n][1] * Math.sin(a); im += z[n][0] * Math.sin(a) + z[n][1] * Math.cos(a); } out.push({ k, re: re / M, im: im / M, r: Math.hypot(re, im) / M }); }
  return out.sort((a, b) => b.r - a.r);
}
const point = (C, n, t) => { let x = 0, y = 0; for (let i = 0; i < n; i++) { const c = C[i], a = c.k * t; x += c.re * Math.cos(a) - c.im * Math.sin(a); y += c.re * Math.sin(a) + c.im * Math.cos(a); } return [x, y]; };

export function make({ stage, canvas, hud, lang }) {
  const zh = lang === 'zh', ctx = canvas.getContext('2d');
  let W = 0, H = 0, dpr = 1;
  const Z = glyph_path('∫'), C = dft(Z);
  const S = { n: 24, t: 0, playing: true, ink: [] };
  function fit() { const r = canvas.getBoundingClientRect(); dpr = Math.min(2, devicePixelRatio || 1); canvas.width = Math.round(r.width * dpr); canvas.height = Math.round(r.height * dpr); W = r.width; H = r.height; }
  const geo = () => { const narrow = W < 560, sc = narrow ? Math.min(W * 0.9, H * 0.36) : Math.min(W * 0.28, H * 0.42); return { cx: narrow ? W / 2 : W * 0.6, cy: H * 0.5, sc, narrow }; };
  const P = (g, p) => [g.cx + p[0] * g.sc, g.cy - p[1] * g.sc];
  const LIGHT = -2.25;   // the light's direction on the page (upper left)
  // a lathe-turned steel disc: concentric tool marks reflect a radial spoke toward and away from the light
  // a lathe-turned steel washer: a ring, so the ink beneath stays visible; its concentric tool marks reflect a radial
  // spoke toward and away from the light
  function disc(x, y, r, depth) {
    if (r < 1.2) return;
    const w = Math.max(1.6, Math.min(11, r * 0.16)), ri = Math.max(0, r - w);
    ctx.save();
    const ring = () => { ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.arc(x, y, ri, 0, Math.PI * 2, true); };
    ctx.shadowColor = 'rgba(26,27,31,.2)'; ctx.shadowBlur = Math.min(10, w * 0.8 + 1); ctx.shadowOffsetX = 1; ctx.shadowOffsetY = 2.5;
    ring(); ctx.fillStyle = '#b9bcc1'; ctx.fill(); ctx.shadowColor = 'transparent';
    const g = ctx.createConicGradient(LIGHT, x, y), stops = [[0, .95], [0.04, .78], [0.12, .58], [0.25, .48], [0.38, .58], [0.46, .8], [0.5, .93], [0.54, .8], [0.62, .58], [0.75, .48], [0.88, .58], [0.96, .78], [1, .95]];
    for (const [s, v] of stops) { const c = Math.round(118 + 134 * v); g.addColorStop(s, `rgb(${c},${c + 1},${c + 4})`); }
    ctx.globalAlpha = 0.88 + 0.12 * depth; ring(); ctx.fillStyle = g; ctx.fill(); ctx.globalAlpha = 1;
    // the chamfered edges: bright on the far side of the light, dark on the near side, on both rims
    const rim = ctx.createLinearGradient(x - r, y - r, x + r, y + r); rim.addColorStop(0, 'rgba(255,255,255,.95)'); rim.addColorStop(0.5, 'rgba(255,255,255,.2)'); rim.addColorStop(1, 'rgba(26,27,31,.4)');
    const rim2 = ctx.createLinearGradient(x - r, y - r, x + r, y + r); rim2.addColorStop(0, 'rgba(26,27,31,.35)'); rim2.addColorStop(0.5, 'rgba(255,255,255,.1)'); rim2.addColorStop(1, 'rgba(255,255,255,.85)');
    ctx.lineWidth = Math.max(0.75, Math.min(1.6, w * 0.18));
    ctx.strokeStyle = rim; ctx.beginPath(); ctx.arc(x, y, r - ctx.lineWidth / 2, 0, Math.PI * 2); ctx.stroke();
    if (ri > 1) { ctx.strokeStyle = rim2; ctx.beginPath(); ctx.arc(x, y, ri + ctx.lineWidth / 2, 0, Math.PI * 2); ctx.stroke(); }
    ctx.restore();
  }
  function draw() {
    const g = geo(); ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.fillStyle = '#fbfaf7'; ctx.fillRect(0, 0, W, H);
    // the target, faint and dashed
    ctx.setLineDash([2, 4]); ctx.strokeStyle = 'rgba(26,27,31,.22)'; ctx.lineWidth = 1; ctx.beginPath(); Z.forEach((p, i) => { const q = P(g, p); i ? ctx.lineTo(...q) : ctx.moveTo(...q); }); ctx.closePath(); ctx.stroke(); ctx.setLineDash([]);
    // the ink drawn so far
    ctx.strokeStyle = '#1a1b1f'; ctx.lineWidth = 2; ctx.lineJoin = 'round'; ctx.lineCap = 'round'; ctx.beginPath(); S.ink.forEach((p, i) => { const q = P(g, p); i ? ctx.lineTo(...q) : ctx.moveTo(...q); }); ctx.stroke();
    // the discs, largest first (deepest), each centred on the tip of the one before
    let x = 0, y = 0; const centres = [];
    for (let i = 0; i < S.n; i++) { const c = C[i], a = c.k * S.t; centres.push([x, y, c.r]); x += c.re * Math.cos(a) - c.im * Math.sin(a); y += c.re * Math.sin(a) + c.im * Math.cos(a); }
    centres.forEach(([cx, cy, r], i) => { const q = P(g, [cx, cy]); disc(q[0], q[1], r * g.sc, 1 - i / S.n); });
    // the arms: fine engraved lines from each centre to the next, and the pin
    ctx.strokeStyle = 'rgba(26,27,31,.55)'; ctx.lineWidth = 1; ctx.beginPath(); centres.forEach(([cx, cy], i) => { const q = P(g, [cx, cy]); i ? ctx.lineTo(...q) : ctx.moveTo(...q); }); const tip = P(g, [x, y]); ctx.lineTo(...tip); ctx.stroke();
    ctx.fillStyle = '#1a1b1f'; ctx.beginPath(); ctx.arc(tip[0], tip[1], 3, 0, Math.PI * 2); ctx.fill();
    // the count of terms, as a scale of ticks along the left
    const x0 = g.narrow ? 24 : W * 0.08, y0 = H - 46, w = g.narrow ? W - 48 : W * 0.22;
    ctx.strokeStyle = 'rgba(26,27,31,.2)'; ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x0 + w, y0); ctx.stroke();
    const bx = x0 + w * Math.log(S.n) / Math.log(C.length);
    ctx.fillStyle = '#1a1b1f'; ctx.font = `500 ${g.narrow ? 22 : 28}px ${SANS}`; ctx.textAlign = 'left'; ctx.fillText(String(S.n), x0, y0 - 18);
    ctx.font = `13px ${SANS}`; ctx.fillStyle = 'rgba(26,27,31,.6)'; ctx.fillText(zh ? '个圆' : 'circles', x0 + ctx.measureText(String(S.n)).width * 2.1 + 8, y0 - 18);
    ctx.shadowColor = 'rgba(26,27,31,.18)'; ctx.shadowBlur = 10; ctx.shadowOffsetY = 3; ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(bx, y0, 11, 0, Math.PI * 2); ctx.fill(); ctx.shadowColor = 'transparent';
    G.scale = [x0, w, y0];
  }
  const G = { scale: [0, 1, 0] };
  const sched = scheduler((dt) => {
    if (S.playing) { const steps = 4; for (let i = 0; i < steps; i++) { S.t += dt * 2 * Math.PI / 7 / steps; S.ink.push(point(C, S.n, S.t)); } if (S.t >= 2 * Math.PI) { S.t = 2 * Math.PI; S.playing = false; } }
    draw(); return S.playing;
  });
  function replay() { S.t = 0; S.ink = [point(C, S.n, 0)]; S.playing = true; sched.wake(); }
  let drag = false;
  const set_n = (x) => { const [x0, w] = G.scale; S.n = Math.max(1, Math.min(C.length, Math.round(Math.exp(Math.max(0, Math.min(1, (x - x0) / w)) * Math.log(C.length))))); };
  canvas.addEventListener('pointerdown', (e) => { const r = canvas.getBoundingClientRect(), x = e.clientX - r.left, y = e.clientY - r.top; if (Math.abs(y - G.scale[2]) < 30) { drag = true; set_n(x); canvas.setPointerCapture(e.pointerId); replay(); } else replay(); });
  canvas.addEventListener('pointermove', (e) => { if (!drag) return; const r = canvas.getBoundingClientRect(); const n0 = S.n; set_n(e.clientX - r.left); if (S.n !== n0) replay(); });
  canvas.addEventListener('pointerup', () => { drag = false; });
  fit(); replay();
  return {
    visible: (v) => sched.set_visible(v), resize: () => { fit(); draw(); },
    demo() { S.n = 60; replay(); },
    at(n, t) { S.n = n; S.t = 0; S.ink = []; for (let i = 0; i <= 400; i++) { S.t = t * i / 400; S.ink.push(point(C, n, S.t)); } S.playing = false; draw(); },
    async accept() {
      // mean squared error of the partial sums: must fall with every term (Parseval), and the full sum rebuilds it
      const M = Z.length, err = (n) => { let e = 0; for (let i = 0; i < M; i++) { const p = point(C, n, 2 * Math.PI * i / M); e += (p[0] - Z[i][0]) ** 2 + (p[1] - Z[i][1]) ** 2; } return e / M; };
      let mono = true, prev = Infinity; for (const n of [1, 2, 4, 8, 16, 32, 64, 128, 256, 512]) { const e = err(n); if (e > prev + 1e-12) mono = false; prev = e; }
      const g = geo(); let worst = 0; for (let i = 0; i < M; i++) { const p = point(C, M, 2 * Math.PI * i / M); worst = Math.max(worst, Math.hypot(p[0] - Z[i][0], p[1] - Z[i][1]) * g.sc); }
      return { pass: mono && worst < 0.5, value: `${zh ? '误差单调下降' : 'error falls with every term'} ${mono ? '✓' : '✗'}; ${zh ? '全部系数重建误差' : 'full rebuild error'} ${worst.toExponential(1)} px` };
    },
  };
}
