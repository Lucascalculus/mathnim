// The tutor in the margin. At the top of a lesson's side column (it follows
// the scroll) is the line to ask on ("ASK · 0n") with two questions the model
// wrote for the step. A question asked there becomes a note in the margin
// beside the paragraph being read: its head ("ASK · 01"), the question under a
// stroke of highlighter (a different colour each time), the answer as ink
// spreading on paper. A click on the head or the question folds it.
// A passage selected on any page and asked about ("问这句": a paragraph, a
// line of a derivation, a question's prompt, a video's caption) becomes a note
// beside it too: the passage is highlighted in the text, and the note holds
// only the conversation. Notes reopen to go on asking, are kept, and can be
// deleted. A question goes on being answered when the learner reads on (its
// words, its picture): what arrives is kept and shown when they come back.
// Under an answer on a text page: put it in the page's text. When a question
// shows a gap the lesson takes for granted, the tutor offers to write a whole
// page for this learner (added after the step, on their yes).
// On phones the line sits at the bottom of the screen and the conversation
// opens above it; notes sit under their paragraph.
// The question goes out with the lesson, the step, what is on screen, the
// selected sentence and the learner's recent mistakes; answers stream.
import { AskPanel, RECORDED, RECORDED_TEXT, draw_saved, propose_page, recorded_question, worker_validator, write_page, type AskContext, type PageProposal, type SavedPicture } from '@mathnim/ai';
import { describe_step, is_text_step, tr, type Lesson, type Step } from '@mathnim/core';
import { esc, math_html, reading, t, ui_lang, type LessonView } from '@mathnim/present';
import type { ScenePlayer } from 'manim-web/ext/player';
import { add_answer, add_page, added_answers, added_pages, is_added_page, remove_answer, remove_page, type AddedAnswer } from './added';
import { lesson_path, type CourseLesson } from './course';
import { navigate } from './router';
import { has_model, provider } from './settings';
import { SHEET } from './sheet';
import { log } from './store';
import { lesson_context } from './student';

const SERIF = `"Iowan Old Style","Palatino Linotype",Palatino,"Songti SC","Noto Serif SC","Source Han Serif SC",serif`;
const CHEV = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 14l5-5 5 5"/></svg>';
/** Highlighter inks: one per question, in turn. */
const INKS = ['#ffe27a', '#ffbfd2', '#b9ecc8', '#bcd9ff', '#d8c7ff', '#ffd2a3'];

/** The engineering sheet (a dot grid, crop marks at the corners): the ask box, and an open asked note. */


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
.ask-n{display:block;font:500 10px/1.6 ui-monospace,SFMono-Regular,Menlo,monospace;letter-spacing:.14em;color:color-mix(in srgb,var(--mn-fg) 55%,transparent);white-space:nowrap}
.ask-note .note-head{display:block;padding:0 0 6px}
.ask-note .note-head:hover .ask-n{color:var(--mn-accent)}
/* folded: the question as it reads when open (its highlighter, the tutor's serif), on one line */
.ask-sum{display:none;margin-top:6px;font:italic 15px/1.6 ${SERIF};color:var(--mn-fg);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.ask-note.folded .ask-sum{display:block}
.rail-note.ask-note.folded .note-head{display:block;-webkit-line-clamp:unset;overflow:visible;padding-bottom:2px}
/* open: drawn on the same sheet as the ask box */
.ask-note:not(.folded){border-left:0;${SHEET}}
.ask-note .mn-card:not(.past)>.mn-q{cursor:pointer}
/* an asked note's own line is quieter than the line at the top: no rule until it is pointed at or written on */
.ask-note .mn-ask form::after{opacity:0;transition:opacity .2s}
.ask-note:hover .mn-ask form::after,.ask-note .mn-ask form:focus-within::after,.ask-note.busy .mn-ask form::after{opacity:1}
.ask-note .mn-ask form .mn-input{font-size:14px}
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
.rail-note.inline{position:relative;top:auto!important;margin:6px 0 18px;scroll-margin:72px 0 96px}
.rail-note.lit,.rail-note:focus-within{border-left-color:var(--note-ink)}
.note-head{display:block;width:100%;border:0;background:none;padding:2px 0 8px;text-align:left;cursor:pointer;font:italic 14px/1.6 ${SERIF};color:var(--mn-fg)}
.note-head .mn-math{display:inline-block;max-width:100%;vertical-align:middle}
.note-head .mn-math svg{max-width:100%;height:auto}
.rail-note.folded .note-head{display:-webkit-box;-webkit-line-clamp:1;-webkit-box-orient:vertical;overflow:hidden}
.rail-note.folded .note-body{display:none}
.mn-echo{background-image:linear-gradient(transparent 52%,var(--ink) 52%,var(--ink) 90%,transparent 90%);background-repeat:no-repeat;-webkit-box-decoration-break:clone;box-decoration-break:clone;color:inherit;background-color:transparent;padding:0 1px;border-radius:2px;transition:filter .2s}
.mn-echo.draw{animation:ink-draw .8s cubic-bezier(.4,0,.2,1) both}
.mn-echo.lit{filter:saturate(1.6) brightness(.97)}
/* a formula's highlighter runs under its foot; a displayed one is marked only as wide as it is */
.mn-echo.formula{display:inline-block;background-image:linear-gradient(transparent 74%,var(--ink) 74%,var(--ink) 96%,transparent 96%)}
.mn-echo.formula:has(> .mn-math[data-display]){display:table;margin:0 auto}
.mn-para{transition:background-color .25s,box-shadow .25s;border-radius:5px}
.mn-para.lit{background-color:color-mix(in srgb,var(--mn-accent) 5%,transparent);box-shadow:0 0 0 6px color-mix(in srgb,var(--mn-accent) 5%,transparent)}
/* the conversation block on wide screens: an engineering drawing (a dot grid, crop marks at the corners, a small label) */
@media (min-width:901px){
.rail-talk{margin-top:0;top:calc(var(--mn-sticky-top,58px) + 10px);max-height:calc(100vh - var(--mn-sticky-top,58px) - 20px);box-shadow:0 -10px 0 var(--mn-bg)}
.rail-talk::before{content:'';position:absolute;left:0;right:0;top:-10px;height:10px;background:var(--mn-bg)}
.rail-talk{${SHEET}}

.rail-talk .rail-q{font:500 14px/1.55 ui-sans-serif,system-ui,"PingFang SC",sans-serif;font-style:normal;color:var(--mn-fg);padding-left:18px;position:relative}
.rail-talk .rail-q::before{content:'→';position:absolute;left:0;font:12px/1.9 ui-monospace,Menlo,monospace;color:var(--mn-accent)}
.rail-talk .mn-ask form .mn-input{font:14px/1.5 ui-monospace,SFMono-Regular,Menlo,monospace}
}
/* phones: the conversation opens over the page from the lesson bar's Ask, just above the bar (toggle_sheet) */
@media (max-width:900px){
 .mn-app.mn-textstep .mn-side.mn-railed{min-height:0}
 .mn-has-lessonbar .rail-talk:not(.open){display:none!important}
 .mn-has-lessonbar .rail-talk{bottom:calc(57px + env(safe-area-inset-bottom))!important;border-top:1px solid var(--mn-border);box-shadow:0 -12px 30px -18px rgba(0,0,0,.25)}
 .rail-talk,.mn-app:not(.mn-textstep) .rail-talk{position:fixed;top:auto;left:0;right:0;bottom:0;z-index:25;margin:0;padding:8px 18px calc(10px + env(safe-area-inset-bottom));max-height:min(64vh,560px);overflow:auto;background:color-mix(in srgb,var(--mn-bg) 90%,transparent);-webkit-backdrop-filter:blur(14px);backdrop-filter:blur(14px);border-top:1px solid var(--mn-border)}
 .rail-talk:not(:focus-within) .rail-qs{display:none}
 .mn-app.mn-has-rail:not(.mn-has-lessonbar){padding-bottom:76px}
}
.note-x{position:absolute;top:2px;right:0;width:22px;height:22px;border:0;background:none;padding:0;font:16px/22px ui-sans-serif,system-ui,sans-serif;color:var(--mn-muted);cursor:pointer;opacity:0;transition:opacity .15s,color .15s;border-radius:6px}
.rail-note:hover>.note-x,.rail-note:focus-within>.note-x,.mn-added:hover>.note-x,.note-x:focus-visible{opacity:.75}
.note-x:hover{opacity:1!important;color:var(--mn-fg);background:var(--mn-faint)}
@media (pointer:coarse){.rail-note>.note-x,.mn-added>.note-x{opacity:.6}}
.rail-note .note-head{padding-right:24px}
/* a passage that is not on the page any more (a video's caption): its words, since nothing marks them */
.note-quote{margin:0 0 8px;padding-left:8px;border-left:2px solid var(--note-ink);font:italic 13px/1.5 ${SERIF};color:var(--mn-muted);display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
.ai-wait{font:italic 14px/1.6 ${SERIF};color:var(--mn-muted)}
/* under an answer: put it in the page; a page offered by the tutor */
.note-acts{display:flex;gap:14px;margin-top:2px}
.note-act{border:0;background:none;padding:2px 0;font:italic 13.5px/1.4 ${SERIF};color:var(--mn-muted);cursor:pointer}
.note-act:hover{color:var(--mn-accent)}
.note-act.done{color:var(--mn-good)}
.page-offer{margin-top:10px;padding:8px 0 2px;border-top:1px dashed var(--mn-border)}
.page-offer-why{font:15px/1.65 ${SERIF};color:var(--mn-fg)}
.page-offer-acts{display:flex;gap:16px;margin-top:4px}
.page-offer .note-act.yes{color:var(--mn-accent);font-style:normal;font-weight:600}
/* an answer the learner put in the page: in the text, in its question's ink */
.mn-added{position:relative;margin:.4em 0 1.1em;padding:10px 30px 8px 16px;border-left:3px solid var(--ink);background:color-mix(in srgb,var(--ink) 14%,transparent);border-radius:0 10px 10px 0}
.mn-added.fresh{animation:rail-in .45s ease-out both}
.mn-added-q{font:italic 15px/1.6 ${SERIF};margin-bottom:4px}
.mn-added-a{line-height:1.7}
.mn-added .mn-picture{margin-top:10px}
.mn-added canvas.mn-answer{width:100%;aspect-ratio:16/9;display:block;border-radius:10px;background:#fff;border:1px solid var(--mn-border)}
/* a page written for this learner: said in the margin, with a way to take it out */
.rail-added{display:flex;flex-wrap:wrap;align-items:baseline;gap:4px 12px;margin:0 0 10px;font:italic 14px/1.5 ${SERIF};color:var(--mn-muted)}
.rail-added[hidden]{display:none}
@media (prefers-reduced-motion:reduce){.mn-rail *,.rail-note,.mn-para,.mn-echo,.mn-added{animation:none!important;transition:none!important}}
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
interface Turn {
  q: string;
  a: string;
  /** Its picture, when it had one (drawn again when the note is opened). */
  pic?: SavedPicture;
}
interface Saved {
  turns: Turn[];
  folded?: boolean;
  /** A note's passage, as selected (highlighted in the text; shown in the note only when it is not on the page). */
  phrase?: string;
  /** Its first ink. */
  ink?: number;
  /** The paragraph it was asked beside (a question asked on the line). */
  at?: number;
  /** Where it sits from that paragraph's top, in px: it was asked where the learner was reading, which can be above
   *  the first paragraph in view (a table or a figure there). */
  dy?: number;
  /** A note on a passage: its number on the step (ASK · 0n), counted with the questions asked on the line. */
  n?: number;
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

// A question goes on being answered (its words, then its picture) when the learner reads on to another page or
// another lesson: what arrives is kept with the conversation, and shown in its note when the learner is back.
/** Conversations (lesson|key) with questions still being answered. */
const inflight = new Map<string, Set<string>>();
/** The note on screen for each conversation. */
const live = new Map<string, Note>();
/** Conversations the learner deleted (an answer still arriving for one is dropped). */
const deleted = new Set<string>();
const cid = (lesson: string, key: string) => `${lesson}|${key}`;

/** Keep a question's picture with its conversation (its words may not be in yet: the picture can come first). */
function keep_picture(lesson: string, key: string, q: string, pic: SavedPicture): void {
  if (deleted.has(cid(lesson, key))) return;
  const s = load_notes(lesson)[key] ?? { turns: [] };
  const turn = [...s.turns].reverse().find((x) => x.q === q && !x.pic);
  if (turn) turn.pic = pic;
  else s.turns.push({ q, a: '', pic });
  store_note(lesson, key, s);
}

/** A conversation's number from its key ("<step>#talk" is 1, "<step>#talk.2" is 2). */
const ask_number = (key: string) => Number(/#talk\.(\d+)$/.exec(key)?.[1] ?? 1);
const is_talk = (key: string, step: string) => key === `${step}#talk` || key.startsWith(`${step}#talk.`);
/** A note on a passage: "<step>#<block>:<passage>" ("q" for a passage on no block). */
const PASSAGE_KEY = /^(.*)#(\d+|q):/;

/**
 * Where a note can sit: the blocks of a text page a passage can be selected in (paragraphs, list items, formulas,
 * a derivation's lines, the exam paper's words, callouts, a table's rows, a question in the page, captions), and the
 * words of a question or a video (its prompt, feedback and hints, the caption under the picture).
 */
const ANCHORS = [
  ...['.mn-prose > p', '.mn-prose > ul > li', '.mn-prose > ol > li', '.mn-prose > .mn-dmath', '.mn-details-body > p', '.mn-details-body > ul > li', '.mn-details-body > ol > li', '.mn-details-body > .mn-dmath', '.mn-dline .mn-dbody', '.mn-paper-text > p', '.mn-paper-tr > p', '.mn-callout-body', '.mn-table tbody tr', '.mn-quiz-q', 'figcaption'].map((s) => `.mn-pagehost ${s}`),
  '.mn-side .mn-prompt', '.mn-side .mn-feedback', '.mn-side .mn-hint', '.mn-caption', '.mn-transcript p', '.mn-transcript', '.mn-aside',
].join(',');
const text_of = (el: Element) => (el.textContent ?? '').replace(/\s+/g, ' ').trim();
/** A paragraph as read, formulas as their TeX (what a passage selected in it says). */
const read_of = (el: Element) => reading(el).text;
const wide = () => matchMedia('(min-width: 901px)').matches;
/** Under a block in the text (phones' notes; answers placed in the page): below a whole table, figure, callout or exam sheet, inside a derivation's line. */
function put_under(el: HTMLElement, block: HTMLElement): void {
  if (block.matches('.mn-dbody')) return void block.append(el);
  (block.closest<HTMLElement>('.mn-table-wrap, figure, .mn-callout, .mn-quiz, .mn-paper') ?? block).after(el);
}

/** Mark a question with a stroke of highlighter (the question element's words move into the mark). */
function ink_question(q: HTMLElement, ink: number, draw: boolean): void {
  if (q.querySelector('.ink-q')) return;
  const mark = document.createElement('span');
  mark.className = `ink-q${draw ? ' draw' : ''}`;
  mark.style.setProperty('--ink', INKS[ink % INKS.length]);
  for (const n of [...q.childNodes]) if (!(n instanceof HTMLElement && n.classList.contains('mn-quote'))) mark.append(n);
  q.append(mark);
}

/** Highlight a passage in its paragraph: each piece of text it covers, and each formula whole (marks on each). */
function echo(p: HTMLElement, phrase: string, ink: number, draw: boolean): HTMLElement[] {
  const { text, at } = reading(p);
  let start = text.indexOf(phrase), len = phrase.length;
  if (start < 0) {
    start = text.indexOf(phrase.slice(0, 16));
    len = Math.min(phrase.length, text.length - start);
  }
  if (start < 0) return [];
  // the pieces it covers, in order: a text node and the span in it, or a formula
  const pieces: { node: Node; from: number; to: number }[] = [];
  for (const c of at.slice(start, start + len)) {
    const last = pieces[pieces.length - 1];
    if (last?.node === c.node) last.to = c.off + 1;
    else pieces.push({ node: c.node, from: c.off, to: c.off + 1 });
  }
  const mark = () => {
    const m = document.createElement('mark');
    m.className = `mn-echo${draw ? ' draw' : ''}`;
    m.style.setProperty('--ink', INKS[ink % INKS.length]);
    return m;
  };
  const marks: HTMLElement[] = [];
  for (const piece of pieces) {
    const m = mark();
    if (piece.from < 0) {
      (piece.node as Element).before(m);
      m.append(piece.node);
      m.classList.add('formula');
    } else {
      const range = document.createRange();
      range.setStart(piece.node, piece.from);
      range.setEnd(piece.node, piece.to);
      range.surroundContents(m);
    }
    marks.push(m);
  }
  return marks;
}

/**
 * One conversation: a question asked on the line (beside the paragraph being read), or a note on a selected passage.
 * The note holds only the conversation, its head the first question: the passage itself is marked in the text.
 */
class Note {
  readonly el: HTMLElement;
  readonly panel: AskPanel;
  private head: HTMLButtonElement;
  private marks: HTMLElement[] = [];
  /** A selected sentence attached to the next question. */
  quote = '';
  busy = false;
  private ink: number;
  private turns_shown = 0;
  /** Its place from its paragraph's top (Saved.dy). */
  dy = 0;
  /** Its number on the step (ASK · 0n). */
  readonly n: number;
  /** The paragraph it was asked beside, as an index on the page (fixed when it is made: a save may come after the learner has left the page). */
  private at: number | undefined;
  private gone = false;
  /** Kept pictures of the cards shown from storage, drawn when their card is first seen. */
  private pics = new Map<HTMLElement, SavedPicture>();
  /** Cards waiting for a question still being answered elsewhere (by question). */
  private pending = new Map<string, HTMLElement>();
  constructor(
    readonly key: string,
    readonly para: HTMLElement | null,
    readonly phrase: string,
    saved: Saved | undefined,
    private rail: AskRail,
  ) {
    const el = (this.el = document.createElement('section'));
    el.className = 'rail-note ask-note';
    const lesson = rail.lesson.id;
    this.ink = saved?.ink ?? (phrase ? (next_ink(lesson) + 2) % INKS.length : next_ink(lesson));
    this.dy = saved?.dy ?? 0;
    this.n = phrase ? saved?.n ?? rail.next_number() : ask_number(key);
    this.at = saved?.at ?? (!phrase && para ? rail.paras().indexOf(para) : undefined);
    if (this.at !== undefined && this.at < 0) this.at = undefined;
    el.style.setProperty('--note-ink', INKS[this.ink]);
    el.innerHTML = `<button type="button" class="note-head"><span class="ask-n">ASK · ${String(this.n).padStart(2, '0')}</span><span class="ask-sum"></span></button><button type="button" class="note-x" aria-label="${esc(t('note_delete'))}" title="${esc(t('note_delete'))}">×</button><div class="note-body"><div class="note-past"></div><div class="note-panel"></div></div>`;
    this.head = el.querySelector('.note-head')!;
    // a passage on no block of the page (a caption that has moved on): its words, since nothing in the text marks them
    if (phrase && !para) this.head.insertAdjacentHTML('afterend', `<div class="note-quote">${math_html(phrase.replace(/\$\$/g, '$'))}</div>`);
    this.head.onclick = () => this.fold(!el.classList.contains('folded'));
    el.querySelector<HTMLButtonElement>('.note-x')!.onclick = (e) => {
      e.stopPropagation();
      rail.remove(this);
    };
    // the conversation so far (kept from an earlier visit), each question in its ink
    const past = el.querySelector<HTMLElement>('.note-past')!;
    (saved?.turns ?? []).forEach((turn, i) => past.append(this.past_card(turn, i)));
    this.turns_shown = saved?.turns.length ?? 0;
    this.logged = this.turns_shown;
    // questions still being answered from an earlier visit to this page
    for (const q of inflight.get(cid(lesson, key)) ?? []) {
      if ((saved?.turns ?? []).some((x) => x.q === q && x.a)) continue;
      const c = [...past.querySelectorAll<HTMLElement>('.mn-card')].find((x) => x.dataset.q === q) ?? past.appendChild(this.past_card({ q, a: '' }, this.turns_shown++));
      this.wait_for(q, c);
    }
    this.panel = new AskPanel(el.querySelector<HTMLElement>('.note-panel')!, {
      provider, validate: worker_validator(), log, lesson, thread: true, read_aloud: false,
      placeholder: this.turns_shown ? t('ask_more') : t('ask_short'), history: (saved?.turns ?? []).filter((x) => x.a).map(({ q, a }) => ({ q, a })),
      context: (): AskContext => rail.context(),
      // a note's passage goes with every question asked in it
      extra: () => {
        const selected = this.quote || this.phrase;
        this.quote = '';
        return selected ? { selected } : undefined;
      },
      empty_question: () => (this.phrase && !this.panel.transcript().length ? t('explain_passage') : null),
      on_card: (card, q) => {
        card.dataset.q = q;
        // no words after a while (no model, the network, too many questions): say so rather than wait in silence
        setTimeout(() => this.no_answer(card), 25000);
        this.busy = true;
        el.classList.add('busy');
        const id = cid(lesson, key);
        if (!inflight.has(id)) inflight.set(id, new Set());
        inflight.get(id)!.add(q);
        ink_question(card.querySelector<HTMLElement>('.mn-q')!, this.ink_of(this.turns_shown++), true);
        this.label();
        this.fold_earlier(card);
        rail.layout();
      },
      on_done: (card) => {
        this.no_answer(card, true);
        this.busy = false;
        el.classList.remove('busy');
        this.save();
        this.log_turn();
        const turns = this.panel.transcript();
        const turn = turns[turns.length - 1];
        if (turn && card.isConnected) {
          this.actions(card, turn);
          void rail.offer_page(card, turn);
        }
        rail.layout();
      },
      on_picture: (q, pic) => {
        keep_picture(lesson, key, q, pic);
        // (asked on another visit to this page: the note now on screen draws it)
        const now = live.get(cid(lesson, key));
        if (now && now !== this) now.refresh();
      },
      on_settled: (_card, q) => {
        inflight.get(cid(lesson, key))?.delete(q);
        const now = live.get(cid(lesson, key));
        if (now && now !== this) now.refresh();
      },
    });
    live.set(cid(lesson, key), this);
    if (saved?.folded) el.classList.add('folded');
    this.fold_earlier(null);
    this.label();
    this.draw_seen();
    // a click on an earlier question opens it again; on the newest, folds the note
    el.addEventListener('click', (e) => {
      const q = (e.target as Element).closest?.('.mn-card .mn-q');
      if (!q) return;
      const card = q.closest<HTMLElement>('.mn-card')!;
      if (card.classList.contains('past')) {
        card.classList.remove('past');
        this.draw_seen();
        rail.layout();
      } else this.fold(true);
    });
    if (para && phrase) {
      const kept = [...para.querySelectorAll<HTMLElement>(`.mn-echo[data-note="${window.CSS.escape(key)}"]`)];
      this.marks = kept.length ? kept : echo(para, phrase, this.ink, !saved);
      for (const m of this.marks) m.setAttribute('data-note', key);
      // the note and its sentence light up together
      const lit = (on: boolean) => {
        el.classList.toggle('lit', on);
        para.classList.toggle('lit', on);
        for (const m of this.marks) m.classList.toggle('lit', on);
      };
      el.addEventListener('mouseenter', () => lit(true));
      el.addEventListener('mouseleave', () => lit(false));
      for (const m of this.marks) {
        m.addEventListener('mouseenter', () => lit(true));
        m.addEventListener('mouseleave', () => lit(false));
        m.addEventListener('click', () => this.fold(false, true));
      }
    }
  }
  /** A kept turn as a card: its question in ink, its answer, and its picture (drawn once the card is seen). */
  private past_card(turn: Turn, i: number): HTMLElement {
    const c = document.createElement('div');
    c.className = 'mn-card';
    c.dataset.q = turn.q;
    c.innerHTML = `<div class="mn-q">${math_html(turn.q)}</div><div class="mn-body"><div class="mn-answer-text">${math_html(turn.a)}</div></div>`;
    ink_question(c.querySelector('.mn-q')!, this.ink_of(i), false);
    if (turn.pic) this.pics.set(c, turn.pic);
    if (turn.a) this.actions(c, turn);
    return c;
  }
  /** A card for a question answered on another visit: it waits, and fills in as the answer and its picture arrive. */
  private wait_for(q: string, card: HTMLElement): void {
    const body = card.querySelector<HTMLElement>('.mn-body')!;
    if (!body.querySelector('.mn-answer-text')?.textContent?.trim()) body.querySelector('.mn-answer-text')!.innerHTML = `<span class="ai-wait">${esc(t('ask_thinking'))}</span>`;
    if (!body.querySelector('.mn-wait')) body.insertAdjacentHTML('beforeend', `<div class="mn-wait" data-phase=""></div>`);
    this.pending.set(q, card);
  }
  /** What another visit's question has brought since this note was drawn: its words, its picture, or that it is done. */
  refresh(): void {
    if (this.gone) return;
    const turns = load_notes(this.rail.lesson.id)[this.key]?.turns ?? [];
    const known = this.panel.transcript();
    for (const turn of turns.slice(known.length)) if (turn.a) this.panel.remember(turn.q, turn.a);
    const still = inflight.get(cid(this.rail.lesson.id, this.key)) ?? new Set<string>();
    for (const [q, card] of [...this.pending]) {
      const turn = [...turns].reverse().find((x) => x.q === q);
      const body = card.querySelector<HTMLElement>('.mn-body')!;
      if (turn?.a) {
        body.querySelector('.mn-answer-text')!.innerHTML = math_html(turn.a);
        if (!card.querySelector('.note-acts')) this.actions(card, turn);
      }
      if (turn?.pic || !still.has(q)) {
        body.querySelector('.mn-wait')?.remove();
        if (turn?.pic) this.pics.set(card, turn.pic);
        if (!turn?.a && !still.has(q)) body.querySelector('.ai-wait')?.remove();
      }
      if (!still.has(q)) this.pending.delete(q);
    }
    this.draw_seen();
    this.rail.layout();
  }
  /** Draw the kept pictures of the cards now in view (a folded note or an earlier turn shows none). */
  draw_seen(): void {
    if (this.folded || !this.el.isConnected) return;
    for (const [card, pic] of [...this.pics]) {
      if (card.classList.contains('past')) continue;
      this.pics.delete(card);
      const body = card.querySelector<HTMLElement>('.mn-body')!;
      void this.panel.show_saved(body, pic).then(() => this.rail.layout());
      // (what goes under an answer stays under its picture)
      for (const el of body.querySelectorAll(':scope > .note-acts, :scope > .page-offer')) body.append(el);
    }
  }
  /** Under an answer: put it in the page's text (a text page only), or take it out again. */
  private actions(card: HTMLElement, turn: Turn): void {
    if (!this.rail.on_text_page() || card.querySelector('.note-acts')) return;
    const row = document.createElement('div');
    row.className = 'note-acts';
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'note-act';
    const id = `${this.key}#${turn.q.slice(0, 60)}`;
    const show = () => {
      const placed = added_answers(this.rail.lesson.id).some((x) => x.id === id);
      b.textContent = placed ? t('in_page') : t('add_to_page');
      b.classList.toggle('done', placed);
    };
    b.onclick = (e) => {
      e.stopPropagation();
      const placed = added_answers(this.rail.lesson.id).some((x) => x.id === id);
      if (placed) this.rail.unplace(id);
      else {
        const kept = load_notes(this.rail.lesson.id)[this.key]?.turns.find((x) => x.q === turn.q);
        this.rail.place({ id, q: turn.q, a: kept?.a || turn.a, pic: kept?.pic, ink: this.ink }, this.para);
      }
      show();
    };
    show();
    row.append(b);
    card.querySelector('.mn-body')!.append(row);
  }
  /** Turns of this conversation already in the learning log (those of an earlier visit were logged then). */
  private logged = 0;
  /**
   * A question and its answer go to the learning log ('asked', synced to the account for personalisation):
   * words only, the answer cut to 4 KB; the pictures stay out.
   */
  private log_turn(): void {
    const turns = this.panel.transcript();
    if (turns.length <= this.logged) return; // (no answer came)
    const { q, a } = turns[turns.length - 1];
    this.logged = turns.length;
    log.emit({ verb: 'asked', lesson: this.rail.lesson.id, step: this.key.split('#')[0], data: { q, a: a.slice(0, 4000), selected: this.phrase || undefined, turn: turns.length } });
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
  /** The head shows the first question (seen when folded). */
  private label(): void {
    const sum = this.el.querySelector('.ask-sum');
    const first = this.el.querySelector<HTMLElement>('.mn-card .mn-q .ink-q');
    if (!sum || !first) return;
    sum.innerHTML = `<span class="ink-q">${first.innerHTML}</span>`;
    sum.querySelector<HTMLElement>('.ink-q')!.style.setProperty('--ink', INKS[this.ink]);
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
    this.draw_seen();
    this.rail.layout();
    if (!folded && focus) this.focus();
  }
  save(): void {
    if (deleted.has(cid(this.rail.lesson.id, this.key))) return;
    // (its pictures are kept as they arrive: keep them with their turns)
    const old = load_notes(this.rail.lesson.id)[this.key]?.turns ?? [];
    const turns: Turn[] = this.panel.transcript().map((x, i) => ({ ...x, pic: old[i]?.q === x.q ? old[i].pic : undefined }));
    for (const o of old.slice(turns.length)) if (o.pic) turns.push(o); // a picture that came before its words
    store_note(this.rail.lesson.id, this.key, { turns, folded: this.folded, phrase: this.phrase || undefined, ink: this.ink, n: this.phrase ? this.n : undefined, at: this.phrase ? undefined : this.at, dy: !this.phrase && this.at !== undefined && this.dy ? Math.round(this.dy) : undefined });
    // (this conversation is on screen in another note, drawn after the learner came back: it shows the new turn)
    const now = live.get(cid(this.rail.lesson.id, this.key));
    if (now && now !== this) now.refresh();
  }
  /** Off the page (the learner moved on): what it is still answering goes on, and is kept. */
  destroy(): void {
    this.gone = true;
    if (live.get(cid(this.rail.lesson.id, this.key)) === this) live.delete(cid(this.rail.lesson.id, this.key));
    this.panel.clear();
    this.el.remove();
    for (const m of this.marks) m.replaceWith(...m.childNodes);
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
  /** Pictures of answers placed in the page (stopped when the page changes). */
  private placed_players: ScenePlayer[] = [];

  constructor(private cl: CourseLesson, readonly lesson: Lesson) {
    if (!injected) {
      injected = true;
      const s = document.createElement('style');
      s.textContent = CSS;
      document.head.append(s);
    }
    const el = (this.el = document.createElement('aside'));
    el.setAttribute('aria-label', t('ask_ai'));
    el.innerHTML = `<div class="rail-talk"><div class="rail-added" hidden><span>${esc(t('page_for_you'))}</span><button type="button" class="note-act">${esc(t('remove_page'))}</button></div><div class="ask-head"><span class="ask-n"></span></div><div class="rail-qs"></div><div class="mn-ask"><form><input class="mn-input" type="text" autocomplete="off" placeholder="${esc(t('ask_short'))}"></form></div></div>`;
    this.talk = el.querySelector('.rail-talk')!;
    this.qs = el.querySelector('.rail-qs')!;
    this.line = el.querySelector('.mn-input')!;
    el.querySelector('form')!.onsubmit = (e) => {
      e.preventDefault();
      const q = this.line.value.trim();
      if (!q) return;
      this.line.value = '';
      this.talk.classList.remove('open'); // (phones: the note opens in the text)
      this.ask_here(q);
    };
    // a page written for this learner can be taken out again (back to the step it follows)
    el.querySelector<HTMLButtonElement>('.rail-added button')!.onclick = () => {
      const id = this.step_id();
      const page = added_pages(this.lesson.id).find((p) => p.id === id);
      remove_page(this.lesson.id, id);
      navigate(`${lesson_path(this.cl.id)}${page ? `?step=${encodeURIComponent(page.after)}` : ''}`, true);
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

  /**
   * "问这句": a note on the selected passage, beside the block it is in (a paragraph, a derivation's line, a question's
   * prompt, a caption...); a passage on no block gets a note at the top of the margin.
   */
  open(ask: { selected?: string; at?: Element }): void {
    const phrase = (ask.selected ?? '').trim();
    if (!phrase || !this.view) return;
    const head = phrase.slice(0, 16);
    const block = this.anchor_of(ask.at) ?? this.paras().find((p) => read_of(p).includes(head)) ?? null;
    block?.classList.add('mn-para');
    const i = block ? this.paras().indexOf(block) : -1;
    const key = `${this.step_id()}#${i >= 0 ? i : 'q'}:${phrase.slice(0, 40)}`;
    const n = this.notes.get(key) ?? this.add(new Note(key, block, phrase, undefined, this));
    n.fold(false, true);
    this.number();
    // (phones: the note opens in the text, maybe off screen)
    if (!wide()) requestAnimationFrame(() => n.el.scrollIntoView({ block: 'nearest', behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' }));
  }
  /** The block of the page an element is in, if a note can sit there. */
  private anchor_of(el: Element | undefined): HTMLElement | null {
    const a = el?.closest<HTMLElement>(ANCHORS);
    return a && this.view?.root.contains(a) && !a.closest('.mn-rail, .rail-note, .mn-added') ? a : null;
  }

  destroy(): void {
    this.off?.();
    for (const u of this.unlisten) u();
    this.ro.disconnect();
    for (const n of this.notes.values()) n.destroy();
    this.notes.clear();
    this.stop_placed();
    this.el.remove();
    this.view = null;
  }

  /** Phones: open or close the conversation over the page (the lesson bar's Ask); it closes when the learner leaves it. */
  toggle_sheet(): void {
    const open = !this.talk.classList.contains('open');
    this.talk.classList.toggle('open', open);
    if (!open) return;
    this.line.focus();
    const close = (e: Event) => {
      if (this.talk.contains(e.target as Node) || (e.target as Element).closest?.('.mn-lb-ask')) return;
      this.talk.classList.remove('open');
      document.removeEventListener('pointerdown', close, true);
    };
    document.addEventListener('pointerdown', close, true);
  }
  /** What the tutor knows (a note's sentence comes with its own questions); on a question not yet answered, not to give it away. */
  context(): AskContext {
    if (!this.view) return {};
    const unanswered = this.view.runtime.step?.kind === 'checkpoint' && this.talk.classList.contains('waiting');
    return { ...lesson_context(this.cl, this.view), ...(unanswered ? { unanswered } : {}) };
  }
  on_text_page(): boolean {
    const s = this.view?.runtime.step;
    return !!s && is_text_step(s);
  }

  /** Delete a note: its conversation, its marks in the text. */
  remove(n: Note): void {
    deleted.add(cid(this.lesson.id, n.key));
    n.destroy();
    this.notes.delete(n.key);
    store_note(this.lesson.id, n.key, null);
    this.number();
    this.layout();
  }

  // ---------------------------------------------------------------- answers placed in the page
  /** Put an answer in the page's text, under the passage it is about (or the paragraph it was asked beside). */
  place(a: Omit<AddedAnswer, 'step' | 'at' | 'head'>, block: HTMLElement | null): void {
    const s = this.view?.runtime.step;
    const paras = this.paras();
    const at = block && paras.includes(block) ? block : paras[paras.length - 1];
    if (!s || !at) return;
    const answer: AddedAnswer = { ...a, step: s.id, at: paras.indexOf(at), head: read_of(at).slice(0, 16) };
    add_answer(this.lesson.id, answer);
    this.show_placed(answer, at, true);
  }
  unplace(id: string): void {
    remove_answer(this.lesson.id, id);
    this.view?.root.querySelector(`.mn-added[data-added="${window.CSS.escape(id)}"]`)?.remove();
    this.layout();
  }
  private show_placed(a: AddedAnswer, block: HTMLElement, fresh = false): void {
    if (this.view?.root.querySelector(`.mn-added[data-added="${window.CSS.escape(a.id)}"]`)) return;
    const box = document.createElement('aside');
    box.className = `mn-added${fresh ? ' fresh' : ''}`;
    box.dataset.added = a.id;
    box.style.setProperty('--ink', INKS[a.ink % INKS.length]);
    box.innerHTML = `<button type="button" class="note-x" aria-label="${esc(t('remove_from_page'))}" title="${esc(t('remove_from_page'))}">×</button><div class="mn-added-q"><span class="ink-q">${math_html(a.q)}</span></div><div class="mn-added-a">${math_html(a.a)}</div>`;
    box.querySelector<HTMLElement>('.ink-q')!.style.setProperty('--ink', INKS[a.ink % INKS.length]);
    box.querySelector<HTMLButtonElement>('.note-x')!.onclick = () => {
      this.unplace(a.id);
      this.refresh_acts(); // (the note's button offers it again)
    };
    put_under(box, block);
    if (a.pic) void draw_saved(box, a.pic).then((p) => p && this.placed_players.push(p));
    this.layout();
  }
  /** The notes' "add to the page" buttons, after an answer was taken out of the page from the page itself. */
  private refresh_acts(): void {
    const ids = new Set(added_answers(this.lesson.id).map((x) => x.id));
    for (const [key, n] of this.notes) {
      for (const card of n.el.querySelectorAll<HTMLElement>('.mn-card')) {
        const b = card.querySelector<HTMLButtonElement>('.note-act');
        const q = card.dataset.q ?? text_of(card.querySelector('.mn-q') ?? card);
        if (!b) continue;
        const placed = ids.has(`${key}#${q.slice(0, 60)}`);
        b.textContent = placed ? t('in_page') : t('add_to_page');
        b.classList.toggle('done', placed);
      }
    }
  }
  private stop_placed(): void {
    for (const p of this.placed_players) {
      p.pause();
      p.stop_live();
    }
    this.placed_players = [];
  }

  // ---------------------------------------------------------------- a page for this learner
  /**
   * After an answer: would a whole page help (a prerequisite the lesson takes for granted)? The model says so rarely;
   * then the learner is asked under the answer, and on yes the page is written, added after this step, and opened.
   */
  async offer_page(card: HTMLElement, turn: Turn): Promise<void> {
    const s = this.view?.runtime.step;
    if (!s || !this.view || !has_model() || this.context().unanswered) return;
    const lang = ui_lang();
    const ask = {
      lesson: tr(this.lesson.title, lang), page: tr(s.title, lang), on_screen: this.context().on_screen,
      question: turn.q, answer: turn.a, language: lang === 'zh' ? 'Simplified Chinese' : 'English',
    };
    let offer: PageProposal | null = null;
    try {
      offer = await propose_page(provider(), ask);
    } catch (e) {
      console.warn('page proposal', e);
    }
    if (!offer || !card.isConnected || this.view?.runtime.step !== s) return;
    const row = document.createElement('div');
    row.className = 'page-offer';
    row.innerHTML = `<div class="page-offer-why">${math_html(offer.why || offer.title)}</div><div class="page-offer-acts"><button type="button" class="note-act yes">${esc(t('add_page'))}</button><button type="button" class="note-act">${esc(t('no_page'))}</button></div>`;
    const [yes, no] = row.querySelectorAll<HTMLButtonElement>('button');
    no.onclick = (e) => {
      e.stopPropagation();
      row.remove();
      this.layout();
    };
    yes.onclick = async (e) => {
      e.stopPropagation();
      row.querySelector('.page-offer-acts')!.innerHTML = `<span class="ai-wait">${esc(t('writing_page'))}</span>`;
      this.layout();
      try {
        const page = await write_page(provider(), { ...ask, title: offer!.title });
        const id = `added-${Date.now().toString(36)}`;
        add_page(this.lesson.id, { id, after: s.id, title: page.title, blocks: page.blocks, q: turn.q });
        log.emit({ verb: 'interacted', lesson: this.lesson.id, step: s.id, object: 'added_page', data: { q: turn.q, title: page.title } });
        // (the lesson is drawn again with the page in it, and opens there)
        navigate(`${lesson_path(this.cl.id)}?step=${encodeURIComponent(id)}`);
      } catch (err) {
        console.warn('page writing', err);
        row.querySelector('.page-offer-acts')!.innerHTML = `<span class="ai-fail">${esc(t('page_failed'))}</span>`;
      }
    };
    card.querySelector('.mn-body')!.append(row);
    this.layout();
  }

  // ---------------------------------------------------------------- asking on the line
  /** A question from the line: a new note beside the paragraph being read (the others fold to their head). */
  private ask_here(q: string): void {
    const s = this.view?.runtime.step;
    if (!s) return;
    const at = this.reading();
    const n = new Note(`${s.id}#talk.${this.next_number()}`, at?.para ?? null, '', undefined, this);
    n.dy = at?.dy ?? 0;
    this.add(n);
    for (const o of this.notes.values()) if (o !== n && !o.folded) o.fold(true);
    n.quote = this.quote;
    this.quote = '';
    void n.panel.ask(q);
    // (on phones the note opens in the text, which may be off screen)
    if (!wide()) requestAnimationFrame(() => n.el.scrollIntoView({ block: 'nearest', behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' }));
    for (const b of this.qs.querySelectorAll('.rail-q')) if (b.textContent === q) b.remove();
    this.number();
  }
  /** The next question's number on this step (questions on the line and notes on passages are counted together). */
  next_number(): number {
    const s = this.step_id();
    const saved = load_notes(this.lesson.id);
    const taken = [
      ...[...this.notes.keys(), ...Object.keys(saved)].filter((k) => is_talk(k, s)).map(ask_number),
      ...Object.entries(saved).filter(([k, v]) => v.n && PASSAGE_KEY.exec(k)?.[1] === s).map(([, v]) => v.n!),
      ...[...this.notes.values()].map((n) => n.n),
    ];
    return Math.max(0, ...taken) + 1;
  }
  private number(): void {
    this.talk.querySelector('.ask-n')!.textContent = `ASK · ${String(this.next_number()).padStart(2, '0')}`;
  }
  /**
   * Where the learner is reading: on wide screens the line just under the conversation block, on phones the top of
   * the screen. The note asked there is kept with the paragraph nearest that line, at the line itself (dy from the
   * paragraph's top): the nearest paragraph can be far below when a table or a figure fills the screen.
   */
  private reading(): { para: HTMLElement; dy: number } | null {
    const paras = this.paras();
    if (!paras.length) return null;
    const y = wide() ? this.talk.getBoundingClientRect().bottom + 12 : 80;
    let best = paras[0], d = Infinity;
    for (const p of paras) {
      const r = p.getBoundingClientRect();
      // (a paragraph the line runs through is the one being read)
      const dist = r.top <= y && r.bottom > y ? 0 : Math.min(Math.abs(r.top - y), Math.abs(r.bottom - y));
      if (dist < d) [best, d] = [p, dist];
    }
    // on phones the note opens under its paragraph, in the text
    return { para: best, dy: wide() ? y - best.getBoundingClientRect().top : 0 };
  }

  // ---------------------------------------------------------------- steps and pages
  private step_id(): string {
    return this.view?.runtime.step?.id ?? '';
  }
  private on_step(): void {
    for (const n of this.notes.values()) n.destroy();
    this.notes.clear();
    this.stop_placed();
    this.ro.disconnect();
    this.qs.replaceChildren();
    this.quote = '';
    const s = this.view?.runtime.step;
    if (!s || !this.view) return;
    this.talk.classList.toggle('waiting', s.kind === 'checkpoint');
    this.el.querySelector<HTMLElement>('.rail-added')!.hidden = !is_added_page(s.id);
    this.number();
    const saved = load_notes(this.lesson.id);
    // questions asked here before, not beside a paragraph (a scene, a question; earlier conversations)
    for (const [k, kept] of Object.entries(saved)) {
      if (is_talk(k, s.id) && kept.at === undefined) this.add(new Note(k, null, '', kept, this));
    }
    // a question's or a video's notes on passages: beside their words if they are on screen, else at the top
    if (!is_text_step(s)) {
      for (const [k, kept] of Object.entries(saved)) {
        if (PASSAGE_KEY.exec(k)?.[1] !== s.id || !kept.phrase) continue;
        const head = kept.phrase.slice(0, 16);
        const block = [...this.view.root.querySelectorAll<HTMLElement>(ANCHORS)].find((b) => !b.closest('.mn-rail, .rail-note') && read_of(b).includes(head)) ?? null;
        block?.classList.add('mn-para');
        this.add(new Note(k, block, kept.phrase, kept, this));
      }
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
    // (a text page's own blocks: not the margin, not what the learner added)
    const blocks = [...view.root.querySelectorAll<HTMLElement>(ANCHORS)].filter((p) => !p.classList.contains('mn-para') && p.closest('.mn-pagehost') && !p.closest('.mn-rail, .rail-note, .mn-added'));
    if (!blocks.length) return; // (nothing new on the page)
    blocks.forEach((p) => p.classList.add('mn-para'));
    const paras = this.paras();
    // the notes left on this page before: on passages, and questions asked beside a paragraph
    const saved = load_notes(this.lesson.id);
    for (const [key, kept] of Object.entries(saved)) {
      if (this.notes.has(key)) continue;
      const m = PASSAGE_KEY.exec(key);
      if (m && m[1] === s.id && kept.phrase) {
        // (by its place on the page; by its words if the page's blocks were counted differently then)
        const head = kept.phrase.slice(0, 16);
        let para: HTMLElement | undefined = m[2] === 'q' ? undefined : paras[Number(m[2])];
        if (!para || !read_of(para).includes(head)) para = paras.find((p) => read_of(p).includes(head));
        // (a passage on no block, or one in a line of a derivation not shown yet: it waits for its line)
        if (para || m[2] === 'q') this.add(new Note(key, para ?? null, kept.phrase, kept, this));
      } else if (is_talk(key, s.id) && kept.at !== undefined) {
        const para = paras[kept.at];
        if (para) this.add(new Note(key, para, '', kept, this));
      }
    }
    // answers the learner put in this page
    for (const a of added_answers(this.lesson.id)) {
      if (a.step !== s.id) continue;
      let block: HTMLElement | undefined = paras[a.at];
      if (!block || !read_of(block).startsWith(a.head)) block = paras.find((p) => read_of(p).startsWith(a.head));
      if (block) this.show_placed(a, block);
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
    // beside the page in the margin; under its block on phones
    const margin = wide();
    n.el.classList.toggle('inline', !margin && !!n.para);
    if (margin || !n.para) this.el.append(n.el);
    else put_under(n.el, n.para);
    n.draw_seen(); // (its kept pictures, now that it is on the page)
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
      notes.sort((a, b) => order(a) - order(b) || a.n - b.n);
      const base = this.el.getBoundingClientRect().top;
      // (below the conversation where it sits at the top of the page; it covers notes only as they scroll under it)
      let floor = this.talk.offsetHeight + 12;
      for (const n of notes) {
        const top = Math.max(n.para ? n.para.getBoundingClientRect().top - base + n.dy : 0, floor);
        n.el.style.top = `${top}px`;
        floor = top + n.el.offsetHeight + 18;
      }
      this.el.style.minHeight = notes.length ? `${floor}px` : '';
    });
  }
}
