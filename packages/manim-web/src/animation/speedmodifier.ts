// manim/animation/speedmodifier.py
import { isTimeBased, type Mobject, type Updater } from '../mobject/mobject';
import { pyargs } from '../utils/pyargs';
import type { RateFunction } from '../utils/rate_functions';
import { snapshot_hooks, type Scene } from '../scene/scene';
import { Animation, Wait, prepare_animation, type SceneLike } from './animation';
import { AnimationGroup } from './composition';

type SpeedInfo = Map<number, number> | Record<string | number, number>;

/** Changes the speed of an animation piecewise (speedinfo maps progress -> speed). */
export class ChangeSpeed extends Animation {
  /** dt seen by updaters added with ChangeSpeed.add_updater while a speed change plays. */
  static dt = 0;
  static is_changing_dt = false;

  declare anim: Animation;
  declare affects_speed_updaters: boolean;
  declare t: number;
  declare speedinfo: [number, number][];
  declare functions: ((t: number) => number)[];
  declare conditions: ((t: number) => boolean)[];

  constructor(...args: unknown[]) {
    const o = pyargs(args, ['anim', 'speedinfo', 'rate_func', 'affects_speed_updaters'], { rate_func: null, affects_speed_updaters: true });
    const { anim: anim_in, speedinfo: info_in, rate_func, affects_speed_updaters, ...kwargs } = o;
    const setup = (a: unknown): Animation => ChangeSpeed.prototype.setup(a);
    let anim: Animation;
    const prepared = anim_in instanceof Animation ? anim_in : null;
    if (prepared instanceof AnimationGroup) {
      const Cls = prepared.constructor as new (...a: unknown[]) => Animation;
      anim = new Cls(...prepared.animations.map(setup), {
        group: prepared.group, run_time: prepared.run_time, rate_func: prepared.rate_func, lag_ratio: prepared.lag_ratio,
      });
    } else anim = setup(anim_in);
    if (affects_speed_updaters) {
      if (ChangeSpeed.is_changing_dt) throw new Error('Only one animation at a time can play that changes speed (dt) for ChangeSpeed updaters');
      ChangeSpeed.is_changing_dt = true;
    }
    const rf: RateFunction = rate_func ?? anim.rate_func;
    const speedinfo = ChangeSpeed._normalize_speedinfo(info_in as SpeedInfo);
    const scaled_total_time = ChangeSpeed._scaled_total_time(speedinfo);
    super(anim.mobject, { ...kwargs, rate_func: rf, run_time: scaled_total_time * anim.run_time });
    this.anim = anim;
    if (affects_speed_updaters) this.t = 0;
    this.affects_speed_updaters = affects_speed_updaters;
    this.speedinfo = speedinfo;
    this.functions = [];
    this.conditions = [];
    let prevnode = 0;
    let init_speed = speedinfo[0][1];
    let curr_time = 0;
    for (const [node, final_speed] of speedinfo.slice(1)) {
      const dur = node - prevnode;
      const [ct, is, fs, pn] = [curr_time, init_speed, final_speed, prevnode];
      this.conditions.push((t) => {
        const lower_bound = ct / scaled_total_time;
        const upper_bound = (ct + this.f_inv_1(is, fs) * dur) / scaled_total_time;
        return lower_bound <= t && t <= upper_bound;
      });
      this.functions.push((t) => this.speed_modifier((scaled_total_time * t - ct) / dur, is, fs) * dur + pn);
      curr_time += this.f_inv_1(init_speed, final_speed) * dur;
      prevnode = node;
      init_speed = final_speed;
    }
    const func = (t: number): number => {
      if (t === 1) ChangeSpeed.is_changing_dt = false;
      // numpy.piecewise: 0 where no condition holds, the last matching function otherwise
      const x = this.rate_func(t);
      let new_t = 0;
      this.conditions.forEach((c, i) => {
        if (c(x)) new_t = this.functions[i](x);
      });
      if (this.affects_speed_updaters) {
        ChangeSpeed.dt = (new_t - this.t) * this.anim.run_time;
        this.t = new_t;
      }
      return new_t;
    };
    this.anim.set_rate_func(func);
  }
  speed_modifier(x: number, init_speed: number, final_speed: number): number {
    return ((final_speed ** 2 - init_speed ** 2) * x ** 2) / 4 + init_speed * x;
  }
  f_inv_1(init_speed: number, final_speed: number): number {
    return 2 / (init_speed + final_speed);
  }
  /** Sorted [progress, speed] pairs with the 0 and 1 nodes filled in (manim's speedinfo dict). */
  static _normalize_speedinfo(info: SpeedInfo): [number, number][] {
    const entries: [number, number][] = info instanceof Map ? [...info.entries()].map(([k, v]) => [Number(k), v]) : Object.entries(info).map(([k, v]) => [Number(k), v as number]);
    const sorted = () => entries.slice().sort((a, b) => a[0] - b[0]);
    if (!entries.some(([k]) => k === 0)) entries.push([0, 1]);
    if (!entries.some(([k]) => k === 1)) entries.push([1, sorted()[entries.length - 1][1]]);
    return sorted();
  }
  static _scaled_total_time(speedinfo: [number, number][]): number {
    let prevnode = 0;
    let init_speed = speedinfo[0][1];
    let total_time = 0;
    for (const [node, final_speed] of speedinfo.slice(1)) {
      total_time += (node - prevnode) * (2 / (init_speed + final_speed));
      prevnode = node;
      init_speed = final_speed;
    }
    return total_time;
  }
  setup(anim: unknown): Animation {
    if (anim instanceof Wait && anim.constructor === Wait) (anim as any).interpolate = (alpha: number) => anim.rate_func(alpha);
    return prepare_animation(anim);
  }
  get_scaled_total_time(): number {
    return ChangeSpeed._scaled_total_time(this.speedinfo);
  }
  /** Add an updater whose dt follows the speed of the playing ChangeSpeed animation. */
  static add_updater(mobject: Mobject, update_function: Updater, index: number | null = null, call_updater = false): void {
    if (isTimeBased(update_function)) {
      mobject.add_updater((mob: Mobject, dt: number) => (update_function as (m: Mobject, dt: number) => unknown)(mob, ChangeSpeed.is_changing_dt ? ChangeSpeed.dt : dt), index, call_updater);
    } else mobject.add_updater(update_function, index, call_updater);
  }
  override interpolate(alpha: number): void {
    this.anim.interpolate(alpha);
  }
  override update_mobjects(dt: number): void {
    this.anim.update_mobjects(dt);
  }
  override finish(): void {
    ChangeSpeed.is_changing_dt = false;
    this.anim.finish();
  }
  override begin(): void {
    this.anim.begin();
  }
  override clean_up_from_scene(scene: SceneLike): void {
    this.anim.clean_up_from_scene(scene);
  }
  override _setup_scene(scene: SceneLike | null): void {
    this.anim._setup_scene(scene);
  }
}

// web: the class-level dt state is part of every scene snapshot, so seeking is exact
snapshot_hooks.push({
  save: (_scene: Scene) => [ChangeSpeed.dt, ChangeSpeed.is_changing_dt],
  restore: (_scene: Scene, s: unknown) => {
    [ChangeSpeed.dt, ChangeSpeed.is_changing_dt] = s as [number, boolean];
  },
});
