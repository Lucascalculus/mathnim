# COMP90049 Introduction to Machine Learning, in depth

A demo course in the studio format (lesson JSON in `apps/mathnim/public/demo/comp90049/`, entry in
`apps/mathnim/public/demo/courses.json`), written in Python the way ECON90015 and COMP90007 are. The source is
the subject's 21 lecture decks (COMP90049, Semester 2, 2026, University of Melbourne); their extracted text is
listed under "Sources" below. The course does not follow the decks: it covers every knowledge point and exam
point in them, in the order the ideas build on each other, and goes further where the decks stop.

```bash
python3 docs/lessons/comp90049/build.py && node apps/mathnim/tools/demo_check.mjs comp90049
node apps/mathnim/tools/demo_check.mjs comp90049 knn,trees      # only some lessons
```

## Who it is for, and what they need

- **Who**: Lucas. He has studied machine learning before and is reviewing COMP90049 for its final exam.
- **What he needs** (his words, 2026-11-04): "带着我过一遍，并深入一些公式推导和深入话题" — a guided pass over
  everything, and depth in derivations and deeper topics. Not taught from zero; not the slides' order.
- **The exam** (lecture 23): 2 hours, closed book, pen and paper, a non-programmable calculator. Formulas are
  given next to each question **except probability**; what is tested is understanding a formula and using it.
  Section A: short answers (explain or compare, 1-3 lines, some small calculations). Section B: method
  questions like the workshops (calculations, working shown). Section C: design and application questions like
  the assignments (a third of a page or more). Lecture 23 says: memorise concepts, practise logs on the
  calculator, write nothing irrelevant.

## Structure of every lesson (a quick review that goes deep)

Not a first course, so no prediction questions up front: the method and its purpose first, the traps where
they occur, practice at the end. A good default arc (break it when the idea asks for it):

1. **What it is for, and the picture** (one `read` page): the problem the method solves, the one idea in a
   sentence or a diagram, and where it sits among the other methods. Short: the learner has seen it before.
2. **The mechanics, each formula with what each term does** (`read` pages, `math` blocks, a table or an SVG).
3. **The derivations** (`derive` steps): every line has `say` (what the step does, what new symbols mean);
   `why` for a deeper reason. One `blank` per lesson where a line is short and natural to fill in.
4. **A worked exam-style calculation** (Section B style): small numbers, by hand, logs where the exam uses them
   (log base 2 for entropy), each step said in words. Use the decks' own worked examples or ones like them.
5. **Deeper** (a chapter of its own): the derivation or topic the slides only gesture at, done properly (see
   the lesson table). Rigour, not trivia.
6. **Traps**: one or two in-page `quiz` blocks where a classic mistake happens.
7. **Exam practice** (end): 3-6 checkpoints — `number` for Section B calculations (state rounding; give a
   tolerance), `choice` with feedback on every wrong option naming the misconception, and at least one `text`
   question answered in 1-3 lines as Section A asks (key points the marker looks for, a model answer in
   English). Where the topic invites it, one Section C style design question (`text`).
8. **What to remember** (a last `read` page): the formulas and comparisons on one screen, the way a review
   sheet would have them.

Chapters (`chapter=` on the first step of each) group these. 12-25 steps per lesson, 25-45 minutes.

## Writing

- Bilingual: every learner-facing string is `T(en, zh)`. Write the Chinese natively (not translated), short
  sentences. Keep the English term beside the Chinese the first time it appears in a lesson
  (信息增益 (information gain)), because the exam is in English. Model answers to `text` questions are in
  English in both languages (the exam is written in English), with the Chinese explanation around them.
- Purpose and intuition before formulas; say what each term does before deriving (TASTE §1). No walls of
  text: a page carries one idea; details go in `details` blocks.
- Derivation lines short enough for a phone (about 40 characters of visible formula); split longer steps.
- Numbers must be right: compute every worked answer in Python while writing (the build script can do the
  arithmetic, as ECON90015's does), never by guess.
- No sentences in figures: labels on things only. SVGs drawn with `Fig`/`drawn` (`ml_kit.py`) or `Plot`
  (`lesson_kit.py`), one per language via `drawn`, white background, text at least 14 units.
- No instructional copy about the interface ("click here to…").

## Notation (every lesson agrees)

| | |
|---|---|
| instance, features | $\mathbf{x} = (x_1, \dots, x_F)$, label $y$; $N$ training instances $(\mathbf{x}^{(i)}, y^{(i)})$ |
| parameters | $\boldsymbol{\theta}$ (weights $\theta_1..\theta_F$, bias $\theta_0$ with $x_0 = 1$), as the decks write them |
| classes | $c_j \in C$; prediction $\hat{y}$ |
| linear score | $z = \boldsymbol{\theta}^\top \mathbf{x}$; sigmoid $\sigma(z) = 1/(1 + e^{-z})$ |
| loss, learning rate | $L(\boldsymbol{\theta})$, $\eta$ |
| entropy | $H(X) = -\sum_x P(x)\log_2 P(x)$ (log base 2, bits) |
| SVM | $\mathbf{w}, b$, labels $y \in \{-1, +1\}$, slack $\xi_i$, cost $C$, multipliers $\alpha_i$ |
| neural nets | layer $l$, pre-activation $z^{(l)}$, activation $a^{(l)} = g(z^{(l)})$, error term $\delta^{(l)}$ |

## Lessons

Each lesson file `l_<group>.py` exports `LESSONS = [function, ...]`; each function returns
`dict(id=lid('<slug>'), title, description, minutes, skills, misconceptions, steps)`. Skill ids are
`<slug>.<point>`. Each writer also keeps `coverage/<group>.md`: every knowledge point and exam point in its
decks, and the step that teaches it.

| Unit | Slug | Decks | Deeper topic (at least) | File |
|---|---|---|---|---|
| Foundations | `start` | 23 | the exam; the model map (probabilistic/geometric, discriminative/generative, linear/non-linear, parametric/non-parametric) with every model placed | `l_exam.py` |
| | `concepts` | 02 | inductive bias; why generalisation, not training fit, is the goal; discretisation choices | `l_basics.py` |
| | `probability` | 04 | Bayes from the definition; MLE of a Bernoulli/categorical by derivative; entropy as expected surprise | `l_basics.py` |
| Classic classifiers | `knn` | 03 | curse of dimensionality (distances concentrate); why scaling matters; k as a bias-variance knob | `l_knn_trees.py` |
| | `trees` | 05 | information gain = mutual information; why gain ratio; overfitting and pruning; regression trees | `l_knn_trees.py` |
| | `naive-bayes` | 06 | Laplace smoothing as a prior (MAP with a Dirichlet); NB is linear in log space; underflow and logs | `l_nb_linreg.py` |
| Linear models | `linreg` | 07 | normal equation by matrix calculus; least squares = MLE under Gaussian noise; gradient descent | `l_nb_linreg.py` |
| | `logreg` | 08 | cross-entropy from MLE; the gradient $(\sigma - y)x$ line by line; convexity; why not squared error; softmax | `l_logreg_svm.py` |
| | `svm` | 09 | margin $2/\lVert w\rVert$ derived; primal → Lagrangian → dual; support vectors from KKT; kernels; soft margin and hinge loss | `l_logreg_svm.py` |
| Evaluation and features | `evaluation` | 10 | micro/macro/weighted averages by hand; stratified and k-fold cross-validation; regression metrics | `l_eval.py` |
| | `bias-variance` | 11 | the bias-variance decomposition derived; learning curves read; evaluation bias and variance | `l_eval.py` |
| | `features` | 12 | PMI, MI, chi-square by hand; wrapper cost in model fits; filters vs wrappers vs embedded (L1) | `l_features_anomaly.py` |
| Neural networks and ensembles | `perceptron` | 13 | the update rule as SGD on a loss; convergence on separable data; XOR | `l_nn.py` |
| | `mlp` | 14 | why depth needs non-linearity (a stack of linear layers is linear); activations; universal approximation in words | `l_nn.py` |
| | `backprop` | 15 | the generalised delta rule derived with the chain rule; a full numeric forward and backward pass | `l_backprop_ens.py` |
| | `ensembles` | 16 | why averaging reduces variance (correlation term); AdaBoost's weights derived; bagging vs boosting vs stacking | `l_backprop_ens.py` |
| Beyond supervised learning | `clustering` | 17 | k-means as coordinate descent (why it converges, why local optima); linkages by hand; WCSS/BCSS/CH index | `l_unsup_semi.py` |
| | `semi` | 19 | self-training's failure mode (confirmation bias); active learning query strategies; the assumptions semi-supervised learning needs | `l_unsup_semi.py` |
| | `self` | 20 | contrastive loss (InfoNCE) term by term; pretext tasks; why representations transfer | `l_self_fair.py` |
| | `anomaly` | 21 | statistical, proximity, density (LOF), clustering-based scores by hand; why anomalies break supervised learning | `l_features_anomaly.py` |
| | `fairness` | 22 | the fairness criteria as conditional probabilities; why they conflict (base rates); pre/in/post-processing | `l_self_fair.py` |
| Before the exam | `drill` | all | a method sheet; Section A, B and C practice across the course | `l_exam.py` |

`build.py` owns the units and the course entry; it imports every `l_*.py` it finds (one that fails to import is
skipped with a message, so writers do not block each other) and writes each lesson and the entry atomically.

## Sources

The decks (`~/Downloads/<nn>-<name>.pdf`, lecturer Ting Dang and colleagues, COMP90049 S2 2026) and their
text extracted with `pdftotext -layout`. Facts beyond the decks are textbook-standard (Bishop, *PRML*;
Hastie, Tibshirani & Friedman, *ESL*; Murphy, *PML*; the original papers for InfoNCE, LOF and AdaBoost), named
in the coverage notes where a lesson relies on them.
