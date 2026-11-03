// A network. Nodes are small plaster pucks seen from above, edges are threads; the layout is found by springs and
// repulsion and then it rests, quiet, until you move a node: pull one and the threads pull its neighbours after it, then
// everything settles again. From the source, every node carries its distance in hops (the rings of a breadth-first
// search), and the shortest path to the node you tap is drawn in the source’s colour.
// As a building block: network(nodes, edges, { from, to }).
import { scheduler, Spring, C, GR, canvas2d, mulberry } from '../lib/ui.js';
import { text, tint, drags } from '../lib/plot.js';

export const meta = {
  id: 'network',
  name: { zh: '网络', en: 'A network' },
  means: { zh: '节点是从上面看的小石膏块，边是线；位置由弹簧和斥力找到，然后静止，直到你挪动一个节点：拉一个，线就拉着它的邻居跟过来，然后一切再停下。从起点出发，每个节点上写着它离起点几跳（广度优先搜索的一圈圈），点一个节点，到它的最短路径用起点的颜色画出来。', en: 'Nodes are plaster pucks from above, edges are threads; springs and repulsion find the layout, then it rests until you move a node and its neighbours follow. Each node carries its distance in hops from the source (the rings of breadth-first search); tap a node and the shortest path to it is drawn.' },
  test: { zh: '排好后静止（最快的节点每帧 < 0.01 px）；节点之间不重叠；没有一条边穿过别的节点；高亮的路径是真的最短路径，节点上的跳数与广度优先搜索一致', en: 'At rest after settling (fastest node < 0.01 px per frame); no nodes overlap; no edge passes through another node; the highlighted path is a true shortest path and the hop counts match breadth-first search' },
  wide: true,
};

const E = [[0, 1], [0, 2], [1, 3], [2, 3], [1, 4], [3, 5], [4, 5], [4, 6], [5, 7], [6, 7], [6, 8], [7, 9], [8, 9], [2, 10], [10, 11], [11, 5], [8, 12], [9, 13], [12, 13], [3, 11]];
const N = 14, R = 13;
function bfs(src) { const d = new Array(N).fill(Infinity), prev = new Array(N).fill(-1), q = [src]; d[src] = 0; const nb = Array.from({ length: N }, () => []); for (const [a, b] of E) { nb[a].push(b); nb[b].push(a); } while (q.length) { const u = q.shift(); for (const v of nb[u].sort((p, r) => p - r)) if (d[v] === Infinity) { d[v] = d[u] + 1; prev[v] = u; q.push(v); } } return { d, prev }; }

export function make({ stage, canvas, lang }) {
  const zh = lang === 'zh';
  const cv = canvas2d(canvas), g = cv.ctx;
  const r = mulberry(4), pos = [], vel = [];
  for (let i = 0; i < N; i++) { pos.push([0, 0]); vel.push([0, 0]); }
  let target = 13, pinned = -1, lifted = -1, settled = false, heat = 1;   // heat: how strongly the forces act; it cools to nothing, so the layout always comes to rest
  const lift = new Spring(0, 0.25, 0.9);
  const { d: HOPS, prev: PREV } = bfs(0);
  const COLS = Math.max(...HOPS), col_x = (h) => { const { W } = cv, m = 56; return m + (W - 2 * m) * h / COLS; };
  function seed() { const { H } = cv, per = {}; for (let i = 0; i < N; i++) { const h = HOPS[i], k = (per[h] = (per[h] ?? 0) + 1); pos[i] = [col_x(h) + 6 * r(), H * (0.18 + 0.2 * k) + 8 * r()]; vel[i] = [0, 0]; } }
  // one step of the springs: threads pull to a rest length, every pair pushes apart, a node keeps clear of threads it
  // is not on, and the walls of the tile push back
  function step(dt = 1) {
    const { W, H } = cv, L0 = (W - 112) / COLS * 1.05, F = pos.map(() => [0, 0]);
    for (let i = 0; i < N; i++) for (let j = i + 1; j < N; j++) { const d = [pos[j][0] - pos[i][0], pos[j][1] - pos[i][1]], l = Math.max(1, Math.hypot(...d)), f = 2400 / (l * l); F[i][0] -= d[0] / l * f; F[i][1] -= d[1] / l * f; F[j][0] += d[0] / l * f; F[j][1] += d[1] / l * f; }
    for (const [a, b] of E) { const d = [pos[b][0] - pos[a][0], pos[b][1] - pos[a][1]], l = Math.max(1, Math.hypot(...d)), f = 0.06 * (l - L0); F[a][0] += d[0] / l * f; F[a][1] += d[1] / l * f; F[b][0] -= d[0] / l * f; F[b][1] -= d[1] / l * f; }
    for (let i = 0; i < N; i++) for (const [a, b] of E) {
      if (a === i || b === i) continue;
      const p = pos[a], q = pos[b], ab = [q[0] - p[0], q[1] - p[1]], t = Math.max(0, Math.min(1, ((pos[i][0] - p[0]) * ab[0] + (pos[i][1] - p[1]) * ab[1]) / (ab[0] ** 2 + ab[1] ** 2 || 1)));
      const c = [p[0] + ab[0] * t, p[1] + ab[1] * t], d = [pos[i][0] - c[0], pos[i][1] - c[1]], l = Math.max(0.5, Math.hypot(...d));
      if (l < R * 2.6) { const f = 1.2 * (R * 2.6 - l); F[i][0] += d[0] / l * f; F[i][1] += d[1] / l * f; }
    }
    let vmax = 0;
    for (let i = 0; i < N; i++) {
      if (i === pinned) { vel[i] = [0, 0]; continue; }
      const m = 28 + R, wall = (x, lo, hi) => (x < lo ? (lo - x) * 0.5 : x > hi ? (hi - x) * 0.5 : 0);
      F[i][0] += wall(pos[i][0], m, W - m) + 0.05 * (col_x(HOPS[i]) - pos[i][0]); F[i][1] += wall(pos[i][1], m + 10, H - m);   // (the columns are the rings of the search)
      vel[i] = [(vel[i][0] + F[i][0] * dt * heat) * 0.82, (vel[i][1] + F[i][1] * dt * heat) * 0.82];
      const sp = Math.hypot(...vel[i]); if (sp > 12) vel[i] = [vel[i][0] / sp * 12, vel[i][1] / sp * 12];
      pos[i] = [pos[i][0] + vel[i][0] * dt, pos[i][1] + vel[i][1] * dt]; vmax = Math.max(vmax, Math.hypot(...vel[i]));
    }
    if (pinned < 0) heat *= 0.994;
    return vmax;
  }
  function settle(max = 3000) { heat = 1; let v = 1; for (let k = 0; k < max && (v > 0.004 || heat > 0.02); k++) v = step(); settled = true; return v; }
  const path_to = (t) => { const p = []; for (let u = t; u !== -1; u = PREV[u]) p.push(u); return p.reverse(); };

  function draw() {
    const { W, H } = cv, path = path_to(target), on = new Set(); for (let k = 1; k < path.length; k++) on.add(Math.min(path[k], path[k - 1]) + ',' + Math.max(path[k], path[k - 1]));
    g.setTransform(cv.dpr, 0, 0, cv.dpr, 0, 0); g.fillStyle = C.paper; g.fillRect(0, 0, W, H);
    // the threads
    g.lineCap = 'round';
    for (const [a, b] of E) { const k = on.has(Math.min(a, b) + ',' + Math.max(a, b)); g.strokeStyle = k ? C.cobalt : GR(0.42); g.lineWidth = k ? 2.6 : 1.1; g.beginPath(); g.moveTo(pos[a][0], pos[a][1]); g.lineTo(pos[b][0], pos[b][1]); g.stroke(); }
    // the pucks: a soft shadow from the high light, a white face, the hop count
    for (let i = 0; i < N; i++) {
      const [x, y] = pos[i], hi = i === lifted ? lift.x : 0, onp = path.includes(i);
      g.save(); g.shadowColor = GR(0.2 + 0.1 * hi); g.shadowBlur = (6 + 6 * hi) * cv.dpr; g.shadowOffsetX = 1.5 * cv.dpr; g.shadowOffsetY = (2.5 + 2 * hi) * cv.dpr;
      g.beginPath(); g.arc(x, y - 2 * hi, R, 0, Math.PI * 2); g.fillStyle = i === 0 ? tint(C.cobalt, 0.85) : '#fcfbf8'; g.fill(); g.restore();
      g.beginPath(); g.arc(x, y - 2 * hi, R, 0, Math.PI * 2); g.lineWidth = onp ? 2 : 0.8; g.strokeStyle = onp ? C.cobalt : GR(0.25); g.stroke();
      text(g, String(HOPS[i]), x, y - 2 * hi + 4.5, { size: 12.5, weight: 650, tabular: true, align: 'center', color: i === 0 ? '#fff' : onp ? C.cobalt : C.ink2 });
    }
    if (target !== 0) { const [x, y] = pos[target]; g.beginPath(); g.arc(x, y, R + 5, 0, Math.PI * 2); g.strokeStyle = tint(C.cobalt, 0.6); g.lineWidth = 1.2; g.stroke(); }
  }

  let downat = null;
  const hold = drags(canvas, () => pos.map((p, i) => ({
    hit: (x, y) => { const d = Math.hypot(x - p[0], y - p[1]); return d < R + 6 ? d : Infinity; },
    down: (x, y) => { downat = [x, y]; pinned = i; lifted = i; lift.to(1); settled = false; heat = 1; },
    move: (x, y) => { pos[i] = [x, y]; settled = false; sched.wake(); },
    up: () => { const moved = downat && Math.hypot(pos[i][0] - downat[0], pos[i][1] - downat[1]) > 4; pinned = -1; lift.to(0); if (!moved && i !== 0) target = i; settled = false; heat = 1; sched.wake(); },
  })), { change: () => sched.wake() });
  const sched = scheduler(() => { let v = 0; if (!settled) { for (let k = 0; k < 3; k++) v = step(); if (v < 0.004 && heat < 0.02 && pinned < 0) settled = true; } const busy = lift.step(1 / 60); draw(); return busy || !settled || !!hold.active; });
  const resize = () => { cv.fit(); seed(); settle(); draw(); };
  resize();

  return {
    visible: (v) => sched.set_visible(v), resize,
    async accept() {
      seed(); settle(4000); const vnow = step(); settled = true;
      let overlap = 0, through = 0;
      for (let i = 0; i < N; i++) for (let j = i + 1; j < N; j++) if (Math.hypot(pos[i][0] - pos[j][0], pos[i][1] - pos[j][1]) < 2 * R + 6) overlap++;
      for (let i = 0; i < N; i++) for (const [a, b] of E) {
        if (a === i || b === i) continue;
        const p = pos[a], q = pos[b], ab = [q[0] - p[0], q[1] - p[1]], t = Math.max(0, Math.min(1, ((pos[i][0] - p[0]) * ab[0] + (pos[i][1] - p[1]) * ab[1]) / (ab[0] ** 2 + ab[1] ** 2)));
        if (Math.hypot(pos[i][0] - p[0] - ab[0] * t, pos[i][1] - p[1] - ab[1] * t) < R + 2) through++;
      }
      // the path: consecutive nodes joined by edges, as long as the BFS distance, for every target
      let bad = 0; const has = (a, b) => E.some(([p, q]) => (p === a && q === b) || (p === b && q === a));
      for (let t = 1; t < N; t++) { const p = path_to(t); if (p[0] !== 0 || p.length - 1 !== HOPS[t] || p.some((u, k) => k > 0 && !has(p[k - 1], u))) bad++; }
      // the hop counts against a slow, plain count (Bellman–Ford with unit weights)
      const d = new Array(N).fill(Infinity); d[0] = 0; for (let k = 0; k < N; k++) for (const [a, b] of E) { d[b] = Math.min(d[b], d[a] + 1); d[a] = Math.min(d[a], d[b] + 1); }
      const hops_ok = d.every((v, i) => v === HOPS[i]);
      sched.wake();
      const pass = vnow < 0.01 && overlap === 0 && through === 0 && bad === 0 && hops_ok;
      return { pass, value: zh ? `排好后最快 ${vnow.toFixed(4)} px/帧；重叠 ${overlap}；边穿过节点 ${through}；最短路径错 ${bad}；跳数 ${hops_ok ? '✓' : '✗'}` : `at rest: fastest ${vnow.toFixed(4)} px per frame; ${overlap} overlaps; ${through} edges through nodes; ${bad} wrong paths; hop counts ${hops_ok ? '✓' : '✗'}` };
    },
  };
}
