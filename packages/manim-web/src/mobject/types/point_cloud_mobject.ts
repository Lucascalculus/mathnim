// manim/mobject/types/point_cloud_mobject.py
//
// web: `rgbas` is an array of [r, g, b, a] rows (manim's (n, 4) array).
// The camera draws point clouds like Cairo's display_point_cloud: every point
// becomes an integer pixel square of side int(thickness), later points
// overwriting earlier ones (colours are written, not blended).
import type { Camera } from '../../camera/camera';
import { BLACK, PURE_YELLOW, WHITE } from '../../utils/color/manim_colors';
import { DEFAULT_POINT_DENSITY_1D, DEFAULT_POINT_DENSITY_2D, DEFAULT_STROKE_WIDTH, ORIGIN, RIGHT, UP } from '../../constants';
import { ManimColor, color_gradient, color_to_rgba, rgba_to_color, type ParsableManimColor } from '../../utils/color/core';
import { concat, count, fromList, getPoint, type Points } from '../../utils/points';
import { pyargs, type Kwargs } from '../../utils/pyargs';
import { register } from '../../utils/registry';
import { interpolate, norm, sub, to3, type Point3D, type Point3DLike } from '../../utils/vector';
import { Mobject } from '../mobject';
import type { RGBA } from './vectorized_mobject';


/** numpy.arange(start, stop, step). */
function arange(start: number, stop: number, step: number): number[] {
  const n = Math.max(0, Math.ceil((stop - start) / step));
  return Array.from({ length: n }, (_, i) => start + i * step);
}
/** numpy.linspace(start, stop, num). */
function linspace(start: number, stop: number, num: number): number[] {
  const step = num > 1 ? (stop - start) / (num - 1) : 0;
  const out = Array.from({ length: Math.max(0, num) }, (_, i) => i * step + start);
  if (num > 1) out[num - 1] = stop;
  return out;
}
/** Rows `idx` of a point array. */
function takePoints(p: Points, idx: readonly number[]): Points {
  const out = new Float64Array(3 * idx.length);
  idx.forEach((k, i) => out.set(p.subarray(3 * k, 3 * k + 3), 3 * i));
  return out;
}
/** Apply a row selection to an attribute array (points or rgbas). */
const takeRows = (arr: any, idx: readonly number[]): any => (arr instanceof Float64Array ? takePoints(arr, idx) : idx.map((k) => [...arr[k]]));

/** A mobject made of a cloud of coloured points. */
export class PMobject extends Mobject {
  declare stroke_width: number;
  declare rgbas: RGBA[];

  constructor(...args: unknown[]) {
    super(PMobject._kw(args));
  }
  static override _kw(args: unknown[]): Kwargs {
    return pyargs(args, ['stroke_width'], { stroke_width: DEFAULT_STROKE_WIDTH });
  }
  protected override _init_attrs(kw: Kwargs): void {
    this.stroke_width = kw.stroke_width ?? DEFAULT_STROKE_WIDTH;
    super._init_attrs(kw);
  }
  override reset_points(): this {
    this.rgbas = [];
    this.points = new Float64Array(0);
    return this;
  }
  override get_array_attrs(): string[] {
    return [...super.get_array_attrs(), 'rgbas'];
  }
  add_points(points: Points | readonly Point3DLike[], rgbas: readonly (readonly number[])[] | null = null, color: ParsableManimColor | null = null, alpha = 1.0): this {
    const pts = points instanceof Float64Array ? points : fromList(points as Point3DLike[]);
    const n = count(pts);
    this.points = concat(this.points, pts);
    let new_rgbas: RGBA[];
    if (rgbas === null || rgbas === undefined) {
      const c = color ? new ManimColor(color) : this._color;
      const rgba = color_to_rgba(c, alpha);
      new_rgbas = Array.from({ length: n }, () => [...rgba] as RGBA);
    } else if (rgbas.length !== n) throw new Error('points and rgbas must have same length');
    else new_rgbas = rgbas.map((r) => [...r] as RGBA);
    this.rgbas = [...this.rgbas, ...new_rgbas];
    return this;
  }
  override set_color(...args: unknown[]): this {
    const o = pyargs(args, ['color', 'family'], { color: PURE_YELLOW, family: true });
    const rgba = color_to_rgba(o.color);
    const mobs = o.family ? this.family_members_with_points() : [this];
    for (const mob of mobs as PMobject[]) mob.rgbas = mob.rgbas.map(() => [...rgba] as RGBA);
    this._color = ManimColor.parse(o.color);
    return this;
  }
  get_stroke_width(): number {
    return this.stroke_width;
  }
  set_stroke_width(width: number, family = true): this {
    const mobs = family ? this.family_members_with_points() : [this];
    for (const mob of mobs as PMobject[]) mob.stroke_width = width;
    return this;
  }
  override set_color_by_gradient(...colors: ParsableManimColor[]): this {
    this.rgbas = color_gradient(colors, count(this.points)).map((c) => color_to_rgba(c) as RGBA);
    return this;
  }
  override set_colors_by_radial_gradient(...args: unknown[]): this {
    const o = pyargs(args, ['center', 'radius', 'inner_color', 'outer_color'], { center: null, radius: 1, inner_color: WHITE, outer_color: BLACK });
    const start_rgba = color_to_rgba(o.inner_color), end_rgba = color_to_rgba(o.outer_color);
    const center = to3(o.center ?? this.get_center());
    for (const mob of this.family_members_with_points() as PMobject[]) {
      // like manim, distances are measured on this mobject's own points
      const alphas = Array.from({ length: count(this.points) }, (_, i) => norm(sub(getPoint(this.points, i), center)) / o.radius);
      mob.rgbas = alphas.map((a) => start_rgba.map((s, k) => (1 - a) * s + a * end_rgba[k]) as RGBA);
    }
    return this;
  }
  match_colors(mobject: PMobject): this {
    Mobject.prototype.align_data.call(this, mobject);
    this.rgbas = mobject.rgbas.map((r) => [...r] as RGBA);
    return this;
  }
  filter_out(condition: (p: Point3D) => unknown): this {
    for (const mob of this.family_members_with_points() as PMobject[]) {
      const keep: number[] = [];
      for (let i = 0; i < count(mob.points); i++) if (!condition(getPoint(mob.points, i))) keep.push(i);
      mob.points = takePoints(mob.points, keep);
      mob.rgbas = keep.map((k) => mob.rgbas[k]);
    }
    return this;
  }
  thin_out(factor = 5): this {
    for (const mob of this.family_members_with_points()) {
      const num_points = this.get_num_points();
      const idx = arange(0, num_points, factor);
      mob.apply_over_attr_arrays((arr: any) => takeRows(arr, idx));
    }
    return this;
  }
  sort_points(fn: (p: Point3D) => number = (p) => p[0]): this {
    for (const mob of this.family_members_with_points()) {
      const keys = Array.from({ length: count(mob.points) }, (_, i) => fn(getPoint(mob.points, i)));
      const indices = keys.map((_, i) => i).sort((a, b) => keys[a] - keys[b]);
      mob.apply_over_attr_arrays((arr: any) => takeRows(arr, indices));
    }
    return this;
  }
  override fade_to(color: ParsableManimColor, alpha: number, family = true): this {
    const target = color_to_rgba(color);
    this.rgbas = this.rgbas.map((r) => r.map((x, k) => (1 - alpha) * x + alpha * target[k]) as RGBA);
    for (const mob of this.submobjects) mob.fade_to(color, alpha, family);
    return this;
  }
  override get_merged_array(attr: string): any {
    if (attr !== 'rgbas') return super.get_merged_array(attr);
    return [...(this.rgbas ?? []), ...this.submobjects.flatMap((s) => (s as any).get_merged_array?.('rgbas') ?? [])];
  }
  get_all_rgbas(): RGBA[] {
    return this.get_merged_array('rgbas');
  }
  ingest_submobjects(): this {
    const attrs = this.get_array_attrs();
    const arrays = attrs.map((a) => this.get_merged_array(a));
    attrs.forEach((a, i) => ((this as any)[a] = arrays[i]));
    this.submobjects = [];
    return this;
  }
  override get_color(): ManimColor {
    return this.rgbas.length ? rgba_to_color(this.rgbas[0]) : this._color;
  }
  override point_from_proportion(alpha: number): Point3D {
    const index = alpha * (this.get_num_points() - 1);
    return getPoint(this.points, Math.floor(index));
  }
  static override get_mobject_type_class(): any {
    return PMobject;
  }
  override align_points_with_larger(larger_mobject: Mobject): this {
    if (!(larger_mobject instanceof PMobject)) throw new Error('align_points_with_larger needs a PMobject');
    const n = larger_mobject.get_num_points();
    this.apply_over_attr_arrays((arr: any) => {
      const len = arr instanceof Float64Array ? arr.length / 3 : arr.length;
      // utils.iterables.stretch_array_to_length
      const idx = Array.from({ length: n }, (_, i) => Math.trunc((i / n) * len));
      return takeRows(arr, idx);
    });
    return this;
  }
  override get_point_mobject(center: Point3DLike | null = null): Point {
    return new Point(center ?? this.get_center());
  }
  override interpolate_color(mobject1: Mobject, mobject2: Mobject, alpha: number): this {
    const r1 = (mobject1 as PMobject).rgbas, r2 = (mobject2 as PMobject).rgbas;
    this.rgbas = r1.map((r, i) => r.map((x, k) => (1 - alpha) * x + alpha * r2[i][k]) as RGBA);
    this.set_stroke_width((1 - alpha) * (mobject1 as PMobject).get_stroke_width() + alpha * (mobject2 as PMobject).get_stroke_width());
    return this;
  }
  pointwise_become_partial(mobject: Mobject, a: number, b: number): this {
    const n = mobject.get_num_points();
    const lower = Math.trunc(a * n), upper = Math.trunc(b * n);
    const idx = arange(lower, upper, 1);
    for (const attr of this.get_array_attrs()) (this as any)[attr] = takeRows((mobject as any)[attr], idx);
    return this;
  }

  /** web: camera hook (Camera.display_point_cloud). */
  draw_on_canvas(camera: Camera): void {
    const ctx = camera.ctx;
    const n = count(this.points);
    if (!ctx || n === 0 || this.rgbas.length === 0) return;
    const coords = camera.points_to_pixel_coords(this, this.points);
    const thickness = Math.trunc(camera.adjusted_thickness(this.stroke_width));
    const lo = Math.floor(-thickness / 2) + 1, hi = Math.floor(thickness / 2) + 1;
    const pw = camera.pixel_width, ph = camera.pixel_height;
    // manim writes (uint8) RGBA values without blending; the frame keeps the RGB
    const styles = coords.map((_, i) => {
      const c = this.rgbas[i % this.rgbas.length];
      return `rgb(${Math.trunc(255 * c[0])},${Math.trunc(255 * c[1])},${Math.trunc(255 * c[2])})`;
    });
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
    let last = '';
    for (let a = lo; a < hi; a++) {
      for (let b = lo; b < hi; b++) {
        for (let i = 0; i < coords.length; i++) {
          const x = coords[i][0] + a, y = coords[i][1] + b;
          if (x < 0 || x >= pw || y < 0 || y >= ph) continue;
          if (styles[i] !== last) ctx.fillStyle = last = styles[i];
          ctx.fillRect(x, y, 1, 1);
        }
      }
    }
    ctx.restore();
  }
}

/** A PMobject made of lines of points. */
export class Mobject1D extends PMobject {
  declare density: number;
  declare epsilon: number;
  constructor(...args: unknown[]) {
    const o = pyargs(args, ['density'], { density: DEFAULT_POINT_DENSITY_1D });
    super(o);
  }
  protected override _init_attrs(kw: Kwargs): void {
    this.density = kw.density ?? DEFAULT_POINT_DENSITY_1D;
    this.epsilon = 1.0 / this.density;
    super._init_attrs(kw);
  }
  add_line(start: Point3DLike, end: Point3DLike, color: ParsableManimColor | null = null): this {
    const s = to3(start), e = to3(end);
    const length = norm(sub(e, s));
    let points: Point3D[];
    if (length === 0) points = [s];
    else {
      const epsilon = this.epsilon / length;
      points = arange(0, 1, epsilon).map((t) => interpolate(s, e, t));
    }
    this.add_points(points, null, color);
    return this;
  }
}

/** A PMobject filling areas with points. */
export class Mobject2D extends PMobject {
  declare density: number;
  declare epsilon: number;
  constructor(...args: unknown[]) {
    const o = pyargs(args, ['density'], { density: DEFAULT_POINT_DENSITY_2D });
    super(o);
  }
  protected override _init_attrs(kw: Kwargs): void {
    this.density = kw.density ?? DEFAULT_POINT_DENSITY_2D;
    this.epsilon = 1.0 / this.density;
    super._init_attrs(kw);
  }
}

/** A group of PMobjects. */
export class PGroup extends PMobject {
  constructor(...args: unknown[]) {
    const pmobs: Mobject[] = [];
    let kw: Kwargs = {};
    args.forEach((a, i) => {
      if (i === args.length - 1 && a && typeof a === 'object' && Object.getPrototypeOf(a) === Object.prototype) kw = a as Kwargs;
      else pmobs.push(a as Mobject);
    });
    if (!pmobs.every((m) => m instanceof PMobject)) throw new Error('All submobjects must be of type PMobject or OpenGLPMObject if using the opengl renderer');
    super(kw);
    this.add(...pmobs);
  }
  override fade_to(color: ParsableManimColor, alpha: number, family = true): this {
    if (family) for (const mob of this.submobjects) mob.fade_to(color, alpha, family);
    return this;
  }
}

/** A disc made of concentric rings of points. */
export class PointCloudDot extends Mobject1D {
  declare radius: number;
  constructor(...args: unknown[]) {
    const o = pyargs(args, ['center', 'radius', 'stroke_width', 'density', 'color'], {
      center: ORIGIN, radius: 2.0, stroke_width: 2, density: DEFAULT_POINT_DENSITY_1D, color: PURE_YELLOW,
    });
    const { center, ...kw } = o;
    super(kw);
    this.shift(center);
  }
  protected override _init_attrs(kw: Kwargs): void {
    this.radius = kw.radius;
    super._init_attrs(kw);
  }
  init_points(): this {
    this.reset_points();
    this.generate_points();
    return this;
  }
  override generate_points(): this {
    const eps = this.epsilon;
    const pts: Point3D[] = [];
    for (const r of arange(eps, this.radius, eps)) {
      for (const theta of linspace(0, 2 * Math.PI, Math.trunc((2 * Math.PI * (r + eps)) / eps))) {
        pts.push([r * (Math.cos(theta) * RIGHT[0] + Math.sin(theta) * UP[0]), r * (Math.cos(theta) * RIGHT[1] + Math.sin(theta) * UP[1]), 0]);
      }
    }
    this.add_points(pts);
    return this;
  }
}

/** A single point (a one-point PMobject). */
export class Point extends PMobject {
  declare location: Point3D;
  constructor(...args: unknown[]) {
    const o = pyargs(args, ['location', 'color'], { location: ORIGIN, color: BLACK });
    super(o);
  }
  protected override _init_attrs(kw: Kwargs): void {
    this.location = to3(kw.location ?? ORIGIN);
    super._init_attrs(kw);
  }
  init_points(): this {
    this.reset_points();
    this.generate_points();
    this.points = fromList([this.location]);
    return this;
  }
  override generate_points(): this {
    this.add_points([this.location]);
    return this;
  }
}

register({ PMobject, Point });
