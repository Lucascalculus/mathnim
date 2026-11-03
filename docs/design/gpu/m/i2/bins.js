// Sorting into magnetic bins. Cards (each a tiny true picture of the thing) are dragged into category bins. A bin
// pulls a card in once it is within reach, and shows, hollow, the slot it will take. On "check", each card you put
// in the wrong bin lifts and drifts to its true bin, and leaves a hollow ghost where you had put it: your sort
// (hollow, predicted) and the truth (solid) side by side. Cards rest only in slots, so they never overlap at rest.
// As a library primitive: bins(items, categories, key) for any classification (convex or not, discrete or
// continuous, linear or not, which distribution, which layer).
import { scheduler } from '../../lib/gl.js';
import { Spring, Spring2 } from '../../lib/ui.js';
import { SANS, SERIF, C, GR, roundrect, fit2d, local, verb } from './_loop.js';

export const meta = {
  id: 'bins',
  name: { zh: '有磁性的分类盒', en: 'Magnetic bins' },
  means: { zh: '把卡片拖进分类盒，盒子在近处会把它吸进去；核对时，放错的卡片浮起来飘到正确的盒子，原地留下一个空心的影子：你的分法和真相并排。', en: 'Drag cards into bins that pull them in when close; on checking, misplaced cards lift and drift to their true bin, leaving a hollow ghost where you put them: your sort beside the truth.' },
  test: { zh: '静止时卡片两两不重叠；最终的摆放与答案一致；空心影子的个数 = 放错的个数', en: 'At rest no two cards overlap; the final arrangement matches the key; the number of ghosts = the number of mistakes' },
};

// convex or not, each with its graph on [−2, 2]
const ITEMS = [
  { t: 'x²', f: (x) => x * x, convex: true },
  { t: 'sin x', f: Math.sin, convex: false },
  { t: '|x|', f: Math.abs, convex: true },
  { t: 'x³', f: (x) => x ** 3, convex: false },
  { t: 'eˣ', f: Math.exp, convex: true },
  { t: '−x²', f: (x) => -x * x, convex: false },
  { t: 'max(0, x)', f: (x) => Math.max(0, x), convex: true },
  { t: 'x⁴ − 2x²', f: (x) => x ** 4 - 2 * x * x, convex: false },
];
const Q = {
  zh: { bins: ['凸函数', '不是凸函数'], check: '对一下', again: '再来一次', of: '对' },
  en: { bins: ['convex', 'not convex'], check: 'Check', again: 'Again', of: 'right' },
};
// convexity, checked numerically rather than trusted: f(mid) ≤ the chord's mid, for many pairs
export function is_convex(f) {
  for (let i = 0; i < 40; i++) for (let j = i + 1; j < 41; j++) { const a = -2 + 4 * i / 40, b = -2 + 4 * j / 40; if (f((a + b) / 2) > (f(a) + f(b)) / 2 + 1e-12) return false; }
  return true;
}

export function make({ stage, canvas, hud, lang }) {
  const T = Q[lang], ctx = canvas.getContext('2d', { willReadFrequently: true });
  let W = 0, H = 0, dpr = 1, G = null;
  const cards = ITEMS.map((it, i) => ({ ...it, i, p: new Spring2(0, 0, 0.42, 0.82), bin: -1, slot: -1, lift: new Spring(0, 0.3, 0.8), tilt: 0 }));
  const tray = new Spring(1, 0.6, 1);
  let ghosts = [], checked = false, drag = null, hover_bin = -1, hover_slot = -1;
  const btn = verb(stage, T.check); btn.classList.add('away');

  function geo() {
    const narrow = W < 640, cw = narrow ? 78 : 124, ch = narrow ? 66 : 98, g = narrow ? 8 : 14;
    const tray_cols = narrow ? 4 : 8, tw = tray_cols * cw + (tray_cols - 1) * g, tx = (W - tw) / 2, ty = narrow ? 28 : 64;
    const bcols = narrow ? 2 : 4, brows = 8 / bcols, pad = narrow ? 8 : 14, head = narrow ? 38 : 46;
    const bw = bcols * cw + (bcols - 1) * g + 2 * pad, bh = head + brows * ch + (brows - 1) * g + pad, bgap = narrow ? W - 2 * bw - 24 : 36;
    const by = ty + (narrow ? 2 : 1) * (ch + g) + (narrow ? 34 : 50), bx0 = (W - 2 * bw - bgap) / 2;
    const bins = [0, 1].map((k) => ({ x: bx0 + k * (bw + bgap), y: by, w: bw, h: bh }));
    return { narrow, cw, ch, g, tray_cols, tx, ty, bcols, pad, head, bins, reach: narrow ? 44 : 70 };
  }
  const home = (i) => { const c = i % G.tray_cols, r = Math.floor(i / G.tray_cols); return [G.tx + c * (G.cw + G.g), G.ty + r * (G.ch + G.g)]; };
  const slot_xy = (b, s) => { const B = G.bins[b], c = s % G.bcols, r = Math.floor(s / G.bcols); return [B.x + G.pad + c * (G.cw + G.g), B.y + G.head + r * (G.ch + G.g)]; };
  const taken = (b, s, except) => cards.some((c) => c !== except && c.bin === b && c.slot === s) || ghosts.some((g) => g.bin === b && g.slot === s);
  // where a dropped card goes: the free slot under the hand if there is one, else the first free one in reading order
  function nearest_free(b, x, y, except) {
    for (let s = 0; s < 8; s++) { if (taken(b, s, except)) continue; const [sx, sy] = slot_xy(b, s); if (x >= sx - G.g / 2 && x <= sx + G.cw + G.g / 2 && y >= sy - G.g / 2 && y <= sy + G.ch + G.g / 2) return s; }
    for (let s = 0; s < 8; s++) if (!taken(b, s, except)) return s;
    return -1;
  }
  const target = (c) => (c.bin >= 0 ? slot_xy(c.bin, c.slot) : home(c.i));
  // which bin reaches a card centred at (x, y)
  function reach(x, y) {
    for (let b = 0; b < 2; b++) { const B = G.bins[b], dx = Math.max(B.x - x, 0, x - B.x - B.w), dy = Math.max(B.y - y, 0, y - B.y - B.h); if (Math.hypot(dx, dy) < G.reach) return b; }
    return -1;
  }
  function fit() { ({ W, H, dpr } = fit2d(canvas, ctx)); G = geo(); for (const c of cards) { const [x, y] = target(c); c.p.a.snap(x); c.p.b.snap(y); } }

  // the card's face: its graph, true to the function, and its name
  function face(c, x, y, o = {}) {
    const w = G.cw, h = G.ch, gh = h - (G.narrow ? 24 : 34), m = G.narrow ? 7 : 11;
    let lo = Infinity, hi = -Infinity; for (let k = 0; k <= 60; k++) { const v = c.f(-2 + 4 * k / 60); lo = Math.min(lo, v); hi = Math.max(hi, v); }
    const pad = (hi - lo) * 0.1 + 1e-6; lo -= pad; hi += pad;
    const px = (v) => x + m + (v + 2) / 4 * (w - 2 * m), py = (v) => y + m + (1 - (v - lo) / (hi - lo)) * (gh - m);
    if (lo < 0 && hi > 0) { ctx.strokeStyle = GR(o.ghost ? 0.12 : 0.18); ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(x + m, py(0)); ctx.lineTo(x + w - m, py(0)); ctx.stroke(); }
    ctx.strokeStyle = o.ghost ? GR(0.4) : C.ink; ctx.lineWidth = o.ghost ? 1.2 : (G.narrow ? 1.6 : 2); ctx.setLineDash(o.ghost ? [3, 3] : []);
    ctx.beginPath(); for (let k = 0; k <= 60; k++) { const v = -2 + 4 * k / 60, X = px(v), Y = py(c.f(v)); k ? ctx.lineTo(X, Y) : ctx.moveTo(X, Y); } ctx.stroke(); ctx.setLineDash([]);
    ctx.font = `italic ${G.narrow ? 13 : 16}px ${SERIF}`; ctx.textAlign = 'center'; ctx.fillStyle = o.ghost ? GR(0.55) : C.ink;
    ctx.fillText(c.t, x + w / 2, y + h - (G.narrow ? 8 : 11));
  }
  function card(c) {
    const z = c.lift.x, x = c.p.x, y = c.p.y, w = G.cw, h = G.ch;
    ctx.save(); ctx.translate(x + w / 2, y + h / 2); ctx.rotate(c.tilt); const s = 1 + 0.04 * z; ctx.scale(s, s); ctx.translate(-w / 2, -h / 2);
    // paper on paper at rest; a soft shadow only while it is in the air
    if (z > 0.02) { ctx.shadowColor = GR(0.16 * z); ctx.shadowBlur = 18 * z; ctx.shadowOffsetY = 8 * z; }
    else { roundrect(ctx, -0.5, 1.5, w + 1, h, 9); ctx.fillStyle = GR(0.05); ctx.fill(); }
    roundrect(ctx, 0, 0, w, h, 9); ctx.fillStyle = '#fff'; ctx.fill(); ctx.shadowColor = 'transparent';
    ctx.strokeStyle = GR(0.1); ctx.lineWidth = 1; ctx.stroke();
    face(c, 0, 0);
    ctx.restore();
  }
  function ghost(g) {
    const [x, y] = slot_xy(g.bin, g.slot), c = cards[g.i];
    ctx.save(); ctx.globalAlpha = g.a.x;
    ctx.setLineDash([5, 4]); ctx.strokeStyle = GR(0.38); ctx.lineWidth = 1.25; roundrect(ctx, x + 0.5, y + 0.5, G.cw - 1, G.ch - 1, 9); ctx.stroke(); ctx.setLineDash([]);
    face(c, x, y, { ghost: true });
    ctx.restore();
  }
  function draw() {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.fillStyle = C.paper; ctx.fillRect(0, 0, W, H);
    // the tray's empty places, faint, so you can see where things came from
    if (tray.x > 0.01) for (let i = 0; i < cards.length; i++) { const [x, y] = home(i); roundrect(ctx, x, y, G.cw, G.ch, 9); ctx.fillStyle = `rgba(26,27,31,${0.03 * tray.x})`; ctx.fill(); }
    G.bins.forEach((B, b) => {
      const live = hover_bin === b;
      roundrect(ctx, B.x, B.y, B.w, B.h, 16); ctx.fillStyle = live ? '#ebe8e1' : '#f1efea'; ctx.fill();
      ctx.strokeStyle = GR(live ? 0.22 : 0.1); ctx.lineWidth = live ? 1.5 : 1; ctx.stroke();
      ctx.font = `600 ${G.narrow ? 14 : 16}px ${SANS}`; ctx.fillStyle = C.ink; ctx.textAlign = 'left'; ctx.fillText(T.bins[b], B.x + G.pad + 2, B.y + G.head - (G.narrow ? 14 : 17));
      // the slot a card will take, hollow, while the bin holds it in reach
      if (live && hover_slot >= 0) { const [x, y] = slot_xy(b, hover_slot); ctx.setLineDash([5, 4]); ctx.strokeStyle = GR(0.35); ctx.lineWidth = 1.25; roundrect(ctx, x + 0.5, y + 0.5, G.cw - 1, G.ch - 1, 9); ctx.stroke(); ctx.setLineDash([]); }
    });
    for (const g of ghosts) ghost(g);
    // cards on the ground first, lifted ones above
    [...cards].sort((a, b) => a.lift.x - b.lift.x).forEach(card);
    btn.style.left = (W / 2 - btn.offsetWidth / 2) + 'px'; btn.style.top = (G.bins[0].y + G.bins[0].h + (G.narrow ? 36 : 34)) + 'px';
  }

  function step(dt) {
    let busy = false;
    for (const c of cards) {
      if (c === drag?.c) continue;
      const [x, y] = target(c); c.p.to(x, y);
      const vx = c.p.a.v; busy = c.p.step(dt) || busy;
      // in the air while far from home; tilts a little with its speed
      const far = Math.hypot(c.p.x - x, c.p.y - y); c.lift.to(c.flying ? Math.min(1, far / 60) : 0);
      if (c.flying && far < 1) c.flying = false;
      c.tilt += (Math.max(-0.05, Math.min(0.05, vx * 0.00008)) - c.tilt) * Math.min(1, dt * 14);
      busy = c.lift.step(dt) || busy || Math.abs(c.tilt) > 1e-3;
    }
    if (drag) busy = drag.c.lift.step(dt) || true;
    tray.to(placed_all() ? 0 : 1); busy = tray.step(dt) || busy;
    for (const g of ghosts) busy = g.a.step(dt) || busy;
    return busy;
  }
  const sched = scheduler((dt) => { const b = step(dt); draw(); return b; });

  function placed_all() { return cards.every((c) => c.bin >= 0); }
  function refresh_verb() {
    if (checked) { btn.textContent = T.again; btn.className = 'lp-verb quiet'; }
    else { btn.textContent = T.check; btn.className = 'lp-verb primary' + (placed_all() ? '' : ' away'); }
  }
  // put a card in a bin (nearest free slot to a point), or home
  function place(c, b, x, y) {
    if (b < 0) { c.bin = -1; c.slot = -1; }
    else { const s = nearest_free(b, x ?? G.bins[b].x, y ?? G.bins[b].y, c); if (s < 0) { c.bin = -1; c.slot = -1; } else { c.bin = b; c.slot = s; } }
    refresh_verb(); sched.wake();
  }
  // the truth: each card you misplaced leaves a ghost and drifts to its true bin
  function check() {
    if (checked || !placed_all()) return;
    checked = true; let n = 0;
    cards.forEach((c) => {
      const right = is_convex(c.f) ? 0 : 1;
      if (c.bin === right) return;
      ghosts.push({ i: c.i, bin: c.bin, slot: c.slot, a: new Spring(0, 0.5, 1).to(1) });
      const k = n++;
      setTimeout(() => { c.bin = right; c.slot = nearest_free(right, ...center(c), c); c.flying = true; c.p.set(0.75, 0.86); sched.wake(1500); }, 160 * k);
    });
    // a misplaced card must not take the slot of another card about to leave: slots are claimed in order
    hud.textContent = `${cards.length - n} / ${cards.length} ${T.of}`;
    refresh_verb(); sched.wake(1200 + 160 * n);
  }
  const center = (c) => [c.p.x + G.cw / 2, c.p.y + G.ch / 2];
  function reset() {
    checked = false; ghosts = []; hud.textContent = '';
    for (const c of cards) { c.bin = -1; c.slot = -1; c.flying = false; c.p.set(0.42, 0.82); }
    refresh_verb(); sched.wake();
  }
  btn.addEventListener('click', () => (checked ? reset() : check()));

  // dragging: the card follows the hand; a bin in reach pulls it towards the slot it would take
  const at = (x, y) => [...cards].sort((a, b) => b.lift.x - a.lift.x).find((c) => x >= c.p.x && x <= c.p.x + G.cw && y >= c.p.y && y <= c.p.y + G.ch);
  canvas.addEventListener('pointerdown', (e) => {
    if (checked) return; const [x, y] = local(canvas, e), c = at(x, y); if (!c) return;
    drag = { c, dx: x - c.p.x, dy: y - c.p.y, lx: x, t: performance.now() }; c.lift.to(1); canvas.setPointerCapture(e.pointerId); sched.wake();
  });
  canvas.addEventListener('pointermove', (e) => {
    const [x, y] = local(canvas, e);
    if (!drag) { canvas.style.cursor = !checked && at(x, y) ? 'grab' : ''; return; }
    const c = drag.c, px = x - drag.dx, py = y - drag.dy, cx = px + G.cw / 2, cy = py + G.ch / 2, b = reach(cx, cy);
    let tx = px, ty = py;
    if (b >= 0) {
      const s = nearest_free(b, cx, cy, c);
      if (s >= 0) { const [sx, sy] = slot_xy(b, s), d = Math.hypot(sx - px, sy - py), m = 0.28 * Math.max(0, 1 - d / (G.cw * 2.2)); tx = px + (sx - px) * m; ty = py + (sy - py) * m; }
      hover_bin = b; hover_slot = s;
    } else { hover_bin = -1; hover_slot = -1; }
    c.tilt = Math.max(-0.08, Math.min(0.08, (x - drag.lx) * 0.004)); drag.lx = x;
    c.p.a.snap(tx); c.p.b.snap(ty); sched.wake();
  });
  canvas.addEventListener('pointerup', () => {
    if (!drag) return; const c = drag.c, [cx, cy] = center(c), b = reach(cx, cy);
    drag = null; hover_bin = -1; hover_slot = -1; c.lift.to(0); place(c, b, cx, cy);
  });

  fit(); refresh_verb(); draw();
  // run the physics to rest without frames (for the test)
  function settle() { for (let k = 0; k < 2400; k++) if (!step(1 / 60) && k > 30) break; draw(); }
  function rest_report() {
    const rects = cards.map((c) => [c.p.x, c.p.y]).concat(ghosts.map((g) => slot_xy(g.bin, g.slot)));
    let overlaps = 0;
    for (let i = 0; i < rects.length; i++) for (let j = i + 1; j < rects.length; j++) { const [ax, ay] = rects[i], [bx, by] = rects[j]; if (ax < bx + G.cw - 0.01 && bx < ax + G.cw - 0.01 && ay < by + G.ch - 0.01 && by < ay + G.ch - 0.01) overlaps++; }
    const inside = cards.every((c) => { const B = G.bins[is_convex(c.f) ? 0 : 1]; return c.p.x >= B.x && c.p.x + G.cw <= B.x + B.w && c.p.y >= B.y && c.p.y + G.ch <= B.y + B.h; });
    return { overlaps, inside };
  }
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  return {
    visible: (v) => sched.set_visible(v), resize: () => { fit(); draw(); },
    // a learner's sort with two slips, then the check
    demo() {
      reset(); const plan = [0, 1, 0, 0, 1, 1, 0, 1];   // two common slips: x³ taken for convex, eˣ for not
      cards.forEach((c, k) => setTimeout(() => place(c, plan[k]), 140 * k));
      setTimeout(check, 120 * cards.length + 900);
    },
    check, reset, place: (i, b) => place(cards[i], b),
    async accept() {
      const zh = lang === 'zh', runs = [];
      // the key itself is computed (chord test), not trusted from the labels
      const key_ok = ITEMS.every((it) => is_convex(it.f) === it.convex);
      // three sorts: two slips; everything in one bin; all right
      for (const plan of [[0, 1, 0, 0, 1, 1, 0, 1], [0, 0, 0, 0, 0, 0, 0, 0], [0, 1, 0, 1, 0, 1, 0, 1]]) {
        reset(); settle();
        cards.forEach((c, k) => place(c, plan[k]));
        const mistakes = cards.filter((c) => c.bin !== (is_convex(c.f) ? 0 : 1)).length;
        check(); await wait(160 * mistakes + 60); settle();
        runs.push({ mistakes, ghosts: ghosts.length, ...rest_report() });
      }
      const ok = key_ok && runs.every((r) => r.overlaps === 0 && r.inside && r.ghosts === r.mistakes);
      reset(); settle();
      return { pass: ok, value: runs.map((r) => `${zh ? '错' : 'slips'} ${r.mistakes} → ${zh ? '影子' : 'ghosts'} ${r.ghosts}, ${zh ? '重叠' : 'overlaps'} ${r.overlaps}, ${r.inside ? (zh ? '全部归位' : 'all home') : '✗'}`).join('; ') };
    },
  };
}
