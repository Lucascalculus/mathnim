// Shared pieces for the text materials (stretch, why, focus, hint, lighttext): a CSS injector, a 2D canvas fitted to
// its box, WCAG contrast, and a tokenizer that knows which punctuation may not start or end a line (kinsoku), so
// every material breaks Chinese and English lines the same way.
import { C, SANS, SERIF } from '../../lib/ui.js';

export { C, SANS, SERIF };

export function css(id, text) {
  if (document.getElementById(id)) return;
  const st = document.createElement('style'); st.id = id; st.textContent = text; document.head.append(st);
}

// a 2D canvas sized to its CSS box at the device ratio (capped at 2)
export function canvas2d(cv) {
  const o = { ctx: cv.getContext('2d', { willReadFrequently: true }), W: 0, H: 0, dpr: 1 };
  o.fit = () => {
    const r = cv.getBoundingClientRect(); o.dpr = Math.min(2, devicePixelRatio || 1);
    cv.width = Math.max(2, Math.round(r.width * o.dpr)); cv.height = Math.max(2, Math.round(r.height * o.dpr)); o.W = r.width; o.H = r.height;
    o.ctx.setTransform(o.dpr, 0, 0, o.dpr, 0, 0);
  };
  o.fit();
  return o;
}

// WCAG 2 relative luminance and contrast ratio of two [r, g, b] (0..255)
const lin = (c) => { c /= 255; return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
export const luminance = ([r, g, b]) => 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
export const contrast = (a, b) => { const x = luminance(a), y = luminance(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
export const hex = (h) => { const n = parseInt(h.slice(1), 16); return [n >> 16, (n >> 8) & 255, n & 255]; };
export const mix = (a, b, t) => [0, 1, 2].map((i) => a[i] + (b[i] - a[i]) * t);
export const rgb = (c) => `rgb(${c.map((v) => Math.round(v)).join(',')})`;

// punctuation that never starts a line, and that never ends one
const NO_START = /^[，。、；：？！）」』”’》〉…—,.;:?!)\]’”%]/;
const NO_END = /[（「『“‘《〈(\[‘“]$/;
const CJK = /[　-鿿＀-￯]/;

// split a run of text into tokens: one per CJK character, one per Latin word (with the space after it noted)
export function tokens(text) {
  const out = [];
  const re = /([A-Za-z0-9À-ɏ.'’²³⁰-⁹₀-₉×−+=\-/]+)|(\s+)|(.)/gu;
  let m;
  while ((m = re.exec(text))) {
    if (m[2]) { if (out.length) out[out.length - 1].sp = true; continue; }
    const t = m[1] || m[3];
    out.push({ t, sp: false, cjk: CJK.test(t) });
  }
  return out;
}
export const no_start = (t) => NO_START.test(t);
export const no_end = (t) => NO_END.test(t);
