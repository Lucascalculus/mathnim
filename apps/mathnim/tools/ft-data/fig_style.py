"""Shared look and drawing helpers for the static course figures (figures.py).

One look for every figure:
- light palette only (the tokens below), transparent background;
- sans-serif text kept as SVG <text> (svg.fonttype 'none'); layout is measured
  with DejaVu Sans / DejaVu Sans Mono (wide fonts, so the browser's narrower
  Helvetica/Arial never overflows), and the written SVG names a generic stack;
- sizes are in px: a figure of W x H px has viewBox "0 0 W H", and font sizes
  are px at 100% width (minimum 11);
- every paper redraw carries a corner note (credit()).

Diagram figures use canvas(), whose axes span the whole figure in px with y
pointing down (like SVG), so boxes and text can be placed by hand.
"""
from __future__ import annotations

import re
from pathlib import Path

import matplotlib

matplotlib.use("svg")
import matplotlib.pyplot as plt  # noqa: E402
from matplotlib import patches as mpatches  # noqa: E402
from matplotlib import rcParams  # noqa: E402

INK = "#111113"
MUTED = "#86868B"
FAINT = "#E6E6EA"
ACCENT = "#2563EB"
GOLD = "#B8860B"
CORAL = "#E4572E"
GOOD = "#1F8A5B"
PURPLE = "#7C3AED"
TEAL = "#0D9488"
WHITE = "#FFFFFF"

SANS_STACK = "'Helvetica Neue', Helvetica, Arial, sans-serif"
MONO_STACK = "ui-monospace, Menlo, Consolas, 'DejaVu Sans Mono', monospace"

# font sizes (px at 100% width)
FS_TITLE = 15
FS = 13
FS_SMALL = 12
FS_NOTE = 11

MONO_W = 0.6021  # advance of DejaVu Sans Mono (and Menlo) per px of font size


def tint(hex_color: str, alpha: float) -> tuple[float, float, float]:
    """Opaque mix of a palette colour with white (keeps hatches crisp)."""
    h = hex_color.lstrip("#")
    r, g, b = (int(h[i:i + 2], 16) / 255 for i in (0, 2, 4))
    return (1 - alpha + alpha * r, 1 - alpha + alpha * g, 1 - alpha + alpha * b)


def setup() -> None:
    rcParams.update({
        "svg.fonttype": "none",
        "svg.hashsalt": "mathnim-ft-figures",
        "font.family": "sans-serif",
        "font.sans-serif": ["DejaVu Sans"],
        "font.monospace": ["DejaVu Sans Mono"],
        "font.size": FS,
        "text.color": INK,
        "axes.edgecolor": MUTED,
        "axes.labelcolor": INK,
        "axes.labelsize": FS,
        "axes.titlesize": FS_TITLE,
        "axes.titleweight": "bold",
        "axes.titlelocation": "left",
        "axes.titlepad": 10,
        "axes.linewidth": 0.9,
        "axes.spines.top": False,
        "axes.spines.right": False,
        "axes.facecolor": "none",
        "axes.grid": False,
        "grid.color": FAINT,
        "grid.linewidth": 0.9,
        "xtick.color": MUTED,
        "ytick.color": MUTED,
        "xtick.labelcolor": INK,
        "ytick.labelcolor": INK,
        "xtick.labelsize": FS_SMALL,
        "ytick.labelsize": FS_SMALL,
        "xtick.major.size": 4,
        "ytick.major.size": 4,
        "xtick.minor.size": 2.5,
        "ytick.minor.size": 2.5,
        "legend.frameon": False,
        "legend.fontsize": FS_SMALL,
        "figure.facecolor": "none",
        "savefig.facecolor": "none",
        "savefig.transparent": True,
        "hatch.linewidth": 0.9,
        "lines.linewidth": 2.0,
        "lines.solid_capstyle": "round",
        "path.simplify": False,
    })


def figure(w: float, h: float):
    """A figure exactly w x h px (72 dpi, so 1 pt = 1 px in the SVG)."""
    return plt.figure(figsize=(w / 72.0, h / 72.0), dpi=72)


def canvas(w: float, h: float):
    """Figure plus a full-size axes in px coordinates, y down."""
    fig = figure(w, h)
    ax = fig.add_axes((0, 0, 1, 1))
    ax.set_xlim(0, w)
    ax.set_ylim(h, 0)
    ax.axis("off")
    return fig, ax


def px_axes(fig, x: float, y: float, w: float, h: float):
    """Add a data axes at a px rectangle (x, y = top-left, y down)."""
    W = fig.get_figwidth() * 72.0
    H = fig.get_figheight() * 72.0
    return fig.add_axes((x / W, 1 - (y + h) / H, w / W, h / H))


# ---------------------------------------------------------------- drawing --

def box(ax, x, y, w, h, fc="none", ec=INK, lw=1.2, r=6, hatch=None, hatch_color=None,
        ls="-", z=1, alpha=1.0):
    p = mpatches.FancyBboxPatch((x, y), w, h, boxstyle=f"round,pad=0,rounding_size={r}",
                                fc=fc, ec=ec, lw=lw, ls=ls, zorder=z, alpha=alpha,
                                hatch=hatch, mutation_aspect=1)
    if hatch and hatch_color:
        _set_hatch_color(p, hatch_color)
    ax.add_patch(p)
    return p


def rect(ax, x, y, w, h, fc="none", ec="none", lw=0.0, hatch=None, hatch_color=None, z=1, alpha=1.0):
    p = mpatches.Rectangle((x, y), w, h, fc=fc, ec=ec, lw=lw, zorder=z, hatch=hatch, alpha=alpha)
    if hatch and hatch_color:
        _set_hatch_color(p, hatch_color)
    ax.add_patch(p)
    return p


def _set_hatch_color(p, color):
    if hasattr(p, "set_hatchcolor"):
        p.set_hatchcolor(color)
    else:  # older matplotlib: hatch takes the edge colour
        p._hatch_color = matplotlib.colors.to_rgba(color)


def text(ax, x, y, s, size=FS, color=INK, ha="left", va="center", weight="normal",
         mono=False, style="normal", z=5, rotation=0, **kw):
    return ax.text(x, y, s, fontsize=size, color=color, ha=ha, va=va, fontweight=weight,
                   family="monospace" if mono else "sans-serif", fontstyle=style, zorder=z,
                   rotation=rotation, **kw)


def arrow(ax, x0, y0, x1, y1, color=INK, lw=1.4, ls="-", head=8, z=3, rad=0.0, shrink=0):
    a = mpatches.FancyArrowPatch((x0, y0), (x1, y1), arrowstyle=f"-|>,head_length={head * 0.09:.2f},head_width={head * 0.055:.2f}",
                                 mutation_scale=10, color=color, lw=lw, ls=ls, zorder=z,
                                 connectionstyle=f"arc3,rad={rad}", shrinkA=shrink, shrinkB=shrink)
    ax.add_patch(a)
    return a


def line(ax, xs, ys, color=INK, lw=1.2, ls="-", z=2, **kw):
    return ax.plot(xs, ys, color=color, lw=lw, ls=ls, zorder=z, solid_capstyle="butt", **kw)


def mono_width(s: str, size: float) -> float:
    return len(s) * size * MONO_W


def credit(fig, note: str, where: str = "br", pad: float = 8):
    """Small corner note: 'Schematic redraw after ...' or 'Data: ...'."""
    W = fig.get_figwidth() * 72.0
    H = fig.get_figheight() * 72.0
    x = (W - pad) / W if where.endswith("r") else pad / W
    y = pad / H if where.startswith("b") else (H - pad) / H
    fig.text(x, y, note, fontsize=FS_NOTE, color=MUTED, ha="right" if where.endswith("r") else "left",
             va="bottom" if where.startswith("b") else "top", fontstyle="italic")


def style_axes(ax, grid_y=False, grid_x=False):
    ax.spines["left"].set_color(MUTED)
    ax.spines["bottom"].set_color(MUTED)
    if grid_y:
        ax.yaxis.grid(True, color=FAINT, lw=0.9, zorder=0)
    if grid_x:
        ax.xaxis.grid(True, color=FAINT, lw=0.9, zorder=0)
    ax.set_axisbelow(True)


# ------------------------------------------------------------------ saving --

def save(fig, path: Path, title: str, preview_dir: Path | None = None) -> None:
    """Write the SVG (deterministic, px viewBox, generic font stacks, <title>)
    and, if preview_dir is given, a PNG preview there (white background)."""
    path.parent.mkdir(parents=True, exist_ok=True)
    W = fig.get_figwidth() * 72.0
    H = fig.get_figheight() * 72.0
    fig.savefig(path, format="svg", metadata={"Date": None, "Creator": None, "Format": None,
                                               "Type": None})
    svg = path.read_text(encoding="utf-8")
    svg = _postprocess(svg, W, H, title)
    path.write_text(svg, encoding="utf-8")
    if preview_dir is not None:
        preview_dir.mkdir(parents=True, exist_ok=True)
        fig.savefig(preview_dir / (path.stem + ".png"), format="png", dpi=144,
                    facecolor="white", transparent=False)
    plt.close(fig)


def _postprocess(svg: str, W: float, H: float, title: str) -> str:
    # metadata block (creator, date) out, for byte-identical re-runs
    svg = re.sub(r"\s*<metadata>.*?</metadata>", "", svg, flags=re.S)
    # px size instead of pt, keep the viewBox
    svg = re.sub(r'<svg([^>]*?) width="[^"]*" height="[^"]*"',
                 lambda m: f'<svg{m.group(1)} width="{W:g}" height="{H:g}"', svg, count=1)
    svg = svg.replace("<svg ", '<svg role="img" ', 1)
    # generic font stacks (layout was measured with DejaVu Sans / Sans Mono)
    svg = re.sub(r"font-family: ([^;\"]*)",
                 lambda m: "font-family: " + (MONO_STACK if "Mono" in m.group(1) or "monospace" in m.group(1)
                                              else SANS_STACK), svg)
    assert "DejaVu Sans'" not in svg.replace("'DejaVu Sans Mono'", "")
    # accessible title right after the opening tag
    esc = title.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
    svg = re.sub(r"(<svg[^>]*>)", lambda m: m.group(1) + f"\n <title>{esc}</title>", svg, count=1)
    return svg
