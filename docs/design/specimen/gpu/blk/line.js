// The number line. A number is a place on a line; an interval is a stretch of it, and its ends say whether they belong
// to it: a hollow end is left out, a solid end is in, and the brackets of its name follow the ends. Zoom in (pinch, or
// ctrl + scroll) and the ticks divide again and again, 1 → 5 → 10, each level fading in where it has room; every label
// says exactly as many decimals as its tick needs. As a building block: line(range, { interval, value }).
import { scheduler, Spring, C, GR } from '../lib/ui.js';
import { num, decimals_of, text, sym, text_width, tint, ring_dot, glass_bead, drags, TICK } from '../lib/plot.js';

export const meta = {
  id: 'line',
  name: { zh: '数轴', en: 'The number line' },
  means: { zh: '一个数是线上的一个位置；区间端点空心是不含、实心是含，名字里的括号跟着变。放大时刻度一层层细分，标签的小数位恰好够用。', en: 'A number is a place on a line; a hollow end is left out of an interval, a solid end is in, and the brackets follow. Zoom in and the ticks divide again; each label has just the decimals it needs.' },
  test: { zh: '200 种放大倍数下标签不重叠；每个刻度都是 1·5·10ᵏ 的整数倍；标签读回去等于刻度值，小数位不多不少；括号与端点一致', en: 'At 200 zoom levels labels never overlap; every tick is a whole multiple of 1·5·10ᵏ; each label reads back to its value with no spare decimals; brackets match the ends' },
  wide: true,
  aspect: '16 / 4',
};

// the tick levels, nested so that every level's ticks include the coarser ones: …, 0.1, 0.5, 1, 5, 10, 50, …
const lv = (j) => (j % 2 === 0 ? 1 : 5) * Math.pow(10, Math.floor(j / 2));
const smooth = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const LABEL = { size: 11.5, tabular: true };

export function make({ stage, canvas, lang }) {
  const zh = lang === 'zh';
  const g = canvas.getContext('2d');
  let W = 0, H = 0, dpr = 1;
  // the view: its centre and log10 of pixels per unit, both on springs so a zoom glides
  const cx = new Spring(0.6, 0.5, 0.92), ls = new Spring(Math.log10(46), 0.5, 0.92);
  const S = { a: -1.5, b: 2, ca: true, cb: false, v: 1.4 };
  const ka = new Spring(1, 0.32, 0.8), kb = new Spring(0, 0.32, 0.8);   // how solid each end is
  const lift = new Spring(0, 0.25, 0.9);
  const base = () => H * 0.64;

  // ---------- the layout of ticks and labels for a view: also what the test measures ----------
  function layout(c, s) {
    const x0 = c - W / 2 / s, x1 = c + W / 2 / s;
    let j = Math.floor(2 * Math.log10(3 / s)) - 3;
    while (lv(j) * s < 3) j++;
    const f = lv(j), k0 = Math.ceil(x0 / f), k1 = Math.floor(x1 / f);
    // the coarsest level a tick belongs to, by exact integer arithmetic on k
    const level_of = (k) => { let m = j; while (m < j + 40 && k % Math.round(lv(m + 1) / f) === 0) m++; return m; };
    const maxabs = Math.max(Math.abs(x0), Math.abs(x1));
    const need = (m) => text_width(g, num(-maxabs, decimals_of(lv(m))), LABEL) + 14;
    let jl = j; while (lv(jl) * s < need(jl)) jl++;
    const fade = smooth(need(jl), need(jl) * 1.45, lv(jl) * s);
    const ticks = [], labels = [];
    for (let k = k0; k <= k1; k++) {
      const m = level_of(k), v = Number((k * f).toPrecision(15)), x = W / 2 + (v - c) * s, p = lv(m) * s;
      ticks.push({ x, v, len: 3 + 10 * smooth(4, 140, p), a: smooth(3, 10, p) });
      if (m >= jl) {
        const t = num(v, decimals_of(lv(m)));
        labels.push({ x, v, t, w: text_width(g, t, LABEL), a: m > jl ? 1 : fade, step: lv(m) });
      }
    }
    return { ticks, labels, fine: f, snap: lv(j + 1) };
  }
  const view = () => ({ c: cx.x, s: Math.pow(10, ls.x) });
  const X = (v) => { const { c, s } = view(); return W / 2 + (v - c) * s; };
  const V = (x) => { const { c, s } = view(); return c + (x - W / 2) / s; };
  const snap_to = (v) => { const { snap } = layout(cx.x, Math.pow(10, ls.x)); return Math.round(v / snap) * snap; };
  const inside = (v) => (v > S.a || (v === S.a && S.ca)) && (v < S.b || (v === S.b && S.cb));
  const bracket = () => (S.ca ? '[' : '(') + num(S.a, dec()) + ', ' + num(S.b, dec()) + (S.cb ? ']' : ')');
  const dec = () => decimals_of(layout(cx.x, Math.pow(10, ls.x)).snap);

  function draw() {
    const { c, s } = view(), L = layout(c, s), y = base();
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.fillStyle = C.paper; g.fillRect(0, 0, W, H);
    // the interval: a tinted stretch, pure at its ends
    const xa = X(S.a), xb = X(S.b);
    g.fillStyle = tint(C.cobalt, 0.22); g.fillRect(Math.min(xa, xb), y - 4, Math.abs(xb - xa), 8);
    // the line and its ticks (scaffolding)
    g.lineWidth = 1; g.strokeStyle = GR(0.55); g.beginPath(); g.moveTo(14, y); g.lineTo(W - 14, y); g.stroke();
    g.lineWidth = 0.9;
    for (const t of L.ticks) { if (t.x < 14 || t.x > W - 14) continue; g.strokeStyle = GR(0.5 * t.a); g.beginPath(); g.moveTo(t.x, y); g.lineTo(t.x, y + t.len); g.stroke(); }
    for (const l of L.labels) { if (l.x - l.w / 2 < 6 || l.x + l.w / 2 > W - 6) continue; text(g, l.t, l.x, y + 30, { ...LABEL, color: TICK, align: 'center', alpha: l.a }); }
    // the ends: hollow is out, solid is in
    ring_dot(g, xa, y, 6.5, C.cobalt, ka.x, 2);
    ring_dot(g, xb, y, 6.5, C.cobalt, kb.x, 2);
    // the value: a glass bead above its place, its number above it
    const xv = X(S.v), by = y - 44;
    g.strokeStyle = GR(0.5); g.lineWidth = 1; g.beginPath(); g.moveTo(xv, by + 12); g.lineTo(xv, y - 1); g.stroke();
    g.fillStyle = C.ink; g.beginPath(); g.arc(xv, y, 2.6, 0, Math.PI * 2); g.fill();
    glass_bead(g, xv, by, 12, lift.x, { dir: 0 });
    text(g, num(S.v, dec()), xv, by - 20, { size: 15, weight: 600, tabular: true, align: 'center', color: C.ink, halo: 4 });
    // its name: x = v ∈ [a, b)   (the brackets follow the ends)
    const ty = 40; let tx = 22;
    tx += sym(g, 'x', tx, ty, { size: 19, color: C.ink });
    tx += text(g, ' = ' + num(S.v, dec()) + ' ', tx, ty, { size: 17, tabular: true, color: C.ink });
    tx += text(g, inside(S.v) ? '∈ ' : '∉ ', tx, ty, { size: 17, font: 'serif', color: C.ink });
    text(g, bracket(), tx, ty, { size: 17, tabular: true, color: C.cobalt, weight: 600 });
  }

  // ---------- touch ----------
  let pan = null, tap = null;
  const near = (x0, y0, x, y, r) => { const d = Math.hypot(x - x0, y - y0); return d < r ? d : Infinity; };
  const hold = drags(canvas, () => [
    { hit: (x, y) => near(X(S.v), base() - 44, x, y, 22), move: (x) => { S.v = snap_to(V(x)); }, down() { lift.to(1); }, up() { lift.to(0); } },
    { hit: (x, y) => near(X(S.a), base(), x, y, 16), down: (x) => { tap = { x, end: 'a' }; }, move: (x) => { if (tap && Math.abs(x - tap.x) < 4) return; tap = null; S.a = Math.min(snap_to(V(x)), S.b); }, up: () => end_tap() },
    { hit: (x, y) => near(X(S.b), base(), x, y, 16), down: (x) => { tap = { x, end: 'b' }; }, move: (x) => { if (tap && Math.abs(x - tap.x) < 4) return; tap = null; S.b = Math.max(snap_to(V(x)), S.a); }, up: () => end_tap() },
    // the empty line pans
    { hit: (x, y) => (Math.abs(y - base()) < 60 ? 100 : Infinity), down: (x) => { pan = { x, c: cx.target }; }, move: (x) => { const s = Math.pow(10, ls.target); cx.to(pan.c - (x - pan.x) / s); }, up: () => { pan = null; } },
  ], { change: () => sched.wake() });
  // a tap on an end (no drag) puts it in or leaves it out
  function end_tap() {
    if (!tap) return;
    if (tap.end === 'a') { S.ca = !S.ca; ka.to(S.ca ? 1 : 0); } else { S.cb = !S.cb; kb.to(S.cb ? 1 : 0); }
    tap = null; sched.wake();
  }
  // zoom about a point: pinch on a trackpad (ctrl + wheel), or two fingers
  function zoom_at(x, by) {
    const s0 = Math.pow(10, ls.target), v = cx.target + (x - W / 2) / s0;
    const l1 = Math.max(Math.log10(4), Math.min(Math.log10(W) + 9, ls.target + by));
    const s1 = Math.pow(10, l1);
    ls.to(l1); cx.to(v - (x - W / 2) / s1); sched.wake();
  }
  canvas.addEventListener('wheel', (e) => {
    if (!(e.ctrlKey || e.metaKey) && Math.abs(e.deltaX) <= Math.abs(e.deltaY)) return;   // plain scrolling is the page's
    e.preventDefault();
    const r = canvas.getBoundingClientRect();
    if (e.ctrlKey || e.metaKey) zoom_at(e.clientX - r.left, -e.deltaY * 0.01);
    else { cx.to(cx.target + e.deltaX / Math.pow(10, ls.target)); sched.wake(); }
  }, { passive: false });
  const touches = new Map(); let pinch = null;
  canvas.addEventListener('pointerdown', (e) => { if (e.pointerType === 'touch') touches.set(e.pointerId, e.clientX); if (touches.size === 2) { const [a, b] = [...touches.values()]; pinch = { d: Math.abs(a - b), mid: (a + b) / 2 }; } });
  canvas.addEventListener('pointermove', (e) => {
    if (!touches.has(e.pointerId)) return; touches.set(e.pointerId, e.clientX);
    if (pinch && touches.size === 2) { const [a, b] = [...touches.values()], d = Math.abs(a - b); if (d > 10 && pinch.d > 10) { const r = canvas.getBoundingClientRect(); zoom_at((a + b) / 2 - r.left, Math.log10(d / pinch.d)); pinch.d = d; } }
  });
  const lift_touch = (e) => { touches.delete(e.pointerId); if (touches.size < 2) pinch = null; };
  canvas.addEventListener('pointerup', lift_touch); canvas.addEventListener('pointercancel', lift_touch);

  const sched = scheduler((dt) => {
    const busy = [cx.step(dt), ls.step(dt), ka.step(dt), kb.step(dt), lift.step(dt)].some(Boolean);
    draw(); return busy || !!hold.active;
  });
  function resize() {
    const r = canvas.getBoundingClientRect(); dpr = Math.min(2, devicePixelRatio || 1);
    W = r.width; H = r.height; canvas.width = Math.max(2, Math.round(W * dpr)); canvas.height = Math.max(2, Math.round(H * dpr));
    draw();
  }
  resize();

  return {
    visible: (v) => sched.set_visible(v), resize,
    // into √2, eight decimals deep, and back out
    demo() { const r2 = Math.SQRT2; S.v = r2; cx.to(r2); ls.to(Math.log10(W) + 7); sched.wake(4000); setTimeout(() => { cx.to(0.6); ls.to(Math.log10(46)); S.v = 1.4; sched.wake(3000); }, 4500); },
    async accept() {
      // 1. labels at 200 zoom levels, from the whole line to eight decimals, around awkward centres
      let overlaps = 0, not_multiple = 0, bad_text = 0, n = 0;
      for (let i = 0; i < 200; i++) {
        const s = Math.pow(10, Math.log10(4) + (i / 199) * (Math.log10(W) + 8 - Math.log10(4)));
        const c = [Math.SQRT2, -Math.PI, 0, 1234.5678, -0.000123][i % 5];
        const L = layout(c, s), vis = L.labels.filter((l) => l.a > 0.05 && l.x - l.w / 2 > 6 && l.x + l.w / 2 < W - 6);
        for (let k = 1; k < vis.length; k++) if (vis[k].x - vis[k].w / 2 < vis[k - 1].x + vis[k - 1].w / 2 + 6) overlaps++;
        for (const l of vis) {
          n++;
          // a multiple, checked on the printed digits as integers: 1.4142135 at a step of 5e-7 must end in 0 or 5
          const dd = decimals_of(l.step), sc = Math.pow(10, dd), nn = Math.round(Math.abs(Number(l.t.replace('\u2212', '-'))) * sc), st = Math.round(l.step * sc);
          if (nn % st !== 0) not_multiple++;
          const back = Number(l.t.replace('−', '-')), d = decimals_of(l.step);
          if (Math.abs(back - l.v) > 1e-9 * Math.max(1, Math.abs(l.v)) || (d > 0 && /0$/.test(l.t)) || /^−?0(\.0+)?$/.test(l.t) && l.t.startsWith('−')) bad_text++;
        }
      }
      // 2. brackets follow the ends, in all four cases
      let brackets_ok = true;
      const save = { ca: S.ca, cb: S.cb };
      for (const ca of [false, true]) for (const cb of [false, true]) { S.ca = ca; S.cb = cb; const t = bracket(); if (t[0] !== (ca ? '[' : '(') || t[t.length - 1] !== (cb ? ']' : ')')) brackets_ok = false; }
      Object.assign(S, save); sched.wake();
      const pass = overlaps === 0 && not_multiple === 0 && bad_text === 0 && brackets_ok && n > 1000;
      return { pass, value: zh ? `${n} 个标签：重叠 ${overlaps}，不是整数倍 ${not_multiple}，读回不符或多余的零 ${bad_text}；括号 ${brackets_ok ? '✓' : '✗'}` : `${n} labels: ${overlaps} overlaps, ${not_multiple} off a multiple, ${bad_text} misread or with spare zeros; brackets ${brackets_ok ? '✓' : '✗'}` };
    },
  };
}
