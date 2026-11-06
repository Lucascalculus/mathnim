// The formula steps in a text (a tutor's answer, a page): each column of formulas math_html made from a ```steps block
// becomes the engine's derivation, one formula that changes line by line, played once when it is first seen; a click
// plays it again. Before it is drawn it is read, typeset and checked (review_steps): a block that does not read or
// typeset keeps its column; a line that does not follow from the one before is marked while it rests.
import { FigurePlayer, figure_zone, load_tex, parts_figure, review_steps, steps_figure, type FormulaPart, type Lang } from '@mathnim/engine';
import { page_for } from './page_text';

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
  const fig = steps_figure(r.lines, { lang, paper: false, nouns: r.nouns });
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
  // (the derivation joins its text's page: a noun's symbols answer the hand on that noun anywhere on the page)
  if (Object.keys(r.nouns ?? {}).length) page_for(el).attach(figure_zone(p, { id: 'steps' }));
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

/**
 * Turn every exploded formula under `root` (a ```parts fence, a math block with parts) into the engine's: tap it and
 * the pieces lift on their cards with what each means; tap again and they drop back. One that does not typeset, or
 * whose pieces are not in it, keeps its plain form (the formula and the list).
 */
export async function mount_parts(root: ParentNode, lang: Lang): Promise<void> {
  const els = [...root.querySelectorAll<HTMLElement>('.mn-parts[data-parts]:not([data-live])')];
  if (!els.length) return;
  for (const el of els) el.dataset.live = '';
  await load_tex();
  for (const el of els) await mount_one_parts(el, lang).catch((e) => console.warn('parts', e));
}
async function mount_one_parts(el: HTMLElement, lang: Lang): Promise<void> {
  if (!el.isConnected) return;
  const d = JSON.parse(el.dataset.parts ?? '{}') as { tex: string; parts: FormulaPart[] };
  const fig = parts_figure(d.tex, d.parts, { lang, paper: false });
  const F = fig.formula;
  if (F.issues.length) { el.dataset.issues = F.issues.join(' | '); return; }
  const stage = document.createElement('div');
  stage.className = 'mn-parts-stage';
  const canvas = document.createElement('canvas');
  stage.append(canvas);
  el.prepend(stage);
  const w = Math.max(220, Math.round(el.clientWidth || 360)), dpr = Math.min(2, typeof devicePixelRatio !== 'undefined' ? devicePixelRatio : 1);
  const p = new FigurePlayer(fig, canvas, { audio: false, size: { w, dpr }, label: lang === 'zh' ? '公式' : 'formula' });
  await p.load();
  canvas.style.width = `${canvas.width / dpr}px`;
  canvas.style.height = `${canvas.height / dpr}px`;
  el.classList.add('mn-parts-live');
  // (a frame whenever something it shows changes: the layer, its fade, the open state)
  p.start_live();
  // whole, only the formula shows: the rooms above and below it, for the braces and words, open as it is read (the
  // text around steps aside)
  const H = canvas.height / dpr, b = F.bands();
  const show = (open: boolean) => {
    stage.style.height = `${open ? H : b.bottom - b.top}px`;
    canvas.style.marginTop = open ? '0px' : `${-b.top}px`;
  };
  show(false);
  // (on the canvas too, for the tools that drive the page headlessly: page_shots)
  (canvas as HTMLCanvasElement & { mn_parts?: typeof F }).mn_parts = F;
  canvas.setAttribute('role', 'button');
  canvas.tabIndex = 0;
  const say = () => canvas.setAttribute('aria-label', F.open.peek() > 0.5 ? (lang === 'zh' ? '公式的这一层；点一块看里面' : 'this layer of the formula; tap a block to look inside') : (lang === 'zh' ? '一块一块读这个公式' : 'read the formula block by block'));
  say();
  // a layer: the open state and which layer, the new layer's marks coming in
  const go = (to: { open: number; layer: number }) => {
    stage.classList.add('mn-parts-moving');
    show(to.open > 0.5);
    // (the learner's own taps move the figure directly: they are not the tutor's acts, and the fade is no tutor's param)
    if (Math.round(F.layer.peek()) !== to.layer) {
      F.fade.set(0, true);
      F.layer.set(to.layer, true);
      void p.tween(F.fade, 1, 0.45);
    }
    if ((F.open.peek() > 0.5) !== (to.open > 0.5)) void p.tween(F.open, to.open, 0.5);
    say();
  };
  canvas.addEventListener('click', (e) => { const to = F.tap(p.point_of(e)); if (to) go(to); });
  canvas.addEventListener('keydown', (e) => {
    const n = Math.round(F.layer.peek()), open = F.open.peek() > 0.5;
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      // whole → the outer layer → each inside in turn → whole again
      go(!open ? { open: 1, layer: 0 } : n < F.opens.length ? { open: 1, layer: n + 1 } : { open: 0, layer: 0 });
    } else if (e.key === 'Escape' && open) {
      const f = n >= 1 ? F.opens[n - 1] : null;
      go(f ? { open: 1, layer: f.parent ? F.opens.indexOf(f.parent) + 1 : 0 } : { open: 0, layer: 0 });
    }
  });
}
