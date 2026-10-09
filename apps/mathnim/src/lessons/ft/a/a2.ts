// A2 "RAG: put the knowledge into the context" (RAG：把知识放进上下文).
// Plan: docs/lessons/llm-finetuning/part-a-map-rag.md (A2; the retriever
// fine-tuning half is the optional lesson A2b). Why RAG, the pipeline, how
// retrieval finds chunks (vectors, keywords, fusion), chunk size under a
// budget (one world on real retrieval runs), reranking and prompt assembly,
// measuring retrieval, and where RAG fails.
import type { Lesson } from '@mathnim/core';
import { best_sizes, chunk_status, SIZES } from '@mathnim/visuals/ft/a';
import { card_page, case_group, figure, hold, map_scene, T, vis, watch } from '../f/kit';

const CHUNK = { size: '512', budget: '512', overlap: '0', question: 2, show_budget: false };
const BUDGET = 512;

export const lesson: Lesson = {
  id: 'ft-a2',
  title: T('RAG: put the knowledge into the context', 'RAG：把知识放进上下文'),
  description: T(
    'How retrieval-augmented generation finds the right text for a question, how to tell whether retrieval works, and where it fails.',
    '检索增强生成怎样为一个问题找到合适的文字，怎样判断检索好不好，以及它会在哪里出错。',
  ),
  mode: 'essay',
  skills: [
    { id: 'a2-pipeline', name: T('The RAG pipeline', 'RAG 的流程') },
    { id: 'a2-similarity', name: T('Embeddings, keywords and fusion', '向量、关键词与融合'), prerequisites: ['a2-pipeline'] },
    { id: 'a2-chunking', name: T('Chunk size under a budget', '预算之下的块大小'), prerequisites: ['a2-similarity'] },
    { id: 'a2-retrieval-eval', name: T('Measuring retrieval', '评测检索'), prerequisites: ['a2-pipeline'] },
    { id: 'a2-failure-diagnosis', name: T('Where RAG fails', 'RAG 在哪里失败'), prerequisites: ['a2-retrieval-eval'] },
  ],
  misconceptions: [
    { id: 'rag-is-vector-db', description: T('RAG means putting the documents into a vector database.', 'RAG 就是把文档丢进向量数据库。') },
    { id: 'similar-means-relevant', description: T('The chunk most similar to the question always holds the answer.', '和问题最相似的块，一定含有答案。') },
    { id: 'chunk-bigger-better', description: T('Bigger chunks are always better: they hold more.', '块越大越好，装得多。') },
    { id: 'chunk-smaller-better', description: T('Smaller chunks are always better: they are more precise.', '块越小越好，更精确。') },
    { id: 'fix-generator-first', description: T('When RAG answers wrongly, change or fine-tune the generator.', 'RAG 答错了，就换掉或微调生成模型。') },
    { id: 'long-context-kills-rag', description: T('With long context windows, retrieval is no longer needed.', '上下文窗口够长，就不需要检索了。') },
  ],
  steps: [
    // ---------------------------------------------------------------- 1. why RAG
    {
      id: 'why', kind: 'read', chapter: T('Why RAG', '为什么要 RAG'), title: T('The model does not know your documents', '模型不知道你的文档'),
      blocks: [
        { type: 'p', text: T(
          'A model knows what was in its training data. Your price list, your policies and last week\'s changes were not there - and they will change again. A1 showed that teaching such facts by fine-tuning is slow and makes the model invent things.',
          '模型知道的，是它训练数据里有的东西。你的价目表、内部规定、上周的改动都不在里面，而且还会再变。A1 讲过：靠微调教这类事实，学得慢，还会让模型更爱编造。',
        ) },
        { type: 'p', text: T(
          '**Retrieval-augmented generation** (RAG) does something simpler: at question time, find the few passages that answer the question and put them into the prompt[^lewis]. The model then reads rather than remembers - so the answer can cite its source, follows the latest version of a document, and respects who may see what.',
          '**检索增强生成**（retrieval-augmented generation, RAG）的做法更直接：提问时，找出能回答这个问题的几段文字，放进提示里[^lewis]。模型是在"读"，而不是在"回忆"。所以回答能附出处，能跟着文档的最新版本走，也能按权限决定谁看到什么。',
        ) },
        { type: 'callout', kind: 'note', title: T('Why not paste everything in?', '为什么不把所有文档都塞进去？'), body: T(
          'Sometimes you should. If the whole knowledge base is under about 200,000 tokens, put all of it in the prompt and use prompt caching[^anthropic]. With more text, long context costs much more per question than retrieval, and models use information in the middle of a long context less well[^li][^liu]. RAG is how you pick the few pages that matter.',
          '有时候确实应该这么做。整个知识库不到约 20 万 token 时，直接全部放进提示，再配合提示缓存[^anthropic]。文字一多，长上下文每个问题的成本比检索高得多，而且模型对长上下文中间部分的利用也更差[^li][^liu]。RAG 的作用，就是挑出真正相关的那几页。',
        ) },
        { type: 'cite', key: 'lewis', text: T('Lewis et al., Retrieval-Augmented Generation for Knowledge-Intensive NLP Tasks, NeurIPS 2020', '出处：Lewis et al., Retrieval-Augmented Generation for Knowledge-Intensive NLP Tasks, NeurIPS 2020'), url: 'https://arxiv.org/abs/2005.11401' },
        { type: 'cite', key: 'anthropic', text: T('Anthropic, Introducing Contextual Retrieval (2024)', '出处：Anthropic, Introducing Contextual Retrieval (2024)'), url: 'https://www.anthropic.com/news/contextual-retrieval' },
        { type: 'cite', key: 'li', text: T('Li et al., Retrieval Augmented Generation or Long-Context LLMs? EMNLP 2024', '出处：Li et al., Retrieval Augmented Generation or Long-Context LLMs? EMNLP 2024'), url: 'https://arxiv.org/abs/2407.16833' },
        { type: 'cite', key: 'liu', text: T('Liu et al., Lost in the Middle, TACL', '出处：Liu et al., Lost in the Middle, TACL'), url: 'https://arxiv.org/abs/2307.03172' },
      ],
    },
    {
      id: 'pipeline', kind: 'scene', title: T('Two pipelines', '两条流水线'), scene: vis('rag_pipeline', {}),
      narration: T(
        'RAG is two pipelines. Once, offline: cut the documents into chunks, turn every chunk into a vector, and store the vectors in an index. Then, for every question: turn the question into a vector, fetch the nearest chunks, let a reranker reorder the best few, number them in the prompt, and ask the model to answer with citations. Under each stage is the knob you tune there.',
        'RAG 是两条流水线。一条是离线的，只做一次：把文档切成块，把每一块变成一个向量，存进索引。另一条是每个问题都要走的：把问题变成向量，取回离它最近的块，用重排模型把最好的几块重新排序，编好号放进提示，让模型带着引用作答。每个环节下面写着这一步可以调的东西。',
      ),
    },
    // ---------------------------------------------------------------- 2. how retrieval finds chunks
    {
      id: 'similarity', kind: 'read', chapter: T('Finding the right chunks', '怎么找到对的块'), title: T('Meaning as a direction', '把意思变成方向'),
      blocks: [
        { type: 'p', text: T(
          'An **embedding model** turns a piece of text into a vector, trained so that texts with similar meaning point in similar directions. Retrieval then just asks: which chunk vectors point closest to the question\'s? The measure is the angle, through its cosine:',
          '**向量模型**（embedding model）把一段文字变成一个向量；它被训练成：意思相近的文字，向量方向也相近。于是检索只需要问：哪些块的向量，和问题的向量方向最接近？衡量的是夹角，用它的余弦：',
        ) },
        { type: 'math', tex: '\\cos(q, d) = \\frac{q \\cdot d}{\\|q\\|\\,\\|d\\|}' },
        { type: 'p', text: T(
          'Divide by the lengths and only the direction counts. In practice every vector is normalised to length 1 once, at indexing, and the cosine becomes a plain dot product - which vector indexes compute very fast[^hnsw]. The chunk vectors are computed once; each question costs one encoder pass and a search. That is why this kind of model (a *bi-encoder*) can search millions of chunks[^sbert].',
          '除以长度后，只剩方向起作用。实践中，在建索引时就把每个向量归一化成长度 1，余弦就变成普通的点积，向量索引算点积非常快[^hnsw]。块的向量只算一次；每个问题只需编码一次再检索一次。所以这类模型（*双编码器*）能在上百万个块里检索[^sbert]。',
        ) },
        { type: 'details', summary: T('Details: query and passage prefixes, approximate search', '细节：查询与段落前缀、近似检索'), blocks: [
          { type: 'p', text: T('Some embedding models are trained with different prefixes for questions and passages - multilingual-e5 expects `query: ` and `passage: `, and loses accuracy without them[^e5]. Read the model card. Vector indexes such as HNSW search approximately: a little recall is traded for a lot of speed, tuned by a setting such as `ef_search`[^hnsw].', '有些向量模型训练时，问题和段落用的前缀不同：multilingual-e5 要求加 `query: ` 和 `passage: `，不加会掉精度[^e5]。用之前先看模型卡。HNSW 这类向量索引做的是近似检索：牺牲一点召回，换来很大的速度提升，可以用 `ef_search` 这类参数调节[^hnsw]。') },
        ] },
        { type: 'cite', key: 'sbert', text: T('Reimers & Gurevych, Sentence-BERT, EMNLP 2019', '出处：Reimers & Gurevych, Sentence-BERT, EMNLP 2019'), url: 'https://arxiv.org/abs/1908.10084' },
        { type: 'cite', key: 'hnsw', text: T('Malkov & Yashunin, HNSW (2016)', '出处：Malkov & Yashunin, HNSW (2016)'), url: 'https://arxiv.org/abs/1603.09320' },
        { type: 'cite', key: 'e5', text: T('multilingual-e5-small model card', '出处：multilingual-e5-small model card'), url: 'https://huggingface.co/intfloat/multilingual-e5-small' },
      ],
    },
    {
      id: 'hybrid', kind: 'read', title: T('Words still matter: hybrid search', '字面也重要：混合检索'),
      blocks: [
        { type: 'p', text: T(
          '**Why not just search for the words?** Because people ask with other words than the documents use. In our test corpus (16 Wikipedia articles), "How wide is Venus?" found the right chunk first by meaning, but only 10th by keywords (BM25): the article says "diameter", not "wide".',
          '**为什么不直接按关键词搜？** 因为提问的人和写文档的人用词不同。在本课的测试语料（16 篇维基百科条目）里，"How wide is Venus?"（金星有多宽）按意思检索，正确的块排第 1；按关键词检索（BM25）只排第 10，因为文章里写的是"diameter"（直径），不是"wide"。',
        ) },
        { type: 'p', text: T(
          '**Then why not vectors alone?** Because exact strings matter too: an error code, a product number or a rare name carries little "meaning" for an embedding, while keyword search finds it exactly. Keyword search is also a robust baseline across domains[^beir]. So production systems usually run both and merge the two ranked lists. The simplest merge, **reciprocal rank fusion**, only looks at ranks:',
          '**那为什么不只用向量？** 因为精确的字符串也重要：一个错误码、一个产品编号、一个生僻的名字，对向量模型来说没什么"意思"，关键词检索却能精确命中。在各种领域里，关键词检索也是一个稳健的基线[^beir]。所以线上系统通常两种都跑，再把两份排名合并。最简单的合并方法叫**倒数排名融合**（RRF），只看名次：',
        ) },
        { type: 'math', tex: '\\mathrm{RRF}(d) = \\sum_{r} \\frac{1}{60 + \\mathrm{rank}_r(d)}' },
        { type: 'p', text: T(
          'Here $r$ runs over the retrievers (keyword, vector) and $\\mathrm{rank}_r(d)$ is the chunk\'s place in retriever $r$\'s list. A chunk near the top of either list gets a large share; the 60 keeps one first place from dominating. It needs no score calibration - BM25 scores are unbounded, cosines lie in [−1, 1], and RRF never compares them[^rrf].',
          '其中 $r$ 取遍各个检索器（关键词、向量），$\\mathrm{rank}_r(d)$ 是这个块在检索器 $r$ 名单里的名次。在任一份名单里排得靠前的块，都能拿到较大的分数；常数 60 让单个第一名不至于压倒一切。它不需要校准分数：BM25 的分数没有上限，余弦在 [−1, 1] 之间，而 RRF 根本不比较它们[^rrf]。',
        ) },
        { type: 'cite', key: 'beir', text: T('Thakur et al., BEIR, NeurIPS 2021 Datasets & Benchmarks', '出处：Thakur et al., BEIR, NeurIPS 2021 Datasets & Benchmarks'), url: 'https://arxiv.org/abs/2104.08663' },
        { type: 'cite', key: 'rrf', text: T('Cormack, Clarke & Büttcher, Reciprocal rank fusion, SIGIR 2009', '出处：Cormack, Clarke & Büttcher, Reciprocal rank fusion, SIGIR 2009'), url: 'https://plg.uwaterloo.ca/~gvcormac/cormacksigir09-rrf.pdf' },
      ],
    },
    {
      id: 'hybrid-q', kind: 'checkpoint', skill: 'a2-similarity', purpose: 'practice', title: T('Which search finds it?', '哪种检索能找到？'),
      prompt: T('A user asks "What does error E-4012 mean?". The manual has a table with the line "E-4012: VPN certificate expired". Which retrieval is most likely to put that line first?', '用户问："E-4012 报错是什么意思？"手册里有一张表，其中一行是"E-4012：VPN 证书过期"。哪种检索最可能把这一行排在第一？'),
      question: { type: 'choice', options: [
        { id: 'kw', label: T('keyword search (BM25) - or hybrid search', '关键词检索（BM25），或者混合检索'), correct: true },
        { id: 'dense', label: T('vector search alone', '只用向量检索'), misconception: 'rag-is-vector-db', feedback: T('An error code has little "meaning" for an embedding; an exact string match is what finds it.', '错误码对向量模型来说没什么"意思"，找到它靠的是字面精确匹配。') },
        { id: 'either', label: T('both equally', '两者一样'), feedback: T('Exact identifiers are where keyword search has the edge.', '精确的编号，正是关键词检索占优的地方。') },
      ] },
      explain: T('And for "how do I keep my kid off the phone?" against a page titled "managing children\'s screen time", the opposite holds: no shared words, same meaning.', '反过来，问"怎么让孩子少玩手机"，而文档标题是"儿童屏幕时间管理"，两者没有共同的词，意思却一样：这时向量检索占优。'),
    },
    // ---------------------------------------------------------------- 3. chunk size
    {
      id: 'chunks', kind: 'read', chapter: T('How big a chunk?', '块切多大'), title: T('Chunks compete for a fixed budget', '块要争一份固定的预算'),
      blocks: [
        { type: 'p', text: T(
          'Before anything is embedded, documents are cut into **chunks**. Their size matters because the prompt has a budget: if retrieved text may take $B$ tokens and each chunk has $s$ tokens, only $k = \\lfloor B / s \\rfloor$ chunks fit.',
          '在向量化之前，文档要先切成**文本块**（chunk）。块的大小很要紧，因为提示有预算：如果检索结果最多占 $B$ 个 token，每块 $s$ 个 token，就只放得下 $k = \\lfloor B / s \\rfloor$ 块。',
        ) },
        { type: 'p', text: T(
          'A question is answered only if a chunk that contains its **whole answer sentence** is among those $k$. Two things can go wrong, in opposite directions: a boundary can cut the answer sentence apart; or the chunk holding it can rank below $k$.',
          '只有当某个完整包含**答案句**的块落在这 $k$ 块之中，问题才算答到。可能出错的地方有两个，方向相反：块的边界可能把答案句切断；也可能含答案的块排在第 $k$ 名之后。',
        ) },
        { type: 'p', text: T(
          'Next: real retrieval runs on 16 Wikipedia articles about planets and similar bodies, with 12 questions and a budget of 512 tokens. Guess first.',
          '接下来是真实的检索结果：16 篇关于行星和类似天体的维基百科条目，12 个问题，预算 512 token。先猜一猜。',
        ) },
      ],
    },
    {
      id: 'chunk-predict', kind: 'checkpoint', skill: 'a2-chunking', purpose: 'predict', title: T('Your bet', '你的判断'),
      prompt: T('Budget 512 tokens. Which chunk size answers the most of the 12 questions?', '预算 512 token。哪个块大小能答到 12 个问题里最多的？'),
      question: { type: 'choice', options: [
        { id: '64', label: T('64 tokens: small and precise, 8 of them fit', '64 token：小而精确，能放 8 块'), misconception: 'chunk-smaller-better' },
        { id: 'mid', label: T('128 or 256 tokens', '128 或 256 token'), correct: true },
        { id: '512', label: T('512 tokens: one big chunk', '512 token：一整块') },
        { id: '1024', label: T('1024 tokens: holds the most text', '1024 token：装的字最多'), misconception: 'chunk-bigger-better' },
      ] },
    },
    {
      id: 'chunk-world', kind: 'explore', title: T('Cut, retrieve, count', '切块、检索、数一数'), skill: 'a2-chunking',
      scene: vis('chunk_size_recall', CHUNK),
      prompt: T(
        'Drag the chunk size and watch the cells: green = answered. Press **Use this chunk size** on the size that answers the most. Then set the size to 64, turn the overlap up, and move the selector to a question the overlap rescued.',
        '拖动块大小，看下面的格子：绿色表示答到了。在答到最多的块大小上按**就用这个块大小**。然后把块大小设为 64，把块重叠调上去，再把选择器移到一个被重叠"救回来"的问题上。',
      ),
      setup: (scene: any, ui, _ctx, world) => {
        hold('chunk_size_recall', CHUNK)(scene, ui, _ctx, world);
        let last_q = scene.q(), last_ov = scene.overlap(), last_size = scene.size();
        watch(scene, () => {
          const q = scene.q(), ov = scene.overlap(), size = scene.size();
          if (ov !== last_ov && ov > 0 && size === 64) world.emit('overlap_on');
          if (q !== last_q && size === 64 && ov > 0) {
            world.state.picked = true;
            world.emit('picked', { q });
          }
          if (size !== last_size) world.emit('size', { size });
          last_q = q;
          last_ov = ov;
          last_size = size;
        });
      },
      actions: [{
        id: 'lock', label: T('Use this chunk size', '就用这个块大小'), primary: true,
        run: (scene: any, _ctx, world) => {
          const size = scene.lock(), ov = scene.overlap();
          const best = best_sizes(scene.lang, BUDGET, 0);
          const ok = ov === 0 && best.includes(size);
          if (ok) world.state.best = true;
          const largest = size === SIZES[SIZES.length - 1] || size === 512, smallest = size === 64;
          world.emit('locked', { size, ok, ov, largest, smallest });
          if (!ok && ov > 0) world.emit('locked_with_overlap');
          else if (!ok && !largest && !smallest) world.emit('locked_close');
        },
      }],
      goals: [
        { id: 'best', check: (_s, _c, w) => !!w.state.best, message: T('The most questions are answered in the middle: small enough to rank well, big enough to keep sentences whole.', '答到最多的块大小在中间：小到能排得靠前，又大到能保住整句。') },
        {
          id: 'rescue', message: T('Overlap re-joined a sentence the boundary had cut.', '重叠把被边界切断的句子重新接上了。'),
          check: (s: any, _c, w) => {
            if (!w.state.picked || s.size() !== 64 || s.overlap() === 0) return false;
            const q = s.q();
            return chunk_status(s.lang, 64, BUDGET, 0, q) === 'split' && chunk_status(s.lang, 64, BUDGET, s.overlap(), q) === 'hit';
          },
        },
      ],
      detectors: [
        { id: 'big', on: (e) => (e.type === 'locked' && !e.data?.ok && e.data?.largest ? { kind: 'misconception', id: 'chunk-bigger-better', message: T('Big chunks: few fit, and they rank worse.', '大块：放得下的少，排名也差。') } : null) },
        { id: 'small', on: (e) => (e.type === 'locked' && !e.data?.ok && e.data?.smallest ? { kind: 'misconception', id: 'chunk-smaller-better', message: T('Small chunks cut answer sentences apart.', '小块会把答案句切断。') } : null) },
      ],
      lines: [
        { text: T('At the top is one article and its chunks; the blue ones made it into the prompt. Each cell below is one question.', '上面是一篇条目和它的切块，蓝色的块进了提示。下面每一格是一个问题。'), when: 'enter' },
        { text: T('Drag the chunk size and watch which cells turn green.', '拖动块大小，看哪些格子变绿。'), when: 'idle' },
        { text: T('A chunk of 512 tokens or more leaves room for only one chunk, or none, and a long chunk ranks worse: its vector mixes many topics.', '512 token 以上的块，只放得下一块，甚至一块都放不下；块越长，向量里混进的话题越多，排名也越差。'), when: { finding: 'chunk-bigger-better' } },
        { text: T('Eight small chunks fit, but look at the crosses: the boundaries cut the answer sentences apart.', '能放下八个小块，但看那些叉号：块的边界把答案句切断了。'), when: { finding: 'chunk-smaller-better' } },
        { text: T('For the first task, set the overlap back to zero: we compare chunk sizes alone.', '第一个任务先把块重叠调回零：我们只比较块大小本身。'), when: { event: 'locked_with_overlap' } },
        { text: T('Close. Visit the neighbouring sizes too and compare their bars.', '很接近了。把相邻的块大小也试一试，比比它们的柱子。'), when: { event: 'locked_close' } },
        { text: T('With overlap, neighbouring chunks share some text, so a sentence cut by one boundary can lie whole in the next chunk.', '有了重叠，相邻的块共享一段文字；被一个边界切断的句子，就可能完整地落在下一块里。'), when: { event: 'overlap_on' } },
        { text: T('Neither extreme wins: the best chunk is just big enough to hold its sentences, and no bigger.', '两个极端都不赢：最好的块，刚好大到能装下整句，不再更大。'), when: 'goal' },
      ],
      hints: [T('Visit every size once: the bars on the right fill in as you go.', '每个块大小都试一次：右边的柱子会随之出现。'), T('For the second task: at 64 tokens with 20% overlap, look for a cell that was a cross without overlap.', '第二个任务：在 64 token、20% 重叠时，找一个在没有重叠时是叉号的格子。')],
      solve: (s: any, _c, w) => {
        w.state.best = true;
        s.si.set_value(0);
        s.oi.set_value(2);
        for (let q = 0; q < 12; q++) {
          if (chunk_status(s.lang, 64, BUDGET, 0, q) === 'split' && chunk_status(s.lang, 64, BUDGET, 20, q) === 'hit') {
            s.qi.set_value(q);
            break;
          }
        }
        w.state.picked = true;
      },
    },
    {
      id: 'chunk-practice', kind: 'read', title: T('Chunking in practice', '实践中的切块'),
      blocks: [
        { type: 'callout', kind: 'note', title: T('The best size depends on your data', '最好的块大小取决于你的数据'), body: T('On these runs the best size was 256 tokens for the English articles and 128 for the Chinese ones: same planets, different text. That is the real lesson - there is no universal chunk size, so measure it on your own questions.', '在这组结果里，英文条目的最佳块大小是 256 token，中文条目是 128：同样是讲行星，文字不同，结果就不同。这正是要记住的：没有通用的最佳块大小，要用你自己的问题去测。') },
        { type: 'p', text: T('The test corpus: excerpts (the first ~4,000 characters in Chinese, ~12,000 in English) of 16 Wikipedia articles, used under CC BY-SA 4.0[^wiki].', '测试语料：16 篇维基百科条目的节选（中文取前约 4,000 字，英文取前约 12,000 个字符），按 CC BY-SA 4.0 使用[^wiki]。') },
        { type: 'list', items: [
          T('**Overlap** (10-20%) mends cut sentences, at the cost of some repeated text.', '**块重叠**（10%–20%）能修补被切断的句子，代价是一些重复的文字。'),
          T('**Cut along the structure**: headings, paragraphs, whole tables - not at a fixed count if the document has a shape.', '**按结构切**：标题、段落、整张表格。文档有结构时，别死按固定长度切。'),
          T('**Attach metadata** to every chunk: source, date, version, who may read it. You will filter on it (see failures below).', '**给每块附上元数据**：来源、日期、版本、谁能看。后面会用来过滤（见下面的失败点）。'),
          T('**Give each chunk its context.** A chunk saying "its revenue grew 3%" has lost who "its" is. Prepending 50-100 tokens that place the chunk in its document cut failed retrievals by a third; with keyword search and reranking added, by two thirds[^ctx].', '**给每块补上它的上下文。**一块写着"它的收入增长了 3%"，已经丢掉了"它"是谁。在每块前面加 50–100 token 的说明，交代它在原文中的位置，检索失败率下降约三分之一；再加上关键词检索和重排，下降约三分之二[^ctx]。'),
        ] },
        figure('ft/a/contextual-retrieval', T('Failure rate in the top 20 chunks: 5.7%, 3.7% with contextual embeddings, 2.9% adding contextual BM25, 1.9% adding reranking.', '前 20 块的检索失败率：5.7%；加上下文化向量 3.7%；再加上下文化 BM25 2.9%；再加重排 1.9%。'), undefined, 'Anthropic, Introducing Contextual Retrieval (2024)'),
        { type: 'cite', key: 'wiki', text: T('Wikipedia articles on the planets and similar bodies (zh, en), excerpted; licence CC BY-SA 4.0. Sources and revisions: tools/ft-data/af/corpus/SOURCES.json', '出处：维基百科行星及类似天体条目（中、英）节选；许可 CC BY-SA 4.0。来源与版本号见 tools/ft-data/af/corpus/SOURCES.json'), url: 'https://creativecommons.org/licenses/by-sa/4.0/' },
        { type: 'cite', key: 'ctx', text: T('Anthropic, Introducing Contextual Retrieval (2024-09-19)', '出处：Anthropic, Introducing Contextual Retrieval (2024-09-19)'), url: 'https://www.anthropic.com/news/contextual-retrieval' },
      ],
    },
    // ---------------------------------------------------------------- 4. rerank and assemble
    {
      id: 'rerank', kind: 'read', chapter: T('From candidates to a prompt', '从候选到提示'), title: T('Rerank, then assemble', '先重排，再拼提示'),
      blocks: [
        { type: 'p', text: T(
          'The vector search is fast because it never reads question and chunk together. A **reranker** (a *cross-encoder*) does read them together, so it judges relevance much better - but it needs one full pass per pair, far too slow for the whole corpus. Hence two stages: fetch about 150 candidates quickly, let the reranker keep the best 20[^ctx2][^mono].',
          '向量检索之所以快，是因为它从不把问题和块放在一起读。**重排模型**（交叉编码器）会把两者一起读，所以判断相关性要准得多；但每一对都要完整算一遍，对整份语料来说太慢。于是分两段：先快速取回约 150 个候选，再让重排模型留下最好的 20 个[^ctx2][^mono]。',
        ) },
        figure('ft/a/bi-cross-encoder', T('Left: bi-encoder, question and chunk encoded separately, compared by cosine. Right: cross-encoder, both read together, one relevance score.', '左：双编码器，问题和块分别编码，用余弦比较。右：交叉编码器，两者一起读，输出一个相关度分数。'), undefined, { en: 'drawn for this course; Sentence-BERT, monoBERT', zh: '本课绘制；参考 Sentence-BERT、monoBERT' }),
        { type: 'p', text: T('Then the chosen chunks go into the prompt. What helps the model use them:', '然后把选中的块放进提示。能帮模型用好它们的做法：') },
        { type: 'list', items: [
          T('**Most relevant first or last.** Models use the middle of a long context least well[^liu2].', '**最相关的放在开头或结尾。**模型对长上下文中间部分利用得最差[^liu2]。'),
          T('**Number the chunks and ask for citations**, so answers can be checked.', '**给块编号，并要求按编号引用**，这样回答才能核对。'),
          T('**Say what to do when the answer is not there**: "say you cannot find it".', '**说清找不到答案时怎么办**："回答找不到"。'),
          T('**Mark retrieved text as data, not instructions.** Text in documents can contain instructions written by an attacker (*indirect prompt injection*)[^greshake]. Delimiters reduce the risk; they do not remove it.', '**把检索到的文字标成资料，而不是指令。**文档里可能夹带攻击者写的指令（*间接提示注入*）[^greshake]。用分隔符能降低风险，但不能根除。'),
        ] },
        figure('ft/a/lost-in-the-middle', T('Illustration: accuracy against the position of the relevant passage, highest at both ends.', '示意：答对率随相关段落位置的变化，两端最高。'), undefined, { en: 'shape after Liu et al., Lost in the Middle (TACL); an illustration', zh: '形状依据 Liu et al.《Lost in the Middle》（TACL），仅为示意' }),
        { type: 'cite', key: 'ctx2', text: T('Anthropic, Introducing Contextual Retrieval (2024): rerank the top 150, keep 20', '出处：Anthropic, Introducing Contextual Retrieval (2024): rerank the top 150, keep 20'), url: 'https://www.anthropic.com/news/contextual-retrieval' },
        { type: 'cite', key: 'mono', text: T('Nogueira & Cho, Passage Re-ranking with BERT (2019)', '出处：Nogueira & Cho, Passage Re-ranking with BERT (2019)'), url: 'https://arxiv.org/abs/1901.04085' },
        { type: 'cite', key: 'liu2', text: T('Liu et al., Lost in the Middle, TACL', '出处：Liu et al., Lost in the Middle, TACL'), url: 'https://arxiv.org/abs/2307.03172' },
        { type: 'cite', key: 'greshake', text: T('Greshake et al., Indirect Prompt Injection (2023)', '出处：Greshake et al., Indirect Prompt Injection (2023)'), url: 'https://arxiv.org/abs/2302.12173' },
      ],
    },
    // ---------------------------------------------------------------- 5. measuring retrieval
    {
      id: 'metrics', kind: 'derive', chapter: T('Is retrieval working?', '检索好不好'), title: T('Measure retrieval on its own', '把检索单独拿出来测'), skill: 'a2-retrieval-eval',
      intro: T(
        'When a RAG answer is wrong, first ask: was the right chunk even in the prompt? The model can only use what it was given. So build a small set of real questions, each with the id of the chunk that answers it, and measure retrieval separately from the final answers. One relevant chunk per question, as here:',
        'RAG 答错时，先问一句：正确的块到底有没有进提示？模型只能用它拿到的东西。所以准备一小组真实问题，每个问题标上能回答它的块的编号，把检索和最终回答分开评测。下面每个问题只有一个相关块：',
      ),
      lines: [
        { tex: '\\mathrm{Recall@}k = \\frac{|\\{q \\in Q:\\ \\mathrm{rank}_q \\le k\\}|}{|Q|}', why: T('$Q$ is the set of test questions and $\\mathrm{rank}_q$ the place of question $q$\'s answer chunk. Recall@k is the share of questions whose chunk is in the top $k$ - did the answer get into the prompt at all? The model can only answer those.', '$Q$ 是测试问题的集合，$\\mathrm{rank}_q$ 是问题 $q$ 的答案块排在第几。Recall@k 就是答案块进了前 $k$ 的问题所占的比例：答案到底进没进提示？模型只可能答对这些。') },
        { tex: '\\mathrm{MRR} = \\frac{1}{|Q|}\\sum_{q \\in Q} \\frac{1}{\\mathrm{rank}_q}', why: T('How high is it? A first place counts 1, a second place 1/2; a chunk not found at all counts 0. Ranking matters because prompts get cut and the middle is used less.', '排得有多靠前？第一名记 1，第二名记 1/2，完全没找到记 0。排名重要，是因为提示会被截断，中间的内容也用得更差。') },
        { tex: '\\mathrm{rank} = 1,\\ 3,\\ \\infty,\\ 2:\\quad \\mathrm{MRR} = \\frac{1 + \\frac13 + 0 + \\frac12}{4}', why: T('Four questions; the third question\'s chunk is not in the top 10 (written ∞), so it adds 0 - but it still counts in the 4.', '四个问题；第三个问题的块没进前 10（记作 ∞），所以贡献 0，但分母仍然是 4。') },
      ],
      blank: { line: 2, answer: '(1 + 1/3 + 0 + 1/2)/4', prompt: T('Write the MRR of these four questions.', '写出这四个问题的 MRR。') },
      outro: T(
        'Then evaluate the answers too - are they correct, and supported by the cited chunks (*faithful*)? Tools such as RAGAS (Es et al., 2023) score these without reference answers. Questions can be written by people, or generated per chunk by a model and checked by hand.',
        '然后再评测回答本身：对不对，有没有被引用的块支持（*忠实度*）？RAGAS（Es et al., 2023）这类工具不需要参考答案就能打分。测试问题可以人工写，也可以让模型针对每块生成，再人工抽查。',
      ),
    },
    {
      id: 'recall-q', kind: 'checkpoint', skill: 'a2-retrieval-eval', purpose: 'check', title: T('Recall@5', '前 5 召回'),
      prompt: T('Same four questions (ranks 1, 3, not in the top 10, 2). What is Recall@5?', '还是这四个问题（排名 1、3、未进前 10、2）。Recall@5 是多少？'),
      question: { type: 'number', answer: 0.75, tolerance: 0.001, wrong: [{ answer: 1, feedback: T('The third question\'s chunk is not even in the top 10.', '第三个问题的块连前 10 都没进。') }] },
      explain: T('Three of the four answer chunks are in the top 5: 3/4 = 0.75.', '四个问题里，有三个的答案块在前 5：3/4 = 0.75。'),
    },
    // ---------------------------------------------------------------- 6. where RAG fails
    {
      id: 'failures', kind: 'read', chapter: T('Where RAG fails', 'RAG 在哪里失败'), title: T('Seven failure points, and a few more', '七个失败点，再加几个'),
      blocks: [
        { type: 'p', text: T('A study of RAG systems in production named seven places they fail[^barnett]. Three of them happen before the answer ever reaches the prompt - which is why retrieval is measured on its own.', '一项对线上 RAG 系统的研究总结了七个失败点[^barnett]。其中三个发生在答案进入提示之前，这就是为什么要把检索单独拿出来测。') },
        { type: 'table', head: [T('code', '编号'), T('failure', '失败'), T('what you see', '表现'), T('first fix', '先怎么修')], rows: [
          ['FP1', T('missing content', '缺内容'), T('confident answer to a question the documents cannot answer', '文档答不了的问题，模型也自信作答'), T('instruct "say you cannot find it"; test with unanswerable questions', '规定"找不到就说找不到"；评测里加入答不了的问题')],
          ['FP2', T('not in the top k', '没排进前 k'), T('the right chunk exists but ranks low', '正确的块存在，但排名靠后'), T('hybrid search, reranking, then tuning (A2b)', '混合检索、重排，再考虑微调（A2b）')],
          ['FP3', T('dropped when assembling', '拼提示时被丢掉'), T('retrieved, but cut by the budget', '检索到了，却被预算截掉'), T('budget, order, deduplication', '预算、顺序、去重')],
          ['FP4', T('not extracted', '没提取出来'), T('in the prompt, but the answer uses a wrong or outdated passage', '已经在提示里，回答却用了错误或过时的段落'), T('filter by date/version, deduplicate', '按日期和版本过滤，去重')],
          ['FP5', T('wrong format', '格式不对'), T('ignores the requested table or list', '没按要求输出表格或列表'), T('structured output, clearer instructions', '结构化输出、更清楚的指令')],
          ['FP6', T('wrong specificity', '详略不当'), T('too general or too detailed', '太笼统或太琐碎'), T('instructions, examples', '指令、示例')],
          ['FP7', T('incomplete', '答得不全'), T('leaves out what was in the context', '漏掉了上下文里有的内容'), T('ask for all relevant items, then check', '要求列出所有相关项，再核对')],
        ] },
        { type: 'p', text: T('Beyond these seven:', '这七个之外：') },
        { type: 'list', items: [
          T('**Questions about the whole corpus** ("what are the main themes?") cannot be answered from a few chunks; they need summarising methods such as GraphRAG[^graphrag].', '**关于整个语料的问题**（"这些报告的主要主题是什么？"）没法靠几块文字回答，需要 GraphRAG 这类汇总方法[^graphrag]。'),
          T('**Permissions** must be applied at retrieval, not after generation: what is in the prompt can leak.', '**权限**要在检索时就过滤，不能等生成后再过滤：进了提示的内容就可能泄露。'),
          T('**Old and new versions** of a document compete; without dates the model may cite the old one.', '**同一文档的新旧版本**会互相竞争；没有日期信息，模型可能引用旧的。'),
        ] },
        { type: 'cite', key: 'barnett', text: T('Barnett et al., Seven Failure Points When Engineering a RAG System (2024)', '出处：Barnett et al., Seven Failure Points When Engineering a RAG System (2024)'), url: 'https://arxiv.org/abs/2401.05856' },
        { type: 'cite', key: 'graphrag', text: T('Edge et al., From Local to Global: A Graph RAG Approach (2024)', '出处：Edge et al., From Local to Global: A Graph RAG Approach (2024)'), url: 'https://arxiv.org/abs/2404.16130' },
      ],
    },
    {
      id: 'diag-1', kind: 'checkpoint', skill: 'a2-failure-diagnosis', purpose: 'check',
      group: case_group('a2-diag', T('Diagnose', '诊断'), [{ type: 'p', text: T('A company assistant answers questions from internal documents. For each symptom, choose the first thing to fix.', '一个公司助手根据内部文档回答问题。每个症状，选出最先该修的地方。') }]),
      prompt: T('The correct chunk exists, but is ranked 37th; the prompt holds 10 chunks.', '正确的块存在，但排在第 37 位；提示里放 10 块。'),
      question: { type: 'choice', options: [
        { id: 'a', label: T('Add keyword search and a reranker (FP2)', '加关键词检索和重排模型（FP2）'), correct: true },
        { id: 'b', label: T('Use a bigger generator model', '换更大的生成模型'), misconception: 'fix-generator-first', feedback: T('The generator never sees chunk 37. Nothing it does can fix that.', '生成模型根本看不到第 37 块，它怎么改都没用。') },
        { id: 'c', label: T('Fine-tune the generator on question-answer pairs', '用问答对微调生成模型'), misconception: 'fix-generator-first', feedback: T('That teaches it to answer confidently without the evidence.', '那只会教它在没有证据时自信作答。') },
      ] },
    },
    {
      id: 'diag-2', kind: 'checkpoint', skill: 'a2-failure-diagnosis', purpose: 'check', group: case_group('a2-diag', T('Diagnose', '诊断'), []),
      prompt: T('The right chunk is in the prompt, but the answer quotes a number from an outdated version of the same policy, also in the prompt.', '正确的块在提示里，但回答引用了同一份规定旧版本里的数字，旧版本也在提示里。'),
      question: { type: 'choice', options: [
        { id: 'a', label: T('Filter by date and version, and say "if versions conflict, use the newest" (FP4)', '按日期和版本过滤，并规定"版本冲突时以最新为准"（FP4）'), correct: true },
        { id: 'b', label: T('Retrieve more chunks', '多取回一些块'), feedback: T('More chunks bring more conflicting text, not less.', '多取回只会带来更多冲突的文字。') },
        { id: 'c', label: T('Smaller chunks', '把块切小'), misconception: 'chunk-smaller-better' },
      ] },
    },
    {
      id: 'diag-3', kind: 'checkpoint', skill: 'a2-failure-diagnosis', purpose: 'check', group: case_group('a2-diag', T('Diagnose', '诊断'), []),
      prompt: T('A user asks about a product the documents never mention; the assistant answers confidently with specs.', '用户问了一款文档里根本没有的产品，助手自信地给出了参数。'),
      question: { type: 'choice', options: [
        { id: 'a', label: T('Instruct it to say when the documents do not contain the answer, and add such questions to the test set (FP1)', '规定文档里没有答案时要明说，并在评测集里加入这类问题（FP1）'), correct: true },
        { id: 'b', label: T('Fine-tune it on the product catalogue', '拿产品目录去微调它'), misconception: 'ft-injects-knowledge' },
        { id: 'c', label: T('Use a larger embedding model', '换更大的向量模型'), feedback: T('There is nothing to retrieve: the content is missing (FP1).', '根本没有可检索的内容：缺的是内容本身（FP1）。') },
      ] },
    },
    // ---------------------------------------------------------------- 7. the map
    map_scene('map', 'A2', T(
      'The knowledge branch of the map is now filled in. Can the whole knowledge base fit in the prompt? Then use it with caching. If not, use RAG, and measure retrieval on its own. If the right chunk does not reach the prompt, fix retrieval in order: chunking, hybrid search, reranking, and only then tuning the retriever. If it does reach the prompt and the answer is still wrong, change how the prompt is assembled.',
      '决策图上"知识"这一支现在补齐了。整个知识库放得进提示吗？放得进，就整体放入，配合缓存。放不进，就用 RAG，并把检索单独拿出来测。正确的块进不了提示，就按顺序修检索：切块、混合检索、重排，最后才是微调检索器。块进了提示、回答还是错，就改提示的拼法。',
    )),
    card_page('card',
      T('When RAG is wrong, measure retrieval first (Recall@k). If the right chunk does not reach the prompt, fix in this order: chunking and metadata, hybrid search, reranking, then fine-tuning the reranker or the embedding model (A2b). If it does reach the prompt, change the assembly; fine-tune the generator last.',
        'RAG 答错时，先单独测检索（Recall@k）。正确的块进不了提示，按这个顺序修：切块和元数据 → 混合检索 → 重排 → 微调重排模型或向量模型（A2b）。块进了提示，就改拼提示的方式；微调生成模型放在最后。'),
      T('The answers are wrong, so the team fine-tunes the generator on question-answer pairs. The real problem was that the right chunk never made the top k (FP2): the fine-tuned model now answers confidently without evidence.', '答案错了，团队就拿问答对去微调生成模型。真正的问题是正确的块根本没进前 k（FP2）：微调后的模型只是学会了在没有证据时自信作答。'),
      { en: 'the knowledge branch of the map', zh: "决策图上的'知识'一支" }),
    {
      id: 'transfer', kind: 'checkpoint', skill: 'a2-failure-diagnosis', purpose: 'check', chapter: T('Check', '检验'), title: T('A new case', '一个新情境'),
      prompt: T('Legal search: Recall@20 is 55%, but for 90% of questions the right clause is somewhere in the top 100. What is the cheapest fix that should work?', '法律条文检索：Recall@20 只有 55%，但 90% 的问题，正确条文都在前 100 名之内。最省事、又最可能有效的修法是？'),
      question: { type: 'choice', options: [
        { id: 'a', label: T('Rerank the top 100 with a cross-encoder and keep 20', '用交叉编码器重排前 100，留下 20 个'), correct: true },
        { id: 'b', label: T('Fine-tune the embedding model', '微调向量模型'), feedback: T('It may help, but it means re-embedding the corpus. The answers are already in the top 100 - a reranker only has to reorder them.', '可能有用，但要重新向量化整个语料。答案已经在前 100 里了，重排模型只需要把它们排到前面。') },
        { id: 'c', label: T('Fine-tune the generator', '微调生成模型'), misconception: 'fix-generator-first' },
        { id: 'd', label: T('Make the chunks bigger', '把块切大'), misconception: 'chunk-bigger-better' },
      ] },
      explain: T('If the right clause were not even in the top 300, reranking could not help: then it is time to tune the retriever itself (lesson A2b).', '如果正确条文连前 300 都进不了，重排就帮不上了，这时才轮到微调检索器本身（A2b）。'),
    },
  ],
};
