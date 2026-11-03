// Memory patina. What you have learned is printed in ink, and the ink ages along your forgetting curve: retention
// R = exp(−t / S) since the last review (Ebbinghaus; the exponential of spaced-repetition models such as FSRS's
// ancestors). The print fades by exactly R and its edge softens as R falls, like old type. Tap a card to review it:
// the ink comes back crisp, and its stability S grows, more when you were close to forgetting (the spacing effect),
// so the next fade is slower. Drag the day rule to let weeks pass; every day is computed, never animated by feel.
// As a library primitive: patina(mobject, R) for anything the learner has met before.
import { scheduler } from '../../lib/gl.js';
import { Spring } from '../../lib/ui.js';
import { SANS, SERIF, C, GR, roundrect, fit2d, local } from './_loop.js';

export const meta = {
  id: 'patina',
  name: { zh: '记忆的包浆', en: 'Memory patina' },
  means: { zh: '学过的东西像旧书上的字一样随遗忘曲线褪色、边缘变软；复习一次就重新印清楚，而且下一次褪得更慢。', en: 'What you learned fades like old print along your forgetting curve, its edges softening; a review prints it crisp again, and the next fade is slower.' },
  test: { zh: '每张卡上实际渲染的墨量 ÷ 新印时的墨量 = R(t)（逐张测量）；每次复习后稳定度 S 严格增大', en: 'Ink actually rendered on each card ÷ ink when fresh = R(t), measured card by card; stability S strictly grows with every review' },
};

// the forgetting model: R = exp(−Δt / S); a review multiplies S by more when R had fallen further
export const retention = (dt, S) => Math.exp(-Math.max(0, dt) / S);
export const grow = (S, R) => S * (1.2 + 3 * (1 - R));
// the state of a card at day t from its history (learned at reviews[0], reviewed at the rest)
export function memory(card, t) {
  let S = card.S0, last = card.reviews[0], n = 0;
  for (let i = 1; i < card.reviews.length; i++) { const d = card.reviews[i]; if (d > t) break; S = grow(S, retention(d - last, S)); last = d; n++; }
  return { R: t < card.reviews[0] ? 0 : retention(t - last, S), S, last, n };
}

// six things from six lessons; one coloured noun each, so the pigment ages too
const CARDS = [
  { course: { zh: '线性代数', en: 'Linear algebra' }, term: { zh: '特征向量', en: 'Eigenvector' }, gist: [['A', 0], ['v', 'cobalt'], [' = λ', 0], ['v', 'cobalt']], S0: 10, reviews: [-2] },
  { course: { zh: '概率', en: 'Probability' }, term: { zh: '贝叶斯公式', en: 'Bayes’ rule' }, gist: [['P(', 0], ['A', 'violet'], ['|B) ∝ P(B|', 0], ['A', 'violet'], [')P(', 0], ['A', 'violet'], [')', 0]], S0: 20, reviews: [-12] },
  { course: { zh: '模型预测控制', en: 'MPC' }, term: { zh: '起作用的约束', en: 'Active constraint' }, gist: [['λ', 'ochre'], [' > 0 ⇔ 贴着墙', 0]], gist_en: [['λ', 'ochre'], [' > 0 ⇔ on the wall', 0]], S0: 6, reviews: [-0.5] },
  { course: { zh: '大模型微调', en: 'Fine-tuning' }, term: { zh: '低秩适配', en: 'LoRA' }, gist: [['W + ', 0], ['BA', 'teal'], ['，秩 r ≪ d', 0]], gist_en: [['W + ', 0], ['BA', 'teal'], [',  rank r ≪ d', 0]], S0: 7.5, reviews: [-9] },
  { course: { zh: '统计', en: 'Statistics' }, term: { zh: '大数定律', en: 'Law of large numbers' }, gist: [['x̄', 'viridian'], ['ₙ → μ', 0]], S0: 5, reviews: [-20, -6] },
  { course: { zh: '线性代数', en: 'Linear algebra' }, term: { zh: '行列式', en: 'Determinant' }, gist: [['面积', 'cobalt'], ['放大的倍数', 0]], gist_en: [['how ', 0], ['area', 'cobalt'], [' scales', 0]], S0: 9, reviews: [-4] },
];
const DAYS = 56, HIST = -21;          // the rule runs from today to eight weeks on; the curves show three weeks back too
const BLUR = 1.5;                      // CSS px of edge softening when R → 0

export function make({ stage, canvas, hud, lang }) {
  const zh = lang === 'zh', ctx = canvas.getContext('2d');
  let W = 0, H = 0, dpr = 1, L = null;
  const cards = CARDS.map((c) => ({ ...c, reviews: c.reviews.slice(), show: new Spring(0, 0.38, 0.9), press: new Spring(0, 0.22, 0.6), layer: null }));
  const S = { t: 0, drag: false, hover: -1, forced: null };
  const day = new Spring(0, 0.5, 1);

  function layout() {
    const narrow = W < 600, cols = narrow ? 2 : 3, gap = narrow ? 12 : 22, mx = narrow ? 16 : Math.max(40, (W - 1100) / 2);
    const rows = Math.ceil(cards.length / cols), ch = narrow ? 158 : 178, rule_gap = narrow ? 92 : 110;
    const block = rows * ch + (rows - 1) * gap + rule_gap + 40, top = Math.max(narrow ? 16 : 32, (H - block) / 2), rule_y = top + rows * ch + (rows - 1) * gap + rule_gap;
    const cw = (W - 2 * mx - (cols - 1) * gap) / cols;
    const boxes = cards.map((_, i) => { const r = Math.floor(i / cols), c = i % cols; return { x: mx + c * (cw + gap), y: top + r * (ch + gap), w: cw, h: ch }; });
    const pad = narrow ? 14 : 20;
    // inside a card: the course (crisp), the printed ink (ages), the curve strip (crisp)
    const ink = (b) => ({ x: b.x + pad, y: b.y + (narrow ? 38 : 44), w: b.w - 2 * pad, h: b.h - (narrow ? 38 : 44) - (narrow ? 50 : 58) });
    const strip = (b) => ({ x: b.x + pad, y: b.y + b.h - (narrow ? 40 : 46), w: b.w - 2 * pad, h: narrow ? 26 : 30 });
    return { narrow, boxes, ink, strip, pad, rule: { x0: mx + 8, x1: W - mx - 8, y: rule_y } };
  }

  // the printed part of a card, drawn once at full strength into its own layer (with a margin for the blur)
  const M = 8;
  function print(i) {
    const c = cards[i], r = L.ink(L.boxes[i]), cv = document.createElement('canvas');
    cv.width = Math.round((r.w + 2 * M) * dpr); cv.height = Math.round((r.h + 2 * M) * dpr);
    const g = cv.getContext('2d'); g.setTransform(dpr, 0, 0, dpr, 0, 0); g.translate(M, M);
    const term = c.term[lang]; let fs = L.narrow ? 21 : 27;
    g.font = `600 ${fs}px ${SERIF}`; while (g.measureText(term).width > r.w && fs > 15) { fs--; g.font = `600 ${fs}px ${SERIF}`; }
    g.fillStyle = C.ink; g.textBaseline = 'alphabetic'; g.fillText(term, 0, fs + 2);
    const gist = (!zh && c.gist_en) || c.gist; let gs = L.narrow ? 17 : 21;
    const width = (s) => { let w = 0; for (const [t, col] of gist) { g.font = `${col ? '600 ' : ''}${/[　-鿿]/.test(t) ? '' : 'italic '}${s}px ${SERIF}`; w += g.measureText(t).width; } return w; };
    while (width(gs) > r.w && gs > 13) gs--;
    let x = 0; const y = Math.min(r.h - 6, fs + 2 + gs * 1.75);
    for (const [t, col] of gist) { g.font = `${col ? '600 ' : ''}${/[　-鿿]/.test(t) ? '' : 'italic '}${gs}px ${SERIF}`; g.fillStyle = col ? C[col] : C.ink2; g.fillText(t, x, y); x += g.measureText(t).width; }
    c.layer = cv; c.soft = null;
  }
  // ink that has aged to R: its strength is R exactly (alpha compositing is linear), its edge blurs as R falls
  // the softened print, made once per step of softness (12 steps; blur keeps the amount of ink, so R stays exact)
  const STEPS = 12;
  function softened(c, b) {
    const k = Math.round(b * STEPS); if (k === 0) return c.layer;
    c.soft ||= []; if (c.soft[k]) return c.soft[k];
    const cv = document.createElement('canvas'); cv.width = c.layer.width; cv.height = c.layer.height;
    const g = cv.getContext('2d', { willReadFrequently: true }); g.filter = `blur(${(BLUR * k / STEPS * dpr).toFixed(2)}px)`; g.drawImage(c.layer, 0, 0);
    return (c.soft[k] = cv);
  }
  function patina(g, i, R) {
    const r = L.ink(L.boxes[i]), c = cards[i];
    if (R <= 0.002) return;
    g.save(); g.globalAlpha = Math.min(1, R);
    g.drawImage(softened(c, Math.pow(1 - Math.min(1, R), 1.6)), r.x - M, r.y - M, r.w + 2 * M, r.h + 2 * M);
    g.restore();
  }

  function fit() { ({ W, H, dpr } = fit2d(canvas, ctx)); L = layout(); cards.forEach((_, i) => print(i)); }
  const shown_R = (i) => S.forced != null ? S.forced : cards[i].show.x;

  function curve(i, b) {
    const s = L.strip(b), c = cards[i], tx = (t) => s.x + (t - HIST) / (DAYS - HIST) * s.w, ty = (R) => s.y + s.h - R * s.h;
    // today, as a hairline: the strips all share one time axis
    ctx.strokeStyle = GR(0.12); ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(tx(0), s.y - 2); ctx.lineTo(tx(0), s.y + s.h); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(s.x, s.y + s.h + 0.5); ctx.lineTo(s.x + s.w, s.y + s.h + 0.5); ctx.stroke();
    const t_now = S.t, ink = C.ink2;
    const seg = (a, z, dashed) => {
      ctx.setLineDash(dashed ? [3, 3] : []); ctx.lineWidth = dashed ? 1.2 : 1.6; ctx.strokeStyle = dashed ? GR(0.42) : ink; ctx.beginPath();
      let first = true;
      for (let t = a; t <= z + 1e-6; t += 0.25) { const m = memory(dashed ? { ...c, reviews: c.reviews.filter((d) => d <= t_now) } : c, t); const x = tx(t), y = ty(m.R); first ? ctx.moveTo(x, y) : ctx.lineTo(x, y); first = false; }
      ctx.stroke(); ctx.setLineDash([]);
    };
    // the past (what happened) is solid; ahead, with no more reviews, is a dashed prediction
    seg(Math.max(HIST, c.reviews[0]), t_now, false);
    seg(t_now, DAYS, true);
    // reviews as small upright ticks
    ctx.strokeStyle = ink; ctx.lineWidth = 1.4;
    for (const d of c.reviews) if (d <= t_now && d >= HIST) { ctx.beginPath(); ctx.moveTo(tx(d), s.y + s.h); ctx.lineTo(tx(d), s.y - 1); ctx.stroke(); }
    const m = memory(c, t_now);
    ctx.fillStyle = C.ink; ctx.beginPath(); ctx.arc(tx(t_now), ty(m.R), 3, 0, Math.PI * 2); ctx.fill();
  }

  function draw() {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.fillStyle = C.paper; ctx.fillRect(0, 0, W, H);
    cards.forEach((c, i) => {
      const b = L.boxes[i], p = c.press.x, lift = S.hover === i ? 1 : 0;
      ctx.save();
      // a slight press when it is reprinted
      const cx = b.x + b.w / 2, cy = b.y + b.h / 2, k = 1 - 0.018 * p; ctx.translate(cx, cy); ctx.scale(k, k); ctx.translate(-cx, -cy);
      // paper on paper: a short crisp shadow (no blur), deeper when the hand is over it
      const d = 1.5 + 1.5 * lift - p;
      roundrect(ctx, b.x - 0.5, b.y + d, b.w + 1, b.h, 12.5); ctx.fillStyle = GR(0.045); ctx.fill();
      roundrect(ctx, b.x, b.y, b.w, b.h, 12); ctx.fillStyle = '#fff'; ctx.fill();
      ctx.strokeStyle = GR(0.09); ctx.lineWidth = 1; ctx.stroke();
      ctx.font = `500 12.5px ${SANS}`; ctx.fillStyle = C.ink2; ctx.textAlign = 'left'; ctx.fillText(c.course[lang], b.x + L.pad, b.y + (L.narrow ? 24 : 28));
      const m = memory(c, S.t);
      ctx.textAlign = 'right'; ctx.font = `500 12.5px ${SANS}`; ctx.fillStyle = C.ink; ctx.fillText(Math.round(m.R * 100) + '%', b.x + b.w - L.pad, b.y + (L.narrow ? 24 : 28)); ctx.textAlign = 'left';
      patina(ctx, i, shown_R(i));
      curve(i, b);
      ctx.restore();
    });
    // the day rule: today at the left, eight weeks on at the right; the handle is glass (where your hand is)
    const R = L.rule, tx = (t) => R.x0 + t / DAYS * (R.x1 - R.x0);
    ctx.strokeStyle = GR(0.35); ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(R.x0, R.y); ctx.lineTo(R.x1, R.y); ctx.stroke();
    ctx.font = `12.5px ${SANS}`; ctx.textAlign = 'center';
    for (let d = 0; d <= DAYS; d++) {
      const wk = d % 7 === 0, x = tx(d);
      ctx.strokeStyle = GR(wk ? 0.45 : 0.16); ctx.beginPath(); ctx.moveTo(x, R.y - (wk ? 7 : 3)); ctx.lineTo(x, R.y + (wk ? 7 : 3)); ctx.stroke();
      if (wk && (!L.narrow || d % 14 === 0)) { ctx.fillStyle = C.ink2; ctx.fillText(d === 0 ? (zh ? '今天' : 'today') : (zh ? `${d / 7} 周` : `${d / 7} wk`), x, R.y + 28); }
    }
    // the stretch of days already lived through, in ink
    ctx.strokeStyle = C.ink; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.moveTo(R.x0, R.y); ctx.lineTo(tx(S.t), R.y); ctx.stroke();
    const hx = tx(S.t);
    ctx.save(); ctx.shadowColor = GR(S.drag ? 0.26 : 0.18); ctx.shadowBlur = S.drag ? 16 : 10; ctx.shadowOffsetY = S.drag ? 5 : 3;
    ctx.fillStyle = 'rgba(255,255,255,.94)'; ctx.beginPath(); ctx.arc(hx, R.y, S.drag ? 15 : 13, 0, Math.PI * 2); ctx.fill(); ctx.restore();
    ctx.strokeStyle = GR(0.16); ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(hx, R.y, S.drag ? 15 : 13, 0, Math.PI * 2); ctx.stroke();
    ctx.fillStyle = C.ink; ctx.beginPath(); ctx.arc(hx, R.y, 3.2, 0, Math.PI * 2); ctx.fill();
    ctx.font = `600 14px ${SANS}`; ctx.fillStyle = C.ink;
    const lab = zh ? `+${Math.round(S.t)} 天` : `+${Math.round(S.t)} days`;
    if (S.t >= 0.5) ctx.fillText(lab, Math.max(R.x0 + 20, Math.min(R.x1 - 20, hx)), R.y - 26);
    ctx.textAlign = 'left';
    const mean = cards.reduce((a, c) => a + memory(c, S.t).R, 0) / cards.length;
    hud.textContent = (zh ? '平均记得 ' : 'mean retention ') + Math.round(mean * 100) + '%';
  }

  const sched = scheduler((dt) => {
    let busy = false;
    if (!S.drag && day.busy()) { busy = day.step(dt) || busy; set_day(day.x); }
    for (const c of cards) { busy = c.show.step(dt) || busy; busy = c.press.step(dt) || busy; }
    draw(); return busy;
  });
  // moving through days: every card's ink is set by the model at that day (no lag, so scrubbing is exact)
  function set_day(t) { S.t = Math.max(0, Math.min(DAYS, t)); for (const c of cards) c.show.snap(memory(c, S.t).R); }
  function review(i) {
    const c = cards[i], before = memory(c, S.t).R;
    // a review rewrites the future: later reviews (from a scrub ahead and back) are dropped
    c.reviews = c.reviews.filter((d) => d < S.t - 1e-9); c.reviews.push(S.t);
    c.show.snap(before).to(1); c.press.v = 6; c.press.to(0);
    sched.wake(900);
  }

  const hit = (x, y) => L.boxes.findIndex((b) => x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h);
  const on_rule = (x, y) => Math.abs(y - L.rule.y) < 30 && x > L.rule.x0 - 24 && x < L.rule.x1 + 24;
  const rule_t = (x) => (x - L.rule.x0) / (L.rule.x1 - L.rule.x0) * DAYS;
  canvas.addEventListener('pointerdown', (e) => {
    const [x, y] = local(canvas, e);
    if (on_rule(x, y)) { S.drag = true; day.snap(S.t); set_day(rule_t(x)); canvas.setPointerCapture(e.pointerId); sched.wake(); return; }
    const i = hit(x, y); if (i >= 0) review(i);
  });
  canvas.addEventListener('pointermove', (e) => {
    const [x, y] = local(canvas, e);
    if (S.drag) { set_day(rule_t(x)); sched.wake(); return; }
    const h = hit(x, y); canvas.style.cursor = h >= 0 || on_rule(x, y) ? 'pointer' : '';
    if (h !== S.hover) { S.hover = h; sched.wake(300); }
  });
  canvas.addEventListener('pointerup', () => { if (S.drag) { S.drag = false; day.snap(S.t); sched.wake(300); } });
  canvas.addEventListener('pointerleave', () => { if (S.hover >= 0) { S.hover = -1; sched.wake(300); } });

  fit(); set_day(0); draw();

  // darkness of a card's printed zone on the real canvas, against its white paper
  function ink_in(i) {
    const r = L.ink(L.boxes[i]), x0 = Math.floor((r.x - M + 1) * dpr), y0 = Math.floor((r.y - M + 1) * dpr), w = Math.floor((r.w + 2 * M - 2) * dpr), h = Math.floor((r.h + 2 * M - 2) * dpr);
    const d = ctx.getImageData(x0, y0, w, h).data; let s = 0;
    for (let k = 0; k < d.length; k += 4) s += 765 - d[k] - d[k + 1] - d[k + 2];
    return s;
  }
  return {
    visible: (v) => sched.set_visible(v), resize: () => { fit(); draw(); },
    // let three weeks pass, then review the most faded card
    demo() { day.snap(S.t).set(2.4, 1).to(24); sched.wake(3200); setTimeout(() => { let k = 0, lo = 2; cards.forEach((c, i) => { const R = memory(c, S.t).R; if (R < lo) { lo = R; k = i; } }); review(k); }, 2800); },
    at(t) { day.snap(t); set_day(t); draw(); },
    review, sched,
    async accept() {
      const save = cards.map((c) => c.reviews.slice()), t_save = S.t;
      // 1 · ink on screen ÷ fresh ink = R(t), for every card at several days
      S.hover = -1; for (const c of cards) c.press.snap(0);
      S.forced = 1; draw(); const fresh = cards.map((_, i) => ink_in(i)); S.forced = null;
      let worst = 0;
      for (const t of [0, 5, 13, 30, 47]) { set_day(t); draw(); cards.forEach((c, i) => { const R = memory(c, t).R; worst = Math.max(worst, Math.abs(ink_in(i) / fresh[i] - R)); }); }
      // 2 · stability strictly grows with each review, and the next fade is slower
      const probe = { S0: 3, reviews: [0, 2, 6, 15, 33] }, Ss = [];
      for (let k = 0; k < probe.reviews.length; k++) Ss.push(memory(probe, probe.reviews[k] + 1e-9).S);
      const inc = Ss.every((s, k) => k === 0 || s > Ss[k - 1]);
      cards.forEach((c, i) => { c.reviews = save[i]; }); set_day(t_save); draw();
      return { pass: worst < 0.02 && inc, value: `${zh ? '墨量与 R 之差' : 'ink vs R'} ≤ ${(worst * 100).toFixed(2)}%; S ${Ss.map((s) => s.toFixed(1)).join(' → ')} ${zh ? '天' : 'days'}` };
    },
  };
}
