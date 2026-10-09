import { describe, expect, it } from 'vitest';
import * as M from '../src/index';
import { constrain } from '../src/ext/interact';
import { contrast_ratio, lint_frame } from '../src/ext/lint';
import { describe_scene, describe_text } from '../src/ext/describe';

const { Scene, Circle, Square, Line, Dot, ValueTracker, ManimColor } = M as any;

describe('constraints', () => {
  it('project onto segments, circles and grids', () => {
    expect(constrain.on_segment([0, 0, 0], [4, 0, 0])([2, 3, 0])).toEqual([2, 0, 0]);
    expect(constrain.on_segment([0, 0, 0], [4, 0, 0])([9, 1, 0])).toEqual([4, 0, 0]);
    const c = constrain.on_circle([0, 0, 0], 2)([0, 5, 0]);
    expect(c[0]).toBeCloseTo(0);
    expect(c[1]).toBeCloseTo(2);
    expect(constrain.snap(0.5)([0.26, 0.74, 0])).toEqual([0.5, 0.5, 0]);
    expect(constrain.all(constrain.in_box(-1, 1, -1, 1), constrain.snap(1))([3, 0.4, 0])).toEqual([1, 0, 0]);
  });
});

describe('linter', () => {
  it('flags objects outside the frame', () => {
    const s = new Scene();
    s.add(Circle().shift([9, 0, 0]), Square().shift([6.5, 0, 0]), Dot());
    const rules = lint_frame(s).map((i) => i.rule + ':' + i.severity);
    expect(rules).toContain('off-frame:error');
    expect(rules).toContain('off-frame:warning');
    expect(lint_frame(s).length).toBe(2);
  });
  it('contrast ratio follows WCAG', () => {
    expect(contrast_ratio(ManimColor.parse('#000000'), ManimColor.parse('#FFFFFF'))).toBeCloseTo(21, 0);
    expect(contrast_ratio(ManimColor.parse('#777777'), ManimColor.parse('#FFFFFF'))).toBeGreaterThan(4.4);
  });
});

describe('scene description', () => {
  it('lists objects with positions and tracker values', () => {
    const s = new Scene();
    const t = ValueTracker(3.5);
    t.name = 'k';
    const c = Circle({ radius: 1 }).shift([2, 1, 0]);
    s.add(t, c, Line([-3, -2, 0], [-1, -2, 0]));
    const d = describe_scene(s);
    expect(d.trackers).toEqual([{ id: 'k', value: 3.5 }]);
    expect(d.objects[0]).toMatchObject({ type: 'Circle', center: [2, 1], size: [2, 2] });
    expect(describe_text(s)).toMatch(/Circle .* at \(2, 1\)/);
    expect(describe_text(s)).toMatch(/Parameters: k = 3.5/);
  });
});
