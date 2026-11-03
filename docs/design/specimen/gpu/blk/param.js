// A parametric curve. A point travels along r(t) as t runs from 0 to 2π. Small ticks across the curve mark equal
// steps of time, so where they spread the point is fast and where they crowd it is slow; the velocity r′(t) is the
// arrow that rides with the point, tangent to the curve, as long as the point is fast. Scrub t on its ruler, or take
// the point itself and slide it along. As a building block: path(r, [t0, t1], { t, ticks, velocity }).
import { scheduler, Spring, C, GR, canvas2d } from '../lib/ui.js';
import { Plot, num, text, sym, tint, arrow, glass_bead, drags, TICK } from '../lib/plot.js';

export const meta = {
  id: 'param',
  name: { zh: '参数曲线', en: 'A parametric curve' },
  means: { zh: '点沿着 r(t) 走，t 从 0 到 2π。曲线上的小刻度隔着相等的时间：刻度疏的地方点走得快，密的地方慢。速度 r′(t) 是跟着点走的箭头，贴着曲线，越快越长。拖下面尺子上的 t，或者直接拿着点沿曲线滑。', en: 'A point travels r(t) as t runs from 0 to 2π. Ticks mark equal steps of time: where they spread the point is fast, where they crowd it is slow. The velocity r′(t) rides with the point, tangent and as long as it is fast. Scrub t, or slide the point itself.' },
  test: { zh: '箭头与数值导数相差 < 10⁻⁶ 且与曲线相切；相邻刻度的间距 = 速度 × Δt（误差 < 1%）；把点拖到曲线上任一处，找回的 t 让点离手指 < 0.5 px', en: 'The arrow matches the numerical derivative within 10⁻⁶ and is tangent; the gap between ticks is speed × Δt (within 1%); dragging to any point of the curve finds a t within 0.5 px of the finger' },
};

// a trefoil: three lobes, the point slows in the loops and speeds through the middle
const r = (t) => [Math.sin(t) + 2 * Math.sin(2 * t), Math.cos(t) - 2 * Math.cos(2 * t)];
const dr = (t) => [Math.cos(t) + 4 * Math.cos(2 * t), -Math.sin(t) + 4 * Math.sin(2 * t)];
const TAU = Math.PI * 2, NT = 72, VK = 0.32;                     // ticks per turn; arrow length per unit of speed
const TLAB = ['0', 'π/2', 'π', '3π/2', '2π'];

export function make({ stage, canvas, lang }) {
  const zh = lang === 'zh';
  const cv = canvas2d(canvas), g = cv.ctx;
  const t = new Spring(0.9, 0.5, 0.9), lift = new Spring(0, 0.25, 0.9), lift2 = new Spring(0, 0.25, 0.9);
  const layout = () => {
    const { W, H } = cv, h = H - 90, hx = 3.4 * Math.max(1, (W * 0.62) / h);
    return { P: new Plot({ x: 20, y: 18, w: W - 40, h }, [-hx, hx], [-3.4, 3.4], { equal: true }), ruler: { x0: 60, x1: W - 60, y: H - 34 } };
  };
  const t_of_x = (R, x) => Math.max(0, Math.min(TAU, (x - R.x0) / (R.x1 - R.x0) * TAU));
  // the t whose point is nearest a canvas point: coarse over the curve, then refined
  function nearest_t(P, x, y) {
    let bt = 0, bd = Infinity;
    for (let i = 0; i <= 720; i++) { const s = i / 720 * TAU, p = P.P(r(s)), d = Math.hypot(p[0] - x, p[1] - y); if (d < bd) { bd = d; bt = s; } }
    let a = bt - TAU / 720, b = bt + TAU / 720;
    for (let k = 0; k < 60; k++) { const m1 = a + (b - a) / 3, m2 = b - (b - a) / 3, p1 = P.P(r(m1)), p2 = P.P(r(m2)); if (Math.hypot(p1[0] - x, p1[1] - y) < Math.hypot(p2[0] - x, p2[1] - y)) b = m2; else a = m1; }
    return ((a + b) / 2 + TAU) % TAU;
  }

  function draw() {
    const { W, H } = cv, { P, ruler: R } = layout(), tt = t.x;
    g.setTransform(cv.dpr, 0, 0, cv.dpr, 0, 0); g.fillStyle = C.paper; g.fillRect(0, 0, W, H);
    P.axes(g, { numbers: false });
    // the curve, solid where the point has been, faint ahead
    g.lineCap = 'round'; g.lineJoin = 'round';
    for (const [a, b, col, w] of [[tt, TAU, tint(C.cobalt, 0.45), 1.6], [0, tt, C.cobalt, 2.3]]) {
      g.strokeStyle = col; g.lineWidth = w; g.beginPath();
      const n = Math.max(2, Math.ceil((b - a) / TAU * 600));
      for (let i = 0; i <= n; i++) { const p = P.P(r(a + (b - a) * i / n)); i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1]); }
      g.stroke();
    }
    // equal steps of time
    g.strokeStyle = GR(0.6); g.lineWidth = 1;
    for (let k = 0; k < NT; k++) {
      const s = k / NT * TAU, p = P.P(r(s)), d = dr(s), L = Math.hypot(d[0], d[1]) || 1, n = [-d[1] / L, -d[0] / L], len = k % 6 === 0 ? 6 : 3.5;
      g.beginPath(); g.moveTo(p[0] - n[0] * len, p[1] - n[1] * len); g.lineTo(p[0] + n[0] * len, p[1] + n[1] * len); g.stroke();
    }
    // the point and its velocity
    const p = P.P(r(tt)), d = dr(tt), v = Math.hypot(d[0], d[1]);
    arrow(g, p[0], p[1], p[0] + d[0] * VK * P.sx, p[1] - d[1] * VK * P.sy, C.teal, 2.2, 10);
    glass_bead(g, p[0], p[1], 10, lift2.x, { dir: Math.atan2(-d[1], d[0]), core: C.cobalt });
    let tx = 22; const ty = 34;
    tx += text(g, '|', tx, ty, { size: 16 }) + 1; tx += sym(g, 'r′', tx, ty, { size: 17 }) - 2; tx += text(g, '| = ', tx, ty, { size: 16 });
    text(g, num(v, 2), tx, ty, { size: 16, weight: 650, color: C.teal, tabular: true });
    // the ruler of time
    g.strokeStyle = GR(0.55); g.lineWidth = 1; g.beginPath(); g.moveTo(R.x0, R.y); g.lineTo(R.x1, R.y); g.stroke();
    for (let i = 0; i <= 4; i++) { const x = R.x0 + (R.x1 - R.x0) * i / 4; g.beginPath(); g.moveTo(x, R.y); g.lineTo(x, R.y + 5); g.stroke(); text(g, TLAB[i], x, R.y + 19, { size: 12, color: TICK, align: 'center', font: 'serif', italic: i > 0 }); }
    g.strokeStyle = C.cobalt; g.lineWidth = 2.2; g.beginPath(); g.moveTo(R.x0, R.y); g.lineTo(R.x0 + (R.x1 - R.x0) * tt / TAU, R.y); g.stroke();
    const bx = R.x0 + (R.x1 - R.x0) * tt / TAU;
    glass_bead(g, bx, R.y, 10, lift.x, { dir: 0 });
    sym(g, 't', bx - 4, R.y - 17, { size: 15, halo: 4 });
  }

  const hold = drags(canvas, () => {
    const { P, ruler: R } = layout(), bx = R.x0 + (R.x1 - R.x0) * t.x / TAU, p = P.P(r(t.x));
    return [
      { hit: (x, y) => { const d = Math.hypot(x - bx, y - R.y); return d < 22 ? d : Math.abs(y - R.y) < 14 && x > R.x0 - 8 && x < R.x1 + 8 ? 40 : Infinity; }, down: (x) => { lift.to(1); t.snap(t_of_x(R, x)); }, move: (x) => t.snap(t_of_x(R, x)), up() { lift.to(0); } },
      { hit: (x, y) => { const d = Math.hypot(x - p[0], y - p[1]); return d < 22 ? d : Infinity; }, down() { lift2.to(1); }, move: (x, y) => t.snap(nearest_t(P, x, y)), up() { lift2.to(0); } },
    ];
  }, { change: () => sched.wake() });
  const sched = scheduler((dt) => { const busy = [t.step(dt), lift.step(dt), lift2.step(dt)].some(Boolean); draw(); return busy || !!hold.active; });
  const resize = () => { cv.fit(); draw(); };
  resize();

  return {
    visible: (v) => sched.set_visible(v), resize,
    demo() { t.to(TAU); sched.wake(3000); },
    async accept() {
      const { P } = layout();
      let d_err = 0, tan_err = 0, tick_err = 0, find_err = 0;
      for (let i = 0; i < 40; i++) {
        const s = 0.07 + i / 40 * TAU, h = 1e-5, a = r(s - h), b = r(s + h), num_d = [(b[0] - a[0]) / (2 * h), (b[1] - a[1]) / (2 * h)], d = dr(s);
        d_err = Math.max(d_err, Math.hypot(num_d[0] - d[0], num_d[1] - d[1]) / Math.max(1, Math.hypot(...d)));
        const c0 = r(s - 1e-3), c1 = r(s + 1e-3), ch = [c1[0] - c0[0], c1[1] - c0[1]];   // the chord through the point
        tan_err = Math.max(tan_err, Math.abs(ch[0] * d[1] - ch[1] * d[0]) / (Math.hypot(...ch) * Math.hypot(...d)));
        const q = P.P(r(s)), found = nearest_t(P, q[0], q[1]), fq = P.P(r(found));
        find_err = Math.max(find_err, Math.hypot(fq[0] - q[0], fq[1] - q[1]));
      }
      // equal steps of time: the gap between neighbouring ticks is the speed there times Δt (sparse = fast)
      const dt = TAU / NT;
      for (let k = 0; k < NT; k++) { const a = r(k * dt), b = r((k + 1) * dt), v = Math.hypot(...dr((k + 0.5) * dt)); tick_err = Math.max(tick_err, Math.abs(Math.hypot(b[0] - a[0], b[1] - a[1]) / (v * dt) - 1)); }
      const pass = d_err < 1e-6 && tan_err < 1e-5 && tick_err < 0.01 && find_err < 0.5;
      return { pass, value: zh ? `导数误差 ${d_err.toExponential(1)}；与切线夹角 ${tan_err.toExponential(1)} rad；刻度间距 = 速度 × Δt，误差 ${(tick_err * 100).toFixed(2)}%；拖到曲线上找回的点最多差 ${find_err.toFixed(3)} px` : `derivative error ${d_err.toExponential(1)}; off the tangent by ${tan_err.toExponential(1)} rad; tick gap = speed × Δt within ${(tick_err * 100).toFixed(2)}%; a dragged point is found within ${find_err.toFixed(3)} px` };
    },
  };
}
