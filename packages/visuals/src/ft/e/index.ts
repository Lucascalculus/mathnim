// Part E of the fine-tuning course (reasoning: GRPO, the R1 recipe, pass@k,
// distillation). Registers the part's visuals.
import { register } from '../../registry';
import { grpo_group } from './grpo_group';

export { grpo_group } from './grpo_group';
export * as e_math from './math';

register(grpo_group);
