// manim/mobject/types/vectorized_mobject.py
import { CapStyleType, DEFAULT_STROKE_WIDTH, LEFT, LineJointType, ORIGIN, OUT, PI, RIGHT, UL, UP } from '../../constants';
import { ManimColor, type ParsableManimColor } from '../../utils/color/core';
import {
  bezier, bezier_remap, get_smooth_cubic_bezier_handle_points, integer_interpolate, partial_bezier_points,
  proportions_along_bezier_curve_for_point,
} from '../../utils/bezier';
import { make_even, stretch_array_to_length } from '../../utils/iterables';
import { concat, count, fromList, getPoint, repeatPoint, slicePoints, stridePoints, toList, type Points } from '../../utils/points';
import { isKwargs, pyargs, type Kwargs } from '../../utils/pyargs';
import { register, registry } from '../../utils/registry';
import { rotate_vector, shoelace_direction } from '../../utils/space_ops';
import { add, interpolate, mul, sub, to3, type Point3D, type Point3DLike } from '../../utils/vector';
import { Mobject } from '../mobject';
import { get_3d_vmob_gradient_start_and_end_points } from '../three_d/three_d_utils';

export type RGBA = [number, number, number, number];
type ColorArg = ParsableManimColor | readonly ParsableManimColor[] | null | undefined;

const NPPCC = 4;
const T_VALUES = [0, 1 / 3, 2 / 3, 1]; // np.linspace(0, 1, 4)

function tuplifyColors(c: ColorArg): (ParsableManimColor | null)[] {
  if (c === null || c === undefined) return [null];
  if (Array.isArray(c) && c.length > 0 && typeof c[0] !== 'number') return c as ParsableManimColor[];
  return [c as ParsableManimColor];
}

export class VMobject extends Mobject {
  declare fill_opacity: number;
  declare stroke_opacity: number;
  declare stroke_width: number;
  declare background_stroke_color: ManimColor;
  declare background_stroke_opacity: number;
  declare background_stroke_width: number;
  declare sheen_factor: number;
  declare joint_type: LineJointType;
  declare sheen_direction: Point3D;
  declare close_new_points: boolean;
  declare pre_function_handle_to_anchor_scale_factor: number;
  declare make_smooth_after_applying_functions: boolean;
  declare background_image: unknown;
  declare shade_in_3d: boolean;
  declare tolerance_for_point_equality: number;
  declare n_points_per_cubic_curve: number;
  declare cap_style: CapStyleType;
  declare fill_rgbas: RGBA[];
  declare stroke_rgbas: RGBA[];
  declare background_stroke_rgbas: RGBA[];
  declare submobjects: VMobject[];

  constructor(...args: unknown[]) {
    const kw = VMobject._kw(args);
    super(kw);
    if (kw.fill_color != null) this.fill_color = kw.fill_color;
    if (kw.stroke_color != null) this.stroke_color = kw.stroke_color;
  }
  static override _kw(args: unknown[]): Kwargs {
    return pyargs(args, ['fill_color', 'fill_opacity', 'stroke_color', 'stroke_opacity', 'stroke_width']);
  }
  protected override _init_attrs(kw: Kwargs): void {
    this.fill_opacity = kw.fill_opacity ?? 0.0;
    this.stroke_opacity = kw.stroke_opacity ?? 1.0;
    this.stroke_width = kw.stroke_width ?? DEFAULT_STROKE_WIDTH;
    const bsc = kw.background_stroke_color === undefined ? '#000000' : kw.background_stroke_color;
    if (bsc !== null) this.background_stroke_color = new ManimColor(bsc);
    this.background_stroke_opacity = kw.background_stroke_opacity ?? 1.0;
    this.background_stroke_width = kw.background_stroke_width ?? 0;
    this.sheen_factor = kw.sheen_factor ?? 0.0;
    this.joint_type = kw.joint_type ?? LineJointType.AUTO;
    this.sheen_direction = to3(kw.sheen_direction ?? UL);
    this.close_new_points = kw.close_new_points ?? false;
    this.pre_function_handle_to_anchor_scale_factor = kw.pre_function_handle_to_anchor_scale_factor ?? 0.01;
    this.make_smooth_after_applying_functions = kw.make_smooth_after_applying_functions ?? false;
    this.background_image = kw.background_image ?? null;
    this.shade_in_3d = kw.shade_in_3d ?? false;
    this.tolerance_for_point_equality = kw.tolerance_for_point_equality ?? 1e-6;
    this.n_points_per_cubic_curve = kw.n_points_per_cubic_curve ?? NPPCC;
    this.cap_style = kw.cap_style ?? CapStyleType.AUTO;
    super._init_attrs(kw);
  }
  /** Mobject sets `self.color = ...`, which for VMobject is the colour property. */
  protected override _set_color_attr(c: ParsableManimColor | ParsableManimColor[]): void {
    this.set_color(c as ParsableManimColor);
  }

  protected override _assert_valid_submobjects(submobjects: readonly unknown[]): this {
    return this._assert_valid_submobjects_internal(submobjects, VMobject);
  }
  get n_points_per_curve(): number {
    return this.n_points_per_cubic_curve;
  }
  override get_group_class(): any {
    return VGroup;
  }
  static override get_mobject_type_class(): any {
    return VMobject;
  }

  // ---------------------------------------------------------------- colours
  override init_colors(propagate_colors = true): this {
    this.set_fill(this.fill_color, this.fill_opacity, propagate_colors);
    this.set_stroke(this.stroke_color, this.stroke_width, this.stroke_opacity, false, propagate_colors);
    this.set_background_stroke({ color: this.background_stroke_color, width: this.background_stroke_width, opacity: this.background_stroke_opacity, family: propagate_colors });
    this.set_sheen(this.sheen_factor, this.sheen_direction, propagate_colors);
    if (!propagate_colors) for (const s of this.submobjects) s.init_colors(false);
    return this;
  }
  generate_rgbas_array(color: ColorArg, opacity: number | readonly number[] | null | undefined): RGBA[] {
    const colors = tuplifyColors(color).map((c) => (c !== null ? new ManimColor(c) : new ManimColor('#000000')));
    const opacities = (Array.isArray(opacity) ? opacity : [opacity]).map((o) => (o !== null && o !== undefined ? (o as number) : 0.0));
    const [cs, os] = make_even(colors, opacities);
    let rgbas = cs.map((c, i) => c.to_rgba_with_alpha(os[i]) as RGBA);
    const sf = this.get_sheen_factor();
    if (sf !== 0 && rgbas.length === 1) {
      const light = rgbas.map((r) => [...r.slice(0, 3).map((x) => Math.min(1, Math.max(0, x + sf))), Math.min(1, Math.max(0, r[3]))] as RGBA);
      rgbas = [...rgbas, ...light];
    }
    return rgbas;
  }
  update_rgbas_array(array_name: 'fill_rgbas' | 'stroke_rgbas' | 'background_stroke_rgbas', color: ColorArg = null, opacity: number | null | undefined = null): this {
    let rgbas = this.generate_rgbas_array(color, opacity);
    if (!(this as any)[array_name]) {
      (this as any)[array_name] = rgbas;
      return this;
    }
    let curr: RGBA[] = (this as any)[array_name];
    if (curr.length < rgbas.length) {
      curr = stretch_array_to_length(curr, rgbas.length).map((r) => [...r] as RGBA);
      (this as any)[array_name] = curr;
    } else if (rgbas.length < curr.length) rgbas = stretch_array_to_length(rgbas, curr.length);
    if (color !== null && color !== undefined) curr.forEach((r, i) => ((r[0] = rgbas[i][0]), (r[1] = rgbas[i][1]), (r[2] = rgbas[i][2])));
    if (opacity !== null && opacity !== undefined) curr.forEach((r, i) => (r[3] = rgbas[i][3]));
    return this;
  }
  set_fill(...args: unknown[]): this {
    const o = pyargs(args, ['color', 'opacity', 'family'], { color: null, opacity: null, family: true });
    if (o.family) for (const s of this.submobjects) s.set_fill(o.color, o.opacity, o.family);
    this.update_rgbas_array('fill_rgbas', o.color, o.opacity);
    if (o.opacity !== null && o.opacity !== undefined) this.fill_opacity = o.opacity;
    return this;
  }
  set_stroke(...args: unknown[]): this {
    const o = pyargs(args, ['color', 'width', 'opacity', 'background', 'family'], { color: null, width: null, opacity: null, background: false, family: true });
    if (o.family) for (const s of this.submobjects) s.set_stroke(o.color, o.width, o.opacity, o.background, o.family);
    const [arr, wName, oName] = o.background
      ? (['background_stroke_rgbas', 'background_stroke_width', 'background_stroke_opacity'] as const)
      : (['stroke_rgbas', 'stroke_width', 'stroke_opacity'] as const);
    this.update_rgbas_array(arr, o.color, o.opacity);
    if (o.width !== null && o.width !== undefined) (this as any)[wName] = o.width;
    if (o.opacity !== null && o.opacity !== undefined) (this as any)[oName] = o.opacity;
    if (o.color !== null && o.color !== undefined && o.background) this.background_stroke_color = ManimColor.parse(tuplifyColors(o.color)[0] as ParsableManimColor);
    return this;
  }
  set_cap_style(cap_style: CapStyleType): this {
    this.cap_style = cap_style;
    return this;
  }
  set_background_stroke(kw: Kwargs = {}): this {
    return this.set_stroke({ ...kw, background: true });
  }
  set_style(kw: Kwargs = {}): this {
    const family = kw.family ?? true;
    this.set_fill({ color: kw.fill_color ?? null, opacity: kw.fill_opacity ?? null, family });
    this.set_stroke({ color: kw.stroke_color ?? null, width: kw.stroke_width ?? null, opacity: kw.stroke_opacity ?? null, family });
    this.set_background_stroke({ color: kw.background_stroke_color ?? null, width: kw.background_stroke_width ?? null, opacity: kw.background_stroke_opacity ?? null, family });
    if (kw.sheen_factor) this.set_sheen(kw.sheen_factor, kw.sheen_direction ?? null, family);
    if (kw.background_image) this.color_using_background_image(kw.background_image);
    return this;
  }
  get_style(simple = false): Kwargs {
    const ret: Kwargs = { stroke_opacity: this.get_stroke_opacity(), stroke_width: this.get_stroke_width() };
    if (simple) {
      ret.fill_color = this.get_fill_color();
      ret.fill_opacity = this.get_fill_opacity();
      ret.stroke_color = this.get_stroke_color();
    } else {
      ret.fill_color = this.get_fill_colors();
      ret.fill_opacity = this.get_fill_opacities();
      ret.stroke_color = this.get_stroke_colors();
      ret.background_stroke_color = this.get_stroke_colors(true);
      ret.background_stroke_width = this.get_stroke_width(true);
      ret.background_stroke_opacity = this.get_stroke_opacity(true);
      ret.sheen_factor = this.get_sheen_factor();
      ret.sheen_direction = this.get_sheen_direction();
      ret.background_image = this.get_background_image();
    }
    return ret;
  }
  match_style(vmobject: VMobject, family = true): this {
    const st = vmobject.get_style();
    // exact copies of the colour arrays (set_style can't express per-row alpha lists)
    this.set_style({ ...st, fill_color: null, fill_opacity: null, stroke_color: null, stroke_opacity: null, background_stroke_color: null, background_stroke_opacity: null, family: false });
    this.fill_rgbas = vmobject.get_fill_rgbas().map((r) => [...r] as RGBA);
    this.stroke_rgbas = vmobject.get_stroke_rgbas().map((r) => [...r] as RGBA);
    this.background_stroke_rgbas = vmobject.get_stroke_rgbas(true).map((r) => [...r] as RGBA);
    this.fill_opacity = vmobject.fill_opacity;
    this.stroke_opacity = vmobject.stroke_opacity;
    this.background_stroke_opacity = vmobject.background_stroke_opacity;
    if (family) {
      let s1 = this.submobjects, s2 = vmobject.submobjects;
      if (s1.length === 0) return this;
      if (s2.length === 0) s2 = [vmobject];
      const [a, b] = make_even(s1, s2);
      a.forEach((sm, i) => sm.match_style(b[i]));
    }
    return this;
  }
  override set_color(...args: unknown[]): this {
    const o = pyargs(args, ['color', 'family'], { color: '#FFFF00', family: true });
    this.set_fill(o.color, null, o.family);
    this.set_stroke(o.color, null, null, false, o.family);
    return this;
  }
  set_opacity(opacity: number, family = true): this {
    this.set_fill(null, opacity, family);
    this.set_stroke(null, null, opacity, false, family);
    this.set_stroke(null, null, opacity, true, family);
    return this;
  }
  override scale(scale_factor: number, ...rest: unknown[]): this {
    const o = pyargs(rest, ['scale_stroke'], { scale_stroke: false });
    if (o.scale_stroke) {
      for (const mob of this.get_family()) {
        if (mob instanceof VMobject) {
          mob.set_stroke({ width: Math.abs(scale_factor) * mob.get_stroke_width(), family: false });
          mob.set_stroke({ width: Math.abs(scale_factor) * mob.get_stroke_width(true), background: true, family: false });
        }
      }
    }
    return super.scale(scale_factor, { about_point: o.about_point, about_edge: o.about_edge });
  }
  override fade(darkness = 0.5, family = true): this {
    const f = 1.0 - darkness;
    this.set_fill(null, f * this.get_fill_opacity(), false);
    this.set_stroke(null, null, f * this.get_stroke_opacity(), false, false);
    this.set_background_stroke({ opacity: f * this.get_stroke_opacity(true), family: false });
    return super.fade(darkness, family);
  }
  get_fill_rgbas(): RGBA[] {
    return this.fill_rgbas ?? [[0, 0, 0, 0]];
  }
  get_fill_color(): ManimColor {
    return this.get_fill_colors()[0] as ManimColor;
  }
  get fill_color(): ManimColor {
    return this.get_fill_color();
  }
  set fill_color(c: ColorArg) {
    this.set_fill(c);
  }
  get_fill_opacity(): number {
    return this.get_fill_opacities()[0];
  }
  get_fill_colors(): (ManimColor | null)[] {
    return this.get_fill_rgbas().map((r) => (r.some((x) => x !== 0) ? new ManimColor(r.slice(0, 3)) : null));
  }
  get_fill_opacities(): number[] {
    return this.get_fill_rgbas().map((r) => r[3]);
  }
  get_stroke_rgbas(background = false): RGBA[] {
    return (background ? this.background_stroke_rgbas : this.stroke_rgbas) ?? [[0, 0, 0, 0]];
  }
  get_stroke_color(background = false): ManimColor {
    return this.get_stroke_colors(background)[0] as ManimColor;
  }
  get stroke_color(): ManimColor {
    return this.get_stroke_color();
  }
  set stroke_color(c: ColorArg) {
    this.set_stroke(c);
  }
  get_stroke_width(background = false): number {
    return Math.max(0, background ? this.background_stroke_width : Number(this.stroke_width));
  }
  get_stroke_opacity(background = false): number {
    return this.get_stroke_opacities(background)[0];
  }
  get_stroke_colors(background = false): (ManimColor | null)[] {
    return this.get_stroke_rgbas(background).map((r) => (r.some((x) => x !== 0) ? new ManimColor(r.slice(0, 3)) : null));
  }
  get_stroke_opacities(background = false): number[] {
    return this.get_stroke_rgbas(background).map((r) => r[3]);
  }
  override get_color(): ManimColor {
    if (this.get_fill_opacities().every((o) => o === 0)) return this.get_stroke_color();
    return this.get_fill_color();
  }
  override get color(): ManimColor {
    return this.get_color();
  }
  override set color(c: ParsableManimColor) {
    this.set_color(c);
  }
  override nonempty_submobjects(): VMobject[] {
    return this.submobjects.filter((s) => s.submobjects.length !== 0 || s.points.length !== 0);
  }
  set_sheen_direction(direction: Point3DLike, family = true): this {
    if (family) for (const s of this.get_family() as VMobject[]) s.sheen_direction = to3(direction);
    else this.sheen_direction = to3(direction);
    return this;
  }
  rotate_sheen_direction(angle: number, axis: Point3DLike = OUT, family = true): this {
    if (family) for (const s of this.get_family() as VMobject[]) s.sheen_direction = rotate_vector(s.sheen_direction, angle, axis);
    else this.sheen_direction = rotate_vector(this.sheen_direction, angle, axis);
    return this;
  }
  set_sheen(factor: number, direction: Point3DLike | null = null, family = true): this {
    if (family) for (const s of this.submobjects) s.set_sheen(factor, direction, family);
    this.sheen_factor = factor;
    if (direction !== null && direction !== undefined) this.set_sheen_direction(direction, false);
    if (factor !== 0) {
      this.set_stroke(this.get_stroke_color(), null, null, false, family);
      this.set_fill(this.get_fill_color(), null, family);
    }
    return this;
  }
  get_sheen_direction(): Point3D {
    return [...this.sheen_direction] as Point3D;
  }
  get_sheen_factor(): number {
    return this.sheen_factor ?? 0;
  }
  get_gradient_start_and_end_points(): [Point3D, Point3D] {
    if (this.shade_in_3d) return get_3d_vmob_gradient_start_and_end_points(this);
    const dir = this.get_sheen_direction();
    const c = this.get_center();
    const bases = [RIGHT, UP, OUT].map((v) => sub(this.get_edge_center(v), c));
    const offset: Point3D = [0, 1, 2].map((i) => bases[0][i] * dir[0] + bases[1][i] * dir[1] + bases[2][i] * dir[2]) as Point3D;
    return [sub(c, offset), add(c, offset)];
  }
  color_using_background_image(background_image: unknown): this {
    this.background_image = background_image;
    this.set_color('#FFFFFF');
    for (const s of this.submobjects) s.color_using_background_image(background_image);
    return this;
  }
  get_background_image(): unknown {
    return this.background_image;
  }
  match_background_image(vmobject: VMobject): this {
    return this.color_using_background_image(vmobject.get_background_image());
  }
  set_shade_in_3d(value = true, z_index_as_group = false): this {
    for (const s of this.get_family() as VMobject[]) {
      s.shade_in_3d = value;
      if (z_index_as_group) s.z_index_group = this;
    }
    return this;
  }

  // ---------------------------------------------------------------- points
  set_points(points: Points | readonly Point3DLike[]): this {
    this.points = points instanceof Float64Array ? points.slice() : fromList(points as Point3DLike[]);
    return this;
  }
  resize_points(new_length: number, resize_func?: (p: Points, n: number) => Points): this {
    if (new_length !== count(this.points)) {
      if (resize_func) this.points = resize_func(this.points, new_length);
      else {
        const list = toList(this.points);
        this.points = fromList(Array.from({ length: new_length }, (_, i) => list[i % list.length]));
      }
    }
    return this;
  }
  set_anchors_and_handles(anchors1: readonly Point3DLike[], handles1: readonly Point3DLike[], handles2: readonly Point3DLike[], anchors2: readonly Point3DLike[]): this {
    const n = anchors1.length;
    const pts = new Float64Array(3 * NPPCC * n);
    const arrays = [anchors1, handles1, handles2, anchors2];
    for (let k = 0; k < n; k++)
      for (let j = 0; j < NPPCC; j++) {
        const q = arrays[j][k];
        const o = 3 * (NPPCC * k + j);
        pts[o] = q[0];
        pts[o + 1] = q[1];
        pts[o + 2] = q[2] ?? 0;
      }
    this.points = pts;
    return this;
  }
  clear_points(): this {
    this.points = new Float64Array(0);
    return this;
  }
  append_points(new_points: Points | readonly Point3DLike[]): this {
    this.points = concat(this.points, new_points instanceof Float64Array ? new_points : fromList(new_points as Point3DLike[]));
    return this;
  }
  start_new_path(point: Point3DLike): this {
    const n = count(this.points);
    const nppc = this.n_points_per_curve;
    if (n % nppc !== 0) {
      const starts = this.get_start_anchors();
      const last = starts[starts.length - 1];
      this.append_points([...Array(nppc - (n % nppc)).fill(last), point]);
    } else this.append_points([point]);
    return this;
  }
  add_cubic_bezier_curve(anchor1: Point3DLike, handle1: Point3DLike, handle2: Point3DLike, anchor2: Point3DLike): this {
    return this.append_points([anchor1, handle1, handle2, anchor2]);
  }
  add_cubic_bezier_curves(curves: readonly (readonly Point3DLike[])[]): this {
    return this.append_points(curves.flat() as Point3DLike[]);
  }
  add_cubic_bezier_curve_to(handle1: Point3DLike, handle2: Point3DLike, anchor: Point3DLike): this {
    this.throw_error_if_no_points();
    if (this.has_new_path_started()) return this.append_points([handle1, handle2, anchor]);
    return this.append_points([this.get_last_point(), handle1, handle2, anchor]);
  }
  add_quadratic_bezier_curve_to(handle: Point3DLike, anchor: Point3DLike): this {
    const l = this.get_last_point();
    return this.add_cubic_bezier_curve_to(add(mul(2 / 3, handle), mul(1 / 3, l)), add(mul(2 / 3, handle), mul(1 / 3, anchor)), anchor);
  }
  add_line_to(point: Point3DLike): this {
    const l = this.get_last_point();
    return this.add_cubic_bezier_curve_to(interpolate(l, point, T_VALUES[1]), interpolate(l, point, T_VALUES[2]), interpolate(l, point, T_VALUES[3]));
  }
  add_smooth_curve_to(...points: Point3DLike[]): this {
    let handle2: Point3D | null = null, anchor: Point3D;
    if (points.length === 1) anchor = to3(points[0]);
    else if (points.length === 2) [handle2, anchor] = [to3(points[0]), to3(points[1])];
    else throw new Error('Only call add_smooth_curve_to with 1 or 2 points');
    if (this.has_new_path_started()) return this.add_line_to(anchor);
    this.throw_error_if_no_points();
    const lastH2 = getPoint(this.points, -2), lastA2 = getPoint(this.points, -1);
    const tangent = sub(lastA2, lastH2);
    const handle1 = add(lastA2, tangent);
    if (handle2 === null) {
      const toAnchor = sub(anchor, lastA2);
      handle2 = sub(anchor, rotate_vector(tangent, PI, toAnchor));
    }
    return this.append_points([lastA2, handle1, handle2, anchor]);
  }
  has_new_path_started(): boolean {
    return count(this.points) % NPPCC === 1;
  }
  get_last_point(): Point3D {
    return getPoint(this.points, -1);
  }
  is_closed(): boolean {
    return this.consider_points_equals(getPoint(this.points, 0), getPoint(this.points, -1));
  }
  close_path(): this {
    if (!this.is_closed()) {
      const sp = this.get_subpaths();
      this.add_line_to(getPoint(sp[sp.length - 1], 0));
    }
    return this;
  }
  add_points_as_corners(points: readonly Point3DLike[]): this {
    this.throw_error_if_no_points();
    const n = points.length;
    if (n === 0) return this;
    const starts = [this.get_last_point(), ...points.slice(0, -1).map(to3)];
    const ends = points.map(to3);
    if (this.has_new_path_started()) this.points = this.points.slice(0, -3);
    const out: Point3D[] = [];
    for (let i = 0; i < n; i++) for (const t of T_VALUES) out.push(interpolate(starts[i], ends[i], t));
    return this.append_points(out);
  }
  set_points_as_corners(points: readonly Point3DLike[] | Points): this {
    const pts = points instanceof Float64Array ? toList(points) : points.map(to3);
    const a = pts.slice(0, -1), b = pts.slice(1);
    const [a1, h1, h2, a2] = T_VALUES.map((t) => a.map((p, i) => interpolate(p, b[i], t)));
    return this.set_anchors_and_handles(a1, h1, h2, a2);
  }
  set_points_smoothly(points: readonly Point3DLike[]): this {
    this.set_points_as_corners(points);
    return this.make_smooth();
  }
  change_anchor_mode(mode: 'jagged' | 'smooth'): this {
    for (const sm of this.family_members_with_points() as VMobject[]) {
      const subpaths = sm.get_subpaths();
      sm.clear_points();
      for (const sp of subpaths) {
        const list = toList(sp);
        const anchors = [...stridePoints(sp, 0, NPPCC), list[list.length - 1]];
        let h1: Point3D[], h2: Point3D[];
        if (mode === 'smooth') [h1, h2] = get_smooth_cubic_bezier_handle_points(anchors);
        else {
          const a1 = anchors.slice(0, -1), a2 = anchors.slice(1);
          h1 = a1.map((p, i) => interpolate(p, a2[i], 1 / 3));
          h2 = a1.map((p, i) => interpolate(p, a2[i], 2 / 3));
        }
        for (let i = 0; i < h1.length; i++) {
          list[NPPCC * i + 1] = h1[i];
          list[NPPCC * i + 2] = h2[i];
        }
        sm.append_points(list);
      }
    }
    return this;
  }
  make_smooth(): this {
    return this.change_anchor_mode('smooth');
  }
  make_jagged(): this {
    return this.change_anchor_mode('jagged');
  }
  add_subpath(points: Points | readonly Point3DLike[]): this {
    return this.append_points(points);
  }
  append_vectorized_mobject(vm: VMobject): this {
    if (this.has_new_path_started()) this.points = this.points.slice(0, -3);
    return this.append_points(vm.points);
  }
  override apply_function(fn: (p: Point3D) => Point3DLike, ..._rest: unknown[]): this {
    const f = this.pre_function_handle_to_anchor_scale_factor;
    this.scale_handle_to_anchor_distances(f);
    super.apply_function(fn);
    this.scale_handle_to_anchor_distances(1 / f);
    if (this.make_smooth_after_applying_functions) this.make_smooth();
    return this;
  }
  override rotate(angle: number, ...rest: unknown[]): this {
    const o = pyargs(rest, ['axis'], { axis: OUT });
    this.rotate_sheen_direction(angle, o.axis);
    return super.rotate(angle, o.axis, { about_point: o.about_point, about_edge: o.about_edge });
  }
  scale_handle_to_anchor_distances(factor: number): this {
    for (const sm of this.family_members_with_points() as VMobject[]) {
      if (count(sm.points) < NPPCC) continue;
      const [a1, h1, h2, a2] = sm.get_anchors_and_handles();
      sm.set_anchors_and_handles(a1, a1.map((a, i) => add(a, mul(factor, sub(h1[i], a)))), a2.map((a, i) => add(a, mul(factor, sub(h2[i], a)))), a2);
    }
    return this;
  }
  consider_points_equals(p0: Point3DLike, p1: Point3DLike): boolean {
    const atol = this.tolerance_for_point_equality, rtol = 1e-5;
    for (let k = 0; k < 3; k++) if (!(Math.abs((p0[k] ?? 0) - (p1[k] ?? 0)) <= atol + rtol * Math.abs(p1[k] ?? 0))) return false;
    return true;
  }
  consider_points_equals_2d(p0: Point3DLike, p1: Point3DLike): boolean {
    const atol = this.tolerance_for_point_equality, rtol = 1e-5;
    if (p0[0] !== p1[0]) {
      const d = Math.abs(p0[0] - p1[0]);
      if (!(d <= atol + rtol * Math.abs(p1[0]) && Number.isFinite(d))) return false;
    }
    if (p0[1] === p1[1]) return true;
    const d = Math.abs(p0[1] - p1[1]);
    return d <= atol + rtol * Math.abs(p1[1]) && Number.isFinite(d);
  }

  // ---------------------------------------------------------------- curves
  get_cubic_bezier_tuples_from_points(points: Points): Point3D[][] {
    const n = count(points) - (count(points) % NPPCC);
    const out: Point3D[][] = [];
    for (let i = 0; i < n; i += NPPCC) out.push([0, 1, 2, 3].map((j) => getPoint(points, i + j)));
    return out;
  }
  gen_cubic_bezier_tuples_from_points(points: Points): Point3D[][] {
    return this.get_cubic_bezier_tuples_from_points(points);
  }
  get_cubic_bezier_tuples(): Point3D[][] {
    return this.get_cubic_bezier_tuples_from_points(this.points);
  }
  protected _gen_subpaths_from_points(points: Points, filter: (n: number) => boolean): Points[] {
    const n = count(points);
    const splits = [0];
    for (let k = NPPCC; k < n; k += NPPCC) if (filter(k)) splits.push(k);
    splits.push(n);
    const out: Points[] = [];
    for (let i = 0; i < splits.length - 1; i++) if (splits[i + 1] - splits[i] >= NPPCC) out.push(slicePoints(points, splits[i], splits[i + 1]));
    return out;
  }
  get_subpaths_from_points(points: Points): Points[] {
    return this._gen_subpaths_from_points(points, (n) => !this.consider_points_equals(getPoint(points, n - 1), getPoint(points, n)));
  }
  gen_subpaths_from_points_2d(points: Points): Points[] {
    return this._gen_subpaths_from_points(points, (n) => !this.consider_points_equals_2d(getPoint(points, n - 1), getPoint(points, n)));
  }
  /** [start, end) point ranges of each subpath (used by the renderer). */
  get_subpath_split_indices_from_points(points: Points, n_dims = 3): [number, number][] {
    const n = count(points);
    if (n < NPPCC) return [];
    const atol = this.tolerance_for_point_equality, rtol = 1e-5;
    const splits = [0];
    for (let b = NPPCC; b < n; b += NPPCC) {
      let close = true;
      for (let k = 0; k < n_dims; k++) {
        const e = points[3 * (b - 1) + k], s = points[3 * b + k];
        const d = Math.abs(e - s);
        if (!(d <= atol + rtol * Math.abs(s)) && !(e === s)) {
          close = false;
          break;
        }
      }
      if (!close) splits.push(b);
    }
    splits.push(n);
    const out: [number, number][] = [];
    for (let i = 0; i < splits.length - 1; i++) out.push([splits[i], splits[i + 1]]);
    return out;
  }
  get_subpaths(): Points[] {
    return this.get_subpaths_from_points(this.points);
  }
  get_nth_curve_points(n: number): Point3D[] {
    return [0, 1, 2, 3].map((j) => getPoint(this.points, NPPCC * n + j));
  }
  get_nth_curve_function(n: number): (t: number) => Point3D {
    return bezier(this.get_nth_curve_points(n));
  }
  get_nth_curve_length_pieces(n: number, sample_points: number | null = null): number[] {
    const s = sample_points ?? 10;
    const curve = this.get_nth_curve_function(n);
    const pts = Array.from({ length: s }, (_, i) => curve(s === 1 ? 0 : i / (s - 1)));
    const out: number[] = [];
    for (let i = 1; i < pts.length; i++) {
      const d = sub(pts[i], pts[i - 1]);
      out.push(Math.sqrt(d[0] * d[0] + d[1] * d[1] + d[2] * d[2]));
    }
    return out;
  }
  get_nth_curve_length(n: number, sample_points: number | null = null): number {
    return this.get_nth_curve_length_pieces(n, sample_points).reduce((a, b) => a + b, 0);
  }
  get_nth_curve_function_with_length(n: number, sample_points: number | null = null): [(t: number) => Point3D, number] {
    return [this.get_nth_curve_function(n), this.get_nth_curve_length(n, sample_points)];
  }
  get_num_curves(): number {
    return Math.floor(count(this.points) / NPPCC);
  }
  get_curve_functions(): ((t: number) => Point3D)[] {
    return Array.from({ length: this.get_num_curves() }, (_, n) => this.get_nth_curve_function(n));
  }
  get_curve_functions_with_lengths(kw: Kwargs = {}): [(t: number) => Point3D, number][] {
    return Array.from({ length: this.get_num_curves() }, (_, n) => this.get_nth_curve_function_with_length(n, kw.sample_points ?? null));
  }
  override point_from_proportion(alpha: number): Point3D {
    if (alpha < 0 || alpha > 1) throw new Error(`Alpha ${alpha} not between 0 and 1.`);
    this.throw_error_if_no_points();
    if (alpha === 1) return getPoint(this.points, -1);
    const cl = this.get_curve_functions_with_lengths();
    const target = alpha * cl.reduce((s, [, l]) => s + l, 0);
    let current = 0;
    for (const [curve, length] of cl) {
      if (current + length >= target) return curve(length !== 0 ? (target - current) / length : 0);
      current += length;
    }
    throw new Error('point_from_proportion: unreachable');
  }
  override proportion_from_point(point: Point3DLike): number {
    this.throw_error_if_no_points();
    const total = this.get_arc_length();
    let target = 0;
    let found = false;
    for (let n = 0; n < this.get_num_curves(); n++) {
      const length = this.get_nth_curve_length(n);
      const props = proportions_along_bezier_curve_for_point(point, this.get_nth_curve_points(n));
      if (props.length > 0) {
        target += length * Math.max(...props);
        found = true;
        break;
      }
      target += length;
    }
    if (!found) throw new Error(`Point ${point} does not lie on this curve.`);
    return target / total;
  }
  get_anchors_and_handles(): [Point3D[], Point3D[], Point3D[], Point3D[]] {
    return [0, 1, 2, 3].map((i) => stridePoints(this.points, i, NPPCC)) as [Point3D[], Point3D[], Point3D[], Point3D[]];
  }
  get_start_anchors(): Point3D[] {
    return stridePoints(this.points, 0, NPPCC);
  }
  get_end_anchors(): Point3D[] {
    return stridePoints(this.points, NPPCC - 1, NPPCC);
  }
  get_anchors(): Point3D[] {
    if (count(this.points) === 1) return [getPoint(this.points, 0)];
    const s = this.get_start_anchors(), e = this.get_end_anchors();
    const out: Point3D[] = [];
    for (let i = 0; i < Math.min(s.length, e.length); i++) out.push(s[i], e[i]);
    return out;
  }
  /** Bounding boxes use anchors only (not Bezier handles), like manim. */
  override get_points_defining_boundary(): Points {
    return fromList(this.get_family().flatMap((m) => (m instanceof VMobject ? m.get_anchors() : [])));
  }
  get_arc_length(sample_points_per_curve: number | null = null): number {
    return this.get_curve_functions_with_lengths({ sample_points: sample_points_per_curve }).reduce((s, [, l]) => s + l, 0);
  }

  // ---------------------------------------------------------------- alignment
  override align_points(vmobject: VMobject): this {
    this.align_rgbas(vmobject);
    if (this.get_num_points() === vmobject.get_num_points()) return this;
    for (const mob of [this, vmobject]) {
      if (mob.has_no_points()) mob.start_new_path(mob.get_center());
      if (mob.has_new_path_started()) mob.add_line_to(mob.get_last_point());
    }
    const s1 = this.get_subpaths(), s2 = vmobject.get_subpaths();
    const n = Math.max(s1.length, s2.length);
    const nth = (list: Points[], i: number): Points => {
      if (i >= list.length) {
        if (list.length === 0) return repeatPoint([0, 0, 0], NPPCC);
        return repeatPoint(getPoint(list[list.length - 1], -1), NPPCC);
      }
      let path = list[i];
      while (count(path) > NPPCC) {
        const ref = getPoint(path, -NPPCC - 1);
        let allEq = true;
        for (let k = count(path) - NPPCC; k < count(path); k++) if (!this.consider_points_equals(getPoint(path, k), ref)) allEq = false;
        if (allEq) path = path.slice(0, -3 * NPPCC);
        else break;
      }
      return path;
    };
    const p1: Points[] = [], p2: Points[] = [];
    for (let i = 0; i < n; i++) {
      let a = nth(s1, i), b = nth(s2, i);
      const d1 = Math.max(0, Math.floor((count(b) - count(a)) / NPPCC));
      const d2 = Math.max(0, Math.floor((count(a) - count(b)) / NPPCC));
      a = this.insert_n_curves_to_point_list(d1, a);
      b = this.insert_n_curves_to_point_list(d2, b);
      p1.push(a);
      p2.push(b);
    }
    this.set_points(concat(...p1));
    vmobject.set_points(concat(...p2));
    return this;
  }
  insert_n_curves(n: number): this {
    const np = this.has_new_path_started() ? this.get_last_point() : null;
    this.set_points(this.insert_n_curves_to_point_list(n, this.points));
    if (np) this.append_points([np]);
    return this;
  }
  insert_n_curves_to_point_list(n: number, points: Points): Points {
    if (count(points) === 1) return repeatPoint(getPoint(points, 0), NPPCC * n);
    const tuples = this.get_cubic_bezier_tuples_from_points(points);
    return fromList(bezier_remap(tuples, tuples.length + n).flat());
  }
  align_rgbas(vmobject: VMobject): this {
    for (const attr of ['fill_rgbas', 'stroke_rgbas', 'background_stroke_rgbas'] as const) {
      const a1 = this[attr], a2 = vmobject[attr];
      if (a1.length > a2.length) vmobject[attr] = stretch_array_to_length(a2, a1.length).map((r) => [...r] as RGBA);
      else if (a2.length > a1.length) this[attr] = stretch_array_to_length(a1, a2.length).map((r) => [...r] as RGBA);
    }
    return this;
  }
  override get_point_mobject(center: Point3DLike | null = null): VectorizedPoint {
    const p = new VectorizedPoint(center ?? this.get_center());
    p.match_style(this);
    return p;
  }
  override interpolate_color(m1: VMobject, m2: VMobject, alpha: number): this {
    const L = (a: RGBA[], b: RGBA[]) => a.map((r, i) => r.map((x, k) => (1 - alpha) * x + alpha * (b[i] ?? b[b.length - 1])[k]) as RGBA);
    if (alpha === 1) {
      this.fill_rgbas = m2.fill_rgbas.map((r) => [...r] as RGBA);
      this.stroke_rgbas = m2.stroke_rgbas.map((r) => [...r] as RGBA);
      this.background_stroke_rgbas = m2.background_stroke_rgbas.map((r) => [...r] as RGBA);
      this.stroke_width = m2.stroke_width;
      this.background_stroke_width = m2.background_stroke_width;
      this.sheen_direction = [...m2.sheen_direction] as Point3D;
      this.sheen_factor = m2.sheen_factor;
      return this;
    }
    this.fill_rgbas = L(m1.fill_rgbas, m2.fill_rgbas);
    this.stroke_rgbas = L(m1.stroke_rgbas, m2.stroke_rgbas);
    this.background_stroke_rgbas = L(m1.background_stroke_rgbas, m2.background_stroke_rgbas);
    this.stroke_width = (1 - alpha) * m1.stroke_width + alpha * m2.stroke_width;
    this.background_stroke_width = (1 - alpha) * m1.background_stroke_width + alpha * m2.background_stroke_width;
    this.sheen_direction = interpolate(m1.sheen_direction, m2.sheen_direction, alpha);
    this.sheen_factor = (1 - alpha) * m1.sheen_factor + alpha * m2.sheen_factor;
    return this;
  }
  pointwise_become_partial(vmobject: VMobject, a: number, b: number): this {
    if (!(vmobject instanceof VMobject)) throw new TypeError(`Expected a VMobject, got ${String(vmobject)}`);
    if (a <= 0 && b >= 1) return this.set_points(vmobject.points);
    const nc = vmobject.get_num_curves();
    if (nc === 0) return this;
    const [li, lr] = integer_interpolate(0, nc, a);
    const [ui, ur] = integer_interpolate(0, nc, b);
    const src = vmobject.points.slice();
    const cur = (k: number) => [0, 1, 2, 3].map((j) => getPoint(src, NPPCC * k + j));
    if (li === ui) return this.set_points(partial_bezier_points(cur(li), lr, ur));
    const out: Point3D[] = [...partial_bezier_points(cur(li), lr, 1)];
    for (let k = li + 1; k < ui; k++) out.push(...cur(k));
    out.push(...partial_bezier_points(cur(ui), 0, ur));
    return this.set_points(out);
  }
  get_subcurve(a: number, b: number): this {
    if (this.is_closed() && a > b) {
      const v = this.copy();
      v.pointwise_become_partial(this, a, 1);
      const v2 = this.copy();
      v2.pointwise_become_partial(this, 0, b);
      v.append_vectorized_mobject(v2);
      return v;
    }
    const v = this.copy();
    v.pointwise_become_partial(this, a, b);
    return v;
  }
  get_direction(): 'CW' | 'CCW' {
    return shoelace_direction(this.get_start_anchors());
  }
  reverse_direction(): this {
    const n = count(this.points);
    const out = new Float64Array(this.points.length);
    for (let i = 0; i < n; i++) out.set(this.points.subarray(3 * (n - 1 - i), 3 * (n - i)), 3 * i);
    this.points = out;
    return this;
  }
  force_direction(target: 'CW' | 'CCW'): this {
    if (target !== 'CW' && target !== 'CCW') throw new Error('Invalid input for force_direction. Use "CW" or "CCW"');
    if (this.get_direction() !== target) this.reverse_direction();
    return this;
  }
}

function flattenVMobjects(args: unknown[]): [VMobject[], Kwargs] {
  const mobs: VMobject[] = [];
  let kw: Kwargs = {};
  args.forEach((a, i) => {
    if (a instanceof VMobject) mobs.push(a);
    else if (isKwargs(a) && i === args.length - 1) kw = a;
    else if (a instanceof Mobject) throw new TypeError(`Only values of type VMobject can be added as submobjects of VGroup, but the value ${String(a)} (at index ${i}) is of type ${a.constructor.name}. You can try adding this value into a Group instead.`);
    else if (a && typeof (a as any)[Symbol.iterator] === 'function') {
      for (const s of a as Iterable<unknown>) {
        if (!(s instanceof VMobject)) throw new TypeError(`Only values of type VMobject can be added as submobjects of VGroup, not ${String(s)}.`);
        mobs.push(s);
      }
    } else throw new TypeError(`Only values of type VMobject can be added as submobjects of VGroup, not ${String(a)}.`);
  });
  return [mobs, kw];
}

/** A group of VMobjects (also accepts arrays / iterables of VMobjects). */
export class VGroup extends VMobject {
  constructor(...args: unknown[]) {
    const [mobs, kw] = flattenVMobjects(args);
    super(kw);
    this.add(...mobs);
  }
  override add(...vmobjects: any[]): this {
    const [mobs] = flattenVMobjects(vmobjects);
    return super.add(...mobs);
  }
  override toString(): string {
    return `VGroup of ${this.submobjects.length} submobject${this.submobjects.length > 0 ? 's' : ''}`;
  }
  /** `vgroup[i] = mob` */
  set_item(i: number, value: VMobject): void {
    this._assert_valid_submobjects([value]);
    this.submobjects[i < 0 ? i + this.submobjects.length : i] = value;
  }
}

/** A VGroup whose submobjects are addressed by key. */
export class VDict extends VMobject {
  declare show_keys: boolean;
  declare submob_dict: Map<unknown, VMobject>;
  constructor(...args: unknown[]) {
    const o = pyargs(args, ['mapping_or_iterable', 'show_keys'], { mapping_or_iterable: [], show_keys: false });
    const { mapping_or_iterable, show_keys, ...rest } = o;
    super(rest);
    this.show_keys = show_keys;
    this.submob_dict = new Map();
    this.add(mapping_or_iterable);
  }
  override add(mapping: any): this {
    const entries: [unknown, VMobject][] = mapping instanceof Map ? [...mapping.entries()] : Array.isArray(mapping) ? mapping : Object.entries(mapping ?? {});
    for (const [k, v] of entries) this.add_key_value_pair(k, v);
    return this;
  }
  override remove(key: any): this {
    if (!this.submob_dict.has(key)) throw new Error(`The given key '${String(key)}' is not present in the VDict`);
    super.remove(this.submob_dict.get(key)!);
    this.submob_dict.delete(key);
    return this;
  }
  override get(key: any): any {
    return this.submob_dict.get(key);
  }
  set_item(key: unknown, value: VMobject): void {
    if (this.submob_dict.has(key)) this.remove(key);
    this.add([[key, value]]);
  }
  has(key: unknown): boolean {
    return this.submob_dict.has(key);
  }
  get_all_submobjects(): VMobject[] {
    return [...this.submob_dict.values()];
  }
  add_key_value_pair(key: unknown, value: VMobject): this {
    this._assert_valid_submobjects([value]);
    if (this.show_keys) {
      value.add(new registry.Tex(String(key)).next_to(value, LEFT));
    }
    this.submob_dict.set(key, value);
    super.add(value);
    return this;
  }
}

/** A single invisible point that still has a position (used as a placeholder). */
export class VectorizedPoint extends VMobject {
  declare artificial_width: number;
  declare artificial_height: number;
  constructor(...args: unknown[]) {
    const o = pyargs(args, ['location', 'color', 'fill_opacity', 'stroke_width', 'artificial_width', 'artificial_height'], {
      location: ORIGIN, color: '#000000', fill_opacity: 0, stroke_width: 0, artificial_width: 0.01, artificial_height: 0.01,
    });
    super(o);
    this.set_points([o.location]);
  }
  protected override _init_attrs(kw: Kwargs): void {
    this.artificial_width = kw.artificial_width;
    this.artificial_height = kw.artificial_height;
    super._init_attrs(kw);
  }
  override get width(): number {
    return this.artificial_width;
  }
  override set width(v: number) {
    this.scale_to_fit_width(v);
  }
  override get height(): number {
    return this.artificial_height;
  }
  override set height(v: number) {
    this.scale_to_fit_height(v);
  }
  get_location(): Point3D {
    return getPoint(this.points, 0);
  }
  set_location(new_loc: Point3DLike): this {
    return this.set_points([new_loc]);
  }
}

/** Splits a VMobject into one submobject per Bezier curve. */
export class CurvesAsSubmobjects extends VGroup {
  constructor(vmobject: VMobject, kw: Kwargs = {}) {
    super(kw);
    for (const tup of vmobject.get_cubic_bezier_tuples()) {
      const part = new VMobject();
      part.set_points(tup);
      part.match_style(vmobject);
      this.add(part);
    }
  }
  override point_from_proportion(alpha: number): Point3D {
    if (alpha < 0 || alpha > 1) throw new Error(`Alpha ${alpha} not between 0 and 1.`);
    if (this.submobjects.length === 0) throw new Error('Cannot call CurvesAsSubmobjects.point_from_proportion for a CurvesAsSubmobject with no submobjects');
    const parts = this.submobjects.filter((p) => p.points.length > 0);
    if (!parts.length) throw new Error('CurvesAsSubmobjects has no submobjects with points');
    if (alpha === 1) return getPoint(parts[parts.length - 1].points, -1);
    const lengths = parts.map((p) => p.get_arc_length());
    const target = alpha * lengths.reduce((a, b) => a + b, 0);
    let cur = 0;
    for (let i = 0; i < parts.length; i++) {
      if (cur + lengths[i] >= target) return parts[i].point_from_proportion((target - cur) / lengths[i]);
      cur += lengths[i];
    }
    return getPoint(parts[parts.length - 1].points, -1);
  }
}

function interp1(x: number, xs: number[], ys: number[]): number {
  if (x <= xs[0]) return ys[0];
  if (x >= xs[xs.length - 1]) return ys[ys.length - 1];
  let lo = 0, hi = xs.length - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (xs[mid] <= x) lo = mid;
    else hi = mid;
  }
  const t = xs[hi] === xs[lo] ? 0 : (x - xs[lo]) / (xs[hi] - xs[lo]);
  return ys[lo] + t * (ys[hi] - ys[lo]);
}

/** A dashed copy of a VMobject. */
export class DashedVMobject extends VMobject {
  declare dashed_ratio: number;
  declare num_dashes: number;
  constructor(...args: unknown[]) {
    const o = pyargs(args, ['vmobject', 'num_dashes', 'dashed_ratio', 'dash_offset', 'color', 'equal_lengths'], {
      num_dashes: 15, dashed_ratio: 0.5, dash_offset: 0, color: '#FFFFFF', equal_lengths: true,
    });
    const { vmobject: base, num_dashes, dashed_ratio, dash_offset, equal_lengths, ...rest } = o;
    super({ ...rest, num_dashes, dashed_ratio });
    const vm: VMobject = base.copy();
    let tips: VMobject | null = null;
    if (typeof (vm as any).pop_tips === 'function') {
      const popped = (vm as any).pop_tips();
      if (popped.submobjects.length > 0) tips = popped;
    }
    const r = this.dashed_ratio, n = this.num_dashes;
    if (n > 0) {
      const dash_len = r / n;
      const closed = vm.is_closed();
      const void_len = closed ? (1 - r) / n : n === 1 ? 1 - r : (1 - r) / (n - 1);
      const period = dash_len + void_len;
      const phase = (((dash_offset % 1) + 1) % 1) * period;
      const pattern_len = closed ? 1 : 1 + void_len;
      const pmod = (a: number) => ((a % pattern_len) + pattern_len) % pattern_len;
      const starts = Array.from({ length: n }, (_, i) => pmod(i * period + phase));
      const ends = Array.from({ length: n }, (_, i) => pmod(i * period + dash_len + phase));
      if (!closed) {
        const L = starts.length - 1;
        if (ends[L] > 1 && starts[L] > 1) {
          ends.pop();
          starts.pop();
        } else if (ends[L] < dash_len) {
          if (starts[L] < 1) {
            starts.push(0);
            ends.push(ends[L]);
            ends[L] = 1;
          } else starts[L] = 0;
        } else if (starts[L] > 1 - dash_len) ends[L] = 1;
      }
      if (equal_lengths) {
        const norms = [0];
        for (let k = 0; k < vm.get_num_curves(); k++) norms.push(...vm.get_nth_curve_length_pieces(k));
        const lens: number[] = [];
        norms.reduce((acc, v) => (lens.push(acc + v), acc + v), 0);
        const refs = lens.map((_, i) => (lens.length === 1 ? 0 : i / (lens.length - 1)));
        const total = lens[lens.length - 1];
        this.add(...starts.map((s, i) => vm.get_subcurve(interp1(s * total, lens, refs), interp1(ends[i] * total, lens, refs))));
      } else this.add(...starts.map((s, i) => vm.get_subcurve(s, ends[i])));
    }
    this.match_style(base, false);
    if (tips) this.add(...tips.submobjects);
  }
  protected override _init_attrs(kw: Kwargs): void {
    this.dashed_ratio = kw.dashed_ratio;
    this.num_dashes = kw.num_dashes;
    super._init_attrs(kw);
  }
}

register({ VMobject, VGroup, VectorizedPoint });
