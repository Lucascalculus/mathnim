// A5 · Time as matter. A stroboscope you hold: the past leaves solid ghosts at equal steps of time (so their spacing
// is the speed), the future is drawn hollow and dashed (it is a prediction), and the graph beside it is the same
// motion folded into a line. Time is a ring you turn: spin it and it runs on with its own momentum, then rests.
// Every instant is an exact state (the motion is solved once and indexed), so scrubbing never lies.
// As a library primitive: strobe(scene, t, {past, future, step}) for any scene that is a function of time.
import { scheduler, SANS, fit2d } from '../lib/ui.js';

export const meta = {
  id: 'time',
  name: { zh: '时间是一种材质', en: 'Time as matter' },
  means: { zh: '过去留下等时间间隔的实心残影（间距就是速度），未来是空心虚线（预测）；时间是一个可以转的环。', en: 'The past leaves solid ghosts at equal steps of time (their spacing is the speed); the future is hollow and dashed (a prediction); time is a ring you turn.' },
  test: { zh: '相邻残影的弧长 ÷ 时间步 = 中点速度（误差 2% 以内）；来回拨动后状态完全复原', en: 'Arc between ghosts ÷ time step = speed at the midpoint (within 2 %); scrubbing back and forth restores the state exactly' },
};

// a damped pendulum, solved once with RK4 at 1/480 s
const G = 9.81, LEN = 1.0, DAMP = 0.12, T_END = 24, H = 1 / 480;
function solve() {
  const n = Math.ceil(T_END / H) + 1, th = new Float64Array(n), om = new Float64Array(n);
  th[0] = 1.15; om[0] = 0;
  const f = (t, w) => [w, -G / LEN * Math.sin(t) - DAMP * w];
  for (let i = 1; i < n; i++) {
    const t = th[i - 1], w = om[i - 1];
    const k1 = f(t, w), k2 = f(t + H / 2 * k1[0], w + H / 2 * k1[1]), k3 = f(t + H / 2 * k2[0], w + H / 2 * k2[1]), k4 = f(t + H * k3[0], w + H * k3[1]);
    th[i] = t + H / 6 * (k1[0] + 2 * k2[0] + 2 * k3[0] + k4[0]); om[i] = w + H / 6 * (k1[1] + 2 * k2[1] + 2 * k3[1] + k4[1]);
  }
  return { th, om, n };
}
const SOL = solve();
// the state at any time, interpolated between solved steps
export function state(t) { t = Math.max(0, Math.min(T_END - H, t)); const i = Math.floor(t / H), f = t / H - i; return { th: SOL.th[i] + (SOL.th[i + 1] - SOL.th[i]) * f, om: SOL.om[i] + (SOL.om[i + 1] - SOL.om[i]) * f }; }

export function make({ stage, canvas, hud, lang }) {
  const zh = lang === 'zh';
  const ctx = canvas.getContext('2d', { willReadFrequently: false });
  let W = 0, Hh = 0, dpr = 1;
  const S = { t: 0.9, v: 0, dragging: false, a0: 0, t0: 0, last: [] };
  const STEP = 1 / 12, PAST = 1.4, FUT = 1.2;
  function fit() { ({ W, H: Hh, dpr } = fit2d(canvas)); }
  function geo() {
    const narrow = W < 560;
    if (narrow) return { narrow, pivot: [W / 2, Hh * 0.12], L: Math.min(W * 0.36, Hh * 0.24), graph: [20, Hh * 0.5, W - 40, Hh * 0.17], ring: [W / 2, Hh * 0.84, Math.min(W * 0.2, 74)] };
    return { narrow, pivot: [W * 0.26, Hh * 0.17], L: Math.min(Hh * 0.46, W * 0.21), graph: [W * 0.5, Hh * 0.2, W * 0.44, Hh * 0.38], ring: [W * 0.72, Hh * 0.8, Math.min(70, Hh * 0.12)] };
  }
  const INK = '#1a1b1f', GR = 'rgba(26,27,31,', COB = '#2f5bd2';
  function bob_at(g, th) { return [g.pivot[0] + Math.sin(th) * g.L, g.pivot[1] + Math.cos(th) * g.L]; }
  function draw() {
    const g = geo(); ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, W, Hh);
    ctx.fillStyle = '#fbfaf7'; ctx.fillRect(0, 0, W, Hh);
    const R = g.narrow ? 13 : 17;
    // the pivot
    ctx.fillStyle = INK; ctx.fillRect(g.pivot[0] - 26, g.pivot[1] - 4, 52, 3);
    // the future: hollow, dashed, fading forward
    for (let k = Math.floor(FUT / STEP); k >= 1; k--) {
      const t = S.t + k * STEP; if (t > T_END) continue;
      const p = bob_at(g, state(t).th), a = 0.55 * (1 - k * STEP / FUT) + 0.08;
      ctx.setLineDash([3, 3]); ctx.lineWidth = 1.2; ctx.strokeStyle = GR + a + ')';
      ctx.beginPath(); ctx.arc(p[0], p[1], R, 0, Math.PI * 2); ctx.stroke();
    }
    ctx.setLineDash([]);
    // the past: solid ghosts at equal steps of time, fading back
    for (let k = Math.floor(PAST / STEP); k >= 1; k--) {
      const t = S.t - k * STEP; if (t < 0) continue;
      const p = bob_at(g, state(t).th), a = 0.42 * (1 - k * STEP / PAST) + 0.04;
      ctx.fillStyle = `rgba(47,91,210,${a})`; ctx.beginPath(); ctx.arc(p[0], p[1], R, 0, Math.PI * 2); ctx.fill();
    }
    // the present
    const now = state(S.t), p = bob_at(g, now.th);
    ctx.strokeStyle = INK; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.moveTo(...g.pivot); ctx.lineTo(...p); ctx.stroke();
    const grd = ctx.createRadialGradient(p[0] - R * 0.35, p[1] - R * 0.4, R * 0.1, p[0], p[1], R);
    grd.addColorStop(0, '#7d9cf0'); grd.addColorStop(1, COB);
    ctx.shadowColor = 'rgba(26,27,31,.22)'; ctx.shadowBlur = 10; ctx.shadowOffsetY = 4;
    ctx.fillStyle = grd; ctx.beginPath(); ctx.arc(p[0], p[1], R, 0, Math.PI * 2); ctx.fill();
    ctx.shadowColor = 'transparent';
    // the same motion folded into a line: θ over time, solid behind, dashed ahead
    const [gx, gy, gw, gh] = g.graph, span = 6, t0 = Math.max(0, S.t - span * 0.62), tx = (t) => gx + (t - t0) / span * gw, ty = (th) => gy + gh / 2 - th / 1.2 * gh / 2;
    ctx.strokeStyle = GR + '.16)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(gx, gy + gh / 2); ctx.lineTo(gx + gw, gy + gh / 2); ctx.stroke();
    ctx.fillStyle = GR + '.5)'; ctx.font = `italic 15px "Songti SC", Georgia, serif`; ctx.fillText('θ', gx - 2, gy - 6); ctx.fillText('t', gx + gw + 6, gy + gh / 2 + 4);
    ctx.lineWidth = 2; ctx.strokeStyle = COB; ctx.beginPath();
    for (let t = t0; t <= S.t; t += 1 / 120) { const x = tx(t), y = ty(state(t).th); t === t0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y); } ctx.stroke();
    ctx.setLineDash([4, 4]); ctx.lineWidth = 1.4; ctx.strokeStyle = GR + '.45)'; ctx.beginPath();
    for (let t = S.t; t <= Math.min(T_END, t0 + span); t += 1 / 120) { const x = tx(t), y = ty(state(t).th); t === S.t ? ctx.moveTo(x, y) : ctx.lineTo(x, y); } ctx.stroke(); ctx.setLineDash([]);
    // the ghosts' instants marked on the line, so the two views are one
    for (let k = 1; k <= PAST / STEP; k++) { const t = S.t - k * STEP; if (t < t0) break; ctx.fillStyle = `rgba(47,91,210,${0.45 * (1 - k * STEP / PAST) + 0.05})`; ctx.beginPath(); ctx.arc(tx(t), ty(state(t).th), 2.4, 0, Math.PI * 2); ctx.fill(); }
    ctx.fillStyle = COB; ctx.beginPath(); ctx.arc(tx(S.t), ty(now.th), 4.5, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = INK; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(tx(S.t), gy - 4); ctx.lineTo(tx(S.t), gy + gh + 4); ctx.stroke();
    // the ring of time: engraved ticks that turn with it, a notch for now
    const [rx, ry, rr] = g.ring, turn = S.t * 0.9;
    ctx.save(); ctx.translate(rx, ry);
    ctx.shadowColor = 'rgba(26,27,31,.16)'; ctx.shadowBlur = 18; ctx.shadowOffsetY = 6;
    ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(0, 0, rr, 0, Math.PI * 2); ctx.arc(0, 0, rr * 0.56, 0, Math.PI * 2, true); ctx.fill();
    ctx.shadowColor = 'transparent';
    ctx.strokeStyle = GR + '.14)'; ctx.lineWidth = 0.75; ctx.beginPath(); ctx.arc(0, 0, rr, 0, Math.PI * 2); ctx.stroke(); ctx.beginPath(); ctx.arc(0, 0, rr * 0.56, 0, Math.PI * 2); ctx.stroke();
    for (let i = 0; i < 48; i++) { const a = i / 48 * Math.PI * 2 - turn, long = i % 4 === 0; ctx.strokeStyle = GR + (long ? '.55)' : '.28)'); ctx.lineWidth = long ? 1.3 : 0.9; ctx.beginPath(); ctx.moveTo(Math.cos(a) * rr * 0.66, Math.sin(a) * rr * 0.66); ctx.lineTo(Math.cos(a) * rr * (long ? 0.86 : 0.8), Math.sin(a) * rr * (long ? 0.86 : 0.8)); ctx.stroke(); }
    ctx.fillStyle = INK; ctx.beginPath(); ctx.moveTo(0, -rr - 7); ctx.lineTo(-5, -rr - 14); ctx.lineTo(5, -rr - 14); ctx.closePath(); ctx.fill();
    ctx.restore();
    ctx.fillStyle = GR + '.62)'; ctx.font = `500 13px ${SANS}`; ctx.textAlign = 'center'; ctx.fillText(S.t.toFixed(2) + ' s', rx, ry + 4.5); ctx.textAlign = 'left';
  }
  const sched = scheduler((dt) => {
    if (!S.dragging) { S.t = Math.max(0, Math.min(T_END, S.t + S.v * dt)); S.v *= Math.pow(0.35, dt); if (Math.abs(S.v) < 0.02) S.v = 0; if (S.t <= 0 || S.t >= T_END) S.v = 0; }
    draw(); return S.v !== 0 || S.dragging;
  });
  // turning the ring moves time; a flick keeps it going
  const ang = (x, y) => { const [rx, ry] = geo().ring; return Math.atan2(y - ry, x - rx); };
  canvas.addEventListener('pointerdown', (e) => {
    const r = canvas.getBoundingClientRect(), x = e.clientX - r.left, y = e.clientY - r.top, g = geo();
    const onring = Math.hypot(x - g.ring[0], y - g.ring[1]) < g.ring[2] * 1.4;
    S.dragging = true; S.mode = onring ? 'ring' : 'drag'; S.a0 = ang(x, y); S.x0 = x; S.t0 = S.t; S.v = 0; S.last = [[performance.now(), S.t]];
    canvas.setPointerCapture(e.pointerId); sched.wake();
  });
  canvas.addEventListener('pointermove', (e) => {
    if (!S.dragging) return; const r = canvas.getBoundingClientRect(), x = e.clientX - r.left, y = e.clientY - r.top;
    if (S.mode === 'ring') { let a = ang(x, y), d = a - S.a0; if (d > Math.PI) d -= 2 * Math.PI; if (d < -Math.PI) d += 2 * Math.PI; S.a0 = a; S.t = Math.max(0, Math.min(T_END, S.t + d / 0.9)); }
    else S.t = Math.max(0, Math.min(T_END, S.t0 + (x - S.x0) / 160));
    S.last.push([performance.now(), S.t]); if (S.last.length > 6) S.last.shift(); sched.wake();
  });
  canvas.addEventListener('pointerup', () => { S.dragging = false; const a = S.last[0], b = S.last[S.last.length - 1]; S.v = b && a && b[0] > a[0] ? (b[1] - a[1]) / ((b[0] - a[0]) / 1000) : 0; S.v = Math.max(-3, Math.min(3, S.v)); sched.wake(); });
  fit(); draw();
  return {
    visible: (v) => sched.set_visible(v), resize: () => { fit(); draw(); },
    demo() { S.v = 1.6; sched.wake(); },
    at(t) { S.t = t; S.v = 0; draw(); },
    async accept() {
      // strobe truth: the arc between consecutive ghosts over the step is the speed at the midpoint
      let worst = 0;
      for (let t = 0.5; t < 10; t += 0.37) { const a = state(t).th, b = state(t + STEP).th, mid = state(t + STEP / 2).om; if (Math.abs(mid) < 0.5) continue; worst = Math.max(worst, Math.abs(Math.abs(b - a) / STEP / Math.abs(mid) - 1)); }
      // scrub forward and back: the frame is the same
      S.t = 3.3; draw(); const A = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
      for (let i = 0; i < 40; i++) { S.t += 0.071; draw(); } for (let i = 0; i < 40; i++) { S.t -= 0.071; draw(); }
      S.t = 3.3; draw(); const B = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
      let diff = 0; for (let i = 0; i < A.length; i++) diff = Math.max(diff, Math.abs(A[i] - B[i]));
      return { pass: worst < 0.02 && diff === 0, value: `${zh ? '弧长/步长 与速度之差' : 'arc/step vs speed'} ≤ ${(worst * 100).toFixed(2)}%; ${zh ? '复原后像素差' : 'pixel difference after scrubbing'} ${diff}` };
    },
  };
}
