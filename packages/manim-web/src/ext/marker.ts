// A marker on a number line (web extension, see docs/EXTENSIONS.md): a pin
// the learner drags along a NumberLine, with a live value label. A thin
// convenience over Interaction.add_handle.
//
//   const nl = NumberLine({ x_range: [0, 5, 1], length: 10, include_numbers: true });
//   const guess = ValueTracker(1);
//   const m = ui.add_marker(nl, guess, { label: 'your estimate of π', decimals: 2, show_value: false });
//   ...later: m.show_value(true);
import { Polygon } from '../mobject/geometry/polygram';
import type { Mobject } from '../mobject/mobject';
import { VGroup } from '../mobject/types/vectorized_mobject';
import type { ValueTracker } from '../mobject/value_tracker';
import type { ParsableManimColor } from '../utils/color/core';
import { registry } from '../utils/registry';
import type { Point3D } from '../utils/vector';
import type { DragHandle, Interaction } from './interact';

/** What the marker needs from a number line (NumberLine and UnitInterval have it). */
interface LineLike {
  n2p(x: number): Point3D;
  p2n(p: Point3D): number;
  x_range: number[];
  get_unit_vector(): Point3D;
}

export interface MarkerOptions {
  /** Accessible name (default 'marker'). */
  label?: string;
  /** Decimals of the value label (default 1). */
  decimals?: number;
  /** Arrow-key step (default a tenth of the line's tick step). */
  step?: number;
  /** Snap values while dragging (e.g. 0.1). */
  snap?: number;
  /** Range (default the line's x_range). */
  min?: number;
  max?: number;
  color?: ParsableManimColor;
  /** Show the live value above the pin (default true; hide it for estimates). */
  show_value?: boolean;
  font_size?: number;
  /** Pin size in scene units (default 0.24). */
  size?: number;
  on_change?: (v: number, m: NumberLineMarker) => void;
  on_end?: (v: number, m: NumberLineMarker) => void;
}

/** A draggable pin on a NumberLine. Created by `ui.add_marker`. */
export class NumberLineMarker {
  ui: Interaction;
  line: LineLike & Mobject;
  tracker: ValueTracker;
  o: MarkerOptions;
  handle: DragHandle;
  pin: Polygon;
  readout: Mobject | null = null;
  /** Pin and label (added to the scene; follows the tracker with an updater). */
  group: VGroup;
  private showing: boolean;

  constructor(ui: Interaction, number_line: Mobject, tracker: ValueTracker, o: MarkerOptions = {}) {
    this.ui = ui;
    this.line = number_line as LineLike & Mobject;
    this.tracker = tracker;
    this.o = o;
    const color = o.color ?? '#2563EB';
    const s = o.size ?? 0.24;
    this.pin = new Polygon([-s / 2, s * 1.15, 0], [s / 2, s * 1.15, 0], [0, 0, 0], { color, fill_opacity: 1, stroke_width: 0 });
    this.group = new VGroup(this.pin);
    this.showing = o.show_value ?? true;
    const DecimalNumber = registry.DecimalNumber;
    if (DecimalNumber) {
      this.readout = new DecimalNumber(tracker.get_value(), { num_decimal_places: o.decimals ?? 1, font_size: o.font_size ?? 32, color });
      this.group.add(this.readout!);
    }
    this.group.add_updater(() => this.sync());
    this.sync();
    ui.player.scene.add(this.group);
    const [lo, hi] = [o.min ?? this.line.x_range[0], o.max ?? this.line.x_range[1]];
    const clampv = (v: number) => Math.min(hi, Math.max(lo, o.snap ? Math.round(v / o.snap) * o.snap : v));
    this.handle = ui.add_handle({
      mobject: this.pin,
      tracker,
      label: o.label ?? 'marker',
      step: o.step ?? (this.line.x_range[2] ?? 1) / 10,
      highlight: false,
      from_value: (v) => this.line.n2p(v),
      to_value: (p) => clampv(this.line.p2n(p)),
      on_change: () => o.on_change?.(tracker.get_value(), this),
      on_end: () => o.on_end?.(tracker.get_value(), this),
    });
  }
  get value(): number {
    return this.tracker.get_value();
  }
  /** Move the marker from code. */
  set_value(v: number): void {
    this.tracker.set_value(v);
    this.sync();
    this.ui.notify();
  }
  /** Show or hide the value label (e.g. reveal after an estimate). */
  show_value(on: boolean): void {
    this.showing = on;
    this.sync();
    this.ui.player.refresh();
  }
  /** Place pin and label at the tracker's value (runs as an updater). */
  sync(): void {
    const v = this.tracker.get_value();
    const at = this.line.n2p(v);
    const u = this.line.get_unit_vector();
    const n: Point3D = [-u[1], u[0], 0]; // "above" the line
    const s = this.o.size ?? 0.24;
    const gap = 0.06;
    // pin: tip on the line, pointing at it
    const h = s * 1.15;
    const tip: Point3D = [at[0] + n[0] * gap, at[1] + n[1] * gap, 0];
    const base = [tip[0] + n[0] * h, tip[1] + n[1] * h];
    this.pin.set_points_as_corners([
      [base[0] - u[0] * (s / 2), base[1] - u[1] * (s / 2), 0],
      [base[0] + u[0] * (s / 2), base[1] + u[1] * (s / 2), 0],
      tip,
      [base[0] - u[0] * (s / 2), base[1] - u[1] * (s / 2), 0],
    ]);
    const r = this.readout as any;
    if (r) {
      if (this.showing) {
        r.set_value(v);
        r.set_opacity(1);
        const off = h + gap + 0.12 + r.height / 2;
        r.move_to([at[0] + n[0] * off, at[1] + n[1] * off, 0]);
      } else r.set_opacity(0);
    }
  }
}
