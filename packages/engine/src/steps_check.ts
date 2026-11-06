// Checking a derivation, line by line: does each line follow from the one before? A tutor (or an author) writes the
// lines; before a learner sees them, the engine checks what it can, in the subject the lines are in:
//   algebra    - equations keep their solutions (a slip in arithmetic, a lost or gained root, a sign error), chains of
//                expressions stay equal, inequalities keep their direction, derivatives d/dx are right, a line with
//                no unknowns is true; words and units in \text{} are treated as symbols, so units cancel or do not;
//   logic      - formulas with ¬ ∧ ∨ → ↔ stay equivalent (truth tables);
//   chemistry  - a reaction keeps its substances, and its last line is balanced (atoms and charge);
//   anything else is reported as not checked, never as right.
// Numbers are compared at many random points (seeded, so a check is the same every time).
import { match_lines, parse_steps, split_relation, typeset_line, type StepLine } from './steps';

export type Status = 'ok' | 'warn' | 'error' | 'unchecked';
export interface Verdict {
  /** The line this verdict is about (1-based), from the line before it. */
  line: number;
  status: Status;
  message: string;
}
export type Domain = 'algebra' | 'logic' | 'chemistry' | 'other';

// ------------------------------------------------------------------ TeX → expressions

type Env = Record<string, number>;
type Fn = (env: Env) => number;
class Unsupported extends Error {}
/** A line that is false in itself (a chain of equalities with unequal parts). */
class Untrue extends Error {}
interface Expr { f: Fn; vars: Set<string> }

const FUNCS: Record<string, (x: number) => number> = {
  sin: Math.sin, cos: Math.cos, tan: Math.tan, cot: (x) => 1 / Math.tan(x), sec: (x) => 1 / Math.cos(x), csc: (x) => 1 / Math.sin(x),
  arcsin: Math.asin, arccos: Math.acos, arctan: Math.atan, sinh: Math.sinh, cosh: Math.cosh, tanh: Math.tanh,
  ln: Math.log, log: Math.log10, exp: Math.exp, lg: Math.log10,
};
// units as their size in base units (a word in \\text{} that is not here is a symbol of its own): km = 1000 m, h = 3600 s
const UNITS: Record<string, [number, string]> = {
  m: [1, 'm'], km: [1000, 'm'], cm: [0.01, 'm'], mm: [0.001, 'm'], s: [1, 's'], min: [60, 's'], h: [3600, 's'], hr: [3600, 's'], ms: [0.001, 's'],
  g: [0.001, 'kg'], kg: [1, 'kg'], mg: [1e-6, 'kg'], t: [1000, 'kg'], L: [0.001, 'm3'], l: [0.001, 'm3'], mL: [1e-6, 'm3'], ml: [1e-6, 'm3'],
  N: [1, 'N'], J: [1, 'J'], kJ: [1000, 'J'], W: [1, 'W'], kW: [1000, 'W'], Pa: [1, 'Pa'], kPa: [1000, 'Pa'], mol: [1, 'mol'],
};
/** A word in \\text{} as factors: units (km/h → 1000 m / 3600 s) when every part is one, else the word as a symbol. */
function word_tokens(w: string): Tok[] {
  const parts = w.split(/\s*([/·*]|\s)\s*/).filter((x) => x && x.trim());
  const ok = parts.every((x) => x === '/' || x === '·' || x === '*' || /^([A-Za-z]+)(\^?-?\d)?$/.test(x) && UNITS[/^[A-Za-z]+/.exec(x)![0]]);
  if (!ok || !parts.some((x) => /^[A-Za-z]/.test(x))) return [{ t: 'var', v: `[${w}]` }];
  const out: Tok[] = [{ t: '(' }];
  let first = true;
  for (const x of parts) {
    if (x === '/') { out.push({ t: '/' }); first = true; continue; }
    if (x === '·' || x === '*') continue;
    const m = /^([A-Za-z]+)\^?(-?\d)?$/.exec(x)!, [k, base] = UNITS[m[1]];
    if (!first) out.push({ t: '*' });
    out.push({ t: '(' }, { t: 'num', v: String(k) }, { t: '*' }, { t: 'var', v: `[${base}]` }, { t: ')' });
    if (m[2]) out.push({ t: '^' }, { t: 'num', v: m[2] });
    first = false;
  }
  out.push({ t: ')' });
  return out;
}
const GREEK = 'alpha beta gamma delta epsilon varepsilon zeta eta theta vartheta iota kappa lambda mu nu xi rho sigma tau upsilon phi varphi chi psi omega Gamma Delta Theta Lambda Xi Sigma Phi Psi Omega'.split(' ');
const SKIP = /^\\(?:left|right|big|Big|bigg|Bigg|bigl|bigr|Bigl|Bigr|displaystyle|textstyle|,|;|:|!|quad|qquad| |limits|nolimits|mathstrut)(?![a-zA-Z])/;

interface Tok { t: string; v?: string }
function tokenize(src: string): Tok[] {
  const out: Tok[] = [];
  let s = src.replace(/\\cdot|\\times|·|×/g, '*').replace(/\\div|÷/g, '/').replace(/−/g, '-').replace(/\\%/g, '%');
  s = s.replace(/\\dfrac|\\tfrac/g, '\\frac').replace(/\\operatorname\{([a-z]+)\}/g, '\\$1');
  for (let i = 0; i < s.length;) {
    const r = s.slice(i);
    const ws = /^\s+/.exec(r);
    if (ws) { i += ws[0].length; continue; }
    const sk = SKIP.exec(r);
    if (sk) { i += sk[0].length; continue; }
    const num = /^(\d+(?:\.\d+)?|\.\d+)/.exec(r);
    if (num) { out.push({ t: 'num', v: num[1] }); i += num[0].length; continue; }
    const txt = /^\\(?:text|textrm|mathrm|mbox|mathit|textit|mathbf|operatorname)\s*\{([^{}]*)\}/.exec(r);
    if (txt) {
      const w = txt[1].trim();
      if (FUNCS[w]) out.push({ t: 'fn', v: w });
      else if (w) out.push(...word_tokens(w));
      i += txt[0].length;
      continue;
    }
    const cmd = /^\\([a-zA-Z]+)/.exec(r);
    if (cmd) {
      const c = cmd[1];
      i += cmd[0].length;
      if (FUNCS[c]) out.push({ t: 'fn', v: c });
      else if (c === 'frac' || c === 'sqrt') out.push({ t: c });
      else if (c === 'pi') out.push({ t: 'num', v: String(Math.PI) });
      else if (GREEK.includes(c)) out.push({ t: 'var', v: c });
      else if (c === 'infty' || c === 'int' || c === 'sum' || c === 'prod' || c === 'lim' || c === 'partial' || c === 'nabla' || c === 'begin' || c === 'mid' || c === 'vert') throw new Unsupported(c);
      else throw new Unsupported(c);
      continue;
    }
    const lp = /^\\\{/.exec(r), rp = /^\\\}/.exec(r);
    if (lp) { out.push({ t: '(' }); i += 2; continue; }
    if (rp) { out.push({ t: ')' }); i += 2; continue; }
    const c = s[i];
    if (/[a-zA-Z]/.test(c)) {
      // a word written without a backslash (sin, ln) is the function; otherwise letters are names, one each
      const w = /^[a-zA-Z]+/.exec(r)![0];
      const f = Object.keys(FUNCS).filter((k) => w.startsWith(k)).sort((a, b) => b.length - a.length)[0];
      if (f && w.length >= f.length && (w === f || /^(sin|cos|tan|ln|log|exp)/.test(w))) { out.push({ t: 'fn', v: f }); i += f.length; continue; }
      out.push({ t: 'var', v: c });
      i++;
      continue;
    }
    if ('+-*/^_()[]{}|%!\''.includes(c)) { out.push({ t: c === '[' ? '(' : c === ']' ? ')' : c }); i++; continue; }
    if (c === ',' ) throw new Unsupported(',');
    throw new Unsupported(c);
  }
  return out;
}

/** Parse a TeX expression (no relation) into a function of its variables. Throws Unsupported for what it cannot read. */
export function parse_expr(src: string): Expr {
  const toks = tokenize(src);
  let p = 0;
  const vars = new Set<string>();
  const peek = () => toks[p], next = () => toks[p++];
  const expect = (t: string) => { if (toks[p]?.t !== t) throw new Unsupported(`expected ${t}`); p++; };
  const group = (): Fn => {
    // {…} or a single token
    if (peek()?.t === '{') { p++; const f = sum(); expect('}'); return f; }
    return atom();
  };
  const name_of = (base: string): string => {
    if (peek()?.t !== '_') return base;
    p++;
    if (peek()?.t === '{') {
      p++;
      let s = '';
      while (p < toks.length && toks[p].t !== '}') { s += toks[p].v ?? toks[p].t; p++; }
      expect('}');
      return `${base}_${s}`;
    }
    const t = next();
    return `${base}_${t?.v ?? t?.t ?? ''}`;
  };
  const deriv = (x: string, body: Fn): Fn => (env) => {
    const h = 1e-5 * Math.max(1, Math.abs(env[x] ?? 0));
    const a = body({ ...env, [x]: (env[x] ?? 0) + h }), b = body({ ...env, [x]: (env[x] ?? 0) - h });
    return (a - b) / (2 * h);
  };
  function atom(): Fn {
    const t = next();
    if (!t) throw new Unsupported('end');
    if (t.t === 'num') { const v = Number(t.v); return () => v; }
    if (t.t === 'var') {
      if (t.v === 'e' && peek()?.t !== '_') return () => Math.E;
      const n = name_of(t.v!);
      vars.add(n);
      return (env) => env[n];
    }
    if (t.t === '(') { const f = sum(); expect(')'); return f; }
    if (t.t === '{') { const f = sum(); expect('}'); return f; }
    if (t.t === '|') { const f = sum(); expect('|'); return (env) => Math.abs(f(env)); }
    if (t.t === 'frac') {
      // d/dx: a derivative of what follows
      const save = p;
      if (peek()?.t === '{' && toks[p + 1]?.v === 'd' && toks[p + 2]?.t === '}' && toks[p + 3]?.t === '{' && toks[p + 4]?.v === 'd' && toks[p + 5]?.t === 'var' && toks[p + 6]?.t === '}') {
        const x = toks[p + 5].v!;
        p += 7;
        vars.add(x);
        const body = factor_chain();
        return deriv(x, body);
      }
      p = save;
      // dTC/dQ, dy/dx: a derivative of a named function, which this cannot evaluate
      if (peek()?.t === '{' && toks[p + 1]?.v === 'd' && toks[p + 2]?.t === 'var') { let q = p + 1; while (toks[q] && toks[q].t !== '}') q++; if (toks[q + 1]?.t === '{' && toks[q + 2]?.v === 'd' && toks[q + 3]?.t === 'var') throw new Unsupported('dy/dx'); }
      const a = group(), b = group();
      return (env) => a(env) / b(env);
    }
    if (t.t === 'sqrt') {
      let n: Fn | null = null;
      if (peek()?.t === '(' ) { /* \sqrt[n] arrives as ( … ) from the bracket */ p++; n = sum(); expect(')'); }
      const a = group();
      return n ? (env) => Math.pow(a(env), 1 / n!(env)) : (env) => Math.sqrt(a(env));
    }
    if (t.t === 'fn') {
      const f = FUNCS[t.v!];
      let power: Fn | null = null, base: Fn | null = null;
      if (t.v === 'log' && peek()?.t === '_') { p++; base = group(); }
      if (peek()?.t === '^') { p++; power = group(); }
      const arg = peek()?.t === '(' ? atom() : factor_chain_no_fn();
      const g: Fn = base ? (env) => Math.log(arg(env)) / Math.log(base!(env)) : (env) => f(arg(env));
      return power ? (env) => Math.pow(g(env), power!(env)) : g;
    }
    if (t.t === '-') { const f = factor(); return (env) => -f(env); }
    if (t.t === '+') return factor();
    throw new Unsupported(t.t);
  }
  function postfix(f: Fn): Fn {
    for (;;) {
      const t = peek();
      if (t?.t === '^') { p++; const e = group(); const b = f; f = (env) => Math.pow(b(env), e(env)); continue; }
      if (t?.t === '%') { p++; const b = f; f = (env) => b(env) / 100; continue; }
      if (t?.t === '!') { p++; const b = f; f = (env) => { const n = b(env); if (!(n >= 0 && Number.isInteger(n))) return NaN; let r = 1; for (let i = 2; i <= n; i++) r *= i; return r; }; continue; }
      if (t?.t === "'") throw new Unsupported("'");
      return f;
    }
  }
  const factor = (): Fn => postfix(atom());
  const starts_factor = (t: Tok | undefined) => !!t && ['num', 'var', '(', '{', 'frac', 'sqrt', 'fn', '|'].includes(t.t);
  // implicit products: 2x, 3(x + 1), x y, 2\sin x
  function factor_chain(): Fn {
    let f = factor();
    while (starts_factor(peek()) && !(peek()!.t === '|' && false)) {
      if (peek()!.t === '|') break;
      const g = factor(), a = f;
      f = (env) => a(env) * g(env);
    }
    return f;
  }
  // a function's bare argument: the factors up to the next function, operator or relation (sin 2x = sin(2x))
  function factor_chain_no_fn(): Fn {
    let f = factor();
    while (starts_factor(peek()) && peek()!.t !== 'fn' && peek()!.t !== '|') { const g = factor(), a = f; f = (env) => a(env) * g(env); }
    return f;
  }
  function product(): Fn {
    let f = factor_chain();
    for (;;) {
      const t = peek()?.t;
      if (t === '*') { p++; const g = factor_chain(), a = f; f = (env) => a(env) * g(env); }
      else if (t === '/') { p++; const g = factor_chain(), a = f; f = (env) => a(env) / g(env); }
      else return f;
    }
  }
  function sum(): Fn {
    let f: Fn;
    if (peek()?.t === '-') { p++; const g = product(); f = (env) => -g(env); }
    else { if (peek()?.t === '+') p++; f = product(); }
    for (;;) {
      const t = peek()?.t;
      if (t === '+') { p++; const g = product(), a = f; f = (env) => a(env) + g(env); }
      else if (t === '-') { p++; const g = product(), a = f; f = (env) => a(env) - g(env); }
      else return f;
    }
  }
  const f = sum();
  if (p < toks.length) throw new Unsupported(`left over: ${toks[p].t}`);
  return { f, vars };
}

// ------------------------------------------------------------------ algebra

function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => { a = (a + 0x6d2b79f5) >>> 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
interface Rel { kind: 'eq' | 'lt' | 'le' | 'approx' | 'none'; L: Expr | null; R: Expr | null; ltext: string; rtext: string; flip: boolean }
const REL_OF: Record<string, Rel['kind']> = { '=': 'eq', '<': 'lt', '>': 'lt', '\\lt': 'lt', '\\gt': 'lt', '\\le': 'le', '\\leq': 'le', '\\ge': 'le', '\\geq': 'le', '\\leqslant': 'le', '\\geqslant': 'le', '≤': 'le', '≥': 'le', '<=': 'le', '>=': 'le', '\\approx': 'approx', '≈': 'approx' };
const GREATER = new Set(['>', '\\gt', '\\ge', '\\geq', '\\geqslant', '≥', '>=']);
function read_line(tex: string): Rel {
  const sp = split_relation(tex);
  if (!sp) { const e = parse_expr(tex); return { kind: 'none', L: e, R: null, ltext: tex, rtext: '', flip: false }; }
  const kind = REL_OF[sp[1]];
  if (!kind) throw new Unsupported(sp[1]);
  // a chain of equalities in one line (2^3 = 2·2·2 = 8): every part must be equal; the line stands for its two ends
  const more = split_relation(sp[2]);
  if (more) {
    if (sp[1] !== '=' || more[1] !== '=') throw new Unsupported('two relations');
    // (names of more than one letter - TC, MC - are read as products elsewhere, consistently; in a chain they are not safe)
    if (/[a-zA-Z]{2,}/.test(tex.replace(/\\[a-zA-Z]+/g, ' ').replace(/\{[^{}]*\}/g, (m) => m))) throw new Unsupported('names in a chain');
    // (the first part is what is being worked out - often a name, y = 2·2·2 = 8 - so the parts after it must agree)
    const parts = [sp[0], ...sp[2].split(/(?<![<>!\\])=(?!=)/)].map((x) => x.trim());
    const es = parts.map((x) => parse_expr(x)), r = rng(77), rest = es.slice(1);
    const vs = [...new Set(rest.flatMap((e) => [...e.vars]))];
    for (let k = 0; k < 12; k++) {
      const env: Env = Object.fromEntries(vs.map((v) => [v, 0.3 + r() * 2.7]));
      const vals = rest.map((e) => e.f(env));
      if (vals.every(Number.isFinite) && vals.some((v) => !close(v, vals[0]))) throw new Untrue(`${parts.slice(1).join(' = ')}: ${vals.map(fmt).join(' vs ')}`);
    }
    return { kind: 'eq', L: es[0], R: es[es.length - 1], ltext: parts[0].replace(/\s+/g, ''), rtext: parts[parts.length - 1], flip: false };
  }
  let L: Expr | null = null, R: Expr | null = null;
  try { L = parse_expr(sp[0]); } catch (e) { if (!(e instanceof Unsupported)) throw e; }
  R = parse_expr(sp[2]);
  return { kind, L, R, ltext: sp[0].replace(/\s+/g, ''), rtext: sp[2], flip: GREATER.has(sp[1]) };
}
const fmt = (v: number) => (Math.abs(v) >= 1e4 || (Math.abs(v) < 1e-3 && v !== 0) ? v.toExponential(2) : String(Math.round(v * 1e4) / 1e4));
const close = (a: number, b: number, tol = 1e-7) => Math.abs(a - b) <= tol * (1 + Math.abs(a) + Math.abs(b));

/** Where f is zero along the variable x (others fixed), between -60 and 60: roots, double roots included. */
function roots(f: (x: number) => number): number[] {
  const out: number[] = [];
  const N = 6000, a = -60, b = 60, h = (b - a) / N;
  let x0 = a, f0 = f(a);
  const add = (r: number) => { if (Math.abs(f(r)) < 1e-6 * (1 + Math.abs(f(r + 1e-3)) + Math.abs(f(r - 1e-3))) && !out.some((q) => Math.abs(q - r) < 1e-5)) out.push(r); };
  for (let i = 1; i <= N; i++) {
    const x1 = a + i * h, f1 = f(x1);
    if (Number.isFinite(f0) && Number.isFinite(f1)) {
      if (f0 === 0) add(x0);
      else if (f0 * f1 < 0) {
        let lo = x0, hi = x1, flo = f0;
        for (let k = 0; k < 80; k++) { const m = (lo + hi) / 2, fm = f(m); if (flo * fm <= 0) hi = m; else { lo = m; flo = fm; } }
        add((lo + hi) / 2);
      }
    }
    x0 = x1; f0 = f1;
  }
  // double roots (touching zero without a sign change): local minima of |f| close to zero
  for (let i = 1; i < N; i++) {
    const xm = a + i * h, fm = Math.abs(f(xm)), fl = Math.abs(f(xm - h)), fr = Math.abs(f(xm + h));
    if (!(fm <= fl && fm <= fr) || !Number.isFinite(fm)) continue;
    let lo = xm - h, hi = xm + h;
    for (let k = 0; k < 100; k++) { const m1 = lo + (hi - lo) / 3, m2 = hi - (hi - lo) / 3; if (Math.abs(f(m1)) < Math.abs(f(m2))) hi = m2; else lo = m1; }
    const r = (lo + hi) / 2;
    if (Math.abs(f(r)) < 1e-9 * (1 + Math.abs(f(r + 0.5)))) add(r);
  }
  return out.sort((p, q) => p - q);
}

function check_algebra(A: Rel, B: Rel, line: number, seed: number, fixed: Env = {}): Verdict {
  const r = rng(seed);
  const vars = [...new Set([...(A.L?.vars ?? []), ...(A.R?.vars ?? []), ...(B.L?.vars ?? []), ...(B.R?.vars ?? [])])].filter((v) => !(v in fixed)).sort();
  // (words and units in \text{} are positive quantities; values put in for letters stay what they were put in as)
  const sample = (): Env => ({ ...Object.fromEntries(vars.map((v) => [v, (v.startsWith('[') || r() >= 0.5 ? 1 : -1) * (0.3 + r() * 2.7)])), ...fixed });
  const SAMPLES = 40;
  const val = (e: Expr | null, env: Env) => (e ? e.f(env) : NaN);
  // a chain of expressions (no relation), or the same left side again: the right sides must be equal
  const as_values = (X: Rel): Expr | null => (X.kind === 'none' ? X.L : X.R);
  const same_left = A.kind !== 'none' && B.kind !== 'none' && A.ltext === B.ltext && A.kind === B.kind && A.flip === B.flip;
  if ((A.kind === 'none' && B.kind === 'none') || (same_left && (A.kind === 'eq' || A.kind === 'approx'))) {
    const ea = as_values(A)!, eb = as_values(B)!, tol = B.kind === 'approx' ? 5e-3 : 1e-7;
    const used = [...new Set([...ea.vars, ...eb.vars])].sort();
    let n = 0;
    for (let s = 0; s < SAMPLES; s++) {
      const env = sample(), a = ea.f(env), b = eb.f(env);
      if (!Number.isFinite(a) || !Number.isFinite(b)) continue;
      n++;
      if (!close(a, b, tol)) return { line, status: 'error', message: `line ${line} is not equal to line ${line - 1}${used.length ? ` (at ${used.map((v) => `${v} = ${fmt(env[v])}`).join(', ')}: ${fmt(a)} vs ${fmt(b)})` : `: ${fmt(a)} vs ${fmt(b)}`}` };
    }
    return n >= 3 ? { line, status: 'ok', message: B.kind === 'approx' ? 'equal (to about 0.5 %)' : 'equal' } : { line, status: 'unchecked', message: 'could not be evaluated' };
  }
  if (A.kind === 'none' || B.kind === 'none') return { line, status: 'unchecked', message: 'a line with a relation next to one without' };
  if (!A.L || !B.L) return { line, status: 'unchecked', message: 'a side that is not a formula' };
  const g = (X: Rel) => (env: Env) => (X.flip ? val(X.R, env) - val(X.L, env) : val(X.L, env) - val(X.R, env));
  const ga = g(A), gb = g(B);
  // a line with no unknowns must simply be true
  if (!vars.length) {
    const b = gb({});
    if (!Number.isFinite(b)) return { line, status: 'unchecked', message: 'could not be evaluated' };
    const ok = B.kind === 'eq' ? close(val(B.L, {}), val(B.R, {})) : B.kind === 'approx' ? close(val(B.L, {}), val(B.R, {}), 5e-3) : B.kind === 'lt' ? b < 0 : b <= 1e-12;
    return ok ? { line, status: 'ok', message: 'true' } : { line, status: 'error', message: `line ${line} is false: ${fmt(val(B.L, {}))} vs ${fmt(val(B.R, {}))}` };
  }
  // inequalities: the same points satisfy both (this catches a direction that should have flipped)
  if (A.kind === 'lt' || A.kind === 'le' || B.kind === 'lt' || B.kind === 'le') {
    if (A.kind === 'eq' || B.kind === 'eq') return { line, status: 'unchecked', message: 'an inequality next to an equation' };
    let n = 0;
    for (let s = 0; s < SAMPLES * 3; s++) {
      const env = sample(), a = ga(env), b = gb(env);
      if (!Number.isFinite(a) || !Number.isFinite(b) || Math.abs(a) < 1e-6 || Math.abs(b) < 1e-6) continue;
      n++;
      if ((a < 0) !== (b < 0)) return { line, status: 'error', message: `line ${line} does not hold for the same values as line ${line - 1} (${vars.map((v) => `${v} = ${fmt(env[v])}`).join(', ')} satisfies ${a < 0 ? `line ${line - 1} but not line ${line}` : `line ${line} but not line ${line - 1}`}; did the sign flip when multiplying or dividing by a negative?)` };
    }
    return n >= 5 ? { line, status: 'ok', message: 'the same solutions' } : { line, status: 'unchecked', message: 'could not be evaluated' };
  }
  // lines true for every value (an identity: 2.5 h = 2.5 × 3600 s / 1 h): each must be one, then they follow
  const identity = (gx: (env: Env) => number) => { let n = 0; for (let s2 = 0; s2 < 16; s2++) { const env = sample(), v = gx(env); if (!Number.isFinite(v)) continue; n++; const scale = 1 + Math.abs(val(A.L, env)) + Math.abs(val(B.L, env)); if (Math.abs(v) > 1e-7 * scale) return false; } return n >= 4; };
  const ia = identity(ga), ib = identity(gb);
  if (ia && ib) return { line, status: 'ok', message: 'true for every value, as line ' + (line - 1) + ' is' };
  if (ia !== ib) {
    if (ib) return { line, status: 'error', message: `line ${line} is true for every value, line ${line - 1} is not: it does not follow` };
    const env = sample();
    return { line, status: 'error', message: `line ${line} is not true for every value, as line ${line - 1} is${vars.length ? ` (at ${vars.map((v) => `${v} = ${fmt(env[v])}`).join(', ')}: ${fmt(val(B.L, env))} vs ${fmt(val(B.R, env))})` : ''}` };
  }
  // equations: the same solutions. First the easy case: one side minus the other is the same up to a constant factor
  const ratios: number[] = [];
  for (let s = 0; s < SAMPLES; s++) {
    const env = sample(), a = ga(env), b = gb(env);
    if (!Number.isFinite(a) || !Number.isFinite(b) || Math.abs(a) < 1e-9) continue;
    ratios.push(b / a);
  }
  if (ratios.length >= 5 && ratios.every((q) => close(q, ratios[0], 1e-6)) && Math.abs(ratios[0]) > 1e-12) return { line, status: 'ok', message: 'the same equation (rearranged)' };
  // otherwise compare where each is zero, along each unknown in turn, the others at random values
  let compared = 0;
  for (const x of vars) for (let s = 0; s < (vars.length > 1 ? 4 : 1); s++) {
    const env = sample();
    const fa = (v: number) => ga({ ...env, [x]: v }), fb = (v: number) => gb({ ...env, [x]: v });
    const ra = roots(fa), rb = roots(fb);
    const has = (rs: number[], q: number) => rs.some((z) => Math.abs(z - q) < 1e-4 * (1 + Math.abs(q)));
    const lost = ra.filter((q) => !has(rb, q) && Number.isFinite(fb(q))), gained = rb.filter((q) => !has(ra, q) && Number.isFinite(fa(q)));
    const where = vars.length > 1 ? ` (with ${vars.filter((v) => v !== x).map((v) => `${v} = ${fmt(env[v])}`).join(', ')})` : '';
    if (lost.length && gained.length) return { line, status: 'error', message: `line ${line} does not have the solutions of line ${line - 1} (line ${line - 1}: ${x} = ${ra.map(fmt).join(', ')}; line ${line}: ${x} = ${rb.map(fmt).join(', ')})${where}` };
    if (lost.length) return { line, status: 'error', message: `line ${line} loses the solution ${x} = ${fmt(lost[0])}${where}` };
    if (gained.length) {
      // a root gained where the earlier line is undefined (a cancelled factor) or not a root (squaring): only a warning
      return { line, status: ra.length ? 'warn' : 'error', message: ra.length ? `line ${line} gains a solution ${x} = ${fmt(gained[0])}${where} that line ${line - 1} does not have (check it in the original)` : `line ${line} has the solution ${x} = ${fmt(gained[0])}${where}, line ${line - 1} has none` };
    }
    if (ra.length || rb.length) compared++;
  }
  return compared ? { line, status: 'ok', message: 'the same solutions' } : { line, status: 'unchecked', message: 'no solutions found to compare' };
}

/**
 * The values put in for letters from one line to the next (z = 40x + 30y → z = 40(20) + 30(40): x = 20, y = 40), read
 * from how the tokens of one line became the other's: a letter that flows into a number, the only one in its place.
 */
export function substituted(a: string, b: string): Env {
  const out: Env = {};
  const A = typeset_line(a), B = typeset_line(b);
  if (A.error || B.error) return out;
  const M = match_lines(A, B);
  // each place that changed (a run of new tokens that flowed from old ones): the letters there take the numbers there, in order
  for (let j = 0; j < B.tokens.length;) {
    if (M.to[j].role !== 'merge') { j++; continue; }
    const js: number[] = [], olds = new Set<number>();
    for (; j < B.tokens.length && M.to[j].role === 'merge'; j++) { js.push(j); for (const i of M.to[j].from) olds.add(i); }
    const letters = [...olds].sort((x, y) => x - y).filter((i) => A.tokens[i].kind === 'mi' || A.tokens[i].kind === 'mtext');
    const nums: number[] = [];
    let sign = 1, ok = true;
    for (const q of js) {
      const t = B.tokens[q];
      if (t.kind === 'mn') { nums.push(sign * Number(t.key)); sign = 1; }
      else if (t.key === '−' || t.key === '-') sign = -sign;
      else if (!['(', ')', '×', '⋅', '·', '*'].includes(t.key)) { ok = false; break; }
    }
    if (!ok || !letters.length || letters.length !== nums.length || nums.some((v) => !Number.isFinite(v))) continue;
    letters.forEach((i, n) => { const t = A.tokens[i]; out[t.kind === 'mtext' ? `[${t.key}]` : t.key] = nums[n]; });
  }
  return out;
}

// ------------------------------------------------------------------ logic

const LOGIC = /\\(?:land|lor|lnot|neg|wedge|vee|oplus|top|bot)(?![a-zA-Z])|[¬∧∨⊕]/;
type LFn = (env: Record<string, boolean>) => boolean;
function parse_logic(src: string): { f: LFn; vars: Set<string> } {
  const s = src.replace(/\\(?:left|right)(?![a-zA-Z])/g, '').replace(/\\[,;: !]/g, ' ');
  const toks: string[] = [];
  for (let i = 0; i < s.length;) {
    const r = s.slice(i);
    const ws = /^\s+/.exec(r);
    if (ws) { i += ws[0].length; continue; }
    const m = /^(\\(?:land|wedge)|∧)(?![a-zA-Z])/.exec(r) ?? /^(\\(?:lor|vee)|∨)(?![a-zA-Z])/.exec(r) ?? /^(\\(?:lnot|neg)|¬|~)(?![a-zA-Z])/.exec(r) ?? /^(\\(?:to|rightarrow|implies|Rightarrow)|→|⇒)(?![a-zA-Z])/.exec(r) ?? /^(\\(?:leftrightarrow|iff|Leftrightarrow)|↔|⇔)(?![a-zA-Z])/.exec(r) ?? /^(\\oplus|⊕)/.exec(r) ?? /^(\\top|\\bot|[TF01])(?![a-zA-Z])/.exec(r) ?? /^([A-Za-z](?:_\{?\w+\}?)?)/.exec(r) ?? /^([()])/.exec(r);
    if (!m) throw new Unsupported(r[0]);
    const t = m[1];
    toks.push(/land|wedge|∧/.test(t) ? '&' : /lor|vee|∨/.test(t) ? '|' : /lnot|neg|¬|~/.test(t) ? '!' : /leftrightarrow|iff|Leftrightarrow|↔|⇔/.test(t) ? '=' : /to|rightarrow|implies|Rightarrow|→|⇒/.test(t) ? '>' : /oplus|⊕/.test(t) ? '^' : t === '\\top' || t === 'T' || t === '1' ? '1' : t === '\\bot' || t === 'F' || t === '0' ? '0' : t);
    i += m[0].length;
  }
  let p = 0;
  const vars = new Set<string>();
  const prim = (): LFn => {
    const t = toks[p++];
    if (t === '!') { const f = prim(); return (e) => !f(e); }
    if (t === '(') { const f = iff(); if (toks[p++] !== ')') throw new Unsupported(')'); return f; }
    if (t === '1') return () => true;
    if (t === '0') return () => false;
    if (t && /^[A-Za-z]/.test(t)) { vars.add(t); return (e) => e[t]; }
    throw new Unsupported(t ?? 'end');
  };
  const and = (): LFn => { let f = prim(); while (toks[p] === '&') { p++; const g = prim(), a = f; f = (e) => a(e) && g(e); } return f; };
  const xor = (): LFn => { let f = and(); while (toks[p] === '^') { p++; const g = and(), a = f; f = (e) => a(e) !== g(e); } return f; };
  const or = (): LFn => { let f = xor(); while (toks[p] === '|') { p++; const g = xor(), a = f; f = (e) => a(e) || g(e); } return f; };
  const imp = (): LFn => { const f = or(); if (toks[p] === '>') { p++; const g = imp(); return (e) => !f(e) || g(e); } return f; };
  const iff = (): LFn => { let f = imp(); while (toks[p] === '=') { p++; const g = imp(), a = f; f = (e) => a(e) === g(e); } return f; };
  const f = iff();
  if (p < toks.length) throw new Unsupported('left over');
  return { f, vars };
}
function check_logic(a: string, b: string, line: number): Verdict {
  // a line may be one formula, or "formula ≡ formula": then it is the right side that continues
  const side = (s: string) => { const m = /\\equiv|≡|\\Leftrightarrow|⟺|=/.exec(s); return m ? s.slice(m.index + m[0].length) : s; };
  const A = parse_logic(side(a)), B = parse_logic(side(b));
  const vars = [...new Set([...A.vars, ...B.vars])];
  if (vars.length > 12) return { line, status: 'unchecked', message: 'too many variables' };
  for (let m = 0; m < 1 << vars.length; m++) {
    const env = Object.fromEntries(vars.map((v, i) => [v, !!(m & (1 << i))]));
    if (A.f(env) !== B.f(env)) return { line, status: 'error', message: `line ${line} is not equivalent to line ${line - 1} (when ${vars.map((v) => `${v} = ${env[v] ? 'T' : 'F'}`).join(', ')}, line ${line - 1} is ${A.f(env) ? 'T' : 'F'} and line ${line} is ${B.f(env) ? 'T' : 'F'})` };
  }
  return { line, status: 'ok', message: 'equivalent (truth table)' };
}

// ------------------------------------------------------------------ chemistry

const CHEM = /\\ce\{|->|→|⟶|\\rightarrow|\\longrightarrow|\\rightleftharpoons|<=>/;
interface Species { coef: number; formula: string; atoms: Map<string, number>; charge: number }
function parse_species(s: string): Species {
  let t = s.replace(/\\mathrm\{([^}]*)\}|\\text\{([^}]*)\}/g, '$1$2').replace(/[{}\s]/g, '').replace(/_/g, '');
  const cm = /^(\d+(?:\.\d+)?)?(.*)$/.exec(t)!;
  const coef = cm[1] ? Number(cm[1]) : 1;
  t = cm[2];
  // an electron: no atoms, one negative charge
  if (/^e\^?-$/.test(t)) return { coef, formula: 'e-', atoms: new Map(), charge: -1 };
  // charge: ^{2-}, ^+, ^{3+} (mhchem also writes A^2+)
  let charge = 0;
  const ch = /\^(\d*)([+-])$/.exec(t);
  if (ch) { charge = (ch[2] === '+' ? 1 : -1) * (ch[1] ? Number(ch[1]) : 1); t = t.slice(0, ch.index); }
  const state = /\((?:s|l|g|aq)\)$/.exec(t);
  if (state) t = t.slice(0, state.index);
  const atoms = new Map<string, number>();
  const stack: Map<string, number>[] = [new Map()];
  for (let i = 0; i < t.length;) {
    const r = t.slice(i);
    const el = /^([A-Z][a-z]?)(\d*)/.exec(r);
    if (el) { const m = stack[stack.length - 1]; m.set(el[1], (m.get(el[1]) ?? 0) + (el[2] ? Number(el[2]) : 1)); i += el[0].length; continue; }
    if (r[0] === '(' || r[0] === '[') { stack.push(new Map()); i++; continue; }
    const close_ = /^[)\]](\d*)/.exec(r);
    if (close_) { const m = stack.pop()!, k = close_[1] ? Number(close_[1]) : 1, top = stack[stack.length - 1]; for (const [e, n] of m) top.set(e, (top.get(e) ?? 0) + n * k); i += close_[0].length; continue; }
    if (r[0] === '·' || r[0] === '*' || r[0] === '.') { stack.push(new Map()); i++; const w = /^\d+/.exec(t.slice(i)); const k = w ? Number(w[0]) : 1; if (w) i += w[0].length; stack[stack.length - 1].set('×', k); continue; }
    throw new Unsupported(r[0]);
  }
  // hydrates (CuSO4·5H2O): a group multiplied by its leading number
  while (stack.length > 1) { const m = stack.pop()!, k = m.get('×') ?? 1; m.delete('×'); const top = stack[stack.length - 1]; for (const [e, n] of m) top.set(e, (top.get(e) ?? 0) + n * k); }
  for (const [e, n] of stack[0]) atoms.set(e, n);
  if (!atoms.size) throw new Unsupported('no element');
  return { coef, formula: t, atoms, charge };
}
function parse_reaction(tex: string): { left: Species[]; right: Species[] } {
  let s = tex.trim();
  const ce = /^\\ce\{([\s\S]*)\}$/.exec(s);
  if (ce) s = ce[1];
  const parts = s.split(/\s*(?:<=>|->|→|⟶|\\rightarrow|\\longrightarrow|\\rightleftharpoons|\\to)\s*/);
  if (parts.length !== 2) throw new Unsupported('arrow');
  const side = (x: string) => x.split(/\s+\+\s+|(?<=[\w)\]}])\+(?=\s*\d*[A-Z(\[])/).map((y) => parse_species(y.trim()));
  return { left: side(parts[0]), right: side(parts[1]) };
}
function balance_of(r: { left: Species[]; right: Species[] }): string | null {
  const count = (ss: Species[]) => { const m = new Map<string, number>(); for (const s of ss) for (const [e, n] of s.atoms) m.set(e, (m.get(e) ?? 0) + n * s.coef); return m; };
  const L = count(r.left), R = count(r.right), off: string[] = [];
  for (const e of new Set([...L.keys(), ...R.keys()])) if (Math.abs((L.get(e) ?? 0) - (R.get(e) ?? 0)) > 1e-9) off.push(`${e} ${L.get(e) ?? 0} → ${R.get(e) ?? 0}`);
  const q = (ss: Species[]) => ss.reduce((a, s) => a + s.charge * s.coef, 0);
  if (Math.abs(q(r.left) - q(r.right)) > 1e-9) off.push(`charge ${q(r.left)} → ${q(r.right)}`);
  return off.length ? off.join(', ') : null;
}

// ------------------------------------------------------------------ the whole derivation

/** Words that turn up only in the new line (1800 元, 5 dollars) name what is counted: they are labels, worth 1. */
function labels(A: Rel, B: Rel): Env {
  const va = new Set([...(A.L?.vars ?? []), ...(A.R?.vars ?? [])]);
  return Object.fromEntries([...(B.L?.vars ?? []), ...(B.R?.vars ?? [])].filter((v) => v.startsWith('[') && !va.has(v)).map((v) => [v, 1]));
}
/** What subject the lines are in (by what they contain). */
export function domain_of(lines: StepLine[]): Domain {
  const all = lines.map((l) => l.tex).join('\n');
  if (/\\ce\{/.test(all)) return 'chemistry';
  if (LOGIC.test(all)) return 'logic';
  // propositions joined only by arrows (p → q): logic too (an arrow between numbers or with = is a limit or a map)
  const PROP = /^(?:\s|[A-Za-z]|[()]|\\(?:to|rightarrow|Rightarrow|implies|leftrightarrow|iff|Leftrightarrow|equiv)(?![a-zA-Z])|[→⇒↔⇔≡])+$/;
  if (lines.every((l) => PROP.test(l.tex) && !/[a-zA-Z]{2}/.test(l.tex.replace(/\\[a-zA-Z]+/g, ' '))) && /\\(?:to|rightarrow|leftrightarrow|iff)|→|↔/.test(all)) return 'logic';
  if (lines.every((l) => /(?:->|→|⟶|\\rightarrow|\\longrightarrow)/.test(l.tex) && /[A-Z][a-z]?\d/.test(l.tex))) return 'chemistry';
  return 'algebra';
}

/**
 * Check each line against the one before (verdicts for lines 2, 3, …). `error`: it does not follow (with the values
 * that show it); `warn`: it follows but changed something to look at (a gained root); `unchecked`: the lines are in a
 * form this cannot read (an integral, a limit, a matrix, prose) - which says nothing about whether they are right.
 */
export function check_steps(lines: StepLine[]): { domain: Domain; verdicts: Verdict[] } {
  const domain = domain_of(lines), verdicts: Verdict[] = [];
  if (domain === 'chemistry') {
    let first: { left: Species[]; right: Species[] } | null = null;
    lines.forEach((l, i) => {
      if (i === 0) { try { first = parse_reaction(l.tex); } catch { first = null; } return; }
      try {
        const r = parse_reaction(l.tex);
        const names = (x: { left: Species[]; right: Species[] }) => [x.left.map((s) => s.formula).sort().join('+'), x.right.map((s) => s.formula).sort().join('+')].join('→');
        const f = first as { left: Species[]; right: Species[] } | null;
        if (f && names(f) !== names(r)) verdicts.push({ line: i + 1, status: 'warn', message: `line ${i + 1} has different substances than line 1` });
        else if (i === lines.length - 1) { const off = balance_of(r); verdicts.push(off ? { line: i + 1, status: 'error', message: `the last line is not balanced (${off})` } : { line: i + 1, status: 'ok', message: 'balanced' }); }
        else verdicts.push({ line: i + 1, status: 'ok', message: balance_of(r) ? 'the same reaction (not yet balanced)' : 'balanced' });
      } catch {
        verdicts.push({ line: i + 1, status: 'unchecked', message: 'not read as a reaction' });
      }
    });
    return { domain, verdicts };
  }
  for (let i = 1; i < lines.length; i++) {
    const line = i + 1;
    try {
      if (domain === 'logic') { verdicts.push(check_logic(lines[i - 1].tex, lines[i].tex, line)); continue; }
      const A = read_line(lines[i - 1].tex), B = read_line(lines[i].tex);
      // a limit taken on the way ("% as h → 0"): the line before, close to that value, must come to this line
      const lim = /([A-Za-z])\s*(?:\\to|\\rightarrow|→|->|趋于|趋向)\s*(-?\d+(?:\.\d+)?)/.exec(`${lines[i].why ?? ''} ${lines[i].tex}`);
      if (lim && (A.kind === 'none' || A.kind === 'eq') && (B.kind === A.kind)) {
        const v = lim[1], c = Number(lim[2]), ea = A.kind === 'none' ? A.L! : A.R!, eb = B.kind === 'none' ? B.L! : B.R!;
        if (ea.vars.has(v) && !eb.vars.has(v)) {
          const r = rng(1000 + i), names = [...new Set([...ea.vars, ...eb.vars])].filter((x) => x !== v);
          let bad: string | null = null, n = 0;
          for (let s2 = 0; s2 < 30 && !bad; s2++) {
            const env: Env = Object.fromEntries(names.map((x) => [x, (r() < 0.5 ? -1 : 1) * (0.3 + r() * 2.7)]));
            const b = eb.f(env);
            for (const d of [1e-6, -1e-6]) { const a = ea.f({ ...env, [v]: c + d }); if (!Number.isFinite(a) || !Number.isFinite(b)) continue; n++; if (!close(a, b, 1e-3)) bad = `${fmt(a)} vs ${fmt(b)}`; }
          }
          verdicts.push(bad ? { line, status: 'error', message: `line ${line} is not the limit of line ${line - 1} as ${v} → ${c} (${bad})` } : n ? { line, status: 'ok', message: `the limit as ${v} → ${c}` } : { line, status: 'unchecked', message: 'could not be evaluated' });
          continue;
        }
      }
      // letters that are gone in the new line: values were put in for them (checked with those values), or it is not read
      const va = new Set([...(A.L?.vars ?? []), ...(A.R?.vars ?? [])]), vb = new Set([...(B.L?.vars ?? []), ...(B.R?.vars ?? [])]);
      const gone = [...va].filter((v) => !vb.has(v));
      if (gone.length && [...vb].every((v) => va.has(v))) {
        const put = substituted(lines[i - 1].tex, lines[i].tex);
        // (an expression may lose its letters by simplifying - sin²θ + cos²θ = 1 - and is then checked as it is)
        if (!gone.every((v) => v in put)) {
          if (A.kind === 'none' && B.kind === 'none') { verdicts.push(check_algebra(A, B, line, 1000 + i, labels(A, B))); continue; }
          verdicts.push({ line, status: 'unchecked', message: `values put in for ${gone.join(', ')} (not read)` });
          continue;
        }
        const v = check_algebra(A, B, line, 1000 + i, { ...labels(A, B), ...put });
        const given = gone.map((g) => `${g.replace(/^\[|\]$/g, '')} = ${put[g]}`).join(', ');
        verdicts.push(v.status === 'ok' ? { ...v, message: `${given} put in correctly` } : { ...v, message: `${v.message} (with ${given} put in)` });
        continue;
      }
      verdicts.push(check_algebra(A, B, line, 1000 + i, labels(A, B)));
    } catch (e) {
      if (e instanceof Untrue) verdicts.push({ line, status: 'error', message: `a line is not true in itself (${e.message})` });
      else if (e instanceof Unsupported) verdicts.push({ line, status: 'unchecked', message: `not read (${e.message})` });
      else verdicts.push({ line, status: 'unchecked', message: `not read (${String((e as Error)?.message ?? e).slice(0, 60)})` });
    }
  }
  return { domain, verdicts };
}

/** Everything known about a block of steps before a learner sees it: the lines, what is wrong, and the checks. */
export interface Review {
  lines: StepLine[];
  domain: Domain;
  verdicts: Verdict[];
  /** What the writer should fix: unreadable text, a line that does not typeset, a step too big to follow, a line that does not follow. */
  issues: string[];
  /** Lines (1-based) a learner should be warned about: they do not follow from the line before. */
  doubtful: number[];
  /** No line fails (a warning or an unchecked line is not a failure). */
  ok: boolean;
}
/**
 * Read, typeset and check a ```steps block (or its body): what the tutor's answer is held to before it is drawn, and
 * what the tests hold a corpus of answers to. Needs TeX loaded (load_tex()).
 */
export function review_steps(src: string): Review {
  const p = parse_steps(src), issues = [...p.issues];
  const T = p.lines.map((l) => typeset_line(l.tex));
  T.forEach((t, i) => { if (t.error) issues.push(`line ${i + 1} does not typeset: ${t.error}`); });
  for (let i = 1; i < T.length; i++) {
    if (T[i].error || T[i - 1].error) continue;
    const m = match_lines(T[i - 1], T[i]);
    if (m.jump) issues.push(`line ${i + 1} changes too much at once (only ${Math.round(m.kept * 100)}% of line ${i} stays): split it into smaller steps`);
  }
  const { domain, verdicts } = check_steps(p.lines);
  for (const v of verdicts) if (v.status === 'error') issues.push(v.message);
  const doubtful = verdicts.filter((v) => v.status === 'error').map((v) => v.line);
  return { lines: p.lines, domain, verdicts, issues, doubtful, ok: !doubtful.length && !T.some((t) => t.error) && p.lines.length >= 2 };
}
