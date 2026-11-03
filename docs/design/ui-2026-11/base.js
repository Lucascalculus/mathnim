// Shared by the previews: the data (data.js, window.MN), a tiny hash router, springs, plates, and the switcher.
window.UI = (() => {
  const { courses, lesson } = window.MN;
  const course = (id) => courses.find((c) => c.id === id);
  const all = (c) => c.units.flatMap((u) => u.lessons);
  const current = (c) => all(c).find((l) => l.status === 'current');
  const recent = () => course('mpc');
  const unit_of = (c, l) => c.units.find((u) => u.lessons.includes(l));
  const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[ch]);
  const hours = (min) => (min >= 60 ? `${(min / 60).toFixed(min >= 600 ? 0 : 1)} 小时` : `${min} 分钟`);
  const pad = (n) => String(n).padStart(2, '0');

  /**
   * A spring as a CSS linear() easing, from Apple's two designer parameters (WWDC23 "Animate with springs"):
   * mass 1, stiffness (2π / duration)², damping (1 − bounce)·4π / duration. Sampled until it settles.
   */
  function spring(duration = 0.42, bounce = 0) {
    const k = (2 * Math.PI / duration) ** 2, c = ((1 - bounce) * 4 * Math.PI) / duration;
    let x = 0, v = 0;
    const dt = 1 / 240, pts = [];
    let t = 0, settled = 0;
    while (t < 4) {
      const a = k * (1 - x) - c * v;
      v += a * dt;
      x += v * dt;
      t += dt;
      pts.push([t, x]);
      settled = Math.abs(1 - x) < 0.0015 && Math.abs(v) < 0.01 ? settled + 1 : 0;
      if (settled > 12) break;
    }
    const T = t, step = Math.max(1, Math.floor(pts.length / 48));
    const keep = pts.filter((_, i) => i % step === 0);
    const css = `linear(0, ${keep.map(([tt, xx]) => `${xx.toFixed(4)} ${((tt / T) * 100).toFixed(1)}%`).join(', ')}, 1)`;
    return { css, ms: Math.round(T * 1000) };
  }
  const SPRINGS = { smooth: spring(0.42, 0), snappy: spring(0.3, 0.12), flick: spring(0.45, 0.15) };
  if (CSS.supports('transition-timing-function', 'linear(0, 1)')) {
    const r = document.documentElement.style;
    r.setProperty('--smooth', SPRINGS.smooth.css);
    r.setProperty('--d-smooth', `${SPRINGS.smooth.ms}ms`);
    r.setProperty('--snappy', SPRINGS.snappy.css);
    r.setProperty('--d-snappy', `${SPRINGS.snappy.ms}ms`);
  }
  const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

  /** A lesson's plate: the detail of its figure (crops.json), or its title set as type when it has no scene. */
  function plate(l, { full = false, cls = '', label = '' } = {}) {
    if (!l.thumb) return `<span class="plate type ${cls}"><span class="img"><span>${esc(label)}</span><b>${esc(l.title)}</b></span><span class="crops"><i></i><i></i><i></i><i></i></span></span>`;
    let style;
    if (full || !l.crop) style = `background-image:url(${l.thumb});background-size:100% auto;background-position:50% 50%`;
    else {
      const [x, y, w, h] = l.crop;
      style = `background-image:url(${l.thumb});background-size:${(100 / w).toFixed(2)}% auto;background-position:${w < 1 ? ((x / (1 - w)) * 100).toFixed(2) : 0}% ${h < 1 ? ((y / (1 - h)) * 100).toFixed(2) : 0}%`;
    }
    return `<span class="plate ${full ? 'full' : ''} ${cls}"><span class="img" style="${style}"></span><span class="crops"><i></i><i></i><i></i><i></i></span></span>`;
  }
  const ARROW = '<svg class="arrow" viewBox="0 0 16 10" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M0 5h14.5M10.5 1l4 4-4 4"/></svg>';
  const LOGO = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M6.5 16.5L12 7l5.5 9.5"/></svg>';

  /** Small marks for a step's kind (Bertin: shape for category): reading, deriving, a scene, a world, a question, code. */
  function kind_mark(kind, x, y, r, attrs = '') {
    switch (kind) {
      case 'scene': return `<path d="M${x - r * 0.75},${y - r}L${x + r},${y}L${x - r * 0.75},${y + r}Z" ${attrs}/>`;
      case 'explore': return `<path d="M${x},${y - r * 1.15}L${x + r * 1.15},${y}L${x},${y + r * 1.15}L${x - r * 1.15},${y}Z" ${attrs}/>`;
      case 'check': return `<circle cx="${x}" cy="${y}" r="${r}" ${attrs}/>`;
      case 'code': return `<rect x="${x - r * 0.95}" y="${y - r * 0.95}" width="${r * 1.9}" height="${r * 1.9}" ${attrs}/>`;
      default: return `<rect x="${x - r * 0.45}" y="${y - r * 1.1}" width="${r * 0.9}" height="${r * 2.2}" ${attrs}/>`;
    }
  }
  const KIND = { read: '阅读', derive: '推导', check: '练一练', scene: '演示', explore: '动手', code: '代码' };

  /** #/  #/course/<id>  #/lesson[/<step>] */
  function route() {
    const h = location.hash.replace(/^#\/?/, '');
    const [page, id] = h.split('/');
    return { page: page || 'home', id };
  }
  function start(render) {
    let last = null;
    const go = () => {
      const r = route();
      const same = last && last.page === r.page;
      render(r, { same, from: last });
      document.querySelectorAll('.proto a[data-page]').forEach((a) => a.classList.toggle('on', a.dataset.page === r.page));
      if (!same) window.scrollTo(0, 0);
      last = r;
    };
    window.addEventListener('hashchange', go);
    go();
  }
  function switcher(name) {
    const dirs = [['exhibit', '展厅'], ['atlas', '路线'], ['lens', '镜头'], ['alive', '笔']];
    const el = document.createElement('nav');
    el.className = 'proto';
    el.innerHTML =
      dirs.map(([f, t]) => `<a href="${f}.html${location.hash || '#/'}" class="${f === name ? 'on' : ''}">${t}</a>`).join('') +
      '<i></i>' +
      [['home', '首页', '#/'], ['course', '课程', '#/course/mpc'], ['lesson', '课时', '#/lesson']].map(([p, t, h]) => `<a data-page="${p}" href="${h}">${t}</a>`).join('') +
      '<i></i><a href="index.html">说明</a>';
    document.body.append(el);
    // keep the direction links on the same page as you move
    addEventListener('hashchange', () => el.querySelectorAll('a').forEach((a, i) => i < dirs.length && (a.href = `${dirs[i][0]}.html${location.hash}`)));
  }
  /**
   * Moving between steps: forward comes in from the right, back from the left, so a step always leaves and returns
   * by the same path (spatial consistency); on a spring, short, skipped when motion is reduced.
   */
  function step_in(el, from, to) {
    if (!el || !from || from === to || reduced()) return;
    const dx = to > from ? 28 : -28;
    el.animate([{ opacity: 0, transform: `translateX(${dx}px)` }, { opacity: 1, transform: 'none' }], { duration: SPRINGS.smooth.ms, easing: SPRINGS.smooth.css });
  }
  /** On a phone the guide rises from the dock: the page's questions, its notes, a line to write. A second tap closes it. */
  function guide_sheet(asks = [], note = null) {
    const open = document.querySelector('.guide-sheet');
    if (open) return open.remove();
    const el = document.createElement('div');
    el.className = 'guide-sheet';
    el.innerHTML = `<span class="mono">问这一页</span>${asks.map((q) => `<button class="gq">${q}</button>`).join('')}${note ? `<div class="gn"><span class="mono">问 · 01</span><b>${esc(note.q)}</b><div>${note.a}</div></div>` : ''}<div class="gw">问这一页……</div>`;
    document.body.append(el);
    if (!reduced()) el.animate([{ transform: 'translateY(16px) scale(.97)', opacity: 0 }, { transform: 'none', opacity: 1 }], { duration: SPRINGS.smooth.ms, easing: SPRINGS.smooth.css });
  }
  return { guide_sheet, step_in, courses, lesson, course, all, current, recent, unit_of, esc, hours, pad, plate, kind_mark, KIND, ARROW, LOGO, SPRINGS, spring, reduced, start, switcher };
})();
