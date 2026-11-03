// The determinant as an area: the unit square spanned by î and ĵ becomes the parallelogram spanned by A's columns,
// and det A is its (signed) area. Then ĵ is turned onto î's line (the plane collapses, det = 0) and past it (the
// orientation flips, det < 0). Explore: drag the tips of î and ĵ.
//
// On the engine: four params (the entries of A) are the whole state; the grid, the parallelogram, the arrows, the
// orientation arc, the matrix and the readouts are functions of them. The parallelogram takes the colour of what the
// determinant is doing (ochre: scaled, vermilion: collapsed, violet: flipped), and the words say so in the same
// colour; î and ĵ keep their colours in the arrows, the matrix's columns and the formula.
import { Arrow, Drawn, Figure, Marker, Path, Region, column, derive, hide, over, reveal, row, set, t, together, wait, type Param, type XY } from '@mathnim/engine';
import { look } from '@mathnim/look';
import { define_figure } from '../visual';
import { angle_of, col, det2, from_angle, from_cols, mat2, norm2, wrap_pi, type Mat2, type Vec2 } from './math';

export interface DeterminantAreaParams extends Record<string, unknown> {
  A: number[][];
  show_collapse: boolean;
}

const I: Mat2 = [[1, 0], [0, 1]];
/** Below this |det| the plane counts as squashed. */
export const DET_ZERO = 0.05;

/** ĵ turned onto the line of î (same length), and mirrored past it: the collapse and the flip. */
export function collapse_and_flip(A: Mat2): { flat: Mat2; flipped: Mat2 } | null {
  const c1 = col(A, 0), c2 = col(A, 1);
  if (norm2(c1) < 0.3 || norm2(c2) < 0.3 || Math.abs(det2(A)) < DET_ZERO) return null;
  const a1 = angle_of(c1), a2 = angle_of(c2);
  // the direction of î's line closest to ĵ
  const onto = Math.abs(wrap_pi(a2 - a1)) <= Math.PI / 2 ? a1 : a1 + Math.PI;
  const d = wrap_pi(onto - a2);
  const r = norm2(c2);
  return { flat: from_cols(c1, from_angle(onto, r)), flipped: from_cols(c1, from_angle(onto + d, r)) };
}

/** The four entries of A as params; get()/set() as the old MatrixTrackers (lessons' goals and solve() use them). */
export class MatrixParams {
  constructor(public t: [Param<number>, Param<number>, Param<number>, Param<number>]) {}
  get(): Mat2 {
    const [a, b, c, d] = this.t.map((x) => x.value);
    return [[a, b], [c, d]];
  }
  set(m: Mat2): void {
    [m[0][0], m[0][1], m[1][0], m[1][1]].forEach((v, i) => this.t[i].set(v, true));
  }
}
export class DeterminantFigure extends Figure {
  M!: MatrixParams;
}

const sign_role = (d: number): string => (d < -DET_ZERO ? 'noun:flipped' : d > DET_ZERO ? 'noun:determinant' : 'noun:collapsed');

export function determinant_figure(p: DeterminantAreaParams): DeterminantFigure {
  const A = mat2(p.A);
  const fig = new DeterminantFigure({ lang: 'en' });
  const R = 3.2;
  const e = (name: string, v: number) => fig.param(name, v, { range: [-R, R], step: 0.1 });
  const [a, b, c, d] = [e('a', I[0][0]), e('b', I[0][1]), e('c', I[1][0]), e('d', I[1][1])];
  const M = (fig.M = new MatrixParams([a, b, c, d]));
  const det = derive(() => det2(M.get()), 'det A');
  const cf = collapse_and_flip(A);
  const reach = (m: Mat2) => Math.max(norm2(col(m, 0)), norm2(col(m, 1)), norm2([m[0][0] + m[0][1], m[1][0] + m[1][1]]));
  const ext = Math.max(2.3, reach(A), cf ? reach(cf.flipped) : 0) + 0.4;

  // ---- the plane
  const ticks = Array.from({ length: 2 * Math.ceil(ext * 2) + 1 }, (_, i) => i - Math.ceil(ext * 2));
  // (the faint grid is the plane before A moves it: the moved grid is read against it)
  const P = fig.plot({ id: 'plane', x: [-ext, ext], y: [-ext, ext], x_ticks: ticks, y_ticks: ticks, aspect: 'equal', fill: true, axes: 'origin', numbers: false, priority: 2, says: t('the plane: the grid moves with A', '平面：网格跟着 A 一起变') });
  const drawn = fig.param('drawn', 0, { range: [0, 1], doc: 'how much of the moved grid is drawn' });
  const grown = fig.param('grown', 0, { range: [0, 1], doc: 'how far î and ĵ have grown' });
  const n = Math.ceil(ext * 4);
  // the grid A moves (cobalt, faint), and the two lines through the origin it moves most visibly (î's and ĵ's)
  const lattice = (only_axes: boolean) => () => {
    const m = M.get(), out: XY[][] = [];
    const at = (x: number, y: number): XY => [m[0][0] * x + m[0][1] * y, m[1][0] * x + m[1][1] * y];
    for (let k = -n; k <= n; k++) if (!only_axes || k === 0) out.push([at(k, -n), at(k, n)], [at(-n, k), at(n, k)]);
    return out;
  };
  const grid = P.add(new Path(lattice(false), { id: 'grid', role: 'noun:grid', width: 1.1, alpha: 0.4, z: 1.1, upto: drawn }));
  const axes = P.add(new Path(lattice(true), { id: 'grid_axes', role: 'noun:grid', width: 1.75, alpha: 0.8, z: 1.15, upto: drawn }));
  const corners = (): XY[] => {
    const m = M.get(), i: XY = [m[0][0], m[1][0]], j: XY = [m[0][1], m[1][1]];
    return [[0, 0], i, [i[0] + j[0], i[1] + j[1]], j];
  };
  // one region per state of the determinant (only one has points at a time), so each keeps its colour and name
  const para = (['noun:determinant', 'noun:collapsed', 'noun:flipped'] as const).map((role) =>
    P.add(new Region(() => (sign_role(det.value) === role ? corners() : []), { id: `area_${role.split(':')[1]}`, role: role.replace('noun', 'region'), fill: 0.28, says: t('the unit square, moved by A', '单位正方形变成的平行四边形') })));
  const i_hat = P.add(new Arrow([0, 0], () => [a.value, c.value], { id: 'i_hat', role: 'noun:i-hat', upto: grown, says: t('where î lands: the first column of A', 'î 落到的位置：A 的第一列') }));
  const j_hat = P.add(new Arrow([0, 0], () => [b.value, d.value], { id: 'j_hat', role: 'noun:j-hat', upto: grown, says: t('where ĵ lands: the second column of A', 'ĵ 落到的位置：A 的第二列') }));
  // the flash where the plane collapses (a ring at the origin, there for a moment)
  const flash = P.add(new Marker([0, 0], { id: 'flash', role: 'noun:collapsed', shape: 'ring', r: 18 }));
  // orientation: the short turn from î to ĵ
  const orient = P.add(new Drawn((env, pl) => {
    const m = M.get(), c1 = col(m, 0), c2 = col(m, 1), a1 = angle_of(c1), sweep = wrap_pi(angle_of(c2) - a1);
    const o = pl.P([0, 0]), r = 36, u = pl.unit();
    if (Math.abs(sweep) < 0.3 || norm2(c1) / u < 44 || norm2(c2) / u < 44) return null;
    const g = env.g, col_ = look().palette[sign_role(det.value) === 'noun:flipped' ? 'violet' : sign_role(det.value) === 'noun:collapsed' ? 'vermilion' : 'ochre'];
    // (y is down on the canvas: angles turn the other way)
    const s0 = -a1, s1 = -(a1 + sweep);
    g.strokeStyle = col_;
    g.fillStyle = col_;
    g.lineWidth = 3;
    g.beginPath();
    g.arc(o[0], o[1], r, s0, s1, sweep > 0);
    g.stroke();
    const tip: XY = [o[0] + r * Math.cos(s1), o[1] + r * Math.sin(s1)], dir = sweep > 0 ? -1 : 1;
    const tx = -Math.sin(s1) * dir, ty = Math.cos(s1) * dir;
    g.beginPath();
    g.moveTo(tip[0] + tx * 9, tip[1] + ty * 9);
    g.lineTo(tip[0] - ty * 5.5, tip[1] + tx * 5.5);
    g.lineTo(tip[0] + ty * 5.5, tip[1] - tx * 5.5);
    g.closePath();
    g.fill();
    return { x: o[0] - r, y: o[1] - r, w: 2 * r, h: 2 * r };
  }, { id: 'orientation', role: 'noun:determinant', z: 2.5 }));
  // names at the tips, and |det| inside the parallelogram while it is wide enough to hold it
  fig.label('\\hat{\\imath}', i_hat, { id: 'i_word', tex: true, role: 'noun:i-hat', sides: ['right', 'below-right', 'above-right', 'below', 'above'] });
  fig.label('\\hat{\\jmath}', j_hat, { id: 'j_word', tex: true, role: 'noun:j-hat', sides: ['above', 'above-left', 'left', 'above-right', 'right'] });
  const area_word = fig.label(() => {
    const m = M.get(), side = Math.max(norm2(col(m, 0)), norm2(col(m, 1)), 1e-9), thick = (Math.abs(det.value) / side) / P.unit();
    return thick > 40 && Math.min(norm2(col(m, 0)), norm2(col(m, 1))) / P.unit() > 60 ? Math.abs(det.value).toFixed(2) : '';
  }, () => {
    const m = M.get();
    return P.P([(m[0][0] + m[0][1]) / 2, (m[1][0] + m[1][1]) / 2]);
  }, { id: 'area_word', role: 'text', kind: 'readout', sides: ['center'], own: [...para, grid, axes] });

  // ---- the numbers: A with its columns in î's and ĵ's colours, the formula, det A and what it means
  const pal = look().palette, I_C = pal.viridian, J_C = pal.vermilion;
  const f1 = (v: number) => v.toFixed(1).replace('-', '−');
  const matrix = fig.readout([{ tex: () => {
    const m = M.get();
    return `A = \\begin{bmatrix} \\color{${I_C}}{${f1(m[0][0])}} & \\color{${J_C}}{${f1(m[0][1])}} \\\\ \\color{${I_C}}{${f1(m[1][0])}} & \\color{${J_C}}{${f1(m[1][1])}} \\end{bmatrix}`;
  } }], { id: 'matrix', kind: 'display', says: t("the matrix A: its columns are where î and ĵ land", '矩阵 A：两列是 î 和 ĵ 落到的位置') });
  const formula = fig.readout([{ tex: `\\det A = \\color{${I_C}}{a}\\color{${J_C}}{d} - \\color{${J_C}}{b}\\color{${I_C}}{c}` }], { id: 'det_formula', kind: 'display' });
  const det_ro = fig.readout([{ tex: '\\det A =' }, { value: () => det.value, decimals: 2, template: '−0.00' }], { id: 'det_readout', role: () => sign_role(det.value), kind: 'display' });
  const message = fig.caption(() => {
    const dv = det.value;
    if (dv > DET_ZERO) return t('areas are scaled by [|det A|](noun:determinant); the orientation is kept', '面积乘以 [|det A|](noun:determinant)，方向不变');
    if (dv < -DET_ZERO) return t('[det A < 0](noun:flipped): the orientation is flipped', '[det A < 0](noun:flipped)：方向翻转了');
    return t('[det A = 0](noun:collapsed): the plane is squashed onto a line', '[det A = 0](noun:collapsed)：平面被压成一条线');
  }, { id: 'det_message' });

  fig.layout(row([P, column([matrix, formula, det_ro, message], { gap: 22 })], { weights: [1.5, 1], gap: 28, align: 'center' }));
  // the hand moves each column's tip
  fig.handle(P, a, c, { id: 'i_handle', says: t('the tip of î', 'î 的终点') });
  fig.handle(P, b, d, { id: 'j_handle', says: t('the tip of ĵ', 'ĵ 的终点') });
  fig.check('the readout is the area', () => {
    const q = corners(), area = Math.abs(((q[1][0] * q[3][1]) - (q[3][0] * q[1][1])));
    return Math.abs(area - Math.abs(det.peek())) < 1e-9 ? null : `area ${area} but |det| ${Math.abs(det.peek())}`;
  });

  // the original scene's timings (its narration is timed to them)
  const morph = (m: Mat2, dur: number) => over(dur, together(set(a, m[0][0], 'travel'), set(b, m[0][1], 'travel'), set(c, m[1][0], 'travel'), set(d, m[1][1], 'travel')));
  fig.script(
    over(1.3, together(reveal(P, grid, axes), set(drawn, 1, 'draw'))),
    over(0.9, together(reveal(i_hat, j_hat, fig.labels[0], fig.labels[1]), set(grown, 1, 'grow'))),
    over(1.2, reveal(...para, orient, area_word)),
    over(1, reveal(matrix)),
    morph(A, 3),
    over(1.2, reveal(formula, det_ro)),
    over(0.8, reveal(message)),
    wait(1),
    ...(p.show_collapse && cf
      ? [morph(cf.flat, 2.5), over(0.3, reveal(flash)), over(0.7, hide(flash)), wait(0.8), morph(cf.flipped, 2), wait(1.2), morph(A, 2.5)]
      : Math.abs(det2(A)) <= DET_ZERO ? [over(0.3, reveal(flash)), over(0.7, hide(flash))] : []),
    wait(1.5),
  );
  return fig;
}

export const determinant_area = define_figure<DeterminantAreaParams>({
  name: 'determinant_area',
  summary: "det A as area: the unit square becomes the parallelogram of A's columns with signed area det A; then ĵ turns onto î's line (det 0, plane squashed) and past it (det < 0, orientation flipped). Student drags î and ĵ.",
  topics: ['linear algebra', 'determinant', 'area', 'orientation', 'linear transformations'],
  params: {
    A: { type: 'matrix', rows: 2, cols: 2, min: -3, max: 3, default: [[1.5, 1], [0.5, 2]], doc: 'the matrix, rows first [[a, b], [c, d]]; det = ad - bc. Use parallel columns for det 0 and swapped orientation for det < 0' },
    show_collapse: { type: 'boolean', default: true, doc: 'after showing det A, turn ĵ onto î\'s line (det 0) and past it (det < 0), then back' },
  },
  examples: [{}, { A: [[1, 2], [0.5, 1]] }, { A: [[1, 2], [1, -1]] }, { A: [[3, 0], [0, 2]], show_collapse: false }],
  ids: ['plane', 'grid', 'i_hat', 'j_hat', 'area_determinant', 'orientation', 'matrix', 'det_readout', 'det_formula', 'det_message'],
  figure: determinant_figure,
  // (the handles on î's and ĵ's tips are part of the figure; an explore step turns them on)
  explore: () => {},
});
