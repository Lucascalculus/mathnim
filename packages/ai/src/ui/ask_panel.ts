// "Ask" panel: type a question (or pick a suggestion) and get an explanation
// with an animated scene that becomes explorable when it ends.
//
// With a model that streams (docs/PLAN.md WP6):
//   text     the personal answer streams in (diagnosis first, then 2-4 sentences)
//   picture  in parallel, a fast "picture plan" picks a ready-made visual from
//            @mathnim/visuals and its parameters (visual_plan.ts); it is built
//            here, played, and then its handles are attached
//            - or says "none" when words answer it: then there is no picture and
//            no placeholder, only the text
//   fallback no visual fits / the plan failed: the free-form scene pipeline runs
//            in the background and its picture is swapped in (a minute or two)
// Offline (recorded answers, no streaming) the free-form path runs as before;
// a recorded answer in words only (backend.text_answer) is shown like a
// streamed one, without a picture.
import { AffordanceLayer } from 'manim-web/ext/affordance';
import { Interaction } from 'manim-web/ext/interact';
import type { ScenePlayer } from 'manim-web/ext/player';
import type { Scene } from 'manim-web';
import { type EventLog } from '@mathnim/core';
import { CueGuide, Narrator, define_ui, drag_hint, inject_styles, math_html, t, ui_lang } from '@mathnim/present';
import { get_visual, type Params } from '@mathnim/visuals';
import { ask, type AskResult, type AskStatus } from '../pipeline';
import { explain, type Explanation } from '../tutor';
import type { AskContext } from '../prompt';
import type { Backend } from '../ops_types';
import { compile_answer, load_answer } from '../run';
import type { Validator } from '../sandbox';
import { apply_white } from '../theme';
import { decide, load_visual, plan_visual, visual_accent, type PictureRoute, type PlanResult } from '../visual_plan';

const CSS = `
.mn-ask{display:flex;flex-direction:column;gap:12px}
.mn-ask form{display:flex;gap:8px}
.mn-ask.mn-thread{gap:10px}
.mn-quote{margin:0 0 4px;padding:2px 0 2px 10px;border-left:3px solid color-mix(in srgb,var(--mn-accent) 45%,transparent);color:var(--mn-muted);font-size:13px;line-height:1.45;max-height:4.4em;overflow:hidden}
.mn-ask form .mn-input{flex:1;min-width:0}
.mn-ask form .mn-btn{flex:none;white-space:nowrap}
.mn-ask .mn-chips{display:flex;flex-wrap:wrap;gap:6px}
.mn-chip{font:inherit;font-size:13px;padding:6px 10px;border-radius:999px;border:1px solid var(--mn-border);background:transparent;color:inherit;cursor:pointer;text-align:left}
.mn-chip:hover{border-color:var(--mn-accent);color:var(--mn-accent)}
.mn-card{border:1px solid var(--mn-border);border-radius:var(--mn-radius);background:var(--mn-panel);overflow:hidden;box-shadow:var(--mn-shadow)}
.mn-card .mn-q{padding:10px 14px;font-size:13px;color:var(--mn-muted);border-bottom:1px solid var(--mn-border)}
.mn-card .mn-body{padding:12px 14px;display:flex;flex-direction:column;gap:10px}
.mn-card h3{margin:0;font-size:16px}
.mn-card canvas.mn-answer{width:100%;aspect-ratio:16/9;display:block;border-radius:10px;background:#fff;border:1px solid var(--mn-border)}
.mn-status{font-size:13px;color:var(--mn-muted)}
.mn-badge{display:inline-block;font-size:11px;padding:2px 8px;border-radius:999px;background:var(--mn-faint);color:var(--mn-muted);margin-left:6px;vertical-align:middle}
.mn-badge.ok{background:color-mix(in srgb,var(--mn-good) 12%,transparent);color:var(--mn-good)}
.mn-badge.warn{background:color-mix(in srgb,var(--mn-warn) 14%,transparent);color:var(--mn-warn)}
.mn-card details{font-size:12px;color:var(--mn-muted)}
.mn-answer-text{font-size:15px;line-height:1.55}
.mn-answer-text:empty{display:none}
.mn-say-row{display:flex;gap:8px;align-items:center}
.mn-say-row:empty{display:none}
.mn-btn.mn-read{padding:4px 10px;font-size:12px;border-radius:999px}
.mn-btn.mn-read[aria-pressed=true]{border-color:var(--mn-accent);color:var(--mn-accent)}
.mn-picture{display:flex;flex-direction:column;gap:8px}
.mn-picture:empty{display:none}
.mn-caption-text{font-size:13px;color:var(--mn-muted)}
.mn-caption-text:empty{display:none}
.mn-quick-check{font-size:13px}
.mn-quick-check details{display:inline;margin-left:6px}
.mn-wait{position:relative;aspect-ratio:16/9;border-radius:10px;border:1px dashed var(--mn-border);display:flex;align-items:center;justify-content:center;flex-direction:column;gap:4px;font-size:13px;color:var(--mn-muted);
 background:linear-gradient(100deg,transparent 30%,color-mix(in srgb,var(--mn-accent) 7%,transparent) 50%,transparent 70%) 0 0/300% 100%;animation:mn-shimmer 1.6s linear infinite}
.mn-wait::after{content:attr(data-phase);font-size:12px;opacity:.8}
@keyframes mn-shimmer{from{background-position:100% 0}to{background-position:-200% 0}}
@media (prefers-reduced-motion:reduce){.mn-wait{animation:none}}
`;
let injected = false;

/** math_html for text that is still streaming in: an unfinished $...$ stays hidden until it closes. */
function partial_math_html(s: string): string {
  const n = (s.match(/\$/g) ?? []).length;
  return math_html(n % 2 ? s.slice(0, s.lastIndexOf('$')) : s);
}
const secs = (ms?: number) => (ms === undefined ? '–' : `${(ms / 1000).toFixed(1)} s`);
const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);
// the panel's strings, in the learner's interface language (one dictionary with the lesson view's, see @mathnim/present i18n)
define_ui({
  ask_placeholder: { en: 'Ask about this…', zh: '问问这里的内容……' },
  ask_question: { en: 'Your question', zh: '你的问题' },
  ask_go: { en: 'Ask', zh: '提问' },
  ask_read: { en: 'Read aloud', zh: '朗读' },
  ask_stop: { en: 'Stop', zh: '停止' },
  ask_thinking: { en: 'Thinking…', zh: '思考中……' },
  ask_drawing: { en: 'Drawing a picture for you… {s} s', zh: '正在为你画图……{s} 秒' },
  ask_choosing: { en: 'choosing a ready-made picture', zh: '正在挑选现成的图' },
  ask_building: { en: 'building it', zh: '正在生成' },
  ask_freeform: { en: 'no ready-made picture fits: drawing one for you (about a minute)', zh: '没有合适的现成图：正在为你现画一张（大约一分钟）' },
  ask_checking_it: { en: 'checking it (attempt {n})', zh: '正在检查（第 {n} 次）' },
  ask_fixing_it: { en: 'fixing a problem (attempt {n})', zh: '正在修复（第 {n} 次）' },
  ask_checking_scene: { en: 'Checking the scene (attempt {n})…', zh: '正在检查场景（第 {n} 次）……' },
  ask_fixing_scene: { en: 'Fixing a problem (attempt {n})…', zh: '正在修复问题（第 {n} 次）……' },
  ask_watch: { en: 'Watch it play, then drag the glowing handles to explore.', zh: '先看它播放，再拖动发光的手柄探索。' },
  ask_quick_check: { en: 'Quick check:', zh: '小测验：' },
  ask_answer: { en: 'answer', zh: '答案' },
  ask_how: { en: 'How this answer was made', zh: '这个回答是怎么生成的' },
  ask_text_in: { en: 'text in {a} (done {b}), ', zh: '文字 {a}（完成 {b}），' },
  ask_picture_in: { en: 'picture in {t}', zh: '图 {t}' },
  ask_ready_made: { en: 'Ready-made visual <b>{v}</b>: chosen in {c}{r}, built in {b}', zh: '现成图 <b>{v}</b>：挑选用时 {c}{r}，生成用时 {b}' },
  ask_one_repair: { en: ' (one repair)', zh: '（修复一次）' },
  ask_parameters: { en: 'Parameters: {p}', zh: '参数：{p}' },
  ask_adjusted: { en: 'Adjusted: {p}', zh: '已调整：{p}' },
  ask_not_used: { en: 'Not used: {p}', zh: '未采用：{p}' },
  ask_read_as: { en: 'Read as: {d}', zh: '理解为：{d}' },
  ask_attempts: { en: '{n} attempt{s}', zh: '尝试 {n} 次' },
  ask_from_scratch: { en: 'Drawn from scratch: {why}', zh: '从头绘制：{why}' },
  ask_plan_in: { en: '; plan in {p}', zh: '；规划用时 {p}' },
  ask_no_visual: { en: 'no ready-made visual fits this question', zh: '没有适合这个问题的现成图' },
  ask_plan_invalid: { en: 'the picture plan could not be used', zh: '画图方案无法使用' },
  ask_plan_failed: { en: 'the picture plan failed', zh: '画图方案失败了' },
  ask_recomputed: { en: '{a}/{b} numbers re-computed', zh: '{a}/{b} 个数字已复核' },
  ask_computed: { en: ' (computed {g})', zh: '（计算得 {g}）' },
  ask_checked: { en: 'checked', zh: '已检查' },
  ask_unverified: { en: 'unverified', zh: '未验证' },
  ask_no_picture: { en: 'No picture this time ({m}).', zh: '这次没有图（{m}）。' },
  ask_scene_failed: { en: 'The scene could not be shown: {m}', zh: '这个场景无法显示：{m}' },
  ask_failed: { en: 'The answer could not be written. Please try again.', zh: '没能写出回答，请再试一次。' },
  ask_too_long: { en: 'it took too long', zh: '画得太久了' },
  ask_no_recording: { en: 'No recorded answer for this question. Add an API key in Settings to ask anything.', zh: '这个问题没有录好的回答。在设置里添加 API key 后就可以随便问了。' },
});
const FREEFORM_PHASE = () => t('ask_freeform');
/** A drawn picture gets this long, then the question goes without one (it keeps drawing while the learner reads on). */
const MAX_PICTURE_MS = 120_000;

/** A picture as kept with a conversation: a ready-made visual and its parameters, or a drawn scene's code. */
export type SavedPicture = { visual: string; params: Params; caption?: string } | { code: string; title: string; caption?: string };

export interface AskPanelOptions {
  /** Where the questions go (the site's server; recorded answers offline). */
  backend: () => Backend;
  validate: Validator;
  context?: () => AskContext;
  suggestions?: string[];
  log?: EventLog;
  lesson?: string;
  /** Answer with a ready-made visual when one fits (default true; needs a streaming backend). */
  visuals?: boolean;
  /** Start the picture plan together with the text ('parallel', default) or once the diagnosis is known (it is then sent along). */
  plan_start?: 'parallel' | 'after_diagnosis';
  /** A "Read aloud" button on answers (default true). */
  read_aloud?: boolean;
  /** The input's placeholder (default: "Ask about this…"). */
  placeholder?: string;
  /** A conversation: answers in reading order with the input below them (default: newest answer first, input on top). */
  thread?: boolean;
  /** Context for the question being sent from the input (e.g. a passage the learner selected); read once per question. */
  extra?: () => Partial<AskContext> | undefined;
  /** What an empty input asks, when something gives it meaning (e.g. a selected passage); null: nothing. */
  empty_question?: () => string | null;
  /** Called with each new answer card and its question (e.g. to scroll it into view). */
  on_card?: (card: HTMLElement, question: string) => void;
  /**
   * A question's picture is ready, to keep with the conversation. Called even when the card has left the page (the
   * learner went on reading): the picture is drawn to the end, and shown when they come back.
   */
  on_picture?: (question: string, picture: SavedPicture) => void;
  /** Everything for a question is done: its words, and its picture or the decision that there is none. */
  on_settled?: (card: HTMLElement, question: string) => void;
  /** An earlier conversation to continue (its turns are context for the next question; the app shows them). */
  history?: { q: string; a: string }[];
  /** Called once a card's answer can be read: its words are in (streamed), or the whole answer is (offline). */
  on_done?: (card: HTMLElement) => void;
}

/** An answer whose picture is a ready-made visual. */
export interface VisualAnswer {
  visual: string;
  params: Params;
  plan: PlanResult;
}

/** One question's card and what is known while it is being answered. */
interface Card {
  question: string;
  t0: number;
  body: HTMLElement;
  status: HTMLElement;
  text: HTMLElement;
  say_row: HTMLElement;
  picture: HTMLElement;
  backend: Backend;
  context: AskContext;
  timing: { text_first?: number; text_done?: number; plan?: number; build?: number; picture?: number };
  /** The streamed text answer (null: offline, the scene's explanation is the answer). */
  fast: Promise<Explanation | null> | null;
  diagnosis?: string;
  got_diagnosis: Promise<void>;
  /** What "Read aloud" reads: the answer, then the picture's caption. */
  spoken: { text: string; caption: string };
}

export class AskPanel {
  root: HTMLElement;
  private list: HTMLElement;
  private input: HTMLInputElement;
  private players: ScenePlayer[] = [];
  /** This session's questions with the start of each answer (sent as context with the next question). */
  private history: { q: string; a: string }[] = [];
  private narrator: Narrator | null = null;
  private narrator_caption: HTMLElement;
  private reading: HTMLButtonElement | null = null;
  private chips: HTMLElement;
  constructor(root: HTMLElement, private o: AskPanelOptions) {
    inject_styles();
    if (!injected) {
      injected = true;
      const s = document.createElement('style');
      s.textContent = CSS;
      document.head.appendChild(s);
    }
    this.root = root;
    if (o.history) this.history = [...o.history];
    const wrap = document.createElement('div');
    wrap.className = 'mn-ask' + (o.thread ? ' mn-thread' : '');
    const form = document.createElement('form');
    this.input = document.createElement('input');
    this.input.className = 'mn-input';
    this.input.placeholder = o.placeholder ?? t('ask_placeholder');
    this.input.setAttribute('aria-label', t('ask_question'));
    const go = document.createElement('button');
    go.className = 'mn-btn primary';
    go.textContent = t('ask_go');
    form.append(this.input, go);
    form.onsubmit = (e) => {
      e.preventDefault();
      const q = this.input.value.trim() || this.o.empty_question?.() || '';
      if (q) void this.ask(q, this.o.extra?.());
      this.input.value = '';
    };
    const chips = (this.chips = document.createElement('div'));
    chips.className = 'mn-chips';
    this.set_suggestions(o.suggestions ?? []);
    this.list = document.createElement('div');
    this.list.style.display = 'flex';
    this.list.style.flexDirection = 'column';
    this.list.style.gap = '12px';
    // the narrator's caption line stays hidden: the answer is on screen already
    this.narrator_caption = document.createElement('div');
    this.narrator_caption.hidden = true;
    if (o.thread) wrap.append(this.list, chips, form, this.narrator_caption);
    else wrap.append(form, chips, this.list, this.narrator_caption);
    root.append(wrap);
  }
  /** Put the cursor in the question box. */
  focus(): void {
    this.input.focus({ preventScroll: true });
  }
  /** This conversation's questions and answers (whole), oldest first. */
  transcript(): { q: string; a: string }[] {
    return [...this.history];
  }
  /** A turn answered elsewhere (the same conversation, finished while the learner read another page): context from now on. */
  remember(q: string, a: string): void {
    this.history.push({ q, a });
  }
  /** Take the answers off the panel (their pictures stopped); the conversation's history stays as context. */
  clear(): void {
    this.stop_reading();
    for (const p of this.players) {
      p.pause();
      p.stop_live();
    }
    this.players = [];
    this.list.replaceChildren();
  }
  /** Replace the suggested questions. */
  set_suggestions(qs: string[]): void {
    this.chips.replaceChildren(...qs.map((q) => this.chip(q)));
  }
  private chip(text: string): HTMLButtonElement {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'mn-chip';
    b.innerHTML = math_html(text); // (suggestions and follow-ups may hold TeX)
    b.onclick = () => void this.ask(text, this.o.extra?.());
    return b;
  }

  // ---------------------------------------------------------------- read aloud
  private read_button(c: Card): void {
    if (this.o.read_aloud === false || c.say_row.childElementCount) return;
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'mn-btn mn-read';
    b.textContent = t('ask_read');
    b.setAttribute('aria-pressed', 'false');
    b.onclick = () => {
      if (this.reading === b) return this.stop_reading();
      this.stop_reading();
      const n = (this.narrator ??= new Narrator(this.narrator_caption, { lang: ui_lang() === 'zh' ? 'zh-CN' : 'en-US' }));
      n.enabled = true; // the learner asked to hear this answer, whatever the lesson narration setting
      this.reading = b;
      b.textContent = t('ask_stop');
      b.setAttribute('aria-pressed', 'true');
      void n.say([c.spoken.text, c.spoken.caption].filter(Boolean).join('\n\n')).finally(() => {
        if (this.reading === b) this.stop_reading(false);
      });
    };
    c.say_row.append(b);
  }
  private stop_reading(stop_audio = true): void {
    if (stop_audio) this.narrator?.stop();
    const b = this.reading;
    this.reading = null;
    if (b) {
      b.textContent = t('ask_read');
      b.setAttribute('aria-pressed', 'false');
    }
  }

  // ---------------------------------------------------------------- asking
  async ask(question: string, extra?: Partial<AskContext>): Promise<AskResult | VisualAnswer | null> {
    let card: HTMLElement | null = null;
    try {
      return await this.answer(question, extra, (c) => (card = c));
    } finally {
      if (card) this.o.on_settled?.(card, question);
    }
  }
  private async answer(question: string, extra: Partial<AskContext> | undefined, made: (card: HTMLElement) => void): Promise<AskResult | VisualAnswer | null> {
    for (const p of this.players) p.pause();
    this.stop_reading();
    const card = document.createElement('div');
    card.className = 'mn-card';
    const quote = extra?.selected ? `<blockquote class="mn-quote">${esc(extra.selected.length > 220 ? extra.selected.slice(0, 220) + '…' : extra.selected)}</blockquote>` : '';
    card.innerHTML = `<div class="mn-q">${quote}${math_html(question)}</div>`;
    const body = document.createElement('div');
    body.className = 'mn-body';
    const status = document.createElement('div');
    status.className = 'mn-status';
    status.setAttribute('aria-live', 'polite');
    const text = document.createElement('div');
    text.className = 'mn-answer-text';
    const say_row = document.createElement('div');
    say_row.className = 'mn-say-row';
    const picture = document.createElement('div');
    picture.className = 'mn-picture';
    body.append(status, text, say_row, picture);
    card.append(body);
    if (this.o.thread) this.list.append(card);
    else this.list.prepend(card);
    made(card);
    this.o.on_card?.(card, question);
    this.o.log?.emit({ verb: 'interacted', lesson: this.o.lesson ?? 'ask', object: 'ask', data: { question } });
    const backend = this.o.backend();
    let diagnosed: () => void = () => {};
    const c: Card = {
      question, t0: performance.now(), body, status, text, say_row, picture, backend,
      context: { ...this.o.context?.(), ...extra, recent: this.history.slice(-3).map((h) => ({ q: h.q, a: h.a.slice(0, 240) })) },
      timing: {}, fast: null, got_diagnosis: new Promise<void>((res) => (diagnosed = res)), spoken: { text: '', caption: '' },
    };

    const done = () => this.o.on_done?.(card);
    // offline, a question answered in words only: shown like a streamed answer, no picture
    const recorded = backend.stream ? undefined : backend.text_answer?.(question);
    if (recorded) return this.recorded_text(c, recorded).finally(done);

    // 1. the personal text answer, streamed (only for models that can stream; offline answers come whole)
    status.textContent = t('ask_thinking');
    c.fast = backend.stream
      ? explain(question, {
          backend, context: c.context,
          on_diagnosis: (d) => {
            c.diagnosis = d;
            diagnosed();
          },
          on_text: (a) => {
            status.textContent = '';
            text.innerHTML = partial_math_html(a);
          },
        }).then(
          (x) => {
            c.timing.text_first = x.ms_first;
            c.timing.text_done = x.ms_done;
            text.innerHTML = math_html(x.text);
            c.spoken.text = x.text;
            this.read_button(c);
            this.history.push({ q: question, a: x.text });
            return x;
          },
          (e) => {
            text.innerHTML = '';
            status.textContent = '';
            console.warn('text answer failed', e);
            return null;
          },
        ).finally(() => diagnosed())
      : null;

    // the words are what the learner reads first: once they are in, the answer can be closed
    if (c.fast) void c.fast.then(done);

    // 2. the picture
    if (!c.fast) return this.freeform(c, null).finally(done);
    if (this.o.visuals === false) return this.freeform(c, null);
    return this.visual_first(c);
  }

  /** Draw a kept picture (an earlier visit's answer) into an answer's body. */
  async show_saved(body: HTMLElement, pic: SavedPicture): Promise<void> {
    const player = await draw_saved(body, pic);
    if (player) this.players.push(player);
  }

  /** A placeholder that counts the seconds until the picture is there. */
  private placeholder(c: Card): HTMLElement {
    const wait = document.createElement('div');
    wait.className = 'mn-wait';
    const tick = () => (wait.textContent = t('ask_drawing', { s: Math.round((performance.now() - c.t0) / 1000) }));
    tick();
    const timer = setInterval(() => (wait.isConnected ? tick() : clearInterval(timer)), 500);
    c.picture.append(wait);
    return wait;
  }

  /** A recorded answer in words: revealed a few characters at a time, like a streamed one. */
  private async recorded_text(c: Card, r: { text: string; followups: string[] }): Promise<null> {
    c.status.textContent = t('ask_thinking');
    await new Promise((res) => setTimeout(res, 350));
    c.status.textContent = '';
    for (let n = 0; n < r.text.length; n += 4) {
      c.text.innerHTML = partial_math_html(r.text.slice(0, n));
      await new Promise((res) => setTimeout(res, 16));
    }
    c.text.innerHTML = math_html(r.text);
    c.status.remove();
    c.spoken.text = r.text;
    this.read_button(c);
    this.history.push({ q: c.question, a: r.text });
    this.followups(c, r.followups);
    this.o.log?.emit({ verb: 'interacted', lesson: this.o.lesson ?? 'ask', object: 'answer', data: { question: c.question, provider: c.backend.name, picture: 'none', recorded: true } });
    return null;
  }

  /** The fast path: no picture when words answer it, a ready-made visual chosen by the picture plan, the free-form scene when none fits. */
  private async visual_first(c: Card): Promise<AskResult | VisualAnswer | null> {
    if (this.o.plan_start === 'after_diagnosis') await Promise.race([c.got_diagnosis, new Promise((r) => setTimeout(r, 4000))]);
    let plan: PlanResult | null = null;
    let route: PictureRoute;
    try {
      plan = await plan_visual(c.question, { backend: c.backend, context: c.context, diagnosis: c.diagnosis });
      route = decide(plan);
    } catch (e) {
      console.warn('picture plan failed', e);
      route = decide(null, e);
    }
    c.timing.plan = performance.now() - c.t0;
    if (route.kind === 'none') {
      // the words are the answer: no picture, and no placeholder ever shown for one
      const x = await c.fast;
      if (!x) c.status.textContent = t('ask_failed');
      else c.status.remove();
      this.followups(c, plan?.plan?.followups);
      this.o.log?.emit({ verb: 'interacted', lesson: this.o.lesson ?? 'ask', object: 'answer', data: { question: c.question, provider: c.backend.name, picture: 'none', ...c.timing, diagnosis: c.diagnosis } });
      return null;
    }
    // a picture is coming: its placeholder appears only now
    const wait = this.placeholder(c);
    if (route.kind === 'visual') {
      const kept: SavedPicture = { visual: route.visual.name, params: route.params, caption: plan!.plan?.caption || undefined };
      // (the learner went on reading: keep the choice, draw it when they come back)
      if (!c.picture.isConnected) {
        this.o.on_picture?.(c.question, kept);
        return { visual: route.visual.name, params: route.params, plan: plan! };
      }
      wait.dataset.phase = t('ask_building');
      if (await this.show_visual(c, route, plan!, wait)) {
        this.o.on_picture?.(c.question, kept);
        return { visual: route.visual.name, params: route.params, plan: plan! };
      }
      route = { kind: 'freeform', reason: 'invalid', detail: `${route.visual.name} could not be built` };
    }
    wait.remove();
    return this.freeform(c, { route, plan });
  }

  private async show_visual(c: Card, route: Extract<PictureRoute, { kind: 'visual' }>, plan: PlanResult, wait: HTMLElement): Promise<boolean> {
    const canvas = document.createElement('canvas');
    canvas.className = 'mn-answer';
    canvas.width = 1280;
    canvas.height = 720;
    const tb = performance.now();
    let player: ScenePlayer;
    try {
      player = await load_visual(route.visual, route.params, canvas);
    } catch (e) {
      console.warn(`visual ${route.visual.name} could not be built`, e);
      return false;
    }
    c.timing.build = performance.now() - tb;
    const p = plan.plan!;
    wait.remove();
    c.status.remove();
    const stage = document.createElement('div');
    stage.style.position = 'relative';
    stage.append(canvas);
    const caption = document.createElement('div');
    caption.className = 'mn-caption-text';
    const caption_md = p.caption || t('ask_watch');
    caption.innerHTML = math_html(caption_md);
    c.spoken.caption = p.caption;
    const controls = document.createElement('div');
    controls.className = 'mn-actions';
    c.picture.append(stage, caption);
    if (p.check) {
      const q = document.createElement('div');
      q.className = 'mn-quick-check';
      q.innerHTML = `<b>${t('ask_quick_check')}</b> ${math_html(p.check.question)}` + (p.check.answer ? `<details><summary>${t('ask_answer')}</summary>${math_html(p.check.answer)}</details>` : '');
      c.picture.append(q);
    }
    c.picture.append(controls);
    const v = route.visual;
    attach_controls(player, controls, v.explore ? (scene, ui) => {
      player.show_end();
      v.explore!(scene, ui, route.params);
    } : null, visual_accent());
    this.players.push(player);
    player.play();
    c.timing.picture = performance.now() - c.t0;

    const params = Object.entries(route.params).map(([k, x]) => `${k} = ${esc(JSON.stringify(x))}`).join(', ');
    const d = this.details(c, [
      `${c.backend.name}: ${this.text_timing(c)}${t('ask_picture_in', { t: secs(c.timing.picture) })}`,
      t('ask_ready_made', { v: esc(v.name), c: plan.calls.map((x) => secs(x.ms)).join(' + '), r: plan.repaired ? t('ask_one_repair') : '', b: secs(c.timing.build) }),
      params ? t('ask_parameters', { p: params }) : '',
      plan.notes.length ? t('ask_adjusted', { p: esc(plan.notes.join('; ')) }) : '',
      plan.errors.length ? t('ask_not_used', { p: esc(plan.errors.join('; ')) }) : '',
    ]);
    this.followups(c, p.followups);
    void c.fast!.then((x) => {
      if (x) {
        // the text finished after the picture: complete the timings
        d.querySelector('div')!.innerHTML = `${c.backend.name}: ${this.text_timing(c)}${t('ask_picture_in', { t: secs(c.timing.picture) })}`;
        if (c.diagnosis) d.insertAdjacentHTML('beforeend', `<div>${t('ask_read_as', { d: math_html(c.diagnosis) })}</div>`);
      } else {
        // no text answer: the caption has to do
        c.text.innerHTML = math_html(caption_md);
        caption.innerHTML = '';
        c.spoken = { text: caption_md, caption: '' };
        this.read_button(c);
        this.history.push({ q: c.question, a: caption_md });
      }
      this.o.log?.emit({ verb: 'interacted', lesson: this.o.lesson ?? 'ask', object: 'answer', data: { question: c.question, provider: c.backend.name, picture: 'visual', visual: v.name, repaired: plan.repaired, ...c.timing, diagnosis: c.diagnosis } });
    });
    return true;
  }

  private text_timing(c: Card): string {
    return c.timing.text_done !== undefined ? t('ask_text_in', { a: secs(c.timing.text_first), b: secs(c.timing.text_done) }) : '';
  }
  private details(c: Card, lines: string[]): HTMLDetailsElement {
    const d = document.createElement('details');
    d.innerHTML = `<summary>${t('ask_how')}</summary>${lines.filter(Boolean).map((l) => `<div>${l}</div>`).join('')}`;
    c.body.append(d);
    return d;
  }
  private followups(c: Card, qs: string[] = []): void {
    const chips = document.createElement('div');
    chips.className = 'mn-chips';
    for (const f of qs) chips.append(this.chip(f));
    c.body.append(chips);
  }

  /**
   * The free-form scene (generated code, sandboxed and checked): the only
   * picture offline, and the background fallback when no ready-made visual fits.
   */
  private async freeform(c: Card, after: { route: PictureRoute; plan: PlanResult | null } | null): Promise<AskResult | null> {
    const { status, text, picture, fast } = c;
    // the scene starts once the diagnosis is known (a second or two), so it shows the same idea
    if (fast) await Promise.race([c.got_diagnosis, new Promise((r) => setTimeout(r, 4000))]);
    let wait: HTMLElement | null = null;
    if (fast) {
      wait = this.placeholder(c);
      if (after) wait.dataset.phase = FREEFORM_PHASE();
    }
    const say = (st: AskStatus) => {
      if (wait) wait.dataset.phase = { thinking: after ? FREEFORM_PHASE() : '', validating: t('ask_checking_it', { n: st.attempt }), repairing: t('ask_fixing_it', { n: st.attempt }), done: '' }[st.phase];
      else status.textContent = { thinking: t('ask_thinking'), validating: t('ask_checking_scene', { n: st.attempt }), repairing: t('ask_fixing_scene', { n: st.attempt }), done: '' }[st.phase];
    };
    let r: AskResult;
    const stop = new AbortController();
    const timer = setTimeout(() => stop.abort(new Error(t('ask_too_long'))), MAX_PICTURE_MS);
    try {
      // with the words on screen the picture only illustrates them: a scene that runs and has its numbers right is
      // shown at once (one repair at most), not polished for layout first
      r = await ask(c.question, { backend: c.backend, validate: this.o.validate, context: c.context, extra: fast ? { diagnosis: c.diagnosis, text_shown: true } : {}, on_status: say, signal: stop.signal, ...(fast ? { lenient_layout: true, max_attempts: 2 } : {}) });
    } catch (e) {
      wait?.remove();
      const raw = stop.signal.aborted ? t('ask_too_long') : (e as Error).message;
      // the offline provider's message, in the learner's language
      const msg = /^No recorded answer/.test(raw) ? t('ask_no_recording') : raw;
      if (fast && (await fast)) picture.innerHTML = `<div class="mn-status">${t('ask_no_picture', { m: esc(msg.slice(0, 120)) })}</div>`;
      else status.textContent = msg;
      return null;
    } finally {
      clearTimeout(timer);
    }
    c.timing.picture = performance.now() - c.t0;
    const spoken = fast ? await fast : null;
    this.o.on_picture?.(c.question, { code: r.code, title: r.title, caption: spoken ? r.explanation : undefined });
    // (the learner went on reading: it is kept, and drawn when they come back)
    if (!picture.isConnected) return r;
    wait?.remove();
    status.remove();
    if (!spoken) {
      // no fast answer (offline, or it failed): the scene's explanation is the answer
      text.innerHTML = math_html(r.explanation);
      c.spoken.text = r.explanation;
      this.read_button(c);
      this.history.push({ q: c.question, a: r.explanation });
    }
    const h = document.createElement('h3');
    const badge = r.verified ? `<span class="mn-badge ok">${t('ask_checked')}</span>` : `<span class="mn-badge warn">${t('ask_unverified')}</span>`;
    h.innerHTML = `${math_html(r.title)} ${badge}`;
    const canvas = document.createElement('canvas');
    canvas.className = 'mn-answer';
    canvas.width = 1280;
    canvas.height = 720;
    const controls = document.createElement('div');
    controls.className = 'mn-actions';
    const stage = document.createElement('div');
    stage.style.position = 'relative';
    stage.append(canvas);
    const caption = document.createElement('div');
    caption.className = 'mn-caption-text';
    if (spoken) {
      caption.innerHTML = math_html(r.explanation);
      c.spoken.caption = r.explanation;
    }
    picture.append(h, stage, caption, controls);
    const fallback = after?.route.kind === 'freeform' ? after.route : null;
    const why = fallback && { no_visual: t('ask_no_visual'), invalid: t('ask_plan_invalid'), failed: t('ask_plan_failed') }[fallback.reason];
    this.details(c, [
      `${r.provider}: ${spoken ? this.text_timing(c) : ''}${t('ask_picture_in', { t: secs(c.timing.picture) })}, ${t('ask_attempts', { n: r.attempts, s: r.attempts === 1 ? '' : 's' })}`,
      why ? `${t('ask_from_scratch', { why })}${fallback?.detail ? ` (${esc(fallback.detail.slice(0, 160))})` : ''}${after?.plan ? t('ask_plan_in', { p: after.plan.calls.map((x) => secs(x.ms)).join(' + ') }) : ''}` : '',
      c.diagnosis ? t('ask_read_as', { d: math_html(c.diagnosis) }) : '',
      ...(r.check_results.length ? [t('ask_recomputed', { a: r.check_results.filter((x) => x.ok).length, b: r.check_results.length }), ...r.check_results.map((x) => `${x.ok ? '✓' : '✗'} ${x.label}: ${x.value}${x.ok ? '' : t('ask_computed', { g: x.got })}`)] : []),
    ]);
    this.o.log?.emit({ verb: 'interacted', lesson: this.o.lesson ?? 'ask', object: 'answer', data: { question: c.question, provider: r.provider, verified: r.verified, attempts: r.attempts, ...c.timing, diagnosis: c.diagnosis, ...(after ? { picture: 'freeform', fallback: fallback?.reason } : {}) } });
    this.followups(c, r.followups);
    try {
      const mod = compile_answer(r.code);
      const player = await load_answer(mod, canvas, apply_white);
      this.players.push(player);
      attach_controls(player, controls, mod.setup, '#2563EB');
      player.play();
    } catch (e) {
      caption.insertAdjacentHTML('afterend', `<div class="mn-feedback bad" style="display:block">${t('ask_scene_failed', { m: esc((e as Error).message) })}</div>`);
    }
    return r;
  }
}

/** Replay, and the scene's handles once it has played; returns what attaches the handles now. */
function attach_controls(player: ScenePlayer, controls: HTMLElement, setup: ((scene: Scene, ui: Interaction) => void) | null, color: string): () => void {
  let ui: Interaction | null = null;
  let aff: AffordanceLayer | null = null;
  let cue: CueGuide | null = null;
  const hint = document.createElement('span');
  hint.className = 'mn-help';
  const explorable = () => {
    if (!setup || ui) return;
    ui = new Interaction(player);
    setup(player.scene, ui);
    player.start_live();
    aff = new AffordanceLayer(ui, { color, hint: drag_hint(ui.handles) });
    cue = new CueGuide(aff, ui); // one pulsing control at a time
    setTimeout(() => aff?.coach(cue?.target()), 400);
    hint.innerHTML = t('visual_explore');
  };
  player.opts.on_end = explorable;
  const replay = document.createElement('button');
  replay.className = 'mn-btn';
  replay.textContent = t('replay');
  replay.onclick = () => {
    ui?.dispose();
    ui = null;
    cue?.dispose();
    cue = null;
    aff?.dispose();
    aff = null;
    player.stop_live();
    player.seek_frame(0);
    player.play();
  };
  controls.append(replay, hint);
  return explorable;
}

/** Draw a kept picture (an earlier visit's answer, or one placed in the text) into `body`, as it ended, ready to explore. */
export async function draw_saved(body: HTMLElement, pic: SavedPicture): Promise<ScenePlayer | null> {
  const picture = document.createElement('div');
  picture.className = 'mn-picture';
  const canvas = document.createElement('canvas');
  canvas.className = 'mn-answer';
  canvas.width = 1280;
  canvas.height = 720;
  const stage = document.createElement('div');
  stage.style.position = 'relative';
  stage.append(canvas);
  const caption = document.createElement('div');
  caption.className = 'mn-caption-text';
  caption.innerHTML = pic.caption ? math_html(pic.caption) : '';
  const controls = document.createElement('div');
  controls.className = 'mn-actions';
  if ('code' in pic) {
    const h = document.createElement('h3');
    h.innerHTML = math_html(pic.title);
    picture.append(h);
  }
  picture.append(stage, caption, controls);
  body.append(picture);
  try {
    if ('visual' in pic) {
      const v = get_visual(pic.visual);
      if (!v) throw new Error(`no visual ${pic.visual}`);
      const player = await load_visual(v, pic.params, canvas);
      const explore = attach_controls(player, controls, v.explore ? (scene, ui) => {
        player.show_end();
        v.explore!(scene, ui, pic.params);
      } : null, visual_accent());
      // (seen before: shown as it ended, ready to explore; Replay plays it again)
      player.show_end();
      explore();
      return player;
    } else {
      const mod = compile_answer(pic.code);
      const player = await load_answer(mod, canvas, apply_white);
      const explore = attach_controls(player, controls, mod.setup, '#2563EB');
      player.show_end();
      explore();
      return player;
    }
  } catch (e) {
    console.warn('kept picture could not be drawn', e);
    picture.remove();
    return null;
  }
}
