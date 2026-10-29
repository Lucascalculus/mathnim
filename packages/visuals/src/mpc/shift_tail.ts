// M6: why a terminal set keeps every later QP solvable (the shift argument), in
// the phase plane. The plan made at some instant (terminal-set MPC, N = 8, the
// moment it starts braking) ends at x_N inside X_f. One step later, a candidate
// plan is ready without solving anything: the old plan without its first step,
// plus one step of the terminal controller ("brake to rest") from x_N. Because
// X_f is invariant under that controller, the new end x_{N+1} is again in X_f,
// and every limit still holds: so the next QP has a solution (maybe a better one).
// Real numbers from the toy-cart simulation. No handles.
import { Circle, Create, FadeIn, Scene, VGroup } from 'manim-web';
import { palette } from '../theme';
import { define_visual } from '../visual';
import { cart_step } from './math';
import { C_TERM, brake_to_rest, term_run } from './terminal_math';
import { LANG_SPEC, Plot, backed, fill_poly, pick, polyline, resolve_lang, tex, words, type XY } from './kit';
import { aside } from '../aside';

export interface ShiftTailParams extends Record<string, unknown> {
  N: number;
  lang: string;
}

/** The plan the figure shows, and the candidate one step later. */
export function shift_tail_data(N: number): { k: number; plan: number[][]; next: number[] } {
  const r = term_run(N, 'set');
  const k = r.shown_k;
  const plan = r.plans[k]!;
  const xN = plan[plan.length - 1];
  const next = cart_step(xN, brake_to_rest(xN[1])).x;
  return { k, plan, next };
}

export const mpc_shift_tail = define_visual<ShiftTailParams>({
  name: 'mpc_shift_tail',
  summary: 'The shift argument for recursive feasibility in the phase plane (p, v): a terminal-set plan x_0..x_N ending in X_f; one step later the candidate x_1..x_N plus one braking step from x_N, which stays in X_f because X_f is invariant under braking. Toy-cart simulation, static figure.',
  topics: ['mpc', 'terminal set', 'recursive feasibility', 'invariant set', 'control'],
  params: { N: { type: 'integer', min: 3, max: 12, default: 8, doc: 'horizon of the terminal-set MPC whose plan is shown' }, lang: LANG_SPEC },
  examples: [{}, { lang: 'zh' }, { N: 5 }],
  ids: ['plane', 'xf', 'xN', 'tail', 'next', 'note'],
  scene: (p) => {
    const lang = resolve_lang(p.lang);
    const L = (en: string, zh: string) => pick(lang, en, zh);
    const d = shift_tail_data(p.N);
    class ShiftTail extends Scene {
      override construct() {
        const c = palette();
        const P = new Plot({ box: { x0: -6.0, x1: 1.2, y0: -2.7, y1: 2.5 }, x: [5.8, 9.2], y: [0.6, 2.25], x_ticks: [6, 7, 8, 9], y_ticks: [1, 2], x_label: { tex: 'p\\;(\\mathrm{m})' }, y_label: { tex: 'v\\;(\\mathrm{m/s})' } });
        P.group.name = 'plane';
        const S = (q: readonly number[]): XY => [P.X(q[0]), P.Y(q[1])];
        const xf = VGroup(
          fill_poly([S([5.8, 0.6]), S([10 - C_TERM * 0.6, 0.6]), S([10 - C_TERM * 2, 2]), S([5.8, 2])], c.good, 0.1),
          P.curve([[10 - C_TERM * 0.6, 0.6], [10 - 2 * C_TERM, 2]], { color: c.good, width: 4, dash: [0.16, 0.1] }),
          backed(tex('\\mathcal X_f', 34, c.good)).move_to(P.P(6.3, 1.15)),
          words(L('edge: p + 1.95 v = 10', '边界：p + 1.95 v = 10'), 20, c.good, P.X(5.95), P.Y(0.72)),
        );
        xf.name = 'xf';
        const dot = (q: readonly number[], col: string, r = 0.08) => {
          const m: any = Circle({ radius: r, fill_color: col, fill_opacity: 1, stroke_width: 0, color: col });
          m.move_to([P.X(q[0]), P.Y(q[1]), 0]);
          return m;
        };
        const pts = d.plan.map(S);
        const plan = VGroup(polyline(pts, c.accent, 3, { dash: [0.12, 0.08] }), ...d.plan.map((q) => dot(q, c.accent)));
        plan.name = 'plan';
        const x0 = VGroup(dot(d.plan[0], c.ink, 0.09), backed(tex('x_0', 28, c.ink)).move_to([pts[0][0] - 0.1, pts[0][1] + 0.35, 0]));
        x0.name = 'x0';
        const xN = backed(tex('x_N', 28, c.accent)).move_to([pts[pts.length - 1][0] - 0.45, pts[pts.length - 1][1] - 0.05, 0]);
        xN.name = 'xN';
        const tail = VGroup(polyline(pts.slice(1), c.ink, 4.5), ...d.plan.slice(1).map((q) => dot(q, c.ink, 0.085)));
        tail.name = 'tail';
        const nx = S(d.next);
        const next = VGroup(polyline([pts[pts.length - 1], nx], c.good, 5), dot(d.next, c.good, 0.1), backed(tex('x_{N+1}', 28, c.good)).move_to([nx[0] + 0.15, nx[1] - 0.4, 0]));
        next.name = 'next';
        const RX = 1.8;
        const caption = VGroup(
          words(L('1. the plan at time k ends in the terminal set', '1. 时刻 k 的计划，终点落在终端集里'), 22, c.accent, RX, 2.0, { max_w: 5.0 }),
          words(L('2. at k + 1: keep its tail', '2. 到 k + 1：保留它的后半段'), 22, c.ink, RX, 1.2, { max_w: 5.0 }),
          words(L('3. append one braking step', '3. 末尾补一步刹车'), 22, c.good, RX, 0.4, { max_w: 5.0 }),
          words(L('Braking never leaves the terminal set,', '刹车永远不会离开终端集，'), 20, c.muted, RX, -0.5, { max_w: 5.0 }),
          words(L('so the new end is inside it again:', '所以新的终点仍在集合里：'), 20, c.muted, RX, -0.9, { max_w: 5.0 }),
          words(L('this candidate keeps every limit, so', '这个候选计划满足每一条限制，'), 20, c.muted, RX, -1.3, { max_w: 5.0 }),
          words(L('the next QP has a solution.', '因此下一次的 QP 必然有解。'), 20, c.muted, RX, -1.7, { max_w: 5.0 }),
        );
        caption.name = 'caption';
        const note = aside(this, words(L(`toy-cart simulation: terminal-set MPC, N = ${p.N}, the plan made at t = ${(d.k * 0.1).toFixed(1)} s`, `玩具小车的模拟：终端集 MPC，N = ${p.N}，t = ${(d.k * 0.1).toFixed(1)} 秒时做的计划`), 20, c.muted, -6.9, 3.55, { max_w: 13.6 }));
        note.name = 'note';
        this.play(FadeIn(P.group), FadeIn(xf), FadeIn(note), { run_time: 1 });
        this.play(Create(plan.submobjects[0]), FadeIn(VGroup(...plan.submobjects.slice(1))), FadeIn(x0), FadeIn(xN), FadeIn(caption.submobjects[0]), { run_time: 1.4 });
        this.play(FadeIn(tail), FadeIn(caption.submobjects[1]), { run_time: 1 });
        this.play(Create(next), FadeIn(caption.submobjects[2]), { run_time: 1 });
        this.play(FadeIn(VGroup(...caption.submobjects.slice(3))), { run_time: 0.8 });
        this.wait(3);
      }
    }
    return new ShiftTail();
  },
});
