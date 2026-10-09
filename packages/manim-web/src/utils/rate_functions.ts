// manim/utils/rate_functions.py
export type RateFunction = (t: number, ...args: any[]) => number;

/** Clamp: 0 before the interval, 1 after it (manim's @unit_interval). */
const unit_interval = (f: RateFunction): RateFunction => {
  if (typeof f !== 'function') throw new TypeError('unit_interval expects a function'); // like calling the decorator on a number in Python fails downstream
  return (t, ...a) => (t >= 0 && t <= 1 ? f(t, ...a) : t < 0 ? 0 : 1);
};
/** 0 outside [0, 1] (manim's @zero). */
const zero = (f: RateFunction): RateFunction => {
  if (typeof f !== 'function') throw new TypeError('zero expects a function');
  return (t, ...a) => (t >= 0 && t <= 1 ? f(t, ...a) : 0);
};
export const sigmoid = (x: number): number => 1 / (1 + Math.exp(-x));

export const linear = unit_interval((t) => t);
export const smooth = unit_interval((t: number, inflection = 10.0) => {
  const error = sigmoid(-inflection / 2);
  return Math.min(Math.max((sigmoid(inflection * (t - 0.5)) - error) / (1 - 2 * error), 0), 1);
});
export const smoothstep = unit_interval((t) => 3 * t ** 2 - 2 * t ** 3);
export const smootherstep = unit_interval((t) => 6 * t ** 5 - 15 * t ** 4 + 10 * t ** 3);
export const smoothererstep = unit_interval((t) => 35 * t ** 4 - 84 * t ** 5 + 70 * t ** 6 - 20 * t ** 7);
export const rush_into = unit_interval((t: number, inflection = 10.0) => 2 * smooth(t / 2.0, inflection));
export const rush_from = unit_interval((t: number, inflection = 10.0) => 2 * smooth(t / 2.0 + 0.5, inflection) - 1);
export const slow_into = unit_interval((t) => Math.sqrt(1 - (1 - t) * (1 - t)));
export const double_smooth = unit_interval((t) => (t < 0.5 ? 0.5 * smooth(2 * t) : 0.5 * (1 + smooth(2 * t - 1))));
export const there_and_back = zero((t: number, inflection = 10.0) => smooth(t < 0.5 ? 2 * t : 2 * (1 - t), inflection));
export const there_and_back_with_pause = zero((t: number, pause_ratio = 1.0 / 3) => {
  const a = 2.0 / (1.0 - pause_ratio);
  if (t < 0.5 - pause_ratio / 2) return smooth(a * t);
  if (t < 0.5 + pause_ratio / 2) return 1;
  return smooth(a - a * t);
});
export const running_start = unit_interval((t: number, pull_factor = -0.5) => {
  const t2 = t * t, t3 = t2 * t, t4 = t3 * t, t5 = t4 * t, t6 = t5 * t;
  const mt = 1 - t, mt2 = mt * mt, mt3 = mt2 * mt, mt4 = mt3 * mt;
  return 15 * t2 * mt4 * pull_factor + 20 * t3 * mt3 * pull_factor + 15 * t4 * mt2 + 6 * t5 * mt + t6;
});
export const not_quite_there = (func: RateFunction = smooth, proportion = 0.7): RateFunction => (t, ...a) => proportion * func(t, ...a);
export const wiggle = zero((t: number, wiggles = 2) => there_and_back(t) * Math.sin(wiggles * Math.PI * t));
export const squish_rate_func = (func: RateFunction, a = 0.4, b = 0.6): RateFunction => (t, ...args) => {
  if (a === b) return a;
  const nt = t < a ? 0.0 : t > b ? 1.0 : (t - a) / (b - a);
  return func(nt, ...args);
};
export const lingering = unit_interval((t) => squish_rate_func((x) => x, 0, 0.8)(t));
export const exponential_decay = unit_interval((t: number, half_life = 0.1) => 1 - Math.exp(-t / half_life));

export const ease_in_sine = unit_interval((t) => 1 - Math.cos((t * Math.PI) / 2));
export const ease_out_sine = unit_interval((t) => Math.sin((t * Math.PI) / 2));
export const ease_in_out_sine = unit_interval((t) => -(Math.cos(Math.PI * t) - 1) / 2);
export const ease_in_quad = unit_interval((t) => t * t);
export const ease_out_quad = unit_interval((t) => 1 - (1 - t) * (1 - t));
export const ease_in_out_quad = unit_interval((t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2));
export const ease_in_cubic = unit_interval((t) => t * t * t);
export const ease_out_cubic = unit_interval((t) => 1 - Math.pow(1 - t, 3));
export const ease_in_out_cubic = unit_interval((t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2));
export const ease_in_quart = unit_interval((t) => t * t * t * t);
export const ease_out_quart = unit_interval((t) => 1 - Math.pow(1 - t, 4));
export const ease_in_out_quart = unit_interval((t) => (t < 0.5 ? 8 * t * t * t * t : 1 - Math.pow(-2 * t + 2, 4) / 2));
export const ease_in_quint = unit_interval((t) => t * t * t * t * t);
export const ease_out_quint = unit_interval((t) => 1 - Math.pow(1 - t, 5));
export const ease_in_out_quint = unit_interval((t) => (t < 0.5 ? 16 * t * t * t * t * t : 1 - Math.pow(-2 * t + 2, 5) / 2));
export const ease_in_expo = unit_interval((t) => (t === 0 ? 0 : Math.pow(2, 10 * t - 10)));
export const ease_out_expo = unit_interval((t) => (t === 1 ? 1 : 1 - Math.pow(2, -10 * t)));
export const ease_in_out_expo = unit_interval((t) => {
  if (t === 0) return 0;
  if (t === 1) return 1;
  return t < 0.5 ? Math.pow(2, 20 * t - 10) / 2 : (2 - Math.pow(2, -20 * t + 10)) / 2;
});
export const ease_in_circ = unit_interval((t) => 1 - Math.sqrt(1 - Math.pow(t, 2)));
export const ease_out_circ = unit_interval((t) => Math.sqrt(1 - Math.pow(t - 1, 2)));
export const ease_in_out_circ = unit_interval((t) =>
  t < 0.5 ? (1 - Math.sqrt(1 - Math.pow(2 * t, 2))) / 2 : (Math.sqrt(1 - Math.pow(-2 * t + 2, 2)) + 1) / 2);
export const ease_in_back = unit_interval((t) => {
  const c1 = 1.70158, c3 = c1 + 1;
  return c3 * t * t * t - c1 * t * t;
});
export const ease_out_back = unit_interval((t) => {
  const c1 = 1.70158, c3 = c1 + 1;
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
});
export const ease_in_out_back = unit_interval((t) => {
  const c1 = 1.70158, c2 = c1 * 1.525;
  return t < 0.5 ? (Math.pow(2 * t, 2) * ((c2 + 1) * 2 * t - c2)) / 2 : (Math.pow(2 * t - 2, 2) * ((c2 + 1) * (t * 2 - 2) + c2) + 2) / 2;
});
export const ease_in_elastic = unit_interval((t) => {
  const c4 = (2 * Math.PI) / 3;
  if (t === 0) return 0;
  if (t === 1) return 1;
  return -Math.pow(2, 10 * t - 10) * Math.sin((t * 10 - 10.75) * c4);
});
export const ease_out_elastic = unit_interval((t) => {
  const c4 = (2 * Math.PI) / 3;
  if (t === 0) return 0;
  if (t === 1) return 1;
  return Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * c4) + 1;
});
export const ease_in_out_elastic = unit_interval((t) => {
  const c5 = (2 * Math.PI) / 4.5;
  if (t === 0) return 0;
  if (t === 1) return 1;
  if (t < 0.5) return -(Math.pow(2, 20 * t - 10) * Math.sin((20 * t - 11.125) * c5)) / 2;
  return (Math.pow(2, -20 * t + 10) * Math.sin((20 * t - 11.125) * c5)) / 2 + 1;
});
const outBounce = (t: number): number => {
  const n1 = 7.5625, d1 = 2.75;
  if (t < 1 / d1) return n1 * t * t;
  if (t < 2 / d1) return n1 * (t - 1.5 / d1) * (t - 1.5 / d1) + 0.75;
  if (t < 2.5 / d1) return n1 * (t - 2.25 / d1) * (t - 2.25 / d1) + 0.9375;
  return n1 * (t - 2.625 / d1) * (t - 2.625 / d1) + 0.984375;
};
export const ease_out_bounce = unit_interval(outBounce);
export const ease_in_bounce = unit_interval((t) => 1 - outBounce(1 - t));
export const ease_in_out_bounce = unit_interval((t) => (t < 0.5 ? (1 - outBounce(1 - 2 * t)) / 2 : (1 + outBounce(2 * t - 1)) / 2));

/** Namespace object, mirroring `from manim import rate_functions`. */
/** The module namespace, in manim's order (code that iterates `rate_functions.__dict__` sees the same functions). */
export const rate_functions = {
  sigmoid, unit_interval, zero, linear, smooth, smoothstep, smootherstep, smoothererstep, rush_into, rush_from, slow_into, double_smooth,
  there_and_back, there_and_back_with_pause, running_start, not_quite_there, wiggle, squish_rate_func, lingering,
  exponential_decay, ease_in_sine, ease_out_sine, ease_in_out_sine, ease_in_quad, ease_out_quad, ease_in_out_quad,
  ease_in_cubic, ease_out_cubic, ease_in_out_cubic, ease_in_quart, ease_out_quart, ease_in_out_quart, ease_in_quint,
  ease_out_quint, ease_in_out_quint, ease_in_expo, ease_out_expo, ease_in_out_expo, ease_in_circ, ease_out_circ,
  ease_in_out_circ, ease_in_back, ease_out_back, ease_in_out_back, ease_in_elastic, ease_out_elastic,
  ease_in_out_elastic, ease_in_bounce, ease_out_bounce, ease_in_out_bounce,
};
// decorated functions keep their names (functools.wraps): rate_func.__name__ is used for labels
for (const [k, f] of Object.entries(rate_functions)) if (!f.name) Object.defineProperty(f, 'name', { value: k });
