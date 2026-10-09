/// <reference path="./opentype.d.ts" />
// Font registry for Text / MarkupText / Code (web extension).
//
// manim renders text with Pango, which finds fonts through the operating
// system. manim-web parses font files itself with opentype.js, so fonts must be
// loaded (asynchronously) before a scene's construct() runs:
//
//   await load_fonts();                                   // bundled fonts (ScenePlayer.load does this)
//   await register_font('https://example.com/Inter.woff'); // any TTF/OTF/WOFF (TTC in node)
//   await register_font('My Font', bytesOrUrl, { weight: 700 });
//   Text('hi', { font: 'Inter' })
//
// Bundled open fonts (licences in ./fonts/LICENSE-*), standing in for the fonts
// Pango picks on macOS (where the regression goldens were rendered):
//   ''/serif (manim's default)  -> Tinos             (Times metrics; Pango/CoreText default = Times)
//   sans / sans-serif           -> Arimo             (Helvetica/Arial metrics)
//   monospace (Code)            -> DejaVu Sans Mono  (Menlo is derived from it)
// Their vertical metrics are overridden with the macOS fonts' values so line
// heights match. In node, `load_fonts({ system_fonts: true })` registers the
// real macOS fonts instead (Times.ttc, Helvetica.ttc, Menlo.ttc) and looks up
// other families in the system font folders on demand.
import { parse as parse_font, type Font, type Glyph } from 'opentype.js';

export type FontStyleName = 'normal' | 'italic' | 'oblique';

/** One loaded font face (a single weight/style of a family). */
export interface FontFace {
  family: string;
  weight: number;
  style: FontStyleName;
  font: Font;
  upem: number;
  /** Font units, y up (descender negative). */
  ascender: number;
  descender: number;
  fixed_pitch: boolean;
  /** 'kern': legacy kern table - HarfBuzz splits each pair adjustment between both glyphs. */
  kern_mode: 'gpos' | 'kern' | 'none';
  /** AAT font (morx, no GSUB): emulate its default fi/fl ligatures. */
  aat_ligatures: boolean;
  source: string;
  _outlines: Map<number, Float64Array>;
  _kern: Map<number, number>;
  _liga: unknown;
}

/** Options for register_font. */
export interface RegisterFontOptions {
  /** Family name to register under (default: the font's own family name). */
  family?: string;
  weight?: number;
  style?: FontStyleName;
  /** Face index in a TrueType collection (default: all faces). */
  index?: number;
  /** Override vertical metrics (in em): { ascender, descender }. */
  metrics?: { ascender?: number; descender?: number };
}

const families = new Map<string, FontFace[]>();
/** Generic family -> registered family (lower case keys). */
const generic = new Map<string, string>([['serif', 'tinos'], ['sans', 'arimo'], ['monospace', 'dejavu sans mono']]);
const GENERIC_ALIASES: Record<string, string> = {
  '': 'serif', serif: 'serif', 'sans-serif': 'sans', sans: 'sans', monospace: 'monospace', mono: 'monospace',
  'system-ui': 'sans', cursive: 'serif', fantasy: 'serif',
};
const warned = new Set<string>();
let node_fs: any = null;
let system_fonts = false;

/** manimpango's weight names -> CSS/Pango numeric weights. */
export const WEIGHTS: Record<string, number> = {
  THIN: 100, ULTRALIGHT: 200, LIGHT: 300, SEMILIGHT: 350, BOOK: 380, NORMAL: 400, MEDIUM: 500,
  SEMIBOLD: 600, BOLD: 700, ULTRABOLD: 800, HEAVY: 900, ULTRAHEAVY: 1000,
};
/** Weight name or number -> number. */
export function parse_weight(w: string | number | null | undefined): number {
  if (w == null) return 400;
  if (typeof w === 'number') return w;
  const k = w.toUpperCase().replace(/[-_ ]/g, '');
  const alias: Record<string, string> = { REGULAR: 'NORMAL', EXTRALIGHT: 'ULTRALIGHT', DEMIBOLD: 'SEMIBOLD', EXTRABOLD: 'ULTRABOLD', BLACK: 'HEAVY', EXTRABLACK: 'ULTRAHEAVY', ULTRABLACK: 'ULTRAHEAVY' };
  if (/^\d+$/.test(k)) return +k;
  return WEIGHTS[alias[k] ?? k] ?? 400;
}
/** Slant name -> style. */
export function parse_style(s: string | null | undefined): FontStyleName {
  const k = (s ?? 'NORMAL').toLowerCase();
  return k === 'italic' ? 'italic' : k === 'oblique' ? 'oblique' : 'normal';
}

const is_node = (): boolean => {
  const p = (globalThis as any).process;
  return !!p?.versions?.node && typeof (globalThis as any).window === 'undefined';
};

async function get_node_fs(): Promise<any> {
  if (node_fs || !is_node()) return node_fs;
  const name = 'node:fs';
  node_fs = await import(/* @vite-ignore */ name);
  return node_fs;
}

/** Read a UTF-8 text file synchronously (node only; used by Code(code_file=...)). */
export function read_text_file_sync(path: string): string {
  const fs = node_fs ?? (globalThis as any).process?.getBuiltinModule?.('node:fs');
  if (!fs) throw new Error(`manim-web: cannot read '${path}' in the browser; pass the source as code_string`);
  return fs.readFileSync(path, 'utf8');
}

// ------------------------------------------------------------------ parsing

/** Split a TrueType collection into standalone sfnt buffers (opentype.js reads single fonts only). */
function sfnt_faces(bytes: Uint8Array, only?: number): Uint8Array[] {
  const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const tag = String.fromCharCode(bytes[0], bytes[1], bytes[2], bytes[3]);
  if (tag !== 'ttcf') return [bytes];
  const n = dv.getUint32(8);
  const out: Uint8Array[] = [];
  for (let k = 0; k < n; k++) {
    if (only !== undefined && k !== only) continue;
    const off = dv.getUint32(12 + 4 * k);
    const nt = dv.getUint16(off + 4);
    const tables: [number, number, number, number][] = [];
    let size = 12 + 16 * nt;
    for (let i = 0; i < nt; i++) {
      const r = off + 12 + 16 * i;
      const t: [number, number, number, number] = [dv.getUint32(r), dv.getUint32(r + 4), dv.getUint32(r + 8), dv.getUint32(r + 12)];
      tables.push(t);
      size += (t[3] + 3) & ~3;
    }
    const buf = new Uint8Array(size);
    const ov = new DataView(buf.buffer);
    buf.set(bytes.subarray(off, off + 12), 0);
    let p = 12 + 16 * nt;
    tables.forEach(([tg, sum, o, len], i) => {
      const r = 12 + 16 * i;
      ov.setUint32(r, tg);
      ov.setUint32(r + 4, sum);
      ov.setUint32(r + 8, p);
      ov.setUint32(r + 12, len);
      buf.set(bytes.subarray(o, o + len), p);
      p += (len + 3) & ~3;
    });
    out.push(buf);
  }
  return out;
}
function has_table(bytes: Uint8Array, tag: string): boolean {
  const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const sig = String.fromCharCode(bytes[0], bytes[1], bytes[2], bytes[3]);
  const woff = sig === 'wOFF';
  const n = dv.getUint16(woff ? 12 : 4);
  for (let i = 0; i < n; i++) {
    const r = woff ? 44 + 20 * i : 12 + 16 * i;
    if (String.fromCharCode(bytes[r], bytes[r + 1], bytes[r + 2], bytes[r + 3]) === tag) return true;
  }
  return false;
}

function make_face(bytes: Uint8Array, source: string, o: RegisterFontOptions): FontFace {
  const ab = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
  const font = parse_font(ab);
  const os2 = font.tables.os2;
  const head = font.tables.head;
  const hhea = font.tables.hhea;
  const upem = font.unitsPerEm;
  const sub = (font.names.fontSubfamily?.en ?? '').toLowerCase();
  const mac = head?.macStyle ?? 0;
  const weight = o.weight ?? (os2?.usWeightClass || ((mac & 1) || /bold/.test(sub) ? 700 : 400));
  const italic = os2 ? (os2.fsSelection & 1) !== 0 || (os2.fsSelection & 512) !== 0 : (mac & 2) !== 0 || /italic|oblique/.test(sub);
  const style: FontStyleName = o.style ?? (italic ? (/oblique/.test(sub) ? 'oblique' : 'italic') : 'normal');
  const family = o.family ?? font.names.preferredFamily?.en ?? font.names.fontFamily?.en ?? 'Unknown';
  const gpos = !!font.position?.defaultKerningTables;
  const has_gsub = !!font.tables.gsub;
  return {
    family, weight, style, font, upem,
    ascender: o.metrics?.ascender !== undefined ? o.metrics.ascender * upem : (hhea?.ascender ?? font.ascender),
    descender: o.metrics?.descender !== undefined ? o.metrics.descender * upem : (hhea?.descender ?? font.descender),
    fixed_pitch: !!font.tables.post?.isFixedPitch,
    kern_mode: gpos ? 'gpos' : Object.keys(font.kerningPairs ?? {}).length ? 'kern' : 'none',
    aat_ligatures: !has_gsub && has_table(bytes, 'morx'),
    source, _outlines: new Map(), _kern: new Map(), _liga: null,
  };
}

function add_face(face: FontFace): void {
  const key = face.family.toLowerCase();
  const list = families.get(key) ?? [];
  list.push(face);
  families.set(key, list);
}

/** Register already-loaded font bytes synchronously. Returns the registered family names. */
export function register_font_bytes(bytes: Uint8Array | ArrayBuffer, options: RegisterFontOptions = {}, source = '<bytes>'): string[] {
  const u8 = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  const sig = String.fromCharCode(u8[0], u8[1], u8[2], u8[3]);
  if (sig === 'wOF2') throw new Error(`register_font: WOFF2 is not supported (${source}); use TTF, OTF or WOFF`);
  const names: string[] = [];
  for (const face_bytes of sfnt_faces(u8, options.index)) {
    const face = make_face(face_bytes, source, options);
    add_face(face);
    if (!names.includes(face.family)) names.push(face.family);
  }
  return names;
}

async function read_source(src: string | ArrayBuffer | Uint8Array): Promise<Uint8Array> {
  if (typeof src !== 'string') return src instanceof Uint8Array ? src : new Uint8Array(src);
  const fs = await get_node_fs();
  if (fs && !/^(https?|data|blob):/i.test(src)) {
    const path = src.startsWith('file:') ? decodeURIComponent(new URL(src).pathname) : src;
    return new Uint8Array(fs.readFileSync(path));
  }
  const r = await fetch(src);
  if (!r.ok) throw new Error(`register_font: cannot load ${src} (${r.status})`);
  return new Uint8Array(await r.arrayBuffer());
}

/**
 * Load a font file so Text/MarkupText/Code can use it (web: async, call before
 * the scene is built; manim's register_font is a context manager around
 * Pango's font registration). Accepts `register_font(file_or_url, options?)`
 * or `register_font(family, file_or_url_or_bytes, options?)`.
 */
export async function register_font(font_file: string | ArrayBuffer | Uint8Array, source?: string | ArrayBuffer | Uint8Array | RegisterFontOptions, options: RegisterFontOptions = {}): Promise<string[]> {
  let src: string | ArrayBuffer | Uint8Array = font_file;
  let opts = options;
  if (source !== undefined && (typeof source === 'string' || source instanceof ArrayBuffer || source instanceof Uint8Array)) {
    opts = { ...options, family: font_file as string };
    src = source;
  } else if (source !== undefined) opts = { ...(source as RegisterFontOptions), ...options };
  const bytes = await read_source(src);
  return register_font_bytes(bytes, opts, typeof src === 'string' ? src : '<bytes>');
}

/** Map a generic family ('serif', 'sans', 'monospace') to a registered family. */
export function set_generic_family(generic_name: 'serif' | 'sans' | 'monospace', family: string): void {
  generic.set(generic_name, family.toLowerCase());
}

/** Names of the registered font families (manim's Text.font_list()). */
export function list_fonts(): string[] {
  const out = new Set<string>(['Sans', 'Serif', 'Monospace']);
  for (const faces of families.values()) out.add(faces[0].family);
  return [...out].sort();
}

// ------------------------------------------------------------------ bundled / system fonts

interface Bundled { file: string; family: string; weight: number; style: FontStyleName; metrics?: { ascender: number; descender: number } }
const TIMES_V = { ascender: 1536 / 2048, descender: -512 / 2048 };
const HELVETICA_V = { ascender: 1577 / 2048, descender: -471 / 2048 };
const BUNDLED: Bundled[] = [
  ...(['400-normal', '400-italic', '700-normal', '700-italic', ...['greek', 'cyrillic'].map((s) => s + ':400-normal')] as string[]).flatMap((v) => {
    const [sub, wv] = v.includes(':') ? v.split(':') : ['latin', v];
    const [w, st] = wv.split('-');
    return [
      { file: `tinos-${sub}-${w}-${st}.woff`, family: 'Tinos', weight: +w, style: st as FontStyleName, metrics: TIMES_V },
      { file: `arimo-${sub}-${w}-${st}.woff`, family: 'Arimo', weight: +w, style: st as FontStyleName, metrics: HELVETICA_V },
    ];
  }),
  { file: 'dejavu-sans-mono-latin-400-normal.woff', family: 'DejaVu Sans Mono', weight: 400, style: 'normal' },
  { file: 'dejavu-sans-mono-latin-700-normal.woff', family: 'DejaVu Sans Mono', weight: 700, style: 'normal' },
];

/** macOS fonts Pango/CoreText uses for manim's defaults. */
const MAC_SYSTEM: [string, string][] = [
  ['/System/Library/Fonts/Times.ttc', 'serif'],
  ['/System/Library/Fonts/Helvetica.ttc', 'sans'],
  ['/System/Library/Fonts/Menlo.ttc', 'monospace'],
];
const SYSTEM_DIRS = ['/System/Library/Fonts', '/System/Library/Fonts/Supplemental', '/Library/Fonts'];
let system_listing: string[] | null = null;

/** Options for load_fonts. */
export interface LoadFontsOptions {
  /** Directory or URL holding the bundled font files (default: next to this module). */
  font_dir?: string;
  /** Node only: use the macOS system fonts manim/Pango uses, and look up other families on demand. */
  system_fonts?: boolean;
}

let loading: Promise<void> | null = null;

/** Load the bundled fonts (once). ScenePlayer.load awaits this before construct(). */
export function load_fonts(options: LoadFontsOptions = {}): Promise<void> {
  if (!loading) loading = do_load(options);
  return loading;
}
/** Alias of load_fonts (text subsystem initialisation). */
export const init_text = load_fonts;

async function do_load(o: LoadFontsOptions): Promise<void> {
  const fs = await get_node_fs();
  const url_of = (f: string): string => {
    if (o.font_dir) return o.font_dir.replace(/\/$/, '') + '/' + f;
    return new URL(`./fonts/${f}`, import.meta.url).href;
  };
  await Promise.all(BUNDLED.map(async (b) => {
    try {
      const bytes = await read_source(url_of(b.file));
      register_font_bytes(bytes, { family: b.family, weight: b.weight, style: b.style, metrics: b.metrics }, b.file);
    } catch (e: any) {
      if (!(o.system_fonts && fs)) console.warn(`manim-web: could not load bundled font ${b.file}: ${e?.message ?? e}`);
    }
  }));
  if (o.system_fonts && fs) {
    system_fonts = true;
    for (const [file, gen] of MAC_SYSTEM) {
      if (!fs.existsSync(file)) continue;
      const names = register_font_bytes(new Uint8Array(fs.readFileSync(file)), {}, file);
      if (names.length) generic.set(gen, names[0].toLowerCase());
    }
  }
}

/** Node + system_fonts: find a family's files in the system font folders. */
function try_system_family(key: string): boolean {
  if (!system_fonts || !node_fs) return false;
  if (!system_listing) {
    system_listing = [];
    for (const d of SYSTEM_DIRS) {
      try {
        for (const f of node_fs.readdirSync(d)) if (/\.(ttf|ttc|otf)$/i.test(f)) system_listing.push(`${d}/${f}`);
      } catch {
        /* missing folder */
      }
    }
  }
  const hits = system_listing.filter((p) => {
    const base = p.slice(p.lastIndexOf('/') + 1).replace(/\.(ttf|ttc|otf)$/i, '').toLowerCase();
    return base === key || base.startsWith(key + ' ') || base.replace(/[ -]/g, '') === key.replace(/[ -]/g, '');
  });
  for (const p of hits) {
    try {
      register_font_bytes(new Uint8Array(node_fs.readFileSync(p)), {}, p);
    } catch {
      /* unreadable font */
    }
  }
  return families.has(key);
}

// ------------------------------------------------------------------ resolution

function family_key(family: string): string {
  let key = (family ?? '').trim().toLowerCase();
  if (key in GENERIC_ALIASES) key = generic.get(GENERIC_ALIASES[key]) ?? key;
  return key;
}

/** A requested font resolved to an ordered list of faces (best match first, fallbacks after). */
export interface ResolvedFont {
  faces: FontFace[];
  /** Requested italic/oblique but the family has no slanted face: shear the outlines. */
  synth_italic: boolean;
  key: string;
}
const resolve_cache = new Map<string, ResolvedFont>();

function score(f: FontFace, weight: number, style: FontStyleName): number {
  const s = f.style === style ? 0 : style !== 'normal' && f.style !== 'normal' ? 1 : 2;
  let dw = Math.abs(f.weight - weight);
  // CSS rule: for bold requests prefer heavier faces, for light requests lighter ones
  if ((weight > 500 && f.weight < weight) || (weight < 400 && f.weight > weight)) dw += 50;
  return s * 10000 + dw;
}

/** Resolve family/weight/style to faces (warns once and falls back if the family is not loaded). */
export function resolve_font(family: string, weight: number, style: FontStyleName): ResolvedFont {
  const ck = `${family}|${weight}|${style}|${families.size}`;
  const hit = resolve_cache.get(ck);
  if (hit) return hit;
  let key = family_key(family);
  if (!families.has(key) && !try_system_family(key)) {
    const fallback = family_key('');
    if (!warned.has(key) && families.size) {
      warned.add(key);
      console.warn(`manim-web: font "${family}" is not loaded; using "${families.get(fallback)?.[0].family ?? 'none'}". Load it with register_font().`);
    }
    key = fallback;
  }
  const own = [...(families.get(key) ?? [])].sort((a, b) => score(a, weight, style) - score(b, weight, style));
  const others: FontFace[] = [];
  const dkey = family_key('');
  for (const k of [dkey, ...families.keys()]) {
    if (k === key) continue;
    for (const f of [...(families.get(k) ?? [])].sort((a, b) => score(a, weight, style) - score(b, weight, style))) if (!others.includes(f)) others.push(f);
  }
  if (!own.length && !others.length) throw new Error('manim-web: no fonts loaded - call `await load_fonts()` (or register_font) before creating Text');
  const best = own[0] ?? others[0];
  const r: ResolvedFont = { faces: [...own, ...others], synth_italic: style !== 'normal' && best.style === 'normal', key };
  resolve_cache.set(ck, r);
  return r;
}

/** First face (in resolution order) that has a glyph for code point `cp`, with the glyph index. */
export function face_for_char(r: ResolvedFont, cp: number): [FontFace, number] {
  const ch = String.fromCodePoint(cp);
  for (const f of r.faces) {
    const g = f.font.charToGlyphIndex(ch);
    if (g) return [f, g];
  }
  for (const f of fallback_faces) {
    const g = f.font.charToGlyphIndex(ch);
    if (g) return [f, g];
  }
  if (load_script_fallback(cp)) return face_for_char(r, cp);
  if (!warned.has('cp' + cp) && cp > 32) {
    warned.add('cp' + cp);
    console.warn(`manim-web: no loaded font has a glyph for "${ch}" (U+${cp.toString(16).toUpperCase().padStart(4, '0')})`);
  }
  return [r.faces[0], 0];
}

// ------------------------------------------------------------------ script fallback (node + system fonts)

/** Fonts CoreText falls back to on macOS for scripts Times/Helvetica lack (paths under /System/Library/Fonts; '@' = font asset). */
const SCRIPT_FALLBACKS: { re: RegExp; fonts: { file: string; face: RegExp }[] }[] = [
  { re: /[\u0b80-\u0bff]/u, fonts: [{ file: 'Supplemental/Tamil Sangam MN.ttc', face: /^Tamil Sangam MN$/ }] },
  { re: /[\u0900-\u097f\ua8e0-\ua8ff]/u, fonts: [{ file: 'Kohinoor.ttc', face: /^Kohinoor Devanagari(\s+Regular)?$/ }] },
  { re: /[\u0600-\u06ff\u0750-\u077f\ufb50-\ufdff\ufe70-\ufeff]/u, fonts: [{ file: 'GeezaPro.ttc', face: /^Geeza Pro(\s+Regular)?$/ }] },
  { re: /[\u0590-\u05ff\ufb1d-\ufb4f]/u, fonts: [{ file: 'ArialHB.ttc', face: /^Arial Hebrew$/ }] },
  {
    re: /[\u2e80-\u2fff\u3000-\u30ff\u3100-\u31ff\u3200-\u9fff\uac00-\ud7af\uf900-\ufaff\ufe30-\ufe4f\uff00-\uffef\u{20000}-\u{2fa1f}]/u,
    fonts: [{ file: '@PingFang.ttc', face: /^PingFang SC(\s+Regular)?$/ }, { file: 'Hiragino Sans GB.ttc', face: /W3|Regular|^Hiragino Sans GB$/ }, { file: 'STHeiti Light.ttc', face: /./ }],
  },
];
const fallback_faces: FontFace[] = [];
const fallback_tried = new Set<string>();

/** Full names (name ID 4) of the faces in a font file, read without parsing the fonts. */
function sfnt_names(bytes: Uint8Array): string[] {
  const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const ttc = String.fromCharCode(bytes[0], bytes[1], bytes[2], bytes[3]) === 'ttcf';
  const offs = ttc ? Array.from({ length: dv.getUint32(8) }, (_, k) => dv.getUint32(12 + 4 * k)) : [0];
  return offs.map((off) => {
    const nt = dv.getUint16(off + 4);
    for (let i = 0; i < nt; i++) {
      const r = off + 12 + 16 * i;
      if (String.fromCharCode(bytes[r], bytes[r + 1], bytes[r + 2], bytes[r + 3]) !== 'name') continue;
      const t = dv.getUint32(r + 8), count = dv.getUint16(t + 2), str = t + dv.getUint16(t + 4);
      let best = '', rank = -1;
      for (let k = 0; k < count; k++) {
        const rec = t + 6 + 12 * k;
        const [pid, , lang, nid, len, o] = [0, 2, 4, 6, 8, 10].map((d) => dv.getUint16(rec + d));
        if (nid !== 4) continue;
        // prefer English: Windows en-US, then Mac English, then anything
        const r = pid === 3 && lang === 0x409 ? 3 : pid === 1 && lang === 0 ? 2 : 1;
        if (r <= rank) continue;
        let s = '';
        if (pid === 3 || pid === 0) for (let j = 0; j < len; j += 2) s += String.fromCharCode(dv.getUint16(str + o + j));
        else for (let j = 0; j < len; j++) s += String.fromCharCode(bytes[str + o + j]);
        best = s;
        rank = r;
      }
      return best;
    }
    return '';
  });
}
function find_font_asset(name: string): string | null {
  const root = '/System/Library/AssetsV2';
  try {
    for (const d of node_fs.readdirSync(root)) {
      if (!d.startsWith('com_apple_MobileAsset_Font')) continue;
      for (const a of node_fs.readdirSync(`${root}/${d}`)) {
        const p = `${root}/${d}/${a}/AssetData/${name}`;
        if (node_fs.existsSync(p)) return p;
      }
    }
  } catch {
    /* no asset folder */
  }
  return null;
}
/** Node + system_fonts: load the macOS fallback font for the script of `cp`. Returns true if a font was added. */
function load_script_fallback(cp: number): boolean {
  if (!system_fonts || !node_fs) return false;
  const ch = String.fromCodePoint(cp);
  const entry = SCRIPT_FALLBACKS.find((e) => e.re.test(ch));
  if (!entry) return false;
  for (const { file, face } of entry.fonts) {
    if (fallback_tried.has(file)) continue;
    fallback_tried.add(file);
    const path = file.startsWith('@') ? find_font_asset(file.slice(1)) : `/System/Library/Fonts/${file}`;
    if (!path || !node_fs.existsSync(path)) continue;
    try {
      const bytes = new Uint8Array(node_fs.readFileSync(path));
      const index = sfnt_names(bytes).findIndex((n) => face.test(n));
      if (index < 0) continue;
      const before = new Set(families.values());
      register_font_bytes(bytes, { index }, path);
      for (const [k, list] of families) if (!before.has(list) || k) for (const f of list) if (f.source === path && !fallback_faces.includes(f)) fallback_faces.push(f);
      if (fallback_faces.some((f) => f.font.charToGlyphIndex(ch))) return true;
    } catch {
      /* unreadable font */
    }
  }
  return false;
}

// ------------------------------------------------------------------ glyph data

const OP_M = 0, OP_L = 1, OP_C = 2, OP_Z = 3;
export { OP_M, OP_L, OP_C, OP_Z };

/**
 * Glyph outline as path commands in font units (y up): M x y | L x y |
 * C x1 y1 x2 y2 x y | Z. TrueType contours are decomposed the way CoreText /
 * FreeType do (start at the first on-curve point) with quadratics raised to
 * cubics, matching the paths cairo writes into manimpango's SVG files.
 */
export function glyph_outline(face: FontFace, gid: number): Float64Array {
  let out = face._outlines.get(gid);
  if (out) return out;
  const g: Glyph = face.font.glyphs.get(gid);
  const cmds: number[] = [];
  const path = g.path; // triggers lazy parsing (also fills g.points for TrueType)
  if (g.points && face.font.outlinesFormat === 'truetype') {
    let contour: { x: number; y: number; onCurve: boolean }[] = [];
    for (const p of g.points) {
      contour.push(p);
      if (p.lastPointOfContour) {
        tt_contour(contour, cmds);
        contour = [];
      }
    }
    if (contour.length) tt_contour(contour, cmds);
  } else {
    let cx = 0, cy = 0;
    for (const c of path.commands) {
      if (c.type === 'M') cmds.push(OP_M, (cx = c.x!), (cy = c.y!));
      else if (c.type === 'L') cmds.push(OP_L, (cx = c.x!), (cy = c.y!));
      else if (c.type === 'C') cmds.push(OP_C, c.x1!, c.y1!, c.x2!, c.y2!, (cx = c.x!), (cy = c.y!));
      else if (c.type === 'Q') {
        cmds.push(OP_C, cx + (2 / 3) * (c.x1! - cx), cy + (2 / 3) * (c.y1! - cy), c.x! + (2 / 3) * (c.x1! - c.x!), c.y! + (2 / 3) * (c.y1! - c.y!), c.x!, c.y!);
        cx = c.x!;
        cy = c.y!;
      } else cmds.push(OP_Z);
    }
  }
  out = Float64Array.from(cmds);
  face._outlines.set(gid, out);
  return out;
}

function tt_contour(pts: { x: number; y: number; onCurve: boolean }[], cmds: number[]): void {
  const n = pts.length;
  if (n < 2) return;
  const first = pts[0], last = pts[n - 1];
  let sx: number, sy: number, i0: number, i1: number;
  if (first.onCurve) [sx, sy, i0, i1] = [first.x, first.y, 1, n];
  else if (last.onCurve) [sx, sy, i0, i1] = [last.x, last.y, 0, n - 1];
  else [sx, sy, i0, i1] = [(first.x + last.x) / 2, (first.y + last.y) / 2, 0, n];
  cmds.push(OP_M, sx, sy);
  let cx = sx, cy = sy; // current point
  let has_ctrl = false, qx = 0, qy = 0;
  const quad = (x1: number, y1: number, x: number, y: number) => {
    cmds.push(OP_C, cx + (2 / 3) * (x1 - cx), cy + (2 / 3) * (y1 - cy), x + (2 / 3) * (x1 - x), y + (2 / 3) * (y1 - y), x, y);
    cx = x;
    cy = y;
  };
  for (let i = i0; i < i1; i++) {
    const p = pts[i];
    if (p.onCurve) {
      if (has_ctrl) quad(qx, qy, p.x, p.y);
      else {
        cmds.push(OP_L, p.x, p.y);
        cx = p.x;
        cy = p.y;
      }
      has_ctrl = false;
    } else {
      if (has_ctrl) quad(qx, qy, (qx + p.x) / 2, (qy + p.y) / 2);
      qx = p.x;
      qy = p.y;
      has_ctrl = true;
    }
  }
  if (has_ctrl) quad(qx, qy, sx, sy);
  cmds.push(OP_Z);
}

/** Ink bounds of a glyph in font units [xMin, yMin, xMax, yMax] (null for empty glyphs). */
export function glyph_bounds(face: FontFace, gid: number): [number, number, number, number] | null {
  const o = glyph_outline(face, gid);
  if (!o.length) return null;
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (let i = 0; i < o.length;) {
    const op = o[i++];
    const k = op === OP_C ? 6 : op === OP_Z ? 0 : 2;
    for (let j = 0; j < k; j += 2) {
      const x = o[i + j], y = o[i + j + 1];
      if (x < x0) x0 = x;
      if (x > x1) x1 = x;
      if (y < y0) y0 = y;
      if (y > y1) y1 = y;
    }
    i += k;
  }
  return x0 === Infinity ? null : [x0, y0, x1, y1];
}

/** Horizontal advance in font units. */
export function glyph_advance(face: FontFace, gid: number): number {
  return face.font.glyphs.get(gid).advanceWidth ?? 0;
}

/** Pair kerning in font units (GPOS pair adjustment or legacy kern table). */
export function kerning(face: FontFace, l: number, r: number): number {
  if (face.kern_mode === 'none') return 0;
  const k = l * 65536 + r;
  let v = face._kern.get(k);
  if (v === undefined) {
    v = face.font.getKerningValue(l, r) || 0;
    face._kern.set(k, v);
  }
  return v;
}

type LigMap = Map<number, { rest: number[]; by: number }[]>;
const INDIC_SCRIPTS = ['dev2', 'deva', 'bng2', 'beng', 'gjr2', 'gujr', 'gur2', 'guru', 'knd2', 'knda', 'mlm2', 'mlym', 'ory2', 'orya', 'tml2', 'taml', 'tel2', 'telu'];
const INDIC_FEATURES = ['nukt', 'akhn', 'rphf', 'blwf', 'half', 'pstf', 'vatu', 'cjct', 'pres', 'abvs', 'blws', 'psts', 'haln'];

function collect_ligatures(face: FontFace, feats: string[], scripts: string[]): LigMap {
  const m: LigMap = new Map();
  for (const feat of feats) {
    for (const script of scripts) {
      let ligs: { sub: number[]; by: number }[] = [];
      try {
        ligs = face.font.substitution.getLigatures(feat, script, 'dflt');
      } catch {
        ligs = [];
      }
      for (const l of ligs) {
        const list = m.get(l.sub[0]) ?? [];
        if (!list.some((x) => x.by === l.by && x.rest.length === l.sub.length - 1)) list.push({ rest: l.sub.slice(1), by: l.by });
        m.set(l.sub[0], list);
      }
    }
  }
  for (const list of m.values()) list.sort((a, b) => b.rest.length - a.rest.length);
  return m;
}

/**
 * Ligatures of a face: first glyph -> candidates (longest first). `standard`
 * (liga/clig, switched off by disable_ligatures) and `required` (rlig and the
 * Indic conjunct/half/halant forms, always applied). web: GSUB ligature lookups
 * only - no contextual substitution or Indic reordering.
 */
export function ligatures(face: FontFace): { standard: LigMap; required: LigMap } {
  if (face._liga) return face._liga as any;
  let standard: LigMap = new Map(), required: LigMap = new Map();
  if (face.aat_ligatures && !face.fixed_pitch) {
    // web: AAT 'morx' is not parsed; Apple's text fonts ligate exactly fi and fl by default
    const f = face.font.charToGlyphIndex('f');
    for (const [c, lig] of [['i', '\ufb01'], ['l', '\ufb02']]) {
      const by = face.font.charToGlyphIndex(lig), g = face.font.charToGlyphIndex(c);
      if (f && by && g) standard.set(f, [...(standard.get(f) ?? []), { rest: [g], by }]);
    }
  } else if (face.font.tables.gsub) {
    standard = collect_ligatures(face, ['liga', 'clig'], ['latn', 'DFLT']);
    required = collect_ligatures(face, ['rlig', ...INDIC_FEATURES], ['latn', 'DFLT', ...INDIC_SCRIPTS]);
  }
  face._liga = { standard, required } as any;
  return face._liga as any;
}

/** OS/2 / post metrics (font units) used for decorations and sub/superscripts. */
export function face_metrics(face: FontFace): { underline_position: number; underline_thickness: number; strikeout_position: number; strikeout_size: number; sub_y_size: number; sub_y_offset: number; sup_y_size: number; sup_y_offset: number } {
  const os2 = face.font.tables.os2 ?? {};
  const post = face.font.tables.post ?? {};
  const u = face.upem;
  return {
    underline_position: post.underlinePosition ?? -0.1 * u,
    underline_thickness: post.underlineThickness || 0.05 * u,
    strikeout_position: os2.yStrikeoutPosition ?? 0.25 * u,
    strikeout_size: os2.yStrikeoutSize || post.underlineThickness || 0.05 * u,
    sub_y_size: os2.ySubscriptYSize || u / 1.2,
    sub_y_offset: os2.ySubscriptYOffset ?? 0.1 * u,
    sup_y_size: os2.ySuperscriptYSize || u / 1.2,
    sup_y_offset: os2.ySuperscriptYOffset ?? 0.35 * u,
  };
}
