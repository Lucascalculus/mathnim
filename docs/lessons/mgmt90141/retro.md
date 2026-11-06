# MGMT90141: what each lesson taught the next (written after each lesson, applied to the next)

## After lesson 1 (`lp-picture`), 2026-11-06

**What went well.** The five moves fit: a quiz on the first page (can 40 + 40 be made?) commits the learner to computing hours before any
picture; the plan hand gives immediate numbers; the choice (which kind of plan is best?) puts the greedy picture ("make the dearer
product") on the table and the next page defeats it with the sweep. The figure is one engine figure with four hands (`tool`), which
kept the lesson short.

**What the tests found** (all fixed; the figure's checker, which drags every handle to the corners of its range, found the first two):
1. Readouts that grow with the numbers overflowed the figure at wide size ("over by 380"). Put a number and its words on two lines, and
   test the extremes, not just the start.
2. The first look at the picture gave the answer away (the best plan's numbers shown at once). A figure now takes `best` (default off),
   and the numbers panel is left out while the learner is still predicting.
3. A label put in the middle of a wall landed on the best plan, because the middle of Shader's electronic wall *is* the best plan. The
   engine now lets a label slide along the path it names (`along`, engine commit), instead of each figure guessing.
4. A caption said "on the right"; on a phone the numbers are below. Captions must not name a side.
5. Money inside text needs `\$` (the lint now reads an escaped dollar as money).

**Apply to lesson 2 (`lp-formulate`).**
- Start with the learner's hands on the *text*: the story is the instrument. Do not show the model before the learner has written theirs.
- The checker (`lp.js` + `lpcheck.js`) is a DOM instrument, so it is a `frame`; the plane figure stays an engine figure. Do not build a
  third thing: reuse `PROBLEMS` in `lp2d.ts` (add Consolidated Electronics, a minimisation, with its four limits and `>=`).
- Keep one right-hand panel of numbers per figure, two-line rows, and never name a side in a caption.
- A quiz *before* the picture worked; do it again (what does the minimum requirement do to the region?).
- Put money as `\$` from the start.
