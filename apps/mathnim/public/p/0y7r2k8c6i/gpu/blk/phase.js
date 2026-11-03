// Time curves and the phase portrait. A damped spring has a state of two numbers, where it is (x) and how fast it moves
// (v). On the right they are drawn against time; on the left the same motion is one curve in the plane of (x, v), a
// spiral winding in to rest. One bead on the time axis scrubs t and the state moves on both pictures at once; the other
// sets where the motion starts. The damping chips choose how quickly it dies away (and, at 1, it no longer swings).
// As a building block: phase({ system, start, t }) linked with time({ x, v }).
import { scheduler, Spring, C, GR, canvas2d } from '../lib/ui.js';
import { Plot, num, text, tint, glass_bead, drags, choice_row } from '../lib/plot.js';

export const meta = {
  id: 'phase',
  name: { zh: '时间曲线与相图', en: 'Time curves and the phase portrait' },
  means: { zh: '阻尼弹簧的状态是两个数：在哪（x）和多快（v）。右边把它们对时间画出来；左边同一个运动是 (x, v) 平面上的一条曲线，螺旋着收到静止。时间轴上的珠子拖动 t，两边的状态一起动；另一颗珠子设定运动从哪开始。阻尼选项决定它消失得多快（到 1 时就不再来回摆）。', en: 'A damped spring’s state is two numbers, where it is (x) and how fast (v). On the right, both against time; on the left the same motion is one curve in the (x, v) plane, spiralling in to rest. One bead scrubs t and the state moves on both pictures; the other sets the start. The damping chips choose how quickly it dies (at 1 it no longer swings).' },
  test: { zh: '数值解与解析解相差 < 10⁻⁶；相图上的点就是同一时刻的 (x(t), v(t))；有阻尼时能量每一步都在减少', en: 'The numerical solution agrees with the exact one to 10⁻⁶; the phase point is (x(t), v(t)) at the same moment; with damping the energy falls at every step' },
  wide: true,
};

const W0 = 2.2, ZS = [0.08, 0.25, 1], TMAX = 12;
// the exact motion for x(0) = x0, v(0) = v0
function exact(z, x0, v0, t) {
  const a = z * W0;
  if (z < 1) { const wd = W0 * Math.sqrt(1 - z * z), A = x0, B = (v0 + a * x0) / wd, e = Math.exp(-a * t), c = Math.cos(wd * t), s = Math.sin(wd * t); return [e * (A * c + B * s), e * ((-a) * (A * c + B * s) + (-A * wd * s + B * wd * c))]; }
  const B = v0 + W0 * x0, e = Math.exp(-W0 * t); return [e * (x0 + B * t), e * (B - W0 * (x0 + B * t))];   // critical
}
// the same motion by RK4 on x″ = −ω²x − 2ζωx′
function rk4(z, x0, v0, T, n) {
  const f = (x, v) => [v, -W0 * W0 * x - 2 * z * W0 * v], h = T / n, out = [[x0, v0]]; let x = x0, v = v0;
  for (let i = 0; i < n; i++) { const k1 = f(x, v), k2 = f(x + h / 2 * k1[0], v + h / 2 * k1[1]), k3 = f(x + h / 2 * k2[0], v + h / 2 * k2[1]), k4 = f(x + h * k3[0], v + h * k3[1]); x += h / 6 * (k1[0] + 2 * k2[0] + 2 * k3[0] + k4[0]); v += h / 6 * (k1[1] + 2 * k2[1] + 2 * k3[1] + k4[1]); out.push([x, v]); }
  return out;
}

export function make({ stage, canvas, lang }) {
  const zh = lang === 'zh';
  const cv = canvas2d(canvas), g = cv.ctx;
  const S = { z: 0, x0: 1.6, v0: 0, t: 3.2 };
  const lt = new Spring(0), ls = new Spring(0);
  let rows = [];
  const layout = () => {
    const { W, H } = cv, s = Math.min(H - 80, W * 0.36), right = 40 + s + 50, rw = W - right - 30, rh = (H - 100) / 2;
    return { Pp: new Plot({ x: 30, y: 60, w: s, h: s }, [-2.2, 2.2], [-4.4, 4.4]), Px: new Plot({ x: right, y: 60, w: rw, h: rh }, [0, TMAX], [-2.2, 2.2], { x_step: 2 }), Pv: new Plot({ x: right, y: 74 + rh, w: rw, h: rh }, [0, TMAX], [-4.4, 4.4], { x_step: 2 }) };
  };

  function draw() {
    const { W, H } = cv, L = layout(), z = ZS[S.z], N = 600, pts = rk4(z, S.x0, S.v0, TMAX, N), k = Math.round(S.t / TMAX * N), [x, v] = pts[k];
    g.setTransform(cv.dpr, 0, 0, cv.dpr, 0, 0); g.fillStyle = C.paper; g.fillRect(0, 0, W, H);
    L.Pp.axes(g, { x_name: 'x', y_name: 'v', numbers: false }); L.Px.axes(g, { x_name: 't', y_name: 'x' }); L.Pv.axes(g, { x_name: 't', y_name: 'v' });
    // the whole motion, faint; the part already lived, solid
    const curve = (P, f, upto, col, w) => { g.strokeStyle = col; g.lineWidth = w; g.lineJoin = 'round'; g.beginPath(); for (let i = 0; i <= upto; i++) { const q = P.P(f(i)); i ? g.lineTo(q[0], q[1]) : g.moveTo(q[0], q[1]); } g.stroke(); };
    for (const [upto, a, w] of [[N, 0.3, 1.2], [k, 1, 2.2]]) {
      curve(L.Pp, (i) => pts[i], upto, a < 1 ? tint(C.ink, 0.3) : C.ink, w);
      curve(L.Px, (i) => [i / N * TMAX, pts[i][0]], upto, a < 1 ? tint(C.cobalt, 0.3) : C.cobalt, w);
      curve(L.Pv, (i) => [i / N * TMAX, pts[i][1]], upto, a < 1 ? tint(C.teal, 0.3) : C.teal, w);
    }
    // now: one state, shown in three places, joined
    const p = L.Pp.P([x, v]), qx = L.Px.P([S.t, x]), qv = L.Pv.P([S.t, v]);
    g.strokeStyle = GR(0.45); g.lineWidth = 1; g.setLineDash([3, 4]); g.beginPath(); g.moveTo(qx[0], L.Px.box.y); g.lineTo(qv[0], L.Pv.box.y + L.Pv.box.h); g.stroke(); g.setLineDash([]);
    for (const [q, col] of [[qx, C.cobalt], [qv, C.teal]]) { g.fillStyle = col; g.beginPath(); g.arc(q[0], q[1], 4.5, 0, Math.PI * 2); g.fill(); }
    g.fillStyle = C.ink; g.beginPath(); g.arc(p[0], p[1], 5, 0, Math.PI * 2); g.fill();
    const s0 = L.Pp.P([S.x0, S.v0]); glass_bead(g, s0[0], s0[1], 10, ls.x);
    glass_bead(g, qx[0], L.Px.box.y + L.Px.box.h + 2, 10, lt.x, { dir: 0 });
    // the numbers, and the damping
    rows = choice_row(g, ZS.map((q) => ({ text: 'ζ = ' + q })), S.z, 22, 36);
    text(g, `t = ${num(S.t, 1)}   x = ${num(x, 2)}   v = ${num(v, 2)}`, W - 30, 36, { size: 14, tabular: true, align: 'right', weight: 600 });
  }

  const hold = drags(canvas, () => {
    const L = layout(), items = [], s0 = L.Pp.P([S.x0, S.v0]), tx = L.Px.X(S.t), ty = L.Px.box.y + L.Px.box.h + 2;
    for (const c of rows) items.push({ hit: (x, y) => (x > c.x0 && x < c.x1 && y > c.y0 && y < c.y1 ? 0 : Infinity), down: () => { S.z = c.i; } });
    items.push({ hit: (x, y) => { const d = Math.hypot(x - s0[0], y - s0[1]); return d < 22 ? d : Infinity; }, down() { ls.to(1); }, up() { ls.to(0); }, move: (x, y) => { S.x0 = Math.max(-2, Math.min(2, L.Pp.ix(x))); S.v0 = Math.max(-4, Math.min(4, L.Pp.iy(y))); } });
    items.push({ hit: (x, y) => { const d = Math.hypot(x - tx, y - ty); return d < 22 ? d : L.Px.inside(x, y) || L.Pv.inside(x, y) ? 50 : Infinity; }, down: (x) => { lt.to(1); S.t = Math.max(0, Math.min(TMAX, L.Px.ix(x))); }, up() { lt.to(0); }, move: (x) => { S.t = Math.max(0, Math.min(TMAX, L.Px.ix(x))); } });
    return items;
  }, { change: () => sched.wake() });
  const sched = scheduler((dt) => { const busy = [lt.step(dt), ls.step(dt)].some(Boolean); draw(); return busy || !!hold.active; });
  const resize = () => { cv.fit(); draw(); };
  resize();

  return {
    visible: (v) => sched.set_visible(v), resize,
    demo() { S.t = TMAX; sched.wake(); },
    async accept() {
      let err = 0, linked = 0, energy = true;
      for (const z of ZS) for (const [x0, v0] of [[1.6, 0], [-1, 3], [0.4, -2.5]]) {
        const N = 6000, pts = rk4(z, x0, v0, TMAX, N);
        for (let i = 0; i <= N; i += 50) { const e = exact(z, x0, v0, i / N * TMAX); err = Math.max(err, Math.abs(pts[i][0] - e[0]), Math.abs(pts[i][1] - e[1])); }
        // the drawn phase point and the two time points come from the same sample
        const L = layout(), i = 2345, t = i / N * TMAX, p = L.Pp.P(pts[i]), qx = L.Px.P([t, pts[i][0]]), qv = L.Pv.P([t, pts[i][1]]);
        linked = Math.max(linked, Math.abs(L.Pp.ix(p[0]) - L.Px.iy(qx[1])), Math.abs(L.Pp.iy(p[1]) - L.Pv.iy(qv[1])), Math.abs(qx[0] - qv[0]));
        const E = pts.map(([x, v]) => 0.5 * v * v + 0.5 * W0 * W0 * x * x);
        for (let j = 1; j < E.length; j++) if (E[j] > E[j - 1] + 1e-12) { energy = false; break; }
      }
      const pass = err < 1e-6 && linked < 1e-9 && energy;
      return { pass, value: zh ? `数值解与解析解最多差 ${err.toExponential(1)}；三处同一状态 ${linked.toExponential(1)}；能量逐步减少 ${energy ? '✓' : '✗'}` : `numerical vs exact ${err.toExponential(1)}; one state in three places ${linked.toExponential(1)}; energy falling ${energy ? '✓' : '✗'}` };
    },
  };
}
