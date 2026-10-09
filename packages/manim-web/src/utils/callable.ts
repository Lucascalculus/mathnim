// Let classes be called like Python constructors: `Circle()` as well as `new Circle()`.
// instanceof and subclassing keep working because the proxy forwards to the class.
import { remap_args, type Signature } from './kwcall';
export type Callable<C extends abstract new (...args: any) => any> = C & ((...args: ConstructorParameters<C>) => InstanceType<C>);

/** Hook run for top-level construction through the public wrapper (not for subclasses). */
export type ConstructHook = (cls: any, args: unknown[]) => object | undefined;
const hooks: ConstructHook[] = [];
export function add_construct_hook(h: ConstructHook): void {
  hooks.push(h);
}

/** Keyword defaults set with `Cls.set_default(...)` on the class and its ancestors. */
function class_defaults(cls: any): Record<string, unknown> | null {
  let out: Record<string, unknown> | null = null;
  const chain: any[] = [];
  for (let c = cls; c && c !== Function.prototype; c = Object.getPrototypeOf(c)) chain.unshift(c);
  for (const c of chain) if (Object.prototype.hasOwnProperty.call(c, '_defaults') && c._defaults) out = { ...(out ?? {}), ...c._defaults };
  return out;
}
const isPlainObject = (x: unknown) => x !== null && typeof x === 'object' && !Array.isArray(x) && Object.getPrototypeOf(x) === Object.prototype;

export function callable<C extends new (...args: any[]) => any>(cls: C, sig?: Signature): Callable<C> {
  const make = (args: unknown[]) => {
    // keywords for fixed constructor parameters: `GrowFromPoint(dot, { point: ORIGIN })`
    if (sig) args = remap_args(args, sig);
    const d = class_defaults(cls);
    if (d) {
      const last = args[args.length - 1];
      if (isPlainObject(last)) {
        const merged = { ...d, ...(last as object) };
        for (const sym of Object.getOwnPropertySymbols(last)) Object.defineProperty(merged, sym, { value: (last as any)[sym] });
        args = [...args.slice(0, -1), merged];
      } else args = [...args, { ...d }];
    }
    for (const h of hooks) {
      const r = h(cls, args);
      if (r !== undefined) return r;
    }
    return new cls(...args);
  };
  const proxy: any = new Proxy(cls, {
    apply(_target, _this, args) {
      return make(args);
    },
    construct(target, args, newTarget) {
      if (newTarget === proxy) return make(args);
      return Reflect.construct(target, args, newTarget);
    },
  });
  return proxy as Callable<C>;
}
