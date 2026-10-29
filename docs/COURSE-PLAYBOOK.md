# Course playbook

How a Mathnim course gets made, from "teach X" to a published course. It is a
map, not a script: the phases are what every good course so far went through
(the LLM fine-tuning course, 20 lessons; the MPC course, 8), but how long each
takes, what order the lessons are built in and how the work is split are your
calls. What is fixed is listed under "Always". Read `docs/TASTE.md` first; look
things up in `docs/CAPABILITIES.md`.

## Always

- **讲明白 is the acceptance criterion** (TASTE §1). Everything else serves it.
- **Bilingual**, Chinese written natively; one light theme; narration only on
  scene steps (TASTE §9–10).
- **Sources**: every factual claim traces to a research note with a verified
  link; simulations are labelled; nothing is invented.
- **Interaction earns its place** (`docs/lessons/llm-finetuning/INTERACTION-BAR.md`).
- **Light bundle**: no heavy libraries in the browser (TASTE §11).
- **Checks pass** before anything is shown: typecheck, `npm run doctor`, the
  visuals checker on new visuals, tests.
- **Lucas sees it before it is published** (a preview with screenshots), unless
  he said to deploy.

## Phase 1 · Frame (with Lucas)

Agree, in a few lines, on: the topic and its edge; who it is for (what they
already know); what they will be able to do afterwards (about three outcomes);
the size (lessons, minutes each); and anything special (labs or not, batches).
Ask only what changes the plan; propose defaults for the rest. Write it down as
the course's README (`docs/lessons/<course>/README.md`).

## Phase 2 · Research

For each part, a `research-*.md` with the claims the lessons will make and
where each comes from (papers, docs, standard textbooks; links opened and
checked). Collect the misconceptions learners really have: they become
checkpoint distractors and world detectors. Collect the numbers that make an
idea concrete. This is also where you find the running example.

## Phase 3 · Shape

- **The course map.** Units are the stops on the course page's level route,
  named as on the page. 3–7 units read well on a phone.
- **A running example** that carries through the course (MPC: one toy cart
  that must stop at a wall; fine-tuning: one support assistant). It lets each
  lesson build on the last instead of restarting.
- **The signature animation**: the one picture that says what the course is
  about. It becomes the course cover (`cover_motion`).
- **Per lesson**: its question, what changes in the learner's head, and the
  forms (text page, derivation, code, scene, world, checkpoints). Prefer the
  simplest form that teaches (TASTE §4).
- **Prerequisites** in one sentence and 2–4 starter links; **outcomes** in
  three lines.

Write the outline into the README and show it to Lucas before building.

## Phase 4 · A kit first

Before the lessons, build what they share: the running example's math (with
unit tests against a trusted reference), drawing helpers, the language helpers
for canvas labels, and the first visuals. The MPC kit
(`packages/visuals/src/mpc/`, `docs/lessons/mpc/KIT.md`) is the model: pure
math in one file, drawing in another, a story module for the running example.
Shared notation goes in the README so every lesson agrees.

## Phase 5 · Build the lessons

One lesson per file (`apps/mathnim/src/lessons/<course>/…`), registered in the
course's `unit.ts`. Within a lesson, a good default arc is:

1. a question or a small surprise (often a prediction checkpoint);
2. the purpose and the intuition (a scene or a text page);
3. the math, with what each term does (text page or derivation);
4. the learner acts on it (a world), only if acting is the concept;
5. the details and the code, now that there is a place to hang them;
6. 3–4 checks that test transfer, not recall, with feedback that names the
   misconception.

Break the arc when the idea asks for it. Look at the reference lessons below
before writing your first one.

**Time each scene to its voice.** A narrated scene shows each thing as the
voice talks about it, never a finished figure under a voice that is still
explaining it. Write the narration first, in parts, one per thing the picture
does; then:

- put `§` in the narration where the picture's next part should start, in both
  languages (`'…at time zero. § Executed blindly, …'`, `'…的计划。§闭着眼睛…'`);
- call `this.next_section()` in the scene at the same places, in the same order.

The picture then waits at each section until the voice reaches its `§`, and
holds its last frame until the voice ends. The waits are worked out from the
recording when it plays, so any voice, speed or language lines up, and a new
voice needs no change. `§` is not said or shown and does not change the
recording. Animations should take no longer than the words they go with
(the picture waits for the voice, never the other way round). `npm run doctor`
checks one `§` per section in each language, and warns when a scene without
beats has a voice that runs on past its picture. Do this for new scenes; the
scenes made before it (October 2026) keep their own timing.

**Parallel work.** With several agents, give each one lesson and a brief
(template below); keep shared files (`course.ts`, packages, index files) with
one owner, and have agents send registrations rather than edit shared files.
The kit's owner registers visuals. Medium effort per agent has been enough;
the bar is the brief and the review, not the effort setting.

## Phase 6 · Check and polish

- Automatic: `npm run typecheck`, `npm test`, `npm run doctor`,
  `npm run check -w @mathnim/visuals -- --only <names>` (look at every contact
  sheet, both languages), `npm run catalog -- --check`.
- Read it as a student: `node apps/mathnim/tools/lesson_text.mjs <id> zh` (and
  `en`). Does each page give purpose and intuition before details? Any wall of
  text? Does the Chinese read naturally?
- Use it: run the site (`npm run dev`) and walk the lesson in a browser, or
  headlessly with `node apps/mathnim/tools/page_shots.mjs` (click, answer,
  screenshot, phone width too).
- Review: the `/course-review` skill (`.claude/skills/course-review`) checks a
  lesson or course against this playbook and TASTE and lists what to fix by
  severity. Fix, then review again.

## Phase 7 · Publish

1. Register the course in `apps/mathnim/src/course.ts` (`COURSES`): id, slug,
   title, `short`, one-line `summary` (topics), `category`, `accent`,
   `audience`, `prerequisites`, `outcomes`, `cover_motion`, `units`. A course
   whose lessons load on demand also needs `npm run manifest -w mathnim`.
   `published` releases it in batches; `hidden` keeps it off the home page
   while it is built.
2. `npm run thumbs -w mathnim` (lesson thumbnails, course feature images).
3. `npm run narration` once the narrated texts are final (it records only what
   changed; voices in TASTE §10).
4. Update `docs/CHECKPOINT.md` and the course README with what shipped.
5. Show Lucas the preview; deploy (`npm run deploy`) when he says so.

## A brief for one lesson (template)

```
You write lesson <N> of the course "<title>" in the Mathnim repo.
Read first: docs/TASTE.md, docs/COURSE-PLAYBOOK.md, docs/CAPABILITIES.md,
docs/lessons/<course>/README.md (plan, notation, running example), the kit
(<paths>), and the reference lessons. Check the lessons already on disk so
notation and cross-references agree.

The lesson: <its question>; what the learner should be able to explain after it;
the forms you expect (and where you are unsure); its sources (research-<n>.md).

Yours to edit: <lesson file>, <your visual files>. Not yours: course.ts, the
packages' shared files, other lessons; send registrations in your report.
Before reporting: typecheck, doctor for your lesson, the visuals checker on your
visuals (look at the contact sheets), lesson_text in zh and en.
Report: the file, a 3-line summary, each world and why it is needed (and what a
simpler form would lose), checks run, open questions.
```

## Reference lessons

Read these to calibrate; each is good at something different.

- `apps/mathnim/src/lessons/mpc/m1_lookahead.ts`: a course opener: a problem
  first, a scene of the core loop, a prediction, a world where the horizon is
  the concept, transfer checks.
- `apps/mathnim/src/lessons/mpc/m4_constraints.ts`: math made concrete: from a
  picture to the formulation, each term explained.
- `apps/mathnim/src/lessons/ft/c/c2_lora.ts`: text pages and a derivation that
  stay intuitive: why before how, a formula with what each part does.
- `apps/mathnim/src/lessons/ft/a/a1.ts`: a low-friction start (a one-click
  guess that flows into the first page) and a case of practice questions.
- `apps/mathnim/src/lessons/pizza-game/lesson.ts`: game mode for school
  students: worlds with drag and drop, cutting, stamping, stars.

## When you are unsure

Show Lucas two concrete options (screenshots or a short text each) with your
recommendation. He prefers comparing real variants to reading descriptions,
and he will often pick a third way: keep it easy to change.
