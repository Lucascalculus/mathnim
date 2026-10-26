// The tutor in the margin. At the top of a lesson's side column (it follows
// the scroll) is a conversation: two questions the model wrote for the step,
// what has been asked and answered, and a line to write on. Each question is
// marked with a highlighter, a different colour each time; answers appear as
// ink spreading on paper; earlier turns fold to their question.
// A sentence selected on a page and asked about ("问这句") becomes a note in
// the margin beside its paragraph: the sentence is highlighted in the text
// and in the note, in the same colour. Notes fold, reopen to go on asking, and
// are kept (so is the conversation of each step).
// On phones the line sits at the bottom of the screen and the conversation
// opens above it; notes sit under their paragraph.
// The question goes out with the lesson, the step, what is on screen, the
// selected sentence and the learner's recent mistakes; answers stream.
import { AskPanel, RECORDED, RECORDED_TEXT, recorded_question, worker_validator, type AskContext } from '@mathnim/ai';
import { describe_step, is_text_step, tr, type Lesson, type Step } from '@mathnim/core';
import { esc, math_html, t, ui_lang, type LessonView } from '@mathnim/present';
import type { CourseLesson } from './course';
import { has_model, provider } from './settings';
import { log } from './store';
import { lesson_context } from './student';

const SERIF = `"Iowan Old Style","Palatino Linotype",Palatino,"Songti SC","Noto Serif SC","Source Han Serif SC",serif`;
const CHEV = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 14l5-5 5 5"/></svg>';
/** Highlighter inks: one per question, in turn. */
const INKS = ['#ffe27a', '#ffbfd2', '#b9ecc8', '#bcd9ff', '#d8c7ff', '#ffd2a3'];

const CSS = `
.mn-rail{position:relative;font-family:inherit}
.mn-app.mn-textstep .mn-side.mn-railed{position:relative;top:auto;align-self:stretch}
.mn-app.mn-textstep .mn-railed>.mn-rail{flex:1 0 auto}
/* the conversation at the top of the margin, following the scroll */
.rail-talk{position:sticky;top:var(--mn-sticky-top,58px);z-index:3;margin-top:-14px;padding:18px 0 14px;background:var(--mn-bg);max-height:calc(100vh - var(--mn-sticky-top,58px));overflow:auto;overscroll-behavior:contain;scrollbar-width:none}
.rail-talk::-webkit-scrollbar{display:none}
.mn-app:not(.mn-textstep) .rail-talk{position:relative;top:auto;margin-top:0;padding-top:4px;background:none;max-height:none;overflow:visible}
.rail-qs{display:flex;flex-direction:column;margin-bottom:6px}
.rail-q,.mn-rail .mn-chip{display:block;width:100%;text-align:left;border:0;background:none;padding:4px 0;margin:0;border-radius:0;font:italic 14px/1.55 ${SERIF};color:var(--mn-muted);cursor:pointer;transition:color .15s;animation:rail-in .55s cubic-bezier(.2,.8,.2,1) both}
.rail-q:nth-child(2){animation-delay:.08s}
.rail-q:hover,.mn-rail .mn-chip:hover{color:var(--mn-fg);border:0}
.rail-talk.active .rail-qs{display:none}
@keyframes rail-in{from{opacity:0;transform:translateY(5px)}to{opacity:1;transform:none}}
/* a conversation: each question under a stroke of highlighter, the answer in ink */
.mn-rail .mn-ask{gap:12px}
.mn-rail .mn-card{border:0;box-shadow:none;background:none;border-radius:0;overflow:visible}
.mn-rail .mn-card .mn-q{padding:0;border:0;background:none;font:italic 15px/1.6 ${SERIF};color:var(--mn-fg);cursor:default}
.mn-rail .mn-q .mn-quote{display:none}
.ink-q{background-image:linear-gradient(transparent 52%,var(--ink) 52%,var(--ink) 90%,transparent 90%);background-repeat:no-repeat;background-size:100% 100%;-webkit-box-decoration-break:clone;box-decoration-break:clone;padding:0 2px}
.ink-q.draw{animation:ink-draw .7s cubic-bezier(.4,0,.2,1) both}
@keyframes ink-draw{from{background-size:0 100%}to{background-size:100% 100%}}
.mn-rail .mn-card .mn-body{padding:6px 0 0;gap:8px}
.mn-rail .mn-answer-text{font:15px/1.8 ${SERIF};color:var(--mn-fg)}
.mn-rail .mn-answer-text:not(:empty){animation:ink-in 1.1s ease-out both}
@keyframes ink-in{from{opacity:0;filter:blur(5px)}to{opacity:1;filter:none}}
.mn-rail .mn-card details,.mn-rail .mn-card .mn-status{display:none}
.mn-rail .mn-card .mn-actions .mn-btn{border:0;background:none;box-shadow:none;padding:2px 0;font:italic 13.5px/1.4 ${SERIF};color:var(--mn-muted);cursor:pointer}
.mn-rail .mn-card .mn-actions .mn-btn:hover{color:var(--mn-accent)}
.mn-rail .mn-chips{flex-direction:column;align-items:stretch;gap:0}
/* earlier turns fold to their question; a click opens one again */
.mn-rail .mn-card.past .mn-body{display:none}
.mn-rail .mn-card.past .mn-q{cursor:pointer;opacity:.7}
.mn-rail .mn-card.past .mn-q:hover{opacity:1}
/* the line to write on; a light runs along it while the tutor writes */
.mn-rail .mn-ask form{position:relative;display:flex;align-items:center;gap:6px;padding:2px 0 6px}
.mn-rail .mn-ask form::after{content:'';position:absolute;left:0;right:0;bottom:0;height:1px;background:color-mix(in srgb,var(--mn-fg) 28%,transparent);transition:background-color .2s}
.mn-rail .mn-ask form:focus-within::after{background:var(--mn-accent)}
.mn-rail .busy .mn-ask form::after{background:linear-gradient(90deg,transparent,var(--mn-accent),transparent) 0 0/40% 100% no-repeat,color-mix(in srgb,var(--mn-fg) 28%,transparent);animation:rail-run 1.2s linear infinite}
@keyframes rail-run{from{background-position:-40% 0,0 0}to{background-position:140% 0,0 0}}
.mn-rail .mn-ask form .mn-input{flex:1;min-width:0;border:0;background:none;padding:6px 0;font:15px/1.5 ${SERIF};color:var(--mn-fg);box-shadow:none;outline:none}
.mn-rail .mn-ask form .mn-input::placeholder{font-style:italic;color:color-mix(in srgb,var(--mn-muted) 85%,transparent)}
.mn-rail .mn-ask form .mn-btn{display:none}
/* a note: the sentence it is about (a fold), the conversation, the line to go on */
.rail-note{position:absolute;left:0;right:0;padding:2px 0 2px 14px;border-left:1px solid var(--mn-border);transition:top .35s cubic-bezier(.3,0,.2,1),border-color .2s;animation:rail-in .4s ease-out both}
.rail-note.inline{position:relative;top:auto!important;margin:6px 0 18px}
.rail-note.lit,.rail-note:focus-within{border-left-color:var(--note-ink)}
.note-head{display:block;width:100%;border:0;background:none;padding:2px 0 8px;text-align:left;cursor:pointer;font:italic 14px/1.6 ${SERIF};color:var(--mn-fg)}
.rail-note.folded .note-head{display:-webkit-box;-webkit-line-clamp:1;-webkit-box-orient:vertical;overflow:hidden}
.rail-note.folded .note-body{display:none}
.rail-note .note-body .mn-card:first-child .mn-q.asked-default{display:none}
.mn-echo{background-image:linear-gradient(transparent 52%,var(--ink) 52%,var(--ink) 90%,transparent 90%);background-repeat:no-repeat;-webkit-box-decoration-break:clone;box-decoration-break:clone;color:inherit;background-color:transparent;padding:0 1px;border-radius:2px;transition:filter .2s}
.mn-echo.draw{animation:ink-draw .8s cubic-bezier(.4,0,.2,1) both}
.mn-echo.lit{filter:saturate(1.6) brightness(.97)}
.mn-para{transition:background-color .25s,box-shadow .25s;border-radius:5px}
.mn-para.lit{background-color:color-mix(in srgb,var(--mn-accent) 5%,transparent);box-shadow:0 0 0 6px color-mix(in srgb,var(--mn-accent) 5%,transparent)}
/* phones: the line at the bottom of the screen; the conversation opens above it */
@media (max-width:900px){
 .mn-app.mn-textstep .mn-side.mn-railed{min-height:0}
 .rail-talk,.mn-app:not(.mn-textstep) .rail-talk{position:fixed;top:auto;left:0;right:0;bottom:0;z-index:25;margin:0;padding:8px 18px calc(10px + env(safe-area-inset-bottom));max-height:min(64vh,560px);overflow:auto;background:color-mix(in srgb,var(--mn-bg) 90%,transparent);-webkit-backdrop-filter:blur(14px);backdrop-filter:blur(14px);border-top:1px solid var(--mn-border)}
 .rail-talk:not(:focus-within) .rail-qs{display:none}
 .mn-app.mn-has-rail{padding-bottom:76px}
}
@media (prefers-reduced-motion:reduce){.mn-rail *,.rail-note,.mn-para,.mn-echo{animation:none!important;transition:none!important}}
`;
let injected = false;

/** Suggested questions for the step on screen: recorded ones first, then the lesson's misconceptions as questions. */
function suggestions(cl: CourseLesson, lesson: Lesson, step_id: string | undefined): string[] {
  const lang = ui_lang();
  const words = RECORDED_TEXT.filter((r) => r.lesson === cl.id && (!r.step || r.step === step_id)).map((r) => r.question[lang]);
  const scenes: Record<string, number[]> = { 'best-angle': [0, 1, 2, 3], pizza: [4, 5], 'inscribed-angles': [1] };
  const recorded = (scenes[cl.id] ?? []).map((i) => recorded_question(RECORDED[i], lang));
  if (words.length || recorded.length) return [...words, ...recorded].slice(0, 2);
  const lower = (s: string) => (/^[A-Z][a-z]/.test(s) ? s.charAt(0).toLowerCase() + s.slice(1) : s);
  if (cl.entry) return cl.entry.objectives.slice(0, 2).map((o) => t('why_true', { o: lower(o).replace(/\.$/, '') }));
  return (lesson.misconceptions ?? []).slice(0, 2).map((m) => t('is_it_true', { d: lower(tr(m.description, lang)).replace(/[.。]$/, '') }));
}

/**
 * The two questions at the top of the margin: what a curious learner would most want to ask after this page, written
 * by the model from the page itself (the same for everyone, so the server's answer cache serves it), kept in the browser.
 * Offline, the recorded questions. None on a question step (they would give the answer away).
 */
async function starters(cl: CourseLesson, lesson: Lesson, s: Step, view: LessonView): Promise<string[]> {
  if (s.kind === 'checkpoint') return [];
  if (!has_model()) return suggestions(cl, lesson, s.id);
  const lang = ui_lang();
  const key = `mathnim.starters.${lesson.id}.${s.id}.${lang}`;
  try {
    const kept = JSON.parse(localStorage.getItem(key) ?? 'null');
    if (Array.isArray(kept)) return kept;
  } catch {
    /* none kept */
  }
  const page = is_text_step(s) ? describe_step(s, lang) : [s.narration ? view.runtime.text(s.narration) : '', view.root.querySelector('.mn-side .mn-prompt')?.textContent ?? ''].join('\n');
  const zh = lang === 'zh';
  const system = `You write the two questions a curious, sharp learner would most want to ask right after reading one page of a lesson. Each question: in ${zh ? 'Simplified Chinese, at most 18 characters' : 'English, at most 10 words'}; about something specific on this page; asks why, what for, or what would happen, not for a definition; not a quiz question. Reply with JSON only: {"questions": ["...", "..."]}`;
  const content = `LESSON: ${tr(lesson.title, lang)}\nPAGE: ${tr(s.title, lang)}\n\n${page.slice(0, 2600)}`;
  const raw = await provider().complete({ system, messages: [{ role: 'user', content }], json: true, reasoning: 'off', max_tokens: 240, shared: true });
  const qs = (JSON.parse(raw).questions as unknown[]).filter((q): q is string => typeof q === 'string' && q.trim().length > 1).map((q) => q.trim()).slice(0, 2);
  try {
    localStorage.setItem(key, JSON.stringify(qs));
  } catch {
    /* no storage */
  }
  return qs;
}

// ---------------------------------------------------------------- kept conversations
interface Saved {
  turns: { q: string; a: string }[];
  folded?: boolean;
  /** A note's sentence, as selected. */
  phrase?: string;
  /** Its first ink. */
  ink?: number;
}
const notes_key = (lesson_id: string) => `mathnim.notes.${lesson_id}`;
function load_notes(lesson_id: string): Record<string, Saved> {
  try {
    const all = JSON.parse(localStorage.getItem(notes_key(lesson_id)) ?? '{}') as Record<string, Saved>;
    for (const k of Object.keys(all)) if (!Array.isArray(all[k]?.turns)) delete all[k];
    return all;
  } catch {
    return {};
  }
}
function store_note(lesson_id: string, key: string, s: Saved | null): void {
  const all = load_notes(lesson_id);
  if (s && s.turns.length) all[key] = s;
  else delete all[key];
  try {
    localStorage.setItem(notes_key(lesson_id), JSON.stringify(all));
  } catch {
    /* no storage */
  }
}
/** The next ink in turn for this lesson (each question gets the next colour). */
function next_ink(lesson_id: string): number {
  const key = `mathnim.ink.${lesson_id}`;
  let n = 0;
  try {
    n = Number(localStorage.getItem(key) ?? 0) || 0;
    localStorage.setItem(key, String(n + 1));
  } catch {
    /* no storage */
  }
  return n % INKS.length;
}

/** The paragraphs of a text page a sentence can be selected in. */
const PARAS = ['.mn-prose > p', '.mn-prose > ul > li', '.mn-prose > ol > li'].map((s) => `.mn-pagehost ${s}`).join(',');
const text_of = (el: Element) => (el.textContent ?? '').replace(/\s+/g, ' ').trim();
const wide = () => matchMedia('(min-width: 901px)').matches;

/** Mark a question with a stroke of highlighter (the question element's words move into the mark). */
function ink_question(q: HTMLElement, ink: number, draw: boolean): void {
  if (q.querySelector('.ink-q')) return;
  const mark = document.createElement('span');
  mark.className = `ink-q${draw ? ' draw' : ''}`;
  mark.style.setProperty('--ink', INKS[ink % INKS.length]);
  for (const n of [...q.childNodes]) if (!(n instanceof HTMLElement && n.classList.contains('mn-quote'))) mark.append(n);
  q.append(mark);
}

/** Highlight a sentence in its paragraph (the text node holding its start; never inside formulas). */
function echo(p: HTMLElement, phrase: string, ink: number, draw: boolean): HTMLElement | null {
  const head = phrase.slice(0, 16);
  const walk = document.createTreeWalker(p, NodeFilter.SHOW_TEXT, {
    acceptNode: (n) => ((n.parentElement?.closest('.katex,.mn-echo') ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT)),
  });
  for (let n = walk.nextNode() as Text | null; n; n = walk.nextNode() as Text | null) {
    const at = n.data.indexOf(head);
    if (at < 0) continue;
    const range = document.createRange();
    range.setStart(n, at);
    range.setEnd(n, Math.min(n.data.length, at + phrase.length));
    const mark = document.createElement('mark');
    mark.className = `mn-echo${draw ? ' draw' : ''}`;
    mark.style.setProperty('--ink', INKS[ink % INKS.length]);
    range.surroundContents(mark);
    return mark;
  }
  return null;
}

/** One conversation: the step's own (at the top of the margin), or a note on a selected sentence. */
class Note {
  readonly el: HTMLElement;
  readonly panel: AskPanel;
  private head: HTMLButtonElement | null = null;
  private mark: HTMLElement | null = null;
  /** A selected sentence attached to the next question. */
  quote = '';
  busy = false;
  private ink: number;
  private turns_shown = 0;
  constructor(
    readonly key: string,
    readonly para: HTMLElement | null,
    readonly phrase: string,
    saved: Saved | undefined,
    private rail: AskRail,
  ) {
    const el = (this.el = document.createElement('section'));
    el.className = phrase ? 'rail-note' : 'rail-convo';
    this.ink = saved?.ink ?? (phrase ? (next_ink(rail.lesson.id) + 2) % INKS.length : 0);
    el.style.setProperty('--note-ink', INKS[this.ink]);
    el.innerHTML = `${phrase ? `<button type="button" class="note-head"></button>` : ''}<div class="note-body"><div class="note-past"></div><div class="note-panel"></div></div>`;
    if (phrase) {
      this.head = el.querySelector('.note-head')!;
      this.head.innerHTML = `<span class="ink-q">${esc(phrase)}</span>`;
      this.head.querySelector<HTMLElement>('.ink-q')!.style.setProperty('--ink', INKS[this.ink]);
      this.head.onclick = () => this.fold(!el.classList.contains('folded'));
    }
    // the conversation so far (kept from an earlier visit), each question in its ink
    const past = el.querySelector<HTMLElement>('.note-past')!;
    (saved?.turns ?? []).forEach((turn, i) => {
      const c = document.createElement('div');
      c.className = 'mn-card';
      c.innerHTML = `<div class="mn-q">${math_html(turn.q)}</div><div class="mn-body"><div class="mn-answer-text">${math_html(turn.a)}</div></div>`;
      if (phrase && i === 0 && turn.q === t('explain_passage')) c.querySelector('.mn-q')!.classList.add('asked-default');
      ink_question(c.querySelector('.mn-q')!, this.ink_of(i), false);
      past.append(c);
    });
    this.turns_shown = saved?.turns.length ?? 0;
    this.panel = new AskPanel(el.querySelector<HTMLElement>('.note-panel')!, {
      provider, validate: worker_validator(), log, lesson: rail.lesson.id, thread: true, read_aloud: false,
      placeholder: t('ask_short'), history: saved?.turns,
      context: (): AskContext => rail.context(),
      // a note's sentence goes with every question asked in it
      extra: () => {
        const selected = this.quote || this.phrase;
        this.quote = '';
        return selected ? { selected } : undefined;
      },
      empty_question: () => (this.phrase && !this.panel.transcript().length ? t('explain_passage') : null),
      on_card: (card) => {
        this.busy = true;
        el.classList.add('busy');
        rail.talking(this);
        const q = card.querySelector<HTMLElement>('.mn-q')!;
        if (this.phrase && this.turns_shown === 0 && text_of(q) === t('explain_passage')) q.classList.add('asked-default');
        ink_question(q, this.ink_of(this.turns_shown++), true);
        this.fold_earlier(card);
        rail.layout();
      },
      on_done: () => {
        this.busy = false;
        el.classList.remove('busy');
        this.save();
        rail.layout();
      },
    });
    if (saved?.folded) el.classList.add('folded');
    this.fold_earlier(null);
    // a click on a folded question opens it again
    el.addEventListener('click', (e) => {
      const q = (e.target as Element).closest?.('.mn-card.past .mn-q');
      if (q) {
        q.closest('.mn-card')!.classList.remove('past');
        rail.layout();
      }
    });
    if (para && phrase) {
      this.mark = para.querySelector<HTMLElement>(`.mn-echo[data-note="${window.CSS.escape(key)}"]`) ?? echo(para, phrase, this.ink, !saved);
      this.mark?.setAttribute('data-note', key);
      // the note and its sentence light up together
      const lit = (on: boolean) => {
        el.classList.toggle('lit', on);
        para.classList.toggle('lit', on);
        this.mark?.classList.toggle('lit', on);
      };
      el.addEventListener('mouseenter', () => lit(true));
      el.addEventListener('mouseleave', () => lit(false));
      this.mark?.addEventListener('mouseenter', () => lit(true));
      this.mark?.addEventListener('mouseleave', () => lit(false));
      this.mark?.addEventListener('click', () => this.fold(false, true));
    }
  }
  /** The ink of the conversation's i-th question: a note starts from its own, the step's conversation from the first. */
  private ink_of(i: number): number {
    return (this.ink + i) % INKS.length;
  }
  /** Fold every answer but the newest. */
  private fold_earlier(newest: HTMLElement | null): void {
    const cards = [...this.el.querySelectorAll<HTMLElement>('.mn-card')];
    const last = newest ?? cards[cards.length - 1];
    for (const c of cards) c.classList.toggle('past', c !== last);
  }
  /** Fold every answer of this conversation to its question. */
  fold_all(): void {
    for (const c of this.el.querySelectorAll<HTMLElement>('.mn-card')) c.classList.add('past');
  }
  get asked(): boolean {
    return this.panel.transcript().length > 0 || this.busy;
  }
  focus(): void {
    this.panel.focus();
  }
  fold(folded: boolean, focus = false): void {
    this.el.classList.toggle('folded', folded);
    this.save();
    this.rail.layout();
    if (!folded && focus) this.focus();
  }
  save(): void {
    store_note(this.rail.lesson.id, this.key, { turns: this.panel.transcript(), folded: this.el.classList.contains('folded'), phrase: this.phrase || undefined, ink: this.ink });
  }
  destroy(): void {
    this.panel.clear();
    this.el.remove();
    if (this.mark) this.mark.replaceWith(...this.mark.childNodes);
    this.para?.classList.remove('lit');
  }
}

export class AskRail {
  /** The margin; the lesson view puts it in its side column. */
  readonly el: HTMLElement;
  private talk: HTMLElement;
  private qs: HTMLElement;
  private convo: Note | null = null;
  private view: LessonView | null = null;
  private off: (() => void) | null = null;
  private notes = new Map<string, Note>();
  private ro: ResizeObserver;
  private queued = false;
  private unlisten: (() => void)[] = [];

  constructor(private cl: CourseLesson, readonly lesson: Lesson) {
    if (!injected) {
      injected = true;
      const s = document.createElement('style');
      s.textContent = CSS;
      document.head.append(s);
    }
    const el = (this.el = document.createElement('aside'));
    el.setAttribute('aria-label', t('ask_ai'));
    el.innerHTML = `<div class="rail-talk"><div class="rail-qs"></div></div>`;
    this.talk = el.querySelector('.rail-talk')!;
    this.qs = el.querySelector('.rail-qs')!;
    this.ro = new ResizeObserver(() => this.layout());
    const on_resize = () => this.layout();
    addEventListener('resize', on_resize);
    this.unlisten.push(() => removeEventListener('resize', on_resize));
  }

  /** Follow this lesson view: its steps' conversations, its pages' notes. */
  attach(view: LessonView): void {
    this.view = view;
    this.off = view.runtime.on((e) => {
      if (e.type === 'step') this.on_step();
      else if (e.type === 'page') requestAnimationFrame(() => this.on_page());
    });
    this.on_step();
  }

  /** "问这句": a note on the selected sentence, beside its paragraph. */
  open(ask: { selected?: string }): void {
    const phrase = (ask.selected ?? '').trim();
    const head = phrase.slice(0, 16);
    const para = head ? this.paras().find((p) => text_of(p).includes(head)) : undefined;
    if (!para) {
      // not on a paragraph (a scene, a question): the step's conversation, with the passage attached
      if (this.convo && phrase) this.convo.quote = phrase;
      this.convo?.focus();
      return;
    }
    const key = `${this.step_id()}#${this.paras().indexOf(para)}:${phrase.slice(0, 40)}`;
    const n = this.notes.get(key) ?? this.add(new Note(key, para, phrase, undefined, this));
    this.convo?.fold_all(); // (the conversation steps back so the note has room)
    n.fold(false);
    n.focus();
  }

  destroy(): void {
    this.off?.();
    for (const u of this.unlisten) u();
    this.ro.disconnect();
    for (const n of this.notes.values()) n.destroy();
    this.notes.clear();
    this.convo?.destroy();
    this.el.remove();
    this.view = null;
  }

  /** What the tutor knows (a note's sentence comes with its own questions). */
  context(): AskContext {
    return this.view ? lesson_context(this.cl, this.view) : {};
  }
  /** A conversation started: the step's suggestions give way to it. */
  talking(n: Note): void {
    if (n === this.convo) this.talk.classList.add('active');
  }

  // ---------------------------------------------------------------- steps and pages
  private step_id(): string {
    return this.view?.runtime.step?.id ?? '';
  }
  private on_step(): void {
    for (const n of this.notes.values()) n.destroy();
    this.notes.clear();
    this.convo?.destroy();
    this.ro.disconnect();
    this.qs.replaceChildren();
    const s = this.view?.runtime.step;
    if (!s || !this.view) return;
    // the step's conversation, kept from before if there is one
    const key = `${s.id}#talk`;
    const saved = load_notes(this.lesson.id)[key];
    this.convo = new Note(key, null, '', saved, this);
    this.talk.classList.toggle('active', !!saved);
    this.talk.append(this.convo.el);
    starters(this.cl, this.lesson, s, this.view).then((qs) => {
      if (this.view?.runtime.step !== s) return; // the learner moved on meanwhile
      this.qs.replaceChildren(...qs.map((q) => {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'rail-q';
        b.innerHTML = math_html(q);
        b.onclick = () => void this.convo?.panel.ask(q);
        return b;
      }));
    }, (e) => console.warn('starter questions', e));
    this.layout();
  }
  private on_page(): void {
    const view = this.view;
    const s = view?.runtime.step;
    if (!view || !s || !is_text_step(s)) return;
    const paras = [...view.root.querySelectorAll<HTMLElement>(PARAS)].filter((p) => !p.classList.contains('mn-para'));
    paras.forEach((p) => p.classList.add('mn-para'));
    // the notes left on this page before
    const saved = load_notes(this.lesson.id);
    for (const [key, kept] of Object.entries(saved)) {
      const m = /^(.*)#(\d+):/.exec(key);
      if (!m || m[1] !== s.id || !kept.phrase) continue;
      const para = this.paras()[Number(m[2])];
      if (para) this.add(new Note(key, para, kept.phrase, kept, this));
    }
    const page = view.root.querySelector<HTMLElement>('.mn-pagehost');
    if (page) this.ro.observe(page);
    this.layout();
  }
  private paras(): HTMLElement[] {
    return [...(this.view?.root.querySelectorAll<HTMLElement>('.mn-para') ?? [])];
  }

  // ---------------------------------------------------------------- notes
  private add(n: Note): Note {
    this.notes.set(n.key, n);
    this.ro.observe(n.el);
    // beside the page in the margin; under its paragraph on phones
    const margin = wide();
    n.el.classList.toggle('inline', !margin);
    if (margin || !n.para) this.el.append(n.el);
    else n.para.after(n.el);
    this.layout();
    return n;
  }

  /** Lay the notes beside their paragraphs, never overlapping one another. */
  layout(): void {
    if (this.queued) return;
    this.queued = true;
    requestAnimationFrame(() => {
      this.queued = false;
      const notes = [...this.notes.values()].filter((n) => n.el.isConnected && !n.el.classList.contains('inline'));
      const order = (n: Note) => (n.para ? this.paras().indexOf(n.para) : -1);
      notes.sort((a, b) => order(a) - order(b));
      const base = this.el.getBoundingClientRect().top;
      // (below the conversation where it sits at the top of the page; it covers notes only as they scroll under it)
      let floor = this.talk.offsetHeight + 12;
      for (const n of notes) {
        const top = Math.max(n.para ? n.para.getBoundingClientRect().top - base : 0, floor);
        n.el.style.top = `${top}px`;
        floor = top + n.el.offsetHeight + 18;
      }
      this.el.style.minHeight = notes.length ? `${floor}px` : '';
    });
  }
}
