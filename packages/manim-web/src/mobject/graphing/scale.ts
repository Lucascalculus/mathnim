// manim/mobject/graphing/scale.py
import { pyargs, type Kwargs } from '../../utils/pyargs';
import { register, registry } from '../../utils/registry';
import type { VMobject } from '../types/vectorized_mobject';

/** A number or a 1-D numeric array (numpy semantics: functions map elementwise). */
export type ScaleValue = number | readonly number[] | Float64Array;

const vmap = (value: ScaleValue, f: (x: number) => number): any => (typeof value === 'number' ? f(value) : Array.from(value as ArrayLike<number>, f));

/** Base class of axis scales: `function` maps axis values to positions, `inverse_function` back. */
export class _ScaleBase {
  declare custom_labels: boolean;
  constructor(...args: unknown[]) {
    const o = pyargs(args, ['custom_labels'], { custom_labels: false });
    this.custom_labels = o.custom_labels;
  }
  function(value: number): number;
  function(value: readonly number[] | Float64Array): number[];
  function(_value: ScaleValue): any {
    throw new Error('NotImplementedError');
  }
  inverse_function(value: number): number;
  inverse_function(value: readonly number[] | Float64Array): number[];
  inverse_function(_value: ScaleValue): any {
    throw new Error('NotImplementedError');
  }
  get_custom_labels(_val_range: Iterable<number>, _kw: Kwargs = {}): VMobject[] {
    throw new Error('NotImplementedError');
  }
}

/** The default linear scale: `value * scale_factor`. */
export class LinearBase extends _ScaleBase {
  declare scale_factor: number;
  constructor(...args: unknown[]) {
    const o = pyargs(args, ['scale_factor'], { scale_factor: 1.0 });
    super();
    this.scale_factor = o.scale_factor;
  }
  override function(value: any): any {
    const s = this.scale_factor;
    return vmap(value, (x) => s * x);
  }
  override inverse_function(value: any): any {
    const s = this.scale_factor;
    return vmap(value, (x) => x / s);
  }
}

/** A logarithmic scale: `base ** value`; custom labels are `Integer(base)` with an exponent. */
export class LogBase extends _ScaleBase {
  declare base: number;
  constructor(...args: unknown[]) {
    const o = pyargs(args, ['base', 'custom_labels'], { base: 10, custom_labels: true });
    super();
    this.base = o.base;
    this.custom_labels = o.custom_labels;
  }
  override function(value: any): any {
    const b = this.base;
    return vmap(value, (x) => b ** x);
  }
  override inverse_function(value: any): any {
    // manim checks `value.any() <= 0` for arrays (i.e. "all zero"), `value <= 0` for scalars
    const condition = typeof value === 'number' ? value <= 0 : !Array.from(value as ArrayLike<number>).some((x) => x !== 0);
    if (condition) throw new Error('ValueError: log(0) is undefined. Make sure the value is in the domain of the function');
    const lb = Math.log(this.base);
    return vmap(value, (x) => Math.log(x) / lb);
  }
  override get_custom_labels(val_range: Iterable<number>, ...args: unknown[]): VMobject[] {
    const { unit_decimal_places, ...base_config } = pyargs(args, ['unit_decimal_places'], { unit_decimal_places: 0 });
    return Array.from(val_range, (i) => new registry.Integer(this.base, { unit: `^{${this.inverse_function(i).toFixed(unit_decimal_places)}}`, ...base_config }));
  }
}

register({ LinearBase, LogBase });
