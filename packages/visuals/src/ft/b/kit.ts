// Controls and labels shared by the part B visuals (SFT): a discrete switch
// (a knob that snaps between labelled stops), a linear or logarithmic slider,
// and word + number readouts. Words come from part F's kit (Text in the sans
// font, in the learner's language); every control is a ValueTracker, so the
// player's snapshots seek exactly and lessons can set and read the values.
import { DecimalNumber, Dot, Line, Rectangle, VGroup, VMobject, ValueTracker, always_redraw } from 'manim-web';
import type { Mobject } from 'manim-web';
import { palette } from '../../theme';
import { fit, label, pick, type Lang } from '../f/kit';

export { LANG_SPEC, fit, label, pick, resolve_lang, type Lang } from '../f/kit';

type P3 = [number, number, number];
interface UiLike { add_handle(spec: any): unknown }
export const clamp = (x: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, x));
/** Index of a discrete tracker (it may be fractional while animated). */
export const idx = (t: ValueTracker, n: number) => clamp(Math.round(t.get_value()), 0, n - 1);

/** A straight segment as a VMobject. */
export function seg(a: readonly number[], b: readonly number[], color: string, width = 2, opacity = 1): VMobject {
  return Line([a[0], a[1], 0], [b[0], b[1], 0], { color, stroke_width: width, stroke_opacity: opacity }) as unknown as VMobject;
}
/** A filled rectangle with its lower-left corner at (x, y). */
export function rect(x: number, y: number, w: number, h: number, fill: string, opacity = 1, stroke?: string, stroke_width = 0): VMobject {
  const r = Rectangle({ width: Math.max(w, 1e-3), height: Math.max(h, 1e-3), fill_color: fill, fill_opacity: w > 1e-3 && h > 1e-3 ? opacity : 0, stroke_color: stroke ?? fill, stroke_width }) as unknown as VMobject;
  r.move_to([x + w / 2, y + h / 2, 0]);
  return r;
}
/** Diagonal hatch lines inside a rectangle (so a pattern, not only a colour, marks a region). */
export function hatch(x: number, y: number, w: number, h: number, color: string, gap = 0.16, width = 1.5, opacity = 0.8): VMobject {
  const vm = VMobject({ stroke_color: color, stroke_width: width, stroke_opacity: opacity, fill_opacity: 0 });
  const pts: number[] = [];
  const push = (a: number[], b: number[]) => {
    for (let k = 0; k < 4; k++) pts.push(a[0] + ((b[0] - a[0]) * k) / 3, a[1] + ((b[1] - a[1]) * k) / 3, 0);
  };
  if (w > 0.02 && h > 0.02) {
    for (let s = gap / 2; s < w + h; s += gap) {
      // line x - x0 + (y - y0) = s, clipped to the box
      const a = [x + Math.min(s, w), y + Math.max(0, s - w)];
      const b = [x + Math.max(0, s - h), y + Math.min(s, h)];
      push(a, b);
    }
  }
  vm.points = Float64Array.from(pts.length ? pts : [x, y, 0, x, y, 0, x, y, 0, x, y, 0]);
  if (!pts.length) vm.set_opacity(0);
  return vm;
}

/**
 * A discrete switch drawn as a vertical radio list: a short track with one
 * stop per option, the option's words to the right, a knob on the current one.
 * `attach(ui)` makes the knob draggable (it snaps to the nearest stop; arrow
 * keys step one option). Options never overlap, whatever their length.
 */
export interface Choice { group: VGroup; attach(ui: UiLike): void; at(v: number): P3 }
export function choice(t: ValueTracker, options: string[], o: { x: number; y: number; width: number; gap?: number; title?: string; size?: number; name?: string; color?: string; mono?: boolean }): Choice {
  const c = palette();
  const n = options.length, size = o.size ?? 22, gap = o.gap ?? 0.44;
  const y_of = (v: number) => o.y - clamp(v, 0, n - 1) * gap;
  const at = (v: number): P3 => [o.x, y_of(v), 0];
  const track = seg([o.x, o.y + 0.08], [o.x, y_of(n - 1) - 0.08], c.faint, 6);
  const stops = options.map((_, i) => Dot(at(i), { radius: 0.07, color: c.muted }));
  const labels = options.map((s, i) => {
    const m = fit(label(s, size, c.ink), o.width - 0.4, gap * 0.9);
    m.move_to([o.x + 0.3 + m.width / 2, y_of(i), 0]);
    return m;
  });
  const hl = always_redraw(() => {
    const k = idx(t, n);
    const m = labels[k];
    const r = Rectangle({ width: m.width + 0.18, height: Math.max(m.height + 0.12, 0.34), stroke_color: o.color ?? c.accent, stroke_width: 2, fill_color: o.color ?? c.accent, fill_opacity: 0.08 });
    r.move_to(m.get_center());
    return r;
  });
  const knob = always_redraw(() => Dot(at(t.get_value()), { radius: 0.13, color: o.color ?? c.accent }));
  const parts: Mobject[] = [track, ...stops, hl, ...labels, knob];
  if (o.title) {
    const ti = fit(label(o.title, size, c.muted), o.width, 0.42);
    ti.move_to([o.x - 0.13 + ti.width / 2, o.y + gap * 0.95, 0]);
    parts.unshift(ti);
  }
  const group = VGroup(...parts);
  if (o.name) group.name = o.name;
  return {
    group,
    at,
    attach(ui) {
      ui.add_handle({
        tracker: t,
        from_value: (v: number) => at(v),
        to_value: (p: number[]) => clamp(Math.round((o.y - p[1]) / gap), 0, n - 1),
        step: 1,
        radius: 0.4,
        label: o.title ? `${o.title}: ${options.join(' / ')}` : options.join(' / '),
      });
    },
  };
}

/** A slider for a continuous value; `log` spaces it logarithmically, `zero` reserves the left end for exactly 0. */
export interface SliderCtl { group: VGroup; attach(ui: UiLike): void; pos(v: number): number; val(t: number): number }
export function slider(t: ValueTracker, o: { x: number; y: number; width: number; min: number; max: number; log?: boolean; zero?: boolean; title?: string; size?: number; decimals?: number; shown?: (v: number) => number; unit?: string; name?: string; color?: string; snap?: (v: number) => number }): SliderCtl {
  const c = palette();
  const size = o.size ?? 22, Z = o.zero ? 0.06 : 0;
  // position in [0, 1] <-> value
  const val = (s: number): number => {
    s = clamp(s, 0, 1);
    if (o.zero && s < Z / 2) return 0;
    const u = o.zero ? clamp((s - Z) / (1 - Z), 0, 1) : s;
    let v = o.log ? o.min * Math.pow(o.max / o.min, u) : o.min + u * (o.max - o.min);
    if (o.snap) v = o.snap(v);
    return clamp(v, o.zero ? 0 : o.min, o.max);
  };
  const pos = (v: number): number => {
    if (o.zero && v <= 0) return 0;
    const vv = clamp(v, o.min, o.max);
    const u = o.log ? Math.log(vv / o.min) / Math.log(o.max / o.min) : (vv - o.min) / (o.max - o.min);
    return o.zero ? Z + u * (1 - Z) : u;
  };
  const x0 = o.x, x1 = o.x + o.width;
  const at = (v: number): P3 => [x0 + pos(v) * (x1 - x0), o.y, 0];
  const track = seg([x0, o.y], [x1, o.y], c.faint, 6);
  const fill = always_redraw(() => {
    const e = at(t.get_value());
    return e[0] - x0 > 1e-3 ? seg([x0, o.y], e, o.color ?? c.accent, 6) : seg([x0, o.y], [x0 + 1e-3, o.y], c.faint, 6);
  });
  const knob = always_redraw(() => Dot(at(t.get_value()), { radius: 0.13, color: o.color ?? c.accent }));
  const parts: Mobject[] = [track, fill, knob];
  if (o.title) {
    const ti = fit(label(o.title, size, c.muted), 3.2, 0.5);
    ti.move_to([x0 - 0.35 - ti.width / 2, o.y, 0]);
    parts.unshift(ti);
  }
  const shown = o.shown ?? ((v: number) => v);
  const dn: any = DecimalNumber(shown(t.get_value()), { num_decimal_places: o.decimals ?? 2, font_size: size + 12, color: c.ink, unit: o.unit ?? null });
  dn._v = NaN;
  const place = () => {
    const v = shown(t.get_value()), k = Math.round(v * 10 ** (o.decimals ?? 2));
    if (dn._v !== k) {
      dn.set_value(v);
      dn._v = k;
    }
    dn.move_to([x1 + 0.3 + dn.width / 2, o.y, 0]);
  };
  place();
  dn.add_updater(place);
  parts.push(dn);
  const group = VGroup(...parts);
  if (o.name) group.name = o.name;
  return {
    group,
    pos,
    val,
    attach(ui) {
      ui.add_handle({
        tracker: t,
        from_value: (v: number) => at(v),
        to_value: (p: number[]) => val((p[0] - x0) / (x1 - x0)),
        step: o.log ? undefined : (o.max - o.min) / 50,
        radius: 0.35,
        label: o.title ?? 'slider',
      });
    },
  };
}

/** "words: number" with the number following get(); the left edge stays at x. */
export function readout(words: string, get: () => number, o: { x: number; y: number; size?: number; decimals?: number; unit?: string; color?: string; value_color?: string }): VGroup {
  const c = palette();
  const size = o.size ?? 24;
  const lab = label(words, size, o.color ?? c.ink);
  const dn: any = DecimalNumber(get(), { num_decimal_places: o.decimals ?? 2, font_size: size + 14, color: o.value_color ?? c.ink, unit: o.unit ?? null });
  dn._v = NaN;
  lab.move_to([o.x + lab.width / 2, o.y, 0]);
  const g = VGroup(lab, dn);
  const upd = () => {
    const v = get(), k = Math.round(v * 10 ** (o.decimals ?? 2));
    if (dn._v !== k) {
      dn.set_value(v);
      dn._v = k;
    }
    const lc = lab.get_center();
    dn.move_to([lc[0] + lab.width / 2 + 0.15 + dn.width / 2, lc[1], 0]);
  };
  upd();
  g.add_updater(upd);
  return g;
}

/** Show exactly one of several pre-built mobjects (by index); all are placed at `at` (left-aligned). */
export function pick_one(variants: Mobject[], index: () => number, at: readonly number[], align: 'left' | 'center' = 'left'): VGroup {
  const g = VGroup(...variants);
  for (const v of variants) {
    if (align === 'left') v.move_to([at[0] + v.width / 2, at[1], 0]);
    else v.move_to([at[0], at[1], 0]);
  }
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

/** Words in the current language. */
export const say = (lang: Lang, en: string, zh: string, size = 24, color?: string): VMobject => label(pick(lang, en, zh), size, color);

/** A number formatted with a fixed number of decimals (for static labels). */
export const f = (x: number, d = 1) => x.toFixed(d);
