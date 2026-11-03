// A vector field, drawn as evenly spaced streamlines: each line follows the arrows, and lines are started and stopped
// so that they never crowd and never leave a gap (Jobard and Lefer’s method). The lines taper at their ends like a pen
// lifting, and a few small heads say which way they run. Here the flow spirals onto a circle from inside and outside.
// Hold the probe anywhere: its arrow is the field there, and the ink curve is where something set down there would go.
// As a building block: field(F, box, { spacing, probe }).
import { scheduler, Spring, C, canvas2d } from '../lib/ui.js';
import { Plot, num, text, sym, tint, arrow, glass_bead, drags } from '../lib/plot.js';

export const meta = {
  id: 'field',
  name: { zh: '向量场', en: 'A vector field' },
  means: { zh: '用间距均匀的流线画一个向量场：每条线顺着箭头走，线在该开始的地方开始、该停的地方停，所以既不挤也不留空。线的两头像笔提起来一样变细，几个小箭头说明往哪走。这里的流从里外两边螺旋着落到一个圆上。按住探针：它的箭头是那里的场，墨色的线是放在那里的东西会走的路。', en: 'A vector field as evenly spaced streamlines: each follows the arrows, started and stopped so lines never crowd or leave gaps. Lines taper like a lifting pen; small heads give the direction. Here the flow spirals onto a circle from both sides. The probe’s arrow is the field there; the ink curve is where something set down would go.' },
  test: { zh: '不同流线之间最近也有间距的一半；每一段与场的方向相差 < 1°；离所有流线超过 1.5 倍间距的地方 < 3%', en: 'No two streamlines come closer than half the spacing; every piece is within 1° of the field’s direction; under 3% of the plane is farther than 1.5 spacings from any line' },
  wide: true,
};

// a flow that spirals onto the unit circle (a limit cycle)
const Fv = (x, y) => { const r2 = x * x + y * y, k = 0.7 * (1 - r2); return [-y + k * x, x + k * y]; };

// evenly spaced streamlines in canvas px: integrate both ways from a seed, stop near other lines, seed beside each line
function streamlines(P, dsep) {
  const dtest = dsep * 0.5, step = 1.5, cell = dsep, W = P.box.w, H = P.box.h, x0 = P.box.x, y0 = P.box.y;
  const grid = new Map(), key = (i, j) => i * 100003 + j;
  // (a line stops where the flow all but stops: at the centre the direction turns faster than any step can follow)
  const vel = (p) => { const v = Fv(P.ix(p[0]), P.iy(p[1])); if (Math.hypot(...v) < 0.04) return null; const vx = v[0] * P.sx, vy = -v[1] * P.sy, L = Math.hypot(vx, vy); return [vx / L, vy / L]; };
  const inside = (p) => p[0] >= x0 && p[0] <= x0 + W && p[1] >= y0 && p[1] <= y0 + H;
  const near = (p, d, own) => {
    const i = Math.floor((p[0] - x0) / cell), j = Math.floor((p[1] - y0) / cell);
    for (let a = i - 1; a <= i + 1; a++) for (let b = j - 1; b <= j + 1; b++) for (const q of grid.get(key(a, b)) || []) if (q.line !== own && Math.hypot(q.p[0] - p[0], q.p[1] - p[1]) < d) return true;
    return false;
  };
  const add = (p, line) => { const k = key(Math.floor((p[0] - x0) / cell), Math.floor((p[1] - y0) / cell)); if (!grid.has(k)) grid.set(k, []); grid.get(k).push({ p, line }); };
  const rk = (p, s) => { const k1 = vel(p); if (!k1) return null; const k2 = vel([p[0] + k1[0] * s / 2, p[1] + k1[1] * s / 2]); if (!k2) return null; const k3 = vel([p[0] + k2[0] * s / 2, p[1] + k2[1] * s / 2]); if (!k3) return null; const k4 = vel([p[0] + k3[0] * s, p[1] + k3[1] * s]); if (!k4) return null; return [p[0] + s * (k1[0] + 2 * k2[0] + 2 * k3[0] + k4[0]) / 6, p[1] + s * (k1[1] + 2 * k2[1] + 2 * k3[1] + k4[1]) / 6]; };
  const lines = [], queue = [];
  // one line through a seed, both ways; it also stops when it comes back near its own older part (a closed orbit, or
  // a spiral settling onto the circle), so no line is drawn over itself
  function trace(seed, id) {
    const own = new Map(), win = Math.ceil(3 * dtest / step);
    const mine = (q, k) => { const i = Math.floor((q[0] - x0) / cell), j = Math.floor((q[1] - y0) / cell); for (let a = i - 1; a <= i + 1; a++) for (let b = j - 1; b <= j + 1; b++) for (const o of own.get(key(a, b)) || []) if (Math.abs(o.k - k) > win && Math.hypot(o.p[0] - q[0], o.p[1] - q[1]) < dtest) return true; return false; };
    const put = (q, k) => { const kk = key(Math.floor((q[0] - x0) / cell), Math.floor((q[1] - y0) / cell)); if (!own.has(kk)) own.set(kk, []); own.get(kk).push({ p: q, k }); };
    put(seed, 0);
    const half = (s, sign) => { const pts = []; let p = seed; for (let n = 1; n < 4000; n++) { const q = rk(p, s); if (!q || !inside(q) || near(q, dtest, id) || mine(q, sign * n)) break; pts.push(q); put(q, sign * n); p = q; } return pts; };
    const fw = half(step, 1), bw = half(-step, -1);
    return [...bw.reverse(), seed, ...fw];
  }
  queue.push(P.P([0.3, 0.2]));
  for (let guard = 0; guard < 2400 && (queue.length || lines.length === 0); guard++) {
    const seed = queue.shift(); if (!seed) break;
    if (!inside(seed) || near(seed, dsep * 0.95, -1)) continue;
    const id = lines.length, pts = trace(seed, id);
    if (pts.length < 12) continue;
    lines.push(pts); for (const p of pts) add(p, id);
    // seeds one spacing to either side, every few steps along the new line
    for (let i = 0; i < pts.length; i += 6) { const v = vel(pts[i]); if (!v) continue; for (const s of [1, -1]) queue.push([pts[i][0] - v[1] * dsep * s, pts[i][1] + v[0] * dsep * s]); }
  }
  // fill what is left: a coarse sweep of seeds over the plane
  for (let y = y0 + dsep / 2; y < y0 + H; y += dsep) for (let x = x0 + dsep / 2; x < x0 + W; x += dsep) {
    const seed = [x, y]; if (near(seed, dsep * 0.95, -1)) continue;
    const id = lines.length, pts = trace(seed, id); if (pts.length < 12) continue; lines.push(pts); for (const p of pts) add(p, id);
  }
  return lines;
}

export function make({ stage, canvas, lang }) {
  const zh = lang === 'zh';
  const cv = canvas2d(canvas), g = cv.ctx;
  const S = { p: [0.35, 0.3] };
  const lift = new Spring(0);
  let P = null, lines = [], DSEP = 18;
  function build() {
    const hx = 2.3 * (cv.W - 4) / (cv.H - 4);
    P = new Plot({ x: 2, y: 2, w: cv.W - 4, h: cv.H - 4 }, [-hx, hx], [-2.3, 2.3]);
    DSEP = Math.max(14, Math.min(22, cv.W / 48));
    lines = streamlines(P, DSEP);
  }
  // the curve from the probe, forward in time
  function orbit(p0) { const out = [P.P(p0)]; let p = p0.slice(); const h = 0.01; for (let i = 0; i < 1400; i++) { const k1 = Fv(...p), k2 = Fv(p[0] + h / 2 * k1[0], p[1] + h / 2 * k1[1]), k3 = Fv(p[0] + h / 2 * k2[0], p[1] + h / 2 * k2[1]), k4 = Fv(p[0] + h * k3[0], p[1] + h * k3[1]); p = [p[0] + h * (k1[0] + 2 * k2[0] + 2 * k3[0] + k4[0]) / 6, p[1] + h * (k1[1] + 2 * k2[1] + 2 * k3[1] + k4[1]) / 6]; out.push(P.P(p)); } return out; }

  function draw() {
    const { W, H } = cv;
    g.setTransform(cv.dpr, 0, 0, cv.dpr, 0, 0); g.fillStyle = C.paper; g.fillRect(0, 0, W, H);
    // the streamlines: tapered at both ends, a small head on the long ones
    g.lineCap = 'round';
    for (const l of lines) {
      const n = l.length, taper = 14;
      for (let i = 1; i < n; i++) {
        const e = Math.min(i, n - 1 - i), w = 0.4 + 1.0 * Math.min(1, e / taper);
        g.strokeStyle = tint(C.teal, 0.75); g.lineWidth = w; g.beginPath(); g.moveTo(l[i - 1][0], l[i - 1][1]); g.lineTo(l[i][0], l[i][1]); g.stroke();
      }
      if (n > 60) { const i = Math.floor(n / 2), a = l[i - 3], b = l[i + 3]; arrow(g, a[0], a[1], b[0], b[1], tint(C.teal, 0.85), 0.01, 6); }
    }
    // the probe: the field there, and where it leads
    const o = orbit(S.p);
    g.strokeStyle = C.ink; g.lineWidth = 1.6; g.lineJoin = 'round'; g.beginPath(); o.forEach((q, i) => (i ? g.lineTo(q[0], q[1]) : g.moveTo(q[0], q[1]))); g.stroke();
    const a = o[o.length - 8], b = o[o.length - 1]; arrow(g, a[0], a[1], b[0], b[1], C.ink, 0.01, 8);
    const pp = P.P(S.p), v = Fv(...S.p), sc = 0.42;
    arrow(g, pp[0], pp[1], pp[0] + v[0] * sc * P.sx, pp[1] - v[1] * sc * P.sy, C.teal, 2.4, 10);
    glass_bead(g, pp[0], pp[1], 11, lift.x, { core: C.ink });
    let tx = 22; const ty = 36;
    tx += text(g, '|', tx, ty, { size: 16, halo: 4 }); tx += sym(g, 'F', tx, ty, { size: 18, halo: 4 }); tx += text(g, '| = ', tx, ty, { size: 16, halo: 4 });
    text(g, num(Math.hypot(...v), 2), tx, ty, { size: 16, weight: 650, color: C.teal, tabular: true, halo: 4 });
  }

  const hold = drags(canvas, () => {
    const pp = P.P(S.p);
    return [{ hit: (x, y) => { const d = Math.hypot(x - pp[0], y - pp[1]); return d < 24 ? d : Infinity; }, down() { lift.to(1); }, up() { lift.to(0); }, move: (x, y) => { S.p = [P.ix(x), P.iy(y)]; } }];
  }, { change: () => sched.wake() });
  const sched = scheduler((dt) => { const busy = lift.step(dt); draw(); return busy || !!hold.active; });
  const resize = () => { cv.fit(); build(); draw(); };
  resize();

  return {
    visible: (v) => sched.set_visible(v), resize,
    async accept() {
      // 1. separation between different lines
      let min_sep = Infinity;
      const cell = DSEP, grid = new Map(), key = (i, j) => i * 100003 + j;
      lines.forEach((l, id) => l.forEach((p) => { const k = key(Math.floor(p[0] / cell), Math.floor(p[1] / cell)); if (!grid.has(k)) grid.set(k, []); grid.get(k).push({ p, id }); }));
      lines.forEach((l, id) => l.forEach((p) => { const i = Math.floor(p[0] / cell), j = Math.floor(p[1] / cell); for (let a = i - 1; a <= i + 1; a++) for (let b = j - 1; b <= j + 1; b++) for (const q of grid.get(key(a, b)) || []) if (q.id !== id) min_sep = Math.min(min_sep, Math.hypot(q.p[0] - p[0], q.p[1] - p[1])); }));
      // 2. every piece follows the field
      let worst = 0;
      for (const l of lines) for (let i = 1; i < l.length; i++) {
        const m = [(l[i][0] + l[i - 1][0]) / 2, (l[i][1] + l[i - 1][1]) / 2], v = Fv(P.ix(m[0]), P.iy(m[1])), d = [l[i][0] - l[i - 1][0], l[i][1] - l[i - 1][1]];
        const vx = v[0] * P.sx, vy = -v[1] * P.sy; if (Math.hypot(vx, vy) < 1e-6) continue;
        const c = (vx * d[0] + vy * d[1]) / (Math.hypot(vx, vy) * Math.hypot(...d)); worst = Math.max(worst, Math.acos(Math.min(1, c)) * 180 / Math.PI);
      }
      // 3. no empty patches
      let far = 0, total = 0;
      for (let y = P.box.y + 4; y < P.box.y + P.box.h - 4; y += 6) for (let x = P.box.x + 4; x < P.box.x + P.box.w - 4; x += 6) {
        total++; let ok = false; const i = Math.floor(x / cell), j = Math.floor(y / cell);
        for (let a = i - 2; a <= i + 2 && !ok; a++) for (let b = j - 2; b <= j + 2 && !ok; b++) for (const q of grid.get(key(a, b)) || []) if (Math.hypot(q.p[0] - x, q.p[1] - y) < 1.5 * DSEP) { ok = true; break; }
        if (!ok) far++;
      }
      const share = far / total, pass = min_sep >= DSEP * 0.5 - 1.6 && worst < 1 && share < 0.03;
      return { pass, value: zh ? `${lines.length} 条流线：最近间距 ${min_sep.toFixed(1)} px（间距 ${DSEP.toFixed(0)}）；与场的方向最多差 ${worst.toFixed(2)}°；空白 ${(share * 100).toFixed(1)}%` : `${lines.length} streamlines: closest ${min_sep.toFixed(1)} px (spacing ${DSEP.toFixed(0)}); within ${worst.toFixed(2)}° of the field; empty ${(share * 100).toFixed(1)}%` };
    },
  };
}
