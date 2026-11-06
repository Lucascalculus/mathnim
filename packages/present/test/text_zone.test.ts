// The text zone (docs/design/ENGINE-ZONES.md): a noun in prose is its colour in the figure; a definition sits in its
// sentence and opens there; a claim's reasons hang under it, each opened on demand, down to where the chain ends.
import { describe, expect, it } from 'vitest';
import { color_of, look, text_color_of } from '@mathnim/look';
import { math_html } from '../src/math';
import { blocks_html } from '../src/text_pages';

describe('nouns in prose', () => {
  it('[cost](noun:cost) is the word in the colour the figure draws cost in, darkened only to read as text', () => {
    const html = math_html('the [cost](noun:cost) falls');
    expect(html).toContain('class="mn-noun"');
    expect(html).toContain('data-noun="cost"');
    expect(html).toContain(`color:${text_color_of('noun:cost', look())}`);
    expect(html).toContain('>cost</span> falls');
    // (the same hue as the mark: text_color_of only moves toward ink for contrast)
    expect(color_of('noun:cost')).toMatch(/^#/);
  });
  it('is not a link, and a link next to it still is', () => {
    const html = math_html('[cost](noun:cost) and [the paper](https://example.com)');
    expect(html).not.toContain('href="noun');
    expect(html).toContain('href="https://example.com"');
  });
  it('the word is escaped like any prose', () => {
    expect(math_html('[a<b](noun:cost)')).toContain('a&lt;b');
  });
});

describe('definitions in their sentence', () => {
  it('[term](def: …) is a closed term with its definition hidden in place', () => {
    const html = math_html('A [convex](def: a set that holds every segment between two of its points) set.');
    expect(html).toMatch(/^A <span class="mn-def"><button type="button" class="mn-def-term" aria-expanded="false">convex<\/button><span class="mn-def-body" hidden>a set that holds every segment between two of its points<\/span><\/span> set\.$/);
  });
  it('parentheses inside the definition are matched (a tuple, a function in TeX)', () => {
    const html = math_html('Take [a pair](def: an ordered $(a, b)$ with $f(a) < f(b)$) here.');
    expect(html).toContain('mn-def-body');
    expect(html).toContain(' here.');
    expect(html).not.toContain('](def:');
    // the TeX inside the definition is TeX (the source stays on it)
    expect(html).toContain('data-tex="(a, b)"');
    expect(html).toContain('data-tex="f(a) &lt; f(b)"');
  });
  it('a definition may hold a definition', () => {
    const html = math_html('[gradient](def: the vector of [partial derivatives](def: rates along one axis, the others held))');
    expect(html.match(/class="mn-def"/g)?.length).toBe(2);
    expect(html.indexOf('partial derivatives')).toBeGreaterThan(html.indexOf('mn-def-body'));
  });
  it('several in one sentence, with other markup around them', () => {
    const html = math_html('**Both** [x](def: one) and [y](def: two) are *here*.');
    expect(html.match(/class="mn-def-term"/g)?.length).toBe(2);
    expect(html).toContain('<b>Both</b>');
    expect(html).toContain('<i>here</i>');
  });
  it('an unclosed definition is left as written, not swallowed', () => {
    const html = math_html('a [term](def: never closed');
    expect(html).toContain('never closed');
  });
});

describe('chains of why', () => {
  const block = {
    type: 'why' as const,
    claim: { en: 'The minimum of a convex function is global.', zh: '凸函数的极小值就是全局最小值。' },
    because: [
      {
        text: { en: 'A lower point elsewhere would put the chord below the curve.', zh: '别处若有更低的点，弦就会落到曲线下方。' },
        because: [{ text: { en: 'Convex means every chord lies above the curve.', zh: '凸，就是每条弦都在曲线上方。' }, kind: 'definition' as const }],
      },
      { text: { en: 'The function is defined on all of the line.', zh: '函数定义在整条直线上。' }, kind: 'assumption' as const },
    ],
  };
  it('the claim with a hollow ring, its reasons hidden under it, and where the chain ends named', () => {
    const html = blocks_html([block], 'en');
    expect(html).toContain('class="mn-chain"');
    expect(html).toContain('mn-chain-claim');
    expect(html.match(/class="mn-chain-ring" aria-expanded="false"/g)?.length).toBe(2); // the claim, the first reason
    expect(html.match(/class="mn-chain-because" hidden/g)?.length).toBe(2);
    expect(html).toContain('>definition<');
    expect(html).toContain('>assumption<');
    // a leaf has no ring to open
    expect(html.match(/mn-chain-dot/g)?.length).toBe(2);
  });
  it('in Chinese: the labels too', () => {
    const html = blocks_html([block], 'zh');
    expect(html).toContain('凸函数的极小值');
    expect(html).toContain('>定义<');
    expect(html).toContain('>假设<');
    expect(html).toContain('aria-label="为什么？"');
  });
  it('a reason may hold the text zone\'s own markup (a definition, a noun)', () => {
    const html = blocks_html([{ type: 'why', claim: 'The [cost](noun:cost) falls.', because: [{ text: 'Each step goes [downhill](def: against the gradient).' }] }], 'en');
    expect(html).toContain('mn-noun');
    expect(html).toContain('mn-def-term');
  });
});
