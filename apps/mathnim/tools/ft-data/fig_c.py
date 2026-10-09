"""Part C (efficiency) figures. Called from figures.py; each function writes one SVG.

Numbers and their sources sit next to each figure; values read from paper
plots come from docs/lessons/llm-finetuning/research-sft.md (section 4).
"""
from __future__ import annotations

from pathlib import Path

import numpy as np
from matplotlib.lines import Line2D
from matplotlib.patches import Circle, Patch, Rectangle
from matplotlib.ticker import MaxNLocator
from scipy.stats import norm

from fig_style import (ACCENT, CORAL, FAINT, FS, FS_SMALL, FS_TITLE, GOLD, GOOD, INK, MUTED,
                       PURPLE, TEAL, WHITE, arrow, box, canvas, credit, figure, line, px_axes,
                       rect, save, style_axes, text, tint)

# ---------------------------------------------------------------- ledger --
# part-c-efficiency.md C1, D5: Llama-3.1-8B, s = 4096, b = 1, activation
# recomputation on (1.07 + 0.57 GB), unfused fp32 logits + grad (2 x 2.10 GB),
# overhead 1 GB.
ACT = 1.07 + 0.57
LOGITS = 2 * 2.10
SEGS = {
    "trainable": ("trainable state", "weights + grads + Adam", ACCENT, None, None),
    "frozen16": ("frozen weights, bf16", "", tint(PURPLE, 0.28), "////", PURPLE),
    "nf4": ("frozen linear layers, NF4", "", tint(TEAL, 0.30), "xxx", TEAL),
    "act": ("activations", "recomputed, b = 1", GOLD, None, None),
    "logits": ("logits + their gradient", "fp32, unfused", tint(CORAL, 0.35), "---", CORAL),
    "over": ("overhead", "CUDA context, buffers", tint(MUTED, 0.30), None, None),
}
LEDGER = [
    ("Full FT", [("trainable", 128.5), ("act", ACT), ("logits", LOGITS), ("over", 1.0)]),
    ("LoRA r=16", [("frozen16", 16.06), ("trainable", 0.67), ("act", ACT), ("logits", LOGITS), ("over", 1.0)]),
    ("QLoRA", [("nf4", 3.60), ("frozen16", 2.10), ("trainable", 0.67), ("act", ACT), ("logits", LOGITS), ("over", 1.0)]),
]


def _stack(ax, x, parts, width):
    bottom = 0.0
    for key, v in parts:
        _, _, fc, hatch, hc = SEGS[key]
        ax.bar(x, v, bottom=bottom, width=width, color=fc, hatch=hatch,
               edgecolor=hc if hatch else WHITE, lw=0.6 if hatch else 0.8, zorder=2)
        bottom += v
    return bottom


def _swatch(fig, x, y, w, h, key):
    W = fig.get_figwidth() * 72
    H = fig.get_figheight() * 72
    _, _, fc, hatch, hc = SEGS[key]
    r = Rectangle((x / W, 1 - (y + h) / H), w / W, h / H, transform=fig.transFigure, fc=fc,
                  hatch=hatch, ec=hc if hatch else "none", lw=0.6)
    fig.patches.append(r)


def c1_ledger(out: Path, prev: Path | None):
    W, H = 960, 590
    fig = figure(W, H)
    a1 = px_axes(fig, 70, 50, 300, 330)
    style_axes(a1, grid_y=True)
    for i, (name, parts) in enumerate(LEDGER):
        tot = _stack(a1, i, parts, 0.6)
        a1.text(i, tot + 2.5, f"≈{tot:.0f} GB" if tot > 100 else f"≈{tot:.1f} GB", ha="center", va="bottom",
                fontsize=FS, fontweight="bold", bbox=dict(boxstyle="round,pad=0.1", fc=WHITE, ec="none"), zorder=5)
    for cap in (80, 24):
        a1.axhline(cap, color=INK, lw=1.0, ls=(0, (5, 3)), zorder=3)
        a1.text(2.55, cap, f"{cap} GB", ha="left", va="center", fontsize=FS_SMALL, clip_on=False)
    a1.set_xticks(range(3))
    a1.set_xticklabels([n for n, _ in LEDGER])
    a1.set_xlim(-0.5, 2.5)
    a1.set_ylim(0, 150)
    a1.set_ylabel("GPU memory (GB)")
    a1.tick_params(axis="x", length=0)
    fig.text(70 / W, 1 - 14 / H, "All three methods", fontsize=FS_TITLE, fontweight="bold", va="top")

    a2 = px_axes(fig, 520, 50, 300, 330)
    style_axes(a2, grid_y=True)
    for i, (name, parts) in enumerate(LEDGER[1:]):
        tot = _stack(a2, i, parts, 0.5)
        a2.text(i, tot + 0.4, f"≈{tot:.1f} GB", ha="center", va="bottom", fontsize=FS, fontweight="bold",
                bbox=dict(boxstyle="round,pad=0.1", fc=WHITE, ec="none"), zorder=5)
        bottom = 0.0
        for key, v in parts:
            mid = bottom + v / 2
            lab = {"act": "1.6", "logits": "4.2", "over": "1"}.get(key, f"{v:.2f}")
            if v >= 1.0:
                a2.text(i, mid, lab, ha="center", va="center", fontsize=FS_SMALL, zorder=6,
                        bbox=dict(boxstyle="round,pad=0.12", fc=WHITE, ec="none", alpha=0.9))
            else:
                a2.annotate(f"{lab} adapters", (i + 0.25, mid), xytext=(i + 0.33, mid), va="center",
                            fontsize=FS_SMALL, color=ACCENT, fontweight="bold",
                            arrowprops=dict(arrowstyle="-", color=ACCENT, lw=1))
            bottom += v
    a2.axhline(24, color=INK, lw=1.0, ls=(0, (5, 3)), zorder=3)
    a2.text(1.95, 24, "24 GB", ha="left", va="center", fontsize=FS_SMALL, clip_on=False)
    a2.set_xticks(range(2))
    a2.set_xticklabels([n for n, _ in LEDGER[1:]])
    a2.set_xlim(-0.45, 1.9)
    a2.set_ylim(0, 27)
    a2.set_ylabel("GB (zoomed to 0–27)")
    a2.tick_params(axis="x", length=0)
    fig.text(520 / W, 1 - 14 / H, "Zoom: LoRA and QLoRA", fontsize=FS_TITLE, fontweight="bold", va="top")

    # legend in three columns under the charts
    keys = ["trainable", "frozen16", "nf4", "act", "logits", "over"]
    for i, k in enumerate(keys):
        lab, sub, *_ = SEGS[k]
        cx = 70 + (i % 3) * 300
        cy = 430 + (i // 3) * 46
        _swatch(fig, cx, cy, 22, 16, k)
        fig.text((cx + 30) / W, 1 - (cy + 8) / H, lab, fontsize=FS_SMALL, fontweight="bold", va="center")
        if sub:
            fig.text((cx + 30) / W, 1 - (cy + 26) / H, sub, fontsize=FS_SMALL, color=MUTED, va="center")
    fig.text(70 / W, 1 - 526 / H, "Logits 4.2 GB = plain PyTorch or the Trainer; TRL v1.15's SFTTrainer computes them "
             "in chunks by default (≈0).", fontsize=FS_SMALL, color=MUTED, va="center")
    fig.text(70 / W, 1 - 545 / H, "24 GB: e.g. RTX 4090 · 80 GB: A100 / H100.", fontsize=FS_SMALL, color=MUTED,
             va="center")
    credit(fig, "Estimate (formulas in C1): Llama-3.1-8B, sequence 4096, batch 1, activation recomputation on; GB = 10⁹ bytes")
    save(fig, out / "c1-ledger.svg",
         "Estimated GPU memory for fine-tuning Llama-3.1-8B: full fine-tuning about 135 GB, LoRA about 23.6 GB, "
         "QLoRA about 13.2 GB, with 24 GB and 80 GB capacity lines.", prev)


# --------------------------------------------------------- memory timeline --

def c1_memory_timeline(out: Path, prev: Path | None):
    W, H = 960, 440
    fig = figure(W, H)
    ax = px_axes(fig, 70, 60, 640, 310)
    style_axes(ax)
    L = 8                       # layers in the cartoon
    f_end, b_end, g_free = 3.6, 7.6, 9.5
    # piecewise-constant curves: sample just before and after every breakpoint (keeps the SVG small)
    bps = [f_end * i / L for i in range(L + 1)] + [f_end + (b_end - f_end) * i / L for i in range(L + 1)]
    bps += [f_end - 0.3, f_end + 0.35, b_end + 0.35, g_free - 0.35, g_free]
    t = np.array(sorted({0.0, 10.0} | {b + d for b in bps for d in (-1e-6, 1e-6) if 0 < b + d < 10}))
    weights = np.full_like(t, 2.6)
    optim = np.full_like(t, 3.4)
    act_per, grad_per = 3.2 / L, 2.4 / L
    done_b = np.clip(np.floor((t - f_end) / (b_end - f_end) * L + 1e-9), 0, L)  # layers finished in backward
    act = np.where(t <= f_end, np.ceil(t / f_end * L - 1e-9) * act_per, (L - done_b) * act_per)
    grads = np.where(t <= f_end, 0.0, done_b * grad_per)
    grads = np.where(t >= g_free, 0.0, grads)
    logits = np.where((t > f_end - 0.3) & (t < f_end + 0.35), 1.3, 0.0)
    temp = np.where((t > b_end + 0.35) & (t < g_free - 0.35), 0.9, 0.0)
    layers = [("weights", weights, tint(PURPLE, 0.28), "////", PURPLE),
              ("optimizer states\n(Adam m, v; fp32 master)", optim, tint(TEAL, 0.30), "xxx", TEAL),
              ("gradients", grads, tint(ACCENT, 0.45), None, ACCENT),
              ("activations", act, GOLD, None, GOLD),
              ("logits", logits, tint(CORAL, 0.40), "---", CORAL),
              ("optimizer temporaries", temp, tint(MUTED, 0.35), None, MUTED)]
    base = np.zeros_like(t)
    for name, y, fc, hatch, ec in layers:
        ax.fill_between(t, base, base + y, color=fc, hatch=hatch, edgecolor=ec if hatch else "none",
                        lw=0.0, zorder=2)
        base = base + y
    ax.plot(t, base, color=INK, lw=1.2, zorder=3)
    for xb in (f_end, b_end):
        ax.axvline(xb, color=MUTED, lw=1, ls=(0, (4, 3)), zorder=1)
    ymax = base.max()
    for x0, x1, lab in [(0, f_end, "forward"), (f_end, b_end, "backward"), (b_end, 10, "optimizer step")]:
        ax.text((x0 + x1) / 2, ymax * 1.17, lab, ha="center", va="center", fontsize=FS, fontweight="bold")
    k = int(np.argmax(base))
    ax.annotate("peak: end of forward\n(activations + logits)", (t[k], base[k]), xytext=(0.3, ymax * 1.03),
                fontsize=FS_SMALL, ha="left", va="center", arrowprops=dict(arrowstyle="-", color=MUTED, lw=1))
    ax.annotate("activations freed layer by\nlayer, gradients allocated", (5.6, 6.0 + 2.6), xytext=(4.3, ymax * 1.03),
                fontsize=FS_SMALL, ha="left", va="center", arrowprops=dict(arrowstyle="-", color=MUTED, lw=1))
    ax.annotate("gradients freed\n(zero_grad)", (g_free + 0.02, 7.0), xytext=(8.6, ymax * 1.03), fontsize=FS_SMALL,
                ha="left", va="center", arrowprops=dict(arrowstyle="-", color=MUTED, lw=1))
    ax.set_xlim(0, 10)
    ax.set_ylim(0, ymax * 1.26)
    ax.set_xticks([])
    ax.set_yticks([])
    ax.set_xlabel("time within one training step →")
    ax.set_ylabel("allocated GPU memory →")
    handles = [Patch(fc=fc, hatch=hatch, ec=ec if hatch else "none", lw=0.6, label=name)
               for name, _, fc, hatch, ec in layers[::-1]]
    fig.legend(handles=handles, loc="upper left", bbox_to_anchor=(728 / W, 1 - 70 / H), fontsize=FS_SMALL,
               handlelength=2.0, handleheight=1.2, labelspacing=0.9)
    credit(fig, "Schematic (full fine-tuning, mixed-precision AdamW); proportions not to scale")
    save(fig, out / "c1-memory-timeline.svg",
         "Schematic of GPU memory during one training step: activations climb in the forward pass, are freed in "
         "the backward pass while gradients are allocated, and the optimizer step adds a short spike.", prev)


# ------------------------------------------------------------ activations --

def c1_activations(out: Path, prev: Path | None):
    # Korthikanti et al. 2022 (arXiv 2205.05198), §4.1: bytes stored per layer,
    # 16-bit activations, 1-byte dropout masks; s seq, b batch, h hidden, a heads.
    rows = [  # (operation, rows it spans, tensor, size, group, s x s tensor?)
        ("LayerNorm 1", 1, "input", "2·sbh", "ln", False),
        ("Q, K, V projections", 1, "shared input", "2·sbh", "attn", False),
        ("Q·Kᵀ", 1, "Q and K", "4·sbh", "attn", False),
        ("softmax", 1, "output", "2·as²b", "attn", True),
        ("softmax dropout", 1, "mask", "as²b", "attn", True),
        ("attention over V", 2, "dropout output", "2·as²b", "attn", True),
        ("", 0, "V", "2·sbh", "attn", False),
        ("output projection", 1, "input", "2·sbh", "attn", False),
        ("attention dropout", 1, "mask", "sbh", "attn", False),
        ("LayerNorm 2", 1, "input", "2·sbh", "ln", False),
        ("MLP linear 1 (h → 4h)", 1, "input", "2·sbh", "mlp", False),
        ("GeLU", 1, "input", "8·sbh", "mlp", False),
        ("MLP linear 2 (4h → h)", 1, "input", "8·sbh", "mlp", False),
        ("MLP dropout", 1, "mask", "sbh", "mlp", False),
    ]
    col = {"ln": TEAL, "attn": ACCENT, "mlp": PURPLE}
    W, H = 960, 612
    fig, ax = canvas(W, H)
    x_op, w_op = 30, 230
    x_t, x_b = 290, 470
    y0, rh = 40, 31
    text(ax, x_op, 20, "operation in one layer", size=FS_SMALL, color=MUTED)
    text(ax, x_t, 20, "kept for backward", size=FS_SMALL, color=MUTED)
    text(ax, x_b, 20, "bytes", size=FS_SMALL, color=MUTED)
    group_span: dict[str, list[float]] = {}
    for i, (op, span, tensor, size, grp, quad) in enumerate(rows):
        y = y0 + i * rh
        c = col[grp]
        if op:
            box(ax, x_op, y + 3, w_op, span * rh - 6, fc=tint(c, 0.08), ec=c, lw=1.1, r=5)
            text(ax, x_op + 10, y + span * rh / 2, op, size=FS_SMALL + 0.5)
        if quad:
            rect(ax, x_t - 8, y + 4, x_b + 70 - x_t, rh - 8, fc=tint(CORAL, 0.12), ec=CORAL, lw=0.6, hatch="////",
                 hatch_color=tint(CORAL, 0.45), z=0)
        bb = dict(boxstyle="round,pad=0.12", fc=WHITE, ec="none") if quad else None
        text(ax, x_t, y + rh / 2, tensor, size=FS_SMALL + 0.5, bbox=bb)
        text(ax, x_b, y + rh / 2, size, size=FS, weight="bold", color=CORAL if quad else INK, bbox=bb)
        group_span.setdefault(grp, []).append(y)
    bx = 580

    def bracket(ys, label, sub, c):
        top, bot = min(ys) + 5, max(ys) + rh - 5
        line(ax, [bx, bx + 8, bx + 8, bx], [top, top, bot, bot], color=c, lw=1.6)
        ym = (top + bot) / 2
        text(ax, bx + 20, ym - (10 if sub else 0), label, size=FS + 1, weight="bold", color=c)
        if sub:
            text(ax, bx + 20, ym + 10, sub, size=FS_SMALL)

    bracket(group_span["attn"], "attention: 11·sbh", "+ 5·as²b for the s × s scores and softmax", ACCENT)
    bracket(group_span["mlp"], "MLP: 19·sbh", "", PURPLE)
    for yy, s in zip(group_span["ln"], ["LayerNorm: 2·sbh each", "two LayerNorms: 4·sbh"]):
        line(ax, [bx, bx + 8], [yy + rh / 2, yy + rh / 2], color=TEAL, lw=1.6)
        text(ax, bx + 20, yy + rh / 2, s, size=FS_SMALL + 0.5, color=TEAL, weight="bold")

    yt = y0 + len(rows) * rh + 22
    box(ax, 30, yt - 4, 900, 80, fc=tint(FAINT, 0.5), ec=MUTED, lw=1.0, r=8)
    text(ax, 46, yt + 16, "per layer: 11 + 19 + 4 = 34·sbh bytes  (+ 5·as²b without FlashAttention)", size=FS_TITLE,
         weight="bold")
    text(ax, 46, yt + 42, "Llama-3.1-8B, s = 4096, b = 1: sbh = 16.8M → 34·sbh ≈ 0.57 GB per layer, × 32 layers ≈ 18.3 GB "
         "(no recomputation)", size=FS_SMALL)
    rect(ax, 46, yt + 56, 22, 12, fc=tint(CORAL, 0.12), ec=CORAL, lw=0.6, hatch="////", hatch_color=tint(CORAL, 0.45))
    text(ax, 76, yt + 62, "s × s tensors: FlashAttention does not store them (it recomputes them in the backward pass)",
         size=FS_SMALL)
    credit(fig, "After Korthikanti et al. 2022, §4.1 (GPT layer with dropout and GeLU; 16-bit activations, "
                "1-byte dropout masks)")
    save(fig, out / "c1-activations.svg",
         "Activations one transformer layer keeps for the backward pass, per Korthikanti et al. 2022: attention "
         "11 sbh plus 5 as^2 b, MLP 19 sbh, two LayerNorms 4 sbh, 34 sbh bytes in total.", prev)


# --------------------------------------------------------------- B·A shapes --

def c2_ba_shapes(out: Path, prev: Path | None):
    d = k = 4096
    r = 16
    W, H = 960, 430
    fig, ax = canvas(W, H)
    S = 280
    y = 80
    sc = S / d
    x_w = 40
    rect(ax, x_w, y, S, S, fc=tint(MUTED, 0.14), ec=MUTED, lw=1.2)
    text(ax, x_w + S / 2, y - 34, "ΔW", size=FS_TITLE + 3, weight="bold", ha="center")
    text(ax, x_w + S / 2, y - 14, "d × k = 4096 × 4096", size=FS_SMALL, ha="center", color=MUTED)
    side = S * np.sqrt(r * (d + k) / (d * k))
    rect(ax, x_w + S - side - 14, y + S - side - 14, side, side, fc=ACCENT, ec="none")
    text(ax, x_w + S - side - 22, y + S - side / 2 - 14, "same area as\nB and A together", size=FS_SMALL,
         ha="right", color=ACCENT, va="center")
    text(ax, x_w + S + 25, y + S / 2, "=", size=28, ha="center")
    x_b = x_w + S + 52
    rect(ax, x_b, y, r * sc, S, fc=ACCENT, ec="none")
    text(ax, x_b + 1, y - 34, "B", size=FS_TITLE + 3, weight="bold", ha="center", color=ACCENT)
    text(ax, x_b + 1, y - 14, "d × r", size=FS_SMALL, ha="center", color=MUTED)
    text(ax, x_b + 8, y + 60, "4096 × 16", size=FS_SMALL, color=ACCENT, rotation=90, ha="left", va="top")
    text(ax, x_b + 34, y + S / 2, "·", size=34, ha="center")
    x_a = x_b + 62
    rect(ax, x_a, y + S / 2 - r * sc / 2, S, r * sc, fc=ACCENT, ec="none")
    text(ax, x_a + S / 2, y - 34, "A", size=FS_TITLE + 3, weight="bold", ha="center", color=ACCENT)
    text(ax, x_a + S / 2, y - 14, "r × k", size=FS_SMALL, ha="center", color=MUTED)
    text(ax, x_a + S / 2, y + S / 2 + 12, "16 × 4096", size=FS_SMALL, color=ACCENT, ha="center", va="top")
    text(ax, 40, y + S + 26, "Drawn to scale: r = 16 is 0.4% of 4096, so B and A are thin strips.", size=FS_SMALL,
         color=MUTED)
    nx = x_a + S + 34
    full = d * k
    lora = r * (d + k)
    rows = [("ΔW", f"{d}·{k} = {full:,}", INK), ("B", f"{d}·{r} = {d * r:,}", ACCENT),
            ("A", f"{r}·{k} = {r * k:,}", ACCENT), ("B + A", f"r(d + k) = {lora:,}", ACCENT)]
    text(ax, nx, y - 34, "parameters", size=FS_TITLE, weight="bold")
    for i, (nm, expr, c) in enumerate(rows):
        yy = y + 6 + i * 44
        text(ax, nx, yy, nm, size=FS, weight="bold", color=c)
        text(ax, nx, yy + 19, expr, size=FS_SMALL)
    text(ax, nx, y + 200, f"{lora / full:.2%} of ΔW", size=FS_TITLE + 4, weight="bold", color=ACCENT)
    text(ax, nx, y + 226, "16.8M vs 131k", size=FS, color=INK)
    text(ax, nx, y + 250, "rank(BA) ≤ 16", size=FS_SMALL, color=MUTED)
    save(fig, out / "c2-ba-shapes.svg",
         "Delta W of 4096 by 4096 equals B (4096 by 16) times A (16 by 4096), drawn to scale: 16.8 million "
         "parameters versus 131 thousand, 0.78%.", prev)


# ------------------------------------------------- LoRA Without Regret (3) --
# Values read from the post's figures (research-sft.md §4 item 19);
# Llama-3.1-8B on Tulu3, final test NLL.
TM_LR = {
    "full": [(2e-6, .617), (5e-6, .576), (1e-5, .552), (2e-5, .548), (5e-5, .617), (1e-4, .769)],
    1: [(4e-5, .587), (1e-4, .587), (2e-4, .596), (4e-4, .612)],
    16: [(4e-5, .565), (1e-4, .558), (2e-4, .564), (4e-4, .588)],
    32: [(4e-5, .564), (1e-4, .555), (2e-4, .558), (4e-4, .583), (1e-3, .725)],
    512: [(4e-5, .562), (1e-4, .550), (2e-4, .549), (4e-4, .568), (1e-3, .703)],
}
RANK_STYLE = {1: (tint(ACCENT, 0.48), (0, (1.5, 2)), "v"), 4: (tint(ACCENT, 0.52), (0, (3, 2)), "<"),
              16: (tint(ACCENT, 0.65), (0, (6, 2.5)), "s"), 32: (tint(ACCENT, 0.80), (0, (10, 2.5)), "D"),
              64: (tint(ACCENT, 0.85), (0, (10, 2.5)), "D"), 512: (ACCENT, "-", "o"), 256: (ACCENT, "-", "o")}


def c2_lr_vs_rank(out: Path, prev: Path | None):
    W, H = 900, 470
    fig = figure(W, H)
    ax = px_axes(fig, 80, 30, 560, 360)
    style_axes(ax, grid_y=True)
    ytop = 0.64
    series = [("full", INK, "-", "o", "full fine-tuning", 2.4)] + \
             [(r, RANK_STYLE[r][0], RANK_STYLE[r][1], RANK_STYLE[r][2], f"LoRA rank {r}", 2.0) for r in (512, 32, 16, 1)]
    off: dict[float, list[tuple[float, str]]] = {}
    for key, c, ls, m, lab, lw in series:
        pts = TM_LR[key]
        xs = [p[0] for p in pts]
        ys = [p[1] for p in pts]
        ax.plot(xs, ys, color=c, ls=ls, lw=lw, zorder=3)
        for xv, yv in pts:
            if yv <= ytop:
                ax.plot([xv], [yv], m, color=c, ms=6, mec=WHITE, mew=0.8, zorder=4)
            else:
                off.setdefault(xv, []).append((yv, c))
    for xv, items in off.items():
        ax.plot([xv], [ytop], "^", color=items[0][1], ms=7, clip_on=False, zorder=4)
        vals = sorted(v for v, _ in items)
        lab = f"{vals[0]:.3f}" if len(vals) == 1 else f"{vals[0]:.3f}–{vals[-1]:.3f}"
        ax.text(xv, ytop + 0.003, lab, ha="center", va="bottom", fontsize=FS_SMALL - 1, color=items[0][1],
                clip_on=False)
    ax.annotate("", xy=(2e-4, 0.5435), xytext=(2e-5, 0.5435),
                arrowprops=dict(arrowstyle="-|>", color=INK, lw=1.3, mutation_scale=13))
    ax.text(6.3e-5, 0.5425, "best LR ≈ 10× higher for LoRA (fitted 9.8×)", ha="center", va="top", fontsize=FS_SMALL)
    ax.set_xscale("log")
    ax.set_xlim(1.4e-6, 1.5e-3)
    ax.set_ylim(0.536, ytop)
    ax.set_xticks([1e-6 * 2, 1e-5, 1e-4, 1e-3])
    ax.set_xticklabels(["2e-6", "1e-5", "1e-4", "1e-3"])
    ax.minorticks_off()
    ax.set_yticks([0.55, 0.57, 0.59, 0.61, 0.63])
    ax.set_xlabel("learning rate (log scale)")
    ax.set_ylabel("final test loss (NLL)")
    handles = [Line2D([], [], color=c, ls=ls, marker=m, ms=6, lw=lw, label=lab) for _, c, ls, m, lab, lw in series]
    fig.legend(handles=handles, loc="upper left", bbox_to_anchor=(660 / W, 1 - 30 / H), fontsize=FS,
               labelspacing=0.7, handlelength=2.6)
    notes = ["Llama-3.1-8B on Tulu3.", "", "The best LoRA learning rate", "barely moves with rank;",
             "rank 1 prefers a lower one.", "", "High ranks reach the same", "minimum as full FT.", "",
             "▲ = value above the chart"]
    for i, s in enumerate(notes):
        fig.text(660 / W, 1 - (210 + i * 19) / H, s, fontsize=FS_SMALL, va="center", color=MUTED if i == 9 else INK)
    credit(fig, "Redrawn from LoRA Without Regret (Schulman / Thinking Machines, 2025), Fig. 2; values read from the figure (±0.001)")
    save(fig, out / "c2-lr-vs-rank.svg",
         "Final loss versus learning rate for full fine-tuning and LoRA ranks 1, 16, 32 and 512 on Llama-3.1-8B: "
         "full fine-tuning is best at 2e-5, high-rank LoRA at 2e-4, about 10 times higher.", prev)


def c2_modules(out: Path, prev: Path | None):
    # Fig. 4 of the post (Llama-3.1-8B, Tulu3, final test NLL); parameter counts as reported.
    rows = [("full fine-tuning", "all 8B weights", 0.548, INK, "o"),
            ("all layers (MLP + attention), r = 256", "0.70B params", 0.549, ACCENT, "o"),
            ("MLP only, r = 256", "0.49B params", 0.549, PURPLE, "s"),
            ("MLP only, r = 128", "0.24B params", 0.550, PURPLE, "s"),
            ("attention only, r = 256", "0.25B params", 0.563, CORAL, "D")]
    W, H = 900, 420
    fig = figure(W, H)
    ax = px_axes(fig, 300, 56, 430, 290)
    style_axes(ax, grid_x=True)
    y = np.arange(len(rows))[::-1]
    for yi, (name, p, v, c, m) in zip(y, rows):
        ax.axhline(yi, color=FAINT, lw=1, zorder=1)
        ax.plot([v], [yi], m, color=c, ms=10, mec=WHITE, mew=1, zorder=3)
        ax.text(v + 0.0006, yi, f"{v:.3f}", va="center", fontsize=FS, color=c, fontweight="bold")
    ax.set_yticks(y)
    ax.set_yticklabels([""] * len(rows))
    for yi, (name, p, *_rest) in zip(y, rows):
        ax.text(0.5445, yi + 0.13, name, ha="right", va="center", fontsize=FS, clip_on=False)
        ax.text(0.5445, yi - 0.17, p, ha="right", va="center", fontsize=FS_SMALL, color=MUTED, clip_on=False)
    ax.set_xlim(0.545, 0.566)
    ax.set_ylim(-0.5, len(rows) - 0.5)
    ax.set_xticks([0.545, 0.550, 0.555, 0.560, 0.565])
    ax.set_xlabel("final test loss (NLL, lower is better)")
    ax.spines["left"].set_visible(False)
    ax.tick_params(axis="y", length=0)
    ax.plot([0.5661, 0.5667, 0.5667, 0.5661], [y[3], y[3], y[4], y[4]], color=MUTED, lw=1.2, clip_on=False)
    fig.text(752 / W, 1 - (56 + 290 * 0.80) / H, "about the same\nsize: attention-\nonly is clearly\nworse",
             fontsize=FS_SMALL, va="center")
    fig.text(20 / W, 1 - 24 / H, "Which layers get LoRA (Llama-3.1-8B, Tulu3)", fontsize=FS_TITLE,
             fontweight="bold", va="center")
    credit(fig, "Redrawn from LoRA Without Regret (Schulman / Thinking Machines, 2025), Fig. 4; values read from the "
                "figure (±0.001), parameter counts as reported")
    save(fig, out / "c2-modules.svg",
         "Final loss by where LoRA is applied: all layers and MLP-only reach about full fine-tuning's 0.548, "
         "attention-only is worse (0.563) even at the size of MLP-only rank 128.", prev)


def c2_capacity(out: Path, prev: Path | None):
    W, H = 960, 470
    fig = figure(W, H)
    # left: schematic learning curves
    ax = px_axes(fig, 70, 60, 380, 300)
    style_axes(ax)
    s = np.logspace(1, 4, 400)
    full = 1.6 - 0.30 * np.log10(s)
    ax.plot(s, full, color=INK, lw=2.6, zorder=4)
    falloff = {1: 60, 4: 220, 16: 800, 64: 2600}
    for rnk, s0 in falloff.items():
        c, ls, _ = RANK_STYLE[rnk]
        z = (np.log10(s) - np.log10(s0)) / 0.12
        excess = 0.30 * 0.75 * 0.12 * np.logaddexp(0, z)
        ax.plot(s, full + excess, color=c, lw=2.0, ls=ls, zorder=3)
    ax.plot(s, full + 0.006, color=ACCENT, lw=1.6, zorder=3)
    ax.annotate("low ranks leave the\nfull-FT line when the\nadapter runs out of\ncapacity", xy=(150, 1.6 - 0.30 * np.log10(150) + 0.04),
                xytext=(12, 0.55), fontsize=FS_SMALL, arrowprops=dict(arrowstyle="-", color=MUTED, lw=1))
    ax.set_xscale("log")
    ax.set_xlim(10, 1e4)
    ax.set_ylim(0.35, 1.4)
    ax.set_yticks([])
    ax.set_xticks([10, 100, 1000, 10000])
    ax.set_xticklabels(["10", "100", "1K", "10K"])
    ax.minorticks_off()
    ax.set_xlabel("training steps (log scale)")
    ax.set_ylabel("training loss →")
    fig.text(70 / W, 1 - 18 / H, "Learning curves (schematic)", fontsize=FS_TITLE, fontweight="bold", va="top")
    fig.text(70 / W, 1 - 38 / H, "loss falls linearly in log(steps) for full FT", fontsize=FS_SMALL, color=MUTED, va="top")
    handles = [Line2D([], [], color=INK, lw=2.6, label="full FT")]
    for rnk in (256, 64, 16, 4, 1):
        c, ls, _ = RANK_STYLE[rnk]
        handles.append(Line2D([], [], color=c, lw=2.0, ls=ls, label=f"rank {rnk}"))
    ax.legend(handles=handles, loc="upper right", fontsize=FS_SMALL, labelspacing=0.4, handlelength=2.4)

    # right: final loss by rank (values read from Fig. 1, 8B / Tulu3, ~7.5k steps)
    b = px_axes(fig, 590, 60, 330, 300)
    style_axes(b, grid_y=True)
    ranks = [1, 2, 4, 8, 16, 32]
    vals = [0.587, 0.579, 0.571, 0.564, 0.559, 0.555]
    b.axhspan(0.550, 0.553, xmin=0, xmax=1, color="none")
    b.fill_between([64, 512], [0.550, 0.550], [0.553, 0.553], color=tint(ACCENT, 0.30), zorder=2)
    b.plot(ranks, vals, "o-", color=ACCENT, ms=7, mec=WHITE, mew=0.8, lw=1.8, zorder=3)
    for r_, v in zip(ranks, vals):
        b.text(r_ * 1.22, v + 0.0003, f"{v:.3f}", ha="left", va="bottom", fontsize=FS_SMALL - 1, color=ACCENT)
    b.text(180, 0.5545, "ranks 64–512:\n0.550–0.553", ha="center", va="bottom", fontsize=FS_SMALL - 1, color=ACCENT)
    b.axhline(0.548, color=INK, lw=1.3, ls=(0, (4, 3)), zorder=1)
    b.text(1.1, 0.5465, "full fine-tuning 0.548", fontsize=FS_SMALL - 1, va="top")
    b.set_xscale("log", base=2)
    b.set_xticks([1, 4, 16, 64, 256])
    b.set_xticklabels(["1", "4", "16", "64", "256"])
    b.minorticks_off()
    b.set_xlim(0.8, 700)
    b.set_ylim(0.542, 0.594)
    b.set_xlabel("LoRA rank (log scale)")
    b.set_ylabel("final test loss (NLL)")
    fig.text(590 / W, 1 - 18 / H, "Final loss by rank", fontsize=FS_TITLE, fontweight="bold", va="top")
    fig.text(590 / W, 1 - 38 / H, "Llama-3.1-8B on Tulu3, ~7.5k steps", fontsize=FS_SMALL, color=MUTED, va="top")
    credit(fig, "After LoRA Without Regret (Schulman / Thinking Machines, 2025), Fig. 1: left schematic; "
                "right values read from the figure (±0.002)")
    save(fig, out / "c2-capacity.svg",
         "Left, schematic: low-rank LoRA learning curves leave the full fine-tuning line when the adapter runs out "
         "of capacity. Right: final loss on Llama-3.1-8B/Tulu3 falls from 0.587 at rank 1 to about 0.55 at ranks 64-512; "
         "full fine-tuning 0.548.", prev)


# ------------------------------------------- learns less, forgets less --
# Biderman et al. 2024 (arXiv 2405.09673), Tables S1-S8; Llama-2-7B.
BID = {
    "cpt": {  # S1-S2, StarCoder-Python, 0.25/0.5/1/2/4/8/16/20B tokens
        "x": {16: [0.143, 0.144, 0.141, 0.141, 0.154, 0.159, 0.162, 0.162],
              64: [0.142, 0.146, 0.141, 0.153, 0.157, 0.176, 0.194, 0.196],
              256: [0.144, 0.142, 0.143, 0.159, 0.159, 0.208, 0.211, 0.224],
              0: [0.152, 0.153, 0.172, 0.181, 0.218, 0.258, 0.255, 0.263]},
        "y": {16: [0.645, 0.642, 0.645, 0.642, 0.644, 0.640, 0.638, 0.635],
              64: [0.646, 0.644, 0.646, 0.646, 0.639, 0.634, 0.626, 0.626],
              256: [0.644, 0.645, 0.643, 0.639, 0.636, 0.630, 0.618, 0.617],
              0: [0.625, 0.624, 0.625, 0.616, 0.599, 0.583, 0.551, 0.545]},
    },
    "ift": {  # S5-S6, Magicoder-Evol-Instruct-110K, epochs 1/2/4/8/16
        "x": {16: [0.197, 0.275, 0.358, 0.338, 0.324],
              64: [0.249, 0.339, 0.417, 0.392, 0.405],
              256: [0.299, 0.385, 0.498, 0.437, 0.466],
              0: [0.302, 0.464, 0.470, 0.497, 0.416]},
        "y": {16: [0.653, 0.648, 0.652, 0.646, 0.609],
              64: [0.652, 0.651, 0.632, 0.580, 0.510],
              256: [0.655, 0.659, 0.631, 0.552, 0.517],
              0: [0.595, 0.579, 0.512, 0.446, 0.414]},
    },
    "math": {  # S7-S8, MetaMathQA, epochs 1/2/4/8/16
        "x": {16: [0.447, 0.528, 0.580, 0.578, 0.569],
              64: [0.527, 0.588, 0.624, 0.624, 0.595],
              256: [0.557, 0.607, 0.625, 0.634, 0.594],
              0: [0.604, 0.641, 0.642, 0.619, 0.599]},
        "y": {16: [0.628, 0.617, 0.616, 0.616, 0.596],
              64: [0.617, 0.609, 0.608, 0.586, 0.568],
              256: [0.613, 0.607, 0.599, 0.584, 0.567],
              0: [0.598, 0.599, 0.590, 0.572, 0.559]},
    },
}


def c2_learns_less(out: Path, prev: Path | None):
    W, H = 980, 500
    fig = figure(W, H)
    style = {16: (tint(ACCENT, 0.50), "o", "LoRA r = 16"), 64: (tint(ACCENT, 0.78), "s", "LoRA r = 64"),
             256: (ACCENT, "D", "LoRA r = 256"), 0: (CORAL, "^", "full fine-tuning")}
    panels = [("cpt", "Code, continued pretraining", "StarCoder-Python, 0.25 → 20B tokens", "HumanEval pass@1 →",
               (0.13, 0.275), (0.535, 0.655)),
              ("ift", "Code, instruction tuning", "Magicoder-Evol-Instruct, 1 → 16 epochs", "HumanEval pass@1 →",
               (0.17, 0.53), (0.40, 0.67)),
              ("math", "Math, instruction tuning", "MetaMathQA, 1 → 16 epochs", "GSM8K →",
               (0.43, 0.66), (0.55, 0.635))]
    for j, (key, title, sub, xlab, xl, yl) in enumerate(panels):
        x0 = 70 + j * 310
        a = px_axes(fig, x0, 76, 240, 300)
        style_axes(a, grid_y=True, grid_x=True)
        for rk in (16, 64, 256, 0):
            c, m, _ = style[rk]
            xs, ys = BID[key]["x"][rk], BID[key]["y"][rk]
            a.plot(xs, ys, color=c, lw=1.1, alpha=0.55, zorder=2)
            a.plot(xs[:-1], ys[:-1], m, color=c, ms=5, mfc=WHITE, mec=c, mew=1.3, zorder=3)
            a.plot(xs[-1:], ys[-1:], m, color=c, ms=9, mec=WHITE, mew=0.8, zorder=4)
        a.set_xlim(*xl)
        a.set_ylim(*yl)
        a.xaxis.set_major_locator(MaxNLocator(5))
        a.set_xlabel(xlab)
        if j == 0:
            a.set_ylabel("source-domain score  (↓ = more forgetting)")
        fig.text(x0 / W, 1 - 16 / H, title, fontsize=FS_TITLE, fontweight="bold", va="top")
        fig.text(x0 / W, 1 - 36 / H, sub, fontsize=FS_SMALL, color=MUTED, va="top")
    handles = [Line2D([], [], color=style[k][0], marker=style[k][1], ms=8, lw=1.2, label=style[k][2])
               for k in (16, 64, 256, 0)]
    fig.legend(handles=handles, loc="upper left", bbox_to_anchor=(70 / W, 1 - 418 / H), ncol=4, fontsize=FS,
               columnspacing=2.0)
    fig.text(70 / W, 1 - 462 / H, "Large marker = last checkpoint. On code, LoRA has the better trade-off "
             "(less forgetting for the same score); on math, full fine-tuning does.", fontsize=FS_SMALL, va="center")
    credit(fig, "Data: Biderman et al. 2024 (LoRA Learns Less and Forgets Less), Tables S1–S8, Llama-2-7B; "
                "source score = mean of HellaSwag, ARC-C, WinoGrande")
    save(fig, out / "c2-learns-less-forgets-less.svg",
         "Target-domain score versus source-domain score for LoRA ranks 16, 64, 256 and full fine-tuning on code "
         "continued pretraining, code instruction tuning and math instruction tuning (Llama-2-7B).", prev)


# ------------------------------------------------------------ merge paths --

def c2_merge_paths(out: Path, prev: Path | None):
    W, H = 960, 450
    fig, ax = canvas(W, H)
    text(ax, 30, 24, "Merged", size=FS_TITLE + 1, weight="bold")
    text(ax, 30, 46, "W′ = W₀ + (α/r)·B·A, computed once after training", size=FS_SMALL, color=MUTED)
    box(ax, 120, 150, 200, 120, fc=tint(PURPLE, 0.10), ec=PURPLE, lw=1.6, r=8)
    text(ax, 220, 195, "W′", size=FS_TITLE + 4, weight="bold", ha="center", color=PURPLE)
    text(ax, 220, 225, "d × k (same shape as W₀)", size=FS_SMALL, ha="center")
    arrow(ax, 220, 340, 220, 276, lw=1.8)
    text(ax, 220, 356, "x", size=FS_TITLE + 2, ha="center", style="italic")
    arrow(ax, 220, 144, 220, 100, lw=1.8)
    text(ax, 220, 86, "h = W′x", size=FS_TITLE, ha="center", style="italic")
    for i, s in enumerate(["one matmul: no extra latency", "one full-size model per adapter"]):
        text(ax, 40, 392 + i * 20, "· " + s, size=FS_SMALL)

    ox = 480
    line(ax, [ox - 30, ox - 30], [20, 430], color=FAINT, lw=1.2)
    text(ax, ox, 24, "Unmerged", size=FS_TITLE + 1, weight="bold")
    text(ax, ox, 46, "frozen W₀ plus the adapter path, kept separate", size=FS_SMALL, color=MUTED)
    box(ax, ox + 30, 150, 200, 120, fc=tint(MUTED, 0.12), ec=MUTED, lw=1.6, r=8)
    text(ax, ox + 130, 195, "W₀", size=FS_TITLE + 4, weight="bold", ha="center")
    text(ax, ox + 130, 225, "d × k, frozen, shared", size=FS_SMALL, ha="center")
    box(ax, ox + 290, 220, 120, 40, fc=tint(ACCENT, 0.12), ec=ACCENT, lw=1.6, r=6)
    text(ax, ox + 350, 240, "A  (r × k)", size=FS, ha="center", color=ACCENT, weight="bold")
    box(ax, ox + 290, 152, 120, 40, fc=tint(ACCENT, 0.12), ec=ACCENT, lw=1.6, r=6)
    text(ax, ox + 350, 172, "B  (d × r)", size=FS, ha="center", color=ACCENT, weight="bold")
    line(ax, [ox + 130, ox + 130], [340, 300], lw=1.8)
    line(ax, [ox + 130, ox + 350], [300, 300], lw=1.8)
    arrow(ax, ox + 130, 300, ox + 130, 276, lw=1.8)
    arrow(ax, ox + 350, 300, ox + 350, 266, lw=1.8, color=ACCENT)
    text(ax, ox + 130, 356, "x", size=FS_TITLE + 2, ha="center", style="italic")
    arrow(ax, ox + 350, 214, ox + 350, 198, lw=1.8, color=ACCENT)
    text(ax, ox + 420, 206, "r-dim", size=FS_SMALL, color=ACCENT)
    ax.add_patch(Circle((ox + 240, 112), 15, fc=WHITE, ec=INK, lw=1.6, zorder=3))
    text(ax, ox + 240, 112, "+", size=FS_TITLE + 3, ha="center", z=4)
    line(ax, [ox + 130, ox + 130, ox + 222], [144, 112, 112], lw=1.8)
    line(ax, [ox + 350, ox + 350, ox + 258], [146, 112, 112], lw=1.8, color=ACCENT)
    text(ax, ox + 358, 130, "× α/r", size=FS_SMALL, color=ACCENT)
    arrow(ax, ox + 240, 96, ox + 240, 70, lw=1.8)
    text(ax, ox + 256, 76, "h = W₀x + (α/r)·B(Ax)", size=FS, style="italic")
    for i, s in enumerate(["two extra small matmuls: a little extra latency",
                           "one base serves many swappable adapters"]):
        text(ax, ox + 10, 392 + i * 20, "· " + s, size=FS_SMALL)
    save(fig, out / "c2-merge-paths.svg",
         "Inference with a merged LoRA (one matrix W' of the same shape, one matmul) versus unmerged (W0 x plus "
         "an extra x to A to B path, small extra latency, shared base).", prev)


# -------------------------------------------------------------- NF4 levels --

NF4_BNB = [-1.0, -0.6961928009986877, -0.5250730514526367, -0.39491748809814453,
           -0.28444138169288635, -0.18477343022823334, -0.09105003625154495, 0.0,
           0.07958029955625534, 0.16093020141124725, 0.24611230194568634, 0.33791524171829224,
           0.44070982933044434, 0.5626170039176941, 0.7229568362236023, 1.0]


def nf4_from_scipy(offset=0.9677083):
    """bitsandbytes create_normal_map(offset, use_extra_value=True), in numpy/scipy."""
    v1 = norm.ppf(np.linspace(offset, 0.5, 9)[:-1]).tolist()
    v3 = (-norm.ppf(np.linspace(offset, 0.5, 8)[:-1])).tolist()
    v = np.array(sorted(v1 + [0.0] + v3))
    return v / v.max()


def _bin_mass(levels_z):
    lv = np.sort(np.asarray(levels_z))
    edges = np.concatenate([[-np.inf], (lv[1:] + lv[:-1]) / 2, [np.inf]])
    return lv, edges, norm.cdf(edges[1:]) - norm.cdf(edges[:-1])


def c3_nf4_levels(out: Path, prev: Path | None):
    nf4 = nf4_from_scipy()
    assert np.allclose(nf4, NF4_BNB, atol=1e-6), "NF4 table mismatch"
    zmax = norm.ppf(0.9677083)  # 1.848
    int4 = np.arange(-7, 8) / 7 * 2.5
    W, H = 960, 640
    fig = figure(W, H)
    z = np.linspace(-3.2, 3.2, 600)
    panels = [("NF4: 16 levels at N(0, 1) quantiles", nf4 * zmax, ACCENT,
               f"normalised levels × {zmax:.3f} (the outermost level is the 0.9677 quantile); one exact 0"),
              ("int4 absmax: 15 evenly spaced levels", int4, GOLD,
               "levels k/7 × 2.5σ, k = −7…7 (a block whose absmax is ≈ 2.5σ, typical for 64 weights)")]
    for j, (title, lv_z, col, sub) in enumerate(panels):
        top = 56 + j * 296
        a = px_axes(fig, 70, top, 820, 150)
        b = px_axes(fig, 70, top + 158, 820, 62)
        style_axes(a)
        style_axes(b)
        lv, edges, mass = _bin_mass(lv_z)
        a.plot(z, norm.pdf(z), color=INK, lw=1.6, zorder=3)
        a.fill_between(z, 0, norm.pdf(z), color=tint(FAINT, 0.6), zorder=1)
        for l_ in lv:
            a.plot([l_, l_], [0, norm.pdf(l_)], color=col, lw=1.8, zorder=4)
            a.plot([l_], [norm.pdf(l_)], "o", color=col, ms=5, zorder=5)
        a.set_xlim(-3.2, 3.2)
        a.set_ylim(0, 0.44)
        a.set_xticks([])
        a.set_yticks([])
        a.spines["bottom"].set_visible(False)
        a.spines["left"].set_visible(False)
        fig.text(70 / W, 1 - (top - 34) / H, title, fontsize=FS_TITLE, fontweight="bold", color=col, va="top")
        fig.text(70 / W, 1 - (top - 14) / H, sub, fontsize=FS_SMALL, color=MUTED, va="top")
        e = np.clip(edges, -3.2, 3.2)
        for i in range(len(lv)):
            b.bar((e[i] + e[i + 1]) / 2, mass[i], width=(e[i + 1] - e[i]) * 0.94,
                  color=tint(col, 0.45 if i % 2 else 0.7), edgecolor=col, lw=0.6, zorder=2)
        b.set_xlim(-3.2, 3.2)
        b.set_ylim(0, 0.17)
        b.set_yticks([0, 0.08, 0.16])
        b.set_yticklabels(["0", "8%", "16%"])
        b.set_xticks([-3, -2, -1, 0, 1, 2, 3])
        b.set_xticklabels(["−3σ", "−2σ", "−1σ", "0", "1σ", "2σ", "3σ"])
        b.text(-3.15, 0.165, "probability mass per bin if the weights were exactly N(0, 1)", fontsize=FS_SMALL, va="top")
        b.text(3.15, 0.165, f"min {mass.min():.1%} · max {mass.max():.1%}", fontsize=FS_SMALL, color=col,
               ha="right", va="top", fontweight="bold")
    credit(fig, "Data: QLoRA (Dettmers et al. 2023) / bitsandbytes NF4 table. Real absmax-scaled blocks are not exactly "
                "N(0, 1), so their bins are not equal-mass.")
    save(fig, out / "c3-nf4-levels.svg",
         "The 16 NF4 levels drawn at standard normal quantiles, with near-equal probability mass per bin for N(0,1) "
         "inputs, versus 15 evenly spaced int4 absmax levels whose bins hold very unequal mass.", prev)


# ----------------------------------------------------------- QLoRA dataflow --

def c3_qlora_dataflow(out: Path, prev: Path | None):
    W, H = 960, 540
    fig, ax = canvas(W, H)
    box(ax, 20, 20, 690, 440, fc="none", ec=MUTED, lw=1.2, r=12, ls=(0, (6, 3)))
    text(ax, 36, 40, "GPU", size=FS_TITLE, weight="bold", color=MUTED)
    box(ax, 730, 20, 210, 440, fc=tint(FAINT, 0.5), ec=MUTED, lw=1.2, r=12, ls=(0, (6, 3)))
    text(ax, 746, 40, "CPU RAM", size=FS_TITLE, weight="bold", color=MUTED)
    # frozen base -> dequantise -> matmul
    box(ax, 46, 66, 230, 92, fc=tint(TEAL, 0.14), ec=TEAL, lw=1.6, r=8, hatch="xxx", hatch_color=tint(TEAL, 0.35))
    wb = dict(boxstyle="round,pad=0.15", fc=WHITE, ec="none")
    text(ax, 161, 88, "base weight W (frozen)", size=FS, weight="bold", ha="center", bbox=wb)
    text(ax, 161, 112, "NF4 (4-bit), blocks of 64", size=FS_SMALL, ha="center", bbox=wb)
    text(ax, 161, 134, "+ double-quantised scales", size=FS_SMALL, ha="center", bbox=wb)
    arrow(ax, 280, 112, 312, 112, lw=1.8)
    box(ax, 314, 86, 150, 52, fc=WHITE, ec=TEAL, lw=1.4, r=8, ls=(0, (4, 2)))
    text(ax, 389, 104, "dequantise", size=FS, ha="center", weight="bold")
    text(ax, 389, 123, "to bf16, on the fly", size=FS_SMALL, ha="center")
    arrow(ax, 466, 112, 498, 112, lw=1.8)
    box(ax, 500, 80, 160, 64, fc=tint(MUTED, 0.10), ec=INK, lw=1.4, r=8)
    text(ax, 580, 102, "X · W", size=FS + 1, ha="center", weight="bold")
    text(ax, 580, 124, "bf16 matmul", size=FS_SMALL, ha="center")
    # adapters
    box(ax, 314, 206, 150, 50, fc=tint(ACCENT, 0.14), ec=ACCENT, lw=1.6, r=8)
    text(ax, 389, 224, "A  (r × k)", size=FS, ha="center", weight="bold", color=ACCENT)
    text(ax, 389, 243, "bf16, trainable", size=FS_SMALL, ha="center")
    box(ax, 500, 206, 160, 50, fc=tint(ACCENT, 0.14), ec=ACCENT, lw=1.6, r=8)
    text(ax, 580, 224, "B  (d × r)", size=FS, ha="center", weight="bold", color=ACCENT)
    text(ax, 580, 243, "bf16, trainable", size=FS_SMALL, ha="center")
    # input X
    text(ax, 70, 231, "X (bf16)", size=FS, weight="bold", ha="center")
    line(ax, [110, 290], [231, 231], lw=1.8)
    line(ax, [290, 290], [231, 176], lw=1.8)
    line(ax, [290, 580], [176, 176], lw=1.8)
    arrow(ax, 580, 176, 580, 148, lw=1.8)
    arrow(ax, 290, 231, 310, 231, lw=1.8)
    arrow(ax, 466, 231, 496, 231, lw=1.8, color=ACCENT)
    # sum and output
    ax.add_patch(Circle((580, 300), 14, fc=WHITE, ec=INK, lw=1.6, zorder=3))
    text(ax, 580, 300, "+", size=FS_TITLE + 2, ha="center", z=4)
    line(ax, [660, 684, 684, 594], [112, 112, 300, 300], lw=1.8)
    arrow(ax, 580, 258, 580, 284, lw=1.8, color=ACCENT)
    arrow(ax, 580, 314, 580, 342, lw=1.8)
    text(ax, 592, 340, "output (bf16)", size=FS_SMALL, va="center")
    # gradient flow (backward)
    arrow(ax, 566, 284, 566, 262, lw=1.5, color=CORAL, ls=(0, (3, 2)))
    arrow(ax, 496, 248, 468, 248, lw=1.5, color=CORAL, ls=(0, (3, 2)))
    arrow(ax, 520, 162, 300, 162, lw=1.5, color=CORAL, ls=(0, (3, 2)))
    text(ax, 306, 152, "to X, through the dequantised W", size=FS_SMALL - 1, color=CORAL)
    text(ax, 46, 290, "Backward (dashed): gradients reach", size=FS_SMALL, color=CORAL)
    text(ax, 46, 308, "A and B, and pass through the", size=FS_SMALL, color=CORAL)
    text(ax, 46, 326, "dequantised W to earlier layers;", size=FS_SMALL, color=CORAL)
    text(ax, 46, 344, "W itself is never updated.", size=FS_SMALL, color=CORAL)
    # optimizer states + paging
    box(ax, 46, 390, 230, 54, fc=tint(GOLD, 0.12), ec=GOLD, lw=1.6, r=8)
    text(ax, 161, 409, "optimizer states for A, B", size=FS, ha="center", weight="bold")
    text(ax, 161, 428, "paged optimizer (e.g. 8-bit)", size=FS_SMALL, ha="center")
    box(ax, 760, 390, 150, 54, fc=tint(GOLD, 0.12), ec=GOLD, lw=1.2, r=8, ls=(0, (4, 2)))
    text(ax, 835, 409, "paged-out", size=FS, ha="center", weight="bold")
    text(ax, 835, 428, "optimizer pages", size=FS_SMALL, ha="center")
    arrow(ax, 282, 404, 754, 404, lw=1.4, color=GOLD)
    arrow(ax, 754, 430, 282, 430, lw=1.4, color=GOLD)
    text(ax, 518, 392, "evicted when GPU memory spikes", size=FS_SMALL, ha="center", color=GOLD)
    text(ax, 518, 444, "paged back for the optimizer step", size=FS_SMALL, ha="center", color=GOLD, va="top")
    text(ax, 746, 62, "(unified memory)", size=FS_SMALL, color=MUTED)
    # legend
    ly = 494
    rect(ax, 30, ly - 7, 22, 14, fc=tint(TEAL, 0.14), ec=TEAL, lw=0.8, hatch="xxx", hatch_color=tint(TEAL, 0.35))
    text(ax, 60, ly, "4-bit storage (frozen)", size=FS_SMALL)
    rect(ax, 230, ly - 7, 22, 14, fc=tint(ACCENT, 0.14), ec=ACCENT, lw=0.8)
    text(ax, 260, ly, "trainable, bf16", size=FS_SMALL)
    line(ax, [400, 430], [ly, ly], color=CORAL, lw=1.6, ls=(0, (3, 2)))
    text(ax, 438, ly, "gradient flow", size=FS_SMALL)
    line(ax, [560, 590], [ly, ly], color=GOLD, lw=1.6)
    text(ax, 598, ly, "paging flow", size=FS_SMALL)
    credit(fig, "Schematic redraw after QLoRA (Dettmers et al. 2023), Fig. 1")
    save(fig, out / "c3-qlora-dataflow.svg",
         "QLoRA data flow: the frozen NF4 base weight is dequantised to bf16 for each matmul, bf16 LoRA adapters "
         "A and B receive the gradients, and paged optimizer states move between GPU and CPU memory.", prev)


# ------------------------------------------------------------------ deploy --

def c3_deploy(out: Path, prev: Path | None):
    W, H = 960, 350
    fig, ax = canvas(W, H)
    u, g = 24, 4      # side of one 16 GB model copy, gap
    text(ax, 30, 26, "One merged model per customer", size=FS_TITLE + 1, weight="bold")
    x0, y0 = 30, 50
    for i in range(10):
        for j in range(10):
            rect(ax, x0 + j * (u + g), y0 + i * (u + g), u, u, fc=tint(PURPLE, 0.28), ec=PURPLE, lw=0.8,
                 hatch="////", hatch_color=tint(PURPLE, 0.6))
    gx = x0 + 10 * (u + g) + 16
    text(ax, gx, y0 + 40, "100 × 16 GB", size=FS_TITLE + 2, weight="bold", color=PURPLE)
    text(ax, gx, y0 + 66, "= 1.6 TB", size=FS_TITLE + 2, weight="bold", color=PURPLE)
    text(ax, gx, y0 + 100, "each square: one", size=FS_SMALL)
    text(ax, gx, y0 + 118, "8B model in bf16", size=FS_SMALL)
    text(ax, gx, y0 + 152, "≈ 20 GPUs", size=FS_SMALL)
    text(ax, gx, y0 + 170, "of 80 GB", size=FS_SMALL)

    ox = 520
    line(ax, [ox - 30, ox - 30], [16, 334], color=FAINT, lw=1.2)
    text(ax, ox, 26, "One base + 100 adapters, served together", size=FS_TITLE + 1, weight="bold")
    rect(ax, ox, y0, u, u, fc=tint(PURPLE, 0.28), ec=PURPLE, lw=0.8, hatch="////", hatch_color=tint(PURPLE, 0.6))
    text(ax, ox + u + 10, y0 + u / 2, "shared base model, 16 GB", size=FS_SMALL)
    s_ad = u * np.sqrt(0.084 / 16)          # adapters to scale by area (84 MB of 16 GB)
    ay0 = y0 + u + 24
    pitch = 9
    for i in range(10):
        for j in range(10):
            rect(ax, ox + j * pitch, ay0 + i * pitch, s_ad, s_ad, fc=ACCENT, ec="none")
    text(ax, ox + 10 * pitch + 12, ay0 + 3 * pitch, "100 adapters × 84 MB", size=FS_SMALL, va="center")
    text(ax, ox + 10 * pitch + 12, ay0 + 5 * pitch + 4, "(r = 16, all linear layers, bf16)", size=FS_SMALL,
         va="center", color=MUTED)
    # all adapters together, as one rectangle of the same area scale
    ry = ay0 + 10 * pitch + 20
    rect(ax, ox, ry, u, u * 100 * 0.084 / 16, fc=ACCENT, ec="none")
    text(ax, ox + u + 10, ry + u * 0.525 / 2, "all 100 together: 8.4 GB", size=FS_SMALL, va="center")
    text(ax, ox, ry + 46, "16 GB + 100 × 84 MB ≈ 24.4 GB", size=FS_TITLE + 2, weight="bold", color=ACCENT)
    text(ax, ox, ry + 72, "fits on one GPU; one batch can mix requests", size=FS_SMALL)
    text(ax, ox, ry + 90, "for different adapters (S-LoRA, Punica; vLLM --enable-lora)", size=FS_SMALL)
    text(ax, ox, ry + 116, "Areas to scale: one adapter is 0.5% of a model.", size=FS_SMALL, color=MUTED)
    save(fig, out / "c3-deploy.svg",
         "Serving 100 customers: 100 merged 16 GB models need 1.6 TB, while one 16 GB base plus 100 adapters of "
         "84 MB needs about 24.4 GB.", prev)


# -------------------------------------------------------------- QAT timeline --

def c3_qat_timeline(out: Path, prev: Path | None):
    W, H = 960, 410
    fig, ax = canvas(W, H)
    x_lab = 30
    cols = [(230, 420, "before training"), (420, 700, "during (post-)training"), (700, 940, "after training")]
    for x0, x1, lab in cols:
        rect(ax, x0 + 2, 20, x1 - x0 - 4, 30, fc=tint(FAINT, 0.7))
        text(ax, (x0 + x1) / 2, 35, lab, size=FS, weight="bold", ha="center")
        line(ax, [x0, x0], [20, 395], color=FAINT, lw=1.2)
    line(ax, [940, 940], [20, 395], color=FAINT, lw=1.2)
    arrow(ax, 230, 62, 935, 62, color=MUTED, lw=1.2)
    lanes = [
        ("QLoRA", ["goal: save training", "memory"], TEAL, [
            (236, 414, ["quantise the frozen base", "to NF4 when loading"]),
            (426, 694, ["train bf16 adapters on the", "dequantised weights"]),
            (706, 934, ["output: an adapter; a merged", "model is bf16, not 4-bit"])]),
        ("QAT", ["goal: a quantised model", "that keeps quality"], PURPLE, [
            (426, 694, ["forward: fake-quant ŵ = s·round(w/s)", "backward: straight-through", "estimator, ∂ŵ/∂w ≈ 1"]),
            (706, 934, ["ship real int4 weights,", "e.g. Gemma 3 QAT (int4),", "Kimi K2 Thinking (INT4)"])]),
        ("PTQ", ["goal: cheap quantisation", "for inference"], GOLD, [
            (706, 934, ["GPTQ / AWQ on the finished", "weights; small calibration", "set, no training"])]),
    ]
    y = 80
    lh = 106
    for name, goal, col, cells in lanes:
        text(ax, x_lab, y + 26, name, size=FS_TITLE + 3, weight="bold", color=col)
        for i, s in enumerate(goal):
            text(ax, x_lab, y + 52 + i * 18, s, size=FS_SMALL)
        for x0, x1, lines in cells:
            box(ax, x0, y + 4, x1 - x0, lh - 18, fc=tint(col, 0.10), ec=col, lw=1.4, r=8)
            for i, s in enumerate(lines):
                text(ax, x0 + 12, y + 26 + i * 20, s, size=FS_SMALL)
        y += lh
    save(fig, out / "c3-qat-timeline.svg",
         "Where quantisation meets training: QLoRA quantises the frozen base before training to save memory; "
         "QAT fake-quantises during training with a straight-through estimator; PTQ (GPTQ, AWQ) quantises after training.", prev)


ALL = {
    "c1-ledger": c1_ledger,
    "c1-memory-timeline": c1_memory_timeline,
    "c1-activations": c1_activations,
    "c2-ba-shapes": c2_ba_shapes,
    "c2-lr-vs-rank": c2_lr_vs_rank,
    "c2-modules": c2_modules,
    "c2-capacity": c2_capacity,
    "c2-learns-less-forgets-less": c2_learns_less,
    "c2-merge-paths": c2_merge_paths,
    "c3-nf4-levels": c3_nf4_levels,
    "c3-qlora-dataflow": c3_qlora_dataflow,
    "c3-deploy": c3_deploy,
    "c3-qat-timeline": c3_qat_timeline,
}
