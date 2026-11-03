// D6 · Sand that builds a histogram. A Galton board: each small steel ball meets one peg in every row and bounces left
// or right with even odds, on a real parabolic arc, then stacks in its bin. The pile is the data, solid; the binomial
// prediction is drawn dashed over it (predicted is hollow, observed is solid). Tap to pour; the pile grows toward the
// curve as the law of large numbers says. Canvas 2D only.
// As a library primitive: a pile where every grain is one observation, for any random process.
import { scheduler, fit2d } from '../lib/ui.js';

export const meta = {
  id: 'sand',
  name: { zh: '沙堆成直方图', en: 'Sand that builds a histogram' },
  means: { zh: '每颗小球在每一排钉子上左右各一半机会；落下的每一颗都是一次观察，堆起来就是直方图，越堆越像虚线画出的二项分布。', en: 'At every row each ball goes left or right with even odds; every ball that lands is one observation, and the pile grows toward the dashed binomial.' },
  test: { zh: '600 颗球的落点与二项分布 B(10, ½) 吻合（卡方检验 p > 0.01）', en: '600 landings fit the binomial B(10, ½) (χ² test, p > 0.01)' },
};

const ROWS = 10, BINS = ROWS + 1;
function chi2_p(x2, k) {
  // the upper tail of the χ² distribution with k degrees of freedom (regularised incomplete gamma, series and fraction)
  const a = k / 2, x = x2 / 2, lg = (z) => { const c = [76.18009172947146, -86.50532032941677, 24.01409824083091, -1.231739572450155, 0.1208650973866179e-2, -0.5395239384953e-5]; let y = z, t = z + 5.5; t -= (z + 0.5) * Math.log(t); let s = 1.000000000190015; for (const ci of c) s += ci / ++y; return -t + Math.log(2.5066282746310005 * s / z); };
  if (x < a + 1) { let s = 1 / a, d = s, ap = a; for (let n = 0; n < 200; n++) { ap++; d *= x / ap; s += d; } return 1 - s * Math.exp(-x + a * Math.log(x) - lg(a)); }
  let b = x + 1 - a, c = 1e300, d = 1 / b, h = d; for (let i = 1; i < 200; i++) { const an = -i * (i - a); b += 2; d = an * d + b; d = 1 / d; c = b + an / c; h *= d * c; } return Math.exp(-x + a * Math.log(x) - lg(a)) * h;
}
const choose = (n, k) => { let r = 1; for (let i = 1; i <= k; i++) r = r * (n - i + 1) / i; return r; };

export function make({ stage, canvas, hud, lang }) {
  const zh = lang === 'zh', ctx = canvas.getContext('2d');
  let W = 0, H = 0, dpr = 1, G = null;
  const balls = [], counts = Array(BINS).fill(0), pile = [];
  let pouring = 0, rng = 1;
  const rand = () => (rng = (rng * 48271) % 2147483647) / 2147483647;
  function fit() {
    ({ W, H, dpr } = fit2d(canvas));
    const sp = Math.min(W / (BINS + 2), H * 0.042), top = H * 0.1;
    G = { sp, top, cx: W / 2, rb: sp * 0.16, rp: sp * 0.14, bin_top: top + ROWS * sp * 0.9 + sp * 0.6, floor: H - 28 };
  }
  const peg = (row, k) => [G.cx + (k - row / 2) * G.sp, G.top + row * G.sp * 0.9];
  function spawn() {
    // a ball starts above the first peg, then hops one peg per row
    const path = [0]; for (let r = 0; r < ROWS; r++) path.push(path[r] + (rand() < 0.5 ? 0 : 1));
    balls.push({ path, row: 0, t: 0, done: false });
  }
  function land(b) { counts[b.path[ROWS]]++; pile.push(1); }
  // the grain size: as many grains as there are, as fine as they must be for the tallest bin to fit (sand gets finer
  // as the count grows, and the pile's outline approaches the curve)
  function grain() {
    const m = Math.max(1, ...counts), Hb = G.floor - G.bin_top - 6;
    let lo = 0.6, hi = G.sp * 0.16;
    const fits = (r) => { const per = Math.max(1, Math.floor(G.sp / (2 * r) - 0.2)); return Math.ceil(m / per) * r * 1.75 + r <= Hb; };
    if (fits(hi)) return hi;
    for (let i = 0; i < 30; i++) { const mid = (lo + hi) / 2; if (fits(mid)) lo = mid; else hi = mid; }
    return lo;
  }
  function step(dt) {
    if (pouring > 0) { const n = Math.min(pouring, Math.ceil(dt * 90)); for (let i = 0; i < n; i++) spawn(); pouring -= n; }
    for (const b of balls) {
      if (b.done) continue;
      b.t += dt * 6.5;
      if (b.t >= 1) { b.t -= 1; b.row++; if (b.row >= ROWS) { b.done = true; land(b); } }
    }
    for (let i = balls.length - 1; i >= 0; i--) if (balls[i].done) balls.splice(i, 1);
  }
  // where a ball is between peg row r and r + 1: a parabolic hop off the peg it just hit
  function pos(b) {
    const r = b.row, k0 = b.path[r], k1 = b.path[r + 1], a = peg(r, k0), c = peg(r + 1, k1);
    const t = b.t, x = a[0] + (c[0] - a[0]) * t, y = a[1] - G.rb - G.rp + (c[1] - a[1]) * t * t - Math.sin(t * Math.PI) * G.sp * 0.22;
    return [x, y];
  }
  function ball(x, y) {
    const g = ctx.createRadialGradient(x - G.rb * 0.35, y - G.rb * 0.4, G.rb * 0.1, x, y, G.rb);
    g.addColorStop(0, '#ffffff'); g.addColorStop(0.35, '#c9ccd1'); g.addColorStop(1, '#5d6168');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, G.rb, 0, Math.PI * 2); ctx.fill();
  }
  function draw() {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.fillStyle = '#fbfaf7'; ctx.fillRect(0, 0, W, H);
    // the pegs: small plaster studs
    for (let r = 0; r < ROWS; r++) for (let k = 0; k <= r; k++) { const [x, y] = peg(r, k); ctx.fillStyle = 'rgba(26,27,31,.12)'; ctx.beginPath(); ctx.arc(x + 1, y + 1.5, G.rp, 0, Math.PI * 2); ctx.fill(); const pg = ctx.createRadialGradient(x - G.rp * 0.3, y - G.rp * 0.4, 0, x, y, G.rp); pg.addColorStop(0, '#ffffff'); pg.addColorStop(1, '#cfcbc3'); ctx.fillStyle = pg; ctx.beginPath(); ctx.arc(x, y, G.rp, 0, Math.PI * 2); ctx.fill(); }
    // the bins' walls
    ctx.strokeStyle = 'rgba(26,27,31,.25)'; ctx.lineWidth = 1;
    for (let k = 0; k <= BINS; k++) { const x = G.cx + (k - 0.5 - ROWS / 2) * G.sp; ctx.beginPath(); ctx.moveTo(x, G.bin_top); ctx.lineTo(x, G.floor); ctx.stroke(); }
    ctx.beginPath(); ctx.moveTo(G.cx - (BINS / 2) * G.sp, G.floor); ctx.lineTo(G.cx + (BINS / 2) * G.sp, G.floor); ctx.stroke();
    const rb = grain(), keep = G.rb; G.rb = rb;
    const per = Math.max(1, Math.floor(G.sp / (2 * rb) - 0.2));
    for (let k = 0; k < BINS; k++) for (let n = 0; n < counts[k]; n++) { const col = n % per, lay = Math.floor(n / per); ball(G.cx + (k - ROWS / 2) * G.sp + (col - (per - 1) / 2) * 2 * rb + (lay % 2 ? rb * 0.5 : 0), G.floor - rb - lay * rb * 1.75); }
    for (const b of balls) { const [x, y] = pos(b); ball(x, y); }
    // the prediction, dashed: the binomial, scaled to how many have landed, in the same units as the pile
    const n = pile.length; if (n > 0) {
      const hpb = rb * 1.75 / per;
      ctx.setLineDash([4, 4]); ctx.strokeStyle = '#1a1b1f'; ctx.lineWidth = 1.5; ctx.beginPath();
      for (let k = 0; k <= ROWS; k++) { const e = n * choose(ROWS, k) / 2 ** ROWS, x = G.cx + (k - ROWS / 2) * G.sp, y = G.floor - e * hpb * 2 * G.rb / (2 * G.rb) * (1) - 0; k ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }
      ctx.stroke(); ctx.setLineDash([]);
    }
    G.rb = keep; hud.innerHTML = `${n} ${zh ? '颗' : 'balls'}`;
  }
  const sched = scheduler((dt) => { step(Math.min(dt, 1 / 30)); draw(); return balls.length > 0 || pouring > 0; });
  canvas.addEventListener('pointerdown', () => { pouring += 120; sched.wake(); });
  fit(); pouring = 200; for (let i = 0; i < 260; i++) step(1 / 60); draw();
  return {
    visible: (v) => sched.set_visible(v), resize: () => { fit(); pile.length = 0; counts.fill(0); balls.length = 0; pouring = 200; sched.wake(); },
    demo() { pouring += 200; sched.wake(); },
    async accept() {
      // 600 fresh landings, simulated without drawing; χ² against B(10, ½), pooling bins with expectation < 5
      const c = Array(BINS).fill(0); for (let i = 0; i < 600; i++) { let k = 0; for (let r = 0; r < ROWS; r++) k += rand() < 0.5 ? 0 : 1; c[k]++; }
      const groups = [[0, 1, 2], [3], [4], [5], [6], [7], [8, 9, 10]];
      let x2 = 0; for (const g of groups) { const e = g.reduce((s, k) => s + 600 * choose(ROWS, k) / 1024, 0), o = g.reduce((s, k) => s + c[k], 0); x2 += (o - e) ** 2 / e; }
      const p = chi2_p(x2, groups.length - 1);
      return { pass: p > 0.01, value: `χ² = ${x2.toFixed(2)}, ${groups.length - 1} ${zh ? '自由度' : 'd.o.f.'}, p = ${p.toFixed(3)}` };
    },
  };
}
