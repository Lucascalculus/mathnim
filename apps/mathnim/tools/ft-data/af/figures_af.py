"""Static figures for parts A and F of the fine-tuning course, as SVG in both
languages: apps/mathnim/public/ft/<part>/<name>.<lang>.svg.

Numbers come from the course's research files (each figure names its source in
its footer); the PCA scatter comes from the real retrieval run
(public/ft/a/data/retrieval.json, written by chunk_recall.py in this folder).
"""
import html, json, math, pathlib

HERE = pathlib.Path(__file__).parent
ROOT = HERE.parents[4]
PUB = ROOT / 'apps' / 'mathnim' / 'public' / 'ft'
C = {'ink': '#111113', 'muted': '#86868B', 'faint': '#E6E6EA', 'accent': '#2563EB', 'gold': '#B8860B', 'coral': '#E4572E', 'good': '#1F8A5B', 'purple': '#7C3AED', 'teal': '#0D9488', 'bg': '#FFFFFF'}
FONT = "-apple-system, 'PingFang SC', 'Noto Sans SC', 'Helvetica Neue', Arial, sans-serif"


def esc(s):
    return html.escape(str(s))


def T(x, y, s, size=16, color=C['ink'], anchor='start', weight=400):
    return f'<text x="{x:.1f}" y="{y:.1f}" font-size="{size}" fill="{color}" text-anchor="{anchor}" font-weight="{weight}">{esc(s)}</text>'


def R(x, y, w, h, fill, rx=4, stroke='none', sw=0, op=1):
    return f'<rect x="{x:.1f}" y="{y:.1f}" width="{max(0, w):.1f}" height="{max(0, h):.1f}" rx="{rx}" fill="{fill}" fill-opacity="{op}" stroke="{stroke}" stroke-width="{sw}"/>'


def svg(w, h, parts):
    return f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {w} {h}" width="{w}" height="{h}" font-family="{FONT}"><rect width="{w}" height="{h}" fill="{C["bg"]}"/>' + ''.join(parts) + '</svg>\n'


def write(part, name, lang, content):
    p = PUB / part / f'{name}.{lang}.svg'
    p.parent.mkdir(parents=True, exist_ok=True)
    p.write_text(content, encoding='utf-8')
    print('wrote', p.relative_to(ROOT))


def hbars(title, rows, foot, unit='%', vmax=100, color=C['accent'], w=860, label_w=290, fmt='{:g}'):
    """Horizontal bars: rows = [(label, value, colour or None, note)]."""
    top, rh = 64, 40
    h = top + rh * len(rows) + 64
    parts = [T(24, 36, title, 20, weight=600)]
    x0, x1 = label_w, w - 120
    for i, (lab, v, col, note) in enumerate(rows):
        y = top + i * rh
        parts.append(T(x0 - 12, y + 22, lab, 15, anchor='end'))
        parts.append(R(x0, y + 8, x1 - x0, 20, C['faint'], 3))
        parts.append(R(x0, y + 8, (x1 - x0) * v / vmax, 20, col or color, 3))
        parts.append(T(x0 + (x1 - x0) * v / vmax + 8, y + 23, fmt.format(v) + unit + (f'  {note}' if note else ''), 14))
    parts.append(T(24, h - 22, foot, 12, C['muted']))
    return svg(w, h, parts)


def box(x, y, w, h, text, sub=None, stroke=C['muted'], fill=C['bg'], color=C['ink'], size=16):
    parts = [R(x, y, w, h, fill, 10, stroke, 2)]
    parts.append(T(x + w / 2, y + (h / 2 + 6 if not sub else h / 2 - 4), text, size, color, 'middle', 600))
    if sub:
        parts.append(T(x + w / 2, y + h / 2 + 18, sub, 13, C['muted'], 'middle'))
    return ''.join(parts)


def arrow(x0, y0, x1, y1, color=C['muted'], dash=False):
    d = ' stroke-dasharray="6 5"' if dash else ''
    ang = math.atan2(y1 - y0, x1 - x0)
    ax, ay = x1 - 10 * math.cos(ang - 0.4), y1 - 10 * math.sin(ang - 0.4)
    bx, by = x1 - 10 * math.cos(ang + 0.4), y1 - 10 * math.sin(ang + 0.4)
    return f'<line x1="{x0}" y1="{y0}" x2="{x1}" y2="{y1}" stroke="{color}" stroke-width="2"{d}/><polygon points="{x1},{y1} {ax:.1f},{ay:.1f} {bx:.1f},{by:.1f}" fill="{color}"/>'


# ------------------------------------------------------------------ A1
def fig_survey():
    rows = {
        'en': [('prompting', 80), ('"tool-use tuning" (ambiguous)', 59), ('RAG', 49), ('fine-tuning', 26), ('reinforcement learning', 22), ('synthetic data', 19)],
        'zh': [('提示词', 80), ('"工具使用调优"（含义模糊）', 59), ('RAG', 49), ('微调', 26), ('强化学习', 22), ('合成数据', 19)],
    }
    title = {'en': 'What teams use to adapt model behaviour (2026 survey, n = 1,053)', 'zh': '团队用什么方法调整模型行为（2026 年调查，n = 1,053）'}
    foot = {'en': 'Self-reported; a team can tick several. Source: Notion × Amplify × Vercel AI engineering survey 2026 (research-adoption.md).',
            'zh': '自报数据，一个团队可多选。来源：Notion × Amplify × Vercel 2026 年 AI 工程调查（见 research-adoption.md）。'}
    for lang in ['en', 'zh']:
        rs = [(l, v, C['coral'] if i == 3 else None, '') for i, (l, v) in enumerate(rows[lang])]
        write('a', 'survey-methods', lang, hbars(title[lang], rs, foot[lang]))


def fig_levers():
    L = {
        'en': dict(title='Two places to change what a model does', ctx='Context: rebuilt for every request', ctx_items=['system prompt, examples', 'retrieved documents (RAG)', 'tool definitions, output format'],
                   ctx_note='this request only · takes effect now · easy to undo', w='Weights: changed by training', w_items=['SFT (demonstrations)', 'preference optimization (comparisons)', 'RL / RLVR (rewards)', 'distillation (a teacher)'],
                   w_note='every later request, including ones you never tested', model='model', req='a request', other='an unrelated request'),
        'zh': dict(title='改变模型行为的两个地方', ctx='上下文：每次请求重新拼装', ctx_items=['系统提示词、示例', '检索到的文档（RAG）', '工具定义、输出格式'],
                   ctx_note='只影响这一次请求 · 立刻生效 · 随时可撤回', w='权重：靠训练改动', w_items=['SFT（示范）', '偏好优化（比较）', '强化学习 / RLVR（奖励）', '蒸馏（老师）'],
                   w_note='影响此后所有请求，包括你没测过的那些', model='模型', req='一次请求', other='一个无关的请求'),
    }
    for lang, t in L.items():
        p = [T(24, 36, t['title'], 20, weight=600)]
        p.append(R(24, 60, 390, 230, C['accent'], 12, C['accent'], 2, 0.06))
        p.append(T(44, 90, t['ctx'], 17, C['accent'], weight=600))
        for i, s in enumerate(t['ctx_items']):
            p.append(T(54, 124 + i * 30, '• ' + s, 15))
        p.append(T(44, 268, t['ctx_note'], 13, C['muted']))
        p.append(R(446, 60, 390, 230, C['coral'], 12, C['coral'], 2, 0.06))
        p.append(T(466, 90, t['w'], 17, C['coral'], weight=600))
        for i, s in enumerate(t['w_items']):
            p.append(T(476, 124 + i * 30, '• ' + s, 15))
        p.append(T(466, 268, t['w_note'], 13, C['muted']))
        p.append(box(60, 320, 180, 56, t['req']))
        p.append(arrow(240, 348, 330, 348, C['accent']))
        p.append(box(330, 320, 200, 56, t['model']))
        p.append(arrow(530, 348, 620, 348, C['coral'], dash=True))
        p.append(box(620, 320, 200, 56, t['other'], stroke=C['coral']))
        write('a', 'two-levers', lang, svg(860, 400, p))


def fig_signals():
    L = {
        'en': dict(title='The signal you have decides the method', head=('your situation', 'signal', 'method'), rows=[
            ('The model lacks facts', 'documents', 'context: prompt / RAG'), ('The output is one of a few fixed labels', 'labels', 'encoder classifier'),
            ('You can write good examples', 'demonstrations', 'SFT (usually LoRA)'), ('You can only say which of two is better', 'comparisons', 'preference optimization (DPO)'),
            ('A program can check the answer', 'verifier / grader', 'RLVR, managed RFT'), ('A stronger model already does it', 'teacher', 'distillation')]),
        'zh': dict(title='手里有什么信号，就用什么方法', head=('你的情况', '信号', '方法'), rows=[
            ('模型缺的是事实', '文档', '上下文：提示词 / RAG'), ('输出只是几个固定标签之一', '标签', '编码器分类模型'), ('能写出好的示范', '示范', 'SFT（通常用 LoRA）'),
            ('只能判断两个回答哪个更好', '比较', '偏好优化（DPO）'), ('程序能判对错', '验证器 / 评分器', 'RLVR、托管强化微调'), ('已有更强的模型能做好', '老师', '蒸馏')]),
    }
    for lang, t in L.items():
        p = [T(24, 36, t['title'], 20, weight=600)]
        xs = [24, 400, 580]
        for x, hd in zip(xs, t['head']):
            p.append(T(x, 72, hd, 14, C['muted'], weight=600))
        for i, (a, b, c) in enumerate(t['rows']):
            y = 86 + i * 44
            p.append(R(16, y, 828, 38, C['faint'] if i % 2 == 0 else C['bg'], 6, op=0.6))
            p.append(T(xs[0], y + 25, a, 15))
            p.append(T(xs[1], y + 25, b, 15, C['gold'], weight=600))
            p.append(T(xs[2], y + 25, c, 15, C['accent'], weight=600))
        write('a', 'signal-method', lang, svg(860, 86 + 44 * len(t['rows']) + 20, p))


def fig_distill():
    title = {'en': 'Small models: distilling a strong teacher beat RL on the small model', 'zh': '小模型：蒸馏强老师，胜过直接在小模型上做强化学习'}
    rows = {
        'en': [('Qwen-32B, RL directly', 47.0, C['muted'], ''), ('Qwen-32B, distilled from R1', 72.6, C['good'], ''),
               ('RL (Thinking Machines run)', 67.6, C['muted'], ''), ('on-policy distillation', 74.4, C['good'], '≈ 1/10 of the GPU hours')],
        'zh': [('Qwen-32B 直接强化学习', 47.0, C['muted'], ''), ('Qwen-32B 蒸馏 R1', 72.6, C['good'], ''),
               ('强化学习（Thinking Machines）', 67.6, C['muted'], ''), ('在线蒸馏', 74.4, C['good'], '约 1/10 的 GPU 时')],
    }
    foot = {'en': 'AIME (2024) pass@1. Top pair: DeepSeek-R1 (arXiv:2501.12948). Bottom pair: Thinking Machines, "On-policy distillation" (2025). Separate experiments.',
            'zh': 'AIME（2024）pass@1。上面两行：DeepSeek-R1（arXiv:2501.12948）；下面两行：Thinking Machines《On-policy distillation》（2025）。两组实验相互独立。'}
    for lang in ['en', 'zh']:
        write('a', 'distill-vs-rl', lang, hbars(title[lang], rows[lang], foot[lang], unit='', vmax=100, label_w=300, fmt='{:.1f}'))


# ------------------------------------------------------------------ A2
def fig_contextual():
    title = {'en': 'Top-20 retrieval failure rate (lower is better)', 'zh': '前 20 块的检索失败率（越低越好）'}
    rows = {
        'en': [('embeddings only', 5.7), ('+ contextual embeddings', 3.7), ('+ contextual BM25 (hybrid)', 2.9), ('+ reranking', 1.9)],
        'zh': [('只用向量', 5.7), ('+ 上下文化向量', 3.7), ('+ 上下文化 BM25（混合）', 2.9), ('+ 重排', 1.9)],
    }
    foot = {'en': 'Source: Anthropic, "Introducing Contextual Retrieval" (2024-09-19); the reranker keeps 20 of 150 candidates.',
            'zh': '来源：Anthropic《Introducing Contextual Retrieval》（2024-09-19）；重排时从 150 个候选里留 20 个。'}
    for lang in ['en', 'zh']:
        rs = [(l, v, C['accent'] if i else C['muted'], '') for i, (l, v) in enumerate(rows[lang])]
        write('a', 'contextual-retrieval', lang, hbars(title[lang], rs, foot[lang], vmax=6.5, label_w=300, fmt='{:.1f}'))


def fig_encoders():
    L = {
        'en': dict(title='Bi-encoder (retrieve) vs cross-encoder (rerank)', bi='Bi-encoder', cross='Cross-encoder', q='question', d='chunk', enc='encoder', vec='vector', cos='cosine',
                   bi_note=['chunk vectors are computed once, at indexing', 'a question = one encoder pass + a fast vector search', 'fast; misses fine word-level matches'],
                   cross_note=['reads the question and the chunk together', 'one full pass per (question, chunk) pair', 'more accurate; far too slow for a whole corpus'], score='relevance score'),
        'zh': dict(title='双编码器（检索）与交叉编码器（重排）', bi='双编码器', cross='交叉编码器', q='问题', d='文本块', enc='编码器', vec='向量', cos='余弦',
                   bi_note=['文本块的向量在索引期一次算好', '每个问题：编码一次 + 快速向量检索', '快，但抓不住细致的词级匹配'],
                   cross_note=['把问题和文本块放在一起读', '每一对（问题，块）都要完整跑一遍', '更准，但对整份语料太慢'], score='相关度分数'),
    }
    for lang, t in L.items():
        p = [T(24, 36, t['title'], 20, weight=600)]
        p.append(T(30, 74, t['bi'], 17, C['accent'], weight=600))
        p += [box(30, 90, 120, 44, t['q']), box(230, 90, 120, 44, t['d']), box(30, 160, 120, 44, t['enc'], stroke=C['accent']), box(230, 160, 120, 44, t['enc'], stroke=C['accent'])]
        p += [arrow(90, 134, 90, 160), arrow(290, 134, 290, 160), box(30, 230, 120, 40, t['vec']), box(230, 230, 120, 40, t['vec']), arrow(90, 204, 90, 230), arrow(290, 204, 290, 230)]
        p += [box(130, 296, 120, 40, t['cos'], stroke=C['gold']), arrow(90, 270, 165, 296), arrow(290, 270, 215, 296)]
        for i, s in enumerate(t['bi_note']):
            p.append(T(30, 370 + i * 22, '• ' + s, 14, C['muted']))
        X = 470
        p.append(T(X, 74, t['cross'], 17, C['coral'], weight=600))
        p += [box(X, 90, 320, 44, f"[{t['q']}] + [{t['d']}]"), box(X + 85, 160, 150, 44, t['enc'], stroke=C['coral']), arrow(X + 160, 134, X + 160, 160)]
        p += [box(X + 85, 230, 150, 40, t['score'], stroke=C['gold']), arrow(X + 160, 204, X + 160, 230)]
        for i, s in enumerate(t['cross_note']):
            p.append(T(X, 370 + i * 22, '• ' + s, 14, C['muted']))
        p.append(T(24, 452, 'Sentence-BERT (arXiv:1908.10084); monoBERT (arXiv:1901.04085)', 12, C['muted']))
        write('a', 'bi-cross-encoder', lang, svg(860, 470, p))


def fig_lost_middle():
    L = {
        'en': dict(title='Where the relevant passage sits in a long context matters', x='position of the relevant passage among the retrieved ones', y='accuracy',
                   first='first', last='last', note='Illustration of the shape only: accuracy is highest at the start and the end, lowest in the middle.', src='Shape after Liu et al., "Lost in the Middle", TACL (arXiv:2307.03172); not their numbers.'),
        'zh': dict(title='相关段落放在长上下文的什么位置，会影响答对率', x='相关段落在检索结果中的位置', y='答对率',
                   first='最前', last='最后', note='只示意形状：放在开头和结尾时答对率最高，放在中间最低。', src='形状依据 Liu et al.《Lost in the Middle》，TACL（arXiv:2307.03172）；不是论文里的数字。'),
    }
    for lang, t in L.items():
        p = [T(24, 36, t['title'], 20, weight=600)]
        x0, x1, y0, y1 = 110, 780, 300, 80
        p.append(f'<line x1="{x0}" y1="{y0}" x2="{x1}" y2="{y0}" stroke="{C["muted"]}" stroke-width="2"/><line x1="{x0}" y1="{y0}" x2="{x0}" y2="{y1}" stroke="{C["muted"]}" stroke-width="2"/>')
        pts = []
        for i in range(41):
            u = i / 40
            v = 0.55 + 0.35 * (2 * u - 1) ** 2 - 0.05 * u
            pts.append(f'{x0 + 20 + u * (x1 - x0 - 40):.1f},{y0 - v * (y0 - y1):.1f}')
        p.append(f'<polyline points="{" ".join(pts)}" fill="none" stroke="{C["accent"]}" stroke-width="4" stroke-dasharray="10 6"/>')
        p += [T(x0 + 20, y0 + 24, t['first'], 14, C['muted'], 'middle'), T(x1 - 20, y0 + 24, t['last'], 14, C['muted'], 'middle')]
        p += [T((x0 + x1) / 2, y0 + 48, t['x'], 15, anchor='middle'), T(x0 - 14, (y0 + y1) / 2, t['y'], 15, anchor='end')]
        p += [T(24, 382, t['note'], 14), T(24, 406, t['src'], 12, C['muted'])]
        write('a', 'lost-in-the-middle', lang, svg(860, 420, p))


def fig_pca():
    d = json.loads((PUB / 'a' / 'data' / 'retrieval.json').read_text(encoding='utf-8'))
    srcs = d['meta']['sources']
    pal = ['#2563EB', '#E4572E', '#1F8A5B', '#B8860B', '#7C3AED', '#0D9488', '#DB2777', '#4B5563']
    L = {'en': dict(title='Chunk embeddings projected to 2D with PCA (real data)', note='Each dot is a 256-token chunk, coloured by article (planets in colour, the 8 other bodies grey). ★ = the question "{q}"',
                    warn='These 2 directions keep only {pct}% of the spread: dots close in 2D are not always close in the 384-dimensional space.', src='multilingual-e5-small; 16 Wikipedia articles (CC BY-SA 4.0); tools/ft-data/af/chunk_recall.py', other='other bodies'),
         'zh': dict(title='文本块向量用 PCA 投影到二维（真实数据）', note='每个点是一个 256 token 的文本块，颜色表示条目（八大行星彩色，另外 8 个天体灰色）。★ = 问题"{q}"',
                    warn='这两个方向只保留了 {pct}% 的差异：二维里挨得近的点，在 384 维空间里不一定近。', src='multilingual-e5-small；16 篇维基百科条目（CC BY-SA 4.0）；tools/ft-data/af/chunk_recall.py', other='其他天体')}
    qs = json.loads((HERE / 'questions.json').read_text(encoding='utf-8'))
    for lang, t in L.items():
        f = d['figures'][lang]['pca']
        names = [s['title'] for s in srcs if s['lang'] == lang]
        xs = [c[0] for c in f['chunks']] + [q[0] for q in f['queries']]
        ys = [c[1] for c in f['chunks']] + [q[1] for q in f['queries']]
        mnx, mxx, mny, mxy = min(xs), max(xs), min(ys), max(ys)
        X = lambda v: 60 + (v - mnx) / (mxx - mnx) * 520
        Y = lambda v: 420 - (v - mny) / (mxy - mny) * 340
        p = [T(24, 36, t['title'], 20, weight=600)]
        for x, y, doc in f['chunks']:
            p.append(f'<circle cx="{X(x):.1f}" cy="{Y(y):.1f}" r="4.5" fill="{pal[doc] if doc < 8 else "#B8B8BE"}" fill-opacity="0.75"/>')
        qi = 9  # winds on Saturn
        qx, qy = f['queries'][qi]
        p.append(T(X(qx), Y(qy) + 8, '★', 24, C['ink'], 'middle'))
        for i in range(8):
            p += [f'<circle cx="640" cy="{96 + i * 28}" r="6" fill="{pal[i]}"/>', T(656, 101 + i * 28, names[i], 14)]
        p += [f'<circle cx="640" cy="{96 + 8 * 28}" r="6" fill="#B8B8BE"/>', T(656, 101 + 8 * 28, t['other'], 14)]
        pct = round(100 * sum(f['explained']))
        p += [T(24, 456, t['note'].format(q=qs[lang][qi]['q']), 13), T(24, 478, t['warn'].format(pct=pct), 13, C['coral']), T(24, 500, t['src'], 12, C['muted'])]
        write('a', 'chunk-pca', lang, svg(860, 512, p))


# ------------------------------------------------------------------ F
def fig_hub():
    title = {'en': 'Models on the Hugging Face Hub, by how they were trained (tags, Oct 2026)', 'zh': 'Hugging Face Hub 上按训练方法统计的模型数（标签，2026 年 10 月）'}
    rows = {
        'en': [('SFT (trl + sft)', 78127), ('text classification (Trainer)', 43372), ('GRPO (trl + grpo)', 14257), ('DPO (trl + dpo)', 10532)],
        'zh': [('SFT（trl + sft）', 78127), ('文本分类（Trainer）', 43372), ('GRPO（trl + grpo）', 14257), ('DPO（trl + dpo）', 10532)],
    }
    foot = {'en': 'Tags are added automatically by the tools; they undercount and lean towards hobbyist uploads. Source: research-adoption.md.',
            'zh': '标签由训练工具自动添加，会少计，也偏向个人上传。来源：research-adoption.md。'}
    for lang in ['en', 'zh']:
        rs = [(l, v, None, '') for l, v in rows[lang]]
        write('f', 'hub-methods', lang, hbars(title[lang], rs, foot[lang], unit='', vmax=85000, label_w=300, fmt='{:,.0f}'))


if __name__ == '__main__':
    for f in [fig_survey, fig_levers, fig_signals, fig_distill, fig_contextual, fig_encoders, fig_lost_middle, fig_pca, fig_hub]:
        f()
