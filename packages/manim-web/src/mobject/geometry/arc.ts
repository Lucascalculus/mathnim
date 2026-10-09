// manim/mobject/geometry/arc.py
import { DEFAULT_ARROW_TIP_LENGTH, DEFAULT_DOT_RADIUS, LEFT, ORIGIN, OUT, PI, RIGHT, SMALL_BUFF, TAU } from '../../constants';
import { BLACK, BLUE, RED, WHITE } from '../../utils/color/manim_colors';
import { adjacent_pairs } from '../../utils/iterables';
import { getPoint } from '../../utils/points';
import { pyargs, starArgs, type Kwargs } from '../../utils/pyargs';
import { register, registry } from '../../utils/registry';
import { angle_between_vectors, angle_of_vector, cartesian_to_spherical, line_intersection, perpendicular_bisector, rotate_vector } from '../../utils/space_ops';
import { add, mul, norm, sub, to3, type Point3D, type Point3DLike } from '../../utils/vector';
import { VGroup, VMobject } from '../types/vectorized_mobject';

/** What TipableVMobject needs from an arrow tip (see tips.ts). */
export interface TipLike extends VMobject {
  readonly base: Point3D;
  readonly tip_point: Point3D;
  readonly tip_angle: number;
}

const linspace = (a: number, b: number, n: number): number[] =>
  n === 1 ? [a] : Array.from({ length: n }, (_, i) => (i === n - 1 ? b : a + ((b - a) * i) / (n - 1)));
const pmod = (a: number, m: number) => ((a % m) + m) % m;
/** `cls is ArrowTriangleFilledTip` that also sees through callable() wrappers. */
const sameClass = (a: any, b: any) => a === b || (a && b && a.prototype === b.prototype);

/** A VMobject that can carry arrow tips at its start and/or end. */
export class TipableVMobject extends VMobject {
  declare tip_length: number;
  declare normal_vector: Point3D;
  declare tip_style: Kwargs;
  declare tip?: TipLike;
  declare start_tip?: TipLike;
  declare _init_positioning_axis?: Point3D;

  constructor(...args: unknown[]) {
    super(pyargs(args, ['tip_length', 'normal_vector', 'tip_style'], { tip_length: DEFAULT_ARROW_TIP_LENGTH, normal_vector: OUT, tip_style: null }));
  }
  protected override _init_attrs(kw: Kwargs): void {
    this.tip_length = kw.tip_length ?? DEFAULT_ARROW_TIP_LENGTH;
    this.normal_vector = to3(kw.normal_vector ?? OUT);
    this.tip_style = kw.tip_style ?? {};
    super._init_attrs(kw);
  }

  add_tip(...args: unknown[]): this {
    const o = pyargs(args, ['tip', 'tip_shape', 'tip_length', 'tip_width', 'at_start'], { tip: null, tip_shape: null, tip_length: null, tip_width: null, at_start: false });
    let tip: TipLike = o.tip;
    if (tip == null) tip = this.create_tip(o.tip_shape, o.tip_length, o.tip_width, o.at_start);
    else this.position_tip(tip, o.at_start);
    this.reset_endpoints_based_on_tip(tip, o.at_start);
    this.assign_tip_attr(tip, o.at_start);
    this.add(tip);
    return this;
  }
  create_tip(tip_shape: any = null, tip_length: number | null = null, tip_width: number | null = null, at_start = false): TipLike {
    const tip = this.get_unpositioned_tip(tip_shape, tip_length, tip_width);
    this.position_tip(tip, at_start);
    return tip;
  }
  get_unpositioned_tip(tip_shape: any = null, tip_length: number | null = null, tip_width: number | null = null): TipLike {
    const Filled = registry.ArrowTriangleFilledTip;
    const style: Kwargs = {};
    if (tip_shape == null) tip_shape = Filled;
    if (sameClass(tip_shape, Filled)) style.width = tip_width ?? this.get_default_tip_length();
    if (tip_length == null) tip_length = this.get_default_tip_length();
    const color = this.get_color();
    Object.assign(style, { fill_color: color, stroke_color: color }, this.tip_style);
    return new tip_shape({ length: tip_length, ...style });
  }
  position_tip(tip: TipLike, at_start = false): TipLike {
    let anchor: Point3D, handle: Point3D;
    if (at_start) {
      anchor = this.get_start();
      handle = this.get_first_handle();
    } else {
      handle = this.get_last_handle();
      anchor = this.get_end();
    }
    const angles = cartesian_to_spherical(sub(handle, anchor));
    tip.rotate(angles[1] - PI - tip.tip_angle);
    if (this._init_positioning_axis === undefined) {
      const axis: Point3D = [Math.sin(angles[1]), -Math.cos(angles[1]), 0];
      tip.rotate(-angles[2] + PI / 2, { axis });
      this._init_positioning_axis = axis;
    }
    tip.shift(sub(anchor, tip.tip_point));
    return tip;
  }
  reset_endpoints_based_on_tip(tip: TipLike, at_start: boolean): this {
    if (this.get_length() === 0) return this;
    if (at_start) this.put_start_and_end_on(tip.base, this.get_end());
    else this.put_start_and_end_on(this.get_start(), tip.base);
    return this;
  }
  assign_tip_attr(tip: TipLike, at_start: boolean): this {
    if (at_start) this.start_tip = tip;
    else this.tip = tip;
    return this;
  }
  has_tip(): boolean {
    return this.tip !== undefined && this.submobjects.includes(this.tip);
  }
  has_start_tip(): boolean {
    return this.start_tip !== undefined && this.submobjects.includes(this.start_tip);
  }
  pop_tips(): VGroup {
    const [start, end] = this.get_start_and_end();
    const result = new (this.get_group_class())() as VGroup;
    if (this.has_tip()) {
      result.add(this.tip!);
      this.remove(this.tip!);
    }
    if (this.has_start_tip()) {
      result.add(this.start_tip!);
      this.remove(this.start_tip!);
    }
    if (result.submobjects.length) this.put_start_and_end_on(start, end);
    return result;
  }
  get_tips(): VGroup {
    const result = new (this.get_group_class())() as VGroup;
    if (this.tip !== undefined) result.add(this.tip);
    if (this.start_tip !== undefined) result.add(this.start_tip);
    return result;
  }
  get_tip(): VMobject {
    const tips = this.get_tips();
    if (tips.submobjects.length === 0) throw new Error('tip not found');
    return tips.submobjects[0];
  }
  get_default_tip_length(): number {
    return this.tip_length;
  }
  get_first_handle(): Point3D {
    return getPoint(this.points, 1);
  }
  get_last_handle(): Point3D {
    return getPoint(this.points, this.points.length / 3 - 2);
  }
  override get_end(): Point3D {
    return this.has_tip() ? this.tip!.get_start() : super.get_end();
  }
  override get_start(): Point3D {
    return this.has_start_tip() ? this.start_tip!.get_start() : super.get_start();
  }
  get_length(): number {
    const [start, end] = this.get_start_and_end();
    return norm(sub(start, end));
  }
}

/** A circular arc (cubic Beziers, `num_components` anchors). */
export class Arc extends TipableVMobject {
  declare radius: number;
  declare num_components: number;
  declare arc_center: Point3D;
  declare start_angle: number;
  declare angle: number;
  declare _failed_to_get_center: boolean;

  constructor(...args: unknown[]) {
    const o = pyargs(args, ['radius', 'start_angle', 'angle', 'num_components', 'arc_center'], { radius: 1.0, start_angle: 0, angle: TAU / 4, num_components: 9, arc_center: ORIGIN });
    if (o.radius == null) o.radius = 1.0;
    super(o);
  }
  protected override _init_attrs(kw: Kwargs): void {
    this.radius = kw.radius ?? 1.0;
    this.num_components = kw.num_components ?? 9;
    this.arc_center = to3(kw.arc_center ?? ORIGIN);
    this.start_angle = kw.start_angle ?? 0;
    this.angle = kw.angle ?? TAU / 4;
    this._failed_to_get_center = false;
    super._init_attrs(kw);
  }
  override generate_points(): this {
    this._set_pre_positioned_points();
    this.scale(this.radius, { about_point: ORIGIN });
    this.shift(this.arc_center);
    return this;
  }
  init_points(): this {
    return this.generate_points();
  }
  protected _set_pre_positioned_points(): void {
    const n = this.num_components;
    const anchors: Point3D[] = linspace(this.start_angle, this.start_angle + this.angle, n).map((a) => [Math.cos(a), Math.sin(a), 0]);
    const d_theta = this.angle / (n - 1.0);
    const tangents: Point3D[] = anchors.map((a) => [-a[1], a[0], 0]);
    const factor = (4 / 3) * Math.tan(d_theta / 4);
    const h1 = anchors.slice(0, -1).map((a, i) => add(a, mul(factor, tangents[i])));
    const h2 = anchors.slice(1).map((a, i) => sub(a, mul(factor, tangents[i + 1])));
    this.set_anchors_and_handles(anchors.slice(0, -1), h1, h2, anchors.slice(1));
  }
  get_arc_center(warning = true): Point3D {
    const [a1, h1, h2, a2] = [0, 1, 2, 3].map((i) => getPoint(this.points, i));
    if (a1.every((x, i) => x === a2[i])) return a1;
    const n1 = rotate_vector(sub(h1, a1), TAU / 4);
    const n2 = rotate_vector(sub(h2, a2), TAU / 4);
    try {
      return line_intersection([a1, add(a1, n1)], [a2, add(a2, n2)]);
    } catch {
      if (warning) console.warn("Can't find Arc center, using ORIGIN instead");
      this._failed_to_get_center = true;
      return [0, 0, 0];
    }
  }
  move_arc_center_to(point: Point3DLike): this {
    return this.shift(sub(point, this.get_arc_center()));
  }
  stop_angle(): number {
    return pmod(angle_of_vector(sub(getPoint(this.points, this.points.length / 3 - 1), this.get_arc_center())), TAU);
  }
}

/** An arc from `start` to `end` subtending `angle` (or with a given `radius`). */
export class ArcBetweenPoints extends Arc {
  constructor(...args: unknown[]) {
    const o = pyargs(args, ['start', 'end', 'angle', 'radius'], { angle: TAU / 4, radius: null });
    let { start, end, angle, radius, ...rest } = o;
    if (radius != null) {
      let sign = 2;
      if (radius < 0) {
        sign = -2;
        radius *= -1;
      }
      const halfdist = norm(sub(start, end)) / 2;
      if (radius < halfdist) throw new Error('ArcBetweenPoints called with a radius that is smaller than half the distance between the points.');
      const arc_height = radius - Math.sqrt(radius ** 2 - halfdist ** 2);
      angle = Math.acos((radius - arc_height) / radius) * sign;
    }
    super({ ...rest, radius, angle });
    if (angle === 0) this.set_points_as_corners([LEFT, RIGHT]);
    this.put_start_and_end_on(start, end);
    if (radius == null) {
      const center = this.get_arc_center(false);
      this.radius = !this._failed_to_get_center ? norm(sub(start, center)) : Infinity;
    }
  }
}

/** An arc of `radius` tangent to two lines. */
export class TangentialArc extends ArcBetweenPoints {
  declare line1: any;
  declare line2: any;
  constructor(...args: unknown[]) {
    const o = pyargs(args, ['line1', 'line2', 'radius', 'corner'], { corner: [1, 1] });
    const { line1, line2, radius, corner, ...rest } = o;
    const inter = line_intersection([line1.get_start(), line1.get_end()], [line2.get_start(), line2.get_end()]);
    const [s1, s2] = corner;
    const u1 = mul(s1, line1.get_unit_vector());
    const u2 = mul(s2, line2.get_unit_vector());
    const corner_angle = angle_between_vectors(u1, u2);
    const d = radius / Math.tan(corner_angle / 2);
    const t1 = add(inter, mul(d, u1));
    const t2 = add(inter, mul(d, u2));
    const cp = u1[0] * u2[1] - u1[1] * u2[0];
    const [start, end] = cp < 0 ? [t1, t2] : [t2, t1];
    super({ ...rest, start, end, radius });
    this.line1 = line1;
    this.line2 = line2;
  }
}

/** An arc with an arrow tip at its end. */
export class CurvedArrow extends ArcBetweenPoints {
  constructor(...args: unknown[]) {
    const o = pyargs(args, ['start_point', 'end_point']);
    const { start_point, end_point, tip_shape = registry.ArrowTriangleFilledTip, ...rest } = o;
    super(start_point, end_point, rest);
    this.add_tip({ tip_shape });
  }
}

/** An arc with arrow tips at both ends. */
export class CurvedDoubleArrow extends CurvedArrow {
  constructor(...args: unknown[]) {
    const o = pyargs(args, ['start_point', 'end_point']);
    const { start_point, end_point, tip_shape_end, tip_shape_start = registry.ArrowTriangleFilledTip, ...rest } = o;
    if (tip_shape_end !== undefined) rest.tip_shape = tip_shape_end;
    super(start_point, end_point, rest);
    this.add_tip({ at_start: true, tip_shape: tip_shape_start });
  }
}

/** A circle (default colour RED, like manim). */
export class Circle extends Arc {
  constructor(...args: unknown[]) {
    const o = pyargs(args, ['radius', 'color'], { radius: null, color: RED });
    super({ ...o, start_angle: 0, angle: TAU });
  }
  /** Scale and move so the circle surrounds `mobject`. */
  override surround(...args: unknown[]): this {
    const o = pyargs(args, ['mobject', 'dim_to_match', 'stretch', 'buffer_factor'], { dim_to_match: 0, stretch: false, buffer_factor: 1.2 });
    this.replace(o.mobject, o.dim_to_match, o.stretch);
    this.width = Math.sqrt(o.mobject.width ** 2 + o.mobject.height ** 2);
    return this.scale(o.buffer_factor);
  }
  point_at_angle(angle: number): Point3D {
    let proportion = angle / TAU;
    proportion -= Math.floor(proportion);
    return this.point_from_proportion(proportion);
  }
  static from_three_points(p1: Point3DLike, p2: Point3DLike, p3: Point3DLike, kw: Kwargs = {}): Circle {
    const center = line_intersection(perpendicular_bisector([p1, p2]), perpendicular_bisector([p2, p3]));
    const radius = norm(sub(p1, center));
    return new Circle({ radius, ...kw }).shift(center);
  }
}

/** A small filled circle at `point`. */
export class Dot extends Circle {
  constructor(...args: unknown[]) {
    const o = pyargs(args, ['point', 'radius', 'stroke_width', 'fill_opacity', 'color'], { point: ORIGIN, radius: DEFAULT_DOT_RADIUS, stroke_width: 0, fill_opacity: 1.0, color: WHITE });
    const { point, ...rest } = o;
    super({ ...rest, arc_center: point });
  }
}

/** A dot with a bold outline, for annotations. */
export class AnnotationDot extends Dot {
  constructor(...args: unknown[]) {
    super(pyargs(args, ['radius', 'stroke_width', 'stroke_color', 'fill_color'], { radius: DEFAULT_DOT_RADIUS * 1.3, stroke_width: 5, stroke_color: WHITE, fill_color: BLUE }));
  }
}

/** A dot containing a label (MathTex string, or any mobject). */
export class LabeledDot extends Dot {
  constructor(...args: unknown[]) {
    const o = pyargs(args, ['label', 'radius', 'buff'], { radius: null, buff: SMALL_BUFF });
    const { label, buff, ...rest } = o;
    const rendered: VMobject = typeof label === 'string' ? new registry.MathTex(label, { color: BLACK }) : label;
    if (rest.radius == null) rest.radius = buff + Math.hypot(rendered.width, rendered.height) / 2;
    super(rest);
    rendered.move_to(this.get_center());
    this.add(rendered);
  }
}

/** An ellipse of the given width and height. */
export class Ellipse extends Circle {
  constructor(...args: unknown[]) {
    const o = pyargs(args, ['width', 'height'], { width: 2, height: 1 });
    const { width, height, ...rest } = o;
    super(rest);
    this.stretch_to_fit_width(width);
    this.stretch_to_fit_height(height);
  }
}

/** A sector of an annulus. */
export class AnnularSector extends Arc {
  declare inner_radius: number;
  declare outer_radius: number;
  constructor(...args: unknown[]) {
    const o = pyargs(args, ['inner_radius', 'outer_radius', 'angle', 'start_angle', 'fill_opacity', 'stroke_width', 'color'], {
      inner_radius: 1, outer_radius: 2, angle: TAU / 4, start_angle: 0, fill_opacity: 1, stroke_width: 0, color: WHITE,
    });
    super(o);
  }
  protected override _init_attrs(kw: Kwargs): void {
    this.inner_radius = kw.inner_radius;
    this.outer_radius = kw.outer_radius;
    super._init_attrs(kw);
  }
  override generate_points(): this {
    const [inner, outer] = [this.inner_radius, this.outer_radius].map((radius) => new Arc({ start_angle: this.start_angle, angle: this.angle, radius, arc_center: this.arc_center }));
    outer.reverse_points();
    this.append_points(inner.points);
    this.add_line_to(getPoint(outer.points, 0));
    this.append_points(outer.points);
    this.add_line_to(getPoint(inner.points, 0));
    return this;
  }
}

/** A circular sector (pie slice). */
export class Sector extends AnnularSector {
  constructor(...args: unknown[]) {
    const o = pyargs(args, ['radius'], { radius: 1 });
    const { radius, ...rest } = o;
    super({ ...rest, inner_radius: 0, outer_radius: radius });
  }
}

/** A ring between two concentric circles. */
export class Annulus extends Circle {
  declare inner_radius: number;
  declare outer_radius: number;
  declare mark_paths_closed: boolean;
  constructor(...args: unknown[]) {
    super(pyargs(args, ['inner_radius', 'outer_radius', 'fill_opacity', 'stroke_width', 'color', 'mark_paths_closed'], {
      inner_radius: 1, outer_radius: 2, fill_opacity: 1, stroke_width: 0, color: WHITE, mark_paths_closed: false,
    }));
  }
  protected override _init_attrs(kw: Kwargs): void {
    this.mark_paths_closed = kw.mark_paths_closed;
    this.inner_radius = kw.inner_radius;
    this.outer_radius = kw.outer_radius;
    super._init_attrs(kw);
  }
  override generate_points(): this {
    this.radius = this.outer_radius;
    const outer = new Circle({ radius: this.outer_radius });
    const inner = new Circle({ radius: this.inner_radius });
    inner.reverse_points();
    this.append_points(outer.points);
    this.append_points(inner.points);
    this.shift(this.arc_center);
    return this;
  }
}

/** A single cubic Bezier curve. */
export class CubicBezier extends VMobject {
  constructor(...args: unknown[]) {
    const o = pyargs(args, ['start_anchor', 'start_handle', 'end_handle', 'end_anchor']);
    const { start_anchor, start_handle, end_handle, end_anchor, ...rest } = o;
    super(rest);
    this.add_cubic_bezier_curve(start_anchor, start_handle, end_handle, end_anchor);
  }
}

/** A polygon whose edges are arcs. */
export class ArcPolygon extends VMobject {
  declare arcs: ArcBetweenPoints[];
  constructor(...args: unknown[]) {
    const [vertices, kw] = starArgs<Point3DLike>(args);
    const { angle = PI / 4, radius = null, arc_config = null, ...rest } = kw;
    const n = vertices.length;
    const pairs = vertices.map((v, k) => [v, vertices[(k + 1) % n]]);
    let confs: Kwargs[];
    if (!arc_config || (Array.isArray(arc_config) && arc_config.length === 0)) confs = pairs.map(() => (radius ? { radius } : { angle }));
    else if (!Array.isArray(arc_config)) confs = pairs.map(() => arc_config);
    else {
      if (arc_config.length !== n) throw new Error('arc_config must have one entry per edge');
      confs = arc_config;
    }
    const arcs = pairs.map(([a, b], i) => new ArcBetweenPoints(a, b, confs[i]));
    super(rest);
    this.add(...arcs);
    for (const arc of arcs) this.append_points(arc.points);
    this.arcs = arcs;
  }
}

/** A shape bounded by the given arcs, joined by straight lines. */
export class ArcPolygonFromArcs extends VMobject {
  declare arcs: Arc[];
  constructor(...args: unknown[]) {
    const [arcs, kw] = starArgs<Arc>(args);
    if (!arcs.every((m) => m instanceof Arc)) throw new Error('All ArcPolygon submobjects must be of type Arc/ArcBetweenPoints');
    super(kw);
    this.add(...arcs);
    this.arcs = [...arcs];
    for (const [arc1, arc2] of adjacent_pairs(arcs)) {
      this.append_points(arc1.points);
      const line = new registry.Line(arc1.get_end(), arc2.get_start());
      const ratio = line.get_length() / arc1.get_arc_length();
      if (!Number.isFinite(ratio)) continue;
      line.insert_n_curves(Math.trunc(arc1.get_num_curves() * ratio));
      this.append_points(line.points);
    }
  }
}

register({ Circle, Dot, Arc, ArcBetweenPoints });
