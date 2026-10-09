// manim/mobject/mobject.py
//
// Construction order: manim subclasses set their attributes *before* calling
// super().__init__(), which then generates points. JavaScript cannot touch
// `this` before super(), so every constructor passes its full keyword dict up
// the chain and each class reads its own attributes in `_init_attrs(kw)`,
// which the base constructor calls before `generate_points()`.
// Subclasses must therefore declare fields with `declare`, never initialise
// them with class-field syntax.
import { config } from '../_config';
import {
  DEFAULT_MOBJECT_TO_EDGE_BUFFER, DEFAULT_MOBJECT_TO_MOBJECT_BUFFER, DL, DOWN, IN, LEFT, MED_SMALL_BUFF, ORIGIN, OUT,
  RIGHT, TAU, UP,
} from '../constants';
import { ManimColor, color_gradient, interpolate_color, type ParsableManimColor } from '../utils/color/core';
import { Complex, toComplex } from '../utils/complex';
import { deepCopy } from '../utils/copy';
import { list_update, remove_list_redundancies } from '../utils/iterables';
import { straight_path, type PathFuncType } from '../utils/paths';
import { applyMatrix, concat, count, getPoint, mapPoints, type Points } from '../utils/points';
import { isKwargs, KW, pyargs, type Kwargs } from '../utils/pyargs';
import { registry } from '../utils/registry';
import { angle_between_vectors, cross, normalize, rotation_matrix } from '../utils/space_ops';
import { add, mul, norm, sub, to3, type Point3D, type Point3DLike } from '../utils/vector';

export type Updater = ((m: any) => unknown) | ((m: any, dt: number) => unknown);
export type MappingFunction = (p: Point3D) => Point3DLike;

const PURE_YELLOW = '#FFFF00';

/** An updater is time based when it takes (mobject, dt) - manim checks for a `dt` parameter. */
export const isTimeBased = (f: Updater): boolean => (f as any).time_based === true || f.length >= 2;

export class Mobject {
  declare name: string;
  declare dim: number;
  declare target: Mobject | null;
  declare z_index: number;
  declare submobjects: Mobject[];
  declare updaters: Updater[];
  declare updating_suspended: boolean;
  declare points: Points;
  declare _color: ManimColor;
  declare saved_state?: Mobject | null;
  declare background_rectangle?: Mobject;
  declare z_index_group?: Mobject;
  [key: string]: any;

  static animation_overrides: Map<Function, Function> = new Map();

  constructor(kw: Kwargs = {}) {
    this._init_attrs(kw);
    this.reset_points();
    this.generate_points();
    this.init_colors();
  }

  /** Normalise Mobject's own (keyword-only) arguments. */
  static _kw(args: unknown[]): Kwargs {
    return pyargs(args, ['color', 'name', 'dim', 'target', 'z_index']);
  }

  protected _init_attrs(kw: Kwargs): void {
    this.name = kw.name ?? this.constructor.name;
    this.dim = kw.dim ?? 3;
    this.target = kw.target ?? null;
    this.z_index = kw.z_index ?? 0;
    this.point_hash = null;
    this.submobjects = [];
    this.updaters = [];
    this.updating_suspended = false;
    this._set_color_attr(kw.color ?? '#FFFFFF');
  }

  /** `color` is a plain attribute on Mobject; VMobject turns it into a property. */
  protected _set_color_attr(c: ParsableManimColor | ParsableManimColor[]): void {
    this._color = ManimColor.parse(Array.isArray(c) && typeof c[0] !== 'number' ? (c as ParsableManimColor[])[0] : (c as ParsableManimColor));
  }
  get color(): ManimColor {
    return this.get_color();
  }
  set color(c: ParsableManimColor) {
    this._color = ManimColor.parse(c);
  }

  // ---------------------------------------------------------------- animation overrides
  static animation_override_for(animation_class: Function): Function | undefined {
    let cls: any = this;
    while (cls && cls !== Object) {
      if (Object.prototype.hasOwnProperty.call(cls, 'animation_overrides')) {
        const f = (cls.animation_overrides as Map<Function, Function>).get(animation_class);
        if (f) return f;
      }
      cls = Object.getPrototypeOf(cls);
    }
    return undefined;
  }
  static add_animation_override(animation_class: Function, override_func: Function): void {
    if (!Object.prototype.hasOwnProperty.call(this, 'animation_overrides')) this.animation_overrides = new Map();
    if (this.animation_overrides.has(animation_class)) throw new Error(`The animation ${animation_class.name} for ${this.name} is overridden by more than one method.`);
    this.animation_overrides.set(animation_class, override_func);
  }
  /** Change default constructor keyword arguments for this class (manim's set_default). */
  static set_default(kwargs: Kwargs = {}): void {
    (this as any)._defaults = Object.keys(kwargs).length ? { ...((this as any)._defaults ?? {}), ...kwargs } : undefined;
  }

  /** `mob.animate.shift(UP)` builds an animation of the method calls. */
  get animate(): any {
    return makeAnimationBuilder(this);
  }
  /** `mob.always.next_to(other)` keeps calling the method every frame. */
  get always(): any {
    const mob = this;
    const proxy: any = new Proxy({}, {
      get(_t, name: string | symbol) {
        if (typeof name === 'symbol') return undefined;
        return (...args: unknown[]) => {
          mob.add_updater((m: any) => m[name](...args), null, true);
          return proxy;
        };
      },
    });
    return proxy;
  }

  toString(): string {
    return String(this.name);
  }

  reset_points(): this {
    this.points = new Float64Array(0);
    return this;
  }
  init_colors(_propagate_colors = true): this {
    return this;
  }
  generate_points(): this {
    return this;
  }

  // ---------------------------------------------------------------- submobjects
  protected _assert_valid_submobjects(submobjects: readonly unknown[]): this {
    return this._assert_valid_submobjects_internal(submobjects, Mobject);
  }
  protected _assert_valid_submobjects_internal(submobjects: readonly unknown[], mob_class: Function): this {
    submobjects.forEach((s, i) => {
      if (!(s instanceof mob_class)) {
        let msg = `Only values of type ${mob_class.name} can be added as submobjects of ${this.constructor.name}, but the value ${String(s)} (at index ${i}) is of type ${(s as any)?.constructor?.name ?? typeof s}.`;
        if (s instanceof Mobject) msg += ' You can try adding this value into a Group instead.';
        throw new TypeError(msg);
      }
      if (s === this) throw new Error(`Cannot add ${this.constructor.name} as a submobject of itself (at index ${i}).`);
    });
    return this;
  }
  add(...mobjects: Mobject[]): this {
    this._assert_valid_submobjects(mobjects);
    const unique = remove_list_redundancies(mobjects);
    if (unique.length !== mobjects.length) console.warn('Attempted adding some Mobject as a child more than once, this is not possible. Repetitions are ignored.');
    this.submobjects = list_update(this.submobjects, unique);
    return this;
  }
  insert(index: number, mobject: Mobject): this {
    this._assert_valid_submobjects([mobject]);
    this.submobjects.splice(index, 0, mobject);
    return this;
  }
  add_to_back(...mobjects: Mobject[]): this {
    this._assert_valid_submobjects(mobjects);
    this.remove(...mobjects);
    this.submobjects = [...new Set(mobjects), ...this.submobjects];
    return this;
  }
  remove(...mobjects: Mobject[]): this {
    for (const m of mobjects) {
      const i = this.submobjects.indexOf(m);
      if (i >= 0) this.submobjects.splice(i, 1);
    }
    return this;
  }
  /** Set attributes by keyword (manim's Mobject.set). */
  set(kwargs: Kwargs): this {
    for (const [k, v] of Object.entries(kwargs)) (this as any)[k] = v;
    return this;
  }

  get width(): number {
    return this.length_over_dim(0);
  }
  set width(v: number) {
    this.scale_to_fit_width(v);
  }
  get height(): number {
    return this.length_over_dim(1);
  }
  set height(v: number) {
    this.scale_to_fit_height(v);
  }
  get depth(): number {
    return this.length_over_dim(2);
  }
  set depth(v: number) {
    this.scale_to_fit_depth(v);
  }

  get_array_attrs(): string[] {
    return ['points'];
  }
  apply_over_attr_arrays(func: (arr: any) => any): this {
    for (const attr of this.get_array_attrs()) (this as any)[attr] = func((this as any)[attr]);
    return this;
  }

  copy(): this {
    return deepCopy(this);
  }
  generate_target(_use_deepcopy = false): Mobject {
    this.target = null;
    this.target = this.copy();
    return this.target;
  }

  // ---------------------------------------------------------------- updaters
  update(dt = 0, recursive = true): this {
    if (this.updating_suspended) return this;
    for (const u of this.updaters) {
      if (isTimeBased(u)) (u as (m: any, dt: number) => unknown)(this, dt);
      else (u as (m: any) => unknown)(this);
    }
    if (recursive) for (const s of this.submobjects) s.update(dt, recursive);
    return this;
  }
  get_time_based_updaters(): Updater[] {
    return this.updaters.filter(isTimeBased);
  }
  has_time_based_updater(): boolean {
    return this.updaters.some(isTimeBased);
  }
  get_updaters(): Updater[] {
    return this.updaters;
  }
  get_family_updaters(): Updater[] {
    return this.get_family().flatMap((m) => m.get_updaters());
  }
  add_updater(update_function: Updater, index: number | null = null, call_updater = false): this {
    if (index === null || index === undefined) this.updaters.push(update_function);
    else this.updaters.splice(index, 0, update_function);
    if (call_updater) {
      if (isTimeBased(update_function)) (update_function as any)(this, 0);
      else (update_function as any)(this);
    }
    return this;
  }
  remove_updater(update_function: Updater): this {
    this.updaters = this.updaters.filter((u) => u !== update_function);
    return this;
  }
  clear_updaters(recursive = true): this {
    this.updaters = [];
    if (recursive) for (const s of this.submobjects) s.clear_updaters();
    return this;
  }
  match_updaters(mobject: Mobject): this {
    this.clear_updaters();
    for (const u of mobject.get_updaters()) this.add_updater(u);
    return this;
  }
  suspend_updating(recursive = true): this {
    this.updating_suspended = true;
    if (recursive) for (const s of this.submobjects) s.suspend_updating(recursive);
    return this;
  }
  resume_updating(recursive = true): this {
    this.updating_suspended = false;
    if (recursive) for (const s of this.submobjects) s.resume_updating(recursive);
    this.update(0, recursive);
    return this;
  }

  // ---------------------------------------------------------------- transformations
  apply_to_family(func: (m: Mobject) => void): this {
    for (const m of this.family_members_with_points()) func(m);
    return this;
  }
  shift(...vectors: Point3DLike[]): this {
    const v = add(...vectors);
    for (const mob of this.family_members_with_points()) {
      const p = mob.points;
      for (let i = 0; i < p.length; i += 3) {
        p[i] += v[0];
        p[i + 1] += v[1];
        p[i + 2] += v[2];
      }
    }
    return this;
  }
  scale(scale_factor: number, ...rest: unknown[]): this {
    const o = pyargs(rest, [], {});
    this.apply_points_function_about_point((p) => mapPoints(p, (x, y, z) => [scale_factor * x, scale_factor * y, scale_factor * z]), o.about_point, o.about_edge);
    return this;
  }
  rotate_about_origin(angle: number, axis: Point3DLike = OUT): this {
    return this.rotate(angle, axis, { about_point: ORIGIN });
  }
  rotate(angle: number, ...rest: unknown[]): this {
    const o = pyargs(rest, ['axis'], { axis: OUT });
    const M = rotation_matrix(angle, o.axis);
    this.apply_points_function_about_point((p) => applyMatrix(p, M), o.about_point, o.about_edge);
    return this;
  }
  flip(...rest: unknown[]): this {
    const o = pyargs(rest, ['axis'], { axis: UP });
    return this.rotate(TAU / 2, o.axis, { about_point: o.about_point, about_edge: o.about_edge });
  }
  stretch(factor: number, dim: number, ...rest: unknown[]): this {
    const o = pyargs(rest, [], {});
    this.apply_points_function_about_point((p) => {
      const q = p.slice();
      for (let i = dim; i < q.length; i += 3) q[i] *= factor;
      return q;
    }, o.about_point, o.about_edge);
    return this;
  }
  apply_function(fn: MappingFunction, ...rest: unknown[]): this {
    const o = pyargs(rest, [], {});
    let about_point = o.about_point, about_edge = o.about_edge;
    if (about_point == null && about_edge == null) about_point = ORIGIN;
    this.apply_points_function_about_point((p) => mapPoints(p, (x, y, z) => fn([x, y, z])), about_point, about_edge);
    return this;
  }
  apply_function_to_position(fn: MappingFunction): this {
    this.move_to(fn(this.get_center()));
    return this;
  }
  apply_function_to_submobject_positions(fn: MappingFunction): this {
    for (const s of this.submobjects) s.apply_function_to_position(fn);
    return this;
  }
  apply_matrix(matrix: readonly (readonly number[])[], ...rest: unknown[]): this {
    const o = pyargs(rest, [], {});
    let about_point = o.about_point, about_edge = o.about_edge;
    if (about_point == null && about_edge == null) about_point = ORIGIN;
    const full = [[1, 0, 0], [0, 1, 0], [0, 0, 1]];
    matrix.forEach((row, i) => row.forEach((v, j) => (full[i][j] = v)));
    this.apply_points_function_about_point((p) => applyMatrix(p, full), about_point, about_edge);
    return this;
  }
  /** `function` maps a Complex to a Complex (or [re, im]). */
  apply_complex_function(fn: (z: Complex) => unknown, ...rest: unknown[]): this {
    const o = pyargs(rest, [], {});
    return this.apply_function((p) => {
      const w = toComplex(fn(new Complex(p[0], p[1])));
      return [w.re, w.im, p[2]];
    }, { about_point: o.about_point, about_edge: o.about_edge });
  }
  reverse_points(): this {
    for (const mob of this.family_members_with_points()) {
      mob.apply_over_attr_arrays((arr: any) => {
        if (arr instanceof Float64Array) {
          const n = arr.length / 3;
          const out = new Float64Array(arr.length);
          for (let i = 0; i < n; i++) out.set(arr.subarray(3 * (n - 1 - i), 3 * (n - i)), 3 * i);
          return out;
        }
        return Array.isArray(arr) ? arr.slice().reverse() : arr;
      });
    }
    return this;
  }
  repeat(count_: number): this {
    for (const mob of this.family_members_with_points()) {
      mob.apply_over_attr_arrays((arr: any) => (arr instanceof Float64Array ? concat(...Array(count_).fill(arr)) : Array(count_).fill(arr).flat()));
    }
    return this;
  }
  apply_points_function_about_point(func: (p: Points) => Points, about_point?: Point3DLike | null, about_edge?: Point3DLike | null): this {
    if (about_point == null) about_point = this.get_critical_point(about_edge ?? ORIGIN);
    const c = to3(about_point);
    for (const mob of this.family_members_with_points()) {
      const p = mob.points;
      for (let i = 0; i < p.length; i += 3) {
        p[i] -= c[0];
        p[i + 1] -= c[1];
        p[i + 2] -= c[2];
      }
      const q = func(p);
      for (let i = 0; i < q.length; i += 3) {
        q[i] += c[0];
        q[i + 1] += c[1];
        q[i + 2] += c[2];
      }
      mob.points = q;
    }
    return this;
  }
  pose_at_angle(kw: Kwargs = {}): this {
    return this.rotate(TAU / 14, add(RIGHT, UP), kw);
  }

  // ---------------------------------------------------------------- positioning
  center(): this {
    return this.shift(mul(-1, this.get_center()));
  }
  align_on_border(direction: Point3DLike, buff: number = DEFAULT_MOBJECT_TO_EDGE_BUFFER): this {
    const d = to3(direction);
    const target: Point3D = [Math.sign(d[0]) * config.frame_x_radius, Math.sign(d[1]) * config.frame_y_radius, 0];
    const p = this.get_critical_point(d);
    const s = sub(sub(target, p), mul(buff, d));
    return this.shift([s[0] * Math.abs(Math.sign(d[0])), s[1] * Math.abs(Math.sign(d[1])), s[2] * Math.abs(Math.sign(d[2]))]);
  }
  to_corner(...args: unknown[]): this {
    const o = pyargs(args, ['corner', 'buff'], { corner: DL, buff: DEFAULT_MOBJECT_TO_EDGE_BUFFER });
    return this.align_on_border(o.corner, o.buff);
  }
  to_edge(...args: unknown[]): this {
    const o = pyargs(args, ['edge', 'buff'], { edge: LEFT, buff: DEFAULT_MOBJECT_TO_EDGE_BUFFER });
    return this.align_on_border(o.edge, o.buff);
  }
  next_to(...args: unknown[]): this {
    const o = pyargs(args, ['mobject_or_point', 'direction', 'buff', 'aligned_edge', 'submobject_to_align', 'index_of_submobject_to_align', 'coor_mask'], {
      direction: RIGHT, buff: DEFAULT_MOBJECT_TO_MOBJECT_BUFFER, aligned_edge: ORIGIN, submobject_to_align: null, index_of_submobject_to_align: null, coor_mask: [1, 1, 1],
    });
    const dir = to3(o.direction), edge = to3(o.aligned_edge);
    let target: Point3D;
    if (o.mobject_or_point instanceof Mobject) {
      const mob = o.mobject_or_point as Mobject;
      const aligner = o.index_of_submobject_to_align != null ? mob.get(o.index_of_submobject_to_align) : mob;
      target = aligner.get_critical_point(add(edge, dir));
    } else target = to3(o.mobject_or_point);
    const aligner: Mobject = o.submobject_to_align ?? (o.index_of_submobject_to_align != null ? this.get(o.index_of_submobject_to_align) : this);
    const p = aligner.get_critical_point(sub(edge, dir));
    return this.shift(mul(add(sub(target, p), mul(o.buff, dir)), o.coor_mask));
  }
  shift_onto_screen(kw: Kwargs = {}): this {
    const lengths = [config.frame_x_radius, config.frame_y_radius];
    for (const v of [UP, DOWN, LEFT, RIGHT]) {
      const dim = Math.abs(v[0]) > Math.abs(v[1]) ? 0 : 1;
      const buff = kw.buff ?? DEFAULT_MOBJECT_TO_EDGE_BUFFER;
      const max_val = lengths[dim] - buff;
      const ec = this.get_edge_center(v);
      if (ec[0] * v[0] + ec[1] * v[1] + ec[2] * v[2] > max_val) this.to_edge(v, kw);
    }
    return this;
  }
  is_off_screen(): boolean {
    if (this.get_left()[0] > config.frame_x_radius) return true;
    if (this.get_right()[0] < -config.frame_x_radius) return true;
    if (this.get_bottom()[1] > config.frame_y_radius) return true;
    return this.get_top()[1] < -config.frame_y_radius;
  }
  stretch_about_point(factor: number, dim: number, point: Point3DLike): this {
    return this.stretch(factor, dim, { about_point: point });
  }
  rescale_to_fit(length: number, dim: number, stretch = false, kw: Kwargs = {}): this {
    const old = this.length_over_dim(dim);
    if (old === 0) return this;
    if (stretch) this.stretch(length / old, dim, kw);
    else this.scale(length / old, kw);
    return this;
  }
  scale_to_fit_width(width: number, kw: Kwargs = {}): this {
    return this.rescale_to_fit(width, 0, false, kw);
  }
  stretch_to_fit_width(width: number, kw: Kwargs = {}): this {
    return this.rescale_to_fit(width, 0, true, kw);
  }
  scale_to_fit_height(height: number, kw: Kwargs = {}): this {
    return this.rescale_to_fit(height, 1, false, kw);
  }
  stretch_to_fit_height(height: number, kw: Kwargs = {}): this {
    return this.rescale_to_fit(height, 1, true, kw);
  }
  scale_to_fit_depth(depth: number, kw: Kwargs = {}): this {
    return this.rescale_to_fit(depth, 2, false, kw);
  }
  stretch_to_fit_depth(depth: number, kw: Kwargs = {}): this {
    return this.rescale_to_fit(depth, 2, true, kw);
  }
  set_coord(value: number, dim: number, direction: Point3DLike = ORIGIN): this {
    const curr = this.get_coord(dim, direction);
    const v: Point3D = [0, 0, 0];
    v[dim] = value - curr;
    return this.shift(v);
  }
  set_x(x: number, direction: Point3DLike = ORIGIN): this {
    return this.set_coord(x, 0, direction);
  }
  set_y(y: number, direction: Point3DLike = ORIGIN): this {
    return this.set_coord(y, 1, direction);
  }
  set_z(z: number, direction: Point3DLike = ORIGIN): this {
    return this.set_coord(z, 2, direction);
  }
  space_out_submobjects(factor = 1.5, kw: Kwargs = {}): this {
    this.scale(factor, kw);
    for (const s of this.submobjects) s.scale(1 / factor);
    return this;
  }
  move_to(...args: unknown[]): this {
    const o = pyargs(args, ['point_or_mobject', 'aligned_edge', 'coor_mask'], { aligned_edge: ORIGIN, coor_mask: [1, 1, 1] });
    const target = o.point_or_mobject instanceof Mobject ? o.point_or_mobject.get_critical_point(o.aligned_edge) : to3(o.point_or_mobject);
    const p = this.get_critical_point(o.aligned_edge);
    return this.shift(mul(sub(target, p), o.coor_mask));
  }
  replace(mobject: Mobject, dim_to_match = 0, stretch = false): this {
    if (!mobject.get_num_points() && !mobject.submobjects.length) throw new Error('Attempting to replace mobject with no points');
    if (stretch) {
      this.stretch_to_fit_width(mobject.width);
      this.stretch_to_fit_height(mobject.height);
    } else this.rescale_to_fit(mobject.length_over_dim(dim_to_match), dim_to_match, false);
    return this.shift(sub(mobject.get_center(), this.get_center()));
  }
  surround(...args: unknown[]): this {
    const o = pyargs(args, ['mobject', 'dim_to_match', 'stretch', 'buff'], { dim_to_match: 0, stretch: false, buff: MED_SMALL_BUFF });
    this.replace(o.mobject, o.dim_to_match, o.stretch);
    const length = o.mobject.length_over_dim(o.dim_to_match);
    return this.scale((length + o.buff) / length);
  }
  put_start_and_end_on(start: Point3DLike, end: Point3DLike): this {
    const [cs, ce] = this.get_start_and_end();
    const cv = sub(ce, cs);
    if (cv.every((x) => x === 0)) {
      console.warn(`put_start_and_end_on has been called on a closed loop or zero-length mobject. ${this.constructor.name} will be shifted to start point instead.`);
      return this.shift(sub(start, cs));
    }
    const tv = sub(end, start);
    const c = cross(cv, tv);
    const axis = norm(c) !== 0 ? normalize(c) : OUT;
    this.scale(norm(tv) / norm(cv), { about_point: cs });
    this.rotate(angle_between_vectors(cv, tv), { about_point: cs, axis });
    return this.shift(sub(start, cs));
  }

  // ---------------------------------------------------------------- background rectangle
  add_background_rectangle(...args: unknown[]): this {
    const o = pyargs(args, ['color', 'opacity'], { color: null, opacity: 0.75 });
    const { color, opacity, ...rest } = o;
    this.background_rectangle = new registry.BackgroundRectangle(this, { color, fill_opacity: opacity, ...rest });
    this.add_to_back(this.background_rectangle!);
    return this;
  }
  add_background_rectangle_to_submobjects(kw: Kwargs = {}): this {
    for (const s of this.submobjects) s.add_background_rectangle(kw);
    return this;
  }
  add_background_rectangle_to_family_members_with_points(kw: Kwargs = {}): this {
    for (const m of this.family_members_with_points()) m.add_background_rectangle(kw);
    return this;
  }

  // ---------------------------------------------------------------- colour
  set_color(...args: unknown[]): this {
    const o = pyargs(args, ['color', 'alpha', 'family'], { color: PURE_YELLOW, alpha: null, family: true });
    if (o.family) for (const s of this.submobjects) s.set_color(o.color, { family: o.family });
    this._color = ManimColor.parse(o.color);
    return this;
  }
  set_color_by_gradient(...colors: ParsableManimColor[]): this {
    return this.set_submobject_colors_by_gradient(...colors);
  }
  set_colors_by_radial_gradient(...args: unknown[]): this {
    const o = pyargs(args, ['center', 'radius', 'inner_color', 'outer_color'], { center: null, radius: 1, inner_color: '#FFFFFF', outer_color: '#000000' });
    return this.set_submobject_colors_by_radial_gradient(o.center, o.radius, o.inner_color, o.outer_color);
  }
  set_submobject_colors_by_gradient(...colors: ParsableManimColor[]): this {
    if (colors.length === 0) throw new Error('Need at least one color');
    if (colors.length === 1) return this.set_color(colors[0]);
    const mobs = this.family_members_with_points();
    const newColors = color_gradient(colors, mobs.length);
    mobs.forEach((m, i) => m.set_color(newColors[i], { family: false }));
    return this;
  }
  set_submobject_colors_by_radial_gradient(center: Point3DLike | null = null, radius = 1, inner_color: ParsableManimColor = '#FFFFFF', outer_color: ParsableManimColor = '#000000'): this {
    const c = center ?? this.get_center();
    for (const m of this.family_members_with_points()) {
      const t = Math.min(norm(sub(m.get_center(), c)) / radius, 1);
      m.set_color(interpolate_color(inner_color, outer_color, t), { family: false });
    }
    return this;
  }
  to_original_color(): this {
    return this.set_color(this.color);
  }
  fade_to(color: ParsableManimColor, alpha: number, family = true): this {
    if (this.get_num_points() > 0) this.set_color(interpolate_color(this.get_color(), color, alpha), { family: false });
    if (family) for (const s of this.submobjects) s.fade_to(color, alpha);
    return this;
  }
  fade(darkness = 0.5, family = true): this {
    if (family) for (const s of this.submobjects) s.fade(darkness, family);
    return this;
  }
  get_color(): ManimColor {
    return this._color;
  }

  save_state(): this {
    this.saved_state = null;
    this.saved_state = this.copy();
    return this;
  }
  restore(): this {
    if (!this.saved_state) throw new Error('Trying to restore without having saved');
    return this.become(this.saved_state);
  }

  // ---------------------------------------------------------------- measurements
  reduce_across_dimension(reduce_func: (vals: number[]) => number, dim: number): number | null {
    if (this.submobjects.length === 0 && this.points.length === 0) return null;
    let rv: number | null = null;
    if (this.points.length) {
      const vals: number[] = [];
      for (let i = dim; i < this.points.length; i += 3) vals.push(this.points[i]);
      rv = reduce_func(vals);
    }
    for (const m of this.submobjects) {
      const v = m.reduce_across_dimension(reduce_func, dim);
      if (rv === null) rv = v;
      else if (v !== null) rv = reduce_func([v, rv]);
    }
    return rv;
  }
  nonempty_submobjects(): Mobject[] {
    return this.submobjects.filter((s) => s.submobjects.length !== 0 || s.points.length !== 0);
  }
  get_merged_array(attr: string): Points {
    return concat((this as any)[attr] as Points, ...this.submobjects.map((s) => s.get_merged_array(attr)));
  }
  get_all_points(): Points {
    return this.get_merged_array('points');
  }
  get_points_defining_boundary(): Points {
    return this.get_all_points();
  }
  get_num_points(): number {
    return count(this.points);
  }
  get_extremum_along_dim(points: Points | null = null, dim = 0, key = 0): number {
    const p = points ?? this.get_points_defining_boundary();
    let mn = Infinity, mx = -Infinity;
    for (let i = dim; i < p.length; i += 3) {
      if (p[i] < mn) mn = p[i];
      if (p[i] > mx) mx = p[i];
    }
    if (key < 0) return mn;
    if (key === 0) return (mn + mx) / 2;
    return mx;
  }
  get_critical_point(direction: Point3DLike): Point3D {
    const result: Point3D = [0, 0, 0];
    const all = this.get_points_defining_boundary();
    if (all.length === 0) return result;
    for (let d = 0; d < 3; d++) result[d] = this.get_extremum_along_dim(all, d, direction[d] ?? 0);
    return result;
  }
  get_edge_center(direction: Point3DLike): Point3D {
    return this.get_critical_point(direction);
  }
  get_corner(direction: Point3DLike): Point3D {
    return this.get_critical_point(direction);
  }
  get_center(): Point3D {
    return this.get_critical_point([0, 0, 0]);
  }
  get_center_of_mass(): Point3D {
    const p = this.get_all_points();
    const n = p.length / 3;
    const s: Point3D = [0, 0, 0];
    for (let i = 0; i < p.length; i += 3) {
      s[0] += p[i] / n;
      s[1] += p[i + 1] / n;
      s[2] += p[i + 2] / n;
    }
    return s;
  }
  get_boundary_point(direction: Point3DLike): Point3D {
    const p = this.get_points_defining_boundary();
    let best = 0, bestV = -Infinity;
    for (let i = 0; i < p.length; i += 3) {
      const v = p[i] * direction[0] + p[i + 1] * direction[1] + p[i + 2] * (direction[2] ?? 0);
      if (v > bestV) {
        bestV = v;
        best = i / 3;
      }
    }
    return getPoint(p, best);
  }
  get_midpoint(): Point3D {
    return this.point_from_proportion(0.5);
  }
  get_top(): Point3D {
    return this.get_edge_center(UP);
  }
  get_bottom(): Point3D {
    return this.get_edge_center(DOWN);
  }
  get_right(): Point3D {
    return this.get_edge_center(RIGHT);
  }
  get_left(): Point3D {
    return this.get_edge_center(LEFT);
  }
  get_zenith(): Point3D {
    return this.get_edge_center(OUT);
  }
  get_nadir(): Point3D {
    return this.get_edge_center(IN);
  }
  length_over_dim(dim: number): number {
    const mx = this.reduce_across_dimension((v) => Math.max(...v), dim);
    const mn = this.reduce_across_dimension((v) => Math.min(...v), dim);
    if (mx === null || mn === null) return 0;
    return mx - mn;
  }
  get_coord(dim: number, direction: Point3DLike = ORIGIN): number {
    return this.get_extremum_along_dim(null, dim, direction[dim] ?? 0);
  }
  get_x(direction: Point3DLike = ORIGIN): number {
    return this.get_coord(0, direction);
  }
  get_y(direction: Point3DLike = ORIGIN): number {
    return this.get_coord(1, direction);
  }
  get_z(direction: Point3DLike = ORIGIN): number {
    return this.get_coord(2, direction);
  }
  get_start(): Point3D {
    this.throw_error_if_no_points();
    return getPoint(this.points, 0);
  }
  get_end(): Point3D {
    this.throw_error_if_no_points();
    return getPoint(this.points, -1);
  }
  get_start_and_end(): [Point3D, Point3D] {
    return [this.get_start(), this.get_end()];
  }
  point_from_proportion(_alpha: number): Point3D {
    throw new Error('Please override in a child class.');
  }
  proportion_from_point(_point: Point3DLike): number {
    throw new Error('Please override in a child class.');
  }
  get_pieces(n_pieces: number): Group {
    const template = this.copy();
    template.submobjects = [];
    const pieces: Mobject[] = [];
    for (let i = 0; i < n_pieces; i++) pieces.push((template.copy() as any).pointwise_become_partial(this, i / n_pieces, (i + 1) / n_pieces));
    return new Group(...pieces);
  }
  get_z_index_reference_point(): Point3D {
    return (this.z_index_group ?? this).get_center();
  }
  has_points(): boolean {
    return this.points.length > 0;
  }
  has_no_points(): boolean {
    return !this.has_points();
  }

  // ---------------------------------------------------------------- matching
  match_color(mobject: Mobject): this {
    return this.set_color(mobject.get_color());
  }
  match_dim_size(mobject: Mobject, dim: number, kw: Kwargs = {}): this {
    return this.rescale_to_fit(mobject.length_over_dim(dim), dim, kw.stretch ?? false, kw);
  }
  match_width(mobject: Mobject, kw: Kwargs = {}): this {
    return this.match_dim_size(mobject, 0, kw);
  }
  match_height(mobject: Mobject, kw: Kwargs = {}): this {
    return this.match_dim_size(mobject, 1, kw);
  }
  match_depth(mobject: Mobject, kw: Kwargs = {}): this {
    return this.match_dim_size(mobject, 2, kw);
  }
  match_coord(mobject: Mobject, dim: number, direction: Point3DLike = ORIGIN): this {
    return this.set_coord(mobject.get_coord(dim, direction), dim, direction);
  }
  match_x(mobject: Mobject, direction: Point3DLike = ORIGIN): this {
    return this.match_coord(mobject, 0, direction);
  }
  match_y(mobject: Mobject, direction: Point3DLike = ORIGIN): this {
    return this.match_coord(mobject, 1, direction);
  }
  match_z(mobject: Mobject, direction: Point3DLike = ORIGIN): this {
    return this.match_coord(mobject, 2, direction);
  }
  align_to(mobject_or_point: Mobject | Point3DLike, direction: Point3DLike = ORIGIN): this {
    const point = mobject_or_point instanceof Mobject ? mobject_or_point.get_critical_point(direction) : to3(mobject_or_point);
    for (let d = 0; d < 3; d++) if ((direction[d] ?? 0) !== 0) this.set_coord(point[d], d, direction);
    return this;
  }

  // ---------------------------------------------------------------- family / container protocol
  /** Python `mob[i]` (negative indices allowed). A mobject with points counts itself as item 0. */
  get(i: number): any {
    const n = this.length;
    const idx = i < 0 ? i + n : i;
    if (idx < 0 || idx >= n) throw new RangeError(`index ${i} out of range for ${this.constructor.name} of length ${n}`);
    if (this.has_no_points()) return this.submobjects[idx];
    return idx === 0 ? this : this.submobjects[idx - 1];
  }
  /** Python `mob[start:stop:step]`, returned as a Group of the same kind. */
  get_slice(start: number | null = null, stop: number | null = null, step = 1): any {
    const items = [...this];
    const n = items.length;
    const norm_ = (x: number | null, d: number) => (x === null ? d : x < 0 ? Math.max(0, x + n) : Math.min(x, n));
    const out: Mobject[] = [];
    if (step > 0) for (let k = norm_(start, 0); k < norm_(stop, n); k += step) out.push(items[k]);
    else for (let k = start === null ? n - 1 : norm_(start, n - 1); k > (stop === null ? -1 : norm_(stop, -1)); k += step) out.push(items[k]);
    const G = this.get_group_class();
    return new G(...out);
  }
  *[Symbol.iterator](): Iterator<any> {
    if (this.has_points()) yield this;
    yield* this.submobjects;
  }
  get length(): number {
    return this.submobjects.length + (this.has_points() ? 1 : 0);
  }
  get_group_class(): any {
    return Group;
  }
  static get_mobject_type_class(): any {
    return Mobject;
  }
  split(): Mobject[] {
    return [...(this.points.length ? [this] : []), ...this.submobjects];
  }
  get_family(_recurse = true): Mobject[] {
    const all: Mobject[] = [this];
    for (const s of this.submobjects) all.push(...s.get_family());
    return remove_list_redundancies(all);
  }
  family_members_with_points(): Mobject[] {
    return this.get_family().filter((m) => m.get_num_points() > 0);
  }

  arrange(...args: unknown[]): this {
    const o = pyargs(args, ['direction', 'buff', 'center'], { direction: RIGHT, buff: DEFAULT_MOBJECT_TO_MOBJECT_BUFFER, center: true });
    const { direction, buff, center, ...rest } = o;
    for (let i = 1; i < this.submobjects.length; i++) this.submobjects[i].next_to(this.submobjects[i - 1], direction, buff, rest);
    if (center) this.center();
    return this;
  }
  arrange_in_grid(...args: unknown[]): this {
    const o = pyargs(args, ['rows', 'cols', 'buff', 'cell_alignment', 'row_alignments', 'col_alignments', 'row_heights', 'col_widths', 'flow_order'], {
      rows: null, cols: null, buff: MED_SMALL_BUFF, cell_alignment: ORIGIN, row_alignments: null, col_alignments: null, row_heights: null, col_widths: null, flow_order: 'rd',
    });
    const Line = registry.Line;
    const mobs = this.submobjects.slice();
    const start_pos = this.get_center();
    const initSize = (num: number | null, al: string | null, sizes: unknown[] | null) => num ?? (al !== null ? al.length : sizes !== null ? sizes.length : null);
    let cols: number | null = initSize(o.cols, o.col_alignments, o.col_widths);
    let rows: number | null = initSize(o.rows, o.row_alignments, o.row_heights);
    if (rows === null && cols === null) cols = Math.ceil(Math.sqrt(mobs.length));
    if (rows === null) rows = Math.ceil(mobs.length / (cols as number));
    if (cols === null) cols = Math.ceil(mobs.length / rows);
    const R = rows as number, C = cols as number;
    if (R * C < mobs.length) throw new Error('Too few rows and columns to fit all submobjetcs.');
    const [bx, by] = Array.isArray(o.buff) ? o.buff : [o.buff, o.buff];
    const initAl = (al: string | null, num: number, map: Record<string, Point3D>, name: string, dir: Point3D): Point3D[] => {
      if (al === null) return Array(num).fill(mul(o.cell_alignment, dir));
      if (al.length !== num) throw new Error(`${name}_alignments has a mismatching size.`);
      return [...al].map((ch) => map[ch]);
    };
    const rowAl = initAl(o.row_alignments, R, { u: UP, c: ORIGIN, d: DOWN } as any, 'row', RIGHT as Point3D);
    const colAl = initAl(o.col_alignments, C, { l: LEFT, c: ORIGIN, r: RIGHT } as any, 'col', UP as Point3D);
    const mapper: Record<string, (r: number, c: number) => number> = {
      dr: (r, c) => R - r - 1 + c * R, dl: (r, c) => R - r - 1 + (C - c - 1) * R, ur: (r, c) => r + c * R, ul: (r, c) => r + (C - c - 1) * R,
      rd: (r, c) => (R - r - 1) * C + c, ld: (r, c) => (R - r - 1) * C + (C - c - 1), ru: (r, c) => r * C + c, lu: (r, c) => r * C + (C - c - 1),
    };
    if (!(o.flow_order in mapper)) throw new Error('flow_order must be one of the following values: "dr", "rd", "ld" "dl", "ru", "ur", "lu", "ul".');
    const idx = mapper[o.flow_order];
    rowAl.reverse();
    const rowHeights: (number | null)[] = o.row_heights ? [...o.row_heights].reverse() : [];
    const colWidths: (number | null)[] = o.col_widths ? [...o.col_widths] : [];
    const placeholder = new Mobject();
    while (mobs.length < R * C) mobs.push(placeholder);
    const grid = Array.from({ length: R }, (_, r) => Array.from({ length: C }, (_, c) => mobs[idx(r, c)]));
    const mh = Array.from({ length: R }, (_, r) => Math.max(...grid[r].map((m) => m.height)));
    const mw = Array.from({ length: C }, (_, c) => Math.max(...grid.map((row) => row[c].width)));
    const initSizes = (sizes: (number | null)[], num: number, measures: number[], name: string) => {
      if (!sizes.length) sizes = Array(num).fill(null);
      if (sizes.length !== num) throw new Error(`${name} has a mismatching size.`);
      return sizes.map((s, i) => s ?? measures[i]);
    };
    const heights = initSizes(rowHeights, R, mh, 'row_heights');
    const widths = initSizes(colWidths, C, mw, 'col_widths');
    let y = 0;
    for (let r = 0; r < R; r++) {
      let x = 0;
      for (let c = 0; c < C; c++) {
        if (grid[r][c] !== placeholder) {
          const line = new Line([x, y, 0], [x + widths[c], y + heights[r], 0]);
          grid[r][c].move_to(line, add(rowAl[r], colAl[c]));
        }
        x += widths[c] + bx;
      }
      y += heights[r] + by;
    }
    return this.move_to(start_pos);
  }
  sort(point_to_num_func: (p: Point3D) => number = (p) => p[0], submob_func: ((m: Mobject) => number) | null = null): this {
    const f = submob_func ?? ((m: Mobject) => point_to_num_func(m.get_center()));
    const keyed = this.submobjects.map((m) => [f(m), m] as const);
    keyed.sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0));
    this.submobjects = keyed.map((k) => k[1]);
    return this;
  }
  shuffle(recursive = false): this {
    if (recursive) for (const s of this.submobjects) s.shuffle(true);
    for (let i = this.submobjects.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [this.submobjects[i], this.submobjects[j]] = [this.submobjects[j], this.submobjects[i]];
    }
    return this;
  }
  invert(recursive = false): this {
    if (recursive) for (const s of this.submobjects) s.invert(true);
    this.submobjects.reverse();
    return this;
  }
  arrange_submobjects(...args: unknown[]): this {
    return this.arrange(...args);
  }
  sort_submobjects(...args: any[]): this {
    return this.sort(...args);
  }
  shuffle_submobjects(...args: any[]): this {
    return this.shuffle(...args);
  }

  // ---------------------------------------------------------------- alignment (for Transform)
  align_data(mobject: Mobject, skip_point_alignment = false): this {
    this.null_point_align(mobject);
    this.align_submobjects(mobject);
    if (!skip_point_alignment) this.align_points(mobject);
    if (this.submobjects.length !== mobject.submobjects.length) throw new Error('align_data: submobject counts differ after alignment');
    this.submobjects.forEach((m1, i) => m1.align_data(mobject.submobjects[i]));
    return this;
  }
  get_point_mobject(_center: Point3DLike | null = null): Mobject {
    throw new Error(`get_point_mobject not implemented for ${this.constructor.name}`);
  }
  align_points(mobject: Mobject): this {
    const c1 = this.get_num_points(), c2 = mobject.get_num_points();
    if (c1 < c2) this.align_points_with_larger(mobject);
    else if (c2 < c1) mobject.align_points_with_larger(this);
    return this;
  }
  align_points_with_larger(_larger: Mobject): this {
    throw new Error('Please override in a child class.');
  }
  align_submobjects(mobject: Mobject): this {
    const n1 = this.submobjects.length, n2 = mobject.submobjects.length;
    this.add_n_more_submobjects(Math.max(0, n2 - n1));
    mobject.add_n_more_submobjects(Math.max(0, n1 - n2));
    return this;
  }
  null_point_align(mobject: Mobject): this {
    for (const [m1, m2] of [[this, mobject], [mobject, this]] as [Mobject, Mobject][]) {
      if (m1.has_no_points() && m2.has_points()) m2.push_self_into_submobjects();
    }
    return this;
  }
  push_self_into_submobjects(): this {
    const c = this.copy();
    c.submobjects = [];
    this.reset_points();
    this.add(c);
    return this;
  }
  add_n_more_submobjects(n: number): this | null {
    if (n === 0) return null;
    const curr = this.submobjects.length;
    if (curr === 0) {
      this.submobjects = Array.from({ length: n }, () => this.get_point_mobject());
      return null;
    }
    const target = curr + n;
    const split = new Array(curr).fill(0);
    for (let i = 0; i < target; i++) split[Math.floor((i * curr) / target)] += 1;
    const out: Mobject[] = [];
    this.submobjects.forEach((s, i) => {
      out.push(s);
      for (let k = 1; k < split[i]; k++) out.push(s.copy().fade(1));
    });
    this.submobjects = out;
    return this;
  }
  repeat_submobject(submob: Mobject): Mobject {
    return submob.copy();
  }
  interpolate(mobject1: Mobject, mobject2: Mobject, alpha: number, path_func: PathFuncType = straight_path()): this {
    this.points = path_func(mobject1.points, mobject2.points, alpha);
    this.interpolate_color(mobject1, mobject2, alpha);
    return this;
  }
  interpolate_color(_m1: Mobject, _m2: Mobject, _alpha: number): this {
    throw new Error('Please override in a child class.');
  }
  become(...args: unknown[]): this {
    const o = pyargs(args, ['mobject', 'match_height', 'match_width', 'match_depth', 'match_center', 'stretch'], {
      match_height: false, match_width: false, match_depth: false, match_center: false, stretch: false,
    });
    let mobject: Mobject = o.mobject;
    if (o.stretch || o.match_height || o.match_width || o.match_depth || o.match_center) {
      mobject = mobject.copy();
      if (o.stretch) {
        mobject.stretch_to_fit_height(this.height);
        mobject.stretch_to_fit_width(this.width);
        mobject.stretch_to_fit_depth(this.depth);
      } else {
        if (o.match_height) mobject.match_height(this);
        if (o.match_width) mobject.match_width(this);
        if (o.match_depth) mobject.match_depth(this);
      }
      if (o.match_center) mobject.move_to(this.get_center());
    }
    this.align_data(mobject, true);
    const f1 = this.get_family(), f2 = mobject.get_family();
    if (f1.length !== f2.length) throw new Error('become: family sizes differ');
    f1.forEach((sm1, i) => {
      sm1.points = f2[i].points.slice();
      sm1.interpolate_color(sm1, f2[i], 1);
    });
    return this;
  }
  match_points(mobject: Mobject, _copy_submobjects = true): this {
    const f1 = this.get_family(), f2 = mobject.get_family();
    for (let i = 0; i < Math.min(f1.length, f2.length); i++) f1[i].points = f2[i].points.slice();
    return this;
  }
  throw_error_if_no_points(): void {
    if (this.has_no_points()) throw new Error(`Cannot call this method on a ${this.constructor.name} with no points`);
  }
  set_z_index(z_index_value: number, family = true): this {
    if (family) for (const s of this.submobjects) s.set_z_index(z_index_value, family);
    this.z_index = z_index_value;
    return this;
  }
  set_z_index_by_z_Point3D(): this {
    return this.set_z_index(this.get_center()[2]);
  }
}

/** Groups several mobjects of any kind. */
export class Group extends Mobject {
  constructor(...args: unknown[]) {
    const mobs: Mobject[] = [];
    let kw: Kwargs = {};
    for (const a of args) {
      if (isKwargs(a)) kw = a;
      else if (a instanceof Mobject) mobs.push(a);
      else if (a && typeof (a as any)[Symbol.iterator] === 'function') mobs.push(...(a as Iterable<Mobject>));
    }
    super(kw);
    this.add(...mobs);
  }
}

// ---------------------------------------------------------------- .animate
/** Records method calls on `mobject.target`; `.build()` returns the animation. */
export class _AnimationBuilder {
  mobject: Mobject;
  overridden_animation: any = null;
  is_chaining = false;
  methods: [string, unknown[]][] = [];
  cannot_pass_args = false;
  anim_args: Kwargs = {};
  constructor(mobject: Mobject) {
    this.mobject = mobject;
    this.mobject.generate_target();
  }
  __call__(kwargs: Kwargs = {}): void {
    if (this.cannot_pass_args) throw new Error('Animation arguments must be passed before accessing methods and can only be passed once');
    this.anim_args = kwargs;
    this.cannot_pass_args = true;
  }
  call_method(name: string, args: unknown[]): void {
    const target = this.mobject.target as any;
    const method = target[name];
    if (typeof method !== 'function') throw new TypeError(`${target.constructor.name}.${name} is not a method`);
    const override = method._override_animate;
    if ((this.is_chaining && override) || this.overridden_animation) throw new Error('Method chaining is currently not supported for overridden animations');
    if (override) {
      const kw = { anim_args: this.anim_args };
      Object.defineProperty(kw, KW, { value: true });
      this.overridden_animation = override(this.mobject, ...args, kw);
    }
    else {
      this.methods.push([name, args]);
      method.apply(target, args);
    }
    this.is_chaining = true;
    this.cannot_pass_args = true;
  }
  build(): any {
    const anim = this.overridden_animation ?? new registry._MethodAnimation(this.mobject, this.methods);
    for (const [k, v] of Object.entries(this.anim_args)) anim[k] = v;
    return anim;
  }
}

export function makeAnimationBuilder(mob: Mobject): any {
  const b = new _AnimationBuilder(mob);
  const proxy: any = new Proxy(function () {} as any, {
    apply(_t, _this, args) {
      b.__call__((args[0] as Kwargs) ?? {});
      return proxy;
    },
    get(_t, prop) {
      if (prop === '__animation_builder__') return b;
      if (prop === 'build') return () => b.build();
      if (typeof prop === 'symbol') return undefined;
      return (...args: unknown[]) => {
        b.call_method(prop, args);
        return proxy;
      };
    },
  });
  return proxy;
}

export const isAnimationBuilder = (x: unknown): boolean => !!x && typeof x === 'function' && !!(x as any).__animation_builder__;

/**
 * Make `mob.animate.method(...)` play a custom animation.
 * JS: `override_animate(Cls.prototype.method, (mob, ...args, { anim_args }) => animation)`.
 * Python-decorator form: `override_animate(method)(animation_method)`, where
 * animation_method is a method (`this` is the mobject).
 */
export function override_animate(method: Function, animation_method?: (mob: any, ...args: any[]) => any): any {
  if (animation_method) {
    (method as any)._override_animate = animation_method;
    return undefined;
  }
  return (anim_method: Function) => {
    (method as any)._override_animate = (mob: any, ...args: any[]) => anim_method.apply(mob, args);
    return anim_method;
  };
}
