// TeX / SVG / numbers vs real manim whose tex_to_svg_file is replaced by the
// same MathJax adapter (see tools/golden_examples.py): reference values were
// computed with the manim venv (width, height, center x, center y).
import { beforeAll, describe, expect, it } from 'vitest';
import * as M from '../src/index';

const { MathTex, Tex, DecimalNumber, Integer, BulletedList, Title, Brace, BraceBetweenPoints, ArcBrace, Arc, Square, Variable, RED, DOWN, LEFT, RIGHT, UP } = M;

const box = (m: any) => [m.width, m.height, ...m.get_center().slice(0, 2)];
const close = (a: number[], b: number[], tol = 1e-4) => {
  expect(a.length).toBe(b.length);
  a.forEach((x, i) => expect(Math.abs(x - b[i]), `component ${i}: ${x} vs ${b[i]}`).toBeLessThan(tol));
};

beforeAll(async () => {
  await M.init_tex();
});

describe('MathTex / Tex', () => {
  it('sizes like manim (font_size 48)', () => {
    const m = MathTex('x^2');
    close(box(m), [0.44372, 0.44743, 0, 0]);
    expect(m.get(0).length).toBe(2);
    expect(m.font_size).toBeCloseTo(48, 9);
    close(box(Tex('Hello World')), [2.64565, 0.358333, 0, 0]);
    close(box(MathTex('\\int_a^b f(x)\\,dx', { font_size: 72 })), [3.4653, 1.861672, 0, 0]);
    close(box(MathTex('a &= b \\\\ c &= d')), [1.1763, 1.103167, 0, 0]);
    close(box(MathTex('\\left( \\frac{1}{2} \\right)')), [0.997167, 1.1995, 0, 0]);
    close(box(Tex('$x$-values')), [1.7675, 0.352833, 0, 0]);
  });

  it('splits parts at {{ }} and keeps their positions', () => {
    const m = MathTex('{{x}}^2', '+', '{{y}}^2', '=', '{{z}}^2');
    const ref: [string, number, number[]][] = [
      ['x', 1, [0.2435, 0.2265, -1.196135, -0.061965]], ['^2', 1, [0.141045, 0.23543, -0.944688, 0.1545]],
      ['+', 1, [0.333, 0.3325, -0.525485, -0.044465]], ['y', 1, [0.237833, 0.323833, -0.090635, -0.110465]],
      ['^2', 1, [0.141045, 0.23543, 0.129813, 0.1545]], ['=', 1, [0.333, 0.117, 0.576765, -0.044715]],
      ['z', 1, [0.2165, 0.2265, 1.035915, -0.061965]], ['^2', 1, [0.141045, 0.23543, 1.247362, 0.1545]],
    ];
    expect(m.length).toBe(ref.length);
    ref.forEach(([tex, n, b], i) => {
      expect(m.get(i).tex_string).toBe(tex);
      expect(m.get(i).length).toBe(n);
      close(box(m.get(i)), b);
    });
    expect(m.tex_string).toBe('x ^2 + y ^2 = z ^2');
    expect(m.index_of_part(m.get(3))).toBe(3);
    expect(m.get_part_by_tex('y')!.submobjects[0]).toBe(m.get(3).submobjects[0]);
  });

  it('colours by tex_to_color_map and substrings_to_isolate', () => {
    const m = MathTex('a', 'b', 'c', { tex_to_color_map: { b: RED } });
    expect(m.family_members_with_points().map((s: any) => s.get_color().to_hex())).toEqual(['#FFFFFF', '#FC6255', '#FFFFFF']);
    const e = MathTex('e^{i\\pi} + 1 = 0', { substrings_to_isolate: ['i', '\\pi'] });
    close(box(e), [2.3365, 0.481165, 0, 0]);
    e.set_color_by_tex('\\pi', RED);
    expect(e.get_part_by_tex('\\pi')!.get_color().to_hex()).toBe('#FC6255');
  });

  it('BulletedList and Title', () => {
    const b = BulletedList('Item 1', 'Item 2');
    close(box(b), [1.61515, 1.194, 0, 0]);
    close(box(b.get(0)), [1.60415, 0.347, -0.0055, 0.4235]);
    close(box(b.get(1)), [1.61515, 0.347, 0, -0.4235]);
    const t = Title('A Title');
    close(box(t), [12.222222, 0.6135, 0, 3.19325]);
    close(box(t.get(0)), [1.56665, 0.3635, 0, 3.31825]);
  });
});

describe('numbers', () => {
  it('DecimalNumber layout', () => {
    const d = DecimalNumber(-3.14159, { num_decimal_places: 3 });
    close(box(d), [1.406, 0.3435, 0, 0]);
    expect(d.length).toBe(6);
    const ref = [[0.305, 0.02, -0.5505, -0.01], [0.2075, 0.3435, -0.24625, 0], [0.0605, 0.06, -0.06425, -0.14175], [0.172, 0.333, 0.1, -0.00525], [0.2215, 0.3385, 0.34475, -0.0025], [0.1995, 0.333, 0.60325, -0.00525]];
    ref.forEach((r, i) => close(box(d.get(i)), r));
    const n = Integer(1234567);
    close(box(n), [1.938, 0.42825, 0, -0.039458]);
    expect(n.length).toBe(9);
    d.set_value(2.5);
    expect(d.get_value()).toBe(2.5);
    expect(d.length).toBe(5);
  });
  it('Variable', () => {
    const v = Variable(2.5, 'x');
    close(box(v), [1.8905, 0.344, 0.8235, 0]);
    close(box(v.label), [0.8265, 0.2265, 0.2915, 0]);
    close(box(v.value), [0.814, 0.344, 1.36175, 0]);
  });
});

describe('Brace', () => {
  it('matches manim', () => {
    const br = Brace(Square(), DOWN);
    close(box(br), [2.0, 0.272985, 0, -1.336492]);
    close(br.get_tip(), [0, -1.472985, 0]);
    expect(br.points.length / 3).toBe(100);
    close(box(BraceBetweenPoints(LEFT, [1, 1, 0])), [2.033318, 1.112495, 0.096829, 0.271144]);
    close(box(ArcBrace(Arc({ radius: 2, start_angle: 0.2, angle: 1.5 }))), [2.618321, 1.992581, 1.017497, 1.418974]);
    expect(RIGHT[0] + UP[1]).toBe(2);
  });
});

describe('SVGMobject', () => {
  it('parses shapes, transforms, groups and styles like svgelements', () => {
    const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='20pt' height='10pt' viewBox='5 -8 20 10'>
      <g id='unique000'><path d='M0 0L10 0L10 5Z' transform='matrix(1 0 0 -1 2 3)'/></g>
      <rect x='1' y='2' width='3' height='0.4' fill='#ff0000'/>
      <path d='M0 0 L1 1' stroke='blue' stroke-width='2' fill='none'/></svg>`;
    const m = M.SVGMobject({ svg_string: svg, height: null, should_center: false });
    expect(m.submobjects.length).toBe(3);
    expect(Object.keys(m.id_to_vgroup_dict)).toEqual(['root', 'numbered_group_0', 'numbered_group_1', 'numbered_group_2', 'unique000', 'numbered_group_3', 'numbered_group_4', 'numbered_group_5']);
    expect(m.get(0).get_fill_color().to_hex()).toBe('#000000');
    expect(m.get(1).get_fill_color().to_hex()).toBe('#FF0000');
    expect(m.get(2).get_stroke_color().to_hex()).toBe('#0000FF');
    expect(m.get(2).stroke_width).toBe(2);
    expect(m.get(2).get_fill_opacity()).toBe(0);
    // manim: first points [2, -2], [5.333, -2] (flipped about the centre)
    close(m.get(0).points.slice(0, 6) as any, [2, -2, 0, 16 / 3, -2, 0], 1e-9);
    close(m.get(1).points.slice(0, 3) as any, [4, -1.4, 0], 1e-9);
  });

  it('handles use/defs, CSS, shapes, arcs and unreifiable transforms (file or registered text)', () => {
    const svg = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE svg PUBLIC "-//W3C//DTD SVG 1.1//EN" "http://www.w3.org/Graphics/SVG/1.1/DTD/svg11.dtd">
<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="200" height="100" viewBox="0 0 200 100" fill="#336699">
  <style>.hot { fill: #ff8800; stroke: #000000; stroke-width: 3 } #special { fill-opacity: 0.5 }</style>
  <defs><path id="tri" d="M0,0 l10,0 l-5,-8 z"/></defs>
  <g transform="translate(10 20) scale(2)">
    <use xlink:href="#tri" x="5" y="5"/>
    <circle cx="30" cy="10" r="6" class="hot"/>
    <ellipse cx="50" cy="10" rx="8" ry="4" style="fill:rgb(10,200,30);stroke:none"/>
  </g>
  <polygon points="120,10 140,10 130,30" id="special"/>
  <polyline points="150,10 160,30 170,10" fill="none" stroke="red" stroke-width="2"/>
  <line x1="10" y1="90" x2="60" y2="80" stroke="blue"/>
  <rect x="80" y="60" width="30" height="20" rx="4" transform="rotate(10)"/>
  <path d="M150 60 a20 10 30 1 0 30 20 Q 190 90 170 95 T 150 95 s -10 -5 0 -10 h5 v-5 H150 V60 C 160 55, 170 55, 175 60Z"/>
</svg>`;
    // reference: real manim (svgelements) on the same file
    const ref: [string, number, number[], string | null, number, number, string][] = [
      ['VMobjectFromSVGPath', 12, [0.45283, 0.362264, -1.471698, 0.715374], '#336699', 1.0, 0.0, '#FFFFFF'],
      ['Circle', 32, [0.543396, 0.543396, -0.566038, 0.307826], '#FF8800', 1.0, 6.0, '#000000'],
      ['Circle', 32, [0.724528, 0.362264, 0.339623, 0.307826], '#0AC81E', 1.0, 0.0, '#FC6255'],
      ['Polygon', 12, [0.45283, 0.45283, 0.792453, 0.760657], '#336699', 0.502, 0.0, '#58C4DD'],
      ['VMobject', 8, [0.45283, 0.45283, 1.471698, 0.760657], null, 0.0, 2.0, '#FF0000'],
      ['Line', 4, [1.132075, 0.226415, -1.358491, -0.711042], '#336699', 1.0, 0.0, '#0000FF'],
      ['RoundedRectangle', 32, [0.733477, 0.549818, -0.307894, -0.720848], '#336699', 1.0, 0.0, '#FFFFFF'],
      ['VMobjectFromSVGPath', 64, [1.056604, 0.981132, 1.52387, -0.54123], '#336699', 1.0, 0.0, '#FFFFFF'],
    ];
    const fs = (globalThis as any).process.getBuiltinModule('fs');
    const os = (globalThis as any).process.getBuiltinModule('os');
    const file = `${os.tmpdir()}/manim_web_rich_test.svg`;
    fs.writeFileSync(file, svg);
    M.register_svg_file('rich_registered.svg', svg);
    for (const m of [M.SVGMobject(file), M.SVGMobject('rich_registered')]) {
      close(box(m), [4, 2, 0, 0]);
      expect(m.submobjects.length).toBe(ref.length);
      ref.forEach(([cls, n, b, fill, fo, sw, stroke], i) => {
        const s = m.get(i);
        expect(s.constructor.name).toBe(cls);
        expect(s.points.length / 3).toBe(n);
        close(box(s), b);
        expect(s.get_fill_opacity() ? s.get_fill_color().to_hex() : null).toBe(fill);
        expect(s.get_fill_opacity()).toBeCloseTo(fo, 3);
        expect(s.stroke_width).toBeCloseTo(sw, 9);
        expect(s.get_stroke_color().to_hex()).toBe(stroke);
      });
      expect(Object.keys(m.id_to_vgroup_dict)).toContain('tri');
      // like manim, a shape joins its ancestors' groups, not its own
      expect(m.id_to_vgroup_dict.special.submobjects.length).toBe(0);
      expect(m.id_to_vgroup_dict.root.submobjects[3]).toBe(m.get(3));
    }
    fs.unlinkSync(file);
  });
});
