// manim/animation/movement.py
import type { Mobject } from '../mobject/mobject';
import type { VMobject } from '../mobject/types/vectorized_mobject';
import { Complex, toComplex } from '../utils/complex';
import { pyargs, type Kwargs } from '../utils/pyargs';
import { linear } from '../utils/rate_functions';
import type { Point3D, Point3DLike } from '../utils/vector';
import { Animation } from './animation';

export type HomotopyFunction = (x: number, y: number, z: number, t: number) => Point3DLike;

/** Moves every point along homotopy(x, y, z, t). */
export class Homotopy extends Animation {
  declare homotopy: HomotopyFunction;
  declare apply_function_kwargs: Kwargs;
  constructor(homotopy: HomotopyFunction, mobject: Mobject, ...rest: unknown[]) {
    const o = pyargs(rest, ['run_time', 'apply_function_kwargs'], { run_time: 3, apply_function_kwargs: null });
    const { apply_function_kwargs, ...kw } = o;
    super(mobject, kw);
    this.homotopy = homotopy;
    this.apply_function_kwargs = apply_function_kwargs ?? {};
  }
  function_at_time_t(t: number): (p: Point3D) => Point3DLike {
    return (p) => this.homotopy(p[0], p[1], p[2], t);
  }
  override interpolate_submobject(sub: Mobject, start: Mobject, alpha: number): void {
    sub.points = start.points.slice();
    sub.apply_function(this.function_at_time_t(alpha), this.apply_function_kwargs);
  }
}

export class SmoothedVectorizedHomotopy extends Homotopy {
  override interpolate_submobject(sub: Mobject, start: Mobject, alpha: number): void {
    super.interpolate_submobject(sub, start, alpha);
    (sub as VMobject).make_smooth();
  }
}

/** complex_homotopy(z: Complex, t) -> Complex */
export class ComplexHomotopy extends Homotopy {
  constructor(complex_homotopy: (z: Complex, t: number) => unknown, mobject: Mobject, kw: Kwargs = {}) {
    super((x, y, z, t) => {
      const c = toComplex(complex_homotopy(new Complex(x, y), t));
      return [c.re, c.im, z];
    }, mobject, kw);
  }
}

/** Flows points along a vector field for `virtual_time`. */
export class PhaseFlow extends Animation {
  declare virtual_time: number;
  declare function: (p: Point3D) => Point3DLike;
  declare last_alpha?: number;
  constructor(fn: (p: Point3D) => Point3DLike, mobject: Mobject, ...rest: unknown[]) {
    const o = pyargs(rest, ['virtual_time', 'suspend_mobject_updating', 'rate_func'], { virtual_time: 1, suspend_mobject_updating: false, rate_func: linear });
    const { virtual_time, ...kw } = o;
    super(mobject, kw);
    this.virtual_time = virtual_time;
    this.function = fn;
  }
  override interpolate_mobject(alpha: number): void {
    if (this.last_alpha !== undefined) {
      const dt = this.virtual_time * (this.rate_func(alpha) - this.rate_func(this.last_alpha));
      this.mobject.apply_function((p) => {
        const v = this.function(p);
        return [p[0] + dt * v[0], p[1] + dt * v[1], p[2] + dt * (v[2] ?? 0)];
      });
    }
    this.last_alpha = alpha;
  }
}

/** Moves a mobject's center along a path. */
export class MoveAlongPath extends Animation {
  declare path: VMobject;
  constructor(mobject: Mobject, path: VMobject, ...rest: unknown[]) {
    const o = pyargs(rest, ['suspend_mobject_updating'], { suspend_mobject_updating: false });
    super(mobject, o);
    this.path = path;
  }
  override interpolate_mobject(alpha: number): void {
    this.mobject.move_to(this.path.point_from_proportion(this.rate_func(alpha)));
  }
}
