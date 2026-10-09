"""Static SVG figures for parts B (SFT) and C (efficiency) of the fine-tuning course.

Writes apps/mathnim/public/ft/b/*.svg and apps/mathnim/public/ft/c/*.svg.
Re-running gives byte-identical files (fixed seeds, no dates, fixed SVG ids).
Needs only matplotlib, numpy and scipy; transformers is used by --verify alone.

    apps/mathnim/tools/ft-data/.venv/bin/python -I apps/mathnim/tools/ft-data/figures.py
    ... figures.py b1-packing c3-nf4-levels      # only some figures
    ... figures.py --preview /some/dir            # also write PNG previews there
    ... figures.py --verify                       # check the hand-written chat templates and the
                                                  # token ids against Qwen2.5's tokenizer (needs
                                                  # transformers and a cached Qwen2.5 tokenizer)

Sources, per figure, are in fig_b.py / fig_c.py next to the numbers; paper
redraws carry a corner note in the figure itself. Figures are redrawn from
numbers and shapes, never copied.
"""
from __future__ import annotations

import argparse
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))

import fig_style  # noqa: E402

fig_style.setup()
import fig_b  # noqa: E402
import fig_c  # noqa: E402

ROOT = HERE.parents[3]
OUT_B = ROOT / "apps" / "mathnim" / "public" / "ft" / "b"
OUT_C = ROOT / "apps" / "mathnim" / "public" / "ft" / "c"

# Qwen2.5 tokenisation of fig_b.PIPE_MESSAGES rendered with the chat template
# (Qwen/Qwen2.5-0.5B tokenizer, transformers 5.17; the Instruct tokenizer gives
# the same ids). Checked by --verify.
PIPE_TOKENS = [
    ("<|im_start|>", 151644), ("system", 8948), ("\n", 198), ("Be", 3430), (" brief", 9814), (".", 13),
    ("<|im_end|>", 151645), ("\n", 198), ("<|im_start|>", 151644), ("user", 872), ("\n", 198),
    ("Name", 675), (" a", 264), (" prime", 10250), (" number", 1372), (".", 13), ("<|im_end|>", 151645),
    ("\n", 198), ("<|im_start|>", 151644), ("assistant", 77091), ("\n", 198), ("7", 22), (" is", 374),
    (" prime", 10250), (".", 13), ("<|im_end|>", 151645), ("\n", 198),
]

TOOLS = [{"type": "function", "function": {
    "name": "search_trains", "description": "Search high-speed trains by origin, destination and date",
    "parameters": {"type": "object", "properties": {"from": {"type": "string"}, "to": {"type": "string"},
                                                    "date": {"type": "string"}},
                   "required": ["from", "to", "date"]}}}]
TOOL_MESSAGES = [
    {"role": "system", "content": "You are a ticket-booking assistant."},
    {"role": "user", "content": "Earliest high-speed train from Shanghai to Beijing tomorrow?"},
    {"role": "assistant", "tool_calls": [{"type": "function", "function": {
        "name": "search_trains", "arguments": {"from": "Shanghai", "to": "Beijing", "date": "2026-10-11"}}}]},
    {"role": "tool", "name": "search_trains", "content": "[{\"train\": \"G2\", \"dep\": \"07:00\"}]"},
    {"role": "assistant", "content": "The earliest is G2, departing at 07:00."},
]


def _qwen_tokenizer():
    from transformers import AutoTokenizer
    cache = HERE / ".cache" / "hf"
    for repo in ("Qwen/Qwen2.5-0.5B", "Qwen/Qwen2.5-0.5B-Instruct"):
        try:
            return repo, AutoTokenizer.from_pretrained(repo, cache_dir=str(cache), local_files_only=True)
        except Exception:
            continue
    return None, None


def verify() -> bool:
    repo, tok = _qwen_tokenizer()
    if tok is None:
        print("verify: no cached Qwen2.5 tokenizer in .cache/hf")
        return False
    print("tokenizer:", repo)
    ok = True
    got = tok.apply_chat_template(fig_b.MESSAGES, tokenize=False)
    same = got == fig_b._flat(fig_b.QWEN_TURNS)
    print("b1-chat-templates: Qwen2.5 text matches the figure:", same)
    ok &= same
    text = tok.apply_chat_template(fig_b.PIPE_MESSAGES, tokenize=False)
    ids = tok(text, add_special_tokens=False)["input_ids"]
    toks = [(tok.decode([i]), i) for i in ids]
    same = toks == PIPE_TOKENS
    print("b1-pipeline: token ids match PIPE_TOKENS:", same)
    ok &= same
    tool_text = tok.apply_chat_template(TOOL_MESSAGES, tools=TOOLS, tokenize=False)
    # every displayed line of the tool figure (except the abbreviated tool block) must occur in order
    pos = 0
    for segs, blk in fig_b.TOOL_LINES:
        s = "".join(seg for seg, kind in segs if kind != "dim").lstrip(" ")
        if not s:
            continue
        j = tool_text.find(s, pos)
        if j < 0:
            print("b2-tool-call-mask: not found in order:", repr(s))
            ok = False
        else:
            pos = j + len(s)
    print("b2-tool-call-mask: lines appear in order in the real rendering:", ok)
    print("eos_token:", tok.eos_token, "| pad_token:", tok.pad_token, tok.pad_token_id)
    return ok


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("names", nargs="*", help="figure names (default: all)")
    ap.add_argument("--preview", type=Path, default=None, help="folder for PNG previews")
    ap.add_argument("--verify", action="store_true")
    args = ap.parse_args(argv)
    if args.verify:
        return 0 if verify() else 1

    jobs = {name: (lambda fn=fn: fn(OUT_B, args.preview)) for name, fn in fig_b.ALL.items()}
    jobs["b1-pipeline"] = lambda: fig_b.b1_pipeline(OUT_B, args.preview, PIPE_TOKENS)
    jobs.update({name: (lambda fn=fn: fn(OUT_C, args.preview)) for name, fn in fig_c.ALL.items()})
    for n in args.names or list(jobs):
        jobs[n]()
        print("wrote", n)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
