// D9 · Guilloché. The rosettes on a banknote are sums of rotations: z(t) = a·e^{it} + b·e^{ikt} + c·e^{imt} with
// whole-number k and m, so every curve closes after one turn. Many copies, each turned a little, interfere into the
// fine lattice an engraving lathe cuts. Drag sideways to change k; up and down to change the balance of the radii.
// Canvas 2D only.
// As a library primitive: rosette(k, m, radii) and its families; a picture of frequency ratios and closure.
import { scheduler } from '../../lib/gl.js';

export const meta = {
  id: 'guilloche',
  name: { zh: '玫瑰花纹', en: 'Guilloché' },
  means: { zh: '钞票上的花纹是几个转动之和：频率是整数比，所以每条线转一圈正好闭合；很多条稍稍错开，就交织成细密的网。', en: 'A banknote rosette is a sum of rotations at whole-number ratios, so every line closes after one turn; many, slightly turned, weave into a fine lattice.' },
  test: { zh: '每条曲线转一圈后回到起点（误差 < 10⁻¹⁰）；改变 k 后仍闭合', en: 'Every curve returns to its start after one turn (< 10⁻¹⁰), for every k' },
};

export const rose = (t, a, b, c, k, m, ph) => [a * Math.cos(t + ph) + b * Math.cos(k * t + ph) + c * Math.cos(m * t - ph * 2), a * Math.sin(t + ph) + b * Math.sin(k * t + ph) + c * Math.sin(m * t - ph * 2)];

export function make({ stage, canvas, hud, lang }) {
  const zh = lang === 'zh'; let ctx = canvas.getContext('2d');
  let W = 0, H = 0, dpr = 1;
  const S = { k: -9, m: 17, bal: 0.3 };
  let cache = null, key = '';
  function fit() { cache = null; const r = canvas.getBoundingClientRect(); dpr = Math.min(2, devicePixelRatio || 1); canvas.width = Math.round(r.width * dpr); canvas.height = Math.round(r.height * dpr); W = r.width; H = r.height; }
  function family(cx, cy, R, k, m, bal, n, col, width, inner = 0) {
    const a = R * (1 - bal), b = R * bal * 0.72, c = R * bal * 0.28, steps = Math.max(500, Math.abs(m) * 26);
    ctx.strokeStyle = col; ctx.lineWidth = width;
    for (let j = 0; j < n; j++) {
      const ph = j / n * 2 * Math.PI / Math.abs(k - 1 || 1);
      ctx.beginPath();
      for (let i = 0; i <= steps; i++) { const t = i / steps * 2 * Math.PI, [x, y] = rose(t, a, b, c, k, m, ph), r = Math.hypot(x, y), s = inner ? (inner + (1 - inner) * r / R) : 1; i ? ctx.lineTo(cx + x * s, cy + y * s) : ctx.moveTo(cx + x * s, cy + y * s); }
      ctx.closePath(); ctx.stroke();
    }
  }
  function draw() {
    // the engraving is drawn once per setting into an offscreen plate, and only copied when nothing changed
    const k2 = `${S.k},${S.m},${S.bal.toFixed(3)},${W},${H}`;
    if (cache && key === k2) { ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.drawImage(cache, 0, 0); return; }
    key = k2; if (!cache) { cache = document.createElement('canvas'); cache.width = canvas.width; cache.height = canvas.height; }
    const main = ctx; ctx = cache.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.fillStyle = '#fbfaf7'; ctx.fillRect(0, 0, W, H);
    const cx = W / 2, cy = H / 2, R = Math.min(W * 0.46, H * 0.4);
    // the border: a band of waves r = R₀ + A·sin(nθ + φ), forty phases apart; where they cross, the lattice forms
    const n = Math.abs(S.k - 1) * 3; ctx.strokeStyle = 'rgba(47,91,210,.55)'; ctx.lineWidth = 0.6;
    for (let j = 0; j < 14; j++) { const ph = j / 14 * Math.PI; ctx.beginPath(); for (let i = 0; i <= 1440; i++) { const t = i / 1440 * 2 * Math.PI, r = R * (0.875 + 0.055 * Math.sin(n * t + ph) * Math.cos(ph * 0.5)); i ? ctx.lineTo(cx + r * Math.cos(t), cy + r * Math.sin(t)) : ctx.moveTo(cx + r * Math.cos(t), cy + r * Math.sin(t)); } ctx.stroke(); }
    // the rosette: one closed sum of rotations, turned 64 times by a whole period's fraction
    const a2 = R * 0.66 * (1 - S.bal), b2 = R * 0.66 * S.bal; ctx.strokeStyle = 'rgba(26,27,31,.55)'; ctx.lineWidth = 0.55;
    for (let j = 0; j < 28; j++) { const ph = j / 28 * 2 * Math.PI / Math.abs(S.k - 1) * 0.5; ctx.beginPath(); for (let i = 0; i <= 1600; i++) { const t = i / 1600 * 2 * Math.PI, [x, y] = rose(t, a2, b2, 0, S.k, S.m, ph); i ? ctx.lineTo(cx + x, cy + y) : ctx.moveTo(cx + x, cy + y); } ctx.closePath(); ctx.stroke(); }
    ctx.strokeStyle = 'rgba(26,27,31,.65)'; ctx.lineWidth = 0.8; for (const r of [0.76, 0.775, 0.975, 0.99]) { ctx.beginPath(); ctx.arc(cx, cy, R * r, 0, Math.PI * 2); ctx.stroke(); }
    ctx = main; ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.drawImage(cache, 0, 0);
    hud.innerHTML = `k = <b>${S.k}</b>, m = <b>${S.m}</b>`;
  }
  const sched = scheduler(() => { draw(); return false; });
  let drag = null;
  canvas.addEventListener('pointerdown', (e) => { drag = { x: e.clientX, y: e.clientY, k: S.k, bal: S.bal }; canvas.setPointerCapture(e.pointerId); });
  canvas.addEventListener('pointermove', (e) => { if (!drag) return; const k = Math.round(drag.k + (e.clientX - drag.x) / 40); S.k = k === 1 || k === 0 ? (k > drag.k ? 2 : -1) : Math.max(-12, Math.min(12, k)); S.bal = Math.max(0.1, Math.min(0.7, drag.bal - (e.clientY - drag.y) / 500)); sched.wake(); });
  canvas.addEventListener('pointerup', () => { drag = null; });
  fit(); draw();
  return {
    visible: (v) => sched.set_visible(v), resize: () => { fit(); draw(); },
    demo() { S.k = S.k === -7 ? 5 : -7; draw(); },
    async accept() {
      let worst = 0;
      for (const k of [-11, -7, -3, 2, 5, 9]) for (const ph of [0, 0.3, 1.1]) { const p = rose(0, 0.6, 0.3, 0.1, k, 17, ph), q = rose(2 * Math.PI, 0.6, 0.3, 0.1, k, 17, ph); worst = Math.max(worst, Math.hypot(p[0] - q[0], p[1] - q[1])); }
      return { pass: worst < 1e-10, value: `${zh ? '闭合误差' : 'closure error'} ${worst.toExponential(1)}` };
    },
  };
}
