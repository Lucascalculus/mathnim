"""Render manim's doc examples with real manim and save reference frames.

    python tools/golden_examples.py [name ...]      (default: all)

Frames are sampled every SAMPLE_EVERY frames plus the final frame, at
480x270 / 10 fps, into examples/golden/<Name>/f<index>.png, and summarised in
examples/golden/index.json. Each example runs in its own process with a timeout.

There is no LaTeX here: manim's tex_to_svg_file is replaced (inside the
worker) by manim-web's MathJax adapter (tools/tex_server.mjs), which writes
an SVG in dvisvgm's conventions (pt, 10pt base size, <g id> groups for
MathTex parts). Real manim then parses and scales it as usual, so the goldens
show what manim would draw if LaTeX were MathJax.
"""
import json, os, shutil, subprocess, sys, tempfile
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

HERE = Path(__file__).resolve().parent.parent
EXAMPLES = json.load(open(HERE / "examples/manim_examples.json"))
OUT = HERE / "examples/golden"
W, H, FPS, SAMPLE_EVERY = 480, 270, 10, 5
TEX_SERVER = HERE / "tools/tex_server.mjs"
NODE = shutil.which("node") or "node"

# TeX -> SVG through a persistent node MathJax process (started on first use).
TEX_PATCH = r'''
import json as _json, subprocess as _sp, sys as _sys
from manim import config as _config
from manim.utils import tex_file_writing as _tfw
import manim.mobject.text.tex_mobject as _tm
_tex = {"proc": None, "n": 0}
def _tex_to_svg_file(expression, environment=None, tex_template=None):
    if tex_template is None:
        tex_template = _config["tex_template"]
    body = tex_template.body
    tex_dir = _config.get_dir("tex_dir")
    tex_dir.mkdir(parents=True, exist_ok=True)
    svg_file = tex_dir / (_tfw.tex_hash(repr((expression, environment, body))) + ".svg")
    if svg_file.exists():
        return svg_file
    if _tex["proc"] is None:
        _tex["proc"] = _sp.Popen([_sys.argv[4], _sys.argv[3]], stdin=_sp.PIPE, stdout=_sp.PIPE, text=True, encoding="utf-8")
    p = _tex["proc"]
    _tex["n"] += 1
    p.stdin.write(_json.dumps({"id": _tex["n"], "tex": expression, "env": environment, "template": body}) + "\n")
    p.stdin.flush()
    res = _json.loads(p.stdout.readline())
    if "error" in res:
        raise ValueError(f"latex error converting to dvi (MathJax: {res['error']})")
    svg_file.write_text(res["svg"], encoding="utf-8")
    return svg_file
_tfw.tex_to_svg_file = _tex_to_svg_file
_tm.tex_to_svg_file = _tex_to_svg_file
'''

WORKER = r'''
import json, sys, numpy as np
from pathlib import Path
from PIL import Image
from manim import *
from manim.renderer.cairo_renderer import CairoRenderer
ex = json.loads(sys.stdin.read())
out = Path(sys.argv[1]); out.mkdir(parents=True, exist_ok=True)
config.pixel_width, config.pixel_height, config.frame_rate = %d, %d, %d
config.write_to_movie = False; config.save_last_frame = False; config.disable_caching = True
config.media_dir = sys.argv[2]; config.verbosity = "ERROR"; config.progress_bar = "none"
count = [0]; saved = []
orig = CairoRenderer.add_frame
def add_frame(self, frame, num_frames=1):
    for k in range(num_frames):
        i = count[0] + k
        if i %% %d == 0:
            Image.fromarray(frame).convert("RGB").save(out / f"f{i}.png"); saved.append(i)
    count[0] += num_frames
    return orig(self, frame, num_frames)
CairoRenderer.add_frame = add_frame
exec(TEX_PATCH)
ns = {}
exec("from manim import *\n" + ex["code"], ns)
scene = ns[ex["name"]]()
scene.render()
scene.renderer.update_frame(scene, ignore_skipping=True)
Image.fromarray(scene.renderer.get_frame()).convert("RGB").save(out / "last.png")
print(json.dumps({"total_frames": count[0], "frames": saved, "time": scene.renderer.time}))
''' % (W, H, FPS, SAMPLE_EVERY)
WORKER = WORKER.replace('exec(TEX_PATCH)', TEX_PATCH)

def run(ex):
    d = OUT / ex["key"]
    with tempfile.TemporaryDirectory() as media:
        try:
            p = subprocess.run([sys.executable, "-c", WORKER, str(d), media, str(TEX_SERVER), NODE], input=json.dumps(ex), capture_output=True, text=True, timeout=120, cwd=media)
        except subprocess.TimeoutExpired:
            return ex["key"], {"status": "timeout"}
    if p.returncode != 0:
        err = (p.stderr.strip().splitlines() or ["?"])[-1][:300]
        return ex["key"], {"status": "error", "error": err}
    info = json.loads(p.stdout.strip().splitlines()[-1])
    return ex["key"], {"status": "ok", **info}

if __name__ == "__main__":
    names = set(sys.argv[1:])
    todo = [e for e in EXAMPLES if not names or e["name"] in names or e["key"] in names]
    OUT.mkdir(parents=True, exist_ok=True)
    subprocess.run([NODE, str(TEX_SERVER), "--build"], check=True, cwd=HERE)
    idx_path = OUT / "index.json"
    index = json.load(open(idx_path)) if idx_path.exists() else {}
    with ThreadPoolExecutor(max_workers=max(2, (os.cpu_count() or 4) - 2)) as pool:
        for name, info in pool.map(run, todo):
            index[name] = info
            print(f"{name}: {info['status']} {info.get('error', '')}", flush=True)
    json.dump(index, open(idx_path, "w"), indent=1)
    ok = sum(1 for v in index.values() if v["status"] == "ok")
    print(f"ok {ok}/{len(index)}")
