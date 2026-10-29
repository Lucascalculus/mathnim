// M3: an MPC without limits is the fixed feedback u_0 = −K_N x_0, and K_N
// depends on the horizon N. Two panels, k_p and k_v against N = 1..N_max for
// the cart (Q = diag(1, q_v), R = r, Δt = 0.1 s): with terminal weight P = Q
// the gain grows with N and settles on the LQR gain (dashed); with P = P_∞
// (the LQR cost-to-go) it is the LQR gain for every N, even N = 1. Values from
// the Riccati recursion (weights_math.gains_by_horizon), equal to the first
// rows of H⁻¹F of the condensed QP (tested). No handles.
import { Create, Dot, FadeIn, Scene, VGroup } from 'manim-web';
import { palette } from '../theme';
import { define_visual } from '../visual';
import { dlqr, double_integrator } from './math';
import { LANG_SPEC, Plot, pick, polyline, resolve_lang, tex, words, type XY } from './kit';
import { gains_by_horizon } from './weights_math';
import { aside } from '../aside';

export interface GainHorizonParams extends Record<string, unknown> {
  q_v: number;
  r: number;
  N_max: number;
  lang: string;
}

/** Up to five round ticks from 0 to just below hi. */
function ticks(hi: number): number[] {
  const raw = hi / 4, mag = 10 ** Math.floor(Math.log10(raw)), step = [1, 2, 5, 10].map((m) => m * mag).find((s) => s >= raw) ?? 10 * mag;
  const out: number[] = [];
  for (let v = 0; v <= hi + 1e-9; v += step) out.push(+v.toFixed(6));
  return out;
}

export const mpc_gain_horizon = define_visual<GainHorizonParams>({
  name: 'mpc_gain_horizon',
  summary: 'The gain K_N = [k_p, k_v] of an unconstrained MPC on the cart against its horizon N (u_0 = −K_N x_0): with terminal weight P = Q it rises and settles on the LQR gain; with P = P_∞ (LQR cost-to-go) it equals the LQR gain for every N. Static figure.',
  topics: ['mpc', 'lqr', 'riccati', 'horizon', 'terminal cost', 'control'],
  params: {
    q_v: { type: 'number', min: 0, max: 100, default: 0, doc: 'speed weight q_v in Q = diag(1, q_v) (0 = the docking cost of M1)' },
    r: { type: 'number', min: 0.01, max: 100, default: 0.1, doc: 'input weight R = r (0.1 in M1)' },
    N_max: { type: 'integer', min: 20, max: 80, default: 50, doc: 'largest horizon shown (steps of 0.1 s)' },
    lang: LANG_SPEC,
  },
  examples: [{}, { lang: 'zh' }, { q_v: 1, r: 1, N_max: 80 }, { q_v: 10, r: 50, N_max: 80, lang: 'zh' }, { r: 0.01, N_max: 20 }],
  ids: ['title', 'note', 'kp_plot', 'kv_plot', 'pq_curves', 'pinf_curves', 'lqr_lines', 'legend'],
  scene: (p) => {
    const lang = resolve_lang(p.lang);
    const L = (en: string, zh: string) => pick(lang, en, zh);
    const { A, B } = double_integrator(0.1);
    const Q = [[1, 0], [0, p.q_v]], R = [[p.r]];
    const lqr = dlqr(A, B, Q, R);
    const N = p.N_max;
    const by_q = gains_by_horizon(Q, R, Q, N), by_inf = gains_by_horizon(Q, R, lqr.P, N);
    class GainHorizon extends Scene {
      override construct() {
        const c = palette();
        const title = VGroup(tex('u_0 = -K_N\\, x_0', 32, c.ink), words(L('the gain of an MPC without limits, against its horizon N', '没有约束的 MPC 的增益，随预测时域 N 的变化'), 24, c.ink, 0, 0));
        title.submobjects[0].move_to([-6.9 + (title.submobjects[0] as any).width / 2, 3.45, 0]);
        title.submobjects[1].move_to([-6.9 + (title.submobjects[0] as any).width + 0.3 + (title.submobjects[1] as any).width / 2, 3.45, 0]);
        title.name = 'title';
        const qv = +p.q_v.toPrecision(3), rr = +p.r.toPrecision(3);
        const note = aside(this, words(L(`the cart: Q = diag(1, ${qv}), R = ${rr}, Δt = 0.1 s · computed by the Riccati recursion`, `小车：Q = diag(1, ${qv})，R = ${rr}，Δt = 0.1 秒 · 用 Riccati 递推算出`), 20, c.muted, -6.9, 2.95, { max_w: 13.6 }));
        note.name = 'note';
        const panel = (j: 0 | 1, x0: number, x1: number, name: string) => {
          const hi = Math.max(lqr.K[0][j], ...by_q.map((k) => k[j]), ...by_inf.map((k) => k[j])) * 1.18;
          const plot = new Plot({
            box: { x0, x1, y0: -2.85, y1: 1.3 }, x: [0, N], y: [0, hi], x_ticks: Array.from({ length: Math.floor(N / 10) + 1 }, (_, i) => 10 * i), y_ticks: ticks(hi),
            x_label: { tex: 'N' }, y_label: { tex: name }, font: 22,
          });
          const lqr_line = VGroup(plot.hline(lqr.K[0][j], c.ink, { width: 2.5 }), plot.note(`LQR ${lqr.K[0][j].toFixed(2)}`, N, lqr.K[0][j] + hi * 0.1, c.ink, 22, 'right'));
          const pts = (ks: number[][]): XY[] => ks.map((k, i) => [i + 1, k[j]] as XY);
          const pq = plot.curve(pts(by_q), { color: c.accent, width: 4.5 });
          // P = P∞: one dot per horizon (every second one past 50), so "every N" is visible on top of the LQR line
          const stride = N > 50 ? 2 : 1;
          const pinf = VGroup(...pts(by_inf).filter((_, i) => (i + 1) % stride === 0 || i === 0).map(([n, k]) => Dot([plot.X(n), plot.Y(k), 0], { radius: 0.055, color: c.good, fill_opacity: 1 })));
          return { plot, lqr_line, pq, pinf };
        };
        const left = panel(0, -6.0, -0.75, 'k_p'), right = panel(1, 1.15, 6.4, 'k_v');
        left.plot.group.name = 'kp_plot';
        right.plot.group.name = 'kv_plot';
        const pq = VGroup(left.pq, right.pq), pinf = VGroup(left.pinf, right.pinf), lqr_lines = VGroup(left.lqr_line, right.lqr_line);
        pq.name = 'pq_curves';
        pinf.name = 'pinf_curves';
        lqr_lines.name = 'lqr_lines';
        const leg = (y: number, color: string, dots: boolean, s: string) =>
          VGroup(dots ? VGroup(...[-5.9, -5.7, -5.5].map((x) => Dot([x, y, 0], { radius: 0.055, color, fill_opacity: 1 }))) : polyline([[-6.0, y], [-5.4, y]], color, 4.5), words(s, 22, c.ink, -5.25, y));
        const legend = VGroup(
          leg(2.45, c.accent, false, L('terminal weight P = Q: grows with N, settles on the LQR gain', '终端权重 P = Q：随 N 增大，最后停在 LQR 增益上')),
          leg(2.05, c.good, true, L('terminal weight = the LQR cost-to-go: the LQR gain for every N', '终端权重取 LQR 的剩余代价：任何 N 都等于 LQR 增益')),
        );
        legend.name = 'legend';
        this.play(FadeIn(title), FadeIn(note), FadeIn(left.plot.group), FadeIn(right.plot.group), { run_time: 1.2 });
        this.play(FadeIn(legend.submobjects[0]), Create(left.pq), Create(right.pq), { run_time: 2.2 });
        this.play(FadeIn(lqr_lines), { run_time: 0.8 });
        this.play(FadeIn(legend.submobjects[1]), FadeIn(left.pinf), FadeIn(right.pinf), { run_time: 1.6 });
        this.add(title, note, left.plot.group, right.plot.group, pq, pinf, lqr_lines, legend);
        this.wait(2.5);
      }
    }
    return new GainHorizon();
  },
});
