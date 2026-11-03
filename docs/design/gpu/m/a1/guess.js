// A6 · The guess object. A hollow ring you place on anything: a number line, a chart, a picture. Its width is how
// sure you are (pull the rim). Then the truth arrives: it converges, dashed to solid, onto its place. If it falls
// inside, your ring fills; if not, your ring stays hollow and the gap is measured. A confident miss is revealed
// hardest (hypercorrection): those are the errors people correct best.
import { scheduler } from '../../lib/gl.js';
import { Spring, SANS } from '../../lib/ui.js';

export const meta = {
  id: 'guess',
  name: { zh: '猜测物', en: 'The guess object' },
  means: { zh: '先放下你的猜测（环的宽度就是你有多确定），再看真相落下：猜中就填满，没中就量出差多少。', en: 'Put down your guess first (the ring\'s width is how sure you are), then watch the truth land: a hit fills, a miss is measured.' },
  test: { zh: '命中与否和误差由几何直接算出；越确定的错误，揭晓越强', en: 'Hit and gap come straight from the geometry; the more confident a miss, the stronger its reveal' },
};

const COB = '#2f5bd2', INK = '#1a1b1f', GR = 'rgba(26,27,31,', VER = '#e3472c';
const Q = {
  zh: { line: '√50 在哪儿？', plane: '这两条线在哪儿相交？', go: '看看', again: '再猜一次', hit: '在你的范围里', gap: '差' },
  en: { line: 'Where is √50?', plane: 'Where do the two lines cross?', go: 'Reveal', again: 'Guess again', hit: 'inside your range', gap: 'off by' },
};

export function make({ stage, canvas, hud, lang }) {
  const T = Q[lang], ctx = canvas.getContext('2d');
  let W = 0, H = 0, dpr = 1;
  // two questions: a value on a line, a point in a plane
  const P = {
    line: { truth: Math.sqrt(50), x: new Spring(6.3, 0.3, 0.85), r: new Spring(0.45, 0.3, 0.9), k: new Spring(0, 0.6, 1), done: false },
    plane: { truth: [2.4, 1.6], x: new Spring(1.5, 0.3, 0.85), y: new Spring(2.5, 0.3, 0.85), r: new Spring(0.55, 0.3, 0.9), k: new Spring(0, 0.6, 1), done: false },
  };
  // the lines y = 0.5x + 0.4 and y = −x + 4, crossing at (2.4, 1.6)
  const btn = document.createElement('button');
  btn.style.cssText = `position:absolute;height:44px;padding:0 22px;border-radius:22px;border:0;background:${VER};color:#fff;font:600 16px ${SANS};cursor:pointer;box-shadow:0 6px 16px rgba(227,71,44,.28)`;
  btn.textContent = T.go; stage.append(btn);
  function fit() { const r = canvas.getBoundingClientRect(); dpr = Math.min(2, devicePixelRatio || 1); canvas.width = Math.round(r.width * dpr); canvas.height = Math.round(r.height * dpr); W = r.width; H = r.height; }
  function geo() {
    const narrow = W < 560;
    const line = narrow ? { x0: 24, x1: W - 24, y: H * 0.2, lo: 5, hi: 9 } : { x0: W * 0.08, x1: W * 0.44, y: H * 0.42, lo: 5, hi: 9 };
    const pl = narrow ? { x: 32, y: H * 0.36, w: W - 56, h: Math.min(W - 56, H * 0.42), lo: 0, hi: 4 } : { x: W * 0.54, y: H * 0.16, w: Math.min(W * 0.38, H * 0.6), h: Math.min(W * 0.38, H * 0.6), lo: 0, hi: 4 };
    return { narrow, line, pl };
  }
  const lx = (g, v) => g.line.x0 + (v - g.line.lo) / (g.line.hi - g.line.lo) * (g.line.x1 - g.line.x0);
  const px = (g, v) => g.pl.x + (v - g.pl.lo) / (g.pl.hi - g.pl.lo) * g.pl.w, py = (g, v) => g.pl.y + g.pl.h - (v - g.pl.lo) / (g.pl.hi - g.pl.lo) * g.pl.h;
  const ulen = (g) => (g.line.x1 - g.line.x0) / (g.line.hi - g.line.lo), plen = (g) => g.pl.w / (g.pl.hi - g.pl.lo);
  // hit and gap, from the geometry alone
  const result = (q) => q === 'line' ? { gap: Math.abs(P.line.x.target - P.line.truth), hit: Math.abs(P.line.x.target - P.line.truth) <= P.line.r.target, conf: 1 / P.line.r.target }
    : (() => { const d = Math.hypot(P.plane.x.target - P.plane.truth[0], P.plane.y.target - P.plane.truth[1]); return { gap: d, hit: d <= P.plane.r.target, conf: 1 / P.plane.r.target }; })();
  // how hard a reveal lands: stronger for a confident miss
  const emphasis = (q) => { const r = result(q), rmax = q === 'line' ? 1.6 : 1.8, sure = 1 - Math.min(1, P[q].r.target / rmax); return r.hit ? 0.4 : 0.35 + 0.65 * sure * sure; };
  function hollow_ring(cx, cy, rx, ry, fill, col) {
    ctx.save();
    if (fill > 0) { ctx.globalAlpha = 0.10 + 0.24 * fill; ctx.fillStyle = col; ctx.beginPath(); ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2); ctx.fill(); ctx.globalAlpha = 1; }
    ctx.lineWidth = 2.5 + 1.5 * fill; ctx.strokeStyle = col; ctx.beginPath(); ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2); ctx.stroke();
    ctx.restore();
  }
  // the truth converging: a dashed circle closing in from far, dashes closing up, then a solid dot
  function truth(cx, cy, k, emph) {
    if (k <= 0.001) return;
    const R = 4 + (1 - k) * 48 * (0.6 + emph);
    ctx.save();
    const dash = Math.max(0.01, 1 - k) * 9;
    ctx.setLineDash([Math.max(1, 10 - dash), dash]); ctx.lineWidth = 1.6 + emph * 1.2; ctx.strokeStyle = INK; ctx.globalAlpha = Math.min(1, k * 3);
    ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2); ctx.stroke(); ctx.setLineDash([]);
    ctx.globalAlpha = Math.max(0, (k - 0.6) / 0.4); ctx.fillStyle = INK; ctx.beginPath(); ctx.arc(cx, cy, 5, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }
  function dim(ax, ay, bx, by, label, a) {
    if (a <= 0) return;
    ctx.save(); ctx.globalAlpha = a; ctx.strokeStyle = INK; ctx.fillStyle = INK; ctx.lineWidth = 1;
    const dx = bx - ax, dy = by - ay, L = Math.hypot(dx, dy) || 1, nx = -dy / L * 5, ny = dx / L * 5;
    ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(bx, by); ctx.stroke();
    for (const [x, y] of [[ax, ay], [bx, by]]) { ctx.beginPath(); ctx.moveTo(x - nx, y - ny); ctx.lineTo(x + nx, y + ny); ctx.stroke(); }
    ctx.font = `500 13px ${SANS}`; ctx.textAlign = 'center';
    // the label stands off the line on the side away from the figure
    const sx = ny > 0 ? -nx : nx, sy = ny > 0 ? -ny : ny, mx = (ax + bx) / 2 + sx * 3.4, my = (ay + by) / 2 + sy * 3.4 + 4;
    ctx.fillText(label, mx, my);
    ctx.restore();
  }
  function draw() {
    const g = geo(); ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.fillStyle = '#fbfaf7'; ctx.fillRect(0, 0, W, H);
    ctx.textAlign = 'left'; ctx.fillStyle = INK; ctx.font = `600 18px ${SANS}`;
    // the number line
    const L = g.line, ln = P.line, u = ulen(g);
    ctx.fillText(T.line, L.x0, L.y - 64);
    ctx.strokeStyle = GR + '.55)'; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(L.x0, L.y); ctx.lineTo(L.x1, L.y); ctx.stroke();
    ctx.font = `14px ${SANS}`; ctx.textAlign = 'center';
    for (let v = L.lo; v <= L.hi + 1e-6; v += 0.5) { const x = lx(g, v), whole = Math.abs(v - Math.round(v)) < 1e-6; ctx.beginPath(); ctx.moveTo(x, L.y - (whole ? 7 : 4)); ctx.lineTo(x, L.y + (whole ? 7 : 4)); ctx.stroke(); if (whole) { ctx.fillStyle = GR + '.7)'; ctx.fillText(String(v), x, L.y + 26); } }
    const lr = result('line'), lk = Math.max(0, ln.k.x);
    hollow_ring(lx(g, ln.x.x), L.y, ln.r.x * u, 14, ln.done && lr.hit ? Math.min(1, lk * 1.2) : 0, COB);
    // the rim handle: pull it to say how sure you are
    if (!ln.done) { ctx.fillStyle = '#fff'; ctx.strokeStyle = COB; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(lx(g, ln.x.x) + ln.r.x * u, L.y, 6, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); }
    truth(lx(g, ln.truth), L.y, lk, emphasis('line'));
    if (ln.done && !lr.hit) dim(lx(g, ln.x.x), L.y - 34, lx(g, ln.truth), L.y - 34, `${T.gap} ${lr.gap.toFixed(2)}`, Math.max(0, (lk - 0.7) / 0.3));
    if (ln.done) { ctx.globalAlpha = Math.max(0, (lk - 0.8) / 0.2); ctx.fillStyle = INK; ctx.font = `500 14px ${SANS}`; ctx.fillText('7.07', lx(g, ln.truth), L.y + 50); ctx.globalAlpha = 1; }
    // the plane
    const Pl = g.pl, pq = P.plane, pu = plen(g);
    ctx.textAlign = 'left'; ctx.fillStyle = INK; ctx.font = `600 18px ${SANS}`; ctx.fillText(T.plane, Pl.x, Pl.y - 18);
    ctx.strokeStyle = GR + '.1)'; ctx.lineWidth = 1;
    for (let v = 0; v <= 4; v++) { ctx.beginPath(); ctx.moveTo(px(g, v), Pl.y); ctx.lineTo(px(g, v), Pl.y + Pl.h); ctx.stroke(); ctx.beginPath(); ctx.moveTo(Pl.x, py(g, v)); ctx.lineTo(Pl.x + Pl.w, py(g, v)); ctx.stroke(); }
    ctx.strokeStyle = GR + '.5)'; ctx.beginPath(); ctx.moveTo(Pl.x, Pl.y); ctx.lineTo(Pl.x, Pl.y + Pl.h); ctx.lineTo(Pl.x + Pl.w, Pl.y + Pl.h); ctx.stroke();
    ctx.save(); ctx.beginPath(); ctx.rect(Pl.x, Pl.y, Pl.w, Pl.h); ctx.clip();
    ctx.lineWidth = 2; ctx.strokeStyle = INK; ctx.beginPath(); ctx.moveTo(px(g, 0), py(g, 0.4)); ctx.lineTo(px(g, 4), py(g, 2.4)); ctx.stroke();
    ctx.strokeStyle = GR + '.45)'; ctx.beginPath(); ctx.moveTo(px(g, 0), py(g, 4)); ctx.lineTo(px(g, 4), py(g, 0)); ctx.stroke();
    ctx.restore();
    const pr = result('plane'), pk = Math.max(0, pq.k.x);
    hollow_ring(px(g, pq.x.x), py(g, pq.y.x), pq.r.x * pu, pq.r.x * pu, pq.done && pr.hit ? Math.min(1, pk * 1.2) : 0, COB);
    if (!pq.done) { ctx.fillStyle = '#fff'; ctx.strokeStyle = COB; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(px(g, pq.x.x) + pq.r.x * pu, py(g, pq.y.x), 6, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); }
    truth(px(g, pq.truth[0]), py(g, pq.truth[1]), pk, emphasis('plane'));
    if (pq.done && !pr.hit) dim(px(g, pq.x.x), py(g, pq.y.x), px(g, pq.truth[0]), py(g, pq.truth[1]), `${T.gap} ${pr.gap.toFixed(2)}`, Math.max(0, (pk - 0.7) / 0.3));
    // the verb
    const done = ln.done || pq.done;
    btn.textContent = done ? T.again : T.go; btn.style.background = done ? '#fff' : VER; btn.style.color = done ? INK : '#fff'; btn.style.boxShadow = done ? '0 0 0 1px rgba(26,27,31,.14)' : '0 6px 16px rgba(227,71,44,.28)';
    btn.style.left = (g.narrow ? W / 2 - btn.offsetWidth / 2 : W / 2 - btn.offsetWidth / 2) + 'px'; btn.style.top = (H - 76) + 'px';
  }
  const springs = () => [P.line.x, P.line.r, P.line.k, P.plane.x, P.plane.y, P.plane.r, P.plane.k];
  const sched = scheduler((dt) => { let b = false; for (const s of springs()) b = s.step(dt) || b; draw(); return b; });
  // input: drag a ring, pull its rim; the verb reveals both
  let drag = null;
  canvas.addEventListener('pointerdown', (e) => {
    const r = canvas.getBoundingClientRect(), x = e.clientX - r.left, y = e.clientY - r.top, g = geo(), u = ulen(g), pu = plen(g);
    const lc = [lx(g, P.line.x.x), g.line.y], pc = [px(g, P.plane.x.x), py(g, P.plane.y.x)];
    if (!P.line.done && Math.hypot(x - lc[0] - P.line.r.x * u, y - lc[1]) < 16) drag = { q: 'line', rim: true };
    else if (!P.line.done && Math.abs(y - lc[1]) < 30 && x > g.line.x0 - 20 && x < g.line.x1 + 20) drag = { q: 'line' };
    else if (!P.plane.done && Math.hypot(x - pc[0] - P.plane.r.x * pu, y - pc[1]) < 16) drag = { q: 'plane', rim: true };
    else if (!P.plane.done && x > g.pl.x - 10 && x < g.pl.x + g.pl.w + 10 && y > g.pl.y - 10 && y < g.pl.y + g.pl.h + 10) drag = { q: 'plane' };
    if (drag) { canvas.setPointerCapture(e.pointerId); move(x, y); }
  });
  function move(x, y) {
    const g = geo();
    if (drag.q === 'line') { const v = g.line.lo + (x - g.line.x0) / ulen(g); if (drag.rim) P.line.r.to(Math.max(0.08, Math.min(1.6, Math.abs(v - P.line.x.target)))); else P.line.x.to(Math.max(5, Math.min(9, v))); }
    else { const vx = g.pl.lo + (x - g.pl.x) / plen(g), vy = g.pl.lo + (g.pl.y + g.pl.h - y) / plen(g); if (drag.rim) P.plane.r.to(Math.max(0.1, Math.min(1.8, Math.hypot(vx - P.plane.x.target, vy - P.plane.y.target)))); else { P.plane.x.to(Math.max(0, Math.min(4, vx))); P.plane.y.to(Math.max(0, Math.min(4, vy))); } }
    sched.wake();
  }
  canvas.addEventListener('pointermove', (e) => { if (!drag) return; const r = canvas.getBoundingClientRect(); move(e.clientX - r.left, e.clientY - r.top); });
  canvas.addEventListener('pointerup', () => { drag = null; });
  function reveal() { for (const q of ['line', 'plane']) { P[q].done = true; P[q].k.set(0.55 + 0.35 * (1 - emphasis(q)), 1).to(1); } sched.wake(2500); }
  function reset() { for (const q of ['line', 'plane']) { P[q].done = false; P[q].k.snap(0); } sched.wake(); }
  btn.addEventListener('click', () => (P.line.done || P.plane.done ? reset() : reveal()));
  fit(); draw();
  return {
    visible: (v) => sched.set_visible(v), resize: () => { fit(); draw(); },
    demo() { P.line.x.to(6.6); P.line.r.to(0.22); P.plane.x.to(2.2); P.plane.y.to(1.8); P.plane.r.to(0.5); setTimeout(reveal, 500); sched.wake(); },
    reveal, reset,
    async accept() {
      // geometry: put the guess at known places and check hit / gap; emphasis rises with confidence for misses
      P.line.x.snap(7.5); P.line.r.snap(0.2); const a = result('line');
      P.line.r.snap(0.6); const b = result('line');
      const e1 = (P.line.r.snap(0.1), P.line.x.snap(7.7), emphasis('line')), e2 = (P.line.r.snap(0.3), emphasis('line'));
      const ok = !a.hit && Math.abs(a.gap - (7.5 - Math.sqrt(50))) < 1e-9 && b.hit && e1 > e2;
      P.line.x.snap(6.3); P.line.r.snap(0.45); reset();
      return { pass: ok, value: `${lang === 'zh' ? '7.5 ± 0.2：未中，差' : '7.5 ± 0.2: miss by'} ${a.gap.toFixed(3)}; 7.5 ± 0.6: ${b.hit ? (lang === 'zh' ? '命中' : 'hit') : '✗'}; ${lang === 'zh' ? '强调' : 'emphasis'} ${e1.toFixed(2)} > ${e2.toFixed(2)}` };
    },
  };
}
