# Which LLM customization techniques are actually used (2025-2026)

Research date: 2026-10-10. Hugging Face (HF) Hub counts were read that day from Hub filter pages. These tags are added automatically by TRL, Unsloth and mergekit. They undercount (many uploads have no card) and lean toward hobbyist uploads. PyPI numbers include CI installs. Survey answers are self-reported. Evidence strength: **[S]** strong, **[M]** medium, **[W]** weak or anecdotal.

## Ranked by real-world breadth

**1. Prompting and RAG, with no weight changes.** This is the default for companies.
- The 2026 Notion x Amplify x Vercel survey (n=1,053) asked what teams use to adapt model behavior. Answers: prompting 80%, "tool-use tuning" 59%, RAG 49%, fine-tuning 26%, RL 22%, synthetic data 19% ([Notion](https://www.notion.com/lp/ai-engineering-survey)). [S]
- Menlo 2025 says prompt design dominates, then RAG. It calls fine-tuning and RL "niche", used mainly by frontier teams ([Menlo 2025](https://menlovc.com/perspective/2025-the-state-of-generative-ai-in-the-enterprise/)). Menlo 2024 reported RAG at 51% and only 9% of production models fine-tuned ([Menlo 2024](https://menlovc.com/2024-the-state-of-generative-ai-in-the-enterprise/)). [S]
- a16z (2025) says fine-tuning has become "less critical" and that enterprises see less ROI from it ([a16z](https://a16z.com/ai-enterprise-2025/)). [M]
- In May 2026 OpenAI began winding down its self-serve fine-tuning platform. Its stated reason is that newer models follow instructions well enough that prompting suffices ([Tessl](https://tessl.io/blog/openai-shutting-fine-tuning-signals-for-enterprise-ai); this is secondary reporting, and OpenAI's own page returned 403). [M-S]

**2. SFT, mostly with LoRA/QLoRA, often on synthetic or teacher-generated data.** This is the dominant fine-tuning method in every group.
- HF tag counts:
  - `trl`+`sft`: 78,127 models ([Hub](https://huggingface.co/models?other=trl,sft)).
  - `trl`+`grpo`: 14,257 ([Hub](https://huggingface.co/models?other=trl,grpo)).
  - `trl`+`dpo`: 10,532 ([Hub](https://huggingface.co/models?other=trl,dpo)).
  - `peft` library: 270,110 ([Hub](https://huggingface.co/models?library=peft)).
  - `unsloth`: 144,775 ([Hub](https://huggingface.co/models?other=unsloth)). [S]
- Model trees: [Llama-3.1-8B-Instruct](https://huggingface.co/meta-llama/Llama-3.1-8B-Instruct) has 2,951 adapters, 3,255 finetunes and 104 merges. [Qwen3-8B](https://huggingface.co/Qwen/Qwen3-8B) has 2,250 adapters, 2,163 finetunes and 38 merges. [S]
- Monthly PyPI downloads: [peft](https://pypistats.org/packages/peft) 8.3M, [trl](https://pypistats.org/packages/trl) 2.5M, [unsloth](https://pypistats.org/packages/unsloth) 0.89M. [M]
- In Amplify's 2025 survey, 41% fine-tune. SFT is the most popular approach, and LoRA/QLoRA are mentioned often ([Amplify 2025](https://amplifypartners.com/blog-posts/the-2025-ai-engineering-report)). [M]
- Every managed service defaults to SFT:
  - [Together](https://docs.together.ai/docs/fine-tuning/supervised)
  - [Vertex](https://cloud.google.com/vertex-ai/generative-ai/docs/models/gemini-preference-tuning), where tuning is adapter-based
  - Bedrock, which applies PEFT automatically ([AWS](https://aws.amazon.com/blogs/machine-learning/customize-amazon-nova-models-with-amazon-bedrock-fine-tuning))
  - [Fireworks](https://fireworks.ai/docs/fine-tuning/fine-tuning-models), which offers LoRA and qLoRA [S]
- Labs: SFT is universal, now often used as a cold start before RL or as a consolidation step ([Interconnects, Jun 2026](https://interconnects.ai/p/frontier-post-training-recipe-review)). Thinking Machines' [Tinker](https://www.thinkingmachines.ai/tinker) is LoRA-only. [S]

**3. Distillation.** Universal in labs, and largely hidden inside SFT elsewhere.
- Qwen3 trains its small models by strong-to-weak distillation, both off-policy and on-policy (logit). The report says this costs about 1/10 of the GPU hours of RL ([Qwen3](https://arxiv.org/pdf/2505.09388)).
- Gemma 3 distills from a large instruction-tuned teacher ([Gemma 3](https://arxiv.org/pdf/2503.19786)).
- The R1-Distill models were trained on about 800K R1 samples ([DeepSeek-R1 SI](https://media.springernature.com/original/springer-static/esm/art%3A10.1038%2Fs41586-025-09422-z/MediaObjects/41586_2025_9422_MOESM1_ESM.pdf)).
- In 2026, multi-teacher on-policy distillation became the defining recipe pattern, used by DeepSeek V4, Nemotron 3 Ultra and MiMo Flash v2 ([Interconnects](https://interconnects.ai/p/frontier-post-training-recipe-review)). [S] for labs.
- Bedrock sells distillation as a product ([AWS](https://docs.aws.amazon.com/bedrock/latest/userguide/custom-models.html)). [M]
- On the Hub, the explicit `distillation` tag has only 3,184 models and `gkd` has 113. Most distillation appears as SFT on synthetic data instead; 12,622 datasets are tagged `synthetic` ([Hub](https://huggingface.co/datasets?other=synthetic)). [M]

**4. RLVR with GRPO-family algorithms, and RFT services.**
- Labs: verifiable-reward RL has been the centerpiece since R1. Examples:
  - Qwen3 uses GRPO reasoning RL, then general RL with rule-based and model-based rewards.
  - OLMo 3 ends with RLVR ([OLMo 3](https://arxiv.org/pdf/2512.13961)).
  - Kimi K2 combines RLVR with a self-critique rubric reward ([K2](https://arxiv.org/html/2507.20534v2)).
  - GLM-5 has reasoning, agentic and general RL stages. [S]
- Open source: there are 24,691 `grpo` models ([Hub](https://huggingface.co/models?other=grpo)). With TRL, GRPO already outnumbers DPO (14,257 vs 10,532), although GRPO only appeared in early 2025. [S]
- Companies: RFT with graders is offered by:
  - Azure (o4-mini GA; [MS Learn](https://learn.microsoft.com/en-gb/azure/foundry/openai/how-to/fine-tuning))
  - Bedrock (Lambda or LLM-judge rewards)
  - [Fireworks](https://fireworks.ai/blog/reinforcement-fine-tuning)
  - OpenAI, before its wind-down
- Actual company uptake is modest: 22% report using "RL" ([Notion](https://www.notion.com/lp/ai-engineering-survey)), and Menlo calls RL niche. [M]

**5. DPO.** Common but declining at the frontier.
- Offered by OpenAI, [Vertex](https://cloud.google.com/vertex-ai/generative-ai/docs/models/gemini-preference-tuning) (as "preference tuning"), Azure and Together. [S]
- Labs:
  - Llama 4 runs lightweight SFT, then online RL, then a final lightweight DPO ([Meta](https://ai.meta.com/blog/llama-4-multimodal-intelligence/)).
  - OLMo 3 uses DPO on synthetic "delta learning" pairs.
  - Interconnects says DPO "starts to disappear" from leading recipes. [M]
- Variants are rare in practice: [ORPO](https://huggingface.co/models?other=orpo) has 1,279 models and [KTO](https://huggingface.co/models?other=kto) has 428, against [DPO](https://huggingface.co/models?other=dpo) at 13,519. [S]

**6. Reward signals: reward models, LLM judges and rubrics.**
- Still core in labs, mostly as judges and rubrics:
  - Gemma 3 uses weight-averaged reward models (WARM).
  - Qwen3 uses model-based rewards.
  - Kimi K2 uses a critic with rubrics.
  - Nemotron 3 Super keeps a classic RLHF stage ([Interconnects](https://interconnects.ai/p/frontier-post-training-recipe-review)). [M]
- Rare in open source: [reward-trainer](https://huggingface.co/models?other=reward-trainer) has 1,040 models. [M]

**7. Continued pretraining and mid-training.**
- Labs: mid-training is a standard stage (OLMo 3, MAI-Thinking-1). [M]
- Elsewhere:
  - Bedrock CPT supports only Titan models ([AWS](https://docs.aws.amazon.com/bedrock/latest/userguide/custom-model-fine-tuning.html)).
  - Together offers continued training ([Together](https://together.ai/blog/continued-fine-tuning)).
  - Unsloth has a CPT guide ([Unsloth](https://unsloth.ai/docs/basics/continued-pretraining)).
  - a16z cites domain adaptation as a remaining reason to fine-tune. [W-M]

**8. Model merging.** Declining in open source; niche but real in labs.
- The Hub has [45,092 `merge`](https://huggingface.co/models?other=merge) and [38,633 `mergekit`](https://huggingface.co/models?other=mergekit) models. [M]
- On new base models, merges are tiny: 38 on Qwen3-8B against 2,250 adapters. [M]
- mergekit gets about 4.7K PyPI downloads a month ([pypistats](https://pypistats.org/packages/mergekit)). [M]
- The Open LLM Leaderboard was the main driver of merging. It was retired in March 2025 ([thread](https://threadreaderapp.com/user/clefourrier)). [M]
- Labs: merging is part of Gemma 3 (WARP/WARM) and is a "core feature" of Cohere Command A ([Command A](https://arxiv.org/pdf/2504.00698)). In 2026, merging specialist models is increasingly done through distillation instead. [M]

**9. PPO.** Mostly historical.
- [`trl`+`ppo`](https://huggingface.co/models?other=trl,ppo) has 894 models, against 14,257 for GRPO. [S]
- No managed service exposes PPO. [S]
- OpenAI's Josh McGrath says the field has moved past the PPO-vs-DPO debate into the RLVR era ([summary](https://hopper.webdirections.org/share/ab61c3866a2f58f7/substack%3Apost%3A186610564)). [W-M]

## What the course list misses
1. **When not to fine-tune.** Teach prompting and context engineering as the baseline, with an explicit decision procedure. This is the most common real "customization" ([Notion](https://www.notion.com/lp/ai-engineering-survey), [Tessl](https://tessl.io/blog/openai-shutting-fine-tuning-signals-for-enterprise-ai)).
2. **Synthetic data generation and rejection sampling (best-of-n, expert iteration).**
   - Llama 3 used rejection sampling plus SFT plus DPO.
   - R1 used about 600K rejection-sampled reasoning traces.
   - 19% of teams report using synthetic data ([Notion](https://www.notion.com/lp/ai-engineering-survey)).
   - Data quality is the main lever, more than the choice of loss.
3. **On-policy and multi-teacher distillation.** This is the defining 2026 lab pattern ([Interconnects](https://interconnects.ai/p/frontier-post-training-recipe-review), [Thinking Machines/Tinker](https://tinker-docs.thinkingmachines.ai/cookbook/recipes/distillation/)). Covering only "distillation" as SFT on teacher outputs misses it.
4. **Continued pretraining and mid-training**, including the vocabulary and embedding-layer tricks.
5. **Embedding and reranker fine-tuning for RAG.**
   - The Hub has 7,994 sentence-transformers models trained with the Trainer ([Hub](https://huggingface.co/models?other=sentence-transformers,generated_from_trainer)).
   - Databricks reported gains from fine-tuning embeddings on synthetic in-domain data ([Databricks, Feb 2025](https://www.databricks.com/en/blog/improving-retrieval-and-rag-embedding-model-finetuning)).
   - Unsloth added embedding training in Jan 2026 ([Unsloth](https://unsloth.ai/docs/de/grundlagen/embedding-finetuning)).
   - This is the natural bridge between the RAG and fine-tuning parts of the course. [M]
6. **Classification-head fine-tuning of encoders.** The Hub has 43,372 text-classification models trained with the Trainer ([Hub](https://huggingface.co/models?pipeline_tag=text-classification&other=generated_from_trainer)). This is still one of the most common production fine-tunes. [M]
7. **Tool-calling, agent fine-tuning and agentic RL.**
   - Kimi K2 builds its post-training on agentic data synthesis.
   - GLM-5 and Kimi K2.5 use agentic RL.
   - The Hub has 1,168 function-calling datasets ([Hub](https://huggingface.co/datasets?other=function-calling)).
   - The survey's 59% "tool-use tuning" is ambiguous and may not mean weight training. [W]
8. **RFT as a product:** grader design, reward hacking, and LLM-judge rewards ([Bedrock](https://docs.aws.amazon.com/bedrock/latest/userguide/custom-models.html), [Azure](https://learn.microsoft.com/en-gb/azure/foundry/openai/how-to/fine-tuning)).
9. **Multimodal fine-tuning (vision, TTS)** and **QAT.**
   - [Gemma 3 QAT](https://developers.googleblog.com/gemma-3-quantized-aware-trained-state-of-the-art-ai-to-consumer-gpus/) models.
   - [Kimi K2 Thinking](https://huggingface.co/moonshotai/Kimi-K2-Thinking), with INT4 QAT applied in post-training.
   - Multi-LoRA serving, e.g. 100 adapters on one deployment at [Fireworks](https://fireworks.ai/blog/supervised-fine-tuning-tutorial).
10. **Evaluation practice.** Evals are the number-one challenge every year in the AI Engineering survey ([talk notes](https://agents.conffab.com/worlds-fair/live/day-1-keynotes/sessions/1783008000.md)).

## Overrepresented relative to real use
- **PPO with a learned value model.** Teach it as history and as the conceptual bridge to policy gradients. Spend the practice time on GRPO-family methods.
- **DPO variants.** ORPO, KTO and similar have roughly 1-10% of DPO's footprint, so one comparison slide is enough.
- **Training a separate Bradley-Terry reward model.** In practice, verifiers, rubrics and LLM judges supply most reward signal.
- **Model merging.** Worth a short lesson: Hub activity has fallen since the leaderboard was retired, and labs now often merge specialists by distillation.
- **Fine-tuning itself, relative to prompting and RAG.** Only about 26% of teams fine-tune ([Notion](https://www.notion.com/lp/ai-engineering-survey)), and only 9% of production models in Menlo 2024 were fine-tuned.

## Caveats
- The Interconnects table comes from an interview. The Qwen3 and DeepSeek-R1 stage details were partly confirmed via summaries.
- The OpenAI wind-down dates come from Tessl, not OpenAI.
- PyPI counts are inflated by CI. Hub counts reflect hobbyist activity more than enterprise activity.
