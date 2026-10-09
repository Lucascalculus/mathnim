"""L4: GRPO on GSM8K with a grader you write and test yourself (Mathnim fine-tuning course).

  python L4_grpo.py --grader-only            # step 1: adversarial tests + 50 samples for your own audit
  python L4_grpo.py --baseline               # step 2: before training, 16 samples per question -> p-hat, pass@k, predicted zero-variance share
  python L4_grpo.py --run R0                 # step 3: train (R1..R5 change one thing each, see RUNS)
  python L4_grpo.py --judge local            # optional: a small local LLM as judge, compared with the rule grader
  python L4_grpo.py --judge api              # optional: an API judge; reads JUDGE_API_KEY etc. from the environment
  LAB_SMOKE=1 python L4_grpo.py --run R0     # a quick check with a tiny model

R6 (no baseline) is grpo_minimal.py: TRL has no switch to turn the group baseline off.
Outputs: runs/L4-<run>/log.csv (TRL's metrics), runs/L4-<run>/passk.json, runs/L4-baseline.json.
"""
from __future__ import annotations

import argparse
import json
import os
import re
import time

import numpy as np
import torch

from common import (NUM, TINY_LM, device_setup, eval_gsm8k, gsm8k_chat, parse_answer, sample_n, smoke,
                    trainer_csv_callback, zero_var_est)

RUNS = {
    "R0": {},                                   # loss_type "dapo" (TRL's default), G = 8, strict grader
    "R1": {"loss_type": "grpo"},                # the original per-answer length normalisation
    "R2": {"G": 4},
    "R3": {"grader": "loose"},                  # train on the loose grader, log the strict one
    "R4": {"beta": 0.04},                       # optional: a KL penalty; adds `kl` to the log
    "R5": {"r": 1},                             # optional: LoRA rank 1
}
p = argparse.ArgumentParser()
p.add_argument("--run", choices=list(RUNS))
p.add_argument("--grader-only", action="store_true")
p.add_argument("--baseline", action="store_true")
p.add_argument("--judge", choices=["local", "api"])
p.add_argument("--model", default="Qwen/Qwen2.5-0.5B-Instruct", help="1.5B-Instruct needs --vllm or a lot of patience")
p.add_argument("--steps", type=int, default=250)
p.add_argument("--fmt", action="store_true", help="also give a small format reward (see the tutorial: it breaks the zero-variance formula)")
p.add_argument("--vllm", action="store_true", help="generate with vLLM (Linux + CUDA)")
p.add_argument("--load-4bit", action="store_true", help="QLoRA via bitsandbytes (Linux + CUDA)")
p.add_argument("--eval-q", type=int, default=200, help="questions for the before/after evaluation")
p.add_argument("--eval-n", type=int, default=16, help="samples per question (without vLLM, 8 is kinder)")
p.add_argument("--smoke", action="store_true")
args = p.parse_args()
SMOKE = args.smoke or smoke()
MODEL = TINY_LM if SMOKE else args.model
N_EVAL, N_SAMPLES, MAX_NEW = (4, 8, 16) if SMOKE else (args.eval_q, args.eval_n, 512)

# ================================================================ 1. the grader (the core of this lab)


def text_of(c) -> str:
    """Chat-format completions arrive as [{"role": "assistant", "content": ...}]; plain ones as str."""
    return c[0]["content"] if isinstance(c, list) else c


def correctness(completions, answer, **kwargs) -> list[float]:
    """Strict: exactly one <answer>number</answer>, numerically equal to the gold answer."""
    out = []
    for c, gold in zip(completions, answer):
        a = parse_answer(text_of(c))
        out.append(1.0 if a is not None and abs(a - float(gold)) < 1e-6 else 0.0)
    return out


def loose(completions, answer, **kwargs) -> list[float]:
    """The tempting shortcut: is the gold number anywhere in the text? (R3 trains on this.)"""
    return [1.0 if re.search(rf"(?<![\d.]){re.escape(str(gold))}(?![\d])", text_of(c)) else 0.0 for c, gold in zip(completions, answer)]


def fmt(completions, **kwargs) -> list[float]:
    """Optional format reward: some reasoning, then exactly one answer tag at the very end."""
    return [1.0 if re.fullmatch(r"(?s).{20,}<answer>\s*" + NUM + r"\s*</answer>\s*", text_of(c)) else 0.0 for c in completions]


def test_grader() -> None:
    cases = [  # (completion, gold, expected strict score, what it tests)
        ("... so <answer>42</answer>", "42", 1.0, "plain"),
        ("<answer>42.0</answer>", "42", 1.0, "numeric normalisation"),
        ("<answer>1,000</answer>", "1000", 1.0, "thousands separator"),
        ("<answer> -3 </answer>", "-3", 1.0, "sign and spaces"),
        ("It is 41, 42 or 43.", "42", 0.0, "several numbers listed, no tag"),
        ("<answer>41</answer> <answer>42</answer>", "42", 0.0, "two answer tags"),
        ("<answer>forty-two</answer>", "42", 0.0, "a word, not a number"),
        ("", "42", 0.0, "empty"),
        ("<answer>42</answer>", "4", 0.0, "a different number containing that digit"),
    ]
    fails = 0
    for text, gold, want, what in cases:
        got = correctness([[{"role": "assistant", "content": text}]], [gold])[0]
        flag = "ok " if got == want else "FAIL"
        fails += got != want
        print(f"  {flag} strict={got:.0f} loose={loose([text], [gold])[0]:.0f}  {what:<38} {text[:40]!r}")
    print("grader tests:", "all passed" if not fails else f"{fails} failed")
    assert not fails, "fix the grader before training on it"


test_grader()

# ================================================================ 2. helpers shared by the steps below


def load(model_id):
    from transformers import AutoModelForCausalLM, AutoTokenizer
    tok = AutoTokenizer.from_pretrained(model_id)
    m = AutoModelForCausalLM.from_pretrained(model_id, dtype="auto").to("cuda" if torch.cuda.is_available() else "cpu").eval()
    return m, tok


def evaluate(model_id_or_obj, tok, split="test", start=0, n_q=N_EVAL, n=N_SAMPLES, G=8):
    """common.eval_gsm8k, plus the share of all-same groups of G predicted from the per-question counts."""
    res = eval_gsm8k(model_id_or_obj, tok, split, n_q, n, MAX_NEW, use_vllm=args.vllm, start=start)
    res[f"predicted frac_reward_zero_std at G={G}"] = float(np.mean([zero_var_est(n, ci, G) for ci in res["c"]])) if n >= G else None
    return res

# ================================================================ 3. grader audit and the optional LLM judge


if args.grader_only or args.judge:
    model, tok = load(MODEL)
    ds = gsm8k_chat("train", 10 if SMOKE else 50)
    outs = sample_n(model, tok, ds["prompt"], 1, MAX_NEW, 1.0)
    rows = [{"question": pr[-1]["content"], "gold": g, "completion": o[0][0], "grader": correctness([[{"content": o[0][0]}]], [g])[0], "human": ""}
            for pr, g, o in zip(ds["prompt"], ds["answer"], outs)]
    os.makedirs("runs", exist_ok=True)
    import csv
    with open("runs/L4-grader-audit.csv", "w", newline="") as f:
        w = csv.DictWriter(f, fieldnames=list(rows[0]))
        w.writeheader()
        w.writerows(rows)
    print("wrote runs/L4-grader-audit.csv: fill the 'human' column with 1/0, then compute the agreement")

    if args.judge:
        RUBRIC = ("You are grading a student's answer to a math word problem. The reference final answer is {gold}. "
                  "Read the student's answer below and decide whether its FINAL answer equals the reference. "
                  "Ignore the reasoning and the format. Reply with exactly one word: YES or NO.\n\nStudent's answer:\n{answer}")
        if args.judge == "local":
            judge, jtok = (model, tok) if SMOKE else load("Qwen/Qwen2.5-1.5B-Instruct")

            def ask(prompt: str) -> str:
                ids = jtok.apply_chat_template([{"role": "user", "content": prompt}], add_generation_prompt=True, return_tensors="pt", return_dict=True).to(judge.device)
                with torch.no_grad():
                    g = judge.generate(**ids, max_new_tokens=3, do_sample=False)
                return jtok.decode(g[0, ids["input_ids"].shape[1]:], skip_special_tokens=True)
        else:
            # Any OpenAI-compatible endpoint. The key is read from the environment, never written in code:
            #   export JUDGE_API_KEY=...  JUDGE_BASE_URL=https://.../v1  JUDGE_MODEL=...
            # API calls cost money and need your own key; 50 short calls are cheap but not free.
            import urllib.request
            key, base, jm = os.environ.get("JUDGE_API_KEY"), os.environ.get("JUDGE_BASE_URL"), os.environ.get("JUDGE_MODEL")
            if not (key and base and jm):
                raise SystemExit("set JUDGE_API_KEY, JUDGE_BASE_URL and JUDGE_MODEL in the environment first")

            def ask(prompt: str) -> str:
                body = json.dumps({"model": jm, "messages": [{"role": "user", "content": prompt}], "max_tokens": 3, "temperature": 0}).encode()
                req = urllib.request.Request(base.rstrip("/") + "/chat/completions", body, {"Content-Type": "application/json", "Authorization": f"Bearer {key}"})
                with urllib.request.urlopen(req, timeout=60) as r:
                    return json.load(r)["choices"][0]["message"]["content"]
        t0 = time.time()
        verdicts = [1.0 if "YES" in ask(RUBRIC.format(gold=r["gold"], answer=r["completion"])).upper() else 0.0 for r in rows]
        agree = np.mean([v == r["grader"] for v, r in zip(verdicts, rows)])
        print(f"judge ({args.judge}) agrees with the rule grader on {agree:.0%} of {len(rows)} answers; {(time.time() - t0) / len(rows):.2f} s per answer")
        print("look at the disagreements: who is right? (fill the human column to decide)")
    raise SystemExit

# ================================================================ 4. before training: the baseline


if args.baseline:
    model, tok = load(MODEL)
    res = {"train (for P1)": evaluate(MODEL if args.vllm else model, tok, "train", 0, N_EVAL),
           "test": evaluate(MODEL if args.vllm else model, tok, "test", 0, N_EVAL)}
    os.makedirs("runs", exist_ok=True)
    json.dump(res, open("runs/L4-baseline.json", "w"), indent=1)
    for k, v in res.items():
        print(k, {a: b for a, b in v.items() if a != "c"})
    raise SystemExit

# ================================================================ 5. train
if not args.run:
    raise SystemExit("choose --grader-only, --baseline, --judge or --run R0..R5")
from peft import LoraConfig  # noqa: E402
from transformers import AutoTokenizer  # noqa: E402
from trl import GRPOConfig, GRPOTrainer  # noqa: E402

cfg = {"loss_type": "dapo", "G": 8, "grader": "strict", "beta": 0.0, "r": 16, **RUNS[args.run]}
out = f"runs/L4-{args.run}"
train = gsm8k_chat("train", 64 if SMOKE else None, 0 if SMOKE else N_EVAL)     # the first 200 train questions were used for P1
if cfg["grader"] == "loose":
    funcs, weights = [loose, correctness], [1.0, 0.0]          # weight 0: the strict grader is only logged
else:
    funcs, weights = [correctness], [1.0]
if args.fmt:
    funcs, weights = funcs + [fmt], weights + [0.2]
if SMOKE:   # a tiny random model never gets anything right; a coin-flip reward makes the gradient path run
    def smoke_coin(completions, **kw):
        return [float(torch.rand(()) < 0.5) for _ in completions]
    funcs, weights = funcs + [smoke_coin], weights + [1.0]
tok = AutoTokenizer.from_pretrained(MODEL)
targs = GRPOConfig(
    output_dir=out, num_generations=cfg["G"], per_device_train_batch_size=cfg["G"] if SMOKE else 8,
    gradient_accumulation_steps=1 if SMOKE else 2, max_completion_length=MAX_NEW, max_steps=2 if SMOKE else args.steps,
    learning_rate=5e-6, beta=cfg["beta"], loss_type=cfg["loss_type"], epsilon=0.2, epsilon_high=0.28,
    scale_rewards="group", mask_truncated_completions=not SMOKE,   # (smoke answers are all cut at 16 tokens)
    temperature=1.0, reward_weights=weights,
    logging_steps=1 if SMOKE else 5, save_strategy="no", report_to="none", log_completions=False,
    use_vllm=args.vllm, vllm_mode="colocate", **device_setup(),
)
extra = {}
if args.load_4bit:
    from transformers import BitsAndBytesConfig
    extra["quantization_config"] = BitsAndBytesConfig(load_in_4bit=True, bnb_4bit_quant_type="nf4", bnb_4bit_compute_dtype=torch.float16)
trainer = GRPOTrainer(
    model=MODEL, reward_funcs=funcs, args=targs, train_dataset=train, processing_class=tok,
    peft_config=LoraConfig(r=cfg["r"], lora_alpha=32, target_modules="all-linear", task_type="CAUSAL_LM"),
    callbacks=[trainer_csv_callback(f"{out}/log.csv")], **extra,
)
trainer.train()

# ================================================================ 6. after training: the same evaluation as step 4
model = trainer.model.merge_and_unload().eval()
if args.vllm:
    model.save_pretrained(f"{out}/merged")
    tok.save_pretrained(f"{out}/merged")
res = {"run": args.run, **cfg, "test": evaluate(f"{out}/merged" if args.vllm else model, tok, "test", 0, N_EVAL)}
json.dump(res, open(f"{out}/passk.json", "w"), indent=1)
print(json.dumps({k: v for k, v in res["test"].items() if k != "c"}, indent=1))
