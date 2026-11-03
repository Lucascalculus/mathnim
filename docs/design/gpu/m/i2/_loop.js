// Shared pieces for the learning-loop materials (patina, spot, bins, ghost, seam): a 2D canvas fitted to its box,
// the verb button, a seeded random, and the palette as CSS strings. Kept small on purpose.
import { SANS, SERIF, C, roundrect } from '../../lib/ui.js';
export { SANS, SERIF, C, roundrect };

export const GR = (a) => `rgba(26,27,31,${a})`;            // ink at an alpha, for scaffolding and shadows
export const rgba = (hex, a) => { const n = parseInt(hex.slice(1), 16); return `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},${a})`; };

// a 2D context sized to the canvas box at the device pixel ratio (capped at 2); call again on resize
export function fit2d(canvas, ctx) {
  const r = canvas.getBoundingClientRect(), dpr = Math.min(2, devicePixelRatio || 1);
  canvas.width = Math.max(2, Math.round(r.width * dpr)); canvas.height = Math.max(2, Math.round(r.height * dpr));
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  return { W: r.width, H: r.height, dpr };
}

export function mulberry(a) { return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }

export function css_once(id, text) {
  if (document.getElementById(id)) return;
  const st = document.createElement('style'); st.id = id; st.textContent = text; document.head.append(st);
}

// the one verb: a vermilion pill (primary) or a quiet white one (secondary). 44 px tall for the thumb.
css_once('loop-css', `
.lp-verb{position:absolute;height:44px;padding:0 22px;border-radius:22px;border:0;font:600 16px ${SANS};cursor:pointer;white-space:nowrap;
  transition:opacity .25s, transform .25s, background-color .2s, color .2s, box-shadow .2s;-webkit-tap-highlight-color:transparent}
.lp-verb.primary{background:${C.vermilion};color:#fff;box-shadow:0 6px 16px rgba(227,71,44,.26)}
.lp-verb.quiet{background:#fff;color:${C.ink};box-shadow:0 0 0 1px rgba(26,27,31,.14),0 2px 6px rgba(26,27,31,.06)}
.lp-verb.away{opacity:0;transform:translateY(8px);pointer-events:none}
.lp-verb:active{transform:scale(.97)}
`);
export function verb(stage, text) {
  const b = document.createElement('button'); b.className = 'lp-verb primary'; b.textContent = text; stage.append(b);
  return b;
}

// local pointer position in CSS px
export const local = (canvas, e) => { const r = canvas.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };
