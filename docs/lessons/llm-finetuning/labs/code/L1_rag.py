"""L1: a RAG pipeline, evaluated retrieval-first (Mathnim fine-tuning course).

  python L1_rag.py --corpus planets --lang zh --chunk 256   # part 1: A2's eight planet articles, 12 questions
  python L1_rag.py                    # part 2: SQuAD at scale (CPU is fine for retrieval; a GPU helps generation)
  python L1_rag.py --chunk 128        # another chunk size (words)
  python L1_rag.py --finetune         # optional: fine-tune the embedding model, then re-evaluate
  LAB_SMOKE=1 python L1_rag.py        # a quick check with tiny models

Part 1 data: A2's corpus (planets/corpus/<lang>/*.txt and planets/questions.json, from the course
files). A chunk is relevant when it contains the question's whole gold sentence. Retrieval only.
Part 2 data: SQuAD v1.1 validation. Paragraphs of the same Wikipedia article are joined
back into one document, then chunked; a chunk is "relevant" to a question when it
contains the whole answer span. That gives qrels for free.
Chunk sizes are in words for English and in characters for Chinese.
"""
from __future__ import annotations

import os
import sys

if sys.platform == "darwin":   # faiss-cpu and torch each bring an OpenMP runtime; on macOS two of them can deadlock
    os.environ.setdefault("OMP_NUM_THREADS", "1")
    os.environ.setdefault("KMP_DUPLICATE_LIB_OK", "TRUE")

import argparse
import math
import re
import time
from collections import defaultdict

import faiss
import numpy as np
from datasets import load_dataset
from rank_bm25 import BM25Okapi
from sentence_transformers import CrossEncoder, SentenceTransformer

from common import contains_answer, smoke

p = argparse.ArgumentParser()
p.add_argument("--corpus", choices=["squad", "planets"], default="squad")
p.add_argument("--lang", choices=["en", "zh"], default="en", help="planets only (SQuAD is English)")
p.add_argument("--planets-dir", default="planets", help="folder with corpus/<lang>/*.txt and questions.json")
p.add_argument("--chunk", type=int, default=200, help="chunk size in words (Chinese: characters)")
p.add_argument("--overlap", type=int, default=40, help="overlap in words (Chinese: characters)")
p.add_argument("--questions", type=int, default=1000)
p.add_argument("--generate", type=int, default=100, help="questions answered end to end")
p.add_argument("--finetune", action="store_true")
p.add_argument("--smoke", action="store_true")
args = p.parse_args()
SMOKE = args.smoke or smoke()

EMB = "sentence-transformers-testing/stsb-bert-tiny-safetensors" if SMOKE else "intfloat/multilingual-e5-small"
RERANK = "cross-encoder/ms-marco-TinyBERT-L2-v2" if SMOKE else "BAAI/bge-reranker-base"
GEN = "trl-internal-testing/tiny-Qwen2ForCausalLM-2.5" if SMOKE else "Qwen/Qwen2.5-1.5B-Instruct"
N_ART, N_Q = (3, 20) if SMOKE else (None, args.questions)

# ---------------------------------------------------------------- 1. documents, chunks, qrels
ZH = args.corpus == "planets" and args.lang == "zh"
if args.corpus == "squad":
    squad = load_dataset("rajpurkar/squad", split="validation")
    articles: dict[str, list[str]] = defaultdict(list)          # title -> unique paragraphs, in order
    offset: dict[tuple[str, str], int] = {}                     # (title, paragraph) -> char offset in the article
    for ex in squad:
        t, ctx = ex["title"], ex["context"]
        if (t, ctx) not in offset:
            prev = "\n\n".join(articles[t])
            offset[(t, ctx)] = len(prev) + (2 if prev else 0)
            articles[t].append(ctx)
    titles = list(articles)[:N_ART] if N_ART else list(articles)
    docs = {t: "\n\n".join(articles[t]) for t in titles}
else:
    import json
    import pathlib
    root = pathlib.Path(args.planets_dir)
    files = sorted((root / "corpus" / args.lang).glob("*.txt"), key=lambda f: int(f.stem))
    docs = {int(f.stem): f.read_text(encoding="utf-8") for f in files}
    titles = list(docs)
    planet_qs = json.load(open(root / "questions.json", encoding="utf-8"))[args.lang]


def chunk(text: str, size: int, overlap: int) -> list[tuple[int, int]]:
    """Windows of `size` words (Chinese: characters), `overlap` shared; returns (start_char, end_char) spans."""
    words = [(m.start(), m.end()) for m in re.finditer(r"\S" if ZH else r"\S+", text)]
    spans, i, step = [], 0, max(1, size - overlap)
    while i < len(words):
        j = min(len(words), i + size)
        spans.append((words[i][0], words[j - 1][1]))
        if j == len(words):
            break
        i += step
    return spans


chunks, chunk_title, chunk_span = [], [], []
for t in titles:
    for s, e in chunk(docs[t], args.chunk, args.overlap):
        chunks.append(docs[t][s:e])
        chunk_title.append(t)
        chunk_span.append((s, e))

questions, qrels, golds = [], [], []
for q in ([] if args.corpus == "squad" else planet_qs):     # part 1: the chunk must hold the whole gold sentence
    a0 = docs[q["doc"]].find(q["gold"])
    rel = {i for i, (t, (s, e)) in enumerate(zip(chunk_title, chunk_span)) if t == q["doc"] and a0 >= 0 and s <= a0 and a0 + len(q["gold"]) <= e}
    questions.append(q["q"])
    qrels.append(rel)                         # may be empty: every chunk boundary cut the sentence (A2's point)
    golds.append([q["gold"]])
for ex in ([] if args.corpus == "planets" else squad):
    if ex["title"] not in docs:
        continue
    a0 = offset[(ex["title"], ex["context"])] + ex["answers"]["answer_start"][0]
    a1 = a0 + len(ex["answers"]["text"][0])
    rel = {i for i, (t, (s, e)) in enumerate(zip(chunk_title, chunk_span)) if t == ex["title"] and s <= a0 and a1 <= e}
    if rel:                                   # skip the rare answer cut by every chunk
        questions.append(ex["question"])
        qrels.append(rel)
        golds.append(ex["answers"]["text"])
    if len(questions) >= N_Q:
        break
print(f"{len(docs)} articles, {len(chunks)} chunks of {args.chunk} {'characters' if ZH else 'words'}, {len(questions)} questions")

# ---------------------------------------------------------------- 2. three retrievers
K = min(len(chunks), 50 if not SMOKE else 10)
if ZH:
    import jieba                              # Chinese has no spaces: segment first, or BM25 finds almost nothing
    tok = lambda s: [w for w in jieba.lcut(s) if w.strip()]
else:
    tok = lambda s: re.findall(r"\w+", s.lower())
t0 = time.time()
bm25 = BM25Okapi([tok(c) for c in chunks])
bm25_rank = [list(np.argsort(-bm25.get_scores(tok(q)))[:K]) for q in questions]
t_bm25 = (time.time() - t0) / len(questions)

emb = SentenceTransformer(EMB)
D = emb.encode(["passage: " + c for c in chunks], normalize_embeddings=True, batch_size=64)
index = faiss.IndexFlatIP(D.shape[1])        # normalised vectors: inner product = cosine
index.add(np.asarray(D, dtype="float32"))
t0 = time.time()
Q = emb.encode(["query: " + q for q in questions], normalize_embeddings=True, batch_size=64)
_, dense_ids = index.search(np.asarray(Q, dtype="float32"), K)
dense_rank = [list(r) for r in dense_ids]
t_dense = (time.time() - t0) / len(questions)


def rrf(*rankings, k=60):
    """Reciprocal rank fusion: add 1 / (60 + rank) from every list. Never add raw scores."""
    score = defaultdict(float)
    for r in rankings:
        for pos, c in enumerate(r):
            score[c] += 1 / (k + pos + 1)
    return sorted(score, key=score.get, reverse=True)[:K]


hybrid_rank = [rrf(a, b) for a, b in zip(bm25_rank, dense_rank)]

# ---------------------------------------------------------------- 3. rerank the hybrid top-K
ce = CrossEncoder(RERANK)
t0 = time.time()
rerank_rank = []
for q, cand in zip(questions, hybrid_rank):
    s = ce.predict([(q, chunks[i]) for i in cand], batch_size=32)
    rerank_rank.append([cand[i] for i in np.argsort(-np.asarray(s))])
t_rerank = (time.time() - t0) / len(questions)

# ---------------------------------------------------------------- 4. metrics


def ndcg10(r, rel) -> float:
    if not rel:                               # no chunk holds the answer: nothing can be found
        return 0.0
    dcg = sum(1 / math.log2(i + 2) for i, c in enumerate(r[:10]) if c in rel)
    return dcg / sum(1 / math.log2(i + 2) for i in range(min(len(rel), 10)))


def metrics(ranks, qrels):
    out = {}
    for k in (1, 5, 20, K):
        out[f"recall@{k}"] = np.mean([len(set(r[:k]) & rel) > 0 for r, rel in zip(ranks, qrels)])
    out["mrr@10"] = np.mean([next((1 / (i + 1) for i, c in enumerate(r[:10]) if c in rel), 0.0) for r, rel in zip(ranks, qrels)])
    out["ndcg@10"] = np.mean([ndcg10(r, rel) for r, rel in zip(ranks, qrels)])
    return out


print(f"\n{'retriever':<10} " + " ".join(f"{m:>10}" for m in metrics(bm25_rank, qrels)) + "   ms/query")
for name, r, t in [("BM25", bm25_rank, t_bm25), ("dense", dense_rank, t_dense), ("hybrid", hybrid_rank, t_bm25 + t_dense), ("+rerank", rerank_rank, t_bm25 + t_dense + t_rerank)]:
    print(f"{name:<10} " + " ".join(f"{v:>10.3f}" for v in metrics(r, qrels).values()) + f"   {1000 * t:8.1f}")

# ---------------------------------------------------------------- 5. generation: closed book vs RAG vs oracle (part 2 only)
if args.corpus == "planets":
    print("part 1 measures retrieval only; compare chunk sizes with --chunk")
    raise SystemExit(0)
from transformers import pipeline  # noqa: E402

gen = pipeline("text-generation", model=GEN, device_map="auto" if not SMOKE else None)
SYS = "Answer with a short phrase. If the context does not contain the answer, say you don't know."


def ask(q: str, context: list[str] | None) -> str:
    user = q if context is None else "Context:\n" + "\n\n".join(f"[{i + 1}] {c}" for i, c in enumerate(context)) + f"\n\nQuestion: {q}"
    out = gen([{"role": "system", "content": SYS}, {"role": "user", "content": user}], max_new_tokens=32, do_sample=False)
    return out[0]["generated_text"][-1]["content"]


n = min(args.generate, len(questions)) if not SMOKE else 3
acc = {"closed book": 0, "RAG top-5": 0, "oracle chunk": 0}
fails = []
for i in range(n):
    q = questions[i]
    oracle = chunks[min(qrels[i])]
    rag = [chunks[c] for c in rerank_rank[i][:5]]
    for name, ctx in [("closed book", None), ("RAG top-5", rag), ("oracle chunk", [oracle])]:
        ok = contains_answer(ask(q, ctx), golds[i])
        acc[name] += ok
        if name == "RAG top-5" and not ok:
            fails.append((q, "FP2 not retrieved" if not set(rerank_rank[i][:5]) & qrels[i] else "FP4 retrieved, not used"))
print("\nend to end (answer contains the gold text):", {k: round(v / n, 3) for k, v in acc.items()})
print("RAG failures by type:", {t: sum(1 for _, x in fails if x == t) for t in {x for _, x in fails}})

# ---------------------------------------------------------------- 6. optional: fine-tune the embedding model
if args.finetune:
    from datasets import Dataset
    from sentence_transformers import SentenceTransformerTrainer, SentenceTransformerTrainingArguments
    from sentence_transformers.sentence_transformer.losses import MultipleNegativesRankingLoss
    from sentence_transformers.sentence_transformer.training_args import BatchSamplers
    from sentence_transformers.util import mine_hard_negatives

    train = load_dataset("rajpurkar/squad", split="train")            # different articles from validation: no leakage
    train = train.select(range(200 if SMOKE else 20000))
    pairs = Dataset.from_dict({"anchor": ["query: " + x for x in train["question"]], "positive": ["passage: " + x for x in train["context"]]})
    hard = mine_hard_negatives(pairs, emb, relative_margin=0.05, num_negatives=1)
    targs = SentenceTransformerTrainingArguments(output_dir="e5-ft", per_device_train_batch_size=64 if not SMOKE else 8,
        learning_rate=2e-5, num_train_epochs=1, max_steps=2 if SMOKE else -1, batch_sampler=BatchSamplers.NO_DUPLICATES,
        report_to="none", save_strategy="no")
    SentenceTransformerTrainer(model=emb, args=targs, train_dataset=hard, loss=MultipleNegativesRankingLoss(emb)).train()
    # the index must be rebuilt: old chunk vectors and new query vectors live in different spaces
    D = emb.encode(["passage: " + c for c in chunks], normalize_embeddings=True, batch_size=64)
    index = faiss.IndexFlatIP(D.shape[1])
    index.add(np.asarray(D, dtype="float32"))
    Q = emb.encode(["query: " + q for q in questions], normalize_embeddings=True, batch_size=64)
    _, ids = index.search(np.asarray(Q, dtype="float32"), K)
    print("dense after fine-tuning:", {k: round(v, 3) for k, v in metrics([list(r) for r in ids], qrels).items()})
