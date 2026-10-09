// manim/mobject/three_d/three_dimensions.py
//
// Three-dimensional mobjects for the Cairo renderer: surfaces are VGroups of
// small `shade_in_3d` faces that ThreeDCamera projects, depth-sorts and shades.
import { DEFAULT_DOT_RADIUS, IN, LEFT, LineJointType, ORIGIN, OUT, PI, RIGHT, TAU, UP, DOWN, Y_AXIS, Z_AXIS } from '../../constants';
import { ManimColor, interpolate_color, type ParsableManimColor } from '../../utils/color/core';
import { BLUE, BLUE_D, BLUE_E, LIGHT_GREY, WHITE } from '../../utils/color/manim_colors';
import { pyargs, starArgs, type Kwargs } from '../../utils/pyargs';
import { register } from '../../utils/registry';
import { normalize, perpendicular_bisector, z_to_vector } from '../../utils/space_ops';
import { add, cross, mul, neg, norm, sub, to3, type Point3D, type Point3DLike } from '../../utils/vector';
import { Circle } from '../geometry/arc';
import { Square } from '../geometry/polygram';
import { Mobject } from '../mobject';
import { VGroup, VMobject, VectorizedPoint } from '../types/vectorized_mobject';

type SurfaceFunc = (u: number, v: number) => Point3DLike;

/** numpy.linspace (same floating point steps). */
function linspace(start: number, stop: number, num: number): number[] {
  const div = num - 1;
  const step = div > 0 ? (stop - start) / div : 0;
  const out = Array.from({ length: num }, (_, i) => i * step + start);
  if (num > 1) out[num - 1] = stop;
  return out;
}

/** A VMobject that ThreeDCamera shades and depth-sorts (`shade_in_3d` defaults to true). */
export class ThreeDVMobject extends VMobject {
  declare u_index: number;
  declare v_index: number;
  declare u1: number;
  declare u2: number;
  declare v1: number;
  declare v2: number;

  constructor(...args: unknown[]) {
    const o = pyargs(args, ['shade_in_3d'], { shade_in_3d: true });
    super(o);
  }
}

/** A parametric surface `func(u, v)`, made of checkerboard-coloured faces. */
export class Surface extends VGroup {
  declare u_range: [number, number];
  declare v_range: [number, number];
  declare resolution: number | [number, number];
  declare surface_piece_config: Kwargs;
  declare checkerboard_colors: ManimColor[] | false;
  declare should_make_jagged: boolean;
  declare list_of_faces: ThreeDVMobject[];
  declare _func: SurfaceFunc | null;

  constructor(...args: unknown[]) {
    const o = pyargs(args, ['func', 'u_range', 'v_range', 'resolution', 'surface_piece_config', 'fill_color', 'fill_opacity', 'checkerboard_colors', 'stroke_color', 'stroke_width', 'should_make_jagged', 'pre_function_handle_to_anchor_scale_factor'], {
      func: null, u_range: [0, 1], v_range: [0, 1], resolution: 32, surface_piece_config: {}, fill_color: BLUE_D, fill_opacity: 1.0,
      checkerboard_colors: [BLUE_D, BLUE_E], stroke_color: LIGHT_GREY, stroke_width: 0.5, should_make_jagged: false,
      pre_function_handle_to_anchor_scale_factor: 1e-5,
    });
    const { func, resolution, surface_piece_config, checkerboard_colors, should_make_jagged, pre_function_handle_to_anchor_scale_factor, ...rest } = o;
    super(rest);
    this.resolution = resolution;
    this.surface_piece_config = surface_piece_config;
    this.checkerboard_colors = checkerboard_colors === false ? false : Array.from(checkerboard_colors as Iterable<ParsableManimColor>, (c) => ManimColor.parse(c));
    this.should_make_jagged = should_make_jagged;
    this.pre_function_handle_to_anchor_scale_factor = pre_function_handle_to_anchor_scale_factor;
    this.list_of_faces = [];
    this._func = func;
    this._setup_in_uv_space();
    this.apply_function((p) => this.func(p[0], p[1]));
    if (this.should_make_jagged) this.make_jagged();
  }
  protected override _init_attrs(kw: Kwargs): void {
    this.u_range = kw.u_range ?? [0, 1];
    this.v_range = kw.v_range ?? [0, 1];
    super._init_attrs(kw);
  }

  /** The parametrisation (subclasses override it). */
  func(u: number, v: number): Point3DLike {
    return this._func!(u, v);
  }
  protected _get_u_values_and_v_values(): [number[], number[]] {
    let u_res: number, v_res: number;
    if (typeof this.resolution === 'number') u_res = v_res = this.resolution;
    else [u_res, v_res] = this.resolution;
    return [linspace(this.u_range[0], this.u_range[1], u_res + 1), linspace(this.v_range[0], this.v_range[1], v_res + 1)];
  }
  protected _setup_in_uv_space(): void {
    const [u_values, v_values] = this._get_u_values_and_v_values();
    const faces = new VGroup();
    this.list_of_faces = [];
    for (let i = 0; i < u_values.length - 1; i++) {
      for (let j = 0; j < v_values.length - 1; j++) {
        const [u1, u2] = [u_values[i], u_values[i + 1]];
        const [v1, v2] = [v_values[j], v_values[j + 1]];
        const face = new ThreeDVMobject();
        face.set_points_as_corners([[u1, v1, 0], [u2, v1, 0], [u2, v2, 0], [u1, v2, 0], [u1, v1, 0]]);
        faces.add(face);
        face.u_index = i;
        face.v_index = j;
        face.u1 = u1;
        face.u2 = u2;
        face.v1 = v1;
        face.v2 = v2;
        this.list_of_faces.push(face);
      }
    }
    faces.set_fill({ color: this.fill_color, opacity: this.fill_opacity });
    faces.set_stroke({ color: this.stroke_color, width: this.stroke_width, opacity: this.stroke_opacity });
    this.add(...faces.submobjects);
    if (this.checkerboard_colors) this.set_fill_by_checkerboard(...this.checkerboard_colors);
  }

  /** Colour the faces in a checkerboard pattern. */
  set_fill_by_checkerboard(...args: unknown[]): this {
    const [colors, kw] = starArgs<ParsableManimColor>(args);
    const opacity = kw.opacity ?? null;
    const n_colors = colors.length;
    for (const face of this.list_of_faces) {
      const c_index = (face.u_index + face.v_index) % n_colors;
      face.set_fill(colors[c_index], opacity);
    }
    return this;
  }

  /** Colour each face by its coordinate along `axis` of `axes`, using a colour scale. */
  set_fill_by_value(...args: unknown[]): this {
    const o = pyargs(args, ['axes', 'colorscale', 'axis'], { colorscale: null, axis: 2 });
    let { axes, colorscale, axis, ...kwargs } = o;
    if ('colors' in kwargs && colorscale == null) {
      colorscale = kwargs.colors;
      delete kwargs.colors;
      if (Object.keys(kwargs).length) throw new Error(`Unsupported keyword argument(s): ${Object.keys(kwargs).join(', ')}`);
    }
    if (colorscale == null) {
      console.warn('The value passed to the colorscale keyword argument was None, the surface fill color has not been changed');
      return this;
    }
    const colorscale_list: any[] = Array.from(colorscale as Iterable<any>);
    const ranges = [axes.x_range, axes.y_range, axes.z_range];
    let new_colors: ManimColor[];
    let pivots: number[];
    const first = colorscale_list[0];
    if (Array.isArray(first) && first.length === 2 && typeof first[0] !== 'number') {
      new_colors = colorscale_list.map(([c]) => ManimColor.parse(c));
      pivots = colorscale_list.map(([, p]) => p);
    } else {
      new_colors = colorscale_list.map((c) => ManimColor.parse(c));
      const current_range = ranges[axis];
      const pivot_min = current_range[0], pivot_max = current_range[1];
      const pivot_frequency = (pivot_max - pivot_min) / (new_colors.length - 1);
      // np.arange(pivot_min, pivot_max + pivot_frequency, pivot_frequency)
      const n = Math.max(0, Math.ceil((pivot_max + pivot_frequency - pivot_min) / pivot_frequency));
      pivots = Array.from({ length: n }, (_, i) => pivot_min + i * pivot_frequency);
    }
    for (const mob of this.family_members_with_points() as VMobject[]) {
      const axis_value = axes.point_to_coords(mob.get_midpoint())[axis];
      if (axis_value <= pivots[0]) mob.set_color(new_colors[0]);
      else if (axis_value >= pivots[pivots.length - 1]) mob.set_color(new_colors[new_colors.length - 1]);
      else {
        for (let i = 0; i < pivots.length; i++) {
          if (pivots[i] > axis_value) {
            let color_index = (axis_value - pivots[i - 1]) / (pivots[i] - pivots[i - 1]);
            color_index = Math.min(color_index, 1);
            const mob_color = interpolate_color(new_colors[i - 1], new_colors[i], color_index);
            mob.set_color(mob_color, { family: false });
            break;
          }
        }
      }
    }
    return this;
  }
}

/** A sphere (a Surface parametrised by longitude u and polar angle v). */
export class Sphere extends Surface {
  declare radius: number;

  constructor(...args: unknown[]) {
    const o = pyargs(args, ['center', 'radius', 'resolution', 'u_range', 'v_range'], { center: ORIGIN, radius: 1, resolution: null, u_range: [0, TAU], v_range: [0, PI] });
    const { center, resolution, ...rest } = o;
    super({ ...rest, resolution: resolution ?? [24, 12] });
    this.shift(to3(center));
  }
  protected override _init_attrs(kw: Kwargs): void {
    this.radius = kw.radius ?? 1;
    super._init_attrs(kw);
  }
  override func(u: number, v: number): Point3D {
    const r = this.radius;
    return [r * Math.cos(u) * Math.sin(v), r * Math.sin(u) * Math.sin(v), r * -Math.cos(v)];
  }
}

/** A small sphere at `point`. */
export class Dot3D extends Sphere {
  constructor(...args: unknown[]) {
    const o = pyargs(args, ['point', 'radius', 'color', 'resolution'], { point: ORIGIN, radius: DEFAULT_DOT_RADIUS, color: WHITE, resolution: [8, 8] });
    const { point, color, ...rest } = o;
    super({ ...rest, center: point });
    this.set_color(color);
  }
}

/** A cube made of six shaded square faces. */
export class Cube extends VGroup {
  declare side_length: number;

  constructor(...args: unknown[]) {
    const o = pyargs(args, ['side_length', 'fill_opacity', 'fill_color', 'stroke_width'], { side_length: 2, fill_opacity: 0.75, fill_color: BLUE, stroke_width: 0 });
    super(o);
  }
  protected override _init_attrs(kw: Kwargs): void {
    this.side_length = kw.side_length ?? 2;
    super._init_attrs(kw);
  }
  override generate_points(): this {
    for (const vect of [IN, OUT, LEFT, RIGHT, UP, DOWN]) {
      const face = new Square({ side_length: this.side_length, shade_in_3d: true, joint_type: LineJointType.BEVEL });
      face.flip();
      face.shift(mul(this.side_length / 2.0, OUT));
      face.apply_matrix(z_to_vector(vect));
      this.add(face);
    }
    return this;
  }
  init_points(): this {
    this.generate_points();
    return this;
  }
}

/** A cuboid with the given dimensions. */
export class Prism extends Cube {
  declare dimensions: number[];

  constructor(...args: unknown[]) {
    const o = pyargs(args, ['dimensions'], { dimensions: [3, 2, 1] });
    super(o);
  }
  protected override _init_attrs(kw: Kwargs): void {
    this.dimensions = Array.from(kw.dimensions ?? [3, 2, 1]);
    super._init_attrs(kw);
  }
  override generate_points(): this {
    super.generate_points();
    this.dimensions.forEach((value, dim) => this.rescale_to_fit(value, dim, true));
    return this;
  }
}

/** Euler angles (theta about Y, then phi about Z) that turn Z_AXIS into `direction`. */
function direction_angles(direction: Point3DLike): [number, number] {
  const [x, y, z] = to3(direction);
  const r = Math.sqrt(x ** 2 + y ** 2 + z ** 2);
  const theta = r > 0 ? Math.acos(z / r) : 0;
  let phi: number;
  if (x === 0) {
    if (y === 0) phi = 0;
    else {
      phi = Math.atan(Infinity);
      if (y < 0) phi += PI;
    }
  } else phi = Math.atan(y / x);
  if (x < 0) phi += PI;
  return [theta, phi];
}

/** A circular cone pointing along `direction` (its apex is at the origin before shifting). */
export class Cone extends Surface {
  declare direction: Point3D;
  declare theta: number;
  declare new_height: number;
  declare _current_theta: number;
  declare _current_phi: number;
  declare base_circle: Circle;
  declare start_point: VectorizedPoint;
  declare end_point: VectorizedPoint;

  constructor(...args: unknown[]) {
    const o = pyargs(args, ['base_radius', 'height', 'direction', 'show_base', 'v_range', 'u_min', 'checkerboard_colors'], {
      base_radius: 1, height: 1, direction: Z_AXIS, show_base: false, v_range: [0, TAU], u_min: 0, checkerboard_colors: false,
    });
    const { base_radius, height, direction, show_base, u_min, ...rest } = o;
    super({ ...rest, direction, base_radius, height, u_range: [u_min, Math.sqrt(base_radius ** 2 + height ** 2)] });
    this.new_height = height;
    this._current_theta = 0;
    this._current_phi = 0;
    this.base_circle = new Circle({ radius: base_radius, color: this.fill_color, fill_opacity: this.fill_opacity, stroke_width: 0 });
    this.base_circle.shift(mul(height, IN));
    this._set_start_and_end_attributes(direction);
    if (show_base) this.add(this.base_circle);
    this._rotate_to_direction();
  }
  protected override _init_attrs(kw: Kwargs): void {
    this.direction = to3(kw.direction ?? Z_AXIS);
    this.theta = PI - Math.atan((kw.base_radius ?? 1) / (kw.height ?? 1));
    super._init_attrs(kw);
  }
  override func(u: number, v: number): Point3D {
    const r = u, phi = v;
    return [r * Math.sin(this.theta) * Math.cos(phi), r * Math.sin(this.theta) * Math.sin(phi), r * Math.cos(this.theta)];
  }
  override get_start(): Point3D {
    return this.start_point.get_center();
  }
  override get_end(): Point3D {
    return this.end_point.get_center();
  }
  protected _rotate_to_direction(): void {
    const [theta, phi] = direction_angles(this.direction);
    this.rotate(-this._current_phi, Z_AXIS, { about_point: ORIGIN });
    this.rotate(-this._current_theta, Y_AXIS, { about_point: ORIGIN });
    this.rotate(theta, Y_AXIS, { about_point: ORIGIN });
    this.rotate(phi, Z_AXIS, { about_point: ORIGIN });
    this._current_theta = theta;
    this._current_phi = phi;
  }
  /** Point the cone along `direction`. */
  set_direction(direction: Point3DLike): this {
    this.direction = to3(direction);
    this._rotate_to_direction();
    return this;
  }
  // web: typed `any` because VMobject.get_direction returns 'CW' | 'CCW' in TypeScript
  override get_direction(): any {
    return this.direction;
  }
  protected _set_start_and_end_attributes(direction: Point3DLike): void {
    const d = to3(direction);
    const normalized_direction = mul(d, norm(d));
    const start = this.base_circle.get_center();
    const end = add(start, mul(normalized_direction, this.new_height));
    this.start_point = new VectorizedPoint(start);
    this.end_point = new VectorizedPoint(end);
    this.add(this.start_point, this.end_point);
  }
}

/** A cylinder along `direction`, with optional end caps. */
export class Cylinder extends Surface {
  declare _height: number;
  declare radius: number;
  declare direction: Point3D;
  declare _current_phi: number;
  declare _current_theta: number;
  declare base_top: Circle;
  declare base_bottom: Circle;

  constructor(...args: unknown[]) {
    const o = pyargs(args, ['radius', 'height', 'direction', 'v_range', 'show_ends', 'resolution'], {
      radius: 1, height: 2, direction: Z_AXIS, v_range: [0, TAU], show_ends: true, resolution: [24, 24],
    });
    const { height, direction, show_ends, ...rest } = o;
    super({ ...rest, _height: height, u_range: [-height / 2, height / 2] });
    if (show_ends) this.add_bases();
    this._current_phi = 0;
    this._current_theta = 0;
    this.set_direction(direction);
  }
  protected override _init_attrs(kw: Kwargs): void {
    this._height = kw._height ?? 2;
    this.radius = kw.radius ?? 1;
    super._init_attrs(kw);
  }
  override func(u: number, v: number): Point3D {
    const height = u, phi = v, r = this.radius;
    return [r * Math.cos(phi), r * Math.sin(phi), height];
  }
  /** Add the two end discs. */
  add_bases(): this {
    const color = this.fill_color, opacity = this.fill_opacity;
    this.base_top = new Circle({ radius: this.radius, color, fill_opacity: opacity, shade_in_3d: true, stroke_width: 0 });
    this.base_top.shift(mul(this.u_range[1], IN));
    this.base_bottom = new Circle({ radius: this.radius, color, fill_opacity: opacity, shade_in_3d: true, stroke_width: 0 });
    this.base_bottom.shift(mul(this.u_range[0], IN));
    this.add(this.base_top, this.base_bottom);
    return this;
  }
  protected _rotate_to_direction(): void {
    const [theta, phi] = direction_angles(this.direction);
    this.rotate(-this._current_phi, Z_AXIS, { about_point: ORIGIN });
    this.rotate(-this._current_theta, Y_AXIS, { about_point: ORIGIN });
    this.rotate(theta, Y_AXIS, { about_point: ORIGIN });
    this.rotate(phi, Z_AXIS, { about_point: ORIGIN });
    this._current_theta = theta;
    this._current_phi = phi;
  }
  /** Point the cylinder along `direction`. */
  set_direction(direction: Point3DLike): this {
    this.direction = to3(direction);
    this._rotate_to_direction();
    return this;
  }
  // web: typed `any` because VMobject.get_direction returns 'CW' | 'CCW' in TypeScript
  override get_direction(): any {
    return this.direction;
  }
}

/** Start/end attributes of a Line3D (manim's set_start_and_end_attrs before it re-inits the Cylinder). */
function line3d_attrs(start: Mobject | Point3DLike, end: Mobject | Point3DLike) {
  const rough_start = Line3D.prototype.pointify(start);
  const rough_end = Line3D.prototype.pointify(end);
  const vect = sub(rough_end, rough_start);
  const direction = normalize(vect);
  return { vect, direction, line_length: norm(vect), start: Line3D.prototype.pointify(start, direction), end: Line3D.prototype.pointify(end, neg(direction)) };
}

/**
 * A thin cylinder from `start` to `end`.
 * web: manim's `length` attribute is `line_length` here (`length` is the submobject count).
 */
export class Line3D extends Cylinder {
  declare thickness: number;
  declare vect: Point3D;
  declare line_length: number;
  declare start: Point3D;
  declare end: Point3D;

  constructor(...args: unknown[]) {
    const o = pyargs(args, ['start', 'end', 'thickness', 'color', 'resolution'], { start: LEFT, end: RIGHT, thickness: 0.02, color: null, resolution: 24 });
    const { start, end, thickness, color, resolution, ...kw } = o;
    const res = typeof resolution === 'number' ? [2, resolution] : resolution;
    const a = line3d_attrs(start, end);
    super({ ...kw, height: a.line_length, radius: thickness, direction: a.direction, resolution: res });
    this.thickness = thickness;
    Object.assign(this, a);
    this.shift(mul(add(this.start, this.end), 0.5));
    if (color != null) this.set_color(color);
  }

  /**
   * Recompute start/end and rebuild the cylinder between them.
   * web: manim re-runs Cylinder.__init__ on self; here a fresh Cylinder's state is adopted.
   */
  set_start_and_end_attrs(start: Mobject | Point3DLike, end: Mobject | Point3DLike, kwargs: Kwargs = {}): this {
    const a = line3d_attrs(start, end);
    const cyl = new Cylinder({ ...kwargs, height: a.line_length, radius: this.thickness, direction: a.direction, resolution: this.resolution });
    const name = this.name;
    for (const k of Object.keys(cyl)) (this as any)[k] = (cyl as any)[k];
    this.name = name;
    Object.assign(this, a);
    this.shift(mul(add(this.start, this.end), 0.5));
    return this;
  }
  /** A point from a point, or from a mobject (its centre or its boundary point in `direction`). */
  pointify(mob_or_point: Mobject | Point3DLike, direction: Point3DLike | null = null): Point3D {
    if (mob_or_point instanceof Mobject) {
      if (direction == null) return mob_or_point.get_center();
      return mob_or_point.get_boundary_point(direction);
    }
    return to3(mob_or_point);
  }
  override get_start(): Point3D {
    return this.start;
  }
  override get_end(): Point3D {
    return this.end;
  }
  /** A Line3D through `point`, parallel to `line`. */
  static parallel_to(line: Line3D, point: Point3DLike = ORIGIN, length = 5, kwargs: Kwargs = {}): Line3D {
    const p = to3(point);
    const vect = normalize(line.vect);
    return new this(add(p, mul(vect, length / 2)), sub(p, mul(vect, length / 2)), kwargs);
  }
  /** A Line3D through `point`, perpendicular to `line`. */
  static perpendicular_to(line: Line3D, point: Point3DLike = ORIGIN, length = 5, kwargs: Kwargs = {}): Line3D {
    const p = to3(point);
    const n = cross(line.vect, sub(p, line.start));
    if (n.every((c) => c === 0)) throw new Error('Could not find the perpendicular.');
    const [start, end] = perpendicular_bisector([line.start, line.end], n);
    const vect = normalize(sub(end, start));
    return new this(add(p, mul(vect, length / 2)), sub(p, mul(vect, length / 2)), kwargs);
  }
}

/** A 3D arrow: a Line3D with a Cone tip. */
export class Arrow3D extends Line3D {
  declare cone: Cone;
  declare end_point: VectorizedPoint;

  constructor(...args: unknown[]) {
    const o = pyargs(args, ['start', 'end', 'thickness', 'height', 'base_radius', 'color', 'resolution'], {
      start: LEFT, end: RIGHT, thickness: 0.02, height: 0.3, base_radius: 0.08, color: WHITE, resolution: 24,
    });
    const { start, end, thickness, height, base_radius, color, resolution, ...kwargs } = o;
    super({ ...kwargs, start, end, thickness, color, resolution });
    this.line_length = norm(this.vect);
    this.set_start_and_end_attrs(this.start, sub(this.end, mul(height, this.direction)), kwargs);
    this.cone = new Cone({ ...kwargs, direction: this.direction, base_radius, height });
    const np_end = to3(end);
    this.cone.shift(np_end);
    this.end_point = new VectorizedPoint(np_end);
    this.add(this.end_point, this.cone);
    this.set_color(color);
  }
  override get_end(): Point3D {
    return this.end_point.get_center();
  }
}

/** A torus with major radius R and minor radius r. */
export class Torus extends Surface {
  declare R: number;
  declare r: number;

  constructor(...args: unknown[]) {
    const o = pyargs(args, ['major_radius', 'minor_radius', 'u_range', 'v_range', 'resolution'], { major_radius: 3, minor_radius: 1, u_range: [0, TAU], v_range: [0, TAU], resolution: null });
    const { resolution, ...rest } = o;
    super({ ...rest, resolution: resolution ?? [24, 24] });
  }
  protected override _init_attrs(kw: Kwargs): void {
    this.R = kw.major_radius ?? 3;
    this.r = kw.minor_radius ?? 1;
    super._init_attrs(kw);
  }
  override func(u: number, v: number): Point3D {
    const k = this.R - this.r * Math.cos(v), s = this.r * Math.sin(v);
    return [k * Math.cos(u), k * Math.sin(u), -s];
  }
}

register({ ThreeDVMobject, Surface, Sphere, Dot3D, Cube, Prism, Cone, Cylinder, Line3D, Arrow3D, Torus });
