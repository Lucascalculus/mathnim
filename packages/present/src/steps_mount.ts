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
 * Turn every formula taken apart under `root` (a ```parts fence, a math block with parts) into the engine's. A lever
 * beside it (the specimen's glass bead on an engraved rail) runs from together, to apart, through each layer on the
 * way in: drag the bead through them, or tap a stop. The formula answers the hand too: pull it up to go in, push it
 * down to come out, tap a card that holds more to open it, tap the paper to go back out; a spring finishes every
 * motion at a stop. One that does not typeset, or whose pieces are not in it, keeps its plain form.
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
  const fig = parts_figure(d.tex, d.parts, { lang, paper: false, view: d.view, nouns: d.nouns, lever: true });
  const F = fig.formula;
  if (F.issues.length) { el.dataset.issues = F.issues.join(' | '); return; }
  const stage = document.createElement('div');
  stage.className = 'mn-parts-stage';
  const canvas = document.createElement('canvas');
  stage.append(canvas);
  el.prepend(stage);
  const width = () => Math.max(220, Math.round(el.clientWidth || 360));
  let W = width();
  const dpr = Math.min(2, typeof devicePixelRatio !== 'undefined' ? devicePixelRatio : 1);
  const p = new FigurePlayer(fig, canvas, { audio: false, size: { w: W, dpr }, label: lang === 'zh' ? '公式' : 'formula' });
  await p.load();
  // the canvas as laid out: as tall as everything drawn apart, and where the formula ends while together
  let H = 0, band = 0;
  const sized = () => {
    canvas.style.width = `${canvas.width / dpr}px`;
    canvas.style.height = `${canvas.height / dpr}px`;
    H = canvas.height / dpr;
    band = F.bands().bottom;
  };
  sized();
  el.classList.add('mn-parts-live');
  // (a frame whenever something it shows changes)
  p.start_live();
  // together, only the formula shows; apart, the stage opens to what is drawn (the text around steps aside)
  let opened = false;
  const fit_stage = () => { stage.style.height = `${opened ? H : band}px`; };
  const show = (open: boolean) => { if (open !== opened) { opened = open; fit_stage(); } };
  fit_stage();
  // (on the canvas too, for the tools that drive the page headlessly: page_shots)
  (canvas as HTMLCanvasElement & { mn_parts?: typeof F }).mn_parts = F;
  canvas.setAttribute('role', 'button');
  canvas.tabIndex = 0;
  const zh = lang === 'zh', still = typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;

  // ---- where it is: a place on the lever's rail. 0 together, 1 apart (the outermost layer), then each layer on the
  // path; between two stops, on the way from one to the other
  let path = F.path_of(0);
  const stops = () => path.length + 1;
  const layer_at = (i: number) => path[Math.max(0, Math.min(path.length - 1, i - 1))];
  const name_at = (i: number) => (i === 0 ? (zh ? '合上' : 'together') : i === 1 ? (zh ? '拆开' : 'apart') : F.layer_name(layer_at(i), lang) ?? '');
  let at = 0, vel = 0, target = 0, busy = false, crossing = false, last = 0;
  const apply = () => {
    if (crossing) return;
    const q = Math.max(0, Math.min(stops() - 1, at)), j = Math.floor(q), f = q - j;
    if (q <= 1) { F.open.set(q, true); F.from.set(path[0], true); F.layer.set(path[0], true); F.fade.set(1, true); }
    else if (f < 1e-4) { F.open.set(1, true); F.from.set(layer_at(j), true); F.layer.set(layer_at(j), true); F.fade.set(1, true); }
    else { F.open.set(1, true); F.from.set(layer_at(j), true); F.layer.set(layer_at(j + 1), true); F.fade.set(f, true); }
    show(at > 0.002 || target > 0);
    place_bead();
  };
  // the spring that finishes a motion at a stop (critically damped: it never overshoots into the next layer)
  const R = 0.62, k = ((2 * Math.PI) / R) ** 2, c = (4 * Math.PI) / R;
  const step = (t: number) => {
    const dt = Math.min(0.05, (t - last) / 1000);
    last = t;
    const n = Math.max(1, Math.ceil(dt * 240));
    for (let i = 0; i < n; i++) { const h = dt / n; vel += (-k * (at - target) - c * vel) * h; at += vel * h; }
    if (Math.abs(at - target) < 1e-4 && Math.abs(vel) < 1e-3) { at = target; vel = 0; busy = false; apply(); say(); return; }
    apply();
    requestAnimationFrame(step);
  };
  const go_to = (i: number, v?: number) => {
    target = Math.max(0, Math.min(stops() - 1, i));
    if (v !== undefined) vel = v;
    if (still) { at = target; vel = 0; apply(); say(); return; }
    if (!busy) { busy = true; last = performance.now(); requestAnimationFrame(step); }
  };
  // to a layer off the path (a card on another branch): straight there, the path redrawn through it
  const cross_to = (n: number) => {
    const from = Math.round(F.layer.peek());
    path = F.path_of(n);
    build();
    at = target = path.indexOf(n) + 1;
    vel = 0;
    crossing = true;
    F.from.set(from, true);
    F.layer.set(n, true);
    F.fade.set(0, true);
    place_bead();
    const done = () => { crossing = false; apply(); say(); };
    if (still) { F.fade.set(1, true); done(); } else void p.tween(F.fade, 1, 0.8).then(done);
  };
  const stop_now = () => Math.round(at);

  // ---- the lever: the specimen's glass bead on an engraved rail, a stop for each place
  const lever = document.createElement('div');
  lever.className = 'mn-lever';
  const rail = document.createElement('div');
  rail.className = 'mn-lever-rail';
  const bead = document.createElement('div');
  bead.className = 'mn-lever-bead';
  bead.tabIndex = 0;
  bead.setAttribute('role', 'slider');
  bead.setAttribute('aria-label', zh ? '公式拆到哪一层' : 'how far the formula is taken apart');
  lever.append(rail, bead);
  el.append(lever);
  // (in the strip the figure keeps for it at the right of the stage, as the specimen's handle: inside the column, off
  // the margin, nothing drawn under it)
  const place_lever = () => {
    const room = F.lever_room();
    if (room) lever.style.left = `${room.x + (room.w - 36) / 2}px`;
  };
  place_lever();
  let gap = 20, top = 0;
  function build(): void {
    for (const x of [...lever.querySelectorAll('.mn-lever-stop')]) x.remove();
    const n = stops();
    gap = Math.max(14, Math.min(24, (band - 30) / Math.max(1, n - 1)));
    top = Math.max(4, (band - gap * (n - 1)) / 2);
    rail.style.top = `${top}px`;
    rail.style.height = `${gap * (n - 1)}px`;
    lever.style.height = `${top * 2 + gap * (n - 1)}px`;
    for (let i = 0; i < n; i++) {
      const b = document.createElement('button');
      b.className = 'mn-lever-stop';
      b.type = 'button';
      b.style.top = `${top + gap * (n - 1 - i)}px`;
      b.setAttribute('aria-label', name_at(i));
      b.innerHTML = `<span class="mn-lever-name"></span>`;
      b.firstElementChild!.textContent = name_at(i);
      b.addEventListener('click', (e) => { e.stopPropagation(); go_to(i); });
      lever.insertBefore(b, bead);
    }
    bead.setAttribute('aria-valuemin', '0');
    bead.setAttribute('aria-valuemax', String(n - 1));
  }
  function place_bead(): void {
    const n = stops(), q = Math.max(-0.1, Math.min(n - 0.9, at));
    bead.style.top = `${top + gap * (n - 1 - q)}px`;
    const i = stop_now();
    for (const [j, x] of [...lever.querySelectorAll<HTMLElement>('.mn-lever-stop')].entries()) x.classList.toggle('here', j === i);
  }
  function say(): void {
    const i = stop_now();
    bead.setAttribute('aria-valuenow', String(i));
    bead.setAttribute('aria-valuetext', name_at(i));
    canvas.setAttribute('aria-label', i > 0 ? (zh ? '拆开的公式；点一张卡片再拆开它' : 'the formula taken apart; tap a card to take it apart in turn') : (zh ? '拆开这个公式' : 'take the formula apart'));
  }
  build();
  place_bead();
  say();

  // ---- the hand on the bead: through the layers, then to the nearest stop, carried on by how fast it moved
  let grab: { y0: number; a0: number; per: number; last: [number, number][]; moved: boolean } | null = null;
  const press = (e: PointerEvent, per: number, on: HTMLElement) => {
    if (e.button !== 0 || crossing) return;
    busy = false;
    grab = { y0: e.clientY, a0: at, per, last: [[performance.now(), e.clientY]], moved: false };
    try { on.setPointerCapture(e.pointerId); } catch { /* (a pointer the browser no longer tracks) */ }
  };
  const drag = (e: PointerEvent) => {
    if (!grab) return false;
    if (Math.abs(e.clientY - grab.y0) > 4) grab.moved = true;
    if (!grab.moved) return true;
    lever.classList.add('on');
    at = Math.max(-0.06, Math.min(stops() - 0.94, grab.a0 + (grab.y0 - e.clientY) / grab.per));
    target = Math.round(at);
    apply();
    grab.last.push([performance.now(), e.clientY]);
    if (grab.last.length > 5) grab.last.shift();
    return true;
  };
  const release = () => {
    const g = grab!;
    grab = null;
    lever.classList.remove('on');
    // (held still before letting go: no momentum)
    const a = g.last[0], b = g.last[g.last.length - 1], v = b[0] > a[0] && performance.now() - b[0] < 90 ? ((a[1] - b[1]) / (b[0] - a[0])) * 1000 / g.per : 0;
    // (a flick carries it on, at most one stop)
    go_to(Math.round(at + Math.max(-1, Math.min(1, v * 0.08))), v);
  };
  bead.addEventListener('pointerdown', (e) => press(e, gap, bead));
  bead.addEventListener('pointermove', (e) => { drag(e); });
  bead.addEventListener('pointerup', () => { if (grab) { if (grab.moved) release(); else grab = null; } });
  bead.addEventListener('keydown', (e) => {
    const i = stop_now(), to = e.key === 'ArrowUp' || e.key === 'ArrowRight' ? i + 1 : e.key === 'ArrowDown' || e.key === 'ArrowLeft' ? i - 1 : e.key === 'Home' ? 0 : e.key === 'End' ? stops() - 1 : null;
    if (to === null) return;
    e.preventDefault();
    go_to(to);
  });

  // ---- the hand on the formula: pull it up to go in, push it down to come out; a tap takes it apart, opens the card
  // it lands on, or goes back out
  let reach = Math.min(200, Math.max(120, H * 0.4));
  canvas.addEventListener('pointerdown', (e) => press(e, reach, canvas));
  canvas.addEventListener('pointermove', (e) => {
    if (drag(e)) { if (grab?.moved) canvas.style.cursor = 'grabbing'; return; }
    // (a card that holds more, or the formula together, answers the hand)
    const hit = at > 0.5 ? F.block_at(p.point_of(e)) : null;
    canvas.style.cursor = at < 0.5 || (hit && hit.children.length) ? 'pointer' : 'default';
  });
  canvas.addEventListener('pointerup', (e) => {
    if (!grab) return;
    if (grab.moved) { canvas.style.cursor = 'default'; release(); return; }
    grab = null;
    const to = F.tap(p.point_of(e));
    if (!to) return;
    if (to.open < 0.5) return go_to(0);
    const i = path.indexOf(to.layer);
    if (i >= 0) go_to(i + 1);
    else cross_to(to.layer);
  });
  canvas.addEventListener('pointercancel', () => { if (grab?.moved) release(); grab = null; });
  canvas.addEventListener('keydown', (e) => {
    const i = stop_now();
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); go_to(i < stops() - 1 ? i + 1 : 0); }
    else if (e.key === 'Escape' && i > 0) go_to(i - 1);
  });

  // ---- the column's width changes (a window made narrower or wider): laid out again for it, at the place it was
  if (typeof ResizeObserver === 'undefined') return;
  let raf = 0;
  const ro = new ResizeObserver(() => {
    if (!el.isConnected) return ro.disconnect();
    if (raf) return;
    raf = requestAnimationFrame(() => {
      raf = 0;
      const w2 = width();
      if (Math.abs(w2 - W) < 2) return;
      W = w2;
      p.opts.size = { w: W, dpr };
      if (!p.fit()) return;
      p.draw(true);
      sized();
      place_lever();
      build();
      place_bead();
      fit_stage();
      reach = Math.min(200, Math.max(120, H * 0.4));
    });
  });
  ro.observe(el);
}
