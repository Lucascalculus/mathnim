// manim/mobject/geometry/tips.py
//
// web: manim's tips use multiple inheritance (ArrowTip + Triangle/Circle/Square).
// Here make_arrow_tip() installs ArrowTip's properties on each tip class, and
// `x instanceof ArrowTip` still works.
// Note that `tip.length` is the tip's length (as in manim), not len(tip).
import { DEFAULT_ARROW_TIP_LENGTH, PI } from '../../constants';
import { getPoint } from '../../utils/points';
import { pyargs } from '../../utils/pyargs';
import { register } from '../../utils/registry';
import { angle_of_vector } from '../../utils/space_ops';
import { norm, sub, type Point3D } from '../../utils/vector';
import { VMobject } from '../types/vectorized_mobject';
import { Circle } from './arc';
import { Square, Triangle } from './polygram';

const IS_TIP = Symbol('ArrowTip');

/** Properties every arrow tip has. */
export interface ArrowTipProps {
  /** Midpoint of the tip's base. */
  readonly base: Point3D;
  /** The point of the tip. */
  readonly tip_point: Point3D;
  readonly vector: Point3D;
  readonly tip_angle: number;
}
const TIP_PROPS: PropertyDescriptorMap = {
  base: { get(this: VMobject) { return this.point_from_proportion(0.5); }, configurable: true },
  tip_point: { get(this: VMobject) { return getPoint(this.points, 0); }, configurable: true },
  vector: { get(this: any) { return sub(this.tip_point, this.base); }, configurable: true },
  tip_angle: { get(this: any) { return angle_of_vector(this.vector); }, configurable: true },
  length: { get(this: any) { return norm(this.vector); }, configurable: true },
};
/** Give a VMobject class the ArrowTip properties (manim: inherit from ArrowTip). */
export function make_arrow_tip(cls: Function): void {
  for (const [k, d] of Object.entries(TIP_PROPS)) if (!Object.prototype.hasOwnProperty.call(cls.prototype, k)) Object.defineProperty(cls.prototype, k, d);
  cls.prototype[IS_TIP] = true;
}

/** Base class of arrow tips; subclasses give the shape. */
export abstract class ArrowTip extends VMobject {
  static override [Symbol.hasInstance](x: unknown): boolean {
    if (this === ArrowTip) return !!x && (x as any)[IS_TIP] === true;
    return Function.prototype[Symbol.hasInstance].call(this, x);
  }
}
export interface ArrowTip extends ArrowTipProps {}
make_arrow_tip(ArrowTip);

/** A "stealth" (concave, swept-back) arrow tip. */
export class StealthTip extends VMobject {
  declare start_angle: number;
  constructor(...args: unknown[]) {
    const o = pyargs(args, ['fill_opacity', 'stroke_width', 'length', 'start_angle'], { fill_opacity: 1, stroke_width: 3, length: DEFAULT_ARROW_TIP_LENGTH / 2, start_angle: PI });
    const { length, start_angle, ...rest } = o;
    super(rest);
    this.start_angle = start_angle;
    this.set_points_as_corners([[2, 0, 0], [-1.2, 1.6, 0], [0, 0, 0], [-1.2, -1.6, 0], [2, 0, 0]]);
    this.scale(length / this.length);
  }
  override get length(): number {
    return norm(this.vector) * 1.6;
  }
}
export interface StealthTip extends ArrowTipProps {}
make_arrow_tip(StealthTip);

/** A triangular tip (outline). */
export class ArrowTriangleTip extends Triangle {
  constructor(...args: unknown[]) {
    const o = pyargs(args, ['fill_opacity', 'stroke_width', 'length', 'width', 'start_angle'], {
      fill_opacity: 0, stroke_width: 3, length: DEFAULT_ARROW_TIP_LENGTH, width: DEFAULT_ARROW_TIP_LENGTH, start_angle: PI,
    });
    const { length, width, ...rest } = o;
    super(rest);
    this.width = width;
    this.stretch_to_fit_width(length);
    this.stretch_to_fit_height(width);
  }
}
export interface ArrowTriangleTip extends ArrowTipProps {}
make_arrow_tip(ArrowTriangleTip);

/** A filled triangular tip (manim's default arrow tip). */
export class ArrowTriangleFilledTip extends ArrowTriangleTip {
  constructor(...args: unknown[]) {
    super(pyargs(args, ['fill_opacity', 'stroke_width'], { fill_opacity: 1, stroke_width: 0 }));
  }
}

/** A circular tip (outline). */
export class ArrowCircleTip extends Circle {
  declare start_angle: number;
  constructor(...args: unknown[]) {
    const o = pyargs(args, ['fill_opacity', 'stroke_width', 'length', 'start_angle'], { fill_opacity: 0, stroke_width: 3, length: DEFAULT_ARROW_TIP_LENGTH, start_angle: PI });
    const { length, start_angle, ...rest } = o;
    super(rest);
    this.start_angle = start_angle;
    this.width = length;
    this.stretch_to_fit_height(length);
  }
}
export interface ArrowCircleTip extends ArrowTipProps {}
make_arrow_tip(ArrowCircleTip);

/** A filled circular tip. */
export class ArrowCircleFilledTip extends ArrowCircleTip {
  constructor(...args: unknown[]) {
    super(pyargs(args, ['fill_opacity', 'stroke_width'], { fill_opacity: 1, stroke_width: 0 }));
  }
}

/** A square tip (outline). */
export class ArrowSquareTip extends Square {
  constructor(...args: unknown[]) {
    const o = pyargs(args, ['fill_opacity', 'stroke_width', 'length', 'start_angle'], { fill_opacity: 0, stroke_width: 3, length: DEFAULT_ARROW_TIP_LENGTH, start_angle: PI });
    const { length, start_angle, ...rest } = o;
    super({ ...rest, side_length: length });
    this.start_angle = start_angle;
    this.width = length;
    this.stretch_to_fit_height(length);
  }
}
export interface ArrowSquareTip extends ArrowTipProps {}
make_arrow_tip(ArrowSquareTip);

/** A filled square tip. */
export class ArrowSquareFilledTip extends ArrowSquareTip {
  constructor(...args: unknown[]) {
    super(pyargs(args, ['fill_opacity', 'stroke_width'], { fill_opacity: 1, stroke_width: 0 }));
  }
}

register({ ArrowTip, ArrowTriangleFilledTip, ArrowTriangleTip });
