// What the tutor is told about the student and the page with a question (all optional). The prompts themselves are
// written on the server (prompts/, ops.ts) and never reach the browser.

/** What is known about the student when they ask. */
export interface AskContext {
  lesson?: string;
  /** The step on screen, e.g. 'Slice and rearrange (explore)'. */
  step?: string;
  /** describe_text() of the scene on screen. */
  on_screen?: string;
  /** e.g. "inscribed angles 40%, geometric mean 90%". */
  learner?: string;
  /** Misconceptions this student has shown (descriptions). */
  misconceptions?: string[];
  /** Earlier questions in this session, oldest first, with the start of each answer. */
  recent?: { q: string; a: string }[];
  level?: string;
  /** Write the answer in this language (overrides the question's own language). */
  language?: string;
  /** The language the learner chose for the app, e.g. 'Chinese': a hint; the question's own language still decides. */
  learner_language?: string;
  /** Subject tags of the lesson, e.g. ['linear algebra', 'pca'] (rank the visual catalog when it is large). */
  topics?: string[];
  /** A passage the student selected on the page and asks about. */
  selected?: string;
  /** The step is a question the student has not answered yet: help them understand it without giving the answer away. */
  unanswered?: boolean;
}
export interface ScenePromptExtra {
  /** The tutor's one-line reading of the question (from the fast text answer). */
  diagnosis?: string;
  /** A short text answer is already on screen: the scene's own explanation should only guide the picture. */
  text_shown?: boolean;
}
