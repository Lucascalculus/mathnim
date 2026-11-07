// A formula taken apart (分解的公式; the specimen's gpu/int/explode.js, ported with its look and motion, 2026-11-07). A
// formula is an assembly, and it can be drawn the way an engineer draws one. Pull it apart (or tap it) and the camera
// turns to the house view while each block lifts on its own card, straight up along one axis; light from straight
// above leaves each card's shadow where it sat, so the paper keeps the assembled formula; a leader runs from each card
// to what it means. Let go and the cards drop back into their shadows, glyph for glyph.
//
// A block is often several terms that mean one thing (the error, the average over the data), and a block is made of
// blocks: the parts are a tree, read as a sub-assembly is drawn. A card that holds more is two sheets thick. Tap it
// and the rest settles back onto the paper, it comes down to the first level, and its own blocks lift off it onto
// cards above it; tap it again, or the paper, to go back out.
//
// A second view, for comparison (Lucas: 没有3D视角迁移的对照版本): 'flat' keeps the page's own view; the blocks move apart
// in the plane and become cards, each with its words; a card that holds more comes apart the same way, inside itself.
//
// For a model to write: the formula, then each block as it is written in the formula with what it means (a name in
// bold first, if it has one); a block's own blocks indented under it (in a text: a ```parts fence, `piece: meaning`
// lines, two spaces per layer; `% nouns: A = hypothesis` colours a symbol everywhere, words included).
//   parts_figure('P(A\\mid B) = \\frac{P(B\\mid A)\\,P(A)}{P(B)}', [{ tex: 'P(A\\mid B)', says: '**posterior** …' },
//     { tex: '\\frac{P(B\\mid A)\\,P(A)}{P(B)}', says: '…', parts: [{ tex: 'P(B\\mid A)\\,P(A)', says: … }] }])
import { look, text_color_of } from '@mathnim/look';
import type { TexGlyph } from 'manim-web/utils/tex/mathjax';
import { grow_poly, hull, in_convex, nearest_on, poly_bounds, poly_cross, rect_poly, seg_cross, seg_poly, type Box, type XY } from '../kernel/geom';
import { Figure } from '../kernel/figure';
import { column, type Block, type LayoutEnv, type Size } from '../kernel/layout';
import { make_canvas } from '../kernel/render';
import { set, wait, type Step } from '../kernel/script';
import { param, read, type Param } from '../kernel/state';
import { noun_tokens, typeset_line, type TexLine, type Token } from './steps';
import { tex_scale } from '../kernel/tex';
import { break_lines, font_css, font_of, t, tex_as_text, text_width, tr, type L10n, type Lang, type Span, type TextLine } from '../kernel/text';
import { Thing, type DrawEnv } from '../kernel/thing';
import { define_thing } from '../kernel/registry';

export interface FormulaPart {
  /** The block as it is written in the formula (TeX): one symbol or several terms. */
  tex: string;
  /** What it means; a name first in bold if it has one: '**prior** belief in A before B'. */
  says: string | L10n;
  /** The blocks it is made of: its next layer. */
  parts?: FormulaPart[];
}
export interface PartNode {
  part: FormulaPart;
  /** Its ink in the formula: the tokens of the block, with the rules (bars, radicals) and brackets inside it. */
  tokens: Token[];
  children: PartNode[];
  parent: PartNode | null;
  depth: number;
}
/**
 * 'house': taken apart in depth, under the house camera (the specimen); 'flat': apart in the plane, a block opened as a
 * card that holds its blocks' cards; 'split': apart in the plane, a block opened by splitting its card into its blocks'
 * cards (no card inside a card).
 */
export type PartsView = 'house' | 'flat' | 'split';

type Rect = [number, number, number, number];
interface Cam { a: number; b: number; c: number; d: number; hz: number }
/** A layer as it stands fully apart (paper px from the formula's middle; heights in px). */
interface Pose {
  focus: PartNode | null;
  /** The blocks on cards: the focus and its blocks, or the outermost blocks. */
  cards: PartNode[];
  rect: Map<PartNode, Rect>;
  z: Map<PartNode, number>;
  /** The card each card rests on when it comes down (null: the paper). */
  under: Map<PartNode, PartNode | null>;
  /** Each token's ink where it is now, its height, and how much it shows (the rest steps back from a focus). */
  box: Map<Token, Rect>;
  tz: Map<Token, number>;
  dim: Map<Token, number>;
  /** Whose words show; the focus's quietly. */
  says: PartNode[];
  /** In the plane, a radical's roof and sign raised over a card: that card's leader may pass under them. */
  roof: Map<Token, PartNode>;
}
interface Card { node: PartNode; rect: Rect; z: number; rest: number; alpha: number; under: PartNode | null; face: XY[] }
interface Scene { K: Cam; o: XY; lift: number; cards: Card[]; tok: Map<Token, { box: Rect; z: number; a: number; on: PartNode | null; roof?: PartNode }> }
interface Words { name: string | null; lines: TextLine[]; w: number; h: number }
interface Label { node: PartNode; x: number; y: number; w: number; h: number; at: XY; quiet: boolean }
/** The stage solved for one width and language: sizes, where the formula sits together and apart, every layer. */
interface Solved {
  w: number;
  lang: Lang;
  px: number;
  k: number;
  /** The formula's middle (px from its TeX origin): paper coordinates are from here. */
  c: XY;
  H: number;
  /** The camera's origin together (at the top of the stage) and apart (the middle of what is drawn). */
  o0: XY;
  o1: XY;
  /** Where the formula ends while it is together (px from the stage's top). */
  band: number;
  base: Map<Token, Rect>;
  poses: Pose[];
  words: Map<PartNode, Words>;
  labels: Map<PartNode, Label>[];
  /** Blocks whose words found no room. */
  missing: number;
  /** The strip at the right kept for the page's lever (px; 0 with none): nothing apart goes into it. */
  aside: number;
}

// the house camera, the same on every page (the specimen's)
const AZ = -0.5, EL = 0.66;
/** c = 0: straight above (reading); c = 1: the house view. */
function cam(c: number): Cam {
  const az = AZ * c, el = Math.PI / 2 - c * (Math.PI / 2 - EL), ca = Math.cos(az), sa = Math.sin(az), ce = c === 0 ? 0 : Math.cos(el), se = Math.sin(el);
  return { a: ca, b: sa * se, c: -sa, d: ca * se, hz: ce };
}
const proj = (K: Cam, o: XY, x: number, y: number, z: number): XY => [o[0] + K.a * x + K.c * y, o[1] + K.b * x + K.d * y - K.hz * z];
const quad = (K: Cam, o: XY, r: Rect, z: number): XY[] => [proj(K, o, r[0], r[1], z), proj(K, o, r[2], r[1], z), proj(K, o, r[2], r[3], z), proj(K, o, r[0], r[3], z)];
const clamp01 = (x: number) => Math.max(0, Math.min(1, x));
const smooth = (x: number) => { const u = clamp01(x); return u * u * (3 - 2 * u); };
const mix = (a: number, b: number, u: number) => a + (b - a) * u;
const mix_rect = (a: Rect, b: Rect, u: number): Rect => [mix(a[0], b[0], u), mix(a[1], b[1], u), mix(a[2], b[2], u), mix(a[3], b[3], u)];
const pad = (r: Rect, x: number, y: number): Rect => [r[0] - x, r[1] - y, r[2] + x, r[3] + y];
const bounds = (rs: Rect[]): Rect => [Math.min(...rs.map((r) => r[0])), Math.min(...rs.map((r) => r[1])), Math.max(...rs.map((r) => r[2])), Math.max(...rs.map((r) => r[3]))];
const meet = (a: Rect, b: Rect) => a[0] <= b[2] && b[0] <= a[2] && a[1] <= b[3] && b[1] <= a[3];
const shift = (q: XY[], dx: number, dy: number): XY[] => q.map(([x, y]) => [x + dx, y + dy] as XY);
/** Ink at an alpha: for the scaffolding (edges, sockets, leaders) and shadows. */
const GR = (a: number) => `rgba(26,27,31,${a.toFixed(3)})`;
/** The amounts of coming apart at which leaders show: each must be clear at all of them. */
const LEADER_E = [0.8, 0.9, 1];

// (brackets, stretched or not, are matched by what they hold: a \left( set alone is not the same glyph)
const BRACKETS = /^[()[\]{}⟨⟩‖⎛⎜⎝⎞⎟⎠⎡⎢⎣⎤⎥⎦⎧⎨⎩⎫⎬⎭]+$/;
const set_apart = (t: Token) => t.kind === 'rule' || BRACKETS.test(t.key);
/** A rule drawn as rectangles only (a fraction's bar): it can stretch as what it spans moves apart. */
const is_bar = (t: Token) => t.kind === 'rule' && t.glyphs.every((g) => g.rect);

/**
 * The tokens of a block in a line: its run of tokens (the same keys, at the same sizes relative to each other; rules
 * and brackets passed over), among `scope`, none of them `taken`; then the rules and brackets inside it. Null when
 * the block is not in the line.
 */
export function find_block(L: TexLine, tex: string, scope: Token[], taken: Set<Token>): Token[] | null {
  const P = typeset_line(tex);
  if (P.error || L.error) return null;
  const pat = P.tokens.filter((t) => !set_apart(t)), ts = scope.filter((t) => !set_apart(t) && !taken.has(t));
  if (!pat.length) return null;
  // sizes relative to the block's first token: equal, or both smaller, or both larger (a script inside a script is
  // not reduced in the same ratio as it is when the block is set alone)
  const size = (t: Token) => t.glyphs[0].size ?? 1;
  const same_size = (a: number, b: number) => Math.abs(a - b) < 0.06 || (a < 0.97 && b < 0.97) || (a > 1.03 && b > 1.03);
  const lead = P.tokens.slice(0, P.tokens.indexOf(pat[0])).filter((t) => BRACKETS.test(t.key)).length;
  const trail = P.tokens.slice(P.tokens.indexOf(pat[pat.length - 1]) + 1).filter((t) => BRACKETS.test(t.key)).length;
  const inner = P.tokens.slice(P.tokens.indexOf(pat[0]), P.tokens.indexOf(pat[pat.length - 1]) + 1).filter((t) => BRACKETS.test(t.key)).length;
  const em = 1 / tex_scale(1);
  const found: Token[][] = [];
  for (let i = 0; i + pat.length <= ts.length; i++) {
    // (at the smallest size - a script of a script - everything is the same size: nothing to compare)
    const ok = pat.every((q, j) => { const t = ts[i + j]; return t.key === q.key && (same_size(size(t) / size(ts[i]), size(q) / size(pat[0])) || (size(t) <= 0.51 && size(ts[i]) <= 0.51)); });
    if (!ok) continue;
    const run = ts.slice(i, i + pat.length);
    // what it holds: the brackets and rules among its tokens; the brackets just outside it that it is written with
    // ((ŷ − y)² takes its opening bracket); a bar or a radical that spans it (a bar runs a little past what it divides).
    // Its brackets must be there: P(A) is not the start of P(A | B)
    const first = scope.indexOf(run[0]), last = scope.indexOf(run[run.length - 1]);
    const out = new Set<Token>(run);
    let held = 0;
    for (let j = first; j <= last; j++) if (set_apart(scope[j]) && !taken.has(scope[j])) { out.add(scope[j]); if (BRACKETS.test(scope[j].key)) held++; }
    if (held !== inner) continue;
    const outside = (from: number, step: -1 | 1, n: number): boolean => {
      let got = 0;
      for (let j = from + step; got < n && j >= 0 && j < scope.length; j += step) {
        const t = scope[j];
        if (taken.has(t)) break;
        if (BRACKETS.test(t.key)) { out.add(t); got++; } else if (t.kind !== 'rule') break;
      }
      return got === n;
    };
    if (!outside(first, -1, lead) || !outside(last, 1, trail)) continue;
    const box = [...out];
    const x0 = Math.min(...box.map((t) => t.box[0])), x1 = Math.max(...box.map((t) => t.box[2]));
    const y0 = Math.min(...box.map((t) => t.box[1])), y1 = Math.max(...box.map((t) => t.box[3]));
    // (a radical's overline goes with its radical sign: what is under the roof is not the root)
    const sign_of = (r: Token) => scope.find((s) => s.key === '√' && Math.abs(s.box[2] - r.box[0]) < 0.5 * em);
    for (const t of scope) if (t.kind === 'rule' && !taken.has(t) && t.box[0] >= x0 - 0.3 * em && t.box[2] <= x1 + 0.3 * em && t.box[3] >= y0 - 0.2 * em && t.box[1] <= y1 + 0.2 * em) {
      const sign = t.key.includes('sqrt') || t.key.includes('root') ? sign_of(t) : null;
      if (!sign || out.has(sign)) out.add(t);
    }
    found.push([...out].sort((a, b) => scope.indexOf(a) - scope.indexOf(b)));
  }
  if (!found.length) return null;
  // written more than once: the one after the relation (what a definition says, not the name it defines)
  const rel = L.anchor >= 0 ? L.tokens[L.anchor].box[2] : -Infinity;
  return found.find((f) => Math.min(...f.map((t) => t.box[0])) > rel) ?? found[0];
}

export class Parts extends Thing implements Block {
  kind = 'parts';
  readonly line: TexLine;
  readonly roots: PartNode[];
  /** Every block, depth first. */
  readonly nodes: PartNode[] = [];
  /** The blocks that have an inside, depth first: layer n (n ≥ 1) shows the inside of opens[n − 1]. */
  readonly opens: PartNode[] = [];
  readonly issues: string[] = [];
  readonly view: PartsView;
  /** How far apart (0 together, 1 apart). */
  readonly open: Param<number>;
  /** Which layer: 0 the outermost blocks, n the inside of opens[n − 1]. */
  readonly layer: Param<number>;
  /** The layer it is coming from, and how far it has come (0 there, 1 at `layer`). */
  readonly from: Param<number>;
  readonly fade: Param<number>;
  private noun_of: Map<Token, string>;
  private nouns: Record<string, string>;
  private paths = new Map<TexGlyph, Path2D>();
  private size: number | null;
  private lever: boolean;
  private lang: Lang = 'en';
  private S: Solved | null = null;
  constructor(public tex: string, parts: FormulaPart[], o: { id?: string; size?: number; view?: PartsView; nouns?: Record<string, string>; lever?: boolean } = {}) {
    super({ id: o.id ?? 'parts', role: 'text', z: 5 });
    this.view = o.view ?? 'house';
    this.line = typeset_line(tex);
    if (this.line.error) this.issues.push(`the formula does not typeset: ${this.line.error}`);
    const grow = (ps: FormulaPart[], parent: PartNode | null, scope: Token[]): PartNode[] => {
      const taken = new Set<Token>();
      return ps.flatMap((part) => {
        const tokens = this.line.error ? null : find_block(this.line, part.tex, scope, taken);
        if (!tokens) {
          this.issues.push(parent ? `the block ${part.tex} is not inside ${parent.part.tex}` : `the block ${part.tex} is not in the formula`);
          return [];
        }
        tokens.forEach((t) => taken.add(t));
        const node: PartNode = { part, tokens, children: [], parent, depth: parent ? parent.depth + 1 : 0 };
        this.nodes.push(node);
        if (part.parts?.length) {
          this.opens.push(node);
          node.children = grow(part.parts, node, tokens);
        }
        return [node];
      });
    };
    this.roots = grow(parts, null, this.line.tokens);
    // (a block whose inside was not found does not open)
    for (const n of [...this.opens]) if (!n.children.length) this.opens.splice(this.opens.indexOf(n), 1);
    this.nouns = o.nouns ?? {};
    this.noun_of = noun_tokens(this.line, this.nouns);
    this.open = param(0, { name: `${this.id}.open`, range: [0, 1], tutor: true, doc: 'the formula taken apart (1) or together (0)' });
    this.layer = param(0, { name: `${this.id}.layer`, range: [0, Math.max(0, this.opens.length)], tutor: true, doc: 'which layer: 0 the outer blocks, n the inside of the n-th block that has one' });
    this.from = param(0, { name: `${this.id}.from`, range: [0, Math.max(0, this.opens.length)] });
    this.fade = param(1, { name: `${this.id}.fade`, range: [0, 1] });
    this.size = o.size ?? null;
    this.lever = !!o.lever;
  }
  /** The blocks the old API listed: every block with its tokens, depth first. */
  get found(): { part: FormulaPart; tokens: Token[] }[] {
    return this.nodes.map((n) => ({ part: n.part, tokens: n.tokens }));
  }
  /** Blocks whose words found no room at the width laid out. */
  get missing(): number {
    return this.S?.missing ?? 0;
  }
  /** The block whose inside layer n shows (null: the outermost layer). */
  focus_of(n: number): PartNode | null {
    return n >= 1 ? this.opens[n - 1] ?? null : null;
  }
  /** The layer that shows a block's inside, and the one that shows the block itself. */
  layer_inside(n: PartNode): number {
    return this.opens.indexOf(n) + 1;
  }
  layer_of(n: PartNode): number {
    return n.parent ? this.layer_inside(n.parent) : 0;
  }
  /**
   * The layers a lever runs through with layer n on it: the outermost, each block opened on the way to n, then on
   * from n (each time the first of its blocks that holds more).
   */
  path_of(n: number): number[] {
    const out = [0], chain: PartNode[] = [];
    for (let a = this.focus_of(n); a; a = a.parent) chain.unshift(a);
    for (const a of chain) out.push(this.layer_inside(a));
    for (let at = chain.length ? chain[chain.length - 1].children : this.roots; ;) {
      const next = at.find((c) => c.children.length);
      if (!next) break;
      out.push(this.layer_inside(next));
      at = next.children;
    }
    return out;
  }
  /** A layer's name: the name of the block it opens (or the first words of what it means); none for the outermost. */
  layer_name(n: number, lang: Lang): string | null {
    const F = this.focus_of(n);
    if (!F) return null;
    const s = tr(F.part.says, lang).trim(), m = /^\*\*(.+?)\*\*/.exec(s);
    if (m) return m[1].trim();
    const plain = tex_as_text(s).replace(/\$/g, '');
    if (plain.length <= 14) return plain;
    // (cut at a word when the words have spaces)
    let cut = plain.slice(0, 14);
    if (cut.lastIndexOf(' ') > 6) cut = cut.slice(0, cut.lastIndexOf(' '));
    return `${cut.trimEnd()}…`;
  }

  // ---------------------------------------------------------------- what each block says
  private ink_of(t: Token): string {
    const nn = this.noun_of.get(t);
    return t.glyphs[0].fill ?? (nn ? text_color_of(`noun:${nn}`, look()) : this.text_color);
  }
  /** A block's words: its name (bold), and what it means, its symbols in their nouns' colours. */
  private words(nd: PartNode, lang: Lang): Words {
    const s = tr(nd.part.says, lang).trim(), m = /^\*\*(.+?)\*\*\s*[:：,，—–-]?\s*([\s\S]*)$/.exec(s);
    const name = m ? m[1].trim() : null, mean = m ? m[2].trim() : s;
    const spans: Span[] = [];
    mean.split(/(\$[^$]+\$)/).forEach((p) => {
      if (!p) return;
      const tex = /^\$([^$]+)\$$/.exec(p)?.[1].trim();
      if (tex === undefined) spans.push({ s: p });
      else spans.push({ s: tex_as_text(p).replace(/\$/g, ''), color: this.nouns[tex] ? text_color_of(`noun:${this.nouns[tex]}`, look()) : undefined, weight: 500 });
    });
    const FN = font_of('label', { weight: 600 }), FM = font_of('label', { weight: 400 }), LH = Math.round(FM.size * 1.3);
    const lines = spans.length ? break_lines(spans, FM, 230) : [];
    const w = Math.ceil(Math.max(name ? text_width(name, FN) : 0, ...lines.map((l) => l.width)));
    return { name, lines, w, h: (name ? LH + 1 : 0) + lines.length * LH };
  }
  /** The plane's measures (px): a card's padding across and down, the gap between cards, an outer card's padding, the move off the axis. */
  private flat_m(px: number) {
    return { padx: px * 0.16, pady: px * 0.14, gap: px * 0.5, tp: px * 0.24, v: px * 0.24 };
  }


  // ---------------------------------------------------------------- the poses: each layer fully apart
  private pose(n: number, px: number, base: Map<Token, Rect>, axis: number): Pose {
    const F = this.focus_of(n), split = this.view === 'split';
    // (split: the blocks shown are the frontier - every block opened on the way to the focus replaced by its blocks)
    const path: PartNode[] = [];
    for (let a = F; a; a = a.parent) path.unshift(a);
    const front = path.reduce<PartNode[]>((cs, p) => cs.flatMap((c) => (c === p ? p.children : [c])), [...this.roots]);
    const cards = split ? front : F ? [F, ...F.children] : [...this.roots];
    const has = new Map(cards.map((c) => [c, new Set(c.tokens)]));
    const carrier = (t: Token) => cards.filter((c) => has.get(c)!.has(t)).sort((a, b) => b.depth - a.depth)[0] ?? null;
    const inF = F && !split ? new Set(F.tokens) : null;
    const P: Pose = { focus: F, cards, rect: new Map(), z: new Map(), under: new Map(), box: new Map(), tz: new Map(), dim: new Map(), says: split ? front : F ? [F, ...F.children] : [...this.roots], roof: new Map() };
    for (const t of this.line.tokens) P.dim.set(t, inF && !inF.has(t) ? 0.3 : 1);
    for (const c of cards) P.under.set(c, F && !split && c !== F ? F : null);
    const cpx = px * 0.16, cpy = px * 0.14, ink = (nd: PartNode) => bounds(nd.tokens.map((t) => P.box.get(t)!));
    if (this.view === 'house') {
      for (const t of this.line.tokens) P.box.set(t, base.get(t)!);
      for (const c of cards) P.rect.set(c, pad(ink(c), cpx, cpy));
      // heights: from the lowest card on screen up, each rises just far enough to clear everything already placed (the
      // paper's ink, the cards below it): every card on its own level; a focus's blocks above it
      const K = cam(1), O: XY = [0, 0], T = px * 0.07, step = px * 0.45, gap = px * 0.3;
      const placed: { q: XY[]; bb: Rect }[] = [];
      const keep = (q: XY[]) => placed.push({ q, bb: poly_bounds(q) });
      for (const t of this.line.tokens) if (!carrier(t)) keep(quad(K, O, base.get(t)!, 0));
      const low = (nd: PartNode) => Math.max(...quad(K, O, P.rect.get(nd)!, 0).map((v) => v[1]));
      const order = F ? [F, ...[...F.children].sort((a, b) => low(b) - low(a))] : [...cards].sort((a, b) => low(b) - low(a));
      let z = 0;
      for (const c of order) {
        z += step;
        const r = P.rect.get(c)!;
        for (let i = 0; i < 4000; i++) {
          const q = hull([...quad(K, O, r, z), ...quad(K, O, r, z - T * (c.children.length ? 2 : 1))]), g = grow_poly(q, gap), gb = poly_bounds(g);
          if (!placed.some((p) => meet(gb, p.bb) && poly_cross(g, p.q))) { keep(q); break; }
          z += 2;
        }
        P.z.set(c, z);
      }
      for (const t of this.line.tokens) { const c = carrier(t); P.tz.set(t, c ? P.z.get(c)! : 0); }
      return P;
    }
    // the plane: the blocks move apart sideways into cards, as the specimen's cards, each with a leader to what it means.
    // Blocks stacked one over another share a column, and in it each row spreads on its own (a numerator's blocks move
    // apart over a denominator kept in the middle); what lies between them moves with them, a bar that spans them
    // stretches; then they move a little away from the axis. 'flat' opens a block as a card that holds its blocks'
    // cards; 'split' as its blocks' cards in its place.
    const M = this.flat_m(px), levels = F && !split ? [[F], F.children] : [cards], inner = levels[levels.length - 1];
    const glyphs = (nd: PartNode) => bounds(nd.tokens.map((t) => base.get(t)!));
    const side_of = (b: Rect): 1 | -1 | 0 => (b[3] < axis - px * 0.1 ? -1 : b[1] > axis + px * 0.1 ? 1 : 0);
    type Row = { cards: { x0: number; x1: number; s: number; off: number }[]; add: number; pad: number };
    type Col = { x0: number; x1: number; add: number; rows: Map<number, Row>; member: Map<Token, number> };
    const columns = (lv: PartNode[], s: number): Col[] => {
      const items = lv.map((c) => { const b = glyphs(c); return { c, x0: b[0], x1: b[2], side: side_of(b) as number }; }).sort((a, b) => a.x0 - b.x0);
      const groups: { x0: number; x1: number; items: typeof items }[] = [];
      for (const it of items) {
        const last = groups[groups.length - 1];
        if (last && it.x0 < last.x1 - 0.5) { last.x1 = Math.max(last.x1, it.x1); last.items.push(it); } else groups.push({ x0: it.x0, x1: it.x1, items: [it] });
      }
      return groups.map((gr) => {
        const col: Col = { x0: gr.x0, x1: gr.x1, add: 0, rows: new Map(), member: new Map() };
        const at = new Map<PartNode, { row: Row; k: Row['cards'][number] }>();
        for (const it of gr.items) {
          let r = col.rows.get(it.side);
          if (!r) col.rows.set(it.side, (r = { cards: [], add: 0, pad: 0 }));
          const k = { x0: it.x0, x1: it.x1, s, off: 0 };
          r.cards.push(k);
          at.set(it.c, { row: r, k });
        }
        for (const r of col.rows.values()) { r.cards.sort((a, b) => a.x0 - b.x0); let acc = 0; for (const k of r.cards) { k.off = acc + k.s; acc += 2 * k.s; } r.add = acc; }
        col.add = Math.max(...[...col.rows.values()].map((r) => r.add));
        for (const r of col.rows.values()) r.pad = (col.add - r.add) / 2;
        for (const [c, { row, k }] of at) for (const t of c.tokens) col.member.set(t, row.pad + k.off);
        return col;
      });
    };
    const cols = levels.map((lv, i) => columns(lv, i === levels.length - 1 ? M.padx + M.gap / 2 : M.tp + M.gap / 2));
    // how far a point moves for one column: nothing before it, all its spread after it, inside it by its row
    const in_col = (x: number, col: Col, side: number): number => {
      if (x <= col.x0 + 1e-6) return 0;
      if (x >= col.x1 - 1e-6) return col.add;
      const r = col.rows.get(side);
      if (!r) return col.add / 2;
      return r.pad + r.cards.reduce((a, k) => a + (x > k.x0 + 1e-6 ? k.s : 0) + (x >= k.x1 - 1e-6 ? k.s : 0), 0);
    };
    // (a token outside every card moves as one with the smallest block that holds it and no card - the denominator
    // under a numerator coming apart stays whole - else on its own)
    const unit_of = (t: Token): Rect => {
      const inside = this.nodes.filter((nd) => nd.tokens.includes(t) && !cards.some((c) => c.tokens.every((x) => nd.tokens.includes(x)))).sort((a, b) => b.depth - a.depth)[0];
      return bounds((inside ? inside.tokens : [t]).map((x) => base.get(x)!));
    };
    const moved = (t: Token): Rect => {
      const b = base.get(t)!, u = unit_of(t), mid = (u[0] + u[2]) / 2, sd = side_of(u);
      let d0 = 0, d1 = 0;
      for (const cs of cols) {
        const total = cs.reduce((a, c) => a + c.add, 0);
        d0 -= total / 2;
        d1 -= total / 2;
        for (const c of cs) {
          const m = c.member.get(t);
          if (m !== undefined) { d0 += m; d1 += m; }
          else if (is_bar(t)) { d0 += in_col(b[0], c, sd); d1 += in_col(b[2], c, sd); }
          else { const v = in_col(mid, c, sd); d0 += v; d1 += v; }
        }
      }
      return [b[0] + d0, b[1], b[2] + d1, b[3]];
    };
    for (const t of this.line.tokens) P.box.set(t, moved(t));
    // away from the axis, a little: room for the cards' edges between a numerator, its bar and its denominator
    for (const c of inner) {
      const sd = side_of(glyphs(c));
      if (sd) for (const t of c.tokens) { const r = P.box.get(t)!; P.box.set(t, [r[0], r[1] + sd * M.v, r[2], r[3] + sd * M.v]); }
    }
    // (a card that holds cards, above the axis - a numerator taken apart - rises clear of its bar, one below drops)
    const sF = F && !split ? side_of(glyphs(F)) : 0;
    if (F && sF) for (const t of F.tokens) { const r = P.box.get(t)!; P.box.set(t, [r[0], r[1] + sF * M.tp, r[2], r[3] + sF * M.tp]); }
    for (const c of inner) P.rect.set(c, pad(ink(c), M.padx, M.pady));
    // a radical over a card: its roof rises over the card, and its sign grows to meet it
    for (const t of this.line.tokens) {
      if (t.kind !== 'rule' || !(t.key.includes('sqrt') || t.key.includes('root'))) continue;
      const r = P.box.get(t)!, under = inner.find((c) => !c.tokens.includes(t) && (() => { const g = ink(c); return g[0] >= r[0] - 2 && g[2] <= r[2] + 2 + px; })());
      if (!under) continue;
      const cr = P.rect.get(under)!, th = r[3] - r[1], top = cr[1] - th - px * 0.08;
      P.box.set(t, [r[0], top, Math.max(r[2], cr[2] + px * 0.04), top + th]);
      P.roof.set(t, under);
      const sign = this.line.tokens.find((x) => x.key === '√' && Math.abs(P.box.get(x)![2] - r[0]) < px * 0.6);
      if (sign) { const b = P.box.get(sign)!; P.box.set(sign, [b[0], Math.min(b[1], top), b[2], b[3]]); P.roof.set(sign, under); }
    }
    if (F && !split) P.rect.set(F, pad(bounds([...F.children.map((c) => P.rect.get(c)!), ink(F)]), M.tp, M.tp));
    for (const c of cards) P.z.set(c, 0);
    for (const t of this.line.tokens) P.tz.set(t, 0);
    return P;
  }
  /** A block's card in a pose: its own, or where its ink is. */
  private rect_in(P: Pose, nd: PartNode, px: number): Rect {
    return P.rect.get(nd) ?? pad(bounds(nd.tokens.map((t) => P.box.get(t)!)), px * 0.16, px * 0.14);
  }
  /** Its height in a pose: its card's, else the card it lies on (else the paper). */
  private z_in(P: Pose, nd: PartNode): number {
    for (let a: PartNode | null = nd; a; a = a.parent) if (P.z.has(a)) return P.z.get(a)!;
    return 0;
  }
  private rest_in(P: Pose, nd: PartNode): number {
    if (!P.cards.includes(nd)) return this.z_in(P, nd);
    const u = P.under.get(nd);
    return u ? P.z.get(u)! : 0;
  }

  // ---------------------------------------------------------------- the stage
  /** Solve the stage for a width: the size of the formula, every layer apart, room for the words, the words placed. */
  private solve(w: number, lang: Lang): Solved {
    if (this.S && this.S.w === w && this.S.lang === lang) return this.S;
    const V = this.line.view, k1 = tex_scale(1);
    // (with a lever, the specimen's handle at the right: together the formula stays in the middle, clear of it; apart,
    // everything drawn keeps to the left of it)
    const aside = this.lever ? (w < 560 ? 44 : 56) : 0, wa = w - aside;
    let px = this.size ?? Math.max(look().type.label.size, Math.min(look().type.display.size * 1.15, (w - 2 * aside - 24) / (V[2] * k1)));
    let S!: Solved, tb: Rect = [0, 0, 0, 0];
    for (let tries = 0; tries < 6; tries++) {
      const k = tex_scale(px), c: XY = [(V[0] + V[2] / 2) * k, (V[1] + V[3] / 2) * k];
      const base = new Map<Token, Rect>(this.line.tokens.map((t) => [t, [t.box[0] * k - c[0], t.box[1] * k - c[1], t.box[2] * k - c[0], t.box[3] * k - c[1]]]));
      const A = this.line.anchor >= 0 ? base.get(this.line.tokens[this.line.anchor])! : null, axis = A ? (A[1] + A[3]) / 2 : 0;
      S = { w, lang, px, k, c, H: 0, o0: [0, 0], o1: [0, 0], band: 0, base, poses: [], words: new Map(), labels: [], missing: 0, aside };
      this.S = S;
      for (let n = 0; n <= this.opens.length; n++) S.poses.push(this.pose(n, px, base, axis));
      // what every layer draws apart, around the camera's origin
      const all: Rect[] = [];
      for (let n = 0; n < S.poses.length; n++) {
        const sc = this.scene(S, 1, n, n, 1, [0, 0]);
        for (const o of this.keep_clear(S, sc)) all.push(poly_bounds(o.poly));
      }
      tb = bounds(all);
      if (tb[2] - tb[0] <= wa - 28 || this.size) break;
      px *= Math.max(0.7, (wa - 28) / (tb[2] - tb[0]) * 0.98);
    }
    for (const nd of this.nodes) S.words.set(nd, this.words(nd, lang));
    // together, the formula at the top of the stage; apart, what is drawn in its middle with the words around it
    const fh = this.line.view[3] * S.k, top = Math.max(6, S.px * 0.3);
    S.o0 = [w / 2, top + fh / 2];
    S.band = top + fh + S.px * 0.36;
    const lh = Math.max(40, ...[...S.words.values()].map((x) => x.h));
    let H = Math.max(S.band, Math.ceil(tb[3] - tb[1] + 2 * (lh + 26)));
    const tcx = (tb[0] + tb[2]) / 2, tcy = (tb[1] + tb[3]) / 2, room = Math.max(0, (wa - (tb[2] - tb[0])) / 2 - 12);
    let best: { labels: Map<PartNode, Label>[]; o1: XY; H: number; missing: number } | null = null;
    search: for (let tries = 0; tries < 4; tries++, H += 48) {
      for (const dx of [0, -0.33, 0.33, -0.66, 0.66, -1, 1]) {
        const o1: XY = [wa / 2 - tcx + dx * room, H / 2 - tcy];
        S.H = H;
        const labels = S.poses.map((_, n) => this.place(S, n, o1, H));
        const missing = labels.reduce((a, l, n) => a + S.poses[n].says.length - l.size, 0);
        if (!best || missing < best.missing) best = { labels, o1, H, missing };
        if (!missing) break search;
      }
    }
    S.labels = best!.labels;
    S.o1 = best!.o1;
    S.H = best!.H;
    // the stage as tall as what is drawn apart, words included, and no taller (the page opens only that much)
    let y0 = Infinity, y1 = -Infinity;
    for (let n = 0; n < S.poses.length; n++) {
      for (const e of LEADER_E) for (const o of this.keep_clear(S, this.scene(S, e, n, n, 1))) { y0 = Math.min(y0, o.bb[1]); y1 = Math.max(y1, o.bb[3]); }
      for (const lb of S.labels[n].values()) { y0 = Math.min(y0, lb.y); y1 = Math.max(y1, lb.y + lb.h); }
    }
    const dy = Math.max(0, Math.floor(y0 - 12));
    if (dy > 0) {
      S.o1 = [S.o1[0], S.o1[1] - dy];
      for (const m of S.labels) for (const lb of m.values()) { lb.y -= dy; lb.at = [lb.at[0], lb.at[1] - dy]; }
    }
    S.H = Math.ceil(Math.max(S.band, y1 - dy + 12));
    S.missing = best!.missing;
    return S;
  }
  measure(w: number, env: LayoutEnv): Size {
    const S = this.solve(w, env.lang);
    return { h: S.H, min: S.H };
  }
  arrange(b: Box, env: LayoutEnv): void {
    this.lang = env.lang;
    const S = this.solve(b.w, env.lang);
    this.box = { x: b.x, y: b.y, w: b.w, h: S.H };
  }
  /** The bands of the figure (px from its top): a page shows only the formula while it is together. */
  bands(): { top: number; bottom: number } {
    return { top: 0, bottom: this.box.y + (this.S?.band ?? this.box.h) };
  }

  // ---------------------------------------------------------------- a moment
  /** The scene at `e` apart, `u` of the way from layer a to layer b, with the camera's origin apart at o1. */
  private scene(S: Solved, e: number, a: number, b: number, u: number, o1 = S.o1): Scene {
    e = clamp01(e);
    const oc = smooth(Math.min(1, e * 1.15)), lift = smooth((e - 0.08) / 0.92), uu = smooth(u), house = this.view === 'house';
    const K = cam(house ? oc : 0), o: XY = [mix(S.o0[0], o1[0], oc), mix(S.o0[1], o1[1], oc)];
    const A = S.poses[a] ?? S.poses[0], B = S.poses[b] ?? S.poses[0];
    const tok: Scene['tok'] = new Map();
    for (const t of this.line.tokens) {
      const box = mix_rect(S.base.get(t)!, mix_rect(A.box.get(t)!, B.box.get(t)!, uu), lift);
      tok.set(t, { box, z: mix(A.tz.get(t)!, B.tz.get(t)!, uu) * lift, a: 1 - (1 - mix(A.dim.get(t)!, B.dim.get(t)!, uu)) * lift, on: null, roof: (uu > 0.5 ? B : A).roof.get(t) });
    }
    const cards: Card[] = [...new Set([...A.cards, ...B.cards])].map((nd) => {
      const closed = pad(bounds(nd.tokens.map((t) => S.base.get(t)!)), S.px * 0.16, S.px * 0.14);
      const rect = mix_rect(closed, mix_rect(this.rect_in(A, nd, S.px), this.rect_in(B, nd, S.px), uu), lift);
      const z = mix(this.z_in(A, nd), this.z_in(B, nd), uu) * lift, rest = mix(this.rest_in(A, nd), this.rest_in(B, nd), uu) * lift;
      const ina = A.cards.includes(nd), inb = B.cards.includes(nd), here = ina && inb ? 1 : ina ? 1 - uu : uu;
      // a card shows as it rises off what it rests on (in the plane: as it comes apart)
      const alpha = house ? clamp01((z - rest) / (S.px * 0.25)) : here * smooth((lift - 0.1) / 0.5);
      return { node: nd, rect, z, rest, alpha, under: (inb ? B.under.get(nd) : A.under.get(nd)) ?? null, face: quad(K, o, rect, z) };
    }).sort((p, q) => p.z - q.z || p.node.depth - q.node.depth);
    for (const c of cards) for (const t of c.node.tokens) { const r = tok.get(t)!; if (!r.on || r.on.depth < c.node.depth) r.on = c.node; }
    return { K, o, lift, cards, tok };
  }
  /** The scene now. */
  private now(): Scene | null {
    const S = this.S;
    if (!S) return null;
    return this.scene(S, read(this.open), Math.round(read(this.from)), Math.round(read(this.layer)), read(this.fade));
  }
  /** What a word or a leader must keep clear of: cards (with their edges), sockets, every glyph. */
  private keep_clear(S: Solved, sc: Scene): { node: PartNode | null; poly: XY[]; bb: Rect; glyph?: boolean; socket?: boolean; roof?: PartNode }[] {
    const out: { node: PartNode | null; poly: XY[]; bb: Rect; glyph?: boolean; socket?: boolean; roof?: PartNode }[] = [];
    const add = (node: PartNode | null, poly: XY[], o: { glyph?: boolean; socket?: boolean; roof?: PartNode } = {}) => out.push({ node, poly, bb: poly_bounds(poly), ...o });
    for (const c of sc.cards) {
      if (c.alpha < 0.05) continue;
      add(c.node, this.card_poly(S, sc, c));
      if (this.view === 'house' && c.z - c.rest > 1) add(c.node, grow_poly(quad(sc.K, sc.o, c.rect, c.rest), 4), { socket: true });
    }
    for (const r of sc.tok.values()) add(r.on, quad(sc.K, sc.o, r.box, r.z), { glyph: true, roof: r.roof });
    return out;
  }
  /** A card's edge as seen (px): its thickness under the house camera; in the plane, the same card seen a little from the front. */
  private edge(S: Solved, sc: Scene): number {
    return S.px * 0.07 * (this.view === 'house' ? sc.K.hz : 0.62);
  }
  /** A card's outline on screen, its edge (two sheets for one that holds more) included. */
  private card_poly(S: Solved, sc: Scene, c: Card): XY[] {
    const two = c.node.children.length > 0;
    return hull([...c.face, ...shift(c.face, 0, this.edge(S, sc) * (two ? 2 : 1))]);
  }

  // ---------------------------------------------------------------- the words: places all round, kept off every card,
  // glyph and each other; leaders straight, never crossing. Depth-first over the blocks, nearest places first.
  private place(S: Solved, n: number, o1: XY, H: number): Map<PartNode, Label> {
    const P = S.poses[n], W = S.w - S.aside, house = this.view === 'house';
    const SC = LEADER_E.map((e) => this.scene(S, e, n, n, 1, o1)), OB = SC.map((sc) => this.keep_clear(S, sc));
    const face = (sc: Scene, nd: PartNode) => sc.cards.find((c) => c.node === nd)?.face ?? null;
    // (a leader leaves its own card, and the cards it lies on: never another card, never a glyph)
    const holds = (a: PartNode | null, nd: PartNode) => { for (let x: PartNode | null = nd; x; x = x.parent) if (x === a) return true; return false; };
    type Cand = { node: PartNode; x: number; y: number; w: number; h: number; at: XY; anchors: XY[]; box: XY[]; bb: Rect; cost: number };
    const M = 12, cand = new Map<PartNode, Cand[]>();
    for (const nd of P.says) {
      const wd = S.words.get(nd)!, w = wd.w, h = wd.h, f = face(SC[SC.length - 1], nd);
      if (!f) continue;
      const cxc = f.reduce((s, v) => s + v[0], 0) / 4, cyc = f.reduce((s, v) => s + v[1], 0) / 4;
      const list: Cand[] = [];
      for (let x = M; x + w <= W - M; x += 8) for (let y = M; y + h <= H - M; y += 6) {
        const bb: Rect = [x - 6, y - 6, x + w + 6, y + h + 6], box = rect_poly(x, y, w, h, 6);
        if (OB.some((ob) => ob.some((o) => meet(bb, o.bb) && poly_cross(box, o.poly)))) continue;
        // attach to the side of the words facing the card: the end of their first line, or their top or bottom
        const side = x > cxc ? 'l' : x + w < cxc ? 'r' : y > cyc ? 't' : 'b';
        const mid = house ? Math.min(w / 2, 24) : w / 2;
        const at: XY = side === 'l' ? [x - 4, y + 10] : side === 'r' ? [x + w + 4, y + 10] : side === 't' ? [x + mid, y - 4] : [x + mid, y + h + 3];
        const anchors = SC.map((sc) => nearest_on(face(sc, nd) ?? f, at)), an = anchors[anchors.length - 1];
        const len = Math.hypot(at[0] - an[0], at[1] - an[1]);
        if (len < 16 || len > 260) continue;
        let clear = true;
        for (let k = 0; k < SC.length && clear; k++) {
          const a = anchors[k], a2: XY = [a[0] + (at[0] - a[0]) * 0.02, a[1] + (at[1] - a[1]) * 0.02];
          const sb: Rect = [Math.min(a2[0], at[0]), Math.min(a2[1], at[1]), Math.max(a2[0], at[0]), Math.max(a2[1], at[1])];
          if (OB[k].some((o) => !o.socket && o.roof !== nd && (o.glyph || !holds(o.node, nd)) && meet(sb, o.bb) && seg_poly(a2, at, o.poly))) clear = false;
        }
        if (!clear) continue;
        // short leaders read best: in the house view level or gently sloped, in the plane straight up or down
        const dx = Math.abs(at[0] - an[0]), dy = Math.abs(at[1] - an[1]);
        const bend = house ? 40 * Math.min(dy / (dx + 1), 3) + (side === 't' || side === 'b' ? 30 : 0) : 40 * Math.min(dx / (dy + 1), 3) + (side === 'l' || side === 'r' ? 30 : 0);
        list.push({ node: nd, x, y, w, h, at, anchors, box: rect_poly(x, y, w, h, 8), bb: [x - 8, y - 8, x + w + 8, y + h + 8], cost: len + bend });
      }
      list.sort((a, b) => a.cost - b.cost);
      // variety: the best place in each small region, so the search can move a label far away
      const seen = new Set<string>();
      cand.set(nd, list.filter((c) => { const key = `${Math.floor(c.x / 36)},${Math.floor(c.y / 28)}`; if (seen.has(key)) return false; seen.add(key); return true; }).slice(0, 220));
    }
    const order = P.says.filter((nd) => cand.get(nd)?.length).sort((a, b) => cand.get(a)!.length - cand.get(b)!.length);
    const ok = (c: Cand, chosen: Cand[]) => chosen.every((d) => !(meet(c.bb, d.bb) && poly_cross(c.box, d.box)) && c.anchors.every((a, k) => !seg_cross(a, c.at, d.anchors[k], d.at) && !seg_poly(a, c.at, d.box) && !seg_poly(d.anchors[k], d.at, c.box)));
    let best: Cand[] | null = null, best_cost = Infinity, nodes = 0;
    (function dfs(i: number, chosen: Cand[], cost: number) {
      if (cost >= best_cost || nodes++ > 40000) return;
      if (i === order.length) { best = chosen.slice(); best_cost = cost; return; }
      for (const c of cand.get(order[i])!) {
        if (cost + c.cost >= best_cost) break;
        if (ok(c, chosen)) { chosen.push(c); dfs(i + 1, chosen, cost + c.cost); chosen.pop(); }
      }
    })(0, [], 0);
    // (no way for all of them: as many as fit, nearest first)
    if (!best) { const got: Cand[] = []; for (const nd of order) { const c = cand.get(nd)!.find((x) => ok(x, got)); if (c) got.push(c); } best = got; }
    const placed: Cand[] = best;
    const quiet = (nd: PartNode) => (this.view === 'split' ? !!P.focus && nd.parent !== P.focus : nd === P.focus);
    return new Map(placed.map((c) => [c.node, { node: c.node, x: c.x, y: c.y, w: c.w, h: c.h, at: c.at, quiet: quiet(c.node) }]));
  }

  // ---------------------------------------------------------------- reading it
  things(): Thing[] {
    return [this];
  }
  label(): string {
    return `parts '${this.id}' (${this.nodes.length})`;
  }
  override text(): string {
    const walk = (ns: PartNode[], d: number): string => ns.map((n) => `${'  '.repeat(d)}${n.part.tex}: ${tr(n.part.says, this.lang)}${n.children.length ? `\n${walk(n.children, d + 1)}` : ''}`).join('\n');
    return `${this.tex}\n${walk(this.roots, 0)}`;
  }
  override parts_of = (lang: Lang) => {
    const S = this.S, k = S?.k ?? tex_scale(30), V = this.line.view;
    const ox = this.box.x + (S?.o0[0] ?? 0), oy = this.box.y + (S?.o0[1] ?? 0);
    const at = (r: Rect): Box => ({ x: ox + r[0], y: oy + r[1], w: r[2] - r[0], h: r[3] - r[1] });
    const out: { text: string; tex?: boolean; box: Box }[] = [{ text: this.tex, tex: true, box: at([-(V[2] * k) / 2, -(V[3] * k) / 2, (V[2] * k) / 2, (V[3] * k) / 2]) }];
    // the layer shown (the outermost while together): each block with what it means, where it is in the formula
    const n = read(this.open) > 0.5 ? Math.round(read(this.layer)) : 0, F = this.focus_of(n);
    for (const nd of F ? F.children : this.roots) out.push({ text: `${nd.part.tex}: ${tr(nd.part.says, lang)}`, box: S ? at(bounds(nd.tokens.map((t) => S.base.get(t)!))) : this.box });
    return out;
  };
  /**
   * What a tap at p (px) does: together → apart, the outer layer; on a card that holds more → its inside; on the
   * card whose inside is shown, or on the paper → one layer out (together, from the outermost). Null: nothing.
   */
  tap(p: XY): { open: number; layer: number } | null {
    const n = Math.round(read(this.layer)), F = this.focus_of(n);
    if (read(this.open) < 0.5) return { open: 1, layer: 0 };
    const hit = this.block_at(p);
    if (hit && hit !== F && hit.children.length) return { open: 1, layer: this.layer_inside(hit) };
    if (hit && hit !== F) return null;
    if (F) return { open: 1, layer: this.layer_of(F) };
    return { open: 0, layer: 0 };
  }
  /** The middle of a block's card now (px, in the figure): where a tap on it lands. */
  middle(nd: PartNode): XY {
    const sc = this.now(), c = sc?.cards.find((x) => x.node === nd);
    if (!sc || !c) return [this.box.x, this.box.y];
    return [this.box.x + c.face.reduce((s, v) => s + v[0], 0) / 4, this.box.y + c.face.reduce((s, v) => s + v[1], 0) / 4];
  }
  /** The block whose card (or words) is at p (px, in the figure), the card in front first. */
  block_at(p: XY): PartNode | null {
    const S = this.S, sc = this.now();
    if (!S || !sc || read(this.open) < 0.5) return null;
    const q: XY = [p[0] - this.box.x, p[1] - this.box.y], n = Math.round(read(this.layer));
    for (const lb of S.labels[n]?.values() ?? []) if (q[0] >= lb.x - 4 && q[0] <= lb.x + lb.w + 4 && q[1] >= lb.y - 4 && q[1] <= lb.y + lb.h + 4) return lb.node;
    for (const c of [...sc.cards].reverse()) if (c.alpha > 0.5 && in_convex(q, this.card_poly(S, sc, c))) return c.node;
    return null;
  }
  /** Every leader at `e` apart in layer n (px, in the figure): for the checks. */
  leaders(e: number, n: number): { node: PartNode; a: XY; b: XY }[] {
    const S = this.S;
    if (!S) return [];
    const sc = this.scene(S, e, n, n, 1);
    return [...(S.labels[n]?.values() ?? [])].flatMap((lb) => { const c = sc.cards.find((x) => x.node === lb.node); return c ? [{ node: lb.node, a: nearest_on(c.face, lb.at), b: lb.at }] : []; });
  }
  /** Glyphs at `e` apart in layer n, as screen polygons (px, in the figure), with the label boxes: for the checks. */
  ink_at(e: number, n: number): { glyphs: XY[][]; roofs: (PartNode | undefined)[]; labels: Box[]; cards: XY[][] } {
    const S = this.S;
    if (!S) return { glyphs: [], roofs: [], labels: [], cards: [] };
    const sc = this.scene(S, e, n, n, 1);
    return { glyphs: [...sc.tok.values()].map((r) => quad(sc.K, sc.o, r.box, r.z)), roofs: [...sc.tok.values()].map((r) => r.roof), labels: [...(S.labels[n]?.values() ?? [])].map((l) => ({ x: l.x, y: l.y, w: l.w, h: l.h })), cards: sc.cards.filter((c) => c.alpha >= 0.05).map((c) => this.card_poly(S, sc, c)) };
  }
  /** Where a token is drawn at `e` apart in layer n (its TeX origin, px in the figure): together, where it was typeset. */
  origin_of(t: Token, e: number, n = 0): XY {
    const S = this.S!, sc = this.scene(S, e, n, n, 1), r = sc.tok.get(t)!;
    const p = proj(sc.K, sc.o, r.box[0] - t.box[0] * S.k, r.box[1] - t.box[1] * S.k, r.z);
    return [this.box.x + p[0], this.box.y + p[1]];
  }
  /** The strip kept for the page's lever (px in the figure, from the figure's left), or null without a lever. */
  lever_room(): { x: number; w: number } | null {
    const S = this.S;
    return S && S.aside ? { x: this.box.x + S.w - S.aside, w: S.aside } : null;
  }
  /** Where the formula was typeset (its TeX origin, px in the figure). */
  typeset_at(): XY {
    const S = this.S!;
    return [this.box.x + S.o0[0] - S.c[0], this.box.y + S.o0[1] - S.c[1]];
  }

  // ---------------------------------------------------------------- drawing
  private path(g: TexGlyph): Path2D {
    let p = this.paths.get(g);
    if (!p) { p = new (globalThis as { Path2D: typeof Path2D }).Path2D(g.d ?? ''); this.paths.set(g, p); }
    return p;
  }
  /** A token where the scene has it: the camera's plane, lifted z, moved to its box (a bar stretched to it). */
  private token(g: CanvasRenderingContext2D, S: Solved, sc: Scene, t: Token): void {
    const r = sc.tok.get(t)!, k = S.k;
    if (r.a < 0.003) return;
    const K = sc.K, b = S.base.get(t)!;
    g.save();
    g.globalAlpha *= r.a;
    g.translate(sc.o[0], sc.o[1] - K.hz * r.z);
    g.transform(K.a, K.b, K.c, K.d, 0, 0);
    g.fillStyle = this.ink_of(t);
    if (is_bar(t) && Math.abs(r.box[2] - r.box[0] - (b[2] - b[0])) > 0.01) {
      // (a bar that spans blocks moving apart stretches with them)
      for (const gl of t.glyphs) {
        const R = gl.rect!, sx = (r.box[2] - r.box[0]) / Math.max(1e-6, b[2] - b[0]);
        const x0 = r.box[0] + (R[0] * k - S.c[0] - b[0]) * sx, y0 = r.box[1] + (R[1] * k - S.c[1] - b[1]);
        g.fillRect(x0, y0, R[2] * k * sx, R[3] * k);
      }
      g.restore();
      return;
    }
    const bh = b[3] - b[1], sy = bh > 0 ? (r.box[3] - r.box[1]) / bh : 1;
    if (Math.abs(sy - 1) > 1e-3) {
      // (stretched from its foot)
      g.translate(0, r.box[3]);
      g.scale(1, sy);
      g.translate(0, -r.box[3]);
    }
    g.translate(r.box[0] - t.box[0] * k, r.box[3] - t.box[3] * k);
    g.scale(k, k);
    for (const gl of t.glyphs) {
      if (gl.fill) g.fillStyle = gl.fill;
      if (gl.text) { g.font = `${gl.font_size}px ${look().fonts.serif}`; g.fillText(gl.text, gl.at![0], gl.at![1]); }
      else if (gl.rect) g.fillRect(gl.rect[0], gl.rect[1], gl.rect[2], gl.rect[3]);
      else g.fill(this.path(gl));
    }
    g.restore();
  }
  // shadows: drawn once per card size and blur (never computed while it moves), then laid on the paper as it is seen
  private shadows = new Map<string, CanvasImageSource>();
  private shadow_sprite(w: number, h: number, blur: number): { img: CanvasImageSource; m: number } {
    const m = Math.ceil(blur * 2 + 2), key = `${Math.round(w)}x${Math.round(h)}|${blur}`;
    let img = this.shadows.get(key);
    if (!img) {
      const s = 2, c = make_canvas((Math.round(w) + 2 * m) * s, (Math.round(h) + 2 * m) * s), g = c.getContext('2d') as unknown as CanvasRenderingContext2D;
      g.scale(s, s);
      // (the shadow of a box drawn far to the left, cast back into the sprite: a blur every canvas has)
      g.shadowColor = 'rgba(26,27,31,1)';
      g.shadowBlur = blur * 2 * s;
      g.shadowOffsetX = 10000 * s;
      g.fillStyle = '#000';
      g.fillRect(m - 10000, m, Math.round(w), Math.round(h));
      img = c as unknown as CanvasImageSource;
      if (this.shadows.size > 64) this.shadows.clear();
      this.shadows.set(key, img);
    }
    return { img, m };
  }
  private shadow(g: CanvasRenderingContext2D, S: Solved, sc: Scene, c: Card): void {
    const K = sc.K, r = c.rect, w = r[2] - r[0], h = r[3] - r[1];
    if (this.view === 'house') {
      const dz = c.z - c.rest;
      if (dz < 0.5) return;
      // straight under the card: sharper when low, softer as it rises; and the socket it returns to
      const t = Math.min(1, dz / (S.px * 2.5)), a = Math.max(0, 0.04 + 0.05 * Math.min(1, dz / (S.px * 0.6)) - 0.03 * t);
      g.save();
      g.translate(sc.o[0], sc.o[1] - K.hz * c.rest);
      g.transform(K.a, K.b, K.c, K.d, 0, 0);
      for (const [blur, wt] of [[1, 1 - t], [8, t]] as const) {
        if (wt < 0.01) continue;
        const s = this.shadow_sprite(w, h, blur);
        g.globalAlpha = a * wt * 1.6;
        g.drawImage(s.img, r[0] - s.m, r[1] - s.m, w + 2 * s.m, h + 2 * s.m);
      }
      g.restore();
      g.save();
      g.strokeStyle = GR(0.22 * Math.min(1, dz / (S.px * 0.5)));
      g.lineWidth = 0.75;
      g.setLineDash([3, 3]);
      poly(g, quad(K, sc.o, r, c.rest));
      g.stroke();
      g.restore();
      return;
    }
    // (in the plane a card lies on the paper, a soft shadow under it)
    if (c.alpha < 0.01) return;
    const s = this.shadow_sprite(w, h, 4);
    g.save();
    g.globalAlpha = 0.12 * c.alpha;
    g.translate(sc.o[0], sc.o[1] + this.edge(S, sc) + 1);
    g.drawImage(s.img, r[0] - s.m, r[1] - s.m, w + 2 * s.m, h + 2 * s.m);
    g.restore();
  }
  private card(g: CanvasRenderingContext2D, S: Solved, sc: Scene, c: Card): void {
    const a = c.alpha;
    if (a < 0.001) return;
    const two = c.node.children.length > 0, T = this.edge(S, sc);
    g.save();
    // the specimen's card: its edge (two sheets for a card that holds more), then its face
    const edge = hull([...c.face, ...shift(c.face, 0, T * (two ? 2 : 1))]);
    g.fillStyle = `rgba(226,222,214,${a})`;
    poly(g, edge);
    g.fill();
    g.strokeStyle = GR(0.16 * a);
    g.lineWidth = 0.75;
    g.stroke();
    if (two) { g.strokeStyle = GR(0.12 * a); poly(g, hull([...c.face, ...shift(c.face, 0, T)])); g.stroke(); }
    g.fillStyle = `rgba(255,255,255,${a})`;
    poly(g, c.face);
    g.fill();
    g.restore();
  }
  private words_of(g: CanvasRenderingContext2D, env: DrawEnv, S: Solved, sc: Scene, lb: Label, alpha: number): void {
    const c = sc.cards.find((x) => x.node === lb.node);
    if (!c || c.alpha < 0.3 || alpha < 0.003) return;
    const wd = S.words.get(lb.node)!, an = nearest_on(c.face, lb.at), P = env.look.palette;
    const FN = font_of('label', { weight: 600 }), FM = font_of('label', { weight: 400 }), LH = Math.round(FM.size * 1.3);
    g.save();
    g.globalAlpha *= alpha * (lb.quiet ? 0.7 : 1);
    g.strokeStyle = GR(0.62);
    g.lineWidth = 1;
    g.beginPath();
    g.moveTo(an[0], an[1]);
    g.lineTo(lb.at[0], lb.at[1]);
    g.stroke();
    g.fillStyle = P.ink;
    g.beginPath();
    g.arc(an[0], an[1], 2.6, 0, Math.PI * 2);
    g.fill();
    g.textBaseline = 'top';
    let y = lb.y;
    if (wd.name) {
      g.font = font_css(FN);
      g.fillStyle = lb.quiet ? P.ink2 : P.ink;
      g.fillText(wd.name, lb.x, y);
      y += LH + 1;
    }
    for (const l of wd.lines) {
      for (const sp of l.spans) {
        g.font = font_css(sp.weight ? { ...FM, weight: sp.weight } : FM);
        g.fillStyle = sp.color ?? (wd.name ? P.ink2 : lb.quiet ? P.ink2 : P.ink);
        g.fillText(sp.s, lb.x + sp.x, y);
      }
      y += LH;
    }
    g.restore();
  }
  draw(env: DrawEnv): void {
    const S = this.S, sc = this.now();
    if (!S || !sc) return;
    const g = env.g as CanvasRenderingContext2D;
    g.save();
    g.translate(this.box.x, this.box.y);
    // 1. on the paper: the shadows and sockets of the cards that rest on it, then its own ink
    for (const c of sc.cards) if (!c.under) this.shadow(g, S, sc, c);
    for (const t of this.line.tokens) if (!sc.tok.get(t)!.on) this.token(g, S, sc, t);
    // 2. each card, lowest first: its edge and face, what rests on it, its ink
    for (const c of sc.cards) {
      this.card(g, S, sc, c);
      for (const d of sc.cards) if (d.under === c.node) this.shadow(g, S, sc, d);
      for (const t of c.node.tokens) if (sc.tok.get(t)!.on === c.node) this.token(g, S, sc, t);
    }
    // 3. leaders and words, front-on, once the cards are apart (a new layer's as it arrives, the last one's leaving)
    const e = clamp01(read(this.open)), la = clamp01((e - 0.8) / 0.2), a = Math.round(read(this.from)), b = Math.round(read(this.layer)), u = clamp01(read(this.fade));
    if (la > 0) {
      for (const lb of S.labels[b]?.values() ?? []) this.words_of(g, env, S, sc, lb, la * (a === b || (S.labels[a]?.has(lb.node) && same_place(S.labels[a].get(lb.node)!, lb)) ? 1 : smooth((u - 0.55) / 0.45)));
      if (a !== b) for (const lb of S.labels[a]?.values() ?? []) if (!(S.labels[b]?.has(lb.node) && same_place(S.labels[b].get(lb.node)!, lb))) this.words_of(g, env, S, sc, lb, la * (1 - smooth(u / 0.35)));
    }
    // 4. together: a dotted line under each outer block (something is folded here)
    if (e < 0.2) {
      g.save();
      g.globalAlpha *= 1 - e / 0.2;
      g.fillStyle = 'rgba(98,102,109,0.8)';
      const yb = S.o0[1] + (this.line.view[3] * S.k) / 2 + S.px * 0.1;
      for (const nd of this.roots) {
        const r = bounds(nd.tokens.map((t) => S.base.get(t)!));
        for (let x = S.o0[0] + r[0] + 1; x < S.o0[0] + r[2] - 1; x += 5) { g.beginPath(); g.arc(x, yb, 0.95, 0, Math.PI * 2); g.fill(); }
      }
      g.restore();
    }
    g.restore();
  }
}

/** Words in the same place in two layers (a card that stays as it was keeps its words, without a flicker). */
function same_place(a: Label, b: Label): boolean {
  return a.x === b.x && a.y === b.y && a.quiet === b.quiet;
}

function poly(g: CanvasRenderingContext2D, q: XY[]): void {
  g.beginPath();
  g.moveTo(q[0][0], q[0][1]);
  for (let i = 1; i < q.length; i++) g.lineTo(q[i][0], q[i][1]);
  g.closePath();
}

/**
 * A figure of one formula taken apart. `view`: 'house' (in depth, the specimen's) or 'flat' (in the plane). `tour`:
 * its script takes it apart and goes through every layer and back (a gallery's demo, a video); else it waits together
 * for a hand.
 */
export function parts_figure(tex: string, parts: FormulaPart[], o: { lang?: Lang; size?: number; paper?: boolean; tour?: boolean; view?: PartsView; nouns?: Record<string, string>; lever?: boolean } = {}): Figure & { formula: Parts } {
  const fig = new Figure({ lang: o.lang ?? 'en' }) as Figure & { formula: Parts };
  if (o.paper === false) fig.paper = 'clear';
  const p = new Parts(tex, parts, { id: 'parts', size: o.size, view: o.view, nouns: o.nouns, lever: o.lever });
  fig.formula = p;
  for (const q of [p.open, p.layer, p.from, p.fade]) fig.params.set(q.name, q);
  fig.layout(column([p]), o.paper === false ? { pad: 2 } : {});
  if (o.tour) {
    const go = (from: number, n: number): Step[] => [set(p.from, from, 'linear', 0.001), set(p.fade, 0, 'linear', 0.001), set(p.layer, n, 'linear', 0.001), set(p.fade, 1, 'travel', 0.9), wait(2.6)];
    const seq: Step[] = [];
    let at = 0;
    for (let i = 0; i < p.opens.length; i++) { seq.push(...go(at, i + 1)); at = i + 1; }
    fig.script(wait(0.8), set(p.open, 1, 'travel', 0.9), wait(2.6), ...seq, ...go(at, 0), set(p.open, 0, 'travel', 0.8));
  }
  fig.check('every block is in the formula, each inside the block it is part of', () => (p.issues.length ? p.issues.join('; ') : null));
  fig.check('every layer has room for its words', () => (p.missing ? `${p.missing} block(s) have no room for their words` : null));
  fig.check('no leader crosses another, a glyph or words; no words meet', () => {
    const bad: string[] = [];
    for (let n = 0; n <= p.opens.length; n++) {
      const box_poly = (b: Box) => rect_poly(b.x, b.y, b.w, b.h);
      for (const e of [0.8, 0.9, 1]) {
        const L = p.leaders(e, n), ink = p.ink_at(e, n);
        for (let i = 0; i < L.length; i++) for (let j = i + 1; j < L.length; j++) if (seg_cross(L[i].a, L[i].b, L[j].a, L[j].b)) bad.push(`layer ${n}: leaders of ${L[i].node.part.tex} and ${L[j].node.part.tex} cross`);
        for (const l of L) {
          const a2: XY = [l.a[0] + (l.b[0] - l.a[0]) * 0.02, l.a[1] + (l.b[1] - l.a[1]) * 0.02];
          if (ink.glyphs.some((q, i) => ink.roofs[i] !== l.node && seg_poly(a2, l.b, q))) bad.push(`layer ${n}: the leader of ${l.node.part.tex} crosses a glyph`);
        }
        for (let i = 0; i < ink.labels.length; i++) for (let j = i + 1; j < ink.labels.length; j++) if (poly_cross(box_poly(ink.labels[i]), box_poly(ink.labels[j]))) bad.push(`layer ${n}: words meet`);
      }
    }
    return bad.length ? [...new Set(bad)].join('; ') : null;
  });
  return fig;
}

// ---------------------------------------------------------------- entry
const BAYES = 'P(A\\mid B) = \\frac{P(B\\mid A)\\,P(A)}{P(B)}';
const bayes_parts = (lang: Lang): FormulaPart[] => {
  const zh = lang === 'zh';
  return [
    { tex: 'P(A\\mid B)', says: zh ? '**后验** 看到 $B$ 之后，$A$ 有多可信' : '**posterior** how believable $A$ is after $B$' },
    { tex: '\\frac{P(B\\mid A)\\,P(A)}{P(B)}', says: zh ? '**更新** 在 $B$ 发生的情况里，$A$ 也成立的份额' : "**update** the share of $B$'s cases in which $A$ also holds", parts: [
      { tex: 'P(B\\mid A)\\,P(A)', says: zh ? '**联合** $A$ 和 $B$ 一起发生有多常见' : '**joint** how often $A$ and $B$ happen together', parts: [
        { tex: 'P(B\\mid A)', says: zh ? '**似然** 如果 $A$ 成立，看到 $B$ 的可能' : '**likelihood** how likely $B$ is if $A$ holds' },
        { tex: 'P(A)', says: zh ? '**先验** 看到 $B$ 之前，对 $A$ 的相信' : '**prior** belief in $A$ before $B$' }] },
      { tex: 'P(B)', says: zh ? '**证据** $B$ 本身有多常见' : '**evidence** how common $B$ is anyway' }] },
  ];
};
const BAYES_NOUNS = { A: 'hypothesis', B: 'evidence' };
define_thing({
  name: 'parts', says: t('a formula taken apart like an exploded drawing: each block (one symbol or several terms) lifts on its own card with what it means; a card that holds more comes apart in turn', '像工程分解图一样拆开的公式：每一块（一个符号或几项）升到自己的卡片上，引线指向它的意思；装着更多的卡片可以再拆开'),
  zones: ['figure', 'text'], maturity: 'stable', since: '0.2.1', from: 'int/explode',
  syntax: "parts_figure(tex, [{ tex: 'P(B\\\\mid A)\\\\,P(A)', says: '**joint** how often A and B happen together', parts: [{ tex: 'P(A)', says: '**prior** …' }] }, …], { lang, view: 'house' | 'flat' | 'split', nouns: { A: 'hypothesis' } })",
  rules: ['each block as it is written in the formula; several terms that mean one thing are one block', "a block's own blocks are its next layer: the big picture first, the inside on demand", 'write the formula in the form whose blocks carry the idea (−b/2a ± …, not one bar over everything)', 'a name in bold first when the block has one (**prior**), then what it means in plain words'],
  accept: t('together again, every glyph is where it was typeset (0 px); no leader crosses another, a glyph or words, at every amount where leaders show; every block found inside the block it belongs to', '合上后每个字形回到排版位置（误差 0 px）；引线显示的每个时刻都互不相交，也不穿过字形或文字；每一块都在它所属的块里找到'),
  demo: (lang) => parts_figure(BAYES, bayes_parts(lang), { lang, tour: true, nouns: BAYES_NOUNS }),
  source: 'packages/engine/src/lib/parts.ts',
});
define_thing({
  name: 'parts_flat', says: t('the same formula taken apart in the plane, for comparison: the blocks move apart and become cards with what each means; a card that holds more comes apart inside itself', '同一个公式在平面里拆开（对照版）：各块移开、变成卡片并显示意思；装着更多的卡片在自己里面再分开'),
  zones: ['figure', 'text'], maturity: 'experiment', since: '0.3.0', from: 'int/explode',
  syntax: "parts_figure(tex, parts, { lang, view: 'flat' })",
  rules: ['as parts, in the plane: no camera turn'],
  accept: t('as parts', '同 parts'),
  demo: (lang) => parts_figure(BAYES, bayes_parts(lang), { lang, tour: true, nouns: BAYES_NOUNS, view: 'flat' }),
  source: 'packages/engine/src/lib/parts.ts',
});
define_thing({
  name: 'parts_split', says: t('the same formula taken apart in the plane, a card splitting into its blocks\' cards when it is opened (no card inside a card)', '同一个公式在平面里拆开：点开一张卡片，它分裂成几张卡片（卡片里不套卡片）'),
  zones: ['figure', 'text'], maturity: 'experiment', since: '0.3.0', from: 'int/explode',
  syntax: "parts_figure(tex, parts, { lang, view: 'split' })",
  rules: ['as parts, in the plane; opening a block replaces its card with its blocks\' cards'],
  accept: t('as parts', '同 parts'),
  demo: (lang) => parts_figure(BAYES, bayes_parts(lang), { lang, tour: true, nouns: BAYES_NOUNS, view: 'split' }),
  source: 'packages/engine/src/lib/parts.ts',
});
