// M4: limits turn the plan into a quadratic program, and in two dimensions the
// QP can be drawn. The cart's plan is cut down to two decisions (qp2d.ts):
// a₁ for the first second, a₂ for the second. Left, the plan plane: every
// point is a whole plan; the ellipses are equal docking cost around the
// no-limits plan ×; every limit (motor, speed, wall) is a straight line; the
// plans that keep them all form the shaded polygon; the best plan ● is where
// the smallest ellipse touches it, and the limits whose lines pass through ●
// are the active ones. Right, the cart: its state now (p₀, v₀) on a pad the
// learner drags, and the best plan's predicted positions as dots on the rail.
// Moving the state slides the lines (and the centre); the shape of the
// ellipses never changes. Exact: the kit's QP solver on the two-move model.
import { Circle, Create, FadeIn, Scene, VGroup, VMobject, ValueTracker, smooth } from 'manim-web';
import type { Mobject } from 'manim-web';
import { palette } from '../theme';
import { define_visual } from '../visual';
import { live_number } from '../ft/d/kit';
import { live_arrow } from '../linalg/kit';
import { Q2, ROWS, clipped, contour, feasible_polygon, horizon_J, ids_of, predicted, radius, row_segment, solve_plan, unconstrained, type Family, type Plan2 } from './qp2d';
import {
  LANG_SPEC, Plot, Track, backed, clamp, emit, fill_poly, key_of, label, listen, live_label, live_vm, pick, poly_points, polys_points, resolve_lang, stroke, tex, visible_when, words,
  type Lang, type Listener, type P3, type XY,
} from './kit';
import { aside } from '../aside';

export interface QpPlaneParams extends Record<string, unknown> {
  story: string;
  p0: number;
  v0: number;
  clip: boolean;
  lang: string;
}

/** The state pad's ranges (the right panel; the track above it uses the same p scale). */
export const PAD = { p: [4, 9.9] as [number, number], v: [0, 2] as [number, number] };
/** The plan plane's range: a₁, a₂ in [−LIM, LIM] m/s². */
export const LIM = 2;
const FAMILY_ROWS: Record<Family, number[]> = {
  input: ROWS.map((r, i) => (r.family === 'input' ? i : -1)).filter((i) => i >= 0),
  speed: ROWS.map((r, i) => (r.family === 'speed' ? i : -1)).filter((i) => i >= 0),
  wall: ROWS.map((r, i) => (r.family === 'wall' ? i : -1)).filter((i) => i >= 0),
};
const ORDER: Family[] = ['input', 'speed', 'wall'];
/** The rows shown when `fam` families are on (0: none, 1: motor, 2: + speed, 3: + wall). */
export const rows_upto = (fam: number): number[] => ORDER.slice(0, Math.round(fam)).flatMap((f) => FAMILY_ROWS[f]);

/** What the picture shows at one state (pure; cached by the scene). */
export interface QpView {
  x0: [number, number];
  plan: Plan2;
  ids: string[];
  center: [number, number];
  clip: [number, number];
  poly: [number, number][];
  /** The best plan's radius in the cost metric (0 when the centre is feasible). */
  r: number;
  wall: boolean;
  speed: boolean;
  feasible: boolean;
  /** The best and the clipped plan disagree about the second move (one pushes, the other brakes). */
  flip: boolean;
  J_best: number;
  J_clip: number;
}
export function qp_view(x0: [number, number], fam = 3): QpView {
  const rows = rows_upto(fam);
  const plan = solve_plan(x0, rows);
  const ids = ids_of(plan.active);
  const center = unconstrained(x0) as [number, number], clip = clipped(x0) as [number, number];
  let poly: [number, number][] = [[-LIM, -LIM], [LIM, -LIM], [LIM, LIM], [-LIM, LIM]];
  if (rows.length) {
    poly = fam >= 3 ? feasible_polygon(x0, -LIM, LIM) : poly;
    if (fam < 3) for (const i of rows) poly = clip_by(poly, i, x0);
  }
  const ok = plan.status === 'optimal';
  const z = plan.z as [number, number];
  return {
    x0, plan, ids, center, clip, poly,
    r: ok ? radius(z, x0) : 0,
    wall: ok && ids.some((s) => s[0] === 'p'),
    speed: ok && ids.some((s) => s[0] === 'v'),
    feasible: ok,
    flip: ok && Math.abs(z[1] - clip[1]) > 0.2 && Math.sign(z[1]) !== Math.sign(clip[1]) && Math.abs(clip[1]) > 0.05 && Math.abs(z[1]) > 0.05,
    J_best: ok ? horizon_J(z, x0) : NaN,
    J_clip: horizon_J(clip, x0),
  };
}
function clip_by(poly: [number, number][], i: number, x0: [number, number]): [number, number][] {
  const g = ROWS[i].g, b = ROWS[i].w + ROWS[i].e[0] * x0[0] + ROWS[i].e[1] * x0[1];
  const out: [number, number][] = [];
  for (let k = 0; k < poly.length; k++) {
    const P = poly[k], Qp = poly[(k + 1) % poly.length];
    const vp = g[0] * P[0] + g[1] * P[1] - b, vq = g[0] * Qp[0] + g[1] * Qp[1] - b;
    if (vp <= 0) out.push(P);
    if ((vp < 0 && vq > 0) || (vp > 0 && vq < 0)) {
      const t = vp / (vp - vq);
      out.push([P[0] + t * (Qp[0] - P[0]), P[1] + t * (Qp[1] - P[1])]);
    }
  }
  return out.length >= 3 ? out : [];
}

/** TeX that follows `get()`: rebuilt only when the string changes (cached), then placed. */
export function live_tex(get: () => string, size: number, color: string, place: (m: Mobject) => void): VGroup {
  const g = VGroup();
  const upd = (m: any) => {
    const s = get();
    if (m._key !== s) {
      m._key = s;
      const cache: Map<string, Mobject> = (m._cache ??= new Map());
      let t = cache.get(s);
      if (!t && s) {
        t = tex(s, size, color);
        if (cache.size > 64) cache.clear();
        cache.set(s, t);
      }
      m.submobjects = t ? [t] : [];
    }
    if (m.submobjects.length) place(m.submobjects[0]);
  };
  upd(g);
  g.add_updater(upd);
  return g;
}

/** Colour of a limit family. */
export const family_color = (f: Family): string => {
  const c = palette();
  return f === 'input' ? c.ink : f === 'speed' ? c.gold : c.coral;
};

/**
 * The plan plane (a₁, a₂): axes, cost contours, the limit lines, the feasible
 * polygon and the three markers, all following `view()`. Reused by the M4
 * visuals; `fam()` says how many limit families are shown.
 */
export class PlanPlane {
  plot: Plot;
  group: VGroup;
  parts: Record<string, Mobject> = {};
  constructor(box: { x0: number; x1: number; y0: number; y1: number }, view: () => QpView, o: { fam?: () => number; grow?: () => number; clip?: () => boolean; lang: Lang }) {
    const c = palette();
    const L = (en: string, zh: string) => pick(o.lang, en, zh);
    const fam = o.fam ?? (() => 3), grow = o.grow ?? (() => 1), show_clip = o.clip ?? (() => true);
    const plot = new Plot({
      box, x: [-LIM, LIM], y: [-LIM, LIM], x_ticks: [-2, -1, 0, 1, 2], y_ticks: [-2, -1, 0, 1, 2],
      x_label: { tex: 'a_1\\;(0\\text{–}1\\,\\mathrm{s})' }, y_label: { tex: 'a_2\\;(1\\text{–}2\\,\\mathrm{s})' }, font: 22,
    });
    this.plot = plot;
    const S = (pts: readonly (readonly number[])[]): XY[] => pts.map((p) => [plot.X(p[0]), plot.Y(p[1])] as XY);
    const vkey = () => {
      const v = view();
      return `${key_of(v.x0, 3)}|${fam().toFixed(2)}|${grow().toFixed(3)}`;
    };
    // vertical grid lines (the Plot draws the horizontal ones)
    const vgrid = stroke(c.faint, 1.5);
    vgrid.points = polys_points([-1, 0, 1].map((a) => [[plot.X(a), box.y0], [plot.X(a), box.y1]] as XY[]));
    // the feasible polygon
    const poly = live_vm(VMobject({ fill_color: c.accent, fill_opacity: 0.13, stroke_color: c.accent, stroke_width: 2.5 }), () => {
      const p = view().poly;
      return p.length >= 3 ? poly_points(S([...p, p[0]])) : new Float64Array(0);
    }, vkey);
    poly.name = 'feasible';
    // cost contours: faint, at fixed radii around the centre, clipped to the box
    const contours = live_vm(stroke(c.accent, 1.8, 0.35), () => {
      const v = view();
      return polys_points([1, 2, 3, 4.5, 6, 8].flatMap((r) => plot.pieces(contour(v.x0, r, 120))));
    }, vkey);
    contours.name = 'contours';
    // the contour through the best plan (grown from the centre in the story)
    const best_contour = live_vm(stroke(c.accent, 3.5), () => {
      const v = view();
      const r = v.r * grow();
      return r > 0.02 ? polys_points(plot.pieces(contour(v.x0, r, 160))) : new Float64Array(0);
    }, vkey);
    best_contour.name = 'best_contour';
    // the clipped plan's contour (dashed, muted): a bigger ellipse = a higher cost
    const clip_contour = live_vm(stroke(c.muted, 2.5), () => {
      const v = view();
      if (!show_clip() || !v.feasible || grow() < 0.999) return new Float64Array(0);
      const d = Math.hypot(v.clip[0] - v.plan.z[0], v.clip[1] - v.plan.z[1]);
      if (d < 0.05) return new Float64Array(0);
      return polys_points(plot.pieces(contour(v.x0, radius(v.clip, v.x0), 160)).flatMap((p) => dashes_of(p)));
    }, vkey);
    clip_contour.name = 'clip_contour';
    // the limit lines, one path per family and state (thin dashed: inactive; thick: active)
    const lines: Record<string, VMobject> = {};
    for (const f of ORDER) {
      const col = family_color(f);
      const k = ORDER.indexOf(f) + 1;
      lines[f] = live_vm(stroke(col, 2.5, f === 'input' ? 0.75 : 0.9), () => {
        const v = view();
        if (fam() < k - 0.5) return new Float64Array(0);
        const segs: XY[][] = [];
        for (const i of FAMILY_ROWS[f]) {
          if (v.plan.active.includes(i)) continue;
          const s = row_segment(i, v.x0, -LIM, LIM);
          if (s) segs.push(...(f === 'input' ? [S(s)] : dashes_of(S(s))));
        }
        return polys_points(segs);
      }, vkey);
      lines[f + '_active'] = live_vm(stroke(col, 6), () => {
        const v = view();
        if (fam() < k - 0.5) return new Float64Array(0);
        const segs: XY[][] = [];
        for (const i of FAMILY_ROWS[f]) {
          if (!v.plan.active.includes(i)) continue;
          const s = row_segment(i, v.x0, -LIM, LIM);
          if (s) segs.push(S(s));
        }
        return polys_points(segs);
      }, vkey);
    }
    const limit_lines = VGroup(...Object.values(lines));
    limit_lines.name = 'limits';
    // markers: × the no-limits plan (or an arrow at the border when it is off the chart), □ clipped, ● best
    const inside = (p: readonly number[]) => Math.abs(p[0]) <= LIM && Math.abs(p[1]) <= LIM;
    const center = live_vm(stroke(c.ink, 4), () => {
      const v = view(), p = v.center;
      if (inside(p)) {
        const [x, y] = [plot.X(p[0]), plot.Y(p[1])], d = 0.13;
        return polys_points([[[x - d, y - d], [x + d, y + d]], [[x - d, y + d], [x + d, y - d]]]);
      }
      // an arrow on the border pointing at it
      const s = LIM / Math.max(Math.abs(p[0]), Math.abs(p[1]));
      const e = [p[0] * s, p[1] * s], dir = [p[0] / Math.hypot(p[0], p[1]), p[1] / Math.hypot(p[0], p[1])];
      const tip: XY = [plot.X(e[0]) - dir[0] * 0.04, plot.Y(e[1]) - dir[1] * 0.04];
      const tail: XY = [tip[0] - dir[0] * 0.55, tip[1] - dir[1] * 0.55];
      const n = [-dir[1], dir[0]], h = 0.14;
      return polys_points([[tail, tip], [[tip[0] - dir[0] * h + n[0] * h * 0.8, tip[1] - dir[1] * h + n[1] * h * 0.8], tip, [tip[0] - dir[0] * h - n[0] * h * 0.8, tip[1] - dir[1] * h - n[1] * h * 0.8]]]);
    }, vkey);
    center.name = 'center';
    const clip_mark = live_vm(stroke(c.muted, 3.5), () => {
      const v = view();
      if (!show_clip() || grow() < 0.999) return new Float64Array(0);
      const d = Math.hypot(v.clip[0] - v.plan.z[0], v.clip[1] - v.plan.z[1]);
      if (v.feasible && d < 0.05) return new Float64Array(0);
      const [x, y] = [plot.X(v.clip[0]), plot.Y(v.clip[1])], h = 0.12;
      return poly_points([[x - h, y - h], [x + h, y - h], [x + h, y + h], [x - h, y + h], [x - h, y - h]]);
    }, vkey);
    clip_mark.name = 'clipped';
    const best: any = Circle({ radius: 0.12, fill_color: c.accent, fill_opacity: 1, stroke_color: c.bg, stroke_width: 3 });
    const place_best = (m: any) => {
      const v = view(), k = `${vkey()}|${v.feasible}`;
      if (m._key === k) return;
      m._key = k;
      const on = v.feasible && grow() > 0.999;
      m.set_opacity(on ? 1 : 0);
      if (on) m.move_to([plot.X(v.plan.z[0]), plot.Y(v.plan.z[1]), 0]);
    };
    place_best(best);
    best.add_updater(place_best);
    best.name = 'best';
    // words on the chart: the no-limits plan, and "no plan at all"
    const center_word = live_label(() => {
      const v = view();
      if (!v.feasible && fam() > 2.5) return ''; // the chart says "no plan" instead
      return inside(v.center) ? L('no limits', '不管限制') : L('no limits (off the chart)', '不管限制（在图外）');
    }, 20, c.ink, (m: any) => {
      if (!m._bg) {
        backed(m, 0.85); // the label sits over limit lines and contours: keep it readable
        m._bg = true;
      }
      const v = view(), p = v.center;
      if (inside(p)) {
        // beside the ×, on the side farthest from the ● and the □ (so it never hides them)
        const x = plot.X(p[0]), y = plot.Y(p[1]), w = m.width / 2, hh = m.height / 2;
        const marks: XY[] = [[plot.X(v.clip[0]), plot.Y(v.clip[1])]];
        if (v.feasible) marks.push([plot.X(v.plan.z[0]), plot.Y(v.plan.z[1])]);
        let best_c: XY = [x + 0.2 + w, y + 0.27], best_s = -Infinity;
        for (const [dx, dy, pref] of [[1, 1, 0.3], [-1, 1, 0.2], [1, -1, 0.1], [-1, -1, 0], [0, 1.4, 0.15], [0, -1.4, 0.05]] as const) {
          const cx = clamp(x + dx * (0.2 + w * Math.abs(dx)), box.x0 + w + 0.05, box.x1 - w - 0.05);
          const cy = clamp(y + dy * 0.27, box.y0 + hh + 0.05, box.y1 - hh - 0.05);
          // distance from the label's box to the nearest marker (and the × itself)
          const gap = Math.min(...[...marks, [x, y] as XY].map(([mx, my]) => Math.hypot(Math.max(0, Math.abs(mx - cx) - w), Math.max(0, Math.abs(my - cy) - hh))));
          const sc = Math.min(gap, 0.3) + pref * 0.1;
          if (sc > best_s) [best_s, best_c] = [sc, [cx, cy]];
        }
        m.move_to([best_c[0], best_c[1], 0]);
      } else {
        const s = LIM / Math.max(Math.abs(p[0]), Math.abs(p[1]));
        const ex = plot.X(p[0] * s), ey = plot.Y(p[1] * s);
        const x = clamp(ex - (p[0] > 0 ? m.width / 2 + 0.15 : -m.width / 2 - 0.15), box.x0 + m.width / 2 + 0.05, box.x1 - m.width / 2 - 0.05);
        m.move_to([x, clamp(ey + (p[1] > 0 ? -0.55 : 0.55), box.y0 + 0.2, box.y1 - 0.2), 0]);
      }
    });
    center_word.name = 'center_word';
    const none_word = live_label(() => (!view().feasible && fam() > 2.5 ? L('no plan keeps every limit', '没有任何计划能守住所有限制') : ''), 24, c.coral, (m: any) => {
      if (!m._bg) {
        backed(m, 0.9);
        m._bg = true;
      }
      m.move_to([(box.x0 + box.x1) / 2, (box.y0 + box.y1) / 2 + 0.6, 0]);
    }, { max_width: box.x1 - box.x0 - 0.4 });
    none_word.name = 'no_plan';
    this.parts = { vgrid, poly, contours, best_contour, clip_contour, limit_lines, center, clip_mark, best, center_word, none_word };
    this.group = VGroup(plot.group, vgrid);
  }
}
/** Dashes of a scene-space polyline. */
function dashes_of(pts: readonly XY[]): XY[][] {
  const out: XY[][] = [];
  const dash = 0.16, gap = 0.1;
  let cur: XY[] = [], s = 0;
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i], b = pts[i + 1], L = Math.hypot(b[0] - a[0], b[1] - a[1]);
    let t = 0;
    while (t < L - 1e-12) {
      const at = (u: number): XY => [a[0] + ((b[0] - a[0]) * u) / (L || 1), a[1] + ((b[1] - a[1]) * u) / (L || 1)];
      if (s < dash) {
        const st = Math.min(dash - s, L - t);
        if (!cur.length) cur.push(at(t));
        t += st;
        s += st;
        cur.push(at(t));
        if (s >= dash - 1e-12) {
          out.push(cur);
          cur = [];
        }
      } else {
        const st = Math.min(dash + gap - s, L - t);
        t += st;
        s += st;
        if (s >= dash + gap - 1e-12) s = 0;
      }
    }
  }
  if (cur.length >= 2) out.push(cur);
  return out;
}

/** The TeX of a row as the learner reads it. */
const row_tex = (id: string): string => ROWS.find((r) => r.id === id)!.tex;
