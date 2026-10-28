// Home (/): get back to learning and pick a course. Course pages (/<slug>):
// what the course is, how it is laid out, and where the learner is in it.
// (docs/SITE-STRUCTURE.md)
import { tr, type L10n, type Lang } from '@mathnim/core';
import { esc, math_html, t, ui_lang } from '@mathnim/present';
import { ScenePlayer } from 'manim-web/ext/player';
import { check_params, get_visual } from '@mathnim/visuals';
import { COURSES, all_lessons, course_path, lab_path, lab_setups, lesson_code, lesson_info, lesson_path, playable, unit_title, visible_lessons, visible_units, type Course, type CourseLesson } from '../course';
import { apply_theme } from '../lessons/best-angle/theme';
import type { Route } from '../router';
import { ready_visuals } from '../cjk_font';
import { last_in_course, learner, lesson_status, map_seen, set_map_seen } from '../store';
import { studio_available } from '../account';

/** About how long: "45 min", "1.5 h". */
const duration = (min: number) => (min < 60 ? t('minutes', { n: min }) : t('hours', { n: Math.round((min / 60) * 2) / 2 }));
// only what the course page shows: no hidden units, no AI-generated syllabus entries (for now)
const lessons_of = visible_lessons;
const done_in = (c: Course) => lessons_of(c).filter((l) => lesson_status(l.id) === 'done').length;
/** Has the learner begun this course? (A course with no lessons yet has not been begun.) */
const started = (c: Course) => lessons_of(c).length > 0 && (!!last_in_course(c) || lessons_of(c).some((l) => lesson_status(l.id) !== 'new'));
/** The lesson to continue with: the one opened last in the course, else the first not finished. */
function current_lesson(c: Course): CourseLesson | undefined {
  const all = lessons_of(c);
  return all.find((l) => l.id === last_in_course(c)) ?? all.find((l) => lesson_status(l.id) !== 'done') ?? all[0];
}
const thumb = (lesson_id: string, cls = 'thumb') => `<canvas class="${cls}" width="640" height="360" data-lesson="${esc(lesson_id)}" aria-hidden="true"></canvas>`;
/** A course's cover: an image under public/, or a lesson's thumbnail. */
function cover(c: Course): string {
  if (c.cover?.startsWith('/')) return `<img class="thumb" src="${esc(c.cover.replace('{lang}', ui_lang()))}" alt="" loading="lazy">`;
  const l = lessons_of(c).find((x) => x.id === c.cover) ?? lessons_of(c)[0];
  return l ? thumb(l.id) : '<div class="thumb empty" aria-hidden="true"></div>'; // (a course still being written)
}
const progress_bar = (k: number, n: number) => `<div class="course-progress" aria-hidden="true"><i style="width:${Math.round((k / Math.max(1, n)) * 100)}%"></i></div>`;
const accent = (c: Course) => (c.accent ? ` style="--course-accent:${esc(c.accent)}"` : '');

function course_card(c: Course): string {
  const lang = ui_lang();
  const all = lessons_of(c), done = done_in(c);
  // a course already begun says where to pick up, right on its card (no separate "continue" section)
  const go = started(c) ? current_lesson(c) : undefined;
  return `
    <article class="card course-card"${accent(c)}>
      <a class="course-link" href="${course_path(c)}">
        ${cover(c)}
        <div class="course-name">${math_html(tr(c.title, lang))}</div>
        ${c.summary ? `<div class="muted course-sum">${math_html(tr(c.summary, lang))}</div>` : ''}
        <div class="meta"><span>${esc(t('course_size', { n: all.length, d: duration(all.reduce((n, l) => n + l.minutes, 0)) }))}</span><span>${done ? esc(t('course_done', { k: done, n: all.length })) : ''}</span></div>
        ${go ? progress_bar(done, all.length) : ''}
      </a>
      ${go ? `<a class="course-resume" href="${lesson_path(go.id)}"><span class="muted">${esc(t('continue'))}</span><b>${math_html(tr(go.title, lang))}</b><span aria-hidden="true">→</span></a>` : ''}
    </article>`;
}

/** Home: every course, grouped by category; a course already begun shows where to pick up on its card. */
export function home(root: HTMLElement): void {
  const lang = ui_lang();
  // a course being built (hidden) is not listed yet; its pages open by their address
  const shown = COURSES.filter((c) => !c.hidden);
  const groups: { name: string; courses: Course[] }[] = [];
  for (const c of shown) {
    const name = c.category ? tr(c.category, lang) : t('all_courses');
    const g = groups.find((x) => x.name === name) ?? (groups.push({ name, courses: [] }), groups[groups.length - 1]);
    g.courses.push(c);
  }
  root.innerHTML = groups.map((g) => `<h2 class="section-title">${esc(g.name)}</h2><div class="catalog">${g.courses.map(course_card).join('')}</div>`).join('')
    + (studio_available() ? `<a class="studio-entry" href="/studio">＋ ${esc(t('studio_entry'))}</a>` : '');
  draw_thumbnails(root);
}

/** What a lesson is made of, in words ("动画 · 交互 · 推导 · 代码"); reading and questions go without saying. */
const KIND_WORD: [string, string][] = [['scene', 'kw_scene'], ['explore', 'kw_explore'], ['derive', 'kw_derive'], ['code', 'kw_code']];
function kinds_text(l: CourseLesson): string {
  const kinds = lesson_info(l)?.kinds ?? [];
  return KIND_WORD.filter(([k]) => kinds.includes(k)).map(([, key]) => t(key)).join(' · ');
}
const STATUS: Record<string, [string, string]> = { done: ['✓', 'status_done'], started: ['●', 'status_started'], new: ['○', 'status_new'] };

/** A course page: header (start/continue, progress, a feature picture), what you will be able to do, its units. */
export function course_page(root: HTMLElement, route: Route): () => void {
  if (route.page !== 'course') return () => {};
  const c = route.course;
  const lang = ui_lang();
  const all = lessons_of(c), done = done_in(c);
  const go = current_lesson(c);
  const resumed = started(c);
  const langs = all.some((l) => (lesson_info(l)?.langs.length ?? 0) > 1) ? '中 / EN' : 'EN';
  const still = c.feature?.replace('{lang}', lang);
  const cover_box = c.cover_motion || still;
  // one quiet line above the title: category · size · languages
  const meta = [
    c.category ? `<b>${esc(tr(c.category, lang))}</b>` : '',
    all.length ? esc(t('course_size', { n: all.length, d: duration(all.reduce((n, l) => n + l.minutes, 0)) })) : '',
    all.length ? langs : '',
  ].filter(Boolean).join(' · ');
  root.innerHTML = `
    <a class="backlink" href="/">‹ ${esc(t('all_courses'))}</a>
    <header class="card course-hero"${accent(c)}>
      <div class="hero-top">
        <div class="hero-text">
          ${meta ? `<p class="hero-meta">${meta}</p>` : ''}
          <h1>${math_html(tr(c.title, lang))}</h1>
          
          ${go ? `<div class="row hero-go">
            <a class="mn-btn primary" href="${lesson_path(go.id)}">${math_html(t(resumed ? 'continue_lesson' : 'start_lesson', { title: tr(go.title, lang) }))}</a>
            ${done ? `<span class="muted">${esc(t('course_done', { k: done, n: all.length }))}</span>` : ''}
          </div>` : `<p class="hero-coming">${esc(t('course_coming'))}</p>`}
        </div>
        ${cover_box ? `<figure class="hero-feature" title="${esc(t('cover_replay'))}">${still ? `<img src="${esc(still)}" alt="" onerror="this.remove()">` : ''}<canvas width="1280" height="720" aria-label="${esc(tr(c.title, lang))}"></canvas></figure>` : ''}
      </div>
      ${go ? milestones(c, go, lang) : ''}
      ${review_line(c)}
    </header>
    ${about(c, lang)}
    <div class="units">${visible_units(c).map((u) => `
      <section class="unit"><h3>${math_html(unit_title(c, u, lang))}</h3><div class="lessons">${u.lessons.map((l) => {
        const st = lesson_status(l.id);
        return `
        <a class="card lesson-card status-${st}" href="${lesson_path(l.id)}" title="${esc(kinds_text(l))}">
          ${thumb(l.id)}
          <div class="lesson-title"><span class="status" role="img" aria-label="${esc(t(STATUS[st][1]))}">${STATUS[st][0]}</span>${math_html(tr(l.title, lang))}</div>
          <div class="meta"><span>${esc(t('minutes', { n: l.minutes }))}</span></div>
        </a>`;
      }).join('')}</div></section>`).join('')}
      ${c.labs ? `<section class="unit" id="labs"><h3>${esc(t('labs'))}</h3>${c.labs.length ? `<div class="lessons labs">${c.labs.map((l) => lab_card(c, l, lang)).join('')}</div>` : `<div class="card muted labs-soon">${esc(t('labs_soon'))}</div>`}</section>` : ''}
    </div>`;
  draw_thumbnails(root);
  celebrate(root, c);
  up_next(root, c);
  const stop_crown = play_crown(root, c);
  const stop_cover = play_cover(root, c);
  return () => {
    stop_cover();
    stop_crown();
  };
}

const CHECK = '<svg viewBox="0 0 12 12"><path d="M2.8 6.3l2.2 2.2 4.3-4.7"/></svg>';
const CROWN = '<svg viewBox="0 0 24 20"><path d="M3 17V6.5l5 4.5 4-7 4 7 5-4.5V17z"/></svg>';

/** Back from a finished lesson (?after=<lesson>): the next lesson's card is marked "next" and scrolled to, after the map. */
function up_next(root: HTMLElement, c: Course): void {
  const params = new URLSearchParams(location.search);
  const after = params.get('after');
  if (!after) return;
  history.replaceState(null, '', location.pathname);
  const all = lessons_of(c);
  const at = all.findIndex((l) => l.id === after);
  const next = all.slice(at + 1).find((l) => lesson_status(l.id) !== 'done') ?? all.find((l) => lesson_status(l.id) !== 'done');
  const card = next && root.querySelector<HTMLElement>(`.lesson-card[href="${lesson_path(next.id)}"]`);
  if (!card) return;
  card.classList.add('up-next');
  card.insertAdjacentHTML('beforeend', `<span class="up-next-tag">${esc(t('up_next'))} →</span>`);
  setTimeout(() => card.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'center' }), 1200);
}

/** Questions of this course that are due again (spaced repetition): one quiet line under the map, only when there are some. */
function review_line(c: Course): string {
  const mine = new Set(lessons_of(c).map((l) => l.id));
  const due = learner.due().filter((r) => mine.has(r.id.split('/')[0])).length;
  return due ? `<a class="hero-review" href="/review">${esc(t('reviews_due', { n: due }))} →</a>` : '';
}

/** The learning map, a level route: the course's units as stops, named as on the page below (a check once all their
 *  lessons are done, the next one pulsing; each opens its first lesson not yet done), and a crown at the end, won by
 *  finishing every lesson. */
function milestones(c: Course, go: CourseLesson | undefined, lang: Lang): string {
  const all = lessons_of(c);
  const units = visible_units(c);
  const cleared = (u: (typeof units)[number]) => u.lessons.every((l) => lesson_status(l.id) === 'done');
  // the next stop: the unit of the lesson to continue with, unless it is cleared; else the first not cleared
  const here = units.find((u) => u.lessons.some((l) => l.id === go?.id));
  const next = here && !cleared(here) ? here : units.find((u) => !cleared(u));
  const won = done_in(c) === all.length;
  const goal = won ? t('map_won') : t('map_goal', { n: all.length });
  return `<ol class="milestones">${units.map((u) => {
    const st = cleared(u) ? 'done' : u === next ? 'next' : 'todo';
    const to = u.lessons.find((l) => lesson_status(l.id) !== 'done') ?? u.lessons[0];
    return `<li class="ms ${st}" data-ms="${esc(u.id)}"><a href="${lesson_path(to.id)}" title="${esc(tr(to.title, lang))}"><i aria-hidden="true">${CHECK}</i><span>${math_html(unit_title(c, u, lang))}</span></a></li>`;
  }).join('')}<li class="goal${won ? ' won' : ''}" data-ms="crown" title="${esc(goal)}" role="img" aria-label="${esc(goal)}">${CROWN}</li></ol>`;
}

/** Clearing a stop should feel like clearing a level: the stops cleared since the learner last saw this map light up
 *  in turn (the node pops, its check draws, the route runs on), and the crown when the course is complete. Once each.
 *  Otherwise the crown gives a little wiggle as the page opens: the prize is waiting. */
function celebrate(root: HTMLElement, c: Course): void {
  const map = root.querySelector('.milestones');
  if (!map) return;
  const cleared = [...map.querySelectorAll<HTMLElement>('.ms.done, .goal.won')];
  const seen = map_seen(c.id);
  set_map_seen(c.id, cleared.map((li) => li.dataset.ms!));
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const fresh = cleared.filter((li) => !seen.includes(li.dataset.ms!));
  const crown = map.querySelector<HTMLElement>('.goal');
  if (crown && !fresh.includes(crown)) {
    crown.classList.add('wiggle');
    crown.style.setProperty('--w', `${fresh.length ? 350 + fresh.length * 550 + 250 : 600}ms`);
  }
  fresh.forEach((li, k) => {
    const d = 350 + k * 550;
    li.classList.add('fresh');
    li.style.setProperty('--d', `${d}ms`);
    // sparks from the node
    const host = li.querySelector('a') ?? li;
    const n = li.classList.contains('goal') ? 12 : 8;
    for (let j = 0; j < n; j++) {
      const s = document.createElement('b');
      s.className = 'spark';
      const a = (j / n) * Math.PI * 2 + k;
      const r = li.classList.contains('goal') ? 30 : 22;
      s.style.cssText = `--dx:${(Math.cos(a) * r).toFixed(1)}px;--dy:${(Math.sin(a) * r).toFixed(1)}px;animation-delay:${d + 180}ms`;
      s.addEventListener('animationend', () => s.remove());
      host.append(s);
    }
  });
}

/**
 * The crown can be picked up. Before the course is done it is on a rubber band: pulled, it stretches and springs back,
 * and a light runs along the route from the next stop to it (that far to go). Once won it comes free: dropped on the
 * course's title it sits there (kept), and a click sends it home.
 */
function play_crown(root: HTMLElement, c: Course): () => void {
  const goal = root.querySelector<HTMLElement>('.milestones .goal');
  const svg = goal?.querySelector<SVGSVGElement>('svg');
  const title = root.querySelector<HTMLElement>('.course-hero h1');
  if (!goal || !svg || !title) return () => {};
  const won = goal.classList.contains('won');
  const key = `mathnim.crown.${c.id}`;
  const still = matchMedia('(prefers-reduced-motion: reduce)').matches;
  let worn: HTMLElement | null = null;
  const wear = (fly_from?: DOMRect) => {
    const b = document.createElement('button');
    b.type = 'button';
    worn = b;
    worn.className = 'title-crown';
    worn.setAttribute('aria-label', t('map_won'));
    worn.innerHTML = CROWN;
    title.append(worn);
    goal.classList.add('away');
    try {
      localStorage.setItem(key, 'worn');
    } catch {
      /* no storage */
    }
    if (fly_from && !still) {
      const to = worn.getBoundingClientRect();
      worn.animate([{ transform: `translate(${fly_from.left - to.left}px,${fly_from.top - to.top}px) rotate(0)` }, { transform: 'translate(0,-10px) rotate(-30deg)', offset: 0.7 }, { transform: 'rotate(-14deg)' }], { duration: 650, easing: 'cubic-bezier(.3,1.4,.5,1)' });
    }
    worn.onclick = () => {
      const from = worn!.getBoundingClientRect();
      worn!.remove();
      worn = null;
      goal.classList.remove('away');
      try {
        localStorage.removeItem(key);
      } catch {
        /* no storage */
      }
      const to = svg.getBoundingClientRect();
      if (!still) svg.animate([{ transform: `translate(${from.left - to.left}px,${from.top - to.top}px) rotate(-14deg)` }, { transform: 'none' }], { duration: 600, easing: 'cubic-bezier(.3,1.3,.5,1)' });
    };
  };
  if (won) {
    try {
      if (localStorage.getItem(key) === 'worn') wear();
    } catch {
      /* no storage */
    }
  }
  /** A light from the next stop along the route to the crown. */
  const run_light = () => {
    const map = goal.parentElement!;
    const from = map.querySelector<HTMLElement>('.ms.next i') ?? map.querySelector<HTMLElement>('.ms:not(.done) i');
    if (!from || still) return;
    const m = map.getBoundingClientRect(), a = from.getBoundingClientRect(), b = svg.getBoundingClientRect();
    const dot = document.createElement('b');
    dot.className = 'route-light';
    map.append(dot);
    const at = (r: DOMRect) => `translate(${r.left + r.width / 2 - m.left}px,${r.top + r.height / 2 - m.top}px)`;
    dot.animate([{ transform: at(a), opacity: 0 }, { opacity: 1, offset: 0.15 }, { transform: at(b), opacity: 1, offset: 0.9 }, { transform: at(b), opacity: 0 }], { duration: 900, easing: 'cubic-bezier(.5,0,.3,1)' }).onfinish = () => dot.remove();
  };
  let start: { x: number; y: number } | null = null, moved = false;
  const down = (e: PointerEvent) => {
    start = { x: e.clientX, y: e.clientY };
    moved = false;
    goal.setPointerCapture(e.pointerId);
    goal.classList.remove('wiggle', 'fresh'); // (their animations would hold the crown in place)
    goal.classList.add('held');
  };
  const move = (e: PointerEvent) => {
    if (!start) return;
    const dx = e.clientX - start.x, dy = e.clientY - start.y;
    if (!moved && Math.hypot(dx, dy) > 4) {
      moved = true;
      if (!won) run_light();
    }
    // locked: it stretches less the further it goes (a rubber band); won: it follows the pointer
    const k = won ? 1 : 1 / (1 + Math.hypot(dx, dy) / 60);
    svg.style.transform = `translate(${dx * k}px,${dy * k}px) rotate(${Math.max(-25, Math.min(25, dx * k * 0.4))}deg)`;
  };
  const up = (e: PointerEvent) => {
    if (!start) return;
    goal.classList.remove('held');
    const dropped = { x: e.clientX, y: e.clientY };
    start = null;
    const was = svg.style.transform;
    svg.style.transform = '';
    if (!moved) {
      // a click: the crown hops, and the light shows the way
      if (!still) svg.animate([{ transform: 'none' }, { transform: 'translateY(-10px) rotate(-8deg)', offset: 0.4 }, { transform: 'none' }], { duration: 450, easing: 'cubic-bezier(.3,1.5,.5,1)' });
      if (!won) run_light();
      return;
    }
    const r = title.getBoundingClientRect();
    if (won && !worn && dropped.x >= r.left && dropped.x <= r.right && dropped.y >= r.top - 20 && dropped.y <= r.bottom + 20) {
      const from = svg.getBoundingClientRect();
      wear(new DOMRect(from.left + (dropped.x - from.left) - from.width / 2, from.top + (dropped.y - from.top) - from.height / 2, from.width, from.height));
      return;
    }
    // back to its place, wobbling
    if (!still) svg.animate([{ transform: was }, { transform: 'translate(0,0) rotate(-10deg)', offset: 0.45 }, { transform: 'rotate(7deg)', offset: 0.65 }, { transform: 'rotate(-3deg)', offset: 0.82 }, { transform: 'none' }], { duration: 700, easing: 'ease-out' });
  };
  goal.addEventListener('pointerdown', down);
  goal.addEventListener('pointermove', move);
  goal.addEventListener('pointerup', up);
  goal.addEventListener('pointercancel', up);
  return () => worn?.remove();
}

/** The moving cover: play the course's animation once (muted), rest on its last frame, replay on click. */
function play_cover(root: HTMLElement, c: Course): () => void {
  const fig = root.querySelector<HTMLElement>('.hero-feature');
  const canvas = fig?.querySelector('canvas');
  const m = c.cover_motion;
  let player: ScenePlayer | null = null;
  let alive = true;
  if (!fig || !canvas || !m || matchMedia('(prefers-reduced-motion: reduce)').matches) return () => {};
  void (async () => {
    try {
      await Promise.all([m.pack?.(), ready_visuals()]);
      const v = get_visual(m.visual);
      if (!v || !alive) return;
      const raw = 'lang' in v.params ? { ...m.params, lang: ui_lang() } : { ...m.params };
      player = new ScenePlayer(v.scene(check_params(v, raw).params), canvas, { audio: false });
      apply_theme(player);
      await player.load();
      if (!alive) return;
      if (m.rate) player.set_rate(m.rate);
      fig.classList.add('live');
      player.play();
      canvas.onclick = () => {
        player?.seek_time(0);
        player?.play();
      };
    } catch (e) {
      console.warn('course cover', e); // the still (or nothing) stays
    }
  })();
  return () => {
    alive = false;
    player?.pause();
  };
}

/** Who it is for, what to know first, what you will be able to do: one disclosure, closed by default (the page leads with the lessons). */
function about(c: Course, lang: Lang): string {
  const p = c.prerequisites;
  if (!p && !c.outcomes?.length) return '';
  // one sentence on who it is for and what to know, then two short lists in the same type
  const list = (title: string, items: string[]) => `<section class="about-sec"><h3>${esc(title)}</h3><ul>${items.join('')}</ul></section>`;
  return `<details class="card about-course">
    <summary>${esc(t('about_course'))}</summary>
    <div class="about-body">
      ${p ? `<p class="about-lead">${math_html(tr(p.summary, lang))}</p>` : ''}
      ${p?.links.length ? list(t('prereq_links'), p.links.map((k) => `<li><a href="${esc(tr(k.url, lang))}" target="_blank" rel="noopener">${esc(tr(k.title, lang))}</a>${k.note ? `<span class="muted"> · ${esc(tr(k.note, lang))}</span>` : ''}</li>`)) : ''}
      ${c.outcomes?.length ? list(t('outcomes'), c.outcomes.map((o) => `<li>${math_html(tr(o, lang))}</li>`)) : ''}
    </div>
  </details>`;
}

/** A lab on the course page: what it is, where it runs, and the lesson to finish first. */
function lab_card(c: Course, l: NonNullable<Course['labs']>[number], lang: Lang): string {
  const after = l.after ? lessons_of(c).find((x) => x.id === l.after) : undefined;
  return `
    <a class="card lab-card" href="${lab_path(c, l.slug)}">
      <div class="lab-head"><span class="lab-id">${esc(l.id)}</span><span class="lesson-title">${math_html(tr(l.title, lang))}</span></div>
      <div class="muted lab-sum">${math_html(tr(l.summary, lang))}</div>
      <div class="meta"><span>${esc([lab_setups(l, lang), l.minutes ? t('minutes', { n: l.minutes }) : ''].filter(Boolean).join(' · '))}</span>${after ? `<span title="${esc(tr(after.title, lang))}">${esc(t('lab_after', { l: lesson_code(after.id) }))}</span>` : ''}</div>
    </a>`;
}

/**
 * Each card shows the final frame of its lesson's first scene, rendered live by manim-web.
 * Rendering a scene means running its whole timeline, so cards are drawn lazily: only
 * when they scroll near the viewport, one at a time with a pause in between (the page
 * stays responsive), and each finished frame is kept so switching courses or coming
 * back to the home page redraws it instantly.
 */
const THUMBS = new Map<string, CanvasImageSource>();
const queue: HTMLCanvasElement[] = [];
let drawing = false;

function draw_thumbnails(root: HTMLElement): void {
  const canvases = [...root.querySelectorAll<HTMLCanvasElement>('canvas.thumb')];
  const lazy: HTMLCanvasElement[] = [];
  for (const c of canvases) {
    const hit = THUMBS.get(thumb_key(c));
    const cl = all_lessons().find((l) => l.id === c.dataset.lesson);
    const info = cl && lesson_info(cl);
    if (hit) c.getContext('2d')!.drawImage(hit, 0, 0, c.width, c.height);
    // a lesson of text pages has no scene to wait for: its page-style card is drawn at once
    else if (cl && info && !info.has_scene) {
      c.classList.add('empty');
      text_thumbnail(c, { title: cl.title, kinds: info.kinds });
    } else lazy.push(c);
  }
  if (!lazy.length) return;
  // pre-rendered images (npm run thumbs) first; only lessons without one are rendered live
  void Promise.all(lazy.map(prerendered)).then((ok) => observe(lazy.filter((_, i) => !ok[i])));
}

/** Draw public/thumbs/<lesson>.<lang>.webp (English for one-language lessons) if it exists. */
function prerendered(c: HTMLCanvasElement): Promise<boolean> {
  const cl = all_lessons().find((l) => l.id === c.dataset.lesson);
  const info = cl && lesson_info(cl);
  if (!cl || !info) return Promise.resolve(false);
  const lang = info.langs.length > 1 ? ui_lang() : 'en';
  return new Promise((done) => {
    const img = new Image();
    img.onload = () => {
      c.getContext('2d')!.drawImage(img, 0, 0, c.width, c.height);
      THUMBS.set(thumb_key(c), img);
      done(true);
    };
    img.onerror = () => done(false);
    img.src = `/thumbs/${cl.id}.${lang}.webp`;
  });
}

function observe(lazy: HTMLCanvasElement[]): void {
  if (!lazy.length) return;
  if (typeof IntersectionObserver === 'undefined') {
    queue.push(...lazy);
    void pump();
    return;
  }
  const io = new IntersectionObserver((entries) => {
    for (const e of entries) {
      if (!e.isIntersecting) continue;
      io.unobserve(e.target);
      queue.push(e.target as HTMLCanvasElement);
    }
    void pump();
  }, { rootMargin: '200px 0px' });
  for (const c of lazy) io.observe(c);
}

const thumb_key = (c: HTMLCanvasElement) => `${c.dataset.lesson}|${ui_lang()}`;
const idle = () => new Promise<void>((r) => ('requestIdleCallback' in window ? (window as any).requestIdleCallback(() => r(), { timeout: 300 }) : setTimeout(r, 30)));

async function pump(): Promise<void> {
  if (drawing) return;
  drawing = true;
  try {
    while (queue.length) {
      const c = queue.shift()!;
      if (!c.isConnected) continue; // the page was re-rendered meanwhile
      await idle();
      await draw_one(c);
      const keep = document.createElement('canvas');
      keep.width = c.width;
      keep.height = c.height;
      keep.getContext('2d')!.drawImage(c, 0, 0);
      THUMBS.set(thumb_key(c), keep);
    }
  } finally {
    drawing = false;
  }
}

async function draw_one(c: HTMLCanvasElement): Promise<void> {
  const cl = all_lessons().find((l) => l.id === c.dataset.lesson);
  const lesson = cl && playable(cl);
  const step = (cl?.thumb && lesson?.steps.find((s: any) => s.id === cl.thumb && s.scene)) || lesson?.steps.find((s: any) => s.scene);
  if (!step) {
    c.classList.add('empty');
    // a lesson not loaded yet (no pre-rendered image either) gets a page-like card from its data, without loading it
    const info = cl && lesson_info(cl);
    if (cl && info) text_thumbnail(c, { title: lesson?.title ?? cl.title, kinds: info.kinds });
    else {
      const g = c.getContext('2d')!;
      g.fillStyle = '#2f5bd3';
      g.globalAlpha = 0.85;
      g.font = '600 30px Inter, ui-sans-serif, system-ui, sans-serif';
      g.textAlign = 'center';
      g.fillText(t('thumb_ai'), c.width / 2, c.height / 2 + 10);
    }
    return;
  }
  try {
    await ready_visuals();
    const spec: any = (step as any).scene;
    const scene = /^class\b/.test(Function.prototype.toString.call(spec)) ? new spec() : spec({ vars: {}, rng: Math.random, lang: ui_lang() });
    const player = new ScenePlayer(scene, c, { audio: false });
    apply_theme(player);
    await player.load();
    player.show_end();
  } catch {
    c.classList.add('empty');
  }
}

/** A lesson made of text pages has no scene to show: draw a page with its kinds of steps instead. */
function text_thumbnail(c: HTMLCanvasElement, lesson: { title: L10n; kinds: string[] }): void {
  const g = c.getContext('2d')!;
  const W = c.width, H = c.height;
  // a sheet of paper with lines of text, a formula bar and a code block
  g.fillStyle = '#ffffff';
  g.strokeStyle = '#e3e3de';
  g.lineWidth = 2;
  g.beginPath();
  g.roundRect(W * 0.2, H * 0.12, W * 0.6, H * 0.8, 18);
  g.fill();
  g.stroke();
  const x0 = W * 0.27, w = W * 0.46;
  let y = H * 0.22;
  // the title, in up to two lines
  g.fillStyle = '#15171a';
  g.font = '700 22px Inter, ui-sans-serif, system-ui, "PingFang SC", sans-serif';
  g.textAlign = 'left';
  const words = tr(lesson.title, ui_lang()).split(/(?<=\s)|(?=[\u3400-\u9fff])/);
  const lines: string[] = [''];
  for (const wd of words) {
    if (g.measureText(lines[lines.length - 1] + wd).width > w && lines[lines.length - 1]) {
      if (lines.length === 2) {
        lines[1] = lines[1].trimEnd() + '…';
        break;
      }
      lines.push('');
    }
    lines[lines.length - 1] += wd;
  }
  for (const line of lines) {
    g.fillText(line.trim(), x0, y + 16);
    y += 30;
  }
  y += 8;
  g.fillStyle = '#c9ccd3';
  for (const f of [1, 0.92, 0.6]) {
    g.fillRect(x0, y, w * f, 9);
    y += 22;
  }
  y += 6;
  g.fillStyle = 'rgba(47,91,211,0.12)';
  g.fillRect(x0 + w * 0.15, y, w * 0.7, 30);
  y += 46;
  g.fillStyle = '#f6f7f9';
  g.fillRect(x0, y, w, H * 0.86 - y);
  const kinds = new Set(lesson.kinds);
  g.fillStyle = '#7c3aed';
  g.font = '600 15px ui-monospace, Menlo, monospace';
  g.textAlign = 'left';
  g.fillText([kinds.has('read') && 'read', kinds.has('derive') && 'derive', kinds.has('code') && 'code'].filter(Boolean).join(' · '), x0 + 14, y + 26);
}
