"""Static figures for parts A and F of the fine-tuning course, as SVG in both
languages: apps/mathnim/public/ft/<part>/<name>.<lang>.svg.

Numbers come from the course's research files (each figure names its source in
its footer); the PCA scatter comes from the real retrieval run
(public/ft/a/data/retrieval.json, written by chunk_recall.py in this folder).
"""
import html, json, math, pathlib, re

HERE = pathlib.Path(__file__).parent
ROOT = HERE.parents[4]
PUB = ROOT / 'apps' / 'mathnim' / 'public' / 'ft'
C = {'ink': '#111113', 'muted': '#86868B', 'faint': '#E6E6EA', 'accent': '#2563EB', 'gold': '#B8860B', 'coral': '#E4572E', 'good': '#1F8A5B', 'purple': '#7C3AED', 'teal': '#0D9488', 'bg': '#FFFFFF'}
FONT = "-apple-system, 'PingFang SC', 'Noto Sans SC', 'Helvetica Neue', Arial, sans-serif"


def esc(s):
    return html.escape(str(s))


MIN_FONT = 15  # at a 700 px rendered width a 720-wide figure keeps this at >= 14.5 px


def T(x, y, s, size=16, color=C['ink'], anchor='start', weight=400):
    size = max(MIN_FONT, size)
    return f'<text x="{x:.1f}" y="{y:.1f}" font-size="{size}" fill="{color}" text-anchor="{anchor}" font-weight="{weight}">{esc(s)}</text>'


def text_w(s, size):
    """Rough rendered width: CJK about 1 em, Latin about 0.55 em."""
    return sum(size if ord(ch) > 0x2e80 else 0.55 * size for ch in str(s))


def wrap(s, size, width):
    """Split s into lines no wider than width (at spaces for Latin, anywhere for CJK)."""
    out, cur = [], ''
    tokens = re.findall(r'[\u2e80-\uffff]|\S+\s*|\s+', str(s))
    for t in tokens:
        if cur and text_w(cur + t, size) > width:
            out.append(cur.rstrip())
            cur = t.lstrip()
        else:
            cur += t
    if cur.strip():
        out.append(cur.rstrip())
    return out


def para(x, y, s, size, color, width, lh=None):
    """A wrapped paragraph; returns (svg parts, y after it)."""
    lh = lh or round(max(MIN_FONT, size) * 1.35)
    parts = []
    for line in wrap(s, max(MIN_FONT, size), width):
        parts.append(T(x, y, line, size, color))
        y += lh
    return parts, y


def R(x, y, w, h, fill, rx=4, stroke='none', sw=0, op=1):
    return f'<rect x="{x:.1f}" y="{y:.1f}" width="{max(0, w):.1f}" height="{max(0, h):.1f}" rx="{rx}" fill="{fill}" fill-opacity="{op}" stroke="{stroke}" stroke-width="{sw}"/>'


def svg(w, h, parts):
    return f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {w} {h}" width="{w}" height="{h}" font-family="{FONT}"><rect width="{w}" height="{h}" fill="{C["bg"]}"/>' + ''.join(parts) + '</svg>\n'


def write(part, name, lang, content):
    p = PUB / part / f'{name}.{lang}.svg'
    p.parent.mkdir(parents=True, exist_ok=True)
    p.write_text(content, encoding='utf-8')
    print('wrote', p.relative_to(ROOT))


W = 720


def hbars(title, rows, foot, unit='%', vmax=100, color=C['accent'], label_w=230, fmt='{:g}', note_w=0):
    """Horizontal bars: rows = [(label, value, colour or None, note)]."""
    parts, y = para(20, 32, title, 19, C['ink'], W - 40)
    parts = [x.replace('font-weight="400"', 'font-weight="600"') for x in parts]
    top, rh = y + 6, 40
    x0, x1 = label_w, W - 110 - note_w
    for i, (lab, v, col, note) in enumerate(rows):
        yy = top + i * rh
        parts.append(T(x0 - 10, yy + 22, lab, 15, anchor='end'))
        parts.append(R(x0, yy + 8, x1 - x0, 20, C['faint'], 3))
        parts.append(R(x0, yy + 8, (x1 - x0) * v / vmax, 20, col or color, 3))
        parts.append(T(x0 + (x1 - x0) * v / vmax + 8, yy + 23, fmt.format(v) + unit + (f'  {note}' if note else ''), 15))
    fp, yend = para(20, top + rh * len(rows) + 22, foot, 15, C['muted'], W - 40)
    return svg(W, int(yend), parts + fp)


def box(x, y, w, h, text, stroke=C['muted'], fill=C['bg'], color=C['ink'], size=16):
    return R(x, y, w, h, fill, 10, stroke, 2) + T(x + w / 2, y + h / 2 + 6, text, size, color, 'middle', 600)


def arrow(x0, y0, x1, y1, color=C['muted'], dash=False):
    d = ' stroke-dasharray="6 5"' if dash else ''
    ang = math.atan2(y1 - y0, x1 - x0)
    ax, ay = x1 - 10 * math.cos(ang - 0.4), y1 - 10 * math.sin(ang - 0.4)
    bx, by = x1 - 10 * math.cos(ang + 0.4), y1 - 10 * math.sin(ang + 0.4)
    return f'<line x1="{x0}" y1="{y0}" x2="{x1}" y2="{y1}" stroke="{color}" stroke-width="2"{d}/><polygon points="{x1},{y1} {ax:.1f},{ay:.1f} {bx:.1f},{by:.1f}" fill="{color}"/>'


# ------------------------------------------------------------------ A1
def fig_survey():
    rows = {
        'en': [('prompting', 80), ('"tool-use tuning" *', 59), ('RAG', 49), ('fine-tuning', 26), ('reinforcement learning', 22), ('synthetic data', 19)],
        'zh': [('提示词', 80), ('"工具使用调优" *', 59), ('RAG', 49), ('微调', 26), ('强化学习', 22), ('合成数据', 19)],
    }
    title = {'en': 'What teams use to adapt model behaviour (2026 survey, n = 1,053)', 'zh': '团队用什么方法调整模型行为（2026 年调查，n = 1,053）'}
    foot = {'en': 'Self-reported; a team can tick several. * Ambiguous: may not mean training weights. Source: Notion × Amplify × Vercel AI engineering survey 2026.',
            'zh': '自报数据，一个团队可多选。* 含义模糊，不一定指改权重。来源：Notion × Amplify × Vercel 2026 年 AI 工程调查。'}
    for lang in ['en', 'zh']:
        rs = [(l, v, C['coral'] if i == 3 else None, '') for i, (l, v) in enumerate(rows[lang])]
        write('a', 'survey-methods', lang, hbars(title[lang], rs, foot[lang], label_w=210))


def fig_levers():
    L = {
        'en': dict(title='Two places to change what a model does', ctx='Context', ctx_sub='rebuilt for every request', ctx_items=['system prompt, examples', 'retrieved documents (RAG)', 'tool definitions, output format'],
                   ctx_note='this request only; takes effect now; easy to undo', w='Weights', w_sub='changed by training', w_items=['SFT (demonstrations)', 'preference optimization', 'RL / RLVR (rewards)', 'distillation (a teacher)'],
                   w_note='every later request, including ones you never tested', model='model', req='a request', other='another request'),
        'zh': dict(title='改变模型行为的两个地方', ctx='上下文', ctx_sub='每次请求重新拼装', ctx_items=['系统提示词、示例', '检索到的文档（RAG）', '工具定义、输出格式'],
                   ctx_note='只影响这一次；立刻生效；随时可撤回', w='权重', w_sub='靠训练改动', w_items=['SFT（示范）', '偏好优化（比较）', '强化学习 / RLVR（奖励）', '蒸馏（老师）'],
                   w_note='影响此后所有请求，包括你没测过的那些', model='模型', req='一次请求', other='另一次请求'),
    }
    for lang, t in L.items():
        p = [T(20, 32, t['title'], 20, weight=600)]
        for x0, col, head, sub, items, note in [(20, C['accent'], t['ctx'], t['ctx_sub'], t['ctx_items'], t['ctx_note']), (370, C['coral'], t['w'], t['w_sub'], t['w_items'], t['w_note'])]:
            p.append(R(x0, 52, 330, 250, col, 12, col, 2, 0.06))
            p.append(T(x0 + 16, 82, head, 19, col, weight=600))
            p.append(T(x0 + 16, 106, sub, 16, C['muted']))
            for i, it in enumerate(items):
                p.append(T(x0 + 22, 140 + i * 28, '• ' + it, 16))
            np_, _ = para(x0 + 16, 262, note, 15, C['muted'], 300)
            p += np_
        p.append(box(30, 330, 160, 50, t['req']))
        p.append(arrow(190, 355, 280, 355, C['accent']))
        p.append(box(280, 330, 160, 50, t['model']))
        p.append(arrow(440, 355, 530, 355, C['coral'], dash=True))
        p.append(box(530, 330, 170, 50, t['other'], stroke=C['coral']))
        write('a', 'two-levers', lang, svg(W, 400, p))


def fig_signals():
    L = {
        'en': dict(title='The signal you have decides the method', head=('your situation', 'signal', 'method'), rows=[
            ('The model lacks facts', 'documents', 'context: prompt, RAG'), ('The output is one of a few labels', 'labels', 'encoder classifier'),
            ('You can write good examples', 'demonstrations', 'SFT (usually LoRA)'), ('You can only say which of two is better', 'comparisons', 'preference optimization'),
            ('A program can check the answer', 'verifier', 'RLVR, managed RFT'), ('A stronger model already does it', 'teacher', 'distillation')]),
        'zh': dict(title='手里有什么信号，就用什么方法', head=('你的情况', '信号', '方法'), rows=[
            ('模型缺的是事实', '文档', '上下文：提示词、RAG'), ('输出只是几个固定标签之一', '标签', '编码器分类模型'), ('能写出好的示范', '示范', 'SFT（通常用 LoRA）'),
            ('只能判断两个回答哪个更好', '比较', '偏好优化（DPO）'), ('程序能判对错', '验证器', 'RLVR、托管强化微调'), ('已有更强的模型能做好', '老师', '蒸馏')]),
    }
    for lang, t in L.items():
        p = [T(20, 32, t['title'], 20, weight=600)]
        xs, ws = [20, 330, 480], [300, 140, 230]
        for x, hd in zip(xs, t['head']):
            p.append(T(x, 68, hd, 15, C['muted'], weight=600))
        y = 80
        for i, (a, b, c) in enumerate(t['rows']):
            la = wrap(a, 16, ws[0]); lc = wrap(c, 16, ws[2])
            h = 14 + 22 * max(len(la), len(lc))
            p.append(R(12, y, W - 24, h, C['faint'] if i % 2 == 0 else C['bg'], 6, op=0.6))
            for k, line in enumerate(la):
                p.append(T(xs[0], y + 26 + 22 * k, line, 16))
            p.append(T(xs[1], y + 26, b, 16, C['gold'], weight=600))
            for k, line in enumerate(lc):
                p.append(T(xs[2], y + 26 + 22 * k, line, 16, C['accent'], weight=600))
            y += h + 4
        write('a', 'signal-method', lang, svg(W, int(y + 12), p))


def fig_distill():
    title = {'en': 'Small models: distilling a strong teacher beat RL on the small model', 'zh': '小模型：蒸馏强老师，胜过直接在小模型上做强化学习'}
    rows = {
        'en': [('Qwen-32B, RL directly', 47.0, C['muted'], ''), ('Qwen-32B, distilled from R1', 72.6, C['good'], ''),
               ('RL (Thinking Machines)', 67.6, C['muted'], ''), ('on-policy distillation', 74.4, C['good'], '')],
        'zh': [('Qwen-32B 直接强化学习', 47.0, C['muted'], ''), ('Qwen-32B 蒸馏 R1', 72.6, C['good'], ''),
               ('强化学习（Thinking Machines）', 67.6, C['muted'], ''), ('在线蒸馏', 74.4, C['good'], '')],
    }
    foot = {'en': 'AIME 2024, pass@1. Top pair: DeepSeek-R1 (arXiv:2501.12948). Bottom pair: Thinking Machines, "On-policy distillation" (2025); the distillation used about 1/10 of the GPU hours. Separate experiments.',
            'zh': 'AIME 2024，pass@1。上面两行：DeepSeek-R1（arXiv:2501.12948）；下面两行：Thinking Machines《On-policy distillation》（2025），蒸馏约用了 1/10 的 GPU 时。两组实验相互独立。'}
    for lang in ['en', 'zh']:
        write('a', 'distill-vs-rl', lang, hbars(title[lang], rows[lang], foot[lang], unit='', vmax=100, label_w=260, fmt='{:.1f}'))


# ------------------------------------------------------------------ A2
def fig_contextual():
    title = {'en': 'Top-20 retrieval failure rate (lower is better)', 'zh': '前 20 块的检索失败率（越低越好）'}
    rows = {
        'en': [('embeddings only', 5.7), ('+ contextual embeddings', 3.7), ('+ contextual BM25', 2.9), ('+ reranking', 1.9)],
        'zh': [('只用向量', 5.7), ('+ 上下文化向量', 3.7), ('+ 上下文化 BM25', 2.9), ('+ 重排', 1.9)],
    }
    foot = {'en': 'Source: Anthropic, "Introducing Contextual Retrieval" (2024-09-19); the reranker keeps 20 of 150 candidates.',
            'zh': '来源：Anthropic《Introducing Contextual Retrieval》（2024-09-19）；重排时从 150 个候选里留 20 个。'}
    for lang in ['en', 'zh']:
        rs = [(l, v, C['accent'] if i else C['muted'], '') for i, (l, v) in enumerate(rows[lang])]
        write('a', 'contextual-retrieval', lang, hbars(title[lang], rs, foot[lang], vmax=6.5, label_w=230, fmt='{:.1f}'))


def fig_encoders():
    L = {
        'en': dict(title='Bi-encoder (retrieve) vs cross-encoder (rerank)', bi='Bi-encoder', cross='Cross-encoder', q='question', d='chunk', enc='encoder', vec='vector', cos='cosine',
                   bi_note='Chunk vectors are computed once, at indexing; a question needs one encoder pass and a fast search. Fast, but misses fine word-level matches.',
                   cross_note='Reads question and chunk together: one full pass per pair. More accurate, far too slow for a whole corpus.', score='score'),
        'zh': dict(title='双编码器（检索）与交叉编码器（重排）', bi='双编码器', cross='交叉编码器', q='问题', d='文本块', enc='编码器', vec='向量', cos='余弦',
                   bi_note='文本块的向量在索引期一次算好；每个问题编码一次，再快速检索。快，但抓不住细致的词级匹配。',
                   cross_note='把问题和文本块放在一起读，每一对都要完整跑一遍。更准，但对整份语料太慢。', score='相关度'),
    }
    for lang, t in L.items():
        p = [T(20, 32, t['title'], 20, weight=600)]
        p.append(T(24, 70, t['bi'], 18, C['accent'], weight=600))
        p += [box(24, 86, 130, 44, t['q']), box(194, 86, 130, 44, t['d']), box(24, 156, 130, 44, t['enc'], stroke=C['accent']), box(194, 156, 130, 44, t['enc'], stroke=C['accent'])]
        p += [arrow(89, 130, 89, 156), arrow(259, 130, 259, 156), box(24, 226, 130, 40, t['vec']), box(194, 226, 130, 40, t['vec']), arrow(89, 200, 89, 226), arrow(259, 200, 259, 226)]
        p += [box(109, 292, 130, 40, t['cos'], stroke=C['gold']), arrow(89, 266, 150, 292), arrow(259, 266, 200, 292)]
        bp, y1 = para(24, 362, t['bi_note'], 15, C['muted'], 320)
        X = 384
        p.append(T(X, 70, t['cross'], 18, C['coral'], weight=600))
        p += [box(X, 86, 312, 44, f"{t['q']} + {t['d']}"), box(X + 86, 156, 140, 44, t['enc'], stroke=C['coral']), arrow(X + 156, 130, X + 156, 156)]
        p += [box(X + 86, 226, 140, 40, t['score'], stroke=C['gold']), arrow(X + 156, 200, X + 156, 226)]
        cp, y2 = para(X, 362, t['cross_note'], 15, C['muted'], 312)
        p += bp + cp
        p.append(T(20, max(y1, y2) + 14, 'Sentence-BERT (arXiv:1908.10084); monoBERT (arXiv:1901.04085)', 15, C['muted']))
        write('a', 'bi-cross-encoder', lang, svg(W, int(max(y1, y2) + 30), p))


def fig_lost_middle():
    L = {
        'en': dict(title='Where the relevant passage sits in a long context matters', x='position of the relevant passage', y='accuracy',
                   first='first', last='last', note='Illustration of the shape only: accuracy is highest at the start and the end, lowest in the middle.', src='Shape after Liu et al., "Lost in the Middle", TACL (arXiv:2307.03172); not their numbers.'),
        'zh': dict(title='相关段落放在长上下文的什么位置，会影响答对率', x='相关段落在检索结果中的位置', y='答对率',
                   first='最前', last='最后', note='只示意形状：放在开头和结尾时答对率最高，放在中间最低。', src='形状依据 Liu et al.《Lost in the Middle》（TACL，arXiv:2307.03172），不是论文里的数字。'),
    }
    for lang, t in L.items():
        p = [T(20, 32, t['title'], 19, weight=600)]
        x0, x1, y0, y1 = 100, 690, 270, 70
        p.append(f'<line x1="{x0}" y1="{y0}" x2="{x1}" y2="{y0}" stroke="{C["muted"]}" stroke-width="2"/><line x1="{x0}" y1="{y0}" x2="{x0}" y2="{y1}" stroke="{C["muted"]}" stroke-width="2"/>')
        pts = []
        for i in range(41):
            u = i / 40
            v = 0.55 + 0.35 * (2 * u - 1) ** 2 - 0.05 * u
            pts.append(f'{x0 + 20 + u * (x1 - x0 - 40):.1f},{y0 - v * (y0 - y1):.1f}')
        p.append(f'<polyline points="{" ".join(pts)}" fill="none" stroke="{C["accent"]}" stroke-width="4" stroke-dasharray="10 6"/>')
        p += [T(x0 + 20, y0 + 24, t['first'], 15, C['muted'], 'middle'), T(x1 - 20, y0 + 24, t['last'], 15, C['muted'], 'middle')]
        p += [T((x0 + x1) / 2, y0 + 50, t['x'], 16, anchor='middle'), T(x0 - 12, (y0 + y1) / 2, t['y'], 16, anchor='end')]
        np_, y = para(20, 352, t['note'], 16, C['ink'], W - 40)
        sp, y = para(20, y + 4, t['src'], 15, C['muted'], W - 40)
        write('a', 'lost-in-the-middle', lang, svg(W, int(y + 4), p + np_ + sp))


# ------------------------------------------------------------------ F
def fig_hub():
    title = {'en': 'Models on the Hugging Face Hub, by the training tag they carry (Oct 2026)', 'zh': 'Hugging Face Hub 上按训练标签统计的模型数（2026 年 10 月）'}
    rows = {
        'en': [('SFT (trl + sft)', 78127), ('text classification', 43372), ('GRPO (trl + grpo)', 14257), ('DPO (trl + dpo)', 10532)],
        'zh': [('SFT（trl + sft）', 78127), ('文本分类', 43372), ('GRPO（trl + grpo）', 14257), ('DPO（trl + dpo）', 10532)],
    }
    foot = {'en': 'Counts of models carrying the tag the training tool adds; they undercount and lean towards hobbyist uploads. "Text classification": models trained with the Trainer. Source: research-adoption.md.',
            'zh': '统计的是带有训练工具自动添加的标签的模型；会少计，也偏向个人上传。"文本分类"指用 Trainer 训练的分类模型。来源：research-adoption.md。'}
    for lang in ['en', 'zh']:
        rs = [(l, v, None, '') for l, v in rows[lang]]
        write('f', 'hub-methods', lang, hbars(title[lang], rs, foot[lang], unit='', vmax=85000, label_w=210, fmt='{:,.0f}'))


if __name__ == '__main__':
    for f in [fig_survey, fig_levers, fig_signals, fig_distill, fig_contextual, fig_encoders, fig_lost_middle, fig_hub]:
        f()
