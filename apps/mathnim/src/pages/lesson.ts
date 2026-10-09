// One lesson: the player, questions about it, or generating it from the syllabus.
import { AskPanel, RECORDED, generate_lesson, lesson_from_generated, recorded_question, worker_validator, type RecordedAnswer } from '@mathnim/ai';
import { tr } from '@mathnim/core';
import { LessonView, esc, math_html, t, ui_lang } from '@mathnim/present';
import { apply_palette, set_theme } from '@mathnim/visuals';
import { apply_theme } from '../lessons/best-angle/theme';
import { cache_generation, ensure_lesson, find_lesson, playable, type CourseLesson } from '../course';
import { has_model, load_settings, provider } from '../settings';
import { learner, log, remember_last } from '../store';
import { lesson_context } from '../student';
import { is_relocalizing } from '../shell';
import { text_grader, visual_resolver } from '../lesson_services';

export async function lesson_page(root: HTMLElement, [id]: string[]): Promise<() => void> {
  const cl = find_lesson(id);
  if (!cl) {
    root.innerHTML = `<div class="card">${esc(t('not_found'))} <a href="#/">${esc(t('back'))}</a></div>`;
    return () => {};
  }
  // a lesson loaded on demand (the fine-tuning course): its code, visuals and data arrive now
  if (cl.load && !cl.lesson) {
    root.innerHTML = `<div class="card muted" style="max-width:620px;margin:40px auto;text-align:center">${esc(t('loading_lesson'))}</div>`;
    try {
      await ensure_lesson(cl);
    } catch (e) {
      console.warn('lesson chunk failed to load', e);
      root.innerHTML = `<div class="card" style="max-width:620px;margin:40px auto">${esc(t('load_failed'))} <a href="#/lesson/${encodeURIComponent(cl.id)}?retry=${Date.now()}">${esc(t('try_again'))}</a></div>`;
      return () => {};
    }
    if (!location.hash.startsWith(`#/lesson/${cl.id}`)) return () => {}; // the learner went elsewhere meanwhile
    root.innerHTML = '';
  }
  const lesson = playable(cl);
  if (!lesson) return generate_view(root, cl);
  remember_last(cl.id);
  const host = document.createElement('div');
  const asks = document.createElement('section');
  asks.className = 'card';
  asks.style.marginTop = '20px';
  asks.innerHTML = `<h2>${esc(t('lesson_questions'))}</h2><div class="muted" style="font-size:13px;margin-bottom:10px">${esc(t('lesson_questions_sub'))}</div>`;
  const askRoot = document.createElement('div');
  asks.append(askRoot);
  root.append(host, asks);
  const params = new URLSearchParams(location.hash.split('?')[1] ?? '');
  const mode = params.get('mode') === 'game' || params.get('mode') === 'essay' ? (params.get('mode') as 'game' | 'essay') : undefined;
  // a lesson drawn with the named palette may ask for the dark (3b1b-like) theme
  const dark_lesson = lesson.theme === 'dark';
  set_theme(dark_lesson ? 'dark' : 'light');
  const view = new LessonView(host, lesson, {
    learner, log, dev: params.has('dev'), dark: load_settings().dark || dark_lesson, on_player: dark_lesson ? apply_palette : apply_theme, mode,
    lang: ui_lang(), visuals: visual_resolver, grade_text: text_grader(),
  });
  const recorded: Record<string, RecordedAnswer[]> = {
    'best-angle': RECORDED.slice(0, 4),
    pizza: RECORDED.slice(4, 6),
    'inscribed-angles': [RECORDED[1]],
  };
  const lang = ui_lang();
  // suggested questions in the learner's language: recorded ones, else the syllabus objectives, else the lesson's own misconceptions
  const lower = (s: string) => (/^[A-Z][a-z]/.test(s) ? s.charAt(0).toLowerCase() + s.slice(1) : s);
  const suggestions = recorded[cl.id]?.map((r) => recorded_question(r, lang))
    ?? (cl.entry ? cl.entry.objectives.map((o) => t('why_true', { o: lower(o).replace(/\.$/, '') }))
      : (lesson.misconceptions ?? []).slice(0, 3).map((m) => t('is_it_true', { d: lower(tr(m.description, lang)).replace(/[.。]$/, '') })));
  new AskPanel(askRoot, {
    provider, validate: worker_validator(), log, lesson: lesson.id, suggestions,
    context: () => lesson_context(cl, view),
  });
  (window as any).mathnim_view = view; // for debugging in the console
  await view.start(params.get('step') ?? undefined);
  return () => {
    // switching language re-renders this page: come back to the same step
    const at = view.runtime.step?.id;
    if (is_relocalizing() && at) {
      params.set('step', at);
      history.replaceState(null, '', `#/lesson/${encodeURIComponent(cl.id)}?${params}`);
    }
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
      location.hash = `#/lesson/${e.id}?new=${Date.now()}`;
    } catch (err) {
      put(t('gen_failed', { e: (err as Error).message }));
      (ev.target as HTMLButtonElement).disabled = false;
    }
  };
  return () => ctrl.abort();
}
