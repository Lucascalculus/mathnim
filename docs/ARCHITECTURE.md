# Architecture

```
┌──────────────────────────────── apps/mathnim ────────────────────────────────┐
│ course map · lessons · ask · review · dashboard · settings · student context │
└──────┬──────────────────────┬───────────────────────────┬────────────────────┘
       │                      │                           │
┌──────▼───────────────┐ ┌────▼─────────────────────┐ ┌───▼──────────────────────┐
│ @mathnim/present     │ │ @mathnim/ai              │ │ @mathnim/visuals         │
│ essay view (chapters,│ │ tutor: diagnosis + text  │ │ parametric explanation   │
│ checkpoints, worlds) │ │ first; question -> scene │ │ scenes, param checks,    │
│ game view (next)     │ │ syllabus -> lesson;      │ │ catalog for the AI,      │
│ narrator, sketchpad  │ │ backends (the server's   │ │ named-colour themes      │
│                      │ │ /api/ai, recorded)       │ │                          │
└──────┬───────────────┘ └────┬─────────────────────┘ └───┬──────────────────────┘
       │                      │                           │
┌──────▼──────────────────────▼───────────────────────────│──────────────────────┐
│ @mathnim/core: lesson format · runtime (flow policies, worlds: goals,          │
│ detectors, stars, triggered lines) · grading · learner model · events          │
└──────┬──────────────────────────────────────────────────▼──────────────────────┘
┌──────▼───────────────────────────────────────────────────────────────────────┐
│ manim-web: Manim Community 0.21 in TypeScript (no pedagogy)                   │
│ ext: player (seek) · interact · affordance · widgets · lint · describe ·      │
│      export · py (run Manim Python)                                           │
└───────────────────────────────────────────────────────────────────────────────┘
```

## Layers and rules

1. **manim-web** knows nothing about lessons or AI. Its public API is Manim's
   (names, arguments, defaults). Additions live in `src/ext/` and are
   documented in `packages/manim-web/docs/EXTENSIONS.md`. Correctness is
   defined as "looks like real Manim", checked against Manim's own doc
   examples rendered by real Manim (`docs/TESTING.md` there). Interaction
   primitives (drag, snap, sliders, affordances) live here too: they have no
   notion of goals, stars or scores.
2. **@mathnim/core** turns scenes into teaching, without any UI: a lesson is
   data (steps, questions, skills, misconceptions) plus scene classes. Explore
   steps are *worlds*: the scene reports semantic events, detectors turn them
   into findings (goal, misconception, progress), lines of narration are
   triggered by them, and a star rule grades a finished world. A flow policy
   decides when the learner may move on (essay: any time; game: after a
   world's goals).
3. **@mathnim/present** puts a lesson on screen. `LessonView` is the essay
   presenter and, with mode 'game', the game presenter. Text steps (read,
   derive, code) replace the stage with a reading column (`text_pages.ts`);
   visuals embedded in them come from a resolver the app passes in, so
   present still does not depend on visuals. All interface strings go through
   one dictionary (`i18n.ts`); lesson texts are L10n (`{ en, zh }` or a plain
   string) resolved with the learner's language where they are shown, spoken
   or emitted by the runtime.
4. **@mathnim/visuals** holds parametric, pre-verified explanation scenes. A
   visual declares its parameters; `check_params` fills defaults, clamps and
   reports; `catalog()` is what a model reads to choose one. Visuals use only
   named colours (`palette()`), so the light and dark themes both work.
5. **@mathnim/ai** answers questions and writes lessons *as the same data*: a
   fast personal text answer (diagnosis first) streams in about two seconds;
   the scene comes from a visual or from generated code that ran in a sandbox
   and passed the linter and numeric checks.
6. **apps/mathnim** composes everything into the product prototype and owns
   app state (settings, the learner's progress, the course, what the tutor
   knows about the student).

Dependencies only point down (present, ai and visuals do not depend on each other except ai -> present for its panel UI). The app is the only place with product
decisions (course content, which provider, persistence).

## Key flows

**Lesson step.** `LessonRuntime.go(i)` builds the step's scene (class or
factory with the variant values), `ScenePlayer.load()` records its timeline,
then: scene steps play; explore steps show the end state, attach
`Interaction` handles and run updaters live; checkpoints show the figure and
wait for `submit()`. Grading returns `{correct, score, misconception,
feedback}`; the runtime logs an event, updates the learner model (first
attempts only; predictions don't count), and on continue branches:
misconception remediation -> reveal (the "observe" in predict-observe-explain)
-> the next step.

**Where the model is asked.** The page never writes a prompt. It asks the server for one of the tutor's fixed
operations (`POST /api/ai {op, input}`: tutor, plan, scene, starters, grade_text, propose_page, fit_text,
write_page, lesson_plan; `packages/ai/src/ops.ts`), and the server writes the prompt (`packages/ai/src/prompts/`,
with the engine's API digest and the visual catalog) and calls DeepSeek. So the prompts are not in the site's
JavaScript, and the key behind `/api/ai` can only be asked what the tutor asks. The page holds a `Backend`
(`ServerBackend`; `RecordedBackend` with no model; in development builds also a learner's own model,
`LocalBackend`, which runs the same operations from the page). Repairs go back to the server as `rounds` (the
model's reply and the problems found), and the server rewrites the conversation. After adding or renaming a
visual, `npm run catalog` also regenerates the server's copy of the catalog
(`packages/ai/src/prompts/catalog.generated.ts`); without it the tutor cannot pick the new visual.

**Answering a question.** The student context (`apps/mathnim/src/student.ts`:
level, lesson and step, `describe_text` of the screen, mastery, misconceptions
shown, recent questions, catalog topics) goes into two calls made in parallel:

1. *Text* (`tutor.ts`): one streamed call returns a one-line diagnosis, then
   2-4 sentences for this student; the first words appear in about 1.5 s.
2. *Picture* (`visual_plan.ts`): one call in JSON mode, thinking off, chooses a
   visual from the catalog and fills in its parameters; `check_params`
   validates, one repair if needed, then the scene is built locally from
   `@mathnim/visuals` (on screen in about 3 s) and its `explore()` handles are
   attached when it ends.

If no visual fits, the free-form path runs in the background: model -> JSON
`{explanation, code, checks}` -> worker sandbox (build scene, time limit,
`lint_timeline`) + `run_checks` -> bounded repairs -> the picture replaces the
placeholder when it arrives.

**Generating a lesson.** Syllabus entry -> plan (steps with scene briefs and
questions) -> each scene brief through the answer pipeline -> cached
`{plan, codes}` -> `lesson_from_generated` -> same runtime as authored
lessons.

## State

| State | Where |
|-------|-------|
| Scene timeline, snapshots | `ScenePlayer` (memory) |
| Learner model (mastery, reviews) | `LearnerModel` + `Store` (localStorage `mathnim.learner`) |
| Events | `EventLog` + sinks (localStorage `mathnim.events`) |
| Generated lessons | localStorage `mathnim.generated.<id>` |
| Settings (language etc.; an own model's key in development builds) | localStorage `mathnim.settings` (browser only) |
| Chosen code tab (PyTorch / TRL …) | localStorage `mathnim.codetab` |

Everything is local to the browser in the prototype; the `Store` and event
`Sink` interfaces are where a server would plug in.
