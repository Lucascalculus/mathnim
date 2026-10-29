// M7, robust MPC (disturbance.ts, story 3): the cart docks against the wall
// while an unknown push of up to 0.15 m/s² (either way, changing every
// 0.5–1.4 s) acts on it. Twelve random push histories, three ways of following
// the nominal docking plan, side by side:
// 1. open loop (apply the planned inputs): the error grows without bound;
// 2. with the feedback u = ū − K (x − x̄): every run stays inside the tube
//    (the plan ± the precomputed width), but the plan touches the wall, so
//    runs on the outside of the tube cross it;
// 3. feedback, and the plan's wall moved in by the tube width: no run crosses.
// Simulation of the toy cart. No handles.
import { Create, FadeIn, Scene, VGroup } from 'manim-web';
import type { Mobject } from 'manim-web';
import { palette } from '../theme';
import { define_visual } from '../visual';
import { CART } from './math';
import { TUBE, disturbance_history, tube_follow, tube_nominal, tube_widths } from './disturbance';
import { LANG_SPEC, Plot, fill_poly, pick, resolve_lang, tex, words, type XY } from './kit';
import { aside } from '../aside';

export interface TubeViewParams extends Record<string, unknown> {
  lang: string;
}

/** The three panels' runs and how many of the 12 cross the wall (also used by the lesson text and tested). */
export function tube_panels() {
  const h = tube_widths();
  const ws = Array.from({ length: TUBE.runs }, (_, s) => disturbance_history(TUBE.seed + 101 * s));
  const make = (tight: boolean, feedback: boolean) => {
    const nom = tube_nominal(tight);
    const runs = ws.map((w) => tube_follow(nom, w, feedback).p);
    return { nom, runs, crossed: runs.map((p) => Math.max(...p) > CART.p_max), n_cross: runs.filter((p) => Math.max(...p) > CART.p_max).length };
  };
  return { widths: h, open: make(false, false), feedback: make(false, true), tight: make(true, true) };
}

export const mpc_tube = define_visual<TubeViewParams>({
  name: 'mpc_tube',
  summary: 'Scene (simulation): tube MPC on the toy cart docking at a wall under an unknown bounded push (up to 0.15 m/s²), 12 random histories. Open loop the runs drift apart (4 of 12 cross the wall); with the feedback u = ū − K(x − x̄) they stay inside a tube of ±0.18 m around the plan, but 8 of 12 cross because the plan touches the wall; moving the plan’s wall in by the tube width keeps all 12 off it. No handles.',
  topics: ['mpc', 'robust mpc', 'tube mpc', 'disturbance', 'constraint tightening', 'control'],
  params: { lang: LANG_SPEC },
  examples: [{}, { lang: 'zh' }],
  ids: ['note', 'open', 'feedback', 'tight', 'law'],
  scene: (p) => {
    const lang = resolve_lang(p.lang);
    const L = (en: string, zh: string) => pick(lang, en, zh);
    const P = tube_panels(), dt = TUBE.dt, h = P.widths;
    const T0 = 5.5, T1 = 9, Y0 = 8.6, Y1 = 10.5;
    class Tube extends Scene {
      override construct() {
        const c = palette();
        const note = aside(this, words(L(`simulation of a toy cart docking at the wall: an unknown push up to ${TUBE.w_max} m/s² either way, 12 random histories`, `玩具小车靠墙停车的模拟：未知推力，任一方向最大 ${TUBE.w_max} m/s²，随机 12 种`), 20, c.muted, -6.9, 3.62, { max_w: 13.8 }));
        note.name = 'note';
        const W = 3.55, GAP = 1.05, X0 = -6.35;
        const panel = (i: number, data: typeof P.open, title: string, sub: string, tube: boolean, tight: boolean) => {
          const x0 = X0 + i * (W + GAP);
          const plot = new Plot({ box: { x0, x1: x0 + W, y0: -2.2, y1: 1.95 }, x: [T0, T1], y: [Y0, Y1], x_ticks: [6, 7, 8, 9], y_ticks: [9, 10], x_label: i === 0 ? { tex: 't\\;(\\mathrm{s})' } : undefined, y_label: i === 0 ? { tex: 'p\\;(\\mathrm{m})' } : undefined, font: 20 });
          const wall = VGroup(plot.band(CART.p_max, Y1, c.coral, 0.14), plot.note(L('wall', '墙'), T0 + 0.1, 10.3, c.coral, 20));
          const parts: Mobject[] = [plot.group, wall];
          const nom_pts = data.nom.x.map((x, k) => [k * dt, x[0]] as XY);
          if (tube) {
            const up = nom_pts.map(([t, v]) => [t, v + h.p] as XY), lo = nom_pts.map(([t, v]) => [t, v - h.p] as XY);
            const sc = [...up, ...lo.reverse()].map(([t, v]) => [plot.X(Math.max(T0, Math.min(T1, t))), plot.Y(Math.max(Y0, Math.min(Y1, v)))] as XY);
            parts.push(fill_poly(sc, c.accent, 0.13));
          }
          if (tight) parts.push(plot.hline(CART.p_max - h.p, c.coral, { width: 2.5 }), plot.note(L('dashed: the plan’s wall', '虚线：计划用的墙'), T1 - 0.1, 10.3, c.coral, 18, 'right'));
          const runs = VGroup(...data.runs.map((ps, s) => plot.curve(ps.map((v, k) => [k * dt, v] as XY), { color: data.crossed[s] ? c.coral : c.good, width: 2.2, opacity: 0.9 })));
          const nom = plot.curve(nom_pts, { color: c.ink, width: 3.5, dash: [0.12, 0.08] });
          const head = VGroup(words(title, 22, c.ink, x0 - 0.35, 3.1, { weight: 'BOLD', max_w: W + 0.7 }), words(sub, 20, c.muted, x0 - 0.35, 2.66, { max_w: W + 0.7 }));
          const res = words(L(`${data.n_cross} of 12 runs cross the wall`, `12 次里有 ${data.n_cross} 次越过墙`), 22, data.n_cross ? c.coral : c.good, x0 + W / 2, -3.2, { align: 'center', weight: 'BOLD', max_w: W + 0.7 });
          return { frame: VGroup(...parts, head), runs, nom, res };
        };
        const a = panel(0, P.open, L('1. just follow the plan', '1. 照着计划开'), L('apply the planned inputs as they are', '直接执行计划的输入'), false, false);
        const b = panel(1, P.feedback, L('2. plus feedback', '2. 加上反馈'), L('correct towards the plan', '朝计划拉回来'), true, false);
        const d = panel(2, P.tight, L('3. plus a tighter limit', '3. 再收紧约束'), L(`the plan stops ${(h.p * 100).toFixed(0)} cm short of the wall`, `计划离墙留 ${(h.p * 100).toFixed(0)} cm`), true, true);
        const open = VGroup(a.frame, a.runs, a.nom, a.res), feedback = VGroup(b.frame, b.runs, b.nom, b.res), tight = VGroup(d.frame, d.runs, d.nom, d.res);
        open.name = 'open';
        feedback.name = 'feedback';
        tight.name = 'tight';
        const law = VGroup(
          words(L('feedback:', '反馈：'), 18, c.muted, 0, 0),
          tex('u = \\bar u - K\\,(x - \\bar x)', 22, c.ink),
          words(L(`·  dashed: the plan x̄  ·  shaded: the tube, ±${(h.p * 100).toFixed(0)} cm around it`, `·  虚线：计划 x̄  ·  阴影：管子，计划上下 ±${(h.p * 100).toFixed(0)} cm`), 18, c.muted, 0, 0),
        );
        {
          const ms = law.submobjects as any[], total = ms.reduce((a, m) => a + m.width, 0) + 0.15 * (ms.length - 1);
          let x = -total / 2;
          for (const m of ms) {
            m.move_to([x + m.width / 2, -3.66, 0]);
            x += m.width + 0.15;
          }
        }
        law.name = 'law';
        this.play(FadeIn(note), FadeIn(a.frame), { run_time: 1 });
        this.play(Create(a.nom), { run_time: 0.8 });
        this.play(Create(a.runs), { run_time: 2 });
        this.play(FadeIn(a.res), { run_time: 0.5 });
        this.wait(1);
        this.play(FadeIn(b.frame), FadeIn(law), { run_time: 0.9 });
        this.play(Create(b.nom), { run_time: 0.6 });
        this.play(Create(b.runs), { run_time: 2 });
        this.play(FadeIn(b.res), { run_time: 0.5 });
        this.wait(1.2);
        this.play(FadeIn(d.frame), { run_time: 0.9 });
        this.play(Create(d.nom), { run_time: 0.6 });
        this.play(Create(d.runs), { run_time: 2 });
        this.play(FadeIn(d.res), { run_time: 0.5 });
        this.wait(2);
        this.add(open, feedback, tight, law);
      }
    }
    return new Tube();
  },
});
