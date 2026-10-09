// manim/scene/scene.py
//
// web: `render()` runs construct() once, simulating every frame exactly as
// manim's Cairo renderer would (fixed dt = 1/frame_rate, updaters every frame),
// but without drawing. It records a timeline of segments (one per play/wait)
// with a state snapshot at the start of each segment. A ScenePlayer
// (ext/player.ts) then draws any frame on demand by restoring the nearest
// snapshot and re-simulating forward, which makes pausing and seeking exact.
import { config } from '../_config';
import { Animation, Wait, prepare_animation, type SceneLike } from '../animation/animation';
import { Camera } from '../camera/camera';
import { DEFAULT_WAIT_TIME } from '../constants';
import { Mobject } from '../mobject/mobject';
import { LIVE_TRACKERS } from '../mobject/value_tracker';
import { extract_mobject_family_members } from '../utils/family';
import { list_update } from '../utils/iterables';
import { isKwargs, type Kwargs } from '../utils/pyargs';

export interface SceneSegment {
  index: number;
  /** Scene time at the first frame of this segment. */
  t0: number;
  /** Number of frames this segment occupies. */
  n_frames: number;
  /** A static wait: every frame is identical. */
  is_static: boolean;
  animations: Animation[];
  /** State after begin_animations (frame 0 before update_to_time(0)). */
  snapshot: SceneSnapshot;
  run_time: number;
  kind: 'play' | 'wait';
  section: string;
}

export interface SoundEvent {
  src: string;
  time: number;
  gain: number | null;
}
export interface Subcaption {
  content: string;
  start: number;
  end: number;
}

export class Scene implements SceneLike {
  camera: Camera;
  mobjects: Mobject[] = [];
  foreground_mobjects: Mobject[] = [];
  updaters: ((dt: number) => void)[] = [];
  always_update_mobjects: boolean;
  random_seed: number | null;
  animations: Animation[] | null = null;
  stop_condition: (() => boolean) | null = null;
  duration = 0;
  last_t = 0;
  /** Scene time in seconds (manim's renderer.time). */
  time = 0;
  num_plays = 0;
  segments: SceneSegment[] = [];
  sounds: SoundEvent[] = [];
  subcaptions: Subcaption[] = [];
  sections: { name: string; time: number }[] = [{ name: 'unnamed', time: 0 }];
  /** Extra mobjects to include in every snapshot (web extension). */
  tracked: Set<Mobject> = new Set();
  /** When false, play()/wait() only record time; used by live mode. */
  protected recording = true;
  protected frame_listener: ((scene: Scene) => void) | null = null;
  [key: string]: any;

  constructor(kw: Kwargs = {}) {
    this.camera = kw.camera ?? new Camera(kw.camera_kwargs ?? {});
    this.always_update_mobjects = kw.always_update_mobjects ?? false;
    this.random_seed = kw.random_seed ?? null;
  }

  get renderer(): { time: number; camera: Camera } {
    return { time: this.time, camera: this.camera };
  }
  toString(): string {
    return this.constructor.name;
  }

  // ---------------------------------------------------------------- lifecycle
  setup(): void {}
  construct(): void | Promise<void> {}
  tear_down(): void {}

  /** Run construct() and record the timeline. */
  async render(): Promise<this> {
    this.setup();
    await this.construct();
    this.tear_down();
    this.segments.push(this.make_segment([], 0, true, 'wait'));
    return this;
  }
  next_section(name = 'unnamed'): void {
    this.sections.push({ name, time: this.time });
  }

  // ---------------------------------------------------------------- mobject list
  update_mobjects(dt: number): void {
    for (const m of this.mobjects) m.update(dt);
  }
  update_self(dt: number): void {
    for (const f of this.updaters) f(dt);
  }
  should_update_mobjects(): boolean {
    const w = this.animations![0] as Wait;
    if (w.is_static_wait === null || w.is_static_wait === undefined) {
      const should = this.always_update_mobjects || this.updaters.length > 0 || w.stop_condition !== null || this.get_mobject_family_members().some((m) => m.has_time_based_updater());
      w.is_static_wait = !should;
    }
    return !w.is_static_wait;
  }
  get_top_level_mobjects(): Mobject[] {
    const families = this.mobjects.map((m) => m.get_family());
    const inFamily = (m: Mobject) => families.some((f) => f.slice(1).includes(m));
    return this.mobjects.filter((m) => !inFamily(m));
  }
  get_mobject_family_members(): Mobject[] {
    return extract_mobject_family_members(this.mobjects, this.camera.use_z_index);
  }
  add(...mobjects: Mobject[]): this {
    const all = [...mobjects, ...this.foreground_mobjects];
    this.restructure_mobjects(all);
    this.mobjects.push(...all);
    return this;
  }
  add_mobjects_from_animations(animations: Animation[]): void {
    let curr = this.get_mobject_family_members();
    for (const a of animations) {
      if (a.is_introducer()) continue;
      const m = a.mobject;
      if (m && !curr.includes(m)) {
        this.add(m);
        curr = curr.concat(m.get_family());
      }
    }
  }
  remove(...mobjects: Mobject[]): this {
    for (const name of ['mobjects', 'foreground_mobjects'] as const) this.restructure_mobjects(mobjects, name, false);
    return this;
  }
  replace(old_mobject: Mobject, new_mobject: Mobject): void {
    if (!old_mobject || !new_mobject) throw new Error('Specified mobjects cannot be None');
    const replaceIn = (list: Mobject[], o: Mobject, n: Mobject): boolean => {
      const ni = list.indexOf(n);
      if (ni >= 0) {
        if (o === n) return true;
        list.splice(ni, 1);
      }
      const i = list.indexOf(o);
      if (i >= 0) {
        list[i] = n;
        return true;
      }
      return list.some((m) => replaceIn(m.submobjects, o, n));
    };
    if (!(replaceIn(this.mobjects, old_mobject, new_mobject) || replaceIn(this.foreground_mobjects, old_mobject, new_mobject))) throw new Error(`Could not find ${old_mobject} in scene`);
  }
  add_updater(func: (dt: number) => void): void {
    this.updaters.push(func);
  }
  remove_updater(func: (dt: number) => void): void {
    this.updaters = this.updaters.filter((f) => f !== func);
  }
  restructure_mobjects(to_remove: readonly Mobject[], list_name: 'mobjects' | 'foreground_mobjects' = 'mobjects', extract_families = true): this {
    const rm = extract_families ? extract_mobject_family_members(to_remove, this.camera.use_z_index) : to_remove;
    this[list_name] = this.get_restructured_mobject_list(this[list_name], rm);
    return this;
  }
  get_restructured_mobject_list(mobjects: readonly Mobject[], to_remove: readonly Mobject[]): Mobject[] {
    const out: Mobject[] = [];
    const addSafe = (list: readonly Mobject[], set: Set<Mobject>) => {
      for (const m of list) {
        if (set.has(m)) continue;
        const inter = new Set(m.get_family().filter((x) => set.has(x)));
        if (inter.size) addSafe(m.submobjects, inter);
        else out.push(m);
      }
    };
    addSafe(mobjects, new Set(to_remove));
    return out;
  }
  add_foreground_mobjects(...mobjects: Mobject[]): this {
    this.foreground_mobjects = list_update(this.foreground_mobjects, mobjects);
    return this.add(...mobjects);
  }
  add_foreground_mobject(m: Mobject): this {
    return this.add_foreground_mobjects(m);
  }
  remove_foreground_mobjects(...to_remove: Mobject[]): this {
    return this.restructure_mobjects(to_remove, 'foreground_mobjects');
  }
  remove_foreground_mobject(m: Mobject): this {
    return this.remove_foreground_mobjects(m);
  }
  bring_to_front(...mobjects: Mobject[]): this {
    return this.add(...mobjects);
  }
  bring_to_back(...mobjects: Mobject[]): this {
    this.remove(...mobjects);
    this.mobjects = [...mobjects, ...this.mobjects];
    return this;
  }
  clear(): this {
    this.mobjects = [];
    this.foreground_mobjects = [];
    return this;
  }
  /** Keep a mobject in snapshots even while it is not on screen (web extension). */
  track(...mobjects: Mobject[]): this {
    for (const m of mobjects) this.tracked.add(m);
    return this;
  }

  // ---------------------------------------------------------------- play / wait
  compile_animations(args: unknown[], kwargs: Kwargs): Animation[] {
    const flat = args.flatMap((a) => (Array.isArray(a) ? a : [a]));
    const anims = flat.map((a) => {
      try {
        return prepare_animation(a);
      } catch {
        throw new TypeError(`Unexpected argument ${String(a)} passed to Scene.play().`);
      }
    });
    for (const a of anims) for (const [k, v] of Object.entries(kwargs)) (a as any)[k] = v;
    return anims;
  }
  static validate_run_time(run_time: number, method_name: string, parameter_name = 'run_time'): number {
    if (run_time <= 0) throw new Error(`${method_name} has a ${parameter_name} of ${run_time} <= 0 seconds which Manim cannot render. The ${parameter_name} must be a positive number.`);
    const spf = 1 / config.frame_rate;
    if (run_time < spf) {
      console.warn(`The original ${parameter_name} of ${method_name}, ${run_time} seconds, is too short for the current frame rate of ${config.frame_rate} FPS. Rendering with the shortest possible ${parameter_name} of ${spf} seconds instead.`);
      return spf;
    }
    return run_time;
  }
  get_run_time(animations: Animation[]): number {
    return Scene.validate_run_time(Math.max(...animations.map((a) => a.run_time)), 'Scene.play()', 'total run_time');
  }

  /** `this.play(Create(c), FadeIn(t), { run_time: 2 })` */
  play(...args: unknown[]): void {
    let kwargs: Kwargs = {};
    if (args.length && isKwargs(args[args.length - 1])) kwargs = args.pop() as Kwargs;
    const { subcaption = null, subcaption_duration = null, subcaption_offset = 0, ...animKw } = kwargs;
    const start = this.time;
    this.compile_animation_data(args, animKw);
    this.begin_animations();
    const frozen = this.is_current_animation_frozen_frame();
    this.play_internal(frozen);
    this.num_plays += 1;
    if (subcaption) {
      const rt = this.time - start;
      this.add_subcaption(subcaption, subcaption_duration ?? rt, -rt + subcaption_offset);
    }
  }
  wait(...args: unknown[]): void {
    let duration = DEFAULT_WAIT_TIME, stop_condition: (() => boolean) | null = null, frozen_frame: boolean | null = null;
    const rest = args.slice();
    const kw = rest.length && isKwargs(rest[rest.length - 1]) ? (rest.pop() as Kwargs) : {};
    if (rest.length > 0) duration = rest[0] as number;
    if (rest.length > 1) stop_condition = rest[1] as () => boolean;
    if (rest.length > 2) frozen_frame = rest[2] as boolean;
    duration = kw.duration ?? duration;
    stop_condition = kw.stop_condition ?? stop_condition;
    frozen_frame = kw.frozen_frame ?? frozen_frame;
    duration = Scene.validate_run_time(duration, 'Scene.wait()', 'duration');
    this.play(new Wait({ run_time: duration, stop_condition, frozen_frame }));
  }
  pause(duration = DEFAULT_WAIT_TIME): void {
    this.wait(duration, null, true);
  }
  wait_until(stop_condition: () => boolean, max_time = 60): void {
    this.wait(max_time, stop_condition);
  }
  compile_animation_data(args: unknown[], play_kwargs: Kwargs): this {
    if (args.length === 0) throw new Error('Called Scene.play with no animations');
    this.animations = this.compile_animations(args, play_kwargs);
    this.add_mobjects_from_animations(this.animations);
    this.last_t = 0;
    this.stop_condition = null;
    this.duration = this.get_run_time(this.animations);
    if (this.animations.length === 1 && this.animations[0] instanceof Wait) {
      if (this.should_update_mobjects()) {
        this.update_mobjects(0);
        this.stop_condition = (this.animations[0] as Wait).stop_condition;
      } else (this.animations[0] as Wait).is_static_wait = true;
    }
    return this;
  }
  begin_animations(): void {
    for (const a of this.animations!) {
      a._setup_scene(this);
      a.begin();
    }
  }
  is_current_animation_frozen_frame(): boolean {
    const a = this.animations!;
    return a[0] instanceof Wait && a.length === 1 && !!(a[0] as Wait).is_static_wait;
  }
  protected play_internal(frozen: boolean): void {
    const dt = 1 / config.frame_rate;
    const n = frozen ? Math.trunc(this.duration / dt) : Math.ceil(this.duration / dt);
    const seg = this.make_segment(this.animations!, n, frozen, this.animations!.length === 1 && this.animations![0] instanceof Wait ? 'wait' : 'play');
    this.segments.push(seg);
    if (frozen) {
      this.time += n * dt;
    } else {
      let frames = 0;
      for (let i = 0; i < n; i++) {
        this.update_to_time(i * dt);
        this.time += dt;
        frames++;
        if (this.stop_condition && this.stop_condition()) break;
      }
      seg.n_frames = frames;
    }
    this.finish_animations();
  }
  finish_animations(): void {
    for (const a of this.animations!) {
      a.finish();
      a.clean_up_from_scene(this);
    }
    this.update_mobjects(0);
  }
  update_to_time(t: number): void {
    const dt = t - this.last_t;
    this.last_t = t;
    for (const a of this.animations!) {
      a.update_mobjects(dt);
      a.interpolate(t / a.run_time);
    }
    this.update_mobjects(dt);
    this.update_self(dt);
  }

  add_subcaption(content: string, duration = 1, offset = 0): void {
    this.subcaptions.push({ content, start: this.time + offset, end: this.time + offset + duration });
  }
  /** Schedule a sound (URL) at the current time + offset. */
  add_sound(sound_file: string, time_offset = 0, gain: number | null = null): void {
    this.sounds.push({ src: sound_file, time: this.time + time_offset, gain });
  }

  // ---------------------------------------------------------------- snapshots (web)
  protected make_segment(animations: Animation[], n_frames: number, is_static: boolean, kind: 'play' | 'wait'): SceneSegment {
    return {
      index: this.segments.length, t0: this.time, n_frames, is_static, animations, kind, run_time: this.duration,
      section: this.sections[this.sections.length - 1].name, snapshot: this.snapshot(animations),
    };
  }
  snapshot(animations: Animation[] = this.animations ?? []): SceneSnapshot {
    return takeSnapshot(this, animations);
  }
  restore(s: SceneSnapshot): void {
    restoreSnapshot(this, s);
  }
  /** Mobjects to draw for the current frame, in draw order. */
  get_render_mobjects(): Mobject[] {
    return this.mobjects;
  }
}

// ---------------------------------------------------------------- snapshot machinery
export interface SceneSnapshot {
  camera: { frame_center: number[]; frame_width: number; frame_height: number };
  objects: Map<object, Record<string, unknown>>;
  mobjects: Mobject[];
  foreground_mobjects: Mobject[];
  updaters: ((dt: number) => void)[];
  last_t: number;
  time: number;
  animations: Animation[] | null;
  duration: number;
  stop_condition: (() => boolean) | null;
  /** State saved by `snapshot_hooks` (web). */
  hooks: Map<SnapshotHook, unknown>;
}

/** Extra (non-mobject) state saved with every snapshot, e.g. class-level state (web). */
export interface SnapshotHook {
  save(scene: Scene): unknown;
  restore(scene: Scene, state: unknown): void;
}
export const snapshot_hooks: SnapshotHook[] = [];

function copyValue(v: unknown): unknown {
  if (v instanceof Float64Array) return v.slice();
  if (Array.isArray(v)) return v.map((x) => (Array.isArray(x) ? x.slice() : x instanceof Float64Array ? x.slice() : x));
  if (v && typeof v === 'object' && Object.getPrototypeOf(v) === Object.prototype) return { ...(v as object) };
  return v;
}
function snapObject(o: object): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const k of Object.keys(o)) out[k] = copyValue((o as any)[k]);
  return out;
}

function collectAnimations(anims: Animation[], into: Set<Animation>): void {
  for (const a of anims) {
    if (!a || into.has(a)) continue;
    into.add(a);
    for (const v of Object.values(a)) {
      if (v instanceof Animation) collectAnimations([v], into);
      else if (Array.isArray(v)) collectAnimations(v.filter((x) => x instanceof Animation) as Animation[], into);
      else if (v && typeof v === 'object' && Array.isArray((v as any).animations)) collectAnimations((v as any).animations, into);
    }
  }
}

function takeSnapshot(scene: Scene, animations: Animation[]): SceneSnapshot {
  const anims = new Set<Animation>();
  collectAnimations(animations, anims);
  const roots: Mobject[] = [...scene.mobjects, ...scene.foreground_mobjects, ...scene.tracked];
  for (const a of anims) {
    for (const v of Object.values(a)) {
      if (v instanceof Mobject) roots.push(v);
      else if (Array.isArray(v)) for (const x of v) if (x instanceof Mobject) roots.push(x);
    }
  }
  for (const ref of LIVE_TRACKERS) {
    const t = ref.deref();
    if (t) roots.push(t);
    else LIVE_TRACKERS.delete(ref);
  }
  const frame = (scene.camera as any).frame;
  if (frame instanceof Mobject) roots.push(frame);
  const objects = new Map<object, Record<string, unknown>>();
  for (const m of extract_mobject_family_members(roots)) objects.set(m, snapObject(m));
  for (const a of anims) objects.set(a, snapObject(a));
  const cam = scene.camera as any;
  return {
    camera: { frame_center: [...cam.frame_center], frame_width: cam.frame_width, frame_height: cam.frame_height },
    objects, mobjects: scene.mobjects.slice(), foreground_mobjects: scene.foreground_mobjects.slice(), updaters: scene.updaters.slice(),
    last_t: scene.last_t, time: scene.time, animations: scene.animations, duration: scene.duration, stop_condition: scene.stop_condition,
    hooks: new Map(snapshot_hooks.map((h) => [h, h.save(scene)])),
  };
}

function restoreSnapshot(scene: Scene, s: SceneSnapshot): void {
  for (const [obj, props] of s.objects) {
    for (const k of Object.keys(obj)) if (!(k in props)) delete (obj as any)[k];
    for (const [k, v] of Object.entries(props)) (obj as any)[k] = copyValue(v);
  }
  Object.assign(scene.camera, { frame_center: [...s.camera.frame_center], frame_width: s.camera.frame_width, frame_height: s.camera.frame_height });
  scene.mobjects = s.mobjects.slice();
  scene.foreground_mobjects = s.foreground_mobjects.slice();
  scene.updaters = s.updaters.slice();
  scene.last_t = s.last_t;
  scene.animations = s.animations;
  scene.duration = s.duration;
  scene.stop_condition = s.stop_condition;
  for (const [h, v] of s.hooks) h.restore(scene, v);
}
