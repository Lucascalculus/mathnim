"""Fetch the RAG demo corpus: the eight planets and eight similar bodies, from Chinese and English Wikipedia.

Plain-text extracts (MediaWiki API), cut to a fixed length per article so the
corpus is about 45-50k tokens per language. Saves corpus/<lang>/<n>.txt and
corpus/SOURCES.json (title, URL, revision id, licence) for attribution.
Text: Wikipedia, CC BY-SA 4.0.
"""
import json, pathlib, re, time, urllib.error, urllib.parse, urllib.request

HERE = pathlib.Path(__file__).parent
ARTICLES = {
    # the eight planets (the questions are about these), then eight similar bodies as distractors
    'zh': ['水星', '金星', '地球', '火星', '木星', '土星', '天王星', '海王星', '月球', '冥王星', '谷神星', '土卫六', '木卫二', '木卫一', '木卫三', '太阳'],
    'en': ['Mercury (planet)', 'Venus', 'Earth', 'Mars', 'Jupiter', 'Saturn', 'Uranus', 'Neptune', 'Moon', 'Pluto', 'Ceres (dwarf planet)', 'Titan (moon)', 'Europa (moon)', 'Io (moon)', 'Ganymede (moon)', 'Sun'],
}
MAX_CHARS = {'zh': 4200, 'en': 12000}
UA = {'User-Agent': 'MathnimCourseData/1.0 (educational; contact via repository)'}


def api(lang, **params):
    params = {'format': 'json', 'formatversion': '2', **{k: v for k, v in params.items() if v is not None}}
    url = f'https://{lang}.wikipedia.org/w/api.php?' + urllib.parse.urlencode(params)
    for attempt in range(6):
        try:
            with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=60) as r:
                return json.load(r)
        except urllib.error.HTTPError as e:
            if e.code != 429:
                raise
            time.sleep(5 * (attempt + 1))  # rate limited: back off
    raise RuntimeError('rate limited')


def clean(text):
    # drop section headings ("== x ==") and empty lines; keep paragraphs
    lines = [l.strip() for l in text.split('\n')]
    lines = [l for l in lines if l and not re.match(r'^=+.*=+$', l)]
    return '\n'.join(lines)


def cut(text, n):
    if len(text) <= n:
        return text
    t = text[:n]
    # end at a sentence boundary
    m = max(t.rfind('。'), t.rfind('. '), t.rfind('\n'))
    return t[: m + 1] if m > n * 0.7 else t


def main():
    sources = []
    for lang, titles in ARTICLES.items():
        out = HERE / 'corpus' / lang
        out.mkdir(parents=True, exist_ok=True)
        for i, title in enumerate(titles):
            d = api(lang, action='query', prop='extracts|revisions', explaintext=1, rvprop='ids', titles=title, redirects=1, variant='zh-cn' if lang == 'zh' else None)
            page = d['query']['pages'][0]
            text = cut(clean(page['extract']), MAX_CHARS[lang])
            (out / f'{i}.txt').write_text(text, encoding='utf-8')
            sources.append({'lang': lang, 'id': i, 'title': page['title'], 'url': f"https://{lang}.wikipedia.org/wiki/{urllib.parse.quote(page['title'].replace(' ', '_'))}", 'revision': page['revisions'][0]['revid'], 'chars': len(text), 'licence': 'CC BY-SA 4.0'})
            print(lang, page['title'], len(text))
            time.sleep(2)
    (HERE / 'corpus' / 'SOURCES.json').write_text(json.dumps(sources, ensure_ascii=False, indent=1), encoding='utf-8')


if __name__ == '__main__':
    main()
