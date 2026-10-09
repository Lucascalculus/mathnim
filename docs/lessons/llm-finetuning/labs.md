# 实验教程大纲（L1–L5）

2026-10-10。对应 [README.md](README.md) 第 6 节：只给教程，不托管算力。

> **制作结果（2026-10-10）：** 教程在 `labs/L1-rag.md`、`L2-sft-lora.md`、`L3-dpo.md`、`L4-grpo.md`、`L5-distill.md`，代码在 `labs/code/`（`common.py`、各实验脚本、`grpo_minimal.py`、`requirements.txt`）。所有脚本都在 Mac 上用微型模型做过冒烟测试，尚未在 T4 上实跑。与本大纲的差异：L4 的主线改为 TRL + `Qwen2.5-0.5B-Instruct`（Unsloth 1.5B 作为未运行的选做路线）；L1 第 1 部分直接复用 A2 的行星语料；大模型评委默认用本地小模型，API 版本只从环境变量读密钥；没有单独做 Colab 笔记本。

制作阶段，每个实验写成一份中英双语教程（中文在前），放在 `labs/<lab>.md`（见 [BUILD.md](BUILD.md)），另附一个可以直接运行的 Colab 笔记本。出处标注沿用 [part-e-reasoning.md](part-e-reasoning.md) 的写法：[T§n]、[P§n]、[A§n]、[核对]。凡是写着"以实测为准"的数字，制作时都要先完整跑一遍，再把实测值写进教程。

## 0. 共同约定

**每个教程的固定结构：**
1. 目标；
2. 环境；
3. 运行前的预测，写在报告第一栏；
4. 逐步操作和关键代码；
5. 记录什么；
6. 预期结果和曲线；
7. 常见报错及处理；
8. 对应课程里的哪个交互。

**版本基线（2026-10）：**
- 用到的库：TRL 1.15、transformers 5.x、PEFT、vLLM、Unsloth、sentence-transformers ≥ 3.1、datasets、faiss-cpu、rank_bm25。中文实验另加 jieba。
- 每个笔记本的第一格打印所有版本号，并配一份锁定版本的 `requirements.txt`。
- TRL 1.15 和网上的旧教程有三处不同，教程里要专门提醒：
  - GRPO 的默认值已经变了：`loss_type="dapo"`、`beta=0.0`；
  - DPO 去掉了 `rpo_alpha` 和 `max_prompt_length`，在 chosen 上加 SFT 损失要写成 `loss_type=["sigmoid","sft"]`；
  - GKD 和 GOLD 挪到了 `trl.experimental` 下面。

**硬件：**
- Colab T4：16 GB 显存，不支持 bf16，也没有 FlashAttention 2。要设 `fp16=True, bf16=False`，并且不用 padding-free 打包。
- L4：24 GB，支持 bf16。
- A100：显存更大、速度更快。
- 注意：在 TRL 1.15 里，DPOConfig 和 GRPOConfig 在没设 `fp16` 时默认 `bf16=True`，放到 T4 上会直接报错。

**共用代码 `labs/common.py`（约 60 行）：**
- `extract_gsm8k`：从回答里抽出数字答案，支持 `#### n` 和 `<answer>n</answer>` 两种写法；
- `normalize_num`：把抽出来的数字归一化；
- `pass_at_k(n, c, k)`：pass@k 的无偏估计，推导见 E2-a；
- `eval_gsm8k(...)`：用 vLLM 批量生成，返回逐题的对错、回答长度和是否被截断；
- `CSVLogger`：把训练日志写进 CSV，方便画图和交作业。

**提交物：** 一份"预测 → 结果 → 解释"三栏报告，由 AI 导师按各实验的判分要点给反馈。"解释"一栏必须引用课里的一个交互或一条推导。

**实验之间的衔接：**
- L2、L4、L5 都用 GSM8K，评测都用 test 集的前 200 题，所以可以把 SFT、GRPO、蒸馏三条路并排比较。
- L4 写的评分器，L5 接着用。
- L1 单独成体系，语料和 A2 共用。

---

## L1 RAG 管线与检索评测（选做：微调向量模型）

- **目标：**
  - 搭一条"检索 → 重排 → 生成"的管线，把检索和端到端回答**分开**评测。
  - 比较 BM25、稠密检索、混合检索和重排。
  - 用真实数据复现 A2 讲的块大小权衡。
  - 用 A2 的 FP1–FP7 给失败分类。
  - 选做：微调向量模型，然后重建索引。
- **环境：**
  - 检索部分 CPU 就够；
  - 生成和选做的微调用 Colab T4。
- **数据：**
  - 第 1 部分用 A2 世界 `chunk_size_recall` 的那份公开文档和 12 个人工标注的问题。part-a 规定 L1 复用这份数据。
  - 第 2 部分用 SQuAD v1.1 dev 做规模评测：
    - 按 `title` 把段落拼回整篇文章，再切块；
    - 用 `answer_start` 自动生成 qrels：答案片段完整落在哪个块里，那个块就是正确块；
    - 抽 1,000 个问题。

    中文版换成 CMRC 2018 的 dev 集，做法相同（数据集 id 需核对）。

**运行前的预测**
- P1：在 SQuAD 上，BM25 和稠密检索谁的 recall@5 更高？提示：SQuAD 的问题是标注者看着段落写的。
- P2：对前 50 个结果做重排之后，recall@50 会变吗？recall@1 呢？
- P3：上下文预算固定为 1,024 token 时，块大小取 128 还是 512 命中率更高？
- P4：三种条件的端到端准确率怎么排序？
  - 闭卷：不给任何检索结果；
  - RAG：放前 5 个块；
  - oracle：直接把正确块放进上下文。
- P5（选做）：微调之后，nDCG@10 能涨多少？换一个领域，结果还一样吗？

**步骤和关键代码**
1. **切块，生成 qrels。** 按 token 切块，同时记下每块对应的字符区间：
   `qrels[qid] = {cid for cid, (s, e) in spans if s <= a0 and a0 + len(ans) <= e}`
2. **BM25。** `BM25Okapi([tokenize(c) for c in chunks])`。中文要先用 jieba 分词。
3. **稠密检索。** 向量模型和 A2 用的一致：
   ```python
   emb = SentenceTransformer("intfloat/multilingual-e5-small")
   D = emb.encode(["passage: " + c for c in chunks], normalize_embeddings=True, batch_size=64)
   index = faiss.IndexFlatIP(D.shape[1]); index.add(D)          # 归一化之后，内积就是余弦
   Q = emb.encode(["query: " + q for q in queries], normalize_embeddings=True)
   scores, ids = index.search(Q, 50)
   ```
4. **混合检索（RRF）。** `fused[c] += 1 / (60 + rank)`。不要把两路的原始分数直接相加，否则 BM25 的分数尺度会压过稠密检索（A2 图 F-A2-3）。
5. **重排。** 用 `CrossEncoder("BAAI/bge-reranker-base").predict([(q, chunks[i]) for i in top50])` 给前 50 个打分，再按分数重新排序。
6. **指标。**
   - 检索：recall@{1, 5, 20, 50}、MRR@10、nDCG@10。可以自己写（约 15 行），也可以用 `InformationRetrievalEvaluator`。
   - 每次查询的延迟也要记。
7. **生成。**
   - 用 Qwen2.5-1.5B-Instruct。提示里给出带编号的块，并要求"找不到依据就说不知道"。
   - 指标：归一化后"回答里包含标准答案"的比例，以及拒答率。
   - 三种条件都跑一遍：闭卷、RAG、oracle。
8. **失败归因。** 从 RAG 答错的题里抽 30 道，按 FP1–FP7 分类。例如：
   - 正确块没进前 k，记为 FP2；
   - 正确块进了上下文，回答却没用上，记为 FP4。
9. **选做：微调向量模型**（和 A2 的 K-A2-8 是同一套写法）：
   ```python
   pairs = Dataset.from_dict({"anchor": ["query: " + q for q in tr_q], "positive": ["passage: " + p for p in tr_ctx]})
   hard = mine_hard_negatives(pairs, emb, relative_margin=0.05, num_negatives=1)    # 训练用 SQuAD train，文章不和评测集重叠
   args = SentenceTransformerTrainingArguments(output_dir="e5-ft", per_device_train_batch_size=64,
       learning_rate=2e-5, num_train_epochs=1, fp16=True, batch_sampler=BatchSamplers.NO_DUPLICATES)
   SentenceTransformerTrainer(model=emb, args=args, train_dataset=hard,
       loss=MultipleNegativesRankingLoss(emb), evaluator=ir_eval).train()   # 训完要重新编码所有块，重建索引
   ```
   如果用的是自己的语料，可以让大模型为每个块合成几个查询（B2）。Databricks 报告过，用合成的同领域数据微调向量模型能带来提升 [A-缺 5]。

**记录什么**
- 一张表：每种检索配置的 recall@k、MRR@10、nDCG@10 和延迟；
- 三种条件下的端到端准确率和拒答率；
- 各类失败（FP）的数量；
- 选做：微调前后，同领域和跨领域的结果各一份。

**预期结果**
- P1：SQuAD 的问题和段落用词重合多，BM25 往往很强，稠密检索不一定赢；混合检索通常最好，或者接近最好。这是常见情况，以实测为准。
- P2：recall@50 **一定**不变，因为重排只是在前 50 个里调换顺序。recall@1 和 MRR 一般会上升。
- P3：用真实数据检验 A2 世界里的结论。如果数据和世界不一致，照实写。
- P4：一般是 oracle > RAG > 闭卷。oracle 和 RAG 之间的差距，就是检索造成的损失。
- P5：同领域一般能涨几个点，跨领域可能反而下降。以实测为准。

**常见报错及处理**
- E5 的 `query:` / `passage:` 前缀漏加，或者只加了一边：效果会明显变差。
- 向量没归一化就用内积索引：算出来的不是余弦。
- 过滤掉空块之后没重新编号：块的 id 和索引的行号对不上。
- 训练集和评测集来自同一批文章：指标会虚高。要按文档划分。
- MNRL 的批里出现重复的正例：它们会被当成负例。用 `BatchSamplers.NO_DUPLICATES`。
- 中文 BM25 没分词：几乎检索不到东西。
- CrossEncoder 最多读 512 个 token：长块的尾部会被截掉。
- 微调之后忘了重建索引：查询向量和旧索引不在同一个空间里。

**对应交互：** A2 的 `chunk_size_recall`（第 1 部分）、`contrastive_infonce`（选做）、`rag_pipeline`（失败点）。

---

## L2 LoRA SFT：掩码、秩、学习率

- **目标：**
  - 在 GSM8K 上做 LoRA SFT，用对照实验检验三件事：损失掩码、秩、学习率；
  - 亲手造出一次"模型停不下来"的 bug；
  - 导出一层的 ΔW，给 C2 的 `lowrank_update` 当数据。
- **环境：** Colab T4，用 fp16。每组跑 300 步，大约 10–15 分钟，以实测为准。
- **模型和数据：**
  - 模型：Qwen2.5-0.5B **基座**，正好用来演示聊天模板和 EOS 的问题；part-c 的 `lowrank_update` 也用这个模型。
  - 数据：GSM8K 训练集，共 7,473 条，转成 prompt-completion 格式。

**运行前的预测**
- P1：在所有线性层上加 r=16 的 LoRA，可训练参数有多少？
  - 答案：每层所有线性层的 Σ(d_in+d_out) = 22,912，乘以 16 再乘以 24 层，约 8.8M，占总参数的约 1.8%。
  - 这里用的配置是 hidden 896、intermediate 4864、KV 维度 128，以 `config.json` 为准。
  - 跑完用 `print_trainable_parameters()` 核对。
- P2：先用 C1 的 `vram_calculator` 估一下峰值显存，再和 `torch.cuda.max_memory_allocated()` 对照。
- P3：掩码开和关，准确率会差多少？这两次运行的 train loss 能直接比较吗？
- P4：α 固定为 32，r 取 1、16、64，前 100 步的 loss 曲线会是什么样？
- P5：学习率取 2e-5、2e-4、2e-3，哪个最好？
- P6：不设 `eos_token`，会发生什么？

**步骤和关键代码**
1. **安装。** `pip install "trl==1.15.*" peft datasets accelerate`，然后打印 GPU 型号。如果是 T4，设 `fp16=True, bf16=False`。
2. **准备数据。**
   ```python
   def to_pc(ex):
       steps, ans = ex["answer"].split("####")
       return {"prompt": [{"role": "user", "content": ex["question"]}],
               "completion": [{"role": "assistant", "content": steps.strip() + "\n#### " + ans.strip()}]}
   ```
3. **训练前先测基线。** 三个指标：
   - 准确率；
   - 格式率：能抽出 `#### n` 的比例；
   - 停止率：在长度上限之前就生成了 EOS 的比例。
4. **基础配置 R0。**
   ```python
   peft_cfg = LoraConfig(r=16, lora_alpha=32, lora_dropout=0.0, target_modules="all-linear", task_type="CAUSAL_LM")
   args = SFTConfig(output_dir="r0", max_steps=300, learning_rate=2e-4, per_device_train_batch_size=8,
       gradient_accumulation_steps=2, max_length=512, completion_only_loss=True,
       eos_token="<|im_end|>",                      # Qwen 基座必须设 [T§2]
       fp16=True, bf16=False, logging_steps=10, eval_strategy="steps", eval_steps=100)
   trainer = SFTTrainer(model="Qwen/Qwen2.5-0.5B", args=args, train_dataset=train,
                        eval_dataset=val, peft_config=peft_cfg)
   ```
5. **对照组。** 每组只改一处：
   - R1：`completion_only_loss=False`；
   - R2：`r=1`；
   - R3：`r=64`（α 仍然是 32）；
   - R4：学习率 2e-5；
   - R5：学习率 2e-3；
   - R6：去掉 `eos_token`。
6. **评测。**
   - 贪心解码，`max_new_tokens=300`。想快一点，可以用 vLLM 加载 LoRA（`enable_lora=True`）。
   - 另外自己算一个"只在回答部分计算"的验证损失。只有这样，R0 和 R1 的损失才能比较。
7. **给 C2 导出数据。** 从 R0 中取第 12 层的 `q_proj` 和 `down_proj`，算出 ΔW = (α/r)·B·A，存成 `.npy`。

**记录什么**
- train loss，以及只在回答部分计算的验证损失；
- 准确率、格式率、停止率、平均回答长度；
- 可训练参数量、峰值显存、每步耗时。

**预期结果**
- **格式率**：从接近 0 升到很高。准确率能涨多少，要等制作时实测后写进教程。
- **R1 对 R0（掩码）**：准确率差别应该不大，因为 GSM8K 的提示短、回答长，这种情况下提示部分加不加权重影响很小 [T§2]。两次的 train loss 不能直接比，因为分母里的 token 数不一样。
- **R2、R3 对 R0（秩）**：前 100 步的曲线几乎重合。这是 1/r 缩放的作用 [T§4, P§3.4]。
- **R4、R5 对 R0（学习率）**：R4 学得很慢；R5 可能发散，或者效果变差。依据是 LoRA 的学习率约为全量微调的 10 倍 [T§2]。
- **R6（不设 EOS）**：停止率很低，模型会一直往下写。

**常见报错及处理**
- **"bf16 需要计算能力 ≥ 8.0"**：说明在 T4 上开了 bf16，改成 fp16。
- **"Attempting to unscale FP16 gradients"**：可训练参数被转成了 fp16。不要对整个模型调用 `.half()`，适配器要保持 fp32。
- **模型停不下来**：EOS 和聊天模板里的结束符不一致。检查 `generation_config.eos_token_id`。
- **`assistant_only_loss=True` 报错**：聊天模板里缺少 `{% generation %}` 标记 [T§2]。
- **显存不够**：减小 `max_length` 或批大小。SFTConfig 默认已经开了梯度检查点。
- **loss 很快降到接近 0**：检查三件事：数据有没有重复，学习率是不是太大，答案是不是泄露进了 prompt。

**对应交互：**
- B1 的 `token_loss_mask`（P3）和 `pad_eos_trap`（R6）；
- C1 的 `vram_calculator`（P2）；
- C2 的 `lowrank_update`（第 7 步导出的数据）；
- B3 的 `two_valleys_forgetting`（学习率）。

---

## L3 DPO：观察似然位移

- **目标：**
  - 跑一次 DPO，记录 chosen 和 rejected 的 log 概率，亲眼看到"损失在降，chosen 的概率也在降"；
  - 比较不同的 β；
  - 比较"相似的偏好对"和"差别大的偏好对"；
  - 加一项 SFT 损失来缓解似然位移。
- **环境：** Colab T4，LoRA，fp16。训练 5,000 对，评测 500 对。每组大约 20–30 分钟，以实测为准。
- **模型和数据：** Qwen2.5-0.5B-Instruct；数据集 `trl-lib/ultrafeedback_binarized`，这是 TRL 文档里的示例数据。

**运行前的预测**
- P1：训练过程中，`logps/chosen` 会上升还是下降？
- P2：把 β 从 0.1 降到 0.01，margin 和两个 log 概率会怎么变？
- P3：相似的偏好对和差别大的偏好对，哪一组的 chosen 概率掉得更多？
- P4：加上 SFT 损失之后会怎样？
- P5：做完 DPO，回答会变长还是变短？

**步骤和关键代码**
1. **过滤数据，记录两个量。**
   - 只保留长度不超过 `max_length=1024` 的样本。TRL 1.15 只支持 `keep_start` 截断，超长的样本会被截掉回答。
   - 给每一对记两个量：
     - **长度比例**：chosen 的长度除以 rejected 的长度；
     - **相似度**：用 L1 的 e5 模型算 chosen 和 rejected 的余弦相似度。这是 CHES 的简化替代 [T§5]，需要标注。
   - 按相似度分组：最高的 20% 作为"相似对"，最低的 20% 作为"差别大的对"。
2. **基础配置。**
   ```python
   args = DPOConfig(output_dir="dpo-b0.1", beta=0.1, learning_rate=1e-5,   # LoRA 的学习率，参照 TRL 文档的建议
       per_device_train_batch_size=4, gradient_accumulation_steps=4, max_length=1024, num_train_epochs=1,
       logging_steps=10, eval_strategy="steps", eval_steps=50, fp16=True, bf16=False)
   trainer = DPOTrainer(model="Qwen/Qwen2.5-0.5B-Instruct", args=args, train_dataset=tr, eval_dataset=ev,
       peft_config=LoraConfig(r=16, lora_alpha=32, target_modules="all-linear"))
   ```
   用 LoRA 时，参考模型就是"关掉适配器的初始策略"，不用在显存里再放一份模型。
3. **对照组。**
   - R1：β = 0.01；
   - R2：β = 0.5；
   - R3：只用相似对；
   - R4：只用差别大的对；
   - R5：`loss_type=["sigmoid","sft"], loss_weights=[1.0, 0.2]`，也就是在 chosen 上加一项 NLL。Llama 3 也加了类似的一项，权重 0.2 来自二手资料，不确定 [T§5]。
4. **训练后。** 每个模型在同样的 50 个提示上生成，比较平均长度，再人工看 10 条。

**记录什么**
- TRL 自带的日志：`loss`、`rewards/accuracies`、`rewards/margins`、`rewards/chosen`、`rewards/rejected`、`logps/chosen`、`logps/rejected`、`entropy`。训练集和评测集都要记。
- 生成回答的长度。
- 按相似度分组、按长度比例分组，各算一遍 `logps/chosen` 的变化。这是 part D 要的四项记录：两个 log 概率、长度比例、相似度。

**预期结果**
- `rewards/accuracies` 很快超过 0.5。
- `logps/rejected` 比 `logps/chosen` 掉得快，但 `logps/chosen` 往往也在下降。TRL 文档里有一句原话："typically achieved by suppressing the likelihood of dispreferred completions"。
- 相似对的似然位移更严重 [T§5, P§2]。
- R5 能托住 `logps/chosen`，代价是 margin 涨得慢一些。
- 生成的回答通常会变长，这是长度偏差 [T§5]。
- 以上都是常见现象，具体幅度以实测为准。

**常见报错及处理**
- **T4 上报 bf16 错误**：DPOConfig 默认 `bf16=True`，要显式写 `fp16=True, bf16=False`。
- **显存不够**：
  - 用 LoRA；
  - 或者设 `precompute_ref_log_probs=True`，先算好参考模型的 log 概率，训练时就不用放参考模型；
  - 缩短 `max_length`。
- **旧教程里的 `rpo_alpha`、`max_prompt_length` 报"未知参数"**：TRL 1.15 已经去掉了这两个参数。前者改用第 3 步 R5 的写法，后者改用 `max_length`。
- **回答被截断**：按第 1 步先过滤，不要依赖截断。
- **学习率太高**：生成变成乱码，两个 `logps` 一起崩。
- **处理类没有 pad token**：TRL 会用 eos 代替。要确认是在左边填充。

**对应交互：**
- D3 的 `dpo_gap_plane` 和图 F-D3-4：P1、P3 是在真实训练里复现似然位移；
- D2 的 `kl_leash_policy`：P2，β 的作用。

---

## L4 在 GSM8K 上做 GRPO：自己写评分器

- **目标：**
  - **自己写一个评分器并测试它**：规则验证器加格式奖励，再配一组对抗测试。选做：用大模型当评委。
  - 用 4 位量化加 LoRA 跑 GRPO，记录奖励、回答长度和零方差组的比例。
  - 比较不同的 `loss_type` 和 G。
  - 故意用一个宽松的评分器，看模型怎么钻空子。
  - 关掉基线做一次对照。
  - 比较训练前后的 pass@k。
- **环境：**
  - Colab T4：Qwen2.5-1.5B-Instruct，4 位量化加 LoRA，用 Unsloth（内置 vLLM 快速生成）。
  - 有 L4 可以换成 3B。
  - T4 上跑 250 步大约 1–2 小时，以实测为准。

**运行前的预测**
- P1：先用基座对 200 道训练题各采 16 次，估出每道题的成功率 p̂。用 E1 的公式 p^G + (1−p)^G 算出第 1 步的 `frac_reward_zero_std`，再和日志对照。
- P2：训练过程中，`frac_reward_zero_std` 会怎么变？
- P3：`loss_type="grpo"` 和 `"dapo"` 相比，错误回答的长度有什么不同？
- P4：G 从 8 改成 4，零方差的比例会变成多少？用公式算。
- P5：用宽松的评分器，模型会学会什么？
- P6：去掉基线以后，奖励曲线和梯度范数会怎样？
- P7：训练前后，pass@1 和 pass@16 谁涨得多？

**步骤和关键代码**
1. **安装。** 装 Unsloth，它会锁定兼容的 TRL 和 vLLM 版本。装完打印所有版本号。
2. **加载模型。** 具体 API 以 Unsloth 官方的 GRPO 笔记本为准。
   ```python
   model, tok = FastLanguageModel.from_pretrained("Qwen/Qwen2.5-1.5B-Instruct", max_seq_length=1024,
       load_in_4bit=True, fast_inference=True, max_lora_rank=16, gpu_memory_utilization=0.6)
   model = FastLanguageModel.get_peft_model(model, r=16, lora_alpha=16, use_gradient_checkpointing="unsloth",
       target_modules=["q_proj", "k_proj", "v_proj", "o_proj", "gate_proj", "up_proj", "down_proj"])
   ```
3. **写评分器（本实验的核心）。**
   ```python
   NUM = r"-?\d[\d,]*\.?\d*"
   def parse(text):                                    # 必须恰好有一个 <answer>，否则判 None
       tags = re.findall(r"<answer>\s*(" + NUM + r")\s*</answer>", text)
       return float(tags[0].replace(",", "")) if len(tags) == 1 else None
   def correctness(completions, gold, **kw):          # 对话格式下，回答文本在 c[0]["content"]
       return [1.0 if (a := parse(c[0]["content"])) is not None and abs(a - float(g)) < 1e-6 else 0.0
               for c, g in zip(completions, gold)]
   ```
   **训练前先跑对抗测试**，期望结果如下：

   | 回答 | 期望得分 | 测的是什么 |
   |---|---|---|
   | `<answer>42.0</answer>` | 对 | 数值归一化 |
   | `<answer>1,000</answer>`（标准答案 1000） | 对 | 千位分隔符 |
   | "可能是 41、42 或 43" | 0 | 列出多个数字 |
   | 两个 `<answer>` 标签 | 0 | 多个答案 |
   | 空回答 | 0 | 空输入 |

   然后从基座的输出里抽 50 条，人工判一遍，算出评分器和人工的一致率（E1 规则 E1-3）。
   **选做：** 用 vLLM 跑一个本地小模型当评委，给它评分细则，比较它和规则评分器的一致率和耗时。
4. **训练前先测基线。** 用 vLLM 对 200 道测试题各采 16 次，温度 1.0。得到逐题的 p̂、pass@1，以及 k=1…16 的 pass@k。
5. **基础配置。**
   ```python
   args = GRPOConfig(output_dir="grpo-r0", num_generations=8, per_device_train_batch_size=8,
       gradient_accumulation_steps=2, max_completion_length=512, max_steps=250, learning_rate=5e-6,
       beta=0.0, loss_type="dapo", epsilon_high=0.28, scale_rewards="group",
       mask_truncated_completions=True, temperature=1.0, logging_steps=5)
   trainer = GRPOTrainer(model=model, processing_class=tok, reward_funcs=[correctness, fmt],
                         args=args, train_dataset=train)
   ```
6. **对照组。**
   - R1：`loss_type="grpo"`，即原版的"每条回答内按长度平均"。
   - R2：`num_generations=4`。
   - R3：宽松评分器 `1.0 if gold in text else 0.0`。严格评分器照样运行，但只记录分数，不参与训练。
   - R4（选做）：`beta=0.04`，日志里会多出 `kl`。
   - R5（选做）：LoRA `r=1`，检验 E2 所说的"秩 1 就够"。
   - R6（选做，关掉基线）：TRL 不提供关掉组均值基线的开关，所以 R6 改用 `labs/grpo_minimal.py`。这是一个约 120 行的从零实现的循环，核心是 E1 的代码 E1-code-1。用 Qwen2.5-0.5B-Instruct 跑 100 步，对比优势取 `r` 和取 `r - mean` 两种情况下的奖励曲线和梯度范数的波动。
7. **训练后。** 重复第 4 步的评测，画出训练前后两条 pass@k 曲线，统计覆盖率。另外把 R3 里奖励最高的 20 条拿出来人工看。

**记录什么**
- 奖励：`reward`、`rewards/correctness/mean`、`rewards/fmt/mean`、`reward_std`、`frac_reward_zero_std`。
- 长度：`completions/mean_length`、`completions/mean_terminated_length`、`completions/clipped_ratio`。
- 训练动态：`entropy`、`clip_ratio/*`、`kl`（只有 R4 有）、`sampling/*`（训练和推理是否不一致）。
- 评测：每 50 步测一次留出集的 pass@1。R3 另记严格评分器的分数，R6 另记梯度范数。

**预期结果**
- 格式奖励几十步内就饱和，正确率涨得比较慢。以实测为准。
- 第 1 步的 `frac_reward_zero_std` 应该接近 P1 算出的值。之后简单题被"做满"，这个比例会上升。
- R1 的错误回答更长。250 步里差别可能不明显，要把正确回答和错误回答分开统计长度。
- R2 的零方差比例更高，具体数值和公式算出的对照。
- R3 的宽松奖励一路上涨，严格评分器的分数却不涨，甚至下降。如果 250 步里还没出现"列出好几个数"的行为，就改为统计"宽松评分器给 1、严格评分器给 0"的样本占多少。
- pass@1 涨得比 pass@16 多，pass@16 可能基本不动。
- R5 和秩 16 的结果接近 [T§4]。
- R6 的梯度范数波动明显更大，学得更慢。这对应 D2 讲的"均值不变、方差塌缩"。
- 以上数值以实测为准。

**常见报错及处理**
- **"有效批大小必须能被 `num_generations` 整除"**：调整每卡批大小或梯度累积步数。
- **vLLM 显存不够**：调低 `gpu_memory_utilization`。
- **奖励函数出错**：常见原因有四种：
  - 返回的列表长度和回答数不一致；
  - 列表里有 None；
  - 函数签名里没写 `**kwargs`；
  - 把对话格式的回答当成了字符串。
- **奖励全是 0**：先打印 5 条回答看看。常见原因是正则写得太严、系统提示没生效，或者模型把答案写在了标签外面。
- **`completions/clipped_ratio` 很高**：提高 `max_completion_length`，或者保持 `mask_truncated_completions=True`。
- **奖励在涨，留出集不涨**：先查评分器（参考 R3），再看 `sampling/*`，排查训练和推理不一致（E2）。
- **版本冲突**：用 Unsloth 笔记本锁定的版本。

**对应交互：**
- E1 的 `grpo_group`：导师可以把日志里一组真实的奖励画出来；
- E1 的零方差曲线图（P1、P4）；
- E1 第 14 段讲评分器、第 15 段的找漏洞题（第 3 步和 R3）；
- D2 的 `pg_baseline`（R6）；
- E2 的 `pass_k_sharpen`（第 7 步）；
- C2、E2 的"秩 1 就够"（R5）。

---

## L5（选做）序列级蒸馏：用老师的推理轨迹训练小模型

- **目标：**
  - 先对老师生成的推理轨迹做拒绝采样，再用留下的轨迹做 SFT。
  - 和 L2（人写的解答）、L4（GRPO）比较准确率、回答长度、pass@k 和算力。
  - 选做：用 GKD 做在线蒸馏，比较 β=0 和 β=1。
- **环境：**
  - 学生：在 T4 上训练 Qwen2.5-1.5B-Instruct 加 LoRA，基座和 L4 相同。
  - 老师：生成轨迹需要 L4 或 A100 跑 vLLM。也可以直接用现成的轨迹数据，例如 `open-r1/OpenR1-Math-220k`（id 需核对）。但它比 GSM8K 难，轨迹也更长。
- **老师模型：** 任何开源推理模型都可以，例如 Qwen3-4B 的思考模式。序列级蒸馏不要求师生用同一个分词器。

**运行前的预测**
- P1：拒绝采样会丢掉哪些题？丢掉之后，训练集的难度分布会怎么变？（B2）
- P2：GPU 小时相近时，蒸馏出来的学生和 L4 的 GRPO 学生，谁的 pass@1 更高？
- P3：蒸馏之后，回答会变长还是变短？
- P4：老师的轨迹平均约 800 token，如果评测时设 `max_new_tokens=256`，会怎样？
- P5：比较 pass@16，蒸馏和 GRPO 哪个的覆盖率更高？
- P6（选做）：GKD 取 β=1 和 β=0，哪个采样出来的回答更多样？

**步骤和关键代码**
1. **生成轨迹。**
   ```python
   llm = LLM(model="Qwen/Qwen3-4B", max_model_len=4096, gpu_memory_utilization=0.85)
   sp = SamplingParams(n=4, temperature=0.6, top_p=0.95, max_tokens=2048)
   outs = llm.chat([[{"role": "user", "content": q + FORMAT_INSTR}] for q in questions], sp)
   ```
2. **拒绝采样。**
   - 用 L4 写的评分器判对错，只保留做对的；
   - 丢掉被截断的，即 `finish_reason == "length"`；
   - 每道题最多留 2 条，并去重；
   - 记录每道题的接受率。
3. **整理格式。** 用 prompt-completion 格式。completion 必须以答案加 EOS 结尾。`<think>` 标签可以留，也可以去掉，但训练和评测要保持一致。
4. **SFT。** 沿用 L2 的配方：LoRA r=16，学习率 2e-4，`max_length=2048`，训练 2 轮，开梯度检查点。T4 上不用 padding-free 打包。
5. **评测。**
   - 设 `max_new_tokens=2048`，测 pass@1、n=16 的 pass@k、平均长度和截断率。
   - 再用 `max_new_tokens=256` 测一组，检验 P4。
6. **汇总对照表。**
   - 行：基座、L2、L4、L5；
   - 列：准确率、pass@16、平均长度、GPU 小时（L5 要把生成轨迹的时间也算进去）。
7. **选做：在线蒸馏。** 师生要用同一个分词器家族：
   ```python
   from trl.experimental.gkd import GKDConfig, GKDTrainer
   args = GKDConfig(output_dir="gkd-b1", lmbda=1.0, beta=1.0, max_new_tokens=256, temperature=0.9,
                    learning_rate=1e-5, per_device_train_batch_size=4, fp16=True, bf16=False)
   GKDTrainer(model="Qwen/Qwen2.5-0.5B-Instruct", teacher_model="Qwen/Qwen2.5-1.5B-Instruct", args=args,
              train_dataset=msgs, peft_config=LoraConfig(r=16, target_modules="all-linear")).train()
   ```
   - 再跑一组 `beta=0.0`。
   - 多样性用两个指标衡量：8 次采样里有几个不同的最终答案，有几种不同的开头句。
   - 师生分词器不同时，改用 `trl.experimental.gold`，并设 `use_uld_loss=True`。

**记录什么**
- 接受率，按题目难度分组；
- 轨迹的条数和长度分布；
- train loss；
- 准确率、pass@k、回答长度、截断率；
- GPU 小时；
- 选做部分：两种 β 下的准确率和多样性。

**预期结果**
- 学生会学到老师的风格：回答变长，出现 "wait" 这样的自我检查。准确率比基座高多少，以实测为准。
- P4 的结果是确定的：大部分回答被截断，抽不出答案，准确率大幅下降。
- 拒绝采样会让最难的那些题从训练集里消失（B2）。
- 选做部分：β=1（接近反向 KL）采出来的回答，通常不如 β=0 的多样。

**常见报错及处理**
- **训练数据里混进了被截断的轨迹**：模型学会"不写完"。应该按长度过滤掉，不要截断。
- **completion 末尾没有 EOS**：模型停不下来。和 L2 的 R6 是同一个问题。
- **师生的模板不一致**（例如 `<think>` 有时有、有时没有）：评测时抽不出答案。
- **2k 长度在 T4 上显存不够**：每卡批大小设为 1，加梯度累积，开梯度检查点；还不行就换成 0.5B 的学生。
- **GKD 显存不够**：GKD 要同时放两个模型，还要生成。用小模型、加 LoRA，`max_new_tokens=256`。
- **实验性 API 改名**：GKD 和 GOLD 是实验性 API，升级版本可能改名或改参数。锁定 TRL 版本。
- **教程里要写明的风险**：老师模型的许可证和服务条款；老师可能见过 GSM8K 的测试题，存在数据污染。

**对应交互：**
- E3 的 `forward_reverse_kl`：选做部分的 β；
- E2 的 `pass_k_sharpen`：P5；
- B2 的 `rejection_sampling_yield`：P1。

---

## 附：时间和算力粗估

以下都是粗估，制作时实测后改写。

| 实验 | 推荐 GPU | 峰值显存 | 每组时间 | 组数 |
|---|---|---|---|---|
| L1 | CPU；生成和微调用 T4 | 6 GB 以下 | 检索 10–20 分钟；微调约 15 分钟 | 6 种检索配置，另有 1 组选做 |
| L2 | T4 | 6–10 GB | 10–15 分钟 | 7 |
| L3 | T4 | 8–12 GB | 20–30 分钟 | 6 |
| L4 | T4 或 L4 | 12–15 GB | T4 上 1–2 小时 | 3 组必做，3 组选做 |
| L5 | 生成用 L4 或 A100，训练用 T4 | 生成约 20 GB；训练 10–14 GB | 生成约 1 小时（2,000 题 × 4 条）；SFT 约 1 小时 | 1 组，另有 2 组选做 |

**待确认：**
1. 教程里的真实数字（准确率、耗时、显存），需要有人在 T4 和 L4 上各完整跑一遍。
2. CMRC 2018 和 OpenR1-Math 在 HF 上的数据集 id 和许可证。
3. L4 选做的大模型评委：用本地小模型，还是让学生自己选 API？用 API 要付费，学生还要有自己的密钥。
4. L4 的 R6 需要一个从零实现的训练脚本 `labs/grpo_minimal.py`（约 120 行），制作 L4 时一起写。
