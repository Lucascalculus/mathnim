// A formula read block by block, layer by layer (parts.ts): a block is found with its brackets and bars (P(A) is not
// the start of P(A | B); a fraction takes its bar), inside the block it belongs to, after the relation when it is
// written twice; whole, the formula is drawn as typeset; a layer shows its blocks and, outward, the blocks they make
// up; a tap goes in and out; no layer's words meet. Then the formulas of AI, mathematics and physics in
// fixtures/formula_layers.ts, in both languages: every block found, every layer laid out.
import { beforeAll, describe, expect, it } from 'vitest';
import { createCanvas } from '@napi-rs/canvas';
import { load_tex, parts_figure, typeset_line, type FormulaPart } from '../src/index';
import { use_node_canvas } from '../node';
import { FORMULAS } from './fixtures/formula_layers';

beforeAll(async () => {
  use_node_canvas();
  await load_tex();
});

const BAYES = 'P(A\\mid B) = \\frac{P(B\\mid A)\\,P(A)}{P(B)}';
const LAYERS: FormulaPart[] = [
  { tex: 'P(A\\mid B)', says: 'the posterior' },
  { tex: '\\frac{P(B\\mid A)\\,P(A)}{P(B)}', says: "the share of B's cases in which A also holds", parts: [
    { tex: 'P(B\\mid A)\\,P(A)', says: 'how often A and B happen together', parts: [{ tex: 'P(B\\mid A)', says: 'the likelihood' }, { tex: 'P(A)', says: 'the prior' }] },
    { tex: 'P(B)', says: 'the evidence' }] },
];

function make(parts: FormulaPart[] = LAYERS, tex = BAYES, w = 640) {
  const fig = parts_figure(tex, parts, { lang: 'en' });
  fig.build();
  const H = Math.ceil(fig.layout_for(w, undefined).h);
  return { fig, F: fig.formula, W: w, H };
}
function pixels(fig: ReturnType<typeof make>['fig'], W: number, H: number) {
  const c = createCanvas(W, H);
  fig.draw(c.getContext('2d') as never, 1, { force: true });
  return c.getContext('2d').getImageData(0, 0, W, H).data;
}
const keys = (ts: { key: string }[]) => ts.filter((t) => !t.key.startsWith('▭') && !t.key.startsWith('·')).map((t) => t.key).join('');

describe('finding the blocks', () => {
  it('finds each block with what it holds, inside the block it is part of', () => {
    const { F } = make();
    expect(F.issues).toEqual([]);
    expect(F.nodes.map((n) => `${'>'.repeat(n.depth)}${keys(n.tokens)}`)).toEqual(['P(A∣B)', 'P(B∣A)P(A)P(B)', '>P(B∣A)P(A)', '>>P(B∣A)', '>>P(A)', '>P(B)']);
    // (a fraction takes its bar; each child's tokens are among its parent's)
    expect(F.nodes[1].tokens.some((t) => t.key.startsWith('▭'))).toBe(true);
    for (const n of F.nodes) if (n.parent) for (const t of n.tokens) expect(n.parent.tokens).toContain(t);
    expect(F.opens.map((n) => keys(n.tokens))).toEqual(['P(B∣A)P(A)P(B)', 'P(B∣A)P(A)']);
  });
  it('brackets are part of a block: P(A) is not the start of P(A | B)', () => {
    const { F } = make([{ tex: 'P(A)', says: 'the prior' }]);
    const n = F.nodes[0], L = typeset_line(BAYES);
    // (the P(A) found is the one in the numerator, after the relation)
    expect(Math.min(...n.tokens.map((t) => t.box[0]))).toBeGreaterThan(L.tokens[L.anchor].box[2]);
    expect(keys(n.tokens)).toBe('P(A)');
  });
  it('a block written twice is the one after the relation: what a definition says, not the name it defines', () => {
    const tex = '\\mathrm{Attention}(Q,K,V) = \\mathrm{softmax}(QK^\\top)V';
    const { F } = make([{ tex: 'V', says: 'what each word offers' }], tex);
    const L = typeset_line(tex), v = F.nodes[0].tokens[0];
    expect(v.box[0]).toBeGreaterThan(L.tokens[L.anchor].box[2]);
  });
  it('a block not in the formula, or not inside its parent, is reported', () => {
    expect(make([{ tex: 'z', says: 'zed' }], 'x + y').F.issues.join(' ')).toContain('not in the formula');
    expect(make([{ tex: 'x', says: 'ex', parts: [{ tex: 'y', says: 'why' }] }], 'x + y').F.issues.join(' ')).toContain('not inside x');
  });
});

describe('reading it, layer by layer', () => {
  it('whole, the formula is drawn as typeset (the open state only adds marks and colour)', () => {
    const a = make(), b = make();
    b.F.open.set(0, true);
    const pa = pixels(a.fig, a.W, a.H), pb = pixels(b.fig, b.W, b.H);
    let diff = 0;
    for (let i = 0; i < pa.length; i++) diff = Math.max(diff, Math.abs(pa[i] - pb[i]));
    expect(diff).toBe(0);
    // and opening it draws something where there was nothing (the braces and the words)
    b.F.open.set(1, true);
    const pc = pixels(b.fig, b.W, b.H);
    let changed = 0;
    for (let i = 0; i < pa.length; i += 4) if (Math.abs(pa[i] - pc[i]) > 40) changed++;
    expect(changed).toBeGreaterThan(500);
  });
  it('a layer shows its blocks, and outward the blocks they make up, nearest first', () => {
    const { F } = make();
    expect(F.plan(0).marks.map((m) => `${m.outer ? 'outer ' : ''}${keys(m.node.tokens)}`).sort()).toEqual(['P(A∣B)', 'P(B∣A)P(A)P(B)'].sort());
    const deep = F.plan(2).marks;
    expect(deep.filter((m) => !m.outer).map((m) => keys(m.node.tokens)).sort()).toEqual(['P(A)', 'P(B∣A)']);
    expect(deep.filter((m) => m.outer).map((m) => keys(m.node.tokens))).toEqual(['P(B∣A)P(A)', 'P(B∣A)P(A)P(B)']);
    // (the numerator's blocks are above the formula; their outer braces further out on the same side)
    for (const m of deep) expect(m.side).toBe(-1);
    const outer = deep.filter((m) => m.outer);
    expect(outer[1].y).toBeLessThan(outer[0].y);
  });
  it('a tap goes in and out: whole → outer layer → inside a block → back out → whole', () => {
    const { F } = make();
    const at = (n: (typeof F.nodes)[number]) => F.middle(n);
    expect(F.tap([0, 0])).toEqual({ open: 1, layer: 0 });
    F.open.set(1, true);
    const share = F.nodes[1];
    expect(F.tap(at(share))).toEqual({ open: 1, layer: 1 });
    F.layer.set(1, true);
    const together = F.nodes[2];
    expect(F.tap(at(together))).toEqual({ open: 1, layer: 2 });
    F.layer.set(2, true);
    // a block with no inside: nothing; beside it all: one layer out
    expect(F.tap(at(F.nodes[3]))).toBeNull();
    expect(F.tap([F.box.x + 2, F.box.y + 2])).toEqual({ open: 1, layer: 1 });
    F.layer.set(0, true);
    expect(F.tap([F.box.x + 2, F.box.y + 2])).toEqual({ open: 0, layer: 0 });
  });
  it('the mirror reads the formula and the blocks of the layer shown', () => {
    const { F } = make();
    expect(F.parts_of!('en').map((p) => p.text)).toEqual([BAYES, 'P(A\\mid B): the posterior', "\\frac{P(B\\mid A)\\,P(A)}{P(B)}: the share of B's cases in which A also holds"]);
    F.open.set(1, true);
    F.layer.set(2, true);
    expect(F.parts_of!('en').slice(1).map((p) => p.text)).toEqual(['P(B\\mid A): the likelihood', 'P(A): the prior']);
  });
  it('its open state and layer are the tutor\'s to move', () => {
    const { fig, F } = make();
    expect(F.open.spec.tutor).toBe(true);
    expect(F.layer.spec.tutor).toBe(true);
    expect(fig.params.get(F.layer.name)).toBe(F.layer);
  });
});

describe('formulas of AI, mathematics and physics', () => {
  for (const lang of ['en', 'zh'] as const) {
    it.each(FORMULAS.map((f) => [f.id, f] as const))(`${lang}: %s - every block found, no layer's words meet`, (_id, F) => {
      const loc = (ps: FormulaPart[]): FormulaPart[] => ps.map((p) => ({ tex: p.tex, says: (p.says as { en: string; zh: string })[lang], ...(p.parts ? { parts: loc(p.parts) } : {}) }));
      const fig = parts_figure(F.tex, loc(F.parts), { lang });
      fig.build();
      fig.layout_for(640, undefined);
      expect(fig.formula.issues).toEqual([]);
      expect(fig.lint().filter((i) => i.rule === 'invariant').map((i) => i.message)).toEqual([]);
      // every layer's words are inside the figure, and never on the formula's ink
      const k = fig.formula.parts_of!(lang)[0].box;
      for (let n = 0; n <= fig.formula.opens.length; n++) {
        for (const m of fig.formula.plan(n).marks) {
          const f = fig.formula as unknown as { x0: number; y0: number };
          const x = f.x0 + m.label.x, y = f.y0 + m.label.y;
          expect(x).toBeGreaterThanOrEqual(fig.formula.box.x - 1);
          expect(x + m.label.w).toBeLessThanOrEqual(fig.formula.box.x + fig.formula.box.w + 1);
          expect(y + m.label.h <= k.y + 1 || y >= k.y + k.h - 1, `${F.id} layer ${n}: "${m.label.lines[0]}" on the formula`).toBe(true);
        }
      }
    });
  }
});
