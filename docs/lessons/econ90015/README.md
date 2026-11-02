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

## Predicted exam questions (a sixth unit)

`predict.py` adds nine lessons (`econ90015-pq-*`, built by `build.py` with the rest): a start page and eight
questions written in the mock's style, each taught the same way (question as printed, part by part from the
ground up, every derivation line in words, a full-mark answer, the wider topic, your turn). The lessons are in
`pq_markets.py`, `pq_power.py` and `pq_macro.py`; titles, the answer-spreading helper (`mixed`) and the diagrams
in `pq_common.py`.

**Where the predictions come from** (2026-11-02): the subject's learning outcomes (Handbook 2026: markets;
economies of scale, scope and learning; market structures; game theory; measures of cost; external costs with
taxes, quantitative restrictions and tradeable permits; the macroeconomic environment and policy), and what the
lectures covered in recent runs, from the topic lists of students' notes (2022: GDP, supply and demand,
elasticities, welfare, externalities and taxes, production and cost, perfect competition, monopoly, non-uniform
pricing, oligopoly and game theory, growth; 2024 adds bundling, two-part pricing, money, inflation, interest rates,
fiscal and monetary policy). No lecture slides or past papers were seen: these are practice on the likeliest
topics, and the start page says so. Each lesson either goes deeper than a mock question or covers what it left out.

| Lesson | Question | Answers (checked with sympy) |
|---|---|---|
| pq-tax | per-unit tax and a price ceiling: $Q_d = 400 - 4p$, $Q_s = 6p - 100$, $t = 10$, ceiling 40 | $p = 50$, $Q = 200$, $\varepsilon_d = -1$, $\varepsilon_s = 1.5$; $p_b = 56$, $p_s = 46$, $Q = 176$; buyers bear 60%; revenue 1760, DWL 120; shortage 100, DWL 750 |
| pq-pollution | $p = 100 - Q/2$, $MPC = 10 + Q/2$, $MEC = 20$; permits with $MAC_1 = 2a_1$, $MAC_2 = 4a_2$, cut 60 | market 90 at 55; efficient 70 at 65; DWL 200; tax 20, revenue 1400; equal cuts 2700, permits 2400 ($a_1 = 40$, $a_2 = 20$, price 80, 10 permits traded) |
| pq-costs | $C = 100 + 4q + q^2$, 50 firms, $Q = 1300 - 25p$; recession $Q = 700 - 25p$ | shutdown 4, break-even 24 ($q = 10$); $Q_s = 25p - 100$; SR $p = 28$, $q = 12$, profit 44; LR 24, 70 firms; recession $p = 16$, loss 64 < 100: keep producing |
| pq-pricing | golfer $Q = 20 - p$, $MC = 4$; two types (casual $Q = 16 - p$); bundle values A (120, 40), B (90, 70) | single price 12, profit 64; two-part fee 128 at $p = 4$; two types: $p = 4$ gives 144 per pair, $p = 6$ (fee 50) gives 148 (the optimum); separate 260, bundle 320 |
| pq-oligopoly | $p = 140 - Q$, $MC = 20$ | Cournot 40 each, $p = 60$, 1600 each; Stackelberg 60/30, $p = 50$, 1800/900; cartel 30 each at 80, 1800; cheat to 45 earns 2025; Bertrand $p = 20$ |
| pq-games | matrix (50,50)/(10,70)/(70,10)/(30,30); entry tree (0,100), fight (−10,20), accommodate (30,50); capacity 60/45/10 | Low dominant, NE (Low, Low); cooperation if $\delta \geq 1/2$; SPE (Enter, Accommodate); threat not credible; invest (60 > 50) |
| pq-growth | $Y = A\sqrt{NK}$, $K = 100$, $y^* = 4$; $A$ 2 → 3; plague kills a third | $N^* = 25$, $Y = 100$; at first $Y/N = 6$, then $N = 56.25$, $Y = 225$; plague: $Y/N \approx 4.9$, back to 56.25. Maize example: Chen and Kung (2016), checked against the paper |
| pq-macro | pizzas and haircuts, 2024 and 2025; money +8%, real +3%, real rate 2% | nominal 2000 and 2760, real 2400, growth 20%; deflator 115, inflation 15%; used car, flour, pension no, new house yes; inflation 5%, nominal rate 7% |
