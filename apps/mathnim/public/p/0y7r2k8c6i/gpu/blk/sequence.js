// A sequence diagram. Two lifelines, the client and the server, with time running down. A message takes time to cross,
// so its arrow slopes: it leaves at one moment and arrives later. Opening a TCP connection and asking for a page is drawn
// to scale: SYN, SYN-ACK, then ACK with the request (sent back to back, one arrow), the server’s work, and the reply. The round trip
// is measured on the client’s line, and the wait for the first byte with it. Slide the one-way delay and every arrow
// tilts with it; the first byte always comes two round trips (plus the server’s work) after the start.
// As a building block: sequence(lifelines, messages, { delay }).
import { scheduler, Spring, C, GR, canvas2d } from '../lib/ui.js';
import { num, text, glass_bead, drags, dimension, TICK } from '../lib/plot.js';
import { poly_x } from '../lib/geom.js';

export const meta = {
  id: 'sequence',
  name: { zh: '时序图', en: 'A sequence diagram' },
  means: { zh: '两条生命线：客户端和服务器，时间往下走。消息过去要花时间，所以箭头是斜的：一个时刻发出，晚一点才到。按比例画出建立 TCP 连接再请求网页：SYN、SYN-ACK，然后 ACK 后面紧跟着请求，服务器处理，再回复。往返时间量在客户端的线上，等到第一个字节的时间也量在那里。拖动单程延迟，所有箭头一起倾斜；第一个字节总是在开始后两个往返（加上服务器处理）到达。', en: 'Client and server lifelines, time running down. A message takes time to cross, so its arrow slopes. Opening a TCP connection and requesting a page, to scale: SYN, SYN-ACK, ACK with the request behind it, the server’s work, the reply. The round trip and the wait for the first byte are measured on the client’s line. Slide the delay and every arrow tilts.' },
  test: { zh: '每个箭头都从一条生命线到另一条，到达 = 发出 + 延迟；每条消息都在它等的那条消息到达之后才发出；往返的尺寸 = 2 × 延迟，第一个字节 = 2 × 往返 + 处理；箭头上的字互不重叠', en: 'Every arrow runs lifeline to lifeline, arriving = leaving + delay; every message leaves after the one it waits for arrives; the round-trip dimension is 2 × delay and the first byte 2 × RTT + work; arrow labels never overlap' },
  wide: true,
};

const WORK = 15;                                                         // ms the server spends on the request
// the exchange: who sends, what, and what it must wait for (an index of an earlier message, or none)
// (the ACK and the request leave back to back, so they travel as one arrow)
const MSGS = [{ from: 0, name: 'SYN' }, { from: 1, name: 'SYN-ACK', after: 0 }, { from: 0, name: 'ACK + GET /', after: 1 }, { from: 1, name: '200 OK', after: 2, work: true }];
// leave and arrive times (ms) for a one-way delay d
function times(d) {
  const t = [];
  for (const m of MSGS) { const leave = m.after === undefined ? 0 : t[m.after].arrive + (m.work ? WORK : 0); t.push({ ...m, leave, arrive: leave + d }); }
  return t;
}

export function make({ stage, canvas, lang }) {
  const zh = lang === 'zh';
  const cv = canvas2d(canvas), g = cv.ctx;
  const S = { d: 60 };
  const lift = new Spring(0);
  const geo = () => { const { W, H } = cv, top = 70, total = 4 * 100 + WORK + 2; return { xc: W * 0.3, xs: W * 0.7, top, k: (H - top - 70) / total, R: { x0: W - 260, x1: W - 40, y: H - 34 } }; };
  // where each arrow runs, in px, and the box of its label (upright along the arrow)
  function arrows(T, G) {
    return T.map((m) => {
      const x0 = m.from === 0 ? G.xc : G.xs, x1 = m.from === 0 ? G.xs : G.xc, y0 = G.top + m.leave * G.k, y1 = G.top + m.arrive * G.k;
      // (each label sits near its sender, a third of the way along, so messages crossing the other way never meet it)
      const ang = Math.atan2(y1 - y0, x1 - x0), up = ang > Math.PI / 2 || ang < -Math.PI / 2 ? ang - Math.PI : ang, mx = x0 + (x1 - x0) * 0.32, my = y0 + (y1 - y0) * 0.32, w = m.name.length * 7.4 + 8, h = 15;
      const nx = Math.sin(up), ny = -Math.cos(up), cx = mx + nx * 11, cy = my + ny * 11, c = Math.cos(up), s = Math.sin(up);
      const box = [[-w / 2, -h / 2], [w / 2, -h / 2], [w / 2, h / 2], [-w / 2, h / 2]].map(([u, v]) => [cx + u * c - v * s, cy + u * s + v * c]);
      return { m, x0, y0, x1, y1, up, cx, cy, box };
    });
  }

  function draw() {
    const { W, H } = cv, G = geo(), T = times(S.d), A = arrows(T, G), bottom = G.top + (T[3].arrive + 10) * G.k;
    g.setTransform(cv.dpr, 0, 0, cv.dpr, 0, 0); g.fillStyle = C.paper; g.fillRect(0, 0, W, H);
    // the lifelines and their names
    for (const [x, name] of [[G.xc, zh ? '客户端' : 'client'], [G.xs, zh ? '服务器' : 'server']]) {
      text(g, name, x, G.top - 18, { size: 15, weight: 650, align: 'center' });
      g.strokeStyle = GR(0.45); g.lineWidth = 1.2; g.beginPath(); g.moveTo(x, G.top - 6); g.lineTo(x, bottom); g.stroke();
    }
    // time, on the left: a tick every 50 ms
    for (let ms = 0; G.top + ms * G.k <= bottom; ms += 50) { const y = G.top + ms * G.k; g.strokeStyle = GR(0.35); g.beginPath(); g.moveTo(G.xc - 6, y); g.lineTo(G.xc, y); g.stroke(); text(g, ms + ' ms', G.xc - 12, y + 4, { size: 11, color: TICK, align: 'right', tabular: true }); }
    // the server's work, as a narrow bar on its lifeline
    const w0 = G.top + T[2].arrive * G.k, w1 = G.top + T[3].leave * G.k;
    g.fillStyle = 'rgba(26,27,31,0.08)'; g.fillRect(G.xs - 5, w0, 10, w1 - w0); g.strokeStyle = GR(0.4); g.strokeRect(G.xs - 5, w0, 10, w1 - w0);
    // the messages: sloped, because crossing takes time
    for (const a of A) {
      const col = a.m.from === 0 ? C.cobalt : C.teal, L = Math.hypot(a.x1 - a.x0, a.y1 - a.y0), ux = (a.x1 - a.x0) / L, uy = (a.y1 - a.y0) / L;
      g.strokeStyle = col; g.lineWidth = 1.8; g.beginPath(); g.moveTo(a.x0, a.y0); g.lineTo(a.x1 - ux * 8, a.y1 - uy * 8); g.stroke();
      g.fillStyle = col; g.beginPath(); g.moveTo(a.x1, a.y1); g.lineTo(a.x1 - ux * 10 - uy * 4, a.y1 - uy * 10 + ux * 4); g.lineTo(a.x1 - ux * 10 + uy * 4, a.y1 - uy * 10 - ux * 4); g.closePath(); g.fill();
      g.save(); g.translate(a.cx, a.cy); g.rotate(a.up); text(g, a.m.name, 0, 4.5, { size: 12, weight: 650, color: col, align: 'center', halo: 3 }); g.restore();
    }
    // measured on the client's line: one round trip, and the wait for the first byte
    const rtt = 2 * S.d, ttfb = T[3].arrive;
    dimension(g, [G.xc, G.top + T[1].arrive * G.k], [G.xc, G.top], 'RTT ' + num(rtt, 0) + ' ms', { off: 70, color: C.ink2 });
    dimension(g, [G.xc, G.top + ttfb * G.k], [G.xc, G.top], (zh ? '首字节 ' : 'first byte ') + num(ttfb, 0) + ' ms', { off: 150, color: C.ink2 });
    // the one-way delay on its ruler
    const R = G.R, X = (d) => R.x0 + (R.x1 - R.x0) * (d - 10) / 90;
    g.strokeStyle = GR(0.55); g.lineWidth = 1; g.beginPath(); g.moveTo(R.x0, R.y); g.lineTo(R.x1, R.y); g.stroke();
    for (const d of [10, 25, 50, 75, 100]) { g.beginPath(); g.moveTo(X(d), R.y); g.lineTo(X(d), R.y + 5); g.stroke(); text(g, String(d), X(d), R.y + 18, { size: 11, color: TICK, align: 'center', tabular: true }); }
    glass_bead(g, X(S.d), R.y, 10, lift.x, { dir: 0 });
    text(g, (zh ? '单程延迟 ' : 'one-way delay ') + num(S.d, 0) + ' ms', R.x0 - 16, R.y + 5, { size: 13, weight: 600, align: 'right', tabular: true });
  }

  const hold = drags(canvas, () => {
    const R = geo().R, X = (d) => R.x0 + (R.x1 - R.x0) * (d - 10) / 90;
    return [{ hit: (x, y) => { const d = Math.hypot(x - X(S.d), y - R.y); return d < 22 ? d : Math.abs(y - R.y) < 12 && x > R.x0 && x < R.x1 ? 40 : Infinity; }, down() { lift.to(1); }, up() { lift.to(0); },
      move: (x) => { S.d = Math.round(Math.max(10, Math.min(100, 10 + (x - R.x0) / (R.x1 - R.x0) * 90))); } }];
  }, { change: () => sched.wake() });
  const sched = scheduler((dt) => { const busy = lift.step(dt); draw(); return busy || !!hold.active; });
  const resize = () => { cv.fit(); draw(); };
  resize();

  return {
    visible: (v) => sched.set_visible(v), resize,
    async accept() {
      let ends = 0, causal = 0, dims = 0, clash = 0;
      for (let d = 10; d <= 100; d += 5) {
        const T = times(d), G = geo(), A = arrows(T, G);
        for (const a of A) {
          if (Math.abs(a.x0 - (a.m.from === 0 ? G.xc : G.xs)) > 1e-9 || Math.abs(a.x1 - (a.m.from === 0 ? G.xs : G.xc)) > 1e-9) ends++;
          if (Math.abs((a.y1 - a.y0) / G.k - d) > 1e-9) ends++;
          if (a.m.after !== undefined && a.m.leave < T[a.m.after].arrive - 1e-9) causal++;
        }
        if (Math.abs((T[1].arrive - T[0].leave) - 2 * d) > 1e-9 || Math.abs(T[3].arrive - (2 * 2 * d + WORK)) > 1e-9) dims++;
        for (let i = 0; i < A.length; i++) for (let j = i + 1; j < A.length; j++) if (poly_x(A[i].box, A[j].box)) clash++;
      }
      const pass = ends === 0 && causal === 0 && dims === 0 && clash === 0;
      return { pass, value: zh ? `19 种延迟：端点或到达时刻错 ${ends}；先于所等消息发出 ${causal}；往返或首字节不对 ${dims}；标签重叠 ${clash}` : `19 delays: ${ends} wrong ends or arrivals; ${causal} sent before what they wait for; ${dims} wrong RTT or first byte; ${clash} label overlaps` };
    },
  };
}
