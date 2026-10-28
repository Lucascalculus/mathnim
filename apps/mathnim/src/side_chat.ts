// The tutor in the margin. At the top of a lesson's side column (it follows
// the scroll) is the line to ask on ("ASK · 0n") with two questions the model
// wrote for the step. A question asked there becomes a note in the margin
// beside the paragraph being read: its head ("ASK · 01"), the question under a
// stroke of highlighter (a different colour each time), the answer as ink
// spreading on paper. A click on the head or the question folds it.
// A sentence selected on a page and asked about ("问这句") becomes a note
// beside its paragraph too: the sentence is highlighted in the text and in the
// note, in the same colour. Notes reopen to go on asking, and are kept.
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
.mn-app:not(.mn-textstep) .rail-talk{position:relative;top:auto;margin-top:0;max-height:none;overflow:visible}
.rail-qs{display:flex;flex-direction:column;margin-bottom:6px}
.rail-q,:is(.mn-rail,.rail-note) .mn-chip{display:block;width:100%;text-align:left;border:0;background:none;padding:4px 0;margin:0;border-radius:0;font:italic 14px/1.55 ${SERIF};color:var(--mn-muted);cursor:pointer;transition:color .15s;animation:rail-in .55s cubic-bezier(.2,.8,.2,1) both}
.rail-q:nth-child(2){animation-delay:.08s}
.rail-q:hover,:is(.mn-rail,.rail-note) .mn-chip:hover{color:var(--mn-fg);border:0}
@keyframes rail-in{from{opacity:0;transform:translateY(5px)}to{opacity:1;transform:none}}
.rail-talk.waiting{display:none!important}
/* the line's label ("ASK · 03": the number the next question will have), and an asked note's head (its first question when folded) */
.ask-head{margin:0 0 8px}
.ask-n,.ask-note .note-head{font:500 10px/1.6 ui-monospace,SFMono-Regular,Menlo,monospace;letter-spacing:.14em;color:color-mix(in srgb,var(--mn-fg) 55%,transparent)}
.ask-n{white-space:nowrap}
.ask-note .note-head{display:flex;gap:10px;align-items:baseline;padding:2px 0 6px}
.ask-note .note-head:hover{color:var(--mn-accent)}
.ask-sum{display:none;flex:1;min-width:0;font:italic 13px/1.5 ${SERIF};letter-spacing:0;color:var(--mn-muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.ask-note.folded .ask-sum{display:block}
.ask-note.folded .note-head{display:flex;-webkit-line-clamp:unset}
.ask-note .mn-card:not(.past)>.mn-q{cursor:pointer}
/* a conversation: each question under a stroke of highlighter, the answer in ink */
:is(.mn-rail,.rail-note) .mn-ask{gap:12px}
:is(.mn-rail,.rail-note) .mn-card{border:0;box-shadow:none;background:none;border-radius:0;overflow:visible}
:is(.mn-rail,.rail-note) .mn-card .mn-q{padding:0;border:0;background:none;font:italic 15px/1.6 ${SERIF};color:var(--mn-fg);cursor:default}
:is(.mn-rail,.rail-note) .mn-q .mn-quote{display:none}
.ink-q{background-image:linear-gradient(transparent 52%,var(--ink) 52%,var(--ink) 90%,transparent 90%);background-repeat:no-repeat;background-size:100% 100%;-webkit-box-decoration-break:clone;box-decoration-break:clone;padding:0 2px}
.ink-q.draw{animation:ink-draw .7s cubic-bezier(.4,0,.2,1) both}
@keyframes ink-draw{from{background-size:0 100%}to{background-size:100% 100%}}
:is(.mn-rail,.rail-note) .mn-card .mn-body{padding:6px 0 0;gap:8px}
:is(.mn-rail,.rail-note) .mn-answer-text{font:15px/1.8 ${SERIF};color:var(--mn-fg)}
:is(.mn-rail,.rail-note) .mn-answer-text:not(:empty){animation:ink-in 1.1s ease-out both}
@keyframes ink-in{from{opacity:0;filter:blur(5px)}to{opacity:1;filter:none}}
:is(.mn-rail,.rail-note) .mn-card details,:is(.mn-rail,.rail-note) .mn-card .mn-status{display:none}
:is(.mn-rail,.rail-note) .ai-fail{font:italic 14px/1.6 ${SERIF};color:var(--mn-muted)}
:is(.mn-rail,.rail-note) .mn-card .mn-actions .mn-btn{border:0;background:none;box-shadow:none;padding:2px 0;font:italic 13.5px/1.4 ${SERIF};color:var(--mn-muted);cursor:pointer}
:is(.mn-rail,.rail-note) .mn-card .mn-actions .mn-btn:hover{color:var(--mn-accent)}
:is(.mn-rail,.rail-note) .mn-chips{flex-direction:column;align-items:stretch;gap:0}
/* earlier turns fold to their question; a click opens one again */
:is(.mn-rail,.rail-note) .mn-card.past .mn-body{display:none}
:is(.mn-rail,.rail-note) .mn-card.past .mn-q{cursor:pointer;opacity:.7}
:is(.mn-rail,.rail-note) .mn-card.past .mn-q:hover{opacity:1}
/* the line to write on; a light runs along it while the tutor writes */
:is(.mn-rail,.rail-note) .mn-ask form{position:relative;display:flex;align-items:center;gap:6px;padding:2px 0 6px}
:is(.mn-rail,.rail-note) .mn-ask form::after{content:'';position:absolute;left:0;right:0;bottom:0;height:1px;background:color-mix(in srgb,var(--mn-fg) 28%,transparent);transition:background-color .2s}
:is(.mn-rail,.rail-note) .mn-ask form:focus-within::after{background:var(--mn-accent)}
:is(.mn-rail,.rail-note) .busy .mn-ask form::after,.rail-note.busy .mn-ask form::after{background:linear-gradient(90deg,transparent,var(--mn-accent),transparent) 0 0/40% 100% no-repeat,color-mix(in srgb,var(--mn-fg) 28%,transparent);animation:rail-run 1.2s linear infinite}
@keyframes rail-run{from{background-position:-40% 0,0 0}to{background-position:140% 0,0 0}}
:is(.mn-rail,.rail-note) .mn-ask form .mn-input{flex:1;min-width:0;border:0;background:none;padding:6px 0;font:15px/1.5 ${SERIF};color:var(--mn-fg);box-shadow:none;outline:none}
:is(.mn-rail,.rail-note) .mn-ask form .mn-input::placeholder{font-style:italic;color:color-mix(in srgb,var(--mn-muted) 85%,transparent)}
:is(.mn-rail,.rail-note) .mn-ask form .mn-btn{display:none}
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
/* the conversation block on wide screens: an engineering drawing (a dot grid, crop marks at the corners, a small label) */
@media (min-width:901px){
.rail-talk{margin-top:0;top:calc(var(--mn-sticky-top,58px) + 10px);max-height:calc(100vh - var(--mn-sticky-top,58px) - 20px);box-shadow:0 -10px 0 var(--mn-bg)}
.rail-talk::before{content:'';position:absolute;left:0;right:0;top:-10px;height:10px;background:var(--mn-bg)}
.rail-talk{--g:color-mix(in srgb,var(--mn-fg) 16%,transparent);--m:color-mix(in srgb,var(--mn-fg) 55%,transparent);padding:12px 18px 14px;background:linear-gradient(var(--m),var(--m)) 0 0/12px 1px no-repeat,linear-gradient(var(--m),var(--m)) 0 0/1px 12px no-repeat,linear-gradient(var(--m),var(--m)) 100% 0/12px 1px no-repeat,linear-gradient(var(--m),var(--m)) 100% 0/1px 12px no-repeat,linear-gradient(var(--m),var(--m)) 0 100%/12px 1px no-repeat,linear-gradient(var(--m),var(--m)) 0 100%/1px 12px no-repeat,linear-gradient(var(--m),var(--m)) 100% 100%/12px 1px no-repeat,linear-gradient(var(--m),var(--m)) 100% 100%/1px 12px no-repeat,radial-gradient(var(--g) 1px,transparent 1.3px) 0 0/14px 14px,var(--mn-bg)}

.rail-talk .rail-q{font:500 14px/1.55 Inter,ui-sans-serif,system-ui,"PingFang SC",sans-serif;font-style:normal;color:var(--mn-fg);padding-left:18px;position:relative}
.rail-talk .rail-q::before{content:'→';position:absolute;left:0;font:12px/1.9 ui-monospace,Menlo,monospace;color:var(--mn-accent)}
.rail-talk .mn-ask form .mn-input{font:14px/1.5 ui-monospace,SFMono-Regular,Menlo,monospace}
}
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
  const page = is_text_step(s) ? describe_step(s, lang) : [s.narration ? view.runtime.text(s.narration) : '', view.runtime.step === s ? view.root.querySelector('.mn-side .mn-prompt')?.textContent ?? '' : ''].join('\n');
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
  /** The paragraph it was asked beside (a question asked on the line). */
  at?: number;
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

/** A conversation's number from its key ("<step>#talk" is 1, "<step>#talk.2" is 2). */
const ask_number = (key: string) => Number(/#talk\.(\d+)$/.exec(key)?.[1] ?? 1);

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
    el.className = phrase ? 'rail-note' : 'rail-note ask-note';
    this.ink = saved?.ink ?? (phrase ? (next_ink(rail.lesson.id) + 2) % INKS.length : next_ink(rail.lesson.id));
    el.style.setProperty('--note-ink', INKS[this.ink]);
    el.innerHTML = `<button type="button" class="note-head"></button><div class="note-body"><div class="note-past"></div><div class="note-panel"></div></div>`;
    this.head = el.querySelector('.note-head')!;
    if (phrase) {
      this.head.innerHTML = `<span class="ink-q">${esc(phrase)}</span>`;
      this.head.querySelector<HTMLElement>('.ink-q')!.style.setProperty('--ink', INKS[this.ink]);
    } else {
      this.head.innerHTML = `<span class="ask-n">ASK · ${String(ask_number(key)).padStart(2, '0')}</span><span class="ask-sum"></span>`;
    }
    this.head.onclick = () => this.fold(!el.classList.contains('folded'));
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
        // no words after a while (no model, the network, too many questions): say so rather than wait in silence
        setTimeout(() => this.no_answer(card), 25000);
        this.busy = true;
        el.classList.add('busy');
        const q = card.querySelector<HTMLElement>('.mn-q')!;
        if (this.phrase && this.turns_shown === 0 && text_of(q) === t('explain_passage')) q.classList.add('asked-default');
        ink_question(q, this.ink_of(this.turns_shown++), true);
        this.label();
        this.fold_earlier(card);
        rail.layout();
      },
      on_done: (card) => {
        this.no_answer(card, true);
        this.busy = false;
        el.classList.remove('busy');
        this.save();
        rail.layout();
      },
    });
    if (saved?.folded) el.classList.add('folded');
    this.fold_earlier(null);
    this.label();
    // a click on an earlier question opens it again; on the newest, folds the note
    el.addEventListener('click', (e) => {
      const q = (e.target as Element).closest?.('.mn-card .mn-q');
      if (!q) return;
      const card = q.closest('.mn-card')!;
      if (card.classList.contains('past')) {
        card.classList.remove('past');
        rail.layout();
      } else this.fold(true);
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
  /** A card left without an answer gets one short line; `done` checks at once, else only if nothing has come yet. */
  private no_answer(card: HTMLElement, done = false): void {
    const words = card.querySelector('.mn-answer-text')?.textContent?.trim();
    const picture = card.querySelector('.mn-picture canvas, .mn-wait');
    if (words || (!done && picture) || card.querySelector('.ai-fail') || !card.isConnected) return;
    card.querySelector('.mn-body')?.append(Object.assign(document.createElement('div'), { className: 'ai-fail', textContent: t('ai_offline') }));
    this.busy = false;
    this.el.classList.remove('busy');
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
  /** An asked note's head shows its first question (seen when folded). */
  private label(): void {
    const sum = this.el.querySelector('.ask-sum');
    const first = this.el.querySelector<HTMLElement>('.mn-card .mn-q');
    if (sum && first) sum.textContent = text_of(first);
  }
  get folded(): boolean {
    return this.el.classList.contains('folded');
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
    const at = !this.phrase && this.para ? this.rail.paras().indexOf(this.para) : -1;
    store_note(this.rail.lesson.id, this.key, { turns: this.panel.transcript(), folded: this.folded, phrase: this.phrase || undefined, ink: this.ink, at: at >= 0 ? at : undefined });
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
  private line: HTMLInputElement;
  private view: LessonView | null = null;
  private off: (() => void) | null = null;
  private notes = new Map<string, Note>();
  private ro: ResizeObserver;
  private queued = false;
  private unlisten: (() => void)[] = [];
  /** A selected sentence (not on a paragraph) attached to the next question. */
  private quote = '';

  constructor(private cl: CourseLesson, readonly lesson: Lesson) {
    if (!injected) {
      injected = true;
      const s = document.createElement('style');
      s.textContent = CSS;
      document.head.append(s);
    }
    const el = (this.el = document.createElement('aside'));
    el.setAttribute('aria-label', t('ask_ai'));
    el.innerHTML = `<div class="rail-talk"><div class="ask-head"><span class="ask-n"></span></div><div class="rail-qs"></div><div class="mn-ask"><form><input class="mn-input" type="text" autocomplete="off" placeholder="${esc(t('ask_short'))}"></form></div></div>`;
    this.talk = el.querySelector('.rail-talk')!;
    this.qs = el.querySelector('.rail-qs')!;
    this.line = el.querySelector('.mn-input')!;
    el.querySelector('form')!.onsubmit = (e) => {
      e.preventDefault();
      const q = this.line.value.trim();
      if (!q) return;
      this.line.value = '';
      this.ask_here(q);
    };
    this.ro = new ResizeObserver(() => this.layout());
    const on_resize = () => this.layout();
    addEventListener('resize', on_resize);
    this.unlisten.push(() => removeEventListener('resize', on_resize));
  }

  /** Follow this lesson view: its steps' questions, its pages' notes. */
  attach(view: LessonView): void {
    this.view = view;
    let seen = false;
    const mo = new MutationObserver(() => {
      if (seen) return;
      seen = true;
      requestAnimationFrame(() => {
        seen = false;
        this.on_page();
      });
    });
    mo.observe(view.root, { childList: true, subtree: true });
    this.unlisten.push(() => mo.disconnect());
    this.off = view.runtime.on((e) => {
      if (e.type === 'step') this.on_step();
      // on a question step the line waits until the answer and its explanation are out
      else if (e.type === 'graded' && (e.final || e.grade.correct)) this.talk.classList.remove('waiting');
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
      // not on a paragraph (a scene, a question): the line, with the passage attached
      this.quote = phrase;
      this.line.focus();
      return;
    }
    const key = `${this.step_id()}#${this.paras().indexOf(para)}:${phrase.slice(0, 40)}`;
    const n = this.notes.get(key) ?? this.add(new Note(key, para, phrase, undefined, this));
    n.fold(false);
    n.focus();
  }

  destroy(): void {
    this.off?.();
    for (const u of this.unlisten) u();
    this.ro.disconnect();
    for (const n of this.notes.values()) n.destroy();
    this.notes.clear();
    this.el.remove();
    this.view = null;
  }

  /** What the tutor knows (a note's sentence comes with its own questions). */
  context(): AskContext {
    return this.view ? lesson_context(this.cl, this.view) : {};
  }

  // ---------------------------------------------------------------- asking on the line
  /** A question from the line: a new note beside the paragraph being read (the others fold to their head). */
  private ask_here(q: string): void {
    const s = this.view?.runtime.step;
    if (!s) return;
    const n = this.add(new Note(`${s.id}#talk.${this.next_number()}`, this.reading(), '', undefined, this));
    for (const o of this.notes.values()) if (o !== n && !o.phrase && !o.folded) o.fold(true);
    n.quote = this.quote;
    this.quote = '';
    void n.panel.ask(q);
    for (const b of this.qs.querySelectorAll('.rail-q')) if (b.textContent === q) b.remove();
    this.number();
  }
  /** The next question's number on this step. */
  private next_number(): number {
    const s = this.step_id();
    const taken = [...this.notes.keys(), ...Object.keys(load_notes(this.lesson.id))].filter((k) => k === `${s}#talk` || k.startsWith(`${s}#talk.`));
    return Math.max(0, ...taken.map(ask_number)) + 1;
  }
  private number(): void {
    this.talk.querySelector('.ask-n')!.textContent = `ASK · ${String(this.next_number()).padStart(2, '0')}`;
  }
  /** The paragraph being read: the first one just under the line (on phones, near the top of the screen), else the last begun. */
  private reading(): HTMLElement | null {
    const paras = this.paras();
    const y = wide() ? this.talk.getBoundingClientRect().bottom - 8 : 80;
    const tops = paras.map((p) => p.getBoundingClientRect().top);
    const i = tops.findIndex((t) => t >= y && t < innerHeight);
    if (i >= 0) return paras[i];
    const begun = tops.filter((t) => t < innerHeight).length;
    return begun ? paras[begun - 1] : null;
  }

  // ---------------------------------------------------------------- steps and pages
  private step_id(): string {
    return this.view?.runtime.step?.id ?? '';
  }
  private on_step(): void {
    for (const n of this.notes.values()) n.destroy();
    this.notes.clear();
    this.ro.disconnect();
    this.qs.replaceChildren();
    this.quote = '';
    const s = this.view?.runtime.step;
    if (!s || !this.view) return;
    this.talk.classList.toggle('waiting', s.kind === 'checkpoint');
    this.number();
    // questions asked here before, not beside a paragraph (a scene, a question; earlier conversations)
    for (const [k, kept] of Object.entries(load_notes(this.lesson.id))) {
      if ((k === `${s.id}#talk` || k.startsWith(`${s.id}#talk.`)) && kept.at === undefined) this.add(new Note(k, null, '', kept, this));
    }
    starters(this.cl, this.lesson, s, this.view).then((qs) => {
      if (this.view?.runtime.step !== s) return; // the learner moved on meanwhile
      this.qs.replaceChildren(...qs.map((q) => {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'rail-q';
        b.innerHTML = math_html(q);
        b.onclick = () => this.ask_here(q);
        return b;
      }));
    }, (e) => console.warn('starter questions', e)).finally(() => this.preload(s));
    // (a page's paragraphs can arrive after its event, as on a reload: look again when the lesson's content changes)
    requestAnimationFrame(() => this.on_page());
    this.layout();
  }
  /** The questions of the next two steps, written while this one is read (kept, so they appear at once). */
  private preload(from: Step): void {
    const view = this.view;
    if (!view || !has_model()) return;
    const steps = view.runtime.lesson.steps;
    const next = steps.slice(steps.indexOf(from) + 1).filter((s) => s.kind !== 'checkpoint' && !s.branch_only).slice(0, 2);
    void next.reduce<Promise<unknown>>((p, s) => p.then(() => starters(this.cl, this.lesson, s, view).catch(() => null)), Promise.resolve());
  }
  private on_page(): void {
    const view = this.view;
    const s = view?.runtime.step;
    if (!view || !s || !is_text_step(s)) return;
    const paras = [...view.root.querySelectorAll<HTMLElement>(PARAS)].filter((p) => !p.classList.contains('mn-para'));
    if (!paras.length) return; // (nothing new on the page)
    paras.forEach((p) => p.classList.add('mn-para'));
    // the notes left on this page before: on sentences, and questions asked beside a paragraph
    const saved = load_notes(this.lesson.id);
    for (const [key, kept] of Object.entries(saved)) {
      if (this.notes.has(key)) continue;
      const m = /^(.*)#(\d+):/.exec(key);
      if (m && m[1] === s.id && kept.phrase) {
        const para = this.paras()[Number(m[2])];
        if (para) this.add(new Note(key, para, kept.phrase, kept, this));
      } else if ((key === `${s.id}#talk` || key.startsWith(`${s.id}#talk.`)) && kept.at !== undefined) {
        const para = this.paras()[kept.at];
        if (para) this.add(new Note(key, para, '', kept, this));
      }
    }
    const page = view.root.querySelector<HTMLElement>('.mn-pagehost');
    if (page) this.ro.observe(page);
    this.layout();
  }
  paras(): HTMLElement[] {
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
      notes.sort((a, b) => order(a) - order(b) || ask_number(a.key) - ask_number(b.key));
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
