// M2 · A linear map as fabric. The plane is woven cloth and A deforms it: the weave stretches exactly as A says,
// the unit square (stitched in cobalt) becomes a parallelogram of area |det A|, and the cloth wrinkles across the
// direction A compresses (a singular value below 1) and goes taut where it stretches. A negative determinant turns
// the cloth over: you see its back. Drag the tips of î and ĵ.
// As a library primitive: a material for any planar map, linear or not (its Jacobian gives the wrinkles).
import { context, program, scheduler, fit_canvas, m4, use, clamp } from '../../lib/gl.js';
import { Spring, SANS } from '../../lib/ui.js';

export const meta = {
  id: 'linmap',
  name: { zh: '线性变换 · 布', en: 'A linear map as fabric' },
  means: { zh: '平面是一块织物，矩阵把它拉伸：单位方格的面积变成 |det A|，被压缩的方向起皱，行列式为负时布翻了面。', en: 'The plane is cloth that the matrix stretches: the unit square\'s area becomes |det A|, the compressed direction wrinkles, and a negative determinant turns the cloth over.' },
  test: { zh: '俯视时单位方格的像素面积 ÷ 原来 = |det A|（±2%）；det < 0 时看到的是反面', en: 'Seen from above, the unit square\'s pixel area ÷ the original = |det A| (±2 %); det < 0 shows the back' },
  wide: true,
};

const NG = 240, EXT = [2.0, 1.35];
const VS = `
uniform mat4 vp; uniform mat2 A; uniform vec2 ext; uniform int n; uniform vec4 svd; uniform float wr;
out vec2 X; out vec3 wpos; out vec3 nrm;
// the cloth wrinkles across the material direction the map compresses: height ∝ (1 − σ₂) along v₂
// folds are ridges (|sin|), their height grows with how much is compressed, and they taper along their length
float wrinkle(vec2 X){ vec2 v2 = svd.zw; float c = max(0.0, 1.0 - svd.y) * wr; float along = dot(X, vec2(-v2.y, v2.x)); return c * 0.035 * (1.0 - abs(sin(dot(X, v2) * 11.0 + 0.6 * sin(along * 2.3)))) * (0.6 + 0.4 * cos(along * 1.3)); }
void main(){
  int i = gl_VertexID % (n + 1), j = gl_VertexID / (n + 1);
  X = (vec2(float(i), float(j)) / float(n) * 2.0 - 1.0) * ext;
  vec2 Y = A * X; float z = wrinkle(X);
  vec2 e = vec2(0.01, 0.0);
  vec3 px = vec3(A * (X + e.xy), wrinkle(X + e.xy)) - vec3(Y, z), py = vec3(A * (X + e.yx), wrinkle(X + e.yx)) - vec3(Y, z);
  nrm = normalize(cross(px, py));
  wpos = vec3(Y.x, z, -Y.y);
  gl_Position = vp * vec4(wpos, 1.0);
}`;
const FS = `
in vec2 X; in vec3 wpos; in vec3 nrm; out vec4 o; uniform float test; uniform vec3 eye;
// a plain weave in material coordinates: warp threads along x, weft along y, over and under in a checker
vec3 weave(vec2 X, bool back, out float h){
  float f = 22.0; vec2 q = X * f, c = floor(q), r = fract(q) - 0.5;
  // once a thread is thinner than a few pixels, the weave fades to its average colour (no shimmer)
  float px = length(fwidth(q)), detail = 1.0 - smoothstep(0.18, 0.45, px);
  bool warp_over = mod(c.x + c.y, 2.0) < 1.0;
  float tw = 1.0 - pow(abs(r.y) * 2.0, 2.0), tf = 1.0 - pow(abs(r.x) * 2.0, 2.0);
  float over = warp_over ? tw : tf;
  h = mix(0.62, over * (0.65 + 0.35 * (warp_over ? cos(r.x * 3.14) : cos(r.y * 3.14))), detail);
  float slub = 0.97 + 0.06 * hash12(warp_over ? vec2(c.y, 1.0) : vec2(c.x, 7.0));   // threads differ slightly, as linen does
  vec3 warp = back ? vec3(0.40, 0.41, 0.44) : vec3(0.93, 0.915, 0.88), weft = back ? vec3(0.34, 0.35, 0.38) : vec3(0.88, 0.865, 0.83);
  vec3 col = mix((warp + weft) * 0.5, warp_over ? warp : weft, detail) * slub;
  // the unit square is woven with a cobalt weft
  if (X.x > 0.0 && X.x < 1.0 && X.y > 0.0 && X.y < 1.0) col = mix(col, to_lin(COBALT) * 1.45, warp_over ? 0.25 * detail + 0.45 * (1.0 - detail) : 0.85 * detail + 0.45 * (1.0 - detail));
  return col * (0.7 + 0.3 * h);
}
void main(){
  bool back = !gl_FrontFacing;
  if (test > 0.5){ o = vec4(X.x > 0.0 && X.x < 1.0 && X.y > 0.0 && X.y < 1.0 ? 1.0 : 0.0, back ? 1.0 : 0.0, 0, 1); return; }
  float h; vec3 base = weave(X, back, h);
  vec3 n = normalize(back ? -nrm : nrm); if (n.y < 0.0) n = -n;
  vec3 L = normalize(vec3(-0.4, 1.0, 0.35)), V = normalize(eye - wpos);
  float diff = 0.5 + 0.5 * max(dot(n, L), 0.0);
  // fibres scatter light along the thread: a soft sheen
  float sheen = pow(1.0 - max(dot(n, V), 0.0), 3.0) * 0.25 + pow(max(dot(reflect(-L, n), V), 0.0), 18.0) * 0.12 * h;
  vec3 c = base * diff + vec3(sheen);
  // stitches every whole unit: a running stitch in ink, so tiles can be counted
  vec2 g = abs(fract(X + 0.5) - 0.5) / fwidth(X);
  float st = 1.0 - min(min(g.x, g.y) / 1.2, 1.0);
  float dash = step(0.35, fract((abs(g.x) < abs(g.y) ? X.y : X.x) * 7.0));
  c = mix(c, to_lin(INK) * (back ? 1.8 : 1.0), st * dash * 0.75);
  // the cloth's edge frays into the paper
  vec2 ed = (vec2(${EXT[0]}, ${EXT[1]}) - abs(X));
  c = mix(to_lin(PAPER), c, smoothstep(0.0, 0.08, min(ed.x, ed.y)));
  o = vec4(to_srgb(c), 1.0);
}`;

export function make({ stage, canvas, hud, lang }) {
  const zh = lang === 'zh';
  const gl = context(canvas, { antialias: true, depth: true });
  fit_canvas(canvas, 2);
  const prog = program(gl, FS, VS);
  // a quad grid as triangles
  const idx = new Uint32Array(NG * NG * 6); let k = 0;
  for (let j = 0; j < NG; j++) for (let i = 0; i < NG; i++) { const a = j * (NG + 1) + i, b = a + 1, c = a + NG + 1, d = c + 1; idx.set([a, b, d, a, d, c], k); k += 6; }
  const vao = gl.createVertexArray(); gl.bindVertexArray(vao); const ib = gl.createBuffer(); gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ib); gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, idx, gl.STATIC_DRAW); gl.bindVertexArray(null);
  // A's columns are î and ĵ, each on a spring
  const M = { a: new Spring(1, 0.35, 0.85), b: new Spring(0, 0.35, 0.85), c: new Spring(0, 0.35, 0.85), d: new Spring(1, 0.35, 0.85) };
  let tilt = 0.24;
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;pointer-events:none;overflow:visible';
  stage.append(svg);
  function cam() {
    const asp = canvas.width / canvas.height, d = asp < 0.8 ? 15 : 10.5, el = Math.PI / 2 - tilt;
    const eye = [0, Math.sin(el) * d, Math.cos(el) * d];
    const vp = m4.mul(m4.persp(0.52, asp, 0.1, 50), m4.look(eye, [0, 0, 0], [0, 0, -1]));
    return { vp, eye };
  }
  function project(vp, x, y) { const v = [x, 0, -y, 1], o = [0, 0, 0, 0]; for (let i = 0; i < 4; i++) for (let k = 0; k < 4; k++) o[i] += vp[k * 4 + i] * v[k]; const r = canvas.getBoundingClientRect(); return [(o[0] / o[3] * 0.5 + 0.5) * r.width, (1 - (o[1] / o[3] * 0.5 + 0.5)) * r.height]; }
  function svd2() {
    // singular values and the right singular vectors of A (material directions)
    const a = M.a.x, b = M.c.x, c = M.b.x, d = M.d.x;   // A = [[a, b], [c, d]] with columns (a, c) and (b, d)
    const ata = [a * a + c * c, a * b + c * d, b * b + d * d], tr = ata[0] + ata[2], det = ata[0] * ata[2] - ata[1] * ata[1], q = Math.sqrt(Math.max(0, tr * tr / 4 - det));
    const l1 = tr / 2 + q, l2 = Math.max(0, tr / 2 - q), th = 0.5 * Math.atan2(2 * ata[1], ata[0] - ata[2]);
    return [Math.sqrt(l1), Math.sqrt(l2), -Math.sin(th), Math.cos(th)];
  }
  function draw(test = 0) {
    const C = cam();
    gl.bindFramebuffer(gl.FRAMEBUFFER, null); gl.viewport(0, 0, canvas.width, canvas.height);
    gl.clearColor(test ? 0 : 0.984, test ? 0 : 0.98, test ? 0 : 0.969, 1); gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.enable(gl.DEPTH_TEST); gl.disable(gl.CULL_FACE);
    use(gl, prog, { vp: C.vp, A: new Float32Array([M.a.x, M.b.x, M.c.x, M.d.x]), ext: EXT, n: NG, svd: svd2(), wr: test ? 0 : 1, test, eye: C.eye });
    gl.bindVertexArray(vao); gl.drawElements(gl.TRIANGLES, idx.length, gl.UNSIGNED_INT, 0); gl.bindVertexArray(null);
    gl.disable(gl.DEPTH_TEST);
    if (!test) overlay(C);
  }
  function overlay(C) {
    const o = project(C.vp, 0, 0), i = project(C.vp, M.a.x, M.b.x), j = project(C.vp, M.c.x, M.d.x);
    const det = M.a.x * M.d.x - M.c.x * M.b.x, tr = M.a.x + M.d.x, disc = tr * tr / 4 - det;
    let eig = '';
    if (disc >= 0) {
      for (const s of [1, -1]) {
        const l = tr / 2 + s * Math.sqrt(disc); let v = Math.abs(M.c.x) > 1e-6 ? [l - M.d.x, M.b.x] : Math.abs(M.b.x) > 1e-6 ? [M.c.x, l - M.a.x] : (s > 0 ? [1, 0] : [0, 1]);
        if (Math.abs(M.c.x) <= 1e-6 && Math.abs(M.b.x) <= 1e-6) v = s > 0 ? [1, 0] : [0, 1];
        const n = Math.hypot(...v) || 1, p = project(C.vp, v[0] / n * 4, v[1] / n * 4), q = project(C.vp, -v[0] / n * 4, -v[1] / n * 4);
        eig += `<line x1="${q[0]}" y1="${q[1]}" x2="${p[0]}" y2="${p[1]}" stroke="#1a1b1f" stroke-opacity=".35" stroke-width="1.2" stroke-dasharray="2 5"/><text x="${p[0] + 6}" y="${p[1] - 6}" font-family="${SANS}" font-size="13" fill="#44464d">λ = ${l.toFixed(2)}</text>`;
      }
    }
    const arrow = (p, col, lab) => { const dx = p[0] - o[0], dy = p[1] - o[1], L = Math.hypot(dx, dy) || 1, ux = dx / L, uy = dy / L; return `<line x1="${o[0]}" y1="${o[1]}" x2="${p[0] - ux * 14}" y2="${p[1] - uy * 14}" stroke="${col}" stroke-width="3" stroke-linecap="round"/><text x="${p[0] + 16}" y="${p[1] + 5}" font-family="Georgia, serif" font-style="italic" font-size="18" fill="${col}">${lab}</text>`; };
    const bead = (p) => `<circle cx="${p[0]}" cy="${p[1] + 2}" r="15" fill="#1a1b1f" opacity=".12" filter="blur(3px)"/><circle cx="${p[0]}" cy="${p[1]}" r="14" fill="rgba(255,255,255,.92)" stroke="rgba(26,27,31,.18)" stroke-width=".75"/><circle cx="${p[0]}" cy="${p[1]}" r="4" fill="#1a1b1f"/>`;
    svg.innerHTML = eig + arrow(i, '#1a1b1f', 'î') + arrow(j, '#1a1b1f', 'ĵ') + bead(i) + bead(j);
    hud.innerHTML = `det A = <b>${det.toFixed(2)}</b>${det < 0 ? (zh ? ' · 布翻过来了' : ' · the cloth is turned over') : ''}`;
    G.i = i; G.j = j;
  }
  const G = { i: [0, 0], j: [0, 0] };
  const sched = scheduler((dt) => { let b = false; for (const s of Object.values(M)) b = s.step(dt) || b; draw(); return b; });
  // dragging a tip: unproject onto the plane
  function plane_at(x, y) {
    const C = cam(), inv = m4.inv(C.vp), r = canvas.getBoundingClientRect(), nx = x / r.width * 2 - 1, ny = 1 - y / r.height * 2;
    const a = mul(inv, [nx, ny, -1, 1]), b = mul(inv, [nx, ny, 1, 1]); const p0 = a.slice(0, 3).map((v) => v / a[3]), p1 = b.slice(0, 3).map((v) => v / b[3]);
    const t = p0[1] / (p0[1] - p1[1]); return [p0[0] + (p1[0] - p0[0]) * t, -(p0[2] + (p1[2] - p0[2]) * t)];
  }
  let drag = null;
  stage.addEventListener('pointerdown', (e) => { const r = canvas.getBoundingClientRect(), x = e.clientX - r.left, y = e.clientY - r.top; drag = Math.hypot(x - G.i[0], y - G.i[1]) < 30 ? 'i' : Math.hypot(x - G.j[0], y - G.j[1]) < 30 ? 'j' : null; if (drag) stage.setPointerCapture(e.pointerId); });
  stage.addEventListener('pointermove', (e) => { if (!drag) return; const r = canvas.getBoundingClientRect(), [px, py] = plane_at(e.clientX - r.left, e.clientY - r.top); const v = [clamp(px, -2.6, 2.6), clamp(py, -1.8, 1.8)]; if (drag === 'i') { M.a.to(v[0]); M.b.to(v[1]); } else { M.c.to(v[0]); M.d.to(v[1]); } sched.wake(); });
  stage.addEventListener('pointerup', () => { drag = null; });
  draw();
  const set = (a, b, c, d) => { M.a.to(a); M.b.to(b); M.c.to(c); M.d.to(d); sched.wake(2000); };
  return {
    visible: (v) => sched.set_visible(v), resize: () => { fit_canvas(canvas, 2); draw(); },
    demo() { set(1.5, 0.35, 0.6, 0.55); }, set,
    async accept() {
      // from straight above, count the unit square's pixels at the identity and under A; check the back face for det < 0
      const saved = tilt; tilt = 0; const count = () => { draw(1); const W = canvas.width, H = canvas.height, px = new Uint8Array(W * H * 4); gl.readPixels(0, 0, W, H, gl.RGBA, gl.UNSIGNED_BYTE, px); let n = 0, back = 0; for (let i = 0; i < W * H; i++) { if (px[i * 4] > 127) { n++; if (px[i * 4 + 1] > 127) back++; } } return [n, back]; };
      const keep = Object.fromEntries(Object.entries(M).map(([k, s]) => [k, s.x]));
      const snap = (a, b, c, d) => { M.a.snap(a); M.b.snap(b); M.c.snap(c); M.d.snap(d); };
      snap(1, 0, 0, 1); const [n0] = count();
      let worst = 0, flips = true;
      for (const [a, b, c, d] of [[1.5, 0.3, 0.4, 0.8], [0.6, -0.4, 0.9, 1.3], [1.2, 0.5, 0.9, -0.7]]) { snap(a, b, c, d); const [n, back] = count(), det = a * d - c * b; worst = Math.max(worst, Math.abs(n / n0 / Math.abs(det) - 1)); if ((det < 0) !== (back > n * 0.9)) flips = false; }
      snap(keep.a, keep.b, keep.c, keep.d); tilt = saved; draw();
      return { pass: worst < 0.02 && flips, value: `${zh ? '面积与 |det| 之差' : 'area vs |det|'} ${(worst * 100).toFixed(2)}%; ${zh ? '负行列式见反面' : 'back side for det < 0'} ${flips ? '✓' : '✗'}` };
    },
  };
}
function mul(m, v) { const o = [0, 0, 0, 0]; for (let i = 0; i < 4; i++) for (let k = 0; k < 4; k++) o[i] += m[k * 4 + i] * v[k]; return o; }
