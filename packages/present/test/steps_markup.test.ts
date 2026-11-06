// ```steps blocks in light markup (math.ts): a column of displayed formulas with their reasons, carrying the block for
// mount_steps(); a block still arriving shows nothing; prose around it is markup as usual.
import { describe, expect, it } from 'vitest';
import { math_html } from '../src/math';

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
  it('text without a block is unchanged', () => {
    expect(math_html('Just $x$ and `code`.')).toBe(math_html('Just $x$ and `code`.'));
    expect(math_html('Just $x$ and `code`.')).not.toContain('mn-steps');
  });
});
