// Text / MarkupText / Paragraph / Code with the bundled open fonts (what the
// browser uses): Tinos / Arimo / DejaVu Sans Mono stand in for Times /
// Helvetica / Menlo and share their advance widths, so sizes stay close to
// manim's (exact comparisons with the macOS fonts are in text_macos.test.ts).
import { beforeAll, describe, expect, it } from 'vitest';
import { list_fonts, load_fonts, resolve_font } from '../src/ext/text/fonts';
import { get_style_by_name, lex_python, style_color } from '../src/ext/text/highlight';
import { parse_markup, pango_color } from '../src/ext/text/markup';
import { Code } from '../src/mobject/text/code_mobject';
import { MarkupText, Paragraph, Text } from '../src/mobject/text/text_mobject';
import { Dot } from '../src/mobject/geometry/arc';

beforeAll(async () => {
  await load_fonts();
});

describe('bundled fonts', () => {
  it('generic families resolve to the bundled faces', () => {
    expect(resolve_font('', 400, 'normal').faces[0].family).toBe('Tinos');
    expect(resolve_font('sans-serif', 700, 'normal').faces[0].family).toBe('Arimo');
    expect(resolve_font('sans-serif', 700, 'normal').faces[0].weight).toBe(700);
    expect(resolve_font('Monospace', 400, 'normal').faces[0].family).toBe('DejaVu Sans Mono');
    expect(resolve_font('serif', 400, 'italic').faces[0].style).toBe('italic');
    expect(list_fonts()).toContain('Tinos');
  });
  it('Text sizes are close to manim (Times metrics)', () => {
    const t = new Text('Hello', { font_size: 48 });
    expect(t.length).toBe(5);
    expect(t.width).toBeCloseTo(1.50234, 1); // manim (Times): 1.50234 x 0.46719
    expect(t.height).toBeCloseTo(0.46719, 1);
    expect(t.font_size).toBeCloseTo(48, 10);
    t.font_size = 24;
    expect(t.font_size).toBeCloseTo(24, 10);
    expect(t.get_center()[0]).toBeCloseTo(0, 10);
  });
  it('indexing skips spaces; text/original_text/chars', () => {
    const t = new Text('Hello world');
    expect(t.length).toBe(10);
    expect(t.text).toBe('Helloworld');
    expect(t.original_text).toBe('Hello world');
    expect(t.chars.length).toBe(10);
    expect(t.get(5).get_center()[0]).toBeGreaterThan(t.get(4).get_center()[0]);
    const nl = new Text('Hello world', { disable_ligatures: true });
    expect(nl.length).toBe(11);
    expect(nl.get(5)).toBeInstanceOf(Dot);
  });
  it('t2c / gradient / colour', () => {
    const t = new Text('Hello world', { t2c: { world: '#FF0000' }, color: '#00FF00' });
    expect(t.get(0).get_fill_color().to_hex()).toBe('#00FF00');
    expect(t.get(5).get_fill_color().to_hex()).toBe('#FF0000');
    const g = new Text('abc', { gradient: ['#0000FF', '#FF0000'] });
    expect(g.get(0).get_fill_color().to_hex()).toBe('#0000FF');
    expect(g.get(2).get_fill_color().to_hex()).toBe('#FF0000');
    expect(t.get_color().to_hex()).toBe('#000000'); // like manim: the SVGMobject parent is black
  });
  it('multi-line Text uses line_spacing', () => {
    const a = new Text('A\nA');
    const b = new Text('A\nA', { line_spacing: 1 });
    expect(a.get(0).get_center()[1] - a.get(1).get_center()[1]).toBeCloseTo(0.65, 6); // 1.3 * 48 / 4.8 px * 0.05
    expect(b.get(0).get_center()[1] - b.get(1).get_center()[1]).toBeCloseTo(1.0, 6);
  });
  it('Paragraph lines and alignment', () => {
    const p = new Paragraph('short', 'a longer line', { alignment: 'left' });
    expect(p.length).toBe(2);
    expect(p.get(0).length).toBe(5);
    expect(p.get(1).length).toBe(11);
    expect(p.get(0).get_left()[0]).toBeCloseTo(p.get(1).get_left()[0], 6);
    const r = new Paragraph('short', 'a longer line', { alignment: 'right' });
    expect(r.get(0).get_right()[0]).toBeCloseTo(r.get(1).get_right()[0], 6);
  });
  it('MarkupText tags, colours and gradients', () => {
    const m = new MarkupText('<span foreground="red">ab</span><b>c</b>');
    expect(m.length).toBe(3);
    expect(m.get(0).get_fill_color().to_hex()).toBe('#FF0000');
    const u = new MarkupText('<u>ab</u>');
    expect(u.length).toBe(3); // two glyphs + the underline
    const g = new MarkupText('x<gradient from="#0000FF" to="#FF0000">abc</gradient>');
    expect(g.get(1).get_fill_color().to_hex()).toBe('#0000FF');
    expect(g.get(3).get_fill_color().to_hex()).toBe('#FF0000');
    expect(() => new MarkupText('<b>unclosed')).toThrow();
  });
  it('missing fonts fall back with a warning', () => {
    const t = new Text('abc', { font: 'No Such Font' });
    expect(t.length).toBe(3);
  });
});

describe('markup parser', () => {
  it('parses nested tags and entities', () => {
    const { text, spans } = parse_markup('a<b>b<i>c</i></b>&lt;&amp;&#65;');
    expect(text).toBe('abc<&A');
    expect(spans).toEqual([{ start: 1, end: 3, attrs: { weight: 700 } }, { start: 2, end: 3, attrs: { style: 'italic' } }]);
  });
  it('span attributes', () => {
    const { spans } = parse_markup('<span font_family="sans" size="x-large" underline="double" rise="1024" fgcolor="#f00">x</span>');
    expect(spans[0].attrs).toEqual({ family: 'sans', scale_abs: 1.44, underline: 'double', rise: 1024, color: '#ff0000' });
    expect(pango_color('green')).toBe('#008000');
    expect(() => parse_markup('<foo>x</foo>')).toThrow(/Unknown tag/);
  });
});

describe('Code', () => {
  it('lexes python like pygments', () => {
    const toks = lex_python('from manim import Scene\nclass A(Scene):\n    def f(self): return 1.5  # c');
    const find = (v: string) => toks.find((t) => t[1] === v)?.[0];
    expect(find('from')).toBe('Keyword.Namespace');
    expect(find('manim')).toBe('Name.Namespace');
    expect(find('class')).toBe('Keyword');
    expect(find('A')).toBe('Name.Class');
    expect(find('f')).toBe('Name.Function');
    expect(find('self')).toBe('Name.Builtin.Pseudo');
    expect(find('1.5')).toBe('Literal.Number.Float');
    expect(find('# c')).toBe('Comment.Single');
    const vim = get_style_by_name('vim');
    expect(style_color(vim, 'Keyword.Namespace')).toBe('#cd00cd');
    expect(style_color(vim, 'Name.Builtin.Pseudo')).toBe('#cd00cd');
    expect(style_color(vim, 'Punctuation')).toBe('#cccccc');
  });
  it('builds code lines, line numbers and a window background', () => {
    const c = new Code({ code_string: 'def f(x):\n    return x', language: 'python', background: 'window' });
    expect(c.code_lines.length).toBe(2);
    expect(c.code_lines.get(0).length).toBe(8); // 'def f(x):' without the space Dot
    expect(c.code_lines.get(0).get(0).get_fill_color().to_hex()).toBe('#CDCD00'); // 'd' of def (vim keyword)
    expect(c.line_numbers.length).toBe(2);
    expect(c.submobjects[0]).toBe(c.background);
    expect(c.background.submobjects.length).toBe(1); // the three window buttons
  });
});
