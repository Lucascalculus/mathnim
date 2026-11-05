# MKTG90037 checkpoint (2026-11-06)

State: all 20 lessons are built (`build.py` writes them, `demo_check.mjs mktg90037` passes), the course entry is in
`apps/mathnim/public/demo/courses.json`, `coverage/` lists what each lesson covers, `brands.md` holds the sourced brand facts.

## How to resume or extend
- Build and check: `python3 docs/lessons/mktg90037/build.py && node apps/mathnim/tools/demo_check.mjs mktg90037`.
- Lessons are `l00_start.py` to `l19_exam.py`; helpers (loop steps, the exam's three marked parts, the instrument kinds) are in `mk.py`.
- A step that holds only an instrument fails the format check: give it a text block first.
- Dollar signs in lesson text must be written `\\$` (they open TeX otherwise); the lessons mostly say "AUD" or "dollars".

## Instruments (generic kinds, `apps/mathnim/public/frames/kit/kinds/`)
place (drag or tap chips into zones), tag (label each line), dial (sliders, outputs, a curve, conditional notes), connect
(pair two columns), choose (a small experiment on the learner: a switch test or a tally). One page each, parameters in the
frame block, bilingual strings inside the parameters.

## Marking
Every lesson ends with the Explain (5), Apply (10), Recommend (5) parts of one question, each a text checkpoint with key
points from the Week 11 rubric and a model answer. With the model key present the lesson view marks the answer against the
key points (`packages/ai/src/grade_text.ts`). Without a key the view shows "No AI grader is available" and lets the learner
tick the key points against the model answer (checked in the dev server, which has no key).

## Decisions taken (Lucas asked not to be consulted)
1. **One question, three parts, per lesson** rather than one big task: it keeps each part marked on its own, as the rubric does.
2. **Lipton is taught with readings, not facts.** Lipton's own sites could not be read; only a few facts hold (see `brands.md`).
   Every Lipton Apply says so and the exam answers reason openly without invented figures.
3. **Cross-brand facts are marked global** where they are (Hilton's 10-K covers the world, not Australia).
4. **Invented numbers are labelled** wherever an instrument needs them (a made-up demand curve, scale, funnel). They are shown
   in the figure's caption as illustrations, never as measurements.
5. **Slide numbers that could not be checked** (for example the Economist magazine options) were replaced by a made-up
   example, marked as one.
6. **The sample exam question is worked on Coles and set to the learner on Hilton**, then four brand questions and one
   brand-of-choice question close the course.
7. **No narration**, per the brief.

## Not checked (be honest about it)
- Live AI marking (no key in this worktree). Only the self-marking fallback and the key-point structure were checked.
- The subject guide PDF was not read for content; the lectures and the briefing were.
- Brand facts marked "search only" or "Wikipedia, fallback" in `brands.md` (mainly Lipton) are weaker than the rest.
- Drag with a real touch screen (tap-to-place was exercised; pointer drag was exercised with synthetic events only).
