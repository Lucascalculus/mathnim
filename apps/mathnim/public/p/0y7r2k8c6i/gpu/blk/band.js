// An uncertain line. A handful of noisy points could have come from many lines; resample the points and refit, again and
// again, and the fitted lines pile up into a band, each one faint, so that where they agree the ink is dark. The band
// (the middle 90% of them at each x) is narrowest over the middle of the data, an hourglass, and it narrows as the data
// grow: four times the points, half the width. Slide n. As a building block: band(curves | fit, { level }).
import { scheduler, Spring, C, GR, canvas2d, mulberry } from '../lib/ui.js';
import { Plot, text, sym, tint, glass_bead, drags, TICK } from '../lib/plot.js';

export const meta = {
  id: 'band',
  name: { zh: '不确定的带', en: 'An uncertain line' },
  means: { zh: '几个带噪声的点可能来自很多条直线：把点重抽一遍、重新拟合，一遍又一遍，拟合出的线叠成一条带，每条都很淡，大家一致的地方墨色就深。带（每个 x 处中间 90% 的线）在数据中间最窄，像沙漏；数据越多越窄：点数变成四倍，宽度减半。拖 n。', en: 'A few noisy points could come from many lines: resample and refit, again and again, and the lines pile into a band, each faint, dark where they agree. The band (the middle 90% at each x) is narrowest over the middle of the data, an hourglass, and narrows as the data grow: four times the points, half the width.' },
  test: { zh: '每个 x 处带里恰好装着约 90% 的重抽直线（88%–92%）；带在数据中间比两端窄；n 从 10 到 40，中间的宽度缩成约一半（这组数据 0.4–0.6，60 组数据平均 0.42–0.65）', en: 'At each x the band holds about 90% of the refitted lines (88–92%); it is narrower over the middle of the data than at the ends; from n = 10 to 40 its middle width roughly halves (0.4–0.6)' },
  wide: true,
};

const TRUE = { a: 0.8, b: 0.45 }, SIG = 0.55, NMAX = 80, K = 160, X0 = 0, X1 = 8;
const pts_of = (seed) => { const r = mulberry(seed), out = []; for (let i = 0; i < NMAX; i++) { const x = X0 + 0.5 + r() * (X1 - X0 - 1), u = 1 - r(), v = r(); out.push([x, TRUE.a + TRUE.b * x + SIG * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v)]); } return out; };
const SHOWN = 2;                     // the data shown (one draw whose band narrows as steadily as the average does)
function line_fit(pts) { const n = pts.length, mx = pts.reduce((s, p) => s + p[0], 0) / n, my = pts.reduce((s, p) => s + p[1], 0) / n; let sxx = 0, sxy = 0; for (const [x, y] of pts) { sxx += (x - mx) ** 2; sxy += (x - mx) * (y - my); } const b = sxy / (sxx || 1e-12); return { a: my - b * mx, b }; }
// K refits of resampled points (the bootstrap), cached for each n
const cache = new Map();
function refits(n, seed = SHOWN) {
  const id = seed * 1000 + n; if (cache.has(id)) return cache.get(id);
  const pts = pts_of(seed).slice(0, n), r = mulberry(1000 + n), out = [];
  for (let k = 0; k < K; k++) { const s = []; for (let i = 0; i < n; i++) s.push(pts[Math.floor(r() * n)]); out.push(line_fit(s)); }
  const v = { pts, fit: line_fit(pts), lines: out }; if (seed === SHOWN) cache.set(id, v); return v;
}
// the band at x: the 5% and 95% points of the refitted lines there
function band_at(lines, x) { const ys = lines.map((L) => L.a + L.b * x).sort((p, q) => p - q); return [ys[Math.floor(0.05 * (ys.length - 1))], ys[Math.ceil(0.95 * (ys.length - 1))]]; }

export function make({ stage, canvas, lang }) {
  const zh = lang === 'zh';
  const cv = canvas2d(canvas), g = cv.ctx;
  const S = { n: 10 };
  const lift = new Spring(0);
  const layout = () => { const { W, H } = cv; return { P: new Plot({ x: 40, y: 60, w: W - 70, h: H - 92 }, [X0, X1], [-0.8, 5.6], { x_step: 2, y_step: 1 }), R: { x0: W - 230, x1: W - 30, y: 32 } }; };
  const n_of = (u) => Math.round(4 * Math.pow(NMAX / 4, u)), u_of = (n) => Math.log(n / 4) / Math.log(NMAX / 4);

  function draw() {
    const { W, H } = cv, { P, R } = layout(), F = refits(S.n);
    g.setTransform(cv.dpr, 0, 0, cv.dpr, 0, 0); g.fillStyle = C.paper; g.fillRect(0, 0, W, H);
    P.axes(g, { x_name: 'x', y_name: 'y' });
    g.save(); P.clip(g);
    // the band
    g.beginPath();
    for (let i = 0; i <= 80; i++) { const x = X0 + (X1 - X0) * i / 80, q = P.P([x, band_at(F.lines, x)[1]]); i ? g.lineTo(q[0], q[1]) : g.moveTo(q[0], q[1]); }
    for (let i = 80; i >= 0; i--) { const x = X0 + (X1 - X0) * i / 80, q = P.P([x, band_at(F.lines, x)[0]]); g.lineTo(q[0], q[1]); }
    g.closePath(); g.fillStyle = tint(C.cobalt, 0.16); g.fill();
    // every refitted line, faint: where they agree the ink is dark
    g.strokeStyle = 'rgba(47,91,210,0.07)'; g.lineWidth = 1;
    for (const L of F.lines) { const a = P.P([X0, L.a + L.b * X0]), b = P.P([X1, L.a + L.b * X1]); g.beginPath(); g.moveTo(a[0], a[1]); g.lineTo(b[0], b[1]); g.stroke(); }
    const a = P.P([X0, F.fit.a + F.fit.b * X0]), b = P.P([X1, F.fit.a + F.fit.b * X1]);
    g.strokeStyle = C.cobalt; g.lineWidth = 2.2; g.beginPath(); g.moveTo(a[0], a[1]); g.lineTo(b[0], b[1]); g.stroke();
    g.restore();
    for (const p of F.pts) { const q = P.P(p); g.fillStyle = C.ink; g.beginPath(); g.arc(q[0], q[1], 3.4, 0, Math.PI * 2); g.fill(); }
    // n on its ruler
    g.strokeStyle = GR(0.55); g.lineWidth = 1; g.beginPath(); g.moveTo(R.x0, R.y); g.lineTo(R.x1, R.y); g.stroke();
    for (const t of [4, 10, 20, 40, 80]) { const x = R.x0 + (R.x1 - R.x0) * u_of(t); g.beginPath(); g.moveTo(x, R.y); g.lineTo(x, R.y + 5); g.stroke(); text(g, String(t), x, R.y + 18, { size: 11, color: TICK, align: 'center', tabular: true }); }
    glass_bead(g, R.x0 + (R.x1 - R.x0) * u_of(S.n), R.y, 10, lift.x, { dir: 0 });
    sym(g, 'n', R.x0 - 46, R.y + 5, { size: 17 }); text(g, String(S.n), R.x0 - 32, R.y + 5, { size: 13, weight: 600, tabular: true });
    text(g, '90%', 22, 38, { size: 14, weight: 600, color: C.cobalt, tabular: true });
  }

  const hold = drags(canvas, () => {
    const { R } = layout(), bx = R.x0 + (R.x1 - R.x0) * u_of(S.n);
    return [{ hit: (x, y) => { const d = Math.hypot(x - bx, y - R.y); return d < 22 ? d : Math.abs(y - R.y) < 12 && x > R.x0 && x < R.x1 ? 40 : Infinity; }, down() { lift.to(1); }, up() { lift.to(0); },
      move: (x) => { S.n = n_of(Math.max(0, Math.min(1, (x - R.x0) / (R.x1 - R.x0)))); } }];
  }, { change: () => sched.wake() });
  const sched = scheduler((dt) => { const busy = lift.step(dt); draw(); return busy || !!hold.active; });
  const resize = () => { cv.fit(); draw(); };
  resize();

  return {
    visible: (v) => sched.set_visible(v), resize,
    async accept() {
      let cover_lo = 1, cover_hi = 0, hourglass = true;
      for (const n of [6, 10, 20, 40, 80]) {
        const F = refits(n), mx = F.pts.reduce((s, p) => s + p[0], 0) / n;
        for (let i = 0; i <= 20; i++) {
          const x = X0 + (X1 - X0) * i / 20, [lo, hi] = band_at(F.lines, x), inside = F.lines.filter((L) => { const y = L.a + L.b * x; return y >= lo - 1e-12 && y <= hi + 1e-12; }).length / K;
          cover_lo = Math.min(cover_lo, inside); cover_hi = Math.max(cover_hi, inside);
        }
        const w = (x) => { const [lo, hi] = band_at(F.lines, x); return hi - lo; };
        if (!(w(mx) < w(X0) && w(mx) < w(X1))) hourglass = false;
      }
      const wm = (n, seed) => { const F = refits(n, seed), mx = F.pts.reduce((s, p) => s + p[0], 0) / n, [lo, hi] = band_at(F.lines, mx); return hi - lo; };
      // the shown data, and the same over sixty other draws of data (the halving is what happens on average)
      const ratio = wm(40, SHOWN) / wm(10, SHOWN); let avg = 0; for (let s = 100; s < 160; s++) avg += wm(40, s) / wm(10, s); avg /= 60;
      const pass = cover_lo >= 0.88 && cover_hi <= 0.92 && hourglass && ratio > 0.4 && ratio < 0.6 && avg > 0.42 && avg < 0.65;
      return { pass, value: zh ? `带里装着 ${(cover_lo * 100).toFixed(1)}%–${(cover_hi * 100).toFixed(1)}% 的线；中间窄、两端宽 ${hourglass ? '✓' : '✗'}；n 从 10 到 40 中间宽度之比 ${ratio.toFixed(2)}（60 组数据平均 ${avg.toFixed(2)}）` : `the band holds ${(cover_lo * 100).toFixed(1)}–${(cover_hi * 100).toFixed(1)}% of the lines; narrow in the middle ${hourglass ? '✓' : '✗'}; middle width n 10 → 40: ${ratio.toFixed(2)} (average over 60 draws ${avg.toFixed(2)})` };
    },
  };
}
