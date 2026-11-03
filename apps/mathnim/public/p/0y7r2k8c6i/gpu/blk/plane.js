// The plane under a matrix. A matrix moves the whole plane at once: drag where î and ĵ land (they are the matrix’s two
// columns, in their own colours) and every grid line follows, still parallel and evenly spaced. The unit square becomes
// a parallelogram whose area is |det A|; its little turning arrow flips when det A < 0 (the plane is turned over), and
// it collapses to a line when det A = 0. The unit circle becomes an ellipse; the eigen-directions, when there are any,
// are lines that are only stretched, never turned. As a building block: plane(A, { grid, square, circle, eigen }).
import { scheduler, Spring, C, GR } from '../lib/ui.js';
import { Plot, num, text, sym, text_width, tint, arrow, glass_bead, drags } from '../lib/plot.js';

export const meta = {
  id: 'plane',
  name: { zh: '平面与矩阵', en: 'The plane under a matrix' },
  means: { zh: '矩阵把整张平面一起变：拖动 î、ĵ 落到哪里（就是矩阵的两列），整张网格跟着走，线仍然平行、等距。单位方块变成平行四边形，面积是 |det A|；det A < 0 时里面的小箭头反过来，det A = 0 时压成一条线。特征方向只被拉长，不转。', en: 'A matrix moves the whole plane: drag where î and ĵ land (its two columns) and the grid follows, still parallel and evenly spaced. The unit square’s area becomes |det A|; its arrow flips when det A < 0 and it collapses when det A = 0. Eigen-directions are only stretched.' },
  test: { zh: '平行四边形面积（鞋带公式）= |det A|；画出的特征向量满足 Av = λv；椭圆的两个半轴 = A 的两个奇异值；网格线间距处处相等', en: 'The parallelogram’s area (shoelace) equals |det A|; drawn eigenvectors satisfy Av = λv; the ellipse’s semi-axes are A’s singular values; grid spacing is equal everywhere' },
  wide: true,
};

const SNAP = 0.1;

// the 2 × 2 facts the picture shows
const det = (M) => M[0] * M[3] - M[1] * M[2];
const apply = (M, p) => [M[0] * p[0] + M[1] * p[1], M[2] * p[0] + M[3] * p[1]];
function eigen(M) {
  const tr = M[0] + M[3], D = det(M), disc = tr * tr / 4 - D;
  if (disc < -1e-12) return [];
  const s = Math.sqrt(Math.max(0, disc)), ls = disc < 1e-12 ? [tr / 2] : [tr / 2 + s, tr / 2 - s];
  const out = [];
  for (const l of ls) {
    // a vector in the null space of M − λI (the better-conditioned row)
    const a = M[0] - l, b = M[1], c = M[2], d = M[3] - l;
    let v = Math.hypot(a, b) > Math.hypot(c, d) ? [-b, a] : [-d, c];
    const n = Math.hypot(v[0], v[1]);
    if (n < 1e-12) { if (Math.abs(M[1]) < 1e-12 && Math.abs(M[2]) < 1e-12) out.push({ l, v: [1, 0] }, { l, v: [0, 1] }); continue; }
    out.push({ l, v: [v[0] / n, v[1] / n] });
  }
  return out.slice(0, 2);
}
function singular(M) {
  // the semi-axes of the image of the unit circle: square roots of the eigenvalues of MᵀM
  const a = M[0] * M[0] + M[2] * M[2], b = M[0] * M[1] + M[2] * M[3], d = M[1] * M[1] + M[3] * M[3];
  const tr = a + d, s = Math.sqrt(Math.max(0, tr * tr / 4 - (a * d - b * b)));
  return [Math.sqrt(tr / 2 + s), Math.sqrt(Math.max(0, tr / 2 - s))];
}

export function make({ stage, canvas, lang }) {
  const zh = lang === 'zh';
  const g = canvas.getContext('2d');
  let W = 0, H = 0, dpr = 1;
  // the matrix [a b; c d], each entry on a spring so a demo glides; the target is what the hand set
  const M = [new Spring(1.5, 0.45, 0.9), new Spring(0.5, 0.45, 0.9), new Spring(0.4, 0.45, 0.9), new Spring(1.1, 0.45, 0.9)];
  const m = () => M.map((s) => s.x);
  const li = new Spring(0, 0.25, 0.9), lj = new Spring(0, 0.25, 0.9), show = new Spring(0, 0.8, 1);
  const plot = () => { const hx = 3.1 * (W - 4) / (H - 4); return new Plot({ x: 2, y: 2, w: W - 4, h: H - 4 }, [-hx, hx], [-3.1, 3.1], { x_step: 1, y_step: 1 }); };

  function draw() {
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.fillStyle = C.paper; g.fillRect(0, 0, W, H);
    const P = plot(), A0 = m(), k = show.x, A = [1 + (A0[0] - 1) * k, A0[1] * k, A0[2] * k, 1 + (A0[3] - 1) * k], D = det(A);
    P.axes(g, { numbers: false });
    g.save(); P.clip(g);
    // the grid, carried by A: lines A(i, t) and A(t, j), drawn long enough to cross the plot
    const R = 24;
    g.lineWidth = 0.8;
    for (let i = -R; i <= R; i++) for (const dirn of [0, 1]) {
      const p = dirn ? apply(A, [i, -R]) : apply(A, [-R, i]), q = dirn ? apply(A, [i, R]) : apply(A, [R, i]);
      g.strokeStyle = i === 0 ? tint(C.cobalt, 0.75) : tint(C.cobalt, 0.32); g.lineWidth = i === 0 ? 1.2 : 0.8;
      g.beginPath(); g.moveTo(P.X(p[0]), P.Y(p[1])); g.lineTo(P.X(q[0]), P.Y(q[1])); g.stroke();
    }
    // the unit circle (scaffolding) and its image
    g.strokeStyle = GR(0.4); g.setLineDash([3, 4]); g.lineWidth = 1; g.beginPath(); g.arc(P.X(0), P.Y(0), P.sx, 0, Math.PI * 2); g.stroke(); g.setLineDash([]);
    g.strokeStyle = C.ink; g.lineWidth = 1.3; g.beginPath();
    for (let i = 0; i <= 96; i++) { const t = i / 96 * Math.PI * 2, p = apply(A, [Math.cos(t), Math.sin(t)]); i ? g.lineTo(P.X(p[0]), P.Y(p[1])) : g.moveTo(P.X(p[0]), P.Y(p[1])); }
    g.stroke();
    // eigen-directions: lines only stretched by A
    for (const e of eigen(A)) {
      const p = P.P([-9 * e.v[0], -9 * e.v[1]]), q = P.P([9 * e.v[0], 9 * e.v[1]]);
      g.strokeStyle = tint(C.teal, 0.75); g.lineWidth = 1.2; g.beginPath(); g.moveTo(p[0], p[1]); g.lineTo(q[0], q[1]); g.stroke();
      const s = Math.sign(e.v[0] || e.v[1]) || 1, at = P.P([2.6 * e.v[0] * s, 2.6 * e.v[1] * s]);
      text(g, 'λ = ' + num(e.l, 2), at[0] + 8, at[1] - 8, { size: 12.5, weight: 650, color: C.teal, tabular: true, halo: 4 });
    }
    // the unit square's image: its area is |det A|; the arrow inside turns the way î turns toward ĵ
    const I = apply(A, [1, 0]), J = apply(A, [0, 1]), sq = [[0, 0], I, [I[0] + J[0], I[1] + J[1]], J].map((p) => P.P(p));
    g.beginPath(); sq.forEach((p, i) => (i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1]))); g.closePath();
    g.fillStyle = tint(C.ochre, 0.3); g.fill(); g.strokeStyle = C.ochre; g.lineWidth = 1.4; g.stroke();
    const c = P.P([(I[0] + J[0]) / 2, (I[1] + J[1]) / 2]);
    if (Math.abs(D) > 0.04) {
      const r = Math.min(10, 0.18 * Math.sqrt(Math.abs(D)) * P.sx), ccw = D > 0, a0 = ccw ? 0.35 : -0.35;
      g.strokeStyle = C.ochre; g.lineWidth = 1.3; g.beginPath(); g.arc(c[0], c[1] + 14, r, -a0, -a0 - (ccw ? 1 : -1) * 4.4, ccw); g.stroke();
      const ea = -a0 - (ccw ? 1 : -1) * 4.4, ex = c[0] + r * Math.cos(ea), ey = c[1] + 14 + r * Math.sin(ea), tx = ccw ? Math.sin(ea) : -Math.sin(ea), ty = ccw ? -Math.cos(ea) : Math.cos(ea);
      g.fillStyle = C.ochre; g.beginPath(); g.moveTo(ex + tx * 4, ey + ty * 4); g.lineTo(ex - ty * 3, ey + tx * 3); g.lineTo(ex + ty * 3, ey - tx * 3); g.closePath(); g.fill();
    }
    text(g, num(D, 2), c[0], c[1] - 4, { size: 13, weight: 700, color: '#8a5a0c', align: 'center', tabular: true, halo: 4 });
    g.restore();
    // î and ĵ: the matrix's columns, and the beads that move them
    const o = P.P([0, 0]), pi = P.P(I), pj = P.P(J);
    arrow(g, o[0], o[1], pi[0], pi[1], C.viridian, 2.6, 12);
    arrow(g, o[0], o[1], pj[0], pj[1], C.violet, 2.6, 12);
    glass_bead(g, pi[0], pi[1], 11, li.x, { core: C.viridian });
    glass_bead(g, pj[0], pj[1], 11, lj.x, { core: C.violet });
    sym(g, 'î', pi[0] + 14, pi[1] + 18, { size: 17, color: C.viridian, halo: 4 });
    sym(g, 'ĵ', pj[0] + 14, pj[1] - 10, { size: 17, color: C.violet, halo: 4 });
    // A, with its columns in their colours, and det A
    const x0 = 24, y0 = 30;
    sym(g, 'A', x0, y0 + 16, { size: 19, halo: 4 }); text(g, '=', x0 + 20, y0 + 16, { size: 16, halo: 4 });
    const cw = Math.max(...A0.map((v) => text_width(g, num(v, 1), { size: 15, tabular: true }))) + 12, bx = x0 + 38;
    g.fillStyle = 'rgba(251,250,247,0.86)'; g.fillRect(bx - 4, y0 - 6, cw * 2 + 16, 46);
    g.strokeStyle = C.ink; g.lineWidth = 1.2; g.beginPath(); g.moveTo(bx + 4, y0 - 4); g.lineTo(bx, y0 - 4); g.lineTo(bx, y0 + 38); g.lineTo(bx + 4, y0 + 38);
    g.moveTo(bx + cw * 2 + 4, y0 - 4); g.lineTo(bx + cw * 2 + 8, y0 - 4); g.lineTo(bx + cw * 2 + 8, y0 + 38); g.lineTo(bx + cw * 2 + 4, y0 + 38); g.stroke();
    for (let col = 0; col < 2; col++) for (let row = 0; row < 2; row++)
      text(g, num(A0[row * 2 + col], 1), bx + 4 + cw * col + cw / 2, y0 + 11 + row * 21, { size: 15, weight: 600, tabular: true, align: 'center', color: col ? C.violet : C.viridian });
    let tx = bx + cw * 2 + 26;
    tx += text(g, 'det ', tx, y0 + 22, { size: 15, color: C.ink, halo: 4 }); tx += sym(g, 'A', tx, y0 + 22, { size: 17, halo: 4 });
    text(g, ' = ' + num(det(A0), 2), tx, y0 + 22, { size: 15, weight: 650, color: '#8a5a0c', tabular: true, halo: 4 });
  }

  const hold = drags(canvas, () => {
    const P = plot(), A = m(), pi = P.P([A[0], A[2]]), pj = P.P([A[1], A[3]]);
    const near = (x, y, p) => { const d = Math.hypot(x - p[0], y - p[1]); return d < 24 ? d : Infinity; };
    const set = (col) => (x, y) => { const v = [Math.round(P.ix(x) / SNAP) * SNAP, Math.round(P.iy(y) / SNAP) * SNAP]; M[col].snap(Number(v[0].toFixed(1))); M[col + 2].snap(Number(v[1].toFixed(1))); };
    return [
      // (a hand that takes hold ends the opening move at once, so the picture is the matrix it shows)
      { hit: (x, y) => near(x, y, pi), down() { li.to(1); show.snap(1); }, move: set(0), up() { li.to(0); } },
      { hit: (x, y) => near(x, y, pj), down() { lj.to(1); show.snap(1); }, move: set(1), up() { lj.to(0); } },
    ];
  }, { change: () => sched.wake() });

  const sched = scheduler((dt) => { const busy = [...M.map((s) => s.step(dt)), li.step(dt), lj.step(dt), show.step(dt)].some(Boolean); draw(); return busy || !!hold.active; });
  function resize() {
    const r = canvas.getBoundingClientRect(); dpr = Math.min(2, devicePixelRatio || 1);
    W = r.width; H = r.height; canvas.width = Math.max(2, Math.round(W * dpr)); canvas.height = Math.max(2, Math.round(H * dpr));
    draw();
  }
  resize(); show.to(1); sched.wake(2000);   // the plane moves from the identity once, when first seen

  return {
    visible: (v) => sched.set_visible(v), resize,
    demo() { const seq = [[1.5, 1.2, 0.5, 0.4], [1, 1, 1, -1], [1.5, 0.5, 0.4, 1.1]]; seq.forEach((q, i) => setTimeout(() => { q.forEach((v, j) => M[j].to(v)); sched.wake(1500); }, i * 1800)); },
    async accept() {
      let area_err = 0, eig_err = 0, sv_err = 0, spacing_err = 0, n_eig = 0;
      const rnd = (() => { let s = 7; return () => ((s = (s * 16807) % 2147483647) / 2147483647) * 6 - 3; })();
      for (let t = 0; t < 300; t++) {
        const A = t === 0 ? [1.5, 0.5, 0.4, 1.1] : t === 1 ? [1, 2, 0.5, 1] : [rnd(), rnd(), rnd(), rnd()];
        const I = apply(A, [1, 0]), J = apply(A, [0, 1]), q = [[0, 0], I, [I[0] + J[0], I[1] + J[1]], J];
        let s = 0; for (let i = 0; i < 4; i++) { const a = q[i], b = q[(i + 1) % 4]; s += a[0] * b[1] - b[0] * a[1]; }
        area_err = Math.max(area_err, Math.abs(Math.abs(s / 2) - Math.abs(det(A))));
        for (const e of eigen(A)) { n_eig++; const Av = apply(A, e.v); eig_err = Math.max(eig_err, Math.hypot(Av[0] - e.l * e.v[0], Av[1] - e.l * e.v[1])); }
        // the ellipse's farthest and nearest points from the centre, found on the drawn curve, against σ₁ and σ₂
        const rad = (th) => { const p = apply(A, [Math.cos(th), Math.sin(th)]); return Math.hypot(p[0], p[1]); };
        const extreme = (sign) => {   // coarse over the circle, then a golden-section search around the best
          let bt = 0, bv = -Infinity; for (let i = 0; i < 720; i++) { const th = i / 720 * Math.PI * 2, v = sign * rad(th); if (v > bv) { bv = v; bt = th; } }
          let a = bt - Math.PI / 360, b = bt + Math.PI / 360; const gr = (Math.sqrt(5) - 1) / 2;
          for (let k = 0; k < 80; k++) { const c = b - gr * (b - a), d = a + gr * (b - a); if (sign * rad(c) > sign * rad(d)) b = d; else a = c; }
          return rad((a + b) / 2);
        };
        const mx = extreme(1), mn = extreme(-1);
        const [s1, s2] = singular(A); sv_err = Math.max(sv_err, Math.abs(mx - s1) / Math.max(1, s1), Math.abs(mn - s2) / Math.max(1, s1));
        // neighbouring grid lines: the same gap between every pair
        const gaps = []; for (let i = -3; i < 3; i++) { const a = apply(A, [i, 0]), b = apply(A, [i + 1, 0]); gaps.push(Math.hypot(b[0] - a[0], b[1] - a[1])); }
        spacing_err = Math.max(spacing_err, Math.max(...gaps) - Math.min(...gaps));
      }
      const pass = area_err < 1e-12 && eig_err < 1e-9 && sv_err < 1e-5 && spacing_err < 1e-12 && n_eig > 100;
      return { pass, value: zh ? `300 个矩阵：面积误差 ${area_err.toExponential(1)}；${n_eig} 个特征向量 |Av − λv| ≤ ${eig_err.toExponential(1)}；半轴与奇异值相差 ${sv_err.toExponential(1)}；间距 ${spacing_err.toExponential(1)}` : `300 matrices: area error ${area_err.toExponential(1)}; ${n_eig} eigenvectors |Av − λv| ≤ ${eig_err.toExponential(1)}; semi-axes vs singular values ${sv_err.toExponential(1)}; spacing ${spacing_err.toExponential(1)}` };
    },
  };
}
