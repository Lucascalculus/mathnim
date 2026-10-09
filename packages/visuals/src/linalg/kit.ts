// Drawing helpers shared by the linear algebra visuals: a math plane placed in a
// box of the frame, grids of linear maps clipped to that box, live arrows,
// labels, matrices and readouts that follow ValueTrackers. Everything reads
// colours from palette() when it is built, so both themes work.
import {
  Arrow, DashedLine, DecimalNumber, Line, MathTex, UpdateFromAlphaFunc, VGroup, VMobject, ValueTracker, always_redraw, DOWN, LEFT, RIGHT, UP, smooth,
} from 'manim-web';
import type { Mobject } from 'manim-web';
import { palette } from '../theme';
import { label as sans_label, resolve_lang, LANG_SPEC, type Lang } from '../ft/f/kit';
import { col, morph2, type Mat2, type Vec2 } from './math';

// ---------------------------------------------------------------- language
// The linear-algebra visuals the fine-tuning course reuses take `lang` like the
// course's own visuals (ft/f/kit.ts): 'en', 'zh' or 'auto' (the learner's
// language, set with set_ft_lang). English keeps the TeX words it always had;
// Chinese words are set in the sans font (MathJax has no CJK glyphs).
export { LANG_SPEC, resolve_lang, type Lang };
/** Chinese words at a size that matches TeX at `size`. */
export const zh_words = (s: string, size = 32, color?: string): VMobject => sans_label(s, Math.round(size * 0.82), color ?? palette().ink);
/**
 * A line mixing Chinese words and TeX: plain strings are words, [tex] parts are math,
 * e.g. mix(['第 1 列', ['= A\\hat{\\imath}']], 38, c.good).
 */
export function mix(parts: (string | [string])[], size = 32, color?: string): VGroup {
  const g = VGroup(...parts.map((p) => (typeof p === 'string' ? zh_words(p, size, color) : tex(p[0], size, color))));
  g.arrange(RIGHT, { buff: 0.16 });
  return g;
}

export type P3 = [number, number, number];
export interface Box { x0: number; x1: number; y0: number; y1: number }

/** Frame limits (scene units) and the margin the linter wants kept free. */
export const FRAME = { x0: -7.11, x1: 7.11, y0: -4, y1: 4 };
export const SAFE: Box = { x0: -6.95, x1: 6.95, y0: -3.85, y1: 3.85 };

/** A math coordinate plane: `origin` (scene point of (0, 0)), `unit` (scene units per math unit), and the box it is drawn in. */
export class Plane {
  origin: P3;
  unit: number;
  box: Box;
  constructor(o: { origin: [number, number]; unit: number; box: Box }) {
    this.origin = [o.origin[0], o.origin[1], 0];
    this.unit = o.unit;
    this.box = o.box;
  }
  /** Scene point of math point (x, y). */
  p(x: number, y: number): P3 {
    return [this.origin[0] + this.unit * x, this.origin[1] + this.unit * y, 0];
  }
  pv(v: readonly number[]): P3 {
    return this.p(v[0], v[1]);
  }
  /** Math coordinates of a scene point. */
  to_math(pt: readonly number[]): Vec2 {
    return [(pt[0] - this.origin[0]) / this.unit, (pt[1] - this.origin[1]) / this.unit];
  }
  /** Distance (math units) from the origin to the nearest edge of the box. */
  reach(): number {
    const b = this.box, o = this.origin;
    return Math.min(o[0] - b.x0, b.x1 - o[0], o[1] - b.y0, b.y1 - o[1]) / this.unit;
  }
  /** Is math point v inside the box (with a margin in scene units)? */
  inside(v: readonly number[], margin = 0): boolean {
    const q = this.pv(v), b = this.box;
    return q[0] >= b.x0 + margin && q[0] <= b.x1 - margin && q[1] >= b.y0 + margin && q[1] <= b.y1 - margin;
  }
}

/**
 * A plane in `box` with its origin at `origin` whose unit is as large as
 * possible (at most `max_unit`) while `extent` math units still fit from the
 * origin in every direction.
 */
export function fit_plane(box: Box, origin: [number, number], extent: number, max_unit = 1): Plane {
  const room = Math.min(origin[0] - box.x0, box.x1 - origin[0], origin[1] - box.y0, box.y1 - origin[1]);
  return new Plane({ origin, box, unit: Math.min(max_unit, room / Math.max(1e-6, extent)) });
}

// ---------------------------------------------------------------- clipping and grids
/** Clip the line a + t·d (t in [t0, t1]) to the box (Liang-Barsky). */
export function clip_line(a: readonly number[], d: readonly number[], box: Box, t0 = -Infinity, t1 = Infinity): [P3, P3] | null {
  const p = [-d[0], d[0], -d[1], d[1]];
  const q = [a[0] - box.x0, box.x1 - a[0], a[1] - box.y0, box.y1 - a[1]];
  for (let i = 0; i < 4; i++) {
    if (Math.abs(p[i]) < 1e-12) {
      if (q[i] < 0) return null;
      continue;
    }
    const r = q[i] / p[i];
    if (p[i] < 0) t0 = Math.max(t0, r);
    else t1 = Math.min(t1, r);
  }
  if (!Number.isFinite(t0) || !Number.isFinite(t1) || t0 >= t1) return null;
  return [[a[0] + t0 * d[0], a[1] + t0 * d[1], 0], [a[0] + t1 * d[0], a[1] + t1 * d[1], 0]];
}
/** Clip segment ab to the box. */
export const clip_segment = (a: readonly number[], b: readonly number[], box: Box) => clip_line(a, [b[0] - a[0], b[1] - a[1]], box, 0, 1);

/**
 * Segments of the image of the integer grid under M (lines k·M ĵ + t·M î and
 * k·M î + t·M ĵ), clipped to the plane's box. `axes` chooses the k = 0 lines
 * (the images of the axes) only, all but them, or everything.
 */
export function lattice_segments(plane: Plane, M: Mat2, axes: 'only' | 'exclude' | 'include' = 'include', step = 1, max_lines = 80): [P3, P3][] {
  const out: [P3, P3][] = [];
  const b = plane.box, o = plane.origin, u = plane.unit;
  const corners = [[b.x0, b.y0], [b.x1, b.y0], [b.x0, b.y1], [b.x1, b.y1]].map(([x, y]) => [x - o[0], y - o[1]]);
  for (const j of [0, 1] as const) {
    const dir = col(M, j).map((x) => x * u * step), off = col(M, (1 - j) as 0 | 1).map((x) => x * u * step);
    const dl = Math.hypot(dir[0], dir[1]);
    if (dl < 1e-9) continue; // this family degenerates to points
    const n = [-dir[1] / dl, dir[0] / dl];
    const s = off[0] * n[0] + off[1] * n[1];
    const proj = corners.map((c) => c[0] * n[0] + c[1] * n[1]);
    let k0 = 0, k1 = 0;
    // lines packed closer than 0.05 units read as one line: draw only k = 0
    if (Math.abs(s) > 0.05) {
      const a = Math.min(...proj) / s, c = Math.max(...proj) / s;
      k0 = Math.max(-max_lines, Math.ceil(Math.min(a, c)));
      k1 = Math.min(max_lines, Math.floor(Math.max(a, c)));
    }
    // very dense families (a nearly squashed plane): keep every 2nd or 4th line
    const stride = Math.abs(s) < 0.09 ? 4 : Math.abs(s) < 0.16 ? 2 : 1;
    for (let k = k0; k <= k1; k++) {
      if (k % stride !== 0) continue;
      if (axes === 'only' && k !== 0) continue;
      if (axes === 'exclude' && k === 0) continue;
      const seg = clip_line([o[0] + k * off[0], o[1] + k * off[1]], dir, b);
      if (seg) out.push(seg);
    }
  }
  return out;
}
/** Points of a VMobject drawing the given segments as separate straight subpaths. */
export function segment_points(segs: readonly (readonly [readonly number[], readonly number[]])[]): Float64Array {
  const pts = new Float64Array(segs.length * 12);
  segs.forEach(([a, b], i) => {
    for (let k = 0; k < 4; k++) {
      const t = k / 3;
      pts[12 * i + 3 * k] = a[0] + (b[0] - a[0]) * t;
      pts[12 * i + 3 * k + 1] = a[1] + (b[1] - a[1]) * t;
      pts[12 * i + 3 * k + 2] = (a[2] ?? 0) + ((b[2] ?? 0) - (a[2] ?? 0)) * t;
    }
  });
  return pts;
}
/** A stroke-only VMobject. */
export function path(color: string, width: number, opacity = 1): VMobject {
  const vm = VMobject({ stroke_color: color, stroke_width: width, stroke_opacity: opacity, fill_opacity: 0 });
  return vm;
}
/**
 * Keep a path's points computed by `f` (re-run on every frame, skipped when
 * `key()` is unchanged; the key is stored on the mobject so snapshots stay consistent).
 */
export function live_path(vm: VMobject, f: () => Float64Array, key?: () => string): VMobject {
  const upd = (m: any) => {
    if (key) {
      const k = key();
      if (m._live_key === k && m.points.length) return;
      m._live_key = k;
    }
    const pts = f();
    m.points = pts.length ? pts : new Float64Array(0);
  };
  upd(vm);
  vm.add_updater(upd);
  return vm;
}
/** Key for a matrix (for live_path caching). */
export const mkey = (M: Mat2, extra = ''): string => `${M[0][0].toFixed(5)},${M[0][1].toFixed(5)},${M[1][0].toFixed(5)},${M[1][1].toFixed(5)}${extra}`;

/** The grid of a plane transformed by M (live): faint static background, moving lines, moving axes. */
export function transformed_grid(plane: Plane, get_M: () => Mat2, o: { background?: boolean; line_opacity?: number; width?: number } = {}): { background: VMobject; lines: VMobject; axes: VMobject; group: VGroup } {
  const c = palette();
  const I: Mat2 = [[1, 0], [0, 1]];
  const background = path(c.faint, 1.6, 1);
  background.points = segment_points(lattice_segments(plane, I, 'include'));
  const base = o.line_opacity ?? 0.55;
  const lines = live_path(path(c.accent, o.width ?? 2, base), () => segment_points(lattice_segments(plane, get_M(), 'exclude')), () => mkey(get_M()));
  // lines packed closer than ~0.3 units (a nearly squashed plane) fade, so the picture stays readable
  lines.add_updater((m: any) => {
    const M = get_M(), s = (Math.abs(M[0][0] * M[1][1] - M[0][1] * M[1][0]) * plane.unit) / Math.max(1e-9, Math.hypot(M[0][0], M[1][0]), Math.hypot(M[0][1], M[1][1]));
    const f = Math.round(Math.min(1, Math.max(0.15, s / 0.35)) * 50) / 50;
    if (m._fade !== f) {
      m.set_stroke({ opacity: base * f });
      m._fade = f;
    }
  });
  const axes = live_path(path(c.accent, (o.width ?? 2) * 1.6, 0.95), () => segment_points(lattice_segments(plane, get_M(), 'only')), () => mkey(get_M()));
  const group = o.background === false ? VGroup(lines, axes) : VGroup(background, lines, axes);
  return { background, lines, axes, group };
}
/** Static axes of a plane (two lines through the origin, clipped to its box). */
export function plane_axes(plane: Plane, color: string, width = 2, opacity = 1): VMobject {
  const vm = path(color, width, opacity);
  vm.points = segment_points(lattice_segments(plane, [[1, 0], [0, 1]], 'only'));
  return vm;
}

/** Clip a convex polygon to the box (Sutherland-Hodgman). */
export function clip_polygon(pts: readonly (readonly number[])[], box: Box): P3[] {
  let poly: P3[] = pts.map((p) => [p[0], p[1], 0]);
  const edges: [(p: P3) => number, (a: P3, b: P3) => P3][] = [
    [(p) => p[0] - box.x0, (a, b) => lerp_x(a, b, box.x0)],
    [(p) => box.x1 - p[0], (a, b) => lerp_x(a, b, box.x1)],
    [(p) => p[1] - box.y0, (a, b) => lerp_y(a, b, box.y0)],
    [(p) => box.y1 - p[1], (a, b) => lerp_y(a, b, box.y1)],
  ];
  for (const [inside, cut] of edges) {
    const out: P3[] = [];
    for (let i = 0; i < poly.length; i++) {
      const a = poly[i], b = poly[(i + 1) % poly.length];
      const ia = inside(a) >= 0, ib = inside(b) >= 0;
      if (ia) out.push(a);
      if (ia !== ib) out.push(cut(a, b));
    }
    poly = out;
    if (!poly.length) break;
  }
  return poly;
}
const lerp_x = (a: P3, b: P3, x: number): P3 => {
  const t = (x - a[0]) / (b[0] - a[0] || 1e-12);
  return [x, a[1] + (b[1] - a[1]) * t, 0];
};
const lerp_y = (a: P3, b: P3, y: number): P3 => {
  const t = (y - a[1]) / (b[1] - a[1] || 1e-12);
  return [a[0] + (b[0] - a[0]) * t, y, 0];
};
/** A filled polygon (clipped to a box) as a VMobject; empty polygons are invisible. */
export function filled_polygon(pts: readonly (readonly number[])[], box: Box, fill: string, fill_opacity: number, stroke: string, stroke_width = 3): VMobject {
  const poly = clip_polygon(pts, box);
  const vm = VMobject({ fill_color: fill, fill_opacity, stroke_color: stroke, stroke_width });
  if (poly.length >= 3) vm.set_points_as_corners([...poly, poly[0]]);
  else {
    vm.set_points_as_corners([[box.x0, box.y0, 0], [box.x0 + 0.01, box.y0, 0], [box.x0, box.y0, 0]]);
    vm.set_opacity(0);
  }
  return vm;
}

// ---------------------------------------------------------------- arrows and labels
/** An arrow from a to b (invisible when too short to draw). */
export function arrow(a: readonly number[], b: readonly number[], color: string, width = 6, tip = 0.24): Arrow {
  const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
  const short = len < 0.04;
  const end = short ? [a[0] + 0.04, a[1], 0] : b;
  const ar = Arrow([a[0], a[1], 0], [end[0], end[1], 0], { buff: 0, color, stroke_width: width, tip_length: tip, max_tip_length_to_length_ratio: 0.45, max_stroke_width_to_length_ratio: 12 });
  if (short) ar.set_opacity(0);
  return ar;
}
/** An arrow redrawn every frame from `get()` = [start, end]. */
export function live_arrow(get: () => [readonly number[], readonly number[]], color: string, width = 6, tip = 0.24, opacity: () => number = () => 1): Arrow {
  return always_redraw(() => {
    const [a, b] = get();
    const ar = arrow(a, b, color, width, tip);
    const k = opacity();
    if (k < 1 && Math.hypot(b[0] - a[0], b[1] - a[1]) >= 0.04) ar.set_opacity(k);
    return ar;
  });
}
/** A dashed line from a to b (invisible when too short to draw). */
export function dashed(a: readonly number[], b: readonly number[], color: string, width = 3, dash = 0.12, opacity = 1): VMobject {
  const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
  const short = len < 0.05;
  const end = short ? [a[0] + 0.05, a[1], a[2] ?? 0] : b;
  const d = DashedLine([a[0], a[1], a[2] ?? 0], [end[0], end[1], end[2] ?? 0], { color, stroke_width: width, dash_length: dash }) as unknown as VMobject;
  d.set_opacity(short ? 0 : opacity);
  return d;
}
/** MathTex with a colour and size. */
export function tex(s: string, size = 32, color?: string): MathTex {
  return MathTex(s, { font_size: size, color: color ?? palette().ink }) as MathTex;
}
/** MathTex built from parts, each with its own colour: texs([['A', c.ink], ['\\hat\\imath', c.good]]). */
export function texs(parts: [string, string?][], size = 32): MathTex {
  const c = palette();
  const m = MathTex(...parts.map((p) => p[0]), { font_size: size, color: c.ink }) as MathTex;
  parts.forEach((p, i) => {
    if (p[1]) m.submobjects[i]?.set_color(p[1]);
  });
  return m;
}
/** Words set in the TeX font. */
export const words = (s: string, size = 28, color?: string) => tex(`\\text{${s}}`, size, color ?? palette().ink);
/** A soft backing so a label stays readable over grid lines. */
export function backed<T extends Mobject>(m: T, opacity = 0.8): T {
  m.add_background_rectangle({ color: palette().bg, opacity, buff: 0.06 });
  return m;
}
/** Place m just beyond point `at` in direction `dir` (scene), clear of the point by `gap`. */
export function place_beyond(m: Mobject, at: readonly number[], dir: readonly number[], gap = 0.18): Mobject {
  const n = Math.hypot(dir[0], dir[1]) || 1;
  const ux = dir[0] / n, uy = dir[1] / n;
  // distance from the centre of m's box to its edge along (ux, uy)
  const r = Math.min(Math.abs(ux) > 1e-9 ? m.width / 2 / Math.abs(ux) : Infinity, Math.abs(uy) > 1e-9 ? m.height / 2 / Math.abs(uy) : Infinity);
  m.move_to([at[0] + ux * (gap + r), at[1] + uy * (gap + r), 0]);
  return m;
}
/** Keep m clear of the tip of a moving arrow: placed beyond the tip, along the arrow. */
export function follow_tip(m: Mobject, get: () => [readonly number[], readonly number[]], gap = 0.16, box?: Box): Mobject {
  const upd = () => {
    const [a, b] = get();
    const d = [b[0] - a[0], b[1] - a[1]];
    if (Math.hypot(d[0], d[1]) < 1e-6) d[0] = 1;
    place_beyond(m, b, d, gap);
    if (box) keep_in(m, box);
  };
  upd();
  m.add_updater(upd);
  return m;
}
/** Box of a mobject (scene units). */
export function bbox(m: Mobject, pad = 0): Box {
  const c = m.get_center(), w = m.width / 2 + pad, h = m.height / 2 + pad;
  return { x0: c[0] - w, x1: c[0] + w, y0: c[1] - h, y1: c[1] + h };
}
const boxes_hit = (a: Box, b: Box) => a.x0 < b.x1 && b.x0 < a.x1 && a.y0 < b.y1 && b.y0 < a.y1;
/**
 * Keep a label at the first of `spots` where it does not touch any of the
 * mobjects returned by `avoid()` (moving labels, arrows' tips...).
 */
export function dodge(m: Mobject, spots_in: readonly (readonly number[])[] | (() => readonly (readonly number[])[]), avoid: () => (Mobject | Box)[], pad = 0.08): Mobject {
  const upd = () => {
    const spots = typeof spots_in === 'function' ? spots_in() : spots_in;
    const boxes: Box[] = avoid().map((a) => ('x0' in a ? (a as Box) : bbox(a as Mobject)));
    const w = m.width / 2 + pad, h = m.height / 2 + pad;
    let best = spots[0], best_hits = Infinity;
    for (const s of spots) {
      const b = { x0: s[0] - w, x1: s[0] + w, y0: s[1] - h, y1: s[1] + h };
      const hits = boxes.filter((x) => boxes_hit(b, x)).length;
      if (hits < best_hits) {
        best = s;
        best_hits = hits;
        if (!hits) break;
      }
    }
    const c = m.get_center();
    if (Math.abs(c[0] - best[0]) > 1e-9 || Math.abs(c[1] - best[1]) > 1e-9) m.move_to([best[0], best[1], 0]);
  };
  upd();
  m.add_updater(upd);
  return m;
}
/** Shift m so that its box lies inside `box`. */
export function keep_in(m: Mobject, box: Box): Mobject {
  const w = m.width / 2, h = m.height / 2, c = m.get_center();
  const x = Math.min(box.x1 - w, Math.max(box.x0 + w, c[0])), y = Math.min(box.y1 - h, Math.max(box.y0 + h, c[1]));
  if (x !== c[0] || y !== c[1]) m.move_to([x, y, 0]);
  return m;
}

// ---------------------------------------------------------------- matrices and readouts
/** A square bracket drawn as a path ('[' when side = -1, ']' when side = 1). */
export function bracket(x: number, y0: number, y1: number, side: -1 | 1, color: string, serif = 0.13, width = 3): VMobject {
  const vm = path(color, width, 1);
  vm.set_points_as_corners([[x - side * serif, y1, 0], [x, y1, 0], [x, y0, 0], [x - side * serif, y0, 0]]);
  return vm;
}
/**
 * A matrix whose entries follow `get()` (DecimalNumbers between bracket
 * paths). `colors[j]` colours column j (e.g. î green, ĵ red). Entries are
 * centred in fixed cells, so the matrix does not jiggle while values change.
 */
export class LiveMatrix extends VGroup {
  declare entries: DecimalNumber[][];
  declare brackets: VGroup;
  declare offsets: P3[][];
  constructor(get: () => number[][], o: { decimals?: number; font_size?: number; colors?: (string | null)[]; row_colors?: (string | null)[]; col_gap?: number; row_gap?: number; width_hint?: number } = {}) {
    super();
    const c = palette();
    const d = o.decimals ?? 1, fs = o.font_size ?? 36;
    const m0 = get();
    const rows = m0.length, cols = m0[0].length;
    const probe = DecimalNumber(o.width_hint ?? -8.8888, { num_decimal_places: d, font_size: fs }) as DecimalNumber;
    const w = probe.width, h = probe.height;
    const cg = o.col_gap ?? 0.45, rg = o.row_gap ?? 0.32;
    const W = cols * w + (cols - 1) * cg, H = rows * h + (rows - 1) * rg;
    this.offsets = m0.map((row, i) => row.map((_, j) => [-W / 2 + w / 2 + j * (w + cg), H / 2 - h / 2 - i * (h + rg), 0] as P3));
    const pad = 0.16, bx = W / 2 + 0.18;
    this.brackets = VGroup(bracket(-bx, -H / 2 - pad, H / 2 + pad, -1, c.ink), bracket(bx, -H / 2 - pad, H / 2 + pad, 1, c.ink));
    this.entries = m0.map((row, i) => row.map((v, j) => {
      const dn = DecimalNumber(v, { num_decimal_places: d, font_size: fs, color: o.row_colors?.[i] ?? o.colors?.[j] ?? c.ink }) as DecimalNumber;
      dn.move_to(this.offsets[i][j]);
      (dn as any)._v = Math.round(v * 10 ** d);
      return dn;
    }));
    this.add(this.brackets, ...this.entries.flat());
    const upd = () => {
      const m = get(), l = this.brackets.submobjects[0].get_center(), r = this.brackets.submobjects[1].get_center();
      const cx = (l[0] + r[0]) / 2, cy = (l[1] + r[1]) / 2;
      m.forEach((row, i) => row.forEach((v, j) => {
        const e: any = this.entries[i][j];
        const shown = Math.round(v * 10 ** d);
        if (e._v !== shown) {
          e.set_value(v);
          e._v = shown;
        }
        e.move_to([cx + this.offsets[i][j][0], cy + this.offsets[i][j][1], 0]);
      }));
    };
    this.add_updater(upd);
  }
}
/** "label = value" with the value following `get()`; the left edge stays put. */
export function readout(label: string | Mobject, get: () => number, o: { decimals?: number; font_size?: number; color?: string; value_color?: string; unit?: string; color_of?: (v: number) => string } = {}): VGroup {
  const c = palette();
  const fs = o.font_size ?? 32;
  const dn = DecimalNumber(get(), { num_decimal_places: o.decimals ?? 2, font_size: fs, color: o.value_color ?? o.color ?? c.ink, unit: o.unit ?? null }) as any;
  dn._v = NaN;
  if (!label) {
    const g = VGroup(dn);
    g.add_updater(() => {
      const v = get(), shown = Math.round(v * 10 ** (o.decimals ?? 2));
      if (dn._v !== shown) {
        const ctr = dn.get_center();
        dn.set_value(v);
        dn.move_to(ctr);
        dn._v = shown;
      }
    });
    return g;
  }
  // a TeX label, or a ready-made one (e.g. Chinese words from mix())
  const lab = typeof label === 'string' ? tex(label, fs, o.color ?? c.ink) : label;
  const g = VGroup(lab, dn);
  dn.next_to(lab, RIGHT, { buff: 0.15 });
  g.add_updater(() => {
    const v = get(), d = o.decimals ?? 2;
    const shown = Math.round(v * 10 ** d);
    if (dn._v !== shown) {
      dn.set_value(v);
      dn._v = shown;
    }
    if (o.color_of) {
      const col = o.color_of(v);
      if (dn._col !== col) {
        dn.set_color(col);
        dn._col = col;
      }
    }
    dn.next_to(lab, RIGHT, { buff: 0.15 });
    dn.align_to(lab, DOWN);
    if (lab.height > dn.height * 1.3) dn.move_to([dn.get_center()[0], lab.get_center()[1], 0]);
  });
  return g;
}
/** Parts laid out left to right from a fixed left edge, re-laid out every frame (for rows of changing numbers). */
export function live_row(parts: Mobject[], left: readonly number[], buff = 0.14): VGroup {
  const g = VGroup(...parts);
  const lay = () => {
    let x = left[0];
    for (const m of parts) {
      m.update(0);
      m.move_to([x + m.width / 2, left[1], 0]);
      x += m.width + buff;
    }
  };
  lay();
  g.add_updater(lay);
  return g;
}
/** Show m only while cond() holds (opacity toggled by an updater). */
export function visible_when<T extends Mobject>(m: T, cond: () => boolean): T {
  const upd = (x: any) => {
    const k = cond() ? 1 : 0;
    if (x._vis === k) return;
    x._vis = k;
    x.set_opacity(k);
  };
  upd(m);
  m.add_updater(upd);
  return m;
}
/** A readout of a fixed width text that switches between precomputed variants (by index). */
export function switcher(variants: Mobject[], index: () => number, anchor: readonly number[], align: 'left' | 'center' = 'left'): VGroup {
  const g = VGroup(...variants);
  const place = (m: any) => {
    const k = index();
    if (m._shown === k) return;
    m._shown = k;
    variants.forEach((v, i) => {
      if (align === 'left') v.move_to([anchor[0] + v.width / 2, anchor[1], 0]);
      else v.move_to([anchor[0], anchor[1], 0]);
      v.set_opacity(i === k ? 1 : 0);
    });
  };
  place(g);
  g.add_updater(place);
  return g;
}

// ---------------------------------------------------------------- matrix trackers
/** Four ValueTrackers holding a 2x2 matrix, with helpers. */
export class MatrixTrackers {
  t: [ValueTracker, ValueTracker, ValueTracker, ValueTracker];
  constructor(m: Mat2) {
    this.t = [ValueTracker(m[0][0]), ValueTracker(m[0][1]), ValueTracker(m[1][0]), ValueTracker(m[1][1])] as any;
    this.t[0].name = 'a';
    this.t[1].name = 'b';
    this.t[2].name = 'c';
    this.t[3].name = 'd';
  }
  get(): Mat2 {
    const [a, b, c, d] = this.t.map((x) => x.get_value());
    return [[a, b], [c, d]];
  }
  set(m: Mat2): void {
    this.t[0].set_value(m[0][0]);
    this.t[1].set_value(m[0][1]);
    this.t[2].set_value(m[1][0]);
    this.t[3].set_value(m[1][1]);
  }
  /** Column j (0 = where î lands, 1 = where ĵ lands). */
  col(j: 0 | 1): Vec2 {
    return col(this.get(), j);
  }
  set_col(j: 0 | 1, v: Vec2): void {
    this.t[j].set_value(v[0]);
    this.t[j + 2].set_value(v[1]);
  }
  /** Animation along the straight line from `from` to `to` (entry by entry). */
  lerp(from: Mat2, to: Mat2, o: { run_time?: number; rate_func?: (t: number) => number } = {}) {
    return UpdateFromAlphaFunc(this.t[0], (_m: unknown, alpha?: number) => {
      const t = alpha ?? 1;
      this.set([[from[0][0] + (to[0][0] - from[0][0]) * t, from[0][1] + (to[0][1] - from[0][1]) * t], [from[1][0] + (to[1][0] - from[1][0]) * t, from[1][1] + (to[1][1] - from[1][1]) * t]]);
    }, { run_time: o.run_time ?? 2.5, rate_func: o.rate_func ?? smooth });
  }
  /** Animation from the current matrix `from` to `to`, columns turning the short way. */
  morph(from: Mat2, to: Mat2, o: { run_time?: number; rate_func?: (t: number) => number } = {}) {
    return UpdateFromAlphaFunc(this.t[0], (_m: unknown, alpha?: number) => this.set(morph2(from, to, alpha ?? 1)), { run_time: o.run_time ?? 2.5, rate_func: o.rate_func ?? smooth });
  }
}

/** Arrow end points from the plane's origin to math point w, cut at the plane's box. */
export function clipped(plane: Plane, w: readonly number[], from: readonly number[] = [0, 0]): [P3, P3] {
  const o = plane.pv(from), e = plane.pv(w), b = plane.box;
  const seg = clip_segment(o, e, { x0: b.x0 + 0.05, x1: b.x1 - 0.05, y0: b.y0 + 0.05, y1: b.y1 - 0.05 });
  return seg ? [seg[0], seg[1]] : [o, o];
}
/** Direction to put a basis label beyond its tip, turned away from the other basis vector. */
export function label_dir(w: Vec2, other: Vec2, fallback: number): Vec2 {
  if (Math.hypot(w[0], w[1]) < 0.15) return [Math.cos(fallback), Math.sin(fallback)];
  const a = Math.atan2(w[1], w[0]);
  const side = w[0] * other[1] - w[1] * other[0] >= 0 ? -1 : 1;
  return [Math.cos(a + side * 0.45), Math.sin(a + side * 0.45)];
}
/** Labels that follow the tips of the two basis vectors (turned away from each other). */
export function basis_labels(plane: Plane, M: MatrixTrackers, texts: [string, string], size = 40): [Mobject, Mobject] {
  const c = palette();
  const box = { x0: plane.box.x0 + 0.1, x1: plane.box.x1 - 0.1, y0: plane.box.y0 + 0.1, y1: plane.box.y1 - 0.1 };
  const tip_of = (j: 0 | 1, fb: number) => (): [P3, P3] => {
    const w = M.col(j), e = clipped(plane, w)[1], d = label_dir(w, M.col((1 - j) as 0 | 1), fb);
    return [[e[0] - d[0], e[1] - d[1], 0], e];
  };
  return [
    follow_tip(backed(tex(texts[0], size, c.good), 0.75), tip_of(0, -0.6), 0.1, box),
    follow_tip(backed(tex(texts[1], size, c.coral), 0.75), tip_of(1, 2.2), 0.1, box),
  ];
}
/** The live basis arrows î (green) and ĵ (red) of a matrix held in trackers. */
export function basis_arrows(plane: Plane, M: MatrixTrackers, width = 7): [Arrow, Arrow] {
  const c = palette();
  const i = live_arrow(() => clipped(plane, M.col(0)), c.good, width);
  const j = live_arrow(() => clipped(plane, M.col(1)), c.coral, width);
  i.name = 'i_hat';
  j.name = 'j_hat';
  return [i, j];
}
/** Draggable tips of î and ĵ (entries snap to 0.1 and stay in [-range, range]). */
export function basis_handles(ui: { add_handle(spec: any): unknown }, plane: Plane, M: MatrixTrackers, range = 3, box: Box = STAGE, lang: Lang = 'en'): void {
  for (const j of [0, 1] as const) {
    ui.add_handle({
      get: () => {
        const w = M.col(j);
        return plane.inside(w, 0.05) ? plane.pv(w) : clipped(plane, w)[1];
      },
      set: (pt: P3) => {
        const [x, y] = plane.to_math(pt);
        M.set_col(j, [clamp(snap(x), -range, range), clamp(snap(y), -range, range)]);
      },
      constraint: (pt: P3) => [clamp(pt[0], box.x0 + 0.2, box.x1 - 0.2), clamp(pt[1], box.y0 + 0.2, box.y1 - 0.2), 0],
      step: plane.unit * 0.1,
      radius: 0.4,
      label: lang === 'zh' ? (j === 0 ? 'î 的箭头尖（矩阵第 1 列）' : 'ĵ 的箭头尖（矩阵第 2 列）') : j === 0 ? 'the tip of î (column 1 of the matrix)' : 'the tip of ĵ (column 2 of the matrix)',
    });
  }
}

/** Round to a step (for snapping dragged values). */
export const snap = (x: number, step = 0.1): number => Math.round(x / step) * step;
export const clamp = (x: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, x));

/** The right-hand column of the frame, used for matrices and text next to a plane. */
export const PANEL = { x0: 2.3, x1: 6.95, cx: 4.62 };
/** Standard box for a plane that leaves the right-hand panel free. */
export const STAGE: Box = { x0: -6.95, x1: 1.95, y0: -3.85, y1: 3.85 };


