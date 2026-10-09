"""Run a lab script on a Mac for a smoke test (part E build tooling, not part of the labs).

  LAB_SMOKE=1 python mac_smoke.py ../../../../../docs/lessons/llm-finetuning/labs/code/L2_sft_lora.py --run R0

TRL 1.15 computes per-token log-probs with a Triton kernel (trl/kernels), and Triton
ships with PyTorch on Linux only, so every TRL trainer fails on macOS with
"'NoneType' object has no attribute 'apply'". The labs target Colab (Linux + CUDA),
where the kernel exists. For the smoke test only, this file swaps in a plain-PyTorch
function with the same interface, then runs the lab script unchanged.
What this does NOT test: the Triton kernel itself, CUDA, fp16/bf16, vLLM, Unsloth.
"""
from __future__ import annotations

import os
import runpy
import sys

os.environ.setdefault("OMP_NUM_THREADS", "1")   # faiss + torch: two OpenMP runtimes deadlock on macOS
import torch  # noqa: E402
import trl.trainer.utils as U  # noqa: E402


class TorchLogProb:
    """Same call as trl.kernels.ChunkedLogProbFunction.apply, computed with full logits."""

    @staticmethod
    def apply(hidden, weight, bias, targets, temperature, chunk_size, softcap=None, logit_scale=1.0, outputs=()):
        logits = hidden @ weight.T
        if bias is not None:
            logits = logits + bias
        logits = logits * logit_scale
        if softcap:
            logits = softcap * torch.tanh(logits / softcap)
        logits = logits.float() / temperature
        lsm = torch.log_softmax(logits, -1)
        lp = lsm.gather(-1, targets[:, None]).squeeze(-1)
        ent = -(lsm.exp() * lsm).sum(-1).detach() if "entropy" in outputs else None
        lss = torch.logsumexp(2 * lsm, -1).detach() if "log_sum_sq_probs" in outputs else None
        ml = logits.mean(-1).detach() if "mean_logits" in outputs else None
        top1 = (logits.argmax(-1) == targets) if "is_top1" in outputs else None
        return lp, ent, lss, ml, top1


if U._ChunkedLogProbFunction is None:
    U._ChunkedLogProbFunction = TorchLogProb

script = os.path.abspath(sys.argv[1])
sys.argv = sys.argv[1:]
sys.path.insert(0, os.path.dirname(script))
os.chdir(os.path.dirname(script))
runpy.run_path(script, run_name="__main__")
