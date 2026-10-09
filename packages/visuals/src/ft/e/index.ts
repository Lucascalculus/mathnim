// Part E of the fine-tuning course (reasoning: GRPO, the R1 recipe, pass@k,
// distillation). Registers the part's visuals.
import { register } from '../../registry';
import { grpo_group } from './grpo_group';
import { pass_k_sharpen } from './pass_k_sharpen';
import { forward_reverse_kl } from './forward_reverse_kl';
import { r1_pipeline } from './r1_pipeline';
import { e_figure } from './e_figure';

export { grpo_group } from './grpo_group';
export { pass_k_sharpen } from './pass_k_sharpen';
export { forward_reverse_kl } from './forward_reverse_kl';
export { r1_pipeline } from './r1_pipeline';
export { e_figure } from './e_figure';
export * as e_math from './math';

register(grpo_group, pass_k_sharpen, forward_reverse_kl, r1_pipeline, e_figure);
