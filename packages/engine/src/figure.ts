// A figure: params, the things that show them, how they are laid out, what happens in what order (the script), what
// the hand can move, and what must stay true. It is what a visual returns and what the FigurePlayer plays.
//
//   const f = new Figure({ lang });
//   const a = f.param('a', 1, { range: [-2, 2] });
//   const P = f.plot({ x: [-2, 2], y: [-2, 2], aspect: 'equal' });
//   const curve = P.add(new Path(() => …, { role: 'noun:cost' }));
//   f.layout(row([P, column([f.caption(t('…', '…'))])]));
//   f.script(reveal(P), beat(), set(a, 2));
import { look, known_noun, type Look } from '@mathnim/look';
import { inflate, overlap, type Box, type XY } from './geom';
import { CanvasBlock, Handle, Label, Legend, ListBlock, Plot, Readout, TextBlock, type LabelOpts, type LegendEntry, type Part, type PlotSpec } from './kinds';
import { Column, place_at, place_label, type Block, type LayoutEnv } from './layout';
import { Hands } from './acts';
import { Renderer, paint_background } from './render';
import { Timeline, type Step } from './script';
import { derive, now_version, param, read, untracked, type Derived, type Param, type ParamSpec, type Val } from './state';
import { tr, type L10n, type Lang, type TextKind } from './text';
import { Registry, contrast, type DrawEnv, type Obstacle, type Style, type Thing } from './thing';

export type Listener = (type: string, data: Record<string, unknown>) => void;

/** The shares of a path's length a label that slides along it tries, the middle first (each a little dearer than the last). */
const ALONG = [0.5, 0.38, 0.62, 0.26, 0.74, 0.15, 0.85, 0.07, 0.93];
function best_along(at: (u: number) => XY | null, stands: number[], sz: { w: number; h: number }, o: Parameters<typeof place_label>[3]): ReturnType<typeof place_label> {
  let best: (ReturnType<typeof place_label> & { k: number }) | null = null;
  stands.forEach((u, k) => {
    const a = at(u);
    if (!a) return;
    const c = place_label(a, sz.w, sz.h, o);
    const cost = c.cost + k * 0.4;
    if (!best || cost < best.cost) best = { ...c, cost, k };
  });
  if (!best) return place_label([0, 0], sz.w, sz.h, o);
  const b = best as ReturnType<typeof place_label> & { k: number };
  return { ...b, why: `along its path at ${Math.round(stands[b.k] * 100)}%: ${b.why}` };
}
export interface Issue { severity: 'error' | 'warning'; rule: string; thing?: string; message: string; fix?: string }

export class Figure {
  /** Marks this object as an engine figure (players and the runtime test for it). */
  readonly engine_figure = true;
  readonly registry = new Registry();
  readonly params = new Map<string, Param<number>>();
  root: Block = new Column([]);
  labels: Label[] = [];
  handles: Handle[] = [];
  /** Small print under the figure (the page shows it, not the canvas). */
  asides: string[] = [];
  /** (export_video mixes a scene's sounds; a figure has none) */
  readonly sounds: { src: string; time: number; gain: number | null }[] = [];
  timeline: Timeline | null = null;
  lang: Lang;
  frame: Box = { x: 0, y: 0, w: 960, h: 540 };
  phone = false;
  renderer = new Renderer();
  /** 'paper': the look's paper behind everything (a figure on its own stage); 'clear': nothing, so the figure sits in
   *  the text it is part of (formula steps in an answer). */
  paper: 'paper' | 'clear' = 'paper';
  private steps: Step[] = [];
  private listeners: Listener[] = [];
  private checks: { name: string; f: (fig: Figure) => string | null }[] = [];
  private reporter: (() => Record<string, unknown>) | null = null;
  private laid_out = '';

  constructor(o: { lang?: Lang; id?: string } = {}) {
    this.lang = o.lang ?? 'en';
  }

  // ---------------------------------------------------------------- authoring
  param(name: string, v: number, spec: ParamSpec = {}): Param<number> {
    const p = param(v, { ...spec, name });
    this.params.set(name, p);
    return p;
  }
  derive<T>(f: () => T, name = ''): Derived<T> {
    return derive(f, name);
  }
  caption(content: Val<string | L10n>, o: { id?: string; role?: string; kind?: TextKind; align?: 'left' | 'center' | 'right'; max_lines?: number; weight?: number; style?: Style } = {}): TextBlock {
    return new TextBlock(content, { kind: 'caption', ...o });
  }
  list(items: Val<string | L10n>[], o: { id?: string; kind?: TextKind; role?: string } = {}): ListBlock {
    return new ListBlock(items, o);
  }
  readout(parts: Part[], o: { id?: string; role?: Val<string>; says?: L10n; kind?: TextKind; style?: Style } = {}): Readout {
    return new Readout(parts, o);
  }
  legend(entries: LegendEntry[], o: ConstructorParameters<typeof Legend>[1] = {}): Legend {
    return new Legend(entries, o);
  }
  plot(spec: PlotSpec): Plot {
    return new Plot(spec);
  }
  canvas(paint: ConstructorParameters<typeof CanvasBlock>[0], o: ConstructorParameters<typeof CanvasBlock>[1] = {}): CanvasBlock {
    return new CanvasBlock(paint, o);
  }
  /** A label attached to a thing or a point (CSS px, or data coordinates through `plot`). */
  label(content: Val<string | L10n>, anchor: Val<XY | Box | null> | Thing, o: Omit<LabelOpts, 'to'> & { on?: Plot; within?: () => Box; own?: Thing[] } = {}): Label {
    const to = typeof anchor === 'object' && anchor !== null && 'draw' in anchor ? (anchor as Thing) : undefined;
    const a: Val<XY | Box | null> = to
      ? () => {
          const m = to as Thing & { where?: () => XY | null };
          return to.visible() ? (m.where ? m.where() : to.box.w ? to.box : null) : null;
        }
      : o.on
        ? () => {
            const v = read(anchor as Val<XY | null>);
            return v ? o.on!.P(v as XY) : null;
          }
        : (anchor as Val<XY | Box | null>);
    const l = new Label(content, a, { ...o, to });
    (l as Label & { within?: () => Box }).within = o.within;
    // (the things it names are not in its way)
    l.own = [...(to ? [to.id] : []), ...(o.own ?? []).map((t) => t.id)];
    if (to) l.opacity.set(1);
    this.labels.push(l);
    return l;
  }
  /** A glass handle moving params through a plot. */
  handle(plot: Plot, px: Param<number>, py: Param<number> | null, o: { id?: string; says?: L10n; on_end?: () => void } = {}): Handle {
    const h = new Handle(px, py, { ...o, on_end: () => o.on_end?.(), on_move: () => this.emit('dragged', this.report()) });
    h.opacity.set(0); // (shown only where the hand can move it: the player's explore mode)
    plot.add(h);
    this.handles.push(h);
    return h;
  }
  aside(s: string | L10n): void {
    this.asides.push(tr(s, this.lang));
  }
  /** How the figure is composed; a phone may get its own composition of the same things (`phone`). */
  layout(root: Block, o: { phone?: Block; pad?: number; design_w?: number } = {}): void {
    this.root = root;
    this.phone_root = o.phone ?? null;
    this.pad = o.pad ?? null;
    this.design_w = o.design_w ?? null;
  }
  /**
   * A desktop composition made for one width (px): laid out at that width and drawn scaled to the stage, text, lines
   * and all, as a manim scene was (a figure placed in the manim frame keeps its proportions at any size). The phone
   * composition is laid out at its own size.
   */
  design_w: number | null = null;
  /** Stage px per layout px (1 unless the figure has a design width). */
  view_scale = 1;
  /** The space around the composition on a desktop (px; default the look's), e.g. 0 for a manim frame placed edge to edge. */
  pad: number | null = null;
  phone_root: Block | null = null;
  script(...steps: Step[]): void {
    this.steps = steps;
  }
  /** What the figure reports to a world (and the doctor's description): default, its params. */
  report_with(f: () => Record<string, unknown>): void {
    this.reporter = f;
  }
  report(): Record<string, unknown> {
    return untracked(() => (this.reporter ? this.reporter() : Object.fromEntries([...this.params].map(([k, p]) => [k, p.value]))));
  }
  /** An invariant: returns null when it holds, else what is wrong. The doctor runs it at the end of the script. */
  check(name: string, f: (fig: Figure) => string | null): void {
    this.checks.push({ name, f });
  }
  listen(f: Listener): void {
    this.listeners.push(f);
  }
  emit(type: string, data: Record<string, unknown> = {}): void {
    for (const f of this.listeners) f(type, data);
  }
  /**
   * Tell the lesson what the learner did with the figure (Mathium's reports, docs/REPORTS.md): one attempt at one
   * thing ({ kind: 'answer', item, correct }), a finished task ({ kind: 'done', score }), or what it shows now in a
   * sentence ({ kind: 'state', text }). The page counts answers as practice and gives the state to the tutor.
   */
  tell(r: { kind: 'answer'; item: string; correct: boolean; response?: string } | { kind: 'done'; score?: number } | { kind: 'state'; text: string }): void {
    this.emit('report', r);
  }

  // ---------------------------------------------------------------- building
  /** Register the things and compile the script (once). */
  build(): void {
    if (this.timeline) return;
    for (const t of [...this.root.things(), ...(this.phone_root?.things() ?? [])]) if (!this.registry.get(t.id)) this.registry.add(t);
    for (const t of this.labels) if (!this.registry.get(t.id)) this.registry.add(t);
    for (const t of this.handles) if (!this.registry.get(t.id)) this.registry.add(t);
    // (handles are not the script's: the player shows them in an explore step)
    const handles = new Set<Thing>(this.handles);
    this.timeline = new Timeline(this.steps, this.registry.all().filter((t) => !handles.has(t)));
  }
  /** Lay out for a frame of w × h CSS px (h undefined: as tall as the content wants). Returns the size used. */
  layout_for(w: number, h?: number): { w: number; h: number } {
    this.build();
    const l = look();
    this.phone = w < l.layout.phone_below;
    // (a design width: lay out at it, report the stage's size)
    this.view_scale = !this.phone && this.design_w ? w / this.design_w : 1;
    if (this.view_scale !== 1) {
      const s = this.view_scale, r = this.layout_at(this.design_w!, h === undefined ? undefined : h / s);
      return { w, h: r.h * s };
    }
    return this.layout_at(w, h);
  }
  private layout_at(w: number, h?: number): { w: number; h: number } {
    const l = look();
    const env: LayoutEnv = { look: l, lang: this.lang, phone: this.phone };
    const pad = this.phone ? l.space.pad * 0.75 : this.pad ?? l.space.pad;
    const inner = w - 2 * pad;
    for (const t of this.registry.all()) {
      t.why = [];
      t.dropped = false;
    }
    const root = this.phone && this.phone_root ? this.phone_root : this.root;
    // (things the phone composition leaves out are not shown there)
    const placed = new Set(root.things());
    for (const t of this.registry.all()) if (!t.parent && !placed.has(t) && !this.labels.includes(t as Label) && !this.handles.includes(t as Handle) && !(t as { plot?: unknown }).plot) t.box = { x: 0, y: 0, w: 0, h: 0 };
    const nat = untracked(() => root.measure(inner, env));
    const H = h ?? Math.min(Math.max(nat.h + 2 * pad, 120), w * (this.phone ? l.layout.phone_max_tall : 1.2));
    untracked(() => root.arrange({ x: pad, y: pad, w: inner, h: H - 2 * pad }, env));
    this.placed = placed;
    this.frame = { x: 0, y: 0, w, h: H };
    this.laid_out = `${w}x${H}|${this.lang}|${l.theme}`;
    this.renderer.invalidate();
    return { w, h: H };
  }
  /** Seconds of script. */
  get duration(): number {
    this.build();
    return this.timeline!.duration;
  }
  at(t: number): void {
    this.build();
    this.timeline!.at(t);
  }
  /** Start times of the sections after the first (beats). */
  section_starts(): number[] {
    this.build();
    return this.timeline!.sections;
  }

  // ---------------------------------------------------------------- drawing
  /** The things the current composition shows (all of them before the first layout). */
  private placed: Set<Thing> | null = null;
  private body(): Thing[] {
    const overlay = new Set<Thing>(this.overlay());
    const shown = (t: Thing) => !this.placed || this.placed.has(t) || !!(t as { plot?: Thing }).plot && this.placed.has((t as { plot?: Thing }).plot!);
    return this.registry.ordered().filter((t) => !overlay.has(t) && shown(t) && !t.dropped);
  }
  /** What is drawn over the figure: attached labels, handles, and the tutor's light. */
  private overlay(): Thing[] {
    return [...this.labels, ...this.handles, ...(this._hands ? [this._hands.light] : [])];
  }
  private _hands: Hands | null = null;
  /** The tutor's hands on this figure (acts.ts): made the first time the tutor acts. */
  hands(): Hands {
    this.build();
    return (this._hands ??= new Hands(this));
  }
  /** Put the attached labels where they hide least (in order; each placed label becomes an obstacle for the next). */
  place_labels(): void {
    const obstacles: { o: Obstacle; owner: string }[] = [];
    for (const t of this.body()) if (t.visible()) for (const o of t.obstacles()) obstacles.push({ o, owner: t.id });
    for (const h of this.handles) for (const o of h.obstacles()) obstacles.push({ o, owner: h.id });
    for (const l of this.labels) {
      const gap = l.o.gap ?? look().space.label_gap;
      const a = untracked(() => read(l.anchor));
      const sz = untracked(() => l.size(this.lang));
      if (!a || !sz.w || !l.visible()) {
        l.box = { x: 0, y: 0, w: 0, h: 0 };
        continue;
      }
      const bounds = (l as Label & { within?: () => Box }).within?.() ?? inflate(this.frame, -4);
      const own = l.o.to?.id;
      // (a label that slides along a path: the path is in its way, and every stand along it is tried)
      const path = l.o.along ? (l.o.to as (Thing & { along?: (u: number) => XY | null }) | undefined) : undefined;
      const along = path?.along;
      const stands = Array.isArray(l.o.along) ? l.o.along : ALONG;
      // (the figure may place it itself: no search, its first side as it is)
      const p = along
        ? best_along((u) => along.call(path, u), stands, sz, { sides: l.o.sides, gap, bounds, obstacles: obstacles.filter((x) => !l.own.filter((id) => id !== own).includes(x.owner)) })
        : l.o.avoid === false
          ? { box: place_at(a, l.o.sides?.[0] ?? 'right', sz.w, sz.h, gap), side: l.o.sides?.[0] ?? 'right', why: `${l.o.sides?.[0] ?? 'right'} (placed by the figure, no avoidance)` }
          : place_label(a, sz.w, sz.h, { sides: l.o.sides, gap, bounds, obstacles: obstacles.filter((x) => !l.own.includes(x.owner)) });
      const off = l.o.offset ? untracked(() => read(l.o.offset!)) : undefined;
      l.box = off ? { ...p.box, x: p.box.x + off[0], y: p.box.y + off[1] } : p.box;
      l.side = p.side;
      l.why = [`attached to ${own ?? 'a point'}: ${p.why}${off ? `, moved by (${off[0]}, ${off[1]}) px` : ''}`];
      obstacles.push({ o: { box: inflate(l.box, 2), weight: 3 }, owner: l.id });
    }
  }
  /** Draw a frame; returns false when nothing changed (and nothing was drawn). */
  draw(g: CanvasRenderingContext2D, dpr: number, o: { force?: boolean } = {}): boolean {
    const env: DrawEnv = { g, look: look(), lang: this.lang, dpr: dpr * this.view_scale, frame: this.frame };
    return this.renderer.frame(this.body(), this.overlay(), env, now_version(), {
      force: o.force,
      before: () => this.place_labels(),
      // (no background at all for a clear figure: the renderer then clears the canvas each frame, as an opaque paper never needs)
      background: this.paper === 'clear' ? undefined : paint_background,
    });
  }

  // ---------------------------------------------------------------- checks, description, explanation
  /** The taste lint and the figure's own invariants, on the state drawn last (docs/design/ENGINE.md §4.5). */
  lint(): Issue[] {
    const out: Issue[] = [];
    const l: Look = look();
    const vis = this.registry.all().filter((t) => t.visible() && t.box.w > 0);
    const texts = vis.filter((t) => t.text_px() > 0);
    // overlapping text
    for (let i = 0; i < texts.length; i++)
      for (let j = i + 1; j < texts.length; j++) {
        const a = texts[i], b = texts[j], o = overlap(inflate(a.box, -1), inflate(b.box, -1));
        if (o > 6) out.push({ severity: 'error', rule: 'overlap', thing: a.id, message: `'${a.id}' overlaps '${b.id}' (${o.toFixed(0)} px²)`, fix: `explain('${a.id}') says why each is where it is; attach one of them to its thing, or give the row more room` });
      }
    // outside the frame
    // (marks are clipped to their plot's data area: only an unclipped one can leave the figure)
    const clipped = (t: Thing) => !!(t as { plot?: Plot }).plot && (t as { o?: { clip?: boolean } }).o?.clip !== false && t.kind !== 'handle';
    for (const t of vis) {
      const outside = t.box.w * t.box.h - overlap(t.box, this.frame);
      if (outside > 4 && t.kind !== 'plot' && !clipped(t)) out.push({ severity: 'error', rule: 'outside', thing: t.id, message: `'${t.id}' is ${outside.toFixed(0)} px² outside the figure`, fix: 'the frame is too small for its content on this device: let a row become a column, or shorten the text' });
    }
    // text size and contrast
    for (const t of texts) {
      // (a size or colour the figure chose itself is its call: reported, not blocked)
      const sev = t.text_styled ? 'warning' : 'error', own = t.text_styled ? ' (its style chose this)' : '';
      const shown = t.text_px() * this.view_scale;
      if (shown < l.layout.min_text - 0.05) out.push({ severity: sev, rule: 'min-text', thing: t.id, message: `'${t.id}' is shown at ${shown.toFixed(1)} px (at least ${l.layout.min_text})${own}` });
      const c = contrast(t.text_color, l.palette.bg);
      if (c < l.taste.min_contrast - 0.01) out.push({ severity: sev, rule: 'contrast', thing: t.id, message: `'${t.id}' has contrast ${c.toFixed(2)}:1 (at least ${l.taste.min_contrast})${own}` });
      const s = t.text(this.lang);
      if (l.taste.instructions.some((re) => re.test(s))) out.push({ severity: 'warning', rule: 'instruction', thing: t.id, message: `'${t.id}' tells the learner what to do ("${s.slice(0, 30)}…")`, fix: 'design speaks before words: let the handle or the layout say it, and drop the sentence' });
    }
    // targets
    for (const h of this.handles) if (h.target() * 2 < l.layout.min_target) out.push({ severity: 'error', rule: 'min-target', thing: h.id, message: `'${h.id}' can be grabbed within ${(h.target() * 2).toFixed(0)} px (at least ${l.layout.min_target})` });
    // one verb
    const verbs = vis.filter((t) => t.role === 'verb');
    if (verbs.length > l.taste.max_verbs) out.push({ severity: 'error', rule: 'one-verb', message: `${verbs.length} vermilion actions on one screen (${verbs.map((v) => v.id).join(', ')})`, fix: "keep one as role 'verb', the others 'text'" });
    // nouns the look does not know
    for (const t of this.registry.all()) if (!known_noun(t.role, l)) out.push({ severity: 'warning', rule: 'noun', thing: t.id, message: `'${t.id}' is the noun '${t.role.split(':')[1]}', which the look has no colour for`, fix: 'add it to NOUNS in @mathnim/look (reviewed), or use an existing noun' });
    // labels that could not find a clear place
    for (const lb of this.labels) if (lb.box.w > 0 && lb.why[0]?.includes('least hidden')) out.push({ severity: 'warning', rule: 'label', thing: lb.id, message: `label '${lb.id}': ${lb.why[0]}` });
    // the figure's own invariants
    for (const c of this.checks) {
      const r = untracked(() => c.f(this));
      if (r) out.push({ severity: 'error', rule: 'invariant', message: `${c.name}: ${r}` });
    }
    return out;
  }
  /** What is on the figure, one line per thing (for agents, tests and the tutor). */
  describe(): string {
    return this.registry.ordered().concat(this.labels.filter((l) => !this.registry.ordered().includes(l)))
      .filter((t) => t.box.w > 0 || t.kind === 'plot')
      .map((t) => {
        const b = t.box, s = t.text(this.lang);
        return `${t.id}: ${t.kind} role=${t.role}${t.style_note()} at (${b.x.toFixed(0)}, ${b.y.toFixed(0)}) ${b.w.toFixed(0)}×${b.h.toFixed(0)}${t.visible() ? '' : ' hidden'}${s ? ` "${s.slice(0, 60)}"` : ''}${t.says ? ` — ${tr(t.says, this.lang)}` : ''}`;
      }).join('\n');
  }
  /** Why a thing is where it is. */
  explain(id: string): string {
    const t = this.registry.get(id) ?? this.labels.find((l) => l.id === id);
    if (!t) return `no thing '${id}'`;
    return `${id} (${t.kind}, ${t.role}) at ${t.box.x.toFixed(0)},${t.box.y.toFixed(0)} ${t.box.w.toFixed(0)}×${t.box.h.toFixed(0)}: ${t.why.join('; ') || 'placed by its container'}${this.phone ? ' [phone layout]' : ''}`;
  }
  get layout_key(): string {
    return this.laid_out;
  }
}

export const is_figure = (x: unknown): x is Figure => !!x && typeof x === 'object' && (x as { engine_figure?: boolean }).engine_figure === true;
