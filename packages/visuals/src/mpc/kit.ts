// Drawing helpers shared by every visual of the MPC course (docs/lessons/mpc/KIT.md):
//   - the running example: a cart on a track with a wall (Track);
//   - a plot panel (Plot): past solid, predicted dashed, constraint bands shaded,
//     inputs as zero-order-hold stairs, live curves, dots and cursors;
//   - the horizon strip (HorizonStrip): the N planned inputs, the first one applied,
//     the window shifting by one step and the plan being re-solved;
//   - small pieces: polylines (solid, dashed, clipped), filled boxes, hatching,
//     a stepped slider (StepSlider), live text.
// Everything reads colours from palette() when it is built, keeps its state in
// ValueTrackers (so the player can seek exactly) and draws words in the learner's
// language (LANG_SPEC / resolve_lang / pick from ../ft/f/kit).
import { Circle, RoundedRectangle, VGroup, VMobject, ValueTracker, UpdateFromAlphaFunc, linear, smooth } from 'manim-web';
import type { Animation, Mobject } from 'manim-web';
import { palette } from '../theme';
import { label, fit } from '../ft/f/kit';
import { tex } from '../linalg/kit';

export { LANG_SPEC, pick, resolve_lang, ft_lang, type Lang } from '../ft/f/kit';
export { Choice, listen, emit, live_label, txt, type Listener, type UiLike } from '../ft/c/kit';
export { tex, texs, backed } from '../linalg/kit';
export { label, fit };

export type P3 = [number, number, number];
export type XY = readonly [number, number];
export interface Box { x0: number; x1: number; y0: number; y1: number }
export const clamp = (x: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, x));
/** The frame's safe area (the linter wants the outer 0.15 kept free). */
export const SAFE: Box = { x0: -6.95, x1: 6.95, y0: -3.85, y1: 3.85 };

// ---------------------------------------------------------------- paths
/** Points (cubic Bézier quads) of a polyline: consecutive straight pieces of one subpath. */
export function poly_points(pts: readonly XY[]): Float64Array {
  if (pts.length < 2) return new Float64Array(0);
  const out = new Float64Array((pts.length - 1) * 12);
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i], b = pts[i + 1];
    for (let k = 0; k < 4; k++) {
      const t = k / 3, o = 12 * i + 3 * k;
      out[o] = a[0] + (b[0] - a[0]) * t;
      out[o + 1] = a[1] + (b[1] - a[1]) * t;
    }
  }
  return out;
}
/** Points of several separate polylines in one path (each one its own subpath). */
export function polys_points(polys: readonly (readonly XY[])[]): Float64Array {
  const parts = polys.filter((p) => p.length >= 2).map(poly_points);
  const out = new Float64Array(parts.reduce((s, p) => s + p.length, 0));
  let o = 0;
  for (const p of parts) {
    out.set(p, o);
    o += p.length;
  }
  return out;
}
/** Cut a polyline into dashes of length `dash` with gaps `gap` (scene units), measured along it. */
export function dash_polys(pts: readonly XY[], dash = 0.14, gap = 0.09): XY[][] {
  const out: XY[][] = [];
  let cur: XY[] = [], s = 0; // s: position within the current dash+gap period
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i], b = pts[i + 1];
    const L = Math.hypot(b[0] - a[0], b[1] - a[1]);
    let t = 0;
    while (t < L - 1e-12) {
      const at = (u: number): XY => [a[0] + ((b[0] - a[0]) * u) / (L || 1), a[1] + ((b[1] - a[1]) * u) / (L || 1)];
      if (s < dash) {
        const step = Math.min(dash - s, L - t);
        if (!cur.length) cur.push(at(t));
        t += step;
        s += step;
        cur.push(at(t));
        if (s >= dash - 1e-12) {
          out.push(cur);
          cur = [];
        }
      } else {
        const step = Math.min(dash + gap - s, L - t);
        t += step;
        s += step;
        if (s >= dash + gap - 1e-12) s = 0;
      }
    }
  }
  if (cur.length >= 2) out.push(cur);
  return out;
}
/** Clip a polyline to a box (Liang–Barsky per segment); returns the pieces inside. */
export function clip_poly(pts: readonly XY[], b: Box): XY[][] {
  const out: XY[][] = [];
  let cur: XY[] = [];
  const flush = () => {
    if (cur.length >= 2) out.push(cur);
    cur = [];
  };
  for (let i = 0; i < pts.length - 1; i++) {
    const [x0, y0] = pts[i], [x1, y1] = pts[i + 1];
    const dx = x1 - x0, dy = y1 - y0;
    let t0 = 0, t1 = 1, ok = true;
    for (const [p, q] of [[-dx, x0 - b.x0], [dx, b.x1 - x0], [-dy, y0 - b.y0], [dy, b.y1 - y0]] as [number, number][]) {
      if (Math.abs(p) < 1e-15) {
        if (q < 0) ok = false;
      } else {
        const r = q / p;
        if (p < 0) t0 = Math.max(t0, r);
        else t1 = Math.min(t1, r);
      }
    }
    if (!ok || t0 > t1) {
      flush();
      continue;
    }
    const A: XY = [x0 + t0 * dx, y0 + t0 * dy], B: XY = [x0 + t1 * dx, y0 + t1 * dy];
    const last = cur[cur.length - 1];
    if (!last || Math.hypot(last[0] - A[0], last[1] - A[1]) > 1e-9) {
      flush();
      cur.push(A);
    }
    cur.push(B);
    if (t1 < 1) flush();
  }
  flush();
  return out;
}
/** A stroke-only path. */
export function stroke(color: string, width = 3, opacity = 1): VMobject {
  return VMobject({ stroke_color: color, stroke_width: width, stroke_opacity: opacity, fill_opacity: 0 });
}
/** A static polyline (dashed when `dash` is given as [dash, gap]). */
export function polyline(pts: readonly XY[], color: string, width = 3, o: { dash?: [number, number]; opacity?: number } = {}): VMobject {
  const vm = stroke(color, width, o.opacity ?? 1);
  vm.points = o.dash ? polys_points(dash_polys(pts, o.dash[0], o.dash[1])) : poly_points(pts);
  return vm;
}
/**
 * A path whose points are recomputed from `f()` every frame, skipped while
 * `key()` is unchanged (the key is stored on the mobject, so snapshots stay consistent).
 */
export function live_vm(vm: VMobject, f: () => Float64Array, key?: () => string): VMobject {
  const upd = (m: any) => {
    if (key) {
      const k = key();
      if (m._live_key === k && m.points.length) return;
      m._live_key = k;
    }
    m.points = f();
  };
  upd(vm);
  vm.add_updater(upd);
  return vm;
}
/** A filled axis-aligned box (no stroke unless given). */
export function fill_box(x0: number, y0: number, x1: number, y1: number, color: string, opacity = 1, o: { stroke?: string; width?: number } = {}): VMobject {
  const vm = VMobject({ fill_color: color, fill_opacity: opacity, stroke_color: o.stroke ?? color, stroke_width: o.stroke ? o.width ?? 2 : 0 });
  vm.set_points_as_corners([[x0, y0, 0], [x1, y0, 0], [x1, y1, 0], [x0, y1, 0], [x0, y0, 0]]);
  return vm;
}
/** A filled polygon through points (closed automatically). */
export function fill_poly(pts: readonly XY[], color: string, opacity = 1): VMobject {
  const vm = VMobject({ fill_color: color, fill_opacity: opacity, stroke_width: 0, stroke_color: color });
  if (pts.length >= 3) vm.set_points_as_corners([...pts, pts[0]].map((p) => [p[0], p[1], 0]) as any);
  return vm;
}
/** Diagonal hatching inside a box (e.g. a wall), one path. */
export function hatch(b: Box, color: string, spacing = 0.18, width = 2, opacity = 1): VMobject {
  const segs: XY[][] = [];
  const h = b.y1 - b.y0;
  for (let x = b.x0 - h; x < b.x1; x += spacing) {
    // a 45° line from (x, y0) to (x + h, y1), clipped to the box
    const piece = clip_poly([[x, b.y0], [x + h, b.y1]], b);
    segs.push(...piece);
  }
  const vm = stroke(color, width, opacity);
  vm.points = polys_points(segs);
  return vm;
}

/** Show m only while cond() holds (opacity toggled by an updater; the flag is stored on m). */
export function visible_when<T extends Mobject>(m: T, cond: () => boolean, opacity = 1): T {
  const upd = (x: any) => {
    const k = cond() ? 1 : 0;
    if (x._vis === k) return;
    x._vis = k;
    x.set_opacity(k * opacity);
  };
  upd(m);
  m.add_updater(upd);
  return m;
}
/** Place m with its left edge at x (centre height y); `right`: its right edge at x. */
export function at(m: Mobject, x: number, y: number, align: 'left' | 'center' | 'right' = 'left'): Mobject {
  m.move_to([align === 'left' ? x + m.width / 2 : align === 'right' ? x - m.width / 2 : x, y, 0]);
  return m;
}
/** Words (sans) of at most `max_w` wide, placed with its left edge at x. */
export function words(s: string, size: number, color: string, x: number, y: number, o: { max_w?: number; align?: 'left' | 'center' | 'right'; weight?: string } = {}): VMobject {
  const m = label(s, size, color, { weight: o.weight });
  m.set_color(color);
  if (o.max_w) fit(m, o.max_w);
  at(m, x, y, o.align ?? 'left');
  return m;
}

// ---------------------------------------------------------------- plot panel
export interface PlotSpec {
  /** Where the axes go (scene units): the data area, without tick labels. */
  box: Box;
  /** Data ranges. */
  x: [number, number];
  y: [number, number];
  x_ticks?: number[];
  y_ticks?: number[];
  /** Tick label text (default: the number, trailing zeros dropped). */
  x_fmt?: (v: number) => string;
  y_fmt?: (v: number) => string;
  /** Axis titles: words (sans) or TeX when given as { tex }. */
  x_label?: string | { tex: string };
  y_label?: string | { tex: string };
  /** Faint horizontal grid lines at the y ticks (default true). */
  grid?: boolean;
  /** Draw the x axis at y = 0 instead of at the bottom (default: bottom). */
  zero_axis?: boolean;
  font?: number;
}
type Style = { color?: string; width?: number; dash?: boolean | [number, number]; opacity?: number };
const num = (v: number) => (Math.abs(v) < 1e-12 ? '0' : String(+v.toFixed(3)));

/**
 * A plot panel: axes, ticks and titles, and data drawn with X()/Y(). Data
 * outside the ranges is clipped to the box. `group` holds the axes; the
 * methods return mobjects to add (bands first, then curves, so curves sit on top).
 */
export class Plot {
  spec: PlotSpec;
  box: Box;
  group: VGroup;
  constructor(spec: PlotSpec) {
    this.spec = spec;
    this.box = spec.box;
    const c = palette();
    const b = spec.box, fs = spec.font ?? 22;
    const parts: Mobject[] = [];
    const ax_y = spec.zero_axis && spec.y[0] < 0 && spec.y[1] > 0 ? this.Y(0) : b.y0;
    if (spec.grid !== false) for (const v of spec.y_ticks ?? []) if (Math.abs(this.Y(v) - ax_y) > 1e-6) parts.push(polyline([[b.x0, this.Y(v)], [b.x1, this.Y(v)]], c.faint, 1.5));
    parts.push(polyline([[b.x0, ax_y], [b.x1, ax_y]], c.muted, 2), polyline([[b.x0, b.y0], [b.x0, b.y1]], c.muted, 2));
    for (const v of spec.x_ticks ?? []) {
      const x = this.X(v);
      parts.push(polyline([[x, ax_y - 0.06], [x, ax_y + 0.06]], c.muted, 2));
      const t = tex((spec.x_fmt ?? num)(v), fs, c.muted);
      t.move_to([x, b.y0 - 0.12 - t.height / 2, 0]);
      parts.push(t);
    }
    for (const v of spec.y_ticks ?? []) {
      const y = this.Y(v);
      const t = tex((spec.y_fmt ?? num)(v), fs, c.muted);
      t.move_to([b.x0 - 0.12 - t.width / 2, y, 0]);
      parts.push(t);
    }
    const title = (s: string | { tex: string }) => (typeof s === 'string' ? (() => {
      const m = label(s, fs, c.muted);
      m.set_color(c.muted);
      return m;
    })() : tex(s.tex, fs + 4, c.muted));
    if (spec.x_label) {
      const t = title(spec.x_label);
      t.move_to([b.x1 - t.width / 2, b.y0 - 0.14 - t.height / 2 - (spec.x_ticks?.length ? 0.32 : 0), 0]);
      parts.push(t);
    }
    if (spec.y_label) {
      const t = title(spec.y_label);
      t.move_to([b.x0 + t.width / 2 - 0.05, b.y1 + 0.12 + t.height / 2, 0]);
      parts.push(t);
    }
    this.group = VGroup(...parts);
  }
  X(x: number): number {
    const s = this.spec;
    return s.box.x0 + ((x - s.x[0]) / (s.x[1] - s.x[0])) * (s.box.x1 - s.box.x0);
  }
  Y(y: number): number {
    const s = this.spec;
    return s.box.y0 + ((y - s.y[0]) / (s.y[1] - s.y[0])) * (s.box.y1 - s.box.y0);
  }
  P(x: number, y: number): P3 {
    return [this.X(x), this.Y(y), 0];
  }
  /** Data coordinates of a scene point. */
  data(pt: readonly number[]): [number, number] {
    const s = this.spec;
    return [s.x[0] + ((pt[0] - s.box.x0) / (s.box.x1 - s.box.x0)) * (s.x[1] - s.x[0]), s.y[0] + ((pt[1] - s.box.y0) / (s.box.y1 - s.box.y0)) * (s.y[1] - s.y[0])];
  }
  /** Scene points of data points, clipped to the box (pieces). */
  pieces(pts: readonly XY[]): XY[][] {
    return clip_poly(pts.map(([x, y]) => [this.X(x), this.Y(y)] as XY), this.box);
  }
  private points_of(pts: readonly XY[], st: Style): Float64Array {
    const ps = this.pieces(pts);
    if (!st.dash) return polys_points(ps);
    const [d, g] = st.dash === true ? [0.14, 0.09] : st.dash;
    return polys_points(ps.flatMap((p) => dash_polys(p, d, g)));
  }
  /** A static curve through data points. */
  curve(pts: readonly XY[], st: Style = {}): VMobject {
    const vm = stroke(st.color ?? palette().accent, st.width ?? 4, st.opacity ?? 1);
    vm.points = this.points_of(pts, st);
    return vm;
  }
  /** A curve recomputed from get() every frame (skipped while key() is unchanged). */
  live_curve(get: () => readonly XY[], st: Style = {}, key?: () => string): VMobject {
    return live_vm(stroke(st.color ?? palette().accent, st.width ?? 4, st.opacity ?? 1), () => this.points_of(get(), st), key);
  }
  /**
   * Zero-order-hold stairs: value v_k held on [x_k, x_{k+1}) — how a sampled input
   * really acts. `get()` returns [x_k, v_k] pairs; the last value is held to `x_end` (default: x_k + one step).
   */
  stairs_points(vals: readonly XY[], x_end?: number): XY[] {
    const out: XY[] = [];
    vals.forEach(([x, v], i) => {
      const xn = i + 1 < vals.length ? vals[i + 1][0] : x_end ?? x + (vals.length > 1 ? vals[1][0] - vals[0][0] : 1);
      out.push([x, v], [xn, v]);
    });
    return out;
  }
  stairs(vals: readonly XY[], st: Style = {}, x_end?: number): VMobject {
    return this.curve(this.stairs_points(vals, x_end), st);
  }
  live_stairs(get: () => readonly XY[], st: Style = {}, key?: () => string, x_end?: () => number): VMobject {
    return this.live_curve(() => this.stairs_points(get(), x_end?.()), st, key);
  }
  /** A shaded horizontal band between data values y0 and y1 (clipped to the plot): a constraint region. */
  band(y0: number, y1: number, color?: string, opacity = 0.16): VMobject {
    const lo = clamp(this.Y(Math.min(y0, y1)), this.box.y0, this.box.y1), hi = clamp(this.Y(Math.max(y0, y1)), this.box.y0, this.box.y1);
    return fill_box(this.box.x0, lo, this.box.x1, Math.max(lo + 1e-4, hi), color ?? palette().coral, opacity);
  }
  /** A shaded vertical band between data x0 and x1 (e.g. the horizon window), live when given functions. */
  vband(x0: number | (() => number), x1: number | (() => number), color?: string, opacity = 0.1): VMobject {
    const f = () => {
      const a = clamp(this.X(typeof x0 === 'function' ? x0() : x0), this.box.x0, this.box.x1);
      const b = clamp(this.X(typeof x1 === 'function' ? x1() : x1), this.box.x0, this.box.x1);
      const lo = Math.min(a, b), hi = Math.max(a, b, lo + 1e-4);
      return poly_points([[lo, this.box.y0], [hi, this.box.y0], [hi, this.box.y1], [lo, this.box.y1], [lo, this.box.y0]]);
    };
    const vm = VMobject({ fill_color: color ?? palette().accent, fill_opacity: opacity, stroke_width: 0, stroke_color: color ?? palette().accent });
    if (typeof x0 === 'number' && typeof x1 === 'number') {
      vm.points = f();
      return vm;
    }
    return live_vm(vm, f, () => `${typeof x0 === 'function' ? x0().toFixed(5) : x0},${typeof x1 === 'function' ? x1().toFixed(5) : x1}`);
  }
  /** The region between a curve and the top (or bottom) of the plot, shaded: e.g. "too fast to stop" above a braking curve. */
  region(pts: readonly XY[], side: 'above' | 'below', color?: string, opacity = 0.16): VMobject {
    const sp = pts.map(([x, y]) => [clamp(this.X(x), this.box.x0, this.box.x1), clamp(this.Y(y), this.box.y0, this.box.y1)] as XY);
    const edge = side === 'above' ? this.box.y1 : this.box.y0;
    const poly: XY[] = [[sp[0][0], edge], ...sp, [sp[sp.length - 1][0], edge]];
    return fill_poly(poly, color ?? palette().coral, opacity);
  }
  /** A horizontal reference line across the plot (dashed by default). */
  hline(y: number, color?: string, o: { width?: number; dash?: boolean | [number, number] } = {}): VMobject {
    return this.curve([[this.spec.x[0], y], [this.spec.x[1], y]], { color: color ?? palette().muted, width: o.width ?? 2.5, dash: o.dash ?? true });
  }
  vline(x: number, color?: string, o: { width?: number; dash?: boolean | [number, number] } = {}): VMobject {
    return this.curve([[x, this.spec.y[0]], [x, this.spec.y[1]]], { color: color ?? palette().muted, width: o.width ?? 2.5, dash: o.dash ?? true });
  }
  /** A vertical line that follows get_x() ("now"). */
  cursor(get_x: () => number, color?: string, width = 2.5): VMobject {
    return this.live_curve(() => [[get_x(), this.spec.y[0]], [get_x(), this.spec.y[1]]], { color: color ?? palette().ink, width }, () => get_x().toFixed(5));
  }
  /** A dot that follows get() (hidden when outside the plot or when get() returns null). */
  live_dot(get: () => XY | null, color?: string, radius = 0.08): VMobject {
    const d: any = Circle({ radius, color: color ?? palette().accent, fill_opacity: 1, stroke_width: 0 });
    const upd = (m: any) => {
      const p = get();
      const inside = !!p && p[0] >= this.spec.x[0] - 1e-9 && p[0] <= this.spec.x[1] + 1e-9 && p[1] >= this.spec.y[0] - 1e-9 && p[1] <= this.spec.y[1] + 1e-9;
      const key = p ? `${p[0].toFixed(5)},${p[1].toFixed(5)},${inside}` : 'none';
      if (m._key === key) return;
      m._key = key;
      m.set_opacity(inside ? 1 : 0);
      if (p && inside) m.move_to(this.P(p[0], p[1]));
    };
    upd(d);
    d.add_updater(upd);
    return d;
  }
  /** Words placed at a data point (left edge at it unless `align`). */
  note(s: string, x: number, y: number, color?: string, size = 20, align: 'left' | 'center' | 'right' = 'left'): VMobject {
    return words(s, size, color ?? palette().muted, this.X(x), this.Y(y), { align });
  }
}

// ---------------------------------------------------------------- the cart on a track
export interface TrackSpec {
  /** Left and right ends of the rail on screen, and its height. */
  x0: number;
  x1: number;
  y: number;
  /** Positions [m] at the two ends. */
  p: [number, number];
  /** Tick spacing [m] (default 1) and which ticks get a number (default every 2nd). */
  tick?: number;
  label_every?: number;
  /** A wall at this position (drawn just beyond it, hatched). */
  wall?: number;
  /** A target flag at this position. */
  target?: number;
  /** Size of the cart body (scene units, default 0.9 × 0.42). */
  cart_w?: number;
  cart_h?: number;
  font?: number;
  /** Write "m" after the last tick label (default true). */
  unit?: boolean;
}
/**
 * The running example's track: a rail with metre ticks, an optional wall
 * (hatched, at `wall`) and target flag, and carts that follow trackers.
 * Position p is the cart's FRONT bumper, so p = wall means touching the wall.
 */
export class Track {
  spec: TrackSpec;
  group: VGroup;
  constructor(spec: TrackSpec) {
    this.spec = spec;
    const c = palette();
    const parts: Mobject[] = [];
    const { x0, x1, y } = spec;
    parts.push(polyline([[x0, y], [x1, y]], c.muted, 3));
    const step = spec.tick ?? 1, every = spec.label_every ?? 2, fs = spec.font ?? 20;
    const first = Math.ceil(spec.p[0] / step - 1e-9) * step;
    let i = 0;
    for (let p = first; p <= spec.p[1] + 1e-9; p += step, i++) {
      if (spec.wall !== undefined && p > spec.wall + 1e-9) break;
      const x = this.x_of(p);
      const major = Math.round(p / step) % every === 0;
      parts.push(polyline([[x, y], [x, y - (major ? 0.14 : 0.08)]], c.muted, 2));
      if (major) {
        const last = p + step * every > (spec.wall ?? spec.p[1]) + 1e-9;
        const t = tex(`${+p.toFixed(2)}${last && spec.unit !== false ? '\\,\\mathrm{m}' : ''}`, fs, c.muted);
        t.move_to([x + (last && spec.unit !== false ? t.width / 2 - 0.12 : 0), y - 0.2 - t.height / 2, 0]);
        parts.push(t);
      }
    }
    if (spec.wall !== undefined) {
      const xw = this.x_of(spec.wall);
      const b = { x0: xw, x1: xw + 0.32, y0: y - 0.05, y1: y + 0.95 };
      parts.push(fill_box(b.x0, b.y0, b.x1, b.y1, c.faint, 1), hatch(b, c.muted, 0.16, 2), polyline([[xw, b.y0], [xw, b.y1]], c.ink, 3.5));
    }
    if (spec.target !== undefined) parts.push(this.flag(spec.target));
    this.group = VGroup(...parts);
  }
  x_of(p: number): number {
    const s = this.spec;
    return s.x0 + ((p - s.p[0]) / (s.p[1] - s.p[0])) * (s.x1 - s.x0);
  }
  p_of(x: number): number {
    const s = this.spec;
    return s.p[0] + ((x - s.x0) / (s.x1 - s.x0)) * (s.p[1] - s.p[0]);
  }
  /** A small flag on a pole at position p. */
  flag(p: number, color?: string): VGroup {
    const c = palette(), col = color ?? c.good;
    const x = this.x_of(p), y = this.spec.y;
    const pole = polyline([[x, y], [x, y + 0.8]], c.ink, 2.5);
    const cloth = fill_poly([[x, y + 0.8], [x - 0.34, y + 0.67], [x, y + 0.54]], col, 1);
    return VGroup(pole, cloth);
  }
  /**
   * A cart whose front bumper follows get_p() (optionally faded, e.g. ghosts of a plan).
   * The body is one rounded rectangle with two wheels; it is moved, not rebuilt.
   */
  cart(get_p: () => number, o: { color?: string; opacity?: number; scale?: number } = {}): VGroup {
    const c = palette();
    const w = (this.spec.cart_w ?? 0.9) * (o.scale ?? 1), h = (this.spec.cart_h ?? 0.42) * (o.scale ?? 1), r = 0.11 * (o.scale ?? 1);
    const col = o.color ?? c.accent, op = o.opacity ?? 1;
    const body = RoundedRectangle({ width: w, height: h, corner_radius: Math.min(0.1, h / 3), fill_color: col, fill_opacity: op, stroke_color: col, stroke_width: 0 }) as unknown as VMobject;
    const wheels = [-0.28, 0.28].map((f) => Circle({ radius: r, fill_color: c.ink, fill_opacity: op, stroke_width: 0, color: c.ink }) as unknown as VMobject);
    const g = VGroup(body, ...wheels);
    const place = (m: any) => {
      const p = get_p();
      const key = p.toFixed(5);
      if (m._key === key) return;
      m._key = key;
      const xf = this.x_of(p), cx = xf - w / 2, y = this.spec.y;
      body.move_to([cx, y + 2 * r + h / 2 - 0.02, 0]);
      wheels[0].move_to([cx - 0.28 * w, y + r, 0]);
      wheels[1].move_to([cx + 0.28 * w, y + r, 0]);
    };
    place(g);
    g.add_updater(place);
    return g;
  }
  /** Dots on the rail at the positions get_ps() returns (e.g. the planned positions x_1..x_N). */
  ghosts(get_ps: () => readonly number[], color?: string, radius = 0.06, opacity = 0.85): VMobject {
    const c = palette();
    const vm = VMobject({ fill_color: color ?? c.accent, fill_opacity: opacity, stroke_width: 0, stroke_color: color ?? c.accent });
    const y = this.spec.y + 0.04;
    return live_vm(vm, () => {
      const ps = get_ps();
      const k = 8, out = new Float64Array(ps.length * k * 12);
      ps.forEach((p, i) => {
        const x = this.x_of(clamp(p, this.spec.p[0], this.spec.p[1]));
        for (let j = 0; j < k; j++) {
          const a0 = (2 * Math.PI * j) / k, a1 = (2 * Math.PI * (j + 1)) / k;
          for (let s = 0; s < 4; s++) {
            const a = a0 + ((a1 - a0) * s) / 3, o = (i * k + j) * 12 + 3 * s;
            out[o] = x + radius * Math.cos(a);
            out[o + 1] = y + radius * Math.sin(a);
          }
        }
      });
      return out;
    }, () => get_ps().map((p) => p.toFixed(4)).join(','));
  }
}

// ---------------------------------------------------------------- horizon strip
export interface HorizonSpec {
  /** Left edge and centre height of the strip, and the size of one cell. */
  x0: number;
  y: number;
  cell_w: number;
  cell_h: number;
  /** Number of cells shown = the horizon N. */
  N: number;
  /** The plan at instant k: N input values u_0..u_{N-1} (scalar inputs). */
  plan: (k: number) => readonly number[];
  /** Value that fills half a cell's height (default 1). */
  u_max?: number;
  /** The current instant (a tracker; may be fractional while the window slides). Created when absent. */
  k?: ValueTracker;
  /** Words under the first cell and under the others (e.g. ['apply', 'planned']). */
  words?: [string, string];
  font?: number;
  color?: string;
}
/**
 * The plan as a row of N cells, one per planned input u_0..u_{N-1} (a bar up or
 * down from the cell's midline). The first cell is the one applied (outlined).
 * The state is the tracker k: while k goes from 3 to 4 the window slides one
 * cell to the left (the applied input leaves, an empty cell enters on the
 * right). At an integer k with blend < 1 the bars show the old plan shifted,
 * morphing into the new plan as blend goes to 1 (`replan()`): "solve again".
 * Use `shift()` then `replan()` for one step of the loop, or animate k over many
 * steps for a fast-forward (blend stays 1).
 */
/** How far (scene units) the leaving cell of a HorizonStrip slides out to the left of x0. */
const LEAVE = 0.45;
export class HorizonStrip {
  spec: HorizonSpec;
  k: ValueTracker;
  /** 0 = old plan shifted, 1 = new plan (only used at integer k). */
  blend = ValueTracker(1);
  group: VGroup;
  constructor(spec: HorizonSpec) {
    this.spec = spec;
    this.k = spec.k ?? ValueTracker(0);
    const c = palette();
    const { x0, y, cell_w, cell_h, N } = spec;
    const col = spec.color ?? c.accent;
    const umax = spec.u_max ?? 1;
    const state = () => {
      const kk = this.k.get_value(), ki = Math.floor(kk + 1e-9);
      return { ki, ph: clamp(kk - ki, 0, 1) };
    };
    const cells = live_vm(stroke(c.muted, 2, 1), () => {
      const { ph } = state();
      const polys: XY[][] = [];
      for (let i = 0; i <= N; i++) {
        if ((i === N && ph < 0.02) || (i === 0 && ph > 0.98)) continue;
        const xl = x0 + (i - ph) * cell_w;
        // the leaving cell slides at most LEAVE to the left of the strip (labels may sit there)
        const a = Math.max(x0 - Math.min(cell_w, LEAVE), xl) + 0.03, b = xl + cell_w - 0.03;
        if (b - a < 0.02) continue;
        polys.push([[a, y - cell_h / 2], [b, y - cell_h / 2], [b, y + cell_h / 2], [a, y + cell_h / 2], [a, y - cell_h / 2]]);
      }
      return polys_points(polys);
    }, () => this.k.get_value().toFixed(4));
    const mid = live_vm(stroke(c.faint, 1.5, 1), () => {
      const { ph } = state();
      return poly_points([[Math.max(x0 - Math.min(cell_w, LEAVE), x0 - ph * cell_w) + 0.03, y], [x0 + (N - (ph < 0.02 ? 0 : ph - 1)) * cell_w - 0.03, y]]);
    }, () => this.k.get_value().toFixed(4));
    /** Values shown in cells 0..N-1 (the entering cell N is empty). */
    const values = (): readonly number[] => {
      const { ki, ph } = state(), bl = this.blend.get_value();
      const now = spec.plan(ki);
      if (ph > 1e-9 || bl >= 1 || ki === 0) return now;
      const prev = spec.plan(ki - 1);
      const shifted = [...prev.slice(1), prev[prev.length - 1]];
      return now.map((v, i) => shifted[i] + (v - shifted[i]) * bl);
    };
    const bars = live_vm(VMobject({ fill_color: col, fill_opacity: 0.85, stroke_width: 0, stroke_color: col }), () => {
      const { ph } = state(), vs = values();
      const rects: number[][] = [];
      vs.forEach((v, i) => {
        const xl = x0 + (i - ph) * cell_w;
        const hgt = clamp(v / umax, -1, 1) * (cell_h / 2 - 0.06);
        if (Math.abs(hgt) < 0.004) return;
        const l = Math.max(x0 - LEAVE, xl + cell_w * 0.2), r = xl + cell_w * 0.8;
        if (r - l < 0.02) return;
        rects.push([l, Math.min(y, y + hgt), r, Math.max(y, y + hgt)]);
      });
      const out = new Float64Array(rects.length * 48);
      rects.forEach(([a, b, cc, d], i) => {
        const pts = [[a, b], [cc, b], [cc, d], [a, d], [a, b]];
        for (let e = 0; e < 4; e++) for (let s = 0; s < 4; s++) {
          const t = s / 3, o = 48 * i + 12 * e + 3 * s;
          out[o] = pts[e][0] + (pts[e + 1][0] - pts[e][0]) * t;
          out[o + 1] = pts[e][1] + (pts[e + 1][1] - pts[e][1]) * t;
        }
      });
      return out;
    }, () => `${this.k.get_value().toFixed(4)}|${this.blend.get_value().toFixed(4)}`);
    // the applied cell: a thick outline that stays at the left while the window moves under it
    const applied = fill_box(x0 + 0.01, y - cell_h / 2 - 0.03, x0 + cell_w - 0.01, y + cell_h / 2 + 0.03, col, 0, { stroke: col, width: 5 });
    applied.name = 'applied';
    const parts: Mobject[] = [cells, mid, bars, applied];
    if (spec.words) {
      const fs = spec.font ?? 20;
      const w0 = words(spec.words[0], fs, col, x0, y - cell_h / 2 - 0.27, { max_w: Math.max(cell_w * 3, 1.4) });
      const w1 = words(spec.words[1], fs, c.muted, x0 + cell_w * (N + 1) / 2, y - cell_h / 2 - 0.27, { align: 'center', max_w: cell_w * (N - 3) });
      parts.push(w0, w1);
    }
    this.group = VGroup(...parts);
  }
  /** Right edge of the strip. */
  get x1(): number {
    return this.spec.x0 + this.spec.N * this.spec.cell_w;
  }
  /** Trackers to register with scene.track(...). */
  trackers(): ValueTracker[] {
    return [this.k, this.blend];
  }
  /** Slide the window one step (the applied input leaves on the left); at the end the old plan is shown shifted (blend 0). */
  shift(run_time = 0.8): Animation {
    const k0 = Math.floor(this.k.get_value() + 1e-9);
    return UpdateFromAlphaFunc(this.k, (_m: unknown, a?: number) => {
      const al = a ?? 1;
      this.k.set_value(k0 + al);
      if (al >= 1) this.blend.set_value(0);
    }, { run_time, rate_func: smooth }) as unknown as Animation;
  }
  /** Morph the shifted old plan into the newly solved one. */
  replan(run_time = 0.6): Animation {
    return UpdateFromAlphaFunc(this.blend, (_m: unknown, a?: number) => this.blend.set_value(a ?? 1), { run_time, rate_func: linear }) as unknown as Animation;
  }
}

// ---------------------------------------------------------------- a stepped slider
/**
 * A horizontal slider for a number on a grid (e.g. the horizon N = 1..40):
 * track, filled part, knob, optional tick marks, bound to a ValueTracker.
 * `attach(ui, label)` adds the drag handle (arrow keys move one step).
 */
export class StepSlider {
  t: ValueTracker;
  lo: number;
  hi: number;
  step: number;
  x0: number;
  x1: number;
  y: number;
  group: VGroup;
  /** Optional log scale (for weights like Q and R): positions are uniform in log10(value). */
  log: boolean;
  constructor(t: ValueTracker, o: { lo: number; hi: number; step?: number; x0: number; x1: number; y: number; color?: string; ticks?: number[]; log?: boolean }) {
    const c = palette();
    this.t = t;
    this.lo = o.lo;
    this.hi = o.hi;
    this.step = o.step ?? 1;
    this.x0 = o.x0;
    this.x1 = o.x1;
    this.y = o.y;
    this.log = !!o.log;
    const col = o.color ?? c.accent;
    const track = polyline([[o.x0, o.y], [o.x1, o.y]], c.faint, 8);
    const ticks = (o.ticks ?? []).map((v) => polyline([[this.x_of(v), o.y - 0.13], [this.x_of(v), o.y + 0.13]], c.muted, 2));
    const fill = live_vm(stroke(col, 8), () => poly_points([[o.x0, o.y], [Math.max(o.x0 + 0.002, this.x_of(t.get_value())), o.y]]), () => t.get_value().toFixed(5));
    const knob: any = Circle({ radius: 0.15, fill_color: c.bg, fill_opacity: 1, stroke_color: col, stroke_width: 4 });
    knob.move_to([this.x_of(t.get_value()), o.y, 0]);
    knob.add_updater((m: any) => {
      const v = t.get_value().toFixed(5);
      if (m._key === v) return;
      m._key = v;
      m.move_to([this.x_of(t.get_value()), o.y, 0]);
    });
    this.group = VGroup(track, ...ticks, fill, knob);
  }
  x_of(v: number): number {
    const u = this.log ? (Math.log10(clamp(v, this.lo, this.hi)) - Math.log10(this.lo)) / (Math.log10(this.hi) - Math.log10(this.lo)) : (clamp(v, this.lo, this.hi) - this.lo) / (this.hi - this.lo);
    return this.x0 + u * (this.x1 - this.x0);
  }
  value_of(x: number): number {
    const u = clamp((x - this.x0) / (this.x1 - this.x0), 0, 1);
    if (this.log) {
      const e = Math.log10(this.lo) + u * (Math.log10(this.hi) - Math.log10(this.lo));
      const k = Math.round(e / this.step) * this.step; // step in decades
      return clamp(10 ** k, this.lo, this.hi);
    }
    return clamp(this.lo + Math.round((u * (this.hi - this.lo)) / this.step) * this.step, this.lo, this.hi);
  }
  attach(ui: { add_handle(spec: any): unknown }, name: string, o: { on_change?: () => void; on_end?: () => void } = {}): unknown {
    const n_steps = this.log ? (Math.log10(this.hi) - Math.log10(this.lo)) / this.step : (this.hi - this.lo) / this.step;
    return ui.add_handle({
      get: (): P3 => [this.x_of(this.t.get_value()), this.y, 0],
      set: (p: P3) => {
        const v = this.value_of(p[0]);
        if (v !== this.t.get_value()) {
          this.t.set_value(v);
          o.on_change?.();
        }
      },
      constraint: (p: P3): P3 => [clamp(p[0], this.x0, this.x1), this.y, 0],
      step: (this.x1 - this.x0) / n_steps,
      radius: 0.36,
      label: name,
      on_end: o.on_end,
    });
  }
}

/** A cubic-free "row of numbers" key for caching live paths. */
export const key_of = (xs: readonly number[], d = 4): string => xs.map((v) => v.toFixed(d)).join(',');
