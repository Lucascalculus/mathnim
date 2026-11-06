// MGMT90141 lesson 13 on the engine: a probability under the normal curve, read the way the paper reads it. Two axes
// under one curve: the question's own units (dollars, miles) and z. The script standardises first, as motion: a bar one
// standard deviation long steps out from the mean, and every step drops a line from the question's axis onto the z
// axis, where the count is written (the mean lands on 0, one σ above it on 1): z = (x − μ)/σ is how many of those steps
// x is from the mean. Then the value of the question drops onto the z axis, and the area fills. The table only ever
// gives the area to the left, and the motion shows how everything else is made from it: a right tail is the left area
// handed over to the rest (1 − table), a "between" is the left area of the upper value with the left area of the lower
// one taken away, and backwards the area fills until it is the given one, then its z rises to the question's axis.
// The arithmetic is normal.ts (common.py's ztable and z_from_table, every entry tested); the figure only draws it.
import {
  Figure, Handle, Label, Path, Plot, Readout, Region, Spacer, beat, column, derive, font_of, hide, over, reveal, row, seq, set, t, text_width, together, wait,
  type Param, type Part, type Step, type XY,
} from '@mathnim/engine';
import { define_figure } from '../visual';
import { LANG_SPEC, figure_lang } from '../mpc/kit';
import * as N from './normal';

export interface NormalParams extends Record<string, unknown> {
  mu: number;
  sd: number;
  unit: string;
  mode: string;
  a: number;
  b: number;
  p: number;
  from: number;
  story: string;
  lang: string;
}

export class NormalFigure extends Figure {
  edges: Param<number>[] = [];
  area: Param<number> | null = null;
}

/** The ticks of both axes: the mean and three standard deviations either side. */
const KS = [-3, -2, -1, 0, 1, 2, 3];

export function normal_figure(p: NormalParams): NormalFigure {
  const lang = figure_lang(p.lang);
  const mode = (['left', 'right', 'between', 'find'].includes(p.mode) ? p.mode : 'left') as N.Mode;
  const mu = p.mu, sd = Math.max(1e-9, Math.abs(p.sd)), money = p.unit === '$';
  const has_from = mode === 'find' && p.from !== 0 && Number.isFinite(p.from);
  const fig = new NormalFigure({ lang });
  const lo = mu - 3.6 * sd, hi = mu + 3.6 * sd;
  const dp = N.decimals_of(mu, sd), step = N.hand_step(sd);

  // ---- state: the edges the hand moves (in the question's units), or the area it gives (backwards)
  const reach: [number, number] = [mu - 3.4 * sd, mu + 3.4 * sd];
  const clampx = (x: number) => Math.min(reach[1], Math.max(reach[0], x));
  const a = fig.param('a', clampx(p.a), { range: reach, step, says: t('the edge', '边界'), doc: 'an edge, in the question’s units' });
  const b = fig.param('b', clampx(p.b), { range: reach, step, says: t('the upper edge', '上边界'), doc: 'the upper edge (between)' });
  const area = fig.param('p', p.p, { range: [0.0001, 0.9999], step: 0.0001, says: t('the area given', '给定的面积'), doc: 'the area given (backwards)' });
  fig.edges = mode === 'between' ? [a, b] : mode === 'find' ? [] : [a];
  fig.area = mode === 'find' ? area : null;
  const RD = derive(() => N.read_normal({ mode, mu, sd, a: a.value, b: b.value, p: area.value, from: has_from ? p.from : null }), 'the reading');

  // ---- how the numbers are written: the question's units grouped as the paper groups them, the table to four places
  const group = (v: number, d = dp) => {
    const [i, f] = Math.abs(v).toFixed(d).split('.');
    return `${v < 0 && Math.abs(v) >= 0.5 * 10 ** -d ? '−' : ''}${i.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}${f ? `.${f}` : ''}`;
  };
  const T4 = (v: number) => v.toFixed(4);
  const P4 = (v: number) => (v.toFixed(4).replace(/0+$/, '').length < 4 ? v.toFixed(2) : v.toFixed(4).replace(/0+$/, ''));

  // ---- the plot: x in the question's units; heights are a rule on the box (the curve above, the two axes below)
  const P = fig.plot({
    id: 'curve', x: [lo, hi], y: [0, 1], axes: 'none', numbers: false, grid: false, priority: 2, aspect: 1.2, phone_aspect: 1.25,
    says: t('the normal curve: the area under it between two values is the probability of falling between them', '正态曲线：两个值之间曲线下的面积，就是落在这两个值之间的概率'),
  });
  const AX = 58; // (the two axes' room under the curve: the question's axis, its numbers, the z axis, its numbers)
  const base = () => P.data.h - AX, zline = () => P.data.h - AX + 34;
  const D = (x: number, ypx: number): XY => [x, 1 - ypx / P.data.h];
  const Xpx = (x: number) => ((x - lo) / (hi - lo)) * P.data.w;
  const curve_y = (x: number) => base() - (N.pdf((x - mu) / sd) / N.pdf(0)) * (base() - 8);
  const fig_pt = (x: number, ypx: number): XY => [P.data.x + Xpx(x), P.data.y + ypx];
  const XS = Array.from({ length: 145 }, (_, i) => lo + ((hi - lo) * i) / 144);
  // (each axis's name stands on its line at the left end; the line and the curve start after it)
  const x0 = () => lo + (16 / P.data.w) * (hi - lo);

  // the curve, drawn on
  const drawn = fig.param('drawn', 1, { range: [0, 1], doc: 'how much of the curve is drawn' });
  const curve = P.add(new Path(() => [x0(), ...XS.filter((x) => x > x0())].map((x) => D(x, curve_y(x))), { id: 'bell', role: 'noun:density', width: 2.5, upto: drawn, says: t('the normal curve', '正态曲线') }));

  // the area: its two bounds follow the edges; the script's progress params move them from the left end
  const u_to = fig.param('u_to', 1, { range: [0, 1], doc: 'the area filled up to its right bound' });
  const u_from = fig.param('u_from', 1, { range: [0, 1], doc: 'the area left of the lower edge taken away' });
  const u_flip = fig.param('u_flip', 1, { range: [0, 1], doc: 'the left area handed over to the right tail' });
  const lerp = (x0: number, x1: number, u: number) => x0 + (x1 - x0) * u;
  const bounds = (): [number, number] => {
    const r = RD.value;
    if (mode === 'left') return [lo, lerp(lo, r.lo, u_to.value)];
    if (mode === 'right') return [lerp(lo, r.lo, u_flip.value), lerp(lerp(lo, r.lo, u_to.value), hi, u_flip.value)];
    if (mode === 'between') return [lerp(lo, r.lo, u_from.value), lerp(lo, r.hi, u_to.value)];
    return [has_from ? lerp(lo, r.lo, u_from.value) : lo, lerp(lo, r.hi, u_to.value)];
  };
  const shade = P.add(new Region(() => {
    const [x0, x1] = bounds();
    if (x1 - x0 < 1e-9 * sd) return [];
    const xs = [x0, ...XS.filter((x) => x > x0 && x < x1), x1];
    return [D(x0, base()), ...xs.map((x) => D(x, curve_y(x))), D(x1, base())];
  }, { id: 'area', role: 'region:density', fill: 0.22, edge: false, says: t('the area: the probability', '面积：也就是概率') }));

  // ---- the two axes
  const scaffold = P.add(new Path(() => [[D(x0(), base()), D(hi, base())], ...KS.map((k) => [D(mu + k * sd, base()), D(mu + k * sd, base() + 5)])], { id: 'x_axis', role: 'scaffold', width: 1.25, says: t('the question’s own units', '题目本身的单位') }));
  const zdraw = fig.param('zdraw', 1, { range: [0, 1], doc: 'the z axis drawn' });
  const z_axis = P.add(new Path(() => [D(x0(), zline()), D(hi, zline())], { id: 'z_axis', role: 'noun:z-score', width: 1.5, upto: zdraw, says: t('the z axis: standard deviations from the mean', 'z 轴：离均值几个标准差') }));
  // the fibres from a tick of the question's axis down to its count on the z axis
  const fib = KS.map((k) => fig.param(`fib_${k}`, 1, { range: [0, 1], doc: `the line from mean + ${k} sd down to z = ${k}` }));
  // (a fibre leaves the question's axis under its number, so no line runs through a number)
  const under = () => base() + 25;
  const fibres = KS.map((k, i) => P.add(new Path(() => [D(mu + k * sd, under()), D(mu + k * sd, zline())], { id: `fibre_${k}`, role: 'noun:z-score', width: 1.25, alpha: 0.55, upto: fib[i] })));
  const zticks = P.add(new Path(() => KS.map((k) => [D(mu + k * sd, zline()), D(mu + k * sd, zline() + 5)]), { id: 'z_ticks', role: 'noun:z-score', width: 1.25 }));

  // the edges: a line up to the curve, a line down to the z axis (backwards: up from it), and both values written
  type Edge = { x: () => number; z: () => number; up: boolean; id: string };
  const edges: Edge[] = mode === 'between'
    ? [{ id: 'a', x: () => RD.value.lo, z: () => RD.value.z_lo, up: false }, { id: 'b', x: () => RD.value.hi, z: () => RD.value.z_hi, up: false }]
    : mode === 'find'
      ? [...(has_from ? [{ id: 'from', x: () => RD.value.lo, z: () => RD.value.z_lo, up: false }] : []), { id: 'found', x: () => RD.value.hi, z: () => RD.value.z_hi, up: true }]
      : [{ id: 'a', x: () => RD.value.lo, z: () => RD.value.z_lo, up: false }];
  const edge_drop = edges.map((e) => fig.param(`drop_${e.id}`, 1, { range: [0, 1], doc: `edge ${e.id}: the line between the axes drawn` }));
  const edge_lines = edges.map((e) => P.add(new Path(() => [D(e.x(), base()), D(e.x(), curve_y(e.x()))], { id: `edge_${e.id}`, role: 'text', width: 2, says: t('an edge of the area', '面积的一条边') })));
  const edge_fibres = edges.map((e, i) => P.add(new Path(() => {
    const x = e.x(), tick: XY[] = [D(x, base()), D(x, base() + 6)], drop: XY[] = [D(x, under()), D(x, zline())];
    return e.up ? [[...drop].reverse(), [...tick].reverse()] : [tick, drop];
  }, { id: `edge_fibre_${e.id}`, role: 'noun:z-score', width: 2, upto: edge_drop[i] })));

  // the bar one standard deviation long that steps out from the mean (and its mirror)
  const stand = fig.param('stand', 0, { range: [0, 3], doc: 'how many standard deviations the bar has stepped out' });
  const bar = P.add(new Path(() => {
    const s = stand.value, k0 = Math.max(0, s - 1), y = base() - 9, out: XY[][] = [];
    for (const sg of [1, -1]) {
      const xa = mu + sg * k0 * sd, xb = mu + sg * s * sd;
      if (Math.abs(s) < 1e-6) continue;
      out.push([D(xa, y - 5), D(xa, y + 5)], [D(xa, y), D(xb, y)], [D(xb, y - 5), D(xb, y + 5)]);
    }
    return out;
  }, { id: 'sigma_bar', role: 'noun:z-score', width: 2.25, says: t('one standard deviation', '一个标准差') }));

  // ---- words on the axes (labels: they stand clear of each other by rule)
  const lfont = font_of('label', { weight: 500 }), bfont = font_of('label', { weight: 600 });
  const W = () => P.data.w;
  // (numbers stay inside the plot, and right of the axes' names at the left end)
  const inside = (cx: number, w: number) => Math.min(W() - w / 2, Math.max(15 + w / 2, cx));
  const edge_text = edges.map((e) => () => group(e.x()));
  const edge_z_text = edges.map((e) => () => `${e.z() < 0 ? '−' : ''}${Math.abs(e.z()).toFixed(2)}`);
  // the edges' numbers stand under their edge, inside the plot, and two edges' numbers push each other apart
  const spread = (texts: (() => string)[]): number[] => {
    const ws = texts.map((f) => text_width(f(), bfont)), cs = edges.map((e, i) => inside(Xpx(e.x()), ws[i]));
    if (cs.length === 2) {
      const [l, r] = cs[0] <= cs[1] ? [0, 1] : [1, 0], need = (ws[0] + ws[1]) / 2 + 8, short = need - (cs[r] - cs[l]);
      if (short > 0) {
        cs[l] -= short / 2;
        cs[r] += short / 2;
        if (cs[l] < 15 + ws[l] / 2) [cs[l], cs[r]] = [15 + ws[l] / 2, 15 + ws[l] / 2 + need];
        if (cs[r] > W() - ws[r] / 2) [cs[l], cs[r]] = [W() - ws[r] / 2 - need, W() - ws[r] / 2];
      }
    }
    return cs;
  };
  const edge_x_labels: Label[] = [], edge_z_labels: Label[] = [];
  edges.forEach((e, i) => {
    edge_x_labels.push(fig.label(edge_text[i], () => [P.data.x + spread(edge_text)[i], P.data.y + base() + 15] as XY, {
      id: `edge_x_${e.id}`, avoid: false, sides: ['center'], gap: 0, weight: 600, says: t('the value in the question’s units', '题目单位下的值'),
    }));
    edge_z_labels.push(fig.label(edge_z_text[i], () => [P.data.x + spread(edge_z_text)[i], P.data.y + zline() + 15] as XY, {
      id: `edge_z_${e.id}`, avoid: false, sides: ['center'], gap: 0, weight: 600, role: 'noun:z-score', says: t('its z', '它的 z'),
    }));
  });
  // a tick's number gives way to an edge's and to its axis's name (and on a narrow plot only every other one is numbered)
  const clear_of = (k: number, ls: Label[], texts: (() => string)[], w: number) => {
    const cx = Xpx(mu + k * sd);
    if (cx - w / 2 < 14) return false;
    const cs = spread(texts);
    return ls.every((l, i) => l.opacity.value < 0.01 || Math.abs(cs[i] - cx) > (w + text_width(texts[i](), bfont)) / 2 + 6);
  };
  const every = () => (W() / 7.2 >= text_width(group(mu + 3 * sd), lfont) + 10 ? 1 : 2);
  const x_numbers = KS.map((k) => fig.label(() => {
    const s = group(mu + k * sd);
    return k % every() === 0 && clear_of(k, edge_x_labels, edge_text, text_width(s, lfont)) ? s : '';
  }, () => fig_pt(mu + k * sd, base() + 15), { id: `x_num_${k}`, avoid: false, sides: ['center'], gap: 0, role: 'muted' }));
  const z_numbers = KS.map((k) => fig.label(() => {
    const s = k < 0 ? `−${-k}` : String(k);
    return clear_of(k, edge_z_labels, edge_z_text, text_width(s, lfont)) ? s : '';
  }, () => fig_pt(mu + k * sd, zline() + 15), { id: `z_num_${k}`, avoid: false, sides: ['center'], gap: 0, role: 'noun:z-score' }));
  const x_name = fig.label('x', () => fig_pt(lo, base()), { id: 'x_name', avoid: false, sides: ['right'], gap: 1, role: 'muted', weight: 600 });
  const z_name = fig.label('z', () => fig_pt(lo, zline()), { id: 'z_name', avoid: false, sides: ['right'], gap: 1, role: 'noun:z-score', weight: 600 });
  const sigma_word = fig.label('σ', () => {
    const s = Math.max(0.5, stand.value);
    return fig_pt(mu + (Math.max(0, s - 1) + 0.5 * Math.min(1, s)) * sd, base() - 24);
  }, { id: 'sigma_word', avoid: false, sides: ['center'], gap: 0, role: 'noun:z-score', weight: 600 });

  // ---- the hand: the edges (a glass bead where each meets the curve), or the area given
  const handles: Handle[] = [];
  edges.forEach((e) => {
    if (mode === 'find') return;
    const param = e.id === 'b' ? b : a;
    handles.push(fig.handle(P, param, null, { id: `edge_handle_${e.id}`, says: e.id === 'b' ? t('the upper edge', '上边界') : mode === 'between' ? t('the lower edge', '下边界') : t('the edge', '边界') }));
    const h = handles[handles.length - 1];
    h.o.at = () => fig_pt(param.value, curve_y(param.value));
  });
  let track: Plot | null = null;
  if (mode === 'find') {
    track = new Plot({ id: 'area_track', x: [0, 1], y: [0, 1], x_ticks: [0, 0.5, 1], grid: false, axes: 'x', numbers: false, aspect: 12, max_aspect: 0.12 });
    fig.handle(track, area, null, { id: 'area_handle', says: t('the area given', '给定的面积') });
    const T = track, line = () => T.data.y + T.data.h;
    fig.label(() => P4(area.value), () => [T.data.x + T.data.w + 20, line()], { id: 'area_value', avoid: false, sides: ['right'], gap: 0, weight: 600, role: 'noun:density' });
    fig.label(t('area', '面积'), () => [T.data.x - 16, line()], { id: 'area_name', avoid: false, sides: ['left'], gap: 0, role: 'noun:density' });
  }

  // ---- the working, as the exam writes it: each line a readout in the interface's own face (not TeX's serif), the
  // results in their nouns' colours (z violet, the area blue)
  const VIO = 'noun:z-score', BLUE = 'noun:density';
  const Zs = (z: number) => (z === 0 ? '0.00' : `${z < 0 ? '−' : ''}${Math.abs(z).toFixed(2)}`);
  const money_s = (v: number) => `${money ? '$' : ''}${group(v)}`;
  const line = (id: string, parts: Part[], kind: 'label' | 'readout' = 'label') => fig.readout(parts, { id, kind });
  const say = (f: () => string) => ({ text: f });
  const res = (id: string, v: () => string, color: string, kind: 'label' | 'readout' = 'label') => line(id, [{ text: '=' }, { text: v, color }], kind);
  const zf = (x: number) => `(${group(x)} − ${group(mu)}) / ${group(sd)}`;
  const givens = line('givens', [{ text: `μ = ${money_s(mu)}` }, { gap: 1 }, { text: `σ = ${money_s(sd)}` }]);
  const lines: Readout[] = [];
  let question: Readout;
  const steps_of: Readout[][] = [];
  if (mode === 'left' || mode === 'right') {
    question = line('question', [say(() => `P(X ${mode === 'left' ? '<' : '>'} ${group(RD.value.lo)})`)], 'readout');
    const zs = [line('z_formula', [say(() => `z = ${zf(RD.value.lo)}`)]), res('z_result', () => Zs(RD.value.z_lo), VIO)];
    if (mode === 'left') steps_of.push(zs, [line('answer', [say(() => `P(Z < ${Zs(RD.value.z_lo)}) =`), { text: () => T4(RD.value.area), color: BLUE }], 'readout')]);
    else steps_of.push(zs, [line('table', [say(() => `P(Z < ${Zs(RD.value.z_lo)}) = ${T4(RD.value.t_lo)}`)])], [line('answer', [say(() => `1 − ${T4(RD.value.t_lo)} =`), { text: () => T4(RD.value.area), color: BLUE }], 'readout')]);
  } else if (mode === 'between') {
    question = line('question', [say(() => `P(${group(RD.value.lo)} < X < ${group(RD.value.hi)})`)], 'readout');
    steps_of.push(
      [line('z_lo', [say(() => `z = ${zf(RD.value.lo)}`)]), res('z_lo_result', () => Zs(RD.value.z_lo), VIO), line('z_hi', [say(() => `z = ${zf(RD.value.hi)}`)]), res('z_hi_result', () => Zs(RD.value.z_hi), VIO)],
      [line('table', [say(() => `P(Z < ${Zs(RD.value.z_hi)}) = ${T4(RD.value.t_hi)}`)])],
      [line('answer', [say(() => `${T4(RD.value.t_hi)} − ${T4(RD.value.t_lo)} =`), { text: () => T4(RD.value.area), color: BLUE }], 'readout')],
    );
  } else {
    const d = has_from ? 'd' : 'x';
    question = line('question', [say(() => (has_from ? `P(${group(p.from)} < X < d) = ${P4(area.value)}` : `P(X < x) = ${P4(area.value)}`))], 'readout');
    steps_of.push(
      has_from ? [line('z_formula', [say(() => `z = ${zf(p.from)}`)]), res('z_result', () => Zs(RD.value.z_lo), VIO), line('target', [say(() => `${T4(RD.value.t_lo)} + ${P4(area.value)} = ${T4(RD.value.target!)}`)])] : [],
      [line('table', [say(() => T4(RD.value.t_hi)), { tex: '\\Rightarrow' }, { text: 'z =' }, { text: () => Zs(RD.value.z_hi), color: VIO }])],
      [line('x_formula', [say(() => `${d} = ${group(mu)} + ${RD.value.z_hi < 0 ? `(${Zs(RD.value.z_hi)})` : Zs(RD.value.z_hi)}(${group(sd)})`)]), res('answer', () => money_s(RD.value.hi), 'ink', 'readout')],
    );
  }
  lines.push(givens, question, ...steps_of.flat());

  // ---- layout: the curve beside its working; on a phone the working under it
  const hand_row = track ? [new Spacer(6), row([new Spacer(0), track, new Spacer(0)], { weights: [0.5, 2, 0.8], phone: 'row' }), new Spacer(12)] : [];
  fig.layout(row([P, column([...hand_row, ...lines], { gap: 4, align: 'center' })], { weights: [1.35, 1], gap: 20, align: 'center' }), {
    phone: column([P, ...hand_row, ...lines], { gap: 4 }),
  });
  fig.aside(t('The paper’s table: z rounded to two places, the area to the left to four places.', '试卷上的表：z 取两位小数，表中是左边的面积，四位小数。'));

  // ---- report and checks
  fig.report_with(() => {
    const r = RD.peek();
    return { mode, lo: r.lo, hi: r.hi, z_lo: r.z_lo, z_hi: r.z_hi, area: r.area, target: r.target ?? null, x: mode === 'find' ? r.hi : null };
  });
  fig.check('the area is read off the table as the paper reads it', () => {
    const r = RD.peek();
    const want = mode === 'left' ? N.ztable(r.z_lo) : mode === 'right' ? 1 - N.ztable(r.z_lo) : mode === 'between' ? N.ztable(r.z_hi) - N.ztable(r.z_lo) : r.area;
    if (Math.abs(r.area - want) > 5e-5) return `area ${r.area}, table says ${want}`;
    if (mode !== 'find' && (r.z_lo !== N.z_of(r.lo, mu, sd) || r.z_hi !== N.z_of(r.hi, mu, sd))) return 'z is not (x − μ)/σ to two places';
    if (mode === 'find' && N.z_from_table(r.target!) !== r.z_hi) return 'backwards: not the closest entry';
    return null;
  });
  fig.check('the shaded area is the one asked for', () => {
    if (u_to.peek() < 1 || u_from.peek() < 1 || u_flip.peek() < 1) return null; // (still being made by the script)
    const [x0, x1] = bounds();
    const r = RD.peek(), near = (u: number, v: number) => Math.abs(u - v) < 1e-6 * sd;
    if (mode === 'left') return near(x0, lo) && near(x1, r.lo) ? null : 'left tail';
    if (mode === 'right') return near(x0, r.lo) && near(x1, hi) ? null : 'right tail';
    return near(x0, has_from || mode === 'between' ? r.lo : lo) && near(x1, r.hi) ? null : 'between';
  });

  // ---- the script
  const axes_things = [scaffold, ...x_numbers, x_name];
  const z_things = [z_axis, zticks, z_name];
  const edge_things = edges.flatMap((_, i) => [edge_lines[i], edge_fibres[i], edge_x_labels[i], edge_z_labels[i]]);
  if (p.story === 'shown') {
    fig.script(over(0.6, reveal(P, curve, shade, ...axes_things, ...z_things, ...fibres, ...z_numbers, ...edge_things, ...lines)), wait(0.2));
    for (const th of [bar, sigma_word]) th.opacity.set(0);
    return fig;
  }
  const start: Step[] = [
    over(0.6, reveal(P, ...axes_things, givens)),
    over(1.1, set(drawn, 1, 'draw')),
    beat(),
  ];
  // standardising: the z axis draws on, the mean drops to 0, then the bar steps out a standard deviation at a time
  const pair = (k: number): Step => together(...[k, -k].filter((v, i) => i === 0 || v !== k).map((v) => {
    const i = KS.indexOf(v);
    return together(over(0.35, set(fib[i], 1, 'draw')), over(0.3, reveal(z_numbers[i])));
  }));
  const standardise: Step[] = [
    together(over(0.5, reveal(...z_things)), over(0.6, set(zdraw, 1, 'draw'))),
    pair(0),
    over(0.3, reveal(bar, sigma_word)),
    over(0.7, set(stand, 1, 'travel')), pair(1),
    over(0.55, set(stand, 2, 'travel')), pair(2),
    over(0.55, set(stand, 3, 'travel')), pair(3),
    over(0.3, hide(bar, sigma_word)),
    beat(),
  ];
  const edge_in = (i: number): Step => together(over(0.3, reveal(edge_lines[i], edge_fibres[i], edge_x_labels[i])), seq(over(0.45, set(edge_drop[i], 1, 'draw')), over(0.25, reveal(edge_z_labels[i]))));
  let rest: Step[];
  if (mode === 'find') {
    const found = edges.length - 1;
    rest = [
      over(0.4, reveal(question)),
      ...(has_from ? [edge_in(0), over(0.35, reveal(steps_of[0][0], steps_of[0][1])), beat()] : []),
      over(0.3, reveal(shade)),
      over(1.4, set(u_to, 1, 'grow')),
      ...(has_from ? [over(0.35, reveal(steps_of[0][2])), over(0.9, set(u_from, 1, 'travel'))] : []),
      beat(),
      over(0.35, reveal(steps_of[1][0], edge_z_labels[found])),
      together(over(0.3, reveal(edge_lines[found], edge_fibres[found])), over(0.6, set(edge_drop[found], 1, 'draw'))),
      over(0.3, reveal(edge_x_labels[found], ...steps_of[2])),
      wait(0.6),
    ];
  } else {
    rest = [
      ...edges.map((_, i) => edge_in(i)),
      over(0.4, reveal(question, ...steps_of[0])),
      beat(),
      over(0.3, reveal(shade)),
      over(1.4, set(u_to, 1, 'grow')),
      over(0.35, reveal(...steps_of[1])),
      ...(mode === 'right' ? [over(1.0, set(u_flip, 1, 'travel')), over(0.35, reveal(...steps_of[2]))] : []),
      ...(mode === 'between' ? [over(1.0, set(u_from, 1, 'travel')), over(0.35, reveal(...steps_of[2]))] : []),
      wait(0.6),
    ];
  }
  // (what the script moves starts where the script starts it)
  drawn.set(0, true);
  zdraw.set(0, true);
  for (const f of fib) f.set(0, true);
  for (const e of edge_drop) e.set(0, true);
  u_to.set(0, true);
  if (mode === 'between' || has_from) u_from.set(0, true);
  if (mode === 'right') u_flip.set(0, true);
  fig.script(...start, ...standardise, ...rest);
  return fig;
}

export const mgmt_normal = define_figure<NormalParams>({
  name: 'mgmt_normal',
  summary: 'A probability under the normal curve read as the paper reads it: two axes under one curve, the question’s units and z. The script standardises as motion (a bar one σ long steps out from the mean, each step dropping onto the z axis), drops the question’s value onto z, then fills the area; a right tail is the table’s left area handed to the rest (1 − table), a between is one left area minus another, and backwards the area fills to the given one and its z rises to x. Modes left, right, between, find (given an area, find x; with `from`, P(from < X < x) = p). The readout is the paper’s four-place table with z rounded to two places.',
  topics: ['normal distribution', 'standard normal', 'z score', 'probability', 'area under the curve', 'statistics'],
  params: {
    mu: { type: 'number', min: -1e9, max: 1e9, default: 409000, doc: 'the mean, in the question’s units (the 2025 exam: 409,000 dollars; the tyre: 36,500 miles)' },
    sd: { type: 'number', min: 1e-6, max: 1e9, default: 19500, doc: 'the standard deviation (19,500; the tyre 5,000)' },
    unit: { type: 'enum', values: ['', '$'], default: '$', doc: "'$' writes answers in x as money" },
    mode: { type: 'enum', values: ['left', 'right', 'between', 'find'], default: 'left', doc: "'left': P(X < a); 'right': P(X > a); 'between': P(a < X < b); 'find': the x with P(X < x) = p (or, with from, P(from < X < x) = p)" },
    a: { type: 'number', min: -1e9, max: 1e9, default: 380000, doc: 'the edge (left, right) or the lower edge (between), in the question’s units' },
    b: { type: 'number', min: -1e9, max: 1e9, default: 450000, doc: 'the upper edge (between)' },
    p: { type: 'number', min: 0.0001, max: 0.9999, default: 0.1, doc: 'the area given (find)' },
    from: { type: 'number', min: -1e9, max: 1e9, default: 0, doc: 'find: a lower edge (P(from < X < x) = p); 0 for none' },
    story: { type: 'enum', values: ['standardise', 'shown'], default: 'standardise', doc: "'standardise': the curve, then standardising as motion, then the value onto z, then the area; 'shown': everything at once" },
    lang: LANG_SPEC,
  },
  examples: [
    {}, { lang: 'zh' }, { mode: 'between', a: 370000, b: 450000 }, { mode: 'find', p: 0.1 }, { mode: 'find', p: 0.4503, from: 385000, lang: 'zh' },
    { mu: 36500, sd: 5000, unit: '', mode: 'right', a: 40000 }, { mu: 36500, sd: 5000, unit: '', a: 45000, story: 'shown', lang: 'zh' },
    { mu: 32.62, sd: 2.32, mode: 'between', a: 30, b: 35, story: 'shown' },
  ],
  ids: ['curve', 'bell', 'area', 'z_axis', 'answer'],
  figure: normal_figure,
  explore: () => {},
});
