// FigurePlayer: plays a figure on a canvas, with the same surface as manim-web's ScenePlayer (load, play, pause,
// seek, wait_for, show_end, start_live …), so the runtime, the lesson view, export and the tools drive either.
//
// What it does differently:
//   - the canvas has the size it is shown at (CSS px × device pixels), not a fixed 1920×1080, and the figure is laid
//     out for that size: on a phone its rows become columns and the stage grows to the figure's height;
//   - a frame is drawn only when something it shows changed: while the learner looks, nothing runs at all;
//   - seeking is exact and costs one frame (the script is a pure function of time), whatever the distance.
import { voice_waits } from 'manim-web/ext/player';
import { look } from '@mathnim/look';
import type { Figure } from './figure';
import type { XY } from './geom';
import type { Handle } from './kinds';
import { init_gpu } from './gpu';
import { check_act, type Act, type ActRecord, type Hands } from './acts';
import { Mirror } from './mirror';
import { ease_in_out } from './script';
import { watch_writes, type Param } from './state';
import { load_tex } from './tex';

export interface FigurePlayerOptions {
  live?: boolean;
  on_frame?: (time: number, player: FigurePlayer) => void;
  on_end?: (player: FigurePlayer) => void;
  audio?: boolean;
  tex?: boolean;
  /** A fixed size in CSS px (tools, tests); default: the size the canvas is shown at. */
  size?: { w: number; h?: number; dpr?: number };
  /** No DOM mirror (a canvas only recorded or exported); and the mirror's name for the figure. */
  mirror?: boolean;
  label?: string;
}

type Canvas = HTMLCanvasElement | OffscreenCanvas;
const raf = (f: () => void): number => (typeof requestAnimationFrame !== 'undefined' ? requestAnimationFrame(f) : (setTimeout(f, 16) as unknown as number));
const caf = (h: number): void => (typeof cancelAnimationFrame !== 'undefined' ? cancelAnimationFrame(h) : clearTimeout(h));
const now = (): number => (typeof performance !== 'undefined' ? performance.now() : Date.now());

export class FigurePlayer {
  /** Marks this player as the engine's (the runtime and the view test for it). */
  readonly engine = true;
  scene: Figure;
  canvas: Canvas;
  opts: FigurePlayerOptions;
  fps = 60;
  dt = 1 / 60;
  total_frames = 1;
  frame = -1;
  playing = false;
  loaded = false;
  rate = 1;
  /** Frames drawn and frames not drawn because nothing had changed (live mode and playback). */
  stats = { drawn: 0, skipped: 0, layout_ms: 0, draw_ms: 0 };
  /** Called when the learner moves a handle (FigureUI sets it). */
  on_input: (() => void) | null = null;
  private waits: { at: number; w: number }[] = [];
  private end_wait = 0;
  private raf = 0;
  private t_start = 0;
  private f_start = 0;
  private live_off: (() => void) | null = null;
  private live_raf = 0;
  private interactive = false;
  private held: Handle | null = null;
  private last: XY = [0, 0];
  private focus_h = 0;
  private ro: ResizeObserver | null = null;
  private watched = false;
  private sized = '';
  private dpr = 1;
  private saved: { w: number; h: number; style: string } | null = null;
  private off: (() => void)[] = [];

  constructor(fig: Figure, canvas: Canvas, opts: FigurePlayerOptions = {}) {
    this.scene = fig;
    this.canvas = canvas;
    this.opts = opts;
  }

  // ---------------------------------------------------------------- loading and size
  async load(): Promise<this> {
    if (this.opts.tex !== false) await load_tex();
    this.scene.build();
    // a figure with a GPU field asks for the device first (it draws with WebGL2 or the CPU if there is none)
    if (this.scene.registry.all().some((t) => t.kind === 'field')) await init_gpu();
    const c = this.canvas as HTMLCanvasElement;
    this.saved = { w: c.width, h: c.height, style: c.style?.cssText ?? '' };
    this.fit();
    // (the canvas itself is watched too: one built before it is in the page, as the tutor's are, is laid out again
    // for its real size once it is put there)
    if (typeof ResizeObserver !== 'undefined' && !this.opts.size && typeof (c as { addEventListener?: unknown }).addEventListener === 'function') {
      this.ro = new ResizeObserver(() => {
        if (c.parentElement && !this.watched) {
          this.watched = true;
          this.ro?.observe(c.parentElement);
        }
        if (this.fit()) this.draw(true);
      });
      this.ro.observe(c);
      if (c.parentElement) {
        this.watched = true;
        this.ro.observe(c.parentElement);
      }
    }
    this.lay_out();
    this.loaded = true;
    this.seek_frame(0);
    return this;
  }
  /**
   * Size the canvas and lay the figure out for it. On a wide stage the figure fills the stage's box; on a narrow one
   * (a phone) it is laid out at the stage's width and as tall as it needs, and the stage grows to fit.
   * Returns whether anything changed.
   */
  fit(): boolean {
    const c = this.canvas as HTMLCanvasElement, l = look();
    let w: number, h: number | undefined, dpr: number;
    const stage = c.parentElement;
    if (this.opts.size || !stage) {
      w = this.opts.size?.w ?? c.width;
      h = this.opts.size ? this.opts.size.h : c.height;
      dpr = this.opts.size?.dpr ?? 1;
    } else {
      w = stage.clientWidth;
      if (w < 8) return false; // not on screen yet
      const phone = w < l.layout.phone_below;
      stage.classList.add('mn-flow');
      stage.classList.toggle('mn-flow-phone', phone);
      h = phone ? undefined : stage.clientHeight || undefined;
      dpr = Math.min(2, typeof devicePixelRatio !== 'undefined' ? devicePixelRatio : 1);
    }
    const key = `${w}|${h ?? 'auto'}|${dpr}|${this.scene.lang}`;
    if (key === this.sized) return false;
    this.sized = key;
    const t0 = now();
    const size = this.scene.layout_for(w, h);
    this.stats.layout_ms += now() - t0;
    this.dpr = dpr;
    // (even pixel sizes: a video encoder (H.264, 4:2:0) takes no odd ones, and export_video records this canvas)
    c.width = 2 * Math.round((size.w * dpr) / 2);
    c.height = 2 * Math.round((size.h * dpr) / 2);
    if (stage && !this.opts.size && c.style) {
      // phone: the canvas sets the stage's height; wide: it fills the stage
      c.style.height = h === undefined ? `${size.h}px` : '';
    }
    return true;
  }
  /** Give the canvas back as it was (the next step may be a manim scene on the same canvas). */
  release(): void {
    this.pause();
    this.stop_live();
    this.set_interactive(false);
    this.mirror?.destroy();
    this.mirror = null;
    this.ro?.disconnect();
    this.ro = null;
    const c = this.canvas as HTMLCanvasElement;
    if (this.saved) {
      c.width = this.saved.w;
      c.height = this.saved.h;
      if (c.style) c.style.cssText = this.saved.style;
      c.parentElement?.classList.remove('mn-flow', 'mn-flow-phone');
      this.saved = null;
    }
  }

  // ---------------------------------------------------------------- the timeline (with the voice's waits)
  private lay_out(): void {
    const extra = this.waits.reduce((a, x) => a + x.w, 0) + this.end_wait;
    this.total_frames = Math.max(1, Math.ceil((this.scene.duration + extra) * this.fps - 1e-6));
  }
  section_starts(): number[] {
    return this.scene.section_starts();
  }
  get natural_duration(): number {
    return this.scene.duration;
  }
  /** Let the picture wait for a voice: as ScenePlayer.wait_for (the same voice_waits plan, so tools agree). */
  wait_for(at: number[] = [], end = 0, lead = 0): void {
    const ft = this.frame >= 0 ? this.fig_time(this.time) : 0;
    const starts = this.section_starts();
    const plan = voice_waits(starts, this.natural_duration, at, end, lead);
    this.waits = starts.map((t, k) => ({ at: t, w: t > 0 ? plan.waits[k] : 0 })).filter((x) => x.w > 0);
    this.end_wait = plan.end_wait;
    this.lay_out();
    // the same picture as before, on the new clock
    if (this.frame >= 0) {
      this.frame = Math.round(this.player_time(ft) * this.fps);
      if (this.playing) {
        this.t_start = now();
        this.f_start = this.frame;
      }
    }
  }
  /** Player time (the voice's clock) → the figure's own time. */
  fig_time(T: number): number {
    let shift = 0;
    for (const { at, w } of this.waits) {
      if (T < at + shift) return T - shift;
      if (T < at + shift + w) return at;
      shift += w;
    }
    return Math.min(T - shift, this.scene.duration);
  }
  private player_time(t: number): number {
    let shift = 0;
    for (const { at, w } of this.waits) {
      if (t < at) break;
      shift += w;
    }
    return t + shift;
  }
  get duration(): number {
    return this.total_frames * this.dt;
  }
  get time(): number {
    return Math.max(0, this.frame) * this.dt;
  }
  compute_frame(f: number): void {
    f = Math.max(0, Math.min(f, this.total_frames - 1));
    this.frame = f;
    this.scene.at(this.fig_time(f * this.dt));
  }
  /** Draw the current state (only what changed; nothing when nothing did). */
  draw(force = false): void {
    const g = (this.canvas as HTMLCanvasElement).getContext('2d') as CanvasRenderingContext2D | null;
    if (g && this.loaded) {
      const t0 = now();
      const drew = this.scene.draw(g, this.dpr, { force });
      if (drew) {
        this.stats.drawn++;
        this.stats.draw_ms += now() - t0;
        this.mirror_sync();
      } else this.stats.skipped++;
    }
    this.opts.on_frame?.(this.time, this);
  }

  // ---------------------------------------------------------------- the DOM mirror (mirror.ts)
  /** The accessible layer over the canvas (made once the canvas is in a page; none in node, export or offscreen). */
  mirror: Mirror | null = null;
  private mirrored = 0;
  private mirror_sync(): void {
    if (this.opts.mirror === false) return;
    const c = this.canvas as HTMLCanvasElement;
    if (!this.mirror) {
      if (typeof c.after !== 'function' || !c.isConnected || !c.parentElement) return;
      const plot = this.scene.registry.all().find((t) => t.kind === 'plot' && t.says);
      this.mirror = new Mirror(this.scene, c, {
        label: this.opts.label ?? (plot?.says ? plot.says[this.scene.lang] : undefined),
        quiet: () => !this.playing,
        nudge: (h, dx, dy) => {
          h.nudge(dx, dy);
          h.o.on_end?.();
          this.on_input?.();
        },
      });
    }
    // (while the script plays, a few times a second is enough for a reader; at rest, every change)
    const t = now();
    if (this.playing && t - this.mirrored < 200) return;
    this.mirrored = t;
    this.mirror.sync();
  }
  show_end(): void {
    this.frame = this.total_frames;
    this.scene.at(this.scene.duration);
    this.draw();
  }
  seek_frame(f: number): void {
    this.compute_frame(f);
    this.draw();
    if (this.playing) {
      this.t_start = now();
      this.f_start = this.frame;
    }
  }
  seek_time(t: number): void {
    this.seek_frame(Math.floor(t * this.fps + 1e-6));
  }
  refresh(): void {
    this.draw();
  }

  // ---------------------------------------------------------------- playback
  play(): void {
    if (this.playing) return;
    if (this.frame >= this.total_frames - 1) this.compute_frame(0);
    this.playing = true;
    this.stop_live();
    this.t_start = now();
    this.f_start = this.frame;
    const tick = () => {
      if (!this.playing) return;
      const f = this.f_start + Math.floor(((now() - this.t_start) / 1000) * this.fps * this.rate);
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
      this.raf = raf(tick);
    };
    this.raf = raf(tick);
  }
  pause(): void {
    this.playing = false;
    caf(this.raf);
  }
  set_rate(rate: number): void {
    this.rate = rate;
    if (this.playing) {
      this.t_start = now();
      this.f_start = this.frame;
    }
  }
  toggle(): void {
    if (this.playing) this.pause();
    else this.play();
  }

  // ---------------------------------------------------------------- live: a frame only when something changed
  start_live(): void {
    if (this.live_off) return;
    this.live_off = watch_writes(() => {
      if (!this.live_raf) this.live_raf = raf(() => {
        this.live_raf = 0;
        this.draw();
      });
    });
    this.draw();
  }
  stop_live(): void {
    this.live_off?.();
    this.live_off = null;
    if (this.live_raf) caf(this.live_raf);
    this.live_raf = 0;
  }

  // ---------------------------------------------------------------- the tutor's hands (acts.ts)
  /**
   * Do one of the tutor's acts as a hand would: a param travels to its value, the light comes up on a thing (and
   * fades by itself), a note appears on a thing, or everything the tutor moved goes back. Resolves when the motion is
   * done; an act that cannot be done is recorded with why, and nothing moves.
   */
  async act(a: Act): Promise<ActRecord> {
    const fig = this.scene, h = fig.hands(), why = check_act(fig, a);
    if (why) return h.record(a, why);
    if (this.playing) this.pause();
    this.start_live();
    const slow = look().reduced_motion ? 0 : 1;
    if (a.op === 'set') {
      const p = h.param(a.param)!, r = p.spec.range, to = r ? Math.max(r[0], Math.min(r[1], a.to)) : a.to;
      h.keep(p);
      await this.tween(p, to, 0.9 * slow);
      p.set(to); // (snapped to its step, as the hand's moves are)
    } else if (a.op === 'point') {
      h.light.target = a.id;
      await this.tween(h.light.level, 1, 0.25 * slow);
      this.fade_light(h, 2.6);
    } else if (a.op === 'note') h.show_note(a.id, a.text);
    else {
      await Promise.all(h.kept_values().map(([p, v]) => this.tween(p, v, 0.7 * slow)));
      h.forget();
      h.light.level.set(0);
      h.show_note(null);
    }
    return h.record(a);
  }
  private light_token = 0;
  private fade_light(h: Hands, after: number): void {
    const token = ++this.light_token;
    setTimeout(() => {
      if (token === this.light_token) void this.tween(h.light.level, 0, 0.6);
    }, after * 1000);
  }
  /** Move a param to a value over dur seconds (slow in, slow out), a frame at a time. */
  private tween(p: Param<number>, to: number, dur: number): Promise<void> {
    const from = p.peek();
    if (dur <= 0 || from === to) {
      p.set(to, true);
      return Promise.resolve();
    }
    const t0 = typeof performance !== 'undefined' ? performance.now() : Date.now();
    return new Promise((res) => {
      const step = () => {
        const u = Math.min(1, ((typeof performance !== 'undefined' ? performance.now() : Date.now()) - t0) / (dur * 1000));
        p.set(from + (to - from) * ease_in_out(u), true);
        if (u < 1) raf(step);
        else res();
      };
      raf(step);
    });
  }

  // ---------------------------------------------------------------- the hand
  /** Turn the figure's handles on (an explore step) or off. */
  set_interactive(on: boolean): void {
    if (on === this.interactive) return;
    this.interactive = on;
    for (const h of this.scene.handles) h.opacity.set(on ? 1 : 0);
    const c = this.canvas as HTMLCanvasElement;
    if (!c.addEventListener) return;
    if (!on) {
      for (const f of this.off) f();
      this.off = [];
      if (c.style) c.style.cursor = '';
      return;
    }
    const on_ev = <K extends keyof HTMLElementEventMap>(type: K, f: (e: HTMLElementEventMap[K]) => void) => {
      c.addEventListener(type, f as EventListener);
      this.off.push(() => c.removeEventListener(type, f as EventListener));
    };
    if (c.style) c.style.touchAction = 'none';
    if (!c.hasAttribute('tabindex')) c.tabIndex = 0;
    on_ev('pointerdown', (e) => {
      const p = this.at(e), h = this.hit(p);
      if (!h) return;
      e.preventDefault();
      this.held = h;
      this.focus_h = this.scene.handles.indexOf(h);
      h.state.set(2);
      c.setPointerCapture?.(e.pointerId);
      c.style.cursor = 'grabbing';
      // (a relative handle, an orbit, moves by the drag from here)
      this.last = p;
      if (!h.o.relative) h.move_to(p);
      this.on_input?.();
    });
    on_ev('pointermove', (e) => {
      const p = this.at(e);
      if (this.held) {
        if (this.held.o.relative) this.held.drag_by(p[0] - this.last[0], p[1] - this.last[1]);
        else this.held.move_to(p);
        this.last = p;
        this.on_input?.();
        return;
      }
      const h = this.hit(p);
      for (const x of this.scene.handles) x.state.set(x === h ? 1 : 0);
      c.style.cursor = h ? 'grab' : '';
    });
    const up = () => {
      const h = this.held;
      if (!h) return;
      this.held = null;
      h.state.set(1);
      c.style.cursor = 'grab';
      h.o.on_end?.();
      this.on_input?.();
    };
    on_ev('pointerup', up);
    on_ev('pointercancel', up);
    on_ev('pointerleave', () => {
      if (!this.held) for (const x of this.scene.handles) x.state.set(0);
    });
    on_ev('keydown', (e) => {
      const h = this.scene.handles[this.focus_h];
      if (!h) return;
      const d: Record<string, XY> = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, 1], ArrowDown: [0, -1] };
      const v = d[e.key];
      if (!v) return;
      e.preventDefault();
      h.nudge(v[0], v[1]);
      h.o.on_end?.();
      this.on_input?.();
    });
  }
  /** Pointer → figure CSS px. */
  private at(e: PointerEvent): XY {
    const c = this.canvas as HTMLCanvasElement, r = c.getBoundingClientRect(), f = this.scene.frame;
    return [((e.clientX - r.left) / r.width) * f.w, ((e.clientY - r.top) / r.height) * f.h];
  }
  private hit(p: XY): Handle | null {
    let best: Handle | null = null, bd = Infinity;
    for (const h of this.scene.handles) {
      if (!h.visible() || !h.hits(p)) continue;
      const [x, y] = h.center(), d = Math.hypot(p[0] - x, p[1] - y);
      if (d < bd) [best, bd] = [h, d];
    }
    return best;
  }
}

/**
 * The explore step's controls for a figure (what manim-web's Interaction is for a scene): it turns the handles on and
 * tells the world when the learner moved one. The view draws no affordance layer over it: the glass handle is its own
 * affordance.
 */
export class FigureUI {
  readonly engine = true;
  on_change: () => void = () => {};
  constructor(public player: FigurePlayer) {
    player.on_input = () => this.on_change();
    player.set_interactive(true);
    player.start_live();
  }
  /** The handles (their names, for the cue and the tutor). */
  get handles(): { label: string }[] {
    return this.player.scene.handles.map((h) => ({ label: h.says ? h.says[this.player.scene.lang] : h.id }));
  }
  dispose(): void {
    this.player.on_input = null;
    this.player.set_interactive(false);
  }
}

export const is_figure_player = (p: unknown): p is FigurePlayer => !!p && typeof p === 'object' && (p as { engine?: boolean }).engine === true && 'scene' in (p as object);
