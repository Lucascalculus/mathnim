// M1's opening figure: a reactive PD controller on the docking task,
// a = k_p (10 − p) − k_d v clipped to the brakes. Aggressive gains hit the
// wall, cautious ones crawl, hand-tuned ones dock, but only for the brakes
// they were tuned on. With `show_mpc`, the docking MPC of the same lesson is
// drawn for comparison (told the brakes; horizon long enough to contain the
// stop: 20 steps for 1 m/s², 40 for 0.5 m/s²). Simulation of the toy cart.
import { Create, FadeIn, Scene, VGroup } from 'manim-web';
import type { Mobject } from 'manim-web';
import { palette } from '../theme';
import { define_visual } from '../visual';
import { CART } from './math';
import { dock_run, pd_run, type DockRun } from './dock';
import { LANG_SPEC, Plot, pick, polyline, resolve_lang, tex, words, type XY } from './kit';
import { aside } from '../aside';

export interface PdCompareParams extends Record<string, unknown> {
  brakes: string;
  show_mpc: boolean;
  lang: string;
}

const STEPS = 100;
/** The three PD tunings of the figure (gains in 1/s² and 1/s). */
export const PD_TUNINGS = { aggressive: [1, 1], cautious: [0.5, 1.4], tuned: [2.5, 3.05] } as const;

export const mpc_pd_compare = define_visual<PdCompareParams>({
  name: 'mpc_pd_compare',
  summary: 'Static figure (simulation): position against time of the docking cart under a reactive PD controller a = k_p(10 − p) − k_d v, clipped to the brakes. With brakes of 1 m/s²: aggressive gains hit the wall, cautious ones crawl, tuned ones dock in 8.6 s; with brakes of 0.5 m/s² the tuned PD hits. Optionally the docking MPC for comparison (7.3 s; 9.0 s with weak brakes and a 4 s look-ahead). No handles.',
  topics: ['mpc', 'pid', 'pd controller', 'saturation', 'control'],
  params: {
    brakes: { type: 'enum', values: ['1', '0.5'], default: '1', doc: "largest deceleration in m/s²: '1' shows three PD tunings, '0.5' only the tuned one (it was tuned for 1)" },
    show_mpc: { type: 'boolean', default: false, doc: 'also draw the docking MPC (horizon 20 steps for brakes 1, 40 for brakes 0.5)' },
    lang: LANG_SPEC,
  },
  examples: [{}, { lang: 'zh' }, { brakes: '0.5', show_mpc: true }, { brakes: '0.5', show_mpc: true, lang: 'zh' }, { show_mpc: true, lang: 'zh' }],
  ids: ['plot', 'wall_band', 'curves', 'ends', 'legend', 'law', 'note'],
  scene: (p) => {
    const lang = resolve_lang(p.lang);
    const L = (en: string, zh: string) => pick(lang, en, zh);
    const a_max = p.brakes === '0.5' ? 0.5 : 1;
    const dt = CART.dt;
    class PdCompare extends Scene {
      override construct() {
        const c = palette();
        const plot = new Plot({ box: { x0: -5.6, x1: 2.4, y0: -2.95, y1: 2.55 }, x: [0, 10], y: [0, 11.5], x_ticks: [0, 2, 4, 6, 8, 10], y_ticks: [0, 2, 4, 6, 8, 10], x_label: { tex: 't\\;(\\mathrm{s})' }, y_label: { tex: 'p\\;(\\mathrm{m})' } });
        plot.group.name = 'plot';
        const wall_band = VGroup(plot.band(CART.p_max, 11.5, c.coral, 0.14), plot.note(L('wall', '墙'), 9.85, 10.75, c.coral, 20, 'right'));
        wall_band.name = 'wall_band';
        type Row = { run: DockRun; color: string; name: string; gains: string | null; width: number };
        const pd = (k: readonly [number, number]) => pd_run(k[0], k[1], { a_max, steps: STEPS });
        const rows: Row[] = [];
        if (a_max === 1) {
          rows.push({ run: pd(PD_TUNINGS.aggressive), color: c.coral, name: L('PD, aggressive', 'PD，激进'), gains: 'k_p = 1,\\; k_d = 1', width: 4 });
          rows.push({ run: pd(PD_TUNINGS.cautious), color: c.gold, name: L('PD, cautious', 'PD，保守'), gains: 'k_p = 0.5,\\; k_d = 1.4', width: 4 });
        }
        rows.push({ run: pd(PD_TUNINGS.tuned), color: c.purple, name: a_max === 1 ? L('PD, tuned by trial', 'PD，反复试出来的') : L('the same tuned PD', '同一个调好的 PD'), gains: 'k_p = 2.5,\\; k_d = 3.05', width: 4 });
        if (p.show_mpc) {
          const N = a_max === 1 ? 20 : 40;
          rows.push({ run: dock_run(N, { a_max, steps: STEPS }), color: c.accent, name: L(`MPC, looking ${(N * dt).toFixed(0)} s ahead`, `MPC，往前看 ${(N * dt).toFixed(0)} 秒`), gains: null, width: 5 });
        }
        const outcome = (r: DockRun): [string, string] => {
          if (r.crash_k >= 0) return [L(`hits the wall at ${r.impact.toFixed(2)} m/s`, `以 ${r.impact.toFixed(2)} m/s 撞墙`), c.coral];
          if (r.docked_k >= 0) return [L(`docks at t = ${(r.docked_k * dt).toFixed(1)} s`, `t = ${(r.docked_k * dt).toFixed(1)} s 停稳`), c.good];
          const left = CART.p_max - r.x[STEPS][0];
          return [L(`still ${(left * 100).toFixed(0)} cm short at 10 s`, `10 秒时还差 ${(left * 100).toFixed(0)} cm`), c.ink];
        };
        const end_k = (r: DockRun) => (r.crash_k >= 0 ? r.crash_k : STEPS);
        const curves = rows.map((r) => plot.curve(r.run.x.slice(0, end_k(r.run) + 1).map((x, j) => [j * dt, x[0]] as XY), { color: r.color, width: r.width }));
        const ends = rows.map((r) => plot.live_dot(() => (r.run.crash_k >= 0 ? [r.run.crash_k * dt, CART.p_max] : null), c.coral, 0.1));
        // ---- legend: one block per run, in the right column
        const RX = 3.0, top = 2.45, gap = rows.length > 3 ? 1.42 : 1.6;
        const blocks = rows.map((r, i) => {
          const y = top - i * gap;
          const [o, oc] = outcome(r.run);
          const parts: Mobject[] = [polyline([[RX, y], [RX + 0.5, y]], r.color, r.width), words(r.name, 22, c.ink, RX + 0.65, y, { max_w: 3.25 })];
          let yy = y - 0.42;
          if (r.gains) {
            const g = tex(r.gains, 30, c.muted);
            g.move_to([RX + 0.65 + g.width / 2, yy, 0]);
            parts.push(g);
            yy -= 0.4;
          }
          parts.push(words(o, 22, oc, RX + 0.65, yy, { max_w: 3.25 }));
          return VGroup(...parts);
        });
        const legend = VGroup(...blocks);
        legend.name = 'legend';
        // the control law, low on the right where no curve goes
        const law = tex(`a = k_p\\,(10 - p) - k_d\\, v, \\quad |a| \\le ${a_max === 1 ? '1' : '0.5'}`, 30, c.ink);
        law.move_to([2.3 - law.width / 2, plot.Y(1.2), 0]);
        law.name = 'law';
        const note = aside(this, words(L(`simulation of a toy cart: |v| up to 2 m/s, brakes up to ${a_max === 1 ? '1' : '0.5'} m/s²`, `玩具小车的模拟：|v| 不超过 2 m/s，刹车不超过 ${a_max === 1 ? '1' : '0.5'} m/s²`), 20, c.muted, -6.9, 3.6));
        note.name = 'note';
        const cg = VGroup(...curves);
        cg.name = 'curves';
        const eg = VGroup(...ends);
        eg.name = 'ends';
        this.play(FadeIn(plot.group), FadeIn(wall_band), FadeIn(note), FadeIn(law), { run_time: 1 });
        rows.forEach((_, i) => {
          this.play(Create(curves[i]), FadeIn(blocks[i]), { run_time: 1.4 });
          this.add(ends[i]);
        });
        this.add(cg, eg, legend);
        this.wait(1.5);
      }
    }
    return new PdCompare();
  },
});
