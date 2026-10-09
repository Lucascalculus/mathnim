// The lesson format. A lesson is data (steps, questions, skills) plus scenes
// written with manim-web. Humans and LLMs author the same structure.
//
// Every learner-facing string is L10n (content.ts): a plain string (the same in
// every language - all lessons written before the bilingual course) or
// { en, zh }. Presenters resolve it with tr(s, lang) where it is shown or
// spoken; the runtime resolves what it emits (prompts, messages, lines, hints,
// feedback). Ids, TeX, code and visual names stay plain strings.
//
// Added for the fine-tuning course (all optional for existing lessons):
// - step kinds 'read', 'derive', 'code' (text pages, content.ts);
// - question type 'text': a free-text answer checked against key points. With
//   a model the AI tutor marks which key points the answer makes and says one
//   sentence of feedback; offline the learner sees the model answer and ticks
//   the key points they covered (self-assessment, final). Correct when at
//   least `min_points` (default: all) key points are made; it counts for the
//   learner model like any check;
// - CheckpointStep.group: consecutive checkpoints with the same group id are
//   one case: its title and brief (blocks, as on a read page) are shown with
//   the questions, which are numbered 1/3, 2/3, ...
import type { Scene } from 'manim-web';
import type { Interaction } from 'manim-web/ext/interact';
import type { BKTParams } from './learner/bkt';
import type { XY } from './grading/sketch';
import type { Block, CodeContent, DeriveContent, L10n, ReadContent } from './content';
import type { Detector, Goal, Line, StarRule, WorldApi } from './world';

/** Values of a lesson/question variant (e.g. { near: 9, far: 16 }). */
export type Vars = Record<string, number>;

export interface LessonContext {
  vars: Vars;
  /** Seeded random numbers for this variant. */
  rng: () => number;
}

/** A scene for a step: a manim-web Scene class, or a factory using the variant values. */
export type SceneSpec = (new () => Scene) | ((ctx: LessonContext) => Scene);

export interface Skill {
  id: string;
  name: L10n;
  prerequisites?: string[];
  bkt?: Partial<BKTParams>;
}
export interface Misconception {
  id: string;
  /** What the learner believes, in plain words. */
  description: L10n;
  /** Step to play when this misconception shows up. */
  remediation?: string;
}

interface StepBase {
  id: string;
  /** Chapter title shown in the timeline; steps inherit the previous chapter. */
  chapter?: L10n;
  title?: L10n;
  /** Spoken/caption text for the step (templated with {vars}). Each language is recorded separately. */
  narration?: L10n;
  /** Step to go to afterwards (default: the next one in the list). */
  next?: string;
  /** Only reached by branching (remediation, reveal); skipped when advancing in order. */
  branch_only?: boolean;
}
/** Watch a scene. */
export interface SceneStep extends StepBase {
  kind: 'scene';
  scene: SceneSpec;
}
/**
 * A world: a live scene to act in, until its goals are reached. Its setup adds
 * handles and sliders and reports semantic events (`world.emit('det_zero')`);
 * detectors turn events into findings (goals, misconceptions, progress),
 * lines of narration react to them, and a star rule grades the finished world.
 */
export interface ExploreStep extends StepBase {
  kind: 'explore';
  scene: SceneSpec;
  prompt: L10n;
  /** Add drag handles / sliders to the scene; report events through `world`. */
  setup?: (scene: Scene, ui: Interaction, ctx: LessonContext, world: WorldApi) => void;
  /** A single goal (shorthand for `goals: [{ id: 'goal', ... }]`). */
  goal?: { check: (scene: Scene, ctx: LessonContext, world: WorldApi) => boolean; message?: L10n };
  /** All must be reached; each is announced when reached. */
  goals?: Goal[];
  detectors?: Detector[];
  /** Narration triggered on enter, idle, goal, an event or a finding. */
  lines?: Line[];
  stars?: StarRule;
  /** Skill credited when the world is finished (and debited by misconception findings). */
  skill?: string;
  /** In the game flow the learner cannot move on before the goals are reached (default true when there are goals). */
  required?: boolean;
  /** Seconds without interaction before 'idle' lines (default 15). */
  idle_s?: number;
  hints?: L10n[];
  /**
   * Numbers in the prompt the learner can drag: write `{scrub:lambda}` in the
   * prompt and give the tracker here. The number and the scene stay in sync.
   */
  scrub?: Record<string, ScrubSpec>;
  /**
   * A scripted player that wins the world by acting on the scene (trackers,
   * world.emit). The lesson doctor runs it headlessly to prove the goals can
   * be reached - and that they are not reached before anyone acts.
   */
  solve?: (scene: Scene, ctx: LessonContext, world: WorldApi) => void;
  /** Buttons next to Continue (e.g. "Serve", "Pour"): they act on the world. */
  actions?: { id: string; label: L10n; run: (scene: Scene, ctx: LessonContext, world: WorldApi) => void; primary?: boolean }[];
}
/** A draggable number in a prompt, bound to a ValueTracker of the scene. */
export interface ScrubSpec {
  tracker: (scene: Scene) => { get_value(): number; set_value(v: number): unknown };
  min: number;
  max: number;
  step?: number;
  decimals?: number;
  /** Accessible name, e.g. 'lambda'. */
  label?: L10n;
}
/** A case several consecutive questions are about (see CheckpointStep.group). */
export interface CaseGroup {
  id: string;
  title: L10n;
  /** The case itself, as on a read page (shown with every question of the case; expanded on the first). */
  brief?: Block[];
}
/** Ask a question (predict, practise or check). */
export interface CheckpointStep extends StepBase {
  kind: 'checkpoint';
  skill: string;
  /** Question text, templated with {vars}; `$...$` is inline TeX. */
  prompt: L10n;
  /** Figure shown while asking (paused on its last frame). */
  scene?: SceneSpec;
  question: Question;
  /** Hint ladder: nudge -> strategy -> worked step (each costs mastery credit). */
  hints?: L10n[];
  /** Shown after the attempt(s), whatever the outcome. */
  explain?: L10n;
  /** Scene step played after answering - the "observe" in predict-observe-explain. */
  reveal?: string;
  /** Attempts before the answer is shown (default 2; predictions 1). */
  attempts?: number;
  /** Ask how sure the learner is before checking. */
  confidence?: boolean;
  /** Predictions are not graded for mastery (the reveal teaches). */
  purpose?: 'predict' | 'practice' | 'check';
  /** Variant values for this question. */
  params?: (rng: () => number) => Vars;
  on_correct?: string;
  on_wrong?: string;
  /** Part of a case: consecutive checkpoints with the same group id share its title and brief and are numbered. */
  group?: CaseGroup;
}
/** A text page: prose, formulas, code, figures and embedded visuals (content.ts). No scene; Continue is always allowed. */
export interface ReadStep extends StepBase, ReadContent {}
/** A derivation revealed line by line, with "why" notes and an optional fill-in line (content.ts). */
export interface DeriveStep extends StepBase, DeriveContent {
  /** Skill credited (first attempt) by the fill-in line. */
  skill?: string;
}
/** Code next to its notes; the focused note highlights its lines (content.ts). */
export interface CodeStep extends StepBase, CodeContent {}
/** The steps that are pages of text rather than scenes. */
export type TextStep = ReadStep | DeriveStep | CodeStep;
export type Step = SceneStep | ExploreStep | CheckpointStep | ReadStep | DeriveStep | CodeStep;
/** Is this a text page (read, derive, code)? */
export const is_text_step = (s: Step | undefined): s is TextStep => s?.kind === 'read' || s?.kind === 'derive' || s?.kind === 'code';

export interface ChoiceOption {
  id: string;
  /** Text; `$...$` is inline TeX. */
  label: L10n;
  correct?: boolean;
  /** Misconception this option reveals. */
  misconception?: string;
  feedback?: L10n;
}
export type Question =
  | { type: 'choice'; options: ChoiceOption[]; shuffle?: boolean }
  | { type: 'number'; answer: number | ((v: Vars) => number); tolerance?: number; rtol?: number; unit?: L10n; wrong?: WrongAnswer<number>[] }
  | {
      type: 'expression';
      answer: string | ((v: Vars) => string);
      variables?: string[];
      ranges?: Record<string, [number, number]>;
      form?: 'factored' | 'expanded' | 'exact';
      wrong?: WrongAnswer<string>[];
    }
  | { type: 'sketch'; f: (x: number, v: Vars) => number; x_range: [number, number]; y_range: [number, number]; pass?: number; axes?: (scene: Scene) => AxesLike }
  | { type: 'point'; answer: [number, number] | ((v: Vars) => [number, number]); tolerance: number; axes?: (scene: Scene) => AxesLike }
  /** A free-text answer (explain, choose and justify), checked against key points. */
  | { type: 'text'; rubric: TextRubric; /** Placeholder for the answer box. */ placeholder?: L10n };

/** What a good free-text answer must say. */
export interface TextRubric {
  /** The ideas a good answer makes, one per point (the grader marks each as made or not). */
  key_points: L10n[];
  /** A model answer, shown after the attempt(s). */
  model_answer: L10n;
  /** Key points needed to count as correct (default: all of them). */
  min_points?: number;
}

/** Maps data coordinates to scene points (manim-web Axes satisfy this). */
export interface AxesLike {
  coords_to_point(...xy: number[]): number[];
  point_to_coords(p: number[]): number[];
}
/** A known wrong answer and what it tells us. */
export interface WrongAnswer<T> {
  answer: T | ((v: Vars) => T);
  misconception?: string;
  feedback?: L10n;
}

export type Response =
  | { type: 'choice'; option: string }
  | { type: 'number'; value: number | string }
  | { type: 'expression'; text: string }
  | { type: 'sketch'; points: XY[] }
  | { type: 'point'; point: [number, number] }
  /** `hits`: which key points the answer makes (from the AI grader, or ticked by the learner when `self`). */
  | { type: 'text'; text: string; hits?: boolean[]; feedback?: string; self?: boolean };

export interface Grade {
  correct: boolean;
  /** 0..1 (partial credit for sketches). */
  score: number;
  misconception?: string;
  feedback: string[];
  /** Readable correct answer (shown after the last attempt). */
  expected?: string;
  /** Free-text questions: which key points the answer made. */
  points?: boolean[];
}

export interface Lesson {
  id: string;
  title: L10n;
  description?: L10n;
  /** How it is presented by default: chaptered scenes ('essay') or levels with stars ('game'). */
  mode?: 'essay' | 'game';
  /** Who speaks the narration in the game view (e.g. the pizzeria owner). */
  character?: { name: L10n; avatar?: string };
  /** Colours of its scenes (visuals' named palette); the learner's own choice may override it. */
  theme?: 'light' | 'dark';
  skills: Skill[];
  misconceptions?: Misconception[];
  steps: Step[];
  /** Lesson-wide variant values (merged under each checkpoint's own params). */
  params?: (rng: () => number) => Vars;
}

/** Replace {name} or {name:.1f} with variant values. */
export function fill(template: string, vars: Vars): string {
  return template.replace(/\{(\w+)(?::\.(\d+)f)?\}/g, (m, k: string, d?: string) => (k in vars ? (d ? vars[k].toFixed(+d) : String(+vars[k].toFixed(10))) : m));
}
