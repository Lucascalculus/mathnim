# Coverage: backprop and ensembles (decks 15 and 16)

Slide numbers are the numbers printed on the slides. Step ids are in `l_backprop_ens.py`
(lesson `backprop`: `comp90049-backprop`; lesson `ensembles`: `comp90049-ensembles`).

## Lesson `backprop` (deck 15-backprop, 48 slides)

| Slide(s) | Point | Step |
|---|---|---|
| 2-5 | roadmap; recap perceptron and MLP structure | `why` |
| 6 | binary classification: sigmoid output, binary cross-entropy | `why` (table, details: sigmoid + BCE gives delta = y - a) |
| 7 | multiclass: softmax, categorical cross-entropy (only the true class counts) | `why` (table, details) |
| 8 | regression: linear output, MSE | `why` (table) |
| 9-11, 42-45 | activation functions sigmoid, tanh, ReLU and their derivatives; derivative = how much output moves when z moves | `activations` (table, two figures, derivative of the sigmoid in details) |
| 44 | tanh: larger updates than sigmoid | `activations` (table), `landscape` (vanishing gradients) |
| 45 | ReLU derivative undefined at 0, set to 0; helps delete unnecessary weights | `activations` (table) |
| 46-47 | why the step function cannot be used (derivative 0 or undefined, no update) | `activations` (quiz), `q_design` |
| 12-14 | supervised learning loop; optimise every weight by gradient descent, theta <- theta + Delta theta, Delta theta = -eta dE/dtheta | `why`, `algorithm` |
| 15-17 | perceptron rule needs y; only the output layer has targets; backprop = efficient partial derivatives of E for every weight | `why`, `q_hidden_target` |
| 18-24, 34-40 | demo: receive input, forward pass, error (delta), backward pass, weight updates for all theta, update | `algorithm` (list), `net`, `forward`, `backward`, `update`, `check` |
| 26 | model definition: z_i = sum theta a, sigmoid, E = 1/2 (y - a)^2 | `delta_out` (intro) |
| 27-29 | output layer derivation by the chain rule | `delta_out` |
| 30 | generalised delta rule: Delta theta = eta delta_i a_j, delta_i = (y - a_i) g'(z_i); error term times incoming activation; only for output units; backpropagate the deltas | `delta_out`, `q_delta_out` |
| 31-33 | hidden layer: Delta theta^1_jk = eta delta_j a_k with delta_j = g'(z_j) sum_i theta_ij delta_i (delta_j sums over all i fed by j) | `delta_hidden` (with `blank`), `matrix`, `q_delta_hidden` |
| 41 | the full algorithm: design, initialise, repeat (forward, error, backward, update all at once) until stopping criterion | `algorithm`, `sheet` |
| 48 | summary: estimation of MLP parameters, gradient descent, backprop as efficient gradients by reusing the deltas | `cost`, `sheet`, `q_bp_role`, `q_explain` |

Beyond the deck (standard textbook, Bishop *PRML* ch. 5, Goodfellow et al. *Deep Learning* ch. 6 and 8):

| Point | Step |
|---|---|
| matrix form delta^(l) = g'(z^(l)) (.) (W^(l+1))^T delta^(l+1), transpose explained, sign convention of delta | `matrix` |
| why backprop is cheap: 2W^2 versus 3W operations, path merging (dynamic programming, reverse-mode autodiff), memory cost | `cost` |
| batch / stochastic / mini-batch, epoch, stopping criteria incl. early stopping | `algorithm` |
| learning rate behaviour on theta^2 (computed paths for eta 0.1, 0.9, 1.1) | `lr` |
| local minima, plateaus, saddles, random initialisation and the zero-initialisation symmetry trap | `landscape` |
| vanishing gradients (sigmoid' <= 0.25) | `landscape`, `q_design` |
| overfitting and regularisation (early stopping, weight decay, dropout); not in deck 15 | `landscape` |
| gradient checking by central differences | `check` |
| cross-entropy with sigmoid/softmax gives delta = y - a | `why` (details) |

The deck contains **no worked numeric example** for backpropagation (the demo slides are diagrams). The numeric
example here (2-2-2 sigmoid network, x = (1, 0.5), y = (1, 0), eta = 0.5) is our own and is computed in Python.

## Lesson `ensembles` (deck 16-ensembles, 46 slides)

| Slide(s) | Point | Step |
|---|---|---|
| 2 | roadmap: one shot at one model, bias of one algorithm; ensembles combine weak/unstable models | `idea` |
| 4 | ensemble learning = classifier combination; majority vote; regression average (0.8, 0.7, 0.2, 0.9 -> 0.65) | `idea` |
| 5 | Intuition 1 (many weak at least as good as one strong), Intuition 2 (strong ensemble at least as good as the best) | `idea` |
| 6-8 | toy example A/B/C: not the same mistakes, better than chance | `when` (three tables, quiz) |
| 9-10 | error of independent vs identical classifiers; effective when slightly better than random (error < 0.5) | `curve` (figure, table, quiz) |
| 11-12 | n = 25, eps = 0.35, majority vote, binomial sum = 0.06 | `binom` (computed 0.0604), `q_vote` |
| 13-14 | approaches: instance, feature, algorithm, class-label manipulation | `idea` (table) |
| 15 | three main algorithms: stacking, bagging (+ random forest), boosting (AdaBoost); bagging reduces variance, boosting reduces bias | `idea`, `compare` |
| 16 | bias/variance refresher (a poll slide) | `var_read`, `compare`, `q_bias_var` |
| 18-20 | stacking: level 0 / level 1, X_new = [predictions, X_old], logistic regression as meta-classifier, nested CV to reduce bias | `stacking`, `stack_cv` |
| 21-22 | validation: no level-0 classifier may see the level-1 test data; nested cross-validation; all data can test level 1 | `stack_cv`, `q_leak` |
| 23 | stacking summary: simple but expensive, heterogeneous, as good or better than the best base, applied research | `stacking` (table) |
| 25-26 | bagging: bootstrap sampling N times with replacement, k datasets, voting; example 1..10 | `bagging` (an example sample computed), `boot` |
| 27 | use cases I: same unstable (high-variance) algorithm, e.g. trees | `bagging`, `rf`, `var_read` |
| 28 | use cases II: simple, parallelisable, effective on noisy data, generally better than base | `bagging`, `compare` |
| 30-31 | random tree (feature subset at each node), random forest (random trees + bagging), minimise variance without bias | `rf` |
| 33 | random forest properties: strong, parallel, efficient, robust to overfitting, interpretability sacrificed | `rf` (table) |
| 35-36 | boosting: focus on hard instances, iteratively reweight, start 1/N, weighted voting; the resampling example | `boost_intro` |
| 38-39 | AdaBoost: stumps, w = 1/N, eps_i = sum w delta(C_i != y), alpha_i = 1/2 ln((1-eps)/eps), only trust better than random | `boost_intro`, `ada_r1`, `ada_alpha`, `q_alpha` |
| 40 | misclassified weights up, correct down | `boost_intro`, `ada_r1`, `q_update` |
| 41 | output {(alpha_i, C_i)}, C*(x) = argmax sum alpha delta; worked vote C1 +1 (1.0), C2 -1 (3.0), C3 +1 (1.5) -> -1; convergence as long as better than random | `ada_rounds` (vote table, quiz) |
| 42 | boosting summary: complicated but cheap, more expensive than bagging, error bounds, train vs test convergence, prone to overfit | `boost_intro`, `ada_alpha` (bound derived), `compare` |
| 43 | bagging vs boosting list | `compare` (table), `q_compare`, `q_bias_var` |
| 44-46 | interview questions / summary questions (classifier combination, bagging, boosting, stacking, comparison) | `q_compare`, `q_design`, `sheet` |

Beyond the deck (standard textbook: Hastie, Tibshirani and Friedman *ESL* ch. 8, 10, 15; Breiman 1996, 2001; Freund
and Schapire 1997; Friedman, Hastie and Tibshirani 2000):

| Point | Step |
|---|---|
| Var(mean) = rho sigma^2 + (1 - rho) sigma^2 / M derived; the floor rho sigma^2; bias untouched; why random forests decorrelate | `var`, `var_read`, `rf` |
| 1 - (1 - 1/N)^N -> 1 - 1/e derived; out-of-bag error | `boot`, `bagging` (details) |
| binomial majority-vote calculation, n = 3 by hand and n = 25 | `binom` |
| AdaBoost weight update w <- w exp(-alpha y C) / Z (the deck says only "up / down") | `boost_intro`, `ada_r1`, `ada_alpha` |
| alpha derived by minimising the exponential loss; Z_min = 2 sqrt(eps(1-eps)); training error <= product of Z | `ada_alpha` |
| the 10-point AdaBoost example, three rounds fully computed (eps 0.3, 0.2143, 0.1818; alpha 0.4236, 0.6496, 0.7520; final vote correct on all ten) | `ada_r1`, `ada_rounds` |
| noise sensitivity of boosting vs bagging | `compare` |

The deck gives no worked AdaBoost numbers beyond the vote table on slide 41; the 10-point example is the classic
one (Tan, Steinbach and Kumar), recomputed in Python here. The deck's slide 36 boosting example (resampled datasets
with repeated hard instances) is described in words, not redrawn.
