# One contact sheet per set, from the reference shots: contact.py <shots_dir> <set> <id,id,...> <out.jpg>
import sys
from PIL import Image, ImageDraw, ImageFont
root, s, ids, out = sys.argv[1], sys.argv[2], sys.argv[3].split(','), sys.argv[4]
W, H, G, cols = 640, 400, 12, 2
rows = (len(ids) + cols - 1) // cols
sheet = Image.new('RGB', (cols * W + (cols + 1) * G, rows * (H + 34) + (rows + 1) * G), (251, 250, 247))
d = ImageDraw.Draw(sheet)
try: font = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf', 15)
except Exception: font = ImageFont.load_default()
for i, k in enumerate(ids):
    try: im = Image.open(f'{root}/{s}/{k}.png').convert('RGB').resize((W, H))
    except Exception: continue
    x, y = G + (i % cols) * (W + G), G + (i // cols) * (H + 34 + G)
    sheet.paste(im, (x, y)); d.text((x + 2, y + H + 8), f'{i + 1:02d}  {k}', fill=(26, 27, 31), font=font)
sheet.save(out, quality=86)
