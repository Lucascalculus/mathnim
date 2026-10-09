// manim/mobject/vector_field.py
import { config } from '../_config';
import { AnimationGroup, Succession } from '../animation/composition';
import { Create } from '../animation/creation';
import { ShowPassingFlash } from '../animation/indication';
import { UpdateFromAlphaFunc } from '../animation/updaters/update';
import type { Animation } from '../animation/animation';
import { interpolate, inverse_interpolate } from '../utils/bezier';
import { ManimColor, color_to_rgb, rgb_to_color, type FloatRGB, type ParsableManimColor } from '../utils/color/core';
import { BLUE_E, GREEN, RED, YELLOW } from '../utils/color/manim_colors';
import type { PixelArray } from '../utils/images';
import { default_rng } from '../utils/pcg64';
import { pyargs, type Kwargs } from '../utils/pyargs';
import { ease_out_sine, linear, sigmoid, type RateFunction } from '../utils/rate_functions';
import { norm, to3, type Point3D, type Point3DLike } from '../utils/vector';
import { Vector } from './geometry/line';
import type { Mobject } from './mobject';
import { VGroup, VMobject } from './types/vectorized_mobject';

export const DEFAULT_SCALAR_FIELD_COLORS: ParsableManimColor[] = [BLUE_E, GREEN, YELLOW, RED];

type VectorFunc = (p: Point3D) => unknown;

/** numpy.arange(start, stop, step). */
function arange(start: number, stop: number, step: number): number[] {
  const n = Math.max(0, Math.ceil((stop - start) / step));
  return Array.from({ length: n }, (_, i) => start + i * step);
}
/** numpy.linspace(start, stop, num). */
function linspace(start: number, stop: number, num: number): number[] {
  const step = num > 1 ? (stop - start) / (num - 1) : 0;
  const out = Array.from({ length: num }, (_, i) => i * step + start);
  if (num > 1) out[num - 1] = stop;
  return out;
}
/** The function's value as a 3D vector (it may return any array-like). */
const vec3 = (v: unknown): Point3D => (typeof v === 'number' ? [v, v, v] : to3(Array.from(v as ArrayLike<number>)));
const pymod1 = (x: number): number => ((x % 1) + 1) % 1;

/** Normalise [start, end(, step)] ranges exactly like manim's ArrowVectorField / StreamLines. */
function field_ranges(x_range: number[] | null | undefined, y_range: number[] | null | undefined, z_range: number[] | null | undefined, three_dimensions: boolean): [number[], number[], number[]] {
  const xr = x_range && x_range.length ? [...x_range] : [Math.floor(-config.frame_width / 2), Math.ceil(config.frame_width / 2)];
  const yr = y_range && y_range.length ? [...y_range] : [Math.floor(-config.frame_height / 2), Math.ceil(config.frame_height / 2)];
  const ranges = [xr, yr];
  if (three_dimensions || (z_range && z_range.length)) ranges.push(z_range && z_range.length ? [...z_range] : [...yr]);
  else ranges.push([0, 0]);
  for (const r of ranges) {
    if (r.length === 2) r.push(0.5);
    r[1] += r[2];
  }
  return ranges as [number[], number[], number[]];
}

/** A vector field: `func` maps a point to a vector; subclasses visualise it. */
export class VectorField extends VGroup {
  declare func: VectorFunc;
  declare single_color: boolean;
  declare color_scheme: (v: Point3D) => number;
  declare rgbs: FloatRGB[];
  declare pos_to_rgb: (p: Point3D) => FloatRGB;
  declare pos_to_color: (p: Point3D) => ManimColor;
  declare submob_movement_updater: ((mob: any, dt: number) => unknown) | null;

  constructor(...args: unknown[]) {
    const o = pyargs(args, ['func', 'color', 'color_scheme', 'min_color_scheme_value', 'max_color_scheme_value', 'colors'], {
      color: null, color_scheme: null, min_color_scheme_value: 0, max_color_scheme_value: 2, colors: DEFAULT_SCALAR_FIELD_COLORS,
    });
    const { func, color, color_scheme, min_color_scheme_value, max_color_scheme_value, colors, ...kwargs } = o;
    super(kwargs);
    this.func = func;
    if (color === null || color === undefined) {
      this.single_color = false;
      this.color_scheme = color_scheme ?? ((v: Point3D) => norm(v));
      this.rgbs = (colors as ParsableManimColor[]).map((c) => color_to_rgb(c));
      this.pos_to_rgb = (pos: Point3D): FloatRGB => {
        const v = vec3(this.func(pos));
        const color_value = Math.min(Math.max(this.color_scheme(v), min_color_scheme_value), max_color_scheme_value);
        let alpha = inverse_interpolate(min_color_scheme_value, max_color_scheme_value, color_value);
        alpha *= this.rgbs.length - 1;
        const c1 = this.rgbs[Math.trunc(alpha)];
        const c2 = this.rgbs[Math.min(Math.trunc(alpha + 1), this.rgbs.length - 1)];
        alpha = pymod1(alpha);
        return [0, 1, 2].map((k) => interpolate(c1[k], c2[k], alpha)) as FloatRGB;
      };
      this.pos_to_color = (pos: Point3D) => rgb_to_color(this.pos_to_rgb(pos));
    } else {
      this.single_color = true;
      this.color = ManimColor.parse(color);
    }
    this.submob_movement_updater = null;
  }
  /** `p -> func(p - shift_vector)` */
  static shift_func(func: VectorFunc, shift_vector: Point3DLike): VectorFunc {
    const s = to3(shift_vector);
    return (p) => func([p[0] - s[0], p[1] - s[1], p[2] - s[2]]);
  }
  /** `p -> func(p * scalar)` */
  static scale_func(func: VectorFunc, scalar: number): VectorFunc {
    return (p) => func([p[0] * scalar, p[1] * scalar, p[2] * scalar]);
  }
  fit_to_coordinate_system(coordinate_system: any): this {
    this.apply_function((pos: Point3D) => coordinate_system.coords_to_point(...pos));
    return this;
  }
  /** Move `mob` along the field for `dt` (Runge-Kutta 4, `substeps` steps). */
  nudge(mob: Mobject, dt = 1, substeps = 1, pointwise = false): this {
    const runge_kutta = (p: Point3D, step_size: number): Point3D => {
      const f = (q: Point3D) => vec3(this.func(q));
      const k_1 = f(p);
      const k_2 = f([0, 1, 2].map((i) => p[i] + step_size * (k_1[i] * 0.5)) as Point3D);
      const k_3 = f([0, 1, 2].map((i) => p[i] + step_size * (k_2[i] * 0.5)) as Point3D);
      const k_4 = f([0, 1, 2].map((i) => p[i] + step_size * k_3[i]) as Point3D);
      return [0, 1, 2].map((i) => (step_size / 6.0) * (k_1[i] + 2.0 * k_2[i] + 2.0 * k_3[i] + k_4[i])) as Point3D;
    };
    const step_size = dt / substeps;
    for (let s = 0; s < substeps; s++) {
      if (pointwise) {
        mob.apply_function((p: Point3D) => {
          const d = runge_kutta(p, step_size);
          return [p[0] + d[0], p[1] + d[1], p[2] + d[2]];
        });
      } else mob.shift(runge_kutta(mob.get_center(), step_size));
    }
    return this;
  }
  nudge_submobjects(dt = 1, substeps = 1, pointwise = false): this {
    for (const mob of this.submobjects) this.nudge(mob, dt, substeps, pointwise);
    return this;
  }
  /** An updater moving a mobject along the field. */
  get_nudge_updater(speed = 1, pointwise = false): (mob: Mobject, dt: number) => this {
    return (mob: Mobject, dt: number) => this.nudge(mob, dt * speed, 1, pointwise);
  }
  start_submobject_movement(speed = 1, pointwise = false): this {
    this.stop_submobject_movement();
    this.submob_movement_updater = (mob: VectorField, dt: number) => mob.nudge_submobjects(dt * speed, 1, pointwise);
    this.add_updater(this.submob_movement_updater);
    return this;
  }
  stop_submobject_movement(): this {
    if (this.submob_movement_updater) this.remove_updater(this.submob_movement_updater);
    this.submob_movement_updater = null;
    return this;
  }
  /** The field's colouring over the frame, as an RGBA pixel array (manim returns a PIL image). */
  get_colored_background_image(sampling_rate = 5): PixelArray {
    if (this.single_color) throw new Error('There is no point in generating an image if the vector field uses a single color.');
    const ph = Math.trunc(config.pixel_height / sampling_rate);
    const pw = Math.trunc(config.pixel_width / sampling_rate);
    const fw = config.frame_width, fh = config.frame_height;
    const xs = linspace(-fw / 2, fw / 2, pw), ys = linspace(fh / 2, -fh / 2, ph);
    const data = new Uint8ClampedArray(4 * pw * ph);
    for (let r = 0; r < ph; r++) {
      for (let c = 0; c < pw; c++) {
        const rgb = this.pos_to_rgb([xs[c], ys[r], 0]);
        const o = 4 * (r * pw + c);
        for (let k = 0; k < 3; k++) data[o + k] = Math.trunc(rgb[k] * 255);
        data[o + 3] = 255;
      }
    }
    return { width: pw, height: ph, data };
  }
  /** values -> RGBA rows, interpolating `colors` between start and end. */
  get_vectorized_rgba_gradient_function(start: number, end: number, colors: ParsableManimColor[]): (values: number[], opacity?: number) => number[][] {
    const rgbs = colors.map((c) => color_to_rgb(c));
    return (values: number[], opacity = 1.0) =>
      values.map((v) => {
        const a = Math.min(Math.max(inverse_interpolate(start, end, v), 0), 1);
        const scaled = a * (rgbs.length - 1);
        const i = Math.trunc(scaled);
        const j = Math.min(Math.max(i + 1, 0), rgbs.length - 1);
        const t = pymod1(scaled);
        return [...[0, 1, 2].map((k) => interpolate(rgbs[i][k], rgbs[j][k], t)), opacity];
      });
  }
}

/** A grid of arrows showing a vector field. */
export class ArrowVectorField extends VectorField {
  declare x_range: number[];
  declare y_range: number[];
  declare z_range: number[];
  declare ranges: number[][];
  declare length_func: (n: number) => number;
  declare opacity: number;
  declare vector_config: Kwargs;

  constructor(...args: unknown[]) {
    const o = pyargs(args, ['func', 'color', 'color_scheme', 'min_color_scheme_value', 'max_color_scheme_value', 'colors', 'x_range', 'y_range', 'z_range', 'three_dimensions', 'length_func', 'opacity', 'vector_config'], {
      color: null, color_scheme: null, min_color_scheme_value: 0, max_color_scheme_value: 2, colors: DEFAULT_SCALAR_FIELD_COLORS,
      x_range: null, y_range: null, z_range: null, three_dimensions: false, length_func: (n: number) => 0.45 * sigmoid(n), opacity: 1.0, vector_config: null,
    });
    const { x_range, y_range, z_range, three_dimensions, length_func, opacity, vector_config, ...kw } = o;
    const [xr, yr, zr] = field_ranges(x_range, y_range, z_range, three_dimensions);
    super(kw);
    this.x_range = xr;
    this.y_range = yr;
    this.z_range = zr;
    this.ranges = [xr, yr, zr];
    this.length_func = length_func;
    this.opacity = opacity;
    this.vector_config = vector_config ?? {};
    const vectors: VMobject[] = [];
    for (const x of arange(xr[0], xr[1], xr[2])) for (const y of arange(yr[0], yr[1], yr[2])) for (const z of arange(zr[0], zr[1], zr[2])) vectors.push(this.get_vector([x, y, z]));
    this.add(...vectors);
    this.set_opacity(this.opacity);
  }
  /** The arrow for the field at `point`. */
  get_vector(point: Point3DLike): Vector {
    const p = to3(point);
    let output = vec3(this.func(p));
    const n = norm(output);
    if (n !== 0) {
      const f = this.length_func(n) / n;
      output = [output[0] * f, output[1] * f, output[2] * f];
    }
    const vect = new Vector(output, this.vector_config);
    vect.shift(p);
    if (this.single_color) vect.set_color(this.color);
    else vect.set_color(this.pos_to_color(p));
    return vect;
  }
}

/** Stream lines of a vector field (optionally animated as a continuous flow). */
export class StreamLines extends VectorField {
  declare x_range: number[];
  declare y_range: number[];
  declare z_range: number[];
  declare ranges: number[][];
  declare noise_factor: number;
  declare n_repeats: number;
  declare virtual_time: number;
  declare max_anchors_per_line: number;
  declare padding: number;
  declare stroke_width: number;
  declare background_img: PixelArray;
  declare values_to_rgbas: (values: number[], opacity?: number) => number[][];
  declare stream_lines: VMobject[];
  declare flow_animation: ((mob: any, dt: number) => void) | null;
  declare flow_speed: number;
  declare time_width: number;

  constructor(...args: unknown[]) {
    const o = pyargs(args, [
      'func', 'color', 'color_scheme', 'min_color_scheme_value', 'max_color_scheme_value', 'colors', 'x_range', 'y_range', 'z_range', 'three_dimensions',
      'noise_factor', 'n_repeats', 'dt', 'virtual_time', 'max_anchors_per_line', 'padding', 'stroke_width', 'opacity',
    ], {
      color: null, color_scheme: null, min_color_scheme_value: 0, max_color_scheme_value: 2, colors: DEFAULT_SCALAR_FIELD_COLORS,
      x_range: null, y_range: null, z_range: null, three_dimensions: false, noise_factor: null, n_repeats: 1, dt: 0.05, virtual_time: 3,
      max_anchors_per_line: 100, padding: 3, stroke_width: 1, opacity: 1,
    });
    const { x_range, y_range, z_range, three_dimensions, noise_factor, n_repeats, dt, virtual_time, max_anchors_per_line, padding, stroke_width, opacity, ...kw } = o;
    const [xr, yr, zr] = field_ranges(x_range, y_range, z_range, three_dimensions);
    super(kw);
    this.x_range = xr;
    this.y_range = yr;
    this.z_range = zr;
    this.ranges = [xr, yr, zr];
    this.noise_factor = noise_factor ?? yr[2] / 2;
    this.n_repeats = n_repeats;
    this.virtual_time = virtual_time;
    this.max_anchors_per_line = max_anchors_per_line;
    this.padding = padding;
    this.stroke_width = stroke_width;
    const half_noise = this.noise_factor / 2;
    // web: numpy's default_rng(0) (PCG64) is reproduced, so start points match manim
    const rng = default_rng(0);
    const start_points: Point3D[] = [];
    for (let n = 0; n < this.n_repeats; n++) {
      for (const x of arange(xr[0], xr[1], xr[2])) for (const y of arange(yr[0], yr[1], yr[2])) for (const z of arange(zr[0], zr[1], zr[2])) {
        const r = rng.random(3) as number[];
        start_points.push([x - half_noise + this.noise_factor * r[0], y - half_noise + this.noise_factor * r[1], z - half_noise + this.noise_factor * r[2]]);
      }
    }
    const outside_box = (p: Point3D) =>
      p[0] < xr[0] - this.padding || p[0] > xr[1] + this.padding - xr[2] || p[1] < yr[0] - this.padding || p[1] > yr[1] + this.padding - yr[2] ||
      p[2] < zr[0] - this.padding || p[2] > zr[1] + this.padding - zr[2];
    const max_steps = Math.ceil(virtual_time / dt) + 1;
    const plain_z = zr[0] === 0 && zr[1] === 0.5 && zr[2] === 0.5;
    if (!this.single_color) this.background_img = this.get_colored_background_image();
    for (const point of start_points) {
      const points: Point3D[] = [point];
      for (let s = 0; s < max_steps; s++) {
        const last = points[points.length - 1];
        const v = vec3(this.func(last));
        const new_point: Point3D = [last[0] + dt * v[0], last[1] + dt * v[1], last[2] + dt * v[2]];
        if (outside_box(new_point)) break;
        points.push(new_point);
      }
      const line = new VMobject();
      (line as any).duration = max_steps * dt;
      const step = Math.max(1, Math.trunc(points.length / this.max_anchors_per_line));
      line.set_points_smoothly(points.filter((_, i) => i % step === 0));
      if (this.single_color) line.set_stroke({ color: this.color, width: this.stroke_width, opacity });
      else {
        if (!plain_z) line.set_stroke(line.get_anchors().map((p) => this.pos_to_color(p)));
        else line.color_using_background_image(this.background_img);
        line.set_stroke({ width: this.stroke_width, opacity });
      }
      this.add(line);
    }
    this.stream_lines = [...this.submobjects];
    this.flow_animation = null;
  }
  /** Draw the stream lines (random order, like manim). */
  create(lag_ratio: number | null = null, run_time: number | null = null, kw: Kwargs = {}): AnimationGroup {
    if (run_time === null) run_time = this.virtual_time;
    if (lag_ratio === null) lag_ratio = run_time / 2 / this.submobjects.length;
    const animations: Animation[] = this.stream_lines.map((line) => new Create(line, { run_time, ...kw }));
    shuffle(animations);
    return new AnimationGroup(...animations, { lag_ratio });
  }
  /** Start the continuous flow along the lines (an updater). */
  start_animation(warm_up = true, flow_speed = 1, time_width = 0.3, rate_func: RateFunction = linear, line_animation_class: any = ShowPassingFlash, kw: Kwargs = {}): this {
    for (const line of this.stream_lines as any[]) {
      const run_time = line.duration / flow_speed;
      line.anim = new line_animation_class(line, { run_time, rate_func, time_width, ...kw });
      line.anim.begin();
      line.time = Math.random() * this.virtual_time;
      if (warm_up) line.time *= -1;
      this.add(line.anim.mobject);
    }
    const updater = (mob: any, dt: number) => {
      for (const line of mob.stream_lines) {
        line.time += dt * flow_speed;
        if (line.time >= this.virtual_time) line.time -= this.virtual_time;
        line.anim.interpolate(Math.min(Math.max(line.time / line.anim.run_time, 0), 1));
      }
    };
    this.add_updater(updater);
    this.flow_animation = updater;
    this.flow_speed = flow_speed;
    this.time_width = time_width;
    return this;
  }
  /** Stop the flow, finishing every line's cycle while drawing it back in full. */
  end_animation(): AnimationGroup {
    if (this.flow_animation === null || this.flow_animation === undefined) throw new Error('You have to start the animation before fading it out.');
    const hide_and_wait = (mob: VMobject, alpha?: number) => {
      if (alpha === 0) mob.set_stroke({ opacity: 0 });
      else if (alpha === 1) mob.set_stroke({ opacity: 1 });
    };
    const finish_updater_cycle = (line: any, alpha?: number) => {
      line.time += dt * this.flow_speed;
      line.anim.interpolate(Math.min(line.time / line.anim.run_time, 1));
      if (alpha === 1) {
        this.remove(line.anim.mobject);
        line.anim.finish();
      }
    };
    const max_run_time = this.virtual_time / this.flow_speed;
    const creation_rate_func = ease_out_sine;
    const creation_staring_speed = creation_rate_func(0.001) * 1000;
    const creation_run_time = (max_run_time / (1 + this.time_width)) * creation_staring_speed;
    const dt = 1 / config.frame_rate;
    const animations: Animation[] = [];
    this.remove_updater(this.flow_animation);
    this.flow_animation = null;
    for (const line of this.stream_lines as any[]) {
      const create = new Create(line, { run_time: creation_run_time, rate_func: creation_rate_func });
      if (line.time <= 0) {
        animations.push(new Succession(new UpdateFromAlphaFunc(line, hide_and_wait, { run_time: -line.time / this.flow_speed }), create));
        this.remove(line.anim.mobject);
        line.anim.finish();
      } else {
        const remaining_time = max_run_time - line.time / this.flow_speed;
        animations.push(new Succession(new UpdateFromAlphaFunc(line, finish_updater_cycle, { run_time: remaining_time }), create));
      }
    }
    return new AnimationGroup(...animations);
  }
}

// web: manim shuffles with Python's (unseeded) `random`; Math.random here
function shuffle<T>(x: T[]): void {
  for (let i = x.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [x[i], x[j]] = [x[j], x[i]];
  }
}
