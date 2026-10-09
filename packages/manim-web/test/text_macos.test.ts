// Text / MarkupText / Paragraph against real manim (Pango on macOS), using the
// same system fonts Pango used (Times, Helvetica, Menlo). Reference values were
// computed with the manim venv (manim 0.21, manimpango 0.6.1, Pango 1.56).
import fs from 'node:fs';
import { beforeAll, describe, expect, it } from 'vitest';
import { load_fonts } from '../src/ext/text/fonts';
import { MarkupText, Paragraph, Text } from '../src/mobject/text/text_mobject';
import { BLUE, GREEN, RED } from '../src/utils/color/manim_colors';

const HAVE_MAC_FONTS = fs.existsSync('/System/Library/Fonts/Times.ttc') && fs.existsSync('/System/Library/Fonts/Helvetica.ttc');

describe.skipIf(!HAVE_MAC_FONTS)('Text vs manim (macOS system fonts)', () => {
  beforeAll(async () => {
    await load_fonts({ system_fonts: true });
  });
  const cases: [string, () => any, number, number, number][] = [
    // name, factory, width, height, len
    ['Hello', () => new Text('Hello', { font_size: 48 }), 1.50234, 0.46719, 5],
    ['Hello world', () => new Text('Hello world'), 3.26641, 0.46719, 10],
    ['kerning + fi ligature', () => new Text('AVAWAY To, fifth'), 4.86484, 0.5502, 13],
    ['multi-line', () => new Text('Hello\nworld  x\n\nZ'), 2.21484, 2.40703, 12],
    ['t2c', () => new Text('Hello world', { t2c: { world: RED, '[1:3]': BLUE } }), 3.26641, 0.46719, 10],
    ['bold', () => new Text('Hello world', { weight: 'BOLD' }), 3.39336, 0.46074, 10],
    ['italic', () => new Text('Hello world', { slant: 'ITALIC' }), 3.30723, 0.46328, 10],
    ['sans-serif', () => new Text('Label Text', { font: 'sans-serif' }), 2.91875, 0.49219, 9],
    ['monospace', () => new Text('Default (YELLOW)', { font: 'monospace', font_size: 20 }), 2.34082, 0.24746, 15],
    ['disable_ligatures', () => new Text('fifth flow', { disable_ligatures: true }), 2.4998, 0.46719, 10],
    ['gradient', () => new Text('Hello', { gradient: [BLUE, GREEN] }), 1.50234, 0.46719, 5],
    ['markup b/i', () => new MarkupText('<b>foo</b> <i>bar</i> <b><i>foobar</i></b>'), 4.02012, 0.60352, 12],
    ['markup s/u/big/small', () => new MarkupText('<s>foo</s> <u>bar</u> <big>big</big> <small>small</small>'), 4.37969, 0.71953, 16],
    ['markup sub/sup', () => new MarkupText('H<sub>2</sub>O and H<sub>3</sub>O<sup>+</sup>'), 3.60645, 0.50474, 10],
    ['markup double/error underline', () => new MarkupText('<span underline="double">foo</span> <span underline="error">bar</span>'), 1.94941, 0.6041, 9],
    ['markup newline', () => new MarkupText('foooo<span foreground="red">oo\nbaa</span>aar'), 2.26074, 1.12798, 13],
    ['markup tt', () => new MarkupText('type <tt>help</tt> for help'), 5.15488, 0.6543, 15],
    ['Paragraph right', () => new Paragraph('one line', 'two lines here', { alignment: 'right' }), 3.77246, 1.11719, 2],
  ];
  for (const [name, make, w, h, n] of cases) {
    it(name, () => {
      const m = make();
      expect(m.width).toBeCloseTo(w, 4);
      expect(m.height).toBeCloseTo(h, 4);
      expect(m.length).toBe(n);
    });
  }
  it('glyph points and positions match manim', () => {
    const t = new Text('Hello');
    expect(t.submobjects.map((s: any) => s.points.length / 3)).toEqual([148, 84, 72, 72, 72]);
    const centers = [-0.5236328, -0.1150391, 0.1297852, 0.3297852, 0.603125];
    t.submobjects.forEach((s: any, i: number) => expect(s.get_center()[0]).toBeCloseTo(centers[i], 5));
    expect(t.submobjects[0].points[0]).toBeCloseTo(-0.75117188, 5); // 'H' starts at its first on-curve point
    expect(t.font_size).toBeCloseTo(48, 10);
  });
  it('MarkupText colours and decorations', () => {
    const m = new MarkupText('<span underline="double" underline_color="green">bla</span>');
    expect(m.submobjects.length).toBe(5);
    expect(m.submobjects[3].get_fill_color().to_hex()).toBe('#008000'); // Pango parses CSS colour names
    expect(m.submobjects[3].width).toBeCloseTo(0.85, 4);
    expect(m.submobjects[3].get_center()[1]).toBeCloseTo(-0.2866, 4);
  });
});
