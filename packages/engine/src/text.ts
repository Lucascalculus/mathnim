// Text, set by the browser's own text engine in the system's fonts (no font download: Chinese comes from PingFang,
// YaHei or Noto CJK, whichever the device has). Widths are measured on the device, so a figure's layout is always
// computed where it is shown. Line breaking follows Chinese rules: a closing mark never starts a line, an opening mark
// never ends one, and Latin words, numbers with their units and TeX stay whole.
import { look, type Look } from '@mathnim/look';
import type { Ctx2D } from './geom';

export type Lang = 'en' | 'zh';
/** Text in both languages. */
export interface L10n { en: string; zh: string }
/** Two-language text: t('English', '中文'), in the same order as the lessons' own t() (both are written natively). */
export const t = (en: string, zh: string): L10n => ({ en, zh });
export const tr = (s: string | L10n, lang: Lang): string => (typeof s === 'string' ? s : s[lang] ?? s.en);

export type TextKind = 'label' | 'caption' | 'readout' | 'display';
export interface FontSpec { size: number; weight: number; family: 'sans' | 'serif' | 'mono'; italic?: boolean }
export const font_css = (f: FontSpec, l: Look = look()): string => `${f.italic ? 'italic ' : ''}${f.weight} ${f.size}px ${l.fonts[f.family]}`;
export function font_of(kind: TextKind, o: { weight?: number; scale?: number; size?: number; family?: FontSpec['family']; italic?: boolean } = {}, l: Look = look()): FontSpec {
  const t0 = l.type[kind];
  return { size: o.size ?? t0.size * (o.scale ?? 1), weight: o.weight ?? t0.weight, family: o.family ?? 'sans', italic: o.italic };
}

// ------------------------------------------------------------------ measuring
let measure_ctx: Ctx2D | null = null;
/** The context widths are measured with (the player sets its own; tools in node pass a @napi-rs/canvas context). */
export function set_measure_context(ctx: Ctx2D): void {
  measure_ctx = ctx;
}
function mctx(): Ctx2D {
  if (measure_ctx) return measure_ctx;
  if (typeof OffscreenCanvas !== 'undefined') measure_ctx = new OffscreenCanvas(8, 8).getContext('2d') as unknown as Ctx2D;
  else if (typeof document !== 'undefined') measure_ctx = document.createElement('canvas').getContext('2d') as unknown as Ctx2D;
  if (!measure_ctx) throw new Error('engine: no canvas to measure text with (call set_measure_context)');
  return measure_ctx;
}
const width_cache = new Map<string, number>();
export function text_width(s: string, f: FontSpec): number {
  const css = font_css(f), key = css + '\u0001' + s;
  let w = width_cache.get(key);
  if (w === undefined) {
    const g = mctx();
    g.font = css;
    w = g.measureText(s).width;
    if (width_cache.size > 20000) width_cache.clear();
    width_cache.set(key, w);
  }
  return w;
}

// ------------------------------------------------------------------ line breaking
const CJK = /[⺀-⿿　-ヿ㄀-ㇿ㈀-鿿가-힯豈-﫿︰-﹏＀-￯]/u;
/** Marks that may not start a line. */
const NO_START = /^[，。、；：？！）」』”’》〉】〕…—·%‰,.;:?!)\]}]/u;
/** Marks that may not end a line. */
const NO_END = /[（「『“‘《〈【〔([{]$/u;

export interface Span { s: string; color?: string; weight?: number }
interface Token { s: string; w: number; space: boolean; color?: string; weight?: number }

/** Split text into unbreakable tokens: a CJK character with any marks glued to it, a Latin word, a space. */
function tokens(spans: Span[], f: FontSpec): Token[] {
  const out: Token[] = [];
  for (const sp of spans) {
    const ff = sp.weight ? { ...f, weight: sp.weight } : f;
    const re = /(\s+)|([^\s⺀-⿿　-ヿ㄀-ㇿ㈀-鿿가-힯豈-﫿︰-﹏＀-￯]+)|(.)/gsu;
    let m: RegExpExecArray | null;
    while ((m = re.exec(sp.s))) {
      const s = m[0];
      out.push({ s, w: text_width(s, ff), space: !!m[1], color: sp.color, weight: sp.weight });
    }
  }
  // glue: a closing mark sticks to the token before it, an opening mark to the token after it
  const glued: Token[] = [];
  for (const tk of out) {
    const prev = glued[glued.length - 1];
    if (prev && !tk.space && !prev.space && (NO_START.test(tk.s) || NO_END.test(prev.s)) && prev.color === tk.color && prev.weight === tk.weight) {
      prev.s += tk.s;
      prev.w += tk.w;
    } else glued.push({ ...tk });
  }
  return glued;
}

export interface TextLine { spans: { s: string; x: number; color?: string; weight?: number }[]; width: number }
/** Break spans into lines no wider than max_w (a token wider than a line gets a line of its own). */
export function break_lines(spans: Span[] | string, f: FontSpec, max_w = Infinity): TextLine[] {
  const sp = typeof spans === 'string' ? [{ s: spans }] : spans;
  const lines: TextLine[] = [];
  let cur: TextLine = { spans: [], width: 0 };
  const push_line = () => {
    // a line never ends in a space
    while (cur.spans.length && /^\s+$/.test(cur.spans[cur.spans.length - 1].s)) {
      const last = cur.spans.pop()!;
      cur.width = last.x;
    }
    lines.push(cur);
    cur = { spans: [], width: 0 };
  };
  for (const tk of tokens(sp, f)) {
    if (tk.s.includes('\n')) {
      push_line();
      continue;
    }
    if (tk.space && !cur.spans.length) continue; // no leading space
    if (cur.spans.length && cur.width + tk.w > max_w + 0.01 && !tk.space) push_line();
    cur.spans.push({ s: tk.s, x: cur.width, color: tk.color, weight: tk.weight });
    cur.width += tk.w;
  }
  if (cur.spans.length || !lines.length) push_line();
  return lines;
}
export const has_cjk = (s: string): boolean => CJK.test(s);

/**
 * Inline colour marks in captions: "the **wall** stops it" or "[墙](noun:wall)挡住了它". `**x**` is bold ink;
 * `[x](role)` takes the colour of a role.
 */
export function parse_marks(s: string, color_of: (role: string) => string, ink: string): Span[] {
  const out: Span[] = [];
  const re = /\*\*([^*]+)\*\*|\[([^\]]+)\]\(([a-z:-]+)\)/g;
  let last = 0, m: RegExpExecArray | null;
  while ((m = re.exec(s))) {
    if (m.index > last) out.push({ s: s.slice(last, m.index), color: ink });
    if (m[1]) out.push({ s: m[1], color: ink, weight: 600 });
    else out.push({ s: m[2], color: color_of(m[3]), weight: 600 });
    last = m.index + m[0].length;
  }
  if (last < s.length) out.push({ s: s.slice(last), color: ink });
  return out;
}

// ---------------------------------------------------------------- a little TeX as plain text
// For short text drawn as text, not typeset (a formula step's reason, a label): "divide by $h$" → "divide by h",
// "$x^2$ cancels" → "x² cancels", "let $h \to 0$" → "let h → 0". Only what reads well in one line of text is
// converted; anything else keeps its letters (a fraction becomes a/b).
const SUP: Record<string, string> = { 0: '⁰', 1: '¹', 2: '²', 3: '³', 4: '⁴', 5: '⁵', 6: '⁶', 7: '⁷', 8: '⁸', 9: '⁹', '+': '⁺', '-': '⁻', '−': '⁻', '=': '⁼', '(': '⁽', ')': '⁾', n: 'ⁿ', i: 'ⁱ', k: 'ᵏ', T: 'ᵀ', x: 'ˣ', '′': '′' };
const SUB: Record<string, string> = { 0: '₀', 1: '₁', 2: '₂', 3: '₃', 4: '₄', 5: '₅', 6: '₆', 7: '₇', 8: '₈', 9: '₉', '+': '₊', '-': '₋', '−': '₋', '=': '₌', '(': '₍', ')': '₎', a: 'ₐ', e: 'ₑ', o: 'ₒ', x: 'ₓ', h: 'ₕ', k: 'ₖ', l: 'ₗ', m: 'ₘ', n: 'ₙ', p: 'ₚ', s: 'ₛ', t: 'ₜ', i: 'ᵢ', j: 'ⱼ', r: 'ᵣ', u: 'ᵤ', v: 'ᵥ' };
const SYM: Record<string, string> = {
  to: '→', rightarrow: '→', Rightarrow: '⇒', implies: '⇒', leftarrow: '←', iff: '⇔', mapsto: '↦', cdot: '·', times: '×', div: '÷', pm: '±', mp: '∓',
  le: '≤', leq: '≤', ge: '≥', geq: '≥', ne: '≠', neq: '≠', approx: '≈', equiv: '≡', sim: '∼', propto: '∝', infty: '∞', partial: '∂', nabla: '∇',
  sum: 'Σ', prod: 'Π', int: '∫', in: '∈', notin: '∉', subset: '⊂', subseteq: '⊆', cup: '∪', cap: '∩', emptyset: '∅', forall: '∀', exists: '∃',
  ldots: '…', cdots: '⋯', dots: '…', prime: '′', circ: '∘', deg: '°', degree: '°', neg: '¬', land: '∧', lor: '∨',
  alpha: 'α', beta: 'β', gamma: 'γ', delta: 'δ', epsilon: 'ε', varepsilon: 'ε', zeta: 'ζ', eta: 'η', theta: 'θ', vartheta: 'ϑ', iota: 'ι', kappa: 'κ',
  lambda: 'λ', mu: 'μ', nu: 'ν', xi: 'ξ', pi: 'π', rho: 'ρ', sigma: 'σ', tau: 'τ', upsilon: 'υ', phi: 'φ', varphi: 'φ', chi: 'χ', psi: 'ψ', omega: 'ω',
  Gamma: 'Γ', Delta: 'Δ', Theta: 'Θ', Lambda: 'Λ', Xi: 'Ξ', Pi: 'Π', Sigma: 'Σ', Phi: 'Φ', Psi: 'Ψ', Omega: 'Ω',
  lim: 'lim', sin: 'sin', cos: 'cos', tan: 'tan', log: 'log', ln: 'ln', exp: 'exp', max: 'max', min: 'min', det: 'det',
};
/** One group's content: {…} or the next character (or command). */
function group(s: string, i: number): [string, number] {
  while (s[i] === ' ') i++;
  if (s[i] === '{') {
    let d = 1, j = i + 1;
    for (; j < s.length && d; j++) d += s[j] === '{' ? 1 : s[j] === '}' ? -1 : 0;
    return [s.slice(i + 1, j - 1), j];
  }
  if (s[i] === '\\') {
    const m = /^\\([a-zA-Z]+|.)/.exec(s.slice(i));
    if (m) return [m[0], i + m[0].length];
  }
  return [s[i] ?? '', i + 1];
}
function math_text(s: string): string {
  let out = '';
  for (let i = 0; i < s.length; ) {
    const c = s[i];
    if (c === '\\') {
      const m = /^\\([a-zA-Z]+|.)/.exec(s.slice(i))!;
      const name = m[1];
      i += m[0].length;
      if (name === 'frac' || name === 'dfrac' || name === 'tfrac') {
        const [a, j] = group(s, i), [b, k] = group(s, j);
        const wrap = (x: string) => (x.length > 1 && /[+\-−=\s]/.test(x) ? `(${x})` : x);
        out += `${wrap(math_text(a))}/${wrap(math_text(b))}`;
        i = k;
      } else if (name === 'sqrt') {
        const [a, j] = group(s, i), t = math_text(a);
        out += t.length > 1 ? `√(${t})` : `√${t}`;
        i = j;
      } else if (/^(text|textrm|mathrm|mathit|mathbf|mathsf|operatorname|mbox|textit|emph|boldsymbol|bm)$/.test(name)) {
        const [a, j] = group(s, i);
        out += name.startsWith('text') || name === 'mbox' || name === 'emph' ? a : math_text(a);
        i = j;
      } else if (/^(left|right|big|Big|bigg|Bigg|displaystyle|limits|nolimits)$/.test(name)) {
        /* sizing: nothing */
      } else if (name === ',' || name === ';' || name === ':' || name === ' ' || name === 'quad' || name === 'qquad') out += ' ';
      else if (name === '{' || name === '}' || name === '%' || name === '$' || name === '&' || name === '#' || name === '_') out += name;
      else out += SYM[name] ?? name;
    } else if (c === '^' || c === '_') {
      const [a, j] = group(s, i + 1), t = math_text(a), map = c === '^' ? SUP : SUB;
      const all = [...t].every((ch) => map[ch]);
      out += all ? [...t].map((ch) => map[ch]).join('') : `${c}${t.length > 1 ? `(${t})` : t}`;
      i = j;
    } else if (c === '{' || c === '}') i++;
    else if (c === '-') { out += '−'; i++; }
    else if (c === "'") { out += '′'; i++; }
    else { out += c; i++; }
  }
  return out.replace(/\s+/g, ' ');
}
/** Text with $…$ TeX in it, as plain text (the TeX turned into the characters it would show). */
export function tex_as_text(s: string): string {
  return s.replace(/\$\$([^$]+)\$\$|\$([^$]+)\$/g, (_m, a: string | undefined, b: string | undefined) => math_text((a ?? b ?? '').trim()));
}
