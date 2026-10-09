// manim/animation/animation.py
import { Group, Mobject, _AnimationBuilder, isAnimationBuilder } from '../mobject/mobject';
import { linear, smooth, type RateFunction } from '../utils/rate_functions';
import { pyargs, type Kwargs } from '../utils/pyargs';
import { remove_list_redundancies } from '../utils/iterables';
import { add_construct_hook } from '../utils/callable';

export const DEFAULT_ANIMATION_RUN_TIME = 1.0;
export const DEFAULT_ANIMATION_LAG_RATIO = 0.0;

/** Minimal interface of the scene as seen by animations. */
export interface SceneLike {
  add(...mobjects: Mobject[]): unknown;
  remove(...mobjects: Mobject[]): unknown;
  replace(old: Mobject, new_: Mobject): unknown;
  get_mobject_family_members(): Mobject[];
}

export class Animation {
  declare mobject: Mobject;
  declare starting_mobject: Mobject;
  declare rate_func: RateFunction;
  declare reverse_rate_function: boolean;
  declare name: string | null;
  declare remover: boolean;
  declare introducer: boolean;
  declare suspend_mobject_updating: boolean;
  declare lag_ratio: number;
  declare _on_finish: (scene: SceneLike) => void;
  declare _run_time: number;
  [key: string]: any;

  constructor(...args: unknown[]) {
    const o = pyargs(args, ['mobject', 'lag_ratio', 'run_time', 'rate_func', 'reverse_rate_function', 'name', 'remover', 'suspend_mobject_updating', 'introducer'], {
      mobject: null, lag_ratio: DEFAULT_ANIMATION_LAG_RATIO, run_time: DEFAULT_ANIMATION_RUN_TIME, rate_func: smooth,
      reverse_rate_function: false, name: null, remover: false, suspend_mobject_updating: true, introducer: false,
    });
    this._typecheck_input(o.mobject);
    this.run_time = o.run_time;
    this.rate_func = o.rate_func;
    this.reverse_rate_function = o.reverse_rate_function;
    this.name = o.name;
    this.remover = o.remover;
    this.introducer = o.introducer;
    this.suspend_mobject_updating = o.suspend_mobject_updating;
    this.lag_ratio = o.lag_ratio;
    this._on_finish = o._on_finish ?? (() => {});
    this.starting_mobject = new Mobject();
    this.mobject = o.mobject ?? new Mobject();
  }
  get run_time(): number {
    return this._run_time;
  }
  /** Change default keyword arguments for this animation class; no arguments restores them. */
  static set_default(kwargs: Record<string, unknown> = {}): void {
    (this as any)._defaults = Object.keys(kwargs).length ? { ...((this as any)._defaults ?? {}), ...kwargs } : undefined;
  }
  set run_time(v: number) {
    if (v < 0) throw new Error(`The run_time of ${this.constructor.name} cannot be negative. The given value was ${v}.`);
    this._run_time = v;
  }
  protected _typecheck_input(mobject: unknown): void {
    if (mobject !== null && mobject !== undefined && !(mobject instanceof Mobject)) throw new TypeError('Animation only works on Mobjects');
  }
  toString(): string {
    return this.name ?? `${this.constructor.name}(${String(this.mobject)})`;
  }
  begin(): void {
    this.starting_mobject = this.create_starting_mobject();
    if (this.suspend_mobject_updating) this.mobject.suspend_updating();
    this.interpolate(0);
  }
  finish(): void {
    this.interpolate(1);
    if (this.suspend_mobject_updating && this.mobject) this.mobject.resume_updating();
  }
  clean_up_from_scene(scene: SceneLike): void {
    this._on_finish(scene);
    if (this.is_remover()) scene.remove(this.mobject);
  }
  _setup_scene(scene: SceneLike | null): void {
    if (!scene) return;
    if (this.is_introducer() && !scene.get_mobject_family_members().includes(this.mobject)) scene.add(this.mobject);
  }
  create_starting_mobject(): Mobject {
    return this.mobject.copy();
  }
  get_all_mobjects(): Mobject[] {
    return [this.mobject, this.starting_mobject];
  }
  get_all_families_zipped(): Mobject[][] {
    return zipFamilies(this.get_all_mobjects(), false);
  }
  update_mobjects(dt: number): void {
    for (const m of this.get_all_mobjects_to_update()) m.update(dt);
  }
  get_all_mobjects_to_update(): Mobject[] {
    return this.get_all_mobjects().filter((m) => m !== this.mobject);
  }
  copy(): this {
    const c = Object.create(Object.getPrototypeOf(this));
    Object.assign(c, this);
    return c;
  }
  interpolate(alpha: number): void {
    this.interpolate_mobject(alpha);
  }
  interpolate_mobject(alpha: number): void {
    const families = this.get_all_families_zipped();
    families.forEach((mobs, i) => this.interpolate_submobject(mobs[0], mobs[1], ...mobs.slice(2), this.get_sub_alpha(alpha, i, families.length)));
  }
  interpolate_submobject(_submobject: Mobject, _starting: Mobject, ..._rest: any[]): void {}
  get_sub_alpha(alpha: number, index: number, num_submobjects: number): number {
    const full = (num_submobjects - 1) * this.lag_ratio + 1;
    const value = alpha * full;
    const lower = index * this.lag_ratio;
    return this.reverse_rate_function ? this.rate_func(1 - (value - lower)) : this.rate_func(value - lower);
  }
  set_run_time(run_time: number): this {
    this.run_time = run_time;
    return this;
  }
  get_run_time(): number {
    return this.run_time;
  }
  set_rate_func(rate_func: RateFunction): this {
    this.rate_func = rate_func;
    return this;
  }
  get_rate_func(): RateFunction {
    return this.rate_func;
  }
  set_name(name: string): this {
    this.name = name;
    return this;
  }
  is_remover(): boolean {
    return this.remover;
  }
  is_introducer(): boolean {
    return this.introducer;
  }
}

/** zip(*(mob.family_members_with_points() for mob in mobs)) */
export function zipFamilies(mobs: Mobject[], strict: boolean): Mobject[][] {
  const fams = mobs.map((m) => m.family_members_with_points());
  const n = Math.min(...fams.map((f) => f.length));
  if (strict && fams.some((f) => f.length !== n)) throw new Error('Transform: families of different sizes after alignment');
  return Array.from({ length: n }, (_, i) => fams.map((f) => f[i]));
}

/** Turn an `.animate` builder (or an Animation) into an Animation. */
export function prepare_animation(anim: unknown): Animation {
  if (isAnimationBuilder(anim)) return (anim as any).build();
  if (anim instanceof _AnimationBuilder) return anim.build();
  if (anim instanceof Animation) return anim;
  throw new TypeError(`Object ${String(anim)} cannot be converted to an animation`);
}

/** Holds the scene still; static waits are drawn as a frozen frame. */
export class Wait extends Animation {
  declare duration: number;
  declare stop_condition: (() => boolean) | null;
  declare is_static_wait: boolean | null;
  constructor(...args: unknown[]) {
    const o = pyargs(args, ['run_time', 'stop_condition', 'frozen_frame', 'rate_func'], { run_time: 1, stop_condition: null, frozen_frame: null, rate_func: linear });
    if (o.stop_condition && o.frozen_frame) throw new Error('A static Wait animation cannot have a stop condition.');
    const { stop_condition, frozen_frame, ...rest } = o;
    super(null, rest);
    this.duration = o.run_time;
    this.stop_condition = stop_condition;
    this.is_static_wait = frozen_frame;
  }
  override begin(): void {}
  override finish(): void {}
  override clean_up_from_scene(): void {}
  override update_mobjects(): void {}
  override interpolate(): void {}
}

/** Adds mobjects to the scene (useful inside Succession). */
export class Add extends Animation {
  constructor(...args: unknown[]) {
    const mobs = args.filter((a) => a instanceof Mobject) as Mobject[];
    const kw = (args.find((a) => !(a instanceof Mobject)) as Kwargs) ?? {};
    super(mobs.length === 1 ? mobs[0] : new Group(...mobs), { run_time: 0.0, ...kw, introducer: true });
  }
  override begin(): void {}
  override finish(): void {}
  override clean_up_from_scene(): void {}
  override update_mobjects(): void {}
  override interpolate(): void {}
}

/** Register `func(mobject, ...args)` as the animation used for `animation_class` on `mobject_class`. */
export function override_animation(mobject_class: typeof Mobject, animation_class: Function, func: (mob: any, ...args: any[]) => Animation): void {
  mobject_class.add_animation_override(animation_class, func);
}

export { remove_list_redundancies };

// Animation.__new__ in manim: a mobject class can replace an animation with its own.
add_construct_hook((cls, args) => {
  if (!(cls.prototype instanceof Animation) || !(args[0] instanceof Mobject)) return undefined;
  const func = (args[0].constructor as typeof Mobject).animation_override_for(cls);
  return func ? (func as any)(...args) : undefined;
});
