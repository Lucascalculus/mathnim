// manim/mobject/value_tracker.py
import { Mobject } from './mobject';
import { straight_path, type PathFuncType } from '../utils/paths';
import { pyargs } from '../utils/pyargs';
import { Complex, toComplex } from '../utils/complex';

/** Every live tracker, so scene snapshots can include trackers that are not on screen. */
export const LIVE_TRACKERS: Set<WeakRef<ValueTracker>> = new Set();

/** A number you can animate: `tracker.animate.set_value(5)`. Invisible. */
export class ValueTracker extends Mobject {
  constructor(...args: unknown[]) {
    const o = pyargs(args, ['value'], { value: 0 });
    const { value, ...kw } = o;
    super(kw);
    this.points = new Float64Array(3);
    this.set_value(value);
    LIVE_TRACKERS.add(new WeakRef(this));
  }
  get_value(): any {
    return this.points[0];
  }
  set_value(value: any): this {
    this.points[0] = value;
    return this;
  }
  increment_value(d_value: number): this {
    return this.set_value(this.get_value() + d_value);
  }
  // Python operators (used by transpiled code: `tracker += 1.5`, `tracker * 2`)
  __bool__(): boolean {
    return !!this.get_value();
  }
  private static _scalar(d: unknown, what: string): number {
    if (d instanceof Mobject) throw new Error(`Cannot ${what} ValueTracker by a Mobject. Please provide a scalar value.`);
    return d as number;
  }
  __add__(d: number): ValueTracker {
    return new ValueTracker(this.get_value() + ValueTracker._scalar(d, 'increment'));
  }
  __sub__(d: number): ValueTracker {
    return new ValueTracker(this.get_value() - ValueTracker._scalar(d, 'decrement'));
  }
  __mul__(d: number): ValueTracker {
    return new ValueTracker(this.get_value() * d);
  }
  __truediv__(d: number): ValueTracker {
    return new ValueTracker(this.get_value() / d);
  }
  __floordiv__(d: number): ValueTracker {
    return new ValueTracker(Math.floor(this.get_value() / d));
  }
  __mod__(d: number): ValueTracker {
    return new ValueTracker(((this.get_value() % d) + d) % d);
  }
  __pow__(d: number): ValueTracker {
    return new ValueTracker(this.get_value() ** d);
  }
  __iadd__(d: number): this {
    return this.increment_value(ValueTracker._scalar(d, 'increment'));
  }
  __isub__(d: number): this {
    return this.increment_value(-ValueTracker._scalar(d, 'decrement'));
  }
  __imul__(d: number): this {
    return this.set_value(this.get_value() * d);
  }
  __itruediv__(d: number): this {
    return this.set_value(this.get_value() / d);
  }
  __ifloordiv__(d: number): this {
    return this.set_value(Math.floor(this.get_value() / d));
  }
  __imod__(d: number): this {
    return this.set_value(((this.get_value() % d) + d) % d);
  }
  __ipow__(d: number): this {
    return this.set_value(this.get_value() ** d);
  }
  override valueOf(): number {
    return this.get_value();
  }
  override interpolate(m1: Mobject, m2: Mobject, alpha: number, path_func: PathFuncType = straight_path()): this {
    this.points = path_func(m1.points, m2.points, alpha);
    return this;
  }
}

/** Tracks a complex number (stored in x and y). */
export class ComplexValueTracker extends ValueTracker {
  override get_value(): Complex {
    return new Complex(this.points[0], this.points[1]);
  }
  override set_value(z: any): this {
    const c = toComplex(z);
    this.points[0] = c.re;
    this.points[1] = c.im;
    return this;
  }
}
