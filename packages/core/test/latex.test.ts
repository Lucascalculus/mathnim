import { it, expect } from 'vitest';
import { parse, to_latex } from '../src/grading/expr';
it('latex', () => {
  expect(to_latex(parse('pi r^2', ['r']))).toBe('\\pi\\,r^{2}');
  expect(to_latex(parse('sqrt(ab)'))).toBe('\\sqrt{a\\,b}');
  expect(to_latex(parse('(x+1)/(2x)'))).toBe('\\frac{x + 1}{2\\,x}');
  expect(to_latex(parse('2*3'))).toBe('2 \\cdot 3');
  expect(to_latex(parse('pi*6^2'))).toBe('\\pi \\cdot 6^{2}');
});
