// Review session: questions that are due (spaced repetition), each with a new
// variant when the question has parameters.
import { tr, type CheckpointStep, type Lesson } from '@mathnim/core';
import { LessonView, esc, math_html, plural_s, t, ui_lang } from '@mathnim/present';
import { text_grader, visual_resolver } from '../lesson_services';
import { apply_theme } from '../lessons/best-angle/theme';
import { all_lessons, ensure_lesson, playable } from '../course';
import { load_settings } from '../settings';
import { learner, log } from '../store';
import { ready_visuals } from '../cjk_font';
import { enable_dom_tex } from '../tex_dom';

interface Item {
  lesson: Lesson;
  step: CheckpointStep;
}
function practice_items(): Item[] {
  const out: Item[] = [];
  for (const cl of all_lessons()) {
    const lesson = playable(cl);
    if (!lesson) continue;
    for (const s of lesson.steps) if (s.kind === 'checkpoint' && s.purpose !== 'predict') out.push({ lesson, step: s });
  }
  return out;
}

export async function review(root: HTMLElement): Promise<() => void> {
  // due questions name their lesson ('<lesson>/<step>'): load those lessons, and only those
  const wanted = new Set(learner.due().map((r) => r.id.split('/')[0]));
  const to_load = all_lessons().filter((cl) => cl.load && !cl.lesson && wanted.has(cl.id));
  if (to_load.length) {
    root.innerHTML = `<div class="card muted" style="max-width:620px;margin:40px auto;text-align:center">${esc(t('loading_lesson'))}</div>`;
    await Promise.allSettled(to_load.map(ensure_lesson));
    if (location.pathname !== '/review') return () => {};
    root.innerHTML = '';
  }
  await Promise.all([ready_visuals(), enable_dom_tex()]);
  if (location.pathname !== '/review') return () => {};
  const items = practice_items();
  const byId = new Map(items.map((i) => [`${i.lesson.id}/${i.step.id}`, i]));
  let queue = learner.due().map((r) => byId.get(r.id)).filter((x): x is Item => !!x);
  const due = queue.length;
  if (!queue.length) {
    // nothing due: practise the weakest skills
    queue = [...items].sort((a, b) => learner.mastery(a.step.skill) - learner.mastery(b.step.skill)).slice(0, 5);
  }
  const head = document.createElement('div');
  head.className = 'row';
  head.style.marginBottom = '14px';
  const host = document.createElement('div');
  root.append(head, host);
  let view: LessonView | null = null;
  let k = 0;
  const next = () => {
    view?.destroy();
    if (k >= queue.length) {
      head.innerHTML = '';
      host.innerHTML = `<div class="card" style="max-width:620px;margin:0 auto"><h2>${esc(t('review_done'))}</h2><p class="muted">${esc(t('review_done_sub', { n: queue.length, s: plural_s(queue.length) }))}</p><a class="mn-btn primary" href="/" style="text-decoration:none">${esc(t('back_to_lessons'))}</a></div>`;
      return;
    }
    const { lesson, step } = queue[k++];
    const title = tr(lesson.title, ui_lang());
    head.innerHTML = `<b>${esc(t(due ? 'due_for_review' : 'practice'))}</b><span class="muted">${esc(t('k_of_n', { k, n: queue.length }))} · ${math_html(title)}</span>`;
    const mini: Lesson = { ...lesson, title: t('review_title', { title }), steps: [{ ...step, reveal: undefined, on_correct: undefined, on_wrong: undefined, next: undefined }] };
    view = new LessonView(host, mini, { learner, log, dark: load_settings().dark, on_player: apply_theme, seed: Date.now() % 100000, on_finished: next, lang: ui_lang(), visuals: visual_resolver, grade_text: text_grader() });
    void view.start();
  };
  next();
  return () => view?.destroy();
}
