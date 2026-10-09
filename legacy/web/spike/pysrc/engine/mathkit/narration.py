"""Text-to-speech with word timings, cached by content hash.

Audio is generated before animation timing is decided, so every animation can
be sized to the sentence it illustrates (temporal contiguity).
"""
from __future__ import annotations

import asyncio
import hashlib
import json
import re
import subprocess
from dataclasses import dataclass
from pathlib import Path

from .theme import VOICE

CACHE = Path(__file__).resolve().parent.parent / ".cache" / "tts"
CACHE.mkdir(parents=True, exist_ok=True)


@dataclass
class Clip:
    path: Path
    duration: float
    words: list[tuple[float, float, str]]  # (start, end, word) relative to clip start


def _duration(path: Path) -> float:
    out = subprocess.run(
        ["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", str(path)],
        capture_output=True, text=True, check=True,
    )
    return float(out.stdout.strip())


async def _edge(text: str, voice: str, rate: str, mp3: Path) -> list:
    import edge_tts

    words = []
    comm = edge_tts.Communicate(text, voice, rate=rate, boundary="WordBoundary")
    with open(mp3, "wb") as f:
        async for ch in comm.stream():
            if ch["type"] == "audio":
                f.write(ch["data"])
            elif ch["type"] == "WordBoundary":
                s = ch["offset"] / 1e7
                words.append((s, s + ch["duration"] / 1e7, ch["text"]))
    return words


def _say_fallback(text: str, mp3: Path) -> list:
    aiff = mp3.with_suffix(".aiff")
    subprocess.run(["say", "-v", "Samantha", "-o", str(aiff), text], check=True)
    subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", str(aiff), str(mp3)], check=True)
    aiff.unlink(missing_ok=True)
    return []


_SYMBOLS = [
    ("≈", " about "), ("θ", "theta"), ("α", "alpha"), ("β", "beta"), ("°", " degrees"),
    ("²", " squared"), ("√", "root "), ("½", "half"), ("×", " times "), ("−", " minus "),
    ("∠", "angle "), ("·", " times "),
]


def to_spoken(text: str) -> str:
    """Caption text -> text the voice reads. 'APB' is spelled out letter by letter."""
    s = re.sub(r"\b([A-Z]{2,3})\b", lambda m: "-".join(m.group(1)), text)
    for a, b in _SYMBOLS:
        s = s.replace(a, b)
    return re.sub(r"\s+", " ", s).strip()


def speak(text: str, voice: str = VOICE, rate: str = "+0%") -> Clip:
    text = to_spoken(text)
    key = hashlib.sha1(f"{voice}|{rate}|{text}".encode()).hexdigest()[:16]
    mp3 = CACHE / f"{key}.mp3"
    meta = CACHE / f"{key}.json"
    if mp3.exists() and meta.exists():
        words = [tuple(w) for w in json.loads(meta.read_text())]
    else:
        try:
            words = asyncio.run(_edge(text, voice, rate, mp3))
        except Exception:
            words = _say_fallback(text, mp3)
        meta.write_text(json.dumps(words))
    return Clip(mp3, _duration(mp3), words)


def caption_chunks(text: str, start: float, clip: Clip, max_chars: int = 84) -> list[dict]:
    """Split one narration clip into caption cues on phrase boundaries.

    Timing comes from word boundaries when the word count lines up with the
    text, otherwise it is shared out in proportion to characters.
    """
    if len(text) <= max_chars:
        return [{"start": round(start, 3), "end": round(start + clip.duration, 3), "text": text}]

    pieces = re.split(r"(?<=[.?!;:,—])\s+", text)
    chunks: list[str] = []
    buf = ""
    for p in pieces:
        if buf and len(buf) + 1 + len(p) > max_chars:
            chunks.append(buf)
            buf = p
        else:
            buf = f"{buf} {p}".strip()
    if buf:
        chunks.append(buf)

    n_words = [len(c.split()) for c in chunks]
    cues = []
    if clip.words and sum(n_words) == len(clip.words):
        i = 0
        for c, n in zip(chunks, n_words):
            s = clip.words[i][0]
            i += n
            e = clip.words[i][0] if i < len(clip.words) else clip.duration
            cues.append({"start": round(start + s, 3), "end": round(start + e, 3), "text": c})
        cues[0]["start"] = round(start, 3)
    else:
        total = sum(len(c) for c in chunks)
        t = start
        for c in chunks:
            d = clip.duration * len(c) / total
            cues.append({"start": round(t, 3), "end": round(t + d, 3), "text": c})
            t += d
    return cues
