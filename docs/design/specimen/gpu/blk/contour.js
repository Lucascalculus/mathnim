// The contour map. A function of two variables seen from above, the way a survey map draws a landscape: every line is
// one height, every fifth line is heavier and carries its height, written along it in a gap cut from the line. Where
// lines crowd, the ground is steep. Hold the glass bead anywhere: the whole line at your height is drawn in ink, and the
// gradient points uphill, at a right angle to it, as long as the slope is steep. As a building block: contours(f, box).
import { scheduler, Spring, C, GR } from '../lib/ui.js';
import { Plot, num, text, text_width, tint, arrow, right_angle, glass_bead, drags } from '../lib/plot.js';
import { hills, hills_grad, HILLS, contour, sample_grid } from '../lib/contour.js';
import { seg_poly, poly_x } from '../lib/geom.js';

export const meta = {
  id: 'contour',
  name: { zh: '等高线地图', en: 'The contour map' },
  means: { zh: '从上面看一个两变量的函数，像测绘地图那样：每条线一个高度，每五条加粗一条、在断开处写上高度。线挤的地方陡。按住玻璃珠：和你一样高的那整条线变成墨色，梯度指向上坡，和它成直角。', en: 'A function of two variables from above, drawn like a survey map: one height per line, every fifth heavier with its height written in a gap. Crowded lines are steep. Hold the bead: the whole line at your height turns ink, and the gradient points uphill at a right angle to it.' },
  test: { zh: '等高线上每个点的函数值与它的高度相差 < 0.004；60 个位置上梯度与那里的等高线成 90° ± 0.5°；高度标注互不重叠、不压别的线', en: 'Every contour point is within 0.004 of its height; at 60 places the gradient meets the contour at 90° ± 0.5°; height labels overlap neither each other nor other lines' },
};

const STEP = 0.1, INDEX = 5, NX = 180, NY = 120;
const BROWN = '#8a5a0c';            // ochre darkened to read as text

export function make({ stage, canvas, lang }) {
  const zh = lang === 'zh';
  const g = canvas.getContext('2d');
  let W = 0, H = 0, dpr = 1, P = null, levels = [], labels = [], tint_img = null;
  const S = { p: [0.35, 0.95] };
  const lift = new Spring(0, 0.25, 0.9), probe = new Spring(1, 0.3, 0.9);
  const grid = sample_grid(hills, HILLS, NX, NY);
  let fmin = Infinity, fmax = -Infinity; for (const v of grid) { fmin = Math.min(fmin, v); fmax = Math.max(fmax, v); }

  // everything that depends on the size: the plot, the tint, the lines and where their heights are written
  function build() {
    P = new Plot({ x: 22, y: 22, w: W - 44, h: H - 44 }, HILLS.x, HILLS.y, { equal: true });
    levels = [];
    for (let k = Math.ceil(fmin / STEP); k * STEP < fmax; k++) {
      const c = Number((k * STEP).toFixed(10));
      levels.push({ c, index: k % INDEX === 0, lines: contour(hills, HILLS, NX, NY, c, grid).map((l) => l.map((p) => P.P(p))) });
    }
    labels = place_labels();
    // the height tint: one pigment, a step lighter per band, low ground nearly paper
    const iw = Math.max(2, Math.round(P.box.w / 2)), ih = Math.max(2, Math.round(P.box.h / 2));
    const cv = document.createElement('canvas'); cv.width = iw; cv.height = ih;
    const cx = cv.getContext('2d'), im = cx.createImageData(iw, ih), pa = [251, 250, 247], oc = [200, 134, 26];
    for (let j = 0; j < ih; j++) for (let i = 0; i < iw; i++) {
      const x = P.ix(P.box.x + (i + 0.5) / iw * P.box.w), y = P.iy(P.box.y + (j + 0.5) / ih * P.box.h);
      const band = Math.floor(hills(x, y) / STEP), t = 0.03 + 0.3 * Math.max(0, Math.min(1, (band * STEP - fmin) / (fmax - fmin))), o = (j * iw + i) * 4;
      for (let k = 0; k < 3; k++) im.data[o + k] = Math.round(pa[k] + (oc[k] - pa[k]) * t);
      im.data[o + 3] = 255;
    }
    cx.putImageData(im, 0, 0); tint_img = cv;
  }
  // the heights on the heavy lines: where the line is straight, the label fits between its neighbours, and far from
  // the other labels; written upright, along the line
  function place_labels() {
    const out = [], others = levels.flatMap((L) => L.lines.map((l) => ({ c: L.c, l })));
    for (const L of levels) {
      if (!L.index) continue;
      const t = num(L.c, 1), w = text_width(g, t, { size: 10, weight: 600, tabular: true }) + 5, h = 10;
      for (const line of L.lines) {
        let len = 0; for (let i = 1; i < line.length; i++) len += Math.hypot(line[i][0] - line[i - 1][0], line[i][1] - line[i - 1][1]);
        if (len < 110) continue;
        let best = null, acc = 0;
        for (let i = 2; i < line.length - 2; i++) {
          acc += Math.hypot(line[i][0] - line[i - 1][0], line[i][1] - line[i - 1][1]);
          if (acc < 30 || acc > len - 30) continue;
          const a = line[i - 2], b = line[i + 2], ang0 = Math.atan2(b[1] - a[1], b[0] - a[0]), ang = ang0 > Math.PI / 2 ? ang0 - Math.PI : ang0 < -Math.PI / 2 ? ang0 + Math.PI : ang0;
          const p = line[i], c = Math.cos(ang), s = Math.sin(ang);
          const box = [[-w / 2, -h / 2], [w / 2, -h / 2], [w / 2, h / 2], [-w / 2, h / 2]].map(([u, v]) => [p[0] + u * c - v * s, p[1] + u * s + v * c]);
          if (!box.every(([x, y]) => P.inside(x, y, -4))) continue;
          if (out.some((o) => poly_x(o.box, box) || Math.hypot(o.p[0] - p[0], o.p[1] - p[1]) < 90)) continue;
          let crosses = false;
          for (const o of others) { if (o.c === L.c) continue; for (let k = 1; k < o.l.length && !crosses; k++) if (seg_poly(o.l[k - 1], o.l[k], box)) crosses = true; if (crosses) break; }
          if (crosses) continue;
          const bend = Math.abs(Math.atan2(Math.sin(Math.atan2(line[i + 2][1] - p[1], line[i + 2][0] - p[0]) - Math.atan2(p[1] - line[i - 2][1], p[0] - line[i - 2][0])), 1));
          if (!best || bend < best.bend) best = { p, ang, box, t, w, bend };
        }
        if (best) out.push(best);
      }
    }
    return out;
  }

  function draw() {
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.fillStyle = C.paper; g.fillRect(0, 0, W, H);
    g.save(); g.imageSmoothingEnabled = true; g.drawImage(tint_img, P.box.x, P.box.y, P.box.w, P.box.h); g.restore();
    // the lines, with gaps cut where the heights are written
    g.save();
    const cut = new Path2D(); cut.rect(0, 0, W, H);
    for (const l of labels) { cut.moveTo(l.box[0][0], l.box[0][1]); for (const q of l.box.slice(1)) cut.lineTo(q[0], q[1]); cut.closePath(); }
    g.clip(cut, 'evenodd'); g.lineJoin = 'round'; g.lineCap = 'round';
    for (const L of levels) {
      g.strokeStyle = L.index ? 'rgba(138,90,12,0.85)' : 'rgba(160,104,20,0.5)'; g.lineWidth = L.index ? 1.25 : 0.7;
      for (const l of L.lines) { g.beginPath(); l.forEach((p, i) => (i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1]))); g.stroke(); }
    }
    g.restore();
    for (const l of labels) { g.save(); g.translate(l.p[0], l.p[1]); g.rotate(l.ang); text(g, l.t, 0, 3.6, { size: 10, weight: 600, tabular: true, color: BROWN, align: 'center' }); g.restore(); }
    // the probe: the line at its height in ink, the gradient uphill at a right angle
    const p = P.P(S.p), c = hills(S.p[0], S.p[1]), gr = hills_grad(S.p[0], S.p[1]), gn = Math.hypot(gr[0], gr[1]), k = probe.x;
    if (k > 0.01) {
      g.save(); g.globalAlpha = k; g.strokeStyle = C.ink; g.lineWidth = 1.5; g.lineJoin = 'round';
      for (const l of contour(hills, HILLS, NX, NY, c, grid)) { g.beginPath(); l.forEach((q, i) => { const s = P.P(q); i ? g.lineTo(s[0], s[1]) : g.moveTo(s[0], s[1]); }); g.stroke(); }
      g.restore();
    }
    if (gn > 0.02) {
      const u = [gr[0] / gn, -gr[1] / gn], L = Math.min(70, 18 + gn * 46);    // canvas y points down
      arrow(g, p[0], p[1], p[0] + u[0] * L, p[1] + u[1] * L, C.teal, 2.2, 10);
      if (k > 0.5) right_angle(g, p, u, [-u[1], u[0]], 8, GR(0.7));
    }
    glass_bead(g, p[0], p[1], 11, lift.x, { core: C.ink });
    const away = gn > 0.02 ? [-gr[0] / gn, gr[1] / gn] : [0, 1];     // downhill, where the arrow is not
    text(g, num(c, 2), p[0] + away[0] * 30, p[1] + away[1] * 30 + 5, { size: 13, weight: 650, color: C.ink, tabular: true, align: 'center', halo: 4 });
  }

  const hold = drags(canvas, () => {
    const p = P.P(S.p);
    return [{ hit: (x, y) => { const d = Math.hypot(x - p[0], y - p[1]); return d < 24 ? d : Infinity; }, down() { lift.to(1); },
      move: (x, y) => { S.p = [Math.max(HILLS.x[0], Math.min(HILLS.x[1], P.ix(x))), Math.max(HILLS.y[0], Math.min(HILLS.y[1], P.iy(y)))]; }, up() { lift.to(0); } }];
  }, { change: () => sched.wake() });

  const sched = scheduler((dt) => { const busy = [lift.step(dt), probe.step(dt)].some(Boolean); draw(); return busy || !!hold.active; });
  function resize() {
    const r = canvas.getBoundingClientRect(); dpr = Math.min(2, devicePixelRatio || 1);
    W = r.width; H = r.height; canvas.width = Math.max(2, Math.round(W * dpr)); canvas.height = Math.max(2, Math.round(H * dpr));
    g.setTransform(dpr, 0, 0, dpr, 0, 0); build(); draw();
  }
  resize();

  return {
    visible: (v) => sched.set_visible(v), resize,
    demo() { probe.to(1); sched.wake(1500); setTimeout(() => { probe.to(0); sched.wake(1000); }, 2500); },
    async accept() {
      // 1. every vertex of every line is at its height
      let err = 0, n = 0;
      for (const L of levels) for (const l of L.lines) for (const q of l) { n++; err = Math.max(err, Math.abs(hills(P.ix(q[0]), P.iy(q[1])) - L.c)); }
      // 2. the gradient meets the drawn line through the probe at a right angle (away from flat tops and saddles)
      let worst = 0, tested = 0; const rnd = (() => { let s = 11; return () => (s = (s * 16807) % 2147483647) / 2147483647; })();
      while (tested < 60) {
        const x = -2.7 + 5.4 * rnd(), y = -1.7 + 3.4 * rnd(), gr = hills_grad(x, y), gn = Math.hypot(gr[0], gr[1]);
        if (gn < 0.3) continue;
        tested++;
        // the level set through the point, traced on a fine window so a chord is as good as the tangent
        const lines = contour(hills, { x: [x - 0.02, x + 0.02], y: [y - 0.02, y + 0.02] }, 40, 40, hills(x, y)); let best = null;
        for (const l of lines) for (let i = 1; i < l.length; i++) {
          const a = l[i - 1], b = l[i], ab = [b[0] - a[0], b[1] - a[1]], t = Math.max(0, Math.min(1, ((x - a[0]) * ab[0] + (y - a[1]) * ab[1]) / (ab[0] ** 2 + ab[1] ** 2 || 1)));
          const d = Math.hypot(a[0] + ab[0] * t - x, a[1] + ab[1] * t - y); if (!best || d < best.d) best = { d, ab };
        }
        const cos = Math.abs(best.ab[0] * gr[0] + best.ab[1] * gr[1]) / (Math.hypot(...best.ab) * gn);
        worst = Math.max(worst, Math.asin(Math.min(1, cos)) * 180 / Math.PI);
      }
      // 3. the heights: no two overlap, none sits on another line
      let clash = 0;
      for (let i = 0; i < labels.length; i++) for (let j = i + 1; j < labels.length; j++) if (poly_x(labels[i].box, labels[j].box)) clash++;
      for (const lab of labels) for (const L of levels) { if (num(L.c, 1) === lab.t && L.index) continue; for (const l of L.lines) for (let k = 1; k < l.length; k++) if (seg_poly(l[k - 1], l[k], lab.box)) { clash++; break; } }
      const pass = err < 0.004 && worst < 0.5 && clash === 0 && labels.length >= 3;
      return { pass, value: zh ? `${n} 个点离高度最多 ${err.toFixed(4)}；梯度与等高线的夹角离 90° 最多 ${worst.toFixed(2)}°；${labels.length} 个高度标注，冲突 ${clash}` : `${n} points within ${err.toFixed(4)} of their height; gradient within ${worst.toFixed(2)}° of perpendicular; ${labels.length} height labels, ${clash} clashes` };
    },
  };
}
