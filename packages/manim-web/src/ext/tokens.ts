// Token builder: tiles (MathTex tokens) dragged from a tray into ordered
// slots (web extension, see docs/EXTENSIONS.md). It only reports the sequence;
// grading is the lesson's job (e.g. @mathnim/core's expression grader).
//
//   const b = ui.add_tokens({ tokens: ['r', '\\pi', '\\times', '^2', '2'], slots: 3,
//                             on_change: (latex) => world.emit('formula', { latex, plain: b.value('plain') }) });
//   b.value('latex')  // "\\pi r^2"      b.value('plain')  // "pi*r^2"
//
// Keyboard: Tab to a tile, Enter puts it into the first empty slot (or back
// into the tray); arrow keys move it freely and Enter drops it into the
// nearest slot.
import { RoundedRectangle } from '../mobject/geometry/polygram';
import type { Mobject } from '../mobject/mobject';
import { DashedVMobject, VGroup } from '../mobject/types/vectorized_mobject';
import type { ParsableManimColor } from '../utils/color/core';
import { registry } from '../utils/registry';
import { to3, type Point3D, type Point3DLike } from '../utils/vector';
import { Draggable, draggables_in, type DropZone } from './dragdrop';
import type { Interaction } from './interact';

// ---------------------------------------------------------------- sequences (pure)

export interface TokenSpec {
  /** LaTeX of the token as it goes into the expression ("\\pi", "r", "^2"). */
  tex: string;
  /** Calculator spelling ("pi", "r", "^2"); inferred from tex when omitted. */
  plain?: string;
  /** LaTeX shown on the tile (default: tex; e.g. "\\square^2" for "^2"). */
  display?: string;
  /** Accessible name (default: the plain spelling). */
  label?: string;
  id?: string;
}
export type TokenLike = string | TokenSpec;

const as_spec = (t: TokenLike): TokenSpec => (typeof t === 'string' ? { tex: t } : t);

const PLAIN: Record<string, string> = {
  '\\pi': 'pi', 'π': 'pi', '\\times': '*', '\\cdot': '*', '×': '*', '·': '*', '\\div': '/', '÷': '/', '−': '-',
  '²': '^2', '³': '^3', '\\left(': '(', '\\right)': ')', '\\frac12': '(1/2)', '\\tfrac12': '(1/2)', '\\frac{1}{2}': '(1/2)', '\\tfrac{1}{2}': '(1/2)',
  '\\sqrt': 'sqrt', '\\theta': 'theta',
};

/** Calculator spelling of a LaTeX token: "\\pi" -> "pi", "\\times" -> "*", "^{2}" -> "^2". */
export function token_plain(tex: string): string {
  const t = tex.trim();
  if (t in PLAIN) return PLAIN[t];
  return t
    .replace(/\\left|\\right/g, '')
    .replace(/\^\{(\w)\}/g, '^$1')
    .replace(/\^\{([^}]*)\}/g, '^($1)')
    .replace(/\\(times|cdot)/g, '*')
    .replace(/\\([a-zA-Z]+)/g, '$1')
    .replace(/[{}]/g, '')
    .replace(/\s+/g, '');
}

type Role = 'value' | 'op' | 'open' | 'close' | 'postfix' | 'func';
function role(t: string): Role {
  if (/^[+\-*/=<>]$/.test(t)) return 'op';
  if (t === '(') return 'open';
  if (t === ')') return 'close';
  if (/^[\^!_]/.test(t)) return 'postfix';
  if (/^(sqrt|cbrt|sin|cos|tan|ln|log|exp|abs)\(?$/.test(t)) return 'func';
  return 'value';
}
const numeric = (t: string) => /^[\d.]+$/.test(t);

/** Join calculator tokens, adding "*" for implicit products: ["pi", "r", "^2"] -> "pi*r^2". */
export function join_plain(tokens: readonly string[]): string {
  let out = '';
  let prev: string | null = null;
  for (const t of tokens) {
    if (!t) continue;
    if (prev !== null) {
      const a = role(prev), b = role(t);
      const ends = a === 'value' || a === 'close' || a === 'postfix';
      const starts = b === 'value' || b === 'open' || b === 'func';
      if (ends && starts && !(numeric(prev) && numeric(t))) out += '*';
    }
    out += t;
    prev = t;
  }
  return out;
}

/** Join LaTeX tokens with spaces where TeX needs them: ["\\pi", "r", "^2"] -> "\\pi r^2". */
export function join_latex(tokens: readonly string[]): string {
  let out = '';
  for (const raw of tokens) {
    const t = raw.trim();
    if (!t) continue;
    const tight = !out || /^[\^_)\]}]/.test(t) || /[({[]$/.test(out) || (/\d$/.test(out) && /^\d/.test(t));
    out += (tight ? '' : ' ') + t;
  }
  return out;
}

/**
 * The expression a token sequence spells. Empty slots (null) are skipped
 * unless `blank` is given (e.g. "\\square" or "?").
 */
export function build_expression(seq: readonly (TokenLike | null)[], format: 'latex' | 'plain' = 'latex', o: { blank?: string } = {}): string {
  const parts: string[] = [];
  for (const t of seq) {
    if (!t) {
      if (o.blank) parts.push(o.blank);
      continue;
    }
    const s = as_spec(t);
    parts.push(format === 'latex' ? s.tex : s.plain ?? token_plain(s.tex));
  }
  return format === 'latex' ? join_latex(parts) : join_plain(parts);
}

// ---------------------------------------------------------------- the builder

export interface TokenOptions {
  tokens: TokenLike[];
  /** Number of slots (laid out in a row at `slots_at`) or their centres. */
  slots: number | readonly Point3DLike[];
  /** Centre of the slot row (default [0, 0.6, 0]) and of the tray row (default [0, -1.4, 0]). */
  slots_at?: Point3DLike;
  tray_at?: Point3DLike;
  /** Tile size [width, height] (default [0.9, 0.9]; widened for wide tokens). */
  tile?: [number, number];
  gap?: number;
  font_size?: number;
  /** Token text colour (default '#1F2937'), tile fill (default '#FFFFFF') and outline (default '#94A3B8'). */
  color?: ParsableManimColor;
  tile_fill?: ParsableManimColor;
  tile_stroke?: ParsableManimColor;
  /** Dashed slot outline colour (default '#94A3B8'). */
  slot_color?: ParsableManimColor;
  /** Format of value() and on_change (default 'latex'). */
  format?: 'latex' | 'plain';
  /** Add the slot boxes and tiles to the scene (default true). */
  add?: boolean;
  /** The sequence changed: its expression (in `format`), the tokens per slot. */
  on_change?: (value: string, seq: (TokenSpec | null)[], b: TokenBuilder) => void;
}

/** Tiles in a tray, dragged into ordered slots. Created by `ui.add_tokens`. */
export class TokenBuilder {
  ui: Interaction;
  o: TokenOptions;
  specs: TokenSpec[];
  /** One drop zone per slot (capacity 1; dropping on a full slot swaps). */
  slots: DropZone[];
  slot_points: Point3D[];
  /** The dashed slot outlines (a VGroup in the scene). */
  slot_boxes: VGroup;
  /** One Draggable per tile; `tile.data` is its TokenSpec. */
  tiles: Draggable[];

  constructor(ui: Interaction, o: TokenOptions) {
    this.ui = ui;
    this.o = o;
    this.specs = o.tokens.map(as_spec);
    const MathTex = registry.MathTex;
    const fs = o.font_size ?? 40;
    const [tw, th] = o.tile ?? [0.9, 0.9];
    const gap = o.gap ?? 0.25;
    // tiles first: their widths decide the slot width
    const faces: Mobject[] = this.specs.map((s) => new MathTex(s.display ?? s.tex, { font_size: fs, color: o.color ?? '#1F2937' }));
    const widths = faces.map((f) => Math.max(tw, f.width + 0.3));
    const slot_w = Math.max(tw, ...widths);
    const n = typeof o.slots === 'number' ? o.slots : o.slots.length;
    const sa = to3(o.slots_at ?? [0, 0.6, 0]);
    this.slot_points = typeof o.slots === 'number'
      ? Array.from({ length: n }, (_, i) => [sa[0] + (i - (n - 1) / 2) * (slot_w + gap), sa[1], 0] as Point3D)
      : o.slots.map(to3);
    this.slot_boxes = new VGroup();
    this.slots = this.slot_points.map((c, i) => {
      const box = new RoundedRectangle({ width: slot_w + 0.08, height: th + 0.08, corner_radius: 0.14 }).move_to(c);
      this.slot_boxes.add(new DashedVMobject(box, { num_dashes: 18, color: o.slot_color ?? '#94A3B8' }));
      const h = (slot_w + gap) / 2, v = (th + gap) / 2;
      return { id: `slot-${i + 1}`, label: `slot ${i + 1}`, region: { box: [c[0] - h, c[0] + h, c[1] - v, c[1] + v] }, capacity: 1, when_full: 'bump', hint: 'Drop here' } as DropZone;
    });
    const ta = to3(o.tray_at ?? [0, -1.4, 0]);
    const total = widths.reduce((s, w) => s + w, 0) + gap * (widths.length - 1);
    let x = ta[0] - total / 2;
    const scene = ui.player.scene;
    if (o.add !== false) scene.add(this.slot_boxes);
    this.tiles = this.specs.map((s, i) => {
      const home: Point3D = [x + widths[i] / 2, ta[1], 0];
      x += widths[i] + gap;
      const bg = new RoundedRectangle({ width: widths[i], height: th, corner_radius: 0.14, fill_color: o.tile_fill ?? '#FFFFFF', fill_opacity: 1, stroke_color: o.tile_stroke ?? '#94A3B8', stroke_width: 2 });
      const tile = new VGroup(bg, faces[i].move_to(bg.get_center())).move_to(home);
      if (o.add !== false) scene.add(tile);
      return new Draggable(ui, tile, {
        zones: this.slots,
        return_if_missed: 'home',
        home,
        label: `${s.label ?? s.plain ?? token_plain(s.tex)} tile`,
        hint: 'Drag tiles into the slots',
        data: s,
        keyboard_zone: (d, moved) => (moved ? undefined : d.zone ? null : this.slots.find((z) => draggables_in(ui, z).length === 0) ?? undefined),
        on_drop: () => this.changed(),
      });
    });
  }
  /** The token in each slot (null = empty). */
  sequence(): (TokenSpec | null)[] {
    return this.slots.map((z) => (draggables_in(this.ui, z)[0]?.data as TokenSpec | undefined) ?? null);
  }
  /** The expression spelled by the slots (empty slots skipped unless `blank`). */
  value(format: 'latex' | 'plain' = this.o.format ?? 'latex', blank?: string): string {
    return build_expression(this.sequence(), format, { blank });
  }
  /** Every slot is filled. */
  get complete(): boolean {
    return this.sequence().every((t) => t !== null);
  }
  /** All tiles back to the tray. */
  reset(): void {
    for (const t of this.tiles) t.reset();
    this.changed();
  }
  /** Fill the slots from code with tokens given by tex (or id); null leaves a slot empty. */
  set_sequence(seq: readonly (string | null)[]): void {
    for (const t of this.tiles) t.reset();
    const free = [...this.tiles];
    seq.forEach((want, i) => {
      if (want === null || i >= this.slots.length) return;
      const k = free.findIndex((t) => (t.data as TokenSpec).tex === want || (t.data as TokenSpec).id === want);
      if (k < 0) return;
      const [t] = free.splice(k, 1);
      t.zone = this.slots[i];
      t.mobject.move_to(this.slot_points[i]);
    });
    this.ui.notify();
    this.changed();
  }
  private changed(): void {
    this.o.on_change?.(this.value(), this.sequence(), this);
  }
}
