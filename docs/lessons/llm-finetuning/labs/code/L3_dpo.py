"""L3: DPO, watching the likelihood shift (Mathnim fine-tuning course).

  python L3_dpo.py --run R0       # beta = 0.1 on all pairs
  python L3_dpo.py --run R1       # R1..R5: one change each (see RUNS)
  LAB_SMOKE=1 python L3_dpo.py --run R0   # a quick check with a tiny model and a tiny dataset

After training it measures, for every held-out pair, how far log p(chosen) and
log p(rejected) moved from the reference (the same LoRA model with the adapter
switched off), then groups the moves by how similar the two answers are and by
their length ratio. Output: runs/<run>/log.csv, runs/<run>/pairs.csv, runs/<run>/summary.json.
"""
from __future__ import annotations

import os
import sys

if sys.platform == "darwin":   # see L1: two OpenMP runtimes can deadlock on macOS
    os.environ.setdefault("OMP_NUM_THREADS", "1")

import argparse
import json

import numpy as np
import torch
from datasets import load_dataset
from peft import LoraConfig
from sentence_transformers import SentenceTransformer
from transformers import AutoTokenizer
from trl import DPOConfig, DPOTrainer

from common import TINY_LM, CSVLog, device_setup, smoke, trainer_csv_callback

RUNS = {
    "R0": {},                                                   # beta 0.1, all pairs
    "R1": {"beta": 0.01},
    "R2": {"beta": 0.5},
    "R3": {"subset": "similar"},                                # the 20% most similar pairs
    "R4": {"subset": "different"},                              # the 20% least similar pairs
    "R5": {"loss_type": ["sigmoid", "sft"], "loss_weights": [1.0, 0.2]},   # + NLL on chosen
}
p = argparse.ArgumentParser()
p.add_argument("--run", default="R0", choices=list(RUNS))
p.add_argument("--train", type=int, default=5000)
p.add_argument("--eval", type=int, default=500)
p.add_argument("--smoke", action="store_true")
args = p.parse_args()
SMOKE = args.smoke or smoke()
MODEL = TINY_LM if SMOKE else "Qwen/Qwen2.5-0.5B-Instruct"
EMB = "sentence-transformers-testing/stsb-bert-tiny-safetensors" if SMOKE else "intfloat/multilingual-e5-small"
cfg = {"beta": 0.1, "subset": "all", "loss_type": ["sigmoid"], "loss_weights": None, **RUNS[args.run]}
MAX_LEN = 1024
out = f"runs/L3-{args.run}"
os.makedirs(out, exist_ok=True)
tok = AutoTokenizer.from_pretrained(MODEL)

# ---------------------------------------------------------------- 1. data: explicit prompt, length filter, two measurements


def explicit(ex):
    """UltraFeedback stores whole conversations in chosen/rejected; split off the shared prompt."""
    if "prompt" in ex and ex["prompt"]:
        return {"prompt": ex["prompt"], "chosen": ex["chosen"], "rejected": ex["rejected"]}
    return {"prompt": ex["chosen"][:-1], "chosen": ex["chosen"][-1:], "rejected": ex["rejected"][-1:]}


def n_tokens(msgs):
    return len(tok(tok.apply_chat_template(msgs, tokenize=False), add_special_tokens=False)["input_ids"])


if SMOKE:
    raw = load_dataset("trl-internal-testing/zen", "conversational_preference", split="train")
    tr_raw, ev_raw = raw.select(range(0, 12)), raw.select(range(12, 16))
else:
    raw = load_dataset("trl-lib/ultrafeedback_binarized")
    tr_raw, ev_raw = raw["train"].shuffle(seed=0).select(range(3 * args.train)), raw["test"]
cols = tr_raw.column_names
tr = tr_raw.map(explicit, remove_columns=cols)
ev = ev_raw.map(explicit, remove_columns=cols)
# TRL 1.15 only truncates with keep_start, which would cut answers: drop long pairs instead (step 1 of the tutorial)
fits = lambda ex: max(n_tokens(ex["prompt"] + ex["chosen"]), n_tokens(ex["prompt"] + ex["rejected"])) <= MAX_LEN
tr = tr.filter(fits)
ev = ev.filter(fits)
tr = tr.select(range(min(len(tr), 12 if SMOKE else args.train)))
ev = ev.select(range(min(len(ev), 4 if SMOKE else args.eval)))

emb = SentenceTransformer(EMB)


def measure(ds):
    """Cosine similarity of chosen vs rejected (a cheap stand-in for CHES, D3) and their length ratio."""
    c = [x[-1]["content"] for x in ds["chosen"]]
    r = [x[-1]["content"] for x in ds["rejected"]]
    ec = emb.encode(["query: " + s for s in c], normalize_embeddings=True, batch_size=32)
    er = emb.encode(["query: " + s for s in r], normalize_embeddings=True, batch_size=32)
    sim = (ec * er).sum(1)
    ratio = np.array([len(tok(a)["input_ids"]) / max(1, len(tok(b)["input_ids"])) for a, b in zip(c, r)])
    return ds.add_column("sim", sim.tolist()).add_column("len_ratio", ratio.tolist())


tr, ev = measure(tr), measure(ev)
if cfg["subset"] != "all":
    lo, hi = np.quantile(tr["sim"], [0.2, 0.8])
    keep = (lambda s: s >= hi) if cfg["subset"] == "similar" else (lambda s: s <= lo)
    tr = tr.filter(lambda ex: keep(ex["sim"]))
print(f"train pairs: {len(tr)}, eval pairs: {len(ev)}, similarity median {np.median(tr['sim']):.3f}")

# ---------------------------------------------------------------- 2. train (LoRA: the reference is the same model with the adapter off)
targs = DPOConfig(
    output_dir=out, beta=cfg["beta"], learning_rate=1e-5, loss_type=cfg["loss_type"], loss_weights=cfg["loss_weights"],
    per_device_train_batch_size=2 if SMOKE else 4, gradient_accumulation_steps=1 if SMOKE else 4,
    max_length=MAX_LEN, num_train_epochs=1, max_steps=2 if SMOKE else -1,
    logging_steps=1 if SMOKE else 10, eval_strategy="steps", eval_steps=2 if SMOKE else 50,
    save_strategy="no", report_to="none", **device_setup(),     # T4: fp16=True, bf16=False (DPOConfig defaults to bf16)
)
trainer = DPOTrainer(
    model=MODEL, args=targs, processing_class=tok,
    train_dataset=tr.remove_columns(["sim", "len_ratio"]), eval_dataset=ev.remove_columns(["sim", "len_ratio"]),
    peft_config=LoraConfig(r=16, lora_alpha=32, target_modules="all-linear", task_type="CAUSAL_LM"),
    callbacks=[trainer_csv_callback(f"{out}/log.csv")],
)
trainer.train()
model = trainer.model.eval()

# ---------------------------------------------------------------- 3. per pair: how far did log p move from the reference?


@torch.no_grad()
def logp(prompt, completion) -> float:
    """Sum of log p over the completion tokens."""
    p_txt = tok.apply_chat_template(prompt, tokenize=False, add_generation_prompt=True)
    f_txt = tok.apply_chat_template(prompt + completion, tokenize=False)
    p_ids = tok(p_txt, add_special_tokens=False)["input_ids"]
    ids = torch.tensor([tok(f_txt, add_special_tokens=False)["input_ids"]], device=model.device)
    lp = torch.log_softmax(model(ids).logits[0, :-1].float(), -1)
    tgt = ids[0, 1:]
    return lp[len(p_ids) - 1:].gather(-1, tgt[len(p_ids) - 1:, None]).sum().item()


log = CSVLog(f"{out}/pairs.csv")
rows = []
for ex in ev:
    with model.disable_adapter():                      # the reference policy
        rc, rr = logp(ex["prompt"], ex["chosen"]), logp(ex["prompt"], ex["rejected"])
    pc, pr = logp(ex["prompt"], ex["chosen"]), logp(ex["prompt"], ex["rejected"])
    row = {"sim": ex["sim"], "len_ratio": ex["len_ratio"], "d_chosen": pc - rc, "d_rejected": pr - rr}
    rows.append(row)
    log.write(row)
sim = np.array([r["sim"] for r in rows])
ratio = np.array([r["len_ratio"] for r in rows])
dc = np.array([r["d_chosen"] for r in rows])
dr = np.array([r["d_rejected"] for r in rows])
lo, hi = np.quantile(sim, [0.2, 0.8])
summary = {
    "run": args.run, **{k: v for k, v in cfg.items()},
    "share of pairs whose chosen log p went DOWN": float((dc < 0).mean()),
    "mean Δ log p(chosen)": float(dc.mean()), "mean Δ log p(rejected)": float(dr.mean()),
    "Δ log p(chosen), similar pairs (top 20%)": float(dc[sim >= hi].mean()),
    "Δ log p(chosen), different pairs (bottom 20%)": float(dc[sim <= lo].mean()),
    "Δ log p(chosen), chosen longer (ratio > 1.2)": float(dc[ratio > 1.2].mean()) if (ratio > 1.2).any() else None,
    "Δ log p(chosen), chosen shorter (ratio < 0.8)": float(dc[ratio < 0.8].mean()) if (ratio < 0.8).any() else None,
}

# ---------------------------------------------------------------- 4. generate: are answers longer after DPO?
prompts = [ex["prompt"] for ex in ev.select(range(min(len(ev), 2 if SMOKE else 50)))]


def mean_gen_len(adapter_on: bool) -> float:
    n = []
    for pr in prompts:
        ids = tok.apply_chat_template(pr, add_generation_prompt=True, return_tensors="pt", return_dict=True).to(model.device)
        if adapter_on:
            g = model.generate(**ids, max_new_tokens=16 if SMOKE else 512, do_sample=False)
        else:
            with model.disable_adapter():
                g = model.generate(**ids, max_new_tokens=16 if SMOKE else 512, do_sample=False)
        n.append(g.shape[1] - ids["input_ids"].shape[1])
    return float(np.mean(n))


summary["mean answer length before"] = mean_gen_len(False)
summary["mean answer length after"] = mean_gen_len(True)
print(json.dumps(summary, indent=1))
json.dump(summary, open(f"{out}/summary.json", "w"), indent=1)
