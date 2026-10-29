// M1: why apply only the first step? At t = 1 s an unexpected push (a gust
// from behind) adds 0.3 m/s. The same plan maker used two ways: one long plan
// made at t = 0 and carried out blindly hits the wall; the horizon-20 MPC that
// re-plans from the measured state every 0.1 s docks. Simulation of the toy cart.
import { Create, FadeIn, Scene, VGroup } from 'manim-web';
import type { Mobject } from 'manim-web';
import { palette } from '../theme';
import { define_visual } from '../visual';
import { CART } from './math';
import { push_runs, type Trace } from './dock';
import { LANG_SPEC, Plot, pick, polyline, resolve_lang, words, type XY } from './kit';
import { aside } from '../aside';

export interface ReplanPushParams extends Record<string, unknown> {
  lang: string;
}

export const mpc_replan_push = define_visual<ReplanPushParams>({
  name: 'mpc_replan_push',
  summary: 'Static figure (simulation): why MPC applies only the first step. A push of +0.3 m/s at t = 1 s; the plan made once at t = 0 and executed blindly hits the wall at 1.92 m/s, while the controller that re-plans every 0.1 s from the measured state docks. No handles.',
  topics: ['mpc', 'receding horizon', 'feedback', 'open loop', 'disturbance'],
  params: { lang: LANG_SPEC },
  examples: [{}, { lang: 'zh' }],
  ids: ['plot', 'wall_band', 'push', 'plan0', 'blind', 'replan', 'ends', 'legend', 'note'],
  scene: (p) => {
    const lang = resolve_lang(p.lang);
    const L = (en: string, zh: string) => pick(lang, en, zh);
    const dt = CART.dt;
    class ReplanPush extends Scene {
      override construct() {
        const c = palette();
        const r = push_runs();
        const plot = new Plot({ box: { x0: -5.6, x1: 2.4, y0: -2.95, y1: 2.55 }, x: [0, 10], y: [0, 11.5], x_ticks: [0, 2, 4, 6, 8, 10], y_ticks: [0, 2, 4, 6, 8, 10], x_label: { tex: 't\\;(\\mathrm{s})' }, y_label: { tex: 'p\\;(\\mathrm{m})' } });
        plot.group.name = 'plot';
        const wall_band = VGroup(plot.band(CART.p_max, 11.5, c.coral, 0.14), plot.note(L('wall', '墙'), 9.85, 10.75, c.coral, 20, 'right'));
        wall_band.name = 'wall_band';
        const tp = r.push_k * dt;
        // the label sits above-left of the curves (two short lines), where nothing is drawn
        const push = VGroup(plot.vline(tp, c.ink, { width: 2.5 }), plot.note(L('a push:', '被推了一下：'), tp + 0.15, 9.2, c.ink, 20), plot.note('+0.3 m/s', tp + 0.15, 8.45, c.ink, 20));
        push.name = 'push';
        const pts = (t: Trace, end: number) => t.x.slice(0, end + 1).map((x, j) => [j * dt, x[0]] as XY);
        const plan0 = plot.curve(r.plan0.map((x, j) => [j * dt, x[0]] as XY), { color: c.muted, width: 4, dash: [0.13, 0.09] });
        plan0.name = 'plan0';
        const blind = plot.curve(pts(r.blind, r.blind.crash_k >= 0 ? r.blind.crash_k : r.blind.x.length - 1), { color: c.coral, width: 4.5 });
        blind.name = 'blind';
        const replan = plot.curve(pts(r.replan, r.replan.x.length - 1), { color: c.accent, width: 5 });
        replan.name = 'replan';
        const ends = VGroup(
          plot.live_dot(() => (r.blind.crash_k >= 0 ? [r.blind.crash_k * dt, CART.p_max] : null), c.coral, 0.1),
          plot.live_dot(() => (r.replan.docked_k >= 0 ? [r.replan.docked_k * dt, CART.p_max] : null), c.good, 0.1),
        );
        ends.name = 'ends';
        const RX = 3.0;
        const block = (y: number, color: string, dash: boolean, name: string, sub: string, sub_color: string): Mobject =>
          VGroup(
            polyline([[RX, y], [RX + 0.5, y]], color, dash ? 4 : 5, dash ? { dash: [0.13, 0.09] } : {}),
            words(name, 22, c.ink, RX + 0.65, y, { max_w: 3.25 }),
            words(sub, 22, sub_color, RX + 0.65, y - 0.42, { max_w: 3.25 }),
          );
        const b0 = block(2.3, c.muted, true, L('the plan made at t = 0', 't = 0 时做的计划'), L('(docks if nothing happens)', '（一切照旧的话能停稳）'), c.muted);
        const b1 = block(1.0, c.coral, false, L('that plan, carried out blindly', '照着这个计划闭眼执行'), L(`hits the wall at ${r.blind.impact.toFixed(2)} m/s`, `以 ${r.blind.impact.toFixed(2)} m/s 撞墙`), c.coral);
        const b2 = block(-0.3, c.accent, false, L('re-planned every 0.1 s', '每 0.1 秒重新规划'), L(`docks at t = ${(r.replan.docked_k * dt).toFixed(1)} s`, `t = ${(r.replan.docked_k * dt).toFixed(1)} s 停稳`), c.good);
        const legend = VGroup(b0, b1, b2);
        legend.name = 'legend';
        const note = aside(this, words(L('simulation of a toy cart: |a| up to 1 m/s², |v| up to 2 m/s; the push is not in the model', '玩具小车的模拟：|a| 不超过 1 m/s²，|v| 不超过 2 m/s；模型里没有这一推'), 20, c.muted, -6.9, 3.6, { max_w: 13.8 }));
        note.name = 'note';
        this.play(FadeIn(plot.group), FadeIn(wall_band), FadeIn(note), { run_time: 1 });
        this.play(FadeIn(push), { run_time: 0.6 });
        this.next_section(); // (a section per beat, §, of the narration: the picture waits there for the voice)
        this.play(Create(plan0), FadeIn(b0), { run_time: 1.6 });
        this.next_section();
        this.play(Create(blind), FadeIn(b1), { run_time: 1.6 });
        this.add(ends.submobjects[0]);
        this.next_section();
        this.play(Create(replan), FadeIn(b2), { run_time: 1.6 });
        this.add(ends, legend);
        this.wait(1.8);
      }
    }
    return new ReplanPush();
  },
});
