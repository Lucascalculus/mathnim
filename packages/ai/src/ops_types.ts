// The fixed operations the tutor asks a model for. The page sends an operation and its inputs; the server
// (apps/mathnim/server/ai.ts) writes the prompt (ops.ts) and calls the model, so the prompts never reach the browser
// and the model behind /api/ai can only be asked these things.
import type { SyllabusEntry } from './generate';
import type { TextGradeRequest } from './grade_text';
import type { PageAsk } from './page_gen';
import type { AskContext, ScenePromptExtra } from './prompt';
import type { Usage } from './provider';

/** One repair round: the model's earlier reply and what was wrong with it (sent back for a fix). */
export interface Round {
  reply: string;
  problems: string[];
}
export interface OpInputs {
  /** The text answer (streams). */
  tutor: { question: string; context?: AskContext };
  /** The picture plan: a ready-made visual from those offered (names), or none. */
  plan: { question: string; context?: AskContext; diagnosis?: string; offered: string[]; rounds?: Round[] };
  /** A scene drawn from scratch (code). */
  scene: { question: string; context?: AskContext; extra?: ScenePromptExtra; rounds?: Round[] };
  /** The two questions at the top of a page's margin (the same for everyone). */
  starters: { lesson: string; page: string; text: string; lang: 'en' | 'zh' };
  grade_text: TextGradeRequest;
  propose_page: PageAsk;
  fit_text: PageAsk & { passage: string };
  write_page: PageAsk & { title: string; rounds?: Round[] };
  /** A generated lesson's plan. */
  lesson_plan: { entry: SyllabusEntry };
}
export type OpName = keyof OpInputs;
export interface RunOptions {
  /** Stream the reply (the text answer): each new piece as it arrives. */
  on_text?: (delta: string) => void;
  signal?: AbortSignal;
  on_usage?: (u: Usage) => void;
}
/** Where the tutor's operations run: the site's server, recorded answers offline, or (development) a model called from the page. */
export interface Backend {
  name: string;
  /** The text answer can be shown as it arrives. */
  stream: boolean;
  /** The reply's text (streamed to `on_text` when given and the backend streams). */
  run<K extends OpName>(op: K, input: OpInputs[K], o?: RunOptions): Promise<string>;
  /** Offline: a recorded answer in words only, for a question asked without a model. */
  text_answer?(question: string): { text: string; followups: string[] } | undefined;
}
