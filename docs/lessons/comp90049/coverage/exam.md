# Coverage: lecture 23 (recap and exam) -> `start` and `drill` (file `l_exam.py`)

## Lecture 23 -> where it appears

| Lecture 23 lists | Step |
|---|---|
| 2 h + 15 min reading, closed book, pen and paper, non-programmable calculator | `start` / `exam` |
| 100 marks, 50% of the grade, attempt all questions, questions weighted differently | `start` / `exam` (+ minutes per mark, computed: 120/100) |
| Section A (1-3 lines; explain/compare; small calculations), B (like workshops; show calculations or logic), C (like assignments; a third of a page or more; attempt last) | `start` / `exam` (table); `drill` / `a_intro`, `b_intro`, `c_intro` |
| Formulas provided except probabilities; tests understanding and use of a formula | `start` / `formulas` (+ quiz) |
| Recommendations: time/effort, test yourself, memorise concepts, logs on the calculator, do not get stuck, do not write irrelevant things | `start` / `formulas`; `drill` / `sheet1` (log table), `how` |
| Three ingredients: data (discrete/continuous, big/small, labelled/unlabelled, public/sensitive), models, learning (supervised, unsupervised, semi-supervised and active, self-supervised) | `start` / `ingredients` |
| Probabilistic vs geometric (NB, LR, GPT-style LMs / k-NN, SVM, perceptron) | `start` / `taxonomy` (figure, quiz), `table` |
| Discriminative vs generative (LR, SVM, DT, MLP / NB, LLMs) | `start` / `taxonomy`, `table`; `drill` / `a1` |
| Linear (NB, LR, perceptron, linear SVM) vs non-linear (k-NN, DT, MLP, kernel SVM), with the reason | `start` / `table` (why NB is linear, with the log-odds derivation) |
| Parametric (NB, LR, MLP) vs non-parametric (k-NN, DT, SVM); "what is non-parametric about k-NN / DT / max depth" | `start` / `table` (reasons, max depth, SVM note, the lecture's definition callout) |
| Recap II-VII (NB incl. smoothing, LR, perceptron, SVM, k-NN, DT, MLP and backprop, ensembles, choosing an algorithm, evaluation, learning curves, bias/variance remedies, feature selection, semi-/self-supervised, clustering, anomaly detection, fairness) | Taught in the lessons of those topics; `start` / `course` maps each to its lesson; `drill` tests each (below) |

Models not placed by lecture 23 (marked † in the table): k-NN and perceptron on discriminative/generative, perceptron on parametric, linear regression and ensembles entirely; decision trees, MLP and ensembles on probabilistic/geometric are left as "—". The entries are the standard textbook answers.
SVM is listed non-parametric by the lecture (dual form, support vectors) and linear for the linear kernel; the lesson says the axes are independent.

## Drill: what each question tests

| Step | Tests | Lecture |
|---|---|---|
| `sheet1`-`sheet3` | the twelve calculation families, formula + check | 03, 05, 06, 08, 09, 10, 11, 12, 13, 15, 16, 17 |
| `a1` | generative vs discriminative | 23 (II), 06, 08 |
| `a2` | why NB is "naive", what factorisation buys | 06 |
| `a3` | zero counts, Laplace smoothing, bias/variance cost | 06 |
| `a4` | bagging vs boosting | 16 |
| `a5` | why k-fold CV, stratification | 10, 11 |
| `a6` | why the perceptron rule cannot train an MLP; backprop | 13, 14, 15 |
| `a7` | filter vs wrapper | 12 |
| `a8` | k-means local optima, restarts | 17 |
| `a9` | equalised odds vs equal opportunity | 22 |
| `b1` | entropy, information gain | 05 |
| `b2` | split information, gain ratio | 05 |
| `b3` | naive Bayes with Laplace smoothing, binary features | 06 |
| `b4` | distance, inverse-distance weighted k-NN vs majority | 03 |
| `b5` | logistic regression forward pass and one gradient step | 08 |
| `b6` | perceptron update | 13 |
| `b7` | SVM margin width | 09 |
| `b8` | macro-F1 (and micro = accuracy) from a confusion matrix | 10 |
| `b9` | PMI | 12 |
| `b10` | one k-means iteration | 17 |
| `b11` | AdaBoost error, alpha, normalised weights | 16 |
| `b12` | full backprop step (sigmoid, cross-entropy), derive with a symbolic blank for the hidden error term | 14, 15 |
| `c1` | Section C: method + evaluation under class imbalance and few labels (also semi-supervised/active, feature selection, leakage) | 10-12, 19 |
| `c2` | Section C: diagnose a learning curve, remedies for variance, contrast with bias | 05, 11, 16 |

Not drilled on purpose (taught and practised in their own lessons): anomaly detection, self-supervised learning, linkage by hand (on the method sheet), regression metrics, softmax.
