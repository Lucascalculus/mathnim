// A small WebGL2 core for the GPU materials: programs with named uniforms, float targets, ping-pong buffers,
// a full-screen triangle, canvas textures. No library: this is the size of thing manim-web could own.

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
const FS_VS = `#version 300 es
out vec2 uv;
void main(){ vec2 p = vec2((gl_VertexID << 1) & 2, gl_VertexID & 2); uv = p; gl_Position = vec4(p * 2.0 - 1.0, 0.0, 1.0); }`;

// shared GLSL: palette, noise, colour science
const GLSL_COMMON = `
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

function shader(gl, type, src) {
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

export const clamp = (x, a, b) => Math.max(a, Math.min(b, x));

// a 2D canvas as a mipmapped texture (y flipped to GL's convention)
export function upload(gl, cv, o = {}) {
  const t = texture(gl, cv.width, cv.height, { type: 'u8', mip: true });
  gl.bindTexture(gl.TEXTURE_2D, t.tex);
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true); gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, !!o.premul);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, cv);
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false); gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
  gl.generateMipmap(gl.TEXTURE_2D);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
  const af = gl.getExtension('EXT_texture_filter_anisotropic'); if (af) gl.texParameterf(gl.TEXTURE_2D, af.TEXTURE_MAX_ANISOTROPY_EXT, 8);
  return t;
}
