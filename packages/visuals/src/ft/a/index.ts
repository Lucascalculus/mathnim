// Part A of the fine-tuning course (the map and RAG): its visuals.
import { register } from '../../registry';
import { contrastive_infonce } from './contrastive_infonce';
import { cost_crossover } from './cost_crossover';
import { rag_pipeline } from './rag_pipeline';
import { chunk_size_recall } from './chunk_size_recall';

export { cost_crossover, per_request, break_even } from './cost_crossover';
export { contrastive_infonce } from './contrastive_infonce';
export { rag_pipeline, RAG_STAGES, FAILURE_STAGE } from './rag_pipeline';
export { chunk_size_recall, SIZES, BUDGETS, OVERLAPS, best_rank, best_sizes, hits as chunk_hits, status as chunk_status, type Status as ChunkStatus } from './chunk_size_recall';
export { CHUNK_DATA, CHUNK_META } from './data/chunk_recall';
export * as infonce from './infonce';

register(cost_crossover, contrastive_infonce, rag_pipeline, chunk_size_recall);
