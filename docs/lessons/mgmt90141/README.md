# MGMT90141 Business Analysis and Decision Making, taught for the exam

A demo course in the studio format (lesson JSON in `apps/mathnim/public/demo/mgmt90141/`, entry in
`apps/mathnim/public/demo/courses.json`), written in Python with `docs/lessons/lesson_kit.py`; the figures are
instruments (`docs/lessons/NEXT-LEARNING.md`, read it first). Status: **all 17 lessons built 2026-11-06 (see CHECKPOINT.md); not deployed.**

Sources (`~/Downloads/90141/`): twelve weekly decks (Week 1-10, 12, and the "additional constraints" deck for
week 4), the subject guide, the 2025 Semester 2 exam paper, the lecturer's revision deck with worked answers
(past papers S2-2016 to S2-2023), and a multiple-regression past paper with answers. Text extracted with
`pdftotext -layout` and a small OOXML reader; the decks keep several tables and the Solver reports as images, so
look at those pages when a lesson uses them.

## Who it is for, and what they need

- **Who**: a student sitting MGMT90141's final exam (2 November to 20 November 2026). They may have seen some of it
  in class; they must not need to have.
- **What they need most**: the exam is half formulation and report-reading (one compulsory LP question worth
  25, and most of the choose-three questions are LP too), the rest is decision trees, the normal curve and
  regression. They need to *get the model right when nobody tells them whether it is*, to read a sensitivity
  report without guessing, and to calculate by hand with a Casio fx-82 and a z-table. Every idea has to be
  understood, not memorised, because the numbers change every year.

## The exam (2 hours, closed book, handwritten, Casio fx-82; 100 marks)

Reading time 15 minutes. Section 1: one compulsory question, 25 marks. Section 2: three of four questions,
25 marks each (a fourth is not marked). "Show all working", "state your assumptions", "label accurately". A
formula sheet and the z-table are in the paper (EV, EVwPI, EVwoPI, EVPI, sample variance and SD, z, the
regression formulas, SSE/SST/SSR, r²); LP, Bayes, the binomial and the multiple-regression ideas are not given.
The 2025 paper: Q1 an LP given as a story, formulate it and answer five questions from its sensitivity report;
Q2 two LP formulations (production with overtime; blending with percentage limits); Q3 two network/scheduling LPs
(shift scheduling, transshipment); Q4 a payoff table, EVPI, Bayes' revision, the tree and the strategy; Q5 the
normal distribution (four parts) and simple regression (four parts). A multiple-regression question (output of
Excel, read it) is the other regression variant.

## How the course is ordered, and why

The deck goes LP, decisions, statistics, regression. The *learning* dependency is different, and so is the
marks' weight, so the course is built on five questions a manager asks, in this order:

1. **What should we make?** (LP, six lessons: the largest share of the marks)
2. **What are the chances?** (describing data, probability and Bayes: the ground the next two units stand on)
3. **What should we do when we do not know?** (payoff tables, expected value, perfect and sample information)
4. **How variable is it?** (distributions, the normal curve)
5. **What does the data say?** (simple and multiple regression)
6. **The paper itself** (method, the formula sheet, the 2025 paper run against the clock)

Each lesson follows the loop in NEXT-LEARNING.md: touch an instrument, predict, name, then the exam question
as printed (`paper` block) taught part by part with every derivation line said in words, then recall of two
earlier ideas. The question as printed comes *after* the learner has felt the idea, not before the lesson:
this is the change from ECON90015's structure, which taught each question in its own lesson.

## Lessons

| # | Slug | The question it answers | Decks it must cover | Instrument (new) | The exam question in it |
|---|---|---|---|---|---|
| 1 | `lp-picture` | What is a plan, and why does the best one sit in a corner? | W1: business analytics (descriptive, predictive, prescriptive), LP elements, deterministic model, the four steps, graphical solution, Shader Electronics; special cases (infeasible, unbounded, alternative optima, redundant) | `lp_plane` | |
| 2 | `lp-formulate` | How do I turn a story into a model I can trust? | W1: Shader, Consolidated Electronics (a minimisation); formulation steps; Solver and LINDO set-up (what the model must look like to go into a spreadsheet) | `lp_check` (solves the learner's model, shows witness plans) | 2025 Q1(i) |
| 3 | `lp-report` | What does the answer report tell me besides the plan? | W1, W2: reduced cost, shadow price, allowable increase and decrease, ranges of optimality and of feasibility; slack; max versus min signs | `lp_report` (every cell tied to the picture) | 2025 Q1(ii)-(vi) |
| 4 | `lp-patterns` | Which of six shapes is this problem? | W2: media selection (Warner Sisters), survey quotas (MSI), portfolio (ICT), tellers (HKBC), make or buy (Benson); past papers: overtime (Tucker), blending (Grand Strand), shift scheduling (Epsilon) | `lp_check` with problem text that lights up | 2025 Q2, Q3(i) |
| 5 | `network` | How do things flow, and what is a dummy? | W3: transportation, assignment, transshipment, unbalanced cases, workshops | `flow_net` | 2025 Q3(ii) |
| 6 | `integer` | Why can I not just round? What is a yes/no variable? | W4: integer, binary, mixed; capital budgeting; fixed-charge location (Martin-Beck); the additional constraints (if-then, either-or, k of n, big M) | `lp_plane` lattice mode, `lp_check` | |
| 7 | `describe-data` | How do I say what a pile of numbers looks like? | W7: mean, median, mode, percentiles, quartiles, range, IQR, variance, SD, the two suppliers (Dawson and Clark) | `dot_plot` | |
| 8 | `chances` | How do I count and combine chances? | W7: counting rules, three ways to assign probability, events, complement, union, intersection, mutually exclusive, conditional, independence, the MBA survey, the police promotion table | `area_table` | |
| 9 | `payoff` | What do I do when I cannot say how likely each future is? | W5: alternatives, states, payoff tables, optimistic, conservative, minimax regret, PDC, Southland | `payoff_dial` | |
| 10 | `expected-value` | What is information worth? | W5: probabilities, expected value, EVwPI, EVwoPI, EVPI, Hudson | `tree_bayes` (the crystal ball) | 2025 Q4(i)-(ii) |
| 11 | `sample-info` | How do I change my mind when the test comes back? | W6: Bayes' theorem and the tree flip, the decision tree and rollback, EVSI, efficiency, risk profile, Lin's land | `tree_bayes` (flip and rollback) | 2025 Q4(iii)-(v) |
| 12 | `random-variables` | What is the average of an uncertain number, and how spread out is it? | W8: discrete and continuous variables, probability distributions, expected value, variance, binomial, Carolina Industries, radar systems | `dist_lab` | |
| 13 | `normal` | How likely is "between these two"? | W8: normal, standard normal, z, the table both ways, the tyre guarantee, financial managers' pay | `normal_area` (reads the real table) | 2025 Q5(i)-(iv) |
| 14 | `regression` | How do I draw the best line, and how good is it? | W9: least squares, estimated equation, interpretation, r², r_xy, SSE/SST/SSR, Armand's Pizza, Excel and SPSS output, calculator method | `reg_lab` | 2025 Q5(v)-(viii) |
| 15 | `multiple-regression` | What changes with several predictors, and how do I read the output? | W10: multiple regression, R², adjusted R², correlation matrix, multicollinearity, F test, t tests; the Subaru paper | `reg_output` | Subaru past paper |
| 16 | `exam-method` | How do I spend two hours and a hundred marks? | the subject guide, the cover sheet, the formula sheet; marks per minute, the order to answer, what to write when stuck, assumptions | | whole 2025 paper |
| 17 | `drill` | Can I do it against the clock? | all | a timed set | |

W12 (class presentations) and the assignment material are not exam content; the first deck's assignment pages are
out of scope and noted as such in `coverage/`.

## The two instruments that matter most

- **`lp_check`.** The learner types constraints in the exam's own notation (`4x11 + 3x21 <= 600`); the page
  solves their model and compares it with the reference *by meaning*, not by text. For each limit of the real
  problem: "your model enforces it" or "your model allows this plan, which breaks it", with the plan. For each of
  the learner's lines: "this is a real limit" or "this rules out a plan that is allowed". The objective is
  compared by value on the plans. It marks like the paper does, per line. This is the one thing a student
  cannot get from a book: knowing whether their formulation is right.
- **`lp_report`.** The Solver sensitivity report beside the picture: touch any number and the picture shows what it
  means (a shadow price is the slope of the plan's value against that limit, true only inside the allowable
  stretch; an objective range is how far the profit line can turn before another corner wins). Then the paper's
  own "would the solution change if... / how much would the cost change if..." questions, answered by dragging
  and then by the rule.

## Details and traps to teach on purpose

- The unit of a decision variable and a constraint must agree (minutes with minutes); mixed units are the most
  common formulation error.
- `=` for a requirement met exactly (the 2025 Q1 demand), `<=` for a limit, `>=` for a minimum.
- Percentage limits become linear by moving everything to one side (`0.7 x11 - 0.3 x21 - 0.3 x31 <= 0`).
- Shadow price versus reduced cost; in a minimisation the sign flips; the allowable stretch is a promise only
  for one change at a time.
- Rounding an LP answer to get an integer answer can be infeasible or not optimal.
- Posterior is not the likelihood; the denominator is the sum of the joint probabilities.
- A normal probability is an area, never a height; table rows and columns split z into digits.
- r² is not "percent correct"; high R² does not mean causation; adjusted R² can fall when a variable is added.

## Writing the numbers

Every worked answer is computed in Python by the build script (the LP engine is also tested against a second
solver on every example), never by hand. The z-table in the course is the real one (Appendix 1 of the paper).

## Build

```bash
python3 docs/lessons/mgmt90141/build.py && node apps/mathnim/tools/demo_check.mjs mgmt90141
```

`coverage/<lesson>.md` lists, per lesson, every concept, example and number in its decks and the step that
teaches it. Slide order and wording are not kept.
