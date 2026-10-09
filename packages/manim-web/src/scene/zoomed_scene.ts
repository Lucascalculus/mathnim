// manim/scene/zoomed_scene.py
import { ApplyMethod } from '../animation/transform';
import { MovingCamera } from '../camera/moving_camera';
import { MultiCamera } from '../camera/multi_camera';
import { DEFAULT_MOBJECT_TO_EDGE_BUFFER, ORIGIN, UR } from '../constants';
import { ImageMobjectFromCamera } from '../mobject/types/image_mobject';
import { bind_method } from '../utils/bind';
import { pyargs, type Kwargs } from '../utils/pyargs';
import type { Point3DLike } from '../utils/vector';
import { MovingCameraScene } from './moving_camera_scene';

/** A scene with a zoomed-in camera shown in a separate display (activate_zooming()). */
export class ZoomedScene extends MovingCameraScene {
  declare zoomed_display_height: number;
  declare zoomed_display_width: number;
  declare zoomed_display_center: Point3DLike | null;
  declare zoomed_display_corner: Point3DLike;
  declare zoomed_display_corner_buff: number;
  declare zoomed_camera_config: Kwargs;
  declare zoomed_camera_image_mobject_config: Kwargs;
  declare zoomed_camera_frame_starting_position: Point3DLike;
  declare zoom_factor: number;
  declare image_frame_stroke_width: number;
  declare zoom_activated: boolean;
  declare zoomed_camera: MovingCamera;
  declare zoomed_display: ImageMobjectFromCamera;

  constructor(...args: unknown[]) {
    const o = pyargs(args, [], {
      camera_class: MultiCamera, zoomed_display_height: 3, zoomed_display_width: 3, zoomed_display_center: null, zoomed_display_corner: UR,
      zoomed_display_corner_buff: DEFAULT_MOBJECT_TO_EDGE_BUFFER, zoomed_camera_config: { default_frame_stroke_width: 2, background_opacity: 1 },
      zoomed_camera_image_mobject_config: {}, zoomed_camera_frame_starting_position: ORIGIN, zoom_factor: 0.15, image_frame_stroke_width: 3, zoom_activated: false,
    });
    const {
      zoomed_display_height, zoomed_display_width, zoomed_display_center, zoomed_display_corner, zoomed_display_corner_buff, zoomed_camera_config,
      zoomed_camera_image_mobject_config, zoomed_camera_frame_starting_position, zoom_factor, image_frame_stroke_width, zoom_activated, ...kw
    } = o;
    super(kw);
    Object.assign(this, {
      zoomed_display_height, zoomed_display_width, zoomed_display_center, zoomed_display_corner, zoomed_display_corner_buff, zoomed_camera_config,
      zoomed_camera_image_mobject_config, zoomed_camera_frame_starting_position, zoom_factor, image_frame_stroke_width, zoom_activated,
    });
  }
  override setup(): void {
    super.setup();
    const zoomed_camera = new MovingCamera(this.zoomed_camera_config);
    const zoomed_display = new ImageMobjectFromCamera(zoomed_camera, this.zoomed_camera_image_mobject_config);
    zoomed_display.add_display_frame();
    for (const mob of [zoomed_camera.frame, zoomed_display]) {
      mob.stretch_to_fit_height(this.zoomed_display_height);
      mob.stretch_to_fit_width(this.zoomed_display_width);
    }
    zoomed_camera.frame.scale(this.zoom_factor);
    zoomed_camera.frame.move_to(this.zoomed_camera_frame_starting_position);
    if (this.zoomed_display_center !== null) zoomed_display.move_to(this.zoomed_display_center);
    else zoomed_display.to_corner(this.zoomed_display_corner, { buff: this.zoomed_display_corner_buff });
    this.zoomed_camera = zoomed_camera;
    this.zoomed_display = zoomed_display;
  }
  /** Show the zoomed display (optionally animating the frame and display into place). */
  activate_zooming(animate = false): void {
    this.zoom_activated = true;
    (this.renderer.camera as MultiCamera).add_image_mobject_from_camera(this.zoomed_display);
    if (animate) {
      this.play(this.get_zoom_in_animation());
      this.play(this.get_zoomed_display_pop_out_animation());
    }
    this.add_foreground_mobjects(this.zoomed_camera.frame, this.zoomed_display);
  }
  get_zoom_in_animation(run_time = 2, kw: Kwargs = {}): ApplyMethod {
    const frame = this.zoomed_camera.frame;
    const full_frame_height = this.camera.frame_height;
    const full_frame_width = this.camera.frame_width;
    frame.save_state();
    frame.stretch_to_fit_width(full_frame_width);
    frame.stretch_to_fit_height(full_frame_height);
    frame.center();
    (frame as any).set_stroke({ width: 0 });
    return new ApplyMethod(bind_method(frame, 'restore'), { ...kw, run_time });
  }
  get_zoomed_display_pop_out_animation(_kw: Kwargs = {}): ApplyMethod {
    const display = this.zoomed_display;
    display.save_state();
    display.replace(this.zoomed_camera.frame, 0, true);
    return new ApplyMethod(bind_method(display, 'restore'));
  }
  get_zoom_factor(): number {
    return this.zoomed_camera.frame.height / this.zoomed_display.height;
  }
}
