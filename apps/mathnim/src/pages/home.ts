// Home (/): get back to learning and pick a course. Course pages (/<slug>):
// what the course is, how it is laid out, and where the learner is in it.
// (docs/SITE-STRUCTURE.md)
import { tr, type L10n, type Lang } from '@mathnim/core';
import { esc, math_html, t, ui_lang } from '@mathnim/present';
import { ScenePlayer } from 'manim-web/ext/player';
import { COURSES, all_lessons, course_of, course_path, lab_path, lab_setups, lesson_code, lesson_info, lesson_path, playable, unit_title, visible_lessons, visible_units, type Course, type CourseLesson } from '../course';
import { apply_theme } from '../lessons/best-angle/theme';
import type { Route } from '../router';
import { last_in_course, last_lesson, learner, lesson_status } from '../store';

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
  return `
    <a class="card course-card" href="${course_path(c)}"${accent(c)}>
      ${cover(c)}
      <div class="course-name">${math_html(tr(c.title, lang))}</div>
      ${c.summary ? `<div class="muted course-sum">${math_html(tr(c.summary, lang))}</div>` : ''}
      <div class="meta"><span>${esc(t('course_size', { n: all.length, d: duration(all.reduce((n, l) => n + l.minutes, 0)) }))}</span><span>${done ? esc(t('course_done', { k: done, n: all.length })) : ''}</span></div>
      ${done ? progress_bar(done, all.length) : ''}
    </a>`;
}

/** Home: continue learning (courses already begun, reviews due), then every course. */
export function home(root: HTMLElement): void {
  const lang = ui_lang();
  // a course being built (hidden) is not listed yet; its pages open by their address
  const shown = COURSES.filter((c) => !c.hidden);
  const begun = shown.filter(started);
  const recent = course_of(last_lesson() ?? '');
  const first = recent && begun.includes(recent) ? recent : begun[0];
  const due = learner.due().length;
  let html = '';
  if (begun.length) {
    const cl = current_lesson(first)!; // (a begun course has lessons)
    const all = lessons_of(first);
    const k = all.indexOf(cl) + 1;
    html += `<h2 class="section-title">${esc(t('continue_learning'))}</h2>
      <a class="card resume-card" href="${lesson_path(cl.id)}"${accent(first)}>
        ${thumb(cl.id, 'thumb resume-thumb')}
        <div class="resume-text">
          <div class="muted resume-course">${math_html(tr(first.title, lang))} · ${esc(t('lesson_k_of_n', { k, n: all.length }))}</div>
          <div class="resume-title">${math_html(tr(cl.title, lang))}</div>
          ${progress_bar(done_in(first), all.length)}
          <span class="mn-btn primary">${esc(t('continue'))}</span>
        </div>
      </a>
      ${begun.filter((c) => c !== first).map((c) => {
        const l = current_lesson(c)!;
        return `<a class="card resume-row" href="${lesson_path(l.id)}"><span class="resume-row-text"><b>${math_html(tr(c.title, lang))}</b> · ${math_html(tr(l.title, lang))}</span><span class="mn-btn">${esc(t('continue'))}</span></a>`;
      }).join('')}
      ${due ? `<a class="card resume-row" href="/review"><span class="resume-row-text">${esc(t('reviews_due', { n: due }))}</span><span class="mn-btn">${esc(t('begin'))}</span></a>` : ''}`;
  }
  // a first-time visitor's list starts at the featured course (the courses after it follow, then the ones before)
  const f = shown.findIndex((c) => c.featured);
  const order = begun.length || f < 0 ? shown : [...shown.slice(f), ...shown.slice(0, f)];
  html += `<h2 class="section-title">${esc(t('all_courses'))}</h2><div class="catalog">${order.map(course_card).join('')}</div>`;
  root.innerHTML = html;
  draw_thumbnails(root);
}

/** What a lesson is made of, in words ("动画 · 交互 · 推导 · 代码"); reading and questions go without saying. */
const KIND_WORD: [string, string][] = [['scene', 'kw_scene'], ['explore', 'kw_explore'], ['derive', 'kw_derive'], ['code', 'kw_code']];
function kinds_html(l: CourseLesson): string {
  const kinds = lesson_info(l)?.kinds ?? [];
  return `<span class="kinds">${esc(KIND_WORD.filter(([k]) => kinds.includes(k)).map(([, key]) => t(key)).join(' · '))}</span>`;
}
const STATUS: Record<string, [string, string]> = { done: ['✓', 'status_done'], started: ['●', 'status_started'], new: ['○', 'status_new'] };

/** A course page: header (start/continue, progress, a feature picture), what you will be able to do, its units. */
export function course_page(root: HTMLElement, route: Route): void {
  if (route.page !== 'course') return;
  const c = route.course;
  const lang = ui_lang();
  const all = lessons_of(c), done = done_in(c);
  const go = current_lesson(c);
  const resumed = started(c);
  const langs = all.some((l) => (lesson_info(l)?.langs.length ?? 0) > 1) ? '中 / EN' : 'EN';
  const feature = c.feature?.replace('{lang}', lang);
  root.innerHTML = `
    <a class="backlink" href="/">‹ ${esc(t('all_courses'))}</a>
    <header class="card course-hero${feature ? ' with-feature' : ''}"${accent(c)}>
      <div class="hero-text">
        <h1>${math_html(tr(c.title, lang))}</h1>
        ${c.summary ? `<p class="hero-sum">${math_html(tr(c.summary, lang))}</p>` : ''}
        ${c.audience ? `<p class="muted hero-aud">${esc(t('audience', { a: tr(c.audience, lang) }))}</p>` : ''}
        ${c.prerequisites ? prerequisites(c, lang) : ''}
        ${all.length ? `<p class="muted hero-size">${esc(t('course_size', { n: all.length, d: duration(all.reduce((n, l) => n + l.minutes, 0)) }))} · ${langs}</p>` : ''}
        ${go ? `<div class="row hero-go">
          <a class="mn-btn primary" href="${lesson_path(go.id)}">${math_html(t(resumed ? 'continue_lesson' : 'start_lesson', { title: tr(go.title, lang) }))}</a>
          <span class="muted">${esc(t('course_done', { k: done, n: all.length }))}</span>
        </div>
        ${progress_bar(done, all.length)}` : `<p class="hero-coming">${esc(t('course_coming'))}</p>`}
      </div>
      ${feature ? `<figure class="hero-feature"><img src="${esc(feature)}" alt="${esc(t('feature_alt'))}" onerror="this.closest('header').classList.remove('with-feature');this.closest('figure').remove()"></figure>` : ''}
    </header>
    ${c.outcomes?.length ? `<section class="card outcomes"><h2 class="section-title">${esc(t('outcomes'))}</h2><ul>${c.outcomes.map((o) => `<li>${math_html(tr(o, lang))}</li>`).join('')}</ul></section>` : ''}
    <div class="units">${visible_units(c).map((u) => `
      <section class="unit"><h3>${math_html(unit_title(c, u, lang))}</h3><div class="lessons">${u.lessons.map((l) => {
        const st = lesson_status(l.id);
        return `
        <a class="card lesson-card status-${st}" href="${lesson_path(l.id)}">
          ${thumb(l.id)}
          <div class="lesson-title"><span class="status" role="img" aria-label="${esc(t(STATUS[st][1]))}">${STATUS[st][0]}</span>${math_html(tr(l.title, lang))}</div>
          <div class="meta">${kinds_html(l)}<span>${esc(t('minutes', { n: l.minutes }))}</span></div>
        </a>`;
      }).join('')}</div></section>`).join('')}
      ${c.labs ? `<section class="unit" id="labs"><h3>${esc(t('labs'))}</h3>${c.labs.length ? `<div class="lessons labs">${c.labs.map((l) => lab_card(c, l, lang)).join('')}</div>` : `<div class="card muted labs-soon">${esc(t('labs_soon'))}</div>`}</section>` : ''}
    </div>`;
  draw_thumbnails(root);
}

/** What to know first: a line or two, and starter material behind a disclosure. */
function prerequisites(c: Course, lang: Lang): string {
  const p = c.prerequisites!;
  return `<div class="hero-pre">
    <p class="hero-pre-sum">${math_html(tr(p.summary, lang))}</p>
    ${p.links.length ? `<details class="pre-links"><summary>${esc(t('prereq_links'))}</summary><ul>${p.links.map((k) => `
      <li><a href="${esc(tr(k.url, lang))}" target="_blank" rel="noopener">${esc(tr(k.title, lang))}</a>${k.note ? `<span class="muted"> · ${esc(tr(k.note, lang))}</span>` : ''}</li>`).join('')}</ul></details>` : ''}
  </div>`;
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
