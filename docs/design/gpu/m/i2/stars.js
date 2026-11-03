// A constellation of what you know. A course drawn as a star chart: each concept is a star, each prerequisite a line
// between two stars. What you know is solid and takes the colour of its noun; what you are learning is a hollow
// ring; what lies ahead is faint, joined by dashed lines (not yet true for you). The one vermilion verb sits on the
// next star to learn. Press it and that star fills in, then the verb travels along a line to the next one. The
// chart zooms and pans like a map (wheel, pinch, drag, with momentum); labels that would collide give way by rank.
// As a library primitive: constellation(course.graph, learner.state) on any course page.
import { scheduler } from '../../lib/gl.js';
import { Spring, Spring2 } from '../../lib/ui.js';
import { css, canvas2d, C, SANS } from './_nav.js';

export const meta = {
  id: 'stars',
  name: { zh: '你所知道的星图', en: 'A constellation of what you know' },
  means: { zh: '一门课是一张星图：概念是星，先修关系是连线。学会的星是实心的、带着它名词的颜色；在学的是空心环；下一颗要学的星上，是唯一的朱红动词。', en: 'A course is a star chart: concepts are stars, prerequisites are the lines between them. What you know is solid in its noun’s colour, what you are learning is a hollow ring, and the one vermilion verb sits on the next star to learn.' },
  test: { zh: '图无环；每颗学会的星，它的先修都已学会；任何缩放下标签互不重叠、不压住星', en: 'The graph is acyclic; every learned star’s prerequisites are learned; at every zoom no label overlaps another label or a star' },
  wide: true,
};

// model predictive control, as concepts. [id, zh, en, family, depth (x), lane (y), prerequisites]
const FAM = { sys: C.cobalt, cost: C.viridian, con: C.ochre, opt: C.violet, loop: C.teal };
const NODES = [
  ['state', '状态', 'State', 'sys', 0, 0.02, []],
  ['model', '模型', 'Model', 'sys', 1.0, -0.5, ['state']],
  ['discrete', '离散化', 'Discretising', 'sys', 2.0, -0.82, ['model']],
  ['predict', '预测', 'Prediction', 'sys', 3.05, -0.64, ['discrete']],
  ['cost', '代价', 'Cost', 'cost', 1.05, 0.2, ['state']],
  ['quad', '二次型', 'Quadratic form', 'cost', 2.05, 0.06, ['cost']],
  ['weights', '权重 Q、R', 'Weights Q, R', 'cost', 3.1, -0.1, ['quad']],
  ['convex', '凸性', 'Convexity', 'opt', 3.0, 0.38, ['quad']],
  ['constraint', '约束', 'Constraints', 'con', 1.75, 0.8, ['state']],
  ['qp', '二次规划', 'Quadratic programme', 'opt', 4.15, 0.12, ['predict', 'weights', 'convex', 'constraint']],
  ['kkt', 'KKT 条件', 'KKT conditions', 'opt', 5.15, 0.5, ['qp']],
  ['horizon', '滚动时域', 'Receding horizon', 'loop', 5.2, -0.34, ['qp']],
  ['active', '起作用的约束', 'Active constraints', 'con', 6.15, 0.82, ['kkt', 'constraint']],
  ['feedback', '反馈', 'Feedback', 'loop', 6.25, -0.74, ['horizon']],
  ['terminal', '终端代价', 'Terminal cost', 'cost', 6.3, -0.06, ['horizon', 'weights']],
  ['soft', '软约束', 'Soft constraints', 'con', 7.3, 0.62, ['active']],
  ['stability', '稳定性', 'Stability', 'loop', 7.4, -0.42, ['terminal', 'feedback']],
];
const LEARNED0 = ['state', 'model', 'discrete', 'predict', 'cost', 'quad', 'weights', 'convex', 'constraint', 'qp'];
const LEARNING0 = ['kkt'];
const ORDER = ['horizon', 'feedback', 'terminal', 'stability', 'kkt', 'active', 'soft'];
const VERB = { zh: '学', en: 'Learn' };

const CSS = `
.st-wrap{position:absolute;inset:0;background:${C.paper};overflow:hidden;touch-action:none;user-select:none;-webkit-user-select:none;cursor:grab}
.st-wrap canvas{position:absolute;inset:0;width:100%;height:100%}
.st-verb{position:absolute;left:0;top:0;height:36px;padding:0 16px 0 14px;border-radius:18px;border:0;background:${C.vermilion};color:#fff;
  font:600 15px ${SANS};white-space:nowrap;cursor:pointer;box-shadow:0 4px 12px rgba(227,71,44,.24);display:flex;align-items:center;gap:7px;will-change:transform}
.st-verb b{font-weight:600;opacity:.82}
.st-wrap.narrow .st-verb{height:44px;border-radius:22px;padding:0 18px 0 16px}
`;

export function make({ stage, canvas, hud, lang }) {
  canvas.style.display = 'none';
  css('st-css', CSS);
  const zh = lang === 'zh';
  const wrap = document.createElement('div'); wrap.className = 'st-wrap'; stage.append(wrap);
  const cv = document.createElement('canvas'); wrap.append(cv);
  const G = canvas2d(cv);
  const verb = document.createElement('button'); verb.className = 'st-verb'; wrap.append(verb);

  const N = NODES.map(([id, z, e, fam, d, lane, pre]) => ({ id, name: zh ? z : e, fam, col: FAM[fam], d, lane, pre, fill: new Spring(0, 0.55, 0.9), ring: new Spring(0, 0.4, 0.9) }));
  const by = Object.fromEntries(N.map((n) => [n.id, n]));
  const state = {};   // id → 'learned' | 'learning' | 'ahead'
  function reset_state() {
    for (const n of N) state[n.id] = LEARNED0.includes(n.id) ? 'learned' : LEARNING0.includes(n.id) ? 'learning' : 'ahead';
    for (const n of N) { n.fill.snap(state[n.id] === 'learned' ? 1 : 0); n.ring.snap(state[n.id] === 'ahead' ? 0 : 1); }
  }
  reset_state();
  // dependents make a star brighter (its magnitude)
  for (const n of N) n.deps = N.filter((m) => m.pre.includes(n.id)).length;
  const next_id = () => ORDER.find((id) => state[id] === 'ahead' && by[id].pre.every((p) => state[p] === 'learned'));

  // world coordinates: x along depth, y along lane; a phone turns the chart so depth runs down
  let narrow = false;
  const world = (n) => narrow ? [n.lane * 178, n.d * 112] : [n.d * 150, n.lane * 230];
  const extent = () => { const ps = N.map(world); return [Math.min(...ps.map((p) => p[0])), Math.min(...ps.map((p) => p[1])), Math.max(...ps.map((p) => p[0])), Math.max(...ps.map((p) => p[1]))]; };
  const cam = { c: new Spring2(0, 0, 0.5, 1), s: new Spring(1, 0.45, 1) };
  let fit_s = 1;
  function fit_view(snap) {
    const [x0, y0, x1, y1] = extent(), W = G.W, H = G.H;
    const pad = narrow ? [70, 70, 70, 110] : [110, 90, 150, 90];   // left, top, right, bottom (labels and the verb)
    fit_s = Math.min((W - pad[0] - pad[2]) / (x1 - x0), (H - pad[1] - pad[3]) / (y1 - y0));
    const cx = (x0 + x1) / 2 - (pad[0] - pad[2]) / 2 / fit_s, cy = (y0 + y1) / 2 - (pad[1] - pad[3]) / 2 / fit_s;
    if (snap) { cam.c.a.snap(cx); cam.c.b.snap(cy); cam.s.snap(fit_s); } else { cam.c.to(cx, cy); cam.s.to(fit_s); }
  }
  const scr = ([x, y], c = cam) => [(x - c.c.x) * c.s.x + G.W / 2, (y - c.c.y) * c.s.x + G.H / 2];
  const unscr = (sx, sy) => [(sx - G.W / 2) / cam.s.x + cam.c.x, (sy - G.H / 2) / cam.s.x + cam.c.y];
  const radius = (n) => (narrow ? 4.4 : 5) + Math.min(4, n.deps * 1.2);

  // labels: eight places around each star, taken greedily by rank; a label that fits nowhere is not drawn
  const RANK = { learned: 1, learning: 2, ahead: 3 };
  function place_labels(sx) {
    const g = G.ctx, P = N.map((n) => ({ n, p: sx(n) }));
    const nx = next_id(), vb = verb_box();
    const taken = vb ? [vb] : [];
    const stars = P.map(({ n, p }) => ({ x: p[0] - radius(n) - 2, y: p[1] - radius(n) - 2, w: 2 * radius(n) + 4, h: 2 * radius(n) + 4 }));
    const order = [...P].sort((a, b) => RANK[state[a.n.id]] - RANK[state[b.n.id]] || b.n.deps - a.n.deps);
    const segs = []; for (const n of N) for (const pid of n.pre) segs.push([sx(by[pid]), sx(n)]);
    const crosses = (b) => segs.some(([a, c]) => seg_rect(a, c, b));
    const out = [];
    for (const { n, p } of order) {
      if (n.id === nx) continue;   // the next star's name is on the verb
      g.font = font(n); const w = g.measureText(n.name).width, h = narrow ? 15 : 16, r = radius(n) + 6;
      const cands = [[r, -h / 2], [-r - w, -h / 2], [-w / 2, -r - h], [-w / 2, r], [r * 0.8, -r * 0.8 - h], [-r * 0.8 - w, -r * 0.8 - h], [r * 0.8, r * 0.8], [-r * 0.8 - w, r * 0.8]];
      // first a place no line runs through; failing that, any free place
      let got = null;
      for (const strict of [true, false]) {
        for (const [dx, dy] of cands) {
          const b = { x: p[0] + dx, y: p[1] + dy, w, h };
          if (b.x < 6 || b.y < 6 || b.x + b.w > G.W - 6 || b.y + b.h > G.H - 6) continue;
          if (taken.some((t) => hit(t, b)) || stars.some((s) => hit(s, b)) || (strict && crosses(b))) continue;
          got = b; break;
        }
        if (got) break;
      }
      if (got) { taken.push(got); out.push({ n, b: got }); }
    }
    return out;
  }
  // does segment a–c pass through box b (shrunk a little, so a line grazing a corner is allowed)
  function seg_rect(a, c, b) {
    const x0 = b.x + 2, y0 = b.y + 2, x1 = b.x + b.w - 2, y1 = b.y + b.h - 2;
    let t0 = 0, t1 = 1; const dx = c[0] - a[0], dy = c[1] - a[1];
    for (const [p, q] of [[-dx, a[0] - x0], [dx, x1 - a[0]], [-dy, a[1] - y0], [dy, y1 - a[1]]]) {
      if (Math.abs(p) < 1e-9) { if (q < 0) return false; continue; }
      const r = q / p; if (p < 0) { if (r > t1) return false; if (r > t0) t0 = r; } else { if (r < t0) return false; if (r < t1) t1 = r; }
    }
    return true;
  }
  const hit = (a, b) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
  const font = (n) => `${state[n.id] === 'ahead' ? 400 : 500} ${narrow ? 13 : 14}px ${SANS}`;

  // the verb rides on the next star, in world coordinates, so it travels along the chart
  const vpos = new Spring2(0, 0, 0.6, 0.86);
  let vtarget = null;
  function verb_box() {
    if (!vtarget) return null;
    const [x, y] = scr([vpos.x, vpos.y]), w = verb.offsetWidth, h = verb.offsetHeight, n = by[vtarget], r = radius(n) + 10;
    const cands = narrow ? [[x - w / 2, y + r], [x - w / 2, y - r - h], [x + r, y - h / 2], [x - r - w, y - h / 2]] : [[x + r, y - h / 2], [x - r - w, y - h / 2], [x - w / 2, y + r], [x - w / 2, y - r - h]];
    const free = (b) => N.every((m) => { if (m === n) return true; const [mx, my] = scr(world(m)), rr = radius(m) + 3; return !(mx + rr > b.x && mx - rr < b.x + b.w && my + rr > b.y && my - rr < b.y + b.h); });
    for (const [bx, by_] of cands) { const b = { x: bx, y: by_, w, h }; if (free(b)) return b; }
    return { x: cands[0][0], y: cands[0][1], w, h };
  }
  function set_verb(id, snap) {
    vtarget = id || null; verb.style.display = id ? '' : 'none'; if (!id) return;
    verb.innerHTML = `<b>${VERB[lang]}</b> ${by[id].name}`;
    const [x, y] = world(by[id]); if (snap) { vpos.a.snap(x); vpos.b.snap(y); } else vpos.to(x, y);
  }

  let focus = null;   // a tapped star: its prerequisites stand out
  const ancestors = (id, s = new Set()) => { for (const p of by[id].pre) if (!s.has(p)) { s.add(p); ancestors(p, s); } return s; };

  function draw() {
    const g = G.ctx, W = G.W, H = G.H; g.clearRect(0, 0, W, H);
    g.fillStyle = C.paper; g.fillRect(0, 0, W, H);
    // scaffolding: a faint graticule that moves with the chart, and a ruled frame
    const s = cam.s.x, step = 75 * (s < 0.6 ? 2 : 1);
    g.strokeStyle = 'rgba(141,145,152,.42)'; g.lineWidth = 1;
    const [wx0, wy0] = unscr(0, 0), [wx1, wy1] = unscr(W, H);
    // the graticule as small crosses where its lines would meet: precision without a grid
    g.beginPath();
    for (let x = Math.floor(wx0 / step) * step; x <= wx1; x += step) for (let y = Math.floor(wy0 / step) * step; y <= wy1; y += step) {
      const [px, py] = scr([x, y]), X = Math.round(px) + 0.5, Y = Math.round(py) + 0.5; g.moveTo(X - 3, Y); g.lineTo(X + 3, Y); g.moveTo(X, Y - 3); g.lineTo(X, Y + 3);
    }
    g.stroke();
    g.strokeStyle = 'rgba(141,145,152,.5)'; g.beginPath();
    for (let x = Math.floor(wx0 / (step / 5)) * step / 5; x <= wx1; x += step / 5) { const [sx] = scr([x, 0]), big = Math.abs(x / step - Math.round(x / step)) < 1e-6; g.moveTo(Math.round(sx) + 0.5, 0); g.lineTo(Math.round(sx) + 0.5, big ? 9 : 4); g.moveTo(Math.round(sx) + 0.5, H); g.lineTo(Math.round(sx) + 0.5, H - (big ? 9 : 4)); }
    for (let y = Math.floor(wy0 / (step / 5)) * step / 5; y <= wy1; y += step / 5) { const [, sy] = scr([0, y]), big = Math.abs(y / step - Math.round(y / step)) < 1e-6; g.moveTo(0, Math.round(sy) + 0.5); g.lineTo(big ? 9 : 4, Math.round(sy) + 0.5); g.moveTo(W, Math.round(sy) + 0.5); g.lineTo(W - (big ? 9 : 4), Math.round(sy) + 0.5); }
    g.stroke();
    const sx = (n) => scr(world(n));
    const anc = focus ? ancestors(focus) : null;
    // prerequisite lines: solid between stars you know, dashed into what lies ahead; they stop short of each star
    for (const n of N) for (const pid of n.pre) {
      const m = by[pid], a = sx(m), b = sx(n), dx = b[0] - a[0], dy = b[1] - a[1], L = Math.hypot(dx, dy) || 1;
      const ra = radius(m) + 5, rb = radius(n) + 5; if (L < ra + rb + 4) continue;
      const known = Math.min(m.fill.x, n.ring.x);
      const on = !anc || (anc.has(pid) && (anc.has(n.id) || n.id === focus));
      g.beginPath(); g.moveTo(a[0] + dx / L * ra, a[1] + dy / L * ra); g.lineTo(b[0] - dx / L * rb, b[1] - dy / L * rb);
      g.setLineDash(known > 0.5 ? [] : [3, 4]);
      g.strokeStyle = `rgba(26,27,31,${((known > 0.5 ? 0.42 : 0.26) * (on ? 1 : 0.35) + (anc && on ? 0.25 : 0)).toFixed(3)})`;
      g.lineWidth = known > 0.5 ? 1.2 : 1; g.stroke();
    }
    g.setLineDash([]);
    // stars
    for (const n of N) {
      const [x, y] = sx(n), r = radius(n), f = Math.max(0, Math.min(1, n.fill.x)), ring = Math.max(0, Math.min(1, n.ring.x)), dim = anc && !(anc.has(n.id) || n.id === focus) ? 0.35 : 1;
      g.globalAlpha = dim;
      if (ring < 0.02 && f < 0.02) {
        // ahead: a faint star, and a dashed ring if it is the next one
        g.fillStyle = 'rgba(26,27,31,.42)'; g.beginPath(); g.arc(x, y, 2.6, 0, Math.PI * 2); g.fill();
        if (n.id === vtarget) { g.setLineDash([2.5, 2.5]); g.strokeStyle = n.col; g.lineWidth = 1.6; g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.stroke(); g.setLineDash([]); }
      } else {
        // the ring, then the fill converging inward from the ring (hollow → solid)
        g.strokeStyle = n.col; g.lineWidth = 1.8; g.beginPath(); g.arc(x, y, r * (0.6 + 0.4 * ring), 0, Math.PI * 2); g.stroke();
        if (f > 0.01) { g.fillStyle = n.col; g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.arc(x, y, r * (1 - f), 0, Math.PI * 2, true); g.fill(); }
      }
      g.globalAlpha = 1;
    }
    // labels
    labels = place_labels(sx);
    g.textBaseline = 'top';
    for (const { n, b } of labels) {
      const dim = anc && !(anc.has(n.id) || n.id === focus) ? 0.4 : 1;
      g.globalAlpha = dim; g.font = font(n); g.fillStyle = state[n.id] === 'ahead' ? '#62666d' : C.ink; g.fillText(n.name, b.x, b.y + 1);
    }
    g.globalAlpha = 1;
    // the verb
    const vb = verb_box(); if (vb) verb.style.transform = `translate(${vb.x.toFixed(1)}px, ${vb.y.toFixed(1)}px)`;
    hud.innerHTML = `<b>${N.filter((n) => state[n.id] === 'learned').length}</b> / ${N.length}`;
  }
  let labels = [];

  const sched = scheduler((dt) => {
    let b = cam.c.step(dt); b = cam.s.step(dt) || b; b = vpos.step(dt) || b;
    for (const n of N) { b = n.fill.step(dt) || b; b = n.ring.step(dt) || b; }
    draw(); return b;
  });

  // learn: the star fills from its ring inward, then the verb travels on to the next star
  function learn() {
    const id = vtarget; if (!id) return;
    state[id] = 'learned'; by[id].ring.to(1); setTimeout(() => { by[id].fill.to(1); sched.wake(); }, 120);
    setTimeout(() => { set_verb(next_id()); sched.wake(1200); }, 520);
    sched.wake(1500);
  }
  verb.addEventListener('pointerdown', (e) => e.stopPropagation());
  verb.addEventListener('click', (e) => { e.stopPropagation(); learn(); });

  // pan, zoom (wheel, pinch), tap a star to see what it rests on
  const pts = new Map(); let gest = null, moved = 0, last = null;
  const local = (e) => { const r = wrap.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };
  const clamp_s = (s) => Math.max(fit_s * 0.55, Math.min(fit_s * 3.2, s));
  function zoom_at(px, py, s) {
    s = clamp_s(s); const [wx, wy] = unscr(px, py);
    // keep the world point under the hand fixed
    cam.s.to(s); cam.c.to(wx - (px - G.W / 2) / s, wy - (py - G.H / 2) / s); sched.wake();
  }
  wrap.addEventListener('pointerdown', (e) => {
    wrap.setPointerCapture(e.pointerId); pts.set(e.pointerId, local(e)); moved = 0;
    if (pts.size === 1) { const [x, y] = local(e); gest = { kind: 'pan', x, y, cx: cam.c.x, cy: cam.c.y, t: performance.now() }; last = { x, y, t: performance.now(), vx: 0, vy: 0 }; }
    else if (pts.size === 2) { const [a, b] = [...pts.values()]; gest = { kind: 'pinch', d: Math.hypot(a[0] - b[0], a[1] - b[1]), s: cam.s.target }; }
  });
  wrap.addEventListener('pointermove', (e) => {
    if (!pts.has(e.pointerId)) return; pts.set(e.pointerId, local(e));
    if (gest?.kind === 'pan') {
      const [x, y] = local(e); moved = Math.max(moved, Math.hypot(x - gest.x, y - gest.y));
      const s = cam.s.x, cx = gest.cx - (x - gest.x) / s, cy = gest.cy - (y - gest.y) / s;
      cam.c.a.snap(cx); cam.c.b.snap(cy);
      const t = performance.now(), dtt = Math.max(1, t - last.t); last = { x, y, t, vx: (x - last.x) / dtt, vy: (y - last.y) / dtt };
      sched.wake();
    } else if (gest?.kind === 'pinch' && pts.size === 2) {
      const [a, b] = [...pts.values()]; moved = 99;
      zoom_at((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, gest.s * Math.hypot(a[0] - b[0], a[1] - b[1]) / gest.d);
    }
  });
  const up = (e) => {
    if (!pts.has(e.pointerId)) return;
    const p = pts.get(e.pointerId); pts.delete(e.pointerId);
    if (gest?.kind === 'pan' && pts.size === 0) {
      if (moved < 6) tap(p[0], p[1]);
      // momentum: the chart glides on in the direction it was thrown, the spring keeps the velocity
      else if (performance.now() - last.t < 80) { const s = cam.s.x; cam.c.a.v = -last.vx * 1000 / s; cam.c.b.v = -last.vy * 1000 / s; cam.c.to(cam.c.x - last.vx * 160 / s, cam.c.y - last.vy * 160 / s); }
      rubber();
    }
    if (pts.size === 0) gest = null;
    sched.wake();
  };
  wrap.addEventListener('pointerup', up); wrap.addEventListener('pointercancel', up);
  wrap.addEventListener('wheel', (e) => { e.preventDefault(); const [x, y] = local(e); zoom_at(x, y, cam.s.target * Math.exp(-e.deltaY * 0.0022)); }, { passive: false });
  // the chart cannot be thrown off the paper: past its edge it springs back
  function rubber() {
    const [x0, y0, x1, y1] = extent(), m = 40;
    const cx = Math.max(x0 - m, Math.min(x1 + m, cam.c.a.target)), cy = Math.max(y0 - m, Math.min(y1 + m, cam.c.b.target));
    cam.c.to(cx, cy);
  }
  function tap(x, y) {
    let best = null, bd = narrow ? 26 : 20;
    for (const n of N) { const [sx, sy] = scr(world(n)), d = Math.hypot(sx - x, sy - y); if (d < bd) { bd = d; best = n; } }
    focus = best && focus !== best.id ? best.id : null; sched.wake();
  }

  function layout() { G.fit(); narrow = G.W < 600; wrap.classList.toggle('narrow', narrow); fit_view(true); set_verb(vtarget || next_id(), true); draw(); }
  layout();

  // the tests: the logic of the graph, and labels at many zooms
  function acyclic() {
    const indeg = Object.fromEntries(N.map((n) => [n.id, n.pre.length])), q = N.filter((n) => !n.pre.length).map((n) => n.id); let seen = 0;
    while (q.length) { const id = q.shift(); seen++; for (const m of N) if (m.pre.includes(id) && --indeg[m.id] === 0) q.push(m.id); }
    return seen === N.length;
  }
  const closed = () => N.every((n) => state[n.id] === 'ahead' || n.pre.every((p) => state[p] === 'learned'));
  function overlaps() {
    let bad = 0;
    const sx = (n) => scr(world(n));
    const L = place_labels(sx), vb = verb_box(), boxes = L.map((l) => l.b).concat(vb ? [vb] : []);
    for (let i = 0; i < boxes.length; i++) for (let j = i + 1; j < boxes.length; j++) if (hit(boxes[i], boxes[j])) bad++;
    for (const b of boxes) for (const n of N) { const [x, y] = sx(n), r = radius(n); if (x + r > b.x && x - r < b.x + b.w && y + r > b.y && y - r < b.y + b.h) bad++; }
    return { bad, shown: L.length };
  }
  return {
    visible: (v) => sched.set_visible(v),
    resize: () => { layout(); sched.wake(); },
    demo: () => { focus = null; learn(); },
    learn, focus: (id) => { focus = id; sched.wake(); },
    zoom: (f, px = G.W / 2, py = G.H / 2) => zoom_at(px, py, fit_s * f),
    async accept() {
      const dag = acyclic();
      // learn the rest of the course star by star; the closure must hold after every step
      reset_state(); set_verb(next_id(), true);
      let ok_closure = closed(), steps = 0;
      const saved = { ...state };
      for (let id = next_id(); id; id = next_id()) { state[id] = 'learned'; if (!closed()) ok_closure = false; steps++; }
      Object.assign(state, saved);
      // labels at zooms from far to near, in the course's real state
      const zs = [0.55, 0.8, 1, 1.5, 2.2, 3.2]; let bad = 0, shown = [];
      const c0 = [cam.c.x, cam.c.y, cam.s.x];
      for (const z of zs) { cam.s.snap(fit_s * z); const o = overlaps(); bad += o.bad; shown.push(o.shown); }
      cam.c.a.snap(c0[0]); cam.c.b.snap(c0[1]); cam.s.snap(c0[2]); reset_state(); set_verb(next_id(), true); draw();
      const full = overlaps().shown === N.length - 1;
      const pass = dag && ok_closure && bad === 0 && full;
      return { pass, value: zh ? `无环 ${dag ? '✓' : '✗'}；学会的星先修都已学会 ${ok_closure ? '✓' : '✗'}（${steps} 步）；${zs.length} 种缩放下重叠 ${bad} 处；全图标签 ${shown[2]}/${N.length - 1}` : `acyclic ${dag ? '✓' : '✗'}; learned ⇒ prerequisites learned ${ok_closure ? '✓' : '✗'} (${steps} steps); ${bad} overlaps over ${zs.length} zooms; labels at fit ${shown[2]}/${N.length - 1}` };
    },
  };
}
