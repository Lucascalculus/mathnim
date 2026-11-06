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


## After lesson 2 (`lp-formulate`), 2026-11-06

**What went well.** The formulation checker answers the question a book cannot ("is *my* model right?") with a plan, not a verdict: "your model allows
x1 = 16, x2 = 9, which reaches only 9 under the minimum of 10". It accepts a differently written but equivalent model, and the same
instrument serves Consolidated Electronics and the exam's DCI question. Writing first and drawing after (the picture is the learner's own
model) kept the picture from giving the model away.

**What the tests found.**
1. A figure with four limits does not fit the right column on a 16:9 stage (the checker's wide stage is 640 x 360, smaller than the page). Rows had to
   become one line each, with the colour saying over / used up / room; the checker found it, as it did in lesson 1.
2. A corner that a moved wall pushed out of the picture was still labelled, above the figure. Only what is in the window is drawn.
3. Labels near a plot's corner need a fallback inside the plot (`below-left`) and a bound (`within`).
4. The pane of the Claude desktop app blocks a sandboxed frame (`sandbox="allow-scripts"`, opaque origin) with `net::ERR_BLOCKED_BY_CLIENT` on
   this port, while the same page loads without the sandbox or with `allow-same-origin`. The instrument itself was verified standalone and with
   `allow-same-origin`; the opaque sandbox is untested in a real browser in this session. (Before the course work it loaded on port 5190.)
5. An error inside a sandboxed instrument is invisible to the page; `kit.js` now posts it to the page as `{ mn: 'error' }`.

**Apply to lesson 3 (`lp-report`).**
- The Solver report is a table: it is a DOM instrument (a frame), but every cell must be tied to the picture. Build the report reader as a frame
  that draws its own small plane (SVG) so a touched cell moves the picture, or place the engine figure beside it and make the cell *say* the
  plane's state in words. Decide with Lucas whether frame <-> figure talk is worth building (platform ask R2); until then keep the picture
  in the engine figure and the numbers in a table beside it, with questions that ask for both.
- Reuse `PROBLEMS`: shadow price 1.5 on Shader's 240, the allowable stretch 200 to 300 (the walls tool already shows the corner changing).
- One quiz before the picture again; keep checkpoint numbers whose answer is read off the picture (410, 216,000, -8,000 worked).
