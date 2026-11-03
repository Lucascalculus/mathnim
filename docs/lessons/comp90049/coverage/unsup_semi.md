# Coverage: unsup_semi (decks 17 and 19)

Lessons: `clustering` (deck 17-unsupervised-new, 60 slides), `semi` (deck 19-semisupervised, 53 slides).
Step ids are those of `l_unsup_semi.py`. Slide numbers are PDF page numbers.

## Lesson `clustering` (deck 17)

| Slides | Knowledge / exam point | Step |
|---|---|---|
| 3-4 | supervised vs unsupervised; labelling is hard and costly, labelled data is limited | `what` |
| 5-6 | types of unsupervised learning: PCA, clustering, anomaly detection, association rule mining | `what` (table) |
| 7-9, 14 | clustering learns structure from data alone; we bring assumptions | `what` |
| 10-14 | five axes: exclusive/overlapping, deterministic/probabilistic (hard/soft), hierarchical/partitioning, partial/complete, heterogeneous/homogeneous | `what` (table + quiz) |
| 15 | k-means and agglomerative are exclusive, deterministic, complete; partitioning vs hierarchical | `what` |
| 16-17 | k-means algorithm: choose K, seeds, assign, recompute, stopping rules (no change / threshold / few changes) | `kmeans`, `km-hand` |
| 18 | normalise attributes to [0,1] before distance-based clustering | `kmeans` (callout) |
| 17 | k-means is exclusive, complete, partitioning, aims at compact spherical clusters | `kmeans` |
| 19-20 | K must be predefined; elbow method with WCSS | `choosek` |
| 21 | mean ill-defined for categorical attributes; sensitive to outliers | `limits` |
| 22 | sensitive to initial centroids, local optima | `limits`, `local` |
| 23-25 | non-spherical clusters, different sizes, different densities | `limits` (table, figure, quiz) |
| 26 | strengths: simple, scalable, interpretable, applicable, good for spherical well-separated clusters | `kmeans` |
| 27-29 | hierarchical clustering, dendrogram; agglomerative (bottom-up) vs divisive (top-down); distance matrix | `hier` |
| 30 | basic agglomerative algorithm | `hier` |
| 31 | cluster distances: single, complete, average, centroid | `hier` (table) |
| 32-41 | the 5-instance distance matrix, single and complete linkage merge sequences; updating the matrix | `single-link`, `complete-link` (computed in Python) |
| 31 | average linkage (listed, not worked in the deck) | `average-link` (worked fully), `dendro` |
| 41 | final dendrograms for single and complete | `dendro` (figure of single, complete, average) |
| 42-43 | single linkage: handles non-elliptical shapes; sensitive to noise and outliers | `chain` |
| 44-45 | complete linkage: less sensitive to noise; spherical clusters of consistent diameter, breaks large clusters | `chain` |
| 46-47 | centroid linkage; can violate the hierarchy (inversions); sensitive to outliers | `average-link` (outro), `hier`, `remember` |
| 48-49 | hierarchical strengths (no K, no shape assumption, taxonomies) and weaknesses (no undo, no objective function) | `hier-pros` |
| 50-52 | unsupervised metrics: cohesion (intra-cluster), separation (inter-cluster); what makes a good clustering | `eval` |
| 53 | WCSS formula | `eval`, `km-descent` |
| 54 | BCSS formula (`n_j (mu - mu_j)^2`) | `eval`, `tss` |
| 55 | Calinski-Harabasz index, higher is better | `ch` |
| 56-58 | CH example: A (K=2) 29.4 vs B (K=3) 10.43 (both recomputed) | `ch-example`, `p-ch` |
| 59 | summary lists "supervised evaluation metrics" (no slide shows them) | `eval` (details: purity, entropy; silhouette) |
| Deeper (not in deck) | k-means as coordinate descent on WCSS: both steps never increase J, finite partitions, local optimum only | `km-descent`, `local` |
| Deeper | the mean minimises the sum of squared distances (derivative, second derivative, blank) | `mean-min` |
| Deeper | TSS = WCSS + BCSS | `tss` |
| Deeper | why single linkage chains and complete prefers compact clusters (figure, merge heights) | `chain` |
| Exam practice | Section A compare, Section B calculations, Section C design | `p-ch`, `p-k`, `p-linkage`, `p-compare`, `p-design` |

Not in the deck and added from textbooks: purity, entropy of clusters, silhouette (Tan, Steinbach, Kumar, *Introduction to
Data Mining*, ch. 5; Hastie, Tibshirani & Friedman, *ESL* ch. 14), k-means++ seeding (Arthur & Vassilvitskii 2007, mentioned in
one sentence), the proof TSS = WCSS + BCSS, the degrees-of-freedom reading of the CH factor (N-K)/(K-1), the cost remark on
hierarchical clustering (distance matrix).

Not covered: nothing from the slides is left out. Divisive clustering is only described (the deck does no more). Centroid
linkage is described but not computed (the deck's matrix has no coordinates).

## Lesson `semi` (deck 19)

| Slides | Knowledge / exam point | Step |
|---|---|---|
| 3-5 | supervised vs unsupervised trade-offs; humans use labelled and unlabelled data; labels are a bottleneck (experts, devices, privacy) | `why` |
| 6 | data paucity: adding data nearly as effective as adding layers | `why` |
| 7 | issues of unsupervised learning (ambiguity, wrong direction) | `why` |
| 8 | the four remedies: self-training, active learning, data augmentation, pre-training | `why` (table) |
| 9-12 | semi-supervised setting: L, U, U >> L, goal | `setting` |
| 13-15 | clustering + majority voting, "a bad idea (why?)" | `setting` (quiz) |
| 16 | self-training algorithm (bootstrapping) | `selftrain` |
| 17-22 | self-training with 1-NN (the nearest neighbour is in L / within tau) | `selftrain`, `st-hand`, `st-picture` |
| 23 | self-training with Naive Bayes (probability above a threshold or top-N) | `selftrain` (table), `bias` |
| 24 | assumption: nearby points share labels; errors propagate; safety net = confidence threshold | `selftrain`, `assumptions`, `bias` |
| 25-27 | active learning vs semi-supervised learning; the budget question | `active` (table) |
| 28 | active learning hypothesis, finite labelling resource, queries to an oracle | `active` |
| 29-30 | mushroom labelling illustration | `active` (motivation) |
| 31-32 | how to choose instances: near boundaries, sparse label regions; strategy list | `active` |
| 33-34 | least confidence, with the cat/dog/pig table | `uncertainty`, `unc-hand` |
| 35-36 | margin sampling | `uncertainty`, `unc-hand` |
| 37-38 | entropy sampling (Low / Medium / High) | `uncertainty`, `unc-hand` (entropies computed) |
| 39-40 | final exam example (x1 vs x2, margin sampling, motivation) | `exam-d`, `q-motiv` |
| 41-42 | "Yet Another Example": points A-D, four classes, three measures to fill in | `disagree` (table filled), `q-pick` |
| 43 | query by committee, vote entropy | `qbc` |
| 44 | practicalities: theory elusive, sampling bias, outliers/noise | `outliers` |
| 45-49 | data augmentation: images, audio, text; label-preserving; pros and cons | `augment` |
| 50-52 | self-supervised pre-training and fine-tuning | pointer at the end of `augment`; taught in lesson `self` |
| Deeper | self-training's confirmation bias; when it helps and hurts; over-confident Naive Bayes | `bias`, `st-picture` |
| Deeper | assumptions: smoothness, cluster, manifold | `assumptions` |
| Deeper | why uncertainty sampling picks outliers; density weighting | `outliers` |
| Deeper | the three measures disagree (B vs C: margin picks B, least confidence and entropy pick C; D wins least confidence) | `disagree` |
| Exam practice | numbers, choices, Section A and C text questions | `q-entropy`, `q-margin`, `q-pick`, `q-self`, `q-motiv`, `q-fail`, `q-design` |

Unsure / approximations:
- The final exam example (slide 40) is a bar chart; the probabilities are read off the bars as x1 = (0.2, 0.5, 0.3),
  x2 = (0.3, 0.1, 0.6) (about 0.05 accuracy). The lesson says so. All three measures agree on x1.
- Slide 41-42's table has the probabilities as bars with printed values; they are used exactly (A 0.60/0.30/0.05/0.05,
  B 0.48/0.47/0.04/0.01, C 0.40/0.20/0.20/0.20, D 0.37/0.35/0.20/0.08).
- Pool-based / stream-based / query synthesis, the manifold assumption, density weighting, label propagation are not in the
  deck's text; they follow Settles (2010) and Chapelle, Scholkopf & Zien, *Semi-Supervised Learning* (2006), both named in the
  lesson. Label propagation is only named in the assumptions table (the deck does not teach it).
