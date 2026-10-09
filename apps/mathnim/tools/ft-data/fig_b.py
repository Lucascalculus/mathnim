"""Part B (SFT) figures. Called from figures.py; each function writes one SVG.

Numbers and their sources sit next to each figure. Paper redraws carry a corner
note in the figure; "Data: ..." means exact numbers, "Schematic redraw after
..." means shapes or values read from a plot. Sources were checked in
docs/lessons/llm-finetuning/research-sft.md (section 4).
"""
from __future__ import annotations

from pathlib import Path

import numpy as np
from matplotlib.lines import Line2D
from matplotlib.patches import Circle, Patch, Polygon

from fig_style import (ACCENT, CORAL, FAINT, FS, FS_SMALL, FS_TITLE, GOLD, GOOD, INK, MONO_W,
                       MUTED, PURPLE, TEAL, WHITE, arrow, box, canvas, credit, figure, line,
                       px_axes, rect, save, set_hatch_color, style_axes, text, text_width, tint)

# ------------------------------------------------------------ templates --
# Segments: (text, kind). kind: "t" plain text, "sp" special token, "eot"
# end-of-turn special token, "nl" a newline character (drawn as a muted \n),
# "dim" abbreviated material. Checked against Qwen2.5's own chat template by
# figures.py --verify.

QWEN_TURNS = [
    ("system", [[("<|im_start|>", "sp"), ("system", "t"), ("\n", "nl")],
                [("You are a helpful assistant.", "t"), ("<|im_end|>", "eot"), ("\n", "nl")]]),
    ("user", [[("<|im_start|>", "sp"), ("user", "t"), ("\n", "nl")],
              [("Name a prime number.", "t"), ("<|im_end|>", "eot"), ("\n", "nl")]]),
    ("assistant", [[("<|im_start|>", "sp"), ("assistant", "t"), ("\n", "nl")],
                   [("7 is prime.", "t"), ("<|im_end|>", "eot"), ("\n", "nl")]]),
]

# Llama 3 Instruct format (Meta's prompt-format docs); rendered by hand.
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


def draw_mono_line(ax, x, y, segs, size):
    """Draw one line of template text; returns {index: (x0, x1)} per segment."""
    cw = size * MONO_W
    spans = {}
    for i, (seg, kind) in enumerate(segs):
        s = _shown(seg, kind)
        w = len(s) * cw
        if kind in ("sp", "eot"):
            col = CORAL if kind == "eot" else ACCENT
            # inset by 1 px so neighbouring special tokens stay visibly separate
            box(ax, x + 1, y - size * 0.72, w - 2, size * 1.44, fc=tint(col, 0.12),
                ec=col if kind == "eot" else "none", lw=1.0, r=3, z=1)
            text(ax, x, y, s, size=size, color=col, mono=True,
                 weight="bold" if kind == "eot" else "normal", z=3)
        elif kind in ("nl", "dim"):
            text(ax, x, y, s, size=size, color=MUTED, mono=True, z=3)
        else:
            text(ax, x, y, s, size=size, color=INK, mono=True, z=3)
        spans[i] = (x, x + w)
        x += w
    return spans


def b1_chat_templates(out: Path, prev: Path | None):
    W, H = 980, 494
    fig, ax = canvas(W, H)
    size = 12.5
    lh = 25
    cq, cl = 120, 470
    text(ax, cq, 26, "ChatML · Qwen2.5", size=FS_TITLE, weight="bold")
    text(ax, cl, 26, "Llama 3 (Instruct format)", size=FS_TITLE, weight="bold")
    text(ax, cq, 46, "apply_chat_template(messages)", size=FS_SMALL, color=MUTED, mono=True)
    text(ax, cl, 46, "rendered by hand from Meta's prompt format", size=FS_SMALL, color=MUTED)

    eot_pos = {}
    y = 70
    for t in range(3):
        role = QWEN_TURNS[t][0]
        y0 = y
        for li in range(2):
            sq = draw_mono_line(ax, cq, y, QWEN_TURNS[t][1][li], size)
            sl = draw_mono_line(ax, cl, y, LLAMA_TURNS[t][1][li], size)
            if t == 2 and li == 1:
                eot_pos["q"] = (sq[1], y)
                eot_pos["l"] = (sl[1], y)
            y += lh
        line(ax, [100, 100], [y0 - 9, y - lh + 9], color=MUTED, lw=1.2)
        text(ax, 92, (y0 + y - lh) / 2, role, size=FS, color=INK, ha="right")
        y += 10

    # end-of-turn callouts (assistant turn)
    yb = y + 18
    for key, cx0, name, l2, l3, mono3 in [
            ("q", cq, "<|im_end|>", "the model must learn to emit it,", "so it stays in the labels", False),
            ("l", cl, "<|eot_id|>", "generation must stop on it:", "generation_config.eos_token_id", True)]:
        (x0, x1), ty = eot_pos[key]
        arrow(ax, (x0 + x1) / 2, yb - 8, (x0 + x1) / 2, ty + 11, color=CORAL, lw=1.3)
        text(ax, cx0, yb + 4, f"end-of-turn token: {name}", size=FS, color=CORAL, weight="bold")
        text(ax, cx0, yb + 24, l2, size=FS_SMALL)
        text(ax, cx0, yb + 42, l3, size=FS_SMALL, mono=mono3)

    # eos_token notes
    ny = yb + 66
    for x0, w, rows in [
            (cq, 320, [("Qwen2.5 base:  <|endoftext|>", True), ("(also its pad token)", False),
                       ("Qwen2.5 Instruct:  <|im_end|>", True),
                       ("SFT on the base: set eos to <|im_end|>", False)]),
            (cl, 400, [("Llama 3 base:  <|end_of_text|>", True), ("(no pad token)", False),
                       ("Llama 3 Instruct:  <|eot_id|>", True),
                       ("SFT on the base: set eos to <|eot_id|>", False)])]:
        box(ax, x0 - 8, ny, w, 114, fc=tint(GOLD, 0.08), ec=GOLD, lw=1.0, r=6)
        text(ax, x0 + 4, ny + 17, "tokenizer.eos_token", size=FS_SMALL, color=GOLD, mono=True, weight="bold")
        for i, (s, mono) in enumerate(rows):
            text(ax, x0 + 4, ny + 38 + i * 19, s, size=FS_SMALL, mono=mono, color=INK if mono or i == 3 else MUTED)

    # legend
    ly0 = H - 16
    box(ax, 20, ly0 - 9, 26, 18, fc=tint(ACCENT, 0.12), ec="none", r=3)
    text(ax, 52, ly0, "special token", size=FS_SMALL)
    box(ax, 160, ly0 - 9, 26, 18, fc=tint(CORAL, 0.12), ec=CORAL, lw=1.0, r=3)
    text(ax, 192, ly0, "end-of-turn token", size=FS_SMALL)
    text(ax, 330, ly0, "\\n", size=FS_SMALL, color=MUTED, mono=True)
    text(ax, 352, ly0, "= newline in the text; line breaks without \\n are display wraps", size=FS_SMALL)
    save(fig, out / "b1-chat-templates.svg",
         "The same system/user/assistant conversation rendered with the Qwen2.5 ChatML template and "
         "the Llama 3 format; special tokens highlighted; the end-of-turn tokens <|im_end|> and <|eot_id|> "
         "versus each tokenizer's eos_token.", prev)


# ------------------------------------------------------------- pipeline --
PIPE_MESSAGES = [
    {"role": "system", "content": "Be brief."},
    {"role": "user", "content": "Name a prime number."},
    {"role": "assistant", "content": "7 is prime."},
]
PIPE_PAD = ("<|endoftext|>", 151643)


def b1_pipeline(out: Path, prev: Path | None, tokens: list[tuple[str, int]]):
    W, H = 980, 584
    fig, ax = canvas(W, H)
    msz = 12
    cw = msz * MONO_W

    # 1. messages
    text(ax, 20, 22, "1  messages", size=FS_TITLE, weight="bold")
    mx, my = 20, 38
    mlines = ['[{"role": "system",    "content": "Be brief."},',
              ' {"role": "user",      "content": "Name a prime number."},',
              ' {"role": "assistant", "content": "7 is prime."}]']
    mw = max(len(s) for s in mlines) * cw + 24
    box(ax, mx, my, mw, 78, fc=tint(FAINT, 0.6), ec=MUTED, lw=1.0)
    for i, s in enumerate(mlines):
        text(ax, mx + 12, my + 18 + i * 21, s, size=msz, mono=True)

    # 2. template text
    tx = mx + mw + 64
    arrow(ax, mx + mw + 8, my + 39, tx - 8, my + 39, color=INK)
    text(ax, tx, 22, "2  template text", size=FS_TITLE, weight="bold")
    tlines = [[("<|im_start|>", "sp"), ("system", "t"), ("\n", "nl"), ("Be brief.", "t"), ("<|im_end|>", "eot"), ("\n", "nl")],
              [("<|im_start|>", "sp"), ("user", "t"), ("\n", "nl"), ("Name a prime number.", "t"), ("<|im_end|>", "eot"), ("\n", "nl")],
              [("<|im_start|>", "sp"), ("assistant", "t"), ("\n", "nl"), ("7 is prime.", "t"), ("<|im_end|>", "eot"), ("\n", "nl")]]
    tw = max(sum(len(_shown(s, k)) for s, k in ln) for ln in tlines) * cw + 24
    box(ax, tx, my, tw, 78, fc="none", ec=MUTED, lw=1.0)
    for i, ln in enumerate(tlines):
        draw_mono_line(ax, tx + 12, my + 18 + i * 21, ln, msz)

    # 3./4. tokens, ids, labels
    gy = 150
    text(ax, 20, gy, "3  tokenize    4  build labels", size=FS_TITLE, weight="bold")
    text(ax, 290, gy, "labels = input_ids, with −100 where no loss is taken", size=FS_SMALL, color=MUTED)
    resp_start = max(i + 3 for i in range(len(tokens) - 1)
                     if tokens[i][0] == "<|im_start|>" and tokens[i + 1][0] == "assistant")
    resp_end = next(i for i in range(resp_start, len(tokens)) if tokens[i][0] == "<|im_end|>")
    seq = [(s, tid, "resp" if resp_start <= i <= resp_end else "prompt") for i, (s, tid) in enumerate(tokens)]
    seq += [(PIPE_PAD[0], PIPE_PAD[1], "pad")] * 2

    tsz = 11.5
    tcw = tsz * MONO_W
    # one row per turn: break after each "<|im_end|>" + "\n"
    rows: list[list[tuple[str, int, str, float]]] = [[]]
    x0 = 104
    for i, (s, tid, kind) in enumerate(seq):
        shown = s.replace("\n", "\\n").replace(" ", "␣")
        w = max(len(shown), len(str(tid)), 4) * tcw + 10
        rows[-1].append((shown, tid, kind, w))
        if s == "\n" and i > 0 and seq[i - 1][0] == "<|im_end|>" and i < len(seq) - 3:
            rows.append([])
    assert all(x0 + sum(w + 3 for *_, w in row) <= W - 10 for row in rows), "token row too wide"
    ry = gy + 22
    rh = 25
    for row in rows:
        text(ax, 96, ry + rh * 0.5, "tokens", size=FS_SMALL, color=MUTED, ha="right")
        text(ax, 96, ry + rh * 1.5, "input_ids", size=FS_SMALL, color=MUTED, ha="right", mono=True)
        text(ax, 96, ry + rh * 2.5 + 2, "labels", size=FS_SMALL, color=INK, ha="right", mono=True, weight="bold")
        x = x0
        for shown, tid, kind, w in row:
            special = shown.startswith("<|")
            is_eot = shown == "<|im_end|>"
            fc = tint(FAINT, 0.9) if kind == "pad" else tint(ACCENT, 0.12) if special else tint(FAINT, 0.5)
            box(ax, x, ry + 2, w, rh - 4, fc=fc, ec=CORAL if is_eot else "none", lw=1.0, r=3)
            col = CORAL if is_eot else MUTED if kind == "pad" else ACCENT if special else INK
            text(ax, x + w / 2, ry + rh / 2, shown, size=tsz, mono=True, ha="center", color=col)
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
        ry += rh * 3 + 20

    ly = ry + 2
    box(ax, 104, ly, 26, 18, fc=tint(FAINT, 0.9), ec=MUTED, lw=0.6, r=3, hatch="////", hatch_color=tint(MUTED, 0.55))
    text(ax, 138, ly + 9, "−100: no loss (system, user, the assistant header, the newline after <|im_end|>, padding)",
         size=FS_SMALL)
    box(ax, 104, ly + 28, 26, 18, fc=tint(GOOD, 0.16), ec=GOOD, lw=1.1, r=3)
    text(ax, 138, ly + 37, "trained: the response tokens and its end-of-turn token <|im_end|>", size=FS_SMALL)
    text(ax, 104, ly + 64, "pad = <|endoftext|>, a different token from <|im_end|>, so masking pad by id leaves the "
         "end-of-turn label intact.", size=FS_SMALL, color=MUTED)
    text(ax, 104, ly + 84, "The model shifts labels by one inside the loss: the logits at position t are scored "
         "against labels[t + 1].", size=FS_SMALL, color=MUTED)
    credit(fig, "Token ids: Qwen2.5 tokenizer (Qwen/Qwen2.5-0.5B), real ids")
    save(fig, out / "b1-pipeline.svg",
         "SFT data pipeline: messages, Qwen2.5 template text, token ids, and the labels row where prompt "
         "and padding positions are -100 and the response plus its end-of-turn token keep their ids.", prev)


# --------------------------------------------------------- prompt weight --

def b1_prompt_weight(out: Path, prev: Path | None):
    # Huerta-Enochian & Ko 2024 (arXiv 2401.13586), Fig. 1(d): min-max relative
    # score on AlpacaDataShort, read from the plot (research-sft.md §4 item 25).
    plw = [0.0, 5e-4, 2.236e-3, 1e-2, 2.463e-2, 5e-2, 0.1, 0.2463, 0.5, 1.0]
    rel = {"LLaMA-1 7B": [0, .12, .28, .30, .53, .81, .92, 1.0, .68, .63],
           "LLaMA-2 7B": [0, .30, .45, .60, .89, 1.0, .86, .95, .84, .78]}
    k = 0.30103  # the paper's transform w = PLW**0.30103 (log10 2): 0 -> 0, 0.01 -> 0.25, 1 -> 1
    W, H = 900, 470
    fig = figure(W, H)
    ax = px_axes(fig, 80, 46, 580, 320)
    style_axes(ax, grid_y=True)
    wx = np.array(plw) ** k
    lo, hi = 0.01 ** k, 0.5 ** k
    ax.axvspan(lo, hi, color=tint(GOLD, 0.10), lw=0, zorder=0)
    ax.text((lo + hi) / 2, 1.08, "small non-zero λ (0.01–0.5)", ha="center", va="bottom", fontsize=FS_SMALL,
            color=GOLD)
    styles = {"LLaMA-1 7B": (ACCENT, "o", "-"), "LLaMA-2 7B": (PURPLE, "s", (0, (5, 3)))}
    for name, ys in rel.items():
        c, m, ls = styles[name]
        ax.plot(wx, ys, color=c, lw=2.2, ls=ls, marker=m, ms=6.5, mfc=WHITE, mec=c, mew=1.6, zorder=3)
    ax.annotate("λ = 0: prompt fully masked", (0.005, 0.0), xytext=(0.17, 0.03), fontsize=FS_SMALL, va="bottom",
                arrowprops=dict(arrowstyle="-", color=MUTED, lw=1))
    ax.annotate("λ = 1: no mask", (1, 0.7), xytext=(0.80, 0.30), fontsize=FS_SMALL, ha="center",
                arrowprops=dict(arrowstyle="-", color=MUTED, lw=1))
    ax.set_xlim(-0.02, 1.03)
    ax.set_ylim(-0.06, 1.16)
    ax.set_yticks([0, 0.5, 1])
    ax.set_yticklabels(["0 (min)", "0.5", "1 (max)"])
    ticks = [0, 5e-4, 1e-2, 5e-2, 1e-1, 2.5e-1, 5e-1, 1]
    ax.set_xticks([t ** k for t in ticks])
    ax.set_xticklabels(["0", "0.0005", "0.01", "0.05", "0.1", "0.25", "0.5", "1"])
    ax.set_xticks(list(wx), minor=True)
    ax.set_xlabel("prompt-loss weight λ (the paper's transformed scale; markers = tested values)")
    ax.set_ylabel("relative score (min-max scaled)")
    handles = [Line2D([], [], color=styles[n][0], ls=styles[n][2], marker=styles[n][1], ms=7, mfc=WHITE,
                      mec=styles[n][0], mew=1.6, lw=2.2, label=n) for n in rel]
    fig.legend(handles=handles, loc="upper left", bbox_to_anchor=(680 / W, 1 - 50 / H), fontsize=FS,
               labelspacing=0.8)
    notes = ["AlpacaDataShort:", "short completions,", "fine-tuned LLaMA 7B.", "",
             "Both models peak at a", "small non-zero λ and", "fall toward λ = 1.", "",
             "On long-generation", "benchmarks, λ ≈ 1 is", "better."]
    for i, s in enumerate(notes):
        fig.text(680 / W, 1 - (140 + i * 19) / H, s, fontsize=FS_SMALL, va="center",
                 fontweight="bold" if i == 0 else "normal")
    credit(fig, "Schematic redraw after Huerta-Enochian & Ko 2024, Fig. 1(d); values read from the plot, approximate")
    save(fig, out / "b1-prompt-weight.svg",
         "Relative downstream score versus prompt-loss weight on short-completion data (AlpacaDataShort): "
         "for LLaMA-1 and LLaMA-2 7B it rises from weight 0 to a peak between about 0.05 and 0.25 and falls toward 1.", prev)


# --------------------------------------------------------------- packing --

def b1_packing(out: Path, prev: Path | None):
    lens = [100, 300, 900, 200]
    names = ["A", "B", "C", "D"]
    cols = [ACCENT, TEAL, PURPLE, GOLD]
    n = sum(lens)
    waste = 1 - n / (len(lens) * max(lens))
    within = sum(L * (L + 1) for L in lens)
    cross = 1 - within / (n * (n + 1))

    W, H = 980, 540
    fig, ax = canvas(W, H)
    sx = 400 / n
    lx, bx0 = 30, 80
    rowh = 16

    # (a) padding
    text(ax, lx, 24, "Padding", size=FS_TITLE, weight="bold")
    text(ax, lx, 44, f"each sequence padded to 900 tokens: {waste:.0%} of the batch is padding", size=FS_SMALL, color=MUTED)
    y = 58
    for i, L in enumerate(lens):
        yy = y + i * (rowh + 4)
        text(ax, lx, yy + rowh / 2, f"{names[i]} {L}", size=FS_SMALL, weight="bold", color=INK)
        rect(ax, bx0, yy, L * sx, rowh, fc=tint(cols[i], 0.8), ec=WHITE, lw=0.8)
        rect(ax, bx0 + L * sx, yy, (900 - L) * sx, rowh, fc=tint(FAINT, 0.9), ec=WHITE, lw=0.8,
             hatch="////", hatch_color=tint(MUTED, 0.6))
    text(ax, bx0 + 900 * sx + 8, y + 2 * (rowh + 4) - 2, "hatched = pad", size=FS_SMALL, color=MUTED)

    def packed_row(yy, label, sub, pos_text):
        text(ax, lx, yy, label, size=FS_TITLE, weight="bold")
        text(ax, lx, yy + 20, sub, size=FS_SMALL, color=MUTED)
        by = yy + 34
        x = bx0
        for i, L in enumerate(lens):
            rect(ax, x, by, L * sx, rowh, fc=tint(cols[i], 0.8), ec=WHITE, lw=1.2)
            text(ax, x + 4, by + rowh / 2, names[i], size=FS_SMALL - 1, color=WHITE, weight="bold")
            x += L * sx
        text(ax, lx, by + rowh + 18, "position_ids", size=FS_SMALL, color=MUTED, mono=True)
        text(ax, lx + 100, by + rowh + 18, pos_text, size=FS_SMALL, mono=True)

    packed_row(176, "Naive packing", "concatenate; one causal mask over the whole row", "0 1 2 … 1499")
    packed_row(318, "Boundary-aware packing", "position_ids restart; varlen attention stays in each sequence",
               "0…99 | 0…299 | 0…899 | 0…199")

    def attn(x0, y0, S, boundary):
        sc = S / n
        if not boundary:
            p = Polygon([[x0, y0], [x0, y0 + S], [x0 + S, y0 + S]], closed=True, fc=tint(CORAL, 0.18),
                        ec="none", zorder=1, hatch="////")
            set_hatch_color(p, CORAL)
            ax.add_patch(p)
        start = 0
        for i, L in enumerate(lens):
            a, b = x0 + start * sc, y0 + start * sc
            ax.add_patch(Polygon([[a, b], [a, b + L * sc], [a + L * sc, b + L * sc]], closed=True,
                                 fc=tint(cols[i], 0.8), ec="none", zorder=2))
            start += L
        rect(ax, x0, y0, S, S, fc="none", ec=MUTED, lw=0.8, z=3)

    S = 104
    mx = 528
    text(ax, mx, 162, "attention mask (query ↓, key →)", size=FS_SMALL, color=MUTED)
    attn(mx, 176, S, False)
    tx = mx + S + 14
    text(ax, tx, 190, f"{cross:.0%} of causal cells", size=FS, color=CORAL, weight="bold")
    text(ax, tx, 209, "cross examples", size=FS, color=CORAL, weight="bold")
    text(ax, tx, 230, "(hatched): B attends", size=FS_SMALL)
    text(ax, tx, 248, "to A, C to A and B, …", size=FS_SMALL)
    attn(mx, 318, S, True)
    text(ax, tx, 332, "0% cross-example", size=FS, color=GOOD, weight="bold")
    text(ax, tx, 351, "0% padding", size=FS, color=GOOD, weight="bold")
    text(ax, tx, 372, "block-diagonal mask", size=FS_SMALL)
    text(ax, tx, 390, "(cu_seqlens)", size=FS_SMALL, mono=True)

    text(ax, lx, 452, f"Lengths 100, 300, 900, 200 (n = 1,500).  Padding waste = 1 − 1500/(4·900) = {waste:.0%}.",
         size=FS_SMALL)
    text(ax, lx, 472, f"Cross-example share = 1 − Σ nᵢ(nᵢ+1) / (n(n+1)) = {cross:.0%}.", size=FS_SMALL)

    # throughput bars (HF blog)
    fig.text(816 / W, 1 - 16 / H, "Throughput", fontsize=FS_TITLE, fontweight="bold", va="top")
    fig.text(816 / W, 1 - 38 / H, "vs padding = 1×", fontsize=FS_SMALL, color=MUTED, va="top")
    b = px_axes(fig, 850, 100, 118, 250)
    style_axes(b, grid_y=True)
    data = [("FLAN", 2.0), ("OrcaMath", 1.4)]
    xs = np.arange(len(data))
    b.bar(xs - 0.2, [1, 1], width=0.36, color=tint(FAINT, 0.9), edgecolor=MUTED, lw=0.8, hatch="////", zorder=2)
    b.bar(xs + 0.2, [d[1] for d in data], width=0.36, color=GOOD, zorder=2)
    for i, (_, v) in enumerate(data):
        b.text(i + 0.2, v + 0.05, f"~{v:g}×", ha="center", va="bottom", fontsize=FS_SMALL, color=GOOD, fontweight="bold")
    b.set_xticks(xs)
    b.set_xticklabels([d[0] for d in data])
    b.tick_params(axis="x", length=0)
    b.set_ylim(0, 2.4)
    b.set_yticks([0, 1, 2])
    b.set_yticklabels(["0", "1×", "2×"])
    for i, s in enumerate(["hatched: padding", "solid: boundary-", "aware packing", "", "validation loss:",
                           "identical"]):
        fig.text(816 / W, 1 - (390 + i * 18) / H, s, fontsize=FS_SMALL, va="center",
                 color=MUTED if i < 3 else INK)
    credit(fig, "Layouts and ratios exact. Throughput: HF blog 'Packing with FlashAttention 2' (2024); values approximate")
    save(fig, out / "b1-packing.svg",
         "Four sequences of 100, 300, 900 and 200 tokens laid out with padding (58% waste), naive packing "
         "(58% of causal attention cells cross examples) and boundary-aware packing (position_ids restart, "
         "no cross-example attention); throughput about 2x on FLAN and 1.4x on OrcaMath with identical validation loss.", prev)


# ------------------------------------------------------ LIMA vs scaling --

def b2_lima_vs_scaling(out: Path, prev: Path | None):
    from matplotlib.ticker import NullFormatter
    W, H = 960, 470
    fig = figure(W, H)
    # LIMA Fig. 6: values read from the vector figure in the arXiv PDF
    # (y axis 3.2-4.0; means and 95% CIs); matches research-sft.md §4 item 14.
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
    a1.text(8e3, 3.5, "16× more examples:\nno gain", ha="center", va="center", fontsize=FS, color=INK)
    fig.text(80 / W, 1 - 20 / H, "LIMA: more of the same kind of data", fontsize=FS_TITLE, fontweight="bold", va="top")
    fig.text(80 / W, 1 - 40 / H, "LLaMA 7B; dots = mean, bars = 95% CI", fontsize=FS_SMALL, color=MUTED, va="top")

    # Raghavendra et al. 2024, Table 7: P = a * D**(1/b), Llama-3 8B
    fits = [("Math (GSM8K)", 19.47, 7.66, 7500, ACCENT, "-"),
            ("Multihop QA (SubQA)", 11.54, 7.77, 2700, PURPLE, (0, (6, 3))),
            ("Code (HumanEval+)", 27.14, 23.43, 10000, GOLD, (0, (1.5, 2.5)))]
    a2 = px_axes(fig, 540, 66, 270, 300)
    style_axes(a2, grid_y=True)
    for name, a, b, dmax, col, ls in fits:
        d = np.logspace(2, np.log10(dmax), 100)
        a2.plot(d, a * d ** (1 / b), color=col, lw=2.4, ls=ls)
        a2.annotate(f"{name}\nslope {1 / b:.2f}", (dmax, a * dmax ** (1 / b)), xytext=(10, 0),
                    textcoords="offset points", fontsize=FS_SMALL, color=col, va="center", annotation_clip=False)
    a2.set_xscale("log")
    a2.set_yscale("log")
    a2.set_xlim(90, 11000)
    a2.set_ylim(15, 80)
    a2.set_yticks([20, 30, 40, 60, 80])
    a2.set_yticklabels(["20", "30", "40", "60", "80"])
    a2.yaxis.set_minor_formatter(NullFormatter())
    a2.set_xticks([100, 1000, 10000])
    a2.set_xticklabels(["100", "1K", "10K"])
    a2.set_xlabel("# fine-tuning examples")
    a2.set_ylabel("accuracy (%)")
    fig.text(540 / W, 1 - 20 / H, "Math, multihop, code: a power law", fontsize=FS_TITLE, fontweight="bold", va="top")
    fig.text(540 / W, 1 - 40 / H, "Llama-3 8B; fitted P = a·D^(1/b), log-log axes", fontsize=FS_SMALL, color=MUTED, va="top")
    credit(fig, "Data: LIMA (Zhou et al. 2023), Fig. 6, read from the vector figure (±0.01); "
                "Raghavendra et al. 2024, Table 7 (fitted curves)")
    save(fig, out / "b2-lima-vs-scaling.svg",
         "Left: LIMA's quantity ablation, generation quality stays flat from 2K to 32K examples. Right: "
         "fitted power laws of accuracy versus number of fine-tuning examples for math, multihop QA and code "
         "(Llama-3 8B, log-log).", prev)


# ----------------------------------------------------- expert iteration --

def b2_expert_iteration(out: Path, prev: Path | None):
    W, H = 960, 440
    fig, ax = canvas(W, H)
    bw, bh = 250, 112
    pos = {"sample": (30, 30), "verify": (360, 30), "keep": (360, 270), "sft": (30, 270)}
    spec = {
        "sample": ("1  Sample", ACCENT, ["n answers per prompt", "from the current model k", "(e.g. n = 8, temperature 0.8)"]),
        "verify": ("2  Verify / score", TEAL, ["checker: answer match,", "unit tests, tool execution;", "or a reward model"]),
        "keep": ("3  Keep the correct ones", GOOD, ["at most c per problem;", "prompts with no correct answer", "drop out (p ≈ 0 gives no data)"]),
        "sft": ("4  SFT", PURPLE, ["fine-tune on the kept answers", "→ model k + 1", "(the same loss as B1)"]),
    }
    for key, (x, y) in pos.items():
        title, col, lines = spec[key]
        box(ax, x, y, bw, bh, fc=tint(col, 0.08), ec=col, lw=1.6, r=10)
        text(ax, x + 16, y + 24, title, size=FS_TITLE, weight="bold", color=col)
        for i, s in enumerate(lines):
            text(ax, x + 16, y + 52 + i * 20, s, size=FS_SMALL + 0.5, color=INK)
    cy = (30 + bh + 270) / 2
    arrow(ax, 30 + bw + 6, 30 + bh / 2, 360 - 6, 30 + bh / 2, lw=1.8)
    arrow(ax, 360 + bw / 2, 30 + bh + 6, 360 + bw / 2, 270 - 6, lw=1.8)
    arrow(ax, 360 - 6, 270 + bh / 2, 30 + bw + 6, 270 + bh / 2, lw=1.8)
    arrow(ax, 30 + bw / 2, 270 - 6, 30 + bw / 2, 30 + bh + 6, lw=1.8)
    text(ax, 320, cy - 12, "expert iteration", size=FS_TITLE, ha="center", weight="bold")
    text(ax, 320, cy + 10, "rejection-sampling SFT, repeated", size=FS_SMALL, ha="center", color=MUTED)
    text(ax, 320, cy + 28, "with the new model", size=FS_SMALL, ha="center", color=MUTED)

    nx, nw = 650, 290
    notes = [("Llama 3", ["K = 10–30 samples per prompt;", "a reward model picks the best", "→ SFT, then DPO; six rounds"]),
             ("DeepSeek-R1", ["after RL, rejection sampling gives", "~600k reasoning + ~200k other", "samples → SFT"]),
             ("With a 0/1 reward", ["the SFT gradient = a policy", "gradient without baseline", "or negative samples"])]
    for i, (title, lines) in enumerate(notes):
        y = 30 + i * 124
        box(ax, nx, y, nw, 112, fc="none", ec=MUTED, lw=1.0, r=8)
        text(ax, nx + 14, y + 22, title, size=FS, weight="bold")
        for j, s in enumerate(lines):
            text(ax, nx + 14, y + 48 + j * 19, s, size=FS_SMALL)
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
    leg = [Patch(fc=ACCENT, ec="none", label="Distillation: SFT on DeepSeek-R1's outputs  (R1-Distill-Qwen-32B)"),
           Patch(fc=tint(GOLD, 0.25), ec=GOLD, hatch="///", label="Large-scale RL on Qwen-32B-Base, >10K steps  (R1-Zero-Qwen-32B)")]
    fig.legend(handles=leg, loc="upper left", bbox_to_anchor=(140 / W, 1 - 14 / H), fontsize=FS,
               handlelength=2.2, handleheight=1.1, labelspacing=0.6)
    credit(fig, "Data: DeepSeek-R1 (DeepSeek-AI, 2025), Table 6; the same Qwen-32B base for both")
    save(fig, out / "b2-distill-vs-rl.svg",
         "Same Qwen-32B base: distillation from DeepSeek-R1 scores 72.6 on AIME 2024 versus 47.0 for direct "
         "large-scale RL; also MATH-500, GPQA Diamond and LiveCodeBench.", prev)


# ------------------------------------------------------------ CPT pipeline --

def b2_cpt_pipeline(out: Path, prev: Path | None):
    W, H = 960, 500
    fig, ax = canvas(W, H)
    y, bh = 26, 112
    stages = [(20, 150, "Base model", MUTED, ["pretrained", "weights"]),
              (220, 350, "Continued pretraining", ACCENT, ["next-token loss on raw text,", "whole sequence, no template"]),
              (630, 160, "SFT", PURPLE, ["chat template,", "loss on responses"]),
              (850, 92, "Domain\nassistant", GOOD, [])]
    for x, w, title, col, lines in stages:
        box(ax, x, y, w, bh, fc=tint(col, 0.08), ec=col, lw=1.6, r=10)
        if "\n" in title:
            text(ax, x + w / 2, y + bh / 2, title, size=FS_TITLE, weight="bold", color=col, ha="center",
                 multialignment="center")
        else:
            text(ax, x + 14, y + 24, title, size=FS_TITLE, weight="bold", color=col)
        for i, s in enumerate(lines):
            text(ax, x + 14, y + 50 + i * 19, s, size=FS_SMALL)
    for x0, x1 in [(170, 220), (570, 630), (790, 850)]:
        arrow(ax, x0 + 5, y + bh / 2, x1 - 5, y + bh / 2, lw=1.8)
    mx, my, mw = 234, y + 84, 320
    rect(ax, mx, my, mw * 0.7, 16, fc=ACCENT, ec=WHITE, lw=1)
    rect(ax, mx + mw * 0.7, my, mw * 0.3, 16, fc=tint(PURPLE, 0.25), ec=PURPLE, lw=1)
    text(ax, mx + 6, my + 8, "70% domain documents", size=FS_SMALL - 0.5, color=WHITE, weight="bold")
    text(ax, mx + mw * 0.7 + 6, my + 8, "30% chat", size=FS_SMALL - 0.5, color=PURPLE, weight="bold")

    # inset: Thinking Machines mid-training experiment (research-sft.md §2 item 2)
    ix, iy, iw, ih = 90, 220, 660, 210
    text(ax, 20, iy - 40, "Mid-training a post-trained Qwen3-8B on internal documents", size=FS_TITLE, weight="bold")
    text(ax, 20, iy - 20, "no data mix keeps the original 85% on IF-eval", size=FS_SMALL, color=MUTED)
    a = px_axes(fig, ix, iy, iw, ih)
    style_axes(a, grid_y=True)
    groups = ["Qwen3-8B\nbefore", "100% documents", "70% documents\n+ 30% chat", "70/30, then on-policy\ndistillation"]
    qa = [18, 43, 36, 41]
    ife = [85, 45, 79, 83]
    xs = np.arange(len(groups))
    bw = 0.34
    a.bar(xs - bw / 2, qa, width=bw, color=tint(TEAL, 0.25), edgecolor=TEAL, hatch="\\\\\\", lw=1.0, zorder=2)
    a.bar(xs + bw / 2, ife, width=bw, color=ACCENT, zorder=2)
    for xi, q, f in zip(xs, qa, ife):
        a.text(xi - bw / 2, q + 2, f"{q}%", ha="center", va="bottom", fontsize=FS_SMALL, color=TEAL, fontweight="bold")
        a.text(xi + bw / 2, f + 2, f"{f}%", ha="center", va="bottom", fontsize=FS_SMALL, color=ACCENT, fontweight="bold",
               bbox=dict(boxstyle="round,pad=0.1", fc=WHITE, ec="none"), zorder=4)
    a.axhline(85, color=ACCENT, lw=1.0, ls=(0, (3, 3)), zorder=1)
    a.set_xticks(xs)
    a.set_xticklabels(groups, fontsize=FS_SMALL)
    a.set_ylim(0, 100)
    a.set_yticks([0, 50, 100])
    a.set_yticklabels(["0", "50%", "100%"])
    a.tick_params(axis="x", length=0)
    lx = ix + iw + 24
    rect(ax, lx, iy + 20, 22, 14, fc=ACCENT)
    text(ax, lx + 30, iy + 27, "IF-eval", size=FS_SMALL, weight="bold", color=ACCENT)
    text(ax, lx + 30, iy + 45, "(instruction", size=FS_SMALL)
    text(ax, lx + 30, iy + 63, "following)", size=FS_SMALL)
    rect(ax, lx, iy + 92, 22, 14, fc=tint(TEAL, 0.25), ec=TEAL, lw=1, hatch="\\\\\\", hatch_color=TEAL)
    text(ax, lx + 30, iy + 99, "Internal QA", size=FS_SMALL, weight="bold", color=TEAL)
    text(ax, lx + 30, iy + 117, "(new knowledge)", size=FS_SMALL)
    line(ax, [lx, lx + 22], [iy + 150, iy + 150], color=ACCENT, lw=1.0, ls=(0, (3, 3)))
    text(ax, lx + 30, iy + 150, "85% before", size=FS_SMALL)
    credit(fig, "Data: Thinking Machines, 'On-Policy Distillation' (2025), mid-training table")
    save(fig, out / "b2-cpt-pipeline.svg",
         "Base model, continued pretraining on 70% domain documents mixed with 30% chat data, then SFT. Inset: "
         "mid-training Qwen3-8B on documents drops IF-eval from 85% to 45%; the 70/30 mix keeps 79%; on-policy "
         "distillation brings it to 83%.", prev)


# --------------------------------------------------------- tool-call mask --
# English version of the B2 example; text checked against Qwen2.5's template
# (apply_chat_template(messages, tools=tools)); the tool block is abbreviated.
TOOL_LINES = [
    ([("<|im_start|>", "sp"), ("system", "t"), ("\n", "nl")], "sys"),
    ([("You are a ticket-booking assistant.", "t"), ("\n", "nl"), ("\n", "nl")], "sys"),
    ([("# Tools … <tools>{… \"name\": \"search_trains\" …}</tools> …", "dim")], "sys"),
    ([("</tool_call>", "t"), ("<|im_end|>", "eot"), ("\n", "nl")], "sys"),
    ([("<|im_start|>", "sp"), ("user", "t"), ("\n", "nl")], "user"),
    ([("Earliest high-speed train from Shanghai to Beijing tomorrow?", "t"), ("<|im_end|>", "eot"), ("\n", "nl")], "user"),
    ([("<|im_start|>", "sp"), ("assistant", "t"), ("\n", "nl")], "hdr1"),
    ([("<tool_call>", "t"), ("\n", "nl")], "call"),
    ([("{\"name\": \"search_trains\", \"arguments\": {\"from\": \"Shanghai\",", "t")], "call"),
    ([("\"to\": \"Beijing\", \"date\": \"2026-10-11\"}}", "t"), ("\n", "nl")], "call"),
    ([("</tool_call>", "t"), ("<|im_end|>", "eot"), ("\n", "nl")], "call"),
    ([("<|im_start|>", "sp"), ("user", "t"), ("\n", "nl")], "tool"),
    ([("<tool_response>", "t"), ("\n", "nl")], "tool"),
    ([("[{\"train\": \"G2\", \"dep\": \"07:00\"}]", "t"), ("\n", "nl")], "tool"),
    ([("</tool_response>", "t"), ("<|im_end|>", "eot"), ("\n", "nl")], "tool"),
    ([("<|im_start|>", "sp"), ("assistant", "t"), ("\n", "nl")], "hdr3"),
    ([("The earliest is G2, departing at 07:00.", "t"), ("<|im_end|>", "eot"), ("\n", "nl")], "final"),
]


def b2_tool_call_mask(out: Path, prev: Path | None):
    W, H = 980, 560
    fig, ax = canvas(W, H)
    size = 12
    lh = 26
    x0, y0 = 70, 30
    loss_blocks = {"call", "final"}
    y = y0
    block_rows: dict[str, list[float]] = {}
    for segs, blk in TOOL_LINES:
        spans = draw_mono_line(ax, x0, y, segs, size)
        if blk in loss_blocks:
            xa = spans[0][0]
            last = len(segs) - 1
            # the newline after <|im_end|> is not trained
            if segs[last][1] == "nl" and last >= 1 and segs[last - 1][1] == "eot":
                last -= 1
            xb = spans[last][1]
            rect(ax, xa - 2, y - lh / 2 + 1, xb - xa + 4, lh - 2, fc=tint(GOOD, 0.14), z=0)
        block_rows.setdefault(blk, []).append(y)
        y += lh
    tags = {
        "sys": ("no loss", "system prompt + tool schema", "(schema abbreviated)"),
        "user": ("no loss", "user question", ""),
        "call": ("LOSS", "assistant tool call,", "incl. <|im_end|>"),
        "tool": ("no loss", "tool result: environment output,", "rendered as a user turn"),
        "final": ("LOSS", "final answer, incl. <|im_end|>", ""),
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
            k, d1, d2 = tags[blk]
            ym = (top + bot) / 2
            nlines = 2 if d2 else 1
            yk = ym - 9 * nlines
            line(ax, [tx - 20, tx - 8], [ym, ym], color=GOOD if loss else MUTED, lw=1.2)
            text(ax, tx, yk, k, size=FS, weight="bold", color=GOOD if loss else MUTED)
            text(ax, tx, yk + 19, d1, size=FS_SMALL)
            if d2:
                text(ax, tx, yk + 37, d2, size=FS_SMALL)
    text(ax, 40, H - 38, "Qwen2.5 template: apply_chat_template(messages, tools=tools). The untagged hatched rows "
         "(assistant headers) are not trained either,", size=FS_SMALL, color=MUTED)
    text(ax, 40, H - 18, "nor is the newline after each <|im_end|>. Line breaks without \\n are display wraps.",
         size=FS_SMALL, color=MUTED)
    save(fig, out / "b2-tool-call-mask.svg",
         "A tool-calling conversation rendered with the Qwen2.5 chat template: the assistant's tool call and "
         "final answer (each with <|im_end|>) are trained; system, tool schema, user question and tool result are not.", prev)


# ---------------------------------------------------- InstructGPT overfit --

def b3_instructgpt_overfit(out: Path, prev: Path | None):
    W, H = 960, 380
    fig = figure(W, H)
    e = np.linspace(0, 16, 400)
    val = np.where(e < 1, 1.0 + 0.6 * (1 - e) ** 2, 1.0 + 0.30 * (1 - np.exp(-(e - 1) / 6)))  # schematic
    rm = 1 - np.exp(-(e + 0.3) / 3.5)
    hp = 1 - np.exp(-(e + 0.3) / 5.0)
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
            k = int(np.argmin(y))
            a.plot([e[k]], [y[k]], "o", ms=7, color=col)
            a.annotate("lowest after epoch 1,\nthen rises (overfits)", (e[k], y[k]),
                       xytext=(4.0, ymin + (ymax - ymin) * 0.62), fontsize=FS_SMALL,
                       arrowprops=dict(arrowstyle="-", color=MUTED, lw=1))
        else:
            a.annotate("keeps rising\nthrough epoch 16", (14.5, np.interp(14.5, e, y)),
                       xytext=(5.6, ymin + (ymax - ymin) * 0.25), fontsize=FS_SMALL,
                       arrowprops=dict(arrowstyle="-", color=MUTED, lw=1))
    credit(fig, "Schematic from the paper's description (Ouyang et al. 2022, InstructGPT, §3.5), not a redraw of a "
                "figure; final model chosen by RM score")
    save(fig, out / "b3-instructgpt-overfit.svg",
         "Schematic of InstructGPT's SFT: validation loss is lowest after epoch 1 and then rises, while the "
         "reward-model score and human preference keep improving over 16 epochs.", prev)


# --------------------------------------------------------- judge position --

def b3_judge_position(out: Path, prev: Path | None):
    # Zheng et al. 2023 (arXiv 2306.05685), Table 2: position bias of LLM judges
    # on 80 MT-bench first-turn pairs (research-sft.md §4 item 9).
    rows = [("Claude-v1", "default", 23.8, 75.0, 0.0, 1.2),
            ("Claude-v1", "rename", 56.2, 11.2, 28.7, 3.8),
            ("GPT-3.5", "default", 46.2, 50.0, 1.2, 2.5),
            ("GPT-3.5", "rename", 51.2, 38.8, 6.2, 3.8),
            ("GPT-4", "default", 65.0, 30.0, 5.0, 0.0),
            ("GPT-4", "rename", 66.2, 28.7, 5.0, 0.0)]
    W, H = 940, 470
    fig = figure(W, H)
    ax = px_axes(fig, 170, 96, 570, 290)
    y = np.arange(len(rows))[::-1].astype(float)
    segs = [("consistent after swapping order", "cons", GOOD, None, WHITE),
            ("favours the first answer", "first", tint(CORAL, 0.30), "////", CORAL),
            ("favours the second answer", "second", tint(GOLD, 0.30), "\\\\\\\\", GOLD),
            ("wrong output format", "error", tint(MUTED, 0.30), "||||", MUTED)]
    for yi, r in zip(y, rows):
        left = 0.0
        small = []
        for k, (lab, short, fc, hatch, tc) in enumerate(segs):
            v = r[2 + k]
            if v > 0:
                ax.barh(yi, v, left=left, height=0.62, color=fc, edgecolor=(WHITE if hatch is None else tc),
                        lw=0.8 if hatch else 0, hatch=hatch, zorder=2)
            if v >= 8:
                ax.text(left + v / 2, yi, f"{v:.1f}%", ha="center", va="center", fontsize=FS_SMALL,
                        color=WHITE if hatch is None else INK, fontweight="bold",
                        bbox=None if hatch is None else dict(boxstyle="round,pad=0.15", fc=WHITE, ec="none", alpha=0.9))
            elif k > 0 and v > 0:
                small.append(f"{short} {v:.1f}%")
            left += v
        ax.text(101.5, yi, "  ·  ".join(small), ha="left", va="center", fontsize=FS_SMALL, color=MUTED)
    ax.set_yticks(y)
    ax.set_yticklabels([f"{j}  ·  {p}" for j, p, *_ in rows], fontsize=FS)
    ax.set_xlim(0, 100)
    ax.set_xticks([0, 25, 50, 75, 100])
    ax.set_xticklabels(["0", "25%", "50%", "75%", "100%"])
    ax.spines["left"].set_visible(False)
    ax.tick_params(axis="y", length=0)
    handles = [Patch(fc=fc, ec=(tc if hatch else "none"), hatch=hatch, label=lab) for lab, _, fc, hatch, tc in segs]
    fig.legend(handles=handles, loc="upper left", bbox_to_anchor=(170 / W, 1 - 12 / H), ncol=2, fontsize=FS,
               handlelength=2.2, handleheight=1.1, columnspacing=1.6, labelspacing=0.5)
    fig.text(170 / W, 1 - 412 / H, "80 MT-bench pairs, each judged twice with the two answers' order swapped; "
             "default / rename = two judge prompts.", fontsize=FS_SMALL, color=MUTED, va="top")
    credit(fig, "Data: Zheng et al. 2023 (Judging LLM-as-a-Judge with MT-Bench and Chatbot Arena), Table 2")
    save(fig, out / "b3-judge-position.svg",
         "Position consistency of LLM judges when the two answers are swapped: Claude-v1 23.8%, GPT-3.5 46.2%, "
         "GPT-4 65.0% consistent with the default prompt; most of the rest favours the first answer.", prev)


# -------------------------------------------------------------- eval layers --

def b3_eval_layers(out: Path, prev: Path | None):
    W = 940
    layers = [
        ("1", "Task held-out set", ACCENT,
         ["same distribution as training", "decontaminated", "auto-checked: exact match, unit tests, JSON schema",
          "or a rubric", "size set by the confidence interval"]),
        ("2", "General-capability regression", TEAL,
         ["IFEval", "MMLU", "GSM8K", "run before and after fine-tuning"]),
        ("3", "Safety and refusal regression", CORAL,
         ["harmful prompts: still refused", "benign prompts: still answered", "run before and after"]),
        ("4", "Evaluate the shipped artifact", PURPLE,
         ["same chat template", "same decoding and stop tokens", "the merged / quantised weights you deploy"]),
    ]
    x, w, gap = 30, 880, 14
    chip_h, chip_gap = 24, 8
    plans = []
    for num, title, col, chips in layers:
        rows = [[]]
        cx = x + 58
        for c in chips:
            cw = text_width(c, FS_SMALL) + 22
            if cx + cw > x + w - 14 and rows[-1]:
                rows.append([])
                cx = x + 58
            rows[-1].append((c, cx, cw))
            cx += cw + chip_gap
        plans.append((num, title, col, rows, 52 + len(rows) * (chip_h + 8) + 6))
    H = 20 + sum(p[4] for p in plans) + gap * (len(plans) - 1) + 20
    fig, ax = canvas(W, H)
    y = 20
    for num, title, col, rows, h in plans:
        box(ax, x, y, w, h, fc=tint(col, 0.07), ec=col, lw=1.6, r=10)
        ax.add_patch(Circle((x + 30, y + 28), 15, fc=col, ec="none", zorder=3))
        text(ax, x + 30, y + 28, num, size=FS_TITLE, color=WHITE, ha="center", weight="bold", z=4)
        text(ax, x + 58, y + 28, title, size=FS_TITLE + 1, weight="bold", color=col)
        for ri, row in enumerate(rows):
            cy = y + 62 + ri * (chip_h + 8)
            for c, cx, cw in row:
                box(ax, cx, cy - chip_h / 2, cw, chip_h, fc=WHITE, ec=tint(col, 0.6), lw=1.0, r=12)
                text(ax, cx + cw / 2, cy, c, size=FS_SMALL, ha="center")
        y += h + gap
    save(fig, out / "b3-eval-layers.svg",
         "Four evaluation layers: a task held-out set; general-capability regression (IFEval, MMLU, GSM8K); "
         "safety and refusal regression; evaluating the shipped artifact with the same template, decoding and "
         "merged or quantised weights.", prev)


# ------------------------------------------------------------ RL's Razor --

def b4_razor_scatter(out: Path, prev: Path | None):
    # RL's Razor (Shenfeld, Pari & Agrawal 2025), Fig. 3 middle (ParityMNIST):
    # prior-task (FashionMNIST) score vs E_x[KL(pi_0 || pi)] on new-task inputs.
    # Curve points read from the plot (research-sft.md §4 item 13); the scatter
    # around them is synthetic (fixed seed) and only shows where each method lands.
    kp = np.array([0, 1, 2, 3, 4, 5, 6, 8, 10], float)
    sp = np.array([68, 57, 48, 43, 38, 34, 31, 23, 18], float)
    f = np.poly1d(np.polyfit(kp, sp, 2))
    rng = np.random.default_rng(20250904)
    k_sft = rng.uniform(0.4, 10, 40)
    y_sft = f(k_sft) + rng.normal(0, 1.8, k_sft.size)
    k_rl = np.concatenate([rng.uniform(0.05, 0.95, 26), rng.uniform(2.0, 3.6, 4)])
    y_rl = f(k_rl) + rng.normal(0, 1.5, k_rl.size)
    W, H = 900, 480
    fig = figure(W, H)
    ax = px_axes(fig, 80, 30, 560, 370)
    style_axes(ax, grid_y=True)
    kk = np.linspace(0, 10.3, 200)
    ax.plot(kk, f(kk), color=INK, lw=1.4, ls=(0, (5, 4)), zorder=2)
    ax.scatter(k_sft, y_sft, s=46, marker="o", facecolor=tint(CORAL, 0.25), edgecolor=CORAL, lw=1.4, zorder=3)
    ax.scatter(k_rl, y_rl, s=62, marker="^", facecolor=ACCENT, edgecolor=WHITE, lw=0.8, zorder=4)
    ax.set_xlim(-0.3, 10.5)
    ax.set_ylim(12, 74)
    ax.set_xticks([0, 2, 4, 6, 8, 10])
    ax.set_yticks([20, 30, 40, 50, 60, 70])
    ax.set_xlabel("KL(π₀ ‖ π) on new-task inputs  (base first; the paper's \"forward KL\")")
    ax.set_ylabel("prior-task score (FashionMNIST, %)   ↓ = more forgetting")
    ax.annotate("one curve for both methods", (6.8, f(6.8)), xytext=(5.6, 52), fontsize=FS, color=INK,
                arrowprops=dict(arrowstyle="-", color=MUTED, lw=1))
    fx = 660
    handles = [Line2D([], [], marker="^", ls="none", ms=9, mfc=ACCENT, mec=WHITE, label="RL (on-policy)"),
               Line2D([], [], marker="o", ls="none", ms=8, mfc=tint(CORAL, 0.25), mec=CORAL, mew=1.4, label="SFT"),
               Line2D([], [], color=INK, lw=1.4, ls=(0, (5, 4)), label="quadratic fit")]
    fig.legend(handles=handles, loc="upper left", bbox_to_anchor=(fx / W, 1 - 30 / H), fontsize=FS,
               labelspacing=0.8, handletextpad=0.6)
    notes = ["Most RL runs sit at low KL:", "they solve the new task with", "a small change in behaviour.", "",
             "SFT runs spread along the", "same curve: forgetting follows", "KL, not the method.", "",
             "Paper's fits: R² = 0.96", "(ParityMNIST), 0.71 (LLMs)."]
    for i, s in enumerate(notes):
        fig.text(fx / W, 1 - (150 + i * 19) / H, s, fontsize=FS_SMALL, va="center")
    credit(fig, "Schematic redraw after RL's Razor (Shenfeld, Pari & Agrawal 2025), Fig. 3 (ParityMNIST); "
                "curve read from the plot, points illustrative")
    save(fig, out / "b4-razor-scatter.svg",
         "Schematic: prior-task score falls along one convex curve as KL(base || fine-tuned) on the new task grows; "
         "SFT and RL runs share the curve, and most RL runs sit at low KL.", prev)


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
