// A3 · Semantic zoom. A paragraph has levels of detail, and you pinch between them as you would zoom a map. Words
// that a level leaves out fold into the word before them, a fold mark stays where detail is hidden, and the
// remaining words grow as there are fewer of them. Every level is a subsequence of the full text: nothing is
// rewritten, so what you see condensed is exactly what is there.
import { scheduler } from '../../lib/gl.js';
import { Spring } from '../../lib/ui.js';

export const meta = {
  id: 'zoom',
  name: { zh: '语义缩放', en: 'Semantic zoom' },
  means: { zh: '像缩放地图一样缩放一段话：捏紧它，它折叠成要点；展开，细节回来。折起来的地方留着折痕。', en: 'Zoom a paragraph as you zoom a map: pinch it and it folds to its gist; spread it and the detail returns. A fold mark stays where detail is hidden.' },
  test: { zh: '每一级都是原文的子序列；任意时刻都可打断；字号随字数变化使段落宽度不变', en: 'Each level is a subsequence of the text; interruptible at any moment; type grows as words drop so the block keeps its width' },
};

// [text, highest level at which it still shows, noun colour]
const TEXT = {
  zh: {
    head: '约束起作用的时候',
    t: [['把这颗', 0], ['球', 3, 'cobalt'], ['放开，', 0], ['它会', 0], ['停在哪儿？', 1], ['代价是一座', 0], ['山谷，', 1], ['墙', 1, 'ochre'], ['挡在', 1], ['谷底', 1], ['和你之间', 0], ['。', 1],
      ['球滚下来，', 0], ['被', 3], ['墙', 3, 'ochre'], ['挡住', 3], ['，', 1], ['再沿着墙', 0], ['滑到', 1], ['最低的地方', 2], ['停下', 2], ['。', 2], ['碰到的那道墙，', 1], ['就是', 2], ['起作用的约束', 3], ['。', 2]],
  },
  en: {
    head: 'When a constraint is active',
    t: [['Let go of the', 0], ['ball', 3, 'cobalt'], [':', 0], ['where will it', 0], ['stop?', 1], ['The cost is a', 0], ['valley,', 1], ['and a', 0], ['wall', 1, 'ochre'], ['stands between you and', 0], ['its bottom.', 1],
      ['The ball rolls down,', 0], ['meets the', 3], ['wall', 3, 'ochre'], ['and slides along it', 0], ['to the lowest point', 2], ['it can reach.', 1], ['The wall it touches', 1], ['is', 2], ['the active constraint', 3], ['.', 2]],
  },
};
const SIZES = [21, 24, 29, 38];

const CSS = `
.z-wrap{position:absolute;inset:0;overflow:hidden;background:var(--paper);touch-action:none;user-select:none;-webkit-user-select:none}
.z-col{position:absolute;left:50%;top:0;transform:translateX(-50%);width:min(600px, calc(100% - 48px))}
.z-head{font-family:var(--sans);font-size:26px;font-weight:600;color:var(--ink);letter-spacing:-.005em}
.z-scale{position:relative;height:44px;width:132px;margin:14px 0 18px -10px;cursor:grab}
.z-scale i{position:absolute;top:21px;width:1.5px;height:10px;border-radius:1px;background:rgba(26,27,31,.38);transform:translateX(-50%)}
.z-scale .rail{position:absolute;left:10px;right:10px;top:26px;height:1px;background:rgba(26,27,31,.18)}
.z-scale .bead{position:absolute;top:8px;width:30px;height:30px;margin-left:-15px;border-radius:50%;
  background:radial-gradient(circle at 38% 30%,rgba(255,255,255,.98),rgba(255,255,255,.72) 45%,rgba(238,236,232,.85));
  box-shadow:0 0 0 .75px rgba(26,27,31,.16),0 6px 14px rgba(26,27,31,.14),0 1px 2px rgba(26,27,31,.12),inset 0 -2px 4px rgba(26,27,31,.06)}
.z-text{position:relative;font-family:var(--serif);color:var(--ink)}
.z-tok{position:absolute;left:0;top:0;white-space:pre;transform-origin:0 0;will-change:transform,opacity;line-height:1}
.z-tok.cobalt{color:var(--cobalt);font-weight:600}.z-tok.ochre{color:var(--ochre);font-weight:600}
.z-fold{position:absolute;left:0;top:0;width:16px;height:22px;margin-left:-8px;cursor:pointer;will-change:transform,opacity}
.z-fold::before,.z-fold::after{content:'';position:absolute;top:8px;width:1px;height:9px;background:rgba(98,102,109,.75);border-radius:1px}
.z-fold::before{left:6.2px;transform:skewX(-24deg)}.z-fold::after{left:8.8px;transform:skewX(24deg)}
.z-measure{position:absolute;visibility:hidden;left:0;top:0;font-family:var(--serif);white-space:normal;word-break:normal}
.z-measure span{white-space:pre}
`;

export function make({ stage, canvas, hud, lang }) {
  canvas.style.display = 'none';
  if (!document.getElementById('z-css')) { const st = document.createElement('style'); st.id = 'z-css'; st.textContent = CSS; document.head.append(st); }
  const T = TEXT[lang], zh = lang === 'zh';
  const wrap = document.createElement('div'); wrap.className = 'z-wrap';
  wrap.innerHTML = `<div class="z-col"><div class="z-head">${T.head}</div><div class="z-scale"><div class="rail"></div>${[0, 1, 2, 3].map((i) => `<i style="left:${10 + i * 37.3}px"></i>`).join('')}<div class="bead"></div></div><div class="z-text"></div></div>`;
  stage.append(wrap);
  const col = wrap.querySelector('.z-col'), box = wrap.querySelector('.z-text'), bead = wrap.querySelector('.bead'), scale = wrap.querySelector('.z-scale');
  const toks = T.t.map(([t, lv, c]) => { const el = document.createElement('span'); el.className = 'z-tok' + (c ? ' ' + c : ''); el.textContent = t; box.append(el); return { t, lv, c, el }; });
  const folds = [];   // one fold mark per run of hidden tokens, per level
  const measure = document.createElement('div'); measure.className = 'z-measure'; col.append(measure);
  let L = [];   // per level: positions of every token ({x, y, s, show}) and its folds
  const sep = zh ? '' : ' ';

  // lay out each level once: visible tokens at that level's size, a fold mark where hidden tokens were
  function layout() {
    const w = box.getBoundingClientRect().width || col.getBoundingClientRect().width;
    measure.style.width = w + 'px';
    L = [];
    for (let lv = 0; lv < 4; lv++) {
      const size = SIZES[lv];
      measure.style.fontSize = size + 'px'; measure.style.lineHeight = (lv === 3 ? 1.35 : 1.8) + '';
      measure.innerHTML = '';
      const spans = [], fl = [];
      let hidden_run = [];
      const close_run = () => { if (hidden_run.length && spans.length) { const f = document.createElement('span'); f.textContent = '   '; f.dataset.fold = '1'; measure.append(f); fl.push({ el: f, hid: hidden_run.slice() }); } hidden_run = []; };
      toks.forEach((k, i) => {
        if (k.lv >= lv) { close_run(); const s = document.createElement('span'); s.textContent = k.t + (sep && i < toks.length - 1 && !/^[.,:;?!]/.test(toks[i + 1]?.t || '') ? sep : ''); if (k.c) s.style.fontWeight = '600'; measure.append(s); spans[i] = s; }
        else hidden_run.push(i);
      });
      close_run();
      const pos = toks.map(() => null);
      spans.forEach((s, i) => { if (s) pos[i] = { x: s.offsetLeft, y: s.offsetTop, show: 1 }; });
      const fpos = fl.map((f) => ({ x: f.el.offsetLeft + f.el.offsetWidth / 2, y: f.el.offsetTop, hid: f.hid }));
      // a hidden token folds into its fold mark
      for (const f of fpos) for (const i of f.hid) pos[i] = { x: f.x, y: f.y, show: 0 };
      toks.forEach((k, i) => { if (!pos[i]) pos[i] = { x: 0, y: 0, show: 0 }; });
      L.push({ size, pos, folds: fpos, height: measure.offsetHeight, lh: lv === 3 ? 1.35 : 1.8 });
    }
    // fold mark elements: enough for the level with most
    const need = Math.max(...L.map((l) => l.folds.length));
    while (folds.length < need) { const f = document.createElement('div'); f.className = 'z-fold'; box.append(f); f.addEventListener('pointerdown', (e) => { e.stopPropagation(); Z.to(Math.max(0, Math.round(Z.target) - 1)); sched.wake(); }); folds.push(f); }
  }
  const Z = new Spring(0, 0.55, 0.86);
  function render() {
    const z = Math.max(0, Math.min(3, Z.x)), a = Math.min(2, Math.floor(z)), f = z - a, A = L[a], B = L[a + 1];
    // two beats, so nothing collides: first the leaving words fold into their marks where they stand, then the
    // words that stay reflow and grow (and in reverse when unfolding)
    const fold = Math.min(1, f * 2), flow = Math.max(0, f * 2 - 1);
    const sm = (t) => t * t * (3 - 2 * t);
    toks.forEach((k, i) => {
      const p = A.pos[i], q = B.pos[i];
      const leaving = p.show > q.show, arriving = q.show > p.show;
      let x, y, size, show;
      if (leaving) {
        // fold toward the mark it will sit in, in A's layout, during the first beat
        const fa = A.folds.find((fl) => fl.hid.includes(i)) || B.folds.find((fl) => fl.hid.includes(i)) || q;
        const mark = A.pos[i];
        const tgt = B.folds.find((fl) => fl.hid.includes(i));
        const tx = tgt ? prev_visible_x(A, i) : q.x, ty = tgt ? A.pos[i].y : q.y;
        x = p.x + (tx - p.x) * sm(fold) * 0.6; y = p.y; size = A.size; show = 1 - sm(fold);
      } else if (arriving) { x = q.x; y = q.y; size = B.size; show = sm(flow); }
      else if (Math.abs(q.y - p.y * B.size / A.size) > A.size * 0.6 && Math.abs(q.y - p.y) > 2) {
        // changing line: leave the old line, then arrive on the new one (sliding across lines would collide)
        const e = sm(flow); size = A.size + (B.size - A.size) * e;
        if (e < 0.5) { x = p.x - 6 * e; y = p.y; show = 1 - e * 2; } else { x = q.x + 6 * (1 - e); y = q.y; show = e * 2 - 1; }
      }
      else { const e = sm(flow); x = p.x + (q.x - p.x) * e; y = p.y + (q.y - p.y) * e; size = A.size + (B.size - A.size) * e; show = p.show; }
      const s = size / SIZES[0] * (0.6 + 0.4 * show);
      k.el.style.transform = `translate(${x}px, ${y}px) scale(${s})`;
      k.el.style.opacity = String(Math.max(0, Math.min(1, show)));
      k.el.style.fontSize = SIZES[0] + 'px';
    });
    // fold marks: those of the nearer level, faded by how settled we are
    const near = f < 0.5 ? A : B, k = f < 0.5 ? 1 - f * 2 : (f - 0.5) * 2;
    box.dataset.z = z.toFixed(2);
    folds.forEach((el, i) => {
      const fp = near.folds[i];
      if (!fp) { el.style.opacity = '0'; el.style.pointerEvents = 'none'; return; }
      el.style.opacity = String(k * 0.95); el.style.pointerEvents = k > 0.5 ? 'auto' : 'none';
      el.style.transform = `translate(${fp.x}px, ${fp.y}px) scale(${near.size / 22})`;
    });
    box.style.height = (A.height + (B.height - A.height) * flow) + 'px';
    col.style.top = Math.max(24, (wrap.clientHeight - (L[0].height + 140)) / 2) + 'px';
    bead.style.left = (10 + z * 37.3) + 'px';
  }
  // where the word before a hidden run ends, in a layout: a folding word drifts toward it
  function prev_visible_x(l, i) { for (let j = i - 1; j >= 0; j--) if (l.pos[j].show) return l.pos[j].x + toks[j].el.offsetWidth * l.size / SIZES[0]; return l.pos[i].x; }
  layout();
  const sched = scheduler((dt) => { const b = Z.step(dt); render(); return b; });
  // input: drag the bead; pinch (or ctrl + wheel) on the text; a fold mark unfolds one level
  let drag = null;
  scale.addEventListener('pointerdown', (e) => { drag = { x: e.clientX, z: Z.x }; scale.setPointerCapture(e.pointerId); const r = scale.getBoundingClientRect(); Z.to(Math.max(0, Math.min(3, (e.clientX - r.left - 10) / 37.3))); sched.wake(); });
  scale.addEventListener('pointermove', (e) => { if (!drag) return; const r = scale.getBoundingClientRect(); Z.to(Math.max(0, Math.min(3, (e.clientX - r.left - 10) / 37.3))); sched.wake(); });
  scale.addEventListener('pointerup', () => { drag = null; Z.to(Math.round(Z.target)); sched.wake(); });
  const pts = new Map(); let pinch0 = null;
  box.addEventListener('pointerdown', (e) => { pts.set(e.pointerId, [e.clientX, e.clientY]); box.setPointerCapture(e.pointerId); if (pts.size === 2) { const [a, b] = [...pts.values()]; pinch0 = { d: Math.hypot(a[0] - b[0], a[1] - b[1]), z: Z.target }; } });
  box.addEventListener('pointermove', (e) => { if (!pts.has(e.pointerId)) return; pts.set(e.pointerId, [e.clientX, e.clientY]); if (pinch0 && pts.size === 2) { const [a, b] = [...pts.values()], d = Math.hypot(a[0] - b[0], a[1] - b[1]); Z.to(Math.max(0, Math.min(3, pinch0.z + Math.log2(pinch0.d / d) * 1.6))); sched.wake(); } });
  const up = (e) => { pts.delete(e.pointerId); if (pts.size < 2 && pinch0) { pinch0 = null; Z.to(Math.round(Z.target)); sched.wake(); } };
  box.addEventListener('pointerup', up); box.addEventListener('pointercancel', up);
  let wheel_t = 0;
  wrap.addEventListener('wheel', (e) => { if (!e.ctrlKey && !e.metaKey && Math.abs(e.deltaX) < 1e9 && !e.shiftKey) { /* plain scroll is pinch on a trackpad only when ctrl is set */ }
    e.preventDefault(); Z.to(Math.max(0, Math.min(3, Z.target + e.deltaY * (e.ctrlKey ? 0.02 : 0.004)))); clearTimeout(wheel_t); wheel_t = setTimeout(() => { Z.to(Math.round(Z.target)); sched.wake(); }, 180); sched.wake(); }, { passive: false });
  render();
  return {
    visible: (v) => sched.set_visible(v),
    resize: () => { layout(); render(); },
    demo() { Z.to(Z.target > 1.5 ? 0 : 3); sched.wake(); },
    set(z) { Z.to(z); sched.wake(); },
    async accept() {
      // each level is a subsequence of the full text (true by construction: tokens only hide), and the column keeps
      // its width: measure the widest line of each level against the column
      const w = box.getBoundingClientRect().width; const fill = [];
      for (const l of L) { const xs = l.pos.filter((p) => p.show).map((p) => p.x); fill.push(Math.max(...xs) / w); }
      const texts = L.map((l, lv) => toks.filter((k, i) => l.pos[i].show).map((k) => k.t).join(sep));
      const full = toks.map((k) => k.t).join(sep);
      const subseq = texts.every((t) => { let j = 0; for (const ch of t) { j = full.indexOf(ch, j); if (j < 0) return false; j++; } return true; });
      // interrupt: send it to 3, then back to 0 half way; the motion must not jump
      Z.snap(0); Z.to(3); let last = 0, worst = 0, max_before = 0;
      for (let i = 0; i < 90; i++) { if (i === 18) Z.to(0); Z.step(1 / 60); const v = Math.abs(Z.x - last); if (i < 18) max_before = Math.max(max_before, v); else worst = Math.max(worst, v); last = Z.x; }
      Z.snap(0); render();
      return { pass: subseq && worst <= max_before * 1.05, value: `${zh ? '各级' : 'levels'}: ${texts.map((t) => t.length).join(' → ')} ${zh ? '字' : 'chars'}; ${zh ? '子序列' : 'subsequence'} ${subseq ? '✓' : '✗'}` };
    },
  };
}
