# Mathnim - product brainstorm and ranking

Mathnim is an AI math tutor whose explanations are live, interactive Manim
scenes (rendered in the browser by `manim-web`). This document lists every
feature idea from the brainstorm, scores them, and fixes what is built now.

## 1. Brainstorm

Each idea: what it is - why it helps (learning-science basis where relevant).

### Pedagogy (how people learn faster)
| ID | Feature | Why |
|----|---------|-----|
| P1 | **Predict -> observe -> explain checkpoints** (choice, number, sketch) before a reveal | Prediction creates a knowledge gap and makes the reveal memorable (POE; "generation effect") |
| P2 | **Misconception-tagged distractors** - every wrong option maps to a known misconception with its own short remediation scene | Targeted feedback beats "wrong, try again" (Hattie's feedback effect; diagnostic MCQs) |
| P3 | **Hint ladder**: nudge -> strategy -> worked step -> bottom-out | Keeps the learner doing the thinking; ITS literature (e.g. Cognitive Tutor) |
| P4 | **Worked-example fading** (completion problems) | Worked-example effect for novices, fading as expertise grows (Sweller, Renkl) |
| P5 | **Self-explanation prompts** ("which rule justifies this step?") | Self-explanation effect (Chi) |
| P6 | **Confidence rating** before checking; calibration feedback | Metacognition; hypercorrection effect (confident errors are corrected best) |
| P7 | **Retrieval practice + spaced review queue** | Testing effect and spacing effect - the two most robust findings |
| P8 | **Parameterised problem variants** (same structure, new numbers/shapes) | Enables interleaving and repeated retrieval without memorising answers |
| P9 | **Mastery model per skill** (Bayesian knowledge tracing) over a prerequisite graph -> adaptive next step | Mastery learning; no one is pushed on with a gap |
| P10 | **Concreteness fading** templates (concrete -> pictorial -> symbolic) | CPA progression (Bruner; Fyfe et al.) |
| P11 | **Estimate first** prompts | Number sense; checks answers for plausibility |
| P12 | **Explore before instruction** scenes (productive failure) | Kapur's productive failure |

### Interaction
| ID | Feature | Why |
|----|---------|-----|
| I1 | **Explorable parameters**: sliders / drag handles bound to ValueTrackers; formula, numbers and graph update together | "Explorable explanations"; learners see covariation directly |
| I2 | **Direct-manipulation geometry** with constraints (on a circle, on a line, snapping, integer lattice) | Dynamic-geometry learning (GeoGebra-style) inside the same scenes |
| I3 | **Sketch your prediction**: draw a curve or place a point, then compare with truth and score it | Graph-sense prediction is richer than multiple choice |
| I4 | **Click to ask**: tap any object ("what is this / why is it here?") | Questions anchored to the visual; object metadata grounds the AI |
| I5 | **Choose the next algebra step**; the chosen step animates, a wrong step shows why it fails | Active algebra; errors become visible |
| I6 | **Math answer input** with equivalence checking (2/4 = 0.5 = 1/2; x(x+1) = x^2+x) | Free response without false "wrong" |
| I7 | Timeline with chapters, replay-a-step, speed control | Learner control over pacing (segmenting principle) |
| I8 | Measurement tools (ruler, protractor, zoom lens, trace) | Investigation |
| I9 | Voice questions | Low friction for young learners |
| I10 | Touch gestures and full keyboard operation | Mobile and accessibility |

### AI
| ID | Feature | Why |
|----|---------|-----|
| A1 | **Syllabus -> lesson plan -> scenes** (LLM writes manim code, then it is validated) | Core promise of the product |
| A2 | **Visual answers to free-form questions** in seconds | Core promise |
| A3 | **Problem (text/photo) -> animated solution** | Core promise |
| A4 | **Scene linter**: off-screen, overlapping labels, tiny text, low contrast, too-fast timing; auto-fix loop | LLM-generated scenes fail mostly on layout; catching it without a human is the key to quality |
| A5 | **Scene description** from the scene graph (objects, positions, values) | Grounds the tutor in what is on screen; screen-reader text |
| A6 | Socratic tutor chat grounded in scene + learner model | Dialogue tutoring |
| A7 | Locate the error in handwritten work | Feedback on process, not just answer |
| A8 | **CAS verification** of every generated claim/answer | Math must never be wrong |
| A9 | Offline mode: pre-generated lessons and template answers when no model is available | Works without an API key; cheap |

### Content and authoring
| ID | Feature | Why |
|----|---------|-----|
| C1 | **Lesson format** (segments, narration, checkpoints, branches, interactions) usable by humans and LLMs | Single source of truth; makes generation reliable |
| C2 | **Visual idiom library** (unit circle, number-line ops, area model, function transforms, Riemann sums, vectors, probability tree, similar triangles, proof-by-picture...) | LLMs compose tested components instead of raw coordinates |
| C3 | Narration pipeline (TTS with word timings, captions, highlight sync) | Dual coding; accessibility |
| C4 | Localisation (zh/en, local notation conventions) | Market |
| C5 | Teacher editor / timeline | Authoring |
| C6 | Curriculum tags (Common Core, national syllabi) | Discoverability, alignment |

### Engagement, classroom, analytics, platform
| ID | Feature | Why |
|----|---------|-----|
| E1 | Progress map / skill tree | Visible progress, autonomy |
| E2 | Class mode: teacher-led sync, live prediction polls (histogram of votes) | Peer instruction (Mazur) |
| E3 | Streaks / XP (light touch) | Habit; risk of extrinsic-motivation traps |
| E4 | **Export** MP4/GIF/PNG, share link, embed | Distribution, homework |
| X1 | **Event log** (answers, hints, time, seeks) + learner dashboard | Measure learning; feeds P9 |
| X2 | A/B tests of pedagogy | Improve with evidence |
| F1 | Performance budget, mobile, device-pixel-ratio, workers | Real time on cheap devices |
| F2 | Themes (paper / glass / swiss / white - done) | Brand, focus |
| F3 | Offline PWA | Classrooms with poor internet |
| F4 | Accessibility: captions, reduced motion, colour-blind-safe palettes, keyboard, descriptions | Inclusion (also legal requirements for schools) |

## 2. Ranking

Scores 1-5. **Impact** on learning/product value, **Diff**erentiation vs.
existing tools, **Now** = feasible now (no API key needed, engine ready),
**Found**ation = other features depend on it.
Priority = 0.35 Impact + 0.20 Diff + 0.25 Now + 0.20 Found.

| Rank | ID | Feature | Impact | Diff | Now | Found | Priority |
|-----:|----|---------|:-----:|:----:|:---:|:-----:|:--------:|
| 1 | C1 | Lesson format + runtime | 5 | 3 | 5 | 5 | **4.60** |
| 2 | I1 | Explorable parameters (sliders, handles, live formulas) | 5 | 5 | 5 | 3 | **4.60** |
| 3 | P1 | Predict -> observe -> explain checkpoints | 5 | 4 | 5 | 4 | **4.60** |
| 4 | A4 | Scene linter (layout QA) | 4 | 5 | 5 | 4 | **4.45** |
| 5 | P2 | Misconception-tagged distractors + remediation | 5 | 4 | 5 | 3 | **4.40** |
| 6 | C2 | Visual idiom library | 5 | 4 | 3 | 5 | **4.30** |
| 7 | P9 | Mastery model (BKT) + prerequisite graph | 5 | 3 | 4 | 4 | **4.15** |
| 8 | I6 | Answer input + equivalence checking | 4 | 3 | 5 | 4 | **4.05** |
| 9 | P7 | Retrieval practice + spaced review | 5 | 3 | 4 | 3 | **3.95** |
| 10 | A5 | Scene description | 3 | 4 | 5 | 4 | **3.90** |
| 11 | I2 | Constrained direct manipulation | 4 | 4 | 4 | 3 | **3.80** |
| 12 | I3 | Sketch your prediction | 4 | 5 | 4 | 2 | **3.80** |
| 13 | A8 | CAS verification | 5 | 3 | 3 | 3 | **3.70** |
| 14 | P3 | Hint ladder | 4 | 3 | 5 | 2 | **3.65** |
| 15 | A1 | Syllabus -> lessons | 5 | 5 | 1 | 3 | **3.60** |
| 16 | A2 | Visual answers to questions | 5 | 5 | 1 | 3 | **3.60** |
| 17 | P8 | Parameterised variants | 4 | 3 | 4 | 3 | **3.60** |
| 18 | C3 | Narration + captions sync | 4 | 3 | 4 | 3 | **3.60** |
| 19 | X1 | Event log + dashboard | 3 | 2 | 5 | 4 | **3.50** |
| 20 | A3 | Problem -> animated solution | 5 | 4 | 1 | 3 | **3.40** |
| 21 | I5 | Choose the next algebra step | 4 | 4 | 3 | 2 | **3.35** |
| 22 | I4 | Click to ask | 4 | 5 | 2 | 2 | **3.30** |
| 23 | P4 | Worked-example fading | 4 | 3 | 3 | 2 | **3.15** |
| 24 | P6 | Confidence rating | 3 | 3 | 5 | 1 | **3.10** |
| 25 | I7 | Chapters, replay, speed | 3 | 2 | 5 | 2 | **3.10** |
| 26 | E4 | Export video/image, embed | 3 | 3 | 4 | 2 | **3.05** |
| 27 | A6 | Socratic tutor chat | 5 | 3 | 1 | 2 | **3.00** |
| 28 | P5 | Self-explanation prompts | 4 | 2 | 4 | 1 | **3.00** |
| 29 | P10-12 | CPA / estimate-first / explore-first templates | 4 | 3 | 3 | 1 | **2.95** |
| 30 | E2 | Class mode + live polls | 4 | 3 | 2 | 2 | **2.90** |
| 31 | I8 | Measurement tools | 3 | 3 | 4 | 1 | **2.85** |
| 32 | F4 | Accessibility bundle | 3 | 2 | 4 | 2 | **2.85** |
| 33 | C4 | Localisation | 3 | 2 | 4 | 2 | **2.85** |
| 34 | A7 | Error in handwritten work | 4 | 4 | 1 | 1 | **2.65** |
| 35 | E1 | Progress map | 3 | 2 | 4 | 1 | **2.65** |
| 36 | F1/F3 | Performance, mobile, PWA | 3 | 1 | 3 | 3 | **2.60** |
| 37 | C5 | Teacher editor | 3 | 2 | 2 | 2 | **2.35** |
| 38 | X2 | A/B tests | 2 | 2 | 3 | 2 | **2.25** |
| 39 | E3 | Streaks/XP | 2 | 1 | 4 | 1 | **2.10** |
| 40 | C6 | Curriculum tags | 2 | 1 | 4 | 1 | **2.10** |
| 41 | I9 | Voice input | 2 | 2 | 3 | 1 | **2.05** |

Ties are broken by Impact.

## 3. What gets built now (P0)

Chosen by priority and by what works without an API key:

1. **C1 Lesson format + runtime** - `@mathnim/lesson`: a lesson is a list of
   steps (scene segments, narration, checkpoints, branches); the runtime plays
   manim-web scenes, pauses at checkpoints, branches on answers, logs events.
2. **I1/I2 Explorables** - sliders and drag handles bound to ValueTrackers,
   with constraints (segment, circle, curve, grid snap) and live formulas.
3. **P1/P2/P3 Checkpoints** - prediction checkpoints (choice / number /
   expression / sketch) with misconception-tagged options, remediation
   branches and a hint ladder; confidence rating (P6, cheap).
4. **I6 Answer checking** - expression parser + equivalence by symbolic
   normalisation and randomized numeric evaluation.
5. **I3 Sketch prediction** - draw a curve on the canvas, scored against the
   true graph.
6. **P9/P7 Learner model** - per-skill Bayesian knowledge tracing plus a
   spaced-review queue (FSRS-like intervals), stored locally.
7. **A4/A5 Scene linter + scene description** - geometric QA over the scene
   graph (off-frame, overlaps, text size, contrast, crowding) and a textual
   description for AI grounding and screen readers.
8. **P8 Variants** - seeded parameter generators for checkpoints.
9. **X1 Event log** - every interaction as a structured event (xAPI-like).
10. **C2 Idiom library, starter set** - the tested components the demo lessons
    need (angle with arc and live label, function explorer = axes + graph +
    parameter sliders, number-line jumps, area model); the same components are
    what an LLM will later compose.
11. **I7/E4 Player chrome** - chapters, replay step, speed; export frames/video
    (MediaRecorder) from the browser.

Next (P1, needs a model or more content): A1-A3 generation pipeline with the
linter + CAS (A8) in the loop, the full C2 library, C3 narration port, A6 tutor
chat, E2 class mode.
