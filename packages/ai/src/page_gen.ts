// What the tutor adds to a lesson for one learner. An answer the learner keeps becomes a small edit to the text:
// a sentence or two in the text's own voice, inserted after the passage asked about (or nothing, when the text
// already says it). Rarely, a question shows a whole idea the lesson takes for granted: a quick call says so, the
// learner is asked, and on yes a page is written in the lesson's own text format (headings, paragraphs, lists,
// formulas, tables, callouts), checked here before the app adds it.
import type { Block } from '@mathnim/core';
import type { Message, Provider } from './provider';

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

const context = (a: PageAsk) =>
  `LESSON: ${a.lesson}\nPAGE ON SCREEN: ${a.page}\n${a.on_screen ? `\n${a.on_screen.slice(0, 2400)}\n` : ''}\nTHE LEARNER ASKED: ${a.question}\nTHE TUTOR ANSWERED: ${a.answer.slice(0, 1500)}`;

const PROPOSE_RULES = `You decide whether a learner's question needs a whole extra page in the lesson. Almost always it does not: the tutor's answer, or a sentence or two added to the text, closes the gap. Reply {"page": null} unless ALL of these hold:
- the question shows the learner is missing a whole idea the lesson takes for granted (a prerequisite, such as what a derivative or an integral is), not a detail of this page;
- explaining it properly needs its own page (why it matters, its intuition, an example, the idea itself); a paragraph would not do;
- the tutor's answer did not already explain it.
A question about this page's own reasoning, a step, a number, a word, or "why" is never a reason for a page.
Reply with JSON only: {"page": null} or {"page": {"title": "<the page's title>", "why": "<one short sentence to the learner: what the page would explain>"}}.`;

/** Would a whole page help? null when the answer is enough (the usual case). */
export async function propose_page(provider: Provider, a: PageAsk, signal?: AbortSignal): Promise<PageProposal | null> {
  const raw = await provider.complete({ system: PROPOSE_RULES, messages: [{ role: 'user', content: `${context(a)}\n\nWrite the title and why in ${a.language}.` }], json: true, reasoning: 'off', max_tokens: 200 }, signal);
  const page = (JSON.parse(raw) as { page?: unknown }).page as Partial<PageProposal> | null | undefined;
  if (!page || typeof page.title !== 'string' || !page.title.trim()) return null;
  return { title: page.title.trim().slice(0, 120), why: typeof page.why === 'string' ? page.why.trim().slice(0, 300) : '' };
}

const FIT_RULES = `You make one small edit to a lesson's text so that it answers what a learner just asked, in the text's own voice.
You get the page, the passage the question is about, the question and the tutor's answer.
Write what to insert right after that passage: usually one or two sentences, at most three (about 60 words; in Chinese about 120 characters). It must read as part of the text and continue its logic: no "you asked", no "note:", no heading, no question and answer, nothing the page already says. Use the page's own notation and numbers; inline TeX between $...$ (a literal dollar is \\$). Keep only what closes the gap the question shows; the rest stays in the tutor's answer.
If the page already says it clearly, reply {"text": ""}.
Reply with JSON only: {"text": "..."}`;

/** A sentence or two to insert after the passage asked about, in the text's voice; '' when the text already says it. */
export async function fit_into_text(provider: Provider, a: PageAsk & { passage: string }, signal?: AbortSignal): Promise<string> {
  const content = `${context(a)}\n\nTHE PASSAGE ASKED ABOUT: ${a.passage.slice(0, 1200)}\n\nWrite in ${a.language}.`;
  for (let attempt = 0; attempt < 2; attempt++) {
    const raw = await provider.complete({ system: FIT_RULES, messages: [{ role: 'user', content }], json: true, reasoning: 'low', max_tokens: 600 }, signal);
    const text = String((JSON.parse(raw) as { text?: unknown }).text ?? '').trim().replace(/^["“]|["”]$/g, '');
    if (!text) return '';
    if (dollars_ok(text) && text.length <= 700) return text;
  }
  throw new Error('the edit could not be written');
}

const WRITE_RULES = `You write one page of a lesson for a learner who asked a question the lesson did not answer well enough.
The only criterion: the learner genuinely understands. Start from why the idea is needed and its intuition, with a concrete example (use the lesson's own numbers when they fit); then the precise idea, saying what every symbol means when it first appears; then connect it back to the page they were reading. Never open with a pile of technical detail. Write as much as the explanation needs and no more (usually 250-600 words).
Reply with JSON only: {"title": "...", "blocks": [Block, ...]} where Block is one of
  {"type": "h", "text": string}
  {"type": "p", "text": string}
  {"type": "list", "items": [string, ...], "ordered"?: boolean}
  {"type": "math", "tex": string}                      // a displayed formula (TeX, no $ signs)
  {"type": "table", "head": [string, ...], "rows": [[string, ...], ...]}
  {"type": "callout", "kind": "note" | "warning", "title"?: string, "body": string}
Text in strings: inline TeX between $...$ (write a literal dollar as \\$), **bold**, *italic*. In JSON every backslash in TeX is written twice.`;

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
export async function write_page(provider: Provider, a: PageAsk & { title: string }, signal?: AbortSignal): Promise<WrittenPage> {
  const messages: Message[] = [{ role: 'user', content: `${context(a)}\n\nWrite the page "${a.title}" in ${a.language}.` }];
  let last: unknown;
  for (let attempt = 0; attempt < 2; attempt++) {
    const raw = await provider.complete({ system: WRITE_RULES, messages, json: true, reasoning: 'low', max_tokens: 6000 }, signal);
    try {
      return check_page(JSON.parse(raw));
    } catch (e) {
      last = e;
      messages.push({ role: 'assistant', content: raw }, { role: 'user', content: `That page could not be used: ${(e as Error).message}. Reply with the corrected JSON object only.` });
    }
  }
  throw last instanceof Error ? last : new Error('the page could not be written');
}
