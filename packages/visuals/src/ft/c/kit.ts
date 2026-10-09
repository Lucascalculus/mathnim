// Controls and helpers shared by the part C visuals (VRAM, LoRA, quantisation).
//
// `Choice` is a segmented control: a row of labelled stops ("pills") whose
// selection is a ValueTracker holding the stop's value (e.g. 0/1/2 for
// full/LoRA/QLoRA, or 4096 for a sequence length). The student drags the
// highlighted pill to another stop or clicks one; the checker drags it to the
// extremes, where it snaps to the first or last stop. Words are drawn with
// part F's `label` (sans font, both languages).
import { RoundedRectangle, VGroup, VMobject, type ValueTracker } from 'manim-web';
import type { Mobject } from 'manim-web';
import { palette } from '../../theme';
import { label } from '../f/kit';

export type P3 = [number, number, number];

export const clamp = (x: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, x));

/** Mix two #RRGGBB colours (t = 0 gives a, t = 1 gives b) as [r, g, b] in 0..255. */
export function mix_rgb(a: string, b: string, t: number): [number, number, number] {
  const p = (s: string) => [1, 3, 5].map((i) => parseInt(s.slice(i, i + 2), 16));
  const A = p(a), B = p(b);
  return [0, 1, 2].map((k) => Math.round(A[k] + (B[k] - A[k]) * t)) as [number, number, number];
}
export const hex = (rgb: readonly number[]): string => `#${rgb.map((v) => clamp(Math.round(v), 0, 255).toString(16).padStart(2, '0')).join('')}`;

/** A rectangle from (x0, y0) to (x1, y1) as a filled VMobject (no stroke unless given). */
export function rect(x0: number, y0: number, x1: number, y1: number, fill: string, fill_opacity = 1, stroke?: string, stroke_width = 0): VMobject {
  const vm = VMobject({ fill_color: fill, fill_opacity, stroke_color: stroke ?? fill, stroke_width: stroke ? stroke_width : 0 });
  vm.set_points_as_corners([[x0, y0, 0], [x1, y0, 0], [x1, y1, 0], [x0, y1, 0], [x0, y0, 0]]);
  return vm;
}
/** A straight segment as a stroke-only VMobject. */
export function line(a: readonly number[], b: readonly number[], color: string, width = 2, opacity = 1): VMobject {
  const vm = VMobject({ stroke_color: color, stroke_width: width, stroke_opacity: opacity, fill_opacity: 0 });
  vm.set_points_as_corners([[a[0], a[1], 0], [b[0], b[1], 0]]);
  return vm;
}
/** A dashed straight segment (dash and gap in scene units) as one VMobject. */
export function dashes(a: readonly number[], b: readonly number[], color: string, width = 2, dash = 0.12, gap = 0.08, opacity = 1): VMobject {
  const vm = VMobject({ stroke_color: color, stroke_width: width, stroke_opacity: opacity, fill_opacity: 0 });
  const L = Math.hypot(b[0] - a[0], b[1] - a[1]);
  const ux = (b[0] - a[0]) / (L || 1), uy = (b[1] - a[1]) / (L || 1);
  const pts: number[] = [];
  for (let s = 0; s < L - 1e-9; s += dash + gap) {
    const e = Math.min(L, s + dash);
    for (let k = 0; k < 4; k++) {
      const t = s + ((e - s) * k) / 3;
      pts.push(a[0] + ux * t, a[1] + uy * t, 0);
    }
  }
  if (pts.length) vm.points = Float64Array.from(pts);
  else vm.set_points_as_corners([[a[0], a[1], 0], [b[0], b[1], 0]]);
  return vm;
}
/** Points of many separate straight segments, for one stroke-only VMobject. */
export function segs_points(segs: readonly (readonly [readonly number[], readonly number[]])[]): Float64Array {
  const out = new Float64Array(segs.length * 12);
  segs.forEach(([a, b], i) => {
    for (let k = 0; k < 4; k++) {
      const t = k / 3;
      out[12 * i + 3 * k] = a[0] + (b[0] - a[0]) * t;
      out[12 * i + 3 * k + 1] = a[1] + (b[1] - a[1]) * t;
    }
  });
  return out;
}
/** Points of many separate axis-aligned rectangles [x0, y0, x1, y1], for one filled VMobject. */
export function rects_points(rs: readonly (readonly number[])[]): Float64Array {
  const out = new Float64Array(rs.length * 48);
  rs.forEach(([x0, y0, x1, y1], i) => {
    const c = [[x0, y0], [x1, y0], [x1, y1], [x0, y1], [x0, y0]];
    for (let e = 0; e < 4; e++) {
      for (let k = 0; k < 4; k++) {
        const t = k / 3, o = 48 * i + 12 * e + 3 * k;
        out[o] = c[e][0] + (c[e + 1][0] - c[e][0]) * t;
        out[o + 1] = c[e][1] + (c[e + 1][1] - c[e][1]) * t;
      }
    }
  });
  return out;
}

/**
 * Words in the sans font (part F's `label`, both languages), coloured as a
 * whole so the Text itself carries the colour (the linter reads it there).
 */
export function txt(s: string, size = 24, color?: string, o: { weight?: string } = {}): VMobject {
  const col = color ?? palette().ink;
  const t = label(s, size, col, { weight: o.weight });
  t.set_color(col);
  return t;
}

/** Place m with its left edge at x (centre y). */
export function at_left<T extends Mobject>(m: T, x: number, y: number): T {
  m.move_to([x + m.width / 2, y, 0]);
  return m;
}
/** Place m with its right edge at x (centre y). */
export function at_right<T extends Mobject>(m: T, x: number, y: number): T {
  m.move_to([x - m.width / 2, y, 0]);
  return m;
}

/**
 * Text that follows `text()`: rebuilt only when the string (or colour) changes
 * (the key is stored on the group, so snapshots stay consistent), then placed
 * by `place`. `color` may be a function of the string.
 */
export function live_label(text: () => string, size: number, color: string | (() => string), place: (m: Mobject) => void, o: { weight?: string; max_width?: number } = {}): VGroup {
  const g = VGroup();
  const upd = (m: any) => {
    const s = text(), col = typeof color === 'function' ? color() : color;
    const key = `${s}|${col}`;
    if (m._key !== key) {
      m._key = key;
      const t = txt(s, size, col, { weight: o.weight });
      if (o.max_width && t.width > o.max_width) t.scale(o.max_width / t.width);
      m.submobjects = s ? [t] : [];
    }
    if (m.submobjects.length) place(m.submobjects[0]);
  };
  upd(g);
  g.add_updater(upd);
  return g;
}

/** Number formatting: 2 decimals below 1, 1 decimal below 1000, then thousands separators. */
export function fmt_gb(x: number): string {
  if (x < 0.995) return x.toFixed(2);
  if (x < 999.5) return x.toFixed(1);
  return Math.round(x).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}
/** a × 10^b as text with a superscript exponent: 9.5×10⁻⁶. */
export function sci(x: number, digits = 2): string {
  if (x === 0) return '0';
  const e = Math.floor(Math.log10(Math.abs(x)));
  const m = x / 10 ** e;
  const sup: Record<string, string> = { '-': '⁻', 0: '⁰', 1: '¹', 2: '²', 3: '³', 4: '⁴', 5: '⁵', 6: '⁶', 7: '⁷', 8: '⁸', 9: '⁹' };
  const ms = m.toFixed(digits - 1);
  // 9.96 rounds to 10.0: carry into the exponent
  if (+ms >= 10) return sci(10 ** (e + 1) * Math.sign(x), digits);
  return `${ms}×10${String(e).split('').map((ch) => sup[ch]).join('')}`;
}

// ---------------------------------------------------------------- events for worlds
/** The part of an Interaction the controls use (the checker passes a stand-in). */
export interface UiLike {
  add_handle(spec: any): unknown;
  on_click?(cb: (p: P3, hits: unknown[]) => void): void;
  notify?(): void;
}
export type Listener = (type: string, data: Record<string, unknown>) => void;
/**
 * Lessons subscribe to what the learner does in a visual:
 * `scene.listen((type, data) => world.emit(type, data))`. Visuals call
 * `emit(scene, 'method', { value: 1 })` when a drag or click ends.
 */
export function listen(scene: any, f: Listener): void {
  (scene._listeners ??= []).push(f);
}
export function emit(scene: any, type: string, data: Record<string, unknown> = {}): void {
  for (const f of scene._listeners ?? []) f(type, data);
}

// ---------------------------------------------------------------- segmented control
export interface ChoiceSpec {
  tracker: ValueTracker;
  /** Tracker value at each stop (default 0, 1, 2, ...). */
  values?: number[];
  labels: string[];
  /** Left and right edges and centre height of the row. */
  x0: number;
  x1: number;
  y: number;
  h?: number;
  font_size?: number;
  /** For numeric stops: the nearest stop is found in log space. */
  log?: boolean;
  /** Dim the control while false (e.g. the rank when the method is full fine-tuning). */
  enabled?: () => boolean;
  /** Colour of each unselected label (default ink), e.g. to tell two model families apart. */
  label_colors?: (string | undefined)[];
  /** Draw a thin divider before these stops. */
  dividers?: number[];
}

/** A segmented control bound to a ValueTracker (see the file header). */
export class Choice extends VGroup {
  declare spec: ChoiceSpec;
  declare values: number[];
  declare centres: number[];
  declare pill_w: number;
  declare knob: VMobject;
  declare texts: VMobject[];
  constructor(spec: ChoiceSpec) {
    super();
    const c = palette();
    this.spec = spec;
    const n = spec.labels.length, h = spec.h ?? 0.46, fs = spec.font_size ?? 24;
    this.values = spec.values ?? spec.labels.map((_, i) => i);
    const W = spec.x1 - spec.x0;
    this.pill_w = W / n;
    this.centres = spec.labels.map((_, i) => spec.x0 + this.pill_w * (i + 0.5));
    const track = RoundedRectangle({ width: W, height: h, corner_radius: h / 2, fill_color: c.faint, fill_opacity: 1, stroke_width: 0 }) as unknown as VMobject;
    track.move_to([(spec.x0 + spec.x1) / 2, spec.y, 0]);
    this.knob = RoundedRectangle({ width: this.pill_w - 0.06, height: h - 0.07, corner_radius: (h - 0.07) / 2, fill_color: c.bg, fill_opacity: 1, stroke_color: c.accent, stroke_width: 2.5 }) as unknown as VMobject;
    this.texts = spec.labels.map((s, i) => {
      const t = txt(s, fs, c.ink);
      if (t.width > this.pill_w - 0.1) t.scale((this.pill_w - 0.1) / t.width);
      t.move_to([this.centres[i], spec.y, 0]);
      return t;
    });
    const divs = (spec.dividers ?? []).map((i) => line([spec.x0 + this.pill_w * i, spec.y - h / 2 + 0.07], [spec.x0 + this.pill_w * i, spec.y + h / 2 - 0.07], c.muted, 1.5));
    this.add(track, ...divs, this.knob, ...this.texts);
    const upd = (m: any) => {
      const k = this.index(), on = spec.enabled ? spec.enabled() : true;
      const key = `${k}|${on}`;
      if (m._key === key) return;
      m._key = key;
      this.knob.move_to([this.centres[k], spec.y, 0]);
      this.texts.forEach((t, i) => t.set_color(i === k ? c.accent : on ? spec.label_colors?.[i] ?? c.ink : c.muted));
      this.knob.set_stroke({ color: on ? c.accent : c.muted });
      track.set_fill({ opacity: on ? 1 : 0.5 });
    };
    upd(this);
    this.add_updater(upd);
  }
  /** Index of the stop nearest to the tracker's value. */
  index(): number {
    const v = this.spec.tracker.get_value();
    let best = 0, bd = Infinity;
    this.values.forEach((s, i) => {
      const d = this.spec.log ? Math.abs(Math.log(Math.max(1e-9, v)) - Math.log(Math.max(1e-9, s))) : Math.abs(v - s);
      if (d < bd) {
        bd = d;
        best = i;
      }
    });
    return best;
  }
  /** Stop nearest to scene x. */
  stop_at(x: number): number {
    return clamp(Math.round((x - this.spec.x0) / this.pill_w - 0.5), 0, this.values.length - 1);
  }
  /** Register the control with an Interaction: drag the highlighted pill, or click a pill. */
  attach(ui: UiLike, label_text: string, on_end?: (value: number) => void): unknown {
    const s = this.spec, y = s.y, h = s.h ?? 0.46;
    const lo = this.centres[0], hi = this.centres[this.centres.length - 1];
    ui.on_click?.((p: P3) => {
      if (p[0] < s.x0 || p[0] > s.x1 || Math.abs(p[1] - y) > h / 2 + 0.04) return;
      s.tracker.set_value(this.values[this.stop_at(p[0])]);
      ui.notify?.();
      on_end?.(s.tracker.get_value());
    });
    return ui.add_handle({
      get: (): P3 => [this.centres[this.index()], y, 0],
      set: (p: P3) => s.tracker.set_value(this.values[this.stop_at(p[0])]),
      constraint: (p: P3): P3 => [clamp(p[0], lo, hi), y, 0],
      step: this.pill_w,
      radius: Math.max(0.3, Math.min(this.pill_w / 2, 0.5)),
      highlight: false,
      label: label_text,
      on_end: () => on_end?.(s.tracker.get_value()),
    });
  }
}

/** A caption (muted words) with its left edge at x, above a control row at y. */
export function caption(s: string, x: number, y: number, size = 24): VMobject {
  return at_left(txt(s, size, palette().muted), x, y);
}

// ---------------------------------------------------------------- labels that never overlap
export interface Box { x0: number; x1: number; y0: number; y1: number }
export interface TipLabel {
  m: Mobject;
  /** [start, end] of the arrow (scene points): the label goes near the end. */
  tip: () => [readonly number[], readonly number[]];
  /** Hide the label while false. */
  visible?: () => boolean;
}
const hit = (a: Box, b: Box) => a.x0 < b.x1 && b.x0 < a.x1 && a.y0 < b.y1 && b.y0 < a.y1;
/**
 * Labels placed beyond the tips of arrows, in order: each takes the first of
 * 12 directions around its tip (starting along the arrow; then two rings
 * further out) where it stays in
 * `box` and touches neither an earlier label nor any of `avoid()`.
 */
export function tip_labels(items: TipLabel[], box: Box, avoid: () => Box[] = () => [], gap = 0.14): VGroup {
  const g = VGroup(...items.map((i) => i.m));
  const upd = () => {
    const taken: Box[] = [...avoid()];
    for (const it of items) {
      const on = it.visible ? it.visible() : true;
      const m: any = it.m;
      if (m._on !== on) {
        m._on = on;
        m.set_opacity(on ? 1 : 0);
      }
      if (!on) continue;
      const [a, b] = it.tip();
      let base = Math.atan2(b[1] - a[1], b[0] - a[0]);
      if (Math.hypot(b[0] - a[0], b[1] - a[1]) < 1e-6) base = Math.PI / 4;
      const w = m.width / 2, h = m.height / 2;
      let best: Box | null = null, best_c: number[] = [b[0], b[1]], best_hits = Infinity;
      for (let k = 0; k < 36; k++) {
        const j = k % 12, ring = Math.floor(k / 12);
        const ang = base + (j % 2 ? 1 : -1) * Math.ceil(j / 2) * (Math.PI / 6);
        const ux = Math.cos(ang), uy = Math.sin(ang);
        const r = Math.min(Math.abs(ux) > 1e-9 ? w / Math.abs(ux) : Infinity, Math.abs(uy) > 1e-9 ? h / Math.abs(uy) : Infinity) + gap + 0.45 * ring;
        let cx = b[0] + ux * r, cy = b[1] + uy * r;
        cx = clamp(cx, box.x0 + w, box.x1 - w);
        cy = clamp(cy, box.y0 + h, box.y1 - h);
        const bb = { x0: cx - w, x1: cx + w, y0: cy - h, y1: cy + h };
        const hits = taken.filter((t) => hit(t, bb)).length;
        if (hits < best_hits) {
          best_hits = hits;
          best = bb;
          best_c = [cx, cy];
          if (!hits) break;
        }
      }
      const c = m.get_center();
      if (Math.abs(c[0] - best_c[0]) > 1e-9 || Math.abs(c[1] - best_c[1]) > 1e-9) m.move_to([best_c[0], best_c[1], 0]);
      if (best) taken.push(best);
    }
  };
  upd();
  g.add_updater(upd);
  return g;
}
