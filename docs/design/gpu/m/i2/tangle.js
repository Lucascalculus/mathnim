// Numbers you drag, with rolling digits. A number in a sentence is a handle: drag it sideways and the numbers that
// depend on it, in the same sentence, follow (Bret Victor's Tangle). Every number is an odometer: each digit is a
// wheel that turns continuously, and a wheel turns only while the one below it passes from 9 to 0, so carries ripple
// up visibly and fast wheels blur as real drums do. At rest every wheel sits on a digit and reads the model exactly.
// As a library primitive: tangle(text, model) for any paragraph with quantities in it.
import { scheduler } from '../../lib/gl.js';
import { Spring } from '../../lib/ui.js';
import { SANS, SERIF, C, css_once, Odometer, wheel } from './_formula.js';

export const meta = {
  id: 'tangle',
  name: { zh: '可拖动的数，滚动的数字', en: 'Numbers you drag, with rolling digits' },
  means: { zh: '句子里的数可以左右拖；同一句里依赖它的数跟着变。每一位数字都是一只会转的轮子，进位看得见。', en: 'A number in a sentence can be dragged sideways, and the numbers that depend on it follow; every digit is a wheel that turns, and carries are visible.' },
  test: { zh: '静止时显示的每个数都等于模型的值；每只轮子停在某个数字上，当且仅当这个数在那一位就是它', en: 'At rest every number shown equals the model; a wheel rests on a digit exactly when the number has that digit there' },
  wide: true,
};

// the inputs (whole steps), and what follows from them
const IN = {
  v: { v: 12, lo: 1, hi: 30, pps: 7, col: 'cobalt', max: 2 },
  a: { v: 4, lo: 1, hi: 10, pps: 18, col: 'ochre', max: 2 },
  r: { v: 8, lo: 1, hi: 64, pps: 5, col: 'violet', max: 2 },
};
const OUT = {
  t: { f: (g) => g.v / g.a, places: 1, max: 2, deps: ['v', 'a'] },                 // seconds to stop
  d: { f: (g) => g.v * g.v / (2 * g.a), places: 1, max: 3, deps: ['v', 'a'] },      // metres rolled
  n: { f: (g) => 2 * g.r * 4096, places: 0, max: 6, group: ',', deps: ['r'] },      // trainable parameters
  pc: { f: (g) => 100 * 2 * g.r / 4096, places: 2, max: 1, deps: ['r'] },          // share of the full matrix
};
const TEXT = {
  zh: [
    { kick: '模型预测控制', t: ['以 ', 'v', ' 米/秒行驶的卡车，以 ', 'a', ' 米/秒² 刹车：', 't', ' 秒后停下，这期间又滑行了 ', 'd', ' 米。'] },
    { kick: '微调', t: ['给一层 4096 × 4096 的权重加一个秩为 ', 'r', ' 的 LoRA，只需训练 ', 'n', ' 个参数，是整个矩阵的 ', 'pc', '%。'] },
  ],
  en: [
    { kick: 'Model predictive control', t: ['A cart moving at ', 'v', ' m/s brakes at ', 'a', ' m/s². It stops after ', 't', ' s, having rolled another ', 'd', ' m.'] },
    { kick: 'Fine-tuning', t: ['A rank-', 'r', ' LoRA on a 4096 × 4096 weight trains only ', 'n', ' parameters, ', 'pc', '% of the full matrix.'] },
  ],
};
const rnd = (v, p) => { const k = Math.pow(10, p); return Math.round(v * k) / k; };
const fmt = (v, p, group) => { const s = rnd(v, p).toFixed(p); return group ? s.replace(/\B(?=(\d{3})+(?!\d))/g, group) : s; };

css_once('tg-css', `
.tg-wrap{position:absolute;inset:0;background:var(--paper);overflow:hidden;user-select:none;-webkit-user-select:none}
.tg-col{position:absolute;left:50%;transform:translateX(-50%);width:min(660px, calc(100% - 40px))}
.tg-p{font-family:${SERIF};font-size:25px;line-height:1.95;color:var(--ink);margin:0 0 30px}
.tg-k{font-family:${SANS};font-size:13px;font-weight:500;color:#62666d;margin:0 0 6px;letter-spacing:.01em}
.tg-n{position:relative;display:inline-block;line-height:1.25;font-family:${SANS};font-weight:600;font-size:.92em;padding:0 .14em;border-radius:.3em;white-space:nowrap}
.tg-n.in{cursor:ew-resize;touch-action:none}
.tg-n.in::before{content:'';position:absolute;left:.14em;right:.14em;bottom:.02em;border-bottom:1.5px dotted currentColor;opacity:.7}
.tg-n.in::after{content:'';position:absolute;left:-10px;right:-10px;top:-12px;bottom:-12px}
.tg-n .glass{position:absolute;inset:-.12em -.08em;border-radius:.34em;background:rgba(255,255,255,.75);opacity:0;z-index:-1;
  box-shadow:0 0 0 .75px rgba(26,27,31,.14),0 6px 14px rgba(26,27,31,.12),0 1px 2px rgba(26,27,31,.1)}
.tg-p{position:relative;z-index:0}
.tg-wrap.narrow .tg-p{font-size:21px;line-height:1.95;margin-bottom:26px}
`);

export function make({ stage, canvas, hud, lang }) {
  const zh = lang === 'zh';
  canvas.style.display = 'none';
  const wrap = document.createElement('div'); wrap.className = 'tg-wrap'; stage.append(wrap);
  const col = document.createElement('div'); col.className = 'tg-col'; wrap.append(col);
  const num = {};   // key → { el, odo }
  for (const P of TEXT[lang]) {
    const k = document.createElement('div'); k.className = 'tg-k'; k.textContent = P.kick; col.append(k);
    const p = document.createElement('p'); p.className = 'tg-p'; col.append(p);
    for (const tok of P.t) {
      if (!IN[tok] && !OUT[tok]) { p.append(document.createTextNode(tok)); continue; }
      const el = document.createElement('span'); el.className = 'tg-n' + (IN[tok] ? ' in' : '');
      if (IN[tok]) el.style.color = C[IN[tok].col];
      el.innerHTML = '<span class="glass"></span><span class="o"></span>';
      p.append(el);
      const D = IN[tok] || OUT[tok];
      num[tok] = { el, glass: el.querySelector('.glass'), odo: new Odometer(el.querySelector('.o'), { places: D.places || 0, group: D.group || '', max_int: D.max }), lift: new Spring(0, 0.22, 1) };
    }
  }
  // the inputs as springs: the hand moves them continuously, a release settles them on a whole step
  const S = Object.fromEntries(Object.keys(IN).map((k) => [k, new Spring(IN[k].v, 0.34, 0.86)]));
  const model = () => Object.fromEntries(Object.keys(IN).map((k) => [k, Math.round(S[k].target)]));
  // what a dependent shows while an input is between steps: it rolls from the shown value at one step to the shown
  // value at the next, so at a whole step it reads the model exactly
  function shown(k, g) {
    const D = OUT[k], free = D.deps.find((d) => Math.abs(g[d] - Math.round(g[d])) > 1e-9);
    if (!free) return rnd(D.f(roundall(g)), D.places);
    const lo = Math.floor(g[free]), hi = Math.ceil(g[free]), u = g[free] - lo;
    const at = (v) => rnd(D.f({ ...roundall(g), [free]: v }), D.places);
    return at(lo) + (at(hi) - at(lo)) * u;
  }
  const roundall = (g) => Object.fromEntries(Object.entries(g).map(([k, v]) => [k, Math.round(v)]));

  function paint() {
    const g = Object.fromEntries(Object.keys(IN).map((k) => [k, Math.max(IN[k].lo, Math.min(IN[k].hi, S[k].x))]));
    for (const k in IN) num[k].odo.set(g[k]);
    for (const k in OUT) num[k].odo.set(shown(k, g));
    for (const k in num) num[k].glass.style.opacity = Math.max(0, num[k].lift.x).toFixed(3);
  }

  let drag = null;
  for (const k in IN) {
    const el = num[k].el;
    el.addEventListener('pointerdown', (e) => { drag = { k, x0: e.clientX, v0: S[k].x, moved: false }; wrap.setPointerCapture(e.pointerId); num[k].lift.to(1); sched.wake(); e.preventDefault(); });
    el.addEventListener('pointerenter', (e) => { if (e.pointerType === 'mouse' && !drag) { num[k].lift.to(0.6); sched.wake(); } });
    el.addEventListener('pointerleave', (e) => { if (e.pointerType === 'mouse' && (!drag || drag.k !== k)) { num[k].lift.to(0); sched.wake(); } });
  }
  wrap.addEventListener('pointermove', (e) => {
    if (!drag) return; const D = IN[drag.k];
    const x = Math.max(D.lo, Math.min(D.hi, drag.v0 + (e.clientX - drag.x0) / D.pps));
    S[drag.k].snap(x); sched.wake();
  });
  wrap.addEventListener('pointerup', () => { if (!drag) return; const k = drag.k; S[k].to(Math.round(S[k].x)); num[k].lift.to(0); drag = null; sched.wake(1500); });

  const sched = scheduler((dt) => {
    let b = false;
    for (const k in S) { if (drag && drag.k === k) continue; b = S[k].step(dt) || b; if (!S[k].busy()) S[k].snap(S[k].target); }
    for (const k in num) b = num[k].lift.step(dt) || b;
    paint(); return b || !!drag;
  });
  function layout() {
    const narrow = wrap.clientWidth < 560; wrap.classList.toggle('narrow', narrow);
    col.style.top = Math.max(24, (wrap.clientHeight - col.offsetHeight) / 2 - 10) + 'px';
  }
  paint(); layout(); addEventListener('resize', layout);

  // read a number back from the page: each shown wheel's place from its transform, null if any is between digits
  function dom_reading(odo) {
    let out = '';
    const parts = [...odo.el.children];
    for (const c of parts) {
      if (c.classList.contains('w')) {
        if (c.style.width === '0px') continue;
        const m = /translateY\((-?[\d.]+)em\)/.exec(c.querySelector('.s').style.transform), pos = m ? -parseFloat(m[1]) / 1.06 : 0;
        if (Math.abs(pos - Math.round(pos)) > 1e-6) return null;
        out += String(Math.round(pos) % 10);
      } else if (c.style.display !== 'none') out += c.textContent;
    }
    return out;
  }

  return {
    visible: (v) => sched.set_visible(v), resize: layout,
    demo() { S.r.to(32); S.v.to(20); sched.wake(2500); },
    // hold an input between steps, as a hand would (for stills)
    hold(k, x) { S[k].snap(x); num[k].lift.snap(1); paint(); drag = { k, x0: 0, v0: x }; sched.wake(); },
    set(k, v) { drag = null; S[k].snap(v); for (const q in num) num[q].lift.snap(0); paint(); sched.wake(); },
    async accept() {
      // 1. at rest, for many settings, every number on the page reads the model exactly
      let rest_ok = 0, rest_n = 0, worst = '';
      const rng = (() => { let a = 9; return () => ((a = (a * 1103515245 + 12345) % 2147483648) / 2147483648); })();
      for (let i = 0; i < 40; i++) {
        for (const k in IN) S[k].snap(IN[k].lo + Math.floor(rng() * (IN[k].hi - IN[k].lo + 1)));
        paint(); const g = model();
        for (const k in num) {
          rest_n++;
          const want = IN[k] ? String(g[k]) : fmt(OUT[k].f(g), OUT[k].places, OUT[k].group);
          const got = dom_reading(num[k].odo);
          if (got === want) rest_ok++; else worst = `${k}: ${got} ≠ ${want}`;
        }
      }
      // 2. the wheels of the parameter count, across continuous values: a wheel rests on a digit exactly when every
      //    wheel below it is at rest too (no carry passing), and then it shows that digit of the number
      const odo = num.n.odo; let wheel_ok = 0, wheel_n = 0;
      for (let i = 0; i < 400; i++) {
        const x = i % 4 === 0 ? 8192 + Math.floor(rng() * 516096) : 8192 + rng() * 516096;
        odo.set(x);
        odo.wheels.forEach((W, k) => {
          if (!W.shown) return; wheel_n++;
          const m = /translateY\((-?[\d.]+)em\)/.exec(W.s.style.transform), pos = -parseFloat(m[1]) / 1.06;
          const xr = Math.round(x * 1e6) / 1e6, p = Math.pow(10, k), below = xr - Math.floor(xr / p) * p;
          const should = k === 0 ? Number.isInteger(xr) : below <= p - 1 + 1e-9;
          const is = Math.abs(pos - Math.round(pos)) < 1e-6;
          if (is === should && (!is || Math.round(pos) % 10 === Math.floor(xr / p) % 10)) wheel_ok++;
        });
      }
      for (const k in IN) S[k].snap(IN[k].v); paint(); sched.wake();
      const pass = rest_ok === rest_n && wheel_ok === wheel_n;
      return { pass, value: zh ? `静止读数 ${rest_ok}/${rest_n} 与模型一致${worst ? '（' + worst + '）' : ''}；轮子 ${wheel_ok}/${wheel_n} 处停位与数值一致` : `at rest ${rest_ok}/${rest_n} readings equal the model${worst ? ' (' + worst + ')' : ''}; wheels consistent at ${wheel_ok}/${wheel_n} samples` };
    },
  };
}
