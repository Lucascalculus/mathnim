// M8's shooting picture: one horizon of the toy car entering the first bend
// (car_math.ts, shooting_iterates), solved from scratch by Gauss–Newton in two
// ways, side by side, iteration by iteration:
//   - single shooting: the unknowns are the inputs only; the states follow by
//     simulating, so every iterate is one unbroken trajectory (it starts as
//     "straight ahead" and bends towards the road);
//   - multiple shooting: the inputs and the start state of every interval are
//     unknowns; each interval is simulated on its own from its start state, and
//     the dynamics x_{k+1} = F(x_k, u_k) are constraints, so the iterate may be
//     broken: the gaps (coral) are the constraint violations, closed by the
//     iterations. The start states begin near the road (a rough guess, as if
//     from data), not on it.
// Simulation of a toy model; the numbers on screen are tested in car_math.test.ts.
import { FadeIn, Scene, UpdateFromAlphaFunc, VGroup, VMobject, ValueTracker, linear } from 'manim-web';
import { palette } from '../theme';
import { define_visual } from '../visual';
import { CAR, ROAD, car_step, plan_cost, shooting_iterates } from './car_math';
import { LANG_SPEC, live_label, live_vm, pick, poly_points, polyline, polys_points, resolve_lang, stroke, words, type XY } from './kit';
import { aside } from '../aside';

export interface ShootingParams extends Record<string, unknown> {
  iters: number;
  lang: string;
}

/** Road window drawn in each panel [m] and the panels on screen. */
const WIN = { x0: 5.6, x1: 20.9, y0: -1.75, y1: 4.75 };
const PANELS = [{ x0: -6.9, x1: -0.25 }, { x0: 0.25, x1: 6.9 }];
const PY0 = -2.45;
const SCALE = (PANELS[0].x1 - PANELS[0].x0) / (WIN.x1 - WIN.x0);
const map = (panel: number) => (x: number, y: number): XY => [PANELS[panel].x0 + (x - WIN.x0) * SCALE, PY0 + (y - WIN.y0) * SCALE];

export const mpc_shooting = define_visual<ShootingParams>({
  name: 'mpc_shooting',
  summary: 'Scene: one 2.5 s horizon of the toy car (kinematic bicycle) entering a bend, solved by Gauss–Newton in single shooting (left: unknowns = inputs, every iterate is one unbroken simulated trajectory, cost 113.9 → 8.39 → 1.55 → 1.52) and multiple shooting (right: unknowns = inputs and interval start states, each interval simulated on its own; coral gaps = violated dynamics, 1.24 m → 2.6 mm → 0.01 mm). Both end at the same plan. Simulation.',
  topics: ['mpc', 'nonlinear mpc', 'nmpc', 'single shooting', 'multiple shooting', 'gauss-newton', 'sqp', 'optimal control'],
  params: {
    iters: { type: 'integer', min: 1, max: 4, default: 3, doc: 'Gauss–Newton iterations shown (each is one QP)' },
    lang: LANG_SPEC,
  },
  examples: [{}, { lang: 'zh' }, { iters: 1 }, { iters: 4, lang: 'zh' }],
  ids: ['note', 'titles', 'roads', 'refs', 'single_curve', 'ms_pieces', 'ms_nodes', 'gaps', 'single_read', 'multi_read', 'iter_label', 'legend'],
  scene: (p) => {
    const lang = resolve_lang(p.lang);
    const L = (en: string, zh: string) => pick(lang, en, zh);
    const S = shooting_iterates(5);
    const n_it = p.iters;
    const cost = S.single.map((it) => plan_cost(S.x0, it.U, S.ref, [0, 0]));
    class Shooting extends Scene {
      /** The iterate shown, fractional while morphing to the next. */
      it = ValueTracker(0);
      override construct() {
        const c = palette();
        const it = this.it;
        this.track(it);
        const lo = () => Math.min(n_it, Math.floor(it.get_value() + 1e-9));
        const fr = () => Math.min(1, it.get_value() - lo());
        const mix = (a: number[], b: number[]) => a.map((v, i) => v + fr() * (b[i] - v));
        const key = () => it.get_value().toFixed(3);

        const note = aside(this, words(L('simulation of the toy car: one 2.5 s horizon entering the first bend; right: start states from a rough guess', '玩具小车的模拟：进入第一个弯的一个 2.5 秒时域；右边各段起点来自粗糙的猜测'), 19, c.muted, -6.9, 3.72, { max_w: 13.8 }));
        note.name = 'note';
        const titles = VGroup(
          words(L('single shooting', '单次打靶（single shooting）'), 26, c.ink, PANELS[0].x0, 3.2, { weight: 'BOLD' }),
          words(L('unknowns: the 25 inputs; states by simulating', '未知量：25 个输入；状态靠一路仿真算出'), 20, c.muted, PANELS[0].x0, 2.8, { max_w: 6.6 }),
          words(L('multiple shooting', '多重打靶（multiple shooting）'), 26, c.ink, PANELS[1].x0, 3.2, { weight: 'BOLD' }),
          words(L('unknowns: inputs and each piece’s start state', '未知量：输入，加上每一段的起点状态'), 20, c.muted, PANELS[1].x0, 2.8, { max_w: 6.6 }),
        );
        titles.name = 'titles';

        // ---- the road (lane edges) and the reference points, in both panels
        const roads = VGroup(), refs = VGroup();
        for (const k of [0, 1]) {
          const M = map(k);
          const edge = (side: number) => {
            const pts: XY[] = [];
            for (let i = 0; i < ROAD.s.length; i += 4) {
              const x = ROAD.x[i] - side * CAR.lane * Math.sin(ROAD.psi[i]), y = ROAD.y[i] + side * CAR.lane * Math.cos(ROAD.psi[i]);
              if (x >= WIN.x0 && x <= WIN.x1 && y >= WIN.y0 && y <= WIN.y1) pts.push(M(x, y));
            }
            return pts;
          };
          roads.add(polyline(edge(1), c.muted, 2.5), polyline(edge(-1), c.muted, 2.5));
          const r = 0.045, sq: XY[][] = S.ref.map((q) => {
            const [cx, cy] = M(q[0], q[1]);
            return [[cx - r, cy - r], [cx + r, cy - r], [cx + r, cy + r], [cx - r, cy + r], [cx - r, cy - r]];
          });
          const dots = VMobject({ fill_color: c.good, fill_opacity: 1, stroke_width: 0, stroke_color: c.good });
          dots.set_points(polys_points(sq));
          refs.add(dots);
        }
        roads.name = 'roads';
        refs.name = 'refs';

        // ---- single shooting: one unbroken trajectory
        const M0 = map(0), M1 = map(1);
        const single_curve = live_vm(stroke(c.accent, 4), () => {
          const a = S.single[lo()].X, b = S.single[Math.min(n_it, lo() + 1)].X;
          return poly_points(a.map((x, i) => { const m = mix(x, b[i]); return M0(m[0], m[1]); }));
        }, key);
        single_curve.name = 'single_curve';

        // ---- multiple shooting: start states, pieces simulated from each, gaps
        const ms_state = () => {
          const a = S.multiple[lo()], b = S.multiple[Math.min(n_it, lo() + 1)];
          const St = a.S.map((s, k) => mix(s, b.S[k])), U = a.U.map((u, k) => mix(u, b.U[k]));
          return { St, U };
        };
        /** A piece: from start state x, the input held for one sample (drawn with 4 sub-steps). */
        const piece = (x: number[], u: number[]): number[][] => {
          const out = [x];
          for (let j = 0; j < 4; j++) out.push(car_step(out[out.length - 1], u, CAR.dt / 4));
          return out;
        };
        const ms_pieces = live_vm(stroke(c.accent, 4), () => {
          const { St, U } = ms_state();
          return polys_points(U.map((u, k) => piece(k ? St[k - 1] : S.x0, u).map((x) => M1(x[0], x[1]))));
        }, key);
        ms_pieces.name = 'ms_pieces';
        const ms_nodes = live_vm(VMobject({ fill_color: c.accent, fill_opacity: 1, stroke_width: 0, stroke_color: c.accent }), () => {
          const { St } = ms_state(), r = 0.05;
          return polys_points([S.x0, ...St.slice(0, -1)].map((x) => {
            const [cx, cy] = M1(x[0], x[1]);
            return [[cx - r, cy], [cx, cy - r], [cx + r, cy], [cx, cy + r], [cx - r, cy]] as XY[];
          }));
        }, key);
        ms_nodes.name = 'ms_nodes';
        const gaps = live_vm(stroke(c.coral, 5), () => {
          const { St, U } = ms_state();
          const segs: XY[][] = [];
          U.forEach((u, k) => {
            const end = car_step(k ? St[k - 1] : S.x0, u);
            if (Math.hypot(end[0] - St[k][0], end[1] - St[k][1]) > 0.02) segs.push([M1(end[0], end[1]), M1(St[k][0], St[k][1])]);
          });
          return polys_points(segs);
        }, key);
        gaps.name = 'gaps';

        // ---- readouts under each panel
        const k_now = () => Math.round(it.get_value());
        const single_read = live_label(() => L(`horizon cost J = ${cost[k_now()].toFixed(2)}`, `时域代价 J = ${cost[k_now()].toFixed(2)}`), 24, c.ink, (m) => m.move_to([PANELS[0].x0 + m.width / 2, -3.2, 0]), { weight: 'BOLD' });
        single_read.name = 'single_read';
        const gap_text = () => {
          const g = S.multiple[k_now()].gap;
          return g >= 0.01 ? `${g.toFixed(2)} m` : g >= 1e-4 ? `${(1000 * g).toFixed(1)} mm` : L('< 0.1 mm', '< 0.1 mm');
        };
        const multi_read = live_label(() => L(`largest gap: ${gap_text()}`, `最大缺口：${gap_text()}`), 24, () => (S.multiple[k_now()].gap >= 0.01 ? c.coral : c.good), (m) => m.move_to([PANELS[1].x0 + m.width / 2, -3.2, 0]), { weight: 'BOLD' });
        multi_read.name = 'multi_read';
        const iter_label = live_label(() => (k_now() === 0 ? L('the guess (no QP solved yet)', '初始猜测（还没解 QP）') : L(`after ${k_now()} Gauss–Newton iteration${k_now() > 1 ? 's' : ''} (one QP each)`, `${k_now()} 次高斯–牛顿迭代之后（每次解一个 QP）`)), 24, c.ink, (m) => m.move_to([0, 1.55, 0]), { weight: 'BOLD' });
        iter_label.name = 'iter_label';
        const legend = VGroup(
          polyline([[-6.85, 2.35], [-6.45, 2.35]], c.good, 7, { dash: [0.08, 0.08] }), words(L('reference points', '参考点'), 19, c.ink, -6.35, 2.35),
          polyline([[-4.0, 2.35], [-3.6, 2.35]], c.accent, 4), words(L('simulated motion', '仿真出的运动'), 19, c.ink, -3.5, 2.35),
          polyline([[0.3, 2.35], [0.7, 2.35]], c.coral, 5), words(L('gap: dynamics not yet satisfied', '缺口：动力学约束尚未满足'), 19, c.ink, 0.8, 2.35, { max_w: 5.9 }),
        );
        legend.name = 'legend';

        this.play(FadeIn(note), FadeIn(titles), FadeIn(roads), FadeIn(refs), FadeIn(legend), { run_time: 1.2 });
        this.next_section(); // (a section per beat, §, of the narration: the picture waits there for the voice)
        this.play(FadeIn(single_curve), FadeIn(single_read), FadeIn(iter_label), { run_time: 1 });
        this.next_section();
        this.play(FadeIn(ms_pieces), FadeIn(ms_nodes), FadeIn(gaps), FadeIn(multi_read), { run_time: 1 });
        this.wait(1);
        for (let i = 0; i < n_it; i++) {
          if (i < 2) this.next_section(); // (the first iteration, then the rest: the narration's last two beats)
          this.play(UpdateFromAlphaFunc(it, (_m: unknown, a?: number) => it.set_value(i + (a ?? 1)), { run_time: 1.6, rate_func: linear }));
          this.wait(i === 0 ? 0.8 : 1);
        }
        this.wait(1);
      }
    }
    return new Shooting();
  },
});
