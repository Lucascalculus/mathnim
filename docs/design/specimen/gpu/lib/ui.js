// What every material shares, GPU or not: the palette and fonts, a frame scheduler that stops drawing when nothing
// changes, springs, and the small 2D helpers (a canvas fitted to its box, a style injector, the one verb).

export const SANS = '-apple-system, BlinkMacSystemFont, "PingFang SC", "Hiragino Sans GB", "Noto Sans SC", "Noto Sans CJK SC", sans-serif';
export const SERIF = '"Songti SC", "STSong", "Noto Serif SC", "Noto Serif CJK SC", Georgia, serif';
export const C = { paper: '#fbfaf7', ink: '#1a1b1f', ink2: '#44464d', graphite: '#8d9198', cobalt: '#2f5bd2', ochre: '#c8861a', teal: '#11899e', violet: '#6a4ec4', viridian: '#13876a', vermilion: '#e3472c' };
export const GR = (a) => `rgba(26,27,31,${a})`;            // ink at an alpha, for scaffolding and shadows
export const rgba = (hex, a) => { const n = parseInt(hex.slice(1), 16); return `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},${a})`; };

// a style sheet, added once per id
export function css(id, text) {
  if (document.getElementById(id)) return;
  const st = document.createElement('style'); st.id = id; st.textContent = text; document.head.append(st);
}

// a canvas sized to its CSS box at the device pixel ratio (capped at 2); with a 2D context, drawing is then in CSS px.
// Call again on resize.
export function fit2d(canvas, ctx) {
  const r = canvas.getBoundingClientRect(), dpr = Math.min(2, devicePixelRatio || 1);
  canvas.width = Math.max(2, Math.round(r.width * dpr)); canvas.height = Math.max(2, Math.round(r.height * dpr));
  if (ctx) ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  return { W: r.width, H: r.height, dpr };
}
// the same, kept with its context: {ctx, W, H, dpr, fit()}
export function canvas2d(canvas) {
  const o = { ctx: canvas.getContext('2d'), W: 0, H: 0, dpr: 1 };
  o.fit = () => Object.assign(o, fit2d(canvas, o.ctx));
  o.fit();
  return o;
}
// a pointer's position inside an element, in CSS px
export const local = (el, e) => { const r = el.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };
// a seeded random in [0, 1)
export function mulberry(a) { return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
export function roundrect(g, x, y, w, h, r) { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); }

// the one verb: a vermilion pill (primary) or a quiet white one (secondary), 44 px tall for the thumb
export function verb(stage, text) {
  css('verb-css', `
.lp-verb{position:absolute;height:44px;padding:0 22px;border-radius:22px;border:0;font:600 16px ${SANS};cursor:pointer;white-space:nowrap;
  transition:opacity .25s, transform .25s, background-color .2s, color .2s, box-shadow .2s;-webkit-tap-highlight-color:transparent}
.lp-verb.primary{background:${C.vermilion};color:#fff;box-shadow:0 6px 16px rgba(227,71,44,.26)}
.lp-verb.quiet{background:#fff;color:${C.ink};box-shadow:0 0 0 1px rgba(26,27,31,.14),0 2px 6px rgba(26,27,31,.06)}
.lp-verb.away{opacity:0;transform:translateY(8px);pointer-events:none}
.lp-verb:active{transform:scale(.97)}
`);
  const b = document.createElement('button'); b.className = 'lp-verb primary'; b.textContent = text; stage.append(b);
  return b;
}

// The scheduler: a material asks for frames while it is changing and returns false when it has settled.
// Frames stop when nothing moves (quiet at rest) and while the tile is off screen.
export function scheduler(step) {
  let raf = 0, last = 0, visible = true, awake_until = 0;
  const s = {
    frames: 0, fps: 0, _t0: 0, _f0: 0,
    wake(ms = 1500) { awake_until = Math.max(awake_until, performance.now() + ms); if (!raf && visible) raf = requestAnimationFrame(tick); },
    set_visible(v) { visible = v; if (v) s.wake(300); },
  };
  function tick(t) {
    raf = 0;
    const dt = Math.min(1 / 20, last ? (t - last) / 1000 : 1 / 60); last = t;
    const busy = step(dt, t / 1000);
    s.frames++;
    if (t - s._t0 > 500) { s.fps = (s.frames - s._f0) * 1000 / (t - s._t0); s._t0 = t; s._f0 = s.frames; }
    if (visible && (busy || t < awake_until)) raf = requestAnimationFrame(tick); else last = 0;
  }
  return s;
}

// A spring with SwiftUI's parameters: response (seconds per cycle) and damping fraction (1 = critical).
// Retargeting keeps the velocity, so every motion can be interrupted without a jolt.
export class Spring {
  constructor(x = 0, response = 0.45, damping = 0.82) { this.x = x; this.v = 0; this.target = x; this.set(response, damping); }
  set(response, damping) { this.k = (2 * Math.PI / response) ** 2; this.c = 4 * Math.PI * damping / response; return this; }
  to(t) { this.target = t; return this; }
  step(dt) {
    // semi-implicit Euler in small substeps: stable for stiff springs
    const n = Math.max(1, Math.ceil(dt / (1 / 240)));
    for (let i = 0; i < n; i++) { const h = dt / n, a = -this.k * (this.x - this.target) - this.c * this.v; this.v += a * h; this.x += this.v * h; }
    return this.busy();
  }
  busy() { return Math.abs(this.x - this.target) > 1e-4 || Math.abs(this.v) > 1e-3; }
  snap(t) { this.x = this.target = t; this.v = 0; return this; }
}
export class Spring2 {
  constructor(x = 0, y = 0, r, d) { this.a = new Spring(x, r, d); this.b = new Spring(y, r, d); }
  to(x, y) { this.a.to(x); this.b.to(y); return this; }
  step(dt) { const p = this.a.step(dt), q = this.b.step(dt); return p || q; }
  get x() { return this.a.x; } get y() { return this.b.x; }
  set(r, d) { this.a.set(r, d); this.b.set(r, d); return this; }
}
