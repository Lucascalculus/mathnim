# The engine's three zones, and what joins it from the specimen (plan, 2026-11-06)

Lucas: the engine is now clear enough to see three parts, each with its own aesthetic (the specimen's lab shows
them): **mathematical images** (a function's curve), **real-world simulation** (the MPC cart, a pendulum: things),
and **text** (a definition that unfolds in its sentence, a chain of why, a formula that works itself out). Decide
what of the specimen joins the engine, and why; the first principle is the next-generation interface.

Every decision is judged by the engine's five criteria (memory, 2026-11-06): **decoupling**, **computational
efficiency**, **extensibility**, **freedom**, and **a dumb model draws it right**.

## The three zones

| | 图 Figure (mathematics) | 物 World (simulation) | 文 Text |
|---|---|---|---|
| What it shows | an abstraction you read: curves, planes, fields, formulas | things that exist and move by their laws | the explanation in words |
| Medium | canvas (`@mathnim/engine` figures) | canvas, the same figures, driven by `Sim` | DOM (`@mathnim/present`) |
| Aesthetic | ink on paper: white paper, three strengths of ink, hairline scaffolding, a pigment per noun | one world, one camera, one light; plain forms, pigment once named | type on a page: no boxes, no cards, no icons |
| Its own materials | formula steps (液态代数), development (显影: cases in transparent ink, agreement darkest) | time as matter (past as equal-time ghosts: spacing is speed; future dashed: a prediction) | meaning that unfolds in place (a definition in its sentence, reasons under a claim), formulas that change in place |
| Motion | converge (hollow → solid), develop, write | the world runs; nothing loops; it stops when it settles | the rest of the text moves down, never sideways |

**What the three share** (one grammar, so a learner learns it once): a noun has one colour everywhere (in a
sentence, a formula, a figure, a world, the tutor's words); hollow or dashed means not yet established, solid means
true; glass is only the hand; light only marks what is happening; the one vermilion verb is the next thing to do;
the tutor acts in the zone the learner is looking at. The step from world to figure is the camera turning to look
straight down (NEXT.md): an abstraction is the world seen from above.

## What joins the engine now, and why

| | What | Zone | Why (next-gen meaning, learning value) | The five criteria |
|---|---|---|---|---|
| 1 | **Certainty as a state**: `certain` on a mark - a path's dashes close, a marker's ring fills from its edge, a region's hatching becomes a tint | all | the grammar of predict-then-see: a guess is hollow, the truth solid, and the change between them is the moment of understanding (NEXT.md 空心 → 实心, STYLE.md) | a style state of marks, nothing else changes (decoupled); one param, no new layers (efficient); every mark kind can read it (extensible); dash and fill stay overridable (freedom); "certain: 0 for the learner's guess" (a dumb model writes it) |
| 2 | **Development** (显影): a family of cases drawn in transparent ink up to a parameter, so where they agree is darkest | 图 | makes limits and invariants visible without words: secants close onto the tangent, a pencil of lines keeps its eigen-directions, sample paths settle | one mark kind (decoupled); its film is cached and extended as the parameter grows, rebuilt only when it goes back (efficient); any family `(s) => path` (extensible); a pure function of the parameter, so seeking is exact; "cases(fn, from, to, upto)" |
| 3 | **Definitions in their sentence** and **chains of why** | 文 | the two most direct tools for 讲明白: the learner never leaves the sentence to learn a word, and every claim can be asked "why?" down to a definition or an assumption | DOM only (no canvas, decoupled); nothing runs at rest (efficient); markup a model writes (`[term](def: …)`, a `why` block) |
| 4 | **Nouns in prose**: `[cost](noun:cost)` | 文 | the word wears its noun's pigment, as the curve does: text and figure name the same thing | one rule in the markup |
| 5 | **Time as matter**: equal-time ghosts of a moving point's past, its future dashed | 物 / 图 | speed and prediction read at a glance (an MPC plan, a projectile, a pendulum); the "rewind" of NEXT.md | one mark over any position function or sim (decoupled, extensible); ghosts are a few stamps (efficient); "trail(pos, at)" |
| 6 | **Nouns in formulas**: formula steps colour and name their tokens by noun | 图 ↔ 文 | "this is that" between a formula and its picture (the specimen's brushing), and the tutor can point at a term | an option of `Steps` |
| 7 | **A plot's scaffolding cached**: axes, grid, ticks and numbers drawn once into a bitmap per layout | 图 | — | after the seek fix a moving dot still re-strokes its plot's axes every frame; now it does not (efficiency) |

Each lands with tests and a contact sheet; a hidden demo lesson (`/course-engine-zones`) shows them in place.

**Where it stands (2026-11-06, branch `mathium-algebra`).** 1 certainty (fc943a8), 2 development with
`tangent_develop` (6a3572c), 3 and 4 definitions in the sentence, the why block and nouns in prose (a9a19b8), 5 time as
matter with `phys_throw` (a32cd9f), 6 nouns in formulas (79f7809): done, each with its tests. 7 was measured and
dropped: after the batched seek a plot is drawn only while it is revealed (27 to 53 frames of 100 to 660; 0.1 to
14 ms over a whole animation, mpc_qp_plane the most), so a cache would save nothing. The demo is `/course-engine-zones`,
listed last under Test: one lesson, three pages (figure, world, text). On the way: a formula step's reason shows its
`$…$` as the characters it means (`tex_as_text`), and the chain of why's classes are `mn-chain-*`.

**Then, the missing piece: guess, then see** (`guess.ts`). None of the above asks the learner to commit before the
answer, and the research NEXT.md leans on says that is where predicting pays (the surprise, drawn as a gap). A guess
is a hollow ring the hand drags; letting go commits it (no button) and reports it to the lesson; the figure says what
showing the answer is; a Gap draws and says how far off. First use: `phys_throw` with `predict: true` ("where will it
land?"), on the demo's world page; and `tangent_develop` with `predict: true` (tilt a hollow line through P to the slope
you expect; letting go develops the fan; the gap in slope is said), first on the figure page. Next: a sketch of a curve
before the true one converges (a guess of many numbers).

## What waits, and why

| What | Why it waits |
|---|---|
| The 2.5D world and the camera turn to the top view | the strongest idea in NEXT.md, but it needs a 2.5D scene layer and a real lesson to prove it, and Lucas turned down physical 3D UI for the blocks; do it with an MPC step, on its own |
| Numbers you drag in a sentence (tangle) | high value, but it needs a small language for what depends on what; next round, on top of nouns in prose |
| The predict-first interactions (sketch your guess, confidence ring, magnetic bins, teach-back) | they need core step types (capture a guess, reveal, measure the gap); they will stand on certainty (1) |
| The exploded formula (parts and what they mean) | the same data as nouns in formulas (6), plus leaders; after it |
| Light flowing along field lines | after time as matter; light only while the world runs |
| Tables with addressable cells, the loupe | missing features from the migration ranking; tables first (MGMT reports) |
| A fast path for live numbers in TeX (physics report) | the rule stands meanwhile: a number that changes is a `value` part |
| Sim inputs as events, the tutor's play / pause (physics report) | when a physics course starts |

## What does not join the engine

The interface materials (condensing glass, fog to wipe, a light running round a button, folding paper, the broad
nib, paper layers, liquid glass, ink in water) mean things about the interface, not about mathematics: they belong
to the site's shell, if anywhere. The course map (stars) is the site's. The 28 blocks are prototypes of nouns the
engine mostly has (plots, paths, markers, fields, vector fields); each joins when a course needs it.

## Done means

- The kernel stays under budget and untouched for new kinds (a new mark is a new file).
- Every new mark: a test of its meaning (what it must show), a test that seeking is exact, the frame-equality test
  (incremental frames equal full redraws), and a look at its contact sheet in both languages.
- Text features: markup tests, and a look in the real page.
- `npm run typecheck && npm test`, doctor all green; the catalog regenerated.


## The text zone, redone as the experiments designed it (2026-11-06, later)

Lucas found the first text zone unlike the experiments and the derivation hard to read ("应该留着上一步公式，一步步推
下去"), and asked for every text-related experiment in the engine, writable by a dumb model, with condensing glass and
folding paper added. Now (all in `docs/TEXT-MARKUP.md`, one page for whoever writes text):

| Experiment | In the product | Written as |
|---|---|---|
| stretch (definitions in the sentence) | the definition follows its term on a faint ground; the rest of the sentence keeps its x and steps down, a dotted leader to where it resumes; tap it to fold back | `[term](def: …)` |
| why (a chain of why) | rings in the margin with a stub of thread; reasons drop on threads that keep to the margin; bedrock ends in a ground mark | the `why` block, or a ```` ```why ```` fence |
| the derivation | lines kept, the next coming down out of the last; the line above steps back to the second ink; reasons beside | ```` ```steps ```` (as before) |
| tangle (numbers you drag) | glass numbers; the ones that follow are ink; every digit a wheel with visible carries | `{{n = 3, 1..12}}`, `{{= 2.5*n, 2}}` |
| explode (an exploded formula) | assembled, a dotted line under each named part; tapped, the room opens and each part lifts on a card with its meaning (rows packed), its shadow left in place | ```` ```parts ```` or a math block's `parts` |
| pull / brush (this is that) | a noun touched in the text lights its thing in the page's figure (a drawn thing, never its number) | `[word](noun:key)` |
| fold (folding paper) | details unfold like paper folded in a zigzag (lit face up, shaded face down), plain text at rest | the `details` block, or ```` ```details Title ```` |
| condense (condensing glass) | a footnote's source condenses from the tap as a clear pane; tap elsewhere and it is gone | `[^key]` and a `cite` block |

The ripple (dependent cells) is what the numbers that follow already do, without its hollow-to-solid wait; the tutor as
light and the asking note belong to the margin tutor, which works that way already.

## The lesson page (the experiments' MPC lesson)

Lucas left it to me: all of it, some of it, or none. Taken: the paper (no reading card, no frames round figures or
tables: a figure in a text draws on the page's own paper), the page's type (a quiet kicker, a large title, 18 px body
at 1.86), and the way on as a floating glass island holding the progress and the one vermilion verb. Why: STYLE.md's
rules (no card borders; one vermilion element, the next step; glass only for the hand) are the experiments' own, and
the reading page was the last place that broke them. Not taken: the experiments' margin notes and island modes, since
the margin tutor already answers level with what it is about, and its behaviour is not a layout change; the camera
toggle and the readouts beside the figure, since those are a figure's own composition (the engine's layout), not the
page's.
