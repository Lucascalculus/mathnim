// Measuring and naming. A length is written the way a drawing office writes it: a dimension line set off from the side,
// extension lines, two arrowheads, the number in a gap, upright. A part is named with a brace. Here the altitude from C
// cuts AB in two; the braces give the two parts and the dimension line beyond them the whole, and the numbers add up
// as printed (rounded so that they do). Drag the corners. As a building block: dimension(a, b), brace(a, b).
import { scheduler, Spring, C, GR, canvas2d } from '../lib/ui.js';
import { Plot, num, text, sym, tint, right_angle, glass_bead, drags, dimension, brace } from '../lib/plot.js';
import { poly_x, seg_poly } from '../lib/geom.js';

export const meta = {
  id: 'measure',
  name: { zh: '量尺与括号', en: 'Measuring and naming' },
  means: { zh: '长度用制图的写法：尺寸线离开边一点，两头有界线和箭头，数字写在中间的断口里，总是正着。一段的名字用括号。C 的高把 AB 分成两段：括号标两段，外面的尺寸线标全长，印出来的数字正好加得起来。', en: 'A length as a drawing office writes it: a dimension line set off from the side, arrowheads, the number upright in a gap. A part is named with a brace. The altitude from C cuts AB in two: braces give the parts, the dimension line beyond them the whole, and the printed numbers add up.' },
  test: { zh: '500 个三角形（每个角至少 20°）：尺寸数字与真实长度相差 ≤ 0.05；尺寸线都在三角形外面；印出的两段之和恰好等于印出的全长；标注互不重叠', en: '500 triangles (every angle at least 20°): every printed length within 0.05 of the true one; dimension lines all outside the triangle; the printed parts add up exactly to the printed whole; no labels overlap' },
};

const area2 = (a, b, c) => (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
// round two parts to tenths so that they add up to the whole rounded to tenths (largest remainder first)
function parts_that_add(p, q) {
  const W = Math.round((p + q) * 10), fp = Math.floor(p * 10), fq = Math.floor(q * 10);
  let a = fp, b = fq; const left = W - a - b;
  if (left >= 1) { if (p * 10 - fp >= q * 10 - fq) a++; else b++; }
  if (left >= 2) { if (a === fp + 1) b++; else a++; }
  return [a / 10, b / 10, W / 10];
}

export function make({ stage, canvas, lang }) {
  const zh = lang === 'zh';
  const cv = canvas2d(canvas), g = cv.ctx;
  const S = { A: [-2.6, -1.1], B: [2.4, -1.1], C: [-0.6, 1.5] };
  const lifts = { A: new Spring(0), B: new Spring(0), C: new Spring(0) };
  const plot = () => { const hx = 2.6 * (cv.W - 4) / (cv.H - 4); return new Plot({ x: 2, y: 2, w: cv.W - 4, h: cv.H - 4 }, [-hx, hx], [-2.6, 2.6]); };
  // everything the picture states, computed once per frame and reused by the test
  function facts(P, T = S) {
    const A = P.P(T.A), B = P.P(T.B), Cc = P.P(T.C), ccw = area2(A, B, Cc) < 0;      // which side is outside
    const sides = [['A', 'B'], ['B', 'C'], ['C', 'A']].map(([p, q]) => {
      const a = P.P(T[p]), b = P.P(T[q]), len = Math.hypot(T[q][0] - T[p][0], T[q][1] - T[p][1]);
      return { a: ccw ? b : a, b: ccw ? a : b, len, name: p + q };
    });
    const ab = [T.B[0] - T.A[0], T.B[1] - T.A[1]], L2 = ab[0] ** 2 + ab[1] ** 2, t = ((T.C[0] - T.A[0]) * ab[0] + (T.C[1] - T.A[1]) * ab[1]) / L2;
    const F = [T.A[0] + ab[0] * t, T.A[1] + ab[1] * t], L = Math.sqrt(L2);
    return { A, B, Cc, sides, F, t, inside: t > 0.08 && t < 0.92, p1: t * L, p2: (1 - t) * L, L, ccw };
  }

  function draw() {
    const { W, H } = cv, P = plot(), F = facts(P);
    g.setTransform(cv.dpr, 0, 0, cv.dpr, 0, 0); g.fillStyle = C.paper; g.fillRect(0, 0, W, H);
    const { A, B, Cc } = F, f = P.P(F.F);
    // the triangle
    g.beginPath(); g.moveTo(A[0], A[1]); g.lineTo(B[0], B[1]); g.lineTo(Cc[0], Cc[1]); g.closePath();
    g.fillStyle = tint(C.cobalt, 0.1); g.fill(); g.strokeStyle = C.cobalt; g.lineWidth = 2; g.lineJoin = 'round'; g.stroke();
    // the altitude, and AB carried on to its foot when the foot is beyond the side
    g.save(); g.strokeStyle = GR(0.5); g.lineWidth = 1; g.setLineDash([4, 4]);
    g.beginPath(); g.moveTo(Cc[0], Cc[1]); g.lineTo(f[0], f[1]);
    if (!(F.t >= 0 && F.t <= 1)) { const near = F.t < 0 ? A : B; g.moveTo(near[0], near[1]); g.lineTo(f[0], f[1]); }
    g.stroke(); g.restore();
    const u = [(B[0] - A[0]) / Math.hypot(B[0] - A[0], B[1] - A[1]), (B[1] - A[1]) / Math.hypot(B[0] - A[0], B[1] - A[1])], toC = [Cc[0] - f[0], Cc[1] - f[1]], lc = Math.hypot(...toC) || 1;
    right_angle(g, f, F.t <= 0.5 ? u : [-u[0], -u[1]], [toC[0] / lc, toC[1] / lc], 8);
    // AB: two braces for the parts, the whole beyond them; the other sides: their lengths
    const sAB = F.sides[0], [d1, d2, dW] = parts_that_add(F.p1, F.p2);
    if (F.inside) {
      const out = (p, q) => (F.ccw ? [q, p] : [p, q]);
      for (const [p, q, v] of [[A, f, d1], [f, B, d2]]) {
        const [a, b] = out(p, q), tip = brace(g, a, b, C.ink2, 10);
        const dx = b[0] - a[0], dy = b[1] - a[1], L = Math.hypot(dx, dy), n = [dy / L, -dx / L];
        text(g, num(v, 1), tip[0] + n[0] * 12, tip[1] + n[1] * 12 + 4, { size: 12, weight: 600, tabular: true, align: 'center', color: C.ink, halo: 3 });
      }
      dimension(g, sAB.a, sAB.b, num(dW, 1), { off: 50 });
    } else dimension(g, sAB.a, sAB.b, num(sAB.len, 1), { off: 20 });
    for (const s of F.sides.slice(1)) dimension(g, s.a, s.b, num(s.len, 1), { off: 20 });
    for (const k of ['A', 'B', 'C']) {
      const p = P.P(S[k]), c = [(A[0] + B[0] + Cc[0]) / 3, (A[1] + B[1] + Cc[1]) / 3], d = [p[0] - c[0], p[1] - c[1]], l = Math.hypot(...d) || 1;
      glass_bead(g, p[0], p[1], 10, lifts[k].x, { core: C.cobalt });
      sym(g, k, p[0] + d[0] / l * 22 - 5, p[1] + d[1] / l * 22 + 6, { size: 17, halo: 4 });
    }
  }

  const hold = drags(canvas, () => {
    const P = plot();
    return ['A', 'B', 'C'].map((k) => ({
      hit: (x, y) => { const p = P.P(S[k]), d = Math.hypot(x - p[0], y - p[1]); return d < 22 ? d : Infinity; },
      down() { lifts[k].to(1); }, up() { lifts[k].to(0); },
      move: (x, y) => { const v = [Math.round(P.ix(x) * 10) / 10, Math.round(P.iy(y) * 10) / 10], T = { ...S, [k]: v }; if (Math.abs(area2(T.A, T.B, T.C)) > 0.4) S[k] = v; },
    }));
  }, { change: () => sched.wake() });
  const sched = scheduler((dt) => { const busy = Object.values(lifts).map((s) => s.step(dt)).some(Boolean); draw(); return busy || !!hold.active; });
  const resize = () => { cv.fit(); draw(); };
  resize();

  return {
    visible: (v) => sched.set_visible(v), resize,
    async accept() {
      const P = plot(), rnd = (() => { let s = 5; return () => (s = (s * 16807) % 2147483647) / 2147483647; })();
      let len_err = 0, outside = 0, sums = 0, clash = 0, n = 0;
      const mock = { save() {}, restore() {}, beginPath() {}, moveTo() {}, lineTo() {}, stroke() {}, fill() {}, closePath() {}, translate() {}, rotate() {}, fillText() {}, strokeText() {}, measureText: (s) => g.measureText(s), set font(v) { g.font = v; }, get font() { return g.font; } };
      while (n < 500) {
        const T = { A: [-2.8 + 2 * rnd(), -2 + 1.5 * rnd()], B: [0.8 + 2 * rnd(), -2 + 1.5 * rnd()], C: [-2 + 4 * rnd(), 0.2 + 1.8 * rnd()] };
        // triangles a drawing would use: every angle at least 20°
        const ang = (p, q, r) => { const u = [q[0] - p[0], q[1] - p[1]], v = [r[0] - p[0], r[1] - p[1]]; return Math.acos((u[0] * v[0] + u[1] * v[1]) / (Math.hypot(...u) * Math.hypot(...v))); };
        if (Math.min(ang(T.A, T.B, T.C), ang(T.B, T.C, T.A), ang(T.C, T.A, T.B)) < Math.PI / 9) continue;
        n++;
        const F = facts(P, T), tri = [F.A, F.B, F.Cc], boxes = [];
        const [d1, d2, dW] = parts_that_add(F.p1, F.p2);
        if (Math.abs(d1 + d2 - dW) > 1e-9 || Math.abs(d1 - F.p1) > 0.1 || Math.abs(d2 - F.p2) > 0.1 || Math.abs(dW - F.L) > 0.05) sums++;
        F.sides.forEach((s, i) => {
          len_err = Math.max(len_err, Math.abs(Number(num(s.len, 1)) - s.len));
          const off = i === 0 && F.inside ? 50 : 20, dx = s.b[0] - s.a[0], dy = s.b[1] - s.a[1], L = Math.hypot(dx, dy), m = [(s.a[0] + s.b[0]) / 2 + dy / L * off, (s.a[1] + s.b[1]) / 2 - dx / L * off];
          if (Math.sign(area2(tri[0], tri[1], m)) === Math.sign(area2(tri[0], tri[1], tri[2])) && Math.sign(area2(tri[1], tri[2], m)) === Math.sign(area2(tri[1], tri[2], tri[0])) && Math.sign(area2(tri[2], tri[0], m)) === Math.sign(area2(tri[2], tri[0], tri[1]))) outside++;
          boxes.push(dimension(mock, s.a, s.b, num(s.len, 1), { off }));
        });
        for (let i = 0; i < boxes.length; i++) for (let j = i + 1; j < boxes.length; j++) if (poly_x(boxes[i], boxes[j])) clash++;
        for (const b of boxes) for (let k = 0; k < 3; k++) if (seg_poly(tri[k], tri[(k + 1) % 3], b)) clash++;
      }
      const pass = len_err <= 0.05 && outside === 0 && sums === 0 && clash === 0;
      return { pass, value: zh ? `500 个三角形：长度误差 ≤ ${len_err.toFixed(3)}；尺寸线落在里面 ${outside}；两段加不起来 ${sums}；标注冲突 ${clash}` : `500 triangles: length error ≤ ${len_err.toFixed(3)}; dimension lines inside ${outside}; parts not adding up ${sums}; label clashes ${clash}` };
    },
  };
}
