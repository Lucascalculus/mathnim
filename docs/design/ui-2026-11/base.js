// Shared by the previews: the data (data.js, window.MN), a tiny hash router, and the switcher between directions.
window.UI = (() => {
  const { courses, lesson } = window.MN;
  const course = (id) => courses.find((c) => c.id === id);
  const all = (c) => c.units.flatMap((u) => u.lessons);
  const current = (c) => all(c).find((l) => l.status === 'current');
  const recent = () => course('mpc');
  const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[ch]);
  const hours = (min) => (min >= 60 ? `${(min / 60).toFixed(min >= 600 ? 0 : 1)} h` : `${min} min`);

  /** #/  #/course/<id>  #/lesson */
  function route() {
    const h = location.hash.replace(/^#\/?/, '');
    const [page, id] = h.split('/');
    return { page: page || 'home', id };
  }
  function start(render) {
    const go = () => {
      const r = route();
      render(r);
      document.querySelectorAll('.proto a[data-page]').forEach((a) => a.classList.toggle('on', a.dataset.page === r.page));
      window.scrollTo(0, 0);
    };
    window.addEventListener('hashchange', go);
    go();
  }
  function switcher(name) {
    const dirs = [['atlas', '路线'], ['drawing', '图纸'], ['lens', '镜头']];
    const el = document.createElement('nav');
    el.className = 'proto';
    el.innerHTML =
      dirs.map(([f, t]) => `<a href="${f}.html${location.hash || '#/'}" class="${f === name ? 'on' : ''}">${t}</a>`).join('') +
      '<i></i>' +
      [['home', '首页', '#/'], ['course', '课程', '#/course/mpc'], ['lesson', '课时', '#/lesson']].map(([p, t, h]) => `<a data-page="${p}" href="${h}">${t}</a>`).join('') +
      '<i></i><a href="index.html">说明</a>';
    document.body.append(el);
  }
  return { courses, lesson, course, all, current, recent, esc, hours, start, switcher };
})();
