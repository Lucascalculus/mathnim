// The pure parts of text pages: highlighting, light markup, blocks as HTML,
// and the UI dictionary (no DOM needed).
import { describe, expect, it } from 'vitest';
import { highlight_lines, tokenize } from '../src/highlight';
import { define_ui, drag_hint, set_ui_lang, t, ui_entries } from '../src/i18n';
import { math_html, partial_math_html } from '../src/math';
import { blocks_html } from '../src/text_pages';

/** A formula before the TeX renderer is set: its source, drawn once it is (math.ts). */
const tex = (src: string) => `<span class="mn-tex-wait" data-tex="${src}" style="opacity:.5">${src}</span>`;

describe('highlight', () => {
  it('colours python keywords, strings, numbers, comments and calls', () => {
    const toks = tokenize('def f(x):\n    return g(x, "hi", 3.5)  # done', 'python');
    const cls = (text: string) => toks.find(([, t]) => t === text)?.[0];
    expect(cls('def')).toBe('k');
    expect(cls('f')).toBe('f');
    expect(cls('return')).toBe('k');
    expect(cls('g')).toBe('f');
    expect(cls('"hi"')).toBe('s');
    expect(cls('3.5')).toBe('n');
    expect(cls('# done')).toBe('c');
  });
  it('keeps triple-quoted strings across lines, one span per line', () => {
    const lines = highlight_lines('x = """a\nb"""\ny = 1', 'py');
    expect(lines).toHaveLength(3);
    expect(lines[0]).toContain('<span class="mn-t-s">&quot;&quot;&quot;a</span>');
    expect(lines[1]).toBe('<span class="mn-t-s">b&quot;&quot;&quot;</span>');
  });
  it('knows bash, json and yaml', () => {
    expect(tokenize('pip install peft --upgrade  # $HOME', 'bash').map(([c, t]) => `${c}:${t}`)).toEqual(expect.arrayContaining(['f:pip', 'a:--upgrade', 'c:# $HOME']));
    expect(tokenize('{"r": 8, "ok": true}', 'json').map(([c, t]) => `${c}:${t}`)).toEqual(expect.arrayContaining(['a:"r"', 'n:8', 'l:true']));
    expect(tokenize('lora:\n  r: 8  # rank\n  name: "x"', 'yaml').map(([c, t]) => `${c}:${t}`)).toEqual(expect.arrayContaining(['a:lora', 'a:r', 'n:8', 'c:# rank', 's:"x"']));
  });
  it('escapes HTML and leaves plain text alone', () => {
    expect(highlight_lines('a < b && c', 'text')).toEqual(['a &lt; b &amp;&amp; c']);
  });
});

describe('light markup', () => {
  it('renders code, links and footnotes; refuses unsafe links', () => {
    expect(math_html('use `pad_token` *now*')).toBe('use <code>pad_token</code> <i>now</i>');
    expect(math_html('see [the paper](https://arxiv.org/abs/1)')).toBe('see <a href="https://arxiv.org/abs/1" target="_blank" rel="noopener">the paper</a>');
    expect(math_html('[x](javascript:void)')).toBe('x');
    expect(math_html('claim[^hu]', { footnote: (k) => `<sup>${k}</sup>` })).toBe('claim<sup>hu</sup>');
    expect(math_html('a $x$ and `$y$`')).toBe('a ' + tex('x') + ' and <code>$y$</code>');
    // Chinese punctuation never starts a line: it is glued to the math before it (and opening marks to the math after)
    // bold that contains math is still bold (a tutor answer: "**冻结是为了不替 $W_0$ 存梯度**")
    expect(math_html('**rank of $BA$ is $r$** here')).toBe('<b>rank of ' + tex('BA') + ' is ' + tex('r') + '</b> here');
    expect(math_html('**plain** and $x$')).toBe('<b>plain</b> and ' + tex('x'));
    // "\$" is a literal dollar; inside math it is TeX's own
    expect(math_html('costs \\$5 and \\$7, or $x$')).toBe('costs $5 and $7, or ' + tex('x'));
    expect(math_html('$a + \\$b$')).toBe(tex('a + \\$b'));
    expect(math_html('冻结 $W_0$，只学（$r$）。')).toBe('冻结 <span class="mn-nowrap">' + tex('W_0') + '，</span>只学<span class="mn-nowrap">（' + tex('r') + '）。</span>');
  });
  // what the tutor writes (a model's habits): the answer reads as it was meant
  it('reads a tutor answer as it was meant: a star in a formula, TeX in \\( \\), a symbol in bold', () => {
    // a star inside a formula is TeX's, not the start of bold or italic
    expect(math_html('**$x^*$ 是最优解**，而 $u^*$ 是')).toBe('<b>' + tex('x^*') + ' 是最优解</b>，而 ' + tex('u^*') + ' 是');
    expect(math_html('$J^*$ and *this*')).toBe(tex('J^*') + ' and <i>this</i>');
    // \( \) and \[ \] are TeX as $ $ and $$ $$ (outside formulas: TeX's own \\[2pt] stays in one)
    expect(math_html('\\(Q/R\\) 越大')).toBe(tex('Q/R') + ' 越大');
    expect(math_html('so \\[J = x^2\\]')).toBe('so <span class="mn-tex-wait" data-tex="J = x^2" data-display="" style="opacity:.5">J = x^2</span>');
    expect(math_html('$$a \\\\[2pt] b$$')).toContain('data-tex="a \\\\[2pt] b"');
    // in the tutor's words a letter in bold is a vector, set as math; in a lesson's text it stays bold (an acronym)
    const answer = { bold_symbols: true };
    expect(math_html('状态 **x** 和 **u**', answer)).toBe('状态 ' + tex('\\mathbf{x}') + ' 和 ' + tex('\\mathbf{u}'));
    expect(math_html('**key** idea', answer)).toBe('<b>key</b> idea');
    expect(math_html('**D**ialogue, **A**ccess', answer)).toBe('<b>D</b>ialogue, <b>A</b>ccess');
    expect(math_html('选 **B**')).toBe('选 <b>B</b>');
  });
  it('shows an answer still streaming in without the halves of what has not closed', () => {
    expect(partial_math_html('这是 **最优')).toBe('这是 最优');
    expect(partial_math_html('这是 **最优**')).toBe('这是 <b>最优</b>');
    expect(partial_math_html('这是 **最优*')).toBe('这是 最优');
    for (const s of ['比值 $Q/', '比值 $$J=', '比值 \\(Q', '比值 \\[J', '比值 \\']) expect(partial_math_html(s)).toBe('比值 ');
    expect(partial_math_html('**$x^*$ 是')).toBe(tex('x^*') + ' 是');
  });
});

describe('blocks as HTML', () => {
  const blocks = [
    { type: 'h', text: { en: 'Idea', zh: '思路' } },
    { type: 'p', text: { en: 'As shown[^hu].', zh: '如图[^hu]。' } },
    { type: 'callout', kind: 'misconception', body: 'Higher is better.' },
    { type: 'code', lang: 'python', label: 'PyTorch', code: 'x = 1', tabs: [{ label: 'TRL', lang: 'python', code: 'y = 2' }] },
    { type: 'table', head: ['a', 'b'], rows: [['1', '2']] },
    { type: 'details', summary: 'More', blocks: [{ type: 'math', tex: 'E = mc^2', label: '1' }] },
    { type: 'figure', src: '/ft/a.svg', alt: 'A figure', credit: 'After X (2021)' },
    { type: 'cite', key: 'hu', text: 'Hu et al. (2021)', url: 'https://arxiv.org/abs/2106.09685' },
    { type: 'cite', key: 'other', text: 'Unreferenced', url: 'https://example.org' },
  ] as const;
  it('renders every block in the chosen language, with numbered sources', () => {
    const html = blocks_html(blocks as any, 'zh');
    expect(html).toContain('思路');
    expect(html).toContain('如图\u2060<sup class="mn-fnref">'); // a word joiner keeps the marker on its word's line
    expect(html).toContain('常见误区'); // the callout's default title, in Chinese
    expect(html).toMatch(/role="tab"[^>]*aria-selected="true"[^>]*>PyTorch/);
    expect(html).toContain('>TRL</button>');
    expect(html).toContain('<span class="mn-t-n">1</span>');
    expect(html).toContain('<th scope="col">a</th>');
    expect(html).toContain('<div class="mn-fold"><button type="button" class="mn-fold-head" aria-expanded="false"><span>More</span></button>');
    expect(html).toContain('src="/ft/a.svg"');
    expect(html).toContain('出处：After X (2021)');
    expect(html).toMatch(/<li id="[^"]*-fn-hu" value="1">Hu et al\. \(2021\)/);
    expect(html).toMatch(/<li id="[^"]*-fn-other" value="2">Unreferenced/);
    expect(html).toContain('参考资料');
  });
  it('picks the figure of the learner language', () => {
    const fig = [{ type: 'figure', src: { en: 'ft/d/x.en.svg', zh: 'ft/d/x.zh.svg' }, alt: { en: 'A map', zh: '一张图' }, credit: 'original' }] as any;
    expect(blocks_html(fig, 'zh')).toContain('src="/ft/d/x.zh.svg"');
    expect(blocks_html(fig, 'en')).toContain('src="/ft/d/x.en.svg"');
  });
  it('marks a footnote without a source', () => {
    expect(blocks_html([{ type: 'p', text: 'x[^nope]' }], 'en')).toContain('mn-fnref-missing');
  });
});

describe('UI dictionary', () => {
  it('has both languages for every entry', () => {
    for (const [k, e] of Object.entries(ui_entries())) {
      expect(e.en.trim(), k).not.toBe('');
      expect(e.zh.trim(), k).not.toBe('');
    }
  });
  it('words the drag hint naturally in Chinese', () => {
    expect(drag_hint([{ spec: { label: 'the tip of î' } }], 'en')).toBe('Drag {label}');
    expect(drag_hint([{ spec: { label: '点 P' } }], 'zh')).toBe('拖动{label}');
    expect(drag_hint([{ spec: { label: 'the tip of î' } }], 'zh')).toBe('拖动这里'); // never "拖动the tip of…"
    expect(drag_hint([{ spec: {} }], 'zh')).toBe('拖动这里'); // never "拖动me"
  });
  it('fills values and follows the interface language', () => {
    define_ui({ test_key: { en: '{n} item{s}', zh: '{n} 项' } });
    set_ui_lang('en');
    expect(t('test_key', { n: 2, s: 's' })).toBe('2 items');
    set_ui_lang('zh');
    expect(t('test_key', { n: 2, s: 's' })).toBe('2 项');
    expect(t('continue')).toBe('继续');
    expect(t('no_such_key')).toBe('no_such_key');
    set_ui_lang('en');
  });
});
