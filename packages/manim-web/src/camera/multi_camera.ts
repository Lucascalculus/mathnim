// manim/camera/multi_camera.py
import type { Mobject } from '../mobject/mobject';
import type { ImageMobjectFromCamera } from '../mobject/types/image_mobject';
import { list_difference_update } from '../utils/iterables';
import { register } from '../utils/registry';
import { snapshot_hooks } from '../scene/scene';
import { MovingCamera, type MovingCameraOptions } from './moving_camera';

/** A MovingCamera that also renders the sub-cameras of ImageMobjectFromCamera displays. */
export class MultiCamera extends MovingCamera {
  declare image_mobjects_from_cameras: ImageMobjectFromCamera[];
  declare allow_cameras_to_capture_their_own_display: boolean;

  constructor(o: MovingCameraOptions & { image_mobjects_from_cameras?: ImageMobjectFromCamera[] | null; allow_cameras_to_capture_their_own_display?: boolean } = {}) {
    const { image_mobjects_from_cameras = null, allow_cameras_to_capture_their_own_display = false, ...rest } = o;
    super(rest);
    this.image_mobjects_from_cameras = [];
    if (image_mobjects_from_cameras !== null) for (const imfc of image_mobjects_from_cameras) this.add_image_mobject_from_camera(imfc);
    this.allow_cameras_to_capture_their_own_display = allow_cameras_to_capture_their_own_display;
  }
  add_image_mobject_from_camera(image_mobject_from_camera: ImageMobjectFromCamera): void {
    const imfc = image_mobject_from_camera;
    if (!(imfc.camera instanceof MovingCamera)) throw new Error('ImageMobjectFromCamera needs a MovingCamera');
    this.image_mobjects_from_cameras.push(imfc);
  }
  update_sub_cameras(): void {
    for (const imfc of this.image_mobjects_from_cameras) {
      const pixel_height = this.pixel_height, pixel_width = this.pixel_width;
      (imfc.camera as MovingCamera).reset_pixel_shape(
        Math.trunc((pixel_height * imfc.height) / this.frame_height), Math.trunc((pixel_width * imfc.width) / this.frame_width), this.canvas,
      );
    }
  }
  override reset(): this {
    for (const imfc of this.image_mobjects_from_cameras) imfc.camera.reset();
    super.reset();
    return this;
  }
  override capture_mobjects(mobjects: Mobject[], kw: { include_submobjects?: boolean; excluded_mobjects?: Mobject[] } = {}): void {
    if (!this.ctx) return; // web: nothing to draw into (e.g. a headless test)
    this.update_sub_cameras();
    for (const imfc of this.image_mobjects_from_cameras) {
      let to_add = [...mobjects];
      if (!this.allow_cameras_to_capture_their_own_display) to_add = list_difference_update(to_add, imfc.get_family());
      imfc.camera.capture_mobjects(to_add, kw);
    }
    super.capture_mobjects(mobjects, kw);
  }
  override get_mobjects_indicating_movement(): Mobject[] {
    return [this.frame, ...this.image_mobjects_from_cameras.map((imfc) => (imfc.camera as MovingCamera).frame)];
  }
}

// web: the list of displays changes during construct() (activate_zooming), so it is part of snapshots
snapshot_hooks.push({
  save: (scene) => (scene.camera instanceof MultiCamera ? scene.camera.image_mobjects_from_cameras.slice() : null),
  restore: (scene, s) => {
    if (scene.camera instanceof MultiCamera && s) scene.camera.image_mobjects_from_cameras = (s as ImageMobjectFromCamera[]).slice();
  },
});

register({ MultiCamera });
