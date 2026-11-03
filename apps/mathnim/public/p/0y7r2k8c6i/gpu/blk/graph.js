// The graph of a function. Every point of the curve is (x, f(x)): a glass bead rides the curve and drops its two
// numbers onto the axes. The curve is drawn exactly wherever you look (sampled until it is within a fifth of a pixel)
// and broken exactly where the function breaks: an asymptote is a faint dashed line, a jump has a solid end (the value
// the function takes) and a hollow one (the value it only approaches), and a domain ends with a dot. Drag the empty
// plane to move it, pinch (or ctrl + scroll) to zoom. As a building block: graph(f, { domain, view }).
import { scheduler, Spring, C, GR, roundrect } from '../lib/ui.js';
import { Plot, sample, num, decimals_of, text, sym, text_width, stroke_lines, ring_dot, glass_bead, drags, TICK } from '../lib/plot.js';

export const meta = {
  id: 'graph',
  name: { zh: '函数图像', en: 'The graph of a function' },
  means: { zh: '曲线上每一点都是 (x, f(x))：玻璃珠沿着曲线走，把两个数落到两根轴上。哪里都画得准，断开的地方就断开：渐近线是虚线，跳跃处实心的一端是取到的值、空心的一端只是靠近。', en: 'Every point is (x, f(x)): a bead rides the curve and drops its two numbers onto the axes. Exact everywhere and broken where the function breaks: an asymptote is dashed; at a jump the solid end is the value taken, the hollow end is only approached.' },
  test: { zh: '四种函数、三种缩放下，折线与真曲线的最大偏差 ≤ 0.5 px；没有一段跨过断点；跳跃处实心、空心端点与函数取值一致', en: 'For four functions at three zooms the polyline stays within 0.5 px of the true curve; no piece crosses a break; solid and hollow ends match the values taken' },
};

const FNS = [
  { key: 'cubic', label: 'x³ − 3x', f: (x) => x * x * x - 3 * x, view: [[-3, 3], [-4, 4]], x: 1.2 },
  { key: 'tan', label: 'tan x', f: Math.tan, view: [[-4.8, 4.8], [-4, 4]], x: 0.7, breaks: (a, b) => { const o = []; for (let k = Math.ceil(a / Math.PI - 0.5); (k + 0.5) * Math.PI < b; k++) o.push((k + 0.5) * Math.PI); return o; } },
  { key: 'floor', label: '⌊x⌋', f: Math.floor, view: [[-3.5, 3.5], [-3.5, 3.5]], x: 1.5, breaks: (a, b) => { const o = []; for (let k = Math.ceil(a); k < b; k++) if (k > a) o.push(k); return o; } },
  { key: 'semi', label: '√(4 − x²)', f: (x) => Math.sqrt(4 - x * x), view: [[-3, 3], [-0.6, 2.6]], x: -1, equal: true },
];

// where a break is, and what its ends are: an asymptote, or a solid end (taken) and a hollow end (only approached)
function ends_of(fn, br) {
  const f = fn.f, out = [];
  for (const [x0, x1] of br) {
    const f0 = f(x0), f1 = f(x1);
    let a = x0, b = x1;
    const same0 = (x) => { const v = f(x); return Number.isFinite(f0) ? Number.isFinite(v) && Math.abs(v - f0) <= Math.abs(v - f1) : !Number.isFinite(v); };
    for (let i = 0; i < 80 && b - a > 1e-13 * Math.max(1, Math.abs(a)); i++) { const m = (a + b) / 2; if (same0(m)) a = m; else b = m; }
    let x = (a + b) / 2; const xr = Math.round(x * 1e9) / 1e9; if (Math.abs(xr - x) < 1e-8) x = xr;
    const L = f(x - 1e-9), R = f(x + 1e-9), V = f(x);
    if (!Number.isFinite(L) && !Number.isFinite(R)) continue;
    if (Math.abs(L) > 1e6 || Math.abs(R) > 1e6) { out.push({ x, asym: true }); continue; }
    if (!Number.isFinite(L) || !Number.isFinite(R)) { if (Number.isFinite(V)) out.push({ x, solid: [x, V] }); continue; }   // a domain ends
    const solid = Number.isFinite(V) ? [x, V] : null, other = Math.abs(V - L) < 1e-9 ? R : L;
    out.push({ x, solid, hollow: Math.abs(other - V) > 1e-9 ? [x, other] : null });
  }
  return out;
}

export function make({ stage, canvas, lang }) {
  const zh = lang === 'zh';
  const g = canvas.getContext('2d');
  let W = 0, H = 0, dpr = 1, fi = 0;
  const S = { x: FNS[0].x };
  // the view, on springs: centre and log zoom (1 = the function's own view)
  const vx = new Spring(0, 0.45, 0.92), vy = new Spring(0, 0.45, 0.92), vz = new Spring(0, 0.45, 0.92);
  const lift = new Spring(0, 0.25, 0.9), drawn = new Spring(0, 0.7, 1), fade = new Spring(1, 0.3, 1);
  let old = null;   // the curve being replaced, fading out

  const chips = [];
  function plot_for(i, o = {}) {
    const fn = FNS[i], z = Math.pow(2, o.z ?? vz.x), cxv = (fn.view[0][0] + fn.view[0][1]) / 2 + (o.x ?? vx.x), cyv = (fn.view[1][0] + fn.view[1][1]) / 2 + (o.y ?? vy.x);
    const hw = (fn.view[0][1] - fn.view[0][0]) / 2 / z, hh = (fn.view[1][1] - fn.view[1][0]) / 2 / z;
    return new Plot({ x: 36, y: 58, w: W - 64, h: H - 92 }, [cxv - hw, cxv + hw], [cyv - hh, cyv + hh], { equal: !!fn.equal });
  }
  const finite_near = (fn, x) => { const v = fn.f(x); return Number.isFinite(v) && Math.abs(v) < 1e6; };

  function draw_curve(P, i, alpha, upto) {
    const fn = FNS[i], lines = sample(fn.f, P.x[0], P.x[1], P);
    g.save(); P.clip(g, 2);
    if (upto < 1) { g.beginPath(); g.rect(P.box.x - 4, 0, (P.box.w + 8) * upto, H); g.clip(); }
    for (const e of ends_of(fn, lines.breaks)) if (e.asym) { const px = P.X(e.x); g.strokeStyle = GR(0.38 * alpha); g.lineWidth = 1; g.setLineDash([4, 4]); g.beginPath(); g.moveTo(px, P.box.y); g.lineTo(px, P.box.y + P.box.h); g.stroke(); g.setLineDash([]); }
    stroke_lines(g, lines, C.cobalt, 2.2, { alpha });
    g.globalAlpha = alpha;
    for (const e of ends_of(fn, lines.breaks)) {
      if (e.hollow) ring_dot(g, P.X(e.hollow[0]), P.Y(e.hollow[1]), 4.2, C.cobalt, 0, 1.8);
      if (e.solid) ring_dot(g, P.X(e.solid[0]), P.Y(e.solid[1]), 4.2, C.cobalt, 1, 1.8);
    }
    g.restore();
    return lines;
  }
  // a number on an axis, on a small paper chip so it covers the tick numbers beneath
  function axis_chip(s, x, y, color, align) {
    const w = text_width(g, s, { size: 12.5, weight: 650, tabular: true }) + 10, x0 = align === 'center' ? x - w / 2 : align === 'right' ? x - w : x;
    g.fillStyle = C.paper; roundrect(g, x0, y - 10, w, 20, 5); g.fill();
    text(g, s, x0 + w / 2, y + 4.5, { size: 12.5, weight: 650, tabular: true, color, align: 'center' });
  }

  function draw() {
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.fillStyle = C.paper; g.fillRect(0, 0, W, H);
    const P = plot_for(fi), fn = FNS[fi], avoid = [];
    if (drawn.x > 0.98 && finite_near(fn, S.x)) {
      const px = P.X(S.x), py = P.Y(fn.f(S.x)), { ax, ay } = P.axis_at();
      if (P.inside(px, py, 4)) avoid.push({ x: px - 28, y: ax + 6, w: 56, h: 20 }, { x: ay - 70, y: py - 10, w: 64, h: 20 });
    }
    P.axes(g, { x_name: 'x', y_name: 'y', avoid });
    if (old && fade.x > 0.01) draw_curve(plot_for(old.i), old.i, fade.x, 1);
    draw_curve(P, fi, 1, drawn.x);
    // the bead on the curve, and its two numbers on the axes
    if (drawn.x > 0.98 && finite_near(fn, S.x)) {
      const y = fn.f(S.x), px = P.X(S.x), py = P.Y(y), { ax, ay } = P.axis_at();
      const { x: xs, y: ys } = P.steps(), xd = decimals_of(xs) + 1, yd = decimals_of(ys) + 1;
      if (P.inside(px, py, 4)) {
        g.save(); g.strokeStyle = GR(0.45); g.lineWidth = 1; g.setLineDash([3, 3]);
        g.beginPath(); g.moveTo(px, py); g.lineTo(px, ax); g.moveTo(px, py); g.lineTo(ay, py); g.stroke(); g.restore();
        axis_chip(num(S.x, xd), px, ax + 16, C.ink, 'center');
        axis_chip(num(y, yd), ay - 6, py, C.cobalt, 'right');
        const d = 1e-5 * (P.x[1] - P.x[0]), sl = (P.Y(fn.f(S.x + d)) - P.Y(fn.f(S.x - d))) / (P.X(S.x + d) - P.X(S.x - d));
        glass_bead(g, px, py, 11, lift.x, { dir: Math.atan(sl), core: C.cobalt });
      }
    }
    // the four functions, as their formulas: the one shown is ink
    let cx = 22; chips.length = 0;
    for (let i = 0; i < FNS.length; i++) {
      const w = text_width(g, FNS[i].label, { font: 'serif', italic: true, size: 16, weight: 400 });
      const on = i === fi;
      if (on) { g.fillStyle = 'rgba(26,27,31,0.06)'; roundrect(g, cx - 9, 16, w + 18, 28, 14); g.fill(); }
      sym(g, FNS[i].label, cx, 35, { size: 16, color: on ? C.ink : TICK });
      chips.push({ x0: cx - 9, x1: cx + w + 9, i }); cx += w + 26;
    }
  }

  // ---------- touch ----------
  let pan = null;
  const hold = drags(canvas, () => {
    const P = plot_for(fi), fn = FNS[fi], items = [];
    for (const c of chips) items.push({ hit: (x, y) => (y > 14 && y < 46 && x > c.x0 && x < c.x1 ? 0 : Infinity), down: () => choose(c.i) });
    if (finite_near(fn, S.x)) {
      const bx = P.X(S.x), by = P.Y(fn.f(S.x));
      items.push({ hit: (x, y) => { const d = Math.hypot(x - bx, y - by); return d < 22 ? d : Infinity; }, down() { lift.to(1); },
        move: (x) => { let v = P.ix(x); v = Math.max(P.x[0], Math.min(P.x[1], v)); if (finite_near(fn, v)) S.x = v; }, up() { lift.to(0); } });
    }
    items.push({ hit: (x, y) => (P.inside(x, y) ? 100 : Infinity), down: (x, y) => { pan = { x, y, vx: vx.target, vy: vy.target, P }; },
      move: (x, y) => { vx.to(pan.vx - (x - pan.x) / pan.P.sx); vy.to(pan.vy + (y - pan.y) / pan.P.sy); }, up: () => { pan = null; } });
    return items;
  }, { change: () => sched.wake() });
  function choose(i) {
    if (i === fi) return;
    old = { i: fi }; fade.snap(1).to(0);
    fi = i; S.x = FNS[i].x; vx.snap(0); vy.snap(0); vz.snap(0); drawn.snap(0).to(1); sched.wake(1500);
  }
  canvas.addEventListener('wheel', (e) => {
    if (!(e.ctrlKey || e.metaKey)) return;
    e.preventDefault();
    const r = canvas.getBoundingClientRect(), P = plot_for(fi, { x: vx.target, y: vy.target, z: vz.target });
    const mx = P.ix(e.clientX - r.left), my = P.iy(e.clientY - r.top), dz = -e.deltaY * 0.012;
    const z1 = Math.max(-2, Math.min(8, vz.target + dz)), k = Math.pow(2, vz.target - z1);
    const fn = FNS[fi], c0x = (fn.view[0][0] + fn.view[0][1]) / 2, c0y = (fn.view[1][0] + fn.view[1][1]) / 2;
    vx.to(mx - (mx - (c0x + vx.target)) * k - c0x); vy.to(my - (my - (c0y + vy.target)) * k - c0y); vz.to(z1); sched.wake();
  }, { passive: false });

  const sched = scheduler((dt) => {
    const busy = [vx.step(dt), vy.step(dt), vz.step(dt), lift.step(dt), drawn.step(dt), fade.step(dt)].some(Boolean);
    if (fade.x < 0.01) old = null;
    draw(); return busy || !!hold.active;
  });
  function resize() {
    const r = canvas.getBoundingClientRect(); dpr = Math.min(2, devicePixelRatio || 1);
    W = r.width; H = r.height; canvas.width = Math.max(2, Math.round(W * dpr)); canvas.height = Math.max(2, Math.round(H * dpr));
    draw();
  }
  resize(); drawn.to(1); sched.wake(1500);

  return {
    visible: (v) => sched.set_visible(v), resize,
    demo() { choose((fi + 1) % FNS.length); },
    async accept() {
      let worst = 0, crossings = 0, nan = 0, ends_bad = 0, ends_n = 0; const where = {};
      for (let i = 0; i < FNS.length; i++) {
        const fn = FNS[i];
        for (const o of [{ z: 0, x: 0, y: 0 }, { z: 2, x: 0.37, y: 0.21 }, { z: -1.5, x: 0, y: 0 }]) {
          const P = plot_for(i, o), lines = sample(fn.f, P.x[0], P.x[1], P), br = fn.breaks ? fn.breaks(P.x[0], P.x[1]) : [];
          for (const l of lines) for (let k = 1; k < l.length; k++) {
            const p = l[k - 1], q = l[k];
            const xa = P.ix(p[0]), xb = P.ix(q[0]);
            if (br.some((c) => c > Math.min(xa, xb) + 1e-9 && c < Math.max(xa, xb) - 1e-9)) { crossings++; where.cross = `${fn.key} z${o.z} [${xa}, ${xb}]`; }
            for (const t of [0.25, 0.5, 0.75]) {
              const px = p[0] + (q[0] - p[0]) * t, x = P.ix(px), v = fn.f(x);
              if (!Number.isFinite(v)) { nan++; continue; }
              // the true point's distance from the drawn piece (perpendicular, as the eye sees it)
              const py = p[1] + (q[1] - p[1]) * t, ty = P.Y(v), dev = Math.abs(ty - py) * Math.abs(q[0] - p[0]) / (Math.hypot(q[0] - p[0], q[1] - p[1]) || 1);
              if (P.inside(px, py) && P.inside(px, ty) && dev > worst) { worst = dev; where.worst = `${fn.key} z${o.z} x=${x.toFixed(6)}`; }
            }
          }
          if (fn.key === 'floor') {
            const E = ends_of(fn, lines.breaks);
            for (const n of br) {
              ends_n++;
              const e = E.find((u) => Math.abs(u.x - n) < 1e-9);
              if (!e || !e.solid || !e.hollow || e.solid[1] !== n || e.hollow[1] !== n - 1) ends_bad++;
            }
          }
        }
      }
      const pass = worst <= 0.5 && crossings === 0 && nan === 0 && ends_bad === 0 && ends_n > 10;
      const at = pass ? '' : ` (${where.worst ?? ''} ${where.cross ?? ''})`;   // where it went wrong, when it does
      return { pass, value: (zh ? `最大偏差 ${worst.toFixed(3)} px；跨过断点 ${crossings} 段；定义域外 ${nan} 点；跳跃端点 ${ends_n - ends_bad}/${ends_n} 对` : `worst deviation ${worst.toFixed(3)} px; ${crossings} pieces across a break; ${nan} points outside the domain; jump ends ${ends_n - ends_bad}/${ends_n}`) + at };
    },
  };
}
