import { describe, expect, it } from 'vitest';
import { merge_recordings, narration_key, speakable_markup, to_spoken, tts_parts } from '../../../packages/core/src/narration';

describe('to_spoken', () => {
  // expected values produced by to_spoken() in tools/gen_narration.py
  const cases: [string, string][] = [
    ['The pole is 9 m tall.', 'The pole is 9 meters tall.'],
    ['AB = 2.5m, and CD is 3 m.', 'A-B = 2.5 meters, and C-D is 3 meters.'],
    ['θ ≈ 45°', 'theta about 45 degrees'],
    ['Area is 9 m² here', 'Area is 9 m squared here'],
    ["The USA's ABCD team", "The U-S-A's ABCD team"],
    ['x29 m', 'x29 meters'],
    ['½ × r²  −  √2 · π', 'half times r squared minus root 2 times π'],
    ['∠APB is 90°.', 'angle A-P-B is 90 degrees.'],
    ['A 12.75 meter pole', 'A 12.75 meter pole'],
    ['Go 5 min', 'Go 5 min'],
    ['OK then', 'O-K then'],
  ];
  it.each(cases)('%s', (text, spoken) => expect(to_spoken(text)).toBe(spoken));
});

describe('caption markup', () => {
  it('reads TeX and drops emphasis', () => {
    expect(to_spoken('So $A = \\pi r^2$, **not** $2\\pi r$.')).toBe('So A = pi r squared , not 2 pi r .');
    expect(to_spoken('$\\frac{1}{2} \\cdot b \\cdot h$')).toBe('1 over 2 times b times h');
    expect(to_spoken('The angle is $45^\\circ$ and $\\angle APB \\le 90^{\\circ}$.')).toBe('The angle is 45 degrees and angle A-P-B less than or equal to 90 degrees .');
    expect(to_spoken('$x_1^{n+1}$ and $\\sqrt{2}$')).toBe('x 1 to the power n+1 and root 2');
  });
  it('leaves plain text alone', () => {
    for (const t of ['A 12.75 meter pole', '2 * 3 * 4 = 24', 'It costs 5 dollars']) expect(speakable_markup(t)).toBe(t);
  });
});

describe('tts_parts', () => {
  it('keeps a short line whole', () => expect(tts_parts('One sentence.')).toEqual(['One sentence.']));
  it('packs sentences up to the limit', () => {
    const s = 'First sentence here. Second one is here. Third.';
    expect(tts_parts(s, 39)).toEqual(['First sentence here.', 'Second one is here. Third.']);
    for (const p of tts_parts(s, 39)) expect(p.length).toBeLessThanOrEqual(39);
  });
  it('splits a long sentence at commas, then words', () => {
    const s = 'alpha beta gamma delta, epsilon zeta eta theta, iota kappa lambda mu nu xi omicron pi rho';
    const parts = tts_parts(s, 30);
    for (const p of parts) expect(p.length).toBeLessThanOrEqual(30);
    expect(parts.join(' ')).toBe(s);
  });
});

describe('merge_recordings', () => {
  it('shifts words by the audio length of the parts before', () => {
    const r = merge_recordings('a b', [
      { words: [[0.1, 0.4, 'a']], audio_duration: 1.2 },
      { words: [[0.05, 0.3, 'b']], audio_duration: 0.8 },
    ]);
    expect(r).toEqual({ text: 'a b', duration: 2, words: [[0.1, 0.4, 'a'], [1.25, 1.5, 'b']] });
  });
});

it('narration_key is stable (matches the recorded files)', () => {
  expect(narration_key('hello')).toBe('a430d84680aabd0b');
});
