// The formula steps in a text (a tutor's answer, a page): each column of formulas math_html made from a ```steps block
// becomes the engine's derivation, one formula that changes line by line, played once when it is first seen; a click
// plays it again. Before it is drawn it is read, typeset and checked (review_steps): a block that does not read or
// typeset keeps its column; a line that does not follow from the one before is marked while it rests.
import { FigurePlayer, load_tex, review_steps, steps_figure, type Lang } from '@mathnim/engine';

/** Turn every column of steps under `root` that is not yet live into the engine's derivation. */
export async function mount_steps(root: ParentNode, lang: Lang): Promise<void> {
  const els = [...root.querySelectorAll<HTMLElement>('.mn-steps[data-steps]:not([data-live])')];
  if (!els.length) return;
  for (const el of els) el.dataset.live = '';
  await load_tex();
  for (const el of els) await mount_one(el, lang).catch((e) => console.warn('steps', e));
}

async function mount_one(el: HTMLElement, lang: Lang): Promise<void> {
  if (!el.isConnected) return;
  const r = review_steps(el.dataset.steps ?? '');
  // (what the check found stays on the element: the page's logs and tests read it)
  el.dataset.check = r.ok ? 'ok' : 'doubt';
  if (r.issues.length) el.dataset.issues = r.issues.join(' | ');
  if (r.lines.length < 2 || r.issues.some((s) => s.includes('does not typeset'))) return;
  const fig = steps_figure(r.lines, { lang, paper: false });
  fig.derivation.doubtful = r.doubtful;
  const stage = document.createElement('div');
  stage.className = 'mn-steps-stage';
  const canvas = document.createElement('canvas');
  stage.append(canvas);
  el.prepend(stage);
  const w = Math.max(200, Math.round(el.clientWidth || 320)), dpr = Math.min(2, typeof devicePixelRatio !== 'undefined' ? devicePixelRatio : 1);
  const p = new FigurePlayer(fig, canvas, { audio: false, size: { w, dpr }, label: lang === 'zh' ? '推导' : 'derivation' });
  await p.load();
  canvas.style.width = `${canvas.width / dpr}px`;
  canvas.style.height = `${canvas.height / dpr}px`;
  el.classList.add('mn-steps-live');
  const still = typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (still) { p.show_end(); return; }
  canvas.addEventListener('click', () => { p.seek_time(0); p.play(); });
  if (typeof IntersectionObserver === 'undefined') { p.play(); return; }
  const io = new IntersectionObserver((es) => {
    if (!es.some((e) => e.isIntersecting)) return;
    io.disconnect();
    p.play();
  }, { threshold: 0.6 });
  io.observe(stage);
}
