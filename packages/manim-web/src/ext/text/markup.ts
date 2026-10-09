// Pango markup parser (web extension; manim hands markup to Pango).
// Supports the tags and <span> attributes Pango documents: b, big, i, s, sub,
// sup, small, tt, u, span/font with font/font_desc, font_family/face,
// size/font_size, style, weight, variant, stretch, foreground/fgcolor/color,
// background, alpha, underline(+_color), strikethrough(+_color), rise,
// baseline_shift, font_scale, letter_spacing, font_features, text_transform...
import { parse_style, parse_weight, type FontStyleName } from './fonts';

export type UnderlineKind = 'none' | 'single' | 'double' | 'low' | 'error';

/** Attributes a markup span can set (Pango semantics; sizes in points, rise in Pango units). */
export interface SpanAttrs {
  family?: string;
  weight?: number;
  style?: FontStyleName;
  size?: number;
  /** Multiplies the size (big/small/x-large/percent); compounds with outer spans. */
  scale?: number;
  /** Absolute scale level (xx-small..xx-large) - replaces outer scales. */
  scale_abs?: number;
  color?: string;
  alpha?: number;
  background?: string;
  underline?: UnderlineKind;
  underline_color?: string;
  strikethrough?: boolean;
  strikethrough_color?: string;
  rise?: number;
  baseline_shift?: number | 'superscript' | 'subscript';
  font_scale?: 'superscript' | 'subscript' | 'small-caps';
  letter_spacing?: number;
  liga?: boolean;
  text_transform?: 'none' | 'lowercase' | 'uppercase' | 'capitalize';
}
/** A range of the plain text (UTF-16 indices) with attributes. */
export interface Span {
  start: number;
  end: number;
  attrs: SpanAttrs;
}

// Pango (>= 1.50) parses CSS colour names.
const CSS_COLORS: Record<string, string> = {
  aliceblue: 'f0f8ff', antiquewhite: 'faebd7', aqua: '00ffff', aquamarine: '7fffd4', azure: 'f0ffff', beige: 'f5f5dc', bisque: 'ffe4c4',
  black: '000000', blanchedalmond: 'ffebcd', blue: '0000ff', blueviolet: '8a2be2', brown: 'a52a2a', burlywood: 'deb887', cadetblue: '5f9ea0',
  chartreuse: '7fff00', chocolate: 'd2691e', coral: 'ff7f50', cornflowerblue: '6495ed', cornsilk: 'fff8dc', crimson: 'dc143c', cyan: '00ffff',
  darkblue: '00008b', darkcyan: '008b8b', darkgoldenrod: 'b8860b', darkgray: 'a9a9a9', darkgreen: '006400', darkgrey: 'a9a9a9', darkkhaki: 'bdb76b',
  darkmagenta: '8b008b', darkolivegreen: '556b2f', darkorange: 'ff8c00', darkorchid: '9932cc', darkred: '8b0000', darksalmon: 'e9967a',
  darkseagreen: '8fbc8f', darkslateblue: '483d8b', darkslategray: '2f4f4f', darkslategrey: '2f4f4f', darkturquoise: '00ced1', darkviolet: '9400d3',
  deeppink: 'ff1493', deepskyblue: '00bfff', dimgray: '696969', dimgrey: '696969', dodgerblue: '1e90ff', firebrick: 'b22222', floralwhite: 'fffaf0',
  forestgreen: '228b22', fuchsia: 'ff00ff', gainsboro: 'dcdcdc', ghostwhite: 'f8f8ff', gold: 'ffd700', goldenrod: 'daa520', gray: '808080',
  grey: '808080', green: '008000', greenyellow: 'adff2f', honeydew: 'f0fff0', hotpink: 'ff69b4', indianred: 'cd5c5c', indigo: '4b0082',
  ivory: 'fffff0', khaki: 'f0e68c', lavender: 'e6e6fa', lavenderblush: 'fff0f5', lawngreen: '7cfc00', lemonchiffon: 'fffacd', lightblue: 'add8e6',
  lightcoral: 'f08080', lightcyan: 'e0ffff', lightgoldenrodyellow: 'fafad2', lightgray: 'd3d3d3', lightgreen: '90ee90', lightgrey: 'd3d3d3',
  lightpink: 'ffb6c1', lightsalmon: 'ffa07a', lightseagreen: '20b2aa', lightskyblue: '87cefa', lightslategray: '778899', lightslategrey: '778899',
  lightsteelblue: 'b0c4de', lightyellow: 'ffffe0', lime: '00ff00', limegreen: '32cd32', linen: 'faf0e6', magenta: 'ff00ff', maroon: '800000',
  mediumaquamarine: '66cdaa', mediumblue: '0000cd', mediumorchid: 'ba55d3', mediumpurple: '9370db', mediumseagreen: '3cb371', mediumslateblue: '7b68ee',
  mediumspringgreen: '00fa9a', mediumturquoise: '48d1cc', mediumvioletred: 'c71585', midnightblue: '191970', mintcream: 'f5fffa', mistyrose: 'ffe4e1',
  moccasin: 'ffe4b5', navajowhite: 'ffdead', navy: '000080', oldlace: 'fdf5e6', olive: '808000', olivedrab: '6b8e23', orange: 'ffa500',
  orangered: 'ff4500', orchid: 'da70d6', palegoldenrod: 'eee8aa', palegreen: '98fb98', paleturquoise: 'afeeee', palevioletred: 'db7093',
  papayawhip: 'ffefd5', peachpuff: 'ffdab9', peru: 'cd853f', pink: 'ffc0cb', plum: 'dda0dd', powderblue: 'b0e0e6', purple: '800080',
  rebeccapurple: '663399', red: 'ff0000', rosybrown: 'bc8f8f', royalblue: '4169e1', saddlebrown: '8b4513', salmon: 'fa8072', sandybrown: 'f4a460',
  seagreen: '2e8b57', seashell: 'fff5ee', sienna: 'a0522d', silver: 'c0c0c0', skyblue: '87ceeb', slateblue: '6a5acd', slategray: '708090',
  slategrey: '708090', snow: 'fffafa', springgreen: '00ff7f', steelblue: '4682b4', tan: 'd2b48c', teal: '008080', thistle: 'd8bfd8', tomato: 'ff6347',
  turquoise: '40e0d0', violet: 'ee82ee', wheat: 'f5deb3', white: 'ffffff', whitesmoke: 'f5f5f5', yellow: 'ffff00', yellowgreen: '9acd32',
};

/** pango_color_parse: '#rgb', '#rrggbb', '#rrrgggbbb', '#rrrrggggbbbb' or a CSS colour name -> '#rrggbb'. */
export function pango_color(spec: string): string | null {
  const s = spec.trim();
  if (s.startsWith('#')) {
    const h = s.slice(1);
    if (!/^[0-9a-fA-F]+$/.test(h) || h.length % 3 !== 0 || h.length < 3 || h.length > 12) return null;
    const n = h.length / 3;
    const ch = (i: number) => {
      const v = parseInt(h.slice(i * n, (i + 1) * n), 16) / (16 ** n - 1);
      return Math.round(v * 255).toString(16).padStart(2, '0');
    };
    return '#' + ch(0) + ch(1) + ch(2);
  }
  const hex = CSS_COLORS[s.toLowerCase().replace(/[\s_]/g, '')];
  return hex ? '#' + hex : null;
}

const ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" };
function decode_entities(s: string, where: () => string): string {
  return s.replace(/&([^;&<>\s]*);?/g, (m, name: string) => {
    if (!m.endsWith(';')) throw new Error(`Entity did not end with a semicolon; most likely you used an ampersand character without intending to start an entity - escape ampersand as &amp; ${where()}`);
    if (name.startsWith('#')) {
      const cp = name[1] === 'x' || name[1] === 'X' ? parseInt(name.slice(2), 16) : parseInt(name.slice(1), 10);
      if (!Number.isFinite(cp)) throw new Error(`Failed to parse '${m}' ${where()}`);
      return String.fromCodePoint(cp);
    }
    if (!(name in ENTITIES)) throw new Error(`Entity name '${name}' is not known ${where()}`);
    return ENTITIES[name];
  });
}

const SCALE_LEVELS: Record<string, number> = { 'xx-small': -3, 'x-small': -2, small: -1, medium: 0, large: 1, 'x-large': 2, 'xx-large': 3 };

function parse_size(v: string, a: SpanAttrs): boolean {
  const t = v.trim();
  if (/^\d+$/.test(t)) a.size = +t / 1024;
  else if (/^[\d.]+pt$/.test(t)) a.size = parseFloat(t);
  else if (/^[\d.]+%$/.test(t)) a.scale = (a.scale ?? 1) * (parseFloat(t) / 100);
  else if (t === 'smaller') a.scale = (a.scale ?? 1) / 1.2;
  else if (t === 'larger') a.scale = (a.scale ?? 1) * 1.2;
  else if (t in SCALE_LEVELS) a.scale_abs = 1.2 ** SCALE_LEVELS[t];
  else return false;
  return true;
}
const STYLE_WORDS = new Set(['normal', 'roman', 'italic', 'oblique']);
/** Parse a Pango font description string ("Sans Bold Italic 12"). */
export function parse_font_desc(desc: string, a: SpanAttrs = {}): SpanAttrs {
  const words = desc.replace(/,/g, ' ').trim().split(/\s+/).filter(Boolean);
  let i = words.length;
  if (i && /^[\d.]+(px)?$/.test(words[i - 1])) {
    const w = words[--i];
    a.size = w.endsWith('px') ? (parseFloat(w) * 72) / 96 : parseFloat(w);
  }
  while (i > 0) {
    const w = words[i - 1].toLowerCase();
    if (STYLE_WORDS.has(w)) a.style = w === 'roman' ? 'normal' : (w as FontStyleName);
    else if (w !== 'regular' && parse_weight(w) !== 400) a.weight = parse_weight(w);
    else if (w === 'regular') a.weight = 400;
    else break;
    i--;
  }
  if (i > 0) a.family = words.slice(0, i).join(' ');
  return a;
}
function parse_bool(v: string): boolean {
  return /^(true|yes|1)$/i.test(v.trim());
}
function parse_units(v: string): number {
  const t = v.trim();
  if (/pt$/.test(t)) return parseFloat(t) * 1024;
  return parseFloat(t);
}
function color_attr(v: string, name: string, where: () => string): string {
  const c = pango_color(v);
  if (!c) throw new Error(`Could not parse color specification '${v}' for attribute '${name}' ${where()}`);
  return c;
}

const SPAN_ATTRS = new Set([
  'font', 'font_desc', 'font_family', 'face', 'font_size', 'size', 'font_style', 'style', 'font_weight', 'weight', 'font_variant', 'variant',
  'font_stretch', 'stretch', 'font_features', 'foreground', 'fgcolor', 'color', 'background', 'bgcolor', 'alpha', 'fgalpha', 'background_alpha',
  'bgalpha', 'underline', 'underline_color', 'overline', 'overline_color', 'rise', 'baseline_shift', 'font_scale', 'strikethrough',
  'strikethrough_color', 'fallback', 'lang', 'letter_spacing', 'gravity', 'gravity_hint', 'show', 'insert_hyphens', 'allow_breaks',
  'line_height', 'text_transform', 'segment',
]);

function span_attrs(raw: Record<string, string>, where: () => string): SpanAttrs {
  const a: SpanAttrs = {};
  for (const [k, v] of Object.entries(raw)) {
    if (!SPAN_ATTRS.has(k)) throw new Error(`Attribute '${k}' is not allowed on the <span> tag ${where()}`);
    switch (k) {
      case 'font': case 'font_desc': parse_font_desc(v, a); break;
      case 'font_family': case 'face': a.family = v; break;
      case 'font_size': case 'size':
        if (!parse_size(v, a)) throw new Error(`Value of 'size' attribute on <span> tag ${where()} could not be parsed; should be an integer, or a string such as 'small', not '${v}'`);
        break;
      case 'font_style': case 'style': a.style = parse_style(v); break;
      case 'font_weight': case 'weight': a.weight = parse_weight(v); break;
      case 'foreground': case 'fgcolor': case 'color': a.color = color_attr(v, k, where); break;
      case 'background': case 'bgcolor': a.background = color_attr(v, k, where); break;
      case 'alpha': case 'fgalpha': a.alpha = v.endsWith('%') ? parseFloat(v) / 100 : +v / 65535; break;
      case 'underline': {
        const u = v.toLowerCase();
        a.underline = u === 'true' ? 'single' : u === 'false' ? 'none' : (u as UnderlineKind);
        if (!['none', 'single', 'double', 'low', 'error'].includes(a.underline)) throw new Error(`'${v}' is not a valid value for the 'underline' attribute on <span> tag ${where()}`);
        break;
      }
      case 'underline_color': a.underline_color = color_attr(v, k, where); break;
      case 'strikethrough': a.strikethrough = parse_bool(v); break;
      case 'strikethrough_color': a.strikethrough_color = color_attr(v, k, where); break;
      case 'rise': a.rise = parse_units(v); break;
      case 'baseline_shift': a.baseline_shift = v === 'superscript' || v === 'subscript' ? v : v === 'none' ? 0 : parse_units(v); break;
      case 'font_scale': if (v === 'superscript' || v === 'subscript' || v === 'small-caps') a.font_scale = v; break;
      case 'letter_spacing': a.letter_spacing = parse_units(v); break;
      case 'font_features': {
        const m = /(?:^|[,\s])(liga)\s*=\s*(\d)/.exec(v) ?? /(-)(liga)\b/.exec(v);
        if (m) a.liga = m[1] === '-' ? false : m[2] !== '0';
        break;
      }
      case 'text_transform': a.text_transform = v as SpanAttrs['text_transform']; break;
      default: break; // accepted, not rendered (variant, stretch, gravity, lang, ...)
    }
  }
  return a;
}

const SIMPLE_TAGS: Record<string, SpanAttrs> = {
  b: { weight: 700 }, i: { style: 'italic' }, s: { strikethrough: true }, u: { underline: 'single' }, tt: { family: 'Monospace' },
  big: { scale: 1.2 }, small: { scale: 1 / 1.2 },
  sub: { font_scale: 'subscript', baseline_shift: 'subscript' }, sup: { font_scale: 'superscript', baseline_shift: 'superscript' },
};

/** Parse Pango markup into plain text plus attribute spans (throws on invalid markup, like MarkupUtils.validate). */
export function parse_markup(markup: string): { text: string; spans: Span[] } {
  let text = '';
  const spans: Span[] = [];
  const stack: { tag: string; span: Span }[] = [];
  let pos = 0;
  const where = () => {
    const before = markup.slice(0, pos);
    const line = before.split('\n').length;
    return `on line ${line} char ${pos - before.lastIndexOf('\n')}`;
  };
  const re = /<(\/?)([A-Za-z_][\w-]*)((?:\s+[\w-]+\s*=\s*(?:"[^"]*"|'[^']*'))*)\s*(\/?)>/y;
  while (pos < markup.length) {
    const lt = markup.indexOf('<', pos);
    const chunk = markup.slice(pos, lt < 0 ? markup.length : lt);
    if (chunk) text += decode_entities(chunk, where);
    if (lt < 0) break;
    pos = lt;
    re.lastIndex = lt;
    const m = re.exec(markup);
    if (!m) {
      if (markup.startsWith('<!--', lt)) {
        const e = markup.indexOf('-->', lt);
        pos = e < 0 ? markup.length : e + 3;
        continue;
      }
      throw new Error(`Error on line ${markup.slice(0, lt).split('\n').length}: '<' is not a valid start of a tag or text ${where()}`);
    }
    const [whole, close, tag, attrs_src, self_close] = m;
    pos = lt + whole.length;
    if (close) {
      const top = stack.pop();
      if (!top || top.tag !== tag) throw new Error(`Element '${tag}' was closed, but the currently open element is '${top?.tag ?? ''}' ${where()}`);
      top.span.end = text.length;
      continue;
    }
    const raw: Record<string, string> = {};
    for (const am of attrs_src.matchAll(/([\w-]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g)) raw[am[1]] = decode_entities(am[2] ?? am[3] ?? '', where);
    let attrs: SpanAttrs;
    if (tag === 'markup') attrs = {};
    else if (tag === 'span' || tag === 'font') attrs = span_attrs(raw, where);
    else if (tag in SIMPLE_TAGS) {
      if (Object.keys(raw).length) throw new Error(`Tag '${tag}' does not support attribute '${Object.keys(raw)[0]}' ${where()}`);
      attrs = { ...SIMPLE_TAGS[tag] };
    } else throw new Error(`Unknown tag '${tag}' ${where()}`);
    const span: Span = { start: text.length, end: text.length, attrs };
    spans.push(span);
    if (!self_close) stack.push({ tag, span });
  }
  if (stack.length) throw new Error(`Document ended unexpectedly with elements still open - '${stack[stack.length - 1].tag}' was the last element opened`);
  return { text, spans };
}

/** Escape text for inclusion in markup (xml.sax.saxutils.escape). */
export function escape_markup(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
