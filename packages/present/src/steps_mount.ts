// The formula steps in a text (a tutor's answer, a page): each column of formulas math_html made from a ```steps block
// becomes the engine's derivation, one formula that changes line by line, played once when it is first seen; a click
// plays it again. Before it is drawn it is read, typeset and checked (review_steps): a block that does not read or
// typeset keeps its column; a line that does not follow from the one before is marked while it rests.
import { FigurePlayer, figure_zone, load_tex, parts_figure, review_steps, steps_figure, type FormulaPart, type Lang, type PartsView } from '@mathnim/engine';
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
 * Turn every formula taken apart under `root` (a ```parts fence, a math block with parts) into the engine's. Pull it
 * up (or tap it) and its blocks come apart onto cards with what each means; let go and a spring takes it the rest of
 * the way, apart or back together, glyph for glyph. Tap a card that holds more to take it apart in turn; tap it again,
 * or the paper, to go back out. One that does not typeset, or whose pieces are not in it, keeps its plain form.
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
  const d = JSON.parse(el.dataset.parts ?? '{}') as { tex: string; parts: FormulaPart[]; view?: PartsView; nouns?: Record<string, string> };
  const fig = parts_figure(d.tex, d.parts, { lang, paper: false, view: d.view, nouns: d.nouns });
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
  // (a frame whenever something it shows changes)
  p.start_live();
  // together, only the formula shows; apart, the stage opens to what is drawn (the text around steps aside)
  const H = canvas.height / dpr, band = F.bands().bottom;
  const show = (open: boolean) => { stage.style.height = `${open ? H : band}px`; };
  show(false);
  // (on the canvas too, for the tools that drive the page headlessly: page_shots)
  (canvas as HTMLCanvasElement & { mn_parts?: typeof F }).mn_parts = F;
  canvas.setAttribute('role', 'button');
  canvas.tabIndex = 0;
  const still = typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  const say = () => canvas.setAttribute('aria-label', F.open.peek() > 0.5 ? (lang === 'zh' ? '拆开的公式；点一张卡片再拆开它' : 'the formula taken apart; tap a card to take it apart in turn') : (lang === 'zh' ? '拆开这个公式' : 'take the formula apart'));
  say();
  // apart or together: a spring (the hand's momentum, when it lets go); once together again, back to the outer layer
  const settle = (to: number, v = 0) => {
    show(to > 0.5);
    if (still) { F.open.set(to, true); }
    else void p.spring(F.open, to, { v }).then(() => { if (F.open.peek() < 0.01 && !p.springing(F.open)) { F.layer.set(0, true); F.from.set(0, true); F.fade.set(1, true); } });
    say();
  };
  // a layer: from the one shown to the next, the cards moving between them
  const go = (to: { open: number; layer: number }) => {
    const n = Math.round(F.layer.peek());
    if (to.open > 0.5 && n !== to.layer) {
      F.from.set(n, true);
      F.layer.set(to.layer, true);
      F.fade.set(0, true);
      if (still) F.fade.set(1, true);
      else void p.tween(F.fade, 1, 0.8);
    }
    if ((F.open.peek() > 0.5) !== (to.open > 0.5) || p.springing(F.open)) settle(to.open);
    say();
  };
  // the hand: pull the formula up to take it apart, push it down to put it back; a tap takes it apart, or goes into
  // the card it lands on, or out
  let drag: { y0: number; e0: number; moved: boolean; last: [number, number][] } | null = null;
  const reach = () => Math.min(260, Math.max(120, H * 0.45));
  canvas.addEventListener('pointerdown', (e) => {
    if (e.button !== 0) return;
    drag = { y0: e.clientY, e0: F.open.peek(), moved: false, last: [[performance.now(), e.clientY]] };
    canvas.setPointerCapture(e.pointerId);
  });
  canvas.addEventListener('pointermove', (e) => {
    if (!drag) {
      // (a card that holds more, or the formula together, answers the hand)
      const hit = F.open.peek() > 0.5 ? F.block_at(p.point_of(e)) : null;
      canvas.style.cursor = F.open.peek() < 0.5 || (hit && hit.children.length) ? 'pointer' : 'default';
      return;
    }
    if (Math.abs(e.clientY - drag.y0) > 5) drag.moved = true;
    if (!drag.moved) return;
    canvas.style.cursor = 'grabbing';
    show(true);
    const v = Math.max(-0.08, Math.min(1.08, drag.e0 + (drag.y0 - e.clientY) / reach()));
    if (still) F.open.set(Math.max(0, Math.min(1, v)), true);
    else void p.spring(F.open, v);
    drag.last.push([performance.now(), e.clientY]);
    if (drag.last.length > 5) drag.last.shift();
  });
  const up = (e: PointerEvent) => {
    if (!drag) return;
    const dr = drag;
    drag = null;
    if (!dr.moved) {
      const to = F.tap(p.point_of(e));
      if (to) go(to);
      return;
    }
    canvas.style.cursor = 'default';
    // where it goes: where the hand left it, carried on by how fast it was moving
    const a = dr.last[0], b = dr.last[dr.last.length - 1], vy = b[0] > a[0] ? (a[1] - b[1]) / (b[0] - a[0]) : 0;
    const to = F.open.peek() + vy * 0.35 > 0.5 ? 1 : 0;
    settle(to, (vy * 1000) / reach());
  };
  canvas.addEventListener('pointerup', up);
  canvas.addEventListener('pointercancel', () => { if (drag?.moved) settle(F.open.peek() > 0.5 ? 1 : 0); drag = null; });
  canvas.addEventListener('keydown', (e) => {
    const n = Math.round(F.layer.peek()), open = F.open.peek() > 0.5;
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      // together → the outer layer → each inside in turn → together again
      go(!open ? { open: 1, layer: 0 } : n < F.opens.length ? { open: 1, layer: n + 1 } : { open: 0, layer: n });
    } else if (e.key === 'Escape' && open) {
      const f = F.focus_of(n);
      go(f ? { open: 1, layer: F.layer_of(f) } : { open: 0, layer: 0 });
    }
  });
}
