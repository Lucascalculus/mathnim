// Acts (推理的动作): what was done to get from one line of a derivation to the next, read from the two lines alone, so
// that the derivation can show it being done. A step that does the same thing to both sides of an equation - takes a
// term away or adds one, multiplies or divides by something - is drawn as that act: the operation is written on both
// sides at once (in the one vermilion of an action), and only then worked out (what cancels is struck through and
// goes, what combines is bracketed and becomes its value). "Moving a term across" is a shortcut that hides why it is
// allowed; the act is the why. Whoever writes the lines writes nothing more: the act is inferred from the two lines,
// and checked - numerically where the sides can be evaluated, by their writing where they cannot (sums, integrals).
import { parse_expr } from './steps_check';
import { split_relation } from './steps';

export interface StepAct {
  /** add: a term added or taken away on both sides; mul / div: both sides multiplied or divided by `tex`. */
  kind: 'add' | 'mul' | 'div';
  /** For add, the sign written before the term ('+' or '-'). */
  op: '+' | '-' | '';
  /** The operand, as TeX. */
  tex: string;
}

/** Splits at the top level: outside braces, brackets and \left…\right. */
function top_level(s: string, at: (c: string, i: number, before: string) => boolean): string[] {
  const out: string[] = [];
  let depth = 0, cur = '';
  for (let i = 0; i < s.length; i++) {
    const rest = s.slice(i);
    const lr = /^\\(left|right)\s*(\\[{}|]|\\[a-zA-Z]+|[()[\]|.])/.exec(rest);
    if (lr) { depth += lr[1] === 'left' ? 1 : -1; cur += lr[0]; i += lr[0].length - 1; continue; }
    if (s[i] === '\\') { const w = /^\\[a-zA-Z]+|^\\./.exec(rest)![0]; cur += w; i += w.length - 1; continue; }
    if ('{([' .includes(s[i])) depth++;
    if ('})]'.includes(s[i])) depth--;
    if (depth === 0 && at(s[i], i, cur)) { out.push(cur); cur = s[i]; continue; }
    cur += s[i];
  }
  out.push(cur);
  return out;
}

/** The top-level terms of a side, each with its sign: "2x + 3 - y" → [['+','2x'], ['+','3'], ['-','y']]. */
export function terms_of(side: string): ['+' | '-', string][] {
  const parts = top_level(side.trim(), (c, _i, before) => (c === '+' || c === '-' || c === '−') && before.trim() !== '' && !/[\^_=(]\s*$/.test(before));
  return parts.map((p) => p.trim()).filter(Boolean).map((p) => {
    const m = /^([+\-−])\s*(.*)$/s.exec(p);
    return m ? [m[1] === '+' ? '+' : '-', m[2].trim()] : ['+', p];
  });
}

/** TeX without the spacing that does not change it (a control word keeps the one space that ends it). */
export function tex_norm(s: string): string {
  return s.replace(/\\[,;:! ]|\\q?quad/g, ' ').replace(/\\left|\\right/g, '').replace(/−/g, '-').replace(/\\cdot/g, '·')
    .replace(/(\\[a-zA-Z]+)\s+(?=[a-zA-Z])/g, '$1\u0000').replace(/\s+/g, '').replace(/\u0000/g, ' ').replace(/^\{(.*)\}$/, '$1');
}
/** A side as TeX again from its terms. */
const join = (ts: ['+' | '-', string][]): string => ts.map(([s, t], i) => (i === 0 ? (s === '-' ? `-${t}` : t) : ` ${s} ${t}`)).join('') || '0';
/** In brackets when it is a sum (so an operation applies to all of it). */
const whole = (s: string): string => (terms_of(s).length > 1 ? `\\left(${s}\\right)` : s);

// ------------------------------------------------------------------ is it the same? (numbers where they can be had)

function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => { a = (a + 0x6d2b79f5) >>> 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
/** true / false: the two expressions agree (or not) at random points; null: they cannot be evaluated. */
function same_value(a: string, b: string): boolean | null {
  let A, B;
  try { A = parse_expr(a); B = parse_expr(b); } catch { return null; }
  const vars = [...new Set([...A.vars, ...B.vars])], r = rng(7);
  let n = 0;
  for (let k = 0; k < 12; k++) {
    const env: Record<string, number> = {};
    for (const v of vars) env[v] = 0.6 + 1.9 * r();
    const x = A.f(env), y = B.f(env);
    if (!Number.isFinite(x) || !Number.isFinite(y)) continue;
    if (Math.abs(x - y) > 1e-7 * (1 + Math.abs(x) + Math.abs(y))) return false;
    n++;
  }
  return n >= 6 ? true : null;
}
/** The same by value where both can be evaluated, else by writing. */
const same = (a: string, b: string): boolean => same_value(a, b) ?? tex_norm(a) === tex_norm(b);

// ------------------------------------------------------------------ the act between two lines

/**
 * What was done to both sides to get line `b` from line `a`, or null when the step is not one act on both sides (a
 * derivative taken, terms multiplied out: those are shown by what moves, not as an act).
 */
export function infer_act(a: string, b: string): StepAct | null {
  const A = split_relation(a), B = split_relation(b);
  if (!A || !B || tex_norm(A[1]) !== tex_norm(B[1])) return null;
  const [L1, rel, R1] = A, [L2, , R2] = B;
  if (tex_norm(L1) === tex_norm(L2) && tex_norm(R1) === tex_norm(R2)) return null;
  const equation = tex_norm(rel) === '=';
  // 1. a term taken away (or added) on both sides: it goes from where it was, and turns up, opposite, on the other side
  for (const [from, to, other1, other2] of [[L1, L2, R1, R2], [R1, R2, L1, L2]] as const) {
    const ts = terms_of(from);
    for (let i = 0; i < ts.length; i++) {
      const [s, t] = ts[i], op = s === '+' ? '-' : '+';
      const rest = join(ts.filter((_, j) => j !== i));
      const here = same_value(`${from} ${op} ${whole(t)}`, to) ?? tex_norm(rest) === tex_norm(to);
      if (!here) continue;
      const there = same_value(`${other1} ${op} ${whole(t)}`, other2) ?? (tex_norm(other2) === tex_norm(`${other1}${op}${t}`) || (tex_norm(other1) === '0' && tex_norm(other2) === tex_norm(op === '-' ? `-${t}` : t)));
      // (the next line already writes the act out - 2x + 3 - 3 = 11 - 3 -: it is shown as written)
      if (there && tex_norm(to) === tex_norm(`${from}${op}${whole(t)}`)) return null;
      if (there) return { kind: 'add', op, tex: t };
    }
  }
  if (!equation) return null;
  // 2. both sides divided by a factor of the side that keeps the unknown (a fraction as a factor: multiplied by its flip)
  for (const [from, to, other1, other2] of [[L1, L2, R1, R2], [R1, R2, L1, L2]] as const) {
    if (terms_of(from).length !== 1 || !tex_norm(to)) continue;
    const cands: string[] = [];
    const lead = /^\s*(\d+(?:\.\d+)?)\s*(?=[^\d.\s])/.exec(from);
    if (lead) cands.push(lead[1]);
    const f = tex_norm(from), k = f.indexOf(tex_norm(to));
    if (k >= 0 && f !== tex_norm(to)) cands.push((f.slice(0, k) + f.slice(k + tex_norm(to).length)).replace(/^·|·$/g, ''));
    for (const d of cands) {
      if (!d || d === '1') continue;
      const flip = /^\\frac\{([^{}]+)\}\{([^{}]+)\}$/.exec(d);
      if (flip) {
        // ×(n/2) reads better than ÷(2/n)
        const m = `\\frac{${flip[2]}}{${flip[1]}}`;
        if (same(`${m}\\cdot ${whole(from)}`, to) || tex_norm(from).replace(tex_norm(d), '') === tex_norm(to)) {
          if (same(`${m}\\cdot ${whole(other1)}`, other2)) return { kind: 'mul', op: '', tex: m };
        }
        continue;
      }
      const here = same_value(`\\frac{${from}}{${d}}`, to) ?? (tex_norm(from).replace(tex_norm(d), '') === tex_norm(to));
      if (here && same(`\\frac{${other1}}{${d}}`, other2)) return { kind: 'div', op: '', tex: d };
    }
  }
  // 3. both sides multiplied by a denominator: x/2 = 4 → x = 8
  for (const [from, to, other1, other2] of [[L1, L2, R1, R2], [R1, R2, L1, L2]] as const) {
    const m = /^\\frac\{([^{}]+)\}\{([^{}]+)\}$/.exec(from.trim());
    if (m && same(m[1], to) && same(`${m[2]}\\cdot ${whole(other1)}`, other2)) return { kind: 'mul', op: '', tex: m[2] };
  }
  return null;
}

/** Line `a` with the act done to both of its sides and not yet worked out, the operation in `color`. */
export function act_tex(a: string, act: StepAct, color: string): string {
  const [L, rel, R] = split_relation(a)!;
  // (\textcolor colours only its argument - \color is a switch that runs to the end - and \mathbin keeps an
  // operator's spacing)
  const c = (s: string) => `\\textcolor{${color}}{${s}}`, op = (o: string) => `\\mathbin{${c(o)}}`;
  if (act.kind === 'add') return `${L} ${op(act.op)} ${c(whole(act.tex))} ${rel} ${R} ${op(act.op)} ${c(whole(act.tex))}`;
  if (act.kind === 'div') return `\\frac{${L}}{${c(act.tex)}} ${rel} \\frac{${R}}{${c(act.tex)}}`;
  return `${c(act.tex)} ${op('\\cdot')} ${whole(L)} ${rel} ${c(act.tex)} ${op('\\cdot')} ${whole(R)}`;
}
