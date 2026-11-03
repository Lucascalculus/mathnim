// Units that cancel as matter. Every unit in a calculation is a small tile you could hold: metres, seconds,
// kilograms, tokens, one tile per power. They fly out of the written line into one fraction (dividing turns a tile
// over, across the bar); a tile above the bar and its twin below slide together, press into the bar and are gone.
// What is left is the answer's unit. Drag a tile onto its twin yourself, or let the verb do them all.
// As a library primitive: units(expression) for any quantity calculus, from physics to tokens per second.
import { scheduler } from '../../lib/gl.js';
import { Spring, Spring2 } from '../../lib/ui.js';
import { SANS, SERIF, C, css_once } from './_formula.js';

export const meta = {
  id: 'units',
  name: { zh: '会约掉的单位', en: 'Units that cancel as matter' },
  means: { zh: '计算里的每个单位都是一块能拿起来的小方块：分数线上下相同的两块滑到一起、压进线里消失，剩下的就是答案的单位。', en: 'Each unit in a calculation is a small tile: a tile above the bar and its twin below slide together, press into the bar and vanish, and what is left is the answer\'s unit.' },
  test: { zh: '多个算式剩下的单位 = 量纲分析的结果；方块只会成对消失，其余时刻总数不变', en: 'For several expressions the unit left equals dimensional analysis; tiles vanish only in pairs, otherwise their count is conserved' },
  wide: true,
};

// unit → [label zh, label en, pigment]
const U = { m: ['m', 'm', 'cobalt'], s: ['s', 's', 'ochre'], kg: ['kg', 'kg', 'violet'], tok: ['词元', 'tokens', 'teal'] };
// each expression: factors joined by × or ÷; units as exponents
const EXPR = [
  { f: [[12, { m: 1, s: -1 }], ['×'], [3, { s: 1 }]] },
  { f: [[2, { m: 1, s: -2 }], ['×'], [0.1, { s: 1 }]] },
  { f: [[10, { kg: 1, m: 1, s: -2 }], ['÷'], [2, { kg: 1 }]] },
  { f: [[3000, { tok: 1, s: -1 }], ['×'], [60, { s: 1 }]] },
];
const ORDER = ['kg', 'tok', 'm', 's'];
const VERB = { zh: ['约掉', '下一个'], en: ['Cancel', 'Next'] };

// dimensional analysis on its own, for the test and the answer: exponents add when multiplying, subtract when dividing
export function analyse(ex) {
  const e = {}; let num = 1, op = '×';
  for (const f of ex.f) {
    if (f.length === 1) { op = f[0]; continue; }
    num = op === '×' ? num * f[0] : num / f[0];
    for (const k in f[1]) e[k] = (e[k] || 0) + (op === '×' ? 1 : -1) * f[1][k];
  }
  for (const k in e) if (!e[k]) delete e[k];
  return { num: Math.round(num * 1e9) / 1e9, e };
}

css_once('un-css', `
.un-wrap{position:absolute;inset:0;background:var(--paper);overflow:hidden;user-select:none;-webkit-user-select:none;touch-action:none;font-family:${SERIF}}
.un-line{position:absolute;left:0;right:0;text-align:center;font-size:26px;color:var(--ink);white-space:nowrap}
.un-line .u{font-family:${SANS};font-weight:600;font-size:.82em}
.un-line sup{font-size:.62em;line-height:0}
.un-num{position:absolute;font-size:34px;color:var(--ink);white-space:nowrap;transform:translate(-100%,-50%)}
.un-res{position:absolute;font-size:34px;color:var(--ink);white-space:nowrap;transform:translateY(-50%);opacity:0;transition:opacity .35s}
.un-res .u{font-family:${SANS};font-weight:600;font-size:.8em}
.un-res sup{font-size:.6em;line-height:0}
.un-bar{position:absolute;height:2px;border-radius:1px;background:var(--ink);transform-origin:50% 50%}
.un-tile{position:absolute;left:0;top:0;height:var(--th,44px);min-width:var(--th,44px);padding:0 10px;border-radius:9px;display:flex;align-items:center;justify-content:center;
  font:600 var(--tf,19px) ${SANS};background:#fff;cursor:grab;will-change:transform;
  box-shadow:0 0 0 .75px rgba(26,27,31,.13),0 3px 0 -1px #e4e0d8,0 3px 0 -.25px rgba(26,27,31,.1),0 6px 12px rgba(26,27,31,.07)}
.un-verb{position:absolute;height:44px;padding:0 24px;border-radius:22px;border:0;font:600 16px ${SANS};cursor:pointer;white-space:nowrap;transform:translateX(-50%);
  transition:background-color .2s,color .2s,box-shadow .2s;-webkit-tap-highlight-color:transparent}
.un-verb.primary{background:${C.vermilion};color:#fff;box-shadow:0 6px 16px rgba(227,71,44,.26)}
.un-verb.quiet{background:#fff;color:${C.ink};box-shadow:0 0 0 1px rgba(26,27,31,.14),0 2px 6px rgba(26,27,31,.06)}
`);

const fmt_num = (v, zh) => { const s = String(Math.round(v * 1e6) / 1e6); return s.replace(/\B(?=(\d{3})+(?!\d))/g, ','); };

export function make({ stage, canvas, hud, lang }) {
  const zh = lang === 'zh', lab = (u) => U[u][zh ? 0 : 1];
  canvas.style.display = 'none';
  const wrap = document.createElement('div'); wrap.className = 'un-wrap'; stage.append(wrap);
  const line = document.createElement('div'); line.className = 'un-line'; wrap.append(line);
  const numel = document.createElement('div'); numel.className = 'un-num'; wrap.append(numel);
  const res = document.createElement('div'); res.className = 'un-res'; wrap.append(res);
  const bar = document.createElement('div'); bar.className = 'un-bar'; wrap.append(bar);
  const btn = document.createElement('button'); btn.className = 'un-verb primary'; wrap.append(btn);
  let T = 44, idx = 0, tiles = [], pairs = [], auto = false, W = 0, H = 0, narrow = false, log = [];
  const barw = new Spring(0, 0.4, 0.9);

  // the units of a factor as written: numerator·numerator / denominator with powers
  const unit_html = (e) => {
    const part = (sgn) => ORDER.filter((k) => e[k] && Math.sign(e[k]) === sgn).map((k) => `<span class="u" style="color:${C[U[k][2]]}">${lab(k)}</span>${Math.abs(e[k]) > 1 ? `<sup>${Math.abs(e[k])}</sup>` : ''}`).join('·');
    const n = part(1), d = part(-1);
    return (n || (d ? '1' : '')) + (d ? '/' + d : '');
  };

  function load(i) {
    idx = i; const ex = EXPR[idx];
    for (const t of tiles) t.el.remove();
    tiles = []; pairs = []; auto = false; log = [];
    // the written line, one span per factor's units so tiles can rise out of them
    line.innerHTML = ex.f.map((f, j) => f.length === 1 ? ` ${f[0]} ` : `<span data-j="${j}">${fmt_num(f[0], zh)}&#8202; ${unit_html(f[1])}</span>`).join('');
    // numbers on the left of the fraction, the answer on the right (shown when the last pair is gone)
    let op = '×'; const nums = []; for (const f of ex.f) { if (f.length === 1) op = f[0]; else nums.push((nums.length ? ` ${op} ` : '') + fmt_num(f[0], zh)); }
    numel.textContent = nums.join('');
    const A = analyse(ex); res.innerHTML = `= ${fmt_num(A.num, zh)}&#8202; ${unit_html(A.e)}`; res.style.opacity = 0;
    // one tile per power of each unit; dividing sends a factor's tiles to the other side
    op = '×';
    ex.f.forEach((f, j) => {
      if (f.length === 1) { op = f[0]; return; }
      for (const k of ORDER) for (let n = 0; n < Math.abs(f[1][k] || 0); n++) {
        const side = Math.sign(f[1][k]) * (op === '÷' ? -1 : 1), el = document.createElement('div');
        el.className = 'un-tile'; el.textContent = lab(k); el.style.color = C[U[k][2]]; wrap.append(el);
        const t = { u: k, side, el, j, flip: op === '÷', pos: new Spring2(0, 0, 0.5, 0.82), s: new Spring(1, 0.3, 0.8), turn: 0, alive: true, gone: 0, pair: null, w: 44 };
        el.addEventListener('pointerdown', (e) => grab(t, e));
        tiles.push(t);
      }
    });
    layout(true);
    btn.textContent = VERB[lang][0]; btn.className = 'un-verb primary';
    barw.snap(0); barw.to(1); sched.wake(2500);
  }

  function layout(start = false) {
    W = wrap.clientWidth; H = wrap.clientHeight; narrow = W < 560;
    line.style.top = (narrow ? H * 0.17 : H * 0.2) + 'px'; line.style.fontSize = (narrow ? 22 : 30) + 'px';
    numel.style.fontSize = res.style.fontSize = (narrow ? 26 : 42) + 'px';
    T = narrow ? 44 : 54; wrap.style.setProperty('--th', T + 'px'); wrap.style.setProperty('--tf', (narrow ? 19 : 23) + 'px');
    for (const t of tiles) t.w = t.el.offsetWidth || T;
    // fraction centre
    const live = tiles.filter((t) => t.alive && !t.pair);
    const row = (s) => live.filter((t) => t.side === s);
    const width = (r) => r.reduce((a, t) => a + t.w, 0) + Math.max(0, r.length - 1) * (T * 0.18);
    const nw = width(row(1)), dw = width(row(-1)), fw = Math.max(nw, dw, T) + T * 0.55;
    const cy = narrow ? H * 0.47 : H * 0.53;
    // on a phone the numbers sit above the fraction and the answer below it; on a desk they flank it
    let cx = W / 2;
    if (narrow) { numel.style.left = W / 2 + 'px'; numel.style.top = (cy - 104) + 'px'; numel.style.transform = 'translate(-50%,-50%)'; res.style.left = W / 2 + 'px'; res.style.top = (cy + 108) + 'px'; res.style.transform = 'translate(-50%,-50%)'; }
    else { numel.style.transform = res.style.transform = ''; numel.style.left = (cx - fw / 2 - 26) + 'px'; numel.style.top = cy + 'px'; numel.style.transform = 'translate(-100%,-50%)'; res.style.left = (cx + fw / 2 + 26) + 'px'; res.style.top = cy + 'px'; res.style.transform = 'translateY(-50%)'; }
    G.cx = cx; G.cy = cy; G.fw = fw;
    const put = (r, s) => { let x = cx - width(r) / 2; for (const t of r) { t.tx = x + t.w / 2; t.ty = cy - s * (T / 2 + 9); x += t.w + T * 0.18; t.pos.to(t.tx, t.ty); } };
    put(row(1), 1); put(row(-1), -1);
    if (start) {
      // each tile starts on its words in the written line
      const wr = wrap.getBoundingClientRect();
      for (const t of tiles) { const sp = line.querySelector(`[data-j="${t.j}"]`).getBoundingClientRect(); t.pos.a.snap(sp.left - wr.left + sp.width * 0.7); t.pos.b.snap(sp.top - wr.top + sp.height / 2); t.s.snap(0.55); t.s.to(1); t.turn = t.flip ? 1 : 0; t.pos.to(t.tx, t.ty); }
      tiles.forEach((t, i) => { t.delay = 0.12 + i * 0.07; });
    }
    btn.style.left = W / 2 + 'px'; btn.style.top = (H - (narrow ? 110 : 92)) + 'px';
  }
  const G = { cx: 0, cy: 0, fw: 0 };

  // a pair: the tile above and its twin below meet at the bar, press flat into it, and are gone
  function cancel(a, b) {
    if (!a.alive || !b.alive || a.pair || b.pair || a.u !== b.u || a.side === b.side) return false;
    const p = { a, b, t: 0 }; a.pair = b.pair = p; pairs.push(p); log.push([a.u, a.side, b.side]);
    const mx = (a.pos.x + b.pos.x) / 2;
    for (const t of [a, b]) { t.pos.set(0.36, 0.9).to(mx, G.cy - t.side * (T / 2 + 1.5)); }
    layout(); sched.wake(2000); return true;
  }
  function next_pair() {
    for (const k of ORDER) { const up = tiles.find((t) => t.alive && !t.pair && t.u === k && t.side === 1), dn = tiles.find((t) => t.alive && !t.pair && t.u === k && t.side === -1); if (up && dn) return [up, dn]; }
    return null;
  }
  function run() { auto = true; const p = next_pair(); if (p) cancel(...p); sched.wake(); }
  btn.addEventListener('click', () => { if (done()) load((idx + 1) % EXPR.length); else run(); });
  const done = () => !next_pair() && pairs.every((p) => p.t >= 1);

  // dragging a tile by hand: drop it on its twin across the bar and they cancel; anywhere else it goes home
  let drag = null;
  function grab(t, e) {
    if (!t.alive || t.pair || t.delay > 0) return;
    e.stopPropagation(); drag = { t, x0: e.clientX, y0: e.clientY, px: t.pos.x, py: t.pos.y }; t.s.to(1.08); wrap.setPointerCapture(e.pointerId); t.el.style.zIndex = 2; sched.wake();
  }
  wrap.addEventListener('pointermove', (e) => { if (!drag) return; const t = drag.t; t.pos.a.snap(drag.px + e.clientX - drag.x0); t.pos.b.snap(drag.py + e.clientY - drag.y0); sched.wake(); });
  wrap.addEventListener('pointerup', () => {
    if (!drag) return; const t = drag.t; drag = null; t.s.to(1); t.el.style.zIndex = '';
    const twin = tiles.filter((q) => q.alive && !q.pair && q.u === t.u && q.side !== t.side).sort((p, q) => Math.hypot(p.pos.x - t.pos.x, p.pos.y - t.pos.y) - Math.hypot(q.pos.x - t.pos.x, q.pos.y - t.pos.y))[0];
    if (twin && Math.hypot(twin.pos.x - t.pos.x, twin.pos.y - t.pos.y) < 56) cancel(t.side === 1 ? t : twin, t.side === 1 ? twin : t);
    else t.pos.to(t.tx, t.ty);
    sched.wake();
  });

  function step(dt) {
    let busy = barw.step(dt);
    for (const t of tiles) {
      if (!t.alive) continue;
      if (t.delay > 0) { t.delay -= dt; busy = true; continue; }
      busy = t.pos.step(dt) || busy; busy = t.s.step(dt) || busy;
      if (t.flip && t.turn > 0) { t.turn = Math.max(0, t.turn - dt / 0.55); busy = true; }
    }
    for (const p of pairs) {
      if (p.t >= 1) continue;
      // meet first, then press: the squash starts once both tiles are at the bar
      const met = Math.abs(p.a.pos.y - p.a.pos.b.target) < 2 && Math.abs(p.b.pos.y - p.b.pos.b.target) < 2;
      if (met || p.t > 0) p.t = Math.min(1, p.t + dt / 0.32);
      if (p.t >= 1) { for (const t of [p.a, p.b]) { t.alive = false; t.el.remove(); } layout(); if (auto) { const q = next_pair(); if (q) cancel(...q); } }
      busy = true;
    }
    return busy;
  }
  function paint() {
    for (const t of tiles) {
      if (!t.alive) continue;
      const p = t.pair ? t.pair.t : 0, sq = p * p;
      const turn = t.flip ? 360 * (1 - t.turn) : 0;
      t.el.style.transform = `translate(${(t.pos.x - t.w / 2).toFixed(2)}px, ${(t.pos.y - T / 2).toFixed(2)}px) translateY(${(t.side * T / 2 * sq).toFixed(2)}px) rotateX(${turn.toFixed(1)}deg) scale(${(t.s.x * (1 + 0.12 * sq)).toFixed(4)}, ${(t.s.x * (1 - sq)).toFixed(4)})`;
      t.el.style.opacity = t.delay > 0 ? 0 : (1 - Math.max(0, p - 0.7) / 0.3).toFixed(3);
      t.el.style.transformOrigin = t.side === 1 ? '50% 100%' : '50% 0%';
    }
    const live = tiles.filter((t) => t.alive), anyden = live.some((t) => t.side === -1);
    bar.style.width = (G.fw * Math.max(0, barw.x)) + 'px'; bar.style.left = (G.cx - G.fw * Math.max(0, barw.x) / 2) + 'px'; bar.style.top = (G.cy - 1) + 'px';
    if (!anyden && barw.target === 1 && pairs.length && done()) barw.to(0);
    const fin = done();
    res.style.opacity = fin ? 1 : 0;
    btn.textContent = VERB[lang][fin ? 1 : 0]; btn.className = 'un-verb ' + (fin ? 'quiet' : 'primary');
    hud.textContent = `${live.length} ${zh ? '块' : live.length === 1 ? 'tile' : 'tiles'}`;
  }
  const sched = scheduler((dt) => { const b = step(dt); paint(); return b || !!drag; });
  addEventListener('resize', () => layout());
  load(0);

  // run one expression to the end with the same machinery, sampling the tile count at every frame
  function fast(i) {
    load(i); run();
    const n0 = tiles.length; let ok = true, frames = 0;
    for (; frames < 4000 && !done(); frames++) {
      step(1 / 60);
      const alive = tiles.filter((t) => t.alive).length, gone_pairs = pairs.filter((p) => p.t >= 1).length;
      if (alive !== n0 - 2 * gone_pairs) ok = false;
    }
    paint();
    const left = {}; for (const t of tiles) if (t.alive) left[t.u] = (left[t.u] || 0) + t.side;
    return { n0, ok, left, frames, pairs_ok: log.every(([u, a, b]) => a === -b) };
  }

  return {
    visible: (v) => sched.set_visible(v), resize: () => layout(),
    demo() { run(); },
    show(i) { load(i); },
    finish(i) { fast(i); paint(); sched.wake(); },
    async accept() {
      const rows = []; let pass = true;
      for (let i = 0; i < EXPR.length; i++) {
        const r = fast(i), A = analyse(EXPR[i]);
        // the power each unit is left with must be what dimensional analysis says, and nothing else is left
        const keys = new Set([...Object.keys(r.left).filter((k) => r.left[k]), ...Object.keys(A.e)]);
        const same = [...keys].every((k) => (r.left[k] || 0) === (A.e[k] || 0));
        // and the count of tiles at the start is the sum of the powers written
        const written = EXPR[i].f.filter((f) => f.length > 1).reduce((s, f) => s + Object.values(f[1]).reduce((a, v) => a + Math.abs(v), 0), 0);
        if (!(same && r.ok && r.pairs_ok && written === r.n0)) pass = false;
        rows.push(`${r.n0}→${tiles.filter((t) => t.alive).length}${same ? '' : '✗'}`);
      }
      load(1); sched.wake();
      return { pass, value: zh ? `${EXPR.length} 个算式的单位都与量纲分析一致；方块 ${rows.join('，')}，只成对消失` : `all ${EXPR.length} units match dimensional analysis; tiles ${rows.join(', ')}, vanishing only in pairs` };
    },
  };
}
