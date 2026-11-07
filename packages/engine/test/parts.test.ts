// A formula taken apart (parts.ts; the specimen's explode.js): a block is found with its brackets and bars (P(A) is not
// the start of P(A | B); a fraction takes its bar), inside the block it belongs to, after the relation when it is
// written twice. The specimen's acceptance, as tests: put back together, every glyph is where it was typeset (0 px)
// and the frame is the frame before, pixel for pixel; at every amount where leaders show, none crosses another, a
// glyph or words. Layers: the focus comes down to the first level and its blocks lift off it; a tap goes in and out.
// Then the formulas of AI, mathematics and physics in fixtures/formula_layers.ts, in both views and both languages.
import { beforeAll, describe, expect, it } from 'vitest';
import { createCanvas } from '@napi-rs/canvas';
import { load_tex, parts_figure, poly_cross, seg_cross, seg_poly, typeset_line, type FormulaPart, type PartsView, type XY } from '../src/index';
import { use_node_canvas } from '../node';
import { FORMULAS } from './fixtures/formula_layers';

beforeAll(async () => {
  use_node_canvas();
  await load_tex();
});

const BAYES = 'P(A\\mid B) = \\frac{P(B\\mid A)\\,P(A)}{P(B)}';
const LAYERS: FormulaPart[] = [
  { tex: 'P(A\\mid B)', says: '**posterior** how believable $A$ is after $B$' },
  { tex: '\\frac{P(B\\mid A)\\,P(A)}{P(B)}', says: "the share of B's cases in which A also holds", parts: [
    { tex: 'P(B\\mid A)\\,P(A)', says: 'how often A and B happen together', parts: [{ tex: 'P(B\\mid A)', says: '**likelihood** how likely $B$ is if $A$ holds' }, { tex: 'P(A)', says: '**prior** belief in $A$ before $B$' }] },
    { tex: 'P(B)', says: '**evidence** how common $B$ is anyway' }] },
];

function make(parts: FormulaPart[] = LAYERS, tex = BAYES, view: PartsView = 'split', w = 700) {
  const fig = parts_figure(tex, parts, { lang: 'en', view, nouns: { A: 'hypothesis', B: 'evidence' } });
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
const at = (F: ReturnType<typeof make>['F'], open: number, layer: number, from = layer, fade = 1) => { F.open.set(open, true); F.from.set(from, true); F.layer.set(layer, true); F.fade.set(fade, true); };

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

for (const view of ['split', '3d'] as const) describe(`taken apart (${view})`, () => {
  it('put back together, every glyph is where it was typeset (0 px), and the frame is the frame before', () => {
    const { fig, F, W, H } = make(LAYERS, BAYES, view);
    const before = pixels(fig, W, H);
    for (const t of F.line.tokens) { const p = F.origin_of(t, 0), q = F.typeset_at(); expect(Math.abs(p[0] - q[0]) + Math.abs(p[1] - q[1])).toBe(0); }
    at(F, 1, 2, 1, 0.4);
    const apart = pixels(fig, W, H);
    at(F, 0, 0);
    const after = pixels(fig, W, H);
    let diff = 0, moved = 0;
    for (let i = 0; i < before.length; i++) diff = Math.max(diff, Math.abs(before[i] - after[i]));
    for (let i = 0; i < before.length; i += 4) if (Math.abs(before[i] - apart[i]) > 40) moved++;
    expect(diff).toBe(0);
    expect(moved).toBeGreaterThan(1000);
  });
  it('at every amount where leaders show, none crosses another, a glyph or words; no words meet', () => {
    const { F } = make(LAYERS, BAYES, view);
    expect(F.missing).toBe(0);
    for (let n = 0; n <= F.opens.length; n++) for (const e of [0.94, 0.95, 0.96, 0.97, 0.98, 0.99, 1]) {
      const L = F.leaders(e, n), ink = F.ink_at(e, n);
      // (split: the blocks shown are every block opened so far, split; else the layer's blocks and the one opened)
      expect(L.length).toBe(view === 'split' ? [2, 3, 4][n] : n === 0 ? 2 : 3);
      for (let i = 0; i < L.length; i++) for (let j = i + 1; j < L.length; j++) expect(seg_cross(L[i].a, L[i].b, L[j].a, L[j].b)).toBe(false);
      for (const l of L) {
        const a2: XY = [l.a[0] + (l.b[0] - l.a[0]) * 0.02, l.a[1] + (l.b[1] - l.a[1]) * 0.02];
        ink.glyphs.forEach((q, i) => { if (ink.roofs[i] !== l.node) expect(seg_poly(a2, l.b, q)).toBe(false); });
      }
      const box = (b: { x: number; y: number; w: number; h: number }): XY[] => [[b.x, b.y], [b.x + b.w, b.y], [b.x + b.w, b.y + b.h], [b.x, b.y + b.h]];
      for (let i = 0; i < ink.labels.length; i++) for (let j = i + 1; j < ink.labels.length; j++) expect(poly_cross(box(ink.labels[i]), box(ink.labels[j]))).toBe(false);
    }
  });
  it('a tap goes in and out: together → apart → inside a card → inside its card → back out → together', () => {
    const { F } = make(LAYERS, BAYES, view);
    expect(F.tap([0, 0])).toEqual({ open: 1, layer: 0 });
    at(F, 1, 0);
    const share = F.nodes[1], together = F.nodes[2];
    expect(F.tap(F.middle(share))).toEqual({ open: 1, layer: 1 });
    at(F, 1, 1);
    expect(F.tap(F.middle(together))).toEqual({ open: 1, layer: 2 });
    at(F, 1, 2);
    // a card with nothing inside: nothing; the card whose inside is shown, or the paper: one layer out
    expect(F.tap(F.middle(F.nodes[3]))).toBeNull();
    // (in the plane the focus's blocks lie on it and cover its middle)
    if (view === '3d') expect(F.tap(F.middle(together))).toEqual({ open: 1, layer: 1 });
    expect(F.tap([F.box.x + 2, F.box.y + 2])).toEqual({ open: 1, layer: 1 });
    at(F, 1, 0);
    expect(F.tap([F.box.x + 2, F.box.y + 2])).toEqual({ open: 0, layer: 0 });
  });
});

describe('in depth and in the plane', () => {
  it('3d: a layer lifts its blocks, each on its own level; deeper, the focus comes down first and its blocks lift off it', () => {
    const { F } = make(LAYERS, BAYES, '3d');
    at(F, 1, 0);
    const z = (n: number) => (F as unknown as { now(): { cards: { node: unknown; z: number }[] } }).now().cards.find((c) => c.node === F.nodes[n])!.z;
    expect(z(0)).toBeGreaterThan(0);
    expect(z(1)).toBeGreaterThan(0);
    expect(z(0)).not.toBe(z(1));
    at(F, 1, 2);
    // the joint block (the focus) on the first level, the likelihood and the prior above it
    expect(z(3)).toBeGreaterThan(z(2));
    expect(z(4)).toBeGreaterThan(z(2));
  });
  it('split: no camera turn; apart, cards never meet, and every glyph keeps its size', () => {
    const { F } = make(LAYERS, BAYES, 'split');
    for (let n = 0; n <= F.opens.length; n++) {
      at(F, 1, n);
      const sc = (F as unknown as { now(): { K: { a: number; b: number; c: number; d: number }; cards: { node: { parent: unknown }; rect: number[] }[]; tok: Map<unknown, { box: number[] }> } }).now();
      expect([sc.K.a, Math.abs(sc.K.b), Math.abs(sc.K.c), sc.K.d]).toEqual([1, 0, 0, 1]);
      const cs = sc.cards;
      for (let i = 0; i < cs.length; i++) for (let j = i + 1; j < cs.length; j++) {
        const a = cs[i].rect, b = cs[j].rect;
        expect(a[0] < b[2] && b[0] < a[2] && a[1] < b[3] && b[1] < a[3]).toBe(false);
      }
      for (const t of F.line.tokens) if (!t.glyphs.every((g) => g.rect)) {
        const r = sc.tok.get(t)!.box, k = (F as unknown as { S: { k: number } }).S.k;
        expect(Math.abs(r[2] - r[0] - (t.box[2] - t.box[0]) * k)).toBeLessThan(1e-6);
      }
    }
  });
  it('split: opening a card splits it into its blocks\' cards, the blocks opened before staying as they were', () => {
    const { F } = make(LAYERS, BAYES, 'split');
    const shown = (n: number) => { at(F, 1, n); return (F as unknown as { now(): { cards: { node: { part: FormulaPart } }[] } }).now().cards.map((c) => c.node.part.tex).sort(); };
    expect(shown(0)).toEqual([LAYERS[0].tex, LAYERS[1].tex].sort());
    expect(shown(1)).toEqual([LAYERS[0].tex, LAYERS[1].parts![0].tex, LAYERS[1].parts![1].tex].sort());
    expect(shown(2)).toEqual([LAYERS[0].tex, LAYERS[1].parts![0].parts![0].tex, LAYERS[1].parts![0].parts![1].tex, LAYERS[1].parts![1].tex].sort());
  });
  it('a lever runs through the layers on the way to one and on from it, each with its name', () => {
    const { F } = make();
    expect(F.path_of(0)).toEqual([0, 1, 2]);
    expect(F.path_of(2)).toEqual([0, 1, 2]);
    expect([1, 2].map((n) => F.layer_name(n, 'en'))).toEqual(['the share of…', 'how often A…']);
    expect(F.layer_name(0, 'en')).toBeNull();
  });
  it('the mirror reads the formula and the blocks of the layer shown', () => {
    const { F } = make();
    expect(F.parts_of!('en').map((p) => p.text)).toEqual([BAYES, 'P(A\\mid B): **posterior** how believable $A$ is after $B$', "\\frac{P(B\\mid A)\\,P(A)}{P(B)}: the share of B's cases in which A also holds"]);
    at(F, 1, 2);
    expect(F.parts_of!('en').slice(1).map((p) => p.text.split(':')[0])).toEqual(['P(B\\mid A)', 'P(A)']);
  });
  it("how far apart and which layer are the tutor's to move", () => {
    const { fig, F } = make();
    expect(F.open.spec.tutor).toBe(true);
    expect(F.layer.spec.tutor).toBe(true);
    expect(fig.params.get(F.layer.name)).toBe(F.layer);
    expect(fig.params.get(F.from.name)).toBe(F.from);
  });
});

describe('formulas of AI, mathematics and physics', () => {
  for (const view of ['split', '3d'] as const) for (const lang of ['en', 'zh'] as const) {
    it.each(FORMULAS.map((f) => [f.id, f] as const))(`${view}, ${lang}: %s - every block found, every layer's words placed, no leader crossing`, (_id, F) => {
      const loc = (ps: FormulaPart[]): FormulaPart[] => ps.map((p) => ({ tex: p.tex, says: (p.says as { en: string; zh: string })[lang], ...(p.parts ? { parts: loc(p.parts) } : {}) }));
      const fig = parts_figure(F.tex, loc(F.parts), { lang, view });
      fig.build();
      fig.layout_for(700, undefined);
      expect(fig.formula.issues).toEqual([]);
      expect(fig.formula.missing).toBe(0);
      expect(fig.lint().filter((i) => i.rule === 'invariant').map((i) => i.message)).toEqual([]);
    });
  }
});

// On a page the lever stands in a strip at the right of the stage (the specimen's handle): at the column's widths on a
// desktop (1440 and 1024 wide), every layer still has room for its words, and nothing apart (a card, a glyph, words) goes
// into the strip; together, the formula stays in the middle of the column.
describe('with the lever, at the widths of the column', () => {
  for (const view of ['split', '3d'] as const) for (const lang of ['en', 'zh'] as const) for (const w of [672, 536]) {
    it.each(FORMULAS.map((f) => [f.id, f] as const))(`${view}, ${lang}, ${w} px: %s`, (_id, F) => {
      const loc = (ps: FormulaPart[]): FormulaPart[] => ps.map((p) => ({ tex: p.tex, says: (p.says as { en: string; zh: string })[lang], ...(p.parts ? { parts: loc(p.parts) } : {}) }));
      const fig = parts_figure(F.tex, loc(F.parts), { lang, view, lever: true, paper: false });
      fig.build();
      fig.layout_for(w, undefined);
      const P = fig.formula, room = P.lever_room()!;
      expect(P.missing).toBe(0);
      expect(fig.lint().filter((i) => i.rule === 'invariant').map((i) => i.message)).toEqual([]);
      const edge = room.x - P.box.x - 2;
      for (let n = 0; n <= P.opens.length; n++) for (const e of [0.94, 0.97, 1]) {
        const ink = P.ink_at(e, n);
        const right = Math.max(...ink.glyphs.flat().map((q) => q[0]), ...ink.cards.flat().map((q) => q[0]), ...ink.labels.map((b) => b.x + b.w));
        expect(right, `layer ${n} at ${e}`).toBeLessThanOrEqual(edge);
      }
      const t = P.ink_at(0, 0).glyphs.flat().map((q) => q[0]);
      expect(Math.abs((Math.min(...t) + Math.max(...t)) / 2 - P.box.w / 2)).toBeLessThan(2);
      expect(Math.max(...t)).toBeLessThan(edge);
    });
  }
});

// The label search, where it costs most: when not every word has room (gravity at 420 px in Chinese), and a long
// formula of many blocks with long words, the worst a lesson might write (1.8 s before the obstacles were bucketed and
// the words placed for the cards at rest). It finishes, and the same formula lays out the same every time.
describe('the label search, when not every word has room', () => {
  const lay = (tex: string, parts: FormulaPart[], lang: 'en' | 'zh', view: PartsView, w: number) => {
    const fig = parts_figure(tex, parts, { lang, view, lever: true, paper: false });
    fig.build();
    fig.layout_for(w, undefined);
    return fig.formula;
  };
  it('keeps the best it found, the same every time', () => {
    const G = FORMULAS.find((f) => f.id === 'gravity')!;
    const zh = (ps: FormulaPart[]): FormulaPart[] => ps.map((p) => ({ tex: p.tex, says: (p.says as { zh: string }).zh, ...(p.parts ? { parts: zh(p.parts) } : {}) }));
    const a = lay(G.tex, zh(G.parts), 'zh', '3d', 420), b = lay(G.tex, zh(G.parts), 'zh', '3d', 420);
    for (let n = 0; n <= a.opens.length; n++) expect(a.ink_at(1, n).labels).toEqual(b.ink_at(1, n).labels);
    expect(a.ink_at(1, 0).labels.length).toBeGreaterThan(0);
  });
  it('a long formula of many blocks with long words lays out in a moment', () => {
    const says = 'what this term adds to the whole, in words long enough to need two or three lines of their own';
    const terms = ['a_1 x_1^2', 'b_2 \\sin(x_2)', 'c_3 e^{x_3}', 'd_4 \\log x_4', 'f_5 \\sqrt{x_5}', 'g_6 x_6'];
    const parts: FormulaPart[] = terms.map((t) => { const [k, v] = t.split(' '); return { tex: t, says, parts: [{ tex: k, says: 'its weight, how much it counts' }, { tex: v, says }] }; });
    for (const view of ['split', '3d'] as const) {
      const t0 = performance.now();
      const F = lay(`y = ${terms.join(' + ')}`, parts, 'en', view, 672);
      expect(F.issues).toEqual([]);
      // (generous, for a slow machine: about 0.1 s here)
      expect(performance.now() - t0).toBeLessThan(1500);
    }
  });
});
