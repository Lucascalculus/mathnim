"""L5 (optional): sequence-level distillation - train a small model on a teacher's reasoning traces (Mathnim course, E3).

  python L5_distill.py --stage gen --vllm       # 1. teacher writes 4 traces per question (L4/A100 + vLLM recommended)
  python L5_distill.py --stage filter           # 2. rejection sampling with L4's grader; acceptance rate by difficulty
  python L5_distill.py --stage sft              # 3. LoRA SFT of the student on the accepted traces (L2's recipe)
  python L5_distill.py --stage eval             # 4. pass@k, length, truncation; again with max_new_tokens = 256 (P4)
  python L5_distill.py --stage gkd --beta 1.0   # 5. optional: on-policy distillation (GKD), then --beta 0.0
  LAB_SMOKE=1 python L5_distill.py --stage all  # a quick check of 1-4 with a tiny model as teacher and student

Files: runs/L5/traces.jsonl, runs/L5/accepted.jsonl, runs/L5/student/ (adapter), runs/L5/eval.json
Licences and contamination: read the teacher's licence and terms before distilling it, and remember
the teacher may have seen GSM8K's test set.
"""
from __future__ import annotations

import argparse
import json
import os
from collections import defaultdict

import numpy as np
import torch

from common import SYSTEM, TINY_LM, device_setup, eval_gsm8k, gsm8k_chat, parse_answer, sample_n, smoke, trainer_csv_callback

p = argparse.ArgumentParser()
p.add_argument("--stage", choices=["gen", "filter", "sft", "eval", "gkd", "all"], required=True)
p.add_argument("--teacher", default="Qwen/Qwen3-4B", help="any open reasoning model; its tokenizer may differ from the student's")
p.add_argument("--student", default="Qwen/Qwen2.5-1.5B-Instruct", help="the same base as L4, so the two can be compared")
p.add_argument("--questions", type=int, default=2000)
p.add_argument("--per-question", type=int, default=4)
p.add_argument("--keep", type=int, default=2, help="at most this many accepted traces per question")
p.add_argument("--beta", type=float, default=1.0, help="GKD: 0 = forward KL, 1 = reverse KL (E3)")
p.add_argument("--vllm", action="store_true")
p.add_argument("--smoke", action="store_true")
args = p.parse_args()
SMOKE = args.smoke or smoke()
TEACHER, STUDENT = (TINY_LM, TINY_LM) if SMOKE else (args.teacher, args.student)
NQ, PER, MAXT = (6, 2, 24) if SMOKE else (args.questions, args.per_question, 2048)
D = "runs/L5"
os.makedirs(D, exist_ok=True)
stages = ["gen", "filter", "sft", "eval"] if args.stage == "all" else [args.stage]


def load(mid):
    from transformers import AutoModelForCausalLM, AutoTokenizer
    tok = AutoTokenizer.from_pretrained(mid)
    return AutoModelForCausalLM.from_pretrained(mid, dtype="auto").to("cuda" if torch.cuda.is_available() else "cpu").eval(), tok

# ---------------------------------------------------------------- 1. the teacher writes traces
if "gen" in stages:
    qs = gsm8k_chat("train", NQ, 200)            # skip the 200 questions L4 used for P1
    if args.vllm:
        from vllm import LLM, SamplingParams
        llm = LLM(model=TEACHER, max_model_len=MAXT + 512, gpu_memory_utilization=0.85)
        sp = SamplingParams(n=PER, temperature=0.6, top_p=0.95, max_tokens=MAXT)   # Qwen3's suggested settings for thinking mode
        outs = llm.chat(qs["prompt"], sp, chat_template_kwargs={"enable_thinking": True})
        traces = [[(c.text, c.finish_reason == "length") for c in o.outputs] for o in outs]
    else:
        model, tok = load(TEACHER)
        traces = sample_n(model, tok, qs["prompt"], PER, MAXT, 0.6)
    with open(f"{D}/traces.jsonl", "w") as f:
        for q, gold, ts in zip(qs["prompt"], qs["answer"], traces):
            for text, truncated in ts:
                f.write(json.dumps({"question": q[-1]["content"], "gold": gold, "text": text, "truncated": truncated}) + "\n")
    print(f"wrote {sum(len(t) for t in traces)} traces for {len(traces)} questions")

# ---------------------------------------------------------------- 2. rejection sampling
if "filter" in stages:
    rows = [json.loads(line) for line in open(f"{D}/traces.jsonl")]
    by_q = defaultdict(list)
    for r in rows:
        by_q[r["question"]].append(r)
    kept, rates = [], []
    for q, rs in by_q.items():
        ok = [r for r in rs if not r["truncated"]                           # a cut-off trace teaches "never finish"
              and (a := parse_answer(r["text"])) is not None and abs(a - float(r["gold"])) < 1e-6]
        rates.append(len(ok) / len(rs))
        seen = set()
        for r in ok:
            if r["text"] not in seen and len(seen) < args.keep:
                seen.add(r["text"])
                kept.append(r)
    if SMOKE and not kept:   # a tiny random teacher is never right; keep a few so the next stages can run
        kept = rows[:4]
    with open(f"{D}/accepted.jsonl", "w") as f:
        for r in kept:
            f.write(json.dumps(r) + "\n")
    rates = np.array(rates)
    print(f"accepted {len(kept)} traces; acceptance rate per question: mean {rates.mean():.2f}")
    print("questions the teacher solved never / sometimes / always:", int((rates == 0).sum()), int(((rates > 0) & (rates < 1)).sum()), int((rates == 1).sum()))
    print("the 'never' questions vanish from the training set: the hardest ones (B2)")
    lens = [len(r["text"]) for r in kept]
    print(f"accepted trace length: median {np.median(lens):.0f} characters, 90th percentile {np.percentile(lens, 90):.0f}")

# ---------------------------------------------------------------- 3. SFT the student (L2's recipe)
if "sft" in stages:
    from datasets import Dataset
    from peft import LoraConfig
    from trl import SFTConfig, SFTTrainer
    kept = [json.loads(line) for line in open(f"{D}/accepted.jsonl")]
    ds = Dataset.from_list([{"prompt": [{"role": "system", "content": SYSTEM}, {"role": "user", "content": r["question"]}],
                             "completion": [{"role": "assistant", "content": r["text"]}]} for r in kept])
    targs = SFTConfig(output_dir=f"{D}/student", num_train_epochs=2, max_steps=2 if SMOKE else -1, learning_rate=2e-4,
                      per_device_train_batch_size=1 if SMOKE else 2, gradient_accumulation_steps=1 if SMOKE else 8,
                      max_length=MAXT + 512, completion_only_loss=True, eos_token="<|im_end|>",
                      logging_steps=1 if SMOKE else 10, save_strategy="no", report_to="none", **device_setup())
    tr = SFTTrainer(model=STUDENT, args=targs, train_dataset=ds,
                    peft_config=LoraConfig(r=16, lora_alpha=32, target_modules="all-linear", task_type="CAUSAL_LM"),
                    callbacks=[trainer_csv_callback(f"{D}/sft_log.csv")])
    tr.train()
    tr.model.save_pretrained(f"{D}/student")
    print("saved the adapter to", f"{D}/student")

# ---------------------------------------------------------------- 4. evaluate: long budget, then a short one (P4)
if "eval" in stages:
    from peft import PeftModel
    base, tok = load(STUDENT)
    model = PeftModel.from_pretrained(base, f"{D}/student").merge_and_unload().eval()
    n_q, n = (3, 2) if SMOKE else (200, 16)
    res = {}
    if args.vllm:
        model.save_pretrained(f"{D}/merged")
        tok.save_pretrained(f"{D}/merged")
    for budget in ([24, 8] if SMOKE else [MAXT, 256]):
        r = eval_gsm8k(f"{D}/merged" if args.vllm else model, tok, "test", n_q, n, budget, use_vllm=args.vllm)
        res[f"max_new_tokens={budget}"] = {k: v for k, v in r.items() if k != "c"}
        print(budget, res[f"max_new_tokens={budget}"])
    json.dump(res, open(f"{D}/eval.json", "w"), indent=1)

# ---------------------------------------------------------------- 5. optional: on-policy distillation (GKD)
if "gkd" in stages:
    from datasets import Dataset
    from peft import LoraConfig
    from trl.experimental.gkd import GKDConfig, GKDTrainer   # experimental: names may change between TRL versions
    # GKD compares the two models token by token, so teacher and student must share a tokenizer:
    # Qwen2.5-1.5B-Instruct teaches Qwen2.5-0.5B-Instruct. (Different tokenizers: trl.experimental.gold, use_uld_loss=True.)
    teacher, student = (TINY_LM, TINY_LM) if SMOKE else ("Qwen/Qwen2.5-1.5B-Instruct", "Qwen/Qwen2.5-0.5B-Instruct")
    qs = gsm8k_chat("train", 8 if SMOKE else 1000, 200)
    # GKD wants whole conversations; with lmbda = 1 the student writes its own answers, so this one is only a placeholder
    msgs = Dataset.from_list([{"messages": pr + [{"role": "assistant", "content": f"<answer>{g}</answer>"}]} for pr, g in zip(qs["prompt"], qs["answer"])])
    gargs = GKDConfig(output_dir=f"{D}/gkd-b{args.beta}", lmbda=1.0, beta=args.beta, max_new_tokens=16 if SMOKE else 256,
                      temperature=0.9, learning_rate=1e-5, per_device_train_batch_size=2 if SMOKE else 4,
                      max_steps=2 if SMOKE else 300, logging_steps=1 if SMOKE else 10, save_strategy="no", report_to="none", **device_setup())
    from transformers import AutoTokenizer
    g = GKDTrainer(model=student, teacher_model=teacher, args=gargs, train_dataset=msgs, processing_class=AutoTokenizer.from_pretrained(student),
                   peft_config=LoraConfig(r=16, lora_alpha=32, target_modules="all-linear", task_type="CAUSAL_LM"),
                   callbacks=[trainer_csv_callback(f"{D}/gkd-b{args.beta}.csv")])
    g.train()
    # diversity (P6): 8 samples per question - how many different final answers, how many different first sentences?
    m = g.model.merge_and_unload().eval()
    outs = sample_n(m, g.processing_class, qs["prompt"][:3 if SMOKE else 50], 8, 16 if SMOKE else 256, 1.0)
    finals = np.mean([len({parse_answer(t) for t, _ in o}) for o in outs])
    openings = np.mean([len({t.strip().split(".")[0][:60] for t, _ in o}) for o in outs])
    print(f"beta={args.beta}: distinct final answers per 8 samples {finals:.2f}, distinct first sentences {openings:.2f}")
