"""MathJax-backed TeX for Manim.

`MathTex`-like mobjects without a LaTeX installation. A persistent Node process
(texsvg/server.cjs) turns TeX into SVG; each substring is tagged with a unique
colour so the glyphs can be regrouped into parts after SVG parsing, the same
trick ManimGL uses for substring indexing.
"""
from __future__ import annotations

import atexit
import hashlib
import json
import subprocess
import threading
from pathlib import Path

import numpy as np
from manim import VGroup, VMobject, SVGMobject, WHITE, ManimColor

ENGINE_DIR = Path(__file__).resolve().parent.parent
SERVER = ENGINE_DIR / "texsvg" / "server.cjs"
CACHE = ENGINE_DIR / ".cache" / "tex"
CACHE.mkdir(parents=True, exist_ok=True)

# One em in Manim units at font_size 48; matches manim's MathTex sizing closely.
EM_AT_48 = 0.62


class _TexServer:
    def __init__(self):
        self.proc = None
        self.lock = threading.Lock()
        self.counter = 0

    def _start(self):
        self.proc = subprocess.Popen(
            ["node", str(SERVER)],
            stdin=subprocess.PIPE,
            stdout=subprocess.PIPE,
            text=True,
            bufsize=1,
            cwd=str(SERVER.parent),
        )
        atexit.register(self.proc.kill)

    def render(self, tex: str, display: bool = True) -> str:
        with self.lock:
            if self.proc is None or self.proc.poll() is not None:
                self._start()
            self.counter += 1
            self.proc.stdin.write(json.dumps({"id": self.counter, "tex": tex, "display": display}) + "\n")
            self.proc.stdin.flush()
            res = json.loads(self.proc.stdout.readline())
        if "error" in res:
            raise ValueError(f"TeX error in {tex!r}: {res['error']}")
        return res["svg"]


_server = _TexServer()


def tex_to_svg_file(tex: str, display: bool = True) -> Path:
    key = hashlib.sha1(f"{display}|{tex}".encode()).hexdigest()[:16]
    path = CACHE / f"{key}.svg"
    if not path.exists():
        path.write_text(_server.render(tex, display))
    return path


def _tag(i: int) -> str:
    # Distinct, near-black colours; index is recoverable from the hex value.
    return f"#{(i + 1) * 3:06x}"


def _hex_of(mob: VMobject) -> str:
    return mob.get_fill_color().to_hex().lower()


class Tex(VGroup):
    """A formula split into parts. `Tex("a^2", "+", "b^2")[0]` is the `a^2` glyphs.

    Parts must each be valid TeX on their own (same rule as manim's MathTex).
    Use `tex_to_color_map` or `.part("b^2")` to address pieces by their source.
    """

    def __init__(
        self,
        *parts: str,
        font_size: float = 48,
        color=WHITE,
        tex_to_color_map: dict | None = None,
        display: bool = True,
        **kwargs,
    ):
        super().__init__(**kwargs)
        self.parts_src = list(parts)
        self.font_size_value = font_size
        # LaTeX-style colour *switches* (not \color{c}{...} groups) keep the
        # original atom classes, so relation/operator spacing is unchanged.
        body = " ".join(f"\\color{{{_tag(i)}}} {p}" for i, p in enumerate(parts))
        path = tex_to_svg_file(body, display)
        svg = SVGMobject(str(path), height=None, should_center=False, stroke_width=0)

        glyphs = [m for m in svg.family_members_with_points()]
        buckets: dict[int, list[VMobject]] = {i: [] for i in range(len(parts))}
        lookup = {_tag(i): i for i in range(len(parts))}
        for g in glyphs:
            idx = lookup.get(_hex_of(g))
            if idx is None:
                # Unwrapped glyphs (e.g. spacing-only parts); attach to the nearest part.
                idx = len(parts) - 1
            buckets[idx].append(g)

        for i in range(len(parts)):
            part = VGroup(*buckets[i])
            part.tex_string = parts[i]
            self.add(part)

        # SVG units parse 1:1 into manim units; MathJax uses 1000 units per em.
        VGroup(*glyphs).scale(EM_AT_48 * font_size / 48 / 1000, about_point=np.zeros(3))
        self.center()
        self.set_fill(color, opacity=1).set_stroke(width=0)
        if tex_to_color_map:
            for key, col in tex_to_color_map.items():
                for p in self:
                    if p.tex_string == key:
                        p.set_fill(col)

    def part(self, src: str) -> VGroup:
        for p in self:
            if p.tex_string == src:
                return p
        raise KeyError(src)

    def parts_matching(self, src: str) -> list[VGroup]:
        return [p for p in self if p.tex_string == src]
