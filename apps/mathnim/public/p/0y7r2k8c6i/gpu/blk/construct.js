// A construction. Each side of the triangle gets its perpendicular bisector: the points as far from one end as from the
// other. Drag any corner and the three construction lines still meet in one point O, which is therefore equally far
// from all three corners: the circle about O through one corner goes through all three. The equal radii carry the same
// tick, as on a geometry drawing. As a building block: construct(points, steps) with its invariants checked on every drag.
import { scheduler, Spring, C, GR, canvas2d } from '../lib/ui.js';
import { Plot, sym, tint, right_angle, glass_bead, drags } from '../lib/plot.js';

export const meta = {
  id: 'construct',
  name: { zh: '几何构造', en: 'A construction' },
  means: { zh: '三角形每条边的中垂线：到两端一样远的点。拖动任何一个角，三条作图线始终交于一点 O，所以 O 到三个角一样远：以 O 为圆心、过一个角的圆同时过三个角。相等的半径上画着同样的短刻度，像几何作图那样。', en: 'Each side’s perpendicular bisector: the points as far from one end as from the other. Drag any corner and the three construction lines still meet at one point O, so O is equally far from all three corners: the circle about O through one goes through all. Equal radii carry the same tick.' },
  test: { zh: '1000 次随机拖动后：O 到三条中垂线的距离 < 10⁻⁹；|OA| = |OB| = |OC|（相对误差 < 10⁻¹²）', en: 'After 1000 random drags: O is within 10⁻⁹ of all three bisectors; |OA| = |OB| = |OC| to 10⁻¹²' },
};

const sub = (a, b) => [a[0] - b[0], a[1] - b[1]];
// the circumcentre: where the bisectors of AB and AC cross
function centre(A, B, Cc) {
  const b = sub(B, A), c = sub(Cc, A), D = 2 * (b[0] * c[1] - b[1] * c[0]);
  if (Math.abs(D) < 1e-12) return null;
  const b2 = b[0] ** 2 + b[1] ** 2, c2 = c[0] ** 2 + c[1] ** 2;
  return [A[0] + (c[1] * b2 - b[1] * c2) / D, A[1] + (b[0] * c2 - c[0] * b2) / D];
}

export function make({ stage, canvas, lang }) {
  const zh = lang === 'zh';
  const cv = canvas2d(canvas), g = cv.ctx;
  const S = { A: [-1.9, -1.0], B: [2.1, -1.2], C: [0.4, 1.5] };
  const lifts = { A: new Spring(0), B: new Spring(0), C: new Spring(0) };
  const plot = () => { const hx = 2.9 * (cv.W - 4) / (cv.H - 4); return new Plot({ x: 2, y: 2, w: cv.W - 4, h: cv.H - 4 }, [-hx, hx], [-2.9, 2.9]); };

  function draw() {
    const { W, H } = cv, P = plot(), O = centre(S.A, S.B, S.C);
    g.setTransform(cv.dpr, 0, 0, cv.dpr, 0, 0); g.fillStyle = C.paper; g.fillRect(0, 0, W, H);
    const A = P.P(S.A), B = P.P(S.B), Cc = P.P(S.C);
    if (O) {
      const o = P.P(O), r = Math.hypot(A[0] - o[0], A[1] - o[1]);
      // the circle through all three
      g.strokeStyle = C.cobalt; g.lineWidth = 1.6; g.beginPath(); g.arc(o[0], o[1], r, 0, Math.PI * 2); g.stroke();
      // the construction lines: each bisector, long, in graphite, with its right angle at the midpoint
      for (const [p, q] of [[A, B], [B, Cc], [Cc, A]]) {
        const m = [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2], d = sub(q, p), L = Math.hypot(...d), n = [-d[1] / L, d[0] / L];
        g.strokeStyle = GR(0.42); g.lineWidth = 0.9;
        g.beginPath(); g.moveTo(m[0] - n[0] * 2000, m[1] - n[1] * 2000); g.lineTo(m[0] + n[0] * 2000, m[1] + n[1] * 2000); g.stroke();
        right_angle(g, m, [d[0] / L, d[1] / L], n, 7);
        // the two halves of the side are equal: one small tick on each
        for (const t of [0.25, 0.75]) { const c = [p[0] + d[0] * t, p[1] + d[1] * t]; g.strokeStyle = C.ink2; g.lineWidth = 1.2; g.beginPath(); g.moveTo(c[0] - n[0] * 4, c[1] - n[1] * 4); g.lineTo(c[0] + n[0] * 4, c[1] + n[1] * 4); g.stroke(); }
      }
      // the three radii, equal: two ticks on each
      for (const p of [A, B, Cc]) {
        const d = sub(p, o), L = Math.hypot(...d) || 1, n = [-d[1] / L, d[0] / L], c = [o[0] + d[0] * 0.5, o[1] + d[1] * 0.5];
        g.strokeStyle = tint(C.cobalt, 0.7); g.lineWidth = 1; g.setLineDash([4, 3]); g.beginPath(); g.moveTo(o[0], o[1]); g.lineTo(p[0], p[1]); g.stroke(); g.setLineDash([]);
        g.strokeStyle = C.cobalt; g.lineWidth = 1.2;
        for (const s of [-2.5, 2.5]) { const e = [c[0] + d[0] / L * s, c[1] + d[1] / L * s]; g.beginPath(); g.moveTo(e[0] - n[0] * 4.5, e[1] - n[1] * 4.5); g.lineTo(e[0] + n[0] * 4.5, e[1] + n[1] * 4.5); g.stroke(); }
      }
      g.fillStyle = C.cobalt; g.beginPath(); g.arc(o[0], o[1], 4, 0, Math.PI * 2); g.fill();
      sym(g, 'O', o[0] + 9, o[1] - 9, { size: 17, color: C.cobalt, halo: 4 });
    }
    // the triangle
    g.beginPath(); g.moveTo(A[0], A[1]); g.lineTo(B[0], B[1]); g.lineTo(Cc[0], Cc[1]); g.closePath();
    g.strokeStyle = C.ink; g.lineWidth = 1.8; g.lineJoin = 'round'; g.stroke();
    const c0 = [(A[0] + B[0] + Cc[0]) / 3, (A[1] + B[1] + Cc[1]) / 3];
    for (const k of ['A', 'B', 'C']) {
      const p = P.P(S[k]), d = sub(p, c0), l = Math.hypot(...d) || 1;
      glass_bead(g, p[0], p[1], 10, lifts[k].x, { core: C.ink });
      sym(g, k, p[0] + d[0] / l * 22 - 5, p[1] + d[1] / l * 22 + 6, { size: 17, halo: 4 });
    }
  }

  const hold = drags(canvas, () => {
    const P = plot();
    return ['A', 'B', 'C'].map((k) => ({
      hit: (x, y) => { const p = P.P(S[k]), d = Math.hypot(x - p[0], y - p[1]); return d < 22 ? d : Infinity; },
      down() { lifts[k].to(1); }, up() { lifts[k].to(0); },
      move: (x, y) => { const v = [P.ix(x), P.iy(y)], T = { ...S, [k]: v }, b = sub(T.B, T.A), c = sub(T.C, T.A); if (Math.abs(b[0] * c[1] - b[1] * c[0]) > 0.3) S[k] = v; },
    }));
  }, { change: () => sched.wake() });
  const sched = scheduler((dt) => { const busy = Object.values(lifts).map((s) => s.step(dt)).some(Boolean); draw(); return busy || !!hold.active; });
  const resize = () => { cv.fit(); draw(); };
  resize();

  return {
    visible: (v) => sched.set_visible(v), resize,
    async accept() {
      const rnd = (() => { let s = 21; return () => (s = (s * 16807) % 2147483647) / 2147483647; })();
      const T = { A: [-1.9, -1.0], B: [2.1, -1.2], C: [0.4, 1.5] };
      let off = 0, radii = 0, n = 0;
      for (let i = 0; i < 1000; i++) {
        const k = 'ABC'[i % 3], v = [rnd() * 5 - 2.5, rnd() * 5 - 2.5], U = { ...T, [k]: v }, b = sub(U.B, U.A), c = sub(U.C, U.A);
        if (Math.abs(b[0] * c[1] - b[1] * c[0]) < 0.3) continue;
        T[k] = v; n++;
        const O = centre(T.A, T.B, T.C);
        for (const [p, q] of [[T.A, T.B], [T.B, T.C], [T.C, T.A]]) {
          const m = [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2], d = sub(q, p);
          off = Math.max(off, Math.abs((O[0] - m[0]) * d[0] + (O[1] - m[1]) * d[1]) / Math.hypot(...d));   // distance from O to the bisector
        }
        const r = [T.A, T.B, T.C].map((p) => Math.hypot(p[0] - O[0], p[1] - O[1]));
        radii = Math.max(radii, (Math.max(...r) - Math.min(...r)) / Math.max(...r));
      }
      const pass = off < 1e-9 && radii < 1e-12 && n > 900;
      return { pass, value: zh ? `${n} 次拖动：O 离中垂线最多 ${off.toExponential(1)}；三条半径相对差 ${radii.toExponential(1)}` : `${n} drags: O within ${off.toExponential(1)} of the bisectors; radii differ by ${radii.toExponential(1)}` };
    },
  };
}
