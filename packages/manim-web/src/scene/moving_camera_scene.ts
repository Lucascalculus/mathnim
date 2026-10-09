// manim/scene/moving_camera_scene.py
import type { Animation } from '../animation/animation';
import { MovingCamera } from '../camera/moving_camera';
import type { Mobject } from '../mobject/mobject';
import { extract_mobject_family_members } from '../utils/family';
import { list_update } from '../utils/iterables';
import type { Kwargs } from '../utils/pyargs';
import { register } from '../utils/registry';
import { Scene } from './scene';

/** A Scene whose camera can move and zoom: animate `this.camera.frame`. */
export class MovingCameraScene extends Scene {
  constructor(kw: Kwargs = {}) {
    const { camera_class = MovingCamera, ...rest } = kw;
    super({ ...rest, camera: rest.camera ?? new camera_class(rest.camera_kwargs ?? {}) });
  }
  /** Mobjects that change during `animations` (all of them when the camera frame moves). */
  get_moving_mobjects(...animations: Animation[]): Mobject[] {
    // Scene.get_moving_mobjects: everything from the first mobject that needs updating
    const animation_mobjects = animations.map((a) => a.mobject);
    const mobjects = this.get_mobject_family_members();
    let moving_mobjects: Mobject[] = [];
    for (let i = 0; i < mobjects.length; i++) {
      const mob = mobjects[i];
      if (animation_mobjects.includes(mob) || mob.get_family_updaters().length > 0 || this.foreground_mobjects.includes(mob)) {
        moving_mobjects = mobjects.slice(i);
        break;
      }
    }
    const all_moving_mobjects = extract_mobject_family_members(moving_mobjects);
    const indicators: Mobject[] = (this.camera as any).get_mobjects_indicating_movement?.() ?? [];
    for (const movement_indicator of indicators) if (all_moving_mobjects.includes(movement_indicator)) return list_update(this.mobjects, moving_mobjects);
    return moving_mobjects;
  }
}

register({ MovingCameraScene });
