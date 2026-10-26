// Math in lab tutorials (tools/labs_build.ts): $...$ inline and $$...$$ displayed TeX reach the
// reader untouched by Markdown parsing, "\$" is a literal dollar, code keeps its dollars, and a
// stray "$" stops the build.
import { describe, expect, it } from 'vitest';
import type { Block } from '@mathnim/core';
// ('.js' finds labs_build.ts; without an extension the .mjs launcher would be picked)
import { parse_lab, protect_math, restore_math } from '../tools/labs_build.js';
import { math_html } from '../../../packages/present/src/math';

/** A tutorial with one paragraph of the given body in each language. */
const lab = (zh: string, en: string) => `# L1 示例 / L1 Sample

> 状态：示例。
>
> Status: a sample.

## 中文

- **文件：** \`L1_x.py\`

${zh}

---

## English

- **Files:** \`L1_x.py\`

${en}
`;
const body = (md: string): Block[] => parse_lab(lab(md, md), 'L1-x.md', ['L1_x.py']).blocks.en.slice(2);

describe('math in lab tutorials', () => {
  it('keeps inline TeX as it is, backslashes, underscores and stars included', () => {
    expect(body('The cost $x_k^\\top Q x_k + \\|u\\|_{R}$ and $a*b*c$ stay.')).toEqual([
      { type: 'p', text: 'The cost $x_k^\\top Q x_k + \\|u\\|_{R}$ and $a*b*c$ stay.' },
    ]);
  });
  it('turns a paragraph that is one displayed formula into a math block', () => {
    expect(body('$$\n\\min_U \\tfrac12 U^\\top H U \\quad \\text{s.t. } G U \\le w\n$$')).toEqual([{ type: 'math', tex: '\\min_U \\tfrac12 U^\\top H U \\quad \\text{s.t. } G U \\le w' }]);
    // inside a sentence it stays displayed math in the prose
    expect(body('so $$N \\ge 1$$ holds')).toEqual([{ type: 'p', text: 'so $$N \\ge 1$$ holds' }]);
  });
  it('reads \\$ as a literal dollar, for the reader too', () => {
    const [p] = body('A GPU hour costs about \\$2, and $u_0$ is applied.') as { text: string }[];
    expect(p.text).toBe('A GPU hour costs about \\$2, and $u_0$ is applied.');
    expect(math_html(p.text)).toBe('A GPU hour costs about $2, and <code>u_0</code> is applied.');
  });
  it('leaves code alone: code spans and fenced code keep their dollars', () => {
    const bs = body('Run `echo $HOME` first.\n\n```bash\nexport N=$((10 * 2))\n```');
    expect(bs).toEqual([
      { type: 'p', text: 'Run `echo $HOME` first.' },
      expect.objectContaining({ type: 'code', code: 'export N=$((10 * 2))' }),
    ]);
  });
  it('stops at a dollar that opens no math', () => {
    expect(() => body('It costs $5 a month.')).toThrow(/opens no math/);
    expect(() => body('From $ 3 to $ 4.')).toThrow(/opens no math/);
  });
  it('puts math back everywhere: lists, tables, quotes', () => {
    // (a paragraph first, so the list is not part of the setup list above it)
    const bs = body('The plan:\n\n- horizon $N = 20$\n- input $|a| \\le a_{\\max}$\n\n| term | role |\n|---|---|\n| $x^\\top Q x$ | tracking |\n\n> Only $u_0$ is applied.');
    expect(bs.slice(1)).toEqual([
      expect.objectContaining({ type: 'list', items: ['horizon $N = 20$', 'input $|a| \\le a_{\\max}$'] }),
      expect.objectContaining({ type: 'table', head: ['term', 'role'], rows: [['$x^\\top Q x$', 'tracking']] }),
      expect.objectContaining({ type: 'callout', body: 'Only $u_0$ is applied.' }),
    ]);
    // nothing is left for Markdown to see
    const { text, math } = protect_math('a $x_1$ and $$y$$ and `$z`');
    expect(text).toBe('a \uE0001\uE001 and \uE0000\uE001 and `$z`');
    expect(restore_math([{ type: 'p', text }] as Block[], math)).toEqual([{ type: 'p', text: 'a $x_1$ and $$y$$ and `$z`' }]);
  });
});
