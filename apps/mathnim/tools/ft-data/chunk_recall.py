"""Real retrieval runs for lesson A2 (chunk size under a fixed context budget).

For each language (zh, en), chunk size (64-1024 tokens of the embedding model's
tokenizer) and overlap (0 / 10% / 20%), the corpus (eight Wikipedia planet
articles, corpus/<lang>/) is cut into fixed-size token windows inside each
article, every chunk is embedded with intfloat/multilingual-e5-small
("passage: " prefix, mean pooling, L2-normalised; the model reads at most 512
tokens, so longer chunks are truncated - recorded as `truncated`), and each of
the 12 questions ("query: " prefix) ranks all chunks by cosine similarity.

A question is answered by a chunk only when the chunk contains its whole gold
sentence. Per question we keep the rank of the best such chunk (0 = the
sentence was split by every chunk boundary), the ranks of all chunks of the
gold article (for the document strip) and the articles of the top 64 chunks.

Also writes the hybrid-search comparison (BM25, dense, RRF with k = 60) at
256-token chunks and a 2D PCA of those chunk embeddings for the figures.

Output:
  packages/visuals/src/ft/a/data/chunk_recall.ts  (data module for the visual)
  apps/mathnim/public/ft/a/data/retrieval.json    (figures, lab)
"""
import json, math, pathlib, re

import numpy as np
import torch
from transformers import AutoModel, AutoTokenizer

HERE = pathlib.Path(__file__).parent
ROOT = HERE.parents[3]  # repo root
MODEL = 'intfloat/multilingual-e5-small'
SIZES = [64, 128, 256, 512, 1024]
OVERLAPS = [0.0, 0.1, 0.2]
MAX_LEN = 512
TOP = 64

tok = AutoTokenizer.from_pretrained(MODEL)
model = AutoModel.from_pretrained(MODEL).eval()


@torch.no_grad()
def embed(texts, batch=32):
    out = []
    for i in range(0, len(texts), batch):
        b = tok(texts[i:i + batch], max_length=MAX_LEN, padding=True, truncation=True, return_tensors='pt')
        h = model(**b).last_hidden_state
        m = b['attention_mask'].unsqueeze(-1).float()
        v = (h * m).sum(1) / m.sum(1)
        out.append(torch.nn.functional.normalize(v, dim=-1).numpy())
    return np.concatenate(out)


def chunks_of(text, size, overlap):
    """Token windows of `size` tokens with `overlap` (fraction) inside one article, as char ranges."""
    enc = tok(text, add_special_tokens=False, return_offsets_mapping=True)
    offs = enc['offset_mapping']
    n = len(offs)
    stride = max(1, int(round(size * (1 - overlap))))
    out, start = [], 0
    while start < n:
        end = min(n, start + size)
        out.append((offs[start][0], offs[end - 1][1]))
        if end == n:
            break
        start += stride
    return out, n


def bm25_scores(docs_tokens, query_tokens, k1=1.5, b=0.75):
    N = len(docs_tokens)
    avgdl = sum(len(d) for d in docs_tokens) / N
    df = {}
    for d in docs_tokens:
        for t in set(d):
            df[t] = df.get(t, 0) + 1
    scores = np.zeros(N)
    for i, d in enumerate(docs_tokens):
        tf = {}
        for t in d:
            tf[t] = tf.get(t, 0) + 1
        s = 0.0
        for t in query_tokens:
            if t not in tf:
                continue
            idf = math.log(1 + (N - df[t] + 0.5) / (df[t] + 0.5))
            f = tf[t]
            s += idf * f * (k1 + 1) / (f + k1 * (1 - b + b * len(d) / avgdl))
        scores[i] = s
    return scores


def lexical_tokens(text, lang):
    if lang == 'zh':  # character bigrams (no word segmenter needed)
        chars = [c for c in re.sub(r'\s+', '', text)]
        return [a + b for a, b in zip(chars, chars[1:])]
    return re.findall(r"[a-z0-9]+", text.lower())


def ranks_desc(scores):
    order = np.argsort(-scores, kind='stable')
    r = np.empty(len(scores), dtype=int)
    r[order] = np.arange(1, len(scores) + 1)
    return r


def main():
    Q = json.loads((HERE / 'questions.json').read_text(encoding='utf-8'))
    sources = json.loads((HERE / 'corpus' / 'SOURCES.json').read_text(encoding='utf-8'))
    data, figs = {}, {}
    for lang in ['zh', 'en']:
        docs = [(HERE / 'corpus' / lang / f'{i}.txt').read_text(encoding='utf-8') for i in range(len(list((HERE / 'corpus' / lang).glob('*.txt'))))]
        qs = Q[lang]
        gold = []
        for q in qs:
            s = docs[q['doc']].index(q['gold'])
            gold.append((q['doc'], s, s + len(q['gold'])))
        qv = embed(['query: ' + q['q'] for q in qs])
        doc_tokens = [len(tok(d, add_special_tokens=False)['input_ids']) for d in docs]
        configs = {}
        for size in SIZES:
            for ov in OVERLAPS:
                chunks = []  # (doc, start, end)
                for i, d in enumerate(docs):
                    cs, _ = chunks_of(d, size, ov)
                    chunks += [(i, a, b) for a, b in cs]
                cv = embed(['passage: ' + docs[i][a:b] for i, a, b in chunks])
                sims = qv @ cv.T
                per_q = []
                for qi, (gd, gs, ge) in enumerate(gold):
                    r = ranks_desc(sims[qi])
                    containing = [j for j, (i, a, b) in enumerate(chunks) if i == gd and a <= gs and ge <= b]
                    best = int(min(r[j] for j in containing)) if containing else 0
                    doc_chunks = [j for j, (i, a, b) in enumerate(chunks) if i == gd]
                    order = np.argsort(-sims[qi])[:TOP]
                    per_q.append({
                        'best': best,
                        'strip': [[round(chunks[j][1] / len(docs[gd]), 4), round(chunks[j][2] / len(docs[gd]), 4), int(r[j])] for j in doc_chunks],
                        'top_docs': [int(chunks[j][0]) for j in order],
                        'best_sim': round(float(max(sims[qi][j] for j in containing)), 4) if containing else None,
                        'top_sim': round(float(sims[qi][order[0]]), 4),
                    })
                configs[f'{size}/{int(ov * 100)}'] = {'n_chunks': len(chunks), 'q': per_q}
                hits = sum(1 for p in per_q if 0 < p['best'] <= 1024 // size)
                print(lang, size, ov, len(chunks), 'hits@budget1024 =', hits, [p['best'] for p in per_q], flush=True)
        data[lang] = {
            'questions': [q['q'] for q in qs],
            'gold': [{'doc': gd, 'from': round(gs / len(docs[gd]), 4), 'to': round(ge / len(docs[gd]), 4)} for gd, gs, ge in gold],
            'docs': [s['title'] for s in sources if s['lang'] == lang],
            'doc_tokens': doc_tokens,
            'configs': configs,
        }
        # ---- hybrid search and PCA at 256-token chunks, no overlap
        chunks = []
        for i, d in enumerate(docs):
            cs, _ = chunks_of(d, 256, 0.0)
            chunks += [(i, a, b) for a, b in cs]
        texts = [docs[i][a:b] for i, a, b in chunks]
        cv = embed(['passage: ' + t for t in texts])
        lex = [lexical_tokens(t, lang) for t in texts]
        rows = []
        for qi, q in enumerate(qs):
            gd, gs, ge = gold[qi]
            dense = ranks_desc(qv[qi] @ cv.T)
            bm = ranks_desc(bm25_scores(lex, lexical_tokens(q['q'], lang)))
            rrf = ranks_desc(1 / (60 + dense) + 1 / (60 + bm))
            containing = [j for j, (i, a, b) in enumerate(chunks) if i == gd and a <= gs and ge <= b]
            best = lambda r: int(min(r[j] for j in containing)) if containing else 0
            rows.append({'q': q['q'], 'dense': best(dense), 'bm25': best(bm), 'rrf': best(rrf)})
        pca_x = cv - cv.mean(0)
        u, s, vt = np.linalg.svd(pca_x, full_matrices=False)
        xy = pca_x @ vt[:2].T
        qxy = (qv - cv.mean(0)) @ vt[:2].T
        figs[lang] = {
            'hybrid': rows,
            'hit5': {k: sum(1 for r in rows if 0 < r[k] <= 5) for k in ['dense', 'bm25', 'rrf']},
            'pca': {'chunks': [[round(float(x), 4), round(float(y), 4), int(chunks[j][0])] for j, (x, y) in enumerate(xy)],
                    'queries': [[round(float(x), 4), round(float(y), 4)] for x, y in qxy],
                    'explained': [round(float(v), 4) for v in (s[:2] ** 2 / (s ** 2).sum())]},
        }
        print(lang, 'hybrid hit@5', figs[lang]['hit5'], flush=True)

    meta = {'model': MODEL, 'max_len': MAX_LEN, 'sizes': SIZES, 'overlaps': [int(o * 100) for o in OVERLAPS],
            'corpus': 'Wikipedia (zh, en): the eight planets, CC BY-SA 4.0', 'sources': sources,
            'rule': 'a chunk answers a question when it contains the whole gold sentence'}
    out_ts = ROOT / 'packages' / 'visuals' / 'src' / 'ft' / 'a' / 'data' / 'chunk_recall.ts'
    out_ts.parent.mkdir(parents=True, exist_ok=True)
    out_ts.write_text(
        '// Generated by apps/mathnim/tools/ft-data/chunk_recall.py - do not edit by hand.\n'
        '// Real retrieval runs (multilingual-e5-small) over Wikipedia planet articles (CC BY-SA 4.0).\n'
        f'export const CHUNK_META = {json.dumps(meta, ensure_ascii=False)} as const;\n'
        f'export const CHUNK_DATA: Record<string, any> = {json.dumps(data, ensure_ascii=False, separators=(",", ":"))};\n',
        encoding='utf-8')
    out_json = ROOT / 'apps' / 'mathnim' / 'public' / 'ft' / 'a' / 'data' / 'retrieval.json'
    out_json.parent.mkdir(parents=True, exist_ok=True)
    out_json.write_text(json.dumps({'meta': meta, 'figures': figs}, ensure_ascii=False, indent=1), encoding='utf-8')
    print('wrote', out_ts, out_json)


if __name__ == '__main__':
    main()
