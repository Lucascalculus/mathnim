// A2b "Fine-tuning the retriever (optional)" (微调检索器（选学）).
// Plan: docs/lessons/llm-finetuning/part-a-map-rag.md (A2, segments 14-19).
// When to tune the reranker, the embedding model or the generator; the
// contrastive (InfoNCE) loss and its gradient; one world (the push of the
// loss, temperature, false negatives); the practice (sentence-transformers).
import type { Lesson } from '@mathnim/core';
import { card_page, case_group, hold, map_scene, T, vis, animate_to, watch } from '../f/kit';

const INFO = { tau: 0.5 };

/** Train n steps with an animation (the scene computes the exact new angles). */
async function train(scene: any, n: number): Promise<void> {
  const a = scene.after(n);
  const pairs: [any, number][] = [[scene.aq, a.q], ...scene.ad.map((t: any, j: number) => [t, a.d[j]] as [any, number])];
  scene.steps.set_value(scene.steps.get_value() + n);
  await animate_to(scene, scene.__ui, pairs, 0.9);
}

export const lesson: Lesson = {
  id: 'ft-a2b',
  title: T('Fine-tuning the retriever (optional)', '微调检索器（选学）'),
  description: T(
    'When off-the-shelf retrieval is not enough: which part to fine-tune, how the contrastive loss moves embeddings, and the false negatives that quietly hurt it.',
    '现成的检索不够用时：该微调哪一部分，对比损失怎样移动向量，以及悄悄伤害它的假负例。',
  ),
  mode: 'essay',
  skills: [
    { id: 'a2b-which', name: T('Which part of RAG to tune', '该微调 RAG 的哪一部分') },
    { id: 'a2b-infonce', name: T('The contrastive loss and its gradient', '对比损失及其梯度'), prerequisites: ['a2b-which'] },
    { id: 'a2b-practice', name: T('Hard negatives, false negatives, re-indexing', '难负例、假负例与重建索引'), prerequisites: ['a2b-infonce'] },
  ],
  misconceptions: [
    { id: 'fix-generator-first', description: T('When RAG answers wrongly, change or fine-tune the generator.', 'RAG 答错了，就换掉或微调生成模型。') },
    { id: 'tau-direction', description: T('A higher temperature focuses the push on the hardest negatives.', '温度调高，推力就会集中到最难的负例上。') },
    { id: 'false-negatives-harmless', description: T('A few relevant passages among the negatives do no harm.', '负例里混进几个其实相关的段落，问题不大。') },
    { id: 'embed-ft-no-reindex', description: T('After fine-tuning the embedding model you can just swap it in.', '微调完向量模型，直接换上就行。') },
  ],
  steps: [
    // ---------------------------------------------------------------- 1. which part to tune
    {
      id: 'when', kind: 'read', chapter: T('Which part to tune', '该调哪一部分'), title: T('Find where the right chunk gets lost', '先找出正确的块是在哪儿丢的'),
      blocks: [
        { type: 'p', text: T(
          'General embedding models are trained on general text. In a narrow domain - medical abbreviations, legal clauses, your product names - questions and passages may be worded so differently that the right passage never comes near the question. Then tuning the retriever on your own question-passage pairs can help. This is common in practice: thousands of fine-tuned embedding models are on the Hub, and teams report gains from tuning on synthetic in-domain questions[^adopt].',
          '通用的向量模型是在通用文本上训练的。到了窄领域，比如医学缩写、法律条文、你自己的产品名，提问和文档的写法可能差得太远，正确的段落根本靠不近问题。这时，用你自己的（问题，段落）对去微调检索器会有帮助。这在实践中很常见：Hub 上有数千个微调过的向量模型，也有团队报告，用领域内合成的问题微调后检索效果提升了[^adopt]。',
        ) },
        { type: 'p', text: T('Which part to tune depends on where the right chunk gets lost - the same Recall@k you measured in A2 tells you:', '该调哪一部分，取决于正确的块是在哪里丢的。A2 里测的 Recall@k 正好能告诉你：') },
        { type: 'table', head: [T('where the right chunk is', '正确的块在哪'), T('tune', '调什么'), T('cost', '代价')], rows: [
          [T('in the top 100, not the top 20', '在前 100，不在前 20'), T('add a reranker; then fine-tune the reranker on (question, passage, relevant?)', '加重排模型；再用（问题，段落，是否相关）微调它'), T('no re-indexing', '不用重建索引')],
          [T('not even in the top 200-300', '连前 200–300 都进不了'), T('query rewriting, hybrid search; then fine-tune the embedding model', '查询改写、混合检索；再微调向量模型'), T('re-embed the whole corpus', '整个语料要重新向量化')],
          [T('in the prompt, but misused or distracted by other chunks', '已经在提示里，却被用错或被别的块带偏'), T('fix the prompt; then fine-tune the generator with distractor chunks (RAFT)', '先改拼法；再用带干扰块的数据微调生成模型（RAFT）'), T('a fine-tune of the LLM', '一次大模型微调')],
        ] },
        { type: 'p', text: T(
          'Training data comes from three places: logs of what users clicked or accepted; questions a model writes for each passage (a handful of examples is enough to prompt it[^promptagator]), checked by hand; and *negatives* - passages that are not the answer. The rest of this lesson is about how the loss uses them.',
          '训练数据有三个来源：用户点击或采纳了什么的日志；让模型针对每段文字写出的问题（给它几个例子就够[^promptagator]），再人工抽查；还有*负例*，也就是不是答案的段落。本课剩下的部分，讲损失函数怎么用这些数据。',
        ) },
        { type: 'cite', key: 'adopt', text: T('research-adoption.md, item 5: 7,994 sentence-transformers models trained with the Trainer; Databricks (2025); Unsloth (2026)', 'research-adoption.md 第 5 条：7,994 个用 Trainer 训练的 sentence-transformers 模型；Databricks（2025）；Unsloth（2026）'), url: 'https://www.databricks.com/en/blog/improving-retrieval-and-rag-embedding-model-finetuning' },
        { type: 'cite', key: 'promptagator', text: T('Dai et al., Promptagator: Few-shot Dense Retrieval From 8 Examples (2022)', '出处：Dai et al., Promptagator: Few-shot Dense Retrieval From 8 Examples (2022)'), url: 'https://arxiv.org/abs/2209.11755' },
      ],
    },
    // ---------------------------------------------------------------- 2. the contrastive loss
    {
      id: 'idea', kind: 'read', chapter: T('The contrastive loss', '对比损失'), title: T('Pick the right passage out of a batch', '在一批段落里挑出对的那个'),
      blocks: [
        { type: 'p', text: T(
          'How do you teach an encoder that a question belongs with one passage? Turn it into a classification task you already know. Take a batch of (question, passage) pairs. For each question, its own passage is the right class; the other passages in the batch are wrong classes - free *negatives*. Score each candidate by its similarity to the question and apply softmax cross-entropy. This is the **InfoNCE** loss[^cpc] (in sentence-transformers: MultipleNegativesRankingLoss).',
          '怎样教会编码器"这个问题配这段文字"？把它变成你熟悉的分类问题。取一批（问题，段落）对。对每个问题，它自己的段落是正确类别，同一批里的其他段落是错误类别，也就是免费得到的*负例*。用每个候选和问题的相似度打分，再算 softmax 交叉熵。这就是 **InfoNCE** 损失[^cpc]（sentence-transformers 里叫 MultipleNegativesRankingLoss）。',
        ) },
        { type: 'p', text: T('Two things to watch in the derivation that follows: which negatives get pushed hardest, and what the temperature $\\tau$ does.', '接下来推导时，留意两件事：哪些负例被推得最狠，以及温度 $\\tau$ 起什么作用。') },
        { type: 'cite', key: 'cpc', text: T('van den Oord, Li & Vinyals, Representation Learning with Contrastive Predictive Coding (2018), section 2.3', '出处：van den Oord, Li & Vinyals, Representation Learning with Contrastive Predictive Coding (2018), section 2.3'), url: 'https://arxiv.org/abs/1807.03748' },
      ],
    },
    {
      id: 'derive', kind: 'derive', title: T('The gradient of InfoNCE', 'InfoNCE 的梯度'), skill: 'a2b-infonce',
      intro: T('Question vector $q$; candidates $d_0 = d^+$ (the positive) and $d_1,\\dots,d_{N-1}$ (negatives), all of length 1; similarities $s_j = q\\cdot d_j$.', '问题向量 $q$；候选 $d_0 = d^+$（正例）和 $d_1,\\dots,d_{N-1}$（负例），长度都是 1；相似度 $s_j = q\\cdot d_j$。'),
      lines: [
        { tex: '\\mathcal L = -\\log \\frac{e^{s_0/\\tau}}{\\sum_{j} e^{s_j/\\tau}}', why: T('Softmax cross-entropy with logits $s_j/\\tau$ and the positive as the right class.', '以 $s_j/\\tau$ 为 logits、正例为正确类别的 softmax 交叉熵。') },
        { tex: 'w_j = \\frac{e^{s_j/\\tau}}{\\sum_k e^{s_k/\\tau}}, \\qquad \\frac{\\partial \\mathcal L}{\\partial s_j} = \\frac{w_j - [j = 0]}{\\tau}', why: T('The familiar result for cross-entropy: predicted probability minus one-hot; the chain rule adds $1/\\tau$.', '交叉熵的老结论：预测概率减去 one-hot；链式法则再乘上 $1/\\tau$。') },
        { tex: '\\nabla_{d_0}\\mathcal L = -\\frac{1 - w_0}{\\tau}\\, q', why: T('$\\partial s_0/\\partial d_0 = q$. A descent step moves $d^+$ towards $q$, harder the less sure the model is ($1 - w_0$).', '$\\partial s_0/\\partial d_0 = q$。梯度下降一步，把 $d^+$ 拉向 $q$；模型越没把握（$1 - w_0$ 越大），拉得越用力。') },
        { tex: '\\nabla_{d_j}\\mathcal L = \\frac{w_j}{\\tau}\\, q \\qquad (j \\ge 1)', why: T('A descent step pushes negative $j$ away from $q$ with strength $w_j/\\tau$: its softmax weight.', '梯度下降一步，把负例 $j$ 推离 $q$，力度是 $w_j/\\tau$，也就是它的 softmax 权重。') },
        { tex: 'w_j \\propto e^{s_j/\\tau}', why: T('So the negatives most similar to $q$ take most of the push, and a smaller $\\tau$ concentrates it on them even more. A negative that is actually relevant - a *false negative* - is exactly such a similar one.', '所以和 $q$ 最像的负例承受了大部分推力；$\\tau$ 越小，推力越集中在它们身上。而一个其实相关的"负例"，也就是*假负例*，恰恰就是这种很像的。') },
      ],
      blank: { line: 3, answer: 'w/t', variables: ['w', 't'], ranges: { w: [0.05, 0.95], t: [0.05, 1] }, prompt: T('Fill in the strength of the push on a negative (write w for $w_j$ and t for $\\tau$).', '填出负例受到的推力大小（用 w 表示 $w_j$，t 表示 $\\tau$）。') },
      outro: T('With vectors kept at length 1, only the part of each push along the sphere moves them - the world below draws exactly that.', '向量保持长度为 1 时，只有沿着球面的那部分推力会移动它们。下面的世界画的正是这一部分。'),
    },
    {
      id: 'push-predict', kind: 'checkpoint', skill: 'a2b-infonce', purpose: 'predict', chapter: T('See the push', '看推力'), title: T('Your bet', '你的判断'),
      prompt: T('Five negatives have similarities 0.9, 0.5, 0.3, 0.1 and −0.2 to the question. At $\\tau = 0.5$, which one takes the largest share of the push - and what happens to its share at $\\tau = 0.05$?', '五个负例和问题的相似度分别是 0.9、0.5、0.3、0.1、−0.2。$\\tau = 0.5$ 时，谁分到的推力最多？$\\tau = 0.05$ 时，它的份额会怎样？'),
      question: { type: 'choice', options: [
        { id: 'a', label: T('the 0.9 one, about half; at 0.05 almost all of it', '0.9 那个，约一半；τ = 0.05 时几乎全部'), correct: true },
        { id: 'b', label: T('all five equally, at both temperatures', '五个平分，两种温度都一样') },
        { id: 'c', label: T('the −0.2 one: it is the most wrong', '−0.2 那个：它错得最离谱') },
        { id: 'd', label: T('the 0.9 one, and its share falls at 0.05', '0.9 那个，τ = 0.05 时份额下降'), misconception: 'tau-direction' },
      ] },
      explain: T('Its share is $e^{0.9/\\tau}/\\sum e^{s/\\tau}$: about 48% at $\\tau=0.5$ and 99.97% at $\\tau=0.05$.', '它的份额是 $e^{0.9/\\tau}/\\sum e^{s/\\tau}$：$\\tau=0.5$ 时约 48%，$\\tau=0.05$ 时约 99.97%。'),
    },
    {
      id: 'push-world', kind: 'explore', title: T('Who gets pushed?', '谁被推开了？'), skill: 'a2b-infonce',
      scene: vis('contrastive_infonce', INFO),
      prompt: T(
        '1) Lower $\\tau$ until one negative takes at least 85% of the push, then press **Train 10 steps**. 2) Then switch the **false-negative filter** on and train again, keeping $n_1$ close to $q$.',
        '1）把 $\\tau$ 调低，直到某个负例分到至少 85% 的推力，然后按**训练 10 步**。2）再打开**过滤假负例**，重新训练，让 $n_1$ 留在 $q$ 附近。',
      ),
      setup: (scene: any, ui, _ctx, world) => {
        hold('contrastive_infonce', INFO)(scene, ui, _ctx, world);
        scene.__ui = ui;
        let high = false;
        watch(scene, () => {
          if (!high && scene.tau() >= 0.9) {
            high = true;
            world.emit('tau_high');
          }
        });
      },
      actions: [
        {
          id: 'train', label: T('Train 10 steps', '训练 10 步'), primary: true,
          run: (scene: any, _ctx, world) => {
            const share = scene.shares()[1] ?? 0, filtered = scene.filt.get_value() > 0.5, tau = scene.tau();
            const before = scene.angle_to_q(1);
            void train(scene, 10).then(() => {
              const after = scene.angle_to_q(1);
              if (!filtered && share >= 0.85) {
                world.state.focus = true;
                if (scene.rev.get_value() < 0.5) {
                  scene.rev.set_value(1);
                  world.emit('revealed');
                } else if (after > before + 1) world.emit('pushed_again');
              } else if (!filtered && scene.rev.get_value() > 0.5 && after > before + 1) world.emit('pushed_again');
              if (filtered) world.state.filtered_steps = ((world.state.filtered_steps as number) ?? 0) + 10;
              world.emit('trained', { share, tau, filtered, warmer: tau > 0.5 && share < 0.85, angle: after });
              if (!filtered && share < 0.85 && tau <= 0.5) world.emit('spread');
            });
          },
        },
        {
          id: 'filter', label: T('False-negative filter on / off', '过滤假负例：开 / 关'),
          run: (scene: any, _ctx, world) => {
            const on = scene.filt.get_value() < 0.5;
            scene.set_filter(on); // training restarts from the start
            world.state.filtered_steps = 0;
            world.emit('filter', { on });
          },
        },
      ],
      goals: [
        { id: 'focus', check: (_s, _c, w) => !!w.state.focus, message: T('The push went almost entirely to n₁ - and n₁ moved away from q.', '推力几乎全给了 n₁，n₁ 被推离了 q。') },
        { id: 'filtered', check: (s: any, _c, w) => s.filt.get_value() > 0.5 && ((w.state.filtered_steps as number) ?? 0) >= 10 && s.angle_to_q(1) <= 15, message: T('Filtered out, the false negative stays next to the question.', '过滤掉以后，假负例留在了问题旁边。') },
      ],
      detectors: [
        { id: 'warmer', on: (e) => (e.type === 'trained' && e.data?.warmer ? { kind: 'misconception', id: 'tau-direction', message: T('A higher τ spreads the push over all negatives.', 'τ 调高，推力会平摊给所有负例。') } : null) },
        { id: 'again', on: (e) => (e.type === 'pushed_again' ? { kind: 'misconception', id: 'false-negatives-harmless', message: T('Each step keeps pushing a relevant passage away.', '每训练一步，都在把一段相关的文字推得更远。') } : null) },
      ],
      lines: [
        { text: T('Each arrow is an embedding of length one. The small arrows at the tips are one training step: green pulls, gold pushes.', '每支箭头是一个长度为一的向量。箭头尖上的小箭头是一步训练：绿色是拉，金色是推。'), when: 'enter' },
        { text: T('Watch the bars as you lower tau: which negative takes over?', '把 tau 往下调时盯着柱子：哪个负例占了上风？'), when: 'idle' },
        { text: T('Warmer is flatter: a high tau makes the softmax even, so the push is spread thin over all negatives.', '温度越高越平：tau 大时 softmax 很平，推力被薄薄地分给所有负例。'), when: { finding: 'tau-direction' } },
        { text: T('The push was still spread over several negatives, so nothing moved much. Lower tau first.', '推力还分散在好几个负例上，所以谁都没怎么动。先把 tau 调低。'), when: { event: 'spread' } },
        { text: T('n one is not a wrong passage at all - it answers the question too. It looked like the hardest negative because it is relevant, and the loss pushed it hardest.', 'n 一其实不是错误的段落，它也能回答这个问题。它看起来像最难的负例，正是因为它相关；而损失把它推得最狠。'), when: { event: 'revealed' } },
        { text: T('Still unfiltered: every step pushes the relevant passage further. Switch the filter on.', '还没过滤：每多训练一步，这段相关的文字就被推得更远。打开过滤吧。'), when: { finding: 'false-negatives-harmless' } },
        { text: T('This is why hard-negative mining drops candidates that score almost as high as the positive: they are often not negatives at all.', '所以挖难负例时，要丢掉分数几乎和正例一样高的候选：它们往往根本不是负例。'), when: 'goal' },
      ],
      hints: [T('Drag the τ slider to the left (lower) and watch the bars.', '把 τ 滑块往左（调低），看柱子的变化。'), T('Around τ = 0.06 one negative takes 85%.', 'τ 约为 0.06 时，有一个负例分到 85%。')],
      solve: (s: any, _c, w) => {
        w.state.focus = true;
        s.set_filter(true);
        s.train(10);
        w.state.filtered_steps = 10;
      },
    },
    // ---------------------------------------------------------------- 3. practice
    {
      id: 'practice', kind: 'read', chapter: T('In practice', '实践'), title: T('Hard negatives, false negatives, re-indexing', '难负例、假负例、重建索引'),
      blocks: [
        { type: 'list', items: [
          T('**Temperature.** sentence-transformers\' MultipleNegativesRankingLoss multiplies cosines by `scale=20`, i.e. $\\tau = 0.05$: the push goes mostly to the hardest negatives.', '**温度。**sentence-transformers 的 MultipleNegativesRankingLoss 把余弦乘以 `scale=20`，也就是 $\\tau = 0.05$：推力主要落在最难的负例上。'),
          T('**Hard negatives** - passages that look right but are not - teach the most; mine them from the current model\'s or BM25\'s top results. **Filter out false negatives**: `mine_hard_negatives(..., relative_margin=0.05)` drops candidates scoring within 5% of the positive[^stneg].', '**难负例**（看起来对、其实不对的段落）教得最多；可以从当前模型或 BM25 的前几名里挖。**同时过滤假负例**：`mine_hard_negatives(..., relative_margin=0.05)` 会丢掉分数和正例相差不到 5% 的候选[^stneg]。'),
          T('**Bigger batches give more negatives.** The loss bounds the mutual information by $\\log N - \\mathcal L$, which tightens as $N$ grows[^cpc2]; a cached variant of the loss allows large batches on small GPUs.', '**批越大，负例越多。**这个损失给出互信息的下界 $\\log N - \\mathcal L$，$N$ 越大越紧[^cpc2]；损失的缓存版本可以在小显卡上用大批量。'),
          T('**Split by document**, not by question, or test questions will match passages seen in training.', '**按文档划分**训练集和测试集，而不是按问题划分；否则测试题会碰到训练时见过的段落。'),
          T('**Re-index after tuning the embedding model.** Stored vectors come from the old model; the new model\'s vectors live in a different space. A reranker scores pairs at question time, so swapping it needs no re-indexing.', '**微调完向量模型要重建索引。**索引里存的是旧模型算出的向量，新模型的向量在另一个空间里。重排模型是在提问时给（问题，段落）打分，换它不用重建索引。'),
        ] },
        { type: 'cite', key: 'stneg', text: T('sentence-transformers: hard negatives mining', '出处：sentence-transformers: hard negatives mining'), url: 'https://sbert.net/docs/package_reference/util/hard_negatives.html' },
        { type: 'cite', key: 'cpc2', text: T('van den Oord et al. (2018), section 2.3', '出处：van den Oord et al. (2018), section 2.3'), url: 'https://arxiv.org/abs/1807.03748' },
      ],
    },
    {
      id: 'code', kind: 'code', lang: 'python', title: T('Fine-tune an embedding model', '微调一个向量模型'),
      intro: T('A minimal run with sentence-transformers: mine hard negatives, train with in-batch negatives, evaluate on held-out questions, re-index. Library details change between versions; check the current documentation.', '用 sentence-transformers 跑一个最小流程：挖难负例，用批内负例训练，在留出的问题上评测，然后重建索引。库的细节随版本变化，以当时的文档为准。'),
      code: `from datasets import Dataset
from sentence_transformers import SentenceTransformer, SentenceTransformerTrainer, losses
from sentence_transformers.util import mine_hard_negatives
from sentence_transformers.evaluation import InformationRetrievalEvaluator

model = SentenceTransformer("intfloat/multilingual-e5-small")
pairs = Dataset.from_list(train_pairs)   # [{"anchor": "query: ...", "positive": "passage: ..."}], split by document

triplets = mine_hard_negatives(
    pairs, model,
    num_negatives=3,
    relative_margin=0.05,   # drop candidates within 5% of the positive: likely false negatives
)

loss = losses.MultipleNegativesRankingLoss(model)   # scale=20, i.e. tau = 0.05; other rows are negatives too
trainer = SentenceTransformerTrainer(model=model, train_dataset=triplets, loss=loss)
trainer.train()

evaluator = InformationRetrievalEvaluator(test_queries, corpus, relevant_docs)   # held-out questions
print(evaluator(model))                  # recall@k, MRR@10, nDCG@10

corpus_vectors = model.encode(chunks, normalize_embeddings=True)   # re-index: old vectors are now useless`,
      notes: [
        { lines: [5, 6], text: T('Start from a general model; the pairs come from logs or from questions a model wrote per passage.', '从一个通用模型出发；训练对来自日志，或者让模型针对每段文字写的问题。') },
        { lines: [8, 12], text: T('Hard negatives come from the model\'s own top results; relative_margin removes the near-ties - the false negatives of the world above.', '难负例来自模型自己的前几名结果；relative_margin 去掉和正例几乎打平的候选，也就是上面世界里的假负例。') },
        { lines: [14, 16], text: T('InfoNCE with in-batch negatives: every other passage in the batch is a negative for free.', '带批内负例的 InfoNCE：同一批里其他所有段落，都是免费的负例。'), shapes: 'similarity matrix: [batch, batch + negatives]' },
        { lines: [18, 19], text: T('Measure on questions whose documents were not in training.', '在文档没参与训练的问题上评测。') },
        { lines: [21, 21], text: T('Every stored vector must be recomputed with the new model.', '索引里的每个向量都要用新模型重算。'), shapes: 'corpus_vectors: [n_chunks, 384]' },
      ],
    },
    // ---------------------------------------------------------------- 4. checks
    map_scene('map', 'A2b', T(
      'On the map this lesson refines one box: fixing retrieval. § If the right chunk is in the top hundred, add and then tune a reranker, which needs no re-indexing. § If it never comes near, tune the embedding model with a contrastive loss, filter the false negatives, and re-index the corpus.',
      '这一课细化了决策图上的一格：修检索。§正确的块在前一百名之内，就先加重排模型、再微调它，不用重建索引。§正确的块根本靠不近，就用对比损失微调向量模型，过滤掉假负例，然后重建索引。',
    )),
    card_page('card',
      T('Find where the right chunk is lost. In the top 100 but not the top 20: a reranker, then tune it. Never near: query rewriting and hybrid search, then tune the embedding model with in-batch negatives and filtered hard negatives - and re-index. In the prompt but misused: fix the assembly, then RAFT.', '先找出正确的块在哪里丢的。在前 100 但不在前 20：加重排模型，再微调它。根本靠不近：先做查询改写和混合检索，再用批内负例加过滤后的难负例微调向量模型，然后重建索引。进了提示却被用错：先改拼法，再考虑 RAFT。'),
      T('Mining the top-ranked passages as negatives without filtering: some of them answer the question too, and the loss pushes exactly those away the hardest.', '把排名最靠前的段落不加过滤地当负例：其中有些其实也能回答问题，而损失恰恰把它们推得最狠。'),
      { en: 'fixing retrieval, in the knowledge branch', zh: "'知识'一支里的'修检索'" }),
    {
      id: 'case-med', kind: 'checkpoint', skill: 'a2b-which', purpose: 'check', chapter: T('Check', '检验'), title: T('A new case', '一个新情境'),
      prompt: T('Doctors ask with abbreviations ("DAPT after PCI"); the papers spell the terms out. The right paper is often not even in the top 300, and BM25 does not find it either. What first, and what next?', '医生提问用缩写（"PCI 术后 DAPT"），文献里写的是全称。正确的文献常常连前 300 都进不了，BM25 也找不到。先做什么？再做什么？'),
      question: { type: 'choice', options: [
        { id: 'a', label: T('Query rewriting (expand abbreviations); then fine-tune the embedding model on doctors\' queries with filtered hard negatives, and re-index', '先做查询改写（展开缩写）；再用医生的提问和过滤后的难负例微调向量模型，并重建索引'), correct: true },
        { id: 'b', label: T('Only add a reranker', '只加一个重排模型'), feedback: T('A reranker only reorders the candidates it receives; a paper outside the top 300 never reaches it.', '重排模型只能重新排它拿到的候选；排在 300 名以外的文献根本到不了它手里。') },
        { id: 'c', label: T('Fine-tune the generator on medical Q&A', '用医学问答微调生成模型'), misconception: 'fix-generator-first' },
        { id: 'd', label: T('Fine-tune the embedding model and keep the old index', '微调向量模型，索引保持不变'), misconception: 'embed-ft-no-reindex' },
      ] },
    },
    {
      id: 'reindex', kind: 'checkpoint', skill: 'a2b-practice', purpose: 'check', title: T('Explain it', '用自己的话说'),
      prompt: T('Why must the corpus be re-indexed after fine-tuning the embedding model, but not after fine-tuning the reranker?', '为什么微调向量模型后要重建索引，微调重排模型却不用？'),
      question: { type: 'text', rubric: {
        key_points: [
          T('The stored chunk vectors were computed by the old embedding model; the new model maps text to a different space, so old and new vectors cannot be compared.', '索引里的向量是旧模型算的；新模型把文字映射到另一个空间，新旧向量没法比较。'),
          T('A reranker scores (question, passage) pairs at question time and stores nothing, so it can be swapped directly.', '重排模型在提问时才给（问题，段落）打分，不存任何东西，可以直接替换。'),
        ],
        model_answer: T('The index holds vectors made by the old embedding model; after fine-tuning, the model places text differently, so every chunk must be re-embedded to be comparable with new question vectors. The reranker computes its score from the raw question and passage each time, so nothing stored depends on it.', '索引里存的是旧向量模型算出的向量；微调之后，模型把文字放到了不同的位置，所以每一块都要重新向量化，才能和新问题的向量比较。重排模型每次都直接读原始的问题和段落来打分，没有任何存储的东西依赖它。'),
      } },
    },
  ],
};
