// The plaster terrain. The contour map’s function, made as a white study model on a plinth, under the one camera and
// the one light; its heights are engraved faintly, every fifth deeper. Raise the water with the bead on the gauge: the
// shoreline, where water meets plaster, is exactly the contour at the water’s height. Turn the camera to look straight
// down and the model is the contour map, shoreline and all. As a building block: terrain(f, box, { water }).
import { scheduler, Spring, GR, css } from '../lib/ui.js';
import { context, program, use } from '../lib/gl.js';
import { num, text, glass_bead, drags, TICK } from '../lib/plot.js';
import { hills, hills_grad, HILLS, contour } from '../lib/contour.js';

export const meta = {
  id: 'terrain',
  name: { zh: '石膏地形', en: 'The plaster terrain' },
  means: { zh: '等高线地图的同一个函数，做成放在底座上的白色石膏模型，在唯一的相机和唯一的光下，高度淡淡地刻在上面。拖动水位：水碰到石膏的那一圈岸线，恰好是这个高度的等高线。相机转到正上方，模型就是等高线地图。', en: 'The contour map’s function as a white plaster model on a plinth, under the one camera and the one light, its heights faintly engraved. Raise the water: the shoreline is exactly the contour at that height. Look straight down and the model is the contour map.' },
  test: { zh: '俯视时，岸线落在同一高度的等高线上（≥ 97% 的点 1.5 px 以内）；俯视的画面横平竖直、长宽比 3 : 2', en: 'Seen from above, the shoreline lies on the contour of the same height (≥ 97% of points within 1.5 px); the top view is square to the screen with aspect 3 : 2' },
};

const HS = 0.55, NXM = 150, NZM = 100;                    // height scale; mesh resolution
const WORLD = { az: -0.5, el: 0.66 }, TOP = { az: 0, el: Math.PI / 2 };
const LIGHT = (() => { const v = [-0.35, 1.0, 0.32], l = Math.hypot(...v); return v.map((c) => c / l); })();
const SHORE = [0.15, 0.35, 0.55];
let fmin = Infinity, fmax = -Infinity;
for (let j = 0; j <= 60; j++) for (let i = 0; i <= 90; i++) { const v = hills(-3 + 6 * i / 90, -2 + 4 * j / 60); fmin = Math.min(fmin, v); fmax = Math.max(fmax, v); }
const Y_BASE = HS * fmin - 0.32;
// world (x, height, z) with z = −y, so that seen from above north is up, as on the map
const world_y = (x, z) => HS * hills(x, -z);

const VS = `
in vec3 a_pos; in vec3 a_nrm; in float a_h;
uniform mat4 u_mvp;
out vec3 v_n; out float v_h; out float v_y;
void main(){ v_n = a_nrm; v_h = a_h; v_y = a_pos.y; gl_Position = u_mvp * vec4(a_pos, 1.0); }`;
const FS = `
in vec3 v_n; in float v_h; in float v_y;
uniform vec3 u_light; uniform float u_level; uniform float u_wall; uniform float u_step; uniform vec3 u_shore;
out vec4 o;
void main(){
  vec3 n = normalize(v_n);
  vec3 c = vec3(0.972, 0.966, 0.952) * (0.74 + 0.27 * max(dot(n, u_light), 0.0));
  if (u_wall < 0.5) {
    // engraved heights: a line where h is a whole number of steps, one pixel wide wherever the slope
    float q = v_h / u_step, d = abs(q - round(q)), w = max(fwidth(q), 1e-5);
    float line = 1.0 - smoothstep(0.45 * w, 1.25 * w, d), idx = abs(mod(round(q), 5.0)) < 0.5 ? 1.0 : 0.0;
    c = mix(c, INK, line * mix(0.13, 0.3, idx));
    // the shoreline: where the plaster is at the water's height
    float sd = abs(v_y - u_level), sw = max(fwidth(v_y), 1e-6);
    c = mix(c, u_shore, 1.0 - smoothstep(0.7 * sw, 1.6 * sw, sd));
  } else {
    c *= 0.985;
  }
  o = vec4(c, 1.0);
}`;
const WVS = `
in vec3 a_pos; in float a_top;
uniform mat4 u_mvp; uniform float u_level;
out float v_g;
void main(){ v_g = a_pos.y; vec3 p = vec3(a_pos.x, a_top > 0.5 ? u_level : a_pos.y, a_pos.z); gl_Position = u_mvp * vec4(p, 1.0); }`;
const WFS = `
in float v_g;
uniform float u_level; uniform float u_side;
out vec4 o;
void main(){ if (v_g > u_level) discard; vec3 w = vec3(0.38, 0.62, 0.80); float a = u_side > 0.5 ? 0.5 : 0.36; o = vec4(w * a, a); }`;
// the plinth's shadow on the paper, as the specimen's models cast theirs: a soft one thrown away from the light and a
// tight one where it touches
const SVS = `
in vec3 a_pos;
uniform mat4 u_mvp;
out vec2 v_xz;
void main(){ v_xz = a_pos.xz; gl_Position = u_mvp * vec4(a_pos, 1.0); }`;
const SFS = `
in vec2 v_xz;
uniform vec2 u_off;
out vec4 o;
float box(vec2 p, vec2 b){ vec2 d = abs(p) - b; return length(max(d, 0.0)) + min(max(d.x, d.y), 0.0); }
void main(){
  float soft = 1.0 - smoothstep(-0.25, 0.55, box(v_xz - u_off, vec2(3.0, 2.0)));
  float touch = 1.0 - smoothstep(0.0, 0.08, box(v_xz, vec2(3.0, 2.0)));
  float a = 0.1 * soft + 0.22 * touch;
  o = vec4(INK * a, a);
}`;

// the camera of the specimen: orthographic, azimuth and elevation; screen x right, screen y up, depth toward you
function cam_of(az, el) {
  const ca = Math.cos(az), sa = Math.sin(az), ce = Math.cos(el), se = Math.sin(el);
  return (q) => { const xr = q[0] * ca - q[2] * sa, zr = q[0] * sa + q[2] * ca; return [xr, q[1] * ce - zr * se, zr * ce + q[1] * se]; };
}

export function make({ stage, canvas, lang }) {
  const zh = lang === 'zh';
  const gl = context(canvas, { depth: true, antialias: true, alpha: false });
  const over = document.createElement('canvas'); over.className = 'tr-over'; stage.append(over);
  const g = over.getContext('2d');
  css('tr-css', `
.tr-over{position:absolute;inset:0;width:100%;height:100%;touch-action:none}
.tr-tog{position:absolute;left:12px;top:12px;display:flex;gap:2px;padding:3px;border-radius:22px;z-index:2;
  background:linear-gradient(180deg,rgba(255,255,255,.86),rgba(255,255,255,.6));
  box-shadow:inset 0 .75px 0 #fff,0 0 0 .5px rgba(26,27,31,.13),0 8px 20px -10px rgba(26,27,31,.25)}
.tr-tog button{width:36px;height:36px;border-radius:18px;display:grid;place-items:center;color:#62666d;transition:background .2s,color .2s}
.tr-tog button.on{background:rgba(26,27,31,.07);color:#1a1b1f}`);
  const tog = document.createElement('div'); tog.className = 'tr-tog';
  tog.innerHTML = `<button data-v="0" class="on" aria-label="${zh ? '立体' : 'model'}"><svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"><path d="M10 2.5 17 6.3v7.4L10 17.5 3 13.7V6.3z"/><path d="M3 6.3 10 10l7-3.7M10 10v7.5"/></svg></button><button data-v="1" aria-label="${zh ? '俯视' : 'from above'}"><svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.3"><rect x="3" y="3" width="14" height="14" rx="1"/><ellipse cx="11.5" cy="8.5" rx="3.2" ry="2.2"/><ellipse cx="11.5" cy="8.5" rx="6" ry="4.4" opacity=".55"/></svg></button>`;
  stage.append(tog);

  let W = 0, H = 0, dpr = 1;
  const az = new Spring(WORLD.az, 0.9, 1), el = new Spring(WORLD.el, 0.9, 1), level = new Spring(0.22, 0.4, 0.9), lift = new Spring(0, 0.25, 0.9);

  // ---------- the model: the top surface, its plinth walls, the water's sides ----------
  const prog = program(gl, FS, VS), wprog = program(gl, WFS, WVS), sprog = program(gl, SFS, SVS);
  const top = [], idx = [];
  for (let j = 0; j <= NZM; j++) for (let i = 0; i <= NXM; i++) {
    const x = -3 + 6 * i / NXM, z = -2 + 4 * j / NZM, y = -z, gr = hills_grad(x, y);
    const n = [-HS * gr[0], 1, HS * gr[1]], l = Math.hypot(...n);
    top.push(x, HS * hills(x, y), z, n[0] / l, n[1] / l, n[2] / l, hills(x, y));
  }
  for (let j = 0; j < NZM; j++) for (let i = 0; i < NXM; i++) { const a = j * (NXM + 1) + i, b = a + 1, c = a + NXM + 1, d = c + 1; idx.push(a, c, b, b, c, d); }
  // the boundary, walked anticlockwise seen from above, so that wall quads face outward
  const rim = [], NS = [0, 0, 1], NE = [1, 0, 0], NN = [0, 0, -1], NW = [-1, 0, 0];
  for (let i = 0; i <= NXM; i++) rim.push([-3 + 6 * i / NXM, 2, NS]);
  for (let j = NZM; j >= 0; j--) rim.push([3, -2 + 4 * j / NZM, NE]);
  for (let i = NXM; i >= 0; i--) rim.push([-3 + 6 * i / NXM, -2, NN]);
  for (let j = 0; j <= NZM; j++) rim.push([-3, -2 + 4 * j / NZM, NW]);
  const wall = [], wside = [];
  for (let k = 0; k < rim.length - 1; k++) {
    const [x0, z0, n] = rim[k], [x1, z1, n1] = rim[k + 1]; if (n !== n1) continue;
    const y0 = world_y(x0, z0), y1 = world_y(x1, z1);
    // two triangles per step, wound so the outside is the front
    for (const [x, y, z] of [[x0, Y_BASE, z0], [x1, Y_BASE, z1], [x0, y0, z0], [x0, y0, z0], [x1, Y_BASE, z1], [x1, y1, z1]]) wall.push(x, y, z, ...n, 0);
    for (const [x, y, z, t] of [[x0, y0, z0, 0], [x1, y1, z1, 0], [x0, y0, z0, 1], [x0, y0, z0, 1], [x1, y1, z1, 0], [x1, y1, z1, 1]]) wside.push(x, y, z, t);
  }
  const wsurf = [-3, 0, -2, 1, 3, 0, -2, 1, -3, 0, 2, 1, -3, 0, 2, 1, 3, 0, -2, 1, 3, 0, 2, 1];   // the water's top: a_top = 1 lifts it to the level
  function vao(data, layout, index) {
    const v = gl.createVertexArray(); gl.bindVertexArray(v);
    const b = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, b); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(data), gl.STATIC_DRAW);
    const stride = layout.reduce((s, [, n]) => s + n, 0) * 4; let off = 0;
    for (const [name, n, p] of layout) { const loc = gl.getAttribLocation(p.p, name); if (loc >= 0) { gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, n, gl.FLOAT, false, stride, off); } off += n * 4; }
    if (index) { const e = gl.createBuffer(); gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, e); gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(index), gl.STATIC_DRAW); }
    gl.bindVertexArray(null);
    return { v, n: index ? index.length : data.length / (stride / 4) };
  }
  const L = (p) => [['a_pos', 3, p], ['a_nrm', 3, p], ['a_h', 1, p]], LW = (p) => [['a_pos', 3, p], ['a_top', 1, p]];
  const yg = Y_BASE - 0.002, ground = [-4.6, yg, -3.6, 4.6, yg, -3.6, -4.6, yg, 3.6, -4.6, yg, 3.6, 4.6, yg, -3.6, 4.6, yg, 3.6];
  // where the light throws the plinth's middle height: away from the light, along the ground
  const lift_h = (HS * fmax - Y_BASE) * 0.5, SHADOW_OFF = [-LIGHT[0] / LIGHT[1] * lift_h, -LIGHT[2] / LIGHT[1] * lift_h];
  const top_v = vao(top, L(prog), idx), wall_v = vao(wall, L(prog)), side_v = vao(wside, LW(wprog)), surf_v = vao(wsurf, LW(wprog)), shadow_v = vao(ground, [['a_pos', 3, sprog]]);

  // the model's extent under a camera, and the matrix that fits it into the space left of the gauge
  function frame(a, e) {
    const cam = cam_of(a, e), box = { x0: 18, y0: 18, x1: W - 86, y1: H - 18 };
    let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
    for (const x of [-3, 3]) for (const z of [-2, 2]) for (const y of [Y_BASE, HS * fmax]) { const r = cam([x, y, z]); x0 = Math.min(x0, r[0]); x1 = Math.max(x1, r[0]); y0 = Math.min(y0, r[1]); y1 = Math.max(y1, r[1]); }
    const s = Math.min((box.x1 - box.x0) / (x1 - x0), (box.y1 - box.y0) / (y1 - y0));
    const ox = (box.x0 + box.x1) / 2 - s * (x0 + x1) / 2, oy = (box.y0 + box.y1) / 2 + s * (y0 + y1) / 2;   // CSS px, y down
    const px = (q) => { const r = cam(q); return [ox + s * r[0], oy - s * r[1], r[2]]; };
    // to clip space: x = 2 px / W − 1, y = 1 − 2 py / H, z = −depth / 8
    const ca = Math.cos(a), sa = Math.sin(a), ce = Math.cos(e), se = Math.sin(e), kx = 2 * s / W, ky = 2 * s / H;
    const mvp = new Float32Array([
      kx * ca, ky * -sa * se, -sa * ce / 8, 0,
      0, ky * ce, -se / 8, 0,
      kx * -sa, ky * -ca * se, -ca * ce / 8, 0,
      2 * ox / W - 1, 1 - 2 * oy / H, 0, 1,
    ]);
    return { px, mvp };
  }
  const gauge = () => ({ x: W - 44, y0: H - 30, y1: 30 });
  const lv_y = (v) => { const G = gauge(); return G.y0 + (G.y1 - G.y0) * (v - fmin) / (fmax + 0.1 - fmin); };

  function render() {
    const F = frame(az.x, el.x), wl = HS * level.x;
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.clearColor(0.984, 0.980, 0.969, 1); gl.clearDepth(1); gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    // the shadow first, on the paper, under everything
    gl.disable(gl.DEPTH_TEST); gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA); gl.disable(gl.CULL_FACE);
    use(gl, sprog, { u_mvp: F.mvp, u_off: SHADOW_OFF });
    gl.bindVertexArray(shadow_v.v); gl.drawArrays(gl.TRIANGLES, 0, shadow_v.n);
    gl.enable(gl.DEPTH_TEST); gl.depthFunc(gl.LEQUAL); gl.depthMask(true); gl.disable(gl.BLEND);
    use(gl, prog, { u_mvp: F.mvp, u_light: LIGHT, u_level: wl, u_step: 0.1, u_shore: SHORE, u_wall: 0 });
    gl.disable(gl.CULL_FACE);
    gl.bindVertexArray(top_v.v); gl.drawElements(gl.TRIANGLES, top_v.n, gl.UNSIGNED_SHORT, 0);
    use(gl, prog, { u_wall: 1 });
    gl.enable(gl.CULL_FACE); gl.cullFace(gl.BACK);
    gl.bindVertexArray(wall_v.v); gl.drawArrays(gl.TRIANGLES, 0, wall_v.n);
    // the water: translucent, over what is beneath it; only its outward sides
    gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA); gl.depthMask(false);
    use(gl, wprog, { u_mvp: F.mvp, u_level: wl, u_side: 1 });
    gl.bindVertexArray(side_v.v); gl.drawArrays(gl.TRIANGLES, 0, side_v.n);
    gl.disable(gl.CULL_FACE);
    use(gl, wprog, { u_side: 0 });
    gl.bindVertexArray(surf_v.v); gl.drawArrays(gl.TRIANGLES, 0, surf_v.n);
    gl.bindVertexArray(null); gl.depthMask(true);
    // the overlay: the gauge and its bead
    g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, W, H);
    const G = gauge(), by = lv_y(level.x);
    g.strokeStyle = GR(0.5); g.lineWidth = 1; g.beginPath(); g.moveTo(G.x, G.y0); g.lineTo(G.x, G.y1); g.stroke();
    for (let v = Math.ceil(fmin * 2) / 2; v <= fmax + 0.1; v += 0.5) { const y = lv_y(v); g.beginPath(); g.moveTo(G.x, y); g.lineTo(G.x + 5, y); g.stroke(); text(g, num(v, 1), G.x + 9, y + 4, { size: 11, color: TICK, tabular: true }); }
    g.fillStyle = 'rgba(97,158,204,0.45)'; g.fillRect(G.x - 2, by, 4, G.y0 - by);
    glass_bead(g, G.x, by, 11, lift.x, { dir: Math.PI / 2, core: 'rgb(38,89,140)' });
    text(g, num(level.x, 2), G.x - 16, by + 4, { size: 13, weight: 650, color: 'rgb(38,89,140)', tabular: true, align: 'right', halo: 4 });
  }

  const hold = drags(over, () => {
    const G = gauge(), by = lv_y(level.x);
    return [{ hit: (x, y) => { const d = Math.hypot(x - G.x, y - by); return d < 24 ? d : Math.abs(x - G.x) < 16 && y > G.y1 - 10 && y < G.y0 + 10 ? 30 : Infinity; }, down() { lift.to(1); },
      move: (x, y) => { const v = fmin + (y - G.y0) / (G.y1 - G.y0) * (fmax + 0.1 - fmin); level.snap(Math.max(fmin, Math.min(fmax + 0.1, Math.round(v * 100) / 100))); }, up() { lift.to(0); } }];
  }, { change: () => sched.wake() });
  tog.addEventListener('click', (e) => {
    const b = e.target.closest('button'); if (!b) return;
    const v = b.dataset.v === '1'; tog.querySelectorAll('button').forEach((x) => x.classList.toggle('on', x === b));
    const T = v ? TOP : WORLD; az.to(T.az); el.to(T.el); sched.wake(2000);
  });

  const sched = scheduler((dt) => { const busy = [az.step(dt), el.step(dt), level.step(dt), lift.step(dt)].some(Boolean); render(); return busy || !!hold.active; });
  function resize() {
    const r = canvas.getBoundingClientRect(); dpr = Math.min(2, devicePixelRatio || 1);
    W = r.width; H = r.height;
    for (const c of [canvas, over]) { c.width = Math.max(2, Math.round(W * dpr)); c.height = Math.max(2, Math.round(H * dpr)); }
    render();
  }
  resize();

  return {
    visible: (v) => sched.set_visible(v), resize,
    demo() { level.to(0.9); sched.wake(1500); },
    async accept() {
      // look straight down, water at a height between the hills, and read the picture back
      const save = { a: az.x, e: el.x, l: level.x }, c = 0.62;
      az.snap(TOP.az); el.snap(TOP.el); level.snap(c); render();
      const px = new Uint8Array(canvas.width * canvas.height * 4);
      gl.readPixels(0, 0, canvas.width, canvas.height, gl.RGBA, gl.UNSIGNED_BYTE, px);
      const F = frame(TOP.az, TOP.el), sh = SHORE.map((v) => v * 255);
      const shore_at = (X, Y) => {
        for (let dy = -1.5 * dpr; dy <= 1.5 * dpr; dy += 1) for (let dx = -1.5 * dpr; dx <= 1.5 * dpr; dx += 1) {
          const i = Math.round(X * dpr + dx), j = canvas.height - 1 - Math.round(Y * dpr + dy); if (i < 0 || j < 0 || i >= canvas.width || j >= canvas.height) continue;
          const o = (j * canvas.width + i) * 4; if (Math.hypot(px[o] - sh[0], px[o + 1] - sh[1], px[o + 2] - sh[2]) < 70) return true;
        }
        return false;
      };
      let found = 0, n = 0;
      for (const line of contour(hills, HILLS, 300, 200, c)) for (let k = 0; k < line.length; k += 3) {
        const [x, y] = line[k]; if (Math.abs(x) > 2.9 || Math.abs(y) > 1.9) continue;
        const q = F.px([x, HS * c, -y]); n++; if (shore_at(q[0], q[1])) found++;
      }
      // square to the screen: the four corners make an axis-aligned 3 : 2 rectangle
      const k4 = [[-3, -2], [3, -2], [3, 2], [-3, 2]].map(([x, z]) => F.px([x, Y_BASE, z]));
      const square = Math.abs(k4[0][1] - k4[1][1]) < 1e-6 && Math.abs(k4[1][0] - k4[2][0]) < 1e-6 && Math.abs(Math.abs((k4[1][0] - k4[0][0]) / (k4[1][1] - k4[2][1])) - 1.5) < 1e-6;
      az.snap(save.a); el.snap(save.e); level.snap(save.l); render(); sched.wake();
      const share = n ? found / n : 0, pass = share >= 0.97 && square && n > 100;
      return { pass, value: zh ? `俯视时 ${n} 个等高线点中 ${(share * 100).toFixed(1)}% 落在岸线上；画面横平竖直、3 : 2 ${square ? '✓' : '✗'}` : `from above, ${(share * 100).toFixed(1)}% of ${n} contour points lie on the shoreline; square to the screen at 3 : 2 ${square ? '✓' : '✗'}` };
    },
  };
}
