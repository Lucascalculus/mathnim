// Game feel for interactive scenes (web extension, see docs/EXTENSIONS.md):
// snap pulse rings, success particle bursts and counter tweens drawn on an
// overlay canvas (like AffordanceLayer), and short synthesized WebAudio blips
// (no audio files). Nothing here knows about goals or scores: a lesson calls
// `juice.success(p)` when *it* decides something was achieved.
//
//   const juice = new Juice(ui);          // primitives on `ui` now pulse and click
//   juice.success(pizza.get_center());    // burst + chime
//   await juice.count_to(count, 12);      // tween a ValueTracker / DecimalNumber
//   set_muted(true);                      // global mute
//
// prefers-reduced-motion: no particles, rings do not grow, tweens jump.
import type { Mobject } from '../mobject/mobject';
import type { Point3DLike } from '../utils/vector';
import type { FeedbackLike, Interaction } from './interact';
import type { ScenePlayer } from './player';

export type SoundName = 'click' | 'tick' | 'pop' | 'snap' | 'swish' | 'success' | 'fail';

// ---------------------------------------------------------------- settings
let muted = false;
let volume = 0.7;
let reduced_override: boolean | null = null;

/** Mute or unmute every Juice sound (global). */
export function set_muted(m: boolean): void {
  muted = m;
}
export function is_muted(): boolean {
  return muted;
}
/** Master volume 0..1 for the blips (global). */
export function set_volume(v: number): void {
  volume = Math.min(1, Math.max(0, v));
  if (master) master.gain.value = volume;
}
/** Force reduced motion on (true) or off (false); null follows the OS setting. */
export function set_reduced_motion(v: boolean | null): void {
  reduced_override = v;
}
/** True when the user asked for reduced motion (OS setting or set_reduced_motion). */
export function prefers_reduced_motion(): boolean {
  if (reduced_override !== null) return reduced_override;
  try {
    return !!globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
}

/** Can things move on screen (requestAnimationFrame available and no reduced motion)? */
export function motion_enabled(): boolean {
  return typeof globalThis.requestAnimationFrame === 'function' && !prefers_reduced_motion();
}

// ---------------------------------------------------------------- easing (pure)
export const ease = {
  linear: (u: number) => u,
  out_cubic: (u: number) => 1 - (1 - u) ** 3,
  in_out_cubic: (u: number) => (u < 0.5 ? 4 * u * u * u : 1 - (-2 * u + 2) ** 3 / 2),
  /** Overshoots a little, then settles: a "snap". */
  out_back: (u: number) => {
    const c1 = 1.70158, c3 = c1 + 1;
    return 1 + c3 * (u - 1) ** 3 + c1 * (u - 1) ** 2;
  },
};

/** Value of a tween from `from` to `to` at progress u (0..1, clamped). */
export function tween_value(from: number, to: number, u: number, f: (u: number) => number = ease.out_cubic): number {
  const k = f(Math.min(1, Math.max(0, u)));
  return u >= 1 ? to : from + (to - from) * k;
}

/**
 * Run `frame(u)` for u in (0, 1] over `ms` milliseconds (requestAnimationFrame).
 * Without rAF, with ms <= 0 or with reduced motion it calls frame(1) at once.
 * `alive()` returning false stops the animation early.
 */
export function tween(ms: number, frame: (u: number) => void, o: { alive?: () => boolean; motion?: boolean } = {}): Promise<void> {
  const raf = globalThis.requestAnimationFrame;
  if (!raf || ms <= 0 || (o.motion !== false && prefers_reduced_motion())) {
    frame(1);
    return Promise.resolve();
  }
  return new Promise((resolve) => {
    const t0 = performance.now();
    const step = () => {
      if (o.alive && !o.alive()) return resolve();
      const u = Math.min(1, (performance.now() - t0) / ms);
      frame(u);
      if (u < 1) raf(step);
      else resolve();
    };
    raf(step);
  });
}

const glides = new WeakMap<Mobject, number>();
let glide_seq = 0;
/** Stop a running glide() of this mobject (e.g. when the learner grabs it). */
export function stop_glide(m: Mobject): void {
  glides.set(m, ++glide_seq);
}
/**
 * Move a mobject's centre to `to` with a short eased animation and redraw
 * each frame. Jumps with reduced motion. A later glide or stop_glide wins.
 */
export function glide(
  target: Interaction | ScenePlayer,
  m: Mobject,
  to: Point3DLike,
  o: { ms?: number; ease?: (u: number) => number; on_frame?: () => void } = {},
): Promise<void> {
  const token = ++glide_seq;
  glides.set(m, token);
  const from = m.get_center();
  const f = o.ease ?? ease.out_cubic;
  const player = 'handles' in target ? target.player : target;
  return tween(o.ms ?? 160, (u) => {
    const k = u >= 1 ? 1 : f(u);
    m.move_to([from[0] + (to[0] - from[0]) * k, from[1] + (to[1] - from[1]) * k, from[2] + ((to[2] ?? 0) - from[2]) * k]);
    o.on_frame?.();
    player.refresh();
  }, { alive: () => glides.get(m) === token });
}

// ---------------------------------------------------------------- sound (WebAudio)
/** One synthesized voice: an oscillator (or band-passed noise) with a fast attack and an exponential decay. */
export interface Blip {
  /** Start offset in seconds. */
  at: number;
  /** Duration in seconds. */
  dur: number;
  /** Start and end frequency (Hz); for noise the band-pass centre. */
  f0: number;
  f1: number;
  type: OscillatorType | 'noise';
  /** Peak gain (0..1, before the master volume). */
  gain: number;
}
/** The sound table (short on purpose: every sound is well under half a second). */
export const SOUNDS: Record<SoundName, Blip[]> = {
  click: [{ at: 0, dur: 0.045, f0: 1250, f1: 900, type: 'triangle', gain: 0.12 }],
  tick: [{ at: 0, dur: 0.02, f0: 1800, f1: 1800, type: 'sine', gain: 0.05 }],
  pop: [{ at: 0, dur: 0.08, f0: 420, f1: 880, type: 'sine', gain: 0.16 }],
  snap: [
    { at: 0, dur: 0.035, f0: 660, f1: 660, type: 'triangle', gain: 0.12 },
    { at: 0.04, dur: 0.08, f0: 990, f1: 990, type: 'triangle', gain: 0.12 },
  ],
  swish: [{ at: 0, dur: 0.16, f0: 900, f1: 3800, type: 'noise', gain: 0.22 }],
  success: [
    { at: 0, dur: 0.16, f0: 523.25, f1: 523.25, type: 'sine', gain: 0.13 },
    { at: 0.07, dur: 0.16, f0: 659.25, f1: 659.25, type: 'sine', gain: 0.13 },
    { at: 0.14, dur: 0.16, f0: 783.99, f1: 783.99, type: 'sine', gain: 0.13 },
    { at: 0.21, dur: 0.26, f0: 1046.5, f1: 1046.5, type: 'triangle', gain: 0.1 },
  ],
  fail: [
    { at: 0, dur: 0.1, f0: 330, f1: 300, type: 'triangle', gain: 0.13 },
    { at: 0.11, dur: 0.16, f0: 247, f1: 196, type: 'triangle', gain: 0.13 },
  ],
};

let ac: AudioContext | null = null;
let master: GainNode | null = null;
let noise_buf: AudioBuffer | null = null;
const last_played: Partial<Record<SoundName, number>> = {};

function audio(): AudioContext | null {
  const AC = (globalThis as any).AudioContext ?? (globalThis as any).webkitAudioContext;
  if (!AC) return null;
  if (!ac) {
    try {
      ac = new AC() as AudioContext;
      master = ac.createGain();
      master.gain.value = volume;
      master.connect(ac.destination);
    } catch {
      ac = null;
      return null;
    }
  }
  if (ac.state === 'suspended') ac.resume().catch(() => {});
  return ac;
}

/** Play one of the synthesized blips (no-op when muted or without WebAudio). */
export function play_sound(name: SoundName): void {
  if (muted) return;
  const now = performance.now();
  // rapid repeats (scrubbing, many drops at once) blur into noise: throttle
  if (now - (last_played[name] ?? -1e9) < (name === 'tick' ? 35 : 25)) return;
  last_played[name] = now;
  const a = audio();
  if (!a || !master) return;
  const t0 = a.currentTime + 0.005;
  for (const b of SOUNDS[name]) {
    const t = t0 + b.at;
    const g = a.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(b.gain, t + 0.006);
    g.gain.exponentialRampToValueAtTime(0.0001, t + b.dur);
    g.connect(master);
    if (b.type === 'noise') {
      if (!noise_buf) {
        noise_buf = a.createBuffer(1, Math.floor(a.sampleRate * 0.5), a.sampleRate);
        const d = noise_buf.getChannelData(0);
        for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
      }
      const src = a.createBufferSource();
      src.buffer = noise_buf;
      const bp = a.createBiquadFilter();
      bp.type = 'bandpass';
      bp.Q.value = 1.2;
      bp.frequency.setValueAtTime(b.f0, t);
      bp.frequency.exponentialRampToValueAtTime(b.f1, t + b.dur);
      src.connect(bp).connect(g);
      src.start(t);
      src.stop(t + b.dur + 0.02);
    } else {
      const osc = a.createOscillator();
      osc.type = b.type;
      osc.frequency.setValueAtTime(b.f0, t);
      if (b.f1 !== b.f0) osc.frequency.exponentialRampToValueAtTime(b.f1, t + b.dur);
      osc.connect(g);
      osc.start(t);
      osc.stop(t + b.dur + 0.02);
    }
  }
}

// ---------------------------------------------------------------- overlay effects
interface Ring { kind: 'ring'; x: number; y: number; r: number; grow: number; color: string; t0: number; dur: number; width: number }
interface Particle { kind: 'particle'; x: number; y: number; vx: number; vy: number; size: number; color: string; t0: number; dur: number; spin: number; square: boolean }
type Effect = Ring | Particle;

export interface JuiceOptions {
  /** Colour of snap rings (default '#2563EB'). */
  color?: string;
  /** Confetti colours for bursts. */
  colors?: string[];
  /** Colour of fail rings (default '#E11D48'). */
  fail_color?: string;
  /** Play sounds from this instance (default true; see also set_muted). */
  sound?: boolean;
  /** Become `ui.juice`, so interaction primitives use it (default true). */
  attach?: boolean;
}

/**
 * Overlay effects and sounds for one interactive canvas.
 * `new Juice(ui)` attaches itself to the Interaction (primitives pulse on
 * snaps and click on picks) and is disposed with it.
 */
export class Juice implements FeedbackLike {
  player: ScenePlayer;
  canvas: HTMLCanvasElement;
  overlay: HTMLCanvasElement | null = null;
  o: Required<Omit<JuiceOptions, 'attach'>>;
  private effects: Effect[] = [];
  private raf = 0;

  constructor(target: Interaction | ScenePlayer, o: JuiceOptions = {}) {
    const ui = 'handles' in target ? target : null;
    this.player = ui ? ui.player : (target as ScenePlayer);
    this.canvas = this.player.canvas as HTMLCanvasElement;
    this.o = {
      color: o.color ?? '#2563EB',
      colors: o.colors ?? ['#F59E0B', '#EF4444', '#10B981', '#3B82F6', '#A855F7', '#EC4899'],
      fail_color: o.fail_color ?? '#E11D48',
      sound: o.sound ?? true,
    };
    if (ui && o.attach !== false) {
      ui.juice = this;
      ui.on_dispose(() => {
        if (ui.juice === this) ui.juice = null;
        this.dispose();
      });
    }
  }
  dispose(): void {
    if (this.raf) globalThis.cancelAnimationFrame?.(this.raf);
    this.raf = 0;
    this.effects = [];
    this.overlay?.remove();
    this.overlay = null;
  }

  /** Play a named blip (respects set_muted and this instance's `sound` option). */
  sound(name: SoundName): void {
    if (this.o.sound) play_sound(name);
  }
  /** A ring pulse at scene point p (e.g. where something snapped). */
  pulse(p: Point3DLike, o: { color?: string; radius_px?: number; rings?: number } = {}): void {
    const at = this.px(p);
    if (!at) return;
    const reduced = prefers_reduced_motion();
    const n = reduced ? 1 : o.rings ?? 1;
    for (let i = 0; i < n; i++) {
      this.effects.push({ kind: 'ring', x: at[0], y: at[1], r: o.radius_px ?? 14, grow: reduced ? 0 : 26, color: o.color ?? this.o.color, t0: performance.now() + i * 90, dur: reduced ? 500 : 420, width: 3 });
    }
    this.kick();
  }
  /** Confetti burst at p (skipped with reduced motion: a still ring instead). */
  burst(p: Point3DLike, o: { count?: number; colors?: string[]; speed?: number } = {}): void {
    const at = this.px(p);
    if (!at) return;
    if (prefers_reduced_motion()) {
      this.pulse(p, { color: (o.colors ?? this.o.colors)[2], radius_px: 26 });
      return;
    }
    const colors = o.colors ?? this.o.colors;
    const n = o.count ?? 28, speed = o.speed ?? 320;
    const t0 = performance.now();
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + Math.random() * 0.4;
      const v = speed * (0.45 + Math.random() * 0.75);
      this.effects.push({
        kind: 'particle', x: at[0], y: at[1], vx: Math.cos(a) * v, vy: Math.sin(a) * v - speed * 0.35,
        size: 3 + Math.random() * 3.5, color: colors[i % colors.length], t0, dur: 700 + Math.random() * 400,
        spin: (Math.random() - 0.5) * 12, square: i % 3 !== 0,
      });
    }
    this.pulse(p, { color: colors[2], radius_px: 18 });
    this.kick();
  }
  /** Snap feedback: ring + "snap" blip. */
  snap(p: Point3DLike): void {
    this.pulse(p);
    this.sound('snap');
  }
  /** Success feedback: burst (if p is given) + chime. */
  success(p?: Point3DLike): void {
    if (p) this.burst(p);
    this.sound('success');
  }
  /** Gentle failure feedback: red ring (if p is given) + low blip. */
  fail(p?: Point3DLike): void {
    if (p) this.pulse(p, { color: this.o.fail_color });
    this.sound('fail');
  }
  /**
   * Tween a counter (ValueTracker, DecimalNumber, anything with
   * get_value/set_value) to `to`, redrawing each frame. `round` keeps integers.
   */
  count_to(target: { get_value(): unknown; set_value(v: number): unknown }, to: number, o: { duration?: number; round?: boolean; on_update?: (v: number) => void } = {}): Promise<void> {
    const from = Number(target.get_value());
    return tween((o.duration ?? 0.5) * 1000, (u) => {
      let v = tween_value(from, to, u);
      if (o.round) v = Math.round(v);
      target.set_value(v);
      o.on_update?.(v);
      this.player.refresh();
    });
  }

  // ---------------------------------------------------------------- drawing
  /** Scene point -> overlay CSS pixels (null without a DOM canvas). */
  private px(p: Point3DLike): [number, number] | null {
    if (typeof this.canvas?.getBoundingClientRect !== 'function') return null;
    const cam = this.player.scene.camera as any;
    const r = this.canvas.getBoundingClientRect();
    return [((p[0] - cam.frame_center[0]) / cam.frame_width + 0.5) * r.width, (0.5 - (p[1] - cam.frame_center[1]) / cam.frame_height) * r.height];
  }
  private ensure_overlay(): HTMLCanvasElement | null {
    if (this.overlay) return this.overlay;
    if (typeof document === 'undefined' || !this.canvas.parentElement) return null;
    const parent = this.canvas.parentElement;
    if (getComputedStyle(parent).position === 'static') parent.style.position = 'relative';
    const c = document.createElement('canvas');
    c.className = 'mw-juice';
    c.setAttribute('aria-hidden', 'true');
    Object.assign(c.style, { position: 'absolute', inset: '0', width: '100%', height: '100%', pointerEvents: 'none', border: '0', aspectRatio: 'auto' });
    c.style.setProperty('background', 'transparent', 'important');
    this.canvas.insertAdjacentElement('afterend', c);
    this.overlay = c;
    return c;
  }
  private kick(): void {
    if (this.raf || !globalThis.requestAnimationFrame) return;
    if (!this.ensure_overlay()) {
      this.effects = [];
      return;
    }
    const loop = () => {
      const more = this.draw();
      this.raf = more ? requestAnimationFrame(loop) : 0;
    };
    this.raf = requestAnimationFrame(loop);
  }
  /** Draw live effects; returns whether any remain. */
  private draw(): boolean {
    const c = this.overlay;
    if (!c) return false;
    const dpr = globalThis.devicePixelRatio || 1;
    const r = c.getBoundingClientRect();
    if (c.width !== Math.round(r.width * dpr) || c.height !== Math.round(r.height * dpr)) {
      c.width = Math.round(r.width * dpr);
      c.height = Math.round(r.height * dpr);
    }
    const g = c.getContext('2d');
    if (!g) return false;
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.clearRect(0, 0, r.width, r.height);
    const now = performance.now();
    this.effects = this.effects.filter((e) => now - e.t0 < e.dur);
    for (const e of this.effects) {
      const u = (now - e.t0) / e.dur;
      if (u < 0) continue;
      if (e.kind === 'ring') {
        g.globalAlpha = 0.85 * (1 - u);
        g.strokeStyle = e.color;
        g.lineWidth = e.width * (1 - 0.5 * u);
        g.beginPath();
        g.arc(e.x, e.y, e.r + e.grow * ease.out_cubic(u), 0, Math.PI * 2);
        g.stroke();
      } else {
        const t = (now - e.t0) / 1000;
        const x = e.x + e.vx * t, y = e.y + e.vy * t + 0.5 * 900 * t * t;
        g.globalAlpha = Math.min(1, 2 * (1 - u));
        g.fillStyle = e.color;
        g.save();
        g.translate(x, y);
        g.rotate(e.spin * t);
        if (e.square) g.fillRect(-e.size / 2, -e.size * 0.3, e.size, e.size * 0.6);
        else {
          g.beginPath();
          g.arc(0, 0, e.size / 2, 0, Math.PI * 2);
          g.fill();
        }
        g.restore();
      }
    }
    g.globalAlpha = 1;
    return this.effects.length > 0;
  }
}
