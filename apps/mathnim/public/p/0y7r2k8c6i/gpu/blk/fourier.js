// Superposition. A square wave is a sum of sines: the first, a third as tall at three times the speed, a fifth as tall at
// five times, and so on. The sum of the first terms is drawn over the target; under it, each term is its own faint wave,
// and on the right their sizes stand as a spectrum. More terms, closer everywhere, except at the jumps: there the sum
// always overshoots by about 9% of the jump, only squeezed narrower (Gibbs). Slide the number of terms.
// As a building block: series(coeffs, { terms, spectrum, components }).
import { scheduler, Spring, C, GR, canvas2d } from '../lib/ui.js';
import { num, text, sym, tint, glass_bead, drags, TICK } from '../lib/plot.js';

export const meta = {
  id: 'fourier',
  name: { zh: '叠加', en: 'Superposition' },
  means: { zh: '方波是一串正弦的和：第一个；高三分之一、快三倍的；高五分之一、快五倍的……前几项的和画在目标上，下面每一项是一条淡淡的波，右边它们的大小立成一张频谱。项越多越贴近，只有跳变处例外：那里总要冲过头约跳变的 9%，只是越挤越窄（吉布斯现象）。拖动项数。', en: 'A square wave is a sum of sines: the first, a third as tall at three times the speed, a fifth at five, and so on. The partial sum is drawn over the target, each term as a faint wave below, their sizes as a spectrum. More terms, closer everywhere but at the jumps, where the sum always overshoots by about 9% of the jump (Gibbs).' },
  test: { zh: '系数恰好是 4/(nπ)（只有奇数项）；平方误差随项数单调下降；50 项时最高点在 1.175–1.182 之间（理论值 1.1790）', en: 'The coefficients are exactly 4/(nπ), odd n only; the squared error falls with every term added; with 50 terms the peak is between 1.175 and 1.182 (theory 1.1790)' },
  wide: true,
};

const KMAX = 50;
const b = (n) => (n % 2 ? 4 / (n * Math.PI) : 0);
const partial = (K, x) => { let s = 0; for (let k = 1; k <= K; k++) { const n = 2 * k - 1; s += b(n) * Math.sin(n * x); } return s; };
const square = (x) => { const u = ((x % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI); return u < Math.PI ? 1 : -1; };

export function make({ stage, canvas, lang }) {
  const zh = lang === 'zh';
  const cv = canvas2d(canvas), g = cv.ctx;
  const S = { K: 3 };
  const lift = new Spring(0), grow = new Spring(3, 0.5, 1);
  const geo = () => { const { W, H } = cv, sw = Math.min(260, W * 0.24), w = W - sw - 90; return { x0: 40, w, ym: H * 0.42, a: Math.min(H * 0.22, 110), yc: H * 0.82, ac: H * 0.07, sx: W - sw - 20, sw, R: { x0: W - sw - 20, x1: W - 30, y: 34 } }; };

  function draw() {
    const { W, H } = cv, G = geo(), K = Math.max(1, Math.round(grow.x)), X = (x) => G.x0 + (x / (2 * Math.PI)) * G.w / 1.5, P = 3 * Math.PI;
    g.setTransform(cv.dpr, 0, 0, cv.dpr, 0, 0); g.fillStyle = C.paper; g.fillRect(0, 0, W, H);
    // axes
    g.strokeStyle = GR(0.45); g.lineWidth = 1; g.beginPath(); g.moveTo(G.x0, G.ym); g.lineTo(G.x0 + G.w, G.ym); g.moveTo(G.x0, G.yc); g.lineTo(G.x0 + G.w, G.yc); g.stroke();
    // the target, dashed (what we are aiming at)
    g.strokeStyle = GR(0.55); g.lineWidth = 1.2; g.setLineDash([5, 4]); g.beginPath();
    for (let i = 0; i <= 600; i++) { const x = P * i / 600, y = G.ym - square(x) * G.a * 0.8; if (i && square(x) !== square(P * (i - 1) / 600)) g.lineTo(X(x), G.ym - square(P * (i - 1) / 600) * G.a * 0.8); i ? g.lineTo(X(x), y) : g.moveTo(X(x), y); }
    g.stroke(); g.setLineDash([]);
    // the components, faint, under the axis
    for (let k = 1; k <= Math.min(K, 8); k++) {
      const n = 2 * k - 1; g.strokeStyle = tint(C.cobalt, 0.55 - k * 0.05); g.lineWidth = 1; g.beginPath();
      for (let i = 0; i <= 500; i++) { const x = P * i / 500, y = G.yc - b(n) * Math.sin(n * x) * G.ac / (4 / Math.PI); i ? g.lineTo(X(x), y) : g.moveTo(X(x), y); }
      g.stroke();
    }
    // the partial sum
    g.strokeStyle = C.cobalt; g.lineWidth = 2.2; g.lineJoin = 'round'; g.beginPath();
    for (let i = 0; i <= 1400; i++) { const x = P * i / 1400, y = G.ym - partial(K, x) * G.a * 0.8; i ? g.lineTo(X(x), y) : g.moveTo(X(x), y); }
    g.stroke();
    // the overshoot at the first jump, measured: the highest point of the sum just after x = 0
    let best = 0, bx = 0; for (let i = 1; i < 2000; i++) { const x = (Math.PI / 2) * i / 2000, v = partial(K, x); if (v > best) { best = v; bx = x; } }
    if (K >= 3) {
      const ty = G.ym - G.a * 0.8, py = G.ym - best * G.a * 0.8, xx = X(bx);
      g.strokeStyle = C.ink2; g.lineWidth = 0.8; g.beginPath(); g.moveTo(xx + 6, ty); g.lineTo(xx + 26, ty); g.moveTo(xx + 6, py); g.lineTo(xx + 26, py); g.moveTo(xx + 20, ty); g.lineTo(xx + 20, py); g.stroke();
      text(g, num((best - 1) / 2 * 100, 1) + '%', xx + 28, (ty + py) / 2 + 4, { size: 12, weight: 650, tabular: true, color: C.ink, halo: 3 });
    }
    // the spectrum: b_n as bars
    const bw = G.sw / 26, by = G.ym + G.a * 0.8, hmax = G.a * 1.6;
    g.strokeStyle = GR(0.45); g.beginPath(); g.moveTo(G.sx, by); g.lineTo(G.sx + G.sw, by); g.stroke();
    for (let n = 1; n <= 25; n++) { const x = G.sx + (n - 0.5) * bw, h = b(n) / (4 / Math.PI) * hmax, on = n % 2 && (n + 1) / 2 <= K; if (!(n % 2)) continue; g.fillStyle = on ? C.cobalt : tint(C.cobalt, 0.25); g.fillRect(x - bw * 0.32, by - h, bw * 0.64, h); }
    for (const n of [1, 5, 9, 13, 17, 21, 25]) text(g, String(n), G.sx + (n - 0.5) * bw, by + 15, { size: 10.5, color: TICK, align: 'center', tabular: true });
    sym(g, 'n', G.sx + G.sw + 4, by + 15, { size: 13, color: TICK });
    // the number of terms
    const R = G.R, RX = (k) => R.x0 + (R.x1 - R.x0) * (k - 1) / (KMAX - 1);
    g.strokeStyle = GR(0.55); g.lineWidth = 1; g.beginPath(); g.moveTo(R.x0, R.y); g.lineTo(R.x1, R.y); g.stroke();
    for (const k of [1, 10, 20, 30, 40, 50]) { g.beginPath(); g.moveTo(RX(k), R.y); g.lineTo(RX(k), R.y + 5); g.stroke(); text(g, String(k), RX(k), R.y + 18, { size: 11, color: TICK, align: 'center', tabular: true }); }
    glass_bead(g, RX(S.K), R.y, 10, lift.x, { dir: 0, core: C.cobalt });
    text(g, (zh ? '项数 ' : 'terms ') + K, R.x0 - 16, R.y + 5, { size: 13, weight: 600, align: 'right', tabular: true });
  }

  const hold = drags(canvas, () => {
    const R = geo().R, RX = (k) => R.x0 + (R.x1 - R.x0) * (k - 1) / (KMAX - 1);
    return [{ hit: (x, y) => { const d = Math.hypot(x - RX(S.K), y - R.y); return d < 22 ? d : Math.abs(y - R.y) < 12 && x > R.x0 && x < R.x1 ? 40 : Infinity; }, down() { lift.to(1); }, up() { lift.to(0); },
      move: (x) => { S.K = Math.max(1, Math.min(KMAX, Math.round(1 + (x - R.x0) / (R.x1 - R.x0) * (KMAX - 1)))); grow.snap(S.K); } }];
  }, { change: () => sched.wake() });
  const sched = scheduler((dt) => { const busy = [lift.step(dt), grow.step(dt)].some(Boolean); draw(); return busy || !!hold.active; });
  const resize = () => { cv.fit(); draw(); };
  resize(); grow.snap(1).to(S.K); sched.wake(1500);

  return {
    visible: (v) => sched.set_visible(v), resize,
    demo() { S.K = 25; grow.to(25); sched.wake(2500); },
    async accept() {
      // 1. the coefficients, from the integral b_n = (1/π)∫ f(x) sin(nx) dx done numerically
      let coef = 0;
      for (let n = 1; n <= 12; n++) { let s = 0; const M = 20000; for (let i = 0; i < M; i++) { const x = (i + 0.5) / M * 2 * Math.PI; s += square(x) * Math.sin(n * x); } s *= (2 * Math.PI / M) / Math.PI; coef = Math.max(coef, Math.abs(s - b(n))); }
      // 2. the squared error, falling with each term
      let falls = true, prev = Infinity;
      for (let K = 1; K <= 20; K++) { let e = 0; const M = 4000; for (let i = 0; i < M; i++) { const x = (i + 0.5) / M * 2 * Math.PI; e += (partial(K, x) - square(x)) ** 2; } if (e >= prev) falls = false; prev = e; }
      // 3. Gibbs: the peak with 50 terms
      let peak = 0; for (let i = 1; i < 20000; i++) peak = Math.max(peak, partial(50, (Math.PI / 4) * i / 20000));
      const pass = coef < 1e-6 && falls && peak > 1.175 && peak < 1.182;
      return { pass, value: zh ? `系数与 4/(nπ) 相差 ${coef.toExponential(1)}；平方误差逐项下降 ${falls ? '✓' : '✗'}；50 项最高点 ${peak.toFixed(4)}` : `coefficients vs 4/(nπ): ${coef.toExponential(1)}; squared error falling ${falls ? '✓' : '✗'}; peak with 50 terms ${peak.toFixed(4)}` };
    },
  };
}
