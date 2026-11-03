# Coverage: knn (deck 03) and trees (deck 05)

Step ids are in `l_knn_trees.py`; lesson `comp90049-knn` and `comp90049-trees`.

## knn (03-knn)

| Slide(s) | Knowledge / exam point | Step |
|---|---|---|
| 3-5 | Memory-based idea (digits example), what k nearest neighbours are | `idea` |
| 6-8 | K=1 vs K=4; training = store all; testing = distances, K closest, aggregate labels | `idea` |
| 9 | Classification (most common label) vs regression (average of K) | `idea`, `voting` (weighted average) |
| 10, 29, 36 | The four problems: represent, distance, disagreement, choose K | `idea` (table) |
| 11-12 | Feature vector (golf rows), nominal / ordinal / numerical features | `represent` |
| 14-15 | Nominal to numeric (one-hot), dimension of the feature vector (6), `?` for missing | `represent` |
| 16-17 | Hamming distance, apple-banana = 4 | `nominal` (+ quiz) |
| 18-19 | Simple matching distance, 1 - 2/6 = 2/3 | `nominal` |
| 20-21 | Jaccard distance, 1 - 1/5 = 4/5 | `nominal` (+ why Jaccard; Dice as an aside) |
| 23 | Manhattan (L1), 4-feature example = 7 | `numeric` + figure |
| 24 | Euclidean (L2), same example | `numeric` + figure |
| 25-26 | Cosine similarity and distance, doc1/doc2 0.91 / 0.09, doc2/doc3 0.99 / 0.01 | `numeric`, `cosine-derive` (derive) |
| 27-28 | Ordinal features: normalised ranks z = r/m, ratings example, then a numeric distance | `ordinal` |
| 30-31 | Majority voting, K=4 example (red 1, blue 3) | `voting`, `voting-calc` |
| 32-33 | Inverse distance weights 1/(d+eps), eps = 1e-5; red 100000, blue 2.34 | `voting`, `voting-calc` |
| 34-35 | Inverse linear distance (d_k - d_j)/(d_k - d_1); red 1, blue 0.3 | `voting`, `voting-calc` (blank = 1/3) |
| 37-39 | Selecting K: K=1, K=3; small K jagged / noise; large K smooth / grouping unrelated; K=N; test-error curve | `choosing-k` (+ figure, quiz), `bias-variance` |
| 40-41 | Breaking ties: tied distances (1-NN), tied votes (2-NN) | `ties` (the slides are figures only: the resolution rules are textbook-standard options) |
| 42 | Pros (intuitive, no assumptions, classification + regression, no training) and cons (distance, combining neighbours, K, expensive on large data) | `lazy` |
| 43-44 | Lazy (instance-based) vs eager learning | `lazy` |
| 45-46 | Summary; further reading (Han & Kamber; ESL 2.3.2) | `remember` |

Deeper (README table): curse of dimensionality with proof that nearest/farthest tends to 1 and a seeded simulation (`curse`, `curse-derive`);
why scaling matters with a numeric flip example, min-max and z-score, fit on training data only (`scaling`);
k as a bias-variance knob, variance sigma^2/k derived (`bias-variance`); decision-region figure for k = 1, 7, N (`choosing-k`);
cosine distance = half the squared Euclidean distance of unit vectors (`cosine-derive`).
Exam practice: `p-dist`, `p-vote`, `p-n`, `p-curse`, `p-explain` (Section A), `p-design` (Section C).

Textbook sources used beyond the deck: Hastie, Tibshirani & Friedman, ESL (2nd ed.) section 2.5 for the edge-length argument and the
bias-variance behaviour of k-NN (error = sigma^2 + bias^2 + sigma^2/k); Minkowski/Chebyshev and Dice as standard asides.

## trees (05-decisiontrees)

| Slide(s) | Knowledge / exam point | Step |
|---|---|---|
| 3 | Golf data set (14 rows), new instance 15 | `idea` |
| 4-5 | Zero-R, 9/14 = 64%, baseline | `baselines` |
| 6-14 | One-R / decision stump, errors per feature (Outlook 4, Temp 5, Humidity 4, Windy 5 of 14) | `baselines` |
| 15-16 | Pure node / leaf, root, node, branch | `idea`, `greedy` |
| 17-18 | Building the optimal tree is NP-hard, heuristic: purest partitions | `greedy` |
| 19 | Criterion for attribute selection, Occam's razor, for and against | `greedy` |
| 20 | ID3 (Quinlan 1986), recursive, information gain / mutual information | `greedy`, `mi-derive` |
| 21-25 | Entropy, self-information, coins, H(play) = 0.94 | `entropy` + figure |
| 26-30 | Conditional entropy, H(play | outlook) = 0.693 (we show 0.694 unrounded) | `infogain`, `ig-calc` |
| 31-33 | Information gain, IG of all four attributes (0.247, 0.029, 0.152, 0.048) | `infogain`, `ig-calc` (blank: entropy of a pure node) |
| 34-40 | ID3 recursion: sunny -> Humidity, rainy -> Windy, IGs inside each branch; final tree; stopping criterion purity > tau | `grow` (+ tree figure) |
| 41-43 | Predicting instance 15 with the tree = yes | `grow` |
| 44 | Shortcoming of IG: prefers highly-branching attributes, fragmentation, overfitting | `gainratio` |
| 45-46 | Gain ratio (C4.5), split information, SI(outlook) = 1.577, GR = 0.156 | `gainratio` |
| 47-48 | Stopping criteria (threshold on IG/GR, pruning, run out of attributes, majority label, ties unclear, insufficient attributes) | `stopping` |
| 49-52 | Numeric features: binary tree, threshold t, left <= t, right > t, income example Edu-num <= 11 then Age <= 65 | `numeric`, `shape` |
| 53-56 | Regression trees: SSR, leaf = mean, binary; 71.66 / 40.83 / 55 | `regression`, `mean-derive` |
| 58 | Hypothesis-space search: greedy simple-to-complex, no backtracking | `greedy` |
| 59 | Pros / cons of trees | `proscons` |
| 60 | Variants: oblivious trees, random tree, basis of random forest | `proscons` |
| 61 | Summary questions: ID3, IG and its shortcoming, gain ratio, properties | `remember`, `p-explain` |

Deck slips noticed and handled in the text: slide 36 prints H(play | temp) = 0.991 (correct value 0.911, its own gain 0.029 matches);
slides 37-38 print the small gains as 0.018 (exact 0.020, from rounding 0.952); slide 35 rounds 1/3 to 0.3 and slide 33 sums to 2.34 (2.33 exactly).

Deeper (README table): information gain = mutual information, derived (`mi-derive`), including IG <= H(A) as the reason for gain ratio;
the id-attribute demonstration and why gain ratio alone does not cure it (C4.5's above-average-gain filter) (`gainratio`);
overfitting, pre- and post-pruning (reduced-error, cost-complexity) (`stopping`); regression trees with a derivation that the mean minimises SSR
(`regression`, `mean-derive`); axis-parallel boundary figure, non-parametric nature, instability (`shape`).
Exam practice: `p-ig`, `p-si`, `p-id`, `p-over`, `p-explain` (Section A), `p-design` (Section C).

Not covered in the deck (added as textbook asides): missing values (C4.5 fractional instances, CART surrogate splits) in a `details` block of `grow`.

Textbook sources: Quinlan, Induction of decision trees (1986) and C4.5 (1993) for the gain-ratio and the average-gain rule; Mitchell, Machine Learning ch. 3;
Breiman et al., CART, for cost-complexity pruning and regression trees; Cover & Thomas for mutual information as KL divergence.
