"""L2: LoRA SFT on GSM8K - loss mask, rank and learning rate (Mathnim fine-tuning course).

  python L2_sft_lora.py --run R0          # the base configuration
  python L2_sft_lora.py --run R1          # R1..R6: one change each (see RUNS)
  python L2_sft_lora.py --export-dw       # after R0: save one layer's ΔW for the course (C2)
  LAB_SMOKE=1 python L2_sft_lora.py --run R0   # a quick check with a tiny model

Each run writes runs/<run>/log.csv (TRL's metrics) and runs/<run>/eval.json.
"""
from __future__ import annotations

import argparse
import json
import os

import torch
from datasets import load_dataset
from peft import LoraConfig
from transformers import AutoModelForCausalLM, AutoTokenizer
from trl import SFTConfig, SFTTrainer

from common import TINY_LM, device_setup, gold_of, parse_hashes, same_number, smoke, trainer_csv_callback

RUNS = {
    "R0": {},                                   # mask on, r = 16, lr = 2e-4
    "R1": {"completion_only_loss": False},      # loss on the prompt too
    "R2": {"r": 1},                             # rank 1 (alpha stays 32)
    "R3": {"r": 64},                            # rank 64 (alpha stays 32)
    "R4": {"lr": 2e-5},                         # 10x too small for LoRA?
    "R5": {"lr": 2e-3},                         # 10x too large?
    "R6": {"eos_token": None},                  # the bug: no end-of-turn token set
}
p = argparse.ArgumentParser()
p.add_argument("--run", default="R0", choices=list(RUNS))
p.add_argument("--steps", type=int, default=300)
p.add_argument("--eval", type=int, default=200)
p.add_argument("--export-dw", action="store_true")
p.add_argument("--smoke", action="store_true")
args = p.parse_args()
SMOKE = args.smoke or smoke()
MODEL = TINY_LM if SMOKE else "Qwen/Qwen2.5-0.5B"      # the BASE model: no chat tuning yet
cfg = {"r": 16, "lr": 2e-4, "completion_only_loss": True, "eos_token": "<|im_end|>", **RUNS[args.run]}
out = f"runs/{args.run}"
os.makedirs(out, exist_ok=True)

# ---------------------------------------------------------------- data: prompt-completion pairs


def to_pc(ex):
    steps, ans = ex["answer"].split("####")
    return {"prompt": [{"role": "user", "content": ex["question"]}],
            "completion": [{"role": "assistant", "content": steps.strip() + "\n#### " + ans.strip()}]}


gsm = load_dataset("openai/gsm8k", "main")
train = gsm["train"].map(to_pc, remove_columns=gsm["train"].column_names)
test = gsm["test"].select(range(8 if SMOKE else args.eval))
val = train.select(range(len(train) - (8 if SMOKE else 200), len(train)))
train = train.select(range(32 if SMOKE else len(train) - 200))

# ---------------------------------------------------------------- train
tok = AutoTokenizer.from_pretrained(MODEL)
peft_cfg = LoraConfig(r=cfg["r"], lora_alpha=32, lora_dropout=0.0, target_modules="all-linear", task_type="CAUSAL_LM")
targs = SFTConfig(
    output_dir=out, max_steps=2 if SMOKE else args.steps, learning_rate=cfg["lr"],
    per_device_train_batch_size=2 if SMOKE else 8, gradient_accumulation_steps=1 if SMOKE else 2,
    max_length=512, completion_only_loss=cfg["completion_only_loss"], eos_token=cfg["eos_token"],
    logging_steps=1 if SMOKE else 10, eval_strategy="steps", eval_steps=2 if SMOKE else 100,
    save_strategy="no", report_to="none", **device_setup(),
)
trainer = SFTTrainer(model=MODEL, args=targs, train_dataset=train, eval_dataset=val, peft_config=peft_cfg,
                     processing_class=tok, callbacks=[trainer_csv_callback(f"{out}/log.csv")])
trainer.model.print_trainable_parameters()   # predict this number first (P1)
trainer.train()
peak = torch.cuda.max_memory_allocated() / 2**30 if torch.cuda.is_available() else float("nan")

# ---------------------------------------------------------------- evaluate: accuracy, format, stopping
model = trainer.model.eval()
stop_ids = [tok.convert_tokens_to_ids("<|im_end|>"), tok.eos_token_id]
right = fmt = stopped = 0
lengths = []
for ex in test:
    msgs = [{"role": "user", "content": ex["question"]}]
    ids = tok.apply_chat_template(msgs, add_generation_prompt=True, return_tensors="pt", return_dict=True).to(model.device)
    with torch.no_grad():
        g = model.generate(**ids, max_new_tokens=16 if SMOKE else 300, do_sample=False, eos_token_id=stop_ids, pad_token_id=tok.pad_token_id or tok.eos_token_id)
    new = g[0, ids["input_ids"].shape[1]:]
    text = tok.decode(new, skip_special_tokens=True)
    a = parse_hashes(text)
    right += same_number(a, gold_of(ex["answer"]))
    fmt += a is not None
    stopped += int(new[-1].item() in stop_ids)
    lengths.append(len(new))
n = len(test)
res = {"run": args.run, **cfg, "accuracy": right / n, "format_rate": fmt / n, "stop_rate": stopped / n, "mean_len": sum(lengths) / n, "peak_gb": peak}
print(json.dumps(res, indent=1))
json.dump(res, open(f"{out}/eval.json", "w"), indent=1)

# ---------------------------------------------------------------- export ΔW of one layer (data for C2's lowrank_update)
if args.export_dw:
    import numpy as np
    for name, mod in model.named_modules():
        if name.endswith("layers.12.self_attn.q_proj") or name.endswith("layers.12.mlp.down_proj") or (SMOKE and name.endswith("layers.0.self_attn.q_proj")):
            A, B = mod.lora_A["default"].weight, mod.lora_B["default"].weight
            dW = (mod.scaling["default"] * (B @ A)).detach().float().cpu().numpy()      # ΔW = (α/r)·B·A
            np.save(f"{out}/dW_{name.split('.')[-2]}_{name.split('.')[-1]}.npy", dW)
            print("saved", name, dW.shape)
