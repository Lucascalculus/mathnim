# The design previews' figure details: for each high-resolution lesson frame (hi/*.webp), the 16:10 window that
# holds the most coloured ink (curves, matrices, the cart), so a small card shows a readable piece of the figure
# instead of the whole figure shrunk. Writes crops.json: {id: [x, y, w, h]} as fractions of the frame.
# Run from the repo root: python3 docs/design/ui-2026-11/crops.py
import json, glob, os
from PIL import Image

here = os.path.dirname(os.path.abspath(__file__))
out = {}
for f in sorted(glob.glob(os.path.join(here, 'hi', '*.webp'))):
    lid = os.path.basename(f).split('.')[0]
    im = Image.open(f).convert('HSV').resize((192, 108))
    W, H = im.size
    px = im.load()
    # coloured ink weighs most; dark grey ink (axes, text) a little, so a window isn't just a blob of colour
    weight = [[0.0] * W for _ in range(H)]
    for y in range(H):
        for x in range(W):
            h, s, v = px[x, y]
            weight[y][x] = (s / 255) * (v / 255) * 1.0 + (0.18 if v < 140 else 0.0)
    # integral image for fast window sums
    I = [[0.0] * (W + 1) for _ in range(H + 1)]
    for y in range(H):
        row = 0.0
        for x in range(W):
            row += weight[y][x]
            I[y + 1][x + 1] = I[y][x + 1] + row
    best = None
    for frac in (0.5, 0.58, 0.66):  # window widths as a share of the frame
        ww = int(W * frac)
        wh = int(ww * 10 / 16)
        if wh > H:
            continue
        for y in range(0, H - wh + 1, 2):
            for x in range(0, W - ww + 1, 2):
                s = I[y + wh][x + ww] - I[y][x + ww] - I[y + wh][x] + I[y][x]
                # density, with a small bonus for larger windows (more context)
                score = s / (ww * wh) * (1 + 0.6 * frac)
                if best is None or score > best[0]:
                    best = (score, x / W, y / H, ww / W, wh / H)
    out[lid] = [round(v, 4) for v in best[1:]]
    print(lid, out[lid])
json.dump(out, open(os.path.join(here, 'crops.json'), 'w'), indent=1)
