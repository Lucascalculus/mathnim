// The course-wide decision map (docs/lessons/llm-finetuning/part-f-choosing.md,
// section 1): node ids, bilingual labels, the lesson that unlocks each node,
// layout, edges, and the one-line "how to choose" card of every lesson.
// Other parts call the `decision_map` visual with these ids, so they are stable.

/** Lessons in course order (C may be taken after D; the map only needs an order). */
export const LESSONS = ['A1', 'A2', 'A2b', 'B1', 'B2', 'B3', 'B4', 'F0', 'C1', 'C2', 'C3', 'D1', 'D2a', 'D2b', 'D2', 'D3', 'D4', 'E1', 'E2', 'E3', 'F1'] as const;
// B3 was split into B3 (training dynamics and evaluation) and B4 (forgetting).
// D2 was split into D2a (policy gradient to PPO) and D2b (the KL-regularised optimum and RLHF); 'D2' is kept as an alias of D2b.
export type LessonId = (typeof LESSONS)[number];
export const lesson_index = (id: string): number => {
  const i = (LESSONS as readonly string[]).indexOf(id);
  return i < 0 ? LESSONS.length - 1 : i;
};

export interface MapNode {
  id: string;
  en: string;
  zh: string;
  /** The lesson that unlocks (first teaches) this node. */
  lesson: LessonId;
  x: number;
  y: number;
  w: number;
  /** Column it belongs to (for the vertical guide lines). */
  col?: 'K' | 'B' | 'C' | 'E';
}

const COLS = { K: -5.2, B: -1.73, C: 1.73, E: 5.2 } as const;
const W = 3.15;
const ROW = [1.02, 0.3, -0.42, -1.14, -1.86];

export const NODES: MapNode[] = [
  { id: '0', en: 'Evals first', zh: '先写评测', lesson: 'A1', x: -5.55, y: 3.45, w: 2.7 },
  { id: '1', en: 'Context baseline', zh: '上下文工程基线', lesson: 'A1', x: -2.35, y: 3.45, w: 3.1 },
  { id: 'T', en: 'Fixed labels?', zh: '输出是固定标签？', lesson: 'A1', x: 1.05, y: 3.45, w: 3.1 },
  { id: 'ENC', en: 'Encoder classifier', zh: '编码器分类模型', lesson: 'A1', x: 4.75, y: 3.45, w: 3.3 },
  { id: '2', en: 'Gap type?', zh: '差距是哪一类？', lesson: 'A1', x: 1.05, y: 2.5, w: 3.1 },
  // knowledge
  { id: 'K1', en: 'Fits in context?', zh: '整份放进上下文？', lesson: 'A2', x: COLS.K, y: ROW[0], w: W, col: 'K' },
  { id: 'K2', en: 'RAG', zh: 'RAG', lesson: 'A2', x: COLS.K, y: ROW[1], w: W, col: 'K' },
  { id: 'K3', en: 'Fix / tune retriever', zh: '修检索，调检索器', lesson: 'A2', x: COLS.K, y: ROW[2], w: W, col: 'K' },
  { id: 'K4', en: 'Assembly, then RAFT', zh: '改拼接，再 RAFT', lesson: 'A2', x: COLS.K, y: ROW[3], w: W, col: 'K' },
  { id: 'K5', en: 'Continued pretraining', zh: '继续预训练（闭卷）', lesson: 'B2', x: COLS.K, y: ROW[4], w: W, col: 'K' },
  // behaviour
  { id: 'B1', en: 'Structured output?', zh: '结构化输出够吗？', lesson: 'A1', x: COLS.B, y: ROW[0], w: W, col: 'B' },
  { id: 'B2', en: 'Demos: SFT + LoRA', zh: '示范：SFT + LoRA', lesson: 'B1', x: COLS.B, y: ROW[1], w: W, col: 'B' },
  { id: 'B3', en: 'Comparisons: DPO', zh: '比较：DPO', lesson: 'D1', x: COLS.B, y: ROW[2], w: W, col: 'B' },
  { id: 'R', en: 'Reward source', zh: '奖励信号从哪来', lesson: 'D1', x: COLS.B, y: ROW[3], w: W, col: 'B' },
  // capability
  { id: 'C3', en: 'Teacher: distill', zh: '有老师：蒸馏', lesson: 'B2', x: COLS.C, y: ROW[0], w: W, col: 'C' },
  { id: 'C1', en: 'pass@k > 0 ?', zh: 'pass@k > 0 ？', lesson: 'E1', x: COLS.C, y: ROW[1], w: W, col: 'C' },
  { id: 'C2', en: 'Verifier: RLVR / RFT', zh: '验证器：RLVR / RFT', lesson: 'E1', x: COLS.C, y: ROW[2], w: W, col: 'C' },
  { id: 'C4', en: 'Expert demos, rubric', zh: '专家示范或细则', lesson: 'D1', x: COLS.C, y: ROW[3], w: W, col: 'C' },
  // efficiency
  { id: 'E1', en: 'Do the cost math', zh: '先算成本账', lesson: 'A1', x: COLS.E, y: ROW[0], w: W, col: 'E' },
  { id: 'E2', en: 'Distill to small', zh: '蒸馏到小模型', lesson: 'E3', x: COLS.E, y: ROW[1], w: W, col: 'E' },
  { id: 'E3', en: 'Merge or multi-LoRA', zh: '合并或多适配器', lesson: 'C3', x: COLS.E, y: ROW[2], w: W, col: 'E' },
  // every weight-changing path
  { id: 'S', en: 'Data source', zh: '数据从哪来', lesson: 'B2', x: -4.6, y: -2.78, w: 2.9 },
  { id: 'X', en: 'Constraints X1-X4', zh: '约束：显存·平台·遗忘·合规', lesson: 'A1', x: -0.75, y: -2.78, w: 4.2 },
  { id: 'V', en: 'Verify', zh: '验收', lesson: 'A1', x: 2.75, y: -2.78, w: 2.2 },
];

/** Column headers (shown with the gap-type node). */
export const HEADERS: { col: 'K' | 'B' | 'C' | 'E'; en: string; zh: string }[] = [
  { col: 'K', en: 'K  knowledge', zh: 'K 知识' },
  { col: 'B', en: 'B  behaviour', zh: 'B 行为' },
  { col: 'C', en: 'C  capability', zh: 'C 能力' },
  { col: 'E', en: 'E  efficiency', zh: 'E 效率' },
];
export const COL_X = COLS;
export const HEADER_Y = 1.72;

/** Normalise a node id: 'DM-K2' and 'k2' both mean 'K2'. */
export function node_id(raw: string): string {
  const s = raw.trim().replace(/^DM-/i, '').toUpperCase();
  return s === 'ENCODER' ? 'ENC' : s;
}
/** Parse a list of ids given as an array or a comma/space separated string. */
export function node_list(raw: unknown): string[] {
  const parts = Array.isArray(raw) ? raw.map(String) : String(raw ?? '').split(/[\s,;]+/);
  const ids = new Set(NODES.map((n) => n.id).concat(['K', 'B', 'C', 'E']));
  return parts.map(node_id).filter((s) => s && ids.has(s));
}

/** One-line "how to choose" card of every lesson (the full card is on the lesson's last page). */
export const CARDS: Record<LessonId, { en: string; zh: string; nodes: string[] }> = {
  A1: { en: "Don't fine-tune by default: evals and a context baseline first; knowledge goes in context", zh: '默认不微调：先评测、跑上下文基线；知识放上下文，其余看信号', nodes: ['0', '1', 'T', '2'] },
  A2: { en: 'RAG wrong? Measure retrieval first: chunking, hybrid search, reranking, then tuning', zh: 'RAG 答错先测检索：切块、混合检索、重排，最后才微调', nodes: ['K1', 'K2', 'K3', 'K4'] },
  A2b: { en: 'In the top 100: tune the reranker; never retrieved: tune the embedder and re-index', zh: '在前 100 内就微调重排；进不了候选池才微调向量模型并重建索引', nodes: ['K3'] },
  B1: { en: "Demos, and prompting can't hold it: SFT with the exact inference template", zh: '能写示范、提示词稳不住：SFT，并用和线上一样的模板', nodes: ['B2'] },
  B2: { en: 'Data decides: a teacher means synthetic data plus filtering; a verifier, rejection sampling', zh: '数据定方案：有老师就合成加过滤，有验证器就拒绝采样', nodes: ['S', 'C3', 'K5'] },
  B3: { en: 'Evals before training; pick checkpoints by task and regression evals, not loss', zh: '先建评测再训练；选检查点看任务和回归评测，不看 loss', nodes: ['V'] },
  B4: { en: 'Changed weights? Rerun regression and safety evals; keep old skills with replay and a small LR', zh: '每次改权重都跑回归和安全评测；要保住旧能力，先用回放加小学习率', nodes: ['X', 'V'] },
  F0: { en: 'Midway: knowledge to context, demonstrations to SFT, fixed labels to an encoder', zh: '中场：知识放上下文，示范做 SFT，固定标签用编码器', nodes: ['T', 'K2', 'B2'] },
  C1: { en: 'Do the memory sum: about 16 bytes per parameter plus activations, else LoRA or QLoRA', zh: '先算显存账：约 16 字节/参数加激活值，不够就 LoRA、QLoRA', nodes: ['X'] },
  C2: { en: 'LoRA by default (all linear layers, about 10x the LR); full tuning for very large data', zh: '默认 LoRA（全部线性层，学习率约 10 倍）；数据极多才全量', nodes: ['B2', 'X'] },
  C3: { en: "One task: merge; many tenants: multi-LoRA serving; QLoRA doesn't cut inference cost", zh: '单任务合并，多租户用多适配器；QLoRA 不省推理成本', nodes: ['E3'] },
  D1: { en: 'Reward source: verifier, then rubric and judge, then a reward model; check its accuracy', zh: '奖励来源：验证器优先，其次评分细则加评委，最后奖励模型', nodes: ['R', 'B3', 'C4'] },
  D2a: { en: 'PPO is the bridge to understand; in practice use GRPO-family methods or DPO', zh: 'PPO 用来理解原理；实践中用 GRPO 类方法或 DPO', nodes: ['R'] },
  D2b: { en: 'Learned rewards get hacked: keep a KL leash and stop by a gold evaluation', zh: '学来的奖励会被钻空子：加 KL 约束，用真实评测决定何时停', nodes: ['R'] },
  D2: { en: 'Learned rewards get hacked: keep a KL leash and stop by a gold evaluation', zh: '学来的奖励会被钻空子：加 KL 约束，用真实评测决定何时停', nodes: ['R'] },
  D3: { en: 'Offline pairs: DPO; beta sets the distance to the reference; watch chosen log-probs', zh: '有离线偏好对就用 DPO；β 管离参考多远；盯住被选回答的概率', nodes: ['B3'] },
  D4: { en: 'DPO by default; the quality of the pairs matters more than the variant', zh: '默认 DPO；偏好对的质量比选哪个变体更重要', nodes: ['B3', 'S'] },
  E1: { en: 'Verifier and pass@k > 0: RLVR or managed RFT; audit the grader first', zh: '有验证器且 pass@k > 0：RLVR 或托管强化微调；先审评分器', nodes: ['C1', 'C2'] },
  E2: { en: 'Reasoning: SFT, RL, rejection-sampled SFT, RL; distill small models first', zh: '推理配方：SFT、RL、拒绝采样 SFT、RL；小模型先蒸馏', nodes: ['C2', 'C3'] },
  E3: { en: 'Smaller and cheaper: sequence-level, then on-policy distillation; merge same-base only', zh: '更小更便宜：先序列级、再在线蒸馏；合并只限同一基座', nodes: ['E2', 'C3', 'E3'] },
  F1: { en: 'Evals first, weights last; classify the gap; the signal picks the method', zh: '评测先行，最后才改权重；先分清差距，再由信号定方法', nodes: ['0', '2', 'V'] },
};
