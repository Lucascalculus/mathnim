"""GRPO from scratch, about 120 lines, for L4's R6: what does the group baseline buy? (Mathnim course, E1)

  python grpo_minimal.py --adv grpo        # (r - mean) / std : the GRPO advantage
  python grpo_minimal.py --adv mean        # r - mean          : baseline, no scaling (Dr. GRPO)
  python grpo_minimal.py --adv none        # r                 : no baseline at all
  LAB_SMOKE=1 python grpo_minimal.py --adv none

One gradient step per batch, so the ratio rho is exactly 1 and clipping never acts (E1):
the loss is just -A * log pi, averaged over all tokens of the batch (DAPO's aggregation).
Logs per step: reward, frac_reward_zero_std, the gradient norm. Output: runs/minimal-<adv>.csv
"""
from __future__ import annotations

import argparse
import os
import random
import time

import torch
from peft import LoraConfig, get_peft_model
from transformers import AutoModelForCausalLM, AutoTokenizer

from common import TINY_LM, CSVLog, gsm8k_chat, parse_answer, smoke

p = argparse.ArgumentParser()
p.add_argument("--adv", choices=["grpo", "mean", "none"], default="grpo")
p.add_argument("--steps", type=int, default=100)
p.add_argument("--questions", type=int, default=4, help="questions per step")
p.add_argument("--G", type=int, default=8)
p.add_argument("--lr", type=float, default=1e-5)
p.add_argument("--max-new", type=int, default=256)
p.add_argument("--seed", type=int, default=0)
p.add_argument("--smoke", action="store_true")
args = p.parse_args()
SMOKE = args.smoke or smoke()
MODEL = TINY_LM if SMOKE else "Qwen/Qwen2.5-0.5B-Instruct"
STEPS, NQ, G, MAX_NEW = (2, 2, 4, 16) if SMOKE else (args.steps, args.questions, args.G, args.max_new)
random.seed(args.seed)
torch.manual_seed(args.seed)
dev = "cuda" if torch.cuda.is_available() else "cpu"

tok = AutoTokenizer.from_pretrained(MODEL)
tok.padding_side = "left"                                   # generation pads on the left
if tok.pad_token is None:
    tok.pad_token = tok.eos_token
model = AutoModelForCausalLM.from_pretrained(MODEL, dtype=torch.float32).to(dev)
model = get_peft_model(model, LoraConfig(r=16, lora_alpha=32, target_modules="all-linear", task_type="CAUSAL_LM"))
opt = torch.optim.AdamW([q for q in model.parameters() if q.requires_grad], lr=args.lr)
data = gsm8k_chat("train", 64 if SMOKE else 2000, 200)
stop_ids = [i for i in {tok.eos_token_id, tok.convert_tokens_to_ids("<|im_end|>")} if isinstance(i, int) and i >= 0]
os.makedirs("runs", exist_ok=True)
log = CSVLog(f"runs/minimal-{args.adv}.csv")


def reward(text: str, gold: str) -> float:
    a = parse_answer(text)
    return 1.0 if a is not None and abs(a - float(gold)) < 1e-6 else 0.0


for step in range(STEPS):
    t0 = time.time()
    batch = [data[i] for i in random.sample(range(len(data)), NQ)]
    # ---- 1. sample G answers per question with the current policy
    texts = [tok.apply_chat_template(ex["prompt"], tokenize=False, add_generation_prompt=True) for ex in batch]
    enc = tok(texts, return_tensors="pt", padding=True, add_special_tokens=False).to(dev)
    model.eval()
    with torch.no_grad():
        seqs = model.generate(**enc, do_sample=True, temperature=1.0, top_p=1.0, top_k=0, repetition_penalty=1.0,
                              max_new_tokens=MAX_NEW, num_return_sequences=G, eos_token_id=stop_ids, pad_token_id=tok.pad_token_id)
    P = enc["input_ids"].shape[1]
    comp = seqs[:, P:]                                                    # [NQ*G, T]
    # mask: real completion tokens up to and including the first end token
    is_stop = torch.zeros_like(comp, dtype=torch.bool)
    for s in stop_ids:
        is_stop |= comp == s
    after_stop = (is_stop.cumsum(1) - is_stop.long()) > 0
    mask = (~after_stop).float()
    # ---- 2. rewards and advantages, group by group
    golds = [ex["answer"] for ex in batch for _ in range(G)]
    r = torch.tensor([reward(tok.decode(c, skip_special_tokens=True), g) for c, g in zip(comp, golds)], device=dev).view(NQ, G)
    if SMOKE:   # a tiny random model never gets anything right; coin flips make the gradient path run
        r = (torch.rand(NQ, G, device=dev) < 0.5).float()
    if args.adv == "none":
        A = r                                                             # REINFORCE: wrong answers get 0
    elif args.adv == "mean":
        A = r - r.mean(1, keepdim=True)
    else:
        A = (r - r.mean(1, keepdim=True)) / (r.std(1, keepdim=True) + 1e-4)   # torch.std: the sample std (G - 1)
    A = A.view(-1, 1)
    # ---- 3. one gradient step: loss = - sum_t A_i log pi(o_t) / (all tokens of the batch)
    model.train()
    attn = torch.cat([enc["attention_mask"].repeat_interleave(G, 0), mask.long()], 1)
    pos = (attn.cumsum(1) - 1).clamp(min=0)                           # left padding: positions as in generation
    logits = model(input_ids=seqs, attention_mask=attn, position_ids=pos).logits[:, P - 1:-1].float()
    logp = torch.log_softmax(logits, -1).gather(-1, comp[..., None]).squeeze(-1)
    loss = -(A * logp * mask).sum() / mask.sum().clamp(min=1)
    opt.zero_grad()
    loss.backward()
    gnorm = torch.nn.utils.clip_grad_norm_([q for q in model.parameters() if q.requires_grad], 1e9).item()   # measure only
    opt.step()
    row = {"step": step, "reward": r.mean().item(), "frac_reward_zero_std": (r.std(1) == 0).float().mean().item(),
           "grad_norm": gnorm, "mean_len": mask.sum(1).mean().item(), "seconds": round(time.time() - t0, 1)}
    log.write(row)
    print(row)
