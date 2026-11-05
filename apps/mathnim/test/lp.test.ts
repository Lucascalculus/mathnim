// The LP engine and the formulation checker of the instruments (public/frames/kit): solutions and sensitivity
// ranges against the numbers the MGMT90141 lecturer's answer deck gives for the DCI question, and the checker's
// verdicts on a correct model, an equivalent one and each of the classic mistakes.
import { describe, expect, it } from 'vitest';
// the kit files are classic scripts for sandboxed frames (they set a global in a browser, module.exports in Node)
// @ts-ignore
import LP from '../public/frames/kit/lp.js';
(globalThis as any).LP = LP;
// @ts-ignore
const C = (await import('../public/frames/kit/lpcheck.js')).default as any;
const near = (a: number, b: number, d = 1e-6) => expect(Math.abs(a - b)).toBeLessThan(d);

const dci = { sense: 'min', c: [10, 14, 6, 9], rows: [
  { a: [1, 1, 0, 0], op: '=', b: 100 }, { a: [0, 0, 1, 1], op: '=', b: 150 },
  { a: [4, 0, 3, 0], op: '<=', b: 600 }, { a: [6, 0, 8, 0], op: '<=', b: 1080 } ] };
const V = ['x11', 'x12', 'x21', 'x22'];
const ref = { ...dci, rows: [
  { ...dci.rows[0], label: 'model A demand' }, { ...dci.rows[1], label: 'model B demand' },
  { ...dci.rows[2], label: 'injection-molding time' }, { ...dci.rows[3], label: 'assembly time' } ] };
const learner = (sense: string, obj: string, lines: string[]) => ({ sense, c: C.parse_objective(obj, V), rows: lines.map((t) => C.parse_row(t, V)) });

describe('LP engine (DCI, 2025 Q1)', () => {
  const s = LP.solve(dci), r = LP.sensitivity(dci, s);
  it('solves it', () => {
    expect(s.status).toBe('optimal');
    s.x.forEach((v: number, i: number) => near(v, [100, 0, 60, 90][i]));
    near(s.obj, 2170);
  });
  it('gives the ranges the answer deck uses', () => {
    near(r.rows[2].lhs, 580); near(r.rows[2].shadow, 0); near(r.rows[2].dec, 20); expect(r.rows[2].inc).toBe(Infinity);
    near(r.rows[3].shadow, -0.375); near(r.rows[3].inc, 53.3333333, 1e-4);
    near(r.vars[3].cost - r.vars[3].dec, 6); near(r.vars[3].cost + r.vars[3].inc, 11.3333333, 1e-4);
  });
  it('knows an infeasible and an unbounded model', () => {
    expect(LP.solve({ sense: 'max', c: [1], rows: [{ a: [1], op: '<=', b: 1 }, { a: [1], op: '>=', b: 2 }] }).status).toBe('infeasible');
    expect(LP.solve({ sense: 'max', c: [1, 1], rows: [{ a: [1, -1], op: '<=', b: 1 }] }).status).toBe('unbounded');
  });
  it('Shader Electronics: shadow price 1.5 on the 240', () => {
    const m = { sense: 'max', c: [7, 5], rows: [{ a: [4, 3], op: '<=', b: 240 }, { a: [2, 1], op: '<=', b: 100 }] };
    near(LP.sensitivity(m, LP.solve(m)).rows[0].shadow, 1.5);
  });
});

describe('formulation checker', () => {
  const good = ['x11 + x12 = 100', 'x21 + x22 = 150', '4x11 + 3x21 <= 600', '6x11 + 8x21 <= 1080'];
  it('reads exam notation', () => {
    expect(C.parse_row('0.7x11 - 0.3x21 - 0.3x31 <= 0', ['x11', 'x21', 'x31']).a).toEqual([0.7, -0.3, -0.3]);
    const r = C.parse_row('x11 ≤ 0.3(x11 + x21 + x31)', ['x11', 'x21', 'x31']);
    expect(r.a.map((v: number) => +v.toFixed(6))).toEqual([0.7, -0.3, -0.3]); expect(r.op).toBe('<='); expect(r.b).toBeCloseTo(0);
    expect(() => C.parse_row('x11 * x21 <= 4', V)).toThrow(/not linear/);
    expect(() => C.parse_row('y <= 4', V)).toThrow(/not one of the variables/);
  });
  it('accepts the correct model, an equivalent one, and a scaled one', () => {
    expect(C.compare(ref, learner('min', 'z = 10x11 + 14x12 + 6x21 + 9x22', good)).same_model).toBe(true);
    expect(C.compare(ref, learner('min', '9x22 + 6x21 + 14x12 + 10x11', ['100 = x12 + x11', 'x21 + x22 >= 150', 'x22 + x21 <= 150', '2*(4x11 + 3x21) <= 1200', '6x11 + 8x21 <= 1080'])).same_model).toBe(true);
  });
  it('catches a missing limit with a plan that breaks it', () => {
    const c = C.compare(ref, learner('min', '10x11 + 14x12 + 6x21 + 9x22', good.slice(0, 3)));
    expect(c.same_model).toBe(false);
    expect(c.enforced.map((e: any) => e.ok)).toEqual([true, true, true, false]);
    expect(c.enforced[3].lhs).toBeGreaterThan(1080);
  });
  it('catches = written as <=, an extra limit, a wrong sense and a wrong cost', () => {
    const le = C.compare(ref, learner('min', '10x11 + 14x12 + 6x21 + 9x22', ['x11 + x12 <= 100', ...good.slice(1)]));
    expect(le.enforced[0].ok).toBe(false);
    const extra = C.compare(ref, learner('min', '10x11 + 14x12 + 6x21 + 9x22', [...good, 'x11 <= 50']));
    expect(extra.valid.map((e: any) => e.ok)).toEqual([true, true, true, true, false]);
    expect(C.compare(ref, learner('max', '10x11 + 14x12 + 6x21 + 9x22', good)).sense_ok).toBe(false);
    const cost = C.compare(ref, learner('min', '10x11 + 14x12 + 6x21 + 6x22', good));
    expect(cost.objective_ok).toBe(false); expect(cost.objective_diff[0].index).toBe(3);
  });
});
