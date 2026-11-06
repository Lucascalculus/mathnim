// The minimal 3D the engine allows (docs/design/ENGINE.md §11: a camera, depth, and an orbit; no 3D engine): a view in
// a plot that projects points, lines, arrows and faces through a camera with manim's angles (phi from the z axis,
// theta around it, gamma a roll), draws them far to near, in their roles' colours, and turns when the learner drags
// it. The camera's angles are params, so a script moves the camera (move_camera) and the tutor can turn it.
//
// What it adds for a solid in front of an axis (the torque figure, docs/design/PHYSICS-STRESS.md), still without a
// depth buffer: `pieces` cuts a line or an arrow into short segments and `segments` cuts a bar's long faces, so the
// far-to-near order is right piece by piece; `bar()` is a solid bar with outward faces, the ones facing away culled and the
// rest shaded by one fixed light (flat, Lambert); `px()` puts a label or a handle on a 3D point; `screen_axes()` and
// `handle3d()` drag a 3D point in the plane of the screen.
import { bounds_of, type XY } from './geom';
import { Handle, Mark, type Plot } from './kinds';
import { read, type Param, type Val } from './state';
import { rgba, type DrawEnv, type Obstacle, type Style } from './thing';
import { color_of, material_of, resolve_color } from '@mathnim/look';
import type { L10n } from './text';

export type P3 = [number, number, number];
type Item = { kind: 'line' | 'poly' | 'dots' | 'arrow'; pts: Val<P3[]>; role: string; style: Style; r?: number; pieces?: number; shade?: boolean; cull?: boolean; show?: Val<number>; bias?: number };
/**
 * What every item takes besides its points: its role, a style, `show` (an opacity a script can move: items appear one
 * by one) and `bias` (3D units added to its depth when sorting: an arrow lying on a solid's face is drawn over it,
 * where the far-to-near order by centres would put the face's nearer side over it).
 */
type ItemOpts = { role?: string; style?: Style; show?: Val<number>; bias?: number };
export interface Camera { phi: Param<number>; theta: Param<number>; gamma?: Param<number>; zoom?: Param<number> }

const sub = (a: P3, b: P3): P3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const cross3 = (a: P3, b: P3): P3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const norm3 = (a: P3): P3 => {
  const m = Math.hypot(a[0], a[1], a[2]) || 1;
  return [a[0] / m, a[1] / m, a[2] / m];
};
/** The one light, in the camera's frame (x right, y up, z toward the viewer): from the upper left, in front. */
const LIGHT = norm3([-0.35, 0.55, 0.75]);
/** A colour mixed with another (#rrggbb), k of the second. */
function mix(a: string, b: string, k: number): string {
  const p = (h: string) => { const n = parseInt(h.replace('#', '').slice(0, 6), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
  const [x, y] = [p(a), p(b)];
  return '#' + x.map((v, i) => Math.round(v + (y[i] - v) * k).toString(16).padStart(2, '0')).join('');
}

export class View3D extends Mark {
  kind = 'view3d';
  items: Item[] = [];
  private prims: { depth: number; draw: () => void }[] = [];
  private obs: Obstacle[] = [];
  /**
   * `size`: half the width of the cube it shows (3D units), fitted to `radius` (data units of the plot) around `center`.
   * `obstacles`: its lines, arrows and dots keep attached labels off them (as 2D marks do). `target`: the point of
   * space the camera looks at (it lands on `center` and the orbit turns about it; default the origin).
   */
  constructor(public cam: Camera, public o3: { id?: string; says?: L10n; center?: XY; radius?: number; size?: number; obstacles?: boolean; target?: Val<P3> } = {}) {
    super({ id: o3.id ?? 'view3d', role: 'scaffold', says: o3.says, z: 2 });
  }
  /** A segment; `pieces` cuts it in that many, each put in depth order on its own (a line through a solid). */
  line(a: Val<P3>, b: Val<P3>, o: ItemOpts & { pieces?: number } = {}): this {
    this.items.push({ kind: 'line', pts: () => [read(a), read(b)], role: o.role ?? 'scaffold', style: o.style ?? {}, pieces: o.pieces, show: o.show, bias: o.bias });
    return this;
  }
  polyline(pts: Val<P3[]>, o: ItemOpts = {}): this {
    this.items.push({ kind: 'line', pts, role: o.role ?? 'noun:plan', style: o.style ?? {}, show: o.show, bias: o.bias });
    return this;
  }
  /** An arrow; `pieces` as for line(), the head kept at the tip with the size the whole arrow gives it. */
  arrow(a: Val<P3>, b: Val<P3>, o: ItemOpts & { pieces?: number } = {}): this {
    this.items.push({ kind: 'arrow', pts: () => [read(a), read(b)], role: o.role ?? 'noun:plan', style: o.style ?? {}, pieces: o.pieces, show: o.show, bias: o.bias });
    return this;
  }
  /**
   * A flat polygon. `shade`: lit by the one light (flat, by its normal), drawn opaque unless its style says; `cull`:
   * not drawn when it faces away (a solid's face, its points counter-clockwise seen from outside).
   */
  face(pts: Val<P3[]>, o: ItemOpts & { shade?: boolean; cull?: boolean } = {}): this {
    this.items.push({ kind: 'poly', pts, role: o.role ?? 'region:plan', style: o.style ?? {}, shade: o.shade, cull: o.cull, show: o.show, bias: o.bias });
    return this;
  }
  dots(pts: Val<P3[]>, o: ItemOpts & { r?: number } = {}): this {
    this.items.push({ kind: 'dots', pts, role: o.role ?? 'noun:data', style: o.style ?? {}, r: o.r, show: o.show, bias: o.bias });
    return this;
  }
  /**
   * A bar from `from` to `to` with a rectangular section (half sizes `half`: across, and along `up`), as a solid: six
   * outward faces, the far ones culled, the near ones shaded; its long faces cut in `segments` (depth order against a
   * line passing near it).
   */
  bar(from: Val<P3>, to: Val<P3>, o: ItemOpts & { half: [number, number]; up?: P3; segments?: number } = { half: [0.1, 0.1] }): this {
    const n = Math.max(1, o.segments ?? 1);
    const frame = () => {
      const a = read(from), b = read(to), ax = norm3(sub(b, a));
      let up = o.up ?? [0, 0, 1];
      if (Math.abs(ax[0] * up[0] + ax[1] * up[1] + ax[2] * up[2]) > 0.99) up = [0, 1, 0];
      const s = norm3(cross3(ax, up)), u = cross3(s, ax);
      return { a, b, s, u };
    };
    // the corner at fraction f along the bar, on the side (i, j) of its section (±1, ±1)
    const corner = (f: number, i: number, j: number): P3 => {
      const { a, b, s, u } = frame(), [hs, hu] = o.half;
      return [0, 1, 2].map((k) => a[k] + (b[k] - a[k]) * f + s[k] * hs * i + u[k] * hu * j) as P3;
    };
    const st = { role: o.role ?? 'region:plan', style: o.style ?? {}, shade: true, cull: true, show: o.show };
    for (let k = 0; k < n; k++) {
      const f0 = k / n, f1 = (k + 1) / n;
      // (counter-clockwise from outside: +s, -s, +u, -u)
      this.face(() => [corner(f0, 1, -1), corner(f1, 1, -1), corner(f1, 1, 1), corner(f0, 1, 1)], st);
      this.face(() => [corner(f0, -1, -1), corner(f0, -1, 1), corner(f1, -1, 1), corner(f1, -1, -1)], st);
      this.face(() => [corner(f0, -1, 1), corner(f0, 1, 1), corner(f1, 1, 1), corner(f1, -1, 1)], st);
      this.face(() => [corner(f0, -1, -1), corner(f1, -1, -1), corner(f1, 1, -1), corner(f0, 1, -1)], st);
    }
    this.face(() => [corner(0, -1, -1), corner(0, 1, -1), corner(0, 1, 1), corner(0, -1, 1)], st);
    this.face(() => [corner(1, -1, -1), corner(1, -1, 1), corner(1, 1, 1), corner(1, 1, -1)], st);
    return this;
  }
  /** A point in the camera's frame: (right, up, toward the viewer), before the plot's scale. */
  rot(p: P3): P3 {
    const phi = this.cam.phi.value, theta = this.cam.theta.value, gamma = this.cam.gamma?.value ?? 0;
    // manim's camera: R = Rz(gamma) Rx(-phi) Rz(-theta - 90°)
    const a = -theta - Math.PI / 2;
    const x = p[0] * Math.cos(a) - p[1] * Math.sin(a), y = p[0] * Math.sin(a) + p[1] * Math.cos(a), z = p[2];
    const b = -phi, y2 = y * Math.cos(b) - z * Math.sin(b), z2 = y * Math.sin(b) + z * Math.cos(b);
    return [x * Math.cos(gamma) - y2 * Math.sin(gamma), x * Math.sin(gamma) + y2 * Math.cos(gamma), z2];
  }
  /** A point of 3D space on the plot (data coordinates) and its depth (larger: nearer). */
  project(p: P3): [number, number, number] {
    const zoom = this.cam.zoom?.value ?? 1, [x, y, z] = this.rot(this.o3.target ? sub(p, read(this.o3.target)) : p);
    const c = this.o3.center ?? [(this.plot.spec.x[0] + this.plot.spec.x[1]) / 2, (this.plot.spec.y[0] + this.plot.spec.y[1]) / 2];
    const k = ((this.o3.radius ?? Math.min(this.plot.spec.x[1] - this.plot.spec.x[0], this.plot.spec.y[1] - this.plot.spec.y[0]) / 2) / (this.o3.size ?? 3)) * zoom;
    return [c[0] + x * k, c[1] + y * k, z];
  }
  /** Where a 3D point is on the figure (CSS px): a label's or a handle's anchor. */
  px(p: P3): XY {
    const [x, y] = this.project(p);
    return this.plot.P([x, y]);
  }
  /** CSS px per unit of 3D space (the projection is orthographic: the same everywhere). */
  px_per_unit(): number {
    const a = this.px([0, 0, 0]), r = this.screen_axes().right, b = this.px(r);
    return Math.hypot(b[0] - a[0], b[1] - a[1]);
  }
  /** The screen's directions in 3D space: right, up, and out toward the viewer (unit vectors). */
  screen_axes(): { right: P3; up: P3; out: P3 } {
    const ex = this.rot([1, 0, 0]), ey = this.rot([0, 1, 0]), ez = this.rot([0, 0, 1]);
    return { right: [ex[0], ey[0], ez[0]], up: [ex[1], ey[1], ez[1]], out: [ex[2], ey[2], ez[2]] };
  }
  draw(env: DrawEnv): void {
    const g = env.g, P = this.plot, prims: { depth: number; draw: () => void }[] = [], all: XY[] = [], obs: Obstacle[] = [];
    const px = (p: P3) => {
      const [x, y, d] = this.project(p), q = P.P([x, y]);
      all.push(q);
      return [q[0], q[1], d] as const;
    };
    for (const it of this.items) {
      const shown = it.show === undefined ? 1 : read(it.show);
      if (shown <= 0.001) continue;
      const first = prims.length;
      this.draw_item(it, shown, env, prims, obs, px);
      if (it.bias) for (let k = first; k < prims.length; k++) prims[k].depth += it.bias;
    }
    prims.sort((a, b) => a.depth - b.depth);
    g.save();
    this.clip(env);
    g.lineCap = 'round';
    g.lineJoin = 'round';
    for (const p of prims) p.draw();
    g.restore();
    this.prims = prims;
    this.obs = obs;
    this.box = all.length ? bounds_of(all) : { x: 0, y: 0, w: 0, h: 0 };
  }
  /** One item's primitives (each drawn later, far to near). */
  private draw_item(it: Item, shown: number, env: DrawEnv, prims: { depth: number; draw: () => void }[], obs: Obstacle[], px: (p: P3) => readonly [number, number, number]): void {
    const g = env.g;
    const pts = read(it.pts), col = it.style.color ? resolve_color(it.style.color, env.look) : color_of(it.role), m = material_of(it.role);
    const w = it.style.width ?? m.stroke ?? 2, alpha = (it.style.alpha ?? 1) * shown;
    if (it.kind === 'dots') {
      for (const p of pts) {
        const [x, y, d] = px(p), r = it.r ?? 3.5;
        obs.push({ pt: [x, y], r: r + 3, weight: 1 });
        prims.push({ depth: d, draw: () => {
          g.globalAlpha = alpha;
          g.fillStyle = col;
          g.beginPath();
          g.arc(x, y, r, 0, Math.PI * 2);
          g.fill();
        } });
      }
    } else if (it.kind === 'poly') {
      if (pts.length < 3) return;
      let fill = rgba(it.style.fill ? resolve_color(it.style.fill, env.look) : col, it.style.fill_alpha ?? m.fill_opacity ?? 0.15);
      if (it.shade || it.cull) {
        const n = this.rot(norm3(cross3(sub(pts[1], pts[0]), sub(pts[2], pts[0]))));
        if (it.cull && n[2] <= 1e-9) return; // (edge-on faces show nothing)
        if (it.shade) {
          // (a lit face is lighter, as paper in light is; the face turned from the light, darker)
          const lit = Math.max(0, it.cull ? n[0] * LIGHT[0] + n[1] * LIGHT[1] + n[2] * LIGHT[2] : Math.abs(n[0] * LIGHT[0] + n[1] * LIGHT[1] + n[2] * LIGHT[2]));
          fill = rgba(mix(env.look.palette.bg, it.style.fill ? resolve_color(it.style.fill, env.look) : col, 0.14 + 0.5 * (1 - lit)), it.style.fill_alpha ?? 1);
        }
      }
      const q = pts.map(px);
      prims.push({ depth: q.reduce((s, p) => s + p[2], 0) / q.length, draw: () => {
        g.globalAlpha = shown;
        g.beginPath();
        q.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y)));
        g.closePath();
        g.fillStyle = fill;
        g.fill();
        // (a shaded face is edged in its own tone: the seams between a solid's pieces do not show)
        g.strokeStyle = it.shade ? fill : rgba(col, (alpha / shown) * 0.7);
        g.lineWidth = it.shade ? 1 : w;
        g.stroke();
      } });
    } else if (it.pieces && it.pieces > 1 && pts.length === 2) {
      // a segment cut in pieces, each in depth order; an arrow's head is its own piece at the tip
      const [a, b] = pts, n = it.pieces, q = Array.from({ length: n + 1 }, (_, k) => px([0, 1, 2].map((i) => a[i] + ((b[i] - a[i]) * k) / n) as P3));
      const L = Math.hypot(q[n][0] - q[0][0], q[n][1] - q[0][1]), ux = (q[n][0] - q[0][0]) / (L || 1), uy = (q[n][1] - q[0][1]) / (L || 1);
      const hl = it.kind === 'arrow' ? Math.min(L * 0.4, 9 + w * 2) : 0, cut = L - hl * 0.8;
      obs.push({ seg: [[q[0][0], q[0][1]], [q[n][0], q[n][1]]], weight: 1.2 });
      for (let i = 0; i < n; i++) {
        // (a piece along the shaft, shortened where the head begins)
        const s0 = (L * i) / n, s1 = Math.min((L * (i + 1)) / n, cut);
        if (s1 <= s0) continue;
        const [x0, y0] = [q[0][0] + ux * s0, q[0][1] + uy * s0], [x1, y1] = [q[0][0] + ux * s1, q[0][1] + uy * s1];
        prims.push({ depth: (q[i][2] + q[i + 1][2]) / 2, draw: () => {
          g.globalAlpha = alpha;
          g.strokeStyle = col;
          g.lineWidth = w;
          g.setLineDash(it.style.dash ?? m.dash ?? []);
          g.beginPath();
          g.moveTo(x0, y0);
          g.lineTo(x1, y1);
          g.stroke();
        } });
      }
      if (it.kind === 'arrow' && L > 1) {
        const [x1, y1, d1] = q[n];
        prims.push({ depth: d1, draw: () => {
          g.globalAlpha = alpha;
          g.fillStyle = col;
          g.setLineDash([]);
          g.beginPath();
          g.moveTo(x1, y1);
          g.lineTo(x1 - ux * hl - uy * hl * 0.45, y1 - uy * hl + ux * hl * 0.45);
          g.lineTo(x1 - ux * hl + uy * hl * 0.45, y1 - uy * hl - ux * hl * 0.45);
          g.closePath();
          g.fill();
        } });
      }
    } else {
      // lines and arrows: each segment on its own, so a line passing behind a face is drawn behind it
      const q = pts.map(px);
      for (let i = 0; i + 1 < q.length; i++) {
        const [x0, y0, d0] = q[i], [x1, y1, d1] = q[i + 1], head = it.kind === 'arrow' && i === q.length - 2;
        obs.push({ seg: [[x0, y0], [x1, y1]], weight: 1.2 });
        prims.push({ depth: (d0 + d1) / 2, draw: () => {
          g.globalAlpha = alpha;
          g.strokeStyle = col;
          g.fillStyle = col;
          g.lineWidth = w;
          g.setLineDash(it.style.dash ?? m.dash ?? []);
          const L = Math.hypot(x1 - x0, y1 - y0), hl = head ? Math.min(L * 0.4, 9 + w * 2) : 0, ux = (x1 - x0) / (L || 1), uy = (y1 - y0) / (L || 1);
          g.beginPath();
          g.moveTo(x0, y0);
          g.lineTo(x1 - ux * hl * 0.8, y1 - uy * hl * 0.8);
          g.stroke();
          if (head && L > 1) {
            g.setLineDash([]);
            g.beginPath();
            g.moveTo(x1, y1);
            g.lineTo(x1 - ux * hl - uy * hl * 0.45, y1 - uy * hl + ux * hl * 0.45);
            g.lineTo(x1 - ux * hl + uy * hl * 0.45, y1 - uy * hl - ux * hl * 0.45);
            g.closePath();
            g.fill();
          }
        } });
      }
    }
  }
  override obstacles(): Obstacle[] {
    return this.o3.obstacles ? this.obs : [];
  }
  where(): XY | null {
    return this.box.w ? [this.box.x + this.box.w / 2, this.box.y + this.box.h / 2] : null;
  }
}

/** Turn the camera by dragging anywhere on the view (an orbit: theta with the drag across, phi with the drag down). */
export function orbit(fig: { handles: Handle[] }, P: Plot, v: View3D, o: { id?: string; says?: L10n; speed?: number } = {}): Handle {
  const k = (o.speed ?? 1) * 0.01;
  const h = new Handle(v.cam.theta, v.cam.phi, {
    id: o.id ?? `${v.id}_orbit`, says: o.says ?? { en: 'turn the view', zh: '转动视角' }, relative: { kx: -k, ky: -k }, look: 'none',
    at: () => [P.data.x + P.data.w / 2, P.data.y + P.data.h / 2], r: Math.max(30, Math.min(P.data.w, P.data.h) / 2),
  });
  h.opacity.set(0);
  P.add(h);
  fig.handles.push(h);
  return h;
}

/**
 * A glass handle on a 3D point: a drag moves the point in the plane of the screen (turn the view to move it in another),
 * or, held to a line (`along`), along the line by as much as the drag goes along the line's picture (it stays under
 * the pointer however foreshortened the line is).
 */
export class Handle3D extends Handle {
  constructor(public view: View3D, public get: () => P3, public put: (p: P3) => void, px: Param<number>, py: Param<number> | null, o: ConstructorParameters<typeof Handle>[2] & { along?: () => P3 } = {}) {
    super(px, py, { ...o, relative: { kx: 0, ky: 0 }, at: () => view.px(get()) });
    this.along = o.along;
  }
  along?: () => P3;
  override drag_by(dx: number, dy: number): void {
    const k = this.view.px_per_unit() || 1, { right, up } = this.view.screen_axes(), p = this.get();
    if (this.along) {
      // the line's direction on the screen (px per unit along it), and the share of the drag along it
      const d = this.along(), sx = (d[0] * right[0] + d[1] * right[1] + d[2] * right[2]) * k, sy = -(d[0] * up[0] + d[1] * up[1] + d[2] * up[2]) * k;
      const s2 = sx * sx + sy * sy;
      if (s2 > 1e-6) {
        const u = (dx * sx + dy * sy) / s2;
        this.put([0, 1, 2].map((i) => p[i] + d[i] * u) as P3);
      }
    } else this.put([0, 1, 2].map((i) => p[i] + (dx * right[i] - dy * up[i]) / k) as P3);
    this.o.on_move?.();
  }
  /** The arrow keys: a step of 8 px on the screen. */
  override nudge(dx: number, dy: number): void {
    this.drag_by(dx * 8, -dy * 8);
  }
}
/**
 * A handle that drags a 3D point (`get` reads it from params, `put` writes them, keeping whatever the figure holds it
 * to: a lever, a sphere); `params` are what the tutor and the keyboard name.
 */
export function handle3d(fig: { handles: Handle[] }, P: Plot, v: View3D, o: { id?: string; says?: L10n; get: () => P3; put: (p: P3) => void; params: [Param<number>, Param<number> | null]; along?: () => P3; r?: number; on_end?: () => void }): Handle3D {
  const h = new Handle3D(v, o.get, o.put, o.params[0], o.params[1], { id: o.id, says: o.says, r: o.r, on_end: o.on_end, along: o.along });
  h.opacity.set(0);
  P.add(h);
  fig.handles.push(h);
  return h;
}
