"""Part B (SFT) figures. Called from figures.py; each function writes one SVG.

Numbers and their sources are next to each figure. Paper redraws carry a
corner note; exact data says "Data: ...".
"""
from __future__ import annotations

from pathlib import Path

import numpy as np

from fig_style import (ACCENT, CORAL, FAINT, FS, FS_NOTE, FS_SMALL, FS_TITLE, GOLD, GOOD,
                       INK, MONO_W, MUTED, PURPLE, TEAL, WHITE, arrow, box, canvas, credit,
                       figure, line, px_axes, rect, save, style_axes, text, tint)

# ------------------------------------------------------------ templates --
# Segments: (text, kind). kind: "t" plain text, "sp" special token, "eot"
# end-of-turn special token, "nl" a newline character (drawn as a muted \n),
# "dim" abbreviated material.

QWEN_TURNS = [
    ("system", [[("<|im_start|>", "sp"), ("system", "t"), ("\n", "nl")],
                [("You are a helpful assistant.", "t"), ("<|im_end|>", "eot"), ("\n", "nl")]]),
    ("user", [[("<|im_start|>", "sp"), ("user", "t"), ("\n", "nl")],
              [("Name a prime number.", "t"), ("<|im_end|>", "eot"), ("\n", "nl")]]),
    ("assistant", [[("<|im_start|>", "sp"), ("assistant", "t"), ("\n", "nl")],
                   [("7 is prime.", "t"), ("<|im_end|>", "eot"), ("\n", "nl")]]),
]

LLAMA_TURNS = [
    ("system", [[("<|begin_of_text|>", "sp"), ("<|start_header_id|>", "sp"), ("system", "t"),
                 ("<|end_header_id|>", "sp"), ("\n\n", "nl")],
                [("You are a helpful assistant.", "t"), ("<|eot_id|>", "eot")]]),
    ("user", [[("<|start_header_id|>", "sp"), ("user", "t"), ("<|end_header_id|>", "sp"), ("\n\n", "nl")],
              [("Name a prime number.", "t"), ("<|eot_id|>", "eot")]]),
    ("assistant", [[("<|start_header_id|>", "sp"), ("assistant", "t"), ("<|end_header_id|>", "sp"),
                    ("\n\n", "nl")],
                   [("7 is prime.", "t"), ("<|eot_id|>", "eot")]]),
]

MESSAGES = [
    {"role": "system", "content": "You are a helpful assistant."},
    {"role": "user", "content": "Name a prime number."},
    {"role": "assistant", "content": "7 is prime."},
]


def _flat(turns) -> str:
    return "".join(seg for _, lines in turns for ln in lines for seg, _ in ln)


def _shown(seg: str, kind: str) -> str:
    return seg.replace("\n", "\\n") if kind == "nl" else seg


def draw_mono_line(ax, x, y, segs, size, pad=1.5):
    """Draw one line of template text; returns {index: (x0, x1)} per segment."""
    cw = size * MONO_W
    spans = {}
    for i, (seg, kind) in enumerate(segs):
        s = _shown(seg, kind)
        w = len(s) * cw
        if kind in ("sp", "eot"):
            col = CORAL if kind == "eot" else ACCENT
            box(ax, x - pad, y - size * 0.72, w + 2 * pad, size * 1.44, fc=tint(col, 0.12),
                ec=col if kind == "eot" else "none", lw=1.0, r=3, z=1)
            text(ax, x, y, s, size=size, color=col, mono=True,
                 weight="bold" if kind == "eot" else "normal", z=3)
        elif kind == "nl":
            text(ax, x, y, s, size=size, color=MUTED, mono=True, z=3)
        elif kind == "dim":
            text(ax, x, y, s, size=size, color=MUTED, mono=True, z=3)
        else:
            text(ax, x, y, s, size=size, color=INK, mono=True, z=3)
        spans[i] = (x, x + w)
        x += w
    return spans


def b1_chat_templates(out: Path, prev: Path | None):
    W, H = 980, 520
    fig, ax = canvas(W, H)
    size = 12.5
    lh = 25
    col_x = {"q": 120, "l": 448}
    top = 70
    text(ax, col_x["q"], 28, "ChatML · Qwen2.5", size=FS_TITLE, weight="bold")
    text(ax, col_x["l"], 28, "Llama 3 (Instruct)", size=FS_TITLE, weight="bold")
    text(ax, col_x["q"], 48, "apply_chat_template(messages)", size=FS_SMALL, color=MUTED, mono=True)
    text(ax, col_x["l"], 48, "hand-rendered from the Llama 3 template", size=FS_SMALL, color=MUTED)

    eot_pos = {}
    y = top
    for t in range(3):
        role = QWEN_TURNS[t][0]
        y0 = y
        for li in range(2):
            sq = draw_mono_line(ax, col_x["q"], y, QWEN_TURNS[t][1][li], size)
            sl = draw_mono_line(ax, col_x["l"], y, LLAMA_TURNS[t][1][li], size)
            if t == 2 and li == 1:
                eot_pos["q"] = (sq[1], y)
                eot_pos["l"] = (sl[1], y)
            y += lh
        # role bracket on the left
        line(ax, [100, 100], [y0 - 9, y - lh + 9], color=MUTED, lw=1.2)
        text(ax, 92, (y0 + y - lh) / 2, role, size=FS, color=INK, ha="right")
        y += 12

    # end-of-turn callouts (assistant turn)
    yb = y + 18
    (qx0, qx1), qy = eot_pos["q"]
    (lx0, lx1), ly = eot_pos["l"]
    arrow(ax, (qx0 + qx1) / 2, yb - 6, (qx0 + qx1) / 2, qy + 11, color=CORAL, lw=1.3)
    arrow(ax, (lx0 + lx1) / 2, yb - 6, (lx0 + lx1) / 2, ly + 11, color=CORAL, lw=1.3)
    text(ax, col_x["q"], yb + 6, "end-of-turn token: <|im_end|>", size=FS, color=CORAL, weight="bold")
    text(ax, col_x["q"], yb + 26, "the model must learn to emit it here,", size=FS_SMALL, color=INK)
    text(ax, col_x["q"], yb + 44, "so it stays in the labels", size=FS_SMALL, color=INK)
    text(ax, col_x["l"], yb + 6, "end-of-turn token: <|eot_id|>", size=FS, color=CORAL, weight="bold")
    text(ax, col_x["l"], yb + 26, "generation must stop on it", size=FS_SMALL, color=INK)
    text(ax, col_x["l"], yb + 44, "(generation_config.eos_token_id)", size=FS_SMALL, color=INK, mono=True)

    # eos_token notes
    ny = yb + 76
    box(ax, col_x["q"] - 8, ny, 312, 96, fc=tint(GOLD, 0.08), ec=GOLD, lw=1.0, r=6)
    text(ax, col_x["q"] + 4, ny + 18, "tokenizer.eos_token", size=FS_SMALL, color=GOLD, mono=True, weight="bold")
    text(ax, col_x["q"] + 4, ny + 38, "Qwen2.5 base:  <|endoftext|>", size=FS_SMALL, mono=True)
    text(ax, col_x["q"] + 4, ny + 56, "Qwen2.5 Instruct:  <|im_end|>", size=FS_SMALL, mono=True)
    text(ax, col_x["q"] + 4, ny + 78, "SFT on the base: set eos to <|im_end|>", size=FS_SMALL, color=INK)

    box(ax, col_x["l"] - 8, ny, 400, 96, fc=tint(GOLD, 0.08), ec=GOLD, lw=1.0, r=6)
    text(ax, col_x["l"] + 4, ny + 18, "tokenizer.eos_token", size=FS_SMALL, color=GOLD, mono=True, weight="bold")
    text(ax, col_x["l"] + 4, ny + 38, "Llama 3 base:  <|end_of_text|>", size=FS_SMALL, mono=True)
    text(ax, col_x["l"] + 4, ny + 56, "the turn ends with <|eot_id|>, a different token", size=FS_SMALL)
    text(ax, col_x["l"] + 4, ny + 78, "Instruct generation stops on both", size=FS_SMALL, color=INK)

    # legend
    ly0 = H - 22
    box(ax, 20, ly0 - 9, 26, 18, fc=tint(ACCENT, 0.12), ec="none", r=3)
    text(ax, 52, ly0, "special token", size=FS_SMALL)
    box(ax, 160, ly0 - 9, 26, 18, fc=tint(CORAL, 0.12), ec=CORAL, lw=1.0, r=3)
    text(ax, 192, ly0, "end-of-turn token", size=FS_SMALL)
    text(ax, 330, ly0, "\\n", size=FS_SMALL, color=MUTED, mono=True)
    text(ax, 352, ly0, "newline in the text; other line breaks are display wraps", size=FS_SMALL)
    save(fig, out / "b1-chat-templates.svg",
         "The same system/user/assistant conversation rendered with the Qwen2.5 ChatML template and "
         "the Llama 3 template; special tokens highlighted; end-of-turn tokens <|im_end|> and <|eot_id|> "
         "versus the tokenizers' eos_token.", prev)


# ------------------------------------------------------------- pipeline --
# Qwen2.5 tokenisation of PIPE_MESSAGES rendered with apply_chat_template.
# Ids verified against Qwen/Qwen2.5-0.5B's tokenizer when it is cached (see
# figures.py --verify); the table keeps the figure reproducible offline.
PIPE_MESSAGES = [
    {"role": "system", "content": "Be brief."},
    {"role": "user", "content": "Name a prime number."},
    {"role": "assistant", "content": "7 is prime."},
]
PIPE_TOKENS: list[tuple[str, int]] = []  # filled in figures.py from the tokenizer or the baked table
PIPE_PAD = ("<|endoftext|>", 151643)


def b1_pipeline(out: Path, prev: Path | None, tokens: list[tuple[str, int]]):
    W, H = 980, 560
    fig, ax = canvas(W, H)
    msz = 12
    cw = msz * MONO_W

    # 1. messages box
    text(ax, 20, 24, "1  messages", size=FS_TITLE, weight="bold")
    mx, my = 20, 40
    mlines = ['[{"role": "system",    "content": "Be brief."},',
              ' {"role": "user",      "content": "Name a prime number."},',
              ' {"role": "assistant", "content": "7 is prime."}]']
    mw = max(len(s) for s in mlines) * cw + 24
    box(ax, mx, my, mw, 78, fc=tint(FAINT, 0.6), ec=MUTED, lw=1.0)
    for i, s in enumerate(mlines):
        text(ax, mx + 12, my + 18 + i * 21, s, size=msz, mono=True)

    # 2. template text
    tx = mx + mw + 70
    arrow(ax, mx + mw + 8, my + 39, tx - 8, my + 39, color=INK)
    text(ax, (mx + mw + tx) / 2, my + 26, "template", size=FS_SMALL, color=MUTED, ha="center")
    text(ax, tx, 24, "2  template text", size=FS_TITLE, weight="bold")
    tlines = [[("<|im_start|>", "sp"), ("system", "t"), ("\n", "nl"), ("Be brief.", "t"), ("<|im_end|>", "eot"), ("\n", "nl")],
              [("<|im_start|>", "sp"), ("user", "t"), ("\n", "nl"), ("Name a prime number.", "t"), ("<|im_end|>", "eot"), ("\n", "nl")],
              [("<|im_start|>", "sp"), ("assistant", "t"), ("\n", "nl"), ("7 is prime.", "t"), ("<|im_end|>", "eot"), ("\n", "nl")]]
    tw = max(sum(len(_shown(s, k)) for s, k in ln) for ln in tlines) * cw + 24
    box(ax, tx, my, tw, 78, fc="none", ec=MUTED, lw=1.0)
    for i, ln in enumerate(tlines):
        draw_mono_line(ax, tx + 12, my + 18 + i * 21, ln, msz)

    # 3./4. tokens, ids, labels
    gy = 160
    text(ax, 20, gy, "3  tokenize   4  build labels", size=FS_TITLE, weight="bold")
    text(ax, 268, gy, "labels = input_ids, with −100 where no loss is taken", size=FS_SMALL, color=MUTED)
    resp_start = None
    # response = tokens after the last "<|im_start|>assistant\n" up to and including <|im_end|>
    for i in range(len(tokens) - 2):
        if tokens[i][0] == "<|im_start|>" and tokens[i + 1][0] == "assistant":
            resp_start = i + 3
    resp_end = None
    for i in range(resp_start, len(tokens)):
        if tokens[i][0] == "<|im_end|>":
            resp_end = i
            break
    seq = [(s, tid, "resp" if resp_start <= i <= resp_end else "prompt") for i, (s, tid) in enumerate(tokens)]
    seq += [(PIPE_PAD[0], PIPE_PAD[1], "pad")] * 2

    tsz = 11.5
    tcw = tsz * MONO_W
    rows: list[list[tuple[str, int, str, float]]] = [[]]
    x0, xmax = 108, W - 16
    x = x0
    for s, tid, kind in seq:
        shown = s.replace("\n", "\\n").replace(" ", "␣")
        w = max(len(shown), len(str(tid)), 4) * tcw + 10
        if x + w > xmax:
            rows.append([])
            x = x0
        rows[-1].append((shown, tid, kind, w))
        x += w + 3
    ry = gy + 26
    rh = 25
    for row in rows:
        text(ax, 100, ry + rh * 0.5, "tokens", size=FS_SMALL, color=MUTED, ha="right")
        text(ax, 100, ry + rh * 1.5, "input_ids", size=FS_SMALL, color=MUTED, ha="right", mono=True)
        text(ax, 100, ry + rh * 2.5 + 2, "labels", size=FS_SMALL, color=INK, ha="right", mono=True, weight="bold")
        x = x0
        for shown, tid, kind, w in row:
            special = shown.startswith("<|")
            fc = tint(ACCENT, 0.12) if special else tint(FAINT, 0.5)
            if kind == "pad":
                fc = tint(FAINT, 0.9)
            ec = CORAL if shown == "<|im_end|>" else "none"
            box(ax, x, ry + 2, w, rh - 4, fc=fc, ec=ec, lw=1.0, r=3)
            text(ax, x + w / 2, ry + rh / 2, shown, size=tsz, mono=True, ha="center",
                 color=(ACCENT if special and shown != "<|im_end|>" else CORAL if shown == "<|im_end|>" else MUTED if kind == "pad" else INK))
            text(ax, x + w / 2, ry + rh * 1.5, str(tid), size=tsz, mono=True, ha="center", color=MUTED)
            ly = ry + rh * 2 + 2
            if kind == "resp":
                box(ax, x, ly + 2, w, rh - 4, fc=tint(GOOD, 0.16), ec=GOOD, lw=1.1, r=3)
                text(ax, x + w / 2, ly + rh / 2, str(tid), size=tsz, mono=True, ha="center", color=GOOD, weight="bold")
            else:
                box(ax, x, ly + 2, w, rh - 4, fc=tint(FAINT, 0.9), ec=MUTED, lw=0.6, r=3,
                    hatch="////", hatch_color=tint(MUTED, 0.55))
                text(ax, x + w / 2, ly + rh / 2, "−100", size=tsz, mono=True, ha="center", color=INK,
                     bbox=dict(boxstyle="round,pad=0.12", fc=tint(FAINT, 0.9), ec="none"))
            x += w + 3
        ry += rh * 3 + 22

    # brackets under the last row: prompt / response / pad
    ly = ry - 6
    box(ax, 108, ly, 26, 18, fc=tint(FAINT, 0.9), ec=MUTED, lw=0.6, r=3, hatch="////", hatch_color=tint(MUTED, 0.55))
    text(ax, 142, ly + 9, "−100: ignored by the loss (system, user, the assistant header, the trailing \\n, padding)", size=FS_SMALL)
    box(ax, 108, ly + 28, 26, 18, fc=tint(GOOD, 0.16), ec=GOOD, lw=1.1, r=3)
    text(ax, 142, ly + 37, "trained: the response tokens and its end-of-turn token <|im_end|>", size=FS_SMALL)
    text(ax, 108, ly + 64, "pad = <|endoftext|> (Qwen2.5's pad token), so masking pad by id never hits <|im_end|>.   "
         "The model shifts labels by one inside the loss.", size=FS_SMALL, color=MUTED)
    save(fig, out / "b1-pipeline.svg",
         "SFT data pipeline: messages, Qwen2.5 template text, token ids, and the labels row where prompt "
         "and padding positions are -100 and the response plus its end-of-turn token keep their ids.", prev)


# --------------------------------------------------------- prompt weight --

def b1_prompt_weight(out: Path, prev: Path | None):
    # Huerta-Enochian & Ko 2024 (arXiv 2401.13586), Table 3: quadratic fits of the
    # relative aggregate score in w_p = PLW**0.30103.
    fits = {
        "short": (-1.043, 5.590, -4.284),  # AlpacaDataShort, p < 0.001
        "long": (-0.131, 1.185, -0.917),   # AlpacaData, p = 0.237 (not significant)
    }
    tested = [0.0, 5e-4, 2.236e-3, 1e-2, 2.463e-2, 5e-2, 1e-1, 2.463e-1, 5e-1, 1.0]
    k = 0.30103
    W, H = 880, 470
    fig = figure(W, H)
    ax = px_axes(fig, 92, 46, 560, 330)
    style_axes(ax, grid_y=False)
    w = np.linspace(0, 1, 400)
    f = lambda c, x: c[0] + c[1] * x + c[2] * x * x  # noqa: E731
    lo, hi = 0.01 ** k, 0.5 ** k
    ax.axvspan(lo, hi, color=tint(GOLD, 0.10), lw=0, zorder=0)
    ax.text((lo + hi) / 2, 0.98, "small non-zero λ (0.01–0.5)", transform=ax.get_xaxis_transform(),
            ha="center", va="top", fontsize=FS_SMALL, color=GOLD)
    ax.plot(w, f(fits["long"], w), color=MUTED, lw=1.8, ls=(0, (5, 4)), zorder=2)
    ax.plot(w, f(fits["short"], w), color=ACCENT, lw=2.4, zorder=3)
    tw = np.array(tested) ** k
    ax.plot(tw, f(fits["short"], tw), "o", ms=6, mfc=WHITE, mec=ACCENT, mew=1.6, zorder=4)
    wpk = -fits["short"][1] / (2 * fits["short"][2])
    ypk = f(fits["short"], wpk)
    ax.plot([wpk], [ypk], "D", ms=7, color=ACCENT, zorder=5)
    ax.annotate(f"peak at λ ≈ {wpk ** (1 / k):.2f}", (wpk, ypk), xytext=(wpk + 0.03, ypk + 0.22),
                fontsize=FS, color=ACCENT, ha="left", va="bottom",
                arrowprops=dict(arrowstyle="-", color=ACCENT, lw=1))
    y0 = f(fits["short"], 0.0)
    ax.annotate("λ = 0: prompt fully masked", (0, y0), xytext=(0.04, y0 - 0.02), fontsize=FS_SMALL,
                color=INK, ha="left", va="center")
    y1 = f(fits["short"], 1.0)
    ax.annotate("λ = 1:\nno mask", (1, y1), xytext=(0.985, y1 - 0.30), fontsize=FS_SMALL, color=INK,
                ha="right", va="top", arrowprops=dict(arrowstyle="-", color=MUTED, lw=1))
    ax.set_xlim(-0.02, 1.02)
    ax.set_ylim(-1.25, 1.15)
    ticks = [0, 5e-4, 1e-2, 5e-2, 1e-1, 2.5e-1, 5e-1, 1]
    ax.set_xticks([t ** k for t in ticks])
    ax.set_xticklabels(["0", "0.0005", "0.01", "0.05", "0.1", "0.25", "0.5", "1"])
    ax.set_xticks([t ** k for t in tested], minor=True)
    ax.set_yticks([])
    ax.spines["left"].set_visible(True)
    ax.set_xlabel("prompt-loss weight λ (paper's PLW^0.301 scale; dots = tested values)", fontsize=FS)
    ax.set_ylabel("fitted downstream score (relative) →", fontsize=FS)
    # direct labels in the right margin
    fig.text(668 / W, 1 - (46 + 330 * (1.15 - f(fits["short"], 1.0)) / 2.4) / H, "short completions\n(AlpacaDataShort):\nsignificant, p < 0.001",
             fontsize=FS_SMALL, color=ACCENT, va="center")
    fig.text(668 / W, 1 - (46 + 330 * (1.15 - f(fits["long"], 1.0)) / 2.4 + 18) / H, "longer completions\n(AlpacaData):\nno significant trend,\np = 0.24",
             fontsize=FS_SMALL, color=MUTED, va="top")
    credit(fig, "Data: fitted quadratics from Huerta-Enochian & Ko 2024, Table 3 (LLaMA 1/2 7B, 13 benchmarks, min-max scaled)")
    save(fig, out / "b1-prompt-weight.svg",
         "Fitted downstream score versus prompt-loss weight for short-completion data: it rises from "
         "weight 0 to a peak near 0.24 and falls toward 1; longer-completion data shows no significant trend.", prev)


# --------------------------------------------------------------- packing --

def b1_packing(out: Path, prev: Path | None):
    lens = [100, 300, 900, 200]
    names = ["A", "B", "C", "D"]
    cols = [ACCENT, TEAL, PURPLE, GOLD]
    n = sum(lens)
    waste = 1 - n / (len(lens) * max(lens))
    within = sum(L * (L + 1) for L in lens)
    cross = 1 - within / (n * (n + 1))

    W, H = 980, 560
    fig, ax = canvas(W, H)
    sx = 470 / n          # px per token in the layout bars
    lx = 30
    # (a) padding
    y = 30
    text(ax, lx, y, "Padding", size=FS_TITLE, weight="bold")
    text(ax, lx + 80, y, f"each sequence padded to 900 tokens: {waste:.0%} of the batch is padding",
         size=FS_SMALL, color=MUTED)
    y += 18
    rowh = 16
    for i, L in enumerate(lens):
        yy = y + i * (rowh + 4)
        rect(ax, lx, yy, L * sx, rowh, fc=tint(cols[i], 0.75), ec=WHITE, lw=0.8)
        rect(ax, lx + L * sx, yy, (900 - L) * sx, rowh, fc=tint(FAINT, 0.9), ec=WHITE, lw=0.8,
             hatch="////", hatch_color=tint(MUTED, 0.6))
        text(ax, lx + 4, yy + rowh / 2, f"{names[i]} {L}", size=FS_SMALL - 1, color=WHITE if L > 150 else INK,
             weight="bold")
        if L < 150:
            pass
    text(ax, lx + 900 * sx + 8, y + 2 * (rowh + 4) - 2, "pad", size=FS_SMALL, color=MUTED)

    # (b) naive packing, (c) boundary-aware packing
    def packed_row(yy, label, sub, boundary):
        text(ax, lx, yy, label, size=FS_TITLE, weight="bold")
        text(ax, lx, yy + 20, sub, size=FS_SMALL, color=MUTED)
        by = yy + 34
        x = lx
        for i, L in enumerate(lens):
            rect(ax, x, by, L * sx, rowh, fc=tint(cols[i], 0.75), ec=WHITE, lw=1.0)
            text(ax, x + 4, by + rowh / 2, f"{names[i]}", size=FS_SMALL - 1, color=WHITE, weight="bold")
            x += L * sx
        # position_ids
        text(ax, lx, by + rowh + 16, "position_ids", size=FS_SMALL, color=MUTED, mono=True)
        x = lx
        if boundary:
            for i, L in enumerate(lens):
                text(ax, x + L * sx / 2 + 40, by + rowh + 34, f"0…{L - 1}", size=FS_SMALL, mono=True,
                     ha="center", color=INK)
                line(ax, [x, x], [by + rowh + 26, by + rowh + 42], color=MUTED, lw=1)
                x += L * sx
            line(ax, [x, x], [by + rowh + 26, by + rowh + 42], color=MUTED, lw=1)
        else:
            text(ax, lx + n * sx / 2, by + rowh + 34, f"0 … {n - 1} (one long sequence)", size=FS_SMALL,
                 mono=True, ha="center")

    packed_row(150, "Naive packing", "concatenate, one causal mask over the whole row", False)
    packed_row(300, "Boundary-aware packing", "position_ids restart; varlen attention stays inside each sequence", True)

    # attention matrices
    def attn(x0, y0, S, boundary):
        sc = S / n
        # whole causal triangle
        if not boundary:
            tri = np.array([[x0, y0], [x0, y0 + S], [x0 + S, y0 + S]])
            from matplotlib.patches import Polygon
            p = Polygon(tri, closed=True, fc=tint(CORAL, 0.22), ec="none", zorder=1, hatch="////")
            p.set_hatchcolor(CORAL) if hasattr(p, "set_hatchcolor") else None
            ax.add_patch(p)
        start = 0
        from matplotlib.patches import Polygon
        for i, L in enumerate(lens):
            a = x0 + start * sc
            b = y0 + start * sc
            tri = np.array([[a, b], [a, b + L * sc], [a + L * sc, b + L * sc]])
            ax.add_patch(Polygon(tri, closed=True, fc=tint(cols[i], 0.8), ec="none", zorder=2))
            start += L
        rect(ax, x0, y0, S, S, fc="none", ec=MUTED, lw=0.8, z=3)
        text(ax, x0 + S / 2, y0 - 9, "attention (query ↓, key →)", size=FS_SMALL - 1, color=MUTED, ha="center")

    S = 112
    attn(560, 162, S, False)
    text(ax, 560 + S + 12, 175, f"{cross:.0%} of causal", size=FS, color=CORAL, weight="bold")
    text(ax, 560 + S + 12, 193, "cells cross examples", size=FS_SMALL, color=CORAL)
    text(ax, 560 + S + 12, 211, "(hatched): A's tokens", size=FS_SMALL, color=INK)
    text(ax, 560 + S + 12, 229, "leak into B, C, D", size=FS_SMALL, color=INK)
    attn(560, 312, S, True)
    text(ax, 560 + S + 12, 325, "0% cross-example cells", size=FS, color=GOOD, weight="bold")
    text(ax, 560 + S + 12, 343, "0% padding", size=FS_SMALL, color=GOOD)
    text(ax, 560 + S + 12, 361, "block-diagonal mask", size=FS_SMALL, color=INK)

    # numbers
    text(ax, lx, 470, f"Lengths 100, 300, 900, 200 (1,500 tokens). Padding waste 1 − 1500/(4·900) = {waste:.0%}. "
                      f"Cross-example share 1 − Σnᵢ(nᵢ+1)/(n(n+1)) = {cross:.0%}.", size=FS_SMALL, color=INK)

    # throughput bars (HF blog)
    bx = px_axes(fig, 800, 120, 150, 250)
    style_axes(bx, grid_y=True)
    data = [("FLAN", 2.0), ("OrcaMath", 1.4)]
    xs = np.arange(len(data))
    bx.bar(xs - 0.2, [1, 1], width=0.36, color=tint(FAINT, 0.9), edgecolor=MUTED, lw=0.8,
           hatch="////", zorder=2)
    bx.bar(xs + 0.2, [d[1] for d in data], width=0.36, color=GOOD, zorder=2)
    for i, (_, v) in enumerate(data):
        bx.text(i + 0.2, v + 0.04, f"~{v:g}×", ha="center", va="bottom", fontsize=FS_SMALL, color=GOOD,
                fontweight="bold")
        bx.text(i - 0.2, 1.04, "1×", ha="center", va="bottom", fontsize=FS_SMALL, color=MUTED)
    bx.set_xticks(xs)
    bx.set_xticklabels([d[0] for d in data])
    bx.set_ylim(0, 2.4)
    bx.set_yticks([0, 1, 2])
    bx.set_yticklabels(["0", "1×", "2×"])
    fig.text(800 / W, 1 - 70 / H, "Training throughput", fontsize=FS_TITLE, fontweight="bold", va="top")
    fig.text(800 / W, 1 - 92 / H, "hatched: padding\nsolid: boundary-aware packing", fontsize=FS_SMALL,
             color=MUTED, va="top")
    fig.text(800 / W, 1 - 400 / H, "validation loss:\nidentical in both", fontsize=FS_SMALL, color=INK,
             va="top")
    credit(fig, "Layouts exact. Throughput: HF blog 'Packing with FlashAttention 2' (2024), "
                "Llama-2-7B, Mistral-7B, Granite-8B; values approximate")
    save(fig, out / "b1-packing.svg",
         "Four sequences of 100, 300, 900 and 200 tokens laid out with padding (58% waste), naive packing "
         "(58% of causal attention cells cross examples) and boundary-aware packing (position_ids restart, "
         "no cross-example attention); throughput about 2x on FLAN and 1.4x on OrcaMath with identical validation loss.", prev)


# ------------------------------------------------------ LIMA vs scaling --

def b2_lima_vs_scaling(out: Path, prev: Path | None):
    W, H = 960, 470
    fig = figure(W, H)
    # LIMA Fig. 6, values read from the vector figure in the arXiv PDF
    # (y axis 3.2-4.0; means and 95% CIs).
    x = np.array([2e3, 4e3, 8e3, 16e3, 32e3])
    mean = np.array([3.830, 3.860, 3.840, 3.830, 3.820])
    lo = np.array([3.759, 3.791, 3.770, 3.760, 3.748])
    hi = np.array([3.901, 3.929, 3.910, 3.900, 3.892])
    a1 = px_axes(fig, 80, 66, 340, 300)
    style_axes(a1, grid_y=True)
    a1.errorbar(x, mean, yerr=[mean - lo, hi - mean], fmt="o", ms=7, color=ACCENT, mfc=WHITE, mew=1.8,
                ecolor=ACCENT, elinewidth=1.4, capsize=4, zorder=3)
    a1.plot(x, mean, color=ACCENT, lw=1.2, alpha=0.5, zorder=2)
    a1.set_xscale("log", base=2)
    a1.set_xticks(x)
    a1.set_xticklabels(["2K", "4K", "8K", "16K", "32K"])
    a1.minorticks_off()
    a1.set_xlim(1.6e3, 40e3)
    a1.set_ylim(3.2, 4.0)
    a1.set_yticks([3.2, 3.4, 3.6, 3.8, 4.0])
    a1.set_xlabel("# training examples (quality-filtered Stack Exchange)")
    a1.set_ylabel("generation quality (1–6, ChatGPT-graded)")
    a1.text(8e3, 3.55, "16× more examples:\nno gain", ha="center", va="center", fontsize=FS, color=INK)
    fig.text(80 / W, 1 - 22 / H, "LIMA: more of the same kind of data", fontsize=FS_TITLE, fontweight="bold", va="top")
    fig.text(80 / W, 1 - 42 / H, "LLaMA 7B; dots = mean, bars = 95% CI", fontsize=FS_SMALL, color=MUTED, va="top")

    # Raghavendra et al. 2024, Table 7: P = a * D**(1/b), Llama-3 8B
    fits = [("Math (GSM8K)", 19.47, 7.66, 7500, ACCENT, "-"),
            ("Multihop QA (SubQA)", 11.54, 7.77, 2700, PURPLE, (0, (6, 3))),
            ("Code (HumanEval+)", 27.14, 23.43, 10000, GOLD, (0, (1.5, 2.5)))]
    a2 = px_axes(fig, 540, 66, 270, 300)
    style_axes(a2, grid_y=True)
    for name, a, b, dmax, col, ls in fits:
        d = np.logspace(2, np.log10(dmax), 100)
        a2.plot(d, a * d ** (1 / b), color=col, lw=2.4, ls=ls)
        yend = a * dmax ** (1 / b)
        fig.text((540 + 270 + 8) / W, 0, "", fontsize=1)
        a2.annotate(f"{name}\nslope {1 / b:.2f}", (dmax, yend), xytext=(10, 0), textcoords="offset points",
                    fontsize=FS_SMALL, color=col, va="center", annotation_clip=False)
    a2.set_xscale("log")
    a2.set_yscale("log")
    a2.set_xlim(90, 11000)
    a2.set_ylim(15, 80)
    a2.set_yticks([20, 30, 40, 60, 80])
    a2.set_yticklabels(["20", "30", "40", "60", "80"])
    a2.yaxis.set_minor_formatter(matplotlib_null())
    a2.set_xticks([100, 1000, 10000])
    a2.set_xticklabels(["100", "1K", "10K"])
    a2.set_xlabel("# fine-tuning examples")
    a2.set_ylabel("accuracy (%)")
    fig.text(540 / W, 1 - 22 / H, "Math, multihop, code: a power law", fontsize=FS_TITLE, fontweight="bold", va="top")
    fig.text(540 / W, 1 - 42 / H, "Llama-3 8B; fitted P = a·D^(1/b), log-log axes", fontsize=FS_SMALL, color=MUTED, va="top")
    credit(fig, "Data: LIMA (Zhou et al. 2023), Fig. 6, read from the vector figure; "
                "Raghavendra et al. 2024, Table 7 (fitted curves)")
    save(fig, out / "b2-lima-vs-scaling.svg",
         "Left: LIMA's quantity ablation, generation quality stays flat from 2K to 32K examples. Right: "
         "fitted power laws of accuracy versus number of fine-tuning examples for math, multihop QA and code "
         "(Llama-3 8B, log-log).", prev)


def matplotlib_null():
    from matplotlib.ticker import NullFormatter
    return NullFormatter()


# ----------------------------------------------------- expert iteration --

def b2_expert_iteration(out: Path, prev: Path | None):
    W, H = 960, 470
    fig, ax = canvas(W, H)
    bw, bh = 250, 112
    pos = {"sample": (30, 40), "verify": (360, 40), "keep": (360, 280), "sft": (30, 280)}
    spec = {
        "sample": ("1  Sample", ACCENT, ["n answers per prompt", "from the current model k", "(e.g. n = 8, temperature 0.8)"]),
        "verify": ("2  Verify / score", TEAL, ["checker: answer match,", "unit tests, tool execution;", "or a reward model"]),
        "keep": ("3  Keep the correct ones", GOOD, ["at most c per problem;", "prompts with no correct answer", "drop out (p ≈ 0 gives no data)"]),
        "sft": ("4  SFT", PURPLE, ["fine-tune on the kept answers", "→ model k + 1", "(same loss as B1)"]),
    }
    for key, (x, y) in pos.items():
        title, col, lines = spec[key]
        box(ax, x, y, bw, bh, fc=tint(col, 0.08), ec=col, lw=1.6, r=10)
        text(ax, x + 16, y + 24, title, size=FS_TITLE, weight="bold", color=col)
        for i, s in enumerate(lines):
            text(ax, x + 16, y + 52 + i * 20, s, size=FS_SMALL + 0.5, color=INK)
    # clockwise arrows
    arrow(ax, 30 + bw + 6, 96, 360 - 6, 96, lw=1.8)
    arrow(ax, 360 + bw / 2, 40 + bh + 6, 360 + bw / 2, 280 - 6, lw=1.8)
    arrow(ax, 360 - 6, 336, 30 + bw + 6, 336, lw=1.8)
    arrow(ax, 30 + bw / 2, 280 - 6, 30 + bw / 2, 40 + bh + 6, lw=1.8)
    text(ax, 30 + bw / 2 + 12, 216, "repeat with the new model", size=FS_SMALL, color=MUTED)
    text(ax, 320, 216, "expert iteration", size=FS_TITLE, color=INK, ha="center", weight="bold")
    text(ax, 320, 236, "(rejection-sampling SFT, looped)", size=FS_SMALL, color=MUTED, ha="center")

    # side notes
    nx = 650
    box(ax, nx, 40, 290, 112, fc="none", ec=MUTED, lw=1.0, r=8)
    text(ax, nx + 14, 62, "Llama 3", size=FS, weight="bold")
    for i, s in enumerate(["K samples per prompt; a reward model", "picks the best (best-of-K) → SFT,",
                           "then DPO; several rounds"]):
        text(ax, nx + 14, 86 + i * 19, s, size=FS_SMALL)
    box(ax, nx, 172, 290, 112, fc="none", ec=MUTED, lw=1.0, r=8)
    text(ax, nx + 14, 194, "DeepSeek-R1", size=FS, weight="bold")
    for i, s in enumerate(["after RL, rejection sampling gives", "~600k reasoning + ~200k other",
                           "samples → SFT"]):
        text(ax, nx + 14, 218 + i * 19, s, size=FS_SMALL)
    box(ax, nx, 304, 290, 88, fc="none", ec=MUTED, lw=1.0, r=8)
    text(ax, nx + 14, 326, "With a 0/1 reward", size=FS, weight="bold")
    for i, s in enumerate(["the SFT gradient = policy gradient,", "without baseline or negatives"]):
        text(ax, nx + 14, 350 + i * 19, s, size=FS_SMALL)
    credit(fig, "Recipes: Llama 3 (Meta, 2024); DeepSeek-R1 (DeepSeek-AI, 2025)")
    save(fig, out / "b2-expert-iteration.svg",
         "Expert iteration loop: sample n answers per prompt, verify or score, keep correct answers with a cap "
         "per problem, fine-tune, and repeat; notes on Llama 3 best-of-K and DeepSeek-R1's 600k + 200k samples.", prev)


# --------------------------------------------------------- distill vs RL --

def b2_distill_vs_rl(out: Path, prev: Path | None):
    # DeepSeek-R1 (arXiv 2501.12948), Table 6
    bench = ["AIME 2024\npass@1", "MATH-500\npass@1", "GPQA Diamond\npass@1", "LiveCodeBench\npass@1"]
    distill = [72.6, 94.3, 62.1, 57.2]
    rl = [47.0, 91.6, 55.0, 40.2]
    W, H = 900, 420
    fig = figure(W, H)
    ax = px_axes(fig, 140, 96, 600, 270)
    style_axes(ax, grid_x=True)
    y = np.arange(len(bench))[::-1]
    h = 0.36
    ax.barh(y + h / 2, distill, height=h, color=ACCENT, zorder=2)
    ax.barh(y - h / 2, rl, height=h, color=tint(GOLD, 0.25), edgecolor=GOLD, lw=1.0, hatch="///", zorder=2)
    for yi, d, r in zip(y, distill, rl):
        ax.text(d + 1, yi + h / 2, f"{d:.1f}", va="center", fontsize=FS, color=ACCENT, fontweight="bold")
        ax.text(r + 1, yi - h / 2, f"{r:.1f}", va="center", fontsize=FS, color=GOLD, fontweight="bold")
    ax.set_yticks(y)
    ax.set_yticklabels(bench, fontsize=FS_SMALL)
    ax.set_xlim(0, 100)
    ax.set_xlabel("score (%)")
    ax.spines["left"].set_visible(False)
    ax.tick_params(axis="y", length=0)
    # legend
    from matplotlib.patches import Patch
    leg = [Patch(fc=ACCENT, ec="none", label="Distillation: SFT on DeepSeek-R1's outputs  (R1-Distill-Qwen-32B)"),
           Patch(fc=tint(GOLD, 0.25), ec=GOLD, hatch="///", label="Large-scale RL on Qwen-32B-Base, >10K steps  (R1-Zero-Qwen-32B)")]
    fig.legend(handles=leg, loc="upper left", bbox_to_anchor=(140 / W, 1 - 18 / H), fontsize=FS,
               handlelength=2.2, handleheight=1.1, labelspacing=0.6)
    credit(fig, "Data: DeepSeek-R1 (DeepSeek-AI, 2025), Table 6")
    save(fig, out / "b2-distill-vs-rl.svg",
         "Same Qwen-32B base: distillation from DeepSeek-R1 scores 72.6 on AIME 2024 versus 47.0 for direct "
         "large-scale RL; also MATH-500, GPQA Diamond and LiveCodeBench.", prev)


# ------------------------------------------------------------ CPT pipeline --

def b2_cpt_pipeline(out: Path, prev: Path | None):
    W, H = 960, 520
    fig, ax = canvas(W, H)
    y, bh = 34, 128
    stages = [(20, 150, "Base model", MUTED, ["pretrained", "weights"]),
              (230, 330, "Continued pretraining", ACCENT, ["next-token loss on raw text,", "whole sequence, no chat", "template"]),
              (620, 150, "SFT", PURPLE, ["chat template,", "loss on responses"]),
              (830, 110, "Domain\nassistant", GOOD, [])]
    for x, w, title, col, lines in stages:
        box(ax, x, y, w, bh, fc=tint(col, 0.08), ec=col, lw=1.6, r=10)
        text(ax, x + 14, y + 24 if "\n" not in title else y + 34, title, size=FS_TITLE, weight="bold", color=col)
        for i, s in enumerate(lines):
            text(ax, x + 14, y + 50 + i * 19, s, size=FS_SMALL)
    for x0, x1 in [(170, 230), (560, 620), (770, 830)]:
        arrow(ax, x0 + 6, y + bh / 2, x1 - 6, y + bh / 2, lw=1.8)
    # data-mix bar inside the CPT box
    mx, my, mw = 244, y + 100, 300
    rect(ax, mx, my, mw * 0.7, 16, fc=ACCENT, ec=WHITE, lw=1)
    rect(ax, mx + mw * 0.7, my, mw * 0.3, 16, fc=tint(PURPLE, 0.25), ec=PURPLE, lw=1, hatch="///",
         hatch_color=PURPLE)
    text(ax, mx + 6, my + 8, "70% domain documents", size=FS_SMALL - 0.5, color=WHITE, weight="bold")
    text(ax, mx + mw * 0.7 + 6, my + 8, "30% chat", size=FS_SMALL - 0.5, color=PURPLE, weight="bold")

    # inset: Thinking Machines mid-training experiment
    ix, iy, iw, ih = 110, 250, 640, 200
    a = px_axes(fig, ix, iy, iw, ih)
    style_axes(a, grid_y=True)
    groups = ["Qwen3-8B\nbefore", "documents only\n(100%)", "70% documents\n+ 30% chat"]
    qa = [18, 43, 36]
    ife = [85, 45, 79]
    xs = np.arange(3)
    bw = 0.34
    a.bar(xs - bw / 2, qa, width=bw, color=tint(TEAL, 0.25), edgecolor=TEAL, hatch="..", lw=1.0, zorder=2)
    a.bar(xs + bw / 2, ife, width=bw, color=ACCENT, zorder=2)
    for xi, q, f in zip(xs, qa, ife):
        a.text(xi - bw / 2, q + 2, f"{q}%", ha="center", va="bottom", fontsize=FS_SMALL, color=TEAL, fontweight="bold")
        a.text(xi + bw / 2, f + 2, f"{f}%", ha="center", va="bottom", fontsize=FS_SMALL, color=ACCENT, fontweight="bold")
    a.set_xticks(xs)
    a.set_xticklabels(groups, fontsize=FS_SMALL)
    a.set_ylim(0, 100)
    a.set_yticks([0, 50, 100])
    a.set_yticklabels(["0", "50%", "100%"])
    a.tick_params(axis="x", length=0)
    text(ax, ix, iy - 30, "Mid-training a chat model on internal documents (Qwen3-8B)", size=FS_TITLE, weight="bold")
    # legend to the right
    lx = ix + iw + 28
    rect(ax, lx, iy + 30, 22, 14, fc=ACCENT)
    text(ax, lx + 30, iy + 37, "IF-eval", size=FS_SMALL, weight="bold", color=ACCENT)
    text(ax, lx + 30, iy + 55, "(instruction following)", size=FS_SMALL)
    rect(ax, lx, iy + 82, 22, 14, fc=tint(TEAL, 0.25), ec=TEAL, lw=1, hatch="..", hatch_color=TEAL)
    text(ax, lx + 30, iy + 89, "Internal QA", size=FS_SMALL, weight="bold", color=TEAL)
    text(ax, lx + 30, iy + 107, "(new knowledge)", size=FS_SMALL)
    text(ax, lx, iy + 146, "mixing chat data keeps", size=FS_SMALL)
    text(ax, lx, iy + 164, "most instruction following", size=FS_SMALL)
    credit(fig, "Data: Thinking Machines, 'On-Policy Distillation' (2025), mid-training table")
    save(fig, out / "b2-cpt-pipeline.svg",
         "Base model, continued pretraining on 70% domain documents mixed with 30% chat data, then SFT. Inset: "
         "IF-eval falls from 85% to 45% with documents only, and stays at 79% with the 70/30 mix.", prev)


# --------------------------------------------------------- tool-call mask --

TOOL_LINES = [
    # (segments, block id)
    ([("<|im_start|>", "sp"), ("system", "t"), ("\n", "nl")], "sys"),
    ([("You are a ticket-booking assistant.", "t"), ("\n", "nl"), ("\n", "nl")], "sys"),
    ([("# Tools … <tools>{\"type\": \"function\", \"function\": {\"name\": \"search_trains\", …}}</tools> …", "dim")], "sys"),
    ([("<|im_end|>", "eot"), ("\n", "nl")], "sys"),
    ([("<|im_start|>", "sp"), ("user", "t"), ("\n", "nl")], "user"),
    ([("Earliest high-speed train from Shanghai to Beijing tomorrow?", "t"), ("<|im_end|>", "eot"), ("\n", "nl")], "user"),
    ([("<|im_start|>", "sp"), ("assistant", "t"), ("\n", "nl")], "hdr1"),
    ([("<tool_call>", "t"), ("\n", "nl")], "call"),
    ([("{\"name\": \"search_trains\", \"arguments\": {\"from\": \"Shanghai\",", "t")], "call"),
    ([("  \"to\": \"Beijing\", \"date\": \"2026-10-11\"}}", "t"), ("\n", "nl")], "call"),
    ([("</tool_call>", "t"), ("<|im_end|>", "eot")], "call"),
    ([("\n", "nl")], "hdr2"),
    ([("<|im_start|>", "sp"), ("user", "t"), ("\n", "nl")], "tool"),
    ([("<tool_response>", "t"), ("\n", "nl")], "tool"),
    ([("[{\"train\": \"G2\", \"dep\": \"07:00\"}]", "t"), ("\n", "nl")], "tool"),
    ([("</tool_response>", "t"), ("<|im_end|>", "eot"), ("\n", "nl")], "tool"),
    ([("<|im_start|>", "sp"), ("assistant", "t"), ("\n", "nl")], "hdr3"),
    ([("The earliest is G2, departing at 07:00.", "t"), ("<|im_end|>", "eot")], "final"),
    ([("\n", "nl")], "tail"),
]


def b2_tool_call_mask(out: Path, prev: Path | None):
    W, H = 1000, 600
    fig, ax = canvas(W, H)
    size = 12
    cw = size * MONO_W
    lh = 26
    x0, y0 = 70, 36
    loss_blocks = {"call", "final"}
    y = y0
    block_rows: dict[str, list[float]] = {}
    for segs, blk in TOOL_LINES:
        spans = draw_mono_line(ax, x0, y, segs, size)
        if blk in loss_blocks:
            xa = min(a for a, _ in spans.values())
            xb = max(b for _, b in spans.values())
            # the trailing newline after <|im_end|> is not trained
            if segs[-1][1] == "nl" and segs[-2][1] == "eot" if len(segs) > 1 else False:
                xb = spans[len(segs) - 2][1]
            rect(ax, xa - 2, y - lh / 2 + 1, xb - xa + 4, lh - 2, fc=tint(GOOD, 0.14), z=0)
        block_rows.setdefault(blk, []).append(y)
        y += lh
    # left bars + right tags
    tags = {
        "sys": ("no loss", "system prompt + tool schema (abbreviated)"),
        "user": ("no loss", "user question"),
        "call": ("LOSS", "assistant tool call, incl. <|im_end|>"),
        "tool": ("no loss", "tool result: environment output"),
        "final": ("LOSS", "final answer, incl. <|im_end|>"),
    }
    tx = 660
    for blk, ys in block_rows.items():
        top, bot = min(ys) - lh / 2 + 2, max(ys) + lh / 2 - 2
        loss = blk in loss_blocks
        if loss:
            rect(ax, 40, top, 12, bot - top, fc=GOOD)
        else:
            rect(ax, 40, top, 12, bot - top, fc=tint(FAINT, 0.9), ec=MUTED, lw=0.6, hatch="////",
                 hatch_color=tint(MUTED, 0.7))
        if blk in tags:
            k, desc = tags[blk]
            ym = (top + bot) / 2
            line(ax, [tx - 18, tx - 8], [ym, ym], color=GOOD if loss else MUTED, lw=1.2)
            text(ax, tx, ym - 9, k, size=FS, weight="bold", color=GOOD if loss else MUTED)
            text(ax, tx, ym + 10, desc, size=FS_SMALL, color=INK)
    text(ax, 40, H - 40, "Qwen2.5 template (apply_chat_template(messages, tools=tools)); the tool message is rendered "
         "as a user turn wrapped in <tool_response>.", size=FS_SMALL, color=MUTED)
    text(ax, 40, H - 20, "Assistant headers and the newline after each <|im_end|> are not trained. "
         "Line breaks without \\n are display wraps.", size=FS_SMALL, color=MUTED)
    save(fig, out / "b2-tool-call-mask.svg",
         "A tool-calling conversation rendered with the Qwen2.5 chat template: the assistant's tool call and "
         "final answer (each with <|im_end|>) are trained; system, tool schema, user question and tool result are not.", prev)


# ---------------------------------------------------- InstructGPT overfit --

def b3_instructgpt_overfit(out: Path, prev: Path | None):
    W, H = 960, 380
    fig = figure(W, H)
    e = np.linspace(0.12, 16, 300)
    val = 2.0 * np.exp(-4 * e) + 0.0733 * 2.0 * e  # minimum at epoch 1 (schematic)
    rm = 1 - np.exp(-e / 3.5)
    hp = 1 - np.exp(-e / 5.0)
    panels = [("Validation loss", "lower is better", val, CORAL, True),
              ("Reward-model score", "higher is better", rm, ACCENT, False),
              ("Human preference", "higher is better", hp, GOOD, False)]
    for i, (title, sub, y, col, is_loss) in enumerate(panels):
        a = px_axes(fig, 50 + i * 305, 78, 255, 220)
        style_axes(a)
        a.plot(e, y, color=col, lw=2.6)
        a.axvline(1, color=MUTED, lw=1.0, ls=(0, (4, 3)))
        a.set_xlim(0, 16.5)
        a.set_xticks([1, 4, 8, 12, 16])
        a.set_yticks([])
        a.set_xlabel("SFT epoch")
        ymin, ymax = y.min(), y.max()
        pad = (ymax - ymin) * 0.12
        a.set_ylim(ymin - pad, ymax + pad)
        fig.text((50 + i * 305) / W, 1 - 26 / H, title, fontsize=FS_TITLE, fontweight="bold", color=col, va="top")
        fig.text((50 + i * 305) / W, 1 - 46 / H, sub, fontsize=FS_SMALL, color=MUTED, va="top")
        if is_loss:
            k = np.argmin(y)
            a.plot([e[k]], [y[k]], "o", ms=7, color=col)
            a.annotate("minimum after\nepoch 1, then rises", (e[k], y[k]), xytext=(4.2, y[k] + (ymax - ymin) * 0.42),
                       fontsize=FS_SMALL, color=INK, arrowprops=dict(arrowstyle="-", color=MUTED, lw=1))
        else:
            a.annotate("keeps rising\nthrough epoch 16", (14.5, np.interp(14.5, e, y)),
                       xytext=(5.6, ymin + (ymax - ymin) * 0.25), fontsize=FS_SMALL, color=INK,
                       arrowprops=dict(arrowstyle="-", color=MUTED, lw=1))
    credit(fig, "Schematic from the paper's description (Ouyang et al. 2022, InstructGPT, §3.5), not a redraw of a figure; "
                "16 epochs, final model chosen by RM score")
    save(fig, out / "b3-instructgpt-overfit.svg",
         "Schematic of InstructGPT's SFT: validation loss is lowest after epoch 1 and then rises, while the "
         "reward-model score and human preference keep improving over 16 epochs.", prev)


# --------------------------------------------------------- judge position --

def b3_judge_position(out: Path, prev: Path | None):
    # Zheng et al. 2023 (arXiv 2306.05685), Table 2: position bias of LLM judges
    rows = [("Claude-v1", "default", 23.8, 75.0, 0.0, 1.2),
            ("Claude-v1", "rename", 56.2, 11.2, 28.7, 3.8),
            ("GPT-3.5", "default", 46.2, 50.0, 1.2, 2.5),
            ("GPT-3.5", "rename", 51.2, 38.8, 6.2, 3.8),
            ("GPT-4", "default", 65.0, 30.0, 5.0, 0.0),
            ("GPT-4", "rename", 66.2, 28.7, 5.0, 0.0)]
    W, H = 920, 440
    fig = figure(W, H)
    ax = px_axes(fig, 170, 92, 700, 290)
    y = np.arange(len(rows))[::-1].astype(float)
    y[3:] -= 0.0
    segs = [("consistent after swapping order", GOOD, None, WHITE),
            ("favours the first answer", tint(CORAL, 0.30), "////", CORAL),
            ("favours the second answer", tint(GOLD, 0.30), "\\\\\\\\", GOLD),
            ("wrong output format", tint(MUTED, 0.30), "....", MUTED)]
    for yi, r in zip(y, rows):
        left = 0.0
        for k, (lab, fc, hatch, tc) in enumerate(segs):
            v = r[2 + k]
            if v <= 0:
                continue
            b = ax.barh(yi, v, left=left, height=0.62, color=fc, edgecolor=(WHITE if hatch is None else tc),
                        lw=0.8 if hatch else 0, hatch=hatch, zorder=2)
            if v >= 6:
                ax.text(left + v / 2, yi, f"{v:.1f}%", ha="center", va="center", fontsize=FS_SMALL,
                        color=WHITE if hatch is None else INK, fontweight="bold",
                        bbox=None if hatch is None else dict(boxstyle="round,pad=0.15", fc=WHITE, ec="none", alpha=0.85))
            left += v
    ax.set_yticks(y)
    ax.set_yticklabels([f"{j}  ·  {p}" for j, p, *_ in rows], fontsize=FS)
    ax.set_xlim(0, 100)
    ax.set_xticks([0, 25, 50, 75, 100])
    ax.set_xticklabels(["0", "25%", "50%", "75%", "100%"])
    ax.spines["left"].set_visible(False)
    ax.tick_params(axis="y", length=0)
    from matplotlib.patches import Patch
    handles = [Patch(fc=fc, ec=(tc if hatch else "none"), hatch=hatch, label=lab) for lab, fc, hatch, tc in segs]
    fig.legend(handles=handles, loc="upper left", bbox_to_anchor=(170 / W, 1 - 14 / H), ncol=2, fontsize=FS,
               handlelength=2.2, handleheight=1.1, columnspacing=1.6, labelspacing=0.5)
    fig.text(20 / W, 1 - 400 / H, "judge · prompt", fontsize=FS_SMALL, color=MUTED)
    fig.text(170 / W, 1 - 404 / H, "Pairwise judging; each pair judged twice with the answers' order swapped. "
             "'rename' = prompt that renames the assistants.", fontsize=FS_SMALL, color=MUTED, va="top")
    credit(fig, "Data: Zheng et al. 2023 (Judging LLM-as-a-Judge with MT-Bench and Chatbot Arena), Table 2")
    save(fig, out / "b3-judge-position.svg",
         "Position consistency of LLM judges when the two answers are swapped: Claude-v1 23.8%, GPT-3.5 46.2%, "
         "GPT-4 65.0% consistent with the default prompt; the rest mostly favour the first answer.", prev)


# -------------------------------------------------------------- eval layers --

def b3_eval_layers(out: Path, prev: Path | None):
    W, H = 940, 470
    fig, ax = canvas(W, H)
    layers = [
        ("1", "Task held-out set", ACCENT,
         ["same distribution as training", "decontaminated", "auto-checked: exact match, unit tests, JSON schema",
          "or a rubric", "size from the confidence interval"]),
        ("2", "General-capability regression", TEAL,
         ["IFEval", "MMLU", "GSM8K", "run before and after fine-tuning"]),
        ("3", "Safety and refusal regression", CORAL,
         ["harmful prompts: still refused", "benign prompts: still answered", "run before and after"]),
        ("4", "Evaluate the shipped artifact", PURPLE,
         ["same chat template", "same decoding and stop tokens", "the merged / quantised weights you deploy"]),
    ]
    x, w, h, gap = 30, 880, 92, 14
    y = 24
    for num, title, col, chips in layers:
        box(ax, x, y, w, h, fc=tint(col, 0.07), ec=col, lw=1.6, r=10)
        ax.add_patch(__import__("matplotlib.patches", fromlist=["Circle"]).Circle((x + 30, y + 30), 15, fc=col, ec="none", zorder=3))
        text(ax, x + 30, y + 30, num, size=FS_TITLE, color=WHITE, ha="center", weight="bold", z=4)
        text(ax, x + 58, y + 30, title, size=FS_TITLE + 1, weight="bold", color=col)
        cx = x + 58
        cy = y + 64
        for c in chips:
            cwid = len(c) * 7.4 + 20
            if cx + cwid > x + w - 12:
                cx = x + 58
                cy += 0  # one row only; widths chosen to fit
            box(ax, cx, cy - 12, cwid, 24, fc=WHITE, ec=tint(col, 0.6), lw=1.0, r=12)
            text(ax, cx + cwid / 2, cy, c, size=FS_SMALL, ha="center")
            cx += cwid + 8
        y += h + gap
    save(fig, out / "b3-eval-layers.svg",
         "Four evaluation layers: a task held-out set; general-capability regression (IFEval, MMLU, GSM8K); "
         "safety and refusal regression; evaluating the shipped artifact with the same template, decoding and "
         "merged or quantised weights.", prev)


# ------------------------------------------------------------ RL's Razor --

def b4_razor_scatter(out: Path, prev: Path | None):
    rng = np.random.default_rng(20250904)
    f = lambda k: 0.16 * k + 0.22 * k ** 2  # noqa: E731  schematic quadratic trend
    k_sft = np.sort(rng.uniform(0.08, 1.55, 34))
    y_sft = f(k_sft) + rng.normal(0, 0.035, k_sft.size)
    k_rl = np.sort(rng.uniform(0.02, 0.30, 22))
    y_rl = f(k_rl) + rng.normal(0, 0.02, k_rl.size)
    W, H = 900, 480
    fig = figure(W, H)
    ax = px_axes(fig, 80, 40, 560, 360)
    style_axes(ax)
    kk = np.linspace(0, 1.65, 200)
    ax.plot(kk, f(kk), color=INK, lw=1.4, ls=(0, (5, 4)), zorder=2)
    ax.scatter(k_sft, np.maximum(y_sft, 0.003), s=46, marker="o", facecolor=tint(CORAL, 0.25), edgecolor=CORAL,
               lw=1.4, zorder=3)
    ax.scatter(k_rl, np.maximum(y_rl, 0.003), s=60, marker="^", facecolor=ACCENT, edgecolor=WHITE, lw=0.8,
               zorder=4)
    ax.set_xlim(0, 1.7)
    ax.set_ylim(0, 0.95)
    ax.set_xticks([])
    ax.set_yticks([])
    ax.set_xlabel("KL(π₀ ‖ π) on new-task inputs  (base ‖ fine-tuned)  →", fontsize=FS)
    ax.set_ylabel("forgetting: drop in prior-task score  →", fontsize=FS)
    ax.annotate("one curve for both methods", (1.25, f(1.25)), xytext=(0.62, 0.78), fontsize=FS, color=INK,
                arrowprops=dict(arrowstyle="-", color=MUTED, lw=1))
    # legend / notes on the right
    fx = 660
    from matplotlib.lines import Line2D
    handles = [Line2D([], [], marker="^", ls="none", ms=9, mfc=ACCENT, mec=WHITE, label="RL (on-policy)"),
               Line2D([], [], marker="o", ls="none", ms=8, mfc=tint(CORAL, 0.25), mec=CORAL, mew=1.4, label="SFT"),
               Line2D([], [], color=INK, lw=1.4, ls=(0, (5, 4)), label="quadratic fit")]
    fig.legend(handles=handles, loc="upper left", bbox_to_anchor=(fx / W, 1 - 40 / H), fontsize=FS,
               labelspacing=0.8, handletextpad=0.6)
    notes = ["RL points sit at low KL:", "it reaches the new task", "with the smallest change", "in behaviour.", "",
             "SFT spreads along the", "same curve: forgetting", "follows KL, not the", "method.", "",
             "Fit quality in the paper:", "R² = 0.96 (ParityMNIST),", "R² = 0.71 (LLMs)."]
    for i, s in enumerate(notes):
        fig.text(fx / W, 1 - (160 + i * 19) / H, s, fontsize=FS_SMALL, color=INK, va="center")
    credit(fig, "Schematic redraw after RL's Razor (Shenfeld, Pari & Agrawal, 2025); values approximate")
    save(fig, out / "b4-razor-scatter.svg",
         "Schematic: forgetting versus KL divergence from the base model on the new task; SFT and RL points "
         "fall on one curve, with RL points clustered at low KL.", prev)


ALL = {
    "b1-chat-templates": b1_chat_templates,
    "b1-prompt-weight": b1_prompt_weight,
    "b1-packing": b1_packing,
    "b2-lima-vs-scaling": b2_lima_vs_scaling,
    "b2-expert-iteration": b2_expert_iteration,
    "b2-distill-vs-rl": b2_distill_vs_rl,
    "b2-cpt-pipeline": b2_cpt_pipeline,
    "b2-tool-call-mask": b2_tool_call_mask,
    "b3-instructgpt-overfit": b3_instructgpt_overfit,
    "b3-judge-position": b3_judge_position,
    "b3-eval-layers": b3_eval_layers,
    "b4-razor-scatter": b4_razor_scatter,
}
