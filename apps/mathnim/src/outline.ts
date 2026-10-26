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
.ol-steps{list-style:none;margin:2px 0 6px;padding:0 0 0 20px;border-left:3px solid var(--mn-accent);background:color-mix(in srgb,var(--mn-accent) 4%,transparent)}
.ol-chapter{padding:7px 10px 2px 16px;font-size:11.5px;color:var(--mn-muted);font-weight:600}
.ol-step{display:flex;gap:8px;align-items:baseline;width:100%;text-align:left;font:inherit;font-size:13px;line-height:1.35;color:var(--mn-muted);background:transparent;border:0;padding:4px 10px 4px 16px;cursor:pointer}
.ol-step:hover{color:var(--mn-fg)}
.ol-step .ol-dot{flex:none;width:7px;height:7px;border-radius:50%;box-shadow:inset 0 0 0 1.5px currentColor;transform:translateY(-1px)}
.ol-step.done{color:var(--mn-fg)}
.ol-step.done .ol-dot{background:color-mix(in srgb,var(--mn-accent) 45%,transparent);box-shadow:none}
.ol-step.now{color:var(--mn-accent);font-weight:650}
.ol-step.now .ol-dot{background:var(--mn-accent);box-shadow:0 0 0 3px color-mix(in srgb,var(--mn-accent) 22%,transparent)}
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

  const render_steps = () => {
    if (!steps) return;
    const cur = o.view.runtime.index;
    let last: string | undefined;
    const items: string[] = [];
    o.lesson.steps.forEach((s: Step, i) => {
      if (s.branch_only) return;
      const chapter = s.chapter !== undefined ? tr(s.chapter, lang) : undefined;
      if (chapter && chapter !== last) {
        last = chapter;
        items.push(`<li class="ol-chapter">${math_html(chapter)}</li>`);
      }
      const title = tr(s.title, lang) || s.id;
      items.push(`<li><button type="button" class="ol-step${i < cur ? ' done' : i === cur ? ' now' : ''}" data-step="${esc(s.id)}"${i === cur ? ' aria-current="step"' : ''}><span class="ol-dot" aria-hidden="true"></span><span>${math_html(title)}</span></button></li>`);
    });
    steps.innerHTML = items.join('');
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
