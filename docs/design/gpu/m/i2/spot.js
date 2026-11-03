// Spot the error. A short derivation in which one step is wrong. Tap the line you suspect. If it is the faulty
// step, a fine crack runs under it and ends exactly at the faulty token, the paper opens, and the corrected line
// rises out of the crack beneath it; the lines that followed from the mistake re-derive themselves, and the figure's
// claimed minimum (hollow: a claim) slides to the true one and fills. If the line you chose is fine, it is quietly
// confirmed: a solid rule draws under it. Nothing turns red; nothing says "wrong".
// As a library primitive: spot(derivation, checks) for any worked example whose steps can be checked.
import { scheduler } from '../../lib/gl.js';
import { Spring } from '../../lib/ui.js';
import { SANS, SERIF, C, GR, rgba, fit2d, local, mulberry, verb } from './_loop.js';

export const meta = {
  id: 'spot',
  name: { zh: '找出错的那一步', en: 'Spot the error' },
  means: { zh: '推导里有一步是错的：点中它，纸沿着这一步裂开，裂缝正好指着出错的那个记号，改正的一行从裂缝下面升上来；点到对的行，它只是被轻轻确认。', en: 'One step of a derivation is wrong: tap it and the paper cracks along that step, the crack pointing at the exact faulty token, and the corrected line rises from beneath; tap a sound line and it is quietly confirmed.' },
  test: { zh: '每一行都从屏幕上的文字解析出来、代入数值检验；只有一步不成立；裂缝的尖端（按像素找）落在出错记号的框里', en: 'Every line is parsed from the text on screen and checked by substituting values; exactly one step fails; the crack’s tip (found in the pixels) lies on the faulty token’s box' },
};

// The derivation. [ ] marks the faulty token. Each step says how it should follow from the line above.
const LINES = [
  { s: 'J(u) = (u − 2)² + 3u²', step: 'def' },
  { s: 'J′(u) = 2(u − 2) + [3u]', fix: 'J′(u) = 2(u − 2) + [6u]', step: 'deriv' },
  { s: '= 5u − 4', fix: '= 8u − 4', step: 'same' },
  { s: 'J′(u) = 0  ⇒  u = 4/5', fix: 'J′(u) = 0  ⇒  u = 1/2', step: 'root' },
];
const FAULT = 1;
const Q = {
  zh: { q: '这段推导里有一步错了。', again: '再来一次' },
  en: { q: 'One step in this derivation is wrong.', again: 'Again' },
};

// the right-hand side of a line as a function of u, read from its text (so the check is of what is shown)
function rhs(s) { const i = s.lastIndexOf('= '); return s.slice(i + 2).replace(/[[\]]/g, ''); }
export function to_fn(expr) {
  const js = expr.replace(/−/g, '-').replace(/²/g, '**2').replace(/(\d|\))\s*(?=[u(])/g, '$1*');
  return new Function('u', `return (${js});`);
}
// does line k follow from line k−1 (substituting values of u)?
export function step_ok(lines, k) {
  const L = lines[k], prev = k > 0 ? lines[k - 1] : null, us = [-1.7, -0.4, 0.3, 1.1, 2.6, 4.2];
  if (L.step === 'def') return true;
  if (L.step === 'root') { const r = to_fn(rhs(L.s))(0), f = to_fn(rhs(prev.s)); return Math.abs(f(r)) < 1e-9; }
  const f = to_fn(rhs(L.s)), g = to_fn(rhs(prev.s));
  if (L.step === 'same') return us.every((u) => Math.abs(f(u) - g(u)) < 1e-9);
  if (L.step === 'deriv') { const h = 1e-5; return us.every((u) => Math.abs(f(u) - (g(u + h) - g(u - h)) / (2 * h)) < 1e-5); }
  return false;
}

const smooth01 = (t) => { t = Math.max(0, Math.min(1, t)); return t * t * (3 - 2 * t); };

export function make({ stage, canvas, hud, lang }) {
  const T = Q[lang], ctx = canvas.getContext('2d', { willReadFrequently: true });
  let W = 0, H = 0, dpr = 1, G = null;
  const S = {
    found: false,
    crack: new Spring(0, 0.55, 1), gap: new Spring(0, 0.42, 0.86), rise: new Spring(0, 0.4, 0.9), fix: new Spring(0, 0.5, 0.92),
    ok: LINES.map(() => new Spring(0, 0.5, 1)), press: -1,
  };
  const again = verb(stage, T.again); again.className = 'lp-verb quiet away';

  // a line laid out as characters: letters italic, the rest upright; u in cobalt (the noun shared with the figure)
  function chars(s, size) {
    const out = []; let x = 0, bad = false;
    for (const ch of s) {
      if (ch === '[') { bad = true; continue; } if (ch === ']') { bad = false; continue; }
      const it = /[a-zA-Z]/.test(ch), font = `${it ? 'italic ' : ''}${size}px ${SERIF}`;
      ctx.font = font; const w = ctx.measureText(ch).width;
      out.push({ ch, x, w, font, bad, col: ch === 'u' ? C.cobalt : null }); x += w;
    }
    return { cs: out, w: x };
  }
  // the first " = " is the alignment column; a line that starts with "=" hangs from it
  function lay(s, size, xeq) {
    const i = s.startsWith('=') ? 0 : s.indexOf(' = ') + 1, L = chars(s, size), lhs = L.cs.slice(0, i).reduce((a, c) => a + c.w, 0);
    for (const c of L.cs) c.x += xeq - lhs;
    return L.cs;
  }
  function geo() {
    const narrow = W < 640, size = narrow ? 23 : 30, lh = narrow ? 56 : 70;
    const x0 = narrow ? 20 : Math.max(48, W * 0.08), top = narrow ? 64 : Math.max(96, H * 0.17);
    const xeq = x0 + (narrow ? 70 : 92), y0 = top + (narrow ? 72 : 96);
    const fig = narrow ? { x: 40, y: y0 + 4 * lh + 64, w: W - 64, h: Math.min(200, H - (y0 + 4 * lh + 64) - 96) } : { x: W * 0.6, y: y0 - 30, w: Math.min(W * 0.32, 420), h: Math.min(H * 0.46, 330) };
    return { narrow, size, lh, x0, top, xeq, y0, fig, right: narrow ? W - 20 : W * 0.52 };
  }
  function fit() {
    ({ W, H, dpr } = fit2d(canvas, ctx)); G = geo();
    // the crack spans the derivation, a little past its longest line on each side
    let r = 0; for (const L of LINES) for (const t of [L.s, L.fix || L.s]) { const cs = lay(t, G.size, G.xeq); r = Math.max(r, cs[cs.length - 1].x + cs[cs.length - 1].w); }
    G.left = G.x0 - 64; G.right = Math.min(W + 30, r + 70);
  }
  // where each line sits: the gap for the corrected line opens under the faulty one
  const line_y = (k) => G.y0 + k * G.lh + (k > FAULT ? S.gap.x * G.lh : 0);
  // the faulty token's box, measured from the laid-out text
  function bad_box() {
    const cs = lay(LINES[FAULT].s, G.size, G.xeq).filter((c) => c.bad), y = line_y(FAULT);
    ctx.font = cs[0].font; const m = ctx.measureText(cs.map((c) => c.ch).join(''));
    return { x0: cs[0].x, x1: cs[cs.length - 1].x + cs[cs.length - 1].w, y0: y - m.actualBoundingBoxAscent, y1: y + m.actualBoundingBoxDescent };
  }
  // the crack: an angular fissure along the step, right across the column, with one branch that rises to the
  // faulty token's foot (seeded, so it is the same crack every time)
  const crack_y = () => line_y(FAULT) + (G.lh - G.size * 0.5) / 2;
  function crack_path() {
    const bx = bad_box(), yc = crack_y(), rng = mulberry(5), main = [];
    const cx = (bx.x0 + bx.x1) / 2, root = cx - 9;
    for (let x = G.left; x < G.right; x += 9 + rng() * 14) { if (x < root && x + 23 > root) { main.push([x, yc + (rng() - 0.5) * 3]); x = root - 9; continue; } main.push([x, yc + (rng() - 0.5) * 3.4]); }
    main.push([G.right, yc + (rng() - 0.5) * 2]);
    main.sort((p, q) => p[0] - q[0]);
    // the branch leaves the main crack at root and ends on the token's box
    let ry = yc; for (let i = 1; i < main.length; i++) if (main[i][0] >= root) { const p = main[i - 1], q = main[i], f = (root - p[0]) / (q[0] - p[0]); ry = p[1] + (q[1] - p[1]) * f; break; }
    const branch = [[root, ry], [root + 4, (ry + bx.y1) / 2 + 1.5], [cx, bx.y1 - 0.5]];
    return { main, branch, yc };
  }
  // the part of a polyline up to a length
  function upto(pts, d) {
    const out = [pts[0]];
    for (let i = 1; i < pts.length; i++) { const p = pts[i - 1], q = pts[i], l = Math.hypot(q[0] - p[0], q[1] - p[1]); if (d >= l) { out.push(q); d -= l; } else { out.push([p[0] + (q[0] - p[0]) * d / l, p[1] + (q[1] - p[1]) * d / l]); return out; } }
    return out;
  }
  const length = (pts) => pts.reduce((a, q, i) => i ? a + Math.hypot(q[0] - pts[i - 1][0], q[1] - pts[i - 1][1]) : 0, 0);
  // k runs the crack from the left edge; o (px) is how far the paper has parted below it
  function draw_crack(g, k, o = 0) {
    if (k <= 0.001) return;
    const { main, branch } = crack_path(), lm = length(main), root = branch[0][0];
    const run = upto(main, k * lm), head = run[run.length - 1][0];
    if (o > 0.3) {
      // the layer beneath, seen through the opening, with the lip's shadow
      // the lower lip is the upper one moved down, closing smoothly at both ends (sampled finely so it curves)
      const oo = (x) => o * smooth01((x - G.left) / 70) * smooth01((G.right - x) / 70), dense = [];
      for (let i = 1; i < run.length; i++) { const p = run[i - 1], q = run[i], n = Math.max(1, Math.ceil((q[0] - p[0]) / 4)); for (let j = 0; j < n; j++) dense.push([p[0] + (q[0] - p[0]) * j / n, p[1] + (q[1] - p[1]) * j / n]); }
      dense.push(run[run.length - 1]);
      g.beginPath(); dense.forEach((p, i) => (i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1]))); for (let i = dense.length - 1; i >= 0; i--) g.lineTo(dense[i][0], dense[i][1] + oo(dense[i][0])); g.closePath();
      g.fillStyle = '#efece5'; g.fill();
      g.strokeStyle = GR(0.16); g.lineWidth = 1; g.beginPath(); dense.forEach((p, i) => (i ? g.lineTo(p[0], p[1] + oo(p[0])) : g.moveTo(p[0], p[1] + oo(p[0])))); g.stroke();
    }
    g.lineJoin = 'miter'; g.lineCap = 'round';
    g.strokeStyle = rgba(C.ink, 0.85); g.lineWidth = 1.5; g.beginPath(); run.forEach((p, i) => (i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1]))); g.stroke();
    if (head > root) {
      const lb = length(branch), f = Math.min(1, (head - root) / 40), br = upto(branch, f * lb);
      g.lineWidth = 1.1; g.beginPath(); br.forEach((p, i) => (i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1]))); g.stroke();
    }
  }
  function draw_line(cs, y, a = 1, dy = 0) {
    ctx.save(); ctx.globalAlpha = a;
    for (const c of cs) { ctx.font = c.font; ctx.fillStyle = c.col || C.ink; ctx.fillText(c.ch, c.x, y + dy); }
    ctx.restore();
  }
  // a line that re-derives itself: the characters that change cross over, the rest stay put
  function draw_morph(k, f) {
    const a = lay(LINES[k].s, G.size, G.xeq), b = lay(LINES[k].fix, G.size, G.xeq), y = line_y(k);
    const same = (i) => a[i] && b[i] && a[i].ch === b[i].ch && Math.abs(a[i].x - b[i].x) < 0.01;
    draw_line(a.filter((_, i) => same(i)), y);
    draw_line(a.filter((_, i) => !same(i)), y, 1 - f, -10 * f);
    draw_line(b.filter((_, i) => !same(i)), y, f, 10 * (1 - f));
  }

  function figure() {
    const F = G.fig, ux = (u) => F.x + (u + 0.6) / 2.4 * F.w, Jf = to_fn(rhs(LINES[0].s)), jy = (j) => F.y + F.h - (j - 0.8) / 4.6 * F.h;
    ctx.strokeStyle = GR(0.35); ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(F.x, F.y + F.h); ctx.lineTo(F.x + F.w, F.y + F.h); ctx.stroke();
    ctx.font = `13px ${SANS}`; ctx.fillStyle = C.ink2; ctx.textAlign = 'center';
    for (const u of [0, 1]) { ctx.beginPath(); ctx.moveTo(ux(u), F.y + F.h - 4); ctx.lineTo(ux(u), F.y + F.h + 4); ctx.stroke(); ctx.fillText(String(u), ux(u), F.y + F.h + 20); }
    ctx.font = `italic 15px ${SERIF}`; ctx.fillStyle = C.cobalt; ctx.fillText('u', F.x + F.w + 10, F.y + F.h + 5);
    ctx.fillStyle = C.ink; ctx.textAlign = 'left'; ctx.fillText('J', F.x - 2, F.y - 6);
    ctx.save(); ctx.beginPath(); ctx.rect(F.x - 4, F.y - 4, F.w + 8, F.h + 4); ctx.clip();
    ctx.strokeStyle = C.ink; ctx.lineWidth = 2; ctx.beginPath();
    for (let i = 0; i <= 120; i++) { const u = -0.6 + 2.4 * i / 120, x = ux(u), y = jy(Jf(u)); i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); } ctx.stroke(); ctx.restore();
    // the claimed minimiser, read from the last line: hollow and dashed (a claim) until it is the truth
    const ua = to_fn(rhs(LINES[3].s))(0), ub = to_fn(rhs(LINES[3].fix))(0), f = S.found ? S.fix.x : 0, u = ua + (ub - ua) * f;
    const x = ux(u), y = jy(Jf(u));
    ctx.setLineDash([3, 4]); ctx.strokeStyle = rgba(C.cobalt, 0.6); ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(x, y + 10); ctx.lineTo(x, F.y + F.h); ctx.stroke();
    ctx.setLineDash(f > 0.98 ? [] : [4, 3.2 * (1 - f) + 0.01]); ctx.lineWidth = 2; ctx.strokeStyle = C.cobalt;
    ctx.beginPath(); ctx.arc(x, y, 9, 0, Math.PI * 2); ctx.stroke(); ctx.setLineDash([]);
    if (f > 0) { ctx.globalAlpha = f; ctx.fillStyle = C.cobalt; ctx.beginPath(); ctx.arc(x, y, 9, 0, Math.PI * 2); ctx.fill(); ctx.globalAlpha = 1; }
  }

  function draw() {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.fillStyle = C.paper; ctx.fillRect(0, 0, W, H);
    ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
    ctx.font = `600 ${G.narrow ? 18 : 20}px ${SANS}`; ctx.fillStyle = C.ink; ctx.fillText(T.q, G.x0, G.top);
    LINES.forEach((L, k) => {
      const y = line_y(k);
      if (S.found && L.fix && k !== FAULT) draw_morph(k, S.fix.x);
      else draw_line(lay(L.s, G.size, G.xeq), y, k === FAULT && S.found ? 1 - 0.5 * S.rise.x : 1);
      // a sound line, confirmed: a solid rule draws beneath it
      const o = S.ok[k].x;
      if (o > 0.002) {
        const cs = lay(L.s, G.size, G.xeq), a = cs[0].x, b = cs[cs.length - 1].x + cs[cs.length - 1].w;
        ctx.strokeStyle = C.ink2; ctx.lineWidth = 1.25; ctx.beginPath(); ctx.moveTo(a, y + 12); ctx.lineTo(a + (b - a) * o, y + 12); ctx.stroke();
      }
    });
    // the crack, and the corrected line on the layer beneath, rising into the opening
    if (S.found) {
      const o = G.lh * S.gap.x, yc = crack_y();
      draw_crack(ctx, S.crack.x, o);
      ctx.save(); ctx.beginPath(); ctx.rect(0, yc + 2, W, Math.max(0, o - 3)); ctx.clip();
      const cs = lay(LINES[FAULT].fix, G.size, G.xeq), y = yc + G.lh * 0.5 + G.size * 0.32;
      draw_line(cs, y + (1 - S.rise.x) * G.lh * 0.45, Math.min(1, S.rise.x * 1.3));
      const fixed = cs.filter((c) => c.bad);
      if (fixed.length && S.rise.x > 0.5) { const a = fixed[0].x, b = fixed[fixed.length - 1].x + fixed[fixed.length - 1].w; ctx.globalAlpha = (S.rise.x - 0.5) * 2; ctx.strokeStyle = C.ink; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(a, y + 8); ctx.lineTo(b, y + 8); ctx.stroke(); ctx.globalAlpha = 1; }
      ctx.restore();
    }
    figure();
    again.style.left = (W / 2 - again.offsetWidth / 2) + 'px'; again.style.top = (H - (G.narrow ? 76 : 84)) + 'px';
  }

  const springs = () => [S.crack, S.gap, S.rise, S.fix, ...S.ok];
  const sched = scheduler((dt) => {
    // one beat after another: the crack runs, the paper opens, the line rises, what followed re-derives
    if (S.found) { if (S.crack.x > 0.9) S.gap.to(1); if (S.gap.x > 0.7) S.rise.to(1); if (S.rise.x > 0.8) S.fix.to(1); }
    let b = false; for (const s of springs()) b = s.step(dt) || b; draw(); return b || (S.found && S.fix.x < 0.999);
  });
  function tap(k) {
    if (S.found || k < 0) return;
    if (!step_ok(LINES, k)) { S.found = true; S.crack.to(1); again.classList.remove('away'); hud.textContent = ''; }
    else S.ok[k].to(1);
    sched.wake(2500);
  }
  function reset() { S.found = false; for (const s of springs()) s.snap(0); again.classList.add('away'); sched.wake(300); }
  again.addEventListener('click', reset);
  const row = (x, y) => { for (let k = 0; k < LINES.length; k++) { const yl = line_y(k); if (y > yl - G.size - 6 && y < yl + G.lh - G.size - 2 && x > G.x0 - 12 && x < G.right) return k; } return -1; };
  canvas.addEventListener('pointerdown', (e) => { const [x, y] = local(canvas, e); tap(row(x, y)); });
  canvas.addEventListener('pointermove', (e) => { const [x, y] = local(canvas, e); canvas.style.cursor = !S.found && row(x, y) >= 0 ? 'pointer' : ''; });
  fit(); draw();
  return {
    visible: (v) => sched.set_visible(v), resize: () => { fit(); draw(); },
    // first a sound line, then the faulty one
    demo() { tap(2); setTimeout(() => tap(FAULT), 1100); },
    tap, reset,
    async accept() {
      // 1 · the steps, checked from the text: only the faulty one fails; the corrected chain holds throughout
      const verdict = LINES.map((_, k) => step_ok(LINES, k));
      const fixed = LINES.map((L) => ({ ...L, s: L.fix || L.s })), fixed_ok = fixed.every((_, k) => step_ok(fixed, k));
      const one = verdict.filter((v) => !v).length === 1 && !verdict[FAULT];
      // 2 · the crack drawn alone: its tip is the pixel furthest along it; it must lie on the token's box
      reset(); S.found = true; S.crack.snap(1); S.gap.snap(1); S.rise.snap(1); S.fix.snap(1); draw();
      const off = document.createElement('canvas'); off.width = canvas.width; off.height = canvas.height;
      const g = off.getContext('2d', { willReadFrequently: true }); g.setTransform(dpr, 0, 0, dpr, 0, 0); draw_crack(g, 1, 0);
      const d = g.getImageData(0, 0, off.width, off.height).data;
      // the crack's highest inked pixel is the end of its branch: the tip
      let tip = null;
      for (let y = 0; y < off.height && !tip; y++) { let xs = 0, n = 0; for (let x = 0; x < off.width; x++) if (d[(y * off.width + x) * 4 + 3] > 40) { xs += x; n++; } if (n) tip = [(xs / n + 0.5) / dpr, (y + 0.5) / dpr]; }
      const b = bad_box(), on = tip && tip[0] >= b.x0 && tip[0] <= b.x1 && tip[1] >= b.y0 && tip[1] <= b.y1;
      reset(); draw();
      const zh = lang === 'zh';
      return { pass: one && fixed_ok && on, value: `${zh ? '各步' : 'steps'} ${verdict.map((v) => (v ? '✓' : '✗')).join(' ')}; ${zh ? '改正后' : 'corrected'} ${fixed_ok ? '✓✓✓✓' : '✗'}; ${zh ? '裂缝尖端' : 'crack tip'} (${tip ? tip.map((v) => v.toFixed(1)).join(', ') : '—'}) ${on ? (zh ? '在' : 'on') : (zh ? '不在' : 'off')} ${zh ? '「3u」' : '"3u"'} [${b.x0.toFixed(1)}–${b.x1.toFixed(1)}, ${b.y0.toFixed(1)}–${b.y1.toFixed(1)}]` };
    },
  };
}
