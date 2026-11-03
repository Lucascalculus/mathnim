// The tangent and the slope. Two points on a curve make a secant, drawn dashed because it only approximates; bring the
// second point to the first (h → 0) and the dashes close up into the tangent, solid because it is the true slope. The
// slope triangle under it has a run of exactly 1, so its rise is the slope. The name follows: Δy / Δx while h ≠ 0,
// f′(x) when h = 0. As a building block: tangent(f, x, { h }) on any graph.
import { scheduler, Spring, C, GR } from '../lib/ui.js';
import { Plot, sample, num, text, sym, text_width, stroke_lines, stroke_prov, ring_dot, glass_bead, drags, TICK } from '../lib/plot.js';

export const meta = {
  id: 'tangent',
  name: { zh: '切线与斜率', en: 'The tangent and the slope' },
  means: { zh: '两点连成割线，画成虚线，因为它只是近似；把第二个点挪到第一个点上（h → 0），虚线合拢成实线的切线。下面的斜率三角形底边恰好是 1，所以它的高就是斜率。', en: 'Two points make a secant, dashed because it only approximates; bring the second point onto the first (h → 0) and the dashes close into the solid tangent. The slope triangle has a run of exactly 1, so its rise is the slope.' },
  test: { zh: '割线斜率随 h 减半误差减半（一阶收敛），h = 0 时画出的直线与真切线处处相差 < 0.05 px；三角形底边 = 1、高 = 斜率', en: 'Halving h halves the secant’s error (first order); at h = 0 the drawn line is within 0.05 px of the true tangent; the triangle’s run is 1 and its rise the slope' },
};

const f = (x) => 0.15 * x * x * x - 0.9 * x + 0.6;
const fp = (x) => 0.45 * x * x - 0.9;
const H0 = 1.6;                     // the h at which a secant is fully dashed

export function make({ stage, canvas, lang }) {
  const zh = lang === 'zh';
  const g = canvas.getContext('2d');
  let W = 0, H = 0, dpr = 1;
  const S = { x: -0.6 };
  const h = new Spring(1.2, 0.42, 0.86), lift = new Spring(0, 0.25, 0.9), lift2 = new Spring(0, 0.25, 0.9);
  const plot = () => new Plot({ x: 40, y: 64, w: W - 70, h: H - 96 }, [-3.3, 3.3], [-1.6, 2.8]);
  // the line drawn through x with slope m, as canvas points at the plot's edges
  const line_at = (P, x, m) => { const y = f(x); return [P.P([P.x[0], y + m * (P.x[0] - x)]), P.P([P.x[1], y + m * (P.x[1] - x)])]; };
  const slope = () => (Math.abs(h.x) < 1e-9 ? fp(S.x) : (f(S.x + h.x) - f(S.x)) / h.x);

  function draw() {
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.fillStyle = C.paper; g.fillRect(0, 0, W, H);
    const P = plot(), m = slope(), k = Math.max(0, 1 - Math.abs(h.x) / H0), exact = Math.abs(h.x) < 1e-6;
    const r0 = S.x + 1 <= P.x[1] - 0.1, xr = r0 ? S.x + 1 : S.x - 1, q0 = P.P([S.x, f(S.x)]), qr = P.P([xr, f(S.x)]), qt = P.P([xr, f(S.x) + m * (xr - S.x)]);
    P.axes(g, { x_name: 'x', y_name: 'y', avoid: [
      { x: (q0[0] + qr[0]) / 2 - 8, y: q0[1] + (qt[1] < q0[1] ? 4 : -20), w: 16, h: 16 },
      { x: r0 ? qr[0] + 4 : qr[0] - 50, y: (qr[1] + qt[1]) / 2 - 8, w: 46, h: 16 },
      { x: q0[0] - 14, y: q0[1] - 14, w: 28, h: 28 },
      // the whole triangle and the line above or below it where its run is written
      { x: Math.min(q0[0], qr[0]) - 4, y: Math.min(q0[1], qt[1]) - 22, w: Math.abs(qr[0] - q0[0]) + 8, h: Math.abs(qt[1] - q0[1]) + 44 }] });
    g.save(); P.clip(g, 2);
    // the secant (dashed) closing into the tangent (solid)
    const [a, b] = line_at(P, S.x, m);
    stroke_prov(g, () => { g.beginPath(); g.moveTo(a[0], a[1]); g.lineTo(b[0], b[1]); }, C.teal, exact ? 1 : Math.min(0.9, k), 1.8);
    stroke_lines(g, sample(f, P.x[0], P.x[1], P), C.cobalt, 2.2);
    // the slope triangle: a run of exactly 1, so the rise is the slope
    const right = S.x + 1 <= P.x[1] - 0.1, x1 = right ? S.x + 1 : S.x - 1, y0 = f(S.x), y1 = y0 + m * (x1 - S.x);
    const p0 = P.P([S.x, y0]), pr = P.P([x1, y0]), pt = P.P([x1, y1]);
    g.strokeStyle = GR(0.55); g.lineWidth = 1; g.beginPath(); g.moveTo(p0[0], p0[1]); g.lineTo(pr[0], pr[1]); g.stroke();
    g.strokeStyle = C.teal; g.lineWidth = 2; g.lineCap = 'round'; g.beginPath(); g.moveTo(pr[0], pr[1]); g.lineTo(pt[0], pt[1]); g.stroke();
    text(g, '1', (p0[0] + pr[0]) / 2, p0[1] + (pt[1] < p0[1] ? 16 : -7), { size: 12, color: TICK, align: 'center', tabular: true, halo: 3 });
    text(g, num(m, 2), pr[0] + (right ? 7 : -7), (pr[1] + pt[1]) / 2 + 4, { size: 12.5, weight: 650, color: C.teal, align: right ? 'left' : 'right', tabular: true, halo: 3 });
    g.restore();
    // the second point (only approximate: hollow), then the first
    if (!exact) { const q = P.P([S.x + h.x, f(S.x + h.x)]); glass_bead(g, q[0], q[1], 9, lift2.x, { dir: Math.atan(-fp(S.x + h.x) * P.sy / P.sx), alpha: Math.min(1, Math.abs(h.x) / 0.12) }); ring_dot(g, q[0], q[1], 3.2, C.teal, 0, 1.6); }
    glass_bead(g, p0[0], p0[1], 11, lift.x, { dir: Math.atan(-fp(S.x) * P.sy / P.sx), core: C.cobalt });
    // the name of the slope: Δy / Δx while h ≠ 0, f′(x) once h = 0
    let tx = 22; const ty = 40;
    if (exact) { tx += sym(g, 'f′', tx, ty, { size: 19 }); tx += text(g, '(' + num(S.x, 2) + ')', tx, ty, { size: 16, tabular: true }); }
    else { tx += sym(g, 'Δy / Δx', tx, ty, { size: 18 }); }
    tx += text(g, ' = ', tx, ty, { size: 16 });
    text(g, num(m, 3), tx, ty, { size: 17, weight: 650, color: C.teal, tabular: true });
    if (!exact) { const s = num(h.x, 2), w = text_width(g, s, { size: 15, tabular: true }); sym(g, 'h', W - 30 - w - 26, ty, { size: 18 }); text(g, ' = ' + s, W - 30 - w - 14, ty, { size: 15, tabular: true }); }
  }

  // ---------- touch ----------
  let drag2 = null;
  const hold = drags(canvas, () => {
    const P = plot(), p0 = P.P([S.x, f(S.x)]), q = P.P([S.x + h.x, f(S.x + h.x)]);
    const d = (x, y, p, r) => { const v = Math.hypot(x - p[0], y - p[1]); return v < r ? v : Infinity; };
    const items = [{ hit: (x, y) => d(x, y, p0, 22), down() { lift.to(1); }, move: (x) => { S.x = Math.max(-3, Math.min(3, P.ix(x))); }, up() { lift.to(0); } }];
    if (Math.abs(h.x) > 1e-6) items.push({ hit: (x, y) => d(x, y, q, 20) + 0.5, down() { lift2.to(1); drag2 = true; },
      move: (x) => { const v = Math.max(-3.2, Math.min(3.2, P.ix(x))) - S.x; h.snap(Math.abs(v) < 0.02 ? 0.02 * Math.sign(v || 1) : v); },
      up() { lift2.to(0); drag2 = null; if (Math.abs(h.x) < 0.12) h.to(0); } });   // let go close enough: it closes up
    else items.push({ hit: (x, y) => d(x, y, p0, 30) + 25, move: (x) => { const v = P.ix(x) - S.x; if (Math.abs(v) > 0.05) h.snap(v); } });  // pull a point back out
    return items;
  }, { change: () => sched.wake() });

  const sched = scheduler((dt) => { const busy = [h.step(dt), lift.step(dt), lift2.step(dt)].some(Boolean); if (Math.abs(h.x) < 2e-4 && h.target === 0) h.snap(0); draw(); return busy || !!hold.active; });
  function resize() {
    const r = canvas.getBoundingClientRect(); dpr = Math.min(2, devicePixelRatio || 1);
    W = r.width; H = r.height; canvas.width = Math.max(2, Math.round(W * dpr)); canvas.height = Math.max(2, Math.round(H * dpr));
    draw();
  }
  resize();

  return {
    visible: (v) => sched.set_visible(v), resize,
    demo() { h.to(0); sched.wake(2000); },
    async accept() {
      const P = plot();
      // 1. first-order convergence: halving h halves the error, at many x
      let worst_ratio = 0, best_ratio = Infinity;
      for (let i = 0; i < 40; i++) {
        const x = -2.8 + 5.6 * i / 39, e1 = Math.abs((f(x + 0.02) - f(x)) / 0.02 - fp(x)), e2 = Math.abs((f(x + 0.01) - f(x)) / 0.01 - fp(x));
        if (e1 < 1e-9) continue;
        const r = e1 / e2; worst_ratio = Math.max(worst_ratio, r); best_ratio = Math.min(best_ratio, r);
      }
      // 2. at h = 0 the drawn line is the tangent: compare with the true tangent across the plot, in pixels
      const save = h.x; h.snap(0);
      let line_err = 0, tri_err = 0;
      for (let i = 0; i < 40; i++) {
        S.x = -2.9 + 5.8 * i / 39;
        const m = slope(), [a, b] = line_at(P, S.x, m);
        for (const t of [0, 0.3, 0.7, 1]) {
          const px = a[0] + (b[0] - a[0]) * t, py = a[1] + (b[1] - a[1]) * t, x = P.ix(px), ty = P.Y(f(S.x) + fp(S.x) * (x - S.x));
          line_err = Math.max(line_err, Math.abs(py - ty));
        }
        // 3. the triangle: run 1 and rise m in data units, its top on the line
        const run = 1, rise = m * run, top = f(S.x) + rise;
        tri_err = Math.max(tri_err, Math.abs(top - (f(S.x) + fp(S.x))));
      }
      S.x = -0.6; h.snap(save); sched.wake();
      const pass = best_ratio > 1.8 && worst_ratio < 2.2 && line_err < 0.05 && tri_err < 1e-12;
      return { pass, value: zh ? `h 减半，误差之比 ${best_ratio.toFixed(2)}–${worst_ratio.toFixed(2)}（一阶）；切线误差 ${line_err.toExponential(1)} px；三角形 ${tri_err < 1e-12 ? '✓' : tri_err.toExponential(1)}` : `halving h: error ratio ${best_ratio.toFixed(2)}–${worst_ratio.toFixed(2)} (first order); tangent error ${line_err.toExponential(1)} px; triangle ${tri_err < 1e-12 ? '✓' : tri_err.toExponential(1)}` };
    },
  };
}
