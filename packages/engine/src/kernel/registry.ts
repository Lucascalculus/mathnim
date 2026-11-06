// The registry: one index of everything an author can use (docs/design/ENGINE-ARCH.md). Every piece of the library -
// a thing, a motion, a gesture, a tutor's act, a text tool, an interface effect - is an entry with the same fields:
// what it means to a learner, how it is written, how mature it is, how it is accepted. The markup guide, the tutor's
// tools, the course format, the catalog and the gallery are generated from it, so they cannot drift from the code.
// It imports nothing at run time: the server, node and the browser can all read it.
//
//   define({ kind: 'markup', name: 'noun', says: t('…', '…'), zones: ['text'], maturity: 'stable', since: '0.2.0',
//            syntax: '[word](noun:key)', source: 'packages/present/src/markup/noun.ts' });
//   lookup('markup', 'noun');  entries({ kind: 'thing', maturity: ['stable'] });  for_models('markup', 'tutor');
import type { L10n, Lang } from './text';

/** The kinds of pieces (open: a new kind of piece needs no change here). */
export type EntryKind = 'thing' | 'motion' | 'gesture' | 'act' | 'markup' | 'effect' | (string & {});
/** experiment: in the gallery only; preview: course authors may use it; stable: everyone, the tutor included. */
export type Maturity = 'experiment' | 'preview' | 'stable';
export const MATURITIES: readonly Maturity[] = ['experiment', 'preview', 'stable'];
/** Where a piece lives (open, for zones still to come: a 2.5D world, a table, narration). */
export type ZoneKind = 'figure' | 'world' | 'text' | 'page' | (string & {});
/** Who is told about a piece: the tutor answering a learner, a model or a person writing a course, the gallery. */
export type Audience = 'tutor' | 'author' | 'gallery';

/** An acceptance criterion as code: null when it holds, else what is wrong. */
export interface Check {
  name: string;
  run: () => string | null | Promise<string | null>;
}

export interface Entry {
  kind: EntryKind;
  /** snake_case, unique within its kind. */
  name: string;
  /** What it means to a learner, in one line (the specimen's "means"). */
  says: L10n;
  zones: ZoneKind[];
  maturity: Maturity;
  /** The engine version it arrived in (MATHIUM_VERSION). */
  since: string;
  /** How an author writes it: the call, or the markup. */
  syntax: string;
  /** A complete, working example of the syntax. */
  example?: string;
  /** When to use it and when not (the generated guides say these). */
  rules?: string[];
  /** The acceptance criterion in words (the specimen's 验收); `checks` are the same as code. */
  accept?: L10n;
  checks?: Check[];
  /**
   * A live demonstration for the gallery and the generic tests: an engine Figure, or HTML (a text tool's example as
   * the page shows it). Built on demand, so registering costs nothing.
   */
  demo?: (lang: Lang) => unknown;
  /** The specimen experiment it graduated from ('int/tangle'). */
  from?: string;
  /** The course kit that brought it ('mpc'); none for the engine's own library. */
  pack?: string;
  /** Its file, from the repository root. */
  source: string;
  /** Old names that still resolve (a rename never breaks a lesson or a stored answer). */
  aliases?: string[];
  /** Who is told about it, when not what its maturity gives (stable: all; preview: authors and the gallery; experiment: the gallery). */
  audience?: Audience[];
  /** Shown to the learner only as part of another piece (a basic thing every figure uses): left out of model guides. */
  internal?: boolean;
}

const SNAKE = /^[a-z][a-z0-9_]*$/;
const table = new Map<string, Entry>();
const key = (kind: string, name: string) => `${kind}/${name}`;

/** What is wrong with an entry (empty when it can be registered). */
export function entry_issues(e: Entry): string[] {
  const out: string[] = [];
  const at = `${e.kind}/${e.name}`;
  if (!SNAKE.test(e.name)) out.push(`${at}: the name must be snake_case`);
  if (!e.says?.en?.trim() || !e.says?.zh?.trim()) out.push(`${at}: says needs both languages`);
  if (!e.zones?.length) out.push(`${at}: at least one zone`);
  if (!MATURITIES.includes(e.maturity)) out.push(`${at}: maturity is one of ${MATURITIES.join(', ')}`);
  if (!/^\d+\.\d+\.\d+$/.test(e.since ?? '')) out.push(`${at}: since is a version (0.3.0)`);
  if (!e.syntax?.trim()) out.push(`${at}: syntax says how it is written`);
  if (!e.source?.trim()) out.push(`${at}: source is its file`);
  if (e.accept && (!e.accept.en?.trim() || !e.accept.zh?.trim())) out.push(`${at}: accept needs both languages`);
  for (const a of e.aliases ?? []) if (!SNAKE.test(a)) out.push(`${at}: alias '${a}' must be snake_case`);
  return out;
}

/**
 * Register a piece. Throws on a malformed entry or a name taken by another file (two pieces may not share a name); the
 * same file registering again (a page reloaded in development) replaces its entry.
 */
export function define<E extends Entry>(e: E): E {
  const bad = entry_issues(e);
  if (bad.length) throw new Error(`registry: ${bad.join('; ')}`);
  for (const n of [e.name, ...(e.aliases ?? [])]) {
    const k = key(e.kind, n);
    const had = table.get(k);
    if (had && had.source !== e.source) throw new Error(`registry: ${k} is already taken by ${had.source}`);
  }
  for (const n of [e.name, ...(e.aliases ?? [])]) table.set(key(e.kind, n), e);
  return e;
}

/** A piece by its name or one of its old names. */
export function lookup(kind: EntryKind, name: string): Entry | undefined {
  return table.get(key(kind, name));
}

/** Every piece (once each, in the order registered), narrowed by kind, maturity, zone, kit or audience. */
export function entries(o: { kind?: EntryKind; maturity?: Maturity[]; zone?: ZoneKind; pack?: string | null; audience?: Audience } = {}): Entry[] {
  const seen = new Set<Entry>();
  for (const e of table.values()) seen.add(e);
  return [...seen].filter((e) =>
    (!o.kind || e.kind === o.kind) &&
    (!o.maturity || o.maturity.includes(e.maturity)) &&
    (!o.zone || e.zones.includes(o.zone)) &&
    (o.pack === undefined || (o.pack === null ? !e.pack : e.pack === o.pack)) &&
    (!o.audience || audience_of(e).includes(o.audience)));
}

/** Who is told about a piece. */
export function audience_of(e: Entry): Audience[] {
  if (e.audience) return e.audience;
  return e.maturity === 'stable' ? ['tutor', 'author', 'gallery'] : e.maturity === 'preview' ? ['author', 'gallery'] : ['gallery'];
}

/** The pieces of a kind a model is told about: stable ones for the tutor, also preview ones for course authors; never experiments. */
export function for_models(kind: EntryKind, who: 'tutor' | 'author'): Entry[] {
  return entries({ kind, audience: who }).filter((e) => !e.internal);
}

/** Run every check of the pieces given (default: all): the failures, as `kind/name · check: what is wrong`. */
export async function run_checks(list: Entry[] = entries()): Promise<string[]> {
  const out: string[] = [];
  for (const e of list)
    for (const c of e.checks ?? []) {
      let r: string | null;
      try {
        r = await c.run();
      } catch (err) {
        r = `threw: ${(err as Error).message}`;
      }
      if (r) out.push(`${e.kind}/${e.name} · ${c.name}: ${r}`);
    }
  return out;
}

/** A thing (a mark, a block, a world material) as an entry: its class lives in `source`; `demo` builds a figure with it. */
export function define_thing(e: Omit<Entry, 'kind'>): Entry {
  return define({ ...e, kind: 'thing' });
}
/** A motion (a script step: a pure function of time over the params it names) as an entry. */
export function define_motion(e: Omit<Entry, 'kind'>): Entry {
  return define({ ...e, kind: 'motion' });
}
/** An interface effect of the shell (condensing glass, folding paper): registered for the gallery and the catalog. */
export function define_effect(e: Omit<Entry, 'kind'>): Entry {
  return define({ ...e, kind: 'effect' });
}
