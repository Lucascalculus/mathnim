// A tree. The expression (x + 1)(x − 2) − 4x / (x + 1) as the tree a computer reads: each operator waits for its
// children, so the value under every node is computed from the values under its children, and the whole formula’s value
// arrives at the root. The layout is tidy: a parent sits centred over its children, nothing overlaps, and the two
// copies of (x + 1) are drawn exactly alike. Tap an operator to fold its branch away (the folded node becomes a small
// stack); slide x and the values climb the tree again; at x = −1 the division has no value and that gap climbs too.
// As a building block: tree(root, { values, fold }).
import { scheduler, Spring, Spring2, C, GR, canvas2d } from '../lib/ui.js';
import { num, text, sym, glass_bead, drags, TICK } from '../lib/plot.js';

export const meta = {
  id: 'tree',
  name: { zh: '树', en: 'A tree' },
  means: { zh: '把 (x + 1)(x − 2) − 4x / (x + 1) 画成计算机读它时的那棵树：每个运算等它的孩子算完，所以每个节点下面的值由孩子的值算出来，整条式子的值最后到达树根。排版整齐：父节点在孩子正中间，互不重叠，两个 (x + 1) 画得一模一样。点一个运算可以把它的枝折起来；拖 x，值重新往上爬；x = −1 时除法没有值，这个空缺也往上爬。', en: 'The expression as the tree a computer reads: each operator waits for its children, so every node’s value comes from its children’s and the whole value arrives at the root. Tidy: parents centred, nothing overlapping, the two copies of (x + 1) drawn alike. Tap an operator to fold it; slide x and the values climb again; at x = −1 the gap climbs too.' },
  test: { zh: '同一层的节点互不重叠；每个父节点恰好在第一个和最后一个孩子正中间；两个 (x + 1) 的形状完全相同；21 个 x 下树根的值与直接代入公式一致（x = −1 时两者都没有值）', en: 'Nodes on a level never overlap; every parent sits exactly midway between its first and last child; the two (x + 1) are the same shape; at 21 values of x the root equals the formula (and at x = −1 neither has a value)' },
  wide: true,
  aspect: '16 / 8.5',
};

const T = (op, ...c) => ({ op, c }), X = () => ({ leaf: 'x' }), K = (v) => ({ leaf: String(v), v });
const ROOT = T('−', T('×', T('+', X(), K(1)), T('−', X(), K(2))), T('÷', T('×', K(4), X()), T('+', X(), K(1))));
const formula = (x) => (x + 1) * (x - 2) - (4 * x) / (x + 1);
const OPS = { '+': (a, b) => a + b, '−': (a, b) => a - b, '×': (a, b) => a * b, '÷': (a, b) => (b === 0 ? NaN : a / b) };
const value = (n, x) => (n.leaf ? (n.leaf === 'x' ? x : n.v) : OPS[n.op](value(n.c[0], x), value(n.c[1], x)));
const all = []; (function walk(n, d, parent) { n.d = d; n.parent = parent; n.id = all.length; all.push(n); (n.c || []).forEach((c) => walk(c, d + 1, n)); })(ROOT, 0, null);

// tidy layout (Reingold–Tilford): place each child's subtree as close as its contours allow, the parent centred above
function layout(n, fold) {
  if (n.leaf || fold.has(n.id)) { n.rx = 0; return { L: [0], R: [0] }; }
  const subs = n.c.map((c) => layout(c, fold)), offs = [0];
  let L = subs[0].L.slice(), R = subs[0].R.slice();
  for (let k = 1; k < subs.length; k++) {
    const s = subs[k]; let off = -Infinity;
    for (let d = 0; d < Math.min(R.length, s.L.length); d++) off = Math.max(off, R[d] - s.L[d] + 1);
    offs.push(off);
    for (let d = 0; d < s.L.length; d++) { if (d < R.length) R[d] = s.R[d] + off; else { L.push(s.L[d] + off); R.push(s.R[d] + off); } }
  }
  const mid = (offs[0] + offs[offs.length - 1]) / 2;
  n.c.forEach((c, k) => (c.rx = offs[k] - mid));
  return { L: [0, ...L.map((v) => v - mid)], R: [0, ...R.map((v) => v - mid)] };
}
// absolute positions in units: x from the relative offsets, y = depth
function place(fold) {
  layout(ROOT, fold); const out = new Map();
  (function go(n, x) { out.set(n.id, [x, n.d]); if (!n.leaf && !fold.has(n.id)) n.c.forEach((c) => go(c, x + c.rx)); })(ROOT, 0);
  return out;
}

export function make({ stage, canvas, lang }) {
  const zh = lang === 'zh';
  const cv = canvas2d(canvas), g = cv.ctx;
  const S = { x: 1.5, fold: new Set() };
  const spr = all.map(() => new Spring2(0, 0, 0.5, 0.9)), shown = all.map(() => new Spring(1, 0.4, 1)), lift = new Spring(0);
  const RN = 17;
  const frame = (P) => { const xs = [...P.values()].map((p) => p[0]), x0 = Math.min(...xs), x1 = Math.max(...xs), { W, H } = cv, u = Math.min(78, (W - 120) / Math.max(1, x1 - x0)); const dy = Math.min(130, (H - 150) / 3); return { u, ox: W / 2 - u * (x0 + x1) / 2, oy: 80 + (H - 110 - 3 * dy) / 2, dy }; };
  const R = () => ({ x0: cv.W - 300, x1: cv.W - 40, y: 34 });
  function retarget(snap) {
    const P = place(S.fold), F = frame(P);
    for (const n of all) {
      let a = n.parent, vis = true; while (a) { if (S.fold.has(a.id)) vis = false; a = a.parent; }
      const p = P.get(n.id) || P.get(nearest_shown(n).id), q = [F.ox + p[0] * F.u, F.oy + p[1] * F.dy];
      if (snap) spr[n.id].a.snap(q[0]), spr[n.id].b.snap(q[1]); else spr[n.id].to(q[0], q[1]);
      if (snap) shown[n.id].snap(vis ? 1 : 0); else shown[n.id].to(vis ? 1 : 0);
    }
  }
  // a hidden node folds into its topmost folded ancestor (the one still on show)
  function nearest_shown(n) { let res = n; for (let a = n.parent; a; a = a.parent) if (S.fold.has(a.id)) res = a; return res; }

  function draw() {
    const { W, H } = cv;
    g.setTransform(cv.dpr, 0, 0, cv.dpr, 0, 0); g.fillStyle = C.paper; g.fillRect(0, 0, W, H);
    // the branches
    for (const n of all) if (n.parent) { const a = spr[n.parent.id], b = spr[n.id], k = shown[n.id].x; if (k < 0.02) continue; g.strokeStyle = GR(0.45 * k); g.lineWidth = 1.1; g.beginPath(); g.moveTo(a.x, a.y + RN); g.lineTo(b.x, b.y - RN); g.stroke(); }
    // the nodes, and the value that has climbed to each
    for (const n of all) {
      const k = shown[n.id].x; if (k < 0.02) continue;
      const { x, y } = spr[n.id], v = value(n, S.x), folded = S.fold.has(n.id);
      g.save(); g.globalAlpha = k;
      if (folded) for (const o of [6, 3]) { g.beginPath(); g.arc(x + o, y + o, RN, 0, Math.PI * 2); g.fillStyle = '#f4f2ed'; g.fill(); g.strokeStyle = GR(0.25); g.lineWidth = 0.8; g.stroke(); }
      g.shadowColor = GR(0.16); g.shadowBlur = 6 * cv.dpr; g.shadowOffsetY = 2 * cv.dpr;
      g.beginPath(); g.arc(x, y, RN, 0, Math.PI * 2); g.fillStyle = '#fcfbf8'; g.fill(); g.shadowColor = 'transparent';
      g.strokeStyle = n.leaf ? GR(0.25) : GR(0.4); g.lineWidth = 0.9; g.stroke();
      if (n.leaf) sym(g, n.leaf, x, y + 6, { size: n.leaf === 'x' ? 19 : 17, align: 'center', color: n.leaf === 'x' ? C.cobalt : C.ink, italic: n.leaf === 'x', font: n.leaf === 'x' ? 'serif' : 'sans' });
      else text(g, n.op, x, y + 6.5, { size: 19, align: 'center', color: C.ink, font: 'serif' });
      if (!n.leaf || n.leaf === 'x') text(g, Number.isFinite(v) ? num(v, Math.abs(v) < 100 ? 2 : 0) : '—', x + RN + 5, y + RN + 6, { size: 11.5, weight: 650, color: C.teal, tabular: true, halo: 3 });
      g.restore();
    }
    // x on its ruler
    const r = R(), X = (v) => r.x0 + (r.x1 - r.x0) * (v + 3) / 6;
    g.strokeStyle = GR(0.55); g.lineWidth = 1; g.beginPath(); g.moveTo(r.x0, r.y); g.lineTo(r.x1, r.y); g.stroke();
    for (let v = -3; v <= 3; v++) { g.beginPath(); g.moveTo(X(v), r.y); g.lineTo(X(v), r.y + 5); g.stroke(); text(g, num(v, 0), X(v), r.y + 18, { size: 11, color: TICK, align: 'center', tabular: true }); }
    glass_bead(g, X(S.x), r.y, 10, lift.x, { dir: 0, core: C.cobalt });
    sym(g, 'x', r.x0 - 58, r.y + 5, { size: 18, color: C.cobalt }); text(g, '= ' + num(S.x, 1), r.x0 - 46, r.y + 5, { size: 13, weight: 600, tabular: true });
  }

  const hold = drags(canvas, () => {
    const r = R(), X = (v) => r.x0 + (r.x1 - r.x0) * (v + 3) / 6, items = [];
    items.push({ hit: (x, y) => { const d = Math.hypot(x - X(S.x), y - r.y); return d < 22 ? d : Math.abs(y - r.y) < 12 && x > r.x0 && x < r.x1 ? 40 : Infinity; }, down() { lift.to(1); }, up() { lift.to(0); },
      move: (x) => { S.x = Math.round(Math.max(-3, Math.min(3, (x - r.x0) / (r.x1 - r.x0) * 6 - 3)) * 10) / 10; } });
    for (const n of all) if (!n.leaf && n !== ROOT && shown[n.id].x > 0.5) items.push({ hit: (x, y) => { const d = Math.hypot(x - spr[n.id].x, y - spr[n.id].y); return d < RN + 4 ? d : Infinity; }, down: () => { if (S.fold.has(n.id)) S.fold.delete(n.id); else S.fold.add(n.id); retarget(false); } });
    return items;
  }, { change: () => sched.wake() });
  const sched = scheduler((dt) => { const busy = [...spr.map((s) => s.step(dt)), ...shown.map((s) => s.step(dt)), lift.step(dt)].some(Boolean); draw(); return busy || !!hold.active; });
  const resize = () => { cv.fit(); retarget(true); draw(); };
  resize();

  return {
    visible: (v) => sched.set_visible(v), resize,
    async accept() {
      const P = place(new Set()), F = frame(P), px = (id) => [F.ox + P.get(id)[0] * F.u, F.oy + P.get(id)[1] * F.dy];
      let overlap = 0, centre = 0;
      for (const a of all) for (const b of all) if (a.id < b.id && a.d === b.d && Math.abs(px(a.id)[0] - px(b.id)[0]) < 2 * RN + 6) overlap++;
      for (const n of all) if (n.c) centre = Math.max(centre, Math.abs(P.get(n.id)[0] - (P.get(n.c[0].id)[0] + P.get(n.c[n.c.length - 1].id)[0]) / 2));
      // the two (x + 1): the same shape, relative to their own roots
      const plus = all.filter((n) => n.op === '+'), shape = (n) => [n, ...n.c].map((m) => [P.get(m.id)[0] - P.get(n.id)[0], P.get(m.id)[1] - P.get(n.id)[1]]);
      const s0 = shape(plus[0]), s1 = shape(plus[1]), same = s0.every((p, i) => Math.abs(p[0] - s1[i][0]) < 1e-12 && Math.abs(p[1] - s1[i][1]) < 1e-12);
      let wrong = 0; for (let i = 0; i <= 20; i++) { const x = -3 + 0.3 * i, a = value(ROOT, x), b = formula(x); if (Number.isFinite(b) ? Math.abs(a - b) > 1e-12 : Number.isFinite(a)) wrong++; }
      const pass = overlap === 0 && centre < 1e-12 && same && wrong === 0;
      return { pass, value: zh ? `同层重叠 ${overlap}；父节点偏离中间 ${centre.toExponential(1)}；两个 (x + 1) 形状相同 ${same ? '✓' : '✗'}；21 个 x 中树根算错 ${wrong} 个` : `${overlap} overlaps on a level; parents off centre by ${centre.toExponential(1)}; the two (x + 1) alike ${same ? '✓' : '✗'}; root wrong at ${wrong} of 21 x` };
    },
  };
}
