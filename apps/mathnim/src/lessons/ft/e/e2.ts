// E2 推理模型的完整配方 / The full recipe of a reasoning model.
// Plan: docs/lessons/llm-finetuning/part-e-reasoning.md (E2); facts:
// research-reasoning.md (R1 v1, PRM800K, Qwen3 Table 21, Yue et al.),
// research-technical.md §6.
// Order: what we want (a model that thinks first) -> R1-Zero (pure RL) and
// what it got wrong -> R1's four stages, each answering a problem -> which
// reward -> how to measure (pass@k) -> does RL teach or sharpen? (world) ->
// what it takes to run (rank-1 LoRA, systems, agents) -> choosing.
import type { Lesson } from '@mathnim/core';
import { pass_at_k, question_set, sharpen } from '@mathnim/visuals/ft/e/math';
import { choose_card, fig, t, vis, world_setup } from './common';

// the illustrative question set of the pass@k world (same seed as the visual's default)
const BASE = question_set(24, 3);
const RL_SKETCH = BASE.map((p) => sharpen(p, 1, 0.1));

export const lesson: Lesson = {
  id: 'ft-e2-reasoning-recipe',
  title: t('The full recipe of a reasoning model', '推理模型的完整配方'),
  description: t(
    'How DeepSeek-R1 was built, stage by stage and why; outcome vs process rewards; how to measure with pass@k; whether RL teaches new reasoning or sharpens what is there; and what it takes to run it.',
    'DeepSeek-R1 是怎么一步步训出来的，每一步为什么；结果奖励还是过程奖励；怎么用 pass@k 衡量；强化学习是在教新本事，还是在磨已有的本事；以及真正跑起来要注意什么。',
  ),
  mode: 'essay',
  theme: 'light',
  skills: [
    { id: 'r1-pipeline', name: t('The R1 recipe and why each stage is there', 'R1 的配方，以及每个阶段为什么存在') },
    { id: 'outcome-vs-process', name: t('Outcome vs process rewards', '结果奖励与过程奖励') },
    { id: 'pass-at-k', name: t('Measure with pass@k', '用 pass@k 衡量'), prerequisites: ['r1-pipeline'] },
    { id: 'rl-elicit-debate', name: t('Teach or elicit: read the evidence', '教会还是激发：读懂证据'), prerequisites: ['pass-at-k'] },
    { id: 'rl-engineering', name: t('What it takes to run RL', '跑强化学习要注意什么') },
  ],
  misconceptions: [
    { id: 'r1-is-pure-rl', description: t('R1 was trained with RL alone.', 'R1 只用了强化学习。') },
    { id: 'aha-created', description: t('RL created the model\'s ability to reflect ("aha").', '模型的反思能力（"aha"）是强化学习凭空创造的。') },
    { id: 'longer-is-better', description: t('Answers that get longer during RL mean better reasoning.', '强化学习中回答越写越长，说明推理越来越强。') },
    { id: 'prm-always-better', description: t('Process rewards are always better than outcome rewards.', '过程奖励总比结果奖励好。') },
    { id: 'pass1-is-boundary', description: t('pass@1 shows the limit of what a model can solve.', 'pass@1 就代表模型能力的边界。') },
    { id: 'debate-settled', description: t('It is settled whether RL teaches new reasoning or only elicits it.', '"强化学习是教会新推理还是只激发已有能力"已经有定论。') },
    { id: 'same-weights-same-probs', description: t('The rollout engine and the trainer compute the same probabilities from the same weights.', '推理引擎和训练框架加载同一份权重，算出的概率就一样。') },
    { id: 'rl-strictly-better', description: t('RL always beats SFT or distillation, whatever the starting point.', '不管起点如何，强化学习总比 SFT 或蒸馏强。') },
  ],
  steps: [
    // ------------------------------------------------------------------ R1-Zero
    {
      id: 'why', kind: 'read', chapter: t('How R1 was built', 'R1 是怎么训出来的'), title: t('What we are after', '我们想要什么'),
      blocks: [
        { type: 'p', text: t(
          'A reasoning model writes out its thinking before it answers, and is much better at hard maths and code because of it. E1 gave us the tool: RL with rewards a program can check. This lesson asks the next questions. Is RL alone enough to get such a model? What else is in a real recipe, and why? And when RL improves a model, is it teaching it something new, or making it more reliable at what it could already do?',
          '推理模型会先把思考过程写出来，再给答案，正因为如此，它在难的数学和编程题上强得多。E1 给了我们工具：用程序能检查的奖励做强化学习。这一课问接下来的问题：只靠强化学习，能不能训出这样的模型？真实的配方里还有什么，为什么？强化学习让模型变强时，它是在教新东西，还是只是让模型把原本就会的事做得更稳？',
        ) },
        { type: 'p', text: t(
          'The clearest public example is DeepSeek-R1: its paper says what each stage did and why. We follow it, then step back to measurement, the open debate, and the engineering[^r1].',
          '最清楚的公开例子是 DeepSeek-R1：论文写明了每个阶段做了什么、为什么做。我们先沿着它走一遍，再回头看怎么衡量、还没定论的争论，以及工程上的事[^r1]。',
        ) },
        { type: 'cite', key: 'r1', text: t('DeepSeek-AI (2025). DeepSeek-R1, arXiv v1 (numbers in this lesson; the published version reports R1-Zero at 77.9% instead of 71.0%).', 'DeepSeek-AI（2025）。DeepSeek-R1，arXiv v1（本课数字取自 v1；正式发表版报告 R1-Zero 为 77.9%，而不是 71.0%）。'), url: 'https://arxiv.org/abs/2501.12948' },
      ],
    },
    {
      id: 'r1-zero', kind: 'scene', title: t('R1-Zero: RL straight on the base model', 'R1-Zero：直接在基座上做强化学习'),
      scene: vis('r1_pipeline', { stage: 'zero' }),
      narration: t(
        'The first experiment was bold. Take the pretrained base model, with no fine-tuning at all, and run GRPO with just two rule-based rewards: is the answer right, and is the thinking inside the think tags. On the AIME 2024 maths exam, its single-try accuracy climbed from about sixteen percent to seventy-one percent. But its answers were hard to read, and it switched between Chinese and English mid-thought.',
        '第一个实验很大胆：拿只做过预训练、没做过任何微调的基座模型，直接跑 GRPO，奖励只有两条规则：答案对不对，思考过程有没有写在 think 标签里。在 AIME 2024 这套数学竞赛题上，它一次就做对的比例从大约百分之十六涨到了百分之七十一。但它的回答很难读，思考到一半还会在中文和英文之间来回切换。',
      ),
    },
    {
      id: 'p-aha', kind: 'checkpoint', skill: 'r1-pipeline', purpose: 'predict', title: t('Longer, with "wait"', '越写越长，还会说"等等"'),
      prompt: t(
        'During R1-Zero\'s training its answers grew from about 500 to about 9,500 tokens, and phrases like "wait, let me re-check" appeared. Which reading is best supported?',
        'R1-Zero 训练过程中，回答从大约 500 个 token 长到了大约 9500 个，还出现了"等等，我再检查一下"这样的话。哪种解读最有根据？',
      ),
      question: { type: 'choice', options: [
        { id: 'created', label: t('RL created the ability to reflect', '强化学习创造了反思能力'), misconception: 'aha-created' },
        { id: 'both', label: t('The base model could already reflect; RL made it more frequent, and part of the length growth may come from the loss itself', '基座本来就会反思；强化学习让它出现得更频繁，而回答变长有一部分可能来自损失本身'), correct: true },
        { id: 'longer', label: t('Longer answers show the reasoning got stronger', '回答变长说明推理变强了'), misconception: 'longer-is-better' },
      ] },
      explain: t('See the evidence on the next page.', '证据见下一页。'),
    },
    {
      id: 'aha', kind: 'read', title: t('What the curves do and do not show', '曲线能说明什么，不能说明什么'),
      blocks: [
        fig('r1_zero_curves', t('R1-Zero during RL: accuracy rises, and so does answer length. Approximate readings, redrawn from the paper.', 'R1-Zero 的强化学习过程：准确率上升，回答长度也在上升。读数为近似值，按论文重绘。')),
        { type: 'p', text: t(
          'Both curves go up together, which makes "longer = smarter" tempting. Two findings warn against it. **The ability was already there:** the base model DeepSeek-V3-Base already shows "aha"-style self-reflection before any RL. **The loss pushes length:** GRPO\'s per-answer averaging punishes long wrong answers less (E1), which grows length, especially of wrong answers[^drgrpo].',
          '两条曲线一起往上走，很容易让人觉得"越长越聪明"。有两项发现提醒我们别这么想。**能力本来就在：**在做任何强化学习之前，基座模型 DeepSeek-V3-Base 就已经会"aha"式的自我反思。**损失在推长度：**GRPO 按回答平均损失，对又长又错的回答罚得更轻（E1），会把回答（尤其是错误回答）越推越长[^drgrpo]。',
        ) },
        { type: 'callout', kind: 'misconception', body: t('Length and reflection are symptoms, not evidence. Judge a run by held-out accuracy.', '长度和反思是现象，不是证据。判断一次训练好不好，要看留出集上的准确率。') },
        { type: 'cite', key: 'drgrpo', text: t('Liu et al. (2025). Understanding R1-Zero-Like Training (Dr. GRPO).', 'Liu 等（2025）。Understanding R1-Zero-Like Training（Dr. GRPO）。'), url: 'https://arxiv.org/abs/2503.20783' },
      ],
    },
    {
      id: 'r1-stages', kind: 'scene', title: t('R1: four stages, each fixing a problem', 'R1：四个阶段，各修一个问题'),
      scene: vis('r1_pipeline', { stage: 'all' }),
      narration: t(
        'R1 keeps R1-Zero\'s reinforcement learning but surrounds it. First, a cold start: fine-tune the base model on a few thousand readable long chains of thought, so RL starts from something that writes clearly. Second, the same reasoning RL, with an extra reward for staying in one language. Third, use that model to generate answers, keep only the correct and readable ones, about six hundred thousand, add two hundred thousand ordinary examples like writing and question answering, and fine-tune the base model again from scratch. Fourth, a last round of RL on everything: rules for reasoning, reward models for helpfulness and safety.',
        'R1 保留了 R1-Zero 的强化学习，但在前后都加了东西。第一步，冷启动：用几千条可读的长思维链微调基座模型，让强化学习从一个"会好好写字"的起点出发。第二步，同样的推理强化学习，再加一项"别混语言"的奖励。第三步，用这个模型生成答案，只留下正确又好读的，大约六十万条，再加上二十万条写作、问答之类的普通数据，从基座模型重新微调一遍。第四步，再做一轮覆盖所有场景的强化学习：推理题用规则奖励，有用和安全用奖励模型。',
      ),
    },
    {
      id: 'q-order', kind: 'checkpoint', skill: 'r1-pipeline', purpose: 'check', title: t('Why this order?', '为什么是这个顺序？'),
      prompt: t('Why must the rejection-sampling stage (3) come **after** the reasoning RL stage (2)?', '为什么拒绝采样阶段（第 3 步）必须放在推理强化学习（第 2 步）**之后**？'),
      question: { type: 'choice', options: [
        { id: 'source', label: t('Its 600k reasoning examples are sampled from the stage-2 model: it needs a model that already reasons well', '它那 60 万条推理数据是从第 2 步的模型里采出来的：需要一个已经很会推理的模型'), correct: true },
        { id: 'rule', label: t('Only because SFT must always come after RL', '只是因为 SFT 一定要放在强化学习之后'), feedback: t('Stage 1 is SFT before RL. The order follows where the data comes from.', '第 1 步就是放在强化学习之前的 SFT。顺序取决于数据从哪来。') },
        { id: 'pure', label: t('It does not matter; R1 is really pure RL', '无所谓；R1 其实就是纯强化学习'), misconception: 'r1-is-pure-rl', feedback: t('R1-Zero was pure RL. R1 has two SFT stages and two RL stages.', '纯强化学习的是 R1-Zero。R1 有两个 SFT 阶段、两个强化学习阶段。') },
      ] },
      explain: t('This is B2\'s rejection sampling: sample from the best model you have, keep what the grader accepts, and train on it.', '这就是 B2 讲过的拒绝采样：从手头最好的模型里采样，留下评分器认可的，再拿来训练。'),
    },
    {
      id: 'q-cold', kind: 'checkpoint', skill: 'r1-pipeline', purpose: 'check', title: t('Skip a stage', '跳过一步'),
      prompt: t('What would most likely happen if R1 skipped stage 1 (cold-start SFT)?', '如果 R1 跳过第 1 步（冷启动 SFT），最可能发生什么？'),
      question: { type: 'choice', options: [
        { id: 'zero', label: t('We would be back to R1-Zero\'s problems: hard-to-read answers, mixed languages, a shakier start', '回到 R1-Zero 的老问题：回答难读、中英混杂、起步不稳'), correct: true },
        { id: 'nothing', label: t('No reasoning at all', '完全不会推理'), feedback: t('R1-Zero shows reasoning does emerge without it; the cold start is about readability and a steadier start.', 'R1-Zero 证明了没有冷启动也能长出推理能力；冷启动解决的是可读性和起步稳定性。') },
        { id: 'better', label: t('Better accuracy, since SFT only hurts RL', '准确率更高，因为 SFT 只会拖累强化学习'), misconception: 'rl-strictly-better' },
      ] },
    },
    {
      id: 'recipes', kind: 'read', title: t('Recipes in 2026, and a small-team version', '2026 年的配方，以及小团队版'),
      blocks: [
        { type: 'p', text: t('The labs\' recipes vary, but the pieces are the same as R1\'s:', '各家实验室的配方各不相同，但零件和 R1 是同一套：'), },
        { type: 'list', items: [
          t('Qwen3: reasoning RL with GRPO, then a general RL stage with rule- and model-based rewards. OLMo 3 ends with RLVR. Llama 4: light SFT → online RL → light DPO[^adoption].', 'Qwen3：先用 GRPO 做推理强化学习，再做一轮通用强化学习，奖励既有规则也有模型。OLMo 3 以 RLVR 收尾。Llama 4：轻量 SFT → 在线强化学习 → 轻量 DPO[^adoption]。'),
          t('SFT is now mostly a cold start before RL or a consolidation step after it; mid-training is a standard stage; and specialists are combined by distillation (E3).', '如今 SFT 大多用作强化学习前的冷启动，或者事后的巩固；中期训练已是标准阶段；多个专家则靠蒸馏合到一起（E3）。'),
        ] },
        { type: 'h', level: 3, text: t('A version a small team can run', '小团队能跑的版本') },
        { type: 'list', ordered: true, items: [
          t('If a stronger teacher is available: SFT on its reasoning traces first (E3, lab L5). For small models this is usually the biggest win.', '如果有更强的老师：先用它的推理轨迹做 SFT（E3，实验 L5）。对小模型来说，这通常是收益最大的一步。'),
          t('If a program can check answers: GRPO/DAPO with E1\'s defaults (lab L4).', '如果有程序能检查答案：用 E1 的默认配置跑 GRPO/DAPO（实验 L4）。'),
          t('Optionally: rejection-sample from the RL model and SFT again (B2).', '可选：从强化学习后的模型做拒绝采样，再 SFT 一次（B2）。'),
          t('Measure pass@1 **and** pass@k at large k, with a gold set the training never sees.', '同时衡量 pass@1 **和**大 k 的 pass@k，并用一个训练看不到的金标准集。'),
        ] },
        { type: 'cite', key: 'adoption', text: t('research-adoption.md §4–5 (Qwen3, OLMo 3, Llama 4 reports).', 'research-adoption.md §4–5（Qwen3、OLMo 3、Llama 4 的报告）。'), url: 'https://arxiv.org/abs/2505.09388' },
      ],
    },
    // ------------------------------------------------------------------ which reward
    {
      id: 'prm', kind: 'read', chapter: t('Which reward', '用哪种奖励'), title: t('Grade the answer, or every step?', '给答案打分，还是给每一步打分？'),
      blocks: [
        { type: 'p', text: t(
          'An outcome reward grades only the final answer. A process reward model (PRM) grades every step of the reasoning. Grading steps sounds strictly better: it says *where* a solution went wrong. The evidence is more mixed:',
          '结果奖励只给最终答案打分；过程奖励模型（process reward model, PRM）给推理的每一步打分。给每一步打分听起来一定更好：它能说出解答*在哪里*出了错。但证据没那么一边倒：',
        ) },
        { type: 'table', head: [t('Use', '用途'), t('Evidence', '证据')], rows: [
          [t('Picking the best of many answers', '从很多个答案里挑最好的'), t('PRM wins: best-of-1860 on MATH, PRM 78.2% vs outcome RM 72.4% (PRM800K, 800k step labels)[^lightman]', 'PRM 更好：在 MATH 上从 1860 个答案里挑，PRM 78.2%，结果奖励模型 72.4%（PRM800K，80 万条逐步标注）[^lightman]')],
          [t('Labels without humans', '不用人工标注'), t('possible: Math-Shepherd builds step labels automatically[^shepherd]', '可以：Math-Shepherd 自动构造逐步标签[^shepherd]')],
          [t('Training with large-scale RL', '大规模强化学习训练'), t('R1 lists PRMs as an unsuccessful attempt: steps are hard to define, step labels are hard to get, and a learned PRM gets reward-hacked[^r1]', 'R1 把 PRM 列为"不成功的尝试"：步骤难以界定，逐步标签难拿，学出来的 PRM 会被钻空子[^r1]')],
        ] },
        { type: 'callout', kind: 'note', body: t('Practice today: outcome rewards (plus rubrics) for training; PRMs, if any, for reranking and search at test time.', '如今的做法：训练用结果奖励（加评分细则）；PRM 若要用，多用在测试时的重排和搜索上。') },
        { type: 'cite', key: 'lightman', text: t('Lightman et al. (2023). Let\'s Verify Step by Step.', 'Lightman 等（2023）。Let\'s Verify Step by Step。'), url: 'https://arxiv.org/abs/2305.20050' },
        { type: 'cite', key: 'shepherd', text: t('Wang et al. (2023). Math-Shepherd.', 'Wang 等（2023）。Math-Shepherd。'), url: 'https://arxiv.org/abs/2312.08935' },
        { type: 'cite', key: 'r1', text: t('DeepSeek-R1 v1, §4.2 Unsuccessful attempts.', 'DeepSeek-R1 v1，§4.2 不成功的尝试。'), url: 'https://arxiv.org/abs/2501.12948' },
      ],
    },
    // ------------------------------------------------------------------ measuring
    {
      id: 'derive-passk', kind: 'derive', chapter: t('Measuring: pass@k', '怎么衡量：pass@k'), skill: 'pass-at-k', title: t('pass@k, and how to estimate it', 'pass@k，以及怎么估计它'),
      intro: t(
        '"Better at maths" can mean two things: right more often on the **first** try (pass@1), or able to solve **more questions at all** if allowed several tries (pass@k for large k). To tell them apart we need pass@k, and a way to estimate it from a few samples.',
        '"数学变强了"可以有两种意思：**第一次**就做对的概率更高（pass@1）；或者允许多试几次时，**能做出来的题**更多（k 很大时的 pass@k）。要把两者分开，就得有 pass@k，还得能从有限的采样里把它估计出来。',
      ),
      lines: [
        { tex: '\\text{pass@}k = \\mathbb E_q\\big[1 - (1 - p_q)^k\\big]', why: t('k independent tries all fail with probability $(1-p_q)^k$; average over the questions.', 'k 次独立尝试全部失败的概率是 $(1-p_q)^k$；再对所有题取平均。') },
        { tex: '\\mathbb E\\Big[1 - \\big(1 - \\tfrac{c}{n}\\big)^k\\Big] \\le 1 - (1 - p)^k', why: t('We only see c right answers out of n samples. Plugging $\\hat p = c/n$ in underestimates: $1-(1-p)^k$ is concave, so by Jensen the average of $f(\\hat p)$ is at most $f(p)$.', '我们只看到 n 次采样里对了 c 次。直接代入 $\\hat p = c/n$ 会低估：$1-(1-p)^k$ 是凹函数，由 Jensen 不等式，$f(\\hat p)$ 的平均不超过 $f(p)$。') },
        { tex: '\\widehat{\\text{pass@}k} = 1 - \\binom{n-c}{k}\\Big/\\binom{n}{k}', why: t('The chance that k samples drawn without replacement from our n are all wrong. Its expectation is exactly $(1-p)^k$, so this is unbiased (Chen et al. 2021).', '从这 n 个样本里不放回地抽 k 个、全是错的概率。它的期望正好是 $(1-p)^k$，所以是无偏的（Chen 等，2021）。') },
        { tex: 'n = 16,\\ c = 2,\\ k = 4:\\quad 1 - \\tfrac{1001}{1820} = 0.45 \\quad \\Big(1 - \\big(\\tfrac{14}{16}\\big)^4 = 0.41\\Big)', why: t('With few samples the difference is real: the plug-in estimate (in brackets) gives only 0.41.', '样本少的时候，两者差得不少：括号里的代入估计只有 0.41。') },
        { tex: '\\text{maj@}k = \\Pr\\big[\\arg\\max_a \\#\\{j \\le k : a_j = a\\} = a^\\star\\big]', why: t('The most frequent of the k final answers is taken as the answer. Majority voting (cons@k) measures consistency. R1-Zero\'s 86.7% on AIME is cons@64; its pass@1 was 71.0%.', 'k 个最终答案里出现次数最多的那个当作答案。多数投票（cons@k）衡量的是一致性。R1-Zero 在 AIME 上的 86.7% 是 cons@64；它的 pass@1 是 71.0%。') },
      ],
      blank: { line: 0, answer: '1 - (1-p)^k', variables: ['p', 'k'], ranges: { p: [0.05, 0.95], k: [1, 6] }, prompt: t('Your turn: for one question with success rate p, the chance that at least one of k tries is right.', '轮到你：一道题成功率为 p，k 次尝试里至少对一次的概率是多少？') },
      outro: t('pass@1 measures how reliably the model finds a solution; pass@k at large k measures which questions it can solve at all.', 'pass@1 衡量模型找到解法有多稳；k 很大时的 pass@k 衡量它到底能解哪些题。'),
    },
    {
      id: 'q-passk', kind: 'checkpoint', skill: 'pass-at-k', purpose: 'check', title: t('Estimate it', '估一估'),
      prompt: t('16 samples per question; one question got 2 right. Its unbiased pass@4 estimate?', '每道题采样 16 次；某题对了 2 次。它的 pass@4 无偏估计是多少？'),
      question: { type: 'number', answer: 1 - 1001 / 1820, tolerance: 0.01, wrong: [{ answer: 0.414, feedback: t('That is the plug-in $1-(14/16)^4$, which is biased low.', '这是直接代入的 $1-(14/16)^4$，偏低。') }] },
      explain: t('$1 - \\binom{14}{4}/\\binom{16}{4} = 1 - 1001/1820 \\approx 0.45$.', '$1 - \\binom{14}{4}/\\binom{16}{4} = 1 - 1001/1820 \\approx 0.45$。'),
    },
    {
      id: 'tts', kind: 'read', title: t('More compute at test time, and noisy benchmarks', '测试时多花算力，以及有噪声的评测'),
      blocks: [
        { type: 'p', text: t(
          '**Test-time scaling** spends compute when answering instead of when training. In parallel: sample N answers and pick one with a grader (best-of-N) or by majority vote. In sequence: let the model think longer; s1\'s "budget forcing" appends "Wait" when the model tries to stop[^s1]. DeepSeekMath found RL improved majority voting but not pass@k[^dsm]: RL moves part of the benefit of "try several times and vote" into a single try.',
          '**测试时扩展**（test-time scaling）把算力花在回答的时候，而不是训练的时候。并行的做法：采 N 个答案，用评分器挑一个（best-of-N），或者多数投票。串行的做法：让模型想得更久；s1 的"预算强制"会在模型想停下时追加一个 "Wait"[^s1]。DeepSeekMath 发现，强化学习提升了多数投票的成绩，却没有提升 pass@k[^dsm]：强化学习把"多试几次再投票"的好处，部分搬进了一次作答里。',
        ) },
        { type: 'callout', kind: 'warning', title: t('AIME has 30 questions', 'AIME 只有 30 道题'), body: t(
          'One question is 3.3 points. At 70% accuracy the standard error is about $\\sqrt{0.7 \\cdot 0.3 / 30} \\approx 8$ points, so a 5-point gain on one run is within noise. Average over many samples per question, and report intervals (B3).',
          '一道题就是 3.3 分。正确率 70% 时，标准误约为 $\\sqrt{0.7 \\cdot 0.3 / 30} \\approx 8$ 分，所以一次跑出来涨 5 分还在噪声范围之内。每道题多采样几次取平均，并报告置信区间（B3）。',
        ) },
        { type: 'cite', key: 's1', text: t('Muennighoff et al. (2025). s1: Simple test-time scaling.', 'Muennighoff 等（2025）。s1: Simple test-time scaling。'), url: 'https://arxiv.org/abs/2501.19393' },
        { type: 'cite', key: 'dsm', text: t('Shao et al. (2024). DeepSeekMath.', 'Shao 等（2024）。DeepSeekMath。'), url: 'https://arxiv.org/abs/2402.03300' },
      ],
    },
    // ------------------------------------------------------------------ teach or elicit
    {
      id: 'p-sketch', kind: 'checkpoint', chapter: t('Does RL teach, or sharpen?', '强化学习是教会，还是磨尖？'), skill: 'rl-elicit-debate', purpose: 'predict', title: t('Draw it first', '先画出来'),
      prompt: t(
        'The dashed curve is pass@k of a base model. After RL its pass@1 is the blue dot. Draw pass@k of the RL model for k from 1 to 256 (log scale).',
        '虚线是基座模型的 pass@k。强化学习之后，它的 pass@1 是那个蓝点。画出强化学习之后模型的 pass@k，k 从 1 到 256（对数刻度）。',
      ),
      scene: vis('pass_k_sharpen', { mode: 'sketch', sharpen: 1 }),
      question: { type: 'sketch', f: (x) => pass_at_k(RL_SKETCH, 2 ** x), x_range: [0, 8], y_range: [0, 1], axes: (s: any) => s.ax, pass: 0.6 },
      explain: t('Many people draw a curve above the dashed one everywhere. The next world shows why the real one crosses it.', '很多人会画一条处处都在虚线上方的曲线。下一个世界会告诉你，真实的曲线为什么会和虚线交叉。'),
    },
    {
      id: 'w-passk', kind: 'explore', skill: 'rl-elicit-debate', title: t('Sharpen, then teach', '先磨尖，再教会'),
      scene: vis('pass_k_sharpen', {}),
      prompt: t(
        'Left: each question\'s success rate (grey = base, blue = after RL). Right: pass@k, computed from the bars. **1.** Drag the sharpening strength until pass@1 rises by at least 0.08, and watch pass@64. **2.** Keep the sharpening, and lift **at most 3** questions (drag a blue bar up) so that pass@64 after RL is back above the base model\'s.',
        '左边：每道题的正确率（灰框是基座，蓝柱是强化学习之后）。右边：由这些柱子算出的 pass@k。**1.** 拖动锐化强度，让 pass@1 至少提高 0.08，同时看 pass@64。**2.** 锐化保持不变，**最多抬高 3 道题**（把蓝柱往上拖），让强化学习之后的 pass@64 回到基座之上。',
      ),
      setup: world_setup(),
      goals: [
        { id: 'sharpened', check: (s: any) => s.pass(1, 'rl') - s.pass(1, 'base') >= 0.08, message: t('pass@1 is up, pass@64 is down: the curves cross. Sharpening moves probability within what the model could already solve.', 'pass@1 上去了，pass@64 下来了：两条曲线交叉了。锐化只是在模型本来就能解的题里搬动概率。') },
        { id: 'taught', check: (s: any) => s.pass(1, 'rl') - s.pass(1, 'base') >= 0.08 && s.pass(64, 'rl') >= s.pass(64, 'base') && s.taught() <= 3 && s.taught() >= 1, message: t('Only lifting questions it (almost) never solved raises the large-k end. That is what "teaching" looks like.', '只有抬高那些它（几乎）从来做不对的题，大 k 的那一端才会上去。这就是"教会"的样子。') },
      ],
      detectors: [
        { id: 'lift-easy', on: (e) => (e.type === 'teach' && (e.data!.base as number) >= 0.5 ? { kind: 'misconception', id: 'pass1-is-boundary', message: t('That question was already solved most of the time; with 64 tries it was solved anyway. Lifting it only changes pass@1.', '这道题本来大多数时候就能做对；试 64 次，早就做对过了。抬高它只改变 pass@1。') } : null) },
        { id: 'too-many', on: (e) => (e.type === 'teach' && (e.data!.taught as number) > 3 ? { kind: 'progress', id: 'too-many', message: t('More than 3 lifted. Which ones raise pass@64 the most?', '抬高的题超过 3 道了。哪些题对 pass@64 帮助最大？') } : null) },
      ],
      lines: [
        { text: t('Grey is the base model, blue is after RL. Start with the slider at the bottom.', '灰框是基座，蓝柱是强化学习之后。先拖底部的滑块。'), when: 'enter' },
        { text: t('Drag the sharpening slider.', '拖一下锐化强度的滑块。'), when: 'idle' },
        { text: t('That one was already solved with 64 tries. Look at the little circles instead.', '这道题试 64 次早就做对过了。看看那些小圆圈。'), when: { finding: 'pass1-is-boundary' } },
      ],
      solve: (s: any) => {
        s.s.set_value(1.2);
        let lifted = 0;
        s.base.forEach((p: number, q: number) => {
          if (p === 0 && lifted < 3) {
            s.teach[q].set_value(0.08);
            lifted++;
          }
        });
      },
    },
    {
      id: 'debate', kind: 'read', title: t('The evidence, both ways', '双方的证据'),
      blocks: [
        { type: 'p', text: t(
          'The world was a toy, labelled as such. Here is what real models show. It is an **open question**; read it as evidence, not a verdict.',
          '刚才的世界是玩具模型，画面上也标了。下面是真实模型上的结果。这是一个**开放问题**；当证据来读，不要当结论。',
        ) },
        fig('qwen3_distill_rl', t('Real data, Qwen3-8B: RL raised pass@1 but left pass@64 at 90.0; on-policy distillation raised both, with a tenth of the GPU hours.', '真实数据，Qwen3-8B：强化学习提高了 pass@1，pass@64 却停在 90.0；在线蒸馏两个都提高了，GPU 小时只用了十分之一。')),
        { type: 'table', head: [t('"RL mostly sharpens"', '"强化学习主要是在磨尖"'), t('"RL can teach"', '"强化学习能教会新东西"')], rows: [
          [t('Base models beat their RLVR versions at large k; RLVR stays within the base model\'s coverage, while distillation can add new patterns (Yue et al., NeurIPS 2025)[^yue]', '在 k 很大时，基座模型反而胜过它的 RLVR 版本；RLVR 能解的题没有超出基座的覆盖范围，而蒸馏能带来新的解题模式（Yue 等，NeurIPS 2025）[^yue]'), t('Prolonged RL with KL control and reference resets expands pass@k (ProRL)[^prorl]', '长时间强化学习，配合 KL 控制和参考模型重置，扩大了 pass@k（ProRL）[^prorl]')],
          [t('Random rewards gave Qwen2.5-Math-7B +21.4 on MATH-500 (true rewards: +29.1), but not Llama or OLMo[^spurious]', '随机奖励让 Qwen2.5-Math-7B 在 MATH-500 上涨了 21.4 分（真实奖励涨 29.1），但在 Llama 和 OLMo 上不成立[^spurious]'), t('On controlled tasks, RL adds real capability when tasks sit at the edge of the model\'s competence (up to +42% pass@128)[^edge]', '在可控的合成任务上，当题目恰好处在模型能力的边缘时，强化学习带来了真正的新能力（pass@128 最多 +42%）[^edge]')],
        ] },
        { type: 'callout', kind: 'open', title: t('What to do with an open question', '面对开放问题，该怎么做'), body: t(
          'Measure it on your own model: pass@k up to large k, and how many questions are solved at least once. If you need new capability, choose problems at the edge of competence, or get it from data: mid-training, SFT, distillation. And be wary of conclusions drawn from one model family.',
          '在自己的模型上测：一直测到很大的 k 的 pass@k，以及至少做对过一次的题有多少。想要新能力，就挑处在能力边缘的题，或者从数据里来：中期训练、SFT、蒸馏。另外，只在一个模型家族上得出的结论，要谨慎推广。',
        ) },
        { type: 'cite', key: 'yue', text: t('Yue et al. (2025). Does RL Really Incentivize Reasoning Capacity Beyond the Base Model?', 'Yue 等（2025）。Does RL Really Incentivize Reasoning Capacity Beyond the Base Model?'), url: 'https://arxiv.org/abs/2504.13837' },
        { type: 'cite', key: 'prorl', text: t('ProRL: Prolonged Reinforcement Learning (2025).', 'ProRL：Prolonged Reinforcement Learning（2025）。'), url: 'https://arxiv.org/abs/2505.24864' },
        { type: 'cite', key: 'spurious', text: t('Spurious Rewards: Rethinking Training Signals in RLVR (2025).', 'Spurious Rewards: Rethinking Training Signals in RLVR（2025）。'), url: 'https://arxiv.org/abs/2506.10947' },
        { type: 'cite', key: 'edge', text: t('Zhang, Neubig & Yue (2025). ICML 2026 spotlight.', 'Zhang、Neubig、Yue（2025）。ICML 2026 spotlight。'), url: 'https://arxiv.org/abs/2512.07783' },
      ],
    },
    {
      id: 'q-experiment', kind: 'checkpoint', skill: 'rl-elicit-debate', purpose: 'check', title: t('Design the test', '设计一个检验'),
      prompt: t('Your RL run raised pass@1 by 10 points. Describe how you would check whether it taught the model anything new.', '你的一次强化学习让 pass@1 涨了 10 分。说说你会怎么检验它有没有教会模型新东西。'),
      question: { type: 'text', placeholder: t('I would measure…', '我会测……'), rubric: {
        key_points: [
          t('Compare base and RL models on pass@k up to a large k (e.g. 64–256), with the unbiased estimator and many samples per question.', '在同一批题上比较基座和强化学习后的模型，pass@k 测到很大的 k（比如 64–256），用无偏估计，每道题多采样。'),
          t('Count the questions solved at least once (coverage): new capability means questions the base model never solved become solvable.', '统计至少做对过一次的题（覆盖率）：新能力意味着基座从来做不对的题变得能做对了。'),
          t('Use held-out questions and report the noise (intervals), so a small difference is not mistaken for an effect.', '用留出的题，并报告噪声（置信区间），别把小差别误当成效果。'),
        ],
        model_answer: t('Sample each held-out question many times with both models and compute pass@k from k = 1 to 256 with the unbiased estimator. If the RL curve is above at k = 1 but meets or falls below the base curve at large k, it sharpened; if it solves questions the base model never solved in 256 tries (higher coverage), it taught something. Report intervals.', '对留出的每道题，两个模型都采样很多次，用无偏估计算出 k 从 1 到 256 的 pass@k。如果强化学习的曲线在 k = 1 时更高，但在 k 很大时追平甚至低于基座，那就是磨尖；如果它能解出基座 256 次都做不对的题（覆盖率更高），才算教会了东西。同时报告置信区间。'),
        min_points: 2,
      } },
    },
    // ------------------------------------------------------------------ running it
    {
      id: 'rank1', kind: 'read', chapter: t('What it takes to run', '跑起来要注意什么'), title: t('Rank-1 LoRA is enough for RL', '强化学习用秩 1 的 LoRA 就够'),
      blocks: [
        { type: 'p', text: t(
          'Back to C2\'s idea of capacity versus information. In SFT every token of every example carries information to learn. In policy-gradient RL, each episode delivers one scalar (its advantage): roughly **one bit**. So RL needs far less adapter capacity, and Thinking Machines found that LoRA of rank 1 matches full fine-tuning for RL[^tm].',
          '回到 C2 讲过的"容量与信息量"。SFT 里，每个样本的每个 token 都带着要学的信息；策略梯度式的强化学习里，每条轨迹只送来一个标量（它的优势），大约**一比特**。所以强化学习需要的适配器容量小得多：Thinking Machines 发现，做强化学习时，秩为 1 的 LoRA 就能追平全量微调[^tm]。',
        ) },
        { type: 'p', text: t(
          'An order-of-magnitude check: rank-1 LoRA on all linear layers of Llama-3.1-8B has $1 \\times 81{,}920 \\times 32 \\approx 2.6$M parameters; at about 2 bits per parameter (a rough capacity estimate for neural networks in general, from Allen-Zhu and Li, not a measurement of LoRA) that holds about 5M bits. A run of 2,000 steps × 512 episodes is about a million episodes, at most a million bits. It fits.',
          '数量级估算：在 Llama-3.1-8B 的所有线性层上加秩 1 的 LoRA，参数量是 $1 \\times 81{,}920 \\times 32 \\approx 260$ 万；按每个参数约 2 比特（这是 Allen-Zhu 和 Li 对一般神经网络容量的粗略估计，不是对 LoRA 的实测），能装约 500 万比特。一次 2000 步 × 每步 512 条轨迹的训练，约 100 万条轨迹，最多 100 万比特。装得下。',
        ) },
        { type: 'p', text: t('In practice: use LoRA for GRPO (learning rate about 10× full fine-tuning), and a free T4 with 4-bit + LoRA can run GSM8K (lab L4).', '实际做法：GRPO 用 LoRA（学习率约为全量微调的 10 倍），免费的 T4 加 4 位量化和 LoRA 就能跑 GSM8K（实验 L4）。') },
        { type: 'cite', key: 'tm', text: t('Thinking Machines (2025). LoRA Without Regret.', 'Thinking Machines（2025）。LoRA Without Regret。'), url: 'https://thinkingmachines.ai/blog/lora/' },
      ],
    },
    {
      id: 'q-rank1', kind: 'checkpoint', skill: 'rl-engineering', purpose: 'check', title: t('Count the adapter', '数一数适配器'),
      prompt: t('Rank-1 LoRA on all linear layers of Llama-3.1-8B: each layer\'s linear layers have $\\sum(d_{in} + d_{out}) = 81{,}920$, and there are 32 layers. How many trainable parameters, in millions?', '在 Llama-3.1-8B 的所有线性层上加秩 1 的 LoRA：每层所有线性层的 $\\sum(d_{in} + d_{out}) = 81{,}920$，一共 32 层。可训练参数是多少（以百万计）？'),
      question: { type: 'number', answer: 2.62144, tolerance: 0.05, unit: t('million', '百万'), wrong: [{ answer: 41.94, feedback: t('That is rank 16. Divide by 16.', '这是秩 16 的值。除以 16。') }] },
    },
    {
      id: 'systems', kind: 'read', title: t('The two engines problem', '两个引擎的问题'),
      blocks: [
        { type: 'p', text: t(
          'With long chains of thought, generating the answers is often the slowest part, so RL frameworks hand generation to a fast inference engine (vLLM, SGLang) and training to a training framework. That split causes two problems a practitioner must know about:',
          '思维链很长时，生成回答往往是最慢的一环，所以强化学习框架把生成交给快速的推理引擎（vLLM、SGLang），把训练交给训练框架。这种拆分带来两个必须知道的问题：',
        ) },
        fig('rollout_timeline', t('Top: synchronous, each side waits. Middle: asynchronous, samples come from older weights. Right: same weights, different probabilities.', '上：同步，两边轮流空等。中：异步，样本来自旧权重。右：权重相同，概率却不同。')),
        { type: 'list', items: [
          t('**Stale samples.** Asynchronous rollouts (ScaleRL lets generation run 8 steps behind) keep the GPUs busy but make the samples off-policy, which is when E1\'s clipped ratio really matters.', '**样本过期。** 异步采样（ScaleRL 允许生成落后 8 步）让 GPU 一直有活干，但样本就成了离线（异策略）的，这正是 E1 的截断比率真正起作用的时候。'),
          t('**Mismatch.** Even with identical weights, the two engines compute slightly different token probabilities, so "on-policy" training is quietly off-policy, worse for long answers and MoE models. Fixes: truncated importance sampling (on by default in TRL 1.15), FP16, an FP32 LM head[^verl].', '**不一致。** 即使权重完全相同，两个引擎算出的 token 概率也略有不同，于是"在线"训练悄悄变成了离线的，回答越长、用 MoE 越严重。办法：截断重要性采样（TRL 1.15 默认开启）、改用 FP16、LM head 用 FP32[^verl]。'),
        ] },
        { type: 'details', summary: t('What to log in an RL run', '强化学习训练要记录什么'), blocks: [
          { type: 'list', items: [
            t('Reward, per component (correctness, format).', '奖励，按分项记录（正确性、格式）。'),
            t('Held-out pass@1, and pass@k at large k from time to time.', '留出集 pass@1，并定期测大 k 的 pass@k。'),
            t('`frac_reward_zero_std`, answer length (right and wrong separately), `completions/clipped_ratio`.', '`frac_reward_zero_std`、回答长度（对错分开）、`completions/clipped_ratio`。'),
            t('`entropy`, `clip_ratio/*`, `kl` (when β > 0), and `sampling/*` for the mismatch.', '`entropy`、`clip_ratio/*`、`kl`（β > 0 时）、反映不一致的 `sampling/*`。'),
          ] },
          { type: 'p', text: t('Tools: one GPU, Unsloth or TRL + PEFT; one machine, TRL (vLLM server mode) or OpenRLHF; large, asynchronous or agentic, verl, slime, prime-rl, SkyRL.', '工具：单卡用 Unsloth 或 TRL + PEFT；单机多卡用 TRL（vLLM server 模式）或 OpenRLHF；大规模、异步或智能体任务用 verl、slime、prime-rl、SkyRL。') },
        ] },
        { type: 'cite', key: 'verl', text: t('verl docs on rollout correction; the FP16 paper (2510.26788); ScaleRL (2510.13786).', 'verl 文档（rollout correction）；FP16 论文（2510.26788）；ScaleRL（2510.13786）。'), url: 'https://verl.readthedocs.io/en/latest/algo/rollout_corr.html' },
      ],
    },
    {
      id: 'agentic', kind: 'read', title: t('Agentic RL: the environment is the grader', '智能体强化学习：环境就是评分器'),
      blocks: [
        { type: 'p', text: t(
          'For an agent, one episode is a conversation with tools: the model acts, the environment answers, the model acts again. The reward comes from the environment itself, such as tests passing or a goal state being reached. Everything from E1 carries over, plus a few new things:',
          '对智能体来说，一条轨迹是一段和工具的对话：模型行动，环境回应，模型再行动。奖励来自环境本身，比如测试是否通过、目标状态是否达到。E1 的一切都还适用，另外多了几件事：',
        ) },
        fig('agentic', t('Only the model\'s own tokens are trained; what the environment returns is masked out of the loss, like the tool-call masking exercise in B2.', '只训练模型自己生成的 token；环境返回的内容从损失里掩掉，和 B2 里给工具调用对话标掩码的练习是一回事。')),
        { type: 'list', items: [
          t('Long episodes and slow environments, which need sandboxes.', '轨迹长，环境慢，还需要沙箱。'),
          t('Who does it: Kimi K2 (large-scale synthetic agent data, RLVR and a self-critique rubric reward), GLM-5 (reasoning, agentic and general RL stages)[^adoption]. Tools: SkyRL; TRL\'s GRPOTrainer supports tools and environments.', '谁在做：Kimi K2（大规模合成智能体数据、RLVR，外加自我批评的评分细则奖励）、GLM-5（推理、智能体、通用三段强化学习）[^adoption]。工具：SkyRL；TRL 的 GRPOTrainer 也支持工具和环境。'),
          t('How to start: SFT the tool-call format first (B2), get single-turn RLVR working, then go multi-turn.', '怎么起步：先用 SFT 教会工具调用的格式（B2），把单轮 RLVR 跑通，再上多轮。'),
        ] },
        { type: 'cite', key: 'adoption', text: t('research-adoption.md §4 and "What the course list misses" 7.', 'research-adoption.md §4 与"What the course list misses"第 7 条。'), url: 'https://arxiv.org/html/2507.20534v2' },
      ],
    },
    {
      id: 'q-mismatch', kind: 'checkpoint', chapter: t('Check and choose', '检验与选择'), skill: 'rl-engineering', purpose: 'check', title: t('Diagnose the crash', '诊断这次崩溃'),
      prompt: t(
        'After raising the answer limit from 2k to 8k tokens and turning off `vllm_importance_sampling_correction`, `sampling/importance_sampling_ratio/max` spikes, `entropy` collapses and the reward crashes. Most likely cause?',
        '把回答长度上限从 2k 提到 8k，又关掉了 `vllm_importance_sampling_correction` 之后，`sampling/importance_sampling_ratio/max` 不断出现尖峰，`entropy` 骤降，奖励崩了。最可能的原因是什么？',
      ),
      question: { type: 'choice', options: [
        { id: 'mismatch', label: t('The rollout engine and the trainer disagree on probabilities, worse for long answers, and nothing corrects it: turn TIS back on, consider FP16 or an FP32 LM head', '推理引擎和训练框架算出的概率不一致，回答越长越严重，又没有校正：重新打开 TIS，考虑 FP16 或 FP32 的 LM head'), correct: true },
        { id: 'lr', label: t('The learning rate is too high', '学习率太高'), feedback: t('Then why would the sampling ratio metrics spike?', '那 sampling 这组比率指标为什么会出现尖峰？') },
        { id: 'same', label: t('Impossible: both engines load the same weights', '不可能：两个引擎加载的是同一份权重'), misconception: 'same-weights-same-probs' },
        { id: 'zero', label: t('Too many zero-variance groups', '零方差组太多'), feedback: t('That stalls learning; it does not make the ratios explode.', '那会让学习停滞，不会让比率爆掉。') },
      ] },
    },
    {
      id: 'q-dsl', kind: 'checkpoint', skill: 'rl-elicit-debate', purpose: 'check', title: t('A new language', '一门新语言'),
      prompt: t(
        'A team wants a 7B model to write an internal DSL. The base model almost never writes a program that runs, even in 256 tries. They have 2,000 tasks with executable tests and one engineer who knows the DSL. First step?',
        '一个团队想让 7B 模型学会写公司内部的 DSL。基座模型采样 256 次，几乎写不出一个能运行的程序。手上有 2000 道带可执行测试的题，还有一位会写这门 DSL 的工程师。第一步做什么？',
      ),
      question: { type: 'choice', options: [
        { id: 'sft', label: t('Get demonstrations (written by the engineer, or generated and filtered by the tests), SFT until pass@k is clearly above 0, then RLVR', '先拿到示范（工程师写，或者用强模型生成、再用测试过滤），做 SFT，直到 pass@k 明显大于 0，再上 RLVR'), correct: true },
        { id: 'grpo', label: t('GRPO straight away: the tests are a perfect verifier', '直接上 GRPO：测试就是完美的验证器'), misconception: 'rl-strictly-better', feedback: t('With pass@256 near 0, nearly every group is all wrong: no signal.', 'pass@256 接近 0，几乎每一组都全错：没有信号。') },
        { id: 'prm', label: t('Train a process reward model', '训练一个过程奖励模型'), misconception: 'prm-always-better' },
        { id: 'bon', label: t('Best-of-256 at inference', '推理时 best-of-256'), feedback: t('Best-of-N cannot pick a correct program that is never generated.', 'best-of-N 挑不出一个从来没生成过的正确程序。') },
      ] },
    },
    {
      id: 'choose', kind: 'read', title: t('How to choose (E2)', '怎么选（E2）'),
      blocks: choose_card({
        upto: 'E2', highlight: 'C2,C3', card: 'E2',
        rules: [
          t('Default order for a reasoning model: SFT first (a cold start, or distillation if you have a teacher) → RLVR → optionally rejection sampling + SFT → another round of RL. For small models, distil first (E3).', '推理模型的默认顺序：先 SFT（冷启动；有老师就蒸馏）→ RLVR →（可选）拒绝采样后再 SFT → 再一轮强化学习。小模型先考虑蒸馏（E3）。'),
          t('Report pass@1, pass@k at large k, and intervals. If the application allows several tries and has a verifier (code with tests), try best-of-N first: maybe no training is needed.', '同时报告 pass@1、大 k 的 pass@k 和置信区间。如果应用允许多次尝试、又有验证器（比如代码有测试），先试 best-of-N：可能根本不用训练。'),
          t('Train with outcome rewards (plus rubrics); keep PRMs for reranking at test time.', '训练用结果奖励（加评分细则）；过程奖励模型留给测试时做重排。'),
          t('Agents: SFT the tool format, then single-turn RLVR, then multi-turn.', '智能体：先 SFT 工具格式，再单轮 RLVR，最后多轮。'),
        ],
        counter: [
          t('The capability is missing (pass@k ≈ 0 even at large k) and you start with RL. Get it from data first: mid-training, SFT, distillation, or problems at the edge of competence.', '能力根本不存在（k 很大时 pass@k 也约等于 0），却直接上强化学习。应该先从数据里来：中期训练、SFT、蒸馏，或者挑处在能力边缘的题。'),
          t('Training reward up, held-out flat: check the grader and the engine mismatch before changing the algorithm.', '训练奖励在涨、留出集不涨：先查评分器和引擎不一致，别急着换算法。'),
        ],
      }),
    },
  ],
};
