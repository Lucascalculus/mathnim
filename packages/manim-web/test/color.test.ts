import { describe, expect, it } from 'vitest';
import { ManimColor } from '../src/utils/color/core';
import { BLUE, YELLOW } from '../src/utils/color/manim_colors';

describe('ManimColor', () => {
  it('parses hex strings of every length', () => {
    expect(BLUE.to_hex()).toBe('#58C4DD');
    expect(YELLOW.to_hex()).toBe('#F7D96F');
    expect(new ManimColor('#abc').to_hex()).toBe('#AABBCC');
    expect(new ManimColor('#11223380').to_hex(true)).toBe('#11223380');
    expect(new ManimColor('0xFF0000').to_hex()).toBe('#FF0000');
  });
});
