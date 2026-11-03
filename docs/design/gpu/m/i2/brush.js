// Brushing between formula and figure. Every symbol in a formula is the name of one thing in its figure, and they
// share a colour. Touch a symbol and its thing is washed in that colour while everything else steps back a little;
// touch the thing and its symbol answers. The slope triangle is m, the height of the point is y, the run along the
// axis is x, the step where the line meets the axis is b. "This is that", in both directions.
// As a library primitive: brush(formula, figure, pairs) for any formula drawn next to its picture.
import { scheduler } from '../../lib/gl.js';
import { Spring } from '../../lib/ui.js';
import { SANS, SERIF, C, css_once, rgba } from './_formula.js';

export const meta = {
  id: 'brush',
  name: { zh: '公式与图互指', en: 'Brushing between formula and figure' },
  means: { zh: '公式里每个符号都是图里某个东西的名字：碰一下符号，它的东西就染上同样的颜色，别的稍稍退后；碰图里的东西，符号也会回应。', en: 'Each symbol in a formula names one thing in its figure: touch the symbol and its thing washes in the same colour while the rest steps back; touch the thing and its symbol answers.' },
  test: { zh: '符号与图形元素一一对应（双向）；每次只有被碰的那一对被强调', en: 'Symbols and figure elements correspond one to one, both ways; only the touched pair is emphasised' },
  wide: true,
};

// the four nouns of y = mx + b and their pigments
const KEYS = { y: 'violet', m: 'teal', x: 'cobalt', b: 'ochre' };
const M = 0.5, B = 1, PX = 3;          // the line y = 0.5x + 1 and a point on it at x = 3
const NS = 'http://www.w3.org/2000/svg';

css_once('bx-css', `
.bx-wrap{position:absolute;inset:0;background:var(--paper);overflow:hidden;user-select:none;-webkit-user-select:none;touch-action:manipulation}
.bx-f{position:absolute;z-index:0;font-family:${SERIF};color:var(--ink);white-space:nowrap;line-height:1}
.bx-f span{display:inline-block;position:relative}
.bx-f .s{font-style:italic;cursor:pointer;padding:0 .06em}
.bx-f .s[data-k=x]{margin-left:.1em}
.bx-f .s::before{content:'';position:absolute;left:-.04em;right:-.02em;top:.02em;bottom:-.12em;border-radius:.16em;background:var(--wash,transparent);opacity:var(--wo,0);z-index:-1}
.bx-f .s::after{content:'';position:absolute;left:-.25em;right:-.25em;top:-.3em;bottom:-.35em}
.bx-f .o{margin:0 .22em;color:var(--ink-2)}
.bx-wrap svg{position:absolute;left:0;top:0;overflow:visible}
.bx-wrap svg text{font-family:${SANS};}
.bx-wrap svg .it{font-family:${SERIF};font-style:italic}
`);

export function make({ stage, canvas, hud, lang }) {
  const zh = lang === 'zh';
  canvas.style.display = 'none';
  const wrap = document.createElement('div'); wrap.className = 'bx-wrap'; stage.append(wrap);
  const f = document.createElement('div'); f.className = 'bx-f'; wrap.append(f);
  // y = m x + b
  f.innerHTML = `<span class="s" data-k="y">y</span><span class="o">=</span><span class="s" data-k="m">m</span><span class="s" data-k="x">x</span><span class="o">+</span><span class="s" data-k="b">b</span>`;
  const sym = {}; for (const el of f.querySelectorAll('.s')) { sym[el.dataset.k] = el; el.style.color = C[KEYS[el.dataset.k]]; el.style.setProperty('--wash', rgba(C[KEYS[el.dataset.k]], 0.16)); }
  const ops = [...f.querySelectorAll('.o')];
  const svg = document.createElementNS(NS, 'svg'); wrap.append(svg);
  const em = Object.fromEntries(Object.keys(KEYS).map((k) => [k, new Spring(0, 0.28, 1)]));
  const back = new Spring(0, 0.3, 1);   // how far the rest has stepped back
  let brushed = null, G = null, W = 0, H = 0, narrow = false;

  function layout() {
    W = wrap.clientWidth; H = wrap.clientHeight; narrow = W < 560;
    const fs = narrow ? 50 : Math.min(76, W * 0.065);
    f.style.fontSize = fs + 'px';
    // the figure's box, and the formula beside it (or above it on a phone)
    let box;
    if (narrow) { box = { x: 28, y: H * 0.37, w: W - 52, h: Math.min(H * 0.5, (W - 52) * 0.92) }; f.style.left = (W - f.offsetWidth) / 2 + 'px'; f.style.top = H * 0.2 + 'px'; }
    else { const fw = W * 0.5; box = { x: W * 0.47, y: H * 0.13, w: Math.min(W * 0.46, H * 0.74 * 6.4 / 5), h: H * 0.74 }; f.style.left = (W * 0.24 - f.offsetWidth / 2) + 'px'; f.style.top = (H / 2 - fs * 0.55) + 'px'; }
    // math box: x from −0.9 to 5.5, y from −0.8 to 4.2, equal scale
    const xr = [-0.9, 5.5], yr = [-0.8, 4.2], s = Math.min(box.w / (xr[1] - xr[0]), box.h / (yr[1] - yr[0]));
    const ox = box.x + (box.w - s * (xr[1] - xr[0])) / 2 - xr[0] * s, oy = box.y + (box.h - s * (yr[1] - yr[0])) / 2 + yr[1] * s;
    G = { s, X: (v) => ox + v * s, Y: (v) => oy - v * s, xr, yr };
    build();
  }

  const el = (tag, at, parent = svg) => { const e = document.createElementNS(NS, tag); for (const k in at) e.setAttribute(k, at[k]); parent.append(e); return e; };
  let parts = {}, scaffold = [];
  function build() {
    svg.innerHTML = ''; svg.setAttribute('width', W); svg.setAttribute('height', H);
    const { X, Y, xr, yr } = G, ink = (a) => `rgba(26,27,31,${a})`;
    scaffold = [];
    const sc = el('g', {}); scaffold.push(sc);
    // grid and axes: scaffolding in graphite
    for (let v = Math.ceil(xr[0]); v <= xr[1]; v++) el('line', { x1: X(v), y1: Y(yr[0]), x2: X(v), y2: Y(yr[1]), stroke: ink(v === 0 ? 0 : 0.07) }, sc);
    for (let v = Math.ceil(yr[0]); v <= yr[1]; v++) el('line', { x1: X(xr[0]), y1: Y(v), x2: X(xr[1]), y2: Y(v), stroke: ink(v === 0 ? 0 : 0.07) }, sc);
    el('line', { x1: X(xr[0]), y1: Y(0), x2: X(xr[1]), y2: Y(0), stroke: ink(0.5), 'stroke-width': 1.2 }, sc);
    el('line', { x1: X(0), y1: Y(yr[0]), x2: X(0), y2: Y(yr[1]), stroke: ink(0.5), 'stroke-width': 1.2 }, sc);
    el('path', { d: `M${X(xr[1]) - 7} ${Y(0) - 4} L${X(xr[1])} ${Y(0)} L${X(xr[1]) - 7} ${Y(0) + 4}`, fill: 'none', stroke: ink(0.5), 'stroke-width': 1.2 }, sc);
    el('path', { d: `M${X(0) - 4} ${Y(yr[1]) + 7} L${X(0)} ${Y(yr[1])} L${X(0) + 4} ${Y(yr[1]) + 7}`, fill: 'none', stroke: ink(0.5), 'stroke-width': 1.2 }, sc);
    for (let v = 1; v <= 5; v++) { el('line', { x1: X(v), y1: Y(0) - 3, x2: X(v), y2: Y(0) + 3, stroke: ink(0.5) }, sc); const t = el('text', { x: X(v), y: Y(0) + 20, 'text-anchor': 'middle', 'font-size': 12, fill: '#62666d' }, sc); t.textContent = v; }
    for (let v = 1; v <= 4; v++) { el('line', { x1: X(0) - 3, y1: Y(v), x2: X(0) + 3, y2: Y(v), stroke: ink(0.5) }, sc); const t = el('text', { x: X(0) - 13, y: Y(v) + 4, 'text-anchor': 'end', 'font-size': 12, fill: '#62666d' }, sc); t.textContent = v; }
    // the line itself
    const ln = el('g', {}); scaffold.push(ln);
    el('line', { x1: X(xr[0]), y1: Y(M * xr[0] + B), x2: X(xr[1]), y2: Y(M * xr[1] + B), stroke: C.ink, 'stroke-width': 2, 'stroke-linecap': 'round' }, ln);
    // the four things. Each: a wash (wide, translucent), the mark itself, its small name, and a generous hit area.
    const py = M * PX + B;
    const thing = (k, d, o = {}) => {
      const g = el('g', { 'data-k': k, class: 'thing', style: 'cursor:pointer' }), col = C[KEYS[k]];
      const wash = o.area ? el('path', { d, fill: rgba(col, 0.2), stroke: 'none', opacity: 0 }, g) : el('path', { d, fill: 'none', stroke: rgba(col, 0.2), 'stroke-width': 18, 'stroke-linecap': 'round', opacity: 0 }, g);
      const mark = el('path', { d: o.mark || d, fill: o.area ? 'none' : 'none', stroke: col, 'stroke-width': 2.5, 'stroke-linecap': 'round', 'stroke-linejoin': 'round', 'stroke-dasharray': o.dash || 'none' }, g);
      const hit = el('path', { d: o.hit || d, fill: o.area ? 'rgba(0,0,0,0)' : 'none', stroke: 'rgba(0,0,0,0)', 'stroke-width': narrow ? 34 : 24, 'pointer-events': o.area ? 'all' : 'stroke' }, g);
      const name = el('text', { x: o.at[0], y: o.at[1], 'text-anchor': o.anchor || 'middle', class: 'it', 'font-size': narrow ? 19 : 21, fill: col }, g); name.textContent = o.name || k;
      return { g, wash, mark, name, extra: o.extra ? o.extra(g) : [] };
    };
    parts = {
      // x: how far along: the run from the origin to the point's foot
      x: thing('x', `M${X(0)} ${Y(0)} L${X(PX)} ${Y(0)}`, { at: [X(PX / 2), Y(0) + 40] }),
      // y: how high: from the foot up to the point
      y: thing('y', `M${X(PX)} ${Y(0)} L${X(PX)} ${Y(py)}`, { at: [X(PX) + 14, Y(py / 2) + 7], anchor: 'start' }),
      // m: the slope: one step right, m steps up
      m: thing('m', `M${X(1)} ${Y(M + B)} L${X(2)} ${Y(M + B)} L${X(2)} ${Y(2 * M + B)} Z`, { area: true, mark: `M${X(1)} ${Y(M + B)} L${X(2)} ${Y(M + B)} L${X(2)} ${Y(2 * M + B)}`, at: [X(2) + 10, Y(M * 1.5 + B) + 7], anchor: 'start',
        hit: `M${X(1) - 10} ${Y(M + B) + 12} L${X(2) + 12} ${Y(M + B) + 12} L${X(2) + 12} ${Y(2 * M + B) - 10} Z`,
        extra: (g) => { const t = el('text', { x: X(1.5), y: Y(M + B) + 20, 'text-anchor': 'middle', 'font-size': 13, fill: C.teal }, g); t.textContent = '1'; return [t]; } }),
      // b: where the line meets the y axis: the step from 0 up to b
      b: thing('b', `M${X(0)} ${Y(0)} L${X(0)} ${Y(B)}`, { at: [X(0) - 16, Y(B / 2) + 7], anchor: 'end',
        extra: (g) => [el('circle', { cx: X(0), cy: Y(B), r: 5, fill: C.ochre }, g)] }),
    };
    // the point the run and the height belong to
    const pt = el('g', {}); scaffold.push(pt);
    el('circle', { cx: X(PX), cy: Y(py), r: 5.5, fill: C.ink }, pt);
    for (const k in parts) {
      const g = parts[k].g;
      g.addEventListener('pointerenter', (e) => { if (e.pointerType === 'mouse') brush(k); });
      g.addEventListener('pointerleave', (e) => { if (e.pointerType === 'mouse') brush(null); });
      g.addEventListener('pointerdown', (e) => { e.stopPropagation(); brush(brushed === k && e.pointerType !== 'mouse' ? null : k); });
    }
    paint();
  }
  for (const k in sym) {
    sym[k].addEventListener('pointerenter', (e) => { if (e.pointerType === 'mouse') brush(k); });
    sym[k].addEventListener('pointerleave', (e) => { if (e.pointerType === 'mouse') brush(null); });
    sym[k].addEventListener('pointerdown', (e) => { e.stopPropagation(); brush(brushed === k && e.pointerType !== 'mouse' ? null : k); });
  }
  wrap.addEventListener('pointerdown', () => brush(null));

  function brush(k) { brushed = k; for (const q in em) em[q].to(q === k ? 1 : 0); back.to(k ? 1 : 0); sched.wake(); }

  // what each pair looks like: the brushed pair at full wash, the rest a little back
  const RECEDE = 0.38;
  function level(k) { return 1 - RECEDE * Math.max(0, back.x) * (1 - Math.max(0, Math.min(1, em[k].x))); }
  function paint() {
    for (const k in sym) {
      const e = Math.max(0, Math.min(1, em[k].x)), lv = level(k);
      sym[k].style.opacity = lv.toFixed(3); sym[k].style.setProperty('--wo', e.toFixed(3));
      const p = parts[k]; if (!p) continue;
      p.g.setAttribute('opacity', lv.toFixed(3)); p.wash.setAttribute('opacity', e.toFixed(3));
      p.mark.setAttribute('stroke-width', (2.5 + 1.5 * e).toFixed(2));
      p.name.setAttribute('font-weight', e > 0.5 ? 600 : 400);
    }
    const sl = (1 - RECEDE * 0.6 * Math.max(0, back.x)).toFixed(3);
    for (const s of scaffold) s.setAttribute('opacity', sl);
    for (const o of ops) o.style.opacity = sl;
  }
  const sched = scheduler((dt) => { let b = back.step(dt); for (const k in em) b = em[k].step(dt) || b; if (!b) { back.snap(back.target); for (const k in em) em[k].snap(em[k].target); } paint(); return b; });
  layout();
  addEventListener('resize', () => layout());

  // what is emphasised right now, read back from the page itself
  function emphasised() {
    const out = [];
    for (const k in sym) if (parseFloat(getComputedStyle(sym[k]).getPropertyValue('--wo')) > 0.5 && parseFloat(sym[k].style.opacity) > 0.99) out.push('sym:' + k);
    for (const g of svg.querySelectorAll('[data-k]')) { const w = g.querySelector('path'); if (parseFloat(w.getAttribute('opacity')) > 0.5 && parseFloat(g.getAttribute('opacity')) > 0.99) out.push('fig:' + g.dataset.k); }
    return out.sort();
  }
  function settle() { for (let i = 0; i < 600 && (back.busy() || Object.values(em).some((s) => s.busy())); i++) { back.step(1 / 60); for (const k in em) em[k].step(1 / 60); } back.snap(back.target); for (const k in em) em[k].snap(em[k].target); paint(); }

  return {
    visible: (v) => sched.set_visible(v), resize: layout,
    demo() { brush('m'); },
    set(k) { brush(k); settle(); },
    async accept() {
      // bijection: each symbol names exactly one figure element and each element exactly one symbol
      const syms = [...f.querySelectorAll('.s[data-k]')].map((s) => s.dataset.k), figs = [...svg.querySelectorAll('[data-k]')].map((g) => g.dataset.k);
      const bij = syms.length === figs.length && syms.every((k) => figs.filter((q) => q === k).length === 1) && figs.every((k) => syms.filter((q) => q === k).length === 1);
      // brushing, from either side, by real pointer events: only that pair is emphasised, everything else is back
      let pairs_ok = 0, trials = 0;
      const fire = (target, type) => target.dispatchEvent(new PointerEvent(type, { bubbles: true, pointerType: 'mouse' }));
      for (const k of syms) for (const side of ['sym', 'fig']) {
        trials++;
        const t = side === 'sym' ? sym[k] : parts[k].g;
        fire(t, 'pointerenter'); settle();
        const got = emphasised(), want = ['fig:' + k, 'sym:' + k].sort();
        const others = syms.filter((q) => q !== k).every((q) => parseFloat(sym[q].style.opacity) < 0.7 && parseFloat(parts[q].g.getAttribute('opacity')) < 0.7);
        if (JSON.stringify(got) === JSON.stringify(want) && others) pairs_ok++;
        fire(t, 'pointerleave'); settle();
      }
      const rest = emphasised().length === 0;
      return { pass: bij && pairs_ok === trials && rest, value: zh ? `${syms.length} 个符号 ↔ ${figs.length} 个元素，一一对应 ${bij ? '✓' : '✗'}；${pairs_ok}/${trials} 次只强调那一对` : `${syms.length} symbols ↔ ${figs.length} elements, one to one ${bij ? '✓' : '✗'}; ${pairs_ok}/${trials} brushes emphasise only their pair` };
    },
  };
}
