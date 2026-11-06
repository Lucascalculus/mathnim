// Vector fields: a grid of arrows sampled from a field (an electric field, a velocity, a slope field), and
// streamlines traced through one with RK4 (field lines, flow lines). A scalar field is a Field (gpu.ts); a vector field
// is drawn in the 2D canvas, a few hundred arrows in one pass, so it costs little to redraw while a charge is dragged.
//
//   P.add(new VectorField((x, y) => E(x, y), { role: 'noun:field', spacing: 36 }));
//   const line = streamline((x, y) => E(x, y), seed, { bounds: { x: [-3, 3], y: [-2, 2] }, stop: (p) => near_sink(p) });
//   P.add(new Path(() => lines.map((l) => l.pts), { role: 'noun:field', heads: [0.5] }));
import type { XY } from '../kernel/geom';
import { Mark } from '../kernel/kinds';
import type { DrawEnv, Obstacle, Style } from '../kernel/thing';
import { t, type L10n } from '../kernel/text';
import { define_thing } from '../kernel/registry';

export interface VectorFieldOpts {
  id?: string;
  role?: string;
  says?: L10n;
  z?: number;
  style?: Style;
  /** Between arrows (CSS px): the grid follows the screen, so a phone shows fewer arrows, not smaller ones. */
  spacing?: number;
  /** Arrow length as a share of the spacing (default 0.72). */
  length?: number;
  /**
   * 'unit' (default): every arrow the same length, its strength in its opacity (a field that falls as 1/r² spans
   * orders of magnitude: lengths would be all tiny or all crossing); 'linear': length grows with strength up to `max`.
   */
  scale?: 'unit' | 'linear';
  /** The strength that gets a full-length (or fully opaque) arrow (default: the 90th percentile of what is on screen). */
  max?: number;
  /** Arrowheads (false: segments, a slope field). */
  heads?: boolean;
  /** Stroke width (CSS px). */
  width?: number;
}

/** A grid of arrows over a plot's data area, sampled from f (data units in, data units out; null: no arrow there). */
export class VectorField extends Mark {
  kind = 'vectors';
  /** Arrows drawn last frame (for tests and the doctor). */
  count = 0;
  constructor(public f: (x: number, y: number) => XY | null, public vo: VectorFieldOpts = {}) {
    super({ id: vo.id, role: vo.role ?? 'noun:field', says: vo.says, z: vo.z ?? 1.4, style: vo.style });
  }
  draw(env: DrawEnv): void {
    const P = this.plot, d = P.data, sp = this.vo.spacing ?? 36, len = (this.vo.length ?? 0.72) * sp;
    const nx = Math.max(1, Math.floor(d.w / sp)), ny = Math.max(1, Math.floor(d.h / sp));
    const x0 = d.x + (d.w - (nx - 1) * sp) / 2, y0 = d.y + (d.h - (ny - 1) * sp) / 2;
    // data units → px along each axis (an unequal aspect still points the arrows the right way on screen)
    const kx = d.w / (P.spec.x[1] - P.spec.x[0]), ky = d.h / (P.spec.y[1] - P.spec.y[0]);
    const pts: { x: number; y: number; ux: number; uy: number; m: number }[] = [];
    for (let j = 0; j < ny; j++)
      for (let i = 0; i < nx; i++) {
        const x = x0 + i * sp, y = y0 + j * sp, q = P.inv([x, y]), v = this.f(q[0], q[1]);
        if (!v || !Number.isFinite(v[0]) || !Number.isFinite(v[1])) continue;
        const px = v[0] * kx, py = -v[1] * ky, L = Math.hypot(px, py), m = Math.hypot(v[0], v[1]);
        if (L < 1e-12) continue;
        pts.push({ x, y, ux: px / L, uy: py / L, m });
      }
    this.count = pts.length;
    this.box = { ...d };
    if (!pts.length) return;
    const mags = pts.map((p) => p.m).sort((a, b) => a - b);
    const top = this.vo.max ?? mags[Math.min(mags.length - 1, Math.floor(mags.length * 0.9))], low = mags[Math.floor(mags.length * 0.1)];
    const lin = this.vo.scale === 'linear';
    // strength → 0..1: by length (linear) or by opacity on a log scale between the 10th and 90th percentiles (unit)
    const lg = (m: number) => Math.log(Math.max(m, 1e-12));
    const s_of = (m: number) => (lin ? Math.min(1, m / (top || 1)) : top > low ? Math.max(0, Math.min(1, (lg(m) - lg(low)) / (lg(top) - lg(low)))) : 1);
    const g = env.g, w = this.style.width ?? this.vo.width ?? 1.5, heads = this.vo.heads !== false;
    g.save();
    this.clip(env);
    g.strokeStyle = this.color;
    g.fillStyle = this.color;
    g.lineWidth = w;
    g.lineCap = 'round';
    const base = g.globalAlpha * (this.style.alpha ?? 1);
    // a few opacity buckets: one stroke and one fill each, not one per arrow
    const B = 6;
    for (let b = 0; b < B; b++) {
      const mine = pts.filter((p) => (lin ? B - 1 : Math.min(B - 1, Math.floor(s_of(p.m) * B))) === b);
      if (!mine.length) continue;
      g.globalAlpha = base * (lin ? 1 : 0.22 + 0.78 * ((b + 0.5) / B));
      g.beginPath();
      const tips: [number, number, number, number, number][] = [];
      for (const p of mine) {
        const L = lin ? Math.max(0.18, s_of(p.m)) * len : len, hl = heads ? Math.min(L * 0.42, 3.5 + 2 * w) : 0;
        const ax = p.x - (p.ux * L) / 2, ay = p.y - (p.uy * L) / 2, bx = p.x + (p.ux * L) / 2, by = p.y + (p.uy * L) / 2;
        g.moveTo(ax, ay);
        g.lineTo(bx - p.ux * hl * 0.7, by - p.uy * hl * 0.7);
        if (heads) tips.push([bx, by, p.ux, p.uy, hl]);
      }
      g.stroke();
      if (tips.length) {
        g.beginPath();
        for (const [bx, by, ux, uy, hl] of tips) {
          g.moveTo(bx, by);
          g.lineTo(bx - ux * hl - uy * hl * 0.45, by - uy * hl + ux * hl * 0.45);
          g.lineTo(bx - ux * hl + uy * hl * 0.45, by - uy * hl - ux * hl * 0.45);
          g.closePath();
        }
        g.fill();
      }
    }
    g.restore();
  }
  // a vector field is a background (as a Field is): labels may sit on it
  override obstacles(): Obstacle[] {
    return [];
  }
}

export interface StreamOpts {
  /** Step along the line (data units; default 1/200 of the bounds' width). */
  h?: number;
  /** Longest line (data units; default 4 × the bounds' perimeter). */
  max_len?: number;
  /** 1: along the field; -1: against it (a line traced back to where it came from). */
  dir?: 1 | -1;
  /** Where lines may go: a line that leaves ends exactly on the edge. */
  bounds?: { x: [number, number]; y: [number, number] };
  /** A line that reaches a point where this is true ends there (a sink, a charge). */
  stop?: (p: XY) => boolean;
  /** Weaker than this, the field has no direction to follow (a stagnation point). */
  min_speed?: number;
}
export type StreamEnd = 'edge' | 'stop' | 'length' | 'stall' | 'loop';

/**
 * A streamline from a seed: RK4 along the field's direction (each stage normalised, so the step is a distance and a
 * field that spans orders of magnitude is followed evenly). Ends at the edge (clipped onto it), at a stop, at a
 * stagnation point, back at its seed (a closed loop), or at its longest.
 */
export function streamline(f: (x: number, y: number) => XY, seed: XY, o: StreamOpts = {}): { pts: XY[]; end: StreamEnd; length: number } {
  const B = o.bounds, W = B ? B.x[1] - B.x[0] : 10, H = B ? B.y[1] - B.y[0] : 10;
  const h = o.h ?? W / 200, max_len = o.max_len ?? 4 * 2 * (W + H), dir = o.dir ?? 1, eps = o.min_speed ?? 1e-12;
  const inside = (p: XY) => !B || (p[0] >= B.x[0] && p[0] <= B.x[1] && p[1] >= B.y[0] && p[1] <= B.y[1]);
  const unit = (x: number, y: number): XY | null => {
    const v = f(x, y), m = Math.hypot(v[0], v[1]);
    return m > eps && Number.isFinite(m) ? [(dir * v[0]) / m, (dir * v[1]) / m] : null;
  };
  const pts: XY[] = [[seed[0], seed[1]]];
  let p: XY = [seed[0], seed[1]], len = 0;
  if (!inside(p)) return { pts, end: 'edge', length: 0 };
  while (len < max_len) {
    const k1 = unit(p[0], p[1]);
    const k2 = k1 && unit(p[0] + 0.5 * h * k1[0], p[1] + 0.5 * h * k1[1]);
    const k3 = k2 && unit(p[0] + 0.5 * h * k2[0], p[1] + 0.5 * h * k2[1]);
    const k4 = k3 && unit(p[0] + h * k3[0], p[1] + h * k3[1]);
    if (!k1 || !k2 || !k3 || !k4) return { pts, end: 'stall', length: len };
    const q: XY = [p[0] + (h / 6) * (k1[0] + 2 * k2[0] + 2 * k3[0] + k4[0]), p[1] + (h / 6) * (k1[1] + 2 * k2[1] + 2 * k3[1] + k4[1])];
    if (!inside(q)) {
      // onto the edge: the share of the step that is still inside
      let u = 1;
      if (B) for (const [a, lo, hi] of [[0, B.x[0], B.x[1]], [1, B.y[0], B.y[1]]] as const) {
        const dq = q[a] - p[a];
        if (q[a] < lo && dq) u = Math.min(u, (lo - p[a]) / dq);
        if (q[a] > hi && dq) u = Math.min(u, (hi - p[a]) / dq);
      }
      const e: XY = [p[0] + u * (q[0] - p[0]), p[1] + u * (q[1] - p[1])];
      pts.push(e);
      return { pts, end: 'edge', length: len + u * Math.hypot(q[0] - p[0], q[1] - p[1]) };
    }
    len += Math.hypot(q[0] - p[0], q[1] - p[1]);
    pts.push(q);
    p = q;
    if (o.stop?.(p)) return { pts, end: 'stop', length: len };
    if (len > 8 * h && Math.hypot(p[0] - seed[0], p[1] - seed[1]) < h * 0.75) {
      pts.push([seed[0], seed[1]]);
      return { pts, end: 'loop', length: len };
    }
  }
  return { pts, end: 'length', length: len };
}

// ---------------------------------------------------------------- entries
define_thing({
  name: 'vector_field', says: t('a field as arrows: direction, and strength in length or ink', '用箭头画场：方向，以及用长度或深浅表示的强弱'),
  zones: ['figure', 'world'], maturity: 'stable', since: '0.2.1', from: 'rare/field',
  syntax: "P.add(new VectorField((x, y) => E(x, y), { role: 'noun:field', spacing: 36 }))",
  source: 'packages/engine/src/lib/vectors.ts',
});
define_thing({
  name: 'streamline', says: t('a line that follows the field (a field line, a flow line)', '顺着场走的线（场线、流线）'),
  zones: ['figure', 'world'], maturity: 'stable', since: '0.2.1', from: 'rare/field',
  syntax: "P.add(new Path(() => streamline(f, seed, { bounds }), { role: 'noun:field', heads: [0.5] }))",
  source: 'packages/engine/src/lib/vectors.ts',
});
