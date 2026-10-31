import { describe, expect, it } from 'vitest';
import { check_page } from '../src/page_gen';

describe('check_page', () => {
  it('keeps the known blocks and drops the rest', () => {
    const page = check_page({
      title: 'What a derivative is',
      blocks: [
        { type: 'p', text: 'A derivative measures $f(x)$ changing.' },
        { type: 'math', tex: '$f\'(x) = 2x$' },
        { type: 'script', text: 'alert(1)' },
        { type: 'table', head: ['x', 'f'], rows: [['1', '1'], ['2', '4']] },
        { type: 'table', head: ['x', 'f'], rows: [['1']] },
        { type: 'callout', kind: 'danger', body: 'Watch the sign.' },
      ],
    });
    expect(page.blocks.map((b) => b.type)).toEqual(['p', 'math', 'table', 'callout']);
    expect(page.blocks[1]).toEqual({ type: 'math', tex: "f'(x) = 2x" });
    expect(page.blocks[3]).toMatchObject({ kind: 'note' });
  });
  it('refuses a page without a title or a paragraph, or with an unclosed formula', () => {
    expect(() => check_page({ blocks: [{ type: 'p', text: 'x' }] })).toThrow();
    expect(() => check_page({ title: 'T', blocks: [{ type: 'h', text: 'Only a heading' }] })).toThrow();
    expect(() => check_page({ title: 'T', blocks: [{ type: 'p', text: 'costs $5 for one' }] })).toThrow();
  });
  it('drops a paragraph whose formula is not closed, keeping the rest', () => {
    const page = check_page({ title: 'T', blocks: [{ type: 'p', text: 'costs $5 for one' }, { type: 'p', text: 'Fine: $x^2$.' }] });
    expect(page.blocks).toEqual([{ type: 'p', text: 'Fine: $x^2$.' }]);
  });
});
