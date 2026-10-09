# L1 RAG 管线与检索评测 / L1 A RAG pipeline, evaluated retrieval-first

> **状态：** 代码已在 Mac（CPU）上用微型模型做过冒烟测试（几十个问题、几步训练），**尚未在 T4 上实跑**。下面的"预期结果"是定性的，来自所引资料，不是本实验的实测数字。
>
> **Status:** the code was smoke-tested on a Mac (CPU) with tiny models (a few dozen questions, a few training steps); **not yet run on T4**. The expected results below are qualitative, taken from the cited sources, not measured here.

[中文](#中文) · [English](#english)

---

## 中文

### 这个实验要回答什么

RAG 的回答错了，错在哪一环？是正确的段落根本没被找到，还是找到了、模型却没用上？只看最终答案分辨不出来。所以这个实验把管线拆开，**先单独评检索，再评端到端回答**，最后给每个错误归类。

你会亲手比较四种检索：只靠词面匹配的 BM25、靠向量相似度的稠密检索、把两者合起来的混合检索，以及在混合检索之上再用交叉编码器重排。然后用真实数据检验 A2 里"块大小"的权衡。选做部分微调向量模型，看看同领域能涨多少、换个领域又会怎样。

### 准备

- **硬件：** 检索部分 CPU 就够；端到端生成和选做的微调建议用 Colab T4。
- **文件：** 把 `code/` 里的 `common.py`、`L1_rag.py`、`requirements.txt` 上传到 Colab（或放进同一个文件夹），再运行 `pip install -r requirements.txt`。
- **第 1 部分的数据：** A2 用过的八篇行星文章和 12 个人工标注的问题（课程资料里的 `corpus/<lang>/*.txt` 和 `questions.json`），放进 `planets/` 文件夹。
- **第 2 部分的数据：** SQuAD v1.1 验证集，脚本会自动下载。同一篇维基百科文章的段落会被拼回一整篇，再切块。一个块"相关"，当且仅当它完整包含答案片段，这样就不用人工标注了。

### 运行前先预测（写在报告第一栏）

- **P1：** 在 SQuAD 上，BM25 和稠密检索谁的 recall@5 更高？提示：SQuAD 的问题是标注者看着段落写出来的。
- **P2：** 对混合检索的前 50 个结果做重排之后，recall@50 会变吗？recall@1 呢？
- **P3：** 在第 1 部分的语料上，块取 128 还是 512 个字（词），命中率更高？A2 的世界给了你什么预期？
- **P4：** 三种条件下的端到端准确率怎么排序：闭卷（不给检索结果）、RAG（前 5 个块）、oracle（直接给正确的块）？
- **P5（选做）：** 微调向量模型之后，nDCG@10 能涨多少？

### 步骤

**第 1 部分：小语料、换块大小（约 10 分钟，CPU）**

```bash
python L1_rag.py --corpus planets --lang zh --chunk 128 --overlap 13
python L1_rag.py --corpus planets --lang zh --chunk 512 --overlap 51
python L1_rag.py --corpus planets --lang en --chunk 128 --overlap 13     # 英文：块大小按词计
```

中文没有空格，所以中文的块大小按**字**计，BM25 先用 jieba 分词；英文按词计。每次运行打印一张表：四种检索的 recall@k、MRR@10、nDCG@10 和每次查询的耗时。一个问题算"命中"，要求某个块**完整**包含它的标准句子：块边界正好把句子切断时，这个问题无论怎么检索都找不到，这正是 A2 讲的块大小代价。

**第 2 部分：SQuAD 上的规模评测**

```bash
python L1_rag.py                        # 默认 200 词一块、重叠 40，1,000 个问题，端到端回答前 100 个
python L1_rag.py --chunk 100 --overlap 20
```

脚本依次做这几件事（每一步都能在代码里找到同名的小节）：

1. **切块，生成 qrels**：记下每个块在原文里的字符区间；答案区间完整落在哪个块里，哪个块就是正确块。
2. **三种检索**：BM25（`rank_bm25`）；稠密检索用 `intfloat/multilingual-e5-small`，查询前加 `query: `、段落前加 `passage: `，向量归一化后放进 FAISS 内积索引（归一化之后，内积就是余弦）；混合检索用倒数排名融合（RRF）：每路结果给 `1/(60 + 名次)` 分，再相加。**不要把两路的原始分数直接相加**：BM25 的分数尺度会压过余弦。
3. **重排**：`BAAI/bge-reranker-base` 读入（问题，块）对，给混合检索的前 50 个重新打分排序。
4. **指标**：recall@{1, 5, 20, 50}、MRR@10、nDCG@10，以及每次查询的毫秒数。
5. **端到端回答**：`Qwen2.5-1.5B-Instruct` 在三种条件下回答，判分规则是"归一化之后，回答里包含标准答案"。RAG 答错的题自动分成两类：正确块不在前 5 里（FP2，没找到），和正确块在、回答却错了（FP4，没用上）。请再人工看 30 道，按 A2 的 FP1–FP7 细分。

**选做：微调向量模型**

```bash
python L1_rag.py --finetune
```

用 SQuAD **训练集**的（问题，段落）对（文章和验证集不重叠，避免泄漏），先用 `mine_hard_negatives` 挖难负例，再用 `MultipleNegativesRankingLoss` 训练一轮。批采样用 `NO_DUPLICATES`：同一批里如果出现重复的正例，它们会互相被当成负例。训练完**必须重新编码所有块、重建索引**，因为新查询向量和旧块向量不在同一个空间里。想看跨领域的效果，就用微调后的模型重跑第 1 部分。

### 记录什么

- 一张表：每种检索配置的 recall@k、MRR@10、nDCG@10 和耗时；
- 第 1 部分：不同块大小下的同一张表，中英文各一份；
- 三种条件的端到端准确率，以及 FP2、FP4 的数量和你人工细分的结果；
- 选做：微调前后，SQuAD（同领域）和行星语料（跨领域）的 nDCG@10。

### 预期结果（定性）

- **P1：** SQuAD 的问题和段落用词高度重合，所以 BM25 往往很强，稠密检索不一定赢。DPR 的论文就报告过：在 SQuAD 上 BM25 胜过它的稠密检索器，原因正是标注者看着段落写问题[^dpr]。混合检索通常最好，或接近最好。
- **P2：** recall@50 **一定不变**：重排只在这 50 个里调换顺序，不会把新的块放进来。recall@1 和 MRR 一般会上升。
- **P3：** 用真实数据检验 A2 世界里的结论。如果和世界不一致，照实写，并说明你认为原因是什么。
- **P4：** 一般是 oracle > RAG > 闭卷。oracle 和 RAG 的差距就是检索造成的损失；oracle 也答错的题，问题出在生成那一环。
- **P5：** 同领域通常能涨，跨领域可能不涨甚至下降。具体幅度以你的实测为准。

### 常见问题

- **E5 的 `query:` / `passage:` 前缀漏加，或者只加了一边：** 效果明显变差。
- **向量没归一化就用内积索引：** 算出来的不是余弦。
- **中文 BM25 没分词：** 几乎什么都检索不到。
- **交叉编码器最多读 512 个 token：** 长块的尾部会被悄悄截掉。
- **训练集和评测集来自同一批文章：** 指标虚高。要按文档划分。
- **微调后忘了重建索引：** 结果反而变差。
- **在 Mac 上程序卡住不动、CPU 占用为 0：** faiss-cpu 和 PyTorch 各带一份 OpenMP 运行库，在 macOS 上会互相锁死。脚本开头已经设了 `OMP_NUM_THREADS=1` 来避开它；如果你自己写代码，也要这样做。

### 和课程的对应

- A2 的块大小世界（第 1 部分，P3）；
- A2 的混合检索图：为什么不能把原始分数相加（第 2 步）；
- A2 的失败点 FP1–FP7（第 5 步）；
- A2 的对比学习（选做的 MNRL 损失）。

### 冒烟测试与已知缺口

- 在 Mac 上用微型模型（`stsb-bert-tiny`、`ms-marco-TinyBERT-L2`、一个随机初始化的两层 Qwen）跑通了：SQuAD 的 3 篇文章 20 个问题（含 `--finetune`），以及中文行星语料的第 1 部分。微型模型的数字没有意义，只说明代码能跑。
- 没有跑过：真实模型、完整数据、GPU。端到端回答的准确率、微调的提升幅度都还没有实测值。

[^dpr]: Karpukhin 等（2020）。Dense Passage Retrieval for Open-Domain Question Answering，§5.1。https://arxiv.org/abs/2004.04906

---

## English

### What this lab answers

When a RAG answer is wrong, which link broke? Was the right passage never found, or found and then ignored? The final answer alone cannot tell you. So this lab takes the pipeline apart: **evaluate retrieval on its own first, then the end-to-end answers**, and finally sort every error into a type.

You will compare four retrievers: BM25 (word overlap only), dense retrieval (vector similarity), a hybrid of the two, and the hybrid followed by a cross-encoder reranker. Then you test A2's chunk-size trade-off on real data. The optional part fine-tunes the embedding model to see how much it gains in its own domain, and what happens in another.

### Setup

- **Hardware:** retrieval runs fine on a CPU; end-to-end generation and the optional fine-tuning are best on a Colab T4.
- **Files:** upload `common.py`, `L1_rag.py` and `requirements.txt` from `code/` to Colab (or put them in one folder), then run `pip install -r requirements.txt`.
- **Part 1 data:** A2's eight planet articles and 12 hand-labelled questions (`corpus/<lang>/*.txt` and `questions.json` from the course files), in a folder `planets/`.
- **Part 2 data:** SQuAD v1.1 validation, downloaded by the script. Paragraphs of the same Wikipedia article are joined back into one document, then chunked. A chunk is "relevant" exactly when it contains the whole answer span, so no manual labels are needed.

### Predict first (the first column of your report)

- **P1:** On SQuAD, which has the higher recall@5, BM25 or dense retrieval? Hint: SQuAD's questions were written by annotators looking at the paragraph.
- **P2:** After reranking the hybrid's top 50, does recall@50 change? Does recall@1?
- **P3:** On the part 1 corpus, do 128- or 512-unit chunks find more answers? What did A2's world lead you to expect?
- **P4:** Rank the end-to-end accuracy of closed book (no retrieval), RAG (top 5 chunks) and oracle (the right chunk handed over).
- **P5 (optional):** How much does nDCG@10 gain from fine-tuning the embedding model?

### Steps

**Part 1: a small corpus, different chunk sizes (about 10 minutes, CPU)**

```bash
python L1_rag.py --corpus planets --lang en --chunk 128 --overlap 13
python L1_rag.py --corpus planets --lang en --chunk 512 --overlap 51
python L1_rag.py --corpus planets --lang zh --chunk 128 --overlap 13     # Chinese: sizes in characters
```

Chinese has no spaces, so Chinese chunk sizes count **characters** and BM25 segments with jieba first; English counts words. Each run prints one table: recall@k, MRR@10, nDCG@10 and milliseconds per query for the four retrievers. A question counts as found only when some chunk holds its **whole** gold sentence: when a chunk boundary cuts the sentence, no retriever can find it, which is exactly the chunk-size cost A2 talks about.

**Part 2: SQuAD at scale**

```bash
python L1_rag.py                        # default: 200-word chunks, overlap 40, 1,000 questions, first 100 answered end to end
python L1_rag.py --chunk 100 --overlap 20
```

The script does the following (each step is a section of the code with the same name):

1. **Chunks and qrels:** it records each chunk's character span; the chunk whose span holds the whole answer span is the right one.
2. **Three retrievers:** BM25 (`rank_bm25`); dense retrieval with `intfloat/multilingual-e5-small`, with `query: ` before questions and `passage: ` before chunks, normalised vectors in a FAISS inner-product index (after normalising, inner product is cosine); and a hybrid by reciprocal rank fusion (RRF), which gives every list `1/(60 + rank)` points and adds them. **Never add the raw scores:** BM25's scale would drown the cosines.
3. **Reranking:** `BAAI/bge-reranker-base` reads (question, chunk) pairs and reorders the hybrid's top 50.
4. **Metrics:** recall@{1, 5, 20, 50}, MRR@10, nDCG@10 and milliseconds per query.
5. **End to end:** `Qwen2.5-1.5B-Instruct` answers in the three conditions, scored by "after normalising, the answer contains the gold text". Wrong RAG answers are split automatically into the right chunk missing from the top 5 (FP2, not found) and the right chunk present but the answer still wrong (FP4, not used). Read 30 more by hand and sort them into A2's FP1–FP7.

**Optional: fine-tune the embedding model**

```bash
python L1_rag.py --finetune
```

It trains on (question, paragraph) pairs from SQuAD's **training** split (different articles from validation, so nothing leaks): hard negatives first, with `mine_hard_negatives`, then one epoch of `MultipleNegativesRankingLoss`. The batch sampler is `NO_DUPLICATES`, because a repeated positive in a batch would be treated as a negative of itself. Afterwards **every chunk must be re-embedded and the index rebuilt**: the new query vectors live in a different space from the old chunk vectors. For the out-of-domain check, rerun part 1 with the fine-tuned model.

### What to record

- One table: recall@k, MRR@10, nDCG@10 and latency for every retriever configuration;
- Part 1: the same table for each chunk size, in both languages;
- End-to-end accuracy in the three conditions, the FP2 and FP4 counts, and your hand-sorted types;
- Optional: nDCG@10 before and after fine-tuning, on SQuAD (in domain) and on the planet corpus (out of domain).

### Expected results (qualitative)

- **P1:** SQuAD's questions share many words with their paragraphs, so BM25 is often strong and dense retrieval does not necessarily win. The DPR paper reported exactly this: on SQuAD, BM25 beat its dense retriever, because annotators wrote the questions while looking at the passage[^dpr-en]. The hybrid is usually best or close to it.
- **P2:** recall@50 **cannot change**: reranking only reorders those 50, it never brings in a new chunk. recall@1 and MRR usually rise.
- **P3:** test A2's world against real data. If they disagree, say so and say why you think they do.
- **P4:** usually oracle > RAG > closed book. The gap between oracle and RAG is what retrieval costs; questions the oracle also gets wrong point at generation.
- **P5:** usually a gain in domain; out of domain it may not help, or may hurt. The size is whatever you measure.

### Common problems

- **E5's `query:` / `passage:` prefixes missing, or on one side only:** clearly worse results.
- **Inner-product index on unnormalised vectors:** that is not cosine.
- **Chinese BM25 without segmentation:** retrieves almost nothing.
- **The cross-encoder reads at most 512 tokens:** the end of a long chunk is silently cut.
- **Training and evaluation articles overlap:** inflated metrics. Split by document.
- **Index not rebuilt after fine-tuning:** results get worse, not better.
- **On a Mac the script hangs with 0% CPU:** faiss-cpu and PyTorch each bring an OpenMP runtime, and on macOS the two can deadlock. The script sets `OMP_NUM_THREADS=1` at the top to avoid it; do the same in your own code.

### Where this connects to the course

- A2's chunk-size world (part 1, P3);
- A2's hybrid-search figure: why raw scores must not be added (step 2);
- A2's failure points FP1–FP7 (step 5);
- A2's contrastive learning (the optional MNRL loss).

### Smoke test and known gaps

- Ran on a Mac with tiny models (`stsb-bert-tiny`, `ms-marco-TinyBERT-L2`, a randomly initialised two-layer Qwen): 3 SQuAD articles and 20 questions (including `--finetune`), and part 1 on the Chinese planet corpus. Tiny-model numbers mean nothing; they only show the code runs.
- Not run: the real models, the full data, a GPU. End-to-end accuracy and the fine-tuning gain have no measured values yet.

[^dpr-en]: Karpukhin et al. (2020). Dense Passage Retrieval for Open-Domain Question Answering, §5.1. https://arxiv.org/abs/2004.04906
