// Drawing and control helpers for the part E visuals (GRPO, pass@k, KL fits,
// the R1 recipe). Language helpers come from part F's kit so every label
// follows the learner's language (`lang: 'auto'`). The controls here are
// made of drag handles (keyboard: Tab + arrows; the visuals checker drags
// them), so they work the same in an embedded visual and in a world:
//   Toggle   - an on/off switch;
//   Choice   - a segmented selector of n options (a discrete slider);
//   VSwitch  - a two-position vertical switch (a card's right/wrong verdict).
import { DecimalNumber, Dot, Rectangle, RoundedRectangle, VGroup, VMobject, always_redraw } from 'manim-web';
import type { Mobject, ValueTracker } from 'manim-web';
import { palette } from '../../theme';
import { tex } from '../../linalg/kit';
import { label, pick, type Lang } from '../f/kit';

export { LANG_SPEC, resolve_lang, pick, label, box, fit, seg, group, type Lang } from '../f/kit';
export type P3 = [number, number, number];
export const clamp = (x: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, x));
type UiLike = { add_handle(spec: any): unknown };

/** A filled rectangle between (x0, y0) and (x1, y1); degenerate ones are invisible. */
export function rect(x0: number, y0: number, x1: number, y1: number, fill: string, opacity = 1, stroke?: string, stroke_width = 0): VMobject {
  const w = Math.max(0.002, Math.abs(x1 - x0)), h = Math.max(0.002, Math.abs(y1 - y0));
  const r = Rectangle({ width: w, height: h, fill_color: fill, fill_opacity: opacity, stroke_color: stroke ?? fill, stroke_width }) as unknown as VMobject;
  r.move_to([(x0 + x1) / 2, (y0 + y1) / 2, 0]);
  if (Math.abs(x1 - x0) < 0.003 || Math.abs(y1 - y0) < 0.003) r.set_opacity(0);
  return r;
}
/** A rounded rectangle centred at (x, y). */
export function rrect(x: number, y: number, w: number, h: number, o: { stroke?: string; fill?: string; fill_opacity?: number; width?: number; radius?: number } = {}): VMobject {
  const c = palette();
  const r = RoundedRectangle({ width: w, height: h, corner_radius: o.radius ?? 0.12, stroke_color: o.stroke ?? c.faint, stroke_width: o.width ?? 2, fill_color: o.fill ?? c.bg, fill_opacity: o.fill_opacity ?? 0 }) as unknown as VMobject;
  r.move_to([x, y, 0]);
  return r;
}
/** Words with their left edge at x (centre y). */
export function label_at(s: string, x: number, y: number, size = 24, color?: string, weight = 'NORMAL'): VMobject {
  const m = label(s, size, color, { weight });
  m.move_to([x + m.width / 2, y, 0]);
  return m;
}
/** A number that follows get(); `anchor` keeps its left edge ('left') or centre ('center') fixed. */
export function live_number(get: () => number, at: readonly number[], o: { decimals?: number; size?: number; color?: string | (() => string); anchor?: 'left' | 'center'; signed?: boolean } = {}): VMobject {
  const c = palette();
  const d = o.decimals ?? 2;
  const col = () => (typeof o.color === 'function' ? o.color() : o.color ?? c.ink);
  const dn = DecimalNumber(get(), { num_decimal_places: d, font_size: o.size ?? 26, color: col(), include_sign: !!o.signed }) as any;
  const place = (m: any) => {
    if (o.anchor === 'center') m.move_to([at[0], at[1], 0]);
    else m.move_to([at[0] + m.width / 2, at[1], 0]);
  };
  dn._v = NaN;
  dn._c = '';
  dn.add_updater((m: any) => {
    const v = get(), shown = Math.round(v * 10 ** d);
    if (m._v !== shown) {
      m.set_value(Object.is(shown, -0) || shown === 0 ? 0 : v);
      m._v = shown;
      place(m);
    }
    const cc = col();
    if (m._c !== cc) {
      m.set_color(cc);
      m._c = cc;
    }
  });
  place(dn);
  return dn as VMobject;
}
/** A small tag such as "示意 / toy model" or "精确计算 / exact": muted words in a thin box. */
export function tag(s: string, x: number, y: number, size = 20, anchor: 'left' | 'right' | 'center' = 'left'): VGroup {
  const c = palette();
  const t = label(s, size, c.muted);
  const w = t.width + 0.24, h = t.height + 0.16;
  const cx = anchor === 'left' ? x + w / 2 : anchor === 'right' ? x - w / 2 : x;
  t.move_to([cx, y, 0]);
  return VGroup(rrect(cx, y, w, h, { stroke: c.faint, width: 1.5, radius: 0.08 }), t);
}
/** Show one of several prebuilt variants (by index), the others hidden. */
export function pick_shown<T extends Mobject>(variants: T[], index: () => number): VGroup {
  const g = VGroup(...variants);
  const upd = (m: any) => {
    const k = index();
    if (m._k === k) return;
    m._k = k;
    variants.forEach((v, i) => v.set_opacity(i === k ? 1 : 0));
  };
  upd(g);
  g.add_updater(upd);
  return g;
}

/** An on/off switch: a pill (accent when on) with a knob, and a caption to its right. */
export class Toggle {
  group: VGroup;
  readonly x0: number;
  readonly x1: number;
  constructor(readonly t: ValueTracker, x: number, readonly y: number, caption: string, o: { size?: number; on_color?: string } = {}) {
    const c = palette();
    const w = 0.56;
    this.x0 = x + 0.17;
    this.x1 = x + w - 0.17 + 0.17;
    const pill = always_redraw(() => {
      const on = t.get_value() > 0.5;
      return rrect(x + w / 2 + 0.085, y, w + 0.17, 0.34, { stroke: on ? (o.on_color ?? c.accent) : c.muted, width: 1.5, fill: on ? (o.on_color ?? c.accent) : c.faint, fill_opacity: 1, radius: 0.17 });
    });
    const knob = always_redraw(() => Dot([t.get_value() > 0.5 ? this.x1 : this.x0, y, 0], { radius: 0.12, color: c.bg, stroke_color: c.muted, stroke_width: 1.5, fill_opacity: 1 } as any));
    const cap = label(caption, o.size ?? 22, c.ink);
    cap.move_to([x + w + 0.42 + cap.width / 2, y, 0]);
    this.group = VGroup(pill, knob, cap);
  }
  attach(ui: UiLike, name: string, on_change?: (on: boolean) => void): void {
    ui.add_handle({
      get: () => [this.t.get_value() > 0.5 ? this.x1 : this.x0, this.y, 0],
      set: (p: P3) => {
        const v = p[0] > (this.x0 + this.x1) / 2 ? 1 : 0;
        if (v !== (this.t.get_value() > 0.5 ? 1 : 0)) {
          this.t.set_value(v);
          on_change?.(v === 1);
        }
      },
      constraint: (p: P3) => [clamp(p[0], this.x0, this.x1), this.y, 0],
      step: this.x1 - this.x0,
      radius: 0.32,
      label: name,
    });
  }
}

/** A segmented selector: n labelled cells in a row; the chosen one is filled. The tracker holds the index. */
export class Choice {
  group: VGroup;
  readonly xs: number[];
  constructor(readonly t: ValueTracker, readonly x0: number, readonly y: number, options: string[], o: { size?: number; cell?: number; h?: number } = {}) {
    const c = palette();
    const size = o.size ?? 20;
    const labels = options.map((s) => label(s, size, c.ink));
    const cw = o.cell ?? Math.max(...labels.map((l) => l.width)) + 0.3, h = o.h ?? 0.44;
    this.xs = options.map((_, i) => x0 + cw * (i + 0.5));
    const frame = rrect(x0 + (cw * options.length) / 2, y, cw * options.length, h, { stroke: c.muted, width: 1.5, radius: 0.1 });
    const fill = always_redraw(() => {
      const k = Math.round(t.get_value());
      return rrect(this.xs[k], y, cw - 0.06, h - 0.06, { stroke: c.accent, width: 0, fill: c.accent, fill_opacity: 0.16, radius: 0.08 });
    });
    const divs = options.slice(1).map((_, i) => rect(x0 + cw * (i + 1) - 0.006, y - h / 2 + 0.06, x0 + cw * (i + 1) + 0.006, y + h / 2 - 0.06, c.faint));
    labels.forEach((l, i) => l.move_to([this.xs[i], y, 0]));
    const ink = always_redraw(() => {
      const k = Math.round(t.get_value());
      return VGroup(...labels.map((l, i) => l.copy().set_color(i === k ? c.accent : c.muted)));
    });
    this.group = VGroup(frame, fill, ...divs, ink);
  }
  attach(ui: UiLike, name: string, on_change?: (k: number) => void): void {
    const n = this.xs.length;
    ui.add_handle({
      get: () => [this.xs[Math.round(this.t.get_value())], this.y, 0],
      set: (p: P3) => {
        let best = 0;
        this.xs.forEach((x, i) => {
          if (Math.abs(x - p[0]) < Math.abs(this.xs[best] - p[0])) best = i;
        });
        if (best !== Math.round(this.t.get_value())) {
          this.t.set_value(best);
          on_change?.(best);
        }
      },
      constraint: (p: P3) => [clamp(p[0], this.xs[0], this.xs[n - 1]), this.y, 0],
      step: n > 1 ? this.xs[1] - this.xs[0] : 1,
      radius: 0.3,
      label: name,
    });
  }
}

/** The verdict of an answer card: a vertical two-position switch (top = right ✓, bottom = wrong ✗). */
export class VSwitch {
  group: VGroup;
  constructor(readonly t: ValueTracker, readonly x: number, readonly y_on: number, readonly y_off: number) {
    const c = palette();
    const pill = always_redraw(() => {
      const on = t.get_value() > 0.5;
      return rrect(x, (y_on + y_off) / 2, 0.3, y_on - y_off + 0.3, { stroke: on ? c.good : c.coral, width: 1.5, fill: on ? c.good : c.coral, fill_opacity: 0.18, radius: 0.15 });
    });
    const knob = always_redraw(() => Dot([x, t.get_value() > 0.5 ? y_on : y_off, 0], { radius: 0.12, color: c.bg, stroke_color: t.get_value() > 0.5 ? c.good : c.coral, stroke_width: 2.5, fill_opacity: 1 } as any));
    this.group = VGroup(pill, knob);
  }
  attach(ui: UiLike, name: string, on_change?: (on: boolean) => void): void {
    const mid = (this.y_on + this.y_off) / 2;
    ui.add_handle({
      get: () => [this.x, this.t.get_value() > 0.5 ? this.y_on : this.y_off, 0],
      set: (p: P3) => {
        const v = p[1] > mid ? 1 : 0;
        if (v !== (this.t.get_value() > 0.5 ? 1 : 0)) {
          this.t.set_value(v);
          on_change?.(v === 1);
        }
      },
      constraint: (p: P3) => [this.x, clamp(p[1], this.y_off, this.y_on), 0],
      step: this.y_on - this.y_off,
      radius: 0.3,
      label: name,
    });
  }
}

/** Big check mark / cross, as TeX so both languages share it. */
export const verdict_mark = (right: boolean, size = 40): Mobject => tex(right ? '\\checkmark' : '\\times', size, right ? palette().good : palette().coral);

/** "word" in both languages, for labels that are always the same pair. */
export const both = (lang: Lang, en: string, zh: string): string => pick(lang, en, zh);
