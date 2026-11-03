// Coordinates in space, under the specimen's one camera. A point is three numbers: walk x along the floor, then z, then
// rise y. The walk is drawn as the box it makes: dashed lines from the point down to the floor and from there to the
// two floor axes. Two beads hold it, one on the floor (it moves only across the floor) and one at the point (it moves
// only up and down), so each hand changes the numbers it should. As a building block: space({ points, vectors, planes }).
import { scheduler, Spring, C, GR, canvas2d } from '../lib/ui.js';
import { num, text, sym, tint, arrow, ring_dot, glass_bead, drags, TICK } from '../lib/plot.js';

export const meta = {
  id: 'space3d',
  name: { zh: '三维坐标', en: 'Coordinates in space' },
  means: { zh: '在唯一的相机下，一个点是三个数：沿地面走 x，再走 z，再升高 y。这条路画成它围出的盒子：从点垂到地面，再从地面连到两根地面轴。两颗玻璃珠：地面上的那颗只在地面上动，点上的那颗只上下动，所以每只手只改它该改的数。', en: 'Under the one camera a point is three numbers: walk x along the floor, then z, then rise y; the walk is drawn as the box it makes. One bead on the floor moves only across the floor, the bead at the point only up and down, so each hand changes only its own numbers.' },
  test: { zh: '地面上 300 个屏幕位置反算回地面再投影，误差 < 10⁻⁹ px；上下拖只改 y（x、z 不变，屏幕上竖直移动）；画出的点就是 (x, y, z) 的投影', en: '300 floor positions on screen, mapped back to the floor and projected again, agree to 10⁻⁹ px; the vertical bead changes only y (x and z fixed, straight up on screen); the drawn point is the projection of (x, y, z)' },
};

const AZ = -0.5, EL = 0.66, N = 4;
function camera() {
  const ca = Math.cos(AZ), sa = Math.sin(AZ), ce = Math.cos(EL), se = Math.sin(EL);
  const cam = { s: 1, ox: 0, oy: 0 };
  cam.p = (q) => { const xr = q[0] * ca - q[2] * sa, zr = q[0] * sa + q[2] * ca; return [cam.ox + cam.s * xr, cam.oy - cam.s * (q[1] * ce - zr * se)]; };
  // the world point at height y under a screen point
  cam.at = (sx, sy, y) => { const u = (sx - cam.ox) / cam.s, v = (cam.oy - sy) / cam.s, zr = (y * ce - v) / se; return [u * ca + zr * sa, y, -u * sa + zr * ca]; };
  cam.ce = ce;
  return cam;
}

export function make({ stage, canvas, lang }) {
  const zh = lang === 'zh';
  const cv = canvas2d(canvas), g = cv.ctx;
  const S = { p: [2.4, 1.8, 1.6] };
  const lf = new Spring(0), lt = new Spring(0);
  function cam_fit() {
    const cam = camera(), pts = [];
    for (const x of [0, N + 0.4]) for (const y of [0, 3]) for (const z of [0, N + 0.4]) pts.push(cam.p([x, y, z]));
    const x0 = Math.min(...pts.map((p) => p[0])), x1 = Math.max(...pts.map((p) => p[0])), y0 = Math.min(...pts.map((p) => p[1])), y1 = Math.max(...pts.map((p) => p[1]));
    const s = Math.min((cv.W - 60) / (x1 - x0), (cv.H - 90) / (y1 - y0));
    cam.s = s; cam.ox = cv.W / 2 - s * (x0 + x1) / 2; cam.oy = cv.H / 2 + 22 - s * (y0 + y1) / 2;
    return cam;
  }

  function draw() {
    const { W, H } = cv, cam = cam_fit(), [x, y, z] = S.p;
    g.setTransform(cv.dpr, 0, 0, cv.dpr, 0, 0); g.fillStyle = C.paper; g.fillRect(0, 0, W, H);
    // the floor: a dot at each whole crossing, a faint sheet
    const f = [[0, 0, 0], [N, 0, 0], [N, 0, N], [0, 0, N]].map(cam.p);
    g.beginPath(); f.forEach((p, i) => (i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1]))); g.closePath(); g.fillStyle = 'rgba(26,27,31,0.025)'; g.fill();
    g.fillStyle = GR(0.25); for (let i = 0; i <= N; i++) for (let k = 0; k <= N; k++) { const p = cam.p([i, 0, k]); g.beginPath(); g.arc(p[0], p[1], 1, 0, Math.PI * 2); g.fill(); }
    // the axes (scaffolding) with their ticks and names
    const o = cam.p([0, 0, 0]);
    for (const [d, name] of [[[1, 0, 0], 'x'], [[0, 1, 0], 'y'], [[0, 0, 1], 'z']]) {
      const e = cam.p(d.map((c) => c * (N + 0.4)));
      g.strokeStyle = GR(0.6); g.lineWidth = 1; g.beginPath(); g.moveTo(o[0], o[1]); g.lineTo(e[0], e[1]); g.stroke();
      for (let i = 1; i <= N; i++) { const t = cam.p(d.map((c) => c * i)); g.fillStyle = GR(0.6); g.beginPath(); g.arc(t[0], t[1], 1.6, 0, Math.PI * 2); g.fill(); text(g, String(i), t[0] + (d[1] ? -12 : 0), t[1] + (d[1] ? 4 : 16), { size: 11, color: TICK, align: 'center', tabular: true, halo: 3 }); }
      sym(g, name, e[0] + (d[0] ? 6 : d[2] ? -14 : 6), e[1] + (d[1] ? -4 : 14), { size: 16, color: C.ink2, halo: 3 });
    }
    // the walk to the point, as its box: floor feet on the axes, the foot under the point, the rise
    const P = cam.p(S.p), F = cam.p([x, 0, z]), X = cam.p([x, 0, 0]), Z = cam.p([0, 0, z]);
    g.save(); g.strokeStyle = GR(0.5); g.lineWidth = 1; g.setLineDash([4, 4]);
    g.beginPath(); g.moveTo(X[0], X[1]); g.lineTo(F[0], F[1]); g.lineTo(Z[0], Z[1]); g.moveTo(F[0], F[1]); g.lineTo(P[0], P[1]); g.stroke(); g.restore();
    g.strokeStyle = tint(C.cobalt, 0.6); g.lineWidth = 3; g.lineCap = 'round';
    g.beginPath(); g.moveTo(o[0], o[1]); g.lineTo(X[0], X[1]); g.stroke();
    arrow(g, o[0], o[1], P[0], P[1], C.cobalt, 2.4, 11);
    ring_dot(g, X[0], X[1], 3.4, C.ink, 1, 1.4); ring_dot(g, Z[0], Z[1], 3.4, C.ink, 1, 1.4);
    glass_bead(g, F[0], F[1], 10, lf.x, { core: C.ink2 });
    glass_bead(g, P[0], P[1], 11, lt.x, { dir: Math.PI / 2, core: C.cobalt });
    // its three numbers
    let tx = 22; const ty = 36;
    tx += sym(g, 'P', tx, ty, { size: 19, color: C.cobalt }); tx += text(g, ' = (' + num(x, 1) + ', ' + num(y, 1) + ', ' + num(z, 1) + ')', tx, ty, { size: 16, weight: 600, tabular: true });
    sym(g, '(x, y, z)', W - 22, ty, { size: 15, color: TICK, align: 'right' });
  }

  const hold = drags(canvas, () => {
    const cam = cam_fit(), P = cam.p(S.p), F = cam.p([S.p[0], 0, S.p[2]]);
    const near = (x, y, q) => { const d = Math.hypot(x - q[0], y - q[1]); return d < 22 ? d : Infinity; };
    const cl = (v) => Math.max(0, Math.min(N, Math.round(v * 10) / 10));
    return [
      { hit: (x, y) => near(x, y, P), down() { lt.to(1); }, up() { lt.to(0); }, move: (x, y) => { S.p = [S.p[0], cl((F[1] - y) / (cam.s * cam.ce)), S.p[2]]; } },   // the height above the foot
      { hit: (x, y) => near(x, y, F), down() { lf.to(1); }, up() { lf.to(0); }, move: (x, y) => { const w = cam.at(x, y, 0); S.p = [cl(w[0]), S.p[1], cl(w[2])]; } },
    ];
  }, { change: () => sched.wake() });
  const sched = scheduler((dt) => { const busy = [lf.step(dt), lt.step(dt)].some(Boolean); draw(); return busy || !!hold.active; });
  const resize = () => { cv.fit(); draw(); };
  resize();

  return {
    visible: (v) => sched.set_visible(v), resize,
    async accept() {
      const cam = cam_fit(), rnd = (() => { let s = 17; return () => (s = (s * 16807) % 2147483647) / 2147483647; })();
      let back = 0, vert = 0, proj = 0;
      for (let i = 0; i < 300; i++) {
        const sx = 60 + rnd() * (cv.W - 120), sy = 60 + rnd() * (cv.H - 120), w = cam.at(sx, sy, 0), q = cam.p(w);
        back = Math.max(back, Math.hypot(q[0] - sx, q[1] - sy), Math.abs(w[1]));
        // up and down: the same x and z at another height lands straight above, by the height times the scale
        const p = [rnd() * N, rnd() * N, rnd() * N], h = rnd() * 2, a = cam.p(p), b = cam.p([p[0], p[1] + h, p[2]]);
        vert = Math.max(vert, Math.abs(a[0] - b[0]), Math.abs((a[1] - b[1]) - h * cam.s * cam.ce));
        // the drawn point against the camera written out by hand
        const ca = Math.cos(AZ), sa = Math.sin(AZ), xr = p[0] * ca - p[2] * sa, zr = p[0] * sa + p[2] * ca, want = [cam.ox + cam.s * xr, cam.oy - cam.s * (p[1] * Math.cos(EL) - zr * Math.sin(EL))];
        proj = Math.max(proj, Math.hypot(a[0] - want[0], a[1] - want[1]));
      }
      const pass = back < 1e-9 && vert < 1e-9 && proj < 1e-9;
      return { pass, value: zh ? `地面反算 ${back.toExponential(1)} px；只升高时横向偏移 ${vert.toExponential(1)} px；投影 ${proj.toExponential(1)} px` : `floor round trip ${back.toExponential(1)} px; sideways drift when only rising ${vert.toExponential(1)} px; projection ${proj.toExponential(1)} px` };
    },
  };
}
