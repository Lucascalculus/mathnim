// Python-style argument handling: positional parameters, then an optional
// trailing plain object of keyword arguments that may also name positional
// parameters. `Line(LEFT, RIGHT, { buff })` and `Line({ start: LEFT, end: RIGHT, buff })`
// both resolve to { start, end, buff }.

export type Kwargs = Record<string, any>;

/** Marks keyword arguments created by transpiled Python code (`f(x=1)`). */
export const KW = Symbol.for('manim-web.kwargs');

/** A plain object literal (not an array, vector, Mobject, colour...). */
export function isKwargs(x: unknown): x is Kwargs {
  if (x === null || typeof x !== 'object' || Array.isArray(x)) return false;
  const proto = Object.getPrototypeOf(x);
  return proto === Object.prototype || proto === null;
}

/**
 * Resolve `args` against parameter `names`, applying `defaults`.
 * A trailing plain object is treated as keyword arguments.
 */
export function pyargs<T extends Kwargs = Kwargs>(args: readonly unknown[], names: readonly string[], defaults: Kwargs = {}): T {
  const out: Kwargs = { ...defaults };
  let n = args.length;
  if (n > 0 && isKwargs(args[n - 1]) && !(n - 1 < names.length && names[n - 1].startsWith('*kw'))) {
    n -= 1;
  }
  for (let i = 0; i < n; i++) {
    if (i < names.length && names[i].startsWith('*')) {
      out[names[i].slice(1)] = args.slice(i, n);
      break;
    }
    if (i >= names.length) throw new TypeError(`Too many positional arguments (${args.length}) for (${names.join(', ')})`);
    if (args[i] !== undefined) out[names[i]] = args[i];
  }
  if (n < args.length) {
    for (const [k, val] of Object.entries(args[args.length - 1] as Kwargs)) if (val !== undefined) out[k] = val;
  }
  return out as T;
}

/** Split `*args, **kwargs` style: all leading non-kwargs values, then kwargs. */
export function starArgs<T = unknown>(args: readonly unknown[]): [T[], Kwargs] {
  const n = args.length;
  if (n > 0 && isKwargs(args[n - 1])) return [args.slice(0, n - 1) as T[], args[n - 1] as Kwargs];
  return [args.slice() as T[], {}];
}
