# PM review: what the prototype still lacks

Question asked: if this is the prototype of a *math-teaching visualization
AI*, what would a product manager say is missing before putting it in front
of students, teachers and investors?

## The promise, as user journeys

| # | Journey | Status before this review |
|---|---------|---------------------------|
| J1 | A student **asks a question** and gets an animated, interactive explanation | Missing - the "AI" in the product did not exist end to end |
| J2 | A student **follows a course** from a syllabus, lesson after lesson, and sees progress | Missing - one lesson, no course, no home |
| J3 | Inside a lesson: predict, explore, get feedback, be remediated | Built (lesson runtime, P0 features) |
| J4 | A student **comes back tomorrow** and practises what is due | Engine built (spaced review) but no screen uses it |
| J5 | A student asks about **what is on screen** ("why is this angle 40°?") | Scene description built, no conversation surface |
| J6 | A teacher/parent sees **what the class struggles with** | Events logged, nothing to look at |
| J7 | The explanation is **heard**, not only read | Captions only |
| J8 | Someone checks that generated/authored scenes are **not broken** | Linter exists, no batch check |

## Gaps, ranked

| Rank | Gap | Why it matters | Build now? |
|-----:|-----|----------------|-----------|
| 1 | **AI answer pipeline**: question -> explanation + manim-web scene, validated in a sandbox (errors, timeouts, linter) with an automatic repair loop; pluggable model provider (Claude via the API; mock provider with recorded answers when there is no key) | This *is* the product. Without it the prototype is a nicely made lesson player | Yes |
| 2 | **Course home**: syllabus map (units -> lessons), mastery per skill, "continue", "due for review", "ask anything" | Turns features into a product; gives retention loops a place | Yes |
| 3 | **Ask-about-this-scene panel** with suggested questions (work without a key) and free questions (with a key), grounded in the scene description and learner model | The original brief: answer students' questions with visuals | Yes |
| 4 | **Review session**: due items as variant questions (retrieval + spacing) | The most evidence-backed learning feature needs a screen | Yes |
| 5 | **Narration**: speak step narration (Web Speech API, no server), captions stay in sync, mute toggle | Dual coding; younger learners; accessibility | Yes |
| 6 | **Lesson doctor**: lint every scene of every lesson headlessly (CI) | Quality gate for authored and generated content | Yes |
| 7 | **Teacher dashboard**: per-skill mastery, misconception counts, time, event export | Buyers are schools/parents | Yes (minimal) |
| 8 | Settings: API key (local only), theme, narration, reduced motion | Needed by 1, 5 | Yes |
| 9 | Accounts / sync / classrooms | Needed for pilots, not for a prototype demo | Later |
| 10 | Photo input (OCR of problems / handwritten work) | Big wow, needs a vision model | Later (provider supports images) |
| 11 | Content scale (a real syllabus of lessons) | Needs the generator + authoring time | Later: syllabus data + one authored lesson + generated lessons |

## Design notes for the pipeline

* The model writes **JavaScript against manim-web** (the same API as Manim),
  guided by an API digest generated from the library and a few worked
  examples; answers come back as JSON `{ explanation, code, checks }`.
* Generated code is **validated in a Web Worker** (OffscreenCanvas): it must
  construct without errors within a time limit, and the linter must report no
  errors on the settled frames. Failures are sent back to the model for a
  bounded number of repairs.
* Numbers the explanation claims (`checks`) are re-computed in the sandbox.
* The browser can call the API directly with the user's own key (prototype
  only; the key stays in localStorage). A tiny proxy is provided for real
  deployments so keys stay on a server.
* Without a key, a mock provider serves recorded answers for the suggested
  questions, so the whole flow is demonstrable offline.
