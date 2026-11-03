// Projection and distance. Drop P onto a line: the foot F is where the perpendicular lands, marked with its right angle.
// Why F and not some other point of the line? The circle around P through F just touches the line there; every other
// point of the line is outside the circle, so farther away. The shadow of P along the line, from O to F, is P·d.
// Drag P, or turn the line by its handle. As a building block: project(p, line, { circle, shadow }).
import { scheduler, Spring, C, GR, canvas2d } from '../lib/ui.js';
import { Plot, num, text, sym, tint, right_angle, glass_bead, drags, dimension } from '../lib/plot.js';

export const meta = {
  id: 'projection',
  name: { zh: '投影与距离', en: 'Projection and distance' },
  means: { zh: '把 P 投到一条线上：垂足 F 是垂线落下的地方，标着直角。为什么是 F 而不是线上别的点？以 P 为圆心、过 F 的圆恰好在 F 处碰到这条线，线上其他点都在圆外，所以都更远。P 沿着线的影子，从 O 到 F，就是 P·d。', en: 'Drop P onto a line: the foot F is where the perpendicular lands, with its right angle. Why F? The circle about P through F just touches the line there; every other point of the line lies outside it, so farther. P’s shadow along the line, from O to F, is P·d.' },
  test: { zh: '400 种 P 和方向：PF 与线垂直（点积 < 10⁻¹²）；线上 2000 个点没有一个比 F 更近；圆的半径等于 P 到线的距离（相切）', en: '400 choices of P and direction: PF is perpendicular to the line (dot product < 10⁻¹²); none of 2000 points on the line is nearer than F; the circle’s radius equals the distance to the line (tangent)' },
};

const foot = (p, d) => { const L2 = d[0] ** 2 + d[1] ** 2, t = (p[0] * d[0] + p[1] * d[1]) / L2; return { F: [d[0] * t, d[1] * t], t: t * Math.sqrt(L2) }; };

export function make({ stage, canvas, lang }) {
  const zh = lang === 'zh';
  const cv = canvas2d(canvas), g = cv.ctx;
  const S = { p: [0.9, 2.1], a: 0.38 };                                 // the point, and the line's angle
  const lp = new Spring(0), la = new Spring(0);
  const plot = () => { const hx = 2.9 * (cv.W - 4) / (cv.H - 4); return new Plot({ x: 2, y: 2, w: cv.W - 4, h: cv.H - 4 }, [-hx + 0.6, hx + 0.6], [-2.9 + 0.6, 2.9 + 0.6]); };
  const R = 2.6;                                                         // where the line's handle sits

  function draw() {
    const { W, H } = cv, P = plot(), d = [Math.cos(S.a), Math.sin(S.a)], { F, t } = foot(S.p, d);
    g.setTransform(cv.dpr, 0, 0, cv.dpr, 0, 0); g.fillStyle = C.paper; g.fillRect(0, 0, W, H);
    P.axes(g, { numbers: false });
    const o = P.P([0, 0]), pp = P.P(S.p), pf = P.P(F), rr = Math.hypot(pp[0] - pf[0], pp[1] - pf[1]);
    // the circle that only touches
    g.strokeStyle = GR(0.45); g.lineWidth = 1; g.setLineDash([3, 4]); g.beginPath(); g.arc(pp[0], pp[1], rr, 0, Math.PI * 2); g.stroke(); g.setLineDash([]);
    // the line
    const a = P.P([-d[0] * 9, -d[1] * 9]), b = P.P([d[0] * 9, d[1] * 9]);
    g.strokeStyle = C.cobalt; g.lineWidth = 2; g.beginPath(); g.moveTo(a[0], a[1]); g.lineTo(b[0], b[1]); g.stroke();
    // the shadow O → F along the line
    g.strokeStyle = tint(C.cobalt, 0.4); g.lineWidth = 7; g.lineCap = 'round'; g.beginPath(); g.moveTo(o[0], o[1]); g.lineTo(pf[0], pf[1]); g.stroke();
    // the perpendicular and its right angle
    g.strokeStyle = C.ochre; g.lineWidth = 2; g.beginPath(); g.moveTo(pp[0], pp[1]); g.lineTo(pf[0], pf[1]); g.stroke();
    if (rr > 14) { const u = [(pp[0] - pf[0]) / rr, (pp[1] - pf[1]) / rr], dl = [b[0] - a[0], b[1] - a[1]], ll = Math.hypot(...dl); right_angle(g, pf, u, [dl[0] / ll * Math.sign(t || 1) * -1, dl[1] / ll * Math.sign(t || 1) * -1], 8); }
    if (rr > 40) dimension(g, ...(((pp[0] - pf[0]) * (b[1] - a[1]) - (pp[1] - pf[1]) * (b[0] - a[0])) > 0 ? [pf, pp] : [pp, pf]), num(rr / P.sx, 2), { off: 16, text_color: '#8a5a0c' });
    g.fillStyle = C.cobalt; g.beginPath(); g.arc(pf[0], pf[1], 4.2, 0, Math.PI * 2); g.fill();
    g.fillStyle = C.ink; g.beginPath(); g.arc(o[0], o[1], 2.6, 0, Math.PI * 2); g.fill();
    // the handles: P, and the line's own bead
    const ph = P.P([d[0] * R, d[1] * R]);
    glass_bead(g, ph[0], ph[1], 10, la.x, { dir: S.a + Math.PI / 2 });
    glass_bead(g, pp[0], pp[1], 11, lp.x, { core: C.ink });
    sym(g, 'P', pp[0] + 14, pp[1] - 10, { size: 17, halo: 4 }); sym(g, 'F', pf[0] + 9, pf[1] + 20, { size: 17, color: C.cobalt, halo: 4 }); sym(g, 'O', o[0] - 18, o[1] + 18, { size: 15, color: C.ink2, halo: 4 });
    let tx = 22; const ty = 36;
    tx += sym(g, 'P · d', tx, ty, { size: 18, halo: 4 }); tx += text(g, ' = ', tx, ty, { size: 16, halo: 4 }); text(g, num(t, 2), tx, ty, { size: 16, weight: 650, tabular: true, color: C.cobalt, halo: 4 });
  }

  const hold = drags(canvas, () => {
    const P = plot(), d = [Math.cos(S.a), Math.sin(S.a)], pp = P.P(S.p), ph = P.P([d[0] * R, d[1] * R]);
    const near = (x, y, q) => { const v = Math.hypot(x - q[0], y - q[1]); return v < 22 ? v : Infinity; };
    return [
      { hit: (x, y) => near(x, y, pp), down() { lp.to(1); }, up() { lp.to(0); }, move: (x, y) => { S.p = [Math.round(P.ix(x) * 20) / 20, Math.round(P.iy(y) * 20) / 20]; } },
      { hit: (x, y) => near(x, y, ph), down() { la.to(1); }, up() { la.to(0); }, move: (x, y) => { const o = P.P([0, 0]); S.a = Math.atan2(o[1] - y, x - o[0]); } },
    ];
  }, { change: () => sched.wake() });
  const sched = scheduler((dt) => { const busy = [lp.step(dt), la.step(dt)].some(Boolean); draw(); return busy || !!hold.active; });
  const resize = () => { cv.fit(); draw(); };
  resize();

  return {
    visible: (v) => sched.set_visible(v), resize,
    async accept() {
      const rnd = (() => { let s = 9; return () => (s = (s * 16807) % 2147483647) / 2147483647; })();
      let dot = 0, nearer = 0, tangent = 0;
      for (let i = 0; i < 400; i++) {
        const a = rnd() * Math.PI * 2, d = [Math.cos(a), Math.sin(a)], p = [rnd() * 6 - 3, rnd() * 6 - 3], { F } = foot(p, d);
        dot = Math.max(dot, Math.abs((p[0] - F[0]) * d[0] + (p[1] - F[1]) * d[1]));
        const best = Math.hypot(p[0] - F[0], p[1] - F[1]);
        for (let k = 0; k < 2000; k++) { const s = -6 + 12 * k / 1999, q = [d[0] * s, d[1] * s]; if (Math.hypot(p[0] - q[0], p[1] - q[1]) < best - 1e-12) { nearer++; break; } }
        // the distance from P to the line, from the line's own equation, against the circle's radius
        tangent = Math.max(tangent, Math.abs(Math.abs(p[0] * d[1] - p[1] * d[0]) - best));
      }
      const pass = dot < 1e-12 && nearer === 0 && tangent < 1e-12;
      return { pass, value: zh ? `400 种：垂直 ${dot.toExponential(1)}；比 F 更近的点 ${nearer}；半径与距离相差 ${tangent.toExponential(1)}` : `400 cases: perpendicular to ${dot.toExponential(1)}; points nearer than F: ${nearer}; radius vs distance ${tangent.toExponential(1)}` };
    },
  };
}
