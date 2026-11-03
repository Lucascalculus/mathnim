// 8 · The glass loupe. A plano-convex dome of dense flint over a printed page, ray-traced per wavelength: each
// colour bends by its own index n(λ) (Cauchy), so the rim shows real dispersion and the centre stays sharp.
// A lens is a local linear map; what it does to the page near a point is its Jacobian, and that is the
// magnification you read.
import { context, program, pass, texture, scheduler, pointer, fit_canvas, clamp } from '../../lib/gl.js';

export const meta = {
  id: 'loupe',
  name: { zh: '玻璃放大镜', en: 'Glass loupe' },
  means: { zh: '透镜在每一点附近都是一个线性变换：放大多少，就是它的雅可比。', en: 'Near each point a lens is a linear map: how much it magnifies is its Jacobian.' },
  test: { zh: '在镜心实测的放大倍数 = 光线追踪算出的雅可比，误差 3% 以内', en: 'Magnification measured at the centre = the ray-traced Jacobian, within 3 %' },
};

export const LENS = { R: 0.26, Rc: 0.3, edge: 0.012, A: 1.58, B: 0.0115 };
export const n_of = (lam_nm) => LENS.A + LENS.B / ((lam_nm / 1000) ** 2);

const FS = `
in vec2 uv; out vec4 o;
uniform vec2 res; uniform sampler2D page; uniform vec2 page_size; uniform vec3 lens; uniform float Rl; uniform float Rc; uniform float edge; uniform float A; uniform float B; uniform int grid;
// the page is a sheet in world units: y ∈ [−1, 1], x ∈ [−asp, asp]
vec3 paper_at(vec2 w){ vec2 q = w / vec2(page_size.x, 1.0) * 0.5 + 0.5; return to_lin(texture(page, q).rgb); }
float top_z(vec2 d){ float r2 = dot(d, d); return lens.z + edge + sqrt(max(Rc * Rc - r2, 0.0)) - sqrt(Rc * Rc - Rl * Rl); }
// where a vertical view ray through screen point w lands on the page after the lens, for index n
vec2 trace(vec2 w, float n, out float ok){
  vec2 d = w - lens.xy; float r = length(d); ok = 1.0;
  float zc = top_z(d);
  vec3 N = normalize(vec3(d, sqrt(max(Rc * Rc - r * r, 1e-6))));
  vec3 v = vec3(0, 0, -1);
  vec3 t1 = refract(v, N, 1.0 / n);
  vec3 q = vec3(w, zc) + t1 * ((zc - lens.z) / -t1.z);
  vec3 t2 = refract(t1, vec3(0, 0, 1), n);
  if (dot(t2, t2) < 0.5){ ok = 0.0; return q.xy; }
  return q.xy + t2.xy * (lens.z / -t2.z);
}
vec3 studio(vec3 r){
  float box = smoothstep(0.86, 0.97, dot(r, normalize(vec3(-0.55, 0.45, 0.7))));
  float strip = smoothstep(0.93, 0.99, dot(r, normalize(vec3(0.75, -0.25, 0.6))));
  return mix(vec3(0.55, 0.56, 0.58), vec3(0.92), smoothstep(-0.2, 0.9, r.z)) + vec3(4.0) * box + vec3(1.2) * strip;
}
void main(){
  float asp = res.x / res.y;
  vec2 w = (uv * 2.0 - 1.0) * vec2(asp, 1.0);
  vec2 d = w - lens.xy; float r = length(d);
  vec3 col;
  if (r < Rl){
    // eight wavelengths, each with its own index; their colours are weighted to sum to white
    vec3 acc = vec3(0), wsum = vec3(0);
    for (int i = 0; i < 8; i++){
      float lam = 410.0 + float(i) * 40.0;
      vec3 wt = max(xyz_to_lin_srgb(cie_xyz(lam)), 0.0) + vec3(0.0, 0.0, 0.0);
      float ok; vec2 hit = trace(w, A + B / ((lam / 1000.0) * (lam / 1000.0)), ok);
      acc += wt * paper_at(hit) * ok; wsum += wt;
    }
    col = acc / wsum;
    // the glass: a trace of absorption, the dome's reflection of the studio, the ground edge
    vec3 N = normalize(vec3(d, sqrt(max(Rc * Rc - r * r, 1e-6))));
    float cosi = N.z, F = 0.04 + 0.96 * pow(1.0 - cosi, 5.0);
    col = col * vec3(0.975, 0.985, 0.98) * (1.0 - F) + studio(reflect(vec3(0, 0, -1), N)) * F;
    float rim = smoothstep(Rl - 0.012, Rl, r);
    col = mix(col, to_lin(vec3(0.80, 0.82, 0.82)), rim * 0.85);
  } else {
    col = paper_at(w);
    // the lens's shadow from the high light on the upper left: dark under the ground edge, with the light it
    // gathers brightened into a spot
    vec2 so = d - vec2(0.05, -0.07) * (lens.z / 0.08);
    float rr = length(so);
    float ring = smoothstep(Rl + 0.03, Rl, rr) * smoothstep(Rl - 0.06, Rl - 0.01, rr);
    float spot = exp(-dot(so, so) / (0.004 + 0.02 * lens.z));
    col *= 1.0 - 0.22 * ring;
    col *= 1.0 + 0.55 * spot * smoothstep(Rl, Rl * 0.6, rr);
  }
  col = col / (1.0 + 0.08 * col);
  o = vec4(to_srgb(col * 1.04), 1.0);
}`;

// the printed page: small type and a figure, drawn once with the canvas 2D API
function make_page(lang, W, H, grid) {
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  const g = c.getContext('2d');
  g.fillStyle = '#fbfaf7'; g.fillRect(0, 0, W, H);
  if (grid) {
    g.strokeStyle = '#1a1b1f'; g.lineWidth = 2;
    for (let x = 0; x <= W; x += grid) { g.beginPath(); g.moveTo(x + 0.5, 0); g.lineTo(x + 0.5, H); g.stroke(); }
    return c;
  }
  const s = W / 2048, ink = '#1a1b1f', ink2 = '#44464d', sans = '-apple-system, "PingFang SC", "Noto Sans SC", sans-serif', serif = '"Songti SC", "Noto Serif SC", Georgia, serif';
  // a figure: level sets of a quadratic cost and the wall
  const cx = 1340 * s, cy = 600 * s;
  g.save(); g.translate(cx, cy); g.rotate(-0.5);
  for (let k = 1; k <= 9; k++) { g.beginPath(); g.ellipse(0, 0, 60 * k * s, 34 * k * s, 0, 0, Math.PI * 2); g.strokeStyle = k % 3 ? 'rgba(26,27,31,.28)' : 'rgba(26,27,31,.6)'; g.lineWidth = (k % 3 ? 1.2 : 2) * s; g.stroke();
    g.fillStyle = ink2; g.font = `${11 * s}px ${sans}`; g.fillText((k * k * 0.25).toFixed(2), 60 * k * s + 4 * s, 3 * s); }
  g.restore();
  g.beginPath(); g.moveTo(980 * s, 160 * s); g.lineTo(1500 * s, 1060 * s); g.strokeStyle = '#c8861a'; g.lineWidth = 5 * s; g.stroke();
  g.fillStyle = '#2f5bd2'; g.beginPath(); g.arc(1180 * s, 520 * s, 9 * s, 0, Math.PI * 2); g.fill();
  g.fillStyle = ink; g.font = `600 ${26 * s}px ${sans}`;
  g.fillText(lang === 'zh' ? '代价的等高线' : 'Level sets of the cost', 980 * s, 120 * s);
  // body text, small
  const body = lang === 'zh'
    ? ['同一条椭圆上的每一个计划，代价都一样。', '越往里，代价越小；谷底在墙的另一边。', '球沿着墙滑下来，停在能到的最低处：', '那里，等高线第一次碰到允许的区域。', '碰到的那道墙，就是起作用的约束，', '它的乘子 λ 大于零；其余的 λ 都是 0。', '把放大镜移到数字上，看清每一圈的代价。']
    : ['Every plan on one ellipse costs the same.', 'Further in, the cost is lower; the bottom is beyond the wall.', 'The ball slides down the wall and stops at the lowest point it can reach:', 'where a level set first touches the allowed region.', 'The wall it touches is the active constraint;', 'its multiplier λ is positive, and every other λ is 0.', 'Under the glass each ring\'s cost can be read.'];
  g.font = `${15 * s}px ${serif}`; g.fillStyle = ink;
  body.forEach((t, i) => g.fillText(t, 140 * s, (260 + i * 30) * s));
  g.font = `600 ${40 * s}px ${sans}`; g.fillText(lang === 'zh' ? '约束起作用的时候' : 'When a constraint is active', 140 * s, 170 * s);
  // a small table of numbers
  g.font = `${12 * s}px ${sans}`; g.fillStyle = ink2;
  const rows = [['a₁', '0.549', '0.552', '0.548'], ['a₂', '0.252', '0.249', '0.253'], ['J', '0.4411', '0.4409', '0.4413'], ['λ', '0.318', '0.000', '0.000']];
  rows.forEach((r, i) => r.forEach((t, j) => g.fillText(t, (140 + j * 110) * s, (560 + i * 24) * s)));
  g.strokeStyle = 'rgba(26,27,31,.35)'; g.lineWidth = 1 * s; g.beginPath(); g.moveTo(140 * s, 546 * s); g.lineTo(560 * s, 546 * s); g.stroke();
  // a hairline ruler along the bottom: millimetres
  for (let i = 0; i <= 160; i++) { const x = (140 + i * 10) * s, L = i % 10 ? (i % 5 ? 8 : 14) : 22; g.beginPath(); g.moveTo(x, 1180 * s); g.lineTo(x, (1180 - L) * s); g.strokeStyle = ink; g.lineWidth = 1 * s; g.stroke(); if (i % 10 === 0) { g.font = `${10 * s}px ${sans}`; g.fillText(String(i / 10), x - 3 * s, 1196 * s); } }
  return c;
}

export function make({ stage, canvas, hud, lang }) {
  const gl = context(canvas);
  fit_canvas(canvas, 2);
  const asp = canvas.width / canvas.height;
  const prog = program(gl, FS);
  const upload = (cv) => { const t = texture(gl, cv.width, cv.height, { type: 'u8', mip: true }); gl.bindTexture(gl.TEXTURE_2D, t.tex); gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, cv); gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false); gl.generateMipmap(gl.TEXTURE_2D); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR); return t; };
  const PW = 2048, PH = Math.round(2048 / asp);
  let page = upload(make_page(lang, PW, PH, 0));
  const L = { x: 0.18, y: 0.05, z: 0.08, goal: [0.18, 0.05, 0.08] };
  const draw = (pg = page) => pass(gl, prog, { res: [canvas.width, canvas.height], page: pg, page_size: [asp, 1], lens: [L.x, L.y, L.z], Rl: LENS.R, Rc: LENS.Rc, edge: LENS.edge, A: LENS.A, B: LENS.B });
  const sched = scheduler((dt) => {
    let moving = false;
    for (const [k, i] of [['x', 0], ['y', 1], ['z', 2]]) { const v = L.goal[i] - L[k]; L[k] += v * Math.min(1, dt * 12); if (Math.abs(v) > 1e-4) moving = true; }
    draw(); hud.innerHTML = `${lang === 'zh' ? '镜心放大' : 'magnification'} <b>${jacobian(L.z).toFixed(2)}×</b>`; return moving;
  });
  let grab = null;
  pointer(canvas, (kind, p) => {
    const x = (p.x * 2 - 1) * asp, y = p.y * 2 - 1;
    if (kind === 'down') grab = Math.hypot(x - L.x, y - L.y) < LENS.R * 1.3 ? [x - L.goal[0], y - L.goal[1]] : [0, 0];
    if ((kind === 'down' || kind === 'move') && p.down && grab) { L.goal[0] = clamp(x - grab[0], -asp + 0.2, asp - 0.2); L.goal[1] = clamp(y - grab[1], -0.8, 0.8); sched.wake(); }
    if (kind === 'up') grab = null;
  });
  // the hand lifts the lens: double tap
  canvas.addEventListener('dblclick', () => { L.goal[2] = L.goal[2] > 0.1 ? 0.08 : 0.16; sched.wake(); });
  draw(); hud.innerHTML = `${lang === 'zh' ? '镜心放大' : 'magnification'} <b>${jacobian(L.z).toFixed(2)}×</b>`;
  return {
    visible: (v) => sched.set_visible(v), resize: () => { fit_canvas(canvas, 2); draw(); },
    demo() { L.goal = [-0.55, 0.35, 0.08]; sched.wake(); },
    async accept() {
      // print a calibrated page of vertical lines, put the lens at the centre, and measure the spacing of the
      // lines seen through it against the spacing outside
      const grid = 16, cal = upload(make_page(lang, PW, PH, grid));
      const saved = [L.x, L.y, L.z]; L.x = 0; L.y = 0; L.z = 0.08; draw(cal);
      const Wc = canvas.width, row = new Uint8Array(Wc * 4);
      gl.readPixels(0, canvas.height >> 1, Wc, 1, gl.RGBA, gl.UNSIGNED_BYTE, row);
      const dark = (i) => row[i * 4] < 128;
      const centres = []; for (let i = 1; i < Wc; i++) if (dark(i) && !dark(i - 1)) { let j = i; while (j < Wc && dark(j)) j++; centres.push((i + j - 1) / 2); }
      const cxp = Wc / 2, lens_px = LENS.R / (2 * asp) * Wc;
      const inner = centres.filter((c) => Math.abs(c - cxp) < lens_px * 0.25), outer = centres.filter((c) => c < cxp - lens_px * 1.6);   // plain paper, one side only (not across the lens)
      const spacing = (a) => (a[a.length - 1] - a[0]) / (a.length - 1);
      const m_meas = spacing(inner) / spacing(outer), m_calc = jacobian(0.08);
      L.x = saved[0]; L.y = saved[1]; L.z = saved[2]; draw();
      const err = Math.abs(m_meas / m_calc - 1);
      return { pass: err < 0.03, value: `${lang === 'zh' ? '实测' : 'measured'} ${m_meas.toFixed(3)}×, ${lang === 'zh' ? '雅可比' : 'Jacobian'} ${m_calc.toFixed(3)}× (${(err * 100).toFixed(1)}%)` };
    },
  };
}
// the same trace on the CPU, at 550 nm, and its derivative at the centre: the Jacobian of page → screen
function trace_cpu(x, gap, n) {
  const { R, Rc, edge } = LENS, r = Math.abs(x), zc = gap + edge + Math.sqrt(Rc * Rc - r * r) - Math.sqrt(Rc * Rc - R * R);
  const N = [x / Rc, 0, Math.sqrt(Rc * Rc - r * r) / Rc];
  const refr = (I, N, eta) => { const c = -(I[0] * N[0] + I[1] * N[1] + I[2] * N[2]), k = 1 - eta * eta * (1 - c * c); return I.map((v, i) => eta * v + (eta * c - Math.sqrt(k)) * N[i]); };
  const t1 = refr([0, 0, -1], N, 1 / n), qx = x + t1[0] * ((zc - gap) / -t1[2]);
  const t2 = refr(t1, [0, 0, 1], n); return qx + t2[0] * (gap / -t2[2]);
}
export function jacobian(gap, lam = 550) { const n = n_of(lam), e = 1e-4; return 1 / ((trace_cpu(e, gap, n) - trace_cpu(-e, gap, n)) / (2 * e)); }
