# Building the fine-tuning course: brief for each part's agent

You planned a part of the course (part-*.md). Now build it, in parallel with the
other parts. The user's rules: make people genuinely understand; no interaction
for its own sake (README section 4); Chinese and English; labs are tutorials
only; images are welcome where they explain better.

## What you build

1. **Visuals** for your part (the "new visuals" list in your plan):
   - Put them in `packages/visuals/src/ft/<part>/`, one file each, following
     `packages/visuals/README.md`: params with ranges and docs, examples,
     `explore()`, ids, light palette only.
   - Write a `packages/visuals/src/ft/<part>/index.ts` that registers them. Do
     NOT edit `packages/visuals/src/index.ts`; the main session wires your index in.
   - Run `npm run check -w @mathnim/visuals -- --only <names>`, look at every
     contact sheet, and fix layout until each one is clear.
2. **Lessons** in `apps/mathnim/src/lessons/ft/<part>/`:
   - One file per lesson, exporting a `Lesson`.
   - Use the step kinds `read`, `derive`, `code` (contract:
     `packages/core/src/content.ts`, built by the platform agent), plus scene,
     explore (worlds) and checkpoint.
   - Every learner-facing string is `L10n` `{ en, zh }`. Write the Chinese
     natively, not as a translation.
   - Worlds need `solve()`, goals that are not reached before acting, and
     lines with fixed text.
   - Also write `apps/mathnim/src/lessons/ft/<part>/unit.ts`, exporting
     `{ id, title: L10n, lessons: CourseLesson[] }`. Do NOT edit `course.ts`;
     the main session registers your unit.
   - If the platform's new step kinds are not in the schema yet when you start,
     build your visuals first, then the lessons; check `packages/core/src/schema.ts`
     again before writing lesson files.
3. **Figures**:
   - SVG in `apps/mathnim/public/ft/<part>/`.
   - Redraw rather than copy, and credit the source in the figure block.
4. **Labs** (part E agent only): `docs/lessons/llm-finetuning/labs/<lab>.md`
   tutorials, bilingual (zh first, then en), each with runnable code.

## Rules

- **Ownership:** only the paths above for your part. Never edit shared files
  (`course.ts`, `visuals/src/index.ts`, `packages/core`, `packages/present`,
  `manim-web`). If you need a shared change, describe it in your report.
- **Accuracy:** every factual claim is backed by the research files or your
  plan's citations. Mark simulations as simulations.
- **No browser:** do not use the Browser pane or start/stop dev servers (the
  main session reviews in the browser). Verify headlessly.
- **Before you report:**
  - `npm run typecheck -w @mathnim/visuals -w mathnim` is clean;
  - the visuals check passes for your visuals;
  - `npm run doctor` passes for your lessons, once the main session has
    registered your unit (if it has not, say so).
- **Narration only where it is needed:** scene steps (the "videos") get
  `narration`. Text pages (read / derive / code) and checkpoints get none: the
  learner reads them. Add triggered lines to worlds only where the learner's eyes
  are on the canvas and a short voiced line helps.
- **Do not run `npm run narration`:** the main session records narration once
  all texts are final.

## The only acceptance criterion: 讲明白

The user judges the course by one thing: does it make the learner genuinely
understand? Think about that, section by section. Do not tick boxes.

Things that often decide it (examples, not a checklist; add only what this
section needs in order to be understood):
- the learner knows what problem this technique solves, and why they would want
  it, before the mechanics;
- a high-level intuition comes before the math, and the math intuition (what
  each term does, why the formula has this shape) before the formal details;
- where the learner would naturally ask "why this and not X?", the page answers
  it;
- details, hyperparameters and code arrive once the learner has a place to hang
  them, not as the opening.

Signs a section fails: it opens with definitions, configs or a formula; it
introduces a technique without saying what it is for; a formula has no "what
does this term do"; it piles on details the learner has no reason to want yet.

Test: after the section, could the student explain the idea to a colleague in
their own words, and say when they would use it? If not, fix what is missing.
If something does not serve that, cut it or move it into a `details` block.

## Product-manager pass (required before reporting)

Re-read your lessons as the product manager of Mathnim and as a student who
knows neural networks but not this topic. Check:
- Would they understand (the criterion above)? Does each section give the
  purpose and intuition before the details?
- Is any page a wall of text?
- Does each interaction pass the three rules?
- Is the "怎么选" card actionable?
- Are the checks testing transfer rather than recall?
- Does the Chinese read naturally?

Fix what you find.

## Work report (send when done)

- Files created.
- Per lesson: a 3-line summary, its interactions and why each is needed, and
  its figures.
- Verification commands and results.
- What the product-manager pass changed.
- Shared changes you need from the main session.
- Open questions for the user.
- Known gaps.
