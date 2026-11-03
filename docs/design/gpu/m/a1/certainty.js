// A7 · Certainty. An estimate is drawn as what it is: many possibilities. A fan of lines (real samples from the
// Bayesian posterior) tightens as points arrive; the readout's digits are sharp only where the posterior has settled
// them and blurred where it has not. Tap the chart to add your own point and watch belief move.
// As a library primitive: certain(mobject, posterior) draws any estimate as samples, and digits by their σ.
import { scheduler } from '../../lib/gl.js';
import { SANS } from '../../lib/ui.js';

export const meta = {
  id: 'certainty',
  name: { zh: '确定性', en: 'Certainty' },
  means: { zh: '不确定的东西画成“很多种可能”，证据越多它越收拢；数字只在已经确定的那几位是清楚的。', en: 'An uncertain thing is drawn as many possibilities that gather as evidence arrives; a number is sharp only in the digits already settled.' },
  test: { zh: '线束的离散度 = 解析后验标准差（±12%）；清楚的位数 = ⌊−log₁₀ 2σ⌋', en: 'Spread of the fan = analytic posterior σ (±12 %); sharp digits = ⌊−log₁₀ 2σ⌋' },
};

const TRUE = { a: 0.62, b: 0.8 }, NOISE = 0.55, TAU = 2.0, NS = 70;
// Bayesian linear regression with known noise: prior N(0, τ²I) on (b, a), posterior Gaussian in closed form
function posterior(pts) {
  let A = [[1 / TAU ** 2, 0], [0, 1 / TAU ** 2]], r = [0, 0];
  for (const [x, y] of pts) { const f = [1, x]; for (let i = 0; i < 2; i++) { r[i] += f[i] * y / NOISE ** 2; for (let j = 0; j < 2; j++) A[i][j] += f[i] * f[j] / NOISE ** 2; } }
  const det = A[0][0] * A[1][1] - A[0][1] * A[1][0], S = [[A[1][1] / det, -A[0][1] / det], [-A[1][0] / det, A[0][0] / det]];
  const m = [S[0][0] * r[0] + S[0][1] * r[1], S[1][0] * r[0] + S[1][1] * r[1]];
  // Cholesky of S, to draw samples
  const l00 = Math.sqrt(S[0][0]), l10 = S[1][0] / l00, l11 = Math.sqrt(Math.max(1e-12, S[1][1] - l10 * l10));
  return { m, S, L: [[l00, 0], [l10, l11]] };
}
function gauss(rng) { const u = Math.max(1e-9, rng()), v = rng(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); }
function mulberry(a) { return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }

export function make({ stage, canvas, hud, lang }) {
  const zh = lang === 'zh', ctx = canvas.getContext('2d');
  let W = 0, H = 0, dpr = 1;
  const rng = mulberry(7), data_rng = mulberry(11);
  // a fixed set of standard normal draws, so the fan moves smoothly as the posterior changes (no flicker)
  const Z = Array.from({ length: NS }, () => [gauss(rng), gauss(rng)]);
  let pts = [], post = posterior(pts), shown = { m: post.m.slice(), L: post.L.map((r) => r.slice()) }, drops = [];
  const read = document.createElement('div');
  read.style.cssText = `position:absolute;font-family:${SANS};color:#1a1b1f;pointer-events:none;font-variant-numeric:tabular-nums`;
  stage.append(read);
  function fit() { const r = canvas.getBoundingClientRect(); dpr = Math.min(2, devicePixelRatio || 1); canvas.width = Math.round(r.width * dpr); canvas.height = Math.round(r.height * dpr); W = r.width; H = r.height; }
  function geo() { const narrow = W < 560; return narrow ? { x: 28, y: H * 0.1, w: W - 52, h: H * 0.52, narrow } : { x: W * 0.08, y: H * 0.12, w: W * 0.58, h: H * 0.72, narrow }; }
  const X = (g, x) => g.x + x / 5 * g.w, Y = (g, y) => g.y + g.h - (y + 0.5) / 5.5 * g.h, IX = (g, px) => (px - g.x) / g.w * 5, IY = (g, py) => (g.y + g.h - py) / g.h * 5.5 - 0.5;
  function add(x, y) { pts.push([x, y]); drops.push({ x, y, t: 0 }); post = posterior(pts); sched.wake(1800); }
  function add_random() { const x = data_rng() * 5, y = TRUE.b + TRUE.a * x + gauss(data_rng) * NOISE; add(x, y); }
  // digits: sharp where the posterior has settled them (place value above 2σ), blurred below
  function digits(v, sd, places = 3) {
    const s = (v < 0 ? '−' : '') + Math.abs(v).toFixed(places), sure = Math.floor(-Math.log10(Math.max(1e-9, 2 * sd)));
    let out = '', dot = s.indexOf('.');
    for (let i = 0; i < s.length; i++) {
      const ch = s[i]; if (i === dot || ch === '−') { out += `<span>${ch}</span>`; continue; }
      // the digit's place value is 10^e; it is settled when 10^e is at least 2σ
      const e = i < dot ? dot - i - 1 : -(i - dot), k = Math.max(0, -e - sure);
      out += k <= 0 ? `<span>${ch}</span>` : `<span style="filter:blur(${Math.min(5, 1.1 + k * 1.2)}px);opacity:${Math.max(0.25, 0.75 - k * 0.18)}">${ch}</span>`;
    }
    return { html: out, sure };
  }
  function draw() {
    const g = geo(); ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.fillStyle = '#fbfaf7'; ctx.fillRect(0, 0, W, H);
    // the chart
    ctx.strokeStyle = 'rgba(26,27,31,.1)'; ctx.lineWidth = 1;
    for (let i = 0; i <= 5; i++) { ctx.beginPath(); ctx.moveTo(X(g, i), g.y); ctx.lineTo(X(g, i), g.y + g.h); ctx.stroke(); ctx.beginPath(); ctx.moveTo(g.x, Y(g, i)); ctx.lineTo(g.x + g.w, Y(g, i)); ctx.stroke(); }
    ctx.strokeStyle = 'rgba(26,27,31,.5)'; ctx.beginPath(); ctx.moveTo(g.x, g.y); ctx.lineTo(g.x, g.y + g.h); ctx.lineTo(g.x + g.w, g.y + g.h); ctx.stroke();
    // the fan: each line a sample of (b, a) from the posterior; together their density is the belief
    ctx.save(); ctx.beginPath(); ctx.rect(g.x, g.y, g.w, g.h); ctx.clip();
    const { m, L } = shown, alpha = Math.min(0.32, 6 / NS + 0.03);
    ctx.lineWidth = 1.2; ctx.strokeStyle = `rgba(47,91,210,${alpha})`;
    for (const [z1, z2] of Z) {
      const b = m[0] + L[0][0] * z1, a = m[1] + L[1][0] * z1 + L[1][1] * z2;
      ctx.beginPath(); ctx.moveTo(X(g, 0), Y(g, b)); ctx.lineTo(X(g, 5), Y(g, b + 5 * a)); ctx.stroke();
    }
    ctx.restore();
    // the data, each point dropping in with a small ring as it lands
    for (const d of drops) {
      const t = Math.min(1, d.t), x = X(g, d.x), y = Y(g, d.y) - (1 - t) * (1 - t) * 40;
      ctx.fillStyle = `rgba(26,27,31,${0.25 + 0.75 * t})`; ctx.beginPath(); ctx.arc(x, y, 4, 0, Math.PI * 2); ctx.fill();
      if (d.t > 1 && d.t < 1.6) { const k = (d.t - 1) / 0.6; ctx.strokeStyle = `rgba(26,27,31,${0.4 * (1 - k)})`; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(x, Y(g, d.y), 4 + 14 * k, 0, Math.PI * 2); ctx.stroke(); }
    }
    // the readout: slope and intercept, digits by certainty
    const sa = Math.sqrt(post.S[1][1]), sb = Math.sqrt(post.S[0][0]);
    const A = digits(shown.m[1], sa), B = digits(shown.m[0], sb);
    read.innerHTML = `<div style="font-size:13px;color:#62666d;margin-bottom:2px">${zh ? '斜率' : 'slope'}</div><div style="font-size:${g.narrow ? 34 : 44}px;font-weight:500;letter-spacing:-.01em;line-height:1.1">${A.html}</div>
      <div style="font-size:13px;color:#62666d;margin:16px 0 2px">${zh ? '截距' : 'intercept'}</div><div style="font-size:${g.narrow ? 26 : 32}px;font-weight:500;line-height:1.1">${B.html}</div>
      <div style="font-size:13px;color:#62666d;margin-top:18px">${pts.length} ${zh ? '个点' : 'points'}</div>`;
    read.style.left = (g.narrow ? g.x : g.x + g.w + W * 0.05) + 'px'; read.style.top = (g.narrow ? g.y + g.h + 34 : g.y + g.h * 0.18) + 'px';
  }
  const sched = scheduler((dt) => {
    // belief moves on a short ease toward the new posterior, so the fan settles rather than jumps
    const k = 1 - Math.pow(0.0005, dt); let moving = false;
    for (let i = 0; i < 2; i++) { const d = post.m[i] - shown.m[i]; shown.m[i] += d * k; if (Math.abs(d) > 1e-4) moving = true; for (let j = 0; j < 2; j++) { const e = post.L[i][j] - shown.L[i][j]; shown.L[i][j] += e * k; if (Math.abs(e) > 1e-4) moving = true; } }
    for (const d of drops) if (d.t < 1.6) { d.t += dt * 2.6; moving = true; }
    draw(); return moving;
  });
  canvas.addEventListener('pointerdown', (e) => { const r = canvas.getBoundingClientRect(), g = geo(), x = IX(g, e.clientX - r.left), y = IY(g, e.clientY - r.top); if (x >= 0 && x <= 5 && y >= -0.5 && y <= 5) add(x, y); });
  canvas.addEventListener('dblclick', () => { pts = []; drops = []; post = posterior(pts); sched.wake(); });
  fit(); for (let i = 0; i < 3; i++) add_random(); shown = { m: post.m.slice(), L: post.L.map((r) => r.slice()) }; for (const d of drops) d.t = 2; draw();
  return {
    visible: (v) => sched.set_visible(v), resize: () => { fit(); draw(); },
    demo() { let n = 0; const iv = setInterval(() => { add_random(); if (++n >= 24) clearInterval(iv); }, 70); },
    async accept() {
      // the fan's spread in slope vs the analytic σ, with many draws
      for (let i = 0; i < 12; i++) add_random();
      const p = posterior(pts), r2 = mulberry(3); let s = 0, s2 = 0; const N = 4000;
      for (let i = 0; i < N; i++) { const z1 = gauss(r2), z2 = gauss(r2), a = p.m[1] + p.L[1][0] * z1 + p.L[1][1] * z2; s += a; s2 += a * a; }
      const sd = Math.sqrt(s2 / N - (s / N) ** 2), sa = Math.sqrt(p.S[1][1]), err = Math.abs(sd / sa - 1);
      // the fan actually drawn (NS lines) as well
      let t = 0, t2 = 0; for (const [z1, z2] of Z) { const a = p.m[1] + p.L[1][0] * z1 + p.L[1][1] * z2; t += a; t2 += a * a; }
      const sd_fan = Math.sqrt(t2 / NS - (t / NS) ** 2), err_fan = Math.abs(sd_fan / sa - 1);
      const sure = digits(p.m[1], sa).sure, rule = Math.floor(-Math.log10(2 * sa));
      shown = { m: p.m.slice(), L: p.L.map((r) => r.slice()) }; draw();
      return { pass: err < 0.05 && err_fan < 0.12 && sure === rule, value: `σ ${zh ? '解析' : 'analytic'} ${sa.toFixed(3)}, ${zh ? '抽样' : 'sampled'} ${sd.toFixed(3)}, ${zh ? '画出的线束' : 'drawn fan'} ${sd_fan.toFixed(3)}; ${zh ? '清楚位数' : 'sharp digits'} ${sure}` };
    },
  };
}
