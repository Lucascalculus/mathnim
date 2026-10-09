## Fine-tuning LLMs: verified technical brief (as of 2026-10-10)

Every claim below links to the paper or official doc it came from. Tags: **[2025-26]** marks something that changed or was introduced recently; **[contested]** and **[uncertain]** mark open or weakly sourced claims.

### 1. What fine-tuning changes, and what it can't
- **Pipeline.**
  - Pretraining is next-token prediction on trillions of tokens. This is where the model's knowledge comes from.
  - SFT is the same loss on curated demonstrations.
  - Preference tuning or RL optimizes a scalar reward or a preference signal.
- **Superficial alignment hypothesis.** [LIMA](https://arxiv.org/abs/2305.11206) fine-tuned a 65B model on about 1,000 curated examples. Its outputs were equal to or preferred over GPT-4's in 43% of comparisons. The paper's claim: knowledge is almost entirely learned in pretraining, and alignment mostly teaches format.
  - [URIAL](https://arxiv.org/abs/2312.01552) supports this: the token distributions of aligned and base models differ mainly on stylistic tokens.
  - **[contested]** [Raghavendra et al. 2024](https://arxiv.org/abs/2410.03717) find that post-training performance follows a power law in the number of examples for math, code and multihop reasoning. They call the hypothesis "at best, an over-simplification."
- **New facts through SFT.** [Gekhman et al., EMNLP 2024](https://arxiv.org/abs/2405.05904): examples containing unknown facts are learned more slowly than known ones. Once learned, they increase hallucination roughly linearly. Practical consequences: use early stopping and filter out unknown examples (both from the paper body).
  - [Ovadia et al.](https://arxiv.org/abs/2312.05934): RAG beats unsupervised fine-tuning for injecting knowledge, both for facts the model has seen and for new ones. Paraphrased repetitions of a fact help.
- **How to choose between prompting, RAG and fine-tuning.**
  - Prompt first.
  - Use RAG for knowledge that is fresh, long-tail, or needs citations.
  - Fine-tune for consistent format or style, behaviour prompting can't fix, shorter prompts (lower latency and cost), distilling into a smaller model, or reasoning with graders ([OpenAI guide](https://developers.openai.com/api/docs/guides/model-optimization)).
  - **[2025-26]** That same OpenAI page now says its fine-tuning platform is being wound down and is closed to new users (update dated May 2026). The detailed timeline comes only from [third-party reporting](https://tessl.io/blog/openai-shutting-fine-tuning-signals-for-enterprise-ai).

### 2. SFT mechanics
- **Loss.** L = -Σ_t m_t · log p_θ(y_t | y_<t), where m_t masks out padding and, usually, prompt tokens.
  - Normalize by the total number of unmasked tokens across all micro-batches. Per-micro-batch means broke gradient accumulation until a fix in [Oct 2024](https://huggingface.co/blog/gradient_accumulation).
  - Tülu 3 deliberately uses a sum loss ([2411.15124](https://arxiv.org/abs/2411.15124)).
- **Chat templates.** Train with the exact template used at inference (`apply_chat_template`). The end-of-turn token must equal the EOS the generator stops on; TRL warns, for example, to set `eos_token="<|im_end|>"` for Qwen base models.
  - New special tokens need resized embeddings, and the embedding and LM-head rows for them must be trained.
  - In TRL, `assistant_only_loss` needs `{% generation %}` tags in the template ([TRL v1.15 docs](https://huggingface.co/docs/trl/sft_trainer)).
- **Prompt-loss masking, measured effects.**
  - [Huerta-Enochian 2024](https://arxiv.org/abs/2401.13586): with short-completion data, a small prompt-loss weight of 0.01–0.5 beats both 0 and 1. With long completions, a weight near 1 is fine.
  - [Shi et al. 2024](https://arxiv.org/abs/2405.14394): putting loss on instructions helps when instructions are long, outputs are short and data is scarce (up to over 100% on AlpacaEval 1.0), mainly by reducing overfitting.
  - **[2025-26] TRL defaults:** `completion_only_loss` is effectively on for prompt-completion datasets; `assistant_only_loss=False`.
- **Packing.** Concatenating examples without boundary-aware attention causes cross-example contamination. The fix passes `position_ids` to FlashAttention varlen kernels. Result: roughly 2× throughput on FLAN, 1.4× on OrcaMath, identical validation loss ([HF blog](https://huggingface.co/blog/packing-with-FA2)). TRL's default packing strategy is now `bfd` (best-fit decreasing) and is padding-free.
  - Packing also changes per-sequence versus per-token loss weighting.
- **Hyperparameters (typical).**
  - Full-FT learning rate is about 1e-6 to 2e-5. Tülu 3 SFT used 5e-6 for 8B and 2e-6 for 70B, 2 epochs, batch 128, 4k sequence length, linear schedule, 3% warmup. TRL's default LR is 2e-5.
  - LoRA learning rate is about 1e-4 to 2e-4, roughly 10× the full-FT optimum ([LoRA Without Regret](https://thinkingmachines.ai/blog/lora/); QLoRA used 2e-4 for 7–13B).
  - Use 1–3 epochs. Tiny curated sets tolerate more: LIMA ran 15 epochs with dropout.
- **Overfitting signs.** Validation loss rises, output diversity or entropy collapses, the model parrots training phrasing, general evals regress, and it fails to stop.
  - Caveat: InstructGPT's SFT overfit on validation loss after 1 epoch, yet more epochs still improved reward-model score and human preference ([2203.02155](https://arxiv.org/abs/2203.02155)). LIMA likewise found perplexity did not track quality. Pick checkpoints by task evals, not loss alone.
- **Data quality versus quantity.**
  - Small, high-quality sets are enough for format and style, and can elicit reasoning: [s1](https://arxiv.org/abs/2501.19393) used 1,000 traces on Qwen2.5-32B and beat o1-preview by up to 27% on MATH/AIME.
  - Real capability gains keep scaling with data size (Raghavendra above).
- **Loss variant.** **[2025-26]** Dynamic Fine-Tuning ([2508.05629](https://arxiv.org/abs/2508.05629)) is available in TRL as `loss_type="dft"`. It reweights each token's loss by its stop-gradient probability. **[contested]**

### 3. Memory and compute
- **Per-parameter cost.** Mixed-precision Adam costs 16 bytes per parameter: 2 (bf16 weights) + 2 (bf16 grads) + 12 (fp32 master copy, m, v) ([ZeRO](https://arxiv.org/abs/1910.02054)). Pure-bf16 states cost 8 B/param; 8-bit Adam about 10 B/param.
- **Activations per layer.** Without recomputation, about s·b·h·(34 + 5as/h) bytes ([Korthikanti et al.](https://arxiv.org/abs/2205.05198)). FlashAttention removes the 5as/h term.
  - Full gradient checkpointing keeps only each layer's input (2sbh bytes) and costs one extra forward pass, about +33% FLOPs.
- **Compute.** Training costs about 6N FLOPs per token. LoRA skips frozen-weight gradients, giving about 4N, slightly over 2/3 of full FT (Thinking Machines).
- **Hidden cost: logits.** s × V × 4 bytes. Use fused or chunked cross-entropy (e.g., [Cut Cross-Entropy](https://arxiv.org/abs/2411.09009)).

**Worked estimate: Llama-3.1-8B, sequence 4,096, batch 1**
- **Model shape.** N = 8.03B. About 6.98B sits in the block linear layers and 1.05B in the untied embedding and LM head.
- **Activations (shared assumption for the totals below).** Without checkpointing: about 32 × 34·s·h ≈ 18 GB. This uses the GPT-style constant, so it is approximate for SwiGLU/GQA. With checkpointing: about 1–2 GB.
- **Logits.** 4096 × 128,256 × 4 B ≈ 2.1 GB, plus the same again for their gradient.

| Setup | Weights and optimizer state | Total |
|---|---|---|
| Full FT (AdamW, mixed precision) | 16 B × 8.03B ≈ 128 GB | about 135–150 GB, so it needs 2 or more 80 GB GPUs with FSDP/ZeRO-3 sharding, or CPU offload |
| LoRA r=16 on all linear layers | Trainable params = r·Σ(d_in+d_out) = 16 × 81,920 × 32 ≈ 41.9M (0.52%). Frozen bf16 base 16.1 GB + adapter state about 0.7 GB | about 20–23 GB (Unsloth's stated minimum for 8B LoRA is [22 GB](https://unsloth.ai/docs/get-started/beginner-start-here/unsloth-requirements)) |
| QLoRA | NF4 linear layers: 6.98B × (4 + 0.127)/8 B ≈ 3.6 GB. bf16 embedding and LM head: 2.1 GB. Adapters: about 0.7 GB | about 8–10 GB at 4k context (Unsloth's stated minimum is 6 GB) |

### 4. Parameter-efficient fine-tuning (PEFT)
- **LoRA.** h = W₀x + (α/r)·B·A·x, with A ∈ ℝ^{r×k}, B ∈ ℝ^{d×r}. B is initialized to 0 so training starts at the base model; A is random (Kaiming-uniform in PEFT).
  - Trainable parameters drop from dk to r(d+k). Merging back as W₀ + (α/r)BA adds zero inference latency.
  - On GPT-3 175B: 10,000× fewer trainable parameters and 3× less GPU memory ([2106.09685](https://arxiv.org/abs/2106.09685)).
- **Why low rank works.** Fine-tuning has a low intrinsic dimension: 200 randomly projected parameters reach 90% of full fine-tuning on RoBERTa/MRPC ([Aghajanyan et al.](https://arxiv.org/abs/2012.13255)).
  - Counterpoint: full-FT weight updates have 10–100× higher rank than typical LoRA configurations ([LoRA Learns Less and Forgets Less, TMLR](https://arxiv.org/abs/2405.09673)).
- **Which modules.** QLoRA found that LoRA on all linear layers is required to match full fine-tuning ([2305.14314](https://arxiv.org/abs/2305.14314)). **[2025-26]** MLP layers matter most; attention-only LoRA underperforms even at matched parameter count (Thinking Machines).
- **rsLoRA.** Scale by α/√r instead of α/r, so higher ranks keep learning ([2312.03732](https://arxiv.org/abs/2312.03732); `use_rslora` in [PEFT](https://huggingface.co/docs/peft/developer_guides/lora)).
- **DoRA.** W' = m · (W₀+BA)/‖W₀+BA‖_c. Magnitude and direction are learned separately, with LoRA applied to the direction ([ICML'24 oral](https://arxiv.org/abs/2402.09353)).
- **Other initialisations.** PEFT also offers PiSSA, OLoRA, EVA, LoftQ and CorDA.
- **QLoRA details.**
  - NF4 places quantization levels at quantiles of N(0,1), with blocks of 64.
  - Double quantization cuts overhead from 0.5 to 0.127 bits per parameter (about 3 GB saved at 65B).
  - Paged optimizers use unified memory to absorb memory spikes.
  - It fine-tunes a 65B model on one 48 GB GPU.
- **Merging adapters.** `merge_and_unload()`, or `add_weighted_adapter` with linear, svd or cat combinations.
  - [uncertain, practitioner caveat] A QLoRA adapter was trained against dequantized NF4 weights, so merging it into the bf16 original introduces a small mismatch. Re-evaluate after merging.
- **Quality gap.**
  - Biderman et al.: on code and math, both instruction fine-tuning (100K examples) and continued pretraining (20B tokens), LoRA substantially underperforms full FT but forgets less.
  - **[2025-26]** [LoRA Without Regret](https://thinkingmachines.ai/blog/lora/): with all layers adapted, LR about 10×, and small batches, LoRA matches full FT for small and medium SFT. It matches **even at rank 1 for RL**, since RL carries only about O(1) bits per episode.
  - It falls behind when the data exceeds adapter capacity (about 2 bits per parameter) or with large batches.
  - These findings are regime-dependent rather than contradictory.

### 5. Preference optimization
- **Bradley–Terry reward model.** P(y_w ≻ y_l | x) = σ(r(x,y_w) − r(x,y_l)). Loss: −E[log σ(r_φ(x,y_w) − r_φ(x,y_l))].
- **RLHF objective.** max_π E[r_φ(x,y)] − β·KL(π(·|x) ‖ π_ref(·|x)).
  - InstructGPT adds a pretraining-mix term γ·E[log π] ("PPO-ptx"). In PPO, the per-token reward is −β·log(π/π_ref), plus r_φ at the last token.
  - PPO uses the clipped surrogate min(ρA, clip(ρ, 1±ε)A) with ε=0.2 and GAE from a critic. That means four models in memory: policy, reference, reward model and value model.
- **Why the KL term.**
  - The reward model is only accurate near its training distribution. Gold reward rises and then falls as KL grows: R_RL(d) = d(α − β·log d), with d = √KL ([Gao et al.](https://arxiv.org/abs/2210.10760)).
  - KL also preserves fluency and diversity, and has a Bayesian-posterior interpretation ([Korbak et al.](https://arxiv.org/abs/2205.11275)).
- **DPO derivation** ([2305.18290](https://arxiv.org/abs/2305.18290)):
  1. The KL-regularized optimum is π*(y|x) = π_ref(y|x)·exp(r/β)/Z(x).
  2. Invert it: r = β·log(π*/π_ref) + β·log Z(x).
  3. Substitute into Bradley–Terry; Z(x) cancels.
  4. Loss: L = −E log σ(β·log[π_θ(y_w)/π_ref(y_w)] − β·log[π_θ(y_l)/π_ref(y_l)]).
  5. Gradient: β·σ(r̂_l − r̂_w)·(∇log π(y_w) − ∇log π(y_l)), which upweights misranked pairs.
- **Role of β.** It is the strength of the anchor to π_ref; small β allows drift.
  - Llama 3: β=0.1, LR 1e-5, formatting tokens masked from the loss ([2407.21783](https://arxiv.org/abs/2407.21783)). It also adds an NLL term on chosen responses, weight 0.2 per secondary sources [uncertain].
  - Tülu 3: length-normalized DPO with β=5, LR 5e-7 (8B), 1 epoch.
- **Variants:**
  - [IPO](https://arxiv.org/abs/2310.12036): squared loss toward a finite margin 1/(2β), to avoid DPO overfitting deterministic preferences.
  - [KTO](https://arxiv.org/abs/2402.01306): unpaired good/bad labels with a prospect-theory value relative to a KL reference point.
  - [ORPO](https://arxiv.org/abs/2403.07691): reference-free, single stage, SFT loss − λ·log σ(log odds ratio).
  - [SimPO](https://arxiv.org/abs/2405.14734): reference-free reward (β/|y|)·log π plus a margin γ.
  - **[2025-26]** "Delta learning" in [Olmo 3](https://arxiv.org/abs/2512.13961): DPO with chosen responses from Qwen3-32B and rejected ones from Qwen3-0.6B. It works where SFT on the same chosen responses hurts.
- **Failure modes.**
  - Reward hacking and over-optimization (Gao et al.).
  - Length bias: a length-only reward reproduces most RLHF gains ([Singhal et al.](https://arxiv.org/abs/2310.03716)).
  - Likelihood displacement: the chosen response's probability falls and mass shifts to semantically opposite responses. Llama-3-8B-Instruct's refusal rate dropped from 74.4% to 33.4%; filtering pairs by CHES similarity score mitigates it ([ICLR'25](https://arxiv.org/abs/2410.08847)).

### 6. RL with verifiable rewards
- **GRPO** ([DeepSeekMath](https://arxiv.org/abs/2402.03300)). Sample G outputs per prompt and set Â_i = (r_i − mean(r))/std(r). No critic.
  - Objective: (1/G)Σ_i (1/|o_i|)Σ_t [min(ρ_{i,t}Â_i, clip(ρ_{i,t}, 1±ε)Â_i) − β·KL]. The KL uses the k3 estimator π_ref/π − log(π_ref/π) − 1, added to the loss.
  - Settings: G=64, β=0.04, LR 1e-6.
  - The same paper found that RL improved Maj@K but not Pass@K.
- **DeepSeek-R1** ([Nature 645, 2025](https://arxiv.org/abs/2501.12948)).
  - R1-Zero applied pure RL on V3-Base with rule-based accuracy and format rewards; no neural reward model, to avoid reward hacking. AIME pass@1 went from 15.6% to 71.0%, and 86.7% with cons@64. Weaknesses: poor readability and language mixing.
  - R1's pipeline: cold-start SFT → RL → about 800k rejection-sampled SFT examples → RL across all scenarios.
  - Distillation beat RL at small scale: R1-Distill-Qwen-32B scored 72.6 versus 47.0 for RL on Qwen-32B.
- **Fixes and variants [2025-26]:**
  - [Dr. GRPO](https://arxiv.org/abs/2503.20783): removes the 1/|o_i| term (it biases toward long wrong answers) and the std term (difficulty bias). The result equals RLOO up to scale. The paper also shows "aha" behaviour already exists in base models.
  - [DAPO](https://arxiv.org/abs/2503.14476): Clip-Higher (ε_low 0.2, ε_high 0.28), dynamic sampling (drop all-correct or all-wrong groups), token-level loss averaging, overlong shaping, and no KL. Reaches 50 on AIME with Qwen2.5-32B in 50% of R1-Zero's steps.
  - [GSPO](https://arxiv.org/abs/2507.18071): sequence-level ratio s_i = (π_θ(y|x)/π_old(y|x))^{1/|y|}, clip range about 3e-4 / 4e-4. It stabilizes MoE training without routing replay and contributed to Qwen3.
  - CISPO ([MiniMax-M1](https://arxiv.org/abs/2506.13585)): clips the stop-gradient importance weight instead of dropping token gradients.
  - [ScaleRL](https://arxiv.org/abs/2510.13786) recipe from a study of more than 400k GPU-hours: PipelineRL (8-step off-policy), CISPO, prompt-level loss averaging, batch-level advantage normalization, FP32 LM head, zero-variance filtering, no-positive-resampling. Reward follows a sigmoid in compute.
  - Train–inference mismatch between the rollout engine and the trainer is fixed with truncated importance sampling ([verl docs](https://verl.readthedocs.io/en/latest/algo/rollout_corr.html)) or with [FP16](https://arxiv.org/abs/2510.26788).
  - My synthesis: no single algorithm is "the standard." The common defaults are a group baseline, token- or prompt-level aggregation, asymmetric clipping, zero-variance filtering, little or no KL for RLVR, and async rollouts with importance-sampling correction.
- **Does RL teach reasoning or elicit it? [contested]**
  - Elicits:
    - [Yue et al., NeurIPS'25 oral](https://arxiv.org/abs/2504.13837): base models win at large-k pass@k, and RLVR stays within the base model's coverage. Distillation, by contrast, can add new patterns.
    - [Spurious rewards](https://arxiv.org/abs/2506.10947): random rewards give Qwen2.5-Math-7B +21.4 on MATH-500 versus +29.1 with true rewards, but the effect does not hold on Llama or OLMo.
  - Teaches:
    - [ProRL](https://arxiv.org/abs/2505.24864): prolonged RL with KL control and reference resets expands pass@k.
    - [Zhang, Neubig, Yue, ICML'26 spotlight](https://arxiv.org/abs/2512.07783), controlled synthetic tasks: RL adds real capability only when the task sits at the edge of the model's competence (up to +42% pass@128). Mid-training is underused.

### 7. Distillation, forgetting, merging
- **Distillation.**
  - Sequence-level: SFT on teacher outputs (R1-Distill, s1).
  - Logit-level: T²·KL(softmax(z_t/T) ‖ softmax(z_s/T)) ([Hinton](https://arxiv.org/abs/1503.02531)). Needs a shared tokenizer.
  - Reverse KL is mode-seeking ([MiniLLM](https://arxiv.org/abs/2306.08543)); on-policy distillation trains on student-generated samples ([GKD](https://arxiv.org/abs/2306.13649)).
  - **[2025-26]** [On-policy distillation](https://thinkingmachines.ai/blog/on-policy-distillation/): per-token reverse KL on the student's own samples. Reached AIME 74.4 versus 67.6 for RL, at about 1/10 of the GPU-hours.
- **Forgetting.**
  - Evidence: continual instruction tuning causes forgetting ([Luo et al.](https://arxiv.org/abs/2308.08747)). Just 10 adversarial examples (under $0.20) break GPT-3.5's safety, and benign data also degrades it ([Qi et al., ICLR'24](https://arxiv.org/abs/2310.03693)). Narrow fine-tuning on insecure code causes broad "emergent misalignment" ([Nature, Jan 2026](https://arxiv.org/abs/2502.17424)).
  - Mitigations:
    - Lower learning rate and fewer steps.
    - LoRA, which forgets less but not zero.
    - Replay or data mixing: a 70/30 document/chat mix kept IF-eval at 79% versus 45% for documents only (Thinking Machines).
    - KL regularization or on-policy RL. Per [RL's Razor](https://arxiv.org/abs/2509.04259), forgetting tracks KL to the base model on the new task, and RL finds KL-minimal solutions.
    - On-policy distillation from the old model.
    - Weight interpolation ([WiSE-FT](https://arxiv.org/abs/2109.01903)).
- **Model merging** (same base model only).
  - [Model soups](https://arxiv.org/abs/2203.05482): average fine-tunes.
  - [Task arithmetic](https://arxiv.org/abs/2212.04089): θ = θ₀ + λΣτ_i, where τ_i = θ_ft − θ₀.
  - [TIES](https://arxiv.org/abs/2306.01708): trim small updates, elect a sign, take a disjoint mean.
  - [DARE](https://arxiv.org/abs/2311.03099): drop updates with probability p and rescale by 1/(1−p).
  - Tool: [MergeKit](https://arxiv.org/abs/2403.13257).

### 8. Tooling in 2026
- [TRL](https://huggingface.co/docs/trl/sft_trainer) (v1.15): Hugging Face's reference trainers for SFT, DPO, GRPO, KTO, RLOO and more, with PEFT and vLLM integration.
- [Unsloth](https://github.com/unslothai/unsloth): fused kernels for single-GPU LoRA, QLoRA, full FT and GRPO. Claims about 2× speed and up to 70% less VRAM.
- [Axolotl](https://github.com/axolotl-ai-cloud/axolotl): YAML-configured SFT, DPO and GRPO with FSDP or DeepSpeed and multipacking.
- [torchtune](https://github.com/pytorch/torchtune): PyTorch-native recipes. **No longer actively maintained**; its README says development wound down in 2025.
- [LLaMA-Factory](https://github.com/hiyouga/LLaMA-Factory): one CLI plus a web UI covering 100+ models ([ACL'24 demo](https://arxiv.org/abs/2403.13372)).
- [verl](https://github.com/volcengine/verl): ByteDance's HybridFlow. FSDP or Megatron training with vLLM or SGLang rollouts; PPO, GRPO and DAPO; v0.8 released June 2026.
- [OpenRLHF](https://arxiv.org/abs/2501.03262): Ray + vLLM + DeepSpeed; PPO, REINFORCE++ and GRPO; async mode.
- Newer options:
  - slime: Megatron + SGLang.
  - prime-rl: async, decentralized.
  - SkyRL: agentic RL.
  - Tinker (Oct 2025): Thinking Machines' managed API, LoRA only.
