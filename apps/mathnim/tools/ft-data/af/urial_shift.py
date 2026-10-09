"""Token distribution shift between a base model and its chat version (URIAL-style).

Qwen2.5-0.5B-Instruct answers one prompt per language (greedy decoding). The
base model Qwen2.5-0.5B then reads the same text (prompt in the chat template
plus the chat model's answer so far) and we record, for every answer token,
the rank the base model gives it: rank 1 = "unshifted", rank 2-3 = "marginal",
rank > 3 = "shifted" (the categories of Lin et al., URIAL, arXiv:2312.01552).

Output: apps/mathnim/public/ft/a/data/urial_shift.json and the figure
apps/mathnim/public/ft/a/urial-shift.{en,zh}.svg (--svg-only redraws the figure from the JSON).
"""
import html, json, pathlib

import torch
from transformers import AutoModelForCausalLM, AutoTokenizer

HERE = pathlib.Path(__file__).parent
ROOT = HERE.parents[4]
BASE, CHAT = 'Qwen/Qwen2.5-0.5B', 'Qwen/Qwen2.5-0.5B-Instruct'
PROMPTS = {
    'en': 'Explain in three short sentences why the sky is blue.',
    'zh': '用三句简短的话解释天空为什么是蓝色的。',
}
MAX_NEW = 90

tok = chat = base = None


def load():
    global tok, chat, base
    tok = AutoTokenizer.from_pretrained(CHAT)
    chat = AutoModelForCausalLM.from_pretrained(CHAT, dtype=torch.float32).eval()
    base = AutoModelForCausalLM.from_pretrained(BASE, dtype=torch.float32).eval()


@torch.no_grad()
def run(lang):
    msgs = [{'role': 'user', 'content': PROMPTS[lang]}]
    prompt = tok.apply_chat_template(msgs, tokenize=False, add_generation_prompt=True)
    ids = tok(prompt, return_tensors='pt').input_ids
    out = chat.generate(ids, max_new_tokens=MAX_NEW, do_sample=False, pad_token_id=tok.eos_token_id)
    ans = out[0, ids.shape[1]:]
    ans = ans[ans != tok.convert_tokens_to_ids('<|im_end|>')]
    full = torch.cat([ids[0], ans]).unsqueeze(0)
    logits = base(full).logits[0]
    rows = []
    for k, t in enumerate(ans.tolist()):
        pos = ids.shape[1] + k - 1  # logits at pos predict token pos + 1
        lp = logits[pos]
        rank = int((lp > lp[t]).sum().item()) + 1
        top = int(lp.argmax().item())
        rows.append({'tok': tok.decode([t]), 'rank': rank, 'base_top': tok.decode([top])})
    return {'prompt': PROMPTS[lang], 'answer': tok.decode(ans), 'tokens': rows}


def summary(rows):
    n = len(rows)
    c = lambda f: sum(1 for r in rows if f(r['rank']))
    return {'n': n, 'unshifted': c(lambda r: r == 1), 'marginal': c(lambda r: 2 <= r <= 3), 'shifted': c(lambda r: r > 3)}


COL = {'unshifted': '#E6E6EA', 'marginal': '#F5D58A', 'shifted': '#F2A189'}
TXT = {
    'en': {'title': 'Which answer tokens did the chat model change?', 'legend': ['base model’s top choice', 'base rank 2–3', 'base rank > 3 (shifted)'],
           'foot': 'Qwen2.5-0.5B-Instruct answers; Qwen2.5-0.5B ranks each token in the same context. Method: Lin et al., URIAL (arXiv:2312.01552).'},
    'zh': {'title': '对话模型改动了回答里的哪些 token？', 'legend': ['基座模型的首选', '基座排第 2–3', '基座排第 3 名以后（偏移）'],
           'foot': '回答由 Qwen2.5-0.5B-Instruct 生成；Qwen2.5-0.5B 在同样的上下文里给每个 token 排名。方法见 Lin et al., URIAL（arXiv:2312.01552）。'},
}


def svg(lang, res):
    W, x0, lh, fs = 720, 20, 36, 18
    t = TXT[lang]
    out = []
    def text(x, y, s, size, color='#111113', weight=400):
        out.append(f'<text x="{x:.1f}" y="{y:.1f}" font-size="{size}" fill="{color}" font-weight="{weight}" xml:space="preserve">{html.escape(s)}</text>')
    def para(y, s, size, color, width=W - 2 * x0):
        line = ''
        for ch in s:
            if sum(size if ord(c) > 0x2e80 else 0.55 * size for c in line + ch) > width:
                text(x0, y, line, size, color)
                y += round(size * 1.35)
                line = ''
            line += ch
        if line:
            text(x0, y, line, size, color)
            y += round(size * 1.35)
        return y
    y = para(32, t['title'], 20, '#111113')
    y = para(y + 4, ('Prompt: ' if lang == 'en' else '提问：') + res['prompt'], 16, '#86868B')
    y += 30
    x = x0
    cw = lambda s: sum(fs if ord(ch) > 0x2e80 else 0.56 * fs for ch in s) + 10
    for r in res['tokens']:
        s = r['tok'].replace('\n', '\u21b5')
        cat = 'unshifted' if r['rank'] == 1 else 'marginal' if r['rank'] <= 3 else 'shifted'
        w = cw(s)
        if x + w > W - x0:
            x, y = x0, y + lh
        out.append(f'<rect x="{x:.1f}" y="{y - 23}" width="{w - 3:.1f}" height="30" rx="5" fill="{COL[cat]}"/>')
        text(x + 4, y - 2, s, fs)
        x += w
    y += 50
    sm = summary(res['tokens'])
    for cat, label in zip(['unshifted', 'marginal', 'shifted'], t['legend']):
        pct = round(100 * sm[cat] / sm['n'])
        out.append(f'<rect x="{x0}" y="{y - 16}" width="22" height="20" rx="4" fill="{COL[cat]}"/>')
        text(x0 + 32, y, f'{label}: {pct}%', 16)
        y += 28
    y = para(y + 8, t['foot'], 15, '#86868B')
    H = y + 6
    return f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W} {H}" width="{W}" height="{H}" font-family="-apple-system, \'PingFang SC\', \'Noto Sans SC\', \'Helvetica Neue\', Arial, sans-serif"><rect width="{W}" height="{H}" fill="#FFFFFF"/>' + ''.join(out) + '</svg>\n'


def main(svg_only=False):
    data_path = ROOT / 'apps' / 'mathnim' / 'public' / 'ft' / 'a' / 'data' / 'urial_shift.json'
    if svg_only:
        out = json.loads(data_path.read_text(encoding='utf-8'))['results']
    else:
        load()
        out = {}
        for lang in ['en', 'zh']:
            res = run(lang)
            res['summary'] = summary(res['tokens'])
            out[lang] = res
            print(lang, res['summary'], res['answer'][:120].replace('\n', ' '))
        data_path.parent.mkdir(parents=True, exist_ok=True)
        data_path.write_text(json.dumps({'base': BASE, 'chat': CHAT, 'decoding': 'greedy', 'results': out}, ensure_ascii=False, indent=1), encoding='utf-8')
    for lang in ['en', 'zh']:
        (ROOT / 'apps' / 'mathnim' / 'public' / 'ft' / 'a' / f'urial-shift.{lang}.svg').write_text(svg(lang, out[lang]), encoding='utf-8')


if __name__ == '__main__':
    import sys
    main(svg_only='--svg-only' in sys.argv)
