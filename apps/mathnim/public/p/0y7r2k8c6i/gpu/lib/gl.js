// A small WebGL2 core for the material lab: programs with named uniforms, float targets, ping-pong
// buffers, a full-screen triangle, and a frame scheduler that stops drawing when nothing changes.
// No library: this is the size of thing manim-web could own.

export const PAPER = [0.984, 0.980, 0.969];
export const PIG = {
  ink: [0.102, 0.106, 0.122], graphite: [0.553, 0.569, 0.596], paper: PAPER,
  cobalt: [0.17, 0.35, 0.85], ochre: [0.80, 0.54, 0.14], teal: [0.07, 0.54, 0.63],
  violet: [0.42, 0.31, 0.79], viridian: [0.10, 0.54, 0.42], vermilion: [0.93, 0.27, 0.13],
};

export function context(canvas, o = {}) {
  const gl = canvas.getContext('webgl2', { antialias: o.antialias ?? false, alpha: o.alpha ?? false, premultipliedAlpha: true, preserveDrawingBuffer: true, powerPreference: 'high-performance', depth: o.depth ?? false });
  if (!gl) throw new Error('WebGL2 is not available');
  gl.ext_float = !!gl.getExtension('EXT_color_buffer_float');
  gl.ext_linear = !!gl.getExtension('OES_texture_float_linear');
  gl.getExtension('EXT_float_blend');
  gl.vao_empty = gl.createVertexArray();
  return gl;
}

// the full-screen triangle: no buffers, gl_VertexID only
export const FS_VS = `#version 300 es
out vec2 uv;
void main(){ vec2 p = vec2((gl_VertexID << 1) & 2, gl_VertexID & 2); uv = p; gl_Position = vec4(p * 2.0 - 1.0, 0.0, 1.0); }`;

// shared GLSL: palette, noise, colour science
export const GLSL_COMMON = `
const vec3 PAPER = vec3(0.984, 0.980, 0.969);
const vec3 INK = vec3(0.102, 0.106, 0.122);
const vec3 GRAPHITE = vec3(0.553, 0.569, 0.596);
const vec3 COBALT = vec3(0.17, 0.35, 0.85);
const vec3 OCHRE = vec3(0.80, 0.54, 0.14);
const vec3 TEAL = vec3(0.07, 0.54, 0.63);
const vec3 VIOLET = vec3(0.42, 0.31, 0.79);
const vec3 VIRIDIAN = vec3(0.10, 0.54, 0.42);
const vec3 VERMILION = vec3(0.93, 0.27, 0.13);
float hash12(vec2 p){ vec3 p3 = fract(vec3(p.xyx) * .1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
vec2 hash22(vec2 p){ vec3 p3 = fract(vec3(p.xyx) * vec3(.1031, .1030, .0973)); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.xx + p3.yz) * p3.zy); }
float vnoise(vec2 p){ vec2 i = floor(p), f = fract(p); vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash12(i), hash12(i + vec2(1, 0)), u.x), mix(hash12(i + vec2(0, 1)), hash12(i + vec2(1, 1)), u.x), u.y); }
float fbm(vec2 p){ float s = 0.0, a = 0.5; for (int i = 0; i < 5; i++){ s += a * vnoise(p); p = p * 2.03 + 17.1; a *= 0.5; } return s; }
// linear <-> sRGB (we shade in linear light and write sRGB)
vec3 to_lin(vec3 c){ return pow(c, vec3(2.2)); }
vec3 to_srgb(vec3 c){ return pow(max(c, 0.0), vec3(1.0 / 2.2)); }
// CIE 1931 colour matching, the multi-lobe Gaussian fit of Wyman, Sloan and Shirley (2013)
vec3 cie_xyz(float l){
  float t1 = (l - 442.0) * ((l < 442.0) ? 0.0624 : 0.0374), t2 = (l - 599.8) * ((l < 599.8) ? 0.0264 : 0.0323), t3 = (l - 501.1) * ((l < 501.1) ? 0.0490 : 0.0382);
  float x = 0.362 * exp(-0.5 * t1 * t1) + 1.056 * exp(-0.5 * t2 * t2) - 0.065 * exp(-0.5 * t3 * t3);
  float u1 = (l - 568.8) * ((l < 568.8) ? 0.0213 : 0.0247), u2 = (l - 530.9) * ((l < 530.9) ? 0.0613 : 0.0322);
  float y = 0.821 * exp(-0.5 * u1 * u1) + 0.286 * exp(-0.5 * u2 * u2);
  float v1 = (l - 437.0) * ((l < 437.0) ? 0.0845 : 0.0278), v2 = (l - 459.0) * ((l < 459.0) ? 0.0385 : 0.0725);
  float z = 1.217 * exp(-0.5 * v1 * v1) + 0.681 * exp(-0.5 * v2 * v2);
  return vec3(x, y, z);
}
vec3 xyz_to_lin_srgb(vec3 c){ return mat3(3.2406, -0.9689, 0.0557, -1.5372, 1.8758, -0.2040, -0.4986, 0.0415, 1.0570) * c; }
`;

export function shader(gl, type, src) {
  const s = gl.createShader(type);
  gl.shaderSource(s, src); gl.compileShader(s);
  if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
    const log = gl.getShaderInfoLog(s), lines = src.split('\n').map((l, i) => (i + 1) + ': ' + l).join('\n');
    console.error(log + '\n' + lines); throw new Error(log);
  }
  return s;
}

// program(gl, fs) uses the full-screen vertex shader; fragment sources get the common header
export function program(gl, fs, vs = FS_VS) {
  const head = (src) => src.startsWith('#version') ? src : '#version 300 es\nprecision highp float;\nprecision highp int;\nprecision highp sampler2D;\n' + GLSL_COMMON + src;
  const p = gl.createProgram();
  gl.attachShader(p, shader(gl, gl.VERTEX_SHADER, vs.startsWith('#version') ? vs : '#version 300 es\nprecision highp float;\nprecision highp sampler2D;\n' + GLSL_COMMON + vs));
  gl.attachShader(p, shader(gl, gl.FRAGMENT_SHADER, head(fs)));
  gl.linkProgram(p);
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
  const u = {}, n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS);
  for (let i = 0; i < n; i++) { const info = gl.getActiveUniform(p, i), name = info.name.replace(/\[0\]$/, ''); u[name] = { loc: gl.getUniformLocation(p, info.name), type: info.type, size: info.size }; }
  return { p, u };
}

// set uniforms by name; textures are { tex } objects and take the next free unit
export function use(gl, prog, uniforms = {}) {
  gl.useProgram(prog.p);
  let unit = 0;
  for (const [k, v] of Object.entries(uniforms)) {
    const u = prog.u[k]; if (!u) continue;
    const L = u.loc, T = u.type;
    if (T === gl.SAMPLER_2D) { gl.activeTexture(gl.TEXTURE0 + unit); gl.bindTexture(gl.TEXTURE_2D, v.tex || v); gl.uniform1i(L, unit++); }
    else if (T === gl.FLOAT) u.size > 1 ? gl.uniform1fv(L, v) : gl.uniform1f(L, v);
    else if (T === gl.FLOAT_VEC2) gl.uniform2fv(L, v);
    else if (T === gl.FLOAT_VEC3) gl.uniform3fv(L, v);
    else if (T === gl.FLOAT_VEC4) gl.uniform4fv(L, v);
    else if (T === gl.INT || T === gl.BOOL) gl.uniform1i(L, v);
    else if (T === gl.FLOAT_MAT2) gl.uniformMatrix2fv(L, false, v);
    else if (T === gl.FLOAT_MAT3) gl.uniformMatrix3fv(L, false, v);
    else if (T === gl.FLOAT_MAT4) gl.uniformMatrix4fv(L, false, v);
  }
}

export function texture(gl, w, h, o = {}) {
  const t = gl.createTexture(), kind = o.type || 'f16';
  gl.bindTexture(gl.TEXTURE_2D, t);
  const F = { f32: [gl.RGBA32F, gl.RGBA, gl.FLOAT], f16: [gl.RGBA16F, gl.RGBA, gl.HALF_FLOAT], u8: [gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE] }[kind];
  gl.texImage2D(gl.TEXTURE_2D, 0, F[0], w, h, 0, F[1], F[2], o.data || null);
  const filt = o.filter === 'nearest' || (kind === 'f32' && !gl.ext_linear) ? gl.NEAREST : gl.LINEAR;
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, o.mip ? gl.LINEAR_MIPMAP_LINEAR : filt);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, filt);
  const wrap = o.wrap === 'repeat' ? gl.REPEAT : gl.CLAMP_TO_EDGE;
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, wrap); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, wrap);
  if (o.mip) gl.generateMipmap(gl.TEXTURE_2D);
  return { tex: t, w, h, kind };
}

export function target(gl, w, h, o = {}) {
  const t = texture(gl, w, h, o), fb = gl.createFramebuffer();
  gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, t.tex, 0);
  if (o.depth) { const rb = gl.createRenderbuffer(); gl.bindRenderbuffer(gl.RENDERBUFFER, rb); gl.renderbufferStorage(gl.RENDERBUFFER, gl.DEPTH_COMPONENT24, w, h); gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.RENDERBUFFER, rb); }
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  return { ...t, fb };
}

export function pingpong(gl, w, h, o = {}) {
  const a = target(gl, w, h, o), b = target(gl, w, h, o);
  return { w, h, read: a, write: b, swap() { const t = this.read; this.read = this.write; this.write = t; } };
}

// draw a full-screen pass into a target (or the canvas when tgt is null)
export function pass(gl, prog, uniforms, tgt = null, o = {}) {
  gl.bindFramebuffer(gl.FRAMEBUFFER, tgt ? tgt.fb : null);
  gl.viewport(0, 0, tgt ? tgt.w : gl.drawingBufferWidth, tgt ? tgt.h : gl.drawingBufferHeight);
  if (o.blend) { gl.enable(gl.BLEND); gl.blendFunc(...o.blend); } else gl.disable(gl.BLEND);
  use(gl, prog, uniforms);
  gl.bindVertexArray(gl.vao_empty);
  gl.drawArrays(gl.TRIANGLES, 0, 3);
}

export function read_float(gl, tgt, x = 0, y = 0, w = tgt.w, h = tgt.h) {
  gl.bindFramebuffer(gl.FRAMEBUFFER, tgt.fb);
  const out = new Float32Array(w * h * 4);
  gl.readPixels(x, y, w, h, gl.RGBA, gl.FLOAT, out);
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  return out;
}

// a canvas sized to its box at the device pixel ratio (capped), re-measured on resize
export function fit_canvas(canvas, cap = 2, scale = 1) {
  const r = canvas.getBoundingClientRect(), d = Math.min(cap, devicePixelRatio || 1) * scale;
  const w = Math.max(2, Math.round(r.width * d)), h = Math.max(2, Math.round(r.height * d));
  if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; return true; }
  return false;
}

// The scheduler: a material asks for frames while it is changing and returns false when it has settled.
// Frames stop when nothing moves (quiet at rest) and while the tile is off screen.
export function scheduler(step) {
  let raf = 0, last = 0, visible = true, awake_until = 0;
  const s = {
    frames: 0, fps: 0, _t0: 0, _f0: 0,
    wake(ms = 1500) { awake_until = Math.max(awake_until, performance.now() + ms); if (!raf && visible) raf = requestAnimationFrame(tick); },
    set_visible(v) { visible = v; if (v) s.wake(300); },
  };
  function tick(t) {
    raf = 0;
    const dt = Math.min(1 / 20, last ? (t - last) / 1000 : 1 / 60); last = t;
    const busy = step(dt, t / 1000);
    s.frames++;
    if (t - s._t0 > 500) { s.fps = (s.frames - s._f0) * 1000 / (t - s._t0); s._t0 = t; s._f0 = s.frames; }
    if (visible && (busy || t < awake_until)) raf = requestAnimationFrame(tick); else last = 0;
  }
  return s;
}

// pointer in canvas uv (0..1, y up), with drag state
export function pointer(canvas, on) {
  const P = { x: 0.5, y: 0.5, px: 0.5, py: 0.5, down: false, inside: false };
  const at = (e) => { const r = canvas.getBoundingClientRect(); P.px = P.x; P.py = P.y; P.x = (e.clientX - r.left) / r.width; P.y = 1 - (e.clientY - r.top) / r.height; };
  canvas.addEventListener('pointerdown', (e) => { at(e); P.px = P.x; P.py = P.y; P.down = true; canvas.setPointerCapture(e.pointerId); on && on('down', P, e); });
  canvas.addEventListener('pointermove', (e) => { at(e); P.inside = true; on && on('move', P, e); });
  canvas.addEventListener('pointerup', (e) => { at(e); P.down = false; on && on('up', P, e); });
  canvas.addEventListener('pointercancel', () => { P.down = false; });
  canvas.addEventListener('pointerleave', (e) => { P.inside = false; on && on('leave', P, e); });
  return P;
}

// small matrix helpers (column-major, like GLSL)
export const m4 = {
  persp(fovy, aspect, n, f) { const t = 1 / Math.tan(fovy / 2); return new Float32Array([t / aspect, 0, 0, 0, 0, t, 0, 0, 0, 0, (f + n) / (n - f), -1, 0, 0, 2 * f * n / (n - f), 0]); },
  look(eye, at, up = [0, 1, 0]) {
    const z = norm(sub(eye, at)), x = norm(cross(up, z)), y = cross(z, x);
    return new Float32Array([x[0], y[0], z[0], 0, x[1], y[1], z[1], 0, x[2], y[2], z[2], 0, -dot(x, eye), -dot(y, eye), -dot(z, eye), 1]);
  },
  mul(a, b) { const o = new Float32Array(16); for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) { let s = 0; for (let k = 0; k < 4; k++) s += a[k * 4 + j] * b[i * 4 + k]; o[i * 4 + j] = s; } return o; },
  inv(m) {
    const a = m, o = new Float32Array(16);
    const b00 = a[0] * a[5] - a[1] * a[4], b01 = a[0] * a[6] - a[2] * a[4], b02 = a[0] * a[7] - a[3] * a[4], b03 = a[1] * a[6] - a[2] * a[5], b04 = a[1] * a[7] - a[3] * a[5], b05 = a[2] * a[7] - a[3] * a[6];
    const b06 = a[8] * a[13] - a[9] * a[12], b07 = a[8] * a[14] - a[10] * a[12], b08 = a[8] * a[15] - a[11] * a[12], b09 = a[9] * a[14] - a[10] * a[13], b10 = a[9] * a[15] - a[11] * a[13], b11 = a[10] * a[15] - a[11] * a[14];
    const det = 1 / (b00 * b11 - b01 * b10 + b02 * b09 + b03 * b08 - b04 * b07 + b05 * b06);
    o[0] = (a[5] * b11 - a[6] * b10 + a[7] * b09) * det; o[1] = (a[2] * b10 - a[1] * b11 - a[3] * b09) * det; o[2] = (a[13] * b05 - a[14] * b04 + a[15] * b03) * det; o[3] = (a[10] * b04 - a[9] * b05 - a[11] * b03) * det;
    o[4] = (a[6] * b08 - a[4] * b11 - a[7] * b07) * det; o[5] = (a[0] * b11 - a[2] * b08 + a[3] * b07) * det; o[6] = (a[14] * b02 - a[12] * b05 - a[15] * b01) * det; o[7] = (a[8] * b05 - a[10] * b02 + a[11] * b01) * det;
    o[8] = (a[4] * b10 - a[5] * b08 + a[7] * b06) * det; o[9] = (a[1] * b08 - a[0] * b10 - a[3] * b06) * det; o[10] = (a[12] * b04 - a[13] * b02 + a[15] * b00) * det; o[11] = (a[9] * b02 - a[8] * b04 - a[11] * b00) * det;
    o[12] = (a[5] * b07 - a[4] * b09 - a[6] * b06) * det; o[13] = (a[0] * b09 - a[1] * b07 + a[2] * b06) * det; o[14] = (a[13] * b01 - a[12] * b03 - a[14] * b00) * det; o[15] = (a[8] * b03 - a[9] * b01 + a[10] * b00) * det;
    return o;
  },
};
export const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
export const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
export const scale = (a, s) => [a[0] * s, a[1] * s, a[2] * s];
export const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
export const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
export const norm = (a) => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
export const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
export const lerp = (a, b, t) => a + (b - a) * t;
export const smooth = (t) => t * t * (3 - 2 * t);

// a grid mesh of (n+1)^2 vertices in [0,1]^2 drawn as triangles; positions come from gl_VertexID in the shader
export function grid_indices(gl, n) {
  const idx = new Uint32Array(n * n * 6); let k = 0;
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) { const a = j * (n + 1) + i, b = a + 1, c = a + n + 1, d = c + 1; idx.set([a, b, d, a, d, c], k); k += 6; }
  const vao = gl.createVertexArray(); gl.bindVertexArray(vao);
  const ib = gl.createBuffer(); gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ib); gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, idx, gl.STATIC_DRAW);
  gl.bindVertexArray(null);
  return { vao, count: idx.length, n };
}
