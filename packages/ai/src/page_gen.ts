// What the tutor adds to a lesson for one learner. An answer the learner keeps becomes a small edit to the text:
// a sentence or two in the text's own voice, inserted after the passage asked about (or nothing, when the text
// already says it). Rarely, a question shows a whole idea the lesson takes for granted: a quick call says so, the
// learner is asked, and on yes a page is written in the lesson's own text format (headings, paragraphs, lists,
// formulas, tables, callouts), checked here before the app adds it. The prompts are the server's (prompts/page.ts).
import type { Block } from '@mathnim/core';
import type { Backend, Round } from './ops_types';

export interface PageAsk {
  /** The lesson's title and the page on screen (its title and text). */
  lesson: string;
  page: string;
  on_screen?: string;
  question: string;
  answer: string;
  /** The language to write in, e.g. 'Simplified Chinese'. */
  language: string;
}
export interface PageProposal {
  title: string;
  why: string;
}
export interface WrittenPage {
  title: string;
  blocks: Block[];
}

/** Would a whole page help? null when the answer is enough (the usual case). */
export async function propose_page(backend: Backend, a: PageAsk, signal?: AbortSignal): Promise<PageProposal | null> {
  const raw = await backend.run('propose_page', a, { signal });
  const page = (JSON.parse(raw) as { page?: unknown }).page as Partial<PageProposal> | null | undefined;
  if (!page || typeof page.title !== 'string' || !page.title.trim()) return null;
  return { title: page.title.trim().slice(0, 120), why: typeof page.why === 'string' ? page.why.trim().slice(0, 300) : '' };
}

/** A sentence or two to insert after the passage asked about, in the text's voice; '' when the text already says it. */
export async function fit_into_text(backend: Backend, a: PageAsk & { passage: string }, signal?: AbortSignal): Promise<string> {
  for (let attempt = 0; attempt < 2; attempt++) {
    const raw = await backend.run('fit_text', a, { signal });
    const text = String((JSON.parse(raw) as { text?: unknown }).text ?? '').trim().replace(/^["“]|["”]$/g, '');
    if (!text) return '';
    if (dollars_ok(text) && text.length <= 700) return text;
  }
  throw new Error('the edit could not be written');
}

/** Unescaped $ signs pair up (or the page's formulas run into its text). */
const dollars_ok = (s: string) => (s.replace(/\\\$/g, '').split('$').length - 1) % 2 === 0;

/** The page's blocks, checked: known types, text everywhere, formulas closed. Throws on a page that cannot be shown. */
export function check_page(data: unknown): WrittenPage {
  const d = data as { title?: unknown; blocks?: unknown };
  const str = (v: unknown) => typeof v === 'string' && v.trim().length > 0 && dollars_ok(v);
  if (!str(d?.title)) throw new Error('the page has no title');
  if (!Array.isArray(d.blocks) || !d.blocks.length) throw new Error('the page has no blocks');
  const blocks: Block[] = [];
  for (const b of d.blocks as Record<string, unknown>[]) {
    switch (b?.type) {
      case 'h': case 'p':
        if (str(b.text)) blocks.push({ type: b.type, text: b.text as string });
        break;
      case 'list': {
        const items = Array.isArray(b.items) ? (b.items as unknown[]).filter(str) as string[] : [];
        if (items.length) blocks.push({ type: 'list', items, ordered: b.ordered === true });
        break;
      }
      case 'math':
        if (typeof b.tex === 'string' && b.tex.trim()) blocks.push({ type: 'math', tex: b.tex.trim().replace(/^\$+|\$+$/g, '') });
        break;
      case 'table': {
        const head = Array.isArray(b.head) ? (b.head as unknown[]).map(String) : [];
        const rows = Array.isArray(b.rows) ? (b.rows as unknown[]).filter(Array.isArray).map((r) => (r as unknown[]).map(String).slice(0, head.length)) : [];
        if (head.length && rows.length && rows.every((r) => r.length === head.length)) blocks.push({ type: 'table', head, rows });
        break;
      }
      case 'callout':
        if (str(b.body)) blocks.push({ type: 'callout', kind: b.kind === 'warning' ? 'warning' : 'note', title: str(b.title) ? (b.title as string) : undefined, body: b.body as string });
        break;
    }
  }
  if (!blocks.some((b) => b.type === 'p')) throw new Error('the page has no paragraphs');
  return { title: (d.title as string).trim(), blocks };
}

/** Write the page (one repair if the first reply cannot be used). */
export async function write_page(backend: Backend, a: PageAsk & { title: string }, signal?: AbortSignal): Promise<WrittenPage> {
  const rounds: Round[] = [];
  let last: unknown;
  for (let attempt = 0; attempt < 2; attempt++) {
    const raw = await backend.run('write_page', { ...a, rounds }, { signal });
    try {
      return check_page(JSON.parse(raw));
    } catch (e) {
      last = e;
      rounds.push({ reply: raw, problems: [(e as Error).message] });
    }
  }
  throw last instanceof Error ? last : new Error('the page could not be written');
}
