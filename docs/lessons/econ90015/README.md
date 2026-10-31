# ECON90015 mock exam, explained (demo course)

A generated-section demo (`apps/mathnim/public/demo/econ90015/`) made from one
mock exam (ECON90015 2026 S1, six questions, 100 marks), written by hand from
the exam and standard intermediate microeconomics; `build.py` here generates
the lessons and the course entry (run `python3 docs/lessons/econ90015/build.py`,
then `node apps/mathnim/tools/demo_check.mjs econ90015`, and for the figures
`npm run check -w @mathnim/visuals -- --only econ_quota,econ_monopoly_tax,econ_screening,econ_cournot,econ_malthus`).

## Who it is for, and what they need

- **Who**: a student about to sit this exam who has university maths
  (calculus, solving equations) but has seen little of the course.
- **Situation**: a quick review before the exam, not a first course.
- **Needs, in order**: the whole exam on one page; for each kind of question a
  method that reliably earns the marks, explained in the maths they know; the
  traps that lose marks; the twists a real exam can add (the numbers will be
  different); practice with new numbers at the end.

## Structure (and why it is not the exam's)

The goal (Lucas, 2026-10-31): a learner who barely knows the course sees, as
fully and as fast as possible, every idea behind these questions, each one
explained clearly; about 48 hours of review.

- By idea, not by question number: markets (Q1, Q5), market power (Q2, Q3, Q4),
  growth (Q6), so each lesson builds on the last; a map first, a method sheet
  and a timed drill last.
- Every lesson has the same five parts: **In short** (the answers, and the few
  ideas the question needs), **The ideas** (each from the ground up), **Worked
  solution** (line by line, one simple line left to fill in), **The wider
  topic** (what else this kind of question asks, worked with the same numbers:
  tariffs and quota rent, Pigou, shutdown and entry, elasticity and spending,
  monopoly deadweight loss and incidence, first degree and two-part tariffs,
  games and the prisoner's dilemma, Stackelberg, cartel, Bertrand, Malthusian
  shocks), and **Your turn** (two or three questions with new numbers).
- No "answer it first" questions up front. Small questions in the page
  (`quiz` blocks) catch one classic trap per idea where it is explained; they
  never block reading.
- Five interactive figures (`packages/visuals/src/econ/`, loaded through the
  course entry's `packs`), each where dragging shows something the text cannot:
  the quota's areas and USF's welfare against the quota (`econ_quota`), a tax
  that rotates or shifts the monopolist's demand and who pays (`econ_monopoly_tax`),
  package 2's size against the information rent (`econ_screening`), best replies
  closing in on the Cournot equilibrium (`econ_cournot`), and population along the
  production curve with technology (`econ_malthus`). Q5 has a static entry diagram
  instead: its cost function only makes sense near the minimum, so a slider for
  the number of firms would show things the model cannot back.
- Exam vocabulary in English stays visible in the Chinese text (the exam is in
  English).
- Beyond the exam, only where it deepens the idea: in Q1 the free-market
  quantity is exactly USF's optimum (the externality and USF's buying power
  cancel); in Q2 a percentage tax raises more than a per-unit tax of the same
  size; in Q3 the profits of uniform, third-, second- and first-degree pricing
  side by side; in Q4 cartel, Stackelberg, Cournot and competition with Q4's
  own numbers.

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
