# Reports: how anything on a page tells the lesson what the learner did

Every interactive thing in a lesson (an instrument in a frame, an engine figure, a question in the text, and
whatever is added later) reports through one channel, so that practice anywhere counts, and the tutor in the
margin knows what the learner has on screen. One hub receives the reports (`ReportHub`,
`packages/core/src/reports.ts`, owned by the lesson's runtime); each kind of source has a small adapter on the
page (`packages/present/src/text_pages.ts`, `view.ts`).

## The three reports

| Report | When | Fields |
|---|---|---|
| `answer` | one attempt at one thing: a chip dropped, a model checked, a number typed, a choice made | `item` (names the thing inside the source, the same every time it is tried again), `correct`, `response` (optional, what was given, short) |
| `done` | the source's task is finished (every chip placed, the model accepted) | `score` 0..1 (optional) |
| `state` | what the source shows now, after the learner changed it | `text`: a sentence or two in the learner's language, the facts a tutor needs ("Lipton is in Lower price, less special; 4 of 6 placed, 1 wrong: the specialty tea") |

Report what the learner *did*, not every frame of motion: an answer when something is checked, a state when the
learner lets go. Do not report what the page already knows (a step was viewed, a button was pressed).

## What the hub does with them (the same for every source)

- **answer**: the event log gets `answered` for the first try at an item and `interacted` (with `data.retry`) for
  the tries after it, so the data centre and the lesson's summary count first tries only. The first try also
  updates the learner model, for the step's skill or, on a page without one, the lesson's first skill.
- **done**: the event log gets `interacted` with `data.done` and the score.
- **state**: kept, the latest per source, for the step in view; the tutor reads them first in its picture of the
  screen (`apps/mathnim/src/student.ts`).
- Anyone may listen: `runtime.reports.on((source, report) => ...)`.

## How each kind of source reports

**An instrument in a frame** (any HTML page in a `frame` block, sandboxed). With the frame kit
(`apps/mathnim/public/frames/kit/kit.js`):

```js
Kit.answer('m3', true, 'top right');   // one attempt at item m3
Kit.done(5 / 6);                        // the task is finished
Kit.state(Kit.tx('Lipton: lower price, less special. 4 of 6 placed.', 'Lipton：低价、不特别。已放 4 / 6。'));  // settles after 350 ms
```

Without the kit, post the same messages to the parent: `parent.postMessage({ mn: 'answer', item, correct,
response }, '*')`, `{ mn: 'done', score }`, `{ mn: 'state', text }`. The page accepts a message only from one of
its own frames, checks its shape and length, and names the source `frame:<page>#<n>` with the frame's alt text as
its label.

**An engine figure** (a `visual` block or a step's figure): `fig.tell({ kind: 'answer', item, correct })`,
`fig.tell({ kind: 'done', score })`, `fig.tell({ kind: 'state', text })` (`packages/engine/src/figure.ts`). The
source is `figure:<name>#<n>` on a page, `figure:<step id>` for a step's own figure.

**A question in the text** (`quiz` block): reported by the page itself, as `quiz:<n>`, item `q`.

**Something new** (a widget, an AI-made instrument): give it an adapter that turns whatever it emits into these
three reports and calls `ctx.report(source, report)` on a text page (`PageContext.report`) or
`runtime.reports.report(source, report)` elsewhere. Do not add a fourth kind of report without asking Lucas; if
something does not fit, it is usually a `state`.
