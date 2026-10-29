// The lesson outline: the course's units and lessons, with the steps of the
// lesson being learned nested under it (click one to go there). A drawer that
// slides in from the left over the page, closed when a lesson opens: the figure
// leads. Its button is the first thing in the lesson's head. (docs/SITE-STRUCTURE.md)
import { tr, type Lesson, type Step } from '@mathnim/core';
import { esc, icon, math_html, t, ui_lang, type LessonView } from '@mathnim/present';
import { progress_mark } from './progress_mark';
import { course_path, lesson_path, unit_title, visible_units, type Course, type CourseLesson } from './course';
import { lesson_status } from './store';


const CSS = `
.lesson-layout{display:block}
.lesson-main{min-width:0}
.outline{position:fixed;z-index:29;left:0;top:0;bottom:0;width:min(320px,86vw);background:var(--mn-panel);border-right:1px solid var(--mn-border);box-shadow:0 10px 40px rgba(0,0,0,.14);font-size:13.5px;overflow:auto;overscroll-behavior:contain;
 transform:translateX(-102%);visibility:hidden;transition:transform .28s cubic-bezier(.2,.8,.2,1),visibility 0s .28s}
.outline.open{transform:none;visibility:visible;transition:transform .28s cubic-bezier(.2,.8,.2,1)}
.ol-head{display:flex;align-items:center;gap:8px;padding:12px 12px 8px 14px;position:sticky;top:0;background:var(--mn-panel);z-index:3;box-shadow:0 1px 0 var(--mn-border)}
.ol-head a{flex:1;min-width:0;font-weight:650;color:var(--mn-fg);text-decoration:none;line-height:1.3}
.ol-head a:hover{color:var(--mn-accent)}
.ol-close{flex:none;display:grid;place-items:center;padding:0;border:0;background:transparent;color:var(--mn-muted);width:28px;height:28px;border-radius:8px;cursor:pointer}
.ol-close:hover{background:var(--mn-faint);color:var(--mn-fg)}
.ol-unit{padding:6px 0 4px}
.ol-unit>h4{margin:0;padding:6px 14px 4px;font-size:12px;font-weight:600;color:var(--mn-muted);letter-spacing:.01em}
.ol-lesson{display:flex;gap:8px;align-items:baseline;padding:5px 12px 5px 14px;color:var(--mn-fg);text-decoration:none;line-height:1.35;border-left:3px solid transparent}
.ol-lesson:hover{background:color-mix(in srgb,var(--mn-accent) 6%,transparent)}
.ol-lesson.current{font-weight:650;border-left-color:var(--mn-accent);background:color-mix(in srgb,var(--mn-accent) 7%,transparent)}
.ol-lesson>.pm{align-self:flex-start;margin-top:4px}
.ol-steps{position:relative;list-style:none;margin:2px 0 6px;padding:0 0 0 20px;background:color-mix(in srgb,var(--mn-accent) 4%,var(--mn-panel))}
.ol-chapter{position:relative;z-index:1;padding:9px 10px 3px 39px;font-size:11.5px;color:var(--mn-muted);font-weight:600}
.ol-step{position:relative;z-index:1;display:flex;gap:9px;align-items:flex-start;width:100%;text-align:left;font:inherit;font-size:13px;line-height:1.35;color:var(--mn-muted);background:transparent;border:0;padding:4px 10px 4px 16px;cursor:pointer}
.ol-step:hover{color:var(--mn-fg)}
.ol-step.done{color:var(--mn-fg)}
.ol-step.now{color:var(--mn-accent);font-weight:650}
/* the lesson as a metro line: the stretch travelled is lit; a step is a station, drawn by what it asks of the learner:
   a stop to read or watch, a diamond for a question, an interchange (a double ring) for a world, < > for code.
   The station the learner is at is held by crop marks (the engineering sheet). */
.ol-steps::before,.ol-steps::after{content:'';position:absolute;z-index:0;left:41px;width:2px;border-radius:1px}
.ol-steps::before{top:var(--l-top,0);height:var(--l-len,0);background:color-mix(in srgb,var(--mn-fg) 11%,transparent)}
.ol-steps::after{top:var(--l-top,0);height:var(--l-done,0);background:color-mix(in srgb,var(--mn-accent) 60%,transparent);transition:height .45s cubic-bezier(.2,.8,.2,1)}
.ol-sta{position:relative;flex:none;display:grid;place-items:center;width:12px;height:12px;margin-top:3px}
.ol-sta>s{box-sizing:border-box;display:block;width:9px;height:9px;border-radius:50%;border:1.75px solid color-mix(in srgb,var(--mn-fg) 28%,transparent);background:var(--mn-panel);text-decoration:none;transition:border-color .2s,background-color .2s}
.ol-sta.ask>s{width:7.5px;height:7.5px;border-radius:1px;transform:rotate(45deg)}
.ol-sta.code{gap:2px;grid-auto-flow:column;justify-content:center}
.ol-sta.code>s{width:5px;height:5px;border-radius:0;background:none;border-width:0;transform:rotate(45deg)}
.ol-sta.code>s:first-child{border-left-width:1.75px;border-bottom-width:1.75px}
.ol-sta.code>s:last-child{border-right-width:1.75px;border-top-width:1.75px}
.ol-sta.code::before{content:'';position:absolute;inset:0 -2px;background:color-mix(in srgb,var(--mn-accent) 4%,var(--mn-panel));z-index:-1}
.ol-step.now .ol-sta.code>s{background:none;border-color:var(--mn-accent)}
.ol-sta.world>s{width:7px;height:7px;border-width:1.75px}
.ol-sta.world>u{position:absolute;inset:-3.5px;border-radius:50%;border:1.4px dashed color-mix(in srgb,var(--mn-fg) 40%,transparent);background:var(--mn-panel);z-index:-1;transition:transform .6s cubic-bezier(.3,1.4,.5,1),border-color .2s}
.ol-step:hover .ol-sta.world>u{transform:rotate(90deg)}
.ol-step.done .ol-sta>s,.ol-step.done .ol-sta>u{border-color:color-mix(in srgb,var(--mn-accent) 72%,transparent)}
.ol-step.now .ol-sta>s{border-color:var(--mn-accent);background:var(--mn-accent)}
.ol-step.now .ol-sta>u{border-color:var(--mn-accent)}
.ol-step.now .ol-sta::after{content:'';position:absolute;inset:-4px;--c:color-mix(in srgb,var(--mn-accent) 85%,transparent);background:linear-gradient(var(--c),var(--c)) 0 0/4px 1px no-repeat,linear-gradient(var(--c),var(--c)) 0 0/1px 4px no-repeat,linear-gradient(var(--c),var(--c)) 100% 0/4px 1px no-repeat,linear-gradient(var(--c),var(--c)) 100% 0/1px 4px no-repeat,linear-gradient(var(--c),var(--c)) 0 100%/4px 1px no-repeat,linear-gradient(var(--c),var(--c)) 0 100%/1px 4px no-repeat,linear-gradient(var(--c),var(--c)) 100% 100%/4px 1px no-repeat,linear-gradient(var(--c),var(--c)) 100% 100%/1px 4px no-repeat}
@media (prefers-reduced-motion:reduce){.ol-steps::after,.ol-sta.world>u{transition:none}}
/* the head of a lesson: the outline button, the course, then the lesson's title (present: .mn-head) */
.ol-toggle{display:inline-flex;align-items:center;gap:6px;font:inherit;font-size:13px;color:var(--mn-muted);background:var(--mn-panel);border:1px solid var(--mn-border);border-radius:999px;padding:4px 11px;cursor:pointer;white-space:nowrap}
.ol-toggle:hover{color:var(--mn-accent);border-color:var(--mn-accent)}
.ol-toggle[aria-expanded=true]{color:var(--mn-accent);border-color:color-mix(in srgb,var(--mn-accent) 40%,var(--mn-border))}
.ol-toggle svg{flex:none}
.mn-head .crumb{margin:0;flex:none;max-width:34%;min-width:0;display:flex;align-items:center;gap:12px;font-size:14px;white-space:nowrap}
/* the back link's arrow sits on the column's edge (its frame reaches out past it), its words on the title's line */
.mn-head .crumb .backlink{margin:0 0 0 -8px;min-width:0;max-width:100%}
.mn-head .crumb .backlink:is(:hover,:focus-visible){color:var(--mn-fg);text-decoration:none}
.mn-head .crumb .backlink>span:nth-of-type(2){min-width:0;overflow:hidden;text-overflow:ellipsis}
.mn-head .crumb::after{content:'';flex:none;width:1px;height:14px;background:var(--mn-border)}
.ol-backdrop{position:fixed;inset:0;background:rgba(20,22,26,.22);z-index:28;opacity:0;visibility:hidden;transition:opacity .28s,visibility 0s .28s}
.ol-backdrop.open{opacity:1;visibility:visible;transition:opacity .28s}
@media (prefers-reduced-motion:reduce){.outline,.ol-backdrop{transition:none!important}}
/* in the lesson bar: one of its buttons (present's .mn-lessonbar .mn-btn: 40 px, 10 px corners, outlined) */
.mn-lessonbar .ol-toggle{box-sizing:border-box;height:40px;padding:0 14px;border-radius:10px;gap:8px;font-size:14px;font-weight:600;color:var(--mn-fg);border-color:var(--mn-border);background:var(--mn-panel)}
.mn-lessonbar .ol-toggle:hover{color:var(--mn-fg);border-color:color-mix(in srgb,var(--mn-fg) 35%,var(--mn-border))}
.mn-lessonbar .ol-toggle svg{width:16px;height:16px}
@media (max-width:640px){.mn-head .crumb{display:none}.mn-lessonbar .ol-toggle span{display:none}.mn-lessonbar .ol-toggle{width:40px;padding:0;justify-content:center}}
`;
let injected = false;

const ICON = '<svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true"><path d="M2 3.5h12M2 8h12M2 12.5h8" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg>';


export interface Outline {
  /** The "目录" button for the lesson's top row. */
  toggle: HTMLButtonElement;
  destroy(): void;
}

/**
 * Mount the outline. `layout` holds the outline and `main` (the lesson); the
 * returned toggle goes wherever the page wants it (next to the breadcrumb).
 */
export function mount_outline(layout: HTMLElement, main: HTMLElement, o: { course: Course; current: CourseLesson; lesson: Lesson; view: LessonView }): Outline {
  if (!injected) {
    injected = true;
    const s = document.createElement('style');
    s.textContent = CSS;
    document.head.append(s);
  }
  const lang = ui_lang();
  layout.classList.add('lesson-layout');
  const panel = document.createElement('nav');
  panel.className = 'outline';
  panel.setAttribute('aria-label', t('outline'));
  const backdrop = document.createElement('div');
  backdrop.className = 'ol-backdrop';
  layout.prepend(panel);
  layout.append(backdrop);
  if (main.parentElement !== layout) layout.append(main);

  const toggle = document.createElement('button');
  toggle.type = 'button';
  toggle.className = 'ol-toggle';
  toggle.innerHTML = `${ICON}<span>${esc(t('outline'))}</span>`;

  // the course: units, lessons; the current lesson's steps are filled in by render_steps
  panel.innerHTML = `<div class="ol-head"><a href="${course_path(o.course)}">${math_html(tr(o.course.title, lang))}</a><button type="button" class="ol-close" aria-label="${esc(t('close'))}" title="${esc(t('close'))}">${icon('x', 16)}</button></div>
    ${visible_units(o.course).map((u) => `<div class="ol-unit"><h4>${math_html(unit_title(o.course, u, lang))}</h4>${u.lessons.map((l) => {
      const st = l.id === o.current.id ? 'current' : lesson_status(l.id);
      return `<a class="ol-lesson ${st}" href="${lesson_path(l.id)}"${l.id === o.current.id ? ' aria-current="page"' : ''}>${progress_mark(st === 'done' ? 'done' : st === 'started' ? 'started' : st === 'current' ? 'current' : 'new')}<span>${math_html(tr(l.title, lang))}</span></a>${l.id === o.current.id ? '<ul class="ol-steps"></ul>' : ''}`;
    }).join('')}</div>`).join('')}`;
  const steps = panel.querySelector<HTMLUListElement>('.ol-steps');

  // a station by what the step asks of the learner (CSS above)
  const dot = (s: Step) =>
    s.kind === 'explore' ? '<span class="ol-sta world" aria-hidden="true"><u></u><s></s></span>'
    : s.kind === 'checkpoint' ? '<span class="ol-sta ask" aria-hidden="true"><s></s></span>'
    : s.kind === 'code' ? '<span class="ol-sta code" aria-hidden="true"><s></s><s></s></span>'
    : '<span class="ol-sta" aria-hidden="true"><s></s></span>';
  /** The line runs from the first station to the last; it is lit as far as the station the learner is at. */
  const draw_line = () => {
    if (!steps) return;
    const stations = [...steps.querySelectorAll<HTMLElement>('.ol-sta')];
    if (!stations.length) return;
    const top = steps.getBoundingClientRect().top;
    const y = (el: HTMLElement) => el.getBoundingClientRect().top - top + el.offsetHeight / 2;
    const first = y(stations[0]), last = y(stations[stations.length - 1]);
    const now = steps.querySelector<HTMLElement>('.ol-step.now .ol-sta');
    steps.style.setProperty('--l-top', `${first}px`);
    steps.style.setProperty('--l-len', `${last - first}px`);
    steps.style.setProperty('--l-done', `${now ? y(now) - first : 0}px`);
  };
  const render_steps = () => {
    if (!steps) return;
    const cur = o.view.runtime.index;
    let last: string | undefined;
    const items: string[] = [];
    let untitled = 0;
    o.lesson.steps.forEach((s: Step, i) => {
      if (s.branch_only) return;
      const chapter = s.chapter !== undefined ? tr(s.chapter, lang) : undefined;
      if (chapter && chapter !== last) {
        last = chapter;
        items.push(`<li class="ol-chapter">${math_html(chapter)}</li>`);
      }
      // (a step without a title is never shown by its id: it is the n-th practice)
      const title = tr(s.title, lang) || t('practice_n', { n: ++untitled });
      items.push(`<li><button type="button" class="ol-step${i < cur ? ' done' : i === cur ? ' now' : ''}" data-step="${esc(s.id)}"${i === cur ? ' aria-current="step"' : ''}>${dot(s)}<span>${math_html(title)}</span></button></li>`);
    });
    steps.innerHTML = items.join('');
    draw_line();
    // keep the current step in view inside the outline (never scrolls the page)
    const now = steps.querySelector<HTMLElement>('.ol-step.now');
    if (now && open) {
      const pr = panel.getBoundingClientRect(), nr = now.getBoundingClientRect();
      if (nr.top < pr.top + 48 || nr.bottom > pr.bottom - 8) panel.scrollTop += nr.top - pr.top - pr.height / 3;
    }
  };
  panel.addEventListener('click', (e) => {
    const b = (e.target as HTMLElement).closest<HTMLButtonElement>('.ol-step');
    if (b?.dataset.step) {
      void o.view.runtime.goto(b.dataset.step);
      set(false);
    }
  });
  panel.querySelector<HTMLButtonElement>('.ol-close')!.onclick = () => set(false);
  backdrop.onclick = () => set(false);

  let open = false;
  /** Open or close the drawer (the page under it stays as it is). */
  function set(v: boolean): void {
    open = v;
    panel.classList.toggle('open', v);
    backdrop.classList.toggle('open', v);
    panel.inert = !v;
    toggle.setAttribute('aria-expanded', String(v));
    if (v) {
      render_steps();
      panel.querySelector<HTMLElement>('.ol-step.now, .ol-close')?.focus({ preventScroll: true });
    }
  }
  toggle.onclick = () => set(!open);
  const on_key = (e: KeyboardEvent) => {
    if (e.key === 'Escape' && open) {
      set(false);
      toggle.focus();
    }
  };
  document.addEventListener('keydown', on_key);
  const off = o.view.runtime.on((e) => {
    if (e.type === 'step' || e.type === 'finished') render_steps();
  });
  set(false);
  return {
    toggle,
    destroy() {
      off();
      document.removeEventListener('keydown', on_key);
    },
  };
}
