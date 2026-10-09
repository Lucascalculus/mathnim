// manim/camera/three_d_camera.py
//
// Cairo-style 3D camera: every point is rotated by (phi, theta, gamma), put in
// perspective with `focal_distance`, and drawn with the 2D Canvas pipeline.
// `shade_in_3d` VMobjects are depth-sorted and shaded from a light source.
import { config } from '../_config';
import { DEGREES, DOWN, LEFT, OUT, RIGHT } from '../constants';
import { Mobject } from '../mobject/mobject';
import {
  get_3d_vmob_end_corner, get_3d_vmob_end_corner_unit_normal, get_3d_vmob_start_corner, get_3d_vmob_start_corner_unit_normal,
} from '../mobject/three_d/three_d_utils';
import { VMobject, type RGBA } from '../mobject/types/vectorized_mobject';
import { ValueTracker } from '../mobject/value_tracker';
import { get_shaded_rgb } from '../utils/color/core';
import { extract_mobject_family_members } from '../utils/family';
import type { Points } from '../utils/points';
import { starArgs } from '../utils/pyargs';
import { rotation_about_z, rotation_matrix, type Matrix3 } from '../utils/space_ops';
import { add, mul, to3, type Point3D, type Point3DLike } from '../utils/vector';
import { Camera, type CameraOptions } from './camera';

export interface ThreeDCameraOptions extends CameraOptions {
  focal_distance?: number;
  shading_factor?: number;
  default_distance?: number;
  light_source_start_point?: Point3DLike;
  should_apply_shading?: boolean;
  exponential_projection?: boolean;
  phi?: number;
  theta?: number;
  gamma?: number;
  zoom?: number;
}

/**
 * manim's `Point` (a one-point PMobject), reduced to what the camera needs: an
 * invisible mobject holding one location that can be moved and animated.
 */
class CameraPoint extends Mobject {
  constructor(location: Point3DLike) {
    super();
    this.points = Float64Array.from(to3(location));
  }
  override interpolate_color(_m1: Mobject, _m2: Mobject, _alpha: number): this {
    return this;
  }
}
const point_mobject = (p: Point3DLike): Mobject => new CameraPoint(p);

/**
 * web: get_z_index_reference_point() of a childless VMobject without allocating
 * (the centre of the bounding box of its anchors), or null when a class customises it.
 */
function leaf_center(mob: Mobject): Point3D | null {
  if (mob.submobjects.length || mob.z_index_group || !(mob instanceof VMobject)) return null;
  const proto = VMobject.prototype as any;
  if (mob.get_z_index_reference_point !== proto.get_z_index_reference_point || mob.get_center !== proto.get_center
    || mob.get_critical_point !== proto.get_critical_point || mob.get_points_defining_boundary !== proto.get_points_defining_boundary
    || mob.get_extremum_along_dim !== proto.get_extremum_along_dim) return null;
  const p = mob.points, n = p.length / 3;
  if (n === 1) return [p[0], p[1], p[2]];
  const nc = Math.floor(n / 4);
  if (nc === 0) return [0, 0, 0];
  let x0 = Infinity, y0 = Infinity, z0 = Infinity, x1 = -Infinity, y1 = -Infinity, z1 = -Infinity;
  // anchors are points 4c and 4c + 3 of every complete curve c
  for (let j = 0; j < 2 * nc; j++) {
    const k = 12 * (j >> 1) + 9 * (j & 1);
    const x = p[k], y = p[k + 1], z = p[k + 2];
    if (x < x0) x0 = x;
    if (x > x1) x1 = x;
    if (y < y0) y0 = y;
    if (y > y1) y1 = y;
    if (z < z0) z0 = z;
    if (z > z1) z1 = z;
  }
  return [(x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2];
}

/** The camera of ThreeDScene: perspective projection, depth sorting and 3D shading. */
export class ThreeDCamera extends Camera {
  _frame_center!: Mobject;
  focal_distance: number;
  phi: number;
  theta: number;
  gamma: number;
  zoom: number;
  shading_factor: number;
  default_distance: number;
  light_source_start_point: Point3D;
  light_source: Mobject;
  should_apply_shading: boolean;
  exponential_projection: boolean;
  phi_tracker: ValueTracker;
  theta_tracker: ValueTracker;
  focal_distance_tracker: ValueTracker;
  gamma_tracker: ValueTracker;
  zoom_tracker: ValueTracker;
  fixed_orientation_mobjects: Map<Mobject, () => Point3DLike>;
  fixed_in_frame_mobjects: Set<Mobject>;
  rotation_matrix!: Matrix3;
  /** web: frame centre baked into the canvas transform (manim caches its Cairo context at the first frame). */
  protected _ctx_frame_center: Point3D;
  private _capture_id = 0;
  private _capturing = false;
  private _light_cache = new WeakMap<VMobject, [number, number, number]>();

  constructor(o: ThreeDCameraOptions = {}) {
    super(o);
    // web: `frame_center` is a property backed by the `_frame_center` mobject, like manim
    this._frame_center = point_mobject(this.frame_center);
    this._ctx_frame_center = to3(this.frame_center);
    Object.defineProperty(this, 'frame_center', {
      configurable: true, enumerable: true,
      get: (): Point3D => {
        const p = this._frame_center.points;
        return [p[0], p[1], p[2]];
      },
      set: (point: Point3DLike) => {
        this._frame_center.move_to(point);
      },
    });
    this.focal_distance = o.focal_distance ?? 20.0;
    this.phi = o.phi ?? 0;
    this.theta = o.theta ?? -90 * DEGREES;
    this.gamma = o.gamma ?? 0;
    this.zoom = o.zoom ?? 1;
    this.shading_factor = o.shading_factor ?? 0.2;
    this.default_distance = o.default_distance ?? 5.0;
    this.light_source_start_point = to3(o.light_source_start_point ?? add(mul(9, DOWN), mul(7, LEFT), mul(10, OUT)));
    this.light_source = point_mobject(this.light_source_start_point);
    this.should_apply_shading = o.should_apply_shading ?? true;
    this.exponential_projection = o.exponential_projection ?? false;
    this.max_allowable_norm = 3 * config.frame_width;
    this.phi_tracker = new ValueTracker(this.phi);
    this.theta_tracker = new ValueTracker(this.theta);
    this.focal_distance_tracker = new ValueTracker(this.focal_distance);
    this.gamma_tracker = new ValueTracker(this.gamma);
    this.zoom_tracker = new ValueTracker(this.zoom);
    this.fixed_orientation_mobjects = new Map();
    this.fixed_in_frame_mobjects = new Set();
    this.reset_rotation_matrix();
  }

  override capture_mobjects(mobjects: Mobject[], kw: { include_submobjects?: boolean; excluded_mobjects?: Mobject[] } = {}): void {
    this.reset_rotation_matrix();
    this._capture_id++;
    this._capturing = true;
    try {
      super.capture_mobjects(mobjects, kw);
    } finally {
      this._capturing = false;
    }
  }
  /** The trackers behind phi, theta, focal distance, gamma and zoom. */
  get_value_trackers(): ValueTracker[] {
    return [this.phi_tracker, this.theta_tracker, this.focal_distance_tracker, this.gamma_tracker, this.zoom_tracker];
  }
  /** Colours of a `shade_in_3d` VMobject, lit at its start and end corners. */
  modified_rgbas(vmobject: VMobject, rgbas: RGBA[]): RGBA[] {
    if (!this.should_apply_shading) return rgbas;
    if (vmobject.shade_in_3d && vmobject.get_num_points() > 0) {
      // get_shaded_rgb adds the same light to r, g and b; compute it once per face and frame
      const [ls, le] = this._corner_lights(vmobject);
      const a = rgbas[0], b = rgbas.length < 2 ? rgbas[0] : rgbas[1];
      return [[a[0] + ls, a[1] + ls, a[2] + ls, a[3]], [b[0] + le, b[1] + le, b[2] + le, b[3]]];
    }
    return rgbas;
  }
  /** web: the light get_shaded_rgb adds at the start and end corners (cached during one capture). */
  private _corner_lights(vm: VMobject): [number, number] {
    const cached = this._light_cache.get(vm);
    if (cached && this._capturing && cached[0] === this._capture_id) return [cached[1], cached[2]];
    const l = this.light_source.points;
    const light_source_point = [l[0], l[1], l[2]];
    const ls = get_shaded_rgb([0, 0, 0], get_3d_vmob_start_corner(vm), get_3d_vmob_start_corner_unit_normal(vm), light_source_point)[0];
    const le = get_shaded_rgb([0, 0, 0], get_3d_vmob_end_corner(vm), get_3d_vmob_end_corner_unit_normal(vm), light_source_point)[0];
    if (this._capturing) this._light_cache.set(vm, [this._capture_id, ls, le]);
    return [ls, le];
  }
  override get_stroke_rgbas(vmobject: VMobject, background = false): RGBA[] {
    return this.modified_rgbas(vmobject, vmobject.get_stroke_rgbas(background));
  }
  override get_fill_rgbas(vmobject: VMobject): RGBA[] {
    return this.modified_rgbas(vmobject, vmobject.get_fill_rgbas());
  }
  /** Family members to draw, back to front: `shade_in_3d` ones by depth, the others last. */
  override get_mobjects_to_display(mobjects: Mobject[], include_submobjects = true, excluded_mobjects: Mobject[] | null = null): Mobject[] {
    const mobs = super.get_mobjects_to_display(mobjects, include_submobjects, excluded_mobjects);
    const R = this.get_rotation_matrix();
    const keyed = mobs.map((mob, i) => {
      let key = Infinity;
      if ((mob as any).shade_in_3d) {
        const p = leaf_center(mob) ?? mob.get_z_index_reference_point();
        key = R[2][0] * p[0] + R[2][1] * p[1] + R[2][2] * p[2];
      }
      return { mob, key, i };
    });
    keyed.sort((a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : a.i - b.i));
    return keyed.map((k) => k.mob);
  }

  get_phi(): number {
    return this.phi_tracker.get_value();
  }
  get_theta(): number {
    return this.theta_tracker.get_value();
  }
  get_focal_distance(): number {
    return this.focal_distance_tracker.get_value();
  }
  get_gamma(): number {
    return this.gamma_tracker.get_value();
  }
  get_zoom(): number {
    return this.zoom_tracker.get_value();
  }
  set_phi(value: number): void {
    this.phi_tracker.set_value(value);
  }
  set_theta(value: number): void {
    this.theta_tracker.set_value(value);
  }
  set_focal_distance(value: number): void {
    this.focal_distance_tracker.set_value(value);
  }
  set_gamma(value: number): void {
    this.gamma_tracker.set_value(value);
  }
  set_zoom(value: number): void {
    this.zoom_tracker.set_value(value);
  }
  reset_rotation_matrix(): void {
    this.rotation_matrix = this.generate_rotation_matrix();
  }
  get_rotation_matrix(): Matrix3 {
    return this.rotation_matrix;
  }
  /** rotation_about_z(gamma) @ rotation_matrix(-phi, RIGHT) @ rotation_about_z(-theta - 90°). */
  generate_rotation_matrix(): Matrix3 {
    const phi = this.get_phi(), theta = this.get_theta(), gamma = this.get_gamma();
    const matrices = [rotation_about_z(-theta - 90 * DEGREES), rotation_matrix(-phi, RIGHT), rotation_about_z(gamma)];
    let result: number[][] = [[1, 0, 0], [0, 1, 0], [0, 0, 1]];
    for (const M of matrices) result = [0, 1, 2].map((i) => [0, 1, 2].map((j) => M[i][0] * result[0][j] + M[i][1] * result[1][j] + M[i][2] * result[2][j]));
    return result as Matrix3;
  }

  /** Rotate and put points in perspective (x, y scaled; z is the depth). */
  project_points(points: Points): Points {
    const out = new Float64Array(points.length);
    const fc = this._frame_center.points;
    const cx = fc[0], cy = fc[1], cz = fc[2];
    const fd = this.get_focal_distance(), zoom = this.get_zoom(), R = this.rotation_matrix, expo = this.exponential_projection;
    const [r0, r1, r2] = R;
    for (let i = 0; i < points.length; i += 3) {
      const x = points[i] - cx, y = points[i + 1] - cy, z = points[i + 2] - cz;
      const px = r0[0] * x + r0[1] * y + r0[2] * z;
      const py = r1[0] * x + r1[1] * y + r1[2] * z;
      const pz = r2[0] * x + r2[1] * y + r2[2] * z;
      let factor: number;
      if (expo) factor = pz < 0 ? fd / (fd - pz) : Math.exp(pz / fd);
      else factor = fd - pz < 0 ? 1e6 : fd / (fd - pz);
      out[i] = px * factor * zoom;
      out[i + 1] = py * factor * zoom;
      out[i + 2] = pz;
    }
    return out;
  }
  /** Project a single point. */
  project_point(point: Point3DLike): Point3D {
    const p = this.project_points(Float64Array.from(to3(point)));
    return [p[0], p[1], p[2]];
  }
  override transform_points_pre_display(mobject: Mobject, points: Points): Points {
    points = super.transform_points_pre_display(mobject, points);
    if (this.fixed_in_frame_mobjects.has(mobject)) return points;
    const center_func = this.fixed_orientation_mobjects.get(mobject);
    if (center_func) {
      const center = to3(center_func());
      const nc = this.project_point(center);
      const dx = nc[0] - center[0], dy = nc[1] - center[1], dz = nc[2] - center[2];
      const out = new Float64Array(points.length);
      for (let i = 0; i < points.length; i += 3) {
        out[i] = points[i] + dx;
        out[i + 1] = points[i + 1] + dy;
        out[i + 2] = points[i + 2] + dz;
      }
      return out;
    }
    return this.project_points(points);
  }
  /** web: projected points are relative to the frame centre, so the canvas transform uses the initial one. */
  override set_world_transform(): void {
    const pw = this.pixel_width, ph = this.pixel_height, fw = this.frame_width, fh = this.frame_height, fc = this._ctx_frame_center;
    this.ctx!.setTransform(pw / fw, 0, 0, -(ph / fh), pw / 2 - fc[0] * (pw / fw), ph / 2 + fc[1] * (ph / fh));
  }

  /** Keep these mobjects facing the camera (only their centre is projected). */
  add_fixed_orientation_mobjects(...args: unknown[]): void {
    const [mobjects, kw] = starArgs<Mobject>(args);
    const use_static_center_func: boolean = kw.use_static_center_func ?? false;
    const center_func: (() => Point3DLike) | null = kw.center_func ?? null;
    const get_static_center_func = (mobject: Mobject) => {
      const point = mobject.get_center();
      return () => point;
    };
    for (const mobject of mobjects) {
      let func: () => Point3DLike;
      if (center_func) func = center_func;
      else if (use_static_center_func) func = get_static_center_func(mobject);
      else func = () => mobject.get_center();
      for (const submob of mobject.get_family()) this.fixed_orientation_mobjects.set(submob, func);
    }
  }
  /** Draw these mobjects unprojected, as if glued to the screen. */
  add_fixed_in_frame_mobjects(...mobjects: Mobject[]): void {
    for (const mobject of extract_mobject_family_members(mobjects)) this.fixed_in_frame_mobjects.add(mobject);
  }
  remove_fixed_orientation_mobjects(...mobjects: Mobject[]): void {
    for (const mobject of extract_mobject_family_members(mobjects)) this.fixed_orientation_mobjects.delete(mobject);
  }
  remove_fixed_in_frame_mobjects(...mobjects: Mobject[]): void {
    for (const mobject of extract_mobject_family_members(mobjects)) this.fixed_in_frame_mobjects.delete(mobject);
  }
}

