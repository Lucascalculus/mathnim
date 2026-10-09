// manim/animation/rotation.py
import { OUT, PI, TAU } from '../constants';
import type { Mobject } from '../mobject/mobject';
import { pyargs } from '../utils/pyargs';
import { linear } from '../utils/rate_functions';
import type { Point3DLike } from '../utils/vector';
import { Animation } from './animation';
import { Transform } from './transform';

/** Continuous rotation (rebuilds from the starting state every frame). */
export class Rotating extends Animation {
  declare angle: number;
  declare axis: Point3DLike;
  declare about_point: Point3DLike | null;
  declare about_edge: Point3DLike | null;
  constructor(mobject: Mobject, ...rest: unknown[]) {
    const o = pyargs(rest, ['angle', 'axis', 'about_point', 'about_edge', 'run_time', 'rate_func'], {
      angle: TAU, axis: OUT, about_point: null, about_edge: null, run_time: 5, rate_func: linear,
    });
    const { angle, axis, about_point, about_edge, ...kw } = o;
    super(mobject, kw);
    Object.assign(this, { angle, axis, about_point, about_edge });
  }
  override interpolate_mobject(alpha: number): void {
    this.mobject.become(this.starting_mobject);
    this.mobject.rotate(this.rate_func(alpha) * this.angle, { axis: this.axis, about_point: this.about_point, about_edge: this.about_edge });
  }
}

/** Rotates along a circular arc to the rotated target. */
export class Rotate extends Transform {
  declare angle: number;
  declare axis: Point3DLike;
  declare about_edge: Point3DLike | null;
  declare about_point: Point3DLike;
  constructor(mobject: Mobject, ...rest: unknown[]) {
    const o = pyargs(rest, ['angle', 'axis', 'about_point', 'about_edge'], { angle: PI, axis: OUT, about_point: null, about_edge: null });
    const { angle, axis, about_point, about_edge, ...kw } = o;
    if (!('path_arc' in kw)) kw.path_arc = angle;
    if (!('path_arc_axis' in kw)) kw.path_arc_axis = axis;
    const ap = about_point ?? mobject.get_center();
    super(mobject, { ...kw, path_arc_centers: ap });
    Object.assign(this, { angle, axis, about_edge, about_point: ap });
  }
  override create_target(): Mobject {
    const t = this.mobject.copy();
    t.rotate(this.angle, { axis: this.axis, about_point: this.about_point, about_edge: this.about_edge });
    return t;
  }
}
