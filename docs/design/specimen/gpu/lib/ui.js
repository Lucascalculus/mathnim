// Shared pieces for the interface materials: a lesson page drawn as content to sit under glass, focus or ink;
// springs (SwiftUI's response / damping fraction, interruptible, velocity kept); a texture uploader.
import { texture } from './gl.js';

export const SANS = '-apple-system, BlinkMacSystemFont, "PingFang SC", "Hiragino Sans GB", "Noto Sans SC", "Noto Sans CJK SC", sans-serif';
export const SERIF = '"Songti SC", "STSong", "Noto Serif SC", "Noto Serif CJK SC", Georgia, serif';
export const C = { paper: '#fbfaf7', ink: '#1a1b1f', ink2: '#44464d', graphite: '#8d9198', cobalt: '#2f5bd2', ochre: '#c8861a', teal: '#11899e', violet: '#6a4ec4', viridian: '#13876a', vermilion: '#e3472c' };

const TEXT = {
  zh: {
    kicker: '模型预测控制 · 第 4 课',
    title: '约束起作用的时候',
    p1: [['把这颗', 0], ['球', 'cobalt'], ['放开，它会停在哪儿？代价是一座山谷，', 0], ['墙', 'ochre'], ['挡在谷底和你之间。', 0]],
    p2: '球滚下来，被墙挡住，再沿着墙滑到最低的地方停下。从正上方看，山谷变成一圈圈等高线；水从谷底涨起来，第一次碰到允许区域的地方，就是最好的计划。',
    p3: '碰到的那道墙，就是起作用的约束。它的乘子 λ 大于零；没碰到的边，λ 都是 0。',
    cap: '图 4.2　代价的等高线与墙',
    list: ['预测：三秒后卡车在哪儿', '代价：离目标多远、用力多猛', '约束：不能越过墙'],
    p4: '下一步，我们把这三件事写成一个二次规划，并让它每 0.1 秒解一次。',
  },
  en: {
    kicker: 'Model predictive control · Lesson 4',
    title: 'When a constraint is active',
    p1: [['Let go of the ', 0], ['ball', 'cobalt'], [': where will it stop? The cost is a valley, and a ', 0], ['wall', 'ochre'], [' stands between you and its bottom.', 0]],
    p2: 'The ball rolls down, meets the wall, and slides along it to the lowest point it can reach. Seen from above, the valley becomes level sets; water rising from the bottom first touches the allowed region at the best plan.',
    p3: 'The wall it touches is the active constraint. Its multiplier λ is positive; every edge it does not touch has λ = 0.',
    cap: 'Figure 4.2  Level sets of the cost, and the wall',
    list: ['Predict: where the cart is in three seconds', 'Cost: how far from the goal, how hard the push', 'Constraint: never past the wall'],
    p4: 'Next we write these three as a quadratic programme and solve it every 0.1 seconds.',
  },
};

// wrap a run of styled spans into lines of width w; returns [[{t, color}]]
function wrap(g, spans, w) {
  const lines = [[]]; let x = 0;
  for (const [t, col] of spans) {
    const units = /[　-鿿]/.test(t) ? [...t] : t.split(/(\s+)/);
    for (const u of units) {
      const uw = g.measureText(u).width;
      if (x + uw > w && x > 0 && u.trim()) { lines.push([]); x = 0; if (!u.trim()) continue; }
      lines[lines.length - 1].push({ t: u, col, x }); x += uw;
    }
  }
  return lines;
}

// a lesson page, w × h device pixels, scale = device pixels per CSS pixel
export function lesson_page(w, h, lang = 'zh', o = {}) {
  const T = TEXT[lang], cv = document.createElement('canvas'); cv.width = w; cv.height = h;
  const g = cv.getContext('2d'), s = o.scale || 1, pad = Math.max(24 * s, w * 0.07), col = Math.min(w - 2 * pad, 640 * s);
  g.fillStyle = C.paper; g.fillRect(0, 0, w, h);
  let y = (w / s < 600 ? 92 : 56) * s;
  const x0 = o.center ? (w - col) / 2 : pad;
  g.textBaseline = 'alphabetic';
  g.font = `500 ${13 * s}px ${SANS}`; g.fillStyle = C.graphite; g.fillText(T.kicker, x0, y); y += 40 * s;
  g.font = `600 ${32 * s}px ${SANS}`; g.fillStyle = C.ink; g.fillText(T.title, x0, y); y += 40 * s;
  const para = (spans, size = 18, lh = 1.75, color = C.ink) => {
    g.font = `${size * s}px ${SERIF}`;
    for (const line of wrap(g, typeof spans === 'string' ? [[spans, 0]] : spans, col)) {
      for (const u of line) { g.fillStyle = u.col ? C[u.col] : color; if (u.col) g.font = `600 ${size * s}px ${SERIF}`; else g.font = `${size * s}px ${SERIF}`; g.fillText(u.t, x0 + u.x, y); }
      y += size * lh * s;
    }
    y += 10 * s;
  };
  para(T.p1);
  // the figure: level sets, the wall, the ball
  const fh = Math.min(300 * s, col * 0.55), fx = x0, fy = y;
  g.fillStyle = '#f3f1ec'; roundrect(g, fx, fy, col, fh, 10 * s); g.fill();
  g.save(); g.beginPath(); roundrect(g, fx, fy, col, fh, 10 * s); g.clip();
  const cx = fx + col * 0.68, cy = fy + fh * 0.42;
  for (let k = 9; k >= 1; k--) {
    g.beginPath(); g.ellipse(cx, cy, k * col * 0.055, k * col * 0.032, -0.45, 0, Math.PI * 2);
    g.fillStyle = `rgba(47,91,210,${0.018 + (10 - k) * 0.006})`; g.fill();
    g.strokeStyle = k % 3 ? 'rgba(26,27,31,.22)' : 'rgba(26,27,31,.5)'; g.lineWidth = (k % 3 ? 1 : 1.6) * s; g.stroke();
  }
  g.beginPath(); g.moveTo(fx + col * 0.30, fy - 4); g.lineTo(fx + col * 0.62, fy + fh + 4); g.strokeStyle = C.ochre; g.lineWidth = 5 * s; g.stroke();
  g.fillStyle = 'rgba(141,145,152,.18)'; g.beginPath(); g.moveTo(fx + col * 0.30 + 3 * s, fy - 4); g.lineTo(fx + col, fy - 4); g.lineTo(fx + col, fy + fh + 4); g.lineTo(fx + col * 0.62 + 3 * s, fy + fh + 4); g.fill();
  const bx = fx + col * 0.465, by = fy + fh * 0.52;
  const grd = g.createRadialGradient(bx - 4 * s, by - 5 * s, 1, bx, by, 12 * s); grd.addColorStop(0, '#7f9ff0'); grd.addColorStop(1, C.cobalt);
  g.beginPath(); g.arc(bx, by, 11 * s, 0, Math.PI * 2); g.fillStyle = grd; g.fill();
  g.font = `600 ${13 * s}px ${SANS}`; g.fillStyle = C.ochre; g.fillText(lang === 'zh' ? '墙' : 'wall', fx + col * 0.42, fy + fh * 0.2);
  g.fillStyle = C.ink2; g.fillText(lang === 'zh' ? '谷底' : 'bottom', cx - 14 * s, cy - 10 * s);
  g.restore();
  y = fy + fh + 26 * s;
  g.font = `${13 * s}px ${SANS}`; g.fillStyle = C.graphite; g.fillText(T.cap, x0, y); y += 34 * s;
  para(T.p2);
  // the formula
  g.font = `italic ${22 * s}px ${SERIF}`; g.fillStyle = C.ink;
  const f = lang === 'zh' ? 'min  ½ aᵀHa + gᵀa    使得  Ga ≤ b' : 'min  ½ aᵀHa + gᵀa    s.t.  Ga ≤ b';
  g.fillText(f, x0 + 24 * s, y + 6 * s); y += 46 * s;
  para(T.p3);
  g.font = `${17 * s}px ${SANS}`;
  T.list.forEach((t, i) => { g.fillStyle = [C.cobalt, C.viridian, C.ochre][i]; g.beginPath(); g.arc(x0 + 6 * s, y - 6 * s, 4 * s, 0, Math.PI * 2); g.fill(); g.fillStyle = C.ink; g.fillText(t, x0 + 22 * s, y); y += 32 * s; });
  y += 14 * s;
  para(T.p4);
  // keep going down the page with more of the same rhythm, so long pages scroll
  while (y < h - 80 * s) { para(T.p2, 18, 1.75, C.ink2); if (y < h - 200 * s) para(T.p3, 18, 1.75, C.ink2); }
  return cv;
}

export function roundrect(g, x, y, w, h, r) { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); }

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

// A spring with SwiftUI's parameters: response (seconds per cycle) and damping fraction (1 = critical).
// Retargeting keeps the velocity, so every motion can be interrupted without a jolt.
export class Spring {
  constructor(x = 0, response = 0.45, damping = 0.82) { this.x = x; this.v = 0; this.target = x; this.set(response, damping); }
  set(response, damping) { this.k = (2 * Math.PI / response) ** 2; this.c = 4 * Math.PI * damping / response; return this; }
  to(t) { this.target = t; return this; }
  step(dt) {
    // semi-implicit Euler in small substeps: stable for stiff springs
    const n = Math.max(1, Math.ceil(dt / (1 / 240)));
    for (let i = 0; i < n; i++) { const h = dt / n, a = -this.k * (this.x - this.target) - this.c * this.v; this.v += a * h; this.x += this.v * h; }
    return this.busy();
  }
  busy() { return Math.abs(this.x - this.target) > 1e-4 || Math.abs(this.v) > 1e-3; }
  snap(t) { this.x = this.target = t; this.v = 0; return this; }
}
export class Spring2 {
  constructor(x = 0, y = 0, r, d) { this.a = new Spring(x, r, d); this.b = new Spring(y, r, d); }
  to(x, y) { this.a.to(x); this.b.to(y); return this; }
  step(dt) { const p = this.a.step(dt), q = this.b.step(dt); return p || q; }
  get x() { return this.a.x; } get y() { return this.b.x; }
  set(r, d) { this.a.set(r, d); this.b.set(r, d); return this; }
}
