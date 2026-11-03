// Training curves to diagnose (a figure, no handles): train loss and
// answer-only validation loss on the left, a task metric on the right. Four
// illustrative presets show the typical shapes - healthy, overfitting, a
// learning rate that is too high, and a loss mask bug (loss mostly on a long,
// repeated system prompt) - or the tutor draws the learner's own numbers.
// On the engine: two plots side by side (stacked on a phone), each curve in its
// noun's colour and drawn on by the script; words wrap instead of shrinking.
import { Figure, Path, column, reveal, row, set, t, together, wait, type XY } from '@mathnim/engine';
import { define_figure } from '../../visual';
import { LANG_SPEC, figure_lang } from './kit';

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

const ANSWERS: Record<string, [string, string]> = {
  healthy: ['healthy: both losses fall and level off, the metric rises', '正常：两条 loss 都下降后走平，指标上升'],
  overfit: ['overfitting: val loss turns up after ~1 epoch and the metric falls', '过拟合：约 1 轮后验证 loss 回升，任务指标下降'],
  lr_high: ['learning rate too high: spikes and a noisy, high plateau', '学习率过大：尖刺，并在较高的位置震荡'],
  mask_bug: ['mask bug: train loss collapses (a memorised prompt) while answer-only val and the metric do not move', '掩码错误：训练 loss 骤降（背下了重复的提示），只算回答的验证 loss 和指标不动'],
};
const SERIES_ROLES = ['noun:train-loss', 'noun:val-loss', 'noun:metric', 'noun:adapter'];

export function training_curves_figure(p: TrainingCurvesParams): Figure {
  const lang = figure_lang(p.lang);
  const fig = new Figure({ lang });
  const draw = fig.param('draw', 0, { range: [0, 1], doc: 'how much of each curve is drawn' });
  type S = { name: string | ReturnType<typeof t>; ys: number[]; role: string; right: boolean };
  let series: S[], lr: [number, number], mr: [number, number], xr: [number, number], xt: number[];
  if (p.preset === 'custom') {
    const s = parse_series(p.series) ?? { train: [1, 0.5] };
    const keys = Object.keys(s).slice(0, 4), is_metric = (k: string) => /(acc|score|metric|reward|pass)/i.test(k);
    series = keys.map((k, i) => ({ name: k, ys: s[k], role: SERIES_ROLES[i], right: is_metric(k) }));
    const range = (ss: S[]): [number, number] => {
      const v = ss.flatMap((x) => x.ys), lo = Math.min(...v), hi = Math.max(...v);
      return [lo - 0.05 * (hi - lo || 1), hi + 0.05 * (hi - lo || 1)];
    };
    const left = series.filter((x) => !x.right), right = series.filter((x) => x.right);
    lr = range(left.length ? left : series);
    mr = range(right.length ? right : series);
    const n = Math.max(...series.map((x) => x.ys.length));
    xr = [0, n - 1];
    xt = [];
  } else {
    const cv = preset_curves(p.preset);
    series = [
      { name: t('训练 loss', 'train loss'), ys: cv.train, role: 'noun:train-loss', right: false },
      { name: t('验证 loss（只算回答）', 'val loss (answer tokens only)'), ys: cv.val, role: 'noun:val-loss', right: false },
      { name: t('任务指标', 'task metric'), ys: cv.metric, role: 'noun:metric', right: true },
    ];
    lr = [0, 2.6];
    mr = [0, 0.8];
    xr = [0, 3];
    xt = [0, 1, 2, 3];
  }
  const custom = p.preset === 'custom';
  const xlab = { text: custom ? t('训练进度 →', 'training →') : t('轮数', 'epochs') };
  const L = fig.plot({ id: 'loss_panel', x: xr, y: lr, x_ticks: xt, x_label: xlab, phone_aspect: 1.1, says: t('左：两条 loss', 'left: the losses') });
  const R = fig.plot({ id: 'metric_panel', x: xr, y: mr, x_ticks: xt, x_label: xlab, phone_aspect: 1.1, says: t('右：任务指标', 'right: the task metric') });
  const curves = series.map((s, i) => {
    const P = s.right ? R : L, lo = P.spec.y[0], hi = P.spec.y[1];
    const pts = s.ys.map((y, k): XY => [xr[0] + ((xr[1] - xr[0]) * k) / Math.max(1, s.ys.length - 1), Math.min(hi, Math.max(lo, y))]);
    return P.add(new Path(pts, { id: `curve_${i}`, role: s.role, width: 3, upto: draw }));
  });
  const legend = fig.legend(series.map((s) => ({ role: s.role, text: s.name, mark: 'line' as const })), { id: 'legend' });
  const title = (zh: string, en: string, id: string) => fig.caption(t(zh, en), { id, kind: 'label', weight: 600 });
  const lt = title(custom ? 'loss' : 'loss', custom ? 'losses' : 'loss', 'loss_title');
  const rt = title(custom ? '指标' : '留出集上的任务指标', custom ? 'metrics' : 'task metric on held-out set', 'metric_title');
  const diag = p.show_answer && ANSWERS[p.preset] ? fig.caption(t(ANSWERS[p.preset][1], ANSWERS[p.preset][0]), { id: 'diagnosis' }) : null;
  fig.aside(custom ? t('你的数据', 'your numbers') : t('示意：典型形状，不是某次真实训练', 'illustration: typical shapes, not a real run'));
  // (small multiples: the two panels stay side by side on a phone too, so loss and metric are read at the same epoch)
  fig.layout(column([legend, row([column([lt, L], { gap: 6 }), column([rt, R], { gap: 6 })], { gap: 32, phone: 'row' }), ...(diag ? [diag] : [])], { gap: 12 }));
  fig.script(
    together(reveal(legend, lt, rt, L, R, ...curves), set(draw, 1, 'travel', 2.2)),
    ...(diag ? [reveal(diag)] : []),
    wait(1.5),
  );
  return fig;
}

export const training_curves = define_figure<TrainingCurvesParams>({
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
  ids: ['loss_panel', 'metric_panel', 'legend', 'diagnosis'],
  figure: training_curves_figure,
});
