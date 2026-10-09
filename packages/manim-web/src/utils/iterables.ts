// manim/utils/iterables.py (the helpers the library uses)
export function adjacent_n_tuples<T>(objects: readonly T[], n: number): T[][] {
  return objects.map((_, i) => Array.from({ length: n }, (_, k) => objects[(i + k) % objects.length]));
}
export const adjacent_pairs = <T>(objects: readonly T[]): [T, T][] => adjacent_n_tuples(objects, 2) as [T, T][];
export const all_elements_are_instances = (iterable: readonly unknown[], Class: Function): boolean => iterable.every((x) => x instanceof Class);
export function batch_by_property<T, P>(items: readonly T[], property_func: (x: T) => P): [T[], P][] {
  const out: [T[], P][] = [];
  let curr: T[] = [];
  let currProp: P | undefined;
  for (const item of items) {
    const prop = property_func(item);
    if (curr.length && prop !== currProp) {
      out.push([curr, currProp as P]);
      curr = [];
    }
    curr.push(item);
    currProp = prop;
  }
  if (curr.length) out.push([curr, currProp as P]);
  return out;
}
export const concatenate_lists = <T>(...lists: T[][]): T[] => lists.flat();
export const list_difference_update = <T>(l1: readonly T[], l2: readonly T[]): T[] => l1.filter((e) => !l2.includes(e));
export const list_update = <T>(l1: readonly T[], l2: readonly T[]): T[] => [...l1.filter((e) => !l2.includes(e)), ...l2];
export function listify<T>(obj: T | T[] | null | undefined): T[] {
  if (obj === null || obj === undefined) return [];
  if (typeof obj === 'string') return [obj];
  return Array.isArray(obj) ? obj : [obj];
}
export function make_even<T, U>(a: readonly T[], b: readonly U[]): [T[], U[]] {
  const n = Math.max(a.length, b.length);
  return [
    Array.from({ length: n }, (_, i) => a[Math.floor((i * a.length) / n)]),
    Array.from({ length: n }, (_, i) => b[Math.floor((i * b.length) / n)]),
  ];
}
export function make_even_by_cycling<T, U>(a: readonly T[], b: readonly U[]): [T[], U[]] {
  const n = Math.max(a.length, b.length);
  return [Array.from({ length: n }, (_, i) => a[i % a.length]), Array.from({ length: n }, (_, i) => b[i % b.length])];
}
/** Keep the last occurrence of each element, preserving order (manim semantics). */
export function remove_list_redundancies<T>(lst: readonly T[]): T[] {
  const seen = new Set<T>();
  const out: T[] = [];
  for (let i = lst.length - 1; i >= 0; i--) {
    if (!seen.has(lst[i])) {
      seen.add(lst[i]);
      out.push(lst[i]);
    }
  }
  return out.reverse();
}
export const remove_nones = <T>(seq: readonly (T | null | undefined)[]): T[] => seq.filter((x): x is T => x !== null && x !== undefined);
export function resize_array<T>(arr: readonly T[], length: number): T[] {
  if (arr.length === length) return arr.slice();
  return Array.from({ length }, (_, i) => arr[i % arr.length]);
}
export function resize_preserving_order<T>(arr: readonly T[], length: number): T[] {
  if (arr.length === 0) return new Array(length).fill(0 as unknown as T);
  if (arr.length === length) return arr.slice();
  return Array.from({ length }, (_, i) => arr[Math.floor((i * arr.length) / length)]);
}
/** Resample numeric rows by linear interpolation (manim resize_with_interpolation). */
export function resize_with_interpolation(arr: readonly number[][], length: number): number[][] {
  const n = arr.length;
  if (n === length) return arr.map((r) => r.slice());
  if (length === 0) return [];
  if (n === 1) return Array.from({ length }, () => arr[0].slice());
  return Array.from({ length }, (_, k) => {
    const cont = (k * (n - 1)) / Math.max(1, length - 1);
    const lh = Math.floor(cont), rh = Math.min(lh + 1, n - 1), a = cont % 1;
    return arr[lh].map((x, j) => (1 - a) * x + a * arr[rh][j]);
  });
}
export function stretch_array_to_length<T>(arr: readonly T[], length: number): T[] {
  const n = arr.length;
  if (n > length) throw new Error('Trying to stretch array to a length shorter than its own');
  return Array.from({ length }, (_, i) => arr[Math.floor((i * n) / length)]);
}
export const tuplify = <T>(obj: T | T[]): T[] => (Array.isArray(obj) ? obj : [obj]);
export function uniq_chain<T>(...args: T[][]): T[] {
  const seen = new Set<T>();
  const out: T[] = [];
  for (const a of args) for (const x of a) if (!seen.has(x)) { seen.add(x); out.push(x); }
  return out;
}
