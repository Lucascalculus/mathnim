// manim/utils/images.py, plus the web plumbing for raster images: RGBA pixel
// arrays, a preload cache (constructors are synchronous) and scratch canvases
// that work in browsers, workers and node (@napi-rs/canvas).

/** An RGBA uint8 image, row-major (manim's (h, w, 4) numpy pixel array). */
export interface PixelArray {
  width: number;
  height: number;
  data: Uint8ClampedArray;
}
export type AnyCanvas = HTMLCanvasElement | OffscreenCanvas;
type Ctx2D = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;

let canvas_factory: ((width: number, height: number) => AnyCanvas) | null = null;
/** web: override how scratch canvases are created (e.g. in node without a canvas to copy). */
export function set_canvas_factory(factory: ((width: number, height: number) => AnyCanvas) | null): void {
  canvas_factory = factory;
}
/** web: a new canvas; in node the constructor of `like` (an existing canvas) is reused. */
export function create_canvas(width: number, height: number, like?: unknown): AnyCanvas {
  width = Math.max(1, Math.trunc(width));
  height = Math.max(1, Math.trunc(height));
  if (canvas_factory) return canvas_factory(width, height);
  if (typeof OffscreenCanvas !== 'undefined') return new OffscreenCanvas(width, height);
  if (typeof document !== 'undefined') return Object.assign(document.createElement('canvas'), { width, height });
  const C = (like as any)?.constructor;
  if (typeof C === 'function' && C !== Object) {
    const c = new C(width, height);
    if (typeof c?.getContext === 'function') return c as AnyCanvas;
  }
  throw new Error('manim-web: no canvas implementation available; call set_canvas_factory(...)');
}
export const context2d = (c: AnyCanvas): Ctx2D => c.getContext('2d') as Ctx2D;

/** An all-zero (transparent) pixel array. */
export const blank_pixel_array = (width: number, height: number): PixelArray => ({ width, height, data: new Uint8ClampedArray(4 * width * height) });

const isPixelArray = (x: any): x is PixelArray => !!x && typeof x === 'object' && typeof x.width === 'number' && typeof x.height === 'number' && ArrayBuffer.isView(x.data);

/**
 * Converts an image to RGBA (manim's change_to_rgba_array): accepts nested
 * arrays of shape (h, w), (h, w, 1), (h, w, 3) or (h, w, 4), or a PixelArray.
 */
export function change_to_rgba_array(image: unknown, _dtype = 'uint8'): PixelArray {
  if (isPixelArray(image)) {
    const n = image.width * image.height;
    if (image.data.length === 4 * n) return { width: image.width, height: image.height, data: new Uint8ClampedArray(image.data) };
    const ch = image.data.length / n;
    const out = new Uint8ClampedArray(4 * n);
    for (let i = 0; i < n; i++) {
      for (let k = 0; k < 3; k++) out[4 * i + k] = image.data[ch * i + (ch >= 3 ? k : 0)];
      out[4 * i + 3] = ch === 4 ? image.data[ch * i + 3] : 255;
    }
    return { width: image.width, height: image.height, data: out };
  }
  const rows = Array.from(image as ArrayLike<unknown>);
  const height = rows.length;
  const width = height ? Array.from(rows[0] as ArrayLike<unknown>).length : 0;
  const data = new Uint8ClampedArray(4 * width * height);
  // numpy uint8 arrays wrap modulo 256; values are truncated like astype
  const u8 = (v: unknown) => ((Math.trunc(Number(v)) % 256) + 256) % 256;
  rows.forEach((row, y) => {
    Array.from(row as ArrayLike<unknown>).forEach((px, x) => {
      const o = 4 * (y * width + x);
      if (typeof px === 'number' || !(px as any)?.length) {
        data[o] = data[o + 1] = data[o + 2] = u8(px);
        data[o + 3] = 255;
      } else {
        const c = Array.from(px as ArrayLike<unknown>);
        if (c.length === 1) data[o] = data[o + 1] = data[o + 2] = u8(c[0]);
        else for (let k = 0; k < 3; k++) data[o + k] = u8(c[k]);
        data[o + 3] = c.length === 4 ? u8(c[3]) : 255;
      }
    });
  });
  return { width, height, data };
}

/** 255 - rgb (alpha kept), like manim's invert_image. */
export function invert_image(image: PixelArray): PixelArray {
  const data = new Uint8ClampedArray(image.data);
  for (let i = 0; i < data.length; i += 4) for (let k = 0; k < 3; k++) data[i + k] = 255 - data[i + k];
  return { width: image.width, height: image.height, data };
}

/** Accumulates non-zero pixels over successive frames (manim's drag_pixels). */
export function drag_pixels(frames: PixelArray[]): PixelArray[] {
  const curr = new Uint8ClampedArray(frames[0].data);
  return frames.map((f) => {
    for (let i = 0; i < curr.length; i++) if (curr[i] === 0) curr[i] = f.data[i];
    return { width: f.width, height: f.height, data: new Uint8ClampedArray(curr) };
  });
}

// ---------------------------------------------------------------- canvas <-> pixels
/** Reads a CanvasImageSource (image, bitmap, canvas) into RGBA pixels. */
export function image_source_to_pixels(src: CanvasImageSource, like?: unknown): PixelArray {
  const w = (src as any).naturalWidth || (src as any).width, h = (src as any).naturalHeight || (src as any).height;
  const c = create_canvas(w, h, like);
  const g = context2d(c);
  g.drawImage(src, 0, 0);
  const id = g.getImageData(0, 0, w, h);
  return { width: w, height: h, data: new Uint8ClampedArray(id.data.buffer, id.data.byteOffset, id.data.length) };
}
const canvasCache = new WeakMap<object, AnyCanvas>();
/** A canvas holding `pixels` (cached per pixel array object). */
export function pixels_to_canvas(pixels: PixelArray, like?: unknown): AnyCanvas {
  let c = canvasCache.get(pixels);
  if (c) return c;
  c = create_canvas(pixels.width, pixels.height, like);
  const g = context2d(c);
  const id = g.createImageData(pixels.width, pixels.height);
  id.data.set(pixels.data);
  g.putImageData(id, 0, 0);
  canvasCache.set(pixels, c);
  return c;
}

// ---------------------------------------------------------------- preloading
const IMAGE_CACHE = new Map<string, PixelArray>();
let image_loader: ((src: string) => Promise<CanvasImageSource | PixelArray>) | null = null;

/** web: set how preload_image() decodes a URL/path (e.g. `loadImage` from @napi-rs/canvas in node). */
export function set_image_loader(loader: ((src: string) => Promise<CanvasImageSource | PixelArray>) | null): void {
  image_loader = loader;
}
/** web: make an image available to the synchronous ImageMobject constructor under `name`. */
export function register_image(name: string, image: PixelArray | CanvasImageSource | unknown[]): PixelArray {
  const pa = isPixelArray(image) || Array.isArray(image) ? change_to_rgba_array(image) : image_source_to_pixels(image as CanvasImageSource);
  IMAGE_CACHE.set(name, pa);
  return pa;
}
/** web: fetch and decode an image once, so that `ImageMobject(src)` can be constructed synchronously. */
export async function preload_image(src: string, name: string = src): Promise<PixelArray> {
  const hit = IMAGE_CACHE.get(name);
  if (hit) return hit;
  let img: CanvasImageSource | PixelArray;
  if (image_loader) img = await image_loader(src);
  else if (typeof createImageBitmap !== 'undefined' && typeof fetch !== 'undefined') img = await createImageBitmap(await (await fetch(src)).blob());
  else throw new Error('manim-web: cannot load images here; call set_image_loader(...) first');
  return register_image(name, img as PixelArray | CanvasImageSource);
}
/** web: the pixels registered or preloaded under `name` (manim looks the file up on disk). */
export function get_full_raster_image_path(image_file_name: string): PixelArray {
  const hit = IMAGE_CACHE.get(String(image_file_name));
  if (!hit) throw new Error(`Image '${image_file_name}' is not loaded: in manim-web call \`await preload_image('${image_file_name}')\` (or register_image) before constructing it.`);
  return hit;
}
