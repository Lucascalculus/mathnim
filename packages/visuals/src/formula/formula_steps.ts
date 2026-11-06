// Formula steps on a stage: a derivation as one formula that changes line by line (the engine's Steps), as large as
// the lesson's video frame allows, one beat of the script per change so the narration's § marks step through it.
// Any subject: algebra, calculus, units, chemistry (\ce{...}), logic, Chinese in \text{...}. The lines are read,
// typeset and checked (review_steps) when the figure is built: a line that does not follow is marked, and the figure's
// own check reports it to the doctor. In a text the same lines are a `steps` block (present), with no frame.
import { review_steps, steps_figure, type Figure } from '@mathnim/engine';
import { define_figure } from '../visual';
import { LANG_SPEC, figure_lang } from '../ft/f/kit';

export interface FormulaStepsParams extends Record<string, unknown> {
  steps: string;
  steps_zh: string;
  per_step: number;
  lang: string;
}

export function formula_steps_figure(p: Partial<FormulaStepsParams> = {}): Figure {
  const lang = figure_lang(p.lang);
  const src = lang === 'zh' && p.steps_zh?.trim() ? p.steps_zh : p.steps ?? DEFAULT;
  const r = review_steps(src);
  const fig = steps_figure(r.lines, { lang, per_step: p.per_step ?? 1.3, nouns: r.nouns });
  fig.derivation.doubtful = r.doubtful;
  fig.check('every line follows from the one before', () => (r.doubtful.length ? r.issues.join('; ') : null));
  fig.check('no step too big to follow', () => r.issues.find((s) => s.includes('too much')) ?? null);
  return fig;
}

const DEFAULT = '2x + 3 = 11\n2x + 3 - 3 = 11 - 3 % subtract 3 from both sides\n2x = 8\nx = 4 % divide both sides by 2';
const DEFAULT_ZH = '2x + 3 = 11\n2x + 3 - 3 = 11 - 3 % 两边同时减 3\n2x = 8\nx = 4 % 两边同时除以 2';

export const formula_steps = define_figure<FormulaStepsParams>({
  name: 'formula_steps',
  summary: 'A derivation as one formula that changes line by line (solving, simplifying, expanding, differentiating, putting numbers in, converting units, balancing a reaction, rewriting a logic formula): each token stays, travels over the = sign, flows together or cancels; the reason for each line is written under it. Every line is checked. One narration beat (§) per change.',
  topics: ['derivation', 'algebra', 'equation', 'simplify', 'calculus', 'derivative', 'units', 'chemistry', 'logic', 'expected value', 'substitution', 'formula'],
  params: {
    steps: { type: 'text', max_length: 2000, default: DEFAULT, doc: 'the derivation in English: one complete TeX formula per line (no $), and after a line `%` with a few words for what was done to get it; 2-8 lines, one change per line. A first line `% nouns: x_0 = value, f = function` draws those symbols in the colour of the noun they name, as the figure beside it does' },
    steps_zh: { type: 'text', max_length: 2000, default: DEFAULT_ZH, doc: 'the same lines with their reasons in Chinese (empty: the English lines are used)' },
    per_step: { type: 'number', min: 0.6, max: 3, default: 1.3, doc: 'seconds each change takes' },
    lang: LANG_SPEC,
  },
  examples: [
    {},
    { lang: 'zh' },
    { steps: '\\frac{d}{dx}x^{3}\n3x^{2} % power rule: bring the exponent down, lower it by one', steps_zh: '\\frac{d}{dx}x^{3}\n3x^{2} % 幂法则：指数落下来，再减一' },
    { steps: '\\ce{CH4 + O2 -> CO2 + H2O}\n\\ce{CH4 + O2 -> CO2 + 2H2O} % balance H\n\\ce{CH4 + 2O2 -> CO2 + 2H2O} % then O', steps_zh: '\\ce{CH4 + O2 -> CO2 + H2O}\n\\ce{CH4 + O2 -> CO2 + 2H2O} % 先配氢\n\\ce{CH4 + 2O2 -> CO2 + 2H2O} % 再配氧' },
    { steps: '% nouns: \\text{EV} = expected-value\n\\text{EV} = 0.8 \\times 20 + 0.2 \\times (-9)\n\\text{EV} = 16 + (-1.8) % each payoff times its chance\n\\text{EV} = 14.2 % add', steps_zh: '% nouns: \\text{EV} = expected-value\n\\text{EV} = 0.8 \\times 20 + 0.2 \\times (-9)\n\\text{EV} = 16 + (-1.8) % 每个结果乘它的概率\n\\text{EV} = 14.2 % 相加' },
    { steps: '\\text{EV} = 0.8 \\times 20 + 0.2 \\times (-9)\n\\text{EV} = 16 + (-1.8) % each payoff times its chance\n\\text{EV} = 14.2 % add', steps_zh: '\\text{EV} = 0.8 \\times 20 + 0.2 \\times (-9)\n\\text{EV} = 16 + (-1.8) % 每个结果乘它的概率\n\\text{EV} = 14.2 % 相加' },
  ],
  ids: ['steps'],
  figure: (p) => formula_steps_figure(p),
});
