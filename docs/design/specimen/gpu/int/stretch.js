// I2 · Stretch text. A term with a dotted underline holds its definition folded inside the sentence. Tap it and the
// sentence opens right after the term: everything that follows drops straight down by whole lines, keeping its x, and
// the definition is set in the room that opens, on a faint ground of its own. A definition has terms of its own,
// which open the same way, one ground deeper. Tap a term again, or the definition itself, and it folds back.
// The invariant that makes it calm: no word ever moves sideways. Your eye can always find the place it left, and
// folding everything back gives the original page exactly.
import { scheduler, Spring, css, SERIF, SANS, roundrect } from '../lib/ui.js';
import { tokens, no_start, no_end } from '../lib/text.js';

export const meta = {
  id: 'stretch',
  name: { zh: '在句子里展开的定义', en: 'Definitions that unfold in the sentence' },
  means: { zh: '点一个带点线的词，它的定义就在原处展开：后面的字整行往下让出位置，从不横着挪；定义里的词还能再展开，再点一下就收回。', en: 'Tap a dotted term and its definition opens where it stands: what follows steps down by whole lines and never sideways; terms inside a definition open too, and a second tap folds it back.' },
  test: { zh: '全部收回后每个字的位置与原来完全一致；动画的每一帧没有两个字重叠；原文的字从不横移', en: 'Folding everything back restores every word to its exact place; no two words overlap in any frame; no word of the text ever moves sideways' },
};

// a flow is a list of runs: a string, a noun [text, pigment], or a term { k, t, def: flow }
const TEXT = {
  zh: {
    title: '向前看几秒',
    paras: [
      ['模型预测控制每一步都向前看几秒：用', { k: 'model', t: '模型', def: ['一组方程：给它此刻的', { k: 'state', t: '状态', def: ['描述系统此刻所需的最少几个数，比如', ['小车', 'cobalt'], '的位置和速度'] }, '和一个动作，它算出下一刻会怎样'] },
        '预测接下来会发生什么，在', { k: 'cons', t: '约束', def: ['动作和状态都不许越过的界线，比如电机的最大推力，或者那堵', ['墙', 'ochre']] },
        '之内找出让', { k: 'cost', t: '代价', def: ['给一串动作打的分：离目标越远、用力越猛，分越高'] }, '最小的一串动作，只执行第一个，然后重来。'],
      ['这种只走一步就重新规划的做法，叫作', { k: 'rh', t: '滚动时域', def: ['预测的窗口跟着时间一起往前推，就像开车时，你总是看着前方同样远的一段路'] }, '。模型没算到的扰动，下一步就会被看见、被纠正。'],
    ],
  },
  en: {
    title: 'Looking a few seconds ahead',
    paras: [
      ['Model predictive control looks a few seconds ahead at every step. It uses a ', { k: 'model', t: 'model', def: ['a set of equations: give it the ', { k: 'state', t: 'state', def: ['the fewest numbers that describe the system right now, such as the ', ['cart', 'cobalt'], '’s position and speed'] }, ' now and an action, and it computes what comes next'] },
        ' to predict what happens next, finds the actions of lowest ', { k: 'cost', t: 'cost', def: ['a score for a plan: higher the farther it ends from the goal and the harder it pushes'] },
        ' that stay within the ', { k: 'cons', t: 'constraints', def: ['limits that actions and states may never cross, such as the motor’s maximum force, or the ', ['wall', 'ochre']] }, ', applies only the first, and starts again.'],
      ['Planning again after every single step is called a ', { k: 'rh', t: 'receding horizon', def: ['the window of prediction moves forward with time, the way a driver always looks the same distance down the road'] }, '. A disturbance the model did not foresee is seen, and corrected, one step later.'],
    ],
  },
};

const CSS = `
.st-wrap{position:absolute;inset:0;background:var(--paper);overflow:hidden;user-select:none;-webkit-user-select:none;touch-action:manipulation}
.st-col{position:absolute;top:0}
.st-title{position:absolute;left:0;top:0;font-family:${SANS};font-weight:600;color:var(--ink);letter-spacing:-.005em;white-space:nowrap}
.st-tok{position:absolute;left:0;top:0;white-space:pre;font-family:${SERIF};color:var(--ink);will-change:transform,opacity}
.st-tok.d{color:var(--ink-2)}
.st-tok.cobalt{color:var(--cobalt);font-weight:600}.st-tok.ochre{color:var(--ochre);font-weight:600}
.st-tok.term{cursor:pointer}
.st-tok.term::before{content:'';position:absolute;left:0;right:0;top:-6px;bottom:-6px}
.st-tok.term::after{content:'';position:absolute;left:.5px;right:.5px;top:calc(50% + .66em);height:3px;background-image:radial-gradient(circle,rgba(68,70,77,.85) .95px,transparent 1.25px);background-size:5px 3px;background-repeat:repeat-x;background-position:0 0;transition:opacity .2s}
.st-tok.term.open::after{background-image:none;background:var(--ink-2);height:1.25px;border-radius:1px;top:calc(50% + .66em + .9px)}
.st-measure{position:absolute;visibility:hidden;left:0;top:0;white-space:pre;font-family:${SERIF}}
`;

export function make({ stage, canvas, hud, lang }) {
  css('st-css', CSS);
  const zh = lang === 'zh', T = TEXT[lang], ctx = canvas.getContext('2d');
  const wrap = document.createElement('div'); wrap.className = 'st-wrap';
  const col = document.createElement('div'); col.className = 'st-col';
  const title = document.createElement('div'); title.className = 'st-title'; title.textContent = T.title;
  const measure = document.createElement('span'); measure.className = 'st-measure';
  col.append(title); wrap.append(canvas, col, measure); stage.append(wrap);
  canvas.style.position = 'absolute'; canvas.style.inset = '0'; canvas.style.width = '100%'; canvas.style.height = '100%';

  // build the flows: every token is one span; terms carry their definition as a nested flow
  const all = [], terms = {};
  function build(spec, depth, para, owner) {
    const flow = { toks: [], depth, owner };
    for (const run of spec) {
      if (typeof run === 'string' || Array.isArray(run)) {
        const [text, pig] = typeof run === 'string' ? [run, 0] : run;
        for (const k of tokens(text)) flow.toks.push(tok(k.t, k.sp, depth, para, flow, pig));
      } else {
        const t = tok(run.t, false, depth, para, flow, 0);
        t.term = { key: run.k, open: false, tok: t, stamp: 0 }; terms[run.k] = t.term;
        t.el.classList.add('term');
        t.term.def = build(run.def, depth + 1, para, t.term);
        flow.toks.push(t);
      }
    }
    // a space after a run that ends in a space (English): note it on the token before the next run
    return flow;
  }
  function tok(t, sp, depth, para, flow, pig) {
    const el = document.createElement('span'); el.className = 'st-tok' + (depth ? ' d' : '') + (pig ? ' ' + pig : ''); el.textContent = t;
    col.append(el);
    const k = { t, sp, depth, para, flow, el, w: 0, x: 0, line: 0, vis: depth === 0, y: new Spring(0, 0.42, 1), fade: new Spring(depth === 0 ? 1 : 0, 0.24, 1), op: depth === 0 ? 1 : 0 };
    all.push(k); return k;
  }
  // English runs carry their spaces at the run boundary: 'uses a ' then a term. tokens() drops trailing spaces of a run,
  // so mark them here from the source strings.
  const paras = T.paras.map((spec, p) => {
    const f = build(spec, 0, p, null);
    return f;
  });
  if (!zh) mark_spaces();
  function mark_spaces() {
    // walk the specs alongside the flows: a string run that ends with a space gives its last token sp; one that starts
    // with a space gives the token before it sp
    const walk = (spec, flow) => {
      let i = 0;
      for (const run of spec) {
        if (typeof run === 'string' || Array.isArray(run)) {
          const text = typeof run === 'string' ? run : run[0], n = tokens(text).length;
          if (/^\s/.test(text) && i > 0) flow.toks[i - 1].sp = true;
          i += n;
          if (/\s$/.test(text) && i > 0) flow.toks[i - 1].sp = true;
        } else { walk(run.def, flow.toks[i].term.def); i += 1; }
      }
    };
    T.paras.forEach((spec, p) => walk(spec, paras[p]));
  }

  let W = 600, fs = 20, lh = 37, pgap = 18, spw = 5, gap = 6, top = 0, colx = 0;
  function measure_all() {
    measure.style.fontSize = fs + 'px';
    for (const k of all) {
      measure.style.fontWeight = k.el.classList.contains('cobalt') || k.el.classList.contains('ochre') ? '600' : '400';
      measure.textContent = k.t; k.w = measure.getBoundingClientRect().width;
    }
    measure.style.fontWeight = '400'; measure.textContent = 'a b'; const ab = measure.getBoundingClientRect().width; measure.textContent = 'ab'; spw = ab - measure.getBoundingClientRect().width;
    gap = zh ? fs * 0.3 : spw;
  }

  // greedy line breaking of one flow from (x0, line0), ignoring its open definitions; punctuation keeps to its word
  function greedy(flow, x0, line0) {
    const n = flow.toks.length, X = new Array(n), L = new Array(n);
    let x = x0, line = line0, i = 0;
    while (i < n) {
      let j = i; while (j + 1 < n && (no_start(flow.toks[j + 1].t) || no_end(flow.toks[j].t))) j++;
      let gw = 0; for (let q = i; q <= j; q++) gw += flow.toks[q].w + (q < j && flow.toks[q].sp ? spw : 0);
      if (x + gw > W + 0.01 && x > 0) { line++; x = 0; }
      for (let q = i; q <= j; q++) { X[q] = x; L[q] = line; x += flow.toks[q].w + (flow.toks[q].sp ? spw : 0); }
      i = j + 1;
    }
    return { X, L };
  }
  // the layout: an open term's definition starts right after it; everything after the term keeps its x and drops by
  // whole lines until it clears the definition's end
  function lay(flow, x0, line0) {
    const { X, L } = greedy(flow, x0, line0), n = flow.toks.length;
    let s = 0, end = null;
    for (let i = 0; i < n; i++) {
      const k = flow.toks[i]; k.x = X[i]; k.line = L[i] + s; k.vis = true; end = null;
      if (k.term && k.term.open) {
        const r = lay(k.term.def, k.x + k.w + gap, k.line);
        k.term.end = r;
        if (i + 1 < n) {
          const ln = L[i + 1] + s, need = X[i + 1] >= r.xe + gap - 0.01 ? r.le : r.le + 1;
          if (need > ln) s += need - ln;
        } else end = r;
      }
    }
    const last = flow.toks[n - 1];
    return end || { xe: last.x + last.w, le: last.line };
  }
  function layout() {
    for (const k of all) if (k.depth) k.vis = false;
    let line = 0;
    paras.forEach((f) => { const r = lay(f, 0, line); line = r.le + 1; });
    for (const k of all) {
      const y = k.line * lh + k.para * pgap;
      if (k.vis && k.fade.x <= 0.001) k.y.snap(y); else if (k.vis) k.y.to(y);
      if (k.vis) k.fade.to(1); else k.fade.to(0);
    }
  }

  function fit() {
    const r = stage.getBoundingClientRect(), narrow = r.width < 560;
    fs = narrow ? 18 : 20; lh = Math.round(fs * 1.85); pgap = Math.round(lh * 0.5);
    W = Math.min(narrow ? r.width - 36 : 600, r.width - 36);
    colx = Math.round((r.width - W) / 2);
    top = Math.round(narrow ? r.height * 0.1 : Math.max(48, r.height * 0.12));
    title.style.fontSize = (narrow ? 22 : 26) + 'px';
    col.style.left = colx + 'px'; col.style.top = top + 'px'; col.style.width = W + 'px';
    for (const k of all) { k.el.style.fontSize = fs + 'px'; k.el.style.lineHeight = lh + 'px'; k.el.style.height = lh + 'px'; }
    measure.style.lineHeight = lh + 'px';
    measure_all();
    for (const k of all) { k.y.snap(k.y.target); }
    layout();
    for (const k of all) if (k.vis) k.y.snap(k.y.target);
    const c = canvas.getBoundingClientRect(), dpr = Math.min(2, devicePixelRatio || 1);
    canvas.width = Math.round(c.width * dpr); canvas.height = Math.round(c.height * dpr); ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  const head = () => Math.round(fs * 2.9);   // the title's room above the text

  // a word that is appearing (or leaving) is drawn only where no settled word is near it: a slot opens before it fills
  const sm = (a, b, t) => { const u = Math.max(0, Math.min(1, (t - a) / (b - a))); return u * u * (3 - 2 * u); };
  // who yields to whom: the text yields to nothing; a definition yields to everything opened before it; a closing
  // definition yields to everything still open
  let stamp = 0;
  const rank = (k) => k.depth === 0 ? -1 : (k.vis ? 0 : 1e6) + k.flow.owner.stamp;
  function clearance(k, rk, order) {
    let c = 9;
    for (const j of order) {
      if (j.rk >= rk) break;
      if (j.op <= 0.002) continue;
      if (j.x + j.w <= k.x + 0.5 || k.x + k.w <= j.x + 0.5) continue;
      c = Math.min(c, Math.abs(j.y.x - k.y.x) / lh);
    }
    return sm(0.66, 0.97, c);
  }
  function step(dt) {
    let busy = false;
    for (const k of all) { busy = k.y.step(dt) || busy; busy = k.fade.step(dt) || busy; k.rk = rank(k); }
    const order = all.slice().sort((a, b) => a.rk - b.rk);
    for (const k of order) {
      if (k.depth === 0) { k.op = 1; continue; }
      const prev = k.op;
      k.op = Math.min(Math.max(0, k.fade.x), clearance(k, k.rk, order));
      if (Math.abs(k.op - prev) > 1e-4) busy = true;
    }
    return busy;
  }
  function render() {
    const h0 = head();
    for (const k of all) {
      k.el.style.transform = `translate(${k.x}px, ${(h0 + k.y.x).toFixed(2)}px)`;
      k.el.style.opacity = k.op.toFixed(3);
      k.el.style.visibility = k.op < 0.002 ? 'hidden' : 'visible';
      k.el.style.pointerEvents = k.op > 0.5 ? 'auto' : 'none';
      if (k.term) k.el.classList.toggle('open', k.term.open);
    }
    draw_grounds(h0);
  }
  // each open definition sits on a faint ground, one shade deeper per level; a dotted leader carries the eye from a
  // definition's end to where the sentence resumes, when there is a gap between them
  function draw_grounds(h0) {
    const cw = canvas.width / Math.min(2, devicePixelRatio || 1), ch = canvas.height / Math.min(2, devicePixelRatio || 1);
    ctx.clearRect(0, 0, cw, ch);
    const defs = Object.values(terms).map((t) => t.def).sort((a, b) => a.depth - b.depth);
    for (const d of defs) {
      const rows = new Map();
      const add = (k) => { const key = Math.round(k.y.x / lh * 4); const r = rows.get(key) || { y: k.y.x, x0: 1e9, x1: -1e9, a: 0 }; r.x0 = Math.min(r.x0, k.x); r.x1 = Math.max(r.x1, k.x + k.w); r.a = Math.max(r.a, k.op); rows.set(key, r); };
      const walk = (f) => { for (const k of f.toks) { if (k.op > 0.002) add(k); if (k.term) walk(k.term.def); } };
      walk(d);
      const pad = 4, a0 = d.depth === 1 ? 0.05 : 0.085;
      for (const r of rows.values()) {
        if (r.a <= 0.002) continue;
        ctx.fillStyle = `rgba(26,27,31,${(a0 * r.a).toFixed(4)})`;
        const y = top + h0 + r.y + lh * 0.14, h = lh * 0.72;
        roundrect(ctx, colx + r.x0 - pad, y, r.x1 - r.x0 + pad * 2, h, 5); ctx.fill();
      }
      // the leader: from the definition's end to the next word of the sentence, on the same line
      const t = d.owner; if (!t.open || !t.end) continue;
      const nx = next_after(t.tok);
      if (nx && nx.op > 0.5) {
        const last = last_tok(d);
        if (last && last.op > 0.5) {
          // on the same line: from the definition's end; on the next line: from the margin
          const same = Math.abs(nx.y.x - last.y.x) < 1, below = Math.abs(nx.y.x - last.y.x - lh) < 1;
          const xa = same ? last.x + last.w + pad + 6 : 2, a = Math.min(last.op, nx.op);
          if ((same || below) && nx.x - xa > fs * 1.2) {
            ctx.fillStyle = `rgba(98,102,109,${(0.8 * a).toFixed(3)})`;
            const y = top + h0 + nx.y.x + lh * 0.56;
            for (let x = xa; x < nx.x - 6; x += 5) { ctx.beginPath(); ctx.arc(colx + x, y, 0.95, 0, Math.PI * 2); ctx.fill(); }
          }
        }
      }
    }
  }
  const last_tok = (f) => { const k = f.toks[f.toks.length - 1]; return k.term && k.term.open ? last_tok(k.term.def) : k; };
  // the first token after a term in reading order, climbing out of definitions that end with it
  function next_after(k) {
    let f = k.flow, i = f.toks.indexOf(k);
    while (f) { if (i + 1 < f.toks.length) return f.toks[i + 1]; const o = f.owner; if (!o) return null; f = o.tok.flow; i = f.toks.indexOf(o.tok); }
    return null;
  }

  function close(term) { term.open = false; for (const k of term.def.toks) if (k.term) close(k.term); }
  function toggle(key, v) {
    const t = terms[key]; if (!t) return;
    const open = v === undefined ? !t.open : v;
    if (open) { if (!t.open) t.stamp = ++stamp; t.open = true; } else close(t);
    layout(); sched.wake();
  }
  for (const t of Object.values(terms)) t.tok.el.addEventListener('click', (e) => { e.stopPropagation(); toggle(t.key); });
  // tapping a definition's own words folds it
  for (const k of all) if (k.depth && !k.term) k.el.addEventListener('click', (e) => { e.stopPropagation(); const o = k.flow.owner; if (o && o.open) toggle(o.key, false); });

  const sched = scheduler((dt) => { const b = step(dt); render(); return b; });
  fit(); render();

  // the boxes of all text words as drawn (CSS px, in the column), from the model
  const boxes = () => all.filter((k) => k.op > 0.02).map((k) => ({ k, x0: k.x, x1: k.x + k.w, y0: k.y.x + (lh - fs * 1.2) / 2, y1: k.y.x + (lh + fs * 1.2) / 2 }));
  function overlaps() {
    const b = boxes().sort((p, q) => p.y0 - q.y0); let n = 0;
    for (let i = 0; i < b.length; i++) for (let j = i + 1; j < b.length && b[j].y0 < b[i].y1 - 0.5; j++)
      if (Math.min(b[i].x1, b[j].x1) - Math.max(b[i].x0, b[j].x0) > 0.5 && Math.min(b[i].y1, b[j].y1) - Math.max(b[i].y0, b[j].y0) > 0.5) n++;
    return n;
  }
  const rects = () => all.filter((k) => k.depth === 0).map((k) => { const r = k.el.getBoundingClientRect(); return [r.left, r.top, r.width, r.height]; });

  return {
    visible: (v) => sched.set_visible(v),
    resize: () => { fit(); render(); },
    demo() {
      toggle('model', true);
      setTimeout(() => toggle('state', true), 900);
      setTimeout(() => toggle('cons', true), 1800);
    },
    open(keys) { for (const k of Object.keys(terms)) terms[k].open = false; for (const k of keys) { terms[k].stamp = ++stamp; terms[k].open = true; } layout(); sched.wake(); },
    toggle,
    async accept() {
      for (const t of Object.values(terms)) t.open = false;
      layout(); for (let i = 0; i < 200 && step(1 / 60); i++); render();
      const before = rects(), x0 = all.filter((k) => !k.depth).map((k) => k.x);
      // a script with interruptions: open, open nested, open another, close a parent mid-motion, reopen, close all
      const script = [[0, 'model', true], [12, 'state', true], [20, 'cons', true], [34, 'cost', true], [44, 'model', false], [52, 'rh', true], [60, 'model', true], [70, 'state', true], [120, 'cost', false], [128, 'cons', false]];
      let frames = 0, worst = 0, sideways = 0;
      for (let f = 0; f < 420; f++) {
        for (const [at, key, v] of script) if (at === f) { const t = terms[key]; if (v) { if (!t.open) t.stamp = ++stamp; t.open = true; } else close(t); layout(); }
        if (f === 200) { for (const t of Object.values(terms)) close(t); layout(); }
        step(1 / 60); frames++;
        worst = Math.max(worst, overlaps());
        all.forEach((k, i) => { if (!k.depth && Math.abs(k.x - x0[all.filter((q) => !q.depth).indexOf(k)]) > 1e-9) sideways++; });
      }
      for (let i = 0; i < 300 && step(1 / 60); i++);
      render();
      const after = rects();
      let dmax = 0; before.forEach((r, i) => { for (let q = 0; q < 4; q++) dmax = Math.max(dmax, Math.abs(r[q] - after[i][q])); });
      const pass = dmax < 0.01 && worst === 0 && sideways === 0;
      return { pass, value: zh ? `收回后最大偏移 ${dmax.toFixed(2)} px；${frames} 帧中重叠 ${worst} 处；横移 ${sideways} 次` : `after folding back, max shift ${dmax.toFixed(2)} px; overlaps in ${frames} frames: ${worst}; sideways moves: ${sideways}` };
    },
  };
}
