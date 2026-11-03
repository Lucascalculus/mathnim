// Exploded formula. A formula is an assembly, and it can be drawn the way an engineer draws one: pull it apart and
// the camera turns to the house view while each part lifts on its own card, straight up along one axis. Light from
// straight above leaves every part's shadow exactly where it sits, so the paper keeps the assembled formula; a leader
// runs from each part to what it means. Let go and the parts drop back into their shadows, glyph for glyph.
// As a library primitive: explode(formula, parts, labels) for any typeset expression (an equation, a sentence, a
// figure's layers); the heights and the label places are computed, not hand-set.
import { scheduler, Spring, SANS, SERIF, C, GR, fit2d, css } from '../lib/ui.js';
import { seg_x, seg_poly, poly_x, rect_poly, nearest_on, hull, grow } from '../lib/geom.js';

export const meta = {
  id: 'explode',
  name: { zh: '分解的公式', en: 'Exploded formula' },
  means: { zh: '像工程图里的分解图一样把公式拆开：每一部分升到自己的一层，引线指向它的意思；放手，它们落回原处。', en: 'Take a formula apart like an exploded engineering drawing: each part rises on its own layer with a leader to what it means; let go and they drop back.' },
  test: { zh: '合上后每个字形回到排版位置（误差 0 px）；引线互不相交，也不穿过任何字形', en: 'Reassembled, every glyph is back at its typeset place (0 px); no leader crosses another leader or any glyph' },
  wide: true,
};

const AZ = -0.5, EL = 0.66, RAIL = 72;   // the house camera, the same on every page
// Bayes' rule. Letters: i italic, u upright; A and B carry their nouns (the hypothesis, the evidence).
const PARTS = [
  { id: 'post', row: 'main', t: [['P', 'i'], ['(', 'u'], ['A', 'i', 'cobalt'], ['|', 'u'], ['B', 'i', 'ochre'], [')', 'u']] },
  { id: 'eq', row: 'main', base: true, t: [['=', 'u']] },
  { id: 'lik', row: 'num', t: [['P', 'i'], ['(', 'u'], ['B', 'i', 'ochre'], ['|', 'u'], ['A', 'i', 'cobalt'], [')', 'u']] },
  { id: 'prior', row: 'num', t: [['P', 'i'], ['(', 'u'], ['A', 'i', 'cobalt'], [')', 'u']] },
  { id: 'bar', row: 'bar', base: true, t: [] },
  { id: 'ev', row: 'den', t: [['P', 'i'], ['(', 'u'], ['B', 'i', 'ochre'], [')', 'u']] },
];
// what each part is; {A} and {B} take their colours
const LABEL = {
  zh: { post: ['后验', '看到 {B} 之后，{A} 有多可信'], lik: ['似然', '如果 {A} 成立，看到 {B} 的可能'], prior: ['先验', '看到 {B} 之前，对 {A} 的相信'], ev: ['证据', '{B} 本身有多常见'] },
  en: { post: ['posterior', 'how believable {A} is after {B}'], lik: ['likelihood', 'how likely {B} is if {A} holds'], prior: ['prior', 'belief in {A} before {B}'], ev: ['evidence', 'how common {B} is anyway'] },
};

export function make({ stage, canvas, hud, lang }) {
  const zh = lang === 'zh', ctx = canvas.getContext('2d', { willReadFrequently: true });
  let W = 0, H = 0, dpr = 1, F = 48, L = null;   // L: the layout (typeset glyphs, cards, heights, label places)
  const E = new Spring(0, 0.62, 0.86);
  const font = (k, size = F) => (k === 'i' ? `italic 400 ${size}px ${SERIF}` : `400 ${size}px ${SERIF}`);

  // ---- typesetting, in paper coordinates (px right, py down), the math axis at py = 0 ----
  function typeset() {
    const G = [], parts = {};
    const run = (p, x0, base) => {
      let x = x0; const gl = [];
      for (const [ch, k, col] of p.t) {
        ctx.font = font(k); const m = ctx.measureText(ch);
        // a hair of space after an italic capital before a bracket, as a compositor would
        gl.push({ ch, k, col, x, y: base, box: [x - m.actualBoundingBoxLeft, base - m.actualBoundingBoxAscent, x + m.actualBoundingBoxRight, base + m.actualBoundingBoxDescent] });
        x += m.width + (k === 'i' && ch !== 'P' ? F * 0.03 : 0);
      }
      return { gl, w: x - x0 };
    };
    const meas = (p) => run(p, 0, 0).w;
    const P = Object.fromEntries(PARTS.map((p) => [p.id, p]));
    const gap = F * 0.32, num_w = meas(P.lik) + F * 0.14 + meas(P.prior), den_w = meas(P.ev), bar_w = Math.max(num_w, den_w) + F * 0.24;
    const post_w = meas(P.post); ctx.font = font('u'); const eq_w = ctx.measureText('=').width;
    const x_eq = post_w + gap, x_bar = x_eq + eq_w + gap, main_base = F * 0.27, num_base = -F * 0.36, den_base = F * 1.0;
    const place = (id, x, base) => { const r = run(P[id], x, base); parts[id] = { id, base: !!P[id].base, glyphs: r.gl }; G.push(...r.gl.map((g) => ({ ...g, part: id }))); };
    place('post', 0, main_base); place('eq', x_eq, main_base);
    place('lik', x_bar + (bar_w - num_w) / 2, num_base); place('prior', x_bar + (bar_w - num_w) / 2 + meas(P.lik) + F * 0.14, num_base);
    place('ev', x_bar + (bar_w - den_w) / 2, den_base);
    const th = Math.max(1.5, F * 0.042);
    parts.bar = { id: 'bar', base: true, glyphs: [], rule: [x_bar, -th / 2, x_bar + bar_w, th / 2] };
    const width = x_bar + bar_w;
    // centre the assembly on its own box
    let y0 = Infinity, y1 = -Infinity; for (const g of G) { y0 = Math.min(y0, g.box[1]); y1 = Math.max(y1, g.box[3]); }
    const cx = width / 2, cy = (y0 + y1) / 2;
    for (const g of G) { g.x -= cx; g.y -= cy; g.box = [g.box[0] - cx, g.box[1] - cy, g.box[2] - cx, g.box[3] - cy]; }
    parts.bar.rule = [parts.bar.rule[0] - cx, parts.bar.rule[1] - cy, parts.bar.rule[2] - cx, parts.bar.rule[3] - cy];
    for (const id in parts) parts[id].glyphs = G.filter((g) => g.part === id);
    // a card under each moving part: its glyphs' box, padded
    const px = F * 0.16, py = F * 0.14;
    for (const id in parts) {
      const p = parts[id]; if (p.base) continue;
      let a = Infinity, b = Infinity, c = -Infinity, d = -Infinity;
      for (const g of p.glyphs) { a = Math.min(a, g.box[0]); b = Math.min(b, g.box[1]); c = Math.max(c, g.box[2]); d = Math.max(d, g.box[3]); }
      p.card = [a - px, b - py, c + px, d + py];
    }
    return { G, parts, w: width, h: y1 - y0 };
  }

  // ---- the camera: c = 0 is straight above (reading), c = 1 the house view; heights z in px ----
  function cam(c) {
    const az = AZ * c, el = Math.PI / 2 - c * (Math.PI / 2 - EL), ca = Math.cos(az), sa = Math.sin(az), ce = c === 0 ? 0 : Math.cos(el), se = Math.sin(el);
    return { a: ca, b: sa * se, c: -sa, d: ca * se, hz: ce };
  }
  const proj = (K, o, p, z) => [o[0] + K.a * p[0] + K.c * p[1], o[1] + K.b * p[0] + K.d * p[1] - K.hz * z];
  const quad = (K, o, r, z) => [[r[0], r[1]], [r[2], r[1]], [r[2], r[3]], [r[0], r[3]]].map((p) => proj(K, o, p, z));
  const THICK = () => F * 0.07;

  // heights: from the lowest part on screen up, each part rises just far enough to clear every part already placed
  function heights(K) {
    const ids = Object.keys(L.parts).filter((id) => !L.parts[id].base), o = [0, 0];
    const placed = [];
    for (const id of ['eq', 'bar']) { const p = L.parts[id]; placed.push(id === 'bar' ? quad(K, o, p.rule, 0) : p.glyphs.map((g) => quad(K, o, g.box, 0)).flat()); }
    const sy = (id) => { const q = quad(K, o, L.parts[id].card, 0); return Math.max(...q.map((v) => v[1])); };
    ids.sort((a, b) => sy(b) - sy(a));
    let z = 0; const Z = {}, gap = F * (W < 560 ? 0.55 : 0.3);
    for (const id of ids) {
      z += F * (W < 560 ? 1.7 : 0.45);   // every part on its own layer
      const card = L.parts[id].card;
      for (;;) {
        const q = hull([...quad(K, o, card, z), ...quad(K, o, card, z - THICK())]);
        if (!placed.some((pq) => poly_x(grow(q, gap), hull(pq)))) { placed.push(q); break; }
        z += 2;
      }
      Z[id] = z;
    }
    return Z;
  }

  function label_size(id) {
    const [name, mean] = LABEL[lang][id];
    ctx.font = `600 15px ${SANS}`; const w1 = ctx.measureText(name).width;
    ctx.font = `400 14px ${SANS}`; const w2 = ctx.measureText(mean.replace(/[{}]/g, '')).width;
    return { w: Math.ceil(Math.max(w1, w2)), h: 40 };
  }

  function layout() {
    ({ W, H, dpr } = fit2d(canvas, ctx));
    const narrow = W < 560;
    F = narrow ? Math.min(34, W / 12.5) : Math.min(58, W / 15);
    L = typeset();
    const K1 = cam(1);
    L.Z = heights(K1);
    // where things sit on screen when exploded, relative to the assembly's centre
    const all = [];
    for (const id in L.parts) { const p = L.parts[id]; if (p.base) { if (p.rule) all.push(...quad(K1, [0, 0], p.rule, 0)); else for (const g of p.glyphs) all.push(...quad(K1, [0, 0], g.box, 0)); } else { all.push(...quad(K1, [0, 0], p.card, L.Z[id]), ...quad(K1, [0, 0], p.card, 0)); } }
    const bx0 = Math.min(...all.map((v) => v[0])), bx1 = Math.max(...all.map((v) => v[0])), by0 = Math.min(...all.map((v) => v[1])), by1 = Math.max(...all.map((v) => v[1]));
    // the reading position: the formula centred; the exploded tower centred too, leaving room for the labels
    L.o0 = [Math.round(W / 2), Math.round(H * (narrow ? 0.46 : 0.5))];
    const tower_cx = (bx0 + bx1) / 2, tower_cy = (by0 + by1) / 2;
    // the tower goes where every part can have its label: centred if it can, else slid sideways until all fit
    const need = Object.keys(L.parts).filter((id) => !L.parts[id].base).length, room = (W - (bx1 - bx0)) / 2 - 12;
    for (const dx of [0, -0.33, 0.33, -0.66, 0.66, -1, 1]) {
      L.o1 = [W / 2 - tower_cx + dx * Math.max(0, room), H * 0.5 - tower_cy];
      L.labels = place_labels(K1, narrow);
      if (Object.keys(L.labels).length === need) break;
    }
  }

  // the screen geometry at an explode amount e: glyph quads, card quads, anchors
  function scene(e) {
    const c = smooth(Math.min(1, e * 1.15)), lift = smooth(Math.max(0, Math.min(1, (e - 0.08) / 0.92)));
    const K = cam(c), o = [L.o0[0] + (L.o1[0] - L.o0[0]) * c, L.o0[1] + (L.o1[1] - L.o0[1]) * c];
    const out = { K, o, c, lift, parts: {} };
    for (const id in L.parts) {
      const p = L.parts[id], z = p.base ? 0 : L.Z[id] * lift;
      out.parts[id] = { z, card: p.card ? quad(K, o, p.card, z) : null, glyphs: p.glyphs.map((g) => quad(K, o, g.box, z)), rule: p.rule ? quad(K, o, p.rule, 0) : null };
    }
    return out;
  }

  // labels: candidate places all round the tower, kept off every card, glyph and each other; leaders straight, never
  // crossing. Depth-first over the parts, nearest places first.
  const LEADER_E = [0.8, 0.9, 1];   // the amounts at which leaders show; each must be clear at all of them
  function place_labels(K, narrow) {
    const SC = LEADER_E.map((e) => scene(e)), S = SC[SC.length - 1], ids = Object.keys(L.parts).filter((id) => !L.parts[id].base);
    const obst_of = (S) => {
      const o = [];
      for (const id in S.parts) { const q = S.parts[id]; if (q.card) o.push({ id, poly: hull([...q.card, ...q.card.map(([x, y]) => [x, y + THICK() * S.K.hz])]) }); for (const g of q.glyphs) o.push({ id, poly: g, glyph: true }); if (q.rule) o.push({ id, poly: q.rule }); if (L.parts[id].card) o.push({ id, socket: true, poly: grow(quad(S.K, S.o, L.parts[id].card, 0), 4) }); }
      return o;
    };
    const OB = SC.map(obst_of), obst = OB[OB.length - 1];
    const M = 14, cand = {}, hb = handle_box();
    for (const id of ids) {
      const { w, h } = label_size(id), card = S.parts[id].card, list = [];
      const cyc = card.reduce((s, v) => s + v[1], 0) / 4, cxc = card.reduce((s, v) => s + v[0], 0) / 4;
      for (let x = M; x + w <= W - M; x += 8) for (let y = M; y + h <= H - M; y += 6) {
        const box = rect_poly(x, y, w, h, 6);
        if (poly_x(box, hb) || OB.some((ob) => ob.some((o) => poly_x(box, o.poly)))) continue;
        // attach to the side of the label facing the part: the left or right end of its first line, or its top or bottom
        const side = x > cxc ? 'l' : x + w < cxc ? 'r' : y > cyc ? 't' : 'b';
        const at = side === 'l' ? [x - 4, y + 10] : side === 'r' ? [x + w + 4, y + 10] : side === 't' ? [x + Math.min(w / 2, 24), y - 4] : [x + Math.min(w / 2, 24), y + h + 2];
        const anchors = SC.map((s) => nearest_on(s.parts[id].card, at)), anchor = anchors[anchors.length - 1], len = Math.hypot(at[0] - anchor[0], at[1] - anchor[1]);
        if (len < 18 || len > (narrow ? 340 : 260)) continue;
        let clear = true;
        for (let k = 0; k < SC.length && clear; k++) {
          const a = anchors[k], a2 = [a[0] + (at[0] - a[0]) * 0.02, a[1] + (at[1] - a[1]) * 0.02];
          if (OB[k].some((o) => !o.socket && (o.id !== id || o.glyph) && seg_poly(a2, at, o.poly))) clear = false;
        }
        if (!clear) continue;
        // short leaders, level or gently sloped, read best
        const slope = Math.abs(at[1] - anchor[1]) / (Math.abs(at[0] - anchor[0]) + 1);
        list.push({ id, x, y, w, h, side, at, anchor, anchors, box: rect_poly(x, y, w, h, 8), cost: len + 40 * Math.min(slope, 3) + (side === 't' || side === 'b' ? 30 : 0) });
      }
      list.sort((a, b) => a.cost - b.cost);
      // keep variety: the best place in each small region of the stage, so the search can move a label far away
      const seen = new Set(); cand[id] = list.filter((c) => { const k = Math.floor(c.x / 36) + ',' + Math.floor(c.y / 28) + c.side; if (seen.has(k)) return false; seen.add(k); return true; }).slice(0, 260);
    }
    const order = ids.slice().sort((a, b) => cand[a].length - cand[b].length);
    let best = null, best_cost = Infinity, nodes = 0;
    const ok = (c, chosen) => chosen.every((d) => !poly_x(c.box, d.box) && c.anchors.every((a, k) => !seg_x(a, c.at, d.anchors[k], d.at) && !seg_poly(a, c.at, d.box) && !seg_poly(d.anchors[k], d.at, c.box)));
    (function dfs(i, chosen, cost) {
      if (cost >= best_cost || nodes++ > 60000) return;
      if (i === order.length) { best = chosen.slice(); best_cost = cost; return; }
      for (const c of cand[order[i]]) { if (cost + c.cost >= best_cost) break; if (ok(c, chosen)) { chosen.push(c); dfs(i + 1, chosen, cost + c.cost); chosen.pop(); } }
    })(0, [], 0);
    return Object.fromEntries((best || []).map((c) => [c.id, c]));
  }

  // ---- drawing ----
  function draw(e = E.x) {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = C.paper; ctx.fillRect(0, 0, W, H);
    const S = scene(e), K = S.K;
    const order = Object.keys(L.parts).filter((id) => !L.parts[id].base).sort((a, b) => L.Z[a] - L.Z[b]);
    // shadows on the paper, straight under each card: sharper when low, softer as it rises
    for (const id of order) {
      const z = S.parts[id].z; if (z < 0.5) continue;
      const q = quad(K, S.o, L.parts[id].card, 0), t = Math.min(1, z / (F * 2.5));
      ctx.save(); ctx.filter = `blur(${(1 + 7 * t).toFixed(1)}px)`; ctx.fillStyle = GR(0.04 + 0.05 * Math.min(1, z / (F * 0.6)) - 0.03 * t);
      poly(q); ctx.fill(); ctx.restore();
      // the socket it returns to: a hairline where the card sat
      ctx.strokeStyle = GR(0.22 * Math.min(1, z / (F * 0.5))); ctx.lineWidth = 0.75; ctx.setLineDash([3, 3]); poly(q); ctx.stroke(); ctx.setLineDash([]);
    }
    // the base: the equals sign and the bar stay on the paper
    glyphs_of('eq', S, 0); rule_of(S);
    for (const id of order) {
      const p = S.parts[id], show = Math.min(1, p.z / (F * 0.25));
      if (show > 0.001) {
        // the card: its edge, then its face
        const lo = p.card.map(([x, y]) => [x, y + THICK() * K.hz]);
        ctx.fillStyle = `rgba(226,222,214,${show})`; poly(hull([...p.card, ...lo])); ctx.fill();
        ctx.fillStyle = `rgba(255,255,255,${show})`; poly(p.card); ctx.fill();
        ctx.strokeStyle = GR(0.16 * show); ctx.lineWidth = 0.75; poly(hull([...p.card, ...lo])); ctx.stroke();
      }
      glyphs_of(id, S, p.z);
    }
    // leaders and labels, front-on, once the parts are apart
    const la = Math.max(0, Math.min(1, (e - 0.8) / 0.2));
    if (la > 0) for (const id in L.labels) {
      const lb = L.labels[id], anchor = leader_anchor(S, id);
      ctx.globalAlpha = la;
      ctx.strokeStyle = GR(0.62); ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(...anchor); ctx.lineTo(...lb.at); ctx.stroke();
      ctx.fillStyle = C.ink; ctx.beginPath(); ctx.arc(anchor[0], anchor[1], 2.6, 0, Math.PI * 2); ctx.fill();
      const [name, mean] = LABEL[lang][id];
      ctx.textBaseline = 'alphabetic'; ctx.textAlign = 'left';
      ctx.font = `600 15px ${SANS}`; ctx.fillStyle = C.ink; ctx.fillText(name, lb.x, lb.y + 15);
      rich(mean, lb.x, lb.y + 35);
      ctx.globalAlpha = 1;
    }
  }
  // the leader leaves the card at the point nearest its label, wherever the card is now
  function leader_anchor(S, id) { return nearest_on(S.parts[id].card, L.labels[id].at); }
  function rich(s, x, y) {
    ctx.font = `400 14px ${SANS}`;
    for (const piece of s.split(/(\{[AB]\})/)) {
      if (!piece) continue;
      const m = piece.match(/^\{([AB])\}$/);
      if (m) { ctx.font = `italic 600 15px ${SERIF}`; ctx.fillStyle = m[1] === 'A' ? C.cobalt : C.ochre; ctx.fillText(m[1], x, y); x += ctx.measureText(m[1]).width; ctx.font = `400 14px ${SANS}`; }
      else { ctx.fillStyle = C.ink2; ctx.fillText(piece, x, y); x += ctx.measureText(piece).width; }
    }
  }
  function glyphs_of(id, S, z) {
    const K = S.K;
    for (const g of L.parts[id].glyphs) {
      ctx.setTransform(dpr * K.a, dpr * K.b, dpr * K.c, dpr * K.d, dpr * (S.o[0]), dpr * (S.o[1] - K.hz * z));
      ctx.font = font(g.k); ctx.fillStyle = g.col ? C[g.col] : C.ink; ctx.textBaseline = 'alphabetic'; ctx.textAlign = 'left';
      ctx.fillText(g.ch, g.x, g.y);
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  function rule_of(S) { ctx.fillStyle = C.ink; poly(S.parts.bar.rule); ctx.fill(); }
  function poly(q) { ctx.beginPath(); ctx.moveTo(...q[0]); for (let i = 1; i < q.length; i++) ctx.lineTo(...q[i]); ctx.closePath(); }
  const smooth = (t) => t * t * (3 - 2 * t);

  // ---- input: pull up to take it apart, push down (or tap) to put it back ----
  let drag = null;
  stage.addEventListener('pointerdown', (e) => { drag = { y0: e.clientY, e0: E.target, moved: false, t: performance.now(), last: [[performance.now(), e.clientY]] }; stage.setPointerCapture(e.pointerId); });
  stage.addEventListener('pointermove', (e) => {
    if (!drag) return;
    if (Math.abs(e.clientY - drag.y0) > 5) drag.moved = true;
    if (!drag.moved) return;
    const v = Math.max(-0.08, Math.min(1.08, drag.e0 + (drag.y0 - e.clientY) / Math.min(260, H * 0.4)));
    E.to(v); drag.last.push([performance.now(), e.clientY]); if (drag.last.length > 5) drag.last.shift(); sched.wake();
  });
  stage.addEventListener('pointerup', () => {
    if (!drag) return;
    if (!drag.moved) E.to(E.target > 0.5 ? 0 : 1);
    else { const a = drag.last[0], b = drag.last[drag.last.length - 1], vy = b[0] > a[0] ? (a[1] - b[1]) / (b[0] - a[0]) : 0; E.to(E.target + vy * 0.35 > 0.5 ? 1 : 0); }
    drag = null; sched.wake(2000);
  });
  canvas.style.cursor = 'grab';
  // the handle: a glass bead on a short engraved rail, low = together, high = apart. The hand's place, nothing more.
  css('ex-css', `
.ex-h{position:absolute;width:44px;height:${RAIL + 44}px;cursor:grab;touch-action:none}
.ex-h .r{position:absolute;left:21.5px;top:22px;bottom:22px;width:1px;background:rgba(26,27,31,.2)}
.ex-h .t{position:absolute;left:16px;width:12px;height:1.5px;border-radius:1px;background:rgba(26,27,31,.38)}
.ex-h .b{position:absolute;left:7px;width:30px;height:30px;margin-top:-15px;border-radius:50%;
  background:radial-gradient(circle at 38% 30%,rgba(255,255,255,.98),rgba(255,255,255,.95) 45%,rgba(240,238,234,.97));
  box-shadow:0 0 0 .75px rgba(26,27,31,.16),0 6px 14px rgba(26,27,31,.14),0 1px 2px rgba(26,27,31,.12),inset 0 -2px 4px rgba(26,27,31,.06)}`);
  const handle = document.createElement('div'); handle.className = 'ex-h';
  handle.innerHTML = `<div class="r"></div><div class="t" style="top:22px"></div><div class="t" style="top:${RAIL + 21}px"></div><div class="b"></div>`;
  stage.append(handle); const bead = handle.querySelector('.b');
  function handle_box() { const x = W - (W < 560 ? 52 : 64), y = H / 2 - (RAIL + 44) / 2; handle.style.left = x + 'px'; handle.style.top = y + 'px'; return rect_poly(x, y, 44, RAIL + 44, 6); }

  const sched = scheduler((dt) => {
    let b = E.step(dt);
    if (!b && !drag) E.snap(E.target);   // at rest it is exactly where it belongs
    draw(); bead.style.top = (22 + RAIL * (1 - Math.max(0, Math.min(1, E.x)))) + 'px'; return b || !!drag;
  });
  layout(); draw(); bead.style.top = (22 + RAIL) + "px";

  // the transform a glyph is drawn with, applied to its origin
  function glyph_at(g, e) { const S = scene(e), z = L.parts[g.part].base ? 0 : L.Z[g.part] * S.lift; return proj(S.K, S.o, [g.x, g.y], z); }
  function settle(target) { E.to(target); for (let i = 0; i < 2000 && E.busy(); i++) E.step(1 / 60); E.snap(target); }

  return {
    visible: (v) => sched.set_visible(v), resize: () => { layout(); draw(); },
    demo() { E.to(1); sched.wake(2500); },
    at(e) { E.snap(e); draw(); bead.style.top = (22 + RAIL * (1 - e)) + "px"; },
    async accept() {
      // 1. reassembly: take it apart and put it back through the same spring the hand drives; every glyph must land
      //    on its typeset place, and the frame must be the frame before, pixel for pixel
      settle(0); draw(); const before = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
      const typeset_at = L.G.map((g) => [L.o0[0] + g.x, L.o0[1] + g.y]);
      settle(1); draw(1); settle(0); draw();
      const after = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
      let err = 0; L.G.forEach((g, i) => { const p = glyph_at(g, E.x); err = Math.max(err, Math.abs(p[0] - typeset_at[i][0]), Math.abs(p[1] - typeset_at[i][1])); });
      let px = 0; for (let i = 0; i < before.length; i++) px = Math.max(px, Math.abs(before[i] - after[i]));
      // 2. leaders: at every amount where they show, none crosses another, and none crosses a glyph or the bar
      let crossings = 0, n = 0;
      for (const e of [0.8, 0.825, 0.85, 0.875, 0.9, 0.925, 0.95, 0.975, 1]) {
        const S = scene(e), segs = Object.keys(L.labels).map((id) => ({ id, a: leader_anchor(S, id), b: L.labels[id].at }));
        n = segs.length;
        for (let i = 0; i < segs.length; i++) for (let j = i + 1; j < segs.length; j++) if (seg_x(segs[i].a, segs[i].b, segs[j].a, segs[j].b)) crossings++;
        for (const s of segs) {
          const a = [s.a[0] + (s.b[0] - s.a[0]) * 0.02, s.a[1] + (s.b[1] - s.a[1]) * 0.02];
          for (const id in S.parts) { for (const g of S.parts[id].glyphs) if (seg_poly(a, s.b, g)) crossings++; if (S.parts[id].rule && seg_poly(a, s.b, S.parts[id].rule)) crossings++; }
        }
      }
      const all = Object.keys(L.labels).length === Object.keys(L.parts).filter((id) => !L.parts[id].base).length;
      sched.wake();
      return { pass: err === 0 && px === 0 && crossings === 0 && all, value: zh ? `合上后字形误差 ${err} px，像素差 ${px}；${n} 条引线，交叉 ${crossings}` : `reassembled glyph error ${err} px, pixel difference ${px}; ${n} leaders, ${crossings} crossings` };
    },
  };
}
