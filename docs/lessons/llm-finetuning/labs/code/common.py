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
        bf16 = torch.cuda.is_bf16_supported()
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
