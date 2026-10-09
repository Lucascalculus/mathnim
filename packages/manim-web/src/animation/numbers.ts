// manim/animation/numbers.py
import type { Mobject } from '../mobject/mobject';
import { pyargs, type Kwargs } from '../utils/pyargs';
import { Animation } from './animation';

/** Animates a DecimalNumber through number_update_func(alpha). */
export class ChangingDecimal extends Animation {
  declare number_update_func: (a: number) => number;
  constructor(decimal_mob: Mobject, number_update_func: (a: number) => number, ...rest: unknown[]) {
    if (typeof (decimal_mob as any)?.set_value !== 'function' || !('number' in (decimal_mob as any))) throw new TypeError('ChangingDecimal can only take in a DecimalNumber');
    const o = pyargs(rest, ['suspend_mobject_updating'], { suspend_mobject_updating: false });
    super(decimal_mob, o);
    this.number_update_func = number_update_func;
  }
  override interpolate_mobject(alpha: number): void {
    (this.mobject as any).set_value(this.number_update_func(this.rate_func(alpha)));
  }
}

export class ChangeDecimalToValue extends ChangingDecimal {
  constructor(decimal_mob: Mobject, target_number: number, kw: Kwargs = {}) {
    const start = (decimal_mob as any).number as number;
    super(decimal_mob, (a) => (1 - a) * start + a * target_number, kw);
  }
}
