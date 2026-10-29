// D2a From policy gradient to PPO.
// The learner knows neural networks but not RL. Purpose first (we have a
// scorer; how do we make the model produce what it likes, when sampling is not
// differentiable?), then REINFORCE as "SFT on your own samples, weighted by
// reward", the baseline (a sketch, a scene, one handle), then PPO's ratio and
// clipping (one world). PPO is taught as the bridge to GRPO (E1), not as
// current practice (research-adoption §9).
import type { Lesson } from '@mathnim/core';
import { choose_card, cite, details, list, math, note, p, t, table, text_q, vis, world_setup } from './common';

/** The variance-minimising baseline of the pg_baseline toy (rewards 2, 5, 9, uniform policy): the mean reward. */
const PG_BEST = 16 / 3;
/** Its variance as a function of b: Var(b*) + (2/3)(b − b*)² (exact for this toy). */
const pg_variance = (b: number) => 2.7407 + (2 / 3) * (b - PG_BEST) ** 2;

export const lesson: Lesson = {
  id: 'ft-d2a',
  title: t('From policy gradient to PPO', '从策略梯度到 PPO'),
  description: t(
    'How to train a model on a score you cannot differentiate: REINFORCE, the baseline, and PPO’s ratio and clipping - the pieces GRPO is built from.',
    '怎样用一个不能求导的分数训练模型：REINFORCE、基线，以及 PPO 的概率比和截断——GRPO 正是用这几块搭起来的。',
  ),
  mode: 'essay',
  skills: [
    { id: 'policy-gradient', name: t('The policy gradient', '策略梯度') },
    { id: 'baseline-advantage', name: t('Baselines and advantages', '基线与优势'), prerequisites: ['policy-gradient'] },
    { id: 'ppo-clip', name: t('PPO’s ratio and clipping', 'PPO 的概率比与截断'), prerequisites: ['baseline-advantage'] },
  ],
  misconceptions: [
    { id: 'pg-needs-diff-reward', description: t('The reward must be differentiable to train on it.', '奖励必须可微，才能拿来训练。') },
    { id: 'pg-loss-meaningful', description: t('A falling policy-gradient loss means the model is learning.', '策略梯度的损失在下降，说明模型在学。') },
    { id: 'baseline-changes-objective', description: t('Subtracting a baseline changes what the model learns.', '减去基线会改变模型学到的东西。') },
    { id: 'clip-misread', description: t('Clipping blocks every large change of a token’s probability.', '截断会挡住 token 概率的一切大变化。') },
  ],
  steps: [
    // ---------------------------------------------------------------- 1. the problem
    {
      id: 'why', kind: 'read', chapter: t('The problem', '问题在哪'), title: t('A score you cannot backpropagate through', '一个没法反向传播的分数'),
      blocks: [
        p('D1 gave us a way to score answers: a reward model, a judge, or a program. Now we want the model to produce answers that score well. The simplest use of a scorer needs no training at all: **best-of-n** - sample n answers, keep the best. It works, but every request now costs n generations. We would rather bake the preference into the weights.',
          'D1 给了我们给回答打分的办法：奖励模型、评委或者程序。现在想让模型写出高分的回答。用打分器最简单的办法根本不用训练：**最佳 n 选 1**（best-of-n）——采 n 个回答，留下最好的。它管用，但每次请求都要生成 n 遍。我们更想把这种偏好"烧进"权重里。'),
        p('Here is the snag. In SFT the target is a fixed answer, so the loss is a function of the weights. Here the answer is **sampled** token by token, and only then scored. Sampling is a discrete choice: there is no gradient from the score back through "which token was picked" to the weights.',
          '麻烦在这里。SFT 的目标是一个固定的回答，所以损失是权重的函数。这里的回答是一个 token 一个 token **采样**出来的，写完才打分。采样是离散的选择："选了哪个 token"这一步没有梯度，分数没法沿它传回权重。'),
        p('Reinforcement learning solves exactly this problem. You only need four of its words:', '强化学习解决的正是这个问题。你只需要它的四个词：'),
        table([['RL word', 'RL 术语'], ['For a language model', '在语言模型里']], [
          [['policy π_θ', '策略 π_θ'], ['the model: a distribution over the next token, and so over whole answers', '模型本身：下一个 token 的分布，进而是整条回答的分布']],
          [['action', '动作'], ['the next token', '下一个 token']],
          [['episode', '回合'], ['one answer to one prompt', '对一个提示写出的一条回答']],
          [['reward R', '奖励 R'], ['the score of the finished answer', '写完的回答得到的分数']],
        ]),
        note('Today most labs use GRPO-style methods (E1) rather than PPO with a value model: on the Hugging Face Hub about 900 models carry the trl+ppo tag against about 14,000 for trl+grpo, and no managed service offers PPO. We still build PPO here, because GRPO is made of exactly the pieces below: the policy gradient, a baseline, a probability ratio and clipping.',
          '如今大多数实验室用的是 GRPO 一类的方法（E1），而不是带价值模型的 PPO：Hugging Face Hub 上带 trl+ppo 标签的模型约 900 个，trl+grpo 约 14,000 个，也没有托管服务提供 PPO。这里仍然要把 PPO 搭出来，因为 GRPO 用的正是下面这几块：策略梯度、基线、概率比和截断。', ['Why learn PPO at all', '为什么还要学 PPO']),
      ],
    },
    {
      id: 'why-q', kind: 'checkpoint', skill: 'policy-gradient', purpose: 'predict', title: t('Can we just backpropagate?', '能直接反向传播吗？'),
      prompt: t('A reward model scores the model’s sampled answer. Can you backpropagate that score into the policy’s weights, the way SFT backpropagates its loss?', '奖励模型给模型采样出的回答打了分。能像 SFT 反向传播损失那样，把这个分数直接反向传播到策略的权重上吗？'),
      question: {
        type: 'choice', options: [
          { id: 'a', label: t('Yes, the reward model is a neural network, so it is differentiable', '能，奖励模型是神经网络，可微') },
          { id: 'b', label: t('No: the answer was sampled, and sampling a token has no gradient', '不能：回答是采样出来的，采样 token 这一步没有梯度'), correct: true },
          { id: 'c', label: t('No, because the reward model is frozen', '不能，因为奖励模型被冻结了'), misconception: 'pg-needs-diff-reward', feedback: t('Frozen only means we do not update it. Even a differentiable scorer cannot pass a gradient through the discrete choice of tokens.', '冻结只是说不更新它。即使打分器本身可微，梯度也穿不过"选哪个 token"这个离散的选择。') },
        ],
      },
      attempts: 1,
    },

    // ---------------------------------------------------------------- 2. REINFORCE
    {
      id: 'pg-idea', kind: 'read', chapter: t('REINFORCE', 'REINFORCE'), title: t('Try, score, make the good ones more likely', '试、打分、让好的更可能出现'),
      blocks: [
        p('The idea is simple enough to say in one line: **sample some answers, then raise the probability of each one in proportion to its reward.** Raising the probability of a given answer is something we already know how to do - it is exactly what SFT does to its target. So REINFORCE is SFT on the model’s own samples, with each sample weighted by its reward.',
          '思路一句话就能说完：**采几条回答，再按各自的奖励，把每条回答的概率往上提。** "提高某条回答的概率"我们早就会了，SFT 对它的目标回答做的就是这件事。所以 REINFORCE 就是：在模型自己采样出的回答上做 SFT，每条回答按它的奖励加权。'),
        p('Why is that allowed, when the score has no gradient? The trick is that we never differentiate the reward. We differentiate log π(y), the log-probability of an answer we already have, and use the reward only as a weight. The derivation on the next page makes this exact.',
          '分数明明没有梯度，为什么可以这样做？窍门在于：我们从来不对奖励求导。我们求导的是 log π(y)——一条已经写好的回答的对数概率，奖励只当作权重。下一页的推导把这一点说清楚。'),
      ],
    },
    {
      id: 'pg-derive', kind: 'derive', skill: 'policy-gradient', title: t('The policy gradient', '策略梯度'),
      intro: t('Fix one prompt x. The model samples an answer y ~ π_θ(·|x) and gets a reward R(y) from a reward model, a judge or a program. We want to raise the expected reward J(θ).', '固定一个提示 x。模型采样一条回答 y ~ π_θ(·|x)，从奖励模型、评委或程序那里得到奖励 R(y)。我们想提高期望奖励 J(θ)。'),
      lines: [
        { tex: 'J(\\theta) = \\mathbb E_{y\\sim\\pi_\\theta}[R(y)] = \\sum_y \\pi_\\theta(y)\\,R(y)', why: t('The definition of an expectation. The sum runs over every possible answer - astronomically many, but we will never enumerate it.', '期望的定义。求和遍历所有可能的回答，项数是天文数字，但我们永远不会真的去枚举。') },
        { tex: '\\nabla_\\theta J = \\sum_y R(y)\\,\\nabla_\\theta \\pi_\\theta(y)', why: t('R does not depend on θ (the scorer is fixed, or a program), so the gradient only goes through the probability. We never differentiate R - it may be any function at all.', 'R 不依赖 θ（打分器是固定的，或者干脆是一段程序），梯度只经过概率。我们从不对 R 求导，所以它可以是任何函数。') },
        { tex: '\\nabla_\\theta \\pi_\\theta(y) = \\pi_\\theta(y)\\,\\nabla_\\theta \\log \\pi_\\theta(y)', why: t('The log-derivative trick: the chain rule ∇log π = ∇π/π, rearranged.', '对数导数技巧：链式法则 ∇log π = ∇π/π 移项即得。') },
        { tex: '\\nabla_\\theta J = \\mathbb E_{y\\sim\\pi_\\theta}\\big[R(y)\\,\\nabla_\\theta \\log\\pi_\\theta(y)\\big]', why: t('A π_θ(y) appeared again, so the sum is an expectation under the policy again: we can estimate it by sampling.', '式子里又出现了 π_θ(y)，于是它重新变回"在策略下的期望"：可以用采样来估计。') },
        { tex: '\\hat g = \\frac1N\\sum_{i=1}^N R(y_i)\\,\\nabla_\\theta \\log\\pi_\\theta(y_i), \\quad y_i \\sim \\pi_\\theta', why: t('Replace the expectation by an average over N samples: an unbiased estimate. This is REINFORCE (Williams, 1992).', '用 N 个样本的平均代替期望，这个估计是无偏的。这就是 REINFORCE（Williams，1992）。') },
        { tex: '\\log\\pi_\\theta(y) = \\sum_t \\log\\pi_\\theta(y_t \\mid x, y_{<t})', why: t('An answer’s log-probability is the sum of its tokens’ log-probabilities. So ĝ is the gradient of the SFT log-likelihood of the sampled answers, each multiplied by its reward: SFT on your own samples, weighted by reward.', '一条回答的对数概率等于各 token 对数概率之和。所以 ĝ 正是"采样出的回答的 SFT 对数似然"的梯度，只是每条回答乘上了它的奖励：在自己的样本上、按奖励加权的 SFT。') },
      ],
      outro: t('Nothing in the update needs R to be differentiable: it only multiplies a gradient we already know how to compute.', '整个更新里，R 不需要可微：它只是去乘一个我们本来就会算的梯度。'),
    },
    {
      id: 'pg-code', kind: 'code', title: t('REINFORCE in twenty lines', '二十行写完 REINFORCE'), lang: 'python',
      intro: t('A toy: six fixed answers with fixed rewards, a softmax policy over them. Swap the six logits for a language model and log π for a sum of token log-probabilities, and nothing else changes.', '一个玩具：六个固定的回答，各有固定的奖励，策略是它们上面的 softmax。把六个 logit 换成语言模型、把 log π 换成各 token 对数概率之和，其余一行都不用改。'),
      code: `rewards = torch.tensor([9.0, 9.5, 10.0, 10.5, 11.0, 12.0])  # all positive
logits = torch.zeros(6, requires_grad=True)                  # the policy
opt = torch.optim.SGD([logits], lr=0.05)

def pg_step(n=16, use_baseline=True):
    probs = F.softmax(logits, -1)
    y = torch.multinomial(probs, n, replacement=True)        # sample n answers
    R = rewards[y]                                           # score them
    A = R - R.mean() if use_baseline else R                  # advantage
    logp = F.log_softmax(logits, -1)[y]                      # log π(y)
    loss = -(A.detach() * logp).mean()                       # weighted "SFT"
    opt.zero_grad(); loss.backward(); opt.step()
    return R.mean().item()                                   # watch the reward

for step in range(300):
    pg_step()          # after 300 steps the best answer has probability ≈ 0.94`,
      notes: [
        { lines: [1, 3], text: t('The policy is a softmax over six answers. All rewards are positive - remember that for the baseline.', '策略是六个回答上的 softmax。奖励全是正的——讲基线时会用到这一点。') },
        { lines: [6, 8], text: t('Sample, then score. The reward is just numbers looked up after sampling: no gradient through it.', '先采样，再打分。奖励只是采样之后查出来的数，没有梯度经过它。'), shapes: 'y: [16], R: [16]' },
        { lines: [9, 11], text: t('`A.detach()`: the weight is a constant. The loss is the SFT loss of the samples, times their advantage.', '`A.detach()`：权重是常数。损失就是这些样本的 SFT 损失乘上各自的优势。'), shapes: 'logp: [16]' },
        { lines: [13, 13], text: t('Watch the reward, not this loss: the loss depends on which answers happened to be sampled, so its value means nothing on its own.', '要看的是奖励，不是这个损失：损失取决于这一批恰好采到了哪些回答，它的数值本身没有意义。') },
      ],
    },

    // ---------------------------------------------------------------- 3. the baseline
    {
      id: 'baseline-why', kind: 'read', chapter: t('The baseline', '基线'), title: t('Every answer gets pushed up', '每个回答都被往上推'),
      blocks: [
        p('Look at the toy again: every reward is positive. Whatever answer is sampled, REINFORCE raises its probability; good answers are only raised *a bit more* than bad ones. The signal hides in small differences between large numbers, so the estimate is very noisy and needs many samples to average out.',
          '再看那个玩具：奖励全是正的。不管采到哪个回答，REINFORCE 都会提高它的概率，好回答只是被提得"多一点"。信号藏在大数之间的小差别里，所以估计非常吵，要很多样本才能平均出来。'),
        p('The fix: measure each reward against a zero line b, and push by **R − b** instead. Better than b goes up, worse than b goes down. The natural worry: does moving the zero line change what the model learns? Make a prediction first.',
          '办法是：给奖励画一条零线 b，按 **R − b** 去推。比 b 好的往上，比 b 差的往下。很自然的担心是：挪动零线，会不会改变模型学到的东西？先做个预测。'),
      ],
    },
    {
      id: 'baseline-sketch', kind: 'checkpoint', skill: 'baseline-advantage', purpose: 'predict', title: t('Sketch the noise', '画出噪声'),
      prompt: t('Three answers with rewards 2, 5 and 9, equally likely. Each sample gives a one-sample update $(R - b)\\,\\nabla \\log \\pi$. Sketch how the **variance** of that update changes as the zero line b goes from 0 to 12.', '三个回答，奖励分别是 2、5、9，被采到的概率相同。每采一个样本，就得到一个单样本更新 $(R - b)\\,\\nabla \\log \\pi$。画出这个更新的**方差**怎样随零线 b 从 0 变到 12 而变化。'),
      question: { type: 'sketch', f: (b: number) => pg_variance(b), x_range: [0, 12], y_range: [0, 35] },
      explain: t('A U-shape with its bottom at the mean reward (5.33): too low or too high a baseline both add noise. The scene shows why.', 'U 形，最低点在平均奖励 5.33 处：基线太低或太高都会增加噪声。下面的场景会说明为什么。'),
      reveal: 'baseline-scene',
      attempts: 1,
    },
    {
      id: 'baseline-scene', kind: 'scene', title: t('The mean stays, the spread changes', '均值不动，散布在变'), scene: vis('pg_baseline'),
      narration: t(
        'Three answers with rewards two, five and nine. § Each possible sample gives a different update; for three answers each update is a point in a plane. § The gold arrow is their average, the true gradient. § Now move the zero line. The points slide in and out, but the gold arrow never moves. § Only the spread changes, and it is smallest when the zero line sits at the mean reward.',
        '三个回答，奖励分别是二、五、九。§采到不同的回答，就得到不同的更新；只有三个回答时，每个更新都是平面上的一个点。§金色箭头是它们的平均，也就是真正的梯度。§现在挪动零线。几个点忽远忽近，金色箭头却纹丝不动。§变的只是散布，零线停在平均奖励时，散布最小。'),
    },
    {
      id: 'baseline-world', kind: 'explore', title: t('Find the quietest zero line', '找到最安静的零线'), skill: 'baseline-advantage',
      scene: vis('pg_baseline', { story: 'setup' }),
      prompt: t('Drag the zero line **b**. Watch the gold arrow (the average update) and the red trace of the variance. Leave b where the updates are **least noisy**.', '拖动零线 **b**。盯住金色箭头（平均更新）和红色的方差轨迹。把 b 停在更新**最不吵**的地方。'),
      setup: world_setup('pg_baseline', { story: 'setup' }),
      goals: [{ id: 'quiet', check: (_s, _c, w) => Math.abs(((w.state.b as number) ?? -9) - PG_BEST) <= 0.3, message: t('b ≈ 5.33, the mean reward: the variance is smallest there, and the gold arrow is exactly where it was at b = 0.', 'b ≈ 5.33，正是平均奖励：方差在这里最小，而金色箭头和 b = 0 时一模一样。') }],
      detectors: [
        {
          id: 'too-high', on: (e, w) => {
            if (e.type !== 'released') return null;
            w.state.b = e.data?.b;
            return (e.data?.b as number) >= 9 ? { kind: 'misconception', id: 'baseline-changes-objective' } : null;
          },
        },
      ],
      lines: [
        { text: t('The gold arrow is the average update. Keep an eye on it while you move the line.', '金色箭头是平均更新。挪动零线的时候，盯住它。'), when: 'enter' },
        { text: t('Drag the gold line on the left up and down.', '上下拖动左边那条金色的线。'), when: 'idle' },
        { text: t('Now every answer is pushed down, yet the gold arrow has not moved. The expected update is the same; only the noise grew.', '现在三个回答都被往下压，可金色箭头一点没动。期望的更新没变，变大的只是噪声。'), when: { finding: 'baseline-changes-objective' } },
        { text: t('Same direction on average, far less noise. That is what a baseline buys.', '平均方向不变，噪声小得多。基线买到的就是这个。'), when: 'goal' },
      ],
      hints: [t('Watch the red trace under the plane: find the bottom of the curve you are drawing.', '看平面下方的红色轨迹：找到你画出的那条曲线的最低点。')],
      solve: (s: any) => {
        s.b.set_value(PG_BEST);
        s.emit('released', { b: PG_BEST, variance: s.variance() });
      },
    },
    {
      id: 'baseline-derive', kind: 'derive', skill: 'baseline-advantage', title: t('Why the mean does not move', '为什么均值不动'),
      intro: t('Take any b that does not depend on the sampled answer y.', '取任意一个不依赖于采样回答 y 的 b。'),
      lines: [
        { tex: '\\mathbb E_{y\\sim\\pi}\\big[b\\,\\nabla\\log\\pi(y)\\big] = b\\sum_y \\nabla\\pi(y) = b\\,\\nabla \\sum_y \\pi(y)', why: t('Use π·∇log π = ∇π again, then swap the sum and the gradient.', '再用一次 π·∇log π = ∇π，然后交换求和与求导。') },
        { tex: '\\sum_y \\pi(y) = 1', why: t('Probabilities always sum to one, whatever θ is.', '概率之和恒为 1，不管 θ 是多少。') },
        { tex: '\\Rightarrow\\; \\mathbb E\\big[b\\,\\nabla\\log\\pi(y)\\big] = b\\,\\nabla 1 = 0', why: t('The gradient of a constant is zero: the baseline term adds nothing on average.', '常数的梯度为零：基线这一项平均下来什么也不加。') },
        { tex: '\\nabla J = \\mathbb E\\big[(R(y) - b)\\,\\nabla\\log\\pi(y)\\big]', why: t('Subtracting something with zero mean keeps the expectation - but not the variance, which contains (R − b)². That is the trade the scene showed.', '减去一个均值为零的东西，期望不变——方差却变了，因为方差里有 (R − b)²。这正是场景里看到的。') },
        { tex: 'A(x, y) = R(x, y) - b(x)', why: t('This difference is called the advantage: how much better than usual this answer was. b may depend on the prompt, never on the answer.', '这个差叫优势（advantage）：这条回答比"通常"好多少。b 可以依赖提示，但不能依赖回答本身。') },
      ],
      blank: { line: 1, answer: '1', prompt: t('$\\sum_y \\pi(y) = \\,?$', '$\\sum_y \\pi(y) = \\,?$') },
    },
    {
      id: 'two-q1', kind: 'checkpoint', skill: 'baseline-advantage', purpose: 'check', title: t('Two actions, by hand', '两个动作，手算'),
      prompt: t('A policy picks between two answers with probability ½ each; $\\nabla_\\theta \\log \\pi$ is +0.5 for the first and −0.5 for the second; their rewards are 11 and 10. Without a baseline, a one-sample estimate is either 11·0.5 = 5.5 or 10·(−0.5) = −5. What is its **variance**?', '一个策略在两个回答之间各以 ½ 的概率选择；$\\nabla_\\theta \\log \\pi$ 对第一个是 +0.5，对第二个是 −0.5；奖励分别是 11 和 10。不用基线时，单样本估计要么是 11·0.5 = 5.5，要么是 10·(−0.5) = −5。它的**方差**是多少？'),
      question: { type: 'number', answer: 27.5625, rtol: 0.02, wrong: [{ answer: 27.625, feedback: t('That is $\\mathbb{E}[g^2]$. Subtract the square of the mean, 0.25² = 0.0625.', '这是 $\\mathbb{E}[g^2]$，还要减去均值的平方 0.25² = 0.0625。') }] },
      hints: [t('The mean is ½·5.5 + ½·(−5) = 0.25.', '均值是 ½·5.5 + ½·(−5) = 0.25。')],
      explain: t('Mean 0.25, variance ½(5.5 − 0.25)² + ½(−5 − 0.25)² ≈ 27.56: the noise is a hundred times the signal.', '均值 0.25，方差 ½(5.5 − 0.25)² + ½(−5 − 0.25)² ≈ 27.56：噪声是信号的一百多倍。'),
    },
    {
      id: 'two-q2', kind: 'checkpoint', skill: 'baseline-advantage', purpose: 'check', title: t('Now with b = 10.5', '现在用 b = 10.5'),
      prompt: t('Same policy, now with the baseline b = 10.5 (the mean reward). What is the variance of the one-sample estimate now?', '同一个策略，现在用基线 b = 10.5（平均奖励）。单样本估计的方差现在是多少？'),
      question: { type: 'number', answer: 0, tolerance: 0.001 },
      explain: t('(11 − 10.5)·0.5 = 0.25 and (10 − 10.5)·(−0.5) = 0.25: both samples give exactly the true gradient. Without the baseline you would need about 441 samples for a standard error of 0.25.', '(11 − 10.5)·0.5 = 0.25，(10 − 10.5)·(−0.5) = 0.25：两种样本给出的都正好是真梯度。不用基线的话，要把标准误降到 0.25，大约需要 441 个样本。'),
    },
    {
      id: 'where-b', kind: 'read', title: t('Where the baseline comes from', '基线从哪来'),
      blocks: [
        p('Any b(x) that ignores the answer is allowed. Three choices are used in practice:', '只要 b(x) 不看回答本身，都可以。实践中用三种：'),
        list([
          ['**A value model** V(x) that predicts the expected reward. This is PPO’s choice: a second network the size of the policy, trained alongside it.', '**价值模型** V(x)，预测期望奖励。这是 PPO 的选择：再训练一个和策略一样大的网络。'],
          ['**The other samples of the same prompt.** Sample several answers per prompt and use their mean (RLOO uses the mean of the others; GRPO also divides by their standard deviation - E1). No extra network.', '**同一个提示下的其他样本**：每个提示采几条回答，用它们的平均做基线（RLOO 用"其他样本"的平均；GRPO 还要除以标准差——见 E1）。不需要额外的网络。'],
          ['**A running average** of recent rewards: the cheapest, and the noisiest.', '**最近奖励的滑动平均**：最便宜，也最吵。'],
        ]),
        details(['PPO’s per-token advantage (GAE)', 'PPO 的逐 token 优势（GAE）'], [
          p('PPO asks the value model for V(s_t) at every prefix s_t and spreads the final reward over tokens with generalized advantage estimation[^gae]; in language models γ = 1 is common:', 'PPO 让价值模型对每个前缀 s_t 给出 V(s_t)，再用广义优势估计（GAE）把最终奖励分摊到各个 token 上[^gae]；语言模型里常取 γ = 1：'),
          math('\\delta_t = r_t + \\gamma V(s_{t+1}) - V(s_t), \\qquad \\hat A_t = \\sum_{l\\ge 0} (\\gamma\\lambda)^l\\, \\delta_{t+l}'),
          p('This is the part the field later dropped: GRPO replaces the value model with the group mean.', '这正是后来被去掉的那一部分：GRPO 用组内均值取代了价值模型。'),
        ]),
        cite('gae', 'Schulman et al. 2015', 'High-Dimensional Continuous Control Using Generalized Advantage Estimation', 'https://arxiv.org/abs/1506.02438'),
      ],
    },

    // ---------------------------------------------------------------- 4. PPO
    {
      id: 'ppo-why', kind: 'read', chapter: t('PPO: reuse samples, but not too far', 'PPO：样本要复用，但别走太远'), title: t('Why a ratio, and why a clip', '为什么要概率比，为什么要截断'),
      blocks: [
        p('Generating answers is the slowest part of RL for language models. So we want to take **several** gradient steps on one batch of samples. After the first step, though, the samples come from the old policy π_old, not the current π_θ - the policy gradient formula no longer applies as is.',
          '对语言模型做强化学习，最慢的一环是生成回答。所以我们想在同一批样本上走**好几步**梯度。可走完第一步，样本就来自旧策略 π_old，而不是当前的 π_θ 了——策略梯度的公式不能直接用。'),
        p('Two ideas fix it. **Importance weighting**: reweight each old sample by ρ = π_θ/π_old, how much more (or less) likely the current policy makes it. **Clipping**: once ρ has moved more than ε away from 1 in the direction the advantage wants, stop pushing - the old samples are no longer trustworthy that far from where they were drawn.',
          '两个办法。**重要性加权**：给每个旧样本乘上 ρ = π_θ/π_old，也就是当前策略让它变得多可能（或少可能）了多少。**截断**：一旦 ρ 朝优势想要的方向偏离 1 超过 ε，就别再推了——离采样的地方那么远，旧样本已经不可信。'),
        p('Why not just take small steps? You could, but the right step size differs from token to token. Clipping limits the change of each token’s probability directly, which is what we actually care about.',
          '为什么不干脆把步子迈小？可以，但合适的步长每个 token 都不一样。截断直接限制的是每个 token 的概率变化，而这才是我们真正关心的东西。'),
      ],
    },
    {
      id: 'ppo-derive', kind: 'derive', skill: 'ppo-clip', title: t('The clipped surrogate', '截断的代理目标'),
      intro: t('Samples y come from π_old; Â is their advantage.', '样本 y 来自 π_old；Â 是它们的优势。'),
      lines: [
        { tex: '\\mathbb E_{y\\sim\\pi_\\theta}[f(y)] = \\mathbb E_{y\\sim\\pi_{old}}\\Big[\\tfrac{\\pi_\\theta(y)}{\\pi_{old}(y)}\\,f(y)\\Big]', why: t('Importance sampling: Σ π_θ f = Σ π_old (π_θ/π_old) f. It needs π_old > 0 wherever π_θ > 0.', '重要性采样：Σ π_θ f = Σ π_old (π_θ/π_old) f。要求在 π_θ 有概率的地方，π_old 也有概率。') },
        { tex: 'L(\\theta) = \\mathbb E_{\\pi_{old}}\\big[\\rho_\\theta\\,\\hat A\\big], \\qquad \\rho_\\theta = \\pi_\\theta / \\pi_{old}', why: t('The surrogate objective: weight each old sample’s advantage by the ratio.', '代理目标：用概率比给每个旧样本的优势加权。') },
        { tex: '\\nabla L\\big|_{\\theta = \\theta_{old}} = \\mathbb E_{\\pi_{old}}\\big[\\hat A\\,\\nabla \\log\\pi_\\theta\\big]', why: t('Because ∇ρ = ρ∇log π_θ and ρ = 1 at the start: right where we start, the surrogate has exactly the policy gradient. Far away it is only an approximation.', '因为 ∇ρ = ρ∇log π_θ，而出发点处 ρ = 1：在出发点，代理目标的梯度正好就是策略梯度。离得远了，它只是个近似。') },
        { tex: 'L^{CLIP} = \\mathbb E\\big[\\min\\big(\\rho\\hat A,\\ \\mathrm{clip}(\\rho, 1-\\varepsilon, 1+\\varepsilon)\\,\\hat A\\big)\\big], \\quad \\varepsilon = 0.2', why: t('PPO keeps the pessimistic of two numbers: the plain term and the clipped one. ε = 0.2 is the value suggested in the PPO paper.', 'PPO 在两个数里取悲观的那个：原始项和截断项。ε = 0.2 是 PPO 论文给出的取值。') },
        { tex: '\\hat A > 0,\\ \\rho > 1+\\varepsilon:\\ \\ \\min = (1+\\varepsilon)\\hat A \\;\\Rightarrow\\; \\partial L/\\partial\\rho = 0', why: t('A good token that has already become more likely by ε is left alone: no incentive to push it further on these old samples.', '一个好 token，概率已经涨了 ε 以上，就不再管它：在这批旧样本上，没有理由再推。') },
        { tex: '\\hat A > 0,\\ \\rho < 1-\\varepsilon:\\ \\ \\min = \\rho\\hat A \\;\\Rightarrow\\; \\partial L/\\partial\\rho = \\hat A', why: t('The same good token pushed the wrong way (less likely) keeps its full gradient: corrections are never clipped. The world lets you check every case.', '同一个好 token 如果被推错了方向（变得更不可能），梯度原样保留：纠错从来不会被截断。下面的世界让你逐个情况检验。') },
      ],
      blank: { line: 2, answer: '1', prompt: t('At $\\theta = \\theta_{old}$, $\\rho = \\,?$', '$\\theta = \\theta_{old}$ 时，$\\rho = \\,?$') },
      outro: t('In a language model all of this is per token: ρ_t = π_θ(y_t|s_t)/π_old(y_t|s_t), with Â_t from the value model, plus a regression loss for the value model. GRPO (E1) keeps ρ and the clip and replaces Â_t by the group-normalized reward.', '在语言模型里，这些都按 token 计算：ρ_t = π_θ(y_t|s_t)/π_old(y_t|s_t)，Â_t 来自价值模型，另外还有价值模型自己的回归损失。E1 的 GRPO 保留了 ρ 和截断，把 Â_t 换成组内归一化的奖励。'),
    },
    {
      id: 'clip-q', kind: 'checkpoint', skill: 'ppo-clip', purpose: 'predict', title: t('Bet first', '先下注'),
      prompt: t('A good token (Â > 0) whose probability already rose to ρ = 1.5 times its old value, with ε = 0.2. Does the clipped objective still push its probability up?', '一个好 token（Â > 0），它的概率已经涨到旧值的 ρ = 1.5 倍，ε = 0.2。截断目标还会继续推高它的概率吗？'),
      question: {
        type: 'choice', options: [
          { id: 'a', label: t('Yes, a good token is always pushed up', '会，好 token 总是被推高') },
          { id: 'b', label: t('No: the gradient is zero', '不会：梯度为 0'), correct: true },
          { id: 'c', label: t('It is pushed back down toward 1.2', '会把它往回压到 1.2'), misconception: 'clip-misread', feedback: t('Clipping never pushes back; it only stops pushing.', '截断从不往回压，它只是不再推。') },
        ],
      },
      attempts: 1,
    },
    {
      id: 'clip-world', kind: 'explore', title: t('Where clipping bites', '截断在哪里起作用'), skill: 'ppo-clip',
      scene: vis('ppo_clip', { story: 'setup' }),
      prompt: t('Drag the gold point (this token’s ratio ρ) and flip good/bad token. Find three places: (1) a **good** token the gradient leaves alone; (2) a **bad** token the gradient leaves alone; (3) a token **outside** the blue band that still gets pushed. Release the point at each.', '拖动金色的点（这个 token 的概率比 ρ），并在好 token 与坏 token 之间切换。找到三个地方：(1) 梯度不再管的**好** token；(2) 梯度不再管的**坏** token；(3) 在蓝色区间**外面**、却仍然被推动的 token。每找到一个，就在那里松手。'),
      setup: world_setup('ppo_clip', { story: 'setup' }),
      cue: [t('the ratio ρ of this token', '这个 token 的概率比 ρ'), t('the good / bad token switch', '好 token / 坏 token 开关')],
      goals: [
        { id: 'flat-good', check: (_s, _c, w) => !!w.state.flat_good, message: t('A good token already up by more than ε: the clipped term wins the min, the slope is 0.', '好 token 的概率已经涨了 ε 以上：min 取到截断项，斜率为 0。') },
        { id: 'flat-bad', check: (_s, _c, w) => !!w.state.flat_bad, message: t('A bad token already down by more than ε: left alone too.', '坏 token 的概率已经降了 ε 以上：同样不再管它。') },
        { id: 'fix', check: (_s, _c, w) => !!w.state.fix, message: t('Outside the band and still pushed: this token moved the wrong way, and corrections are never clipped.', '在区间外却仍被推动：这个 token 走反了方向，而纠错从来不会被截断。') },
      ],
      detectors: [
        {
          id: 'release', on: (e, w) => {
            if (e.type !== 'released') return null;
            const { rho, A, slope, lo, hi } = e.data as { rho: number; A: number; slope: number; lo: number; hi: number };
            const outside = rho < 1 - lo || rho > 1 + hi;
            if (A > 0 && slope === 0) w.state.flat_good = true;
            if (A < 0 && slope === 0) w.state.flat_bad = true;
            if (outside && slope !== 0) w.state.fix = true;
            // looking for "left alone" on the bad token's correction side
            if (A < 0 && rho > 1 + hi && !w.state.flat_bad) return { kind: 'misconception', id: 'clip-misread' };
            return null;
          },
        },
      ],
      lines: [
        { text: t('The arrow shows which way this token is pushed. A grey ring means: left alone.', '箭头表示这个 token 被往哪推。灰色圆圈表示：不再管它。'), when: 'enter' },
        { text: t('Drag the gold point along the curve, then flip the switch.', '沿着曲线拖动金色的点，然后拨一下开关。'), when: 'idle' },
        { text: t('A bad token that became more likely moved the wrong way. The min keeps the plain term here, so it is pushed back down - at any distance.', '一个坏 token 变得更可能了，这是走反了方向。这里 min 取的是原始项，所以它会被压回去——离得再远也一样。'), when: { finding: 'clip-misread' } },
        { text: t('Clipping only stops a token from going further where the advantage already sent it. That is all it does.', '截断只做一件事：不让 token 在优势指的方向上走得更远。'), when: 'goal' },
      ],
      hints: [t('For a good token the curve is flat to the right of the band; for a bad token, to the left.', '好 token 的曲线在区间右边变平；坏 token 在左边。')],
      solve: (s: any) => {
        const rel = (rho: number, sign: number) => {
          s.sign.set_value(sign);
          s.rho.set_value(rho);
          s.emit('released', { rho, A: s.A(), slope: s.slope(), lo: s.lo(), hi: s.hi() });
        };
        rel(1.6, 1);
        rel(0.5, 0);
        rel(0.5, 1);
      },
    },
    {
      id: 'clip-takeaway', kind: 'read', title: t('The rule, in words', '用一句话说规则'),
      blocks: [
        table([['token', 'token'], ['ρ < 1 − ε', 'ρ < 1 − ε'], ['inside the band', '区间内'], ['ρ > 1 + ε', 'ρ > 1 + ε']], [
          [['Â > 0 (good)', 'Â > 0（好）'], ['pushed up (a correction)', '推高（纠错）'], ['pushed up', '推高'], ['left alone', '不再管']],
          [['Â < 0 (bad)', 'Â < 0（坏）'], ['left alone', '不再管'], ['pushed down', '压低'], ['pushed down (a correction)', '压低（纠错）']],
        ]),
        p('Clipping does not stop large changes; it stops a token from going **further in the direction its advantage already sent it**, on data that has gone stale. E1 widens the upper side (DAPO’s ε_high = 0.28) for exactly this reason: rare tokens with positive advantage were being stopped too early.',
          '截断挡的不是"大变化"，而是**在旧数据上，顺着优势的方向继续往前走**。E1 会讲 DAPO 把上界放宽到 ε_high = 0.28，原因正在于此：概率很低、优势为正的 token 被过早挡住了。'),
      ],
    },
    {
      id: 'clip-check', kind: 'checkpoint', skill: 'ppo-clip', purpose: 'check', title: t('One more case', '再判断一种情况'),
      prompt: t('A bad token ($\\hat A < 0$) whose probability fell to ρ = 0.7 of its old value, ε = 0.2. What does the gradient of $L^{CLIP}$ do to it?', '一个坏 token（$\\hat A < 0$），它的概率已经降到旧值的 ρ = 0.7 倍，ε = 0.2。$L^{CLIP}$ 的梯度会对它做什么？'),
      question: {
        type: 'choice', options: [
          { id: 'a', label: t('Nothing: the gradient is 0', '什么都不做：梯度为 0'), correct: true },
          { id: 'b', label: t('Pushes it further down', '继续往下压'), misconception: 'clip-misread', feedback: t('0.7 < 1 − ε = 0.8: it is already down enough on these samples; the min takes the constant clipped term.', '0.7 < 1 − ε = 0.8：在这批样本上它已经被压够了；min 取的是常数截断项。') },
          { id: 'c', label: t('Pushes it back up', '往回推高') },
        ],
      },
    },
    {
      id: 'explain-q', kind: 'checkpoint', skill: 'policy-gradient', purpose: 'check', title: t('In your own words', '用自己的话说'),
      prompt: t('In one or two sentences: why can REINFORCE train on a reward that is a black-box program?', '用一两句话说明：为什么 REINFORCE 能用一段"黑盒程序"给出的奖励来训练？'),
      question: text_q([
        ['The gradient is taken of log π of the sampled answer, not of the reward', '求导的对象是采样回答的 log π，而不是奖励'],
        ['The reward only multiplies that gradient as a weight', '奖励只是作为权重去乘这个梯度'],
      ], ['Because the update is the gradient of log π(y) of the answer we sampled, multiplied by its reward; the reward is only a number used as a weight, so it never needs a gradient.', '因为更新是"采样回答的 log π(y) 的梯度"乘以它的奖励；奖励只是当权重用的一个数，从来不需要对它求导。']),
    },
    {
      id: 'card', kind: 'read', chapter: t('How to choose', '怎么选'), title: t('What D2a adds to the map', 'D2a 给决策图加了什么'),
      blocks: choose_card({
        upto: 'D2a', highlight: 'R',
        rule: t('If you have a scorer and want the model to improve on its own samples, the building blocks are the policy gradient, a baseline and a clipped ratio. Understand them through PPO; in practice use a GRPO-family method (E1), whose baseline needs no value model.',
          '如果你有打分器，又想让模型在自己的样本上进步，用到的积木是策略梯度、基线和截断的概率比。借 PPO 理解它们；实践中用 GRPO 一类的方法（E1），它的基线不需要价值模型。'),
        counter: t('"PPO is the standard RLHF algorithm, so start there." It needs a policy, a reference, a reward model and a value model in memory, and is notoriously sensitive; today it is rare in practice (about 900 Hub models with trl+ppo against about 14,000 with trl+grpo).',
          '"PPO 是标准的 RLHF 算法，就从它开始。"它要在显存里同时放策略、参考模型、奖励模型和价值模型，而且出了名的难调；如今实践中已经很少用（Hub 上 trl+ppo 约 900 个模型，trl+grpo 约 14,000 个）。'),
      }),
    },
  ],
};

