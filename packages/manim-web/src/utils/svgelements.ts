// web: a small pure-TypeScript stand-in for the `svgelements` Python package
// that manim's SVGMobject uses. No DOM: works in node and in the browser.
// It parses SVG documents (XML, styles, CSS classes, transforms, <use>/<defs>,
// nested <svg>) into a tree of groups and shapes whose transforms are
// "reified" (applied to the geometry) exactly where svgelements does it.

/** Affine matrix [a, b, c, d, e, f]: x' = a x + c y + e, y' = b x + d y + f. */
export type SVGMatrix = [number, number, number, number, number, number];
export type XY = [number, number];

export const IDENTITY_MATRIX: SVGMatrix = [1, 0, 0, 1, 0, 0];

/** m * n (n is applied first). */
export function matrix_multiply(m: readonly number[], n: readonly number[]): SVGMatrix {
  return [
    m[0] * n[0] + m[2] * n[1], m[1] * n[0] + m[3] * n[1],
    m[0] * n[2] + m[2] * n[3], m[1] * n[2] + m[3] * n[3],
    m[0] * n[4] + m[2] * n[5] + m[4], m[1] * n[4] + m[3] * n[5] + m[5],
  ];
}
export function matrix_apply(m: readonly number[], x: number, y: number): XY {
  return [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]];
}
const isIdentity = (m: readonly number[]) => m[0] === 1 && m[1] === 0 && m[2] === 0 && m[3] === 1 && m[4] === 0 && m[5] === 0;

/** Parse an SVG `transform` attribute. */
export function parse_transform(s: string | null | undefined): SVGMatrix {
  let m: SVGMatrix = IDENTITY_MATRIX;
  if (!s) return m;
  const re = /(matrix|translate|scale|rotate|skewX|skewY)\s*\(([^)]*)\)/g;
  let r: RegExpExecArray | null;
  while ((r = re.exec(s))) {
    const v = (r[2].match(/[-+]?(?:\d+\.?\d*|\.\d+)(?:[eE][-+]?\d+)?/g) ?? []).map(Number);
    let t: SVGMatrix = IDENTITY_MATRIX;
    switch (r[1]) {
      case 'matrix':
        if (v.length >= 6) t = [v[0], v[1], v[2], v[3], v[4], v[5]];
        break;
      case 'translate':
        t = [1, 0, 0, 1, v[0] ?? 0, v[1] ?? 0];
        break;
      case 'scale':
        t = [v[0] ?? 1, 0, 0, v[1] ?? v[0] ?? 1, 0, 0];
        break;
      case 'rotate': {
        const a = ((v[0] ?? 0) * Math.PI) / 180, c = Math.cos(a), sn = Math.sin(a);
        t = [c, sn, -sn, c, 0, 0];
        if (v.length >= 3) t = matrix_multiply(matrix_multiply([1, 0, 0, 1, v[1], v[2]], t), [1, 0, 0, 1, -v[1], -v[2]]);
        break;
      }
      case 'skewX':
        t = [1, 0, Math.tan(((v[0] ?? 0) * Math.PI) / 180), 1, 0, 0];
        break;
      case 'skewY':
        t = [1, Math.tan(((v[0] ?? 0) * Math.PI) / 180), 0, 1, 0, 0];
        break;
    }
    m = matrix_multiply(m, t);
  }
  return m;
}

// ------------------------------------------------------------------ paths
/** One absolute path segment (svgelements' Move, Line, QuadraticBezier, CubicBezier, Arc, Close). */
export type SVGSegment =
  | { type: 'M'; start: XY | null; end: XY }
  | { type: 'L'; start: XY; end: XY }
  | { type: 'Q'; start: XY; control: XY; end: XY }
  | { type: 'C'; start: XY; control1: XY; control2: XY; end: XY }
  | { type: 'A'; start: XY; end: XY; rx: number; ry: number; rotation: number; large_arc: boolean; sweep: boolean }
  | { type: 'Z'; start: XY; end: XY };

class Scanner {
  i = 0;
  constructor(readonly s: string) {}
  skip(): void {
    const s = this.s;
    while (this.i < s.length && (s[this.i] === ',' || s[this.i] === ' ' || s[this.i] === '\t' || s[this.i] === '\n' || s[this.i] === '\r' || s[this.i] === '\f')) this.i++;
  }
  done(): boolean {
    this.skip();
    return this.i >= this.s.length;
  }
  peekCommand(): string | null {
    this.skip();
    const c = this.s[this.i];
    return c !== undefined && /[MmZzLlHhVvCcSsQqTtAa]/.test(c) ? c : null;
  }
  number(): number {
    this.skip();
    const re = /[-+]?(?:\d+\.?\d*|\.\d+)(?:[eE][-+]?\d+)?/y;
    re.lastIndex = this.i;
    const m = re.exec(this.s);
    if (!m) throw new Error(`SVG path: expected a number at ${this.i} in "${this.s.slice(this.i, this.i + 20)}"`);
    this.i = re.lastIndex;
    return Number(m[0]);
  }
  flag(): boolean {
    this.skip();
    const c = this.s[this.i++];
    if (c !== '0' && c !== '1') throw new Error('SVG path: bad arc flag');
    return c === '1';
  }
}

/** Parse path data into absolute segments (like svgelements.Path(d)). */
export function parse_path(d: string): SVGSegment[] {
  const out: SVGSegment[] = [];
  const sc = new Scanner(d);
  let cur: XY = [0, 0];
  let start: XY = [0, 0];
  let cmd: string | null = null;
  let prev: SVGSegment | null = null;
  while (!sc.done()) {
    const c = sc.peekCommand();
    if (c) {
      sc.i++;
      cmd = c;
    } else if (cmd === null) throw new Error(`SVG path: missing command in "${d.slice(0, 30)}"`);
    const C: string = cmd!.toUpperCase();
    const rel: boolean = cmd !== C;
    const pt = (): XY => {
      const x = sc.number(), y = sc.number();
      return rel ? [cur[0] + x, cur[1] + y] : [x, y];
    };
    let seg: SVGSegment;
    switch (C) {
      case 'M': {
        const e = pt();
        seg = { type: 'M', start: out.length ? cur : null, end: e };
        start = e;
        cmd = rel ? 'l' : 'L';
        break;
      }
      case 'Z':
        seg = { type: 'Z', start: cur, end: start };
        break;
      case 'L':
        seg = { type: 'L', start: cur, end: pt() };
        break;
      case 'H': {
        const x = sc.number();
        seg = { type: 'L', start: cur, end: [rel ? cur[0] + x : x, cur[1]] };
        break;
      }
      case 'V': {
        const y = sc.number();
        seg = { type: 'L', start: cur, end: [cur[0], rel ? cur[1] + y : y] };
        break;
      }
      case 'C': {
        const c1 = pt(), c2 = pt(), e = pt();
        seg = { type: 'C', start: cur, control1: c1, control2: c2, end: e };
        break;
      }
      case 'S': {
        const c1: XY = prev && prev.type === 'C' ? [2 * cur[0] - prev.control2[0], 2 * cur[1] - prev.control2[1]] : cur;
        const c2 = pt(), e = pt();
        seg = { type: 'C', start: cur, control1: c1, control2: c2, end: e };
        break;
      }
      case 'Q': {
        const q = pt(), e = pt();
        seg = { type: 'Q', start: cur, control: q, end: e };
        break;
      }
      case 'T': {
        const q: XY = prev && prev.type === 'Q' ? [2 * cur[0] - prev.control[0], 2 * cur[1] - prev.control[1]] : cur;
        seg = { type: 'Q', start: cur, control: q, end: pt() };
        break;
      }
      case 'A': {
        const rx = sc.number(), ry = sc.number(), rot = sc.number(), la = sc.flag(), sw = sc.flag();
        seg = { type: 'A', start: cur, end: pt(), rx, ry, rotation: rot, large_arc: la, sweep: sw };
        break;
      }
      default:
        throw new Error(`SVG path: unknown command ${cmd}`);
    }
    out.push(seg);
    cur = seg.end;
    prev = seg;
    // numbers after Z need a new command letter
    if (C === 'Z') cmd = null;
  }
  return out;
}

/** Apply a matrix to every point of the segments (svgelements' Path.reify). */
export function transform_segments(segs: readonly SVGSegment[], m: readonly number[]): SVGSegment[] {
  if (isIdentity(m)) return segs.slice();
  const T = (p: XY): XY => matrix_apply(m, p[0], p[1]);
  return segs.map((s): SVGSegment => {
    switch (s.type) {
      case 'M':
        return { type: 'M', start: s.start && T(s.start), end: T(s.end) };
      case 'L':
      case 'Z':
        return { type: s.type, start: T(s.start), end: T(s.end) };
      case 'Q':
        return { type: 'Q', start: T(s.start), control: T(s.control), end: T(s.end) };
      case 'C':
        return { type: 'C', start: T(s.start), control1: T(s.control1), control2: T(s.control2), end: T(s.end) };
      case 'A':
        // the image of an elliptical arc under an affine map is an elliptical arc
        return { ...s, start: T(s.start), end: T(s.end), ...transform_arc_radii(s, m) };
    }
  });
}

function transform_arc_radii(s: Extract<SVGSegment, { type: 'A' }>, m: readonly number[]): { rx: number; ry: number; rotation: number; sweep: boolean } {
  // image of the ellipse x = R(phi) diag(rx, ry) u under M's linear part: M R D = U S V^T
  const phi = (s.rotation * Math.PI) / 180, c = Math.cos(phi), sn = Math.sin(phi);
  const A = [m[0] * c * s.rx + m[2] * sn * s.rx, m[1] * c * s.rx + m[3] * sn * s.rx, -m[0] * sn * s.ry + m[2] * c * s.ry, -m[1] * sn * s.ry + m[3] * c * s.ry];
  // A = [[A0, A2], [A1, A3]]; singular values / left singular vectors of A
  const E = (A[0] + A[3]) / 2, F = (A[0] - A[3]) / 2, G = (A[1] + A[2]) / 2, H = (A[1] - A[2]) / 2;
  const Q = Math.hypot(E, H), R = Math.hypot(F, G);
  const a1 = Math.atan2(G, F), a2 = Math.atan2(H, E);
  const theta = (a2 + a1) / 2;
  const det = m[0] * m[3] - m[1] * m[2];
  return { rx: Q + R, ry: Math.abs(Q - R), rotation: (theta * 180) / Math.PI, sweep: det < 0 ? !s.sweep : s.sweep };
}

interface ArcParams { cx: number; cy: number; rx: number; ry: number; phi: number; t1: number; dt: number }
function arc_center_parameters(s: Extract<SVGSegment, { type: 'A' }>): ArcParams | null {
  const [x1, y1] = s.start, [x2, y2] = s.end;
  let rx = Math.abs(s.rx), ry = Math.abs(s.ry);
  if (rx === 0 || ry === 0 || (x1 === x2 && y1 === y2)) return null;
  const phi = (s.rotation * Math.PI) / 180, c = Math.cos(phi), sn = Math.sin(phi);
  const dx = (x1 - x2) / 2, dy = (y1 - y2) / 2;
  const xp = c * dx + sn * dy, yp = -sn * dx + c * dy;
  const lam = (xp * xp) / (rx * rx) + (yp * yp) / (ry * ry);
  if (lam > 1) {
    rx *= Math.sqrt(lam);
    ry *= Math.sqrt(lam);
  }
  const num = rx * rx * ry * ry - rx * rx * yp * yp - ry * ry * xp * xp;
  const den = rx * rx * yp * yp + ry * ry * xp * xp;
  let k = Math.sqrt(Math.max(0, num / den));
  if (s.large_arc === s.sweep) k = -k;
  const cxp = (k * rx * yp) / ry, cyp = (-k * ry * xp) / rx;
  const cx = c * cxp - sn * cyp + (x1 + x2) / 2, cy = sn * cxp + c * cyp + (y1 + y2) / 2;
  const ang = (ux: number, uy: number, vx: number, vy: number) => Math.atan2(ux * vy - uy * vx, ux * vx + uy * vy);
  const t1 = ang(1, 0, (xp - cxp) / rx, (yp - cyp) / ry);
  let dt = ang((xp - cxp) / rx, (yp - cyp) / ry, (-xp - cxp) / rx, (-yp - cyp) / ry);
  if (!s.sweep && dt > 0) dt -= 2 * Math.PI;
  else if (s.sweep && dt < 0) dt += 2 * Math.PI;
  return { cx, cy, rx, ry, phi, t1, dt };
}

/** svgelements' Path.approximate_arcs_with_quads(error=0.1) / Arc.as_quad_curves. */
export function approximate_arcs_with_quads(segs: readonly SVGSegment[], error = 0.1): SVGSegment[] {
  const sweep_limit = 2 * Math.PI * error;
  const out: SVGSegment[] = [];
  for (const s of segs) {
    if (s.type !== 'A') {
      out.push(s);
      continue;
    }
    const a = arc_center_parameters(s);
    if (!a) {
      out.push({ type: 'L', start: s.start, end: s.end });
      continue;
    }
    const n = Math.ceil(Math.abs(a.dt) / sweep_limit);
    if (n === 0) continue;
    const t_slice = a.dt / n;
    const cp = Math.cos(a.phi), sp = Math.sin(a.phi);
    const at = (t: number): XY => [a.cx + a.rx * Math.cos(t) * cp - a.ry * Math.sin(t) * sp, a.cy + a.rx * Math.cos(t) * sp + a.ry * Math.sin(t) * cp];
    let t = a.t1;
    let p0 = s.start;
    for (let i = 0; i < n; i++) {
      const nt = t + t_slice, mt = (nt + t) / 2;
      const p1 = i === n - 1 ? s.end : at(nt);
      const alpha = (4 - Math.cos(t_slice)) / 3;
      const px = a.cx + alpha * (a.rx * Math.cos(mt) * cp - a.ry * Math.sin(mt) * sp);
      const py = a.cy + alpha * (a.rx * Math.cos(mt) * sp + a.ry * Math.sin(mt) * cp);
      out.push({ type: 'Q', start: p0, control: [px, py], end: p1 });
      p0 = p1;
      t = nt;
    }
  }
  return out;
}

const fmt = (x: number) => {
  const r = Math.round(x * 1e4) / 1e4;
  return Object.is(r, -0) ? '0' : String(r);
};
/** Serialise absolute segments as path data (4 decimals). */
export function segments_to_d(segs: readonly SVGSegment[]): string {
  const p = (q: XY) => fmt(q[0]) + ' ' + fmt(q[1]);
  return segs.map((s) => {
    switch (s.type) {
      case 'M': return 'M' + p(s.end);
      case 'L': return 'L' + p(s.end);
      case 'Q': return 'Q' + p(s.control) + ' ' + p(s.end);
      case 'C': return 'C' + p(s.control1) + ' ' + p(s.control2) + ' ' + p(s.end);
      case 'A': return `A${fmt(s.rx)} ${fmt(s.ry)} ${fmt(s.rotation)} ${+s.large_arc} ${+s.sweep} ${p(s.end)}`;
      case 'Z': return 'Z';
    }
  }).join('');
}

// ------------------------------------------------------------------ XML
/** A parsed XML element. */
export interface XMLElement {
  tag: string;
  attrs: Record<string, string>;
  children: XMLElement[];
  text: string;
}
const ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };
const decode = (s: string) =>
  s.indexOf('&') < 0 ? s : s.replace(/&(#x[0-9a-fA-F]+|#\d+|\w+);/g, (m, e: string) =>
    e[0] === '#' ? String.fromCodePoint(e[1] === 'x' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10)) : ENTITIES[e] ?? m);

/** Minimal non-validating XML parser (elements, attributes, text, CDATA; comments/PIs/DOCTYPE skipped). */
export function parse_xml(src: string): XMLElement {
  const root: XMLElement = { tag: '#document', attrs: {}, children: [], text: '' };
  const stack: XMLElement[] = [root];
  let i = 0;
  const n = src.length;
  while (i < n) {
    const lt = src.indexOf('<', i);
    if (lt < 0) break;
    if (lt > i) stack[stack.length - 1].text += decode(src.slice(i, lt));
    if (src.startsWith('<!--', lt)) {
      const e = src.indexOf('-->', lt + 4);
      i = e < 0 ? n : e + 3;
    } else if (src.startsWith('<![CDATA[', lt)) {
      const e = src.indexOf(']]>', lt + 9);
      stack[stack.length - 1].text += src.slice(lt + 9, e < 0 ? n : e);
      i = e < 0 ? n : e + 3;
    } else if (src.startsWith('<?', lt)) {
      const e = src.indexOf('?>', lt + 2);
      i = e < 0 ? n : e + 2;
    } else if (src.startsWith('<!', lt)) {
      // DOCTYPE, possibly with an internal subset [...]
      let j = lt + 2, depth = 0;
      for (; j < n; j++) {
        if (src[j] === '[') depth++;
        else if (src[j] === ']') depth--;
        else if (src[j] === '>' && depth <= 0) break;
      }
      i = j + 1;
    } else if (src[lt + 1] === '/') {
      const e = src.indexOf('>', lt);
      const tag = src.slice(lt + 2, e).trim();
      for (let k = stack.length - 1; k > 0; k--) {
        if (stack[k].tag === tag) {
          stack.length = k;
          break;
        }
      }
      i = e + 1;
    } else {
      const re = /^<([^\s/>]+)/.exec(src.slice(lt, lt + 200));
      if (!re) {
        i = lt + 1;
        continue;
      }
      const el: XMLElement = { tag: re[1], attrs: {}, children: [], text: '' };
      let j = lt + re[0].length;
      const attrRe = /\s*([^\s=/>]+)\s*(?:=\s*("([^"]*)"|'([^']*)'|([^\s>]+)))?/y;
      let selfClose = false;
      for (;;) {
        while (j < n && /\s/.test(src[j])) j++;
        if (src[j] === '>') {
          j++;
          break;
        }
        if (src[j] === '/' && src[j + 1] === '>') {
          selfClose = true;
          j += 2;
          break;
        }
        attrRe.lastIndex = j;
        const a = attrRe.exec(src);
        if (!a) {
          j++;
          continue;
        }
        el.attrs[a[1]] = decode(a[3] ?? a[4] ?? a[5] ?? '');
        j = attrRe.lastIndex;
      }
      stack[stack.length - 1].children.push(el);
      if (!selfClose) stack.push(el);
      i = j;
    }
  }
  return root;
}

// ------------------------------------------------------------------ colours
const NAMED = 'aliceblue:f0f8ff,antiquewhite:faebd7,aqua:00ffff,aquamarine:7fffd4,azure:f0ffff,beige:f5f5dc,bisque:ffe4c4,black:000000,blanchedalmond:ffebcd,blue:0000ff,blueviolet:8a2be2,brown:a52a2a,burlywood:deb887,cadetblue:5f9ea0,chartreuse:7fff00,chocolate:d2691e,coral:ff7f50,cornflowerblue:6495ed,cornsilk:fff8dc,crimson:dc143c,cyan:00ffff,darkblue:00008b,darkcyan:008b8b,darkgoldenrod:b8860b,darkgray:a9a9a9,darkgreen:006400,darkgrey:a9a9a9,darkkhaki:bdb76b,darkmagenta:8b008b,darkolivegreen:556b2f,darkorange:ff8c00,darkorchid:9932cc,darkred:8b0000,darksalmon:e9967a,darkseagreen:8fbc8f,darkslateblue:483d8b,darkslategray:2f4f4f,darkslategrey:2f4f4f,darkturquoise:00ced1,darkviolet:9400d3,deeppink:ff1493,deepskyblue:00bfff,dimgray:696969,dimgrey:696969,dodgerblue:1e90ff,firebrick:b22222,floralwhite:fffaf0,forestgreen:228b22,fuchsia:ff00ff,gainsboro:dcdcdc,ghostwhite:f8f8ff,gold:ffd700,goldenrod:daa520,gray:808080,grey:808080,green:008000,greenyellow:adff2f,honeydew:f0fff0,hotpink:ff69b4,indianred:cd5c5c,indigo:4b0082,ivory:fffff0,khaki:f0e68c,lavender:e6e6fa,lavenderblush:fff0f5,lawngreen:7cfc00,lemonchiffon:fffacd,lightblue:add8e6,lightcoral:f08080,lightcyan:e0ffff,lightgoldenrodyellow:fafad2,lightgray:d3d3d3,lightgreen:90ee90,lightgrey:d3d3d3,lightpink:ffb6c1,lightsalmon:ffa07a,lightseagreen:20b2aa,lightskyblue:87cefa,lightslategray:778899,lightslategrey:778899,lightsteelblue:b0c4de,lightyellow:ffffe0,lime:00ff00,limegreen:32cd32,linen:faf0e6,magenta:ff00ff,maroon:800000,mediumaquamarine:66cdaa,mediumblue:0000cd,mediumorchid:ba55d3,mediumpurple:9370db,mediumseagreen:3cb371,mediumslateblue:7b68ee,mediumspringgreen:00fa9a,mediumturquoise:48d1cc,mediumvioletred:c71585,midnightblue:191970,mintcream:f5fffa,mistyrose:ffe4e1,moccasin:ffe4b5,navajowhite:ffdead,navy:000080,oldlace:fdf5e6,olive:808000,olivedrab:6b8e23,orange:ffa500,orangered:ff4500,orchid:da70d6,palegoldenrod:eee8aa,palegreen:98fb98,paleturquoise:afeeee,palevioletred:db7093,papayawhip:ffefd5,peachpuff:ffdab9,peru:cd853f,pink:ffc0cb,plum:dda0dd,powderblue:b0e0e6,purple:800080,rebeccapurple:663399,red:ff0000,rosybrown:bc8f8f,royalblue:4169e1,saddlebrown:8b4513,salmon:fa8072,sandybrown:f4a460,seagreen:2e8b57,seashell:fff5ee,sienna:a0522d,silver:c0c0c0,skyblue:87ceeb,slateblue:6a5acd,slategray:708090,slategrey:708090,snow:fffafa,springgreen:00ff7f,steelblue:4682b4,tan:d2b48c,teal:008080,thistle:d8bfd8,tomato:ff6347,turquoise:40e0d0,violet:ee82ee,wheat:f5deb3,white:ffffff,whitesmoke:f5f5f5,yellow:ffff00,yellowgreen:9acd32';
let namedMap: Map<string, string> | null = null;

/** An SVG paint: `hex` is '#rrggbb' or null (none), `opacity` its alpha. */
export interface SVGPaint { hex: string | null; opacity: number | null }

/** Parse an SVG colour (hex, rgb()/rgba(), named, none, currentColor). */
export function parse_svg_color(value: string | null | undefined, current = 'black'): SVGPaint {
  if (value === null || value === undefined) return { hex: null, opacity: null };
  let v = value.trim().toLowerCase();
  if (v === 'none' || v === '' || v === 'transparent') return { hex: null, opacity: null };
  if (v === 'currentcolor') v = current.trim().toLowerCase();
  const h2 = (x: number) => Math.max(0, Math.min(255, Math.round(x))).toString(16).padStart(2, '0');
  if (v[0] === '#') {
    let h = v.slice(1);
    if (h.length === 3 || h.length === 4) h = [...h].map((c) => c + c).join('');
    const a = h.length === 8 ? parseInt(h.slice(6, 8), 16) / 255 : 1;
    return { hex: '#' + h.slice(0, 6), opacity: a };
  }
  const fn = /^(rgba?)\(([^)]*)\)$/.exec(v);
  if (fn) {
    const parts = fn[2].split(/[\s,/]+/).filter(Boolean);
    const ch = (p: string) => (p.endsWith('%') ? (parseFloat(p) * 255) / 100 : parseFloat(p));
    const a = parts[3] !== undefined ? (parts[3].endsWith('%') ? parseFloat(parts[3]) / 100 : parseFloat(parts[3])) : 1;
    return { hex: '#' + h2(ch(parts[0])) + h2(ch(parts[1])) + h2(ch(parts[2])), opacity: a };
  }
  if (!namedMap) namedMap = new Map(NAMED.split(',').map((kv) => kv.split(':') as [string, string]));
  const hex = namedMap.get(v);
  return hex ? { hex: '#' + hex, opacity: 1 } : { hex: '#000000', opacity: 1 };
}

// ------------------------------------------------------------------ document
/** Presentation style of a shape after inheritance (svgelements' fill/stroke/stroke_width). */
export interface SVGStyle {
  fill: SVGPaint;
  stroke: SVGPaint;
  stroke_width: number;
}
interface BaseNode { id: string | null; values: Record<string, string> }
/** A container (svg, g, use, a, switch): its children in document order. */
export interface SVGGroupNode extends BaseNode { kind: 'group' | 'use'; children: SVGNode[] }
/** A shape. `transform` is what svgelements could not reify (usually the identity). */
export type SVGShapeNode = BaseNode & { style: SVGStyle; transform: SVGMatrix } & (
  | { kind: 'path'; segments: SVGSegment[] }
  | { kind: 'rect'; x: number; y: number; width: number; height: number; rx: number; ry: number }
  | { kind: 'ellipse'; cx: number; cy: number; rx: number; ry: number }
  | { kind: 'line'; x1: number; y1: number; x2: number; y2: number }
  | { kind: 'polygon' | 'polyline'; points: XY[] }
  | { kind: 'text'; text: string }
);
export type SVGNode = SVGGroupNode | SVGShapeNode;

const INHERITED = ['fill', 'fill-opacity', 'stroke', 'stroke-opacity', 'stroke-width', 'color', 'fill-rule', 'visibility'];
const UNITS: Record<string, number> = { px: 1, pt: 96 / 72, pc: 16, mm: 96 / 25.4, cm: 96 / 2.54, in: 96, em: 16, ex: 8 };

function length(v: string | undefined, rel = 0, def = 0): number {
  if (v === undefined || v === null || v === '') return def;
  const m = /^\s*([-+]?(?:\d+\.?\d*|\.\d+)(?:[eE][-+]?\d+)?)\s*([a-z%]*)\s*$/i.exec(v);
  if (!m) return def;
  const x = parseFloat(m[1]);
  if (m[2] === '%') return (x / 100) * rel;
  return x * (UNITS[m[2].toLowerCase()] ?? 1);
}
function parse_style_attr(s: string | undefined, into: Record<string, string>): void {
  if (!s) return;
  for (const decl of s.split(';')) {
    const k = decl.indexOf(':');
    if (k > 0) into[decl.slice(0, k).trim()] = decl.slice(k + 1).trim().replace(/\s*!important$/, '');
  }
}
type CSSRule = { sel: string; decls: Record<string, string> };
function parse_css(text: string): CSSRule[] {
  const rules: CSSRule[] = [];
  const clean = text.replace(/\/\*[\s\S]*?\*\//g, '');
  const re = /([^{}]+)\{([^}]*)\}/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(clean))) {
    const decls: Record<string, string> = {};
    parse_style_attr(m[2], decls);
    for (const sel of m[1].split(',')) rules.push({ sel: sel.trim(), decls });
  }
  return rules;
}
function css_matches(sel: string, el: XMLElement): boolean {
  const m = /^([a-zA-Z][\w-]*)?((?:[.#][\w-]+)*)$/.exec(sel);
  if (!m) return false;
  if (m[1] && m[1] !== el.tag) return false;
  const classes = (el.attrs.class ?? '').split(/\s+/);
  for (const part of m[2].match(/[.#][\w-]+/g) ?? []) {
    if (part[0] === '.' && !classes.includes(part.slice(1))) return false;
    if (part[0] === '#' && el.attrs.id !== part.slice(1)) return false;
  }
  return true;
}

function points_attr(s: string | undefined): XY[] {
  const nums = (s ?? '').match(/[-+]?(?:\d+\.?\d*|\.\d+)(?:[eE][-+]?\d+)?/g)?.map(Number) ?? [];
  const out: XY[] = [];
  for (let i = 0; i + 1 < nums.length; i += 2) out.push([nums[i], nums[i + 1]]);
  return out;
}

/**
 * Parse an SVG document into a tree of groups and shapes (se.SVG.parse with
 * reify=True). Pass `root` to parse an already-built XML tree. The root
 * <svg>'s own viewBox/size are applied only when `viewport` is true
 * (manim's SVGMobject strips them, so it passes false).
 */
export function parse_svg(src: string | XMLElement, opts: { viewport?: boolean; color?: string } = {}): SVGGroupNode {
  const doc = typeof src === 'string' ? parse_xml(src) : src;
  const svg = doc.tag === 'svg' ? doc : doc.children.find((c) => c.tag === 'svg') ?? doc;
  const byId = new Map<string, XMLElement>();
  const css: CSSRule[] = [];
  (function index(el: XMLElement) {
    if (el.attrs.id) byId.set(el.attrs.id, el);
    if (el.tag === 'style') css.push(...parse_css(el.text));
    el.children.forEach(index);
  })(svg);

  const values_of = (el: XMLElement, parent: Record<string, string>): Record<string, string> => {
    const v: Record<string, string> = {};
    for (const k of INHERITED) if (parent[k] !== undefined) v[k] = parent[k];
    for (const [k, val] of Object.entries(el.attrs)) v[k] = val;
    for (const r of css) if (css_matches(r.sel, el)) Object.assign(v, r.decls);
    parse_style_attr(el.attrs.style, v);
    return v;
  };
  const style_of = (v: Record<string, string>, m: SVGMatrix): SVGStyle => {
    const cur = v.color ?? opts.color ?? 'black';
    const fill = parse_svg_color(v.fill ?? 'black', cur);
    const stroke = parse_svg_color(v.stroke, cur);
    const fo = v['fill-opacity'] !== undefined ? parseFloat(v['fill-opacity']) : 1;
    const so = v['stroke-opacity'] !== undefined ? parseFloat(v['stroke-opacity']) : 1;
    // svgelements keeps alpha as a byte
    const byte = (a: number) => Math.round(Math.max(0, Math.min(1, a)) * 255) / 255;
    if (fill.opacity !== null) fill.opacity = byte(fill.opacity * fo);
    if (stroke.opacity !== null) stroke.opacity = byte(stroke.opacity * so);
    const sw = length(v['stroke-width'], 0, 1);
    return { fill, stroke, stroke_width: sw * Math.sqrt(Math.abs(m[0] * m[3] - m[1] * m[2])) };
  };

  const walk = (el: XMLElement, ctm: SVGMatrix, parent: Record<string, string>, isRoot: boolean, depth: number): SVGNode | null => {
    if (depth > 64) return null;
    const v = values_of(el, parent);
    if (v.display === 'none') return null;
    let m = matrix_multiply(ctm, parse_transform(el.attrs.transform));
    const id = el.attrs.id ?? null;
    const tag = el.tag.replace(/^svg:/, '');
    switch (tag) {
      case 'svg': {
        if (!isRoot || opts.viewport) {
          const x = length(el.attrs.x), y = length(el.attrs.y);
          let t: SVGMatrix = [1, 0, 0, 1, isRoot ? 0 : x, isRoot ? 0 : y];
          const vb = el.attrs.viewBox?.trim().split(/[\s,]+/).map(Number);
          if (vb && vb.length === 4 && vb[2] > 0 && vb[3] > 0) {
            const w = length(el.attrs.width, vb[2], vb[2]), h = length(el.attrs.height, vb[3], vb[3]);
            let sx = w / vb[2], sy = h / vb[3];
            let tx = 0, ty = 0;
            const par = (el.attrs.preserveAspectRatio ?? 'xMidYMid meet').trim();
            if (!par.startsWith('none')) {
              const s = par.includes('slice') ? Math.max(sx, sy) : Math.min(sx, sy);
              const al = par.split(/\s+/)[0];
              tx = al.includes('xMid') ? (w - vb[2] * s) / 2 : al.includes('xMax') ? w - vb[2] * s : 0;
              ty = al.includes('YMid') ? (h - vb[3] * s) / 2 : al.includes('YMax') ? h - vb[3] * s : 0;
              sx = sy = s;
            }
            t = matrix_multiply(t, [sx, 0, 0, sy, tx - vb[0] * sx, ty - vb[1] * sy]);
          }
          m = matrix_multiply(m, t);
        }
        return group('group');
      }
      case 'g':
      case 'a':
      case 'switch':
        return group('group');
      case 'use': {
        const href = el.attrs.href ?? el.attrs['xlink:href'] ?? '';
        const ref = href.startsWith('#') ? byId.get(href.slice(1)) : undefined;
        m = matrix_multiply(m, [1, 0, 0, 1, length(el.attrs.x), length(el.attrs.y)]);
        const children: SVGNode[] = [];
        if (ref) {
          const target = ref.tag === 'symbol' ? { ...ref, tag: 'g' } : ref;
          const c = walk(target, m, v, false, depth + 1);
          if (c) children.push(c);
        }
        return { kind: 'use', id, values: v, children };
      }
      case 'path': {
        const segs = transform_segments(parse_path(el.attrs.d ?? ''), m);
        return { kind: 'path', id, values: v, style: style_of(v, m), transform: IDENTITY_MATRIX, segments: segs };
      }
      case 'rect':
      case 'circle':
      case 'ellipse': {
        let shape: any;
        if (tag === 'rect') {
          const w = length(el.attrs.width), h = length(el.attrs.height);
          let rx = el.attrs.rx !== undefined ? length(el.attrs.rx) : undefined, ry = el.attrs.ry !== undefined ? length(el.attrs.ry) : undefined;
          rx ??= ry ?? 0;
          ry ??= rx;
          shape = { kind: 'rect', x: length(el.attrs.x), y: length(el.attrs.y), width: w, height: h, rx, ry };
        } else {
          const r = length(el.attrs.r);
          shape = { kind: 'ellipse', cx: length(el.attrs.cx), cy: length(el.attrs.cy), rx: tag === 'circle' ? r : length(el.attrs.rx), ry: tag === 'circle' ? r : length(el.attrs.ry) };
        }
        let st = style_of(v, IDENTITY_MATRIX);
        let rest: SVGMatrix = m;
        // svgelements reifies only unskewed, unflipped transforms
        if (!(m[0] * m[3] < 0) && m[1] === 0 && m[2] === 0 && m[0] !== 0 && m[3] !== 0) {
          st = style_of(v, m);
          if (shape.kind === 'rect') {
            shape.x = shape.x * m[0] + m[4];
            shape.y = shape.y * m[3] + m[5];
            shape.width *= m[0];
            shape.height *= m[3];
          } else {
            shape.cx = shape.cx * m[0] + m[4];
            shape.cy = shape.cy * m[3] + m[5];
          }
          shape.rx *= m[0];
          shape.ry *= m[3];
          rest = IDENTITY_MATRIX;
        }
        return { ...shape, id, values: v, style: st, transform: rest };
      }
      case 'line': {
        const [x1, y1] = matrix_apply(m, length(el.attrs.x1), length(el.attrs.y1));
        const [x2, y2] = matrix_apply(m, length(el.attrs.x2), length(el.attrs.y2));
        return { kind: 'line', id, values: v, style: style_of(v, m), transform: IDENTITY_MATRIX, x1, y1, x2, y2 };
      }
      case 'polygon':
      case 'polyline':
        return { kind: tag, id, values: v, style: style_of(v, m), transform: IDENTITY_MATRIX, points: points_attr(el.attrs.points).map(([x, y]) => matrix_apply(m, x, y)) };
      case 'text':
        return { kind: 'text', id, values: v, style: style_of(v, m), transform: m, text: el.text };
      default:
        return null; // defs, symbol, clipPath, mask, style, title, metadata, image...
    }
    function group(kind: 'group'): SVGGroupNode {
      const children: SVGNode[] = [];
      for (const c of el.children) {
        const n = walk(c, m, v, false, depth + 1);
        if (n) children.push(n);
      }
      return { kind, id, values: v, children };
    }
  };
  return walk(svg, IDENTITY_MATRIX, {}, true, 0) as SVGGroupNode;
}
