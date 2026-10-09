import { describe, expect, it } from 'vitest';
import { catalog, check_params, circle_slices, get_visual } from '../src';

describe('check_params', () => {
  it('fills defaults', () => {
    const r = check_params(circle_slices, {});
    expect(r.ok).toBe(true);
    expect(r.params).toEqual({ n: 24, r: 1.6, show_formula: true });
  });
  it('coerces, rounds and clamps with notes', () => {
    const r = check_params(circle_slices, { n: '9.6', r: 5 });
    expect(r.ok).toBe(true);
    expect(r.params.n).toBe(10);
    expect(r.params.r).toBe(2.1);
    expect(r.notes.join(' ')).toMatch(/rounded 9.6 to 10/);
    expect(r.notes.join(' ')).toMatch(/outside \[1, 2.1\]/);
  });
  it('rejects unknown parameters and wrong types', () => {
    const r = check_params(circle_slices, { n: 'many', colour: 'red' });
    expect(r.ok).toBe(false);
    expect(r.errors).toHaveLength(2);
    expect(r.params.n).toBe(24);
  });
});

describe('registry', () => {
  it('finds visuals and describes them compactly', () => {
    expect(get_visual('circle_slices')).toBe(circle_slices);
    const text = catalog(['area']);
    expect(text).toContain('circle_slices - Cut a circle');
    expect(text).toContain('n: integer in [4, 60] =24');
    expect(catalog(['no such topic'])).toBe('');
  });
});
