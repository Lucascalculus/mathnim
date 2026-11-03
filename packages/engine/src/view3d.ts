// The minimal 3D the engine allows (docs/design/ENGINE.md §11: a camera, depth, and an orbit; no 3D engine): a view in
// a plot that projects points, lines, arrows and faces through a camera with manim's angles (phi from the z axis,
// theta around it, gamma a roll), draws them far to near, in their roles' colours, and turns when the learner drags
// it. The camera's angles are params, so a script moves the camera (move_camera) and the tutor can turn it.
import { bounds_of, type XY } from './geom';
import { Handle, Mark, type Plot } from './kinds';
import { read, type Param, type Val } from './state';
import { rgba, type DrawEnv, type Obstacle, type Style } from './thing';
import { color_of, material_of, resolve_color } from '@mathnim/look';
import type { L10n } from './text';

export type P3 = [number, number, number];
type Item = { kind: 'line' | 'poly' | 'dots' | 'arrow'; pts: Val<P3[]>; role: string; style: Style; r?: number };
export interface Camera { phi: Param<number>; theta: Param<number>; gamma?: Param<number>; zoom?: Param<number> }

export class View3D extends Mark {
  kind = 'view3d';
  items: Item[] = [];
  private prims: { depth: number; draw: () => void }[] = [];
  /** `size`: half the width of the cube it shows (3D units), fitted to `radius` (data units of the plot) around `center`. */
  constructor(public cam: Camera, public o3: { id?: string; says?: L10n; center?: XY; radius?: number; size?: number } = {}) {
    super({ id: o3.id ?? 'view3d', role: 'scaffold', says: o3.says, z: 2 });
  }
  line(a: Val<P3>, b: Val<P3>, o: { role?: string; style?: Style } = {}): this {
    this.items.push({ kind: 'line', pts: () => [read(a), read(b)], role: o.role ?? 'scaffold', style: o.style ?? {} });
    return this;
  }
  polyline(pts: Val<P3[]>, o: { role?: string; style?: Style } = {}): this {
    this.items.push({ kind: 'line', pts, role: o.role ?? 'noun:plan', style: o.style ?? {} });
    return this;
  }
  arrow(a: Val<P3>, b: Val<P3>, o: { role?: string; style?: Style } = {}): this {
    this.items.push({ kind: 'arrow', pts: () => [read(a), read(b)], role: o.role ?? 'noun:plan', style: o.style ?? {} });
    return this;
  }
  face(pts: Val<P3[]>, o: { role?: string; style?: Style } = {}): this {
    this.items.push({ kind: 'poly', pts, role: o.role ?? 'region:plan', style: o.style ?? {} });
    return this;
  }
  dots(pts: Val<P3[]>, o: { role?: string; style?: Style; r?: number } = {}): this {
    this.items.push({ kind: 'dots', pts, role: o.role ?? 'noun:data', style: o.style ?? {}, r: o.r });
    return this;
  }
  /** A point of 3D space on the plot (data coordinates) and its depth (larger: nearer). */
  project(p: P3): [number, number, number] {
    const phi = this.cam.phi.value, theta = this.cam.theta.value, gamma = this.cam.gamma?.value ?? 0, zoom = this.cam.zoom?.value ?? 1;
    // manim's camera: R = Rz(gamma) Rx(-phi) Rz(-theta - 90°)
    const a = -theta - Math.PI / 2;
    let x = p[0] * Math.cos(a) - p[1] * Math.sin(a), y = p[0] * Math.sin(a) + p[1] * Math.cos(a), z = p[2];
    const b = -phi, y2 = y * Math.cos(b) - z * Math.sin(b), z2 = y * Math.sin(b) + z * Math.cos(b);
    y = y2;
    z = z2;
    const x3 = x * Math.cos(gamma) - y * Math.sin(gamma), y3 = x * Math.sin(gamma) + y * Math.cos(gamma);
    const c = this.o3.center ?? [(this.plot.spec.x[0] + this.plot.spec.x[1]) / 2, (this.plot.spec.y[0] + this.plot.spec.y[1]) / 2];
    const k = ((this.o3.radius ?? Math.min(this.plot.spec.x[1] - this.plot.spec.x[0], this.plot.spec.y[1] - this.plot.spec.y[0]) / 2) / (this.o3.size ?? 3)) * zoom;
    x = x3;
    return [c[0] + x * k, c[1] + y3 * k, z];
  }
  draw(env: DrawEnv): void {
    const g = env.g, P = this.plot, prims: { depth: number; draw: () => void }[] = [], all: XY[] = [];
    const px = (p: P3) => {
      const [x, y, d] = this.project(p), q = P.P([x, y]);
      all.push(q);
      return [q[0], q[1], d] as const;
    };
    for (const it of this.items) {
      const pts = read(it.pts), col = it.style.color ? resolve_color(it.style.color, env.look) : color_of(it.role), m = material_of(it.role);
      const w = it.style.width ?? m.stroke ?? 2, alpha = it.style.alpha ?? 1;
      if (it.kind === 'dots') {
        for (const p of pts) {
          const [x, y, d] = px(p), r = it.r ?? 3.5;
          prims.push({ depth: d, draw: () => {
            g.globalAlpha = alpha;
            g.fillStyle = col;
            g.beginPath();
            g.arc(x, y, r, 0, Math.PI * 2);
            g.fill();
          } });
        }
      } else if (it.kind === 'poly') {
        const q = pts.map(px);
        if (q.length < 3) continue;
        prims.push({ depth: q.reduce((s, p) => s + p[2], 0) / q.length, draw: () => {
          g.globalAlpha = 1;
          g.beginPath();
          q.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y)));
          g.closePath();
          g.fillStyle = rgba(it.style.fill ? resolve_color(it.style.fill, env.look) : col, it.style.fill_alpha ?? m.fill_opacity ?? 0.15);
          g.fill();
          g.strokeStyle = rgba(col, alpha * 0.7);
          g.lineWidth = w;
          g.stroke();
        } });
      } else {
        // lines and arrows: each segment on its own, so a line passing behind a face is drawn behind it
        const q = pts.map(px);
        for (let i = 0; i + 1 < q.length; i++) {
          const [x0, y0, d0] = q[i], [x1, y1, d1] = q[i + 1], head = it.kind === 'arrow' && i === q.length - 2;
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
    prims.sort((a, b) => a.depth - b.depth);
    g.save();
    this.clip(env);
    g.lineCap = 'round';
    g.lineJoin = 'round';
    for (const p of prims) p.draw();
    g.restore();
    this.prims = prims;
    this.box = all.length ? bounds_of(all) : { x: 0, y: 0, w: 0, h: 0 };
  }
  override obstacles(): Obstacle[] {
    return [];
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
