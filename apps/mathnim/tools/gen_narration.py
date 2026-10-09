"""Pre-generate narration audio with a neural voice (edge-tts).

    node tools/narration_texts.mjs > /tmp/narration.json
    python tools/gen_narration.py /tmp/narration.json public/narration [--revoice]

Writes <key>.mp3 and <key>.json ({text, lang, voice, duration, words: [[start, end, word], ...]})
for every line that is not generated yet. The web app plays these with
word-timed captions (packages/present/src/narrator.ts).

The voice follows the line's language ("lang" from narration_texts): English
is en-US-AndrewMultilingualNeural, Chinese zh-CN-YunxiNeural (chosen
2026-10-10 after comparing samples in public/narration/samples/). Override
with MATHNIM_VOICE_EN / MATHNIM_VOICE_ZH. --revoice regenerates lines whose
recording was made with another voice than the one chosen now.
"""
import asyncio, json, os, re, sys
from pathlib import Path

VOICES = {
    "en": os.environ.get("MATHNIM_VOICE_EN", "en-US-AndrewMultilingualNeural"),   # the voice of the first prototype
    "zh": os.environ.get("MATHNIM_VOICE_ZH", "zh-CN-YunxiNeural"),
}
VOICE = VOICES["en"]
RATE = "+0%"
SYMBOLS = [("≈", " about "), ("θ", "theta"), ("α", "alpha"), ("β", "beta"), ("°", " degrees"), ("²", " squared"),
           ("√", "root "), ("½", "half"), ("×", " times "), ("−", " minus "), ("∠", "angle "), ("·", " times ")]


def to_spoken(text: str) -> str:
    """Caption text -> what the voice reads ('AB' is spelled out, symbols named). English lines without a
    precomputed `spoken` text only; narration_texts gives every line its `spoken` form (core's to_spoken)."""
    s = re.sub(r"(\d+(?:\.\d+)?)\s?m\b", r"\1 meters", text)
    s = re.sub(r"\b([A-Z]{2,3})\b", lambda m: "-".join(m.group(1)), s)
    for a, b in SYMBOLS:
        s = s.replace(a, b)
    return re.sub(r"\s+", " ", s).strip()


async def synth(spoken: str, voice: str, mp3: Path) -> list:
    import edge_tts
    words = []
    comm = edge_tts.Communicate(spoken, voice, rate=RATE, boundary="WordBoundary")
    with open(mp3, "wb") as f:
        async for ch in comm.stream():
            if ch["type"] == "audio":
                f.write(ch["data"])
            elif ch["type"] == "WordBoundary":
                s = ch["offset"] / 1e7
                words.append([round(s, 3), round(s + ch["duration"] / 1e7, 3), ch["text"]])
    return words


def main():
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    revoice = "--revoice" in sys.argv
    items = json.load(open(args[0], encoding="utf-8"))
    out = Path(args[1])
    out.mkdir(parents=True, exist_ok=True)
    for it in items:
        lang = it.get("lang", "en")
        voice = VOICES.get(lang, VOICE)
        mp3, meta = out / f"{it['key']}.mp3", out / f"{it['key']}.json"
        if mp3.exists() and meta.exists():
            if not revoice or json.loads(meta.read_text(encoding="utf-8")).get("voice", VOICE) == voice:
                continue
        spoken = it.get("spoken") or to_spoken(it["text"])
        words = asyncio.run(synth(spoken, voice, mp3))
        duration = words[-1][1] + 0.25 if words else 0
        meta.write_text(json.dumps({"text": it["text"], "lang": lang, "voice": voice, "duration": duration, "words": words}, ensure_ascii=False), encoding="utf-8")
        print(f"{it['key']}  {lang}  {duration:5.1f}s  {it['text'][:70]}")


if __name__ == "__main__":
    main()
