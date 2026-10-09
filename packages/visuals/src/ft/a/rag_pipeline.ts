// Retrieval-augmented generation as two pipelines: indexing (offline, once:
// cut documents into chunks, embed them, store the vectors) and query time
// (every question: retrieve the nearest chunks, rerank, assemble the prompt,
// generate an answer that cites its sources). Under each stage: the knob you
// tune there. Optionally one stage is highlighted, or marked with one of the
// seven RAG failure points (Barnett et al. 2024). Illustrative (a diagram).
import { Arrow, Circle, Create, Dot, FadeIn, FadeOut, Indicate, Rectangle, Scene, Transform, VGroup, smooth } from 'manim-web';
import { palette } from '../../theme';
import { define_visual } from '../../visual';
import { box, fit, group, label, LANG_SPEC, pick, resolve_lang, type Lang } from '../f/kit';

export interface RagPipelineParams extends Record<string, unknown> {
  k: number;
  rerank: boolean;
  highlight: string;
  failure: string;
  lang: string;
}

type Stage = { id: string; en: string; zh: string; knob_en: string; knob_zh: string; x: number; y: number };
const IY = 2.05, QY = -1.35, W = 2.3, H = 0.72;
export const RAG_STAGES: Stage[] = [
  { id: 'docs', en: 'Documents', zh: '文档', knob_en: 'what is in the corpus', knob_zh: '语料里有什么', x: -5.55, y: IY },
  { id: 'chunk', en: 'Chunk', zh: '切块', knob_en: 'size, overlap', knob_zh: '块大小、重叠', x: -2.75, y: IY },
  { id: 'embed', en: 'Embed', zh: '向量化', knob_en: 'embedding model', knob_zh: '向量模型', x: 0.05, y: IY },
  { id: 'index', en: 'Vector index', zh: '向量索引', knob_en: 'ANN settings', knob_zh: '近似检索设置', x: 2.85, y: IY },
  { id: 'query', en: 'Question', zh: '问题', knob_en: 'query rewriting', knob_zh: '查询改写', x: -5.55, y: QY },
  { id: 'retrieve', en: 'Retrieve', zh: '检索', knob_en: 'k, hybrid search', knob_zh: 'k、混合检索', x: -2.75, y: QY },
  { id: 'rerank', en: 'Rerank', zh: '重排', knob_en: 'candidates kept', knob_zh: '保留几个候选', x: 0.05, y: QY },
  { id: 'assemble', en: 'Assemble prompt', zh: '拼提示', knob_en: 'order, citations, budget', knob_zh: '顺序、引用、预算', x: 2.85, y: QY },
  { id: 'generate', en: 'Generate', zh: '生成', knob_en: 'model, instructions', knob_zh: '模型、指令', x: 5.65, y: QY },
];
/** Where each failure point of Barnett et al. (2024) happens. */
export const FAILURE_STAGE: Record<string, string> = { FP1: 'docs', FP2: 'retrieve', FP3: 'assemble', FP4: 'generate', FP5: 'generate', FP6: 'generate', FP7: 'generate' };
const FAILURE_NAME: Record<string, [string, string]> = {
  FP1: ['missing content', '缺内容'], FP2: ['missed the top-k', '没排进前 k'], FP3: ['dropped when assembling', '拼接时被丢掉'],
  FP4: ['not extracted', '没提取出来'], FP5: ['wrong format', '格式不对'], FP6: ['wrong specificity', '详略不当'], FP7: ['incomplete', '答得不全'],
};

export const rag_pipeline = define_visual<RagPipelineParams>({
  name: 'rag_pipeline',
  summary: 'RAG as two pipelines: indexing (documents -> chunks -> embeddings -> vector index, once) and query time (question -> retrieve top-k -> rerank -> assemble prompt with numbered sources -> answer with citations); the knob of each stage is written under it. Can highlight a stage or mark a failure point FP1-FP7 (Barnett et al. 2024). Illustrative diagram, no handles.',
  topics: ['rag', 'retrieval', 'embeddings', 'reranking', 'llm', 'fine-tuning'],
  params: {
    k: { type: 'integer', min: 2, max: 6, default: 4, doc: 'how many chunks are retrieved (drawn)' },
    rerank: { type: 'boolean', default: true, doc: 'show the reranking stage reordering the candidates' },
    highlight: { type: 'enum', values: ['', ...RAG_STAGES.map((s) => s.id)], default: '', doc: 'stage to highlight at the end' },
    failure: { type: 'enum', values: ['', 'FP1', 'FP2', 'FP3', 'FP4', 'FP5', 'FP6', 'FP7'], default: '', doc: 'mark a failure point (Barnett et al. 2024) on its stage' },
    lang: LANG_SPEC,
  },
  examples: [{}, { lang: 'zh' }, { failure: 'FP2', lang: 'zh', k: 3 }, { highlight: 'chunk', rerank: false, k: 6 }, { failure: 'FP4' }],
  ids: ['indexing', 'query_time', 'knobs', 'answer'],
  scene: (p) => {
    const lang: Lang = resolve_lang(p.lang);
    const L = (en: string, zh: string) => pick(lang, en, zh);
    class RagPipeline extends Scene {
      override construct() {
        const c = palette();
        const by = new Map(RAG_STAGES.map((s) => [s.id, s]));
        const S = (id: string) => by.get(id)!;
        const stage_box = (s: Stage) => group(box(s.x, s.y, W, H, { stroke: c.muted, width: 2.5 }), fit(label(L(s.en, s.zh), 26, c.ink), W - 0.25).move_to([s.x, s.y, 0]));
        const knob = (s: Stage) => fit(label(L(s.knob_en, s.knob_zh), 22, c.muted), W + 0.3).move_to([s.x, s.y - H / 2 - 0.3, 0]);
        const link = (a: Stage, b: Stage) => Arrow([a.x + W / 2, a.y, 0], [b.x - W / 2, b.y, 0], { color: c.muted, stroke_width: 3, buff: 0.05, tip_length: 0.16, max_tip_length_to_length_ratio: 0.4 } as any);
        const idx = ['docs', 'chunk', 'embed', 'index'].map(S), qt = ['query', 'retrieve', 'rerank', 'assemble', 'generate'].map(S);
        const index_boxes = group(...idx.map(stage_box)), query_boxes = group(...qt.map(stage_box));
        const index_links = group(...idx.slice(1).map((s, i) => link(idx[i], s)));
        const query_links = group(...qt.slice(1).map((s, i) => link(qt[i], s)));
        const down = Arrow([S('index').x, IY - H / 2, 0], [S('retrieve').x + 0.6, QY + H / 2, 0], { color: c.accent, stroke_width: 3, buff: 0.08, tip_length: 0.18 } as any);
        const t_index = label(L('Indexing: offline, once for the corpus', '索引期：离线，整份语料做一次'), 26, c.ink, { weight: 'BOLD' }).move_to([0, 3.45, 0]).align_to([-6.75, 0, 0], [-1, 0, 0]);
        const t_query = label(L('Query time: every question', '查询期：每个问题都走一遍'), 26, c.ink, { weight: 'BOLD' }).move_to([0, -0.2, 0]).align_to([-6.75, 0, 0], [-1, 0, 0]);
        const knobs = group(...[...idx, ...qt].map(knob));
        knobs.name = 'knobs';
        const indexing = group(t_index, index_boxes, index_links);
        indexing.name = 'indexing';
        const query_time = group(t_query, query_boxes, query_links, down);
        query_time.name = 'query_time';

        // ---- indexing: a document is cut into chunks, chunks become points
        this.play(FadeIn(t_index), FadeIn(index_boxes.submobjects[0]), { run_time: 1 });
        const doc = S('docs');
        const page = group(...[0, 1, 2, 3].map((i) => Rectangle({ width: 1.1, height: 0.08, stroke_width: 0, fill_color: c.muted, fill_opacity: 0.6 }).move_to([doc.x, doc.y + 0.82 - i * 0.16, 0])));
        this.play(FadeIn(page), { run_time: 0.6 });
        this.play(Create(index_links.submobjects[0]), FadeIn(index_boxes.submobjects[1]), { run_time: 0.8 });
        const ch = S('chunk');
        const pieces = group(...[0, 1, 2, 3].map((i) => Rectangle({ width: 0.42, height: 0.22, stroke_color: c.accent, stroke_width: 2, fill_color: c.accent, fill_opacity: 0.2 }).move_to([ch.x - 0.75 + i * 0.5, ch.y + 0.82, 0])));
        this.play(Transform(page, pieces), { run_time: 1.1 });
        this.play(Create(index_links.submobjects[1]), FadeIn(index_boxes.submobjects[2]), Create(index_links.submobjects[2]), FadeIn(index_boxes.submobjects[3]), { run_time: 1 });
        // the stored vectors: a little cloud above the index box
        const ix = S('index');
        const cloud_pts = [[-0.7, 0.25], [-0.45, 0.6], [-0.1, 0.35], [0.2, 0.7], [0.45, 0.3], [0.7, 0.55], [-0.25, 0.85], [0.05, 0.95]];
        const cloud = group(...cloud_pts.map(([dx, dy]) => Dot([ix.x + dx, ix.y + H / 2 + 0.1 + dy * 0.6, 0], { radius: 0.06, color: c.accent })));
        this.play(Transform(page, cloud), { run_time: 1.1 });
        this.play(...knobs.submobjects.slice(0, 4).map((m: any) => FadeIn(m)), { run_time: 0.8 });

        // ---- query time
        this.play(FadeIn(t_query), FadeIn(query_boxes.submobjects[0]), Create(down), { run_time: 1 });
        const qdot = Dot([ix.x + 0.1, ix.y + H / 2 + 0.1 + 0.55 * 0.6, 0], { radius: 0.08, color: c.gold });
        const nearest = cloud_pts.map(([dx, dy], i) => [Math.hypot(dx - 0.1, dy - 0.55), i]).sort((a, b) => a[0] - b[0]).slice(0, p.k).map(([, i]) => i);
        const rings = group(...nearest.map((i) => Circle({ radius: 0.12, color: c.gold, stroke_width: 3 }).move_to(cloud.submobjects[i].get_center())));
        this.play(Create(query_links.submobjects[0]), FadeIn(query_boxes.submobjects[1]), FadeIn(qdot, { scale: 2 }), { run_time: 0.9 });
        this.play(Create(rings), { run_time: 0.8 });
        // the retrieved chunks as cards under the retrieve box
        const rt = S('retrieve');
        const card = (n: number, x: number, y: number) => group(box(x, y, 0.62, 0.32, { stroke: c.gold, width: 2, fill: c.gold, fill_opacity: 0.12, radius: 0.06 }), label(`#${n}`, 22, c.ink).move_to([x, y, 0]));
        const cards = nearest.map((_, i) => card(i + 1, rt.x - 0.75 + (i % 3) * 0.75, QY - 1.25 - Math.floor(i / 3) * 0.42));
        this.play(FadeIn(group(...cards)), { run_time: 0.7 });
        this.play(Create(query_links.submobjects[1]), FadeIn(query_boxes.submobjects[2]), { run_time: 0.7 });
        const rr = S('rerank');
        const kept = Math.min(3, cards.length);
        const order = p.rerank ? [...Array(kept).keys()].reverse() : [...Array(kept).keys()];
        const moved = order.map((ci, slot) => card(ci + 1, rr.x - 0.75 + slot * 0.75, QY - 1.25));
        this.play(...cards.slice(0, kept).map((m, i) => Transform(m, moved[order.indexOf(i)])), ...cards.slice(kept).map((m) => FadeOut(m)), { run_time: 1.1, rate_func: smooth });
        this.play(Create(query_links.submobjects[2]), FadeIn(query_boxes.submobjects[3]), Create(query_links.submobjects[3]), FadeIn(query_boxes.submobjects[4]), { run_time: 1 });
        const g = S('generate');
        const answer = fit(label(L('“... about 1,800 km/h [2]”', '“……每小时 1,800 公里 [2]”'), 24, c.ink), 2.6).move_to([g.x, QY - 1.25, 0]);
        answer.name = 'answer';
        this.play(FadeIn(answer, { shift: [0, -0.15, 0] }), ...knobs.submobjects.slice(4).map((m: any) => FadeIn(m)), { run_time: 1 });
        this.add(indexing, query_time, knobs);

        // ---- optional: one stage highlighted, or a failure point marked on its stage
        const mark = p.failure ? FAILURE_STAGE[p.failure] : p.highlight;
        if (mark) {
          const s = S(mark);
          const color = p.failure ? c.coral : c.accent;
          const ring = box(s.x, s.y, W + 0.16, H + 0.16, { stroke: color, width: 5, fill_opacity: 0, radius: 0.16 });
          this.play(Create(ring), { run_time: 0.8 });
          if (p.failure) {
            const [en, zh] = FAILURE_NAME[p.failure];
            const tag = group(box(s.x, s.y + H / 2 + 0.36, 2.5, 0.42, { stroke: color, width: 2, fill: color, fill_opacity: 0.12, radius: 0.08 }), fit(label(`${p.failure}  ${L(en, zh)}`, 22, color), 2.35).move_to([s.x, s.y + H / 2 + 0.36, 0]));
            this.play(FadeIn(tag), Indicate(ring, { color }), { run_time: 1 });
          }
        }
        this.wait(1.5);
      }
    }
    return new RagPipeline();
  },
});
