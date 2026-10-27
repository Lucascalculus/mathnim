---
name: course-review
description: Review a Mathnim lesson or course the way Lucas would (讲明白, taste, interaction bar, the real page on desktop and phone) and list what to fix by severity. Use after writing or changing lessons, before a preview, or when Lucas asks to check / 过一遍 / 测试 a course. Pass a lesson id (e.g. mpc-m4-constraints) or a course slug (e.g. mpc).
---

# Course review

Judge the lesson(s) against `docs/TASTE.md` and `docs/COURSE-PLAYBOOK.md`.
Report problems with evidence; don't fix anything unless asked (then fix and
review again).

## 1. Gather

- The target: a lesson id, or every lesson of a course (`apps/mathnim/src/course.ts`).
- Automatic checks, and note any failure as a finding:
  - `npm run typecheck`, `npm run doctor`;
  - the visuals checker for the visuals these lessons use
    (`npm run check -w @mathnim/visuals -- --only <names>`; look at the
    contact sheets);
  - `npm run catalog -- --check`.
- The text as a student reads it: `node apps/mathnim/tools/lesson_text.mjs <id> zh`
  and `en`.
- The real thing: run `npm run dev` and walk the lesson with
  `node apps/mathnim/tools/page_shots.mjs` (see its header): open each kind of
  step, answer a question wrong and then right, use a world, ask the margin
  tutor one question, reach the end of the lesson; at 1440 wide and at 390
  (phone). Look at the screenshots yourself.

## 2. Judge

For each page and step, ask:

- **讲明白**: does the learner know what this is for before the mechanics? Is
  there an intuition before the formula, and does each term say what it does?
  Is "why this and not X?" answered where a learner would ask it? Could they
  explain it afterwards in their own words? Anything that opens with details,
  or is a wall of text?
- **Form**: is this the simplest form that teaches the idea? Does each world
  pass the interaction bar (prediction, the learner moves the cause, goals not
  reachable by chance, specific feedback)? Would a figure do?
- **Checks**: do they test transfer rather than recall? Does wrong-answer
  feedback name the misconception? Is "show answer" pushing people to skip?
- **Writing**: native Chinese, short sentences, titles everywhere (no step
  shows an id), no instructional copy, honest numbers with sources,
  simulations labelled.
- **Narration**: only scene steps (and short world lines) are narrated; text
  pages and questions are not.
- **The page**: one main button at a time; nothing cut off or overlapping at
  phone width; Chinese labels on canvases fit; motion purposeful and skipped
  for reduced motion; the margin tutor answers (or says it could not).
- **Across a course**: does each lesson build on the last (notation, the
  running example, "M2 讲过…")? Does the map read well? Is the first lesson
  low-friction?

## 3. Report

Group findings by severity, in Chinese if Lucas is reading:

- **严重 (fix first)**: wrong or unsupported content, a learner gets stuck or
  confused, something broken.
- **明显 (fix this round)**: weak explanation order, a world that doesn't earn
  its place, unclear UI, inconsistencies.
- **细节 (polish)**.

Each finding: where (lesson id, step id, screenshot path), what you saw (quote
the text), why it matters to the learner, and the fix you propose. Start with
what already works well (one or two lines), and end with a suggested order of
work. Say plainly what you did not check.
