// mobject/graphing: numbers checked against manim v0.21 (values computed with the engine venv, 480x270 config).
import { beforeAll, describe, expect, it } from 'vitest';
import * as M from '../src/index';
import { config } from '../src/_config';
import { plot_isoline } from '../src/utils/isosurfaces';

const { Axes, NumberLine, NumberPlane, PolarPlane, ComplexPlane, ThreeDAxes, ImplicitFunction, FunctionGraph, ParametricFunction, SampleSpace, LogBase, Complex, PI, TAU } = M as any;

const close = (a: any, b: any, tol = 1e-9) => {
  const fa = [a].flat(3) as number[], fb = [b].flat(3) as number[];
  expect(fa.length).toBe(fb.length);
  fa.forEach((x, i) => expect(Math.abs(x - fb[i])).toBeLessThanOrEqual(tol));
};
const pts = (m: any, i: number) => [m.points[3 * i], m.points[3 * i + 1], m.points[3 * i + 2]];

beforeAll(() => {
  config.pixel_width = 480;
  config.pixel_height = 270;
});

describe('Axes', () => {
  const ax = () => Axes({ x_range: [-1, 6, 1], y_range: [-2, 8, 2], x_length: 8, y_length: 5 });
  it('coords_to_point / point_to_coords', () => {
    const a = ax();
    close(a.c2p(2, 3), [-0.571428571428571, 0.0, 0.0]);
    // manim returns the transposed (3, n) array for c2p(xs, ys)
    close(a.c2p([1, 2, 3], [0, 4, 6]), [[-1.7142857142857144, -0.5714285714285705, 0.5714285714285721], [-1.5, 0.5, 1.5], [0, 0, 0]]);
    close(a.c2p([[1, 0], [2, 4]]), [[-1.7142857142857144, -1.5, 0.0], [-0.5714285714285705, 0.5, 0.0]]);
    close(a.p2c([1.0, 0.5, 0]), [3.375, 4.000000000000002]);
    close(a.get_origin(), [-2.8571428571428577, -1.5, 0.0]);
    close(a.x_axis.get_tick_range(), [-1, 1, 2, 3, 4, 5]);
  });
  it('plot samples like manim (x step / 10, smoothing)', () => {
    const a = ax();
    const g = a.plot((x: number) => 0.3 * x ** 2 - 1);
    expect(g.points.length / 3).toBe(280);
    close([0, 1, 2, 3, 4].map((i) => pts(g, i)), [[-4.0, -1.85, 0], [-3.961904761904762, -1.859711324865405, 0], [-3.923809523809524, -1.8694226497308102, 0], [-3.885714285714286, -1.8784999999999998, 0], [-3.885714285714286, -1.8784999999999998, 0]], 1e-9);
    close(pts(g, g.points.length / 3 - 1), [4.000000000000001, 3.3999999999999995, 0.0]);
    close(a.i2gp(2.5, g), [0, -1.0625, 0]);
    expect(a.slope_of_tangent(2.0, g)).toBeCloseTo(1.1999999955591076, 6);
  });
  it('plot with discontinuities', () => {
    const g = ax().plot((x: number) => (x ** 2 - 2) / (x ** 2 - 4), { discontinuities: [2], dt: 0.1, x_range: [0, 5, 0.25] });
    expect(g.points.length / 3).toBe(80);
    const ref = [[-2.8571428571428577, -1.25, 0.0], [-2.2857142857142856, -1.2666666666666666, 0.0], [-1.8098639455782308, -1.3155087472051754, 0.0], [-1.3346027070622066, -1.447576794217074, 0.0], [-0.8571428571428574, -2.0666666666666664, 0.0], [-0.17142857142857104, -0.3431855500821024, 0.0], [0.30476237472536594, -0.7170327673190353, 0.0], [0.7809541342775979, -0.8347775629271873, 0.0], [1.2571428571428571, -0.8883928571428572, 0.0], [1.8285714285714287, -0.9219359875097579, 0.0], [2.3000245465530433, -0.9390255964995373, 0.0], [2.763272319423318, -0.9505355422050078, 0.0]];
    close(ref.map((_, k) => pts(g, 7 * k)), ref, 1e-9);
  });
  it('riemann rectangles', () => {
    const a = ax();
    const r = a.get_riemann_rectangles(a.plot((x: number) => 0.3 * x ** 2 - 1), { x_range: [0, 3], dx: 0.4 });
    expect(r.submobjects.length).toBe(8);
    close(r.submobjects[3].get_center(), [-1.2569142857142857, -1.642, 0.0], 1e-9);
  });
  it('log scaling', () => {
    close(Axes({ x_range: [0, 10], y_range: [-2, 6], y_axis_config: { scaling: LogBase() } }).c2p(5, 100), [0, 0, 0], 1e-9);
  });
});

describe('NumberLine', () => {
  it('ticks, n2p, unit size', () => {
    const nl = NumberLine({ x_range: [-3, 3, 1], length: 6, include_tip: true });
    const ticks = nl.get_tick_range();
    close(ticks, [-3, -2, -1, 0, 1, 2]);
    expect(Object.is(ticks[3], -0)).toBe(true); // numpy keeps -0.0
    close(nl.n2p(1.5), [1.5, 0, 0]);
    expect(nl.get_unit_size()).toBeCloseTo(1, 12);
    close(nl.get_end(), [3, 0, 0], 1e-12);
    close(nl.p2n([1.5, 0, 0]), 1.5, 1e-12);
  });
  it('decimal places from the step', () => {
    expect(NumberLine._decimal_places_from_step(1)).toBe(0);
    expect(NumberLine._decimal_places_from_step(1, true)).toBe(1);
    expect(NumberLine._decimal_places_from_step(0.05)).toBe(2);
  });
});

describe('planes', () => {
  it('NumberPlane / PolarPlane line counts', () => {
    const np = NumberPlane({ x_range: [-4, 11, 1], y_range: [-3, 3, 1], x_length: 5, y_length: 2, faded_line_ratio: 2 });
    expect(np.background_lines.submobjects.length).toBe(17);
    expect(np.faded_lines.submobjects.length).toBe(23);
    const pp = PolarPlane({ radius_max: 3 });
    expect(pp.background_lines.submobjects.length).toBe(24);
    close(pp.pr2pt(2, PI / 3), [1.0000000000000004, 1.7320508075688767, 0.0], 1e-12);
  });
  it('ComplexPlane n2p / p2n', () => {
    const cp = ComplexPlane();
    close(cp.n2p(new Complex(1, 2)), [1, 2, 0], 1e-12);
    const z = cp.p2n([1, 1, 0]);
    close([z.re, z.im], [1, 1], 1e-12);
  });
  it('ThreeDAxes', () => {
    const t = ThreeDAxes();
    close(t.c2p(1, 2, 3), [0.8750000000000004, 2.099999999999999, 2.4375], 1e-12);
    expect(t.x_axis.pieces.submobjects.length).toBe(20);
  });
});

describe('functions', () => {
  it('point counts', () => {
    expect(FunctionGraph((x: number) => Math.sin(x), { x_range: [-2, 2] }).points.length / 3).toBe(1600);
    expect(ParametricFunction((t: number) => [Math.cos(t), Math.sin(t), 0], { t_range: [0, TAU], use_smoothing: false }).points.length / 3).toBe(2516);
  });
  it('ImplicitFunction (isosurfaces port) matches manim', () => {
    const imp = ImplicitFunction((x: number, y: number) => x * y ** 2 - x ** 2 * y - 2);
    expect(imp.points.length / 3).toBe(3484);
    expect(imp.get_subpaths().length).toBe(3);
    close([0, 1, 2].map((i) => pts(imp, i)), [[-7.055555555555555, -0.04040874406555764, 0.0], [-7.0519231732096905, -0.04045297826956348, 0.0], [-7.048290790863827, -0.04049721247356933, 0.0]], 1e-9);
  });
  it('plot_isoline finds a circle', () => {
    const curves = plot_isoline((p) => p[0] ** 2 + p[1] ** 2 - 1, [-2, -2], [2, 2]);
    expect(curves.length).toBe(1);
    for (const [x, y] of curves[0]) expect(Math.abs(Math.hypot(x, y) - 1)).toBeLessThan(1e-2);
  });
});

describe('SampleSpace', () => {
  it('horizontal division', () => {
    const parts = SampleSpace().get_horizontal_division([0.3, 0.2]);
    close(parts.submobjects.map((p: any) => p.get_center()), [[0.0, 1.05, 0.0], [0.0, 0.30000000000000004, 0.0], [0.0, -0.75, 0.0]], 1e-12);
  });
});
