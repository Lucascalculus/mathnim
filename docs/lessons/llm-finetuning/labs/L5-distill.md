# L5（选做）序列级蒸馏：用老师的推理轨迹训练小模型 / L5 (optional) Sequence-level distillation: train a small model on a teacher's reasoning traces

> **状态：** 代码已在 Mac（CPU）上用一个随机初始化的微型 Qwen 同时当老师和学生，做过冒烟测试（6 道题、2 步训练），**尚未在 GPU 上实跑**。下面的"预期结果"是定性的，来自所引资料，不是本实验的实测数字。vLLM 生成只在 Linux + CUDA 上可用，本次构建没有跑过。
>
> **Status:** smoke-tested on a Mac (CPU) with a randomly initialised tiny Qwen as both teacher and student (6 questions, 2 training steps); **not yet run on a GPU**. The expected results are qualitative, from the cited sources, not measured here. vLLM generation needs Linux + CUDA and was not run in this build.

[中文](#中文) · [English](#english)

---

## 中文

### 这个实验要回答什么

E3 讲过：让小模型学会推理，最便宜的办法往往不是自己做强化学习，而是**抄一个强老师的作业**：让老师把解题过程写出来，只留下做对的，再拿它们做 SFT。DeepSeek 发现，在 32B 这个规模上，这样蒸馏出来的模型比直接做大规模强化学习的还强[^r1]。

这个实验把这条路走一遍，并和 L2（学人写的解答）、L4（GRPO）并排比较：

1. 拒绝采样丢掉了哪些题？
2. 花差不多的算力，蒸馏和 GRPO 谁的准确率更高？谁的覆盖率（pass@16）更高？
3. 学生学到的是老师的"答案"，还是老师的"写法"？

选做部分换成**在线蒸馏**（GKD）：学生自己写，老师逐个 token 打分，比较正向 KL 和反向 KL 的差别（E3 的 `forward_reverse_kl`）。

### 准备

- **硬件：** 生成轨迹最好用 L4 或 A100 加 vLLM（`pip install vllm`，加 `--vllm`）；学生的 SFT 在 T4 上可以跑。
- **文件：** `common.py`、`L5_distill.py`、`requirements.txt`。评分器就是 L4 写的那个（`common.parse_answer`：恰好一个 `<answer>`，按数值比较）。
- **老师：** 默认 `Qwen/Qwen3-4B` 的思考模式。任何开源推理模型都行；序列级蒸馏只用老师写出的**文本**，所以师生的分词器不必相同。
- **学生：** 默认 `Qwen/Qwen2.5-1.5B-Instruct`，和 L4 用 1.5B 时的模型相同，方便比较。T4 显存紧张时用 `--student Qwen/Qwen2.5-0.5B-Instruct`。
- **先读：** 老师模型的许可证和使用条款；老师可能在预训练里见过 GSM8K 的测试题（数据污染），所以本实验的测试分数要谨慎解读。

### 运行前先预测

- **P1：** 拒绝采样会丢掉哪些题？丢掉之后，训练集的难度分布会怎么变？（B2）
- **P2：** GPU 小时差不多时，蒸馏出来的学生和 L4 的 GRPO 学生，谁的 pass@1 更高？
- **P3：** 蒸馏之后，回答会变长还是变短？
- **P4：** 老师的轨迹平均几百上千个 token。如果评测时只给 `max_new_tokens=256`，会怎样？
- **P5：** 比较 pass@16，蒸馏和 GRPO 哪个的覆盖率更高？
- **P6（选做）：** GKD 取 β = 1（反向 KL）和 β = 0（正向 KL），哪个采出来的回答更多样？

### 步骤

```bash
python L5_distill.py --stage gen --vllm      # 1. 老师为 2,000 道训练题各写 4 条轨迹
python L5_distill.py --stage filter          # 2. 拒绝采样
python L5_distill.py --stage sft             # 3. 学生 SFT
python L5_distill.py --stage eval            # 4. 评测
```

1. **生成轨迹。** 跳过 L4 用来做 P1 的前 200 道题。按 Qwen3 对思考模式的建议，温度 0.6、top-p 0.95，最多 2,048 个 token：
   ```python
   llm = LLM(model="Qwen/Qwen3-4B", max_model_len=2560, gpu_memory_utilization=0.85)
   sp = SamplingParams(n=4, temperature=0.6, top_p=0.95, max_tokens=2048)
   outs = llm.chat(prompts, sp, chat_template_kwargs={"enable_thinking": True})
   ```
2. **拒绝采样。** 只留下：评分器判对的；**没有被截断的**（`finish_reason == "length"` 的丢掉：被截断的轨迹会教模型"不写完"）；每道题最多 2 条、去掉重复。脚本会打印老师"从没做对 / 有时做对 / 总是做对"的题各有多少：从没做对的那些题，会从训练集里**整个消失**，而它们恰恰是最难的（B2）。
3. **学生 SFT。** 沿用 L2 的配方：LoRA r = 16、学习率 2e-4、两轮、"提示 + 回答"格式加 `completion_only_loss`、`eos_token="<|im_end|>"`。回答里老师的 `<think>` 段落原样保留；要去掉也可以，但训练和评测必须一致。
4. **评测。** 对 200 道测试题各采 16 次，先用 2,048 个 token 的预算测 pass@k、平均长度和截断率；再用 256 个 token 测一遍（P4）。
5. **汇总对照表。** 行：基座、L2、L4、L5；列：pass@1、pass@16、平均长度、GPU 小时。**L5 的 GPU 小时要把老师生成轨迹的时间也算进去。**

**选做：在线蒸馏（GKD）**

```bash
python L5_distill.py --stage gkd --beta 1.0
python L5_distill.py --stage gkd --beta 0.0
```

GKD 逐个 token 比较师生的分布，所以**师生必须用同一个分词器**：这里是 `Qwen2.5-1.5B-Instruct` 教 `Qwen2.5-0.5B-Instruct`。`lmbda=1.0` 表示每条训练数据都由学生自己写（完全在线）；`beta=0` 是正向 KL，`beta=1` 是反向 KL。训练完，脚本对 50 道题各采 8 次，数两个多样性指标：有几个不同的最终答案、有几种不同的开头。师生分词器不同时，改用 `trl.experimental.gold`，并设 `use_uld_loss=True`。GKD 和 GOLD 都在 `trl.experimental` 下，升级 TRL 时名字和参数可能会变。

### 记录什么

- 每道题的接受率，按"从没做对 / 有时 / 总是"分组；被接受的轨迹条数和长度分布；
- SFT 的 train loss（`sft_log.csv`）；
- 两种长度预算下的 pass@k、平均长度、截断率（`eval.json`）；
- GPU 小时（生成 + 训练）；
- 选做：两种 β 下的准确率和两个多样性指标。

### 预期结果（定性）

- **P1：** 被丢掉的主要是老师也做不出的最难的题，训练集因此变得更简单（B2 的 `rejection_sampling_yield`）。
- **P2：** 在小模型上，蒸馏一个强老师往往比自己做强化学习更划算。DeepSeek-R1 的报告里，32B 模型直接做一万多步强化学习，AIME 2024 只到 47.0；蒸馏出来的同尺寸模型是 72.6[^r1]。本实验规模小得多，结论以你的实测为准。
- **P3：** 学生会学到老师的风格：回答变长，出现"等等，我再检查一下"这样的自我检查。
- **P4：** 这个结果几乎是确定的：大部分回答写不完，抽不出答案，准确率大幅下降。蒸馏出来的模型，评测预算要配得上它学到的长度。
- **P5：** 覆盖率上蒸馏可能占优。Qwen3 的技术报告里，从同一个检查点出发，强化学习没有提高 pass@64，在线蒸馏提高了[^qwen3]。
- **P6：** β = 1（反向 KL，偏向"抓住一个峰"）采出来的回答，通常不如 β = 0（正向 KL，偏向"盖住所有峰"）的多样（E3）。

### 常见问题

- **训练数据里混进了被截断的轨迹：** 模型学会"不写完"。按长度过滤掉，不要截断后保留。
- **回答末尾没有结束符：** 模型停不下来，和 L2 的 R6 是同一个问题。
- **师生的模板不一致**（比如 `<think>` 有时有、有时没有）：评测时抽不出答案。
- **2k 长度在 T4 上显存不够：** 每卡批大小设为 1、加梯度累积、开梯度检查点（SFTConfig 默认已开）；还不行就换 0.5B 的学生。
- **GKD 显存不够：** GKD 要同时放两个模型，还要生成。用小模型、加 LoRA、`max_new_tokens=256`。
- **在 Mac 上跑不起来：** 同 L2，TRL 1.15 需要 Triton（只有 Linux 有）。

### 和课程的对应

- E3 的 `forward_reverse_kl`：选做部分的 β；
- E2 的 `pass_k_sharpen`：P5，覆盖率；
- B2 的 `rejection_sampling_yield`：P1；
- L2 的 R6（结束符）和 L4 的评分器。

### 冒烟测试与已知缺口

- 在 Mac 上用随机微型 Qwen 当老师和学生，跑通了生成 → 拒绝采样 → SFT → 两种预算的评测，以及 GKD（β = 1）加多样性统计。微型老师永远做不对，所以冒烟测试时拒绝采样会保留几条没通过的轨迹，让后面的步骤能跑；这只在 `LAB_SMOKE=1` 时发生。
- 没有跑过：真实的老师和学生、GPU、`--vllm`、2,000 道题的规模。接受率、准确率、长度、GPU 小时都还没有实测值。

[^r1]: DeepSeek-AI（2025）。DeepSeek-R1，§4.1，表 6。https://arxiv.org/abs/2501.12948
[^qwen3]: Qwen Team（2025）。Qwen3 Technical Report，表 21。https://arxiv.org/abs/2505.09388

---

## English

### What this lab answers

E3 said: the cheapest way to give a small model reasoning is often not to run RL on it, but to **copy a strong teacher's homework**: let the teacher write out its solutions, keep only the right ones, and fine-tune on them. DeepSeek found that at 32B, a model distilled this way beat the same model trained with large-scale RL[^r1-en].

This lab walks that road and puts it next to L2 (learning from human-written solutions) and L4 (GRPO):

1. Which questions does rejection sampling throw away?
2. For similar compute, which gets the higher accuracy, distillation or GRPO? Which the higher coverage (pass@16)?
3. Does the student learn the teacher's answers, or the teacher's way of writing?

The optional part switches to **on-policy distillation** (GKD): the student writes, the teacher scores every token, and you compare forward and reverse KL (E3's `forward_reverse_kl`).

### Setup

- **Hardware:** generating traces is best on an L4 or A100 with vLLM (`pip install vllm`, add `--vllm`); the student's SFT runs on a T4.
- **Files:** `common.py`, `L5_distill.py`, `requirements.txt`. The grader is L4's (`common.parse_answer`: exactly one `<answer>`, compared numerically).
- **Teacher:** by default `Qwen/Qwen3-4B` in thinking mode. Any open reasoning model works; sequence-level distillation only uses the teacher's **text**, so teacher and student need not share a tokenizer.
- **Student:** by default `Qwen/Qwen2.5-1.5B-Instruct`, the same model as L4 at 1.5B, for a fair comparison. If a T4 runs out of memory, use `--student Qwen/Qwen2.5-0.5B-Instruct`.
- **Read first:** the teacher's licence and terms of use. The teacher may also have seen GSM8K's test set in pre-training (contamination), so read test scores with care.

### Predict first

- **P1:** Which questions will rejection sampling drop? How does the difficulty of the training set change?
- **P2:** For similar GPU hours, which student has the higher pass@1: the distilled one or L4's GRPO one?
- **P3:** After distillation, are answers longer or shorter?
- **P4:** The teacher's traces run to hundreds or thousands of tokens. What happens if evaluation allows only `max_new_tokens=256`?
- **P5:** Comparing pass@16, which has the higher coverage, distillation or GRPO?
- **P6 (optional):** In GKD, β = 1 (reverse KL) or β = 0 (forward KL): which samples more diverse answers?

### Steps

```bash
python L5_distill.py --stage gen --vllm      # 1. the teacher writes 4 traces for each of 2,000 training questions
python L5_distill.py --stage filter          # 2. rejection sampling
python L5_distill.py --stage sft             # 3. student SFT
python L5_distill.py --stage eval            # 4. evaluation
```

1. **Generate traces.** The first 200 questions are skipped (L4 used them for P1). Following Qwen3's advice for thinking mode: temperature 0.6, top-p 0.95, at most 2,048 tokens:
   ```python
   llm = LLM(model="Qwen/Qwen3-4B", max_model_len=2560, gpu_memory_utilization=0.85)
   sp = SamplingParams(n=4, temperature=0.6, top_p=0.95, max_tokens=2048)
   outs = llm.chat(prompts, sp, chat_template_kwargs={"enable_thinking": True})
   ```
2. **Rejection sampling.** Keep only traces that the grader marks right, that were **not cut off** (drop `finish_reason == "length"`: a cut-off trace teaches "never finish"), at most 2 per question, without duplicates. The script prints how many questions the teacher solved never, sometimes and always. The "never" questions **vanish** from the training set, and they are exactly the hardest ones (B2).
3. **Student SFT.** L2's recipe: LoRA r = 16, learning rate 2e-4, two epochs, prompt + completion data with `completion_only_loss`, `eos_token="<|im_end|>"`. The teacher's `<think>` block is kept as is; you may strip it, but then training and evaluation must agree.
4. **Evaluate.** 16 samples for each of 200 test questions: first with a 2,048-token budget (pass@k, mean length, truncation rate), then again with 256 tokens (P4).
5. **The comparison table.** Rows: base, L2, L4, L5. Columns: pass@1, pass@16, mean length, GPU hours. **L5's GPU hours include the teacher's generation.**

**Optional: on-policy distillation (GKD)**

```bash
python L5_distill.py --stage gkd --beta 1.0
python L5_distill.py --stage gkd --beta 0.0
```

GKD compares the teacher's and student's distributions token by token, so **teacher and student must share a tokenizer**: here `Qwen2.5-1.5B-Instruct` teaches `Qwen2.5-0.5B-Instruct`. `lmbda=1.0` means every training example is written by the student itself (fully on-policy); `beta=0` is forward KL and `beta=1` reverse KL. Afterwards the script samples 8 answers for each of 50 questions and counts two kinds of diversity: distinct final answers and distinct openings. For teachers with another tokenizer, use `trl.experimental.gold` with `use_uld_loss=True`. GKD and GOLD live in `trl.experimental`, so their names and arguments may change between TRL versions.

### What to record

- The acceptance rate per question, grouped never / sometimes / always; the number and length of accepted traces;
- The SFT train loss (`sft_log.csv`);
- pass@k, mean length and truncation rate at both budgets (`eval.json`);
- GPU hours (generation + training);
- Optional: accuracy and the two diversity counts for both β.

### Expected results (qualitative)

- **P1:** mostly the hardest questions, the ones the teacher also fails, are dropped, so the training set gets easier (B2's `rejection_sampling_yield`).
- **P2:** for small models, distilling a strong teacher is often a better deal than running RL yourself. In DeepSeek-R1's report, a 32B model trained with more than 10k steps of RL reached 47.0 on AIME 2024, while the distilled model of the same size reached 72.6[^r1-en]. This lab is far smaller; trust what you measure.
- **P3:** the student picks up the teacher's style: longer answers, and self-checks such as "wait, let me check".
- **P4:** nearly certain: most answers cannot finish, no answer can be extracted, and accuracy drops sharply. A distilled model needs an evaluation budget that matches the length it learned.
- **P5:** distillation may win on coverage. In the Qwen3 technical report, starting from the same checkpoint, RL did not raise pass@64 while on-policy distillation did[^qwen3-en].
- **P6:** β = 1 (reverse KL, which tends to lock onto one mode) usually samples less diverse answers than β = 0 (forward KL, which tends to cover all modes) (E3).

### Common problems

- **Cut-off traces in the training data:** the model learns not to finish. Filter them out by length; do not keep truncated copies.
- **No end token at the end of the answers:** the model never stops; the same problem as L2's R6.
- **Mismatched templates between teacher and student** (for example `<think>` sometimes present, sometimes not): no answer can be extracted at evaluation.
- **2k tokens do not fit on a T4:** per-device batch size 1, gradient accumulation, gradient checkpointing (on by default in SFTConfig); if that is not enough, use the 0.5B student.
- **GKD out of memory:** GKD holds two models and also generates. Use small models, LoRA, and `max_new_tokens=256`.
- **It will not run on a Mac:** as in L2, TRL 1.15 needs Triton, which only exists on Linux.

### Where this connects to the course

- E3's `forward_reverse_kl`: the β of the optional part;
- E2's `pass_k_sharpen`: P5, coverage;
- B2's `rejection_sampling_yield`: P1;
- L2's R6 (the end token) and L4's grader.

### Smoke test and known gaps

- Ran on a Mac with a random tiny Qwen as teacher and student: generation → rejection sampling → SFT → evaluation at both budgets, and GKD (β = 1) with the diversity counts. A tiny teacher never answers correctly, so in the smoke test rejection sampling keeps a few failed traces so the later stages can run; that happens only under `LAB_SMOKE=1`.
- Not run: the real teacher and student, a GPU, `--vllm`, the 2,000-question scale. Acceptance rates, accuracy, lengths and GPU hours have no measured values yet.

[^r1-en]: DeepSeek-AI (2025). DeepSeek-R1, §4.1, Table 6. https://arxiv.org/abs/2501.12948
[^qwen3-en]: Qwen Team (2025). Qwen3 Technical Report, Table 21. https://arxiv.org/abs/2505.09388
