// The tutor as light. The AI has no face: it is the one soft light on the desk. When it answers, the light travels
// to what it is talking about (a word, a part of the figure), pools there the way a desk lamp pools on paper (the
// room dims a little, the pool is warm, with a soft penumbra and no halo), and its words form beside it in the
// margin, level with what they are about. Between answers it rests as a small dim point by the margin. Each phrase
// stays anchored: tap it later and the light goes back to what it meant.
// As a library primitive: say([{text, ref}]) where ref is any element id in the scene.
import { scheduler } from '../../lib/gl.js';
import { Spring, Spring2 } from '../../lib/ui.js';
import { css, canvas2d, box_in, inside_box, lesson_dom, PAGE_CSS, C, SANS, SERIF } from './_nav.js';

export const meta = {
  id: 'tutor',
  name: { zh: '导师是一束光', en: 'The tutor as light' },
  means: { zh: '导师没有脸，它是桌上那一盏灯：回答时，光走到它说的东西上，在纸上聚成一汪，话就写在旁边；不说话时，它是页边一个暗暗的小点。', en: 'The tutor has no face; it is the lamp on the desk. As it answers, the light travels to what it means and pools there on the paper, and its words form beside it; between answers it rests as a small dim point by the margin.' },
  test: { zh: '每一句话说出时，光的中心都落在它所指的元素框内；静止时页面不请求任何一帧', en: 'While each phrase forms, the light’s centre lies inside the box of what it refers to; at rest the page requests no frames' },
};

const SCRIPT = {
  zh: {
    q: '为什么球停在墙边，不在谷底？',
    a: [
      { t: '谷底在墙的另一边，', ref: ['bottom'] },
      { t: '球被墙挡住，只能停在它够得着的最低处。', ref: ['ball'] },
      { t: '这时墙在往回推球，所以它是起作用的约束；', ref: { names: ['起作用的约束'] } },
      { t: '推得多用力，就是 λ，所以 λ 大于零。', ref: { names: ['λ'] } },
    ],
  },
  en: {
    q: 'Why does the ball stop at the wall, not at the bottom?',
    a: [
      { t: 'The bottom is on the far side of the wall,', ref: ['bottom'] },
      { t: 'so the ball stops at the lowest point it can reach.', ref: ['ball'] },
      { t: 'The wall is pushing back, which makes it the active constraint;', ref: { names: ['active', 'constraint'] } },
      { t: 'how hard it pushes is λ, so λ is positive.', ref: { names: ['λ'] } },
    ],
  },
};

const CSS = PAGE_CSS + `
.tu-wrap{position:absolute;inset:0;background:${C.paper};overflow:hidden;user-select:none;-webkit-user-select:none}
.tu-light{position:absolute;inset:0;width:100%;height:100%;pointer-events:none;mix-blend-mode:multiply}
.tu-m{position:absolute}
.tu-q{display:flex;gap:10px;align-items:baseline;font:500 15px/1.5 ${SANS};color:${C.ink};cursor:pointer;min-height:44px;padding-top:2px}
.tu-q .n{font:600 11px ${SANS};letter-spacing:.08em;color:#62666d;flex:none;font-variant-numeric:tabular-nums}
.tu-a{position:relative}
.tu-ph{position:absolute;left:0;right:0;font:17px/1.65 ${SERIF};color:${C.ink};cursor:pointer;padding:2px 0}
.tu-wrap.narrow .tu-ph{position:static;display:inline;padding:0}
.tu-wrap.narrow .tu-a{font:16px/1.75 ${SERIF}}
.tu-c{display:inline;opacity:0;filter:blur(3px);transition:opacity .38s cubic-bezier(.2,.7,.2,1),filter .5s cubic-bezier(.2,.7,.2,1)}
.tu-c.on{opacity:1;filter:none}
.tu-ph.past{color:#44464d}
.tu-band{position:absolute;left:0;right:0;border-top:1px solid rgba(26,27,31,.08)}
@media (prefers-reduced-motion: reduce){.tu-c{transition:none}}
`;

export function make({ stage, canvas, hud, lang }) {
  canvas.style.display = 'none';
  css('tu-css', CSS);
  const S = SCRIPT[lang];
  const wrap = document.createElement('div'); wrap.className = 'tu-wrap'; stage.append(wrap);
  const page = lesson_dom(wrap, lang);
  const band = document.createElement('div'); band.className = 'tu-band'; wrap.append(band);
  const m = document.createElement('div'); m.className = 'tu-m';
  m.innerHTML = `<div class="tu-q"><span class="n">01</span><span>${S.q}</span></div><div class="tu-a"></div>`;
  wrap.append(m);
  const qel = m.querySelector('.tu-q'), ael = m.querySelector('.tu-a');
  const phrases = S.a.map((p, k) => {
    const el = document.createElement('span'); el.className = 'tu-ph';
    el.innerHTML = [...p.t].map((ch) => `<span class="tu-c">${ch}</span>`).join('') + (lang === 'en' ? ' ' : '');
    ael.append(el);
    el.addEventListener('click', (e) => { e.stopPropagation(); if (el.dataset.on) point(k, 2600); });
    const ids = Array.isArray(p.ref) ? p.ref : p.ref.names.map((n) => page.sels.find((s) => s.name === n).id);
    return { ...p, el, chars: [...el.querySelectorAll('.tu-c')], ids };
  });
  const lc = document.createElement('canvas'); lc.className = 'tu-light'; wrap.append(lc);
  const G = canvas2d(lc);

  let narrow = false, rest = [0, 0];
  function layout() {
    const W = wrap.clientWidth, H = wrap.clientHeight;
    narrow = W < 760; wrap.classList.toggle('narrow', narrow);
    page.el.classList.toggle('small', narrow);
    if (!narrow) {
      const pw = Math.min(560, W * 0.54), mw = Math.min(320, W * 0.3), gap = Math.min(72, W * 0.06);
      const x0 = Math.max(24, (W - pw - gap - mw) / 2);
      page.el.style.width = pw + 'px'; page.el.style.left = x0 + 'px';
      const ph = page.el.offsetHeight; page.el.style.top = Math.max(24, (H - ph) / 2) + 'px';
      m.style.left = (x0 + pw + gap) + 'px'; m.style.width = mw + 'px';
      // the question sits level with the title; each phrase level with what it refers to (never above the one before)
      const tb = box_in(page.el.querySelector('.nv-title'), wrap);
      m.style.top = tb.y + 'px'; band.style.display = 'none';
      const a0 = box_in(ael, wrap).y;
      let y = 0;
      for (const p of phrases) {
        const b = ref_box(p), h = p.el.offsetHeight;
        y = Math.max(y, b.cy - h / 2 - a0); p.el.style.top = y + 'px'; y += h + 6;
      }
      const qb = box_in(qel, wrap); rest = [qb.x - 16, qb.y + 13];
    } else {
      // a phone: the page above, the margin becomes a band below it
      page.el.style.width = (W - 32) + 'px'; page.el.style.left = '16px'; page.el.style.top = '18px';
      const ph = page.el.offsetHeight, bt = Math.min(H - 220, 18 + ph + 14);
      band.style.display = ''; band.style.top = bt + 'px';
      m.style.left = '30px'; m.style.width = (W - 46) + 'px'; m.style.top = (bt + 14) + 'px';
      for (const p of phrases) p.el.style.top = '';
      const qb = box_in(qel, wrap); rest = [16, qb.y + 13];
    }
    G.fit();
  }
  function ref_box(p) {
    const bs = p.ids.map((id) => box_in(page.ref(id), wrap));
    const x = Math.min(...bs.map((b) => b.x)), y = Math.min(...bs.map((b) => b.y)), x1 = Math.max(...bs.map((b) => b.x + b.w)), y1 = Math.max(...bs.map((b) => b.y + b.h));
    // two words broken across lines: aim at the first, the pool still covers the pair on one line
    const same_line = bs.every((b) => Math.abs(b.cy - bs[0].cy) < b.h * 0.5);
    const B = same_line ? { x, y, w: x1 - x, h: y1 - y } : bs[0];
    return { ...B, cx: B.x + B.w / 2, cy: B.y + B.h / 2 };
  }

  // the light: where it is, how wide the pool is, how far the room has dimmed
  const L = { pos: new Spring2(0, 0, 0.75, 0.92), rx: new Spring(5, 0.5, 0.86), ry: new Spring(5, 0.5, 0.86), amb: new Spring(0, 0.7, 1), target: null };
  function draw() {
    const g = G.ctx, W = G.W, H = G.H; g.clearRect(0, 0, W, H);
    const a = Math.max(0, Math.min(1, L.amb.x)), rx = Math.max(3, L.rx.x), ry = Math.max(3, L.ry.x), x = L.pos.x, y = L.pos.y;
    // the room: dimmed a little while the lamp is on
    if (a > 0.002) {
      g.globalCompositeOperation = 'source-over'; g.fillStyle = `rgba(214,209,200,${(0.66 * a).toFixed(3)})`; g.fillRect(0, 0, W, H);
      // a lamp's light falls off with distance: the dim is lifted by half near the pool, not at all far away
      const R = Math.max(rx, ry) * 3.2 + 120, f = g.createRadialGradient(x, y, 0, x, y, R);
      for (let i = 0; i <= 8; i++) { const t = i / 8; f.addColorStop(t, `rgba(0,0,0,${(0.5 * (1 - t) ** 2).toFixed(3)})`); }
      g.globalCompositeOperation = 'destination-out'; g.fillStyle = f; g.fillRect(x - R, y - R, 2 * R, 2 * R);
    }
    // the pool: the dim is lifted with a soft penumbra, then the lamp's warm white lies in it
    const small = Math.max(0, Math.min(1, (20 - Math.min(rx, ry)) / 14));   // a narrow beam is a deeper, warmer point
    const col = [255 - 18 * small, 249 - 50 * small, 236 - 100 * small];
    g.save(); g.translate(x, y); g.scale(rx, ry);
    const grad = (alpha) => { const r = g.createRadialGradient(0, 0, 0, 0, 0, 1); r.addColorStop(0, `rgba(0,0,0,${alpha})`); r.addColorStop(0.7, `rgba(0,0,0,${alpha})`); r.addColorStop(0.86, `rgba(0,0,0,${alpha * 0.5})`); r.addColorStop(1, 'rgba(0,0,0,0)'); return r; };
    g.globalCompositeOperation = 'destination-out'; g.fillStyle = grad(1); g.beginPath(); g.arc(0, 0, 1, 0, Math.PI * 2); g.fill();
    g.globalCompositeOperation = 'source-over';
    const r2 = g.createRadialGradient(0, 0, 0, 0, 0, 1), c = col.map(Math.round).join(',');
    const k = 0.55 + 0.45 * Math.max(a, small);
    r2.addColorStop(0, `rgba(${c},${k})`); r2.addColorStop(0.7, `rgba(${c},${k * 0.95})`); r2.addColorStop(0.86, `rgba(${c},${k * 0.45})`); r2.addColorStop(1, `rgba(${c},0)`);
    g.fillStyle = r2; g.beginPath(); g.arc(0, 0, 1, 0, Math.PI * 2); g.fill();
    g.restore();
  }
  const pool = (b) => [Math.max(46, b.w / 2 + 30), Math.max(32, b.h / 2 + 20)];
  function aim() {
    if (L.target == null) { L.pos.to(rest[0], rest[1]); L.rx.to(5); L.ry.to(5); L.amb.to(0); return; }
    const b = ref_box(phrases[L.target]), d = Math.hypot(L.pos.x - b.cx, L.pos.y - b.cy);
    L.pos.to(b.cx, b.cy); L.amb.to(1);
    // a narrow beam while travelling; the pool opens over the thing once the light is there
    if (d < 26) { const [px, py] = pool(b); L.rx.to(px); L.ry.to(py); } else { L.rx.to(16); L.ry.to(16); }
  }
  const sched = scheduler((dt) => {
    aim();
    let busy = L.pos.step(dt); busy = L.rx.step(dt) || busy; busy = L.ry.step(dt) || busy; busy = L.amb.step(dt) || busy;
    draw();
    return busy;
  });

  // the exchange
  let run = 0, speed = 1, hold_timer = 0;
  const wait = (ms) => new Promise((r) => setTimeout(r, ms / speed));
  const arrived = () => { if (L.target == null) return true; const b = ref_box(phrases[L.target]); return Math.hypot(L.pos.x - b.cx, L.pos.y - b.cy) < 3; };
  async function until_arrived(id) { const t0 = performance.now(); while (!arrived() && performance.now() - t0 < 2500 && id === run) await new Promise((r) => setTimeout(r, 16)); }
  function form(p, on, instant = false) {
    p.el.dataset.on = on ? '1' : '';
    p.chars.forEach((c, i) => { c.style.transitionDelay = on && !instant ? (i * 26 / speed) + 'ms' : '0ms'; c.style.transitionDuration = instant ? '0s' : ''; c.classList.toggle('on', on); });
  }
  function point(k, ms) { clearTimeout(hold_timer); run++; L.target = k; sched.wake(); if (ms) hold_timer = setTimeout(() => { L.target = null; sched.wake(); }, ms); }
  const samples = [];
  async function answer() {
    const id = ++run; clearTimeout(hold_timer);
    for (const p of phrases) form(p, false, true);
    samples.length = 0;
    for (let k = 0; k < phrases.length; k++) {
      if (id !== run) return;
      L.target = k; sched.wake(); await until_arrived(id); if (id !== run) return;
      form(phrases[k], true); phrases.forEach((p, i) => p.el.classList.toggle('past', i < k));
      const hold = (phrases[k].chars.length * 26 + 900);
      await wait(hold / 2);
      // a measurement for the test: is the light on what this phrase is about, right now?
      samples.push({ k, x: L.pos.x, y: L.pos.y, b: ref_box(phrases[k]) });
      await wait(hold / 2);
    }
    if (id !== run) return;
    await wait(500); L.target = null; phrases.forEach((p) => p.el.classList.remove('past')); sched.wake();
  }
  qel.addEventListener('click', () => answer());
  // a tap anywhere else lets the light go back to rest
  wrap.addEventListener('click', (e) => { if (e.target.closest('.tu-q')) return; if (L.target != null) { clearTimeout(hold_timer); run++; L.target = null; sched.wake(); } });

  layout();
  L.pos.a.snap(rest[0]); L.pos.b.snap(rest[1]); draw();
  return {
    visible: (v) => sched.set_visible(v),
    resize: () => { layout(); sched.wake(); },
    demo: () => { speed = 1; answer(); },
    // a still: the light on phrase k with phrases 0..k formed (k = -1: at rest with the whole answer)
    at(k) {
      run++; clearTimeout(hold_timer);
      phrases.forEach((p, i) => { form(p, k < 0 || i <= k, true); p.el.classList.toggle('past', k >= 0 && i < k); });
      L.target = k < 0 ? null : k; aim();
      const t = k < 0 ? { x: rest[0], y: rest[1], rx: 5, ry: 5, a: 0 } : (() => { const b = ref_box(phrases[k]); const [px, py] = pool(b); return { x: b.cx, y: b.cy, rx: px, ry: py, a: 1 }; })();
      L.pos.a.snap(t.x); L.pos.b.snap(t.y); L.rx.snap(t.rx); L.ry.snap(t.ry); L.amb.snap(t.a); draw();
    },
    // mid-travel, for a still: fraction f of the way from phrase k-1's referent (or rest) to phrase k's
    travel(k, f) {
      this.at(k - 1); const a = k ? ref_box(phrases[k - 1]) : { cx: rest[0], cy: rest[1] }, b = ref_box(phrases[k]);
      L.target = null; L.pos.a.snap(a.cx + (b.cx - a.cx) * f); L.pos.b.snap(a.cy + (b.cy - a.cy) * f); L.rx.snap(13); L.ry.snap(13); L.amb.snap(1); draw();
    },
    async accept() {
      speed = 2.5;
      await answer();
      speed = 1;
      const hits = samples.filter((s) => inside_box(s.b, s.x, s.y)).length;
      // at rest: wait for the light to settle, then count frames over a while
      await new Promise((r) => setTimeout(r, 2600));
      const f0 = sched.frames; await new Promise((r) => setTimeout(r, 900)); const still = sched.frames - f0;
      const ok = samples.length === phrases.length && hits === phrases.length && still === 0;
      const zh = lang === 'zh';
      return { pass: ok, value: zh ? `光落在所指之处 ${hits}/${phrases.length} 句；静止 0.9 秒内请求 ${still} 帧` : `light on its referent for ${hits}/${phrases.length} phrases; ${still} frames requested in 0.9 s at rest` };
    },
  };
}
