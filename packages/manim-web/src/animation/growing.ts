// manim/animation/growing.py
import { PI } from '../constants';
import type { Mobject } from '../mobject/mobject';
import { spiral_path } from '../utils/paths';
import { pyargs, type Kwargs } from '../utils/pyargs';
import { to3, type Point3D, type Point3DLike } from '../utils/vector';
import { Transform } from './transform';

export class GrowFromPoint extends Transform {
  declare point: Point3D;
  declare point_color: any;
  constructor(mobject: Mobject, point: Point3DLike, ...rest: unknown[]) {
    const o = pyargs(rest, ['point_color'], { point_color: null });
    const { point_color, ...kw } = o;
    super(mobject, { ...kw, introducer: true });
    this.point = to3(point);
    this.point_color = point_color;
  }
  override create_target(): Mobject {
    return this.mobject;
  }
  override create_starting_mobject(): Mobject {
    const start = super.create_starting_mobject();
    start.scale(0);
    start.move_to(this.point);
    if (this.point_color) start.set_color(this.point_color);
    return start;
  }
}

export class GrowFromCenter extends GrowFromPoint {
  constructor(mobject: Mobject, ...rest: unknown[]) {
    const o = pyargs(rest, ['point_color'], { point_color: null });
    super(mobject, mobject.get_center(), o);
  }
}

export class GrowFromEdge extends GrowFromPoint {
  constructor(mobject: Mobject, edge: Point3DLike, ...rest: unknown[]) {
    const o = pyargs(rest, ['point_color'], { point_color: null });
    super(mobject, mobject.get_critical_point(edge), o);
  }
}

export class GrowArrow extends GrowFromPoint {
  constructor(arrow: Mobject, ...rest: unknown[]) {
    const o = pyargs(rest, ['point_color'], { point_color: null });
    super(arrow, arrow.get_start(), o);
  }
  override create_starting_mobject(): Mobject {
    const start = this.mobject.copy() as any;
    start.scale(0, { scale_tips: true, about_point: this.point });
    if (this.point_color) start.set_color(this.point_color);
    return start;
  }
}

export class SpinInFromNothing extends GrowFromCenter {
  declare angle: number;
  constructor(mobject: Mobject, ...rest: unknown[]) {
    const o = pyargs(rest, ['angle', 'point_color'], { angle: PI / 2, point_color: null });
    const { angle, ...kw } = o;
    super(mobject, { ...kw, path_func: spiral_path(angle) });
    this.angle = angle;
  }
}

export type { Kwargs };
