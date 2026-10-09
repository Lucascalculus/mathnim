## SFT and efficiency (Parts B, C): source and API verification (as of 2026-10-10)

Checks every **[补]**, "以原文为准", "待核实", "核对" and "以文档为准" item in [part-b-sft.md](part-b-sft.md) and [part-c-efficiency.md](part-c-efficiency.md). Papers were read in full text (arXiv PDFs); APIs were checked in the source at the release tag named. Status tags: **verified**, **corrected** (the right fact follows), **not found**. Quotes are short and exact.

### 1. Verified sources

1. **Self-Instruct.** Wang et al., ACL 2023, [2212.10560](https://arxiv.org/abs/2212.10560). **Verified, with a nuance.** 175 seed tasks; vanilla GPT-3 generates its *own* data: "about 52k instructions, paired with about 82K instance inputs". It is self-bootstrapping, not a stronger teacher.
   **Stanford Alpaca** blog, Taori et al., 2023-03-13, [crfm.stanford.edu](https://crfm.stanford.edu/2023/03/13/alpaca.html). **Verified.** "52K instruction-following demonstrations generated from OpenAI's text-davinci-003", data "costed less than $500"; LLaMA-7B, same 175 seeds; fine-tune <$100 (3 h on 8×A100-80GB).
2. **Magpie.** Xu et al., 2024, [2406.08464](https://arxiv.org/abs/2406.08464). **Verified.** Aligned LLMs "can generate a user query when we input only the pre-query templates", due to "their auto-regressive nature" (e.g. Llama-3-Instruct).
3. **Gudibande et al.** Arxiv title "The False Promise of Imitating Proprietary LLMs" (2305.15717, 2023); published as "...Proprietary Language Models", [ICLR 2024](https://iclr.cc/virtual/2024/poster/18877). **Verified.** Crowd workers rate imitation outputs "as competitive with ChatGPT", yet imitation models "close little to none of the gap" on tasks not covered by the imitation data; they mimic "ChatGPT's style but not its factuality". Base models 1.5B–13B, 0.3M–150M imitation tokens.
4. **Shumailov et al.** arXiv "The Curse of Recursion" ([2305.17493](https://arxiv.org/abs/2305.17493)); Nature 631:755–759 (2024), "AI models collapse when trained on recursively generated data" ([doi](https://doi.org/10.1038/s41586-024-07566-y)). **Corrected (nuance).** Tails disappear under indiscriminate recursive training: verified. Mixing real data **mitigates but does not eliminate** it: with 10% original data kept per generation, "only minor degradation"; the authors say "Both training regimes lead to degraded performance".
5. **STaR.** Zelikman et al., NeurIPS 2022, [2203.14465](https://arxiv.org/abs/2203.14465). **Verified.** Rationalization: for each failed problem, regenerate a rationale with the correct answer as a hint. The hint is *not* kept in the training example ("we do not include the hint").
6. **ReST^EM / Beyond Human Data.** Singh et al., TMLR, [2312.06585](https://arxiv.org/abs/2312.06585). **Verified.** "simple self-training method based on expectation-maximization": Generate (E-step), Improve (M-step = SFT on filtered samples). It fine-tunes the *base* model each iteration. The paper relates it to Expert Iteration (ExIt) but names it EM.
7. **Kim & Rush 2016.** EMNLP 2016, [1606.07947](https://arxiv.org/abs/1606.07947). **Verified, with a caveat for D3.** Sequence-level KD trains on the teacher's **beam-search output**: it approximates the teacher "distribution q with its mode". "SFT on teacher samples = forward KL" is exact only for *sampled* outputs. With greedy or beam outputs it is a mode approximation.
8. **EntiGraph / Synthetic continued pretraining.** Yang et al., [ICLR 2025 oral](https://iclr.cc/virtual/2025/oral/31934), [2409.07431](https://arxiv.org/abs/2409.07431). **Verified.** Uses a 1.3M-token corpus (QuALITY books) to make 455M synthetic tokens with gpt-4-turbo, then CPT on Llama 3 8B. This recovers 80% of the accuracy gain of having the documents in context.
9. **Zheng et al. 2023 (MT-Bench / Chatbot Arena).** NeurIPS 2023 D&B, [2306.05685](https://arxiv.org/abs/2306.05685). **Verified, with one correction.** GPT-4 vs. humans 85% (non-tie) vs. human–human 81% ("over 80% agreement"). Position and verbosity bias: verified (repetitive-list attack fools Claude-v1/GPT-3.5 91.3%, GPT-4 8.7%). **Self-enhancement: the paper "cannot determine" it.** GPT-4 showed +10% self win rate and Claude-v1 +25%, but GPT-3.5 did not favor itself. Table numbers are in §4.
10. **AlpacaEval LC.** Dubois et al., COLM 2024, [2404.04475](https://arxiv.org/abs/2404.04475). **Verified.** Spearman with Chatbot Arena "from 0.94 to 0.98"; length gameability 26% → 10%.
11. **IFEval.** Zhou et al., 2023, [2311.07911](https://arxiv.org/abs/2311.07911). **Verified.** 25 verifiable instruction types and 541 prompts (the abstract says "around 500").
12. **Miller 2024, Adding Error Bars to Evals.** Anthropic, [2411.00640](https://arxiv.org/abs/2411.00640). **Verified.** Recommendations: CLT standard errors; clustered SEs when questions come in groups (can be ~3× larger); reduce variance by resampling answers or using next-token probabilities; "question-level paired differences"; power analysis.
13. **RL's Razor.** Shenfeld, Pari, Agrawal, 2025, [2509.04259](https://arxiv.org/abs/2509.04259). **Corrected (KL direction).**
    - Forgetting "is accurately predicted by E_{x∼τ} KL(π0‖π)", i.e. **base‖fine-tuned**, which the paper calls *forward* KL. Reverse KL(π‖π0) is nearly as good on ParityMNIST (R² 0.96 vs. 0.93). Weight-change metrics score R² 0.34–0.58.
    - On-policy RL is "implicitly biased towards KL-minimal solutions": verified.
    - **Oracle SFT exists**, on the ParityMNIST toy only: SFT on the KL-minimal correct distribution "retained more prior knowledge than RL". SFT distilled from an RL model matches RL.
    - LLM experiments (Qwen2.5-3B-Instruct; math, science QA, tool use): quadratic fit R² = 0.71.
14. **LIMA.** Zhou et al., NeurIPS 2023, [2305.11206](https://arxiv.org/abs/2305.11206). **Verified.**
    - Data: 750 community examples (Stack Exchange STEM 200 + Other 200, wikiHow 200, r/WritingPrompts 150). The other 250 are 200 author-written plus 50 lightly edited Super-NaturalInstructions examples.
    - Preference: 43% equal or preferred vs. GPT-4.
    - Ablation (7B, ChatGPT grader 1–6, 2,000 examples per arm): doubling Stack Exchange data "does not improve response quality". Diversity and quality help.
    - Hyperparameters: 15 epochs; AdamW β2 = 0.95, weight decay 0.1; LR 1e-5 → 1e-6 linear, no warmup; batch 32 (64 for smaller models); 2,048-token trim. Residual dropout rises linearly from 0.0 (bottom layer) to 0.3 (0.2 for smaller models). Checkpoint picked by hand between epochs 5 and 10 on a 50-example dev set, because perplexity did not track quality.
15. **InstructGPT.** Ouyang et al., NeurIPS 2022, [2203.02155](https://arxiv.org/abs/2203.02155). **Verified.**
    - SFT train prompts: 12,725 (11,295 labeler + 1,430 customer); "about 13k".
    - Training: 16 epochs, cosine LR to 10% with no warmup, residual dropout 0.2. LR 9.65e-6 with batch 32 (1.3B/6B); 5.03e-6 with batch 8 (175B).
    - The model "overfit on validation loss after 1 epoch", but more epochs help "both the RM score and human preference". Checkpoints chosen by RM score.
16. **Llama 3.** [2407.21783](https://arxiv.org/abs/2407.21783). **Verified.** "we sample K (typically between 10 and 30) outputs" and the RM picks the best. Each round is SFT then DPO; "six rounds".
17. **DeepSeek-R1.** Nature 645:633–638 (2025); arXiv [2501.12948](https://arxiv.org/abs/2501.12948) v2 (Jan 2026). **Verified.**
    - SFT data: ~600k reasoning samples (rejection-sampled from the RL checkpoint) + ~200k non-reasoning = 804,745 (App. B.3.3, Table 5).
    - AIME 2024 pass@1: R1-Distill-Qwen-32B 72.6 vs. "Qwen2.5-32B-Zero" (RL) 47.0. This is v2 Table 16 (App. F.1); in v1 it was Table 6, labeled "DeepSeek-R1-Zero-Qwen-32B".
18. **Thinking Machines "On-Policy Distillation"** (Kevin Lu, 2025-10-27), [blog](https://thinkingmachines.ai/blog/on-policy-distillation/), section *Distillation for personalization → Training on new knowledge degrades learned behavior*, table after *On-policy distillation recovers post-training behavior*. **Corrected.** Qwen3-8B starts at IF-eval **85%** and internal QA 18%:

    | Setup | IF-eval | Internal QA |
    |---|---|---|
    | 100% documents | 45% | 43% |
    | 70/30 documents/chat | 79% | 36% |
    | 70/30 + on-policy distillation | 83% | 41% |

    "no weighting maintains the original IF-eval", not even 100% chat data. So 70/30 still costs 6 points.
19. **LoRA Without Regret** (John Schulman et al., 2025-09-29), [blog](https://thinkingmachines.ai/blog/lora/). **Verified, except the capacity figure.**
    - Matches full FT for small and medium SFT when not capacity-bound. All layers, especially MLP: attention-only "significantly underperforms", even at matched parameters (attn r=256, 0.25B, vs. MLP r=128, 0.24B). MLP-only ≈ all layers.
    - Optimal LR is 10× full FT (fitted multiplier 9.8; ~15× for runs under ~100 steps). Optimal LR changes "by a factor of less than 2" between r=4 and r=512, lower at r=1.
    - With 1/r, "the learning curve is exactly the same at the beginning".
    - Less tolerant of large batches, independent of rank.
    - RL works "even with ranks as low as 1"; rank-1 Llama-3.1-8B ≈ 3M params.
    - Compute ≈ ⅔ of full FT.
    - **Capacity: "2 bits per parameter" is a citation of [Allen-Zhu & Li, Physics of LMs 3.3](https://arxiv.org/abs/2404.05405)** (neural nets in general, synthetic data, long-training limit). It is not a Thinking Machines measurement of LoRA. TM only bounds SFT information as ~1 bit/token of first-epoch loss and calls it an overestimate.
20. **Biderman et al., LoRA Learns Less and Forgets Less.** TMLR 08/2024, [2405.09673](https://arxiv.org/abs/2405.09673). **Verified.**
    - Llama-2-7B on code and math. IFT ≈100K pairs (Magicoder-Evol-Instruct-110K, MetaMathQA); CPT ≈20B tokens (StarCoder-Python, OpenWebMath).
    - Full-FT perturbation rank is "10-100× greater than typical LoRA configurations".
    - Nuance: LoRA gives the better learn–forget trade-off for code; full FT is better for math. On Tülu-v2-mix, LoRA is on par.
21. **Aghajanyan et al.** ACL 2021, [2012.13255](https://arxiv.org/abs/2012.13255). **Verified.** "only 200 trainable parameters randomly projected back into the full space" reach "90% of the full parameter performance levels on MRPC" (RoBERTa).
22. **rsLoRA.** Kalajdzievski 2023, [2312.03732](https://arxiv.org/abs/2312.03732). **Verified.** Claims adapters "should be divided by a factor of the square root of the rank". Theorem: as r → ∞, γ_r ∈ Θ(1/√r) is necessary and sufficient for forward and backward moments to stay Θ(1). The App. A proof uses **SGD** updates (γ²·r·σ_A·η), the same as part-c D4's SGD step. Experiments: Llama 2, 20k OpenOrca, AdamW 5e-5, ranks 4–2048. Standard α/r plateaus across ranks; rsLoRA improves with rank.
23. **QLoRA.** Dettmers et al., NeurIPS 2023, [2305.14314](https://arxiv.org/abs/2305.14314). **Verified.**
    - NF4: N(0,1) quantiles, asymmetric to keep an exact zero; values are in App. E.
    - Blocksize 64 for weights. Double quantization uses FP8 with blocksize 256 and subtracts the mean of c2: 0.5 → "8/64 + 32/(64·256) = 0.127 bits", ≈3 GB saved at 65B.
    - Paged optimizers use NVIDIA unified memory. A 65B model fits on one 48 GB GPU.
    - "LoRA on all linear transformer block layers are required to match full finetuning performance".
    - **bitsandbytes** ([functional.py](https://github.com/bitsandbytes-foundation/bitsandbytes/blob/main/bitsandbytes/functional.py), release 0.50.2): `create_normal_map(offset=0.9677083, use_extra_value=True)`. Positive side `linspace(offset,0.5,9)[:-1]` (8 values), negative side `linspace(offset,0.5,8)[:-1]` (7), plus 0, then `/= max`. Hardcoded table: −1, −0.69619, −0.52507, −0.39492, −0.28444, −0.18477, −0.09105, 0, 0.07958, 0.16093, 0.24611, 0.33792, 0.44071, 0.56262, 0.72296, 1. These match the plan. Φ⁻¹(0.9677083) = 1.8481.
    - **Offset formula: corrected.** 1 − ½(1/32 + 1/30) = 0.96770833 matches numerically, but that derivation is a [third-party reconstruction](https://clay-atlas.com/us/blog/2024/01/21/qlora-efficient-finetuning-of-quantized-llms-2/). The bnb docstring calls the offset "empirically optimized". Present it as a numerical match, not an official derivation.
24. **Yoshida 2023, "NF4 Isn't Information Theoretically Optimal (and that's Good)".** TTIC, arXiv note, [2306.06965](https://arxiv.org/abs/2306.06965). **Verified (exists; remove "待核实").** The distribution to be quantized "depends on the block-size". NF4 does **not** give each code an equal share of inputs, and codes that do are worse than NF4 on LMs. The proposed AF4 (minimizes expected L1) helps at large blocks and is about equal at 64.
25. **Huerta-Enochian & Ko.** EMNLP 2024, [2401.13586](https://arxiv.org/abs/2401.13586). **Verified, with the condition stated.**
    - Short-completion data shows a significant "negative quadratic relationship with PLW". PLW 0.01–0.5 is best on multiple-choice and short-generation benchmarks; PLW ≈ 1 is best on long-generation benchmarks.
    - The effect was significant only for AlpacaDataShort; no relation on AlpacaData or AlpacaDataCleaned.
    - Setup: LLaMA-1/2 7B; 10 PLW levels.
    **Shi et al.** NeurIPS 2024, [2405.14394](https://arxiv.org/abs/2405.14394). **Verified.** Loss on instructions helps with long instructions and short outputs, or with few examples (the superficial-alignment setting). It gives over +100% on AlpacaEval 1.0 in the best case, attributed to "reduced overfitting".
26. **Raghavendra et al.** Scale AI, 2024, [2410.03717](https://arxiv.org/abs/2410.03717). **Verified.** P = a·D^{1/b} for math, multihop QA, coding and IF on Llama-3-8B, Mistral-7B, Llama-2-7B base models (3 epochs). The paper's wording: "at best, an over-simplification". Coefficients and values are in §4.
27. **Efficiency papers.** **All verified.**
    - [Micikevicius et al.](https://arxiv.org/abs/1710.03740), ICLR 2018: FP32 master weights; an update vanishes when the weight is ≥2048× (2¹¹, FP16) larger. The plan's bf16 version (2⁸) is an adaptation; label it so.
    - [Dettmers 8-bit optimizers](https://arxiv.org/abs/2110.02861), ICLR 2022: block-wise dynamic quantization.
    - [Chen et al. 2016](https://arxiv.org/abs/1604.06174): O(√n) memory for "an extra forward pass per mini-batch".
    - [FlashAttention](https://arxiv.org/abs/2205.14135), NeurIPS 2022.
    - [Liger Kernel](https://github.com/linkedin/Liger-Kernel): transformers doc claims ~20% throughput and ~60% memory.
    - [Cut Cross-Entropy](https://arxiv.org/abs/2411.09009), ICLR 2025: Gemma 2 (2B) loss memory "from 24 GB to 1 MB", classifier head 28 GB → 1 GB.
    - [Korthikanti et al.](https://arxiv.org/abs/2205.05198), MLSys 2023: sbh(34 + 5as/h).
      - Attention 11sbh: QKV input 2, Q+K 4, V 2, output-projection input 2, dropout mask 1.
      - Plus 5as²b: softmax output 2, softmax-dropout mask 1, dropout output 2.
      - MLP 19sbh: inputs 2 + 8, GeLU input 8, dropout mask 1.
      - LayerNorms 4sbh.
      - The plan's breakdown matches.
28. **Serving and quantization papers.** **All verified.**
    - [S-LoRA](https://arxiv.org/abs/2311.03285), MLSys 2024: "thousands of LoRA adapters", unified paging, up to 4× throughput.
    - [Punica](https://arxiv.org/abs/2310.18547), MLSys 2024: SGMV kernel batches different adapters; 12× throughput.
    - [LoftQ](https://arxiv.org/abs/2310.08659), ICLR 2024: quantizes the weights and finds a LoRA init together, to cut the quantization discrepancy.
    - [GPTQ](https://arxiv.org/abs/2210.17323), ICLR 2023: one-shot, approximate second-order.
    - [AWQ](https://arxiv.org/abs/2306.00978), MLSys 2024: protects 1% salient channels, chosen from activations.
    - [Bengio et al. 2013](https://arxiv.org/abs/1308.3432) named the "straight-through estimator". They attribute the idea to Hinton's lectures.
29. **Gemma 3 QAT** ([Google Developers Blog, 2025-04-18](https://developers.googleblog.com/en/gemma-3-quantized-aware-trained-state-of-the-art-ai-to-consumer-gpus/)). **Verified.** QAT for ~5,000 steps against the bf16 checkpoint's probabilities. Cuts the perplexity drop at Q4_0 by 54% (llama.cpp). 27B weights go from 54 GB to 14.1 GB.
    **Kimi K2 Thinking** ([HF card](https://huggingface.co/moonshotai/Kimi-K2-Thinking)). **Verified.** QAT "in post-training stage"; INT4 weight-only on the MoE components; about 2× generation speed.
30. **Unsloth CPT guide** ([docs](https://unsloth.ai/docs/basics/continued-pretraining)). **Verified.** Add `"lm_head", "embed_tokens"` to `target_modules`. `UnslothTrainingArguments(learning_rate=5e-5, embedding_learning_rate=5e-6)`, with the comment "2-10x smaller". The untrained Llama-3 base template tokens (<|eot_id|>, header tokens; 287 in all) are documented in the [Unsloth Llama 3 blog](https://unsloth.ai/blog/llama3), which closes part-b B1 #9's "核对".
31. **`resize_token_embeddings(mean_resizing=True)`.** **Verified.** Added in transformers **v4.46.0** (absent in 4.45.0) and still the default in [v5.19.0](https://github.com/huggingface/transformers/blob/v5.19.0/src/transformers/modeling_utils.py). New rows (embeddings and an untied LM head) are drawn from N(mean, 1e-9·Cov) of the old rows, which is effectively the mean; it falls back to the exact mean if the covariance is not positive definite.
32. **Fireworks.** **Verified, with the source moved.** "up to 100 LoRA adaptations to run simultaneously on a dedicated deployment" is in the [SFT tutorial blog (2025-05-12)](https://fireworks.ai/blog/supervised-fine-tuning-tutorial), not the docs. `docs.fireworks.ai/guides/understanding_lora_performance` now 308-redirects to [Deploying Trained Models](https://docs.fireworks.ai/fine-tuning/deploying-loras#lora-performance). There, live merge "Matches base model"; multi-LoRA "TTFT often +10–30%". The docs give no adapter cap.

### 2. Corrections the plans need (most important first)

| # | Plan, location | Plan says | Correct |
|---|---|---|---|
| 1 | B3 `forgetting-distance`, goal 4, #13, D3 | Forgetting predicted by KL(π_ft‖π_0); estimate by sampling from π_ft | Paper: E_{x∼τ} **KL(π_0‖π_ft)** (base first). Reverse is also predictive (R² 0.93 vs. 0.96, ParityMNIST); LLM R² 0.71. Either switch D3 to sampling y∼π_0 and averaging log π_0 − log π_ft, or say "both directions predict; the paper uses KL(π_0‖π)". |
| 2 | B2 #10, fig B2-4, B2 counterexample (from [技] §7 and research-technical line 150) | 70/30 "keeps" IF-eval at 79% vs. 45% | Qwen3-8B baseline 85%. 70/30 → 79% (still −6). 100% docs → 45%. On-policy distillation restores 83%. Knowledge 36% vs. 43%. No mix keeps 85%. Model is Qwen3-8B (post-trained), not a base model. |
| 3 | C2 D5.1 (and research-technical line 83) | "Thinking Machines estimates LoRA stores ~2 bits/param" | TM cites Allen-Zhu & Li 3.3 ([2404.05405](https://arxiv.org/abs/2404.05405)): neural nets, synthetic data, long-training limit. Not a LoRA measurement. Label D5 as an order-of-magnitude assumption. TM's own SFT bound is ≤ ~1 bit/token; the plan's 0.1 bit/token is the plan's assumption. |
| 4 | B3 `judge-objective`, #8 | LLM judges "偏好自家模型" | Zheng et al. cannot confirm self-enhancement: GPT-4 +10% and Claude-v1 +25% self win rate, GPT-3.5 none. Keep position and verbosity as established; mark self-preference as suggestive. |
| 5 | C3 `nf4-uniform`, D1 | NF4: "每个格分到的权重一样多"; Yoshida "待核实" | Equal mass holds only for exact N(0,1) inputs. After blockwise absmax it does not (Yoshida, verified), and equal-mass codes do worse. Say "designed for equal mass under a normal assumption". |
| 6 | C3 D1.3 | Offset = 1 − ½(1/32+1/30) as "the origin" | Numerically equal (0.96770833), but the derivation is a third-party reconstruction. bnb calls the offset empirically chosen. |
| 7 | B1 #3, B1-c1, B2-c5 | `return_assistant_tokens_mask=True` on Qwen2.5 / Llama 3 | Stock Qwen2.5 and Llama-3.1 templates have **no `{% generation %}`**, so the mask is empty. Use TRL v1.15's patched `qwen2_5_training.jinja` / `llama3_training.jinja` (auto-swapped with `assistant_only_loss=True`; [list](https://github.com/huggingface/trl/blob/v1.15.0/docs/source/chat_templates.md)). Also, in transformers v5 `apply_chat_template` defaults to `tokenize=True, return_dict=True`; pass `tokenize=False` for text. |
| 8 | B1 I2 (`pad_eos_trap`) | pad = EOS = Llama-3 `<\|eot_id\|>` on Llama-3.2-1B **base** | Official base tokenizer: eos `<\|end_of_text\|>`, no pad. Instruct: eos `<\|eot_id\|>` (official repos are gated; checked via the ungated [NousResearch copy](https://huggingface.co/NousResearch/Meta-Llama-3.1-8B/blob/main/tokenizer_config.json); the Unsloth copies add a pad). State that the chat EOS was set to `<\|eot_id\|>` first. The "dedicated pad" fix is `<\|finetune_right_pad_id\|>` (id 128004, [Meta](https://github.com/meta-llama/llama-models/blob/main/models/llama3_1/prompt_format.md)). Qwen2.5 base ships pad = eos = `<\|endoftext\|>`, which is why TRL says to set `eos_token="<\|im_end\|>"`. |
| 9 | C1 #10, C1-c3, D4/D5 "不融合" column | Fused CE via `use_liger_kernel=True` in TRL | TRL v1.15 SFTTrainer **already computes log-probs in chunks** ("fused LM head") and deprecates `use_liger_kernel` (FutureWarning; use `model_init_kwargs={"use_kernels": True}`). The unfused 4.2 GB case applies to plain PyTorch or `Trainer`, where `use_liger_kernel` remains valid. |
| 10 | B1 `mask-dogma`, #6, Q3, B1-3 | Small PLW beats 0 and 1 on "长提示、短回答、数据少" data | Huerta-Enochian: holds for short-*completion* data on MC and short-generation benchmarks; PLW≈1 is better on long-generation benchmarks. "Few examples" is Shi's condition. In the raw composite, LLaMA-2 rises to PLW = 1 (§4). |
| 11 | B2 #4 | Self-Instruct and Alpaca "让强模型扩写，52K" | Self-Instruct: GPT-3 generates for itself (52K instructions, 82K instances). Alpaca: text-davinci-003, 52K, <$500. |
| 12 | B2 #4 risk | Collapse "前提是不混入真实数据" | Keeping 10% real data gives "only minor degradation"; it mitigates, it does not eliminate. |
| 13 | B2 D3 | Sequence-level KD = forward KL | Exact for sampled teacher outputs. Kim & Rush use beam output (mode approximation). |
| 14 | C2 D4.5 caveat | Neither derivation is the papers' | The SGD step matches rsLoRA's App. A proof. The Adam step is the plan's own (consistent with TM's identical early curves). |
| 15 | C2 D1.5, `lora-attention-only` | Attention-only at r≈49 matches all-linear r=16 params and is "still worse (TM)" | TM's matched test is attn r=256 vs. MLP r=128, and MLP-only ≈ all layers. The r≈49 equivalence is the plan's own extrapolation. |
| 16 | C2 #12, fig C2-5 | "Learns less, forgets less" | Add Biderman's nuance: LoRA has the better trade-off on code; full FT on math. On Tülu-v2-mix, LoRA is on par. |
| 17 | B3 hyperparameter table | LIMA "细节以原文为准"; InstructGPT batch "—" | Fill from items 14–15: InstructGPT LR 9.65e-6, batch 32 (1.3B/6B); dropout 0.0→0.3 by layer. |
| 18 | B2 #8 | Llama 3 "K 以原文为准" | K typically 10–30; six rounds. |
| 19 | C3 `lora-serving-free`, #9 | Fireworks link and doc | "100 adapters" comes from the blog; update the docs URL (item 32). |
| 20 | C1 D1.2 | bf16 swamping cited to [补] 混合精度训练 | The paper argues FP16 (2048×). Mark the bf16 numbers as an adaptation. |

### 3. API names

| API | Name in plan | Status | Doc (version) | Note |
|---|---|---|---|---|
| TRL `SFTConfig` | `assistant_only_loss`, `completion_only_loss`, `packing`, `packing_strategy='bfd'`, `padding_free`, `max_length`, `eos_token` | ok | [sft_config.py v1.15.0](https://github.com/huggingface/trl/blob/v1.15.0/trl/trainer/sft_config.py) | `completion_only_loss=None` means completion-only for prompt-completion data and full sequence for LM data. Strategies: `bfd` (truncates overflow), `bfd_split`, `wrapped`; `bfd` forces padding-free. `max_length` default 1024. SFTConfig defaults: `gradient_checkpointing=True`, LR 2e-5. |
| TRL `SFTConfig` | `pad_token` | deprecated (since 1.1.0) | same | Set `tokenizer.pad_token` instead. |
| TRL `SFTConfig` | `loss_type='dft'` | ok | same | Choices `nll`, `dft`, `chunked_nll` (deprecated alias of `nll`). |
| TRL / transformers | `use_liger_kernel` | deprecated in SFTTrainer; ok in `TrainingArguments` | [sft_trainer.py v1.15.0](https://github.com/huggingface/trl/blob/v1.15.0/trl/trainer/sft_trainer.py) | See correction 9. |
| transformers `apply_chat_template` | `tools=`, `add_generation_prompt`, `return_dict`, `return_assistant_tokens_mask` | ok | [tokenization_utils_base.py v5.19.0](https://github.com/huggingface/transformers/blob/v5.19.0/src/transformers/tokenization_utils_base.py) | Mask needs `{% generation %}` plus `tokenize=True, return_dict=True`; incompatible with `continue_final_message`. `return_dict` default True in v5. |
| transformers `Trainer` | `num_items_in_batch` | ok | [trainer.py v5.19.0](https://github.com/huggingface/transformers/blob/v5.19.0/src/transformers/trainer.py) | Passed to `compute_loss` / `training_step`. |
| transformers | `gradient_checkpointing=True`, `model.gradient_checkpointing_enable()` | ok | [training_args.py v5.19.0](https://github.com/huggingface/transformers/blob/v5.19.0/src/transformers/training_args.py) | TrainingArguments default False. |
| transformers `optim` | `"adamw_8bit"`, `"paged_adamw_8bit"` | ok | same | `adamw_8bit` is an alias of `adamw_bnb_8bit`. |
| `DataCollatorForLanguageModeling` | masks `labels == pad_token_id` | ok | [data_collator.py v5.19.0](https://github.com/huggingface/transformers/blob/v5.19.0/src/transformers/data/data_collator.py) | `mlm=False` path: `labels[labels == self.tokenizer.pad_token_id] = -100`. |
| transformers `resize_token_embeddings` | `mean_resizing` | ok | v5.19.0 (since v4.46.0) | See item 31. |
| PEFT `LoraConfig` | `r`, `lora_alpha`, `lora_dropout`, `target_modules="all-linear"`, `use_rslora`, `modules_to_save`, `trainable_token_indices` | ok | [lora/config.py v0.21.2](https://github.com/huggingface/peft/blob/v0.21.2/src/peft/tuners/lora/config.py) | Defaults r=8, `lora_alpha=8`, `lora_dropout=0.0`. "all-linear" excludes the output layer. `use_rslora` gives α/√r. `trainable_token_indices` trains only chosen embedding rows. |
| PEFT | `get_peft_model`, `print_trainable_parameters`, `merge_and_unload`, `prepare_model_for_kbit_training` | ok | [peft_model.py](https://github.com/huggingface/peft/blob/v0.21.2/src/peft/peft_model.py), [utils/other.py](https://github.com/huggingface/peft/blob/v0.21.2/src/peft/utils/other.py) v0.21.2 | kbit prep: fp32 LayerNorm, input grads, gradient checkpointing on by default. |
| PEFT init | A Kaiming-uniform, B zeros | ok | [lora/layer.py v0.21.2](https://github.com/huggingface/peft/blob/v0.21.2/src/peft/tuners/lora/layer.py) | `kaiming_uniform_(A, a=sqrt(5))`, `zeros_(B)` (`init_lora_weights=True`). |
| `BitsAndBytesConfig` | `load_in_4bit`, `bnb_4bit_quant_type="nf4"`, `bnb_4bit_use_double_quant`, `bnb_4bit_compute_dtype` | ok | [quantization_config.py v5.19.0](https://github.com/huggingface/transformers/blob/v5.19.0/src/transformers/utils/quantization_config.py) | Defaults are `fp4` and float32, so set them explicitly (the plan does). |
| vLLM offline | `LLM(enable_lora=True, max_loras, max_lora_rank)`; `LoRARequest(name, id, path)` | ok | [docs/features/lora.md v0.31.0](https://github.com/vllm-project/vllm/blob/v0.31.0/docs/features/lora.md), [lora/request.py](https://github.com/vllm-project/vllm/blob/v0.31.0/vllm/lora/request.py) | Fields `lora_name, lora_int_id (>0), lora_path`. `max_loras` default 1; `max_lora_rank` default 16, one of {1,8,16,32,64,128,256,320,512}. |
| vLLM server | `--enable-lora --max-loras --max-lora-rank`; `--enable-auto-tool-choice --tool-call-parser hermes` | ok | same; [tool_calling.md v0.31.0](https://github.com/vllm-project/vllm/blob/v0.31.0/docs/features/tool_calling.md) | Adapters via `--lora-modules name=path`. Docs: use `hermes` for Qwen2.5 (template is Hermes-style). |
| lm-eval | `lm_eval --model hf --model_args pretrained=...,peft=...` | ok | [README v0.4.13](https://github.com/EleutherAI/lm-evaluation-harness/blob/v0.4.13/README.md) | Add `--apply_chat_template` for instruct models (IFEval). |
| PyTorch | `reset_peak_memory_stats`, `max_memory_allocated`, `memory._record_memory_history`, `memory._dump_snapshot` | ok | [torch_cuda_memory (2.14)](https://docs.pytorch.org/docs/2.14/torch_cuda_memory.html), `torch/cuda/memory.py` v2.14.1 | View snapshots at pytorch.org/memory_viz. |
| Qwen2.5 tokenizer | eos / pad | checked | [Qwen2.5-7B](https://huggingface.co/Qwen/Qwen2.5-7B/blob/main/tokenizer_config.json), [‑Instruct](https://huggingface.co/Qwen/Qwen2.5-7B-Instruct/blob/main/tokenizer_config.json) (same for 0.5B) | **Base:** eos = pad = `<\|endoftext\|>` (151643); a ChatML template is included. **Instruct:** eos `<\|im_end\|>` (151645), pad `<\|endoftext\|>`; generation_config eos [151645, 151643]. Neither has `{% generation %}`. |
| Llama 3 template | tokens | checked | [Meta prompt format](https://github.com/meta-llama/llama-models/blob/main/models/llama3_1/prompt_format.md) | `<\|begin_of_text\|><\|start_header_id\|>role<\|end_header_id\|>\n\n…<\|eot_id\|>`. `<\|end_of_text\|>` (128001) is "generated only by the base models". Also `<\|eom_id\|>` (128008, tool) and pad `<\|finetune_right_pad_id\|>` (128004). |

### 4. Numbers for redrawn figures

- **Item 9, Zheng Table 2** (position bias; 80 MT-bench first-turn pairs of near-identical GPT-3.5 answers).
  - Columns: consistency / biased to first / biased to second / format error.
  - Claude-v1: default 23.8 / 75.0 / 0.0 / 1.2; rename 56.2 / 11.2 / 28.7 / 3.8.
  - GPT-3.5: default 46.2 / 50.0 / 1.2 / 2.5; rename 51.2 / 38.8 / 6.2 / 3.8.
  - GPT-4: default 65.0 / 30.0 / 5.0 / 0.0; rename 66.2 / 28.7 / 5.0 / 0.0.
  - Few-shot raises consistency: GPT-4 65.0 → 77.5, Claude-v1 23.8 → 63.7, GPT-3.5 46.2 → 55.0 (Table 12).
  - GPT-4 consistency by category (Table 10): writing 42, roleplay 68, reasoning 76, math 86, coding 86, extraction 78, STEM 44, humanities 36.
  - By pair (Table 11): 67.5% for close models, 98.8% for GPT-3.5 vs. LLaMA-13B.
- **Item 14, LIMA ablations** (7B; ChatGPT score 1–6 with 95% CI).
  - Fig. 5 (exact labels): wikiHow 3.49, unfiltered SE 3.33, filtered SE 3.83.
  - Fig. 6 (read from plot, ±0.01): 2K 3.83, 4K 3.86, 8K 3.84, 16K 3.83, 32K 3.82; CI about ±0.07; flat fit line.
- **Item 19, LoRA Without Regret.**
  - Fig. 2 (LR vs. final test NLL, Llama-3.1-8B, Tulu3; extracted from the page's SVG paths, ±0.001):
    - Full FT: 2e-6 0.617, 5e-6 0.576, 1e-5 0.552, **2e-5 0.548**, 5e-5 0.617, 1e-4 0.769.
    - Rank 1: 4e-5 0.587, 1e-4 0.587, 2e-4 0.596, 4e-4 0.612.
    - Rank 16: 4e-5 0.565, 1e-4 0.558, 2e-4 0.564, 4e-4 0.588.
    - Rank 32: 0.564, 0.555, 0.558, 0.583; 1e-3 0.725.
    - Rank 512: 4e-5 0.562, 1e-4 0.550, **2e-4 0.549**, 4e-4 0.568, 1e-3 0.703.
    - Ranks 1–16 go off the chart just above 4e-4. Ranks 32–512 are still finite at 1e-3 (0.70–0.73).
  - Fig. 1 (read from plot, ±0.002), final NLL at ~7.5k steps.
    - 8B/Tulu3: r1 0.587, r2 0.579, r4 0.571, r8 0.564, r16 0.559, r32 ≈0.555, r64–512 0.550–0.553, full 0.548.
    - 1B/Tulu3: r1 0.823, r2 0.804, r4 0.788, r8 0.772, r16 0.758, r32 0.745, high ranks ≈0.722–0.728, full ≈0.730. Here LoRA is better than full FT.
  - Fig. 3 (batch; 8B, 10k OpenThoughts subset; final loss at batch 32 / 64 / 128): full 1.383 / 1.381 / 1.392; r128 1.393 / 1.398 / 1.424; r256 1.392 / 1.398 / 1.428.
  - Fig. 4 (layers; 8B/Tulu3, final NLL): full 0.548, MLP r128 0.550, MLP r256 0.549, all r256 0.549, attention r256 0.563.
- **Item 20, Biderman Fig. 3.** Exact data are in Tables S1–S8; the y-axis is the target metric and x is the forgetting average of HellaSwag, ARC-C and WinoGrande.
  - Code CPT, at 0.25 / 1 / 4 / 20B tokens:
    - Full FT: HumanEval 0.152 / 0.172 / 0.218 / 0.263; forgetting 0.625 / 0.625 / 0.599 / 0.545.
    - r256: HumanEval 0.144 / 0.143 / 0.159 / 0.224; forgetting 0.644 / 0.643 / 0.636 / 0.617.
    - r16: HumanEval 0.143 → 0.162; forgetting 0.645 → 0.635.
  - Code IFT, at epochs 1 / 4 / 16:
    - Full FT: 0.302 / 0.470 / 0.416; forgetting 0.595 / 0.512 / 0.414.
    - r256: 0.299 / 0.498 / 0.466; forgetting 0.655 / 0.631 / 0.517.
    - r16: 0.197 / 0.358 / 0.324; forgetting 0.653 / 0.652 / 0.609.
  - Math IFT (GSM8K), at epochs 1 / 4 / 16:
    - Full FT: 0.604 / 0.642 / 0.599; forgetting 0.598 / 0.590 / 0.559.
    - r256: 0.557 / 0.625 / 0.594; forgetting 0.613 / 0.599 / 0.567.
  - Math CPT: full FT GSM8K 0.155 → 0.293 at 20B, forgetting 0.634 → 0.618; r256 0.162 → 0.202, forgetting 0.638 → 0.616.
- **Item 13, RL's Razor scatter** (shapes only, read from plots).
  - Fig. 3 middle (ParityMNIST; y = FashionMNIST score, x = KL; R² = 0.961): one convex decreasing curve for all methods. Approximate points (KL, score): (0, 68), (1, 57), (2, 48), (3, 43), (4, 38), (5, 34), (6, 31), (8, 23), (10, 18).
    - RL points sit at KL < 1 with score > 60; a few RL points fall at KL 2–3.6 with scores 32–49.
    - Oracle-SFT points sit at KL 0.1–0.6 with scores 54–69.
  - Fig. 11 (LLM; y = average prior-task score, x = KL; R² 0.71):
    - RL cluster at KL 0.2–0.6, score 0.576–0.584.
    - SFT flat at 0.57–0.584 for KL 0.6–1.9, then a cliff: 0.52–0.56 at KL 2.0–2.4 and 0.44–0.49 at KL 2.4–3.0.
- **Item 25, Huerta-Enochian Fig. 1** (AlpacaDataShort, read from plot). PLW levels 0, 5e-4, 2.236e-3, 1e-2, 2.463e-2, 5e-2, 0.1, 0.2463, 0.5, 1.0, on a nonlinear "transformed" axis.
  - (a) Raw composite:
    - LLaMA-1: .266, .276, .291, .300, .301, .303, .307, .312, .310, .309.
    - LLaMA-2: .267, .286, .302, .313, .308, .326, .328, .329, .330, .331.
  - (d) Min-max relative score (0 = min, 1 = max):
    - LLaMA-1: 0, .12, .28, .30, .53, .81, .92, 1.0, .68, .63.
    - LLaMA-2: 0, .30, ≈.45, .60, .89, 1.0, .86, .95, .84, .78.
  - Panel (d) is the inverted U the plan wants.
- **Item 26, Raghavendra** (exact fit coefficients from Table 7, P = a·D^{1/b}; fitted value at D = 1 / 10 / 100 / 1,000 / 7,500):
  - Math GSM8K: Llama-3-8B (19.47, 7.66): 19.5 / 26.3 / 35.5 / 48.0 / 62.4. Mistral-7B (8.14, 4.97): 8.1 → 49.0. Llama-2-7B (4.21, 5.47): 4.2 → 21.5.
  - Multihop SubQA: Llama-3-8B (11.54, 7.77): 11.5 → 36.4.
  - Coding: Llama-3-8B (27.14, 23.43): 27.1 → 39.7.
  - IF-Conifer: Llama-3-8B (31.06, 11.90): 31.1 → 65.7.
  - Plotted points are at D ≈ 1, 10, 100, 500, 1k, 5k and all available data, on a log-x axis.
- **Item 17, R1 bars** (exact): AIME 2024 pass@1: R1-Distill-Qwen-32B 72.6, Qwen2.5-32B-Zero (RL) 47.0, QwQ-32B-Preview 50.0. cons@64: 83.3 / 60.0 / 60.0.
