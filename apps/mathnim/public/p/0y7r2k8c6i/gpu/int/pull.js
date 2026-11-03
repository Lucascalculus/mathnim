// A4 · Pull a noun out. Words and things share names and colours. Drag a coloured word out of the sentence: it lifts
// off the paper as a chip and leaves a hollow where it was. As it nears its own thing in the figure, the thing
// answers (it takes the word's colour) and a magnet takes over; let go and the chip docks there as its label.
// Tap a docked label and it flies home. Drag a thing into the text and its name lights up. "This is that."
import { scheduler, Spring, Spring2, css } from '../lib/ui.js';

export const meta = {
  id: 'pull',
  name: { zh: '把名词拿出来', en: 'Pull a noun out' },
  means: { zh: '文字和图里的东西是同一个名字、同一种颜色：把词拖出来，它会找到自己的东西；把东西拖进文字，它的名字会亮。', en: 'A word and its thing share a name and a colour: drag the word out and it finds its thing; drag the thing into the text and its name lights up.' },
  test: { zh: '每个名词恰好对应一个东西；词回到原处后，排版与原来逐像素一致', en: 'Each noun has exactly one thing; a word sent home leaves the layout exactly as it was' },
};

const TEXT = {
  zh: [['让', 0], ['卡车', 'cart'], ['停在', 0], ['目标', 'goal'], ['那里，', 0], ['但不能越过', 0], ['墙', 'wall'], ['。', 0]],
  en: [['Make the ', 0], ['cart', 'cart'], [' stop at the ', 0], ['goal', 'goal'], [', but never past the ', 0], ['wall', 'wall'], ['.', 0]],
};
const PIG = { cart: 'cobalt', goal: 'viridian', wall: 'ochre' };

const CSS = `
.p-wrap{position:absolute;inset:0;background:var(--paper);overflow:hidden;touch-action:none;user-select:none;-webkit-user-select:none}
.p-text{position:absolute;left:50%;transform:translateX(-50%);width:min(640px, calc(100% - 40px));font-family:var(--serif);font-size:24px;line-height:1.7;color:var(--ink)}
.p-w{position:relative;display:inline-block;white-space:pre}
.p-n{font-weight:600;cursor:grab;border-radius:6px}
.p-n.cobalt{color:var(--cobalt)}.p-n.viridian{color:var(--viridian)}.p-n.ochre{color:var(--ochre)}
.p-n .ghost{position:absolute;left:-2px;right:-2px;bottom:3px;height:0;border-bottom:1.5px dashed currentColor;opacity:0;transition:opacity .2s}
.p-n.out .t{opacity:0}.p-n.out .ghost{opacity:.7}
.p-n.lit{background:color-mix(in srgb, currentColor 14%, transparent)}
.p-chip{position:absolute;left:0;top:0;padding:4px 10px 5px;border-radius:8px;background:#fff;font-family:var(--serif);font-size:24px;font-weight:600;line-height:1.3;white-space:nowrap;
  box-shadow:0 0 0 .75px rgba(26,27,31,.12),0 1px 2px rgba(26,27,31,.08);will-change:transform;pointer-events:auto;cursor:grab;transform-origin:50% 60%}
.p-chip.cobalt{color:var(--cobalt)}.p-chip.viridian{color:var(--viridian)}.p-chip.ochre{color:var(--ochre)}
.p-fig{position:absolute;left:0;right:0}
.p-fig svg{display:block;width:100%;height:100%;overflow:visible}
`;

// the figure: a side view, the track, the cart, the goal, the wall (CSS px in a 900 × 300 box)
const FIG = `<svg viewBox="0 0 900 300" preserveAspectRatio="xMidYMid meet">
  <defs>
    <linearGradient id="p-plaster" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffffff"/><stop offset="1" stop-color="#ebe8e2"/></linearGradient>
    <filter id="p-soft" x="-20%" y="-20%" width="140%" height="160%"><feGaussianBlur stdDeviation="6"/></filter>
  </defs>
  <ellipse cx="450" cy="236" rx="420" ry="10" fill="#1a1b1f" opacity=".06" filter="url(#p-soft)"/>
  <rect x="40" y="222" width="760" height="10" rx="3" fill="url(#p-plaster)" stroke="rgba(26,27,31,.18)"/>
  ${Array.from({ length: 16 }, (_, i) => `<line x1="${70 + i * 46}" y1="222" x2="${70 + i * 46}" y2="${i % 5 ? 216 : 212}" stroke="rgba(26,27,31,.35)" stroke-width="1"/>`).join('')}
  <g data-id="goal" class="part"><line x1="640" y1="232" x2="640" y2="120" stroke="#13876a" stroke-width="2" stroke-dasharray="1 0"/><path d="M640 120 l30 10 -30 10z" class="fill" fill="#fff" stroke="#13876a" stroke-width="1.6"/></g>
  <g data-id="wall" class="part"><rect x="800" y="60" width="26" height="172" rx="3" class="fill" fill="url(#p-plaster)" stroke="rgba(26,27,31,.28)"/><rect x="800" y="60" width="26" height="172" rx="3" class="wash" fill="#c8861a" opacity="0"/></g>
  <g data-id="cart" class="part"><ellipse cx="250" cy="230" rx="78" ry="6" fill="#1a1b1f" opacity=".12" filter="url(#p-soft)"/><rect x="170" y="150" width="160" height="62" rx="9" class="fill" fill="url(#p-plaster)" stroke="rgba(26,27,31,.28)"/><rect x="170" y="150" width="160" height="62" rx="9" class="wash" fill="#2f5bd2" opacity="0"/>
    <circle cx="205" cy="214" r="12" fill="#fff" stroke="rgba(26,27,31,.38)"/><circle cx="295" cy="214" r="12" fill="#fff" stroke="rgba(26,27,31,.38)"/></g>
</svg>`;
// where each thing's label docks (in the 900 × 300 box), and the part's hit box
// the top of each thing (a label docks just above it)
const DOCK = { cart: [250, 150], goal: [672, 118], wall: [813, 60] };

export function make({ stage, canvas, hud, lang }) {
  canvas.style.display = 'none';
  css('p-css', CSS);
  const wrap = document.createElement('div'); wrap.className = 'p-wrap';
  wrap.innerHTML = `<div class="p-text"></div><div class="p-fig">${FIG}</div>`;
  stage.append(wrap);
  const text = wrap.querySelector('.p-text'), fig = wrap.querySelector('.p-fig'), svg = fig.querySelector('svg');
  const words = {};
  let group = null;
  for (const [t, id] of TEXT[lang]) {
    const s = document.createElement('span'); s.className = 'p-w' + (id ? ' p-n ' + PIG[id] : '');
    s.innerHTML = id ? `<span class="t">${t}</span><span class="ghost"></span>` : t;
    // a punctuation mark never starts a line: it travels with the word before it
    if (/^[。，、；：？！.,;:?!]/.test(t) && group) { group.append(s); continue; }
    group = document.createElement('span'); group.style.whiteSpace = 'nowrap'; group.append(s); text.append(group);
    if (id) { s.dataset.id = id; words[id] = { el: s, t }; }
  }
  const parts = {}; for (const g of svg.querySelectorAll('.part')) parts[g.dataset.id] = { g, wash: g.querySelector('.wash'), fill: g.querySelector('.fill'), glow: new Spring(0, 0.3, 1) };
  const chips = {};
  let VB = [0, 0, 900, 300];
  function layout() {
    const W = wrap.clientWidth, H = wrap.clientHeight, narrow = W < 560;
    text.style.fontSize = (narrow ? 22 : 24) + 'px';
    // the figure is as wide as the page allows; text and figure sit together in the middle of the stage
    // on a phone the empty start of the track is cropped so the things are larger
    VB = narrow ? [150, 20, 700, 240] : [0, 0, 900, 300]; svg.setAttribute('viewBox', VB.join(' '));
    const fh = Math.min(H * 0.55, (W - 8) * VB[3] / VB[2]), gap = narrow ? 64 : 44, th = text.offsetHeight;
    const top = Math.max(32, (H - th - gap - fh) / 2);
    text.style.top = top + 'px';
    fig.style.top = (top + th + gap) + 'px'; fig.style.height = fh + 'px';
    fig.style.left = (narrow ? 4 : 16) + 'px'; fig.style.right = (narrow ? 4 : 16) + 'px';
  }
  // figure box coordinates → wrap coordinates
  function from_fig([x, y]) {
    const r = svg.getBoundingClientRect(), w = wrap.getBoundingClientRect();
    const s = Math.min(r.width / VB[2], r.height / VB[3]), ox = r.left + (r.width - VB[2] * s) / 2 - w.left, oy = r.top + (r.height - VB[3] * s) / 2 - w.top;
    return [ox + (x - VB[0]) * s, oy + (y - VB[1]) * s];
  }
  function home(id) { const r = words[id].el.getBoundingClientRect(), w = wrap.getBoundingClientRect(); return [r.left - w.left + r.width / 2, r.top - w.top + r.height / 2]; }
  function chip(id) {
    if (chips[id]) return chips[id];
    const el = document.createElement('div'); el.className = 'p-chip ' + PIG[id]; el.textContent = words[id].t; wrap.append(el);
    const c = { id, el, pos: new Spring2(0, 0, 0.2, 0.86), lift: new Spring(0, 0.28, 0.7), state: 'home', w: 0, h: 0 };
    el.addEventListener('pointerdown', (e) => { e.stopPropagation(); grab(id, e); });
    chips[id] = c; return c;
  }
  let drag = null;
  function grab(id, e) {
    const c = chip(id), [hx, hy] = c.state === 'home' ? home(id) : [c.pos.x, c.pos.y];
    if (c.state === 'home') { c.pos.a.snap(hx); c.pos.b.snap(hy); }
    drag = { id, x0: e.clientX, y0: e.clientY, ox: hx, oy: hy, moved: false, from: c.state };
    wrap.setPointerCapture(e.pointerId);
  }
  text.addEventListener('pointerdown', (e) => { const n = e.target.closest('.p-n'); if (n && chips[n.dataset.id]?.state !== 'docked') grab(n.dataset.id, e); });
  // dragging a thing into the text: its name lights up
  let thing_drag = null;
  svg.addEventListener('pointerdown', (e) => { const g = e.target.closest('.part'); if (!g) return; thing_drag = { id: g.dataset.id }; wrap.setPointerCapture(e.pointerId); });
  wrap.addEventListener('pointermove', (e) => {
    const w = wrap.getBoundingClientRect(), x = e.clientX - w.left, y = e.clientY - w.top;
    if (thing_drag) { const r = text.getBoundingClientRect(); const over = e.clientY < r.bottom + 30; words[thing_drag.id].el.classList.toggle('lit', over); parts[thing_drag.id].glow.to(1); sched.wake(); return; }
    if (!drag) return;
    const c = chip(drag.id);
    if (!drag.moved && Math.hypot(e.clientX - drag.x0, e.clientY - drag.y0) > 4) { drag.moved = true; c.state = 'lifted'; words[drag.id].el.classList.add('out'); c.lift.to(1); }
    if (!drag.moved) return;
    let tx = drag.ox + (e.clientX - drag.x0), ty = drag.oy + (e.clientY - drag.y0);
    // near its own thing, the thing answers and a magnet takes over
    const [dx, dy] = dock_at(drag.id), d = Math.hypot(tx - dx, ty - dy), R = 150;
    const pull = Math.max(0, 1 - d / R); const m = pull * pull * 0.85;
    tx += (dx - tx) * m; ty += (dy - ty) * m;
    parts[drag.id].glow.to(pull > 0 ? 0.35 + 0.65 * pull : 0);
    c.near = d < 70;
    c.pos.to(tx, ty); sched.wake();
  });
  wrap.addEventListener('pointerup', () => {
    if (thing_drag) { for (const k in words) words[k].el.classList.remove('lit'); parts[thing_drag.id].glow.to(0); thing_drag = null; sched.wake(); return; }
    if (!drag) return;
    const c = chip(drag.id);
    if (!drag.moved) { if (drag.from === 'docked') send_home(drag.id); drag = null; return; }
    if (c.near) dock(drag.id); else send_home(drag.id);
    drag = null; sched.wake(1200);
  });
  function dock_at(id) { const c = chip(id), [dx, dy] = from_fig(DOCK[id]), hw = c.el.offsetWidth / 2 + 8; return [Math.max(hw, Math.min(wrap.clientWidth - hw, dx)), dy - c.el.offsetHeight / 2 - 10]; }
  function dock(id) { const c = chip(id), [dx, dy] = dock_at(id); c.state = 'docked'; c.pos.to(dx, dy); c.lift.to(0.25); parts[id].glow.to(1); sched.wake(1500); }
  function send_home(id) { const c = chip(id), [hx, hy] = home(id); c.state = 'going'; c.pos.to(hx, hy); c.lift.to(0); parts[id].glow.to(0); sched.wake(1500); }
  const sched = scheduler((dt) => {
    let b = false;
    for (const id in chips) {
      const c = chips[id]; b = c.pos.step(dt) || b; b = c.lift.step(dt) || b;
      if (c.state === 'going' && !c.pos.a.busy() && !c.pos.b.busy()) { c.state = 'home'; words[id].el.classList.remove('out'); }
      const l = Math.max(0, c.lift.x), hidden = c.state === 'home';
      c.el.style.opacity = hidden ? '0' : '1'; c.el.style.pointerEvents = hidden ? 'none' : 'auto';
      const w = c.el.offsetWidth, h = c.el.offsetHeight;
      c.el.style.transform = `translate(${c.pos.x - w / 2}px, ${c.pos.y - h / 2 - 6 * l}px) scale(${1 + 0.06 * l}) rotate(${(c.pos.a.v * 0.004).toFixed(3)}deg)`;
      c.el.style.boxShadow = `0 0 0 .75px rgba(26,27,31,${0.10 + 0.04 * l}), 0 ${1 + 14 * l}px ${2 + 28 * l}px rgba(26,27,31,${0.08 + 0.12 * l})`;
      c.el.style.background = c.state === 'going' ? `rgba(255,255,255,${Math.min(1, Math.hypot(c.pos.a.v, c.pos.b.v) / 300)})` : '#fff';
    }
    for (const id in parts) {
      const p = parts[id]; b = p.glow.step(dt) || b;
      if (p.wash) p.wash.setAttribute('opacity', (0.32 * Math.max(0, p.glow.x)).toFixed(3));
      if (id === 'goal') p.fill.setAttribute('fill', `color-mix(in srgb, #13876a ${Math.round(100 * Math.max(0, p.glow.x))}%, #fff)`);
    }
    return b;
  });
  layout(); addEventListener('resize', layout);
  return {
    visible: (v) => sched.set_visible(v), resize: () => { layout(); for (const id in chips) if (chips[id].state === 'docked') dock(id); },
    demo() { for (const id of ['cart', 'wall']) { const c = chip(id), [hx, hy] = home(id); c.pos.a.snap(hx); c.pos.b.snap(hy); c.state = 'lifted'; words[id].el.classList.add('out'); c.lift.to(1); dock(id); } },
    lift(id, fx, fy) { const c = chip(id), [hx, hy] = home(id); c.pos.a.snap(hx); c.pos.b.snap(hy); c.state = 'lifted'; words[id].el.classList.add('out'); c.lift.to(1); const [dx, dy] = dock_at(id); c.pos.to(hx + (dx - hx) * fx, hy + (dy - hy) * fy); parts[id].glow.to(0.6); sched.wake(); },
    async accept() {
      // one thing per noun
      const one = Object.keys(words).every((id) => svg.querySelectorAll(`[data-id="${id}"]`).length === 1);
      // send everything home and compare the text layout with a fresh one
      const before = Object.keys(words).map((id) => words[id].el.getBoundingClientRect());
      for (const id in chips) { chips[id].state = 'home'; chips[id].pos.a.snap(0); words[id].el.classList.remove('out'); parts[id].glow.snap(0); }
      const after = Object.keys(words).map((id) => words[id].el.getBoundingClientRect());
      const same = before.every((r, i) => Math.abs(r.left - after[i].left) < 0.5 && Math.abs(r.top - after[i].top) < 0.5);
      sched.wake();
      return { pass: one && same, value: `${lang === 'zh' ? '一词一物' : 'one thing per noun'} ${one ? '✓' : '✗'}; ${lang === 'zh' ? '排版不动' : 'layout unchanged'} ${same ? '✓' : '✗'}` };
    },
  };
}
