// Scatter and fit. Every point’s miss from a line is a vertical stick, and the stick’s square is drawn on it (hatched:
// it is an error), so “least squares” is literally the line with the least total area of squares. Try your own line
// first: it is dashed (a guess) and its squares and their total are shown; the closer its total comes to the least
// possible, the more its dashes close, and at the least it is solid. Then look at the best line. Drag the points too.
// As a building block: fit(points, { line, squares }).
import { scheduler, Spring, C, GR, canvas2d } from '../lib/ui.js';
import { Plot, num, text, sym, hatch, stroke_prov, glass_bead, drags, choice_row } from '../lib/plot.js';

export const meta = {
  id: 'fit',
  name: { zh: '散点与拟合', en: 'Scatter and fit' },
  means: { zh: '每个点离直线的偏差是一根竖棍，棍上画出它的正方形（斜线，因为是误差），所以“最小二乘”就是正方形总面积最小的那条线。先试你自己的线：它是虚线（猜的），旁边写着它的总面积；越接近最小值虚线越合拢，到了最小就是实线。然后看最好的那条。点也可以拖。', en: 'Each point’s miss from a line is a vertical stick with its square drawn on it (hatched: an error), so least squares is the line with the least total area of squares. Try your own line first: dashed, with its total; the closer to the least, the more its dashes close, solid at the least. Then see the best line.' },
  test: { zh: '最好的那条线满足正规方程（Σr = 0，Σr·x = 0，误差 < 10⁻¹²）；随机挪动它 1000 次，总面积没有一次更小；画出的方块在屏幕上是正方形', en: 'The best line satisfies the normal equations (Σr = 0, Σr·x = 0, to 10⁻¹²); none of 1000 random moves of it has a smaller total; the drawn squares are square on screen' },
  wide: true,
};

function best(pts) {
  const n = pts.length, mx = pts.reduce((s, p) => s + p[0], 0) / n, my = pts.reduce((s, p) => s + p[1], 0) / n;
  let sxx = 0, sxy = 0; for (const [x, y] of pts) { sxx += (x - mx) ** 2; sxy += (x - mx) * (y - my); }
  const b = sxy / sxx; return { a: my - b * mx, b };
}
const sse = (pts, L) => pts.reduce((s, [x, y]) => s + (y - L.a - L.b * x) ** 2, 0);

export function make({ stage, canvas, lang }) {
  const zh = lang === 'zh';
  const cv = canvas2d(canvas), g = cv.ctx;
  const S = { pts: [[0.6, 1.4], [1.3, 1.1], [2.0, 2.3], [2.8, 2.0], [3.5, 3.1], [4.1, 2.6], [4.9, 3.9], [5.6, 3.4], [6.3, 4.6], [7.0, 4.2]], mine: { a: 1.9, b: 0.22 }, view: 0 };
  const lifts = [new Spring(0), new Spring(0)], lp = new Spring(0);
  let rows = [], held = -1;
  const plot = () => { const { W, H } = cv; return new Plot({ x: 40, y: 58, w: W - 70, h: H - 86 }, [0, 7.6], [0, 5.4], { equal: true, x_step: 1, y_step: 1 }); };
  const ends = () => [0.9, 6.7];                                        // where your line's two beads sit (x)

  function draw() {
    const { W, H } = cv, P = plot(), B = best(S.pts), L = S.view === 0 ? S.mine : B, Smin = sse(S.pts, B), Sl = sse(S.pts, L);
    g.setTransform(cv.dpr, 0, 0, cv.dpr, 0, 0); g.fillStyle = C.paper; g.fillRect(0, 0, W, H);
    P.axes(g, { x_name: 'x', y_name: 'y' });
    g.save(); P.clip(g);
    // the squares of the misses, on the sticks
    for (const [x, y] of S.pts) {
      const yl = L.a + L.b * x, px = P.X(x), p0 = P.Y(yl), p1 = P.Y(y), side = Math.abs(p1 - p0), dir = px + side > P.box.x + P.box.w ? -1 : 1;
      const sq = () => { g.beginPath(); g.rect(Math.min(px, px + dir * side), Math.min(p0, p1), side, side); };
      sq(); g.fillStyle = 'rgba(26,27,31,0.03)'; g.fill(); hatch(g, sq, { spacing: 4.5, color: GR(0.28) }); sq(); g.strokeStyle = GR(0.4); g.lineWidth = 0.8; g.stroke();
      g.strokeStyle = C.ink2; g.lineWidth = 1.2; g.beginPath(); g.moveTo(px, p0); g.lineTo(px, p1); g.stroke();
    }
    // the line: yours dashed until it is the best, the best solid
    const a = P.P([P.x[0], L.a + L.b * P.x[0]]), b = P.P([P.x[1], L.a + L.b * P.x[1]]), k = S.view === 0 ? Math.max(0, Math.min(1, (Smin / Sl - 0.6) / 0.4)) : 1;
    stroke_prov(g, () => { g.beginPath(); g.moveTo(a[0], a[1]); g.lineTo(b[0], b[1]); }, S.view === 0 ? C.ink : C.cobalt, Sl - Smin < 1e-6 ? 1 : Math.min(0.9, k), 2);
    g.restore();
    for (let i = 0; i < S.pts.length; i++) { const q = P.P(S.pts[i]); if (held === i) glass_bead(g, q[0], q[1], 9, lp.x); g.fillStyle = C.ink; g.beginPath(); g.arc(q[0], q[1], 4, 0, Math.PI * 2); g.fill(); }
    if (S.view === 0) ends().forEach((x, i) => { const q = P.P([x, S.mine.a + S.mine.b * x]); glass_bead(g, q[0], q[1], 10, lifts[i].x, { dir: Math.PI / 2 }); });
    // the totals: this line's area of squares, and the least possible
    rows = choice_row(g, [{ text: zh ? '你的线' : 'your line' }, { text: zh ? '最小二乘' : 'least squares' }], S.view, 22, 36);
    let tx = rows[1].x1 + 30;
    tx += text(g, 'Σ', tx, 36, { size: 17, font: 'serif' }); tx += sym(g, 'r²', tx, 36, { size: 16 }); tx += text(g, ' = ' + num(Sl, 2), tx, 36, { size: 15, weight: 650, tabular: true });
    text(g, (zh ? '   最小 ' : '   least ') + num(Smin, 2), tx, 36, { size: 14, color: C.cobalt, weight: 600, tabular: true });
  }

  const hold = drags(canvas, () => {
    const P = plot(), items = [];
    for (const c of rows) items.push({ hit: (x, y) => (x > c.x0 && x < c.x1 && y > c.y0 && y < c.y1 ? 0 : Infinity), down: () => { S.view = c.i; } });
    if (S.view === 0) ends().forEach((ex, i) => {
      const q = P.P([ex, S.mine.a + S.mine.b * ex]);
      items.push({ hit: (x, y) => { const d = Math.hypot(x - q[0], y - q[1]); return d < 20 ? d : Infinity; }, down() { lifts[i].to(1); }, up() { lifts[i].to(0); },
        move: (x, y) => { const [e0, e1] = ends(), y0 = i === 0 ? P.iy(y) : S.mine.a + S.mine.b * e0, y1 = i === 1 ? P.iy(y) : S.mine.a + S.mine.b * e1, b = (y1 - y0) / (e1 - e0); S.mine = { a: y0 - b * e0, b }; } });
    });
    S.pts.forEach((p, i) => { const q = P.P(p); items.push({ hit: (x, y) => { const d = Math.hypot(x - q[0], y - q[1]); return d < 14 ? d + 2 : Infinity; }, down() { held = i; lp.to(1); }, up() { lp.to(0); held = -1; }, move: (x, y) => { S.pts[i] = [Math.max(0.1, Math.min(7.5, P.ix(x))), Math.max(0.1, Math.min(5.3, P.iy(y)))]; } }); });
    return items;
  }, { change: () => sched.wake() });
  const sched = scheduler((dt) => { const busy = [...lifts.map((s) => s.step(dt)), lp.step(dt)].some(Boolean); draw(); return busy || !!hold.active; });
  const resize = () => { cv.fit(); draw(); };
  resize();

  return {
    visible: (v) => sched.set_visible(v), resize,
    async accept() {
      const B = best(S.pts), r = S.pts.map(([x, y]) => y - B.a - B.b * x);
      const n0 = Math.abs(r.reduce((s, v) => s + v, 0)), n1 = Math.abs(r.reduce((s, v, i) => s + v * S.pts[i][0], 0)), Smin = sse(S.pts, B);
      const rnd = (() => { let s = 13; return () => (s = (s * 16807) % 2147483647) / 2147483647 - 0.5; })();
      let smaller = 0; for (let i = 0; i < 1000; i++) if (sse(S.pts, { a: B.a + rnd() * 0.5, b: B.b + rnd() * 0.2 }) < Smin - 1e-12) smaller++;
      // square on screen: the stick's pixel length is the side in both directions because one unit is as long on both axes
      const P = plot(), square = Math.abs(P.sx - P.sy) < 1e-9;
      const pass = n0 < 1e-12 && n1 < 1e-12 && smaller === 0 && square;
      return { pass, value: zh ? `Σr = ${n0.toExponential(1)}，Σr·x = ${n1.toExponential(1)}；1000 次挪动更小的 ${smaller} 次；方块是正方形 ${square ? '✓' : '✗'}` : `Σr = ${n0.toExponential(1)}, Σr·x = ${n1.toExponential(1)}; ${smaller} of 1000 moves smaller; squares square ${square ? '✓' : '✗'}` };
    },
  };
}
