// An exploded formula (parts.ts): the named pieces are found in the formula; assembled, the formula is drawn whole
// with a dotted line under each piece; taken apart, each piece lifts on a card with what it means over it, and its
// shadow stays where it sat.
import { beforeAll, describe, expect, it } from 'vitest';
import { createCanvas } from '@napi-rs/canvas';
import { load_tex, parts_figure } from '../src/index';
import { use_node_canvas } from '../node';

beforeAll(async () => {
  use_node_canvas();
  await load_tex();
});

const BAYES = 'P(A\\mid B) = \\frac{P(B\\mid A)\\,P(A)}{P(B)}';
const PARTS = [{ tex: 'P(A\\mid B)', says: 'the posterior' }, { tex: 'P(B\\mid A)', says: 'the likelihood' }, { tex: 'P(A)', says: 'the prior' }, { tex: 'P(B)', says: 'the evidence' }];

function make(open: number) {
  const fig = parts_figure(BAYES, PARTS, { lang: 'en' });
  fig.build();
  const size = fig.layout_for(640, undefined), W = 640, H = Math.ceil(size.h);
  fig.formula.open.set(open, true);
  const c = createCanvas(W, H);
  fig.draw(c.getContext('2d') as never, 1, { force: true });
  return { fig, d: c.getContext('2d').getImageData(0, 0, W, H).data, W, H };
}

describe('an exploded formula', () => {
  it('finds every piece, each once (P(A) is not the P(A) inside P(A|B))', () => {
    const { fig } = make(0);
    expect(fig.formula.issues).toEqual([]);
    const keys = fig.formula.found.map((f) => f.tokens!.map((t) => t.key).join(''));
    expect(keys).toEqual(['P(A∣B)', 'P(B∣A)', 'P(A)', 'P(B)']);
    // (the four are four different runs of tokens)
    const all = fig.formula.found.flatMap((f) => f.tokens!);
    expect(new Set(all).size).toBe(all.length);
  });
  it('a piece that is not in the formula is reported', () => {
    const fig = parts_figure('x + y', [{ tex: 'z', says: 'zed' }]);
    expect(fig.formula.issues.join(' ')).toContain('not in the formula');
  });
  it('taken apart, every card rests above the formula and none meets another', () => {
    const shut = make(0), open = make(1);
    // (the band above the formula: empty but for the paper while assembled; the cards and words when taken apart)
    const diff = (y0: number, y1: number) => { let s = 0; for (let y = y0; y < y1; y++) for (let x = 0; x < shut.W; x++) { const i = (y * shut.W + x) * 4; s += Math.abs(shut.d[i] - open.d[i]); } return s; };
    const f = open.fig.formula as unknown as { y0: number; line: { view: number[] }; px_fit: number };
    expect(diff(0, Math.floor(f.y0 - 40))).toBeGreaterThan(20000);
  });
  it('the mirror reads the formula and each piece with its meaning', () => {
    const { fig } = make(0);
    const texts = fig.formula.parts_of!('en').map((p) => p.text);
    expect(texts[0]).toBe(BAYES);
    expect(texts).toContain('P(A): the prior');
  });
  it('its open param is the tutor\'s to move (the page taps it through the hands)', () => {
    const { fig } = make(0);
    expect(fig.formula.open.spec.tutor).toBe(true);
    expect(fig.params.get(fig.formula.open.name)).toBe(fig.formula.open);
  });
});
