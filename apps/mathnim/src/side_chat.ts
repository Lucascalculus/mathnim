// "这里没懂" / "Explain this": a chat beside the lesson. Opened from any step
// (the button under the step) or from a passage selected on a text page; it
// never navigates and never scrolls the lesson. The question goes out with
// the lesson, the step, the selected passage and the learner's recent
// mistakes; answers stream, follow-ups continue the thread, and each lesson
// keeps its thread for the session (coming back to the lesson shows it again).
// A drawer on the right on wide screens, a bottom sheet on phones.
import { AskPanel, RECORDED, RECORDED_TEXT, recorded_question, worker_validator, type AskContext } from '@mathnim/ai';
import { tr, type Lesson } from '@mathnim/core';
import { esc, math_html, t, ui_lang, type LessonView } from '@mathnim/present';
import type { CourseLesson } from './course';
import { provider } from './settings';
import { log } from './store';
import { lesson_context } from './student';

const CSS = `
.side-chat{position:fixed;z-index:30;top:var(--mn-sticky-top,58px);right:0;bottom:0;width:min(420px,100vw);display:flex;flex-direction:column;background:var(--mn-panel);border-left:1px solid var(--mn-border);box-shadow:-12px 0 40px rgba(0,0,0,.10)}
.side-chat[hidden]{display:none}
.sc-head{display:flex;align-items:flex-start;gap:10px;padding:14px 14px 10px 18px;border-bottom:1px solid var(--mn-border)}
.sc-title{flex:1;min-width:0}
.sc-title b{display:block;font-size:15px}
.sc-where{display:block;font-size:12.5px;color:var(--mn-muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;margin-top:2px}
.sc-close{flex:none;border:0;background:transparent;color:var(--mn-muted);font-size:20px;line-height:1;width:30px;height:30px;border-radius:8px;cursor:pointer}
.sc-close:hover{background:var(--mn-faint);color:var(--mn-fg)}
.sc-quote{display:flex;gap:8px;align-items:flex-start;margin:10px 14px 0 18px;padding:8px 10px;border-radius:10px;background:color-mix(in srgb,var(--mn-accent) 7%,transparent);font-size:13px;line-height:1.45}
.sc-quote[hidden]{display:none}
.sc-quote q{flex:1;min-width:0;color:var(--mn-fg);display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden;quotes:"“" "”"}
.sc-quote button{flex:none;border:0;background:transparent;color:var(--mn-muted);cursor:pointer;font-size:15px;line-height:1;padding:0 2px}
.sc-body{flex:1;min-height:0;overflow:auto;overscroll-behavior:contain;padding:12px 14px 14px 18px}
.sc-body .mn-card{box-shadow:none}
.sc-empty{font-size:13.5px;color:var(--mn-muted);margin:2px 0 4px}
.sc-body .mn-ask.mn-thread>form{position:sticky;bottom:-14px;background:var(--mn-panel);padding:8px 0 14px;margin-bottom:-14px}
@media (max-width:699px){
 .side-chat{top:auto;left:0;width:auto;height:min(78vh,640px);border-left:0;border-top:1px solid var(--mn-border);border-radius:16px 16px 0 0;box-shadow:0 -12px 40px rgba(0,0,0,.16);padding-bottom:env(safe-area-inset-bottom)}
 .sc-head::before{content:"";position:absolute;left:50%;top:6px;width:36px;height:4px;border-radius:2px;background:var(--mn-border);transform:translateX(-50%)}
 body.side-chat-open .mn-helpbtn{display:none}
}
`;
let injected = false;

/** One lesson's conversation, kept for the session. */
interface Thread {
  el: HTMLElement;
  panel: AskPanel;
  where: HTMLElement;
  quote: HTMLElement;
  /** The passage attached to the next question (cleared once it is asked). */
  selected: string;
  /** The lesson view on screen (the page is re-mounted on every visit). */
  view: LessonView | null;
  empty: HTMLElement;
}
const THREADS = new Map<string, Thread>();

/** Fired on window when the chat opens or closes ({ detail: { open } }). */
export const CHAT_EVENT = 'mathnim:side-chat';

export interface SideChat {
  open(ask: { selected?: string }): void;
  close(): void;
  /** Leave the page: the panel is taken off it, its thread kept. */
  destroy(): void;
}

/** Suggested questions for the step on screen: recorded ones first, then the lesson's misconceptions as questions. */
function suggestions(cl: CourseLesson, lesson: Lesson, step_id: string | undefined): string[] {
  const lang = ui_lang();
  const words = RECORDED_TEXT.filter((r) => r.lesson === cl.id && (!r.step || r.step === step_id)).map((r) => r.question[lang]);
  const scenes: Record<string, number[]> = { 'best-angle': [0, 1, 2, 3], pizza: [4, 5], 'inscribed-angles': [1] };
  const recorded = (scenes[cl.id] ?? []).map((i) => recorded_question(RECORDED[i], lang));
  if (words.length || recorded.length) return [...words, ...recorded].slice(0, 3);
  const lower = (s: string) => (/^[A-Z][a-z]/.test(s) ? s.charAt(0).toLowerCase() + s.slice(1) : s);
  if (cl.entry) return cl.entry.objectives.slice(0, 2).map((o) => t('why_true', { o: lower(o).replace(/\.$/, '') }));
  return (lesson.misconceptions ?? []).slice(0, 2).map((m) => t('is_it_true', { d: lower(tr(m.description, lang)).replace(/[.。]$/, '') }));
}

export function mount_side_chat(cl: CourseLesson, lesson: Lesson, view: LessonView): SideChat {
  if (!injected) {
    injected = true;
    const s = document.createElement('style');
    s.textContent = CSS;
    document.head.append(s);
  }
  const host = document.querySelector<HTMLElement>('.app-shell') ?? document.body;
  let th = THREADS.get(cl.id);
  if (!th || th.el.lang !== (ui_lang() === 'zh' ? 'zh-CN' : 'en')) {
    // a new thread (or the language changed: the old one was in the other language)
    const el = document.createElement('aside');
    el.className = 'side-chat';
    el.hidden = true;
    el.lang = ui_lang() === 'zh' ? 'zh-CN' : 'en';
    el.setAttribute('role', 'dialog');
    el.setAttribute('aria-label', t('explain_this'));
    el.innerHTML = `<header class="sc-head"><div class="sc-title"><b>${esc(t('explain_this'))}</b><span class="sc-where"></span></div><button type="button" class="sc-close" aria-label="${esc(t('close'))}" title="${esc(t('close'))}">×</button></header>
      <div class="sc-quote" hidden><q></q><button type="button" aria-label="${esc(t('chat_unquote'))}" title="${esc(t('chat_unquote'))}">×</button></div>
      <div class="sc-body"><p class="sc-empty">${esc(t('chat_intro'))}</p></div>`;
    const body = el.querySelector<HTMLElement>('.sc-body')!;
    const t2: Thread = {
      el, where: el.querySelector('.sc-where')!, quote: el.querySelector('.sc-quote')!, selected: '', view, empty: el.querySelector('.sc-empty')!,
      panel: null as unknown as AskPanel,
    };
    t2.panel = new AskPanel(body, {
      provider, validate: worker_validator(), log, lesson: lesson.id, thread: true,
      placeholder: t('chat_placeholder'),
      // what the tutor knows: lesson, step, what is on screen, mastery, recent mistakes; plus the selected passage
      context: (): AskContext => (t2.view ? lesson_context(cl, t2.view) : {}),
      extra: () => {
        const selected = t2.selected;
        set_quote(t2, '');
        t2.empty.remove();
        return selected ? { selected } : undefined;
      },
      empty_question: () => (t2.selected ? t('explain_passage') : null),
      on_card: (card) => requestAnimationFrame(() => (body.scrollTop = Math.max(0, card.offsetTop - body.offsetTop - 8))),
    });
    el.querySelector<HTMLButtonElement>('.sc-quote button')!.onclick = () => set_quote(t2, '');
    THREADS.set(cl.id, (th = t2));
  }
  const thread = th;
  thread.view = view;
  host.append(thread.el);
  const close_btn = thread.el.querySelector<HTMLButtonElement>('.sc-close')!;

  const close = () => {
    if (thread.el.hidden) return;
    thread.el.hidden = true;
    document.body.classList.remove('side-chat-open');
    dispatchEvent(new CustomEvent(CHAT_EVENT, { detail: { open: false } }));
  };
  close_btn.onclick = close;
  const on_key = (e: KeyboardEvent) => {
    if (e.key === 'Escape' && !thread.el.hidden) close();
  };
  document.addEventListener('keydown', on_key);
  // the panel follows the step on screen: its name in the header, its suggestions
  const update = () => {
    const s = view.runtime.step;
    thread.where.innerHTML = s ? math_html(tr(s.title, ui_lang()) || s.id) : '';
    thread.panel.set_suggestions(suggestions(cl, lesson, s?.id));
  };
  const off = view.runtime.on((e) => {
    if (e.type === 'step') update();
  });
  return {
    open(ask) {
      update();
      if (ask.selected !== undefined) set_quote(thread, ask.selected);
      const was_open = !thread.el.hidden;
      thread.el.hidden = false;
      document.body.classList.add('side-chat-open');
      // (the outline makes room on narrower wide screens, see outline.ts)
      if (!was_open) dispatchEvent(new CustomEvent(CHAT_EVENT, { detail: { open: true } }));
      thread.panel.focus();
    },
    close,
    destroy() {
      off();
      document.removeEventListener('keydown', on_key);
      close();
      thread.view = null;
      thread.el.remove();
    },
  };
}

function set_quote(th: Thread, text: string): void {
  th.selected = text;
  th.quote.hidden = !text;
  th.quote.querySelector('q')!.textContent = text;
}
