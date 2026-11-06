// ```steps blocks in light markup (math.ts): a column of displayed formulas with their reasons, carrying the block for
// mount_steps(); a block still arriving shows nothing; prose around it is markup as usual.
import { describe, expect, it } from 'vitest';
import { math_html, steps_rows_html } from '../src/math';
import { blocks_html } from '../src/text_pages';

describe('steps blocks in markup', () => {
  const answer = 'Take 3 from **both** sides.\n```steps\n2x + 3 = 11\n2x = 8 % subtract 3\nx = 4 % divide by 2\n```\nThen $x = 4$.';
  it('a column of displayed formulas, each with its reason, and the block for the engine', () => {
    const h = math_html(answer);
    expect(h).toContain('<b>both</b>');
    expect(h).toMatch(/<div class="mn-steps" data-steps="2x \+ 3 = 11\n2x = 8 % subtract 3\nx = 4 % divide by 2\n">/);
    expect(h.match(/class="mn-step"/g)).toHaveLength(3);
    expect(h.match(/data-display=""/g)).toHaveLength(3);
    expect(h).toContain('<div class="mn-step-why">subtract 3</div>');
    expect(h).toContain('data-tex="x = 4"');     // the inline formula after the block
    expect(h).not.toContain('```');
  });
  it('a block still arriving (the answer streaming) shows an empty place, not its text', () => {
    const h = math_html('Take 3 from both sides.\n```steps\n2x + 3 = 11\n2x = 8');
    expect(h).toContain('mn-steps-wait');
    expect(h).not.toContain('2x = 8');
  });
  it('dollars and a reason on its own line are taken; quotes in the block are escaped', () => {
    const h = math_html('```steps\n$a = b$\n$b = c$\n% because\n\\text{"x"} = 1\n```');
    expect(h).toContain('data-tex="a = b"');
    expect(h).toContain('<div class="mn-step-why">because</div>');
    expect(h).toContain('&quot;x&quot;');
  });
  it('a steps block of a page: the same column, in the page language, ready for the engine', () => {
    const lines = [{ tex: '2x = 8' }, { tex: 'x = 4', why: { en: 'divide by 2', zh: '两边除以 2' } }];
    const zh = blocks_html([{ type: 'steps', lines }], 'zh');
    expect(zh).toContain('data-steps="2x = 8\nx = 4 % 两边除以 2"');
    expect(zh).toContain('<div class="mn-step-why">两边除以 2</div>');
    expect(blocks_html([{ type: 'steps', lines }], 'en')).toContain('% divide by 2');
    expect(steps_rows_html([{ tex: 'a = b' }, { tex: 'b = a', why: 'swap' }])).toMatch(/^<div class="mn-steps" data-steps="a = b\nb = a % swap">/);
  });
  it('text without a block is unchanged', () => {
    expect(math_html('Just $x$ and `code`.')).toBe(math_html('Just $x$ and `code`.'));
    expect(math_html('Just $x$ and `code`.')).not.toContain('mn-steps');
  });
});
