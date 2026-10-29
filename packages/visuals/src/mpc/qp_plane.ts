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

export const mpc_qp_plane = define_visual<QpPlaneParams>({
  name: 'mpc_qp_plane',
  summary: "The cart's MPC cut to two decisions (a₁ for the first second, a₂ for the second) so the QP can be drawn: cost ellipses around the no-limits plan, each limit (motor, speed, wall) a straight line, the feasible polygon, and the best plan where the smallest ellipse touches it (active limits drawn thick). Drag the cart's state (p₀, v₀): the lines slide, the optimum slides along edges; fast and close, the polygon vanishes (no plan). Shows the clipped no-limits plan for comparison. Exact QP on the toy cart.",
  topics: ['mpc', 'quadratic program', 'constraints', 'active set', 'kkt', 'feasible set', 'level sets', 'control'],
  params: {
    story: { type: 'enum', values: ['full', 'setup'], default: 'full', doc: "'full': the narrated build (cost ellipses, the limits one family at a time, the smallest ellipse touching the polygon, then the state moves); 'setup': everything shown at once at (p0, v0), for a world" },
    p0: { type: 'number', min: 4, max: 9.9, default: 8, doc: 'initial position of the cart [m] (its front bumper; the wall is at 10 m, the flag at 9.5 m)' },
    v0: { type: 'number', min: 0, max: 2, default: 0, doc: 'initial speed [m/s] (the limit is 2)' },
    clip: { type: 'boolean', default: true, doc: 'show the clipped no-limits plan (□) and its cost ellipse, for comparison with the best plan' },
    lang: LANG_SPEC,
  },
  examples: [{}, { lang: 'zh' }, { story: 'setup', p0: 9, v0: 0.2 }, { story: 'setup', p0: 9, v0: 0.2, lang: 'zh' }, { story: 'setup', p0: 7.1, v0: 1.9, lang: 'zh' }, { story: 'setup', p0: 9.5, v0: 1.8 }, { story: 'setup', p0: 4, v0: 0, clip: false }],
  ids: ['plane', 'feasible', 'contours', 'best_contour', 'limits', 'center', 'clipped', 'best', 'track', 'cart', 'plan_dots', 'pad', 'state', 'readout', 'active', 'legend', 'note'],
  scene: (p) => {
    const lang = resolve_lang(p.lang);
    const L = (en: string, zh: string) => pick(lang, en, zh);
    class QpPlane extends Scene {
      p0 = ValueTracker(p.p0);
      v0 = ValueTracker(p.v0);
      /** How many limit families are shown (story: 0 → 3). */
      fam = ValueTracker(p.story === 'full' ? 0 : 3);
      /** The best contour grows from the centre (story). */
      grow = ValueTracker(p.story === 'full' ? 0 : 1);
      private cache = new Map<string, QpView>();
      listen(f: Listener): void {
        listen(this, f);
      }
      x0(): [number, number] {
        return [this.p0.get_value(), this.v0.get_value()];
      }
      view(): QpView {
        const x0 = this.x0(), fam = this.fam.get_value();
        const key = `${key_of(x0, 4)}|${Math.round(fam)}`;
        let v = this.cache.get(key);
        if (!v) {
          v = qp_view(x0, fam);
          if (this.cache.size > 400) this.cache.clear();
          this.cache.set(key, v);
        }
        return v;
      }
      /** Set the state (snapped to the pad's grid) - the world's handle and solve() use it. */
      set_state(p: number, v: number): void {
        this.p0.set_value(Math.round(clamp(p, PAD.p[0], PAD.p[1]) * 20) / 20);
        this.v0.set_value(Math.round(clamp(v, PAD.v[0], PAD.v[1]) * 20) / 20);
      }
      /** What a released drag reports to the world. */
      report(): Record<string, unknown> {
        const v = qp_view(this.x0());
        return { p0: v.x0[0], v0: v.x0[1], feasible: v.feasible, active: v.ids.join(','), wall: v.wall, speed: v.speed, flip: v.flip, a1: v.plan.z[0], a2: v.plan.z[1] };
      }
      emit_released(): void {
        emit(this, 'released', this.report());
      }
      override construct() {
        const c = palette();
        const { p0, v0, fam, grow } = this;
        [p0, v0, fam, grow].forEach((t, i) => (t.name = ['p0', 'v0', 'families', 'grow'][i]));
        this.track(p0, v0, fam, grow);
        const view = () => this.view();

        // ---- left: the plan plane
        const pbox = { x0: -6.15, x1: -1.05, y0: -2.75, y1: 2.35 };
        const plane = new PlanPlane(pbox, view, { fam: () => fam.get_value(), grow: () => grow.get_value(), clip: () => p.clip && grow.get_value() > 0.999 && fam.get_value() > 2.5, lang });
        plane.group.name = 'plane';
        const P = plane.parts;
        // legend for the limit families, in the top-left corner of the plane (backed)
        const fam_word = (f: Family, en: string, zh: string, t: string, y: number) => {
          const col = family_color(f);
          const sw = stroke(col, f === 'input' ? 2.5 : 4);
          sw.points = poly_points([[pbox.x0 + 0.15, y], [pbox.x0 + 0.5, y]]);
          const w = label(L(en, zh), 22, col);
          w.set_color(col);
          w.move_to([pbox.x0 + 0.62 + w.width / 2, y, 0]);
          const tx = tex(t, 24, col);
          tx.move_to([w.get_right()[0] + 0.12 + tx.width / 2, y, 0]);
          return VGroup(sw, w, tx);
        };
        const legend = VGroup(
          fam_word('input', 'motor', '电机', '|a| \\le 1', pbox.y1 - 0.26),
          fam_word('speed', 'speed', '速度', '|v| \\le 2', pbox.y1 - 0.62),
          fam_word('wall', 'wall', '墙', 'p \\le 10', pbox.y1 - 0.98),
        );
        legend.name = 'legend';
        const legend_bg = fill_poly([[pbox.x0 + 0.04, pbox.y1 - 1.2], [legend.get_right()[0] + 0.12, pbox.y1 - 1.2], [legend.get_right()[0] + 0.12, pbox.y1 - 0.05], [pbox.x0 + 0.04, pbox.y1 - 0.05]], c.bg, 0.88);
        // the readout above the plane: the best plan and its cost
        const ry = 3.12;
        const a1c = tex('a_1 =', 26, c.accent).move_to([-6.1 + 0.4, ry, 0]);
        const a1n = visible_when(live_number(() => (view().feasible ? view().plan.z[0] : 0), { decimals: 2, size: 26, color: c.accent }), () => view().feasible);
        a1n.add_updater((m: any) => m.move_to([a1c.get_right()[0] + 0.1 + m.width / 2, ry, 0]));
        const a2c = tex('a_2 =', 26, c.accent).move_to([-3.95 + 0.4, ry, 0]);
        const a2n = visible_when(live_number(() => (view().feasible ? view().plan.z[1] : 0), { decimals: 2, size: 26, color: c.accent }), () => view().feasible);
        a2n.add_updater((m: any) => m.move_to([a2c.get_right()[0] + 0.1 + m.width / 2, ry, 0]));
        const unit = tex('\\mathrm{m/s^2}', 22, c.muted).move_to([-1.85 + 0.3, ry, 0]);
        const a1x = visible_when(tex('\\text{---}', 26, c.accent), () => !view().feasible);
        a1x.add_updater((m: any) => m.move_to([a1c.get_right()[0] + 0.1 + m.width / 2, ry, 0]));
        const a2x = visible_when(tex('\\text{---}', 26, c.accent), () => !view().feasible);
        a2x.add_updater((m: any) => m.move_to([a2c.get_right()[0] + 0.1 + m.width / 2, ry, 0]));
        const readout = VGroup(a1c, a1n, a1x, a2c, a2n, a2x, unit);
        readout.name = 'readout';
        // the key for the markers: ● best plan, □ clipped plan (× is labelled on the chart)
        const best_dot = Circle({ radius: 0.08, fill_color: c.accent, fill_opacity: 1, stroke_width: 0 }).move_to([-6.02, 3.6, 0]);
        const best_text = words(L('best plan within the limits', '限制内的最优计划'), 20, c.accent, -5.86, 3.6);
        const best_word = VGroup(best_dot, best_text);
        const kx = best_text.get_right()[0] + 0.45, h = 0.08;
        const clip_sq = stroke(c.muted, 3);
        clip_sq.points = poly_points([[kx - h, 3.6 - h], [kx + h, 3.6 - h], [kx + h, 3.6 + h], [kx - h, 3.6 + h], [kx - h, 3.6 - h]]);
        const clip_key = VGroup(clip_sq, words(L('clipped plan', '截断的计划'), 20, c.muted, kx + 0.18, 3.6));
        clip_key.name = 'clip_key';
        // the active limits, under the plane
        const act_word = words(L('active:', '起作用的限制：'), 22, c.ink, -6.1, -3.68);
        const active = live_tex(() => {
          const v = view();
          if (fam.get_value() < 0.5 || grow.get_value() < 0.999) return '';
          if (!v.feasible) return '\\text{---}';
          return v.ids.length ? v.ids.map(row_tex).join(',\\;\\; ') : '\\varnothing';
        }, 26, c.ink, (m) => m.move_to([act_word.get_right()[0] + 0.15 + m.width / 2, -3.68, 0]));
        active.name = 'active';
        const none_hint = live_label(() => {
          const v = view();
          if (fam.get_value() < 2.5 || grow.get_value() < 0.999) return '';
          if (!v.feasible) return L('infeasible', '无解');
          return v.ids.length ? '' : L('(none: same as with no limits)', '（没有：和不管限制时一样）');
        }, 20, c.muted, (m) => m.move_to([active.get_right()[0] + 0.15 + m.width / 2, -3.68, 0]));

        // ---- right: the cart and its state
        const TX0 = 0.95, TX1 = 6.45;
        const track = new Track({ x0: TX0, x1: TX1, y: 1.72, p: [PAD.p[0], 10], wall: 10, target: Q2.p_ref, tick: 1, label_every: 2 });
        track.group.name = 'track';
        const cart = track.cart(() => p0.get_value());
        cart.name = 'cart';
        const dots = track.ghosts(() => {
          const v = view();
          if (grow.get_value() < 0.999) return [];
          const z = v.feasible ? v.plan.z : [-1, -1];
          return predicted(v.x0, z).map((s) => Math.min(s[0], 10.3));
        }, c.accent, 0.05);
        dots.name = 'plan_dots';
        const dots_bad = visible_when(track.ghosts(() => (!view().feasible ? predicted(view().x0, [-1, -1]).map((s) => s[0]).filter((q) => q > 10) : []), c.coral, 0.07), () => !view().feasible);
        const speed_arrow = live_arrow(() => {
          const x = track.x_of(p0.get_value()) - 0.45, v = v0.get_value();
          return [[x, 2.9, 0], [x + Math.max(0.02, v * 0.6), 2.9, 0]];
        }, c.ink, 4, 0.16, () => (v0.get_value() > 0.04 ? 1 : 0));
        const speed_word = live_tex(() => `v_0 = ${v0.get_value().toFixed(2)}\\,\\mathrm{m/s}`, 22, c.ink, (m) => {
          const x = track.x_of(p0.get_value()) - 0.45 + Math.max(0.02, v0.get_value() * 0.6) + 0.12;
          m.move_to([Math.min(x + m.width / 2, 6.9 - m.width / 2), 2.9 + (x + m.width > 6.9 ? 0.32 : 0), 0]);
        });
        const plan_word = words(L('dots: where the best plan puts the cart over the next 2 s', '圆点：最优计划在接下来 2 秒里让小车到达的位置'), 20, c.accent, TX0, 1.0, { max_w: 6.0 });
        const pad = new Plot({
          box: { x0: TX0, x1: TX1, y0: -2.85, y1: 0.25 }, x: [PAD.p[0], 10], y: PAD.v, x_ticks: [4, 5, 6, 7, 8, 9, 10], y_ticks: [0, 1, 2],
          x_label: { tex: 'p_0\\;(\\mathrm{m})' }, y_label: { tex: 'v_0\\;(\\mathrm{m/s})' }, font: 22,
        });
        pad.group.name = 'pad';
        const pad_word = words(L("the cart's state now", '小车此刻的状态'), 20, c.ink, TX0 + 1.75, 0.5);
        const state_dot = pad.live_dot(() => [p0.get_value(), v0.get_value()], c.ink, 0.11);
        state_dot.name = 'state';
        const note = aside(this, words(L('toy cart, exact QP; the plan holds one acceleration per second', '玩具小车，QP 精确求解；计划每秒只换一次加速度'), 20, c.muted, 6.9, 3.62, { align: 'right', max_w: 6.0 }));
        note.name = 'note';

        // live readouts must show their current text before they are faded in (README pitfall)
        const fresh = <T extends Mobject>(...ms: T[]): T[] => {
          for (const m of ms) m.update(0);
          return ms;
        };
        // ---- build
        const always = [P.poly, P.contours, P.best_contour, P.clip_contour, P.limit_lines, P.center, P.clip_mark, P.best];
        if (p.story === 'full') {
          fresh(speed_word);
          this.play(FadeIn(plane.group), FadeIn(track.group), FadeIn(cart), FadeIn(pad.group), FadeIn(state_dot), FadeIn(pad_word), FadeIn(note), FadeIn(speed_arrow), FadeIn(speed_word), { run_time: 1.2 });
          // the bowl: its centre (the no-limits plan) and its contours
          this.add(P.poly);
          fresh(P.center_word);
          this.play(FadeIn(P.center), FadeIn(P.center_word), Create(P.contours), { run_time: 1.8 });
          this.wait(1.2);
          // the limits, one family at a time: the polygon is what is left
          this.add(P.limit_lines);
          this.play(fam.animate.set_value(1), FadeIn(legend_bg), FadeIn(legend.submobjects[0]), { run_time: 1.2 });
          this.wait(0.8);
          // the best plan: grow an ellipse from the centre until it touches the polygon
          this.add(P.best_contour, P.best);
          this.play(grow.animate.set_value(1), { run_time: 2.2, rate_func: smooth });
          fresh(a1n, a2n, active, dots);
          this.play(FadeIn(readout), FadeIn(best_word), FadeIn(act_word), FadeIn(active), FadeIn(dots), FadeIn(plan_word), { run_time: 0.8 });
          this.wait(1);
          this.play(fam.animate.set_value(2), FadeIn(legend.submobjects[1]), { run_time: 1 });
          this.play(fam.animate.set_value(3), FadeIn(legend.submobjects[2]), { run_time: 1 });
          this.add(P.clip_contour, P.clip_mark, none_hint, dots_bad, P.none_word);
          if (p.clip) this.play(FadeIn(clip_key), { run_time: 0.6 });
          this.wait(1.2);
          // move the state: the lines slide, the centre follows, the ellipses keep their shape
          this.play(p0.animate.set_value(6.4), v0.animate.set_value(1.5), { run_time: 3, rate_func: smooth });
          this.wait(1.2);
          this.play(p0.animate.set_value(7.1), v0.animate.set_value(1.9), { run_time: 2.2, rate_func: smooth });
          this.wait(1.4);
          this.play(p0.animate.set_value(9.3), v0.animate.set_value(1.8), { run_time: 2.4, rate_func: smooth });
          this.wait(1.6);
          this.play(p0.animate.set_value(p.p0), v0.animate.set_value(p.v0), { run_time: 2, rate_func: smooth });
          this.add(legend);
          this.wait(0.8);
        } else {
          this.add(...always);
          fresh(P.center_word, a1n, a2n, active, dots, speed_word);
          this.play(FadeIn(plane.group), FadeIn(track.group), FadeIn(cart), FadeIn(pad.group), FadeIn(state_dot), FadeIn(pad_word), FadeIn(note), FadeIn(speed_arrow), FadeIn(speed_word),
            FadeIn(P.center_word), FadeIn(legend_bg), FadeIn(legend), FadeIn(readout), FadeIn(best_word), ...(p.clip ? [FadeIn(clip_key)] : []), FadeIn(act_word), FadeIn(active), FadeIn(dots), FadeIn(plan_word), { run_time: 1 });
          this.add(none_hint, dots_bad, P.none_word);
          this.wait(0.4);
        }
      }
    }
    return new QpPlane();
  },
  explore: (scene: any, ui, p) => {
    const lang = resolve_lang(p.lang);
    // the pad's geometry (same numbers as in construct)
    const TX0 = 0.95, TX1 = 6.45, Y0 = -2.85, Y1 = 0.25;
    const X = (q: number) => TX0 + ((q - PAD.p[0]) / (10 - PAD.p[0])) * (TX1 - TX0);
    const Y = (v: number) => Y0 + ((v - PAD.v[0]) / (PAD.v[1] - PAD.v[0])) * (Y1 - Y0);
    const Xi = (x: number) => PAD.p[0] + ((x - TX0) / (TX1 - TX0)) * (10 - PAD.p[0]);
    const Yi = (y: number) => PAD.v[0] + ((y - Y0) / (Y1 - Y0)) * (PAD.v[1] - PAD.v[0]);
    ui.add_handle({
      get: (): P3 => [X(scene.p0.get_value()), Y(scene.v0.get_value()), 0],
      set: (pt: P3) => scene.set_state(Xi(pt[0]), Yi(pt[1])),
      constraint: (pt: P3): P3 => [clamp(pt[0], X(PAD.p[0]), X(PAD.p[1])), clamp(pt[1], Y(PAD.v[0]), Y(PAD.v[1])), 0],
      step: 0.0925,
      radius: 0.4,
      label: pick(lang, "the cart's state (p₀, v₀)", '小车的状态 (p₀, v₀)'),
      on_end: () => scene.emit_released(),
    });
  },
});
