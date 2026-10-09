// manim/camera/moving_camera.py
//
// web: Camera stores frame_center / frame_width / frame_height as plain fields;
// MovingCamera replaces them with accessors backed by `this.frame` (a
// ScreenRectangle mobject). Since the frame is a mobject it is part of every
// scene snapshot, so seeking reproduces camera moves exactly.
import { config } from '../_config';
import { DOWN, LEFT, ORIGIN, RIGHT, UP } from '../constants';
import { ScreenRectangle } from '../mobject/frame';
import { Mobject } from '../mobject/mobject';
import type { ParsableManimColor } from '../utils/color/core';
import { WHITE } from '../utils/color/manim_colors';
import { NO_DEEP_COPY } from '../utils/copy';
import { create_canvas } from '../utils/images';
import { register } from '../utils/registry';
import { to3, type Point3D, type Point3DLike } from '../utils/vector';
import { Camera, type CameraOptions } from './camera';

export interface MovingCameraOptions extends CameraOptions {
  frame?: Mobject | null;
  fixed_dimension?: number;
  default_frame_stroke_color?: ParsableManimColor;
  default_frame_stroke_width?: number;
  [key: string]: unknown;
}

/** A camera whose view is given by a movable `frame` mobject. */
export class MovingCamera extends Camera {
  declare frame: Mobject;
  declare fixed_dimension: number;
  declare default_frame_stroke_color: ParsableManimColor;
  declare default_frame_stroke_width: number;

  constructor(o: MovingCameraOptions = {}) {
    super(o);
    // web: drop the plain fields Camera created so the frame-backed accessors below apply
    delete (this as any).frame_center;
    delete (this as any).frame_width;
    delete (this as any).frame_height;
    this.fixed_dimension = o.fixed_dimension ?? 0;
    this.default_frame_stroke_color = o.default_frame_stroke_color ?? WHITE;
    this.default_frame_stroke_width = o.default_frame_stroke_width ?? 0;
    let frame = o.frame ?? null;
    if (frame === null) {
      frame = new ScreenRectangle({ height: config.frame_height });
      (frame as any).set_stroke(this.default_frame_stroke_color, this.default_frame_stroke_width);
    }
    this.frame = frame;
    // Camera.__init__ assigns these through the (frame-backed) properties
    this.frame_center = to3(o.frame_center ?? ORIGIN);
    this.frame_height = o.frame_height ?? config.frame_height;
    this.frame_width = o.frame_width ?? config.frame_width;
    this.resize_frame_shape();
  }

  /** Change the pixel size (manim's Camera.reset_pixel_shape); used by MultiCamera for sub-cameras. */
  reset_pixel_shape(new_height: number, new_width: number, like_canvas: unknown = null): void {
    new_height = Math.max(1, Math.trunc(new_height));
    new_width = Math.max(1, Math.trunc(new_width));
    this.pixel_width = new_width;
    this.pixel_height = new_height;
    if (!this.canvas) {
      this.canvas = create_canvas(new_width, new_height, like_canvas);
      this.ctx = this.canvas.getContext('2d') as any;
    } else if (this.canvas.width !== new_width || this.canvas.height !== new_height) {
      this.canvas.width = new_width;
      this.canvas.height = new_height;
    }
    this.resize_frame_shape();
    this.reset();
  }
  get_mobjects_indicating_movement(): Mobject[] {
    return [this.frame];
  }
  /** Zoom (and move) the frame so that it fits `mobjects`; returns an animation builder when `animate`. */
  auto_zoom(mobjects: Iterable<Mobject>, margin = 0, only_mobjects_in_frame = false, animate = true): any {
    const [xl, xr, yu, yd] = this._get_bounding_box(mobjects, only_mobjects_in_frame);
    const x = (xl + xr) / 2;
    const y = (yu + yd) / 2;
    const new_width = Math.abs(xl - xr);
    const new_height = Math.abs(yu - yd);
    const m_target: any = animate ? this.frame.animate : this.frame;
    if (new_width / this.frame.width > new_height / this.frame.height) return m_target.set_x(x).set_y(y).set({ width: new_width + margin });
    return m_target.set_x(x).set_y(y).set({ height: new_height + margin });
  }
  protected _get_bounding_box(mobjects: Iterable<Mobject>, only_mobjects_in_frame: boolean): [number, number, number, number] {
    let located = false;
    let xl = 0, xr = 1, yu = 1, yd = 0;
    for (const m of mobjects) {
      if (m === this.frame || (only_mobjects_in_frame && !this.is_in_frame(m))) continue;
      const l = m.get_critical_point(LEFT)[0], r = m.get_critical_point(RIGHT)[0];
      const u = m.get_critical_point(UP)[1], d = m.get_critical_point(DOWN)[1];
      if (!located) {
        [xl, xr, yu, yd] = [l, r, u, d];
        located = true;
      } else {
        if (l < xl) xl = l;
        if (r > xr) xr = r;
        if (u > yu) yu = u;
        if (d < yd) yd = d;
      }
    }
    if (!located) throw new Error("Could not determine bounding box of the mobjects given to 'auto_zoom'.");
    return [xl, xr, yu, yd];
  }
}

// frame-backed properties (manim's @property frame_height / frame_width / frame_center)
Object.defineProperties(MovingCamera.prototype, {
  frame_height: {
    get(this: MovingCamera): number {
      return this.frame.height;
    },
    set(this: MovingCamera, v: number) {
      if (v !== this.frame.height) this.frame.stretch_to_fit_height(v);
    },
    configurable: true,
  },
  frame_width: {
    get(this: MovingCamera): number {
      return this.frame.width;
    },
    set(this: MovingCamera, v: number) {
      if (v !== this.frame.width) this.frame.stretch_to_fit_width(v);
    },
    configurable: true,
  },
  frame_center: {
    get(this: MovingCamera): Point3D {
      return this.frame.get_center();
    },
    set(this: MovingCamera, v: Point3DLike | Mobject) {
      this.frame.move_to(v);
    },
    configurable: true,
  },
});
// manim deep-copies cameras shallowly (Camera.__deepcopy__); share them between mobject copies
(MovingCamera.prototype as any)[NO_DEEP_COPY] = true;

register({ MovingCamera });
