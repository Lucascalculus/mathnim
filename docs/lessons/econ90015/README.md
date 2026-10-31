# ECON90015 mock exam, explained (demo course)

A generated-section demo (`apps/mathnim/public/demo/econ90015/`) made from one
mock exam (ECON90015 2026 S1, six questions, 100 marks), written by hand from
the exam and standard intermediate microeconomics; `build.py` here generates
the lessons and the course entry (run `python3 docs/lessons/econ90015/build.py`,
then `node apps/mathnim/tools/demo_check.mjs econ90015`, and for the figures
`npm run check -w @mathnim/visuals -- --only econ_quota,econ_monopoly_tax,econ_screening,econ_cournot,econ_malthus`).

## Who it is for, and what they need

- **Who**: a student preparing for this exam who has university maths
  (derivatives, solving equations) but has not taken the course.
- **What they need** (Lucas, 2026-10-31): to genuinely understand every idea
  behind these questions, taught from the beginning. Time is not the limit:
  the text is as long as the explanation needs, never shortened for speed.

## Structure: the learner's path through each question

An earlier version opened every lesson with "answers at a glance" and taught
the ideas before the student had seen the question, with derivations that were
bare lists of equations. Lucas rejected it: a student who has not seen the
question gets nothing from its answers, and cannot learn from two or three
lines and an unexplained formula. Every lesson now follows the learner:

1. **The question, as printed** (a `paper` block: the exam's English, the
   Chinese translation under it in the Chinese course), then a slow read: the
   story, what each formula and symbol says, what each part asks, which ideas
   it will need. No answers.
2. **Part by part.** Each part quotes its own wording again, then teaches the
   idea it needs from the ground up (why we need it, a concrete case with the
   question's numbers, the picture, then the formula and what each symbol in it
   means), then solves the part as a derivation whose every line is said in
   words above it (`say` on derivation lines; `why` stays for a deeper reason).
   One key step is left to the student (`blank`), and a small question in the
   page (`quiz`) catches a classic trap where the idea is taught.
3. **On the exam paper**: a full-mark answer in English (a `paper` block with
   `answer`), with a word on where the marks are.
4. **The wider topic**: what else the exam can ask (tariffs and licences,
   externalities, the short run and shutdown, monopoly deadweight loss and the
   Lerner rule, tax incidence, first degree and two-part tariffs, games,
   Stackelberg, cartel and Bertrand, Malthusian shocks), each taught, not listed.
5. **Your turn**: practice with new numbers.

Lessons go by idea, not question number, so each builds on the last: a short
start page (what each question is about as a story, why this order, the two
ideas that run through the paper), then markets (Q1), firms and costs (Q5),
one seller (Q2), many prices (Q3), two sellers (Q4), the whole economy (Q6),
and a method sheet with a timed drill to review.

Derivation lines are kept short enough to show at full size on a phone (about
40 characters of visible formula); a longer step is split into two lines.

Five interactive figures (`packages/visuals/src/econ/`, loaded through the
course entry's `packs`), each placed where dragging shows what words cannot:
the quota's areas and USF's welfare against the quota (`econ_quota`), a tax
that rotates or shifts the monopolist's demand and who pays (`econ_monopoly_tax`),
package 2's size against the information rent (`econ_screening`), best replies
closing in on the Cournot equilibrium (`econ_cournot`), and population along the
production curve with technology (`econ_malthus`). Q5 has a static entry diagram
instead: its cost function only makes sense near the minimum, so a slider for
the number of firms would show things the model cannot back.

## Answers (checked twice: each by a second method)

| Q | Answer |
|---|---|
| 1a | $p = 10$, $Q = 100$ |
| 1b | $p = 30$, $Q = 60$ |
| 1c | USF social benefit 3500 → 1500: worse off by 2000 (CS −1600, external benefit −400) |
| 2a | $Q = 108$, $p = 384$, profit 29,160 |
| 2b | $Q = 100$, seller gets 320, buyers pay 400, profit 21,000 |
| 2c | tax 80 per unit: buyers +16, monopolist −64 (bears 80%); government +8,000 |
| 3a | $Q_1 = 9$, $p_1 = 15$, $\varepsilon_1 = -5/3$; $Q_2 = 5$, $p_2 = 11$, $\varepsilon_2 = -2.2$; profit 106 |
| 3b | (18 units, \$254) and (2 units, \$30); profit 164 (one buyer of each type) |
| 4a | $q_1 = 120 - 0.25 q_2$, $q_2 = 192 - 0.4 q_1$ |
| 4c | $q_1 = 80$, $q_2 = 160$, $p = 26$ |
| 5a | long-run supply horizontal at $p = 125$ (each firm $q = 25$) |
| 5b | $Q = 1900$, $\varepsilon = -4 \cdot 125/1900 \approx -0.26$ (76 firms) |
| 6 | equilibrium where the ray of slope $y^*$ (subsistence) meets $Y = Af(N, K)$; immigration: $Y/N$ falls below $y^*$, population falls back to $N^*$ |
