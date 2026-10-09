// manim/animation/fading.py
import { ORIGIN } from '../constants';
import { Group, Mobject } from '../mobject/mobject';
import { isKwargs, type Kwargs } from '../utils/pyargs';
import { mul, sub, to3, type Point3D } from '../utils/vector';
import type { SceneLike } from './animation';
import { Transform } from './transform';

function split(args: unknown[]): [Mobject[], Kwargs] {
  const kw = args.length && isKwargs(args[args.length - 1]) ? (args[args.length - 1] as Kwargs) : {};
  return [(kw === args[args.length - 1] ? args.slice(0, -1) : args) as Mobject[], kw];
}

export class _Fade extends Transform {
  declare point_target: boolean;
  declare shift_vector: Point3D;
  declare scale_factor: number;
  constructor(...args: unknown[]) {
    const [mobjects, kw] = split(args);
    if (!mobjects.length) throw new Error('At least one mobject must be passed.');
    const mobject = mobjects.length === 1 ? mobjects[0] : new Group(...mobjects);
    const { shift = null, target_position = null, scale = 1, ...rest } = kw;
    let point_target = false;
    let s: Point3D;
    if (shift === null) {
      if (target_position !== null) {
        const tp = target_position instanceof Mobject ? target_position.get_center() : to3(target_position);
        s = sub(tp, mobject.get_center());
        point_target = true;
      } else s = to3(ORIGIN);
    } else s = to3(shift);
    super(mobject, rest);
    this.point_target = point_target;
    this.shift_vector = s;
    this.scale_factor = scale;
  }
  _create_faded_mobject(fadeIn: boolean): Mobject {
    const faded = this.mobject.copy();
    faded.fade(1);
    faded.shift(mul(this.shift_vector, fadeIn && !this.point_target ? -1 : 1));
    faded.scale(this.scale_factor);
    return faded;
  }
}

/** Fade in, optionally shifting and scaling from a starting offset. */
export class FadeIn extends _Fade {
  constructor(...args: unknown[]) {
    const [mobs, kw] = split(args);
    super(...mobs, { ...kw, introducer: true });
  }
  override create_target(): Mobject {
    return this.mobject;
  }
  override create_starting_mobject(): Mobject {
    return this._create_faded_mobject(true);
  }
}

/** Fade out and remove from the scene. */
export class FadeOut extends _Fade {
  constructor(...args: unknown[]) {
    const [mobs, kw] = split(args);
    super(...mobs, { ...kw, remover: true });
  }
  override create_target(): Mobject {
    return this._create_faded_mobject(false);
  }
  override clean_up_from_scene(scene: SceneLike): void {
    super.clean_up_from_scene(scene);
    this.interpolate(0);
  }
}
