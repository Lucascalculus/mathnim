// Multiplying in the complex plane. To multiply by w is to turn by w’s angle and stretch by w’s length. The triangle
// 0, 1, z and the triangle 0, w, zw are the same shape: the second is the first turned and stretched by w. So the angles
// add, arg zw = arg z + arg w (the three arcs at the origin), and the lengths multiply, |zw| = |z||w|. Drag z and w.
// As a building block: complex_plane({ points, product, arcs }).
import { scheduler, Spring, C, canvas2d } from '../lib/ui.js';
import { Plot, num, text, sym, tint, arrow, glass_bead, drags } from '../lib/plot.js';

export const meta = {
  id: 'complex',
  name: { zh: '复平面上的乘法', en: 'Multiplying in the complex plane' },
  means: { zh: '乘以 w 就是转过 w 的角度、再伸长到 w 的长度。三角形 0、1、z 和三角形 0、w、zw 形状相同：后一个是前一个被 w 转过、拉长的样子。所以角度相加，arg zw = arg z + arg w（原点处的三段弧），长度相乘，|zw| = |z||w|。拖动 z 和 w。', en: 'Multiplying by w turns by w’s angle and stretches by its length. The triangle 0, 1, z and the triangle 0, w, zw are the same shape, the second the first turned and stretched by w. So angles add, arg zw = arg z + arg w (the three arcs), and lengths multiply, |zw| = |z||w|.' },
  test: { zh: '500 组 z、w：两个三角形的三个角分别相等、边长之比都等于 |w|（误差 < 10⁻⁹）；arg zw 与 arg z + arg w 相差 2π 的整数倍', en: '500 pairs: the two triangles’ angles agree and every side ratio equals |w| (to 10⁻⁹); arg zw differs from arg z + arg w by a whole multiple of 2π' },
  wide: true,
};

const mul = (a, b) => [a[0] * b[0] - a[1] * b[1], a[0] * b[1] + a[1] * b[0]];
// the angle at p in triangle p q r (by atan2, which stays accurate for flat triangles where acos does not)
const ang = (p, q, r) => { const u = [q[0] - p[0], q[1] - p[1]], v = [r[0] - p[0], r[1] - p[1]]; return Math.atan2(Math.abs(u[0] * v[1] - u[1] * v[0]), u[0] * v[0] + u[1] * v[1]); };

export function make({ stage, canvas, lang }) {
  const zh = lang === 'zh';
  const cv = canvas2d(canvas), g = cv.ctx;
  const S = { z: [1.3, 0.5], w: [0.9, 0.95] };
  const lz = new Spring(0), lw = new Spring(0);
  const plot = () => { const hx = 2.6 * (cv.W - 4) / (cv.H - 4); return new Plot({ x: 2, y: 2, w: cv.W - 4, h: cv.H - 4 }, [-hx + 0.6, hx + 0.6], [-1.6, 3.6], { x_step: 1, y_step: 1 }); };
  function arc(P, a0, a1, r, col) { const o = P.P([0, 0]), k = P.sx * r; g.strokeStyle = col; g.lineWidth = 2; g.beginPath(); g.arc(o[0], o[1], k, -a0, -a1, a1 > a0); g.stroke(); }

  function draw() {
    const { W, H } = cv, P = plot(), z = S.z, w = S.w, zw = mul(z, w);
    g.setTransform(cv.dpr, 0, 0, cv.dpr, 0, 0); g.fillStyle = C.paper; g.fillRect(0, 0, W, H);
    P.axes(g, { numbers: true });
    const o = P.P([0, 0]), one = P.P([1, 0]), pz = P.P(z), pw = P.P(w), pzw = P.P(zw);
    // the two similar triangles
    for (const [tri, col] of [[[o, one, pz], C.ochre], [[o, pw, pzw], C.ochre]]) { g.beginPath(); tri.forEach((p, i) => (i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1]))); g.closePath(); g.fillStyle = tint(col, 0.22); g.fill(); g.strokeStyle = tint(col, 0.9); g.lineWidth = 1.2; g.stroke(); }
    // the angles at the origin: arg z, arg w, and arg zw, their sum
    const az = Math.atan2(z[1], z[0]), aw = Math.atan2(w[1], w[0]);
    arc(P, 0, az, 0.34, C.cobalt); arc(P, 0, aw, 0.5, C.violet); arc(P, aw, aw + az, 0.66, C.cobalt); arc(P, 0, aw, 0.66, C.violet);
    // the vectors
    arrow(g, o[0], o[1], pz[0], pz[1], C.cobalt, 2.4, 11); arrow(g, o[0], o[1], pw[0], pw[1], C.violet, 2.4, 11); arrow(g, o[0], o[1], pzw[0], pzw[1], C.ink, 2.6, 12);
    g.fillStyle = C.ink2; g.beginPath(); g.arc(one[0], one[1], 3, 0, Math.PI * 2); g.fill();
    glass_bead(g, pz[0], pz[1], 10, lz.x, { core: C.cobalt }); glass_bead(g, pw[0], pw[1], 10, lw.x, { core: C.violet });
    sym(g, 'z', pz[0] + 13, pz[1] + 5, { size: 18, color: C.cobalt, halo: 4 }); sym(g, 'w', pw[0] - 22, pw[1] - 6, { size: 18, color: C.violet, halo: 4 }); sym(g, 'zw', pzw[0] + 9, pzw[1] - 9, { size: 18, halo: 4 });
    // the lengths multiply
    let tx = 22; const ty = 36;
    tx += text(g, '|', tx, ty, { size: 16, halo: 4 }); tx += sym(g, 'zw', tx, ty, { size: 17, halo: 4 }); tx += text(g, '| = ' + num(Math.hypot(...zw), 2) + ' = ', tx, ty, { size: 15, tabular: true, halo: 4 });
    tx += text(g, num(Math.hypot(...z), 2), tx, ty, { size: 15, weight: 650, tabular: true, color: C.cobalt, halo: 4 }); tx += text(g, ' × ', tx, ty, { size: 15, halo: 4 });
    text(g, num(Math.hypot(...w), 2), tx, ty, { size: 15, weight: 650, tabular: true, color: C.violet, halo: 4 });
  }

  const hold = drags(canvas, () => {
    const P = plot(), near = (x, y, p) => { const q = P.P(p), d = Math.hypot(x - q[0], y - q[1]); return d < 22 ? d : Infinity; };
    const set = (k) => (x, y) => { S[k] = [Math.round(P.ix(x) * 20) / 20, Math.round(P.iy(y) * 20) / 20]; };
    return [{ hit: (x, y) => near(x, y, S.z), down() { lz.to(1); }, up() { lz.to(0); }, move: set('z') }, { hit: (x, y) => near(x, y, S.w), down() { lw.to(1); }, up() { lw.to(0); }, move: set('w') }];
  }, { change: () => sched.wake() });
  const sched = scheduler((dt) => { const busy = [lz.step(dt), lw.step(dt)].some(Boolean); draw(); return busy || !!hold.active; });
  const resize = () => { cv.fit(); draw(); };
  resize();

  return {
    visible: (v) => sched.set_visible(v), resize,
    async accept() {
      const rnd = (() => { let s = 23; return () => ((s = (s * 16807) % 2147483647) / 2147483647) * 4 - 2; })();
      let angle_err = 0, ratio_err = 0, arg_err = 0;
      for (let i = 0; i < 500; i++) {
        const z = [rnd(), rnd()], w = [rnd(), rnd()]; if (Math.hypot(...z) < 0.1 || Math.hypot(...w) < 0.1) continue;
        const zw = mul(z, w), O = [0, 0], T1 = [O, [1, 0], z], T2 = [O, w, zw], m = Math.hypot(...w);
        for (let k = 0; k < 3; k++) angle_err = Math.max(angle_err, Math.abs(ang(T1[k], T1[(k + 1) % 3], T1[(k + 2) % 3]) - ang(T2[k], T2[(k + 1) % 3], T2[(k + 2) % 3])));
        for (let k = 0; k < 3; k++) { const a = T1[k], b = T1[(k + 1) % 3], c = T2[k], d = T2[(k + 1) % 3]; ratio_err = Math.max(ratio_err, Math.abs(Math.hypot(d[0] - c[0], d[1] - c[1]) / Math.hypot(b[0] - a[0], b[1] - a[1]) - m)); }
        const diff = Math.atan2(zw[1], zw[0]) - Math.atan2(z[1], z[0]) - Math.atan2(w[1], w[0]), turns = diff / (2 * Math.PI);
        arg_err = Math.max(arg_err, Math.abs(turns - Math.round(turns)));
      }
      const pass = angle_err < 1e-9 && ratio_err < 1e-9 && arg_err < 1e-12;
      return { pass, value: zh ? `角度相差 ${angle_err.toExponential(1)}；边长比与 |w| 相差 ${ratio_err.toExponential(1)}；辐角相加（模 2π）${arg_err.toExponential(1)}` : `angles differ by ${angle_err.toExponential(1)}; side ratios vs |w| ${ratio_err.toExponential(1)}; arguments add (mod 2π) ${arg_err.toExponential(1)}` };
    },
  };
}
