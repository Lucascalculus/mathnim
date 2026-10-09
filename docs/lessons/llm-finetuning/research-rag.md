# RAG and retriever fine-tuning: checked sources (2026-10-10)

The A and F parts cite these for RAG. Each entry was checked against the paper's arXiv abstract page or the official page on 2026-10-10. Where a claim comes from the paper body rather than the abstract, that is noted.

## Pipeline and retrievers

- **RAG.** Lewis et al., *Retrieval-Augmented Generation for Knowledge-Intensive NLP Tasks*, NeurIPS 2020 ([arXiv:2005.11401](https://arxiv.org/abs/2005.11401)). A pre-trained seq2seq generator (parametric memory) is paired with a dense index of Wikipedia passages (non-parametric memory) that a neural retriever searches.
- **Sentence-BERT (bi-encoder).** Reimers & Gurevych, EMNLP 2019 ([arXiv:1908.10084](https://arxiv.org/abs/1908.10084)). Finding the most similar pair among 10,000 sentences takes about 65 hours with BERT used as a cross-encoder and about 5 seconds with SBERT.
- **DPR.** Karpukhin et al., EMNLP 2020 ([arXiv:2004.04906](https://arxiv.org/abs/2004.04906)). A dual encoder beats Lucene-BM25 by 9–19 points absolute in top-20 passage retrieval accuracy.
- **E5.** Wang et al. 2022 ([arXiv:2212.03533](https://arxiv.org/abs/2212.03533)).
  - Trained by contrastive pre-training on weakly supervised text pairs (CCPairs).
  - The paper says it is the first model to beat BM25 on BEIR zero-shot without labelled data.
  - **Prefixes:** inputs must start with `query: ` or `passage: `, otherwise performance degrades. This comes from the model card's FAQ, not the paper ([multilingual-e5-small card](https://huggingface.co/intfloat/multilingual-e5-small): 12 layers, embedding size 384, MIT licence, about 100 languages including zh).
- **HNSW.** Malkov & Yashunin 2016 ([arXiv:1603.09320](https://arxiv.org/abs/1603.09320)). An approximate k-NN graph index; starting the search from the upper layer, with scale separation, gives logarithmic complexity scaling.
- **MTEB.** Muennighoff et al. 2022 ([arXiv:2210.07316](https://arxiv.org/abs/2210.07316)). 8 tasks, 58 datasets, 112 languages. "No particular text embedding method dominates across all tasks."
- **BEIR.** Thakur et al., NeurIPS 2021 Datasets & Benchmarks ([arXiv:2104.08663](https://arxiv.org/abs/2104.08663)). 18 datasets, 10 systems.
  - BM25 is a robust baseline.
  - Re-ranking and late-interaction models do best zero-shot, but at high computational cost.
  - Dense retrievers often underperform out of domain.

## Hybrid search, reranking, query rewriting

- **Reciprocal rank fusion.** Cormack, Clarke & Büttcher, SIGIR 2009, pp. 758–759 ([PDF](https://plg.uwaterloo.ca/~gvcormac/cormacksigir09-rrf.pdf), [DOI 10.1145/1571941.1572114](https://doi.org/10.1145/1571941.1572114)).
  - RRFscore(d) = Σ_r 1/(k + r(d)). The paper fixed k = 60 in a pilot study and did not tune it afterwards.
  - RRF beat each individual system and Condorcet Fuse.
- **monoBERT (cross-encoder reranking).** Nogueira & Cho 2019 ([arXiv:1901.04085](https://arxiv.org/abs/1901.04085)). BERT re-ranks candidate passages for a query. It topped the MS MARCO passage leaderboard, +27% relative MRR@10 over the previous best.
- **ColBERT (late interaction).** Khattab & Zaharia, SIGIR 2020 ([arXiv:2004.12832](https://arxiv.org/abs/2004.12832)).
  - Query and document are encoded separately, and document encodings are precomputed.
  - A cheap token-level interaction is computed at query time.
  - About two orders of magnitude faster than BERT rankers, with about four orders of magnitude fewer FLOPs per query.
- **HyDE.** Gao et al. 2022 ([arXiv:2212.10496](https://arxiv.org/abs/2212.10496)). An instruction-following LM writes a hypothetical answer document; an unsupervised contrastive encoder (Contriever) embeds it; the nearest real documents are retrieved.
- **Contextual retrieval.** Anthropic, 2024-09-19 ([post](https://www.anthropic.com/news/contextual-retrieval)).
  - **Context added to each chunk:** 50–100 tokens.
  - **Top-20 retrieval failure rate:**
    - baseline: 5.7%;
    - with contextual embeddings: 3.7%;
    - with contextual embeddings and contextual BM25: 2.9%;
    - with reranking as well: 1.9%.
  - **Reranking setup:** rerank the top 150 candidates and keep 20.
  - **Small knowledge bases:** under 200k tokens, put everything in the prompt and use prompt caching (cost up to 90% lower, latency more than 2× lower).

## Using the context, and where RAG fails

- **Lost in the middle.** Liu et al., TACL ([arXiv:2307.03172](https://arxiv.org/abs/2307.03172)). Accuracy is highest when the relevant information is at the beginning or end of the context. It drops when the information is in the middle, even for long-context models. Tasks: multi-document QA and key-value retrieval.
- **Long context vs RAG.** Li et al., EMNLP 2024 industry track ([arXiv:2407.16833](https://arxiv.org/abs/2407.16833)). Given enough resources, long context beats RAG on average, but RAG is much cheaper. Self-Route sends each query to RAG or long context using the model's self-reflection, keeping performance comparable to long context at much lower cost.
- **Seven failure points.** Barnett et al. 2024 ([arXiv:2401.05856](https://arxiv.org/abs/2401.05856); the list is in the paper body):
  - FP1 missing content;
  - FP2 missed the top-ranked documents;
  - FP3 not in context (consolidation);
  - FP4 not extracted;
  - FP5 wrong format;
  - FP6 incorrect specificity;
  - FP7 incomplete.
- **Global questions.** Edge et al., *From Local to Global: A Graph RAG Approach to Query-Focused Summarization* ([arXiv:2404.16130](https://arxiv.org/abs/2404.16130)). Standard RAG struggles with global questions about a whole corpus, such as "what are the main themes". GraphRAG builds an entity graph and community summaries, then combines partial answers.
- **Indirect prompt injection.** Greshake et al. 2023 ([arXiv:2302.12173](https://arxiv.org/abs/2302.12173)). Adversaries strategically inject prompts into data likely to be retrieved, and so control an LLM application remotely.

## Evaluation

- **RAGAS.** Es et al. 2023 ([arXiv:2309.15217](https://arxiv.org/abs/2309.15217)). Reference-free evaluation of retrieval relevance, faithfulness (does the answer use the passages faithfully) and generation quality.
- **Recall@k, MRR, nDCG.** Standard IR definitions; no source needed.

## Fine-tuning retrievers and generators for RAG

- **InfoNCE.** van den Oord, Li & Vinyals 2018 ([arXiv:1807.03748](https://arxiv.org/abs/1807.03748), section 2.3, paper body).
  - The loss is named "InfoNCE" there.
  - The paper gives the bound I(x; c) ≥ log(N) − L_N, which "becomes tighter as N becomes larger".
- **Synthetic queries.** Dai et al., *Promptagator: Few-shot Dense Retrieval From 8 Examples* ([arXiv:2209.11755](https://arxiv.org/abs/2209.11755)).
  - An LLM writes queries from at most 8 examples, and the generated pairs train a task-specific retriever.
  - The result beats ColBERT v2 by more than 1.2 nDCG on average over 11 sets.
  - Rerankers trained on the same data add another 5.0 nDCG.
- **Hard-negative mining.** sentence-transformers `mine_hard_negatives` ([docs](https://sbert.net/docs/package_reference/util/hard_negatives.html)). `relative_margin` rejects candidates whose score is too close to the positive's; the docs' example uses 0.05.
- **MultipleNegativesRankingLoss.** sentence-transformers' in-batch-negatives InfoNCE. Defaults are `scale=20.0` (that is, τ = 0.05) and `similarity_fct=cos_sim` ([losses docs](https://sbert.net/docs/package_reference/sentence_transformer/losses.html)). The default scale was confirmed from the docs of the multi-vector variant and from a model card's training log, so treat it as checked against the library source rather than this page.
- **RAFT.** Zhang et al. 2024 ([arXiv:2403.10131](https://arxiv.org/abs/2403.10131)). Questions are paired with retrieved documents that include distractors. The model learns to ignore the distractors and to quote the helpful passage verbatim in a chain-of-thought answer. Tested on PubMed, HotpotQA and Gorilla.
- **Real use** (see [research-adoption.md](research-adoption.md), "What the course list misses" item 5):
  - 7,994 sentence-transformers models on the Hub were trained with the Trainer;
  - Databricks reported gains from fine-tuning embedding models on synthetic in-domain data;
  - Unsloth added embedding training in January 2026.
