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
