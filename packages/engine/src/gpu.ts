/// <reference types="@webgpu/types" />
// The GPU tier: a Field shades a scalar field over a plot's data area (a cost bowl, a potential, a density) with a
// soft tint of its noun and anti-aliased level lines, one pixel per device pixel. It is computed by WebGPU when the
// device has it, by WebGL2 otherwise, and by the CPU (at half resolution, smoothed) where there is no GPU at all
// (node tools, the doctor, old devices). All three tiers draw the same picture from the same formula; the 2D canvas
// stays the base, and a field is just a mark in it (docs/design/ENGINE.md §4.2: GPU tiers are enhancements).
//
//   P.add(new Field(quadratic(() => [cx, cy, H11, H12, H22]), { role: 'noun:cost', levels: [1, 2, 3], range: [0, 8] }));
import { look } from '@mathnim/look';
import { Mark } from './kinds';
import { make_canvas } from './render';
import { read, type Val } from './state';
import type { DrawEnv, Obstacle } from './thing';
import type { L10n } from './text';

export type Tier = 'webgpu' | 'webgl2' | 'cpu';

/** A field: how to compute it in each tier. `u` holds up to 16 numbers (its uniforms). */
export interface FieldKind {
  name: string;
  /** GLSL ES 3.0: the body of `float field(vec2 p)`; the uniforms are `float u(int i)`. */
  glsl: string;
  /** WGSL: the body of `fn field(p: vec2f) -> f32`; the uniforms are `uu(i)`. (Optional: without it WebGL2 is used.) */
  wgsl?: string;
  /** The same field on the CPU (and the ground truth the tests compare the GPU tiers with). */
  cpu: (x: number, y: number, u: Float32Array) => number;
  uniforms: Val<number[]>;
}

/** √((p − c)ᵀ A (p − c)): the radius of a quadratic bowl around c (u = [cx, cy, a11, a12, a22]). */
export const quadratic = (uniforms: Val<number[]>): FieldKind => ({
  name: 'quadratic',
  glsl: 'vec2 d = p - vec2(u(0), u(1)); return sqrt(max(0.0, d.x * (u(2) * d.x + u(3) * d.y) + d.y * (u(3) * d.x + u(4) * d.y)));',
  wgsl: 'let d = p - vec2f(uu(0), uu(1)); return sqrt(max(0.0, d.x * (uu(2) * d.x + uu(3) * d.y) + d.y * (uu(3) * d.x + uu(4) * d.y)));',
  cpu: (x, y, u) => {
    const dx = x - u[0], dy = y - u[1];
    return Math.sqrt(Math.max(0, dx * (u[2] * dx + u[3] * dy) + dy * (u[3] * dx + u[4] * dy)));
  },
  uniforms,
});

// ------------------------------------------------------------------ the tier
let tier: Tier | null = null;
let forced: Tier | null = null;
let gpu_dev: GPUDevice | null = null;
let gpu_init: Promise<void> | null = null;
/** Use this tier (tests, tools, a setting); null: the best the device has. */
export function set_gpu_tier(t: Tier | null): void {
  forced = t;
  tier = null;
}
/** The tier fields draw with now. */
export function gpu_tier(): Tier {
  if (forced) return forced === 'webgpu' && !gpu_dev ? (gl() ? 'webgl2' : 'cpu') : forced;
  if (tier) return tier;
  tier = gpu_dev ? 'webgpu' : gl() ? 'webgl2' : 'cpu';
  return tier;
}
/** Ask for a WebGPU device (once; a player does this before its first frame when the figure has fields). */
export function init_gpu(): Promise<void> {
  if (gpu_init) return gpu_init;
  const nav = typeof navigator !== 'undefined' ? (navigator as Navigator & { gpu?: GPU }) : null;
  gpu_init = (async () => {
    if (!nav?.gpu || forced === 'webgl2' || forced === 'cpu') return;
    try {
      const ad = await nav.gpu.requestAdapter({ powerPreference: 'low-power' });
      gpu_dev = (await ad?.requestDevice()) ?? null;
      gpu_dev?.lost.then(() => {
        gpu_dev = null;
        tier = null;
        wg = null;
      });
      // trust it only once it has drawn: clear a tiny WebGPU canvas to a known colour, copy it into a 2D canvas the
      // way a field is drawn, and read it back (some drivers and headless browsers hand out a device that cannot)
      if (gpu_dev && !self_test()) {
        console.warn('engine: WebGPU did not pass its self-test; fields draw with WebGL2');
        gpu_dev.destroy();
        gpu_dev = null;
        wg = null;
      }
      tier = null;
    } catch {
      gpu_dev = null;
    }
  })();
  return gpu_init;
}

/** Can a WebGPU canvas be drawn into a 2D canvas here, and does the 2D canvas still work afterwards? */
function self_test(): boolean {
  try {
    const W = webgpu();
    if (!W || !gpu_dev) return false;
    W.c.width = 4;
    W.c.height = 4;
    W.ctx.configure({ device: gpu_dev, format: W.fmt, alphaMode: 'premultiplied' });
    const enc = gpu_dev.createCommandEncoder();
    enc.beginRenderPass({ colorAttachments: [{ view: W.ctx.getCurrentTexture().createView(), loadOp: 'clear', storeOp: 'store', clearValue: { r: 1, g: 0, b: 0, a: 1 } }] }).end();
    gpu_dev.queue.submit([enc.finish()]);
    const c = new OffscreenCanvas(4, 4), g = c.getContext('2d', { willReadFrequently: true }) as OffscreenCanvasRenderingContext2D;
    g.drawImage(W.c, 0, 0);
    const a = g.getImageData(1, 1, 1, 1).data;
    g.fillStyle = '#0000ff';
    g.fillRect(0, 0, 4, 4);
    const b = g.getImageData(1, 1, 1, 1).data;
    return a[0] > 200 && a[1] < 40 && a[3] > 200 && b[2] > 200 && b[0] < 40;
  } catch {
    return false;
  }
}

// ------------------------------------------------------------------ the uniforms every tier reads
// U[0] data x0 x1 y0 y1 · U[1] w h line_px n_levels · U[2] tint rgb, fill alpha · U[3] (unused rgb), line alpha ·
// U[4] v0 v1 mode invert · U[5..6] levels · U[7..10] the field's own u[16] · U[11] spare
const N_VEC4 = 12;
const SHADE_GLSL = `
float shade(float v) {
  float a = U[4].x, b = U[4].y;
  float t = U[4].z > 0.5 ? (sqrt(max(v, 0.0)) - sqrt(max(a, 0.0))) / max(1e-6, sqrt(max(b, 0.0)) - sqrt(max(a, 0.0))) : (v - a) / max(1e-6, b - a);
  t = clamp(t, 0.0, 1.0);
  return U[4].w > 0.5 ? 1.0 - t : t;
}`;
const GLSL_FS = (body: string) => `#version 300 es
precision highp float;
uniform vec4 U[${N_VEC4}];
in vec2 uv;
out vec4 o;
float u(int i) { return U[7 + i / 4][i % 4]; }
float field(vec2 p) { ${body} }
${SHADE_GLSL}
void main() {
  vec2 p = vec2(mix(U[0].x, U[0].y, uv.x), mix(U[0].z, U[0].w, uv.y));
  float v = field(p);
  float fw = max(fwidth(v), 1e-6);
  float line = 0.0;
  for (int k = 0; k < 8; k++) {
    if (float(k) >= U[1].w) break;
    float L = U[5 + k / 4][k % 4];
    float d = abs(v - L) / fw;
    line = max(line, 1.0 - smoothstep(U[1].z * 0.5 - 0.5, U[1].z * 0.5 + 0.5, d));
  }
  float a = U[2].w * shade(v);
  float la = line * U[3].w;
  float A = a + la * (1.0 - a);
  o = vec4(U[2].rgb * A, A);
}`;
const GLSL_VS = `#version 300 es
out vec2 uv;
void main() {
  vec2 q = vec2(float((gl_VertexID << 1) & 2), float(gl_VertexID & 2));
  uv = q;
  gl_Position = vec4(q * 2.0 - 1.0, 0.0, 1.0);
}`;
const WGSL = (body: string) => `
struct Uni { U: array<vec4f, ${N_VEC4}> };
@group(0) @binding(0) var<uniform> uni: Uni;
struct VO { @builtin(position) pos: vec4f, @location(0) uv: vec2f };
@vertex fn vs(@builtin(vertex_index) i: u32) -> VO {
  let q = vec2f(f32((i << 1u) & 2u), f32(i & 2u));
  var o: VO;
  o.pos = vec4f(q * 2.0 - 1.0, 0.0, 1.0);
  o.uv = vec2f(q.x, q.y);
  return o;
}
fn uu(i: i32) -> f32 { return uni.U[7 + i / 4][i % 4]; }
fn field(p: vec2f) -> f32 { ${body} }
fn shade(v: f32) -> f32 {
  let a = uni.U[4].x; let b = uni.U[4].y;
  var t = (v - a) / max(1e-6, b - a);
  if (uni.U[4].z > 0.5) { t = (sqrt(max(v, 0.0)) - sqrt(max(a, 0.0))) / max(1e-6, sqrt(max(b, 0.0)) - sqrt(max(a, 0.0))); }
  t = clamp(t, 0.0, 1.0);
  if (uni.U[4].w > 0.5) { return 1.0 - t; }
  return t;
}
@fragment fn fs(i: VO) -> @location(0) vec4f {
  let p = vec2f(mix(uni.U[0].x, uni.U[0].y, i.uv.x), mix(uni.U[0].z, uni.U[0].w, i.uv.y));
  let v = field(p);
  let fw = max(fwidth(v), 1e-6);
  var line = 0.0;
  for (var k = 0; k < 8; k++) {
    if (f32(k) >= uni.U[1].w) { break; }
    let L = uni.U[5 + k / 4][k % 4];
    let d = abs(v - L) / fw;
    line = max(line, 1.0 - smoothstep(uni.U[1].z * 0.5 - 0.5, uni.U[1].z * 0.5 + 0.5, d));
  }
  let a = uni.U[2].w * shade(v);
  let la = line * uni.U[3].w;
  let A = a + la * (1.0 - a);
  return vec4f(uni.U[2].rgb * A, A);
}`;

// ------------------------------------------------------------------ WebGL2 (one shared context)
interface GL { c: OffscreenCanvas | HTMLCanvasElement; g: WebGL2RenderingContext; progs: Map<string, { p: WebGLProgram; U: WebGLUniformLocation | null }> }
let gl_ctx: GL | null | undefined;
function gl(): GL | null {
  if (gl_ctx !== undefined) return gl_ctx;
  gl_ctx = null;
  try {
    const c = typeof OffscreenCanvas !== 'undefined' ? new OffscreenCanvas(4, 4) : typeof document !== 'undefined' ? document.createElement('canvas') : null;
    const g = c?.getContext('webgl2', { premultipliedAlpha: true, antialias: false, preserveDrawingBuffer: true }) as WebGL2RenderingContext | null;
    if (c && g) gl_ctx = { c, g, progs: new Map() };
  } catch {
    gl_ctx = null;
  }
  return gl_ctx;
}
function gl_prog(G: GL, k: FieldKind): { p: WebGLProgram; U: WebGLUniformLocation | null } | null {
  let pr = G.progs.get(k.glsl);
  if (pr) return pr;
  const g = G.g;
  const sh = (type: number, src: string) => {
    const s = g.createShader(type)!;
    g.shaderSource(s, src);
    g.compileShader(s);
    if (!g.getShaderParameter(s, g.COMPILE_STATUS)) throw new Error(`field '${k.name}': ${g.getShaderInfoLog(s)}`);
    return s;
  };
  const p = g.createProgram()!;
  g.attachShader(p, sh(g.VERTEX_SHADER, GLSL_VS));
  g.attachShader(p, sh(g.FRAGMENT_SHADER, GLSL_FS(k.glsl)));
  g.linkProgram(p);
  if (!g.getProgramParameter(p, g.LINK_STATUS)) throw new Error(`field '${k.name}': ${g.getProgramInfoLog(p)}`);
  pr = { p, U: g.getUniformLocation(p, 'U') };
  G.progs.set(k.glsl, pr);
  return pr;
}

// ------------------------------------------------------------------ WebGPU (one device, one canvas)
interface WG { c: OffscreenCanvas; ctx: GPUCanvasContext; buf: GPUBuffer; pipes: Map<string, { pipe: GPURenderPipeline; bind: GPUBindGroup }>; fmt: GPUTextureFormat }
let wg: WG | null = null;
function webgpu(): WG | null {
  if (wg || !gpu_dev || typeof OffscreenCanvas === 'undefined') return wg;
  const c = new OffscreenCanvas(4, 4), ctx = c.getContext('webgpu') as GPUCanvasContext | null;
  if (!ctx) return null;
  const fmt = (navigator as Navigator & { gpu: GPU }).gpu.getPreferredCanvasFormat();
  const buf = gpu_dev.createBuffer({ size: N_VEC4 * 16, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });
  wg = { c, ctx, buf, pipes: new Map(), fmt };
  return wg;
}
function wg_pipe(W: WG, k: FieldKind): { pipe: GPURenderPipeline; bind: GPUBindGroup } {
  let p = W.pipes.get(k.wgsl!);
  if (p) return p;
  const mod = gpu_dev!.createShaderModule({ code: WGSL(k.wgsl!) });
  const pipe = gpu_dev!.createRenderPipeline({
    layout: 'auto',
    vertex: { module: mod, entryPoint: 'vs' },
    fragment: { module: mod, entryPoint: 'fs', targets: [{ format: W.fmt }] },
    primitive: { topology: 'triangle-list' },
  });
  const bind = gpu_dev!.createBindGroup({ layout: pipe.getBindGroupLayout(0), entries: [{ binding: 0, resource: { buffer: W.buf } }] });
  p = { pipe, bind };
  W.pipes.set(k.wgsl!, p);
  return p;
}

// ------------------------------------------------------------------ the mark
export interface FieldOpts {
  id?: string;
  role?: string;
  says?: L10n;
  z?: number;
  /** Level lines at these values (up to 8). */
  levels?: number[];
  /** The values the tint runs over, and how: 'sqrt' spreads the low end. */
  range?: [number, number];
  mode?: 'linear' | 'sqrt';
  /** Deepest tint at the low end (a bowl's bottom) rather than the high end. */
  low_deep?: boolean;
  /** Tint and line opacity. */
  fill?: number;
  line?: number;
  line_px?: number;
}

/** A scalar field over a plot's data area, shaded on the GPU (or the CPU) and composited into the 2D canvas. */
export class Field extends Mark {
  kind = 'field';
  /** The tier the last frame was drawn with, and how long it took (ms). */
  last: { tier: Tier; ms: number } = { tier: 'cpu', ms: 0 };
  private u = new Float32Array(16);
  private cpu_c: ReturnType<typeof make_canvas> | null = null;
  constructor(public field: FieldKind, public fo: FieldOpts = {}) {
    super({ id: fo.id, role: fo.role ?? 'region', says: fo.says, z: fo.z ?? 1.2 });
  }
  private pack(env: DrawEnv, w: number, h: number): Float32Array<ArrayBuffer> {
    const U = new Float32Array(new ArrayBuffer(N_VEC4 * 16)), s = this.plot.spec, m = this.material;
    const n = parseInt(this.color.slice(1), 16), lv = (this.fo.levels ?? []).slice(0, 8);
    U.set([s.x[0], s.x[1], s.y[0], s.y[1]], 0);
    U.set([w, h, (this.fo.line_px ?? 1.25) * env.dpr, lv.length], 4);
    U.set([((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255, this.fo.fill ?? m.fill_opacity ?? 0.16], 8);
    U.set([0, 0, 0, this.fo.line ?? 0.35], 12);
    const [v0, v1] = this.fo.range ?? [0, 1];
    U.set([v0, v1, this.fo.mode === 'sqrt' ? 1 : 0, this.fo.low_deep === false ? 0 : 1], 16);
    U.set(lv, 20);
    U.set(this.u, 28);
    return U;
  }
  draw(env: DrawEnv): void {
    const u = read(this.field.uniforms);
    this.u.fill(0);
    this.u.set(u.slice(0, 16));
    const d = this.plot.data;
    const W = Math.max(1, Math.round(d.w * env.dpr)), H = Math.max(1, Math.round(d.h * env.dpr));
    this.box = { ...d };
    const t0 = typeof performance !== 'undefined' ? performance.now() : 0;
    let t = gpu_tier();
    if (t === 'webgpu' && !this.field.wgsl) t = gl() ? 'webgl2' : 'cpu';
    try {
      if (t === 'webgpu') this.draw_webgpu(env, W, H);
      else if (t === 'webgl2') this.draw_webgl(env, W, H);
      else this.draw_cpu(env, W, H);
    } catch (e) {
      // a tier that fails falls back to the next (and stays there for this field)
      if (t !== 'cpu') {
        console.warn(`field '${this.id}': ${t} failed, drawing on the CPU`, e);
        this.field = { ...this.field, wgsl: undefined, glsl: '' };
        t = 'cpu';
        this.draw_cpu(env, W, H);
      } else throw e;
    }
    this.last = { tier: t, ms: (typeof performance !== 'undefined' ? performance.now() : 0) - t0 };
  }
  private blit(env: DrawEnv, src: CanvasImageSource, sw: number, sh: number): void {
    const d = this.plot.data, g = env.g;
    g.save();
    g.imageSmoothingEnabled = true;
    g.drawImage(src, 0, 0, sw, sh, d.x, d.y, d.w, d.h);
    g.restore();
  }
  private draw_webgl(env: DrawEnv, W: number, H: number): void {
    const G = gl()!;
    if (!this.field.glsl) throw new Error('no GLSL');
    const g = G.g, pr = gl_prog(G, this.field)!;
    if (G.c.width < W || G.c.height < H) {
      G.c.width = Math.max(G.c.width, W);
      G.c.height = Math.max(G.c.height, H);
    }
    g.viewport(0, G.c.height - H, W, H);
    g.disable(g.SCISSOR_TEST);
    g.clearColor(0, 0, 0, 0);
    g.clear(g.COLOR_BUFFER_BIT);
    g.useProgram(pr.p);
    g.uniform4fv(pr.U, this.pack(env, W, H));
    g.drawArrays(g.TRIANGLES, 0, 3);
    // (the viewport is the image's top-left W × H: GL's y is up, the image's is down)
    this.blit(env, G.c as CanvasImageSource, W, H);
  }
  private draw_webgpu(env: DrawEnv, W: number, H: number): void {
    const Wg = webgpu();
    if (!Wg || !gpu_dev) throw new Error('no WebGPU');
    if (Wg.c.width !== W || Wg.c.height !== H) {
      Wg.c.width = W;
      Wg.c.height = H;
    }
    Wg.ctx.configure({ device: gpu_dev, format: Wg.fmt, alphaMode: 'premultiplied' });
    const p = wg_pipe(Wg, this.field);
    gpu_dev.queue.writeBuffer(Wg.buf, 0, this.pack(env, W, H));
    const enc = gpu_dev.createCommandEncoder();
    const pass = enc.beginRenderPass({ colorAttachments: [{ view: Wg.ctx.getCurrentTexture().createView(), loadOp: 'clear', storeOp: 'store', clearValue: { r: 0, g: 0, b: 0, a: 0 } }] });
    pass.setPipeline(p.pipe);
    pass.setBindGroup(0, p.bind);
    pass.draw(3);
    pass.end();
    gpu_dev.queue.submit([enc.finish()]);
    // (a WebGPU canvas is an image source with its current texture until the task ends)
    this.blit(env, Wg.c as unknown as CanvasImageSource, W, H);
  }
  /** The CPU tier: the same formula at half resolution, smoothed when drawn. */
  private draw_cpu(env: DrawEnv, W: number, H: number): void {
    const k = 0.5, w = Math.max(2, Math.round(W * k)), h = Math.max(2, Math.round(H * k));
    const U = this.pack(env, w, h), s = this.plot.spec, f = this.field.cpu, u = this.u;
    const vals = new Float32Array((w + 1) * (h + 1));
    for (let j = 0; j <= h; j++) {
      const y = s.y[1] - ((j + 0.5) / h) * (s.y[1] - s.y[0]);
      for (let i = 0; i <= w; i++) vals[j * (w + 1) + i] = f(s.x[0] + ((i + 0.5) / w) * (s.x[1] - s.x[0]), y, u);
    }
    if (!this.cpu_c || this.cpu_c.width !== w || this.cpu_c.height !== h) this.cpu_c = make_canvas(w, h);
    const cg = this.cpu_c.getContext('2d') as CanvasRenderingContext2D;
    const img = cg.createImageData(w, h), px = img.data;
    const [r, g, b, fill] = [U[8], U[9], U[10], U[11]], la0 = U[15], lpx = (U[6] * k), n = U[7];
    const [v0, v1, mode, inv] = [U[16], U[17], U[18], U[19]];
    const shade = (v: number) => {
      let t = mode > 0.5 ? (Math.sqrt(Math.max(v, 0)) - Math.sqrt(Math.max(v0, 0))) / Math.max(1e-6, Math.sqrt(Math.max(v1, 0)) - Math.sqrt(Math.max(v0, 0))) : (v - v0) / Math.max(1e-6, v1 - v0);
      t = Math.min(1, Math.max(0, t));
      return inv > 0.5 ? 1 - t : t;
    };
    const ss = (e0: number, e1: number, x: number) => {
      const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0)));
      return t * t * (3 - 2 * t);
    };
    for (let j = 0; j < h; j++)
      for (let i = 0; i < w; i++) {
        const v = vals[j * (w + 1) + i], fw = Math.max(1e-6, Math.abs(vals[j * (w + 1) + i + 1] - v) + Math.abs(vals[(j + 1) * (w + 1) + i] - v));
        let line = 0;
        for (let q = 0; q < n; q++) {
          const dd = Math.abs(v - U[20 + q]) / fw;
          line = Math.max(line, 1 - ss(lpx * 0.5 - 0.5, lpx * 0.5 + 0.5, dd));
        }
        const a = fill * shade(v), A = a + line * la0 * (1 - a), o = (j * w + i) * 4;
        px[o] = r * 255;
        px[o + 1] = g * 255;
        px[o + 2] = b * 255;
        px[o + 3] = A * 255;
      }
    cg.putImageData(img, 0, 0);
    this.blit(env, this.cpu_c as CanvasImageSource, w, h);
  }
  // a field is a background: labels may sit on it
  override obstacles(): Obstacle[] {
    return [];
  }
}
