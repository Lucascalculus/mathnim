// manim/animation/indication.py
import { config } from '../_config';
import { DEFAULT_STROKE_WIDTH, RIGHT, SMALL_BUFF, TAU, UP } from '../constants';
import { Circle, Dot } from '../mobject/geometry/arc';
import { Line } from '../mobject/geometry/line';
import { Rectangle } from '../mobject/geometry/polygram';
import { SurroundingRectangle } from '../mobject/geometry/shape_matchers';
import { Mobject } from '../mobject/mobject';
import { VGroup, type VMobject } from '../mobject/types/vectorized_mobject';
import { interpolate, inverse_interpolate } from '../utils/bezier';
import { GREY, PURE_YELLOW } from '../utils/color/manim_colors';
import type { ParsableManimColor } from '../utils/color/core';
import { pyargs, type Kwargs } from '../utils/pyargs';
import { register } from '../utils/registry';
import { smooth, there_and_back, wiggle, type RateFunction } from '../utils/rate_functions';
import { normalize } from '../utils/space_ops';
import { add, mul, to3, type Point3D, type Point3DLike } from '../utils/vector';
import { Animation, type SceneLike } from './animation';
import { AnimationGroup, Succession } from './composition';
import { Create, ShowPartial, Uncreate } from './creation';
import { FadeIn, FadeOut } from './fading';
import { Homotopy } from './movement';
import { Transform } from './transform';
import { UpdateFromFunc } from './updaters/update';

/** numpy.arange(start, stop, step) (length ceil((stop - start) / step)). */
function arange(start: number, stop: number, step: number): number[] {
  const n = Math.max(0, Math.ceil((stop - start) / step));
  return Array.from({ length: n }, (_, i) => start + i * step);
}
/** numpy.linspace(start, stop, num). */
function linspace(start: number, stop: number, num: number): number[] {
  const step = num > 1 ? (stop - start) / (num - 1) : 0;
  const out = Array.from({ length: num }, (_, i) => start + i * step);
  if (num > 1) out[num - 1] = stop;
  return out;
}

/** Shrinks a spotlight onto a point or mobject. */
export class FocusOn extends Transform {
  declare focus_point: Point3DLike | Mobject;
  declare color: ParsableManimColor;
  declare opacity: number;
  constructor(...args: unknown[]) {
    const o = pyargs(args, ['focus_point', 'opacity', 'color', 'run_time'], { opacity: 0.2, color: GREY, run_time: 2 });
    const { focus_point, opacity, color, run_time, ...kw } = o;
    const starting_dot = new Dot({ radius: config.frame_x_radius + config.frame_y_radius, stroke_width: 0, fill_color: color, fill_opacity: 0 });
    super(starting_dot, { ...kw, run_time, remover: true });
    this.focus_point = focus_point;
    this.color = color;
    this.opacity = opacity;
  }
  override create_target(): Dot {
    const little_dot = new Dot({ radius: 0 });
    little_dot.set_fill(this.color, { opacity: this.opacity });
    little_dot.add_updater((d: Mobject) => d.move_to(this.focus_point));
    return little_dot;
  }
}

/** Briefly scales a mobject up and recolours it (there and back). */
export class Indicate extends Transform {
  declare color: ParsableManimColor | null;
  declare scale_factor: number;
  constructor(...args: unknown[]) {
    const o = pyargs(args, ['mobject', 'scale_factor', 'color', 'rate_func'], { scale_factor: 1.2, color: PURE_YELLOW, rate_func: there_and_back });
    const { mobject, scale_factor, color, ...kw } = o;
    super(mobject, kw);
    this.color = color;
    this.scale_factor = scale_factor;
  }
  override create_target(): Mobject {
    const target = this.mobject.copy();
    target.scale(this.scale_factor);
    target.set_color(this.color);
    return target;
  }
}

/** Lines flashing outwards from a point. */
export class Flash extends AnimationGroup {
  declare point: Point3D;
  declare color: ParsableManimColor;
  declare line_length: number;
  declare num_lines: number;
  declare flash_radius: number;
  declare line_stroke_width: number;
  declare time_width: number;
  declare animation_config: Kwargs;
  declare lines: VGroup;
  constructor(...args: unknown[]) {
    const o = pyargs(args, ['point', 'line_length', 'num_lines', 'flash_radius', 'line_stroke_width', 'color', 'time_width', 'run_time'], {
      line_length: 0.2, num_lines: 12, flash_radius: 0.1, line_stroke_width: 3, color: PURE_YELLOW, time_width: 1, run_time: 1.0,
    });
    const { point, line_length, num_lines, flash_radius, line_stroke_width, color, time_width, run_time, ...animation_config } = o;
    // web: attributes are gathered first (JS cannot touch `this` before super)
    const self: any = {
      point: point instanceof Mobject ? point.get_center() : to3(point),
      color, line_length, num_lines, flash_radius, line_stroke_width, run_time, time_width, animation_config,
    };
    self.lines = Flash.prototype.create_lines.call(self);
    const animations = Flash.prototype.create_line_anims.call(self);
    super(...animations, { group: self.lines });
    const { run_time: _rt, ...attrs } = self;
    Object.assign(this, attrs);
  }
  create_lines(): VGroup {
    const lines = new VGroup();
    for (const angle of arange(0, TAU, TAU / this.num_lines)) {
      const line = new Line(this.point, add(this.point, mul(this.line_length, RIGHT)));
      line.shift(mul(this.flash_radius, RIGHT));
      line.rotate(angle, { about_point: this.point });
      lines.add(line);
    }
    lines.set_color(this.color);
    lines.set_stroke({ width: this.line_stroke_width });
    return lines;
  }
  create_line_anims(): ShowPassingFlash[] {
    return [...this.lines].map((line: VMobject) => new ShowPassingFlash(line, { time_width: this.time_width, run_time: this.run_time, ...this.animation_config }));
  }
}

/** Shows only a sliver of a VMobject that travels along it. */
export class ShowPassingFlash extends ShowPartial {
  declare time_width: number;
  constructor(mobject: Mobject, ...rest: unknown[]) {
    const o = pyargs(rest, ['time_width'], { time_width: 0.1 });
    const { time_width, ...kw } = o;
    super(mobject, { ...kw, remover: true, introducer: true });
    this.time_width = time_width;
  }
  override _get_bounds(alpha: number): [number, number] {
    const tw = this.time_width;
    let upper = interpolate(0, 1 + tw, alpha);
    let lower = upper - tw;
    upper = Math.min(upper, 1);
    lower = Math.max(lower, 0);
    return [lower, upper];
  }
  override clean_up_from_scene(scene: SceneLike): void {
    super.clean_up_from_scene(scene);
    for (const [submob, start] of this.get_all_families_zipped()) (submob as VMobject).pointwise_become_partial(start as VMobject, 0, 1);
  }
}

/** Several ShowPassingFlash of decreasing width, giving a tapered flash. */
export class ShowPassingFlashWithThinningStrokeWidth extends AnimationGroup {
  declare n_segments: number;
  declare time_width: number;
  constructor(vmobject: VMobject, ...rest: unknown[]) {
    const o = pyargs(rest, ['n_segments', 'time_width', 'remover'], { n_segments: 10, time_width: 0.1, remover: true });
    const { n_segments, time_width, remover: _remover, ...kw } = o;
    const max_stroke_width = vmobject.get_stroke_width();
    const widths = linspace(0, max_stroke_width, n_segments);
    const times = linspace(time_width, 0, n_segments);
    // web: like manim, `remover` is overwritten by Animation.__init__ (so the group itself is not a remover)
    super(...widths.map((w, i) => new ShowPassingFlash(vmobject.copy().set_stroke({ width: w }), { ...kw, time_width: times[i] })));
    this.n_segments = n_segments;
    this.time_width = time_width;
  }
}

/** Sends a wave through a mobject, displacing it in `direction`. */
export class ApplyWave extends Homotopy {
  constructor(mobject: Mobject, ...rest: unknown[]) {
    const o = pyargs(rest, ['direction', 'amplitude', 'wave_func', 'time_width', 'ripples', 'run_time'], {
      direction: UP, amplitude: 0.2, wave_func: smooth, time_width: 1, ripples: 1, run_time: 2,
    });
    const { direction, amplitude, wave_func, time_width, ripples, run_time, ...kw } = o;
    const x_min = mobject.get_left()[0];
    const x_max = mobject.get_right()[0];
    const vect = mul(amplitude, normalize(to3(direction)));
    const wf = wave_func as RateFunction;
    const wave = (t: number): number => {
      t = 1 - t;
      if (t >= 1 || t <= 0) return 0;
      const phases = ripples * 2;
      let phase = Math.trunc(t * phases);
      if (phase === 0) return wf(t * phases);
      if (phase === phases - 1) {
        t -= phase / phases;
        return (1 - wf(t * phases)) * (2 * (ripples % 2) - 1);
      }
      phase = Math.trunc((phase - 1) / 2);
      t -= (2 * phase + 1) / phases;
      return (1 - 2 * wf(t * ripples)) * (1 - 2 * (phase % 2));
    };
    const homotopy = (x: number, y: number, z: number, t: number): Point3D => {
      const upper = interpolate(0, 1 + time_width, t);
      const lower = upper - time_width;
      const relative_x = inverse_interpolate(x_min, x_max, x);
      const wave_phase = inverse_interpolate(lower, upper, relative_x);
      const w = wave(wave_phase);
      return [x + w * vect[0], y + w * vect[1], z + w * vect[2]];
    };
    super(homotopy, mobject, { ...kw, run_time });
  }
}

/** Wiggles a mobject (small scale + rotation oscillations). */
export class Wiggle extends Animation {
  declare scale_value: number;
  declare rotation_angle: number;
  declare n_wiggles: number;
  declare scale_about_point: Point3D | null;
  declare rotate_about_point: Point3D | null;
  constructor(mobject: Mobject, ...rest: unknown[]) {
    const o = pyargs(rest, ['scale_value', 'rotation_angle', 'n_wiggles', 'scale_about_point', 'rotate_about_point', 'run_time'], {
      scale_value: 1.1, rotation_angle: 0.01 * TAU, n_wiggles: 6, scale_about_point: null, rotate_about_point: null, run_time: 2,
    });
    const { scale_value, rotation_angle, n_wiggles, scale_about_point, rotate_about_point, ...kw } = o;
    super(mobject, kw);
    this.scale_value = scale_value;
    this.rotation_angle = rotation_angle;
    this.n_wiggles = n_wiggles;
    this.scale_about_point = scale_about_point != null ? to3(scale_about_point) : null;
    this.rotate_about_point = rotate_about_point != null ? to3(rotate_about_point) : null;
  }
  get_scale_about_point(): Point3D {
    return this.scale_about_point ?? this.mobject.get_center();
  }
  get_rotate_about_point(): Point3D {
    return this.rotate_about_point ?? this.mobject.get_center();
  }
  override interpolate_submobject(submobject: Mobject, starting_submobject: Mobject, alpha: number): void {
    submobject.points = starting_submobject.points.slice();
    submobject.scale(interpolate(1, this.scale_value, there_and_back(alpha)), { about_point: this.get_scale_about_point() });
    submobject.rotate(wiggle(alpha, this.n_wiggles) * this.rotation_angle, { about_point: this.get_rotate_about_point() });
  }
}

/** Draws a temporary line (rectangle or circle) around a mobject. */
export class Circumscribe extends Succession {
  constructor(mobject: Mobject, ...rest: unknown[]) {
    const o = pyargs(rest, ['shape', 'fade_in', 'fade_out', 'time_width', 'buff', 'color', 'run_time', 'stroke_width'], {
      shape: Rectangle, fade_in: false, fade_out: false, time_width: 0.3, buff: SMALL_BUFF, color: PURE_YELLOW, run_time: 1, stroke_width: DEFAULT_STROKE_WIDTH,
    });
    const { shape, fade_in, fade_out, time_width, buff, color, run_time, stroke_width, ...kw } = o;
    let frame: VMobject;
    // web: compare prototypes so both the callable wrapper and the raw class match
    if (shape?.prototype === Rectangle.prototype) frame = new SurroundingRectangle(mobject, { color, buff, stroke_width });
    else if (shape?.prototype === Circle.prototype) {
      frame = new Circle({ color, stroke_width }).surround(mobject, { buffer_factor: 1 });
      const radius = frame.width / 2;
      frame.scale((radius + buff) / radius);
    } else throw new Error('shape should be either Rectangle or Circle.');
    if (fade_in && fade_out) super(new FadeIn(frame, { run_time: run_time / 2 }), new FadeOut(frame, { run_time: run_time / 2 }), kw);
    else if (fade_in) {
      frame.reverse_direction();
      super(new FadeIn(frame, { run_time: run_time / 2 }), new Uncreate(frame, { run_time: run_time / 2 }), kw);
    } else if (fade_out) super(new Create(frame, { run_time: run_time / 2 }), new FadeOut(frame, { run_time: run_time / 2 }), kw);
    else super(new ShowPassingFlash(frame, time_width, { run_time }), kw);
  }
}

/** Blinks a mobject by switching its opacity on and off. */
export class Blink extends Succession {
  constructor(mobject: Mobject, ...rest: unknown[]) {
    const o = pyargs(rest, ['time_on', 'time_off', 'blinks', 'hide_at_end'], { time_on: 0.5, time_off: 0.5, blinks: 1, hide_at_end: false });
    const { time_on, time_off, blinks, hide_at_end, ...kw } = o;
    const on = new UpdateFromFunc(mobject, (mob: any) => mob.set_opacity(1.0), { run_time: time_on });
    const off = new UpdateFromFunc(mobject, (mob: any) => mob.set_opacity(0.0), { run_time: time_off });
    // like manim, `[on, off] * blinks` repeats the same animation objects
    const animations: Animation[] = [];
    for (let i = 0; i < blinks; i++) animations.push(on, off);
    if (!hide_at_end) animations.push(new UpdateFromFunc(mobject, (mob: any) => mob.set_opacity(1.0), { run_time: time_on }));
    super(...animations, kw);
  }
}

register({ ShowPassingFlash });
