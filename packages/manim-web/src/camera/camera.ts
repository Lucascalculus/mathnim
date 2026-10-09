// manim/camera/camera.py - Canvas 2D port of manim's Cairo camera.
//
// web: draws into a CanvasRenderingContext2D instead of a numpy pixel array.
// Path construction, fill/stroke order, line widths and gradients follow the
// Cairo implementation. Optional visual effects (see docs/EXTENSIONS.md) are
// applied when `effects` is set; without them output matches manim.
import { config } from '../_config';
import { ORIGIN } from '../constants';
import { Mobject } from '../mobject/mobject';
import { VMobject, type RGBA } from '../mobject/types/vectorized_mobject';
import { ManimColor, type ParsableManimColor } from '../utils/color/core';
import { extract_mobject_family_members } from '../utils/family';
import { create_canvas, get_full_raster_image_path, pixels_to_canvas, type PixelArray } from '../utils/images';
import type { Points } from '../utils/points';
import { to3, type Point3D, type Point3DLike } from '../utils/vector';

export interface CameraEffects {
  background?: { kind: 'solid'; color: string } | { kind: 'linear'; top: string; bottom: string } | { kind: 'radial'; inner: string; outer: string } | { kind: 'paper'; color: string; edge: string };
  dotGrid?: { spacing: number; color: string; radius: number };
  grain?: number;
  vignette?: number;
  /** Default glow radius (px at 1080p) for mobjects with `glow = true`. */
  glow?: number;
  lineCap?: CanvasLineCap;
  lineJoin?: CanvasLineJoin;
}

export interface CameraOptions {
  canvas?: HTMLCanvasElement | OffscreenCanvas | null;
  frame_center?: Point3DLike;
  pixel_width?: number;
  pixel_height?: number;
  frame_width?: number;
  frame_height?: number;
  frame_rate?: number;
  background_color?: ParsableManimColor;
  background_opacity?: number;
  use_z_index?: boolean;
  cairo_line_width_multiple?: number;
  effects?: CameraEffects | null;
}

type Ctx = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;

export class Camera {
  canvas: HTMLCanvasElement | OffscreenCanvas | null;
  ctx: Ctx | null;
  frame_center: Point3D;
  pixel_width: number;
  pixel_height: number;
  frame_width: number;
  frame_height: number;
  frame_rate: number;
  use_z_index: boolean;
  cairo_line_width_multiple: number;
  effects: CameraEffects | null;
  max_allowable_norm: number;
  protected _background_color: ManimColor;
  protected _background_opacity: number;
  private _noise: CanvasPattern | null = null;
  private _bg_scratch: HTMLCanvasElement | OffscreenCanvas | null = null;
  private _bg_scratch2: HTMLCanvasElement | OffscreenCanvas | null = null;
  private _bg_scratch_hi: HTMLCanvasElement | OffscreenCanvas | null = null;
  private _bg_scratch_mid: HTMLCanvasElement | OffscreenCanvas | null = null;

  constructor(o: CameraOptions = {}) {
    this.canvas = o.canvas ?? null;
    this.ctx = (this.canvas?.getContext('2d') as Ctx) ?? null;
    this.frame_center = to3(o.frame_center ?? ORIGIN);
    this.pixel_width = o.pixel_width ?? (this.canvas?.width || config.pixel_width);
    this.pixel_height = o.pixel_height ?? (this.canvas?.height || config.pixel_height);
    this.frame_height = o.frame_height ?? config.frame_height;
    this.frame_width = o.frame_width ?? config.frame_width;
    this.frame_rate = o.frame_rate ?? config.frame_rate;
    this.use_z_index = o.use_z_index ?? true;
    this.cairo_line_width_multiple = o.cairo_line_width_multiple ?? 0.01;
    this.effects = o.effects ?? null;
    this._background_color = ManimColor.parse(o.background_color ?? config.background_color);
    this._background_opacity = o.background_opacity ?? config.background_opacity;
    this.max_allowable_norm = config.frame_width;
    this.resize_frame_shape();
  }

  get background_color(): ManimColor {
    return this._background_color;
  }
  set background_color(c: ParsableManimColor) {
    this._background_color = ManimColor.parse(c);
  }
  get background_opacity(): number {
    return this._background_opacity;
  }
  set background_opacity(a: number) {
    this._background_opacity = a;
  }

  /** Attach (or replace) the canvas that frames are drawn into. */
  set_canvas(canvas: HTMLCanvasElement | OffscreenCanvas): void {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d') as Ctx;
    this.pixel_width = canvas.width;
    this.pixel_height = canvas.height;
    this.resize_frame_shape();
  }
  resize_frame_shape(fixed_dimension = 0): void {
    const aspect = this.pixel_width / this.pixel_height;
    if (fixed_dimension === 0) this.frame_height = this.frame_width / aspect;
    else this.frame_width = aspect * this.frame_height;
  }

  // ---------------------------------------------------------------- frame
  /** Clear to the background (colour, or an effects background). */
  reset(): this {
    const ctx = this.ctx;
    if (!ctx) return this;
    const pw = this.pixel_width, ph = this.pixel_height;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1;
    ctx.clearRect(0, 0, pw, ph);
    const bg = this.effects?.background;
    if (!bg) {
      ctx.fillStyle = this._background_color.to_css(this._background_opacity);
      ctx.fillRect(0, 0, pw, ph);
    } else if (bg.kind === 'solid') {
      ctx.fillStyle = bg.color;
      ctx.fillRect(0, 0, pw, ph);
    } else if (bg.kind === 'linear') {
      const g = ctx.createLinearGradient(0, 0, 0, ph);
      g.addColorStop(0, bg.top);
      g.addColorStop(1, bg.bottom);
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, pw, ph);
    } else if (bg.kind === 'radial') {
      const g = ctx.createRadialGradient(pw * 0.42, ph * 0.38, 0, pw * 0.5, ph * 0.5, pw * 0.75);
      g.addColorStop(0, bg.inner);
      g.addColorStop(1, bg.outer);
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, pw, ph);
    } else if (bg.kind === 'paper') {
      ctx.fillStyle = bg.color;
      ctx.fillRect(0, 0, pw, ph);
      const g = ctx.createRadialGradient(pw * 0.5, ph * 0.45, pw * 0.2, pw * 0.5, ph * 0.5, pw * 0.8);
      g.addColorStop(0, 'rgba(255,255,255,0.35)');
      g.addColorStop(1, bg.edge);
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, pw, ph);
    }
    const grid = this.effects?.dotGrid;
    if (grid) {
      const k = pw / 1920;
      ctx.fillStyle = grid.color;
      const step = grid.spacing * (pw / this.frame_width);
      for (let x = (pw / 2) % step; x < pw; x += step)
        for (let y = (ph / 2) % step; y < ph; y += step) ctx.fillRect(x - grid.radius * k, y - grid.radius * k, 2 * grid.radius * k, 2 * grid.radius * k);
    }
    return this;
  }

  get_mobjects_to_display(mobjects: Mobject[], include_submobjects = true, excluded_mobjects: Mobject[] | null = null): Mobject[] {
    if (!include_submobjects) return mobjects.slice();
    let mobs = extract_mobject_family_members(mobjects, this.use_z_index, true);
    if (excluded_mobjects && excluded_mobjects.length) {
      const ex = new Set(extract_mobject_family_members(excluded_mobjects, this.use_z_index));
      mobs = mobs.filter((m) => !ex.has(m));
    }
    return mobs;
  }
  is_in_frame(mobject: Mobject): boolean {
    const fc = this.frame_center, fh = this.frame_height, fw = this.frame_width;
    return !(mobject.get_right()[0] < fc[0] - fw / 2 || mobject.get_bottom()[1] > fc[1] + fh / 2 || mobject.get_left()[0] > fc[0] + fw / 2 || mobject.get_top()[1] < fc[1] - fh / 2);
  }
  capture_mobject(mobject: Mobject, kw: { include_submobjects?: boolean; excluded_mobjects?: Mobject[] } = {}): void {
    this.capture_mobjects([mobject], kw);
  }
  /** Draw mobjects (and their families) on top of the current frame. */
  capture_mobjects(mobjects: Mobject[], kw: { include_submobjects?: boolean; excluded_mobjects?: Mobject[] } = {}): void {
    if (!this.ctx) return;
    const mobs = this.get_mobjects_to_display(mobjects, kw.include_submobjects ?? true, kw.excluded_mobjects ?? null);
    for (let i = 0; i < mobs.length; i++) {
      // consecutive VMobjects coloured by the same background image are drawn as one batch (like Cairo)
      const img = mobs[i] instanceof VMobject ? (mobs[i] as VMobject).background_image : null;
      if (!img) {
        this.display(mobs[i]);
        continue;
      }
      let j = i;
      while (j + 1 < mobs.length && mobs[j + 1] instanceof VMobject && (mobs[j + 1] as VMobject).background_image === img) j++;
      this.display_multiple_background_colored_vmobjects(mobs.slice(i, j + 1) as VMobject[]);
      i = j;
    }
  }
  /** Cairo's BackgroundColoredVMobjectDisplayer: shapes drawn in white, then coloured by the image stretched over the frame. */
  display_multiple_background_colored_vmobjects(cvmobjects: VMobject[]): void {
    const ctx = this.ctx!, pw = this.pixel_width, ph = this.pixel_height;
    const img = background_image_source(cvmobjects[0].background_image, this.canvas);
    if (!this._bg_scratch || this._bg_scratch.width !== pw || this._bg_scratch.height !== ph) this._bg_scratch = create_canvas(pw, ph, this.canvas);
    const sctx = this._bg_scratch.getContext('2d') as Ctx;
    sctx.setTransform(1, 0, 0, 1, 0, 0);
    sctx.globalCompositeOperation = 'source-over';
    sctx.clearRect(0, 0, pw, ph);
    // Skia draws sub-pixel strokes as faded 1px hairlines while Cairo computes their geometric
    // coverage; the mask is squared below, so thin strokes are drawn supersampled instead.
    let thinnest = Infinity;
    for (const vm of cvmobjects) {
      const w = vm.get_stroke_width() * this.cairo_line_width_multiple * this.pixels_per_unit;
      if (w > 0 && w < thinnest) thinnest = w;
    }
    const ss = thinnest >= 1 || !Number.isFinite(thinnest) ? 1 : thinnest >= 0.5 ? 2 : 4;
    let mctx: Ctx = sctx;
    if (ss > 1) {
      if (!this._bg_scratch_hi || this._bg_scratch_hi.width !== pw * ss || this._bg_scratch_hi.height !== ph * ss) this._bg_scratch_hi = create_canvas(pw * ss, ph * ss, this.canvas);
      mctx = this._bg_scratch_hi.getContext('2d') as Ctx;
      mctx.setTransform(1, 0, 0, 1, 0, 0);
      mctx.globalCompositeOperation = 'source-over';
      mctx.clearRect(0, 0, pw * ss, ph * ss);
      this.pixel_width = pw * ss;
      this.pixel_height = ph * ss;
    }
    this.ctx = mctx;
    try {
      for (const vm of cvmobjects) this.display_vectorized(vm);
    } finally {
      this.ctx = ctx;
      this.pixel_width = pw;
      this.pixel_height = ph;
    }
    // box-filter down by halving (a bilinear 1/2 scale averages each 2x2 block exactly)
    let src = this._bg_scratch_hi as HTMLCanvasElement | OffscreenCanvas;
    for (let k = ss; k > 1; k /= 2) {
      let dst: HTMLCanvasElement | OffscreenCanvas;
      if (k === 2) dst = this._bg_scratch;
      else {
        if (!this._bg_scratch_mid || this._bg_scratch_mid.width !== (pw * k) / 2 || this._bg_scratch_mid.height !== (ph * k) / 2) this._bg_scratch_mid = create_canvas((pw * k) / 2, (ph * k) / 2, this.canvas);
        dst = this._bg_scratch_mid;
      }
      const dctx = dst.getContext('2d') as Ctx;
      dctx.setTransform(1, 0, 0, 1, 0, 0);
      dctx.globalCompositeOperation = 'source-over';
      if (dst !== this._bg_scratch) dctx.clearRect(0, 0, dst.width, dst.height);
      dctx.imageSmoothingEnabled = true;
      dctx.imageSmoothingQuality = 'low';
      dctx.drawImage(src as CanvasImageSource, 0, 0, dst.width, dst.height);
      src = dst;
    }
    // Cairo's white mask is premultiplied (coverage a in every channel) and manim multiplies it by the
    // image, then composites it as straight RGBA: colour image * a with alpha a. Emulated with a
    // second layer of black at alpha (1 - a) drawn 'source-atop'.
    if (!this._bg_scratch2 || this._bg_scratch2.width !== pw || this._bg_scratch2.height !== ph) this._bg_scratch2 = create_canvas(pw, ph, this.canvas);
    const tctx = this._bg_scratch2.getContext('2d') as Ctx;
    tctx.setTransform(1, 0, 0, 1, 0, 0);
    tctx.globalCompositeOperation = 'source-over';
    tctx.fillStyle = '#000';
    tctx.fillRect(0, 0, pw, ph);
    tctx.globalCompositeOperation = 'destination-out';
    tctx.drawImage(this._bg_scratch as CanvasImageSource, 0, 0);
    tctx.globalCompositeOperation = 'source-over';
    sctx.setTransform(1, 0, 0, 1, 0, 0);
    sctx.globalCompositeOperation = 'source-in';
    sctx.imageSmoothingEnabled = true;
    sctx.drawImage(img as CanvasImageSource, 0, 0, pw, ph);
    sctx.globalCompositeOperation = 'source-atop';
    sctx.drawImage(this._bg_scratch2 as CanvasImageSource, 0, 0);
    sctx.globalCompositeOperation = 'source-over';
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.drawImage(this._bg_scratch as CanvasImageSource, 0, 0);
    ctx.restore();
  }
  /** reset + capture + overlays: one complete frame. */
  render_frame(mobjects: Mobject[], kw: { excluded_mobjects?: Mobject[] } = {}): void {
    this.reset();
    this.capture_mobjects(mobjects, kw);
    this.draw_overlays();
  }

  protected display(m: Mobject): void {
    const custom = (m as any).draw_on_canvas;
    if (typeof custom === 'function') {
      custom.call(m, this);
      return;
    }
    if (m instanceof VMobject) this.display_vectorized(m);
    else if ((m as any).is_image_mobject) this.display_image_mobject(m);
    else if ((m as any).is_point_cloud) this.display_point_cloud(m);
  }

  // ---------------------------------------------------------------- coordinates
  transform_points_pre_display(_mobject: Mobject, points: Points): Points {
    for (let i = 0; i < points.length; i++) if (!Number.isFinite(points[i])) return new Float64Array(3);
    return points;
  }
  /** Set the canvas transform so drawing happens in manim units. */
  set_world_transform(): void {
    const pw = this.pixel_width, ph = this.pixel_height, fw = this.frame_width, fh = this.frame_height, fc = this.frame_center;
    this.ctx!.setTransform(pw / fw, 0, 0, -(ph / fh), pw / 2 - fc[0] * (pw / fw), ph / 2 + fc[1] * (ph / fh));
  }
  points_to_subpixel_coords(mobject: Mobject, points: Points): [number, number][] {
    const p = this.transform_points_pre_display(mobject, points);
    const out: [number, number][] = [];
    const wm = this.pixel_width / this.frame_width, hm = -this.pixel_height / this.frame_height;
    for (let i = 0; i < p.length; i += 3) out.push([(p[i] - this.frame_center[0]) * wm + this.pixel_width / 2, (p[i + 1] - this.frame_center[1]) * hm + this.pixel_height / 2]);
    return out;
  }
  points_to_pixel_coords(mobject: Mobject, points: Points): [number, number][] {
    return this.points_to_subpixel_coords(mobject, points).map(([x, y]) => [Math.trunc(x), Math.trunc(y)]);
  }
  /** Pixels per manim unit. */
  get pixels_per_unit(): number {
    return this.pixel_width / this.frame_width;
  }

  // ---------------------------------------------------------------- vectorized
  display_vectorized(vm: VMobject): void {
    const ctx = this.ctx!;
    const points = this.transform_points_pre_display(vm, vm.points);
    if (points.length === 0) return;
    // web: Cairo's 24.8 fixed point cannot hold device coordinates beyond ±2^23 px and drops the whole path
    const wm = this.pixel_width / this.frame_width, hm = this.pixel_height / this.frame_height;
    for (let i = 0; i < points.length; i += 3) {
      if (Math.abs((points[i] - this.frame_center[0]) * wm + this.pixel_width / 2) >= 8388608 || Math.abs((this.frame_center[1] - points[i + 1]) * hm + this.pixel_height / 2) >= 8388608) return;
    }
    this.set_world_transform();
    if (!this.set_path(vm, points)) return;
    const cs = +vm.cap_style, jt = +vm.joint_type;
    const cap = cs === 1 ? 'round' : cs === 2 ? 'butt' : cs === 3 ? 'square' : this.effects?.lineCap ?? 'butt';
    const join = jt === 1 ? 'round' : jt === 2 ? 'bevel' : jt === 3 ? 'miter' : this.effects?.lineJoin ?? 'miter';
    ctx.lineCap = cap;
    ctx.lineJoin = join;
    this.apply_stroke(vm, true);
    this.apply_fill(vm);
    this.apply_stroke(vm, false);
  }
  /** manim set_cairo_context_path: subpaths split where anchors differ (in 2D). */
  protected set_path(vm: VMobject, p: Points): boolean {
    const ctx = this.ctx!;
    ctx.beginPath();
    const splits = vm.get_subpath_split_indices_from_points(p, 2);
    if (!splits.length) return false;
    const atol = vm.tolerance_for_point_equality, rtol = 1e-5;
    for (const [a, b] of splits) {
      if (b - a < 4) continue;
      ctx.moveTo(p[3 * a], p[3 * a + 1]);
      for (let i = a; i <= b - 4; i += 4) {
        const k = 3 * (i + 1);
        ctx.bezierCurveTo(p[k], p[k + 1], p[k + 3], p[k + 4], p[k + 6], p[k + 7]);
      }
      const x0 = p[3 * a], y0 = p[3 * a + 1], x1 = p[3 * (b - 1)], y1 = p[3 * (b - 1) + 1];
      const closeX = x0 === x1 || Math.abs(x0 - x1) <= atol + rtol * Math.abs(x1);
      const closeY = y0 === y1 || Math.abs(y0 - y1) <= atol + rtol * Math.abs(y1);
      if (closeX && closeY) ctx.closePath();
    }
    return true;
  }
  protected style_for(vm: VMobject, rgbas: RGBA[]): string | CanvasGradient {
    if (rgbas.length === 1) return rgbaCss(rgbas[0]);
    let [s, e] = vm.get_gradient_start_and_end_points();
    // manim projects the gradient end points too (ThreeDCamera)
    const q = this.transform_points_pre_display(vm, Float64Array.of(s[0], s[1], s[2], e[0], e[1], e[2]));
    if (q.length >= 6) [s, e] = [[q[0], q[1], q[2]], [q[3], q[4], q[5]]];
    const g = this.ctx!.createLinearGradient(s[0], s[1], e[0], e[1]);
    rgbas.forEach((c, i) => g.addColorStop(rgbas.length === 1 ? 0 : i / (rgbas.length - 1), rgbaCss(c)));
    return g;
  }
  /** Fill colours to draw with (ThreeDCamera shades them). */
  get_fill_rgbas(vm: VMobject): RGBA[] {
    return vm.get_fill_rgbas();
  }
  /** Stroke colours to draw with (ThreeDCamera shades them). */
  get_stroke_rgbas(vm: VMobject, background = false): RGBA[] {
    return vm.get_stroke_rgbas(background);
  }
  protected apply_fill(vm: VMobject): void {
    const rgbas = this.get_fill_rgbas(vm);
    if (rgbas.every((c) => c[3] <= 0)) return;
    const ctx = this.ctx!;
    ctx.fillStyle = this.style_for(vm, rgbas);
    const shadow = (vm as any).shadow as { color: string; blur: number; offsetY?: number } | undefined;
    if (shadow) {
      const k = this.pixel_width / 1920;
      ctx.save();
      ctx.shadowColor = shadow.color;
      ctx.shadowBlur = shadow.blur * k;
      ctx.shadowOffsetY = (shadow.offsetY ?? 0) * k;
      ctx.fill();
      ctx.restore();
    } else ctx.fill();
  }
  protected apply_stroke(vm: VMobject, background: boolean): void {
    const width = vm.get_stroke_width(background);
    if (width === 0) return;
    const rgbas = this.get_stroke_rgbas(vm, background);
    if (rgbas.every((c) => c[3] <= 0)) return;
    const ctx = this.ctx!;
    const w = width * this.cairo_line_width_multiple;
    const glowSetting = (vm as any).glow;
    const glow = background ? 0 : glowSetting === true ? this.effects?.glow ?? 12 : typeof glowSetting === 'number' ? glowSetting : 0;
    if (glow) {
      // cheap glow: wide faint strokes under the crisp one (shadowBlur is ~50x slower)
      const pxPerUnit1080 = (this.pixel_width / this.frame_width) / (this.pixel_width / 1920);
      for (const [mult, a] of [[1.6, 0.045], [0.95, 0.08], [0.5, 0.14]]) {
        ctx.lineWidth = Math.max(w, (glow * mult) / pxPerUnit1080);
        ctx.strokeStyle = this.style_for(vm, rgbas.map((c) => [c[0], c[1], c[2], c[3] * a] as RGBA));
        ctx.stroke();
      }
    }
    ctx.lineWidth = w;
    ctx.strokeStyle = this.style_for(vm, rgbas);
    ctx.stroke();
  }

  // ---------------------------------------------------------------- other mobject kinds
  protected display_point_cloud(pm: any): void {
    const ctx = this.ctx!;
    const coords = this.points_to_pixel_coords(pm, pm.points);
    const rgbas: RGBA[] = pm.rgbas;
    const t = this.adjusted_thickness(pm.stroke_width ?? 1);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    coords.forEach(([x, y], i) => {
      const c = rgbas[Math.min(i, rgbas.length - 1)];
      ctx.fillStyle = rgbaCss(c);
      ctx.fillRect(x - t / 2, y - t / 2, t, t);
    });
  }
  protected display_image_mobject(im: any): void {
    const img: CanvasImageSource | null = im.get_image_source?.() ?? null;
    if (!img) return;
    const ctx = this.ctx!;
    const [ul, ur, dl] = this.points_to_subpixel_coords(im, im.points);
    const w = (img as any).width, h = (img as any).height;
    ctx.save();
    ctx.setTransform((ur[0] - ul[0]) / w, (ur[1] - ul[1]) / w, (dl[0] - ul[0]) / h, (dl[1] - ul[1]) / h, ul[0], ul[1]);
    ctx.globalAlpha = im.get_opacity?.() ?? 1;
    ctx.imageSmoothingEnabled = im.resampling_algorithm !== 'nearest';
    ctx.drawImage(img, 0, 0);
    ctx.restore();
  }
  adjusted_thickness(thickness: number): number {
    const big = config.pixel_height + config.pixel_width;
    const cur = this.pixel_height + this.pixel_width;
    return 1 + (thickness - 1) * (big / cur);
  }

  // ---------------------------------------------------------------- effects overlays
  draw_overlays(): void {
    const e = this.effects, ctx = this.ctx;
    if (!e || !ctx) return;
    const pw = this.pixel_width, ph = this.pixel_height;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    if (e.vignette) {
      const g = ctx.createRadialGradient(pw / 2, ph / 2, ph * 0.45, pw / 2, ph / 2, pw * 0.72);
      const dark = e.background?.kind === 'paper' ? '90,62,25' : '0,0,0';
      g.addColorStop(0, `rgba(${dark},0)`);
      g.addColorStop(1, `rgba(${dark},${e.vignette})`);
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, pw, ph);
    }
    if (e.grain) {
      ctx.globalAlpha = e.grain;
      ctx.globalCompositeOperation = 'overlay';
      ctx.fillStyle = this.noiseTile();
      ctx.fillRect(0, 0, pw, ph);
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'source-over';
    }
  }
  private noiseTile(): CanvasPattern {
    if (this._noise) return this._noise;
    const c = typeof OffscreenCanvas !== 'undefined' ? new OffscreenCanvas(256, 256) : Object.assign(document.createElement('canvas'), { width: 256, height: 256 });
    const x = c.getContext('2d') as Ctx;
    const img = x.createImageData(256, 256);
    let seed = 1234567;
    const rnd = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
    for (let i = 0; i < img.data.length; i += 4) {
      const v = 128 + (rnd() - 0.5) * 180;
      img.data[i] = img.data[i + 1] = img.data[i + 2] = v;
      img.data[i + 3] = 255;
    }
    x.putImageData(img, 0, 0);
    this._noise = this.ctx!.createPattern(c as any, 'repeat')!;
    return this._noise;
  }
}

/** A drawable for a VMobject's background_image: a PixelArray, a preloaded image name or a CanvasImageSource. */
function background_image_source(image: unknown, like: unknown): unknown {
  if (typeof image === 'string') return pixels_to_canvas(get_full_raster_image_path(image), like);
  if (image && typeof image === 'object' && ArrayBuffer.isView((image as PixelArray).data)) return pixels_to_canvas(image as PixelArray, like);
  return image;
}

export const rgbaCss = (c: readonly number[]): string =>
  `rgba(${Math.round(Math.max(0, Math.min(1, c[0])) * 255)},${Math.round(Math.max(0, Math.min(1, c[1])) * 255)},${Math.round(Math.max(0, Math.min(1, c[2])) * 255)},${Math.max(0, Math.min(1, c[3]))})`;
