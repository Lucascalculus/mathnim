// manim/mobject/text/numbers.py
import { DEFAULT_FONT_SIZE, DOWN, LEFT, ORIGIN, RIGHT, UP } from '../../constants';
import { Complex } from '../../utils/complex';
import { pyargs, type Kwargs } from '../../utils/pyargs';
import { register } from '../../utils/registry';
import { mul, to3, type Point3D } from '../../utils/vector';
import { ValueTracker } from '../value_tracker';
import { VMobject } from '../types/vectorized_mobject';
import { MathTex, SingleStringMathTex } from './tex_mobject';

// manim caches one mobject per string (whatever class or style first made it)
const string_to_mob_map = new Map<string, VMobject>();

const sameClass = (a: any, b: any): boolean => a != null && b != null && (a === b || (a.prototype !== undefined && a.prototype === b.prototype));

/** numpy's round-half-to-even. */
function round_half_even(x: number, decimals = 0): number {
  const f = 10 ** decimals;
  const y = x * f;
  const r = Math.round(y);
  const res = Math.abs(y % 1) === 0.5 ? 2 * Math.round(y / 2) : r;
  return res / f;
}

/** Python's format(x, '[+][,].{d}f'). web: ties follow JS toFixed. */
function format_fixed(x: number, include_sign: boolean, group_with_commas: boolean, decimals: number): string {
  let s: string;
  if (Number.isNaN(x)) s = 'nan';
  else if (!Number.isFinite(x)) s = x > 0 ? 'inf' : '-inf';
  else {
    s = Math.abs(x).toFixed(decimals);
    if (group_with_commas) {
      const [ip, fp] = s.split('.');
      s = ip.replace(/\B(?=(\d{3})+(?!\d))/g, ',') + (fp !== undefined ? '.' + fp : '');
    }
    if (x < 0 || Object.is(x, -0)) s = '-' + s;
  }
  if (include_sign && !s.startsWith('-')) s = '+' + s;
  return s;
}

/** A number displayed with TeX digits; `set_value` updates it. */
export class DecimalNumber extends VMobject {
  declare number: number | Complex;
  declare num_decimal_places: number;
  declare include_sign: boolean;
  declare mob_class: any;
  declare group_with_commas: boolean;
  declare digit_buff_per_font_unit: number;
  declare show_ellipsis: boolean;
  declare unit: string | null;
  declare unit_buff_per_font_unit: number;
  declare include_background_rectangle: boolean;
  declare edge_to_fix: Point3D;
  declare _font_size: number;
  declare initial_config: Kwargs;
  declare initial_height: number;
  declare unit_sign: VMobject;

  constructor(...args: unknown[]) {
    const o = pyargs(args, [
      'number', 'num_decimal_places', 'mob_class', 'include_sign', 'group_with_commas', 'digit_buff_per_font_unit', 'show_ellipsis', 'unit',
      'unit_buff_per_font_unit', 'include_background_rectangle', 'edge_to_fix', 'font_size', 'stroke_width', 'fill_opacity',
    ], {
      number: 0, num_decimal_places: 2, mob_class: null, include_sign: false, group_with_commas: true, digit_buff_per_font_unit: 0.001,
      show_ellipsis: false, unit: null, unit_buff_per_font_unit: 0, include_background_rectangle: false, edge_to_fix: LEFT,
      font_size: DEFAULT_FONT_SIZE, stroke_width: 0, fill_opacity: 1.0,
    });
    const {
      number, num_decimal_places, mob_class, include_sign, group_with_commas, digit_buff_per_font_unit, show_ellipsis, unit, unit_buff_per_font_unit,
      include_background_rectangle, edge_to_fix, font_size, stroke_width, fill_opacity, ...kwargs
    } = o;
    super({ ...kwargs, fill_opacity, stroke_width });
    this.number = number;
    this.num_decimal_places = num_decimal_places;
    this.include_sign = include_sign;
    this.mob_class = mob_class ?? MathTex;
    this.group_with_commas = group_with_commas;
    this.digit_buff_per_font_unit = digit_buff_per_font_unit;
    this.show_ellipsis = show_ellipsis;
    this.unit = unit;
    this.unit_buff_per_font_unit = unit_buff_per_font_unit;
    this.include_background_rectangle = include_background_rectangle;
    this.edge_to_fix = to3(edge_to_fix);
    this._font_size = font_size;
    this.fill_opacity = fill_opacity;
    this.initial_config = {
      ...kwargs, num_decimal_places, include_sign, group_with_commas, digit_buff_per_font_unit, show_ellipsis, unit, unit_buff_per_font_unit,
      include_background_rectangle, edge_to_fix, font_size, stroke_width, fill_opacity,
    };
    this._set_submobjects_from_number(number);
    this.init_colors();
  }
  /** The font size (the height relative to the initial height, times the initial font size). */
  get font_size(): number {
    return (this.height / this.initial_height) * this._font_size;
  }
  set font_size(font_val: number) {
    if (font_val <= 0) throw new Error('font_size must be greater than 0.');
    else if (this.height > 0) this.scale(font_val / this.font_size);
  }
  _set_submobjects_from_number(number: number | Complex): void {
    this.number = number;
    this.submobjects = [];
    const num_string = this._get_num_string(number);
    this.add(...[...num_string].map((c) => this._string_to_mob(c)));
    if (this.show_ellipsis) this.add(this._string_to_mob('\\dots', SingleStringMathTex, { color: this.color }));
    this.arrange({ buff: this.digit_buff_per_font_unit * this._font_size, aligned_edge: DOWN });
    if (this.unit !== null && this.unit !== undefined) {
      this.unit_sign = this._string_to_mob(this.unit, SingleStringMathTex);
      this.add(this.unit_sign.next_to(this, { direction: RIGHT, buff: (this.unit_buff_per_font_unit + this.digit_buff_per_font_unit) * this._font_size, aligned_edge: DOWN }));
    }
    this.move_to(ORIGIN);
    const chars = [...num_string];
    chars.forEach((c, i) => {
      if (c === '-' && chars.length > i + 1) {
        this.submobjects[i].align_to(this.submobjects[i + 1], UP);
        this.submobjects[i].shift(mul(this.submobjects[i + 1].height / 2, DOWN));
      } else if (c === ',') this.submobjects[i].shift(mul(this.submobjects[i].height / 2, DOWN));
    });
    if (this.unit && this.unit.startsWith('^')) this.unit_sign.align_to(this, UP);
    this.initial_height = this.height;
    if (this.include_background_rectangle) this.add_background_rectangle();
  }
  _get_num_string(number: number | Complex): string {
    let num_string: string;
    let rounded_zero: boolean;
    if (number instanceof Complex) {
      num_string = format_fixed(number.re, this.include_sign, this.group_with_commas, this.num_decimal_places)
        + format_fixed(number.im, true, this.group_with_commas, this.num_decimal_places) + 'i';
      rounded_zero = round_half_even(number.re, this.num_decimal_places) === 0 && round_half_even(number.im, this.num_decimal_places) === 0;
    } else {
      num_string = format_fixed(Number(number), this.include_sign, this.group_with_commas, this.num_decimal_places);
      rounded_zero = round_half_even(Number(number), this.num_decimal_places) === 0;
    }
    if (num_string.startsWith('-') && rounded_zero) num_string = this.include_sign ? '+' + num_string.slice(1) : num_string.slice(1);
    return num_string;
  }
  _string_to_mob(string: string, mob_class: any = null, kwargs: Kwargs = {}): VMobject {
    if (mob_class === null || mob_class === undefined) mob_class = this.mob_class;
    if (!string_to_mob_map.has(string)) string_to_mob_map.set(string, new mob_class(string, kwargs));
    const mob = string_to_mob_map.get(string)!.copy();
    (mob as any).font_size = this._font_size;
    return mob;
  }
  _get_formatter(kwargs: Kwargs = {}): string {
    const c: Kwargs = { include_sign: this.include_sign, group_with_commas: this.group_with_commas, num_decimal_places: this.num_decimal_places, ...kwargs };
    return ['{', c.field_name ?? '', ':', c.include_sign ? '+' : '', c.group_with_commas ? ',' : '', '.', String(c.num_decimal_places), 'f', '}'].join('');
  }
  _get_complex_formatter(): string {
    return [this._get_formatter({ field_name: '0.real' }), this._get_formatter({ field_name: '0.imag', include_sign: true }), 'i'].join('');
  }
  set_value(number: number | Complex): this {
    const old_family = this.get_family();
    const old_font_size = this.font_size;
    const move_to_point = this.get_edge_center(this.edge_to_fix);
    const old_submobjects = this.submobjects;
    this._set_submobjects_from_number(number);
    this.font_size = old_font_size;
    this.move_to(move_to_point, this.edge_to_fix);
    const n = Math.min(this.submobjects.length, old_submobjects.length);
    for (let i = 0; i < n; i++) this.submobjects[i].match_style(old_submobjects[i]);
    for (const mob of old_family) mob.points.fill(0);
    this.init_colors();
    return this;
  }
  get_value(): number | Complex {
    return this.number;
  }
  increment_value(delta_t = 1): this {
    this.set_value((this.get_value() as number) + delta_t);
    return this;
  }
}

/** A DecimalNumber with no decimal places. */
export class Integer extends DecimalNumber {
  constructor(...args: unknown[]) {
    const o = pyargs(args, ['number', 'num_decimal_places'], { number: 0, num_decimal_places: 0 });
    super(o);
  }
  override get_value(): number {
    return round_half_even(super.get_value() as number);
  }
}

/** A label, an equals sign and a DecimalNumber that follows `tracker`. */
export class Variable extends VMobject {
  declare label: VMobject;
  declare tracker: ValueTracker;
  declare value: DecimalNumber;

  constructor(...args: unknown[]) {
    const o = pyargs(args, ['var', 'label', 'var_type', 'num_decimal_places'], { var_type: null, num_decimal_places: 2 });
    const { var: v, label, var_type, num_decimal_places, ...kwargs } = o;
    const lab: VMobject = typeof label === 'string' ? new MathTex(label) : label;
    const equals = new MathTex('=').next_to(lab, RIGHT);
    lab.add(equals);
    const tracker = new ValueTracker(v);
    const vt = var_type ?? DecimalNumber;
    let value: DecimalNumber;
    if (sameClass(vt, DecimalNumber)) value = new DecimalNumber(tracker.get_value(), { num_decimal_places });
    else if (sameClass(vt, Integer)) value = new Integer(tracker.get_value());
    else value = new vt(tracker.get_value());
    value.next_to(lab, RIGHT);
    super(kwargs);
    this.label = lab;
    this.tracker = tracker;
    this.value = value;
    this.value.add_updater((m: DecimalNumber) => m.set_value(this.tracker.get_value()));
    this.add(this.label, this.value);
  }
}

register({ DecimalNumber, Integer, Variable });
