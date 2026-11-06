// Nouns in formulas: a derivation's symbols drawn in the colour of the noun they name (as in the figure beside it and
// in the sentence around it), found in every line by their tokens, and named for the mirror and the tutor.
import { beforeAll, describe, expect, it } from 'vitest';
import { createCanvas } from '@napi-rs/canvas';
import { look, text_color_of } from '@mathnim/look';
import { Figure, Steps, column, load_tex, parse_nouns, parse_steps, review_steps } from '../src/index';
import { use_node_canvas } from '../node';

beforeAll(async () => {
  use_node_canvas();
  await load_tex();
});

const hex = (c: string) => [1, 3, 5].map((i) => parseInt(c.slice(i, i + 2), 16));
/** How many pixels of the drawn line are (close to) a colour. */
function count_of(src: string, nouns: Record<string, string> | undefined, colour: string, line = 0) {
  const st = new Steps(src, { id: 's', why: false, nouns });
  const fig = new Figure({ lang: 'en' });
  fig.layout(column([st]));
  fig.build();
  const size = fig.layout_for(560, undefined), W = 560, H = Math.ceil(size.h);
  st.at.set(line, true);
  const c = createCanvas(W, H);
  fig.draw(c.getContext('2d') as never, 1, { force: true });
  const d = c.getContext('2d').getImageData(0, 0, W, H).data, [r, g, b] = hex(colour);
  let n = 0;
  for (let i = 0; i < d.length; i += 4) if (Math.abs(d[i] - r) + Math.abs(d[i + 1] - g) + Math.abs(d[i + 2] - b) < 30) n++;
  return { n, st };
}

describe('nouns in formulas', () => {
  const value = text_color_of('noun:value', look()), fn = text_color_of('noun:function', look());
  it("a noun's symbol is drawn in its noun's colour; without nouns nothing is", () => {
    const src = 'y = f(x_0)\ny = f(2)';
    expect(count_of(src, undefined, value).n).toBe(0);
    expect(count_of(src, { x_0: 'value' }, value).n).toBeGreaterThan(20);
    expect(count_of(src, { f: 'function' }, fn).n).toBeGreaterThan(20);
  });
  it('x_0 is matched as x with the subscript 0, before x alone, and x alone is another noun', () => {
    const { st } = count_of('x + x_0 = 3', { x: 'function', x_0: 'value' }, value);
    const m = (st as unknown as { noun_of: Map<{ key: string }, string>[] }).noun_of[0];
    const keys = [...m.entries()].map(([t, n]) => `${t.key}:${n}`);
    expect(keys.sort()).toEqual(['0:value', 'x:function', 'x:value']);
  });
  it('a 0 that is not a subscript is not x_0\'s', () => {
    const { st } = count_of('x0 = x_0', { x_0: 'value' }, value);
    const m = (st as unknown as { noun_of: Map<{ key: string }, string>[] }).noun_of[0];
    expect(m.size).toBe(2);
  });
  it('the mirror names the noun where its symbol is', () => {
    const { st } = count_of('y = f(x_0)\ny = f(2)', { x_0: 'value' }, value);
    const parts = st.parts_of!('en');
    const named = parts.filter((p) => p.text === 'x_0 (value)');
    expect(named.length).toBe(2); // (its two tokens, x and 0)
    for (const p of named) expect(p.box.w).toBeGreaterThan(0);
  });
  it('a symbol in no line is reported', () => {
    const { st } = count_of('y = 2x\ny = 4', { z: 'value' }, value);
    expect(st.issues.join(' ')).toContain('in no line');
  });
  it('a block names its nouns in a line of its own: % nouns: x_0 = value, f = function', () => {
    expect(parse_nouns('x_0 = value, f = function')).toEqual({ x_0: 'value', f: 'function' });
    expect(parse_nouns('$x_0$: value；f → function')).toEqual({ x_0: 'value', f: 'function' });
    const p = parse_steps('% nouns: x_0 = value\ny = f(x_0) % write it\ny = f(2) % put the number in');
    expect(p.nouns).toEqual({ x_0: 'value' });
    expect(p.lines.length).toBe(2);
    expect(p.lines[1].why).toBe('put the number in');
    expect(review_steps('% 名词：x_0 = value\ny = x_0^2\ny = 4').nouns).toEqual({ x_0: 'value' });
  });
});
