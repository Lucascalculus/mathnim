// A history deck. Every change you make to a figure is kept as a card, stacked behind the current one in the order
// you made them. Flick through the deck as you would a pack of cards (drag, throw, wheel); each card is a live
// miniature of that exact state, drawn from its numbers, not a screenshot. Tap a card and the figure travels back to
// it through true states (it moves in its parameters, so every frame is a real distribution). History is never cut:
// change something after going back, and the new state joins the top of the deck.
// As a library primitive: history(figure) for any figure with params.
import { scheduler } from '../../lib/gl.js';
import { Spring } from '../../lib/ui.js';
import { css, canvas2d, C, SANS, SERIF } from './_nav.js';

export const meta = {
  id: 'deck',
  name: { zh: '一叠历史', en: 'A history deck' },
  means: { zh: '你对图做的每一次改动都留成一张卡，按先后叠在当前这张后面；像翻牌一样往回翻，每张都是那个状态的活缩略图；点一下，图就回到那一刻。', en: 'Every change you make to a figure stays as a card, stacked behind the current one in the order you made it; flick back through them like a deck, each a live miniature of that state; tap one and the figure goes back to it.' },
  test: { zh: '恢复任一张卡，图的参数与该卡完全相同，画面与按该卡参数重画的逐像素一致；牌叠的前后顺序就是时间顺序', en: 'Restoring any card gives exactly its parameters, and the figure matches a fresh render of them pixel for pixel; the deck’s front-to-back order is chronological' },
  wide: true,
};

const SEED = [[0, 1, 0], [0, 1, 1], [0, 0.5, 1], [1, 0.5, 1], [1, 1.6, 1], [-0.5, 1.6, 1]];
const XR = [-4, 4];

// the normal distribution's cumulative probability (Abramowitz–Stegun 7.1.26 on erf, |error| < 1.5e-7)
function Phi(z) {
  const t = 1 / (1 + 0.3275911 * Math.abs(z) / Math.SQRT2), y = 1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-z * z / 2);
  return 0.5 * (1 + (z >= 0 ? y : -y));
}
const pdf = (x, m, s) => Math.exp(-0.5 * ((x - m) / s) ** 2) / (s * Math.sqrt(2 * Math.PI));

// the figure, drawn from its parameters alone (the main view and every card share this)
function render(g, W, H, p, o = {}) {
  const [m, s, c] = p, mini = !!o.mini;
  const pad = mini ? { l: 10, r: 10, t: 6, b: 12 } : { l: 28, r: 28, t: 64, b: 64 };
  const x0 = pad.l, x1 = W - pad.r, yb = H - pad.b, yt = pad.t, ymax = 0.85;   // the tallest curve (σ = 0.47) fills the frame
  const X = (x) => x0 + (x - XR[0]) / (XR[1] - XR[0]) * (x1 - x0), Y = (v) => yb - v / ymax * (yb - yt);
  g.fillStyle = mini ? '#fff' : C.paper; g.fillRect(0, 0, W, H);
  // the area P(X ≤ c)
  const n = mini ? 90 : 240;
  g.beginPath(); g.moveTo(X(XR[0]), yb);
  for (let i = 0; i <= n; i++) { const x = XR[0] + (Math.min(c, XR[1]) - XR[0]) * i / n; g.lineTo(X(x), Y(pdf(x, m, s))); }
  g.lineTo(X(Math.min(c, XR[1])), yb); g.closePath(); g.fillStyle = 'rgba(47,91,210,.16)'; g.fill();
  // the axis and ticks
  g.strokeStyle = 'rgba(141,145,152,.8)'; g.lineWidth = 1; g.beginPath(); g.moveTo(x0, yb + 0.5); g.lineTo(x1, yb + 0.5); g.stroke();
  if (!mini) {
    g.font = `13px ${SANS}`; g.fillStyle = '#62666d'; g.textAlign = 'center'; g.textBaseline = 'top';
    for (let v = XR[0]; v <= XR[1]; v++) { g.beginPath(); g.moveTo(X(v) + 0.5, yb); g.lineTo(X(v) + 0.5, yb + 5); g.stroke(); g.fillText(String(v).replace('-', '−'), X(v), yb + 9); }
  }
  // the curve
  g.beginPath(); for (let i = 0; i <= n; i++) { const x = XR[0] + (XR[1] - XR[0]) * i / n; i ? g.lineTo(X(x), Y(pdf(x, m, s))) : g.moveTo(X(x), Y(pdf(x, m, s))); }
  g.strokeStyle = C.ink; g.lineWidth = mini ? 1.4 : 2.2; g.lineJoin = 'round'; g.stroke();
  // the cut
  g.strokeStyle = C.cobalt; g.lineWidth = mini ? 1.2 : 1.6; g.beginPath(); g.moveTo(X(c), yb); g.lineTo(X(c), Y(pdf(c, m, s)) - (mini ? 0 : 0)); g.stroke();
  // the number
  const P = Phi((c - m) / s);
  g.textAlign = 'left'; g.textBaseline = 'alphabetic'; g.fillStyle = C.ink;
  if (!mini) { g.font = `italic 20px ${SERIF}`; const t = 'P(X ≤ c) = ', w = g.measureText(t).width; g.fillText(t, x0, 36); g.font = `600 20px ${SANS}`; g.fillStyle = C.cobalt; g.fillText(P.toFixed(3), x0 + w, 36); }
  return { X, Y, yb, P };
}

const CSS = `
.dk-wrap{position:absolute;inset:0;background:${C.paper};overflow:hidden;touch-action:none;user-select:none;-webkit-user-select:none}
.dk-fig{position:absolute}
.dk-fig canvas{position:absolute;inset:0;width:100%;height:100%}
.dk-deck{position:absolute;touch-action:none;cursor:grab}
.dk-card{position:absolute;left:0;top:0;border-radius:12px;background:#fff;overflow:hidden;transform-origin:50% 0;will-change:transform,opacity;
  box-shadow:0 0 0 .75px rgba(26,27,31,.13),0 1px 2px rgba(26,27,31,.06),0 6px 16px rgba(26,27,31,.06);cursor:pointer}
.dk-card canvas{position:absolute;inset:auto;left:0;top:24px;width:100%;height:calc(100% - 24px)}
.dk-card .n{position:absolute;left:11px;top:4px;font:600 11px/14px ${SANS};letter-spacing:.06em;color:#62666d;font-variant-numeric:tabular-nums}
.dk-card .p{position:absolute;right:11px;top:4px;font:600 12px/14px ${SANS};color:${C.cobalt};font-variant-numeric:tabular-nums}
.dk-card .now{position:absolute;left:32px;top:8px;width:6px;height:6px;border-radius:3px;background:${C.ink};opacity:0;transition:opacity .25s}
.dk-card.head .now{opacity:1}
.dk-h{position:absolute;width:44px;height:44px;margin:-22px 0 0 -22px;border-radius:22px;cursor:grab;touch-action:none}
.dk-h::after{content:'';position:absolute;left:11px;top:11px;width:22px;height:22px;border-radius:11px;
  background:radial-gradient(circle at 38% 30%,#fff,rgba(255,255,255,.8) 50%,rgba(238,236,232,.9));box-shadow:0 0 0 .75px rgba(26,27,31,.22),0 4px 10px rgba(26,27,31,.16),0 1px 2px rgba(26,27,31,.12)}
.dk-h.c::after{box-shadow:0 0 0 1.5px ${C.cobalt},0 4px 10px rgba(26,27,31,.16)}
`;

export function make({ stage, canvas, hud, lang }) {
  canvas.style.display = 'none';
  css('dk-css', CSS);
  const zh = lang === 'zh';
  const wrap = document.createElement('div'); wrap.className = 'dk-wrap'; stage.append(wrap);
  const fig = document.createElement('div'); fig.className = 'dk-fig'; wrap.append(fig);
  const fcv = document.createElement('canvas'); fig.append(fcv);
  const F = canvas2d(fcv);
  const deck = document.createElement('div'); deck.className = 'dk-deck'; wrap.append(deck);
  const handles = ['m', 's', 'c'].map((k) => { const h = document.createElement('div'); h.className = 'dk-h ' + k; h.dataset.k = k; fig.append(h); return h; });

  // the model: the figure's parameters (exact), and springs that carry the view between them
  const P = { m: 0, s: 1, c: 0 };
  const V = { m: new Spring(0, 0.5, 0.9), s: new Spring(1, 0.5, 0.9), c: new Spring(0, 0.5, 0.9) };
  const hist = [];   // [{t, p:[m,s,c], el, cv}]
  let head = -1, seq = 0;
  const browse = new Spring(0, 0.42, 0.86);
  let CW = 220, CH = 140;

  function add_card(p) {
    const el = document.createElement('div'); el.className = 'dk-card';
    el.innerHTML = `<span class="n"></span><span class="now"></span><span class="p"></span><canvas></canvas>`;
    deck.append(el);
    const card = { t: ++seq, p: p.slice(), el, cv: el.querySelector('canvas') };
    el.querySelector('.n').textContent = String(card.t).padStart(2, '0');
    el.querySelector('.p').textContent = Phi((p[2] - p[0]) / p[1]).toFixed(2);
    el.addEventListener('click', (e) => { if (flick && flick.moved) return; e.stopPropagation(); restore(hist.indexOf(card)); });
    hist.push(card); paint(card); return card;
  }
  // a card is drawn from its own numbers, at its own size: a live miniature, not a picture of the screen
  function paint(card) { const G = canvas2d(card.cv); render(G.ctx, G.W, G.H, card.p, { mini: true }); }
  function commit() {
    const p = [P.m, P.s, P.c], last = hist[head];
    if (last && last.p.every((v, i) => Math.abs(v - p[i]) < 1e-9)) return;
    add_card(p); head = hist.length - 1; browse.to(head); sched.wake(1200);
  }
  function restore(i) {
    if (i < 0 || i >= hist.length) return;
    head = i; [P.m, P.s, P.c] = hist[i].p; V.m.to(P.m); V.s.to(P.s); V.c.to(P.c); browse.to(i); sched.wake(1500);
  }

  let narrow = false, geo = null;
  function layout() {
    const W = wrap.clientWidth, H = wrap.clientHeight; narrow = W < 700;
    if (!narrow) {
      const fw = Math.min(760, W * 0.6), fh = Math.min(H - 120, fw * 0.52);
      CW = Math.min(240, W * 0.2); CH = Math.round(CW * 0.64);
      const gap = Math.min(80, W * 0.05), total = fw + gap + CW, x0 = (W - total) / 2;
      geo = { fx: x0, fy: (H - fh) / 2, fw, fh, dx: x0 + fw + gap, dy: (H - fh) / 2 + fh - CH - 60 };
      deck.style.left = geo.dx + 'px'; deck.style.top = (geo.dy - 120) + 'px'; deck.style.width = CW + 'px'; deck.style.height = (CH + 240) + 'px';
    } else {
      const fw = W - 16, fh = Math.min(H * 0.52, fw * 1.1);
      CW = Math.min(250, W - 120); CH = Math.round(CW * 0.6);
      geo = { fx: 8, fy: 16, fw, fh, dx: (W - CW) / 2, dy: H - CH - 96 };
      deck.style.left = geo.dx + 'px'; deck.style.top = (geo.dy - 120) + 'px'; deck.style.width = CW + 'px'; deck.style.height = (CH + 160) + 'px';
    }
    Object.assign(fig.style, { left: geo.fx + 'px', top: geo.fy + 'px', width: geo.fw + 'px', height: geo.fh + 'px' });
    F.fit();
    for (const c of hist) { c.el.style.width = CW + 'px'; c.el.style.height = CH + 'px'; paint(c); }
  }

  function draw() {
    const g = F.ctx, p = [V.m.x, Math.max(0.3, V.s.x), V.c.x];
    const R = render(g, F.W, F.H, p);
    // handles: the peak (where), the shoulder at μ + σ (how wide), the cut (how far)
    const put = (h, x, y) => { h.style.left = x + 'px'; h.style.top = y + 'px'; };
    put(handles[0], R.X(p[0]), R.Y(pdf(p[0], p[0], p[1])));
    put(handles[1], R.X(p[0] + p[1]), R.Y(pdf(p[0] + p[1], p[0], p[1])));
    put(handles[2], R.X(p[2]), R.yb);
    // the deck: the card being looked at in front, older ones behind it, newer ones flicked away toward you
    const b = browse.x;
    hist.forEach((c, i) => {
      const d = b - i, el = c.el;
      let y, s, o;
      // older cards peek out above the front one, newer ones (flicked past) below it: top to bottom is first to last
      const e = Math.min(Math.abs(d), 6), step = narrow ? 19 : 21;
      s = 1 - e * 0.045; o = e < 4 ? 1 : Math.max(0, 1 - (e - 4) / 1.5);
      y = d >= 0 ? -e * step : CH + e * step * 0.7 - s * CH;
      el.style.transform = `translate(0px, ${(120 + y).toFixed(2)}px) scale(${s.toFixed(4)})`;
      el.style.opacity = o.toFixed(3); el.style.zIndex = String(1000 - Math.round(Math.abs(d) * 10)); c.y = y;
      el.style.pointerEvents = o > 0.5 ? 'auto' : 'none';
      el.classList.toggle('head', i === head);
    });
    hud.innerHTML = hist.length ? `<b>${String(Math.round(b) + 1).padStart(2, '0')}</b> / ${String(hist.length).padStart(2, '0')}` : '';
  }
  const sched = scheduler((dt) => {
    let busy = browse.step(dt);
    for (const k in V) busy = V[k].step(dt) || busy;
    // a view that has arrived sits exactly on its numbers
    if (!busy) for (const k in V) V[k].snap(P[k]);
    draw(); return busy;
  });

  // dragging the handles changes the figure; letting go makes a new card
  let hdrag = null;
  for (const h of handles) h.addEventListener('pointerdown', (e) => { e.stopPropagation(); h.setPointerCapture(e.pointerId); hdrag = { k: h.dataset.k }; });
  fig.addEventListener('pointermove', (e) => {
    if (!hdrag) return;
    const r = fcv.getBoundingClientRect(), x0 = 28, x1 = r.width - 28, v = XR[0] + (e.clientX - r.left - x0) / (x1 - x0) * (XR[1] - XR[0]);
    const q = (x) => Math.round(x * 10) / 10;   // states are kept to one decimal, as a learner would read them
    if (hdrag.k === 'm') P.m = q(Math.max(-2.5, Math.min(2.5, v)));
    if (hdrag.k === 's') P.s = q(Math.max(0.5, Math.min(2, v - P.m)));
    if (hdrag.k === 'c') P.c = q(Math.max(-3.5, Math.min(3.5, v)));
    for (const k in V) V[k].to(P[k]); sched.wake();
  });
  const hup = () => { if (hdrag) { hdrag = null; commit(); } };
  fig.addEventListener('pointerup', hup); fig.addEventListener('pointercancel', hup);

  // flicking the deck: drag it, throw it (it keeps its speed and lands on a card), or wheel through it
  let flick = null;
  deck.addEventListener('pointerdown', (e) => { deck.setPointerCapture(e.pointerId); flick = { y0: e.clientY, b0: browse.x, moved: false, last: [e.clientY, performance.now()], v: 0 }; });
  deck.addEventListener('pointermove', (e) => {
    if (!flick) return; const dy = e.clientY - flick.y0;
    if (Math.abs(dy) > 5) flick.moved = true;
    if (!flick.moved) return;
    const t = performance.now(); flick.v = (e.clientY - flick.last[0]) / Math.max(1, t - flick.last[1]); flick.last = [e.clientY, t];
    // pulling down brings older cards forward
    const b = Math.max(-0.4, Math.min(hist.length - 0.6, flick.b0 - dy / 70));
    browse.snap(b); sched.wake();
  });
  const fup = (e) => {
    if (!flick) return;
    if (flick.moved) { const target = Math.round(Math.max(0, Math.min(hist.length - 1, browse.x - flick.v * 6))); browse.v = -flick.v * 1000 / 70; browse.to(target); sched.wake(1200); }
    else { // a tap on the front card restores it (the card's own click handler does the rest)
      const el = document.elementFromPoint(e.clientX, e.clientY)?.closest('.dk-card'); if (el) restore(hist.findIndex((c) => c.el === el));
    }
    setTimeout(() => { flick = null; }, 0);
  };
  deck.addEventListener('pointerup', fup); deck.addEventListener('pointercancel', () => { flick = null; });
  deck.addEventListener('wheel', (e) => { e.preventDefault(); browse.to(Math.max(0, Math.min(hist.length - 1, Math.round(browse.target + Math.sign(e.deltaY))))); sched.wake(1000); }, { passive: false });

  function seed() {
    for (const c of hist) c.el.remove(); hist.length = 0; seq = 0;
    for (const p of SEED) add_card(p);
    head = hist.length - 1; [P.m, P.s, P.c] = hist[head].p; for (const k in V) V[k].snap(P[k]); browse.snap(head);
  }
  layout(); seed(); layout(); draw();
  const settle = () => new Promise((res) => { const t0 = performance.now(); const f = () => { if (!browse.busy() && !V.m.busy() && !V.s.busy() && !V.c.busy() || performance.now() - t0 > 4000) res(); else setTimeout(f, 30); }; f(); });
  return {
    visible: (v) => sched.set_visible(v),
    resize: () => { layout(); draw(); },
    demo: () => { browse.to(2); sched.wake(); setTimeout(() => restore(2), 900); },
    browse: (b) => { browse.snap(b); draw(); },
    restore,
    set: (m, s, c) => { P.m = m; P.s = s; P.c = c; for (const k in V) V[k].to(P[k]); commit(); sched.wake(); },
    async accept() {
      let exact = 0, pixel = 0, worst = 0;
      const W = fcv.width, H = fcv.height, off = document.createElement('canvas'); off.width = W; off.height = H;
      const og = off.getContext('2d'), fg = fcv.getContext('2d');
      // restore every card, from newest to oldest and back, and look at what is on screen
      const order = [...hist.keys()].reverse().concat([2, 4]);
      for (const i of order) {
        restore(i); await settle(); draw();
        if (P.m === hist[i].p[0] && P.s === hist[i].p[1] && P.c === hist[i].p[2]) exact++;
        og.setTransform(F.dpr, 0, 0, F.dpr, 0, 0); render(og, F.W, F.H, hist[i].p);
        const a = fg.getImageData(0, 0, W, H).data, b = og.getImageData(0, 0, W, H).data; let diff = 0;
        for (let k = 0; k < a.length; k += 4) if (Math.abs(a[k] - b[k]) + Math.abs(a[k + 1] - b[k + 1]) + Math.abs(a[k + 2] - b[k + 2]) > 6) diff++;
        if (diff === 0) pixel++; worst = Math.max(worst, diff);
      }
      // chronological: earlier cards sit behind later ones, and their numbers rise with time
      draw(); const chrono = [0, 2, hist.length - 1].every((b) => { browse.snap(b); draw(); return hist.every((c, i) => !i || (c.t > hist[i - 1].t && c.y > hist[i - 1].y)); });
      restore(hist.length - 1); await settle();
      const n = order.length, pass = exact === n && pixel === n && chrono;
      return { pass, value: zh ? `恢复 ${n} 次：参数完全一致 ${exact}/${n}，逐像素一致 ${pixel}/${n}（最多差 ${worst} 像素）；先后顺序 ${chrono ? '✓' : '✗'}` : `${n} restores: parameters exact ${exact}/${n}, pixel-identical ${pixel}/${n} (worst ${worst} px); chronological ${chrono ? '✓' : '✗'}` };
    },
  };
}
