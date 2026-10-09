// Drag and drop for mobjects, with drop zones and snapping (web extension,
// see docs/EXTENSIONS.md).
//
//   const bet = { id: 'big', region: big_pizza, snap_to: 'none' };
//   ui.add_draggable(coin, { zones: [bet, small_bet], return_if_missed: true,
//                            on_drop: (zone) => world.emit('bet', { zone }) });
//
// Keyboard: Tab selects a draggable, arrow keys move it (Shift = 5x), Enter
// drops it into the nearest zone, Escape puts it back.
import { Mobject } from '../mobject/mobject';
import { add, sub, to3, type Point3D, type Point3DLike } from '../utils/vector';
import { box_distance, box_polygon, mobject_box, mobject_distance, polygon_area, polygon_centroid, polygon_distance, vmobject_to_polygon, type Box } from './geom';
import type { AffordanceCtx, CoachPath, Constraint, Interaction, InteractiveItem, PointerInfo } from './interact';
import { ease, glide, motion_enabled, stop_glide } from './juice';

// ---------------------------------------------------------------- regions

/**
 * An area of the scene:
 * a Mobject (its bounding box, read live), `{ shape }` (the outline of a
 * closed VMobject, live), `{ polygon }`, `{ box: [xmin, xmax, ymin, ymax] }`,
 * `{ center, radius }` (a disc) or a predicate.
 */
export type Region =
  | Mobject
  | { shape: Mobject }
  | { polygon: readonly Point3DLike[] }
  | { box: Box }
  | { center: Point3DLike; radius: number }
  | ((p: Point3D) => boolean);

const disc_polygon = (c: Point3DLike, r: number, n = 48): Point3D[] =>
  Array.from({ length: n }, (_, i) => [c[0] + r * Math.cos((i / n) * Math.PI * 2), c[1] + r * Math.sin((i / n) * Math.PI * 2), 0] as Point3D);

/** The polygon outlining a region (null for predicates or empty mobjects). */
export function region_outline(r: Region): Point3D[] | null {
  if (typeof r === 'function') return null;
  if (r instanceof Mobject) {
    const b = mobject_box(r);
    return b ? box_polygon(b) : null;
  }
  if ('shape' in r) {
    const poly = vmobject_to_polygon(r.shape);
    return poly.length >= 3 ? poly : null;
  }
  if ('polygon' in r) return r.polygon.map(to3);
  if ('box' in r) return box_polygon(r.box);
  return disc_polygon(r.center, r.radius);
}

/** Does the region contain p? */
export function region_contains(r: Region, p: Point3DLike): boolean {
  return region_distance(r, p) === 0;
}

/** 0 inside the region, else the distance to it (Infinity outside a predicate region). */
export function region_distance(r: Region, p: Point3DLike): number {
  const q = to3(p);
  if (typeof r === 'function') return r(q) ? 0 : Infinity;
  if (r instanceof Mobject) {
    const b = mobject_box(r);
    return b ? box_distance(q, b) : Infinity;
  }
  if ('box' in r) return box_distance(q, r.box);
  if ('center' in r) return Math.max(0, Math.hypot(q[0] - r.center[0], q[1] - r.center[1]) - r.radius);
  const poly = region_outline(r);
  return poly ? polygon_distance(q, poly) : Infinity;
}

/** Centre of a region (null for predicates). */
export function region_center(r: Region): Point3D | null {
  if (typeof r === 'function') return null;
  if (r instanceof Mobject) return r.get_center();
  if ('center' in r) return to3(r.center);
  if ('box' in r) return [(r.box[0] + r.box[1]) / 2, (r.box[2] + r.box[3]) / 2, 0];
  const poly = region_outline(r);
  return poly ? polygon_centroid(poly) : null;
}

/** Area of a region (Infinity for predicates): nested zones prefer the smaller one. */
export function region_area(r: Region): number {
  if (typeof r === 'function') return Infinity;
  if ('center' in r && !(r instanceof Mobject)) return Math.PI * r.radius * r.radius;
  const poly = region_outline(r);
  return poly ? Math.abs(polygon_area(poly)) : Infinity;
}

// ---------------------------------------------------------------- snapping and zone choice (pure)

/** Snap p to the lattice origin + k * step (step per axis or one for both). */
export function snap_to_grid(p: Point3DLike, step: number | readonly [number, number], origin: Point3DLike = [0, 0, 0]): Point3D {
  const [sx, sy] = typeof step === 'number' ? [step, step] : step;
  const r = (x: number) => Math.round(x * 1e9) / 1e9;
  return [
    sx > 0 ? r(origin[0] + Math.round((p[0] - origin[0]) / sx) * sx) : p[0],
    sy > 0 ? r(origin[1] + Math.round((p[1] - origin[1]) / sy) * sy) : p[1],
    p[2] ?? 0,
  ];
}

/** The nearest of `points` within `radius` of p, or null. */
export function snap_to_points(p: Point3DLike, points: readonly Point3DLike[], radius = Infinity): Point3D | null {
  let best: Point3D | null = null, bd = radius;
  for (const q of points) {
    const d = Math.hypot(q[0] - p[0], q[1] - p[1]);
    if (d <= bd) {
      bd = d;
      best = to3(q);
    }
  }
  return best;
}

/**
 * Choose the zone for a drop at p (null = none):
 * 1. zones containing p, smallest area first, then the nearest centre;
 * 2. else zones within `radius` of p, nearest first;
 * 3. else, with `nearest`, the nearest zone at any distance (keyboard drops).
 * `allowed` filters zones (accepts, capacity).
 */
export function choose_zone<Z extends { region: Region }>(zones: readonly Z[], p: Point3DLike, o: { radius?: number; nearest?: boolean; allowed?: (z: Z) => boolean } = {}): Z | null {
  const cands = zones.filter((z) => !o.allowed || o.allowed(z));
  const dist = (z: Z) => region_distance(z.region, p);
  const centre_d = (z: Z) => {
    const c = region_center(z.region);
    return c ? Math.hypot(c[0] - p[0], c[1] - p[1]) : 0;
  };
  const inside = cands.filter((z) => dist(z) === 0);
  if (inside.length) {
    inside.sort((a, b) => region_area(a.region) - region_area(b.region) || centre_d(a) - centre_d(b));
    return inside[0];
  }
  const limit = o.nearest ? Infinity : o.radius ?? 0;
  let best: Z | null = null, bd = Infinity;
  for (const z of cands) {
    const d = dist(z);
    if (d <= limit && d < bd) {
      bd = d;
      best = z;
    }
  }
  return best;
}

// ---------------------------------------------------------------- drop zones

/** A place draggables can be dropped into. */
export interface DropZone {
  id: string;
  region: Region;
  /**
   * Where a dropped item's centre goes: 'center' (default, the region's
   * centre), 'none' (stays where dropped), a point, or a function of
   * (draggable, drop point, number of items already in the zone).
   */
  snap_to?: 'center' | 'none' | Point3DLike | ((d: Draggable, p: Point3D, n: number) => Point3DLike);
  /** Which draggables may be dropped here (default: all). */
  accepts?: (d: Draggable) => boolean;
  /** Maximum number of items (default unlimited). */
  capacity?: number;
  /** When full: 'reject' (default) or 'bump' the oldest item (to where the new one came from, else home). */
  when_full?: 'reject' | 'bump';
  /** Accessible name ("the 16-inch bet"). */
  label?: string;
  /** Text shown on the zone while dragging (default 'Drop here'). */
  hint?: string;
}

/** Where an item dropped at p into zone z goes. */
export function zone_target(z: DropZone, d: Draggable | null, p: Point3DLike, n = 0): Point3D {
  const s = z.snap_to ?? 'center';
  if (s === 'none') return to3(p);
  if (s === 'center') return region_center(z.region) ?? to3(p);
  if (typeof s === 'function') return to3(s(d as Draggable, to3(p), n));
  return to3(s);
}

export interface DropInfo {
  /** Zone id before the drag (null = none). */
  from: string | null;
  /** Where the item's centre ends up. */
  point: Point3D;
  /** The drop hit no zone (it may still have returned to its old zone). */
  missed: boolean;
  via: 'pointer' | 'keyboard' | 'code' | 'bump';
  /** Items pushed out of a full zone by this drop. */
  bumped: Draggable[];
}

export interface DraggableOptions {
  zones?: DropZone[];
  /**
   * Snapping: a grid step (number or [sx, sy], applied while dragging; see
   * `snap_origin`), magnet points (on drop, within `snap_radius`) or any
   * Constraint (applied while dragging).
   */
  snap?: number | readonly [number, number] | readonly Point3DLike[] | Constraint;
  snap_origin?: Point3DLike;
  /** Scene units: magnet points and near misses of zones (default 0.35). */
  snap_radius?: number;
  /** When a drop hits no zone: true = back to where it was picked up, 'home' = back to `home` (and out of any zone). */
  return_if_missed?: boolean | 'home';
  /** Home position (default: where it is now). */
  home?: Point3DLike;
  /** Constraint on the item's centre while dragging (e.g. constrain.in_box). */
  constrain?: Constraint;
  label?: string;
  hint?: string;
  /** Pulsing halo until first use (default true). */
  halo?: boolean;
  /** Scale up slightly while dragged (default true). */
  lift?: boolean;
  /** Bring to the front when picked (top-level mobjects only; default true). */
  to_front?: boolean;
  /** Arrow-key step in scene units (default: the grid step or 0.25). */
  step?: number;
  /** Zone for Enter (undefined: the nearest allowed zone; null: none). `moved`: arrows were used. */
  keyboard_zone?: (d: Draggable, moved: boolean) => DropZone | null | undefined;
  /** Anything the lesson wants to keep with the item. */
  data?: unknown;
  on_pick?: (d: Draggable) => void;
  on_move?: (d: Draggable, p: Point3D) => void;
  /** Called when the item has settled: the zone it is in (id) or null. */
  on_drop?: (zone: string | null, d: Draggable, info: DropInfo) => void;
}

let entry_seq = 0;

/** The draggables currently in a zone (by object or id). */
export function draggables_in(ui: Interaction, zone: DropZone | string): Draggable[] {
  return ui.items.filter((x): x is Draggable => x instanceof Draggable && !!x.zone && (typeof zone === 'string' ? x.zone.id === zone : x.zone === zone));
}

/** Position of m in the scene's draw order (higher = on top; -1 when not in the scene). */
export function scene_depth(ui: Interaction, m: Mobject): number {
  const tops = ui.player.scene.mobjects;
  for (let i = tops.length - 1; i >= 0; i--) {
    if (tops[i] === m) return i;
    const fam = tops[i].get_family();
    const k = fam.indexOf(m);
    if (k >= 0) return i + k / (fam.length + 1);
  }
  return -1;
}

/** A mobject the learner can drag (and drop into zones). Created by `ui.add_draggable`. */
export class Draggable implements InteractiveItem {
  kind = 'draggable';
  ui: Interaction;
  mobject: Mobject;
  o: DraggableOptions;
  zones: DropZone[];
  home: Point3D;
  /** The zone it is in (null = none). */
  zone: DropZone | null = null;
  /** While dragging: the zone it would drop into now. */
  candidate: DropZone | null = null;
  label: string;
  hint: string;
  enabled = true;
  focusable = true;
  priority = 2;
  hot = false;
  active = false;
  focused = false;
  data: unknown;
  private entered = 0;
  private grab: Point3D = [0, 0, 0];
  private pick_pos: Point3D = [0, 0, 0];
  private pick_zone: DropZone | null = null;
  private carrying = false;
  private moved = false;
  private lifted = 1;

  constructor(ui: Interaction, mobject: Mobject, o: DraggableOptions = {}) {
    this.ui = ui;
    this.mobject = mobject;
    this.o = o;
    this.zones = o.zones ?? [];
    this.home = o.home ? to3(o.home) : mobject.get_center();
    this.label = o.label ?? 'item';
    this.hint = o.hint ?? 'Drag {label}';
    this.data = o.data;
    ui.add_item(this);
  }
  get zone_id(): string | null {
    return this.zone?.id ?? null;
  }
  /** Is the item being moved (pointer or keyboard)? */
  get dragging(): boolean {
    return this.active || this.carrying;
  }

  // ---------------------------------------------------------------- item protocol
  hit(p: Point3D, tol: number): number | null {
    const d = mobject_distance(this.mobject, p, tol);
    return d <= tol ? d : null;
  }
  depth(): number {
    return scene_depth(this.ui, this.mobject);
  }
  cursor(): string {
    return 'grab';
  }
  down(p: Point3D, _info: PointerInfo): boolean {
    this.begin();
    this.grab = sub(this.mobject.get_center(), p);
    return true;
  }
  move(p: Point3D): void {
    this.place_at(add(p, this.grab));
  }
  up(_p: Point3D, _info: PointerInfo, cancelled: boolean): void {
    if (cancelled) this.cancel();
    else this.drop('pointer');
  }
  key(e: KeyboardEvent): boolean {
    const dirs: Record<string, [number, number]> = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, 1], ArrowDown: [0, -1] };
    const d = dirs[e.key];
    if (d) {
      if (!this.carrying) {
        this.begin();
        this.carrying = true;
      }
      const s = (this.o.step ?? this.grid_step() ?? 0.25) * (e.shiftKey ? 5 : 1);
      const c = this.mobject.get_center();
      this.place_at([c[0] + d[0] * s, c[1] + d[1] * s, c[2]]);
      this.moved = true;
      return true;
    }
    if (e.key === 'Enter' || e.key === ' ') {
      const moved = this.carrying && this.moved;
      let z: DropZone | null | undefined = this.o.keyboard_zone?.(this, moved);
      if (z === undefined && this.zones.length) z = choose_zone(this.zones, this.mobject.get_center(), { nearest: true, allowed: (x) => this.can_enter(x) });
      if (!this.carrying) this.begin();
      this.carrying = false;
      this.drop('keyboard', z === undefined ? undefined : z);
      return true;
    }
    if (e.key === 'Escape' && this.carrying) {
      this.carrying = false;
      this.cancel();
      return true;
    }
    return false;
  }
  focus_changed(on: boolean): void {
    if (!on && this.carrying) {
      this.carrying = false;
      this.drop('keyboard');
    }
  }
  describe(): string {
    const z = this.zone ? `, in ${this.zone.label ?? this.zone.id}` : '';
    return `${this.label}${z}. Arrow keys move, Enter drops${this.zones.length ? ' into the nearest place' : ''}.`;
  }
  anchor(): Point3D {
    return this.mobject.get_center();
  }
  coach_path(): CoachPath {
    const c = this.mobject.get_center();
    const z = this.zones.length ? choose_zone(this.zones, c, { nearest: true, allowed: (x) => x !== this.zone && this.can_enter(x) }) : null;
    const t = z ? zone_target(z, this, region_center(z.region) ?? c, draggables_in(this.ui, z).length) : ([c[0] + 1, c[1], 0] as Point3D);
    return { points: [c, t, t, c], ms: 2800 };
  }
  draw_affordance(x: AffordanceCtx): void {
    // zones: strong while this item moves, faint (once per zone set) while unused
    if (this.dragging) this.draw_zones(x, true);
    else if (x.fresh && x.once(this.zones)) this.draw_zones(x, false);
    const b = mobject_box(this.mobject);
    if (!b) return;
    const [cx, cy] = x.px([(b[0] + b[1]) / 2, (b[2] + b[3]) / 2, 0]);
    const R = Math.min(60, Math.max(14, (Math.hypot(b[1] - b[0], b[3] - b[2]) / 2) * x.ppu + 6));
    if ((this.o.halo ?? true) && (x.lead || this.hot || this.focused || this.active)) x.halo(cx, cy, R, { pulse: x.lead && !this.active, focused: this.focused, active: this.active });
    if (x.show_hint && !this.dragging) x.label(this.hint.replace('{label}', this.label), cx, cy, { avoid: R });
  }
  dispose(): void {
    stop_glide(this.mobject);
    this.unlift();
  }

  // ---------------------------------------------------------------- behaviour
  /** Remove it from the interaction (the mobject stays in the scene). */
  remove(): void {
    this.dispose();
    this.ui.remove_item(this);
  }
  /** Can this item be dropped into z now (accepted, and room or 'bump')? */
  can_enter(z: DropZone): boolean {
    if (z.accepts && !z.accepts(this)) return false;
    if (this.zone === z || z.when_full === 'bump') return true;
    return draggables_in(this.ui, z).filter((x) => x !== this).length < (z.capacity ?? Infinity);
  }
  /** Put it into a zone (or out of all zones: null = home) from code, like a drop. */
  send_to(zone: DropZone | string | null, via: DropInfo['via'] = 'code'): void {
    const z = typeof zone === 'string' ? this.zones.find((x) => x.id === zone) ?? null : zone;
    this.pick_pos = this.mobject.get_center();
    this.pick_zone = this.zone;
    this.drop(via, z, z ? undefined : this.home);
  }
  /** Back home, out of any zone, without callbacks. */
  reset(): void {
    stop_glide(this.mobject);
    this.unlift();
    this.zone = null;
    this.mobject.move_to(this.home);
    this.ui.notify();
  }

  private begin(): void {
    stop_glide(this.mobject);
    this.pick_pos = this.mobject.get_center();
    this.pick_zone = this.zone;
    this.moved = false;
    const scene = this.ui.player.scene;
    if ((this.o.to_front ?? true) && scene.mobjects.includes(this.mobject)) scene.bring_to_front(this.mobject);
    this.lift();
    this.ui.juice?.sound('click');
    this.o.on_pick?.(this);
  }
  private grid_step(): number | null {
    const s = this.o.snap;
    if (typeof s === 'number') return s;
    if (Array.isArray(s) && s.length === 2 && typeof s[0] === 'number') return Math.min(s[0] as number, s[1] as number);
    return null;
  }
  private place_at(target: Point3D): void {
    let q = target;
    const s = this.o.snap;
    if (typeof s === 'number' || (Array.isArray(s) && s.length === 2 && typeof s[0] === 'number')) q = snap_to_grid(q, s as number | [number, number], this.o.snap_origin);
    else if (typeof s === 'function') q = s(q);
    if (this.o.constrain) q = this.o.constrain(q);
    this.mobject.move_to(q);
    this.candidate = this.zones.length ? choose_zone(this.zones, q, { radius: this.o.snap_radius ?? 0.35, allowed: (z) => this.can_enter(z) }) : null;
    this.o.on_move?.(this, q);
  }
  private cancel(): void {
    this.unlift();
    this.candidate = null;
    this.zone = this.pick_zone;
    this.settle(this.pick_pos, false, () => this.ui.notify());
  }
  /** Finish a drag: choose the zone (or use `forced`), snap, report. */
  private drop(via: DropInfo['via'], forced?: DropZone | null, forced_point?: Point3D): void {
    this.unlift();
    this.candidate = null;
    const p = this.mobject.get_center();
    const from = this.pick_zone?.id ?? null;
    // the item has left its zone while it moves: it does not count against capacities
    this.zone = null;
    let zone: DropZone | null = forced !== undefined ? (forced && this.can_enter(forced) ? forced : null) : this.zones.length ? choose_zone(this.zones, p, { radius: this.o.snap_radius ?? 0.35, allowed: (z) => this.can_enter(z) }) : null;
    let target: Point3D | null = forced_point ?? null;
    let missed = false;
    const bumped: Draggable[] = [];
    if (zone) {
      const z = zone;
      const others = () => draggables_in(this.ui, z).sort((a, b) => a.entered - b.entered);
      const cap = z.capacity ?? Infinity;
      for (let occ = others(), guard = 0; occ.length >= cap && occ.length && guard < 64; occ = others(), guard++) {
        const o = occ[0];
        // swap into the slot this item came from when there is room, else send it home
        const pz = this.pick_zone;
        const back = pz && pz !== z && (!pz.accepts || pz.accepts(o)) && draggables_in(this.ui, pz).length < (pz.capacity ?? Infinity) ? pz : null;
        o.send_to(back, 'bump');
        bumped.push(o);
      }
      if (this.pick_zone !== z) this.entered = ++entry_seq;
      target = zone_target(z, this, p, others().length);
    } else if (!forced_point) {
      missed = true;
      const s = this.o.snap;
      const magnets = Array.isArray(s) && s.length && typeof s[0] !== 'number' ? (s as readonly Point3DLike[]) : null;
      const m = magnets ? snap_to_points(p, magnets, this.o.snap_radius ?? 0.35) : null;
      if (m) target = m;
      else if (this.o.return_if_missed === true) {
        target = this.pick_pos;
        zone = this.pick_zone;
      } else if (this.o.return_if_missed === 'home') target = this.home;
    }
    this.zone = zone;
    const final = target ?? p;
    const done = () => {
      this.o.on_drop?.(zone?.id ?? null, this, { from, point: final, missed, via, bumped });
      this.ui.notify();
    };
    if (zone && !missed) {
      this.ui.juice?.pulse(final);
      this.ui.juice?.sound('snap');
    }
    if (via !== 'bump') this.ui.announce(missed && target ? `${this.label} returned` : zone ? `${this.label} placed in ${zone.label ?? zone.id}` : `${this.label} dropped`);
    this.settle(target, !!zone && !missed, done);
  }
  /** Move to `target` (animated when motion is allowed), then call `done`. */
  private settle(target: Point3D | null, snappy: boolean, done: () => void): void {
    if (!target || Math.hypot(target[0] - this.mobject.get_center()[0], target[1] - this.mobject.get_center()[1]) < 1e-9) return done();
    if (!motion_enabled()) {
      this.mobject.move_to(target);
      return done();
    }
    void glide(this.ui, this.mobject, target, { ms: snappy ? 190 : 240, ease: snappy ? ease.out_back : ease.out_cubic }).then(done);
  }
  private lift(): void {
    if (this.o.lift === false || this.lifted !== 1) return;
    this.lifted = 1.06;
    this.mobject.scale(this.lifted);
  }
  private unlift(): void {
    if (this.lifted === 1) return;
    this.mobject.scale(1 / this.lifted);
    this.lifted = 1;
  }
  private draw_zones(x: AffordanceCtx, strong: boolean): void {
    const many = this.zones.length > 3;
    for (const z of this.zones) {
      const pts = region_outline(z.region);
      if (!pts) continue;
      const ok = this.can_enter(z) && z !== this.zone;
      const cand = strong && z === this.candidate;
      const empty = draggables_in(this.ui, z).length === 0;
      if (!strong && !empty) continue;
      x.outline(pts, {
        closed: true,
        dash: [7, 6],
        alpha: cand ? 1 : strong ? (ok ? 0.75 : 0.25) : 0.4,
        width: cand ? 3 : 2,
        fill_alpha: cand ? 0.14 : 0,
        dash_offset: strong && !x.reduced_motion ? -x.t * 18 : 0,
      });
      if (strong && ok && (cand || (!many && !this.candidate))) {
        const c = region_center(z.region);
        if (c) {
          const [cx, cy] = x.px(c);
          x.label(z.hint ?? 'Drop here', cx, cy - 4, { below: false });
        }
      }
    }
  }
}
