// Vectors and their span. Two vectors u and v lay a slanted grid over the plane: every crossing is a whole-number mix of
// them. Put the target w anywhere and the walk to it is drawn tip to tail, a·u then b·v, with a and b written in their
// colours. Make u and v line up and the grid collapses onto one line: that line is all they can reach, so a w off it is
// hollow (not reachable) and the walk stops at the nearest point it can reach. As a building block: span(u, v, { w }).
import { scheduler, Spring, C, GR, canvas2d } from '../lib/ui.js';
import { Plot, num, text, sym, tint, arrow, ring_dot, right_angle, glass_bead, drags } from '../lib/plot.js';

export const meta = {
  id: 'vectors',
  name: { zh: '向量与张成', en: 'Vectors and their span' },
  means: { zh: 'u 和 v 在平面上铺一张斜的网格：每个交点都是它们的整数组合。把目标 w 放在任何地方，到它的路就首尾相接地画出来：先 a·u，再 b·v。让 u 和 v 共线，网格塌成一条线：它们只够得着这条线，线外的 w 变成空心，路停在够得着的最近处。', en: 'u and v lay a slanted grid: every crossing is a whole mix of them. Put w anywhere and the walk to it is drawn tip to tail, a·u then b·v. Line u and v up and the grid collapses to one line, all they can reach: a w off it turns hollow and the walk stops at the nearest reachable point.' },
  test: { zh: '300 组随机的 u、v、w：a·u + b·v 与 w 相差 < 10⁻¹²；共线时路的终点就是 w 在那条线上的垂足（与 w 的连线垂直于它）', en: '300 random u, v, w: a·u + b·v is within 10⁻¹² of w; when u and v line up, the walk ends at the foot of w on their line (the gap is perpendicular to it)' },
};

const SNAP = 0.1;
// the mix a·u + b·v that reaches w, or (when u ∥ v) the nearest point of their line
function solve(u, v, w) {
  const D = u[0] * v[1] - u[1] * v[0], n = Math.max(Math.hypot(...u), Math.hypot(...v)) ** 2;
  if (Math.abs(D) > 1e-6 * n) return { a: (w[0] * v[1] - w[1] * v[0]) / D, b: (u[0] * w[1] - u[1] * w[0]) / D, span: 2 };
  const d = Math.hypot(...u) > 1e-9 ? u : v, L2 = d[0] ** 2 + d[1] ** 2 || 1, t = (w[0] * d[0] + w[1] * d[1]) / L2;
  return d === u ? { a: t, b: 0, span: 1, dir: d } : { a: 0, b: t, span: 1, dir: d };
}

export function make({ stage, canvas, lang }) {
  const zh = lang === 'zh';
  const cv = canvas2d(canvas), g = cv.ctx;
  const S = { u: [1.6, 0.4], v: [0.5, 1.3], w: [2.8, 2.2] };
  const L = { u: new Spring(0), v: new Spring(0), w: new Spring(0) };
  const plot = () => { const hx = 3.4 * (cv.W - 4) / (cv.H - 4); return new Plot({ x: 2, y: 2, w: cv.W - 4, h: cv.H - 4 }, [-hx + 1.2, hx + 1.2], [-3.4 + 0.8, 3.4 + 0.8]); };

  function draw() {
    const { W, H } = cv, P = plot(), { u, v, w } = S, sol = solve(u, v, w);
    g.setTransform(cv.dpr, 0, 0, cv.dpr, 0, 0); g.fillStyle = C.paper; g.fillRect(0, 0, W, H);
    P.axes(g, { numbers: false });
    g.save(); P.clip(g);
    if (sol.span === 2) {
      // the slanted grid: lines through k·u along v, and through k·v along u
      g.lineWidth = 0.8;
      for (let k = -14; k <= 14; k++) for (const [o, d, col] of [[u, v, C.viridian], [v, u, C.violet]]) {
        const p = P.P([o[0] * k - d[0] * 30, o[1] * k - d[1] * 30]), q = P.P([o[0] * k + d[0] * 30, o[1] * k + d[1] * 30]);
        g.strokeStyle = tint(col, k === 0 ? 0.55 : 0.22); g.beginPath(); g.moveTo(p[0], p[1]); g.lineTo(q[0], q[1]); g.stroke();
      }
    } else {
      const d = sol.dir, p = P.P([-d[0] * 40, -d[1] * 40]), q = P.P([d[0] * 40, d[1] * 40]);
      g.strokeStyle = tint(C.cobalt, 0.28); g.lineWidth = 9; g.lineCap = 'round'; g.beginPath(); g.moveTo(p[0], p[1]); g.lineTo(q[0], q[1]); g.stroke();
    }
    // the walk: a·u from the origin, then b·v from its tip
    const o = P.P([0, 0]), mid = P.P([sol.a * u[0], sol.a * u[1]]), end = P.P([sol.a * u[0] + sol.b * v[0], sol.a * u[1] + sol.b * v[1]]);
    arrow(g, o[0], o[1], mid[0], mid[1], C.viridian, 2.6, 11);
    arrow(g, mid[0], mid[1], end[0], end[1], C.violet, 2.6, 11);
    const pw = P.P(w);
    if (sol.span === 1) {
      g.strokeStyle = GR(0.55); g.lineWidth = 1; g.setLineDash([3, 3]); g.beginPath(); g.moveTo(end[0], end[1]); g.lineTo(pw[0], pw[1]); g.stroke(); g.setLineDash([]);
      const d = [end[0] - pw[0], end[1] - pw[1]], l = Math.hypot(...d) || 1, dir = P.P(sol.dir), dl = [dir[0] - o[0], dir[1] - o[1]], ll = Math.hypot(...dl) || 1;
      if (l > 12) right_angle(g, end, [-d[0] / l, -d[1] / l], [dl[0] / ll, dl[1] / ll], 7);
    }
    g.restore();
    // u and v themselves, thin, from the origin, with their beads
    const pu = P.P(u), pv = P.P(v);
    arrow(g, o[0], o[1], pu[0], pu[1], C.viridian, 1.4, 8); arrow(g, o[0], o[1], pv[0], pv[1], C.violet, 1.4, 8);
    glass_bead(g, pu[0], pu[1], 10, L.u.x, { core: C.viridian }); glass_bead(g, pv[0], pv[1], 10, L.v.x, { core: C.violet });
    sym(g, 'u', pu[0] + 13, pu[1] + 16, { size: 17, color: C.viridian, halo: 4 }); sym(g, 'v', pv[0] - 22, pv[1] - 8, { size: 17, color: C.violet, halo: 4 });
    // w: solid when reachable, hollow when it is not
    glass_bead(g, pw[0], pw[1], 11, L.w.x);
    ring_dot(g, pw[0], pw[1], 4.2, C.ink, sol.span === 2 ? 1 : 0, 1.6);
    sym(g, 'w', pw[0] + 14, pw[1] - 10, { size: 17, halo: 4 });
    // the mix, written out
    let tx = 22; const ty = 36;
    tx += sym(g, 'w', tx, ty, { size: 19, halo: 4 }); tx += text(g, sol.span === 2 ? ' = ' : ' ≈ ', tx, ty, { size: 17, halo: 4 });
    tx += text(g, num(sol.a, 2), tx, ty, { size: 17, weight: 650, tabular: true, color: C.viridian, halo: 4 }); tx += sym(g, ' u', tx, ty, { size: 18, color: C.viridian, halo: 4 });
    tx += text(g, sol.b < 0 ? ' − ' : ' + ', tx, ty, { size: 17, halo: 4 });
    tx += text(g, num(Math.abs(sol.b), 2), tx, ty, { size: 17, weight: 650, tabular: true, color: C.violet, halo: 4 }); sym(g, ' v', tx, ty, { size: 18, color: C.violet, halo: 4 });
  }

  const hold = drags(canvas, () => {
    const P = plot();
    return ['w', 'u', 'v'].map((k) => ({
      hit: (x, y) => { const p = P.P(S[k]), d = Math.hypot(x - p[0], y - p[1]); return d < 22 ? d : Infinity; },
      down() { L[k].to(1); }, up() { L[k].to(0); },
      move: (x, y) => { S[k] = [Math.round(P.ix(x) / SNAP) * SNAP, Math.round(P.iy(y) / SNAP) * SNAP].map((q) => Number(q.toFixed(1))); },
    }));
  }, { change: () => sched.wake() });
  const sched = scheduler((dt) => { const busy = Object.values(L).map((s) => s.step(dt)).some(Boolean); draw(); return busy || !!hold.active; });
  const resize = () => { cv.fit(); draw(); };
  resize();

  return {
    visible: (v) => sched.set_visible(v), resize,
    async accept() {
      const rnd = (() => { let s = 3; return () => ((s = (s * 16807) % 2147483647) / 2147483647) * 6 - 3; })();
      let err = 0, perp = 0, n1 = 0;
      for (let i = 0; i < 300; i++) {
        let u = [rnd(), rnd()], v = [rnd(), rnd()]; const w = [rnd(), rnd()];
        if (i % 5 === 0) { const k = rnd(); v = [u[0] * k, u[1] * k]; }          // every fifth pair lines up
        const s = solve(u, v, w), e = [s.a * u[0] + s.b * v[0], s.a * u[1] + s.b * v[1]];
        if (s.span === 2) err = Math.max(err, Math.hypot(e[0] - w[0], e[1] - w[1]));
        else { n1++; const gap = [w[0] - e[0], w[1] - e[1]]; perp = Math.max(perp, Math.abs(gap[0] * s.dir[0] + gap[1] * s.dir[1]) / (Math.hypot(...s.dir) || 1)); }
      }
      const pass = err < 1e-12 && perp < 1e-12 && n1 >= 60;
      return { pass, value: zh ? `${300 - n1} 组张成平面：a·u + b·v 与 w 最多差 ${err.toExponential(1)}；${n1} 组共线：终点到 w 的连线与那条线的夹角余弦 ${perp.toExponential(1)}` : `${300 - n1} spanning pairs: a·u + b·v within ${err.toExponential(1)} of w; ${n1} lined-up pairs: the gap to w is perpendicular to their line (${perp.toExponential(1)})` };
    },
  };
}
