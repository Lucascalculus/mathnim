// A counterfactual ghost. Any figure with a parameter: the moment you take hold of the parameter, the state you
// started from stays behind as a hollow, dashed ghost. Between the ghost and now, the difference is shaded, and
// measured where it matters (here, how much further or shorter the throw lands). Let go and the ghost stays, so
// you can compare at leisure; tap it and it goes. "What if" becomes something you can see.
// As a library primitive: ghost(figure, params) for any figure that is a function of its parameters.
import { scheduler } from '../../lib/gl.js';
import { Spring } from '../../lib/ui.js';
import { SANS, SERIF, C, GR, rgba, fit2d, local } from './_loop.js';

export const meta = {
  id: 'ghost',
  name: { zh: '反事实的影子', en: 'A counterfactual ghost' },
  means: { zh: '一拖动参数，原来的样子就留成一个空心虚线的影子；影子和现在之间的差被涂出来并量出大小；松手后影子还在，点它才会走。', en: 'As soon as you drag a parameter, where you started stays as a hollow dashed ghost; the difference between ghost and now is shaded and measured; it stays after you let go until you tap it away.' },
  test: { zh: '涂色的像素面积 = 两条轨迹之差的数值积分（±1%）；影子就是拖动前那一刻的状态（逐点相同）', en: 'Shaded pixel area = the numerically integrated difference of the two paths (±1 %); the ghost is exactly the state before the drag, point for point' },
};

const g = 9.81;
// the world in metres; a phone gets a smaller field (and a slower arm) so the figure stays large
const WORLD = { wide: { X: 36, Z: 17.5, V: 18 }, narrow: { X: 24, Z: 11.5, V: 15 } };
// the throw: height at distance x, and where it lands
export const height = (p, x) => { const th = p.th * Math.PI / 180, c = Math.cos(th); return x * Math.tan(th) - g * x * x / (2 * p.v * p.v * c * c); };
export const range = (p) => p.v * p.v * Math.sin(2 * p.th * Math.PI / 180) / g;
const above = (p, x) => (x <= range(p) ? Math.max(0, height(p, x)) : 0);
const Q = { zh: { q: '球会落在哪儿？', range: '射程', was: '原来' }, en: { q: 'Where does the ball land?', range: 'range', was: 'was' } };

export function make({ stage, canvas, hud, lang }) {
  const T = Q[lang], zh = lang === 'zh', ctx = canvas.getContext('2d', { willReadFrequently: true });
  let W = 0, H = 0, dpr = 1, G = null;
  const P = { v: 14, th: 38 };
  let ghost = null, drag = false;
  const ga = new Spring(0, 0.3, 1), hold = new Spring(0, 0.25, 0.8);
  const fly = { t: -1 };

  function geo() {
    const narrow = W < 640, mx = narrow ? 22 : Math.max(60, W * 0.07);
    const Wd = WORLD[narrow ? 'narrow' : 'wide'], s = Math.min((W - 2 * mx - (narrow ? 10 : 40)) / Wd.X, (H - (narrow ? 260 : 230)) / Wd.Z), fh = Wd.Z * s;
    const top = Math.max(narrow ? 96 : 84, (H - fh - 90) / 2), ground = top + fh;
    return { narrow, ox: mx + (narrow ? 4 : 20), oy: ground, s, k: narrow ? 6.5 : 8.5, mx, top, ...Wd };
  }
  const X = (x) => G.ox + x * G.s, Y = (z) => G.oy - z * G.s;
  const tip = (p) => { const th = p.th * Math.PI / 180; return [G.ox + Math.cos(th) * p.v * G.k, G.oy - Math.sin(th) * p.v * G.k]; };
  function fit() { ({ W, H, dpr } = fit2d(canvas, ctx)); G = geo(); }

  // the path as points, sampled finely (the ghost is drawn from exactly these)
  function path(p) { const R = range(p), pts = []; for (let i = 0; i <= 240; i++) { const x = R * i / 240; pts.push([X(x), Y(Math.max(0, height(p, x)))]); } return pts; }
  function stroke(pts, w, col, dash) { ctx.setLineDash(dash || []); ctx.lineWidth = w; ctx.strokeStyle = col; ctx.beginPath(); pts.forEach((q, i) => (i ? ctx.lineTo(q[0], q[1]) : ctx.moveTo(q[0], q[1]))); ctx.stroke(); ctx.setLineDash([]); }
  // the region between two paths: along one, back along the other (crossings make loops; each is filled)
  function shade_path(g2, a, b) {
    const xm = Math.max(range(a), range(b)), n = 360;
    g2.beginPath();
    for (let i = 0; i <= n; i++) { const x = xm * i / n; i ? g2.lineTo(X(x), Y(above(b, x))) : g2.moveTo(X(x), Y(above(b, x))); }
    for (let i = n; i >= 0; i--) { const x = xm * i / n; g2.lineTo(X(x), Y(above(a, x))); }
    g2.closePath();
  }
  function arrow(p, col, dash, w = 1.6) {
    const [tx, ty] = tip(p), a = Math.atan2(ty - G.oy, tx - G.ox);
    ctx.setLineDash(dash || []); ctx.strokeStyle = col; ctx.lineWidth = w; ctx.beginPath(); ctx.moveTo(G.ox, G.oy); ctx.lineTo(tx, ty); ctx.stroke(); ctx.setLineDash([]);
    ctx.beginPath(); ctx.moveTo(tx + Math.cos(a) * 2, ty + Math.sin(a) * 2); ctx.lineTo(tx - Math.cos(a - 0.4) * 11, ty - Math.sin(a - 0.4) * 11); ctx.moveTo(tx + Math.cos(a) * 2, ty + Math.sin(a) * 2); ctx.lineTo(tx - Math.cos(a + 0.4) * 11, ty - Math.sin(a + 0.4) * 11); ctx.stroke();
  }
  function dim(x0, x1, y, label) {
    ctx.strokeStyle = C.ink; ctx.fillStyle = C.ink; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(x0, y); ctx.lineTo(x1, y); ctx.stroke();
    for (const x of [x0, x1]) { ctx.beginPath(); ctx.moveTo(x, y - 5); ctx.lineTo(x, y + 5); ctx.stroke(); }
    ctx.font = `600 14px ${SANS}`; ctx.textAlign = 'center'; ctx.fillText(label, (x0 + x1) / 2, y + 20);
  }

  function draw() {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.fillStyle = C.paper; ctx.fillRect(0, 0, W, H);
    ctx.font = `600 ${G.narrow ? 18 : 20}px ${SANS}`; ctx.fillStyle = C.ink; ctx.textAlign = 'left'; ctx.fillText(T.q, G.mx, G.top - (G.narrow ? 40 : 30));
    // the ground, with metres
    ctx.strokeStyle = GR(0.4); ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(G.mx, G.oy); ctx.lineTo(W - G.mx, G.oy); ctx.stroke();
    ctx.font = `12.5px ${SANS}`; ctx.textAlign = 'center'; ctx.fillStyle = C.ink2;
    for (let m = 5; m <= G.X; m += 5) { if (X(m) > W - G.mx) break; ctx.strokeStyle = GR(0.3); ctx.beginPath(); ctx.moveTo(X(m), G.oy); ctx.lineTo(X(m), G.oy + 5); ctx.stroke(); if (!G.narrow || m % 10 === 0) ctx.fillText(`${m} m`, X(m), G.oy + 22); }
    const a = ga.x;
    if (ghost && a > 0.01) {
      // the difference, shaded
      ctx.save(); ctx.globalAlpha = a; shade_path(ctx, ghost, P); ctx.fillStyle = rgba(C.cobalt, 0.11); ctx.fill('nonzero'); ctx.restore();
      ctx.save(); ctx.globalAlpha = a;
      stroke(path(ghost), 1.5, rgba(C.cobalt, 0.7), [6, 5]);
      arrow(ghost, GR(0.4), [4, 4], 1.2);
      ctx.lineWidth = 1.5; ctx.strokeStyle = rgba(C.cobalt, 0.7); ctx.setLineDash([3, 3]); ctx.beginPath(); ctx.arc(X(range(ghost)), G.oy, 6, 0, Math.PI * 2); ctx.stroke(); ctx.setLineDash([]);
      ctx.restore();
    }
    // now
    stroke(path(P), 2.4, C.cobalt);
    ctx.fillStyle = C.cobalt; ctx.beginPath(); ctx.arc(X(range(P)), G.oy, 5.5, 0, Math.PI * 2); ctx.fill();
    if (ghost && a > 0.01) {
      ctx.save(); ctx.globalAlpha = a;
      const d = range(P) - range(ghost); dim(X(range(ghost)), X(range(P)), G.oy + 44, `${d >= 0 ? '+' : '−'}${Math.abs(d).toFixed(1)} m`);
      ctx.restore();
    }
    // the launch: angle and speed, with the glass handle at the arrow's tip
    arrow(P, C.ink);
    const th = P.th * Math.PI / 180, ra = G.narrow ? 30 : 46;
    ctx.strokeStyle = GR(0.45); ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(G.ox, G.oy, ra, -th, 0); ctx.stroke();
    ctx.font = `italic 15px ${SERIF}`; ctx.fillStyle = C.ink; ctx.textAlign = 'left';
    // θ sits inside its arc when there is room, else under the ground line beside the arc's foot
    const lr = ra + 22; ctx.textAlign = 'center';
    if (P.th > 30) ctx.fillText(`θ ${Math.round(P.th)}°`, G.ox + Math.cos(th / 2) * lr, G.oy - Math.sin(th / 2) * lr + 5);
    else ctx.fillText(`θ ${Math.round(P.th)}°`, G.ox + ra + 4, G.oy + 22);
    ctx.textAlign = 'left';
    const [tx, ty] = tip(P);
    // the speed sits on the outside of the arrow, where the path never goes (it falls below its own tangent)
    ctx.font = `13px ${SANS}`; ctx.fillStyle = C.ink2; ctx.textAlign = 'right';
    const sl = `${P.v.toFixed(1)} m/s`, sw = ctx.measureText(sl).width;
    ctx.fillText(sl, Math.max(sw + 6, tx - Math.sin(th) * 24), Math.max(16, ty - Math.cos(th) * 24 + 4)); ctx.textAlign = 'left';
    const r = 13 + 3 * hold.x;
    ctx.save(); ctx.shadowColor = GR(0.16 + 0.1 * hold.x); ctx.shadowBlur = 10 + 6 * hold.x; ctx.shadowOffsetY = 3 + 2 * hold.x;
    ctx.fillStyle = 'rgba(255,255,255,.92)'; ctx.beginPath(); ctx.arc(tx, ty, r, 0, Math.PI * 2); ctx.fill(); ctx.restore();
    ctx.strokeStyle = GR(0.16); ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(tx, ty, r, 0, Math.PI * 2); ctx.stroke();
    ctx.fillStyle = C.ink; ctx.beginPath(); ctx.arc(tx, ty, 3, 0, Math.PI * 2); ctx.fill();
    // one throw along the new path after you let go
    if (fly.t >= 0) {
      const tf = 2 * P.v * Math.sin(th) / g, t = Math.min(fly.t, tf), x = P.v * Math.cos(th) * t;
      ctx.fillStyle = C.cobalt; ctx.beginPath(); ctx.arc(X(x), Y(Math.max(0, height(P, x))), G.narrow ? 6 : 8, 0, Math.PI * 2); ctx.fill();
    }
    hud.textContent = `${T.range} ${range(P).toFixed(1)} m` + (ghost ? ` · ${T.was} ${range(ghost).toFixed(1)} m` : '');
  }

  const sched = scheduler((dt) => {
    let b = ga.step(dt); b = hold.step(dt) || b;
    if (ghost && ga.target === 0 && ga.x < 0.01) ghost = null;
    if (fly.t >= 0) { fly.t += dt * 1.5; if (fly.t > 2 * P.v * Math.sin(P.th * Math.PI / 180) / g + 0.3) fly.t = -1; b = true; }
    draw(); return b;
  });

  function set_from(x, y) {
    const dx = x - G.ox, dy = G.oy - y;
    P.th = Math.max(8, Math.min(82, Math.atan2(dy, dx) * 180 / Math.PI));
    P.v = Math.max(6, Math.min(G.V, Math.hypot(dx, dy) / G.k));
  }
  // taking hold of the parameter leaves the ghost of where you started (if one is not already there)
  function grab() { if (!ghost) { ghost = { v: P.v, th: P.th }; ga.snap(0).to(1); } else ga.to(1); drag = true; hold.to(1); fly.t = -1; }
  function release() { drag = false; hold.to(0); fly.t = 0; sched.wake(); }
  // near the ghost's path or its landing ring
  function on_ghost(x, y) {
    if (!ghost) return false;
    if (Math.hypot(x - X(range(ghost)), y - G.oy) < 22) return true;
    return path(ghost).some((q) => Math.hypot(q[0] - x, q[1] - y) < 14);
  }
  canvas.addEventListener('pointerdown', (e) => {
    const [x, y] = local(canvas, e), [tx, ty] = tip(P);
    if (Math.hypot(x - tx, y - ty) < 30) { grab(); canvas.setPointerCapture(e.pointerId); sched.wake(); return; }
    if (on_ghost(x, y)) { ga.to(0); sched.wake(); }
  });
  canvas.addEventListener('pointermove', (e) => {
    const [x, y] = local(canvas, e);
    if (drag) { set_from(x, y); sched.wake(); return; }
    const [tx, ty] = tip(P); canvas.style.cursor = Math.hypot(x - tx, y - ty) < 30 ? 'grab' : on_ghost(x, y) ? 'pointer' : '';
  });
  canvas.addEventListener('pointerup', () => { if (drag) release(); });
  fit(); draw();

  // the shaded area, counted in pixels on its own layer
  function shaded_px() {
    const off = document.createElement('canvas'); off.width = canvas.width; off.height = canvas.height;
    const g2 = off.getContext('2d', { willReadFrequently: true }); g2.setTransform(dpr, 0, 0, dpr, 0, 0);
    shade_path(g2, ghost, P); g2.fillStyle = '#000'; g2.fill('nonzero');
    const d = g2.getImageData(0, 0, off.width, off.height).data; let s = 0;
    for (let i = 3; i < d.length; i += 4) s += d[i] / 255;
    return s / (dpr * dpr);
  }
  // ∫ |now − ghost| dx in CSS px², by Simpson's rule on a fine grid
  function integral() {
    const xm = Math.max(range(ghost), range(P)), n = 4000, h = xm / n; let s = 0;
    for (let i = 0; i <= n; i++) { const x = i * h, f = Math.abs(above(P, x) - above(ghost, x)); s += f * (i === 0 || i === n ? 1 : i % 2 ? 4 : 2); }
    return s * h / 3 * G.s * G.s;
  }
  return {
    visible: (v) => sched.set_visible(v), resize: () => { fit(); draw(); },
    // take the arrow up and in a little, then let go
    demo() {
      grab(); const a = { ...P }, b = { v: 14, th: 64 }, t0 = performance.now();
      const go = () => { const f = Math.min(1, (performance.now() - t0) / 900), e = f * f * (3 - 2 * f); P.v = a.v + (b.v - a.v) * e; P.th = a.th + (b.th - a.th) * e; sched.wake(); if (f < 1) requestAnimationFrame(go); else release(); };
      go();
    },
    set: (v, th) => { P.v = v; P.th = th; sched.wake(); },
    grab, release, dismiss: () => { ga.to(0); sched.wake(); },
    async accept() {
      const save = { ...P }, had = ghost; ghost = null; ga.snap(0);
      let worst_area = 0, exact = true;
      for (const [v0, t0, v1, t1] of [[14, 38, 14.5, 57], [12, 60, 15, 30], [15, 45, 9, 20], [10, 25, 13, 75]]) {
        ghost = null; P.v = v0; P.th = t0; const before = path(P), r0 = range(P);
        grab(); P.v = v1; P.th = t1; release(); ga.snap(1);
        // the ghost is the state before the drag, point for point
        const gp = path(ghost); exact = exact && ghost.v === v0 && ghost.th === t0 && range(ghost) === r0 && gp.every((q, i) => q[0] === before[i][0] && q[1] === before[i][1]);
        const A = shaded_px(), I = integral(); worst_area = Math.max(worst_area, Math.abs(A / I - 1));
      }
      fly.t = -1; P.v = save.v; P.th = save.th; ghost = had; ga.snap(had ? 1 : 0); draw();
      return { pass: worst_area < 0.01 && exact, value: `${zh ? '涂色面积与积分之差' : 'shaded area vs integral'} ≤ ${(worst_area * 100).toFixed(2)}%; ${zh ? '影子与拖动前' : 'ghost vs before the drag'} ${exact ? (zh ? '逐点相同' : 'identical') : (zh ? '不同' : 'differs')}` };
    },
  };
}
