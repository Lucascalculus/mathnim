// ScenePlayer (web extension): plays a recorded Scene on a canvas.
//
//   const player = new ScenePlayer(new MyScene(), canvas);
//   await player.load();          // runs construct(), records the timeline
//   player.play();                // real-time playback with sound
//   player.seek_time(3.5);        // exact frame at 3.5 s (paused or playing)
//
// Every frame is computed by manim's own stepping rules (fixed dt, updaters
// every frame); seeking restores the snapshot at the start of the segment and
// simulates forward. After the timeline ends the player can stay "live":
// updaters keep running and `play_now()` animates in response to the user.
import { config } from '../_config';
import type { Animation } from '../animation/animation';
import type { Mobject } from '../mobject/mobject';
import type { Scene, SceneSegment } from '../scene/scene';
import { init_tex } from '../utils/tex/mathjax';
import { load_fonts } from './text/fonts';

/**
 * Load what mobjects need before they can be built (TeX engine, fonts).
 * ScenePlayer.load calls it; call it yourself before constructing mobjects
 * outside construct() (scene constructors, class fields, module code).
 */
export async function preload(o: { tex?: boolean } = {}): Promise<void> {
  if (o.tex !== false) await init_tex();
  await load_fonts();
}

/**
 * How a picture waits for a voice (ScenePlayer.wait_for), worked out in seconds: `starts[k]` is where section k+1
 * begins on the scene's own clock (-1: no section there), `length` the scene's own length, `at[k]` when the voice
 * reaches beat k, `end` when it stops. Section k+1 waits `waits[k]` before it starts, or starts `late[k]` after its
 * beat (its picture before it outlasts the words); the last frame holds `end_wait`, or the picture runs `tail`
 * seconds past the voice. With a `lead`, each section aims that long before its beat (late is still counted from the
 * beat itself).
 */
export function voice_waits(starts: number[], length: number, at: number[], end: number, lead = 0): { waits: number[]; late: number[]; end_wait: number; tail: number } {
  const waits = starts.map(() => 0), late = starts.map(() => 0);
  let held = 0;
  starts.forEach((t, k) => {
    if (t <= 0 || k >= at.length) return;
    const gap = Math.max(0, at[k] - lead) - (t + held);
    if (gap > 0) {
      waits[k] = gap;
      held += gap;
    } else late[k] = Math.max(0, t + held - at[k]);
  });
  const over = end - (length + held);
  return { waits, late, end_wait: Math.max(0, over), tail: Math.max(0, -over) };
}

export interface PlayerOptions {
  /** Keep running updaters after the end (for interactive scenes). */
  live?: boolean;
  /** Called after every drawn frame. */
  on_frame?: (time: number, player: ScenePlayer) => void;
  /** Called when playback reaches the end. */
  on_end?: (player: ScenePlayer) => void;
  audio?: boolean;
  /** Preload MathJax so Tex/MathTex can be created in construct() (default true). */
  tex?: boolean;
}

export class ScenePlayer {
  scene: Scene;
  canvas: HTMLCanvasElement | OffscreenCanvas;
  opts: PlayerOptions;
  fps: number;
  dt: number;
  seg_starts: number[] = [];
  total_frames = 0;
  frame = -1;
  playing = false;
  loaded = false;
  /** Playback speed (1 = real time). Change with set_rate(). */
  rate = 1;
  private cur_seg = -1;
  private cur_j = -1;
  private raf = 0;
  private t_start = 0;
  private f_start = 0;
  private audio: AudioPlayback | null = null;
  private live_loop = 0;
  /** Frames the picture holds still after each segment (wait_for); empty for none. */
  private holds: number[] = [];

  constructor(scene: Scene, canvas: HTMLCanvasElement | OffscreenCanvas, opts: PlayerOptions = {}) {
    this.scene = scene;
    this.canvas = canvas;
    this.opts = opts;
    this.fps = config.frame_rate;
    this.dt = 1 / this.fps;
    scene.camera.set_canvas(canvas);
  }

  async load(): Promise<this> {
    await preload({ tex: this.opts.tex }); // Text/TeX are built synchronously in construct()
    await this.scene.render();
    this.lay_out();
    this.loaded = true;
    if (this.opts.audio !== false && this.scene.sounds.length && typeof AudioContext !== 'undefined') this.audio = new AudioPlayback(this.scene.sounds);
    await this.audio?.load();
    this.seek_frame(0);
    return this;
  }
  /** Where each segment starts on the timeline: its frames, then the frames it holds still (wait_for). */
  private lay_out(): void {
    let f = 0;
    this.seg_starts = this.scene.segments.map((s, i) => {
      const start = f;
      f += s.n_frames + (this.holds[i] ?? 0);
      return start;
    });
    this.total_frames = f;
  }
  /**
   * Where each section after the first begins on the scene's own clock (seconds, before any waits): the start of its
   * first segment, -1 for a section that has none (opened after the last animation).
   */
  section_starts(): number[] {
    const segs = this.scene.segments;
    let f = 0;
    const starts = segs.map((sg) => ((f += sg.n_frames), f - sg.n_frames));
    return this.scene.sections.slice(1).map((sec) => {
      const i = segs.findIndex((sg) => sg.t0 >= sec.time - 1e-6);
      return i < 0 ? -1 : starts[i] * this.dt;
    });
  }
  /** The scene's own length in seconds, before any waits. */
  get natural_duration(): number {
    return this.scene.segments.reduce((n, sg) => n + sg.n_frames, 0) * this.dt;
  }
  /**
   * Let the picture wait for a voice. Section k of the scene (begun by its k-th next_section()) starts no earlier
   * than at[k-1] seconds, the picture holding the frame before it until then; after its last frame it holds until
   * `end`; with a `lead`, each section aims that long before its beat. The timeline (duration, time, seek_time) then
   * runs on the voice's clock. Call again with other times (a
   * different voice) or with nothing to drop the waits; the picture stays where it is. (voice_waits computes the
   * waits; the lesson doctor and tools/beats use it too, so what they report is what plays.)
   */
  wait_for(at: number[] = [], end = 0, lead = 0): void {
    const segs = this.scene.segments;
    if (!segs.length) return;
    const [si, j] = this.frame >= 0 && this.frame < this.total_frames ? this.locate(this.frame) : [-1, 0];
    const starts = this.section_starts();
    const plan = voice_waits(starts, this.natural_duration, at, end, lead);
    const holds = segs.map(() => 0);
    starts.forEach((t, k) => {
      if (t <= 0 || !plan.waits[k]) return;
      const first = segs.findIndex((sg) => sg.t0 >= this.scene.sections[k + 1].time - 1e-6);
      holds[first - 1] += Math.round(plan.waits[k] * this.fps);
    });
    holds[segs.length - 1] += Math.round(plan.end_wait * this.fps);
    this.holds = holds;
    this.lay_out();
    // the same picture as before, on the new timeline
    if (si >= 0) {
      this.frame = this.seg_starts[si] + j;
      if (this.playing) {
        this.t_start = performance.now();
        this.f_start = this.frame;
      }
    }
  }
  get duration(): number {
    return this.total_frames * this.dt;
  }
  get time(): number {
    return Math.max(0, this.frame) * this.dt;
  }

  // ---------------------------------------------------------------- frame computation
  private locate(f: number): [number, number] {
    const s = this.seg_starts;
    let lo = 0, hi = s.length - 1;
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1;
      if (s[mid] <= f) lo = mid;
      else hi = mid - 1;
    }
    const seg = this.scene.segments[lo];
    return [lo, Math.min(f - s[lo], Math.max(0, seg.n_frames - 1))];
  }
  /** Compute the scene state for global frame `f` (does not draw). */
  compute_frame(f: number): void {
    f = Math.max(0, Math.min(f, Math.max(0, this.total_frames - 1)));
    if (this.total_frames === 0) f = 0;
    const [si, j] = this.locate(f);
    const seg: SceneSegment = this.scene.segments[si];
    if (si !== this.cur_seg || j < this.cur_j) {
      this.scene.restore(seg.snapshot);
      this.cur_seg = si;
      this.cur_j = -1;
    }
    if (!seg.is_static) {
      this.scene.animations = seg.animations;
      for (let k = this.cur_j + 1; k <= j; k++) this.scene.update_to_time(k * this.dt);
    }
    this.cur_j = j;
    this.frame = f;
  }
  draw(): void {
    this.scene.camera.render_frame(this.scene.get_render_mobjects());
    this.opts.on_frame?.(this.time, this);
  }
  /** Show the final state (after the last animation finished), like manim's save_last_frame. */
  show_end(): void {
    const segs = this.scene.segments;
    this.scene.restore(segs[segs.length - 1].snapshot);
    this.cur_seg = -1;
    this.frame = this.total_frames;
    this.draw();
  }
  seek_frame(f: number): void {
    this.compute_frame(f);
    this.draw();
    if (this.playing) {
      this.t_start = performance.now();
      this.f_start = this.frame;
      this.audio?.start(this.time);
    }
  }
  seek_time(t: number): void {
    this.seek_frame(Math.floor(t * this.fps + 1e-6));
  }

  // ---------------------------------------------------------------- playback
  play(): void {
    if (this.playing) return;
    if (this.frame >= this.total_frames - 1) this.compute_frame(0);
    this.playing = true;
    this.stop_live();
    this.t_start = performance.now();
    this.f_start = this.frame;
    this.audio?.start(this.time);
    const tick = () => {
      if (!this.playing) return;
      const f = this.f_start + Math.floor(((performance.now() - this.t_start) / 1000) * this.fps * this.rate);
      if (f >= this.total_frames) {
        this.compute_frame(this.total_frames - 1);
        this.draw();
        this.pause();
        this.opts.on_end?.(this);
        if (this.opts.live) this.start_live();
        return;
      }
      if (f !== this.frame) {
        this.compute_frame(f);
        this.draw();
      }
      this.raf = requestAnimationFrame(tick);
    };
    this.raf = requestAnimationFrame(tick);
  }
  pause(): void {
    this.playing = false;
    cancelAnimationFrame(this.raf);
    this.audio?.stop();
  }
  /** Change playback speed without losing the current position. */
  set_rate(rate: number): void {
    this.rate = rate;
    if (this.audio) this.audio.rate = rate;
    if (this.playing) {
      this.t_start = performance.now();
      this.f_start = this.frame;
      this.audio?.start(this.time);
    }
  }
  toggle(): void {
    if (this.playing) this.pause();
    else this.play();
  }

  // ---------------------------------------------------------------- live mode
  /** Run updaters in real time and redraw (after the timeline, or for sandboxes). */
  start_live(): void {
    if (this.live_loop) return;
    let last = performance.now();
    const loop = () => {
      const now = performance.now();
      const dt = Math.min(0.10000073, (now - last) / 1000); // (the odd last digits are on purpose: docs/FINGERPRINTS.md)
      last = now;
      this.scene.update_mobjects(dt);
      this.scene.update_self(dt);
      this.draw();
      this.live_loop = requestAnimationFrame(loop);
    };
    this.live_loop = requestAnimationFrame(loop);
  }
  stop_live(): void {
    cancelAnimationFrame(this.live_loop);
    this.live_loop = 0;
  }
  /** Redraw once (e.g. after changing a ValueTracker from a UI control). */
  refresh(): void {
    this.scene.update_mobjects(0);
    this.draw();
  }
  /** Play animations immediately, in real time, outside the recorded timeline. */
  play_now(...args: unknown[]): Promise<void> {
    const scene = this.scene;
    const kw = args.length && typeof args[args.length - 1] === 'object' && Object.getPrototypeOf(args[args.length - 1]) === Object.prototype ? (args.pop() as Record<string, unknown>) : {};
    const anims: Animation[] = scene.compile_animations(args, kw);
    scene.animations = anims;
    scene.add_mobjects_from_animations(anims);
    scene.begin_animations();
    scene.last_t = 0;
    const run_time = Math.max(...anims.map((a) => a.run_time));
    const wasLive = !!this.live_loop;
    this.stop_live();
    return new Promise((resolve) => {
      const t0 = performance.now();
      const loop = () => {
        const t = (performance.now() - t0) / 1000;
        if (t >= run_time) {
          scene.animations = anims;
          for (const a of anims) {
            a.finish();
            a.clean_up_from_scene(scene);
          }
          scene.update_mobjects(0);
          this.draw();
          if (wasLive || this.opts.live) this.start_live();
          resolve();
          return;
        }
        scene.update_to_time(t);
        this.draw();
        requestAnimationFrame(loop);
      };
      requestAnimationFrame(loop);
    });
  }
  /** Mobjects currently drawn (for hit testing in interactive layers). */
  visible_mobjects(): Mobject[] {
    return this.scene.get_render_mobjects();
  }
}

/** Plays the scene's add_sound() clips in sync with the player (Web Audio). */
class AudioPlayback {
  sounds: { src: string; time: number; gain: number | null }[];
  ac: AudioContext;
  buffers = new Map<string, AudioBuffer>();
  playing: AudioBufferSourceNode[] = [];
  rate = 1;
  constructor(sounds: { src: string; time: number; gain: number | null }[]) {
    this.sounds = sounds;
    this.ac = new AudioContext();
  }
  async load(): Promise<void> {
    await Promise.all(this.sounds.map(async (s) => {
      if (this.buffers.has(s.src)) return;
      const data = await fetch(s.src).then((r) => r.arrayBuffer());
      this.buffers.set(s.src, await this.ac.decodeAudioData(data));
    }));
  }
  start(t: number): void {
    this.stop();
    if (this.ac.state === 'suspended') void this.ac.resume();
    const now = this.ac.currentTime + 0.02;
    for (const s of this.sounds) {
      const buf = this.buffers.get(s.src);
      if (!buf || s.time + buf.duration <= t) continue;
      const src = this.ac.createBufferSource();
      src.buffer = buf;
      src.playbackRate.value = this.rate;
      let node: AudioNode = src;
      if (s.gain !== null) {
        const g = this.ac.createGain();
        g.gain.value = Math.pow(10, s.gain / 20);
        src.connect(g);
        node = g;
      }
      node.connect(this.ac.destination);
      src.start(now + Math.max(0, s.time - t) / this.rate, Math.max(0, t - s.time));
      this.playing.push(src);
    }
  }
  stop(): void {
    for (const s of this.playing) {
      try {
        s.stop();
      } catch {
        /* already stopped */
      }
    }
    this.playing = [];
  }
}
