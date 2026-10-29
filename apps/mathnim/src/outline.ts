// The lesson outline: the course's units and lessons beside a lesson, with
// the steps of the lesson being learned nested under it (click one to go
// there). Docked at the left from 1280 px (open by default, the learner's
// choice is remembered); below that it opens over the page. When docked it
// replaces the row of small step icons under the lesson. (docs/SITE-STRUCTURE.md)
import { tr, type Lesson, type Step } from '@mathnim/core';
import { esc, math_html, t, ui_lang, type LessonView } from '@mathnim/present';
import { course_path, lesson_code, lesson_path, unit_title, visible_units, type Course, type CourseLesson } from './course';
import { lesson_status } from './store';

const KEY = 'mathnim.outline';
const WIDE = '(min-width: 1280px)';

const CSS = `
.lesson-layout{display:block}
.lesson-layout.docked{display:grid;grid-template-columns:268px minmax(0,1fr);gap:4px;align-items:start}
.lesson-main{min-width:0}
.lesson-layout.docked .mn-steps{display:none}
.outline{background:var(--mn-panel);border:1px solid var(--mn-border);border-radius:var(--mn-radius);font-size:13.5px;overflow:auto;overscroll-behavior:contain}
.lesson-layout.docked .outline{position:sticky;top:calc(var(--mn-sticky-top) + 16px);max-height:calc(100vh - var(--mn-sticky-top) - 32px);margin-top:16px}
.outline[hidden]{display:none}
.ol-head{display:flex;align-items:center;gap:8px;padding:12px 12px 8px 14px;position:sticky;top:0;background:var(--mn-panel);z-index:1}
.ol-head a{flex:1;min-width:0;font-weight:650;color:var(--mn-fg);text-decoration:none;line-height:1.3}
.ol-head a:hover{color:var(--mn-accent)}
.ol-close{flex:none;border:0;background:transparent;color:var(--mn-muted);font-size:18px;line-height:1;width:28px;height:28px;border-radius:8px;cursor:pointer}
.ol-close:hover{background:var(--mn-faint);color:var(--mn-fg)}
.ol-unit{padding:6px 0 4px}
.ol-unit>h4{margin:0;padding:6px 14px 4px;font-size:12px;font-weight:600;color:var(--mn-muted);letter-spacing:.01em}
.ol-lesson{display:flex;gap:8px;align-items:baseline;padding:5px 12px 5px 14px;color:var(--mn-fg);text-decoration:none;line-height:1.35;border-left:3px solid transparent}
.ol-lesson:hover{background:color-mix(in srgb,var(--mn-accent) 6%,transparent)}
.ol-lesson.current{font-weight:650;border-left-color:var(--mn-accent);background:color-mix(in srgb,var(--mn-accent) 7%,transparent)}
.ol-st{flex:none;width:14px;text-align:center;font-size:11px;color:var(--mn-muted)}
.ol-lesson.done .ol-st{color:var(--mn-good)}
.ol-lesson.started .ol-st{color:var(--mn-accent)}
.ol-steps{position:relative;list-style:none;margin:2px 0 6px;padding:0 0 0 20px;background:color-mix(in srgb,var(--mn-accent) 4%,transparent)}
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
.ol-sta.code>s{display:none}
.ol-sta.code>svg{position:relative;display:block;width:12px;height:9px;padding:1px 0;background:var(--mn-panel);fill:none;stroke:color-mix(in srgb,var(--mn-fg) 40%,transparent);stroke-width:1.6;stroke-linecap:round;stroke-linejoin:round;transition:stroke .2s}
.ol-step.done .ol-sta.code>svg{stroke:color-mix(in srgb,var(--mn-accent) 80%,transparent)}
.ol-step.now .ol-sta.code>svg{stroke:var(--mn-accent);stroke-width:2}
.ol-sta.world>s{width:7px;height:7px;border-width:1.75px}
.ol-sta.world>u{position:absolute;inset:-3.5px;border-radius:50%;border:1.4px dashed color-mix(in srgb,var(--mn-fg) 40%,transparent);background:var(--mn-panel);z-index:-1;transition:transform .6s cubic-bezier(.3,1.4,.5,1),border-color .2s}
.ol-step:hover .ol-sta.world>u{transform:rotate(90deg)}
.ol-step.done .ol-sta>s,.ol-step.done .ol-sta>u{border-color:color-mix(in srgb,var(--mn-accent) 72%,transparent)}
.ol-step.now .ol-sta>s{border-color:var(--mn-accent);background:var(--mn-accent)}
.ol-step.now .ol-sta>u{border-color:var(--mn-accent)}
.ol-step.now .ol-sta::after{content:'';position:absolute;inset:-4px;--c:color-mix(in srgb,var(--mn-accent) 85%,transparent);background:linear-gradient(var(--c),var(--c)) 0 0/4px 1px no-repeat,linear-gradient(var(--c),var(--c)) 0 0/1px 4px no-repeat,linear-gradient(var(--c),var(--c)) 100% 0/4px 1px no-repeat,linear-gradient(var(--c),var(--c)) 100% 0/1px 4px no-repeat,linear-gradient(var(--c),var(--c)) 0 100%/4px 1px no-repeat,linear-gradient(var(--c),var(--c)) 0 100%/1px 4px no-repeat,linear-gradient(var(--c),var(--c)) 100% 100%/4px 1px no-repeat,linear-gradient(var(--c),var(--c)) 100% 100%/1px 4px no-repeat}
@media (prefers-reduced-motion:reduce){.ol-steps::after,.ol-sta.world>u{transition:none}}
.ol-toggle{display:inline-flex;align-items:center;gap:6px;font:inherit;font-size:13px;color:var(--mn-muted);background:var(--mn-panel);border:1px solid var(--mn-border);border-radius:999px;padding:4px 11px;cursor:pointer;white-space:nowrap}
.ol-toggle:hover{color:var(--mn-accent);border-color:var(--mn-accent)}
.ol-toggle svg{flex:none}
.lesson-top{display:flex;align-items:center;gap:12px;margin:0 0 4px}
.lesson-top .crumb{margin:0;flex:1;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.ol-toggle[aria-expanded=true]{color:var(--mn-accent);border-color:color-mix(in srgb,var(--mn-accent) 40%,var(--mn-border))}
/* below 1280 px: over the page, with a backdrop */
.ol-backdrop{position:fixed;inset:0;background:rgba(20,22,26,.28);z-index:28}
.ol-backdrop[hidden]{display:none}
.lesson-layout:not(.docked) .outline{position:fixed;z-index:29;left:0;top:0;bottom:0;width:min(320px,86vw);border-radius:0 var(--mn-radius) var(--mn-radius) 0;box-shadow:0 10px 40px rgba(0,0,0,.18)}
`;
let injected = false;

const ICON = '<svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true"><path d="M2 3.5h12M2 8h12M2 12.5h8" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg>';

function saved(): boolean | null {
  try {
    const v = localStorage.getItem(KEY);
    return v === 'open' ? true : v === 'closed' ? false : null;
  } catch {
    return null;
  }
}
function save(open: boolean): void {
  try {
    localStorage.setItem(KEY, open ? 'open' : 'closed');
  } catch {
    /* no storage */
  }
}

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
  const wide = matchMedia(WIDE);
  layout.classList.add('lesson-layout');
  const panel = document.createElement('nav');
  panel.className = 'outline';
  panel.setAttribute('aria-label', t('outline'));
  const backdrop = document.createElement('div');
  backdrop.className = 'ol-backdrop';
  backdrop.hidden = true;
  layout.prepend(panel);
  layout.append(backdrop);
  if (main.parentElement !== layout) layout.append(main);

  const toggle = document.createElement('button');
  toggle.type = 'button';
  toggle.className = 'ol-toggle';
  toggle.innerHTML = `${ICON}<span>${esc(t('outline'))}</span>`;

  // the course: units, lessons; the current lesson's steps are filled in by render_steps
  panel.innerHTML = `<div class="ol-head"><a href="${course_path(o.course)}">${math_html(tr(o.course.title, lang))}</a><button type="button" class="ol-close" aria-label="${esc(t('close'))}" title="${esc(t('close'))}">×</button></div>
    ${visible_units(o.course).map((u) => `<div class="ol-unit"><h4>${math_html(unit_title(o.course, u, lang))}</h4>${u.lessons.map((l) => {
      const st = l.id === o.current.id ? 'current' : lesson_status(l.id);
      const code = lesson_code(l.id);
      return `<a class="ol-lesson ${st}" href="${lesson_path(l.id)}"${l.id === o.current.id ? ' aria-current="page"' : ''}><span class="ol-st" aria-hidden="true">${st === 'done' ? '✓' : st === 'started' ? '●' : st === 'current' ? '▸' : '○'}</span><span>${code ? `${esc(code)} · ` : ''}${math_html(tr(l.title, lang))}</span></a>${l.id === o.current.id ? '<ul class="ol-steps"></ul>' : ''}`;
    }).join('')}</div>`).join('')}`;
  const steps = panel.querySelector<HTMLUListElement>('.ol-steps');

  // a station by what the step asks of the learner (CSS above)
  const dot = (s: Step) =>
    s.kind === 'explore' ? '<span class="ol-sta world" aria-hidden="true"><u></u><s></s></span>'
    : s.kind === 'checkpoint' ? '<span class="ol-sta ask" aria-hidden="true"><s></s></span>'
    : s.kind === 'code' ? '<span class="ol-sta code" aria-hidden="true"><svg viewBox="0 0 12 9"><path d="M4 1 1 4.5 4 8M8 1l3 3.5L8 8"/></svg></span>'
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
    if (now && !panel.hidden) {
      const pr = panel.getBoundingClientRect(), nr = now.getBoundingClientRect();
      if (nr.top < pr.top + 48 || nr.bottom > pr.bottom - 8) panel.scrollTop += nr.top - pr.top - pr.height / 3;
    }
  };
  panel.addEventListener('click', (e) => {
    const b = (e.target as HTMLElement).closest<HTMLButtonElement>('.ol-step');
    if (b?.dataset.step) {
      void o.view.runtime.goto(b.dataset.step);
      if (!wide.matches) set(false, false);
    }
  });
  panel.querySelector<HTMLButtonElement>('.ol-close')!.onclick = () => set(false);
  backdrop.onclick = () => set(false, false);

  let open = false;
  /** Open or close; `remember` keeps the choice for wide screens. */
  function set(v: boolean, remember = true): void {
    open = v;
    const docked = v && wide.matches;
    layout.classList.toggle('docked', docked);
    panel.hidden = !v;
    backdrop.hidden = !v || wide.matches;
    toggle.setAttribute('aria-expanded', String(v));
    if (remember && wide.matches) save(v);
    if (v) render_steps();
  }
  toggle.onclick = () => set(!open);
  const on_width = () => set(wide.matches ? saved() ?? true : false, false);
  wide.addEventListener('change', on_width);
  const on_key = (e: KeyboardEvent) => {
    if (e.key === 'Escape' && open && !wide.matches) set(false, false);
  };
  document.addEventListener('keydown', on_key);
  const off = o.view.runtime.on((e) => {
    if (e.type === 'step' || e.type === 'finished') render_steps();
  });
  on_width();
  return {
    toggle,
    destroy() {
      off();
      wide.removeEventListener('change', on_width);
      document.removeEventListener('keydown', on_key);
    },
  };
}
