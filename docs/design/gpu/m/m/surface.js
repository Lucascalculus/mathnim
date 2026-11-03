// M4 · A surface z = f(x, y) in plaster, under one light, ray-marched with soft shadows and ambient occlusion.
// Water fills it to a level c: its shoreline is exactly the level set f = c, and the water refracts and absorbs as
// water does. The camera rises from the house angle to straight above; engraved contours appear as it does, because
// contours are what you read from above. Drag up and down to raise the water; tap to rise or come back down.
// As a library primitive: surface(f) with water(level) and the ladder of abstraction as a camera move.
import { context, program, pass, scheduler, fit_canvas, clamp } from '../../lib/gl.js';
import { Spring } from '../../lib/ui.js';

export const meta = {
  id: 'surface',
  name: { zh: '曲面 · 石膏与水', en: 'A surface in plaster and water' },
  means: { zh: '函数是一块石膏地形，水面高度 c 的岸线正好是等高线 f = c；镜头升到正上方，等高线就显出来。', en: 'A function is a plaster landscape; the shoreline at water level c is exactly the level set f = c; as the camera rises to straight above, the contours appear.' },
  test: { zh: '俯视时水的范围与 {f < c} 逐像素一致（≥ 99%）', en: 'From above, the water covers exactly {f < c}, pixel by pixel (≥ 99 %)' },
  wide: true,
};

const F_GLSL = `
// two basins and a saddle between them, on a gentle bowl
float f(vec2 p){
  return 1.9 * (0.07 * dot(p, p) - 0.55 * exp(-dot(p - vec2(-0.9, 0.3), p - vec2(-0.9, 0.3)) / 0.5) - 0.42 * exp(-dot(p - vec2(0.95, -0.35), p - vec2(0.95, -0.35)) / 0.35) + 0.18 * exp(-dot(p - vec2(0.1, 0.9), p - vec2(0.1, 0.9)) / 0.3) + 0.35) - 0.45;
}`;
export function f_js(x, y) { const g = (cx, cy, s) => Math.exp(-((x - cx) ** 2 + (y - cy) ** 2) / s); return 1.9 * (0.07 * (x * x + y * y) - 0.55 * g(-0.9, 0.3, 0.5) - 0.42 * g(0.95, -0.35, 0.35) + 0.18 * g(0.1, 0.9, 0.3) + 0.35) - 0.45; }

const FS = `
in vec2 uv; out vec4 o;
uniform vec2 res; uniform vec3 eye; uniform mat3 cam; uniform float level; uniform float top; uniform float test; uniform float ext;` + F_GLSL + `
const vec3 L = normalize(vec3(-0.45, 0.85, 0.35));
vec3 nrm(vec2 p){ vec2 e = vec2(0.002, 0); return normalize(vec3(-(f(p + e.xy) - f(p - e.xy)) / 0.004, 1.0, -(f(p + e.yx) - f(p - e.yx)) / 0.004)); }
// the ray meets the terrain (y = f(x, z), inside the square |x|, |z| < ext, on a plinth)
float trace(vec3 ro, vec3 rd, out float side){
  float t = 0.0, last = 0.0, h_last = 1.0; side = 0.0;
  // enter the box
  vec2 tb = vec2(-1e9, 1e9);
  for (int a = 0; a < 2; a++){ float o = a == 0 ? ro.x : ro.z, d = a == 0 ? rd.x : rd.z; float t0 = (-ext - o) / d, t1 = (ext - o) / d; tb.x = max(tb.x, min(t0, t1)); tb.y = min(tb.y, max(t0, t1)); }
  if (tb.x > tb.y) return -1.0;
  t = max(tb.x, 0.0);
  // entering the box below the surface means the ray met the plinth's side
  { vec3 p0 = ro + rd * t; if (p0.y < f(p0.xz)) { side = 1.0; return p0.y > -0.95 ? t : -1.0; } }
  for (int i = 0; i < 220; i++){
    vec3 p = ro + rd * t; float h = p.y - f(p.xz);
    if (h < 0.0){ float a = last, b = t; for (int k = 0; k < 8; k++){ float m = 0.5 * (a + b); vec3 q = ro + rd * m; if (q.y - f(q.xz) < 0.0) b = m; else a = m; } return b; }
    if (t > tb.y) return -1.0;
    last = t; t += clamp(h * 0.4, 0.002, 0.05);
  }
  return -1.0;
}
float soft_shadow(vec3 p){ float s = 1.0, t = 0.02; for (int i = 0; i < 40; i++){ vec3 q = p + L * t; float h = q.y - f(q.xz); s = min(s, 10.0 * h / t); if (s < 0.0 || abs(q.x) > ext || abs(q.z) > ext) break; t += clamp(h, 0.02, 0.15); } return clamp(s, 0.0, 1.0); }
float ao(vec3 p, vec3 n){ float a = 0.0; for (int i = 1; i <= 5; i++){ float d = float(i) * 0.06; vec3 q = p + n * d; a += clamp((q.y - f(q.xz)) / d, 0.0, 1.0); } return a / 5.0; }
vec3 plaster(vec3 p){
  vec3 n = nrm(p.xz);
  float diff = max(dot(n, L), 0.0), sh = soft_shadow(p + n * 0.003), occ = ao(p, n);
  // plaster scatters light a little under its surface: a wrapped, warm diffuse
  float wrap = max((dot(n, L) + 0.35) / 1.35, 0.0);
  vec3 c = to_lin(PAPER) * (0.18 * occ + 0.86 * mix(wrap, diff, 0.75) * mix(0.28, 1.0, sh));
  // engraved contours, read from above: they appear as the camera rises
  float k = f(p.xz) / 0.08, w = abs(fract(k + 0.5) - 0.5) / fwidth(k);
  c *= 1.0 - top * 0.42 * (1.0 - smoothstep(0.0, 1.2, w)) * (mod(floor(k + 0.5), 4.0) == 0.0 ? 1.0 : 0.55);
  return c;
}
vec3 sky(vec3 d){ return to_lin(PAPER) * (0.85 + 0.15 * d.y) + vec3(1.6) * pow(max(dot(d, L), 0.0), 120.0); }
void main(){
  vec2 q = (uv * res * 2.0 - res) / res.y;
  vec3 rd = normalize(cam * vec3(q, -2.6)), ro = eye;
  vec3 col = to_lin(PAPER) * 0.97;
  // the paper the block stands on, and the block's soft shadow on it from the one light
  { float tg = (-0.95 - ro.y) / rd.y; if (tg > 0.0){ vec3 g = ro + rd * tg; vec2 sp = g.xz - L.xz / L.y * 0.55; vec2 dd = abs(sp) - vec2(ext); float sd = length(max(dd, 0.0)) + min(max(dd.x, dd.y), 0.0);
    col *= 1.0 - 0.16 * smoothstep(0.55, -0.15, sd); vec2 d2 = abs(g.xz) - vec2(ext); col *= 1.0 - 0.18 * smoothstep(0.12, 0.0, length(max(d2, 0.0))); } }
  float side; float t = trace(ro, rd, side);
  // the water plane, cut to the square
  float tw = (level - ro.y) / rd.y; vec3 pw = ro + rd * tw;
  bool water = tw > 0.0 && abs(pw.x) < ext && abs(pw.z) < ext && (t < 0.0 || tw < t);
  if (test > 0.5){ o = vec4(water ? 1.0 : 0.0, 0, 0, 1); return; }
  if (t > 0.0 && side < 0.5) col = plaster(ro + rd * t);
  else if (t > 0.0){
    // a side of the plinth: flat, lit by the same light, fading into the paper at its foot
    vec3 p = ro + rd * t; vec3 n = abs(abs(p.x) - ext) < abs(abs(p.z) - ext) ? vec3(sign(p.x), 0, 0) : vec3(0, 0, sign(p.z));
    col = to_lin(PAPER) * (0.42 + 0.5 * max(dot(n, L), 0.0) + 0.1 * smoothstep(-1.0, 0.0, p.y - f(p.xz)));
  }
  if (water){
    // refraction into the water, absorption with depth, a sky reflection by Fresnel
    vec3 n = vec3(0, 1, 0), tr = refract(rd, n, 1.0 / 1.333);
    float sd2; float t2 = trace(pw + tr * 0.001, tr, sd2); vec3 bed = t2 > 0.0 ? plaster(pw + tr * t2) : to_lin(PAPER) * 0.5;
    float depth = t2 > 0.0 ? t2 : 0.5;
    vec3 absorb = exp(-depth * vec3(2.6, 0.95, 0.75));
    float F = 0.02 + 0.98 * pow(1.0 - max(dot(-rd, n), 0.0), 5.0);
    col = mix(bed * absorb, sky(reflect(rd, n)), F);
    // the shoreline: where the water is shallowest, a fine ink line (it is the contour f = c)
    float shore = abs(f(pw.xz) - level) / fwidth(f(pw.xz));
    col = mix(col, to_lin(INK), (1.0 - smoothstep(0.0, 1.4, shore)) * 0.75);
  }
  o = vec4(to_srgb(col), 1.0);
}`;

export function make({ stage, canvas, hud, lang }) {
  const zh = lang === 'zh', gl = context(canvas), prog = program(gl, FS);
  fit_canvas(canvas, 1.5);
  const EXT = 1.9, S = { level: new Spring(-0.12, 0.4, 1), el: new Spring(0.66, 0.9, 0.95) };
  function camera() {
    const az = -0.5, el = Math.min(Math.PI / 2 - 1e-3, S.el.x), d = canvas.width < canvas.height ? 12.5 : 8.4;
    const eye = [Math.sin(az) * Math.cos(el) * d, Math.sin(el) * d - 0.05, Math.cos(az) * Math.cos(el) * d];
    const fwd = norm([-eye[0], -0.05 - eye[1] + 0.0, -eye[2]]), up0 = el > 1.45 ? [-Math.sin(az), 0, -Math.cos(az)] : [0, 1, 0];
    const right = norm(cross(fwd, up0)), up = cross(right, fwd);
    return { eye, cam: new Float32Array([...right, ...up, ...fwd.map((v) => -v)]) };
  }
  const top = () => clamp((S.el.x - 0.66) / (Math.PI / 2 - 0.66), 0, 1) ** 2;
  function draw(test = 0) { const C = camera(); pass(gl, prog, { res: [canvas.width, canvas.height], eye: C.eye, cam: C.cam, level: S.level.x, top: top(), test, ext: EXT }); hud.innerHTML = `${zh ? '水面' : 'water level'} c = <b>${S.level.x.toFixed(2)}</b>`; }
  const sched = scheduler((dt) => { const a = S.level.step(dt), b = S.el.step(dt); draw(); return a || b; });
  let drag = null;
  canvas.addEventListener('pointerdown', (e) => { drag = { y: e.clientY, l: S.level.target, moved: false }; canvas.setPointerCapture(e.pointerId); });
  canvas.addEventListener('pointermove', (e) => { if (!drag) return; const dy = e.clientY - drag.y; if (Math.abs(dy) > 4) drag.moved = true; S.level.to(clamp(drag.l - dy / 300, -0.6, 0.6)); sched.wake(); });
  canvas.addEventListener('pointerup', () => { if (drag && !drag.moved) { S.el.to(S.el.target > 1.2 ? 0.66 : Math.PI / 2); sched.wake(3000); } drag = null; });
  draw();
  return {
    visible: (v) => sched.set_visible(v), resize: () => { fit_canvas(canvas, 1.5); draw(); },
    demo() { S.el.to(S.el.target > 1.2 ? 0.66 : Math.PI / 2); sched.wake(3000); },
    set(level, el) { S.level.snap(level); S.el.snap(el); draw(); },
    async accept() {
      // from straight above (orthographic enough at this distance? no: compare per pixel by unprojecting each ray)
      const keep = [S.level.x, S.el.x]; S.el.snap(Math.PI / 2 - 1e-3); S.level.snap(-0.12); draw(1);
      const W = canvas.width, H = canvas.height, px = new Uint8Array(W * H * 4); gl.readPixels(0, 0, W, H, gl.RGBA, gl.UNSIGNED_BYTE, px);
      const C = camera(); let agree = 0, n = 0;
      for (let y = 0; y < H; y += 3) for (let x = 0; x < W; x += 3) {
        const qx = (x + 0.5) / W * 2 * (W / H) - W / H, qy = (y + 0.5) / H * 2 - 1, v = [qx, qy, -2.6];
        const rd = norm([C.cam[0] * v[0] + C.cam[3] * v[1] + C.cam[6] * v[2], C.cam[1] * v[0] + C.cam[4] * v[1] + C.cam[7] * v[2], C.cam[2] * v[0] + C.cam[5] * v[1] + C.cam[8] * v[2]]);
        const t = (-0.12 - C.eye[1]) / rd[1], p = [C.eye[0] + rd[0] * t, C.eye[2] + rd[2] * t];
        if (Math.abs(p[0]) > EXT - 0.02 || Math.abs(p[1]) > EXT - 0.02) continue;
        const truth = f_js(p[0], p[1]) < -0.12, got = px[(y * W + x) * 4] > 127;
        if (Math.abs(f_js(p[0], p[1]) + 0.12) < 0.004) continue;   // the shoreline itself is one pixel either way
        n++; if (truth === got) agree++;
      }
      S.level.snap(keep[0]); S.el.snap(keep[1]); draw();
      const r = agree / n;
      return { pass: r >= 0.99, value: `${zh ? '一致' : 'agreement'} ${(r * 100).toFixed(2)}% (${n} ${zh ? '个像素' : 'pixels'})` };
    },
  };
}
const norm = (a) => { const l = Math.hypot(...a) || 1; return a.map((v) => v / l); };
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
