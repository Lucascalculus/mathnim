# L2 LoRA SFT：掩码、秩、学习率 / L2 LoRA SFT: the loss mask, the rank, the learning rate

> **状态：** 代码已在 Mac（CPU）上用一个随机初始化的微型 Qwen 做过冒烟测试（2 步训练），**尚未在 T4 上实跑**。下面的"预期结果"是定性的，来自所引资料，不是本实验的实测数字。
>
> **Status:** smoke-tested on a Mac (CPU) with a randomly initialised tiny Qwen (2 training steps); **not yet run on T4**. The expected results are qualitative, from the cited sources, not measured here.

[中文](#中文) · [English](#english)

---

## 中文

### 这个实验要回答什么

LoRA 微调的配置项很多，但真正决定成败的只有少数几个。这个实验用**对照实验**一次只改一处，检验其中三个：

1. **损失掩码**：损失只算在回答上，还是连提示一起算？
2. **秩 r**：秩越大越好吗？
3. **学习率**：LoRA 的学习率该比全量微调大还是小？

另外你会**亲手造出一个常见 bug**：不设对结束符，模型就停不下来。最后导出一层的 ΔW，交给 C2 的 `lowrank_update` 当真实数据。

用的是 Qwen2.5-0.5B **基座**模型（没做过对话微调），因为聊天模板和结束符的问题在基座上最明显。

### 准备

- **硬件：** Colab T4（16 GB）。脚本会自动选精度：T4 没有 bf16，用 fp16；L4、A100 用 bf16。
- **文件：** `common.py`、`L2_sft_lora.py`、`requirements.txt`，然后 `pip install -r requirements.txt`。
- **数据：** GSM8K 训练集（7,473 条），脚本转成"提示 + 回答"格式：回答是原解答的推理步骤，最后一行是 `#### 答案`。

### 运行前先预测

- **P1：** 在所有线性层上加 r = 16 的 LoRA，可训练参数有多少？用 `config.json` 里的维度算（hidden 896、intermediate 4864、KV 维度 128、24 层）：每层各线性层的 Σ(d_in + d_out) = 22,912，乘 16 再乘 24 层，约 8.8M，大约是总参数的 1.8%。脚本开头会打印 `print_trainable_parameters()`，对一下。
- **P2：** 先用 C1 的 `vram_calculator` 估峰值显存，再和脚本输出的 `peak_gb` 对照。
- **P3：** 掩码开和关（R0 对 R1），准确率差多少？这两次的 train loss 能直接比较吗？
- **P4：** α 固定为 32，r 取 1、16、64（R2、R0、R3），前 100 步的 loss 曲线会是什么样？
- **P5：** 学习率 2e-5、2e-4、2e-3（R4、R0、R5），哪个最好？
- **P6：** 不设 `eos_token`（R6），会发生什么？

### 步骤

```bash
python L2_sft_lora.py --run R0 --export-dw     # 基础配置，并导出 ΔW
python L2_sft_lora.py --run R1                 # R1…R6：每组只改一处
```

| 运行 | 改了什么 | 检验 |
|---|---|---|
| R0 | 掩码开、r = 16、α = 32、学习率 2e-4、`eos_token="<\|im_end\|>"` | 基础 |
| R1 | `completion_only_loss=False`：提示也算损失 | 掩码 |
| R2 / R3 | r = 1 / r = 64，α 不变 | 秩 |
| R4 / R5 | 学习率 2e-5 / 2e-3 | 学习率 |
| R6 | 不设 `eos_token` | 结束符 |

关键代码（完整代码见脚本）：

```python
peft_cfg = LoraConfig(r=16, lora_alpha=32, lora_dropout=0.0, target_modules="all-linear", task_type="CAUSAL_LM")
args = SFTConfig(max_steps=300, learning_rate=2e-4, per_device_train_batch_size=8, gradient_accumulation_steps=2,
                 max_length=512, completion_only_loss=True,
                 eos_token="<|im_end|>",          # Qwen 基座必须设：它的 eos 是 <|endoftext|>，而对话模板用 <|im_end|> 结束一轮
                 **device_setup())                 # T4: fp16=True, bf16=False
trainer = SFTTrainer(model="Qwen/Qwen2.5-0.5B", args=args, train_dataset=train, eval_dataset=val, peft_config=peft_cfg)
```

每组训练完，脚本在测试集前 200 题上贪心解码（最多 300 个新 token），算三个数：

- **准确率**：抽出的 `#### n` 等于标准答案；
- **格式率**：能抽出 `#### n` 的比例；
- **停止率**：在长度上限之前就生成了结束符的比例。

`--export-dw` 会从第 12 层的 `q_proj` 和 `down_proj` 算出 ΔW = (α/r)·B·A，存成 `.npy`。

### 记录什么

- train loss 和验证 loss（`log.csv`），准确率、格式率、停止率、平均回答长度（`eval.json`）；
- 可训练参数量、峰值显存、每步耗时。
- R0 和 R1 的 loss **不能直接比**：分母里的 token 数不一样（R1 把提示也算进去了）。在报告里说明这一点，改为比较准确率。

### 预期结果（定性）

- **格式率**会从接近 0 升到很高：基座模型原本不会用 `####` 结尾。准确率能涨多少，以实测为准。
- **R1 对 R0：** 准确率差别应该不大。GSM8K 的提示短、回答长，提示部分加不加进损失影响很小[^ta]。
- **R2、R3 对 R0：** 前 100 步的曲线几乎重合。PEFT 默认用 α/r 缩放，在这种缩放下，不同的秩一开始的学习曲线是一样的[^lwr]。
- **R4、R5 对 R0：** R4 学得很慢；R5 可能发散或变差。LoRA 的最佳学习率大约是全量微调的 10 倍，2e-4 已经在那个范围[^lwr]。
- **R6：** 停止率很低，回答一直写到长度上限。基座分词器的 eos 是 `<|endoftext|>`，而对话模板每一轮以 `<|im_end|>` 结束；不告诉训练器，模型就学不会在哪里停[^qwen-tok]。

### 常见问题

- **"bf16 需要计算能力 ≥ 8.0"：** 在 T4 上开了 bf16。用脚本的 `device_setup()`。注意：新版 PyTorch 在 T4 上 `torch.cuda.is_bf16_supported()` 也会返回 True（那是软件模拟），所以脚本改用计算能力判断。
- **"Attempting to unscale FP16 gradients"：** 可训练参数变成了 fp16。不要对整个模型调用 `.half()`。
- **模型停不下来：** 就是 R6。检查 `eos_token` 和生成时的 `eos_token_id`。
- **`assistant_only_loss=True` 报错：** 聊天模板里没有 `{% generation %}` 标记。Qwen2.5 的模板就没有，所以本实验用"提示 + 回答"格式加 `completion_only_loss`。
- **显存不够：** 减小 `max_length` 或批大小。SFTConfig 默认已经开了梯度检查点。
- **在 Mac 上报 `'NoneType' object has no attribute 'apply'`：** TRL 1.15 用 Triton 内核算每个 token 的 log 概率，而 Triton 只随 Linux 版 PyTorch 发布。请在 Colab 或 Linux GPU 上跑。

### 和课程的对应

- B1 的 `token_loss_mask`（P3）和 `pad_eos_trap`（R6）；
- C1 的 `vram_calculator`（P2）；
- C2 的 `lowrank_update`（导出的 ΔW）和"秩与 α/r"（P4）；
- B3 的遗忘与学习率（P5）。

### 冒烟测试与已知缺口

- 在 Mac 上用随机微型 Qwen 跑通了 R0（含 `--export-dw`）和 R6：训练、评测、导出都能走完。因为 TRL 1.15 的 Triton 内核在 macOS 上不存在，冒烟测试时用一个纯 PyTorch 的同接口函数替代了它（只在测试工具里，不在实验代码里）。
- 没有跑过：真实模型、GPU、fp16。准确率、显存、耗时都还没有实测值。

[^ta]: TRL 文档，SFT Trainer，"Train on completion only"；见 research-sft.md。
[^lwr]: Schulman 等（2025）。LoRA Without Regret（Thinking Machines 博客）。https://thinkingmachines.ai/blog/lora/
[^qwen-tok]: Qwen2.5 的 `tokenizer_config.json`：基座 eos = pad = `<|endoftext|>`，Instruct 的 eos 是 `<|im_end|>`；见 research-sft.md。

---

## English

### What this lab answers

LoRA fine-tuning has many settings, but only a few decide whether it works. This lab tests three of them with **controlled runs** that change one thing at a time:

1. **The loss mask:** is the loss computed on the answer only, or on the prompt too?
2. **The rank r:** is a bigger rank better?
3. **The learning rate:** should LoRA's be larger or smaller than full fine-tuning's?

You will also **reproduce a common bug** by hand: without the right end token, the model never stops. Finally you export one layer's ΔW as real data for C2's `lowrank_update`.

The model is the Qwen2.5-0.5B **base** model (no chat tuning), because chat-template and end-token problems are most visible there.

### Setup

- **Hardware:** a Colab T4 (16 GB). The script picks the precision itself: a T4 has no bf16, so fp16; an L4 or A100 gets bf16.
- **Files:** `common.py`, `L2_sft_lora.py`, `requirements.txt`, then `pip install -r requirements.txt`.
- **Data:** GSM8K train (7,473 examples), turned into prompt + completion: the completion is the original worked solution, ending with a line `#### answer`.

### Predict first

- **P1:** With r = 16 LoRA on every linear layer, how many trainable parameters? Use the sizes in `config.json` (hidden 896, intermediate 4864, KV size 128, 24 layers): Σ(d_in + d_out) over a layer's linear layers is 22,912; times 16 times 24 layers is about 8.8M, roughly 1.8% of all parameters. The script prints `print_trainable_parameters()` first; check.
- **P2:** Estimate the peak memory with C1's `vram_calculator`, then compare with the script's `peak_gb`.
- **P3:** Mask on vs off (R0 vs R1): how different is the accuracy? Can you compare the two train losses directly?
- **P4:** α fixed at 32, r = 1, 16, 64 (R2, R0, R3): what do the first 100 steps of loss look like?
- **P5:** Learning rate 2e-5, 2e-4, 2e-3 (R4, R0, R5): which is best?
- **P6:** No `eos_token` (R6): what happens?

### Steps

```bash
python L2_sft_lora.py --run R0 --export-dw     # the base configuration, and the ΔW export
python L2_sft_lora.py --run R1                 # R1…R6: one change each
```

| Run | Change | Tests |
|---|---|---|
| R0 | mask on, r = 16, α = 32, lr 2e-4, `eos_token="<\|im_end\|>"` | base |
| R1 | `completion_only_loss=False`: loss on the prompt too | mask |
| R2 / R3 | r = 1 / r = 64, same α | rank |
| R4 / R5 | lr 2e-5 / 2e-3 | learning rate |
| R6 | no `eos_token` | end token |

The key lines (the script has the rest):

```python
peft_cfg = LoraConfig(r=16, lora_alpha=32, lora_dropout=0.0, target_modules="all-linear", task_type="CAUSAL_LM")
args = SFTConfig(max_steps=300, learning_rate=2e-4, per_device_train_batch_size=8, gradient_accumulation_steps=2,
                 max_length=512, completion_only_loss=True,
                 eos_token="<|im_end|>",          # needed for Qwen base: its eos is <|endoftext|>, but chat turns end with <|im_end|>
                 **device_setup())                 # T4: fp16=True, bf16=False
trainer = SFTTrainer(model="Qwen/Qwen2.5-0.5B", args=args, train_dataset=train, eval_dataset=val, peft_config=peft_cfg)
```

After each run the script decodes greedily (up to 300 new tokens) on the first 200 test questions and reports:

- **accuracy:** the extracted `#### n` equals the gold answer;
- **format rate:** the share where `#### n` can be extracted at all;
- **stop rate:** the share that produced the end token before the length limit.

`--export-dw` computes ΔW = (α/r)·B·A for layer 12's `q_proj` and `down_proj` and saves them as `.npy`.

### What to record

- train and validation loss (`log.csv`); accuracy, format rate, stop rate, mean answer length (`eval.json`);
- trainable parameters, peak memory, time per step.
- R0's and R1's losses **cannot be compared directly**: the token count in the denominator differs (R1 includes the prompt). Say so in the report, and compare accuracies instead.

### Expected results (qualitative)

- **The format rate** goes from near 0 to high: the base model does not end with `####` on its own. How much accuracy rises is whatever you measure.
- **R1 vs R0:** little difference in accuracy. GSM8K has short prompts and long answers, so whether the prompt is in the loss matters little[^ta-en].
- **R2, R3 vs R0:** the first 100 steps nearly coincide. PEFT scales by α/r by default, and with that scaling different ranks start with the same learning curve[^lwr-en].
- **R4, R5 vs R0:** R4 learns slowly; R5 may diverge or end worse. LoRA's best learning rate is about 10× full fine-tuning's, and 2e-4 is already in that range[^lwr-en].
- **R6:** a low stop rate; answers run to the length limit. The base tokenizer's eos is `<|endoftext|>`, while chat turns end with `<|im_end|>`; unless the trainer is told, the model never learns where to stop[^qwen-tok-en].

### Common problems

- **"bf16 requires compute capability ≥ 8.0":** bf16 on a T4. Use the script's `device_setup()`. Note that recent PyTorch returns True from `torch.cuda.is_bf16_supported()` on a T4 too (it is emulated), which is why the script checks the compute capability instead.
- **"Attempting to unscale FP16 gradients":** the trainable parameters became fp16. Do not call `.half()` on the whole model.
- **The model never stops:** that is R6. Check `eos_token` and the `eos_token_id` used for generation.
- **`assistant_only_loss=True` fails:** the chat template has no `{% generation %}` markers. Qwen2.5's does not, which is why this lab uses prompt + completion data with `completion_only_loss`.
- **Out of memory:** lower `max_length` or the batch size. SFTConfig already turns on gradient checkpointing.
- **On a Mac: `'NoneType' object has no attribute 'apply'`:** TRL 1.15 computes per-token log-probabilities with a Triton kernel, and Triton ships only with PyTorch for Linux. Run on Colab or a Linux GPU.

### Where this connects to the course

- B1's `token_loss_mask` (P3) and `pad_eos_trap` (R6);
- C1's `vram_calculator` (P2);
- C2's `lowrank_update` (the exported ΔW) and "rank and α/r" (P4);
- B3's forgetting and learning rate (P5).

### Smoke test and known gaps

- Ran R0 (with `--export-dw`) and R6 on a Mac with a random tiny Qwen: training, evaluation and export all complete. Because TRL 1.15's Triton kernel does not exist on macOS, the smoke test swapped in a plain-PyTorch function with the same interface (in the test harness only, not in the lab code).
- Not run: the real model, a GPU, fp16. Accuracy, memory and time have no measured values yet.

[^ta-en]: TRL documentation, SFT Trainer, "Train on completion only"; see research-sft.md.
[^lwr-en]: Schulman et al. (2025). LoRA Without Regret (Thinking Machines blog). https://thinkingmachines.ai/blog/lora/
[^qwen-tok-en]: Qwen2.5's `tokenizer_config.json`: base eos = pad = `<|endoftext|>`; Instruct eos `<|im_end|>`; see research-sft.md.
