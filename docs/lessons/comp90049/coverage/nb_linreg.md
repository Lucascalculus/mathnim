# Coverage: naive Bayes (deck 06) and linear regression (deck 07)

Lessons: `naive-bayes` and `linreg` in `l_nb_linreg.py`. Step ids are those of the lesson JSON.

## 06-naivebayes (`comp90049-naive-bayes`)

| Slide | Knowledge / exam point | Step |
|---|---|---|
| 4-6, 9-12 | thought experiments: exact-match counting works / ties / has nothing to count | `what` |
| 7-8 | $\hat y=\arg\max P(y\mid x)$; the obvious way needs $C V^M$ instances (2 M for 20 binary, ~$10^{28}$-$10^{29}$ for 60 ternary) | `what` (numbers computed) |
| 13 | Bayes' rule; remove the denominator; the joint likelihood is still infeasible | `derivation` |
| 14 | the naive (conditional independence) assumption; "nonsense but works"; what the joint-to-product step implies (lecture 23 wording) | `derivation`, `independence` (callout "Exam wording"), quiz, `p1` |
| 15 | the complete NB classifier; assumptions: features conditionally independent, instances independent, train/test same distribution; generative story | `independence`, `generative` |
| 16-18 | training = priors + likelihoods by counting; the flu/cold tables | `estimate`, `example` |
| 19 | Example 1 (Ann): Flu 0, Cold 0.05, predict Cold | `ann` |
| 20 | Example 2 (Bob): both scores 0; the zero-probability problem | `bob` |
| 21 | "no event is impossible"; renormalise | `bob` |
| 22-23 | epsilon smoothing; $\varepsilon<1/N$; fewest $\varepsilon$'s wins; Bob redone | `bob` (second half), quiz |
| 24-27 | Laplace / add-one / add-$\alpha$ ($k$) smoothing, formula with $\alpha V$, headache example (2/3, 1/6, 1/6); big change for few instances; variance down, bias up; other methods (Good-Turing, Kneser-Ney) named | `laplace`, `bob_laplace`, `p5` |
| 28-29 | parametric priors and likelihoods: Bernoulli, categorical, Gaussian | `estimate` (table) |
| 30 | MLE of categorical NB = relative frequencies | `estimate`, `mle` (derived with a Lagrange multiplier) |
| 31-32 | Gaussian NB: per class and feature mean and standard deviation (divide by $n$); worked example 0.73, 0.17 | `gaussian` |
| 33 | prediction with Gaussian likelihoods; keep the best score so far | `gaussian` |
| 34 | underflow; log transformation: $\log P(y)+\sum\log P(x_m\mid y)$ | `logs`, quiz |
| 35 | "smoothing" continuous features: zero variance, ignore the feature, or add $\varepsilon$ (sklearn $10^{-9}$) | `gaussian` |
| 36 | why it works despite a wrong model; advantages (easy, scalable, explainable, missing values, baseline) | `why_works`, `proscons`, `generative` (missing values) |
| 37 | summary questions (algorithm, Bayes' rule, assumptions, smoothing, implementation) | `remember` |

Deeper (README table): Laplace smoothing as MAP with a Dirichlet prior (`map`, derived, with the posterior-mean footnote);
NB is linear in log space, log-odds is $b+\sum w_m x_m$ and equals the logistic-regression form (`linear`, `linear_ex`);
underflow and logs (`logs`); why it works: ranking vs calibration, duplicated-evidence table (`why_works`).
Added beyond the deck: disadvantages list (independence, zero counts, no interactions, numeric features), generative vs
discriminative comparison, missing values by dropping factors, Domingos & Pazzani (1997) result stated in one sentence.

Exam practice: `p1` (which step is the approximation), `p2` (Laplace score by hand), `p3` (normalise), `p5` (bias/variance of smoothing),
`p6` (short answer: why it works), `p7` (Section C design).

## 07-linearregression (`comp90049-linreg`)

| Slide | Knowledge / exam point | Step |
|---|---|---|
| 3-8 | income from hours; target / features; $y=\beta_0+\beta_1x_1+\dots=\boldsymbol\beta\cdot\mathbf{x}$; intercept (bias), weights; single-variable case | `what` |
| 9-14 | training: the "optimal" line; residual $\varepsilon_i=y_i-\hat y_i$; loss function; list RSS, MSE, MAE, RMSE | `loss` (with figure of line and residuals) |
| 15-16 | several variables | `what` |
| 17-19 | interpolation vs extrapolation | `what` (warning, quiz) |
| 20 | assumptions: linear relationship; features not highly correlated | `what`, `closed` |
| 22-26 | objective functions, argmax / argmin, derivative zero at extremes, convex / concave, recipe (4 steps), $f=(\theta-1)^2$ | `calculus` |
| 27-33 | MLE of the binomial spam model: likelihood, log (why), derivative, $\hat\theta=x/N$, 20/100 = 0.2 | `calculus` |
| 34-36 | MSE as a loss surface, minimum at (-13.13, 1.48) | `loss`, `income_fit` (note: exact LS is -12.79, 1.477) |
| 37-38 | matrix form, derivative, $X^TX\beta=X^Ty$, $\beta=(X^TX)^{-1}X^Ty$; unstable when features are correlated (stated as not examinable on the slides) | `normal`, `closed` |
| 39 | final line $-13.13+1.48x$ | `income_fit` |
| 40 | pros and cons (interpretable, closed form, cheap prediction, baseline / linearity, multicollinearity, outliers, extrapolation, normal equations costly for large feature sets) | `proscons`, `compare`, `mle_view` |

Deeper: normal equation by matrix calculus, every line said, with the convexity check (`normal`); least squares = MLE under Gaussian
noise, including $\hat\sigma^2=\text{MSE}$ (`gauss`), and what it implies (outliers, MAE = Laplace noise, ridge = Gaussian prior; `mle_view`);
gradient descent (not in deck 07, which points to the next lecture): update rule, per-weight gradient derived, two steps by hand with a
fill-in line, learning-rate table on $(\theta-1)^2$, feature scaling, closed form vs gradient descent (`gd`, `grad`, `gd_ex`, `compare`).
Added beyond the deck: evaluation metrics RMSE/MAE/$R^2$ computed on the income data (`eval`), ridge/lasso in a `details` block (`closed`).

Exam practice: `q1`-`q3` (prediction, one gradient step, MSE), `q4` (duplicate feature), `q5` (Gaussian noise), `q6` (learning rate),
`q7` (short answer), `q8` (Section C design).

## Unsure / flagged

- The deck quotes the line $-13.13+1.48x$ (slides 36, 39); exact least squares on its ten points is $-12.79+1.477x$. The lesson says so
  (`income_fit` outro) rather than silently using either; the practice question `q1` uses the exact line.
- Slide 8 says "at least $10^{28}$" for 4 classes x 60 ternary attributes; $4\cdot3^{60}\approx1.7\times10^{29}$. The lesson uses the computed value.
- Which estimator is called "Laplace smoothing" (MAP mode with $a=2$ vs posterior mean with $a=1$) differs between textbooks; the lesson derives
  the MAP form, matches the deck's formula, and notes the other in the outro.
- The lesson file uses $\beta$ for regression weights (the deck's symbol) although the README notation table says $\theta$.
- The checker warns that the English model answers of `text` questions are identical in both languages; that is intended (the exam is in English).

## Textbook sources relied on

Bishop, *PRML* (Dirichlet / MAP, §2.2, §3.1); Murphy, *Machine Learning: A Probabilistic Perspective* (naive Bayes, MAP smoothing, §3.5);
Hastie, Tibshirani & Friedman, *ESL* ch. 3 (least squares, ridge, lasso); Domingos & Pazzani (1997), "On the optimality of the simple Bayesian
classifier under zero-one loss"; Eisenstein, *Natural Language Processing* ch. 2.2 (the deck's reference).
