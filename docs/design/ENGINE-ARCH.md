# The engine's architecture for growth (2026-11-06)

Lucas, 2026-11-06: "尽量把未来拓展的可能性提前想到，并在现在设计时让系统能在未来拓展." This page is how Mathium's
engine grows from here: what the layers are, the contract each new piece signs, and, for every kind of growth we can
foresee, the seam that already takes it. It refines `ENGINE.md` (the kernel's six jobs, §8 plugins) and
`ENGINE-ZONES.md` (the three zones). The five criteria (`解耦 · 高效 · 扩展 · 自由 · 蠢模型画对`) judge every line.

## Why now

Building the text zone (2026-11-06) showed four strains (the discussion is in the session of that day):

1. The zones had no joint. A noun touched in the text reached a figure by a DOM event that searched the figure for
   "the smallest thing whose role is noun:ball"; a number in a sentence was not a value any figure could read; the
   tutor's light belonged to each figure, not to the page. Brushing both ways, pulling a noun, the ripple of
   recomputation and the tutor as light all wait on this.
2. Everything new went into the kernel's folder (steps, parts, trail, guess, cases): about 8000 lines against a
   budget of 10 000, with some thirty experiments still to come. `define_kind` was written in ENGINE.md, never built.
3. What a text may hold was written by hand three times (`docs/TEXT-MARKUP.md`, the tutor's prompt, the course
   generator's format). Miss one and a model is refused for writing it right, or let through writing it wrong.
4. The specimen and the engine were two codebases: an experiment that worked was written again to join.

## The layers

```
authors       markup + JSON (any model) · define_figure kits (a strong model) · the engine API (us)
                ↑ the markup guide, the tutor's tools, the course format and the gallery are generated from the registry
page          one per page or answer: shared values · nouns · attention (the hand, the light) · reports · zones
  ├ figure / world zone (canvas)     ├ text zone (DOM, @mathnim/present)      shell: interface effects (present)
library       src/lib: things, motions, gestures, acts, (present: markup, effects): one file each, a maturity each
kernel        src/kernel: state · things · layout · time · checks · render · hands · mirror · registry · page
look          @mathnim/look: colours, type, spacing, motion, taste rules (data only)
```

Dependencies point down only, and two tests hold them there (`packages/engine/test/arch.test.ts`): no kernel file
imports the library, and the kernel stays under its line budget. The kernel never touches the DOM at import (node
renders everything: the doctor, thumbnails, video export); DOM zones live in `@mathnim/present`.

## The registry: one index of everything an author can use

`packages/engine/src/kernel/registry.ts`. Every piece of the library is an entry:

| field | what it is | why it is there |
|---|---|---|
| `kind` | `thing`, `motion`, `gesture`, `act`, `markup`, `effect` (open: a string) | new kinds of pieces need no kernel change |
| `name`, `aliases` | snake_case; old names that still resolve | renames never break a lesson or a stored answer |
| `says` | one line, `{ en, zh }`: what it means to a learner (the specimen's "means") | the gallery, the tutor's vocabulary, screen readers |
| `zones` | figure, world, text, page | the gallery's sections; which hosts may use it |
| `maturity`, `since` | experiment → preview → stable; the engine version it arrived in | experiments ship without reaching models; promotion is a one-word change |
| `syntax`, `example`, `rules` | how an author writes it, a complete example, when to use it and when not | the generated guide and prompts say exactly this |
| `accept`, `checks` | the acceptance criterion in words; the same as code | the specimen's 验收 becomes a test that runs in CI |
| `demo` | a function that builds a live demonstration | the gallery draws it; a generic test lints it |
| `from`, `pack`, `source` | the specimen experiment it graduated from; the course kit that brought it; its file | provenance; kits load on demand; the catalog links the code |

What models see is `for_models(kind, audience)`: stable entries (and preview ones for course authors), never
experiments. The generated outputs (run `npm run catalog`; `--check` fails when one is stale):

- `docs/TEXT-MARKUP.md`: the markup guide, from the `markup` entries.
- `packages/ai/src/prompts/markup.generated.ts`: the tutor's "text tools" and the course format's text paragraph.
- the "Engine library" section of `docs/CAPABILITIES.md`: every entry by kind and maturity.

### The contracts

A **thing** (`define_thing`) is a `Thing` subclass in its own file under `src/lib/`. It must draw in 2D (the base,
and the fallback of any GPU look), say what it is (`says`, `text`, `parts_of` for the mirror), give its box and
obstacles (labels avoid it), and read params only while drawing (the renderer then redraws it only when they change).
A world material that moves runs on `fig.sim` (fixed step, so it seeks exactly and replays bit for bit); random ones
take a seed.

A **motion** (`define_motion`) is a script step: a pure function of time over the params it names, so seeking costs
one frame. Its default intent and duration come from the look.

A **gesture** (`define_gesture`) is a way for the hand to answer: it turns pointer input into a value. Gestures plug
into the **prediction protocol** (`src/lib/predict.ts`): asked → committed → revealed, with the guess, the truth, the
gap in words, and one report to the lesson. A guess is hollow until the truth is shown, then the gap is drawn. The
point guess (`guess.ts`) is the first gesture; a sketched curve, magnetic bins, a confidence ring and teach-back are
the same five states with a different hand.

An **act** (`define_act`) is something the tutor may do, only as a learner could: it names a thing or a param on
the page, is checked before it is done, is kept in the history and can be undone. The four built-ins (point, set,
note, reset) are entries; a new one (raise the water, roll from here, open a definition) is a file.

A **markup** tool (`define_markup`, `@mathnim/present`) is an inline pattern or a fence. It turns its text into HTML
(DOM-free, so the server and node can run it), says what is wrong with a malformed use (`check`), and has a plain
fallback: a mistake shows as text, never as a broken page. Its behaviour on the page is wired by delegation, so an
answer streamed in later works the same.

An **effect** (`define_effect`, present) is an interface motion of the shell (condensing glass, folding paper, the
stretch of a definition): it means something about the interface, not the mathematics, so it is not the engine's,
but it is registered so the gallery shows it and its timing comes from the look.

## The page: where zones meet

`packages/engine/src/kernel/page.ts`. One page per lesson page, per tutor answer, per gallery card. Zones attach to
it; they never know each other, only the names on the page.

| the page holds | what it makes possible |
|---|---|
| **values**: named numbers shared by the zones (`page.value('n')`) and computed ones (`page.formula('= 2.5*n')`) | a number dragged in a sentence moves a figure (`bind`), a figure's value appears in a sentence, the ripple of recomputation is the dependency graph drawn |
| **nouns**: which zone shows which noun, and by which thing (`page.find('ball')`) | brushing both ways, pulling a noun out of a sentence, the tutor pointing by meaning |
| **attention**: the noun under the hand, and where the one light is | touch a word and its thing lights (the rest recedes); touch the thing and the word answers; the tutor's light can travel from a sentence to a point |
| **reports**: one channel in the shapes of `docs/REPORTS.md` | every zone reports to the lesson the same way; a log to replay or resume from |
| **acts**: routed to the zone that owns the target | the tutor acts across the page with one vocabulary |
| **snapshot / restore** | resume a page where the learner left it, share a state as a link, replay a session |

A zone is anything with `id`, `kind`, `anchors()` (the nouns it shows), `attend(attention)` and, optionally,
`manifest()` / `act()` / `describe()`. `figure_zone(player)` is the engine's; `text_zone(root)` is present's. A new
kind of zone (a 2.5D world with its camera, a table with addressable cells, a code walkthrough, narration) is a new
adapter, nothing else.

## How an experiment joins now

1. Write it as a library file with its entry, `maturity: 'experiment'`, and its acceptance as `checks`.
2. It appears in the gallery (`/engine`) live, with its checks run; no lesson or model sees it yet.
3. Try it in the demo course; review it with Lucas.
4. Promote: `maturity: 'stable'`. The guide, the prompts and the catalog pick it up on the next `npm run catalog`.

The old specimen stays as the record of the explorations; new experiments start here.

## What we can foresee, and the seam that takes it

| growth | the seam now | what it will take then |
|---|---|---|
| a world material: water level, spring, tinted sheets, sand, thread | `define_thing` + `fig.sim` (deterministic, seeded) | one file, its checks; no kernel change |
| a heavy look: ink in water, flowing field light, refraction inside a figure | `kernel/gpu.ts` already keeps one WebGL2 context and one WebGPU device for the whole app, with a CPU twin of every picture | a mark like `Field` that draws through the shared device and has a 2D still |
| a new way to answer: sketch a curve, bins, wipe the fog, fold a corner | `define_gesture` + the prediction protocol | the gesture's value, its gap, its 2D picture |
| a new text tool | `define_markup` (inline or fence), guide and prompts generated | one file in `present/src/markup/` |
| an interface effect: fog, ink bloom, a light round a button | `define_effect` in the shell, timing from the look | one file; the gallery shows it |
| text and figure as one: numbers that move figures, values of a figure in a sentence | page values, `bind` on a `visual` block | a host writes `bind: { a: 'n' }` |
| brushing, pulling nouns, the tutor's light that walks | page nouns and attention | the gesture or the act; zones already answer `attend` |
| a new zone: a 2.5D world and the camera turning to the top view, a table, code, narration | `Zone` is an interface with an open `kind`; targets are `{ noun }` or `{ zone, id }` | an adapter |
| the tutor doing more (raise the water, roll from here, open a definition) | `define_act`: checked, recorded, undoable, routed by the page | one entry; the vocabulary reaches the prompt when stable |
| resume, share a state, replay, learning analytics | `page.snapshot()` / `restore()`, the report log with times | storage and a viewer |
| renaming or retiring a piece | `aliases`, `since`, maturity | the doctor counts uses before removal (ENGINE.md §9) |
| a course kit with its own pieces | `pack` on an entry; packs load on demand | the kit registers its entries |
| models of different strength | `for_models(kind, 'tutor' \| 'author')`: the tutor sees stable inline tools; authors also preview ones | a new audience is a filter |
| export: video, print, thumbnails | the kernel and the markup are DOM-free; every entry has a 2D form | nothing new |
| accessibility across zones | the mirror per figure; page nouns know where a word's thing is | keyboard travel between a word and its thing |
| a third language | every learner-facing string is `L10n` in one type | widen `L10n`; the registry already carries `says` as `L10n` |

## What this does not do

No general scene graph or entity-component system, no physics library, no UI framework for the text, no model
writing kernel code, no interface material in the kernel. The kernel's six jobs stay six.

## Where it stands (2026-11-06, branch `mathium-algebra`, Mathium 0.3.0)

Built and tested:

| | where | how it is held |
|---|---|---|
| kernel and library in two folders | `packages/engine/src/kernel`, `src/lib` | `test/arch.test.ts`: no kernel file imports the library; the kernel under 10 000 lines (about 5 400 now; the library 3 600); no DOM at import; every library file exported |
| the registry, 75 entries | `kernel/registry.ts`; entries beside their code (`lib/basics.ts` for the kernel's own kinds and motions) | `test/registry.test.ts`: malformed entries refused, names unique per file, aliases resolve, audiences by maturity, checks run; every engine entry well formed, its file real, its demo drawn clean in both languages |
| the tutor's acts as entries | `kernel/acts.ts` (`define_act`; the player and `act_now` run a registered act) | a registered act is checked, done and recorded like the four built-in ones |
| the prediction protocol | `lib/predict.ts`; the point guess is its first gesture (`guess.ts`) | the guess tests, unchanged |
| the page, a figure as a zone | `kernel/page.ts`, `kernel/zone_figure.ts`; figures recede to the noun the hand is on (`figure.focus`), a formula's symbols one by one (`Steps.noun_pieces`) | `test/page.test.ts`: values and formulas, bindings both ways, attention and the light, acts routed, reports, snapshot; changes in a script's batch told after it |
| the text as a zone | `packages/present/src/page_text.ts` (every text root gets its page); numbers to drag are the page's values (`tangle_hand.ts`); noun hover goes through the page (`text_wire.ts`); embedded figures and derivations with nouns join it; a `visual` block's `bind` | in the page (below) |
| text tools as entries | `packages/present/src/markup/` (registry, built-in tools, guides, check); `math.ts` renders a fence or inline tool a file adds | `test/markup.test.ts`: the guides, the tutor's words (identical to the hand-written prompt they replace), the check, a tool added by a file |
| one source for what models are told | `npm run catalog` writes `docs/TEXT-MARKUP.md`, `packages/ai/src/prompts/markup.generated.ts` (the tutor's prompt and the course format use it) and the library in `docs/CAPABILITIES.md` | `npm run catalog -- --check` |
| generated lessons' markup checked on the server | `apps/mathnim/server/studio/format.ts` runs `markup_issues` on every text string (the numbers of one step share their names) | the studio function still bundles small (92 KB, nothing of the DOM) |
| the gallery | `/engine` (`apps/mathnim/src/pages/engine.ts`): every entry by kind, experiments first; demos live (figures play and can be explored; text tools work: open the definition, drag the number) | looked at in the page |

Checked in the real page (headless Chrome, `page_shots.mjs`, the demo course's text page): the four numbers of a
sentence bound to `determinant_area` follow its script and its handles (dragging î moved `a` and `c` in the sentence),
and dragging the sentence's `a` moves the figure (area 4.20); hovering "parallelogram" turns the figure to it (the rest
recedes), hovering the parallelogram lights both words. Found on the way and fixed: a formula read inside a script's
batch kept a stale value (the page now tells its zones after the batch); the DOM mirror's words took the pointer over
a figure (the zone listens on the figure's box); `determinant_area` showed its collapse flash when the collapse was
not played.

Not yet, and why:

- The tutor still acts on the figure it is answering about (`side_chat.ts` → the player), not through the page; its
  `ACT:` vocabulary (`packages/ai/src/acts.ts`) is still written by hand. Next: generate it from `for_models('act',
  'tutor')` and route acts through `page.act`, so a new act reaches the tutor when it is promoted.
- Scene and world steps outside a text page have no page yet (the lesson view could make one per step).
- A second gesture (a sketched curve, magnetic bins) waits on a lesson that needs it; the protocol is ready for it.
- No page-level GPU host is needed yet: `kernel/gpu.ts` already shares one WebGL2 context and one WebGPU device.
