// Text tools as registry entries (docs/design/ENGINE-ARCH.md, "markup"). Every piece a text may hold - a noun, a
// definition in its sentence, a number to drag, a chain of why, a derivation, an exploded formula, folded details, a
// source - is an entry in the engine's one registry, carrying how it is written, what the learner sees, the words the
// tutor and the course generator are told, and a check that says what is wrong with a malformed use. The markup guide
// (docs/TEXT-MARKUP.md), the tutor's text tools and the course format's paragraph are generated from these entries
// (npm run catalog), so they cannot drift from what the page does.
//
// DOM-free and light: the server checks a generated lesson's text with it (apps/mathnim/server/studio/format.ts), so
// it reaches the engine's registry by path, not through the engine's index (which brings the canvas code).
import { define, entries, lookup, type Entry } from '../../../engine/src/kernel/registry';

/** What a fence's or an inline tool's renderer gets from the text it is in (no import of the page's own renderers). */
export interface MarkupCtx {
  /** The fence ended (a streamed answer may still be writing it). */
  closed: boolean;
  /** Prose with inline TeX and inline tools, as HTML (no fences). */
  prose: (s: string) => string;
  /** A whole text, fences included, as HTML. */
  text: (s: string) => string;
  /** TeX as HTML (display or inline). */
  tex: (tex: string, display: boolean) => string;
  esc: (s: string) => string;
}

export interface MarkupEntry extends Entry {
  kind: 'markup';
  /** inline: a pattern inside a sentence; fence: a ```name block in any prose. */
  form: 'inline' | 'fence';
  /** A fence's name (after the ```). */
  fence?: string;
  /** What the learner sees, for the guide (English: the guide is for authors). */
  shows: string;
  /** A word on the syntax, for the guide's table (value, range, step). */
  note?: string;
  /** The words the tutor is told (undefined: a line from says and syntax; null: another entry's words cover it). */
  tutor?: string | null;
  /** The words of the course format's paragraph on text (undefined: none; it is a block there, or not for courses). */
  lesson?: string | null;
  /** The guide's "also" line (TeX, bold, links): listed, not tabled. */
  also?: boolean;
  /** Where it sits in the guides (smaller first), and in the tutor's list when that differs. */
  order: number;
  tutor_order?: number;
  /** What is wrong with one use (a fence's body and head; an inline tool's match), null when nothing is. */
  check?: (body: string, head?: string) => string | null;
  /**
   * How a tool added by a file renders (the built-in ones are rendered by math.ts): a fence's body, or an inline
   * tool's match on escaped prose. Returning null falls back to the text as prose: a mistake never breaks the page.
   */
  html?: (body: string, head: string, ctx: MarkupCtx) => string | null;
  /** An inline tool added by a file: the pattern it answers to (global), matched on escaped prose. */
  pattern?: RegExp;
}

export function define_markup(e: Omit<MarkupEntry, 'kind'>): MarkupEntry {
  return define({ ...e, kind: 'markup' } as MarkupEntry);
}
/** Every text tool, in the guides' order. */
export function markup_entries(o: { audience?: 'tutor' | 'author' | 'gallery' } = {}): MarkupEntry[] {
  return (entries({ kind: 'markup', audience: o.audience }) as MarkupEntry[]).sort((a, b) => a.order - b.order);
}
/** A fence by its name. */
export function fence_entry(name: string): MarkupEntry | undefined {
  const e = lookup('markup', name) as MarkupEntry | undefined;
  return e?.form === 'fence' ? e : (markup_entries().find((x) => x.form === 'fence' && x.fence === name));
}
/** The names of every fence, built-in and added. */
export function fence_names(): string[] {
  return markup_entries().filter((e) => e.form === 'fence' && e.fence).map((e) => e.fence!);
}
