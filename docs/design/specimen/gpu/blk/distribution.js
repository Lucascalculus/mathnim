// A distribution. Samples fall one by one; each leaves a tick on the axis, and together they stack into a histogram whose
// bars have area, not height, so the whole is 1 and it settles onto the density curve drawn over it. The mean sits under
// the axis as a fulcrum, the point where the sample would balance, and one standard deviation either side is a dimension
// line. Slide n to draw more; choose another shape. As a building block: distribution(pdf | samples, { n, mean, sd }).
import { scheduler, Spring, C, GR, canvas2d, mulberry } from '../lib/ui.js';
import { Plot, num, text, sym, tint, glass_bead, drags, choice_row, dimension, TICK } from '../lib/plot.js';

export const meta = {
  id: 'distribution',
  name: { zh: '分布', en: 'A distribution' },
  means: { zh: '样本一个个落下，每个在轴上留一道刻痕，合起来堆成直方图。柱子量的是面积不是高度，所以总面积是 1，n 越大越贴近上面画的密度曲线。均值是轴下的一个支点，样本在那里刚好平衡；左右各一个标准差画成尺寸线。拖 n 抽更多，换一种形状。', en: 'Samples fall one by one, each leaving a tick on the axis, and stack into a histogram whose bars measure area, so the whole is 1 and it settles onto the density drawn over it. The mean is a fulcrum under the axis, where the sample balances; one standard deviation either side is a dimension line.' },
  test: { zh: '直方图总面积恰好为 1；n = 10000 时三种分布的 χ² 拟合检验 p > 0.001；样本均值离真均值不到 4 个标准误', en: 'The histogram’s area is exactly 1; at n = 10000 a χ² goodness-of-fit test gives p > 0.001 for all three shapes; the sample mean is within 4 standard errors of the true mean' },
  wide: true,
};

const erf = (x) => { const s = Math.sign(x), a = Math.abs(x), t = 1 / (1 + 0.3275911 * a); return s * (1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-a * a)); };
const Phi = (x, m, s) => 0.5 * (1 + erf((x - m) / (s * Math.SQRT2)));
const phi = (x, m, s) => Math.exp(-((x - m) ** 2) / (2 * s * s)) / (s * Math.sqrt(2 * Math.PI));
const DISTS = [
  { zh: '正态', en: 'normal', x: [-4, 4], mean: 0, sd: 1, pdf: (x) => phi(x, 0, 1), cdf: (x) => Phi(x, 0, 1), draw: (r) => { const u = 1 - r(), v = r(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); } },
  { zh: '指数', en: 'exponential', x: [-0.4, 6], mean: 1, sd: 1, pdf: (x) => (x < 0 ? 0 : Math.exp(-x)), cdf: (x) => (x < 0 ? 0 : 1 - Math.exp(-x)), draw: (r) => -Math.log(1 - r()) },
  { zh: '双峰', en: 'two peaks', x: [-3.6, 4], mean: 0.6 * -1.2 + 0.4 * 1.4, sd: Math.sqrt(0.6 * (0.25 + 1.44) + 0.4 * (0.49 + 1.96) - (0.6 * -1.2 + 0.4 * 1.4) ** 2),
    pdf: (x) => 0.6 * phi(x, -1.2, 0.5) + 0.4 * phi(x, 1.4, 0.7), cdf: (x) => 0.6 * Phi(x, -1.2, 0.5) + 0.4 * Phi(x, 1.4, 0.7),
    draw: (r) => { const u = 1 - r(), v = r(), z = Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); return r() < 0.6 ? -1.2 + 0.5 * z : 1.4 + 0.7 * z; } },
];
const NMAX = 10000;
const samples_of = (D, seed = 7) => { const r = mulberry(seed), out = new Float64Array(NMAX); for (let i = 0; i < NMAX; i++) out[i] = D.draw(r); return out; };
// bins of width 2·IQR·n^(−1/3) (Freedman–Diaconis), from the first n samples, covering every one of them
function histogram(xs, n) {
  const a = Array.from(xs.subarray(0, n)).sort((p, q) => p - q), q = (t) => a[Math.min(n - 1, Math.floor(t * (n - 1)))];
  const h = Math.max(0.05, 2 * (q(0.75) - q(0.25)) / Math.cbrt(n)), lo = Math.floor(a[0] / h) * h, k = Math.ceil((a[n - 1] - lo) / h + 1e-9) || 1;
  const counts = new Array(k).fill(0); for (const x of a) counts[Math.min(k - 1, Math.floor((x - lo) / h))]++;
  return { lo, h, counts, dens: counts.map((c) => c / (n * h)) };
}

export function make({ stage, canvas, lang }) {
  const zh = lang === 'zh';
  const cv = canvas2d(canvas), g = cv.ctx;
  const S = { d: 0, n: 300 };
  const all = DISTS.map((D) => samples_of(D));
  const lift = new Spring(0), fall = new Spring(1, 0.9, 1);
  let rows = [];
  const layout = () => { const { W, H } = cv, D = DISTS[S.d]; return { P: new Plot({ x: 40, y: 64, w: W - 80, h: H - 150 }, D.x, [0, D === DISTS[1] ? 1.05 : 0.62], { y_edge: true }), R: { x0: W - 330, x1: W - 40, y: 34 } }; };
  const n_of = (u) => Math.round(Math.pow(10, 1 + 3 * u)), u_of = (n) => (Math.log10(n) - 1) / 3;

  function draw() {
    const { W, H } = cv, { P, R } = layout(), D = DISTS[S.d], xs = all[S.d], n = Math.max(2, Math.round(S.n * fall.x)), hist = histogram(xs, n);
    g.setTransform(cv.dpr, 0, 0, cv.dpr, 0, 0); g.fillStyle = C.paper; g.fillRect(0, 0, W, H);
    P.axes(g, { x_name: 'x', numbers: true, dots: false });
    g.save(); P.clip(g, 1);
    // the bars: area, not height
    hist.dens.forEach((d, i) => {
      const x0 = P.X(hist.lo + i * hist.h), x1 = P.X(hist.lo + (i + 1) * hist.h), y = P.Y(d), y0 = P.Y(0);
      g.fillStyle = tint(C.cobalt, 0.28); g.fillRect(x0 + 0.5, y, x1 - x0 - 1, y0 - y);
      g.strokeStyle = tint(C.cobalt, 0.9); g.lineWidth = 1.2; g.beginPath(); g.moveTo(x0 + 0.5, y); g.lineTo(x1 - 0.5, y); g.stroke();
    });
    // the density it settles onto
    g.strokeStyle = C.ink; g.lineWidth = 1.6; g.beginPath();
    for (let i = 0; i <= 400; i++) { const x = P.x[0] + (P.x[1] - P.x[0]) * i / 400, q = P.P([x, D.pdf(x)]); i ? g.lineTo(q[0], q[1]) : g.moveTo(q[0], q[1]); }
    g.stroke(); g.restore();
    // a tick on the axis for every sample (while they can still be told apart)
    const y0 = P.Y(0);
    if (n <= 2000) { g.strokeStyle = `rgba(26,27,31,${Math.min(0.5, 30 / Math.sqrt(n) * 0.05 + 0.08)})`; g.lineWidth = 0.8; g.beginPath(); for (let i = 0; i < n; i++) { const x = P.X(xs[i]); g.moveTo(x, y0 + 22); g.lineTo(x, y0 + 30); } g.stroke(); }
    // the mean as a fulcrum, one standard deviation either side
    let m = 0; for (let i = 0; i < n; i++) m += xs[i]; m /= n;
    let v = 0; for (let i = 0; i < n; i++) v += (xs[i] - m) ** 2; const sd = Math.sqrt(v / (n - 1));
    const mx = P.X(m), fy = y0 + 36;
    g.fillStyle = C.ink; g.beginPath(); g.moveTo(mx, fy); g.lineTo(mx - 7, fy + 11); g.lineTo(mx + 7, fy + 11); g.closePath(); g.fill();
    dimension(g, [P.X(m - sd), fy + 30], [P.X(m + sd), fy + 30], 's = ' + num(sd, 2), { off: 0 });
    text(g, 'x̄ = ' + num(m, 2), mx + 12, fy + 10, { size: 13, weight: 600, tabular: true, halo: 3 });
    // the shape, and n on its ruler
    rows = choice_row(g, DISTS.map((d) => ({ text: zh ? d.zh : d.en })), S.d, 22, 38);
    g.strokeStyle = GR(0.55); g.lineWidth = 1; g.beginPath(); g.moveTo(R.x0, R.y); g.lineTo(R.x1, R.y); g.stroke();
    for (const t of [10, 100, 1000, 10000]) { const x = R.x0 + (R.x1 - R.x0) * u_of(t); g.beginPath(); g.moveTo(x, R.y); g.lineTo(x, R.y + 5); g.stroke(); text(g, String(t), x, R.y + 18, { size: 11, color: TICK, align: 'center', tabular: true }); }
    const bx = R.x0 + (R.x1 - R.x0) * u_of(S.n);
    glass_bead(g, bx, R.y, 10, lift.x, { dir: 0 });
    sym(g, 'n', R.x0 - 52, R.y + 5, { size: 17 }); text(g, String(n), R.x0 - 38, R.y + 5, { size: 13, weight: 600, tabular: true });
  }

  const hold = drags(canvas, () => {
    const { R } = layout(), bx = R.x0 + (R.x1 - R.x0) * u_of(S.n), items = [];
    for (const c of rows) items.push({ hit: (x, y) => (x > c.x0 && x < c.x1 && y > c.y0 && y < c.y1 ? 0 : Infinity), down: () => { S.d = c.i; fall.snap(0.02).to(1); } });
    items.push({ hit: (x, y) => { const d = Math.hypot(x - bx, y - R.y); return d < 22 ? d : Math.abs(y - R.y) < 12 && x > R.x0 && x < R.x1 ? 40 : Infinity; }, down() { lift.to(1); }, up() { lift.to(0); },
      move: (x) => { S.n = n_of(Math.max(0, Math.min(1, (x - R.x0) / (R.x1 - R.x0)))); fall.snap(1); } });
    return items;
  }, { change: () => sched.wake() });
  const sched = scheduler((dt) => { const busy = [lift.step(dt), fall.step(dt)].some(Boolean); draw(); return busy || !!hold.active; });
  const resize = () => { cv.fit(); draw(); };
  resize(); fall.snap(0.02).to(1); sched.wake(2500);   // the samples fall once, when first seen

  return {
    visible: (v) => sched.set_visible(v), resize,
    async accept() {
      let area_err = 0, worst_p = 1, mean_off = 0;
      // chi-square tail by Wilson–Hilferty
      const chi_p = (x, k) => { const z = (Math.cbrt(x / k) - (1 - 2 / (9 * k))) / Math.sqrt(2 / (9 * k)); return 1 - Phi(z, 0, 1); };
      DISTS.forEach((D, i) => {
        for (const n of [10, 300, NMAX]) { const H = histogram(all[i], n); area_err = Math.max(area_err, Math.abs(H.dens.reduce((s, d) => s + d * H.h, 0) - 1)); }
        // χ² on twenty equal-probability bins from the true distribution
        const K = 20, edges = [-Infinity]; for (let k = 1; k < K; k++) { let a = -20, b = 20; for (let t = 0; t < 80; t++) { const m = (a + b) / 2; if (D.cdf(m) < k / K) a = m; else b = m; } edges.push((a + b) / 2); } edges.push(Infinity);
        const cnt = new Array(K).fill(0); for (const x of all[i]) { let k = 0; while (x > edges[k + 1]) k++; cnt[k]++; }
        const E = NMAX / K, chi = cnt.reduce((s, c) => s + (c - E) ** 2 / E, 0); worst_p = Math.min(worst_p, chi_p(chi, K - 1));
        let m = 0; for (const x of all[i]) m += x; m /= NMAX; mean_off = Math.max(mean_off, Math.abs(m - D.mean) / (D.sd / Math.sqrt(NMAX)));
      });
      const pass = area_err < 1e-12 && worst_p > 0.001 && mean_off < 4;
      return { pass, value: zh ? `面积误差 ${area_err.toExponential(1)}；χ² 检验最小 p = ${worst_p.toFixed(3)}；均值最多偏 ${mean_off.toFixed(2)} 个标准误` : `area error ${area_err.toExponential(1)}; smallest χ² p = ${worst_p.toFixed(3)}; mean off by at most ${mean_off.toFixed(2)} standard errors` };
    },
  };
}
