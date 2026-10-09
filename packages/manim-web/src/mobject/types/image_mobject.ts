// manim/mobject/types/image_mobject.py
//
// web: pixel arrays are `{ width, height, data: Uint8ClampedArray }` (RGBA).
// Images given by name must be loaded first (`await preload_image(url)` or
// `register_image(name, ...)`, see utils/images.ts) because constructors are
// synchronous. Pixel arrays are never modified in place (copy on write), so
// scene snapshots can share them.
//
// Drawing reproduces Camera.display_image_mobject: the image is mapped onto
// the pixel quad of its corners with a perspective transform resampled like
// PIL's Image.transform (nearest / bilinear / bicubic, premultiplied alpha),
// then composited over the frame. The result is cached per camera while the
// image and its position do not change.
import { config } from '../../_config';
import type { Camera } from '../../camera/camera';
import { DEFAULT_QUALITY, DL, DR, QUALITIES, RESAMPLING_ALGORITHMS, UL, UR } from '../../constants';
import { ManimColor, color_to_int_rgb, type ParsableManimColor } from '../../utils/color/core';
import { WHITE, YELLOW_C } from '../../utils/color/manim_colors';
import {
  blank_pixel_array, change_to_rgba_array, context2d, create_canvas, get_full_raster_image_path, image_source_to_pixels, type AnyCanvas, type PixelArray,
} from '../../utils/images';
import { pyargs, type Kwargs } from '../../utils/pyargs';
import { register, registry } from '../../utils/registry';
import { fromList } from '../../utils/points';
import { Mobject } from '../mobject';

const NEAREST = 0, BILINEAR = 2, BICUBIC = 3;

/** Base class of mobjects drawn from a pixel array. */
export class AbstractImageMobject extends Mobject {
  declare pixel_array_dtype: string;
  declare scale_to_resolution: number | false;
  declare resampling_algorithm: number;
  /** web: marks image mobjects for the camera. */
  declare is_image_mobject: true;

  constructor(...args: unknown[]) {
    const o = pyargs(args, ['scale_to_resolution', 'pixel_array_dtype', 'resampling_algorithm'], { pixel_array_dtype: 'uint8', resampling_algorithm: BICUBIC });
    super(o);
  }
  protected override _init_attrs(kw: Kwargs): void {
    this.pixel_array_dtype = kw.pixel_array_dtype ?? 'uint8';
    this.scale_to_resolution = kw.scale_to_resolution;
    this.set_resampling_algorithm(kw.resampling_algorithm ?? BICUBIC);
    this.is_image_mobject = true;
    super._init_attrs(kw);
  }
  get_pixel_array(): PixelArray {
    throw new Error('NotImplementedError');
  }
  override set_color(..._args: unknown[]): this {
    throw new Error('NotImplementedError');
  }
  set_resampling_algorithm(resampling_algorithm: number): this {
    if (!Object.values(RESAMPLING_ALGORITHMS).includes(resampling_algorithm)) {
      throw new Error("resampling_algorithm has to be an int, one of the values defined in RESAMPLING_ALGORITHMS or a Pillow resampling filter constant. Available algorithms: 'bicubic' (or 'cubic'), 'nearest' (or 'none'), 'bilinear' (or 'linear').");
    }
    this.resampling_algorithm = resampling_algorithm;
    return this;
  }
  override reset_points(): this {
    this.points = fromList([UL, UR, DL, DR]);
    this.center();
    const { width: w, height: h } = this.get_pixel_array();
    const height = this.scale_to_resolution ? (h / this.scale_to_resolution) * config.frame_height : 3;
    this.stretch_to_fit_height(height);
    this.stretch_to_fit_width((height * w) / h);
    return this;
  }
  /** web: camera hook (see Camera.display). */
  draw_on_canvas(camera: Camera): void {
    display_image_mobject(camera, this);
  }
}

/** Displays an image from a pixel array (nested arrays, a PixelArray) or a preloaded file. */
export class ImageMobject extends AbstractImageMobject {
  declare fill_opacity: number;
  declare stroke_opacity: number;
  declare invert_image: boolean;
  declare image_mode: string;
  declare pixel_array: PixelArray;
  declare orig_alpha_pixel_array: Uint8ClampedArray;
  declare path?: string;

  constructor(...args: unknown[]) {
    const o = pyargs(args, ['filename_or_array', 'scale_to_resolution', 'invert', 'image_mode'], {
      scale_to_resolution: QUALITIES[DEFAULT_QUALITY].pixel_height, invert: false, image_mode: 'RGBA',
    });
    super(o);
  }
  protected override _init_attrs(kw: Kwargs): void {
    this.fill_opacity = 1;
    this.stroke_opacity = 1;
    this.invert_image = kw.invert ?? false;
    this.image_mode = kw.image_mode ?? 'RGBA';
    const src = kw.filename_or_array;
    let pa: PixelArray;
    if (typeof src === 'string') {
      pa = get_full_raster_image_path(src);
      this.path = src;
    } else if (src && typeof src === 'object' && !Array.isArray(src) && !ArrayBuffer.isView((src as any).data) && typeof (src as any).width === 'number') {
      pa = image_source_to_pixels(src as CanvasImageSource); // an <img>, ImageBitmap or canvas
    } else pa = src as PixelArray;
    this.pixel_array_dtype = kw.pixel_array_dtype ?? 'uint8';
    this.pixel_array = change_to_rgba_array(pa, this.pixel_array_dtype);
    if (this.invert_image) {
      const d = this.pixel_array.data;
      for (let i = 0; i < d.length; i += 4) for (let k = 0; k < 3; k++) d[i + k] = 255 - d[i + k];
    }
    this.orig_alpha_pixel_array = alpha_channel(this.pixel_array);
    super._init_attrs(kw);
  }
  override get_pixel_array(): PixelArray {
    return this.pixel_array;
  }
  override set_color(...args: unknown[]): this {
    const o = pyargs(args, ['color', 'alpha', 'family'], { color: YELLOW_C, alpha: null, family: true });
    const rgb = color_to_int_rgb(o.color);
    const pa = copy_pixels(this.pixel_array);
    const d = pa.data;
    for (let i = 0; i < d.length; i += 4) {
      d[i] = rgb[0];
      d[i + 1] = rgb[1];
      d[i + 2] = rgb[2];
      if (o.alpha !== null && o.alpha !== undefined) d[i + 3] = Math.trunc(255 * o.alpha);
    }
    this.pixel_array = pa;
    for (const submob of this.submobjects) submob.set_color(o.color, o.alpha, o.family);
    this._color = new ManimColor(o.color);
    return this;
  }
  set_opacity(alpha: number): this {
    const pa = copy_pixels(this.pixel_array);
    const d = pa.data, orig = this.orig_alpha_pixel_array;
    // numpy: uint8 = float (truncated)
    for (let i = 0, j = 3; i < orig.length; i++, j += 4) d[j] = Math.trunc(orig[i] * alpha);
    this.pixel_array = pa;
    this.stroke_opacity = alpha;
    return this;
  }
  override fade(darkness = 0.5, family = true): this {
    this.set_opacity(1 - darkness);
    super.fade(darkness, family);
    return this;
  }
  override interpolate_color(mobject1: Mobject, mobject2: Mobject, alpha: number): this {
    const m1 = mobject1 as ImageMobject, m2 = mobject2 as ImageMobject;
    if (!(m1 instanceof ImageMobject) || !(m2 instanceof ImageMobject)) throw new Error('interpolate_color: both mobjects must be ImageMobjects');
    const a = m1.pixel_array, b = m2.pixel_array;
    if (a.width !== b.width || a.height !== b.height) {
      throw new Error(`Mobject pixel array shapes incompatible for interpolation.\nMobject 1 (${m1}) : (${a.height}, ${a.width}, 4)\nMobject 2 (${m2}) : (${b.height}, ${b.width}, 4)`);
    }
    this.fill_opacity = (1 - alpha) * m1.fill_opacity + alpha * m2.fill_opacity;
    this.stroke_opacity = (1 - alpha) * m1.stroke_opacity + alpha * m2.stroke_opacity;
    if (alpha === 0 || alpha === 1) this.pixel_array = alpha === 0 ? a : b;
    else {
      const out = new Uint8ClampedArray(a.data.length);
      for (let i = 0; i < out.length; i++) out[i] = Math.trunc((1 - alpha) * a.data[i] + alpha * b.data[i]);
      this.pixel_array = { width: a.width, height: a.height, data: out };
    }
    return this;
  }
  get_style(): Kwargs {
    return { fill_color: ManimColor.parse(this.color.to_rgb()).to_hex(), fill_opacity: this.fill_opacity };
  }
}

/** Shows what another (moving) camera sees; used by ZoomedScene. */
export class ImageMobjectFromCamera extends AbstractImageMobject {
  declare camera: Camera;
  declare default_display_frame_config: Kwargs;
  declare display_frame?: Mobject;

  constructor(camera: Camera, ...rest: unknown[]) {
    const o = pyargs(rest, ['default_display_frame_config'], { default_display_frame_config: null });
    super({ ...o, camera, scale_to_resolution: false });
  }
  protected override _init_attrs(kw: Kwargs): void {
    this.camera = kw.camera;
    this.default_display_frame_config = kw.default_display_frame_config ?? { stroke_width: 3, stroke_color: WHITE, buff: 0 };
    super._init_attrs(kw);
  }
  /** The camera's current frame (read from its canvas). */
  override get_pixel_array(): PixelArray {
    const cam = this.camera;
    const ctx = cam.ctx;
    if (!ctx) return blank_pixel_array(cam.pixel_width, cam.pixel_height);
    const id = ctx.getImageData(0, 0, cam.pixel_width, cam.pixel_height);
    return { width: id.width, height: id.height, data: id.data };
  }
  get pixel_array(): PixelArray {
    return this.get_pixel_array();
  }
  add_display_frame(kw: Kwargs = {}): this {
    const cfg = { ...this.default_display_frame_config, ...kw };
    this.display_frame = new registry.SurroundingRectangle(this, cfg) as Mobject;
    this.add(this.display_frame);
    return this;
  }
  // web: manim interpolates a stale copy of the camera array here, which is never displayed
  // (get_pixel_array always reads the live camera), so this is a no-op.
  override interpolate_color(_mobject1: Mobject, _mobject2: Mobject, _alpha: number): this {
    return this;
  }
}

// ---------------------------------------------------------------- helpers
function alpha_channel(pa: PixelArray): Uint8ClampedArray {
  const out = new Uint8ClampedArray(pa.width * pa.height);
  for (let i = 0; i < out.length; i++) out[i] = pa.data[4 * i + 3];
  return out;
}
const copy_pixels = (pa: PixelArray): PixelArray => ({ width: pa.width, height: pa.height, data: new Uint8ClampedArray(pa.data) });

/** Solve A x = b (Gaussian elimination, partial pivoting); null if singular. */
function solve(A: number[][], b: number[]): number[] | null {
  const n = b.length;
  const M = A.map((row, i) => [...row, b[i]]);
  for (let c = 0; c < n; c++) {
    let p = c;
    for (let r = c + 1; r < n; r++) if (Math.abs(M[r][c]) > Math.abs(M[p][c])) p = r;
    if (M[p][c] === 0) return null;
    [M[c], M[p]] = [M[p], M[c]];
    for (let r = c + 1; r < n; r++) {
      const f = M[r][c] / M[c][c];
      if (f !== 0) for (let k = c; k <= n; k++) M[r][k] -= f * M[c][k];
    }
  }
  const x = new Array(n).fill(0);
  for (let r = n - 1; r >= 0; r--) {
    let s = M[r][n];
    for (let k = r + 1; k < n; k++) s -= M[r][k] * x[k];
    x[r] = s / M[r][r];
  }
  return x;
}

const premultiplied = new WeakMap<Uint8ClampedArray, Uint8ClampedArray>();
/** PIL RGBA -> RGBa (premultiplied, MULDIV255 rounding). */
function premultiply(data: Uint8ClampedArray): Uint8ClampedArray {
  let out = premultiplied.get(data);
  if (out) return out;
  let opaque = true;
  for (let i = 3; i < data.length; i += 4) if (data[i] !== 255) {
    opaque = false;
    break;
  }
  if (opaque) out = data;
  else {
    out = new Uint8ClampedArray(data.length);
    for (let i = 0; i < data.length; i += 4) {
      const a = data[i + 3];
      for (let k = 0; k < 3; k++) {
        const t = data[i + k] * a + 128;
        out[i + k] = ((t >> 8) + t) >> 8;
      }
      out[i + 3] = a;
    }
  }
  premultiplied.set(data, out);
  return out;
}

const cubic = (v1: number, v2: number, v3: number, v4: number, d: number): number =>
  v2 + d * (-v1 + v3 + d * (2 * (v1 - v2) + v3 - v4 + d * (-v1 + v2 - v3 + v4)));
const u8 = (v: number): number => (v <= 0 ? 0 : v >= 255 ? 255 : v | 0);

/**
 * PIL `Image.transform(PERSPECTIVE)` of `src` into `out` (the output box
 * pixels [x0, x1) x [y0, y1) of an image whose origin is (sx, sy)).
 */
export function pil_perspective_transform(
  src: PixelArray, coef: readonly number[], resample: number, sx: number, sy: number, x0: number, y0: number, x1: number, y1: number, out: Uint8ClampedArray,
): void {
  const W = src.width, H = src.height;
  const S = resample === NEAREST ? src.data : premultiply(src.data);
  const unpremul = S !== src.data;
  const [a0, a1, a2, a3, a4, a5, a6, a7] = coef;
  const ow = x1 - x0;
  const XC = (x: number) => (x < 0 ? 0 : x >= W ? W - 1 : x);
  const v = [0, 0, 0, 0];
  for (let Y = y0; Y < y1; Y++) {
    const yl = Y - sy + 0.5;
    for (let X = x0; X < x1; X++) {
      const xl = X - sx + 0.5;
      const den = a6 * xl + a7 * yl + 1;
      let xin = (a0 * xl + a1 * yl + a2) / den;
      let yin = (a3 * xl + a4 * yl + a5) / den;
      const o = 4 * ((Y - y0) * ow + (X - x0));
      if (resample === NEAREST) {
        const x = xin < 0 ? -1 : Math.trunc(xin), y = yin < 0 ? -1 : Math.trunc(yin);
        if (x < 0 || x >= W || y < 0 || y >= H) continue;
        const i = 4 * (y * W + x);
        out[o] = S[i];
        out[o + 1] = S[i + 1];
        out[o + 2] = S[i + 2];
        out[o + 3] = S[i + 3];
        continue;
      }
      if (!(xin >= 0 && xin < W && yin >= 0 && yin < H)) continue;
      xin -= 0.5;
      yin -= 0.5;
      let x = Math.floor(xin), y = Math.floor(yin);
      const dx = xin - x, dy = yin - y;
      if (resample === BILINEAR) {
        const i0 = 4 * XC(x), i1 = 4 * XC(x + 1);
        const r0 = 4 * W * (y < 0 ? 0 : y >= H ? H - 1 : y);
        const has2 = y + 1 >= 0 && y + 1 < H;
        const r1 = 4 * W * (y + 1);
        for (let b = 0; b < 4; b++) {
          const v1 = S[r0 + i0 + b] + (S[r0 + i1 + b] - S[r0 + i0 + b]) * dx;
          const v2 = has2 ? S[r1 + i0 + b] + (S[r1 + i1 + b] - S[r1 + i0 + b]) * dx : v1;
          v[b] = u8(v1 + (v2 - v1) * dy);
        }
      } else {
        x -= 1;
        y -= 1;
        const i0 = 4 * XC(x), i1 = 4 * XC(x + 1), i2 = 4 * XC(x + 2), i3 = 4 * XC(x + 3);
        const r0 = 4 * W * (y < 0 ? 0 : y >= H ? H - 1 : y);
        for (let b = 0; b < 4; b++) {
          const row = (r: number) => cubic(S[r + i0 + b], S[r + i1 + b], S[r + i2 + b], S[r + i3 + b], dx);
          const w1 = row(r0);
          const w2 = y + 1 >= 0 && y + 1 < H ? row(4 * W * (y + 1)) : w1;
          const w3 = y + 2 >= 0 && y + 2 < H ? row(4 * W * (y + 2)) : w2;
          const w4 = y + 3 >= 0 && y + 3 < H ? row(4 * W * (y + 3)) : w3;
          v[b] = u8(cubic(w1, w2, w3, w4, dy));
        }
      }
      if (unpremul) {
        // PIL RGBa -> RGBA: truncating division
        const a = v[3];
        if (a !== 255 && a !== 0) for (let b = 0; b < 3; b++) v[b] = Math.min(255, ((255 * v[b]) / a) | 0);
      }
      out[o] = v[0];
      out[o + 1] = v[1];
      out[o + 2] = v[2];
      out[o + 3] = v[3];
    }
  }
}

interface ImageDrawCache {
  key: unknown[];
  canvas: AnyCanvas | null;
  x: number;
  y: number;
}
const draw_caches = new WeakMap<object, WeakMap<object, ImageDrawCache>>();
const sameKey = (a: unknown[], b: unknown[]) => a.length === b.length && a.every((x, i) => x === b[i]);

/** Camera.display_image_mobject (PIL perspective resampling + alpha compositing). */
export function display_image_mobject(camera: Camera, image_mobject: AbstractImageMobject): void {
  const ctx = camera.ctx;
  if (!ctx) return;
  const pa = image_mobject.get_pixel_array();
  const target = camera.points_to_subpixel_coords(image_mobject, image_mobject.points);
  if (target.length < 4) return;
  const resample = image_mobject.resampling_algorithm;
  const pw = camera.pixel_width, ph = camera.pixel_height;
  const key: unknown[] = [pa, pa.data, resample, pw, ph, ...target.flat()];
  let per_cam = draw_caches.get(camera);
  if (!per_cam) draw_caches.set(camera, (per_cam = new WeakMap()));
  let cache = per_cam.get(image_mobject);
  if (!cache || !sameKey(cache.key, key)) {
    cache = render_image(camera, pa, target, resample, cache?.canvas ?? null);
    cache.key = key;
    per_cam.set(image_mobject, cache);
  }
  if (!cache.canvas) return;
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = 'source-over';
  ctx.drawImage(cache.canvas as CanvasImageSource, cache.x, cache.y);
  ctx.restore();
}

function render_image(camera: Camera, pa: PixelArray, target: [number, number][], resample: number, reuse: AnyCanvas | null): ImageDrawCache {
  const none: ImageDrawCache = { key: [], canvas: reuse, x: 0, y: 0 };
  if (resample !== NEAREST && resample !== BILINEAR && resample !== BICUBIC) throw new Error(`Image.transform: resampling filter ${resample} cannot be used (use nearest, bilinear or bicubic).`);
  const W = pa.width, H = pa.height;
  const original = [[0, 0], [W, 0], [0, H], [W, H]];
  const ints = target.map(([x, y]) => [Math.trunc(x), Math.trunc(y)]);
  const sx = Math.min(...ints.map((p) => p[0])), sy = Math.min(...ints.map((p) => p[1]));
  const t = target.map(([x, y]) => [x - sx, y - sy]);
  const it = ints.map(([x, y]) => [x - sx, y - sy]);
  const tw = Math.max(...it.map((p) => p[0])), th = Math.max(...it.map((p) => p[1]));
  const ordered = [0, 1, 3, 2].map((i) => t[i]);
  const sides = ordered.map((p, i) => [ordered[(i + 1) % 4][0] - p[0], ordered[(i + 1) % 4][1] - p[1]]);
  const lengths = sides.map(([x, y]) => Math.sqrt(x * x + y * y));
  let li = 0;
  for (let i = 1; i < 4; i++) if (lengths[i] > lengths[li]) li = i;
  const longest = sides[li], longest_len = lengths[li];
  if (longest_len === 0) return none;
  // like manim, the "next" side is the previous one again
  const prev = sides[(li + 3) % 4];
  const h = Math.abs(longest[0] * prev[1] - prev[0] * longest[1]) / longest_len;
  if (h < 0.5) return none;
  const A: number[][] = [];
  t.forEach(([x, y], i) => {
    const [X, Y] = original[i];
    A.push([x, y, 1, 0, 0, 0, -X * x, -X * y]);
    A.push([0, 0, 0, x, y, 1, -Y * x, -Y * y]);
  });
  const coef = solve(A, original.flat());
  if (!coef || tw <= 0 || th <= 0) return none;
  // only the part of the pasted box that lies on the frame
  const x0 = Math.max(0, sx), y0 = Math.max(0, sy);
  const x1 = Math.min(camera.pixel_width, sx + tw), y1 = Math.min(camera.pixel_height, sy + th);
  if (x1 <= x0 || y1 <= y0) return none;
  const w = x1 - x0, hh = y1 - y0;
  const canvas = reuse ?? create_canvas(w, hh, camera.canvas);
  if (canvas.width !== w || canvas.height !== hh) {
    canvas.width = w;
    canvas.height = hh;
  }
  const g = context2d(canvas);
  const id = g.createImageData(w, hh);
  pil_perspective_transform(pa, coef, resample, sx, sy, x0, y0, x1, y1, id.data);
  g.putImageData(id, 0, 0);
  return { key: [], canvas, x: x0, y: y0 };
}

register({ ImageMobjectFromCamera, AbstractImageMobject });
