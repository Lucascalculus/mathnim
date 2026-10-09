// manim/scene/three_d_scene.py
//
// Scenes with a ThreeDCamera (Cairo renderer semantics: the camera angles are
// ValueTrackers, so moving the camera is an ordinary animation).
import type { Animation } from '../animation/animation';
import { ThreeDCamera } from '../camera/three_d_camera';
import { DEGREES } from '../constants';
import { Mobject } from '../mobject/mobject';
import { VGroup, VectorizedPoint } from '../mobject/types/vectorized_mobject';
import { ValueTracker } from '../mobject/value_tracker';
import { pyargs, starArgs, type Kwargs } from '../utils/pyargs';
import { registry } from '../utils/registry';
import { mul, type Point3DLike } from '../utils/vector';
import { Scene, type SceneSnapshot } from './scene';

interface ThreeDSceneSnapshot extends SceneSnapshot {
  three_d?: { fixed_in_frame: Set<Mobject>; fixed_orientation: Map<Mobject, () => Point3DLike> };
}

/** manim's merge_dicts_recursively (later dicts win, nested plain objects are merged). */
function merge_dicts_recursively(...dicts: Kwargs[]): Kwargs {
  const out: Kwargs = {};
  for (const d of dicts) {
    for (const [k, v] of Object.entries(d)) {
      const cur = out[k];
      const plain = (x: unknown) => !!x && typeof x === 'object' && Object.getPrototypeOf(x) === Object.prototype;
      out[k] = plain(cur) && plain(v) ? merge_dicts_recursively(cur, v) : v;
    }
  }
  return out;
}

/** A Scene with a ThreeDCamera: set or animate phi/theta/gamma/zoom, fix mobjects to the screen. */
export class ThreeDScene extends Scene {
  declare camera: ThreeDCamera;
  ambient_camera_rotation: unknown;
  default_angled_camera_orientation_kwargs: Kwargs;

  constructor(kw: Kwargs = {}) {
    const { camera_class = ThreeDCamera, ambient_camera_rotation = null, default_angled_camera_orientation_kwargs = null, ...rest } = kw;
    super({ ...rest, camera: rest.camera ?? new camera_class(rest.camera_kwargs ?? {}) });
    this.ambient_camera_rotation = ambient_camera_rotation;
    this.default_angled_camera_orientation_kwargs = default_angled_camera_orientation_kwargs ?? { phi: 70 * DEGREES, theta: -135 * DEGREES };
    // web: keep the camera's mobjects in every snapshot so seeking restores the view
    const cam = this.camera;
    if (cam instanceof ThreeDCamera) this.track(...cam.get_value_trackers(), cam._frame_center, cam.light_source);
  }

  /** Set the camera angles (radians), zoom, focal distance and/or frame centre immediately. */
  set_camera_orientation(...args: unknown[]): void {
    const { phi, theta, gamma, zoom, focal_distance, frame_center } = pyargs(args, ['phi', 'theta', 'gamma', 'zoom', 'focal_distance', 'frame_center']);
    const cam = this.renderer.camera as ThreeDCamera;
    if (phi != null) cam.set_phi(phi);
    if (theta != null) cam.set_theta(theta);
    if (focal_distance != null) cam.set_focal_distance(focal_distance);
    if (gamma != null) cam.set_gamma(gamma);
    if (zoom != null) cam.set_zoom(zoom);
    if (frame_center != null) cam._frame_center.move_to(frame_center);
  }
  /** Keep rotating the camera about `about` ('theta', 'phi' or 'gamma') at `rate` radians per second. */
  begin_ambient_camera_rotation(rate = 0.02, about = 'theta'): void {
    about = about.toLowerCase();
    const trackers: Record<string, ValueTracker> = { theta: this.camera.theta_tracker, phi: this.camera.phi_tracker, gamma: this.camera.gamma_tracker };
    const x = trackers[about];
    if (!x) throw new Error('Invalid ambient rotation angle.');
    x.add_updater((_m: Mobject, dt: number) => x.increment_value(rate * dt));
    this.add(x);
  }
  /** Stop an ambient camera rotation. */
  stop_ambient_camera_rotation(about = 'theta'): void {
    about = about.toLowerCase();
    const trackers: Record<string, ValueTracker> = { theta: this.camera.theta_tracker, phi: this.camera.phi_tracker, gamma: this.camera.gamma_tracker };
    const x = trackers[about];
    if (!x) throw new Error('Invalid ambient rotation angle.');
    x.clear_updaters();
    this.remove(x);
  }
  /** Wobble the camera around its current angles, giving an illusion of depth. */
  begin_3dillusion_camera_rotation(rate = 1, origin_phi: number | null = null, origin_theta: number | null = null): void {
    const cam = this.renderer.camera as ThreeDCamera;
    const theta0 = origin_theta ?? cam.theta_tracker.get_value();
    const phi0 = origin_phi ?? cam.phi_tracker.get_value();
    const val_tracker_theta = new ValueTracker(0);
    const update_theta = (m: ValueTracker, dt: number) => {
      val_tracker_theta.increment_value(dt * rate);
      const val_for_left_right = 0.2 * Math.sin(val_tracker_theta.get_value());
      return m.set_value(theta0 + val_for_left_right);
    };
    cam.theta_tracker.add_updater(update_theta);
    this.add(cam.theta_tracker);
    const val_tracker_phi = new ValueTracker(0);
    const update_phi = (m: ValueTracker, dt: number) => {
      val_tracker_phi.increment_value(dt * rate);
      const val_for_up_down = 0.1 * Math.cos(val_tracker_phi.get_value()) - 0.1;
      return m.set_value(phi0 + val_for_up_down);
    };
    cam.phi_tracker.add_updater(update_phi);
    this.add(cam.phi_tracker);
    // web: the helper trackers live in closures; keep them in snapshots so seeking replays exactly
    this.track(val_tracker_theta, val_tracker_phi);
  }
  /** Stop the 3D illusion rotation. */
  stop_3dillusion_camera_rotation(): void {
    const cam = this.renderer.camera as ThreeDCamera;
    cam.theta_tracker.clear_updaters();
    this.remove(cam.theta_tracker);
    cam.phi_tracker.clear_updaters();
    this.remove(cam.phi_tracker);
  }
  /** Animate the camera to new angles / zoom / focal distance / frame centre (plus `added_anims`). */
  move_camera(...args: unknown[]): void {
    const o = pyargs(args, ['phi', 'theta', 'gamma', 'zoom', 'focal_distance', 'frame_center', 'added_anims'], { added_anims: [] });
    const { phi, theta, gamma, zoom, focal_distance, frame_center, added_anims, ...kwargs } = o;
    const anims: unknown[] = [];
    const cam = this.camera;
    const pairs: [number | null | undefined, ValueTracker][] = [[phi, cam.phi_tracker], [theta, cam.theta_tracker], [focal_distance, cam.focal_distance_tracker], [gamma, cam.gamma_tracker], [zoom, cam.zoom_tracker]];
    for (const [value, tracker] of pairs) if (value != null) anims.push(tracker.animate.set_value(value));
    if (frame_center != null) anims.push(cam._frame_center.animate.move_to(frame_center));
    this.play(...anims, ...Array.from(added_anims ?? []), { ...kwargs });
    if (frame_center != null) this.remove(cam._frame_center);
  }
  /** Add mobjects that always face the camera. */
  add_fixed_orientation_mobjects(...args: unknown[]): void {
    const [mobjects, kw] = starArgs<Mobject>(args);
    this.add(...mobjects);
    this.camera.add_fixed_orientation_mobjects(...mobjects, kw);
  }
  /** Add mobjects that stay fixed on the screen (e.g. titles) while the camera moves. */
  add_fixed_in_frame_mobjects(...mobjects: Mobject[]): void {
    this.add(...mobjects);
    this.camera.add_fixed_in_frame_mobjects(...mobjects);
  }
  remove_fixed_orientation_mobjects(...mobjects: Mobject[]): void {
    this.camera.remove_fixed_orientation_mobjects(...mobjects);
  }
  remove_fixed_in_frame_mobjects(...mobjects: Mobject[]): void {
    this.camera.remove_fixed_in_frame_mobjects(...mobjects);
  }
  /** Use `default_angled_camera_orientation_kwargs` (phi=70°, theta=-135°), updated by `kwargs`. */
  set_to_default_angled_camera_orientation(kwargs: Kwargs = {}): void {
    this.set_camera_orientation({ ...this.default_angled_camera_orientation_kwargs, ...kwargs });
  }

  // web: the fixed-in-frame / fixed-orientation sets are camera state that construct() may change
  override snapshot(animations: Animation[] = this.animations ?? []): SceneSnapshot {
    const s = super.snapshot(animations) as ThreeDSceneSnapshot;
    const cam = this.camera;
    if (cam instanceof ThreeDCamera) s.three_d = { fixed_in_frame: new Set(cam.fixed_in_frame_mobjects), fixed_orientation: new Map(cam.fixed_orientation_mobjects) };
    return s;
  }
  override restore(s: SceneSnapshot): void {
    super.restore(s);
    const t = (s as ThreeDSceneSnapshot).three_d, cam = this.camera;
    if (t && cam instanceof ThreeDCamera) {
      cam.fixed_in_frame_mobjects = new Set(t.fixed_in_frame);
      cam.fixed_orientation_mobjects = new Map(t.fixed_orientation);
    }
  }
}

/** A ThreeDScene with preset axes, sphere and camera settings (manim's SpecialThreeDScene). */
export class SpecialThreeDScene extends ThreeDScene {
  cut_axes_at_radius: boolean;
  camera_config: Kwargs;
  three_d_axes_config: Kwargs;
  sphere_config: Kwargs;
  default_angled_camera_position: Kwargs;
  low_quality_config: Kwargs;

  constructor(kw: Kwargs = {}) {
    const {
      cut_axes_at_radius = true,
      camera_config = { should_apply_shading: true, exponential_projection: true },
      three_d_axes_config = { num_axis_pieces: 1, axis_config: { unit_size: 2, tick_frequency: 1, numbers_with_elongated_ticks: [0, 1, 2], stroke_width: 2 } },
      sphere_config = { radius: 2, resolution: [24, 48] },
      default_angled_camera_position = { phi: 70 * DEGREES, theta: -110 * DEGREES },
      low_quality_config = { camera_config: { should_apply_shading: false }, three_d_axes_config: { num_axis_pieces: 1 }, sphere_config: { resolution: [12, 24] } },
      ...rest
    } = kw;
    // web: manim compares the renderer's pixel width with config's; they always match, so no low-quality overrides
    super(merge_dicts_recursively({}, rest));
    this.cut_axes_at_radius = cut_axes_at_radius;
    this.camera_config = camera_config;
    this.three_d_axes_config = three_d_axes_config;
    this.sphere_config = sphere_config;
    this.default_angled_camera_position = default_angled_camera_position;
    this.low_quality_config = low_quality_config;
  }
  /** ThreeDAxes built from `three_d_axes_config`, optionally cut at radius 1. */
  get_axes(): any {
    const axes = new registry.ThreeDAxes(this.three_d_axes_config);
    for (const axis of axes) {
      if (this.cut_axes_at_radius) {
        const p0 = axis.get_start();
        const p1 = axis.number_to_point(-1);
        const p2 = axis.number_to_point(1);
        const p3 = axis.get_end();
        const Line = registry.Line;
        const new_pieces = new VGroup(new Line(p0, p1), new Line(p1, p2), new Line(p2, p3));
        for (const piece of new_pieces.submobjects) piece.shade_in_3d = true;
        new_pieces.match_style(axis.pieces);
        axis.pieces.submobjects = new_pieces.submobjects;
      }
      for (const tick of axis.tick_marks) tick.add(new VectorizedPoint(mul(1.5, tick.get_center())));
    }
    return axes;
  }
  /** A Sphere built from `sphere_config` merged with `kwargs`. */
  get_sphere(kwargs: Kwargs = {}): any {
    return new registry.Sphere(merge_dicts_recursively(this.sphere_config, kwargs));
  }
  get_default_camera_position(): Kwargs {
    return this.default_angled_camera_position;
  }
  set_camera_to_default_position(): void {
    this.set_camera_orientation({ ...this.default_angled_camera_position });
  }
}
