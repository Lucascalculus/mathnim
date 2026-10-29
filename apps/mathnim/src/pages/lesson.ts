// One lesson: the player, questions about it, or generating it from the syllabus.
import { generate_lesson, lesson_from_generated, worker_validator } from '@mathnim/ai';
import { tr } from '@mathnim/core';
import { LessonView, esc, fit_display_math, math_html, t, ui_lang } from '@mathnim/present';
import { apply_palette, set_theme } from '@mathnim/visuals';
import { apply_theme } from '../lessons/best-angle/theme';
import { cache_generation, course_of, course_path, ensure_lesson, find_lesson, lab_path, lab_setups, lesson_code, lesson_path, playable, visible_lessons, type CourseLesson } from '../course';
import { load_lab } from '../labs';
import { render_lab } from './lab';
import { mount_outline } from '../outline';
import { navigate, type Route } from '../router';
import { ready_visuals } from '../cjk_font';
import { enable_dom_tex } from '../tex_dom';
import { has_model, load_settings, provider } from '../settings';
import { AskRail } from '../side_chat';
import { learner, log, remember_last } from '../store';
import { is_relocalizing } from '../shell';
import { text_grader, visual_resolver } from '../lesson_services';

export async function lesson_page(root: HTMLElement, route: Route): Promise<() => void> {
  const cl = route.page === 'lesson' ? find_lesson(route.lesson) : undefined;
  if (!cl) {
    root.innerHTML = `<div class="card">${esc(t('not_found'))} <a href="/">${esc(t('back'))}</a></div>`;
    return () => {};
  }
  const here = lesson_path(cl.id);
  // a lesson loaded on demand (the fine-tuning course): its code, visuals and data arrive now
  if (cl.load && !cl.lesson) {
    root.innerHTML = `<div class="card muted" style="max-width:620px;margin:40px auto;text-align:center">${esc(t('loading_lesson'))}</div>`;
    try {
      await ensure_lesson(cl);
    } catch (e) {
      console.warn('lesson chunk failed to load', e);
      root.innerHTML = `<div class="card" style="max-width:620px;margin:40px auto">${esc(t('load_failed'))} <a href="${here}?retry=${Date.now()}">${esc(t('try_again'))}</a></div>`;
      return () => {};
    }
    if (location.pathname !== here) return () => {}; // the learner went elsewhere meanwhile
    root.innerHTML = '';
  }
  const lesson = playable(cl);
  if (!lesson) return generate_view(root, cl);
  // (Chinese labels need their font, loaded the first time a visual is drawn; prompts and options need MathJax)
  await Promise.all([ready_visuals(), enable_dom_tex()]);
  if (location.pathname !== here) return () => {};
  remember_last(cl.id);
  const host = document.createElement('div');
  host.className = 'lesson-main';
  const layout = document.createElement('div');
  layout.append(host);
  root.append(layout);
  const params = new URLSearchParams(location.search);
  const mode = params.get('mode') === 'game' || params.get('mode') === 'essay' ? (params.get('mode') as 'game' | 'essay') : undefined;
  // a lesson drawn with the named palette may ask for the dark (3b1b-like) theme
  const dark_lesson = lesson.theme === 'dark';
  set_theme(dark_lesson ? 'dark' : 'light');
  // the next lesson of the same course (in the order of its page) is the end card's main action
  const course = course_of(cl.id);
  const in_course = course ? visible_lessons(course) : [];
  const at = in_course.findIndex((l) => l.id === cl.id);
  const after = at >= 0 ? in_course[at + 1] : undefined;
  // the lab that reproduces this lesson on a real model, offered on the end card
  const lab = course?.labs?.find((l) => l.after === cl.id);
  const lang = ui_lang();
  // the tutor in the side column: a small card that grows as the learner asks
  const rail = new AskRail(cl, lesson);
  const view = new LessonView(host, lesson, {
    learner, log, dev: params.has('dev'), dark: load_settings().dark || dark_lesson, on_player: dark_lesson ? apply_palette : apply_theme, mode,
    lang: ui_lang(), visuals: visual_resolver, grade_text: text_grader(),
    next: after ? { title: after.title, href: lesson_path(after.id) } : undefined,
    remember: true,
    back: course ? course_path(course) : '/',
    navigate,
    lab: course && lab ? { title: t('lab_try', { id: lab.id, title: tr(lab.title, lang) }), note: [lab_setups(lab, lang), t('lab_card_note')].filter(Boolean).join(' · '), href: lab_path(course, lab.slug) } : undefined,
    rail: rail.el,
    // the end of a lesson: a moment of "lesson complete", then back to the course, where its map moves on and the
    // next lesson waits (the course page scrolls to it)
    on_finished: course
      ? () => {
          host.innerHTML = `<div class="lesson-done"><span class="ld-check" aria-hidden="true">✓</span><b>${esc(t('lesson_complete'))}</b></div>`;
          setTimeout(() => location.pathname === here && navigate(`${course_path(course)}?after=${encodeURIComponent(cl.id)}`), 1500);
        }
      : undefined,
    // a passage selected on the page: asked about on the card
    help: (ask) => rail.open(ask),
    // phones: the lesson bar's Ask opens the conversation over the page
    ask: () => rail.toggle_sheet(),
  });
  rail.attach(view);
  // the outline of the course with this lesson's steps (docked on wide screens)
  const outline = course ? mount_outline(layout, host, { course, current: cl, lesson, view }) : null;
  // the head of the lesson: "<course> ›" back to the course page, then the title; the outline button and the progress
  // are in the lesson bar at the foot of the screen
  if (course) {
    const crumb = document.createElement('nav');
    crumb.className = 'crumb';
    crumb.innerHTML = `<a href="${course_path(course)}">${math_html(tr(course.title, ui_lang()))}</a>`;
    view.el.head.prepend(crumb);
  }
  if (outline) (view.el.bar_start ?? view.el.head).prepend(outline.toggle);
  (window as any).mathnim_view = view; // for debugging in the console
  // a link to a step opens it; otherwise the lesson resumes where the learner left it
  // (not awaited: the page hands back its cleanup at once, so leaving mid-scene stops it)
  void (params.get('step') ? view.start(params.get('step')!) : view.resume()).catch((e) => console.warn('lesson start', e));
  return () => {
    // switching language re-renders this page: come back to the same step
    const step = view.runtime.step?.id;
    if (is_relocalizing() && step) {
      params.set('step', step);
      history.replaceState(null, '', `${here}?${params}`);
    }
    outline?.destroy();
    rail.destroy();
    view.destroy();
  };
}

function generate_view(root: HTMLElement, cl: CourseLesson): () => void {
  const e = cl.entry!;
  root.innerHTML = `<div class="card" style="max-width:760px;margin:0 auto">
    <div class="muted" style="font-size:13px">${esc(e.unit ?? '')} · ${esc(e.level ?? '')}</div>
    <h2 style="font-size:24px;margin:6px 0 12px">${math_html(tr(cl.title, ui_lang()))}</h2>
    <div class="muted">${esc(t('gen_intro'))}</div>
    <ol style="margin:16px 0">${e.objectives.map((o) => `<li>${math_html(o)}</li>`).join('')}</ol>
    <div class="row"><button class="mn-btn primary" id="gen">${esc(t('gen_button'))}</button><span class="muted" id="note" style="font-size:13px"></span></div>
    <pre id="progress" style="font:12px/1.6 ui-monospace,monospace;color:var(--mn-muted);white-space:pre-wrap;margin-top:14px"></pre>
  </div>`;
  const note = root.querySelector<HTMLElement>('#note')!;
  const prog = root.querySelector<HTMLElement>('#progress')!;
  if (!has_model()) note.textContent = e.id === 'inscribed-angles' ? t('gen_offline_demo') : t('gen_needs_key');
  const ctrl = new AbortController();
  root.querySelector<HTMLButtonElement>('#gen')!.onclick = async (ev) => {
    (ev.target as HTMLButtonElement).disabled = true;
    const lines: string[] = [];
    const put = (s: string, replace = false) => {
      if (replace) lines.pop();
      lines.push(s);
      prog.textContent = lines.join('\n');
    };
    try {
      const g = await generate_lesson(e, {
        provider: provider(), validate: worker_validator(), signal: ctrl.signal,
        on_status: (s) => {
          if (s.phase === 'planning') put(t('gen_planning'));
          else if (s.phase === 'scene') put(t('gen_scene', { i: s.index + 1, n: s.total, title: s.title, what: { thinking: t('gen_writing'), validating: t('gen_checking', { a: s.inner.attempt }), repairing: t('gen_fixing', { a: s.inner.attempt }), done: t('gen_ok') }[s.inner.phase] }), s.inner.phase !== 'thinking');
          else put(t('gen_done'));
        },
      });
      cache_generation(g);
      learner.add_skills(g.plan.skills);
      lesson_from_generated(g);
      navigate(`${lesson_path(e.id)}?new=${Date.now()}`);
    } catch (err) {
      put(t('gen_failed', { e: (err as Error).message }));
      (ev.target as HTMLButtonElement).disabled = false;
    }
  };
  return () => ctrl.abort();
}

/** A lab tutorial (/<course>/labs/<lab>): the breadcrumb, then the tutorial and its code, loaded on demand. */
export async function lab_page(root: HTMLElement, route: Route): Promise<() => void> {
  if (route.page !== 'lab') return () => {};
  const c = route.course;
  const meta = c.labs?.find((l) => l.slug === route.lab);
  const crumb = `<nav class="crumb"><a href="${course_path(c)}">${math_html(tr(c.title, ui_lang()))}</a> / <a href="${course_path(c)}#labs">${esc(t('labs'))}</a></nav>`;
  if (!meta) {
    root.innerHTML = `${crumb}<div class="card">${esc(t('not_found'))} <a href="${course_path(c)}">${esc(t('back'))}</a></div>`;
    return () => {};
  }
  const here = location.pathname;
  root.innerHTML = `${crumb}<div class="card muted" style="max-width:620px;margin:40px auto;text-align:center">${esc(t('loading_lab'))}</div>`;
  let mod;
  try {
    [mod] = await Promise.all([load_lab(c.id, meta.slug), enable_dom_tex()]);
  } catch (e) {
    console.warn('lab chunk failed to load', e);
    root.innerHTML = `${crumb}<div class="card" style="max-width:620px;margin:40px auto">${esc(t('load_failed'))} <a href="${here}?retry=${Date.now()}">${esc(t('try_again'))}</a></div>`;
    return () => {};
  }
  if (location.pathname !== here) return () => {}; // the learner went elsewhere meanwhile
  const after = meta.after ? find_lesson(meta.after) : undefined;
  // "建议先学完这节课：C2 · LoRA：…", the lesson as a link
  const [pre, post] = t('lab_after_page', { l: '\u0000' }).split('\u0000');
  const link = after ? `<a href="${lesson_path(after.id)}">${esc(lesson_code(after.id))} · ${math_html(tr(after.title, ui_lang()))}</a>` : '';
  root.innerHTML = `${crumb}${after ? `<p class="muted lab-after">${esc(pre)}${link}${esc(post ?? '')}</p>` : ''}`;
  const body = document.createElement('div');
  root.append(body);
  const stop_lab = render_lab(body, mod, ui_lang());
  const stop_fit = fit_display_math(body); // wide formulas shrink or scroll, never clipped
  return () => {
    stop_fit();
    stop_lab();
  };
}
