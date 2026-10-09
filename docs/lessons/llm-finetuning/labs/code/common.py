"""Shared helpers for the fine-tuning labs L1-L5 (Mathnim course, part E).

Every lab script imports this file, so keep it next to them (or upload it to
Colab with them). Nothing here needs a GPU.
"""
from __future__ import annotations

import csv
import math
import os
import re
import string
from collections import Counter

import torch

# ---------------------------------------------------------------- hardware

def device_setup() -> dict:
    """Mixed-precision flags that work on the GPU you have.

    T4 (compute capability 7.5) has no bf16: use fp16. Ampere and newer (L4, A100): bf16.
    On a Mac or CPU: neither (the smoke tests run here).
    """
    if torch.cuda.is_available():
        # not torch.cuda.is_bf16_supported(): it also says True on a T4, where bf16 is only emulated
        bf16 = torch.cuda.get_device_capability()[0] >= 8
        return {"bf16": bf16, "fp16": not bf16}
    return {"bf16": False, "fp16": False, "use_cpu": True}


def smoke() -> bool:
    """True when the scripts run as a quick check (tiny models, a few steps): env LAB_SMOKE=1 or --smoke."""
    return os.environ.get("LAB_SMOKE") == "1"


TINY_LM = "trl-internal-testing/tiny-Qwen2ForCausalLM-2.5"  # a random 2-layer Qwen2.5-shaped model, for smoke tests only

# ---------------------------------------------------------------- GSM8K answers

NUM = r"-?\d[\d,]*\.?\d*"


def gold_of(gsm8k_answer: str) -> str:
    """GSM8K stores the solution, then '#### 72'. Return '72'."""
    return gsm8k_answer.split("####")[-1].strip().replace(",", "")


def parse_answer(text: str) -> float | None:
    """The grader of L4/L5: exactly one <answer> tag holding a number; None otherwise."""
    tags = re.findall(r"<answer>\s*(" + NUM + r")\s*</answer>", text)
    if len(tags) != 1:
        return None
    try:
        return float(tags[0].replace(",", ""))
    except ValueError:
        return None


def parse_hashes(text: str) -> float | None:
    """L2's format: the last '#### n' line."""
    m = re.findall(r"####\s*(" + NUM + r")", text)
    if not m:
        return None
    try:
        return float(m[-1].replace(",", "").rstrip("."))
    except ValueError:
        return None


def same_number(a: float | None, gold: str) -> bool:
    return a is not None and abs(a - float(gold)) < 1e-6

# ---------------------------------------------------------------- GSM8K as chat prompts (L4, L5)

SYSTEM = ("Solve the math problem. Reason step by step, then give only the final number "
          "inside <answer></answer>, for example <answer>42</answer>.")


def gsm8k_chat(split: str, n: int | None = None, start: int = 0):
    """GSM8K with a chat prompt and the gold number in column `answer` (TRL passes it to reward functions)."""
    from datasets import load_dataset
    ds = load_dataset("openai/gsm8k", "main", split=split)
    ds = ds.select(range(start, min(len(ds), start + n))) if n else ds
    return ds.map(lambda ex: {"prompt": [{"role": "system", "content": SYSTEM}, {"role": "user", "content": ex["question"]}],
                              "answer": gold_of(ex["answer"])}, remove_columns=["question"])


def sample_n(model, tok, prompts, n: int, max_new_tokens: int, temperature: float = 1.0, use_vllm: bool = False):
    """n sampled answers per chat prompt. Returns, per prompt, a list of (text, truncated).

    `model` is a loaded transformers model, or (with use_vllm) a model path / Hub id.
    "truncated" means the answer hit max_new_tokens without an end token.
    """
    if use_vllm:
        from vllm import LLM, SamplingParams
        llm = LLM(model=model, gpu_memory_utilization=0.85, max_model_len=max_new_tokens + 512)
        outs = llm.chat(prompts, SamplingParams(n=n, temperature=temperature, max_tokens=max_new_tokens))
        return [[(c.text, c.finish_reason == "length") for c in o.outputs] for o in outs]
    stops = [i for i in {tok.eos_token_id, tok.convert_tokens_to_ids("<|im_end|>")} if isinstance(i, int) and i >= 0]
    res = []
    for p in prompts:
        ids = tok.apply_chat_template(p, add_generation_prompt=True, return_tensors="pt", return_dict=True).to(model.device)
        with torch.no_grad():
            g = model.generate(**ids, do_sample=temperature > 0, temperature=temperature if temperature > 0 else None,
                               top_p=1.0, top_k=0, repetition_penalty=1.0, max_new_tokens=max_new_tokens, num_return_sequences=n,
                               eos_token_id=stops, pad_token_id=tok.pad_token_id if tok.pad_token_id is not None else stops[0])
        new = g[:, ids["input_ids"].shape[1]:]
        res.append([(tok.decode(row, skip_special_tokens=True), not any(int(t) in stops for t in row)) for row in new])
    return res


def eval_gsm8k(model, tok, split: str = "test", n_q: int = 200, n: int = 16, max_new_tokens: int = 512,
               use_vllm: bool = False, start: int = 0, grade=None) -> dict:
    """n samples per question at temperature 1 -> pass@k, coverage, length, truncation; `c` = right answers per question."""
    import time
    import numpy as np
    grade = grade or (lambda text, gold: (a := parse_answer(text)) is not None and abs(a - float(gold)) < 1e-6)
    ds = gsm8k_chat(split, n_q, start)
    t0 = time.time()
    outs = sample_n(model, tok, ds["prompt"], n, max_new_tokens, 1.0, use_vllm=use_vllm)
    secs = time.time() - t0
    c = [sum(bool(grade(t, g)) for t, _ in o) for o, g in zip(outs, ds["answer"])]
    lens = [len(tok(t, add_special_tokens=False)["input_ids"]) for o in outs for t, _ in o]
    return {
        "questions": len(c), "samples": n, "max_new_tokens": max_new_tokens, "seconds": round(secs, 1),
        "pass@k": {k: float(np.mean([pass_at_k(n, ci, k) for ci in c])) for k in (1, 2, 4, 8, 16, 32) if k <= n},
        "coverage (solved at least once)": float(np.mean([ci > 0 for ci in c])),
        "mean_len_tokens": float(np.mean(lens)), "truncated": float(np.mean([tr for o in outs for _, tr in o])),
        "c": c,
    }


def zero_var_est(n: int, c: int, G: int) -> float:
    """Unbiased estimate, from n samples with c right, of P(a group of G is all right or all wrong).

    The same counting trick as pass@k: choose G of the n samples without replacement.
    Its expectation is p^G + (1 - p)^G, the formula of E1.
    """
    if n < G:
        raise ValueError("need n >= G samples")
    return (math.comb(c, G) + math.comb(n - c, G)) / math.comb(n, G)

# ---------------------------------------------------------------- pass@k

def pass_at_k(n: int, c: int, k: int) -> float:
    """Unbiased pass@k from n samples with c correct (Chen et al. 2021): 1 - C(n-c, k) / C(n, k)."""
    if n - c < k:
        return 1.0
    return 1.0 - math.comb(n - c, k) / math.comb(n, k)

# ---------------------------------------------------------------- text answers (L1)

def normalize(s: str) -> str:
    """SQuAD-style normalisation: lower case, no punctuation, no articles, single spaces."""
    s = s.lower()
    s = "".join(ch for ch in s if ch not in set(string.punctuation))
    s = re.sub(r"\b(a|an|the)\b", " ", s)
    return " ".join(s.split())


def contains_answer(pred: str, golds: list[str]) -> bool:
    p = normalize(pred)
    return any(normalize(g) and normalize(g) in p for g in golds)

# ---------------------------------------------------------------- logging

class CSVLog:
    """Append dict rows to a CSV file (columns fixed by the first row)."""

    def __init__(self, path: str):
        self.path, self.cols = path, None

    def write(self, row: dict) -> None:
        new = not os.path.exists(self.path)
        if self.cols is None:
            self.cols = list(row)
        with open(self.path, "a", newline="") as f:
            w = csv.DictWriter(f, fieldnames=self.cols, extrasaction="ignore")
            if new:
                w.writeheader()
            w.writerow(row)


def trainer_csv_callback(path: str):
    """A transformers TrainerCallback that writes every log line (TRL's metrics included) to CSV."""
    from transformers import TrainerCallback

    class _CB(TrainerCallback):
        def __init__(self):
            self.rows: list[dict] = []

        def on_log(self, args, state, control, logs=None, **kw):
            if logs:
                row = {"step": state.global_step, **{k: v for k, v in logs.items() if isinstance(v, (int, float))}}
                self.rows.append(row)
                keys = sorted({k for r in self.rows for k in r})
                with open(path, "w", newline="") as f:
                    w = csv.DictWriter(f, fieldnames=["step"] + [k for k in keys if k != "step"])
                    w.writeheader()
                    w.writerows(self.rows)

    return _CB()


def counter_top(xs, n=5):
    return Counter(xs).most_common(n)
