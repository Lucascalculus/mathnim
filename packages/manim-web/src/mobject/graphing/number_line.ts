// manim/mobject/graphing/number_line.py
import { config } from '../../_config';
import { DEFAULT_ARROW_TIP_LENGTH, DOWN, LEFT, MED_SMALL_BUFF, OUT, RIGHT, UP } from '../../constants';
import { merge_dicts_recursively } from '../../utils/config_ops';
import { isKwargs, pyargs, type Kwargs } from '../../utils/pyargs';
import { register, registry } from '../../utils/registry';
import { normalize } from '../../utils/space_ops';
import { dot, interpolate, mul, sub, to3, type Point3D, type Point3DLike } from '../../utils/vector';
import { Line } from '../geometry/line';
import { Mobject } from '../mobject';
import { VGroup, VMobject } from '../types/vectorized_mobject';
import { LinearBase, type _ScaleBase } from './scale';

/** Labels for `add_labels`: a Map, a plain object (numeric keys) or [value, label] pairs. */
export type LabelDict = Map<number, unknown> | Record<string, unknown> | readonly (readonly [number, unknown])[];

const isArrayLike = (v: unknown): v is ArrayLike<any> => Array.isArray(v) || ArrayBuffer.isView(v);

/** numpy.arange with numpy's exact values: start + i * ((start + step) - start). */
export function _np_arange(start: number, stop: number, step: number): number[] {
  const n = Math.max(0, Math.ceil((stop - start) / step));
  if (!(n > 0)) return [];
  const out = [start];
  if (n > 1) {
    const second = start + step;
    const delta = second - start;
    out.push(second);
    for (let i = 2; i < n; i++) out.push(start + i * delta);
  }
  return out;
}

/** Python's round() (half to even) for ndigits = 0. */
export const _py_round = (x: number): number => {
  const r = Math.round(x);
  return Math.abs(x % 1) === 0.5 && r % 2 !== 0 ? r - 1 : r;
};

/** Python repr of a float (`is_float`) or int, e.g. 1 -> '1' / '1.0', 5e-05 -> '5e-05'. */
export function _py_num_str(x: number, is_float = false): string {
  if (!Number.isFinite(x)) return Number.isNaN(x) ? 'nan' : x > 0 ? 'inf' : '-inf';
  if (Number.isInteger(x) && Math.abs(x) < 1e16) return is_float || Object.is(x, -0) ? `${Object.is(x, -0) ? '-0' : x}.0` : String(x);
  const a = Math.abs(x);
  if (a >= 1e-4 && a < 1e16) return String(x);
  const [m, e] = x.toExponential().split('e');
  const ev = Number(e);
  return `${m}e${ev < 0 ? '-' : '+'}${String(Math.abs(ev)).padStart(2, '0')}`;
}

const sameClass = (a: any, b: any): boolean => a != null && b != null && (a === b || (a.prototype !== undefined && a.prototype === b.prototype));

function labelItems(d: LabelDict): [number, unknown][] {
  if (d instanceof Map) return [...d.entries()].map(([k, v]) => [Number(k), v]);
  if (Array.isArray(d)) return d.map(([k, v]) => [Number(k), v]);
  return Object.entries(d).map(([k, v]) => [Number(k), v]);
}

/** A number line with ticks, optional tip and number labels. */
export class NumberLine extends Line {
  declare x_range: number[];
  declare x_min: number;
  declare x_max: number;
  declare x_step: number;
  /** web: manim's `self.length` (the `length` argument); `length` is the container length here. */
  declare _length: number | null;
  declare unit_size: number;
  declare include_ticks: boolean;
  declare tick_size: number;
  declare numbers_with_elongated_ticks: number[];
  declare longer_tick_multiple: number;
  declare exclude_origin_tick: boolean;
  declare rotation: number;
  declare include_tip: boolean;
  declare tip_width: number;
  declare tip_height: number;
  declare font_size: number;
  declare include_numbers: boolean;
  declare label_direction: Point3D;
  declare label_constructor: any;
  declare line_to_number_buff: number;
  declare decimal_number_config: Kwargs;
  declare numbers_to_exclude: number[];
  declare numbers_to_include: number[] | null;
  declare scaling: _ScaleBase;
  declare ticks: VGroup;
  declare numbers: VGroup;
  declare labels: VGroup;

  constructor(...args: unknown[]) {
    const o = pyargs(args, [
      'x_range', 'length', 'unit_size', 'include_ticks', 'tick_size', 'numbers_with_elongated_ticks', 'longer_tick_multiple',
      'exclude_origin_tick', 'rotation', 'stroke_width', 'include_tip', 'tip_width', 'tip_height', 'tip_shape', 'include_numbers',
      'font_size', 'label_direction', 'label_constructor', 'scaling', 'line_to_number_buff', 'decimal_number_config',
      'numbers_to_exclude', 'numbers_to_include',
    ], {
      x_range: null, length: null, unit_size: 1, include_ticks: true, tick_size: 0.1, numbers_with_elongated_ticks: null, longer_tick_multiple: 2,
      exclude_origin_tick: false, rotation: 0, stroke_width: 2.0, include_tip: false, tip_width: DEFAULT_ARROW_TIP_LENGTH,
      tip_height: DEFAULT_ARROW_TIP_LENGTH, tip_shape: null, include_numbers: false, font_size: 36, label_direction: DOWN,
      label_constructor: null, scaling: null, line_to_number_buff: MED_SMALL_BUFF, decimal_number_config: null,
      numbers_to_exclude: null, numbers_to_include: null,
    });
    let { x_range, decimal_number_config } = o;
    const {
      length, unit_size, include_ticks, tick_size, numbers_with_elongated_ticks, longer_tick_multiple, exclude_origin_tick, rotation,
      stroke_width, include_tip, tip_width, tip_height, tip_shape, include_numbers, font_size, label_direction, label_constructor,
      line_to_number_buff, numbers_to_exclude, numbers_to_include, x_range: _x, decimal_number_config: _d, scaling: _s, ...kwargs
    } = o;
    const scaling: _ScaleBase = o.scaling ?? new LinearBase();
    if (x_range == null) x_range = [_py_round(-config.frame_x_radius), _py_round(config.frame_x_radius), 1];
    else if (x_range.length === 2) x_range = [...x_range, 1];
    // web: a Float64Array x_range stands for a numpy float array, whose str(step) always has decimals
    decimal_number_config ??= { num_decimal_places: NumberLine._decimal_places_from_step(x_range[2], x_range instanceof Float64Array) };
    const xr: number[] = Array.from(x_range as ArrayLike<number>, Number);
    super(mul(xr[0], RIGHT), mul(xr[1], RIGHT), { ...kwargs, stroke_width });
    this.x_range = xr;
    [this.x_min, this.x_max, this.x_step] = scaling.function(xr);
    this._length = length;
    this.unit_size = unit_size;
    this.include_ticks = include_ticks;
    this.tick_size = tick_size;
    this.numbers_with_elongated_ticks = numbers_with_elongated_ticks ?? [];
    this.longer_tick_multiple = longer_tick_multiple;
    this.exclude_origin_tick = exclude_origin_tick;
    this.rotation = rotation;
    this.include_tip = include_tip;
    this.tip_width = tip_width;
    this.tip_height = tip_height;
    this.font_size = font_size;
    this.include_numbers = include_numbers;
    this.label_direction = to3(label_direction);
    this.label_constructor = label_constructor ?? registry.MathTex;
    this.line_to_number_buff = line_to_number_buff;
    this.decimal_number_config = decimal_number_config;
    this.numbers_to_exclude = numbers_to_exclude ?? [];
    this.numbers_to_include = numbers_to_include;
    this.scaling = scaling;

    if (length) {
      this.set_length(length);
      this.unit_size = this.get_unit_size();
    } else this.scale(this.unit_size);
    this.center();
    if (this.include_tip) {
      this.add_tip({ tip_length: this.tip_height, tip_width: this.tip_width, tip_shape });
      this.tip!.set_stroke(this.stroke_color, this.stroke_width);
    }
    if (this.include_ticks) this.add_ticks();
    this.rotate(this.rotation);
    if (this.include_numbers || this.numbers_to_include != null) {
      if (this.scaling.custom_labels) {
        const tick_range = this.get_tick_range();
        const custom_labels = this.scaling.get_custom_labels(tick_range, { unit_decimal_places: decimal_number_config.num_decimal_places });
        this.add_labels(tick_range.map((x, i) => [x, custom_labels[i]] as const));
      } else this.add_numbers(this.numbers_to_include, this.numbers_to_exclude, this.font_size);
    }
  }

  rotate_about_zero(angle: number, axis: Point3DLike = OUT, kw: Kwargs = {}): this {
    return this.rotate_about_number(0, angle, axis, kw);
  }
  rotate_about_number(number: number, angle: number, axis: Point3DLike = OUT, kw: Kwargs = {}): this {
    return this.rotate(angle, axis, { ...kw, about_point: this.n2p(number) });
  }
  add_ticks(): this {
    const ticks = new VGroup();
    const elongated_tick_size = this.tick_size * this.longer_tick_multiple;
    const offsets = Array.from(this.numbers_with_elongated_ticks, (x) => x - this.x_min);
    for (const x of this.get_tick_range()) {
      let size = this.tick_size;
      const d = x - this.x_min;
      if (offsets.some((b) => Math.abs(d - b) <= 1e-8 + 1e-5 * Math.abs(b))) size = elongated_tick_size;
      ticks.add(this.get_tick(x, size));
    }
    this.add(ticks);
    this.ticks = ticks;
    return this;
  }
  get_tick(x: number, size: number | null = null): Line {
    if (size == null) size = this.tick_size;
    const result = new Line(mul(size, DOWN), mul(size, UP));
    result.rotate(this.get_angle());
    result.move_to(this.number_to_point(x));
    result.match_style(this);
    return result;
  }
  get_tick_marks(): VGroup {
    return this.ticks;
  }
  get_tick_range(): number[] {
    let [x_min, x_max, x_step] = this.x_range;
    if (!this.include_tip) x_max += 1e-6;
    let tick_range: number[];
    if ((x_min < x_max && x_max < 0) || (x_max > x_min && x_min > 0)) tick_range = _np_arange(x_min, x_max, x_step);
    else {
      let start_point = 0;
      if (this.exclude_origin_tick) start_point += x_step;
      const x_min_segment = _np_arange(start_point, Math.abs(x_min) + 1e-6, x_step).map((x) => x * -1);
      const x_max_segment = _np_arange(start_point, x_max, x_step);
      // np.unique: sorted, duplicates removed (stable sort keeps -0.0 before 0.0, as numpy does here)
      const all = [...x_min_segment, ...x_max_segment].sort((a, b) => a - b);
      tick_range = all.filter((x, i) => i === 0 || x !== all[i - 1]);
    }
    return this.scaling.function(tick_range);
  }
  /** Point for a number (or points for an array of numbers). */
  number_to_point(number: number): Point3D;
  number_to_point(number: ArrayLike<number>): Point3D[];
  number_to_point(number: number | ArrayLike<number>): Point3D | Point3D[] {
    const start = this.get_start(), end = this.get_end();
    const x0 = this.x_range[0], w = this.x_range[1] - this.x_range[0];
    if (typeof number === 'number') return interpolate(start, end, (this.scaling.inverse_function(number) - x0) / w);
    return (this.scaling.inverse_function(Array.from(number)) as number[]).map((n) => interpolate(start, end, (n - x0) / w));
  }
  /** Number for a point (or numbers for an array of points). */
  point_to_number(point: Point3DLike): number;
  point_to_number(point: readonly Point3DLike[]): number[];
  point_to_number(point: any): number | number[] {
    const [start, end] = this.get_start_and_end();
    const v = sub(end, start);
    const unit_vect = normalize(v);
    const denom = dot(v, unit_vect);
    const one = (p: Point3DLike): number => {
      const proportion = dot(sub(p, start), unit_vect) / denom;
      return (1 - proportion) * this.x_min + proportion * this.x_max;
    };
    if (isArrayLike(point[0])) return Array.from(point as ArrayLike<Point3DLike>, one);
    return one(point);
  }
  n2p(number: number): Point3D;
  n2p(number: ArrayLike<number>): Point3D[];
  n2p(number: any): any {
    return this.number_to_point(number);
  }
  p2n(point: Point3DLike): number {
    return this.point_to_number(point);
  }
  get_unit_size(): number {
    return this.get_length() / (this.x_range[1] - this.x_range[0]);
  }
  override get_unit_vector(): Point3D {
    return mul(super.get_unit_vector(), this.unit_size);
  }
  /** A DecimalNumber label for `x`, placed next to its point. */
  get_number_mobject(x: number, ...args: unknown[]): VMobject {
    const o = pyargs(args, ['direction', 'buff', 'font_size', 'label_constructor'], { direction: null, buff: null, font_size: null, label_constructor: null });
    let { direction, buff, font_size, label_constructor } = o;
    const { direction: _d, buff: _b, font_size: _f, label_constructor: _l, ...number_config } = o;
    const merged = merge_dicts_recursively(this.decimal_number_config, number_config);
    direction ??= this.label_direction;
    buff ??= this.line_to_number_buff;
    font_size ??= this.font_size;
    label_constructor ??= this.label_constructor;
    const num_mob: VMobject = new registry.DecimalNumber(x, { font_size, mob_class: label_constructor, ...merged });
    num_mob.next_to(this.number_to_point(x), { direction, buff });
    if (x < 0 && this.label_direction[0] === 0) num_mob.shift(mul(num_mob.get(0).width / 2, LEFT));
    return num_mob;
  }
  /** web: with no numbers manim calls a missing `default_numbers_to_display`; the tick range is used instead. */
  get_number_mobjects(...args: unknown[]): VGroup {
    const n = args.length;
    const kw: Kwargs = n && isKwargs(args[n - 1]) ? (args[n - 1] as Kwargs) : {};
    let numbers = (n && isKwargs(args[n - 1]) ? args.slice(0, -1) : args) as number[];
    if (numbers.length === 0) numbers = this.get_tick_range();
    return new VGroup(numbers.map((x) => this.get_number_mobject(x, kw)));
  }
  get_labels(): VGroup {
    return this.get_number_mobjects();
  }
  /** Add DecimalNumber labels (default: at every tick, except `numbers_to_exclude`). */
  add_numbers(...args: unknown[]): this {
    const o = pyargs(args, ['x_values', 'excluding', 'font_size', 'label_constructor'], { x_values: null, excluding: null, font_size: null, label_constructor: null });
    const { x_values: _x, excluding: _e, font_size: _f, label_constructor: _l, ...kwargs } = o;
    const x_values: Iterable<number> = o.x_values ?? this.get_tick_range();
    const excluding: number[] = Array.from(o.excluding ?? this.numbers_to_exclude);
    const font_size = o.font_size ?? this.font_size;
    const label_constructor = o.label_constructor ?? this.label_constructor;
    const numbers = new VGroup();
    for (const x of x_values) {
      if (excluding.some((e) => e === x)) continue;
      numbers.add(this.get_number_mobject(x, { ...kwargs, font_size, label_constructor }));
    }
    this.add(numbers);
    this.numbers = numbers;
    return this;
  }
  /** Add custom labels: `{value: label}` (strings become Tex, numbers become label_constructor). */
  add_labels(dict_values: LabelDict, ...args: unknown[]): this {
    const o = pyargs(args, ['direction', 'buff', 'font_size', 'label_constructor'], { direction: null, buff: null, font_size: null, label_constructor: null });
    const direction = o.direction ?? this.label_direction;
    const buff = o.buff ?? this.line_to_number_buff;
    const font_size = o.font_size ?? this.font_size;
    const label_constructor = o.label_constructor ?? this.label_constructor;
    const labels = new VGroup();
    for (const [x, raw] of labelItems(dict_values)) {
      let label: any;
      if (typeof raw === 'string') {
        if (sameClass(label_constructor, registry.MathTex)) label = new registry.Tex(raw);
        else if (sameClass(label_constructor, registry.MathTypst)) label = new registry.Typst(raw);
        else label = this._create_label_tex(raw, label_constructor);
      } else label = this._create_label_tex(raw as any, label_constructor);
      if (!('font_size' in label)) throw new Error(`AttributeError: ${label} is not compatible with add_labels.`);
      label.font_size = font_size;
      label.next_to(this.number_to_point(x), { direction, buff });
      labels.add(label);
    }
    this.labels = labels;
    this.add(labels);
    return this;
  }
  /** A VMobject is returned as is; strings / numbers go through `label_constructor`. */
  _create_label_tex(label_tex: string | number | VMobject, ...args: unknown[]): VMobject {
    const { label_constructor, ...kwargs } = pyargs(args, ['label_constructor'], { label_constructor: null });
    if (label_tex instanceof VMobject) return label_tex;
    const ctor = label_constructor ?? this.label_constructor;
    return new ctor(typeof label_tex === 'string' ? label_tex : _py_num_str(label_tex), kwargs);
  }
  /** Decimal places of str(step); `is_float` marks a Python float (str(1.0) == '1.0'). */
  static _decimal_places_from_step(step: number, is_float = false): number {
    const step_str = _py_num_str(step, is_float);
    if (!step_str.includes('.')) return 0;
    return step_str.split('.').pop()!.length;
  }
  /** `number_line @ x` */
  __matmul__(other: number): Point3D {
    return this.n2p(other);
  }
  /** `point @ number_line` */
  __rmatmul__(other: Point3DLike | Mobject): number {
    return this.p2n(other instanceof Mobject ? other.get_center() : other);
  }
}

/** The interval [0, 1] with ticks every 0.1. */
export class UnitInterval extends NumberLine {
  constructor(...args: unknown[]) {
    const o = pyargs(args, ['unit_size', 'numbers_with_elongated_ticks', 'decimal_number_config'], { unit_size: 10, numbers_with_elongated_ticks: null, decimal_number_config: null });
    const { unit_size, numbers_with_elongated_ticks, decimal_number_config, ...kwargs } = o;
    super({
      ...kwargs, x_range: [0, 1, 0.1], unit_size, numbers_with_elongated_ticks: numbers_with_elongated_ticks ?? [0, 1],
      decimal_number_config: decimal_number_config ?? { num_decimal_places: 1 },
    });
  }
}

register({ NumberLine, UnitInterval });
