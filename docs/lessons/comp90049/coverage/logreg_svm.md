# Coverage: logreg and svm (decks 08-logisticregression, 09-svm)

File: `l_logreg_svm.py`. Lessons `comp90049-logreg` (25 steps) and `comp90049-svm` (25 steps). Slide numbers are the decks' own.

## Lecture 8, logistic regression -> `logreg`

| Slides | Knowledge point | Step |
|---|---|---|
| 4-6 | finding optima; recipe (derivative = 0); closed form vs iterative (no closed form, e.g. x e^x = 1) | `gd` |
| 7-9 | descending a function, intuition (1-D, 2-D) | `gd` |
| 10-13 | update rule, sign of the derivative, learning rate eta, several parameters, partial derivatives | `gd` |
| 14, 17 | gradient descent algorithm (single / multiple parameters), stopping | `gd` |
| 15-16 | learning rate too small / too large (worked toy table with four values of eta) | `gd` |
| 18-19 | convex, global vs local minima; guarantees of GD | `gd` (callout), `convex` |
| 21 | recap of naive Bayes as generative, model P(y given x) directly | `disc` |
| 22 | logistic regression: binary, probabilistic discriminative, no feature independence assumption | `disc`, exam question `q-disc` (lecture 23) |
| 23 | why not P = theta^T x (not bounded in [0,1]) | `why` (figure + quiz) |
| 24-26 | P > 0.5, odds > 1, log-odds > 0 equivalent; logit definition | `odds` (callout), `shape` |
| 27, 43 | regressing the logit; solving for p gives the sigmoid | `odds`, `sigmoid` (derivation with blank) |
| 28 | interpretation: z > 0 / = 0 / < 0 | `shape` |
| 29 | prediction and decision boundary, threshold 0.5 | `shape` (threshold quiz) |
| 30-31 | worked example: income data, theta = (-18, .12, .96, .1), test person -> sigma(-3.5) = 0.03 -> class 0 | `predict`; practice `q-prob` |
| 32-33 | likelihood, Bernoulli form p^y (1-p)^(1-y), log-likelihood, negative log-likelihood (cross-entropy) | `likelihood`, `ce`, `ce-feel` |
| 34 | gradient of the loss, no closed form, GD update on the sum form | `grad`, `gd`, `step` (one update on the deck's five rows), `q-update` |
| 35 | binary classifier, P(y=1) = e^z / (e^z + 1), 0.5 rule | `shape` |
| 36 | multiclass: one-vs-rest | `multi` |
| 37-39 | multiclass: softmax, three-class worked example (A 0.28, B 0.342, C 0.378) | `multi`, `softmax-ex` |
| 40 | generative vs discriminative (NB vs LR) | `disc` |
| 41 | pros: probabilistic, no restrictive assumptions, beats NB, frequency features; cons: linear only, feature scaling, needs data, regularisation | `procon`, `step` outro (scaling), `reg` |

Deeper (README table): cross-entropy from MLE (`likelihood`, `ce`); sigma' = sigma(1 - sigma) (`sig-deriv`); gradient (sigma - y) x_j line by line with a blank (`grad`); convexity via the Hessian (`convex`); regularisation, separable data and weight divergence (`convex` outro, `reg`); why not squared error with a sigmoid (`squared`, figure, numbers: gradient 400 times weaker, non-convex); softmax reduces to sigmoid at K = 2 and its gradient (`multi`, details). Exam practice: `q-prob`, `q-update` (number), `q-mse` (choice), `q-disc` (Section A text), `q-design` (Section C text). Review sheet: `remember`.

Notes: the deck's softmax example says x = [1, 2] but multiplies with (1, 1, 2): the bias input 1 is prepended to the two features (stated in the step). The worked gradient step uses eta = 0.001 because eta = 0.01 raises the loss from 0.815 to 25.3 on the unscaled features (shown in the outro: the deck's "feature scaling issues").

## Lecture 9, support vector machines -> `svm`

| Slides | Knowledge point | Step |
|---|---|---|
| 2-3 | roadmap; linear vs non-linear data (non-linear "not covered") | `idea`; kernels as an extra, flagged "beyond the deck" in `kernel` |
| 5-7 | classifier, linear classifier, discriminant, decision boundary = hyperplane, sign sides | `hyperplane` |
| 8-9, 49 | margin; distance from point to hyperplane; the y_i trick (positive for correct points) | `distance` (derivation with blank) |
| 10-11 | mistakes and margin; geometric margin = min distance | `idea`, `distance` outro |
| 13-14 | optimisation with constraints (min (z-1)^2 s.t. z >= 3, z* = 3; two variables) | `toy` (Lagrangian, complementary slackness on the one-variable example) |
| 16-22 | maximum margin classifier: maximise gamma, gamma = 1/||theta||, min ||theta||, min 1/2 ||theta||^2 s.t. y(theta.x) >= 1 (QP); margin lines at +1/-1, width 2/||w|| | `primal`, `width` |
| 23-24 | support vectors = active constraints; sparse solution; leave-one-out argument | `hard` (quiz), `kkt` |
| 25-27 | linear classifier with offset; offset can widen the margin; QP with offset | `hyperplane`, `hard` |
| 28-29 | hard-margin problems: outliers, label errors, no solution if not separable | `hard` |
| 31-34 | soft margin: slack variables, C, relaxed QP, margin still 1/||theta*|| | `soft`, `c` |
| 35-37 | three types of support vectors (xi = 0, 0 < xi < 1, xi > 1) | `soft` (table, figure), `q-sv` |
| 38-44 | examples with C = 100, 10, 1, 0.1; C affects the separable case too (C = 1, 0.1, 0.01) | `c` (figure with C = 100, 1, 0.1; separable-case remark), `q-c` |
| 45-46 | multiclass SVM: k parameter vectors learned jointly, margin 1 against every other class, argmax prediction | `multi` |
| 47 | other tasks: rating, ranking, structured prediction | `multi` |
| 48 | pros: max margin, convex, high dimensions; cons: outliers, non-separable, tune C, linear only | `procon` |
| 51 | classifier comparison | `compare` (SVM vs logistic regression vs perceptron) |

Deeper (README table): margin 2/||w|| derived (`width`); primal -> Lagrangian -> dual line by line (`lagrangian`, `dual`); why only support vectors have alpha > 0, KKT complementary slackness (`kkt`, `q-sv`); the dual solved by hand on the figure's data with primal = dual check (`check`, blank); data only in dot products, kernels (`kernel`); a numeric kernel example, (x.z)^2 equals an explicit dot product, XOR (`kernel-ex`); soft-margin dual with 0 <= alpha <= C (details in `c`); hinge loss from eliminating the slack, SVM = loss + penalty (`hinge`); SVM vs logistic vs perceptron by loss on the margin, figure (`compare`); a figure of the margin and support vectors (`idea`). Exam practice: `q-margin`, `q-kernel` (number), `q-c`, `q-sv` (choice), `q-text` (Section A text). Review sheet: `remember`.

Notes: the deck uses theta and theta_0; the lesson uses w and b as the README's notation table says, and says so in `hyperplane`. Kernels are explicitly outside the deck ("not covered"); the two kernel steps say so and are depth, not exam content.

## Sources beyond the decks (textbook-standard)

- Bishop, PRML: sec. 4.3 (logistic regression, cross-entropy gradient, IRLS Hessian), sec. 4.3.4 (softmax), sec. 7.1 (maximum margin, Lagrangian, dual, KKT, soft margin, kernels).
- Hastie, Tibshirani, Friedman, ESL: ch. 4.4 (logistic regression), ch. 12.2-12.3 (SVM as hinge loss plus penalty, kernels).
- Murphy, PML: logistic regression and SVM chapters (convexity, separable data and weight divergence, hinge vs logistic loss).
- Ng and Jordan (2002), "On discriminative vs. generative classifiers" (NB vs logistic regression with little vs much data).
- Cortes and Vapnik (1995), "Support-vector networks" (soft margin); Platt (1999) (probabilities from SVM scores, mentioned in a quiz feedback); Mercer's condition for valid kernels.
- Jurafsky and Martin, Speech and Language Processing, ch. 5 (named in the deck's references) for logistic regression and softmax.
