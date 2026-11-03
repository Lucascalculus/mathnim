// Paths on a landscape. Gradient descent walks downhill one step at a time: from where it stands, a step of η times the
// slope, straight down the steepest way. On a long narrow valley that way points across the valley, so the path
// zigzags; a bigger η zigzags harder, and past 2 / L it flies out of the valley altogether. Momentum keeps part of the
// last step, so the walk gathers speed along the valley and reaches the bottom sooner. Put the start anywhere; slide η.
// As a building block: path_on(f, { method, rate, start }) over a contour map.
import { scheduler, Spring, C, GR, canvas2d } from '../lib/ui.js';
import { Plot, num, text, sym, tint, ring_dot, glass_bead, drags, choice_row, TICK } from '../lib/plot.js';
import { contour } from '../lib/contour.js';

export const meta = {
  id: 'descent',
  name: { zh: '地形上的路径', en: 'Paths on a landscape' },
  means: { zh: '梯度下降一步一步往下走：每步从脚下沿最陡的方向走 η 倍的坡度。在又长又窄的山谷里，最陡的方向横穿山谷，所以路线来回折；η 越大折得越厉害，超过 2 / L 就飞出山谷。动量保留上一步的一部分，顺着山谷越走越快，更早到谷底。起点放在哪都行，拖动 η。', en: 'Gradient descent steps downhill: from where it stands, η times the slope, the steepest way down. In a long narrow valley that way points across it, so the path zigzags; a bigger η zigzags harder, and past 2 / L it flies out. Momentum keeps part of the last step, gathers speed along the valley and arrives sooner.' },
  test: { zh: '每一步都恰好是公式算出的那一步；η < 2/L 时每步都更低并到达谷底，η > 2/L 时发散，和画面上说的一致；同样的 η 下动量比普通下降用的步数少', en: 'Every step is exactly the formula’s step; for η < 2/L each step is lower and reaches the bottom, for η > 2/L it diverges, as the picture says; at the same η momentum takes fewer steps than plain descent' },
  wide: true,
};

// a long, narrow valley turned 30°: f = ½(λ₁u² + λ₂v²), L = λ₂ is its steepest curvature
const L1 = 1, L2 = 9, TH = Math.PI / 6, cs = Math.cos(TH), sn = Math.sin(TH);
const uv = (x, y) => [cs * x + sn * y, -sn * x + cs * y];
const f = (x, y) => { const [u, v] = uv(x, y); return 0.5 * (L1 * u * u + L2 * v * v); };
const grad = (x, y) => { const [u, v] = uv(x, y), gu = L1 * u, gv = L2 * v; return [cs * gu - sn * gv, sn * gu + cs * gv]; };
const BETA = 0.5, ETA_MAX = 0.26;      // (with β = 0.5 the heavy ball is quicker than plain descent at every stable η here)

// the walk: plain descent, or with momentum (heavy ball)
function walk(p0, eta, mom, n = 120) {
  const pts = [p0.slice()]; let p = p0.slice(), m = [0, 0];
  for (let k = 0; k < n; k++) {
    const gr = grad(...p);
    m = mom ? [BETA * m[0] - eta * gr[0], BETA * m[1] - eta * gr[1]] : [-eta * gr[0], -eta * gr[1]];
    p = [p[0] + m[0], p[1] + m[1]]; pts.push(p);
    if (Math.hypot(...p) > 50) break;                                  // gone
    if (Math.hypot(...p) < 1e-3 && Math.hypot(...m) < 1e-4) break;     // arrived
  }
  return pts;
}
const steps_to = (pts, tol = 1e-2) => { const k = pts.findIndex((p) => Math.hypot(...p) < tol); return k < 0 ? Infinity : k; };

export function make({ stage, canvas, lang }) {
  const zh = lang === 'zh';
  const cv = canvas2d(canvas), g = cv.ctx;
  const S = { start: [-2.6, -1.1], eta: 0.15, mom: 0 };     // just off the valley floor, far along it
  const ls = new Spring(0), le = new Spring(0), shown = new Spring(0, 1.6, 1);
  let rows = [];
  const layout = () => { const { W, H } = cv, h = H - 60, hx = 2.1 * (W - 4) / h; return { P: new Plot({ x: 2, y: 54, w: W - 4, h: h - 4 }, [-hx, hx], [-2.1, 2.1]), R: { x0: W - 300, x1: W - 40, y: 32 } }; };

  function draw() {
    const { W, H } = cv, { P, R } = layout();
    g.setTransform(cv.dpr, 0, 0, cv.dpr, 0, 0); g.fillStyle = C.paper; g.fillRect(0, 0, W, H);
    // the valley's contours (levels spaced so that they look even)
    g.save(); P.clip(g);
    for (let k = 1; k <= 14; k++) {
      const c = 0.035 * k * k;
      for (const l of contour(f, { x: P.x, y: P.y }, 120, 70, c)) { g.strokeStyle = tint(C.cobalt, k % 5 === 0 ? 0.6 : 0.35); g.lineWidth = k % 5 === 0 ? 1.2 : 0.8; g.beginPath(); l.forEach((p, i) => { const q = P.P(p); i ? g.lineTo(q[0], q[1]) : g.moveTo(q[0], q[1]); }); g.stroke(); }
    }
    // the path, step by step, revealed once after every change
    const pts = walk(S.start, S.eta, S.mom), n = Math.min(pts.length, 1 + Math.floor(shown.x * (pts.length - 1)));
    g.strokeStyle = C.ink; g.lineWidth = 1.2; g.lineJoin = 'round'; g.beginPath();
    for (let i = 0; i < n; i++) { const q = P.P(pts[i]); i ? g.lineTo(q[0], q[1]) : g.moveTo(q[0], q[1]); }
    g.stroke();
    for (let i = 1; i < n; i++) { const q = P.P(pts[i]); if (!P.inside(q[0], q[1], 10)) continue; g.fillStyle = C.ink; g.beginPath(); g.arc(q[0], q[1], 2.4, 0, Math.PI * 2); g.fill(); }
    const bottom = P.P([0, 0]); ring_dot(g, bottom[0], bottom[1], 5, C.cobalt, 0, 1.6);
    g.restore();
    const s = P.P(S.start); glass_bead(g, s[0], s[1], 11, ls.x, { core: C.ink });
    // the method, and how it went
    rows = choice_row(g, [{ text: zh ? '梯度下降' : 'descent' }, { text: zh ? '加动量' : 'momentum' }], S.mom, 22, 38);
    const k = steps_to(pts), gone = Math.hypot(...pts[pts.length - 1]) > 50;
    text(g, gone ? (zh ? '飞出去了' : 'flew off') : k === Infinity ? '…' : (zh ? `${k} 步到谷底` : `${k} steps to the bottom`), rows[1].x1 + 26, 38, { size: 14, weight: 600, color: gone ? C.ink : C.cobalt, tabular: true });
    // η on its ruler, with the edge 2/L marked
    g.strokeStyle = GR(0.55); g.lineWidth = 1; g.beginPath(); g.moveTo(R.x0, R.y); g.lineTo(R.x1, R.y); g.stroke();
    const X = (e) => R.x0 + (R.x1 - R.x0) * e / ETA_MAX, edge = X(2 / L2);
    g.strokeStyle = C.ink2; g.setLineDash([2, 2]); g.beginPath(); g.moveTo(edge, R.y - 8); g.lineTo(edge, R.y + 8); g.stroke(); g.setLineDash([]);
    text(g, '2/L', edge, R.y + 21, { size: 11, color: TICK, align: 'center', font: 'serif', italic: true });
    const bx = X(S.eta); glass_bead(g, bx, R.y, 10, le.x, { dir: 0 });
    sym(g, 'η', R.x0 - 66, R.y + 5, { size: 17 }); text(g, num(S.eta, 3), R.x0 - 52, R.y + 5, { size: 13, weight: 600, tabular: true, align: 'left', color: C.ink, halo: 3 });
  }

  const hold = drags(canvas, () => {
    const { P, R } = layout(), s = P.P(S.start), bx = R.x0 + (R.x1 - R.x0) * S.eta / ETA_MAX, items = [];
    for (const c of rows) items.push({ hit: (x, y) => (x > c.x0 && x < c.x1 && y > c.y0 && y < c.y1 ? 0 : Infinity), down: () => { S.mom = c.i; shown.snap(0).to(1); } });
    items.push({ hit: (x, y) => { const d = Math.hypot(x - s[0], y - s[1]); return d < 22 ? d : Infinity; }, down() { ls.to(1); }, up() { ls.to(0); shown.snap(0).to(1); }, move: (x, y) => { S.start = [P.ix(x), P.iy(y)]; shown.snap(1); } });
    items.push({ hit: (x, y) => { const d = Math.hypot(x - bx, y - R.y); return d < 22 ? d : Math.abs(y - R.y) < 12 && x > R.x0 && x < R.x1 ? 40 : Infinity; }, down() { le.to(1); }, up() { le.to(0); shown.snap(0).to(1); },
      move: (x) => { S.eta = Math.max(0.005, Math.min(ETA_MAX, Math.round((x - R.x0) / (R.x1 - R.x0) * ETA_MAX * 200) / 200)); shown.snap(1); } });
    return items;
  }, { change: () => sched.wake() });
  const sched = scheduler((dt) => { const busy = [ls.step(dt), le.step(dt), shown.step(dt)].some(Boolean); draw(); return busy || !!hold.active; });
  const resize = () => { cv.fit(); draw(); };
  resize(); shown.to(1); sched.wake(2500);

  return {
    visible: (v) => sched.set_visible(v), resize,
    async accept() {
      // 1. each step is the formula's step
      let step_err = 0;
      for (const mom of [0, 1]) { const pts = walk([-2.6, -1.1], 0.15, mom, 40); let m = [0, 0]; for (let k = 0; k + 1 < pts.length; k++) { const gr = grad(...pts[k]); m = mom ? [BETA * m[0] - 0.15 * gr[0], BETA * m[1] - 0.15 * gr[1]] : [-0.15 * gr[0], -0.15 * gr[1]]; step_err = Math.max(step_err, Math.hypot(pts[k + 1][0] - pts[k][0] - m[0], pts[k + 1][1] - pts[k][1] - m[1])); } }
      // 2. below 2/L: always lower and arrives; above: diverges
      let wrong = 0;
      for (let i = 1; i <= 50; i++) {
        const eta = ETA_MAX * i / 50, pts = walk([-2.6, -1.1], eta, 0, 6000), stable = eta < 2 / L2 - 1e-9;   // (the smallest rates need thousands of steps)
        const lower = pts.every((p, k) => k === 0 || f(...p) < f(...pts[k - 1]) + 1e-15), arrives = steps_to(pts) < Infinity, gone = Math.hypot(...pts[pts.length - 1]) > 50 || f(...pts[pts.length - 1]) > f(-2.6, 0.9);
        if (Math.abs(eta - 2 / L2) < 0.004) continue;                     // right at the edge it neither arrives nor leaves
        if (stable ? !(lower && arrives) : !gone) wrong++;
      }
      // 3. momentum is quicker at the same rate
      const plain = steps_to(walk([-2.6, -1.1], 0.15, 0, 400)), heavy = steps_to(walk([-2.6, -1.1], 0.15, 1, 400));
      const pass = step_err < 1e-12 && wrong === 0 && heavy < plain;
      return { pass, value: zh ? `步长误差 ${step_err.toExponential(1)}；50 个 η 中判断错 ${wrong} 个；η = 0.15 时普通 ${plain} 步、动量 ${heavy} 步` : `step error ${step_err.toExponential(1)}; ${wrong} of 50 rates misjudged; at η = 0.15: plain ${plain} steps, momentum ${heavy}` };
    },
  };
}
