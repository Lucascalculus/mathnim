// What manim drew that the engine's first kinds did not (the audit of what the lessons, the visuals and the tutor's
// answers use): shapes (circle, ellipse, arc, sector, polygon, rectangle, line, brace, right angle, angle), words and
// TeX at a point, a flash, an image, a stage in manim's own coordinates, a slider; and the motions manim gave them
// (Create, Write, GrowFrom…, Indicate, Flash, Transform). Each shape is a mark in a plot's data coordinates, drawn in
// its role's colour and material (or its style), so the grammar, the lint, the labels' avoidance and the DOM mirror
// work on it like on any other thing; each motion is a step of the script, so seeking stays exact.
import { color_of, look } from '@mathnim/look';
import { bounds_of, type Box, type XY } from './geom';
import { Mark, Plot, Readout, TextBlock, type PlotSpec } from './kinds';
import { Row, type Block } from './layout';
import { call, hide, over, reveal, seq, set, together, type Step } from './script';
import { param, read, type Param, type Val } from './state';
import { draw_tex, tex_size } from './tex';
import { font_css, font_of, text_width, tr, type L10n } from './text';
import { Thing, rgba, type DrawEnv, type Obstacle, type Style } from './thing';

type ShapeOpts = { id?: string; role?: string; says?: L10n; z?: number; style?: Style; closed?: boolean; grow_from?: GrowFrom };
/** Where a shape grows from (GrowFromCenter, GrowFromEdge, GrowFromPoint). */
export type GrowFrom = 'center' | 'left' | 'right' | 'top' | 'bottom' | XY;

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
function mix(a: string, b: string, t: number): string {
  const pa = parseInt(a.slice(1, 7), 16), pb = parseInt(b.slice(1, 7), 16);
  const ch = (n: number, k: number) => (n >> k) & 255;
  return '#' + [16, 8, 0].map((k) => Math.round(lerp(ch(pa, k), ch(pb, k), t)).toString(16).padStart(2, '0')).join('');
}
/** A polyline resampled to n points by length (so two outlines can be interpolated point for point). */
function resample(pl: XY[], n: number): XY[] {
  if (pl.length < 2) return Array.from({ length: n }, () => pl[0] ?? [0, 0]);
  const L: number[] = [0];
  for (let i = 1; i < pl.length; i++) L.push(L[i - 1] + Math.hypot(pl[i][0] - pl[i - 1][0], pl[i][1] - pl[i - 1][1]));
  const total = L[L.length - 1] || 1, out: XY[] = [];
  for (let k = 0, j = 1; k < n; k++) {
    const s = (total * k) / (n - 1);
    while (j < pl.length - 1 && L[j] < s) j++;
    const t = (s - L[j - 1]) / ((L[j] - L[j - 1]) || 1);
    out.push([lerp(pl[j - 1][0], pl[j][0], t), lerp(pl[j - 1][1], pl[j][1], t)]);
  }
  return out;
}
/** The first share u of a polyline, by length (a shape being drawn on). */
function cut(pl: XY[], u: number): XY[] {
  if (u >= 1 || pl.length < 2) return pl;
  let total = 0;
  for (let i = 1; i < pl.length; i++) total += Math.hypot(pl[i][0] - pl[i - 1][0], pl[i][1] - pl[i - 1][1]);
  let left = total * Math.max(0, u);
  const out: XY[] = [pl[0]];
  for (let i = 1; i < pl.length && left > 0; i++) {
    const d = Math.hypot(pl[i][0] - pl[i - 1][0], pl[i][1] - pl[i - 1][1]);
    out.push(d <= left ? pl[i] : [lerp(pl[i - 1][0], pl[i][0], left / d), lerp(pl[i - 1][1], pl[i][1], left / d)]);
    left -= d;
  }
  return out;
}

/**
 * A shape: an outline (polylines in CSS px, from the plot's coordinates) stroked in its role's colour and, when closed
 * and asked (a `region` role, or a style fill), filled. Four params carry manim's motions: `drawn` (Create: how much
 * of the outline is drawn; the fill comes in at the end), `scale` (GrowFrom…: its size about where it grows from),
 * `pulse` (Indicate: bigger and brighter, then back), `morph` (Transform: how far it has become `morph_to`).
 */
export abstract class Shape extends Mark {
  kind = 'shape';
  readonly drawn: Param<number>;
  readonly scale: Param<number>;
  readonly pulse: Param<number>;
  readonly morph: Param<number>;
  morph_to: Shape | null = null;
  closed: boolean;
  grow_from: GrowFrom;
  protected px: XY[][] = [];
  constructor(o: ShapeOpts = {}) {
    super({ ...o, z: o.z ?? 2.5 });
    this.closed = o.closed ?? false;
    this.grow_from = o.grow_from ?? 'center';
    this.drawn = param(1, { name: `${this.id}.drawn`, range: [0, 1] });
    this.scale = param(1, { name: `${this.id}.scale`, range: [0, 1] });
    this.pulse = param(0, { name: `${this.id}.pulse`, range: [0, 1] });
    this.morph = param(0, { name: `${this.id}.morph`, range: [0, 1] });
  }
  /** The outline in CSS px (several polylines may make one shape). */
  abstract path(P: Plot): XY[][];
  protected fills(): boolean {
    return this.closed && (this.style.fill !== undefined || this.style.fill_alpha !== undefined || this.role.startsWith('region'));
  }
  draw(env: DrawEnv): void {
    const P = this.plot, g = env.g, m = this.material;
    let polys = this.path(P);
    const mk = this.morph.value;
    if (this.morph_to && mk > 0) {
      // (both outlines resampled to the same points: the shape slides into the other)
      const to = this.morph_to.path(P), n = Math.max(polys.length, to.length);
      polys = Array.from({ length: n }, (_, i) => {
        const a = polys[Math.min(i, polys.length - 1)] ?? [], b = to[Math.min(i, to.length - 1)] ?? [];
        const N = Math.max(48, a.length, b.length), ra = resample(a, N), rb = resample(b, N);
        return ra.map((p, k) => [lerp(p[0], rb[k][0], mk), lerp(p[1], rb[k][1], mk)] as XY);
      });
    }
    const all = polys.flat();
    if (!all.length) {
      this.box = { x: 0, y: 0, w: 0, h: 0 };
      this.px = [];
      return;
    }
    const k = this.scale.value * (1 + 0.2 * this.pulse.value);
    if (k !== 1) {
      const b = bounds_of(all), gf = this.grow_from;
      const [ox, oy] = Array.isArray(gf) ? P.P(gf) : gf === 'left' ? [b.x, b.y + b.h / 2] : gf === 'right' ? [b.x + b.w, b.y + b.h / 2] : gf === 'top' ? [b.x + b.w / 2, b.y] : gf === 'bottom' ? [b.x + b.w / 2, b.y + b.h] : [b.x + b.w / 2, b.y + b.h / 2];
      const about = this.pulse.value > 0 && this.scale.value >= 1 ? [b.x + b.w / 2, b.y + b.h / 2] : [ox, oy];
      polys = polys.map((pl) => pl.map(([x, y]) => [about[0] + (x - about[0]) * k, about[1] + (y - about[1]) * k] as XY));
    }
    const u = this.drawn.value;
    this.px = u < 1 ? polys.map((pl) => cut(this.closed ? [...pl, pl[0]] : pl, u)) : polys;
    let col = this.color;
    if (this.pulse.value > 0) col = mix(col, env.look.palette.vermilion, 0.6 * this.pulse.value);
    g.save();
    if ((this as { o?: { clip?: boolean } }).o?.clip !== false) this.clip(env);
    g.lineJoin = 'round';
    g.lineCap = 'round';
    if (this.fills() && u > 0) {
      g.beginPath();
      for (const pl of polys) pl.forEach((p, i) => (i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1])));
      g.closePath();
      const fc = this.style.fill ? this.fill_color : col;
      g.fillStyle = rgba(fc, (this.style.fill_alpha ?? m.fill_opacity ?? 0.12) * (u >= 1 ? 1 : Math.max(0, (u - 0.7) / 0.3)));
      g.fill();
    }
    if ((m.stroke ?? 2) > 0) {
      g.strokeStyle = col;
      g.lineWidth = m.stroke ?? 2;
      g.setLineDash(m.dash ?? []);
      g.globalAlpha *= m.stroke_opacity ?? 1;
      g.beginPath();
      for (const pl of this.px) pl.forEach((p, i) => (i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1])));
      if (this.closed && u >= 1) g.closePath();
      g.stroke();
    }
    g.restore();
    this.box = bounds_of(all);
  }
  override obstacles(): Obstacle[] {
    const out: Obstacle[] = [];
    for (const pl of this.px) {
      const step = Math.max(1, Math.floor(pl.length / 32));
      for (let i = 0; i + step < pl.length; i += step) out.push({ seg: [pl[i], pl[i + step]], weight: 0.8 });
    }
    return out;
  }
  /** Its centre (labels attach here). */
  where(): XY | null {
    return this.box.w ? [this.box.x + this.box.w / 2, this.box.y + this.box.h / 2] : null;
  }
}

const arc_pts = (P: Plot, c: XY, rx: number, ry: number, a0: number, a1: number, rot = 0): XY[] => {
  const n = Math.max(16, Math.ceil((Math.abs(a1 - a0) / (2 * Math.PI)) * 96));
  return Array.from({ length: n + 1 }, (_, i) => {
    const a = a0 + ((a1 - a0) * i) / n, x = rx * Math.cos(a), y = ry * Math.sin(a);
    return P.P([c[0] + x * Math.cos(rot) - y * Math.sin(rot), c[1] + x * Math.sin(rot) + y * Math.cos(rot)]);
  });
};

/** A circle (data units; a circle on an equal-aspect plot). */
export class Circle extends Shape {
  constructor(public center: Val<XY>, public r: Val<number>, o: ShapeOpts = {}) {
    super({ ...o, closed: true });
  }
  path(P: Plot): XY[][] {
    const r = read(this.r);
    return r > 0 ? [arc_pts(P, read(this.center), r, r, 0, 2 * Math.PI).slice(0, -1)] : [];
  }
}
/** An ellipse with semi-axes rx, ry, turned by `angle` radians. */
export class Ellipse extends Shape {
  constructor(public center: Val<XY>, public rx: Val<number>, public ry: Val<number>, public angle: Val<number> = 0, o: ShapeOpts = {}) {
    super({ ...o, closed: true });
  }
  path(P: Plot): XY[][] {
    return [arc_pts(P, read(this.center), read(this.rx), read(this.ry), 0, 2 * Math.PI, read(this.angle)).slice(0, -1)];
  }
}
/** An arc of a circle from angle a0 to a1 (radians, counter-clockwise). */
export class Arc extends Shape {
  constructor(public center: Val<XY>, public r: Val<number>, public a0: Val<number>, public a1: Val<number>, o: ShapeOpts = {}) {
    super(o);
  }
  path(P: Plot): XY[][] {
    return [arc_pts(P, read(this.center), read(this.r), read(this.r), read(this.a0), read(this.a1))];
  }
}
/** A slice of a disc (a pizza slice): the arc and its two radii. */
export class Sector extends Shape {
  constructor(public center: Val<XY>, public r: Val<number>, public a0: Val<number>, public a1: Val<number>, o: ShapeOpts = {}) {
    super({ ...o, closed: true });
  }
  path(P: Plot): XY[][] {
    const c = read(this.center);
    return [[P.P(c), ...arc_pts(P, c, read(this.r), read(this.r), read(this.a0), read(this.a1))]];
  }
}
/** A polygon through points (closed), or a polyline (`closed: false`). */
export class Polygon extends Shape {
  constructor(public pts: Val<XY[]>, o: ShapeOpts = {}) {
    super({ closed: true, ...o });
  }
  path(P: Plot): XY[][] {
    const pts = read(this.pts);
    return pts.length ? [pts.map((p) => P.P(p))] : [];
  }
}
/** A rectangle from corner to corner, with rounded corners (`corner`, CSS px). */
export class Rect extends Shape {
  constructor(public a: Val<XY>, public b: Val<XY>, public o2: ShapeOpts & { corner?: number } = {}) {
    super({ ...o2, closed: true });
  }
  path(P: Plot): XY[][] {
    const [x0, y0] = P.P(read(this.a)), [x1, y1] = P.P(read(this.b));
    const l = Math.min(x0, x1), r = Math.max(x0, x1), t = Math.min(y0, y1), btm = Math.max(y0, y1);
    const c = Math.min(this.o2.corner ?? 0, (r - l) / 2, (btm - t) / 2);
    if (c <= 0.5) return [[[l, t], [r, t], [r, btm], [l, btm]]];
    const q = (cx: number, cy: number, a0: number): XY[] => Array.from({ length: 7 }, (_, i) => {
      const a = a0 + (Math.PI / 2) * (i / 6);
      return [cx + c * Math.cos(a), cy + c * Math.sin(a)] as XY;
    });
    return [[...q(r - c, t + c, -Math.PI / 2), ...q(r - c, btm - c, 0), ...q(l + c, btm - c, Math.PI / 2), ...q(l + c, t + c, Math.PI)]];
  }
}
/** A straight line (dashed through its style or a `predicted` role). */
export class Line extends Shape {
  constructor(public a: Val<XY>, public b: Val<XY>, o: ShapeOpts = {}) {
    super(o);
  }
  path(P: Plot): XY[][] {
    return [[P.P(read(this.a)), P.P(read(this.b))]];
  }
}
/** A curly brace along a → b, its point to the right of the direction a → b (as manim's: under a segment drawn left to right); `tip()` is where its label goes. */
export class Brace extends Shape {
  constructor(public a: Val<XY>, public b: Val<XY>, public o2: ShapeOpts & { depth?: number } = {}) {
    super({ ...o2, role: o2.role ?? 'text' });
  }
  private geo(P: Plot) {
    const A = P.P(read(this.a)), B = P.P(read(this.b)), L = Math.hypot(B[0] - A[0], B[1] - A[1]) || 1;
    const u: XY = [(B[0] - A[0]) / L, (B[1] - A[1]) / L], n: XY = [-u[1], u[0]], d = this.o2.depth ?? Math.min(12, L * 0.18);
    return { A, B, L, u, n, d };
  }
  path(P: Plot): XY[][] {
    const { A, L, u, n, d } = this.geo(P);
    const at = (s: number, h: number): XY => [A[0] + u[0] * s + n[0] * h, A[1] + u[1] * s + n[1] * h];
    // two halves, each a quarter turn out, a straight run, and a quarter turn into the point
    const half = (s0: number, dir: number): XY[] => {
      const out: XY[] = [], r = Math.min(d / 2, L / 8);
      for (let i = 0; i <= 6; i++) {
        const a = (Math.PI / 2) * (i / 6);
        out.push(at(s0 + dir * r * Math.sin(a), (d / 2) * (1 - Math.cos(a))));
      }
      const mid = L / 2;
      out.push(at(mid - dir * r, d / 2));
      for (let i = 0; i <= 6; i++) {
        const a = (Math.PI / 2) * (i / 6);
        out.push(at(mid - dir * r + dir * r * Math.sin(a), d / 2 + (d / 2) * (1 - Math.cos(a))));
      }
      return out;
    };
    const left = half(0, 1), right = half(L, -1).reverse();
    return [[...left, ...right]];
  }
  /** The point of the brace (CSS px), for its label. */
  tip(): XY | null {
    if (!this.plot || !this.box.w) return null;
    const { A, L, u, n, d } = this.geo(this.plot);
    return [A[0] + u[0] * (L / 2) + n[0] * (d + 4), A[1] + u[1] * (L / 2) + n[1] * (d + 4)];
  }
  override where(): XY | null {
    return this.tip();
  }
}
/** The square mark of a right angle at a corner, along the directions to p and q (CSS px size). */
export class RightAngle extends Shape {
  constructor(public corner: Val<XY>, public p: Val<XY>, public q: Val<XY>, public size = 12, o: ShapeOpts = {}) {
    super(o);
  }
  path(P: Plot): XY[][] {
    const C = P.P(read(this.corner)), dir = (X: XY) => {
      const v = P.P(X), L = Math.hypot(v[0] - C[0], v[1] - C[1]) || 1;
      return [(v[0] - C[0]) / L, (v[1] - C[1]) / L] as XY;
    };
    const a = dir(read(this.p)), b = dir(read(this.q)), s = this.size;
    return [[[C[0] + a[0] * s, C[1] + a[1] * s], [C[0] + (a[0] + b[0]) * s, C[1] + (a[1] + b[1]) * s], [C[0] + b[0] * s, C[1] + b[1] * s]]];
  }
}
/** The arc marking the angle at `corner` from the direction of p to that of q (CSS px radius). */
export class Angle extends Shape {
  constructor(public corner: Val<XY>, public p: Val<XY>, public q: Val<XY>, public radius = 22, o: ShapeOpts = {}) {
    super(o);
  }
  path(P: Plot): XY[][] {
    const C = P.P(read(this.corner)), A = P.P(read(this.p)), B = P.P(read(this.q));
    let a0 = Math.atan2(A[1] - C[1], A[0] - C[0]), a1 = Math.atan2(B[1] - C[1], B[0] - C[0]);
    // (the smaller way round)
    let d = a1 - a0;
    while (d > Math.PI) d -= 2 * Math.PI;
    while (d < -Math.PI) d += 2 * Math.PI;
    a1 = a0 + d;
    const n = 24;
    return [Array.from({ length: n + 1 }, (_, i) => [C[0] + this.radius * Math.cos(a0 + (d * i) / n), C[1] + this.radius * Math.sin(a0 + (d * i) / n)] as XY)];
  }
}

/**
 * Words or TeX at a point of a plot (manim's MathTex / Text / DecimalNumber placed with move_to): `align` says which
 * part of it sits on the point. `drawn` writes it on from the left (Write), `pulse` lifts it (Indicate).
 */
export class TexMark extends Mark {
  kind = 'tex';
  readonly drawn: Param<number>;
  readonly pulse: Param<number>;
  constructor(public content: Val<string | L10n>, public at: Val<XY>, public o: { id?: string; role?: string; says?: L10n; z?: number; style?: Style; tex?: boolean; align?: 'left' | 'center' | 'right'; valign?: 'center' | 'top' | 'bottom' | 'baseline' } = {}) {
    super({ ...o, z: o.z ?? 5 });
    this.drawn = param(1, { name: `${this.id}.drawn`, range: [0, 1] });
    this.pulse = param(0, { name: `${this.id}.pulse`, range: [0, 1] });
  }
  private s(lang: 'en' | 'zh'): string {
    return tr(read(this.content), lang);
  }
  px(): number {
    return this.style.size ?? look().type.label.size * (this.o.tex === false ? 1 : look().type.tex_scale);
  }
  draw(env: DrawEnv): void {
    const s = this.s(env.lang);
    if (!s) {
      this.box = { x: 0, y: 0, w: 0, h: 0 };
      return;
    }
    const px = this.px() * (1 + 0.2 * this.pulse.value), tex = this.o.tex !== false, f = font_of('label', { size: px, weight: this.style.weight ?? 400, family: this.style.family });
    const sz = tex ? tex_size(s, px) : { w: text_width(s, f), asc: px * 0.75, desc: px * 0.25 };
    const [x, y] = this.plot.P(read(this.at));
    const x0 = this.o.align === 'left' ? x : this.o.align === 'right' ? x - sz.w : x - sz.w / 2;
    const va = this.o.valign ?? 'center', base = va === 'baseline' ? y : va === 'top' ? y + sz.asc : va === 'bottom' ? y - sz.desc : y + (sz.asc - sz.desc) / 2;
    this.box = { x: x0, y: base - sz.asc, w: sz.w, h: sz.asc + sz.desc };
    const g = env.g, u = this.drawn.value;
    let col = this.text_color;
    if (this.pulse.value > 0) col = mix(col, env.look.palette.vermilion, 0.6 * this.pulse.value);
    g.save();
    if (u < 1) {
      g.beginPath();
      g.rect(x0 - 2, this.box.y - 4, (sz.w + 4) * Math.max(0, u), this.box.h + 8);
      g.clip();
    }
    if (tex) draw_tex(g, s, x0, base, px, col);
    else {
      g.font = font_css(f);
      g.fillStyle = col;
      g.textBaseline = 'alphabetic';
      g.fillText(s, x0, base);
    }
    g.restore();
  }
  override text(lang: 'en' | 'zh'): string {
    return this.s(lang);
  }
  override text_px(): number {
    return this.px();
  }
  where(): XY | null {
    return this.box.w ? [this.box.x + this.box.w / 2, this.box.y + this.box.h / 2] : null;
  }
}

/** A flash at a point (manim's Flash): short rays that fly out and fade; `t` runs it 0 → 1. */
export class Flash extends Mark {
  kind = 'flash';
  readonly t: Param<number>;
  constructor(public at: Val<XY>, public o: { id?: string; role?: string; z?: number; style?: Style; rays?: number; radius?: number } = {}) {
    super({ ...o, role: o.role ?? 'verb', z: o.z ?? 7 });
    this.t = param(0, { name: `${this.id}.t`, range: [0, 1] });
  }
  draw(env: DrawEnv): void {
    const t = this.t.value;
    if (t <= 0 || t >= 1) {
      this.box = { x: 0, y: 0, w: 0, h: 0 };
      return;
    }
    const [x, y] = this.plot.P(read(this.at)), n = this.o.rays ?? 12, R = this.o.radius ?? 28, g = env.g;
    const r0 = R * (0.25 + 0.75 * t), r1 = R * (0.45 + 0.75 * t) - R * 0.35 * t;
    g.save();
    g.strokeStyle = this.color;
    g.lineWidth = this.style.width ?? 2.5;
    g.lineCap = 'round';
    g.globalAlpha *= 1 - t;
    g.beginPath();
    for (let i = 0; i < n; i++) {
      const a = (2 * Math.PI * i) / n;
      g.moveTo(x + r0 * Math.cos(a), y + r0 * Math.sin(a));
      g.lineTo(x + Math.max(r0, r1) * Math.cos(a), y + Math.max(r0, r1) * Math.sin(a));
    }
    g.stroke();
    g.restore();
    this.box = { x: x - R * 1.2, y: y - R * 1.2, w: R * 2.4, h: R * 2.4 };
  }
  override obstacles(): Obstacle[] {
    return [];
  }
}

/** An image in a box of a plot's coordinates (a photo, a rendered diagram); drawn once it has loaded. */
export class ImageMark extends Mark {
  kind = 'image';
  private img: CanvasImageSource | null = null;
  private loaded: Param<number>;
  constructor(src: string | CanvasImageSource, public a: Val<XY>, public b: Val<XY>, o: { id?: string; says?: L10n; z?: number; style?: Style } = {}) {
    super({ ...o, role: 'text', z: o.z ?? 1.4 });
    this.loaded = param(0, { name: `${this.id}.loaded` });
    if (typeof src !== 'string') {
      this.img = src;
      this.loaded.set(1);
    } else if (typeof Image !== 'undefined') {
      const im = new Image();
      im.onload = () => {
        this.img = im;
        this.loaded.set(this.loaded.peek() + 1);
      };
      im.src = src;
    }
  }
  draw(env: DrawEnv): void {
    void this.loaded.value;
    const [x0, y0] = this.plot.P(read(this.a)), [x1, y1] = this.plot.P(read(this.b));
    this.box = { x: Math.min(x0, x1), y: Math.min(y0, y1), w: Math.abs(x1 - x0), h: Math.abs(y1 - y0) };
    if (!this.img) return;
    env.g.save();
    if (this.style.alpha !== undefined) env.g.globalAlpha *= this.style.alpha;
    env.g.drawImage(this.img, this.box.x, this.box.y, this.box.w, this.box.h);
    env.g.restore();
  }
}

/** A stage in manim's own coordinates (x −7.11..7.11, y −4..4, nothing drawn): place shapes where a scene put them. */
export function stage(o: Partial<PlotSpec> = {}): Plot {
  return new Plot({ id: 'stage', x: [-64 / 9, 64 / 9], y: [-4, 4], aspect: 'equal', axes: 'none', numbers: false, grid: false, data_box: true, ...o });
}

/**
 * A slider (manim-web's Slider): a short track with a glass handle that moves one param, its name, and its value. Built
 * from a flat plot and a handle, so the hand, the keyboard, the tutor and the DOM mirror all work on it.
 */
export function slider(fig: { handle: (P: Plot, px: Param<number>, py: null, o?: { id?: string; says?: L10n; on_end?: () => void }) => unknown }, p: Param<number>, o: { id?: string; label: string | L10n; tex?: boolean; decimals?: number; on_end?: () => void; ticks?: number[] }): Block & { plot: Plot } {
  const id = o.id ?? `${p.name}_slider`, r = p.spec.range ?? [0, 1];
  const plot = new Plot({ id: `${id}_track`, x: r, y: [0, 1], x_ticks: o.ticks ?? r, grid: false, axes: 'x', aspect: 9, max_aspect: 0.2 });
  const name = o.tex ? new Readout([{ tex: typeof o.label === 'string' ? o.label : o.label.en }], { id: `${id}_name`, kind: 'label' }) : new TextBlock(o.label, { id: `${id}_name`, kind: 'label' });
  const value = new Readout([{ value: () => p.value, decimals: o.decimals ?? 2 }], { id: `${id}_value`, kind: 'label' });
  fig.handle(plot, p, null, { id: `${id}_handle`, says: typeof o.label === 'string' ? { en: o.label, zh: o.label } : o.label, on_end: o.on_end });
  const row = new Row([name, plot, value], { weights: [1, 3, 0.7], gap: 10, phone: 'row', align: 'center' });
  return Object.assign(row, { plot });
}

// ------------------------------------------------------------------ the motions, as steps

type Drawable = { drawn: Param<number> } & Thing;
/** Draw shapes on (manim's Create; a filled shape's fill comes in at the end, as DrawBorderThenFill). */
export function create(...xs: Drawable[]): Step {
  for (const x of xs) x.drawn.set(0, true);
  return together(reveal(...xs), ...xs.map((x) => set(x.drawn, 1, 'draw')));
}
/** Undraw them (Uncreate). */
export function uncreate(...xs: Drawable[]): Step {
  return seq(together(...xs.map((x) => set(x.drawn, 0, 'draw'))), over(0.001, hide(...xs)));
}
/** Write words or TeX on, left to right (manim's Write). */
export function write(...xs: (TexMark | Drawable)[]): Step {
  for (const x of xs) x.drawn.set(0, true);
  return together(reveal(...xs), ...xs.map((x) => set(x.drawn, 1, 'write')));
}
/** Grow shapes from their centre, an edge or a point (GrowFromCenter, GrowFromEdge, GrowFromPoint, GrowArrow). */
export function grow(from: GrowFrom, ...xs: Shape[]): Step {
  for (const x of xs) {
    x.grow_from = from;
    x.scale.set(0, true);
  }
  return together(reveal(...xs), ...xs.map((x) => set(x.scale, 1, 'grow')));
}
/** Draw the eye to things: a little bigger and warmer, then back (manim's Indicate). */
export function indicate(...xs: ({ pulse: Param<number> } & Thing)[]): Step {
  return call(0.9, (u) => {
    for (const x of xs) x.pulse.set(u >= 1 ? 0 : Math.sin(Math.PI * u), true);
  }, xs.map((x) => x.pulse));
}
/** A flash at a point of a plot (manim's Flash): the mark is added to the plot here. */
export function flash(P: Plot, at: Val<XY>, o: { id?: string; role?: string; rays?: number; radius?: number } = {}): Step {
  const f = P.add(new Flash(at, o));
  return set(f.t, 1, 'linear', 0.6);
}
/**
 * One shape becomes another (manim's Transform / ReplacementTransform): `a` slides into `b`'s outline, then `b` takes
 * its place. `b` must be in the figure (added to a plot); it is shown only at the end.
 */
export function transform(a: Shape, b: Shape, dur?: number): Step {
  a.morph_to = b;
  return seq(set(a.morph, 1, 'travel', dur), over(0.001, together(hide(a), reveal(b))));
}
/** Words become other words (TransformMatchingTex, simply): one fades out as the other fades in. */
export function crossfade(a: Thing, b: Thing, dur = 0.8): Step {
  return over(dur, together(hide(a), reveal(b)));
}
/** A colour for a thing's role (for kits drawing their own). */
export const role_color = (role: string): string => color_of(role);
export type { Box };
