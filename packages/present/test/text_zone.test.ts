// The text zone (docs/design/ENGINE-ZONES.md): a noun in prose is its colour in the figure; a definition sits in its
// sentence and opens there; a claim's reasons hang under it, each opened on demand, down to where the chain ends.
import { describe, expect, it } from 'vitest';
import { color_of, look, text_color_of } from '@mathnim/look';
import { math_html } from '../src/math';
import { blocks_html } from '../src/text_pages';
import { eval_expr, odometer } from '../src/tangle';

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
  it('the claim with a hollow ring in its margin, its reasons hidden under it, and bedrock named with a ground mark', () => {
    const html = blocks_html([block], 'en');
    expect(html).toContain('class="mn-chain"');
    expect(html).toContain('mn-chain-claim');
    expect(html.match(/class="mn-chain-ring" aria-expanded="false"/g)?.length).toBe(2); // the claim, the first reason
    expect(html.match(/class="mn-chain-under" hidden/g)?.length).toBe(2);
    expect(html.match(/mn-chain-ground/g)?.length).toBe(2); // a definition and an assumption: bedrock
    expect(html).toContain('>definition<');
    expect(html).toContain('>assumption<');
    expect(html).toContain('class="mn-chain-threads"');
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
    expect(html).toContain('mn-chain-leaf'); // (a reason with nothing under it and no bedrock named)
    expect(html).toContain('mn-noun');
    expect(html).toContain('mn-def-term');
  });
});

describe('in any prose: fences a model writes', () => {
  it('```why: the first line the claim, - lines the reasons, two spaces deeper per step, [definition]/[assumption] bedrock', () => {
    const html = math_html('Look:\n```why\nA differentiable $f$ is continuous.\n- the difference is the quotient times $h$\n  - the quotient tends to $f\'(x_0)$ [definition]\n  - limits multiply [假设]\n- no jump\n```\nDone.');
    expect(html).toContain('class="mn-chain"');
    expect(html.match(/class="mn-chain-ring"/g)?.length).toBe(2);
    expect(html.match(/mn-chain-ground/g)?.length).toBe(2);
    expect(html).toContain('data-tex="h"');
    expect(html).toContain('Done.');
  });
  it('```details Summary: folded paper, one sheet per paragraph', () => {
    const html = math_html('```details The KKT conditions\nAt the optimum the gradient is held.\n\n$\\nabla J + \\lambda \\nabla g = 0$\n```');
    expect(html).toContain('class="mn-fold"');
    expect(html).toContain('<span>The KKT conditions</span>');
    expect(html.match(/class="mn-fold-leaf"/g)?.length).toBe(2);
  });
});

describe('numbers you drag', () => {
  it('{{n = 3, 1..12}} is a number to drag; {{= 2.5*n, 2}} follows it, shown at once', () => {
    const html = math_html('You buy {{n = 3, 1..12}} cups: {{= 2.5*n, 2}} dollars.');
    expect(html).toContain('class="mn-num mn-num-in"');
    expect(html).toContain('data-var="n"');
    expect(html).toContain('data-min="1" data-max="12" data-step="1"');
    expect(html).toContain('data-expr="2.5&#42;n"');
    expect(html).not.toMatch(/<i>[^<0-9]/); // (the * of an expression is not emphasis)
    // the computed number reads 7.50: its wheels sit on 7, 5, 0
    const out = html.slice(html.indexOf('mn-num-out'));
    const pos = [...out.matchAll(/translateY\((-?[\d.]+)em\)/g)].map((m) => Math.round(-+m[1] / 1.25) + 0);
    expect(pos).toEqual([7, 5, 0]);
  });
  it('a step, decimals from how the numbers are written, and words as names', () => {
    const html = math_html('Rate {{rate = 0.5, 0..2, 0.1}}; {{= rate*rate, 2}}.');
    expect(html).toContain('data-step="0.1"');
    expect(html).toContain('data-dec="1"');
  });
  it('the expression language: arithmetic, powers, functions, names; nothing else', () => {
    const v = new Map([['n', 3], ['cups', 4]]);
    expect(eval_expr('2.5*n + 1', v)).toBe(8.5);
    expect(eval_expr('cups^2 / (n - 1)', v)).toBe(8);
    expect(eval_expr('sqrt(16) + max(n, cups) + round(2.6)', v)).toBe(11);
    expect(eval_expr('-n^2', v)).toBe(-9);
    expect(() => eval_expr('alert(1)', v)).toThrow();
    expect(() => eval_expr('n; 1', v)).toThrow();
  });
  it('odometer: at rest each wheel sits on its digit; a carry turns the next wheel only as the one below passes 9', () => {
    const wheels = (v: number, d = 0, n = 2) => [...odometer(v, d, n).matchAll(/translateY\((-?[\d.]+)em\)/g)].map((m) => +(-+m[1] / 1.25).toFixed(3));
    expect(wheels(42)).toEqual([4, 2]);
    expect(wheels(38.5)).toEqual([3, 8.5]);   // the tens wheel waits
    expect(wheels(39.5)).toEqual([3.5, 9.5]); // and turns while the units pass from 9 to 0
    expect(wheels(7.25, 2, 1)).toEqual([7, 2, 5]);
  });
});
