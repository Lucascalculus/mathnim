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
    let f = 0;
    this.seg_starts = this.scene.segments.map((s) => {
      const start = f;
      f += s.n_frames;
      return start;
    });
    this.total_frames = f;
    this.loaded = true;
    if (this.opts.audio !== false && this.scene.sounds.length && typeof AudioContext !== 'undefined') this.audio = new AudioPlayback(this.scene.sounds);
    await this.audio?.load();
    this.seek_frame(0);
    return this;
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
      const dt = Math.min(0.1, (now - last) / 1000);
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
