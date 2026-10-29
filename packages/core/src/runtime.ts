// Plays a lesson: scenes, explorations and checkpoints, with branching on
// answers, hints, the learner model and the event log. UI-agnostic - the DOM
// view (ui/view.ts) or any other front end subscribes to its events.
import type { Scene } from 'manim-web';
import { Interaction } from 'manim-web/ext/interact';
import { ScenePlayer, preload } from 'manim-web/ext/player';
import { tr, type L10n, type Lang } from './content';
import { EventLog } from './events';
import { expected_answer, grade } from './grading';
import { LearnerModel } from './learner/model';
import { grade_blank } from './pages';
import {
  fill, is_text_step, type CheckpointStep, type DeriveStep, type ExploreStep, type Grade, type Lesson, type LessonContext, type Misconception, type Response,
  type SceneSpec, type Step, type TextStep, type Vars,
} from './schema';
import { WorldSession, type Finding, type Line, type SemanticEvent } from './world';

export type RuntimeEvent =
  | { type: 'step'; step: Step; index: number }
  | { type: 'scene-end'; step: Step }
  | { type: 'explore'; step: ExploreStep; prompt: string; ui: Interaction }
  | { type: 'goal'; step: ExploreStep; message: string; id: string; final: boolean; stars?: 1 | 2 | 3 }
  | { type: 'semantic'; step: ExploreStep; event: SemanticEvent }
  | { type: 'finding'; step: ExploreStep; finding: Finding; misconception?: Misconception }
  | { type: 'line'; step: Step; line: Line }
  | { type: 'checkpoint'; step: CheckpointStep; prompt: string; vars: Vars; attempt: number }
  | { type: 'graded'; step: CheckpointStep; grade: Grade; attempt: number; final: boolean; misconception?: Misconception }
  | { type: 'hint'; step: CheckpointStep | ExploreStep; text: string; index: number; remaining: number }
  /** A text page (read, derive, code) is on screen; there is no scene. */
  | { type: 'page'; step: TextStep }
  /** The fill-in line of a derivation was answered (or shown: `revealed`). */
  | { type: 'blank'; step: DeriveStep; grade: Grade; attempt: number; revealed?: boolean }
  /** The world moved the cue to these controls (WorldApi.cue; also from setup, before 'explore'). */
  | { type: 'cue'; step: ExploreStep; targets: L10n[] }
  | { type: 'finished' };

export interface RuntimeOptions {
  canvas: HTMLCanvasElement;
  learner?: LearnerModel;
  log?: EventLog;
  /** Seed for variants (default: random). */
  seed?: number;
  /** Called for every new player, e.g. to apply a theme. */
  on_player?: (player: ScenePlayer) => void;
  /** Play scene steps automatically (default true). */
  autoplay?: boolean;
  /** When the learner may move on (default LINEAR_FLOW: always). */
  flow?: FlowPolicy;
  /** The learner's language: L10n texts the runtime emits are resolved in it (default 'en'). */
  lang?: Lang;
}

/** Decides whether the learner may leave the current step. */
export interface FlowPolicy {
  name: string;
  can_continue(step: Step, world: WorldSession | null): boolean;
}
/** Essay flow: move on whenever you like. */
export const LINEAR_FLOW: FlowPolicy = { name: 'linear', can_continue: () => true };
/** Game flow: a world with goals is a level - finish it to move on. */
export const GAME_FLOW: FlowPolicy = {
  name: 'game',
  can_continue: (step, world) => step.kind !== 'explore' || !world || world.done || step.required === false || !(step.goals?.length || step.goal),
};

function mulberry(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
/**
 * After the browser has painted what changed: at once outside a browser page (tools, tests), and after
 * 100 ms at most, since a page that is open but not on screen may get no frames without being "hidden".
 */
const painted = (): Promise<void> =>
  typeof requestAnimationFrame === 'undefined' || typeof document === 'undefined' || document.hidden
    ? Promise.resolve()
    : new Promise((r) => {
        requestAnimationFrame(() => setTimeout(r, 0));
        setTimeout(r, 100);
      });
const isClass = (f: SceneSpec): f is new () => Scene => /^class\b/.test(Function.prototype.toString.call(f)) || !!(f as any).prototype?.construct;

export class LessonRuntime {
  lesson: Lesson;
  opts: RuntimeOptions;
  learner: LearnerModel;
  log: EventLog;
  index = -1;
  player: ScenePlayer | null = null;
  ui: Interaction | null = null;
  /** The live world of the current explore step. */
  world: WorldSession | null = null;
  vars: Vars = {};
  /** Lesson-wide variant values; checkpoint params are layered on top. */
  lesson_vars: Vars = {};
  rng: () => number;
  /** The learner's language (texts in events are resolved in it). */
  lang: Lang;
  /** Where to continue after a reveal/remediation detour. */
  private returns: string[] = [];
  private attempt = 0;
  private hints_used = 0;
  private last_grade: Grade | null = null;
  private asked_at = 0;
  private listeners: ((e: RuntimeEvent) => void)[] = [];
  private token = 0;

  constructor(lesson: Lesson, opts: RuntimeOptions) {
    this.lesson = lesson;
    this.opts = opts;
    this.learner = opts.learner ?? new LearnerModel(undefined, lesson.skills);
    this.learner.add_skills(lesson.skills);
    this.log = opts.log ?? new EventLog();
    this.lang = opts.lang ?? 'en';
    this.rng = mulberry(opts.seed ?? Math.floor(Math.random() * 2 ** 31));
    this.lesson_vars = lesson.params?.(this.rng) ?? {};
    this.vars = { ...this.lesson_vars };
  }

  on(f: (e: RuntimeEvent) => void): () => void {
    this.listeners.push(f);
    return () => (this.listeners = this.listeners.filter((x) => x !== f));
  }
  private emit(e: RuntimeEvent): void {
    for (const f of this.listeners) f(e);
  }
  /** An L10n text in the learner's language, filled with the variant values. */
  text(s: L10n | undefined): string {
    return fill(tr(s, this.lang), this.vars);
  }
  get step(): Step | undefined {
    return this.lesson.steps[this.index];
  }
  get ctx(): LessonContext {
    return { vars: this.vars, rng: this.rng, lang: this.lang };
  }
  /** Chapters for the timeline: first step index of each chapter. */
  chapters(): { title: L10n; index: number }[] {
    const out: { title: L10n; index: number }[] = [];
    this.lesson.steps.forEach((s, i) => s.chapter && out.push({ title: s.chapter, index: i }));
    return out;
  }
  find(id: string): number {
    const i = this.lesson.steps.findIndex((s) => s.id === id);
    if (i < 0) throw new Error(`lesson ${this.lesson.id}: no step '${id}'`);
    return i;
  }

  // ---------------------------------------------------------------- navigation
  async start(at?: string): Promise<void> {
    this.log.emit({ verb: 'started', lesson: this.lesson.id, vars: this.vars });
    await this.go(at ? this.find(at) : 0);
  }
  async goto(id: string): Promise<void> {
    this.returns = [];
    await this.go(this.find(id));
  }
  /** Leave the current step (after its scene ended, the learner pressed continue, or a checkpoint was answered). */
  async next(): Promise<void> {
    const s = this.step;
    let target: string | undefined;
    if (s?.kind === 'checkpoint' && this.last_grade) {
      const g = this.last_grade;
      const mis = g.misconception ? this.lesson.misconceptions?.find((m) => m.id === g.misconception) : undefined;
      const after = (g.correct ? s.on_correct : s.on_wrong) ?? s.next;
      if (after) this.returns.push(after);
      else {
        let i = this.index + 1;
        while (i < this.lesson.steps.length && this.lesson.steps[i].branch_only) i++;
        if (i < this.lesson.steps.length) this.returns.push(this.lesson.steps[i].id);
      }
      if (!g.correct && mis?.remediation) {
        if (s.reveal) this.returns.push(s.reveal);
        target = mis.remediation;
      } else if (s.reveal) target = s.reveal;
      else target = this.returns.pop();
    } else target = s?.next ?? this.returns.pop();
    if (target) return this.go(this.find(target));
    let i = this.index + 1;
    while (i < this.lesson.steps.length && this.lesson.steps[i].branch_only) i++;
    if (i < this.lesson.steps.length) return this.go(i);
    this.finish();
  }
  private finish(): void {
    this.teardown();
    this.log.emit({ verb: 'completed', lesson: this.lesson.id, data: { summary: this.log.summary() } });
    this.emit({ type: 'finished' });
  }
  /** May the learner move on now (per the flow policy)? */
  can_continue(): boolean {
    const s = this.step;
    return !s || (this.opts.flow ?? LINEAR_FLOW).can_continue(s, this.world);
  }
  /**
   * Stop for good: the learner left the lesson. Stops the world's idle timer (whose
   * lines would otherwise keep being spoken), the player and the handles; pending
   * steps are cancelled and no more events are emitted.
   */
  dispose(): void {
    this.leave();
    this.disposed = true;
    this.token++;
    this.listeners = [];
    this.teardown();
  }
  private disposed = false;
  /** When the step on screen came (its 'left' event says how long it stayed). */
  private entered = 0;
  private leave(): void {
    const s = this.entered ? this.lesson.steps[this.index] : undefined;
    if (s) this.log.emit({ verb: 'left', lesson: this.lesson.id, step: s.id, result: { duration_ms: Math.round(performance.now() - this.entered) } });
    this.entered = 0;
  }
  private teardown(): void {
    this.world?.stop();
    this.world = null;
    this.ui?.dispose();
    this.ui = null;
    this.player?.pause();
    this.player?.stop_live();
  }
  private async go(i: number): Promise<void> {
    if (this.disposed) return;
    const my = ++this.token;
    this.teardown();
    this.leave();
    this.index = i;
    this.entered = performance.now();
    const step = this.lesson.steps[i];
    this.attempt = 0;
    this.hints_used = 0;
    this.last_grade = null;
    this.emit({ type: 'step', step, index: i });
    this.log.emit({ verb: 'viewed', lesson: this.lesson.id, step: step.id });
    this.vars = step.kind === 'checkpoint' && step.params ? { ...this.lesson_vars, ...step.params(this.rng) } : { ...this.lesson_vars };
    const spec = 'scene' in step ? step.scene : undefined;
    if (spec) {
      // let the page show the new step before building its scene (that blocks the page while it records)
      await painted();
      if (my !== this.token) return;
      const player = await this.load_scene(spec);
      if (my !== this.token) return;
      this.player = player;
    } else {
      // no figure for this step: clear the stage rather than leave the previous frame up
      this.player = null;
      const g = this.opts.canvas.getContext('2d');
      g?.clearRect(0, 0, this.opts.canvas.width, this.opts.canvas.height);
    }
    if (my !== this.token) return;
    if (step.kind === 'scene') {
      const p = this.player!;
      p.opts.on_end = () => {
        if (my !== this.token) return;
        this.emit({ type: 'scene-end', step });
      };
      if (this.opts.autoplay !== false) p.play();
    } else if (step.kind === 'explore') {
      const p = this.player!;
      p.show_end();
      const ui = new Interaction(p);
      this.ui = ui;
      const goals = [...(step.goal ? [{ id: 'goal', ...step.goal }] : []), ...(step.goals ?? [])];
      const t0 = performance.now();
      const logged = new Map<string, number>(); // throttle interaction events per kind
      const log_interaction = (object?: string) => {
        const k = object ?? '';
        if (performance.now() - (logged.get(k) ?? -1e9) < 1000) return;
        logged.set(k, performance.now());
        this.log.emit({ verb: 'interacted', lesson: this.lesson.id, step: step.id, object });
      };
      const world = new WorldSession({ goals, detectors: step.detectors, lines: step.lines, stars: step.stars, idle_s: step.idle_s }, p.scene, this.ctx, (o) => {
        if (my !== this.token) return;
        if (o.type === 'semantic') {
          log_interaction(o.event.type);
          this.emit({ type: 'semantic', step, event: o.event });
        } else if (o.type === 'finding') {
          const mis = o.finding.kind === 'misconception' ? this.lesson.misconceptions?.find((m) => m.id === o.finding.id) : undefined;
          if (o.finding.kind === 'misconception') {
            this.log.emit({ verb: 'detected', lesson: this.lesson.id, step: step.id, object: step.skill, result: { misconception: o.finding.id } });
            if (step.skill) this.learner.observe({ skill: step.skill, item: `${this.lesson.id}/${step.id}`, correct: false, graded: true });
          }
          this.emit({ type: 'finding', step, finding: o.finding, misconception: mis });
        } else if (o.type === 'goal') {
          if (o.final) {
            this.log.emit({ verb: 'explored', lesson: this.lesson.id, step: step.id, result: { correct: true, duration_ms: performance.now() - t0, stars: o.stars } });
            if (step.skill && !world.stats().misconceptions) this.learner.observe({ skill: step.skill, item: `${this.lesson.id}/${step.id}`, correct: true, hints: world.hints, graded: true });
          }
          this.emit({ type: 'goal', step, message: this.text(o.message), id: o.goal.id, final: o.final, stars: o.stars });
        } else if (o.type === 'line') {
          this.emit({ type: 'line', step, line: { ...o.line, text: this.text(o.line.text) } });
        } else if (o.type === 'cue') {
          this.emit({ type: 'cue', step, targets: o.targets });
        }
      });
      this.world = world;
      step.setup?.(p.scene, ui, this.ctx, world.api);
      ui.on_change = () => {
        log_interaction();
        world.input();
      };
      p.start_live();
      this.emit({ type: 'explore', step, prompt: this.text(step.prompt), ui });
      world.start();
    } else if (step.kind === 'checkpoint') {
      this.player?.show_end();
      this.asked_at = performance.now();
      this.emit({ type: 'checkpoint', step, prompt: this.text(step.prompt), vars: this.vars, attempt: 0 });
    } else if (is_text_step(step)) {
      this.asked_at = performance.now();
      this.emit({ type: 'page', step });
    }
  }
  private async load_scene(spec: SceneSpec): Promise<ScenePlayer> {
    await preload(); // scene constructors and factories may build Text/TeX
    const scene = isClass(spec) ? new spec() : (spec as (c: LessonContext) => Scene)(this.ctx);
    const player = new ScenePlayer(scene, this.opts.canvas, { audio: true });
    this.opts.on_player?.(player);
    await player.load();
    return player;
  }

  // ---------------------------------------------------------------- checkpoints
  /** Grade an answer to the current checkpoint. */
  submit(response: Response, o: { confidence?: 1 | 2 | 3 } = {}): Grade {
    const s = this.step;
    if (s?.kind !== 'checkpoint') throw new Error('submit() outside a checkpoint');
    this.attempt++;
    const g = grade(s.question, response, this.vars, this.lang);
    // a prediction is committed once, then observed (retrying would turn it into guessing)
    const max = s.attempts ?? (s.purpose === 'predict' ? 1 : 2);
    // a self-assessed text answer has seen the model answer: it cannot be tried again
    const final = g.correct || this.attempt >= max || (response.type === 'text' && !!response.self);
    const mis = g.misconception ? this.lesson.misconceptions?.find((m) => m.id === g.misconception) : undefined;
    this.log.emit({
      verb: 'answered', lesson: this.lesson.id, step: s.id, object: s.skill, vars: this.vars,
      result: { correct: g.correct, score: g.score, response, misconception: g.misconception, confidence: o.confidence, hints: this.hints_used, attempt: this.attempt, duration_ms: performance.now() - this.asked_at },
    });
    // mastery counts first attempts only; predictions are not graded
    if (this.attempt === 1) {
      this.learner.observe({ skill: s.skill, item: `${this.lesson.id}/${s.id}`, correct: g.correct, hints: this.hints_used, confidence: o.confidence, graded: s.purpose !== 'predict' });
    }
    if (final) this.last_grade = g;
    const out = { ...g, feedback: g.feedback.map((f) => fill(f, this.vars)) };
    if (!final) delete out.expected;
    this.emit({ type: 'graded', step: s, grade: out, attempt: this.attempt, final, misconception: mis });
    return out;
  }
  /** Next hint of the ladder (null when none are left). */
  hint(): string | null {
    const s = this.step;
    if ((s?.kind !== 'checkpoint' && s?.kind !== 'explore') || !s.hints || this.hints_used >= s.hints.length) return null;
    const text = this.text(s.hints[this.hints_used]);
    this.hints_used++;
    if (this.world) this.world.hints = this.hints_used;
    this.log.emit({ verb: 'hinted', lesson: this.lesson.id, step: s.id, result: { hints: this.hints_used } });
    this.emit({ type: 'hint', step: s, text, index: this.hints_used - 1, remaining: s.hints.length - this.hints_used });
    return text;
  }
  /** Give up: count as wrong and show the answer. */
  reveal_answer(): Grade | null {
    const s = this.step;
    if (s?.kind !== 'checkpoint') return null;
    const g: Grade = { correct: false, score: 0, feedback: [], expected: expected_answer(s.question, this.vars, this.lang) ?? undefined };
    this.log.emit({ verb: 'revealed', lesson: this.lesson.id, step: s.id });
    if (this.attempt === 0) this.learner.observe({ skill: s.skill, item: `${this.lesson.id}/${s.id}`, correct: false, graded: s.purpose !== 'predict' });
    this.last_grade = g;
    this.emit({ type: 'graded', step: s, grade: g, attempt: this.attempt, final: true });
    return g;
  }
  // ---------------------------------------------------------------- derivations
  /** Grade the fill-in line of the current derivation (logged; the first attempt counts for its skill). */
  submit_blank(text: string): Grade {
    const s = this.step;
    if (s?.kind !== 'derive' || !s.blank) throw new Error('submit_blank() outside a derivation with a fill-in line');
    this.attempt++;
    const g = grade_blank(s, text, this.lang);
    this.log.emit({
      verb: 'answered', lesson: this.lesson.id, step: s.id, object: s.skill,
      result: { correct: g.correct, score: g.score, response: { type: 'expression', text }, attempt: this.attempt, duration_ms: performance.now() - this.asked_at },
    });
    if (this.attempt === 1 && s.skill) this.learner.observe({ skill: s.skill, item: `${this.lesson.id}/${s.id}`, correct: g.correct, graded: true });
    this.emit({ type: 'blank', step: s, grade: g, attempt: this.attempt });
    return g;
  }
  /** Show the fill-in line without answering it (counts as not known when nothing was tried). */
  reveal_blank(): void {
    const s = this.step;
    if (s?.kind !== 'derive' || !s.blank) return;
    this.log.emit({ verb: 'revealed', lesson: this.lesson.id, step: s.id });
    if (this.attempt === 0 && s.skill) this.learner.observe({ skill: s.skill, item: `${this.lesson.id}/${s.id}`, correct: false, graded: true });
    this.emit({ type: 'blank', step: s, grade: { correct: false, score: 0, feedback: [] }, attempt: this.attempt, revealed: true });
  }

  progress(): { index: number; total: number } {
    return { index: this.index, total: this.lesson.steps.length };
  }
}
