# Coverage: basics (decks 02 and 04)

Slide numbers are the page footers of the decks (02-mlconcepts, 04-probability). Steps are in `l_basics.py`.

## Lesson `concepts` (deck 02)

| Slide(s) | Knowledge / exam point | Step id |
|---|---|---|
| 3-6 | Recap questions; supervised vs unsupervised vs reinforcement vs semi-supervised; taxonomy; "how do you decide which type of ML" decision tree with typical methods | `settings` |
| 9-11, 28 | Instances, attributes/features, concepts (labels), feature vector | `vocab` |
| 12-13 | weather.nominal dataset (Quinlan 1986): instances, attributes, concept | `vocab`, `class-reg`, `heldout`, `remember` |
| 14 | What a concept is: classification, regression, clustering, association learning | `settings` |
| 15-19 | Unsupervised: clustering, anomaly detection, dimensionality reduction, market basket ("beer and diapers"), mall scenario, clustering evaluation is subjective | `settings`, `t-mall` |
| 20-24 | Supervised, classification, training vs evaluation (held-out) data, weather predictions | `class-reg`, `heldout` |
| 25-27 | Regression vs classification (enumerable labels vs "close enough"), weather temperature predictions | `class-reg` (MAE computed from slide 27's evaluation rows) |
| 29-33 | Feature data types: nominal (dichotomy, equality only), ordinal (order, no distance, hot-cool is not mild; nominal vs ordinal unclear), numeric; quick quiz (blood type, rating, postcode, T-shirt size) | `attr-types` |
| 34 | Attribute types vs models (NB, linear/logistic, perceptron/NN); three remedies (select, change model, change attributes) | `model-match` |
| 35-38 | Nominal to numeric: integer coding (pros: simple, space efficient; cons: arbitrary order, meaningless distance), one-hot (more dimensions, sparsity) | `encode`, `c-encode` |
| 39-50 | Numeric to nominal: discretisation (number of bins, boundaries); equal width (formula, education-years example n=3 and n=2, pros/cons incl. outliers); equal frequency (pros/cons); clustering | `discretise`, `bins-worked`, `bins-cost`, `p-width`, `t-bins` |
| 51-53 | Feature normalisation: z-score, min-max, why scale differs matter | `scaling`, `p-z` |
| 54-55 | Preparing the input: assembling and cleaning data | `messy` |
| 56-58 | Missing values: types, reasons, MAR vs MNAR | `messy`, `c-mnar` |
| 59 | Disguised missing data | `messy` |
| 60 | Simple imputation (mean, median, mode), pros and cons (biases variance, std) | `messy` (variance shrink computed) |
| 61 | Getting to know the data (histograms, scatter plots, experts, sampling) | `messy` |
| 62 | Key takeaways | `remember` |
| (beyond deck) | Models and learning, hypothesis space, memorising vs learning | `learning` |
| (beyond deck) | Why generalisation not training fit; i.i.d., generalisation error, under/overfitting | `generalise`, `t-heldout` |
| (beyond deck) | Inductive bias: counting functions, restriction vs preference bias, no free lunch, bias of each model | `bias-count`, `bias-kinds` |
| (beyond deck) | What each discretisation choice costs (information loss, boundaries, fit cuts on training data) | `bins-cost` |

Not covered: the slides' pandas/sklearn code snippets (OneHotEncoder, pd.cut, pd.qcut, StandardScaler, MinMaxScaler, SimpleImputer) are not reproduced; the concepts they implement are. The deck's "inaccurate data" item (roadmap only) is treated in one sentence in `messy`.

## Lesson `probability` (deck 04)

| Slide(s) | Knowledge / exam point | Step id |
|---|---|---|
| 2-3 | Roadmap; probability as exhaustive, mutually exclusive possibilities summing to 1 | `why`, `basics` |
| 4-7 | P(A=a) as a fraction of trials, 0 to 1, P(True)=1; 52-card deck; P(queen), P(heart), P(red); notation P(A=x), P(x), P(A) | `basics` |
| 8 | Joint probability P(A,B) = P(A and B); ace-spade, heart-red | `basics` |
| 9 | Conditional probability definition; P(ace given spade), P(heart given red) | `basics`, `recall` |
| 10 | Independence, two examples (ace/spade independent; heart/red dependent) | `indep` |
| 11-13 | Marginalisation, movie genre x market table (both margins), sums to 1 | `marg` |
| 14 | Independence, disjoint events P(A or B), product rule, two kings without replacement = 1/221 | `basics`, `indep`, `chain` |
| 15 | Chain rule, free choice of factorisation (July, 5 degrees, sick) | `chain` |
| 16-17 | Bayes' rule; prior, likelihood, posterior, evidence; P(B) by marginalisation | `bayes` |
| 18 | Study hard / H1 example (0.9; what if P(H1)=0.4 gives 0.45) | `bayes-ex` |
| 19-20 | Taxi-cab problem (0.12/0.29 = 0.41), base-rate neglect | `taxi`, `bayes-ex` |
| 21-22 | What a distribution is; discrete vs continuous random variables | `rv` |
| 23 | Gaussian: mean, standard deviation, variance, density formula | `rv` |
| 24 | Bernoulli distribution | `ladder`, `recall` |
| 25-26 | Binomial distribution; 2 heads in 3 tosses = 3/8 | `ladder`, `count` |
| 27 | Categorical distribution | `ladder` |
| 28-30 | Multinomial; use in text/NB; dice example 3 ones and 2 fives = 5/3888 | `ladder`, `count` |
| 31-33 | Why probability in ML: uncertainty, features follow distributions, soft predictions | `why` |
| 34 | Probabilistic models (Box quote) | `why` |
| 35-36 | Spam model X ~ Binomial(N=100, theta); MLE = argmax P(X=x; N, theta) | `mle-idea`, `mle-bern` |
| 37 | MLE fails with no spam in the sample; prior; posterior; MAP | `mle-trouble` |
| 38 | Summary: expectations and marginalisation, MLE and MAP "taster" | `expect`, `marg`, `mle-*` |
| (beyond deck) | Expectation, linearity, variance; E[f(X)] as expected loss | `expect` |
| (beyond deck) | Bayes from the definition of conditional probability | `chain`, `bayes` |
| (beyond deck) | MLE of Bernoulli by derivative (with second-derivative check); categorical with a Lagrange multiplier; Gaussian MLE | `mle-bern`, `mle-cat`, `mle-trouble` (details) |
| (beyond deck) | MAP with a Beta prior as pseudo-counts (link to Laplace smoothing) | `mle-trouble` |
| (beyond deck) | Conditional independence with a worked example | `indep` |
| (beyond deck) | Entropy as expected surprise; bridge to information gain and cross-entropy | `entropy` |
| exam (lecture 23) | Probability formulas are not given: write from memory | `recall`, `p-bayes`, `p-binom`, `p-entropy`, `t-bayes`, `t-mle`, `remember2` |

Notes: the deck writes the categorical distribution as the bare product of p_k^x_k; here it is explained as the probability of one specific sequence, and the multinomial adds the counting factor. The deck does not define entropy; it is introduced here as the bridge to decision trees (log base 2).

## Textbook sources relied on

- Bishop, *Pattern Recognition and Machine Learning*: ch. 1.2 (probability, Bayes, expectation, Gaussian), 2.1-2.2 (Bernoulli, binomial, multinomial, Beta prior and the MAP mode formula), 1.6 (entropy).
- Murphy, *Machine Learning: A Probabilistic Perspective / PML*: MLE of Bernoulli, categorical (Lagrange multiplier) and Gaussian; the variance MLE divides by N.
- Mitchell, *Machine Learning*, ch. 2 and 3 (inductive bias; counting 2^(2^n) Boolean functions); Wolpert (1996) for the no-free-lunch statement.
- Rubin (1976) for MAR/MNAR; Tversky and Kahneman (1972) is cited in the deck for the taxi problem.
