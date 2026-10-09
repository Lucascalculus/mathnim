// Training curves to diagnose (a figure, no handles): train loss and
// answer-only validation loss on the left, a task metric on the right. Four
// illustrative presets show the typical shapes - healthy, overfitting, a
// learning rate that is too high, and a loss mask bug (loss mostly on a long,
// repeated system prompt) - or the tutor draws the learner's own numbers.
import { Create, FadeIn, MathTex, Scene, VGroup, VMobject } from 'manim-web';
import { palette } from '../../theme';
import { define_visual } from '../../visual';
import { fit, label } from '../f/kit';
import { LANG_SPEC, pick, resolve_lang, seg, type Lang } from './kit';

export interface TrainingCurvesParams extends Record<string, unknown> {
  preset: string;
  series: string;
  show_answer: boolean;
  lang: string;
}

const N = 60; // points per curve (x = training progress, 0..3 epochs)
const xs = Array.from({ length: N }, (_, i) => (3 * i) / (N - 1));
/** Illustrative curves for each preset: train loss, answer-only validation loss, task metric (0..1). */
export function preset_curves(preset: string): { train: number[]; val: number[]; metric: number[] } {
  const ex = (x: number, a: number, b: number, k: number) => b + (a - b) * Math.exp(-k * x);
  switch (preset) {
    case 'overfit':
      return {
        train: xs.map((x) => ex(x, 2.1, 0.15, 1.6)),
        val: xs.map((x) => ex(x, 2.1, 1.05, 2.4) + 0.32 * Math.max(0, x - 0.9) ** 1.4),
        metric: xs.map((x) => 0.2 + 0.42 * (1 - Math.exp(-2.5 * x)) - 0.14 * Math.max(0, x - 1.4) ** 1.2),
      };
    case 'lr_high':
      return {
        train: xs.map((x, i) => ex(x, 2.1, 1.3, 1.2) + (i % 9 === 4 ? 0.9 : i % 13 === 6 ? 0.6 : 0) + 0.12 * Math.sin(i * 1.7)),
        val: xs.map((x, i) => ex(x, 2.1, 1.45, 1.0) + (i % 9 === 5 ? 0.5 : 0) + 0.08 * Math.sin(i * 1.3)),
        metric: xs.map((x, i) => 0.2 + 0.15 * (1 - Math.exp(-x)) + 0.06 * Math.sin(i * 0.9)),
      };
    case 'mask_bug':
      return {
        train: xs.map((x) => ex(x, 2.1, 0.3, 9)),
        val: xs.map((x) => 1.95 - 0.04 * (1 - Math.exp(-2 * x))),
        metric: xs.map((x) => 0.2 + 0.02 * (1 - Math.exp(-2 * x))),
      };
    default:
      return {
        train: xs.map((x) => ex(x, 2.1, 0.85, 1.5)),
        val: xs.map((x) => ex(x, 2.1, 1.0, 1.4)),
        metric: xs.map((x) => 0.2 + 0.45 * (1 - Math.exp(-1.6 * x))),
      };
  }
}
/** Parse `series` JSON ({"name": [numbers], ...}); returns null when invalid. */
export function parse_series(s: string): Record<string, number[]> | null {
  try {
    const o = JSON.parse(s);
    if (!o || typeof o !== 'object' || Array.isArray(o)) return null;
    const out: Record<string, number[]> = {};
    for (const [k, v] of Object.entries(o)) if (Array.isArray(v) && v.length >= 2 && v.every((x) => typeof x === 'number' && Number.isFinite(x))) out[k.slice(0, 24)] = (v as number[]).slice(0, 400);
    return Object.keys(out).length ? out : null;
  } catch {
    return null;
  }
}

export const training_curves = define_visual<TrainingCurvesParams>({
  name: 'training_curves',
  summary: "Training curves to diagnose (a figure): train loss and answer-only validation loss, and a task metric. Presets (illustrations): 'healthy', 'overfit' (val U-shape, metric falls), 'lr_high' (spikes), 'mask_bug' (train loss collapses on a repeated prompt, answer-only val and metric flat); or 'custom' with the learner's own numbers as JSON series.",
  topics: ['fine-tuning', 'sft', 'training curves', 'overfitting', 'learning rate', 'loss mask', 'diagnosis'],
  params: {
    preset: { type: 'enum', values: ['healthy', 'overfit', 'lr_high', 'mask_bug', 'custom'], default: 'healthy', doc: "which illustrated shape to draw; 'custom' draws `series`" },
    series: { type: 'text', max_length: 4000, default: '', doc: 'custom only: JSON {"name": [values...], ...}, up to 4 series (e.g. {"train":[2.1,1.4,1.1],"val":[2.0,1.6,1.7]}); names ending in "acc"/"score"/"metric"/"reward" go on the right panel' },
    show_answer: { type: 'boolean', default: false, doc: 'write the diagnosis of the preset under the plots (for the reveal after a question)' },
    lang: LANG_SPEC,
  },
  examples: [{}, { preset: 'overfit', lang: 'zh' }, { preset: 'lr_high', show_answer: true }, { preset: 'mask_bug', show_answer: true, lang: 'zh' }, { preset: 'custom', series: '{"train":[2.1,1.5,1.2,1.0],"val":[2.0,1.6,1.5,1.6],"task acc":[0.2,0.4,0.5,0.48]}' }],
  ids: ['loss_panel', 'metric_panel', 'legend', 'diagnosis', 'note'],
  scene: (p) => {
    const lang = resolve_lang(p.lang);
    class TrainingCurves extends Scene {
      override construct() {
        const c = palette();
        const L = { x0: -6.5, x1: -0.6, y0: -2.2, y1: 2.9 }, R = { x0: 0.8, x1: 6.7, y0: -2.2, y1: 2.9 };
        const axes = (b: typeof L, title: string, xlab: string) => VGroup(
          seg([b.x0, b.y0], [b.x1, b.y0], c.muted, 2), seg([b.x0, b.y0], [b.x0, b.y1], c.muted, 2),
          fit(label(title, 24, c.ink), b.x1 - b.x0, 0.42).move_to([(b.x0 + b.x1) / 2, b.y1 + 0.35, 0]),
          fit(label(xlab, 20, c.muted), 3, 0.35).move_to([b.x1 - 1.2, b.y0 - 0.3, 0]),
        );
        const line = (b: typeof L, ys: number[], lo: number, hi: number, color: string, dash = false) => {
          const vm = VMobject({ stroke_color: color, stroke_width: 4, fill_opacity: 0 });
          const pts = ys.map((y, i) => [b.x0 + (i / (ys.length - 1)) * (b.x1 - b.x0), b.y0 + ((Math.min(hi, Math.max(lo, y)) - lo) / (hi - lo)) * (b.y1 - b.y0), 0]);
          vm.set_points_as_corners(pts);
          if (dash) vm.set_stroke({ opacity: 0.85 });
          return vm;
        };
        const cols = [c.accent, c.coral, c.good, c.purple];
        const loss_panel = VGroup(), metric_panel = VGroup(), legend = VGroup();
        let leg_y = 3.65, leg_x = -6.5;
        const add_leg = (s: string, col: string) => {
          const sw = seg([leg_x, leg_y], [leg_x + 0.5, leg_y], col, 5);
          const t = fit(label(s, 22, c.ink), 3.6, 0.38);
          t.move_to([leg_x + 0.65 + t.width / 2, leg_y, 0]);
          legend.add(sw, t);
          leg_x += 0.65 + t.width + 0.5;
        };
        if (p.preset === 'custom') {
          const s = parse_series(p.series) ?? { train: [1, 0.5] };
          const keys = Object.keys(s).slice(0, 4);
          const is_metric = (k: string) => /(acc|score|metric|reward|pass)/i.test(k);
          const lk = keys.filter((k) => !is_metric(k)), mk = keys.filter(is_metric);
          const range = (ks: string[]) => {
            const v = ks.flatMap((k) => s[k]);
            const lo = Math.min(...v), hi = Math.max(...v);
            return [lo - 0.05 * (hi - lo || 1), hi + 0.05 * (hi - lo || 1)];
          };
          loss_panel.add(axes(L, pick(lang, 'losses', 'loss'), pick(lang, 'training →', '训练进度 →')));
          metric_panel.add(axes(R, pick(lang, 'metrics', '指标'), pick(lang, 'training →', '训练进度 →')));
          const [l0, l1] = range(lk.length ? lk : keys), [m0, m1] = range(mk.length ? mk : keys);
          keys.forEach((k, i) => {
            const m = is_metric(k);
            (m ? metric_panel : loss_panel).add(line(m ? R : L, s[k], m ? m0 : l0, m ? m1 : l1, cols[i]));
            add_leg(k, cols[i]);
          });
        } else {
          const cv = preset_curves(p.preset);
          loss_panel.add(axes(L, pick(lang, 'loss', 'loss'), pick(lang, 'epochs 0 → 3', '轮数 0 → 3')), line(L, cv.train, 0, 2.6, c.accent), line(L, cv.val, 0, 2.6, c.coral));
          metric_panel.add(axes(R, pick(lang, 'task metric on held-out set', '留出集上的任务指标'), pick(lang, 'epochs 0 → 3', '轮数 0 → 3')), line(R, cv.metric, 0, 0.8, c.good));
          add_leg(pick(lang, 'train loss', '训练 loss'), c.accent);
          add_leg(pick(lang, 'val loss (answer tokens only)', '验证 loss（只算回答）'), c.coral);
          add_leg(pick(lang, 'task metric', '任务指标'), c.good);
        }
        loss_panel.name = 'loss_panel';
        metric_panel.name = 'metric_panel';
        legend.name = 'legend';
        const note = fit(label(p.preset === 'custom' ? pick(lang, 'your numbers', '你的数据') : pick(lang, 'illustration: typical shapes, not a real run', '示意：典型形状，不是某次真实训练'), 20, c.muted), 6, 0.36);
        note.move_to([6.7 - note.width / 2, -3.65, 0]);
        note.name = 'note';
        const answers: Record<string, [string, string]> = {
          healthy: ['healthy: both losses fall and level off, the metric rises', '正常：两条 loss 都下降后走平，指标上升'],
          overfit: ['overfitting: val loss turns up after ~1 epoch and the metric falls', '过拟合：约 1 轮后验证 loss 回升，任务指标下降'],
          lr_high: ['learning rate too high: spikes and a noisy, high plateau', '学习率过大：尖刺，并在较高的位置震荡'],
          mask_bug: ['mask bug: train loss collapses (a memorised prompt) while answer-only val and the metric do not move', '掩码错误：训练 loss 骤降（背下了重复的提示），只算回答的验证 loss 和指标不动'],
        };
        const diag = p.show_answer && answers[p.preset] ? fit(label(pick(lang, answers[p.preset][0], answers[p.preset][1]), 22, c.ink), 12.6, 0.4).move_to([0, -3.1, 0]) : null;
        this.play(FadeIn(legend), Create(loss_panel), Create(metric_panel), { run_time: 2.2 });
        this.play(FadeIn(note), { run_time: 0.5 });
        const diag_g = VGroup();
        diag_g.name = 'diagnosis';
        if (diag) {
          diag_g.add(diag);
          this.play(FadeIn(diag), { run_time: 0.8 });
        }
        this.add(loss_panel, metric_panel, legend, note, diag_g);
        this.wait(1.5);
        void MathTex;
      }
    }
    return new TrainingCurves();
  },
});
