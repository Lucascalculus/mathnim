# Coverage: features (deck 12) and anomaly (deck 21)

File: `l_features_anomaly.py`. Lesson ids `comp90049-features` (23 steps), `comp90049-anomaly` (25 steps).

## Lecture 12, feature selection -> `features`

| Slides | Knowledge point | Step id |
|---|---|---|
| 3-5 | Supervised pipeline; the ML expert's tasks (clean, choose model, choose attributes) | why |
| 6-7 | What are good features: main goal (metric), side goals (insight, smaller/faster); thousands to millions of features | why |
| 8 | Nomenclature: univariate vs multivariate; filter vs wrapper | why |
| 10 | Filter intuition: model-independent, linear time, "correlated" is loose | good |
| 11 | Signal-to-noise ratio S2N (continuous features) | good (+ quiz) |
| 12 | Good features for discrete data: x1 vs x2 example | good |
| 13 | Independence, mutual information I(Y,Xi), I=0 vs >0, select high I, continuous integral | mi (details block for the integral) |
| 14 | Empirical MI estimate with delta-function counts | mi |
| 15 | Worked example: I(Y,X2), the contingency counts, all terms (log base 2) | mi-worked (blank), rank |
| 16 | MI = information gain; I = H(X) - H(X|Y) = H(Y) - H(Y|X); sklearn SelectKBest | mi (callout), mi-expected (derivation) |
| 17 | Other methods: chi-squared, ANOVA F-value | good (table), rank (chi-squared by hand, G statistic) |
| 18 | Correlation-based feature selection (Pearson) | good (table) |
| 20 | Univariate selection may fail | xor, xor-fig |
| 21-24 | Multivariate selection: train/evaluate over subsets; 2^d subsets as a sum of binomials; 10 s per cycle (d=10: ~3 h; d=60: ~3.2e15 h); the lattice | subsets |
| 25 | Feature subset assessment: train/validation/test split | assess |
| 26 | Complexity: generalisation error <= validation error + sqrt(C/n_val); all subsets C=d, subsets of size k C=k log d | assess |
| 27, 46 | In practice / summary: no method universally better, pay attention to complexity, selection not always necessary | compare, remember |
| 29 | Filters: criterion, search, assessment, examples (information gain, chi-square, correlation) | compare |
| 30 | Wrappers: criterion, search, assessment (CV), forward / backward | subsets, greedy, compare |
| 31-32 | Embedded methods: definition, guided search, cheaper than wrapper, L1 (LASSO) example; high-level comparison | embedded, compare |
| 33-34 | Forward selection (wrapper): d + (d-1) + ... + 1 = d(d+1)/2 cycles; pros (small optimal subset) and cons (time, sub-optimal, not feasible on large data) | greedy, fits |
| 35 | Forward selection (embedded): d = 4 cycles | embedded (table) |
| 36 | Example: decision tree (C4.5) as forward selection by entropy | greedy |
| 37-38 | Backward elimination (wrapper): d(d+1)/2 cycles; pros (removes irrelevant first, large optimal subset) and cons | greedy, fits |
| 39 | Backward elimination (embedded) | embedded |
| 40 | Recursive feature elimination with an SVM (smallest theta_j^2) | embedded |
| 41 | RFE as a wrapper | embedded |
| 43 | L0-norm regularised SVM (Kronecker delta, number of non-zero entries) | l1 |
| 44 | L0 not continuous, not convex; Amaldi and Kann (1998): combinatorially hard, 2^d subsets; L0 vs L1 plot | l1 (figure) |
| 45 | L1-norm regularised SVM (taxicab/Manhattan norm), few non-zero entries | l1, lasso-zero |

Deeper (README table): MI as expected PMI and = information gain (mi-expected); chi-square and G = 2nI (rank); XOR example (xor, cp-xor); forward-selection fit count derived as a sum with Gauss's trick, the k-step version and the CV multiplier (fits); why L1 gives exact zeros (soft thresholding) vs L2 (lasso-zero); selection leakage inside cross-validation (assess quiz, cp-design); empirical MI favours many-valued features (rank callout).
Exam practice: cp-forward, cp-mi, cp-xor, cp-pick, cp-compare (Section A), cp-design (Section C). Review sheet: remember.

## Lecture 21, anomaly detection -> `anomaly`

| Slides | Knowledge point | Step id |
|---|---|---|
| 3-4 | Use cases; the ozone-hole story (anomaly filtered as noise) | what |
| 5 | Definition (different mechanism); anomaly vs noise | what |
| 6 | Three problem variants: score > threshold, top-n, score a new point | what |
| 7-8 | Global / point anomalies | types |
| 9-11 | Contextual anomalies; contextual vs behavioural attributes; Paris/Melbourne temperature | types (+ quiz) |
| 12-13 | Collective anomalies; needs sequential/spatial/graph relations | types |
| 14 | Summary of the three types | types (table) |
| 16 | Supervised: needs both labels, imbalance, cannot detect new anomalies, accuracy misleading -> recall -> false positives | hard, imbalance (computed) |
| 17 | Semi-supervised: normal labels only; high false-alarm rate | hard |
| 18-19 | Unsupervised: normal is clustered; profile of normal; diverse normal, similar collective outliers; false positives and misses | hard |
| 21 | The four families | hard (table) |
| 22 | Statistical: parametric f(x, theta), low probability = outlier; depends on the assumption | stat |
| 23 | Graphical approaches (boxplot, scatter, spin plot); time-consuming, subjective | stat |
| 24-25 | Univariate Gaussian: MLE of mu, sigma, 3-sigma, z-score; temperature example | stat, z-worked, z-bound |
| 26-28 | Multivariate normal, covariance matrix, Mahalanobis distance; Grubbs' test on distances; global anomalies only; Euclidean vs Mahalanobis (A: 5.7 vs 5.9, B: 7.1 vs 4.9) | mahal, mahal-worked, z-bound (Grubbs) |
| 29 | Statistical pros and cons | mahal (table) |
| 31-34 | Proximity: distance to the k-th neighbour; sensitive to k; 1-NN vs 5-NN figures; D "ok or not?" | prox (k = 1, 2, 3 table), global |
| 35 | Proximity pros and cons (O(n^2), k, variable density) | prox (table) |
| 37 | Basic density: count within radius; inverse mean k-NN distance; fails with variable density | density |
| 38 | Local density / relative density (LOF-style) formula | density |
| 39-44 | Worked 1-D example, k = 2, Manhattan, x = 0.5 and x = 4 | deck1d |
| 45 | Density pros and cons | density (table) |
| 47-51 | Cluster-based: large vs small clusters (alpha, beta), CBLOF formula, two-phase point/cluster filtering, plot, pros and cons | cluster, cblof |
| 52 | Summary | remember |

Deeper (README table): full LOF by hand on a 9-point 2-D set with k-distance, reachability distance, lrd and LOF (lof-full, blank on lrd(I)); the global threshold fails when densities differ (global, figure fig_pts); why anomalies break supervised learning, with precision/recall computed (imbalance, cp-precision, cp-metrics); z-score ceiling sqrt(N-1) derived (z-bound); Mahalanobis explained through eigen-directions (mahal-worked).
Exam practice: cp-precision, cp-lof1d, cp-mahal, cp-setting, cp-metrics, cp-density (Section A), cp-design (Section C). Review sheet: remember.

## Where the slides and exact arithmetic disagree (stated in the lessons)

- Slide 25: sigma^2 = 2.29, sigma = 1.51, z = 3.04. The ten values give mu = 28.61, sigma^2 = 2.385 (divide by N), sigma = 1.544, z = 2.985, just under 3 (the ceiling for N = 10 is sqrt(9) = 3). The lesson shows both and says which is which.
- Slide 41: relative density of x = 0.5 printed as 9.1. Exact: (13.33 + 20)/2 / 1.905 = 8.75. Slide 43: x = 4 printed 0.81, exact 0.80 (rounding).
- Slide 49 plot: small-cluster points score about 31-32, far points of large clusters 185-564 (the |C_i| factor); mentioned in cblof.

## Textbook sources relied on (beyond the decks)

- PMI as pointwise information and MI = KL(P(x,y) || P(x)P(y)): Cover and Thomas, Elements of Information Theory; Murphy, PML.
- chi-square vs G-statistic (G = 2 n I in nats): standard contingency-table theory (Agresti).
- Selection bias, selecting features inside cross-validation: Hastie, Tibshirani and Friedman, ESL section 7.10.2.
- Soft thresholding for the one-weight L1 problem: ESL chapter 3 (lasso), Murphy PML.
- S2N score: Guyon and Elisseeff (2003), the deck's own reference.
- LOF definitions (k-distance, reach-dist, lrd, LOF): Breunig, Kriegel, Ng and Sander (2000).
- CBLOF's alpha/beta rule for large clusters: He, Xu and Deng (2003).
- Grubbs' test critical value (N = 10, two-sided 5%: 2.29, computed with the t-distribution formula): Grubbs (1969).
- The bound z <= sqrt(N-1): Samuelson's inequality (1968), derived in the lesson with Cauchy-Schwarz.
