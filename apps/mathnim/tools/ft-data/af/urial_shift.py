"""Token distribution shift between a base model and its chat version (URIAL-style).

Qwen2.5-0.5B-Instruct answers one prompt per language (greedy decoding). The
base model Qwen2.5-0.5B then reads the same text (prompt in the chat template
plus the chat model's answer so far) and we record, for every answer token,
the rank the base model gives it: rank 1 = "unshifted", rank 2-3 = "marginal",
rank > 3 = "shifted" (the categories of Lin et al., URIAL, arXiv:2312.01552).

Output: apps/mathnim/public/ft/a/data/urial_shift.json and the figure
apps/mathnim/public/ft/a/urial-shift.{en,zh}.svg
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

tok = AutoTokenizer.from_pretrained(CHAT)
chat = AutoModelForCausalLM.from_pretrained(CHAT, torch_dtype=torch.float32).eval()
base = AutoModelForCausalLM.from_pretrained(BASE, torch_dtype=torch.float32).eval()


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
    W, x0, y, lh, fs = 960, 24, 70, 34, 18
    t = TXT[lang]
    parts = [f'<text x="{x0}" y="34" font-size="22" font-weight="600" fill="#111113">{html.escape(t["title"])}</text>']
    parts.append(f'<text x="{x0}" y="{y}" font-size="15" fill="#86868B">{html.escape(("Prompt: " if lang == "en" else "提问：") + res["prompt"])}</text>')
    y += 40
    x = x0
    cw = (lambda s: sum(18 if ord(ch) > 0x2e80 else 9.6 for ch in s) + 8)
    for r in res['tokens']:
        s = r['tok'].replace('\n', '↵')
        cat = 'unshifted' if r['rank'] == 1 else 'marginal' if r['rank'] <= 3 else 'shifted'
        w = cw(s)
        if x + w > W - x0:
            x, y = x0, y + lh
        parts.append(f'<rect x="{x:.1f}" y="{y - 22}" width="{w - 3:.1f}" height="28" rx="5" fill="{COL[cat]}"/>')
        parts.append(f'<text x="{x + 4:.1f}" y="{y - 3}" font-size="{fs}" fill="#111113" xml:space="preserve">{html.escape(s)}</text>')
        x += w
    y += 52
    s = summary(res['tokens'])
    lx = x0
    for (cat, label) in zip(['unshifted', 'marginal', 'shifted'], t['legend']):
        pct = round(100 * s[cat] / s['n'])
        parts.append(f'<rect x="{lx}" y="{y - 16}" width="22" height="20" rx="4" fill="{COL[cat]}"/>')
        txt = f'{label}: {pct}%'
        parts.append(f'<text x="{lx + 30}" y="{y}" font-size="16" fill="#111113">{html.escape(txt)}</text>')
        lx += 330
    y += 36
    parts.append(f'<text x="{x0}" y="{y}" font-size="13" fill="#86868B">{html.escape(t["foot"])}</text>')
    H = y + 22
    return f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W} {H}" width="{W}" height="{H}" font-family="-apple-system, \'PingFang SC\', \'Noto Sans SC\', \'Helvetica Neue\', Arial, sans-serif"><rect width="{W}" height="{H}" fill="#FFFFFF"/>' + ''.join(parts) + '</svg>\n'


def main():
    out = {}
    for lang in ['en', 'zh']:
        res = run(lang)
        res['summary'] = summary(res['tokens'])
        out[lang] = res
        print(lang, res['summary'], res['answer'][:120].replace('\n', ' '))
        (ROOT / 'apps' / 'mathnim' / 'public' / 'ft' / 'a').mkdir(parents=True, exist_ok=True)
        (ROOT / 'apps' / 'mathnim' / 'public' / 'ft' / 'a' / f'urial-shift.{lang}.svg').write_text(svg(lang, res), encoding='utf-8')
    p = ROOT / 'apps' / 'mathnim' / 'public' / 'ft' / 'a' / 'data' / 'urial_shift.json'
    p.parent.mkdir(parents=True, exist_ok=True)
    p.write_text(json.dumps({'base': BASE, 'chat': CHAT, 'decoding': 'greedy', 'results': out}, ensure_ascii=False, indent=1), encoding='utf-8')


if __name__ == '__main__':
    main()
