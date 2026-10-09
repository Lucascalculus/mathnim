// manim/mobject/geometry/line.py
import {
  DEFAULT_DASH_LENGTH, DEFAULT_MOBJECT_TO_MOBJECT_BUFFER, DEGREES, LARGE_BUFF, LEFT, MED_SMALL_BUFF, ORIGIN, RIGHT, UP,
} from '../../constants';
import { WHITE } from '../../utils/color/manim_colors';
import { getPoint } from '../../utils/points';
import { pyargs, starArgs, type Kwargs } from '../../utils/pyargs';
import { register, registry } from '../../utils/registry';
import { angle_of_vector, line_intersection, normalize } from '../../utils/space_ops';
import { add, cross, dot, mul, neg, norm, sub, to3, type Point3D, type Point3DLike } from '../../utils/vector';
import { Mobject } from '../mobject';
import { DashedVMobject, VGroup, VMobject } from '../types/vectorized_mobject';
import { Arc, ArcBetweenPoints, Dot, TipableVMobject } from './arc';
import { ArrowTriangleFilledTip } from './tips';

/** A straight line (or an arc when `path_arc` is set) between two points or mobjects. */
export class Line extends TipableVMobject {
  declare buff: number;
  declare path_arc: number;
  declare start: Point3D;
  declare end: Point3D;

  constructor(...args: unknown[]) {
    super(pyargs(args, ['start', 'end', 'buff', 'path_arc'], { start: LEFT, end: RIGHT, buff: 0, path_arc: 0 }));
  }
  protected override _init_attrs(kw: Kwargs): void {
    this.dim = 3;
    this.buff = kw.buff ?? 0;
    this.path_arc = kw.path_arc ?? 0;
    this._set_start_and_end_attrs(kw.start ?? LEFT, kw.end ?? RIGHT);
    super._init_attrs(kw);
  }
  override generate_points(): this {
    return this.set_points_by_ends(this.start, this.end, this.buff, this.path_arc);
  }
  set_points_by_ends(start: Point3DLike | Mobject, end: Point3DLike | Mobject, buff = 0, path_arc = 0): this {
    this._set_start_and_end_attrs(start, end);
    if (path_arc) {
      const arc = new ArcBetweenPoints(this.start, this.end, { angle: this.path_arc });
      this.set_points(arc.points);
    } else this.set_points_as_corners([this.start, this.end]);
    this._account_for_buff(buff);
    return this;
  }
  init_points(): this {
    return this.generate_points();
  }
  protected _account_for_buff(buff: number): void {
    if (buff <= 0) return;
    const length = this.path_arc === 0 ? this.get_length() : this.get_arc_length();
    if (length < 2 * buff) return;
    const p = buff / length;
    this.pointwise_become_partial(this, p, 1 - p);
  }
  protected _set_start_and_end_attrs(start: Point3DLike | Mobject, end: Point3DLike | Mobject): void {
    const rough_start = this._pointify(start);
    const rough_end = this._pointify(end);
    const v = normalize(sub(rough_end, rough_start));
    this.start = this._pointify(start, v);
    this.end = this._pointify(end, neg(v));
  }
  protected _pointify(mob_or_point: Mobject | Point3DLike, direction: Point3DLike | null = null): Point3D {
    if (mob_or_point instanceof Mobject) return direction === null ? mob_or_point.get_center() : mob_or_point.get_boundary_point(direction);
    return to3(mob_or_point);
  }
  set_path_arc(new_value: number): this {
    this.path_arc = new_value;
    return this.init_points();
  }
  override put_start_and_end_on(start: Point3DLike, end: Point3DLike): this {
    const [cs, ce] = this.get_start_and_end();
    if (cs.every((x, i) => x === ce[i])) {
      this.start = to3(start);
      this.end = to3(end);
      this.generate_points();
    }
    return super.put_start_and_end_on(start, end);
  }
  get_vector(): Point3D {
    return sub(this.get_end(), this.get_start());
  }
  get_unit_vector(): Point3D {
    return normalize(this.get_vector());
  }
  get_angle(): number {
    return angle_of_vector(this.get_vector());
  }
  get_projection(point: Point3DLike): Point3D {
    const start = this.get_start();
    const u = normalize(sub(this.get_end(), start));
    return add(start, mul(dot(sub(point, start), u), u));
  }
  get_slope(): number {
    return Math.tan(this.get_angle());
  }
  set_angle(angle: number, about_point: Point3DLike | null = null): this {
    return this.rotate(angle - this.get_angle(), { about_point: about_point ?? this.get_start() });
  }
  set_length(length: number): this {
    return this.scale(length / this.get_length());
  }
}

/** A dashed line. */
export class DashedLine extends Line {
  declare dash_length: number;
  declare dashed_ratio: number;
  constructor(...args: unknown[]) {
    const [pos, kw] = starArgs(args);
    const { dash_length = DEFAULT_DASH_LENGTH, dashed_ratio = 0.5, ...rest } = kw;
    super(...pos, rest);
    this.dash_length = dash_length;
    this.dashed_ratio = dashed_ratio;
    const dashes = new DashedVMobject(this, { num_dashes: this._calculate_num_dashes(), dashed_ratio });
    this.clear_points();
    this.add(...dashes.submobjects);
  }
  protected _calculate_num_dashes(): number {
    return Math.max(2, Math.trunc(Math.ceil((this.get_length() / this.dash_length) * this.dashed_ratio)));
  }
  override get_start(): Point3D {
    return this.submobjects.length > 0 ? this.submobjects[0].get_start() : super.get_start();
  }
  override get_end(): Point3D {
    return this.submobjects.length > 0 ? this.submobjects[this.submobjects.length - 1].get_end() : super.get_end();
  }
  override get_first_handle(): Point3D {
    return getPoint(this.submobjects[0].points, 1);
  }
  override get_last_handle(): Point3D {
    return getPoint(this.submobjects[this.submobjects.length - 1].points, 2);
  }
}

/** The tangent to `vmob` at proportion `alpha`. */
export class TangentLine extends Line {
  declare d_alpha: number;
  constructor(...args: unknown[]) {
    const o = pyargs(args, ['vmob', 'alpha', 'length', 'd_alpha'], { length: 1, d_alpha: 1e-6 });
    const { vmob, alpha, length, d_alpha, ...rest } = o;
    const clip = (x: number) => Math.min(1, Math.max(0, x));
    super(vmob.point_from_proportion(clip(alpha - d_alpha)), vmob.point_from_proportion(clip(alpha + d_alpha)), rest);
    // manim stores the requested length in `self.length` (shadowing len()).
    Object.defineProperty(this, 'length', { value: length, writable: true, configurable: true, enumerable: true });
    this.d_alpha = d_alpha;
    this.scale(length / this.get_length());
  }
}

/** Two perpendicular segments (a right-angle mark). */
export class Elbow extends VMobject {
  declare angle: number;
  constructor(...args: unknown[]) {
    const o = pyargs(args, ['width', 'angle'], { width: 0.2, angle: 0 });
    const { width, angle, ...rest } = o;
    super(rest);
    this.angle = angle;
    this.set_points_as_corners([UP, add(UP, RIGHT), RIGHT]);
    this.scale_to_fit_width(width, { about_point: ORIGIN });
    this.rotate(this.angle, { about_point: ORIGIN });
  }
}

/** A line with an arrow tip; stroke and tip shrink for short arrows. */
export class Arrow extends Line {
  declare max_tip_length_to_length_ratio: number;
  declare max_stroke_width_to_length_ratio: number;
  declare initial_stroke_width: number;
  constructor(...args: unknown[]) {
    const [pos, kw] = starArgs(args);
    const {
      stroke_width = 6, buff = MED_SMALL_BUFF, max_tip_length_to_length_ratio = 0.25, max_stroke_width_to_length_ratio = 5,
      tip_shape = ArrowTriangleFilledTip, ...rest
    } = kw;
    super(...pos, { ...rest, buff, stroke_width, max_tip_length_to_length_ratio, max_stroke_width_to_length_ratio });
    this.initial_stroke_width = this.stroke_width;
    this.add_tip({ tip_shape });
    this._set_stroke_width_from_length();
  }
  protected override _init_attrs(kw: Kwargs): void {
    this.max_tip_length_to_length_ratio = kw.max_tip_length_to_length_ratio ?? 0.25;
    this.max_stroke_width_to_length_ratio = kw.max_stroke_width_to_length_ratio ?? 5;
    super._init_attrs(kw);
  }
  /** Scales the arrow; tips keep their size unless `scale_tips` is true. */
  override scale(factor: number, ...rest: unknown[]): this {
    if (this.get_length() === 0) return this;
    const { scale_tips = false, ...kw } = pyargs(rest, ['scale_tips']);
    if (scale_tips) {
      super.scale(factor, kw);
      this._set_stroke_width_from_length();
      return this;
    }
    const has_tip = this.has_tip();
    const has_start_tip = this.has_start_tip();
    let old_tips: VGroup | null = null;
    if (has_tip || has_start_tip) old_tips = this.pop_tips();
    super.scale(factor, kw);
    this._set_stroke_width_from_length();
    if (has_tip) this.add_tip({ tip: old_tips!.submobjects[0] });
    if (has_start_tip) this.add_tip({ tip: old_tips!.submobjects[1], at_start: true });
    return this;
  }
  get_normal_vector(): Point3D {
    const [p0, p1, p2] = this.tip!.get_start_anchors().slice(0, 3);
    return normalize(cross(sub(p2, p1), sub(p1, p0)));
  }
  reset_normal_vector(): this {
    this.normal_vector = this.get_normal_vector();
    return this;
  }
  override get_default_tip_length(): number {
    return Math.min(this.tip_length, this.max_tip_length_to_length_ratio * this.get_length());
  }
  protected _set_stroke_width_from_length(): this {
    this.set_stroke({ width: Math.min(this.initial_stroke_width, this.max_stroke_width_to_length_ratio * this.get_length()), family: false });
    return this;
  }
}

/** An arrow from the origin (buff 0). */
export class Vector extends Arrow {
  constructor(...args: unknown[]) {
    const o = pyargs(args, ['direction', 'buff'], { direction: RIGHT, buff: 0 });
    const { direction, buff, ...rest } = o;
    super(ORIGIN, to3(direction), { ...rest, buff });
  }
  /** A column-matrix label with the vector's coordinates. */
  coordinate_label(...args: unknown[]): Mobject {
    const o = pyargs(args, ['integer_labels', 'n_dim', 'color'], { integer_labels: true, n_dim: 2, color: null });
    const { integer_labels, n_dim, color, ...kw } = o;
    let v: number[] = this.get_end();
    if (integer_labels) v = v.map((x) => Math.round(x));
    const label: Mobject = new registry.Matrix(v.slice(0, n_dim).map((x) => [x]), kw);
    label.scale(LARGE_BUFF - 0.2);
    let shift_dir = this.get_end();
    if (shift_dir[0] >= 0) shift_dir = sub(shift_dir, add(label.get_left(), mul(DEFAULT_MOBJECT_TO_MOBJECT_BUFFER, LEFT)));
    else shift_dir = sub(shift_dir, add(label.get_right(), mul(DEFAULT_MOBJECT_TO_MOBJECT_BUFFER, RIGHT)));
    label.shift(shift_dir);
    if (color !== null) label.set_color(color);
    return label;
  }
}

/** An arrow with tips at both ends. */
export class DoubleArrow extends Arrow {
  constructor(...args: unknown[]) {
    const [pos, kw] = starArgs(args);
    const { tip_shape_end, tip_shape_start = ArrowTriangleFilledTip, ...rest } = kw;
    if (tip_shape_end !== undefined) rest.tip_shape = tip_shape_end;
    super(...pos, rest);
    this.add_tip({ at_start: true, tip_shape: tip_shape_start });
  }
}

/** The angle between two lines, drawn as an arc (or an elbow). */
export class Angle extends VMobject {
  declare lines: [Line, Line];
  declare quadrant: [number, number];
  declare dot_distance: number;
  declare elbow: boolean;
  declare angle_value: number;
  declare radius?: number;
  declare dot_radius?: number;
  constructor(...args: unknown[]) {
    const o = pyargs(args, ['line1', 'line2', 'radius', 'quadrant', 'other_angle', 'dot', 'dot_radius', 'dot_distance', 'dot_color', 'elbow'], {
      radius: null, quadrant: [1, 1], other_angle: false, dot: false, dot_radius: null, dot_distance: 0.55, dot_color: WHITE, elbow: false,
    });
    const { line1, line2, quadrant, other_angle, dot: withDot, dot_distance, dot_color, elbow, ...kwargs } = o;
    let { radius, dot_radius } = o;
    delete kwargs.radius;
    delete kwargs.dot_radius;
    super(kwargs);
    this.lines = [line1, line2];
    this.quadrant = quadrant;
    this.dot_distance = dot_distance;
    this.elbow = elbow;
    let inter: Point3D;
    try {
      inter = line_intersection([line1.get_start(), line1.get_end()], [line2.get_start(), line2.get_end()]);
    } catch (e) {
      const inPlane = [line1, line2].every((l: Line) => l.get_start()[2] === 0 && l.get_end()[2] === 0);
      const parallel = cross(line1.get_vector(), line2.get_vector())[2] === 0;
      if (!(inPlane && parallel)) throw e;
      this.angle_value = 0.0;
      return;
    }
    if (radius == null) {
      const d1 = norm(sub(quadrant[0] === 1 ? line1.get_end() : line1.get_start(), inter));
      const d2 = norm(sub(quadrant[1] === 1 ? line2.get_end() : line2.get_start(), inter));
      radius = Math.min(d1, d2) < 0.6 ? (2 / 3) * Math.min(d1, d2) : 0.4;
    } else this.radius = radius;
    const u1 = line1.get_unit_vector(), u2 = line2.get_unit_vector();
    const a1 = add(inter, mul(quadrant[0] * radius, u1));
    const a2 = add(inter, mul(quadrant[1] * radius, u2));
    let angle_mobject: VMobject;
    if (elbow) {
      const mid = add(inter, mul(quadrant[0] * radius, u1), mul(quadrant[1] * radius, u2));
      angle_mobject = new Elbow(kwargs);
      angle_mobject.set_points_as_corners([a1, mid, a2]);
    } else {
      const ang1 = angle_of_vector(sub(a1, inter));
      const ang2 = angle_of_vector(sub(a2, inter));
      let angle_fin: number;
      if (!other_angle) angle_fin = ang2 > ang1 ? ang2 - ang1 : 2 * Math.PI - (ang1 - ang2);
      else angle_fin = ang2 < ang1 ? -ang1 + ang2 : -2 * Math.PI + (ang2 - ang1);
      this.angle_value = angle_fin;
      angle_mobject = new Arc({ ...kwargs, radius, angle: this.angle_value, start_angle: ang1, arc_center: inter });
      if (withDot) {
        if (dot_radius == null) dot_radius = radius / 10;
        else this.dot_radius = dot_radius;
        const right_dot = new Dot(ORIGIN, { radius: dot_radius, color: dot_color });
        const c = sub(angle_mobject.get_center(), inter);
        right_dot.move_to(add(inter, mul((radius * dot_distance) / norm(c), c)));
        this.add(right_dot);
      }
    }
    this.set_points(angle_mobject.points);
  }
  get_lines(): VGroup {
    return new VGroup(...this.lines);
  }
  get_value(degrees = false): number {
    return degrees ? this.angle_value / DEGREES : this.angle_value;
  }
  static from_three_points(A: Point3DLike, B: Point3DLike, C: Point3DLike, kw: Kwargs = {}): Angle {
    return new Angle(new Line(B, A), new Line(B, C), kw);
  }
}

/** A right-angle mark (elbow) between two lines. */
export class RightAngle extends Angle {
  constructor(...args: unknown[]) {
    const o = pyargs(args, ['line1', 'line2', 'length'], { length: null });
    const { line1, line2, length, ...rest } = o;
    super(line1, line2, { ...rest, radius: length, elbow: true });
  }
}

register({ Line, Arrow, DashedLine, Vector });
