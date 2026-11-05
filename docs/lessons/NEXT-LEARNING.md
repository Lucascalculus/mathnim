# Next-generation learning: the method behind MGMT90141 and MKTG90037

Written 2026-11-06 for the two courses started that day. Lucas, in order: "不要拘泥于ppt。这个ppt做得烂。要求有两个：要把知识讲懂。约束是ppt上的内容需要有。"
"90049那个做的很烂。" "要探索更优化的方法。要next gen的学习."

The decks are a **coverage floor**: every concept, example and number on them appears somewhere in the course
(tracked in each course's `coverage/` notes). Their order, wording and figures are not the structure. The
COMP90049 course is not the template: it was a reworded deck (about 12 text pages per lesson, a few static
SVGs, no interaction, "the deck says...") and Lucas judged it poor. ECON90015 (question as printed, taught from
the ground up, five figures you drag) is closer to what he accepted.

## What is wrong with a deck, and with a text page

A learner who must *write or calculate under exam conditions* does not fail for lack of definitions. They fail
because (1) an idea was never felt, only read, so it does not survive a rephrased question; (2) they have never
been told whether *their own* attempt is right (a formulation, a paragraph); (3) neighbouring ideas blur
(customer-led vs market-oriented; reduced cost vs shadow price); (4) nothing makes them retrieve the idea a
week later. A deck, and a page of prose, fix none of these.

## The loop every lesson runs (five moves)

1. **Touch (摆弄).** An instrument first, before any definition: the learner changes something and sees a
   consequence. No instruction text; the form says what to do (TASTE §3).
2. **Predict (先猜).** Before each reveal the learner commits to a guess with one gesture. A confident wrong
   guess is the most valuable moment in the lesson, so the instrument is built to produce it.
3. **Name (命名).** Only now the term and the statement, as short as the examiner needs them: "what the marker
   wants in three lines". Definitions arrive after the experience they name.
4. **Use (用).** An exam-shaped task where something *checks the learner's own work*: their LP is solved and
   compared with the reference; their numbers are read; their paragraph is marked against the rubric.
5. **Recall (回忆).** The end of each lesson asks two things from earlier lessons, mixed with a look-alike
   (interleaving), so the neighbours stay apart and last week is retrieved, not re-read.

**The classic wrong picture is built into the instrument** (hypercorrection): the learner is led to the usual
mistake on purpose, sees it fail, and then the right picture has somewhere to land.

## Instruments (the figures that replace slides)

An *instrument* is a small interactive figure with one question it answers. It is the unit of design, not the
page. Four generic kinds cover most business frameworks (so they are built once, in a shared `kit`), and bespoke
ones carry the mathematics:

| Kind | What the learner does | Examples |
|---|---|---|
| **Place** | drags chips onto a diagram; a slot answers at once | 2×2 and triangle placement (Porter, value disciplines, perceptual map), the means-end ladder, the nine blocks of the canvas, sources of value |
| **Dial** | moves a slider; a quantity and a picture respond | the value equation, elasticity and revenue, make or buy as transaction costs, economies of scale and break-even, EVA, expectancy (E×I×V) |
| **Connect** | draws a line between two things; the pair is checked | pains to relievers, drivers to metrics, concepts to their neighbours |
| **Choose** | takes a small experiment, then sees how the design steered the choice | conjoint trade-offs, the decoy and compromise effects |
| **Math** | bespoke, exact | the LP plane, the formulation checker, the report reader, the tree and Bayes flip, the normal curve, the regression lab |

## Platform asks (new requirements on the framework)

- **R1 `frame` block.** A text-page block that mounts a sandboxed, self-contained interactive figure (an HTML
  file next to the course) with the learner's language and a height that follows its content. Reason: the
  existing `visual` block is a manim-web scene (an explanation that plays, then handles), the wrong shape for
  instruments with chips, text fields and tables. A `frame` can use the site's own type and the Next-UI
  materials. Authors need no build step.
- **R2 the figure speaks back.** A frame can report an event (`done`, an answer, a state) to the page, so the
  lesson can count it as practice and the margin tutor can be asked about "this state". (Second step.)
- **R3 a small LP engine** (dense two-phase simplex, in plain JS, shared by instruments): solves the learner's
  model, finds *witness* plans where it disagrees with the reference, and returns sensitivity ranges. No
  library, in the spirit of "light bundle".
- **R4 rubric answers.** Free-text answers are already marked against key points by the model
  (`packages/ai/src/grade_text.ts`). For MKTG the three parts of an exam answer are marked separately
  (Explain, Apply, Recommend) with the exam's own rubric levels; this uses what exists, one question per part.

## Honesty

Every factual claim about a brand or a paper is sourced in the course's research notes; what is the course's
own reasoning (for example how a framework reads a brand) is marked as such. Simulations and made-up numbers
are labelled. No invented measurements.
