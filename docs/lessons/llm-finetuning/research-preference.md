# Preference optimization: verified references outside the other research files

Checked on 2026-10-10 for part D (`part-d-preference.md`), by reading the papers'
arXiv abstract/HTML pages, official blogs and the TRL v1.15.0 source. Each entry
gives the fact as used in the lessons and where it was found. Corrections to
the plan are marked **correction**.

## Reward models and feedback

1. **InstructGPT** ([2203.02155](https://arxiv.org/abs/2203.02155)).
   - §3.5: labelers rank "anywhere between K = 4 and K = 9" responses; all C(K,2) comparisons of one prompt are trained as a single batch element, because shuffling them overfit after one pass.
   - §3.4: inter-annotator agreement 72.6 ± 1.5% (training labelers), 77.3 ± 1.3% (held-out labelers).
   - Abstract, §4.1: outputs of the 1.3B InstructGPT model are preferred to the 175B GPT-3; the order of improvement is GPT-3 < prompted GPT-3 < SFT < PPO.
   - §3.5: the reward model is normalized with a bias so the labeler demonstrations have mean score 0 before RL; only 6B reward models are used; the value function is initialized from the RM.
   - **correction:** §3.5 says the RM starts from the SFT model with the unembedding removed; App. C.2 says the final RM was initialized from a 6B GPT-3 fine-tuned on public NLP data ("mostly for historical reasons"), with similar results either way. The lessons say "often initialised from the SFT model".
   - §3.5 Eq. 2: objective = E[r(x,y) − β log(π_RL/π_SFT)] + γ E_pretrain[log π_RL] ("PPO-ptx"; γ = 0 for plain PPO); the KL penalty is per token.
2. **Llama 2** ([2307.09288](https://arxiv.org/abs/2307.09288)), §3.2.1–3.2.2: four degrees of preference ("significantly better, better, slightly better, negligibly better/unsure"); RM loss −log σ(r_c − r_r − m(r)) with a discrete margin m(r). Llama 3 (§4.1.2) removed the margin term.
3. **RewardBench** ([2403.13787](https://arxiv.org/abs/2403.13787)), Lambert et al., 2024: a benchmark for reward models.
4. **LLM-as-a-judge** ([2306.05685](https://arxiv.org/abs/2306.05685)), Zheng et al.: position, verbosity and self-enhancement biases; mitigation: judge twice with the order swapped, count a win only if both agree (§3.4).
5. **RLAIF** ([2309.00267](https://arxiv.org/abs/2309.00267)): "RLAIF achieves comparable performance to RLHF" (summarization 71% vs 73% win rate over SFT; helpful dialogue 63% vs 64%; not significant).
6. **Constitutional AI** ([2212.08073](https://arxiv.org/abs/2212.08073)), Bai et al., 2022.
7. **Nash learning from human feedback** ([2312.00886](https://arxiv.org/abs/2312.00886)), §3.1: preference models can represent non-transitive preferences, which scalar (Bradley–Terry) reward models cannot.
8. **Chatbot Arena** ([2403.04132](https://arxiv.org/abs/2403.04132)), Eqs. 2–3: the leaderboard estimates Bradley–Terry coefficients.
9. **WARM** ([2401.12187](https://arxiv.org/abs/2401.12187)): weight-averaged reward models (used by Gemma 3, see research-adoption §6).
10. **Length bias** ([2310.03716](https://arxiv.org/abs/2310.03716)), Singhal et al., §3.2 and Table 2: a length-only reward ("LPPO") reproduces most RLHF gains: win rate 56% vs 58% for standard PPO on WebGPT, 64% vs 63% on RLCD.
11. **Bradley & Terry** (1952), Biometrika 39(3/4):324–345, [doi](https://doi.org/10.2307/2334029).

## Policy gradient, PPO, KL

12. **REINFORCE**: Williams 1992, Machine Learning 8:229–256, [doi](https://doi.org/10.1007/BF00992696).
13. **GAE** [1506.02438](https://arxiv.org/abs/1506.02438); **TRPO** [1502.05477](https://arxiv.org/abs/1502.05477); **PPO** [1707.06347](https://arxiv.org/abs/1707.06347): Eq. 7 "ε is a hyperparameter, say, ε = 0.2" (best in the MuJoCo table; the Atari runs annealed it).
14. **RLOO** ([2402.14740](https://arxiv.org/abs/2402.14740)), "Back to Basics: Revisiting REINFORCE Style Optimization for Learning from Human Feedback in LLMs": REINFORCE-style variants outperform PPO and DPO in their setting.
15. **Adaptive KL** ([1909.08593](https://arxiv.org/abs/1909.08593)), Ziegler et al., §2.2: a log-space proportional controller adjusts β to target a KL value.
16. **KL estimators**: Schulman, "Approximating KL Divergence" (2020), [blog](http://joschu.net/blog/kl-approx.html): k1 = −log r, k3 = (r − 1) − log r with r = p/q, x ~ q; k3 is unbiased and nonnegative.
17. **Best-of-n KL** ([2401.01879](https://arxiv.org/abs/2401.01879)), Beirami et al.: the common formula log n − (n−1)/n is an upper bound, not the exact KL.
18. **Reward-model over-optimization** ([2210.10760](https://arxiv.org/abs/2210.10760)), Gao, Schulman, Hilton:
    - §2.1: the "gold" reward model is the 6B RM from InstructGPT; proxy RMs (3M–3B) are trained on its labels: a synthetic setup, not humans.
    - §1: d = √KL(π‖π_init); R_bon(d) = d(α − βd), R_RL(d) = d(α − β log d).
    - §3.2: larger RMs give better gold scores.
    - §3.6: in their RL runs the KL penalty did not change the gold-score-vs-KL frontier, "akin to early stopping" (with a caveat about hyperparameters).
    - Fig. 1 is the RM-size scaling plot (gold score vs √KL); proxy and gold appear together in Figs. 4, 7, 9.
19. **KL as Bayesian inference** ([2205.11275](https://arxiv.org/abs/2205.11275)), Korbak, Perez, Buckley.

## DPO and its family

20. **DPO** ([2305.18290](https://arxiv.org/abs/2305.18290)), §4: "a naïve version of this objective without the weighting coefficient can cause the language model to degenerate" (App. Table 3); Fig. 1 is the RLHF-vs-DPO diagram.
21. **Is DPO superior to PPO?** ([2404.10719](https://arxiv.org/abs/2404.10719)), Xu et al.: "PPO is able to surpass other alignment methods in all cases" in their study.
22. **Unpacking DPO and PPO** ([2406.09279](https://arxiv.org/abs/2406.09279)), Ivison et al.: better preference data gives the largest improvements; PPO beats DPO by up to 2.5% (math) and 1.2% (general).
23. **Over-optimization in direct alignment algorithms** ([2406.02900](https://arxiv.org/abs/2406.02900)), Rafailov et al.: DAAs such as DPO show the same degradation at higher KL budgets, often before one epoch ends.
24. **Likelihood displacement** ([2410.08847](https://arxiv.org/abs/2410.08847)), Razin et al., ICLR 2025:
    - Definition 2: CHES_x(y⁺, y⁻) = ⟨Σ_k h_{x,y⁺<k}, Σ_k' h_{x,y⁻<k'}⟩ − ‖Σ_k h_{x,y⁺<k}‖², with h the hidden embedding; experiments use a length-normalized version (Definition 3).
    - §6.2: DPO on SORRY-Bench refusal pairs drops Llama-3-8B-Instruct's refusal rate from 74.4% to 33.4% (Gemma-2B-IT: 80.5% → 54.8%).
    - Fig. 3: filtering out high-CHES pairs (keeping the 5% lowest) mitigates it, better than adding an SFT term.
25. **Smaug / DPOP** ([2402.13228](https://arxiv.org/abs/2402.13228)): DPO can lower the chosen response's likelihood, especially when the edit distance between the pair is small; DPOP, Eq. 3: −log σ(β(log-ratio_w − log-ratio_l − λ·max(0, log π_ref(y_w)/π_θ(y_w)))).
26. **Iterative RPO** ([2404.19733](https://arxiv.org/abs/2404.19733)), Pang et al., Eq. 1: L_DPO + α·L_NLL on the chosen response, normalized by length.
27. **Llama 3** ([2407.21783](https://arxiv.org/abs/2407.21783)):
    - §4.1.4: DPO with learning rate 1e-5 and β = 0.1; formatting tokens masked from chosen and rejected; an NLL term "with a scaling coefficient of 0.2 on the chosen sequences".
    - "DPO required less compute for large-scale models and performed better" than PPO, especially on IFEval.
    - §4.1.6: six rounds of post-training; §4.1.2: annotators also edit the chosen response (edited > chosen > rejected).
28. **Tülu 3** ([2411.15124](https://arxiv.org/abs/2411.15124)): SFT → DPO → RLVR; preference data mixes on-policy completions (from the Tülu 3 SFT model) and off-policy ones (a pool of 22 models), rated by GPT-4o; length-normalized DPO (Eq. 6), β = 5, LR 5e-7 (8B), 1 epoch (Table 20).
29. **UltraFeedback** ([2310.01377](https://arxiv.org/abs/2310.01377)): 63,967 prompts, 4 completions each from a pool of 17 models, GPT-4 ratings on instruction-following, truthfulness, honesty, helpfulness. **Zephyr** ([2310.16944](https://arxiv.org/abs/2310.16944)): chosen = highest mean score, rejected = one of the other three at random; DPO β = 0.1, LR 5e-7.
30. **Length-controlled AlpacaEval** ([2404.04475](https://arxiv.org/abs/2404.04475)), Dubois et al.
31. **Self-rewarding LMs** ([2401.10020](https://arxiv.org/abs/2401.10020)); **Online AI feedback** ([2402.04792](https://arxiv.org/abs/2402.04792)), "Direct Language Model Alignment from Online AI Feedback".
32. **Olmo 3 delta learning** ([2512.13961](https://arxiv.org/abs/2512.13961)), §4.3, Table 21 (7B dev average): SFT checkpoint 70.3; continued SFT on the chosen responses 64.5 ("hurts"); delta-learning DPO (chosen from Qwen 3 32B, rejected from Qwen 3 0.6B) 72.9. Table 22: SFT+DPO+RLVR 74.1 vs SFT+RLVR 71.9. Related: "The Delta Learning Hypothesis" ([2507.06187](https://arxiv.org/abs/2507.06187)).

## TRL v1.15.0 (read from the installed source)

- `DPOConfig`: `beta` (default 0.1; for `loss_type=["ipo"]` it is τ), `learning_rate` (default 1e-6), `max_length` (1024), `precompute_ref_log_probs`, `loss_type` (a list: `sigmoid`, `hinge`, `ipo`, `exo_pair`, `nca_pair`, `robust`, `bco_pair`, `sppo_hard`, `aot`, `aot_unpaired`, `apo_zero`, `apo_down`, `discopop`, `sft`, `sigmoid_norm`), `loss_weights`, `label_smoothing` (for `robust` and `exo_pair`).
  - There is no `rpo_alpha`: DPO + NLL is `loss_type=["sigmoid", "sft"]` with `loss_weights=[1.0, α]`.
  - `sigmoid_norm` is length-normalized DPO; `ipo` averages log-ratios per token.
  - Logged metrics: `rewards/chosen`, `rewards/rejected`, `rewards/accuracies`, `rewards/margins`, `logps/chosen`, `logps/rejected`.
- `RewardConfig` / `RewardTrainer`: `num_labels=1` is set automatically; an optional `margin` column; `center_rewards_coefficient` (recommended 0.01).
- `KTOConfig` / `KTOTrainer` in `trl`: `desirable_weight`, `undesirable_weight` (to balance unequal numbers of good and bad examples).
- ORPO and CPO/SimPO live in `trl.experimental` (`trl.experimental.orpo`, `trl.experimental.cpo`): ORPO's `beta` is the paper's λ; SimPO is `CPOConfig(loss_type="simpo", cpo_alpha=0.0)` with `simpo_gamma` (default 0.5).
