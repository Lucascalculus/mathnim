// The REINFORCE baseline (D2a). Three responses with rewards 2, 5, 9 under a
// uniform softmax policy. Drawing response i gives the one-sample update
// ĝ_i = (R_i − b)(e_i − π) on the logits; for three responses these updates
// live in a plane, so each is a point. The mean of the three (the true
// gradient, gold arrow) never moves when the zero line b moves; the spread of
// the points around it (the variance, dashed lines) is smallest at
// b = mean reward. Exact computation.
import { Create, Dot, FadeIn, Scene, VGroup, ValueTracker, always_redraw, smooth } from 'manim-web';
import { palette } from '../../theme';
import { define_visual } from '../../visual';
import { arrow, dashed, tex } from '../../linalg/kit';
import { best_baseline, pg_estimates, plane3 } from './math';
import { LANG_SPEC, clamp, label, label_at, live_number, mixed, pick, polyline, rect, resolve_lang, seg, x_ticks, type Lang, type P3 } from './kit';
import { aside } from '../../aside';

export interface PgBaselineParams extends Record<string, unknown> {
  story: string;
  lang: string;
}

export const PG_REWARDS = [2, 5, 9];
export const PG_PROBS = [1 / 3, 1 / 3, 1 / 3];
export const PG_BEST = best_baseline(PG_REWARDS, PG_PROBS);
const B_MAX = 12;
// left: rewards and the zero line
const BXS = [-5.3, -3.8, -2.3];
const RY0 = -2.75, RY1 = 2.35;
const Yr = (r: number) => RY0 + (r / B_MAX) * (RY1 - RY0);
// right top: the plane of one-sample updates
const PC: [number, number] = [3.75, 0.85], UNIT = 0.3;
const Pt = (v: readonly number[]): P3 => [PC[0] + UNIT * v[0], PC[1] + UNIT * v[1], 0];
// right bottom: variance against b
const VX0 = 0.75, VX1 = 6.4, VY0 = -3.5, VY1 = -2.3, V_MAX = 35;
const Vx = (b: number) => VX0 + (b / B_MAX) * (VX1 - VX0);
const Vy = (v: number) => VY0 + (Math.min(v, V_MAX) / V_MAX) * (VY1 - VY0);

export const pg_baseline = define_visual<PgBaselineParams>({
  name: 'pg_baseline',
  summary: 'REINFORCE with a baseline: three responses (rewards 2, 5, 9, uniform policy); each one-sample update (R−b)(e_i−π) is a point in a plane; the mean update (the true gradient, gold arrow) stays fixed as the zero line b moves, while the spread of the points (the variance) is smallest at b = mean reward 5.33. Drag b.',
  topics: ['policy gradient', 'reinforce', 'baseline', 'variance', 'advantage', 'rlhf', 'grpo', 'fine-tuning'],
  params: {
    story: { type: 'enum', values: ['full', 'setup'], default: 'full', doc: "'full' sweeps b and traces the variance; 'setup' builds the picture at b = 0 with an empty trace (for a world)" },
    lang: LANG_SPEC,
  },
  examples: [{}, { lang: 'zh' }, { story: 'setup', lang: 'zh' }],
  ids: ['formula', 'bars', 'zero_line', 'advantages', 'updates', 'mean_arrow', 'spread', 'variance', 'trace'],
  scene: (p) => {
    const lang: Lang = resolve_lang(p.lang);
    class PgBaseline extends Scene {
      b = ValueTracker(0);
      /** Visited baselines (the trace), rounded to 0.1. */
      visited = new Set<number>();
      emit: (type: string, data?: Record<string, unknown>) => void = () => {};
      est() {
        return pg_estimates(PG_REWARDS, PG_PROBS, this.b.get_value());
      }
      variance() {
        return this.est().variance;
      }
      override construct() {
        const c = palette();
        const COL = [c.accent, c.teal, c.purple];
        const { b } = this;
        b.name = 'b';
        this.track(b);
        const rays = PG_REWARDS.map((_, i) => plane3(PG_PROBS.map((q, k) => (k === i ? 1 : 0) - q)));
        const mean = plane3(pg_estimates(PG_REWARDS, PG_PROBS, 0).mean);
        this.add_updater(() => this.visited.add(Math.round(b.get_value() * 10) / 10));

        // ---- left: rewards, the zero line, advantages
        const formula = tex('\\hat g = (R - b)\\,\\nabla_\\theta \\log \\pi_\\theta(y)', 32, c.ink).move_to([-3.9, 3.45, 0]);
        formula.name = 'formula';
        const lcap = label(pick(lang, 'rewards R and the zero line b', '奖励 R 和零线 b'), 22, c.muted);
        lcap.move_to([-3.9, 2.9, 0]);
        const floor = seg([-6.1, Yr(0)], [-1.5, Yr(0)], c.muted, 2);
        const bars = VGroup(...PG_REWARDS.map((R, i) => VGroup(
          rect(BXS[i] - 0.38, Yr(0), BXS[i] + 0.38, Yr(R), COL[i], 0.22),
          seg([BXS[i] - 0.42, Yr(R)], [BXS[i] + 0.42, Yr(R)], COL[i], 6),
          tex(`R_${i + 1} = ${R}`, 26, COL[i]).move_to([BXS[i], Yr(R) + 0.3, 0]),
          tex(`y_${i + 1}`, 30, COL[i]).move_to([BXS[i], Yr(0) - 0.35, 0]),
        )));
        bars.name = 'bars';
        const zero_line = always_redraw(() => {
          const y = Yr(b.get_value());
          return VGroup(seg([-6.1, y], [-1.25, y], c.gold, 5), Dot([-1.1, y, 0], { radius: 0.15, color: c.gold }));
        });
        zero_line.name = 'zero_line';
        const b_lab = always_redraw(() => {
          const t = tex(`b = ${b.get_value().toFixed(2)}`, 28, c.gold);
          t.move_to([-0.8 + t.width / 2, Yr(b.get_value()), 0]);
          return t;
        });
        const advantages = always_redraw(() => VGroup(...PG_REWARDS.map((R, i) => {
          const a = R - b.get_value(), x = BXS[i] + 0.62;
          if (Math.abs(a) < 0.05) return VGroup();
          return arrow([x, Yr(b.get_value()), 0], [x, Yr(R), 0], a > 0 ? c.good : c.coral, 5, 0.18);
        })));
        advantages.name = 'advantages';

        // ---- right top: the one-sample updates as points
        // ĝ is not in the canvas font: the symbols are TeX
        const rcap = mixed([pick(lang, 'one-sample updates', '单样本更新'), { tex: '\\hat g' }, pick(lang, '(3 possible)', '（3 种可能）')], 0, 3.5, 22, c.muted);
        rcap.move_to([PC[0], 3.5, 0]);
        const axes = VGroup(...rays.map((v, i) => {
          const end = Pt([v[0] * 8.4, v[1] * 8.4]);
          return VGroup(dashed(Pt([0, 0]), end, c.faint, 2, 0.1), tex(`y_${i + 1}`, 26, COL[i]).move_to([end[0] + v[0] * 0.25, end[1] + v[1] * 0.25, 0]));
        }));
        const origin = Dot(Pt([0, 0]), { radius: 0.05, color: c.muted });
        const updates = always_redraw(() => VGroup(...this.est().g.map((g, i) => Dot(Pt(plane3(g)), { radius: 0.12, color: COL[i] }))));
        updates.name = 'updates';
        const spread = always_redraw(() => VGroup(...this.est().g.map((g, i) => dashed(Pt(mean), Pt(plane3(g)), COL[i], 2.5, 0.08, 0.8))));
        spread.name = 'spread';
        const mean_arrow = VGroup(arrow(Pt([0, 0]), Pt(mean), c.gold, 7, 0.16));
        mean_arrow.name = 'mean_arrow';
        const mean_note = mixed([pick(lang, 'gold arrow = mean', '金色箭头 = 均值'), { tex: '\\mathbb{E}[\\hat g]' }, pick(lang, ', same for every b', '，对每个 b 都一样')], 0, 3.05, 22, c.gold);
        if (mean_note.width > 6.2) mean_note.scale(6.2 / mean_note.width);
        // centred over the plane, but never past the right edge of the frame
        mean_note.move_to([Math.min(PC[0], 6.85 - mean_note.width / 2), 3.05, 0]);

        // ---- right bottom: variance against b, traced where b has been
        const vcap = tex('\\mathrm{Var}[\\hat g] = \\mathbb{E}\\,\\lVert \\hat g - \\mathbb{E}[\\hat g] \\rVert^2 =', 28, c.ink);
        vcap.move_to([VX0 - 0.15 + vcap.width / 2, -1.92, 0]);
        const vnum = live_number(() => this.variance(), { decimals: 2, size: 30, color: c.coral });
        vnum.add_updater((m: any) => m.move_to([vcap.get_right()[0] + 0.15 + m.width / 2, -1.92, 0]));
        const variance = VGroup(vcap, vnum);
        variance.name = 'variance';
        const vaxis = VGroup(seg([VX0, VY0], [VX1, VY0], c.muted, 2), seg([VX0, VY0], [VX0, VY1], c.muted, 2));
        const vt = x_ticks([0, 4, 8, 12], Vx, VY0 - 0.22);
        const vb = tex('b', 26, c.ink).move_to([VX1 + 0.3, VY0, 0]);
        const trace = always_redraw(() => {
          const pts = [...this.visited].sort((x, y) => x - y).map((x) => [Vx(x), Vy(pg_estimates(PG_REWARDS, PG_PROBS, x).variance)]);
          const g = VGroup();
          // draw only contiguous runs (no straight jumps over unvisited b)
          let run: number[][] = [];
          const flush = () => {
            if (run.length >= 2) g.add(polyline(run, c.coral, 4));
            else if (run.length === 1) g.add(Dot([run[0][0], run[0][1], 0], { radius: 0.04, color: c.coral }));
            run = [];
          };
          let last = -Infinity;
          for (const q of pts) {
            const bx = ((q[0] - VX0) / (VX1 - VX0)) * B_MAX;
            if (bx - last > 0.25) flush();
            run.push(q);
            last = bx;
          }
          flush();
          g.add(Dot([Vx(b.get_value()), Vy(this.variance()), 0], { radius: 0.09, color: c.coral }));
          return g;
        });
        trace.name = 'trace';
        const exact = aside(this, label(pick(lang, 'toy policy, exact', '玩具策略，精确计算'), 22, c.muted));
        exact.move_to([-6.9 + exact.width / 2, -3.65, 0]);

        // ---- story
        b.set_value(0);
        this.play(FadeIn(formula), FadeIn(lcap), Create(floor), FadeIn(bars), FadeIn(exact), { run_time: 1.2 });
        this.play(FadeIn(zero_line), FadeIn(b_lab), FadeIn(advantages), { run_time: 0.8 });
        this.play(FadeIn(rcap), FadeIn(axes), FadeIn(origin), FadeIn(updates), FadeIn(spread), { run_time: 1 });
        this.play(FadeIn(mean_arrow), FadeIn(mean_note), FadeIn(variance), FadeIn(vaxis), FadeIn(vt), FadeIn(vb), { run_time: 1 });
        this.add(trace);
        if (p.story === 'full') {
          this.wait(1);
          this.play(b.animate.set_value(B_MAX), { run_time: 6, rate_func: smooth });
          this.wait(0.5);
          this.play(b.animate.set_value(PG_BEST), { run_time: 3, rate_func: smooth });
          this.wait(2);
        } else {
          this.wait(0.5);
        }
      }
    }
    return new PgBaseline();
  },
  explore: (scene: any, ui, p) => {
    const lang = resolve_lang(p.lang);
    ui.add_handle({
      tracker: scene.b,
      from_value: (v: number) => [-1.1, Yr(v), 0],
      to_value: (pt: P3) => clamp(Math.round(((pt[1] - RY0) / (RY1 - RY0)) * B_MAX * 20) / 20, 0, B_MAX),
      constraint: (pt: P3) => [-1.1, clamp(pt[1], Yr(0), Yr(B_MAX)), 0],
      step: 0.1,
      radius: 0.45,
      label: pick(lang, 'the zero line b', '零线 b'),
      on_end: () => scene.emit('released', { b: scene.b.get_value(), variance: scene.variance() }),
    });
  },
});
