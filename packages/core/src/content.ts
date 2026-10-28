// The content contract for text-first steps and bilingual courses (the LLM
// fine-tuning course is the first user). Lesson authors write against these
// types; the platform work (docs/lessons/llm-finetuning/README.md section 9)
// adds them to the Step union (ReadStep, DeriveStep, CodeStep in schema.ts),
// renders them in @mathnim/present and resolves L10n strings by the learner's
// language.
//
// Additions made by the platform (all optional, nothing existing changed):
// - tr() falls back to English when the learner's language is missing *or empty*.
// - Prose also supports `inline code` (backticks) and footnote references
//   [^key], which point at the page's `cite` block with that key; the sources
//   are listed, numbered, at the end of the page.
// - code blocks: `label` names the block's own tab when it has `tabs` (default:
//   the language, e.g. "Python"); choosing a tab switches every block on the
//   page that has a tab with the same label, and the choice is remembered.
// - figure blocks: `src` is relative to the app's public folder
//   ('ft/b/chat-template.svg' or '/ft/b/chat-template.svg'); it may be L10n
//   ({ en: 'ft/d/x.en.svg', zh: 'ft/d/x.zh.svg' }) for a figure with words in it.
// - visual blocks: `params` are checked with @mathnim/visuals' check_params;
//   the visual plays when scrolled into view; with `explore` its handles are
//   attached when it ends.
// - DeriveContent.blank.line is the 0-based index into `lines`; `answer` is in
//   the expression grader's syntax (e.g. 'beta*log(p/q)', see grading/expr.ts),
//   `variables` lists multi-letter names, `ranges` (optional) where to sample
//   them. The line's own `tex` is shown once the learner has answered (or asked
//   to see it).
// - CodeContent.notes[].lines are 1-based and inclusive ([3, 3] is line 3).
// - DeriveStep may name a `skill` (schema.ts): the blank then counts as a graded
//   first attempt for the learner model.
// - In expression answers (blanks, expression questions) `log` and `ln` are the
//   natural log; `log10` (or `lg`) is base 10.

/** Text in both course languages. A plain string is the same in both (formulas, code, names). */
export type L10n = string | { en: string; zh: string };
export type Lang = 'en' | 'zh';
/** The languages a course can be written in, in display order. */
export const LANGS: readonly Lang[] = ['en', 'zh'];
/** The text of `s` in `lang` (plain strings pass through; a missing or empty translation falls back to English). */
export function tr(s: L10n | undefined, lang: Lang): string {
  if (s === undefined || s === null) return '';
  return typeof s === 'string' ? s : s[lang] || s.en || '';
}
/** Is this a two-language value (rather than a shared plain string)? */
export function is_bilingual(s: unknown): s is { en: string; zh: string } {
  return !!s && typeof s === 'object' && !Array.isArray(s) && ('en' in s || 'zh' in s) && Object.keys(s).every((k) => k === 'en' || k === 'zh');
}

/** One block of a text page. Prose fields support inline $TeX$, **bold**, *italic*, `code`, [text](url) and [^cite-key]. */
export type Block =
  | { type: 'h'; text: L10n; level?: 2 | 3 }
  | { type: 'p'; text: L10n }
  | { type: 'list'; items: L10n[]; ordered?: boolean }
  /** A displayed formula (TeX, shared by both languages). */
  | { type: 'math'; tex: string; label?: string }
  /** Code with a copy button; `tabs` offers alternative spellings (e.g. PyTorch / TRL); `label` names this block's own tab. */
  | { type: 'code'; lang: string; code: string; caption?: L10n; label?: string; tabs?: { label: string; lang: string; code: string }[] }
  /** A static image from the app's public folder (SVG preferred), redrawn rather than copied; `credit` names the source. */
  | { type: 'figure'; src: L10n; alt: L10n; caption?: L10n; credit?: string }
  /** A drawing given as SVG markup (generated courses draw their own diagrams; one per language when it has words); shown as an image, so it runs no code. */
  | { type: 'svg'; svg: L10n; alt: L10n; caption?: L10n }
  /** A visual from @mathnim/visuals embedded in the page (plays; explorable when `explore`). */
  | { type: 'visual'; name: string; params?: Record<string, unknown>; caption?: L10n; explore?: boolean }
  | { type: 'callout'; kind: 'note' | 'warning' | 'misconception' | 'open'; title?: L10n; body: L10n }
  /** Collapsed "details on demand". */
  | { type: 'details'; summary: L10n; blocks: Block[] }
  | { type: 'table'; head: L10n[]; rows: L10n[][] }
  /** A source reference shown as a footnote. */
  | { type: 'cite'; key: string; text: L10n; url: string };

/** A text page: prose, formulas, code, figures, embedded visuals. */
export interface ReadContent {
  kind: 'read';
  blocks: Block[];
}
/** A derivation revealed line by line; each line may explain why it holds; one line can be a fill-in check. */
export interface DeriveContent {
  kind: 'derive';
  intro?: L10n;
  lines: { tex: string; why?: L10n }[];
  /** Hide line `line` (0-based index into `lines`) and ask for it (graded with the expression grader). */
  blank?: { line: number; answer: string; variables?: string[]; prompt?: L10n; /** Sampling ranges for the equivalence test, e.g. { p: [0.05, 0.95] } (default [0.5, 4] for `variables`). */ ranges?: Record<string, [number, number]> };
  outro?: L10n;
}
/** Code next to its explanation; scrolling a note highlights its lines. */
export interface CodeContent {
  kind: 'code';
  lang: string;
  code: string;
  intro?: L10n;
  /** `lines` are 1-based and inclusive. */
  notes: { lines: [number, number]; text: L10n; /** tensor shapes, e.g. "logits: [B, T, V]" */ shapes?: string }[];
}
