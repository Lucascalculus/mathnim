// Area and accumulation. Sweep x and the area under f piles up from 0; where f is below the axis the area counts
// against the total, so it is hatched (what is taken away). Underneath, the running total A(x) is drawn as it happens:
// solid up to x, dashed beyond (what it will be). At x, A’s slope is f(x): a short teal stroke shows it. The chips
// replace the smooth area with n midpoint rectangles. As a building block: area(f, a, { x, n }) with its total below.
import { scheduler, Spring, C, GR, roundrect } from '../lib/ui.js';
import { Plot, sample, num, text, sym, text_width, tint, stroke_lines, stroke_prov, hatch, glass_bead, drags, polyline, TICK } from '../lib/plot.js';

export const meta = {
  id: 'area',
  name: { zh: '面积与累积', en: 'Area and accumulation' },
  means: { zh: '拖动 x，曲线下的面积从 0 开始堆起来；在轴下面的部分要减掉，所以画成斜线。下面那条线是累积量 A(x)：到 x 为止是实线，后面是虚线。在 x 处，A 的斜率就是 f(x)。', en: 'Drag x and the area under f piles up from 0; below the axis it counts against the total, so it is hatched. Beneath, the running total A(x): solid up to x, dashed beyond. At x, A’s slope is f(x).' },
  test: { zh: '算出的 A(x) 与精确积分相差 < 10⁻⁸；画出的 A 在每一点的斜率等于 f(x)；中点和每把 n 加倍误差缩成约 1/4', en: 'The computed A(x) is within 10⁻⁸ of the exact integral; the drawn A’s slope equals f(x) everywhere; doubling n cuts the midpoint sum’s error by about 4' },
  wide: true,
};

const f = (x) => Math.sin(x) + 0.3;
const F = (x) => 1 - Math.cos(x) + 0.3 * x;          // exact, for the test only: the block integrates f itself
const X1 = 2 * Math.PI;
const NS = [4, 16, 0];                                // 0 = the exact area

// A(x) by composite Simpson on a fine grid, then cubic Hermite between nodes (A' = f exactly at the nodes)
function accumulate(fn, a, b, n = 512) {
  const h = (b - a) / n, A = new Float64Array(n + 1);
  for (let i = 0; i < n; i++) { const x0 = a + i * h; A[i + 1] = A[i] + h / 6 * (fn(x0) + 4 * fn(x0 + h / 2) + fn(x0 + h)); }
  return (x) => {
    const t = Math.max(0, Math.min(n - 1e-9, (x - a) / h)), i = Math.floor(t), u = t - i, x0 = a + i * h;
    const p0 = A[i], p1 = A[i + 1], m0 = fn(x0) * h, m1 = fn(x0 + h) * h;
    return (2 * u ** 3 - 3 * u ** 2 + 1) * p0 + (u ** 3 - 2 * u ** 2 + u) * m0 + (-2 * u ** 3 + 3 * u ** 2) * p1 + (u ** 3 - u ** 2) * m1;
  };
}
const A = accumulate(f, 0, X1);
const midpoint = (n, x) => { if (x <= 0) return 0; const h = x / n; let s = 0; for (let i = 0; i < n; i++) s += f((i + 0.5) * h); return s * h; };

export function make({ stage, canvas, lang }) {
  const zh = lang === 'zh';
  const g = canvas.getContext('2d');
  let W = 0, H = 0, dpr = 1, ni = 2;
  const S = { x: 4.6 };
  const lift = new Spring(0, 0.25, 0.9), grow = new Spring(0, 0.9, 1), rect_k = new Spring(0, 0.35, 0.9);
  const chips = [];
  function plots() {
    const top = 58, gap = 34, h1 = (H - top - gap - 34) * 0.56, h2 = (H - top - gap - 34) * 0.44;
    return [new Plot({ x: 46, y: top, w: W - 84, h: h1 }, [-0.25, X1 + 0.15], [-0.9, 1.5], { x_step: 1, y_step: 1 }),
            new Plot({ x: 46, y: top + h1 + gap, w: W - 84, h: h2 }, [-0.25, X1 + 0.15], [-0.3, 3.9], { x_step: 1, y_step: 1 })];
  }

  function draw() {
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.fillStyle = C.paper; g.fillRect(0, 0, W, H);
    const [P, Q] = plots(), x = S.x * grow.x, n = NS[ni];
    P.axes(g, { x_name: 'x', y_name: 'f' }); Q.axes(g, { x_name: 'x', y_name: 'A' });
    // the area from 0 to x: tinted above the axis, tinted and hatched below it (it is subtracted)
    g.save(); P.clip(g);
    const region = (sign) => () => {
      g.beginPath(); g.moveTo(P.X(0), P.Y(0));
      const N = 160; for (let i = 0; i <= N; i++) { const u = x * i / N, v = f(u); g.lineTo(P.X(u), P.Y(sign > 0 ? Math.max(0, v) : Math.min(0, v))); }
      g.lineTo(P.X(x), P.Y(0)); g.closePath();
    };
    if (n === 0 || rect_k.x < 1) {
      g.globalAlpha = 1 - (n ? rect_k.x : 0);
      region(1)(); g.fillStyle = tint(C.cobalt, 0.26); g.fill();
      region(-1)(); g.fillStyle = tint(C.cobalt, 0.14); g.fill(); hatch(g, region(-1), { spacing: 5, color: GR(0.38) });
      g.globalAlpha = 1;
    }
    if (n && x > 0) {
      g.globalAlpha = rect_k.x; const h = x / n;
      for (let i = 0; i < n; i++) {
        const v = f((i + 0.5) * h), x0 = P.X(i * h), x1 = P.X((i + 1) * h), y0 = P.Y(0), y1 = P.Y(v), path = () => { g.beginPath(); g.rect(x0, Math.min(y0, y1), x1 - x0, Math.abs(y1 - y0)); };
        path(); g.fillStyle = tint(C.cobalt, v >= 0 ? 0.26 : 0.14); g.fill();
        if (v < 0) hatch(g, path, { spacing: 5, color: GR(0.38) });
        path(); g.strokeStyle = tint(C.cobalt, 0.7); g.lineWidth = 0.8; g.stroke();
      }
      g.globalAlpha = 1;
    }
    stroke_lines(g, sample(f, P.x[0], P.x[1], P), C.cobalt, 2.2);
    g.restore();
    // the running total: what has happened is solid, what will happen is dashed
    g.save(); Q.clip(g, 2);
    const done = sample(A, 0, Math.max(1e-6, x), Q), ahead = sample(A, x, X1, Q);
    for (const l of ahead) stroke_prov(g, () => polyline(g, l), C.cobalt, 0, 1.6, 0.55);
    stroke_lines(g, done, C.cobalt, 2.2);
    // A's slope at x is f(x)
    const ax = Q.X(x), ay = Q.Y(A(x)), m = f(x), d = 0.45, s0 = Q.P([x - d, A(x) - m * d]), s1 = Q.P([x + d, A(x) + m * d]);
    g.strokeStyle = C.teal; g.lineWidth = 2; g.lineCap = 'round'; g.beginPath(); g.moveTo(s0[0], s0[1]); g.lineTo(s1[0], s1[1]); g.stroke();
    g.fillStyle = C.cobalt; g.beginPath(); g.arc(ax, ay, 3.6, 0, Math.PI * 2); g.fill();
    g.restore();
    // x, joining both plots
    const px = P.X(x), top_y = P.Y(f(x));
    g.strokeStyle = GR(0.4); g.lineWidth = 1; g.setLineDash([3, 3]); g.beginPath(); g.moveTo(px, top_y); g.lineTo(px, ay); g.stroke(); g.setLineDash([]);
    g.fillStyle = C.cobalt; g.beginPath(); g.arc(px, top_y, 3.6, 0, Math.PI * 2); g.fill();
    glass_bead(g, px, P.Y(0), 11, lift.x, { dir: 0 });
    // the numbers: f(x) on top, the total below (the sum of the rectangles, when they are shown)
    const total = n ? midpoint(n, x) : A(x);
    text(g, num(m, 2), px + 9, top_y - 9, { size: 12.5, weight: 650, color: C.teal, tabular: true, halo: 4 });
    let tx = Math.min(W - 150, ax + 12);
    tx += sym(g, n ? 'Σ' : 'A', tx, ay - 12, { size: 16, halo: 4 });
    text(g, ' = ' + num(total, 3), tx, ay - 12, { size: 14, weight: 650, color: C.ink, tabular: true, halo: 4 });
    // the chips: n rectangles, or the exact area
    let cx = 22; chips.length = 0;
    for (let i = 0; i < NS.length; i++) {
      const lab = NS[i] ? 'n = ' + NS[i] : '∫', w = text_width(g, lab, { size: 14, tabular: true, font: NS[i] ? 'sans' : 'serif' });
      if (i === ni) { g.fillStyle = 'rgba(26,27,31,0.06)'; roundrect(g, cx - 10, 16, w + 20, 28, 14); g.fill(); }
      text(g, lab, cx, 35, { size: NS[i] ? 14 : 17, tabular: true, color: i === ni ? C.ink : TICK, font: NS[i] ? 'sans' : 'serif', italic: !NS[i] });
      chips.push({ x0: cx - 10, x1: cx + w + 10, i }); cx += w + 28;
    }
  }

  const hold = drags(canvas, () => {
    const [P] = plots(), items = [];
    for (const c of chips) items.push({ hit: (x, y) => (y > 14 && y < 46 && x > c.x0 && x < c.x1 ? 0 : Infinity), down: () => { ni = c.i; rect_k.to(NS[ni] ? 1 : 0); } });
    const bx = P.X(S.x), by = P.Y(0);
    items.push({ hit: (x, y) => { const d = Math.hypot(x - bx, y - by); return d < 24 ? d : Math.abs(x - bx) < 18 ? 30 : Infinity; }, down() { lift.to(1); }, move: (x) => { S.x = Math.max(0, Math.min(X1, P.ix(x))); }, up() { lift.to(0); } });
    return items;
  }, { change: () => sched.wake() });

  const sched = scheduler((dt) => { const busy = [lift.step(dt), grow.step(dt), rect_k.step(dt)].some(Boolean); draw(); return busy || !!hold.active; });
  function resize() {
    const r = canvas.getBoundingClientRect(); dpr = Math.min(2, devicePixelRatio || 1);
    W = r.width; H = r.height; canvas.width = Math.max(2, Math.round(W * dpr)); canvas.height = Math.max(2, Math.round(H * dpr));
    draw();
  }
  resize(); grow.to(1); sched.wake(2500);   // the area piles up once, when first seen

  return {
    visible: (v) => sched.set_visible(v), resize,
    demo() { grow.snap(0).to(1); sched.wake(2500); },
    async accept() {
      let err = 0, slope_err = 0;
      for (let i = 0; i <= 400; i++) {
        const x = X1 * i / 400; err = Math.max(err, Math.abs(A(x) - F(x)));
        const d = 1e-5; if (x > d && x < X1 - d) slope_err = Math.max(slope_err, Math.abs((A(x + d) - A(x - d)) / (2 * d) - f(x)));
      }
      // (not over a whole period, where the midpoint rule is exact for a sine)
      const e16 = Math.abs(midpoint(16, 4.6) - F(4.6)), e32 = Math.abs(midpoint(32, 4.6) - F(4.6)), ratio = e16 / e32;
      // where f < 0, A falls: the hatched area is subtracted
      const falls = A(5) < A(4);
      const pass = err < 1e-8 && slope_err < 1e-5 && ratio > 3.6 && ratio < 4.4 && falls;
      return { pass, value: zh ? `A 与精确积分最大差 ${err.toExponential(1)}；斜率与 f 最大差 ${slope_err.toExponential(1)}；n 从 16 到 32 误差之比 ${ratio.toFixed(2)}；轴下的面积让 A 变小 ${falls ? '✓' : '✗'}` : `A vs exact: ${err.toExponential(1)}; slope vs f: ${slope_err.toExponential(1)}; error ratio n 16 → 32: ${ratio.toFixed(2)}; area below the axis lowers A ${falls ? '✓' : '✗'}` };
    },
  };
}
