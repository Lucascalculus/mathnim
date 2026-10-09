"""Part C (efficiency) figures. Called from figures.py; each function writes one SVG."""
from __future__ import annotations

from pathlib import Path

import numpy as np
from matplotlib.lines import Line2D
from matplotlib.patches import Circle, Patch
from scipy.stats import norm

from fig_style import (ACCENT, CORAL, FAINT, FS, FS_NOTE, FS_SMALL, FS_TITLE, GOLD, GOOD,
                       INK, MUTED, PURPLE, TEAL, WHITE, arrow, box, canvas, credit, figure,
                       line, px_axes, rect, save, style_axes, text, tint)

# ---------------------------------------------------------------- ledger --
# part-c-efficiency.md C1, D5: Llama-3.1-8B, s = 4096, b = 1, activation
# recomputation on (1.07 + 0.57 GB), unfused fp32 logits + grad (2 x 2.10 GB),
# overhead 1 GB.
ACT = 1.07 + 0.57
LOGITS = 2 * 2.10
SEGS = {
    "trainable": ("trainable weights + grads + Adam", ACCENT, None),
    "frozen16": ("frozen weights, bf16", tint(PURPLE, 0.28), "////"),
    "nf4": ("frozen linear layers, NF4", tint(TEAL, 0.30), "xxx"),
    "act": ("activations (recomputed)", GOLD, None),
    "logits": ("logits + their gradient (fp32)", tint(CORAL, 0.35), "...."),
    "over": ("overhead (CUDA context, buffers)", tint(MUTED, 0.25), None),
}
HATCH_COL = {"frozen16": PURPLE, "nf4": TEAL, "logits": CORAL}
LEDGER = [
    ("Full FT", [("trainable", 128.5), ("act", ACT), ("logits", LOGITS), ("over", 1.0)]),
    ("LoRA r=16", [("frozen16", 16.06), ("trainable", 0.67), ("act", ACT), ("logits", LOGITS), ("over", 1.0)]),
    ("QLoRA", [("nf4", 3.60), ("frozen16", 2.10), ("trainable", 0.67), ("act", ACT), ("logits", LOGITS), ("over", 1.0)]),
]


def _stack(ax, x, parts, width):
    bottom = 0.0
    for key, v in parts:
        _, fc, hatch = SEGS[key]
        ax.bar(x, v, bottom=bottom, width=width, color=fc, hatch=hatch,
               edgecolor=HATCH_COL.get(key, WHITE), lw=0.6 if hatch else 0.8, zorder=2)
        bottom += v
    return bottom


def c1_ledger(out: Path, prev: Path | None):
    W, H = 960, 520
    fig = figure(W, H)
    # left: all three on one linear axis
    a1 = px_axes(fig, 70, 60, 300, 360)
    style_axes(a1, grid_y=True)
    for i, (name, parts) in enumerate(LEDGER):
        tot = _stack(a1, i, parts, 0.6)
        a1.text(i, tot + 2, f"≈{tot:.1f} GB" if tot < 100 else f"≈{tot:.0f} GB", ha="center", va="bottom",
                fontsize=FS, fontweight="bold", color=INK)
    for cap, lab in [(80, "80 GB (A100 / H100)"), (24, "24 GB (RTX 4090)")]:
        a1.axhline(cap, color=INK, lw=1.0, ls=(0, (5, 3)), zorder=3)
        a1.text(2.42, cap + 2, lab, ha="right", va="bottom", fontsize=FS_SMALL, color=INK,
                bbox=dict(boxstyle="round,pad=0.1", fc=WHITE, ec="none", alpha=0.9))
    a1.set_xticks(range(3))
    a1.set_xticklabels([n for n, _ in LEDGER])
    a1.set_xlim(-0.5, 2.5)
    a1.set_ylim(0, 150)
    a1.set_ylabel("GPU memory (GB)")
    a1.tick_params(axis="x", length=0)
    fig.text(70 / W, 1 - 18 / H, "All three methods", fontsize=FS_TITLE, fontweight="bold", va="top")

    # right: zoom on LoRA and QLoRA, with labelled segments
    a2 = px_axes(fig, 470, 60, 220, 360)
    style_axes(a2, grid_y=True)
    for i, (name, parts) in enumerate(LEDGER[1:]):
        tot = _stack(a2, i, parts, 0.62)
        a2.text(i, tot + 0.4, f"≈{tot:.1f} GB", ha="center", va="bottom", fontsize=FS, fontweight="bold")
    a2.axhline(24, color=INK, lw=1.0, ls=(0, (5, 3)), zorder=3)
    a2.text(1.42, 24.25, "24 GB", ha="right", va="bottom", fontsize=FS_SMALL)
    a2.set_xticks(range(2))
    a2.set_xticklabels([n for n, _ in LEDGER[1:]])
    a2.set_xlim(-0.5, 1.5)
    a2.set_ylim(0, 27)
    a2.set_ylabel("GB (zoomed: 0–27)")
    a2.tick_params(axis="x", length=0)
    fig.text(470 / W, 1 - 18 / H, "Zoom: LoRA and QLoRA", fontsize=FS_TITLE, fontweight="bold", va="top")
    # value labels next to the QLoRA bar (right side)
    bottom = 0.0
    ypos = []
    for key, v in LEDGER[2][1]:
        ypos.append((key, v, bottom + v / 2))
        bottom += v
    # LoRA values on the left of the LoRA bar
    bottom = 0.0
    for key, v in LEDGER[1][1]:
        if v > 0.9:
            a2.text(-0.34, bottom + v / 2, f"{v:.2f}" if v < 10 else f"{v:.2f}", ha="right", va="center",
                    fontsize=FS_SMALL, color=INK)
        bottom += v
    a2.annotate("0.67", (-0.31, 16.06 + 0.335), xytext=(-0.45, 16.06 + 0.335), ha="right", va="center",
                fontsize=FS_SMALL, color=ACCENT)
    # legend (right column) doubles as segment key
    lx = 760
    keys = ["trainable", "frozen16", "nf4", "act", "logits", "over"]
    vals = {"trainable": "Full 128.5 · LoRA/QLoRA 0.67", "frozen16": "LoRA 16.06 · QLoRA 2.10 (embed + head)",
            "nf4": "QLoRA 3.60", "act": "1.6 (layer inputs + one layer)", "logits": "4.2 (unfused cross-entropy)",
            "over": "≈1"}
    for i, k in enumerate(keys):
        lab, fc, hatch = SEGS[k]
        yy = 72 + i * 58
        r = rect_fig(fig, lx, yy, 22, 16, fc, hatch, HATCH_COL.get(k, WHITE))
        fig.text((lx + 30) / W, 1 - (yy + 8) / H, lab, fontsize=FS_SMALL, va="center", fontweight="bold")
        fig.text((lx + 30) / W, 1 - (yy + 27) / H, vals[k], fontsize=FS_SMALL, va="center", color=MUTED)
    credit(fig, "Estimate (formulas in C1): Llama-3.1-8B, sequence 4096, batch 1, activation recomputation on, "
                "unfused cross-entropy; GB = 10⁹ bytes")
    save(fig, out / "c1-ledger.svg",
         "Estimated GPU memory for fine-tuning Llama-3.1-8B: full fine-tuning about 135 GB, LoRA about 23.6 GB, "
         "QLoRA about 13.2 GB, with 24 GB and 80 GB capacity lines.", prev)


def rect_fig(fig, x, y, w, h, fc, hatch, hc):
    W = fig.get_figwidth() * 72
    H = fig.get_figheight() * 72
    from matplotlib.patches import Rectangle
    r = Rectangle((x / W, 1 - (y + h) / H), w / W, h / H, transform=fig.transFigure, fc=fc,
                  hatch=hatch, ec=hc if hatch else "none", lw=0.6)
    fig.patches.append(r)
    return r


# --------------------------------------------------------- memory timeline --

def c1_memory_timeline(out: Path, prev: Path | None):
    W, H = 960, 440
    fig = figure(W, H)
    ax = px_axes(fig, 70, 60, 660, 310)
    style_axes(ax)
    t = np.linspace(0, 10, 2001)
    L = 8  # layers in the cartoon
    f_end, b_end = 4.0, 8.4
    weights = np.full_like(t, 2.6)
    optim = np.full_like(t, 3.4)
    act = np.where(t <= f_end, np.ceil(t / f_end * L) / L * 3.2,
                   np.where(t <= b_end, np.ceil((b_end - t) / (b_end - f_end) * L) / L * 3.2, 0.0))
    logits = np.where((t > f_end - 0.35) & (t < f_end + 0.45), 1.3, 0.0)
    grads = np.where(t <= f_end, 0.0, np.where(t <= b_end, (t - f_end) / (b_end - f_end) * 2.6, 2.6))
    grads = np.where(t > 9.6, 0.0, grads)
    temp = np.where((t > b_end + 0.2) & (t < 9.4), 0.9, 0.0)
    layers = [("weights", weights, tint(PURPLE, 0.28), "////", PURPLE),
              ("optimizer states (Adam m, v, fp32 master)", optim, tint(TEAL, 0.30), "xxx", TEAL),
              ("gradients", grads, tint(ACCENT, 0.45), None, ACCENT),
              ("activations", act, GOLD, None, GOLD),
              ("logits", logits, tint(CORAL, 0.40), "....", CORAL),
              ("optimizer temporaries", temp, tint(MUTED, 0.35), None, MUTED)]
    base = np.zeros_like(t)
    for name, y, fc, hatch, ec in layers:
        ax.fill_between(t, base, base + y, color=fc, hatch=hatch, edgecolor=ec if hatch else "none",
                        lw=0.0, step=None, zorder=2)
        base = base + y
    ax.plot(t, base, color=INK, lw=1.2, zorder=3)
    for xb in (f_end, b_end):
        ax.axvline(xb, color=MUTED, lw=1, ls=(0, (4, 3)), zorder=1)
    ymax = base.max()
    for x0, x1, lab in [(0, f_end, "forward"), (f_end, b_end, "backward"), (b_end, 10, "optimizer step")]:
        ax.text((x0 + x1) / 2, ymax * 1.16, lab, ha="center", va="center", fontsize=FS, fontweight="bold")
    k = np.argmax(base)
    ax.annotate("peak: end of forward\n(activations + logits)", (t[k], base[k]), xytext=(1.0, ymax * 0.98),
                fontsize=FS_SMALL, ha="left", va="center", arrowprops=dict(arrowstyle="-", color=MUTED, lw=1))
    ax.annotate("activations freed\nlayer by layer", (6.6, 6.0 + 0.8 + 0.9), xytext=(5.3, ymax * 0.98),
                fontsize=FS_SMALL, ha="left", va="center", arrowprops=dict(arrowstyle="-", color=MUTED, lw=1))
    ax.annotate("gradients freed\n(zero_grad)", (9.62, 6.0), xytext=(8.0, ymax * 0.98), fontsize=FS_SMALL,
                ha="left", va="center", arrowprops=dict(arrowstyle="-", color=MUTED, lw=1))
    ax.set_xlim(0, 10)
    ax.set_ylim(0, ymax * 1.25)
    ax.set_xticks([])
    ax.set_yticks([])
    ax.set_xlabel("time within one training step →")
    ax.set_ylabel("allocated GPU memory →")
    # legend
    handles = [Patch(fc=fc, hatch=hatch, ec=ec if hatch else "none", lw=0.6, label=name)
               for name, _, fc, hatch, ec in layers[::-1]]
    fig.legend(handles=handles, loc="upper left", bbox_to_anchor=(748 / W, 1 - 70 / H), fontsize=FS_SMALL,
               handlelength=2.0, handleheight=1.2, labelspacing=0.9)
    credit(fig, "Schematic (mixed-precision AdamW); shapes as seen in a PyTorch memory snapshot, proportions not to scale")
    save(fig, out / "c1-memory-timeline.svg",
         "Schematic of GPU memory during one training step: activations climb in the forward pass, are freed in "
         "the backward pass while gradients are allocated, and the optimizer step adds a short spike.", prev)


# ------------------------------------------------------------ activations --

def c1_activations(out: Path, prev: Path | None):
    # Korthikanti et al. 2022 (arXiv 2205.05198), §4.1: bytes stored per layer,
    # 16-bit activations, 1-byte dropout masks; s seq, b batch, h hidden, a heads.
    rows = [
        ("LayerNorm 1", "input", "2·sbh", "ln", False),
        ("Q, K, V projections", "shared input", "2·sbh", "attn", False),
        ("Q·Kᵀ", "Q and K", "4·sbh", "attn", False),
        ("softmax", "output", "2·as²b", "attn", True),
        ("softmax dropout", "mask", "as²b", "attn", True),
        ("attention over V", "dropout output", "2·as²b", "attn", True),
        ("", "V", "2·sbh", "attn", False),
        ("output projection", "input", "2·sbh", "attn", False),
        ("attention dropout", "mask", "sbh", "attn", False),
        ("LayerNorm 2", "input", "2·sbh", "ln", False),
        ("MLP linear 1 (h → 4h)", "input", "2·sbh", "mlp", False),
        ("GeLU", "input", "8·sbh", "mlp", False),
        ("MLP linear 2 (4h → h)", "input", "8·sbh", "mlp", False),
        ("MLP dropout", "mask", "sbh", "mlp", False),
    ]
    col = {"ln": TEAL, "attn": ACCENT, "mlp": PURPLE}
    W, H = 960, 600
    fig, ax = canvas(W, H)
    x_op, w_op = 30, 230
    x_t = 300
    y0, rh = 40, 31
    text(ax, x_op, 20, "operation in one layer", size=FS_SMALL, color=MUTED)
    text(ax, x_t, 20, "tensor kept for backward", size=FS_SMALL, color=MUTED)
    text(ax, x_t + 250, 20, "bytes", size=FS_SMALL, color=MUTED)
    group_span: dict[str, list[float]] = {}
    for i, (op, tensor, size, grp, quad) in enumerate(rows):
        y = y0 + i * rh
        c = col[grp]
        if op:
            box(ax, x_op, y + 3, w_op, rh - 6, fc=tint(c, 0.08), ec=c, lw=1.1, r=5)
            text(ax, x_op + 10, y + rh / 2, op, size=FS_SMALL + 0.5)
        if quad:
            rect(ax, x_t - 6, y + 4, 330, rh - 8, fc=tint(CORAL, 0.12), ec=CORAL, lw=0.6, hatch="////",
                 hatch_color=tint(CORAL, 0.45), z=0)
        text(ax, x_t, y + rh / 2, tensor, size=FS_SMALL + 0.5,
             bbox=dict(boxstyle="round,pad=0.12", fc=WHITE, ec="none") if quad else None)
        text(ax, x_t + 250, y + rh / 2, size, size=FS, weight="bold", color=CORAL if quad else INK,
             bbox=dict(boxstyle="round,pad=0.12", fc=WHITE, ec="none") if quad else None)
        group_span.setdefault(grp, []).append(y)
    # group brackets on the right
    bx = 660

    def bracket(ys, label, sub, c):
        top, bot = min(ys) + 5, max(ys) + rh - 5
        line(ax, [bx, bx + 8, bx + 8, bx], [top, top, bot, bot], color=c, lw=1.6)
        ym = (top + bot) / 2
        text(ax, bx + 18, ym - 10, label, size=FS + 1, weight="bold", color=c)
        text(ax, bx + 18, ym + 10, sub, size=FS_SMALL, color=INK)

    bracket(group_span["attn"], "attention: 11·sbh", "+ 5·as²b for scores/softmax", ACCENT)
    bracket(group_span["mlp"], "MLP: 19·sbh", "", PURPLE)
    ln_ys = group_span["ln"]
    for yy in ln_ys:
        line(ax, [bx, bx + 8], [yy + rh / 2, yy + rh / 2], color=TEAL, lw=1.6)
    text(ax, bx + 18, ln_ys[0] + rh / 2, "LayerNorms: 2 × 2·sbh = 4·sbh", size=FS_SMALL + 0.5, color=TEAL,
         weight="bold")
    text(ax, bx + 18, ln_ys[1] + rh / 2, "(both counted together)", size=FS_SMALL, color=TEAL)

    # total line
    yt = y0 + len(rows) * rh + 22
    box(ax, 30, yt - 4, 900, 76, fc=tint(FAINT, 0.5), ec=MUTED, lw=1.0, r=8)
    text(ax, 46, yt + 16, "per layer: 34·sbh bytes  (+ 5·as²b without FlashAttention)", size=FS_TITLE, weight="bold")
    text(ax, 46, yt + 42, "Llama-3.1-8B, s = 4096, b = 1: sbh = 16.8M → 34·sbh ≈ 0.57 GB per layer, × 32 layers ≈ 18.3 GB "
         "(no recomputation)", size=FS_SMALL)
    rect(ax, 46, yt + 56, 22, 12, fc=tint(CORAL, 0.12), ec=CORAL, lw=0.6, hatch="////", hatch_color=tint(CORAL, 0.45))
    text(ax, 76, yt + 62, "s × s tensors: FlashAttention does not store them (recomputes in the backward pass)",
         size=FS_SMALL, color=INK)
    credit(fig, "After Korthikanti et al. 2022, §4.1 (GPT layer, 16-bit activations, 1-byte dropout masks)")
    save(fig, out / "c1-activations.svg",
         "Activations one transformer layer keeps for the backward pass, per Korthikanti et al. 2022: attention "
         "11 sbh plus 5 as^2 b, MLP 19 sbh, two LayerNorms 4 sbh, 34 sbh bytes in total.", prev)


# --------------------------------------------------------------- B·A shapes --

def c2_ba_shapes(out: Path, prev: Path | None):
    d = k = 4096
    r = 16
    W, H = 960, 470
    fig, ax = canvas(W, H)
    S = 280
    y = 90
    sc = S / d
    x_w = 40
    rect(ax, x_w, y, S, S, fc=tint(MUTED, 0.14), ec=MUTED, lw=1.2)
    text(ax, x_w + S / 2, y - 34, "ΔW", size=FS_TITLE + 3, weight="bold", ha="center")
    text(ax, x_w + S / 2, y - 14, "d × k = 4096 × 4096", size=FS_SMALL, ha="center", color=MUTED)
    # small square with the same area as B and A together
    side = S * np.sqrt(r * (d + k) / (d * k))
    rect(ax, x_w + S - side - 14, y + S - side - 14, side, side, fc=ACCENT, ec="none")
    text(ax, x_w + S - side - 22, y + S - side / 2 - 14, "same area as\nB and A together", size=FS_SMALL,
         ha="right", color=ACCENT, va="center")
    text(ax, x_w + S + 25, y + S / 2, "=", size=28, ha="center")
    # B: d x r, drawn to scale
    x_b = x_w + S + 52
    rect(ax, x_b, y, r * sc, S, fc=ACCENT, ec="none")
    text(ax, x_b + 2, y - 34, "B", size=FS_TITLE + 3, weight="bold", ha="center", color=ACCENT)
    text(ax, x_b + 2, y - 14, "d × r", size=FS_SMALL, ha="center", color=MUTED)
    text(ax, x_b + 12, y + S + 4, "4096 × 16", size=FS_SMALL, color=ACCENT, va="top")
    text(ax, x_b + 30, y + S / 2, "·", size=28, ha="center")
    # A: r x k, drawn to scale
    x_a = x_b + 58
    rect(ax, x_a, y + S / 2 - r * sc / 2, S, r * sc, fc=ACCENT, ec="none")
    text(ax, x_a + S / 2, y - 34, "A", size=FS_TITLE + 3, weight="bold", ha="center", color=ACCENT)
    text(ax, x_a + S / 2, y - 14, "r × k", size=FS_SMALL, ha="center", color=MUTED)
    text(ax, x_a + S / 2, y + S / 2 + 12, "16 × 4096", size=FS_SMALL, color=ACCENT, ha="center", va="top")
    text(ax, x_a, y + S + 4, "drawn to scale: r = 16 is 0.4% of 4096", size=FS_SMALL, color=MUTED, va="top")

    # counts
    nx = x_a + S + 36
    full = d * k
    lora = r * (d + k)
    rows = [("ΔW", f"{d}·{k} = {full:,}", "16.8M", INK),
            ("B", f"{d}·{r} = {d * r:,}", "", ACCENT),
            ("A", f"{r}·{k} = {r * k:,}", "", ACCENT),
            ("B + A", f"r(d + k) = {lora:,}", "131k", ACCENT)]
    text(ax, nx, y - 34, "parameters", size=FS_TITLE, weight="bold")
    for i, (n, expr, short, c) in enumerate(rows):
        yy = y + 6 + i * 44
        text(ax, nx, yy, n, size=FS, weight="bold", color=c)
        text(ax, nx, yy + 19, expr, size=FS_SMALL, color=INK)
    text(ax, nx, y + 200, f"{lora / full:.2%} of ΔW", size=FS_TITLE + 4, weight="bold", color=ACCENT)
    text(ax, nx, y + 226, "rank(BA) ≤ 16", size=FS, color=INK)
    text(ax, nx, y + 250, "16.8M vs 131k", size=FS_SMALL, color=MUTED)
    save(fig, out / "c2-ba-shapes.svg",
         "Delta W of 4096 by 4096 equals B (4096 by 16) times A (16 by 4096), drawn to scale: 16.8 million "
         "parameters versus 131 thousand, 0.78%.", prev)


# ------------------------------------------------- LoRA Without Regret (3) --

def _u(x, opt, m, cl=0.030, cr=0.075):
    lx = np.log10(x) - np.log10(opt)
    return m + np.where(lx < 0, cl * lx ** 2, cr * lx ** 2 + 0.03 * np.maximum(lx - 0.6, 0) ** 3)


RANK_STYLE = {1: (tint(ACCENT, 0.40), (0, (1.5, 2))), 4: (tint(ACCENT, 0.55), (0, (3, 2))),
              16: (tint(ACCENT, 0.72), (0, (6, 2.5))), 64: (tint(ACCENT, 0.86), (0, (10, 2.5))),
              256: (ACCENT, "-")}


def c2_lr_vs_rank(out: Path, prev: Path | None):
    W, H = 900, 470
    fig = figure(W, H)
    ax = px_axes(fig, 80, 40, 560, 350)
    style_axes(ax)
    x = np.logspace(-1.3, 2.3, 400)
    ax.plot(x, _u(x, 1.0, 1.000), color=INK, lw=2.4, zorder=4)
    ax.plot([1.0], [1.000], "o", color=INK, ms=7, zorder=5)
    opts = {1: (6.0, 1.060), 4: (9.0, 1.030), 16: (10.0, 1.014), 64: (10.5, 1.005), 256: (11.0, 1.001)}
    for rnk, (o, m) in opts.items():
        c, ls = RANK_STYLE[rnk]
        ax.plot(x, _u(x, o, m), color=c, lw=2.0, ls=ls, zorder=3)
        ax.plot([o], [m], "o", color=c, ms=6, zorder=5, mec=WHITE, mew=0.8)
    ax.annotate("", xy=(10.0, 0.975), xytext=(1.0, 0.975),
                arrowprops=dict(arrowstyle="-|>", color=INK, lw=1.4, mutation_scale=14))
    ax.text(3.2, 0.968, "≈10× higher learning rate for LoRA (fitted 9.8×)", ha="center", va="top", fontsize=FS)
    ax.axvline(1.0, color=MUTED, lw=0.8, ls=(0, (2, 3)), zorder=1)
    ax.axvline(10.0, color=MUTED, lw=0.8, ls=(0, (2, 3)), zorder=1)
    ax.set_xscale("log")
    ax.set_xlim(x[0], x[-1])
    ax.set_ylim(0.94, 1.17)
    ax.set_yticks([])
    ax.set_xticks([0.1, 1, 10, 100])
    ax.set_xticklabels(["0.1×", "1×", "10×", "100×"])
    ax.minorticks_off()
    ax.set_xlabel("learning rate, relative to full fine-tuning's best (log scale)")
    ax.set_ylabel("final loss (lower is better) →")
    handles = [Line2D([], [], color=INK, lw=2.4, label="full fine-tuning")]
    for rnk in (256, 64, 16, 4, 1):
        c, ls = RANK_STYLE[rnk]
        handles.append(Line2D([], [], color=c, lw=2.0, ls=ls, label=f"LoRA rank {rnk}"))
    fig.legend(handles=handles, loc="upper left", bbox_to_anchor=(660 / W, 1 - 40 / H), fontsize=FS,
               labelspacing=0.7, handlelength=2.6)
    notes = ["LoRA optima line up across", "ranks (within 2× from rank 4", "to 512); rank 1 prefers a", "slightly lower LR.", "",
             "High ranks reach the same", "minimum loss as full FT."]
    for i, s in enumerate(notes):
        fig.text(660 / W, 1 - (250 + i * 19) / H, s, fontsize=FS_SMALL, va="center")
    credit(fig, "Schematic redraw after LoRA Without Regret (Schulman / Thinking Machines, 2025), Tulu3 LR sweep; values approximate")
    save(fig, out / "c2-lr-vs-rank.svg",
         "Schematic: final loss versus learning rate for LoRA ranks 1 to 256 and full fine-tuning; LoRA's best "
         "learning rates line up about 10 times higher than full fine-tuning's.", prev)


def c2_modules(out: Path, prev: Path | None):
    W, H = 900, 470
    fig = figure(W, H)
    ax = px_axes(fig, 80, 40, 560, 350)
    style_axes(ax)
    x = np.logspace(-0.3, 2.3, 400)
    cfg = [("all layers (MLP + attention), r = 256", "0.70B", 10.0, 1.003, ACCENT, "-"),
           ("MLP only, r = 256", "0.49B", 10.0, 1.005, PURPLE, (0, (6, 2.5))),
           ("MLP only, r = 128", "0.24B", 10.0, 1.009, PURPLE, (0, (2, 2))),
           ("attention only, r = 256", "0.25B", 7.0, 1.045, CORAL, (0, (8, 3, 2, 3)))]
    for name, p, o, m, c, ls in cfg:
        ax.plot(x, _u(x, o, m), color=c, lw=2.2, ls=ls, zorder=3)
        ax.plot([o], [m], "o", color=c, ms=6, mec=WHITE, mew=0.8, zorder=4)
    ax.axhline(1.0, color=INK, lw=1.2, ls=(0, (1, 2.5)), zorder=2)
    ax.text(0.55, 0.997, "full fine-tuning, best loss", fontsize=FS_SMALL, va="top", color=INK)
    ax.annotate("matched size (~0.25B):\nattention-only is clearly worse", xy=(7.0, 1.045), xytext=(0.62, 1.075),
                fontsize=FS_SMALL, color=CORAL, arrowprops=dict(arrowstyle="-", color=CORAL, lw=1))
    ax.set_xscale("log")
    ax.set_xlim(x[0], x[-1])
    ax.set_ylim(0.985, 1.12)
    ax.set_yticks([])
    ax.set_xticks([1, 10, 100])
    ax.set_xticklabels(["1×", "10×", "100×"])
    ax.minorticks_off()
    ax.set_xlabel("learning rate, relative to full fine-tuning's best (log scale)")
    ax.set_ylabel("final loss (lower is better) →")
    handles = [Line2D([], [], color=c, lw=2.2, ls=ls, label=f"{name}\n{p} trainable params") for name, p, o, m, c, ls in cfg]
    fig.legend(handles=handles, loc="upper left", bbox_to_anchor=(660 / W, 1 - 40 / H), fontsize=FS_SMALL,
               labelspacing=1.1, handlelength=2.6)
    fig.text(660 / W, 1 - 330 / H, "Parameter counts for\nLlama-3.1-8B, as reported.", fontsize=FS_SMALL, va="top",
             color=MUTED)
    credit(fig, "Schematic redraw after LoRA Without Regret (Schulman / Thinking Machines, 2025); curves approximate, "
                "parameter counts as reported")
    save(fig, out / "c2-modules.svg",
         "Schematic: LoRA on MLP layers or on all layers comes close to full fine-tuning; attention-only LoRA is "
         "worse even with a matched parameter count.", prev)


def c2_capacity(out: Path, prev: Path | None):
    W, H = 900, 470
    fig = figure(W, H)
    ax = px_axes(fig, 80, 40, 560, 350)
    style_axes(ax)
    s = np.logspace(1, 4, 400)
    full = 1.6 - 0.30 * np.log10(s)
    ax.plot(s, full, color=INK, lw=2.6, zorder=4)
    falloff = {1: 60, 4: 220, 16: 800, 64: 2600, 256: 1e9}
    for rnk, s0 in falloff.items():
        c, ls = RANK_STYLE[rnk]
        excess = np.where(s > s0, 0.30 * 0.75 * (np.log10(s) - np.log10(s0)), 0.0)
        y = full + excess + 0.004 * (rnk == 256)
        ax.plot(s, y, color=c, lw=2.0, ls=ls, zorder=3)
        if s0 < 1e4:
            ax.plot([s0], [1.6 - 0.30 * np.log10(s0)], "o", ms=6, color=c, mec=WHITE, mew=0.8, zorder=5)
    ax.annotate("lower ranks leave the full-FT line\nwhen the adapter runs out of capacity",
                xy=(220, 1.6 - 0.30 * np.log10(220)), xytext=(13, 0.62), fontsize=FS_SMALL,
                arrowprops=dict(arrowstyle="-", color=MUTED, lw=1))
    ax.set_xscale("log")
    ax.set_xlim(10, 1e4)
    ax.set_ylim(0.35, 1.4)
    ax.set_yticks([])
    ax.set_xticks([10, 100, 1000, 10000])
    ax.set_xticklabels(["10", "100", "1K", "10K"])
    ax.minorticks_off()
    ax.set_xlabel("training steps (log scale; more steps = more data seen)")
    ax.set_ylabel("training loss (lower is better) →")
    handles = [Line2D([], [], color=INK, lw=2.6, label="full fine-tuning")]
    for rnk in (256, 64, 16, 4, 1):
        c, ls = RANK_STYLE[rnk]
        handles.append(Line2D([], [], color=c, lw=2.0, ls=ls, label=f"LoRA rank {rnk}"))
    fig.legend(handles=handles, loc="upper left", bbox_to_anchor=(660 / W, 1 - 40 / H), fontsize=FS,
               labelspacing=0.7, handlelength=2.6)
    notes = ["Loss falls linearly in", "log(steps) for full FT.", "",
             "Small and medium datasets:", "LoRA tracks full FT.", "",
             "Large datasets: low ranks", "fall behind (capacity-bound).", "Rank 1 drops off first."]
    for i, t_ in enumerate(notes):
        fig.text(660 / W, 1 - (250 + i * 19) / H, t_, fontsize=FS_SMALL, va="center")
    credit(fig, "Schematic redraw after LoRA Without Regret (Schulman / Thinking Machines, 2025), Fig. 1; values approximate")
    save(fig, out / "c2-capacity.svg",
         "Schematic: training loss versus steps for full fine-tuning and LoRA ranks; low ranks leave the full "
         "fine-tuning line when they run out of capacity on large datasets.", prev)


# ------------------------------------------- learns less, forgets less --

BID = {
    # Biderman et al. 2024 (arXiv 2405.09673), Tables S1-S2 (code CPT, StarCoder-Python, 0.25-20B tokens)
    "cpt": {
        "x": {16: [0.143, 0.144, 0.141, 0.141, 0.154, 0.159, 0.162, 0.162],
              64: [0.142, 0.146, 0.141, 0.153, 0.157, 0.176, 0.194, 0.196],
              256: [0.144, 0.142, 0.143, 0.159, 0.159, 0.208, 0.211, 0.224],
              0: [0.152, 0.153, 0.172, 0.181, 0.218, 0.258, 0.255, 0.263]},
        "y": {16: [0.645, 0.642, 0.645, 0.642, 0.644, 0.640, 0.638, 0.635],
              64: [0.646, 0.644, 0.646, 0.646, 0.639, 0.634, 0.626, 0.626],
              256: [0.644, 0.645, 0.643, 0.639, 0.636, 0.630, 0.618, 0.617],
              0: [0.625, 0.624, 0.625, 0.616, 0.599, 0.583, 0.551, 0.545]},
        "end": "20B tokens",
    },
    # Tables S5-S6 (code IFT, Magicoder-Evol-Instruct-110K, epochs 1, 2, 4, 8, 16)
    "ift": {
        "x": {16: [0.197, 0.275, 0.358, 0.338, 0.324],
              64: [0.249, 0.339, 0.417, 0.392, 0.405],
              256: [0.299, 0.385, 0.498, 0.437, 0.466],
              0: [0.302, 0.464, 0.470, 0.497, 0.416]},
        "y": {16: [0.653, 0.648, 0.652, 0.646, 0.609],
              64: [0.652, 0.651, 0.632, 0.580, 0.510],
              256: [0.655, 0.659, 0.631, 0.552, 0.517],
              0: [0.595, 0.579, 0.512, 0.446, 0.414]},
        "end": "16 epochs",
    },
}


def c2_learns_less(out: Path, prev: Path | None):
    W, H = 960, 480
    fig = figure(W, H)
    style = {16: (tint(ACCENT, 0.55), "o", "LoRA r = 16"), 64: (tint(ACCENT, 0.8), "s", "LoRA r = 64"),
             256: (ACCENT, "D", "LoRA r = 256"), 0: (CORAL, "^", "full fine-tuning")}
    panels = [("cpt", "Code continued pretraining", "StarCoder-Python, 0.25 → 20B tokens", (0.13, 0.28), (0.53, 0.66)),
              ("ift", "Code instruction tuning", "Magicoder-Evol-Instruct-110K, 1 → 16 epochs", (0.17, 0.53), (0.39, 0.68))]
    for j, (key, title, sub, xl, yl) in enumerate(panels):
        a = px_axes(fig, 80 + j * 420, 70, 330, 320)
        style_axes(a, grid_y=True, grid_x=True)
        for rk in (16, 64, 256, 0):
            c, m, lab = style[rk]
            xs, ys = BID[key]["x"][rk], BID[key]["y"][rk]
            a.plot(xs, ys, color=c, lw=1.4, alpha=0.9, zorder=2)
            a.plot(xs[:-1], ys[:-1], m, color=c, ms=5, mfc=WHITE, mec=c, mew=1.3, zorder=3)
            a.plot(xs[-1:], ys[-1:], m, color=c, ms=9, mec=WHITE, mew=0.8, zorder=4)
        a.set_xlim(*xl)
        a.set_ylim(*yl)
        a.set_xlabel("HumanEval pass@1 (target domain) →")
        if j == 0:
            a.set_ylabel("source-domain score (↓ = more forgetting)")
        fig.text((80 + j * 420) / W, 1 - 18 / H, title, fontsize=FS_TITLE, fontweight="bold", va="top")
        fig.text((80 + j * 420) / W, 1 - 38 / H, sub + "; big marker = last checkpoint", fontsize=FS_SMALL,
                 color=MUTED, va="top")
    handles = [Line2D([], [], color=style[k][0], marker=style[k][1], ms=8, lw=1.4, label=style[k][2])
               for k in (16, 64, 256, 0)]
    fig.legend(handles=handles, loc="lower center", bbox_to_anchor=(0.5, 28 / H), ncol=4, fontsize=FS,
               columnspacing=2.0)
    credit(fig, "Data: Biderman et al. 2024 (LoRA Learns Less and Forgets Less), Tables S1–S2, S5–S6; Llama-2-7B; "
                "source score = mean of HellaSwag, ARC-Challenge, WinoGrande")
    save(fig, out / "c2-learns-less-forgets-less.svg",
         "Target-domain HumanEval versus source-domain score for LoRA ranks 16, 64, 256 and full fine-tuning "
         "on code: LoRA learns less and forgets less.", prev)


# ------------------------------------------------------------ merge paths --

def c2_merge_paths(out: Path, prev: Path | None):
    W, H = 960, 440
    fig, ax = canvas(W, H)
    # left: merged
    text(ax, 30, 26, "Merged", size=FS_TITLE + 1, weight="bold")
    text(ax, 30, 48, "W′ = W₀ + (α/r)·B·A, computed once after training", size=FS_SMALL, color=MUTED)
    box(ax, 120, 130, 200, 120, fc=tint(PURPLE, 0.10), ec=PURPLE, lw=1.6, r=8)
    text(ax, 220, 175, "W′", size=FS_TITLE + 4, weight="bold", ha="center", color=PURPLE)
    text(ax, 220, 205, "d × k (same shape as W₀)", size=FS_SMALL, ha="center")
    arrow(ax, 220, 330, 220, 256, lw=1.8)
    text(ax, 220, 345, "x", size=FS_TITLE + 2, ha="center", style="italic")
    arrow(ax, 220, 124, 220, 80, lw=1.8)
    text(ax, 220, 68, "h = W′x", size=FS_TITLE, ha="center", style="italic")
    for i, s in enumerate(["one matmul: no extra latency", "one full-size model per adapter"]):
        text(ax, 40, 382 + i * 20, "· " + s, size=FS_SMALL)

    # right: unmerged
    ox = 480
    line(ax, [ox - 30, ox - 30], [20, 420], color=FAINT, lw=1.2)
    text(ax, ox, 26, "Unmerged", size=FS_TITLE + 1, weight="bold")
    text(ax, ox, 48, "frozen W₀ plus the adapter path, kept separate", size=FS_SMALL, color=MUTED)
    box(ax, ox + 30, 130, 200, 120, fc=tint(MUTED, 0.12), ec=MUTED, lw=1.6, r=8)
    text(ax, ox + 130, 175, "W₀", size=FS_TITLE + 4, weight="bold", ha="center")
    text(ax, ox + 130, 205, "d × k, frozen, shared", size=FS_SMALL, ha="center")
    # adapter path
    box(ax, ox + 290, 200, 120, 40, fc=tint(ACCENT, 0.12), ec=ACCENT, lw=1.6, r=6)
    text(ax, ox + 350, 220, "A  (r × k)", size=FS, ha="center", color=ACCENT, weight="bold")
    box(ax, ox + 290, 132, 120, 40, fc=tint(ACCENT, 0.12), ec=ACCENT, lw=1.6, r=6)
    text(ax, ox + 350, 152, "B  (d × r)", size=FS, ha="center", color=ACCENT, weight="bold")
    # x splits
    line(ax, [ox + 130, ox + 130], [330, 290], lw=1.8)
    line(ax, [ox + 130, ox + 350], [290, 290], lw=1.8)
    arrow(ax, ox + 130, 290, ox + 130, 256, lw=1.8)
    arrow(ax, ox + 350, 290, ox + 350, 246, lw=1.8, color=ACCENT)
    text(ax, ox + 130, 345, "x", size=FS_TITLE + 2, ha="center", style="italic")
    arrow(ax, ox + 350, 194, ox + 350, 178, lw=1.8, color=ACCENT)
    text(ax, ox + 420, 186, "r-dim", size=FS_SMALL, color=ACCENT)
    # sum
    ax.add_patch(Circle((ox + 240, 90), 15, fc=WHITE, ec=INK, lw=1.6, zorder=3))
    text(ax, ox + 240, 90, "+", size=FS_TITLE + 3, ha="center", z=4)
    line(ax, [ox + 130, ox + 130, ox + 222], [124, 90, 90], lw=1.8)
    line(ax, [ox + 350, ox + 350, ox + 258], [126, 90, 90], lw=1.8, color=ACCENT)
    text(ax, ox + 356, 108, "× α/r", size=FS_SMALL, color=ACCENT)
    arrow(ax, ox + 240, 74, ox + 240, 50 + 12, lw=1.8)
    text(ax, ox + 290, 66, "h = W₀x + (α/r)·B(Ax)", size=FS, style="italic")
    for i, s in enumerate(["two extra small matmuls: a little extra latency",
                           "one base serves many swappable adapters"]):
        text(ax, ox + 10, 382 + i * 20, "· " + s, size=FS_SMALL)
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
    absmax_int4 = 2.5
    int4 = np.arange(-7, 8) / 7 * absmax_int4
    W, H = 960, 600
    fig = figure(W, H)
    z = np.linspace(-3.2, 3.2, 600)
    panels = [("NF4: 16 levels at quantiles of N(0, 1)", nf4 * zmax, ACCENT,
               f"normalised levels × {zmax:.3f} (the outermost level is the 0.9677 quantile); one exact 0"),
              ("int4 absmax: 15 evenly spaced levels", int4, GOLD,
               "levels k/7 × 2.5σ, k = −7…7 (block absmax ≈ 2.5σ, typical for 64 weights)")]
    for j, (title, lv_z, col, sub) in enumerate(panels):
        top = 56 + j * 272
        a = px_axes(fig, 70, top, 820, 150)
        b = px_axes(fig, 70, top + 158, 820, 62)
        style_axes(a)
        style_axes(b)
        lv, edges, mass = _bin_mass(lv_z)
        a.plot(z, norm.pdf(z), color=INK, lw=1.6, zorder=3)
        a.fill_between(z, 0, norm.pdf(z), color=tint(FAINT, 0.6), zorder=1)
        for i, l in enumerate(lv):
            a.plot([l, l], [0, norm.pdf(l)], color=col, lw=1.8, zorder=4)
            a.plot([l], [norm.pdf(l)], "o", color=col, ms=5, zorder=5)
        a.set_xlim(-3.2, 3.2)
        a.set_ylim(0, 0.44)
        a.set_xticks([])
        a.set_yticks([])
        a.spines["bottom"].set_visible(False)
        a.spines["left"].set_visible(False)
        fig.text(70 / W, 1 - (top - 34) / H, title, fontsize=FS_TITLE, fontweight="bold", color=col, va="top")
        fig.text(70 / W, 1 - (top - 14) / H, sub, fontsize=FS_SMALL, color=MUTED, va="top")
        # probability mass per bin (bars span each level's rounding bin)
        e = np.clip(edges, -3.2, 3.2)
        for i in range(len(lv)):
            b.bar((e[i] + e[i + 1]) / 2, mass[i], width=(e[i + 1] - e[i]) * 0.94, color=tint(col, 0.45 if i % 2 else 0.7),
                  edgecolor=col, lw=0.6, zorder=2)
        b.set_xlim(-3.2, 3.2)
        b.set_ylim(0, 0.17)
        b.set_yticks([0, 0.08, 0.16])
        b.set_yticklabels(["0", "8%", "16%"])
        b.set_xticks([-3, -2, -1, 0, 1, 2, 3])
        b.set_xticklabels(["−3σ", "−2σ", "−1σ", "0", "1σ", "2σ", "3σ"])
        b.text(-3.15, 0.165, "probability mass per bin", fontsize=FS_SMALL, color=INK, va="top")
        lo_i, hi_i = int(np.argmin(mass)), int(np.argmax(mass))
        b.text(3.15, 0.165, f"min {mass.min():.1%} · max {mass.max():.1%}", fontsize=FS_SMALL, color=col,
               ha="right", va="top", fontweight="bold")
    credit(fig, "Data: QLoRA (Dettmers et al. 2023) / bitsandbytes NF4 table; masses computed for N(0, 1) with "
                "round-to-nearest bins")
    save(fig, out / "c3-nf4-levels.svg",
         "The 16 NF4 levels drawn on the standard normal density, with near-equal probability mass per bin, "
         "versus 15 evenly spaced int4 absmax levels whose bins hold very unequal mass.", prev)


# ----------------------------------------------------------- QLoRA dataflow --

def c3_qlora_dataflow(out: Path, prev: Path | None):
    W, H = 960, 520
    fig, ax = canvas(W, H)
    # regions
    box(ax, 20, 20, 690, 420, fc="none", ec=MUTED, lw=1.2, r=12, ls=(0, (6, 3)))
    text(ax, 36, 40, "GPU", size=FS_TITLE, weight="bold", color=MUTED)
    box(ax, 740, 20, 200, 420, fc=tint(FAINT, 0.5), ec=MUTED, lw=1.2, r=12, ls=(0, (6, 3)))
    text(ax, 756, 40, "CPU RAM", size=FS_TITLE, weight="bold", color=MUTED)
    # frozen base
    box(ax, 50, 70, 230, 92, fc=tint(TEAL, 0.14), ec=TEAL, lw=1.6, r=8, hatch="xxx", hatch_color=tint(TEAL, 0.35))
    text(ax, 165, 92, "base weight W (frozen)", size=FS, weight="bold", ha="center",
         bbox=dict(boxstyle="round,pad=0.15", fc=WHITE, ec="none"))
    text(ax, 165, 116, "stored as NF4 (4-bit), blocks of 64", size=FS_SMALL, ha="center",
         bbox=dict(boxstyle="round,pad=0.12", fc=WHITE, ec="none"))
    text(ax, 165, 138, "+ double-quantised scales", size=FS_SMALL, ha="center",
         bbox=dict(boxstyle="round,pad=0.12", fc=WHITE, ec="none"))
    arrow(ax, 280, 116, 330, 116, lw=1.8)
    box(ax, 330, 90, 150, 52, fc=WHITE, ec=TEAL, lw=1.4, r=8, ls=(0, (4, 2)))
    text(ax, 405, 108, "dequantise", size=FS, ha="center", weight="bold")
    text(ax, 405, 127, "to bf16, on the fly", size=FS_SMALL, ha="center")
    arrow(ax, 480, 116, 520, 116, lw=1.8)
    box(ax, 520, 82, 160, 68, fc=tint(MUTED, 0.10), ec=INK, lw=1.4, r=8)
    text(ax, 600, 106, "X · W", size=FS + 1, ha="center", weight="bold")
    text(ax, 600, 128, "bf16 matmul", size=FS_SMALL, ha="center")
    # adapters
    box(ax, 330, 230, 150, 50, fc=tint(ACCENT, 0.14), ec=ACCENT, lw=1.6, r=8)
    text(ax, 405, 248, "A  (r × k)", size=FS, ha="center", weight="bold", color=ACCENT)
    text(ax, 405, 267, "bf16, trainable", size=FS_SMALL, ha="center")
    box(ax, 520, 230, 160, 50, fc=tint(ACCENT, 0.14), ec=ACCENT, lw=1.6, r=8)
    text(ax, 600, 248, "B  (d × r)", size=FS, ha="center", weight="bold", color=ACCENT)
    text(ax, 600, 267, "bf16, trainable", size=FS_SMALL, ha="center")
    # input X
    text(ax, 120, 255, "X (bf16)", size=FS, weight="bold", ha="center")
    line(ax, [160, 300], [255, 255], lw=1.8)
    line(ax, [300, 300], [255, 190], lw=1.8)
    line(ax, [300, 600], [190, 190], lw=1.8)
    arrow(ax, 600, 190, 600, 156, lw=1.8)
    arrow(ax, 300, 255, 326, 255, lw=1.8)
    arrow(ax, 480, 255, 516, 255, lw=1.8, color=ACCENT)
    # output sum
    ax.add_patch(Circle((640, 330), 14, fc=WHITE, ec=INK, lw=1.6, zorder=3))
    text(ax, 640, 330, "+", size=FS_TITLE + 2, ha="center", z=4)
    line(ax, [680, 690, 690, 654], [116, 116, 330, 330], lw=1.8)
    line(ax, [600, 600, 626], [280, 330, 330], lw=1.8, color=ACCENT)
    arrow(ax, 640, 344, 640, 380, lw=1.8)
    text(ax, 640, 394, "output (bf16)", size=FS_SMALL, ha="center")
    # gradients (backward)
    arrow(ax, 520, 300, 470, 300, lw=1.6, color=CORAL, ls=(0, (4, 2)))
    text(ax, 330, 312, "backward: gradients flow through the", size=FS_SMALL, color=CORAL)
    text(ax, 330, 330, "dequantised W to earlier layers, and", size=FS_SMALL, color=CORAL)
    text(ax, 330, 348, "into A and B only; W gets no update", size=FS_SMALL, color=CORAL)
    # optimizer states + paging
    box(ax, 50, 370, 230, 56, fc=tint(GOLD, 0.12), ec=GOLD, lw=1.6, r=8)
    text(ax, 165, 390, "optimizer states for A, B", size=FS, ha="center", weight="bold")
    text(ax, 165, 410, "paged optimizer (e.g. 8-bit)", size=FS_SMALL, ha="center")
    box(ax, 770, 370, 150, 56, fc=tint(GOLD, 0.12), ec=GOLD, lw=1.2, r=8, ls=(0, (4, 2)))
    text(ax, 845, 390, "paged-out", size=FS, ha="center", weight="bold")
    text(ax, 845, 410, "optimizer pages", size=FS_SMALL, ha="center")
    arrow(ax, 286, 388, 764, 388, lw=1.4, color=GOLD)
    arrow(ax, 764, 410, 286, 410, lw=1.4, color=GOLD)
    text(ax, 520, 380, "evict on memory spikes (unified memory)", size=FS_SMALL, ha="center", color=GOLD)
    text(ax, 520, 426, "page back for the optimizer step", size=FS_SMALL, ha="center", color=GOLD)
    # legend
    ly = 470
    rect(ax, 30, ly - 7, 22, 14, fc=tint(TEAL, 0.14), ec=TEAL, lw=0.8, hatch="xxx", hatch_color=tint(TEAL, 0.35))
    text(ax, 60, ly, "4-bit storage (frozen)", size=FS_SMALL)
    rect(ax, 230, ly - 7, 22, 14, fc=tint(ACCENT, 0.14), ec=ACCENT, lw=0.8)
    text(ax, 260, ly, "trainable, bf16", size=FS_SMALL)
    line(ax, [400, 430], [ly, ly], color=CORAL, lw=1.6, ls=(0, (4, 2)))
    text(ax, 438, ly, "gradient flow", size=FS_SMALL)
    line(ax, [560, 590], [ly, ly], color=GOLD, lw=1.6)
    text(ax, 598, ly, "paging flow", size=FS_SMALL)
    credit(fig, "Schematic redraw after QLoRA (Dettmers et al. 2023), Fig. 1")
    save(fig, out / "c3-qlora-dataflow.svg",
         "QLoRA data flow: the frozen NF4 base weight is dequantised to bf16 for each matmul, bf16 LoRA adapters "
         "A and B receive the gradients, and paged optimizer states move between GPU and CPU memory.", prev)


# ------------------------------------------------------------------ deploy --

def c3_deploy(out: Path, prev: Path | None):
    W, H = 960, 470
    fig, ax = canvas(W, H)
    u = 26           # side of one 16 GB model copy
    g = 5
    text(ax, 30, 28, "One merged model per customer", size=FS_TITLE + 1, weight="bold")
    x0, y0 = 30, 56
    for i in range(10):
        for j in range(10):
            rect(ax, x0 + j * (u + g), y0 + i * (u + g), u, u, fc=tint(PURPLE, 0.28), ec=PURPLE, lw=0.8,
                 hatch="////", hatch_color=tint(PURPLE, 0.6))
    text(ax, x0, y0 + 10 * (u + g) + 18, "100 × 16 GB = 1.6 TB", size=FS_TITLE + 2, weight="bold", color=PURPLE)
    text(ax, x0, y0 + 10 * (u + g) + 42, "each square: a full 8B model in bf16", size=FS_SMALL)

    ox = 520
    line(ax, [ox - 40, ox - 40], [20, 440], color=FAINT, lw=1.2)
    text(ax, ox, 28, "One base + 100 adapters, served together", size=FS_TITLE + 1, weight="bold")
    rect(ax, ox, y0, u, u, fc=tint(PURPLE, 0.28), ec=PURPLE, lw=0.8, hatch="////", hatch_color=tint(PURPLE, 0.6))
    text(ax, ox + u + 10, y0 + u / 2, "shared base, 16 GB", size=FS_SMALL)
    # adapters to scale by area: 84 MB / 16 GB of a square
    s_ad = u * np.sqrt(0.084 / 16)
    ax0, ay0 = ox, y0 + u + 30
    pitch = 10
    for i in range(10):
        for j in range(10):
            rect(ax, ax0 + j * pitch, ay0 + i * pitch, s_ad, s_ad, fc=ACCENT, ec="none")
    text(ax, ax0 + 10 * pitch + 12, ay0 + 5 * pitch, "100 adapters × 84 MB (r = 16, all linear layers)",
         size=FS_SMALL, va="center")
    text(ax, ox, y0 + 10 * (u + g) + 18, "16 GB + 100 × 84 MB ≈ 24.4 GB", size=FS_TITLE + 2, weight="bold", color=ACCENT)
    text(ax, ox, y0 + 10 * (u + g) + 42, "fits on one GPU; one batch can mix requests for different adapters",
         size=FS_SMALL)
    text(ax, ox, ay0 + 10 * pitch + 30, "areas to scale: an adapter is 0.5% of a model", size=FS_SMALL, color=MUTED)
    text(ax, ox, ay0 + 10 * pitch + 50, "(S-LoRA, Punica; vLLM --enable-lora)", size=FS_SMALL, color=MUTED, mono=True)
    save(fig, out / "c3-deploy.svg",
         "Serving 100 customers: 100 merged 16 GB models need 1.6 TB, while one 16 GB base plus 100 adapters of "
         "84 MB needs about 24.4 GB.", prev)


# -------------------------------------------------------------- QAT timeline --

def c3_qat_timeline(out: Path, prev: Path | None):
    W, H = 960, 470
    fig, ax = canvas(W, H)
    x_lab = 30
    cols = [(220, 420, "before training"), (420, 700, "during (post-)training"), (700, 940, "after training")]
    for x0, x1, lab in cols:
        rect(ax, x0 + 2, 30, x1 - x0 - 4, 30, fc=tint(FAINT, 0.7))
        text(ax, (x0 + x1) / 2, 45, lab, size=FS, weight="bold", ha="center")
        line(ax, [x0, x0], [30, 440], color=FAINT, lw=1.2)
    line(ax, [940, 940], [30, 440], color=FAINT, lw=1.2)
    arrow(ax, 220, 72, 935, 72, color=MUTED, lw=1.2)
    lanes = [
        ("QLoRA", "goal: save training memory", TEAL, [
            (226, 414, ["quantise the frozen base", "to NF4 when loading"]),
            (426, 694, ["train bf16 adapters on the", "dequantised weights"]),
            (706, 934, ["output: an adapter; merged", "model is bf16, not 4-bit"])]),
        ("QAT", "goal: a quantised model that keeps quality", PURPLE, [
            (426, 694, ["forward: fake-quant ŵ = s·round(w/s)", "backward: straight-through", "estimator, ∂ŵ/∂w ≈ 1"]),
            (706, 934, ["ship real int4 weights", "e.g. Gemma 3 QAT (int4),", "Kimi K2 Thinking (INT4)"])]),
        ("PTQ", "goal: cheap quantisation for inference", GOLD, [
            (706, 934, ["GPTQ / AWQ on the finished", "weights; small calibration", "set, no training"])]),
    ]
    y = 96
    lh = 108
    for name, goal, col, cells in lanes:
        text(ax, x_lab, y + 30, name, size=FS_TITLE + 3, weight="bold", color=col)
        for i, s in enumerate(goal.replace("goal: ", "goal:\n").split("\n")):
            text(ax, x_lab, y + 54 + i * 18, s, size=FS_SMALL, color=INK)
        for x0, x1, lines in cells:
            box(ax, x0, y + 6, x1 - x0, lh - 22, fc=tint(col, 0.10), ec=col, lw=1.4, r=8)
            for i, s in enumerate(lines):
                text(ax, x0 + 12, y + 28 + i * 20, s, size=FS_SMALL)
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
