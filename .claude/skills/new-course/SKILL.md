---
name: new-course
description: Plan and build a new Mathnim course (or extend one) from a topic to a reviewed preview, following docs/COURSE-PLAYBOOK.md and docs/TASTE.md. Use when Lucas asks for a new course ("做一门课讲…", "publish一门课…"), new lessons for a course, or to restart a paused course.
---

# New course

You are making a Mathnim course. The playbook (`docs/COURSE-PLAYBOOK.md`) is
the map; this skill is how to walk it with Lucas. Adapt the pace and the order
to the topic: the playbook's "Always" list is fixed, the rest is judgment.

## 0. Load the context

Read `AGENTS.md`, `docs/TASTE.md`, `docs/COURSE-PLAYBOOK.md` and skim
`docs/CAPABILITIES.md` (which visuals and worlds already exist; a course next
to an existing one may reuse its kit). If the course exists or was paused, read
`docs/CHECKPOINT.md` and `docs/lessons/<course>/` first and continue from there.

## 1. Frame it with Lucas (a short exchange, not a form)

Propose, in a few lines: topic and edge, audience (what they know), three
outcomes, size (lessons × minutes), labs or not. Offer a default for each and
ask only what changes the plan. Then write `docs/lessons/<course>/README.md`.

## 2. Research, then shape

- `docs/lessons/<course>/research-*.md`: claims with verified sources, real
  misconceptions, concrete numbers, a candidate running example.
- The outline in the README: units (the course map's stops), the running
  example, the signature animation (the course cover), per lesson its question
  and forms, prerequisites (one sentence, 2–4 links) and outcomes.
- **Show Lucas the outline before building.** Offer one alternative where you
  were torn.

## 3. Build

- A kit first (shared math with tests, drawing helpers, canvas language), as in
  `docs/lessons/mpc/KIT.md`.
- Then lessons, one file each, against the reference lessons in the playbook.
  Prefer the simplest form that teaches; justify every world.
- Work alone unless Lucas asks for parallel agents; if he does, give each the
  lesson brief template from the playbook and keep shared files with one owner.
- Keep `docs/lessons/<course>/` notes current (a checkpoint per lesson when
  work may be interrupted).

## 4. Check, review, polish

- `npm run typecheck && npm test`, `npm run doctor`, the visuals checker on new
  visuals (look at the contact sheets in both languages),
  `npm run catalog` (new visuals belong in the catalog).
- Run `/course-review` on each finished lesson and fix what it finds; review
  the whole course once at the end (flow across lessons, the map, the cover).

## 5. Publish (with Lucas)

Register the course in `apps/mathnim/src/course.ts` (see the playbook's
Phase 7), generate the manifest if lessons load on demand, thumbnails, and
narration once the scene texts are final. Show Lucas a preview: screenshots of
the course page, a lesson on desktop and phone, and anything you were unsure
of. Commit and push; deploy only when he says so.

## Report

Plain words: what exists now, what you checked and how, what you did not
check, and the decisions you need from Lucas.
