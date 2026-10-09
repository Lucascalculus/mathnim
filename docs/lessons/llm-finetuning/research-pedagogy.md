# How the best material teaches LLM fine-tuning and post-training (research report, 2026-10-10)

Each claim below has a source link. Items marked **[unverified]** come from my memory or from secondary or mirror sources and were not checked against the original this session. Items marked **[contested]** are open debates.

## 1. Curricula: topics, order and depth

Most sources teach the same sequence:
1. Base model vs. assistant
2. SFT: chat template, loss masking, data quality
3. PEFT: LoRA/QLoRA, framed through memory
4. Preference data and a Bradley-Terry reward model
5. Policy-gradient RL with a KL penalty (REINFORCE, then PPO)
6. DPO, presented as a closed-form shortcut
7. RLVR/GRPO for reasoning
8. Over-optimization, forgetting and evaluation

**Stanford courses**
- **CS336 (2025 and 2026 editions):** post-training is only the last 3 of 19 lectures, after systems, scaling and data ([2025](http://cs336.stanford.edu/spring2025/), [2026](http://cs336.stanford.edu/)).
  - Assignment 5 is "Alignment and Reasoning RL", built from scratch on Qwen2.5-Math-1.5B / MATH. It runs a zero-shot baseline, then SFT on R1 traces, then expert iteration, then GRPO. DPO and safety are an optional Part 2 ([repo](https://github.com/stanford-cs336/assignment5-alignment); handout details from a [mirror, unverified](https://gitcode.csdn.net/69c88c810a2f6a37c59b453d.html)).
- **CS224N (Winter 2026, Diyi Yang):**
  - The post-training lecture runs: instruction fine-tuning (15 min) → RLHF (20 min: REINFORCE via the log-derivative trick, PPO clipping, Bradley-Terry reward model, KL-penalized reward) → InstructGPT → limitations → DPO derivation (25 min) → human vs. AI feedback ([slides](https://web.stanford.edu/class/cs224n/slides_w26/cs224n-2026-lecture08-posttraining.pdf)).
  - The next lecture runs: prompting → PEFT → pruning → LoRA → QLoRA → prompt tuning/adapters. It already includes the rank-1-LoRA-for-RL figure from Thinking Machines ([slides](https://web.stanford.edu/class/cs224n/slides_w26/cs224n-2026-lecture09-peft.pdf)).

**Karpathy**
- Zero to Hero stops at pretraining.
- Post-training is explained conceptually in "State of GPT" (2023; [notes](https://lawrencewu.net/posts/2023-06-13-karpathy-state-of-gpt/)) and "Deep Dive into LLMs" (2025).
- It is taught in code in [nanochat](https://github.com/karpathy/nanochat) (Oct 2025): pretrain → midtrain (SmolTalk, MMLU, GSM8K) → SFT → optional RL on GSM8K. The RL step is a simplified GRPO/REINFORCE with no KL penalty ([unofficial docs](https://www.mintlify.com/karpathy/nanochat/training/reinforcement-learning)).

**Hugging Face**
- LLM course chapter 11 covers chat templates → SFT → LoRA → evaluation ([ch11](https://huggingface.co/learn/llm-course/chapter11/1)).
- Chapter 12 covers the R1 paper → GRPO in TRL → Unsloth GRPO on GSM8K with 4-bit + LoRA on a free T4 ([ch12](https://huggingface.co/learn/llm-course/en/chapter12/1)).
- It is recipe-heavy. The LoRA page has no analogy and no architecture diagram ([ch11/4](https://huggingface.co/learn/llm-course/chapter11/4)).

**Raschka**
- *Build an LLM From Scratch*: ch6 classification fine-tuning (spam, swap the head) → ch7 instruction fine-tuning (prompt formats, masking, evaluation) → Appendix E LoRA from scratch → DPO bonus notebook ([repo](https://github.com/rasbt/LLMs-from-scratch)).
- *Build a Reasoning Model (From Scratch)* (Manning 2025): evaluation/verifiers → inference-time scaling → RL with GRPO → GRPO improvements → distillation ([repo](https://github.com/rasbt/reasoning-from-scratch)).

**Lambert, RLHF book**
- Free online, Manning print 2026, with a companion lecture course ([site](https://rlhfbook.com/), [TOC](https://rlhfbook.com/llms.txt)).
- 17 chapters: IFT → reward modeling → RL (REINFORCE/RLOO/PPO/GRPO) → reasoning → DPO-family → rejection sampling → preferences/data/synthetic → tool use → over-optimization → regularization → evaluation → character.
- The lectures frame IFT → reward model → rejection sampling as "format → signal → optimization" ([lecture 2](https://rlhfbook.com/teach/course/lec2-chap4-5-9/)).

**Labonne LLM course**
- SFT (full/LoRA/QLoRA, hyperparameters, monitoring) → preference alignment (rejection sampling → DPO → reward model → GRPO/PPO) ([README](https://github.com/mlabonne/llm-course)).
- It gives heuristics: DPO is "great for creating chat models", RL is "ideal for creating reasoning models".

**Huyen, AI Engineering ch.7**
- An engineering framing: fine-tune as a last resort (prompting → ~50 examples → RAG → fine-tuning), "fine-tuning is for form, RAG is for facts", memory bottlenecks, quantization, PEFT, model merging ([O'Reilly](https://oreilly.com/library/view/ai-engineering/9781098166298/ch07.html), [notes](https://alexstrick.com/posts/2025-01-26-notes-on-ai-engineering-chip-huyen-chapter-7-finetuning.html)).
- Little math.

**Weng**
- No end-to-end fine-tuning tutorial. Her relevant deep dives are [Reward Hacking (2024)](https://lilianweng.github.io/posts/2024-11-28-reward-hacking/) and "Why We Think" (2025, on [lilianweng.github.io](https://lilianweng.github.io/)).

**DeepLearning.AI**
- [Post-training of LLMs](https://www.deeplearning.ai/short-courses/post-training-of-llms) (Banghua Zhu, 2025): SFT (base → instruct lab) → DPO (change the assistant's identity) → online RL (GRPO with a verifiable math reward), plus a graded quiz.
- [Intro to Post-Training](https://www.deeplearning.ai/courses/fine-tuning-and-reinforcement-learning-for-llms-intro-to-post-training) (Sharon Zhou/AMD): 5 modules, including "Evaluation as the North Star" and detecting reward hacking.

**Newer (2025–26) references that have become standard**
- Lambert's book.
- Thinking Machines' [LoRA Without Regret](https://thinkingmachines.ai/blog/lora/) (Sept 2025), already used in CS224N.
- HF's [Smol Training Playbook](https://huggingfacetb-smol-playbook-toc.static.hf.space/) (Oct 2025), which runs SFT-first → preference optimization → RLVR.
- nanochat, Karpathy's Deep Dive, Raschka's reasoning book.
- [Unsloth docs](https://docs.unsloth.ai/get-started/beginner-start-here/lora-hyperparameters-guide) as the de facto practitioner reference. Note they are written by a vendor.

## 2. Explanations that work

**Base model vs. SFT**
- "Base models complete documents": ask for a poem and you get more questions ([State of GPT notes](https://lawrencewu.net/posts/2023-06-13-karpathy-state-of-gpt/)). CS224N puts it as "Language modeling ≠ assisting users".
- Karpathy's textbook analogy: exposition = pretraining, worked examples = SFT, practice problems with only the final answer = RL ([coverage](https://officechai.com/ai/andrej-karpathy-explains-different-parts-of-training-an-llm-through-the-example-of-a-textbook/)).
- [URIAL](https://arxiv.org/abs/2312.01552) shows base and chat models share the top token at most positions. The shifts concentrate in stylistic tokens and early positions. This is a very visualizable "alignment is mostly style" fact.

**Chat templates and loss masking**
- Lambert renders role-tagged messages to special-token text. Prompt tokens are masked "so the model isn't learning to accurately predict user queries". Multi-turn data can train on the final turn only or on all assistant turns ([ch4](https://rlhfbook.com/c/04-instruction-tuning)).
- **[contested]** [Shi et al. 2024](https://arxiv.org/abs/2405.14394) find that loss over instructions helps when instructions are long, outputs are short, or data is small. That variant had higher train loss but lower test loss. Raschka turned masking into a reader exercise ([post](https://magazine.sebastianraschka.com/p/llm-research-insights-instruction)).

**LoRA**
- The standard explanation: ΔW = BA with r ≪ d, motivated by low intrinsic rank, and it can be merged so there is zero added latency (CS224N PEFT slides).
- The best new intuition, from [LoRA Without Regret](https://thinkingmachines.ai/blog/lora/), is capacity vs. information:
  - SFT learns from every token, while policy-gradient RL gets roughly 1 bit per episode, so rank 1 suffices for RL.
  - LoRA matches full fine-tuning when it is not capacity-bound and is applied to MLP layers. Attention-only LoRA underperforms.
  - The optimal learning rate is about 10× the full fine-tuning rate.
  - With the 1/r scaling, early learning curves are identical across ranks.
- [Biderman et al.](https://arxiv.org/abs/2405.09673): full fine-tuning learns updates of 10–100× higher rank than typical LoRA configs, and "LoRA learns less and forgets less".

**QLoRA**
- A frozen 4-bit NF4 base model plus higher-precision adapters plus paged optimizers ([QLoRA](https://arxiv.org/abs/2305.14314)).
- Huyen teaches memory as params × precision, plus gradients and optimizer state for the trainable parameters.

**Reward models**
- Use pairwise comparisons because absolute ratings are noisy and miscalibrated. The Bradley-Terry loss is −log σ(r_w − r_l). CS224N adds "Make sure your reward model works first" (check held-out accuracy).

**RLHF / PPO with KL**
- CS224N: "we reinforce good actions"; the KL-penalized reward means you "Pay a price when p_RL > p_PT".
- Lambert ([ch15](https://rlhfbook.com/c/15-regularization)):
  - Reverse KL heavily penalizes putting mass where the reference model assigns low probability.
  - Over-optimization shows up as repetition, language switching and nonsense.
- The canonical figure is from Gao et al.: proxy reward keeps rising while gold reward peaks and then falls as KL grows ([arXiv](https://arxiv.org/abs/2210.10760), **[unverified]**).
- Karpathy's Go analogy: the reward model is a rater's "vibe check" that RL learns to exploit ([coverage](https://the-decoder.com/ai-researcher-says-that-chatgpts-secret-ingredient-may-be-holding-back-llm-capabilities/)).

**DPO**
- CS224N derivation: the optimal policy is ∝ p_ref·exp(r/β), so r = β·log(π/π_ref) + β·log Z. Z cancels inside Bradley-Terry, leaving a loss on log-ratio margins ([DPO](https://arxiv.org/abs/2305.18290)).
- [Smaug](https://arxiv.org/abs/2402.13228) gives the key "aha": the loss sees only the gap, so the chosen likelihood can fall too. This is worst when the chosen and rejected answers are near-identical.

**GRPO / RLVR**
- A group of samples per prompt supplies the baseline, so no critic is needed. Advantage = (r − mean)/std ([DeepSeekMath](https://arxiv.org/abs/2402.03300)).
- [Dr. GRPO](https://arxiv.org/abs/2503.20783):
  - Length and std normalization bias the updates.
  - Growing response length does not by itself mean better reasoning.
  - "Aha"/"wait" tokens already appear in the base model.

**Forgetting**
- [RL's Razor](https://arxiv.org/abs/2509.04259): forgetting is predicted by KL(fine-tuned ‖ base) measured on the new task. On-policy RL picks KL-minimal solutions; SFT can drift arbitrarily far.
- [Chu et al.](https://arxiv.org/abs/2501.17161): "SFT memorizes, RL generalizes", but SFT is still needed to stabilize output format.

**Interactive explainers and what made them work**
- **[Transformer Explainer](https://arxiv.org/abs/2408.04619):** a live GPT-2 in the browser, custom input, a temperature slider, and multi-level abstraction. In a 90-person CHI 2026 study it beat a blog and a video on understanding.
- **[Bycroft's LLM viz](https://github.com/bbycroft/llm-viz):** a tiny real model (~85k parameters, sorting "ABC") so every number can be inspected. Guided steps highlight the active part and hover shows formulas.
- **[Distill, "Communicating with Interactive Articles"](https://distill.pub/2020/communicating-with-interactive-articles/):** what works is playable systems, prediction prompts, segmenting and details-on-demand. It also warns that interactivity can distract and that empirical evidence is limited.
- **[Kim et al., CHI 2017](https://idl.uw.edu/papers/explaining-the-gap):** predicting and then self-explaining before seeing the data improved recall and comprehension.
- **Gap:** I found no well-known, evaluated interactive explainer for LoRA, KL/RLHF, DPO or GRPO. Only toys exist: a [LoRA parameter counter](https://veda.ng/glossary/lora) and a [β "KL leash" demo](https://dev.to/dev48v/rlhf-from-scratch-sft-a-reward-model-and-ppo-on-a-kl-leash-8hp). One interactive post-training course exists but is unverified ([link](https://learn-ml-visualized-interactive.onrender.com/chapter/instruction-tuning-and-sft)).

## 3. Learner confusions and misconceptions (most-evidenced first)

1. **"Fine-tuning adds new knowledge."**
   - Evidence against:
     - Unknown facts are learned slowly, and hallucination rises linearly as they are learned ([Gekhman, EMNLP 2024](https://aclanthology.org/2024.emnlp-main.444)).
     - Knowledge is extractable only if it was augmented (e.g. paraphrased) during pretraining. Instruction fine-tuning doesn't rescue it ([Physics of LMs 3.1](https://arxiv.org/abs/2309.14316)).
     - RAG beats unsupervised fine-tuning for knowledge injection ([Ovadia et al.](https://arxiv.org/abs/2312.05934), **[unverified]**).
   - **[contested]** Unsloth calls "fine-tuning can't add knowledge" a myth ([FAQ](https://unsloth.ai/docs/get-started/fine-tuning-for-beginners/faq-+-is-fine-tuning-right-for-me); vendor source).
   - Best framing to teach: it is possible, but needs diverse repetition and risks hallucination.
2. **"Lower loss means a better model."**
   - Students diagnose overfitting from training loss alone ([Students Overfit to Overfitting](https://arxiv.org/abs/2209.03032)).
   - A forum user saw "loss decreases… it has learned nothing" because loss was being computed on the prompt ([HF forum](https://discuss.huggingface.co/t/sfttrainer-work-but-without-result/169118)).
   - DPO loss can fall while the chosen log-probability falls (Smaug).
   - The CS336 handout says validation pg_loss is not meaningful: track reward instead (mirror).
   - In RLHF, proxy reward rises while true quality falls.
3. **Silent masking, template and EOS bugs.**
   - TRL computes full-sequence loss by default for plain language-modeling datasets ([TRL docs](https://huggingface.co/docs/trl/main/en/sft_trainer)).
   - Template-matching collators silently drop examples.
   - Setting pad = EOS can mean the model never learns to stop.
   - Training and inference terminators can mismatch ([Mistral docs](https://docs.mistral.ai/cookbooks/concept-deep-dive-tokenization-basics)).
4. **Rank/alpha folklore.**
   - The advice conflicts: α = 2r (Raschka; the HF course, whose own example uses r=6, α=8), α = r or 2r ([Unsloth](https://docs.unsloth.ai/get-started/beginner-start-here/lora-hyperparameters-guide)), rsLoRA's α/√r.
   - Thinking Machines shows rank barely changes early dynamics; the learning rate dominates.
5. **"LoRA is a smaller or faster model."**
   - A merged LoRA model has the base model's size and speed. Unmerged adapters add latency ([Fireworks](https://docs.fireworks.ai/guides/understanding_lora_performance)).
   - The savings are training memory: gradients and optimizer state. QLoRA's savings shrink at larger batch sizes because activations dominate ([NeMo](https://docs.nvidia.com/nemo-framework/user-guide/24.09/sft_peft/qlora.html)).
   - The evidence that learners hold this belief is indirect: docs that rebut it, not surveys.
6. **DPO confusions.**
   - "No reward model, so no KL or reference model": in fact DPO optimizes the same KL-regularized objective, β is the KL strength, and the reference model defines the implicit reward.
   - "DPO raises p(chosen)": not necessarily (likelihood displacement).
7. **What the KL term is for.**
   - Users are puzzled by negative KL readings, which come from top-k/top-p sampling ([HF forum](https://discuss.huggingface.co/t/negative-kl-values-during-ppo-training-trl-library/84143)).
   - **[contested]** Whether KL is needed in RLVR at all: nanochat drops it, while [ProRL](https://arxiv.org/abs/2505.24864) relies on KL plus reference resets.
8. **SFT vs. RL.**
   - **[contested]** "RL creates new reasoning": base models win at large pass@k ([Yue et al., NeurIPS 2025](https://arxiv.org/abs/2504.13837)) vs. ProRL's counter-evidence. Separately, Karpathy calls RLHF "barely RL".
9. **When to fine-tune vs. prompt vs. RAG.** Huyen's ladder ("form vs. facts") is the most-cited heuristic. It is a heuristic, not a law.

## 4. How courses check real understanding

- **CS336 A5 is the strongest model** (from the mirror; verify against the official handout):
  - Students implement unit-tested pieces: tokenization with a response mask, masked_normalize, group-normalized rewards, GRPO-clip.
  - Then they must explain behavior:
    - Classify at least 10 failures as model vs. parser errors.
    - Run an SFT data-size sweep and compare filtered vs. unfiltered data.
    - Compare entropy across SFT, expert iteration and GRPO.
    - Ablate the baseline, std normalization, clipping and the prompt.
    - Argue length normalization's trade-offs *before* running it.
    - Explain why train and eval curves disagree.
  - It ends with a compute-capped leaderboard (2×H100, 4h).
- **CS224N:** in-lecture "Can you see any problems with this objective?" prompts, plus a final project.
- **Raschka:** exercises that change one variable and compare (masking on/off, prompt style, LoRA), plus about 30 quiz questions per chapter ([hub](https://sebastianraschka.com/llms-from-scratch/)).
- **HF course and DeepLearning.AI:** multiple-choice quizzes plus code quizzes or labs ([HF ch11/7](https://huggingface.co/learn/llm-course/chapter11/7)). Mostly recall and recipe-following.
- **Evidence-backed formats:** predict → observe → self-explain (Kim et al.), and testing with feedback (Distill article). Transformer Explainer measured understanding by quiz against blog and video conditions.
- **Transfer items these sources suggest (my synthesis):**
  - Diagnose a model from its curves: train/val loss, chosen/rejected log-probs, reward vs. KL.
  - Predict the effect of β, rank or learning rate before running.
  - Pick fine-tuning vs. RAG vs. prompting for a scenario.
  - Debug a mis-masked batch.
  - Explain why GRPO response length grows.

**Main uncertainties:**
- The CS336 handout details come from a mirror.
- The Gao, Ovadia and TensorFlow Playground claims were not re-fetched; TF Playground isn't analyzed above.
- Several confusion claims rest on forum and vendor posts rather than systematic learner studies. I found no rigorous study of misconceptions specific to LLM fine-tuning.
