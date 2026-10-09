// manim/animation/updaters/mobject_update_utils.py
import { DEGREES, RIGHT } from '../../constants';
import type { Mobject } from '../../mobject/mobject';
import { isBoundMethod, type BoundMethod } from '../../utils/bind';
import { normalize } from '../../utils/space_ops';
import type { Kwargs } from '../../utils/pyargs';
import type { Point3DLike } from '../../utils/vector';
import type { Animation } from '../animation';

function methodParts(method: BoundMethod): [Mobject, string] {
  if (!isBoundMethod(method)) throw new TypeError('Expected bind_method(mobject, "method_name")');
  return [method.__self__, method.__name__];
}

/** `always(bind_method(label, 'next_to'), dot, UP)` keeps calling the method every frame. */
export function always(method: BoundMethod, ...args: unknown[]): Mobject {
  const [mob, name] = methodParts(method);
  mob.add_updater((m: any) => m[name](...args));
  return mob;
}

/** Like `always`, but each argument is a function evaluated every frame. */
export function f_always(method: BoundMethod, ...arg_generators: (() => unknown)[]): Mobject {
  const [mob, name] = methodParts(method);
  mob.add_updater((m: any) => m[name](...arg_generators.map((g) => g())));
  return mob;
}

/** Rebuild the mobject from `func` every frame. */
export function always_redraw<M extends Mobject>(func: () => M): M {
  const mob = func();
  mob.add_updater(() => mob.become(func()));
  return mob;
}

export function always_shift<M extends Mobject>(mobject: M, direction: Point3DLike = RIGHT, rate = 0.1): M {
  const d = normalize(direction);
  mobject.add_updater((m: Mobject, dt: number) => m.shift([dt * rate * d[0], dt * rate * d[1], dt * rate * d[2]]));
  return mobject;
}

export function always_rotate<M extends Mobject>(mobject: M, rate = 20 * DEGREES, kw: Kwargs = {}): M {
  mobject.add_updater((m: Mobject, dt: number) => m.rotate(dt * rate, kw));
  return mobject;
}

/** Runs an animation as an updater, independent of scene.play timing. */
export function turn_animation_into_updater(animation: Animation, cycle = false, delay = 0): Mobject {
  const mobject = animation.mobject;
  animation.suspend_mobject_updating = false;
  animation.begin();
  animation.total_time = -delay;
  const update = (m: Mobject, dt: number) => {
    if (animation.total_time >= 0) {
      const rt = animation.get_run_time();
      if (rt <= 0) {
        animation.interpolate(1);
        animation.update_mobjects(dt);
        animation.finish();
        m.remove_updater(update);
        return;
      }
      const ratio = animation.total_time / rt;
      let alpha: number;
      if (cycle) alpha = ratio % 1;
      else {
        alpha = Math.min(1, Math.max(0, ratio));
        if (alpha >= 1) {
          animation.finish();
          m.remove_updater(update);
          return;
        }
      }
      animation.interpolate(alpha);
      animation.update_mobjects(dt);
    }
    animation.total_time += dt;
  };
  mobject.add_updater(update);
  return mobject;
}

export const cycle_animation = (animation: Animation, kw: Kwargs = {}): Mobject => turn_animation_into_updater(animation, true, kw.delay ?? 0);
