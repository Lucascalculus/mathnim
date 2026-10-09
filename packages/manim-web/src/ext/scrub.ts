// Scrubbable numbers: drag left/right on a number to change it (web
// extension, see docs/EXTENSIONS.md). Like Bret Victor's "explorable" numbers.
//
//   const r = ValueTracker(2);
//   const num = always_redraw(() => DecimalNumber(r.get_value(), { num_decimal_places: 1 }).move_to(UP * 3));
//   ui.add_scrubber(() => num, r, { step: 0.1, min: 0.5, max: 4, label: 'radius' });
//
// Keyboard: arrow keys step (Shift = 5 steps), PageUp/PageDown = 10 steps,
// Home/End = min/max.
import type { Mobject } from '../mobject/mobject';
import type { ValueTracker } from '../mobject/value_tracker';
import type { Point3D } from '../utils/vector';
import { box_distance, mobject_box, type Box } from './geom';
import type { AffordanceCtx, CoachPath, Interaction, InteractiveItem, PointerInfo } from './interact';

export interface ScrubMath {
  /** Value change per step (default 1). */
  step?: number;
  min?: number;
  max?: number;
  /** CSS pixels of horizontal drag per step (default 8). */
  px_per_step?: number;
}

const tidy = (v: number) => Number(v.toFixed(10));
const clamp_v = (v: number, o: ScrubMath) => Math.min(o.max ?? Infinity, Math.max(o.min ?? -Infinity, v));

/** `n` steps from `start`, on the step grid (anchored at min, else 0), clamped. n = 0 keeps start. */
export function step_value(start: number, n: number, o: ScrubMath = {}): number {
  if (n === 0) return clamp_v(start, o);
  const step = o.step ?? 1;
  const base = o.min ?? 0;
  const v = start + n * step;
  return tidy(clamp_v(base + Math.round((v - base) / step) * step, o));
}

/** Value after a horizontal drag of dx_px CSS pixels that started at `start`. */
export function scrub_value(start: number, dx_px: number, o: ScrubMath = {}): number {
  const n = Math.trunc(dx_px / (o.px_per_step ?? 8));
  return step_value(start, n, o);
}

export interface ScrubOptions extends ScrubMath {
  /** Also call target.set_value(v) when the target has one (DecimalNumber; default true). */
  sync?: boolean;
  label?: string;
  hint?: string;
  /** Decimals for screen readers (default: from the step). */
  decimals?: number;
  /** Extra grab area around the number, in scene units (default 0.12). */
  pad?: number;
  on_start?: (v: number, s: Scrubber) => void;
  on_change?: (v: number, s: Scrubber) => void;
  on_end?: (v: number, s: Scrubber) => void;
}

/** A number the learner drags sideways to change a ValueTracker. Created by `ui.add_scrubber`. */
export class Scrubber implements InteractiveItem {
  kind = 'scrubber';
  ui: Interaction;
  tracker: ValueTracker;
  o: ScrubOptions;
  label: string;
  hint: string;
  enabled = true;
  focusable = true;
  priority = 2;
  hot = false;
  active = false;
  focused = false;
  private target: Mobject | (() => Mobject);
  private start = 0;
  private x0 = 0;

  constructor(ui: Interaction, target: Mobject | (() => Mobject), tracker: ValueTracker, o: ScrubOptions = {}) {
    this.ui = ui;
    this.target = target;
    this.tracker = tracker;
    this.o = o;
    this.label = o.label ?? 'number';
    this.hint = o.hint ?? 'Drag ↔ to change {label}';
    ui.add_item(this);
  }
  /** The number mobject (resolved when given as a function, e.g. from always_redraw). */
  get mobject(): Mobject {
    return typeof this.target === 'function' ? this.target() : this.target;
  }
  get value(): number {
    return this.tracker.get_value();
  }
  /** Set the value from code (clamped, not snapped), redraw and report. */
  set_value(v: number): void {
    this.apply(clamp_v(v, this.o));
    this.ui.notify();
  }

  // ---------------------------------------------------------------- item protocol
  hit(p: Point3D, tol: number): number | null {
    const b = this.box();
    if (!b) return null;
    const d = box_distance(p, b);
    return d <= tol ? d : null;
  }
  cursor(): string {
    return 'ew-resize';
  }
  down(_p: Point3D, info: PointerInfo): boolean {
    this.start = this.value;
    this.x0 = info.client[0];
    this.o.on_start?.(this.start, this);
    return true;
  }
  move(_p: Point3D, info: PointerInfo): void {
    this.apply(scrub_value(this.start, info.client[0] - this.x0, this.o));
  }
  up(_p: Point3D, _info: PointerInfo, cancelled: boolean): void {
    if (cancelled) this.apply(this.start);
    this.o.on_end?.(this.value, this);
  }
  key(e: KeyboardEvent): boolean {
    const n: Record<string, number> = { ArrowRight: 1, ArrowUp: 1, ArrowLeft: -1, ArrowDown: -1, PageUp: 10, PageDown: -10 };
    let v: number | null = null;
    if (e.key in n) v = step_value(this.value, n[e.key] * (e.shiftKey && Math.abs(n[e.key]) === 1 ? 5 : 1), this.o);
    else if (e.key === 'Home' && this.o.min !== undefined) v = this.o.min;
    else if (e.key === 'End' && this.o.max !== undefined) v = this.o.max;
    if (v === null) return false;
    const before = this.value;
    this.apply(v);
    if (this.value !== before) this.o.on_end?.(this.value, this);
    return true;
  }
  describe(): string {
    return `${this.label}: ${this.format(this.value)}${this.o.min !== undefined && this.o.max !== undefined ? ` (from ${this.format(this.o.min)} to ${this.format(this.o.max)})` : ''}. Arrow keys change it.`;
  }
  anchor(): Point3D | null {
    const b = this.box();
    return b ? [(b[0] + b[1]) / 2, (b[2] + b[3]) / 2, 0] : null;
  }
  coach_path(): CoachPath | null {
    const c = this.anchor();
    if (!c) return null;
    return { points: [c, [c[0] + 0.8, c[1], 0], [c[0] - 0.6, c[1], 0], c], ms: 2400 };
  }
  draw_affordance(x: AffordanceCtx): void {
    const b = this.box();
    if (!b) return;
    const [l, top] = x.px([b[0], b[3], 0]), [r, bottom] = x.px([b[1], b[2], 0]);
    const cy = (top + bottom) / 2;
    const g = x.g;
    const on = x.fresh || this.hot || this.focused || this.active;
    // dotted underline: "this number can be changed"
    g.save();
    g.strokeStyle = x.color;
    g.globalAlpha = on ? 0.9 : 0.45;
    g.lineWidth = 2;
    g.setLineDash([2, 4]);
    g.beginPath();
    g.moveTo(l, bottom + 5);
    g.lineTo(r, bottom + 5);
    g.stroke();
    g.restore();
    if (on) {
      const k = x.reduced_motion || this.active ? 0 : Math.sin(x.t * 4) * 2;
      x.arrows((l + r) / 2, cy, (r - l) / 2 + 6 + k, [[1, 0], [-1, 0]]);
    }
    if (this.focused || this.active) x.outline([[b[0] - 0.08, b[2] - 0.08, 0], [b[1] + 0.08, b[2] - 0.08, 0], [b[1] + 0.08, b[3] + 0.08, 0], [b[0] - 0.08, b[3] + 0.08, 0]], { closed: true, alpha: 0.9, width: this.focused ? 3 : 2, dash: [] });
    if (x.show_hint && !this.active) x.label(this.hint.replace('{label}', this.label), (l + r) / 2, cy, { avoid: Math.max((r - l) / 2, (bottom - top) / 2) + 14 });
  }

  private box(): Box | null {
    const b = mobject_box(this.mobject);
    if (!b) return null;
    const pad = this.o.pad ?? 0.12;
    return [b[0] - pad, b[1] + pad, b[2] - pad, b[3] + pad];
  }
  private apply(v: number): void {
    if (v === this.value) return;
    this.tracker.set_value(v);
    const m = this.mobject as any;
    if ((this.o.sync ?? true) && typeof m.set_value === 'function' && m !== this.tracker) m.set_value(v);
    this.ui.juice?.sound('tick');
    this.o.on_change?.(v, this);
  }
  private format(v: number): string {
    const d = this.o.decimals ?? Math.max(0, Math.min(6, -Math.floor(Math.log10(this.o.step ?? 1) + 1e-9)));
    return v.toFixed(d);
  }
}
