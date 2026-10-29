// Direct manipulation for live scenes (web extension, see docs/EXTENSIONS.md).
//
//   const ui = new Interaction(player);
//   const t = ValueTracker(2);
//   ui.add_handle({ mobject: dot, tracker: t, constraint: constrain.on_segment(LEFT * 3, RIGHT * 3),
//                   to_value: (p) => p[0], from_value: (v) => [v, 0, 0] });
//   ui.on_click((p, hits) => ...);          // "what is this?" hit testing
//
// Handles move mobjects or set ValueTrackers; updaters (always_redraw,
// add_updater) then update formulas and graphs, exactly as in manim.
// Keyboard: Tab focuses handles, arrow keys move them, so every explorable
// works without a mouse.
import { Mobject } from '../mobject/mobject';
import { VMobject } from '../mobject/types/vectorized_mobject';
import type { ValueTracker } from '../mobject/value_tracker';
import { getPoint } from '../utils/points';
import { add, mul, norm, sub, to3, type Point3D, type Point3DLike } from '../utils/vector';
import { Cutter, type CutterOptions } from './cut';
import { Draggable, type DraggableOptions } from './dragdrop';
import { NumberLineMarker, type MarkerOptions } from './marker';
import type { ScenePlayer } from './player';
import { Scrubber, type ScrubOptions } from './scrub';
import { Stamp, type StampOptions } from './stamp';
import { TokenBuilder, type TokenOptions } from './tokens';

export type Constraint = (p: Point3D) => Point3D;

// ---------------------------------------------------------------- interactive items (generic registry)

/** Pointer details passed to interactive items. */
export interface PointerInfo {
  /** 'mouse' | 'pen' | 'touch'. */
  type: string;
  id: number;
  client: [number, number];
  /** A coarse pointer (touch): hit tolerances are larger. */
  coarse: boolean;
  shift: boolean;
  /** Scene units per CSS pixel. */
  upp: number;
}

/** Drawing helpers the AffordanceLayer hands to items (overlay CSS pixels). */
export interface AffordanceCtx {
  g: CanvasRenderingContext2D;
  /** Scene point -> overlay CSS pixels. */
  px(p: Point3DLike): [number, number];
  /** CSS pixels per scene unit. */
  ppu: number;
  /** Seconds since the layer started (for pulses). */
  t: number;
  color: string;
  width: number;
  height: number;
  /** The item has not been used yet (never focused or dragged). */
  fresh: boolean;
  /** The first fresh item of its kind: only it pulses, so a row of tiles is not a wall of rings. */
  lead: boolean;
  /** This item may show its text hint (one hint on screen at a time). */
  show_hint: boolean;
  reduced_motion: boolean;
  /** Halo: filled disc + ring, pulsing rings while `pulse`. */
  halo(x: number, y: number, r: number, o?: { pulse?: boolean; focused?: boolean; active?: boolean }): void;
  /** Dashed (or solid) outline of scene points. */
  outline(pts: readonly Point3DLike[], o?: { closed?: boolean; dash?: number[]; alpha?: number; width?: number; fill_alpha?: number; color?: string; dash_offset?: number }): void;
  /** Pill label near (x, y), kept inside the canvas; `avoid` = radius to keep clear. */
  label(text: string, x: number, y: number, o?: { avoid?: number; color?: string; below?: boolean }): void;
  /** Small arrow heads around (x, y) at distance r, in screen directions (y down). */
  arrows(x: number, y: number, r: number, dirs: [number, number][]): void;
  /** True the first time `key` is seen in this frame (draw shared things once). */
  once(key: unknown): boolean;
}

/** Path for the coach mark (ghost hand); `knife` draws a dashed trail behind it. */
export interface CoachPath {
  points: Point3D[];
  knife?: boolean;
  ms?: number;
}

/**
 * Something the learner manipulates, registered with `Interaction.add_item`.
 * Draggables, stamps, scrubbers and cutters implement it; Tab cycles through
 * handles first, then focusable items.
 */
export interface InteractiveItem {
  kind: string;
  /** Accessible name (Tab announces it). */
  label?: string;
  /** Text shown next to it until first use; `{label}` is replaced. */
  hint?: string;
  enabled?: boolean;
  /** Reachable with Tab (default true). */
  focusable?: boolean;
  /** Pointer priority: higher wins when several items are hit (default 1). */
  priority?: number;
  hot?: boolean;
  active?: boolean;
  focused?: boolean;
  /** Score (smaller is better, 0 = inside) when p hits the item, else null. `tol` in scene units. */
  hit?(p: Point3D, tol: number): number | null;
  /** Draw order: higher is on top (breaks ties between overlapping items). */
  depth?(): number;
  cursor?(p: Point3D | null): string;
  /** Pointer pressed on the item; return true to capture the pointer until release. */
  down?(p: Point3D, info: PointerInfo): boolean;
  move?(p: Point3D, info: PointerInfo): void;
  up?(p: Point3D, info: PointerInfo, cancelled: boolean): void;
  /** Hover moved (null = left); return true to request a redraw. */
  hover?(p: Point3D | null): boolean;
  /** Second tap/click within 350 ms; return true if handled. */
  double_click?(p: Point3D, info: PointerInfo): boolean;
  /** Key pressed while focused; return true if handled. */
  key?(e: KeyboardEvent): boolean;
  focus_changed?(on: boolean): void;
  /** Value text for screen readers while focused. */
  describe?(): string;
  /** Where to draw focus and hints (scene point). */
  anchor?(): Point3D | null;
  coach_path?(): CoachPath | null;
  draw_affordance?(ctx: AffordanceCtx): void;
  dispose?(): void;
}

/** What primitives use for feedback (implemented by Juice; set as `ui.juice`). */
export interface FeedbackLike {
  sound(name: 'click' | 'tick' | 'pop' | 'snap' | 'swish' | 'success' | 'fail'): void;
  pulse(p: Point3DLike, o?: { color?: string; radius_px?: number }): void;
}

const clamp = (x: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, x));
/** Ready-made constraints for handles. */
export const constrain = {
  free: (): Constraint => (p) => p,
  /** Closest point on segment ab. */
  on_segment(a: Point3DLike, b: Point3DLike): Constraint {
    const A = to3(a), B = to3(b), d = sub(B, A), L2 = d[0] ** 2 + d[1] ** 2 + d[2] ** 2;
    return (p) => add(A, mul(clamp(((p[0] - A[0]) * d[0] + (p[1] - A[1]) * d[1] + (p[2] - A[2]) * d[2]) / (L2 || 1), 0, 1), d));
  },
  /** Closest point on the infinite line through a and b. */
  on_line(a: Point3DLike, b: Point3DLike): Constraint {
    const A = to3(a), d = sub(to3(b), A), L2 = d[0] ** 2 + d[1] ** 2 + d[2] ** 2;
    return (p) => add(A, mul(((p[0] - A[0]) * d[0] + (p[1] - A[1]) * d[1] + (p[2] - A[2]) * d[2]) / (L2 || 1), d));
  },
  /** Radial projection onto a circle (optionally limited to an arc, angles in radians). */
  on_circle(center: Point3DLike, radius: number, arc?: [number, number]): Constraint {
    const C = to3(center);
    return (p) => {
      let a = Math.atan2(p[1] - C[1], p[0] - C[0]);
      if (arc) a = clamp(a, arc[0], arc[1]);
      return [C[0] + radius * Math.cos(a), C[1] + radius * Math.sin(a), C[2]];
    };
  },
  /** Closest sampled point of a parametric curve t -> point. */
  on_curve(f: (t: number) => Point3DLike, t_range: [number, number], samples = 400): Constraint {
    const pts = Array.from({ length: samples + 1 }, (_, i) => to3(f(t_range[0] + ((t_range[1] - t_range[0]) * i) / samples)));
    return (p) => {
      let best = pts[0], bd = Infinity;
      for (const q of pts) {
        const d = (q[0] - p[0]) ** 2 + (q[1] - p[1]) ** 2;
        if (d < bd) {
          bd = d;
          best = q;
        }
      }
      return [...best] as Point3D;
    };
  },
  /** Keep inside a box [xmin, xmax] x [ymin, ymax]. */
  in_box(xmin: number, xmax: number, ymin: number, ymax: number): Constraint {
    return (p) => [clamp(p[0], xmin, xmax), clamp(p[1], ymin, ymax), p[2]];
  },
  /** Snap to a grid (step in scene units, from `origin`). */
  snap(step: number, origin: Point3DLike = [0, 0, 0]): Constraint {
    const O = to3(origin);
    return (p) => [O[0] + Math.round((p[0] - O[0]) / step) * step, O[1] + Math.round((p[1] - O[1]) / step) * step, p[2]];
  },
  /** Apply constraints in order. */
  all(...cs: Constraint[]): Constraint {
    return (p) => cs.reduce((q, c) => c(q), p);
  },
};

export interface HandleSpec {
  /** What is dragged. Moved directly unless a tracker/set is given (then updaters move it). */
  mobject?: Mobject;
  /** Current position (default: the mobject's center). */
  get?: () => Point3D;
  /** Apply a (constrained) position. */
  set?: (p: Point3D) => void;
  /** One-parameter handle: position <-> tracker value. */
  tracker?: ValueTracker;
  to_value?: (p: Point3D) => number;
  from_value?: (v: number) => Point3DLike;
  /** Two-parameter handle: x and y trackers. */
  trackers?: [ValueTracker, ValueTracker];
  constraint?: Constraint;
  /** Hit radius in scene units (default 0.35). */
  radius?: number;
  /** Keyboard step: scene units, or tracker units for one-parameter handles. */
  step?: number;
  /** Accessible name, e.g. "player position". */
  label?: string;
  /** Scale the mobject a little while hovered/dragged (default true). */
  highlight?: boolean;
  /** Drag cues on this handle (ring, arrows, hint; default true). A switch or a row of choices reads as a control by
   *  itself: false leaves only the keyboard focus ring. */
  cue?: boolean;
  on_start?: () => void;
  on_change?: (p: Point3D) => void;
  on_end?: () => void;
}

export class DragHandle {
  spec: HandleSpec;
  hot = false;
  active = false;
  focused = false;
  private scaled = 1;
  constructor(spec: HandleSpec) {
    this.spec = { radius: 0.35, highlight: true, ...spec };
  }
  position(): Point3D {
    const s = this.spec;
    if (s.get) return s.get();
    if (s.tracker && s.from_value) return to3(s.from_value(s.tracker.get_value()));
    if (s.trackers) return [s.trackers[0].get_value(), s.trackers[1].get_value(), 0];
    if (s.mobject) return s.mobject.get_center();
    throw new Error('DragHandle needs mobject, get, tracker+from_value or trackers');
  }
  move_to(p: Point3D): void {
    const s = this.spec;
    const q = s.constraint ? s.constraint(p) : p;
    if (s.set) s.set(q);
    else if (s.tracker) s.tracker.set_value(s.to_value ? s.to_value(q) : q[0]);
    else if (s.trackers) {
      s.trackers[0].set_value(q[0]);
      s.trackers[1].set_value(q[1]);
    } else if (s.mobject) s.mobject.move_to(q);
    s.on_change?.(q);
  }
  /** Keyboard nudge in direction (dx, dy) = (-1|0|1). */
  nudge(dx: number, dy: number): void {
    const s = this.spec;
    const step = s.step ?? 0.1;
    if (s.tracker && s.from_value) {
      // move the value in whichever direction moves the handle the way the arrow points on screen
      const v = s.tracker.get_value(), p = this.position();
      const up = to3(s.from_value(v + step));
      const along = (up[0] - p[0]) * dx + (up[1] - p[1]) * dy;
      const sign = Math.abs(along) > 1e-9 ? Math.sign(along) : dx || dy;
      this.move_to(to3(s.from_value(v + sign * step)));
    } else this.move_to(add(this.position(), [dx * step, dy * step, 0]));
  }
  set_emphasis(on: boolean): void {
    const m = this.spec.mobject;
    if (!m || !this.spec.highlight) return;
    const k = on ? 1.25 : 1;
    if (k !== this.scaled) {
      m.scale(k / this.scaled);
      this.scaled = k;
    }
  }
}

type Canvasish = HTMLCanvasElement;

export class Interaction {
  player: ScenePlayer;
  canvas: Canvasish;
  handles: DragHandle[] = [];
  /** Draggables, stamps, scrubbers, cutters... (see InteractiveItem). */
  items: InteractiveItem[] = [];
  /** Feedback (sounds, pulses) used by the primitives; `new Juice(ui)` sets it. */
  juice: FeedbackLike | null = null;
  private active: DragHandle | null = null;
  private active_item: InteractiveItem | null = null;
  private active_pointer = -1;
  private focus_target: DragHandle | InteractiveItem | null = null;
  private coarse = false;
  private last_tap: { item: InteractiveItem; t: number; x: number; y: number } | null = null;
  private clicks: ((p: Point3D, hits: Mobject[]) => void)[] = [];
  private listeners: [string, EventListener][] = [];
  private disposers: (() => void)[] = [];
  private live: HTMLElement | null = null;
  private touch_action = '';
  on_change: () => void;

  constructor(player: ScenePlayer, o: { on_change?: () => void } = {}) {
    this.player = player;
    this.canvas = player.canvas as Canvasish;
    this.on_change = o.on_change ?? (() => {});
    const c = this.canvas;
    this.touch_action = c.style.touchAction;
    c.style.touchAction = 'none';
    if (!c.hasAttribute('tabindex')) c.tabIndex = 0;
    this.listen('pointerdown', (e) => this.down(e as PointerEvent));
    this.listen('pointermove', (e) => this.move(e as PointerEvent));
    this.listen('pointerup', (e) => this.up(e as PointerEvent));
    this.listen('pointercancel', (e) => this.up(e as PointerEvent));
    this.listen('pointerleave', () => {
      if (!this.active) this.set_hot(null);
      if (!this.active_item) this.hover_items(null);
    });
    this.listen('keydown', (e) => this.key(e as KeyboardEvent));
    this.listen('blur', () => this.set_focus(-1));
  }
  private listen(type: string, f: EventListener): void {
    this.canvas.addEventListener(type, f);
    this.listeners.push([type, f]);
  }
  dispose(): void {
    for (const [t, f] of this.listeners) this.canvas.removeEventListener(t, f);
    this.listeners = [];
    for (const it of [...this.items]) it.dispose?.();
    for (const f of this.disposers.splice(0)) f();
    this.live?.remove();
    this.live = null;
    // touch-action: none only while interactive (lets the page scroll over a plain figure)
    this.canvas.style.touchAction = this.touch_action;
  }
  /** Run `f` when this interaction is disposed (overlays, timers). */
  on_dispose(f: () => void): void {
    this.disposers.push(f);
  }

  // ---------------------------------------------------------------- items
  /** Register an interactive item (the primitives do this in their constructors). */
  add_item<T extends InteractiveItem>(item: T): T {
    if (!this.items.includes(item)) this.items.push(item);
    this.update_aria();
    return item;
  }
  remove_item(item: InteractiveItem): void {
    if (this.focus_target === item) this.set_focus(-1);
    if (this.active_item === item) this.active_item = null;
    this.items = this.items.filter((x) => x !== item);
    this.update_aria();
  }
  /** Handles, then focusable enabled items: the Tab order. */
  focusables(): (DragHandle | InteractiveItem)[] {
    return [...this.handles, ...this.items.filter((it) => it.focusable !== false && it.enabled !== false)];
  }
  /** The handle or item with keyboard focus. */
  focused(): DragHandle | InteractiveItem | null {
    return this.focus_target;
  }
  /** Give keyboard focus to a handle or item (null clears it). */
  focus_on(x: DragHandle | InteractiveItem | null): void {
    this.set_focus(x ? this.focusables().indexOf(x) : -1);
  }
  /** Redraw and call on_change (primitives call this after changing the scene). */
  notify(): void {
    this.changed();
  }
  /** Say something to screen readers (a polite live region next to the canvas). */
  announce(text: string): void {
    if (typeof document === 'undefined') return;
    if (!this.live) {
      const d = document.createElement('div');
      d.className = 'mw-live';
      d.setAttribute('role', 'status');
      d.setAttribute('aria-live', 'polite');
      Object.assign(d.style, { position: 'absolute', width: '1px', height: '1px', overflow: 'hidden', clipPath: 'inset(50%)', whiteSpace: 'nowrap', margin: '-1px', padding: '0', border: '0' });
      this.canvas.insertAdjacentElement('afterend', d);
      this.live = d;
    }
    // a trailing no-break space toggles, so repeating a message is announced again
    this.live.textContent = this.live.textContent === text ? text + ' ' : text;
  }
  /** Hit tolerance for items in scene units (larger for touch). */
  tolerance(coarse = this.coarse): number {
    return (coarse ? 16 : 6) * this.units_per_px();
  }
  /** The item under p: highest priority, then best score, then topmost. */
  pick_item(p: Point3D, coarse = this.coarse): InteractiveItem | null {
    const tol = this.tolerance(coarse);
    let best: InteractiveItem | null = null, bp = -Infinity, bs = Infinity, bd = -Infinity;
    for (const it of this.items) {
      if (it.enabled === false || !it.hit) continue;
      const s = it.hit(p, tol);
      if (s === null || s === undefined) continue;
      const pr = it.priority ?? 1, d = it.depth?.() ?? 0;
      const better = pr > bp || (pr === bp && (s < bs - 1e-9 || (Math.abs(s - bs) <= 1e-9 && d > bd)));
      if (better) {
        best = it;
        bp = pr;
        bs = s;
        bd = d;
      }
    }
    return best;
  }

  // ---------------------------------------------------------------- primitives (docs/EXTENSIONS.md)
  /** Make a mobject draggable, with drop zones and snapping (ext/dragdrop). */
  add_draggable(mobject: Mobject, o: DraggableOptions = {}): Draggable {
    return new Draggable(this, mobject, o);
  }
  /** Knife strokes: press-drag-release draws a straight cut (ext/cut). */
  add_cutter(o: CutterOptions = {}): Cutter {
    return new Cutter(this, o);
  }
  /** Tap to place copies of a template in an area (ext/stamp). */
  add_stamp(template: Mobject, o: StampOptions): Stamp {
    return new Stamp(this, template, o);
  }
  /** Drag left/right on a number to change a ValueTracker (ext/scrub). */
  add_scrubber(target: Mobject | (() => Mobject), tracker: ValueTracker, o: ScrubOptions = {}): Scrubber {
    return new Scrubber(this, target, tracker, o);
  }
  /** Tiles dragged from a tray into ordered slots (ext/tokens). */
  add_tokens(o: TokenOptions): TokenBuilder {
    return new TokenBuilder(this, o);
  }
  /** A draggable marker on a NumberLine with a live value label (ext/marker). */
  add_marker(number_line: Mobject, tracker: ValueTracker, o: MarkerOptions = {}): NumberLineMarker {
    return new NumberLineMarker(this, number_line, tracker, o);
  }

  add_handle(spec: HandleSpec): DragHandle {
    const h = new DragHandle(spec);
    this.handles.push(h);
    this.update_aria();
    return h;
  }
  remove_handle(h: DragHandle): void {
    if (this.focus_target === h) this.focus_target = null;
    this.handles = this.handles.filter((x) => x !== h);
    this.update_aria();
  }
  /** Called with the scene point and the mobjects under it (topmost first) on a click that is not a drag. */
  on_click(cb: (p: Point3D, hits: Mobject[]) => void): void {
    this.clicks.push(cb);
  }

  // ---------------------------------------------------------------- coordinates
  /** Client (CSS pixel) coordinates -> scene coordinates. */
  to_scene(clientX: number, clientY: number): Point3D {
    const r = this.canvas.getBoundingClientRect();
    const cam = this.player.scene.camera as any;
    const fc = cam.frame_center as Point3D;
    return [fc[0] + ((clientX - r.left) / r.width - 0.5) * cam.frame_width, fc[1] + (0.5 - (clientY - r.top) / r.height) * cam.frame_height, 0];
  }
  /** Scene units per CSS pixel (for pixel-sized tolerances). */
  units_per_px(): number {
    return (this.player.scene.camera as any).frame_width / this.canvas.getBoundingClientRect().width;
  }

  // ---------------------------------------------------------------- picking
  pick(p: Point3D): DragHandle | null {
    let best: DragHandle | null = null, bd = Infinity;
    // at least a comfortable finger-sized target on screen (larger for touch)
    const min = (this.coarse ? 36 : 26) * this.units_per_px();
    for (const h of this.handles) {
      const d = norm(sub(h.position(), p));
      if (d < Math.max(h.spec.radius ?? 0.35, min) && d < bd) {
        best = h;
        bd = d;
      }
    }
    return best;
  }
  /** Mobjects under point p, topmost first: [leaf, ..., top-level ancestor] per hit. */
  hit_test(p: Point3D, tolerance_px = 6): Mobject[] {
    const tol = tolerance_px * this.units_per_px();
    const out: Mobject[] = [];
    const tops = this.player.scene.get_render_mobjects();
    for (let t = tops.length - 1; t >= 0; t--) {
      const top = tops[t];
      const fam = top.get_family().filter((m) => m.points.length > 0).reverse();
      for (const m of fam) {
        if (hits(m, p, tol)) {
          if (!out.includes(m)) out.push(m);
          if (!out.includes(top)) out.push(top);
          break;
        }
      }
    }
    return out;
  }

  // ---------------------------------------------------------------- events
  private down_at: [number, number] | null = null;
  private info(e: PointerEvent): PointerInfo {
    return { type: e.pointerType || 'mouse', id: e.pointerId, client: [e.clientX, e.clientY], coarse: e.pointerType === 'touch', shift: !!e.shiftKey, upp: this.units_per_px() };
  }
  private down(e: PointerEvent): void {
    // a second finger while something is being dragged is ignored
    if (this.active || this.active_item) return;
    this.coarse = e.pointerType === 'touch';
    const p = this.to_scene(e.clientX, e.clientY);
    this.down_at = [e.clientX, e.clientY];
    const h = this.pick(p);
    if (!h) {
      this.down_item(e, p);
      return;
    }
    this.active = h;
    h.active = true;
    this.canvas.setPointerCapture?.(e.pointerId);
    this.canvas.style.cursor = 'grabbing';
    h.spec.on_start?.();
    h.move_to(p);
    this.changed();
  }
  private down_item(e: PointerEvent, p: Point3D): void {
    const info = this.info(e);
    const it = this.pick_item(p, info.coarse);
    if (!it || !it.down?.(p, info)) return;
    this.active_item = it;
    this.active_pointer = e.pointerId;
    it.active = true;
    this.canvas.setPointerCapture?.(e.pointerId);
    const cur = it.cursor?.(p) ?? 'default';
    this.canvas.style.cursor = cur === 'grab' ? 'grabbing' : cur;
    this.changed();
  }
  private move(e: PointerEvent): void {
    const p = this.to_scene(e.clientX, e.clientY);
    if (this.active) {
      this.active.move_to(p);
      this.changed();
    } else if (this.active_item) {
      if (e.pointerId !== this.active_pointer) return;
      this.active_item.move?.(p, this.info(e));
      this.changed();
    } else {
      if (e.pointerType) this.coarse = e.pointerType === 'touch';
      const h = this.pick(p);
      this.set_hot(h);
      this.hover_items(h ? null : p);
    }
  }
  private up(e: PointerEvent): void {
    const was = this.active;
    if (was) {
      was.active = false;
      this.active = null;
      this.canvas.style.cursor = was.hot ? 'grab' : 'default';
      was.spec.on_end?.();
      this.changed();
    } else if (this.active_item) {
      if (e.pointerId !== this.active_pointer) return;
      const it = this.active_item, info = this.info(e);
      const p = this.to_scene(e.clientX, e.clientY);
      const cancelled = e.type === 'pointercancel';
      this.active_item = null;
      this.active_pointer = -1;
      it.active = false;
      it.up?.(p, info, cancelled);
      // double tap / double click (works for touch, where dblclick is unreliable)
      const tap = !cancelled && this.down_at && Math.hypot(e.clientX - this.down_at[0], e.clientY - this.down_at[1]) < 8;
      if (tap) {
        const now = performance.now(), lt = this.last_tap;
        if (lt && lt.item === it && now - lt.t < 350 && Math.hypot(e.clientX - lt.x, e.clientY - lt.y) < 16 && it.double_click?.(p, info)) this.last_tap = null;
        else this.last_tap = { item: it, t: now, x: e.clientX, y: e.clientY };
      } else this.last_tap = null;
      this.canvas.style.cursor = it.hot ? it.cursor?.(p) ?? 'default' : 'default';
      this.changed();
    } else if (this.down_at && Math.hypot(e.clientX - this.down_at[0], e.clientY - this.down_at[1]) < 5 && this.clicks.length) {
      const p = this.to_scene(e.clientX, e.clientY);
      const hitList = this.hit_test(p);
      for (const cb of this.clicks) cb(p, hitList);
    }
    this.down_at = null;
  }
  /** Hover state and cursor for items (p = null: pointer left or is over a handle). */
  private hover_items(p: Point3D | null): void {
    const it = p ? this.pick_item(p) : null;
    let hot_changed = false, redraw = false;
    for (const x of this.items) {
      const hot = x === it;
      if (!!x.hot !== hot) {
        x.hot = hot;
        hot_changed = true;
        if (!hot && x.hover?.(null)) redraw = true;
      }
    }
    if (it && p) {
      if (it.hover?.(p)) redraw = true;
      this.canvas.style.cursor = it.cursor?.(p) ?? 'pointer';
    }
    if (hot_changed) this.changed();
    else if (redraw) this.player.refresh();
  }
  private set_hot(h: DragHandle | null): void {
    let changed = false;
    for (const x of this.handles) {
      const hot = x === h;
      if (x.hot !== hot) {
        x.hot = hot;
        x.set_emphasis(hot || x.focused);
        changed = true;
      }
    }
    this.canvas.style.cursor = h ? 'grab' : 'default';
    if (changed) this.changed();
  }
  private set_focus(i: number): void {
    const target = this.focusables()[i] ?? null;
    this.focus_target = target;
    this.handles.forEach((h) => {
      h.focused = h === target;
      h.set_emphasis(h.focused || h.hot);
    });
    for (const it of this.items) {
      const on = it === target;
      if (!!it.focused !== on) {
        it.focused = on;
        it.focus_changed?.(on);
      }
    }
    this.update_aria();
    this.changed();
  }
  private key(e: KeyboardEvent): void {
    const list = this.focusables();
    if (!list.length) return;
    const focus = this.focus_target ? list.indexOf(this.focus_target) : -1;
    if (e.key === 'Tab') {
      const n = list.length;
      const next = focus + (e.shiftKey ? -1 : 1);
      if (next < 0 || next >= n) {
        this.set_focus(-1);
        return; // let focus leave the canvas
      }
      e.preventDefault();
      this.set_focus(next);
      return;
    }
    const f = list[focus];
    if (!f) return;
    if (!(f instanceof DragHandle)) {
      if (f.key?.(e)) {
        e.preventDefault();
        this.changed();
      }
      return;
    }
    const h = f;
    const dir: Record<string, [number, number]> = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, 1], ArrowDown: [0, -1] };
    const d = dir[e.key];
    if (!d) return;
    e.preventDefault();
    const k = e.shiftKey ? 5 : 1;
    for (let i = 0; i < k; i++) h.nudge(d[0], d[1]);
    this.changed();
  }
  private changed(): void {
    this.player.refresh();
    if (this.focus_target) this.update_aria();
    this.on_change();
  }
  private update_aria(): void {
    const list = this.focusables();
    const names = list.map((x, i) => (x instanceof DragHandle ? x.spec.label ?? `handle ${i + 1}` : x.label ?? `${x.kind} ${i + 1}`));
    const keys = this.items.length ? 'then use arrow keys; Enter drops or places.' : 'then use arrow keys.';
    this.canvas.setAttribute('aria-label', names.length ? `Interactive figure. Tab to a control (${names.join(', ')}), ${keys}` : 'Figure');
    const f = this.focus_target;
    if (f instanceof DragHandle) this.canvas.setAttribute('aria-valuetext', `${f.spec.label ?? 'handle'}: ${f.spec.tracker ? +f.spec.tracker.get_value().toFixed(3) : f.position().slice(0, 2).map((x) => +x.toFixed(2)).join(', ')}`);
    else if (f) this.canvas.setAttribute('aria-valuetext', f.describe?.() ?? f.label ?? f.kind);
  }
}

// ---------------------------------------------------------------- geometry of hits
function hits(m: Mobject, p: Point3D, tol: number): boolean {
  const pts = m.points;
  let xmin = Infinity, xmax = -Infinity, ymin = Infinity, ymax = -Infinity;
  for (let i = 0; i < pts.length; i += 3) {
    xmin = Math.min(xmin, pts[i]);
    xmax = Math.max(xmax, pts[i]);
    ymin = Math.min(ymin, pts[i + 1]);
    ymax = Math.max(ymax, pts[i + 1]);
  }
  if (p[0] < xmin - tol || p[0] > xmax + tol || p[1] < ymin - tol || p[1] > ymax + tol) return false;
  if (!(m instanceof VMobject)) return true;
  const poly = flatten(m);
  const filled = m.get_fill_opacity() > 0.05;
  if (filled && inside(poly, p)) return true;
  const stroke = (m.get_stroke_width() * 0.01) / 2;
  return m.get_stroke_opacity() > 0.05 && dist_to_polyline(poly, p) <= tol + stroke;
}
/** Bezier curves -> polyline (8 samples per curve), subpaths separated by null. */
function flatten(m: VMobject): (Point3D | null)[] {
  const out: (Point3D | null)[] = [];
  const n = m.points.length / 3;
  const nppc = m.n_points_per_cubic_curve;
  for (let i = 0; i + nppc <= n; i += nppc) {
    const [a, b, c, d] = [0, 1, 2, 3].map((k) => getPoint(m.points, i + k));
    if (i > 0) {
      const prev = getPoint(m.points, i - 1);
      if (Math.hypot(prev[0] - a[0], prev[1] - a[1]) > 1e-6) out.push(null);
    }
    for (let s = 0; s <= 8; s++) {
      const t = s / 8, u = 1 - t;
      out.push([u * u * u * a[0] + 3 * u * u * t * b[0] + 3 * u * t * t * c[0] + t * t * t * d[0], u * u * u * a[1] + 3 * u * u * t * b[1] + 3 * u * t * t * c[1] + t * t * t * d[1], 0]);
    }
  }
  return out;
}
function inside(poly: (Point3D | null)[], p: Point3D): boolean {
  let c = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i], b = poly[j];
    if (!a || !b) continue;
    if (a[1] > p[1] !== b[1] > p[1] && p[0] < ((b[0] - a[0]) * (p[1] - a[1])) / (b[1] - a[1]) + a[0]) c = !c;
  }
  return c;
}
function dist_to_polyline(poly: (Point3D | null)[], p: Point3D): number {
  let best = Infinity;
  for (let i = 1; i < poly.length; i++) {
    const a = poly[i - 1], b = poly[i];
    if (!a || !b) continue;
    const dx = b[0] - a[0], dy = b[1] - a[1];
    const L2 = dx * dx + dy * dy;
    const t = L2 ? clamp(((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / L2, 0, 1) : 0;
    best = Math.min(best, Math.hypot(a[0] + t * dx - p[0], a[1] + t * dy - p[1]));
  }
  return best;
}
