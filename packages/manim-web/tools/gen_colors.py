"""Generate src/utils/color/*.ts from manim's colour modules (run with manim's Python)."""
import importlib, sys
from pathlib import Path
from manim.utils.color import ManimColor
from manim.utils.color import manim_colors

OUT = Path(__file__).resolve().parents[1] / "src" / "utils" / "color"
hexa = lambda c: c.to_hex(with_alpha=True) if c._internal_value[3] != 1 else c.to_hex()

names = [k for k, v in vars(manim_colors).items() if isinstance(v, ManimColor) and not k.startswith("_")]
lines = ["// Generated from manim/utils/color/manim_colors.py by tools/gen_colors.py", "import { ManimColor, _registerColorNames, _setAllManimColors } from './core';", ""]
for k in names:
    lines.append(f"export const {k} = new ManimColor('{hexa(getattr(manim_colors, k))}');")
lines.append("")
lines.append("_registerColorNames({ " + ", ".join(names) + " });")
all_list = [ (v, k) for k, v in vars(manim_colors).items() if k == "_all_manim_colors" ]
lines.append("_setAllManimColors([" + ", ".join(n for n in names if n not in ("BLACK",)) + "]);")
(OUT / "manim_colors.ts").write_text("\n".join(lines) + "\n")

pal = ["AS2700", "BS381", "DVIPSNAMES", "SVGNAMES", "X11", "XKCD"]
plines = ["// Generated from manim/utils/color/{AS2700,BS381,DVIPSNAMES,SVGNAMES,X11,XKCD}.py by tools/gen_colors.py", "import { ManimColor } from './core';", "", "const pal = (o: Record<string, string>) => Object.freeze(Object.fromEntries(Object.entries(o).map(([k, v]) => [k, new ManimColor(v)])));", ""]
for p in pal:
    mod = importlib.import_module(f"manim.utils.color.{p}")
    items = [(k, v) for k, v in vars(mod).items() if isinstance(v, ManimColor) and not k.startswith("_")]
    body = ", ".join(f"{k}: '{hexa(v)}'" for k, v in items)
    plines.append(f"export const {p} = pal({{ {body} }});")
(OUT / "palettes.ts").write_text("\n".join(plines) + "\n")
print(len(names), "manim colours;", {p: sum(1 for v in vars(importlib.import_module(f'manim.utils.color.{p}')).values() if isinstance(v, ManimColor)) for p in pal})
