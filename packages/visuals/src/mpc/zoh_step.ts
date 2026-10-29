// M2's static figure: where B's ½Δt² comes from. Over one sample the input is
// held (zero-order hold), so the speed grows linearly and the distance covered,
// the area under v(t), is a rectangle Δt·v_k plus a triangle ½Δt²·a_k. Forward
// Euler keeps only the rectangle. Top: a(t) as held steps; bottom: v(t) with the
// two areas; right: the two position updates. Schematic (no units).
import { FadeIn, Scene, VGroup } from 'manim-web';
import { palette } from '../theme';
import { define_visual } from '../visual';
import { LANG_SPEC, Plot, fill_box, fill_poly, fit, pick, resolve_lang, tex, words, type XY } from './kit';
import { aside } from '../aside';

export interface ZohStepParams extends Record<string, unknown> {
  lang: string;
}

// data: one step has length 1; the held inputs before, during and after step k
const A_HELD = [0.5, 1.0, 0.15];
const V_K = 1.0;

export const mpc_zoh_step = define_visual<ZohStepParams>({
  name: 'mpc_zoh_step',
  summary: 'Static figure (schematic): over one sample the acceleration a_k is held (zero-order hold), so v(t) is a straight ramp from v_k to v_k + Δt a_k and the distance covered (the area under v) is a rectangle Δt v_k plus a triangle ½Δt² a_k. Exact ZOH: p_{k+1} = p_k + Δt v_k + ½Δt² a_k; forward Euler keeps only the rectangle.',
  topics: ['mpc', 'discretization', 'zero-order hold', 'euler', 'double integrator'],
  params: { lang: LANG_SPEC },
  examples: [{}, { lang: 'zh' }],
  ids: ['a_plot', 'a_steps', 'v_plot', 'rect', 'tri', 'v_line', 'labels', 'exact', 'euler', 'note'],
  scene: (p) => {
    const L = (en: string, zh: string) => pick(resolve_lang(p.lang), en, zh);
    class ZohStep extends Scene {
      override construct() {
        const c = palette();
        const tick_t = (v: number) => (v === 0 ? 't_k' : v === 1 ? 't_{k+1}' : '');
        // ---- a(t): held steps
        const ap = new Plot({ box: { x0: -6.0, x1: -0.6, y0: 1.75, y1: 3.0 }, x: [-1, 2], y: [0, 1.25], x_ticks: [0, 1], x_fmt: tick_t, y_ticks: [], grid: false, y_label: { tex: 'a(t)' }, font: 24 });
        ap.group.name = 'a_plot';
        const steps: XY[] = [];
        A_HELD.forEach((a, i) => steps.push([i - 1, a]));
        const a_faint = ap.stairs(steps, { color: c.muted, width: 3 }, 2);
        const a_now = ap.curve([[0, A_HELD[1]], [1, A_HELD[1]]], { color: c.coral, width: 5 });
        const a_lab = tex('a_k', 26, c.coral);
        a_lab.move_to([ap.X(0.5), ap.Y(A_HELD[1]) + 0.25, 0]);
        const a_steps = VGroup(a_faint, a_now, a_lab);
        a_steps.name = 'a_steps';

        // ---- v(t): a ramp inside each step
        const vp = new Plot({ box: { x0: -6.0, x1: -0.6, y0: -2.9, y1: 0.95 }, x: [-1, 2], y: [0, 2.6], x_ticks: [0, 1], x_fmt: tick_t, y_ticks: [], grid: false, y_label: { tex: 'v(t)' }, font: 24 });
        vp.group.name = 'v_plot';
        const v_at = [V_K - A_HELD[0], V_K, V_K + A_HELD[1], V_K + A_HELD[1] + A_HELD[2]];
        const v_pts: XY[] = v_at.map((v, i) => [i - 1, v]);
        const rect = fill_box(vp.X(0), vp.Y(0), vp.X(1), vp.Y(V_K), c.accent, 0.22);
        rect.name = 'rect';
        const tri = fill_poly([[vp.X(0), vp.Y(V_K)], [vp.X(1), vp.Y(V_K)], [vp.X(1), vp.Y(V_K + A_HELD[1])]], c.coral, 0.3);
        tri.name = 'tri';
        const v_line = VGroup(vp.curve(v_pts, { color: c.muted, width: 3 }), vp.curve([[0, V_K], [1, V_K + A_HELD[1]]], { color: c.teal, width: 5 }),
          vp.curve([[0, 0], [0, V_K + A_HELD[1] + 0.25]], { color: c.faint, width: 2 }), vp.curve([[1, 0], [1, V_K + A_HELD[1] + 0.25]], { color: c.faint, width: 2 }));
        v_line.name = 'v_line';
        const vk = tex('v_k', 26, c.teal);
        vk.move_to([vp.X(0) - 0.12 - vk.width / 2, vp.Y(V_K) + 0.18, 0]);
        const vk1 = tex('v_{k+1} = v_k + \\Delta t\\, a_k', 24, c.teal);
        vk1.move_to([vp.X(1) + 0.12 + vk1.width / 2, vp.Y(V_K + A_HELD[1]) + 0.42, 0]);
        const r_lab = tex('\\Delta t\\, v_k', 28, c.accent);
        r_lab.move_to([vp.X(0.5), vp.Y(V_K / 2), 0]);
        const t_lab = tex('\\tfrac12 \\Delta t^2 a_k', 26, c.coral);
        t_lab.move_to([vp.X(0.68), vp.Y(V_K + 0.28), 0]);
        const dt = tex('\\Delta t', 24, c.muted);
        dt.move_to([vp.X(0.5), vp.Y(0) + 0.2, 0]);
        const labels = VGroup(vk, vk1, r_lab, t_lab, dt);
        labels.name = 'labels';

        // ---- right: the two position updates
        const RX0 = 0.4, RX1 = 6.9;
        const head = words(L('distance in one step = the area under v(t)', '一步走过的距离 = v(t) 下面的面积'), 26, c.ink, RX0, 2.75, { max_w: RX1 - RX0, weight: 'BOLD' });
        const ex_h = words(L('exact (input held for the step):', '精确（输入在这一步内保持不变）：'), 22, c.muted, RX0, 1.75, { max_w: RX1 - RX0 });
        const ex = fit(tex('p_{k+1} = p_k + \\Delta t\\, v_k + \\tfrac12 \\Delta t^2 a_k', 34, c.ink) as any, RX1 - RX0);
        ex.move_to([RX0 + ex.width / 2, 1.15, 0]);
        const ex_w = words(L('rectangle + triangle', '矩形 + 三角形'), 22, c.ink, RX0, 0.5, { max_w: RX1 - RX0 });
        const exact = VGroup(ex_h, ex, ex_w);
        exact.name = 'exact';
        const eu_h = words(L('forward Euler (speed frozen at its start value):', '前向欧拉（把速度冻结在这一步开头的值）：'), 22, c.muted, RX0, -0.5, { max_w: RX1 - RX0 });
        const eu = fit(tex('p_{k+1} = p_k + \\Delta t\\, v_k', 34, c.ink) as any, RX1 - RX0);
        eu.move_to([RX0 + eu.width / 2, -1.1, 0]);
        const eu_w = words(L('rectangle only: the triangle is lost every step', '只有矩形：每一步都丢掉那个三角形'), 22, c.coral, RX0, -1.75, { max_w: RX1 - RX0 });
        const euler = VGroup(eu_h, eu, eu_w);
        euler.name = 'euler';
        const note = aside(this, words(L('schematic: one sample of the cart', '示意：小车的一个采样周期'), 20, c.muted, RX0, -2.75, { max_w: RX1 - RX0 }));
        note.name = 'note';

        this.play(FadeIn(ap.group), FadeIn(a_steps), FadeIn(vp.group), FadeIn(rect), FadeIn(tri), FadeIn(v_line), FadeIn(labels), FadeIn(head), FadeIn(exact), FadeIn(euler), FadeIn(note), { run_time: 1 });
        this.wait(7);
      }
    }
    return new ZohStep();
  },
});
