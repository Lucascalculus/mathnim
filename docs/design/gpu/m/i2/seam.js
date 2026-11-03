// A seam for comparing. One figure in two states (before / after, two methods, two settings). A vertical seam of
// glass divides it: left of the seam is state A exactly, right of it is state B exactly, so wherever the two differ
// the drawing breaks at the seam, and where they agree it runs straight through. The glass bends what is under it a
// little (it is a lens, so you see it is there), and a loupe rides the seam where the figure crosses it, showing the
// break three times larger. The same nouns keep the same colours on both sides.
// Here: a planet stepped forward with Euler's method (it drifts outwards; energy grows) and with leapfrog (it stays
// on its ellipse), same step size. As a library primitive: seam(scene_a, scene_b).
import { scheduler } from '../../lib/gl.js';
import { Spring } from '../../lib/ui.js';
import { SANS, SERIF, C, GR, rgba, fit2d, local } from './_loop.js';

export const meta = {
  id: 'seam',
  name: { zh: '对比的接缝', en: 'A seam for comparing' },
  means: { zh: '拖一道玻璃接缝横过图：左边是状态 A，右边是状态 B；两边不一样的地方图在接缝处断开，一样的地方连成一条；接缝上的小放大镜把断口放大给你看。', en: 'Drag a glass seam across a figure: state A on the left, state B on the right; where they differ the drawing breaks at the seam, where they agree it runs through; a loupe on the seam shows the break enlarged.' },
  test: { zh: '接缝左边与状态 A 逐像素相同，右边与状态 B 逐像素相同（不算接缝本身和放大镜），在多个位置检验', en: 'Left of the seam is pixel-identical to state A and right of it to state B (the seam and its loupe excepted), at several positions' },
};

// a planet around a sun (GM = 1) on a circular orbit, stepped 3 turns at h = 0.03: Euler spirals out, leapfrog keeps the circle
const Hh = 0.03, STEPS = Math.round(3 * 2 * Math.PI / Hh);
function orbit(method) {
  let x = 1, y = 0, vx = 0, vy = 1; const pts = [[x, y]], E = [];
  const acc = (x, y) => { const r3 = Math.pow(x * x + y * y, 1.5); return [-x / r3, -y / r3]; };
  const energy = () => 0.5 * (vx * vx + vy * vy) - 1 / Math.hypot(x, y);
  E.push(energy());
  for (let i = 0; i < STEPS; i++) {
    if (method === 'euler') { const [ax, ay] = acc(x, y); x += Hh * vx; y += Hh * vy; vx += Hh * ax; vy += Hh * ay; }
    else { let [ax, ay] = acc(x, y); vx += Hh / 2 * ax; vy += Hh / 2 * ay; x += Hh * vx; y += Hh * vy; [ax, ay] = acc(x, y); vx += Hh / 2 * ax; vy += Hh / 2 * ay; }
    pts.push([x, y]); E.push(energy());
  }
  return { pts, E };
}
const A = orbit('euler'), B = orbit('leapfrog');
const Q = { zh: { a: '欧拉法', b: '蛙跳法', e: '能量', drift: '能量漂移' }, en: { a: 'Euler', b: 'leapfrog', e: 'energy', drift: 'energy drift' } };

export function make({ stage, canvas, hud, lang }) {
  const T = Q[lang], ctx = canvas.getContext('2d', { willReadFrequently: true });
  let W = 0, H = 0, dpr = 1, G = null, imA = null, imB = null;
  const seam = new Spring(0.5, 0.35, 0.9), loupe_y = new Spring(0, 0.3, 0.9), lift = new Spring(0, 0.25, 0.8), vis = new Spring(1, 0.3, 1);
  let drag = false, hand_y = null;
  const SW = 14, LR = 54, MAG = 3;

  function geo() {
    // wide: the orbit and its energy side by side, so a sweep of the seam crosses both; narrow: stacked
    const narrow = W < 900, pad = narrow ? 16 : 48;
    let orb, strip;
    if (!narrow) { const side = Math.min(H - 150, W * 0.52); orb = { x: pad, y: (H - side) / 2 + 10, w: side, h: side }; const sx = orb.x + side + 70; strip = { x: sx, y: H / 2 - 90, w: W - pad - 24 - sx, h: 200 }; }
    else { const side = W - 2 * pad, sh = 90, top = Math.max(84, (H - side - 40 - sh) / 2 + 10); orb = { x: pad, y: top, w: side, h: side }; strip = { x: pad + 8, y: top + side + 40, w: side - 16, h: sh }; }
    // one scale for both states, the sun at the centre: the furthest either planet gets fits the box
    let rm = 0; for (const p of [...A.pts, ...B.pts]) rm = Math.max(rm, Math.hypot(p[0], p[1]));
    const s = Math.min(orb.w, orb.h) / 2 / rm * 0.94, cx = orb.x + orb.w / 2, cy = orb.y + orb.h / 2;
    return { narrow, orb, strip, s, cx, cy };
  }
  const px = (p) => [G.cx + p[0] * G.s, G.cy - p[1] * G.s];

  // one state of the figure, drawn whole into its own image: the orbit, the sun, where the planet ends, its energy
  function render(st) {
    const cv = document.createElement('canvas'); cv.width = canvas.width; cv.height = canvas.height;
    const g = cv.getContext('2d', { willReadFrequently: true }); g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.fillStyle = C.paper; g.fillRect(0, 0, W, H);
    g.lineJoin = 'round';
    g.strokeStyle = C.cobalt; g.lineWidth = 2; g.beginPath(); st.pts.forEach((p, i) => { const [x, y] = px(p); i ? g.lineTo(x, y) : g.moveTo(x, y); }); g.stroke();
    // the sun
    const [sx, sy] = px([0, 0]); g.fillStyle = C.ochre; g.beginPath(); g.arc(sx, sy, G.narrow ? 7 : 9, 0, Math.PI * 2); g.fill();
    // where it started, hollow; where it is now, solid
    const [ax, ay] = px(st.pts[0]); g.strokeStyle = C.ink; g.lineWidth = 1.5; g.beginPath(); g.arc(ax, ay, 5, 0, Math.PI * 2); g.stroke();
    const [bx, by] = px(st.pts[st.pts.length - 1]); g.fillStyle = C.cobalt; g.beginPath(); g.arc(bx, by, G.narrow ? 6 : 7, 0, Math.PI * 2); g.fill();
    // energy over the steps, against its starting value (dashed)
    const S = G.strip, e0 = A.E[0], top_e = Math.max(...A.E, ...B.E), lo = e0 - (top_e - e0) * 0.08, hi = top_e + (top_e - e0) * 0.08, ex = (i) => S.x + i / STEPS * S.w, ey = (e) => S.y + S.h - (e - lo) / (hi - lo) * S.h;
    g.setLineDash([4, 4]); g.strokeStyle = GR(0.35); g.lineWidth = 1; g.beginPath(); g.moveTo(S.x, ey(e0)); g.lineTo(S.x + S.w, ey(e0)); g.stroke(); g.setLineDash([]);
    g.strokeStyle = C.violet; g.lineWidth = 2; g.beginPath(); st.E.forEach((e, i) => (i ? g.lineTo(ex(i), ey(e)) : g.moveTo(ex(i), ey(e)))); g.stroke();
    // the drawn lines in CSS px, so the loupe can find where they meet the seam
    st.lines = [st.pts.map(px), st.E.map((e, i) => [ex(i), ey(e)])];
    g.font = `12.5px ${SANS}`; g.fillStyle = C.violet; g.textAlign = 'left'; g.fillText(T.e, S.x, S.y - 8);
    return cv;
  }
  function fit() { ({ W, H, dpr } = fit2d(canvas, ctx)); G = geo(); imA = render(A); imB = render(B); }

  // the seam, in device pixels (integers, so the two sides are exact copies)
  const seam_px = () => Math.round(seam.x * W * dpr);
  const half = () => Math.round(SW / 2 * dpr);
  // where the leapfrog orbit crosses the seam: the loupe rides there (nearest the hand while dragging)
  function crossing(xc) {
    const at = (st) => { const ys = []; for (const L of st.lines) for (let i = 1; i < L.length; i++) { const [x0, y0] = L[i - 1], [x1, y1] = L[i]; if ((x0 - xc) * (x1 - xc) <= 0 && x0 !== x1) ys.push(y0 + (y1 - y0) * (xc - x0) / (x1 - x0)); } return ys; };
    const ya = at(A), yb = at(B), all = [...yb, ...ya];
    if (!all.length) return null;
    // prefer a break: a B line with an A line close enough that the loupe holds both, centred between them
    const reach = 0.8 * LR / MAG, want = hand_y ?? G.orb.y + G.orb.h * 0.3, cand = [];
    for (const b of yb) for (const a of ya) if (Math.abs(a - b) < 2 * reach) cand.push((a + b) / 2);
    const pool = cand.length ? cand : all;
    return pool.reduce((p, q) => (Math.abs(q - want) < Math.abs(p - want) ? q : p));
  }
  // the loupe goes where a line meets the seam; with nothing there, it stays put and fades
  function aim(snap) { const y = crossing(seam.x * W); vis.to(y == null ? 0 : 1); if (y != null) (snap ? loupe_y.snap(y) : loupe_y.to(y)); if (snap) vis.snap(vis.target); }
  function draw() {
    const X = seam_px(), h = half(), Wd = canvas.width, Hd = canvas.height;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    // A to the left, B to the right: straight copies
    ctx.save(); ctx.beginPath(); ctx.rect(0, 0, X - h, Hd); ctx.clip(); ctx.drawImage(imA, 0, 0); ctx.restore();
    ctx.save(); ctx.beginPath(); ctx.rect(X + h, 0, Wd - X - h, Hd); ctx.clip(); ctx.drawImage(imB, 0, 0); ctx.restore();
    // the glass: each column shows what is under it, pulled in towards the seam's centre (a cylinder lens)
    for (let c = X - h; c < X + h; c++) {
      const u = (c + 0.5 - X) / h, src = Math.round(X + u * h * 0.55 - 0.5);
      ctx.drawImage(c < X ? imA : imB, Math.max(0, Math.min(Wd - 1, src)), 0, 1, Hd, c, 0, 1, Hd);
    }
    ctx.fillStyle = 'rgba(255,255,255,.18)'; ctx.fillRect(X - h, 0, 2 * h, Hd);
    ctx.fillStyle = 'rgba(255,255,255,.95)'; ctx.fillRect(X - h, 0, Math.max(1, Math.round(dpr)), Hd);
    ctx.fillStyle = GR(0.2); ctx.fillRect(X + h - Math.max(1, Math.round(dpr)), 0, Math.max(1, Math.round(dpr)), Hd);
    ctx.fillStyle = GR(0.08); ctx.fillRect(X - Math.max(1, Math.round(dpr / 2)), 0, Math.max(1, Math.round(dpr / 2)), Hd);
    // the loupe, riding the seam: three times larger, A on its left, B on its right
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const xs = X / dpr, ly = loupe_y.x, r = (LR + 4 * lift.x) * (0.6 + 0.4 * vis.x), srcw = (r / MAG) * dpr;
    ctx.save(); ctx.globalAlpha = vis.x;
    ctx.save(); ctx.shadowColor = GR(0.2); ctx.shadowBlur = 14; ctx.shadowOffsetY = 4; ctx.fillStyle = C.paper; ctx.beginPath(); ctx.arc(xs, ly, r, 0, Math.PI * 2); ctx.fill(); ctx.restore();
    ctx.save(); ctx.beginPath(); ctx.arc(xs, ly, r - 1, 0, Math.PI * 2); ctx.clip();
    ctx.save(); ctx.beginPath(); ctx.rect(xs - r, ly - r, r, 2 * r); ctx.clip(); ctx.drawImage(imA, X - srcw, ly * dpr - srcw, 2 * srcw, 2 * srcw, xs - r, ly - r, 2 * r, 2 * r); ctx.restore();
    ctx.save(); ctx.beginPath(); ctx.rect(xs, ly - r, r, 2 * r); ctx.clip(); ctx.drawImage(imB, X - srcw, ly * dpr - srcw, 2 * srcw, 2 * srcw, xs - r, ly - r, 2 * r, 2 * r); ctx.restore();
    ctx.fillStyle = 'rgba(255,255,255,.9)'; ctx.fillRect(xs - 0.75, ly - r, 1.5, 2 * r);
    ctx.restore();
    ctx.strokeStyle = 'rgba(255,255,255,.95)'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(xs, ly, r, 0, Math.PI * 2); ctx.stroke();
    ctx.strokeStyle = GR(0.18); ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(xs, ly, r + 1.5, 0, Math.PI * 2); ctx.stroke();
    ctx.font = `500 11.5px ${SANS}`; ctx.fillStyle = C.ink2; ctx.textAlign = 'center'; ctx.fillText(`×${MAG}`, xs, ly + r + 16);
    ctx.restore();
    // the two names, on a glass tag that straddles the seam
    const tag = tag_box(xs);
    ctx.save(); ctx.shadowColor = GR(0.12); ctx.shadowBlur = 10; ctx.shadowOffsetY = 2; ctx.fillStyle = 'rgba(255,255,255,.94)';
    rr(tag.x, tag.y, tag.w, tag.h, tag.h / 2); ctx.fill(); ctx.restore();
    ctx.strokeStyle = GR(0.1); ctx.lineWidth = 1; rr(tag.x, tag.y, tag.w, tag.h, tag.h / 2); ctx.stroke();
    ctx.font = `600 13px ${SANS}`; ctx.fillStyle = C.ink; ctx.textAlign = 'right'; ctx.fillText(`← ${T.a}`, xs - 9, tag.y + tag.h / 2 + 4.5);
    ctx.textAlign = 'left'; ctx.fillText(`${T.b} →`, xs + 9, tag.y + tag.h / 2 + 4.5);
    ctx.fillStyle = GR(0.2); ctx.fillRect(xs - 0.5, tag.y + 7, 1, tag.h - 14);
  }
  function rr(x, y, w, h, r) { ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); }
  function tag_box(xs) {
    ctx.font = `600 13px ${SANS}`; const wa = ctx.measureText(`← ${T.a}`).width, wb = ctx.measureText(`${T.b} →`).width;
    const y = G.narrow ? 22 : 22; return { x: xs - wa - 20, y, w: wa + wb + 40, h: 34 };
  }

  const sched = scheduler((dt) => {
    let b = seam.step(dt); aim(false); b = loupe_y.step(dt) || b; b = lift.step(dt) || b; b = vis.step(dt) || b;
    draw(); return b || drag;
  });
  const clampx = (x) => Math.max(0.04, Math.min(0.96, x / W));
  canvas.addEventListener('pointerdown', (e) => {
    const [x, y] = local(canvas, e); drag = true; hand_y = y; lift.to(1);
    // grab the seam where it is, or send it to where you tapped
    if (Math.abs(x - seam.x * W) < 30) seam.snap(clampx(x)); else seam.to(clampx(x));
    canvas.setPointerCapture(e.pointerId); sched.wake();
  });
  canvas.addEventListener('pointermove', (e) => { const [x, y] = local(canvas, e); canvas.style.cursor = 'ew-resize'; if (!drag) return; hand_y = y; seam.snap(clampx(x)); sched.wake(); });
  canvas.addEventListener('pointerup', () => { drag = false; lift.to(0); sched.wake(); });

  fit(); seam.snap(0.5); aim(true); draw();
  const drift = (st) => (st.E[st.E.length - 1] - st.E[0]) / Math.abs(st.E[0]);
  hud.textContent = `${T.drift} ${T.a} ${(drift(A) * 100 >= 0 ? '+' : '')}${(drift(A) * 100).toFixed(0)}% · ${T.b} ${(drift(B) * 100).toFixed(2)}%`;
  return {
    visible: (v) => sched.set_visible(v), resize: () => { fit(); aim(true); draw(); },
    // sweep the seam across and back
    demo() { seam.set(1.4, 1).to(0.28); sched.wake(1600); setTimeout(() => { seam.set(1.2, 0.95).to(W < 900 ? 0.62 : 0.4); sched.wake(1800); }, 1500); setTimeout(() => seam.set(0.35, 0.9), 3400); },
    at(f) { seam.snap(f); aim(true); draw(); },
    async accept() {
      const zh = lang === 'zh', save = seam.x; let worst = 0, n = 0;
      for (const f of [0.2, 0.37, 0.5, 0.71, 0.88]) {
        seam.snap(f); aim(true); lift.snap(0); draw();
        const D = ctx.getImageData(0, 0, canvas.width, canvas.height).data, a = imA.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data, b = imB.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data;
        const X = seam_px(), h = half(), xs = X / dpr, ly = loupe_y.x, tg = tag_box(xs), Wd = canvas.width;
        // the seam's own pixels: its strip, the loupe (with its shadow and label), the tag (with its shadow)
        const own = (x, y) => (x >= X - h && x < X + h) || Math.hypot(x / dpr - xs, y / dpr - ly) < LR + 24 || (x / dpr > tg.x - 14 && x / dpr < tg.x + tg.w + 14 && y / dpr > tg.y - 10 && y / dpr < tg.y + tg.h + 16);
        for (let y = 0; y < canvas.height; y++) for (let x = 0; x < Wd; x++) {
          if (own(x, y)) continue;
          const k = (y * Wd + x) * 4, ref = x < X ? a : b;
          const d = Math.max(Math.abs(D[k] - ref[k]), Math.abs(D[k + 1] - ref[k + 1]), Math.abs(D[k + 2] - ref[k + 2]));
          if (d > worst) worst = d; n++;
        }
      }
      seam.snap(save); aim(true); draw();
      // the two states must really differ, or the test proves nothing
      const differ = Math.hypot(A.pts[STEPS][0] - B.pts[STEPS][0], A.pts[STEPS][1] - B.pts[STEPS][1]) > 0.2;
      return { pass: worst === 0 && differ, value: `${zh ? '5 个位置，' : '5 positions, '}${(n / 1e6).toFixed(1)}M ${zh ? '像素，最大差' : 'pixels, max difference'} ${worst}; ${zh ? '两种方法终点相距' : 'end points apart by'} ${Math.hypot(A.pts[STEPS][0] - B.pts[STEPS][0], A.pts[STEPS][1] - B.pts[STEPS][1]).toFixed(2)}` };
    },
  };
}
