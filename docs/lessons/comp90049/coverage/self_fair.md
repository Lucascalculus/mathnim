# Coverage: self_fair (l_self_fair.py)

Slide numbers are PDF page numbers of the decks in ~/Downloads (the decks restate slide numbers on animation builds).

## Lesson `self` (deck 20-selfsupervised)

| Knowledge / exam point | Slides | Step id |
|---|---|---|
| Recap: supervised, unsupervised, semi-supervised (figures) | 4-6 | `settings` |
| Motivation: create labels ourselves; predict the missing patch; supervision need not come from humans; table supervised vs self-supervised (input / target) | 7 | `why` |
| Definition of SSL; warm-start by pretext then supervised target task; pretext vs target supervision signals | 8 | `why`, `pipeline` |
| Pretext task: encoder, learned representation, decoder/classifier/regressor; forces useful structure; "never told it is a cat" | 9 | `pipeline`, `why` |
| Downstream task: frozen encoder, small FC layer, few labels, cheaper than from scratch | 10 | `pipeline` (linear probe vs fine-tuning) |
| Three ways to build labels: masked prediction, contrastive (same dog attract / dog vs cat repel), autoregressive | 11 | `three`, `contrastive` |
| Autoregressive prediction, "all text on the Internet" | 12 | `ntp` |
| LLM = SSL at enormous scale | 14 | `llm`, `ntp` |
| Bigram models: counting co-occurrence, autocomplete, one previous word ("sweet ___") | 15 | `ngram` |
| n-grams: more context helps, why they fail (unseen combinations), need to generalise | 16 | `ngram` (V^4 contexts computed) |
| LLMs: Transformer outputs distribution over tokens, sampling, left-to-right autoregressive | 17 | `block` |
| Autoregressive decoding algorithm; greedy, top-k, top-p (nucleus); until eos | 18 | `block` (worked example), `p-topp` |
| What model do we need: relationships, long-range dependencies, generalise | 19 | `needs` |
| Order of words; FNN is a bag of words | 20 | `needs` |
| Relationships between words (trophy/suitcase "it" too big / too small) | 21-23 | `needs`, `attention` |
| FNN loses order and relations (no links within a layer) | 24 | `needs` |
| Transformer does all three: positional encoding, attention, billions of sentences | 26 | `needs`, `position`, `attention` |
| Positional encoding: embeddings + sin/cos vectors, same word different vectors at pos 0 and 3 | 27 | `position` (table recomputed) |
| Attention intuition: query, keys, weights (.45 / .15), "it" attends to trophy | 28 | `attention` |
| Training resources: 10 TB, 6000 GPUs 12 days, ~$2M, 1e24 FLOPs, 140 GB, update yearly | 29 | `llm` |
| Transformer block: embedding, positional encoding, N x (layer norm, multi-head attention, feedforward, residual), unembedding, softmax | 31-35 | `block` |
| Training LLMs: self-supervised next-word pre-training, GPT1 and BERT 2018, combined with supervised, GPT-3 needs none | 38 | `llm`, `ntp` |
| How the model learns tasks: facts, reasoning, common sense; tasks in raw data (Q&A) | 39 | `llm` |
| Fine-tuning: answer questions, follow instructions, behave safely | 40 | `llm` |
| Summary: Transformer, 50+ layers, autoregressive decoder, self-supervised pre-training, alignment (prompt-tuning, RLHF, adapters/PEFT) | 41 | `llm`, `remember` |
| Lecture 23 list: supervised vs unsupervised vs semi-supervised and active vs self-supervised; self-supervised pre-training as a way to use few labels | lec 23 slides 14, ~30 | `settings`, `p-compare` |

Beyond the deck (textbook, flagged in the lesson): rotation / jigsaw / colourisation / inpainting / masked LM pretext tasks (`three`), SimCLR (Chen et al. 2020) views, projection head, NT-Xent, 2(N-1) negatives (`contrastive`); InfoNCE term by term, gradients, temperature (`infonce`, `infonce-calc`, `tau`, with all numbers computed in Python); InfoNCE as a lower bound on mutual information (van den Oord et al. 2018) and why representations transfer, shortcut failure (`transfer`); next-token loss as MLE and perplexity (`ntp`); scaled dot-product attention softmax(QK^T / sqrt d) V and sinusoidal PE formula (Vaswani et al. 2017) (`attention`, `position`); pros and cons (`proscons`).

Not covered: the deck's Quiz slide (a PollEv link), the fine-tuning timeline figure details (slide 40), and the exact formulas for multi-head attention, layer norm and RLHF (the deck only names them).

## Lesson `fairness` (deck 22-bias-fairness)

| Knowledge / exam point | Slides | Step id |
|---|---|---|
| Roadmap; applications list; "what can possibly go wrong" | 2-4 | `why` |
| Press review (dual-use AI tool, Uber/Amazon wages, Dutch welfare surveillance ruling, police facial recognition), only as headlines | 5-8 | `why` |
| Humans are biased: cognitive biases, out-group homogeneity, correlation fallacy (chocolate and Nobel laureates) | 10-12 | `humans-data` |
| Data is biased: historical bias (professor / nurse), representation / reporting bias, measurement bias (3 kinds) and the "know your domain / task / represent all groups" remedies | 13-16 | `humans-data`, `p-design` |
| Models are biased: model fit, biased loss (0/1 loss on imbalance), remedies | 17 | `model-eval` |
| Evaluation bias, deployment bias, remedies | 18 | `model-eval` (accuracy-hides-minority quiz computed) |
| The ML pipeline: world, data, model, individuals, feedback | 19 | `model-eval` figure |
| Unintended discrimination: Amazon same-day delivery by zip code, feedback loop | 20 | `why` |
| Sensitive attributes, notation X, A, Y, Y-hat | 22 | `notation` |
| Fairness through unawareness; bank with humans and martians; X correlated to A | 23 | `unaware` (proxy example computed), `p-unaware` |
| Recap of metrics PPV, TPR, FNR | 25 | `notation` |
| Credit scoring example, protected attribute species | 26 | `notation`, `example` |
| Criterion I: demographic parity, Y-hat independent of A, 4/12 = 6/18; properties and limitations; good when representation matters | 27-28 | `criteria`, `example`, `example-all` |
| Criterion II: predictive parity, equal PPV, 2/4 = 3/6; limitation; good when the score matters | 29-30 | `criteria`, `example-all` |
| Criterion III: equal opportunity, equal FNR / TPR, 4/6 = 4/6; limitation; good when you do not want to miss a qualified person | 31-32 | `criteria`, `example-all`, `p-which`, `p-gap` |
| Criterion IV: individual fairness, similarity function and threshold | 33 | `criteria` |
| No fair free lunch: criteria give different results, provably impossible in some cases, fairness vs performance trade-off (Hardt et al. 2016 loan figure) | 34 | `example-all`, `conflict`, `conflict-numbers`, `stages` |
| Three places to improve fairness: pre-processing, training, post-processing | 36 | `reweigh`, `in-post`, `stages` |
| Pre-processing: balancing (up/down-sampling), re-weighting W = P_exp / P_obs | 37-38 | `reweigh` (weights computed on the lecture's 30 applicants), `p-weight` |
| In-processing: fairness as a constraint on logistic regression; pros and cons | 39 | `in-post` |
| Post-processing: thresholds, special strategy near 0.5; pros (model-independent, black box) and cons (needs protected attribute at test time) | 40 | `in-post` (threshold example computed), `p-post` |
| Lecture 23 list: sources of bias (data, users, models), unawareness (why / why not), awareness: group fairness, equal opportunity, predictive parity; pre / modelling / post approaches | lec 23 slide 33 | all of the above, `remember` |

The confusion counts of the three classifiers (`example`, `example-all`) were read off the circle figures on slides 27, 29, 31 (martians 12 with 6 creditworthy, humans 18 with 6 creditworthy; classifier 1 grants 4 martians / 6 humans, classifier 2 the same numbers with different composition, classifier 3 grants 5 / 5); the slide fractions (4/12 = 6/18, 2/4 = 3/6, 4/6 = 4/6) all reproduce.

Beyond the deck (textbook, flagged in the lesson): independence / separation / sufficiency and equalised odds (Barocas, Hardt, Narayanan, *Fairness and Machine Learning*); the impossibility identity FPR = p/(1-p) * (1-PPV)/PPV * TPR and its numeric two-group example (Kleinberg, Mullainathan, Raghavan 2016; Chouldechova 2017) with the COMPAS dispute named only as the textbook example (`conflict`, `conflict-numbers`); penalty and adversarial in-processing (`in-post`).

Not covered: the optional talks and the references list (slides 42-43); the lecture slide 5-8 articles are used only as headlines.
