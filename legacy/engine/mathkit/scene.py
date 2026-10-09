"""LessonScene: a manim Scene that knows about narration, captions and hotspots.

Each render writes `<SceneName>.json` next to the video with:
  duration, captions (timed cues), marks (named timestamps) and hotspots
  (clickable object regions in the final frame, as % of the frame).
The web player uses this to sync captions and to let students point at
objects and ask about them.
"""
from __future__ import annotations

import json
import os
from contextlib import contextmanager
from pathlib import Path
from types import SimpleNamespace

from manim import DL, UR, Scene, config

from .narration import caption_chunks, speak
from .theme import BG

META_DIR = Path(os.environ.get("MATHKIT_META", Path(__file__).resolve().parent.parent / "out" / "meta"))


class LessonScene(Scene):
    def setup(self):
        self.camera.background_color = BG
        self._captions: list[dict] = []
        self._marks: dict[str, float] = {}
        self._hotspots: list[dict] = []
        self._params: dict = {}
        self._timeline: list = []  # [start, end] of every play/wait, for sync checks

    @property
    def now(self) -> float:
        return self.renderer.time

    def play(self, *args, **kwargs):
        start = self.now
        super().play(*args, **kwargs)
        self._timeline.append([round(start, 4), round(self.now, 4)])


    @contextmanager
    def say(self, text: str, gap: float = 0.35, pad: float = 0.0):
        """Speak `text`; the block's animations run during the speech.

        Yields an object with `.duration`, so animations can be sized to it,
        e.g. `self.play(Create(c), run_time=t.duration * 0.5)`. Any time left
        after the block is filled with a wait so the next sentence never
        overlaps this one.
        """
        clip = speak(text)
        start = self.now
        self.add_sound(str(clip.path))
        self._captions.extend(caption_chunks(text, start, clip))
        yield SimpleNamespace(duration=clip.duration, start=start)
        left = start + clip.duration + gap + pad - self.now
        if left > 1e-3:
            self.wait(left)

    def mark(self, name: str):
        self._marks[name] = round(self.now, 3)

    def param(self, **kw):
        """Describe the slider mapping for explore videos (param at t=0 and t=end)."""
        self._params.update(kw)

    def hotspot(self, mob, key: str, title: str, pad: float = 0.12):
        fw, fh = config.frame_width, config.frame_height
        x0, y0 = mob.get_corner(DL)[:2]
        x1, y1 = mob.get_corner(UR)[:2]
        x0, y0, x1, y1 = x0 - pad, y0 - pad, x1 + pad, y1 + pad
        self._hotspots.append({
            "key": key,
            "title": title,
            "left": round((x0 + fw / 2) / fw * 100, 2),
            "top": round((fh / 2 - y1) / fh * 100, 2),
            "width": round((x1 - x0) / fw * 100, 2),
            "height": round((y1 - y0) / fh * 100, 2),
        })

    def tear_down(self):
        META_DIR.mkdir(parents=True, exist_ok=True)
        meta = {
            "scene": type(self).__name__,
            "duration": round(self.now, 3),
            "captions": self._captions,
            "marks": self._marks,
            "hotspots": self._hotspots,
            "params": self._params,
            "timeline": self._timeline,
        }
        (META_DIR / f"{type(self).__name__}.json").write_text(json.dumps(meta, indent=1))
