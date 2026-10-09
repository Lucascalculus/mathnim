// manim/animation/transform.py
import { DEFAULT_POINTWISE_FUNCTION_RUN_TIME, DEGREES, ORIGIN, OUT } from '../constants';
import { Group, Mobject } from '../mobject/mobject';
import { VGroup } from '../mobject/types/vectorized_mobject';
import { isBoundMethod, type BoundMethod } from '../utils/bind';
import { Complex, toComplex } from '../utils/complex';
import { path_along_arc, path_along_circles, type PathFuncType } from '../utils/paths';
import { fromList } from '../utils/points';
import { isKwargs, pyargs, type Kwargs } from '../utils/pyargs';
import { register } from '../utils/registry';
import { smooth, squish_rate_func } from '../utils/rate_functions';
import { to3, type Point3DLike } from '../utils/vector';
import { Animation, zipFamilies, type SceneLike } from './animation';

export class Transform extends Animation {
  declare target_mobject: Mobject;
  declare target_copy: Mobject;
  declare path_arc_axis: Point3DLike;
  declare path_arc_centers: Point3DLike | Point3DLike[] | null;
  declare replace_mobject_with_target_in_scene: boolean;
  declare _path_arc: number;
  declare _path_func: PathFuncType;

  constructor(...args: unknown[]) {
    const o = pyargs(args, ['mobject', 'target_mobject', 'path_func', 'path_arc', 'path_arc_axis', 'path_arc_centers', 'replace_mobject_with_target_in_scene'], {
      target_mobject: null, path_func: null, path_arc: 0, path_arc_axis: OUT, path_arc_centers: null, replace_mobject_with_target_in_scene: false,
    });
    const { mobject, target_mobject, path_func, path_arc, path_arc_axis, path_arc_centers, replace_mobject_with_target_in_scene, ...rest } = o;
    super(mobject, rest);
    this.path_arc_axis = path_arc_axis;
    this.path_arc_centers = path_arc_centers;
    this.path_arc = path_arc;
    if (path_func) this._path_func = path_func;
    else if (path_arc_centers !== null) {
      const centers = Array.isArray(path_arc_centers[0]) ? fromList(path_arc_centers as Point3DLike[]) : null;
      this._path_func = centers
        ? path_along_circles(path_arc, centers, path_arc_axis)
        : ((a, b, t) => path_along_circles(path_arc, fromList(Array(a.length / 3).fill(to3(path_arc_centers as Point3DLike))), path_arc_axis)(a, b, t));
    }
    this.replace_mobject_with_target_in_scene = replace_mobject_with_target_in_scene;
    this.target_mobject = target_mobject ?? new Mobject();
  }
  get path_arc(): number {
    return this._path_arc;
  }
  set path_arc(v: number) {
    this._path_arc = v;
    this._path_func = path_along_arc(v, this.path_arc_axis ?? OUT);
  }
  get path_func(): PathFuncType {
    return this._path_func;
  }
  set path_func(f: PathFuncType) {
    if (f) this._path_func = f;
  }
  override begin(): void {
    this.target_mobject = this.create_target();
    this.target_copy = this.target_mobject.copy();
    this.mobject.align_data(this.target_copy);
    super.begin();
  }
  create_target(): Mobject {
    return this.target_mobject;
  }
  override clean_up_from_scene(scene: SceneLike): void {
    super.clean_up_from_scene(scene);
    if (this.replace_mobject_with_target_in_scene) scene.replace(this.mobject, this.target_mobject);
  }
  override get_all_mobjects(): Mobject[] {
    return [this.mobject, this.starting_mobject, this.target_mobject, this.target_copy];
  }
  override get_all_families_zipped(): Mobject[][] {
    return zipFamilies([this.mobject, this.starting_mobject, this.target_copy], true);
  }
  override interpolate_submobject(submobject: Mobject, starting: Mobject, target_copy: Mobject, alpha: number): void {
    submobject.interpolate(starting, target_copy, alpha, this.path_func);
  }
}

export class ReplacementTransform extends Transform {
  constructor(mobject: Mobject, target_mobject: Mobject, kw: Kwargs = {}) {
    super(mobject, target_mobject, { ...kw, replace_mobject_with_target_in_scene: true });
  }
}

export class TransformFromCopy extends Transform {
  constructor(mobject: Mobject, target_mobject: Mobject, kw: Kwargs = {}) {
    super(target_mobject, mobject, kw);
  }
  override interpolate(alpha: number): void {
    super.interpolate(1 - alpha);
  }
}

export class ClockwiseTransform extends Transform {
  constructor(mobject: Mobject, target_mobject: Mobject, ...rest: unknown[]) {
    const o = pyargs(rest, ['path_arc'], { path_arc: -Math.PI });
    super(mobject, target_mobject, o);
  }
}

export class CounterclockwiseTransform extends Transform {
  constructor(mobject: Mobject, target_mobject: Mobject, ...rest: unknown[]) {
    const o = pyargs(rest, ['path_arc'], { path_arc: Math.PI });
    super(mobject, target_mobject, o);
  }
}

/** Transforms a mobject into its `.target` (see `generate_target`). */
export class MoveToTarget extends Transform {
  constructor(mobject: Mobject, kw: Kwargs = {}) {
    if (!mobject || !mobject.target) throw new Error("MoveToTarget called on mobject without attribute 'target'");
    super(mobject, mobject.target, kw);
  }
}

/** The animation behind `mob.animate...`: replays the recorded calls on finish. */
export class _MethodAnimation extends MoveToTarget {
  declare methods: [string, unknown[]][];
  constructor(mobject: Mobject, methods: [string, unknown[]][]) {
    super(mobject);
    this.methods = methods;
  }
  override finish(): void {
    for (const [name, args] of this.methods) (this.mobject as any)[name](...args);
    super.finish();
  }
}

/** `ApplyMethod(bind_method(mob, 'shift'), UP)` */
export class ApplyMethod extends Transform {
  declare method: BoundMethod;
  declare method_args: unknown[];
  constructor(method: BoundMethod, ...args: unknown[]) {
    if (!isBoundMethod(method)) throw new Error('ApplyMethod needs a bound method: use bind_method(mobject, "name")');
    const kwIdx = args.length && isKwargs(args[args.length - 1]) && ANIM_KW.some((k) => k in (args[args.length - 1] as object)) ? args.length - 1 : -1;
    const kw = kwIdx >= 0 ? (args[kwIdx] as Kwargs) : {};
    super(method.__self__, kw);
    this.method = method;
    this.method_args = kwIdx >= 0 ? args.slice(0, kwIdx) : args;
  }
  override create_target(): Mobject {
    const target = this.method.__self__.copy();
    target[this.method.__name__](...this.method_args);
    return target;
  }
}
const ANIM_KW = ['run_time', 'rate_func', 'lag_ratio', 'path_arc', 'path_func', 'remover', 'introducer', 'name', 'suspend_mobject_updating'];

export class ApplyPointwiseFunction extends ApplyMethod {
  constructor(fn: (p: any) => Point3DLike, mobject: Mobject, ...rest: unknown[]) {
    const o = pyargs(rest, ['run_time'], { run_time: DEFAULT_POINTWISE_FUNCTION_RUN_TIME });
    super(bindM(mobject, 'apply_function'), fn, o);
  }
}

export class ApplyPointwiseFunctionToCenter extends ApplyPointwiseFunction {
  declare function: (p: any) => Point3DLike;
  constructor(fn: (p: any) => Point3DLike, mobject: Mobject, kw: Kwargs = {}) {
    super(fn, mobject, kw);
    this.method = bindM(mobject, 'move_to');
    this.function = fn;
  }
  override begin(): void {
    this.method_args = [this.function(this.mobject.get_center())];
    super.begin();
  }
}

export class FadeToColor extends ApplyMethod {
  constructor(...args: unknown[]) {
    const { mobject, color, ...kw } = pyargs(args, ['mobject', 'color']);
    super(bindM(mobject, 'set_color'), color, kw);
  }
}

export class ScaleInPlace extends ApplyMethod {
  constructor(mobject: Mobject, scale_factor: number, kw: Kwargs = {}) {
    super(bindM(mobject, 'scale'), scale_factor, kw);
  }
}

export class ShrinkToCenter extends ScaleInPlace {
  constructor(mobject: Mobject, kw: Kwargs = {}) {
    super(mobject, 0, kw);
  }
}

/** Animates back to the state saved with `save_state()`. */
export class Restore extends ApplyMethod {
  constructor(mobject: Mobject, kw: Kwargs = {}) {
    super(bindM(mobject, 'restore'), kw);
  }
}

export class ApplyFunction extends Transform {
  declare function: (m: Mobject) => Mobject;
  constructor(fn: (m: Mobject) => Mobject, mobject: Mobject, kw: Kwargs = {}) {
    super(mobject, kw);
    this.function = fn;
  }
  override create_target(): Mobject {
    const t = this.function(this.mobject.copy());
    if (!(t instanceof Mobject)) throw new TypeError('Functions passed to ApplyFunction must return object of type Mobject');
    return t;
  }
}

export class ApplyMatrix extends ApplyPointwiseFunction {
  constructor(matrix: number[][], mobject: Mobject, ...rest: unknown[]) {
    const o = pyargs(rest, ['about_point'], { about_point: ORIGIN });
    const M = ApplyMatrix.initialize_matrix(matrix);
    const ap = to3(o.about_point);
    const { about_point, ...kw } = o;
    super((p: number[]) => {
      const q = [p[0] - ap[0], p[1] - ap[1], p[2] - ap[2]];
      return [0, 1, 2].map((i) => M[i][0] * q[0] + M[i][1] * q[1] + M[i][2] * q[2] + ap[i]) as Point3DLike;
    }, mobject, kw);
  }
  static initialize_matrix(matrix: number[][]): number[][] {
    if (matrix.length === 2 && matrix[0].length === 2) return [[matrix[0][0], matrix[0][1], 0], [matrix[1][0], matrix[1][1], 0], [0, 0, 1]];
    if (matrix.length !== 3 || matrix[0].length !== 3) throw new Error('Matrix has bad dimensions');
    return matrix;
  }
}

/** `function` maps a Complex to a Complex. */
export class ApplyComplexFunction extends ApplyMethod {
  declare function: (z: Complex) => unknown;
  constructor(fn: (z: Complex) => unknown, mobject: Mobject, kw: Kwargs = {}) {
    super(bindM(mobject, 'apply_complex_function'), fn, kw);
    this.function = fn;
    this.path_arc = toComplex(fn(new Complex(1, 0))).log().im;
  }
}

/** Moves each mobject to the position of the next one. */
export class CyclicReplace extends Transform {
  declare group: Mobject;
  constructor(...args: unknown[]) {
    const kw = (args.length && isKwargs(args[args.length - 1]) ? args.pop() : {}) as Kwargs;
    const mobs = args as Mobject[];
    const group = mobs.length === 1 && (mobs[0] instanceof Group || mobs[0] instanceof VGroup) ? mobs[0] : new Group(...mobs);
    super(group, { path_arc: 90 * DEGREES, ...kw });
    this.group = group;
  }
  override create_target(): Mobject {
    const target = this.group.copy();
    const items = [...target];
    const cycled = [items[items.length - 1], ...items.slice(0, -1)];
    const orig = [...this.group];
    cycled.forEach((m, i) => m.move_to(orig[i]));
    return target;
  }
}

export class Swap extends CyclicReplace {}

export class TransformAnimations extends Transform {
  declare start_anim: Animation;
  declare end_anim: Animation;
  constructor(start_anim: Animation, end_anim: Animation, kw: Kwargs = {}) {
    const run_time = kw.run_time ?? Math.max(start_anim.run_time, end_anim.run_time);
    for (const a of [start_anim, end_anim]) a.set_run_time(run_time);
    if (start_anim.starting_mobject && end_anim.starting_mobject && start_anim.starting_mobject.get_num_points() !== end_anim.starting_mobject.get_num_points()) {
      start_anim.starting_mobject.align_data(end_anim.starting_mobject);
      for (const a of [start_anim, end_anim]) if (a instanceof Transform && a.starting_mobject) a.starting_mobject.align_data(a.target_mobject);
    }
    super(start_anim.mobject, end_anim.mobject, { rate_func: squish_rate_func(smooth), ...kw, run_time });
    this.start_anim = start_anim;
    this.end_anim = end_anim;
    start_anim.mobject = this.starting_mobject;
    end_anim.mobject = this.target_mobject;
  }
  override interpolate(alpha: number): void {
    this.start_anim.interpolate(alpha);
    this.end_anim.interpolate(alpha);
    super.interpolate(alpha);
  }
}

/** Fades one mobject into another, morphing their silhouettes. */
export class FadeTransform extends Transform {
  declare to_add_on_completion: Mobject;
  declare stretch: boolean;
  declare dim_to_match: number;
  declare ending_mobject: Mobject;
  constructor(mobject: Mobject, target_mobject: Mobject, ...rest: unknown[]) {
    const o = pyargs(rest, ['stretch', 'dim_to_match'], { stretch: true, dim_to_match: 1 });
    const { stretch, dim_to_match, ...kw } = o;
    mobject.save_state();
    super(new Group(mobject, target_mobject.copy()), kw);
    this.to_add_on_completion = target_mobject;
    this.stretch = stretch;
    this.dim_to_match = dim_to_match;
  }
  override begin(): void {
    this.ending_mobject = this.mobject.copy();
    Animation.prototype.begin.call(this);
    const start = this.starting_mobject, end = this.ending_mobject;
    this.ghost_to(start.get(1), start.get(0));
    this.ghost_to(end.get(0), end.get(1));
  }
  ghost_to(source: Mobject, target: Mobject): void {
    if (target.get_num_points() || target.submobjects.length) source.replace(target, this.dim_to_match, this.stretch);
    (source as any).set_opacity(0);
  }
  override get_all_mobjects(): Mobject[] {
    return [this.mobject, this.starting_mobject, this.ending_mobject];
  }
  override get_all_families_zipped(): Mobject[][] {
    return zipFamilies(this.get_all_mobjects(), false);
  }
  override interpolate_submobject(submobject: Mobject, starting: Mobject, ending: Mobject, alpha: number): void {
    submobject.interpolate(starting, ending, alpha, this.path_func);
  }
  override clean_up_from_scene(scene: SceneLike): void {
    Animation.prototype.clean_up_from_scene.call(this, scene);
    scene.remove(this.mobject);
    this.mobject.get(0).restore();
    scene.add(this.to_add_on_completion);
  }
}

export class FadeTransformPieces extends FadeTransform {
  override begin(): void {
    this.mobject.get(0).align_submobjects(this.mobject.get(1));
    super.begin();
  }
  override ghost_to(source: Mobject, target: Mobject): void {
    const f1 = source.get_family(), f2 = target.get_family();
    f1.forEach((sm, i) => super.ghost_to(sm, f2[i]));
  }
}

function bindM(obj: any, name: string): BoundMethod {
  const fn = ((...a: unknown[]) => obj[name](...a)) as BoundMethod;
  fn.__self__ = obj;
  fn.__name__ = name;
  return fn;
}

register({ _MethodAnimation, Transform });
