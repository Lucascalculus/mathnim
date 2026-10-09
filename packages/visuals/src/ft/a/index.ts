// Part A of the fine-tuning course (the map and RAG): its visuals.
import { register } from '../../registry';
import { contrastive_infonce } from './contrastive_infonce';
import { cost_crossover } from './cost_crossover';

export { cost_crossover, per_request, break_even } from './cost_crossover';
export { contrastive_infonce } from './contrastive_infonce';
export * as infonce from './infonce';

register(cost_crossover, contrastive_infonce);
