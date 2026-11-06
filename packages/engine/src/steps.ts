// Formula steps (液态代数, in the engine). A derivation is a list of lines - an equation solved, an expression
// simplified, a derivative taken, a reaction balanced, a logic formula rewritten - shown as one formula that changes
// from line to line. Every resting frame is exactly the typeset line. Between two lines every token (a number, a
// letter, an operator, a word, a fraction's bar) is matched to the next line's from the TeX alone, in any subject, and
// does what the change says: it stays, travels (over the relation on an arc), flows together with others into what
// they make (11 − 3 → 8), cancels out (+3 and −3), or appears. So whoever writes the steps - an author or the tutor -
// writes only the lines; parse_steps() takes them as people and models actually write them.
import { tex_glyphs, type TexGlyph } from 'manim-web/utils/tex/mathjax';
import { look } from '@mathnim/look';
import type { Box } from './geom';
import { Figure } from './figure';
import { column, type Block, type LayoutEnv, type Size } from './layout';
import { make_canvas } from './render';
import { beat, set, wait, type Step } from './script';
import { param, read, untracked, type Param } from './state';
import { tex_scale } from './tex';
import { break_lines, font_css, font_of, type Lang } from './text';
import { Thing, type DrawEnv, type Style } from './thing';

// ------------------------------------------------------------------ the lines, as people write them

export interface StepLine {
  /** One line of TeX (no dollars). */
  tex: string;
  /** What was done to get here, in words (from `% ...`, or words around the formula). */
  why: string | null;
}
export interface ParsedSteps {
  lines: StepLine[];
  /** What was wrong with the text (empty: nothing). */
  issues: string[];
}

/** The ```steps blocks of a text (a tutor's answer, a page), with where each is; `closed` is false while one is still arriving. */
export function steps_blocks(text: string): { body: string; start: number; end: number; closed: boolean }[] {
  const out: { body: string; start: number; end: number; closed: boolean }[] = [];
  const re = /```[ \t]*steps[^\n]*\n([\s\S]*?)(```|$)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    out.push({ body: m[1], start: m.index, end: m.index + m[0].length, closed: m[2] === '```' });
    if (!m[0].length) break;
  }
  return out;
}

const ALIGN_ENVS = 'aligned|align\\*?|alignat\\*?|gathered|gather\\*?|eqnarray\\*?|split|flalign\\*?|multline\\*?|equation\\*?|displaymath';
/** Index of the first unescaped % (a TeX comment), or -1. */
function comment_at(s: string): number {
  for (let i = 0; i < s.length; i++) {
    if (s[i] === '\\') i++;
    else if (s[i] === '%') return i;
  }
  return -1;
}
/** Split at a separator that is outside braces and outside \begin..\end (a matrix keeps its rows and columns). */
function split_top(s: string, sep: '\\\\' | '&'): string[] {
  const out: string[] = [];
  let depth = 0, env = 0, cur = '';
  for (let i = 0; i < s.length; i++) {
    const rest = s.slice(i);
    const b = /^\\begin\{[^}]*\}/.exec(rest), e = /^\\end\{[^}]*\}/.exec(rest);
    if (b) { env++; cur += b[0]; i += b[0].length - 1; continue; }
    if (e) { env = Math.max(0, env - 1); cur += e[0]; i += e[0].length - 1; continue; }
    if (sep === '\\\\' && rest.startsWith('\\\\') && depth === 0 && env === 0) { out.push(cur); cur = ''; i++; continue; }
    if (s[i] === '\\') { cur += s[i] + (s[i + 1] ?? ''); i++; continue; }
    if (s[i] === '{') depth++;
    if (s[i] === '}') depth = Math.max(0, depth - 1);
    if (sep === '&' && s[i] === '&' && depth === 0 && env === 0) { cur += ' '; continue; }
    cur += s[i];
  }
  out.push(cur);
  return out;
}
const clean_why = (s: string): string | null => {
  let w = s.replace(/\\(?:text|textrm|mathrm|mbox|textit|emph)\{([^{}]*)\}/g, '$1').replace(/\\[,;:! ]|\\q?quad/g, ' ');
  w = w.replace(/^[\s:：,，;；—–\-→⇒]+|[\s:：,，;；—–\-]+$/g, '').trim();
  w = w.replace(/^\((.*)\)$/, '$1').replace(/^（(.*)）$/, '$1').replace(/^\[(.*)\]$/, '$1').trim();
  return w ? w.replace(/\s+/g, ' ').slice(0, 120) : null;
};
/** The main relation of a line of TeX at the top level: [left, relation, right], or null. */
export function split_relation(tex: string): [string, string, string] | null {
  let depth = 0;
  const rel = /^(\\(?:leq?|geq?|neq|ne|approx|equiv|to|rightarrow|longrightarrow|Rightarrow|iff|Leftrightarrow|leftrightarrow|lt|gt|leqslant|geqslant)(?![a-zA-Z])|<=|>=|=|<|>|≤|≥|≠|≈|→|⇒)/;
  for (let i = 0; i < tex.length; i++) {
    const c = tex[i];
    if (c === '{') depth++;
    else if (c === '}') depth--;
    else if (depth === 0) {
      if (c === '\\' && /^\\(left|right|big|Big|bigg|Bigg)/.test(tex.slice(i))) { const m = /^\\[a-zA-Z]+/.exec(tex.slice(i)); i += (m?.[0].length ?? 1) - 1; continue; }
      const m = rel.exec(tex.slice(i));
      if (m) return [tex.slice(0, i).trim(), m[0], tex.slice(i + m[0].length).trim()];
      if (c === '\\') { const w = /^\\[a-zA-Z]+|^\\./.exec(tex.slice(i)); i += (w?.[0].length ?? 1) - 1; }
    }
  }
  return null;
}

/**
 * The lines of a derivation, from a ```steps block (or any text holding one) as a person or a model writes it: one
 * TeX line per step, `% words` for what was done. Also taken: $...$ or \[...\] around a line (words outside are the
 * reason), list markers (1. / - / Step 2: / 第2步), aligned / align* / gather environments and `\\` rows, `&`
 * alignment marks, a trailing \quad\text{...} reason, a line starting with `=` (the same left side again), a leading
 * ⇒, and a final full stop.
 */
export function parse_steps(src: string): ParsedSteps {
  const issues: string[] = [];
  let s = src.replace(/\r/g, '');
  const blocks = steps_blocks(s);
  if (blocks.length) s = blocks[0].body;
  else if (/^\s*```/.test(s)) s = s.replace(/^\s*```[^\n]*\n?/, '').replace(/```\s*$/, '');
  s = s.replace(new RegExp(`\\\\begin\\{(?:${ALIGN_ENVS})\\}(?:\\{[^}]*\\})?`, 'g'), '\n').replace(new RegExp(`\\\\end\\{(?:${ALIGN_ENVS})\\}`, 'g'), '\n');
  s = s.replace(/\$\$/g, '\n').replace(/\\\[|\\\]/g, '\n');
  const lines: StepLine[] = [];
  for (const raw of s.split('\n')) {
    let l = raw.trim();
    if (!l || /^```/.test(l)) continue;
    // a reason given on its own line after a line (`% ...`): it belongs to the line before
    const pc0 = comment_at(l);
    if (pc0 === 0) {
      const w = clean_why(l.slice(1));
      if (w && lines.length && !lines[lines.length - 1].why) lines[lines.length - 1].why = w;
      continue;
    }
    for (let row of split_top(l, '\\\\')) {
      row = row.trim();
      if (!row) continue;
      let why: string | null = null;
      row = row.replace(/^(?:\d+\s*[.)、:：]\s+|[-*•·]\s+|(?:step|Step|STEP)\s*\d+\s*[:.)：]\s*|第\s*[一二三四五六七八九十\d]+\s*步\s*[:：]?\s*)/, '');
      const pc = comment_at(row);
      if (pc >= 0) { why = clean_why(row.slice(pc + 1)); row = row.slice(0, pc); }
      if (row.includes('$')) {
        const m = /\$\$?([^$]+)\$\$?/.exec(row);
        if (m) {
          const rest = (row.slice(0, m.index) + ' ' + row.slice(m.index + m[0].length)).trim();
          row = m[1];
          if (!why && rest) why = clean_why(rest);
        }
      }
      row = row.replace(/^\s*\\\(|\\\)\s*$/g, '').trim();
      if (/^`[^`]+`$/.test(row)) row = row.slice(1, -1);
      // a reason written in TeX after the formula: \quad\text{...} or (\text{...}) (not a unit after a thin space: 5\,\text{m})
      const tq = /(?:\\q?quad\s*)+\(?\s*\\(?:text|textrm|mbox|mathrm|textit)\{([^{}]*)\}\s*\)?\s*$/.exec(row) ?? /\s\(\s*\\(?:text|textrm|mbox|textit)\{([^{}]*)\}\s*\)\s*$/.exec(row);
      if (tq && !why && split_relation(row.slice(0, tq.index))) { why = clean_why(tq[1]); row = row.slice(0, tq.index); }
      // a condition after a comma (x + 2, x ≠ 2) is said in words, beside the reason
      const cond = /,\s*(?:\\q?quad\s*)*\(?\s*([a-zA-Z]\s*(?:\\neq|\\ne|\\geq|\\leq|\\ge|\\le|>|<|≠|≥|≤)\s*-?[\w.\\{}]+)\s*\)?\s*$/.exec(row);
      if (cond) {
        const words = cond[1].replace(/\\neq|\\ne/g, '≠').replace(/\\geq|\\ge/g, '≥').replace(/\\leq|\\le/g, '≤').replace(/\s+/g, ' ');
        why = why ? `${why} (${words})` : words;
        row = row.slice(0, cond.index);
      }
      row = split_top(row, '&').join('').replace(/\\(?:nonumber|notag)\b/g, '').replace(/\\(?:tag|label)\{[^}]*\}/g, '');
      row = row.replace(/^\s*(?:\\Rightarrow|\\implies|\\therefore|\\Longrightarrow|⇒|∴)\s*/, '').replace(/\s*[.,;。，；]\s*$/, '').trim();
      if (!row) continue;
      // `= ...` continues the line before: its left side again (an expression being rewritten has none)
      const cont = /^(=|\\approx|\\equiv|≈)\s*/.exec(row);
      if (cont) {
        const prev = lines[lines.length - 1];
        const sp = prev ? split_relation(prev.tex) : null;
        row = row.slice(cont[0].length).trim();
        if (sp && prev) row = `${sp[0]} ${cont[1] === '=' ? '=' : cont[1]} ${row}`;
      }
      lines.push({ tex: row.replace(/\s+/g, ' '), why });
    }
  }
  // "A = B / B = C / C = D" (each line starting where the last one ended) is the expression A rewritten: A, B, C, D
  const flat = (t: string) => t.replace(/\\(?:left|right)(?![a-zA-Z])|\s+/g, '');
  const sides = lines.map((l) => split_relation(l.tex));
  if (lines.length >= 2 && sides.every((x) => x && x[1] === '=') && sides.slice(1).every((x, i) => flat(x![0]) === flat(sides[i]![2]))) {
    const chain: StepLine[] = [{ tex: sides[0]![0], why: null }, { tex: sides[0]![2], why: lines[0].why }];
    for (let i = 1; i < lines.length; i++) chain.push({ tex: sides[i]![2], why: lines[i].why });
    lines.splice(0, lines.length, ...chain);
  }
  if (lines.length < 2) issues.push(lines.length ? 'only one line: a derivation needs two or more' : 'no lines');
  if (lines.length > 10) { issues.push(`${lines.length} lines: at most 10 are shown`); lines.length = 10; }
  for (let i = 1; i < lines.length; i++) if (lines[i].tex === lines[i - 1].tex) issues.push(`line ${i + 1} is the same as line ${i}`);
  return { lines, issues };
}

// ------------------------------------------------------------------ tokens

const RELATIONS = new Set(['=', '≠', '<', '>', '≤', '≥', '⩽', '⩾', '≈', '≡', '∼', '≃', '≅', '∝', '→', '⟶', '⇒', '⟹', '⇔', '⟺', '↔', '⟷', '⇌', '⇄', '∈', '⊂', '⊆', '≔']);

/** One token of a typeset line: what it is (`key`) and the ink that draws it. */
export interface Token {
  /** What it is: its characters (NFKC: 𝑥 → x), '11', 'sin', 'kg'; a rule is '▭' and its structure ('▭mfrac'). */
  key: string;
  /** mi / mn / mo / mtext / ms, or 'rule'. */
  kind: string;
  glyphs: TexGlyph[];
  /** Extent in TeX units, y down, baseline at 0. */
  box: [number, number, number, number];
  relation: boolean;
}
export interface TexLine {
  tex: string;
  tokens: Token[];
  /** Ink extent [x, y, w, h] in TeX units (as tex_shape's). */
  view: [number, number, number, number];
  /** Index of the main relation token (=, →, ≤ …), or -1. */
  anchor: number;
  error: string | null;
}
const center = (t: Token): number => (t.box[0] + t.box[2]) / 2;

/** Lines typeset so far, by their TeX (checking a block and drawing it typeset each line once). */
const typeset_cache = new Map<string, TexLine>();
/** Typeset a line and cut it into tokens: one per token node (a number, a name, an operator, a word), one per rule. */
export function typeset_line(tex: string): TexLine {
  const hit = typeset_cache.get(tex);
  if (hit) return hit;
  const t = typeset_uncached(tex);
  if (typeset_cache.size > 800) typeset_cache.clear();
  if (!t.error) typeset_cache.set(tex, t);
  return t;
}
function typeset_uncached(tex: string): TexLine {
  let r: ReturnType<typeof tex_glyphs>;
  try {
    r = tex_glyphs(tex);
  } catch (e) {
    return { tex, tokens: [], view: [0, -8, 10, 10], anchor: -1, error: String((e as Error)?.message ?? e).slice(0, 160) };
  }
  const tokens: Token[] = [], by_leaf = new Map<number, Token>();
  for (const g of r.glyphs) {
    let t = g.leaf >= 0 ? by_leaf.get(g.leaf) : undefined;
    if (!t) {
      const kind = g.leaf >= 0 ? g.leaf_kind : 'rule';
      t = { key: '', kind, glyphs: [], box: [Infinity, Infinity, -Infinity, -Infinity], relation: false };
      tokens.push(t);
      if (g.leaf >= 0) by_leaf.set(g.leaf, t);
      else t.key = (g.rect ? '▭' : '·') + (g.chain[g.chain.length - 1] ?? '');
    }
    t.glyphs.push(g);
    if (g.leaf >= 0) { const c = g.c ?? '·', n = c.normalize('NFKC'); t.key += n.startsWith(' ') ? c : n; } // (𝑥 → x, but ¯ stays ¯)
    t.box = [Math.min(t.box[0], g.box[0]), Math.min(t.box[1], g.box[1]), Math.max(t.box[2], g.box[2]), Math.max(t.box[3], g.box[3])];
  }
  let anchor = -1, depth = Infinity;
  tokens.forEach((t, i) => {
    t.relation = t.kind === 'mo' && RELATIONS.has(t.key);
    const d = t.glyphs[0].chain.length;
    if (t.relation && d < depth) { anchor = i; depth = d; }
  });
  return { tex, tokens, view: r.view, anchor, error: null };
}

// ------------------------------------------------------------------ matching one line to the next

export type Role = 'keep' | 'move' | 'merge' | 'cancel' | 'appear';
export interface Transition {
  /** Per token of the first line: what it does, and the token of the second line it becomes (-1: it goes). */
  from: { role: Role; to: number }[];
  /** Per token of the second line: what brought it, and from which tokens of the first. */
  to: { role: Role; from: number[] }[];
  /** Too little in common to follow token by token: the line is replaced as a whole (and the check says so). */
  jump: boolean;
  /** The share of tokens that stay or travel (0..1). */
  kept: number;
}
const OPERATOR_KINDS = new Set(['mo']);
/** x of a token relative to its line's relation (or its middle), TeX units: what "the same place" means across lines. */
function rel_x(L: TexLine, i: number): number {
  const ref = L.anchor >= 0 ? center(L.tokens[L.anchor]) : L.view[0] + L.view[2] / 2;
  return center(L.tokens[i]) - ref;
}
/** Where a token sits in the formula's structure: inside which fractions, roots, scripts, and at what size. */
const STRUCTURE = new Set(['mfrac', 'msqrt', 'mroot', 'msup', 'msub', 'msubsup', 'munder', 'mover', 'munderover', 'mtable', 'menclose']);
function place_of(t: Token): string {
  const g = t.glyphs[0];
  return g.chain.filter((c) => STRUCTURE.has(c)).join('/') + '@' + Math.round(Math.log(g.size ?? 1) / Math.log(0.707));
}
/**
 * The longest common run of equal keys, as index pairs. Ties go, in order, to a pair whose neighbours before them
 * match too (reading order: a new term is written after the old ones, so "+ 3" keeps its 3 and "− 3" is the new
 * one), to a pair in the same place in the structure (an exponent stays an exponent), then to tokens nearer each other.
 */
function lcs(A: TexLine, ia: number[], B: TexLine, ib: number[]): [number, number][] {
  const n = ia.length, m = ib.length;
  const S: Float64Array[] = Array.from({ length: n + 1 }, () => new Float64Array(m + 1));
  const w = (i: number, j: number) => {
    const a = A.tokens[ia[i]], b = B.tokens[ib[j]];
    if (a.key !== b.key) return -1;
    const before = i > 0 && j > 0 && A.tokens[ia[i - 1]].key === B.tokens[ib[j - 1]].key ? 0.04 : 0;
    const same_place = place_of(a) === place_of(b) ? 0.02 : 0;
    return 1 + before + same_place + 0.005 * Math.exp(-Math.abs(rel_x(A, ia[i]) - rel_x(B, ib[j])) / 20);
  };
  for (let i = 1; i <= n; i++)
    for (let j = 1; j <= m; j++) {
      const d = w(i - 1, j - 1);
      S[i][j] = Math.max(S[i - 1][j], S[i][j - 1], d > 0 ? S[i - 1][j - 1] + d : -Infinity);
    }
  const out: [number, number][] = [];
  for (let i = n, j = m; i > 0 && j > 0;) {
    const d = w(i - 1, j - 1);
    if (d > 0 && Math.abs(S[i][j] - (S[i - 1][j - 1] + d)) < 1e-9) { out.push([ia[i - 1], ib[j - 1]]); i--; j--; }
    else if (S[i - 1][j] >= S[i][j - 1]) i--;
    else j--;
  }
  return out.reverse();
}

/**
 * How the tokens of line A become those of line B. Tokens with the same key in the same order stay (each side of the
 * relation on its own, so nothing slides under the = sign); a token whose twin is elsewhere travels (an operator
 * travels with the token it stands before: + 3 over the = becomes − 3); between two tokens that stay, what is left of A
 * flows into what is new in B (a merge), vanishes (a cancel) or what is new appears.
 */
export function match_lines(A: TexLine, B: TexLine): Transition {
  const na = A.tokens.length, nb = B.tokens.length;
  const from = A.tokens.map(() => ({ role: 'cancel' as Role, to: -1 }));
  const to = B.tokens.map(() => ({ role: 'appear' as Role, from: [] as number[] }));
  const pair = (i: number, j: number, role: Role) => { from[i] = { role, to: j }; to[j] = { role, from: [i] }; };
  const range = (a: number, b: number) => Array.from({ length: Math.max(0, b - a) }, (_, k) => a + k);
  // 1. what stays: each side of the relation on its own, the relations with each other
  let keep: [number, number][];
  if (A.anchor >= 0 && B.anchor >= 0 && A.tokens[A.anchor].key === B.tokens[B.anchor].key)
    keep = [...lcs(A, range(0, A.anchor), B, range(0, B.anchor)), [A.anchor, B.anchor], ...lcs(A, range(A.anchor + 1, na), B, range(B.anchor + 1, nb))];
  else keep = lcs(A, range(0, na), B, range(0, nb));
  for (const [i, j] of keep) pair(i, j, 'keep');
  const free_a = () => range(0, na).filter((i) => from[i].to < 0), free_b = () => range(0, nb).filter((j) => !to[j].from.length);
  // 2. what travels: the same thing elsewhere (names, numbers, words first; then the operators beside them)
  const travel = (ok: (i: number, j: number) => boolean) => {
    // (nearest first, and a token rather keeps its place in the structure: an exponent travels to an exponent)
    const cand: [number, number, number][] = [];
    for (const i of free_a()) for (const j of free_b()) if (A.tokens[i].key === B.tokens[j].key && ok(i, j)) cand.push([Math.abs(rel_x(A, i) - rel_x(B, j)) + (place_of(A.tokens[i]) === place_of(B.tokens[j]) ? 0 : 50), i, j]);
    cand.sort((a, b) => a[0] - b[0]);
    for (const [, i, j] of cand) if (from[i].to < 0 && !to[j].from.length) pair(i, j, 'move');
  };
  travel((i) => !OPERATOR_KINDS.has(A.tokens[i].kind) && A.tokens[i].kind !== 'rule');
  // an operator just before a travelling token travels with it, and may change on the way (+ → −, × → ÷)
  for (let i = 0; i < na; i++) {
    if (from[i].role !== 'move') continue;
    const j = from[i].to, pi = i - 1, pj = j - 1;
    if (pi >= 0 && pj >= 0 && from[pi].to < 0 && !to[pj].from.length && A.tokens[pi].kind === 'mo' && B.tokens[pj].kind === 'mo' && !A.tokens[pi].relation && !B.tokens[pj].relation) pair(pi, pj, 'move');
  }
  // an operator or a rule left alone on both sides (a bracket, a fraction's bar) travels to its twin
  travel((i) => { const k = A.tokens[i].key; return free_a().filter((x) => A.tokens[x].key === k).length === 1 && free_b().filter((y) => B.tokens[y].key === k).length === 1; });
  // 3. between two tokens that stay: what is left flows into what is new, vanishes, or appears
  const anchors: [number, number][] = [[-1, -1], ...range(0, na).filter((i) => from[i].role === 'keep').map((i) => [i, from[i].to] as [number, number]), [na, nb]];
  for (let k = 1; k < anchors.length; k++) {
    const [a0, b0] = anchors[k - 1], [a1, b1] = anchors[k];
    const O = range(a0 + 1, a1).filter((i) => from[i].to < 0), N = range(b0 + 1, b1).filter((j) => !to[j].from.length);
    if (!O.length || !N.length) continue;                        // (alone they cancel, or appear: the defaults)
    for (const i of O) {
      let best = N[0], d = Infinity;
      for (const j of N) { const dj = Math.abs(rel_x(A, i) - rel_x(B, j)); if (dj < d) { d = dj; best = j; } }
      from[i] = { role: 'merge', to: best };
    }
    for (const j of N) to[j] = { role: 'merge', from: O.filter((i) => from[i].to === j).length ? O.filter((i) => from[i].to === j) : O };
  }
  const kept_n = from.filter((f) => f.role === 'keep' || f.role === 'move').length, kept = kept_n / Math.max(1, na, nb);
  // too much at once to follow: nothing stays, or much is replaced by something new in several places with little
  // left to hold on to. A change in one place can be followed however big (a power worked out to a number); so can
  // a cancel on one side and a sum worked out on the other; so can terms that only vanish
  const replaced = to.filter((t) => t.role === 'merge' || t.role === 'appear').length;
  let places = 0;
  for (let k = 1; k < anchors.length; k++) {
    const [a0, b0] = anchors[k - 1], [a1, b1] = anchors[k];
    if (range(b0 + 1, b1).some((j) => to[j].role === 'merge' || to[j].role === 'appear') || range(a0 + 1, a1).some((i) => from[i].role === 'merge')) places++;
  }
  const jump = Math.max(na, nb) >= 4 && (kept_n === 0 || (kept < 0.25 && replaced >= 3 && places >= 2));
  return { from, to, jump, kept };
}

// ------------------------------------------------------------------ drawing

const smooth = (a: number, b: number, x: number): number => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const ease = (u: number): number => smooth(0, 1, u);
const lerp = (a: number, b: number, u: number): number => a + (b - a) * u;

/** A token's ink at a moment: where its glyphs are moved to (TeX units), how big, how present. */
interface Piece { glyphs: TexGlyph[]; dx: number; dy: number; scale: number; cx: number; cy: number; w: number; color: string | null; liquid: boolean }

/**
 * A derivation as one formula that changes line by line. `at` is where it is: 2 is the third line at rest, 1.4 is
 * on the way from the second to the third. A figure's script moves it (set(steps.at, k)); steps_figure() makes the
 * whole figure. Each line's reason, when it has one, is written under the formula.
 */
export class Steps extends Thing implements Block {
  kind = 'steps';
  readonly lines: StepLine[];
  readonly typeset: TexLine[];
  readonly moves: Transition[];
  readonly at: Param<number>;
  readonly issues: string[];
  /** Show each line's reason under the formula. */
  show_why: boolean;
  private paths = new Map<TexGlyph, Path2D>();
  private px_set: number | null;
  private px_fit = 0;
  /** Lines (1-based) that do not follow from the one before (review_steps): marked, while they rest, with a hollow ring. */
  doubtful: number[] = [];
  /** Fill a stage (the lesson's video frame): as large as the stage allows, in its middle; else the size of a displayed formula in a text. */
  fill: boolean;
  constructor(src: string | StepLine[], o: { id?: string; size?: number; why?: boolean; role?: string; style?: Style; doubtful?: number[]; fill?: boolean } = {}) {
    super({ id: o.id ?? 'steps', role: o.role ?? 'text', z: 5, style: o.style });
    const p = typeof src === 'string' ? parse_steps(src) : { lines: src, issues: [] };
    this.lines = p.lines;
    this.issues = [...p.issues];
    this.typeset = this.lines.map((l) => typeset_line(l.tex));
    this.typeset.forEach((t, i) => { if (t.error) this.issues.push(`line ${i + 1} does not typeset: ${t.error}`); });
    this.moves = this.typeset.slice(1).map((b, i) => match_lines(this.typeset[i], b));
    this.at = param(0, { name: (o.id ?? 'steps') + '.at', range: [0, Math.max(0, this.lines.length - 1)] });
    this.show_why = o.why ?? this.lines.some((l) => l.why);
    this.px_set = o.size ?? null;
    this.doubtful = o.doubtful ?? [];
    this.fill = !!o.fill;
  }
  // ---- geometry (TeX units): every line placed so that the relations line up (or the middles, where a line has none)
  private geo: { X: number; W: number; asc: number; desc: number; ox: number[] } | null = null;
  private geometry(): { X: number; W: number; asc: number; desc: number; ox: number[] } {
    if (this.geo) return this.geo;
    const T = this.typeset, has = T.some((t) => t.anchor >= 0);
    let left = 0, right = 0, asc = 0, desc = 0;
    for (const t of T) {
      const [x, y, w, h] = t.view;
      asc = Math.max(asc, -y); desc = Math.max(desc, y + h);
      if (t.anchor >= 0) { const a = center(t.tokens[t.anchor]); left = Math.max(left, a - x); right = Math.max(right, x + w - a); }
    }
    const widest = Math.max(...T.map((t) => t.view[2]), 1);
    if (!has) { left = widest / 2; right = widest / 2; }
    let W = left + right;
    W = Math.max(W, widest);
    const X = has ? left + (W - left - right) / 2 : W / 2;
    const ox = T.map((t) => (t.anchor >= 0 ? X - center(t.tokens[t.anchor]) : X - (t.view[0] + t.view[2] / 2)));
    return (this.geo = { X, W, asc, desc, ox });
  }
  /** Formula size (px): its own, or smaller when the slot is too narrow (never below the label size). */
  private px(): number {
    return this.px_set ?? (this.px_fit || look().type.display.size * 0.82);
  }
  /** The reasons' type: the caption's, larger on a stage with a large formula (it stays about half the formula's size). */
  private why_font() {
    const c = look().type.caption.size;
    return font_of('caption', this.fill ? { size: Math.round(Math.max(c, Math.min(c * 1.5, this.px() * 0.48))) } : {});
  }
  private why_px(): number {
    return this.why_font().size;
  }
  private why_h(w: number, _lang: Lang): number {
    if (!this.show_why) return 0;
    const f = this.why_font(), lines = Math.max(1, ...this.lines.map((l) => (l.why ? break_lines(l.why, f, w).length : 1)));
    return lines * f.size * look().type.caption.line + this.why_px() * 0.5;
  }
  /** Height of the formula and its reasons at the size it is set (px). */
  private content_h(w: number, lang: Lang): number {
    const G = this.geometry();
    return (G.asc + G.desc) * tex_scale(this.px()) + this.px() * 0.5 + this.why_h(w, lang);
  }
  measure(w: number, env: LayoutEnv): Size {
    const G = this.geometry();
    // in a text: a displayed formula's size, smaller when the column is narrow; on a stage: as large as the width allows
    const own = this.px_set ?? (this.fill ? look().type.display.size * 1.6 : look().type.display.size * 0.82);
    const fit = Math.max(look().type.label.size, Math.min(own, ((this.fill ? 0.86 : 1) * w - 8) / (G.W * tex_scale(1))));
    this.px_fit = this.px_set ? 0 : fit;
    const h = this.content_h(w, env.lang);
    return this.fill ? { h, min: Math.min(h, this.px() * 2), grow: true } : { h, min: h };
  }
  arrange(b: Box, env: LayoutEnv): void {
    this.measure(b.w, env);
    if (this.fill && !this.px_set) {
      // as large as the stage's height allows too (the formula and its reasons in four fifths of it), in its middle
      const G = this.geometry(), per_px = (G.asc + G.desc) * tex_scale(1) + 0.5, room = b.h * 0.8 - this.why_h(b.w, env.lang);
      if (room > 0 && per_px * this.px_fit > room) this.px_fit = Math.max(look().type.label.size, room / per_px);
    }
    const G = this.geometry(), k = tex_scale(this.px()), h = this.content_h(b.w, env.lang);
    const w = Math.min(b.w, G.W * k);
    this.box = { x: b.x + (b.w - w) / 2, y: this.fill ? b.y + Math.max(0, (b.h - h) / 2) : b.y, w, h };
    this.why_w = b.w;
    this.why_x = b.x;
  }
  private why_w = 0;
  private why_x = 0;
  things(): Thing[] {
    return [this];
  }
  label(): string {
    return `steps '${this.id}' (${this.lines.length} lines)`;
  }
  override text(): string {
    const k = Math.round(untracked(() => this.at.value));
    const l = this.lines[k];
    return l ? `${l.tex}${l.why ? ` (${l.why})` : ''}` : '';
  }
  override text_px(): number {
    return this.px();
  }
  override parts_of = (_lang: Lang) => {
    const k = Math.round(untracked(() => this.at.value)), l = this.lines[k];
    if (!l) return [];
    const G = this.geometry(), kk = tex_scale(this.px());
    const out: { text: string; tex?: boolean; box: Box }[] = [{ text: l.tex, tex: true, box: { x: this.box.x, y: this.box.y, w: this.box.w, h: (G.asc + G.desc) * kk + this.px() * 0.5 } }];
    if (this.show_why && l.why) out.push({ text: l.why, box: { x: this.why_x, y: this.box.y + (G.asc + G.desc) * kk + this.px() * 0.5, w: this.why_w, h: this.why_h(this.why_w, _lang) } });
    return out;
  };
  /** Where the formula's TeX origin is (px) and px per TeX unit. */
  private frame_of(): { x0: number; y0: number; k: number } {
    const G = this.geometry(), k = tex_scale(this.px());
    return { x0: this.box.x + (this.box.w - G.W * k) / 2, y0: this.box.y + this.px() * 0.25 + G.asc * k, k };
  }
  /**
   * The script's step that takes the formula to line k (counting from 0) in `dur` seconds: put it beside other changes
   * of the figure in together(...), and a beat() before it, so the narration's § reaches the line as the picture does.
   */
  go(k: number, dur = 1.3): Step {
    return set(this.at, Math.max(0, Math.min(this.lines.length - 1, k)), 'travel', dur);
  }
  /** Where line k's TeX origin is drawn at rest (px) and px per TeX unit: draw_tex(g, tex, x + view.x·k, y, px) draws the same. */
  origin(line: number): { x: number; y: number; k: number; px: number } {
    const f = this.frame_of(), G = this.geometry();
    return { x: f.x0 + G.ox[line] * f.k, y: f.y0, k: f.k, px: this.px() };
  }
  private path(g: TexGlyph): Path2D {
    let p = this.paths.get(g);
    if (!p) {
      const P = (globalThis as { Path2D?: typeof Path2D }).Path2D!;
      p = new P(g.d ?? '');
      this.paths.set(g, p);
    }
    return p;
  }
  /** The pieces of ink at a = line k + u (TeX units, before the line's offset is applied: dx includes it). */
  pieces(v: number): Piece[] {
    const n = this.lines.length, G = this.geometry();
    const k = Math.max(0, Math.min(n - 1, Math.floor(v + 1e-9))), u = Math.min(1, Math.max(0, v - k));
    const A = this.typeset[k];
    const piece = (t: Token, ox: number, extra: Partial<Piece> = {}): Piece => ({ glyphs: t.glyphs, dx: ox, dy: 0, scale: 1, cx: center(t), cy: (t.box[1] + t.box[3]) / 2, w: 1, color: t.glyphs[0].fill, liquid: false, ...extra });
    if (u < 1e-6 || k >= n - 1) return A.tokens.map((t) => piece(t, G.ox[k]));
    const B = this.typeset[k + 1], M = this.moves[k], oa = G.ox[k], ob = G.ox[k + 1];
    if (M.jump) return [...A.tokens.map((t) => piece(t, oa, { w: 1 - smooth(0.15, 0.6, u) })), ...B.tokens.map((t) => piece(t, ob, { w: smooth(0.4, 0.85, u) }))];
    const out: Piece[] = [];
    const lineh = G.asc + G.desc;
    // where a group that cancels gathers: the middle of its ink
    const gather = new Map<number, number>();
    const cancels = M.from.map((f, i) => (f.role === 'cancel' ? i : -1)).filter((i) => i >= 0);
    for (const i of cancels) {
      const run = cancels.filter((x) => Math.abs(x - i) <= 3);
      gather.set(i, run.reduce((s, x) => s + center(A.tokens[x]), 0) / run.length);
    }
    A.tokens.forEach((t, i) => {
      const f = M.from[i];
      if (f.role === 'keep' || f.role === 'move') {
        const b = B.tokens[f.to], e = ease(smooth(0.05, 0.95, u));
        const x0 = oa + center(t), x1 = ob + center(b);
        const crosses = A.anchor >= 0 && B.anchor >= 0 && f.role === 'move' && Math.sign(rel_x(A, i)) !== Math.sign(rel_x(B, f.to));
        const dy = crosses ? -Math.sin(Math.PI * e) * lineh * 0.75 : 0;
        const changes = b.key !== t.key;
        const dyb = ((b.box[1] + b.box[3]) - (t.box[1] + t.box[3])) / 2;
        if (!changes) out.push(piece(t, lerp(x0, x1, e) - center(t), { dy: dy + dyb * e }));
        else {
          // it changes on the way (+ → −): the old shape gives way to the new one as it arrives
          const s = smooth(0.45, 0.8, u);
          out.push(piece(t, lerp(x0, x1, e) - center(t), { dy: dy + dyb * e, w: 1 - s }));
          out.push(piece(b, lerp(x0, x1, e) - center(b), { dy: dy - dyb * (1 - e), w: s }));
        }
      } else if (f.role === 'merge') {
        // what flows into a new token travels to it, shrinking, and is gone as it arrives
        const b = B.tokens[f.to], e = ease(smooth(0, 0.55, u));
        const x1 = ob + center(b);
        out.push(piece(t, lerp(oa + center(t), x1, e) - center(t), { dy: (((b.box[1] + b.box[3]) - (t.box[1] + t.box[3])) / 2) * e, scale: 1 - 0.25 * e, w: 1 - smooth(0.4, 0.66, u), liquid: true }));
      } else {
        const c = gather.get(i) ?? center(t), e = ease(smooth(0, 0.55, u));
        out.push(piece(t, oa + lerp(center(t), c, e) - center(t), { scale: 1 - 0.4 * e, w: 1 - smooth(0.3, 0.62, u), liquid: true }));
      }
    });
    B.tokens.forEach((t, j) => {
      const r = M.to[j].role;
      if (r === 'merge') out.push(piece(t, ob, { w: smooth(0.45, 0.76, u), scale: lerp(0.8, 1, smooth(0.45, 0.95, u)), liquid: true }));
      else if (r === 'appear') out.push(piece(t, ob, { w: smooth(0.35, 0.8, u), scale: lerp(0.85, 1, smooth(0.35, 1, u)) }));
    });
    return out;
  }
  /**
   * Draw a piece; `swell` (CSS px) thickens every stroke by that much on each side (the liquid's ink, before its
   * blur); `only` draws just its paths or just its rules (at rest a line is drawn in tex_to_svg's order: paths, then rules).
   */
  private draw_piece(g: CanvasRenderingContext2D, p: Piece, x0: number, y0: number, k: number, color: string, alpha: number, swell = 0, only: 'paths' | 'rules' | null = null): void {
    g.save();
    g.translate(x0 + (p.dx + p.cx) * k, y0 + (p.dy + p.cy) * k);
    g.scale(k * p.scale, k * p.scale);
    g.translate(-p.cx, -p.cy);
    g.globalAlpha = alpha;
    const lw = (2 * swell) / (k * p.scale);
    for (const gl of p.glyphs) {
      if (only && (only === 'rules') !== !!gl.rect) continue;
      g.fillStyle = g.strokeStyle = gl.fill ?? p.color ?? color;
      if (gl.text) {
        // a character the TeX fonts lack (Chinese): the page's serif, at MathJax's size and place
        g.font = `${gl.font_size}px ${look().fonts.serif}`;
        g.textBaseline = 'alphabetic';
        g.fillText(gl.text, gl.at![0], gl.at![1]);
      } else if (gl.rect) {
        g.fillRect(gl.rect[0], gl.rect[1], gl.rect[2], gl.rect[3]);
        if (swell) { g.lineWidth = lw; g.lineJoin = 'round'; g.strokeRect(gl.rect[0], gl.rect[1], gl.rect[2], gl.rect[3]); }
      } else {
        g.fill(this.path(gl));
        if (swell) { g.lineWidth = lw; g.lineJoin = 'round'; g.stroke(this.path(gl)); }
      }
    }
    g.restore();
  }
  draw(env: DrawEnv): void {
    const g = env.g as CanvasRenderingContext2D, v = this.at.value;
    const { x0, y0, k } = this.frame_of(), color = this.text_color;
    const ps = this.pieces(v), n = this.lines.length, kk = Math.max(0, Math.min(n - 1, Math.floor(v + 1e-9))), u = v - kk;
    const live = u > 1e-6 && kk < n - 1 ? Math.sin(Math.PI * u) : 0;
    // every piece is drawn as itself (its weight never changes); what flows together or cancels out also gets, while
    // the pieces meet, the ink between them: their field blurred and cut at half strength, so they join into one drop
    // for a moment instead of overlapping as outlines. At rest there is none of it.
    // (the bridge first, under the pieces: it is computed at half resolution, and the glyphs' own edges stay sharp on top)
    const drop = u > 1e-6 && kk < n - 1 ? Math.sin(Math.PI * smooth(0.3, 0.75, u)) : 0;
    const liquid = ps.filter((p) => p.liquid && p.w > 0.05);
    if (liquid.length > 1 && drop > 0.05) this.draw_liquid(g, liquid, x0, y0, k, color, drop, env.dpr);
    if (live === 0) { for (const only of ['paths', 'rules'] as const) for (const p of ps) this.draw_piece(g, p, x0, y0, k, color, 1, 0, only); }
    else for (const p of ps) if (p.w > 0.002) this.draw_piece(g, p, x0, y0, k, color, p.w);
    // a line that does not follow from the one before: a hollow ring before it (not established), while it rests
    const resting = u < 1e-6 || kk >= n - 1 ? kk : -1;
    if (resting >= 0 && this.doubtful.includes(resting + 1)) {
      const G = this.geometry(), T = this.typeset[resting], left = x0 + (G.ox[resting] + T.view[0]) * k;
      g.save();
      g.strokeStyle = env.look.palette.ink2; // (vermilion is the one action; a doubt is hollow ink)
      g.lineWidth = 1.6;
      g.beginPath();
      g.arc(left - this.px() * 0.55, y0 - this.px() * 0.3, this.px() * 0.16, 0, Math.PI * 2);
      g.stroke();
      g.restore();
    }
    // the reason under the formula: the line's own at rest, the next one's taking over on the way
    if (this.show_why) {
      const f = this.why_font(), G = this.geometry(), top = this.box.y + (G.asc + G.desc) * k + this.px() * 0.5 + this.why_px() * 0.2;
      const say = (s: string | null, a: number) => {
        if (!s || a < 0.01) return;
        g.save();
        g.globalAlpha = a;
        g.font = font_css(f);
        g.fillStyle = env.look.palette.ink2;
        g.textBaseline = 'top';
        const ls = break_lines(s, f, this.why_w);
        ls.forEach((l, i) => g.fillText(l.spans.map((x) => x.s).join(''), this.why_x + (this.why_w - l.width) / 2, top + i * f.size * look().type.caption.line));
        g.restore();
      };
      if (u > 1e-6 && kk < n - 1) { say(this.lines[kk].why, 1 - smooth(0, 0.5, u)); say(this.lines[kk + 1].why, smooth(0.5, 1, u)); }
      else say(this.lines[kk].why, 1);
    }
  }
  private draw_liquid(g: CanvasRenderingContext2D, ps: Piece[], x0: number, y0: number, k: number, color: string, drop: number, dpr: number): void {
    // the region the liquid pieces cover (device px), with room for the blur
    let a = Infinity, b = Infinity, c = -Infinity, d = -Infinity;
    for (const p of ps) for (const gl of p.glyphs) {
      const s = k * p.scale, X = (x: number) => x0 + (p.dx + p.cx) * k + (x - p.cx) * s, Y = (y: number) => y0 + (p.dy + p.cy) * k + (y - p.cy) * s;
      a = Math.min(a, X(gl.box[0])); c = Math.max(c, X(gl.box[2])); b = Math.min(b, Y(gl.box[1])); d = Math.max(d, Y(gl.box[3]));
    }
    // computed at half the device resolution (a quarter of the pixels: it is soft, and the pieces are drawn sharp over it)
    const S = 0.5, ds = dpr * S;
    const r = Math.max(0.5, this.px() * ds * 0.07 * drop), pad = Math.ceil(r * 3 + 2);
    const L = Math.floor(a * ds) - pad, T = Math.floor(b * ds) - pad, W = Math.ceil(c * ds) + pad - L, H = Math.ceil(d * ds) + pad - T;
    if (!(W > 0 && H > 0) || W * H > 2e6) return;
    // (one canvas and one buffer, kept and grown: a change's frames reuse them)
    if (!this.liq || this.liq.cv.width < W || this.liq.cv.height < H) {
      const cv = make_canvas(Math.max(W, this.liq?.cv.width ?? 0), Math.max(H, this.liq?.cv.height ?? 0)) as unknown as HTMLCanvasElement;
      this.liq = { cv, q: cv.getContext('2d', { willReadFrequently: true }) as CanvasRenderingContext2D, al: new Float32Array(0) };
    }
    const { cv, q } = this.liq;
    if (this.liq.al.length < W * H) this.liq.al = new Float32Array(W * H);
    const al = this.liq.al;
    q.setTransform(1, 0, 0, 1, 0, 0);
    q.clearRect(0, 0, W, H);
    q.setTransform(ds, 0, 0, ds, -L, -T);
    for (const p of ps) this.draw_piece(q, p, x0, y0, k, '#000', Math.min(1, p.w), 0.3 / S);
    const img = q.getImageData(0, 0, W, H), px = img.data;
    for (let i = 0; i < W * H; i++) al[i] = px[i * 4 + 3] / 255;
    blur(al, W, H, r);
    // cut at half strength, with a soft rim (the anti-aliasing of the cut)
    const [cr, cg, cb] = hex_rgb(color);
    for (let i = 0; i < W * H; i++) {
      const v = smooth(0.44, 0.56, al[i]) * Math.min(1, drop * 1.2);
      px[i * 4] = cr; px[i * 4 + 1] = cg; px[i * 4 + 2] = cb; px[i * 4 + 3] = Math.round(v * 255);
    }
    q.setTransform(1, 0, 0, 1, 0, 0);
    q.putImageData(img, 0, 0);
    g.save();
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.imageSmoothingEnabled = true;
    g.drawImage(cv as unknown as CanvasImageSource, 0, 0, W, H, L / S, T / S, W / S, H / S);
    g.restore();
  }
  private liq: { cv: HTMLCanvasElement; q: CanvasRenderingContext2D; al: Float32Array } | null = null;
}
function hex_rgb(c: string): [number, number, number] {
  const m = /^#?([0-9a-f]{6})/i.exec(c.trim());
  if (m) { const n = parseInt(m[1], 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }
  const r = /rgba?\(([\d.]+)[ ,]+([\d.]+)[ ,]+([\d.]+)/.exec(c);
  return r ? [+r[1], +r[2], +r[3]] : [17, 17, 19];
}
/** A Gaussian-like blur of a strength field: three box blurs each way. */
let blur_tmp = new Float32Array(0);
export function blur(a: Float32Array, W: number, H: number, r: number): void {
  if (blur_tmp.length < Math.max(W, H)) blur_tmp = new Float32Array(Math.max(W, H));
  const rad = Math.max(1, Math.round(r / 1.7)), tmp = blur_tmp;
  for (let pass = 0; pass < 3; pass++) {
    for (let y = 0; y < H; y++) box1(a, y * W, 1, W, rad, tmp);
    for (let x = 0; x < W; x++) box1(a, x, W, H, rad, tmp);
  }
}
function box1(a: Float32Array, o: number, s: number, n: number, r: number, tmp: Float32Array): void {
  let acc = 0;
  const at = (i: number) => (i < 0 || i >= n ? 0 : a[o + i * s]);
  for (let i = -r; i <= r; i++) acc += at(i);
  for (let i = 0; i < n; i++) {
    tmp[i] = acc / (2 * r + 1);
    acc += at(i + r + 1) - at(i - r);
  }
  for (let i = 0; i < n; i++) a[o + i * s] = tmp[i];
}

// ------------------------------------------------------------------ the whole figure

/**
 * A figure that walks through a derivation: each line held, then the change to the next (one beat of the script per
 * line, so a voice or a click can step through them). `per_step` is the change's length, `hold` the rest on each line.
 */
export function steps_figure(src: string | StepLine[], o: { lang?: Lang; per_step?: number; hold?: number; size?: number; why?: boolean; paper?: boolean; fill?: boolean } = {}): Figure & { derivation: Steps } {
  const fig = new Figure({ lang: o.lang ?? 'en' }) as Figure & { derivation: Steps };
  if (o.paper === false) fig.paper = 'clear';
  // (on a stage - paper behind it - it fills the stage; in a text it is the size of a displayed formula)
  const st = new Steps(src, { id: 'steps', size: o.size, why: o.why, fill: o.fill ?? o.paper !== false });
  fig.derivation = st;
  // (in a text it is part of the text: no margin of its own)
  fig.layout(column([st]), o.paper === false ? { pad: 2 } : {});
  const per = o.per_step ?? 1.3, hold = o.hold ?? 1.1;
  const script: Step[] = [wait(hold * 0.6)];
  for (let k = 1; k < st.lines.length; k++) script.push(beat(), set(st.at, k, 'travel', per), wait(hold));
  fig.script(...script);
  fig.check('every line typesets', () => (st.typeset.find((t) => t.error) ? st.issues.find((s) => s.includes('typeset')) ?? 'a line does not typeset' : null));
  return fig;
}
/** A line's ink at rest, for checks: the glyph pieces of line k as tex_to_svg draws them. */
export const rest_pieces = (st: Steps, k: number) => untracked(() => st.pieces(k));
export const read_at = (st: Steps): number => read(st.at);
