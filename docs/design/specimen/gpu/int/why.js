// I2 · A chain of why. Every claim carries a hollow ring in its margin with a short thread hanging from it: something
// is folded there. Tap the ring and the reason drops out of it on that thread, one step in, and the ring fills (asked).
// The reason has its own ring, so you can keep asking until you reach bedrock: a reason that rests on a definition or
// an assumption ends in a ground mark instead of a ring. The depth of the chain is drawn by the thread itself, one
// step in per why. Tap a filled ring and everything hanging from it is drawn back up into it.
import { scheduler, Spring, css, SERIF, SANS } from '../lib/ui.js';

export const meta = {
  id: 'why',
  name: { zh: '一串为什么', en: 'A chain of why' },
  means: { zh: '每个论断旁有个空心的环：点它，理由顺着线垂下来；理由还能再问为什么，一直问到定义或假设为止，链有多深一眼可见。', en: 'Each claim has a hollow ring: tap it and the reason drops on a thread; the reason can be asked why in turn, down to a definition or an assumption, and the depth of the chain is drawn.' },
  test: { zh: '每条线的两端恰好连着父环和子环；画出的深度等于数出的链长；收起一个理由，挂在它下面的全部收起', en: 'Each thread ends exactly on its parent\'s ring and its child\'s ring; the drawn depth equals the counted chain; folding a reason folds everything hanging from it' },
};

// claims and their chains; the last reason of a chain is bedrock: [text, kind]
const TEXT = {
  zh: {
    ground: { def: '定义', assume: '假设' }, depth: '深度',
    claims: [
      ['MPC 每一步只执行计划里的第一个动作。', '因为计划里越往后的动作，依据的预测越不准。', '因为每一步预测的小误差，都会被带进下一步，越积越大。', ['因为下一刻的状态，是由这一刻的状态算出来的。', 'def']],
      ['抛两枚硬币，一正一反的概率是 ½，不是 ⅓。', '因为“一正一反”包含两种结果：正反，和反正。', '因为两枚硬币是两个东西，看起来一样，也各自落下。', ['正正、正反、反正、反反，四种结果一样可能。', 'assume']],
    ],
  },
  en: {
    ground: { def: 'definition', assume: 'assumption' }, depth: 'depth',
    claims: [
      ['MPC applies only the first action of every plan.', 'Because the later an action comes in the plan, the less accurate the prediction it rests on.', 'Because each step’s small error is carried into the next step, and grows.', ['Because the next state is computed from the current one.', 'def']],
      ['Toss two coins: one head and one tail has probability ½, not ⅓.', 'Because “one of each” covers two outcomes: head–tail and tail–head.', 'Because the coins are two separate things: even when they look alike, each lands on its own.', ['HH, HT, TH and TT are equally likely.', 'assume']],
    ],
  },
};

const CSS = `
.wy-wrap{position:absolute;inset:0;background:var(--paper);overflow:hidden;user-select:none;-webkit-user-select:none;touch-action:manipulation}
.wy-svg{position:absolute;inset:0;width:100%;height:100%;pointer-events:none;overflow:visible}
.wy-node{position:absolute;left:0;top:0;font-family:${SERIF};color:var(--ink);will-change:transform,opacity}
.wy-node.r{color:var(--ink-2)}
.wy-node .g{font-family:${SANS};font-size:12.5px;color:var(--ink-2);letter-spacing:.02em;margin-left:.6em;white-space:nowrap}
.wy-ring{position:absolute;left:0;top:0;width:44px;height:44px;margin:-22px 0 0 -22px;border:0;padding:0;background:none;cursor:pointer;-webkit-tap-highlight-color:transparent}
.wy-ring:focus-visible{outline:2px solid var(--ink-2);outline-offset:-8px;border-radius:50%}
`;

export function make({ stage, canvas, hud, lang }) {
  canvas.style.display = 'none';
  css('wy-css', CSS);
  const zh = lang === 'zh', T = TEXT[lang], NS = 'http://www.w3.org/2000/svg';
  const wrap = document.createElement('div'); wrap.className = 'wy-wrap';
  const svg = document.createElementNS(NS, 'svg'); svg.setAttribute('class', 'wy-svg');
  wrap.append(svg); stage.append(wrap); hud.style.zIndex = '3';

  // the nodes: a claim at depth 0, each reason one deeper; a ground node has no ring
  const nodes = [], roots = [];
  T.claims.forEach((chain, ci) => {
    let parent = null;
    chain.forEach((item, d) => {
      const [text, ground] = Array.isArray(item) ? item : [item, null];
      const el = document.createElement('div'); el.className = 'wy-node' + (d ? ' r' : '');
      el.innerHTML = `<span class="t"></span>${ground ? `<span class="g">${T.ground[ground]}</span>` : ''}`;
      el.querySelector('.t').textContent = text;
      wrap.append(el);
      const n = { id: `${ci}.${d}`, depth: d, parent, child: null, ground, el, open: false, y: new Spring(0, 0.5, 0.74), op: new Spring(d ? 0 : 1, 0.3, 1), h: 0, shown: d === 0 };
      if (!ground) {
        n.ring = document.createElement('button'); n.ring.className = 'wy-ring'; n.ring.setAttribute('aria-label', zh ? '为什么' : 'why');
        n.ring.addEventListener('click', (e) => { e.stopPropagation(); toggle(n); });
        wrap.append(n.ring);
      }
      // the drawn parts: the thread from the parent's ring, the ring (or ground mark), the stub of thread under a closed ring
      n.thread = document.createElementNS(NS, 'path'); n.thread.setAttribute('fill', 'none'); n.thread.setAttribute('stroke', '#44464d'); n.thread.setAttribute('stroke-width', '1.25'); n.thread.setAttribute('stroke-linecap', 'round');
      n.mark = document.createElementNS(NS, ground ? 'path' : 'circle');
      if (ground) { n.mark.setAttribute('fill', 'none'); n.mark.setAttribute('stroke', '#1a1b1f'); n.mark.setAttribute('stroke-width', '1.5'); n.mark.setAttribute('stroke-linecap', 'round'); }
      else { n.mark.setAttribute('r', '5.5'); n.mark.setAttribute('stroke', '#1a1b1f'); n.mark.setAttribute('stroke-width', '1.5'); }
      n.stub = document.createElementNS(NS, 'path'); n.stub.setAttribute('fill', 'none'); n.stub.setAttribute('stroke', '#44464d'); n.stub.setAttribute('stroke-width', '1.25'); n.stub.setAttribute('stroke-linecap', 'round');
      svg.append(n.thread, n.stub, n.mark);
      if (parent) parent.child = n; else roots.push(n);
      nodes.push(n); parent = n;
    });
  });

  let W = 0, H = 0, colx = 0, colw = 600, D = 24, gut = 30, fs = 19, top = 60, ringdy = 0;
  function fit() {
    W = wrap.clientWidth; H = wrap.clientHeight;
    const narrow = W < 560;
    fs = narrow ? 17 : 19; D = narrow ? 18 : 26; gut = narrow ? 26 : 34;
    colw = Math.min(narrow ? W - 28 : 620, W - 28); colx = Math.round((W - colw) / 2);
    for (const n of nodes) {
      const lw = colw - gut - n.depth * D;
      n.el.style.width = lw + 'px'; n.el.style.fontSize = (n.depth ? fs - 1 : fs) + 'px'; n.el.style.lineHeight = n.depth ? '1.65' : '1.6';
      n.el.style.fontWeight = n.depth ? '400' : '500';
      n.h = n.el.getBoundingClientRect().height;
    }
    ringdy = fs * 0.82;   // the ring sits on the first line's middle
    // the column is placed so that every chain, fully asked, still sits in the middle of the page
    let full = 0; roots.forEach((r, i) => { let n = r; full += (i ? 34 : 0) + n.h; while (n.child) { n = n.child; full += 12 + n.h; } });
    top = Math.max(narrow ? 40 : 48, Math.round((H - full) / 2));
    layout(true);
  }
  // the ring's centre for a node at a given top
  const rx = (n) => colx + gut / 2 - 2 + n.depth * D, ry = (n, y = n.y.x) => top + y + ringdy;
  const tx = (n) => colx + gut + n.depth * D;

  // order: each claim, then the chain hanging from it while open; a hidden node waits inside its parent's ring
  function visible_list() { const out = []; for (const r of roots) { let n = r; out.push(n); while (n.open && n.child) { n = n.child; out.push(n); } } return out; }
  function layout(snap) {
    const vis = visible_list(); let y = 0;
    for (const n of nodes) n.shown = vis.includes(n);
    vis.forEach((n, i) => {
      if (i && !n.depth) y += 34;
      if (n.depth) y += 12;
      const was = n.op.target;
      if (snap) n.y.snap(y); else if (was === 0 && n.op.x < 0.02) n.y.snap(n.parent.y.x).to(y); else n.y.to(y);
      n.op.set(0.3, 1).to(1); y += n.h;
    });
    for (const n of nodes) if (!n.shown) { const anc = shown_ancestor(n); n.y.to(anc.y.target); n.op.set(0.14, 1).to(0); if (snap) { n.y.snap(anc.y.target); n.op.snap(0); } }
  }
  const shown_ancestor = (n) => { let p = n.parent; while (p && !p.shown) p = p.parent; return p || n; };
  function close(n) { n.open = false; if (n.child) close(n.child); }
  function toggle(n, v) {
    const open = v === undefined ? !n.open : v;
    if (open) n.open = true; else close(n);
    layout(false); sched.wake();
  }
  // a thread from the bottom of the parent's ring to the top of the child's: vertical at both ends, a soft S between
  const R = 5.5;
  function thread_ends(n) { const p = n.parent; return [rx(p), ry(p, p.y.x) + R, rx(n), ry(n) - (n.ground ? 3 : R)]; }
  function render() {
    let deepest = 0, grounded = false;
    for (const n of nodes) {
      // a reason is seen only once it has dropped clear of the one it hangs from, and leaves fast when drawn back
      const anc = n.depth ? (n.shown ? n.parent : shown_ancestor(n)) : null;
      const sep = anc ? Math.max(0, Math.min(1, (n.y.x - anc.y.x - Math.min(anc.h, fs * 1.6) * 0.55) / 22)) : 1;
      const o = Math.min(n.op.x, sep), y = n.y.x, show = o > 0.003;
      n.el.style.transform = `translate(${tx(n)}px, ${(top + y).toFixed(2)}px)`;
      n.el.style.opacity = Math.max(0, Math.min(1, o)).toFixed(3); n.el.style.visibility = show ? 'visible' : 'hidden';
      const cx = rx(n), cy = ry(n);
      if (n.ring) { n.ring.style.transform = `translate(${cx}px, ${cy}px)`; n.ring.style.visibility = o > 0.5 ? 'visible' : 'hidden'; }
      // the ring: hollow while unasked, filled once its reason hangs from it
      if (!n.ground) {
        n.mark.setAttribute('cx', cx.toFixed(2)); n.mark.setAttribute('cy', cy.toFixed(2));
        n.mark.setAttribute('fill', n.open ? '#1a1b1f' : '#fbfaf7'); n.mark.setAttribute('opacity', Math.max(0, o).toFixed(3));
        // a short stub hangs from a closed ring: there is something on the end of it
        const stub = n.open ? 0 : 7 * Math.max(0, o);
        n.stub.setAttribute('d', stub > 0.2 ? `M${cx} ${cy + R}l0 ${stub.toFixed(2)}` : ''); n.stub.setAttribute('opacity', '0.8');
      } else {
        // ground: three bars, narrowing, under the end of the thread
        const g = (w, dy) => `M${(cx - w).toFixed(2)} ${(cy + dy).toFixed(2)}h${(2 * w).toFixed(2)}`;
        n.mark.setAttribute('d', g(7, -3) + g(4.5, 1) + g(2, 5)); n.mark.setAttribute('opacity', Math.max(0, o).toFixed(3));
      }
      if (n.parent) {
        const [x0, y0, x1, y1] = thread_ends(n), m = Math.max(4, (y1 - y0) * 0.5);
        n.thread.setAttribute('d', show && y1 > y0 + 0.5 ? `M${x0.toFixed(2)} ${y0.toFixed(2)}C${x0.toFixed(2)} ${(y0 + m).toFixed(2)} ${x1.toFixed(2)} ${(y1 - m).toFixed(2)} ${x1.toFixed(2)} ${y1.toFixed(2)}` : '');
        n.thread.setAttribute('opacity', Math.min(1, o * 1.5).toFixed(3));
      }
      if (n.shown && n.op.target === 1) { if (n.depth > deepest) { deepest = n.depth; grounded = !!n.ground; } else if (n.depth === deepest && n.ground) grounded = true; }
    }
    hud.innerHTML = deepest ? `${T.depth} <b>${deepest}</b>${grounded ? (zh ? ' · 到底' : ' · bedrock') : ''}` : '';
  }
  const sched = scheduler((dt) => { let b = false; for (const n of nodes) { b = n.y.step(dt) || b; b = n.op.step(dt) || b; } render(); return b; });
  fit(); render();

  // measured from the drawing: each thread's ends against the rings' boxes, and each node's depth by climbing threads
  function check() {
    const wr = wrap.getBoundingClientRect(); let worst = 0, depth_ok = true, chains = 0;
    for (const n of nodes) {
      if (!n.shown || !n.parent) continue;
      const d = n.thread.getAttribute('d'); if (!d) { depth_ok = false; continue; }
      const nums = d.match(/-?[\d.]+/g).map(Number), s = [nums[0], nums[1]], e = [nums[nums.length - 2], nums[nums.length - 1]];
      const pr = n.parent.ring.getBoundingClientRect(), pc = [pr.left + pr.width / 2 - wr.left, pr.top + pr.height / 2 - wr.top];
      const cc = n.ring ? (() => { const r = n.ring.getBoundingClientRect(); return [r.left + r.width / 2 - wr.left, r.top + r.height / 2 - wr.top]; })() : [rx(n), ry(n)];
      worst = Math.max(worst, Math.hypot(s[0] - pc[0], s[1] - (pc[1] + R)), Math.hypot(e[0] - cc[0], e[1] - (cc[1] - (n.ground ? 3 : R))));
      // climb: find the shown node whose ring is at the thread's start, until a claim
      let k = n, hops = 0;
      while (k.parent) { const st = k.thread.getAttribute('d').match(/-?[\d.]+/g).map(Number); const up = nodes.find((q) => q.shown && q.ring && Math.hypot(rx(q) - st[0], ry(q) + R - st[1]) < 0.5); if (!up) break; k = up; hops++; }
      if (hops !== n.depth || k.depth !== 0) depth_ok = false;
      if (n.ground) chains++;
    }
    return { worst, depth_ok, chains };
  }
  return {
    visible: (v) => sched.set_visible(v),
    resize: () => { fit(); render(); },
    demo() { const a = roots[0]; toggle(a, true); setTimeout(() => toggle(a.child, true), 700); setTimeout(() => toggle(a.child.child, true), 1400); },
    open(ids) { for (const n of nodes) n.open = false; for (const id of ids) { const n = nodes.find((q) => q.id === id); let p = n; while (p) { p.open = true; p = p.parent; } } layout(false); sched.wake(); },
    async accept() {
      const settle = () => { for (let i = 0; i < 600; i++) { let b = false; for (const n of nodes) { b = n.y.step(1 / 60) || b; b = n.op.step(1 / 60) || b; } if (!b) break; } render(); };
      // open every chain to bedrock
      for (const n of nodes) n.open = !n.ground; layout(false); settle();
      const a = check(), shown_all = nodes.filter((n) => n.shown).length;
      // fold the first claim: everything under it must go, the second chain must stay
      toggle(roots[0], false); settle();
      const under = nodes.filter((n) => n.id.startsWith('0.') && n.depth > 0), gone = under.every((n) => !n.shown && !n.open && n.op.x < 0.01 && n.el.style.visibility === 'hidden');
      const kept = nodes.filter((n) => n.id.startsWith('1.')).every((n) => n.shown), b = check();
      // reopen it: only its first reason comes back
      toggle(roots[0], true); settle();
      const one = nodes.filter((n) => n.id.startsWith('0.') && n.shown).length === 2;
      for (const n of nodes) n.open = false; layout(false); settle();
      const pass = a.worst < 0.5 && b.worst < 0.5 && a.depth_ok && b.depth_ok && a.chains === 2 && gone && kept && one && shown_all === nodes.length;
      return { pass, value: zh ? `线端最大误差 ${Math.max(a.worst, b.worst).toFixed(2)} px；两条链深度 3 = 数出的 3 ${a.depth_ok ? '✓' : '✗'}；收起后其下 ${under.length} 个全部收起 ${gone ? '✓' : '✗'}，另一条不动 ${kept ? '✓' : '✗'}` : `thread ends within ${Math.max(a.worst, b.worst).toFixed(2)} px; both chains depth 3 = counted 3 ${a.depth_ok ? '✓' : '✗'}; folding a claim folds its ${under.length} reasons ${gone ? '✓' : '✗'}, the other chain stays ${kept ? '✓' : '✗'}` };
    },
  };
}
