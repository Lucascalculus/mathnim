// The instructions for what the tutor adds to a lesson (server only: ops.ts): whether a question needs a whole page,
// a sentence or two fitted into the text, and the page itself.
import type { PageAsk } from '../page_gen';

export const page_context = (a: PageAsk) =>
  `LESSON: ${a.lesson}\nPAGE ON SCREEN: ${a.page}\n${a.on_screen ? `\n${a.on_screen.slice(0, 2400)}\n` : ''}\nTHE LEARNER ASKED: ${a.question}\nTHE TUTOR ANSWERED: ${a.answer.slice(0, 1500)}`;

export const PROPOSE_RULES = `You decide whether a learner's question needs a whole extra page in the lesson. Almost always it does not: the tutor's answer, or a sentence or two added to the text, closes the gap. Reply {"page": null} unless ALL of these hold:
- the question shows the learner is missing a whole idea the lesson takes for granted (a prerequisite, such as what a derivative or an integral is), not a detail of this page;
- explaining it properly needs its own page (why it matters, its intuition, an example, the idea itself); a paragraph would not do;
- the tutor's answer did not already explain it.
A question about this page's own reasoning, a step, a number, a word, or "why" is never a reason for a page.
Reply with JSON only: {"page": null} or {"page": {"title": "<the page's title>", "why": "<one short sentence to the learner: what the page would explain>"}}.`;

export const FIT_RULES = `You make one small edit to a lesson's text so that it answers what a learner just asked, in the text's own voice.
You get the page, the passage the question is about, the question and the tutor's answer.
Write what to insert right after that passage: usually one or two sentences, at most three (about 60 words; in Chinese about 120 characters). It must read as part of the text and continue its logic: no "you asked", no "note:", no heading, no question and answer, nothing the page already says. Use the page's own notation and numbers; inline TeX between $...$ (a literal dollar is \\$). Keep only what closes the gap the question shows; the rest stays in the tutor's answer.
If the page already says it clearly, reply {"text": ""}.
Reply with JSON only: {"text": "..."}`;

export const WRITE_RULES = `You write one page of a lesson for a learner who asked a question the lesson did not answer well enough.
The only criterion: the learner genuinely understands. Start from why the idea is needed and its intuition, with a concrete example (use the lesson's own numbers when they fit); then the precise idea, saying what every symbol means when it first appears; then connect it back to the page they were reading. Never open with a pile of technical detail. Write as much as the explanation needs and no more (usually 250-600 words).
Reply with JSON only: {"title": "...", "blocks": [Block, ...]} where Block is one of
  {"type": "h", "text": string}
  {"type": "p", "text": string}
  {"type": "list", "items": [string, ...], "ordered"?: boolean}
  {"type": "math", "tex": string}                      // a displayed formula (TeX, no $ signs)
  {"type": "table", "head": [string, ...], "rows": [[string, ...], ...]}
  {"type": "callout", "kind": "note" | "warning", "title"?: string, "body": string}
Text in strings: inline TeX between $...$ (write a literal dollar as \\$), **bold**, *italic*. In JSON every backslash in TeX is written twice.`;
