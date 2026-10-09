// D4 The DPO family and preference data in practice.
// Purpose first (in practice the pairs matter more than the loss), the
// variants in one table (they are rare in practice: research-adoption §5), one
// short derivation of why a finite target gap helps, then most of the time on
// building preference data and on choosing between SFT, DPO and RLVR. No new
// world: comparisons and engineering judgement read better as tables, figures
// and choices; the one dynamic picture (variants on the D3 toy) is a figure
// computed from the same toy.
import type { Lesson } from '@mathnim/core';
import { choose_card, cite, fig, list, note, open_q, p, t, table, text_q, warn } from './common';

const scenario = (id: string, prompt: [string, string], correct: string, explain: [string, string], why: Record<string, [string, string]> = {}): any => ({
  id: `choose-${id}`, kind: 'checkpoint', skill: 'method-choice', purpose: 'check',
  group: { id: 'choose', title: t('Pick the method', '选方法'), brief: [p('Four teams, four situations. For each, which approach would you start with?', '四个团队，四种情况。每种情况，你会从哪种做法开始？')] },
  prompt: t(...prompt),
  question: {
    type: 'choice', options: [
      { id: 'sft', label: t('SFT (or first try a prompt with structured output)', 'SFT（或者先试带结构化输出的提示词）'), correct: correct === 'sft', feedback: why.sft ? t(...why.sft) : undefined },
      { id: 'dpo', label: t('DPO on preference pairs', '偏好对上的 DPO'), correct: correct === 'dpo', feedback: why.dpo ? t(...why.dpo) : undefined },
      { id: 'rlvr', label: t('RLVR with a verifier (GRPO-family, E1)', '带验证器的 RLVR（GRPO 一类，E1）'), correct: correct === 'rlvr', feedback: why.rlvr ? t(...why.rlvr) : undefined },
      { id: 'online', label: t('Iterative DPO or online RL with a judge', '迭代 DPO，或者带评委的在线 RL'), correct: correct === 'online', feedback: why.online ? t(...why.online) : undefined },
    ],
  },
  explain: t(...explain),
});

export const lesson: Lesson = {
  id: 'ft-d4',
  title: t('The DPO family and preference data in practice', 'DPO 家族与偏好数据实践'),
  description: t(
    'The variants in one table, how to build preference pairs that teach the right thing, offline versus iterative training, and how to choose between SFT, DPO and RLVR.',
    '各种变体一张表看完；怎样造出教对东西的偏好对；离线与迭代训练；以及在 SFT、DPO、RLVR 之间怎么选。',
  ),
  mode: 'essay',
  skills: [
    { id: 'dpo-variants', name: t('What the DPO variants change', 'DPO 各变体改了什么') },
    { id: 'pref-data', name: t('Building preference data', '构造偏好数据') },
    { id: 'dpo-failures', name: t('Diagnosing DPO failures', '诊断 DPO 的失败'), prerequisites: ['pref-data'] },
    { id: 'method-choice', name: t('Choosing between SFT, DPO and RLVR', '在 SFT、DPO、RLVR 之间做选择'), prerequisites: ['dpo-variants', 'pref-data'] },
  ],
  misconceptions: [
    { id: 'variant-always-better', description: t('A newer variant is always better than DPO.', '新出的变体一定比 DPO 好。') },
    { id: 'any-pairs-fine', description: t('It does not matter where the preference pairs come from.', '偏好对从哪来都一样。') },
    { id: 'chosen-must-be-great', description: t('The chosen answers must be high quality, or DPO cannot help.', '被选回答必须是高质量的，否则 DPO 帮不上忙。') },
    { id: 'judge-labels-clean', description: t('Pairs labelled by an LLM judge are clean labels.', '大模型评委标出来的偏好对就是干净的标签。') },
    { id: 'one-method-only', description: t('You pick one of SFT, DPO or RL.', 'SFT、DPO、RL 只能选一种。') },
  ],
  steps: [
    // ---------------------------------------------------------------- 1. the variants, briefly
    {
      id: 'why', kind: 'read', chapter: t('Pairs matter more than the loss', '偏好对比损失更重要'), title: t('What actually decides the result', '真正决定结果的是什么'),
      blocks: [
        p('After D3 you can run DPO. When you do it on your own data, two questions come up: should I use one of the many variants (IPO, KTO, ORPO, SimPO...)? And where do my pairs come from? Practice gives a clear answer to the first: the variants are rarely used, and comparisons of DPO and PPO keep finding that **the quality of the preference data matters more than the algorithm**[^ivison]. So this lesson covers the variants in one table and spends the rest on data, and on when DPO is the right tool at all.',
          '学完 D3，你已经能跑 DPO 了。真正在自己的数据上跑的时候，会冒出两个问题：要不要用某个变体（IPO、KTO、ORPO、SimPO……）？偏好对从哪来？实践对第一个问题的回答很明确：变体很少有人用，而且 DPO 和 PPO 的比较一再发现，**偏好数据的质量比算法更重要**[^ivison]。所以这一课用一张表讲完变体，其余时间都花在数据上，以及什么时候 DPO 才是对的工具。'),
        fig('usage', ['Hub model counts by tag: dpo 13,519, orpo 1,279, kto 428.', 'Hub 上按标签统计的模型数：dpo 13,519，orpo 1,279，kto 428。'],
          ['DPO itself dominates; ORPO and KTO have about 1-10% of its footprint.', 'DPO 本身占绝大多数；ORPO 和 KTO 只有它的 1–10% 左右。'], 'Data: Hugging Face Hub tag counts, 2026-10 (research-adoption.md)'),
        cite('ivison', 'Ivison et al. 2024', 'Unpacking DPO and PPO: Disentangling Best Practices for Learning from Preference Feedback', 'https://arxiv.org/abs/2406.09279'),
      ],
    },
    {
      id: 'family', kind: 'read', title: t('The family in one table', '一张表看完整个家族'),
      blocks: [
        p('Each variant changes one thing about DPO, for one reason. Δ = log π_θ(y) − log π_ref(y), h = Δ_w − Δ_l, |y| = the answer’s length in tokens.', '每个变体都只改了 DPO 的一处，为了一个理由。记 Δ = log π_θ(y) − log π_ref(y)，h = Δ_w − Δ_l，|y| 为回答的 token 数。'),
        table([['Method', '方法'], ['What it changes', '改了什么'], ['Why', '为什么'], ['Use when', '什么时候用'], ['In TRL v1.15', 'TRL v1.15 里']], [
          ['DPO', ['—', '—'], ['—', '—'], ['you have pairs', '有成对数据'], '`DPOConfig(loss_type=["sigmoid"])`'],
          [['DPO + NLL', 'DPO + NLL'], ['adds α·(−log π(y_w)) on the chosen answer', '在被选回答上加 α·(−log π(y_w))'], ['keeps the chosen answer likely; fights displacement (D3)', '保住被选回答的概率，对抗位移（D3）'], ['the chosen answers are good in themselves', '被选回答本身质量就好'], '`loss_type=["sigmoid","sft"]`, `loss_weights=[1, α]`'],
          [['Length-normalized DPO', '长度归一化 DPO'], ['divides each log-ratio by |y|', '把每个对数比除以 |y|'], ['weakens "longer is better"', '削弱"越长越好"'], ['chosen answers tend to be longer', '被选回答普遍更长'], '`loss_type=["sigmoid_norm"]`'],
          ['IPO', ['squared loss (h − 1/(2τ))² toward a finite gap', '平方损失 (h − 1/(2τ))²，回归到有限的差距'], ['with one-sided pairs DPO’s gap runs to infinity (see the derivation)', '偏好一边倒时，DPO 的差距会冲向无穷（见下面的推导）'], ['nearly every pair is one-sided; little data', '几乎每一对都一边倒；数据少'], '`loss_type=["ipo"]`, `beta` = τ'],
          ['KTO', ['no pairs: single answers marked good or bad, judged against a reference point', '不需要成对：单条回答标"好"或"坏"，相对一个参考点来评'], ['you often only have thumbs up or down', '你手里常常只有点赞或点踩'], ['only unpaired good/bad labels', '只有不成对的好/坏标签'], '`KTOTrainer`, `desirable_weight`, `undesirable_weight`'],
          ['ORPO', ['no reference model; SFT and a preference term in one stage', '不要参考模型；SFT 和偏好项合成一个阶段'], ['one stage, less memory', '一个阶段、更省显存'], ['starting from a base model, memory is tight', '从基座模型开始，显存很紧'], '`trl.experimental.orpo`'],
          ['SimPO', ['no reference; reward = (β/|y|)·log π(y), plus a target margin γ', '不要参考模型；奖励 = (β/|y|)·log π(y)，再加目标边距 γ'], ['matches how the answer is scored at generation time; saves memory', '和生成时给回答打分的方式一致；省显存'], ['memory is tight and you accept less anchoring', '显存紧，并接受锚定变弱'], '`CPOConfig(loss_type="simpo", cpo_alpha=0)`'],
        ]),
        warn('Reference-free variants (ORPO, SimPO) lose the leash of D2b: nothing measures how far the model has moved. If you only need to save memory, DPO with precomputed reference log-probabilities saves almost as much and keeps the anchor.', '无参考模型的变体（ORPO、SimPO）丢掉了 D2b 的那根缰绳：没有任何东西衡量模型走了多远。如果只是想省显存，预先算好参考对数概率的 DPO 能省下差不多的显存，还保住了锚。'),
        p('Every one of these papers reports beating DPO somewhere. In practice they are used a tenth as often or less. Get the data right first; DPO plus an NLL term or a length fix is usually enough.', '这些论文都报告过在某处胜过 DPO；但在实践中，它们的使用量只有 DPO 的十分之一甚至更少。先把数据做好；DPO 加上 NLL 项或长度处理，通常就够了。'),
      ],
    },
    {
      id: 'finite-derive', kind: 'derive', skill: 'dpo-variants', title: t('Why a finite target gap', '为什么要有限的目标差距'),
      intro: t('Take a pair that is one-sided: people always prefer y_w. Recall D1: an answer that never lost had no finite best reward.', '取一对"一边倒"的数据：人们总是选 y_w。回想 D1：一场没输过的回答，没有有限的最优奖励。'),
      lines: [
        { tex: '-\\log\\sigma(\\beta h) > 0, \\qquad \\lim_{h\\to\\infty} -\\log\\sigma(\\beta h) = 0', why: t('The DPO loss of that pair is positive for every finite gap h and only approaches zero as h grows without bound: it keeps falling and never reaches zero - exactly D1’s runaway reward.', '对任何有限的差距 h，这一对的 DPO 损失都大于零，只有 h 无限增大时才趋于零：它一直下降，却永远到不了零——正是 D1 里那个停不下来的奖励。') },
        { tex: 'h \\to \\infty \\;\\Rightarrow\\; \\frac{\\pi_\\theta(y_l)/\\pi_{ref}(y_l)}{\\pi_\\theta(y_w)/\\pi_{ref}(y_w)} \\to 0', why: t('Whatever β is, the optimizer keeps driving the rejected answer’s relative probability to zero; β only sets the speed. On such pairs the KL leash stops holding - the argument of the IPO paper.', '不管 β 是多少，优化器都会把被拒回答的相对概率一路压向零；β 只决定速度。在这样的对上，KL 缰绳实际上失效了——这正是 IPO 论文的论点。') },
        { tex: '\\mathcal L_{IPO} = \\Big(h - \\frac{1}{2\\tau}\\Big)^2 \\;\\Rightarrow\\; h^* = \\frac{1}{2\\tau}', why: t('A squared loss regresses the gap to a fixed target and stops there. τ plays β’s role: larger τ, smaller target gap, closer to the reference. (TRL passes τ as `beta` and averages the log-ratios per token.)', '平方损失把差距回归到一个固定目标，到了就停。τ 起 β 的作用：τ 越大，目标差距越小，越贴近参考模型。（TRL 用 `beta` 传 τ，并按 token 平均对数比。）') },
      ],
      blank: { line: 2, answer: '1/(2*tau)', variables: ['tau'], prompt: t('The IPO optimum: h* = ?', 'IPO 的最优差距：h* = ?'), ranges: { tau: [0.1, 2] } },
      outro: t('What IPO does not fix: the direction. On the D3 toy below, IPO stops at the target gap, yet the never-seen "comply" answer still gains probability; the NLL term changes the direction itself.', 'IPO 修不了的是方向。在下面 D3 的玩具上，IPO 停在了目标差距处，那个从没出现过的"照做"回答照样分到了概率；NLL 项改变的是方向本身。'),
    },
    {
      id: 'toy-compare', kind: 'read', title: t('Three losses on the same toy', '同一个玩具上的三种损失'),
      blocks: [
        fig('loss-curves', ['Loss against the gap h: DPO keeps falling; IPO is a parabola with its minimum at h* = 1/(2τ).', '损失随差距 h 的变化：DPO 一直往下；IPO 是一条抛物线，最低点在 h* = 1/(2τ)。'],
          ['DPO has no bottom; IPO has one.', 'DPO 没有底；IPO 有。'], 'Original; exact'),
        fig('toy-variants', ['After 400 steps on D3’s similar pair: DPO leaves the chosen answer at 0.00 and the comply answer at 1.00; DPO + NLL keeps the chosen at 0.92; IPO stops with the chosen at 0.22 and the comply answer at 0.40.', '在 D3 那对相似样本上训练 400 步之后：DPO 让被选回答只剩 0.00、"照做"拿到 1.00；DPO + NLL 让被选回答保持 0.92；IPO 停下时被选回答 0.22、"照做" 0.40。'],
          ['IPO limits how far the model goes; the NLL term changes where it goes.', 'IPO 限制的是走多远；NLL 项改变的是往哪走。'], 'Original; exact gradient descent on the D3 toy (made-up numbers)'),
      ],
    },
    {
      id: 'kto-q', kind: 'checkpoint', skill: 'dpo-variants', purpose: 'check', title: t('Thumbs up, thumbs down', '点赞和点踩'),
      prompt: t('Your product logs single answers with a thumbs up or a thumbs down - no pairs. Which method fits this data directly?', '你的产品只记录了单条回答的点赞或点踩——没有成对数据。哪种方法能直接用这种数据？'),
      question: {
        type: 'choice', options: [
          { id: 'a', label: 'DPO', feedback: t('DPO needs pairs. You could pair a liked and a disliked answer to the same prompt, but you would throw away everything that cannot be paired.', 'DPO 需要成对数据。你可以把同一个提示下一个被点赞、一个被点踩的回答配成一对，但配不上对的数据就都浪费了。') },
          { id: 'b', label: 'KTO', correct: true },
          { id: 'c', label: 'SimPO', feedback: t('SimPO still needs pairs.', 'SimPO 同样需要成对数据。') },
          { id: 'd', label: 'IPO', feedback: t('IPO needs pairs too.', 'IPO 也需要成对数据。') },
        ],
      },
    },

    // ---------------------------------------------------------------- 2. data
    {
      id: 'pipeline', kind: 'read', chapter: t('Building preference data', '构造偏好数据'), title: t('Four stages, four ways to go wrong', '四个环节，四种出错的方式'),
      blocks: [
        fig('data-pipeline', ['Prompts, candidate answers, labels, filters, then pairs for DPO, with a loop back for iteration.', '提示 → 候选回答 → 标注 → 过滤 → 偏好对 → DPO，另有一条迭代的回路。'],
          ['A preference-data pipeline. Each stage guards against one kind of failure.', '一条偏好数据管线。每个环节防一种失败。'], 'Original'),
        table([['Stage', '环节'], ['What to do', '怎么做'], ['What it prevents', '防的是什么']], [
          [['Prompts', '提示'], ['take them from the real distribution of use; deduplicate; remove anything in your evaluation sets', '取自真实的使用分布；去重；去掉和评测集重合的'], ['learning the wrong tasks; inflated evaluation', '学错任务；评测虚高']],
          [['Candidates', '候选回答'], ['sample several answers from your own SFT model (below)', '从自己的 SFT 模型采样几条回答（见下）'], ['pairs the reference would never write', '参考模型根本写不出的偏好对']],
          [['Labels', '标注'], ['people, or a judge with a written rubric, each pair judged twice with the order swapped', '人工，或者按写明的细则打分的评委；每对交换位置评两次'], ['noise; position and length bias', '噪声；位置偏差和长度偏差']],
          [['Filters', '过滤'], ['drop ties, near-duplicates and truncated answers; balance lengths', '去掉平局、近似重复和被截断的回答；配平长度'], ['noise; likelihood displacement; learning "write longer"', '噪声；似然位移；学会"写长点"']],
        ]),
      ],
    },
    {
      id: 'candidates', kind: 'read', title: t('On-policy or off-policy candidates', '候选回答：在线（同策略）还是离线（异策略）'),
      blocks: [
        p('**On-policy** candidates are sampled from the model you are about to train - usually your SFT model, which is also the reference. **Off-policy** candidates come from other models.', '**在线（同策略，on-policy）**的候选回答从你要训练的模型里采样——通常就是你的 SFT 模型，它同时也是参考模型。**离线（异策略，off-policy）**的候选回答来自别的模型。'),
        list([
          ['**Why on-policy helps.** The implicit reward is β·log(π_θ/π_ref). An answer the reference would almost never write needs a huge change of log-probability to fit, the anchor weakens, and - as in D3 - probability can end up on answers nobody looked at. On-policy pairs also cover the mistakes your model actually makes.', '**为什么在线采样有用**：隐式奖励是 β·log(π_θ/π_ref)。参考模型几乎写不出来的回答，要拟合它就得把对数概率改得很多，锚就松了，而且——像 D3 那样——概率可能落到没人检查过的回答上。在线采样的偏好对，也正好覆盖了你的模型真正会犯的错。'],
          ['**Why mix in off-policy.** Other models write things yours cannot, which widens what the pairs can teach. Tülu 3 mixed completions from its own SFT model with those of 22 other models, rated by GPT-4o[^tulu].', '**为什么也混入离线数据**：别的模型能写出你的模型写不出的东西，偏好对能教的就更广。Tülu 3 把自家 SFT 模型的回答和另外 22 个模型的回答混在一起，由 GPT-4o 打分[^tulu]。'],
          ['**A cheap way to get good chosen answers**: sample several and keep the best by a verifier or judge - B2’s rejection sampling. Llama 3 combined rejection sampling, SFT and DPO.', '**拿到好的被选回答的便宜办法**：采样几条，用验证器或评委挑最好的——也就是 B2 的拒绝采样。Llama 3 就是把拒绝采样、SFT 和 DPO 组合起来用的。'],
        ]),
        cite('tulu', 'Lambert et al. 2024', 'Tülu 3: Pushing Frontiers in Open Language Model Post-Training (§5)', 'https://arxiv.org/abs/2411.15124'),
      ],
    },
    {
      id: 'delta-q', kind: 'checkpoint', skill: 'pref-data', purpose: 'predict', title: t('Bet first', '先下注'),
      prompt: t('Chosen answers come from a 32B model, rejected answers from a 0.6B model of the same family. Fine-tuning your 7B model with SFT on the chosen answers makes it **worse**. What does DPO on these pairs do?', '被选回答来自一个 32B 模型，被拒回答来自同系列的 0.6B 模型。用这些被选回答对你的 7B 模型做 SFT，模型反而变**差**了。在这些偏好对上做 DPO 呢？'),
      question: {
        type: 'choice', options: [
          { id: 'a', label: t('It makes the model better', '让模型变好'), correct: true },
          { id: 'b', label: t('Worse too: the chosen answers are the same', '同样变差：被选回答是同一批'), misconception: 'chosen-must-be-great' },
          { id: 'c', label: t('No effect', '没有影响') },
        ],
      },
      attempts: 1,
      reveal: 'delta',
    },
    {
      id: 'delta', kind: 'read', title: t('Delta learning', '差值学习（delta learning）'),
      blocks: [
        p('Olmo 3 did exactly this[^olmo3]. More SFT on the 32B model’s answers hurt; DPO on 32B-versus-0.6B pairs helped:', 'Olmo 3 正是这样做的[^olmo3]。在 32B 模型的回答上继续做 SFT，结果变差；在"32B 对 0.6B"的偏好对上做 DPO，结果变好：'),
        fig('delta', ['7B development average: SFT start 70.3; more SFT on the chosen answers 64.5; DPO on strong-versus-weak pairs 72.9.', '7B 开发集平均分：SFT 起点 70.3；在被选回答上继续 SFT 64.5；在强对弱的偏好对上做 DPO 72.9。'],
          ['Same chosen answers, opposite effects.', '同一批被选回答，效果正好相反。'], 'Data: Olmo 3 (Team Olmo, 2025), Table 21'),
        p('D3 explains why. SFT copies the chosen answer, including whatever in it is beyond or unlike your model. DPO only learns the **difference** between chosen and rejected - the direction from weak to strong - and does not need the chosen answer to be perfect. The pairs can be built entirely by models, at scale.', 'D3 解释了原因。SFT 照抄被选回答，连同里面超出你的模型能力、或者和它风格不合的部分。DPO 只学被选和被拒之间的**差**——从弱到强的那个方向——并不要求被选回答本身完美。这种偏好对可以完全由模型大批量造出来。'),
        open_q('How far does this generalize - to other domains, other model sizes, other gaps between the two models? The "delta learning hypothesis" is recent[^delta] and still being tested.', '这个结论能推广到多远——别的领域、别的模型规模、两个模型之间别的差距？"差值学习假说"还很新[^delta]，仍在检验之中。'),
        cite('olmo3', 'Team Olmo 2025', 'Olmo 3 (§4.3)', 'https://arxiv.org/abs/2512.13961'),
        cite('delta', 'Geng et al. 2025', 'The Delta Learning Hypothesis', 'https://arxiv.org/abs/2507.06187'),
      ],
    },
    {
      id: 'labels', kind: 'read', title: t('Labels and filters', '标注与过滤'),
      blocks: [
        list([
          ['**People** ranking several answers (InstructGPT) or saying how much better (Llama 2). Slow, expensive, best for new domains and safety policy.', '**人工**：对几条回答排序（InstructGPT），或者说明好多少（Llama 2）。慢、贵，最适合新领域和安全策略。'],
          ['**A judge with a rubric.** Judge every pair twice with the order swapped and keep only consistent verdicts (position bias); write "concise is better" into the rubric if you want it (verbosity bias); calibrate the judge on a few hundred human labels[^judge].', '**按细则打分的评委**：每对交换位置评两次，只保留两次一致的结论（防位置偏差）；想要简洁，就把"简洁优先"写进细则（防冗长偏差）；用几百条人工标注校准评委[^judge]。'],
          ['**Scores turned into pairs.** UltraFeedback rated four answers per prompt; Zephyr took the highest-scoring answer as chosen and a random one of the other three as rejected[^zephyr].', '**分数转成偏好对**：UltraFeedback 给每个提示的四条回答打分；Zephyr 把得分最高的作为被选，从其余三条里随机取一条作为被拒[^zephyr]。'],
        ]),
        p('Then filter:', '然后过滤：'),
        list([
          ['**Ties and tiny score gaps** - mostly noise.', '**平局和分差很小的对**：大多是噪声。'],
          ['**Near-duplicate pairs** - the displacement risk of D3; filtering by similarity (CHES) worked best in Razin et al.’s experiments[^razin].', '**近乎重复的对**：D3 里的似然位移风险；在 Razin 等人的实验里，按相似度（CHES）过滤效果最好[^razin]。'],
          ['**Length balance** - if the chosen answer is longer in most pairs, DPO learns "write longer". Aim for about half.', '**长度配平**：如果大多数对里被选回答都更长，DPO 学到的就是"写长点"。目标是一半左右。'],
          ['**Truncated answers** - the part that distinguishes two answers is often at the end; drop them or raise the maximum length.', '**被截断的回答**：区分两个回答的内容常常在结尾；删掉它们，或者调大最大长度。'],
        ]),
        cite('judge', 'Zheng et al. 2023', 'Judging LLM-as-a-Judge with MT-Bench and Chatbot Arena', 'https://arxiv.org/abs/2306.05685'),
        cite('zephyr', 'Tunstall et al. 2023', 'Zephyr: Direct Distillation of LM Alignment', 'https://arxiv.org/abs/2310.16944'),
        cite('razin', 'Razin et al. 2025', 'Unintentional Unalignment: Likelihood Displacement in Direct Preference Optimization', 'https://arxiv.org/abs/2410.08847'),
      ],
    },
    {
      id: 'pairs-code', kind: 'code', title: t('Building pairs, in code', '用代码构造偏好对'), lang: 'python',
      intro: t('The pipeline in one page: sample from your own model, judge each pair twice, filter. `judge` and `similar` are yours to write (a rubric prompt; an embedding similarity).', '一页代码走完这条管线：从自己的模型采样，每对评两次，再过滤。`judge` 和 `similar` 需要你自己写（一段细则提示词；一个向量相似度）。'),
      code: `from vllm import LLM, SamplingParams

policy = LLM("my-sft-model")                                   # on-policy: your own SFT model
outs = policy.generate(prompts, SamplingParams(n=4, temperature=0.8, max_tokens=1024))

def prefer(prompt, a, b):                                      # judge twice, order swapped
    first, second = judge(prompt, a, b), judge(prompt, b, a)   # each returns "1" or "2"
    if first == "1" and second == "2": return a, b
    if first == "2" and second == "1": return b, a
    return None                                                # disagree: position bias or a tie

pairs = []
for p, o in zip(prompts, outs):
    cands = [c.text for c in o.outputs if c.finish_reason == "stop"]  # drop truncated answers
    if len(cands) < 2: continue
    res = prefer(p, cands[0], cands[1])
    if res is None: continue
    chosen, rejected = res
    if similar(chosen, rejected) > 0.9: continue                # near-duplicates: displacement risk
    pairs.append({"prompt": p, "chosen": chosen, "rejected": rejected})

longer = sum(len(x["chosen"]) > len(x["rejected"]) for x in pairs) / len(pairs)
print(f"chosen is longer in {longer:.0%} of pairs")             # far above 50%: balance it`,
      notes: [
        { lines: [1, 4], text: t('Sampling from the model you will train keeps the pairs on-policy. Four answers per prompt is a common start.', '从你要训练的模型采样，偏好对就是在线（同策略）的。每个提示四条回答是常见的起点。') },
        { lines: [6, 10], text: t('Asking the judge twice with the order swapped, and keeping only consistent verdicts, removes most position bias.', '交换顺序问评委两次、只保留一致的结论，能去掉大部分位置偏差。') },
        { lines: [12, 20], text: t('Each `continue` is one filter from the table: truncation, disagreement, near-duplicates.', '每个 `continue` 就是表里的一种过滤：截断、评委不一致、近似重复。') },
        { lines: [22, 23], text: t('Check the length balance before training, not after.', '在训练之前就检查长度是否配平，别等训练完。') },
      ],
    },
    {
      id: 'online', kind: 'read', title: t('Offline, iterative, online', '离线、迭代、在线'),
      blocks: [
        fig('iterate', ['Offline: one fixed dataset, one round of DPO. Iterative: sample from the current model, label, run DPO with the current model as reference, repeat.', '离线：一份固定的数据，做一轮 DPO。迭代：从当前模型采样、标注、以当前模型为参考做 DPO，循环往复。'],
          ['Iterating keeps the pairs on-policy as the model changes.', '迭代让偏好对随着模型的变化始终保持在线（同策略）。'], 'Original'),
        list([
          ['**Offline**: one dataset, one pass. Simple, and stale once the model has moved.', '**离线**：一份数据、一遍训练。简单，但模型一变，数据就过时了。'],
          ['**Iterative**: each round samples from the current model, labels, trains, and makes the result the next reference. Llama 3 ran six rounds[^llama3]; self-rewarding models even use the model as its own judge[^selfreward].', '**迭代**：每一轮都从当前模型采样、标注、训练，再把结果当作下一轮的参考模型。Llama 3 做了六轮[^llama3]；"自我奖励"的模型甚至让模型自己当评委[^selfreward]。'],
          ['**Online DPO**: fresh pairs every batch[^oaif] - by then you are close to online RL with a judge, and you pay for a judge and for generation again.', '**在线 DPO**：每个 batch 都用新造的偏好对[^oaif]——到这一步，你已经很接近"带评委的在线 RL"了，评委和生成的代价又回来了。'],
        ]),
        p('Why iterate? D3’s displacement went to an answer nobody had looked at. Sampling again from the trained model brings such answers into the data, where they can be judged and pushed down. Llama 4’s recipe runs light SFT, then online RL, then a final light DPO.', '为什么要迭代？D3 里的位移，流向的是没人检查过的回答。从训练后的模型重新采样，就会把这类回答带进数据，让它们被评、被压下去。Llama 4 的配方是：轻量 SFT，然后在线 RL，最后一步轻量 DPO。'),
        cite('llama3', 'Llama Team 2024', 'The Llama 3 Herd of Models (§4.1.6)', 'https://arxiv.org/abs/2407.21783'),
        cite('selfreward', 'Yuan et al. 2024', 'Self-Rewarding Language Models', 'https://arxiv.org/abs/2401.10020'),
        cite('oaif', 'Guo et al. 2024', 'Direct Language Model Alignment from Online AI Feedback', 'https://arxiv.org/abs/2402.04792'),
      ],
    },
    {
      id: 'failures', kind: 'read', title: t('When DPO goes wrong', 'DPO 出问题的时候'),
      blocks: [
        table([['Symptom', '症状'], ['Most likely cause', '最可能的原因'], ['What to do', '怎么办']], [
          [['`logps/chosen` falls; `rewards/accuracies` near 1 quickly', '`logps/chosen` 下降；`rewards/accuracies` 很快接近 1'], ['likelihood displacement, overfitting (D3)', '似然位移，同时过拟合（D3）'], ['filter similar pairs; add an NLL term; one epoch; lower learning rate', '过滤相似的对；加 NLL 项；只训一轮；降低学习率']],
          [['Answers keep getting longer; judge win rate rises but length-controlled win rate does not', '回答越来越长；评委胜率上升，长度受控胜率却不动'], ['length bias in the pairs or the judge', '偏好对或评委里有长度偏差'], ['balance lengths; length-normalized DPO; report length-controlled win rates[^lc]', '配平长度；用长度归一化的 DPO；报告长度受控胜率[^lc]']],
          [['`rewards/margins` explodes in epoch 2', '第 2 轮 `rewards/margins` 暴涨'], ['one-sided pairs: the gap runs away', '偏好一边倒：差距在发散'], ['one epoch; IPO; more data', '只训一轮；用 IPO；补充数据']],
          [['Almost no change after training', '训练前后几乎没变化'], ['template mismatch, loss on the prompt, wrong reference, learning rate too low', '聊天模板不一致、在提示上算了损失、参考模型配错、学习率太小'], ['overfit 10 examples first as a sanity check; inspect the masks token by token', '先在 10 条数据上过拟合一遍做健全性检查；逐 token 检查掩码']],
          [['General ability drops', '通用能力下降'], ['drifted too far; narrow data', '漂得太远；数据太窄'], ['larger β; mix in some SFT data; general evaluations (B3)', '加大 β；混入部分 SFT 数据；跑通用评测（B3）']],
          [['Worse than the SFT model you started from', '比出发时的 SFT 模型还差'], ['off-policy pairs far from the reference; chosen answers with errors', '离线（异策略）数据离参考模型太远；被选回答本身有错'], ['sample on-policy; fix or drop bad chosen answers', '改为在线（同策略）采样；修正或删掉有问题的被选回答']],
        ]),
        cite('lc', 'Dubois et al. 2024', 'Length-Controlled AlpacaEval: A Simple Way to Debias Automatic Evaluators', 'https://arxiv.org/abs/2404.04475'),
      ],
    },
    {
      id: 'length-q', kind: 'checkpoint', skill: 'dpo-failures', purpose: 'check', title: t('Read the evaluation', '读评测结果'),
      prompt: t('After DPO on judge-labelled pairs: win rate against the SFT model +12 points; average length ×1.9; length-controlled win rate +1 point; in the data, the chosen answer is the longer one in 78% of pairs. What happened?', '在评委标注的偏好对上做完 DPO：对 SFT 模型的胜率涨了 12 个点；平均长度变为 1.9 倍；长度受控胜率只涨了 1 个点；数据里 78% 的对，被选回答更长。发生了什么？'),
      question: {
        type: 'choice', options: [
          { id: 'a', label: t('The gain is mostly length: the pairs and the judge favour longer answers', '提升主要来自长度：偏好对和评委都偏爱更长的回答'), correct: true },
          { id: 'b', label: t('A real improvement of 12 points', '真实提升了 12 个点'), misconception: 'judge-labels-clean', feedback: t('Controlled for length the gain is 1 point, and 78% of the chosen answers are longer: the model learned "write longer".', '控制了长度，提升只剩 1 个点，而且 78% 的被选回答更长：模型学到的是"写长点"。') },
          { id: 'c', label: t('Overfitting: train fewer epochs', '过拟合：少训几轮') },
        ],
      },
      explain: t('Balance lengths in the data, write "concise is better" into the judge’s rubric, consider length-normalized DPO, and judge progress by the length-controlled number.', '在数据里配平长度，把"简洁优先"写进评委的细则，考虑长度归一化的 DPO，并以长度受控的指标判断进展。'),
    },

    // ---------------------------------------------------------------- 3. choosing
    {
      id: 'choose', kind: 'read', chapter: t('SFT, DPO or RLVR?', 'SFT、DPO 还是 RLVR？'), title: t('Start from the signal you have', '从你手里的信号出发'),
      blocks: [
        p('The four approaches differ mainly in what signal they need and what they cost:', '这四种做法的区别，主要在于需要什么信号、要付什么代价：'),
        table([['Aspect', '方面'], ['SFT', 'SFT'], ['DPO (offline)', 'DPO（离线）'], ['RLVR (E1)', 'RLVR（E1）'], ['Online RL + judge', '在线 RL + 评委']], [
          [['Signal', '信号'], ['demonstrations', '示范'], ['preference pairs', '偏好对'], ['a program that checks answers', '能判对错的程序'], ['a reward model or judge', '奖励模型或评委']],
          [['Samples during training', '训练中采样'], ['no', '否'], ['no', '否'], ['yes', '是'], ['yes', '是']],
          [['Good at', '擅长'], ['format, style, demonstrable behaviour, distillation', '格式、风格、能示范的行为、蒸馏'], ['subjective quality, tone, refusal boundaries', '主观质量、语气、拒答边界'], ['math, code, checkable formats, tool calls', '数学、代码、可检查的格式、工具调用'], ['subjective quality that must keep improving', '要持续进步的主观质量']],
          [['Main risk', '主要风险'], ['cannot say "not like this"; forgetting', '说不出"别这样"；遗忘'], ['displacement; length bias; stale data', '似然位移；长度偏差；数据过时'], ['holes in the verifier', '验证器的漏洞'], ['reward hacking; cost', '奖励投机；成本']],
          [['Today', '现状'], ['by far the most common', '最普遍'], ['offered by most platforms; fading at the frontier', '多数平台都提供；在前沿淡出'], ['the fastest growing', '增长最快'], ['used in labs, mostly with rubrics and judges', '实验室在用，多为细则加评委']],
        ]),
        list([
          ['**Can prompting, context or RAG solve it?** Then do not train (A1): only about a quarter of teams fine-tune at all.', '**提示词、上下文或 RAG 能解决吗？** 那就不要训练（A1）：真正做微调的团队只有四分之一左右。'],
          ['**Can you write the answer you want?** SFT (B).', '**你能写出想要的回答吗？** 用 SFT（B）。'],
          ['**Can a program check correctness?** RLVR (E1) - or first, more cheaply, rejection sampling plus SFT (B2).', '**对错能用程序判断吗？** 用 RLVR（E1）——或者先用更便宜的拒绝采样加 SFT（B2）。'],
          ['**Can you only compare, and quality is subjective?** Preference pairs and DPO, sampled on-policy where you can; iterate, or move to online RL with a judge, if the model must keep improving on its own outputs.', '**只能比较、质量是主观的？** 偏好对加 DPO，能在线采样就在线采样；如果模型需要在自己的输出上持续进步，就迭代，或者改用带评委的在线 RL。'],
          ['**On a managed platform?** The menu is usually SFT, DPO, and reinforcement fine-tuning with graders; none offers PPO.', '**用托管平台？** 能选的通常就是 SFT、DPO，以及带评分器的强化微调；没有平台提供 PPO。'],
        ], true),
        note('These are not either/or. Frontier recipes combine them: Tülu 3 and Olmo 3 run SFT → DPO → RLVR; Llama 4 runs SFT → online RL → light DPO.', '这些不是单选题。前沿配方都是组合：Tülu 3 和 Olmo 3 是 SFT → DPO → RLVR；Llama 4 是 SFT → 在线 RL → 轻量 DPO。', ['Combine, do not choose one', '是组合，不是单选']),
      ],
    },
    scenario('sql', ['A team generates SQL and can run each query on a test database and compare the results.', '一个团队要生成 SQL，可以在测试库上执行每条查询并比对结果。'], 'rlvr',
      ['A program can check the answer: use it as the reward. A cheaper first step is rejection sampling plus SFT. Watch for verifier holes, such as results that match by accident.', '程序能判对错：直接把它当奖励。更便宜的第一步是拒绝采样加 SFT。要提防验证器的漏洞，比如结果碰巧一致。'],
      { dpo: ['Pairs are a weaker and costlier signal when a program can check correctness.', '能用程序判对错的时候，偏好对是更弱、更贵的信号。'] }),
    scenario('tone', ['A team wants a consistent brand tone and has 20,000 user preference pairs, on one GPU.', '一个团队想要统一的品牌语气，手里有 2 万条用户偏好对，只有一张 GPU。'], 'dpo',
      ['Subjective and comparative: DPO, with LoRA and precomputed reference log-probabilities for the memory. Check length balance and similar pairs first.', '主观、只能比较：用 DPO，配 LoRA，并预先算好参考对数概率来省显存。先检查长度配平和相似的对。']),
    scenario('json', ['A team needs the model to always output a fixed internal JSON schema and has 3,000 correct examples.', '一个团队需要模型始终输出固定的内部 JSON 结构，手里有 3,000 条正确示例。'], 'sft',
      ['A demonstrable format: SFT, or first just a prompt with structured output. Preferences or RL would be using an expensive tool for a cheap problem.', '能直接示范的格式：用 SFT，或者干脆先试带结构化输出的提示词。用偏好或 RL，是拿昂贵的工具解决便宜的问题。'],
      { dpo: ['Nothing here needs a comparison: you can demonstrate the exact output.', '这里不需要比较：你能直接示范要的输出。'], rlvr: ['You could validate the schema, but demonstrations already teach it more cheaply.', '你确实能校验格式，但示范数据教得更便宜。'] }),
    scenario('plateau', ['A team already has a DPO model whose dialogue quality has plateaued; they have a strong judge and a GPU cluster.', '一个团队已经有一个 DPO 模型，对话质量到了瓶颈；他们有一个强评委和一个 GPU 集群。'], 'online',
      ['The offline data are stale: sample from the current model and label again (iterative DPO), or run online RL with the judge - and decide when to stop with an independent evaluation.', '离线数据已经过时：从当前模型重新采样、重新标注（迭代 DPO），或者用评委做在线 RL——并用独立的评估决定何时停。']),
    {
      id: 'design-q', kind: 'checkpoint', skill: 'pref-data', purpose: 'check', title: t('Design it', '设计一下'),
      prompt: t('Design a preference-data pipeline for a customer-support model that must follow a refund policy and stay polite. Say where prompts and candidates come from, how pairs are labelled, what you filter, and how you will know it worked.', '为一个客服模型设计偏好数据管线：它必须遵守退款政策、保持礼貌。说明提示和候选回答从哪来、偏好对怎么标注、过滤什么，以及你怎么知道它起了作用。'),
      question: text_q([
        ['Prompts from real support traffic, deduplicated and kept out of the evaluation set', '提示来自真实的客服流量，去重，并与评测集隔开'],
        ['Candidates sampled on-policy from the team’s own SFT model, several per prompt', '候选回答从自己的 SFT 模型在线（同策略）采样，每个提示几条'],
        ['A judge with a rubric that writes out the refund policy and tone', '评委使用写明退款政策和语气要求的评分细则'],
        ['Each pair judged twice with swapped order; inconsistent verdicts dropped', '每对交换位置评两次，丢掉不一致的结论'],
        ['Filter ties and near-duplicates; balance lengths', '过滤平局和近似重复；配平长度'],
        ['Calibrate the judge on a sample of human labels', '用一批人工标注校准评委'],
        ['Evaluate on held-out prompts (policy compliance, length-controlled win rate) and iterate', '在留出的提示上评估（政策符合率、长度受控胜率），并迭代'],
      ], ['Take prompts from real support tickets (deduplicated, evaluation set held out); sample four answers each from our SFT model; have a judge with a rubric that spells out the refund policy and tone compare pairs twice with swapped order, keeping only consistent verdicts, after calibrating it on ~200 human labels; drop ties and near-duplicates and balance lengths; train DPO, then check policy compliance and length-controlled win rate on held-out tickets, and repeat with fresh samples.', '提示取自真实的客服工单（去重，留出评测集）；每个提示从我们的 SFT 模型采样四条回答；让一个按细则打分的评委——细则写明退款政策和语气——交换位置比较两次，只保留一致的结论，评委事先用约 200 条人工标注校准；去掉平局和近似重复，配平长度；训练 DPO，再在留出的工单上检查政策符合率和长度受控胜率，然后用新样本重复。'], 5),
    },
    {
      id: 'card', kind: 'read', chapter: t('How to choose', '怎么选'), title: t('What D4 adds to the map', 'D4 给决策图加了什么'),
      blocks: choose_card({
        upto: 'D4', highlight: 'B3,S',
        rule: t('Use DPO by default and switch variants only when the data demand it (only thumbs up/down: KTO; the chosen answer’s probability falls: add an NLL term). Spend the effort on the pairs: sample on-policy, label with swapped order, filter similar pairs and balance lengths - or build strong-versus-weak pairs (delta learning).',
          '默认用 DPO，只在数据形态需要时换变体（只有点赞点踩：KTO；被选回答的概率在掉：加 NLL 项）。把力气花在偏好对上：在线（同策略）采样，交换位置标注，过滤相似的对、配平长度——或者构造"强对弱"的偏好对（差值学习）。'),
        counter: t('"We have better answers now, so just SFT on them." Olmo 3 found SFT on the same chosen answers made the model worse (70.3 → 64.5), while DPO on strong-versus-weak pairs made it better (72.9).',
          '"我们已经有更好的回答了，直接拿来做 SFT 就行。"Olmo 3 发现，在同一批被选回答上做 SFT 反而让模型变差（70.3 → 64.5），而在"强对弱"的偏好对上做 DPO 让它变好（72.9）。'),
        extra: [warn('A newer loss is rarely the bottleneck. The variants are used a tenth as often as DPO or less; data quality moves results more.', '换一个更新的损失，很少是瓶颈。变体的使用量只有 DPO 的十分之一甚至更少；数据质量对结果的影响更大。')],
      }),
    },
  ],
};
