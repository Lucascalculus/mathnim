// Acts (lib/steps_acts.ts): what was done to both sides, read from two lines and shown being done. The table of what
// is read (and what is not: a derivative, a condition, an act already written out, ×/÷ under an inequality), the act
// line coloured only where the act is, and the picture: every written line at rest is exactly its typeset line, each
// part of a change is continuous, the act line is passed through without a jump, what cancels is struck and what
// combines is bracketed, and nothing is liquid.
import { beforeAll, describe, expect, it } from 'vitest';
import { act_tex, infer_act, load_tex, typeset_line, Steps } from '../src/index';
import { use_node_canvas } from '../node';

beforeAll(async () => {
  use_node_canvas();
  await load_tex();
});

describe('the act between two lines', () => {
  const T: [string, string, string | null][] = [
    ['2x + 3 = 11', '2x = 8', 'add - 3'],
    ['2x = 8', 'x = 4', 'div 2'],
    ['\\frac{x}{2} = 4', 'x = 8', 'mul 2'],
    ['3x - 5 = 2x + 1', 'x - 5 = 1', 'add - 2x'],
    ['x^2 + 2x = 3', 'x^2 + 2x - 3 = 0', 'add - 3'],
    ['x + 2 < 5', 'x < 3', 'add - 2'],
    // sums cannot be evaluated: read by their writing
    ['\\frac{2}{n}\\sum_i x_i\\,(w x_i - y_i) = 0', '\\sum_i x_i\\,(w x_i - y_i) = 0', 'mul \\frac{n}{2}'],
    ['w\\sum_i x_i^2 - \\sum_i x_i y_i = 0', 'w\\sum_i x_i^2 = \\sum_i x_i y_i', 'add + \\sum_i x_i y_i'],
    ['w\\sum_i x_i^2 = \\sum_i x_i y_i', 'w = \\frac{\\sum_i x_i y_i}{\\sum_i x_i^2}', 'div \\sum_ix_i^2'],
    // not one act on both sides
    ["L'(w) = 2w - 4", '2w - 4 = 0', null],
    ['2x + 3 = 11', '2x + 3 - 3 = 11 - 3', null],
    ['2x < 6', 'x < 3', null],
    ['(x+1)^2 = 4', 'x + 1 = 2', null],
  ];
  it.each(T)('%s → %s', (a, b, want) => {
    const act = infer_act(a, b);
    expect(act ? `${act.kind}${act.op ? ` ${act.op}` : ''} ${act.tex}` : null).toBe(want);
  });
  it('the act line colours only the act: the operation and its operand, on both sides', () => {
    const tex = act_tex('2x + 3 = 11', infer_act('2x + 3 = 11', '2x = 8')!, '#E4572E');
    const L = typeset_line(tex);
    expect(L.error).toBeNull();
    const lit = L.tokens.filter((t) => t.glyphs[0].fill).map((t) => t.key);
    expect(lit).toEqual(['−', '3', '−', '3']);
    // (and the operator keeps its spacing: it is the same width as the uncoloured line)
    expect(Math.abs(L.view[2] - typeset_line('2x + 3 - 3 = 11 - 3').view[2])).toBeLessThan(0.5);
  });
});

describe('a derivation showing its acts', () => {
  const SRC = '2x + 3 = 11\n2x = 8 % take 3 from both sides\nx = 4 % divide both sides by 2';
  const make = (src = SRC, stack = false) => new Steps(src, { id: 's', why: false, acts: true, stack });
  it('passes through an act line before each line that is an act, and only those', () => {
    const st = make('2x + 3 = 11\n2x = 8\nx^2 = 64');
    expect(st.act_of(1)?.kind).toBe('add');
    expect(st.act_of(2)).toBeNull();
    expect(st.dur_into(1, 1)).toBeGreaterThan(st.dur_into(2, 1));
  });
  it('at rest every written line is exactly its typeset line', () => {
    const st = make();
    for (let k = 0; k < st.lines.length; k++) {
      const ps = st.pieces(k), toks = st.typeset[k].tokens;
      expect(ps.length).toBe(toks.length);
      ps.forEach((p, i) => { expect(p.glyphs).toBe(toks[i].glyphs); expect(p.w).toBe(1); expect(p.dy).toBe(0); });
    }
  });
  it('each part of a change is continuous, and the act line is passed through without a jump', () => {
    const st = make();
    for (let k = 0; k + 1 < st.lines.length; k++) {
      let prev: { s: number; ps: ReturnType<Steps['pieces']> } | null = null, worst = 0;
      for (let i = 1; i < 400; i++) {
        const v = k + i / 400, [s] = st.seq_at(v), ps = st.pieces(v);
        if (prev && prev.s === s && prev.ps.length === ps.length) ps.forEach((p, j) => {
          const q = prev!.ps[j];
          worst = Math.max(worst, Math.hypot(p.dx - q.dx, p.dy - q.dy), Math.abs(p.w - q.w) * 20, Math.abs(p.scale - q.scale) * 20);
        });
        else if (prev && prev.s !== s) {
          // across the boundary: what is drawn at the end of the first part is where the act line has it at rest
          for (const r of st.seq_pieces(s, 0)) {
            const near = prev.ps.some((p) => p.w > 0.9 && Math.hypot(p.dx + p.cx - (r.dx + r.cx), p.dy + p.cy - (r.dy + r.cy)) < 0.6);
            expect(near, `line ${k}: the act line's ${r.glyphs.map((g) => g.c).join('')} is there as it comes to rest`).toBe(true);
          }
        }
        prev = { s, ps };
      }
      expect(worst, `line ${k}`).toBeLessThan(2);
    }
  });
  it('what cancels is struck through, what combines is bracketed; nothing is liquid', () => {
    const st = make();
    // the act line of 2x + 3 - 3 = 11 - 3, being worked out
    const s = st.seq_at(0.8)[0];
    const marks = st.seq_marks(s, 0.15);
    expect(marks.filter((m) => m.kind === 'strike').length).toBe(1);
    expect(marks.filter((m) => m.kind === 'bracket').length).toBe(1);
    for (let v = 0.05; v < 2; v += 0.05) for (const p of st.pieces(v)) expect(p.liquid).toBe(false);
  });
  it('written lines kept (stack): the same lines at rest, and the act drawn where the next line will be', () => {
    const st = make(SRC, true);
    for (let k = 0; k < st.lines.length; k++) expect(st.pieces(k).length).toBe(st.typeset[k].tokens.length);
    expect(st.seq_at(0.45)[0]).toBe(1);
  });
});
