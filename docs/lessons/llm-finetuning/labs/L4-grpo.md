# L4 在 GSM8K 上做 GRPO：自己写评分器 / L4 GRPO on GSM8K: write your own grader

> **状态：** 代码已在 Mac（CPU）上用一个随机初始化的微型 Qwen 做过冒烟测试（评分器测试、2 步训练、几道题的评测），**尚未在 T4 上实跑**。下面的"预期结果"是定性的，来自所引资料，不是本实验的实测数字。vLLM、4 位量化和 Unsloth 只在 Linux + CUDA 上可用，本次构建都没有跑过。
>
> **Status:** smoke-tested on a Mac (CPU) with a randomly initialised tiny Qwen (grader tests, 2 training steps, an evaluation on a few questions); **not yet run on T4**. The expected results are qualitative, from the cited sources, not measured here. vLLM, 4-bit loading and Unsloth need Linux + CUDA and were not run in this build.

[中文](#中文) · [English](#english)

---

## 中文

### 这个实验要回答什么

E1 说：RLVR 的成败，关键在评分器；GRPO 拿同一道题的一组回答互相比较，全对或全错的组什么也学不到；损失怎么平均会决定长回答受不受罚。这个实验在真实训练里把这三件事各验证一遍：

1. **评分器**：先写、先测，再训练。故意换一个宽松的评分器，看模型怎么钻空子。
2. **零方差组**：用 E1 的公式**预测**第一批训练里有多少组没有信号，再和日志对照。
3. **损失和基线**：比较 `loss_type`、组大小 G，以及去掉基线会怎样。

最后比较训练前后的 pass@k：强化学习主要是让模型更常做对它本来就会的题（磨尖），还是让它学会了原来不会的题（E2 的争论）？

### 准备

- **硬件：** Colab T4 能跑默认配置（`Qwen2.5-0.5B-Instruct` + LoRA）。用 Transformers 生成比较慢；有 L4 或 A100 时加 `--vllm`，可以换成 1.5B。
- **文件：** `common.py`、`L4_grpo.py`、`grpo_minimal.py`、`requirements.txt`。想用 vLLM 就再 `pip install vllm`。
- **数据：** GSM8K。提示要求模型最后把数字写进 `<answer></answer>`。

### 运行前先预测

- **P1：** 第 2 步会对 200 道训练题各采 16 次，估出每道题的成功率。用 E1 的公式 pᴳ + (1−p)ᴳ，第一批训练里 `frac_reward_zero_std` 大约是多少？
- **P2：** 训练过程中，`frac_reward_zero_std` 会怎么变？
- **P3：** `loss_type="grpo"` 和 `"dapo"` 相比，错误回答的长度有什么不同？
- **P4：** G 从 8 改成 4，零方差组的比例变成多少？用公式算。
- **P5：** 用宽松的评分器训练，模型会学会什么？
- **P6：** 去掉基线以后，奖励曲线和梯度范数会怎样？
- **P7：** 训练前后，pass@1 和 pass@16 谁涨得多？

### 步骤

**第 1 步：写评分器，先测试它（本实验的核心）**

```bash
python L4_grpo.py --grader-only
```

评分器只认一种写法：**恰好一个** `<answer>数字</answer>`，并按**数值**比较：

```python
def correctness(completions, answer, **kwargs):          # TRL 把数据集的 answer 列按名字传进来
    out = []
    for c, gold in zip(completions, answer):
        a = parse_answer(c[0]["content"])                 # 对话格式：回答文本在 c[0]["content"]
        out.append(1.0 if a is not None and abs(a - float(gold)) < 1e-6 else 0.0)
    return out
```

脚本先跑一组对抗测试，任何一条不通过就停下：

| 回答 | 标准答案 | 严格评分器 | 宽松评分器（"标准答案在文本里"） | 测的是什么 |
|---|---|---|---|---|
| `<answer>42.0</answer>` | 42 | 1 | 1 | 数值归一化 |
| `<answer>1,000</answer>` | 1000 | 1 | **0** | 千位分隔符 |
| 可能是 41、42 或 43 | 42 | 0 | **1** | 列出多个数 |
| 两个 `<answer>` 标签 | 42 | 0 | **1** | 多个答案 |
| `<answer>forty-two</answer>` | 42 | 0 | 0 | 不是数字 |
| 空回答 | 42 | 0 | 0 | 空输入 |

注意宽松评分器**两个方向都错**：该给分的不给，不该给的给了。然后脚本从模型的输出里抽 50 条，写进 `runs/L4-grader-audit.csv`。请亲手在 `human` 一栏填 1 或 0，算出评分器和你的一致率（E1 的规则：训练前先检验评分器）。

**选做：让大模型当评委**

```bash
python L4_grpo.py --judge local     # 默认：本地的 Qwen2.5-1.5B-Instruct，不花钱
python L4_grpo.py --judge api       # 可选：任何兼容 OpenAI 接口的服务
```

两种都会报告评委和规则评分器的一致率，以及每条的耗时。看看它们不一致的那些：谁对？

用 API 的话，**密钥只从环境变量读，绝不写进代码或笔记本**：

```bash
export JUDGE_API_KEY=...   JUDGE_BASE_URL=https://.../v1   JUDGE_MODEL=...
```

在 Colab 里，把密钥存进左侧的"Secrets"（钥匙图标），再在代码格里 `os.environ["JUDGE_API_KEY"] = userdata.get("JUDGE_API_KEY")`（`from google.colab import userdata`）。API 要付费，也要你自己的账号；50 条很短的调用花费很少，但不是零。

**第 2 步：训练前先测基线**

```bash
python L4_grpo.py --baseline              # 加 --vllm 会快很多
```

对 200 道训练题和 200 道测试题各采 16 次（温度 1.0），得到每道题做对了几次 c、pass@k 曲线、覆盖率（至少做对一次的比例），以及**预测的** `frac_reward_zero_std`。预测用的是和 pass@k 同样的"不放回地挑 G 个"的计数：从 n 次采样、c 次做对估计"一组 G 个全对或全错"的概率，(C(c,G) + C(n−c,G)) / C(n,G)。它的期望正好是 E1 的 pᴳ + (1−p)ᴳ。没有 GPU 的 vLLM 时可以用 `--eval-n 8` 减少采样。

**第 3 步：训练**

```bash
python L4_grpo.py --run R0
```

```python
args = GRPOConfig(num_generations=8, per_device_train_batch_size=8, gradient_accumulation_steps=2,
                  max_completion_length=512, max_steps=250, learning_rate=5e-6,
                  beta=0.0, loss_type="dapo", epsilon=0.2, epsilon_high=0.28, scale_rewards="group",
                  mask_truncated_completions=True, temperature=1.0, **device_setup())
trainer = GRPOTrainer(model="Qwen/Qwen2.5-0.5B-Instruct", reward_funcs=[correctness], args=args,
                      train_dataset=train, peft_config=LoraConfig(r=16, lora_alpha=32, target_modules="all-linear"))
```

这就是 E1 最后那一页的默认配置。两处要知道：TRL 1.15 的默认 `mask_truncated_completions=False`，这里显式打开；学习率 5e-6 是起点，LoRA 通常需要比全量微调大约 10 倍的学习率[^lwr]，如果 100 步奖励都不动，试 2e-5。

对照组每组只改一处：

| 运行 | 改了什么 | 对应的预测 |
|---|---|---|
| R1 | `loss_type="grpo"`：每条回答内先按长度平均 | P3 |
| R2 | G = 4 | P4 |
| R3 | 用宽松评分器训练；严格评分器只记录（权重 0） | P5 |
| R4（选做） | `beta=0.04`，日志里多出 `kl` | |
| R5（选做） | LoRA r = 1 | E2 的"秩 1 就够" |
| R6（选做） | 去掉基线：用 `grpo_minimal.py` | P6 |

**R6：一个从零写的 GRPO 循环。** TRL 没有"关掉组均值基线"的开关，所以 R6 用 `grpo_minimal.py`（约 100 行，核心就是 E1 的"20 行写出 GRPO"）。每批只走一步，所以比率恒为 1、截断不起作用（E1 推过）。

```bash
python grpo_minimal.py --adv grpo     # (r − 均值) / 标准差
python grpo_minimal.py --adv mean     # r − 均值（不除标准差，Dr. GRPO）
python grpo_minimal.py --adv none     # 只用 r：没有基线
```

**选项 `--fmt`：** 加一个小的格式奖励（权重 0.2）。小模型一开始常常不按格式写，它能帮忙起步。但要注意：有了格式奖励，一组回答即使全对或全错，也可能因为格式不同而有差别，`frac_reward_zero_std` 就不再等于 P1 的公式了。

**更快的 T4 路线（选做，本次构建没有运行）：** Unsloth 自带 vLLM 生成和 4 位量化，可以在 T4 上跑 1.5B。加载方式以 Unsloth 官方的 GRPO 笔记本为准，大致是：

```python
from unsloth import FastLanguageModel
model, tok = FastLanguageModel.from_pretrained("Qwen/Qwen2.5-1.5B-Instruct", max_seq_length=1024,
    load_in_4bit=True, fast_inference=True, max_lora_rank=16, gpu_memory_utilization=0.6)
model = FastLanguageModel.get_peft_model(model, r=16, lora_alpha=16, use_gradient_checkpointing="unsloth",
    target_modules=["q_proj", "k_proj", "v_proj", "o_proj", "gate_proj", "up_proj", "down_proj"])
# 然后把 model、tok 和上面同样的 GRPOConfig、correctness 交给 GRPOTrainer
```

**第 4 步：训练后。** 脚本自动在同样的 200 道测试题上重复第 2 步的评测，写进 `runs/L4-<run>/passk.json`。把训练前后两条 pass@k 曲线画在一起。R3 另外人工看 20 条宽松奖励最高的回答。

### 记录什么

- 奖励：`reward`、`rewards/correctness/mean`（R3 里还有 `rewards/loose/mean`）、`reward_std`、`frac_reward_zero_std`；
- 长度：`completions/mean_length`、`completions/mean_terminated_length`、`completions/clipped_ratio`；
- 训练动态：`entropy`、`clip_ratio/*`、`kl`（只有 R4）、`sampling/*`；
- 评测：训练前后的 pass@k、覆盖率；R6 的梯度范数（`runs/minimal-*.csv`）。
- 一个实际提示：默认配置下每个优化步只有 2 道题（16 个回答 ÷ G = 8），单步的 `frac_reward_zero_std` 只能是 0、0.5 或 1。拿前 50 步的平均值和 P1 比。

### 预期结果（定性）

- 正确率涨得比较慢；用了 `--fmt` 时，格式奖励几十步内就会饱和。
- **P1、P2：** 前几十步的 `frac_reward_zero_std` 应该接近 P1 的预测。之后简单题越来越常被"做满"，这个比例会上升（E1 的零方差图；DAPO 的动态采样就是为此设计的[^dapo]）。
- **P3：** R1 的错误回答更长。按回答平均时，长的错误回答每个 token 受罚更轻[^drgrpo]。250 步里差别可能不明显，要把对、错回答的长度分开统计。
- **P4：** R2 的零方差比例更高，和公式算出的值对照。
- **P5：** 宽松奖励一路上涨，严格评分器的分数却不涨甚至下降。如果 250 步里还没出现"列出好几个数"这种行为，就统计"宽松评分器给 1、严格评分器给 0"的样本占多少，看它是不是在增长。
- **P6：** 去掉基线后，0/1 奖励下错误回答完全不受罚，梯度范数波动更大，学得更慢（D2a："均值不变，方差变大"）。
- **P7：** pass@1 涨得比 pass@16 多，pass@16 可能基本不动。Yue 等人报告，在采样次数足够多时，基座模型的 pass@k 会追上甚至超过 RL 之后的模型[^yue]。
- **R5：** 秩 1 和秩 16 的结果接近[^lwr]。
- 以上数值以实测为准。

### 常见问题

- **"有效批大小必须能被 `num_generations` 整除"：** 调整每卡批大小或梯度累积步数。
- **奖励函数报错：** 返回的列表长度和回答数不一致；列表里有 None；函数签名里没写 `**kwargs`；把对话格式的回答当成了字符串。
- **奖励全是 0：** 先打印 5 条回答。常见原因：正则太严、系统提示没生效、答案写在了标签外面、`max_completion_length` 太短（看 `completions/clipped_ratio`）。
- **`completions/clipped_ratio` 很高：** 提高 `max_completion_length`，并保持 `mask_truncated_completions=True`。
- **奖励在涨，留出集不涨：** 先查评分器（参考 R3），再看 `sampling/*`，排查训练和生成两边的概率是否不一致（E2）。
- **vLLM 显存不够：** 调低 `gpu_memory_utilization`。
- **在 Mac 上跑不起来：** 同 L2，TRL 1.15 需要 Triton（只有 Linux 有）。

### 和课程的对应

- E1 的 `grpo_group`：可以把日志里一组真实的奖励填进去看优势；
- E1 的零方差图（P1、P4）；
- E1 的评分器一页和"找漏洞"题（第 1 步、R3）；
- D2a 的 `pg_baseline`（R6）；
- E2 的 `pass_k_sharpen`（第 4 步）；
- C2、E2 的"秩 1 就够"（R5）。

### 冒烟测试与已知缺口

- 在 Mac 上用随机微型 Qwen 跑通了：评分器测试（全部通过）、50 条审查样本和本地评委、基线评测（含零方差预测）、R0 / R1 / R2 / R3 各 2 步训练和训练后评测、`grpo_minimal.py` 的三种优势各 2 步。微型模型永远答不对，所以冒烟测试时额外加了一个"抛硬币"奖励，让梯度那条路真正走一遍；它只在 `LAB_SMOKE=1` 时出现。
- 没有跑过：真实模型、GPU、`--vllm`、`--load-4bit`、Unsloth、`--judge api`（没有密钥）。所有数值都还没有实测。

[^lwr]: Schulman 等（2025）。LoRA Without Regret（Thinking Machines 博客）。https://thinkingmachines.ai/blog/lora/
[^dapo]: Yu 等（2025）。DAPO: An Open-Source LLM Reinforcement Learning System at Scale。https://arxiv.org/abs/2503.14476
[^drgrpo]: Liu 等（2025）。Understanding R1-Zero-Like Training: A Critical Perspective（Dr. GRPO）。https://arxiv.org/abs/2503.20783
[^yue]: Yue 等（2025）。Does Reinforcement Learning Really Incentivize Reasoning Capacity in LLMs Beyond the Base Model? https://arxiv.org/abs/2504.13837

---

## English

### What this lab answers

E1 said: RLVR is won or lost at the grader; GRPO compares a group of answers to the same question, and a group that is all right or all wrong teaches nothing; how the loss is averaged decides whether long answers are punished. This lab checks all three in real training:

1. **The grader:** write it and test it before training. Then deliberately train on a loose grader and watch the model exploit it.
2. **Zero-variance groups:** **predict** with E1's formula how many groups in the first batches carry no signal, then compare with the log.
3. **The loss and the baseline:** compare `loss_type`s, group sizes G, and what removing the baseline does.

Finally, compare pass@k before and after training: does RL mostly make the model solve what it could already solve more often (sharpening), or teach it questions it could not solve (E2's debate)?

### Setup

- **Hardware:** a Colab T4 runs the default (`Qwen2.5-0.5B-Instruct` + LoRA). Generating with Transformers is slow; with an L4 or A100, add `--vllm` and you can move to 1.5B.
- **Files:** `common.py`, `L4_grpo.py`, `grpo_minimal.py`, `requirements.txt`. For vLLM, also `pip install vllm`.
- **Data:** GSM8K. The prompt asks the model to put the final number in `<answer></answer>`.

### Predict first

- **P1:** Step 2 samples each of 200 training questions 16 times to estimate its success rate. With E1's formula pᴳ + (1−p)ᴳ, about what `frac_reward_zero_std` do the first training batches have?
- **P2:** How does `frac_reward_zero_std` change during training?
- **P3:** `loss_type="grpo"` vs `"dapo"`: how do the lengths of wrong answers differ?
- **P4:** With G = 4 instead of 8, what share of groups has zero variance? Compute it.
- **P5:** Trained on the loose grader, what will the model learn?
- **P6:** Without the baseline, what happens to the reward curve and the gradient norm?
- **P7:** Before vs after training, which rises more, pass@1 or pass@16?

### Steps

**Step 1: write the grader and test it (the core of this lab)**

```bash
python L4_grpo.py --grader-only
```

The grader accepts one form only: **exactly one** `<answer>number</answer>`, compared **numerically**:

```python
def correctness(completions, answer, **kwargs):          # TRL passes the dataset's answer column by name
    out = []
    for c, gold in zip(completions, answer):
        a = parse_answer(c[0]["content"])                 # chat format: the text is in c[0]["content"]
        out.append(1.0 if a is not None and abs(a - float(gold)) < 1e-6 else 0.0)
    return out
```

The script first runs adversarial tests and stops if any fails:

| Answer | Gold | Strict | Loose ("gold is in the text") | Tests |
|---|---|---|---|---|
| `<answer>42.0</answer>` | 42 | 1 | 1 | numeric normalisation |
| `<answer>1,000</answer>` | 1000 | 1 | **0** | thousands separator |
| It is 41, 42 or 43. | 42 | 0 | **1** | several numbers listed |
| two `<answer>` tags | 42 | 0 | **1** | several answers |
| `<answer>forty-two</answer>` | 42 | 0 | 0 | not a number |
| empty | 42 | 0 | 0 | empty input |

Note that the loose grader is **wrong in both directions**: it refuses some right answers and accepts some wrong ones. The script then writes 50 of the model's answers to `runs/L4-grader-audit.csv`. Fill the `human` column with 1 or 0 yourself and compute the agreement (E1's rule: test the grader before training on it).

**Optional: an LLM judge**

```bash
python L4_grpo.py --judge local     # default: a local Qwen2.5-1.5B-Instruct, free
python L4_grpo.py --judge api       # optional: any OpenAI-compatible service
```

Both report the judge's agreement with the rule grader and the time per answer. Look at where they disagree: who is right?

With an API, **the key is read from an environment variable and never written into code or a notebook**:

```bash
export JUDGE_API_KEY=...   JUDGE_BASE_URL=https://.../v1   JUDGE_MODEL=...
```

In Colab, store the key in "Secrets" (the key icon on the left), then in a cell `os.environ["JUDGE_API_KEY"] = userdata.get("JUDGE_API_KEY")` (`from google.colab import userdata`). An API costs money and needs your own account; 50 short calls cost little, but not nothing.

**Step 2: the baseline, before training**

```bash
python L4_grpo.py --baseline              # much faster with --vllm
```

It samples 200 training and 200 test questions 16 times each (temperature 1.0) and reports, per question, the number right c; the pass@k curve; the coverage (solved at least once); and the **predicted** `frac_reward_zero_std`. The prediction uses the same "choose G without replacement" counting as pass@k: from n samples with c right, the chance that a group of G is all right or all wrong is estimated by (C(c,G) + C(n−c,G)) / C(n,G), whose expectation is exactly E1's pᴳ + (1−p)ᴳ. Without vLLM, `--eval-n 8` halves the sampling.

**Step 3: train**

```bash
python L4_grpo.py --run R0
```

```python
args = GRPOConfig(num_generations=8, per_device_train_batch_size=8, gradient_accumulation_steps=2,
                  max_completion_length=512, max_steps=250, learning_rate=5e-6,
                  beta=0.0, loss_type="dapo", epsilon=0.2, epsilon_high=0.28, scale_rewards="group",
                  mask_truncated_completions=True, temperature=1.0, **device_setup())
trainer = GRPOTrainer(model="Qwen/Qwen2.5-0.5B-Instruct", reward_funcs=[correctness], args=args,
                      train_dataset=train, peft_config=LoraConfig(r=16, lora_alpha=32, target_modules="all-linear"))
```

This is the default recipe from E1's last page. Two things to know: TRL 1.15 defaults to `mask_truncated_completions=False`, so it is set explicitly here; and 5e-6 is a starting point. LoRA usually wants about 10× the full fine-tuning learning rate[^lwr-en]; if the reward has not moved after 100 steps, try 2e-5.

Each comparison run changes one thing:

| Run | Change | Prediction |
|---|---|---|
| R1 | `loss_type="grpo"`: average inside each answer first | P3 |
| R2 | G = 4 | P4 |
| R3 | train on the loose grader; the strict one is only logged (weight 0) | P5 |
| R4 (optional) | `beta=0.04`; `kl` appears in the log | |
| R5 (optional) | LoRA r = 1 | E2's "rank 1 is enough" |
| R6 (optional) | no baseline: `grpo_minimal.py` | P6 |

**R6: GRPO written from scratch.** TRL has no switch to turn the group-mean baseline off, so R6 uses `grpo_minimal.py` (about 100 lines; its core is E1's "GRPO's core in 20 lines"). Each batch gets one step, so the ratio is always 1 and clipping never acts (derived in E1).

```bash
python grpo_minimal.py --adv grpo     # (r − mean) / std
python grpo_minimal.py --adv mean     # r − mean (no std, Dr. GRPO)
python grpo_minimal.py --adv none     # r alone: no baseline
```

**The `--fmt` option** adds a small format reward (weight 0.2). Small models often ignore the format at first, and this helps them start. But note: with a format reward, a group that is all right or all wrong can still differ in format, so `frac_reward_zero_std` no longer follows P1's formula.

**A faster T4 route (optional, not run in this build):** Unsloth brings vLLM generation and 4-bit loading, so a T4 can run 1.5B. Follow Unsloth's official GRPO notebook for the loading code; roughly:

```python
from unsloth import FastLanguageModel
model, tok = FastLanguageModel.from_pretrained("Qwen/Qwen2.5-1.5B-Instruct", max_seq_length=1024,
    load_in_4bit=True, fast_inference=True, max_lora_rank=16, gpu_memory_utilization=0.6)
model = FastLanguageModel.get_peft_model(model, r=16, lora_alpha=16, use_gradient_checkpointing="unsloth",
    target_modules=["q_proj", "k_proj", "v_proj", "o_proj", "gate_proj", "up_proj", "down_proj"])
# then hand model, tok, the same GRPOConfig and correctness to GRPOTrainer
```

**Step 4: after training.** The script repeats step 2's evaluation on the same 200 test questions and writes `runs/L4-<run>/passk.json`. Plot the before and after pass@k curves together. For R3, also read the 20 answers with the highest loose reward.

### What to record

- Rewards: `reward`, `rewards/correctness/mean` (in R3 also `rewards/loose/mean`), `reward_std`, `frac_reward_zero_std`;
- Lengths: `completions/mean_length`, `completions/mean_terminated_length`, `completions/clipped_ratio`;
- Training dynamics: `entropy`, `clip_ratio/*`, `kl` (R4 only), `sampling/*`;
- Evaluation: pass@k and coverage before and after; R6's gradient norm (`runs/minimal-*.csv`).
- A practical note: with the default settings each optimizer step sees only 2 questions (16 answers ÷ G = 8), so a single step's `frac_reward_zero_std` can only be 0, 0.5 or 1. Compare P1 with the average over the first 50 steps.

### Expected results (qualitative)

- Accuracy rises slowly; with `--fmt`, the format reward saturates within a few dozen steps.
- **P1, P2:** over the first few dozen steps, `frac_reward_zero_std` should be close to P1's prediction. Later, more easy questions are solved every time and the share rises (E1's zero-variance figure; DAPO's dynamic sampling exists for this[^dapo-en]).
- **P3:** R1's wrong answers are longer: averaged per answer, a long wrong answer is punished less per token[^drgrpo-en]. In 250 steps the difference may be small; count the lengths of right and wrong answers separately.
- **P4:** R2 has a higher zero-variance share; compare with the formula.
- **P5:** the loose reward keeps climbing while the strict score stalls or falls. If "list several numbers" has not appeared within 250 steps, count the answers the loose grader scores 1 and the strict one 0, and check whether that share grows.
- **P6:** without the baseline, with 0/1 rewards, wrong answers are not punished at all; the gradient norm swings more and learning is slower (D2a: "the mean stays, the spread grows").
- **P7:** pass@1 rises more than pass@16, which may barely move. Yue et al. report that with enough samples, the base model's pass@k catches up with, or overtakes, the model after RL[^yue-en].
- **R5:** rank 1 lands close to rank 16[^lwr-en].
- The numbers are whatever you measure.

### Common problems

- **"The effective batch size must be divisible by `num_generations`":** change the per-device batch size or the gradient accumulation steps.
- **The reward function fails:** the list length differs from the number of answers; a None in the list; no `**kwargs` in the signature; a chat-format answer treated as a string.
- **All rewards are 0:** print 5 answers first. Common causes: a regex that is too strict, a system prompt that did not apply, the answer outside the tags, `max_completion_length` too short (check `completions/clipped_ratio`).
- **A high `completions/clipped_ratio`:** raise `max_completion_length` and keep `mask_truncated_completions=True`.
- **Reward rises, held-out accuracy does not:** check the grader first (see R3), then `sampling/*` for a mismatch between the training and generation probabilities (E2).
- **vLLM out of memory:** lower `gpu_memory_utilization`.
- **It will not run on a Mac:** as in L2, TRL 1.15 needs Triton, which only exists on Linux.

### Where this connects to the course

- E1's `grpo_group`: put one real group of rewards from the log into it and read the advantages;
- E1's zero-variance figure (P1, P4);
- E1's grader page and the "find the hole" question (step 1, R3);
- D2a's `pg_baseline` (R6);
- E2's `pass_k_sharpen` (step 4);
- C2 and E2 on "rank 1 is enough" (R5).

### Smoke test and known gaps

- Ran on a Mac with a random tiny Qwen: the grader tests (all pass), the 50-answer audit and the local judge, the baseline evaluation (with the zero-variance prediction), 2 training steps plus the after-training evaluation for R0, R1, R2 and R3, and 2 steps of `grpo_minimal.py` for each advantage. A tiny model never answers correctly, so the smoke test adds a coin-flip reward to make the gradient path actually run; it exists only under `LAB_SMOKE=1`.
- Not run: the real model, a GPU, `--vllm`, `--load-4bit`, Unsloth, `--judge api` (no key). No number has been measured yet.

[^lwr-en]: Schulman et al. (2025). LoRA Without Regret (Thinking Machines blog). https://thinkingmachines.ai/blog/lora/
[^dapo-en]: Yu et al. (2025). DAPO: An Open-Source LLM Reinforcement Learning System at Scale. https://arxiv.org/abs/2503.14476
[^drgrpo-en]: Liu et al. (2025). Understanding R1-Zero-Like Training: A Critical Perspective (Dr. GRPO). https://arxiv.org/abs/2503.20783
[^yue-en]: Yue et al. (2025). Does Reinforcement Learning Really Incentivize Reasoning Capacity in LLMs Beyond the Base Model? https://arxiv.org/abs/2504.13837
