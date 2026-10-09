// On-canvas controls drawn as mobjects, so they share the scene's style and
// appear in exported video (web extension).
import { LEFT, RIGHT } from '../constants';
import { Dot } from '../mobject/geometry/arc';
import { Line } from '../mobject/geometry/line';
import { VGroup } from '../mobject/types/vectorized_mobject';
import type { ValueTracker } from '../mobject/value_tracker';
import { ManimColor, type ParsableManimColor } from '../utils/color/core';
import { pyargs } from '../utils/pyargs';
import { registry } from '../utils/registry';
import { add, mul, type Point3D, type Point3DLike } from '../utils/vector';
import { constrain, type DragHandle, type Interaction } from './interact';

/**
 * A horizontal slider bound to a ValueTracker.
 *
 *   const s = Slider(k, { x_range: [0, 5], label: 'k' }).to_corner(DL);
 *   scene.add(s);
 *   s.attach(ui);                      // make it draggable (Interaction)
 */
export class Slider extends VGroup {
  declare tracker: ValueTracker;
  declare x_range: [number, number];
  declare length_: number;
  declare track: Line;
  declare fill: Line;
  declare knob: Dot;
  declare readout: any;
  declare caption: any;
  constructor(...args: unknown[]) {
    const o = pyargs(args, ['tracker'], {
      x_range: [0, 1], length: 3, color: '#FFFFFF', track_color: '#555555', knob_radius: 0.11, stroke_width: 5,
      label: null, decimals: 2, font_size: 28, show_value: true,
    });
    super();
    this.tracker = o.tracker;
    this.x_range = o.x_range;
    this.length_ = o.length;
    const color = ManimColor.parse(o.color as ParsableManimColor);
    this.track = new Line(LEFT.map((x) => (x * o.length) / 2) as Point3D, RIGHT.map((x) => (x * o.length) / 2) as Point3D, { color: o.track_color, stroke_width: o.stroke_width });
    this.fill = new Line(this.track.get_start(), this.track.get_start(), { color, stroke_width: o.stroke_width });
    this.knob = new Dot(this.track.get_start(), { radius: o.knob_radius, color, stroke_width: 0 });
    this.add(this.track, this.fill, this.knob);
    if (o.label && registry.MathTex) {
      this.caption = new registry.MathTex(o.label, { font_size: o.font_size, color });
      this.caption.next_to(this.track, LEFT, { buff: 0.55 });
      this.add(this.caption);
    }
    if (o.show_value && registry.DecimalNumber) {
      this.readout = new registry.DecimalNumber(this.tracker.get_value(), { num_decimal_places: o.decimals, font_size: o.font_size, color });
      this.readout.next_to(this.track, RIGHT, { buff: 0.55 });
      this.add(this.readout);
    }
    this.add_updater(() => this.sync());
    this.sync();
  }
  /** Scene point of value v. */
  point_of(v: number): Point3D {
    const [a, b] = this.x_range;
    const t = Math.min(1, Math.max(0, (v - a) / (b - a)));
    const s = this.track.get_start(), e = this.track.get_end();
    return add(s, mul(t, [e[0] - s[0], e[1] - s[1], e[2] - s[2]]));
  }
  value_of(p: Point3DLike): number {
    const s = this.track.get_start(), e = this.track.get_end();
    const d = [e[0] - s[0], e[1] - s[1]];
    const t = ((p[0] - s[0]) * d[0] + (p[1] - s[1]) * d[1]) / (d[0] ** 2 + d[1] ** 2);
    return this.x_range[0] + Math.min(1, Math.max(0, t)) * (this.x_range[1] - this.x_range[0]);
  }
  sync(): this {
    const p = this.point_of(this.tracker.get_value());
    this.knob.move_to(p);
    const s = this.track.get_start();
    if (Math.hypot(p[0] - s[0], p[1] - s[1]) > 1e-6) this.fill.put_start_and_end_on(s, p);
    else this.fill.set_points_as_corners([s, s]);
    if (this.readout) {
      this.readout.set_value(this.tracker.get_value());
      this.readout.next_to(this.track, RIGHT, { buff: 0.55 });
    }
    return this;
  }
  /** Register the knob with an Interaction; returns the handle. */
  attach(ui: Interaction, o: { step?: number; label?: string; snap?: number } = {}): DragHandle {
    return ui.add_handle({
      mobject: this.knob,
      get: () => this.knob.get_center(),
      set: (p) => {
        let v = this.value_of(p);
        if (o.snap) v = Math.round(v / o.snap) * o.snap;
        this.tracker.set_value(v);
      },
      constraint: constrain.on_segment(this.track.get_start(), this.track.get_end()),
      step: o.step ?? (this.x_range[1] - this.x_range[0]) / 50,
      tracker: this.tracker,
      from_value: (v) => this.point_of(v),
      to_value: (p) => this.value_of(p),
      label: o.label ?? 'slider',
      radius: 0.3,
    });
  }
}

