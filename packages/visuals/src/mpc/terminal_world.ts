// M6's world (and its scene): why a short look-ahead crashes although every QP
// it solved had a solution, and what the end of the plan must promise. The
// cart docks against the wall as in M1. The picture is the phase plane: every
// point is a state (position p across, speed v up), every dot one instant of
// the closed loop, 0.1 s apart. Regions:
//   - light coral: crash certain (p + v²/2a past the wall): even full brakes hit;
//   - dark coral: the trap: crash certain, yet the horizon-N QP still has a
//     solution (live with N and the end-of-plan choice);
//   - the dashed coral line: the edge of the QP's feasible set (beyond it: no plan);
//   - green dashed (terminal set only): the edge of X_f, p + 1.95 v = 10.
// The learner moves the causes: the look-ahead N and what the end of the plan
// must satisfy (nothing / LQR cost P / terminal set / end at the target).
// A track above the plane shows the same cart. Simulation of the toy cart.
import { Circle, Create, FadeIn, Scene, UpdateFromAlphaFunc, VGroup, VMobject, ValueTracker, linear } from 'manim-web';
import type { Mobject } from 'manim-web';
import { palette } from '../theme';
import { define_visual } from '../visual';
import { CART } from './math';
import { C_TERM, MODES, RUN_STEPS, p_feasible, p_safe, term_run, trap_interval, type Mode, type TermRun } from './terminal_math';
import {
  Choice, LANG_SPEC, Plot, dash_polys, StepSlider, Track, emit, fill_box, fill_poly, hatch, listen, live_label, live_vm, pick, polyline, polys_points, resolve_lang, stroke, tex, visible_when, words,
  type Listener, type XY,
} from './kit';
import { aside } from '../aside';

export interface TerminalWorldParams extends Record<string, unknown> {
  N: number;
  mode: string;
  story: string;
  lang: string;
}
/** The labels of the world's two controls (the lesson's `cue` uses the same). */
export const TERMINAL_LABELS = {
  mode: { en: 'what the end of the plan must satisfy', zh: '计划末端要满足什么' },
  N: { en: 'look-ahead N (steps of 0.1 s)', zh: '预测时域 N（每步 0.1 秒）' },
};
const N_MIN = 2, N_MAX = 80;
const DT = CART.dt;

/** Small filled circles at scene points, one path. */
function dots_points(pts: readonly XY[], r: number): Float64Array {
  const k = 8, out = new Float64Array(pts.length * k * 12);
  pts.forEach(([x, y], i) => {
    for (let j = 0; j < k; j++) {
      const a0 = (2 * Math.PI * j) / k, a1 = (2 * Math.PI * (j + 1)) / k;
      for (let s = 0; s < 4; s++) {
        const a = a0 + ((a1 - a0) * s) / 3, o = (i * k + j) * 12 + 3 * s;
        out[o] = x + r * Math.cos(a);
        out[o + 1] = y + r * Math.sin(a);
      }
    }
  });
  return out;
}

export interface TerminalResult {
  N: number;
  mode: Mode;
  crashed: boolean;
  impact: number;
  /** Seconds (−1: never). */
  infeasible_t: number;
  trap_t: number;
  doomed_t: number;
  docked_t: number;
  started: boolean;
}
export function terminal_result(r: TermRun): TerminalResult {
  const s = (k: number) => (k >= 0 ? +(k * DT).toFixed(1) : -1);
  return { N: r.N, mode: r.mode, crashed: r.crash_k >= 0, impact: r.impact, infeasible_t: s(r.infeasible_k), trap_t: s(r.trap_k), doomed_t: s(r.doomed_k), docked_t: s(r.docked_k), started: r.started };
}

export const mpc_terminal_world = define_visual<TerminalWorldParams>({
  name: 'mpc_terminal_world',
  summary: 'World: the docking cart (simulation) in the phase plane (p across, v up), one dot per 0.1 s. Shaded: crash certain (p + v²/2 past the wall) and the trap (crash certain while the horizon-N QP still has a solution). The learner sets N and what the end of the plan must satisfy (nothing, the LQR cost P, a terminal set p + 1.95 v up to 10, or ending at the target). Nothing or the cost alone hit the wall up to N = 18 / 19; the terminal set docks for every N; ending at the target is infeasible at rest until N = 70.',
  topics: ['mpc', 'model predictive control', 'terminal set', 'terminal cost', 'recursive feasibility', 'stability', 'horizon', 'control'],
  params: {
    N: { type: 'integer', min: N_MIN, max: N_MAX, default: 5, doc: 'look-ahead in steps of 0.1 s (2–80)' },
    mode: { type: 'enum', values: MODES, default: 'none', doc: "end of the plan: 'none' (only the limits), 'cost' (+ LQR terminal cost), 'set' (terminal set p + 1.95 v up to 10), 'end' (x_N = target)" },
    story: { type: 'enum', values: ['trap', 'plain'], default: 'trap', doc: "'trap': the run unfolds, pausing where the cart enters the trap (the scene); 'plain': everything shown at once (the world)" },
    lang: LANG_SPEC,
  },
  examples: [{}, { lang: 'zh' }, { mode: 'cost', story: 'plain' }, { mode: 'set', story: 'plain', lang: 'zh' }, { mode: 'set', N: 8, story: 'plain' }, { mode: 'end', N: 40, story: 'plain', lang: 'zh' }, { mode: 'end', N: 70, story: 'plain' }, { N: 19, story: 'plain', lang: 'zh' }, { N: 15, story: 'plain' }],
  ids: ['plane', 'wall', 'crash_region', 'speed_band', 'trap', 'edge', 'xf_edge', 'target', 'path', 'bad_dots', 'end_dot', 'plan', 'track', 'condition', 'outcome', 'facts', 'legend', 'note', 'slider', 'mode'],
  scene: (p) => {
    const lang = resolve_lang(p.lang);
    const L = (en: string, zh: string) => pick(lang, en, zh);
    class TerminalWorld extends Scene {
      N = ValueTracker(p.N);
      m = ValueTracker(MODES.indexOf(p.mode as Mode));
      /** How much of the run is shown (instants); large = all of it. */
      kt = ValueTracker(p.story === 'plain' ? 1e4 : 0);
      slider!: StepSlider;
      choice!: Choice;
      mode = (): Mode => MODES[Math.max(0, Math.min(3, Math.round(this.m.get_value())))];
      n = (): number => Math.round(this.N.get_value());
      run = (): TermRun => term_run(this.n(), this.mode());
      result(): TerminalResult {
        return terminal_result(this.run());
      }
      listen(f: Listener): void {
        listen(this, f);
      }
      override construct() {
        const c = palette();
        this.track(this.N, this.m, this.kt);
        const key = () => `${this.n()}|${this.mode()}`;
        const R = this.run;
        const shown = () => {
          const r = R(), last = r.x.length - 1;
          return Math.max(0, Math.min(last, Math.floor(this.kt.get_value() + 1e-9)));
        };
        const tkey = () => `${key()}|${shown()}`;

        // ---- the phase plane
        const box = { x0: -5.5, x1: 2.3, y0: -2.15, y1: 1.4 };
        const P = new Plot({ box, x: [0, 10.5], y: [-0.2, 2.45], x_ticks: [0, 2, 4, 6, 8, 10], y_ticks: [0, 1, 2], x_label: { tex: 'p\\;(\\mathrm{m})' }, y_label: { tex: 'v\\;(\\mathrm{m/s})' } });
        P.group.name = 'plane';
        const S = (pp: number, v: number): XY => [P.X(pp), P.Y(v)];
        const wb = { x0: P.X(10), x1: box.x1, y0: box.y0, y1: box.y1 };
        const wall = VGroup(fill_box(wb.x0, wb.y0, wb.x1, wb.y1, c.faint, 1), hatch(wb, c.muted, 0.2, 1.5), polyline([[wb.x0, wb.y0], [wb.x0, wb.y1]], c.ink, 3));
        wall.name = 'wall';
        const vs = Array.from({ length: 50 }, (_, i) => (2.45 * i) / 49);
        const crash_region = fill_poly([...vs.map((v) => S(p_safe(v), v)), S(10, 2.45), S(10, 0)], c.coral, 0.13);
        crash_region.name = 'crash_region';
        const speed_band = VGroup(P.band(2, 2.45, c.muted, 0.1), P.note(L('over the speed limit', '超过限速'), 0.2, 2.24, c.muted, 18));
        speed_band.name = 'speed_band';
        // the trap: where p_safe < p < p_feasible (live)
        const trap = live_vm(VMobject({ fill_color: c.coral, fill_opacity: 0.5, stroke_width: 0, stroke_color: c.coral }), () => {
          const lo: XY[] = [], hi: XY[] = [];
          for (let i = 0; i <= 210; i++) {
            const v = i / 100, t = trap_interval(v, this.n(), this.mode());
            if (!t) {
              if (lo.length) break;
              continue;
            }
            lo.push(S(t[0], v));
            hi.push(S(t[1], v));
          }
          if (lo.length < 2) return new Float64Array(0);
          const poly = [...lo, ...hi.reverse(), lo[0]];
          const vm = VMobject();
          vm.set_points_as_corners(poly.map((q) => [q[0], q[1], 0]) as any);
          return vm.points as Float64Array;
        }, key);
        trap.name = 'trap';
        // the edge of the QP's feasible set (not drawn for 'end')
        const edge = live_vm(stroke(c.coral, 2.5), () => {
          const md = this.mode();
          if (md === 'end') return new Float64Array(0);
          const pts: XY[] = [];
          for (let i = -20; i <= 210; i += 2) {
            const v = i / 100, e = p_feasible(v, this.n(), md);
            if (e === null || !Number.isFinite(e)) continue;
            pts.push([Math.min(10, e), v]);
          }
          pts.push([0, 2.1]);
          return polys_points(P.pieces(pts));
        }, key);
        edge.name = 'edge';
        const xf_edge = visible_when(P.curve([[10, 0], [10 - 2 * C_TERM, 2], [10 - 2.45 * C_TERM, 2.45]], { color: c.good, width: 4, dash: [0.16, 0.1] }), () => this.mode() === 'set');
        xf_edge.name = 'xf_edge';
        const target: any = Circle({ radius: 0.13, stroke_color: c.good, stroke_width: 4, fill_opacity: 0 });
        target.move_to(P.P(10, 0));
        target.name = 'target';

        // ---- the run: path, dots (coral where the QP had no solution), its end
        const pts_upto = (): XY[] => R().x.slice(0, shown() + 1).map((s) => S(s[0], s[1]));
        const path = live_vm(stroke(c.accent, 2.5, 0.7), () => {
          const ps = pts_upto();
          return ps.length >= 2 ? polys_points([ps]) : new Float64Array(0);
        }, tkey);
        const good_dots = live_vm(VMobject({ fill_color: c.accent, fill_opacity: 1, stroke_width: 0, stroke_color: c.accent }), () => {
          const r = R();
          return dots_points(pts_upto().filter((_, k) => k >= r.feasible.length || r.feasible[k]), 0.045);
        }, tkey);
        const run_group = VGroup(path, good_dots);
        run_group.name = 'path';
        const bad_dots = live_vm(VMobject({ fill_color: c.coral, fill_opacity: 1, stroke_width: 0, stroke_color: c.coral }), () => {
          const r = R();
          return dots_points(pts_upto().filter((_, k) => k < r.feasible.length && !r.feasible[k]), 0.06);
        }, tkey);
        bad_dots.name = 'bad_dots';
        const ended = () => shown() >= R().x.length - 1;
        const end_dot = VGroup(
          P.live_dot(() => (ended() && R().crash_k >= 0 ? [10, R().impact] : null), c.coral, 0.13),
          P.live_dot(() => (ended() && R().docked_k >= 0 ? [10, 0] : null), c.good, 0.1),
        );
        end_dot.name = 'end_dot';
        // the plan made at the decisive instant (dashed) and its end x_N (ring)
        const plan_shown = () => {
          const r = R();
          return r.shown_k >= 0 && shown() >= r.shown_k ? r.plans[r.shown_k] : null;
        };
        const plan_line = live_vm(stroke(c.ink, 3), () => {
          const pl = plan_shown();
          if (!pl) return new Float64Array(0);
          return polys_points(P.pieces(pl.map((s) => [s[0], s[1]] as XY)).flatMap((piece) => dash_polys(piece, 0.12, 0.08)));
        }, tkey);
        const ring: any = Circle({ radius: 0.11, stroke_color: c.ink, stroke_width: 3.5, fill_color: c.bg, fill_opacity: 1 });
        ring.add_updater((m: any) => {
          const pl = plan_shown(), k = tkey();
          if (m._key === k) return;
          m._key = k;
          m.set_opacity(pl ? 1 : 0);
          if (pl) {
            const e = pl[pl.length - 1];
            m.move_to(P.P(Math.min(10.4, e[0]), Math.max(-0.15, Math.min(2.4, e[1]))));
          }
        });
        const plan = VGroup(plan_line, ring);
        plan.name = 'plan';

        // ---- the same cart on the track, above the plane (same p scale)
        const tr = new Track({ x0: P.X(0), x1: P.X(10.5), y: 2.5, p: [0, 10.5], wall: 10, tick: 1, label_every: 2, cart_w: 0.7, cart_h: 0.34 });
        const cart = tr.cart(() => R().x[shown()][0]);
        const track = VGroup(tr.group, cart);
        track.name = 'track';

        // ---- the right column
        const RX = 3.0;
        const cond_word = words(L('the plan must end with:', '计划末端要求：'), 20, c.muted, RX, 3.62, { max_w: 3.9 });
        const conds: Record<Mode, Mobject> = {
          none: words(L('only the limits (as in M1)', '只有那几条限制（同 M1）'), 22, c.ink, RX, 3.2, { max_w: 3.9 }),
          cost: tex('\\text{limits} \\;+\\; x_N^\\top P\\, x_N \\text{ in the cost}', 26, c.ink),
          set: tex('p_N + 1.95\\, v_N \\le 10', 30, c.good),
          end: tex('x_N = (10,\\ 0)', 30, c.ink),
        };
        for (const md of ['cost', 'set', 'end'] as Mode[]) {
          const m = conds[md];
          if (m.width > 3.9) m.scale(3.9 / m.width);
          m.move_to([RX + m.width / 2, 3.2, 0]);
        }
        const condition = VGroup(cond_word, ...MODES.map((md) => visible_when(conds[md], () => this.mode() === md)));
        condition.name = 'condition';
        const outcome = live_label(() => {
          const r = R();
          if (!ended()) return '';
          if (r.crash_k >= 0) return L(`hits the wall at ${r.impact.toFixed(2)} m/s`, `以 ${r.impact.toFixed(2)} m/s 撞墙`);
          if (r.docked_k >= 0) return L(`docks at t = ${(r.docked_k * DT).toFixed(1)} s`, `t = ${(r.docked_k * DT).toFixed(1)} s 时停稳`);
          if (!r.started) return L('never moves: no plan at the start', '一动不动：起点就没有可行的计划');
          return L(`still moving after ${RUN_STEPS * DT} s`, `${RUN_STEPS * DT} 秒后还在动`);
        }, 26, () => (R().crash_k >= 0 ? c.coral : R().docked_k >= 0 ? c.good : c.ink), (m) => m.move_to([RX + m.width / 2, 2.6, 0]), { max_width: 3.9 });
        outcome.name = 'outcome';
        const facts = VGroup(
          live_label(() => {
            const r = R();
            if (!ended()) return '';
            if (!r.started) return '';
            return r.doomed_k >= 0 ? L(`crash certain from t = ${(r.doomed_k * DT).toFixed(1)} s`, `从 t = ${(r.doomed_k * DT).toFixed(1)} s 起必撞`) : L('never in the crash-certain region', '从没进入"必撞"区域');
          }, 20, c.ink, (m) => m.move_to([RX + m.width / 2, 2.15, 0]), { max_width: 3.9 }),
          live_label(() => {
            const r = R();
            if (!ended()) return '';
            if (r.infeasible_k === 0) return L('QP infeasible at t = 0', 'QP 在 t = 0 就无解');
            return r.infeasible_k > 0 ? L(`first QP without a solution: t = ${(r.infeasible_k * DT).toFixed(1)} s`, `第一次 QP 无解：t = ${(r.infeasible_k * DT).toFixed(1)} s`) : L('every QP had a solution', '每一个 QP 都有解');
          }, 20, () => (R().infeasible_k >= 0 ? c.coral : c.ink), (m) => m.move_to([RX + m.width / 2, 1.8, 0]), { max_width: 3.9 }),
        );
        facts.name = 'facts';
        const sw = (y: number, m: Mobject, s: string) => VGroup(m, words(s, 19, c.ink, RX + 0.55, y, { max_w: 3.35 }));
        const dot_at = (y: number, col: string, r: number) => {
          const d: any = Circle({ radius: r, fill_color: col, fill_opacity: 1, stroke_width: 0, color: col });
          d.move_to([RX + 0.22, y, 0]);
          return d;
        };
        const ly = [1.2, 0.8, 0.4, 0.0, -0.4, -0.8, -1.2];
        const ring_k: any = Circle({ radius: 0.09, stroke_color: c.ink, stroke_width: 3, fill_opacity: 0 });
        ring_k.move_to([RX + 0.44, ly[4], 0]);
        const legend = VGroup(
          sw(ly[0], dot_at(ly[0], c.accent, 0.05), L('the state every 0.1 s', '每 0.1 秒的状态')),
          sw(ly[1], dot_at(ly[1], c.coral, 0.065), L('QP had no solution: full brakes', 'QP 无解：只好全力刹车')),
          sw(ly[2], fill_box(RX, ly[2] - 0.12, RX + 0.44, ly[2] + 0.12, c.coral, 0.13), L('crash certain, even braking fully', '全力刹车也必撞')),
          sw(ly[3], fill_box(RX, ly[3] - 0.12, RX + 0.44, ly[3] + 0.12, c.coral, 0.5), L('trap: QP still solvable, crash certain', '陷阱：QP 还有解，却已必撞')),
          sw(ly[4], VGroup(polyline([[RX, ly[4]], [RX + 0.12, ly[4]]], c.ink, 3), polyline([[RX + 0.2, ly[4]], [RX + 0.32, ly[4]]], c.ink, 3), ring_k), L('a plan (dashed), its end (ring)', '一次计划（虚线）和终点（圈）')),
          visible_when(sw(ly[5], polyline([[RX, ly[5]], [RX + 0.44, ly[5]]], c.coral, 2.5), L('edge of the states with a plan', '有可行计划的状态的边界')), () => this.mode() !== 'end'),
          visible_when(sw(ly[6], polyline([[RX, ly[6]], [RX + 0.16, ly[6]]], c.good, 4), L('edge of the terminal set', '终端集的边界')), () => this.mode() === 'set'),
        );
        legend.name = 'legend';
        const note = aside(this, VGroup(
          words(L('simulation of a toy cart:', '玩具小车的模拟：'), 18, c.muted, RX, -1.75, { max_w: 3.9 }),
          words(L('|a| up to 1 m/s², |v| up to 2 m/s, Δt = 0.1 s', '|a| 不超过 1 m/s²，|v| 不超过 2 m/s，Δt = 0.1 秒'), 18, c.muted, RX, -2.05, { max_w: 3.9 }),
        ));
        note.name = 'note';

        // ---- controls
        const slider = new StepSlider(this.N, { lo: N_MIN, hi: N_MAX, step: 1, x0: -5.3, x1: 0.5, y: -3.5, ticks: [10, 20, 30, 40, 50, 60, 70, 80] });
        this.slider = slider;
        const n_caption = live_label(() => L(`look-ahead N = ${this.n()} steps = ${(this.n() * DT).toFixed(1)} s`, `预测时域 N = ${this.n()} 步 = ${(this.n() * DT).toFixed(1)} 秒`), 22, c.ink, (m) => m.move_to([-5.5 + m.width / 2, -3.1, 0]));
        const s_group = VGroup(slider.group, n_caption);
        s_group.name = 'slider';
        const labels = [L('nothing', '不加'), L('cost P', '终端代价'), L('terminal set', '终端集'), L('end at target', '终点=目标')];
        const choice = new Choice({ tracker: this.m, values: [0, 1, 2, 3], labels, x0: 1.15, x1: 6.9, y: -3.5, font_size: 20 });
        this.choice = choice;
        const m_group = VGroup(choice, words(L('end of the plan', '计划的末端'), 20, c.muted, 1.15, -3.1, { max_w: 3.9 }));
        m_group.name = 'mode';

        // ---- the story
        const tween = (to: number, run_time: number) => {
          const from = this.kt.get_value();
          return UpdateFromAlphaFunc(this.kt, (_m: unknown, a?: number) => this.kt.set_value(from + (to - from) * (a ?? 1)), { run_time, rate_func: linear }) as any;
        };
        this.add(wall);
        this.play(FadeIn(P.group), FadeIn(crash_region), FadeIn(speed_band), FadeIn(target), FadeIn(track), FadeIn(condition), FadeIn(note), FadeIn(s_group), FadeIn(m_group), { run_time: 1.2 });
        this.add(edge, xf_edge, run_group, bad_dots, end_dot, plan, outcome, facts);
        if (p.story === 'trap') {
          const r = R();
          const stop = r.trap_k >= 0 ? r.trap_k : r.doomed_k >= 0 ? r.doomed_k : r.x.length - 1;
          this.next_section(); // (a section per beat, §, of the narration: the picture waits there for the voice)
          this.play(FadeIn(legend.submobjects[0]), FadeIn(legend.submobjects[2]), { run_time: 0.8 });
          this.next_section();
          this.play(tween(stop, 4.5));
          this.next_section();
          this.play(FadeIn(trap), FadeIn(legend.submobjects[3]), { run_time: 1 });
          this.wait(3);
          this.next_section();
          this.play(FadeIn(legend.submobjects[1]), FadeIn(legend.submobjects[5]), tween(r.x.length - 1, 2.5));
          this.wait(1);
          this.play(FadeIn(legend.submobjects[4]), Create(plan_line), { run_time: 1.2 });
          this.play(FadeIn(legend.submobjects[6]), tween(1e4, 0.1));
          this.add(legend);
          this.wait(2);
        } else {
          this.play(FadeIn(trap), FadeIn(legend), { run_time: 0.8 });
          this.wait(1);
        }
      }
    }
    return new TerminalWorld();
  },
  explore: (scene: any, ui, p) => {
    const lang = resolve_lang(p.lang);
    const released = () => emit(scene, 'released', scene.result() as unknown as Record<string, unknown>);
    scene.choice.attach(ui, pick(lang, TERMINAL_LABELS.mode.en, TERMINAL_LABELS.mode.zh), () => released());
    scene.slider.attach(ui, pick(lang, TERMINAL_LABELS.N.en, TERMINAL_LABELS.N.zh), { on_end: released });
  },
});
