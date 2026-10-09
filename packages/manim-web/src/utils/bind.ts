// Python bound methods: `mob.shift` as a value remembers `mob`.
// JavaScript loses `this` when a method is passed around, so APIs that take a
// method (ApplyMethod, always_redraw targets...) accept `bind_method(mob, 'shift')`.
export interface BoundMethod {
  (...args: unknown[]): unknown;
  __self__: any;
  __name__: string;
}
export function bind_method(obj: any, name: string): BoundMethod {
  const fn = ((...args: unknown[]) => obj[name](...args)) as BoundMethod;
  fn.__self__ = obj;
  fn.__name__ = name;
  return fn;
}
export const isBoundMethod = (f: unknown): f is BoundMethod => typeof f === 'function' && '__self__' in (f as any) && '__name__' in (f as any);
