// Point charges in a plane: the potential V, the field E = −∇V (the same softening in both, so E is exactly the
// gradient of the V that is shaded), and field lines traced through E with the engine's streamline (RK4).
//
// Lines are seeded in proportion to charge: round(per_unit · q) around each positive charge at equal angles, traced
// along E until they reach a negative charge or the edge; a negative charge that has received fewer than its share
// gets the rest traced back against E from the largest gaps between the lines that arrived (lines that come from
// far away). Units: k = 1, so V = Σ q / r and |E| = Σ q / r².
//
// A drawing of a 3D field in the plane of its charges: lines leave a charge at equal angles in the plane, which is
// the textbook convention; line density in the plane follows the field's strength only roughly (exactly only in 3D).
import { streamline, type StreamEnd, type XY } from '@mathnim/engine';

export interface Charge { x: number; y: number; q: number }
/** Softening length: V and E stay finite at a charge (far smaller than anything drawn). */
export const SOFT = 0.04;

export function potential(cs: readonly Charge[], x: number, y: number): number {
  let v = 0;
  for (const c of cs) v += c.q / Math.sqrt((x - c.x) ** 2 + (y - c.y) ** 2 + SOFT * SOFT);
  return v;
}
export function field(cs: readonly Charge[], x: number, y: number): XY {
  let ex = 0, ey = 0;
  for (const c of cs) {
    const dx = x - c.x, dy = y - c.y, r2 = dx * dx + dy * dy + SOFT * SOFT, k = c.q / (r2 * Math.sqrt(r2));
    ex += k * dx;
    ey += k * dy;
  }
  return [ex, ey];
}

/** A field line: its points run along E (a line traced back from a negative charge is turned round); `from` is the charge it was traced from, `to` the one it reached (or -1). */
export interface Line { pts: XY[]; from: number; to: number; end: StreamEnd; dir: 1 | -1 }
export interface LineOpts {
  /** Lines per unit of charge. */
  per_unit?: number;
  bounds?: { x: [number, number]; y: [number, number] };
  /** Step (data units). */
  h?: number;
  /** Where a line starts, from its charge's centre. */
  r0?: number;
  /** A line within this of a charge has reached it. */
  r_stop?: number;
}
export const LINE_DEFAULTS: Required<LineOpts> = { per_unit: 8, bounds: { x: [-4, 4], y: [-3, 3] }, h: 0.025, r0: 0.1, r_stop: 0.08 };

/** The number of lines a charge should have. */
export const share = (q: number, per_unit = LINE_DEFAULTS.per_unit): number => Math.round(per_unit * Math.abs(q));

/** The charge a point has reached (within r_stop), or -1. */
function reached(cs: readonly Charge[], p: XY, r: number, skip = -1): number {
  for (let k = 0; k < cs.length; k++) if (k !== skip && Math.hypot(p[0] - cs[k].x, p[1] - cs[k].y) < r) return k;
  return -1;
}
/** Angles at equal steps around a charge, half a step off the direction to its nearest neighbour (a line straight at it is a degenerate one). */
function ring(cs: readonly Charge[], k: number, n: number): number[] {
  let best = Infinity, toward = 0;
  cs.forEach((c, j) => {
    const d = Math.hypot(c.x - cs[k].x, c.y - cs[k].y);
    if (j !== k && d < best) [best, toward] = [d, Math.atan2(c.y - cs[k].y, c.x - cs[k].x)];
  });
  return Array.from({ length: n }, (_, i) => toward + Math.PI / n + (2 * Math.PI * i) / n);
}

export function field_lines(cs: readonly Charge[], opts: LineOpts = {}): Line[] {
  const o = { ...LINE_DEFAULTS, ...opts }, E = (x: number, y: number) => field(cs, x, y), lines: Line[] = [];
  const trace = (k: number, a: number, dir: 1 | -1): Line => {
    const seed: XY = [cs[k].x + o.r0 * Math.cos(a), cs[k].y + o.r0 * Math.sin(a)];
    const s = streamline(E, seed, { h: o.h, dir, bounds: o.bounds, max_len: 14, stop: (p) => reached(cs, p, o.r_stop, k) >= 0 });
    const to = s.end === 'stop' ? reached(cs, s.pts[s.pts.length - 1], o.r_stop, k) : -1;
    const pts: XY[] = [[cs[k].x, cs[k].y], ...s.pts];
    return { pts: dir > 0 ? pts : pts.reverse(), from: k, to, end: s.end, dir };
  };
  const pos = cs.map((c, k) => k).filter((k) => cs[k].q > 0), neg = cs.map((c, k) => k).filter((k) => cs[k].q < 0);
  // (all of one sign: the lines leave or enter each charge and go to the edge)
  const sources = pos.length ? pos : neg, sinks = pos.length ? neg : [];
  for (const k of sources) for (const a of ring(cs, k, share(cs[k].q, o.per_unit))) lines.push(trace(k, a, pos.length ? 1 : -1));
  for (const j of sinks) {
    const need = share(cs[j].q, o.per_unit);
    const got = lines.filter((l) => l.to === j).map((l) => {
      const p = l.dir > 0 ? l.pts[l.pts.length - 1] : l.pts[0];
      return Math.atan2(p[1] - cs[j].y, p[0] - cs[j].x);
    });
    if (got.length >= need) continue;
    // the rest come from far away: traced back from the middles of the largest gaps between the lines that arrived
    const angles = got.length ? [...got] : [];
    const add: number[] = [];
    if (!angles.length) add.push(...ring(cs, j, need));
    else
      while (angles.length + add.length < need) {
        const all = [...angles, ...add].sort((a, b) => a - b);
        let gi = 0, gap = -1;
        for (let i = 0; i < all.length; i++) {
          const g = (i + 1 < all.length ? all[i + 1] : all[0] + 2 * Math.PI) - all[i];
          if (g > gap) [gap, gi] = [g, i];
        }
        add.push(all[gi] + gap / 2);
      }
    for (const a of add) lines.push(trace(j, a, -1));
  }
  return lines;
}

/** How many lines touch each charge (leave it, or end on it). */
export function line_counts(cs: readonly Charge[], lines: readonly Line[]): number[] {
  const n = cs.map(() => 0);
  for (const l of lines) {
    n[l.from]++;
    if (l.to >= 0) n[l.to]++;
  }
  return n;
}

/**
 * Where the lines cross the equipotentials V = level: how far each crossing is from a right angle (degrees), from the
 * line's own segment and the gradient of V there.
 */
export function crossing_angles(cs: readonly Charge[], lines: readonly Line[], levels: readonly number[]): number[] {
  const out: number[] = [];
  for (const l of lines) {
    // (from the first traced point: the segment from the charge's centre is not part of the trace)
    for (let k = 1; k + 1 < l.pts.length; k++) {
      const a = l.pts[k], b = l.pts[k + 1], va = potential(cs, a[0], a[1]), vb = potential(cs, b[0], b[1]);
      for (const lv of levels) {
        if ((va - lv) * (vb - lv) >= 0) continue;
        const u = (lv - va) / (vb - va), c: XY = [a[0] + u * (b[0] - a[0]), a[1] + u * (b[1] - a[1])];
        const g = field(cs, c[0], c[1]), tx = b[0] - a[0], ty = b[1] - a[1];
        const cos = Math.abs(tx * g[0] + ty * g[1]) / (Math.hypot(tx, ty) * Math.hypot(g[0], g[1]) || 1);
        // the line runs along ∇V, so it meets the level line (⊥ ∇V) at 90°: the departure is the angle to ∇V
        out.push((Math.acos(Math.min(1, cos)) * 180) / Math.PI);
      }
    }
  }
  return out;
}

/** The arrangements a figure can start from (positions in a 6 × 4 window around the origin). */
export const PRESETS: Record<string, Charge[]> = {
  dipole: [{ x: -1.1, y: 0, q: 1 }, { x: 1.1, y: 0, q: -1 }],
  like: [{ x: -1.1, y: 0, q: 1 }, { x: 1.1, y: 0, q: 1 }],
  unequal: [{ x: -1.1, y: 0, q: 2 }, { x: 1.2, y: 0, q: -1 }],
  triple: [{ x: -1.3, y: -0.5, q: 2 }, { x: 1.3, y: -0.6, q: -1 }, { x: 0.1, y: 1.1, q: -1 }],
};
/** The equipotentials drawn (V = Σ q / r). */
export const LEVELS = [0.25, 0.5, 1, 2, 4];
