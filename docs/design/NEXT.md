# The next interface: one world, six materials (working draft, 2026-11-03)

Status: a design direction under test, built as a standalone specimen. Nothing in the site has changed.
Latest state and the next challenge: `docs/design/HANDOVER.md`.
The specimen is `docs/design/specimen/index.html`. To open it, run a static server in that folder. It has six
pages: home, an MPC lesson, an attention lesson, the material sheet, the lab, and the twenty motion effects.

## Where it comes from

- **Lucas's rules.** Design speaks before words. Restraint (克制) is an aesthetic logic, not fewness. Any material
  is allowed; fancy is fine; a hodgepodge is not. The page should be alive, with no mascot and nothing hand-drawn.
  It must be next-generation and not a mediocre middle. A child should understand it at a glance. It must never
  cost learning efficiency.
- **Seven designer lenses**: Apple, Victor, Ishii, Teenage Engineering, Vignelli/Rams/Hara, Duolingo/Kare/Brichter,
  Tufte/Ciechanowski.
- **A prediction of iOS in five years.** The interface becomes something that forms around intention and attention.
  Pointing at "this" becomes the main input. Chrome condenses into one living control. Generated UI must still feel
  authored. Learning becomes the place where the AI deliberately does not do it for you.
- **Two rounds of review.** Each round had a critic plus fresh eyes, with different models, working only from
  screenshots. Their findings are summarised under "The loop" below.
- **Open-source research.** The useful findings are listed in their own section.

## The logic in one line

**One world, one camera, one light. Every material means one thing in every course, and means what it means in
life.**

### The six core materials

| | Material | Means | Behaves |
|---|---|---|---|
| 物 | White study models (plaster) | A thing that exists in the lesson's world. | Lit by the one high light. Takes its pigment once you learn its name. |
| 影 | The view from straight above | The abstraction you read: the same world, seen from above. | The camera turns down, and a valley becomes contour lines. |
| 空心 → 实心 | Hollow / dashed → solid | Guessed or predicted → true. | Converges: the ring fills from its edge and the dashes close up. |
| 色 | Pigment | A noun: the same thing has the same colour everywhere. | Large forms get only a tint; small marks are pure. The chrome has no colour. |
| 镜 | Glass | Where your hand is: handles, the one control, the loupe. | Lifts on approach. Opens into a loupe when held. The fence pushes back. |
| 朱 | One vermilion button | The next thing to do, with a verb on it. | One per screen. It never means "wrong". |

### Rules

- One camera, used on every page: azimuth −0.5 rad, elevation 0.66 rad. There is one light, high and slightly
  left. A tile never gets its own angle.
- What you read faces you: either from straight above or front-on. Only things you merely look at may be shown in
  perspective.
- No glow, no gradients used as decoration, and no bevels.
- The page is quiet at rest and responds to touch. Nothing loops. Every animation can be interrupted.
- Colour follows learning: you learn a thing's name, and it takes its colour. On the home page, the parts you have
  understood are coloured.
- Graphite is only for scaffolding (axes, construction lines, removed material). Grey must never stand for the
  learner's own marks or for numbers, because grey reads as "disabled".

## What the specimen shows

**Home**
- Each course is its own small world: the MPC cart and wall, the LoRA layer slid out of the stack, the circle in
  sectors, the network with its packet, the market on a card.
- All of them use the same camera and the same light.
- The one vermilion button, "继续 · 约束", sits on the part you are about to learn.
- After you finish a lesson, the part you learned takes its colour and the cart moves once.

**MPC lesson 4: the valley**
- The cost is a white valley. The wall is an ochre fence, and the bottom of the valley is outside it.
- You place a hollow ring where you think the ball will stop, then press "看看". The ball rolls, hits the fence,
  slides along it and stops.
- The camera then turns to look straight down. The valley becomes the familiar QP picture, and water rising from the
  bottom shows each level set until it first touches the allowed region.
- If your guess was right, its ring fills in. If it missed:
  - your ring stays hollow, with a dimension line showing the gap;
  - the scale grows a fork;
  - the verb becomes "从你猜的地方放". A hollow ball released from your guess rolls to the same point: a convex
    valley has only one bottom.
- The class's guesses then fall like sand, marked as illustrative, so misconceptions show where most people
  guessed.

**Attention**
- The word that asks (它) is lifted above the sentence.
- Each line to another word is drawn as straight as the attention is strong.
- You tap a word to guess, and your guess shows as a dashed line.
- The reveal straightens the true lines, and word-sized bars show the shares.

**Asking, on any lesson**
- Point at a sentence. Crop marks converge onto it, and the island offers a suggested question.
- The answer is drafted onto construction baselines and forms phrase by phrase.
- While it forms, the figure itself points at what the answer is about: a teal wash on the fence, or on the
  「累」 line.
- In the MPC answer, the word 墙 flies from the picture into the formula λ墙 > 0.

**The island**
- It is the one glass control: ask, the engraved step scale with "4 / 9", the coloured dots of your questions, and
  the verb.
- It tucks away a little while you scroll.

**The material sheet** shows the six core materials, each with a live demonstration.

### The lab

**Ordinary materials (candidates)**

| Material | Means |
|---|---|
| Water | Its level is a level set: the shoreline is a contour, and the first contact with the allowed region is the optimum. |
| Thread | Lying on paper: straight is pulling (active), loose is not. |
| Tinted sheets | Overlap means both hold; no overlap means no solution. |
| Spring | Cost is stretch, ½d². |
| Sand | Probability is amount. |
| Light from straight above | The shadow is the projection. |

**Harder, more beautiful materials (candidates)**

| Material | Means |
|---|---|
| Caustics | Light squeezed together is brighter, by exactly 1/\|det J\|. A grid overlay shows the squeezing. |
| Liquid metal | A Gaussian mixture: blobs merge into one peak when they come close, and the number of peaks is read out. |
| Soap film | A minimal surface between two rings, coloured by real thin-film interference. Pull past separation ≈ 1.33 × radius and no minimal surface exists, so it breaks. |
| Iron filings | A vector field. |
| Night rain (Lucas) | Glowing drops strike out the outline of what cannot be seen. Each drop is a sample; marks take the noun colours. The wind turns with each shower, so a second shower reveals the other side. |

The night is a dark tray inside the light page: a window, not a dark theme.

**Learning interactions (candidates)**

| Interaction | What it does |
|---|---|
| Sketch your guess | Dashed, then the true curve converges; the gap is shaded and given in metres. |
| Confidence ring | The width of the interval is how sure you are; it fills if the truth falls inside. |
| Rewind | Drag time back and forth; the path walked is solid, the path ahead dashed; an ochre tick marks when the constraint becomes active. |
| Spot the error | One line of a derivation is wrong; tap it to see the error marked. |
| Teach-back | Explain in one sentence; the key ideas you mention turn from hollow to solid, with one hint for the one missing. |

## The loop

Each round runs these steps:
1. A specimen built in the real browser.
2. Automatic laws, run in the page: one vermilion element per screen, touch targets of at least 44 px on a phone,
   text contrast of at least 4.5:1, text at least 12 px, no instruction phrasing in lessons, illustrative numbers
   marked.
3. Fresh eyes: two to three models with no context look only at screenshots, with a child-level task script.
4. A critic, specifically hunting for the trendy, the tacky and the unfinished.
5. Decide, change the laws where needed, and run the next round.

**Round one** (v3: paper, ink and glass; plaster models; nine materials)
- Testers read the grey numbers and the grey handle as "disabled", the vermilion dot as a notification badge, and
  the scale as illegible. The attention lines were unreadable before the reveal.
- The critic found it too close to Ciechanowski, with isometric SaaS and Dribbble-like tiles, glassmorphism acrylic,
  a toy cart, a wood-looking wall, keycap-like word blocks, too many reds, a different camera on each tile, and too
  many materials.
- The critic's bold idea was to make abstraction the view from above of the world.
- Changes made: one camera and a higher light; six core materials; hollow/solid instead of grey/ink; a vermilion
  capsule button with a verb; no pinks; ink numbers; the valley and the camera turn; the attention fan; the scale
  given "4 / 9"; the island tucks while scrolling.

**Round two** (v4): results go here.

## What the open-source research suggests

**Borrow**
- Penrose (MIT) and the Vercel AI SDK's tool-to-component pattern (Apache-2.0): the tutor may only call typed
  material actions (raise water, pull a thread, show a projection, pour sand). Style comes from our grammar, so
  every answer happens in the world and looks authored.
- Victor's ladder of abstraction: abstraction is not only a camera turn. Time or a parameter can also be folded into
  trails, ghosts and contours.
- Kim, Reinecke and Hullman (CHI 2017) and Brod et al. (2018): the benefit of predicting comes from surprise, so
  draw the gap explicitly. Others' guesses should appear only after your own, as background.
- Butterfield and Metcalfe (2001), hypercorrection: errors made with high confidence are corrected best, so the
  confidence ring should amplify the reveal of a confident miss.
- Erroneous examples (Adams 2014; McLaren 2015): they work even though students like them less.
- Ink & Switch Crosscut: constraints drawn as objects, which supports thread meaning an active constraint.
- Evan Wallace's WebGL Water: rewrite the principle, never copy it (no licence). One height field can give
  contours, caustics and refraction together.
- Mafs: screenshot regression for visuals.
- OATutor: Bayesian knowledge tracing could decide when a part "takes its colour".

**Avoid copying**
- "You draw it" (NYT), and teacher sketch overlays (Desmos).
- 3D surface to contours (MathBox, 3b1b).
- Liquid-glass reproductions: glass must keep its single meaning.
- Ciechanowski's white models.

Our difference must be that every material and every camera move has an exact mathematical meaning, and that the
tutor acts in the same world.

## What this asks of the framework

**manim-web**
- A 2.5D scene layer:
  - an orthographic world camera shared by every scene, a single light, and contact plus cast shadows;
  - materials as data (model, card, fence, water, thread, glass), not as drawing code;
  - painter-sorted faces, and a height-field surface with level-set clipping (for water).
- A camera move between the world view and the top view. Read-only labels should fade in once the view is from
  above.
- Certainty as a mark state: `k` (hollow/dashed to solid), with convergence as an animation primitive.
- Parameter-space morphing: every frame must be a true state, never point interpolation.
- Picking on surfaces (ray against height field), handles with declared constraint sets (so rubber-banding is
  automatic), and a loupe that re-renders the scene.

**core**
- Predict-then-see as a step type: guess capture, reveal, ghost, gap measure, and the branch step grown from a miss.
- Guesses stored as learner data. The learner model decides which parts of a course world are coloured.

**visuals**
- Every visual exposes `ids` (already exists), `params` (already exists), and material roles for its parts, so text,
  formula, figure and tutor share noun colours.

**ai**
- The tutor answers through typed tools over the material grammar: `wash(id)`, `set(param)`, `raise_water(level)`,
  `pull(thread)`, `roll(from)`, `turn_view(top)`, with schemas validated on the server.
- Phrase-level streaming with deixis hooks.

**present**
- The single island, which replaces the bottom bar: scale, count, question dots, fork, verb slot, ask mode.
- Notes anchored to text ranges and figure ids.
- View Transitions between the course tile's world and the lesson.

**server / data centre**
- Collect guesses with their positions. The teacher view shows the class's guesses as sand (a misconception map)
  and calibration.

**Tooling**
- A taste lint in `npm run doctor` that runs the automatic laws above against every lesson, at desktop and phone
  sizes.
- Screenshot regression for visuals.

## Bold requirements (product)

- **The class's guesses as sand, live.** After you commit your own guess, the class's guesses fall onto the same
  figure. Teachers see the same map in the data centre.
- **The tutor acts in the world.** An answer can raise the water, pull a thread, or roll a ball from your guess. It
  never draws a generic chart.
- **Misses grow branches.** A wrong guess is replayed as a step generated from your own ghost. The scale shows the
  fork, so your path through a lesson is visible.
- **The camera as the ladder of abstraction, in every course:**
  - linear algebra: transform, then the top view as matrix columns;
  - probability: sand, then the histogram from the side;
  - networks: the routers, then the routing table from above.
- **Worlds ready for space.** Because every course is a lit model world under one camera, the same scenes can later
  sit on a real desk (visionOS) without redesign.
- **Authoring by grammar.** A course author or the AI composes a new step from the material dictionary, and the
  taste lint guards the result.

## Open decisions for Lucas

- Which lab materials join the core and which stay course-specific. Round two will recommend.
- Whether the night tray is acceptable as a material inside the one light theme.
- Highlighter colours: yellow and teal for questions replaces "a new colour per question", to keep reds rare.
- Whether to build the first real step in the site with the valley, which needs the 2.5D scene layer in manim-web.
