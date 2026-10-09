# L3 DPO：观察似然位移 / L3 DPO: watching the likelihood shift

> **状态：** 代码已在 Mac（CPU）上用微型模型和一个十几对的小偏好数据集做过冒烟测试，**尚未在 T4 上实跑**。下面的"预期结果"是定性的，来自所引资料，不是本实验的实测数字。
>
> **Status:** smoke-tested on a Mac (CPU) with a tiny model and a preference set of a dozen pairs; **not yet run on T4**. The expected results are qualitative, from the cited sources, not measured here.

[中文](#中文) · [English](#english)

---

## 中文

### 这个实验要回答什么

D3 的世界里你看到过一件反直觉的事：DPO 的损失一直在降，被选回答（chosen）的概率却也在降。DPO 只要求"被选回答比被拒回答（rejected）更可能"，它只看两者的**差距**，不管两者各自往哪走。这叫**似然位移**。

这个实验在真实模型上把它找出来，并回答三个问题：

1. β 变小（缰绳变松）时，两个 log 概率怎么变？
2. 两个回答越相像，被选回答是不是掉得越多？
3. 在被选回答上加一项 SFT 损失，能不能把它托住？代价是什么？

### 准备

- **硬件：** Colab T4，LoRA，fp16。默认训练 5,000 对、评测 500 对。
- **文件：** `common.py`、`L3_dpo.py`、`requirements.txt`。
- **模型和数据：** `Qwen2.5-0.5B-Instruct`；`trl-lib/ultrafeedback_binarized`（TRL 文档里的示例数据）。
- **参考模型：** 用 LoRA 时，参考模型就是"关掉适配器的同一个模型"，不用在显存里再放一份。

### 运行前先预测

- **P1：** 训练过程中，`logps/chosen` 会上升还是下降？
- **P2：** 把 β 从 0.1 降到 0.01，margin 和两个 log 概率会怎么变？
- **P3：** 相似的偏好对和差别大的偏好对，哪一组的被选回答掉得更多？
- **P4：** 加上 SFT 损失之后会怎样？
- **P5：** 做完 DPO，回答会变长还是变短？

### 步骤

```bash
python L3_dpo.py --run R0       # β = 0.1，全部偏好对
python L3_dpo.py --run R1       # R1…R5：每组只改一处
```

| 运行 | 改了什么 |
|---|---|
| R0 | β = 0.1，全部偏好对 |
| R1 / R2 | β = 0.01 / β = 0.5 |
| R3 | 只用最相似的 20% |
| R4 | 只用最不相似的 20% |
| R5 | `loss_type=["sigmoid","sft"]`, `loss_weights=[1.0, 0.2]`：在被选回答上加一项 NLL |

脚本做的事：

1. **整理数据，先过滤再训练。** UltraFeedback 把整段对话放在 chosen 和 rejected 里，脚本先把共同的提示拆出来。超过 `max_length=1024` 的对直接**丢掉**：TRL 1.15 只支持 `keep_start` 截断，截断会剪掉回答的结尾。
2. **给每一对量两个数。** **长度比**：被选回答的 token 数除以被拒回答的；**相似度**：用 L1 的 e5 向量模型算两个回答的余弦相似度。这是 D3 里 CHES 的一个便宜的替代品：CHES 用的是模型自己的隐藏状态，这里用的是另一个模型的句向量，所以只能当近似。
3. **训练。**
   ```python
   args = DPOConfig(beta=0.1, learning_rate=1e-5, per_device_train_batch_size=4, gradient_accumulation_steps=4,
                    max_length=1024, num_train_epochs=1, **device_setup())    # T4 上必须显式 fp16：DPOConfig 默认开 bf16
   trainer = DPOTrainer(model="Qwen/Qwen2.5-0.5B-Instruct", args=args, train_dataset=tr, eval_dataset=ev,
                        peft_config=LoraConfig(r=16, lora_alpha=32, target_modules="all-linear"))
   ```
4. **训练后逐对测量。** 对每个评测对，分别在"关掉适配器"（参考模型）和"打开适配器"（训练后）下算 log p(chosen) 和 log p(rejected)，得到两个变化量，再按相似度、按长度比分组求平均。
5. **生成。** 在 50 个提示上，训练前、训练后各贪心生成一次，比较平均长度；再人工看 10 条。

### 记录什么

- TRL 的日志（`log.csv`）：`loss`、`rewards/accuracies`、`rewards/margins`、`rewards/chosen`、`rewards/rejected`、`logps/chosen`、`logps/rejected`，训练集和评测集都有；
- `pairs.csv`：每一对的相似度、长度比、两个 log 概率的变化；
- `summary.json`：被选回答 log 概率下降的比例；按相似度（前 20% 对后 20%）和长度比分组的平均变化；训练前后的平均回答长度。

### 预期结果（定性）

- `rewards/accuracies` 很快超过 0.5，margin 一路变大。
- `logps/rejected` 比 `logps/chosen` 掉得快，但 **`logps/chosen` 往往也在降**：DPO 拉开差距，很多时候是靠把两者一起往下压、被拒的压得更多[^razin]。
- **P2：** β 越小，要让损失降下来，两个回答的 log 比就得拉得越开，模型离参考模型走得越远，两个 log 概率的变化通常也更大（D2b 的缰绳）。
- **P3：** 相似的对位移更严重。Razin 等人发现，两个回答在模型看来越像，被选回答被挤走得越厉害；在他们的实验里，去掉最相像的那些对，效果比加 SFT 项还好[^razin]。
- **P4（R5）：** SFT 项能托住 `logps/chosen`，代价是 margin 涨得慢一些（D3 的选做世界）。Llama 3 也在 DPO 上加了类似的一项[^llama3]。
- **P5：** 回答通常会变长（D3 讲过的长度偏差）。请把长度变化和人工看的 10 条一起写进报告。
- 以上是常见现象，幅度以实测为准。

### 常见问题

- **T4 上报 bf16 错误：** DPOConfig 在没设 `fp16` 时默认 `bf16=True`。用脚本的 `device_setup()`。
- **显存不够：** 用 LoRA；或设 `precompute_ref_log_probs=True`，先算好参考模型的 log 概率；或缩短 `max_length`。
- **旧教程里的 `rpo_alpha`、`max_prompt_length` 报"未知参数"：** TRL 1.15 已经去掉。前者改用 R5 的写法，后者用 `max_length`。
- **回答被截断：** 按第 1 步先过滤，不要依赖截断。
- **学习率太高：** 生成变成乱码，两个 log 概率一起崩。
- **在 Mac 上跑不起来：** 同 L2，TRL 1.15 需要 Triton（只有 Linux 有）。

### 和课程的对应

- D3 的 `dpo_gap_plane`：P1、P3 是在真实训练里复现"损失降了，回答没了"；R5 对应它的选做世界（+NLL）；
- D2b 的 `kl_leash_policy`：P2，β 的作用；
- L1 的向量模型：这里拿来量相似度。

### 冒烟测试与已知缺口

- 在 Mac 上用随机微型 Qwen 和 `trl-internal-testing/zen` 的十几对数据跑通了 R3（按相似度取子集）和 R5（加 SFT 项）：过滤、测量、训练、逐对测量、生成都能走完。微型模型的数字没有意义。
- 没有跑过：UltraFeedback 全量、真实模型、GPU。似然位移的幅度、长度变化都还没有实测值。

[^razin]: Razin 等（2025）。Unintentional Unalignment: Likelihood Displacement in Direct Preference Optimization（ICLR）。https://arxiv.org/abs/2410.08847
[^llama3]: Llama Team（2024）。The Llama 3 Herd of Models，§4.1.4。https://arxiv.org/abs/2407.21783

---

## English

### What this lab answers

D3's world showed you something counter-intuitive: the DPO loss kept falling while the chosen answer's probability fell too. DPO only asks that the chosen answer be more likely than the rejected one. It sees the **gap**, not where each of the two goes. This is **likelihood displacement**.

This lab finds it in a real model and answers three questions:

1. With a smaller β (a looser leash), how do the two log-probabilities move?
2. The more alike the two answers, does the chosen one fall more?
3. Does an SFT term on the chosen answer hold it up? At what cost?

### Setup

- **Hardware:** a Colab T4, LoRA, fp16. By default 5,000 training pairs and 500 evaluation pairs.
- **Files:** `common.py`, `L3_dpo.py`, `requirements.txt`.
- **Model and data:** `Qwen2.5-0.5B-Instruct`; `trl-lib/ultrafeedback_binarized` (the example set in TRL's documentation).
- **The reference:** with LoRA, the reference model is the same model with the adapter switched off, so no second copy sits in memory.

### Predict first

- **P1:** During training, does `logps/chosen` rise or fall?
- **P2:** With β lowered from 0.1 to 0.01, how do the margin and the two log-probabilities change?
- **P3:** Similar pairs or very different pairs: which group's chosen answer falls more?
- **P4:** What happens with the SFT term added?
- **P5:** After DPO, are answers longer or shorter?

### Steps

```bash
python L3_dpo.py --run R0       # β = 0.1, all pairs
python L3_dpo.py --run R1       # R1…R5: one change each
```

| Run | Change |
|---|---|
| R0 | β = 0.1, all pairs |
| R1 / R2 | β = 0.01 / β = 0.5 |
| R3 | only the 20% most similar pairs |
| R4 | only the 20% least similar pairs |
| R5 | `loss_type=["sigmoid","sft"]`, `loss_weights=[1.0, 0.2]`: an NLL term on the chosen answer |

What the script does:

1. **Prepare and filter the data before training.** UltraFeedback stores whole conversations in chosen and rejected; the script splits off the shared prompt. Pairs longer than `max_length=1024` are **dropped**: TRL 1.15 only truncates with `keep_start`, which would cut the end of the answers.
2. **Measure two numbers per pair.** The **length ratio**: chosen tokens over rejected tokens. The **similarity**: the cosine of the two answers under L1's e5 embedding model. This is a cheap stand-in for D3's CHES: CHES uses the model's own hidden states, this uses another model's sentence vectors, so treat it as an approximation.
3. **Train.**
   ```python
   args = DPOConfig(beta=0.1, learning_rate=1e-5, per_device_train_batch_size=4, gradient_accumulation_steps=4,
                    max_length=1024, num_train_epochs=1, **device_setup())    # set fp16 on a T4: DPOConfig defaults to bf16
   trainer = DPOTrainer(model="Qwen/Qwen2.5-0.5B-Instruct", args=args, train_dataset=tr, eval_dataset=ev,
                        peft_config=LoraConfig(r=16, lora_alpha=32, target_modules="all-linear"))
   ```
4. **Measure every pair after training.** For each evaluation pair, compute log p(chosen) and log p(rejected) with the adapter off (the reference) and on (trained), take the two differences, and average them by similarity group and by length ratio.
5. **Generate.** On 50 prompts, generate greedily before and after training and compare the mean length; read 10 by hand.

### What to record

- TRL's log (`log.csv`): `loss`, `rewards/accuracies`, `rewards/margins`, `rewards/chosen`, `rewards/rejected`, `logps/chosen`, `logps/rejected`, for train and eval;
- `pairs.csv`: per pair, the similarity, the length ratio and the change of both log-probabilities;
- `summary.json`: the share of pairs whose chosen log-probability fell; the mean change by similarity (top 20% vs bottom 20%) and by length ratio; the mean answer length before and after.

### Expected results (qualitative)

- `rewards/accuracies` passes 0.5 quickly and the margin keeps growing.
- `logps/rejected` falls faster than `logps/chosen`, but **`logps/chosen` often falls too**: DPO often widens the gap by pushing both down, the rejected one more[^razin-en].
- **P2:** the smaller β, the wider the log-ratios must be pulled apart before the loss falls, so the model moves further from the reference and both log-probabilities usually change more (D2b's leash).
- **P3:** similar pairs displace more. Razin et al. found that the more alike the two answers look to the model, the more the chosen one is pushed out; in their experiments, dropping the most similar pairs worked better than adding an SFT term[^razin-en].
- **P4 (R5):** the SFT term holds `logps/chosen` up, at the cost of a slower-growing margin (D3's optional world). Llama 3 added a similar term to DPO[^llama3-en].
- **P5:** answers usually get longer (the length bias from D3). Report the length change together with the 10 answers you read.
- These are common patterns; the sizes are whatever you measure.

### Common problems

- **A bf16 error on a T4:** DPOConfig defaults to `bf16=True` when `fp16` is not set. Use the script's `device_setup()`.
- **Out of memory:** use LoRA; or set `precompute_ref_log_probs=True` to compute the reference log-probabilities up front; or shorten `max_length`.
- **"Unknown argument" for `rpo_alpha` or `max_prompt_length` from older tutorials:** removed in TRL 1.15. Use R5's form for the first and `max_length` for the second.
- **Truncated answers:** filter first, as in step 1; do not rely on truncation.
- **Learning rate too high:** generations turn to gibberish and both log-probabilities collapse.
- **It will not run on a Mac:** as in L2, TRL 1.15 needs Triton, which only exists on Linux.

### Where this connects to the course

- D3's `dpo_gap_plane`: P1 and P3 reproduce "the loss fell and the answer went" in real training; R5 is its optional +NLL world;
- D2b's `kl_leash_policy`: P2, what β does;
- L1's embedding model, used here to measure similarity.

### Smoke test and known gaps

- Ran R3 (similarity subset) and R5 (SFT term) on a Mac with a random tiny Qwen and a dozen pairs from `trl-internal-testing/zen`: filtering, measuring, training, per-pair measurement and generation all complete. Tiny-model numbers mean nothing.
- Not run: the full UltraFeedback set, the real model, a GPU. The size of the displacement and of the length change have no measured values yet.

[^razin-en]: Razin et al. (2025). Unintentional Unalignment: Likelihood Displacement in Direct Preference Optimization (ICLR). https://arxiv.org/abs/2410.08847
[^llama3-en]: Llama Team (2024). The Llama 3 Herd of Models, §4.1.4. https://arxiv.org/abs/2407.21783
