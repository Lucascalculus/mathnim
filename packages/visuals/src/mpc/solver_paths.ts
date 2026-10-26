// M5: three ways to find the same point. On M4's plan plane (the two-move cart
// QP at one state of its own closed loop), the three solver families walk to
// the optimum ● one iterate at a time (solvers2d.ts, exact arithmetic):
// - active set (purple): guesses which limits hold with equality; each step
//   adds (or drops) one limit and solves a small equality-constrained system,
//   so it jumps from the no-limits plan × onto one limit line, then to the corner;
// - interior point (teal): starts strictly inside the polygon and follows the
//   central path; every step factors a new Newton matrix;
// - ADMM (green, the OSQP iteration): many cheap steps with one matrix that is
//   factored once; it closes in on the corner from outside, to modest accuracy.
// Right: the step count of each, and what one step costs.
import { Circle, Create, FadeIn, Scene, VGroup, ValueTracker, linear } from 'manim-web';
import type { Mobject } from 'manim-web';
import { palette } from '../theme';
import { define_visual } from '../visual';
import { live_number } from '../ft/d/kit';
import { PlanPlane, qp_view, type QpView } from './qp_plane';
import { active_set_path, admm_path, ip_path } from './solvers2d';
import { LANG_SPEC, live_vm, pick, polys_points, resolve_lang, stroke, tex, visible_when, words, type XY } from './kit';

export interface SolverPathsParams extends Record<string, unknown> {
  story: string;
  p0: number;
  v0: number;
  lang: string;
}

/** The three paths at a state (pure). ADMM uses a fixed ρ = 3 and no scaling. */
export function solver_paths(x0: [number, number]): { active: XY[]; ip: XY[]; admm: XY[] } {
  const as = active_set_path(x0).filter((s) => s.action !== 'done');
  return {
    active: as.map((s) => [s.z[0], s.z[1]] as XY),
    ip: ip_path(x0, { tol: 1e-6 }).map((s) => [s.z[0], s.z[1]] as XY),
    admm: admm_path(x0, { rho: 3 }).map((s) => [s.z[0], s.z[1]] as XY),
  };
}

export const mpc_solver_paths = define_visual<SolverPathsParams>({
  name: 'mpc_solver_paths',
  summary: "Three QP solver families on M4's plan plane (the two-move cart QP at one state; default 7 m at rest, where both motor limits are active): the active-set method jumps from the no-limits plan onto one limit line, then to the corner (2 changes); the interior-point method walks inside the feasible polygon along the central path (about 10 Newton steps, each a new matrix); ADMM (the OSQP iteration, fixed ρ = 3, no scaling) takes about 25 cheap steps with one matrix factored once, approaching to modest accuracy. Step counters and the cost of one step for each. Exact arithmetic on the toy cart.",
  topics: ['mpc', 'quadratic program', 'active set', 'interior point', 'admm', 'osqp', 'solver', 'control'],
  params: {
    story: { type: 'enum', values: ['full', 'end'], default: 'full', doc: "'full': the narrated build (plane, then the three paths one after the other); 'end': all three paths drawn at once" },
    p0: { type: 'number', min: 4, max: 9.5, default: 7, doc: "the cart's position [m] (7 m at rest: the motor limits both moves; the optimum is the corner a₁ = a₂ = 1, M4's example)" },
    v0: { type: 'number', min: 0, max: 2, default: 0, doc: "the cart's speed [m/s]" },
    lang: LANG_SPEC,
  },
  examples: [{}, { lang: 'zh' }, { story: 'end' }, { story: 'end', lang: 'zh' }, { story: 'end', p0: 6, v0: 1.5 }],
  ids: ['plane', 'path_active', 'path_ip', 'path_admm', 'count_active', 'count_ip', 'count_admm', 'best', 'note'],
  scene: (p) => {
    const lang = resolve_lang(p.lang);
    const L = (en: string, zh: string) => pick(lang, en, zh);
    const x0: [number, number] = [p.p0, p.v0];
    const paths = solver_paths(x0);
    const view_data: QpView = qp_view(x0);
    class SolverPaths extends Scene {
      n_active = ValueTracker(p.story === 'end' ? paths.active.length : 0);
      n_ip = ValueTracker(p.story === 'end' ? paths.ip.length : 0);
      n_admm = ValueTracker(p.story === 'end' ? paths.admm.length : 0);
      override construct() {
        const c = palette();
        const { n_active, n_ip, n_admm } = this;
        [n_active, n_ip, n_admm].forEach((t, i) => (t.name = ['active_steps', 'ip_steps', 'admm_steps'][i]));
        this.track(n_active, n_ip, n_admm);
        const view = () => view_data;
        const pbox = { x0: -6.15, x1: -1.05, y0: -2.75, y1: 2.35 };
        const plane = new PlanPlane(pbox, view, { clip: () => false, lang });
        plane.group.name = 'plane';
        const P = plane.parts;
        const S = (q: XY): XY => [plane.plot.X(q[0]), plane.plot.Y(q[1])];
        // a path: the first n iterates joined, with a dot on each
        const path = (pts: XY[], n: ValueTracker, color: string, r: number, name: string) => {
          const line = live_vm(stroke(color, 3), () => {
            const k = Math.min(pts.length, Math.floor(n.get_value() + 1e-9));
            return k >= 2 ? polys_points(plane.plot.pieces(pts.slice(0, k))) : new Float64Array(0);
          }, () => String(Math.floor(n.get_value() + 1e-9)));
          const dots = pts.map((q, i) => {
            const d: any = Circle({ radius: r, fill_color: color, fill_opacity: 1, stroke_color: c.bg, stroke_width: 1.5 });
            d.move_to([...S(q), 0]);
            const inside = Math.abs(q[0]) <= 2 && Math.abs(q[1]) <= 2;
            return visible_when(d, () => inside && n.get_value() >= i + 1 - 1e-9);
          });
          const g = VGroup(line, ...dots);
          g.name = name;
          return g;
        };
        const g_active = path(paths.active, n_active, c.purple, 0.085, 'path_active');
        const g_ip = path(paths.ip, n_ip, c.teal, 0.06, 'path_ip');
        const g_admm = path(paths.admm, n_admm, c.good, 0.045, 'path_admm');
        const best: any = Circle({ radius: 0.13, fill_color: c.bg, fill_opacity: 0, stroke_color: c.ink, stroke_width: 3 });
        best.move_to([...S(view_data.plan.z as unknown as XY), 0]);
        best.name = 'best';
        // words on the plane
        const state = tex(`x_0 = (${x0[0].toFixed(2)}\\,\\mathrm{m},\\; ${x0[1].toFixed(2)}\\,\\mathrm{m/s})`, 24, c.ink).move_to([(pbox.x0 + pbox.x1) / 2, 3.1, 0]);
        const best_word = words(L('black ring: the optimum, where all three end', '黑色圆圈：最优解，三种方法都停在这里'), 20, c.ink, 0.35, -1.75, { max_w: 6.5 });
        const cz = view_data.center, off = Math.abs(cz[0]) > 2 || Math.abs(cz[1]) > 2;
        const center_word = words(off ? L(`arrow: the no-limits plan, off the chart at (${cz[0].toFixed(2)}, ${cz[1].toFixed(2)})`, `箭头：不管限制的计划，在图外 (${cz[0].toFixed(2)}, ${cz[1].toFixed(2)})`)
          : L('×: the no-limits plan', '×：不管限制的计划'), 20, c.ink, pbox.x0, -3.62, { max_w: 6.0 });

        // ---- right: one row per family
        const RX = 0.35;
        const row = (y: number, color: string, name: string, n: ValueTracker, total: number, each: string, id: string) => {
          const title = words(name, 26, color, RX, y, { weight: 'bold' });
          const cnt = live_number(() => Math.min(total, Math.max(0, Math.floor(n.get_value() + 1e-9) - 1)), { decimals: 0, size: 30, color });
          const steps_word = words(L('steps', '步'), 22, c.muted, 0, y);
          const place = () => {
            cnt.move_to([6.2 - cnt.width / 2 - steps_word.width - 0.12, y, 0]);
            steps_word.move_to([6.2 - steps_word.width / 2, y, 0]);
          };
          place();
          cnt.add_updater(place);
          cnt.name = id;
          const desc = words(each, 20, c.ink, RX, y - 0.48, { max_w: 6.5 });
          return VGroup(title, cnt, steps_word, desc);
        };
        const rows = VGroup(
          row(2.55, c.purple, L('Active set', '有效集法'), n_active, paths.active.length - 1,
            L('a step: hold one more limit (or let one go), solve one small system', '一步：多守住一条限制（或放掉一条），解一个小方程组'), 'count_active'),
          row(0.95, c.teal, L('Interior point', '内点法'), n_ip, paths.ip.length - 1,
            L('a step: one Newton step inside the polygon, a new matrix to factor', '一步：在多边形内部走一步牛顿法，要分解一个新矩阵'), 'count_ip'),
          row(-0.65, c.good, L('ADMM (OSQP)', 'ADMM（OSQP）'), n_admm, paths.admm.length - 1,
            L('a step: the same matrix every time (factored once), then a clip', '一步：每次都是同一个矩阵（只分解一次），再截断一下'), 'count_admm'),
        );
        rows.name = 'panel';
        const note = words(L('toy two-move cart QP, exact; ADMM with fixed ρ = 3, no scaling',
          '玩具小车的两步 QP，精确计算；ADMM 取固定 ρ = 3，不缩放'), 20, c.muted, RX, -2.4, { max_w: 6.5 });
        const note2 = words(L('the counts are for this little QP; real ones: next pages', '步数只对这个小 QP 成立；真实的数字见后面几页'), 20, c.muted, RX, -3.0, { max_w: 6.5 });
        note.name = 'note';

        const base = [P.poly, P.contours, P.limit_lines, P.center];
        const fresh = (...ms: Mobject[]) => ms.forEach((m) => m.update(0));
        if (p.story === 'end') {
          this.add(...base, g_ip, g_admm, g_active, best);
          fresh(...rows.submobjects);
          this.play(FadeIn(plane.group), FadeIn(center_word), FadeIn(state), FadeIn(rows), FadeIn(note), FadeIn(note2), FadeIn(best_word), { run_time: 1 });
          this.wait(0.5);
          return;
        }
        fresh(...rows.submobjects);
        this.add(P.poly);
        this.play(FadeIn(plane.group), FadeIn(state), Create(P.contours), FadeIn(P.limit_lines), FadeIn(P.center), FadeIn(center_word), { run_time: 1.6 });
        this.wait(0.8);
        this.play(FadeIn(best), FadeIn(best_word), { run_time: 0.8 });
        this.wait(1.2);
        // active set: the start (no limit held = the no-limits plan), then one change at a time
        this.add(g_active);
        this.play(FadeIn(rows.submobjects[0]), { run_time: 0.6 });
        this.play(n_active.animate.set_value(1), { run_time: 0.4 });
        this.wait(1.2);
        for (let k = 2; k <= paths.active.length; k++) {
          this.play(n_active.animate.set_value(k), { run_time: 0.9, rate_func: linear });
          this.wait(1.2);
        }
        // interior point
        this.add(g_ip);
        this.play(FadeIn(rows.submobjects[1]), { run_time: 0.6 });
        this.play(n_ip.animate.set_value(1), { run_time: 0.4 });
        this.wait(1);
        this.play(n_ip.animate.set_value(paths.ip.length), { run_time: 4.5, rate_func: linear });
        this.wait(1.5);
        // ADMM
        this.add(g_admm);
        this.play(FadeIn(rows.submobjects[2]), { run_time: 0.6 });
        this.play(n_admm.animate.set_value(1), { run_time: 0.4 });
        this.wait(0.8);
        this.play(n_admm.animate.set_value(paths.admm.length), { run_time: 5.5, rate_func: linear });
        this.wait(1.2);
        this.play(FadeIn(note), FadeIn(note2), { run_time: 0.8 });
        this.wait(1.5);
      }
    }
    return new SolverPaths();
  },
});
