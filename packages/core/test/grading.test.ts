import { describe, expect, it } from 'vitest';
import { equivalent, evaluate, form, parse } from '../src/grading/expr';
import { grade } from '../src/grading';
import { grade_sketch } from '../src/grading/sketch';

describe('expression parser', () => {
  const v = (s: string, env: Record<string, number> = {}, vars: string[] = []) => evaluate(parse(s, vars), env);
  it('calculator syntax', () => {
    expect(v('2x^2+3x-1', { x: 2 })).toBe(13);
    expect(v('-x^2', { x: 3 })).toBe(-9);
    expect(v('2(x+1)(x-1)', { x: 3 })).toBe(16);
    expect(v('sin x^2', { x: 1 })).toBeCloseTo(Math.sin(1));
    expect(v('sin^2 x + cos^2 x', { x: 0.7 })).toBeCloseTo(1);
    expect(v('sqrt(ab)', { a: 9, b: 16 })).toBe(12);
    expect(v('√2')).toBeCloseTo(Math.SQRT2);
    expect(v('x²', { x: 5 })).toBe(25);
    expect(v('12°')).toBeCloseTo((12 * Math.PI) / 180);
    expect(v('|x-5|', { x: 2 })).toBe(3);
    expect(v('5!')).toBe(120);
    expect(v('2^-1')).toBe(0.5);
    expect(v('3 ÷ 4 × 2')).toBe(1.5);
    expect(v('ln(e^2)')).toBeCloseTo(2);
  });
  it('LaTeX input', () => {
    expect(v('\\frac{1}{2}+\\frac{1}{3}')).toBeCloseTo(5 / 6);
    expect(v('\\sqrt{x^2+16}', { x: 3 })).toBe(5);
    expect(v('\\sqrt[3]{27}')).toBeCloseTo(3);
    expect(v('2\\pi r', { r: 1 })).toBeCloseTo(2 * Math.PI);
    expect(v('\\left(x+1\\right)\\cdot 2', { x: 1 })).toBe(4);
    expect(v('\\frac{\\sqrt{3}}{2}')).toBeCloseTo(Math.sqrt(3) / 2);
  });
  it('equivalence', () => {
    expect(equivalent('x(x+1)', 'x^2+x')).toBe(true);
    expect(equivalent('(x+1)^2', 'x^2+2x+1')).toBe(true);
    expect(equivalent('(x+1)^2', 'x^2+1')).toBe(false);
    expect(equivalent('1/2', '0.5')).toBe(true);
    expect(equivalent('sqrt(ab)', 'sqrt(a)sqrt(b)', { ranges: { a: [1, 5], b: [1, 5] } })).toBe(true);
    expect(equivalent('\\frac{x^2-1}{x-1}', 'x+1')).toBe(true);
  });
  it('forms', () => {
    expect(form.factored(parse('(x+1)(x+2)'))).toBe(true);
    expect(form.factored(parse('x^2+3x+2'))).toBe(false);
    expect(form.expanded(parse('x^2+3x+2'))).toBe(true);
    expect(form.expanded(parse('(x+1)(x+2)'))).toBe(false);
    expect(form.exact(parse('sqrt(2)/2'))).toBe(true);
    expect(form.exact(parse('0.707'))).toBe(false);
  });
});

describe('grade', () => {
  it('choice with misconception', () => {
    const q = { type: 'choice' as const, options: [{ id: 'a', label: 'closest', misconception: 'closer-better' }, { id: 'b', label: 'middle', correct: true }] };
    expect(grade(q, { type: 'choice', option: 'a' })).toMatchObject({ correct: false, misconception: 'closer-better' });
    expect(grade(q, { type: 'choice', option: 'b' }).correct).toBe(true);
  });
  it('number with tolerance and known wrong answers', () => {
    const q = { type: 'number' as const, answer: (v: any) => Math.sqrt(v.a * v.b), tolerance: 0.05, wrong: [{ answer: 12.5, misconception: 'mean' }] };
    expect(grade(q, { type: 'number', value: '12' }, { a: 9, b: 16 }).correct).toBe(true);
    expect(grade(q, { type: 'number', value: 'sqrt(144)' }, { a: 9, b: 16 }).correct).toBe(true);
    expect(grade(q, { type: 'number', value: 12.5 }, { a: 9, b: 16 }).misconception).toBe('mean');
  });
  it('expression with form requirement', () => {
    const q = { type: 'expression' as const, answer: '(x+1)(x+2)', variables: ['x'], form: 'factored' as const };
    expect(grade(q, { type: 'expression', text: '(x+2)(x+1)' }).correct).toBe(true);
    const g = grade(q, { type: 'expression', text: 'x^2+3x+2' });
    expect(g.correct).toBe(false);
    expect(g.score).toBe(0.5);
  });
});

describe('sketch', () => {
  const target = { f: (x: number) => -((x - 2) ** 2) + 4, x_range: [0, 4] as [number, number], y_range: [0, 5] as [number, number] };
  const draw = (f: (x: number) => number) => Array.from({ length: 60 }, (_, i) => [(4 * i) / 59, f((4 * i) / 59)] as [number, number]);
  it('accepts a rough correct shape', () => {
    const r = grade_sketch(draw((x) => -((x - 2.1) ** 2) * 0.9 + 3.6 + 0.1 * Math.sin(9 * x)), target);
    expect(r.correct).toBe(true);
  });
  it('rejects a monotone guess and explains why', () => {
    const r = grade_sketch(draw((x) => x), target);
    expect(r.correct).toBe(false);
    expect(r.feedback.join(' ')).toMatch(/highest point/);
  });
  it('points out a shifted peak', () => {
    const r = grade_sketch(draw((x) => -((x - 3.2) ** 2) + 4), target);
    expect(r.feedback.join(' ')).toMatch(/too far right/);
  });
});
