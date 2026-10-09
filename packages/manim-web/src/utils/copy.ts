// Python copy.deepcopy semantics for mobjects: every attribute is copied,
// shared references stay shared inside the copy (memo), functions are shared.
export const NO_DEEP_COPY = Symbol('manim-web.noDeepCopy');

export function deepCopy<T>(obj: T, memo: Map<unknown, unknown> = new Map()): T {
  if (obj === null || typeof obj !== 'object') return obj;
  if (memo.has(obj)) return memo.get(obj) as T;
  if ((obj as any)[NO_DEEP_COPY]) return obj;
  if (ArrayBuffer.isView(obj)) {
    const c = (obj as unknown as Float64Array).slice();
    memo.set(obj, c);
    return c as unknown as T;
  }
  if (Array.isArray(obj)) {
    const arr: unknown[] = [];
    memo.set(obj, arr);
    for (const x of obj) arr.push(deepCopy(x, memo));
    return arr as unknown as T;
  }
  if (obj instanceof Map) {
    const m = new Map();
    memo.set(obj, m);
    for (const [k, v] of obj) m.set(k, deepCopy(v, memo));
    return m as unknown as T;
  }
  if (obj instanceof Set) {
    const s = new Set();
    memo.set(obj, s);
    for (const v of obj) s.add(deepCopy(v, memo));
    return s as unknown as T;
  }
  if (typeof Node !== 'undefined' && obj instanceof Node) return obj;
  const c = Object.create(Object.getPrototypeOf(obj));
  memo.set(obj, c);
  for (const k of Object.keys(obj)) c[k] = deepCopy((obj as any)[k], memo);
  return c;
}
