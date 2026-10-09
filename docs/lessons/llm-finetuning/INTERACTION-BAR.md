# The bar for interactions (read before building any visual or world)

The user asked for interactions to be held to a high standard and made as
complete as possible, using what the Mathnim libraries already offer. This file
is that standard. The main session will review every world against it in the
browser and send back the ones that fall short.

## 1. What every world must have (all of these)

1. **A question before the action.** The learner commits to a prediction
   first, then acts, sees the result and can explain it. The prediction is a
   `checkpoint` (choice, number, `sketch` - draw the curve you expect - or
   `point`) placed right before the world. A world without a question in front
   of it is a toy.
2. **The learner moves the cause, never the answer.** Drag the thing the math
   says is the input (a reward, a mask bit, β, a sample's correctness, a
   learning rate), and let the consequence follow. Never "drag k along a
   finished curve".
3. **Every mark on screen is a quantity.** Each shape maps to a number or term
   in the formula on the page; live readouts show the values; the formula on
   the canvas lights up the term that changed (`Indicate`, colour by name).
   Pick a form that matches the math: a probability is a bar or an area, a
   ratio is a clip band, a distribution is a histogram or a curve, a mask is a
   row of on/off cells, a pair is two cards facing each other.
4. **A goal that can only be reached by understanding.** Random wiggling must
   not get there. `solve()` proves it can be reached; the doctor proves it is
   not reached before acting.
5. **Detectors for the typical wrong move**, each with its own line:
   - each detector emits a `misconception` finding that names the
     misconception id from the plan;
   - the line says what the learner just saw and why it happens, not "try
     again".
   - Add at least one detector per world.
6. **Lines with fixed text** for `enter`, `idle`, every goal and every finding
   (both languages, Chinese written natively). Narration must say what to look
   at, not repeat the prompt.
7. **A takeaway that connects back.** After the goal, one line or a short
   `read` block states the rule in words, and the next step uses it.
8. **Discoverable and accessible:**
   - an `AffordanceLayer` with `coach()` on first use;
   - halos on handles;
   - keyboard: every handle and item has a label, and arrow keys work;
   - touch: no target smaller than the toolkit's defaults.
9. **Responsive:**
   - smooth live updates while dragging;
   - nothing jumps or flickers.
   - Feedback (a snap, a success cue) only where it tells the learner
     something happened. Respect reduced motion.
10. **Honest:**
    - simulations and toy models are labelled on the canvas ("示意 / toy
      model");
    - real numbers come with their source;
    - illustrative transforms say so.

## 2. Know the library, then choose the simplest form that fits

**Do not use a feature because it exists.** The user's rule is the same as
for interactions: no "using the Mathnim library for its own sake".

- Start from the idea: what must the learner see or do to understand it?
- Then pick the form:
  - a static figure, a table or a sentence is often the right answer;
  - one well-chosen handle beats three gadgets;
  - drag and drop, tiles, stamps, actions and juice belong only where the
    action itself *is* the concept. A pair of cards facing each other *is* a
    preference pair. "Train 100 steps" *is* a discrete optimizer step. Using
    them because they look rich is not a reason.
- For every feature in a world, the report says why that form, and what would
  be lost with something simpler.

Still, know what exists, so the right form is not ruled out by ignorance.
Read these:

- `packages/manim-web/docs/EXTENSIONS.md` - the whole interaction toolkit:
  - `Interaction` handles with constraints: `on_segment`, `on_circle`,
    `on_curve`, `in_box`, `snap`, `all`;
  - `hit_test` / `on_click` (tap an object to ask "what is this?");
  - `add_draggable` + `DropZone`: sort cards into bins, build a preference pair,
    put tokens in the masked / trained row - with capacity, swap
    (`when_full: 'bump'`), snapping and `draggables_in`;
  - `Cutter` (split a sequence, cut a distribution at a threshold);
  - `Stamp` (tap to add samples, count them);
  - `Scrubber` and `ExploreStep.scrub` (drag a number inside the prompt text,
    `{scrub:beta}`);
  - `TokenBuilder` (assemble a formula from tiles - e.g. build the DPO loss
    from log-ratio tiles; graded as LaTeX);
  - `NumberLineMarker`, `Slider`;
  - `Juice` (`burst`, rings, counter tweens, sounds);
  - `AffordanceLayer` (halos, arrows, dashed paths, coach marks);
  - `ScenePlayer.play_now()` - animate a response outside the timeline, e.g.
    "sample 8 answers" flies in 8 cards.
- `packages/core/src/schema.ts` and `world.ts`:
  - goals, detectors and findings, lines with `if`, stars, hints, `required`;
  - `actions`: buttons such as "训练 100 步 / Train 100 steps", "采样 8 个回答 /
    Sample 8", "重置 / Reset" that run code on the world - use them for
    discrete steps of an algorithm;
  - checkpoint question types `choice`, `number`, `expression`, `sketch`,
    `point`, `text` (free text graded against key points);
  - `CaseGroup` for case studies.
- `packages/present/src/sketchpad.ts`: the learner draws a curve. Use it for
  "sketch the loss curve / pass@k vs k / reward vs KL you expect" before
  revealing.
- **Worked examples to study** (read the code, and look at how worlds,
  detectors and lines fit together):
  - `apps/mathnim/src/lessons/pizza-game/lesson.ts`: 7 worlds - drag and drop,
    cutting, stamping, actions, detectors, stars;
  - `apps/mathnim/src/lessons/eigen-pca/lesson.ts`: handles, scrub, essay mode;
  - `apps/mathnim/src/lessons/text-pages-demo`: read / derive / code pages with
    embedded visuals;
  - `packages/visuals/src/linalg/kit.ts`: `Plane`, live arrows, `LiveMatrix`,
    `readout`, `live_row`, `switcher`, `MatrixTrackers`.
- **Canvas language:** use `packages/visuals/src/ft/f/kit.ts` (`LANG_SPEC`,
  `ft_lang()`) so every label on the canvas follows the learner's language.
  Check the Chinese contact sheets: CJK text is wider, so it must still fit.

If the toolkit lacks something your interaction needs (a histogram primitive, a
draggable bar, a card flip), build it in your part's folder as a small reusable
helper, and describe it in your report so it can move into a shared kit later.
Do not edit `manim-web`, `core` or `present`; ask in your report.

## 3. Verify like a reviewer (headless; no browser)

- `npm run check -w @mathnim/visuals -- --only <names>` for every example, both
  languages. Look at every contact sheet image yourself, including the end
  state and the explored state. Fix every overlap, cramped label,
  low-contrast mark and empty corner.
- `npm run doctor`: each world's `solve()` reaches every goal, and no goal is
  met at entry.
- Unit-test the pure math behind each world (the numbers it shows must match
  the formula on the page) with vitest, next to your visuals.
- **Product-manager pass:**
  - Play each world in your head as a student who knows neural networks but
    not this topic. What would they try first? Does the screen answer it?
    Where would they get stuck? Is there one detector for the most likely
    wrong move?
  - Then rewrite.
- **The report has one section per world:**
  - the question before it;
  - the cause the learner moves;
  - the goal and why it can't be hit by accident;
  - its detectors and lines;
  - the forms and library features used, why each one, and what a simpler
    form would lose;
  - its contact-sheet paths.

## 4. Sent back if

- It is a slider over a static or precomputed curve, with no prediction and no
  goal.
- It is reachable by random dragging, or already true at entry.
- It has no misconception detector, or its lines are generic ("Nice!", "Try
  again").
- The canvas shows a number or shape the page never explains.
- It has overlap, clipping or unreadable text in either language.
- It is unlabelled simulation or made-up "real" numbers.
- It uses a toolkit feature (drag-and-drop, tiles, stamps, sounds, extra
  buttons) that adds steps without adding understanding, where a simpler form -
  including a static figure or text - would teach as well.
