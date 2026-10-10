// The lesson player UI (plain DOM, no framework): stage + side panel +
// timeline + mastery. Everything it shows comes from LessonRuntime events.
// Text steps (read, derive, code) replace the stage with a reading column
// (text_pages.ts). Every L10n text is shown in the learner's language
// (ViewOptions.lang, default the interface language of i18n.ts); the UI's own
// strings come from the i18n dictionary.
//
//   const view = new LessonView(document.getElementById('app')!, lesson, { dev: true });
//   await view.start();
import { describe_text } from 'manim-web/ext/describe';
import { AffordanceLayer } from 'manim-web/ext/affordance';
import { Juice } from 'manim-web/ext/juice';
import { export_video } from 'manim-web/ext/export';
import { lint_timeline } from 'manim-web/ext/lint';
import type { ScenePlayer } from 'manim-web/ext/player';
import {
  EventLog, GAME_FLOW, LINEAR_FLOW, LearnerModel, LessonRuntime, MASTERY, case_position, expr, fill, is_text_step, is_voiced, lesson_langs, local_store, tr,
  type AxesLike, type CheckpointStep, type L10n, type Lang, type Lesson, type Response, type RuntimeEvent, type TextStep, type Vars,
} from '@mathnim/core';
import { drag_hint, plural_s, t, ui_lang } from './i18n';
import { esc, math_html, set_math, set_tex_renderer, type TexRenderer } from './math';
import { Narrator } from './narrator';
import { SketchPad, type SketchMapping } from './sketchpad';
import { inject_styles } from './styles';
import { CueGuide } from './cue';
import { BlockRenderer, blocks_html, text_page, type PageController, type VisualResolver } from './text_pages';

const { parse, to_latex } = expr;

/** Grades a free-text answer against its key points (the app passes the AI tutor); null or a throw falls back to self-assessment. */
export type TextGrader = (q: { question: string; answer: string; key_points: string[]; model_answer: string; lang: Lang }) => Promise<{ hits: boolean[]; feedback: string } | null>;

export interface ViewOptions {
  learner?: LearnerModel;
  log?: EventLog;
  seed?: number;
  dark?: boolean;
  /** Show the scene linter and scene description under the stage. */
  dev?: boolean;
  /** Called for each scene player (apply a theme, effects...), including visuals embedded in text pages. */
  on_player?: (p: ScenePlayer) => void;
  tex?: TexRenderer;
  /** Folder with pre-generated narration audio (default '/narration'). */
  narration_base?: string;
  /** Replace the end-of-lesson summary (e.g. to move to the next review item). */
  on_finished?: (view: LessonView) => void;
  /** Canvas resolution (default 1920x1080). */
  width?: number;
  height?: number;
  /** 'essay' (chapters, player bar, side panel) or 'game' (levels, stars, a character); default: the lesson's own mode. */
  mode?: 'essay' | 'game';
  /** The learner's language (default: the interface language, i18n.ui_lang()). */
  lang?: Lang;
  /** Resolves `visual` blocks of text pages (the app passes @mathnim/visuals). */
  visuals?: VisualResolver;
  /** Grades free-text answers; without it the learner assesses their own answer. */
  grade_text?: TextGrader;
  /** The next lesson of the course: the end card offers it as the main action. */
  next?: { title: L10n; href: string };
  /** Remember the furthest step in this browser so the lesson can resume there (resume()). */
  remember?: boolean;
  /** Where "back to the course" goes (default '/'). */
  back?: string;
  /** Go to an address inside the app (the app's router; default: a page load). */
  navigate?: (href: string) => void;
  /** A hands-on lab to suggest on the end card, under the next lesson. */
  lab?: { title: L10n; note?: L10n; href: string };
  /**
   * "Explain this": a small button on every step, and on text pages a button by selected text.
   * Called with the selected passage, if any; the app opens its chat beside the lesson.
   */
  help?: (ask: { selected?: string }) => void;
}

const h = <K extends keyof HTMLElementTagNameMap>(tag: K, cls = '', html = ''): HTMLElementTagNameMap[K] => {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (html) e.innerHTML = html;
  return e;
};
/** Step-type glyphs (timeline dots, cards). */
const ICON: Record<string, string> = {
  watch: '<svg viewBox="0 0 16 16" width="10" height="10"><path d="M5 3.5v9l7-4.5z" fill="currentColor"/></svg>',
  explore: '<svg viewBox="0 0 16 16" width="11" height="11"><path d="M6.2 1.8c.6 0 1 .4 1 1v4.1h.3V2.3c0-.6.4-1 1-1s1 .4 1 1v4.6h.3V3c0-.6.4-1 1-1s1 .4 1 1v4.3h.3V4.4c0-.6.4-1 1-1s1 .4 1 1v5.2c0 2.9-2 5-4.8 5H8.3c-1.4 0-2.5-.6-3.3-1.7L2.2 9c-.4-.5-.3-1.1.2-1.4.5-.3 1.1-.2 1.4.3l1.4 1.8V2.8c0-.6.4-1 1-1z" fill="currentColor"/></svg>',
  question: '<svg viewBox="0 0 16 16" width="10" height="10"><text x="8" y="12.5" text-anchor="middle" font-size="12" font-weight="700" fill="currentColor" font-family="system-ui">?</text></svg>',
  sketch: '<svg viewBox="0 0 16 16" width="11" height="11"><path d="M11.3 1.9l2.8 2.8-8.3 8.3-3.5.7.7-3.5z" fill="currentColor"/></svg>',
  read: '<svg viewBox="0 0 16 16" width="10" height="10"><path d="M3 4h10M3 8h10M3 12h6" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
  derive: '<svg viewBox="0 0 16 16" width="10" height="10"><path d="M3 6h10M3 10h10" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
  code: '<svg viewBox="0 0 16 16" width="11" height="11"><path d="M6 4L2 8l4 4M10 4l4 4-4 4" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>',
};
const fmt = (t: number) => `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, '0')}`;

export class LessonView {
  runtime: LessonRuntime;
  lesson: Lesson;
  root: HTMLElement;
  el: Record<string, HTMLElement> = {};
  canvas: HTMLCanvasElement;
  sketch: SketchPad;
  narrator: Narrator;
  /** The learner's language for this view. */
  readonly lang: Lang;
  /** The text page on screen (read, derive, code), if any. */
  page: PageController | null = null;
  private scene_step = false;
  private o: ViewOptions;
  private answer: (() => Response | null) | null = null;
  private affordance: AffordanceLayer | null = null;
  /** Which control of a world is cued (one pulse at a time). */
  private cue: CueGuide | null = null;
  /** A cue order the world asked for before its controls were on screen (world.cue from setup). */
  private pending_cue: L10n[] | null = null;
  private juice: Juice | null = null;
  private confidence: 1 | 2 | 3 | undefined;
  private final = false;
  private app: HTMLElement;
  /** Game view: levels, stars and a speaking character instead of chapters and a player bar. */
  readonly game: boolean;
  /** Best stars per world step (game view), kept in this browser. */
  private stars: Record<string, number> = {};
  /** Furthest step reached (game view: later levels stay locked). */
  private reached = 0;
  /** Skills this lesson has graded so far (the mastery panel shows only these, once there is one). */
  private touched = new Set<string>();

  constructor(root: HTMLElement, lesson: Lesson, o: ViewOptions = {}) {
    inject_styles();
    if (o.tex) set_tex_renderer(o.tex);
    this.o = o;
    this.lesson = lesson;
    this.root = root;
    this.lang = o.lang ?? ui_lang();
    this.game = (o.mode ?? lesson.mode) === 'game';
    const app = (this.app = h('div', 'mn-app' + (o.dark ? ' mn-dark' : '') + (this.game ? ' mn-game' : '')));
    app.lang = this.lang === 'zh' ? 'zh-CN' : 'en';
    const head = h('div', 'mn-head');
    head.append(h('div', 'mn-title', math_html(this.tr(lesson.title))), (this.el.sub = h('div', 'mn-sub')));
    // a Chinese learner opening a lesson that exists only in English is told so, once, at the top
    if (this.lang !== 'en' && !lesson_langs(lesson).includes(this.lang)) head.append(h('span', 'mn-lang-note', esc(t('only_english'))));
    const stage = h('div', 'mn-stage');
    this.canvas = h('canvas', 'mn-canvas');
    this.canvas.width = o.width ?? 1920;
    this.canvas.height = o.height ?? 1080;
    this.canvas.setAttribute('role', 'img');
    const sk = h('canvas', 'mn-sketch');
    sk.style.display = 'none';
    stage.append(this.canvas, sk, (this.el.toast = h('div', 'mn-toast')));
    this.el.caption = h('div', 'mn-caption');
    this.el.caption.setAttribute('aria-live', 'polite');
    this.el.page = h('div', 'mn-pagehost');
    const side = h('aside', 'mn-side');
    side.append(
      (this.el.kicker = h('div', 'mn-kicker')), (this.el.prompt = h('div', 'mn-prompt')), (this.el.answer = h('div')),
      (this.el.conf = h('div', 'mn-conf')), (this.el.feedback = h('div', 'mn-feedback')), (this.el.hints = h('div', 'mn-hints')),
      (this.el.actions = h('div', 'mn-actions')), (this.el.endextra = h('div', 'mn-endextra')), (this.el.mastery = h('div', 'mn-mastery')),
    );
    if (o.help) {
      // "这里没懂": on every step, under the step's actions (on phones it floats at the bottom corner)
      const help = (this.el.help = h('button', 'mn-helpbtn', `<span class="mn-helpicon" aria-hidden="true">?</span>${esc(t('explain_this'))}`));
      (help as HTMLButtonElement).type = 'button';
      help.onclick = () => o.help!({});
      side.insertBefore(help, this.el.mastery);
    }
    this.el.feedback.setAttribute('aria-live', 'polite');
    const bar = h('div', 'mn-bar');
    this.el.play = h('button', 'mn-iconbtn', '▶');
    this.el.play.setAttribute('aria-label', t('play_pause'));
    const seek = h('input') as HTMLInputElement;
    seek.type = 'range';
    seek.min = '0';
    seek.max = '1000';
    seek.value = '0';
    seek.setAttribute('aria-label', t('scene_position'));
    this.el.seek = seek;
    const speed = h('select') as HTMLSelectElement;
    for (const r of [0.5, 0.75, 1, 1.25, 1.5, 2]) speed.add(new Option(`${r}×`, String(r), r === 1, r === 1));
    speed.setAttribute('aria-label', t('speed'));
    this.el.speed = speed;
    this.el.time = h('span', '', '0:00');
    this.el.steps = h('div', 'mn-steps');
    const exp = h('button', 'mn-btn mn-export', esc(t('export_mp4')));
    this.el.export = exp;
    this.el.voice = h('button', 'mn-iconbtn', '🔈');
    this.el.voice.setAttribute('aria-label', t('narration_toggle'));
    // rarely needed: export sits in a small "⋯" menu instead of on every step
    const more = h('details', 'mn-more', `<summary class="mn-iconbtn" aria-label="${esc(t('more'))}" title="${esc(t('more'))}">⋯</summary>`);
    const menu = h('div', 'mn-more-menu');
    menu.append(exp);
    more.append(menu);
    exp.addEventListener('click', () => ((more as HTMLDetailsElement).open = false));
    bar.append(this.el.play, seek, this.el.time, speed, this.el.voice, more);
    const left = h('div');
    left.style.display = 'flex';
    left.style.flexDirection = 'column';
    left.style.gap = '10px';
    left.style.minWidth = '0';
    if (this.game) {
      // character + speech bubble, level map and stars above the stage; the panel becomes a tray below it
      const who = lesson.character;
      const hud = h('div', 'mn-hud');
      const speaker = h('div', 'mn-speaker', `<span class="mn-avatar" aria-hidden="true">${who?.avatar ?? '🙂'}</span>`);
      const bubble = h('div', 'mn-bubble');
      if (who) bubble.append(h('div', 'mn-who', math_html(this.tr(who.name))));
      bubble.append(this.el.caption);
      speaker.append(bubble);
      this.el.stars = h('div', 'mn-stars-total');
      const tools = h('div', 'mn-hud-tools');
      tools.append(this.el.stars, this.el.voice);
      hud.append(speaker, tools);
      this.el.levelup = h('div', 'mn-levelup');
      stage.append(this.el.levelup);
      left.append(hud, stage, this.el.page, this.el.steps);
      app.append(head, left, side);
      try {
        this.stars = JSON.parse(localStorage.getItem(`mathnim.stars.${lesson.id}`) ?? '{}');
      } catch {
        /* no storage */
      }
    } else {
      // where am I: "step 5 of 17 · chapter" and a thin bar above the step dots
      this.el.where = h('div', 'mn-where');
      left.append(stage, this.el.caption, bar, this.el.page, this.el.where, this.el.steps);
      app.append(head, left, side);
    }
    if (o.dev) app.append((this.el.dev = h('div', 'mn-dev', 'dev: linter + scene description')));
    root.append(app);
    if (o.help) this.watch_selection();

    this.sketch = new SketchPad(sk, { to_data: (x, y) => [x, y], to_px: (x, y) => [x, y] });
    this.narrator = new Narrator(this.el.caption, { base: o.narration_base, lang: this.lang === 'zh' ? 'zh-CN' : 'en-US' });
    this.narrator.keep_caption = this.game;
    this.el.voice.textContent = this.narrator.enabled ? '🔈' : '🔇';
    // on scene steps the panel holds the narration; the phrase being spoken is highlighted
    this.narrator.on_cue = (cues, i) => {
      if (!this.scene_step) return;
      this.el.prompt.innerHTML = cues.map((c, k) => `<span class="mn-cue${k > i ? ' next' : ''}">${math_html(c.text)}</span>`).join(' ');
    };
    const learner = o.learner ?? new LearnerModel(local_store(`mathnim.${lesson.id}`), lesson.skills);
    this.runtime = new LessonRuntime(lesson, {
      canvas: this.canvas, learner, log: o.log, seed: o.seed, lang: this.lang,
      flow: this.game ? GAME_FLOW : LINEAR_FLOW,
      on_player: (p) => this.bind_player(p),
    });
    this.runtime.on((e) => this.on_event(e));
    this.bind_controls();
    this.render_steps();
    this.render_mastery();
  }
  start(at?: string): Promise<void> {
    return this.runtime.start(at);
  }
  /** An L10n text in this view's language. */
  private tr(s: L10n | undefined): string {
    return tr(s, this.lang);
  }

  // ---------------------------------------------------------------- player + bar
  private bind_player(p: ScenePlayer): void {
    this.o.on_player?.(p);
    const seek = this.el.seek as HTMLInputElement;
    p.opts.on_frame = (t) => {
      if (!p.duration) return;
      seek.value = String(Math.round((t / p.duration) * 1000));
      this.el.time.textContent = `${fmt(t)} / ${fmt(p.duration)}`;
      this.el.play.textContent = p.playing ? '❚❚' : '▶';
    };
    p.set_rate(+(this.el.speed as HTMLSelectElement).value);
    if (this.o.dev) queueMicrotask(() => this.dev_report(p));
  }
  /** Play the current scene again from the start, with its narration. */
  private replay(): void {
    const p = this.runtime.player, s = this.runtime.step;
    if (!p) return;
    p.pause();
    p.seek_frame(0);
    p.play();
    this.el.play.textContent = '❚❚';
    if (s?.kind === 'scene' && s.narration) void this.narrator.say(this.runtime.text(s.narration));
    this.runtime.log.emit({ verb: 'replayed', lesson: this.lesson.id, step: s?.id });
  }
  private bind_controls(): void {
    this.el.play.onclick = () => {
      const p = this.runtime.player;
      if (!p) return;
      if (!p.playing && p.frame >= p.total_frames - 1) return this.replay();
      p.toggle();
      this.el.play.textContent = p.playing ? '❚❚' : '▶';
      if (p.playing) this.narrator.resume();
      else this.narrator.pause();
      this.runtime.log.emit({ verb: p.playing ? 'resumed' : 'paused', lesson: this.lesson.id, step: this.runtime.step?.id });
    };
    (this.el.seek as HTMLInputElement).oninput = () => {
      const p = this.runtime.player;
      if (!p || this.runtime.step?.kind !== 'scene') return;
      p.seek_time((+(this.el.seek as HTMLInputElement).value / 1000) * p.duration);
    };
    (this.el.seek as HTMLInputElement).onchange = () => this.runtime.log.emit({ verb: 'seeked', lesson: this.lesson.id, step: this.runtime.step?.id });
    this.el.speed.onchange = () => {
      const r = +(this.el.speed as HTMLSelectElement).value;
      this.runtime.player?.set_rate(r);
      this.narrator.set_rate(r);
    };
    this.el.voice.onclick = () => {
      this.narrator.set_enabled(!this.narrator.enabled);
      this.el.voice.textContent = this.narrator.enabled ? '🔈' : '🔇';
    };
    this.el.export.onclick = async () => {
      const p = this.runtime.player;
      if (!p) return;
      const b = this.el.export as HTMLButtonElement;
      b.disabled = true;
      try {
        const blob = await export_video(p, { on_progress: (f) => (b.textContent = t('exporting', { p: Math.round(f * 100) })) });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `${this.lesson.id}-${this.runtime.step?.id ?? 'scene'}.${blob.type.includes('mp4') ? 'mp4' : 'webm'}`;
        a.click();
        setTimeout(() => URL.revokeObjectURL(a.href), 10000);
      } catch (e) {
        alert(t('export_failed', { why: (e as Error).message }));
      } finally {
        b.disabled = false;
        b.textContent = t('export_mp4');
      }
    };
    this.root.addEventListener('keydown', (e) => {
      const target = e.target as HTMLElement;
      if (target.tagName === 'TEXTAREA') {
        // a free-text answer: Enter is a new line, Ctrl/Cmd+Enter checks
        if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
          e.preventDefault();
          this.primary()?.click();
        }
        return;
      }
      if (target.tagName === 'INPUT') {
        if (e.key === 'Enter') this.primary()?.click();
        return;
      }
      // the focused primary button clicks itself
      // anything focused inside a text page (a button, a note, a tab, a link) acts on its own
      if (e.key === 'Enter' && (target === this.primary() || target.closest('.mn-pagehost'))) return;
      if (/^[1-9]$/.test(e.key)) (this.el.answer.querySelectorAll('.mn-choice')[+e.key - 1] as HTMLElement | undefined)?.click();
      // on a derivation Enter reveals the next line until all are shown, then continues
      else if (e.key === 'Enter') (this.el.page.querySelector<HTMLButtonElement>('.mn-next-step:not([hidden]):not(:disabled)') ?? this.primary())?.click();
      else if (e.key === ' ' && e.target === document.body && !is_text_step(this.runtime.step)) {
        // Space plays the scene; on a text page it scrolls as usual
        e.preventDefault();
        this.el.play.click();
      }
    });
  }
  private primary(): HTMLButtonElement | null {
    return this.el.actions.querySelector('.mn-btn.primary:not(:disabled)');
  }

  // ---------------------------------------------------------------- runtime events
  private on_event(e: RuntimeEvent): void {
    switch (e.type) {
      case 'step': {
        this.reset_panel();
        const s = e.step;
        const chapter = this.tr(this.chapter_of(e.index));
        const text = is_text_step(s);
        // a text page has its own header: the panel keeps the outline and the way on
        this.el.kicker.textContent = text ? '' : [chapter, this.tr(s.title)].filter(Boolean).join(' · ');
        // on interactive steps the instructions are in the panel: speak them, but keep the figure clear
        this.scene_step = s.kind === 'scene';
        this.el.caption.classList.toggle('offstage', !this.scene_step && !this.game);
        this.app.classList.toggle('mn-textstep', text);
        // a step without a figure (text pages, a question or world with no scene) shows no empty stage or player bar
        this.app.classList.toggle('mn-nostage', text || !(s as { scene?: unknown }).scene);
        this.reached = Math.max(this.reached, e.index);
        if (this.o.remember && !s.branch_only) {
          const p = this.read_progress();
          this.save_progress({ furthest: Math.max(e.index, p.done ? 0 : p.furthest), done: false });
        }
        this.el.levelup?.classList.remove('show');
        this.el.sub.textContent = chapter;
        // narration is for "videos": scenes and worlds are spoken, and in a game the character speaks the questions too;
        // text pages are read silently, and so are questions in the essay view
        if (s.narration && is_voiced(s, this.game ? 'game' : 'essay')) void this.narrator.say(this.runtime.text(s.narration));
        else {
          this.narrator.stop();
          this.el.caption.textContent = '';
        }
        this.render_steps();
        const hasFigure = !!(s as { scene?: unknown }).scene;
        for (const k of ['play', 'seek', 'speed', 'export']) (this.el[k] as HTMLButtonElement).disabled = !hasFigure || (s.kind !== 'scene' && k !== 'export');
        if (s.kind === 'scene') {
          const replay = this.button(t('replay'), () => this.replay());
          const cont = this.button(t('continue'), () => this.runtime.next(), true);
          this.el.actions.append(replay, cont);
          if (s.narration) set_math(this.el.prompt, this.runtime.text(s.narration));
        }
        break;
      }
      case 'page':
        this.show_page(e.step);
        break;
      case 'blank':
        if (e.step.skill) this.touched.add(e.step.skill);
        this.render_mastery(); // the derivation page shows the outcome itself
        break;
      case 'scene-end':
        this.el.play.textContent = '▶';
        break;
      case 'explore': {
        const scrubs = e.step.scrub ?? {};
        const prompt_html = math_html(e.prompt).replace(/\{scrub:(\w+)\}/g, (m, k: string) => (scrubs[k] ? `<span class="mn-scrub" data-k="${k}" tabindex="0" role="slider"></span>` : m));
        const card = h('div', 'mn-yourturn', `<div class="mn-yt-head"><span class="mn-yt-icon" aria-hidden="true">${ICON.explore}</span>${esc(t('your_turn'))}</div><div>${prompt_html}</div><div class="mn-help">${Object.keys(scrubs).length ? esc(t('drag_numbers')) : ''}${esc(t('drag_handle'))}</div>`);
        this.el.prompt.append(card);
        this.bind_scrubs(card, e.step.scrub);
        const cont = this.button(t('continue'), () => this.runtime.next(), true);
        cont.dataset.role = 'continue';
        cont.disabled = !this.runtime.can_continue();
        this.el.actions.append(cont);
        for (const a of e.step.actions ?? []) {
          const b = this.button(this.tr(a.label), () => {
            const p = this.runtime.player, w = this.runtime.world;
            if (!p || !w) return;
            a.run(p.scene, this.runtime.ctx, w.api);
            this.runtime.ui?.on_change();
          }, a.primary);
          b.dataset.role = 'action';
          this.el.actions.append(b);
        }
        if (e.step.hints?.length) {
          const hb = this.button(t('hint'), () => this.runtime.hint());
          hb.dataset.role = 'hint';
          this.el.actions.append(hb);
        }
        // the game view gives every snap, drop and win a sound and a little motion
        this.juice = this.game ? new Juice(e.ui) : null;
        this.affordance = new AffordanceLayer(e.ui, { color: this.accent(), hint: drag_hint(e.ui.handles, this.lang) });
        // one cue at a time: the world's order (step.cue, or world.cue from setup), else creation order
        this.cue = new CueGuide(this.affordance, e.ui, this.pending_cue ?? e.step.cue);
        this.pending_cue = null;
        // show the gesture on the cued control once the learner has had a moment to look
        setTimeout(() => this.affordance?.coach(this.cue?.target()), 900);
        break;
      }
      case 'goal': {
        const stars = e.stars ? ` ${'★'.repeat(e.stars)}${'☆'.repeat(3 - e.stars)}` : '';
        if (!(this.game && e.final)) this.toast(e.message + stars); // the level-complete card says it in the game view
        const card = this.el.prompt.querySelector('.mn-yourturn');
        if (e.final) card?.classList.add('done');
        card?.append(h('div', 'mn-goal', `<span aria-hidden="true">✓</span> ${math_html(e.message)}${stars ? `<span class="mn-stars" aria-label="${esc(t('n_of_3_stars', { n: e.stars! }))}">${stars}</span>` : ''}`));
        const cont = this.el.actions.querySelector<HTMLButtonElement>('[data-role=continue]');
        if (cont) cont.disabled = !this.runtime.can_continue();
        if (e.final && e.step.skill) {
          this.touched.add(e.step.skill);
          this.render_mastery();
        }
        if (this.game && e.final) {
          this.juice?.success([0, 0, 0]);
          this.level_complete(e.step.id, e.stars, e.message);
        }
        break;
      }
      case 'finding': {
        // a misconception shown by what the learner did: name it gently, once
        if (e.finding.kind === 'misconception') {
          if (e.step.skill) this.touched.add(e.step.skill);
          const msg = e.finding.message !== undefined ? this.runtime.text(e.finding.message) : e.misconception ? t('common_idea', { d: this.tr(e.misconception.description) }) : '';
          if (msg) this.el.prompt.querySelector('.mn-yourturn')?.append(h('div', 'mn-finding', math_html(msg)));
        } else if (e.finding.message !== undefined) this.toast(this.runtime.text(e.finding.message), 'info');
        this.render_mastery();
        break;
      }
      case 'line':
        void this.narrator.say(this.tr(e.line.text));
        break;
      case 'semantic':
        break;
      case 'cue':
        // from setup the controls are not on screen yet: keep the order for them
        if (this.cue) this.cue.set(e.targets);
        else this.pending_cue = e.targets;
        break;
      case 'checkpoint':
        this.show_checkpoint(e.step, e.prompt, e.vars);
        // the game view keeps the question under the stage: bring it into view
        if (this.game) setTimeout(() => this.el.prompt.closest('.mn-side')?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }), 300);
        break;
      case 'graded': {
        const g = e.grade;
        if (e.step.purpose !== 'predict') this.touched.add(e.step.skill);
        const fb = this.el.feedback;
        const q = e.step.question;
        // a written answer is rarely all or nothing: say how many key points it made, without a red "wrong"
        const partial = q.type === 'text' && !g.correct && !!g.points?.some(Boolean);
        fb.className = 'mn-feedback ' + (g.correct ? 'good' : partial ? 'info' : 'bad');
        const lines: string[] = [];
        const purpose = e.step.purpose;
        const made = g.points?.filter(Boolean).length ?? 0;
        if (q.type === 'text' && g.points) {
          if (g.correct) lines.push(t('text_good'));
          else if (!e.final) lines.push(`${t('not_yet')} ${t('points_got', { k: made, n: g.points.length })}`);
          else lines.push(t('text_missed', { k: made, n: g.points.length }));
        } else if (g.correct) lines.push(purpose === 'predict' ? t('predict_match') : t('correct'));
        else if (!e.final) lines.push(t('not_yet'));
        else lines.push(purpose === 'predict' ? t('predict_miss') : t('not_this_time'));
        lines.push(...g.feedback);
        if (e.misconception) lines.push(t('common_idea', { d: this.tr(e.misconception.description) }));
        if (e.final && !g.correct && g.expected && q.type !== 'text') lines.push(t('answer_is', { a: g.expected }));
        if (e.final && e.step.explain) lines.push(this.runtime.text(e.step.explain));
        fb.innerHTML = lines.map((l) => `<p>${math_html(l)}</p>`).join('');
        // (a self-assessment already shows the model answer and the ticked points)
        if (q.type === 'text' && e.final && !this.el.answer.querySelector('.mn-selfcheck')) fb.append(this.rubric_summary(e.step, g.points));
        this.mark_choices(e.step, e.final);
        if (q.type === 'sketch' && e.final) {
          this.show_truth(e.step);
          fb.insertAdjacentHTML('beforeend', `<p class="mn-legend"><span class="mn-sw you"></span>${esc(t('your_sketch'))} <span class="mn-sw real"></span>${esc(t('real_graph'))}</p>`);
        }
        if (q.type === 'text' && !e.final) {
          // try again: the answer box opens again
          const ta = this.el.answer.querySelector<HTMLTextAreaElement>('textarea');
          if (ta) ta.disabled = false;
          const check = this.el.actions.querySelector<HTMLButtonElement>('[data-role=check]');
          if (check) check.disabled = false;
        }
        if (e.final) this.finalize_actions(e.step);
        this.render_mastery();
        break;
      }
      case 'hint': {
        const d = h('div', 'mn-hint', math_html(e.text));
        this.el.hints.append(d);
        const hb = this.el.actions.querySelector<HTMLButtonElement>('[data-role=hint]');
        if (hb && !e.remaining) hb.disabled = true;
        break;
      }
      case 'finished':
        if (this.o.remember) this.save_progress({ furthest: 0, done: true }); // a finished lesson opens at the start
        if (this.o.on_finished) this.o.on_finished(this);
        else this.show_summary();
        break;
    }
  }
  private chapter_of(i: number): L10n | undefined {
    for (let k = i; k >= 0; k--) if (this.lesson.steps[k].chapter) return this.lesson.steps[k].chapter;
    return undefined;
  }
  private accent(): string {
    return getComputedStyle(this.app).getPropertyValue('--mn-accent').trim() || '#2f5bd3';
  }
  /** Remove the view (stops audio and the scene). */
  destroy(): void {
    this.unwatch?.();
    this.narrator.stop();
    this.page?.dispose();
    this.page = null;
    this.runtime.player?.pause();
    this.runtime.player?.stop_live();
    this.runtime.ui?.dispose();
    this.cue?.dispose();
    this.root.innerHTML = '';
  }
  private reset_panel(): void {
    this.cue?.dispose();
    this.cue = null;
    this.pending_cue = null;
    this.affordance?.dispose();
    this.affordance = null;
    this.juice = null;
    this.page?.dispose();
    this.page = null;
    this.el.page.innerHTML = '';
    this.app.classList.remove('mn-casestep');
    for (const k of ['prompt', 'answer', 'conf', 'hints', 'actions', 'endextra']) this.el[k].innerHTML = '';
    this.el.feedback.className = 'mn-feedback';
    this.el.feedback.innerHTML = '';
    this.answer = null;
    this.confidence = undefined;
    this.final = false;
    const sk = this.sketch.canvas;
    sk.style.display = 'none';
    this.sketch.truth = null;
    this.sketch.points = [];
  }
  private button(label: string, f: () => unknown, primary = false): HTMLButtonElement {
    const b = h('button', 'mn-btn' + (primary ? ' primary' : ''), esc(label));
    b.onclick = () => void f();
    return b;
  }
  private toast(msg: string, kind: 'good' | 'info' = 'good'): void {
    const t = this.el.toast;
    t.innerHTML = math_html(msg);
    t.classList.toggle('info', kind === 'info');
    t.classList.add('show');
    setTimeout(() => t.classList.remove('show'), 2600);
  }

  // ---------------------------------------------------------------- text pages
  private show_page(step: TextStep): void {
    // Continue is always allowed; it becomes the main action once a derivation is fully shown
    const cont = this.button(t('continue'), () => this.runtime.next(), true);
    cont.dataset.role = 'continue';
    let page: PageController | null = null;
    const sync = () => cont.classList.toggle('primary', !page || page.complete());
    page = text_page(step, this.chapter_of(this.runtime.index), {
      lang: this.lang,
      lesson: this.lesson.id,
      visuals: this.o.visuals,
      on_player: this.o.on_player,
      accent: this.accent(),
      submit_blank: (text) => this.runtime.submit_blank(text),
      reveal_blank: () => this.runtime.reveal_blank(),
      on_progress: () => sync(),
    });
    this.page = page;
    this.el.page.append(page.el);
    this.el.prompt.append(page.aside);
    this.el.actions.append(cont);
    sync();
    this.scroll_to_page();
  }
  /** A new page starts at its top (the previous one may have been read to the end). */
  private scroll_to_page(): void {
    const host = this.el.page;
    requestAnimationFrame(() => {
      const top = host.getBoundingClientRect().top;
      const sticky = parseFloat(getComputedStyle(this.app).getPropertyValue('--mn-sticky-top')) || 0;
      if (top < sticky) window.scrollTo({ top: window.scrollY + top - sticky - 12 });
    });
  }
  /** The case a grouped checkpoint belongs to: its title and brief in the reading column, the question numbered. */
  private show_case(step: CheckpointStep): string {
    const pos = case_position(this.lesson, this.runtime.index);
    if (!pos) return '';
    const { group, k, n } = pos;
    const num = n > 1 ? t('question_k_of_n', { k, n }) : '';
    if (group.brief?.length) {
      const r = new BlockRenderer(this.lang);
      const body = blocks_html(group.brief, this.lang, r);
      const article = h('article', 'mn-page mn-case');
      article.lang = this.lang === 'zh' ? 'zh-CN' : 'en';
      // written once by the author, shown with every question of the case (the answers depend on it)
      article.innerHTML = `<header class="mn-page-head"><div class="mn-page-kicker">${esc(t('case_label'))}${num ? ` · ${esc(num)}` : ''}</div><h1 class="mn-page-title">${math_html(this.tr(group.title))}</h1></header><div class="mn-prose">${body}</div>`;
      this.el.page.append(article);
      this.app.classList.add('mn-casestep');
      if (k === 1) this.scroll_to_page();
    }
    // the reading column names the case; the panel only says where in it the question is
    if (group.brief?.length) return esc([t('case_label'), num].filter(Boolean).join(' · '));
    return `${esc(t('case_label'))}: ${math_html(this.tr(group.title))}${num ? ` · ${esc(num)}` : ''}`;
  }

  // ---------------------------------------------------------------- resuming
  private get progress_key(): string {
    return `mathnim.progress.${this.lesson.id}`;
  }
  /** furthest: step index reached; done: the last visit ended the lesson; finished: it was finished at least once. */
  private read_progress(): { furthest: number; done: boolean; finished: boolean } {
    try {
      const p = JSON.parse(localStorage.getItem(this.progress_key) ?? '{}');
      return { furthest: +p.furthest || 0, done: !!p.done, finished: !!p.finished };
    } catch {
      return { furthest: 0, done: false, finished: false };
    }
  }
  private save_progress(p: { furthest: number; done: boolean }): void {
    try {
      localStorage.setItem(this.progress_key, JSON.stringify({ ...p, finished: p.done || this.read_progress().finished }));
    } catch {
      /* no storage */
    }
  }
  /** Open at the furthest step reached last time (a finished lesson opens at the start), with a "Start over" link. */
  async resume(): Promise<void> {
    const p = this.read_progress();
    const step = !p.done && p.furthest > 0 ? this.lesson.steps[p.furthest] : undefined;
    if (!step || step.branch_only) return this.start();
    await this.start(step.id);
    const note = h('span', 'mn-resumed', `${esc(t('resumed'))} `);
    const again = h('button', 'mn-linkbtn', esc(t('start_over')));
    again.type = 'button';
    again.onclick = () => {
      note.remove();
      this.save_progress({ furthest: 0, done: false });
      void this.runtime.goto(this.lesson.steps[0].id);
    };
    note.append(again);
    this.app.querySelector('.mn-head')?.append(note);
  }

  // ---------------------------------------------------------------- scrubbable numbers
  /** Numbers in the prompt that the learner drags left/right; kept in sync with the scene's trackers. */
  private bind_scrubs(card: HTMLElement, specs?: Record<string, import('@mathnim/core').ScrubSpec>): void {
    if (!specs) return;
    const player = this.runtime.player;
    if (!player) return;
    const items = [...card.querySelectorAll<HTMLElement>('.mn-scrub')].map((el) => {
      const spec = specs[el.dataset.k!];
      const tracker = spec.tracker(player.scene);
      const step = spec.step ?? (spec.max - spec.min) / 100;
      const show = () => {
        const v = tracker.get_value();
        el.textContent = v.toFixed(spec.decimals ?? 1);
        el.setAttribute('aria-valuenow', String(v));
      };
      el.setAttribute('aria-label', spec.label !== undefined ? this.tr(spec.label) : el.dataset.k!);
      el.setAttribute('aria-valuemin', String(spec.min));
      el.setAttribute('aria-valuemax', String(spec.max));
      const set = (v: number) => {
        v = Math.min(spec.max, Math.max(spec.min, Math.round(v / step) * step));
        tracker.set_value(v);
        show();
        this.runtime.ui?.on_change();
        // the learner found a way to act: the figure's "drag me" cues can stop asking
        this.cue?.stop();
        this.affordance?.mark_all_used();
      };
      el.onpointerdown = (ev) => {
        ev.preventDefault();
        el.setPointerCapture(ev.pointerId);
        const x0 = ev.clientX, v0 = tracker.get_value();
        el.classList.add('active');
        el.onpointermove = (m) => set(v0 + Math.round((m.clientX - x0) / 6) * step);
        el.onpointerup = () => {
          el.onpointermove = null;
          el.classList.remove('active');
        };
      };
      el.onkeydown = (k) => {
        const d = k.key === 'ArrowRight' || k.key === 'ArrowUp' ? 1 : k.key === 'ArrowLeft' || k.key === 'ArrowDown' ? -1 : 0;
        if (!d) return;
        k.preventDefault();
        set(tracker.get_value() + d * step * (k.shiftKey ? 10 : 1));
      };
      show();
      return show;
    });
    // follow changes made on the figure (handles, sliders) while this step is on screen
    const idx = this.runtime.index;
    const loop = () => {
      if (this.runtime.index !== idx || !card.isConnected) return;
      for (const show of items) show();
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  }

  // ---------------------------------------------------------------- game view
  /** A world was finished: keep the best stars and show the level-complete card over the stage. */
  private level_complete(step_id: string, stars: number | undefined, message: string): void {
    if (stars) this.stars[step_id] = Math.max(stars, this.stars[step_id] ?? 0);
    try {
      localStorage.setItem(`mathnim.stars.${this.lesson.id}`, JSON.stringify(this.stars));
    } catch {
      /* no storage */
    }
    const card = this.el.levelup;
    card.innerHTML = '';
    const row = h('div', 'mn-lu-stars', stars ? [1, 2, 3].map((k) => `<span class="${k <= stars ? 'on' : ''}" style="animation-delay:${0.15 + k * 0.18}s">★</span>`).join('') : '');
    if (stars) row.setAttribute('aria-label', t('n_of_3_stars', { n: stars }));
    const next = this.button(t('next'), () => this.runtime.next(), true);
    const again = this.button(t('play_again'), () => this.runtime.goto(step_id));
    const acts = h('div', 'mn-actions');
    acts.append(next, again);
    card.append(h('div', 'mn-lu-title', esc(stars ? t('level_complete') : t('done'))), row, h('div', 'mn-lu-msg', math_html(message)), acts);
    card.classList.add('show');
    setTimeout(() => next.focus(), 300);
    this.render_steps();
  }
  /** Levels (chapters) with a node per step; worlds show their stars; later steps stay locked. */
  private render_levels(): void {
    const box = this.el.steps;
    box.innerHTML = '';
    const cur = this.runtime?.index ?? -1;
    let group: HTMLElement | null = null;
    let lastChapter: string | undefined;
    let total = 0;
    this.lesson.steps.forEach((s, i) => {
      if (s.branch_only) return;
      const chapter = s.chapter !== undefined ? this.tr(s.chapter) : undefined;
      if (!group || (chapter && chapter !== lastChapter)) {
        lastChapter = chapter ?? lastChapter;
        group = h('div', 'mn-level');
        group.title = lastChapter ?? '';
        group.append(h('span', 'mn-level-name', math_html(lastChapter ?? '')));
        box.append(group);
      }
      const world = s.kind === 'explore' && !!s.stars;
      const got = this.stars[s.id] ?? 0;
      total += got;
      const locked = i > this.reached;
      const d = h('button', 'mn-node' + (world ? ' world' : '') + (i < cur ? ' done' : i === cur ? ' now' : '') + (locked ? ' locked' : ''),
        world ? `<span class="mn-node-stars">${got ? '★'.repeat(got) : ''}</span>` : '');
      const title = this.tr(s.title) || s.id;
      d.title = title;
      d.setAttribute('aria-label', `${title}${world ? `, ${t('n_of_3_stars', { n: got })}` : ''}${locked ? `, ${t('locked')}` : ''}`);
      d.disabled = locked;
      d.onclick = () => this.runtime.goto(s.id);
      group!.append(d);
      if (i === cur) group!.classList.add('now');
    });
    const max = 3 * this.lesson.steps.filter((s) => s.kind === 'explore' && !s.branch_only && s.stars).length;
    if (this.el.stars) this.el.stars.innerHTML = `<span aria-hidden="true">★</span> ${total}<span class="mn-of">/${max}</span>`;
  }

  // ---------------------------------------------------------------- questions
  private show_checkpoint(step: CheckpointStep, prompt: string, vars: Vars): void {
    const case_tag = step.group ? this.show_case(step) : '';
    if (case_tag) this.el.kicker.innerHTML = case_tag;
    set_math(this.el.prompt, prompt);
    const q = step.question;
    const box = this.el.answer;
    if (q.type === 'choice') {
      const wrap = h('div', 'mn-choices');
      let chosen: string | null = null;
      const opts = q.shuffle ? [...q.options].sort(() => this.runtime.rng() - 0.5) : q.options;
      opts.forEach((o, i) => {
        const b = h('button', 'mn-choice', `<span class="mn-key">${i + 1}</span><span>${math_html(fill(this.tr(o.label), vars))}</span>`);
        b.dataset.id = o.id;
        b.setAttribute('aria-pressed', 'false');
        b.onclick = () => {
          if (this.final) return;
          chosen = o.id;
          wrap.querySelectorAll('.mn-choice').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
        };
        wrap.append(b);
      });
      box.append(wrap);
      this.answer = () => (chosen ? { type: 'choice', option: chosen } : null);
    } else if (q.type === 'number' || q.type === 'expression') {
      const input = h('input', 'mn-input') as HTMLInputElement;
      input.placeholder = q.type === 'number' ? t('your_answer') : t('type_expression');
      input.setAttribute('aria-label', t('answer_label'));
      input.autocomplete = 'off';
      const prev = h('div', 'mn-preview');
      const help = h('div', 'mn-help', q.type === 'number' ? `${q.unit ? esc(t('answer_in', { unit: this.tr(q.unit) })) : ''}${t('number_help')}` : t('expr_help'));
      input.oninput = () => {
        const s = input.value.trim();
        if (!s) return void (prev.textContent = '');
        try {
          prev.innerHTML = math_html(`$${to_latex(parse(s, q.type === 'expression' ? q.variables ?? [] : []))}$`);
        } catch (err) {
          prev.textContent = '…';
        }
      };
      box.append(input, prev, help);
      setTimeout(() => input.focus(), 50);
      this.answer = () => (input.value.trim() ? (q.type === 'number' ? { type: 'number', value: input.value } : { type: 'expression', text: input.value }) : null);
    } else if (q.type === 'text') {
      const ta = h('textarea', 'mn-input mn-textarea') as HTMLTextAreaElement;
      ta.placeholder = q.placeholder !== undefined ? this.tr(q.placeholder) : t('text_placeholder');
      ta.setAttribute('aria-label', t('answer_label'));
      ta.rows = 5;
      box.append(ta, h('div', 'mn-help', esc(t('text_help'))));
      setTimeout(() => ta.focus(), 50);
      this.answer = () => (ta.value.trim() ? { type: 'text', text: ta.value.trim() } : null);
    } else if (q.type === 'sketch' || q.type === 'point') {
      const sk = this.sketch;
      sk.canvas.style.display = 'block';
      sk.mode = q.type === 'sketch' ? 'curve' : 'point';
      sk.points = [];
      sk.set_mapping(this.mapping(q.axes));
      sk.area = q.type === 'sketch' ? { x: q.x_range, y: q.y_range } : null;
      sk.placeholder = q.type === 'sketch' ? t('draw_here') : t('click_here');
      sk.demo();
      const card = h('div', 'mn-yourturn', `<div class="mn-yt-head"><span class="mn-yt-icon" aria-hidden="true">${ICON.sketch}</span>${esc(q.type === 'sketch' ? t('draw_prediction') : t('mark_prediction'))}</div><div class="mn-help">${esc(q.type === 'sketch' ? t('sketch_help') : t('point_help'))}</div>`);
      const clear = this.button(t('redraw'), () => sk.clear());
      box.append(card, clear);
      this.answer = () => (sk.points.length ? (q.type === 'sketch' ? { type: 'sketch', points: sk.points } : { type: 'point', point: sk.points[0] }) : null);
    }
    if (step.confidence) {
      const c = this.el.conf;
      c.append(h('span', '', esc(t('how_sure'))));
      (['guessing', 'fairly', 'certain'] as const).forEach((key, i) => {
        const b = h('button', '', esc(t(key)));
        b.setAttribute('aria-pressed', 'false');
        b.onclick = () => {
          this.confidence = (i + 1) as 1 | 2 | 3;
          c.querySelectorAll('button').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
        };
        c.append(b);
      });
    }
    const check = this.button(step.purpose === 'predict' ? t('commit') : t('check'), () => {
      const r = this.answer?.();
      if (!r) return this.flash(t('answer_first'));
      if (step.confidence && !this.confidence) return this.flash(t('pick_sure'));
      if (r.type === 'text') return void this.check_text(step, prompt, r.text, check);
      this.runtime.submit(r, { confidence: this.confidence });
    }, true);
    check.dataset.role = 'check';
    this.el.actions.append(check);
    if (step.hints?.length) {
      const hb = this.button(t('hint'), () => this.runtime.hint());
      hb.dataset.role = 'hint';
      this.el.actions.append(hb);
    }
    if (step.purpose !== 'predict') {
      const give = this.button(t('show_answer'), () => this.runtime.reveal_answer());
      give.dataset.role = 'give';
      this.el.actions.append(give);
    }
  }
  /** A free-text answer: the AI grader marks the key points; without one (or when it fails) the learner compares with the model answer. */
  private async check_text(step: CheckpointStep, prompt: string, text: string, check: HTMLButtonElement): Promise<void> {
    const q = step.question;
    if (q.type !== 'text') return;
    const ta = this.el.answer.querySelector<HTMLTextAreaElement>('textarea');
    const key_points = q.rubric.key_points.map((k) => this.tr(k));
    if (ta) ta.disabled = true;
    check.disabled = true;
    if (this.o.grade_text) {
      this.flash(t('checking'));
      let r: { hits: boolean[]; feedback: string } | null = null;
      try {
        r = await this.o.grade_text({ question: prompt, answer: text, key_points, model_answer: this.tr(q.rubric.model_answer), lang: this.lang });
      } catch (e) {
        console.warn('text grading failed; self-assessment instead', e);
      }
      if (this.runtime.step !== step) return; // the learner moved on meanwhile
      if (r) {
        this.el.feedback.className = 'mn-feedback';
        this.runtime.submit({ type: 'text', text, hits: r.hits, feedback: r.feedback }, { confidence: this.confidence });
        return;
      }
    }
    this.self_assess(step, text, key_points, check);
  }
  private self_assess(step: CheckpointStep, text: string, key_points: string[], check: HTMLButtonElement): void {
    const q = step.question;
    if (q.type !== 'text') return;
    this.el.feedback.className = 'mn-feedback';
    this.el.feedback.innerHTML = '';
    check.remove();
    this.el.actions.querySelector('[data-role=give]')?.remove();
    // first the key points to tick against your own answer, then the model answer for reference
    const card = h('div', 'mn-selfcheck', `<div class="mn-yt-head">${esc(t('self_title'))}</div>${this.o.grade_text ? '' : `<div class="mn-help">${esc(t('self_offline'))}</div>`}<div><b>${esc(t('self_tick'))}</b></div>`);
    const list = h('ul', 'mn-points');
    key_points.forEach((k, i) => {
      list.insertAdjacentHTML('beforeend', `<li><label><input type="checkbox" data-i="${i}"><span>${math_html(k)}</span></label></li>`);
    });
    card.append(list, h('div', 'mn-help', `<b>${esc(t('model_answer'))}</b>`), h('div', 'mn-model', math_html(this.tr(q.rubric.model_answer))));
    this.el.answer.append(card);
    const done = this.button(t('self_done'), () => {
      const hits = key_points.map((_, i) => !!list.querySelector<HTMLInputElement>(`input[data-i="${i}"]`)?.checked);
      done.remove();
      list.querySelectorAll('input').forEach((x) => (x.disabled = true));
      this.runtime.submit({ type: 'text', text, hits, self: true }, { confidence: this.confidence });
    }, true);
    done.dataset.role = 'check';
    this.el.actions.prepend(done);
    card.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }
  /** The key points (ticked when made) and the model answer, after a free-text question. */
  private rubric_summary(step: CheckpointStep, points?: boolean[]): HTMLElement {
    const q = step.question;
    const box = h('div');
    if (q.type !== 'text') return box;
    const items = q.rubric.key_points.map((k, i) => `<li class="${points?.[i] ? 'hit' : ''}"><span class="mk" aria-hidden="true">${points?.[i] ? '✓' : '·'}</span><span>${math_html(this.tr(k))}</span></li>`).join('');
    box.innerHTML = `<p><b>${esc(t('key_points'))}</b>${points ? ` (${esc(t('points_got', { k: points.filter(Boolean).length, n: points.length }))})` : ''}</p><ul class="mn-points">${items}</ul><p style="margin-top:8px"><b>${esc(t('model_answer'))}</b></p><div class="mn-model">${math_html(this.tr(q.rubric.model_answer))}</div>`;
    return box;
  }
  private flash(msg: string): void {
    const fb = this.el.feedback;
    fb.className = 'mn-feedback info';
    fb.textContent = msg;
  }
  private finalize_actions(step: CheckpointStep): void {
    this.final = true;
    this.el.actions.querySelectorAll<HTMLButtonElement>('[data-role]').forEach((b) => (b.disabled = true));
    const label = step.reveal ? t('watch') : t('continue');
    this.el.actions.prepend(this.button(label, () => this.runtime.next(), true));
    this.el.actions.querySelector<HTMLButtonElement>('[data-role=check]')?.remove();
    const ta = this.el.answer.querySelector<HTMLTextAreaElement>('textarea');
    if (ta) ta.disabled = true;
  }
  private mark_choices(step: CheckpointStep, final: boolean): void {
    if (step.question.type !== 'choice') return;
    const opts = step.question.options;
    this.el.answer.querySelectorAll<HTMLElement>('.mn-choice').forEach((b) => {
      const o = opts.find((x) => x.id === b.dataset.id)!;
      b.classList.remove('good', 'bad');
      if (b.getAttribute('aria-pressed') === 'true') b.classList.add(o.correct ? 'good' : 'bad');
      else if (final && o.correct) b.classList.add('good');
    });
  }
  private show_truth(step: CheckpointStep): void {
    const q = step.question;
    if (q.type !== 'sketch') return;
    const [a, b] = q.x_range;
    this.sketch.truth = Array.from({ length: 120 }, (_, i) => {
      const x = a + ((b - a) * i) / 119;
      return [x, q.f(x, this.runtime.vars)] as [number, number];
    });
    this.sketch.redraw();
  }
  /** Pixel <-> data mapping through the scene camera and optional axes. */
  private mapping(axes?: (scene: any) => AxesLike): SketchMapping {
    const p = this.runtime.player!;
    const cam = p.scene.camera as any;
    const ax = axes ? axes(p.scene) : null;
    const rect = () => this.canvas.getBoundingClientRect();
    return {
      to_data: (px, py) => {
        const r = rect();
        const x = cam.frame_center[0] + (px / r.width - 0.5) * cam.frame_width;
        const y = cam.frame_center[1] + (0.5 - py / r.height) * cam.frame_height;
        const c = ax ? ax.point_to_coords([x, y, 0]) : [x, y];
        return [c[0], c[1]];
      },
      to_px: (x, y) => {
        const r = rect();
        const q = ax ? ax.coords_to_point(x, y) : [x, y];
        return [((q[0] - cam.frame_center[0]) / cam.frame_width + 0.5) * r.width, (0.5 - (q[1] - cam.frame_center[1]) / cam.frame_height) * r.height];
      },
    };
  }

  // ---------------------------------------------------------------- progress, mastery, summary
  private render_steps(): void {
    if (this.game) return this.render_levels();
    const box = this.el.steps;
    box.innerHTML = '';
    const cur = this.runtime?.index ?? -1;
    // "step 5 of 17 · chapter" and a thin bar (branch-only detours count as the step they came from)
    const main = this.lesson.steps.map((s, i) => [s, i] as const).filter(([s]) => !s.branch_only);
    const k = main.filter(([, i]) => i <= cur).length;
    if (this.el.where && cur >= 0) {
      const chapter = this.tr(this.chapter_of(cur));
      this.el.where.innerHTML = `<span>${esc(t('lesson_step', { k: Math.max(1, k), n: main.length }))}${chapter ? ` · ${math_html(chapter)}` : ''}</span><span class="mn-where-bar" aria-hidden="true"><i style="width:${Math.round((Math.max(1, k) / main.length) * 100)}%"></i></span>`;
    }
    let lastChapter: string | undefined;
    this.lesson.steps.forEach((s, i) => {
      if (s.branch_only) return;
      const chapter = s.chapter !== undefined ? this.tr(s.chapter) : undefined;
      if (chapter && chapter !== lastChapter) {
        lastChapter = chapter;
        box.append(h('span', 'mn-chapter', esc(chapter)));
      }
      const kind = s.kind === 'checkpoint' ? (s.question.type === 'sketch' ? 'sketch' : 'question') : s.kind === 'explore' ? 'explore' : s.kind === 'scene' ? 'watch' : s.kind;
      // (text kinds get their own prefix: .mn-code and .mn-read are the pages themselves)
      const d = h('button', 'mn-dot ' + (s.kind === 'read' || s.kind === 'derive' || s.kind === 'code' ? 'mn-dk-' : 'mn-') + kind + (i < cur ? ' done' : i === cur ? ' now' : ''), ICON[kind]);
      d.title = `${this.tr(s.title) || s.id} - ${t(`kind_${kind}`)}`;
      d.setAttribute('aria-label', d.title);
      d.onclick = () => this.runtime.goto(s.id);
      box.append(d);
    });
  }
  private render_mastery(): void {
    const box = this.el.mastery;
    if (!box) return;
    // nothing graded yet in this lesson: no panel (untouched skills at 20% read like a score)
    const skills = this.lesson.skills.filter((s) => this.touched.has(s.id));
    box.style.display = skills.length ? '' : 'none';
    box.innerHTML = skills.length ? `<div class="mn-kicker">${esc(t('mastery'))}</div>` : '';
    if (!skills.length) return;
    for (const s of skills) {
      const p = this.runtime?.learner.mastery(s.id) ?? 0;
      const row = h('div', 'mn-skill' + (p >= MASTERY ? ' mastered' : ''), `<span>${math_html(this.tr(s.name))}</span><span style="text-align:right">${Math.round(p * 100)}%</span><div class="mn-meter"><i style="width:${Math.round(p * 100)}%"></i></div>`);
      box.append(row);
    }
    const due = this.runtime?.learner.due().length ?? 0;
    if (due) box.append(h('div', 'mn-help', esc(t('items_due', { n: due, s: plural_s(due) }))));
  }
  private show_summary(): void {
    this.reset_panel();
    this.app.classList.remove('mn-textstep');
    // the last scene's final frame stays beside the summary; a lesson that ended on a page has none (no empty stage)
    this.app.classList.toggle('mn-nostage', !this.runtime.player && !this.game);
    this.root.querySelector('.mn-resumed')?.remove();
    this.narrator.stop(!this.game); // the character's last words stay in the game view
    this.runtime.player?.show_end();
    const s = this.runtime.log.summary();
    this.el.kicker.textContent = t('done');
    const mis = Object.keys(s.misconceptions).map((id) => {
      const m = this.lesson.misconceptions?.find((x) => x.id === id);
      return m ? this.tr(m.description) : id;
    });
    set_math(this.el.prompt, t('summary', { c: s.correct, a: s.answered, h: s.hints, hs: plural_s(s.hints), t: fmt(s.time_ms / 1000) }));
    if (mis.length) {
      this.el.feedback.className = 'mn-feedback info';
      this.el.feedback.innerHTML = `<p>${esc(t('ideas_worked'))}</p>${mis.map((m) => `<p>• ${math_html(m)}</p>`).join('')}`;
    }
    const due = this.runtime.learner.due().length;
    this.el.hints.innerHTML = `<div class="mn-help">${esc(due ? t('review_later_n', { n: due, s: plural_s(due) }) : t('review_later'))}</div>`;
    this.el.actions.append(...this.end_actions());
    if (this.o.lab) this.el.endextra.append(this.lab_card(this.o.lab));
    this.render_mastery();
    this.render_steps();
    if (this.game) this.game_over(mis);
  }
  /** The lab that goes with this lesson, as a card under the end actions. */
  private lab_card(lab: NonNullable<ViewOptions['lab']>): HTMLElement {
    const a = h('a', 'mn-labcard', `<span class="mn-labcard-kicker">${esc(t('hands_on'))}</span><span class="mn-labcard-title">${math_html(this.tr(lab.title))}</span>${lab.note ? `<span class="mn-labcard-note">${math_html(this.tr(lab.note))}</span>` : ''}`);
    a.href = lab.href;
    a.onclick = (e) => {
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
      e.preventDefault();
      if (this.o.navigate) this.o.navigate(lab.href);
      else location.assign(lab.href);
    };
    return a;
  }
  /** On a text page, selecting a passage offers "Ask about this" next to it. */
  private unwatch: (() => void) | null = null;
  private watch_selection(): void {
    const btn = h('button', 'mn-askhere', esc(t('ask_here')));
    btn.type = 'button';
    btn.hidden = true;
    document.body.append(btn);
    let passage = '';
    const place = () => {
      const sel = document.getSelection();
      const text = sel && !sel.isCollapsed ? sel.toString().replace(/\s+/g, ' ').trim() : '';
      const range = text && sel!.rangeCount ? sel!.getRangeAt(0) : null;
      // only text read on a page of this lesson (not the panel, not a code editor's input)
      const inside = range && this.el.page.contains(range.commonAncestorContainer) && !(range.commonAncestorContainer as Element).closest?.('textarea,input');
      if (!inside || text.length < 2) {
        btn.hidden = true;
        return;
      }
      passage = text.slice(0, 1200);
      const r = range!.getBoundingClientRect();
      const touch = matchMedia('(pointer: coarse)').matches;
      btn.hidden = false;
      const w = btn.offsetWidth || 90;
      // below the selection on touch screens (the system's own menu sits above it), above it otherwise
      const top = touch ? r.bottom + 10 : r.top - 40;
      btn.style.top = `${Math.max(8, Math.min(innerHeight - 44, top < 8 ? r.bottom + 10 : top))}px`;
      btn.style.left = `${Math.max(8, Math.min(innerWidth - w - 8, r.left + r.width / 2 - w / 2))}px`;
    };
    let timer = 0;
    const later = () => {
      clearTimeout(timer);
      timer = window.setTimeout(place, 120);
    };
    // the click must not clear the selection before it is read
    btn.addEventListener('pointerdown', (e) => e.preventDefault());
    btn.onclick = () => {
      btn.hidden = true;
      this.o.help?.({ selected: passage });
    };
    document.addEventListener('selectionchange', later);
    addEventListener('scroll', place, { passive: true });
    addEventListener('resize', place);
    this.unwatch = () => {
      document.removeEventListener('selectionchange', later);
      removeEventListener('scroll', place);
      removeEventListener('resize', place);
      clearTimeout(timer);
      btn.remove();
    };
  }
  /** The end of the lesson: on to the next lesson of the course (the main action), or back to the course. */
  private end_actions(): HTMLButtonElement[] {
    const next = this.o.next;
    const go = (href: string) => (this.o.navigate ? this.o.navigate(href) : location.assign(href));
    const back = this.button(t('back_to_course'), () => go(this.o.back ?? '/'), !next);
    if (!next) return [back];
    return [this.button(t('next_lesson', { title: this.tr(next.title) }), () => go(next.href), true), back];
  }
  /** The game view's last card: all the stars, and the ideas that came up. */
  private game_over(ideas: string[]): void {
    const worlds = this.lesson.steps.filter((s) => s.kind === 'explore' && s.stars && !s.branch_only);
    const got = worlds.reduce((n, s) => n + (this.stars[s.id] ?? 0), 0), max = 3 * worlds.length;
    const card = this.el.levelup;
    card.innerHTML = '';
    const acts = h('div', 'mn-actions');
    acts.append(...this.end_actions(), this.button(t('play_again'), () => this.runtime.goto(this.lesson.steps[0].id)));
    // the tray under the stage would only repeat this card
    for (const k of ['prompt', 'feedback', 'actions']) this.el[k].innerHTML = '';
    this.el.kicker.textContent = '';
    card.append(
      h('div', 'mn-lu-title', esc(t('lesson_complete'))),
      h('div', 'mn-lu-total', `<span class="mn-lu-star" aria-hidden="true">★</span><b>${got}</b><span class="mn-of">${esc(t('stars_of', { max }))}</span>`),
      ideas.length ? h('div', 'mn-lu-msg', t('ideas_you_worked', { list: ideas.map((m) => math_html(m)).join(' · ') })) : h('div', 'mn-lu-msg', esc(t('no_tricky'))),
      acts,
    );
    card.classList.add('show');
    this.juice?.success([0, 0, 0]);
  }

  // ---------------------------------------------------------------- dev overlay
  private dev_report(p: ScenePlayer): void {
    const box = this.el.dev;
    if (!box) return;
    const run = () => {
      if (!p.loaded) return void setTimeout(run, 100);
      const frame = p.frame;
      const issues = lint_timeline(p);
      p.compute_frame(Math.max(0, frame));
      p.draw();
      const lines = issues.map((i) => `<span class="${i.severity}">[${i.severity}] ${i.rule}</span> ${i.time !== undefined ? `@${i.time.toFixed(1)}s ` : ''}${i.message}`);
      const end = p.frame;
      p.show_end();
      const desc = describe_text(p.scene);
      p.compute_frame(Math.max(0, end));
      p.draw();
      box.innerHTML = `<b>Linter</b> (${issues.length} issue${issues.length === 1 ? '' : 's'})\n${lines.join('\n') || 'no issues'}\n\n<b>Scene description (end state)</b>\n${desc.replace(/</g, '&lt;')}`;
    };
    run();
  }
}
