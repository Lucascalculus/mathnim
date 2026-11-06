// The normal curve read the way the paper reads it: z rounded to two places, then the table's four-place area to the
// left (Appendices 1 and 2); backwards, the z whose printed entry is closest to an area. Pure functions, the same as
// common.py's ztable() and z_from_table() (the test compares every entry of the table), so the figure, the tests and
// the lessons read the same numbers.
import { round_py } from './tree';

/** erf: its series where it converges fast (|x| < 3), the continued fraction of erfc beyond. */
export function erf(x: number): number {
  const a = Math.abs(x);
  if (a < 3) {
    let s = 0, term = a, n = 0;
    while (Math.abs(term) > 1e-17 * Math.max(1, Math.abs(s)) && n < 200) {
      s += term / (2 * n + 1);
      n++;
      term = (-term * a * a) / n;
    }
    return Math.sign(x) * (2 / Math.sqrt(Math.PI)) * s;
  }
  // erfc(a) = e^(−a²)/√π · 1/(a + (1/2)/(a + 1/(a + (3/2)/(a + …)))), by Lentz's method
  let f = a, C = a, D = 0;
  for (let k = 1; k < 200; k++) {
    const ak = k / 2;
    D = a + ak * D;
    C = a + ak / C;
    D = 1 / D;
    const d = C * D;
    f *= d;
    if (Math.abs(d - 1) < 1e-16) break;
  }
  return Math.sign(x) * (1 - Math.exp(-a * a) / Math.sqrt(Math.PI) / f);
}
/** The standard normal's density and cumulative probability. */
export const pdf = (z: number): number => Math.exp((-z * z) / 2) / Math.sqrt(2 * Math.PI);
export const Phi = (z: number): number => 0.5 * (1 + erf(z / Math.SQRT2));

/** z as the exam writes it: (x − μ)/σ, rounded to two places. */
export const z_of = (x: number, mu: number, sd: number): number => round_py((x - mu) / sd, 2);
/** The paper's table: the area to the left of z (z rounded to two places), to four places. */
export const ztable = (z: number): number => round_py(Phi(round_py(z, 2)) + 1e-12, 4);
/** Backwards: the z (two places, within ±3) whose printed entry is closest to p; on a tie, the smaller z. */
export function z_from_table(p: number): number {
  let best = Infinity, at = 0;
  for (let k = -300; k <= 300; k++) {
    const d = Math.abs(ztable(k / 100) - p);
    if (d < best) [best, at] = [d, k];
  }
  return at / 100;
}

export type Mode = 'left' | 'right' | 'between' | 'find';
/** What the readout says, every number as the paper writes it. */
export interface Reading {
  mode: Mode;
  /** The edges in the question's units, in order (left/right: lo only; find: the edge found is hi, `from` is lo). */
  lo: number;
  hi: number;
  z_lo: number;
  z_hi: number;
  /** The table's entries used. */
  t_lo: number;
  t_hi: number;
  /** The area asked for (left, right, between), or the target to the left of the edge (find). */
  area: number;
  /** find: the target area to the left of the edge (the given area plus the table's area left of `from`). */
  target?: number;
}
/**
 * One question read off the table. left: P(X < a); right: P(X > a); between: P(a < X < b) (either order); find: the x
 * with P(X < x) = p, or with P(from < X < x) = p when `from` is given.
 */
export function read_normal(o: { mode: Mode; mu: number; sd: number; a: number; b: number; p: number; from?: number | null }): Reading {
  const { mu, sd } = o;
  if (o.mode === 'find') {
    const has_from = o.from !== null && o.from !== undefined && Number.isFinite(o.from);
    const z_lo = has_from ? z_of(o.from!, mu, sd) : -Infinity, t_lo = has_from ? ztable(z_lo) : 0;
    const target = has_from ? round_py(t_lo + o.p, 4) : o.p;
    const z_hi = z_from_table(target);
    return { mode: 'find', lo: has_from ? o.from! : -Infinity, hi: mu + z_hi * sd, z_lo, z_hi, t_lo, t_hi: ztable(z_hi), area: o.p, target };
  }
  if (o.mode === 'between') {
    const lo = Math.min(o.a, o.b), hi = Math.max(o.a, o.b), z_lo = z_of(lo, mu, sd), z_hi = z_of(hi, mu, sd), t_lo = ztable(z_lo), t_hi = ztable(z_hi);
    return { mode: 'between', lo, hi, z_lo, z_hi, t_lo, t_hi, area: round_py(t_hi - t_lo, 4) };
  }
  const z = z_of(o.a, mu, sd), tz = ztable(z);
  return { mode: o.mode, lo: o.a, hi: o.a, z_lo: z, z_hi: z, t_lo: tz, t_hi: tz, area: o.mode === 'right' ? round_py(1 - tz, 4) : tz };
}

/** A step for the hand: a round number near σ/40 (1, 2 or 5 times a power of ten), so the paper's values are reachable. */
export function hand_step(sd: number): number {
  const raw = sd / 40, e = 10 ** Math.floor(Math.log10(raw));
  return [1, 2, 5, 10].map((m) => m * e).reduce((b, s) => (Math.abs(Math.log(s / raw)) < Math.abs(Math.log(b / raw)) ? s : b));
}
/** How many decimals the question's own numbers use (409,000: 0; 32.62: 2): answers in x are written with as many. */
export function decimals_of(...xs: number[]): number {
  return Math.max(0, ...xs.map((x) => {
    const s = String(x);
    return s.includes('.') && !s.includes('e') ? s.split('.')[1].length : 0;
  }));
}
