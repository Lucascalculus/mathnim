// TeX (via MathJax, same version/config as the Python side) and Text.
// TeX glyphs become real Bezier VMobjects using manim's SVG conversion rules,
// so they can be transformed, faded, and drawn exactly like manim's.
import { VMobject, VGroup, rgb } from './core.js';
import { Rectangle } from './geometry.js';

// ------------------------------------------------------------------ MathJax
let mjReady = null;
// MathJax 3 (default, matches the Python side) or MathJax 4 with a choice of
// math font, e.g. loadMathJax({ font: 'mathjax-fira' }). MathJax 4 fonts load
// glyph ranges lazily, so `warmup` pre-renders the symbols a lesson uses;
// afterwards every Tex() call is synchronous.
export function loadMathJax(opts = '../vendor/tex-svg-full.js') {
  if (mjReady) return mjReady;
  const o = typeof opts === 'string' ? { src: opts } : opts;
  const v4 = !!o.font;
  window.MathJax = v4
    ? {
        loader: { load: ['[tex]/color'] },
        tex: { packages: { '[+]': ['color'] } },
        output: { font: o.font },
        svg: { fontCache: 'none' },
        startup: { typeset: false },
        options: { enableMenu: false },
      }
    : { svg: { fontCache: 'none' }, startup: { typeset: false }, options: { enableMenu: false } };
  const src = o.src ?? (v4 ? 'https://cdn.jsdelivr.net/npm/mathjax@4/tex-svg.js' : '../vendor/tex-svg-full.js');
  mjReady = new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = src;
    s.onload = () => window.MathJax.startup.promise.then(resolve);
    s.onerror = reject;
    document.head.appendChild(s);
  }).then(async () => {
    for (const tex of o.warmup ?? []) await window.MathJax.tex2svgPromise(tex, { display: true });
  });
  return mjReady;
}

const svgCache = new Map();
function texSvg(tex, display = true) {
  const key = display + '|' + tex;
  if (!svgCache.has(key)) {
    const node = window.MathJax.tex2svg(tex, { display, em: 16, ex: 8, containerWidth: 1280 });
    svgCache.set(key, node.querySelector('svg'));
  }
  return svgCache.get(key);
}

// ------------------------------------------------------------------ SVG -> VMobjects
const IDENT = [1, 0, 0, 1, 0, 0];
const mul = (m, n) => [
  m[0] * n[0] + m[2] * n[1], m[1] * n[0] + m[3] * n[1],
  m[0] * n[2] + m[2] * n[3], m[1] * n[2] + m[3] * n[3],
  m[0] * n[4] + m[2] * n[5] + m[4], m[1] * n[4] + m[3] * n[5] + m[5],
];
const apply = (m, x, y) => [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]];

function parseTransform(s) {
  let m = IDENT;
  if (!s) return m;
  const re = /(\w+)\s*\(([^)]*)\)/g;
  let r;
  while ((r = re.exec(s))) {
    const v = r[2].split(/[\s,]+/).filter(Boolean).map(Number);
    let t = IDENT;
    if (r[1] === 'translate') t = [1, 0, 0, 1, v[0], v[1] ?? 0];
    else if (r[1] === 'scale') t = [v[0], 0, 0, v[1] ?? v[0], 0, 0];
    else if (r[1] === 'matrix') t = v;
    else if (r[1] === 'rotate') {
      const a = (v[0] * Math.PI) / 180, c = Math.cos(a), sn = Math.sin(a);
      t = [c, sn, -sn, c, 0, 0];
    }
    m = mul(m, t);
  }
  return m;
}

function tokenizePath(d) {
  const out = [];
  const re = /([MmLlHhVvCcSsQqTtZzAa])|(-?(?:\d+\.?\d*|\.\d+)(?:[eE][-+]?\d+)?)/g;
  let r;
  while ((r = re.exec(d))) out.push(r[1] ?? Number(r[2]));
  return out;
}

// Follows manim's VMobjectFromSVGPath.handle_commands (cubic mode)
function pathToPoints(d, ctm) {
  const toks = tokenizePath(d);
  const pts = [];
  let i = 0, cmd = null;
  let cur = [0, 0], start = [0, 0], lastCtrl = null, lastCmd = null;
  const T = (p) => apply(ctm, p[0], p[1]);
  const cubic = (a, b, c, e) => pts.push(T(a), T(b), T(c), T(e));
  const line = (a, e) => cubic(a, [(2 * a[0] + e[0]) / 3, (2 * a[1] + e[1]) / 3], [(a[0] + 2 * e[0]) / 3, (a[1] + 2 * e[1]) / 3], e);
  const quad = (a, c, e) => cubic(a, [(a[0] + 2 * c[0]) / 3, (a[1] + 2 * c[1]) / 3], [(2 * c[0] + e[0]) / 3, (2 * c[1] + e[1]) / 3], e);
  const num = () => toks[i++];
  while (i < toks.length) {
    if (typeof toks[i] === 'string') cmd = toks[i++];
    const rel = cmd === cmd.toLowerCase();
    const C = cmd.toUpperCase();
    const P = () => {
      const x = num(), y = num();
      return rel ? [cur[0] + x, cur[1] + y] : [x, y];
    };
    if (C === 'M') {
      cur = P();
      start = cur;
      cmd = rel ? 'l' : 'L';
      lastCtrl = null;
      lastCmd = 'M';
      continue;
    }
    if (C === 'Z') {
      if (Math.hypot(cur[0] - start[0], cur[1] - start[1]) > 0.0001) line(cur, start);
      cur = start;
      lastCtrl = null;
      lastCmd = 'Z';
      continue;
    }
    if (C === 'L') { const e = P(); line(cur, e); cur = e; lastCtrl = null; }
    else if (C === 'H') { const x = num(); const e = [rel ? cur[0] + x : x, cur[1]]; line(cur, e); cur = e; lastCtrl = null; }
    else if (C === 'V') { const y = num(); const e = [cur[0], rel ? cur[1] + y : y]; line(cur, e); cur = e; lastCtrl = null; }
    else if (C === 'C') { const a = P(), b = P(), e = P(); cubic(cur, a, b, e); lastCtrl = b; cur = e; }
    else if (C === 'S') {
      const a = lastCtrl && 'CS'.includes(lastCmd) ? [2 * cur[0] - lastCtrl[0], 2 * cur[1] - lastCtrl[1]] : cur;
      const b = P(), e = P(); cubic(cur, a, b, e); lastCtrl = b; cur = e;
    } else if (C === 'Q') { const c = P(), e = P(); quad(cur, c, e); lastCtrl = c; cur = e; }
    else if (C === 'T') {
      const c = lastCtrl && 'QT'.includes(lastCmd) ? [2 * cur[0] - lastCtrl[0], 2 * cur[1] - lastCtrl[1]] : cur;
      const e = P(); quad(cur, c, e); lastCtrl = c; cur = e;
    } else throw new Error('Unsupported path command ' + cmd);
    lastCmd = C;
  }
  return pts;
}

function svgToMobjects(svg) {
  const out = [];
  const colorOf = (c) => (c && c.startsWith('#') ? c : '#000000');
  const walk = (el, ctm, fill, stroke) => {
    const tag = el.tagName.toLowerCase();
    let m = mul(ctm, parseTransform(el.getAttribute('transform')));
    if (tag === 'svg' && el !== svg) m = mul(m, [1, 0, 0, 1, +el.getAttribute('x') || 0, +el.getAttribute('y') || 0]);
    const f = el.getAttribute('fill') ?? fill;
    const st = el.getAttribute('stroke') ?? stroke;
    if (tag === 'path') {
      const pts = pathToPoints(el.getAttribute('d') || '', m);
      if (pts.length) {
        const v = new VMobject({ fillOpacity: 1, strokeWidth: 0 });
        v.setPoints(pts);
        v.svgFill = f;
        v.setStroke(colorOf(st), null, null, false);
        out.push(v);
      }
    } else if (tag === 'rect') {
      const x = +el.getAttribute('x') || 0, y = +el.getAttribute('y') || 0;
      const w = +el.getAttribute('width'), h = +el.getAttribute('height');
      const r = new Rectangle({ width: w, height: h, fillOpacity: 1, strokeWidth: 0 });
      r.shift([x + w / 2, y + h / 2]);
      r.applyPoints((px, py) => apply(m, px, py));
      r.svgFill = f;
      r.setStroke(colorOf(st), null, null, false);
      out.push(r);
    }
    for (const c of el.children) walk(c, m, f, st);
  };
  walk(svg, IDENT, null, null);
  const g = new VGroup(...out);
  g.flipY(); // manim: self.flip(RIGHT)
  return out;
}

// ------------------------------------------------------------------ Tex
export const EM_AT_48 = 0.62;
const tag = (i) => '#' + ((i + 1) * 3).toString(16).padStart(6, '0');

export class Tex extends VGroup {
  constructor(parts, o = {}) {
    super();
    parts = Array.isArray(parts) ? parts : [parts];
    const fontSize = o.fontSize ?? 48;
    const body = parts.map((p, i) => `\\color{${tag(i)}} ${p}`).join(' ');
    const glyphs = svgToMobjects(texSvg(body, o.display !== false));
    const buckets = parts.map(() => []);
    const lookup = new Map(parts.map((_, i) => [tag(i), i]));
    for (const gl of glyphs) {
      const idx = lookup.get((gl.svgFill || '').toLowerCase());
      buckets[idx ?? parts.length - 1].push(gl);
    }
    parts.forEach((p, i) => {
      const part = new VGroup(...buckets[i]);
      part.texString = p;
      this.add(part);
    });
    new VGroup(...glyphs).scale((EM_AT_48 * fontSize) / 48 / 1000, { aboutPoint: [0, 0] });
    this.center();
    this.setFill(o.color ?? '#FFFFFF', 1).setStroke(null, 0);
  }
}

// ------------------------------------------------------------------ Text
// Drawn with the browser's text engine; the mobject's points are its ink
// bounding box, so every layout operation (next_to, arrange, scale...) works.
// Sizing follows manim: 1 em = font_size / 72 units.
//   default      : the browser's own layout (kerning, ligatures)
//   compat: true : emulates manim/Pango at small sizes (advances hinted to
//                  whole units), used by the manim bake-off
const WEIGHTS = { NORMAL: 400, BOOK: 400, MEDIUM: 500, SEMIBOLD: 600, BOLD: 700, HEAVY: 800, BLACK: 900 };
let mctx = null;

export class Text extends VMobject {
  constructor(text, o = {}) {
    super({ color: o.color ?? '#FFFFFF', fillOpacity: 1, strokeWidth: 0 });
    const family = o.font ?? 'Avenir Next';
    const weight = WEIGHTS[o.weight ?? 'NORMAL'] ?? o.weight ?? 400;
    const style = o.slant === 'ITALIC' || o.italic ? 'italic' : 'normal';
    const fs = o.fontSize ?? 48;
    const E = fs / 3.6; // em in Pango/SVG device units
    const k = 0.05; // TEXT_MOB_SCALE_FACTOR
    const u = E / 100;
    if (!mctx) mctx = document.createElement('canvas').getContext('2d');
    mctx.font = `${style} ${weight} 100px '${family}'`;
    if (o.letterSpacing) mctx.letterSpacing = `${o.letterSpacing * 100}px`;
    else mctx.letterSpacing = '0px';
    let glyphs, left, right, asc, desc;
    if (o.compat) {
      glyphs = [];
      let x = 0;
      left = Infinity; right = -Infinity; asc = 0; desc = 0;
      const chars = [...text];
      chars.forEach((ch, i) => {
        const m = mctx.measureText(ch);
        const next = chars[i + 1];
        const adv = next ? mctx.measureText(ch + next).width - mctx.measureText(next).width : m.width;
        if (ch.trim()) {
          left = Math.min(left, x - m.actualBoundingBoxLeft * u);
          right = Math.max(right, x + m.actualBoundingBoxRight * u);
          asc = Math.max(asc, m.actualBoundingBoxAscent * u);
          desc = Math.max(desc, m.actualBoundingBoxDescent * u);
        }
        glyphs.push({ ch, x: x * k });
        x += Math.round(adv * u);
      });
    } else {
      const m = mctx.measureText(text);
      glyphs = [{ ch: text, x: 0 }];
      left = -m.actualBoundingBoxLeft * u;
      right = m.actualBoundingBoxRight * u;
      asc = m.actualBoundingBoxAscent * u;
      desc = m.actualBoundingBoxDescent * u;
    }
    const x0 = left * k, x1 = right * k, y0 = -desc * k, y1 = asc * k;
    this.text = text;
    this.drawText = { glyphs, family, weight, style, letterSpacing: o.letterSpacing ?? 0, em: E * k, w0: x1 - x0, fx: (0 - x0) / (x1 - x0), fy: (0 - y0) / (y1 - y0) };
    this.setPointsAsCorners([[x1, y1], [x0, y1], [x0, y0], [x1, y0], [x1, y1]]);
    this.center();
  }
}
