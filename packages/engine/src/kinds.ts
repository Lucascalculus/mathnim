// The core kinds: text blocks (caption, list, readout), legends, plots and the marks drawn in them, attached labels,
// glass handles, and a canvas block (the escape hatch). Courses add their own kinds as plugins (define_kind).
import { color_of, look, material_of, resolve_color, text_color_of, type Look } from '@mathnim/look';
import { bounds_of, clamp, type Box, type XY } from './geom';
import type { Block, LayoutEnv, Side, Size } from './layout';
import { param, read, untracked, type Param, type Val } from './state';
import { draw_tex, tex_size } from './tex';
import { break_lines, font_css, font_of, parse_marks, tr, text_width, type L10n, type Lang, type Line, type Span, type TextKind } from './text';
import { Thing, rgba, type DrawEnv, type Obstacle, type Style } from './thing';

type Txt = string | L10n;
const txt = (v: Val<Txt>, lang: Lang): string => tr(read(v), lang);

// ------------------------------------------------------------------ text blocks

/** A block of text: a caption (wraps), a label, or a readout. `[墙](noun:wall)` and `**x**` colour words. */
export class TextBlock extends Thing implements Block {
  kind = 'text';
  lines: Line[] = [];
  constructor(public content: Val<Txt>, public o: { id?: string; role?: string; kind?: TextKind; align?: 'left' | 'center' | 'right'; weight?: number; says?: L10n; z?: number; max_lines?: number; lang?: Lang; style?: Style } = {}) {
    super({ id: o.id, role: o.role ?? (o.kind === 'caption' ? 'text' : 'text'), says: o.says, z: o.z ?? 5, style: o.style });
  }
  lang: Lang = 'en';
  font() {
    const st = this.style;
    return font_of(this.o.kind ?? 'caption', { weight: st.weight ?? this.o.weight, size: st.size, family: st.family, italic: st.italic });
  }
  line_h(l: Look = look()): number {
    return this.font().size * l.type[this.o.kind ?? 'caption'].line;
  }
  spans(lang: Lang): Span[] {
    const l = look();
    return parse_marks(txt(this.content, lang), (r) => text_color_of(r, l), this.text_color);
  }
  measure(w: number, env: LayoutEnv): Size {
    this.lang = env.lang;
    const lines = untracked(() => break_lines(this.spans(env.lang), this.font(), w));
    const h = Math.min(lines.length, this.o.max_lines ?? Infinity) * this.line_h(env.look);
    return { h, min: h };
  }
  arrange(b: Box, env: LayoutEnv): void {
    this.lang = env.lang;
    this.box = { ...b, h: this.measure(b.w, env).h };
    this.why.push(`in a ${b.w.toFixed(0)} px wide slot`);
  }
  things(): Thing[] {
    return [this];
  }
  label(): string {
    return `text '${this.id}'`;
  }
  draw(env: DrawEnv): void {
    const f = this.font(), g = env.g, lh = this.line_h(env.look);
    this.lines = break_lines(this.spans(env.lang), f, this.box.w);
    g.textBaseline = 'alphabetic';
    if (this.style.backing) {
      const w = Math.max(0, ...this.lines.map((l) => l.width)), n = Math.min(this.lines.length, this.o.max_lines ?? Infinity);
      const x0 = this.o.align === 'center' ? this.box.x + (this.box.w - w) / 2 : this.o.align === 'right' ? this.box.x + this.box.w - w : this.box.x;
      backing(g, { x: x0 - 4, y: this.box.y - 2, w: w + 8, h: n * lh + 4 }, env, this.style.backing);
    }
    let y = this.box.y + lh / 2 + f.size * 0.36;
    for (const line of this.lines.slice(0, this.o.max_lines ?? Infinity)) {
      const x0 = this.o.align === 'center' ? this.box.x + (this.box.w - line.width) / 2 : this.o.align === 'right' ? this.box.x + this.box.w - line.width : this.box.x;
      for (const sp of line.spans) {
        g.font = font_css(sp.weight ? { ...f, weight: sp.weight } : f);
        g.fillStyle = sp.color ?? this.text_color;
        g.fillText(sp.s, x0 + sp.x, y);
      }
      y += lh;
    }
  }
  override text(lang: Lang): string {
    return txt(this.content, lang);
  }
  override text_px(): number {
    return this.font().size;
  }
}

/** A list of lines that a script can reveal one by one (each item is its own thing). */
export class ListBlock implements Block {
  items: TextBlock[];
  constructor(items: Val<Txt>[], public o: { id?: string; kind?: TextKind; gap?: number; role?: string } = {}) {
    this.items = items.map((c, i) => new TextBlock(c, { id: `${o.id ?? 'list'}.${i}`, kind: o.kind ?? 'caption', role: o.role }));
  }
  measure(w: number, env: LayoutEnv): Size {
    const gap = this.o.gap ?? env.look.space.list_gap;
    const hs = this.items.map((it) => it.measure(w, env).h);
    const h = hs.reduce((a, x) => a + x, 0) + gap * Math.max(0, hs.length - 1);
    return { h, min: h };
  }
  arrange(b: Box, env: LayoutEnv): void {
    const gap = this.o.gap ?? env.look.space.list_gap;
    let y = b.y;
    for (const it of this.items) {
      const h = it.measure(b.w, env).h;
      it.arrange({ x: b.x, y, w: b.w, h }, env);
      it.why.push(`item of list '${this.o.id ?? 'list'}'`);
      y += h + gap;
    }
  }
  things(): Thing[] {
    return this.items;
  }
  label(): string {
    return `list '${this.o.id ?? 'list'}'`;
  }
}

/** A piece of a readout: TeX, text, a number, or a space (in ems); any piece may have its own colour (a unit in grey). */
export type Part = ({ tex: Val<string> } | { text: Val<Txt> } | { value: Val<number>; decimals?: number; template?: string } | { gap: number }) & { color?: string; size?: number };

/**
 * A readout line: symbols, numbers and their units, set on one baseline. A number reserves the width of its widest
 * value (its template), so the line never jitters while it changes.
 */
export class Readout extends Thing implements Block {
  kind = 'readout';
  /** `role` may follow the state (a determinant's colour says whether it scales, collapses or flips). */
  constructor(public parts: Part[], public o: { id?: string; role?: Val<string>; says?: L10n; kind?: TextKind; style?: Style } = {}) {
    super({ id: o.id, role: typeof o.role === 'string' ? o.role : 'text', says: o.says, z: 5, style: o.style });
    if (o.role !== undefined && typeof o.role !== 'string') this.role_of = () => read(o.role as Val<string>);
  }
  /** The size it is set at: its kind's, or the next size down the type scale when its slot is too narrow. */
  private size_kind: TextKind | null = null;
  private k(): TextKind {
    return this.size_kind ?? this.o.kind ?? 'readout';
  }
  private px(): number {
    return this.style.size ?? look().type[this.k()].size;
  }
  private f(size?: number) {
    return font_of(this.k(), { size: size ?? this.style.size, weight: this.style.weight, family: this.style.family });
  }
  private widths(lang: Lang): number[] {
    const px = this.px();
    return this.parts.map((p) => {
      const f = this.f(p.size), q = p.size ?? px;
      if ('gap' in p) return p.gap * px - px * 0.28;
      if ('tex' in p) return untracked(() => tex_size(read(p.tex), q).w);
      if ('text' in p) return untracked(() => text_width(txt(p.text, lang), f));
      return tabular_width(p.template ?? '−0.00', f);
    });
  }
  /** The size it fits a slot of width w at: its kind, or the next size down the type scale (a line of numbers cannot wrap). */
  private fit_kind(w: number, lang: Lang): TextKind | null {
    const own = this.o.kind ?? 'readout', was = this.size_kind;
    let out: TextKind | null = null;
    if (this.style.size) return null; // (a size the figure chose is kept)
    this.size_kind = null;
    const total = () => {
      const ws = this.widths(lang), sp = this.px() * 0.28;
      return ws.reduce((a, x) => a + x + sp, -sp);
    };
    for (const k of ['readout', 'caption', 'label'] as TextKind[]) {
      if (total() <= w + 0.5 || look().type[k].size >= look().type[out ?? own].size) continue;
      this.size_kind = out = k;
    }
    this.size_kind = was;
    return out;
  }
  measure(w: number, env: LayoutEnv): Size {
    const k = this.fit_kind(w, env.lang), h = (this.style.size ?? look().type[k ?? this.o.kind ?? 'readout'].size) * 1.5;
    return { h, min: h };
  }
  arrange(b: Box, env: LayoutEnv): void {
    this.size_kind = this.fit_kind(b.w, env.lang);
    if (this.size_kind) this.why.push(`set at the ${this.size_kind} size: its own does not fit ${b.w.toFixed(0)} px`);
    const ws = this.widths(env.lang), sp = this.px() * 0.28;
    this.box = { x: b.x, y: b.y, w: Math.min(b.w, ws.reduce((a, x) => a + x + sp, -sp)), h: this.px() * 1.5 };
  }
  things(): Thing[] {
    return [this];
  }
  label(): string {
    return `readout '${this.id}'`;
  }
  draw(env: DrawEnv): void {
    const px = this.px(), f = this.f(), g = env.g, sp = px * 0.28;
    const ws = this.widths(env.lang);
    this.box = { ...this.box, w: ws.reduce((a, x) => a + x + sp, -sp) };
    let x = this.box.x;
    const y = this.box.y + this.box.h / 2 + px * 0.36;
    if (this.style.backing) backing(g, { x: x - 4, y: this.box.y, w: this.box.w + 8, h: this.box.h }, env, this.style.backing);
    this.parts.forEach((p, i) => {
      const col = p.color ? resolve_color(p.color, env.look) : this.text_color, pf = p.size ? this.f(p.size) : f;
      if ('gap' in p) {
        /* space */
      } else if ('tex' in p) draw_tex(g, read(p.tex), x, y, p.size ?? px, col);
      else {
        g.font = font_css(pf);
        g.fillStyle = col;
        g.textBaseline = 'alphabetic';
        if ('text' in p) g.fillText(txt(p.text, env.lang), x, y);
        else {
          const v = read(p.value), s = Number.isFinite(v) ? v.toFixed(p.decimals ?? 2).replace('-', '−') : '—';
          // numbers sit right-aligned in their reserved width, each digit in a cell of the same width, so the
          // digits never move sideways as the value changes (canvas text has no tabular figures of its own)
          fill_tabular(g, s, x + ws[i], y, pf);
        }
      }
      x += ws[i] + sp;
    });
  }
  override text(lang: Lang): string {
    return this.parts.map((p) => ('gap' in p ? '' : 'tex' in p ? read(p.tex) : 'text' in p ? txt(p.text, lang) : String(read(p.value)))).join(' ');
  }
  override text_px(): number {
    return this.px();
  }
}

/** One entry of a legend: a swatch in its role's colour and material (or its own style), and its name. */
export interface LegendEntry { role: string; text?: Txt; tex?: string; mark?: 'line' | 'dot' | 'square' | 'cross' | 'region'; show?: Val<number>; style?: Style }
/** A key to the marks of a plot: a swatch in each role's colour and material, and its name. */
export class Legend extends Thing implements Block {
  kind = 'legend';
  private rows: { x: number; y: number; w: number; lines: string[] }[] = [];
  /** `stack`: one entry per line; `backing`: a paper card behind it (a legend inside a plot, over its lines). */
  constructor(public entries: LegendEntry[], public lo: { id?: string; stack?: boolean; style?: Style; gap?: number; line_h?: number; swatch?: number } = {}) {
    super({ id: lo.id ?? 'legend', role: 'text', z: 5, style: lo.style });
  }
  private font() {
    return font_of('label', { size: this.style.size, weight: this.style.weight, family: this.style.family });
  }
  private lh(): number {
    return this.font().size * (this.lo.line_h ?? 1.7);
  }
  private sw(): number {
    return this.lo.swatch ?? 16;
  }
  private entry_w(i: number, lang: Lang): number {
    const e = this.entries[i], f = this.font(), px = f.size;
    return this.sw() + 6 + (e.text ? text_width(tr(e.text, lang), f) : 0) + (e.tex ? (e.text ? px * 0.35 : 0) + tex_size(e.tex, px).w : 0);
  }
  /** Its width with every entry on one line (or, stacked, its widest entry). */
  natural_w(lang: Lang): number {
    const ws = this.entries.map((_, i) => untracked(() => this.entry_w(i, lang)));
    return this.lo.stack ? Math.max(0, ...ws) : ws.reduce((a, x) => a + x, 0) + (this.lo.gap ?? 18) * Math.max(0, ws.length - 1);
  }
  /** Entries flow like words; one too wide for the line wraps its own text (a phone). */
  private flow(w: number, lang: Lang): { x: number; y: number; w: number; lines: string[] }[] {
    const f = this.font(), lh = this.lh(), gap = this.lo.gap ?? 18;
    let x = 0, y = 0;
    return this.entries.map((e, i) => {
      let ew = untracked(() => this.entry_w(i, lang)), lines: string[] = e.text ? [tr(e.text, lang)] : [];
      if (ew > w && e.text) {
        const tw = Math.max(40, w - this.sw() - 6 - (e.tex ? f.size * 0.35 + tex_size(e.tex, f.size).w : 0));
        lines = break_lines(tr(e.text, lang), f, tw).map((l) => l.spans.map((sp) => sp.s).join(''));
        ew = w;
      }
      if (x > 0 && (x + ew > w || this.lo.stack)) {
        x = 0;
        y += lh;
      }
      const r = { x, y, w: ew, lines };
      x += ew + gap;
      if (lines.length > 1) {
        y += lh * (lines.length - 1);
        x = w + 1; // (the next entry starts a new line)
      }
      return r;
    });
  }
  measure(w: number, env: LayoutEnv): Size {
    const f = this.flow(w, env.lang), lh = this.lh(), h = (f.length ? Math.max(...f.map((r) => r.y + (Math.max(1, r.lines.length) - 1) * lh)) : 0) + lh;
    return { h, min: h };
  }
  arrange(b: Box, env: LayoutEnv): void {
    this.rows = this.flow(b.w, env.lang);
    const h = this.measure(b.w, env).h;
    this.box = { x: b.x, y: b.y, w: Math.max(0, ...this.rows.map((r) => r.x + r.w)), h };
    this.why.push('in its slot of the layout');
  }
  things(): Thing[] {
    return [this];
  }
  label(): string {
    return 'legend';
  }
  draw(env: DrawEnv): void {
    const g = env.g, f = this.font(), px = f.size, lh = this.lh();
    if (this.style.backing) backing(g, { x: this.box.x - 8, y: this.box.y - 3, w: this.box.w + 16, h: this.box.h + 6 }, env, this.style.backing);
    this.entries.forEach((e, i) => {
      const r = this.rows[i];
      if (!r) return;
      const x = this.box.x + r.x, cy = this.box.y + r.y + lh / 2, es = e.style ?? {};
      const col = es.color ? resolve_color(es.color, env.look) : color_of(e.role), m0 = material_of(e.role);
      const m = { ...m0, ...(es.width !== undefined ? { stroke: es.width } : {}), ...(es.dash !== undefined ? { dash: es.dash ?? undefined } : {}), ...(es.fill_alpha !== undefined ? { fill_opacity: es.fill_alpha } : {}) };
      // an entry can come in with what it names (its place is kept, so nothing moves)
      const shown = e.show === undefined ? 1 : Math.max(0, Math.min(1, read(e.show)));
      if (shown <= 0.001) return;
      const a0 = g.globalAlpha;
      g.globalAlpha = a0 * shown;
      g.save();
      g.strokeStyle = col;
      g.fillStyle = es.fill ? resolve_color(es.fill, env.look) : col;
      g.lineWidth = m.stroke ?? 2;
      if (es.alpha !== undefined) g.globalAlpha *= es.alpha;
      if (m.dash) g.setLineDash(m.dash);
      const mk = e.mark ?? 'line';
      const sw = this.sw(), mid = x + sw / 2;
      if (mk === 'line') {
        g.beginPath();
        g.moveTo(x, cy);
        g.lineTo(x + sw, cy);
        g.stroke();
      } else if (mk === 'dot') {
        g.beginPath();
        g.arc(mid, cy, 5, 0, Math.PI * 2);
        g.fill();
      } else if (mk === 'square') {
        g.lineWidth = es.width ?? 2;
        g.strokeRect(mid - 5, cy - 5, 10, 10);
      } else if (mk === 'cross') {
        g.lineWidth = 2.5;
        g.beginPath();
        g.moveTo(x + 3, cy - 5);
        g.lineTo(x + 13, cy + 5);
        g.moveTo(x + 3, cy + 5);
        g.lineTo(x + 13, cy - 5);
        g.stroke();
      } else {
        g.fillStyle = rgba(col, m.fill_opacity ?? 0.12);
        g.fillRect(x, cy - 6, 16, 12);
        g.strokeRect(x, cy - 6, 16, 12);
      }
      g.restore();
      let tx = x + sw + 6;
      g.font = font_css(f);
      const ts = es.text ?? es.color;
      const tcol = ts ? resolve_color(ts, env.look) : e.role.startsWith('scaffold') || e.role === 'muted' ? look().palette.ink2 : text_color_of(e.role);
      g.fillStyle = tcol;
      g.textBaseline = 'alphabetic';
      if (e.text) {
        const lines = r.lines.length ? r.lines : [tr(e.text, env.lang)];
        lines.forEach((s, k) => g.fillText(s, tx, cy + px * 0.36 + k * lh));
        tx += text_width(lines[0], f) + px * 0.35;
      }
      if (e.tex) draw_tex(g, e.tex, tx, cy + px * 0.36, px, tcol);
      g.globalAlpha = a0;
    });
  }
  override text(lang: Lang): string {
    return this.entries.map((e) => (e.text ? tr(e.text, lang) : '') + (e.tex ?? '')).join(' · ');
  }
  override text_px(): number {
    return this.font().size;
  }
  override get text_styled(): boolean {
    return super.text_styled || this.entries.some((e) => e.style?.color !== undefined || e.style?.text !== undefined);
  }
}

// ------------------------------------------------------------------ plots

export interface PlotSpec {
  id?: string;
  x: [number, number];
  y: [number, number];
  x_ticks?: number[];
  y_ticks?: number[];
  /** Axis labels: TeX, or plain text ({ text }: words in either language). */
  x_label?: string | { text: Txt };
  y_label?: string | { text: Txt };
  /** Data aspect: 'equal' keeps one unit the same length on both axes; a number is width / height of the data area. */
  aspect?: 'equal' | number;
  grid?: boolean;
  says?: L10n;
  /** Prefer at most this height / width (a flat plot, e.g. a track). */
  max_aspect?: number;
  /** 'x': only the horizontal axis (a track, a number line); 'origin': both axes through (0, 0), no frame. */
  axes?: 'xy' | 'x' | 'origin';
  /** Tick numbers (default true; a plane of vectors has none). */
  numbers?: boolean;
  /** The data aspect on a phone (a flatter pad saves height there). */
  phone_aspect?: number;
  /** When space runs out, lower priorities shrink first (default 1; the figure's main plot: 2). */
  priority?: number;
  /** With aspect 'equal': widen the shorter range so the plot fills its box (a plane of vectors has no edge). */
  fill?: boolean;
  /** The ticks that carry a number (default: every tick), e.g. every other metre on a track. */
  x_numbers?: number[];
  y_numbers?: number[];
  /** TeX after the last x number (a unit: '\\,\\mathrm{m}' gives "10 m"). */
  x_unit?: string;
  /** Set the numbers in TeX (as a manim figure did) rather than in the text face. */
  number_tex?: boolean;
  /** Where the grid lines are (default: at the ticks), or none. */
  grid_at?: { x?: number[]; y?: number[] };
  /** Tick marks: outside the axis (default), across it, or none; and their length (px; numbered ticks may be longer). */
  tick_marks?: { x?: 'out' | 'cross' | 'none'; y?: 'out' | 'cross' | 'none'; len?: number; numbered_len?: number };
  /** The axis labels' size (px; default the numbers'). */
  label_px?: number;
  /** The box the layout gives is the data area itself (numbers and labels go outside it): a manim box carries over. */
  data_box?: boolean;
  /** Overrides: axes colour (`color`), numbers and labels (`text`), their size (`size`), axis width (`width`). */
  style?: Style;
}

/**
 * A plot: a data area with its axes. Marks added to it are drawn in data coordinates, clipped to the data area.
 * Its axes are a thing of their own (drawn once and cached by the renderer).
 */
export class Plot extends Thing implements Block {
  kind = 'plot';
  data: Box = { x: 0, y: 0, w: 1, h: 1 };
  marks: Thing[] = [];
  constructor(public spec: PlotSpec) {
    super({ id: spec.id ?? 'plot', role: 'scaffold', says: spec.says, z: 1, style: spec.style });
  }
  /** Blocks set inside the data area, in a corner (a legend over the plot's empty corner). */
  insets: { block: Block & Thing; corner: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right'; pad: number; w?: number }[] = [];
  /** Put a block inside the data area, in a corner (`w`: its width; default: its natural width). */
  inset(block: Block & Thing, corner: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right' = 'top-left', o: { pad?: number; w?: number } = {}): void {
    this.insets.push({ block, corner, pad: o.pad ?? 10, w: o.w });
  }
  private nfont() {
    return font_of('label', { size: this.style.size });
  }
  private num_w(v: number): number {
    return this.spec.number_tex ? tex_size(fmt_tick(v).replace('−', '-'), this.nfont().size).w : text_width(fmt_tick(v), this.nfont());
  }
  /** Margins for tick numbers and axis labels. */
  private margins(): { l: number; r: number; t: number; b: number } {
    const px = this.nfont().size, lab = (this.spec.label_px ?? px) * 1.25;
    if (this.spec.numbers === false) return { l: 6, r: 6, t: this.spec.y_label ? lab + 6 : 6, b: 6 + (this.spec.x_label ? lab : 0) };
    const ywid = Math.max(0, ...(this.spec.y_numbers ?? this.spec.y_ticks ?? []).map((v) => this.num_w(v))) + 8;
    const unit = this.spec.x_unit ? tex_size(this.spec.x_unit, px).w : 0;
    return { l: ywid + 4, r: 10 + unit, t: this.spec.y_label ? lab + 6 : 8, b: px * 1.4 + 6 + (this.spec.x_label ? lab : 0) };
  }
  private phone = false;
  priority(): number {
    return this.spec.priority ?? 1;
  }
  private aspect(): number | null {
    const a = this.phone && this.spec.phone_aspect ? this.spec.phone_aspect : this.spec.aspect;
    if (a === 'equal') return (this.spec.x[1] - this.spec.x[0]) / (this.spec.y[1] - this.spec.y[0]);
    return typeof a === 'number' ? a : null;
  }
  measure(w: number, env: LayoutEnv): Size {
    this.phone = env.phone;
    const m = this.margins(), dw = Math.max(10, w - m.l - m.r), a = this.aspect();
    const dh = a ? dw / a : dw * 0.62;
    const h = dh + m.t + m.b, min = Math.min(h, env.look.layout.min_plot + m.t + m.b);
    return { h: this.spec.max_aspect ? Math.min(h, w * this.spec.max_aspect) : h, min, grow: (!a || !!this.spec.fill) && !this.spec.max_aspect };
  }
  /** The ranges asked for (fill widens the plot's own ranges to its box; these stay as given). */
  private asked: { x: [number, number]; y: [number, number] } | null = null;
  arrange(b: Box, env: LayoutEnv): void {
    this.phone = env.phone;
    const m0 = this.margins();
    // (a data box: the margins lie outside the box given)
    if (this.spec.data_box && !env.phone) b = { x: b.x - m0.l, y: b.y - m0.t, w: b.w + m0.l + m0.r, h: b.h + m0.t + m0.b };
    const m = m0;
    let dw = Math.max(10, b.w - m.l - m.r), dh = Math.max(10, b.h - m.t - m.b);
    if (this.spec.fill && this.spec.aspect === 'equal') {
      // keep one unit the same length both ways and show more of the plane on the long side
      this.asked ??= { x: [...this.spec.x] as [number, number], y: [...this.spec.y] as [number, number] };
      const { x, y } = this.asked, k = Math.min(dw / (x[1] - x[0]), dh / (y[1] - y[0]));
      const cx = (x[0] + x[1]) / 2, cy = (y[0] + y[1]) / 2, hx = dw / k / 2, hy = dh / k / 2;
      this.spec.x = [cx - hx, cx + hx];
      this.spec.y = [cy - hy, cy + hy];
      this.why.push(`filled: x ${this.spec.x.map((v) => v.toFixed(2)).join('..')}, y ${this.spec.y.map((v) => v.toFixed(2)).join('..')}`);
    }
    const a = this.aspect();
    // keep the data aspect: the largest data area of that shape, centred
    if (a) {
      if (dw / dh > a) dw = dh * a;
      else dh = dw / a;
    }
    const x = b.x + m.l + (b.w - m.l - m.r - dw) / 2, y = b.y + m.t;
    this.data = { x, y, w: dw, h: dh };
    this.box = { x: x - m.l, y: b.y, w: dw + m.l + m.r, h: dh + m.t + m.b };
    this.why.push(`data area ${dw.toFixed(0)}×${dh.toFixed(0)} px${a ? ', aspect kept' : ''}${env.phone ? ', phone layout' : ''}`);
    for (const it of this.insets) {
      const nat = (it.block as Block & { natural_w?: (l: Lang) => number }).natural_w?.(env.lang);
      const w = Math.min(dw - 2 * it.pad, it.w ?? nat ?? dw * 0.5), h = it.block.measure(w, env).h;
      const ix = it.corner.endsWith('left') ? x + it.pad : x + dw - it.pad - w, iy = it.corner.startsWith('top') ? y + it.pad : y + dh - it.pad - h;
      it.block.arrange({ x: ix, y: iy, w, h }, env);
      it.block.why.push(`inside plot '${this.id}', ${it.corner} (placed by the figure)`);
    }
  }
  things(): Thing[] {
    return [this, ...this.marks, ...this.insets.flatMap((it) => it.block.things())];
  }
  label(): string {
    return `plot '${this.id}'`;
  }
  X(v: number): number {
    return this.data.x + ((v - this.spec.x[0]) / (this.spec.x[1] - this.spec.x[0])) * this.data.w;
  }
  Y(v: number): number {
    return this.data.y + this.data.h - ((v - this.spec.y[0]) / (this.spec.y[1] - this.spec.y[0])) * this.data.h;
  }
  P(p: readonly number[]): XY {
    return [this.X(p[0]), this.Y(p[1])];
  }
  /** Inverse: CSS px → data. */
  inv(px: XY): XY {
    return [this.spec.x[0] + ((px[0] - this.data.x) / this.data.w) * (this.spec.x[1] - this.spec.x[0]), this.spec.y[0] + ((this.data.y + this.data.h - px[1]) / this.data.h) * (this.spec.y[1] - this.spec.y[0])];
  }
  /** Units per CSS px (for tolerances). */
  unit(): number {
    return (this.spec.x[1] - this.spec.x[0]) / this.data.w;
  }
  add<T extends Thing>(m: T): T {
    (m as Thing & { plot?: Plot }).plot = this;
    this.marks.push(m);
    return m;
  }
  draw(env: DrawEnv): void {
    const g = env.g, d = this.data, p = env.look.palette, f = this.nfont();
    const axis_col = this.style.color ? resolve_color(this.style.color, env.look) : p.scaffold;
    const num_col = this.style.text ? resolve_color(this.style.text, env.look) : p.ink2;
    g.save();
    // grid
    // (only the ticks inside the ranges: a plot that fills its box may have been given more)
    const inx = (v: number) => v >= Math.min(...this.spec.x) - 1e-9 && v <= Math.max(...this.spec.x) + 1e-9;
    const iny = (v: number) => v >= Math.min(...this.spec.y) - 1e-9 && v <= Math.max(...this.spec.y) + 1e-9;
    if (this.spec.grid !== false) {
      g.strokeStyle = p.faint;
      g.lineWidth = 1;
      g.beginPath();
      for (const v of (this.spec.grid_at?.x ?? this.spec.x_ticks ?? []).filter(inx)) {
        g.moveTo(Math.round(this.X(v)) + 0.5, d.y);
        g.lineTo(Math.round(this.X(v)) + 0.5, d.y + d.h);
      }
      for (const v of (this.spec.grid_at?.y ?? this.spec.y_ticks ?? []).filter(iny)) {
        g.moveTo(d.x, Math.round(this.Y(v)) + 0.5);
        g.lineTo(d.x + d.w, Math.round(this.Y(v)) + 0.5);
      }
      g.stroke();
    }
    if (this.spec.axes === 'origin') {
      // a plane of vectors: its two axes cross at the origin, and that is all
      g.strokeStyle = axis_col;
      g.lineWidth = this.style.width ?? 1.25;
      g.beginPath();
      g.moveTo(d.x, Math.round(this.Y(0)) + 0.5);
      g.lineTo(d.x + d.w, Math.round(this.Y(0)) + 0.5);
      g.moveTo(Math.round(this.X(0)) + 0.5, d.y);
      g.lineTo(Math.round(this.X(0)) + 0.5, d.y + d.h);
      g.stroke();
      g.restore();
      return;
    }
    // axes on the left and the bottom
    g.strokeStyle = axis_col;
    g.lineWidth = this.style.width ?? 1.25;
    g.beginPath();
    if (this.spec.axes !== 'x') {
      g.moveTo(d.x, d.y);
      g.lineTo(d.x, d.y + d.h);
    } else g.moveTo(d.x, d.y + d.h);
    g.lineTo(d.x + d.w, d.y + d.h);
    g.stroke();
    // ticks and their numbers (ink-2: numbers are never grey scaffolding)
    g.font = font_css(f);
    g.fillStyle = num_col;
    g.textBaseline = 'alphabetic';
    const tm = this.spec.tick_marks ?? {}, tk0 = tm.len ?? env.look.space.tick;
    const tk = tm.x === 'cross' ? tk0 / 2 : tm.x === 'none' ? 0 : tk0;
    const numbered = (v: number, list?: number[]) => this.spec.numbers !== false && (!list || list.some((u) => Math.abs(u - v) < 1e-9));
    const num = (s: string, x: number, y: number, align: 'center' | 'right', unit = '') => {
      if (this.spec.number_tex || unit) {
        const src = s.replace('−', '-') + unit, w = tex_size(src, f.size).w, w0 = unit ? tex_size(s.replace('−', '-'), f.size).w : w;
        draw_tex(g, src, align === 'center' ? x - w0 / 2 : x - w, y, f.size, num_col);
      } else g.fillText(s, align === 'center' ? x - text_width(s, f) / 2 : x - text_width(s, f), y);
    };
    const xs = (this.spec.x_ticks ?? []).filter(inx), last_n = [...xs].reverse().find((v) => numbered(v, this.spec.x_numbers));
    g.beginPath();
    for (const v of xs) {
      const x = this.X(v), on = numbered(v, this.spec.x_numbers), len = on && tm.numbered_len ? tm.numbered_len : tk0;
      if (tm.x !== 'none') {
        g.moveTo(x, d.y + d.h - (tm.x === 'cross' ? len / 2 : 0));
        g.lineTo(x, d.y + d.h + (tm.x === 'cross' ? len / 2 : len));
      }
      if (on) num(fmt_tick(v), x, d.y + d.h + tk + f.size + 1, 'center', v === last_n && this.spec.x_unit ? this.spec.x_unit : '');
    }
    const tky = tm.y === 'none' ? 0 : tm.y === 'cross' ? tk0 / 2 : tk0;
    for (const v of (this.spec.y_ticks ?? []).filter(iny)) {
      const y = this.Y(v);
      if (tm.y !== 'none') {
        g.moveTo(d.x - tky, y);
        g.lineTo(d.x + (tm.y === 'cross' ? tky : 0), y);
      }
      if (numbered(v, this.spec.y_numbers)) num(fmt_tick(v), d.x - Math.max(tky, 3) - 3, y + f.size * 0.35, 'right');
    }
    g.stroke();
    // axis labels: x under its numbers at the right end, y above the axis at the top (outside the data)
    const xl = this.spec.x_label, yl = this.spec.y_label;
    const lpx = this.spec.label_px ?? f.size;
    if (typeof xl === 'string') {
      const s = tex_size(xl, lpx);
      draw_tex(g, xl, d.x + d.w - s.w, d.y + d.h + tk + f.size * 1.5 + lpx + s.asc * 0.4, lpx, num_col);
    } else if (xl) {
      const s = tr(xl.text, env.lang);
      g.fillText(s, d.x + d.w - text_width(s, f), d.y + d.h + tk + f.size * 2.75);
    }
    if (typeof yl === 'string') draw_tex(g, yl, d.x - 4, d.y - 8, lpx, num_col);
    else if (yl) g.fillText(tr(yl.text, env.lang), d.x - 4, d.y - 8);
    g.restore();
  }
  override obstacles(): Obstacle[] {
    // the axes' numbers and labels (the data area itself is for marks)
    const d = this.data;
    return [{ box: { x: this.box.x, y: d.y + d.h, w: this.box.w, h: this.box.y + this.box.h - d.y - d.h } }, { box: { x: this.box.x, y: d.y, w: d.x - this.box.x, h: d.h } }, { box: { x: this.box.x, y: this.box.y, w: this.box.w, h: d.y - this.box.y } }];
  }
}
/** The width of a digit cell: the widest digit. */
const digit_w = (f: ReturnType<typeof font_of>): number => Math.max(...'0123456789'.split('').map((d) => text_width(d, f)));
function tabular_width(s: string, f: ReturnType<typeof font_of>): number {
  const dw = digit_w(f);
  return [...s].reduce((a, ch) => a + (/\d/.test(ch) ? dw : text_width(ch, f)), 0);
}
/** Draw a number right-aligned at x1, its digits in equal cells. */
function fill_tabular(g: CanvasRenderingContext2D, s: string, x1: number, y: number, f: ReturnType<typeof font_of>): void {
  const dw = digit_w(f);
  let x = x1 - tabular_width(s, f);
  for (const ch of s) {
    const cw = text_width(ch, f), cell = /\d/.test(ch) ? dw : cw;
    g.fillText(ch, x + (cell - cw) / 2, y);
    x += cell;
  }
}
export function fmt_tick(v: number): string {
  const s = Math.abs(v - Math.round(v)) < 1e-9 ? String(Math.round(v)) : String(+v.toFixed(2));
  return s.replace('-', '−');
}

/** Something drawn in a plot's data coordinates. */
export abstract class Mark extends Thing {
  plot!: Plot;
  constructor(o: { id?: string; role?: string; says?: L10n; z?: number; style?: Style } = {}) {
    super({ ...o, z: o.z ?? 2 });
  }
  protected clip(env: DrawEnv): void {
    const d = this.plot.data;
    env.g.beginPath();
    env.g.rect(d.x - 2, d.y - 2, d.w + 4, d.h + 4);
    env.g.clip();
  }
  protected stroke_style(env: DrawEnv): void {
    const m = this.material, g = env.g;
    g.strokeStyle = this.color;
    g.lineWidth = m.stroke ?? 2;
    g.setLineDash(m.dash ?? []);
    g.globalAlpha *= m.stroke_opacity ?? 1;
    g.lineJoin = 'round';
    g.lineCap = 'round';
  }
}

/** A polyline or several (data coordinates). */
export class Path extends Mark {
  kind = 'path';
  private px: XY[][] = [];
  constructor(public pts: Val<XY[] | XY[][]>, o: { id?: string; role?: string; says?: L10n; z?: number; closed?: boolean; width?: number; alpha?: number; upto?: Val<number>; style?: Style } = {}) {
    super(o);
    this.o = o;
  }
  /** `upto`: the share of each polyline drawn (0..1; a script's set() draws it on). */
  o: { closed?: boolean; width?: number; alpha?: number; upto?: Val<number> };
  draw(env: DrawEnv): void {
    const raw = read(this.pts);
    const polys = (raw.length && Array.isArray(raw[0]) && Array.isArray((raw[0] as XY[])[0]) ? raw : [raw]) as XY[][];
    this.px = polys.map((pl) => pl.map((p) => this.plot.P(p)));
    if (this.o.upto !== undefined) {
      const u = Math.max(0, Math.min(1, read(this.o.upto)));
      this.px = this.px.map((pl) => cut_polyline(pl, u));
    }
    const g = env.g;
    g.save();
    this.clip(env);
    this.stroke_style(env);
    if (this.o.width && this.style.width === undefined) g.lineWidth = this.o.width;
    if (this.o.alpha !== undefined && this.style.alpha === undefined) g.globalAlpha *= this.o.alpha;
    g.beginPath();
    for (const pl of this.px) pl.forEach((p, i) => (i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1])));
    if (this.o.closed) g.closePath();
    if (this.style.fill && this.o.closed) {
      g.fillStyle = rgba(this.fill_color, this.style.fill_alpha ?? 1);
      g.fill();
    }
    g.stroke();
    g.restore();
    const all = this.px.flat();
    this.box = all.length ? bounds(all) : { x: 0, y: 0, w: 0, h: 0 };
  }
  override obstacles(): Obstacle[] {
    const out: Obstacle[] = [];
    for (const pl of this.px) {
      const step = Math.max(1, Math.floor(pl.length / 40));
      for (let i = 0; i + step < pl.length; i += step) out.push({ seg: [pl[i], pl[i + step]], weight: 0.6 });
    }
    return out;
  }
}

/** A filled area (a feasible set): a tint of its noun, with its edge. */
export class Region extends Mark {
  kind = 'region';
  private px: XY[] = [];
  constructor(public pts: Val<XY[]>, o: { id?: string; role?: string; says?: L10n; z?: number; edge?: boolean; fill?: number; style?: Style } = {}) {
    super({ ...o, role: o.role ?? 'region', z: o.z ?? 1.5 });
    this.edge = o.edge ?? true;
    this.fill = o.fill;
  }
  edge: boolean;
  /** Its tint's opacity (default: the role's material). */
  fill?: number;
  draw(env: DrawEnv): void {
    const pts = read(this.pts);
    this.px = pts.map((p) => this.plot.P(p));
    if (this.px.length < 3) {
      this.box = { x: 0, y: 0, w: 0, h: 0 };
      return;
    }
    const g = env.g, m = this.material;
    g.save();
    this.clip(env);
    g.beginPath();
    this.px.forEach((p, i) => (i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1])));
    g.closePath();
    g.fillStyle = rgba(this.fill_color, this.style.fill_alpha ?? this.fill ?? m.fill_opacity ?? 0.12);
    g.fill();
    if (this.edge) {
      g.strokeStyle = rgba(this.color, this.style.alpha ?? 0.6);
      g.lineWidth = m.stroke ?? 2;
      g.setLineDash(m.dash ?? []);
      g.stroke();
    }
    g.restore();
    this.box = bounds(this.px);
  }
  // a region is a background: labels may sit on it
  override obstacles(): Obstacle[] {
    return [];
  }
}

export type MarkerShape = 'dot' | 'cross' | 'square' | 'ring' | 'arrow';
/** A point marker: ● the truth, ○ a guess, × a reference, □ a comparison. */
export class Marker extends Mark {
  kind = 'marker';
  private at: XY | null = null;
  constructor(public pos: Val<XY | null>, public o: { id?: string; role?: string; says?: L10n; shape?: MarkerShape; r?: number; z?: number; dir?: Val<XY>; clip?: boolean; style?: Style } = {}) {
    super({ ...o, z: o.z ?? 3 });
  }
  r(): number {
    return this.o.r ?? (this.o.shape === 'dot' || !this.o.shape ? 6.5 : 7);
  }
  draw(env: DrawEnv): void {
    const p = read(this.pos);
    this.at = p ? this.plot.P(p) : null;
    if (!this.at) {
      this.box = { x: 0, y: 0, w: 0, h: 0 };
      return;
    }
    const [x, y] = this.at, r = this.r(), g = env.g, col = this.color, shape = this.o.shape ?? 'dot';
    g.save();
    if (this.o.clip !== false) this.clip(env);
    const st = this.style;
    g.strokeStyle = col;
    g.fillStyle = col;
    g.lineWidth = st.width ?? 2.75;
    g.lineCap = 'round';
    if (st.alpha !== undefined) g.globalAlpha *= st.alpha;
    if (st.dash) g.setLineDash(st.dash);
    if (shape === 'dot') {
      // (a paper ring keeps it apart from the lines under it; `width` is the ring's)
      g.beginPath();
      g.arc(x, y, r + (st.width ?? 2), 0, Math.PI * 2);
      g.fillStyle = env.look.palette.bg;
      g.fill();
      g.beginPath();
      g.arc(x, y, r, 0, Math.PI * 2);
      g.fillStyle = this.fill_color;
      g.fill();
    } else if (shape === 'ring') {
      g.beginPath();
      g.arc(x, y, r, 0, Math.PI * 2);
      g.stroke();
    } else if (shape === 'cross') {
      g.beginPath();
      g.moveTo(x - r, y - r);
      g.lineTo(x + r, y + r);
      g.moveTo(x - r, y + r);
      g.lineTo(x + r, y - r);
      g.stroke();
    } else if (shape === 'square') {
      g.lineWidth = st.width ?? 2.25;
      g.strokeRect(x - r, y - r, 2 * r, 2 * r);
    } else {
      // an arrow on the border pointing at something off the chart
      const d = this.o.dir ? read(this.o.dir) : ([1, 0] as XY), L = Math.hypot(d[0], d[1]) || 1, ux = d[0] / L, uy = -d[1] / L;
      g.beginPath();
      g.moveTo(x - ux * 22, y - uy * 22);
      g.lineTo(x, y);
      g.moveTo(x - ux * 8 - uy * 6, y - uy * 8 + ux * 6);
      g.lineTo(x, y);
      g.lineTo(x - ux * 8 + uy * 6, y - uy * 8 - ux * 6);
      g.stroke();
    }
    g.restore();
    this.box = { x: x - r, y: y - r, w: 2 * r, h: 2 * r };
  }
  override obstacles(): Obstacle[] {
    return this.at ? [{ pt: this.at, r: this.r() + 4, weight: 2 }] : [];
  }
  where(): XY | null {
    return this.at;
  }
}

/** A mark that draws itself in a plot's coordinates (a cart, a wall, an arrow); it returns its box (CSS px) or null. */
export class Drawn extends Mark {
  kind = 'drawn';
  constructor(public paint: (env: DrawEnv, plot: Plot, self: Drawn) => Box | null, o: { id?: string; role?: string; says?: L10n; z?: number; avoid?: boolean; style?: Style } = {}) {
    super(o);
    this.avoid = o.avoid ?? true;
  }
  avoid: boolean;
  draw(env: DrawEnv): void {
    const g = env.g;
    g.save();
    const b = this.paint(env, this.plot, this);
    g.restore();
    this.box = b ?? { x: 0, y: 0, w: 0, h: 0 };
  }
  override obstacles(): Obstacle[] {
    return this.avoid && this.box.w > 0 ? [{ box: this.box }] : [];
  }
}

/** An arrow in data coordinates (a vector from its tail to its tip), in its role's colour. */
export class Arrow extends Mark {
  kind = 'arrow';
  private seg: [XY, XY] | null = null;
  /** `upto`: how much of it has grown out of its tail (0..1; a script's set() grows it). */
  constructor(public from: Val<XY>, public to: Val<XY>, public o: { id?: string; role?: string; says?: L10n; z?: number; width?: number; upto?: Val<number>; style?: Style; head?: number } = {}) {
    super({ ...o, z: o.z ?? 3 });
  }
  draw(env: DrawEnv): void {
    const a = this.plot.P(read(this.from)), b0 = this.plot.P(read(this.to)), g = env.g;
    const k = this.o.upto === undefined ? 1 : Math.max(0, Math.min(1, read(this.o.upto)));
    const b: XY = [a[0] + (b0[0] - a[0]) * k, a[1] + (b0[1] - a[1]) * k];
    const L = Math.hypot(b[0] - a[0], b[1] - a[1]);
    this.seg = [a, b];
    if (L < 1) {
      this.box = { x: 0, y: 0, w: 0, h: 0 };
      return;
    }
    const w = this.style.width ?? this.o.width ?? 3.5, head = Math.min(L * 0.45, this.o.head ?? 9 + w * 2), ux = (b[0] - a[0]) / L, uy = (b[1] - a[1]) / L;
    g.save();
    if (this.style.alpha !== undefined) g.globalAlpha *= this.style.alpha;
    g.strokeStyle = this.color;
    g.fillStyle = this.color;
    g.lineWidth = w;
    g.lineCap = 'round';
    g.beginPath();
    g.moveTo(a[0], a[1]);
    g.lineTo(b[0] - ux * head * 0.8, b[1] - uy * head * 0.8);
    g.stroke();
    g.beginPath();
    g.moveTo(b[0], b[1]);
    g.lineTo(b[0] - ux * head - uy * head * 0.45, b[1] - uy * head + ux * head * 0.45);
    g.lineTo(b[0] - ux * head + uy * head * 0.45, b[1] - uy * head - ux * head * 0.45);
    g.closePath();
    g.fill();
    g.restore();
    this.box = bounds([a, b]);
  }
  /** The tip (labels attach here). */
  where(): XY | null {
    return this.seg ? this.seg[1] : null;
  }
  override obstacles(): Obstacle[] {
    return this.seg ? [{ seg: this.seg, weight: 1.5 }, { pt: this.seg[1], r: 10, weight: 2 }] : [];
  }
}

/** Points (the predicted positions of a plan): filled dots of the role's colour. */
export class Dots extends Mark {
  kind = 'dots';
  private px: XY[] = [];
  constructor(public pts: Val<XY[]>, public o: { id?: string; role?: string; says?: L10n; r?: number; z?: number; style?: Style } = {}) {
    super({ ...o, z: o.z ?? 3 });
  }
  draw(env: DrawEnv): void {
    this.px = read(this.pts).map((p) => this.plot.P(p));
    const g = env.g, r = this.o.r ?? 4;
    g.save();
    this.clip(env);
    g.fillStyle = this.fill_color;
    if (this.style.fill_alpha !== undefined) g.globalAlpha *= this.style.fill_alpha;
    for (const [x, y] of this.px) {
      g.beginPath();
      g.arc(x, y, r, 0, Math.PI * 2);
      g.fill();
    }
    g.restore();
    this.box = this.px.length ? bounds(this.px.flatMap(([x, y]) => [[x - r, y - r], [x + r, y + r]] as XY[])) : { x: 0, y: 0, w: 0, h: 0 };
  }
  override obstacles(): Obstacle[] {
    return this.px.map((pt) => ({ pt, r: (this.o.r ?? 4) + 3, weight: 1 }));
  }
}

// ------------------------------------------------------------------ attached labels

/**
 * How a label is placed. By default the renderer chooses among `sides` the place that hides least. Overrides, for a
 * spot the rules get wrong: `avoid: false` takes the first side as it is (no search); `gap` is its distance from the
 * anchor (px); `offset` moves it after it is placed (px); `side: 'center'` with `avoid: false` puts its centre exactly
 * on the anchor (an exact position).
 */
export interface LabelOpts { id?: string; role?: string; sides?: Side[]; tex?: boolean; says?: L10n; z?: number; weight?: number; to?: Thing; kind?: TextKind; style?: Style; avoid?: boolean; gap?: number; offset?: Val<[number, number]> }
/** A label attached to a thing or a point; the renderer chooses its side so it hides as little as possible. */
export class Label extends Thing {
  kind = 'label';
  side: Side | null = null;
  /** Ids of the things it names (they are not obstacles to it). */
  own: string[] = [];
  constructor(public content: Val<Txt>, public anchor: Val<XY | Box | null>, public o: LabelOpts = {}) {
    super({ id: o.id, role: o.role ?? 'text', says: o.says, z: o.z ?? 6, style: o.style });
  }
  private f() {
    const st = this.style;
    return font_of(this.o.kind ?? 'label', { weight: st.weight ?? this.o.weight ?? 500, size: st.size, family: st.family, italic: st.italic });
  }
  size(lang: Lang): { w: number; h: number; asc: number } {
    const f = this.f(), s = txt(this.content, lang);
    if (!s) return { w: 0, h: 0, asc: 0 };
    if (this.o.tex) {
      const t0 = tex_size(s, f.size);
      return { w: t0.w, h: t0.asc + t0.desc, asc: t0.asc };
    }
    return { w: text_width(s, f), h: f.size * 1.25, asc: f.size * 0.95 };
  }
  draw(env: DrawEnv): void {
    const s = txt(this.content, env.lang);
    if (!s || this.box.w <= 0) return;
    const f = this.f(), g = env.g, sz = this.size(env.lang);
    // a paper backing (when asked) or a thin paper halo keeps it readable over lines it could not avoid
    if (this.style.backing) backing(g, { x: this.box.x - 3, y: this.box.y - 1, w: this.box.w + 6, h: this.box.h + 2 }, env, this.style.backing);
    if (this.o.tex) draw_tex(g, s, this.box.x, this.box.y + sz.asc, f.size, this.text_color);
    else {
      g.font = font_css(f);
      g.textBaseline = 'alphabetic';
      if (!this.style.backing) {
        g.lineWidth = 4;
        g.strokeStyle = rgba(env.look.palette.bg, 0.85);
        g.lineJoin = 'round';
        g.strokeText(s, this.box.x, this.box.y + sz.asc);
      }
      g.fillStyle = this.text_color;
      g.fillText(s, this.box.x, this.box.y + sz.asc);
    }
  }
  override text(lang: Lang): string {
    return txt(this.content, lang);
  }
  override text_px(): number {
    return this.f().size;
  }
}

// ------------------------------------------------------------------ handles (glass)

/**
 * A glass handle: where the hand is. It moves two params through a plot's coordinates (or one along an axis), clamps
 * to its ranges, snaps to its step, and reports when it is let go. Its touch target is never under 44 px.
 */
export class Handle extends Mark {
  kind = 'handle';
  /** 0 at rest, 1 under the pointer, 2 held (a param, so the renderer redraws it when it changes). */
  readonly state: Param<number>;
  constructor(public px: Param<number>, public py: Param<number> | null, public o: { id?: string; says?: L10n; r?: number; on_end?: () => void; on_move?: () => void } = {}) {
    super({ id: o.id ?? 'handle', role: 'glass', says: o.says, z: 8 });
    this.state = param(0, { name: this.id + '.state' });
  }
  get held(): boolean {
    return this.state.value === 2;
  }
  get hover(): boolean {
    return this.state.value === 1;
  }
  /** Move by one step of its params (the arrow keys). */
  nudge(dx: number, dy: number): void {
    const st = (p: Param<number>) => p.spec.step ?? (p.spec.range ? (p.spec.range[1] - p.spec.range[0]) / 50 : 0.1);
    if (dx) this.px.set(this.px.peek() + dx * st(this.px));
    if (dy && this.py) this.py.set(this.py.peek() + dy * st(this.py));
    this.o.on_move?.();
  }
  r(): number {
    return this.o.r ?? 13;
  }
  center(): XY {
    return this.plot.P([this.px.value, this.py ? this.py.value : this.plot.spec.y[0]]);
  }
  draw(env: DrawEnv): void {
    const [x, y] = this.center(), r = this.r() * (this.held ? 1.12 : this.hover ? 1.05 : 1), g = env.g;
    g.save();
    // soft shadow from the one high light, then a clear bead with a bright rim
    g.beginPath();
    g.arc(x + 1, y + 3, r + 1, 0, Math.PI * 2);
    g.fillStyle = 'rgba(17,17,19,0.16)';
    g.fill();
    const grd = g.createRadialGradient(x - r * 0.35, y - r * 0.45, r * 0.1, x, y, r);
    grd.addColorStop(0, 'rgba(255,255,255,0.98)');
    grd.addColorStop(0.55, 'rgba(255,255,255,0.78)');
    grd.addColorStop(1, 'rgba(236,236,240,0.9)');
    g.beginPath();
    g.arc(x, y, r, 0, Math.PI * 2);
    g.fillStyle = grd;
    g.fill();
    g.lineWidth = 0.75;
    g.strokeStyle = 'rgba(17,17,19,0.22)';
    g.stroke();
    g.beginPath();
    g.arc(x, y, 3.2, 0, Math.PI * 2);
    g.fillStyle = env.look.palette.ink;
    g.fill();
    g.restore();
    this.box = { x: x - r, y: y - r, w: 2 * r, h: 2 * r };
  }
  /** The touch target (CSS px radius). */
  target(): number {
    return Math.max(this.r(), look().layout.min_target / 2);
  }
  hits(p: XY): boolean {
    const [x, y] = this.center();
    return Math.hypot(p[0] - x, p[1] - y) <= this.target();
  }
  move_to(p: XY): void {
    const d = this.plot.inv(p);
    this.px.set(clamp(d[0], this.plot.spec.x[0], this.plot.spec.x[1]));
    if (this.py) this.py.set(clamp(d[1], this.plot.spec.y[0], this.plot.spec.y[1]));
    this.o.on_move?.();
  }
  override obstacles(): Obstacle[] {
    return this.box.w ? [{ pt: [this.box.x + this.box.w / 2, this.box.y + this.box.h / 2], r: this.r() + 4, weight: 2 }] : [];
  }
}

// ------------------------------------------------------------------ the escape hatch

/**
 * A block a figure draws itself (any picture), as long as it keeps the contract at its boundary: a box, a role, what
 * it says, and the shapes labels must avoid.
 */
export class CanvasBlock extends Thing implements Block {
  kind = 'canvas';
  constructor(public paint: (env: DrawEnv, b: Box) => void, public o: { id?: string; role?: string; says?: L10n; aspect?: number; height?: number; min?: number; z?: number; obstacles?: (b: Box) => Obstacle[] } = {}) {
    super({ id: o.id, role: o.role ?? 'noun', says: o.says, z: o.z ?? 2 });
  }
  measure(w: number): Size {
    const h = this.o.height ?? (this.o.aspect ? w / this.o.aspect : 120);
    return { h, min: this.o.min ?? h };
  }
  arrange(b: Box): void {
    this.box = { ...b };
  }
  things(): Thing[] {
    return [this];
  }
  label(): string {
    return `canvas '${this.id}'`;
  }
  draw(env: DrawEnv): void {
    this.paint(env, this.box);
  }
  override obstacles(): Obstacle[] {
    return this.o.obstacles ? this.o.obstacles(this.box) : [{ box: this.box }];
  }
}

/** The first share u (0..1) of a polyline, by length. */
function cut_polyline(pl: XY[], u: number): XY[] {
  if (u >= 1 || pl.length < 2) return pl;
  let total = 0;
  for (let i = 1; i < pl.length; i++) total += Math.hypot(pl[i][0] - pl[i - 1][0], pl[i][1] - pl[i - 1][1]);
  let left = total * u;
  const out: XY[] = [pl[0]];
  for (let i = 1; i < pl.length && left > 0; i++) {
    const L = Math.hypot(pl[i][0] - pl[i - 1][0], pl[i][1] - pl[i - 1][1]);
    if (L <= left) out.push(pl[i]);
    else out.push([pl[i - 1][0] + ((pl[i][0] - pl[i - 1][0]) * left) / L, pl[i - 1][1] + ((pl[i][1] - pl[i - 1][1]) * left) / L]);
    left -= L;
  }
  return out;
}
const bounds = bounds_of;

/** A paper card behind text (rounded a little), at an opacity: words stay readable over the lines under them. */
export function backing(g: CanvasRenderingContext2D, b: Box, env: DrawEnv, alpha: number): void {
  g.save();
  g.fillStyle = rgba(env.look.palette.bg, alpha);
  g.beginPath();
  if (g.roundRect) g.roundRect(b.x, b.y, b.w, b.h, 4);
  else g.rect(b.x, b.y, b.w, b.h);
  g.fill();
  g.restore();
}
