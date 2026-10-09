"""Figures for part D (preference optimization): SVG, light theme, one file per language.

Run:  python3 apps/mathnim/tools/ft-data/d/make_figures.py
Writes apps/mathnim/public/ft/d/<name>.en.svg and <name>.zh.svg. Numbers are either
exact (computed here from the formulas) or copied from the papers named in each
figure's credit (see docs/lessons/llm-finetuning/research-preference.md).
"""
import math
import os

OUT = os.path.join(os.path.dirname(__file__), '..', '..', '..', 'public', 'ft', 'd')
C = dict(ink='#111113', muted='#86868B', faint='#E6E6EA', accent='#2563EB', gold='#B8860B', coral='#E4572E',
         good='#1F8A5B', purple='#7C3AED', teal='#0D9488', bg='#FFFFFF', paper='#F5F5F7')
FONTS = dict(
    zh="font-family: 'PingFang SC', 'Hiragino Sans GB', 'Noto Sans CJK SC', 'Helvetica Neue', Helvetica, Arial, sans-serif",
    en="font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif")
MATH = "font-family: 'Times New Roman', Times, serif; font-style: italic"
L = 'en'


def T(zh, en=None):
    """The string for the current language. An empty or missing English string means 'same in both'."""
    return zh if (L == 'zh' or not en) else en


def width(s, size):
    """Rough rendered width: CJK and full-width characters are one em, the rest about 0.56 em."""
    return sum(size if ord(ch) >= 0x2E80 else size * 0.56 for ch in s)


def sig(x):
    return 1 / (1 + math.exp(-x))


class Svg:
    def __init__(self, w, h, title):
        self.w, self.h, self.title, self.parts = w, h, title, []

    def add(self, s):
        self.parts.append(s)

    def text(self, x, y, s, size=14, color=C['ink'], anchor='start', weight='normal', font=None):
        s = s.replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;')
        style = f"{font or FONTS[L]}; font-size: {size:g}px; fill: {color}; font-weight: {weight}"
        self.add(f'<text x="{x:.1f}" y="{y:.1f}" text-anchor="{anchor}" style="{style}">{s}</text>')

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
        title = T(self.title[1], self.title[0]).replace('&', '&amp;').replace('<', '&lt;')
        svg = (f'<svg xmlns="http://www.w3.org/2000/svg" width="{self.w}" height="{self.h}" viewBox="0 0 {self.w} {self.h}" role="img">\n'
               f'<title>{title}</title>\n<defs>{markers}</defs>\n'
               f'<rect width="100%" height="100%" fill="{C["bg"]}"/>\n{body}\n</svg>\n')
        with open(os.path.join(OUT, f'{name}.{L}.svg'), 'w', encoding='utf-8') as f:
            f.write(svg)


def box(s, x, y, w, h, zh, en, color=C['ink'], fill=C['bg'], stroke=C['muted'], size=14):
    """A box with one centred label, shrunk to fit if needed."""
    s.rect(x, y, w, h, fill=fill, stroke=stroke)
    lab = T(zh, en)
    size = min(size, (w - 16) / max(width(lab, 1), 1))
    s.text(x + w / 2, y + h / 2 + size * 0.36, lab, size, color, 'middle')


def bar_chart(s, x0, y0, w, h, groups, series, vmax, unit='', ticks=None):
    """groups: [(zh, en, [values...])], series: [color]."""
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
            s.rect(bx + 2, y0 + h - bh, bw - 4, bh, fill=series[si], stroke=series[si], sw=0, rx=2, opacity=0.85)
            s.text(bx + bw / 2, y0 + h - bh - 6, f'{v:g}{unit}', 12, C['ink'], 'middle')
        s.text(cx, y0 + h + 20, T(zh, en), 13, C['ink'], 'middle')


def legend(s, x, y, items):
    for i, (col, lab) in enumerate(items):
        s.rect(x, y + i * 22, 14, 14, fill=col, stroke=col, sw=0, rx=2)
        s.text(x + 20, y + i * 22 + 12, lab, 13)


def build():
    # ------------------------------------------------------------ D1
    s = Svg(900, 300, ('From a prompt to sampled answers, a ranking, pairs, a reward model, then RL or DPO',
                       '从提示到采样回答、人工排序、成对比较，再到奖励模型和 RL，或者直接 DPO'))
    xs = [20, 190, 360, 530, 710]
    box(s, xs[0], 110, 140, 70, '提示', 'prompt')
    box(s, xs[1], 110, 140, 70, '采样 K 个回答', 'sample K answers')
    box(s, xs[2], 110, 140, 70, '人工排序', 'people rank them')
    box(s, xs[3], 110, 150, 70, 'K(K−1)/2 对比较', 'K(K−1)/2 pairs')
    box(s, xs[4], 60, 170, 60, '奖励模型 → RL（D2）', 'reward model → RL (D2)', C['accent'])
    box(s, xs[4], 170, 170, 60, '或直接 DPO（D3）', 'or DPO directly (D3)', C['good'])
    for a, b in [(160, 190), (330, 360), (500, 530)]:
        s.line(a, 145, b - 4, 145, C['muted'], 2, arrow=True)
    s.line(680, 135, 708, 95, C['muted'], 2, arrow=True)
    s.line(680, 155, 708, 195, C['muted'], 2, arrow=True)
    s.text(450, 270, T('InstructGPT：每个提示 K = 4 … 9 个回答 → 6 … 36 对比较',
                       'InstructGPT: K = 4 … 9 answers per prompt → 6 … 36 pairs'), 13, C['muted'], 'middle')
    s.save('pipeline')

    s = Svg(860, 320, ('Rewards (1, 3) and (11, 13) give the same win probability, 0.88, on the sigmoid curve',
                       '奖励 (1, 3) 和 (11, 13) 在 sigmoid 曲线上给出同一个胜率 0.88'))
    for a, b, x0 in [(1, 3, 40), (11, 13, 220)]:
        base = 270
        for i, (r, col) in enumerate([(a, C['muted']), (b, C['accent'])]):
            h = r * 15
            s.rect(x0 + i * 60, base - h, 44, h, fill=col, stroke=col, sw=0, rx=3, opacity=0.8)
            s.text(x0 + i * 60 + 22, base - h - 8, f'r = {r}', 13, C['ink'], 'middle')
        s.text(x0 + 52, base + 22, T(f'差 = {b - a}', f'difference = {b - a}'), 13, C['muted'], 'middle')
    gx0, gy0, gw, gh = 470, 40, 360, 220
    s.line(gx0, gy0 + gh, gx0 + gw, gy0 + gh, C['muted'])
    s.line(gx0 + gw / 2, gy0, gx0 + gw / 2, gy0 + gh, C['faint'])
    s.path([(gx0 + gw * (d + 6) / 12, gy0 + gh - gh * sig(d)) for d in [x / 10 for x in range(-60, 61)]], C['accent'])
    px, py = gx0 + gw * (2 + 6) / 12, gy0 + gh - gh * sig(2)
    s.line(px, gy0 + gh, px, py, C['gold'], 1.5, dash='4 3')
    s.line(gx0 + gw / 2, py, px, py, C['gold'], 1.5, dash='4 3')
    s.dot(px, py, 5, C['gold'])
    s.text(px + 8, py - 8, 'σ(2) = 0.88', 14, C['gold'])
    s.text(gx0 + gw, gy0 + gh + 20, 'r₂ − r₁', 14, C['ink'], 'end')
    s.text(gx0 + gw / 2 + 6, gy0 + 12, 'P(y₂ ≻ y₁)', 13, C['ink'])
    for v in (-6, 0, 6):
        s.text(gx0 + gw * (v + 6) / 12, gy0 + gh + 16, str(v), 11, C['muted'], 'middle')
    s.save('shift')

    s = Svg(760, 330, ('Win rate against SFT: length-only reward 56% vs reward model 58% on WebGPT, 64% vs 63% on RLCD',
                       '对 SFT 的胜率：WebGPT 上只看长度 56%、奖励模型 58%；RLCD 上 64% 对 63%'))
    bar_chart(s, 90, 50, 600, 210, [('WebGPT', '', [56, 58]), ('RLCD', '', [64, 63])], [C['gold'], C['accent']], 80, '%', [0, 20, 40, 60, 80])
    legend(s, 540, 22, [(C['gold'], T('只看长度（LPPO）', 'length only (LPPO)')), (C['accent'], T('奖励模型（PPO）', 'reward model (PPO)'))])
    s.text(60, 30, T('对 SFT 的胜率', 'win rate vs SFT'), 13, C['muted'])
    s.save('length-only')

    # ------------------------------------------------------------ D2b
    s = Svg(900, 360, ('RLHF with PPO: the policy samples, the reward model scores, the reference model gives log-probs for the KL penalty, the value model gives advantages, and the policy and value model are updated',
                       '用 PPO 做 RLHF：策略采样，奖励模型打分，参考模型给出 KL 惩罚要用的对数概率，价值模型给出优势，然后更新策略和价值模型'))
    box(s, 30, 140, 120, 64, '提示', 'prompts')
    box(s, 200, 140, 150, 64, '策略（训练中）', 'policy (trained)', C['accent'], stroke=C['accent'])
    box(s, 420, 40, 170, 60, '奖励模型（冻结）', 'reward model (frozen)', C['muted'])
    box(s, 420, 150, 170, 60, '参考模型（冻结）', 'reference (frozen)', C['muted'])
    box(s, 420, 260, 170, 60, '价值模型（训练中）', 'value model (trained)', C['accent'], stroke=C['accent'])
    box(s, 660, 140, 210, 64, '每个 token 的奖励与优势', 'per-token reward and advantage', C['ink'])
    s.line(150, 172, 196, 172, C['muted'], 2, arrow=True)
    s.text(385, 132, T('回答 y', 'answer y'), 13, C['muted'], 'middle')
    for yy in (70, 180, 290):
        s.line(350, 172, 416, yy, C['muted'], 1.8, arrow=True)
    s.line(590, 70, 690, 138, C['muted'], 1.8, arrow=True)
    s.text(640, 92, 'r_φ(x, y)', 13, C['ink'], 'middle', font=MATH)
    s.line(590, 180, 656, 172, C['muted'], 1.8, arrow=True)
    s.text(622, 165, '−β log π/π_ref', 12, C['ink'], 'middle', font=MATH)
    s.line(590, 290, 690, 206, C['muted'], 1.8, arrow=True)
    s.text(655, 262, 'V(s_t) → GAE', 12, C['ink'], 'middle')
    s.path([(765, 206), (765, 340), (275, 340), (275, 208)], C['accent'], 2, dash='6 4')
    s.text(520, 332, T('PPO 截断更新', 'PPO clipped update'), 13, C['accent'], 'middle')
    s.save('rlhf-ppo')

    s = Svg(760, 340, ('Schematic of over-optimization: proxy reward keeps rising with sqrt(KL) while gold reward rises then falls, shaped like d(a - b log d)',
                       '过度优化示意：代理奖励随 √KL 一直上升，真实奖励先升后降，形状像 d(a − b log d)'))
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
    s.text(X(peak), y0 + h + 20, T('最佳停点', 'best place to stop'), 12, C['good'], 'middle')
    s.text(x0 + w - 80, Y(proxy(5.7)) + 4, T('代理奖励', 'proxy reward'), 13, C['accent'], 'middle')
    s.text(x0 + w - 70, Y(gold(5.4)) + 22, T('真实奖励', 'gold reward'), 13, C['good'], 'middle')
    s.text(x0 + w, y0 + h + 20, '√KL', 14, C['ink'], 'end')
    s.text(x0 - 10, y0 - 10, T('奖励', 'reward'), 13, C['muted'])
    s.text(x0 + 10, y0 + 14, T('示意形状', 'schematic shape'), 12, C['muted'])
    s.save('overopt')

    s = Svg(860, 330, ('Memory for PPO on 8B models: policy 128 GB, value 128 GB, reference 16 GB, reward model 16 GB, 288 GB in total; and Hub model counts with the trl tag: PPO 894, DPO 10,532, GRPO 14,257',
                       '8B 模型做 PPO 的显存：策略 128 GB、价值模型 128 GB、参考模型 16 GB、奖励模型 16 GB，共 288 GB；Hub 上带 trl 标签的模型数：PPO 894、DPO 10,532、GRPO 14,257'))
    parts = [('策略', 'policy', 128, C['accent']), ('价值模型', 'value model', 128, C['purple']), ('参考模型', 'reference', 16, C['muted']), ('奖励模型', 'reward', 16, C['gold'])]
    x, y0, h = 60, 70, 40
    s.text(60, 50, T('8B 模型做 PPO 的显存（不含激活值）', 'PPO memory for 8B models (activations not included)'), 14)
    scale = 560 / 288
    for zh, en, gb, col in parts:
        ww = gb * scale
        s.rect(x, y0, ww, h, fill=col, stroke='#FFFFFF', sw=2, rx=0, opacity=0.85)
        if ww > 60:
            s.text(x + ww / 2, y0 + 25, f'{T(zh, en)} {gb} GB', 13, '#FFFFFF', 'middle')
        x += ww
    s.text(60 + 560 + 10, y0 + 25, '= 288 GB', 15, C['ink'], weight='bold')
    s.text(60, y0 + h + 22, T('参考模型 16 GB、奖励模型 16 GB（bf16，冻结）', 'reference 16 GB, reward model 16 GB (bf16, frozen)'), 12, C['muted'])
    s.text(60, 200, T('Hugging Face Hub 上带 trl 标签的模型数（2026-10）', 'Hugging Face Hub models tagged trl, by method (2026-10)'), 14)
    for i, (name, n, col) in enumerate([('PPO', 894, C['coral']), ('DPO', 10532, C['good']), ('GRPO', 14257, C['accent'])]):
        yy = 220 + i * 32
        ww = 520 * n / 14257
        s.rect(140, yy, ww, 22, fill=col, stroke=col, sw=0, rx=2, opacity=0.85)
        s.text(130, yy + 16, name, 13, C['ink'], 'end')
        s.text(140 + ww + 8, yy + 16, f'{n:,}', 13, C['ink'])
    s.save('memory')

    # ------------------------------------------------------------ D3
    s = Svg(900, 300, ('Two routes to the same optimum: RLHF trains a reward model then runs RL with sampling; DPO trains the policy directly on preference pairs',
                       '通往同一个最优解的两条路：RLHF 先训奖励模型、再做带采样的 RL；DPO 直接在偏好对上训练策略'))
    box(s, 20, 115, 150, 70, '偏好对', 'preference pairs')
    box(s, 240, 40, 170, 60, '奖励模型 r_φ', 'reward model r_φ', C['accent'])
    box(s, 480, 40, 190, 60, 'RL（采样循环，D2）', 'RL with sampling (D2)', C['accent'])
    box(s, 240, 200, 430, 60, 'DPO 损失：直接训练策略（D3）', 'DPO loss: train the policy directly (D3)', C['good'])
    box(s, 740, 115, 140, 70, '同一个最优解 π*', 'the same optimum π*', C['ink'])
    s.line(170, 140, 236, 75, C['muted'], 2, arrow=True)
    s.line(410, 70, 476, 70, C['muted'], 2, arrow=True)
    s.line(670, 70, 736, 135, C['muted'], 2, arrow=True)
    s.line(170, 160, 236, 228, C['muted'], 2, arrow=True)
    s.line(670, 230, 736, 168, C['muted'], 2, arrow=True)
    s.save('two-routes')

    s = Svg(760, 320, ('The DPO weight sigma(-u) against the margin u: near 1 for pairs ranked wrong, near 0 for pairs ranked right by a wide margin',
                       'DPO 的权重 σ(−u) 随间隔 u 变化：排错的对接近 1，已经大幅排对的对接近 0'))
    x0, y0, w, h = 80, 30, 600, 220
    s.line(x0, y0 + h, x0 + w, y0 + h, C['muted'])
    s.line(x0 + w / 2, y0, x0 + w / 2, y0 + h, C['faint'])
    s.path([(x0 + w * (u + 6) / 12, y0 + h - h * sig(-u)) for u in [x / 10 for x in range(-60, 61)]], C['coral'], 3)
    for v in (-6, -3, 0, 3, 6):
        s.text(x0 + w * (v + 6) / 12, y0 + h + 18, str(v), 12, C['muted'], 'middle')
    s.text(x0 + w, y0 + h + 38, 'u = r̂_w − r̂_l', 14, C['ink'], 'end')
    s.text(x0 - 8, y0 + 8, '1', 12, C['muted'], 'end')
    s.text(x0 - 8, y0 + h, '0', 12, C['muted'], 'end')
    s.text(x0 + 120, y0 + 50, T('排错了：全力学', 'ranked wrong: learn hard'), 13, C['coral'], 'middle')
    s.text(x0 + w - 120, y0 + h - 60, T('已排对：几乎不学', 'ranked right: barely learn'), 13, C['muted'], 'middle')
    s.text(x0 + w / 2 + 8, y0 + 14, 'σ(−u)', 15, C['coral'])
    s.save('dpo-weight')

    s = Svg(900, 230, ('Token-level cancellation: the chosen and rejected answers share a prefix whose gradients cancel; only the tokens after they diverge get gradient',
                       'token 级的抵消：被选和被拒回答共享的前缀梯度互相抵消；只有分叉之后的 token 有梯度'))
    if L == 'zh':
        toks_w = ['抱歉', '，', '我', '不能', '帮', '你', '做', '这件事', '，', '不过', '你可以', '试试', '……']
        toks_l = ['抱歉', '，', '我', '不能', '帮', '你', '做', '这件事', '。']
    else:
        toks_w = ['Sorry', ',', 'I', 'can’t', 'help', 'you', 'with', 'that', ',', 'but', 'you', 'could', 'try', '…']
        toks_l = ['Sorry', ',', 'I', 'can’t', 'help', 'you', 'with', 'that', '.']
    def row(toks, y, shared, col):
        x = 140
        for i, tk in enumerate(toks):
            wd = 16 + width(tk, 15)
            sh = i < shared
            s.rect(x, y, wd, 34, fill=C['faint'] if sh else col, stroke=C['faint'] if sh else col, sw=0, rx=4, opacity=1 if sh else 0.25)
            s.text(x + wd / 2, y + 23, tk, 15, C['muted'] if sh else C['ink'], 'middle')
            x += wd + 4
    row(toks_w, 50, 8, C['good'])
    row(toks_l, 120, 8, C['coral'])
    s.text(70, 72, T('被选 y_w', 'chosen y_w'), 14, C['good'], 'middle')
    s.text(70, 142, T('被拒 y_l', 'rejected y_l'), 14, C['coral'], 'middle')
    s.text(140, 190, T('灰色：共享前缀，梯度互相抵消', 'grey: shared prefix, gradients cancel'), 13, C['muted'])
    s.text(140, 212, T('着色：分叉之后，才有梯度', 'coloured: after the answers diverge, gradient flows'), 13, C['muted'])
    s.save('token-cancel')

    s = Svg(760, 320, ('Refusal rate on harmful prompts before and after DPO on refusal pairs: Llama-3-8B-Instruct 74.4% to 33.4%, Gemma-2B-IT 80.5% to 54.8%',
                       '在拒答偏好对上做 DPO 前后，有害提示上的拒答率：Llama-3-8B-Instruct 从 74.4% 降到 33.4%，Gemma-2B-IT 从 80.5% 降到 54.8%'))
    bar_chart(s, 90, 50, 600, 200, [('Llama-3-8B-Instruct', '', [74.4, 33.4]), ('Gemma-2B-IT', '', [80.5, 54.8])], [C['muted'], C['coral']], 100, '%', [0, 25, 50, 75, 100])
    legend(s, 560, 22, [(C['muted'], T('DPO 前', 'before DPO')), (C['coral'], T('DPO 后', 'after DPO'))])
    s.text(60, 30, T('有害提示上的拒答率', 'refusal rate on harmful prompts'), 13, C['muted'])
    s.save('refusal')

    s = Svg(900, 300, ('Where DPO sits in recipes: Llama 3 (SFT, DPO, six rounds), Tulu 3 (SFT, DPO, RLVR), Llama 4 (light SFT, online RL, light DPO), Olmo 3 (SFT, delta-learning DPO, RLVR)',
                       'DPO 在各家配方中的位置：Llama 3（SFT、DPO，六轮）、Tülu 3（SFT、DPO、RLVR）、Llama 4（轻量 SFT、在线 RL、轻量 DPO）、Olmo 3（SFT、差值学习 DPO、RLVR）'))
    rows = [('Llama 3 (2024)', [('SFT', C['muted']), ('DPO', C['good']), (T('× 6 轮', '× 6 rounds'), C['muted'])]),
            ('Tülu 3 (2024)', [('SFT', C['muted']), ('DPO', C['good']), ('RLVR', C['accent'])]),
            ('Llama 4 (2025)', [(T('轻量 SFT', 'light SFT'), C['muted']), (T('在线 RL', 'online RL'), C['accent']), (T('轻量 DPO', 'light DPO'), C['good'])]),
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
    s.save('recipes')

    # ------------------------------------------------------------ D4
    s = Svg(760, 330, ('Loss against the margin h: the DPO loss keeps falling as h grows; the IPO loss is a parabola with its minimum at h* = 1/(2 tau)',
                       '损失随间隔 h 的变化：DPO 损失随 h 增大一直下降；IPO 损失是一条抛物线，最低点在 h* = 1/(2τ)'))
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
    s.text(X(4.4), Y(0.35), T('DPO：一直往下，没有底', 'DPO: keeps falling, no floor'), 13, C['accent'], 'middle')
    s.text(X(3.05), Y(3.3), T('IPO：最低点 h* = 1/(2τ)，这里 τ = 0.5', 'IPO: lowest at h* = 1/(2τ), τ = 0.5'), 13, C['purple'])
    s.save('loss-curves')

    s = Svg(900, 330, ('Toy model, 400 steps on a similar pair: DPO sends the chosen probability to 0 and the harmful answer to 0.999; DPO plus NLL keeps the chosen at 0.92; IPO stops at a gap of 1 with the chosen at 0.22 and the harmful answer at 0.40',
                       '玩具模型在一对相似回答上训练 400 步：DPO 把被选回答的概率压到 0、有害回答升到 0.999；DPO + NLL 让被选回答保持在 0.92；IPO 停在差值 1，被选 0.22、有害回答 0.40'))
    names = [T('y_w 礼貌拒答', 'y_w polite refusal'), T('y_l 生硬拒答', 'y_l curt refusal'), T('y_3 照做', 'y_3 complies'),
             T('y_4 跑题', 'y_4 off-topic'), T('y_5 普通拒答', 'y_5 plain refusal')]
    cols = [C['good'], C['coral'], C['coral'], C['muted'], C['teal']]
    refs = [0.20, 0.30, 0.05, 0.15, 0.30]
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
    bar = 135
    for k, (title, probs) in enumerate(panels):
        x0 = 30 + k * 290
        s.text(x0 + 150, 34, title, 15, C['ink'], 'middle', weight='bold')
        for i, (nm, pr) in enumerate(zip(names, probs)):
            y = 60 + i * 50
            s.text(x0 + 118, y + 18, nm, 11, C['ink'], 'end')
            s.rect(x0 + 124, y + 4, bar * refs[i], 20, fill='none', stroke=C['muted'], sw=1.2, rx=2)
            if pr > 0.002:
                s.rect(x0 + 124, y + 8, bar * pr, 12, fill=cols[i], stroke=cols[i], sw=0, rx=2, opacity=0.85)
            s.text(x0 + 128 + bar * max(pr, refs[i]), y + 19, f'{pr:.2f}', 11, C['muted'])
    s.text(450, 318, T('实心：训练 400 步后的概率；空心：参考模型 π_ref（玩具模型，精确计算）',
                       'solid: probability after 400 steps; outline: the reference π_ref (toy model, exact)'), 12, C['muted'], 'middle')
    s.save('toy-variants')

    s = Svg(900, 310, ('A preference-data pipeline: prompts, candidate answers (on-policy samples, other models, strong vs weak), labels (people or a judge with swapped positions), filters (ties, near-duplicates, length balance, truncation), then pairs for DPO, with a loop back for iteration',
                       '一条偏好数据管线：提示、候选回答（在线采样、其他模型、强弱配对）、标注（人工或评委，交换位置）、过滤（平局、近似重复、长度、截断），然后得到给 DPO 的偏好对，另有一条迭代回路'))
    stages = [('提示', 'prompts', ['真实分布、去重'], ['real distribution,', 'deduplicated']),
              ('候选回答', 'candidates', ['在线采样、其他模型、', '强弱配对'], ['on-policy samples,', 'other models,', 'strong vs weak']),
              ('标注', 'labels', ['人工 / 评委，', '交换位置'], ['people or a judge,', 'order swapped']),
              ('过滤', 'filters', ['平局、近似重复、', '长度、截断'], ['ties, near-duplicates,', 'length, truncation']),
              ('偏好对 → DPO', 'pairs → DPO', [], [])]
    for i, (zh, en, sub_zh, sub_en) in enumerate(stages):
        x = 20 + i * 178
        box(s, x, 80, 150, 70, zh, en, C['good'] if i == 4 else C['ink'])
        for j, line in enumerate(sub_zh if L == 'zh' else sub_en):
            s.text(x + 75, 176 + j * 16, line, 12, C['muted'], 'middle')
        if i:
            s.line(x - 24, 115, x - 4, 115, C['muted'], 2, arrow=True)
    s.path([(805, 150), (805, 262), (273, 262), (273, 244)], C['accent'], 2, dash='6 4')
    s.line(273, 246, 273, 228, C['accent'], 2, arrow=True)
    s.text(540, 286, T('迭代：用新模型重新采样', 'iterate: sample again from the new model'), 13, C['accent'], 'middle')
    s.save('data-pipeline')

    s = Svg(760, 330, ('Olmo 3 delta learning, 7B development average: SFT checkpoint 70.3, continued SFT on the chosen answers 64.5, DPO on strong-vs-weak pairs 72.9',
                       'Olmo 3 的差值学习，7B 开发集平均分：SFT 起点 70.3，在被选回答上继续 SFT 64.5，用强弱配对做 DPO 72.9'))
    bar_chart(s, 100, 50, 560, 200, [('SFT 起点', 'SFT start', [70.3]), ('在被选回答上继续 SFT', 'more SFT on the chosen', [64.5]), ('强 vs 弱做 DPO', 'DPO on strong vs weak', [72.9])],
              [C['accent']], 80, '', [0, 20, 40, 60, 80])
    s.text(70, 30, T('7B 开发集平均分（Olmo 3，表 21）', '7B development average (Olmo 3, Table 21)'), 13, C['muted'])
    s.save('delta')

    s = Svg(900, 280, ('Offline DPO uses one fixed dataset once; iterative DPO samples from the current model, labels, trains, and makes the result the next reference',
                       '离线 DPO 用一份固定数据训一轮；迭代 DPO 从当前模型采样、打分、训练，再把结果当作下一轮的参考模型'))
    s.text(200, 36, T('离线', 'offline'), 15, C['ink'], 'middle', weight='bold')
    box(s, 40, 70, 130, 60, '固定数据', 'fixed pairs')
    box(s, 230, 70, 130, 60, 'DPO 一轮', 'DPO once', C['good'])
    s.line(170, 100, 226, 100, C['muted'], 2, arrow=True)
    s.text(640, 36, T('迭代 / 在线', 'iterative / online'), 15, C['ink'], 'middle', weight='bold')
    cx, cy, r = 640, 160, 90
    labs = [('当前模型采样', 'sample from current'), ('评委 / 奖励模型打分', 'judge or RM labels'), ('以当前模型为参考做 DPO', 'DPO, ref = current'), ('新模型', 'new model')]
    for i, (zh, en) in enumerate(labs):
        a = -math.pi / 2 + i * math.pi / 2
        x, y = cx + 1.6 * r * math.cos(a), cy + r * math.sin(a) * 0.95
        box(s, x - 95, y - 26, 190, 52, zh, en, C['good'] if i == 2 else C['ink'], size=13)
    s.add(f'<circle cx="{cx}" cy="{cy}" r="34" fill="none" stroke="{C["accent"]}" stroke-width="2" stroke-dasharray="6 4"/>')
    s.text(cx, cy + 5, T('循环', 'loop'), 12, C['accent'], 'middle')
    s.save('iterate')

    s = Svg(760, 280, ('Hub model counts by tag (2026-10): dpo 13,519, orpo 1,279, kto 428',
                       'Hub 上按标签统计的模型数（2026-10）：dpo 13,519、orpo 1,279、kto 428'))
    for i, (name, n, col) in enumerate([('dpo', 13519, C['good']), ('orpo', 1279, C['purple']), ('kto', 428, C['teal'])]):
        y = 60 + i * 50
        ww = 520 * n / 13519
        s.rect(140, y, ww, 30, fill=col, stroke=col, sw=0, rx=3, opacity=0.85)
        s.text(130, y + 21, name, 14, C['ink'], 'end')
        s.text(140 + ww + 8, y + 21, f'{n:,}', 14, C['ink'])
    s.text(60, 34, T('Hugging Face Hub 上按标签统计的模型数（2026-10）', 'Hugging Face Hub models by tag (2026-10)'), 13, C['muted'])
    s.save('usage')


os.makedirs(OUT, exist_ok=True)
for lang in ('en', 'zh'):
    L = lang
    build()
print('wrote', sorted(os.listdir(OUT)))
