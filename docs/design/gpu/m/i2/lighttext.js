// I2 · The answer forming. A streamed answer arrives phrase by phrase, and each glyph condenses out of ink: the text
// is first typeset for real (off screen), every inked pixel of it becomes one particle carrying that pixel's colour
// and coverage, and the particles of each glyph gather from a cloud just ahead of the writing into their own pixel.
// So the cursor is not a bar: it is the place where matter is gathering. While the next phrase is on its way, a small
// cloud waits there. Dismiss the answer and it dissolves back into dust. At rest every particle sits exactly on its
// own pixel, so the formed answer is the typeset text, not an imitation of it. Canvas 2D, one ImageData per frame.
import { scheduler } from '../../lib/gl.js';
import { css, canvas2d, SANS, SERIF, tokens, no_start } from './_text.js';

export const meta = {
  id: 'lighttext',
  name: { zh: '正在成形的回答', en: 'The answer forming' },
  means: { zh: 'AI 的回答一个短语一个短语地到来：每个字由墨的微粒聚拢成形，光标就是微粒正在聚集的地方；收起时它散回尘埃。', en: 'The AI\'s answer arrives phrase by phrase: each glyph gathers out of ink particles, the cursor is where the matter is gathering, and dismissing it dissolves it back into dust.' },
  test: { zh: '静止时成形的字与直接排版的字逐像素一致（1 px 内 ≥ 99%）；字按阅读顺序依次成形', en: 'At rest the formed text matches the plainly typeset text pixel for pixel (≥ 99 % within 1 px); glyphs form in reading order' },
};

const TEXT = {
  zh: { q: '为什么只执行第一个动作？', a: '因为计划里越往后的动作，依据的预测越不准。只执行第一个，下一刻用新的测量重新规划，误差就来不及积累。这就是滚动时域：预测的窗口跟着你一起往前走。', ask: '问', close: '收起' },
  en: { q: 'Why apply only the first action?', a: 'Because the later an action comes in the plan, the less its prediction can be trusted. Apply only the first, measure again a moment later and plan anew, and errors never get the chance to pile up. That is the receding horizon: the window of prediction moves forward with you.', ask: 'Ask', close: 'Dismiss' },
};

const CSS = `
.lt-q{position:absolute;display:flex;align-items:center;gap:10px;font-family:${SANS};color:var(--ink-2);white-space:nowrap}
.lt-q i{flex:none;width:9px;height:9px;border-radius:50%;border:1.5px solid var(--ink-2)}
.lt-ask{position:absolute;height:44px;padding:0 22px;border-radius:22px;border:0;background:var(--vermilion);color:#fff;font:600 16px ${SANS};cursor:pointer;
  box-shadow:0 6px 16px rgba(227,71,44,.26);transition:opacity .25s,transform .25s var(--ease)}
.lt-ask.off{opacity:0;transform:scale(.92);pointer-events:none}
.lt-x{position:absolute;width:44px;height:44px;border:0;background:none;cursor:pointer;border-radius:22px;transition:opacity .25s}
.lt-x::before,.lt-x::after{content:'';position:absolute;left:15px;top:21px;width:14px;height:1.5px;border-radius:1px;background:var(--ink-2);transform:rotate(45deg)}
.lt-x::after{transform:rotate(-45deg)}
.lt-x.off{opacity:0;pointer-events:none}
`;
const PAPER = [251, 250, 247];
function mulberry(a) { return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
function gauss(r) { return Math.sqrt(-2 * Math.log(Math.max(1e-9, r()))) * Math.cos(2 * Math.PI * r()); }

export function make({ stage, canvas, hud, lang }) {
  css('lt-css', CSS);
  const zh = lang === 'zh', T = TEXT[lang], c2 = canvas2d(canvas), ctx = c2.ctx;
  const q = document.createElement('div'); q.className = 'lt-q'; q.innerHTML = `<i></i><span></span>`; q.querySelector('span').textContent = T.q;
  const ask = document.createElement('button'); ask.className = 'lt-ask off'; ask.textContent = T.ask;
  const x = document.createElement('button'); x.className = 'lt-x off'; x.setAttribute('aria-label', T.close);
  stage.append(q, ask, x);

  let fs = 21, lh = 37, colw = 560, ax = 0, ay = 0, dpr = 1;
  let glyphs = [], parts = null, region = null, ref = null, img = null, acc = null;
  // the clock of the answer: everything is a function of time since asking, so it can be stepped exactly
  let t = 0, mode = 'idle', t_dismiss = 0;
  const FORM = 0.95;    // seconds from a glyph's first particle to its last landing

  function layout() {
    c2.fit(); dpr = c2.dpr; const W = c2.W, H = c2.H, narrow = W < 560;
    fs = narrow ? 18 : 21; lh = Math.round(fs * 1.75); colw = Math.min(narrow ? W - 40 : 580, W - 40);
    ax = Math.round((W - colw) / 2); ay = Math.round(narrow ? H * 0.2 : H * 0.3);
    q.style.left = ax + 'px'; q.style.top = (ay - (narrow ? 64 : 70)) + 'px'; q.style.fontSize = (narrow ? 15 : 16) + 'px';
    // greedy lines of tokens, then glyph boxes inside each token (Latin words are set whole, so kerning is kept)
    ctx.font = `${fs}px ${SERIF}`;
    const tk = tokens(T.a), sp = ctx.measureText(' ').width, lines = [[]];
    let cx = 0;
    for (let i = 0; i < tk.length; i++) {
      const k = tk[i], wd = ctx.measureText(k.t).width;
      let gw = wd, j = i; while (j + 1 < tk.length && no_start(tk[j + 1].t) && !tk[j].sp) { j++; gw += ctx.measureText(tk[j].t).width; }
      if (cx + gw > colw && cx > 0) { lines.push([]); cx = 0; }
      lines[lines.length - 1].push({ t: k.t, x: cx, w: wd }); cx += wd + (k.sp ? sp : 0);
    }
    glyphs = []; let phrase = 0;
    lines.forEach((ln, li) => ln.forEach((k) => {
      const chars = [...k.t]; let pre = 0;
      chars.forEach((ch, ci) => {
        const a = pre; pre = ctx.measureText(chars.slice(0, ci + 1).join('')).width;
        glyphs.push({ ch, x0: k.x + a, x1: k.x + pre, line: li, tok: k, phrase });
        if (/[，。：；？！,.:;?!]/.test(ch)) phrase++;
      });
    }));
    // the region the particles live in (device px): the answer with a margin for the clouds
    const m = 56, rh = lines.length * lh + 2 * m;
    region = { x: Math.max(0, Math.round((ax - m) * dpr)), y: Math.max(0, Math.round((ay - m) * dpr)), w: Math.round((colw + 2 * m) * dpr), h: Math.round(rh * dpr), m };
    region.w = Math.min(region.w, canvas.width - region.x); region.h = Math.min(region.h, canvas.height - region.y);
    region.lines = lines;
    x.style.left = (ax + colw - 22) + 'px'; x.style.top = (ay - (narrow ? 76 : 82)) + 'px';
    ask.style.left = (ax) + 'px'; ask.style.top = (ay + lines.length * lh + 24) + 'px';
    ref = typeset(); sample(); schedule();
    img = ctx.createImageData(region.w, region.h); acc = new Float32Array(region.w * region.h * 4);
  }
  // the plain typeset answer, in the region's own pixels: the same calls a page would make
  function typeset() {
    const cv = document.createElement('canvas'); cv.width = region.w; cv.height = region.h;
    const g = cv.getContext('2d', { willReadFrequently: true });
    g.fillStyle = `rgb(${PAPER})`; g.fillRect(0, 0, cv.width, cv.height);
    g.setTransform(dpr, 0, 0, dpr, ax * dpr - region.x, ay * dpr - region.y);
    g.font = `${fs}px ${SERIF}`; g.fillStyle = '#1a1b1f'; g.textBaseline = 'alphabetic';
    region.lines.forEach((ln, li) => ln.forEach((k) => g.fillText(k.t, k.x, li * lh + lh * 0.7)));
    return g.getImageData(0, 0, cv.width, cv.height);
  }
  // one particle per inked pixel: its coverage from the typeset text against the paper, owned by the glyph whose box holds it
  function sample() {
    const d = ref.data, W = region.w, list = [];
    const ox = ax * dpr - region.x, oy = ay * dpr - region.y;
    glyphs.forEach((gl, gi) => {
      gl.n = 0;
      const x0 = Math.max(0, Math.floor(ox + gl.x0 * dpr) - 3), x1 = Math.min(W, Math.ceil(ox + gl.x1 * dpr) + 3), y0 = Math.max(0, Math.floor(oy + gl.line * lh * dpr)), y1 = Math.min(region.h, Math.ceil(oy + (gl.line + 1) * lh * dpr));
      for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) {
        const o = (y * W + x) * 4; if (d[o + 3] === 0) continue;
        // coverage of ink over paper, from the darkening of the green channel (ink is near black)
        const a = (PAPER[1] - d[o + 1]) / (PAPER[1] - 27);
        if (a <= 0.004) continue;
        if (d[o + 3] === 254) continue;
        d[o + 3] = 254;   // claimed (alpha is always 255 on an opaque canvas)
        list.push(x, y, Math.min(1, a), gi); gl.n++;
      }
    });
    for (let i = 3; i < d.length; i += 4) d[i] = 255;
    const n = list.length / 4;
    parts = { n, tx: new Float32Array(n), ty: new Float32Array(n), a: new Float32Array(n), g: new Uint16Array(n), ox: new Float32Array(n), oy: new Float32Array(n), del: new Float32Array(n), sw: new Float32Array(n), dx: new Float32Array(n), dy: new Float32Array(n), dd: new Float32Array(n) };
    const r = mulberry(5);
    for (let i = 0; i < n; i++) {
      const gi = list[i * 4 + 3], gl = glyphs[gi];
      parts.tx[i] = list[i * 4]; parts.ty[i] = list[i * 4 + 1]; parts.a[i] = list[i * 4 + 2]; parts.g[i] = gi;
      // it comes from a cloud a little ahead of its glyph: the writing head
      const cx = ox + (gl.x1 + fs * 0.9) * dpr, cy = oy + (gl.line + 0.55) * lh * dpr, s = fs * 0.55 * dpr;
      parts.ox[i] = cx + gauss(r) * s - parts.tx[i]; parts.oy[i] = cy + gauss(r) * s * 0.8 - parts.ty[i];
      parts.del[i] = r() * 0.32; parts.sw[i] = (r() - 0.5) * 2.4;
      // and where it goes when dismissed: up and away, a drift and a spread
      const ang = -Math.PI / 2 + (r() - 0.5) * 2.2, dist = (14 + r() * 46) * dpr; parts.dx[i] = Math.cos(ang) * dist + 10 * dpr; parts.dy[i] = Math.sin(ang) * dist; parts.dd[i] = r() * 0.35;
    }
  }
  // the stream: phrases arrive with pauses, glyphs inside a phrase one after another
  function schedule() {
    const r = mulberry(9); let at = 0.35, p = -1;
    glyphs.forEach((gl, i) => {
      if (gl.phrase !== p) { if (p >= 0) at += 0.28 + r() * 0.45; p = gl.phrase; }
      gl.start = at; at += zh ? 0.045 : 0.022;
    });
    region.end = glyphs[glyphs.length - 1].start + FORM;
  }
  // where a particle is at time t (device px, region coordinates), and how much ink it carries
  function at_time(i, tt, out) {
    const gl = glyphs[parts.g[i]], s0 = gl.start + parts.del[i], dur = FORM - parts.del[i];
    let u = (tt - s0) / dur;
    if (mode === 'dismiss') {
      const v = Math.max(0, Math.min(1, (tt - t_dismiss - parts.dd[i]) / 0.75)), e = v * v;
      out[0] = parts.tx[i] + parts.dx[i] * e; out[1] = parts.ty[i] + parts.dy[i] * e; out[2] = parts.a[i] * (1 - v) * (1 - v); out[3] = v > 0 ? 1 : 0; return;
    }
    if (u <= 0) { out[2] = 0; return; }
    if (u >= 1) { out[0] = parts.tx[i]; out[1] = parts.ty[i]; out[2] = parts.a[i]; out[3] = 0; return; }
    // a decaying spiral: the offset shrinks and turns as it closes in
    const k = (1 - u) ** 2.4, th = parts.sw[i] * (1 - u) ** 2, c = Math.cos(th), s = Math.sin(th);
    out[0] = parts.tx[i] + (parts.ox[i] * c - parts.oy[i] * s) * k; out[1] = parts.ty[i] + (parts.ox[i] * s + parts.oy[i] * c) * k;
    out[2] = parts.a[i] * Math.min(1, u / 0.12); out[3] = 1;
  }
  // the waiting cloud: while the next phrase is on its way, matter gathers where the next glyph will be
  const cloud = Array.from({ length: 90 }, (_, i) => { const r = mulberry(100 + i); return { a: r() * 6.283, rr: 0.25 + r() * 0.75, w: 0.6 + r() * 1.6, al: 0.25 + r() * 0.5 }; });
  function cursor(tt) {
    if (mode !== 'stream') return null;
    let nx = null;
    for (const gl of glyphs) if (gl.start > tt) { nx = gl; break; }
    if (!nx) return null;
    const prev = glyphs[glyphs.indexOf(nx) - 1];
    // strength: full while waiting between phrases, none while glyphs stream
    const gap = nx.start - (prev ? prev.start : 0), wait = gap > 0.1 ? Math.min(1, (tt - (prev ? prev.start : 0)) / 0.25) : 0;
    return { x: ax * dpr - region.x + nx.x0 * dpr + fs * 0.4 * dpr, y: ay * dpr - region.y + (nx.line + 0.55) * lh * dpr, k: wait };
  }
  const tmp = new Float32Array(4);
  function compose() {
    acc.fill(0);
    const W = region.w, H = region.h;
    const add = (px, py, a) => {
      // bilinear splat; a particle exactly on a pixel puts all of itself there
      const x0 = Math.floor(px), y0 = Math.floor(py), fx = px - x0, fy = py - y0;
      for (const [dx, dy, wgt] of [[0, 0, (1 - fx) * (1 - fy)], [1, 0, fx * (1 - fy)], [0, 1, (1 - fx) * fy], [1, 1, fx * fy]]) {
        if (wgt <= 0) continue; const x = x0 + dx, y = y0 + dy; if (x < 0 || y < 0 || x >= W || y >= H) continue; acc[(y * W + x) * 4 + 3] += a * wgt;
      }
    };
    let busy = false;
    for (let i = 0; i < parts.n; i++) {
      at_time(i, t, tmp); if (tmp[2] <= 0) { if (tmp[3] || (mode === 'stream' && t < region.end)) busy = true; continue; }
      if (tmp[3]) busy = true;
      add(tmp[0], tmp[1], tmp[2]);
    }
    const cu = cursor(t);
    if (cu && cu.k > 0) {
      busy = true;
      for (const c of cloud) { const a = c.a + t * c.w, r = c.rr * fs * 0.42 * dpr; add(cu.x + Math.cos(a) * r, cu.y + Math.sin(a * 1.3) * r * 0.8, c.al * cu.k); }
    }
    // ink over paper, the same way the browser composites text
    const d = img.data;
    for (let p = 0, o = 0; p < W * H; p++, o += 4) {
      const a = Math.min(1, acc[o + 3]);
      d[o] = PAPER[0] + (26 - PAPER[0]) * a; d[o + 1] = PAPER[1] + (27 - PAPER[1]) * a; d[o + 2] = PAPER[2] + (31 - PAPER[2]) * a; d[o + 3] = 255;
    }
    return busy;
  }
  function draw() {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = `rgb(${PAPER})`; ctx.fillRect(0, 0, canvas.width, canvas.height);
    const busy = compose();
    ctx.putImageData(img, region.x, region.y);
    return busy;
  }
  const sched = scheduler((dt) => {
    if (mode === 'idle') { draw(); return false; }
    t += dt;
    const busy = draw();
    if (mode === 'dismiss' && t - t_dismiss > 1.2) { mode = 'idle'; ask.classList.remove('off'); draw(); return false; }
    if (mode === 'stream' && t > region.end + 0.05 && !busy) { mode = 'rest'; return false; }
    return true;
  });
  function start() { t = 0; mode = 'stream'; ask.classList.add('off'); x.classList.remove('off'); sched.wake(); }
  function dismiss() { if (mode === 'idle') return; t_dismiss = t = Math.max(t, region.end); mode = 'dismiss'; x.classList.add('off'); sched.wake(); }
  ask.addEventListener('click', start); x.addEventListener('click', dismiss);
  layout(); ask.classList.remove('off'); draw();

  return {
    visible: (v) => sched.set_visible(v),
    resize: () => { layout(); draw(); },
    demo() { start(); },
    // show the answer as it is at time s after asking (for pictures)
    at(s) { mode = 'stream'; t = s; ask.classList.add('off'); x.classList.remove('off'); draw(); },
    dissolve_at(s) { mode = 'dismiss'; t_dismiss = region.end; t = region.end + s; x.classList.add('off'); draw(); },
    async accept() {
      // reading order: the moment each glyph is fully formed (all its particles on their pixels), stepped at 60 Hz
      const done = new Float32Array(glyphs.length).fill(-1), left = new Int32Array(glyphs.length); glyphs.forEach((g, i) => (left[i] = g.n));
      const landed = new Uint8Array(parts.n), save = [mode, t]; mode = 'stream';
      for (let f = 0; f < Math.ceil((region.end + 0.5) * 60); f++) {
        const tt = f / 60;
        for (let i = 0; i < parts.n; i++) { if (landed[i]) continue; at_time(i, tt, tmp); if (tmp[2] > 0 && Math.abs(tmp[0] - parts.tx[i]) < 1e-6 && Math.abs(tmp[1] - parts.ty[i]) < 1e-6 && tmp[2] === parts.a[i]) { landed[i] = 1; if (--left[parts.g[i]] === 0) done[parts.g[i]] = tt; } }
      }
      let order_ok = true; for (let i = 1; i < glyphs.length; i++) if (glyphs[i].n && glyphs[i - 1].n && !(done[i] >= done[i - 1])) order_ok = false;
      const all_formed = [...done].every((d, i) => d >= 0 || glyphs[i].n === 0);
      // at rest: the formed answer against the plain typeset text, over every pixel that either one inks
      mode = 'rest'; t = region.end + 1; compose();
      const A = img.data, B = ref.data, W = region.w, H = region.h; let ink = 0, ok = 0, exact = 0;
      const close = (o, p) => Math.abs(A[o] - B[p]) <= 2 && Math.abs(A[o + 1] - B[p + 1]) <= 2 && Math.abs(A[o + 2] - B[p + 2]) <= 2;
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
        const o = (y * W + x) * 4, inked = A[o + 1] < 249 || B[o + 1] < 249; if (!inked) continue;
        ink++; if (close(o, o)) { ok++; exact++; continue; }
        let hit = false; for (let dy = -1; dy <= 1 && !hit; dy++) for (let dx = -1; dx <= 1 && !hit; dx++) { const xx = x + dx, yy = y + dy; if (xx >= 0 && yy >= 0 && xx < W && yy < H && close(o, (yy * W + xx) * 4)) hit = true; }
        if (hit) ok++;
      }
      [mode, t] = save; if (mode === 'idle') { mode = 'rest'; t = region.end + 1; ask.classList.add('off'); x.classList.remove('off'); } draw();
      const agree = ok / ink, pass = agree >= 0.99 && order_ok && all_formed;
      return { pass, value: zh ? `${parts.n} 颗微粒；静止时与排版一致 ${(agree * 100).toFixed(2)}%（完全相同 ${(exact / ink * 100).toFixed(2)}%）；${glyphs.length} 个字按阅读顺序成形 ${order_ok ? '✓' : '✗'}` : `${parts.n} particles; at rest ${(agree * 100).toFixed(2)} % agree with the typeset text (${(exact / ink * 100).toFixed(2)} % identical); ${glyphs.length} glyphs formed in reading order ${order_ok ? '✓' : '✗'}` };
    },
  };
}
