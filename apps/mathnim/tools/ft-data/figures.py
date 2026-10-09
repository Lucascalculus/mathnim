"""Static SVG figures for parts B (SFT) and C (efficiency) of the fine-tuning course.

Writes apps/mathnim/public/ft/b/*.svg and apps/mathnim/public/ft/c/*.svg.
Re-running gives byte-identical files (fixed seeds, no dates, fixed SVG ids).

    apps/mathnim/tools/ft-data/.venv/bin/python -I apps/mathnim/tools/ft-data/figures.py
    ... figures.py b1-packing c3-nf4-levels      # only some figures
    ... figures.py --preview /some/dir            # also write PNG previews there
    ... figures.py --verify                       # check the hand-written chat templates and
                                                  # token ids against Qwen2.5's tokenizer (needs
                                                  # transformers and the cached Qwen/Qwen2.5-0.5B)

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
# (tokenizer of Qwen/Qwen2.5-0.5B; checked by --verify).
PIPE_TOKENS_BAKED: list[tuple[str, int]] | None = None


def _qwen_tokenizer():
    try:
        from transformers import AutoTokenizer
    except Exception:
        return None
    cache = HERE / ".cache" / "hf"
    try:
        return AutoTokenizer.from_pretrained("Qwen/Qwen2.5-0.5B", cache_dir=str(cache), local_files_only=True)
    except Exception:
        return None


def pipe_tokens(tok) -> list[tuple[str, int]]:
    text = tok.apply_chat_template(fig_b.PIPE_MESSAGES, tokenize=False)
    ids = tok(text, add_special_tokens=False)["input_ids"]
    return [(tok.decode([i]), i) for i in ids]


def verify(tok) -> bool:
    ok = True
    want = fig_b._flat(fig_b.QWEN_TURNS)
    got = tok.apply_chat_template(fig_b.MESSAGES, tokenize=False)
    print("Qwen2.5 template matches the figure:", got == want)
    ok &= got == want
    if got != want:
        print(repr(got))
        print(repr(want))
    print("eos_token (Qwen2.5-0.5B base):", tok.eos_token, "| pad_token:", tok.pad_token, tok.pad_token_id)
    toks = pipe_tokens(tok)
    if PIPE_TOKENS_BAKED is not None:
        same = toks == PIPE_TOKENS_BAKED
        print("pipeline tokens match the baked table:", same)
        ok &= same
    else:
        print("PIPE_TOKENS_BAKED =", toks)
    return ok


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("names", nargs="*", help="figure names (default: all)")
    ap.add_argument("--preview", type=Path, default=None, help="folder for PNG previews")
    ap.add_argument("--verify", action="store_true")
    args = ap.parse_args(argv)

    tok = _qwen_tokenizer() if (args.verify or PIPE_TOKENS_BAKED is None) else None
    if args.verify:
        if tok is None:
            print("verify: transformers or the cached Qwen2.5 tokenizer is not available")
            return 1
        return 0 if verify(tok) else 1

    tokens = PIPE_TOKENS_BAKED or (pipe_tokens(tok) if tok is not None else None)
    jobs = {}
    for name, fn in fig_b.ALL.items():
        jobs[name] = (lambda fn=fn: fn(OUT_B, args.preview))
    jobs["b1-pipeline"] = lambda: fig_b.b1_pipeline(OUT_B, args.preview, tokens)
    for name, fn in fig_c.ALL.items():
        jobs[name] = (lambda fn=fn: fn(OUT_C, args.preview))
    names = args.names or list(jobs)
    for n in names:
        if n == "b1-pipeline" and tokens is None:
            print("skip b1-pipeline: no token table (run once with the Qwen2.5 tokenizer cached)")
            continue
        jobs[n]()
        print("wrote", n)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
