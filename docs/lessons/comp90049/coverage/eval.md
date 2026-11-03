# Coverage: evaluation (decks 10 and 11), file `l_eval.py`

Lessons: `comp90049-evaluation` (25 steps), `comp90049-bias-variance` (22 steps). Step ids below are within each lesson.

## Deck 10, Evaluation 1

| Slide | Point | Step |
|---|---|---|
| 3-4 | goal: perform well on unseen data; compare algorithms, choose hyperparameters (e.g. C of SVM) | `goal`, `three-sets` |
| 5-7 | why split; pipeline train / validation / test; assumptions (same distribution, independent samples) | `goal`, `three-sets` |
| 9-11 | evaluation methods; holdout (random, no overlap), typical splits 50-50, 80-20, 90-10 | `holdout` |
| 12-14 | holdout pros (simple, reproducible) and cons (split size, sampling bias, inefficient); weaknesses explained | `holdout` |
| 15-16 | stratification, pros and cons | `stratify` (with probability of an empty positive class, computed) |
| 17-19 | k-fold CV procedure, E = mean of E_i, pros/cons, LOOCV (k = N) | `kfold` |
| 20-21 | how big is k (fewer folds: more variance; more: slower); k = 10 common, 5 occasionally; stratified CV; when holdout vs CV (data scale, efficiency, bias/variance, tuning, goal) | `kfold`, `cv-tuning`, quiz |
| 23-25 | decision tree depth as hyperparameter; too short = 1-R, too deep = not generalise | `three-sets` (hyperparameters), `ck-leak` |
| 26-27 | data leakage when tuning on test; validation set; refit on train+validation, test once | `three-sets` (+ quiz), `ck-leak` |
| 28 | cross-validation for hyperparameter tuning (k blocks, average k scores) | `cv-tuning` |
| 31 | accuracy | `confusion` |
| 32-34 | confusion matrix TP/FN/FP/TN; not all errors are equal (FN virus, FP innocent) | `confusion` |
| 35-36 | recall, precision (formulas, close to 1 meaning) | `prec-rec` |
| 37-38 | accuracy vs precision/recall (1% disease, 99% accuracy); baselines Zero-R, One-R | `acc-fails` (derived: Acc = pi*recall + (1-pi)*specificity), `ck-imb`, `ck-design` |
| 39 | precision/recall inverse relationship, set up classifier for one or the other | `threshold` (figure, table) |
| 40-41 | F1 and the 4-instance example (acc 0.25, P 0.33, R 0.5, F1 0.398 = 0.4 exact) | `f1-derive`, `prec-rec` |
| 42-45 | multiclass confusion matrix; one interesting class vs the rest; Red/Blue/Gold example per class | `multi-setup` |
| 46-48 | macro and micro averaging, the example (P_M 0.11, R_M 0.17, P_mu = R_mu = 0.2) | `averages` |
| 49 | weighted averaging (P_W 0.132 -> exactly 2/15, R_W 0.2) | `averages` |
| 50 | comparing averaging methods (macro: all classes equal; micro: all instances, dominated by large; weighted) | `skewed` |
| 51 | the 230-instance example (macro R 0.42, micro 0.81, weighted 0.81) | `skewed` (plus precision, computed) |
| 53-58 | regression metrics: SSE (RSS, SSR), MSE, RMSE, MAE; comparison (outliers) | `reg-metrics`, `mean-median`, `ck-rmse` |
| 59 | scikit-learn metrics page | not covered (a link) |
| Added | specificity; F-beta; R^2; macro-F1 as average of F1; weighted recall = accuracy; micro-F1 = accuracy (proved); random subsampling; inductive learning hypothesis (Mitchell, cited on slide 60); MSE-mean / MAE-median | `prec-rec`, `f1-derive`, `reg-metrics` (details), `averages`, `micro-acc`, `holdout`, `goal`, `mean-median` |

## Deck 11, Evaluation 2

| Slide | Point | Step |
|---|---|---|
| 3 | recap of evaluation | `fit` |
| 4 | generalisation problem: underfitting, overfitting, appropriate fit | `fit`, `u-shape` |
| 6-9 | learning curve definition (x: sizes, complexity, iterations; training vs validation curve); Naive Bayes curve; example 1 split sizes 90-10...10-90; data trade-off | `learning-curves`, `read-lc` |
| 10-13 | polynomial of order D, phi(x) = [1, x, ..., x^D], D = 0..11 | `fit` (figure D = 1, 3, 9), `u-shape` (table D = 0..7) |
| 14-15 | model complexity (order, tree depth); overfitting definition; evidence: large train/test gap; underfitting: high error on both; error vs number of leaf nodes | `fit`, `u-shape` |
| 16 | other considerations: sampling bias, several instances per patient | `data-caveats` |
| 17-18 | expectations; discrete/continuous; Bernoulli example; average with infinite samples | `expectation` |
| 20-21 | bias (model, evaluation, sampling) and variance (model, evaluation) definitions | `meanings` |
| 22-23 | model bias in regression (mean signed error), unbiased, classification (label distribution, biased towards majority), Bias(f) = E[f_hat - f] | `meanings`, `ck-bias` |
| 24 | model variance: Var = E[(f_hat - E f_hat)^2]; high/low variance | `meanings` |
| 26-28 | generalisation error: Y = f + eps, E[(Y - f_hat)^2] = bias^2 + variance + irreducible | `decomp` (derived line by line, blank on the cross term), `numeric-bv` |
| 29 | bias inherent to model; variance: over-specialised; noise cannot be beaten; COMP90051 for classification theory | `decomp` (outro) |
| 30-31 | both high bias and high variance hurt; Zero-R has zero variance, high bias; lower both = better | `meanings`, `decomp` (outro) |
| 33 | bias-variance trade-off, bias falls and variance rises with complexity | `complexity-knob`, `u-shape` (figure) |
| 34-37 | diagnose with training/test error vs data size; quadratic example; high bias (more data won't help, high errors both); high variance (more data helps; gap) | `learning-curves`, `read-lc`, `ck-curve` |
| 39-40 | remedies: high bias (more complex model, add features); high variance (more data, reduce features, reduce complexity); lecture 23 adds boosting / bagging | `remedies`, `ck-bv-design` |
| 42-45 | evaluation bias and variance; metric as estimator; apparent vs true error; overfit the validation data | `eval-bv`, `eval-var` (SD = sqrt(p(1-p)/n) derived), `ck-bias-types` |
| 46 | controlling bias and variance: holdout size, k-fold, stratification, LOO | `controls`, `cv-tuning` |
| 47 | report mean and variance of fold scores (mu, 1/k sum (E_i - mu)^2) | `controls`, `ck-fold` |
| Added | k in k-NN and depth in trees as complexity knobs; k-NN variance sigma^2/k; shrinkage example (bias vs variance by hand); LOOCV variance caveat | `complexity-knob`, `ck-knnvar`, `numeric-bv`, `controls` |

## Textbook sources relied on (beyond the decks)

- Hastie, Tibshirani and Friedman, *ESL*, section 7.3 (bias-variance decomposition, k-NN regression error with variance sigma^2/k) and 7.10 (cross-validation; leave-one-out nearly unbiased but possibly high variance).
- Mitchell, *Machine Learning* (1997), ch. 2 for the inductive learning hypothesis (the deck cites Mitchell, ch. 3, on its summary slide).
- Standard definitions: specificity, F-beta, R^2, random subsampling, harmonic mean; the identity micro-P = micro-R = micro-F1 = accuracy for single-label problems.

## Notes and conventions

- The deck's rounded values are corrected to exact ones where rounding caused them (F1 0.398 -> 0.4; weighted precision 0.132 -> 2/15) and the step says so.
- Precision of an unpredicted class (0/0) follows the deck: 0.
- Simulations behind the figures and tables (polynomials fitted to f = sin 2 pi x plus noise sd 0.3, fixed seeds) are computed in `l_eval.py`, not typed.
- The deck's claim "LOO has lowest bias/variance in general" is given as the deck states it, with the ESL caveat in a note.
