// manim/animation/updaters/update.py
import type { Mobject } from '../../mobject/mobject';
import { pyargs } from '../../utils/pyargs';
import { sub, type Point3D } from '../../utils/vector';
import { Animation } from '../animation';

/** Calls update_function(mobject) every frame of the animation. */
export class UpdateFromFunc extends Animation {
  declare update_function: (m: any, alpha?: number) => unknown;
  constructor(mobject: Mobject, update_function: (m: any, alpha?: number) => unknown, ...rest: unknown[]) {
    const o = pyargs(rest, ['suspend_mobject_updating'], { suspend_mobject_updating: false });
    super(mobject, o);
    this.update_function = update_function;
  }
  override interpolate_mobject(_alpha: number): void {
    this.update_function(this.mobject);
  }
}

/** Calls update_function(mobject, rate_func(alpha)). */
export class UpdateFromAlphaFunc extends UpdateFromFunc {
  override interpolate_mobject(alpha: number): void {
    this.update_function(this.mobject, this.rate_func(alpha));
  }
}

export class MaintainPositionRelativeTo extends Animation {
  declare tracked_mobject: Mobject;
  declare diff: Point3D;
  constructor(mobject: Mobject, tracked_mobject: Mobject, ...rest: unknown[]) {
    super(mobject, ...rest);
    this.tracked_mobject = tracked_mobject;
    this.diff = sub(mobject.get_center(), tracked_mobject.get_center());
  }
  override interpolate_mobject(_alpha: number): void {
    const t = this.tracked_mobject.get_center(), l = this.mobject.get_center();
    this.mobject.shift([t[0] - l[0] + this.diff[0], t[1] - l[1] + this.diff[1], t[2] - l[2] + this.diff[2]]);
  }
}
