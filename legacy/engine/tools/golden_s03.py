"""Dump ground-truth data from Manim for the S03 bake-off.

golden.json   : every drawable (points + style) of key S03 objects, in draw order
narration.json: caption text -> audio file + duration (same TTS cache Manim used)
"""
import json, shutil, sys
from pathlib import Path
ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "lessons" / "best_angle"))
sys.path.insert(0, str(ROOT))
from common import *  # noqa
from manim.utils.family import extract_mobject_family_members
from mathkit.narration import speak

OUT = ROOT.parent / "web" / "bakeoff"
(OUT / "media" / "audio").mkdir(parents=True, exist_ok=True)

TEXT_IDS = set()

def dump(*mobs):
    fam = extract_mobject_family_members(list(mobs), only_those_with_points=True)
    out = []
    for m in fam:
        if id(m) in TEXT_IDS:
            continue
        out.append({
            "pts": [round(float(v), 6) for v in m.points[:, :2].ravel()],
            "fill": [round(float(v), 5) for v in m.fill_rgbas[0]],
            "stroke": [round(float(v), 5) for v in m.stroke_rgbas[0]],
            "sw": float(m.stroke_width),
        })
    return out

pitch = make_pitch()
graph = AngleGraph(pitch)
full = graph.curve(0.02, 30)
cone = view_cone(pitch, BEST, number=False)
dot = glow_dot(graph.point(BEST), TEAL, r=0.07)
ro = readout(BEST, pitch.theta(BEST)).move_to(RIGHT * 3.75 + UP * 3.25)
alt = Pitch(**PITCH_KW, posts=(12.0, 20.0))
alt_curve = DashedVMobject(graph.ax.plot(lambda v: alt.theta(v), x_range=[0.05, 30, 0.05]), num_dashes=60).set_color(GOLD)
alt_peak = np.sqrt(12 * 20)
qmark = T("?", font_size=48, color=GOLD).next_to(graph.ax.c2p(alt_peak, alt.theta(alt_peak)), UP, buff=0.15)
peak_lines = VGroup(
    DashedLine(graph.ax.c2p(BEST, 0), graph.point(BEST), dash_length=0.06, color=TEAL, stroke_width=1.5),
    DashedLine(graph.ax.c2p(0, pitch.theta(BEST)), graph.point(BEST), dash_length=0.06, color=TEAL, stroke_width=1.5),
)
P_ = pitch.p(0, BEST)
circ = pitch.circle_through_posts(BEST, BLUE, width=4)
labs = VGroup(
    point_label("A", pitch.A(), UP + LEFT * 0.4, color=GOLD, font_size=34),
    point_label("B", pitch.B(), UP + RIGHT * 0.4, color=GOLD, font_size=34),
    point_label("P", P_, LEFT, color=INK, font_size=34).shift(RIGHT * 0.05),
)
for tm in (graph.frame_parts[3], graph.frame_parts[4][1]):
    TEXT_IDS.update(id(x) for x in tm.get_family())
texts = {}
for s, fs in [("distance from goal line, d (m)", 22), ("shooting angle", 22)]:
    t = label(s, fs, MUTED)
    texts[s] = {"w": t.width, "h": t.height, "n": len(t.family_members_with_points())}

golden = {
    "pitch": dump(pitch), "path": dump(pitch.path), "graph": dump(graph), "full": dump(full),
    "cone": dump(cone), "dot": dump(dot), "ro": dump(ro), "alt_curve": dump(alt_curve),
    "qmark": dump(qmark), "peak_lines": dump(peak_lines), "circ": dump(circ), "labs": dump(labs),
    "texts": texts,
    "text_boxes": {k: [float(v) for v in (m.get_left()[0], m.get_right()[0], m.get_bottom()[1], m.get_top()[1])]
                   for k, m in [("xl", graph.frame_parts[3]), ("yl", graph.frame_parts[4][1])]},
}
(OUT / "golden.json").write_text(json.dumps(golden))

lines = [
    "Dragging finds the peak: about 12 meters out, where the angle tops out near 16.3°.",
    "But why 12? Move the goal, or change her run, and we would have to measure all over again.",
    "Mathematicians want to see why. And the key is a surprisingly simple fact about circles.",
]
narr = {}
for s in lines:
    c = speak(s)
    shutil.copy(c.path, OUT / "media" / "audio" / c.path.name)
    narr[s] = {"src": f"media/audio/{c.path.name}", "duration": c.duration}
(OUT / "narration.json").write_text(json.dumps(narr, indent=1))
print("ok", {k: len(v) for k, v in golden.items() if isinstance(v, list)})
