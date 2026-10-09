// Stamps: tap to place copies of a template in an area (web extension, see
// docs/EXTENSIONS.md).
//
//   const tiles = ui.add_stamp(radius_square, { area: { shape: pizza }, grid: r, origin: C, max: 12,
//                                               on_count: (n) => world.emit('tiles', { n }) });
//
// Tap (or press and drag) in the area to place a copy; drag a placed copy to
// move it; drag it out of the area or double-click it to remove it.
// Keyboard: arrow keys move a cursor, Enter places, Delete removes.
import type { Mobject } from '../mobject/mobject';
import { VMobject } from '../mobject/types/vectorized_mobject';
import { add, sub, to3, type Point3D, type Point3DLike } from '../utils/vector';
import { mobject_box, mobject_contains } from './geom';
import type { AffordanceCtx, CoachPath, Interaction, InteractiveItem, PointerInfo } from './interact';
import { region_center, region_distance, region_outline, scene_depth, snap_to_grid, type Region } from './dragdrop';
import { glide, motion_enabled, stop_glide } from './juice';

// ---------------------------------------------------------------- placement rules (pure)

/** Where a stamp placed at p goes: p snapped to the grid (when there is one). */
export function stamp_position(p: Point3DLike, o: { grid?: number | readonly [number, number]; origin?: Point3DLike } = {}): Point3D {
  return o.grid ? snap_to_grid(p, o.grid, o.origin) : to3(p);
}

/**
 * Can a stamp be placed at q (already snapped)? 'full' when `max` stamps are
 * placed, 'taken' when `unique` and another stamp sits on the same point.
 */
export function can_stamp(existing: readonly Point3DLike[], q: Point3DLike, o: { max?: number; unique?: boolean; tolerance?: number } = {}): 'ok' | 'full' | 'taken' {
  if (o.max !== undefined && existing.length >= o.max) return 'full';
  const tol = o.tolerance ?? 1e-6;
  if (o.unique && existing.some((e) => Math.hypot(e[0] - q[0], e[1] - q[1]) <= tol)) return 'taken';
  return 'ok';
}

// ---------------------------------------------------------------- styling helpers

/** Multiply the opacity of every family member by k; returns a function that restores it. */
export function fade_family(m: Mobject, k: number): () => void {
  const saved: [VMobject, number[][], number[][]][] = [];
  for (const f of m.get_family()) {
    if (!(f instanceof VMobject)) continue;
    const fill = f.get_fill_rgbas().map((r) => [...r]), stroke = f.get_stroke_rgbas().map((r) => [...r]);
    saved.push([f, fill, stroke]);
    f.fill_rgbas = fill.map((r) => [r[0], r[1], r[2], r[3] * k]) as any;
    f.stroke_rgbas = stroke.map((r) => [r[0], r[1], r[2], r[3] * k]) as any;
  }
  return () => {
    for (const [f, fill, stroke] of saved) {
      f.fill_rgbas = fill as any;
      f.stroke_rgbas = stroke as any;
    }
  };
}

export interface StampOptions {
  /** Where stamps may be placed. */
  area: Region;
  /** Snap stamp centres to origin + k * grid. */
  grid?: number | readonly [number, number];
  origin?: Point3DLike;
  /** Most stamps allowed. */
  max?: number;
  /** One stamp per grid point (default true with a grid). */
  unique?: boolean;
  /** Translucent preview under the pointer / keyboard cursor (default true). */
  ghost?: boolean;
  /** Name of one stamp ("radius-square"), for hints and screen readers. */
  label?: string;
  hint?: string;
  /** Keyboard cursor step (default: the grid step or 0.25). */
  step?: number;
  /** Build a stamp at p (default: a copy of the template centred at p). */
  make?: (p: Point3D) => Mobject;
  on_place?: (m: Mobject, s: Stamp) => void;
  on_move?: (m: Mobject, s: Stamp) => void;
  on_remove?: (m: Mobject, s: Stamp) => void;
  /** The number of stamps changed. */
  on_count?: (n: number, s: Stamp) => void;
  /** A placement was refused because `max` stamps are placed. */
  on_full?: (s: Stamp) => void;
}

/** Tap-to-place copies of a template. Created by `ui.add_stamp`. */
export class Stamp implements InteractiveItem {
  kind = 'stamp';
  ui: Interaction;
  template: Mobject;
  o: StampOptions;
  label: string;
  hint: string;
  enabled = true;
  focusable = true;
  priority = 1;
  hot = false;
  active = false;
  focused = false;
  private placed: Mobject[] = [];
  private free = new WeakSet<Mobject>(); // adopted pieces: not snapped to the grid
  private drag: { m: Mobject; offset: Point3D; fresh: boolean; start: Point3D; unfade: (() => void) | null } | null = null;
  private ghost_m: Mobject | null = null;
  private ghost_on = false;
  private cursor_p: Point3D | null = null;
  private recent: { m: Mobject; t: number } | null = null;

  constructor(ui: Interaction, template: Mobject, o: StampOptions) {
    this.ui = ui;
    this.template = template;
    this.o = o;
    this.label = o.label ?? 'stamp';
    this.hint = o.hint ?? 'Tap to place a {label}';
    ui.add_item(this);
  }
  /** Placed stamps (in placing order). */
  get stamps(): Mobject[] {
    return [...this.placed];
  }
  get count(): number {
    return this.placed.length;
  }
  private get unique(): boolean {
    return this.o.unique ?? !!this.o.grid;
  }

  // ---------------------------------------------------------------- item protocol
  hit(p: Point3D, tol: number): number | null {
    if (this.stamp_at(p, tol)) return 0;
    return region_distance(this.o.area, p) === 0 ? 0.5 : null;
  }
  depth(): number {
    const s = this.placed.map((m) => scene_depth(this.ui, m));
    return s.length ? Math.max(...s) : 0;
  }
  cursor(p: Point3D | null): string {
    return p && this.stamp_at(p, this.ui.tolerance()) ? 'grab' : 'copy';
  }
  down(p: Point3D, info: PointerInfo): boolean {
    const m = this.stamp_at(p, info.upp * (info.coarse ? 16 : 6));
    this.show_ghost(null);
    if (m) {
      stop_glide(m);
      const scene = this.ui.player.scene;
      if (scene.mobjects.includes(m)) scene.bring_to_front(m);
      this.drag = { m, offset: sub(m.get_center(), p), fresh: false, start: m.get_center(), unfade: null };
      this.ui.juice?.sound('click');
      return true;
    }
    if (region_distance(this.o.area, p) > 0) return false;
    const q = stamp_position(p, this.o);
    const why = this.check(q);
    if (why !== 'ok') {
      this.refuse(why, q);
      return false;
    }
    const nm = this.build(q);
    this.ui.player.scene.add(nm);
    this.drag = { m: nm, offset: sub(q, p), fresh: true, start: q, unfade: null };
    this.ui.juice?.sound('pop');
    return true;
  }
  move(p: Point3D): void {
    const d = this.drag;
    if (!d) return;
    let q = add(p, d.offset);
    if (!this.free.has(d.m)) q = stamp_position(q, this.o);
    d.m.move_to(q);
    const out = region_distance(this.o.area, q) > 0;
    if (out && !d.unfade) d.unfade = fade_family(d.m, 0.35);
    else if (!out && d.unfade) {
      d.unfade();
      d.unfade = null;
    }
  }
  up(_p: Point3D, _info: PointerInfo, cancelled: boolean): void {
    const d = this.drag;
    this.drag = null;
    if (!d) return;
    d.unfade?.();
    const c = d.m.get_center();
    const scene = this.ui.player.scene;
    if (cancelled) {
      if (d.fresh) scene.remove(d.m);
      else d.m.move_to(d.start);
      return;
    }
    if (region_distance(this.o.area, c) > 0) {
      if (d.fresh) scene.remove(d.m);
      else this.remove(d.m);
      return;
    }
    const snapped = !this.free.has(d.m);
    const q = snapped ? stamp_position(c, this.o) : c;
    const others = this.placed.filter((x) => x !== d.m && !this.free.has(x)).map((x) => x.get_center());
    if (snapped && this.unique && can_stamp(others, q, { unique: true }) === 'taken') {
      // that cell is taken: a new stamp is dropped, a moved one goes back
      if (d.fresh) scene.remove(d.m);
      else this.settle(d.m, d.start);
      this.ui.juice?.sound('fail');
      return;
    }
    d.m.move_to(q);
    if (d.fresh) this.commit(d.m, q);
    else if (Math.hypot(q[0] - d.start[0], q[1] - d.start[1]) > 1e-9) {
      this.o.on_move?.(d.m, this);
      this.ui.juice?.pulse(q);
    }
  }
  hover(p: Point3D | null): boolean {
    if (!p || this.drag || (this.o.ghost ?? true) === false || this.stamp_at(p, this.ui.tolerance()) || region_distance(this.o.area, p) > 0) return this.show_ghost(null);
    const q = stamp_position(p, this.o);
    return this.show_ghost(this.check(q) === 'ok' ? q : null);
  }
  double_click(p: Point3D, info: PointerInfo): boolean {
    const m = this.stamp_at(p, info.upp * (info.coarse ? 16 : 6));
    // the first tap of this double tap placed it: keep it (a quick double tap places one stamp)
    if (!m || (this.recent?.m === m && performance.now() - this.recent.t < 500)) return false;
    this.remove(m);
    return true;
  }
  key(e: KeyboardEvent): boolean {
    const dirs: Record<string, [number, number]> = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, 1], ArrowDown: [0, -1] };
    const c = this.kb_cursor();
    const d = dirs[e.key];
    if (d) {
      const g = this.o.grid;
      const [sx, sy] = this.o.step ? [this.o.step, this.o.step] : typeof g === 'number' ? [g, g] : g ? [g[0], g[1]] : [0.25, 0.25];
      const k = e.shiftKey ? 5 : 1;
      const next: Point3D = [c[0] + d[0] * sx * k, c[1] + d[1] * sy * k, 0];
      if (region_distance(this.o.area, next) === 0) this.cursor_p = next;
      this.show_kb_ghost();
      return true;
    }
    if (e.key === 'Enter' || e.key === ' ') {
      if (this.stamp_at(c, 1e-6)) this.ui.announce(`There is already a ${this.label} here`);
      else this.place(c);
      this.show_kb_ghost();
      return true;
    }
    if (e.key === 'Delete' || e.key === 'Backspace') {
      const m = this.stamp_at(c, 1e-6);
      if (m) this.remove(m);
      this.show_kb_ghost();
      return true;
    }
    return false;
  }
  focus_changed(on: boolean): void {
    if (on) this.show_kb_ghost();
    else this.show_ghost(null);
  }
  describe(): string {
    const c = this.kb_cursor();
    const n = this.placed.length, max = this.o.max !== undefined ? ` of ${this.o.max}` : '';
    const here = this.stamp_at(c, 1e-6) ? `, a ${this.label} is here` : '';
    return `${this.label}s placed: ${n}${max}. Cursor at ${c[0].toFixed(2)}, ${c[1].toFixed(2)}${here}. Arrow keys move, Enter places, Delete removes.`;
  }
  anchor(): Point3D | null {
    return region_center(this.o.area);
  }
  coach_path(): CoachPath | null {
    const c = region_center(this.o.area);
    if (!c) return null;
    const q = stamp_position(c, this.o);
    const off: Point3D = [q[0] + 0.9, q[1] - 0.7, 0];
    return { points: [off, q, q, off], ms: 2000 };
  }
  draw_affordance(x: AffordanceCtx): void {
    const outline = region_outline(this.o.area);
    if (outline && (x.fresh || this.focused || this.hot)) {
      x.outline(outline, { closed: true, dash: [6, 6], alpha: this.focused ? 0.8 : 0.45, width: 2, dash_offset: x.reduced_motion ? 0 : -x.t * 12 });
    }
    if (this.focused) {
      const [cx, cy] = x.px(this.kb_cursor());
      x.halo(cx, cy, 10, { focused: true });
    }
    if (this.drag && region_distance(this.o.area, this.drag.m.get_center()) > 0) {
      const [cx, cy] = x.px(this.drag.m.get_center());
      x.label('Release to remove', cx, cy, { avoid: 24, color: '#E11D48' });
    } else if (x.show_hint && !this.drag) {
      const c = region_center(this.o.area);
      if (c && outline) {
        const top = Math.min(...outline.map((q) => x.px(q)[1]));
        x.label(this.hint.replace('{label}', this.label), x.px(c)[0], top - 16, {});
      }
    }
  }
  dispose(): void {
    this.show_ghost(null);
  }

  // ---------------------------------------------------------------- behaviour
  /** Place a stamp at p from code (snapped; refused when full or taken). Returns it or null. */
  place(p: Point3DLike): Mobject | null {
    const q = stamp_position(p, this.o);
    const why = this.check(q);
    if (why !== 'ok') {
      this.refuse(why, q);
      return null;
    }
    const m = this.build(q);
    this.ui.player.scene.add(m);
    this.commit(m, q);
    return m;
  }
  /** Remove a placed stamp (from the scene too). */
  remove(m: Mobject): void {
    if (!this.placed.includes(m)) return;
    this.placed = this.placed.filter((x) => x !== m);
    this.ui.player.scene.remove(m);
    this.ui.juice?.sound('click');
    this.o.on_remove?.(m, this);
    this.o.on_count?.(this.placed.length, this);
    this.ui.announce(`${this.label} removed, ${this.placed.length} left`);
    this.ui.notify();
  }
  /** Remove every stamp (no on_remove callbacks; on_count once). */
  clear(): void {
    const scene = this.ui.player.scene;
    for (const m of this.placed) scene.remove(m);
    this.placed = [];
    this.o.on_count?.(0, this);
    this.ui.notify();
  }
  /**
   * Treat a mobject already in the scene as a placed stamp (e.g. the pieces of a
   * cut stamp). Adopted stamps are not snapped to the grid.
   */
  adopt(m: Mobject, o: { snap?: boolean } = {}): void {
    if (this.placed.includes(m)) return;
    this.placed.push(m);
    if (!o.snap) this.free.add(m);
    this.o.on_count?.(this.placed.length, this);
  }
  /** Stop managing a stamp without removing it from the scene (e.g. it was cut into pieces). */
  forget(m: Mobject): void {
    if (!this.placed.includes(m)) return;
    this.placed = this.placed.filter((x) => x !== m);
    this.o.on_count?.(this.placed.length, this);
  }

  private check(q: Point3D): 'ok' | 'full' | 'taken' {
    const snapped = this.placed.filter((x) => !this.free.has(x)).map((x) => x.get_center());
    if (this.o.max !== undefined && this.placed.length >= this.o.max) return 'full';
    return can_stamp(snapped, q, { unique: this.unique });
  }
  private refuse(why: 'full' | 'taken' | 'ok', q: Point3D): void {
    if (why === 'full') {
      this.ui.juice?.sound('fail');
      this.ui.juice?.pulse(q, { color: '#E11D48' });
      this.ui.announce(`No more ${this.label}s: ${this.o.max} is the most`);
      this.o.on_full?.(this);
    }
  }
  private build(q: Point3D): Mobject {
    const m = this.o.make ? this.o.make(q) : this.template.copy();
    m.move_to(q);
    return m;
  }
  private commit(m: Mobject, q: Point3D): void {
    this.placed.push(m);
    this.recent = { m, t: performance.now() };
    this.ui.juice?.pulse(q);
    this.o.on_place?.(m, this);
    this.o.on_count?.(this.placed.length, this);
    this.ui.announce(`${this.label} placed: ${this.placed.length}${this.o.max !== undefined ? ` of ${this.o.max}` : ''}`);
    this.ui.notify();
  }
  /** The topmost placed stamp under p. */
  private stamp_at(p: Point3DLike, tol: number): Mobject | null {
    for (let i = this.placed.length - 1; i >= 0; i--) {
      const m = this.placed[i];
      const b = mobject_box(m);
      if (!b) continue;
      if (tol <= 1e-6 ? p[0] >= b[0] && p[0] <= b[1] && p[1] >= b[2] && p[1] <= b[3] : mobject_contains(m, p, tol)) return m;
    }
    return null;
  }
  private kb_cursor(): Point3D {
    if (!this.cursor_p) {
      const c = region_center(this.o.area) ?? [0, 0, 0];
      const q = stamp_position(c, this.o);
      this.cursor_p = region_distance(this.o.area, q) === 0 ? q : c;
    }
    return this.cursor_p;
  }
  private show_kb_ghost(): void {
    const c = this.kb_cursor();
    this.show_ghost(this.check(c) === 'ok' && !this.stamp_at(c, 1e-6) ? c : null);
  }
  /** Show the ghost at q (null hides it). Returns whether anything changed. */
  private show_ghost(q: Point3D | null): boolean {
    const scene = this.ui.player.scene;
    if (!q || (this.o.ghost ?? true) === false) {
      if (!this.ghost_on) return false;
      if (this.ghost_m) scene.remove(this.ghost_m);
      this.ghost_on = false;
      return true;
    }
    if (!this.ghost_m) {
      this.ghost_m = this.build(q);
      fade_family(this.ghost_m, 0.3);
    }
    const before = this.ghost_m.get_center();
    this.ghost_m.move_to(q);
    if (!this.ghost_on) {
      scene.add(this.ghost_m);
      this.ghost_on = true;
      return true;
    }
    return Math.hypot(before[0] - q[0], before[1] - q[1]) > 1e-9;
  }
  private settle(m: Mobject, to: Point3D): void {
    if (!motion_enabled()) m.move_to(to);
    else void glide(this.ui, m, to, { ms: 200 });
  }
}
