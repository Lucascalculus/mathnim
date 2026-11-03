// A ripple of recomputation. A few quantities that depend on each other, laid out as the sheet they are: change an
// input and a pulse runs out along its dependency lines. A cell that waits for news is drawn hollow (what it shows
// is out of date); when the pulse reaches it, its digits roll to the new value and it turns solid. A cell with two
// inputs waits for the later one, so the order of updates is always a valid topological order and nothing ever
// shows a mixed, half-computed value. The sheet is the base-rate problem: a rare illness and a good test.
// As a library primitive: ripple(cells, deps) for any chain: price, tax, total; or an MPC prediction.
import { scheduler } from '../../lib/gl.js';
import { Spring } from '../../lib/ui.js';
import { SANS, SERIF, C, css_once, Odometer } from './_formula.js';

export const meta = {
  id: 'ripple',
  name: { zh: '重算的涟漪', en: 'A ripple of recomputation' },
  means: { zh: '改一个输入，一道脉冲沿着依赖线传出去；还没收到的格子是空心的（数已过时），脉冲到了，数字滚到新值、变成实心。', en: 'Change an input and a pulse runs out along the dependency lines; cells still waiting are hollow (out of date), and as the pulse arrives their digits roll to the new value and turn solid.' },
  test: { zh: '更新顺序总是合法的拓扑序，只有受影响的格子更新；每个最终值都等于直接计算', en: 'Updates always come in a valid topological order and only affected cells update; every final value equals direct computation' },
  wide: true,
};

// the cells: inputs in whole percent, the rest computed
const CELLS = {
  sens: { in: true, v: 90, lo: 50, hi: 99, name: { zh: '灵敏度', en: 'sensitivity' }, sym: 'P(+|ill)' },
  prior: { in: true, v: 1, lo: 1, hi: 40, name: { zh: '患病率', en: 'prevalence' }, sym: 'P(ill)' },
  fpr: { in: true, v: 5, lo: 1, hi: 30, name: { zh: '误报率', en: 'false alarms' }, sym: 'P(+|well)' },
  tp: { deps: ['prior', 'sens'], f: (g) => g.prior * g.sens / 100, name: { zh: '真阳性', en: 'true positive' }, sym: 'P(ill, +)' },
  fp: { deps: ['prior', 'fpr'], f: (g) => (100 - g.prior) * g.fpr / 100, name: { zh: '假阳性', en: 'false positive' }, sym: 'P(well, +)' },
  pos: { deps: ['tp', 'fp'], f: (g) => g.tp + g.fp, name: { zh: '阳性', en: 'positive' }, sym: 'P(+)' },
  post: { deps: ['tp', 'pos'], f: (g) => 100 * g.tp / g.pos, name: { zh: '阳性时真病', en: 'ill, if positive' }, sym: 'P(ill|+)' },
};
const IDS = Object.keys(CELLS), EDGES = IDS.flatMap((c) => (CELLS[c].deps || []).map((p) => [p, c]));
// where each cell sits: (column, row) on a desk; transposed on a phone
const GRID = { sens: [0, 0], prior: [0, 1], fpr: [0, 2], tp: [1, 0.5], fp: [1, 1.5], pos: [2, 1.5], post: [3, 0.85] };
const SPEED = 560;
const PLACES = (id) => (CELLS[id].in ? 0 : id === 'post' ? 1 : 2);
// the dial rolls between values as they will be shown, so at rest every wheel sits on a digit
const rnd = (id, v) => { const k = Math.pow(10, PLACES(id)); return Math.round(v * k) / k; };   // px per second, the pulse along a line

// direct computation, on its own: the truth the sheet must end at
export function compute(inp) { const g = { ...inp }; for (const id of ['tp', 'fp', 'pos', 'post']) g[id] = CELLS[id].f(g); return g; }

css_once('rp-css', `
.rp-wrap{position:absolute;inset:0;background:var(--paper);overflow:hidden;user-select:none;-webkit-user-select:none;touch-action:none}
.rp-wrap svg{position:absolute;inset:0;width:100%;height:100%;overflow:visible}
.rp-cell{position:absolute;box-sizing:border-box;border-radius:12px;background:#fff;padding:10px 14px 0;font-family:${SANS};
  box-shadow:0 0 0 .75px rgba(26,27,31,.12),0 2px 6px rgba(26,27,31,.06);will-change:transform}
.rp-cell .nm{font-size:14px;color:var(--ink-2);white-space:nowrap;display:flex;gap:6px;align-items:baseline}
.rp-cell .nm i{font-family:${SERIF};font-size:13px;color:#62666d}
.rp-cell .v{white-space:nowrap;font-size:30px;font-weight:600;color:var(--ink);margin-top:2px;letter-spacing:-.01em}
.rp-cell .v .pc{font-size:.62em;font-weight:500;margin-left:2px;color:var(--ink-2)}
.rp-cell .hollow{position:absolute;inset:0;border-radius:12px;border:1.5px dashed rgba(26,27,31,.55);opacity:0;pointer-events:none}
.rp-cell.in{cursor:ew-resize}
.rp-cell.in .bar{position:absolute;left:14px;right:14px;bottom:10px;height:4px;border-radius:2px;background:rgba(26,27,31,.08);overflow:hidden}
.rp-cell.in .bar b{position:absolute;left:0;top:0;bottom:0;background:${C.cobalt};border-radius:2px}
.rp-cell.out .v{font-size:38px}
.rp-wrap.narrow .rp-cell .v{font-size:23px}.rp-wrap.narrow .rp-cell.out .v{font-size:28px}.rp-wrap.narrow .rp-cell .nm{font-size:13px}
`);

export function make({ stage, canvas, hud, lang }) {
  const zh = lang === 'zh';
  canvas.style.display = 'none';
  const wrap = document.createElement('div'); wrap.className = 'rp-wrap'; stage.append(wrap);
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg'); wrap.append(svg);
  const inputs = Object.fromEntries(IDS.filter((id) => CELLS[id].in).map((id) => [id, CELLS[id].v]));
  const truth0 = compute(inputs);
  // each cell: its element, an odometer, the value it shows (rolling), the wave it last took
  const cell = {};
  for (const id of IDS) {
    const D = CELLS[id], el = document.createElement('div');
    el.className = 'rp-cell' + (D.in ? ' in' : '') + (id === 'post' ? ' out' : '');
    el.innerHTML = `<div class="nm">${D.name[lang]}<i>${D.sym}</i></div><div class="v"><span class="o"></span><span class="pc">%</span></div><div class="hollow"></div>${D.in ? '<div class="bar"><b></b></div>' : ''}`;
    wrap.append(el);
    const odo = new Odometer(el.querySelector('.o'), { places: PLACES(id), group: '', max_int: 3 });
    cell[id] = { el, odo, shown: new Spring(rnd(id, truth0[id]), 0.32, 1), value: truth0[id], wave: 0, stale: new Spring(0, 0.2, 1), bump: new Spring(0, 0.18, 0.5), hollow: el.querySelector('.hollow'), bar: el.querySelector('.bar b') };
    odo.set(truth0[id]);
  }
  // the lines, one path per dependency; each carries its pulses
  const paths = {}, NS = 'http://www.w3.org/2000/svg';
  for (const [p, c] of EDGES) {
    const g = document.createElementNS(NS, 'g');
    const base = document.createElementNS(NS, 'path'), lit = document.createElementNS(NS, 'path'), dot = document.createElementNS(NS, 'circle');
    base.setAttribute('fill', 'none'); base.setAttribute('stroke', 'rgba(26,27,31,.2)'); base.setAttribute('stroke-width', 1.25);
    lit.setAttribute('fill', 'none'); lit.setAttribute('stroke', C.ink); lit.setAttribute('stroke-width', 1.75); lit.setAttribute('stroke-linecap', 'round');
    dot.setAttribute('r', 4.5); dot.setAttribute('fill', C.ink); dot.setAttribute('opacity', 0);
    g.append(base, lit, dot); svg.append(g);
    paths[p + '>' + c] = { p, c, base, lit, dot, len: 0, fade: new Spring(0, 0.5, 1) };
  }
  let W = 0, H = 0, narrow = false, now = 0, waves = [], wave_n = 0, log = [];

  function layout() {
    W = wrap.clientWidth; H = wrap.clientHeight; narrow = W < 560; wrap.classList.toggle('narrow', narrow);
    const cw = narrow ? Math.min(116, (W - 40) / 3) : Math.min(220, W * 0.17), ch = narrow ? 78 : 98;
    const pos = {};
    for (const id of IDS) {
      let [col, row] = GRID[id];
      let x, y;
      if (narrow) { const rx = (W - 3 * cw) / 4; x = rx + row * (cw + rx); y = H * 0.11 + col * (H * 0.215); }
      else { const gx = (W - 4 * cw) / 5; x = gx + col * (cw + gx); y = H * 0.5 + (row - 1) * (ch + 58) - ch / 2; }
      pos[id] = { x, y, w: cw, h: ch };
      const el = cell[id].el; el.style.left = x + 'px'; el.style.top = y + 'px'; el.style.width = cw + 'px'; el.style.height = (CELLS[id].in ? ch : ch - (narrow ? 4 : 18)) + 'px';
      if (narrow) { el.style.padding = '9px 10px 0'; el.querySelector('.nm i').style.display = 'none'; } else { el.style.padding = ''; el.querySelector('.nm i').style.display = ''; }
    }
    for (const k in paths) {
      const P = paths[k], a = pos[P.p], b = pos[P.c];
      let d;
      if (narrow) { const x0 = a.x + a.w / 2, y0 = a.y + (CELLS[P.p].in ? a.h : a.h - 4), x1 = b.x + b.w / 2, y1 = b.y, m = (y1 - y0) * 0.5; d = `M${x0} ${y0} C${x0} ${y0 + m} ${x1} ${y1 - m} ${x1} ${y1}`; }
      else { const hh = (id) => (CELLS[id].in ? ch : ch - 18) / 2, x0 = a.x + a.w, y0 = a.y + hh(P.p), x1 = b.x, y1 = b.y + hh(P.c), m = (x1 - x0) * 0.5; d = `M${x0} ${y0} C${x0 + m} ${y0} ${x1 - m} ${y1} ${x1} ${y1}`; }
      P.base.setAttribute('d', d); P.lit.setAttribute('d', d); P.len = P.base.getTotalLength();
    }
    paint();
  }

  // a wave: when each cell hears of the change. An input hears at once; any other cell hears when the last of its
  // changed inputs' pulses arrives. Cells the change cannot reach never hear.
  function emit(src) {
    const t0 = now, T = { [src]: t0 }, snap = compute(inputs);
    for (const id of ['tp', 'fp', 'pos', 'post']) {
      const ds = CELLS[id].deps.filter((p) => T[p] !== undefined);
      if (ds.length) T[id] = Math.max(...ds.map((p) => T[p] + paths[p + '>' + id].len / SPEED));
    }
    const w = { n: ++wave_n, t0, T, snap, done: new Set([src]) };
    waves.push(w); log.push([w.n, src, t0]);
    for (const id in T) if (id !== src) cell[id].stale.to(1);
    sched.wake();
  }

  function advance(dt) {
    now += dt; let busy = false;
    for (const w of waves) {
      for (const id in w.T) {
        if (w.done.has(id) || now < w.T[id]) continue;
        w.done.add(id); log.push([w.n, id, w.T[id]]);
        const c = cell[id]; c.value = w.snap[id]; c.wave = w.n; c.shown.to(rnd(id, w.snap[id])); c.bump.v = 3;
        // hollow until the newest wave that will reach this cell has arrived
        if (!waves.some((v) => v.T[id] !== undefined && !v.done.has(id))) c.stale.to(0);
        for (const [p, ch] of EDGES) if (ch === id && w.T[p] !== undefined) paths[p + '>' + ch].fade.to(0);
      }
    }
    waves = waves.filter((w) => w.done.size < Object.keys(w.T).length || now < Math.max(...Object.values(w.T)) + 0.05);
    busy = waves.length > 0;
    for (const id of IDS) { const c = cell[id]; busy = c.shown.step(dt) || busy; busy = c.stale.step(dt) || busy; busy = c.bump.step(dt) || busy; if (!c.shown.busy()) c.shown.snap(rnd(id, c.value)); }
    for (const k in paths) busy = paths[k].fade.step(dt) || busy;
    return busy;
  }

  function paint() {
    for (const id of IDS) {
      const c = cell[id], st = Math.max(0, Math.min(1, c.stale.x));
      c.odo.set(Math.max(0, c.shown.x));
      c.hollow.style.opacity = st.toFixed(3);
      c.el.style.background = `rgba(255,255,255,${(1 - 0.85 * st).toFixed(3)})`;
      c.el.style.boxShadow = `0 0 0 .75px rgba(26,27,31,${(0.12 * (1 - st)).toFixed(3)}),0 2px 6px rgba(26,27,31,${(0.06 * (1 - st)).toFixed(3)})`;
      c.el.style.transform = `scale(${(1 + 0.012 * c.bump.x).toFixed(4)})`;
      if (c.bar) c.bar.style.width = inputs[id] + '%';
    }
    // pulses: a dot travelling each line, inking it behind; the ink fades once the cell has heard
    for (const k in paths) {
      const P = paths[k]; let pulse = null;
      for (const w of waves) if (w.T[P.p] !== undefined && w.T[P.c] !== undefined) { const u = (now - w.T[P.p]) * SPEED / P.len; if (u >= 0 && u <= 1) pulse = u; else if (u > 1 && now < w.T[P.c]) pulse = 1; }
      if (pulse !== null) { P.fade.snap(1); const pt = P.base.getPointAtLength(pulse * P.len); P.dot.setAttribute('cx', pt.x); P.dot.setAttribute('cy', pt.y); P.dot.setAttribute('opacity', 1); P.lit.setAttribute('stroke-dasharray', `${pulse * P.len} ${P.len}`); }
      else { P.dot.setAttribute('opacity', 0); P.lit.setAttribute('stroke-dasharray', `${P.len} ${P.len}`); }
      P.lit.setAttribute('opacity', Math.max(0, P.fade.x).toFixed(3));
    }
  }

  // scrub an input: drag sideways; a new wave leaves at most every 160 ms, and once more on release
  let drag = null, last_emit = -1;
  for (const id of IDS) if (CELLS[id].in) cell[id].el.addEventListener('pointerdown', (e) => { hold = false; drag = { id, x0: e.clientX, v0: inputs[id] }; wrap.setPointerCapture(e.pointerId); });
  wrap.addEventListener('pointermove', (e) => {
    if (!drag) return; const D = CELLS[drag.id];
    const v = Math.max(D.lo, Math.min(D.hi, Math.round(drag.v0 + (e.clientX - drag.x0) / (narrow ? 5 : 4))));
    if (v === inputs[drag.id]) return;
    set_input(drag.id, v, now - last_emit > 0.16);
  });
  wrap.addEventListener('pointerup', () => { if (drag && cell[drag.id].wave_pending) emit(drag.id); drag = null; });
  function set_input(id, v, send = true) {
    inputs[id] = v; const c = cell[id]; c.value = v; c.shown.to(v);
    if (send) { emit(id); last_emit = now; c.wave_pending = false; } else c.wave_pending = true;
    sched.wake();
  }
  let hold = false;   // for stills: the clock only moves when asked
  const sched = scheduler((dt) => { if (hold) return false; const b = advance(dt); paint(); return b || !!drag; });
  layout(); addEventListener('resize', layout);

  // run the sheet forward without the clock
  function settle() { for (let i = 0; i < 2400 && (waves.length || IDS.some((id) => cell[id].shown.busy() || cell[id].stale.busy())); i++) advance(1 / 60); paint(); }

  return {
    visible: (v) => sched.set_visible(v), resize: layout,
    demo() { set_input('prior', 10); },
    change(id, v, still = false) { hold = still; set_input(id, v); },
    at(t) { const end = now + t; while (now < end) advance(1 / 120); paint(); },
    async accept() {
      // several changes, one at a time and overlapping: every update after its inputs', only reachable cells update,
      // and the sheet ends at direct computation
      const reach = (src) => { const r = new Set([src]); for (const [p, c] of EDGES) if (r.has(p)) r.add(c); for (const [p, c] of EDGES) if (r.has(p)) r.add(c); return r; };
      const plan = [['prior', 10], ['fpr', 2], ['sens', 70], ['prior', 25], ['prior', 3]];
      let order_ok = true, reach_ok = true, waves_n = 0;
      log = [];
      plan.forEach(([id, v], i) => { set_input(id, v); if (i === 3) { for (let k = 0; k < 20; k++) advance(1 / 60); } else settle(); });
      settle();
      const by = {}; for (const [n, id, t] of log) (by[n] = by[n] || []).push([id, t]);
      for (const n in by) {
        waves_n++;
        // each cell updates strictly after every one of its inputs that this wave changed, and in the log after them
        const k_of = new Map(by[n].map(([id, t], k) => [id, k])), t_of = new Map(by[n]);
        for (const [p, c] of EDGES) if (k_of.has(p) && k_of.has(c) && (k_of.get(p) > k_of.get(c) || !(t_of.get(p) < t_of.get(c)))) order_ok = false;
        for (const [id] of by[n].slice(1)) if (!(CELLS[id].deps || []).some((p) => k_of.has(p))) order_ok = false;
        const src = by[n][0][0], r = reach(src);
        if (by[n].length !== r.size || by[n].some(([id]) => !r.has(id))) reach_ok = false;
      }
      const truth = compute(inputs);
      let worst = 0; for (const id of IDS) worst = Math.max(worst, Math.abs(cell[id].value - truth[id]), Math.abs(cell[id].shown.x - rnd(id, truth[id])));
      // what the page shows is the true value at its places
      const shown_ok = IDS.every((id) => cell[id].odo.reading() === truth[id].toFixed(cell[id].odo.places));
      const pass = order_ok && reach_ok && worst < 1e-9 && shown_ok;
      // leave the sheet where it began
      for (const id in inputs) inputs[id] = CELLS[id].v;
      const t0 = compute(inputs); for (const id of IDS) { cell[id].value = t0[id]; cell[id].shown.snap(rnd(id, t0[id])); cell[id].stale.snap(0); } paint();
      return { pass, value: zh ? `${waves_n} 道波：拓扑序 ${order_ok ? '✓' : '✗'}，只更新受影响的格子 ${reach_ok ? '✓' : '✗'}；终值误差 ${worst.toExponential(0)}，显示 ${shown_ok ? '✓' : '✗'}` : `${waves_n} waves: topological order ${order_ok ? '✓' : '✗'}, only affected cells ${reach_ok ? '✓' : '✗'}; final error ${worst.toExponential(0)}, display ${shown_ok ? '✓' : '✗'}` };
    },
  };
}
