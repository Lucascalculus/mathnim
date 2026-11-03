// Layout by rules, not coordinates (docs/design/ENGINE.md §4.3). Four relations only - side by side, one above the
// other, a grid, and attached to - plus label avoidance and explain(). No general constraint solver: every decision
// is a rule a person or an agent can read, and every thing records why it is where it is.
//
// Blocks are measured height-for-width (the width comes from above), then arranged in the box they are given. A
// figure is laid out for the device it is on: on a phone, rows become columns.
import type { Look } from '@mathnim/look';
import { overlap, segment_hits_box, type Box, type XY } from './geom';
import type { Obstacle, Thing } from './thing';
import type { Lang } from './text';

export interface LayoutEnv {
  look: Look;
  lang: Lang;
  phone: boolean;
}
export interface Size {
  /** Natural height at this width. */
  h: number;
  /** The least height it can take (a plot shrinks to this; text never shrinks). */
  min: number;
  /** It may take more height than it needs (a plot with no fixed aspect fills its row). */
  grow?: boolean;
}
export interface Block {
  measure(w: number, env: LayoutEnv): Size;
  arrange(b: Box, env: LayoutEnv): void;
  /** The things it shows (for the registry). */
  things(): Thing[];
  /** A short name for explain(). */
  label(): string;
  /** When space runs out, lower priorities give up their height first (default 1; a figure's main plot: 2). */
  priority?(): number;
  /** A remark that gives way (is left out) when its column cannot fit everything at its least height. */
  optional?: boolean;
}
const prio = (b: Block): number => b.priority?.() ?? 1;

type Align = 'start' | 'center' | 'end';
interface ContainerOpts { gap?: number; align?: Align; weights?: number[]; phone?: 'row' | 'column' }

abstract class Container implements Block {
  constructor(public kids: Block[], public o: ContainerOpts = {}) {}
  things(): Thing[] {
    return this.kids.flatMap((k) => k.things());
  }
  priority(): number {
    return Math.max(1, ...this.kids.map(prio));
  }
  gap(env: LayoutEnv): number {
    return this.o.gap ?? env.look.space.gap;
  }
  abstract measure(w: number, env: LayoutEnv): Size;
  abstract arrange(b: Box, env: LayoutEnv): void;
  abstract label(): string;
}

/** One above the other. */
export class Column extends Container {
  label(): string {
    return 'column';
  }
  measure(w: number, env: LayoutEnv): Size {
    const g = this.gap(env) * Math.max(0, this.kids.length - 1);
    const s = this.kids.map((k) => k.measure(w, env));
    return { h: s.reduce((a, x) => a + x.h, 0) + g, min: s.reduce((a, x) => a + x.min, 0) + g, grow: s.some((x) => x.grow) };
  }
  arrange(b: Box, env: LayoutEnv): void {
    // what cannot fit at its least height: optional remarks give way, the last first
    let kids = this.kids;
    const least = (ks: Block[]) => ks.reduce((a, k) => a + k.measure(b.w, env).min, 0) + this.gap(env) * Math.max(0, ks.length - 1);
    for (let i = kids.length - 1; i >= 0 && least(kids) > b.h + 0.5; i--) {
      if (!kids[i].optional) continue;
      for (const t of kids[i].things()) {
        t.dropped = true;
        t.why.push(`left out: its column has no room (an optional remark)`);
      }
      kids = kids.filter((_, j) => j !== i);
    }
    if (kids !== this.kids) return new Column(kids, this.o).arrange(b, env);
    const gap = this.gap(env);
    const s = this.kids.map((k) => k.measure(b.w, env));
    const nat = s.reduce((a, x) => a + x.h, 0) + gap * Math.max(0, this.kids.length - 1);
    // too tall: shrink what can shrink, the lowest priority first, each level in proportion to what it can give
    const hs = s.map((x) => x.h);
    let need = nat - b.h;
    if (need > 0.5) {
      const levels = [...new Set(this.kids.map(prio))].sort((a, c) => a - c);
      for (const lv of levels) {
        if (need <= 0.5) break;
        const idx = this.kids.map((k, i) => (prio(k) === lv ? i : -1)).filter((i) => i >= 0);
        const give = idx.reduce((a, i) => a + (hs[i] - s[i].min), 0);
        const k = give > 0 ? Math.min(1, need / give) : 0;
        for (const i of idx) hs[i] -= (hs[i] - s[i].min) * k;
        need -= give * k;
      }
      if (levels.length > 1) this.kids.forEach((kid, i) => hs[i] < s[i].h - 0.5 && kid.things()[0]?.why.push(`shrunk to fit (priority ${prio(kid)})`));
    }
    // spare height goes to what can grow (a plot with no fixed aspect), shared equally
    const growers = s.map((x, i) => (x.grow ? i : -1)).filter((i) => i >= 0);
    const spare = b.h - (hs.reduce((a, x) => a + x, 0) + gap * Math.max(0, this.kids.length - 1));
    if (spare > 0.5 && growers.length) for (const i of growers) hs[i] += spare / growers.length;
    const used = hs.reduce((a, x) => a + x, 0) + gap * Math.max(0, this.kids.length - 1);
    const align = this.o.align ?? 'start';
    let y = b.y + (align === 'center' ? Math.max(0, (b.h - used) / 2) : align === 'end' ? Math.max(0, b.h - used) : 0);
    this.kids.forEach((k, i) => {
      k.arrange({ x: b.x, y, w: b.w, h: hs[i] }, env);
      y += hs[i] + gap;
    });
  }
}

/** Side by side (a column on a phone, unless phone: 'row'). */
export class Row extends Container {
  label(): string {
    return 'row';
  }
  private as_column(env: LayoutEnv): boolean {
    return env.phone && this.o.phone !== 'row';
  }
  private widths(w: number, env: LayoutEnv): number[] {
    const n = this.kids.length, gap = this.gap(env) * Math.max(0, n - 1);
    const wt = this.o.weights ?? this.kids.map(() => 1), sum = wt.reduce((a, x) => a + x, 0);
    return wt.map((x) => ((w - gap) * x) / sum);
  }
  measure(w: number, env: LayoutEnv): Size {
    if (this.as_column(env)) return new Column(this.kids, { gap: this.o.gap }).measure(w, env);
    const ws = this.widths(w, env);
    const s = this.kids.map((k, i) => k.measure(ws[i], env));
    return { h: Math.max(0, ...s.map((x) => x.h)), min: Math.max(0, ...s.map((x) => x.min)), grow: s.some((x) => x.grow) };
  }
  arrange(b: Box, env: LayoutEnv): void {
    if (this.as_column(env)) return new Column(this.kids, { gap: this.o.gap, align: this.o.align }).arrange(b, env);
    const ws = this.widths(b.w, env), gap = this.gap(env);
    let x = b.x;
    const align = this.o.align ?? 'start';
    this.kids.forEach((k, i) => {
      const s = k.measure(ws[i], env), h = s.grow ? b.h : Math.min(b.h, Math.max(s.min, Math.min(s.h, b.h)));
      const y = b.y + (align === 'center' ? (b.h - h) / 2 : align === 'end' ? b.h - h : 0);
      k.arrange({ x, y, w: ws[i], h: align === 'start' && s.h >= b.h ? b.h : h }, env);
      x += ws[i] + gap;
    });
  }
}

/** A grid of equal cells (fewer columns on a phone). */
export class Grid extends Container {
  constructor(kids: Block[], public cols: number, o: ContainerOpts & { phone_cols?: number } = {}) {
    super(kids, o);
  }
  label(): string {
    return `grid(${this.cols})`;
  }
  private rows(env: LayoutEnv): Block[][] {
    const c = env.phone ? ((this.o as { phone_cols?: number }).phone_cols ?? Math.min(2, this.cols)) : this.cols;
    const out: Block[][] = [];
    for (let i = 0; i < this.kids.length; i += c) out.push(this.kids.slice(i, i + c));
    return out;
  }
  private as_rows(env: LayoutEnv): Column {
    const rows = this.rows(env), c = rows[0]?.length ?? 1;
    return new Column(rows.map((r) => new Row([...r, ...Array(c - r.length).fill(new Spacer(0))], { gap: this.o.gap, phone: 'row' })), { gap: this.o.gap });
  }
  measure(w: number, env: LayoutEnv): Size {
    return this.as_rows(env).measure(w, env);
  }
  arrange(b: Box, env: LayoutEnv): void {
    this.as_rows(env).arrange(b, env);
  }
}

/** Empty space of a given height. */
export class Spacer implements Block {
  constructor(public h: number) {}
  measure(): Size {
    return { h: this.h, min: this.h };
  }
  arrange(): void {}
  things(): Thing[] {
    return [];
  }
  label(): string {
    return 'spacer';
  }
}

/**
 * Exact placement (the freedom layer): each block in its own rectangle of a design frame, the frame scaled to fit the
 * box and centred. The default frame is manim's (x −7.11..7.11, y −4..4, y up), so a manim figure's boxes carry over
 * as they are. On a phone the blocks fall back to a column, in order, unless the figure gives a phone composition.
 */
export class Place implements Block {
  constructor(public items: { block: Block; at: [number, number, number, number] }[], public o: { frame?: { x: [number, number]; y: [number, number] } } = {}) {}
  private fr() {
    return this.o.frame ?? { x: [-64 / 9, 64 / 9] as [number, number], y: [-4, 4] as [number, number] };
  }
  label(): string {
    return 'place';
  }
  things(): Thing[] {
    return this.items.flatMap((it) => it.block.things());
  }
  priority(): number {
    return Math.max(1, ...this.items.map((it) => prio(it.block)));
  }
  measure(w: number, env: LayoutEnv): Size {
    if (env.phone) return new Column(this.items.map((it) => it.block)).measure(w, env);
    const f = this.fr(), h = (w * (f.y[1] - f.y[0])) / (f.x[1] - f.x[0]);
    return { h, min: h * 0.6 };
  }
  arrange(b: Box, env: LayoutEnv): void {
    if (env.phone) return new Column(this.items.map((it) => it.block)).arrange(b, env);
    const f = this.fr(), FW = f.x[1] - f.x[0], FH = f.y[1] - f.y[0];
    const k = Math.min(b.w / FW, b.h / FH), ox = b.x + (b.w - FW * k) / 2, oy = b.y + (b.h - FH * k) / 2;
    for (const { block, at } of this.items) {
      const [x0, x1, y0, y1] = at;
      block.arrange({ x: ox + (x0 - f.x[0]) * k, y: oy + (f.y[1] - y1) * k, w: (x1 - x0) * k, h: (y1 - y0) * k }, env);
      block.things()[0]?.why.push(`placed by the figure at x ${x0}..${x1}, y ${y0}..${y1} of its frame`);
    }
  }
}

export const row = (kids: Block[], o?: ContainerOpts): Row => new Row(kids, o);
/** Exact placement: `place([[block, [x0, x1, y0, y1]], …])` in a frame (default manim's, y up). */
export const place = (items: [Block, [number, number, number, number]][], o?: { frame?: { x: [number, number]; y: [number, number] } }): Place => new Place(items.map(([block, at]) => ({ block, at })), o);
export const column = (kids: Block[], o?: ContainerOpts): Column => new Column(kids, o);
/** Mark a block as a remark that gives way when there is no room for it. */
export const optional = <B extends Block>(b: B): B => ((b.optional = true), b);
export const grid = (kids: Block[], cols: number, o?: ContainerOpts & { phone_cols?: number }): Grid => new Grid(kids, cols, o);

// ------------------------------------------------------------------ attached labels and avoidance

export type Side = 'right' | 'above-right' | 'above' | 'above-left' | 'left' | 'below-left' | 'below' | 'below-right' | 'center';
export const ALL_SIDES: Side[] = ['above-right', 'right', 'below-right', 'above', 'below', 'above-left', 'left', 'below-left'];
export type Anchor = XY | Box;
const is_box = (a: Anchor): a is Box => !Array.isArray(a);

/** Where a label of size w×h goes on `side` of an anchor, `gap` away. */
export function place_at(a: Anchor, side: Side, w: number, h: number, gap: number): Box {
  const b = is_box(a) ? a : { x: a[0], y: a[1], w: 0, h: 0 };
  const cx = b.x + b.w / 2, cy = b.y + b.h / 2;
  const L = b.x - gap - w, R = b.x + b.w + gap, T = b.y - gap - h, B = b.y + b.h + gap;
  // a point's diagonal places sit a little closer (the gap is measured along the diagonal)
  const d = is_box(a) ? 0 : gap * 0.3;
  switch (side) {
    case 'center': return { x: cx - w / 2, y: cy - h / 2, w, h };
    case 'right': return { x: R, y: cy - h / 2, w, h };
    case 'left': return { x: L, y: cy - h / 2, w, h };
    case 'above': return { x: cx - w / 2, y: T, w, h };
    case 'below': return { x: cx - w / 2, y: B, w, h };
    case 'above-right': return { x: R - d, y: T + d, w, h };
    case 'above-left': return { x: L + d, y: T + d, w, h };
    case 'below-right': return { x: R - d, y: B - d, w, h };
    case 'below-left': return { x: L + d, y: B - d, w, h };
  }
}

export interface Placement { box: Box; side: Side; cost: number; why: string }
/**
 * Choose the side for a label: the first preferred side that is clear, else the one that hides least. Cost: area
 * hidden under other labels and things, lines crossed, points covered, and anything outside the bounds.
 */
export function place_label(a: Anchor, w: number, h: number, o: { sides?: Side[]; gap: number; bounds: Box; obstacles: { o: Obstacle; owner: string }[] }): Placement {
  const sides = o.sides?.length ? o.sides : ALL_SIDES;
  let best: Placement | null = null;
  const rejected: string[] = [];
  // the near ring first; then, a little further out, the same sides again (a crowded spot), at a small extra cost
  const tries = [...sides.map((side) => ({ side, gap: o.gap })), ...sides.map((side) => ({ side, gap: o.gap * 3.5 }))];
  tries.forEach(({ side, gap }, rank) => {
    const b = place_at(a, side, w, h, gap);
    let cost = rank * 0.5, worst = '';
    let worst_c = 0;
    // outside the bounds
    const out = w * h - overlap(b, o.bounds);
    if (out > 0.5) {
      cost += out * 4;
      worst = 'outside the figure';
      worst_c = out * 4;
    }
    for (const { o: ob, owner } of o.obstacles) {
      let c = 0;
      if ('box' in ob) c = overlap(b, ob.box) * (ob.weight ?? 1);
      else if ('seg' in ob) c = segment_hits_box(ob.seg[0], ob.seg[1], b) ? 60 * (ob.weight ?? 1) : 0;
      else {
        const dx = Math.max(b.x - ob.pt[0], 0, ob.pt[0] - (b.x + b.w)), dy = Math.max(b.y - ob.pt[1], 0, ob.pt[1] - (b.y + b.h));
        const dist = Math.hypot(dx, dy);
        c = dist < ob.r ? (ob.r - dist) * 40 * (ob.weight ?? 1) : 0;
      }
      if (c > worst_c) {
        worst_c = c;
        worst = owner;
      }
      cost += c;
    }
    if (cost - rank * 0.5 > 0.5 && gap === o.gap) rejected.push(`${side} (hits ${worst})`);
    if (!best || cost < best.cost) best = { box: b, side, cost, why: '', rank } as Placement & { rank: number };
  });
  const p = best! as Placement & { rank: number };
  const clear = p.cost - p.rank * 0.5 <= 0.5;
  p.why = clear
    ? `${p.side}${p.rank >= sides.length ? ' (further out: the near places are taken)' : ''}${rejected.length ? `; not ${rejected.join(', ')}` : ''}`
    : `${p.side}, the least hidden place (every side hits something: ${rejected.join(', ')})`;
  return p;
}
