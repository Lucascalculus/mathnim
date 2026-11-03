// Draw only what changed. Each thing's drawing is tracked: the renderer knows which params it read, so it knows when
// it changed. Things that have not changed recently are drawn once into cached layers (below and above the ones that
// move); only the moving ones are drawn each frame. When nothing changed, nothing is drawn at all.
import { look } from '@mathnim/look';
import type { Box } from './geom';
import { now_version, track, type Readable } from './state';
import type { DrawEnv, Thing } from './thing';

type Canvas = HTMLCanvasElement | OffscreenCanvas;
let factory: ((w: number, h: number) => Canvas) | null = null;
/** How offscreen canvases are made (node tools pass @napi-rs/canvas's createCanvas). */
export function set_canvas_factory(f: (w: number, h: number) => Canvas): void {
  factory = f;
}
export function make_canvas(w: number, h: number): Canvas {
  if (factory) return factory(w, h);
  if (typeof OffscreenCanvas !== 'undefined') return new OffscreenCanvas(w, h);
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}

interface Tracked {
  deps: Readable<unknown>[];
  sig: number;
  /** Frames since it last changed (a thing that changed in the last few frames is "live"). */
  quiet: number;
}
const sig_of = (deps: Readable<unknown>[]): number => deps.reduce((a, d) => Math.max(a, d.version), 0);

export interface FrameStats {
  /** Frames drawn, frames skipped because nothing changed, and things drawn in total. */
  drawn: number;
  skipped: number;
  things_drawn: number;
  layers_rebuilt: number;
}

export class Renderer {
  private info = new Map<Thing, Tracked>();
  private below: Canvas | null = null;
  private above: Canvas | null = null;
  private below_set: Thing[] = [];
  private above_set: Thing[] = [];
  private last_global = -1;
  /** The layers must be painted again (size, look or language changed). */
  private stale = true;
  stats: FrameStats = { drawn: 0, skipped: 0, things_drawn: 0, layers_rebuilt: 0 };

  /** Something outside params changed (size, look, language): draw everything again. */
  invalidate(): void {
    this.info.clear();
    this.stale = true;
    this.below_set = this.above_set = [];
    this.last_global = -1;
  }
  private changed(t: Thing): boolean {
    const i = this.info.get(t);
    return !i || sig_of(i.deps) !== i.sig;
  }
  private draw_one(t: Thing, env: DrawEnv): void {
    const g = env.g;
    const { deps } = track(() => {
      const a = t.opacity.value * (t.parent ? t.parent.opacity.value : 1);
      if (a <= 0.001) return;
      g.save();
      g.globalAlpha = a;
      t.draw(env);
      g.restore();
    });
    const i = this.info.get(t);
    const sig = sig_of(deps);
    this.info.set(t, { deps, sig, quiet: i && i.sig === sig ? i.quiet + 1 : 0 });
    this.stats.things_drawn++;
  }
  /** Paint a layer into `reuse` when it has the size (cleared), else into a new canvas. */
  private paint_layer(things: Thing[], env: DrawEnv, w: number, h: number, reuse: Canvas | null, background?: (g: CanvasRenderingContext2D, frame: Box) => void): Canvas {
    const c = reuse && reuse.width === w && reuse.height === h ? reuse : make_canvas(w, h);
    const g = c.getContext('2d') as CanvasRenderingContext2D;
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.clearRect(0, 0, w, h);
    g.setTransform(env.dpr, 0, 0, env.dpr, 0, 0);
    background?.(g, env.frame);
    for (const t of things) this.draw_one(t, { ...env, g });
    this.stats.layers_rebuilt++;
    return c;
  }
  /**
   * Draw a frame of `things` (in order) then `overlay` (labels, handles: always redrawn when the frame is), onto env.g.
   * `before` runs after the cached things are known to be current and before the overlay (label placement).
   * Returns false when nothing changed and nothing was drawn.
   */
  frame(things: Thing[], overlay: Thing[], env: DrawEnv, version: number, o: { force?: boolean; before?: () => void; background?: (g: CanvasRenderingContext2D, frame: Box) => void } = {}): boolean {
    if (!o.force && version === this.last_global) {
      this.stats.skipped++;
      return false;
    }
    this.last_global = version;
    const W = Math.round(env.frame.w * env.dpr), H = Math.round(env.frame.h * env.dpr);
    // which things moved lately
    const changed = things.map((t) => this.changed(t));
    const live = things.map((t, k) => changed[k] || (this.info.get(t)?.quiet ?? 0) < 4);
    const first = live.indexOf(true), last = live.lastIndexOf(true);
    const below = first < 0 ? things : things.slice(0, first), above = first < 0 ? [] : things.slice(last + 1);
    const middle = first < 0 ? [] : things.slice(first, last + 1);
    const same = (a: Thing[], b: Thing[]) => a.length === b.length && a.every((x, i) => x === b[i]);
    // (the background is baked into the bottom layer: an opaque copy replaces clearing and repainting it)
    if (!this.below || this.stale || !same(below, this.below_set) || below.some((t) => this.changed(t))) {
      this.below = this.paint_layer(below, env, W, H, this.below, o.background);
      this.below_set = below;
    }
    if (!this.above || this.stale || !same(above, this.above_set) || above.some((t) => this.changed(t))) {
      this.above = this.paint_layer(above, env, W, H, this.above);
      this.above_set = above;
    }
    this.stale = false;
    const g = env.g;
    g.setTransform(1, 0, 0, 1, 0, 0);
    if (!o.background) g.clearRect(0, 0, W, H);
    g.drawImage(this.below as CanvasImageSource, 0, 0);
    g.setTransform(env.dpr, 0, 0, env.dpr, 0, 0);
    for (const t of middle) this.draw_one(t, env);
    g.setTransform(1, 0, 0, 1, 0, 0);
    if (above.length) g.drawImage(this.above as CanvasImageSource, 0, 0);
    g.setTransform(env.dpr, 0, 0, env.dpr, 0, 0);
    o.before?.();
    for (const t of overlay) this.draw_one(t, env);
    this.stats.drawn++;
    // (drawing may have recomputed derived values, which advances the clock: what was drawn is current up to now)
    this.last_global = now_version();
    return true;
  }
}

/** The stage's background: the look's soft gradient. */
export function paint_background(g: CanvasRenderingContext2D, b: Box): void {
  const p = look().palette, grd = g.createLinearGradient(0, b.y, 0, b.y + b.h);
  grd.addColorStop(0, p.bg_top);
  grd.addColorStop(1, p.bg_bottom);
  g.fillStyle = grd;
  g.fillRect(b.x, b.y, b.w, b.h);
}
