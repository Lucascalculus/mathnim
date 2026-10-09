// manim/utils/simple_functions.py
export { sigmoid } from './rate_functions';

export function binary_search(fn: (x: number) => number, target: number, lower_bound: number, upper_bound: number, tolerance = 1e-4): number | null {
  let lh = lower_bound, rh = upper_bound;
  let mh = (lh + rh) / 2;
  while (Math.abs(rh - lh) > tolerance) {
    mh = (lh + rh) / 2;
    const lx = fn(lh), mx = fn(mh), rx = fn(rh);
    if (lx === target) return lh;
    if (rx === target) return rh;
    if (lx <= target && target <= rx) {
      if (mx > target) rh = mh;
      else lh = mh;
    } else if (lx > target && target > rx) {
      [lh, rh] = [rh, lh];
    } else return null;
  }
  return mh;
}
export function choose(n: number, k: number): number {
  if (k < 0 || k > n) return 0;
  let r = 1;
  for (let i = 1; i <= k; i++) r = (r * (n - k + i)) / i;
  return Math.round(r);
}
export const clip = <T extends number>(a: T, min_a: T, max_a: T): T => (a < min_a ? min_a : a > max_a ? max_a : a);
