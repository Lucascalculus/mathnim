// Keyword arguments for functions and methods declared with fixed parameters.
//
// `mob.interpolate(a, b, { alpha: 0.1 })` and `always_shift(sq, RIGHT, { rate: 5 })`
// work like Python because tools/gen_index.mjs records every public method's
// parameter names and index.ts installs these wrappers. Functions that already
// take `...args` (and use pyargs) are left alone.
import { isKwargs, KW } from './pyargs';

/**
 * [parameter names, index of the parameter that collects extra keywords or -1,
 *  1 when the parameters end with `...rest` (extra keywords are passed on as a trailing object)]
 */
export type Signature = [string[], number] | [string[], number, 1];

function remap(args: IArguments, sig: Signature): unknown[] {
  const [names, kwIndex] = sig;
  if (sig[2]) return remapRest(args, names);
  const n = args.length;
  const kw = args[n - 1] as Record<string, unknown>;
  const out: unknown[] = Array.prototype.slice.call(args, 0, n - 1);
  let extra: Record<string, unknown> | null = null;
  for (const k of Object.keys(kw)) {
    const i = names.indexOf(k);
    if (i >= 0 && i !== kwIndex) {
      while (out.length < i) out.push(undefined);
      out[i] = kw[k];
    } else if (kwIndex >= 0) (extra ??= {})[k] = kw[k];
    else if ((kw as any)[KW]) throw new TypeError(`unexpected keyword argument '${k}' (parameters: ${names.join(', ')})`);
  }
  if (extra) {
    while (out.length < kwIndex) out.push(undefined);
    out[kwIndex] = { ...((out[kwIndex] as object) ?? {}), ...extra };
  }
  return out;
}
/** f(a, b, ...rest): named keywords move into place, the others stay a trailing kwargs object. */
function remapRest(args: IArguments, names: string[]): unknown[] {
  const n = args.length;
  const kw = args[n - 1] as Record<string, unknown>;
  const out: unknown[] = Array.prototype.slice.call(args, 0, n - 1);
  const rest: Record<string, unknown> = {};
  for (const k of Object.keys(kw)) {
    const i = names.indexOf(k);
    if (i >= 0) {
      while (out.length < i) out.push(undefined);
      out[i] = kw[k];
    } else rest[k] = kw[k];
  }
  if (Object.keys(rest).length) {
    while (out.length < names.length) out.push(undefined);
    out.push(rest);
  }
  return out;
}
function needsRemap(args: IArguments, sig: Signature): boolean {
  const n = args.length;
  if (n === 0 || !isKwargs(args[n - 1])) return false;
  if (sig[2]) return Object.keys(args[n - 1]).some((k) => sig[0].includes(k));
  // a plain object in the keyword-collecting slot is already the kwargs
  if (sig[1] >= 0 && n - 1 === sig[1]) return false;
  // Python-transpiled calls are tagged; plain JS objects count as keywords only
  // when every key names a parameter (so positional option objects pass through)
  const kw = args[n - 1] as Record<string | symbol, unknown>;
  return kw[KW] === true || Object.keys(kw).every((k) => sig[0].includes(k));
}

export function kwfn<F extends (...a: any[]) => any>(f: F, sig: Signature): F {
  const w = function (this: unknown) {
    // eslint-disable-next-line prefer-rest-params
    return needsRemap(arguments, sig) ? f.apply(this, remap(arguments, sig)) : f.apply(this, arguments as any);
  };
  Object.defineProperty(w, 'length', { value: f.length });
  Object.defineProperty(w, 'name', { value: f.name });
  (w as any).__wrapped__ = f;
  return w as unknown as F;
}

/** Install kwfn wrappers on a class's own methods (and static methods). */
export function install_kwargs(cls: any, methods: Record<string, Signature>, statics: Record<string, Signature> = {}): void {
  for (const [name, sig] of Object.entries(methods)) {
    const d = Object.getOwnPropertyDescriptor(cls.prototype, name);
    if (d && typeof d.value === 'function' && !d.value.__wrapped__) Object.defineProperty(cls.prototype, name, { ...d, value: kwfn(d.value, sig) });
  }
  for (const [name, sig] of Object.entries(statics)) {
    const d = Object.getOwnPropertyDescriptor(cls, name);
    if (d && typeof d.value === 'function' && !d.value.__wrapped__) Object.defineProperty(cls, name, { ...d, value: kwfn(d.value, sig) });
  }
}

/** Remap Python-style keywords in an argument list for signature `sig`; returns the args unchanged when not needed. */
export function remap_args(args: unknown[], sig: Signature): unknown[] {
  const a = args as unknown as IArguments;
  return needsRemap(a, sig) ? remap(a, sig) : args;
}
