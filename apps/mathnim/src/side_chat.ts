// The tutor in the margin. On a text page the side column is the page's
// margin: questions become numbered notes written beside the paragraph they
// are about (a matching number ends the paragraph), as in the margins of a
// well-read book. Hovering a paragraph shows a mark in the margin beside it;
// a click starts a note there. The top of the margin holds two suggested
// questions and a ruled line to write on. A note can be folded to its number
// and first question, and opened again to go on asking; notes are kept.
// Elsewhere (a scene, a question) the same notes sit under the step's panel,
// and on phones they sit under their paragraph, with the line to write on at
// the bottom of the screen.
// The question goes out with the lesson, the step, what is on screen, the
// paragraph and the learner's recent mistakes; answers stream.
//
// The line one writes on is a plain rule that ripples while the tutor is
// writing, then lies flat again. For comparison (remembered): ?line=rule never
// ripples, ?line=wave always breathes.
import { AskPanel, RECORDED, RECORDED_TEXT, recorded_question, worker_validator, type AskContext } from '@mathnim/ai';
import { describe_step, is_text_step, tr, type Lesson, type Step } from '@mathnim/core';
import { esc, math_html, t, ui_lang, type LessonView } from '@mathnim/present';
import type { CourseLesson } from './course';
import { has_model, provider } from './settings';
import { log } from './store';
import { lesson_context } from './student';

const SERIF = `"Iowan Old Style","Palatino Linotype",Palatino,"Songti SC","Noto Serif SC","Source Han Serif SC",serif`;
const PEN = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 20l1.2-4.6L15.6 5a2 2 0 0 1 2.8 0l.6.6a2 2 0 0 1 0 2.8L8.6 18.8z M13.8 6.8l3.4 3.4"/></svg>';
const CHEV = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 14l5-5 5 5"/></svg>';
const ENTER = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M19 6v5a3 3 0 0 1-3 3H6M10 10l-4 4 4 4"/></svg>';

const CSS = `
.mn-rail{position:relative;font-family:inherit}
.mn-app.mn-textstep .mn-side.mn-railed{position:relative;top:auto;align-self:stretch}
/* the top of the margin: two questions and the line to write on */
.mn-app.mn-textstep .mn-railed>.mn-rail{flex:1 0 auto}
.rail-start{position:sticky;top:var(--mn-sticky-top,58px);z-index:3;margin-top:-14px;padding:18px 0 12px;background:var(--mn-bg)}
.rail-start::after{content:'';position:absolute;left:0;right:0;top:100%;height:20px;background:linear-gradient(var(--mn-bg),transparent);pointer-events:none}
.mn-app:not(.mn-textstep) .rail-start{position:relative;top:auto;background:none}
.mn-app:not(.mn-textstep) .rail-start::after{display:none}
.rail-qs{display:flex;flex-direction:column;gap:2px;margin-bottom:10px}
.rail-q,.rail-note .mn-chip{display:block;position:relative;width:100%;text-align:left;border:0;background:none;padding:5px 0 5px 18px;margin:0;border-radius:0;font:italic 15px/1.55 ${SERIF};color:var(--mn-muted);cursor:pointer;transition:color .15s;animation:rail-in .55s cubic-bezier(.2,.8,.2,1) both}
.rail-q:nth-child(2){animation-delay:.08s}
.rail-q::before,.rail-note .mn-chip::before{content:'?';position:absolute;left:1px;top:5px;font-style:normal;color:var(--mn-accent);font-size:14px}
.rail-q:hover,.rail-note .mn-chip:hover{color:var(--mn-fg);border:0}
@keyframes rail-in{from{opacity:0;transform:translateY(5px)}to{opacity:1;transform:none}}
/* the line to write on: a rule (A), or a breathing line (B) */
.rail-line{position:relative;display:flex;align-items:center;gap:6px;padding:2px 0 6px}
.rail-line::after{content:'';position:absolute;left:0;right:0;bottom:0;height:1px;background:color-mix(in srgb,var(--mn-fg) 28%,transparent);transition:background-color .2s}
.rail-line:focus-within::after{background:var(--mn-accent)}
.rail-line.wave::after{display:none}
.rail-line svg.rail-wave{position:absolute;left:0;bottom:-6px;width:100%;height:13px;overflow:visible;pointer-events:none}
.rail-wave path{vector-effect:non-scaling-stroke;fill:none;stroke:color-mix(in srgb,var(--mn-fg) 32%,transparent);stroke-width:1.1;stroke-linecap:round;transition:stroke .3s}
.rail-line:focus-within .rail-wave path,.rail-note.busy .rail-wave path{stroke:var(--mn-accent)}
.rail-line input,.rail-note .mn-ask form .mn-input{flex:1;min-width:0;border:0;background:none;padding:6px 0;font:15px/1.5 ${SERIF};color:var(--mn-fg);box-shadow:none;outline:none}
.rail-line input::placeholder,.rail-note .mn-ask form .mn-input::placeholder{font-style:italic;color:color-mix(in srgb,var(--mn-muted) 85%,transparent)}
.rail-send{flex:none;width:26px;height:26px;border:0;background:none;color:var(--mn-accent);display:grid;place-items:center;padding:0;cursor:pointer;opacity:0;transition:opacity .15s}
.rail-send svg{width:16px;height:16px;fill:none;stroke:currentColor;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round}
.rail-line:has(input:not(:placeholder-shown)) .rail-send,.rail-line.quoted .rail-send{opacity:1}
/* a note: its number and first question (a fold), the conversation, the line to go on */
.rail-note{position:absolute;left:0;right:0;padding:2px 0 2px 14px;border-left:1px solid var(--mn-border);transition:top .35s cubic-bezier(.3,0,.2,1),border-color .2s;animation:rail-in .4s ease-out both}
.rail-note.inline{position:relative;top:auto!important;margin:6px 0 18px}
.rail-note.lit,.rail-note:focus-within{border-left-color:var(--mn-accent)}
.note-head{display:flex;align-items:baseline;gap:7px;width:100%;border:0;background:none;padding:2px 0 6px;text-align:left;cursor:pointer;font:italic 14.5px/1.5 ${SERIF};color:var(--mn-muted)}
.note-head[hidden]{display:none}
.note-head sup,.mn-noteref{font:600 11px/1 Inter,ui-sans-serif,system-ui,sans-serif;color:var(--mn-accent);font-style:normal}
.note-head .note-title{flex:1;min-width:0}
.rail-note.folded .note-title{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.note-head svg{flex:none;width:14px;height:14px;fill:none;stroke:currentColor;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round;transform:translateY(2px);opacity:0;transition:opacity .15s,transform .25s}
.rail-note:hover .note-head svg{opacity:.7}
.rail-note.folded .note-head svg{transform:translateY(2px) rotate(180deg)}
.note-head:hover{color:var(--mn-fg)}
.rail-note.folded .note-body{display:none}
.rail-note .mn-ask{gap:10px}
.rail-note .mn-card{border:0;box-shadow:none;background:none;border-radius:0;overflow:visible;animation:rail-in .35s ease-out both}
.rail-note .mn-card .mn-q{padding:0;border:0;background:none;font:italic 14.5px/1.55 ${SERIF};color:var(--mn-muted)}
.rail-note .note-body .mn-card:first-child .mn-q{display:none}
.rail-note .mn-q .mn-quote{display:none}
.rail-note .mn-card .mn-body{padding:4px 0 0;gap:8px}
.rail-note .mn-answer-text{font:15px/1.8 ${SERIF};color:var(--mn-fg)}
.rail-note .mn-card details{display:none}
.rail-note .mn-card .mn-actions .mn-btn{border:0;background:none;box-shadow:none;padding:2px 0;font:italic 13.5px/1.4 ${SERIF};color:var(--mn-muted);cursor:pointer}
.rail-note .mn-card .mn-actions .mn-btn:hover{color:var(--mn-accent)}
.rail-note .mn-chips{flex-direction:column;align-items:stretch;gap:0}
.rail-note .mn-card .mn-status{display:none}
.rail-note .mn-ask form{position:relative;display:flex;align-items:center;gap:6px;padding:2px 0 6px}
.rail-note .mn-ask form .mn-btn{display:none}
.note-quote{font:italic 13.5px/1.5 ${SERIF};color:var(--mn-muted);padding-left:10px;border-left:2px solid color-mix(in srgb,var(--mn-accent) 40%,transparent);display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden}
.note-quote[hidden]{display:none}
/* the paragraph a note belongs to */
.mn-noteref{margin-left:2px;cursor:pointer;vertical-align:super}
.mn-para{transition:background-color .25s,box-shadow .25s;border-radius:5px}
.mn-para.lit{background-color:color-mix(in srgb,var(--mn-accent) 5%,transparent);box-shadow:0 0 0 6px color-mix(in srgb,var(--mn-accent) 5%,transparent)}
/* the mark beside a paragraph under the pointer: write a note here */
.rail-stub{position:absolute;left:-2px;width:28px;height:28px;display:grid;place-items:center;border:0;background:none;padding:0;color:var(--mn-muted);cursor:pointer;opacity:0;transform:translateX(-4px);transition:opacity .15s,transform .2s,top .2s;pointer-events:none}
.rail-stub.on{opacity:.75;transform:none;pointer-events:auto}
.rail-stub:hover{opacity:1;color:var(--mn-accent)}
.rail-stub svg{width:17px;height:17px;fill:none;stroke:currentColor;stroke-width:1.5;stroke-linecap:round;stroke-linejoin:round}
/* phones: the line at the bottom of the screen; notes under their paragraph */
@media (max-width:900px){
 .mn-app.mn-textstep .mn-side.mn-railed{min-height:0}
 .rail-start::after{display:none}
 .rail-start,.mn-app:not(.mn-textstep) .rail-start{position:fixed;top:auto;left:0;right:0;bottom:0;z-index:25;padding:8px 18px calc(10px + env(safe-area-inset-bottom));background:color-mix(in srgb,var(--mn-bg) 88%,transparent);-webkit-backdrop-filter:blur(14px);backdrop-filter:blur(14px);border-top:1px solid var(--mn-border)}
 .rail-start .rail-qs{display:none}
 .mn-app.mn-has-rail{padding-bottom:76px}
 .rail-stub{display:none}
}
@media (prefers-reduced-motion:reduce){.mn-rail *,.rail-note,.mn-para{animation:none!important;transition:none!important}}
`;
let injected = false;

/** How the line one writes on moves: 'ripple' (flat, a wave while the tutor writes), 'rule' (never), 'wave' (always breathes). */
const LINE = (() => {
  try {
    const v = new URLSearchParams(location.search).get('line');
    if (v) localStorage.setItem('mathnim.line', v);
    const kept = v ?? localStorage.getItem('mathnim.line');
    return kept === 'rule' || kept === 'wave' ? kept : 'ripple';
  } catch {
    return 'ripple';
  }
})();
/** The lines on the page, drawn by one animation loop that runs only while one of them moves. */
const waves = new Set<{ path: SVGPathElement; amp: number; target: () => number }>();
let looping = false;
function draw_waves(now: number): void {
  let moving = false;
  for (const w of waves) {
    if (!w.path.isConnected) {
      waves.delete(w);
      continue;
    }
    const goal = w.target();
    w.amp += (goal - w.amp) * 0.05;
    if (goal === 0 && w.amp < 0.02) w.amp = 0;
    else moving = true;
    // (drawn in a 300-wide box stretched to the line's width)
    const width = 300;
    let d = '';
    for (let x = 0; x <= width; x += 3) {
      // an envelope keeps the ends on the rule; the wave travels slowly along it
      const env = Math.sin((Math.PI * x) / width);
      const y = 6.5 + w.amp * env * Math.sin(x / 11 - (now / 1000) * (1.2 + goal * 0.5));
      d += `${x ? 'L' : 'M'}${x} ${y.toFixed(2)}`;
    }
    w.path.setAttribute('d', d);
  }
  looping = moving;
  if (moving) requestAnimationFrame(draw_waves);
}
/** Set the lines moving (after something changed what they should do). */
function wake_lines(): void {
  if (looping || !waves.size) return;
  looping = true;
  requestAnimationFrame(draw_waves);
}
/** Draw a line as a moving one; `thinking` says when the tutor is writing. */
function breathe(line: HTMLElement, thinking: () => boolean): void {
  if (LINE === 'rule') return;
  line.classList.add('wave');
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('class', 'rail-wave');
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('viewBox', '0 0 300 13');
  svg.setAttribute('preserveAspectRatio', 'none');
  const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  path.setAttribute('d', 'M0 6.5L300 6.5');
  svg.append(path);
  line.append(svg);
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const focused = () => line.contains(document.activeElement);
  const target = LINE === 'wave' ? () => (thinking() ? 4.2 : focused() ? 1.4 : 0.7) : () => (thinking() ? 3.2 : 0);
  waves.add({ path, amp: 0, target });
  line.addEventListener('focusin', wake_lines);
  wake_lines();
}

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

// ---------------------------------------------------------------- kept notes
interface Saved {
  turns: { q: string; a: string }[];
  folded?: boolean;
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

/** The paragraphs of a text page a note can belong to. */
const PARAS = ['.mn-prose > p', '.mn-prose > ul > li', '.mn-prose > ol > li'].map((s) => `.mn-pagehost ${s}`).join(',');
const text_of = (el: Element) => (el.textContent ?? '').replace(/\s+/g, ' ').trim();
const wide = () => matchMedia('(min-width: 901px)').matches;

/** One note: about a paragraph (or the page, or the step), its conversation, folded or open. */
class Note {
  readonly el: HTMLElement;
  readonly panel: AskPanel;
  private head: HTMLButtonElement;
  private quote_el: HTMLElement;
  quote = '';
  busy = false;
  constructor(
    readonly key: string,
    readonly para: HTMLElement | null,
    saved: Saved | undefined,
    private rail: AskRail,
  ) {
    const el = (this.el = document.createElement('section'));
    el.className = 'rail-note';
    el.innerHTML = `<button type="button" class="note-head" hidden><sup></sup><span class="note-title"></span>${CHEV}</button><div class="note-body"><div class="note-past"></div><div class="note-panel"></div></div>`;
    this.head = el.querySelector('.note-head')!;
    this.head.onclick = () => this.fold(!el.classList.contains('folded'));
    // the conversation so far (kept from an earlier visit), then the panel to go on
    const past = el.querySelector<HTMLElement>('.note-past')!;
    for (const turn of saved?.turns ?? []) {
      const c = document.createElement('div');
      c.className = 'mn-card';
      c.innerHTML = `<div class="mn-q">${math_html(turn.q)}</div><div class="mn-body"><div class="mn-answer-text">${math_html(turn.a)}</div></div>`;
      past.append(c);
    }
    this.panel = new AskPanel(el.querySelector<HTMLElement>('.note-panel')!, {
      provider, validate: worker_validator(), log, lesson: rail.lesson.id, thread: true, read_aloud: false,
      placeholder: t('ask_short'), history: saved?.turns,
      suggestions: para && !saved ? [t('explain_passage')] : [],
      context: (): AskContext => rail.context(),
      // the note's paragraph goes with every question asked in it (a selected passage, when there is one)
      extra: () => {
        const selected = this.quote || (para ? text_of(para).slice(0, 1200) : '');
        this.set_quote('');
        return selected ? { selected } : undefined;
      },
      empty_question: () => (this.quote || (para && !this.panel.transcript().length) ? t('explain_passage') : null),
      on_card: () => {
        this.busy = true;
        this.el.classList.add('busy');
        wake_lines();
        this.update_head();
        this.panel.set_suggestions([]);
        rail.layout();
      },
      on_done: () => {
        this.busy = false;
        this.el.classList.remove('busy');
        wake_lines();
        this.update_head();
        this.save();
        rail.layout();
      },
    });
    const form = el.querySelector<HTMLFormElement>('.note-panel .mn-ask > form')!;
    form.classList.add('rail-line');
    breathe(form, () => this.busy);
    this.quote_el = document.createElement('div');
    this.quote_el.className = 'note-quote';
    this.quote_el.hidden = true;
    form.before(this.quote_el);
    if (saved?.folded) el.classList.add('folded');
    this.update_head();
    // the note and its paragraph light up together
    const lit = (on: boolean) => {
      el.classList.toggle('lit', on);
      para?.classList.toggle('lit', on);
    };
    el.addEventListener('mouseenter', () => lit(true));
    el.addEventListener('mouseleave', () => lit(false));
    // a note opened and left without a question goes away
    el.addEventListener('focusout', () => setTimeout(() => {
      if (!el.contains(document.activeElement) && !this.asked && !this.quote) rail.drop(this);
    }, 250));
  }
  get asked(): boolean {
    return this.panel.transcript().length > 0 || this.busy;
  }
  set number(n: number) {
    this.head.querySelector('sup')!.textContent = String(n);
    let ref = this.para?.querySelector<HTMLElement>(':scope > .mn-noteref');
    if (this.para && !ref) {
      ref = document.createElement('sup');
      ref.className = 'mn-noteref';
      ref.onclick = () => this.fold(false, true);
      this.para.append(ref);
    }
    if (ref) ref.textContent = String(n);
  }
  set_quote(text: string): void {
    this.quote = text;
    this.quote_el.hidden = !text;
    this.quote_el.textContent = text;
    this.el.querySelector('.note-panel form')?.classList.toggle('quoted', !!text);
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
  private update_head(): void {
    let first = this.panel.transcript()[0]?.q ?? '';
    const asked = this.el.querySelector<HTMLElement>('.note-panel .mn-card .mn-q');
    if (!first && asked) {
      const q = asked.cloneNode(true) as HTMLElement;
      q.querySelector('.mn-quote')?.remove();
      first = text_of(q);
    }
    this.head.hidden = !first;
    this.head.querySelector('.note-title')!.innerHTML = math_html(first);
  }
  save(): void {
    store_note(this.rail.lesson.id, this.key, { turns: this.panel.transcript(), folded: this.el.classList.contains('folded') });
  }
  destroy(): void {
    this.panel.clear();
    this.el.remove();
    this.para?.querySelector(':scope > .mn-noteref')?.remove();
    this.para?.classList.remove('lit');
  }
}

export class AskRail {
  /** The margin; the lesson view puts it in its side column. */
  readonly el: HTMLElement;
  private start: HTMLElement;
  private qs: HTMLElement;
  private input: HTMLInputElement;
  private stub: HTMLButtonElement;
  private view: LessonView | null = null;
  private off: (() => void) | null = null;
  private notes = new Map<string, Note>();
  private stub_para: HTMLElement | null = null;
  private peeked = false;
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
    el.innerHTML = `<div class="rail-start"><div class="rail-qs"></div><form class="rail-line"><input aria-label="${esc(t('ask_ai'))}" placeholder="${esc(t('ask_short'))}" autocomplete="off"><button type="submit" class="rail-send" aria-label="${esc(t('ask_go'))}">${ENTER}</button></form></div>
      <button type="button" class="rail-stub" aria-label="${esc(t('ask_para'))}" title="${esc(t('ask_para'))}" tabindex="-1">${PEN}</button>`;
    this.start = el.querySelector('.rail-start')!;
    this.qs = el.querySelector('.rail-qs')!;
    this.input = el.querySelector('.rail-start input')!;
    const form = el.querySelector<HTMLFormElement>('.rail-start form')!;
    breathe(form, () => [...this.notes.values()].some((n) => n.busy && !n.para));
    form.onsubmit = (e) => {
      e.preventDefault();
      const q = this.input.value.trim();
      this.input.value = '';
      if (q) this.ask_here(q);
    };
    this.stub = el.querySelector('.rail-stub')!;
    this.stub.onclick = () => this.stub_para && this.note_for(this.stub_para, true).focus();
    this.ro = new ResizeObserver(() => this.layout());
    const on_resize = () => this.layout();
    addEventListener('resize', on_resize);
    this.unlisten.push(() => removeEventListener('resize', on_resize));
  }

  /** Follow this lesson view: its steps' suggestions, its pages' paragraphs. */
  attach(view: LessonView): void {
    this.view = view;
    const host = view.root;
    // the mark beside the paragraph under the pointer
    const move = (e: PointerEvent) => {
      if (!wide()) return;
      const target = e.target as Element;
      const p = target.closest?.<HTMLElement>('.mn-para');
      if (p) this.show_stub(p);
      else if (!target.closest?.('.rail-stub')) this.show_stub(null);
    };
    host.addEventListener('pointermove', move);
    this.unlisten.push(() => host.removeEventListener('pointermove', move));
    this.off = view.runtime.on((e) => {
      if (e.type === 'step') this.on_step();
      else if (e.type === 'page') requestAnimationFrame(() => this.on_page());
    });
    this.on_step();
  }

  /** Ask about a passage the learner selected: a note on its paragraph, the passage quoted. */
  open(ask: { selected?: string }): void {
    const head = ask.selected?.slice(0, 24) ?? '';
    const para = head ? this.paras().find((p) => text_of(p).includes(head)) : undefined;
    const note = para ? this.note_for(para, true) : this.note_here(true);
    if (ask.selected) note.set_quote(ask.selected);
    note.fold(false);
    note.focus();
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

  /** What the tutor knows (the paragraph comes with the note's own questions). */
  context(): AskContext {
    return this.view ? lesson_context(this.cl, this.view) : {};
  }
  /** A note left without a question. */
  drop(n: Note): void {
    if (this.notes.get(n.key) !== n) return;
    n.destroy();
    this.notes.delete(n.key);
    this.layout();
  }

  // ---------------------------------------------------------------- steps and pages
  private step_id(): string {
    return this.view?.runtime.step?.id ?? '';
  }
  private on_step(): void {
    for (const n of this.notes.values()) n.destroy();
    this.notes.clear();
    this.ro.disconnect();
    this.show_stub(null);
    this.qs.replaceChildren();
    const s = this.view?.runtime.step;
    if (s && this.view) {
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
        this.layout();
      }, (e) => console.warn('starter questions', e));
    }
    // a step without paragraphs keeps its notes under the step's panel
    if (s && !is_text_step(s)) {
      const saved = load_notes(this.lesson.id)[`${s.id}#step`];
      if (saved) this.add(new Note(`${s.id}#step`, null, saved, this));
    }
    this.layout();
  }
  private on_page(): void {
    const view = this.view;
    const s = view?.runtime.step;
    if (!view || !s || !is_text_step(s)) return;
    const saved = load_notes(this.lesson.id);
    const paras = [...view.root.querySelectorAll<HTMLElement>(PARAS)].filter((p) => !p.classList.contains('mn-para') && text_of(p).length >= 16);
    paras.forEach((p, i) => {
      p.classList.add('mn-para');
      p.dataset.note = `${s.id}#${i}`;
    });
    const top = saved[`${s.id}#top`];
    if (top) this.add(new Note(`${s.id}#top`, null, top, this));
    for (const p of paras) {
      const kept = saved[p.dataset.note!];
      if (kept) this.add(new Note(p.dataset.note!, p, kept, this));
    }
    const page = view.root.querySelector<HTMLElement>('.mn-pagehost');
    if (page) this.ro.observe(page);
    this.layout();
    // once per visit the mark shows itself beside the paragraph being read: this is where notes go
    if (!this.peeked && paras.length && wide()) {
      this.peeked = true;
      setTimeout(() => {
        const p = this.in_view() ?? paras[0];
        if (!p.isConnected || this.stub_para) return;
        this.show_stub(p);
        setTimeout(() => this.stub_para === p && this.show_stub(null), 2200);
      }, 1100);
    }
  }
  private paras(): HTMLElement[] {
    return [...(this.view?.root.querySelectorAll<HTMLElement>('.mn-para') ?? [])];
  }
  /** The paragraph being read: the first to start below the line one writes on (on phones, a third of the way down). */
  private in_view(): HTMLElement | null {
    const y = wide() ? this.start.getBoundingClientRect().bottom + 8 : innerHeight * 0.35;
    let best: HTMLElement | null = null;
    let d = Infinity;
    for (const p of this.paras()) {
      const r = p.getBoundingClientRect();
      if (r.bottom < y - 40 || r.top > innerHeight) continue;
      // one starting below the line is where the note can sit; one that started above it comes after
      const k = r.top >= y - 12 ? r.top - y : 2000 + (y - r.top);
      if (k < d) [d, best] = [k, p];
    }
    return best;
  }

  // ---------------------------------------------------------------- notes
  private add(n: Note): Note {
    this.notes.set(n.key, n);
    this.ro.observe(n.el);
    this.place(n);
    return n;
  }
  /** Beside the page in the margin; under its paragraph on phones; under the step's panel elsewhere. */
  private place(n: Note): void {
    const s = this.view?.runtime.step;
    const margin = wide() && !!s && is_text_step(s);
    n.el.classList.toggle('inline', !margin);
    if (margin || !n.para) this.el.append(n.el);
    else n.para.after(n.el);
  }
  private note_for(p: HTMLElement, open: boolean): Note {
    const n = this.notes.get(p.dataset.note!) ?? this.add(new Note(p.dataset.note!, p, undefined, this));
    if (open) n.el.classList.remove('folded');
    this.show_stub(null);
    this.layout();
    return n;
  }
  /** The note for a question asked from the line one writes on: where it was asked, beside the paragraph being read
   *  (a page without paragraphs in view, or a step without paragraphs, has one note of its own). */
  private note_here(open: boolean): Note {
    const s = this.view?.runtime.step;
    if (s && is_text_step(s)) {
      const p = this.in_view();
      if (p) return this.note_for(p, open);
    }
    const key = `${this.step_id()}#${s && is_text_step(s) ? 'top' : 'step'}`;
    const n = this.notes.get(key) ?? this.add(new Note(key, null, undefined, this));
    if (open) n.el.classList.remove('folded');
    return n;
  }
  private ask_here(q: string): void {
    const n = this.note_here(true);
    void n.panel.ask(q, n.para ? { selected: text_of(n.para).slice(0, 1200) } : undefined);
  }
  private show_stub(p: HTMLElement | null): void {
    if (p && this.notes.get(p.dataset.note ?? '')?.asked) p = null; // its note is already there
    this.stub_para = p;
    this.stub.classList.toggle('on', !!p);
    if (p) this.stub.style.top = `${p.getBoundingClientRect().top - this.el.getBoundingClientRect().top - 2}px`;
  }

  /** Lay the margin's notes beside their paragraphs (never overlapping); number them in page order. */
  layout(): void {
    if (this.queued) return;
    this.queued = true;
    requestAnimationFrame(() => {
      this.queued = false;
      const notes = [...this.notes.values()].filter((n) => n.el.isConnected);
      const order = (n: Note) => (n.para ? this.paras().indexOf(n.para) : -1);
      notes.sort((a, b) => order(a) - order(b));
      let k = 0;
      for (const n of notes) if (n.asked) n.number = ++k;
      const margin = notes.filter((n) => !n.el.classList.contains('inline'));
      const base = this.el.getBoundingClientRect().top;
      let floor = this.start.offsetHeight + 22; // (its place at the top, wherever it is stuck now)
      for (const n of margin) {
        const want = n.para ? n.para.getBoundingClientRect().top - base : floor;
        const top = Math.max(want, floor);
        n.el.style.top = `${top}px`;
        floor = top + n.el.offsetHeight + 18;
      }
      this.el.style.minHeight = margin.length ? `${floor}px` : '';
    });
  }
}
