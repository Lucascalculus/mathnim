// Math expressions typed by students: parse, evaluate, compare.
//
// Accepts calculator style (`2x^2 + 3x - 1`, `sqrt(ab)`, `sin x`, `2(x+1)`,
// `x²`, `√2`, `π`, `12°`) and the LaTeX that math keyboards emit
// (`\frac{a}{b}`, `\sqrt{x}`, `\cdot`, `\pi`, `\left( \right)`).
// Equivalence is decided by evaluating both sides at random points, so
// `x(x+1)` = `x^2+x` and `1/2` = `0.5` without a CAS.

export type Node =
  | { k: 'num'; v: number; text: string }
  | { k: 'var'; name: string }
  | { k: 'neg'; a: Node }
  | { k: 'bin'; op: '+' | '-' | '*' | '/' | '^'; a: Node; b: Node }
  | { k: 'call'; fn: string; args: Node[] }
  | { k: 'fact'; a: Node };

export class ParseError extends Error {
  /**
   * `code` says what went wrong in a language-neutral way (parse_error_text()
   * words it in the learner's language): 'char' an unknown character `arg`,
   * 'expected' a missing `arg`, 'end' the input stops too early, 'token' an
   * unexpected `arg`. The message stays the English wording.
   */
  constructor(message: string, public pos: number, public code: 'char' | 'expected' | 'end' | 'token' = 'token', public arg = '') {
    super(message);
  }
}
const PARSE_TEXT = {
  char: { en: "unexpected character '{a}'", zh: '无法识别的字符"{a}"' },
  expected: { en: 'expected {a}', zh: '这里缺少 {a}' },
  more: { en: 'expected more input', zh: '式子还没写完' },
  end: { en: 'unexpected end of input', zh: '式子还没写完' },
  token: { en: "unexpected '{a}'", zh: '这里不该出现"{a}"' },
} as const;
/** A parse error in the learner's language (English is the error's own message). */
export function parse_error_text(e: ParseError, lang: 'en' | 'zh'): string {
  if (lang === 'en') return e.message;
  const key = e.code === 'expected' && !e.arg ? 'more' : e.code;
  return PARSE_TEXT[key][lang].replace('{a}', e.arg);
}

const FUNCS: Record<string, (...x: number[]) => number> = {
  sin: Math.sin, cos: Math.cos, tan: Math.tan, cot: (x) => 1 / Math.tan(x), sec: (x) => 1 / Math.cos(x), csc: (x) => 1 / Math.sin(x),
  asin: Math.asin, acos: Math.acos, atan: Math.atan, arcsin: Math.asin, arccos: Math.acos, arctan: Math.atan,
  sinh: Math.sinh, cosh: Math.cosh, tanh: Math.tanh,
  // log is the natural log (the ML convention, as in the derivations); log10 and lg are base 10
  sqrt: Math.sqrt, cbrt: Math.cbrt, ln: Math.log, log: Math.log, lg: Math.log10, log2: Math.log2, log10: Math.log10, exp: Math.exp,
  abs: Math.abs, floor: Math.floor, ceil: Math.ceil, round: Math.round, sign: Math.sign,
  root: (x, n) => (n % 2 === 1 && x < 0 ? -Math.pow(-x, 1 / n) : Math.pow(x, 1 / n)),
  logb: (x, b) => Math.log(x) / Math.log(b),
  min: Math.min, max: Math.max,
};
const CONSTS: Record<string, number> = { pi: Math.PI, e: Math.E, tau: 2 * Math.PI };
const GREEK = ['alpha', 'beta', 'gamma', 'delta', 'epsilon', 'theta', 'lambda', 'mu', 'phi', 'omega', 'rho', 'sigma'];

// ---------------------------------------------------------------- normalisation
const SUPERSCRIPTS: Record<string, string> = { '⁰': '0', '¹': '1', '²': '2', '³': '3', '⁴': '4', '⁵': '5', '⁶': '6', '⁷': '7', '⁸': '8', '⁹': '9', '⁻': '-' };
const UNICODE: [RegExp, string][] = [
  [/[×·⋅∙]/g, '*'], [/[÷∶]/g, '/'], [/[−–—]/g, '-'], [/π/g, ' pi '], [/θ/g, ' theta '], [/α/g, ' alpha '], [/β/g, ' beta '],
  [/√/g, ' sqrt '], [/∛/g, ' cbrt '], [/°/g, ' deg '], [/\*\*/g, '^'],
];

/** Turn LaTeX / unicode / calculator spellings into one plain syntax. */
export function normalise(input: string): string {
  let s = input.trim();
  s = s.replace(/\\left|\\right|\\!|\\,|\\;|\\:|\\ |\$/g, ' ');
  s = s.replace(/\\(?:operatorname|mathrm|text)\{([^}]*)\}/g, ' $1 ');
  // \frac{a}{b}, \dfrac, \tfrac  (nested braces handled by repeated passes)
  for (let i = 0; i < 8 && /\\[dt]?frac/.test(s); i++) s = s.replace(/\\[dt]?frac\s*\{((?:[^{}]|\{[^{}]*\})*)\}\s*\{((?:[^{}]|\{[^{}]*\})*)\}/g, '(($1)/($2))');
  for (let i = 0; i < 8 && /\\sqrt\[/.test(s); i++) s = s.replace(/\\sqrt\s*\[([^\]]*)\]\s*\{((?:[^{}]|\{[^{}]*\})*)\}/g, ' root(($2),($1))');
  for (let i = 0; i < 8 && /\\sqrt\s*\{/.test(s); i++) s = s.replace(/\\sqrt\s*\{((?:[^{}]|\{[^{}]*\})*)\}/g, ' sqrt(($1))');
  s = s.replace(/\\(cdot|times)/g, '*').replace(/\\div/g, '/').replace(/\\circ/g, ' deg ').replace(/\^\s*\{\s*deg\s*\}/g, ' deg ');
  s = s.replace(/\\(pi|theta|alpha|beta|gamma|delta|lambda|mu|phi|omega|rho|sigma|tau)\b/g, ' $1 ');
  s = s.replace(/\\(sin|cos|tan|cot|sec|csc|arcsin|arccos|arctan|sinh|cosh|tanh|ln|log|exp)\b/g, ' $1 ');
  s = s.replace(/\\log_\{?(\w+)\}?/g, ' logb_$1 ');
  s = s.replace(/[{]/g, '(').replace(/[}]/g, ')').replace(/\[/g, '(').replace(/\]/g, ')');
  s = s.replace(/[⁰¹²³⁴⁵⁶⁷⁸⁹⁻]+/g, (m) => '^(' + [...m].map((c) => SUPERSCRIPTS[c]).join('') + ')');
  for (const [re, r] of UNICODE) s = s.replace(re, r);
  return s;
}

// ---------------------------------------------------------------- tokenizer
type Tok = { t: 'num' | 'id' | 'op' | '(' | ')' | ',' | '|' | '!'; v: string; pos: number };

function tokenize(s: string, known: Set<string>): Tok[] {
  const out: Tok[] = [];
  let i = 0;
  while (i < s.length) {
    const c = s[i];
    if (/\s/.test(c)) {
      i++;
      continue;
    }
    const num = /^(\d+\.?\d*|\.\d+)(e[+-]?\d+)?/i.exec(s.slice(i));
    if (num && !(num[2] && /[a-z]/i.test(s[i + num[0].length] ?? ''))) {
      out.push({ t: 'num', v: num[0], pos: i });
      i += num[0].length;
      continue;
    }
    const id = /^[a-zA-Z_][a-zA-Z_0-9]*/.exec(s.slice(i));
    if (id) {
      for (const part of splitIdentifier(id[0], known)) out.push({ t: 'id', v: part, pos: i });
      i += id[0].length;
      continue;
    }
    if ('+-*/^'.includes(c)) out.push({ t: 'op', v: c, pos: i });
    else if (c === '(' || c === ')' || c === ',' || c === '|' || c === '!') out.push({ t: c, v: c, pos: i });
    else if (c === '%') out.push({ t: 'id', v: 'percent', pos: i });
    else throw new ParseError(`unexpected character '${c}'`, i, 'char', c);
    i++;
  }
  return out;
}
/** `xy` -> x·y, `2sinx` handled by the parser, `sinx` -> sin x, `logb_2` -> logb with base. */
function splitIdentifier(w: string, known: Set<string>): string[] {
  if (known.has(w) || w in FUNCS || w in CONSTS || GREEK.includes(w) || w === 'deg' || w === 'percent' || /^logb_\w+$/.test(w)) return [w];
  const lower = w.toLowerCase();
  for (const f of Object.keys(FUNCS).sort((a, b) => b.length - a.length)) {
    if (lower.startsWith(f) && w.length > f.length) return [f, ...splitIdentifier(w.slice(f.length), known)];
  }
  for (const c of [...Object.keys(CONSTS), ...GREEK].sort((a, b) => b.length - a.length)) {
    if (w.startsWith(c) && w.length > c.length) return [c, ...splitIdentifier(w.slice(c.length), known)];
  }
  if (/\d/.test(w)) return [w]; // x1, a_2
  return w.split(''); // single-letter variables multiplied
}

// ---------------------------------------------------------------- parser
/**
 * Grammar (loosest first): sum -> product -> unary -> power -> postfix -> atom.
 * Implicit multiplication binds like `*`; `-x^2` is `-(x^2)`; `sin x^2` is `sin(x^2)`.
 */
export function parse(input: string, variables: readonly string[] = []): Node {
  const known = new Set(variables);
  const toks = tokenize(normalise(input), known);
  let p = 0;
  const peek = () => toks[p];
  const eat = (t?: string, v?: string) => {
    const k = toks[p];
    if (!k || (t && k.t !== t) || (v && k.v !== v)) throw new ParseError(`expected ${v ?? t ?? 'more input'}`, k?.pos ?? input.length, 'expected', v ?? t ?? '');
    p++;
    return k;
  };
  const startsAtom = (k: Tok | undefined) => !!k && (k.t === 'num' || k.t === 'id' || k.t === '(' || (k.t === '|' && absDepth === 0));
  let absDepth = 0;

  function sum(): Node {
    let a = product();
    while (peek()?.t === 'op' && (peek().v === '+' || peek().v === '-')) {
      const op = eat().v as '+' | '-';
      a = { k: 'bin', op, a, b: product() };
    }
    return a;
  }
  function product(): Node {
    let a = unary();
    for (;;) {
      const k = peek();
      if (k?.t === 'op' && (k.v === '*' || k.v === '/')) {
        eat();
        a = { k: 'bin', op: k.v as '*' | '/', a, b: unary() };
      } else if (startsAtom(k)) a = { k: 'bin', op: '*', a, b: power() };
      else return a;
    }
  }
  function unary(): Node {
    const k = peek();
    if (k?.t === 'op' && (k.v === '-' || k.v === '+')) {
      eat();
      const a = unary();
      return k.v === '-' ? { k: 'neg', a } : a;
    }
    return power();
  }
  function power(): Node {
    const base = postfix();
    if (peek()?.t === 'op' && peek().v === '^') {
      eat();
      return { k: 'bin', op: '^', a: base, b: unary() };
    }
    return base;
  }
  function postfix(): Node {
    let a = atom();
    for (;;) {
      if (peek()?.t === '!') {
        eat();
        a = { k: 'fact', a };
      } else if (peek()?.t === 'id' && (peek().v === 'deg' || peek().v === 'percent')) {
        const v = eat().v;
        a = { k: 'bin', op: v === 'deg' ? '*' : '/', a, b: v === 'deg' ? { k: 'bin', op: '/', a: { k: 'var', name: 'pi' }, b: { k: 'num', v: 180, text: '180' } } : { k: 'num', v: 100, text: '100' } };
      } else return a;
    }
  }
  function atom(): Node {
    const k = peek();
    if (!k) throw new ParseError('unexpected end of input', input.length, 'end');
    if (k.t === 'num') {
      eat();
      return { k: 'num', v: parseFloat(k.v), text: k.v };
    }
    if (k.t === '(') {
      eat();
      const a = sum();
      eat(')');
      return a;
    }
    if (k.t === '|') {
      eat();
      absDepth++;
      const a = sum();
      absDepth--;
      eat('|');
      return { k: 'call', fn: 'abs', args: [a] };
    }
    if (k.t === 'id') {
      eat();
      const logb = /^logb_(\w+)$/.exec(k.v);
      if (k.v in FUNCS || logb) {
        let args: Node[];
        if (peek()?.t === '(') {
          eat();
          args = [sum()];
          while (peek()?.t === ',') {
            eat();
            args.push(sum());
          }
          eat(')');
          // sin(x)^2 means (sin x)^2
        } else {
          // sin x, sin 2x, sin^2 x
          if (peek()?.t === 'op' && peek().v === '^') {
            eat();
            const e = unary();
            const inner = implicitArg();
            return { k: 'bin', op: '^', a: { k: 'call', fn: k.v, args: [inner] }, b: e };
          }
          args = [implicitArg()];
        }
        if (logb) return { k: 'call', fn: 'logb', args: [args[0], parseBase(logb[1])] };
        return { k: 'call', fn: k.v, args };
      }
      return { k: 'var', name: k.v };
    }
    throw new ParseError(`unexpected '${k.v}'`, k.pos, 'token', k.v);
  }
  /** Argument of `sin x`: a power term, including a leading coefficient (`sin 2x`). */
  function implicitArg(): Node {
    let a = power();
    while (peek()?.t === 'id' && !(peek().v in FUNCS)) a = { k: 'bin', op: '*', a, b: power() };
    return a;
  }
  const parseBase = (b: string): Node => (/^\d+$/.test(b) ? { k: 'num', v: +b, text: b } : { k: 'var', name: b });

  const tree = sum();
  if (p < toks.length) throw new ParseError(`unexpected '${toks[p].v}'`, toks[p].pos, 'token', toks[p].v);
  return tree;
}

// ---------------------------------------------------------------- evaluation
function factorial(n: number): number {
  if (n < 0 || !Number.isInteger(n)) return NaN;
  let r = 1;
  for (let i = 2; i <= n; i++) r *= i;
  return r;
}
export function evaluate(n: Node, env: Record<string, number> = {}): number {
  switch (n.k) {
    case 'num': return n.v;
    case 'var':
      if (n.name in env) return env[n.name];
      if (n.name in CONSTS) return CONSTS[n.name];
      throw new Error(`unknown variable '${n.name}'`);
    case 'neg': return -evaluate(n.a, env);
    case 'fact': return factorial(evaluate(n.a, env));
    case 'call': return FUNCS[n.fn](...n.args.map((a) => evaluate(a, env)));
    case 'bin': {
      const a = evaluate(n.a, env), b = evaluate(n.b, env);
      switch (n.op) {
        case '+': return a + b;
        case '-': return a - b;
        case '*': return a * b;
        case '/': return a / b;
        case '^': return a < 0 && Number.isInteger(1 / b) && (1 / b) % 2 === 1 ? -Math.pow(-a, b) : Math.pow(a, b);
      }
    }
  }
}
export function free_variables(n: Node, out = new Set<string>()): Set<string> {
  if (n.k === 'var' && !(n.name in CONSTS)) out.add(n.name);
  if (n.k === 'neg' || n.k === 'fact') free_variables(n.a, out);
  if (n.k === 'bin') {
    free_variables(n.a, out);
    free_variables(n.b, out);
  }
  if (n.k === 'call') n.args.forEach((a) => free_variables(a, out));
  return out;
}
/** Plain-text rendering (for feedback and logs). */
export function to_string(n: Node): string {
  switch (n.k) {
    case 'num': return n.text;
    case 'var': return n.name;
    case 'neg': return `-${wrap(n.a, 3)}`;
    case 'fact': return `${wrap(n.a, 5)}!`;
    case 'call': return `${n.fn}(${n.args.map(to_string).join(', ')})`;
    case 'bin': {
      const prec = { '+': 1, '-': 1, '*': 2, '/': 2, '^': 4 }[n.op];
      return `${wrap(n.a, prec)}${n.op === '*' ? '*' : n.op}${wrap(n.b, n.op === '-' || n.op === '/' ? prec + 1 : prec)}`;
    }
  }
}
/** LaTeX rendering (for the live preview of typed answers). */
export function to_latex(n: Node): string {
  const G: Record<string, string> = { pi: '\\pi', theta: '\\theta', alpha: '\\alpha', beta: '\\beta', gamma: '\\gamma', delta: '\\delta', lambda: '\\lambda', mu: '\\mu', phi: '\\phi', omega: '\\omega', rho: '\\rho', sigma: '\\sigma', tau: '\\tau', e: 'e' };
  const w = (m: Node, min: number) => (precOf(m) < min ? `\\left(${to_latex(m)}\\right)` : to_latex(m));
  switch (n.k) {
    case 'num': return n.text;
    case 'var': return G[n.name] ?? (n.name.length > 1 ? `\\mathit{${n.name}}` : n.name);
    case 'neg': return `-${w(n.a, 3)}`;
    case 'fact': return `${w(n.a, 5)}!`;
    case 'call':
      if (n.fn === 'sqrt') return `\\sqrt{${to_latex(n.args[0])}}`;
      if (n.fn === 'abs') return `\\left|${to_latex(n.args[0])}\\right|`;
      if (n.fn === 'root') return `\\sqrt[${to_latex(n.args[1])}]{${to_latex(n.args[0])}}`;
      return `\\${['sin', 'cos', 'tan', 'ln', 'log', 'exp'].includes(n.fn) ? n.fn : `operatorname{${n.fn}}`}\\left(${n.args.map(to_latex).join(', ')}\\right)`;
    case 'bin':
      if (n.op === '/') return `\\frac{${to_latex(n.a)}}{${to_latex(n.b)}}`;
      if (n.op === '^') return `${w(n.a, 5)}^{${to_latex(n.b)}}`;
      if (n.op === '*') {
        const a = w(n.a, 2), b = w(n.b, 2);
        // implicit product unless two numbers meet
        return /^\d/.test(b) ? `${a} \\cdot ${b}` : `${a}\\,${b}`;
      }
      return `${w(n.a, 1)} ${n.op} ${w(n.b, n.op === '-' ? 2 : 1)}`;
  }
}
const precOf = (n: Node) => (n.k === 'bin' ? { '+': 1, '-': 1, '*': 2, '/': 2, '^': 4 }[n.op] : n.k === 'neg' ? 3 : 6);
const wrap = (n: Node, min: number) => (precOf(n) < min ? `(${to_string(n)})` : to_string(n));

// ---------------------------------------------------------------- comparison
function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export interface EquivalenceOptions {
  /** Variables and their sampling ranges; default [-3, 3] (away from 0) for each free variable. */
  ranges?: Record<string, [number, number]>;
  /** Relative tolerance for numbers (and for sampled values). */
  rtol?: number;
  atol?: number;
  samples?: number;
  seed?: number;
}
/** True when a and b agree wherever both are defined (random-point test). */
export function equivalent(a: Node | string, b: Node | string, o: EquivalenceOptions = {}): boolean {
  const vars = Object.keys(o.ranges ?? {});
  const A = typeof a === 'string' ? parse(a, vars) : a;
  const B = typeof b === 'string' ? parse(b, vars) : b;
  const names = [...new Set([...free_variables(A), ...free_variables(B), ...vars])];
  const rtol = o.rtol ?? 1e-6, atol = o.atol ?? 1e-9;
  const close = (x: number, y: number) => Math.abs(x - y) <= atol + rtol * Math.max(Math.abs(x), Math.abs(y));
  if (!names.length) {
    const x = evaluate(A), y = evaluate(B);
    return Number.isFinite(x) && Number.isFinite(y) ? close(x, y) : Object.is(x, y);
  }
  const rand = rng(o.seed ?? 12345);
  const n = o.samples ?? 24;
  let agree = 0;
  for (let i = 0; i < n * 4 && agree < n; i++) {
    const env: Record<string, number> = {};
    for (const v of names) {
      const [lo, hi] = o.ranges?.[v] ?? [-3, 3];
      let x = lo + (hi - lo) * rand();
      if (!o.ranges?.[v] && Math.abs(x) < 0.2) x += 0.5; // keep away from common singular points
      env[v] = x;
    }
    let x: number, y: number;
    try {
      x = evaluate(A, env);
      y = evaluate(B, env);
    } catch {
      return false;
    }
    if (!Number.isFinite(x) || !Number.isFinite(y)) continue;
    if (!close(x, y)) return false;
    agree++;
  }
  return agree >= Math.min(n, 6);
}

/** Shape tests used for `form` requirements. */
export const form = {
  /** Top level is a product/power of non-trivial factors, e.g. (x+1)(x-2). */
  factored(n: Node): boolean {
    const isSum = (m: Node): boolean => (m.k === 'bin' && (m.op === '+' || m.op === '-')) || (m.k === 'neg' && isSum(m.a));
    if (isSum(n)) return false;
    return true;
  },
  /** No product or power of sums remains, e.g. x^2 + 3x + 2. */
  expanded(n: Node): boolean {
    const isSum = (m: Node): boolean => m.k === 'bin' && (m.op === '+' || m.op === '-');
    const walk = (m: Node): boolean => {
      if (m.k === 'bin' && m.op === '*' && (isSum(m.a) || isSum(m.b))) return false;
      if (m.k === 'bin' && m.op === '^' && isSum(m.a)) return false;
      if (m.k === 'bin') return walk(m.a) && walk(m.b);
      if (m.k === 'neg') return walk(m.a);
      return true;
    };
    return walk(n);
  },
  /** Contains no decimal approximations (for "give the exact value"). */
  exact(n: Node): boolean {
    if (n.k === 'num') return !n.text.includes('.') && !/e/i.test(n.text);
    if (n.k === 'bin') return form.exact(n.a) && form.exact(n.b);
    if (n.k === 'neg' || n.k === 'fact') return form.exact(n.a);
    if (n.k === 'call') return n.args.every(form.exact);
    return true;
  },
};
