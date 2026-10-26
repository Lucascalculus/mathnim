// M6: a soft speed limit. The docking MPC (N = 20) with the speed limit
// softened (v_k up to 2 + s_k, slack s_k ≥ 0 priced l1·s + s²) and the wall kept
// hard. At t = 3 s a gust pushes the cart to 2.4 m/s. Hard limit: the QP has
// no solution for 3 samples (marked). l1 = 1000: the same motion as the hard
// limit whenever that has a solution, and a solution at every sample. l1 = 10:
// the price is below what speed is worth to the cost, so the limit becomes a
// suggestion: 2.78 m/s with no gust at all. Simulation of the toy cart. No handles.
import { Create, FadeIn, Scene, VGroup } from 'manim-web';
import { palette } from '../theme';
import { define_visual } from '../visual';
import { soft_run } from './terminal_math';
import { LANG_SPEC, Plot, pick, polyline, resolve_lang, words, type XY } from './kit';

export interface SoftLimitParams extends Record<string, unknown> {
  lang: string;
}

export const mpc_soft_limit = define_visual<SoftLimitParams>({
  name: 'mpc_soft_limit',
  summary: 'The cart’s speed over 8 s with a soft speed limit (wall kept hard) after a gust at 3 s: a large slack price (l1 = 1000) follows the hard limit exactly and always has a solution; the hard limit has none for 3 samples (marked); a small price (l1 = 10) treats the limit as a suggestion. Static figure (simulation).',
  topics: ['mpc', 'soft constraints', 'slack', 'exact penalty', 'feasibility', 'control'],
  params: { lang: LANG_SPEC },
  examples: [{}, { lang: 'zh' }],
  ids: ['plot', 'limit', 'gust', 'hard_marks', 'soft_big', 'soft_small', 'legend', 'note'],
  scene: (p) => {
    const lang = resolve_lang(p.lang);
    const L = (en: string, zh: string) => pick(lang, en, zh);
    const hard = soft_run(null), big = soft_run(1000), small = soft_run(10);
    class SoftLimit extends Scene {
      override construct() {
        const c = palette();
        const P = new Plot({ box: { x0: -5.8, x1: 2.6, y0: -2.6, y1: 2.4 }, x: [0, 8], y: [0, 3.3], x_ticks: [0, 2, 4, 6, 8], y_ticks: [0, 1, 2, 3], x_label: { tex: 't\\;(\\mathrm{s})' }, y_label: { tex: 'v\\;(\\mathrm{m/s})' } });
        P.group.name = 'plot';
        const limit = VGroup(P.band(2, 3.3, c.coral, 0.1), P.hline(2, c.coral, { width: 2.5 }), P.note(L('speed limit 2 m/s', '限速 2 m/s'), 0.15, 2.12, c.coral, 20));
        limit.name = 'limit';
        const gust = VGroup(P.vline(3, c.muted, { width: 2 }), P.note(L('gust: +0.4 m/s', '一阵风：+0.4 m/s'), 3.1, 3.1, c.muted, 20));
        gust.name = 'gust';
        const pts = (v: number[]): XY[] => v.map((x, k) => [k * 0.1, x] as XY);
        const soft_small = P.curve(pts(small.v), { color: c.gold, width: 4.5 });
        soft_small.name = 'soft_small';
        const soft_big = P.curve(pts(big.v), { color: c.accent, width: 5 });
        soft_big.name = 'soft_big';
        const marks = VGroup(...hard.feasible.map((f, k) => (f ? null : polyline([[P.X(k * 0.1), P.Y(hard.v[k]) + 0.12], [P.X(k * 0.1), P.Y(hard.v[k]) + 0.42]], c.coral, 4))).filter((m) => m !== null) as any[]);
        const hard_marks = VGroup(marks, P.note(L('hard limit: no solution here', '硬约束：这里无解'), 4.3, 2.75, c.coral, 20));
        hard_marks.name = 'hard_marks';
        const RX = 3.1;
        const item = (y: number, col: string, a: string, b: string) => VGroup(polyline([[RX, y], [RX + 0.5, y]], col, 5), words(a, 22, c.ink, RX + 0.65, y, { max_w: 3.2 }), words(b, 19, c.muted, RX + 0.65, y - 0.38, { max_w: 3.2 }));
        const legend = VGroup(
          item(1.9, c.accent, L('slack price l1 = 1000', '松弛价格 l1 = 1000'), L('= the hard motion, always solvable', '= 硬约束的运动，且永远有解')),
          item(0.85, c.gold, L('slack price l1 = 10', '松弛价格 l1 = 10'), L('too cheap: faster than allowed', '太便宜：一直超速')),
          VGroup(polyline([[RX + 0.25, -0.3], [RX + 0.25, 0.0]], c.coral, 4), words(L('hard limit: QP infeasible', '硬约束：QP 无解'), 22, c.ink, RX + 0.65, -0.15, { max_w: 3.2 })),
          words(L('the wall stays a hard limit', '墙始终是硬约束'), 20, c.muted, RX, -0.85, { max_w: 3.8 }),
        );
        legend.name = 'legend';
        const note = words(L('simulation of a toy cart: N = 20, |a| up to 1 m/s², docking at the wall at 10 m', '玩具小车的模拟：N = 20，|a| 不超过 1 m/s²，停靠到 10 m 处的墙'), 19, c.muted, -6.9, 3.55, { max_w: 13.6 });
        note.name = 'note';
        this.play(FadeIn(P.group), FadeIn(limit), FadeIn(note), FadeIn(gust), { run_time: 1 });
        this.play(Create(soft_big), FadeIn(legend.submobjects[0]), { run_time: 1.6 });
        this.play(FadeIn(hard_marks), FadeIn(legend.submobjects[2]), FadeIn(legend.submobjects[3]), { run_time: 0.8 });
        this.play(Create(soft_small), FadeIn(legend.submobjects[1]), { run_time: 1.6 });
        this.add(legend);
        this.wait(3);
      }
    }
    return new SoftLimit();
  },
});
