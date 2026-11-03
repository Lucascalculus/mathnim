// A8 · One thing, another view. The same data, continuously: dots → stacks → histogram → density → the mean.
// Every frame is a true object: dots fall into their own bins; the histogram becomes a density by convolving it
// with a widening Gaussian (box ⊛ Gaussian, exact); the density becomes the distribution of the mean of k draws,
// computed from its characteristic function φ(ω/k)^k, with k going from 1 to n. The last view is one number and
// how sure we can be of it. As a library primitive: a representation ladder over one dataset.
import { scheduler, Spring, SANS, fit2d, mulberry } from '../lib/ui.js';

export const meta = {
  id: 'morph', wide: true,
  name: { zh: '同一样东西，另一种样子', en: 'One thing, another view' },
  means: { zh: '一组数据连续地变成：点、堆、直方图、密度、均值。每一帧都是真的，不是两张图之间的插值。', en: 'One dataset becomes, continuously: dots, stacks, histogram, density, the mean. Every frame is true, not a blend of two pictures.' },
  test: { zh: '柱高 = 计数；每一帧曲线下面积 = n·Δ（±1%）；最后的峰在样本均值，宽度 = σ/√n', en: 'Bar heights = counts; area under every frame = n·Δ (±1 %); the last peak sits at the sample mean with width σ/√n' },
};

const N = 120, LO = 0, HI = 10, BW = 0.5, NB = (HI - LO) / BW;
const STAGES = { zh: ['点', '堆', '直方图', '密度', '均值'], en: ['dots', 'stacks', 'histogram', 'density', 'mean'] };
const erf = (x) => { const s = Math.sign(x); x = Math.abs(x); const t = 1 / (1 + 0.3275911 * x); return s * (1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-x * x)); };
const Phi = (z) => 0.5 * (1 + erf(z / Math.SQRT2));

export function make({ stage, canvas, hud, lang }) {
  const zh = lang === 'zh', ctx = canvas.getContext('2d');
  let W = 0, H = 0, dpr = 1, seed = 5;
  let D;
  function sample() {
    const r = mulberry(seed++), g = () => Math.sqrt(-2 * Math.log(Math.max(1e-9, r()))) * Math.cos(2 * Math.PI * r());
    const xs = Array.from({ length: N }, () => Math.min(HI - 0.01, Math.max(LO + 0.01, r() < 0.6 ? 3.6 + 0.95 * g() : 6.9 + 0.7 * g()))).sort((a, b) => a - b);
    const bins = Array(NB).fill(0), slot = xs.map((x) => { const b = Math.floor((x - LO) / BW); return [b, bins[b]++]; });
    const mean = xs.reduce((a, b) => a + b, 0) / N, sd = Math.sqrt(xs.reduce((a, b) => a + (b - mean) ** 2, 0) / (N - 1));
    const h = 1.06 * sd * Math.pow(N, -0.2);   // Silverman's bandwidth
    D = { xs, bins, slot, mean, sd, h, jit: xs.map(() => r()), max: Math.max(...bins) };
  }
  sample();
  const T = new Spring(0, 0.9, 1);
  function fit() { ({ W, H, dpr } = fit2d(canvas)); }
  function geo() { const narrow = W < 560; return { x: narrow ? 18 : W * 0.08, w: narrow ? W - 36 : W * 0.84, base: H * (narrow ? 0.62 : 0.7), top: H * 0.14, narrow, scale_y: H * (narrow ? 0.8 : 0.85) }; }
  const X = (g, x) => g.x + (x - LO) / (HI - LO) * g.w;
  // the density at stage 3: the histogram convolved with a Gaussian of width s (in counts per bin width)
  function smoothed(x, s) { let f = 0; for (let j = 0; j < NB; j++) { if (!D.bins[j]) continue; const a = LO + j * BW, b = a + BW; f += D.bins[j] * (s < 1e-6 ? (x >= a && x < b ? 1 : 0) : Phi((b - x) / s) - Phi((a - x) / s)); } return f; }
  // the distribution of the mean of k draws from the smoothed data, by its characteristic function, in counts per bin
  function mean_of_k(xg, k) {
    const s = D.h, nw = 360, Om = 8 / Math.max(0.03, D.sd / Math.sqrt(k)) , dw = 2 * Om / nw, out = new Float64Array(xg.length);
    const re = new Float64Array(nw), im = new Float64Array(nw);
    for (let i = 0; i < nw; i++) {
      const w = -Om + (i + 0.5) * dw, u = w / k;
      let cr = 0, ci = 0; for (const x of D.xs) { cr += Math.cos(u * x); ci += Math.sin(u * x); } cr /= N; ci /= N;
      const damp = Math.exp(-u * u * s * s / 2); cr *= damp; ci *= damp;
      // (cr + i ci)^k in polar form
      const mod = Math.pow(Math.hypot(cr, ci), k), arg = Math.atan2(ci, cr) * k;
      re[i] = mod * Math.cos(arg); im[i] = mod * Math.sin(arg);
    }
    for (let j = 0; j < xg.length; j++) { let f = 0; const x = xg[j]; for (let i = 0; i < nw; i++) { const w = -Om + (i + 0.5) * dw; f += re[i] * Math.cos(w * x) + im[i] * Math.sin(w * x); } out[j] = Math.max(0, f * dw / (2 * Math.PI)) * N * BW; }
    return out;
  }
  let cache = { k: -1, ys: null };
  function draw() {
    const g = geo(), t = Math.max(0, Math.min(4, T.x));
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.fillStyle = '#fbfaf7'; ctx.fillRect(0, 0, W, H);
    const bwp = BW / (HI - LO) * g.w, u0 = Math.min(bwp, (g.base - g.top) / (D.max + 1));
    // the axis
    ctx.strokeStyle = 'rgba(26,27,31,.55)'; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(g.x, g.base); ctx.lineTo(g.x + g.w, g.base); ctx.stroke();
    ctx.fillStyle = 'rgba(26,27,31,.6)'; ctx.font = `13px ${SANS}`; ctx.textAlign = 'center';
    for (let v = LO; v <= HI; v += 2) { const x = X(g, v); ctx.beginPath(); ctx.moveTo(x, g.base); ctx.lineTo(x, g.base + 5); ctx.stroke(); ctx.fillText(String(v), x, g.base + 22); }
    const COB = [47, 91, 210];
    if (t < 2) {
      // dots, falling into stacks (stage 0 → 1), then growing into the bins' squares (1 → 2)
      const f = Math.min(1, t), sq = Math.max(0, t - 1);
      for (let i = 0; i < N; i++) {
        const [b, k] = D.slot[i], delay = i / N * 0.5, e = Math.max(0, Math.min(1, (f - delay) / 0.5)), ee = e * e * (3 - 2 * e);
        const sx = X(g, D.xs[i]), sy = g.top + 20 + D.jit[i] * (g.base - g.top - 60) * 0.55;
        const tx = X(g, LO + (b + 0.5) * BW), ty = g.base - (k + 0.5) * u0;
        const x = sx + (tx - sx) * ee, y = sy + (ty - sy) * ee;
        const dw = Math.min(u0, bwp) * 0.78, w = dw + (bwp - 1 - dw) * sq, h = dw + (u0 - dw) * sq, r = dw / 2 * (1 - sq) + 0.5;
        ctx.fillStyle = `rgba(${COB},${0.75 + 0.15 * sq})`; ctx.beginPath(); ctx.roundRect(x - w / 2, y - h / 2, w, h, r); ctx.fill();
      }
    } else if (t < 3) {
      // the histogram turns into a density: box ⊛ Gaussian with a width growing to Silverman's
      const s = (t - 2) * D.h, path = [];
      for (let i = 0; i <= 400; i++) { const x = LO + i / 400 * (HI - LO); path.push([X(g, x), g.base - smoothed(x, s) * u0]); }
      fill_curve(path, g, COB, 0.9 - 0.62 * (t - 2));
    } else {
      // the density becomes the distribution of the mean of k draws, k from 1 to n
      const e = t - 3, k = Math.max(1, Math.round(Math.pow(N, e) * 100) / 100), xg = Array.from({ length: 300 }, (_, i) => LO + i / 299 * (HI - LO));
      if (cache.k !== k) cache = { k, ys: mean_of_k(xg, k) };
      // the chart zooms its height to keep the peak in view (the area stays n·Δ)
      const peak = Math.max(...cache.ys), zoom = Math.min(1, (g.base - g.top) / (peak * u0));
      const path = xg.map((x, i) => [X(g, x), g.base - cache.ys[i] * u0 * zoom]);
      fill_curve(path, g, COB, 0.28 + 0.4 * e);
      if (e > 0.6) {
        const a = (e - 0.6) / 0.4, mx = X(g, D.mean), se = D.sd / Math.sqrt(N);
        ctx.globalAlpha = a; ctx.strokeStyle = '#1a1b1f'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(mx, g.base + 2); ctx.lineTo(mx, g.top - 6); ctx.stroke();
        ctx.fillStyle = '#1a1b1f'; ctx.font = `600 ${g.narrow ? 20 : 24}px ${SANS}`; ctx.textAlign = 'right'; ctx.fillText(D.mean.toFixed(2), mx - 4, g.top - 16);
        ctx.font = `15px ${SANS}`; ctx.fillStyle = 'rgba(26,27,31,.65)'; ctx.textAlign = 'left'; ctx.fillText(`± ${(1.96 * se).toFixed(2)}`, mx + 4, g.top - 16); ctx.textAlign = 'center';
        ctx.globalAlpha = 1;
      }
    }
    // the ladder of views: five notches and a bead
    const sx0 = g.narrow ? 36 : W / 2 - 200, sx1 = g.narrow ? W - 36 : W / 2 + 200, sy = H - (g.narrow ? 64 : 58);
    ctx.strokeStyle = 'rgba(26,27,31,.18)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(sx0, sy); ctx.lineTo(sx1, sy); ctx.stroke();
    STAGES[lang].forEach((s, i) => { const x = sx0 + (sx1 - sx0) * i / 4, on = Math.abs(t - i) < 0.5; ctx.strokeStyle = 'rgba(26,27,31,.4)'; ctx.beginPath(); ctx.moveTo(x, sy - 5); ctx.lineTo(x, sy + 5); ctx.stroke(); ctx.fillStyle = on ? '#1a1b1f' : 'rgba(26,27,31,.5)'; ctx.font = `${on ? 600 : 400} 13px ${SANS}`; ctx.fillText(s, x, sy + 28); });
    const bx = sx0 + (sx1 - sx0) * t / 4;
    ctx.shadowColor = 'rgba(26,27,31,.18)'; ctx.shadowBlur = 12; ctx.shadowOffsetY = 4; ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(bx, sy, 13, 0, Math.PI * 2); ctx.fill(); ctx.shadowColor = 'transparent';
    ctx.strokeStyle = 'rgba(26,27,31,.16)'; ctx.lineWidth = 0.75; ctx.stroke();
    G.scale = [sx0, sx1, sy];
  }
  function fill_curve(path, g, rgb, a) {
    ctx.beginPath(); ctx.moveTo(path[0][0], g.base); for (const [x, y] of path) ctx.lineTo(x, y); ctx.lineTo(path[path.length - 1][0], g.base); ctx.closePath();
    ctx.fillStyle = `rgba(${rgb},${a})`; ctx.fill();
    ctx.beginPath(); path.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); ctx.strokeStyle = `rgb(${rgb})`; ctx.lineWidth = 2; ctx.stroke();
  }
  const G = { scale: [0, 1, 0] };
  const sched = scheduler((dt) => { const b = T.step(dt); draw(); return b; });
  let drag = false;
  const to_t = (x) => Math.max(0, Math.min(4, (x - G.scale[0]) / (G.scale[1] - G.scale[0]) * 4));
  canvas.addEventListener('pointerdown', (e) => {
    const r = canvas.getBoundingClientRect(), x = e.clientX - r.left, y = e.clientY - r.top;
    if (Math.abs(y - G.scale[2]) < 34) { drag = true; T.to(to_t(x)); canvas.setPointerCapture(e.pointerId); }
    else T.to(T.target >= 3.5 ? 0 : Math.round(T.target) + 1);
    sched.wake();
  });
  canvas.addEventListener('pointermove', (e) => { if (!drag) return; const r = canvas.getBoundingClientRect(); T.to(to_t(e.clientX - r.left)); sched.wake(); });
  canvas.addEventListener('pointerup', () => { if (drag) { drag = false; T.to(Math.round(T.target)); sched.wake(); } });
  fit(); draw();
  return {
    visible: (v) => sched.set_visible(v), resize: () => { fit(); draw(); },
    demo() { T.to(T.target >= 3.5 ? 0 : Math.round(T.target) + 1); sched.wake(); },
    at(t) { T.snap(t); draw(); },
    async accept() {
      // counts: bins equal the data; area under the smoothed histogram is n·Δ at every width
      const counts_ok = D.bins.reduce((a, b) => a + b, 0) === N;
      let worst = 0;
      for (const s of [0.05, 0.2, D.h]) { let A = 0; const n = 2000; for (let i = 0; i < n; i++) A += smoothed(LO - 2 + (i + 0.5) / n * (HI - LO + 4), s) * (HI - LO + 4) / n; worst = Math.max(worst, Math.abs(A / BW / N - 1)); }
      // the mean of n draws: peak at the sample mean, width σ/√n
      const xg = Array.from({ length: 600 }, (_, i) => D.mean - 1 + i / 599 * 2), ys = mean_of_k(xg, N);
      let A = 0, M = 0, V = 0; const dx = 2 / 599; ys.forEach((y, i) => { A += y * dx; M += y * xg[i] * dx; }); M /= A; ys.forEach((y, i) => { V += y * (xg[i] - M) ** 2 * dx; }); V /= A;
      const se = Math.sqrt(V), se_true = Math.sqrt(D.sd ** 2 * (N - 1) / N + D.h ** 2) / Math.sqrt(N);
      const ok = counts_ok && worst < 0.01 && Math.abs(M - D.mean) < 0.01 && Math.abs(se / se_true - 1) < 0.03;
      return { pass: ok, value: `${zh ? '面积偏差' : 'area error'} ${(worst * 100).toFixed(2)}%; ${zh ? '峰' : 'peak'} ${M.toFixed(3)} (${zh ? '均值' : 'mean'} ${D.mean.toFixed(3)}); ${zh ? '宽' : 'width'} ${se.toFixed(4)} (${se_true.toFixed(4)})` };
    },
  };
}
