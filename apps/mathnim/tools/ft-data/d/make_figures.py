"""Figures for part D (preference optimization): SVG, light theme, bilingual labels.

Run:  python3 apps/mathnim/tools/ft-data/d/make_figures.py
Writes apps/mathnim/public/ft/d/*.svg. Numbers are either exact (computed here
from the formulas) or copied from the papers named in each figure's credit
(see docs/lessons/llm-finetuning/research-preference.md).
"""
import math
import os

OUT = os.path.join(os.path.dirname(__file__), '..', '..', '..', 'public', 'ft', 'd')
C = dict(ink='#111113', muted='#86868B', faint='#E6E6EA', accent='#2563EB', gold='#B8860B', coral='#E4572E',
         good='#1F8A5B', purple='#7C3AED', teal='#0D9488', bg='#FFFFFF', paper='#F5F5F7')
FONT = "font-family: 'PingFang SC', 'Hiragino Sans GB', 'Noto Sans CJK SC', 'Helvetica Neue', Helvetica, Arial, sans-serif"
MATH = "font-family: 'Times New Roman', Times, serif; font-style: italic"


class Svg:
    def __init__(self, w, h, title):
        self.w, self.h, self.title, self.parts = w, h, title, []

    def add(self, s):
        self.parts.append(s)

    def text(self, x, y, s, size=14, color=C['ink'], anchor='start', weight='normal', font=FONT, italic=False):
        s = s.replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;')
        style = f"{font}; font-size: {size}px; fill: {color}; font-weight: {weight}" + ('; font-style: italic' if italic else '')
        self.add(f'<text x="{x:.1f}" y="{y:.1f}" text-anchor="{anchor}" style="{style}">{s}</text>')

    def label(self, x, y, zh, en, size=14, color=C['ink'], anchor='middle', weight='normal'):
        """Chinese on top, English below in grey."""
        self.text(x, y, zh, size, color, anchor, weight)
        if en:
            self.text(x, y + size + 2, en, size - 3, C['muted'], anchor)

    def rect(self, x, y, w, h, fill='none', stroke=C['muted'], sw=1.5, rx=8, opacity=1.0, dash=None):
        d = f' stroke-dasharray="{dash}"' if dash else ''
        self.add(f'<rect x="{x:.1f}" y="{y:.1f}" width="{w:.1f}" height="{h:.1f}" rx="{rx}" fill="{fill}" fill-opacity="{opacity}" stroke="{stroke}" stroke-width="{sw}"{d}/>')

    def line(self, x1, y1, x2, y2, color=C['muted'], sw=1.5, dash=None, arrow=False, opacity=1.0):
        d = f' stroke-dasharray="{dash}"' if dash else ''
        m = ' marker-end="url(#arrow-%s)"' % color.strip('#') if arrow else ''
        self.add(f'<line x1="{x1:.1f}" y1="{y1:.1f}" x2="{x2:.1f}" y2="{y2:.1f}" stroke="{color}" stroke-width="{sw}" stroke-opacity="{opacity}"{d}{m}/>')

    def path(self, pts, color=C['accent'], sw=2.5, dash=None, fill='none', opacity=1.0):
        d = ' '.join(('M' if i == 0 else 'L') + f'{x:.1f} {y:.1f}' for i, (x, y) in enumerate(pts))
        da = f' stroke-dasharray="{dash}"' if dash else ''
        self.add(f'<path d="{d}" fill="{fill}" stroke="{color}" stroke-width="{sw}" stroke-opacity="{opacity}" stroke-linejoin="round"{da}/>')

    def dot(self, x, y, r=4, color=C['accent']):
        self.add(f'<circle cx="{x:.1f}" cy="{y:.1f}" r="{r}" fill="{color}"/>')

    def save(self, name):
        markers = ''.join(
            f'<marker id="arrow-{c.strip("#")}" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0 L10 5 L0 10 z" fill="{c}"/></marker>'
            for c in C.values())
        body = '\n'.join(self.parts)
        svg = (f'<svg xmlns="http://www.w3.org/2000/svg" width="{self.w}" height="{self.h}" viewBox="0 0 {self.w} {self.h}" role="img">\n'
               f'<title>{self.title}</title>\n<defs>{markers}</defs>\n'
               f'<rect width="100%" height="100%" fill="{C["bg"]}"/>\n{body}\n</svg>\n')
        with open(os.path.join(OUT, name), 'w', encoding='utf-8') as f:
            f.write(svg)


def box(s, x, y, w, h, zh, en, color=C['ink'], fill=C['bg'], stroke=C['muted'], size=14):
    s.rect(x, y, w, h, fill=fill, stroke=stroke)
    s.label(x + w / 2, y + h / 2 - (2 if en else -5), zh, en, size, color)


def bar_chart(s, x0, y0, w, h, groups, series, vmax, unit='', ticks=None):
    """groups: [(zh, en, [values...])], series: [(zh, en, color)]."""
    s.line(x0, y0 + h, x0 + w, y0 + h, C['muted'])
    for t in (ticks or []):
        y = y0 + h - h * t / vmax
        s.line(x0, y, x0 + w, y, C['faint'], 1)
        s.text(x0 - 6, y + 4, f'{t}{unit}', 11, C['muted'], 'end')
    gw = w / len(groups)
    bw = min(46, gw * 0.7 / len(series))
    for gi, (zh, en, vals) in enumerate(groups):
        cx = x0 + gw * (gi + 0.5)
        for si, v in enumerate(vals):
            bx = cx - bw * len(series) / 2 + si * bw
            bh = h * v / vmax
            s.rect(bx + 2, y0 + h - bh, bw - 4, bh, fill=series[si][2], stroke=series[si][2], sw=0, rx=2, opacity=0.85)
            s.text(bx + bw / 2, y0 + h - bh - 6, f'{v:g}{unit}', 12, C['ink'], 'middle')
        s.label(cx, y0 + h + 18, zh, en, 13)


os.makedirs(OUT, exist_ok=True)

# ---------------------------------------------------------------- D1
s = Svg(900, 300, 'From a prompt to sampled answers, a ranking, pairs, a reward model, then RL or DPO')
xs = [20, 190, 360, 530, 710]
box(s, xs[0], 110, 140, 70, '提示', 'prompt')
box(s, xs[1], 110, 140, 70, '采样 K 个回答', 'sample K answers')
box(s, xs[2], 110, 140, 70, '人工排序', 'people rank them')
box(s, xs[3], 110, 150, 70, 'K(K−1)/2 对比较', 'K(K-1)/2 pairs')
box(s, xs[4], 60, 170, 60, '奖励模型 → RL', 'reward model -> RL (D2)', C['accent'])
box(s, xs[4], 170, 170, 60, '直接做 DPO', 'or DPO directly (D3)', C['good'])
for a, b in [(160, 190), (330, 360), (500, 530)]:
    s.line(a, 145, b - 4, 145, C['muted'], 2, arrow=True)
s.line(680, 135, 708, 95, C['muted'], 2, arrow=True)
s.line(680, 155, 708, 195, C['muted'], 2, arrow=True)
s.text(450, 270, 'InstructGPT: K = 4 … 9  →  6 … 36 pairs per prompt', 13, C['muted'], 'middle')
s.save('pipeline.svg')

s = Svg(860, 320, 'Rewards (1, 3) and (11, 13) give the same win probability, 0.88, on the sigmoid curve')
def sig(x): return 1 / (1 + math.exp(-x))
for k, (a, b, x0) in enumerate([(1, 3, 40), (11, 13, 220)]):
    base = 270
    for i, (r, col) in enumerate([(a, C['muted']), (b, C['accent'])]):
        h = r * 15
        s.rect(x0 + i * 60, base - h, 44, h, fill=col, stroke=col, sw=0, rx=3, opacity=0.8)
        s.text(x0 + i * 60 + 22, base - h - 8, f'r = {r}', 13, C['ink'], 'middle')
    s.text(x0 + 52, base + 22, f'差 / difference = {b - a}', 13, C['muted'], 'middle')
gx0, gy0, gw, gh = 470, 40, 360, 220
s.line(gx0, gy0 + gh, gx0 + gw, gy0 + gh, C['muted'])
s.line(gx0 + gw / 2, gy0, gx0 + gw / 2, gy0 + gh, C['faint'])
pts = [(gx0 + gw * (d + 6) / 12, gy0 + gh - gh * sig(d)) for d in [x / 10 for x in range(-60, 61)]]
s.path(pts, C['accent'])
px, py = gx0 + gw * (2 + 6) / 12, gy0 + gh - gh * sig(2)
s.line(px, gy0 + gh, px, py, C['gold'], 1.5, dash='4 3')
s.line(gx0 + gw / 2, py, px, py, C['gold'], 1.5, dash='4 3')
s.dot(px, py, 5, C['gold'])
s.text(px + 8, py - 8, 'σ(2) = 0.88', 14, C['gold'])
s.text(gx0 + gw, gy0 + gh + 20, 'r₂ − r₁', 14, C['ink'], 'end')
s.text(gx0 + gw / 2 + 6, gy0 + 12, 'P(y₂ ≻ y₁)', 13, C['ink'])
for v in (-6, 0, 6):
    s.text(gx0 + gw * (v + 6) / 12, gy0 + gh + 16, str(v), 11, C['muted'], 'middle')
s.save('shift.svg')

s = Svg(760, 330, 'Win rate against SFT: length-only reward 56% vs reward model 58% on WebGPT, 64% vs 63% on RLCD')
bar_chart(s, 90, 50, 600, 210, [('WebGPT', '', [56, 58]), ('RLCD', '', [64, 63])],
          [('只看长度', 'length only (LPPO)', C['gold']), ('奖励模型', 'reward model (PPO)', C['accent'])], 80, '%', [0, 20, 40, 60, 80])
s.rect(560, 30, 14, 14, fill=C['gold'], stroke=C['gold'], sw=0, rx=2)
s.text(580, 42, '只看长度 length only', 13)
s.rect(560, 54, 14, 14, fill=C['accent'], stroke=C['accent'], sw=0, rx=2)
s.text(580, 66, '奖励模型 reward model', 13)
s.text(60, 30, '对 SFT 的胜率 / win rate vs SFT', 13, C['muted'])
s.save('length-only.svg')

# ---------------------------------------------------------------- D2b
s = Svg(900, 360, 'RLHF with PPO: the policy samples, the reward model scores, the reference model gives log-probs for the KL penalty, the value model gives advantages, and the policy and value model are updated')
box(s, 30, 140, 120, 64, '提示', 'prompts')
box(s, 200, 140, 150, 64, '策略（训练中）', 'policy (trained)', C['accent'], stroke=C['accent'])
box(s, 420, 40, 170, 60, '奖励模型（冻结）', 'reward model (frozen)', C['muted'])
box(s, 420, 150, 170, 60, '参考模型（冻结）', 'reference (frozen)', C['muted'])
box(s, 420, 260, 170, 60, '价值模型（训练中）', 'value model (trained)', C['accent'], stroke=C['accent'])
box(s, 660, 140, 210, 64, '每个 token 的奖励与优势', 'per-token reward, advantage', C['ink'])
s.line(150, 172, 196, 172, C['muted'], 2, arrow=True)
s.text(385, 132, '回答 y', 13, C['muted'], 'middle')
for yy in (70, 180, 290):
    s.line(350, 172, 416, yy, C['muted'], 1.8, arrow=True)
s.line(590, 70, 690, 138, C['muted'], 1.8, arrow=True)
s.text(640, 92, 'r_φ(x, y)', 13, C['ink'], 'middle', font=MATH)
s.line(590, 180, 656, 172, C['muted'], 1.8, arrow=True)
s.text(622, 165, '−β log π/π_ref', 12, C['ink'], 'middle', font=MATH)
s.line(590, 290, 690, 206, C['muted'], 1.8, arrow=True)
s.text(655, 262, 'V(s_t) → GAE', 12, C['ink'], 'middle')
s.path([(765, 206), (765, 340), (275, 340), (275, 208)], C['accent'], 2, dash='6 4')
s.text(520, 332, 'PPO 截断更新 / clipped update', 13, C['accent'], 'middle')
s.save('rlhf-ppo.svg')

s = Svg(760, 340, 'Schematic of over-optimization: proxy reward keeps rising with sqrt(KL) while gold reward rises then falls, shaped like d(a - b log d)')
x0, y0, w, h = 80, 40, 600, 240
s.line(x0, y0 + h, x0 + w, y0 + h, C['muted'])
s.line(x0, y0, x0, y0 + h, C['muted'])
def gold(d): return d * (1.0 - 0.55 * math.log(max(d, 1e-6)))
def proxy(d): return 1.15 * d
ds = [i / 50 for i in range(1, 300)]
def X(d): return x0 + w * d / 6
def Y(v): return y0 + h - h * (v + 1.5) / 8.5
s.path([(X(d), Y(proxy(d))) for d in ds if proxy(d) < 6.9], C['accent'])
s.path([(X(d), Y(gold(d))) for d in ds], C['good'])
peak = math.exp(1 / 0.55 - 1)
s.dot(X(peak), Y(gold(peak)), 5, C['good'])
s.line(X(peak), Y(gold(peak)), X(peak), y0 + h, C['good'], 1.2, dash='4 3')
s.label(X(peak), y0 + h + 18, '最佳停点', 'best place to stop', 12, C['good'])
s.label(x0 + w - 80, Y(proxy(5.7)) + 4, '代理奖励', 'proxy reward', 13, C['accent'])
s.label(x0 + w - 70, Y(gold(5.4)) + 22, '真实奖励', 'gold reward', 13, C['good'])
s.text(x0 + w, y0 + h + 20, '√KL', 14, C['ink'], 'end')
s.text(x0 - 10, y0 - 10, '奖励 / reward', 13, C['muted'])
s.text(x0 + 10, y0 + 14, '示意形状 / schematic shape', 12, C['muted'])
s.save('overopt.svg')

s = Svg(860, 330, 'Memory for PPO on 8B models: policy 128 GB, value 128 GB, reference 16 GB, reward model 16 GB, 288 GB in total; and Hub model counts with the trl tag: PPO 894, DPO 10,532, GRPO 14,257')
parts = [('策略', 'policy', 128, C['accent']), ('价值模型', 'value', 128, C['purple']), ('参考模型', 'reference', 16, C['muted']), ('奖励模型', 'reward', 16, C['gold'])]
x, y0, h = 60, 70, 40
s.text(60, 50, '8B 模型做 PPO 的显存（不含激活值）/ PPO memory for 8B models, no activations', 14)
scale = 560 / 288
for zh, en, gb, col in parts:
    ww = gb * scale
    s.rect(x, y0, ww, h, fill=col, stroke='#FFFFFF', sw=2, rx=0, opacity=0.85)
    if ww > 60:
        s.text(x + ww / 2, y0 + 25, f'{zh} {gb} GB', 13, '#FFFFFF', 'middle')
    x += ww
s.text(60 + 560 + 10, y0 + 25, '= 288 GB', 15, C['ink'], weight='bold')
s.text(60, y0 + h + 22, '参考模型 16 GB、奖励模型 16 GB / reference 16 GB, reward 16 GB (bf16, frozen)', 12, C['muted'])
s.text(60, 200, 'Hugging Face Hub 上带 trl 标签的模型数（2026-10）/ models tagged with trl', 14)
for i, (name, n, col) in enumerate([('PPO', 894, C['coral']), ('DPO', 10532, C['good']), ('GRPO', 14257, C['accent'])]):
    yy = 220 + i * 32
    ww = 520 * n / 14257
    s.rect(140, yy, ww, 22, fill=col, stroke=col, sw=0, rx=2, opacity=0.85)
    s.text(130, yy + 16, name, 13, C['ink'], 'end')
    s.text(140 + ww + 8, yy + 16, f'{n:,}', 13, C['ink'])
s.save('memory.svg')

# ---------------------------------------------------------------- D3
s = Svg(900, 300, 'Two routes to the same optimum: RLHF trains a reward model then runs RL with sampling; DPO trains the policy directly on preference pairs')
box(s, 20, 115, 150, 70, '偏好对', 'preference pairs')
box(s, 240, 40, 170, 60, '奖励模型 r_φ', 'reward model', C['accent'])
box(s, 480, 40, 190, 60, 'RL（采样循环）', 'RL with sampling (D2)', C['accent'])
box(s, 240, 200, 430, 60, 'DPO 损失：直接训练策略', 'DPO loss: train the policy directly (D3)', C['good'])
box(s, 740, 115, 140, 70, '同一个最优解 π*', 'the same optimum', C['ink'])
s.line(170, 140, 236, 75, C['muted'], 2, arrow=True)
s.line(410, 70, 476, 70, C['muted'], 2, arrow=True)
s.line(670, 70, 736, 135, C['muted'], 2, arrow=True)
s.line(170, 160, 236, 228, C['muted'], 2, arrow=True)
s.line(670, 230, 736, 168, C['muted'], 2, arrow=True)
s.save('two-routes.svg')

s = Svg(760, 320, 'The DPO weight sigma(-u) against the margin u: near 1 for pairs ranked wrong, near 0 for pairs ranked right by a wide margin')
x0, y0, w, h = 80, 30, 600, 220
s.line(x0, y0 + h, x0 + w, y0 + h, C['muted'])
s.line(x0 + w / 2, y0, x0 + w / 2, y0 + h, C['faint'])
s.path([(x0 + w * (u + 6) / 12, y0 + h - h * sig(-u)) for u in [x / 10 for x in range(-60, 61)]], C['coral'], 3)
for v in (-6, -3, 0, 3, 6):
    s.text(x0 + w * (v + 6) / 12, y0 + h + 18, str(v), 12, C['muted'], 'middle')
s.text(x0 + w, y0 + h + 38, 'u = r̂_w − r̂_l', 14, C['ink'], 'end')
s.text(x0 - 8, y0 + 8, '1', 12, C['muted'], 'end')
s.text(x0 - 8, y0 + h, '0', 12, C['muted'], 'end')
s.label(x0 + 120, y0 + 50, '排错了：全力学', 'ranked wrong: learn hard', 13, C['coral'])
s.label(x0 + w - 120, y0 + h - 60, '已排对：几乎不学', 'ranked right: barely learn', 13, C['muted'])
s.text(x0 + w / 2 + 8, y0 + 14, 'σ(−u)', 15, C['coral'])
s.save('dpo-weight.svg')

s = Svg(900, 230, 'Token-level cancellation: the chosen and rejected answers share a prefix whose gradients cancel; only the tokens after they diverge get gradient')
toks_w = ['抱歉', '，', '我', '不能', '帮', '你', '做', '这件事', '，', '不过', '你可以', '试试', '……']
toks_l = ['抱歉', '，', '我', '不能', '帮', '你', '做', '这件事', '。']
def row(toks, y, shared, col):
    x = 140
    for i, tk in enumerate(toks):
        wd = 18 + 16 * len(tk)
        sh = i < shared
        s.rect(x, y, wd, 34, fill=C['faint'] if sh else col, stroke=C['faint'] if sh else col, sw=0, rx=4, opacity=1 if sh else 0.25)
        s.text(x + wd / 2, y + 23, tk, 15, C['muted'] if sh else C['ink'], 'middle')
        x += wd + 4
row(toks_w, 50, 8, C['good'])
row(toks_l, 120, 8, C['coral'])
s.label(70, 70, '被选 y_w', 'chosen', 14, C['good'])
s.label(70, 140, '被拒 y_l', 'rejected', 14, C['coral'])
s.text(140, 190, '灰色：共享前缀，梯度互相抵消 / grey: shared prefix, gradients cancel', 13, C['muted'])
s.text(140, 212, '着色：分叉之后，才有梯度 / coloured: after they diverge, gradient flows', 13, C['muted'])
s.save('token-cancel.svg')

s = Svg(760, 320, 'Refusal rate on harmful prompts before and after DPO on refusal pairs: Llama-3-8B-Instruct 74.4% to 33.4%, Gemma-2B-IT 80.5% to 54.8%')
bar_chart(s, 90, 50, 600, 200, [('Llama-3-8B-Instruct', '', [74.4, 33.4]), ('Gemma-2B-IT', '', [80.5, 54.8])],
          [('DPO 前', 'before', C['muted']), ('DPO 后', 'after', C['coral'])], 100, '%', [0, 25, 50, 75, 100])
s.rect(540, 22, 14, 14, fill=C['muted'], stroke=C['muted'], sw=0, rx=2)
s.text(560, 34, 'DPO 前 before', 13)
s.rect(540, 44, 14, 14, fill=C['coral'], stroke=C['coral'], sw=0, rx=2)
s.text(560, 56, 'DPO 后 after', 13)
s.text(60, 30, '有害提示上的拒答率 / refusal rate', 13, C['muted'])
s.save('refusal.svg')

s = Svg(900, 300, 'Where DPO sits in recipes: Llama 3 (rejection sampling, SFT, DPO, six rounds), Tulu 3 (SFT, DPO, RLVR), Llama 4 (light SFT, online RL, light DPO), Olmo 3 (SFT, delta-learning DPO, RLVR)')
rows = [('Llama 3 (2024)', [('SFT', C['muted']), ('DPO', C['good']), ('× 6 轮 rounds', C['muted'])]),
        ('Tülu 3 (2024)', [('SFT', C['muted']), ('DPO', C['good']), ('RLVR', C['accent'])]),
        ('Llama 4 (2025)', [('轻量 SFT', C['muted']), ('在线 RL', C['accent']), ('轻量 DPO', C['good'])]),
        ('Olmo 3 (2025)', [('SFT', C['muted']), ('delta DPO', C['good']), ('RLVR', C['accent'])])]
for i, (name, stages) in enumerate(rows):
    y = 40 + i * 62
    s.text(150, y + 26, name, 14, C['ink'], 'end')
    x = 170
    for lab, col in stages:
        s.rect(x, y, 170, 40, fill=col, stroke=col, sw=0, rx=6, opacity=0.2)
        s.text(x + 85, y + 26, lab, 14, C['ink'], 'middle')
        if x > 170:
            s.line(x - 24, y + 20, x - 4, y + 20, C['muted'], 1.5, arrow=True)
        x += 200
s.save('recipes.svg')

# ---------------------------------------------------------------- D4
s = Svg(760, 330, 'Loss against the margin h: the DPO loss keeps falling as h grows; the IPO loss is a parabola with its minimum at h* = 1/(2 tau)')
x0, y0, w, h = 80, 30, 600, 230
s.line(x0, y0 + h, x0 + w, y0 + h, C['muted'])
def X(v): return x0 + w * (v + 2) / 8
def Y(v): return y0 + h - h * min(v, 4) / 4
hs = [i / 20 for i in range(-40, 121)]
s.path([(X(v), Y(-math.log(sig(v)))) for v in hs], C['accent'], 3)
s.path([(X(v), Y((v - 1) ** 2)) for v in hs if (v - 1) ** 2 <= 4], C['purple'], 3)
s.line(X(1), y0 + h, X(1), Y(0), C['purple'], 1.2, dash='4 3')
for v in (-2, 0, 2, 4, 6):
    s.text(X(v), y0 + h + 18, str(v), 12, C['muted'], 'middle')
s.text(x0 + w, y0 + h + 38, 'h = Δ_w − Δ_l', 14, C['ink'], 'end')
s.label(X(4.4), Y(0.35), 'DPO：一直往下，没有底', 'DPO: keeps falling', 13, C['accent'])
s.label(X(2.8), Y(3.3), 'IPO：最低点 h* = 1/(2τ)', 'IPO: minimum at 1/(2τ), here τ = 0.5', 13, C['purple'], anchor='start')
s.save('loss-curves.svg')

s = Svg(900, 330, 'Toy model, 400 steps on a similar pair: DPO sends the chosen probability to 0 and the harmful answer to 0.999; DPO plus NLL keeps the chosen at 0.92; IPO stops at a gap of 1 with the chosen at 0.22 and the harmful answer at 0.40')
names = ['y_w 礼貌拒答', 'y_l 生硬拒答', 'y_3 照做', 'y_4 跑题', 'y_5 普通拒答']
cols = [C['good'], C['coral'], C['coral'], C['muted'], C['teal']]
panels = [('DPO', [0.000, 0.000, 0.999, 0.000, 0.001]), ('DPO + NLL (α = 0.5)', [0.922, 0.0, 0.005, 0.0, 0.07]), ('IPO (目标 h = 1)', [0.218, 0.0, 0.403, 0.0, 0.0])]
refs = [0.20, 0.30, 0.05, 0.15, 0.30]
import json
def toy(kind, alpha=0.0, steps=400, tau=0.5):
    phi = [(1, 0.5), (1, 0), (-1, 1.5), (0, 0), (1, 0.25)]
    base = [math.log(p) for p in refs]
    th = [0.0, 0.0]
    for _ in range(steps + 1):
        lg = [b + th[0] * f[0] + th[1] * f[1] for b, f in zip(base, phi)]
        m = max(lg); z = sum(math.exp(v - m) for v in lg)
        p = [math.exp(v - m) / z for v in lg]
        hh = (math.log(p[0]) - base[0]) - (math.log(p[1]) - base[1])
        coef = sig(-hh) if kind == 'dpo' else -2 * (hh - 1 / (2 * tau)) * 0.1
        e = [sum(pi * f[k] for pi, f in zip(p, phi)) for k in (0, 1)]
        d = [phi[0][k] - phi[1][k] for k in (0, 1)]
        th = [th[k] + coef * d[k] + alpha * (phi[0][k] - e[k]) for k in (0, 1)]
    return p
panels = [('DPO', toy('dpo')), ('DPO + NLL (α = 0.5)', toy('dpo', 0.5)), ('IPO (h → 1)', toy('ipo'))]
for pi_, (title, probs) in enumerate(panels):
    x0 = 30 + pi_ * 290
    s.text(x0 + 130, 34, title, 15, C['ink'], 'middle', weight='bold')
    for i, (nm, pr) in enumerate(zip(names, probs)):
        y = 60 + i * 50
        s.text(x0 + 92, y + 18, nm, 12, C['ink'], 'end')
        s.rect(x0 + 100, y + 4, 160 * refs[i], 20, fill='none', stroke=C['muted'], sw=1.2, rx=2)
        if pr > 0.002:
            s.rect(x0 + 100, y + 8, 160 * pr, 12, fill=cols[i], stroke=cols[i], sw=0, rx=2, opacity=0.85)
        s.text(x0 + 104 + 160 * max(pr, refs[i]), y + 19, f'{pr:.2f}', 11, C['muted'])
s.text(450, 318, '实心：训练 400 步后的概率；空心：参考模型 π_ref（玩具模型，精确计算）/ solid: after 400 steps; outline: π_ref (toy, exact)', 12, C['muted'], 'middle')
s.save('toy-variants.svg')

s = Svg(900, 300, 'A preference-data pipeline: prompts, candidate answers (on-policy samples, other models, strong vs weak), labels (people or a judge with swapped positions), filters (ties, near-duplicates, length balance, truncation, decontamination), then pairs for DPO, with a loop back for iteration')
stages = [('提示', 'prompts', '真实分布、去重'), ('候选回答', 'candidates', '在线采样 / 其他模型 / 强弱配对'), ('标注', 'labels', '人工 / 评委，交换位置'), ('过滤', 'filters', '平局、近似重复、长度、截断'), ('偏好对 → DPO', 'pairs -> DPO', '')]
for i, (zh, en, sub) in enumerate(stages):
    x = 20 + i * 178
    box(s, x, 80, 150, 70, zh, en, C['good'] if i == 4 else C['ink'])
    if sub:
        s.text(x + 75, 178, sub, 12, C['muted'], 'middle')
    if i:
        s.line(x - 24, 115, x - 4, 115, C['muted'], 2, arrow=True)
s.path([(805, 150), (805, 250), (395, 250), (395, 200)], C['accent'], 2, dash='6 4')
s.text(600, 272, '迭代：用新模型重新采样 / iterate: sample again from the new model', 13, C['accent'], 'middle')
s.save('data-pipeline.svg')

s = Svg(760, 330, 'Olmo 3 delta learning, 7B development average: SFT checkpoint 70.3, continued SFT on the chosen answers 64.5, DPO on strong-vs-weak pairs 72.9')
bar_chart(s, 100, 50, 560, 200, [('SFT 起点', 'SFT start', [70.3]), ('在被选回答上继续 SFT', 'more SFT on the chosen', [64.5]), ('强 vs 弱做 DPO', 'DPO on strong vs weak', [72.9])],
          [('', '', C['accent'])], 80, '', [0, 20, 40, 60, 80])
s.text(70, 30, '7B 开发集平均分 / 7B dev average (Olmo 3, Table 21)', 13, C['muted'])
s.save('delta.svg')

s = Svg(900, 280, 'Offline DPO uses one fixed dataset once; iterative DPO samples from the current model, labels, trains, and makes the result the next reference')
s.text(200, 36, '离线 / offline', 15, C['ink'], 'middle', weight='bold')
box(s, 40, 70, 130, 60, '固定数据', 'fixed pairs')
box(s, 230, 70, 130, 60, 'DPO 一轮', 'DPO once', C['good'])
s.line(170, 100, 226, 100, C['muted'], 2, arrow=True)
s.text(640, 36, '迭代 / 在线 · iterative / online', 15, C['ink'], 'middle', weight='bold')
cx, cy, r = 640, 160, 90
labs = [('当前模型采样', 'sample from current'), ('评委 / 奖励模型打分', 'judge or RM labels'), ('以当前模型为参考做 DPO', 'DPO, ref = current'), ('新模型', 'new model')]
for i, (zh, en) in enumerate(labs):
    a = -math.pi / 2 + i * math.pi / 2
    x, y = cx + 1.6 * r * math.cos(a), cy + r * math.sin(a) * 0.95
    box(s, x - 95, y - 26, 190, 52, zh, en, C['good'] if i == 2 else C['ink'], size=13)
s.add(f'<circle cx="{cx}" cy="{cy}" r="34" fill="none" stroke="{C["accent"]}" stroke-width="2" stroke-dasharray="6 4"/>')
s.text(cx, cy + 5, '循环 loop', 12, C['accent'], 'middle')
s.save('iterate.svg')

s = Svg(760, 280, 'Hub model counts by tag (2026-10): dpo 13,519, orpo 1,279, kto 428')
for i, (name, n, col) in enumerate([('dpo', 13519, C['good']), ('orpo', 1279, C['purple']), ('kto', 428, C['teal'])]):
    y = 60 + i * 50
    ww = 520 * n / 13519
    s.rect(140, y, ww, 30, fill=col, stroke=col, sw=0, rx=3, opacity=0.85)
    s.text(130, y + 21, name, 14, C['ink'], 'end')
    s.text(140 + ww + 8, y + 21, f'{n:,}', 14, C['ink'])
s.text(60, 34, 'Hugging Face Hub 上按标签统计的模型数 / models on the Hub by tag (2026-10)', 13, C['muted'])
s.save('usage.svg')

print('wrote', sorted(os.listdir(OUT)))
