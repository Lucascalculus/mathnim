// Formula steps (steps.ts) and their checks (steps_check.ts): the lines as people and models write them, the tokens of
// formulas from many subjects, how one line becomes the next, the picture (exact at rest, continuous between), what the
// checks catch, generated derivations with one line broken, and a corpus of answers written the way the tutor writes.
import { describe, expect, it, beforeAll } from 'vitest';
import { createCanvas } from '@napi-rs/canvas';
import { Figure, Marker, Path, beat, column, draw_tex, load_tex, match_lines, parse_expr, parse_steps, review_steps, reveal, row, set, check_steps, split_relation, steps_blocks, steps_figure, substituted, together, typeset_line, wait, Steps } from '../src/index';
import { use_node_canvas, lint_figure } from '../node';

beforeAll(async () => {
  use_node_canvas();
  await load_tex();
});

// ------------------------------------------------------------------ the lines, as written
describe('parse_steps: the lines as people and models write them', () => {
  const cases: [string, string, string[], (string | null)[]][] = [
    ['plain lines with % reasons', '2x + 3 = 11\n2x = 8 % subtract 3\nx = 4 % divide by 2', ['2x + 3 = 11', '2x = 8', 'x = 4'], [null, 'subtract 3', 'divide by 2']],
    ['a fenced block', '```steps\nx + 1 = 2\nx = 1\n```', ['x + 1 = 2', 'x = 1'], [null, null]],
    ['a chain of identities is the expression rewritten', '(2x-3)^2 = (2x-3)(2x-3)\n(2x-3)(2x-3) = 4x^2 - 6x - 6x + 9 % multiply out\n4x^2 - 6x - 6x + 9 = 4x^2 - 12x + 9 % collect', ['(2x-3)^2', '(2x-3)(2x-3)', '4x^2 - 6x - 6x + 9', '4x^2 - 12x + 9'], [null, null, 'multiply out', 'collect']],
    ['a condition after a comma goes into the words', '\\frac{(x-2)(x+2)}{x-2}\nx + 2, \\quad x \\neq 2 % cancel', ['\\frac{(x-2)(x+2)}{x-2}', 'x + 2'], [null, 'cancel (x ≠ 2)']],
    ['a unit after a number is not a reason', '\\text{收入} = 15 \\times 120\n\\text{收入} = 1800\\,\\text{元}', ['\\text{收入} = 15 \\times 120', '\\text{收入} = 1800\\,\\text{元}'], [null, null]],
    ['a word at the end of a formula is not a reason', '\\text{收入} = \\text{单价} \\times \\text{销量}\n\\text{收入} = 15 \\times 120', ['\\text{收入} = \\text{单价} \\times \\text{销量}', '\\text{收入} = 15 \\times 120'], [null, null]],
    ['a fenced block inside an answer', 'Here is how.\n```steps\nx + 1 = 2\nx = 1 % subtract 1\n```\nACT: point x', ['x + 1 = 2', 'x = 1'], [null, 'subtract 1']],
    ['dollars around each line', '$2x = 8$\n$x = 4$', ['2x = 8', 'x = 4'], [null, null]],
    ['words outside the dollars are the reason', '$2x = 8$\n$x = 4$ (divide both sides by 2)', ['2x = 8', 'x = 4'], [null, 'divide both sides by 2']],
    ['Chinese words after the formula', '$2x = 8$\n$x = 4$，两边同除以 2', ['2x = 8', 'x = 4'], [null, '两边同除以 2']],
    ['display brackets', '\\[2x = 8\\]\n\\[x = 4\\]', ['2x = 8', 'x = 4'], [null, null]],
    ['double dollars', '$$2x = 8$$\n$$x = 4$$', ['2x = 8', 'x = 4'], [null, null]],
    ['numbered list', '1. 2x + 3 = 11\n2. 2x = 8\n3. x = 4', ['2x + 3 = 11', '2x = 8', 'x = 4'], [null, null, null]],
    ['dash list', '- 2x = 8\n- x = 4', ['2x = 8', 'x = 4'], [null, null]],
    ['Step n:', 'Step 1: 2x = 8\nStep 2: x = 4', ['2x = 8', 'x = 4'], [null, null]],
    ['第n步', '第1步：2x = 8\n第2步：x = 4 % 两边除以 2', ['2x = 8', 'x = 4'], [null, '两边除以 2']],
    ['an aligned environment', '\\begin{aligned}\n2x + 3 &= 11 \\\\\n2x &= 8 \\\\\nx &= 4\n\\end{aligned}', ['2x + 3 = 11', '2x = 8', 'x = 4'], [null, null, null]],
    ['align* on one line', '\\begin{align*} 2x &= 8 \\\\ x &= 4 \\end{align*}', ['2x = 8', 'x = 4'], [null, null]],
    ['rows joined with \\\\ on one line', '2x = 8 \\\\ x = 4', ['2x = 8', 'x = 4'], [null, null]],
    ['continuation lines starting with =', '2x + 6 = 3x\n= 3x - 2x % no', ['2x + 6 = 3x', '2x + 6 = 3x - 2x'], [null, 'no']],
    ['an expression rewritten (=)', '(x+1)^2\n= (x+1)(x+1)\n= x^2 + 2x + 1', ['(x+1)^2', '(x+1)(x+1)', 'x^2 + 2x + 1'], [null, null, null]],
    ['aligned chain &=', '\\begin{aligned} (a+b)^2 &= (a+b)(a+b) \\\\ &= a^2 + 2ab + b^2 \\end{aligned}', ['(a+b)^2 = (a+b)(a+b)', '(a+b)^2 = a^2 + 2ab + b^2'], [null, null]],
    ['a trailing \\quad\\text{} reason', '2x = 8\nx = 4 \\quad \\text{(divide by 2)}', ['2x = 8', 'x = 4'], [null, 'divide by 2']],
    ['a leading ⇒', '2x = 8\n\\Rightarrow x = 4', ['2x = 8', 'x = 4'], [null, null]],
    ['a final full stop', '2x = 8.\nx = 4.', ['2x = 8', 'x = 4'], [null, null]],
    ['a reason on its own line', 'x + 1 = 3\nx = 2\n% subtract 1 from both sides', ['x + 1 = 3', 'x = 2'], [null, 'subtract 1 from both sides']],
    ['an escaped percent stays', '0.2 = 20\\%\n0.2 \\times 100 = 20', ['0.2 = 20\\%', '0.2 \\times 100 = 20'], [null, null]],
    ['a matrix keeps its rows', '\\begin{pmatrix}1 & 2 \\\\ 3 & 4\\end{pmatrix}^T\n\\begin{pmatrix}1 & 3 \\\\ 2 & 4\\end{pmatrix}', ['\\begin{pmatrix}1 & 2 \\\\ 3 & 4\\end{pmatrix}^T', '\\begin{pmatrix}1 & 3 \\\\ 2 & 4\\end{pmatrix}'], [null, null]],
    ['blank lines and spaces', '\n\n  2x = 8   \n\n   x = 4  % halve  \n\n', ['2x = 8', 'x = 4'], [null, 'halve']],
    ['tags and labels go', '2x = 8 \\tag{1}\nx = 4 \\nonumber', ['2x = 8', 'x = 4'], [null, null]],
    ['chemistry', '\\ce{H2 + O2 -> H2O}\n\\ce{2H2 + O2 -> 2H2O} % balance H, then O', ['\\ce{H2 + O2 -> H2O}', '\\ce{2H2 + O2 -> 2H2O}'], [null, 'balance H, then O']],
  ];
  for (const [name, src, tex, why] of cases)
    it(name, () => {
      const p = parse_steps(src);
      expect(p.lines.map((l) => l.tex)).toEqual(tex);
      expect(p.lines.map((l) => l.why)).toEqual(why);
    });
  it('says what is wrong with the text', () => {
    expect(parse_steps('x = 1').issues[0]).toMatch(/one line/);
    expect(parse_steps('').issues[0]).toMatch(/no lines/);
    expect(parse_steps('x = 1\nx = 1').issues[0]).toMatch(/same/);
    expect(parse_steps(Array.from({ length: 14 }, (_, i) => `x = ${i}`).join('\n')).lines).toHaveLength(10);
  });
  it('finds the blocks in an answer, and one still arriving', () => {
    const b = steps_blocks('Words.\n```steps\na = b\n```\nmore\n```steps\nc = d');
    expect(b.map((x) => [x.body.trim(), x.closed])).toEqual([['a = b', true], ['c = d', false]]);
  });
});

// ------------------------------------------------------------------ tokens
describe('typeset_line: tokens of formulas from many subjects', () => {
  const cases: [string, string, string[], number][] = [
    ['algebra', '2x + 3 = 11', ['2', 'x', '+', '3', '=', '11'], 4],
    ['a fraction', '\\frac{a}{b} = c', ['a', 'b', '▭mfrac', '=', 'c'], 3],
    ['a power and a root', '\\sqrt{x^2 + 1}', ['x', '2', '+', '1', '√', '▭msqrt'], -1],
    ['a function name is one token', '\\sin x + \\cos x', ['sin', 'x', '+', 'cos', 'x'], -1],
    ['calculus', '\\frac{d}{dx} x^3 = 3x^2', ['d', 'd', 'x', '▭mfrac', 'x', '3', '=', '3', 'x', '2'], 6],
    ['probability', 'P(A \\mid B) = 0.5', ['P', '(', 'A', '∣', 'B', ')', '=', '0.5'], 6],
    ['statistics', '\\bar{x} = \\frac{1}{n}\\sum x_i', ['x', '¯', '=', '1', 'n', '▭mfrac', '∑', 'x', 'i'], 2],
    ['chemistry', '\\ce{2H2 + O2 -> 2H2O}', ['2', 'H', '2', '+', 'O', '2', '⟶', '2', 'H', '2', 'O'], 6],
    ['logic', '\\neg(A \\land B) \\equiv \\neg A \\lor \\neg B', ['¬', '(', 'A', '∧', 'B', ')', '≡', '¬', 'A', '∨', '¬', 'B'], 6],
    ['units in words', '100\\,\\text{m} \\div 20\\,\\text{s} = 5\\,\\text{m/s}', ['100', 'm', '÷', '20', 's', '=', '5', 'm/s'], 5],
    ['an inequality', '-2x < 6', ['−', '2', 'x', '<', '6'], 3],
    ['a matrix', '\\begin{pmatrix}1 & 2\\\\3 & 4\\end{pmatrix}', ['(', '1', '2', '3', '4', ')'], -1],
    ['economics', 'Q_d = 100 - 2P', ['Q', 'd', '=', '100', '−', '2', 'P'], 2],
    ['Greek letters', '\\alpha + \\beta = \\pi', ['α', '+', 'β', '=', 'π'], 3],
    ['sets', 'A \\cup B \\subseteq C', ['A', '∪', 'B', '⊆', 'C'], 3],
    ['Chinese words', '\\text{利润} = \\text{收入} - \\text{成本}', ['利润', '=', '收入', '−', '成本'], 1],
  ];
  for (const [name, tex, keys, anchor] of cases)
    it(name, () => {
      const t = typeset_line(tex);
      expect(t.error).toBeNull();
      expect(t.tokens.map((x) => x.key)).toEqual(keys);
      expect(t.anchor).toBe(anchor);
    });
  it('a line that does not typeset says why, and draws nothing', () => {
    const t = typeset_line('\\frac{1}{');
    expect(t.error).toBeTruthy();
    expect(t.tokens).toHaveLength(0);
  });
});

// ------------------------------------------------------------------ matching
const roles = (a: string, b: string) => {
  const m = match_lines(typeset_line(a), typeset_line(b));
  const code = (r: string) => ({ keep: 'k', move: 'v', merge: 'm', cancel: 'c', appear: 'a' })[r];
  return `${m.from.map((f) => code(f.role)).join('')}>${m.to.map((t) => code(t.role)).join('')}${m.jump ? ' jump' : ''}`;
};
describe('match_lines: how one line becomes the next', () => {
  const cases: [string, string, string, string][] = [
    ['the same on both sides: −3 appears after +3', '2x + 3 = 11', '2x + 3 - 3 = 11 - 3', 'kkkkkk>kkkkaakkaa'],
    ['+3 − 3 cancels, 11 − 3 flows into 8', '2x + 3 - 3 = 11 - 3', '2x = 8', 'kkcccckmmm>kkkm'],
    ['divide: the 2 goes, 8 becomes 4', '2x = 8', 'x = 4', 'ckkm>kkm'],
    ['+3 travels over the = and becomes −3', '2x + 3 = 11', '2x = 11 - 3', 'kkvvkk>kkkkvv'],
    ['power rule: the exponent comes down, a new one appears', '\\frac{d}{dx}x^{3}', '3x^{2}', 'cccckv>vka'],
    ['a coefficient appears in a reaction', '\\ce{H2 + O2 -> H2O}', '\\ce{2H2 + O2 -> 2H2O}', 'kkkkkkkkk>akkkkkkakkk'],
    ['expanding: x + 1 slides to the end, the square goes up onto x', '(x+1)^2', 'x^2 + 2x + 1', 'mkkkcv>mvmmkkk'],
    ['factoring back', 'x^2 + 2x + 1', '(x+1)^2', 'mvmmkkk>mkkkav'],
    ['De Morgan: the brackets go, ∧ turns into ∨ ¬', '\\neg(A \\land B)', '\\neg A \\lor \\neg B', 'kckmkc>kkmmk'],
    ['nothing changes but one number', 'y = 3x + 2', 'y = 3x + 5', 'kkkkkm>kkkkkm'],
    ['a fraction cleared: the 2 and the bar go, 5 becomes 10', '\\frac{x}{2} = 5', 'x = 10', 'kcckm>kkm'],
    ['units stay, the numbers flow into 5, the bar into /', '\\frac{100\\,\\text{m}}{20\\,\\text{s}}', '5\\,\\text{m}/\\text{s}', 'mkmkc>mkmk'],
    ['two lines with nothing in common jump', 'a + b + c = d', 'e \\cdot f \\cdot g = h', 'mmmmmkm>mmmmmkm jump'],
    ['Chinese words in \\text keep their place', '\\text{利润} = \\text{收入} - \\text{成本}', '\\text{利润} = 500 - 320', 'kkmkm>kkmkm'],
  ];
  for (const [name, a, b, expect_] of cases) it(name, () => expect(roles(a, b)).toBe(expect_));
  it('the relation always stays with the relation', () => {
    for (const [a, b] of [['x + 1 = 2', 'x = 1'], ['3 = x - 1', '4 = x'], ['a < b + 1', 'a - b < 1'], ['\\ce{A -> B}', '\\ce{2A -> B}']]) {
      const A = typeset_line(a), B = typeset_line(b), m = match_lines(A, B);
      expect(m.from[A.anchor]).toEqual({ role: 'keep', to: B.anchor });
    }
  });
  it('every token of both lines is accounted for, once', () => {
    for (const [a, b] of [['2x + 3 = 11', '2x = 8'], ['(a+b)^2', 'a^2 + 2ab + b^2'], ['\\sin^2 x + \\cos^2 x', '1'], ['x', 'y + z + w']]) {
      const m = match_lines(typeset_line(a), typeset_line(b));
      for (const f of m.from) expect(f.role === 'cancel' ? f.to === -1 : f.to >= 0).toBe(true);
      for (const t of m.to) expect(t.role === 'appear' ? t.from.length === 0 : t.from.length > 0).toBe(true);
    }
  });
});

// ------------------------------------------------------------------ the picture
const DERIVATIONS: Record<string, string> = {
  solve: '2x + 3 = 11\n2x + 3 - 3 = 11 - 3 % subtract 3\n2x = 8\nx = 4 % divide by 2',
  move: '2x + 3 = 11\n2x = 11 - 3\n2x = 8',
  power: '\\frac{d}{dx}x^{3}\n3x^{2}',
  expand: '(x+1)^2\n= (x+1)(x+1)\n= x^2 + x + x + 1\n= x^2 + 2x + 1',
  chem: '\\ce{H2 + O2 -> H2O}\n\\ce{2H2 + O2 -> 2H2O}',
  logic: '\\neg(A \\land B)\n\\neg A \\lor \\neg B',
  frac: '\\frac{x}{2} + \\frac{x}{3} = 5\n3x + 2x = 30\n5x = 30\nx = 6',
  units: '\\frac{100\\,\\text{m}}{20\\,\\text{s}}\n5\\,\\frac{\\text{m}}{\\text{s}}',
  bayes: 'P(A \\mid B) = \\frac{P(B \\mid A)P(A)}{P(B)}\nP(A \\mid B) = \\frac{0.9 \\times 0.01}{0.05}\nP(A \\mid B) = 0.18',
  zh: '\\text{利润} = \\text{收入} - \\text{成本}\n\\text{利润} = 500 - 320 % 代入\n\\text{利润} = 180',
};
/** (the plain change from line to line: one transition per pair of lines; acts are tested on their own below) */
function figure_of(src: string, w = 560, stack = false, acts = false) {
  const st = new Steps(src, { id: 's', why: false, stack, acts });
  const fig = new Figure({ lang: 'en' });
  fig.layout(column([st]));
  fig.build();
  const size = fig.layout_for(w, undefined);
  return { st, fig, W: w, H: Math.ceil(size.h) };
}
describe('Steps: written lines kept (stack)', () => {
  it('at rest on line k, the lines before it are still there, lighter, and line k is exactly its typeset line', () => {
    const { st, fig, W, H } = figure_of(DERIVATIONS.solve, 560, true);
    const k = 2;
    st.at.set(k, true);
    const a = createCanvas(W * 2, H * 2);
    fig.draw(a.getContext('2d') as never, 2, { force: true });
    const da = a.getContext('2d').getImageData(0, 0, W * 2, H * 2).data;
    // line k alone, drawn by draw_tex where Steps says it is
    const b = createCanvas(W * 2, H * 2), gb = b.getContext('2d') as unknown as CanvasRenderingContext2D;
    st.opacity.set(0); fig.draw(gb, 2, { force: true }); st.opacity.set(1);
    gb.setTransform(2, 0, 0, 2, 0, 0);
    const o = st.origin(k), T = typeset_line(st.lines[k].tex);
    draw_tex(gb, st.lines[k].tex, o.x + T.view[0] * o.k, o.y, o.px, st.text_color);
    const db = gb.getImageData(0, 0, W * 2, H * 2).data;
    // compare the band of line k: the same pixels
    const P = st.origin(1).y - st.origin(0).y, top = Math.floor((o.y - P * 0.5) * 2), bot = Math.ceil((o.y + P * 0.45) * 2);
    // (each token is placed with its own transform: a handful of edge pixels round differently, by little)
    let visible = 0, worst = 0;
    for (let y = Math.max(0, top); y < Math.min(H * 2, bot); y++) for (let x = 0; x < W * 2; x++) { const i = (y * W * 2 + x) * 4, d = Math.abs(da[i] - db[i]); if (d > 9) visible++; worst = Math.max(worst, d); }
    expect(visible).toBeLessThanOrEqual(4);
    expect(worst).toBeLessThanOrEqual(30);
    // the first line is still written, in the second ink (lighter than line k, but there)
    const band = (yc: number) => { let s = 0, m = 0; for (let y = Math.floor((yc - P * 0.4) * 2); y < (yc + P * 0.3) * 2; y++) for (let x = 0; x < W * 2; x++) { const i = (y * W * 2 + x) * 4, v = 255 - da[i]; s += v; m = Math.max(m, v); } return { s, m }; };
    const first = band(st.origin(0).y), last = band(o.y);
    expect(first.s).toBeGreaterThan(0);
    expect(first.m).toBeLessThan(last.m);
  });
  it('the block is as tall as all its lines, and each line is one pitch under the one before', () => {
    const { st } = figure_of(DERIVATIONS.solve, 560, true);
    const P = st.origin(1).y - st.origin(0).y;
    expect(P).toBeGreaterThan(10);
    expect(st.origin(3).y - st.origin(2).y).toBeCloseTo(P, 6);
    expect(st.box.h).toBeGreaterThan(P * (st.lines.length - 1));
  });
  it('the mirror reads every line written so far, with its reason', () => {
    const st = new Steps(DERIVATIONS.solve, { id: 'm' });
    const fig = new Figure({ lang: 'en' }); fig.layout(column([st])); fig.build(); fig.layout_for(560, undefined);
    st.at.set(1, true);
    const texts = st.parts_of!('en').map((p) => p.text);
    expect(texts).toContain('2x + 3 = 11');
    expect(texts).toContain('2x + 3 - 3 = 11 - 3');
    expect(texts).toContain('subtract 3');
  });
  it('reasons sit beside their lines when there is room, under them when there is not', () => {
    const wide = new Steps(DERIVATIONS.solve, { id: 'w' }), narrow = new Steps(DERIVATIONS.solve, { id: 'n' });
    for (const [st, w] of [[wide, 720], [narrow, 220]] as const) { const f = new Figure({ lang: 'en' }); f.layout(column([st])); f.build(); f.layout_for(w, undefined); }
    const pw = wide.origin(1).y - wide.origin(0).y, pn = narrow.origin(1).y - narrow.origin(0).y;
    // (under: the pitch holds a reason's line too, relative to the formula size)
    expect(pn / narrow.origin(0).px).toBeGreaterThan(pw / wide.origin(0).px);
  });
});

describe('Steps: the picture', () => {
  it('at rest, every line of every derivation is exactly the typeset line (pixel for pixel)', () => {
    let lines = 0;
    for (const src of Object.values(DERIVATIONS)) {
      const { st, fig, W, H } = figure_of(src);
      for (let line = 0; line < st.lines.length; line++) {
        // (draw_tex leaves out what MathJax's fonts lack - Chinese in \text{} - and Steps draws it: compared below)
        if (st.typeset[line].tokens.some((tk) => tk.glyphs.some((g) => g.text))) continue;
        st.at.set(line, true);
        const a = createCanvas(W * 2, H * 2), b = createCanvas(W * 2, H * 2);
        fig.draw(a.getContext('2d') as never, 2, { force: true });
        const gb = b.getContext('2d') as unknown as CanvasRenderingContext2D;
        st.opacity.set(0);
        fig.draw(gb, 2, { force: true });
        st.opacity.set(1);
        const o = st.origin(line), t = st.typeset[line];
        gb.setTransform(2, 0, 0, 2, 0, 0);
        draw_tex(gb, t.tex, o.x + t.view[0] * o.k, o.y, o.px, st.text_color);
        const da = a.getContext('2d').getImageData(0, 0, W * 2, H * 2).data, db = gb.getImageData(0, 0, W * 2, H * 2).data;
        // (each token is placed with its own transform, so a few edge pixels round differently: a handful, by little)
        let diff = 0, visible = 0, worst = 0;
        for (let i = 0; i < da.length; i += 4) { const d = Math.abs(da[i] - db[i]) + Math.abs(da[i + 1] - db[i + 1]) + Math.abs(da[i + 2] - db[i + 2]); if (d) diff++; if (d > 9) visible++; worst = Math.max(worst, d); }
        expect(visible, `${t.tex}`).toBeLessThanOrEqual(4);
        expect(worst, `${t.tex}`).toBeLessThanOrEqual(30);
        expect(diff / (W * H * 4), `${t.tex}`).toBeLessThan(5e-4);
        lines++;
      }
    }
    expect(lines).toBe(26);   // (29 lines, 3 of them with Chinese)
  });
  it('Chinese inside \\text{} is drawn (MathJax has no glyphs for it), where MathJax puts it', () => {
    const { st, fig, W, H } = figure_of(DERIVATIONS.zh);
    st.at.set(0, true);
    const c = createCanvas(W, H);
    fig.draw(c.getContext('2d') as never, 1, { force: true });
    const d = c.getContext('2d').getImageData(0, 0, W, H).data, o = st.origin(0), tk = st.typeset[0].tokens[0];
    let ink = 0;
    for (let y = Math.floor(o.y + tk.box[1] * o.k); y < o.y + tk.box[3] * o.k; y++) for (let x = Math.floor(o.x + tk.box[0] * o.k); x < o.x + tk.box[2] * o.k; x++) ink += 255 - d[(y * W + x) * 4];
    expect(tk.key).toBe('利润');
    expect(ink).toBeGreaterThan(255 * 40);
  });
  it('the relations line up: = stays where it is from line to line', () => {
    for (const src of [DERIVATIONS.solve, DERIVATIONS.move, DERIVATIONS.frac, DERIVATIONS.bayes]) {
      const { st } = figure_of(src);
      const xs = st.typeset.map((t, i) => { const a = t.tokens[t.anchor]; return st.origin(i).x + ((a.box[0] + a.box[2]) / 2) * st.origin(i).k; });
      for (const x of xs) expect(Math.abs(x - xs[0])).toBeLessThan(0.01);
    }
  });
  it('between lines, every piece moves continuously, and starts and ends where the lines are', () => {
    for (const [name, src] of Object.entries(DERIVATIONS)) {
      const { st } = figure_of(src);
      for (let k = 0; k + 1 < st.lines.length; k++) {
        if (st.moves[k].jump) continue;
        let prev = st.pieces(k + 1e-4), worst = 0;
        for (let i = 1; i <= 200; i++) {
          const v = k + Math.min(0.9999, i / 200), cur = st.pieces(v);
          expect(cur.length, name).toBe(prev.length);
          cur.forEach((p, j) => {
            const q = prev[j];
            expect(Number.isFinite(p.dx + p.dy + p.scale + p.w), name).toBe(true);
            worst = Math.max(worst, Math.hypot(p.dx - q.dx, p.dy - q.dy), Math.abs(p.w - q.w) * 20, Math.abs(p.scale - q.scale) * 20);
          });
          prev = cur;
        }
        // (TeX units per 1/200 of a change: a 30-unit trip at the fastest point of the ease is ~0.5)
        expect(worst, `${name} ${k}`).toBeLessThan(1.6);
        // the ends are the lines at rest: kept tokens where line k has them, at u = 0, and where line k+1 has them, at u = 1
        const r0 = st.pieces(k), r1 = st.pieces(k + 1);
        const s0 = st.pieces(k + 1e-6), s1 = st.pieces(k + 1 - 1e-6);
        const kept = st.moves[k].from.map((f, i) => [f, i] as const).filter(([f]) => f.role === 'keep');
        for (const [f, i] of kept) {
          const a = s0.find((p) => p.glyphs === st.typeset[k].tokens[i].glyphs)!, b = s1.find((p) => p.glyphs === st.typeset[k].tokens[i].glyphs)!;
          const rest_a = r0[i], rest_b = r1[f.to];
          expect(Math.abs(a.dx + a.cx - (rest_a.dx + rest_a.cx))).toBeLessThan(0.01);
          expect(Math.abs(b.dx + b.cx - (rest_b.dx + rest_b.cx))).toBeLessThan(0.05);
        }
      }
    }
  });
  it('what travels over the relation goes up and over it (the 3 and its sign); nothing else leaves the line', () => {
    const { st } = figure_of(DERIVATIONS.move);
    const M = st.moves[0], A = st.typeset[0], B = st.typeset[1];
    const travelling = new Set([...A.tokens.filter((_, i) => M.from[i].role === 'move'), ...B.tokens.filter((_, j) => M.to[j].role === 'move')].map((t) => t.glyphs));
    expect(travelling.size).toBe(4);                   // + 3 over there, − 3 arriving
    const mid = st.pieces(0.5);
    for (const q of mid) {
      if (travelling.has(q.glyphs)) expect(q.dy).toBeLessThan(-3);
      else expect(q.dy).toBeCloseTo(0, 5);
    }
  });
  it('draws every moment of every change without failing, and quickly', () => {
    let frames = 0, slowest = 0;
    for (const src of Object.values(DERIVATIONS)) {
      const { st, fig, W, H } = figure_of(src);
      const c = createCanvas(W * 2, H * 2), g = c.getContext('2d') as never;
      for (let v = 0; v <= st.lines.length - 1 + 1e-9; v += 0.05) {
        st.at.set(v, true);
        const t0 = performance.now();
        fig.draw(g, 2, { force: true });
        slowest = Math.max(slowest, performance.now() - t0);
        frames++;
      }
    }
    expect(frames).toBeGreaterThan(300);
    expect(slowest).toBeLessThan(60);   // (node, CPU canvas; the browser is faster)
  });
  it('steps_figure walks the lines, one beat each, and passes the figure lint', () => {
    const fig = steps_figure(DERIVATIONS.solve, { lang: 'en' });
    fig.build();
    expect(fig.section_starts().length).toBe(3);   // (a beat before each change: lines 2, 3 and 4)
    fig.at(fig.duration);
    expect(fig.derivation.at.value).toBe(3);
    const issues = lint_figure(fig).filter((i) => i.severity === 'error');
    expect(issues).toEqual([]);
  });
  it('inside an animation: one part of a figure beside a graph, moved by the same script (beats line up)', () => {
    const fig = new Figure({ lang: 'en' });
    const rise = fig.param('rise', 0, { range: [0, 1] });
    const P = fig.plot({ id: 'graph', x: [-1, 6], y: [-2, 6], axes: 'origin', priority: 2 });
    const f = (x: number) => x * x - 2 * x;
    const curve = P.add(new Path(() => Array.from({ length: 50 }, (_, i): [number, number] => { const x = -1 + (7 * i) / 49; return [x, f(x)]; }), { id: 'curve', role: 'noun:function' }));
    const dot = P.add(new Marker(() => [3, 3 * rise.value], { id: 'point', role: 'noun:value' }));
    const st = new Steps('y = x^2 - 2x\ny = (3)^2 - 2(3) % put in x = 3\ny = 3 % work it out', { id: 'steps' });
    fig.layout(row([P, column([st])], { weights: [3, 2], align: 'center' }), { phone: column([st, P]) });
    fig.script(reveal(P, curve), wait(0.5), beat(), together(st.go(1), reveal(dot)), wait(1), beat(), together(st.go(2), set(rise, 1, 'travel', 1.3)), wait(1));
    fig.build();
    // at the end of each section, the formula is on its line and the point where that line puts it
    const ends = [...fig.section_starts(), fig.duration];
    const lines: number[] = [], heights: number[] = [];
    for (const t of ends) { fig.at(t - 0.01); lines.push(Math.round(st.at.value)); heights.push(rise.value); }
    expect(lines).toEqual([0, 1, 2]);
    expect(heights[0]).toBe(0);
    expect(heights[1]).toBe(0);
    expect(heights[2]).toBeGreaterThan(0.99);
    // it sits beside the graph on a desktop, above it on a phone, and nothing overlaps at either
    const wide = fig.layout_for(960, 540);
    expect(st.box.x).toBeGreaterThan(P.box.x + P.box.w - 1);
    expect(wide.w).toBe(960);
    fig.layout_for(360, undefined);
    expect(st.box.y + st.box.h).toBeLessThanOrEqual(P.box.y + 1);
    expect(lint_figure(fig).filter((i) => i.severity === 'error')).toEqual([]);
    // go() keeps to the lines there are
    expect((st.go(9) as { to: number }).to).toBe(2);
  });
  it('a line that does not follow is marked while it rests', () => {
    const { st, fig, W, H } = figure_of('2x + 3 = 11\n2x = 14\nx = 7');
    const ink = (doubt: number[]) => { st.doubtful = doubt; st.at.set(1, true); const c = createCanvas(W, H); fig.draw(c.getContext('2d') as never, 1, { force: true }); const d = c.getContext('2d').getImageData(0, 0, W, H).data; let s = 0; for (let i = 0; i < d.length; i += 4) s += 765 - d[i] - d[i + 1] - d[i + 2]; return s; };
    expect(ink([2])).toBeGreaterThan(ink([]));
  });
  it('the mirror reads the line at rest as TeX, and its reason', () => {
    const st = new Steps(DERIVATIONS.solve, { id: 'm', stack: false });
    const fig = new Figure({ lang: 'en' }); fig.layout(column([st])); fig.build(); fig.layout_for(560, undefined);
    st.at.set(1, true);
    const parts = st.parts_of!('en');
    expect(parts[0]).toMatchObject({ text: '2x + 3 - 3 = 11 - 3', tex: true });
    expect(parts[1].text).toBe('subtract 3');
  });
});

// ------------------------------------------------------------------ checks
const verdicts = (src: string) => check_steps(parse_steps(src).lines);
describe('check_steps: what a derivation is held to', () => {
  const right: [string, string, string][] = [
    ['linear equation', 'algebra', '2x + 3 = 11\n2x + 3 - 3 = 11 - 3\n2x = 8\nx = 4'],
    ['fractions cleared', 'algebra', '\\frac{x}{2} + \\frac{x}{3} = 5\n3x + 2x = 30\n5x = 30\nx = 6'],
    ['an expansion', 'algebra', '(x+1)^2\n= (x+1)(x+1)\n= x^2 + 2x + 1'],
    ['difference of squares', 'algebra', 'a^2 - b^2\n= (a - b)(a + b)'],
    ['quadratic by factoring', 'algebra', 'x^2 - 5x + 6 = 0\n(x - 2)(x - 3) = 0'],
    ['solving for a variable', 'algebra', 'y = mx + b\ny - b = mx\nx = \\frac{y - b}{m}'],
    ['an inequality flipped correctly', 'algebra', '-2x + 1 < 7\n-2x < 6\nx > -3'],
    ['a derivative', 'algebra', '\\frac{d}{dx}\\left(x^3 + 2x\\right)\n3x^2 + 2'],
    ['the chain rule', 'algebra', '\\frac{d}{dx}\\sin(x^2)\n2x\\cos(x^2)'],
    ['logarithms', 'algebra', '\\ln(a b^2)\n= \\ln a + 2\\ln b'],
    ['exponents', 'algebra', '2^{x+1} \\cdot 2^{x}\n= 2^{2x+1}'],
    ['trigonometry', 'algebra', '\\sin^2\\theta + \\cos^2\\theta\n= 1'],
    ['units', 'algebra', '\\frac{100\\,\\text{m}}{20\\,\\text{s}}\n5\\,\\frac{\\text{m}}{\\text{s}}'],
    ['expected value', 'algebra', '\\text{EV} = 0.3(100) + 0.7(20)\n\\text{EV} = 30 + 14\n\\text{EV} = 44'],
    ['compound interest', 'algebra', 'A = 1000(1 + 0.05)^2\nA = 1000 \\times 1.1025\nA = 1102.5'],
    ['percent', 'algebra', '0.2 \\times 50\n= 10'],
    ['square roots', 'algebra', '\\sqrt{x+2} = x\nx + 2 = x^2'],
    ['arithmetic only', 'algebra', '3 \\times 4 + 5\n= 12 + 5\n= 17'],
    ['De Morgan', 'logic', '\\neg(A \\land B)\n\\neg A \\lor \\neg B'],
    ['implication', 'logic', 'p \\to q\n\\neg p \\lor q'],
    ['distributing in logic', 'logic', 'A \\land (B \\lor C)\n(A \\land B) \\lor (A \\land C)'],
    ['balancing water', 'chemistry', '\\ce{H2 + O2 -> H2O}\n\\ce{2H2 + O2 -> 2H2O}'],
    ['balancing combustion', 'chemistry', '\\ce{CH4 + O2 -> CO2 + H2O}\n\\ce{CH4 + 2O2 -> CO2 + 2H2O}'],
    ['ions', 'chemistry', '\\ce{Fe^3+ + e- -> Fe^2+}\n\\ce{Fe^3+ + e^- -> Fe^2+}'],
  ];
  for (const [name, domain, src] of right)
    it(`right: ${name}`, () => {
      const r = verdicts(src);
      expect(r.domain).toBe(domain);
      for (const v of r.verdicts) expect(v.status, `${v.line}: ${v.message}`).not.toBe('error');
      expect(r.verdicts.some((v) => v.status === 'ok' || v.status === 'warn')).toBe(true);
    });
  const wrong: [string, string, number, RegExp][] = [
    ['an arithmetic slip', '2x + 3 = 11\n2x = 14\nx = 7', 2, /solutions/],
    ['a slip in the last line', '2x = 8\nx = 3', 2, /solutions/],
    ['subtracting on one side only', '2x + 3 = 11\n2x = 11', 2, /solutions/],
    ['dividing by a variable', 'x^2 = 3x\nx = 3', 2, /loses the solution x = 0/],
    ['an inequality not flipped', '-2x < 6\nx < -3', 2, /negative/],
    ['an expansion missing the middle term', '(x+1)^2\n= x^2 + 1', 2, /not equal/],
    ['a sign error in factoring', 'x^2 - 5x + 6 = 0\n(x + 2)(x + 3) = 0', 2, /solutions/],
    ['a wrong derivative', '\\frac{d}{dx}x^3\n3x^3', 2, /not equal/],
    ['the chain rule forgotten', '\\frac{d}{dx}\\sin(x^2)\n\\cos(x^2)', 2, /not equal/],
    ['a log rule misused', '\\ln(a + b)\n= \\ln a + \\ln b', 2, /not equal/],
    ['exponents added wrongly', '2^{3} \\cdot 2^{4}\n= 2^{12}', 2, /not equal/],
    ['units that do not cancel', '\\frac{100\\,\\text{m}}{20\\,\\text{s}}\n5\\,\\text{m}', 2, /not equal/],
    ['an expected value added wrong', '\\text{EV} = 0.3(100) + 0.7(20)\n\\text{EV} = 30 + 14\n\\text{EV} = 34', 3, /44 vs 34/],
    ['a false line of arithmetic', '3 \\times 4 + 5\n= 12 + 5\n= 18', 3, /17 vs 18/],
    ['interest computed wrong', 'A = 1000(1 + 0.05)^2\nA = 1000 \\times 1.1', 2, /not equal/],
    ['De Morgan done wrong', '\\neg(A \\land B)\n\\neg A \\land \\neg B', 2, /not equivalent/],
    ['implication reversed', 'p \\to q\nq \\to p', 2, /not equivalent/],
    ['an unbalanced reaction', '\\ce{H2 + O2 -> H2O}\n\\ce{H2 + O2 -> 2H2O}', 2, /not balanced/],
    ['charge not balanced', '\\ce{Fe^3+ -> Fe^2+}\n\\ce{Fe^3+ -> Fe^2+}', 2, /charge/],
    ['a solved-for variable wrong', 'y = mx + b\nx = \\frac{y + b}{m}', 2, /solutions/],
  ];
  for (const [name, src, line, msg] of wrong)
    it(`wrong: ${name}`, () => {
      const r = verdicts(src);
      const bad = r.verdicts.find((v) => v.status === 'error');
      expect(bad, JSON.stringify(r.verdicts)).toBeTruthy();
      expect(bad!.line).toBe(line);
      expect(bad!.message).toMatch(msg);
    });
  it('values put in for letters are read from the change and checked', () => {
    expect(substituted('z = 40x + 30y', 'z = 40(20) + 30(40)')).toEqual({ x: 20, y: 40 });
    expect(substituted('F = ma', 'F = 2 \\times 3')).toEqual({ m: 2, a: 3 });
    expect(substituted('v = u + at', 'v = 4 + 2(-3)')).toEqual({ u: 4, a: 2, t: -3 });
    expect(substituted('\\text{利润} = p q - c', '\\text{利润} = 12 \\times 50 - 200')).toEqual({ p: 12, q: 50, c: 200 });
    const ok = verdicts('z = 40x + 30y\nz = 40(20) + 30(40)\nz = 800 + 1200\nz = 2000');
    expect(ok.verdicts.map((v) => v.status)).toEqual(['ok', 'ok', 'ok']);
    expect(ok.verdicts[0].message).toMatch(/x = 20, y = 40 put in correctly/);
    const bad = verdicts('v = u + at\nv = 4 + 2(-3)\nv = 2');
    expect(bad.verdicts[1]).toMatchObject({ status: 'error', line: 3 });
    const wrong_put = verdicts('A = \\pi r^2\nA = \\pi (3)^2\nA = 6\\pi');
    expect(wrong_put.verdicts[1]).toMatchObject({ status: 'error', line: 3 });
  });
  it('units convert by their sizes (km = 1000 m, h = 3600 s), and words new in a line are labels', () => {
    expect(verdicts('72\\,\\text{km/h}\n= \\frac{72 \\times 1000\\,\\text{m}}{3600\\,\\text{s}}\n= 20\\,\\text{m/s}').verdicts.map((v) => v.status)).toEqual(['ok', 'ok']);
    expect(verdicts('72\\,\\text{km/h}\n= 72\\,\\text{m/s}').verdicts[0].status).toBe('error');
    expect(verdicts('2.5\\,\\text{h} = 2.5\\,\\text{h} \\times \\frac{3600\\,\\text{s}}{1\\,\\text{h}}\n2.5 \\times 3600\\,\\text{s} = 9000\\,\\text{s}').verdicts[0].status).toBe('ok');
    // (a conversion factor written without the unit it converts: 2.5 h = 2.5 × 3600 s / 1 h claims 9000 s = 2.5)
    expect(verdicts('2.5\\,\\text{h} = 2.5 \\times \\frac{3600\\,\\text{s}}{1\\,\\text{h}}\n2.5 \\times 3600\\,\\text{s} = 9000\\,\\text{s}').verdicts[0].status).toBe('error');
    expect(verdicts('\\text{收入} = 15 \\times 120\n\\text{收入} = 1800\\,\\text{元}').verdicts[0].status).toBe('ok');
  });
  it('a limit taken on the way is checked as a limit', () => {
    expect(verdicts('4x^3 + 6x^2h + 4xh^2 + h^3\n4x^3 % as h \\to 0').verdicts[0]).toMatchObject({ status: 'ok', message: 'the limit as h → 0' });
    expect(verdicts('\\frac{\\sin h}{h}\n1 % h → 0').verdicts[0].status).toBe('ok');
    expect(verdicts('4x^3 + 6x^2h\n6x^2 % as h \\to 0').verdicts[0].status).toBe('error');
  });
  it('lines that are identities follow from identities; a chain of = in one line must be true', () => {
    expect(verdicts('(2x-3)^2 = (2x-3)(2x-3)\n(2x-3)^2 = 4x^2 - 12x + 9').verdicts[0].status).toBe('ok');
    expect(verdicts('(2x-3)^2 = (2x-3)(2x-3)\n(2x-3)^2 = 4x^2 - 9').verdicts[0].status).toBe('error');
    expect(verdicts('y = 8\ny = 2\\cdot 2\\cdot 2 = 8').verdicts[0].status).toBe('ok');
    expect(verdicts('y = 8\ny = 2\\cdot 2 = 8').verdicts[0]).toMatchObject({ status: 'error' });
    expect(verdicts('TC = 2Q^2 + 5Q\nMC = \\frac{dTC}{dQ} = 4Q + 5').verdicts[0].status).toBe('unchecked');
  });
  it('squaring both sides gains a root: a warning, not an error', () => {
    const r = verdicts('\\sqrt{x+2} = x\nx + 2 = x^2');
    expect(r.verdicts[0]).toMatchObject({ status: 'warn' });
    expect(r.verdicts[0].message).toMatch(/gains a solution x = -1/);
  });
  it('what it cannot read is "unchecked", never "ok"', () => {
    for (const src of ['\\int x\\,dx\n\\frac{x^2}{2} + C', '\\lim_{x\\to 0}\\frac{\\sin x}{x}\n1', '\\sum_{i=1}^{n} i\n\\frac{n(n+1)}{2}', '\\begin{pmatrix}1&2\\\\3&4\\end{pmatrix}^T\n\\begin{pmatrix}1&3\\\\2&4\\end{pmatrix}', 'f\'(x) = 2x\nf\'(3) = 6'])
      for (const v of verdicts(src).verdicts) expect(v.status, src).toBe('unchecked');
  });
  it('is the same every time (seeded)', () => {
    const a = JSON.stringify(verdicts('2x + 3 = 11\n2x = 14')), b = JSON.stringify(verdicts('2x + 3 = 11\n2x = 14'));
    expect(a).toBe(b);
  });
});

// ------------------------------------------------------------------ generated derivations, one line broken
function rng(seed: number) { let a = seed >>> 0; return () => { a = (a + 0x6d2b79f5) >>> 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const int = (r: () => number, a: number, b: number) => a + Math.floor(r() * (b - a + 1));
const sgn = (n: number) => (n < 0 ? `- ${-n}` : `+ ${n}`);
/** a x + b = c, solved: subtract b, simplify, divide, simplify (x is a whole number). */
function linear(r: () => number): string[] {
  const a = int(r, 2, 9) * (r() < 0.2 ? -1 : 1), x = int(r, -12, 12), b = int(r, -20, 20) || 1, c = a * x + b;
  return [`${a}x ${sgn(b)} = ${c}`, `${a}x ${sgn(b)} ${sgn(-b)} = ${c} ${sgn(-b)}`, `${a}x = ${c - b}`, `x = \\frac{${c - b}}{${a}}`, `x = ${x}`];
}
/** (x + p)(x + q) expanded, as a chain. */
function expansion(r: () => number): string[] {
  const p = int(r, -9, 9) || 2, q = int(r, -9, 9) || 3;
  return [`(x ${sgn(p)})(x ${sgn(q)})`, `x^2 ${sgn(q)}x ${sgn(p)}x ${sgn(p * q)}`, `x^2 ${sgn(p + q)}x ${sgn(p * q)}`];
}
/** Does a line of a linear derivation still hold at the solution (a "slip" that happens to stay right: 0/4 → 0/5)? */
const still_true = (line: string, x: number) => { const sp = split_relation(line)!; const L = parse_expr(sp[0]).f({ x }), R = parse_expr(sp[2]).f({ x }); return Math.abs(L - R) < 1e-9; };
/** a slip: one number in one line (not the first) changed by 1 to 3. */
function corrupt(lines: string[], r: () => number): { lines: string[]; at: number } {
  for (;;) {
    const at = int(r, 1, lines.length - 1), l = lines[at], nums = [...l.matchAll(/\d+/g)];
    if (!nums.length) continue;
    const m = nums[int(r, 0, nums.length - 1)], d = int(r, 1, 3);
    const v = Number(m[0]) + d;
    const out = [...lines];
    out[at] = l.slice(0, m.index) + String(v) + l.slice(m.index! + m[0].length);
    if (out[at] !== l) return { lines: out, at };
  }
}
describe('generated derivations: every right one passes, every slip is caught where it is', () => {
  it('200 linear equations solved step by step, then each with one slip', () => {
    const r = rng(7);
    let caught = 0, total = 0;
    for (let i = 0; i < 200; i++) {
      const L = linear(r), x = Number(/x = (-?\d+)$/.exec(L[L.length - 1])![1]);
      const ok = verdicts(L.join('\n'));
      for (const v of ok.verdicts) expect(v.status, `${L.join(' | ')}: ${v.message}`).toBe('ok');
      const bad = corrupt(L, r);
      if (still_true(bad.lines[bad.at], x)) continue;     // (the changed line is still right: nothing to catch)
      const res = verdicts(bad.lines.join('\n'));
      total++;
      if (res.verdicts.find((v) => v.status === 'error')?.line === bad.at + 1) caught++;
    }
    expect(total).toBeGreaterThan(190);
    expect(caught).toBe(total);
  });
  it('200 expansions, then each with one slip', () => {
    const r = rng(11);
    let caught = 0;
    for (let i = 0; i < 200; i++) {
      const L = expansion(r);
      for (const v of verdicts(L.join('\n=')).verdicts) expect(v.status, L.join(' | ')).toBe('ok');
      const bad = corrupt(L, r), res = verdicts(bad.lines.join('\n='));
      if (res.verdicts.find((v) => v.status === 'error')?.line === bad.at + 1) caught++;
    }
    expect(caught).toBe(200);
  });
  it('every generated derivation matches line to line without a jump, and typesets', () => {
    const r = rng(3);
    for (let i = 0; i < 60; i++) {
      const rev = review_steps((i % 2 ? linear(r) : expansion(r)).join('\n'));
      expect(rev.issues.filter((s) => /typeset|too much/.test(s)), rev.lines.map((l) => l.tex).join(' | ')).toEqual([]);
    }
  });
  it('100 random logic rewrites by De Morgan and double negation stay equivalent; a dropped ¬ is caught', () => {
    const r = rng(5), V = ['p', 'q', 'r', 's'];
    for (let i = 0; i < 100; i++) {
      const a = V[int(r, 0, 3)], b = V[int(r, 0, 3)], op = r() < 0.5 ? ['\\land', '\\lor'] : ['\\lor', '\\land'];
      const good = `\\neg(${a} ${op[0]} ${b})\n\\neg ${a} ${op[1]} \\neg ${b}\n\\neg\\neg(\\neg ${a} ${op[1]} \\neg ${b})`;
      for (const v of verdicts(good).verdicts) expect(v.status).toBe('ok');
      if (a === b) continue;
      const bad = `\\neg(${a} ${op[0]} ${b})\n\\neg ${a} ${op[1]} ${b}`;
      expect(verdicts(bad).verdicts[0].status).toBe('error');
    }
  });
});

// ------------------------------------------------------------------ the tutor
/** Answers written the way the tutor writes them (both languages, the quirks models have), each with its block. */
const ANSWERS: [string, string, number][] = [
  ['en, linear', `The **same operation on both sides** keeps the equation true, so we can peel off the 3 first.\n\`\`\`steps\n2x + 3 = 11\n2x + 3 - 3 = 11 - 3   % subtract 3 from both sides\n2x = 8\nx = 4                 % divide both sides by 2\n\`\`\``, 4],
  ['zh, linear', `等式两边做**同样的运算**，等号依然成立。先把 3 去掉，再除以 2。\n\`\`\`steps\n2x + 3 = 11\n2x + 3 - 3 = 11 - 3 % 两边同时减 3\n2x = 8\nx = 4 % 两边同时除以 2\n\`\`\``, 4],
  ['zh, with ACT lines after', `把分数消掉的办法是两边同乘公分母 6。\n\`\`\`steps\n\\frac{x}{2} + \\frac{x}{3} = 5\n3x + 2x = 30 % 两边同乘 6\n5x = 30 % 合并同类项\nx = 6 % 两边除以 5\n\`\`\`\nACT: point eq1\nACT: set x 6`, 4],
  ['en, derivative', `Bring the exponent down and lower it by one: that is the **power rule**.\n\`\`\`steps\n\\frac{d}{dx}x^{3}\n3x^{2} % power rule\n\`\`\``, 2],
  ['en, chain rule', `Differentiate the outside, keep the inside, then multiply by the inside's derivative.\n\`\`\`steps\n\\frac{d}{dx}\\sin(x^2)\n\\cos(x^2) \\cdot \\frac{d}{dx}(x^2) % outside first\n\\cos(x^2) \\cdot 2x % derivative of x^2\n2x\\cos(x^2)\n\`\`\``, 4],
  ['zh, expansion', `$(x+1)^2$ 不是 $x^2+1$：中间还有两份 $x$。\n\`\`\`steps\n(x+1)^2\n= (x+1)(x+1) % 平方就是自己乘自己\n= x^2 + x + x + 1 % 逐项相乘\n= x^2 + 2x + 1 % 合并同类项\n\`\`\``, 4],
  ['en, inequality', `Dividing by a **negative** number flips the inequality.\n\`\`\`steps\n-2x + 1 < 7\n-2x < 6 % subtract 1\nx > -3 % divide by -2, flip <\n\`\`\``, 3],
  ['zh, chemistry', `先配氢，再配氧：每边的原子数要相同。\n\`\`\`steps\n\\ce{H2 + O2 -> H2O}\n\\ce{2H2 + O2 -> 2H2O} % 两边各 4 个 H、2 个 O\n\`\`\``, 2],
  ['en, logic', `Negating an AND gives an OR of the negations (De Morgan).\n\`\`\`steps\n\\neg(A \\land B)\n\\neg A \\lor \\neg B % De Morgan\n\`\`\``, 2],
  ['zh, expected value', `期望值就是每个结果乘它的概率，再加起来。\n\`\`\`steps\n\\text{EV} = 0.3 \\times 100 + 0.7 \\times 20\n\\text{EV} = 30 + 14 % 逐项相乘\n\\text{EV} = 44\n\`\`\``, 3],
  ['en, units', `Divide the numbers and the units separately.\n\`\`\`steps\n\\frac{100\\,\\text{m}}{20\\,\\text{s}}\n5\\,\\frac{\\text{m}}{\\text{s}} % 100 ÷ 20, m ÷ s\n\`\`\``, 2],
  ['en, rearranging a formula', `Undo what is done to $x$, in reverse order.\n\`\`\`steps\ny = mx + b\ny - b = mx % subtract b\n\\frac{y - b}{m} = x % divide by m\n\`\`\``, 3],
  ['model quirks: dollars, numbering, aligned', `Here:\n\`\`\`steps\n1. $3x - 4 = 11$\n2. $3x = 15$ (add 4 to both sides)\n3. $x = 5$ (divide by 3)\n\`\`\``, 3],
  ['model quirks: an aligned block inside', `\`\`\`steps\n\\begin{aligned}\n5(x - 2) &= 15 \\\\\n5x - 10 &= 15 \\\\\n5x &= 25 \\\\\nx &= 5\n\\end{aligned}\n\`\`\``, 4],
  ['zh, compound interest', `复利是每年在上一年的基础上再乘 1.05。\n\`\`\`steps\nA = 1000(1 + 0.05)^2\nA = 1000 \\times 1.1025 % 1.05 的平方\nA = 1102.5\n\`\`\``, 3],
  ['zh, LP corner value', `把顶点代入目标函数比大小。\n\`\`\`steps\nz = 40x + 30y\nz = 40(20) + 30(40) % 代入顶点 (20, 40)\nz = 800 + 1200\nz = 2000\n\`\`\``, 4],
];
describe('the tutor: real answers (deepseek-flash, the tutor prompt, 2026-11-06) review clean', () => {
  // test/fixtures/tutor_steps.txt: two samples of 18 questions each (algebra, calculus, chemistry, logic, expected
  // value, units, substitution, compound interest, LP; Chinese and English), as the model wrote them
  // @ts-ignore (node's fs)
  const text: string = require('node:fs').readFileSync(new URL('./fixtures/tutor_steps.txt', import.meta.url), 'utf8');
  const answers = text.split(/^=== /m).filter((x) => x.trim());
  it('every block in them reads, typesets, has no step too big, and no line that does not follow', () => {
    let n = 0;
    for (const a of answers) {
      const b = steps_blocks(a);
      if (!b.length) continue;
      const r = review_steps(b[0].body);
      expect(r.issues, `${a.split('\n')[0]}: ${r.lines.map((l) => l.tex).join(' | ')}`).toEqual([]);
      n++;
    }
    expect(n).toBeGreaterThanOrEqual(29);
  });
});
describe('the tutor: answers as it writes them read, typeset, match and check', () => {
  for (const [name, answer, n] of ANSWERS)
    it(name, () => {
      const blocks = steps_blocks(answer);
      expect(blocks).toHaveLength(1);
      expect(blocks[0].closed).toBe(true);
      const r = review_steps(blocks[0].body);
      expect(r.lines).toHaveLength(n);
      expect(r.issues, r.lines.map((l) => l.tex).join(' | ')).toEqual([]);
      expect(r.ok).toBe(true);
      expect(r.verdicts.some((v) => v.status === 'ok')).toBe(true);
    });
  it('a tutor\'s wrong line is found and marked, a too-big step is reported', () => {
    const r = review_steps('```steps\n2x + 3 = 11\n2x = 14 % subtract 3\nx = 7\n```');
    expect(r.ok).toBe(false);
    expect(r.doubtful).toEqual([2]);
    const big = review_steps('a + b + c = d\ne \\cdot f \\cdot g = h');
    expect(big.issues.join()).toMatch(/too much at once/);
  });
});
