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


## Engine figures for lessons 11 and 13 (`mgmt_tree`, `mgmt_normal`), 2026-11-06

**What was built.** Two engine figures in the `mgmt` pack, each with its arithmetic in a small tested module, as `lp_plane` / `lp2d`:
- `mgmt_tree` (`decision_tree.ts`, arithmetic `tree.ts`): the exam's tree drawn in time order, then rolled back by height (payoffs first). Into a
  circle, "p × value" travels along each branch and the circle's value appears; into a square, the branches' values travel in, the better is kept
  and the others get the exam's double stroke (vermilion) and grey out with everything behind them. A slider moves one named probability (every
  branch that uses it follows, in violet) and every value and cut is live. Trees: `carpool` (2025 Q4, min) and `pdc` (with the study, max).
- `mgmt_normal` (`normal_area.ts`, arithmetic `normal.ts`): one curve over two axes, the question's units and z. The script standardises as motion
  (a bar one σ long steps out from the mean; each step drops a line onto the z axis where its count is written), drops the question's value onto z,
  then fills the area. The table only gives left areas, and the motion makes the rest from them: a right tail is the left area handed over to the
  rest (1 − table), a "between" is the left area of the upper value with the lower one's taken away, and backwards the area fills to the given one
  and its z rises to x. Modes `left`, `right`, `between`, `find` (with `from` for P(from < X < d) = p).

**Decisions (Lucas said: decide, do not ask).**
1. **The numbers are Python's, to the bit.** `tree.ts` repeats l11's trees (with the paper's rounded posteriors) and `roll()` does common.py's sums in
   the same order (ties to the first branch); the test compares every node's double with Python's output. `normal.ts` rounds as Python does
   (`round_py`: exact value, ties to even; JS `toFixed` sends ties away from zero), and the test compares all 699 entries of the table
   (−3.49 … 3.49) with `common.ztable`, plus 0.0681, 0.9593, $384,040, $411,925, 0.2420, 30,100 and 0.7193.
2. **The hands.** Carpool: P(open | overcast), whose route flips at 0.75 (the overcast posterior 0.79 is the one near its threshold). PDC:
   P(strong | favourable): below about 0.86 the study stops paying, below 0.70 a favourable report no longer justifies the large complex. A moved
   probability snaps to 0.01 and its complement is round(1 − p, 2), so the defaults give exactly the paper's numbers.
3. **Wide tree: words on the line, values above the node.** A branch's name and probability sit on its line (the line breaks for them, as a dimension
   line does) and a node's value stands above it. Values on the lines made PDC need ~820 px; above the nodes it needs ~660.
4. **PDC is too big for the 16:9 stage at 15 px** (the read page's stage is about 670 × 378; the checker's 640 × 360; 18 payoff rows). A tree with
   more than 12 payoffs is laid out at a design width of 780 px and drawn to the stage (15 px words stay at least 12 px down to a 624 px stage), and
   its slider moves into the tree's emptiest corner (beside the root's first or last branch, whichever has more rows beyond it: PDC's top left).
   Twelve payoffs or fewer: the slider sits under the tree. The root's own value, set large, is the answer; there is no separate total.
5. **Phone tree: an outline, top to bottom** (one node per row, depth by indent, every value in one column at the right, the numbers travelling up
   into their node). PDC is 768 px tall at 360 wide; every word is 15 px.
6. **The working of `mgmt_normal` is in the interface's sans, not TeX's serif** (Mathium's own look; it matches the axis numbers). Only the ⇒ arrow is
   TeX (the CJK fallback font in node has no glyph for it). Each formula's result is on its own line ("= −1.49"): the column beside the curve is
   about 240 px on the page's stage.
7. **Placement in the lessons.** l11 (iv): the engine tree in `story='draw'` replaces the static SVG (no hand, `explore=False`, so the page shows no
   "drag" hint). (v): the rollback plays before `tree_roll`, and the learner then does it by hand. PDC: `tree_roll` first (practice on a new,
   bigger tree), then the engine tree with a quiz its slider answers (0.86), before the EVSI number. l13 "The standard normal and the table": the
   standardising figure after the formula (the tyre at 45,000, z = 1.70) and the backwards one after "Reading backwards" (p = 0.25); neither uses
   the numbers of the practice questions that follow (0.2420, 30,100).
8. **Four nouns added to the look**: `expected-value` (cobalt), `cut` (vermilion), `chance` (violet: the probability under the hand), `z-score`
   (violet). `npm run catalog` regenerated docs/CAPABILITIES.md and the tutor's catalog.

**What the checker and the page found** (all fixed):
1. Measuring text while building a figure crashes in node (no canvas yet): measure inside the draw-time layout only.
2. PDC overflowed at 640 × 360 (see 3 and 4).
3. At the extreme of a handle's range an edge's number ran into the axis's name, and two edges' numbers into each other: numbers keep right of the
   names, a tick's number gives way as soon as an edge's begins to appear, and two edges' numbers push each other apart.
4. The fibres between the axes ran through the numbers of the question's axis: they now leave from under the numbers.
5. A figure with no hand still showed the page's "drag the glowing handle" hint: a figure with nothing to explore needs `explore=False`.

**Not checked.** Dragging with a real finger or mouse (the page was driven with the keyboard on the handles' sliders, headless Chrome); a screen
reader on the mirror; the dark theme (one light theme); the Chinese read by a native reviewer.

**Apply next.** A figure on the read page has a 16:9 stage of about 670 px: count the rows and the words before choosing a layout, and lint at
640 × 360 as the checker does. Put a figure's hand where its picture is empty before shrinking the picture. When a figure replaces a static
picture, check whether it has anything to explore.
