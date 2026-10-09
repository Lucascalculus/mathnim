// web: TeX -> SVG with MathJax (manim compiles with latex and converts the
// DVI with dvisvgm; neither exists in a browser).
//
// `tex_to_svg(expression, environment, template_body)` returns an SVG string
// that follows dvisvgm's conventions, so manim's SVG pipeline can treat it
// exactly like real LaTeX output:
//   * coordinates in pt with LaTeX's 10pt base size (1em = 10pt; MathJax
//     works in 1/1000 em) and y pointing down;
//   * glyphs are plain filled <path>s, rules are <rect>s, unfilled by default
//     (black), `\color` gives an explicit fill;
//   * `\special{dvisvgm:raw <g id='...'>}` / `\special{dvisvgm:raw </g>}`
//     (which MathTex inserts around its parts) open and close <g> groups in
//     output order, like dvisvgm does.
// MathJax's TeX fonts are derived from Computer Modern, so glyphs and
// spacing match LaTeX closely; text mode (`Tex`, `\text`) has no kerning or
// ligatures. The same code runs in node (goldens: tools/tex_server.mjs,
// tests, tools/regress_worker.ts) and in the browser (lazy-loaded by
// `init_tex()`, which ScenePlayer.load awaits).
import {
  matrix_apply, matrix_multiply, parse_path, parse_svg_color, parse_transform, segments_to_d, transform_segments,
  IDENTITY_MATRIX, type SVGMatrix, type SVGSegment,
} from '../svgelements';

type Any = any;
interface MathJaxState {
  adaptor: Any;
  doc: Any;
  tex: Any;
}
let mj: MathJaxState | null = null;
let loading: Promise<void> | null = null;
const cache = new Map<string, string>();

const MATH_ENVIRONMENTS = new Set([
  'align', 'align*', 'equation', 'equation*', 'gather', 'gather*', 'multline', 'multline*', 'flalign', 'flalign*',
  'alignat', 'alignat*', 'eqnarray', 'eqnarray*', 'displaymath', 'math',
]);
const EXCLUDED_PACKAGES = ['bussproofs', 'require', 'autoload', 'noundefined', 'noerrors', 'physics', 'colorv2'];

interface Modules {
  mathjax: Any; TeX: Any; SVG: Any; liteAdaptor: Any; RegisterHTMLHandler: Any; AllPackages: Any;
  Configuration: Any; CommandMap: Any; MacroMap: Any;
}
const pick = (m: Any, name: string): Any => m?.[name] ?? m?.default?.[name];

function setup(M: Modules): void {
  // \special{...} -> an empty <mrow data-special="..."> (spacing-transparent,
  // kept in output order), in math and in text mode
  new M.CommandMap('manim-special', { special: 'Special' }, {
    Special(parser: Any, name: string) {
      const arg = parser.GetArgument(name);
      const node = parser.create('node', 'mrow', []);
      node.attributes.set('data-special', arg);
      parser.Push(node);
    },
  });
  M.Configuration.create('manim-special', { handler: { macro: ['manim-special'] } });
  // text mode: LaTeX's interword space (cmr10: 3.33pt, 4.44pt after . ? ! :)
  // instead of MathJax's 0.25em space character
  new M.MacroMap('manim-text-space', { ' ': 'Space', '\t': 'Space', '\n': 'Space', '\r': 'Space', '~': 'Tilde' }, {
    Space(parser: Any, _c: string) {
      const prev = parser.string.charAt(parser.i - 2), prev2 = parser.string.charAt(parser.i - 3);
      while (/\s/.test(parser.string.charAt(parser.i))) parser.i++;
      const extra = '.?!:'.includes(prev) && prev !== '' && !/[A-Z]/.test(prev2);
      parser.Push(parser.create('token', 'mspace', { width: extra ? '0.4444em' : '0.3333em' }));
    },
    Tilde(parser: Any, _c: string) {
      parser.Push(parser.create('token', 'mspace', { width: '0.3333em' }));
    },
  });
  M.Configuration.create('manim-text-space', { handler: { character: ['manim-text-space'] }, priority: 3 });

  const adaptor = M.liteAdaptor();
  M.RegisterHTMLHandler(adaptor);
  const packages = [...(M.AllPackages as string[]).filter((p) => !EXCLUDED_PACKAGES.includes(p)), 'manim-special'];
  const tex = new M.TeX({
    packages,
    textmacros: { packages: ['text-base', 'manim-special', 'manim-text-space'] },
    formatError: (_jax: Any, err: Any) => {
      throw err;
    },
  });
  // LaTeX's row distances: align/gather/eqnarray 12pt + \jot (MathJax: 13pt),
  // array/matrices 12pt (MathJax: 14pt), cases \arraystretch 1.2 (MathJax: 12pt)
  const ROWSPACING: Record<string, string> = { '3pt': '5pt', '4pt': '2pt', '.2em': '.44em' };
  tex.postFilters.add(({ data }: Any) => {
    data.root?.walkTree((node: Any) => {
      if (!node.isKind('mtable')) return;
      const rs = node.attributes.get('rowspacing');
      if (typeof rs === 'string') node.attributes.set('rowspacing', rs.split(/\s+/).map((v: string) => ROWSPACING[v] ?? v).join(' '));
    });
  });
  const svg = new M.SVG({ fontCache: 'none' });
  const doc = M.mathjax.document('', { InputJax: tex, OutputJax: svg });
  mj = { adaptor, doc, tex };
}

function node_require(): ((id: string) => Any) | null {
  const p: Any = (globalThis as Any).process ?? null;
  const mod = p?.getBuiltinModule?.('module');
  if (!mod?.createRequire) return null;
  try {
    return mod.createRequire(import.meta.url);
  } catch {
    return null;
  }
}
function load_sync(): boolean {
  const req = node_require();
  if (!req) return false;
  const r = (p: string) => req('mathjax-full/js/' + p);
  const sm = r('input/tex/SymbolMap.js');
  setup({
    mathjax: r('mathjax.js').mathjax, TeX: r('input/tex.js').TeX, SVG: r('output/svg.js').SVG,
    liteAdaptor: r('adaptors/liteAdaptor.js').liteAdaptor, RegisterHTMLHandler: r('handlers/html.js').RegisterHTMLHandler,
    AllPackages: r('input/tex/AllPackages.js').AllPackages, Configuration: r('input/tex/Configuration.js').Configuration,
    CommandMap: sm.CommandMap, MacroMap: sm.MacroMap,
  });
  return true;
}
async function load_async(): Promise<void> {
  // web: mathjax-full's components/version.js reads package.json with a Node
  // require unless the global PACKAGE_VERSION is defined (as MathJax's own
  // webpack builds do); bundlers do not define it, so do it here.
  const g_ = globalThis as any;
  if (g_.PACKAGE_VERSION === undefined) g_.PACKAGE_VERSION = '3.2.1';
  const [a, b, c, d, e, f, g, h] = await Promise.all([
    import('mathjax-full/js/mathjax.js'), import('mathjax-full/js/input/tex.js'), import('mathjax-full/js/output/svg.js'),
    import('mathjax-full/js/adaptors/liteAdaptor.js'), import('mathjax-full/js/handlers/html.js'),
    import('mathjax-full/js/input/tex/AllPackages.js'), import('mathjax-full/js/input/tex/Configuration.js'),
    import('mathjax-full/js/input/tex/SymbolMap.js'),
  ]);
  if (mj) return;
  setup({
    mathjax: pick(a, 'mathjax'), TeX: pick(b, 'TeX'), SVG: pick(c, 'SVG'), liteAdaptor: pick(d, 'liteAdaptor'),
    RegisterHTMLHandler: pick(e, 'RegisterHTMLHandler'), AllPackages: pick(f, 'AllPackages'),
    Configuration: pick(g, 'Configuration'), CommandMap: pick(h, 'CommandMap'), MacroMap: pick(h, 'MacroMap'),
  });
}

/** Load MathJax (lazily, once). Await it before creating Tex/MathTex in a browser. */
export function init_tex(): Promise<void> {
  if (mj) return Promise.resolve();
  if (!loading) {
    loading = (async () => {
      if (!load_sync()) await load_async();
    })();
  }
  return loading;
}
/** Whether TeX can be rendered synchronously now. */
export function tex_ready(): boolean {
  if (!mj && !loading) load_sync();
  return mj !== null;
}

// ------------------------------------------------------------------ typesetting
type Item =
  | { kind: 'path'; segs: SVGSegment[]; fill: string | null }
  | { kind: 'rect'; x0: number; y0: number; x1: number; y1: number; fill: string | null }
  | { kind: 'special'; text: string };
interface Typeset { items: Item[]; width: number; height: number; depth: number }
type Clip = [number, number, number, number] | null;

const num = (s: string | null | undefined, d = 0) => (s === null || s === undefined || s === '' ? d : parseFloat(s));

function color_of(v: string | null | undefined, inherited: string | null): string | null {
  if (!v || v === 'currentColor') return inherited;
  const c = parse_svg_color(v);
  return c.hex;
}

function typeset(src: string, display: boolean): Typeset {
  const { adaptor, doc, tex } = mj!;
  tex.parseOptions?.tags?.reset?.();
  const container = doc.convert(src, { display, em: 16, ex: 8, containerWidth: 80 * 16 });
  const svg = adaptor.firstChild(container);
  const vb = (adaptor.getAttribute(svg, 'viewBox') ?? '0 0 0 0').split(/\s+/).map(Number);
  const items: Item[] = [];
  const walk = (el: Any, ctm: SVGMatrix, fill: string | null, clip: Clip) => {
    const tag = adaptor.kind(el);
    if (tag === '#text' || tag === '#comment') return;
    const attr = (n: string) => adaptor.getAttribute(el, n);
    let m = matrix_multiply(ctm, parse_transform(attr('transform')));
    const f = color_of(attr('fill'), fill);
    if (tag === 'svg' && el !== svg) {
      // stretchy delimiter pieces: a viewport that crops a (scaled) glyph
      const x = num(attr('x')), y = num(attr('y')), w = num(attr('width')), h = num(attr('height'));
      const b = (attr('viewBox') ?? '').split(/[\s,]+/).map(Number);
      const [p0x, p0y] = matrix_apply(m, x, y), [p1x, p1y] = matrix_apply(m, x + w, y + h);
      const box: [number, number, number, number] = [Math.min(p0x, p1x), Math.min(p0y, p1y), Math.max(p0x, p1x), Math.max(p0y, p1y)];
      clip = clip ? [Math.max(clip[0], box[0]), Math.max(clip[1], box[1]), Math.min(clip[2], box[2]), Math.min(clip[3], box[3])] : box;
      if (b.length === 4 && b[2] > 0 && b[3] > 0) m = matrix_multiply(m, [w / b[2], 0, 0, h / b[3], x - (b[0] * w) / b[2], y - (b[1] * h) / b[3]]);
      else m = matrix_multiply(m, [1, 0, 0, 1, x, y]);
    }
    const special = attr('data-special');
    if (special !== null && special !== undefined) items.push({ kind: 'special', text: special });
    if (tag === 'path') {
      const d = attr('d');
      if (d && d.trim()) {
        let segs = transform_segments(parse_path(d), m);
        if (clip) {
          const c = clip;
          const cl = (p: [number, number]): [number, number] => [Math.min(c[2], Math.max(c[0], p[0])), Math.min(c[3], Math.max(c[1], p[1]))];
          segs = segs.map((s: Any) => {
            const o: Any = { ...s };
            for (const k of ['start', 'end', 'control', 'control1', 'control2']) if (o[k]) o[k] = cl(o[k]);
            return o;
          });
        }
        items.push({ kind: 'path', segs, fill: f });
      }
    } else if (tag === 'rect') {
      if (attr('data-hitbox') !== null && attr('data-hitbox') !== undefined) return;
      if (attr('fill') === 'none' || attr('fill') === 'transparent') return;
      const x = num(attr('x')), y = num(attr('y')), w = num(attr('width')), h = num(attr('height'));
      rect(m, x, y, x + w, y + h, f, clip);
    } else if (tag === 'line') {
      // table rules: a stroked line becomes a filled rectangle, as TeX's rules are
      const sw = num(attr('stroke-width'), 0);
      if (sw > 0) {
        const x1 = num(attr('x1')), y1 = num(attr('y1')), x2 = num(attr('x2')), y2 = num(attr('y2'));
        const hw = sw / 2;
        if (y1 === y2) rect(m, Math.min(x1, x2), y1 - hw, Math.max(x1, x2), y1 + hw, color_of(attr('stroke'), f), clip);
        else if (x1 === x2) rect(m, x1 - hw, Math.min(y1, y2), x1 + hw, Math.max(y1, y2), color_of(attr('stroke'), f), clip);
      }
    }
    for (const c of adaptor.childNodes(el)) walk(c, m, f, clip);
  };
  const rect = (m: SVGMatrix, x0: number, y0: number, x1: number, y1: number, fill: string | null, clip: Clip) => {
    const [ax, ay] = matrix_apply(m, x0, y0), [bx, by] = matrix_apply(m, x1, y1);
    let r = [Math.min(ax, bx), Math.min(ay, by), Math.max(ax, bx), Math.max(ay, by)];
    if (clip) r = [Math.max(r[0], clip[0]), Math.max(r[1], clip[1]), Math.min(r[2], clip[2]), Math.min(r[3], clip[3])];
    if (r[2] > r[0] && r[3] > r[1]) items.push({ kind: 'rect', x0: r[0], y0: r[1], x1: r[2], y1: r[3], fill });
  };
  for (const c of adaptor.childNodes(svg)) walk(c, IDENTITY_MATRIX, null, null);
  return { items, width: vb[2] ?? 0, height: -(vb[1] ?? 0), depth: (vb[3] ?? 0) + (vb[1] ?? 0) };
}

// ------------------------------------------------------------------ LaTeX source handling
/** manim's _texcode_for_environment: `{name}{args}` -> begin/end code. */
function environment_code(environment: string): { name: string; begin: string; end: string } {
  let env = environment;
  if (env.startsWith('\\begin')) env = env.slice(6);
  if (env.startsWith('{')) env = env.slice(1);
  let begin = '\\begin{' + env;
  if (!begin.endsWith('}') && !begin.endsWith(']')) begin += '}';
  const name = env.split('}')[0];
  return { name, begin, end: '\\end{' + name + '}' };
}

/** Read one balanced {...} group (or single token) starting at i; returns [text, next index]. */
function read_group(s: string, i: number): [string, number] {
  while (i < s.length && /\s/.test(s[i])) i++;
  if (s[i] === '{') {
    let depth = 0;
    for (let j = i; j < s.length; j++) {
      if (s[j] === '\\') j++;
      else if (s[j] === '{') depth++;
      else if (s[j] === '}' && --depth === 0) return [s.slice(i, j + 1), j + 1];
    }
    return [s.slice(i), s.length];
  }
  if (s[i] === '\\') {
    const m = /^\\([a-zA-Z@]+|.)/.exec(s.slice(i));
    return m ? [m[0], i + m[0].length] : ['', i + 1];
  }
  return [s[i] ?? '', i + 1];
}
function read_optional(s: string, i: number): [string, number] {
  let j = i;
  while (j < s.length && /\s/.test(s[j])) j++;
  if (s[j] !== '[') return ['', i];
  const e = s.indexOf(']', j);
  return e < 0 ? ['', i] : [s.slice(j, e + 1), e + 1];
}

/** Macro definitions of a template preamble that MathJax understands (\newcommand, \def, \DeclareMathOperator...). */
function preamble_definitions(body: string): string {
  if (!body) return '';
  const pre = body.replace(/(^|[^\\])%.*$/gm, '$1');
  const out: string[] = [];
  const re = /\\(newcommand|renewcommand|providecommand|DeclareMathOperator|def|let)\b(\*?)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(pre))) {
    let i = re.lastIndex;
    const cmd = m[1];
    try {
      if (cmd === 'def') {
        const [name, j] = read_group(pre, i);
        const k = pre.indexOf('{', j);
        const params = pre.slice(j, k);
        const [bodyG, e] = read_group(pre, k);
        out.push(`\\def${name}${params}${bodyG}`);
        i = e;
      } else if (cmd === 'let') {
        const [a, j] = read_group(pre, i);
        let k = j;
        while (/[\s=]/.test(pre[k] ?? '')) k++;
        const [b, e] = read_group(pre, k);
        out.push(`\\let${a}${b}`);
        i = e;
      } else if (cmd === 'DeclareMathOperator') {
        const [name, j] = read_group(pre, i);
        const [text, e] = read_group(pre, j);
        out.push(`\\DeclareMathOperator${m[2]}${name}${text}`);
        i = e;
      } else {
        const [name, j] = read_group(pre, i);
        const [n, k] = read_optional(pre, j);
        const [dflt, l] = read_optional(pre, k);
        const [bodyG, e] = read_group(pre, l);
        out.push(`\\${cmd === 'providecommand' ? 'newcommand' : cmd}${name}${n}${dflt}${bodyG}`);
        i = e;
      }
    } catch {
      /* ignore malformed definitions */
    }
    re.lastIndex = i;
  }
  return out.join('');
}

/** Split text-mode source into lines at top-level `\\` / `\newline` / blank lines. */
function split_lines(s: string): string[] {
  const lines: string[] = [];
  let depth = 0, math = false, cur = '';
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (c === '\\') {
      const nx = s[i + 1];
      if (nx === '\\' && depth === 0 && !math) {
        lines.push(cur);
        cur = '';
        i++;
        // optional * and [len]
        let j = i + 1;
        while (s[j] === ' ') j++;
        if (s[j] === '*') j++;
        while (s[j] === ' ') j++;
        if (s[j] === '[') {
          const e = s.indexOf(']', j);
          if (e > 0) i = e;
          else i = j - 1;
        } else i = j - 1;
        continue;
      }
      const w = /^\\(newline|par)(?![a-zA-Z])/.exec(s.slice(i));
      if (w && depth === 0 && !math) {
        lines.push(cur);
        cur = '';
        i += w[0].length - 1;
        continue;
      }
      if (nx === '(' || nx === '[') math = true;
      else if (nx === ')' || nx === ']') math = false;
      cur += c + (nx ?? '');
      i++;
      continue;
    }
    if (c === '%') {
      const e = s.indexOf('\n', i);
      i = e < 0 ? s.length : e;
      continue;
    }
    if (c === '$') math = !math;
    else if (c === '{') depth++;
    else if (c === '}') depth--;
    else if (c === '\n' && depth === 0 && !math && /^\s*\n/.test(s.slice(i + 1))) {
      lines.push(cur);
      cur = '';
      while (i + 1 < s.length && /\s/.test(s[i + 1])) i++;
      continue;
    }
    cur += c;
  }
  lines.push(cur);
  return lines;
}

/** TeX text ligatures that MathJax's text mode does not apply. */
function text_ligatures(s: string): string {
  let out = '', math = false;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (c === '\\') {
      out += c + (s[i + 1] ?? '');
      i++;
      continue;
    }
    if (c === '$') math = !math;
    if (!math && c === '-' && s[i + 1] === '-') {
      if (s[i + 2] === '-') {
        out += '—';
        i += 2;
      } else {
        out += '–';
        i += 1;
      }
      continue;
    }
    out += c;
  }
  return out;
}

function text_mode(expression: string, defs: string, align: 'left' | 'center' | 'right'): Item[] {
  const items: Item[] = [];
  let y = 0, prev_depth: number | null = null;
  for (let line of split_lines(expression)) {
    line = line.replace(/^\s+/, '').replace(/(^|[^\\])\s+$/, '$1');
    const r = typeset(defs + '\\text{' + text_ligatures(line) + '}', false);
    if (prev_depth !== null) {
      // TeX: \baselineskip 12pt, \lineskip 1pt, \lineskiplimit 0pt
      y += 1200 - prev_depth - r.height >= 0 ? 1200 : prev_depth + r.height + 100;
    }
    const x = align === 'center' ? -r.width / 2 : align === 'right' ? -r.width : 0;
    const shift: SVGMatrix = [1, 0, 0, 1, x, y];
    for (const it of r.items) {
      if (it.kind === 'path') items.push({ ...it, segs: transform_segments(it.segs, shift) });
      else if (it.kind === 'rect') items.push({ ...it, x0: it.x0 + x, x1: it.x1 + x, y0: it.y0 + y, y1: it.y1 + y });
      else items.push(it);
    }
    prev_depth = r.depth;
  }
  return items;
}

// ------------------------------------------------------------------ dvisvgm-like output
const PT: SVGMatrix = [0.01, 0, 0, 0.01, 0, 0]; // MathJax units (1/1000 em) -> pt (1em = 10pt)
const f4 = (x: number) => {
  const r = Math.round(x * 1e4) / 1e4;
  return Object.is(r, -0) ? '0' : String(r);
};

function emit(items: Item[]): string {
  const body: string[] = [];
  let depth = 0;
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  const grow = (x: number, y: number) => {
    x0 = Math.min(x0, x);
    y0 = Math.min(y0, y);
    x1 = Math.max(x1, x);
    y1 = Math.max(y1, y);
  };
  for (const it of items) {
    if (it.kind === 'special') {
      const raw = /^\s*dvisvgm:raw\s*([\s\S]*)$/.exec(it.text);
      if (!raw) continue;
      const open = /^<g\s+id=['"]([^'"]*)['"]\s*>\s*$/.exec(raw[1].trim());
      if (open) {
        body.push(`<g id='${open[1]}'>`);
        depth++;
      } else if (/^<\/g>\s*$/.test(raw[1].trim()) && depth > 0) {
        body.push('</g>');
        depth--;
      }
      continue;
    }
    const fill = it.fill ? ` fill='${it.fill}'` : '';
    if (it.kind === 'path') {
      const segs = transform_segments(it.segs, PT);
      for (const s of segs) grow(s.end[0], s.end[1]);
      body.push(`<path d='${segments_to_d(segs)}'${fill}/>`);
    } else {
      const [a, b, c, d] = [it.x0 / 100, it.y0 / 100, it.x1 / 100, it.y1 / 100];
      grow(a, b);
      grow(c, d);
      body.push(`<rect x='${f4(a)}' y='${f4(b)}' height='${f4(d - b)}' width='${f4(c - a)}'${fill}/>`);
    }
  }
  while (depth-- > 0) body.push('</g>');
  if (!(x1 > x0)) [x0, x1] = [0, 1];
  if (!(y1 > y0)) [y0, y1] = [0, 1];
  const w = f4(x1 - x0), h = f4(y1 - y0);
  return [
    "<?xml version='1.0' encoding='UTF-8'?>",
    '<!-- manim-web: MathJax TeX rendering in dvisvgm conventions -->',
    `<svg version='1.1' xmlns='http://www.w3.org/2000/svg' width='${w}pt' height='${h}pt' viewBox='${f4(x0)} ${f4(y0)} ${w} ${h}'>`,
    "<g id='page1'>",
    ...body,
    '</g>',
    '</svg>',
    '',
  ].join('\n');
}

/**
 * Render a TeX expression like manim's tex_to_svg_file (template + environment),
 * returning the SVG text instead of a file. `template_body` is the TeX
 * template's full body; only its macro definitions are used.
 */
export function tex_to_svg(expression: string, environment: string | null = null, template_body = ''): string {
  const key = (environment ?? '\u0000') + '\u0001' + template_body + '\u0001' + expression;
  const hit = cache.get(key);
  if (hit !== undefined) return hit;
  if (!tex_ready()) throw new Error('TeX is not loaded yet: await init_tex() before creating Tex/MathTex (ScenePlayer.load does this).');
  const defs = preamble_definitions(template_body.split('\\begin{document}')[0] ?? '');
  let items: Item[];
  const env = environment === null || environment === undefined ? null : environment_code(environment);
  if (env && MATH_ENVIRONMENTS.has(env.name)) {
    if (env.name === 'math') items = typeset(defs + expression, false).items;
    else if (env.name === 'displaymath') items = typeset(defs + expression, true).items;
    else items = typeset(defs + env.begin + '\n' + expression + '\n' + env.end, true).items;
  } else {
    const align = env?.name === 'center' ? 'center' : env?.name === 'flushright' ? 'right' : 'left';
    items = text_mode(expression, defs, align);
  }
  const svg = emit(items);
  cache.set(key, svg);
  return svg;
}
