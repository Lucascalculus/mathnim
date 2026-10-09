// Cutting: knife strokes and the geometry to split shapes (web extension,
// see docs/EXTENSIONS.md).
//
//   ui.add_cutter({ targets: () => tiles, on_split: (old, pieces) => pieces.forEach(p => ui.add_draggable(p)) });
//   ui.add_cutter({ on_cut: (p0, p1) => { cuts = add_cut_angles(cuts, disc_cut_angles(C, R, p0, p1)); } });
//
// Pure geometry: split_polygon (any simple polygon by a line), split_vmobject
// (closed VMobjects approximated as polygons: circles, sectors, squares...),
// and a fast path for pizzas: radial cut angles -> sectors.
import { Mobject } from '../mobject/mobject';
import { Polygon } from '../mobject/geometry/polygram';
import { VMobject } from '../mobject/types/vectorized_mobject';
import type { ParsableManimColor } from '../utils/color/core';
import { to3, type Point3D, type Point3DLike } from '../utils/vector';
import { polygon_area, segment_crossings, side_of_line, vmobject_to_polygon } from './geom';
import type { AffordanceCtx, CoachPath, Interaction, InteractiveItem, PointerInfo } from './interact';
import { region_center, region_distance, region_outline, type Region } from './dragdrop';
import { motion_enabled, tween } from './juice';

const TAU = Math.PI * 2;

// ---------------------------------------------------------------- polygons (pure)

/**
 * Split a simple polygon by the infinite line through a and b.
 * Returns the pieces (left of a->b first, then right), or null when the line
 * does not cut it. A convex polygon gives exactly two pieces; a concave one
 * may give more. Degenerate slivers (area < `min_area`) are dropped.
 */
export function split_polygon(poly: readonly Point3DLike[], a: Point3DLike, b: Point3DLike, min_area = 1e-9): Point3D[][] | null {
  if (poly.length < 3 || Math.hypot(b[0] - a[0], b[1] - a[1]) < 1e-12) return null;
  let P = poly.map(to3);
  if (polygon_area(P) < 0) P = P.reverse(); // counter-clockwise
  const L = Math.hypot(b[0] - a[0], b[1] - a[1]);
  const d: [number, number] = [(b[0] - a[0]) / L, (b[1] - a[1]) / L];
  const side = (p: Point3D) => (d[0] * (p[1] - a[1]) - d[1] * (p[0] - a[0]));
  const along = (p: Point3D) => d[0] * (p[0] - a[0]) + d[1] * (p[1] - a[1]);
  // vertices on the line count as left: every crossing is then strictly inside an edge
  const s = P.map((p) => side(p));
  const left = s.map((x) => x >= -1e-12);
  if (left.every((x) => x) || left.every((x) => !x)) return null;
  type V = { p: Point3D; cross: boolean; partner: number; left: boolean };
  const ring: V[] = [];
  for (let i = 0; i < P.length; i++) {
    const j = (i + 1) % P.length;
    ring.push({ p: P[i], cross: false, partner: -1, left: left[i] });
    if (left[i] !== left[j]) {
      const t = s[i] / (s[i] - s[j]);
      ring.push({ p: [P[i][0] + t * (P[j][0] - P[i][0]), P[i][1] + t * (P[j][1] - P[i][1]), 0], cross: true, partner: -1, left: true });
    }
  }
  const crossings = ring.map((v, i) => i).filter((i) => ring[i].cross).sort((i, j) => along(ring[i].p) - along(ring[j].p));
  if (crossings.length % 2) return null;
  for (let k = 0; k < crossings.length; k += 2) {
    ring[crossings[k]].partner = crossings[k + 1];
    ring[crossings[k + 1]].partner = crossings[k];
  }
  const n = ring.length;
  const used = new Array(n).fill(false);
  const pieces: { pts: Point3D[]; left: boolean }[] = [];
  // walk the outline; at a crossing, jump along the cut to its partner and go on
  for (let start = 0; start < n; start++) {
    if (used[start] || ring[start].cross) continue;
    const pts: Point3D[] = [];
    let k = start, guard = 0;
    do {
      pts.push(ring[k].p);
      used[k] = true;
      if (ring[k].cross) {
        k = ring[k].partner;
        pts.push(ring[k].p);
      }
      k = (k + 1) % n;
    } while (k !== start && guard++ < 4 * n);
    const clean = dedupe(pts);
    if (clean.length >= 3 && Math.abs(polygon_area(clean)) > min_area) pieces.push({ pts: clean, left: ring[start].left });
  }
  if (pieces.length < 2) return null;
  return [...pieces.filter((x) => x.left), ...pieces.filter((x) => !x.left)].map((x) => x.pts);
}

function dedupe(pts: Point3D[]): Point3D[] {
  const out: Point3D[] = [];
  for (const p of pts) {
    const q = out[out.length - 1];
    if (!q || Math.hypot(p[0] - q[0], p[1] - q[1]) > 1e-9) out.push(p);
  }
  while (out.length > 1 && Math.hypot(out[0][0] - out[out.length - 1][0], out[0][1] - out[out.length - 1][1]) <= 1e-9) out.pop();
  return out;
}

/**
 * Does the stroke p0 -> p1 cut all the way across the polygon? True when the
 * stroke (extended by `reach` at both ends) crosses the outline at least twice.
 */
export function stroke_crosses(poly: readonly Point3DLike[], p0: Point3DLike, p1: Point3DLike, reach = 0): boolean {
  const L = Math.hypot(p1[0] - p0[0], p1[1] - p0[1]) || 1;
  const u = [(p1[0] - p0[0]) / L, (p1[1] - p0[1]) / L];
  const a: Point3D = [p0[0] - u[0] * reach, p0[1] - u[1] * reach, 0];
  const b: Point3D = [p1[0] + u[0] * reach, p1[1] + u[1] * reach, 0];
  return segment_crossings(poly, a, b) >= 2;
}

/**
 * Split a closed VMobject (approximated as a polygon) by the line a-b into
 * Polygon mobjects with the same style. Null when the line misses it.
 */
export function split_vmobject(m: Mobject, a: Point3DLike, b: Point3DLike, o: { samples_per_curve?: number } = {}): VMobject[] | null {
  const poly = vmobject_to_polygon(m, o.samples_per_curve ?? 12);
  const parts = split_polygon(poly, a, b);
  if (!parts) return null;
  const src = m.get_family().find((f) => f instanceof VMobject && f.points.length) as VMobject | undefined;
  return parts.map((pts) => {
    const piece = new Polygon(...pts);
    if (src) piece.match_style(src, false);
    piece.z_index = m.z_index;
    return piece;
  });
}

// ---------------------------------------------------------------- discs and sectors (pure fast path)

const norm_angle = (a: number) => ((a % TAU) + TAU) % TAU;

/**
 * Radial cuts a stroke makes in a disc (a pizza): [] when the stroke's line
 * misses the centre by more than `tolerance`, [θ] for a stroke that stops near
 * the centre (a single radius), [θ, θ + π] for a stroke across it (a diameter).
 * Angles are in [0, 2π), measured from the centre, snapped through the centre.
 */
export function disc_cut_angles(center: Point3DLike, radius: number, p0: Point3DLike, p1: Point3DLike, tolerance = radius * 0.25): number[] {
  const C = to3(center);
  const dx = p1[0] - p0[0], dy = p1[1] - p0[1];
  const L = Math.hypot(dx, dy);
  if (L < 1e-9) return [];
  // closest point of the stroke's segment to the centre
  const t = Math.min(1, Math.max(0, ((C[0] - p0[0]) * dx + (C[1] - p0[1]) * dy) / (L * L)));
  const miss = Math.hypot(p0[0] + t * dx - C[0], p0[1] + t * dy - C[1]);
  if (miss > tolerance) return [];
  const r0 = Math.hypot(p0[0] - C[0], p0[1] - C[1]), r1 = Math.hypot(p1[0] - C[0], p1[1] - C[1]);
  // must reach from the crust (or beyond) inwards
  if (Math.max(r0, r1) < radius * 0.6) return [];
  const theta = Math.atan2(dy, dx);
  const near0 = r0 <= tolerance, near1 = r1 <= tolerance;
  if (near0 && !near1) return [norm_angle(theta)]; // from the centre outwards
  if (near1 && !near0) return [norm_angle(theta + Math.PI)]; // from the crust to the centre
  if (near0 && near1) return [];
  return [norm_angle(theta), norm_angle(theta + Math.PI)].sort((x, y) => x - y);
}

/** Merge new radial cut angles into a sorted list (angles closer than `min_gap` are one cut). */
export function add_cut_angles(angles: readonly number[], add: readonly number[], min_gap = 0.02): number[] {
  const out = angles.map(norm_angle);
  for (const a0 of add) {
    const a = norm_angle(a0);
    const close = out.some((b) => {
      const d = Math.abs(a - b) % TAU;
      return Math.min(d, TAU - d) < min_gap;
    });
    if (!close) out.push(a);
  }
  return out.sort((x, y) => x - y);
}

/**
 * The pieces of a disc cut along radial angles: [start, end] angle pairs
 * (end > start). Fewer than two cuts leave one piece: the whole disc.
 */
export function sectors_from_angles(angles: readonly number[]): [number, number][] {
  const a = [...new Set(angles.map(norm_angle))].sort((x, y) => x - y);
  if (a.length < 2) return [[a[0] ?? 0, (a[0] ?? 0) + TAU]];
  return a.map((x, i) => [x, i + 1 < a.length ? a[i + 1] : a[0] + TAU] as [number, number]);
}

/** A sector as a polygon (centre, then the arc from a0 to a1), for general cutting. */
export function sector_polygon(center: Point3DLike, radius: number, a0: number, a1: number, n?: number): Point3D[] {
  const C = to3(center);
  const k = n ?? Math.max(2, Math.ceil(Math.abs(a1 - a0) / (Math.PI / 24)));
  const pts: Point3D[] = [];
  if (Math.abs(a1 - a0) < TAU - 1e-9) pts.push([C[0], C[1], 0]);
  for (let i = 0; i <= k; i++) {
    if (i === k && Math.abs(a1 - a0) >= TAU - 1e-9) break;
    const a = a0 + ((a1 - a0) * i) / k;
    pts.push([C[0] + radius * Math.cos(a), C[1] + radius * Math.sin(a), 0]);
  }
  return pts;
}

/** Move a stroke so its line passes exactly through `center` when it passes within `tolerance` (else unchanged). */
export function snap_line_through(p0: Point3DLike, p1: Point3DLike, center: Point3DLike, tolerance: number): [Point3D, Point3D] {
  const a = to3(p0), b = to3(p1);
  const L = Math.hypot(b[0] - a[0], b[1] - a[1]);
  if (L < 1e-9) return [a, b];
  const s = side_of_line(center, a, b) / L; // signed distance
  if (Math.abs(s) > tolerance) return [a, b];
  const n = [-(b[1] - a[1]) / L, (b[0] - a[0]) / L];
  return [[a[0] + n[0] * s, a[1] + n[1] * s, 0], [b[0] + n[0] * s, b[1] + n[1] * s, 0]];
}

// ---------------------------------------------------------------- the knife

export interface CutterOptions {
  /** Strokes start inside this region (default: anywhere not taken by another item). */
  region?: Region;
  /** Shortest stroke that counts, in scene units (default 0.8). */
  min_length?: number;
  /** Stroke colour (default '#E11D48') and width (default 5). */
  color?: ParsableManimColor;
  width?: number;
  /** Adjust a stroke before it is shown and applied (e.g. snap it through a centre); null rejects it. */
  adjust?: (p0: Point3D, p1: Point3D) => [Point3DLike, Point3DLike] | null;
  /** Shapes to split automatically (closed VMobjects in the scene). */
  targets?: Mobject[] | (() => Mobject[]);
  /** Targets are split only when the stroke goes all the way across (default true). */
  through?: boolean;
  /** Called for every accepted stroke. */
  on_cut?: (p0: Point3D, p1: Point3D, c: Cutter) => void;
  /** A target was replaced in the scene by its pieces. */
  on_split?: (original: Mobject, pieces: VMobject[], c: Cutter) => void;
  label?: string;
  hint?: string;
  /** Keyboard: rotation step of the aimed line (radians, default 15°) and shift step (default 0.1). */
  angle_step?: number;
  shift_step?: number;
}

/** Press-drag-release draws a straight knife stroke. Created by `ui.add_cutter`. */
export class Cutter implements InteractiveItem {
  kind = 'cutter';
  ui: Interaction;
  o: CutterOptions;
  label: string;
  hint: string;
  enabled = true;
  focusable = true;
  priority = 0;
  hot = false;
  active = false;
  focused = false;
  /** Every accepted stroke so far. */
  cuts: [Point3D, Point3D][] = [];
  private p0: Point3D | null = null;
  private p1: Point3D | null = null;
  private stroke: VMobject;
  private shown = false;
  private kb_angle = Math.PI / 2;
  private kb_shift = 0;
  private fade = 0;

  constructor(ui: Interaction, o: CutterOptions = {}) {
    this.ui = ui;
    this.o = o;
    this.label = o.label ?? 'knife';
    this.hint = o.hint ?? 'Swipe to cut';
    this.stroke = new VMobject({ stroke_color: o.color ?? '#E11D48', stroke_width: o.width ?? 5, fill_opacity: 0 });
    ui.add_item(this);
  }

  // ---------------------------------------------------------------- item protocol
  hit(p: Point3D, tol: number): number | null {
    if (!this.o.region) return 1e6;
    return region_distance(this.o.region, p) <= tol ? 1e6 : null;
  }
  cursor(): string {
    return 'crosshair';
  }
  down(p: Point3D, _info: PointerInfo): boolean {
    this.p0 = p;
    this.p1 = p;
    return true;
  }
  move(p: Point3D): void {
    if (!this.p0) return;
    this.p1 = p;
    const seg = this.adjusted(this.p0, p);
    if (seg && Math.hypot(p[0] - this.p0[0], p[1] - this.p0[1]) > 0.05) this.show(seg[0], seg[1], 1);
    else this.hide();
  }
  up(p: Point3D, _info: PointerInfo, cancelled: boolean): void {
    const p0 = this.p0;
    this.p0 = this.p1 = null;
    if (!p0 || cancelled) return this.hide();
    const seg = this.adjusted(p0, p);
    if (!seg || Math.hypot(seg[1][0] - seg[0][0], seg[1][1] - seg[0][1]) < (this.o.min_length ?? 0.8)) return this.hide();
    this.cut(seg[0], seg[1]);
  }
  key(e: KeyboardEvent): boolean {
    const a = this.o.angle_step ?? Math.PI / 12, s = this.o.shift_step ?? 0.1;
    const k = e.shiftKey ? 3 : 1;
    if (e.key === 'ArrowLeft') this.kb_angle += a * k;
    else if (e.key === 'ArrowRight') this.kb_angle -= a * k;
    else if (e.key === 'ArrowUp') this.kb_shift += s * k;
    else if (e.key === 'ArrowDown') this.kb_shift -= s * k;
    else if (e.key === 'Enter' || e.key === ' ') {
      const [p0, p1] = this.aim();
      const seg = this.adjusted(p0, p1);
      if (seg) this.cut(seg[0], seg[1]);
      this.show_aim();
      return true;
    } else return false;
    this.show_aim();
    return true;
  }
  focus_changed(on: boolean): void {
    if (on) this.show_aim();
    else this.hide();
  }
  describe(): string {
    const deg = Math.round(((((this.kb_angle * 180) / Math.PI) % 180) + 180) % 180);
    return `${this.label}: aimed at ${deg} degrees. Left and right arrows turn it, up and down move it, Enter cuts. ${this.cuts.length} cut${this.cuts.length === 1 ? '' : 's'} so far.`;
  }
  anchor(): Point3D {
    return this.centre();
  }
  coach_path(): CoachPath {
    const c = this.centre(), h = this.half_length() * 0.9;
    const a = 0.35; // a slightly tilted stroke reads as "swipe"
    return { points: [[c[0] - h * Math.cos(a), c[1] + h * Math.sin(a), 0], [c[0] + h * Math.cos(a), c[1] - h * Math.sin(a), 0]], knife: true, ms: 1600 };
  }
  draw_affordance(x: AffordanceCtx): void {
    if (x.show_hint && !this.active) {
      const b = this.o.region ? region_outline(this.o.region) : null;
      const c = this.centre();
      let [lx, ly] = x.px(c);
      if (b) ly = Math.min(...b.map((q) => x.px(q)[1])) - 18;
      x.label(this.hint.replace('{label}', this.label), lx, ly, {});
    }
  }
  dispose(): void {
    this.hide();
  }

  // ---------------------------------------------------------------- behaviour
  /** Apply a cut along p0 -> p1 as if the learner drew it. */
  cut(p0: Point3DLike, p1: Point3DLike): void {
    const a = to3(p0), b = to3(p1);
    this.cuts.push([a, b]);
    this.ui.juice?.sound('swish');
    this.show(a, b, 1);
    this.fade_out();
    this.o.on_cut?.(a, b, this);
    const targets = typeof this.o.targets === 'function' ? this.o.targets() : this.o.targets ?? [];
    let n = 0;
    for (const t of targets) {
      const poly = vmobject_to_polygon(t);
      if (poly.length < 3) continue;
      if ((this.o.through ?? true) && !stroke_crosses(poly, a, b, 0.05)) continue;
      const pieces = split_vmobject(t, a, b);
      if (!pieces) continue;
      replace_in_scene(this.ui, t, pieces);
      n++;
      this.o.on_split?.(t, pieces, this);
    }
    this.ui.announce(n ? `Cut: ${n} piece${n === 1 ? '' : 's'} split` : 'Cut');
    this.ui.notify();
  }
  private adjusted(p0: Point3D, p1: Point3D): [Point3D, Point3D] | null {
    if (!this.o.adjust) return [p0, p1];
    const r = this.o.adjust(p0, p1);
    return r ? [to3(r[0]), to3(r[1])] : null;
  }
  private centre(): Point3D {
    const c = this.o.region ? region_center(this.o.region) : null;
    if (c) return c;
    const cam = this.ui.player.scene.camera as any;
    return [cam.frame_center[0], cam.frame_center[1], 0];
  }
  private half_length(): number {
    const pts = this.o.region ? region_outline(this.o.region) : null;
    if (pts) {
      const c = this.centre();
      return Math.max(...pts.map((q) => Math.hypot(q[0] - c[0], q[1] - c[1]))) + 0.4;
    }
    const cam = this.ui.player.scene.camera as any;
    return Math.min(cam.frame_width, cam.frame_height) / 2;
  }
  /** The keyboard-aimed line (through the centre, turned and shifted). */
  private aim(): [Point3D, Point3D] {
    const c = this.centre(), h = this.half_length();
    const d = [Math.cos(this.kb_angle), Math.sin(this.kb_angle)], n = [-d[1], d[0]];
    const m = [c[0] + n[0] * this.kb_shift, c[1] + n[1] * this.kb_shift];
    return [[m[0] - d[0] * h, m[1] - d[1] * h, 0], [m[0] + d[0] * h, m[1] + d[1] * h, 0]];
  }
  private show_aim(): void {
    if (!this.focused) return;
    const [p0, p1] = this.aim();
    const seg = this.adjusted(p0, p1) ?? [p0, p1];
    this.show(seg[0], seg[1], 0.55);
  }
  private show(a: Point3D, b: Point3D, opacity: number): void {
    this.fade++;
    this.stroke.set_points_as_corners([a, b]);
    this.stroke.set_stroke({ opacity });
    const scene = this.ui.player.scene;
    if (!this.shown || scene.mobjects[scene.mobjects.length - 1] !== this.stroke) {
      scene.add(this.stroke);
      this.shown = true;
    }
  }
  private hide(): void {
    this.fade++;
    if (this.shown) this.ui.player.scene.remove(this.stroke);
    this.shown = false;
  }
  private fade_out(): void {
    const token = ++this.fade;
    if (!motion_enabled()) {
      // no animation: leave the stroke briefly (a timer), then remove it
      const t = globalThis.setTimeout?.(() => token === this.fade && (this.hide(), this.focused && this.show_aim(), this.ui.player.refresh()), 350);
      if (t === undefined) this.hide();
      return;
    }
    void tween(420, (u) => {
      if (token !== this.fade) return;
      this.stroke.set_stroke({ opacity: 1 - u });
      if (u >= 1) {
        this.hide();
        if (this.focused) this.show_aim();
      }
      this.ui.player.refresh();
    }, { alive: () => token === this.fade });
  }
}

/** Replace `old` in the scene (top level or inside a group) by `pieces`, keeping the draw order. */
export function replace_in_scene(ui: Interaction, old: Mobject, pieces: Mobject[]): void {
  const scene = ui.player.scene;
  const splice = (list: Mobject[]): boolean => {
    const i = list.indexOf(old);
    if (i >= 0) {
      list.splice(i, 1, ...pieces);
      return true;
    }
    return list.some((m) => splice(m.submobjects));
  };
  if (!splice(scene.mobjects)) scene.add(...pieces);
}
