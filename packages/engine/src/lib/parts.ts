// A formula read block by block, layer by layer (分块、逐层; specimen gpu/int/explode.js, then Lucas 2026-11-07:
// "有些公式不是每项的标记，可能是一块（好几项）的标记，来找到直觉…或者是逐层的标记"). The intuition in a formula is rarely
// in one symbol: it is in a block of several terms that means one thing - the error, the average over the data, the
// share of the whole - and a block is itself made of blocks. So the parts of a formula are a tree. Tapped, the formula
// shows its outermost blocks, each in a colour of its own with a brace and what it means; tap a block that has an
// inside and it opens: its own blocks come out the same way, while the brace of the block they make up moves outward
// (you see that these make that), and the rest of the formula steps back. Tap it again, or beside it, to go back out.
// At rest the formula is drawn whole, a dotted line under each outer block (something is folded there).
//
// For a model to write: the formula, then each block as it is written in the formula with what it means; a block's
// own blocks indented under it (in a text: a ```parts fence, `piece: meaning` lines, two spaces per layer).
//   parts_figure('P(A\\mid B) = \\frac{P(B\\mid A)\\,P(A)}{P(B)}', [{ tex: 'P(A\\mid B)', says: 'the posterior' },
//     { tex: '\\frac{P(B\\mid A)\\,P(A)}{P(B)}', says: 'the share…', parts: [{ tex: 'P(B\\mid A)\\,P(A)', says: … }] }])
import { look, type Pigment } from '@mathnim/look';
import type { TexGlyph } from 'manim-web/utils/tex/mathjax';
import type { Box, XY } from '../kernel/geom';
import { Figure } from '../kernel/figure';
import { column, type Block, type LayoutEnv, type Size } from '../kernel/layout';
import { set, wait, type Step } from '../kernel/script';
import { param, read, type Param } from '../kernel/state';
import { typeset_line, type TexLine, type Token } from './steps';
import { tex_scale } from '../kernel/tex';
import { break_lines, font_css, font_of, t, tex_as_text, text_width, tr, type L10n, type Lang } from '../kernel/text';
import { Thing, type DrawEnv } from '../kernel/thing';
import { define_thing } from '../kernel/registry';

export interface FormulaPart {
  /** The block as it is written in the formula (TeX): one symbol or several terms. */
  tex: string;
  /** What it means. */
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
  /** Its colour while its layer is shown. */
  color: string;
}
/** One block's mark in a layer: its brace, and its words (px, from the formula's TeX origin). */
interface Mark {
  node: PartNode;
  /** Under the formula (1) or over it (-1). */
  side: 1 | -1;
  x0: number;
  x1: number;
  /** Where the brace starts (its ends, on the formula's side) and its tip. */
  y: number;
  tip: number;
  label: { x: number; y: number; w: number; h: number; lines: string[] };
  /** A block that the shown layer makes up (drawn outward, quieter). */
  outer: boolean;
}

// (the colours of a layer: the pigments of nouns; vermilion is the one action, so it is not among them)
const PIGMENTS: Pigment[] = ['cobalt', 'viridian', 'violet', 'ochre', 'teal'];
// (brackets, stretched or not, are matched by what they hold: a \left( set alone is not the same glyph)
const BRACKETS = /^[()[\]{}⟨⟩‖⎛⎜⎝⎞⎟⎠⎡⎢⎣⎤⎥⎦⎧⎨⎩⎫⎬⎭]+$/;
const set_apart = (t: Token) => t.kind === 'rule' || BRACKETS.test(t.key);

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
    for (const t of scope) if (t.kind === 'rule' && !taken.has(t) && t.box[0] >= x0 - 0.3 * em && t.box[2] <= x1 + 0.3 * em && t.box[3] >= y0 - 0.2 * em && t.box[1] <= y1 + 0.2 * em) out.add(t);
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
  /** 0: the formula alone; 1: a layer of its blocks shown, each with what it means. */
  readonly open: Param<number>;
  /** Which layer: 0 the outermost blocks, n the inside of opens[n − 1]. */
  readonly layer: Param<number>;
  /** The layer's marks coming in (0..1): back to 0 and on to 1 whenever the layer changes. */
  readonly fade: Param<number>;
  private paths = new Map<TexGlyph, Path2D>();
  private px_fit = 0;
  private lang: Lang = 'en';
  private size: number | null;
  constructor(public tex: string, parts: FormulaPart[], o: { id?: string; size?: number } = {}) {
    super({ id: o.id ?? 'parts', role: 'text', z: 5 });
    this.line = typeset_line(tex);
    if (this.line.error) this.issues.push(`the formula does not typeset: ${this.line.error}`);
    const look_ = look();
    const grow = (ps: FormulaPart[], parent: PartNode | null, scope: Token[], first: number): PartNode[] => {
      const taken = new Set<Token>();
      return ps.flatMap((part, i) => {
        const tokens = this.line.error ? null : find_block(this.line, part.tex, scope, taken);
        if (!tokens) {
          this.issues.push(parent ? `the block ${part.tex} is not inside ${parent.part.tex}` : `the block ${part.tex} is not in the formula`);
          return [];
        }
        tokens.forEach((t) => taken.add(t));
        const node: PartNode = { part, tokens, children: [], parent, depth: parent ? parent.depth + 1 : 0, color: look_.palette[PIGMENTS[(first + i) % PIGMENTS.length]] };
        this.nodes.push(node);
        if (part.parts?.length) {
          this.opens.push(node);
          node.children = grow(part.parts, node, tokens, first + i + 1);
        }
        return [node];
      });
    };
    this.roots = grow(parts, null, this.line.tokens, 0);
    // (a block whose inside was not found does not open)
    for (const n of [...this.opens]) if (!n.children.length) this.opens.splice(this.opens.indexOf(n), 1);
    this.open = param(0, { name: `${this.id}.open`, range: [0, 1], tutor: true, doc: 'the formula read block by block (1) or whole (0)' });
    this.layer = param(0, { name: `${this.id}.layer`, range: [0, Math.max(0, this.opens.length)], tutor: true, doc: 'which layer: 0 the outer blocks, n the inside of the n-th block that has one' });
    this.fade = param(1, { name: `${this.id}.fade`, range: [0, 1] });
    this.size = o.size ?? null;
  }
  /** The blocks the old API listed: every block with its tokens, depth first. */
  get found(): { part: FormulaPart; tokens: Token[] }[] {
    return this.nodes.map((n) => ({ part: n.part, tokens: n.tokens }));
  }
  private px(): number {
    return this.size ?? (this.px_fit || look().type.display.size);
  }
  private label_font() {
    return font_of('caption', { size: Math.round(Math.max(look().type.caption.size, this.px() * 0.36)) });
  }
  /** What a block means, as drawn: its $…$ TeX as the characters it shows. */
  private words(n: PartNode): string {
    return tex_as_text(tr(n.part.says, this.lang)).replace(/\$/g, '');
  }
  /** The block whose inside layer n shows (null: the outermost layer). */
  private focus_of(n: number): PartNode | null {
    return n >= 1 ? this.opens[n - 1] ?? null : null;
  }
  /** A block's extent (px, from the TeX origin). */
  private extent(ts: Token[]): { x0: number; x1: number; y0: number; y1: number } {
    const k = tex_scale(this.px());
    return { x0: Math.min(...ts.map((t) => t.box[0])) * k, x1: Math.max(...ts.map((t) => t.box[2])) * k, y0: Math.min(...ts.map((t) => t.box[1])) * k, y1: Math.max(...ts.map((t) => t.box[3])) * k };
  }
  /**
   * The marks of layer n (px, from the TeX origin), laid out for a slot `w` wide. A brace under each block - over it
   * for a block above the formula's axis (a numerator, an exponent), under it for one below (a denominator); either
   * for one across the axis - and its words beyond the brace, in one row, each as near its own brace as it can be
   * with none meeting another (so the leaders from the braces never cross). When a row is too full, every other block
   * that may go either way goes over; then the words wrap narrower; at the last, a second row. Outward on the same
   * side come the blocks this layer makes up, from the nearest out.
   */
  plan(n: number, w = this.box.w || 600): { marks: Mark[]; above: number; below: number } {
    const k = tex_scale(this.px()), px = this.px(), f = this.label_font(), lineh = f.size * look().type.caption.line;
    const V = this.line.view, fx0 = V[0] * k, fx1 = (V[0] + V[2]) * k, top = V[1] * k, bottom = (V[1] + V[3]) * k;
    const mid = (fx0 + fx1) / 2, left = mid - w / 2 + 4, right = mid + w / 2 - 4;
    const F = this.focus_of(n), shown = F ? F.children : this.roots;
    const gap = px * 0.14, bh = px * 0.3, rowgap = px * 0.16, sep = 14;
    // the formula's axis: the middle of its relation (or of the formula)
    const A = this.line.anchor >= 0 ? this.line.tokens[this.line.anchor].box : null;
    const axis = A ? ((A[1] + A[3]) / 2) * k : (top + bottom) / 2;
    const items = shown.map((nd) => {
      const e = this.extent(nd.tokens);
      const lock: -1 | 0 | 1 = e.y1 < axis - px * 0.1 ? -1 : e.y0 > axis + px * 0.1 ? 1 : 0;
      return { nd, e, lock, cx: (e.x0 + e.x1) / 2 };
    }).sort((a, b) => a.cx - b.cx);
    // (a block with an inside says so with a › after its words, never alone on a line)
    const more = text_width(' ›', f);
    const wrap = (nd: PartNode, maxw: number) => {
      const extra = nd.children.length ? more : 0;
      const ls = break_lines(this.words(nd), f, Math.min(maxw, w - 16) - extra);
      const lines = ls.map((l) => l.spans.map((s) => s.s).join(''));
      if (extra) lines[lines.length - 1] += ' ›';
      return { lines, w: Math.max(...ls.map((l, i) => l.width + (i === ls.length - 1 ? extra : 0))), h: ls.length * lineh };
    };
    /** Left edges for widths `ws` as near `want` as can be, in order, `sep` apart, inside [left, right]; null: too wide. */
    const pack = (want: number[], ws: number[]): number[] | null => {
      const total = ws.reduce((s, x) => s + x, 0) + sep * Math.max(0, ws.length - 1);
      if (total > right - left) return null;
      // clusters of labels that would meet, each centred on what its labels want, merged until none meet
      let cl = want.map((x, i) => ({ items: [i], x }));
      const width = (c: { items: number[] }) => c.items.reduce((s, i) => s + ws[i], 0) + sep * (c.items.length - 1);
      const place = (c: { items: number[]; x: number }) => {
        let off = 0;
        const ideal = c.items.map((i) => { const o = off; off += ws[i] + sep; return want[i] - o; });
        c.x = Math.max(left, Math.min(right - width(c), ideal.reduce((s, x) => s + x, 0) / ideal.length));
      };
      cl.forEach(place);
      for (let merged = true; merged;) {
        merged = false;
        for (let j = 1; j < cl.length; j++) {
          if (cl[j - 1].x + width(cl[j - 1]) + sep > cl[j].x) {
            const c = { items: [...cl[j - 1].items, ...cl[j].items], x: 0 };
            place(c);
            cl = [...cl.slice(0, j - 1), c, ...cl.slice(j + 1)];
            merged = true;
            break;
          }
        }
      }
      const out: number[] = [];
      for (const c of cl) { let x = c.x; for (const i of c.items) { out[i] = x; x += ws[i] + sep; } }
      return out;
    };
    // sides and widths: the first layout whose rows fit
    type Placed = { side: 1 | -1; lab: ReturnType<typeof wrap>; x: number; row: number }[];
    let chosen: Placed | null = null as Placed | null;
    for (const maxw of [260, 210, 160, 120]) {
      for (const alt of [false, true]) {
        let flex = 0;
        const sides = items.map((it) => (it.lock !== 0 ? it.lock : alt && flex++ % 2 === 1 ? -1 : 1) as 1 | -1);
        const labs = items.map((it) => wrap(it.nd, maxw));
        const res: Placed = items.map((_, i) => ({ side: sides[i], lab: labs[i], x: 0, row: 0 }));
        let ok = true;
        for (const side of [1, -1] as const) {
          const idx = items.map((_, i) => i).filter((i) => sides[i] === side);
          const xs = pack(idx.map((i) => items[i].cx - labs[i].w / 2), idx.map((i) => labs[i].w));
          if (!xs) { ok = false; break; }
          idx.forEach((i, j) => (res[i].x = xs[j]));
        }
        if (ok) { chosen = res; break; }
      }
      if (chosen) break;
    }
    if (!chosen) {
      // too much for one row on each side: a further row for those that do not fit
      chosen = items.map((it) => ({ side: (it.lock || 1) as 1 | -1, lab: wrap(it.nd, 120), x: 0, row: 0 }));
      const rows: Record<string, { x0: number; x1: number }[]> = {};
      chosen.forEach((c, i) => {
        c.x = Math.max(left, Math.min(right - c.lab.w, items[i].cx - c.lab.w / 2));
        while ((rows[`${c.side}:${c.row}`] ?? []).some((q) => c.x < q.x1 + sep && c.x + c.lab.w > q.x0 - sep)) c.row++;
        (rows[`${c.side}:${c.row}`] ??= []).push({ x0: c.x, x1: c.x + c.lab.w });
      });
    }
    const marks: Mark[] = [];
    const ext = { above: 0, below: 0 };
    for (const side of [1, -1] as const) {
      const y = side === 1 ? bottom + gap : top - gap;
      const mine = chosen.map((c, i) => ({ c, it: items[i] })).filter((x) => x.c.side === side);
      // each brace just beyond the ink in its own column (a block high in an exponent keeps its brace near it)
      const column = (e: { x0: number; x1: number }) => {
        const ts = this.line.tokens.filter((t) => t.box[2] * k > e.x0 + 1 && t.box[0] * k < e.x1 - 1);
        if (!ts.length) return y;
        return side === 1 ? Math.max(...ts.map((t) => t.box[3] * k)) + gap : Math.min(...ts.map((t) => t.box[1] * k)) - gap;
      };
      const by = mine.map((x) => column(x.it.e));
      // the words beyond the whole formula (they never sit on its ink), the braces near their own
      const base = by.length ? (side === 1 ? Math.max(...by, y) : Math.min(...by, y)) + side * (bh + gap) : y;
      const nrows = Math.max(0, ...mine.map((x) => x.c.row + 1));
      const row_h = Array.from({ length: nrows }, (_, r) => Math.max(lineh, ...mine.filter((x) => x.c.row === r).map((x) => x.c.lab.h)));
      let at = base;
      const row_at: number[] = [];
      for (let r = 0; r < nrows; r++) { row_at.push(side === 1 ? at : at - row_h[r]); at += side * (row_h[r] + rowgap); }
      mine.forEach(({ c, it }, i) => marks.push({ node: it.nd, side, x0: it.e.x0, x1: it.e.x1, y: by[i], tip: by[i] + side * bh, label: { x: c.x, y: row_at[c.row], w: c.lab.w, h: c.lab.h, lines: c.lab.lines }, outer: false }));
      let reach = mine.length ? Math.abs(at - y) : 0;
      // the blocks this layer makes up, outward on the side the focus is drawn: the nearest first
      const fside = F ? ((e) => (e.y1 < axis - px * 0.1 ? -1 : 1))(this.extent(F.tokens)) : 0;
      if (F && fside === side) {
        let o = y + side * Math.max(reach, gap) + (mine.length ? side * gap : 0);
        for (let a: PartNode | null = F; a; a = a.parent) {
          const e = this.extent(a.tokens), lab = wrap(a, Math.max(160, Math.min(320, w - 16)));
          const ls = break_lines(this.words(a), f, Math.max(160, Math.min(320, w - 16)));
          const lw = Math.max(...ls.map((l) => l.width)), lh = ls.length * lineh, cx = (e.x0 + e.x1) / 2;
          const lx = Math.max(left, Math.min(right - lw, cx - lw / 2));
          const ly = side === 1 ? o + bh + gap : o - bh - gap - lh;
          marks.push({ node: a, side, x0: e.x0, x1: e.x1, y: o, tip: o + side * bh, label: { x: lx, y: ly, w: lw, h: lh, lines: ls.map((l) => l.spans.map((s) => s.s).join('')) }, outer: true });
          void lab;
          o += side * (bh + gap + lh + rowgap);
        }
        reach = Math.abs(o - y);
      }
      if (side === 1) ext.below = gap + reach;
      else ext.above = gap + reach;
    }
    return { marks, above: ext.above, below: ext.below };
  }
  /** The most room any layer needs above and below the formula (px), for a slot w wide. */
  private room(w: number): { above: number; below: number } {
    let above = 0, below = 0;
    for (let n = 0; n <= this.opens.length; n++) { const p = this.plan(n, w); above = Math.max(above, p.above); below = Math.max(below, p.below); }
    return { above: above + this.px() * 0.1, below: below + this.px() * 0.1 };
  }
  measure(w: number, _env: LayoutEnv): Size {
    const k1 = tex_scale(1), W = this.line.view[2];
    this.px_fit = Math.max(look().type.label.size, Math.min(look().type.display.size * 1.15, (w - 16) / (W * k1)));
    const r = this.room(w), h = r.above + this.line.view[3] * tex_scale(this.px()) + r.below + this.px() * 0.2;
    return { h, min: h };
  }
  arrange(b: Box, env: LayoutEnv): void {
    this.lang = env.lang;
    const s = this.measure(b.w, env), k = tex_scale(this.px()), w = this.line.view[2] * k, r = this.room(b.w);
    this.box = { x: b.x, y: b.y, w: b.w, h: s.h };
    this.x0 = b.x + (b.w - w) / 2 - this.line.view[0] * k;
    this.y0 = b.y + r.above + this.px() * 0.1 - this.line.view[1] * k;
  }
  private x0 = 0;
  private y0 = 0;
  /**
   * The bands of the figure (px from its top): the room for marks above the formula, the formula, the room below. A
   * page shows only the formula while it is whole, and opens the rooms as it is read.
   */
  bands(): { top: number; bottom: number } {
    const k = tex_scale(this.px()), V = this.line.view;
    return { top: Math.max(0, this.y0 + V[1] * k - this.px() * 0.12 - this.box.y), bottom: Math.max(0, this.y0 + (V[1] + V[3]) * k + this.px() * 0.16 - this.box.y) };
  }
  /** Kept for pages that open only the room above (the old exploded formula). */
  room_end(): number {
    return this.bands().top;
  }
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
    const k = tex_scale(this.px()), V = this.line.view;
    const out: { text: string; tex?: boolean; box: Box }[] = [{ text: this.tex, tex: true, box: { x: this.x0 + V[0] * k, y: this.y0 + V[1] * k, w: V[2] * k, h: V[3] * k } }];
    // the layer shown (the outermost while the formula is whole): each block with what it means, where it is
    const n = read(this.open) > 0.5 ? Math.round(read(this.layer)) : 0, F = this.focus_of(n);
    for (const nd of F ? F.children : this.roots) {
      const e = this.extent(nd.tokens);
      out.push({ text: `${nd.part.tex}: ${tr(nd.part.says, lang)}`, box: { x: this.x0 + e.x0, y: this.y0 + e.y0, w: e.x1 - e.x0, h: e.y1 - e.y0 } });
    }
    return out;
  };
  /**
   * What a tap at p (px) does: whole → the outer layer; on a block that has an inside → that inside; on the block
   * whose inside is shown, or beside the formula → one layer out (whole, from the outermost). Null: nothing.
   */
  tap(p: XY): { open: number; layer: number } | null {
    const n = Math.round(read(this.layer)), F = this.focus_of(n);
    if (read(this.open) < 0.5) return { open: 1, layer: 0 };
    const hit = this.block_at(p);
    if (hit && hit !== F && hit.children.length) return { open: 1, layer: this.opens.indexOf(hit) + 1 };
    if (hit && hit !== F) return null;
    if (F) return { open: 1, layer: F.parent ? this.opens.indexOf(F.parent) + 1 : 0 };
    return { open: 0, layer: 0 };
  }
  /** The middle of a block's ink (px, in the figure): where a tap on it lands, where a pointer points. */
  middle(n: PartNode): XY {
    const e = this.extent(n.tokens);
    return [this.x0 + (e.x0 + e.x1) / 2, this.y0 + (e.y0 + e.y1) / 2];
  }
  /** The block of the shown layer (or one the layer makes up) at p (px): its ink, or its words. */
  block_at(p: XY): PartNode | null {
    const n = Math.round(read(this.layer)), plan = this.plan(n);
    const near = (x0: number, y0: number, x1: number, y1: number, pad = 4) => p[0] >= x0 - pad && p[0] <= x1 + pad && p[1] >= y0 - pad && p[1] <= y1 + pad;
    for (const m of plan.marks) {
      const e = this.extent(m.node.tokens);
      if (!m.outer && near(this.x0 + e.x0, this.y0 + e.y0, this.x0 + e.x1, this.y0 + e.y1)) return m.node;
      if (near(this.x0 + m.label.x, this.y0 + m.label.y, this.x0 + m.label.x + m.label.w, this.y0 + m.label.y + m.label.h)) return m.node;
    }
    for (const m of plan.marks) if (m.outer) { const e = this.extent(m.node.tokens); if (near(this.x0 + e.x0, this.y0 + e.y0, this.x0 + e.x1, this.y0 + e.y1)) return m.node; }
    return null;
  }
  private path(g: TexGlyph): Path2D {
    let p = this.paths.get(g);
    if (!p) { p = new (globalThis as { Path2D: typeof Path2D }).Path2D(g.d ?? ''); this.paths.set(g, p); }
    return p;
  }
  private glyphs(g: CanvasRenderingContext2D, ts: Token[], color: string, alpha: number): void {
    if (alpha < 0.003 || !ts.length) return;
    const k = tex_scale(this.px());
    g.save();
    g.globalAlpha *= alpha;
    g.translate(this.x0, this.y0);
    g.scale(k, k);
    for (const t of ts) for (const gl of t.glyphs) {
      g.fillStyle = gl.fill ?? color;
      if (gl.text) { g.font = `${gl.font_size}px ${look().fonts.serif}`; g.fillText(gl.text, gl.at![0], gl.at![1]); }
      else if (gl.rect) g.fillRect(gl.rect[0], gl.rect[1], gl.rect[2], gl.rect[3]);
      else g.fill(this.path(gl));
    }
    g.restore();
  }
  /** A curly brace from x0 to x1, its ends at y and its tip `dir` (1 down, −1 up) bh further; grown from its middle by `s`. */
  private brace(g: CanvasRenderingContext2D, x0: number, x1: number, y: number, bh: number, dir: 1 | -1, s: number): void {
    const m = (x0 + x1) / 2, h0 = (m - x0) * s, a = m - h0, b = m + h0, q = Math.min(bh * 0.9, h0 / 2), y1 = y + dir * bh / 2, y2 = y + dir * bh;
    g.beginPath();
    g.moveTo(a, y);
    g.quadraticCurveTo(a, y1, a + q, y1);
    g.lineTo(m - q, y1);
    g.quadraticCurveTo(m, y1, m, y2);
    g.quadraticCurveTo(m, y1, m + q, y1);
    g.lineTo(b - q, y1);
    g.quadraticCurveTo(b, y1, b, y);
    g.stroke();
  }
  draw(env: DrawEnv): void {
    const g = env.g as CanvasRenderingContext2D, open = Math.max(0, Math.min(1, read(this.open))), o = open * open * (3 - 2 * open);
    const fade = Math.max(0, Math.min(1, read(this.fade))), fe = fade * fade * (3 - 2 * fade);
    const n = Math.round(read(this.layer)), F = this.focus_of(n), shown = F ? F.children : this.roots;
    const ink = this.text_color;
    // the formula: the shown blocks in their colours; the rest of the block they make up in ink; the rest stepping back
    const lit = new Map<Token, string>();
    for (const nd of shown) for (const t of nd.tokens) lit.set(t, nd.color);
    const inner = new Set(F ? F.tokens : this.line.tokens);
    const back = 1 - 0.66 * o * (F ? 1 : 0);
    const groups = new Map<string, { ts: Token[]; a: number }>();
    for (const t of this.line.tokens) {
      const c = lit.get(t), color = c && o > 0.01 ? mix(ink, c, o * fe) : ink, a = inner.has(t) ? 1 : back;
      const key = `${color}|${a}`;
      (groups.get(key) ?? groups.set(key, { ts: [], a }).get(key)!).ts.push(t);
    }
    for (const [key, gr] of groups) this.glyphs(g, gr.ts, key.split('|')[0], gr.a);
    // whole: a dotted line under each outer block (something is folded here)
    const px = this.px(), bh = px * 0.3;
    if (o < 0.999) {
      g.save();
      g.globalAlpha *= 1 - o;
      g.fillStyle = 'rgba(98,102,109,0.8)';
      const k = tex_scale(px), base = this.y0 + (this.line.view[1] + this.line.view[3]) * k + px * 0.08;
      for (const nd of this.roots) {
        const e = this.extent(nd.tokens);
        for (let x = this.x0 + e.x0 + 1; x < this.x0 + e.x1 - 1; x += 5) { g.beginPath(); g.arc(x, base, 0.95, 0, Math.PI * 2); g.fill(); }
      }
      g.restore();
    }
    if (o < 0.01) return;
    const f = this.label_font(), lineh = f.size * look().type.caption.line;
    for (const m of this.plan(n).marks) {
      const a = o * (m.outer ? 0.62 : fe), grow = m.outer ? 1 : fe;
      if (a < 0.01) continue;
      g.save();
      g.globalAlpha *= a;
      g.strokeStyle = m.node.color;
      g.lineWidth = Math.max(1.2, px * 0.045);
      g.lineCap = 'round';
      g.lineJoin = 'round';
      this.brace(g, this.x0 + m.x0, this.x0 + m.x1, this.y0 + m.y, bh, m.side, grow);
      // a leader from the tip to its words: straight down when they are beyond it; else down to the gap above the
      // row of words, along it, and into them (so it passes no other words)
      const tipx = this.x0 + (m.x0 + m.x1) / 2, tipy = this.y0 + m.tip + m.side * 2;
      const lx0 = this.x0 + m.label.x, edge = this.y0 + (m.side === 1 ? m.label.y : m.label.y + m.label.h) - m.side * 3;
      const ax = Math.max(lx0 + 6, Math.min(lx0 + m.label.w - 6, tipx));
      if (Math.abs(edge - tipy) > px * 0.3 || Math.abs(ax - tipx) > 1) {
        g.lineWidth = 0.9;
        g.beginPath();
        g.moveTo(tipx, tipy);
        if (Math.abs(ax - tipx) <= 1) g.lineTo(tipx, edge);
        else {
          const ym = edge - m.side * Math.min(px * 0.22, Math.abs(edge - tipy) / 2), r = Math.min(4, Math.abs(ax - tipx) / 2), dx = Math.sign(ax - tipx);
          g.lineTo(tipx, ym - m.side * r);
          g.quadraticCurveTo(tipx, ym, tipx + dx * r, ym);
          g.lineTo(ax - dx * r, ym);
          g.quadraticCurveTo(ax, ym, ax, ym + m.side * r);
          g.lineTo(ax, edge);
        }
        g.stroke();
      }
      g.font = font_css(f);
      g.fillStyle = m.outer ? env.look.palette.ink2 : m.node.color;
      g.textBaseline = 'top';
      m.label.lines.forEach((l, i) => {
        const w = g.measureText(l).width;
        g.fillText(l, this.x0 + m.label.x + (m.label.w - w) / 2, this.y0 + m.label.y + i * lineh);
      });
      g.restore();
    }
  }
}

/** A colour u of the way from a to b (hex; anything else jumps half way). */
function mix(a: string, b: string, u: number): string {
  const p = /^#([0-9a-f]{6})$/i.exec(a), q = /^#([0-9a-f]{6})$/i.exec(b);
  if (!p || !q) return u < 0.5 ? a : b;
  const x = parseInt(p[1], 16), y = parseInt(q[1], 16), c = (sh: number) => Math.round(((x >> sh) & 255) + ((((y >> sh) & 255) - ((x >> sh) & 255)) * Math.max(0, Math.min(1, u))));
  return `#${((c(16) << 16) | (c(8) << 8) | c(0)).toString(16).padStart(6, '0')}`;
}

/**
 * A figure of one formula read block by block. `tour`: its script opens it and goes through every layer and back (a
 * gallery's demo, a video); else it waits whole for a tap (the page's hands).
 */
export function parts_figure(tex: string, parts: FormulaPart[], o: { lang?: Lang; size?: number; paper?: boolean; tour?: boolean } = {}): Figure & { formula: Parts } {
  const fig = new Figure({ lang: o.lang ?? 'en' }) as Figure & { formula: Parts };
  if (o.paper === false) fig.paper = 'clear';
  const p = new Parts(tex, parts, { id: 'parts', size: o.size });
  fig.formula = p;
  for (const q of [p.open, p.layer, p.fade]) fig.params.set(q.name, q);
  fig.layout(column([p]), o.paper === false ? { pad: 2 } : {});
  if (o.tour) {
    const go = (n: number): Step[] => [set(p.fade, 0, 'linear', 0.001), set(p.layer, n, 'linear', 0.001), set(p.fade, 1, 'travel', 0.5), wait(2.6)];
    fig.script(wait(0.8), set(p.open, 1, 'travel', 0.6), wait(2.6), ...p.opens.flatMap((_, i) => go(i + 1)), ...go(0), set(p.open, 0, 'travel', 0.6));
  }
  fig.check('every block is in the formula, each inside the block it is part of', () => (p.issues.length ? p.issues.join('; ') : null));
  fig.check("no layer's words meet, and all are inside the figure", () => {
    const bad: string[] = [];
    for (let n = 0; n <= p.opens.length; n++) {
      const ms = p.plan(n).marks.filter((m) => !m.outer);
      for (let i = 0; i < ms.length; i++) for (let j = i + 1; j < ms.length; j++) {
        const a = ms[i].label, b = ms[j].label;
        if (ms[i].side === ms[j].side && a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h) bad.push(`layer ${n}: "${ms[i].node.part.tex}" meets "${ms[j].node.part.tex}"`);
      }
    }
    return bad.length ? bad.join('; ') : null;
  });
  return fig;
}

// ---------------------------------------------------------------- entry
define_thing({
  name: 'parts', says: t('a formula read block by block and layer by layer: each block (one symbol or several terms) in its colour with what it means; a block opens into the blocks it is made of', '一块一块、一层一层读的公式：每一块（一个符号或几项）有自己的颜色和意思；点开一块，看到它由哪几块组成'),
  zones: ['figure', 'text'], maturity: 'stable', since: '0.2.1', from: 'int/explode',
  syntax: "parts_figure(tex, [{ tex: 'P(B\\\\mid A)\\\\,P(A)', says: 'how often A and B happen together', parts: [{ tex: 'P(A)', says: 'the prior' }] }, …], { lang })",
  rules: ['each block as it is written in the formula; several terms that mean one thing are one block', "a block's own blocks are its next layer: the big picture first, the inside on demand", 'write the formula in the form whose blocks carry the idea (−b/2a ± …, not one bar over everything)'],
  accept: t('every block found inside the block it belongs to; no layer\'s words meet; whole, every glyph is where it was typeset', '每一块都在它所属的块里找到；同一层的文字互不相碰；合上时每个字形都在排版位置'),
  demo: (lang) => parts_figure('P(A\\mid B) = \\frac{P(B\\mid A)\\,P(A)}{P(B)}', [
    { tex: 'P(A\\mid B)', says: lang === 'zh' ? '看到 B 之后，A 有多可能' : 'how likely A is, now that B is seen' },
    { tex: '\\frac{P(B\\mid A)\\,P(A)}{P(B)}', says: lang === 'zh' ? '在 B 发生的情况里，A 也成立的份额' : "the share of B's cases in which A also holds", parts: [
      { tex: 'P(B\\mid A)\\,P(A)', says: lang === 'zh' ? 'A 和 B 一起发生有多常见' : 'how often A and B happen together', parts: [
        { tex: 'P(B\\mid A)', says: lang === 'zh' ? 'A 成立时 B 有多可能' : 'how likely B is if A is true' },
        { tex: 'P(A)', says: lang === 'zh' ? '没看证据前 A 有多常见' : 'how common A is before any evidence' }] },
      { tex: 'P(B)', says: lang === 'zh' ? 'B 总共有多常见' : 'how often B happens at all' }] }], { lang, tour: true }),
  source: 'packages/engine/src/lib/parts.ts',
});
