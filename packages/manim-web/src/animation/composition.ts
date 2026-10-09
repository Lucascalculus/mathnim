// manim/animation/composition.py
import { Group, Mobject } from '../mobject/mobject';
import { remove_list_redundancies } from '../utils/iterables';
import { isKwargs, type Kwargs } from '../utils/pyargs';
import { linear } from '../utils/rate_functions';
import { Animation, prepare_animation, type SceneLike } from './animation';

export const DEFAULT_LAGGED_START_LAG_RATIO = 0.05;

function splitArgs(args: unknown[]): [unknown[], Kwargs] {
  if (args.length && isKwargs(args[args.length - 1])) return [args.slice(0, -1), args[args.length - 1] as Kwargs];
  return [args, {}];
}
function flatten(xs: unknown[]): unknown[] {
  return xs.flatMap((x) => (Array.isArray(x) ? flatten(x) : [x]));
}

interface Timing {
  anim: Animation;
  start: number;
  end: number;
}

/** Plays several animations together (with an optional lag between starts). */
export class AnimationGroup extends Animation {
  declare animations: Animation[];
  declare group: Mobject;
  declare anims_with_timings: Timing[];
  declare anims_begun: boolean[];
  declare anims_finished: boolean[];
  declare max_end_time: number;
  declare anim_group_time: number;

  constructor(...args: unknown[]) {
    const [animsArg, kw] = splitArgs(args);
    const animations = flatten(animsArg).map(prepare_animation);
    const { group = null, run_time = null, rate_func = linear, lag_ratio = 0, ...rest } = kw;
    const g = group ?? new Group(...remove_list_redundancies(animations.filter((a) => !a.is_introducer()).map((a) => a.mobject)));
    super(g, { rate_func, lag_ratio, ...rest });
    this.animations = animations;
    this.group = g;
    this.rate_func = rate_func;
    this.run_time = this.init_run_time(run_time);
  }
  override get_all_mobjects(): Mobject[] {
    return [...this.group];
  }
  override begin(): void {
    if (!this.animations.length) throw new Error(`Trying to play ${this} without animations, this is not supported. Please add at least one subanimation.`);
    this.anim_group_time = 0.0;
    if (this.suspend_mobject_updating) this.group.suspend_updating();
    for (const a of this.animations) a.begin();
  }
  override _setup_scene(scene: SceneLike | null): void {
    for (const a of this.animations) a._setup_scene(scene);
  }
  override finish(): void {
    for (const a of this.animations) a.finish();
    this.anims_begun = this.anims_begun.map(() => true);
    this.anims_finished = this.anims_finished.map(() => true);
    if (this.suspend_mobject_updating) this.group.resume_updating();
  }
  override clean_up_from_scene(scene: SceneLike): void {
    this._on_finish(scene);
    for (const a of this.animations) {
      if (this.remover) a.remover = this.remover;
      a.clean_up_from_scene(scene);
    }
  }
  override update_mobjects(dt: number): void {
    this.anims_with_timings.forEach((t, i) => {
      if (this.anims_begun[i] && !this.anims_finished[i]) t.anim.update_mobjects(dt);
    });
  }
  init_run_time(run_time: number | null): number {
    this.build_animations_with_timings();
    this.max_end_time = Math.max(0, ...this.anims_with_timings.map((t) => t.end));
    return run_time ?? this.max_end_time;
  }
  build_animations_with_timings(): void {
    const n = this.animations.length;
    this.anims_with_timings = [];
    this.anims_begun = new Array(n).fill(false);
    this.anims_finished = new Array(n).fill(false);
    let start = 0;
    this.animations.forEach((a, i) => {
      if (i > 0) start += this.animations[i - 1].run_time * this.lag_ratio;
      this.anims_with_timings.push({ anim: a, start, end: start + a.run_time });
    });
  }
  override interpolate(alpha: number): void {
    const t = this.rate_func(alpha) * this.max_end_time;
    const back = t < this.anim_group_time;
    const newBegun = this.anims_with_timings.map((w) => t >= w.start);
    const newFinished = this.anims_with_timings.map((w) => t > w.end);
    this.anims_with_timings.forEach((w, i) => {
      if (!((this.anims_begun[i] || newBegun[i]) && (!this.anims_finished[i] || !newFinished[i]))) return;
      let rt = w.end - w.start;
      const zero = rt === 0;
      if (zero) rt = 1;
      let sub = (t - w.start) / rt;
      if (back) {
        if (sub < 0 || zero) sub = 0;
      } else if (sub > 1 || zero) sub = 1;
      w.anim.interpolate(sub);
    });
    this.anim_group_time = t;
    this.anims_begun = newBegun;
    this.anims_finished = newFinished;
  }
}

/** Plays animations one after another. */
export class Succession extends AnimationGroup {
  declare active_index: number;
  declare active_animation: Animation | null;
  declare active_start_time: number | null;
  declare active_end_time: number | null;
  declare scene: SceneLike | null;
  constructor(...args: unknown[]) {
    const [anims, kw] = splitArgs(args);
    super(...anims, { lag_ratio: 1, ...kw });
    this.scene = null;
  }
  override begin(): void {
    if (!this.animations.length) throw new Error(`Trying to play ${this} without animations, this is not supported. Please add at least one subanimation.`);
    this.update_active_animation(0);
  }
  override finish(): void {
    while (this.active_animation !== null) this.next_animation();
  }
  override update_mobjects(dt: number): void {
    if (this.active_animation) this.active_animation.update_mobjects(dt);
  }
  override _setup_scene(scene: SceneLike | null): void {
    if (!scene) return;
    if (this.is_introducer()) for (const a of this.animations) if (!a.is_introducer() && a.mobject) scene.add(a.mobject);
    this.scene = scene;
  }
  update_active_animation(index: number): void {
    this.active_index = index;
    if (index >= this.animations.length) {
      this.active_animation = null;
      this.active_start_time = null;
      this.active_end_time = null;
    } else {
      this.active_animation = this.animations[index];
      this.active_animation._setup_scene(this.scene);
      this.active_animation.begin();
      this.active_start_time = this.anims_with_timings[index].start;
      this.active_end_time = this.anims_with_timings[index].end;
    }
  }
  next_animation(): void {
    if (this.active_animation) this.active_animation.finish();
    this.update_active_animation(this.active_index + 1);
  }
  override interpolate(alpha: number): void {
    const t = this.rate_func(alpha) * this.max_end_time;
    while (this.active_end_time !== null && t >= this.active_end_time) this.next_animation();
    if (this.active_animation && this.active_start_time !== null) {
      const rt = this.active_animation.run_time;
      this.active_animation.interpolate(rt !== 0 ? (t - this.active_start_time) / rt : 1.0);
    }
  }
}

/** AnimationGroup with a small lag between the start of each animation. */
export class LaggedStart extends AnimationGroup {
  constructor(...args: unknown[]) {
    const [anims, kw] = splitArgs(args);
    super(...anims, { lag_ratio: DEFAULT_LAGGED_START_LAG_RATIO, ...kw });
  }
}

/** Applies `animation_class` to every submobject, lagged. */
export class LaggedStartMap extends LaggedStart {
  constructor(animation_class: any, mobject: Mobject, ...rest: unknown[]) {
    const [pos, kw] = splitArgs(rest);
    const arg_creator = (pos[0] as ((m: Mobject) => unknown) | undefined) ?? kw.arg_creator ?? ((m: Mobject) => m);
    const run_time = kw.run_time ?? 2;
    const lag_ratio = kw.lag_ratio ?? DEFAULT_LAGGED_START_LAG_RATIO;
    const { arg_creator: _a, run_time: _r, lag_ratio: _l, ...animKw } = kw;
    const animations = [...mobject].map((sub) => {
      const a = arg_creator(sub);
      const spread = a instanceof Mobject ? [...a] : Array.isArray(a) ? a : [a];
      return new animation_class(...spread, animKw);
    });
    super(...animations, { run_time, lag_ratio });
  }
}
