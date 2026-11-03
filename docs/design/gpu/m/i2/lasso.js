// Lasso to ask. Draw a loop around anything on the page: part of the figure, a phrase, one term of a formula. When
// you let go, the rough stroke converges into a clean outline that hugs exactly what you caught (it snaps to the
// elements whose centres fell inside your loop), and a question chip offers what to ask about it. Ask, and the chip
// folds into a small numbered mark that stays on the page where you asked.
// As a library primitive: lasso(scene) works on any page whose words, terms and figure parts are elements.
import { scheduler } from '../../lib/gl.js';
import { Spring } from '../../lib/ui.js';
import { css, canvas2d, box_in, in_poly, winding, resample, poly_area, lesson_dom, PAGE_CSS, C, SANS } from './_nav.js';

export const meta = {
  id: 'lasso',
  name: { zh: '圈起来问', en: 'Lasso to ask' },
  means: { zh: '在页面上随手圈住任何东西（图的一部分、一句话、公式里的一项）：粗糙的笔迹收拢成一条贴合所圈之物的干净轮廓，旁边浮出一个可以问的问题。', en: 'Loop anything on the page (part of a figure, a phrase, one term of a formula): the rough stroke converges into a clean outline hugging what you caught, and a chip offers the question to ask.' },
  test: { zh: '选中的恰好是中心落在笔迹圈内的元素（点在多边形内，两种算法互证）；轮廓包住它们，且不包住任何未选中元素的中心', en: 'The selection is exactly the elements whose centres lie inside the drawn loop (point in polygon, two methods agree); the outline encloses them and no unselected centre' },
};

const Q = {
  zh: { term: (a) => `「${a}」在这里是什么意思？`, part: (a) => `${a}在这里起什么作用？`, pair: (a, b) => `${a}和${b}是什么关系？`, phrase: (a) => `「${a}」是什么意思？`, ask: '问' },
  en: { term: (a) => `What does ${a} mean here?`, part: (a) => `What does the ${a} do here?`, pair: (a, b) => `How are ${a} and ${b} related?`, phrase: (a) => `What does “${a}” mean?`, ask: 'Ask' },
};

const CSS = PAGE_CSS + `
.la-wrap{position:absolute;inset:0;background:${C.paper};overflow:hidden;touch-action:none;user-select:none;-webkit-user-select:none;cursor:crosshair}
.la-ink{position:absolute;inset:0;width:100%;height:100%;pointer-events:none}
.la-chip{position:absolute;left:0;top:0;display:flex;align-items:center;gap:10px;padding:4px 4px 4px 16px;border-radius:24px;background:#fff;
  box-shadow:0 0 0 .75px rgba(26,27,31,.12),0 8px 24px rgba(26,27,31,.12),0 1px 2px rgba(26,27,31,.08);font:500 15px ${SANS};color:${C.ink};white-space:nowrap;
  transform-origin:0 0;will-change:transform,opacity;cursor:default}
.la-chip button{height:36px;min-width:36px;padding:0 14px;border-radius:18px;border:0;background:${C.vermilion};color:#fff;font:600 14px ${SANS};cursor:pointer}
.la-wrap.narrow .la-chip{font-size:14px;padding-left:14px;white-space:normal;max-width:calc(100% - 32px)}
.la-wrap.narrow .la-chip button{height:44px;min-width:52px;border-radius:22px}
.la-mark{position:absolute;left:0;top:0;width:22px;height:22px;margin:-11px 0 0 -11px;border-radius:11px;background:${C.ink};color:#fff;font:600 11px/22px ${SANS};text-align:center;
  font-variant-numeric:tabular-nums;transform:scale(0);transition:transform .35s cubic-bezier(.3,1.5,.5,1)}
.la-mark.on{transform:scale(1)}
`;

const CELL = 3, PAD = 5, BRIDGE = 13;

export function make({ stage, canvas, hud, lang }) {
  canvas.style.display = 'none';
  css('la-css', CSS);
  const T = Q[lang], zh = lang === 'zh';
  const wrap = document.createElement('div'); wrap.className = 'la-wrap'; stage.append(wrap);
  const page = lesson_dom(wrap, lang);
  const ink = document.createElement('canvas'); ink.className = 'la-ink'; wrap.append(ink);
  const G = canvas2d(ink);
  const chip = document.createElement('div'); chip.className = 'la-chip'; chip.style.opacity = '0'; chip.style.pointerEvents = 'none';
  chip.innerHTML = `<span class="q"></span><button>${T.ask}</button>`; wrap.append(chip);
  const marks = [];

  let narrow = false;
  function layout() {
    const W = wrap.clientWidth, H = wrap.clientHeight; narrow = W < 600;
    wrap.classList.toggle('narrow', narrow); page.el.classList.toggle('small', narrow);
    const pw = narrow ? W - 32 : Math.min(600, W - 96);
    page.el.style.width = pw + 'px'; page.el.style.left = ((W - pw) / 2) + 'px';
    page.el.style.top = Math.max(narrow ? 28 : 24, (H - page.el.offsetHeight) / 2 - (narrow ? 40 : 10)) + 'px';
    G.fit();
  }

  // ——— what each selectable element is, as a shape: boxes for words and terms, the real geometry for figure parts ———
  function shape(s) {
    const wr = wrap.getBoundingClientRect();
    if (s.kind !== 'part') { const b = box_in(s.el, wrap); return { c: [b.cx, b.cy], rects: [b], discs: [], polys: [] }; }
    const rects = [], discs = [], polys = [];
    for (const e of s.el.querySelectorAll('*')) {
      const m = e.getScreenCTM?.(); if (!m) continue;
      const pt = (x, y) => [m.a * x + m.c * y + m.e - wr.left, m.b * x + m.d * y + m.f - wr.top];
      if (e.tagName === 'text') { const b = box_in(e, wrap); rects.push(b); continue; }
      if (e.tagName === 'line') {
        const a = pt(+e.getAttribute('x1'), +e.getAttribute('y1')), b = pt(+e.getAttribute('x2'), +e.getAttribute('y2')), r = (+e.getAttribute('stroke-width') || 1) * Math.hypot(m.a, m.b) / 2;
        const n = Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / 3);
        for (let i = 0; i <= n; i++) discs.push([a[0] + (b[0] - a[0]) * i / n, a[1] + (b[1] - a[1]) * i / n, r]);
        continue;
      }
      if (e.getTotalLength) { const L = e.getTotalLength(), n = 48, p = []; for (let i = 0; i < n; i++) { const q = e.getPointAtLength(L * i / n); p.push(pt(q.x, q.y)); } polys.push(p); }
    }
    const b = box_in(s.el, wrap);
    // the centre of a part is the centre of its drawn marks (for the wall, the middle of the wall itself)
    const ds = discs.length ? discs : null;
    const c = ds ? [ds.reduce((a, d) => a + d[0], 0) / ds.length, ds.reduce((a, d) => a + d[1], 0) / ds.length] : [b.cx, b.cy];
    return { c, rects, discs, polys };
  }

  // ——— the outline: the union of what was caught, closed across small gaps, traced and rounded ———
  function outline(shapes) {
    if (!shapes.length) return [];
    let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
    const grow = (x, y, r) => { x0 = Math.min(x0, x - r); y0 = Math.min(y0, y - r); x1 = Math.max(x1, x + r); y1 = Math.max(y1, y + r); };
    for (const s of shapes) { for (const b of s.rects) { grow(b.x, b.y, 0); grow(b.x + b.w, b.y + b.h, 0); } for (const d of s.discs) grow(d[0], d[1], d[2]); for (const p of s.polys) for (const q of p) grow(q[0], q[1], 0); }
    const M = PAD + BRIDGE + 2 * CELL; x0 -= M; y0 -= M; x1 += M; y1 += M;
    const nx = Math.ceil((x1 - x0) / CELL), ny = Math.ceil((y1 - y0) / CELL), grid = new Uint8Array(nx * ny);
    const fill = (fn, bx0, by0, bx1, by1) => {
      const i0 = Math.max(0, Math.floor((bx0 - x0) / CELL)), i1 = Math.min(nx - 1, Math.ceil((bx1 - x0) / CELL)), j0 = Math.max(0, Math.floor((by0 - y0) / CELL)), j1 = Math.min(ny - 1, Math.ceil((by1 - y0) / CELL));
      for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) { const x = x0 + (i + 0.5) * CELL, y = y0 + (j + 0.5) * CELL; if (fn(x, y)) grid[j * nx + i] = 1; }
    };
    for (const s of shapes) {
      // words sit shoulder to shoulder, so their outline keeps close at the sides
      const px = s.s.kind === 'part' ? PAD : 3;
      for (const b of s.rects) fill(() => true, b.x - px, b.y - PAD, b.x + b.w + px, b.y + b.h + PAD);
      for (const [cx, cy, r] of s.discs) fill((x, y) => Math.hypot(x - cx, y - cy) <= r + PAD, cx - r - PAD, cy - r - PAD, cx + r + PAD, cy + r + PAD);
      for (const p of s.polys) { const xs = p.map((q) => q[0]), ys = p.map((q) => q[1]); fill((x, y) => in_poly(p, x, y) || p.some((q) => Math.hypot(x - q[0], y - q[1]) <= PAD), Math.min(...xs) - PAD, Math.min(...ys) - PAD, Math.max(...xs) + PAD, Math.max(...ys) + PAD); }
    }
    // closing: grow by BRIDGE, then shrink by BRIDGE (bridges gaps between neighbouring words, keeps the hug)
    const dist = (src, val) => {
      const d = new Float32Array(nx * ny); for (let k = 0; k < d.length; k++) d[k] = src[k] === val ? 0 : 1e9;
      const a = 1, b = Math.SQRT2;
      for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) { const k = j * nx + i; let v = d[k]; if (i) v = Math.min(v, d[k - 1] + a); if (j) { v = Math.min(v, d[k - nx] + a); if (i) v = Math.min(v, d[k - nx - 1] + b); if (i < nx - 1) v = Math.min(v, d[k - nx + 1] + b); } d[k] = v; }
      for (let j = ny - 1; j >= 0; j--) for (let i = nx - 1; i >= 0; i--) { const k = j * nx + i; let v = d[k]; if (i < nx - 1) v = Math.min(v, d[k + 1] + a); if (j < ny - 1) { v = Math.min(v, d[k + nx] + a); if (i < nx - 1) v = Math.min(v, d[k + nx + 1] + b); if (i) v = Math.min(v, d[k + nx - 1] + b); } d[k] = v; }
      return d;
    };
    const R = BRIDGE / CELL, d1 = dist(grid, 1), dil = new Uint8Array(nx * ny); for (let k = 0; k < dil.length; k++) dil[k] = d1[k] <= R ? 1 : 0;
    const d2 = dist(dil, 0), clo = new Uint8Array(nx * ny); for (let k = 0; k < clo.length; k++) clo[k] = d2[k] > R ? 1 : 0;
    for (let k = 0; k < clo.length; k++) if (grid[k]) clo[k] = 1;
    // trace: every edge between an inside and an outside cell, clockwise, linked into loops
    const at = (i, j) => i >= 0 && j >= 0 && i < nx && j < ny && clo[j * nx + i];
    const next = new Map(), key = (i, j) => j * (nx + 1) + i;
    for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) if (at(i, j)) {
      if (!at(i, j - 1)) next.set(key(i, j), [i + 1, j]);
      if (!at(i + 1, j)) next.set(key(i + 1, j), [i + 1, j + 1]);
      if (!at(i, j + 1)) next.set(key(i + 1, j + 1), [i, j + 1]);
      if (!at(i - 1, j)) next.set(key(i, j + 1), [i, j]);
    }
    const loops = [];
    while (next.size) {
      const [k0] = next.keys(); let k = k0; const p = [];
      for (let guard = 0; guard < 1e5; guard++) { const n = next.get(k); if (!n) break; next.delete(k); p.push([x0 + (k % (nx + 1)) * CELL, y0 + Math.floor(k / (nx + 1)) * CELL]); k = key(n[0], n[1]); if (k === k0) break; }
      if (p.length > 8) loops.push(p);
    }
    // keep outer boundaries (holes inside a selection are not drawn), drop collinear points, round the corners
    return loops.filter((p) => poly_area(p) > 0).map((p) => fillet(dp_closed(simplify(p), 3.4), 6));
  }
  const simplify = (p) => p.filter((q, i) => { const a = p[(i - 1 + p.length) % p.length], b = p[(i + 1) % p.length]; return Math.abs((q[0] - a[0]) * (b[1] - a[1]) - (q[1] - a[1]) * (b[0] - a[0])) > 1e-6; });
  // Douglas–Peucker on a closed loop: the grid's staircases become straight edges
  function dp(p, eps) {
    if (p.length < 3) return p;
    const a = p[0], b = p[p.length - 1]; let im = 0, dm = 0;
    const L = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
    for (let i = 1; i < p.length - 1; i++) { const d = Math.abs((b[0] - a[0]) * (a[1] - p[i][1]) - (a[0] - p[i][0]) * (b[1] - a[1])) / L; if (d > dm) { dm = d; im = i; } }
    if (dm <= eps) return [a, b];
    return dp(p.slice(0, im + 1), eps).slice(0, -1).concat(dp(p.slice(im), eps));
  }
  function dp_closed(p, eps) {
    // split at the point farthest from the first, simplify both halves
    let far = 0, fd = 0; for (let i = 0; i < p.length; i++) { const d = Math.hypot(p[i][0] - p[0][0], p[i][1] - p[0][1]); if (d > fd) { fd = d; far = i; } }
    const A = dp(p.slice(0, far + 1), eps), B = dp(p.slice(far).concat([p[0]]), eps);
    return A.slice(0, -1).concat(B.slice(0, -1));
  }
  // round every corner with a small fixed radius (a corner never moves inward by more than 0.35 r)
  function fillet(p, r0) {
    const o = [];
    for (let i = 0; i < p.length; i++) {
      const a = p[(i - 1 + p.length) % p.length], c = p[i], b = p[(i + 1) % p.length];
      const la = Math.hypot(a[0] - c[0], a[1] - c[1]), lb = Math.hypot(b[0] - c[0], b[1] - c[1]), r = Math.min(r0, la * 0.45, lb * 0.45);
      const u = [c[0] + (a[0] - c[0]) / la * r, c[1] + (a[1] - c[1]) / la * r], v = [c[0] + (b[0] - c[0]) / lb * r, c[1] + (b[1] - c[1]) / lb * r];
      for (let k = 0; k <= 4; k++) { const t = k / 4, s = 1 - t; o.push([s * s * u[0] + 2 * s * t * c[0] + t * t * v[0], s * s * u[1] + 2 * s * t * c[1] + t * t * v[1]]); }
    }
    return o;
  }
  const chaikin = (p) => { const o = []; for (let i = 0; i < p.length; i++) { const a = p[i], b = p[(i + 1) % p.length]; o.push([a[0] * 0.75 + b[0] * 0.25, a[1] * 0.75 + b[1] * 0.25], [a[0] * 0.25 + b[0] * 0.75, a[1] * 0.25 + b[1] * 0.75]); } return o; };

  // ——— state: the stroke while drawing; after release, the morph from stroke to outline ———
  const S = { stroke: [], drawing: false, sel: [], outs: [], from: null, to: null, k: new Spring(0, 0.5, 0.74), chip: new Spring(0, 0.38, 0.8), fade: new Spring(1, 0.5, 1), asked: false };
  const N = 180;
  function select(loop) {
    const shapes = page.sels.map((s) => ({ s, ...shape(s) }));
    const sel = shapes.filter((x) => in_poly(loop, x.c[0], x.c[1]));
    return { shapes, sel };
  }
  function release(loop) {
    const { shapes, sel } = select(loop);
    S.sel = sel; S.shapes = shapes;
    if (!sel.length) { S.outs = []; S.from = resample(loop, N); S.to = null; S.k.snap(0); S.fade.snap(1).to(0); S.chip.to(0); chip.style.pointerEvents = 'none'; sched.wake(); return; }
    S.outs = outline(sel);
    const main = S.outs.reduce((a, b) => (Math.abs(poly_area(b)) > Math.abs(poly_area(a)) ? b : a));
    let from = resample(loop, N), to = resample(main, N);
    if (Math.sign(poly_area(from)) !== Math.sign(poly_area(to))) from = from.reverse();
    // start the morph where the two curves are closest, so the stroke does not twist as it converges
    let best = 0, bd = Infinity;
    for (let sft = 0; sft < N; sft += 2) { let d = 0; for (let i = 0; i < N; i += 3) { const a = from[i], b = to[(i + sft) % N]; d += (a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2; } if (d < bd) { bd = d; best = sft; } }
    S.from = from; S.to = to.map((_, i) => to[(i + best) % N]); S.main = main;
    S.k.snap(0).to(1); S.fade.snap(1); S.asked = false;
    set_chip(); sched.wake(2000);
  }
  function question() {
    const terms = S.sel.filter((x) => x.s.kind === 'term'), parts = S.sel.filter((x) => x.s.kind === 'part'), words = S.sel.filter((x) => x.s.kind === 'word');
    const nouns = [...parts.map((x) => x.s.name), ...terms.map((x) => x.s.name)];
    if (words.length) {
      const named = words.filter((w) => /cobalt|ochre/.test(w.s.el.className) || w.s.name === 'λ');
      if (!terms.length && !parts.length && words.length <= 2 && named.length === words.length) return T.part(named[0].s.name);
      if (named.length && (terms.length || parts.length)) return T.pair(named[0].s.name, nouns[0]);
      const txt = words.map((w) => w.s.el.textContent).join(zh ? '' : ' ').replace(/[，。：,.:；]+$/, '');
      const short = [...txt].length > (zh ? 14 : 32) ? [...txt].slice(0, zh ? 13 : 30).join('') + '…' : txt;
      return T.phrase(short);
    }
    if (terms.length === 1 && !parts.length) return T.term(terms[0].s.name);
    if (nouns.length >= 2) return T.pair(nouns[0], nouns[1]);
    if (parts.length === 1) return T.part(parts[0].s.name);
    return T.term(terms.map((x) => x.s.name).join(' '));
  }
  function chip_place() {
    const xs = S.outs.flat().map((p) => p[0]), ys = S.outs.flat().map((p) => p[1]);
    const bx0 = Math.min(...xs), bx1 = Math.max(...xs), by0 = Math.min(...ys), by1 = Math.max(...ys), W = wrap.clientWidth, H = wrap.clientHeight;
    const w = chip.offsetWidth, h = chip.offsetHeight;
    let x = Math.min(W - w - 16, Math.max(16, narrow ? (W - w) / 2 : bx1 - w * 0.25)), y = by1 + 12;
    if (y + h > H - 16) y = by0 - h - 12;
    return [x, y, bx1, by0];
  }
  function set_chip() { chip.querySelector('.q').textContent = question(); chip.style.pointerEvents = 'auto'; S.chip.snap(0).to(1); }
  chip.querySelector('button').addEventListener('click', (e) => {
    e.stopPropagation(); if (S.asked) return; S.asked = true;
    // the question stays on the page as a small numbered mark at the corner of what it is about
    const [, , bx1, by0] = chip_place(), m = document.createElement('div'); m.className = 'la-mark'; m.textContent = String(marks.length + 1).padStart(2, '0');
    m.style.left = bx1 + 'px'; m.style.top = by0 + 'px'; wrap.append(m); marks.push(m); requestAnimationFrame(() => m.classList.add('on'));
    S.chip.to(0); chip.style.pointerEvents = 'none'; S.fade.to(0.35); sched.wake(1200);
  });
  chip.addEventListener('pointerdown', (e) => e.stopPropagation());

  function draw() {
    const g = G.ctx; g.clearRect(0, 0, G.W, G.H);
    g.lineJoin = 'round'; g.lineCap = 'round';
    if (S.drawing && S.stroke.length > 1) {
      g.strokeStyle = 'rgba(26,27,31,.55)'; g.lineWidth = 2.2; g.beginPath(); S.stroke.forEach((p, i) => (i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1]))); g.stroke();
      // where it will close
      const a = S.stroke[S.stroke.length - 1], b = S.stroke[0];
      g.setLineDash([2, 5]); g.strokeStyle = 'rgba(26,27,31,.3)'; g.lineWidth = 1.4; g.beginPath(); g.moveTo(a[0], a[1]); g.lineTo(b[0], b[1]); g.stroke(); g.setLineDash([]);
      return;
    }
    if (!S.from) return;
    const k = S.k.x, f = Math.max(0, S.fade.x);
    if (!S.to) {   // caught nothing: the stroke just fades
      if (f < 0.01) return;
      g.globalAlpha = f; g.strokeStyle = 'rgba(26,27,31,.55)'; g.lineWidth = 2.2; g.beginPath(); S.from.forEach((p, i) => (i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1]))); g.closePath(); g.stroke(); g.globalAlpha = 1; return;
    }
    // the stroke converging: it slims from a hand-drawn line into a fine rule as it settles on the outline
    const kc = Math.max(0, Math.min(1, k));
    g.globalAlpha = f;
    const pts = S.from.map((a, i) => { const b = S.to[i]; return [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k]; });
    const path = (p) => { g.beginPath(); p.forEach((q, i) => (i ? g.lineTo(q[0], q[1]) : g.moveTo(q[0], q[1]))); g.closePath(); };
    // a faint wash inside once it holds
    if (kc > 0.6) { g.fillStyle = `rgba(26,27,31,${(0.035 * (kc - 0.6) / 0.4).toFixed(4)})`; for (const o of S.outs) { path(o); g.fill(); } }
    g.strokeStyle = `rgba(26,27,31,${(0.55 + 0.3 * kc).toFixed(3)})`; g.lineWidth = 2.2 - 0.8 * kc; path(pts); g.stroke();
    // other pieces of the selection grow out of their own centres
    for (const o of S.outs) {
      if (o === S.main) continue;
      const cx = o.reduce((a, p) => a + p[0], 0) / o.length, cy = o.reduce((a, p) => a + p[1], 0) / o.length, s = kc;
      path(o.map((p) => [cx + (p[0] - cx) * s, cy + (p[1] - cy) * s])); g.stroke();
    }
    g.globalAlpha = 1;
  }
  const sched = scheduler((dt) => {
    let b = S.k.step(dt); b = S.chip.step(dt) || b; b = S.fade.step(dt) || b;
    const c = Math.max(0, S.chip.x);
    if (S.outs.length) { const [x, y] = chip_place(); chip.style.transform = `translate(${x}px, ${y + 8 * (1 - c)}px) scale(${0.96 + 0.04 * c})`; }
    chip.style.opacity = c.toFixed(3);
    draw(); return b;
  });

  // input
  const local = (e) => { const r = wrap.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };
  wrap.addEventListener('pointerdown', (e) => { wrap.setPointerCapture(e.pointerId); S.drawing = true; S.stroke = [local(e)]; S.from = null; S.outs = []; S.chip.to(0); chip.style.pointerEvents = 'none'; sched.wake(); });
  wrap.addEventListener('pointermove', (e) => { if (!S.drawing) return; const p = local(e), q = S.stroke[S.stroke.length - 1]; if (Math.hypot(p[0] - q[0], p[1] - q[1]) > 2) { S.stroke.push(p); sched.wake(); } });
  const end = () => {
    if (!S.drawing) return; S.drawing = false;
    const L = S.stroke.reduce((a, p, i) => a + (i ? Math.hypot(p[0] - S.stroke[i - 1][0], p[1] - S.stroke[i - 1][1]) : 0), 0);
    if (L < 40 || S.stroke.length < 6) { S.from = null; S.stroke = []; sched.wake(); return; }   // a tap clears
    release(S.stroke); S.stroke = [];
  };
  wrap.addEventListener('pointerup', end); wrap.addEventListener('pointercancel', end);

  // a rough loop around some elements, as a hand would draw it (for the demo and the test)
  function hand_loop(ids, wob = 0.08, seed = 1, grow = 1) {
    const bs = ids.map((id) => { const s = page.sels.find((x) => x.id === id || x.name === id); return { ...shape(s), b: box_in(s.el, wrap) }; });
    const cx = bs.reduce((a, b) => a + b.c[0], 0) / bs.length, cy = bs.reduce((a, b) => a + b.c[1], 0) / bs.length;
    let rx = 0, ry = 0; for (const b of bs) { rx = Math.max(rx, Math.abs(b.c[0] - cx)); ry = Math.max(ry, Math.abs(b.c[1] - cy)); }
    rx = (rx + 26) * grow; ry = (ry + 18) * grow;
    let r = seed; const rnd = () => ((r = (r * 16807) % 2147483647) / 2147483647 - 0.5);
    const ph = [rnd() * 6, rnd() * 6, rnd() * 6], out = [];
    // a hand overshoots the start a little: the loop ends past where it began
    for (let i = 0; i <= 64; i++) { const t = -0.35 + i / 64 * (Math.PI * 2 + 0.5), w = 1 + wob * (Math.sin(3 * t + ph[0]) + 0.6 * Math.sin(5 * t + ph[1]) + 0.4 * Math.sin(2 * t + ph[2])); out.push([cx + Math.cos(t) * rx * w, cy + Math.sin(t) * ry * w * (1 + 0.04 * i / 64)]); }
    return out;
  }
  function play(loop, ms = 900) {
    S.drawing = true; S.from = null; S.outs = []; S.chip.to(0); S.stroke = [];
    const t0 = performance.now();
    const tick = () => { const f = Math.min(1, (performance.now() - t0) / ms), n = Math.max(2, Math.round(loop.length * (f * f * (3 - 2 * f)))); S.stroke = loop.slice(0, n); sched.wake(); if (f < 1) requestAnimationFrame(tick); else { S.drawing = false; release(loop); } };
    tick();
  }
  const demo_ids = () => ['ball', 'wall'];
  layout();
  return {
    visible: (v) => sched.set_visible(v),
    resize: () => { layout(); if (S.outs.length) { S.outs = outline(S.sel.map((x) => ({ ...x, ...shape(x.s) }))); S.main = S.outs[0]; S.to = resample(S.main, N); S.from = S.to; } sched.wake(); },
    demo: () => play(hand_loop(demo_ids(), 0.1, 7)),
    // a still mid-way: the loop drawn and released, frozen at morph fraction k
    at(ids, k, seed = 3) { const loop = hand_loop(ids, 0.1, seed); release(loop); if (k != null) { S.k.snap(k); S.chip.snap(k >= 1 ? 1 : 0); } sched.wake(); },
    drawing(ids, f = 0.7) { const loop = hand_loop(ids, 0.1, 5); S.drawing = true; S.stroke = loop.slice(0, Math.round(loop.length * f)); sched.wake(); },
    async accept() {
      const tries = [
        [['ball', 'wall'], 0.1, 7, 1], [[zh ? 'λ' : 'λ'], 0.12, 3, 1], [['f-H'], 0.1, 11, 1], [['f-H', 'f-g'], 0.08, 5, 1],
        [['bottom'], 0.12, 9, 1.1], [page.sels.filter((s) => s.id.startsWith('a-')).slice(1, 4).map((s) => s.id), 0.06, 13, 1],
      ];
      let exact = 0, agree = 0, enclosed = 0, clean = 0, n = 0, caught = 0;
      for (const [ids, wob, seed, grow] of tries) {
        const loop = hand_loop(ids, wob, seed, grow), { shapes, sel } = select(loop);
        n++; caught += sel.length;
        // the independent answer: winding number of the loop around every centre
        const want = shapes.filter((x) => winding(loop, x.c[0], x.c[1]) !== 0).map((x) => x.s.id).sort().join();
        const got = sel.map((x) => x.s.id).sort().join();
        if (want === got) agree++;
        if (ids.every((id) => sel.some((x) => x.s.id === id || x.s.name === id))) exact++;
        const outs = outline(sel), inside = (x, y) => outs.some((o) => in_poly(o, x, y));
        // every corner of every caught box, and every sample of every caught part, lies inside the outline
        const pts = sel.flatMap((x) => [...x.rects.flatMap((b) => [[b.x, b.y], [b.x + b.w, b.y], [b.x, b.y + b.h], [b.x + b.w, b.y + b.h]]), ...x.discs.map((d) => [d[0], d[1]]), ...x.polys.flat()]);
        if (pts.every(([x, y]) => inside(x, y))) enclosed++;
        if (shapes.filter((x) => !sel.includes(x)).every((x) => !inside(x.c[0], x.c[1]))) clean++;
      }
      this.at(demo_ids(), null, 7); await new Promise((r) => setTimeout(r, 1400));
      const pass = agree === n && exact === n && enclosed === n && clean === n;
      return { pass, value: zh ? `${n} 个圈：选中与圈内中心一致 ${agree}/${n}（共 ${caught} 个元素）；轮廓包住所选 ${enclosed}/${n}；不含未选中心 ${clean}/${n}` : `${n} loops: selection = centres inside ${agree}/${n} (${caught} elements); outline encloses them ${enclosed}/${n}; no unselected centre inside ${clean}/${n}` };
    },
  };
}
