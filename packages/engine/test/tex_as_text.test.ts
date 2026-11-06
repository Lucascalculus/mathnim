// A little TeX as plain text (text.ts tex_as_text): a formula step's reason is drawn as text, so "divide by $h$"
// must read "divide by h", not show its dollar signs.
import { describe, expect, it } from 'vitest';
import { tex_as_text } from '../src/index';
import { parse_steps } from '../src/steps';

describe('TeX in text, as text', () => {
  it('letters, powers, indices, arrows, Greek', () => {
    expect(tex_as_text('divide by $h$')).toBe('divide by h');
    expect(tex_as_text('expand, $x^2$ cancels')).toBe('expand, x² cancels');
    expect(tex_as_text('let $h \\to 0$')).toBe('let h → 0');
    expect(tex_as_text('$x_0$ and $a_{n+1}$')).toBe('x₀ and aₙ₊₁');
    expect(tex_as_text('$\\alpha \\le \\pi$')).toBe('α ≤ π');
    expect(tex_as_text('$e^{-x}$')).toBe('e⁻ˣ');
  });
  it('fractions and roots in one line, what has no character kept readable', () => {
    expect(tex_as_text('multiply by $\\frac{1}{2}$')).toBe('multiply by 1/2');
    expect(tex_as_text('$\\dfrac{a+b}{c}$')).toBe('(a+b)/c');
    expect(tex_as_text('$\\sqrt{x+1}$')).toBe('√(x+1)');
    expect(tex_as_text('$x^{ab}$')).toBe('x^(ab)');
    expect(tex_as_text('$\\text{EV} = 0.8$')).toBe('EV = 0.8');
  });
  it('text without TeX is left alone, Chinese too', () => {
    expect(tex_as_text('每个结果乘它的概率')).toBe('每个结果乘它的概率');
    expect(tex_as_text('除以 $h$')).toBe('除以 h');
  });
  it("a formula step's reason has its TeX as text", () => {
    const { lines } = parse_steps('\\lim_{h\\to 0}\\frac{2xh + h^2}{h}\n\\lim_{h\\to 0}(2x + h) % divide by $h$');
    expect(lines[1].why).toBe('divide by h');
  });
});
