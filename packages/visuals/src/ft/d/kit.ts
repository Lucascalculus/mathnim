// Drawing helpers for the part D (preference optimization) visuals.
// Every visual here takes a `lang` parameter ('auto' | 'en' | 'zh', see
// ../f/kit.ts); words are set with Text in the sans font (CJK falls back to a
// system font in node and needs a CJK web font in the browser), numbers and
// formulas with MathTex.
import { DecimalNumber, Dot, Line, Rectangle, RoundedRectangle, Text, VGroup, VMobject, always_redraw, RIGHT } from 'manim-web';
import type { Mobject, ValueTracker } from 'manim-web';
import { palette } from '../../theme';
import { tex } from '../../linalg/kit';

// Canvas language: parts A/F's convention (lang 'auto' follows the learner's language).
export { LANG_SPEC, pick, resolve_lang, ft_lang, type Lang } from '../f/kit';
export type P3 = [number, number, number];
export const clamp = (x: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, x));

/** Words in the sans font. */
export function label(s: string, size = 26, color?: string, weight = 'NORMAL'): VMobject {
  return Text(s, { font_size: size, color: color ?? palette().ink, font: 'sans', weight }) as unknown as VMobject;
}
/** Words placed with their left edge at x. */
export function label_at(s: string, x: number, y: number, size = 26, color?: string, weight = 'NORMAL'): VMobject {
  const m = label(s, size, color, weight);
  m.move_to([x + m.width / 2, y, 0]);
  return m;
}
/** A number that follows get() (centre fixed, or left edge fixed when `left`). */
export function live_number(get: () => number, o: { decimals?: number; size?: number; color?: string; unit?: string; color_of?: (v: number) => string } = {}): VMobject {
  const c = palette();
  const d = o.decimals ?? 2;
  const dn = DecimalNumber(get(), { num_decimal_places: d, font_size: o.size ?? 28, color: o.color ?? c.ink, unit: o.unit ?? null }) as any;
  dn._v = Math.round(get() * 10 ** d);
  dn.add_updater((m: any) => {
    const v = get(), shown = Math.round(v * 10 ** d);
    const col = o.color_of?.(v);
    if (m._v !== shown) {
      const left = m.get_left()[0], cy = m.get_center()[1];
      m.set_value(v);
      m.move_to([left + m.width / 2, cy, 0]);
      m._v = shown;
    }
    if (col && m._col !== col) {
      m.set_color(col);
      m._col = col;
    }
  });
  return dn as VMobject;
}
/** "words  value": a Text caption and a live number to its right (left edge fixed at x). */
export function readout_at(caption: string, get: () => number, x: number, y: number, o: { decimals?: number; size?: number; color?: string; value_color?: string; unit?: string; color_of?: (v: number) => string } = {}): VGroup {
  const size = o.size ?? 26;
  const cap = label(caption, size, o.color);
  cap.move_to([x + cap.width / 2, y, 0]);
  const num = live_number(get, { decimals: o.decimals, size: size + 2, color: o.value_color ?? o.color, unit: o.unit, color_of: o.color_of });
  const place = () => num.move_to([cap.get_right()[0] + 0.15 + num.width / 2, y, 0]);
  place();
  num.add_updater(place);
  return VGroup(cap, num);
}
/** A plain straight line. */
export function seg(a: readonly number[], b: readonly number[], color: string, width = 2, opacity = 1): VMobject {
  return Line([a[0], a[1], 0], [b[0], b[1], 0], { color, stroke_width: width, stroke_opacity: opacity }) as unknown as VMobject;
}
/** A filled rectangle between x0..x1 and y0..y1 (zero-size rectangles stay invisible). */
export function rect(x0: number, y0: number, x1: number, y1: number, fill: string, opacity = 1, stroke?: string, stroke_width = 0): VMobject {
  const w = Math.max(0.001, Math.abs(x1 - x0)), h = Math.max(0.001, Math.abs(y1 - y0));
  const r = Rectangle({ width: w, height: h, fill_color: fill, fill_opacity: opacity, stroke_color: stroke ?? fill, stroke_width }) as unknown as VMobject;
  r.move_to([(x0 + x1) / 2, (y0 + y1) / 2, 0]);
  if (Math.abs(x1 - x0) < 0.002 || Math.abs(y1 - y0) < 0.002) r.set_opacity(0);
  return r;
}
/** A rounded panel. */
export function panel(x0: number, y0: number, x1: number, y1: number, o: { stroke?: string; fill?: string; fill_opacity?: number; width?: number } = {}): VMobject {
  const c = palette();
  const r = RoundedRectangle({ width: x1 - x0, height: y1 - y0, corner_radius: 0.12, stroke_color: o.stroke ?? c.faint, stroke_width: o.width ?? 2, fill_color: o.fill ?? c.bg, fill_opacity: o.fill_opacity ?? 0 }) as unknown as VMobject;
  r.move_to([(x0 + x1) / 2, (y0 + y1) / 2, 0]);
  return r;
}
/** Tick labels (MathTex numbers) along a horizontal axis. */
export function x_ticks(values: number[], x_of: (v: number) => number, y: number, fmt: (v: number) => string = (v) => `${v}`, size = 24): VGroup {
  const c = palette();
  return VGroup(...values.map((v) => {
    const t = tex(fmt(v), size, c.muted);
    t.move_to([x_of(v), y, 0]);
    return t;
  }));
}
/** Tick labels along a vertical axis (right-aligned at x). */
export function y_ticks(values: number[], y_of: (v: number) => number, x: number, fmt: (v: number) => string = (v) => `${v}`, size = 24): VGroup {
  const c = palette();
  return VGroup(...values.map((v) => {
    const t = tex(fmt(v), size, c.muted);
    t.move_to([x - t.width / 2, y_of(v), 0]);
    return t;
  }));
}
/** A polyline through points (stroke only). */
export function polyline(pts: readonly (readonly number[])[], color: string, width = 4, opacity = 1): VMobject {
  const vm = VMobject({ stroke_color: color, stroke_width: width, stroke_opacity: opacity, fill_opacity: 0 }) as unknown as VMobject;
  if (pts.length >= 2) vm.set_points_as_corners(pts.map((p) => [p[0], p[1], 0]) as any);
  else vm.set_points_as_corners([[0, 0, 0], [0.001, 0, 0]] as any), vm.set_opacity(0);
  return vm;
}

/**
 * A two-state switch: a short track, a knob at the left (0) or right (1),
 * and a caption. The knob follows `t` (rounded); `attach` makes it draggable.
 */
export class Switch {
  group: VGroup;
  track: VMobject;
  knob: Mobject;
  x0: number;
  x1: number;
  y: number;
  /** `caption` is one text, or [when off, when on]. */
  constructor(readonly t: ValueTracker, x: number, y: number, caption: string | [string, string], o: { size?: number; width?: number; on_color?: string; off_color?: string } = {}) {
    const c = palette();
    const w = o.width ?? 0.7;
    this.x0 = x;
    this.x1 = x + w;
    this.y = y;
    this.track = always_redraw(() => {
      const on = t.get_value() > 0.5;
      const r = RoundedRectangle({ width: w + 0.3, height: 0.34, corner_radius: 0.17, stroke_width: 0, fill_color: on ? (o.on_color ?? c.accent) : (o.off_color ?? c.faint), fill_opacity: 1 }) as unknown as VMobject;
      r.move_to([x + w / 2, y, 0]);
      return r;
    }) as unknown as VMobject;
    this.knob = always_redraw(() => Dot([t.get_value() > 0.5 ? this.x1 : this.x0, y, 0], { radius: 0.13, color: c.bg, stroke_color: c.muted, stroke_width: 2, fill_opacity: 1 } as any)) as unknown as Mobject;
    const caps = (typeof caption === 'string' ? [caption, caption] : caption).map((s) => label(s, o.size ?? 24, c.ink));
    const left = this.x1 + 0.35;
    const cap = typeof caption === 'string' ? caps[0].move_to([left + caps[0].width / 2, y, 0]) : switch_text(caps, () => (t.get_value() > 0.5 ? 1 : 0), left, y);
    this.group = VGroup(this.track, this.knob, cap);
  }
  /** Register the knob with an Interaction (dragging past the middle flips it). */
  attach(ui: { add_handle(spec: any): unknown }, name: string, on_change?: () => void): void {
    ui.add_handle({
      cue: false, // a switch or a row of choices reads as a control by itself
      get: () => [this.t.get_value() > 0.5 ? this.x1 : this.x0, this.y, 0],
      set: (p: P3) => {
        const v = p[0] > (this.x0 + this.x1) / 2 ? 1 : 0;
        if (v !== (this.t.get_value() > 0.5 ? 1 : 0)) {
          this.t.set_value(v);
          on_change?.();
        }
      },
      constraint: (p: P3) => [clamp(p[0], this.x0, this.x1), this.y, 0],
      step: this.x1 - this.x0,
      radius: 0.35,
      label: name,
    });
  }
}

/** Texts at the same left edge, only the one chosen by index() visible. */
export function switch_text(variants: VMobject[], index: () => number, left: number, y: number): VGroup {
  variants.forEach((v) => v.move_to([left + v.width / 2, y, 0]));
  const g = VGroup(...variants);
  const upd = (m: any) => {
    const k = index();
    if (m._shown === k) return;
    m._shown = k;
    variants.forEach((v, i) => v.set_opacity(i === k ? 1 : 0));
  };
  upd(g);
  g.add_updater(upd);
  return g;
}

/**
 * A horizontal slider drawn from plain mobjects (track, filled part, knob)
 * bound to tracker t over [lo, hi]; `attach` adds the drag handle.
 */
export class HSlider {
  group: VGroup;
  constructor(readonly t: ValueTracker, readonly lo: number, readonly hi: number, readonly x0: number, readonly x1: number, readonly y: number, o: { color?: string } = {}) {
    const c = palette();
    const track = seg([x0, y], [x1, y], c.faint, 7);
    const fill = always_redraw(() => {
      const x = this.x_of(t.get_value());
      return seg([x0, y], [Math.max(x0 + 0.002, x), y], o.color ?? c.accent, 7);
    });
    const knob = always_redraw(() => Dot([this.x_of(t.get_value()), y, 0], { radius: 0.14, color: o.color ?? c.accent }));
    this.group = VGroup(track, fill, knob);
  }
  x_of(v: number): number {
    return this.x0 + ((clamp(v, this.lo, this.hi) - this.lo) / (this.hi - this.lo)) * (this.x1 - this.x0);
  }
  value_of(x: number): number {
    return this.lo + (clamp((x - this.x0) / (this.x1 - this.x0), 0, 1)) * (this.hi - this.lo);
  }
  attach(ui: { add_handle(spec: any): unknown }, name: string, o: { snap?: number; on_change?: () => void; on_end?: () => void } = {}): void {
    ui.add_handle({
      tracker: this.t,
      from_value: (v: number) => [this.x_of(v), this.y, 0],
      to_value: (p: P3) => {
        let v = this.value_of(p[0]);
        if (o.snap) v = Math.round(v / o.snap) * o.snap;
        return clamp(v, this.lo, this.hi);
      },
      constraint: (p: P3) => [clamp(p[0], this.x0, this.x1), this.y, 0],
      step: (this.hi - this.lo) / 50,
      radius: 0.35,
      label: name,
      on_change: o.on_change,
      on_end: o.on_end,
    });
  }
}

/** Arrange parts left to right at a fixed left edge. */
export function row_at(parts: Mobject[], x: number, y: number, buff = 0.15): VGroup {
  const g = VGroup(...parts);
  g.arrange(RIGHT, { buff });
  g.move_to([x + g.width / 2, y, 0]);
  return g;
}

/**
 * Words and formulas in one line: plain strings are set as Text, `{ tex }`
 * parts as MathTex (so subscripts render), left edge at x.
 */
export function mixed(parts: (string | { tex: string })[], x: number, y: number, size = 22, color?: string): VGroup {
  const c = palette();
  const ms = parts.map((q) => (typeof q === 'string' ? label(q, size, color ?? c.ink) : tex(q.tex, size + 4, color ?? c.ink)));
  const g = VGroup(...ms);
  g.arrange(RIGHT, { buff: 0.06 });
  g.move_to([x + g.width / 2, y, 0]);
  return g;
}
