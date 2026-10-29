// Text layout (web extension) reproducing what manimpango's text2svg produces
// with Pango 1.5x + HarfBuzz + cairo's SVG surface (the path manim takes):
//  * font size in points = font_size / 4.8, rendered at 96 dpi;
//  * HarfBuzz shaping: cmap, standard ligatures, pair kerning (a legacy 'kern'
//    table adjustment is split between both glyphs, GPOS kerning goes on the
//    first glyph);
//  * Pango's hinted metrics: every glyph width and x offset is rounded to a
//    whole pixel (PANGO_UNITS_ROUND), ascent/descent are kept in Pango units;
//  * word wrapping at the layout width, justification, line stacking by
//    ascent + descent, underline / strikethrough / error squiggle as Pango's
//    renderer draws them;
//  * cairo stores path coordinates as 24.8 fixed point.
// The result is the list of filled paths manimpango would write to its SVG
// file, in the same order and coordinates (px, y down).
import {
  face_for_char, face_metrics, glyph_advance, glyph_bounds, glyph_outline, kerning, ligatures, OP_C, OP_L, OP_M, OP_Z, resolve_font,
  type FontFace, type FontStyleName,
} from './fonts';
import { parse_markup, type Span, type SpanAttrs, type UnderlineKind } from './markup';

const PU = 1024; // PANGO_SCALE
const PX_PER_PT = 96 / 72;
/** PANGO_UNITS_ROUND */
const round_pu = (d: number): number => Math.floor((d + 512) / 1024) * 1024;
/** cairo fixed point (24.8) */
const fixed = (v: number): number => Math.round(v * 256) / 256;
/**
 * Pango's hinting: every glyph width and offset rounded to a whole pixel at the size Pango draws (font_size / 4.8 pt,
 * a few pixels), so letters sit unevenly once the text is scaled up. On by default: manim's text, glyph for glyph (the
 * regression tests). Off: the font's own advances and kerning, unrounded (what Mathnim shows).
 */
let pango_hinting = true;
export function set_text_hinting(on: boolean): void {
  pango_hinting = on;
}
/** Shear applied when an italic is requested but only an upright face exists. */
const SYNTH_ITALIC_SKEW = 0.2;

/** Base font of a layout (Pango font description). Size in points. */
export interface FontDesc {
  family: string;
  weight: number;
  style: FontStyleName;
  size: number;
}
/** A filled path of the output, in SVG coordinates (px, y down). */
export interface TextShape {
  /** OP_M x y | OP_L x y | OP_C x1 y1 x2 y2 x y | OP_Z, absolute. */
  cmds: number[];
  color: string;
  alpha: number;
  /** false for underline / strikethrough decorations. */
  glyph: boolean;
}
export interface LayoutOptions {
  font_desc: FontDesc;
  /** Wrap width in px (Pango layout width), null for none. */
  width: number | null;
  justify?: boolean;
  liga?: boolean;
}
export interface LayoutResult {
  shapes: TextShape[];
  /** Logical width / height in px (pango_layout_get_size). */
  width: number;
  height: number;
}

interface CharAttrs {
  family: string;
  weight: number;
  style: FontStyleName;
  size: number;
  color: string;
  alpha: number;
  underline: UnderlineKind;
  underline_color: string | null;
  strikethrough: boolean;
  strikethrough_color: string | null;
  rise: number;
  baseline_shift: number | 'superscript' | 'subscript';
  font_scale: 'superscript' | 'subscript' | 'small-caps' | null;
  letter_spacing: number;
  liga: boolean;
  text_transform: SpanAttrs['text_transform'];
}
interface Ch {
  cp: number;
  a: CharAttrs;
  face: FontFace;
  gid: number;
  synth: boolean;
  px: number;
  /** vertical offset (Pango units, up) from rise + baseline shift */
  yoff: number;
  /** consumed by a ligature made in make_chars (lam-alef) */
  skip: boolean;
  /** nonspacing mark (placed over the preceding glyph) */
  mark: boolean;
  /** bidi embedding level (0 LTR, odd RTL) */
  level: number;
}
interface Glyph {
  gid: number;
  face: FontFace;
  px: number;
  synth: boolean;
  /** first char (index into the paragraph's chars) and one past its cluster */
  c0: number;
  c1: number;
  width: number;
  xoff: number;
  yoff: number;
}

const is_space = (cp: number) => cp === 32 || cp === 9 || cp === 0xa0 || (cp >= 0x2000 && cp <= 0x200a) || cp === 0x3000;
const is_cjk = (cp: number) => (cp >= 0x2e80 && cp <= 0x9fff) || (cp >= 0xac00 && cp <= 0xd7af) || (cp >= 0xf900 && cp <= 0xfaff) || (cp >= 0xff00 && cp <= 0xffef) || (cp >= 0x20000 && cp <= 0x2fa1f);

function resolve_attrs(n: number, spans: readonly Span[], base: FontDesc, text16: number[], liga: boolean): CharAttrs[] {
  const def: CharAttrs = {
    family: base.family, weight: base.weight, style: base.style, size: base.size, color: '#000000', alpha: 1, underline: 'none',
    underline_color: null, strikethrough: false, strikethrough_color: null, rise: 0, baseline_shift: 0, font_scale: null, letter_spacing: 0,
    liga, text_transform: 'none',
  };
  const out: CharAttrs[] = new Array(n);
  const scale: number[] = new Array(n).fill(1);
  const size: number[] = new Array(n).fill(base.size);
  for (let i = 0; i < n; i++) out[i] = def;
  for (const sp of spans) {
    const a = sp.attrs;
    for (let i = 0; i < n; i++) {
      const u = text16[i];
      if (u < sp.start || u >= sp.end) continue;
      const c = out[i] === def ? { ...def } : out[i];
      out[i] = c;
      if (a.family !== undefined) c.family = a.family;
      if (a.weight !== undefined) c.weight = a.weight;
      if (a.style !== undefined) c.style = a.style;
      if (a.size !== undefined) size[i] = a.size;
      if (a.scale_abs !== undefined) scale[i] = a.scale_abs;
      if (a.scale !== undefined) scale[i] *= a.scale;
      if (a.color !== undefined) c.color = a.color;
      if (a.alpha !== undefined) c.alpha = a.alpha;
      if (a.underline !== undefined) c.underline = a.underline;
      if (a.underline_color !== undefined) c.underline_color = a.underline_color;
      if (a.strikethrough !== undefined) c.strikethrough = a.strikethrough;
      if (a.strikethrough_color !== undefined) c.strikethrough_color = a.strikethrough_color;
      if (a.rise !== undefined) c.rise = a.rise;
      if (a.baseline_shift !== undefined) c.baseline_shift = a.baseline_shift;
      if (a.font_scale !== undefined) c.font_scale = a.font_scale;
      if (a.letter_spacing !== undefined) c.letter_spacing = a.letter_spacing;
      if (a.liga !== undefined) c.liga = a.liga;
      if (a.text_transform !== undefined) c.text_transform = a.text_transform;
    }
  }
  for (let i = 0; i < n; i++) {
    const s = size[i] * scale[i];
    if (s !== out[i].size) out[i] = { ...out[i], size: s };
  }
  return out;
}

// Arabic contextual forms through the Presentation Forms-B block (web: HarfBuzz would use the
// font's GSUB/morx; this works for any font that maps the presentation forms, e.g. Geeza Pro).
const AR_DUAL = [[0x0626, 0xfe89], [0x0628, 0xfe8f], [0x062a, 0xfe95], [0x062b, 0xfe99], [0x062c, 0xfe9d], [0x062d, 0xfea1], [0x062e, 0xfea5], [0x0633, 0xfeb1], [0x0634, 0xfeb5], [0x0635, 0xfeb9], [0x0636, 0xfebd], [0x0637, 0xfec1], [0x0638, 0xfec5], [0x0639, 0xfec9], [0x063a, 0xfecd], [0x0641, 0xfed1], [0x0642, 0xfed5], [0x0643, 0xfed9], [0x0644, 0xfedd], [0x0645, 0xfee1], [0x0646, 0xfee5], [0x0647, 0xfee9], [0x064a, 0xfef1]];
const AR_RIGHT = [[0x0622, 0xfe81], [0x0623, 0xfe83], [0x0624, 0xfe85], [0x0625, 0xfe87], [0x0627, 0xfe8d], [0x0629, 0xfe93], [0x062f, 0xfea9], [0x0630, 0xfeab], [0x0631, 0xfead], [0x0632, 0xfeaf], [0x0648, 0xfeed], [0x0649, 0xfeef]];
const AR_FORMS = new Map<number, [number, boolean]>([...AR_DUAL.map(([c, f]) => [c, [f, true]] as [number, [number, boolean]]), ...AR_RIGHT.map(([c, f]) => [c, [f, false]] as [number, [number, boolean]])]);
const LAM_ALEF: Record<number, number> = { 0x0622: 0xfef5, 0x0623: 0xfef7, 0x0625: 0xfef9, 0x0627: 0xfefb };
const is_mark = (cp: number) => /\p{Mn}/u.test(String.fromCodePoint(cp));
const is_rtl = (cp: number) => (cp >= 0x0590 && cp <= 0x08ff) || (cp >= 0xfb1d && cp <= 0xfdff) || (cp >= 0xfe70 && cp <= 0xfeff);
const is_strong_ltr = (cp: number) => !is_rtl(cp) && /[\p{L}\p{N}]/u.test(String.fromCodePoint(cp));
/** Can join to the following / preceding letter (tatweel and dual-joining letters / all joining letters). */
const joins_next = (cp: number) => cp === 0x0640 || AR_FORMS.get(cp)?.[1] === true;
const joins_prev = (cp: number) => cp === 0x0640 || AR_FORMS.has(cp);

/** Simplified Unicode bidi: embedding level per char for a paragraph (auto direction from the first strong char). */
function bidi_levels(cps: number[]): number[] {
  const n = cps.length;
  const cls = cps.map((cp) => (is_rtl(cp) && !is_mark(cp) ? 'R' : is_strong_ltr(cp) ? 'L' : is_mark(cp) ? 'M' : 'N'));
  for (let i = 0; i < n; i++) if (cls[i] === 'M') cls[i] = i > 0 ? cls[i - 1] : 'N';
  const first = cls.find((c) => c === 'R' || c === 'L');
  const base = first === 'R' ? 1 : 0;
  const levels = new Array(n).fill(base);
  const next_strong: (string | null)[] = new Array(n).fill(null);
  let ns: string | null = null;
  for (let i = n - 1; i >= 0; i--) {
    if (cls[i] === 'R' || cls[i] === 'L') ns = cls[i];
    next_strong[i] = ns;
  }
  let prev: string | null = null;
  for (let i = 0; i < n; i++) {
    let c = cls[i];
    if (c === 'N') c = prev && prev === next_strong[i] ? prev : base ? 'R' : 'L';
    else prev = c;
    levels[i] = c === 'R' ? 1 : base ? 2 : 0;
  }
  return levels;
}

function make_chars(cps: number[], attrs: CharAttrs[]): Ch[] {
  const out: Ch[] = [];
  const levels = cps.some(is_rtl) ? bidi_levels(cps) : null;
  for (let i = 0; i < cps.length; i++) {
    const a = attrs[i];
    let cp = cps[i];
    if (a.text_transform === 'uppercase') cp = String.fromCodePoint(cp).toUpperCase().codePointAt(0)!;
    else if (a.text_transform === 'lowercase') cp = String.fromCodePoint(cp).toLowerCase().codePointAt(0)!;
    else if (a.text_transform === 'capitalize' && (i === 0 || is_space(cps[i - 1]))) cp = String.fromCodePoint(cp).toUpperCase().codePointAt(0)!;
    let r = resolve_font(a.family, a.weight, a.style);
    let [face, gid] = face_for_char(r, cp === 9 ? 32 : cp);
    const base_px = a.size * PX_PER_PT;
    let px = base_px;
    const m = a.font_scale === 'subscript' || a.font_scale === 'superscript' || a.baseline_shift === 'subscript' || a.baseline_shift === 'superscript' ? face_metrics(face) : null;
    const m_upem = face.upem;
    if (a.font_scale === 'subscript' || a.font_scale === 'superscript') {
      px *= (a.font_scale === 'subscript' ? m!.sub_y_size : m!.sup_y_size) / face.upem;
      // Pango (CoreText backend) re-creates the scaled font without its family: it comes out in the default sans
      r = resolve_font('sans', a.weight, a.style);
      [face, gid] = face_for_char(r, cp === 9 ? 32 : cp);
    } else if (a.font_scale === 'small-caps') px *= 0.8;
    let shift = 0;
    if (a.baseline_shift === 'subscript') shift = -Math.round((m!.sub_y_offset * base_px * PU) / m_upem);
    else if (a.baseline_shift === 'superscript') shift = Math.round((m!.sup_y_offset * base_px * PU) / m_upem);
    else shift = a.baseline_shift as number;
    out.push({ cp, a, face, gid, synth: r.synth_italic && face.style === 'normal', px, yoff: a.rise + shift, skip: false, mark: is_mark(cp), level: levels ? levels[i] : 0 });
  }
  // Arabic joining
  if (levels) {
    const prev_letter = (k: number) => {
      for (k--; k >= 0; k--) if (!out[k].mark) return out[k].cp;
      return -1;
    };
    const next_letter = (k: number) => {
      for (k++; k < out.length; k++) if (!out[k].mark) return out[k].cp;
      return -1;
    };
    for (let i = 0; i < out.length; i++) {
      const c = out[i];
      const f = AR_FORMS.get(c.cp);
      if (!f || c.skip) continue;
      const jp = joins_next(prev_letter(i)) && joins_prev(c.cp);
      let nx = next_letter(i);
      // lam + alef -> ligature
      if (c.cp === 0x0644 && LAM_ALEF[nx] !== undefined) {
        let j = i + 1;
        while (out[j].mark) j++;
        const lig = c.face.font.charToGlyphIndex(String.fromCodePoint(LAM_ALEF[nx] + (jp ? 1 : 0)));
        if (lig) {
          c.gid = lig;
          out[j].skip = true;
          continue;
        }
      }
      const jn = f[1] && joins_prev(nx);
      const form = jp && jn ? 3 : jn ? 2 : jp ? 1 : 0;
      const g = c.face.font.charToGlyphIndex(String.fromCodePoint(f[0] + form));
      if (g) c.gid = g;
    }
  }
  return out;
}

/** Shape chars[i0, i1) (HarfBuzz-like) into glyphs with Pango-rounded widths. */
function shape(chars: Ch[], i0: number, i1: number): Glyph[] {
  const out: Glyph[] = [];
  let s = i0;
  while (s < i1) {
    // an item: same face / size / shaping attributes
    const c0 = chars[s];
    let e = s + 1;
    while (e < i1) {
      const c = chars[e];
      if (c.face !== c0.face || c.px !== c0.px || c.synth !== c0.synth || c.a.liga !== c0.a.liga || c.yoff !== c0.yoff || c.a.letter_spacing !== c0.a.letter_spacing) break;
      e++;
    }
    const face = c0.face, px = c0.px, sc = (px * PU) / face.upem;
    const ligs = ligatures(face);
    const item: Glyph[] = [];
    for (let i = s; i < e;) {
      if (chars[i].skip && item.length) {
        item[item.length - 1].c1 = ++i;
        continue;
      }
      let gid = chars[i].gid, c1 = i + 1;
      for (const table of c0.a.liga ? [ligs.required, ligs.standard] : [ligs.required]) {
        const cands = table.get(gid);
        if (!cands || c1 > i + 1) continue;
        for (const l of cands) {
          if (i + 1 + l.rest.length > e) continue;
          if (l.rest.every((g, k) => chars[i + 1 + k].gid === g)) {
            gid = l.by;
            c1 = i + 1 + l.rest.length;
            break;
          }
        }
      }
      item.push({ gid, face, px, synth: c0.synth, c0: i, c1, width: 0, xoff: 0, yoff: c0.yoff });
      i = c1;
    }
    const adv = item.map((g) => (chars[g.c0].cp === 9 ? 8 * glyph_advance(face, face.font.charToGlyphIndex(' ')) : glyph_advance(face, g.gid)) * sc);
    const xoff = item.map(() => 0);
    const advp = pango_hinting ? adv.map((a) => Math.round(a)) : adv;
    for (let k = 0; k + 1 < item.length; k++) {
      const kv = kerning(face, item[k].gid, item[k + 1].gid);
      if (!kv) continue;
      const kp = pango_hinting ? Math.round(kv * sc) : kv * sc;
      if (face.kern_mode === 'kern') {
        const k1 = kp >> 1, k2 = kp - k1;
        advp[k] += k1;
        advp[k + 1] += k2;
        xoff[k + 1] += k2;
      } else advp[k] += kp;
    }
    item.forEach((g, k) => {
      g.width = pango_hinting ? round_pu(advp[k] + c0.a.letter_spacing) : advp[k] + c0.a.letter_spacing;
      g.xoff = pango_hinting ? round_pu(xoff[k]) : xoff[k];
    });
    // web: no GPOS mark / AAT anchor support - centre nonspacing marks on their base glyph's ink
    // (like HarfBuzz's fallback mark positioning)
    for (let k = 1; k < item.length; k++) {
      if (!chars[item[k].c0].mark) continue;
      let b = k - 1;
      while (b > 0 && chars[item[b].c0].mark) b--;
      const bb = glyph_bounds(face, item[b].gid), mb = glyph_bounds(face, item[k].gid);
      if (!mb) continue;
      let dx = 0;
      for (let j = b; j < k; j++) dx += item[j].width;
      const base_c = bb ? item[b].xoff + ((bb[0] + bb[2]) / 2) * sc : item[b].width / 2;
      item[k].xoff = Math.round(base_c - dx - ((mb[0] + mb[2]) / 2) * sc);
      item[k].width = 0;
    }
    out.push(...item);
    s = e;
  }
  return out;
}

/** Break opportunity before char j (simplified UAX #14). */
function can_break_before(chars: Ch[], j: number): boolean {
  if (j <= 0 || j >= chars.length) return false;
  const a = chars[j - 1].cp, b = chars[j].cp;
  if (is_space(a) && !is_space(b)) return true;
  if (a === 0x200b) return true;
  if ((a === 45 || a === 0x2010 || a === 0x2013) && !is_space(b) && j >= 2 && !is_space(chars[j - 2].cp)) return true;
  if ((is_cjk(a) || is_cjk(b)) && !is_space(b) && !/[、。，．：；！？）」』】〕〉》”’]/u.test(String.fromCodePoint(b))) return true;
  return false;
}

interface Line {
  c0: number;
  c1: number;
  glyphs: Glyph[];
  wrapped: boolean;
}

function break_lines(chars: Ch[], limit: number | null): Line[] {
  const n = chars.length;
  if (n === 0) return [{ c0: 0, c1: 0, glyphs: [], wrapped: false }];
  if (limit === null) return [{ c0: 0, c1: n, glyphs: shape(chars, 0, n), wrapped: false }];
  const lines: Line[] = [];
  let start = 0;
  while (start < n) {
    const gl = shape(chars, start, n);
    let w = 0, brk = -1, end = n;
    for (let k = 0; k < gl.length; k++) {
      const g = gl[k];
      if (g.c0 > start && can_break_before(chars, g.c0)) brk = g.c0;
      if (!is_space(chars[g.c0].cp) && w + g.width > limit && g.c0 > start) {
        end = brk > start ? brk : g.c0;
        break;
      }
      w += g.width;
    }
    lines.push({ c0: start, c1: end, glyphs: end === n ? gl : shape(chars, start, end), wrapped: end < n });
    start = end;
  }
  return lines;
}

function justify_line(line: Line, chars: Ch[], limit: number): void {
  let width = 0;
  for (const g of line.glyphs) width += g.width;
  let remaining = limit - width;
  if (remaining <= 0) return;
  const hinted = (remaining & (PU - 1)) === 0;
  const spaces = line.glyphs.filter((g) => chars[g.c0].cp === 32 && g.width > 0);
  if (!spaces.length) return;
  let added = 0;
  spaces.forEach((g, k) => {
    let adj = Math.floor(((k + 1) * remaining) / spaces.length) - added;
    if (hinted) adj = round_pu(adj);
    g.width += adj;
    added += adj;
  });
  remaining = 0;
}

/** Pango-style rectangle path (move_to, rel_line_to x3, close). */
function rect_cmds(x: number, y: number, w: number, h: number): number[] {
  const [x0, y0, x1, y1] = [fixed(x), fixed(y), fixed(x + w), fixed(y + h)];
  return [OP_M, x0, y0, OP_L, x1, y0, OP_L, x1, y1, OP_L, x0, y1, OP_Z];
}
/** pango_cairo's error underline squiggle (in px). */
function error_underline_cmds(x: number, y: number, width: number, height: number): number[] {
  const square = height / 2.5, unit = 1.5 * square;
  const n = Math.trunc((width + unit / 2) / unit);
  x += (width - n * unit) / 2;
  const y_top = y, y_bottom = y + height;
  const c: number[] = [OP_M, fixed(x - square / 2), fixed(y_top + square / 2)];
  const L = (px: number, py: number) => c.push(OP_L, fixed(px), fixed(py));
  let j = 1;
  for (; j + 2 <= n; j += 2) {
    L(x + j * unit, y_bottom);
    L(x + (j + 1) * unit, y_top + square);
  }
  L(x + j * unit, y_bottom);
  if (n % 2 === 1) L(x + n * unit + square / 2, y_bottom - square / 2);
  else {
    L(x + n * unit + square / 2, y_top + square / 2);
    L(x + n * unit, y_top);
  }
  for (let k = n - 1; k >= 0; k--) L(x + k * unit, k % 2 === 0 ? y_top : y_bottom - square);
  return c;
}

function glyph_cmds(g: Glyph, ox: number, oy: number): number[] {
  const o = glyph_outline(g.face, g.gid);
  const s = g.px / g.face.upem;
  const skew = g.synth ? SYNTH_ITALIC_SKEW : 0;
  const out: number[] = new Array(o.length);
  for (let i = 0; i < o.length;) {
    const op = o[i];
    out[i] = op;
    i++;
    const k = op === OP_C ? 6 : op === OP_Z ? 0 : 2;
    for (let j = 0; j < k; j += 2) {
      const fx = o[i + j], fy = o[i + j + 1];
      out[i + j] = ox + fixed((fx + skew * fy) * s);
      out[i + j + 1] = oy + fixed(-fy * s);
    }
    i += k;
  }
  return out;
}

/** Lay out plain text with attribute spans; (x0, y0) is the top-left corner (cairo_move_to). */
export function layout_text(text: string, spans: readonly Span[], x0: number, y0: number, opts: LayoutOptions): LayoutResult {
  const cps: number[] = [], idx16: number[] = [];
  for (let i = 0; i < text.length;) {
    const cp = text.codePointAt(i)!;
    cps.push(cp);
    idx16.push(i);
    i += cp > 0xffff ? 2 : 1;
  }
  const attrs = resolve_attrs(cps.length, spans, opts.font_desc, idx16, opts.liga ?? true);
  const limit = opts.width != null ? Math.round(opts.width * PU) : null;
  const shapes: TextShape[] = [];
  let top = 0, max_w = 0;
  // paragraphs
  let p0 = 0;
  for (let i = 0; i <= cps.length; i++) {
    const end = i === cps.length;
    const cp = end ? 10 : cps[i];
    if (!(cp === 10 || cp === 13 || cp === 0x2028 || cp === 0x2029)) continue;
    const pchars = make_chars(cps.slice(p0, i), attrs.slice(p0, i));
    const para_attr = attrs[Math.min(p0, attrs.length - 1)];
    const lines = break_lines(pchars, limit);
    lines.forEach((line, li) => {
      if (line.wrapped) {
        // Pango zeroes the width of whitespace at the end of wrapped lines
        for (let k = line.glyphs.length - 1; k >= 0 && is_space(pchars[line.glyphs[k].c0].cp); k--) line.glyphs[k].width = 0;
        if (opts.justify && limit !== null && li < lines.length - 1) justify_line(line, pchars, limit);
      }
      top = emit_line(line, pchars, para_attr ?? null, opts.font_desc, x0, y0, top, limit, shapes, (w) => (max_w = Math.max(max_w, w)));
    });
    if (cp === 13 && cps[i + 1] === 10) i++;
    p0 = i + 1;
  }
  return { shapes, width: max_w / PU, height: top / PU };
}

function emit_line(line: Line, chars: Ch[], para_attr: CharAttrs | null, base: FontDesc, x0: number, y0: number, top: number, limit: number | null, shapes: TextShape[], report_width: (w: number) => void): number {
  // vertical metrics: union of the runs' logical rects
  let asc = -Infinity, desc = -Infinity;
  for (const g of line.glyphs) {
    const sc = (g.px * PU) / g.face.upem;
    asc = Math.max(asc, Math.round(g.face.ascender * sc) + g.yoff);
    desc = Math.max(desc, Math.round(-g.face.descender * sc) - g.yoff);
  }
  if (!line.glyphs.length) {
    const a = para_attr ?? { family: base.family, weight: base.weight, style: base.style, size: base.size };
    const r = resolve_font(a.family, a.weight, a.style);
    const f = r.faces[0];
    const sc = (a.size * PX_PER_PT * PU) / f.upem;
    asc = Math.round(f.ascender * sc);
    desc = Math.round(-f.descender * sc);
  }
  const baseline = top + asc;
  const pen0 = 0;
  let pen = pen0;
  // bidi: reorder glyphs visually; right-align RTL paragraphs within the layout width
  if (line.glyphs.some((g) => chars[g.c0].level > 0)) {
    const lv = line.glyphs.map((g) => chars[g.c0].level);
    const idx = line.glyphs.map((_, k) => k);
    for (let L = Math.max(...lv); L >= 1; L--) {
      for (let k = 0; k < idx.length;) {
        if (lv[idx[k]] < L) {
          k++;
          continue;
        }
        let e = k;
        while (e < idx.length && lv[idx[e]] >= L) e++;
        idx.splice(k, e - k, ...idx.slice(k, e).reverse());
        k = e;
      }
    }
    // marks follow their base in logical order; after reversal keep them after it (they carry no advance)
    const vis = idx.map((k) => line.glyphs[k]);
    for (let k = 0; k + 1 < vis.length; k++) {
      if (chars[vis[k].c0].mark && !chars[vis[k + 1].c0].mark && chars[vis[k].c0].level % 2 === 1) {
        let e = k;
        while (e > 0 && chars[vis[e - 1].c0].mark) e--;
        const marks = vis.slice(e, k + 1);
        vis.splice(e, k + 1 - e);
        vis.splice(e + 1, 0, ...marks);
        k = e + marks.length;
      }
    }
    line.glyphs = vis;
    const base_rtl = chars.length && Math.min(...chars.map((c) => c.level)) === 1;
    if (base_rtl && limit !== null) {
      let w = 0;
      for (const g of line.glyphs) w += g.width;
      x0 += (limit - w) / PU;
    }
  }
  // decoration state (Pango renderer accumulates rects across runs)
  let ul: { kind: UnderlineKind; color: string; x: number; y: number; w: number; h: number } | null = null;
  let st: { color: string; x: number; y: number; w: number; h: number } | null = null;
  const flush_ul = () => {
    if (!ul) return;
    const { kind, color, x, y, w, h } = ul;
    const X = x0 + x / PU, Y = y0 + y / PU, W = w / PU, H = h / PU;
    if (kind === 'double') shapes.push({ cmds: rect_cmds(X, Y + 2 * H, W, H), color, alpha: 1, glyph: false });
    if (kind === 'error') shapes.push({ cmds: error_underline_cmds(X, Y, W, 3 * H), color, alpha: 1, glyph: false });
    else shapes.push({ cmds: rect_cmds(X, Y, W, H), color, alpha: 1, glyph: false });
    ul = null;
  };
  const flush_st = () => {
    if (!st) return;
    shapes.push({ cmds: rect_cmds(x0 + st.x / PU, y0 + st.y / PU, st.w / PU, st.h / PU), color: st.color, alpha: 1, glyph: false });
    st = null;
  };
  // runs: consecutive glyphs with the same rendering attributes
  const gl = line.glyphs;
  for (let r0 = 0; r0 < gl.length;) {
    const a0 = chars[gl[r0].c0].a;
    let r1 = r0 + 1;
    while (r1 < gl.length) {
      const a = chars[gl[r1].c0].a;
      if (a.underline !== a0.underline || a.underline_color !== a0.underline_color || a.strikethrough !== a0.strikethrough || a.strikethrough_color !== a0.strikethrough_color || gl[r1].face !== gl[r0].face || gl[r1].px !== gl[r0].px || gl[r1].yoff !== gl[r0].yoff) break;
      r1++;
    }
    const run_x = pen;
    // ink extents of the run (for decorations), then decorations state changes, then the glyphs:
    // Pango draws an accumulated underline when the next run's underline differs, before that run's glyphs
    let ink_x0 = Infinity, ink_x1 = -Infinity, ink_bottom = -Infinity, run_w = 0;
    for (let k = r0; k < r1; k++) {
      const g = gl[k];
      const b = glyph_bounds(g.face, g.gid);
      if (b) {
        const s = (g.px * PU) / g.face.upem;
        ink_x0 = Math.min(ink_x0, run_w + g.xoff + b[0] * s);
        ink_x1 = Math.max(ink_x1, run_w + g.xoff + b[2] * s);
        ink_bottom = Math.max(ink_bottom, -b[1] * s - g.yoff);
      }
      run_w += g.width;
    }
    const face = gl[r0].face, sc = (gl[r0].px * PU) / face.upem, m = face_metrics(face);
    const thick = Math.round(m.underline_thickness * sc);
    const base_y = baseline - gl[r0].yoff;
    if (a0.underline !== 'none') {
      const has_ink = ink_x0 !== Infinity;
      const nx = run_x + Math.min(has_ink ? ink_x0 : 0, 0);
      const nw = Math.max(has_ink ? ink_x1 - ink_x0 : 0, run_w);
      const ny = a0.underline === 'low' ? base_y + (has_ink ? ink_bottom : 0) + thick : base_y - Math.round(m.underline_position * sc);
      const color = a0.underline_color ?? a0.color;
      if (ul && ul.kind === a0.underline && ul.color === color && ul.y === ny && ul.h === thick) ul.w = nx + nw - ul.x;
      else {
        flush_ul();
        ul = { kind: a0.underline, color, x: nx, y: ny, w: nw, h: thick };
      }
    } else flush_ul();
    if (a0.strikethrough && ink_x0 !== Infinity) {
      // pangocoretext: strikethrough at ascent / 3 with the underline thickness
      const ny = base_y - Math.trunc(Math.round(face.ascender * sc) / 3);
      const color = a0.strikethrough_color ?? a0.color;
      if (st && st.color === color && st.y === ny && st.h === thick) st.w = run_x + ink_x1 - st.x;
      else {
        flush_st();
        st = { color, x: run_x + ink_x0, y: ny, w: ink_x1 - ink_x0, h: thick };
      }
    } else if (!a0.strikethrough) flush_st();
    for (let k = r0; k < r1; k++) {
      const g = gl[k];
      if (glyph_bounds(g.face, g.gid)) {
        const ox = x0 + (pen + g.xoff) / PU, oy = y0 + (baseline - g.yoff) / PU;
        shapes.push({ cmds: glyph_cmds(g, ox, oy), color: chars[g.c0].a.color, alpha: chars[g.c0].a.alpha, glyph: true });
      }
      pen += g.width;
    }
    r0 = r1;
  }
  flush_ul();
  flush_st();
  report_width(pen);
  return baseline + desc;
}

/** One run of manim's Text (manimpango.TextSetting). */
export interface TextSetting {
  start: number;
  end: number;
  font: string;
  slant: string;
  weight: string;
  line_num: number;
  color: string | null;
}

/**
 * manimpango.text2svg: each setting is laid out separately at
 * (START_X + offset_x, START_Y + line_spacing * line_num).
 */
export function text2svg(settings: readonly TextSetting[], size: number, line_spacing: number, disable_liga: boolean, start_x: number, start_y: number, width: number, orig_text: string, weight_of: (w: string) => number, style_of: (s: string) => FontStyleName): TextShape[] {
  const shapes: TextShape[] = [];
  let offset_x = 0, last_line = 0;
  for (const s of settings) {
    const text = orig_text.slice(s.start, s.end).replace(/\n/g, ' ');
    if (s.line_num !== last_line) {
      offset_x = 0;
      last_line = s.line_num;
    }
    const spans: Span[] = s.color ? [{ start: 0, end: text.length, attrs: { color: s.color } }] : [];
    const r = layout_text(text, spans, start_x + offset_x, start_y + line_spacing * s.line_num, {
      font_desc: { family: s.font, weight: weight_of(s.weight), style: style_of(s.slant), size }, width, liga: !disable_liga,
    });
    shapes.push(...r.shapes);
    offset_x += r.width;
  }
  return shapes;
}

/** manimpango.MarkupUtils.text2svg (a single Pango layout of the markup). */
export function markup2svg(markup: string, font: FontDesc, disable_liga: boolean, start_x: number, start_y: number, width: number, justify = false): TextShape[] {
  const { text, spans } = parse_markup(markup);
  const all: Span[] = disable_liga ? [{ start: 0, end: text.length, attrs: { liga: false } }, ...spans] : spans;
  return layout_text(text, all, start_x, start_y, { font_desc: font, width, justify, liga: true }).shapes;
}
