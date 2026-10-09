// D3 DPO: derivation and geometry.
// Purpose first (what DPO removes from RLHF), then the one idea (every policy
// implies a reward; the intractable Z cancels by D1's shift invariance), the
// derivation, the gradient and its weight, then one world where the learner
// finds that the loss only sees the gap and watches likelihood displacement
// happen in a toy model, then the real evidence, code and practice.
import type { Lesson } from '@mathnim/core';
import { choose_card, cite, fig, list, myth, note, open_q, p, t, table, text_q, vis } from './common';

/** One press of "Train 20 steps" in the D3 worlds. */
function train_press(scene: any, world: any, n = 20): void {
  const st = scene.train(n);
  world.emit('trained', { steps: Math.round(scene.steps.get_value()), pw: st.p[0], p3: st.p[2], loss: st.loss, ches: scene.ches(), nll: scene.nll.get_value() > 0.5 });
}
/** The D3 world's handles: the gap point (only before training starts) and the rejected response. */
function gap_handles(scene: any, ui: any, o: { point: boolean }): void {
  const v = (scene as any);
  if (o.point) {
    ui.add_handle({
      get: () => {
        const s = v.state();
        return v.gap_xy(s.dw, s.dl);
      },
      set: (pt: number[]) => {
        if (v.mode.get_value() > 0.5) return; // once training has started the point is the model's state
        const [dw, dl] = v.gap_inv(pt);
        v.dw.set_value(dw);
        v.dl.set_value(dl);
      },
      step: 0.1, radius: 0.4, label: 'the point (Δ_w, Δ_l): how far each log-probability moved',
      on_end: () => v.emit('gap', { dw: v.dw.get_value(), dl: v.dl.get_value(), loss: v.state().loss, free: v.mode.get_value() < 0.5 }),
    });
  }
  ui.add_handle({
    get: () => v.feature_xy(v.lx.get_value(), v.ly.get_value()),
    set: (pt: number[]) => {
      const [a, b] = v.feature_inv(pt);
      v.lx.set_value(a);
      v.ly.set_value(b);
      v.steps.set_value(0); // a new pair: training starts again from the reference
    },
    step: 0.1, radius: 0.4, label: 'the rejected response y_l in the feature plane',
    on_end: () => v.emit('moved_rejected', { ches: v.ches() }),
  });
}

export const lesson: Lesson = {
  id: 'ft-d3',
  title: t('DPO: derivation and geometry', 'DPO：推导与几何'),
  description: t(
    'How DPO turns RLHF into a classification loss on preference pairs, what its gradient does, and why the chosen answer can become less likely while the loss falls.',
    'DPO 怎样把 RLHF 变成偏好对上的一个分类损失；它的梯度在做什么；以及为什么损失在降，被选回答反而可能变得更不可能。',
  ),
  mode: 'essay',
  skills: [
    { id: 'dpo-derive', name: t('Deriving the DPO loss', '推导 DPO 损失') },
    { id: 'dpo-gradient', name: t('What the DPO gradient does', 'DPO 的梯度在做什么'), prerequisites: ['dpo-derive'] },
    { id: 'likelihood-displacement', name: t('Likelihood displacement', '似然位移'), prerequisites: ['dpo-gradient'] },
    { id: 'dpo-practice', name: t('Running and monitoring DPO', '运行与监控 DPO'), prerequisites: ['likelihood-displacement'] },
  ],
  misconceptions: [
    { id: 'dpo-no-kl', description: t('DPO has no reward model, so it has no KL constraint and no need for a reference model.', 'DPO 没有奖励模型，所以也没有 KL 约束、不需要参考模型。') },
    { id: 'ref-irrelevant', description: t('Any reference model will do.', '参考模型随便选哪个都行。') },
    { id: 'dpo-raises-chosen', description: t('DPO always makes the chosen answer more likely.', 'DPO 一定会让被选回答更可能出现。') },
    { id: 'dpo-metrics-good', description: t('If the DPO loss falls and preference accuracy rises, the model is getting better.', 'DPO 的损失在降、偏好准确率在升，模型就在变好。') },
    { id: 'similar-pairs-safe', description: t('Near-identical chosen and rejected answers give the cleanest signal.', '几乎一样的被选与被拒回答，给的信号最干净。') },
    { id: 'beta-comparable', description: t('β values can be compared across recipes.', '不同配方里的 β 数值可以直接比较。') },
  ],
  steps: [
    // ---------------------------------------------------------------- 1. what DPO removes
    {
      id: 'why', kind: 'read', chapter: t('What DPO removes', 'DPO 拿掉了什么'), title: t('RLHF without the RL', '不要 RL 的 RLHF'),
      blocks: [
        p('RLHF as in D2 is heavy: train a reward model, then run RL with four models in memory, sampling answers all the time, and tune it until it is stable. **DPO** (Direct Preference Optimization) trains the language model directly on preference pairs with one loss, like a classifier: no reward model, no sampling loop, two models in memory (or one).',
          'D2 里的 RLHF 很重：先训练奖励模型，再在显存里放四个模型做 RL，不停地采样回答，还得调到它稳定为止。**DPO**（Direct Preference Optimization，直接偏好优化）直接在偏好对上用一个损失训练语言模型，就像训练分类器：没有奖励模型，没有采样循环，显存里只有两个模型（甚至一个）。'),
        p('The surprise is that this is not a shortcut that gives up the goal: DPO solves the **same** objective, reward − β·KL, under the same Bradley–Terry model of preferences. Two facts you already have make it work:', '令人意外的是，这不是一条放弃目标的捷径：DPO 求解的是**同一个**目标——奖励 − β·KL，用的也是同一个 Bradley–Terry 偏好模型。让它成立的，是你已经知道的两件事：'),
        list([
          ['From D2b: every reward r has an optimal policy, π* ∝ π_ref·e^{r/β}. So, turned around, **every policy implies a reward** - the one it is optimal for.', '来自 D2b：每个奖励 r 都有一个最优策略 π* ∝ π_ref·e^{r/β}。反过来说，**每个策略都隐含着一个奖励**——让它成为最优的那个奖励。'],
          ['From D1: Bradley–Terry only sees reward **differences** within a prompt. The intractable Z(x) depends only on the prompt, so it cancels.', '来自 D1：Bradley–Terry 只看同一个提示下的奖励**差**。那个算不出来的 Z(x) 只依赖提示，所以它会消掉。'],
        ]),
        p('So: write the reward in terms of the policy, put it into the Bradley–Terry loss of D1, and train the policy as if it were the reward model.', '于是：把奖励写成策略的函数，代进 D1 的 Bradley–Terry 损失，然后把策略当作奖励模型来训练。'),
      ],
    },
    {
      id: 'z-q', kind: 'checkpoint', skill: 'dpo-derive', purpose: 'predict', title: t('Bet first', '先下注'),
      prompt: t('π* = π_ref·e^{r/β}/Z(x), and Z(x) is a sum over every possible answer - impossible to compute. How does DPO deal with Z?', 'π* = π_ref·e^{r/β}/Z(x)，而 Z(x) 是对所有可能回答的求和——根本算不出来。DPO 怎么处理 Z？'),
      question: {
        type: 'choice', options: [
          { id: 'a', label: t('Estimates it by sampling', '用采样估计它') },
          { id: 'b', label: t('Learns it with a small extra network', '用一个额外的小网络学它') },
          { id: 'c', label: t('It cancels in the loss', '它在损失里消掉了'), correct: true },
          { id: 'd', label: t('Ignores it and accepts a bias', '直接忽略，接受偏差') },
        ],
      },
      attempts: 1,
    },
    {
      id: 'dpo-derive', kind: 'derive', skill: 'dpo-derive', title: t('The DPO loss', 'DPO 损失'),
      intro: t('Start from D2b: for each prompt x the best policy for reward r is π_r(y|x) = π_ref(y|x)·e^{r(x,y)/β}/Z(x).', '从 D2b 出发：对每个提示 x，奖励 r 的最优策略是 π_r(y|x) = π_ref(y|x)·e^{r(x,y)/β}/Z(x)。'),
      lines: [
        { tex: '\\log\\pi_r(y\\mid x) = \\log\\pi_{ref}(y\\mid x) + \\frac{r(x,y)}{\\beta} - \\log Z(x)', why: t('Take the log of both sides: the product becomes a sum and r stands alone.', '两边取对数：乘积变成求和，r 单独露了出来。') },
        { tex: 'r(x,y) = \\beta\\log\\frac{\\pi_r(y\\mid x)}{\\pi_{ref}(y\\mid x)} + \\beta\\log Z(x)', why: t('Solve for r. Every reward is "β × how much its optimal policy moved from the reference", plus a term that depends only on the prompt.', '解出 r。任何奖励都等于"β × 它的最优策略相对参考模型移动了多少"，再加一个只依赖提示的项。') },
        { tex: 'P(y_w \\succ y_l \\mid x) = \\sigma\\big(r(x, y_w) - r(x, y_l)\\big)', why: t('D1’s Bradley–Terry model for a pair: w was preferred over l.', 'D1 的 Bradley–Terry 模型：w 比 l 更受欢迎。') },
        { tex: '= \\sigma\\Big(\\beta\\log\\frac{\\pi_r(y_w|x)}{\\pi_{ref}(y_w|x)} + \\beta\\log Z(x) - \\beta\\log\\frac{\\pi_r(y_l|x)}{\\pi_{ref}(y_l|x)} - \\beta\\log Z(x)\\Big)', why: t('Substitute. Both answers belong to the same prompt, so β log Z(x) appears once with + and once with −: it cancels. This is D1’s shift invariance - an offset that depends only on the prompt is invisible to Bradley–Terry. The uncomputable Z never needs computing.', '代进去。两个回答属于同一个提示，β log Z(x) 一正一负，正好抵消。这就是 D1 的平移不变：只依赖提示的偏移，Bradley–Terry 看不见。算不出来的 Z，根本不用算。') },
        { tex: '\\hat r_\\theta(x,y) = \\beta\\log\\frac{\\pi_\\theta(y\\mid x)}{\\pi_{ref}(y\\mid x)}', why: t('Now let the model π_θ play the optimal policy. Its implicit reward is β times how much it has moved each answer’s log-probability away from the reference.', '现在让模型 π_θ 来扮演最优策略。它的隐式奖励（implicit reward）就是 β 乘以它把每个回答的对数概率从参考模型挪动了多少。') },
        { tex: 'Z_\\theta(x) = \\sum_y \\pi_{ref}(y\\mid x)\\,e^{\\hat r_\\theta(x,y)/\\beta} = \\sum_y \\pi_\\theta(y\\mid x) = 1', why: t('Plug r̂_θ back into the optimum formula: π_ref·(π_θ/π_ref) = π_θ, and probabilities sum to one. So π_θ is exactly the optimal policy for its own implicit reward - fitting the reward and finding the policy are one step.', '把 r̂_θ 代回最优解的公式：π_ref·(π_θ/π_ref) = π_θ，而概率之和为 1。所以 π_θ 恰好就是它自己隐式奖励的最优策略——拟合奖励和求最优策略合成了一步。') },
        { tex: '\\mathcal L_{DPO}(\\theta) = -\\,\\mathbb E\\Big[\\log\\sigma\\Big(\\beta\\log\\frac{\\pi_\\theta(y_w|x)}{\\pi_{ref}(y_w|x)} - \\beta\\log\\frac{\\pi_\\theta(y_l|x)}{\\pi_{ref}(y_l|x)}\\Big)\\Big]', why: t('D1’s reward-model loss with r̂_θ in place of r_φ. "Your language model is secretly a reward model" (the DPO paper’s title).', '就是 D1 的奖励模型损失，只是把 r_φ 换成了 r̂_θ。"你的语言模型其实是一个奖励模型"（DPO 论文的标题）。') },
      ],
      blank: { line: 5, answer: '1', prompt: t('Σ_y π_ref·e^{r̂_θ/β} = Σ_y π_θ(y|x) = ?', 'Σ_y π_ref·e^{r̂_θ/β} = Σ_y π_θ(y|x) = ?') },
      outro: t('Same objective, same preference model, same β as the KL strength. What changes is that nothing is sampled during training.', '目标相同，偏好模型相同，β 仍是 KL 的强度。变的只是：训练时什么都不采样。'),
    },
    {
      id: 'routes', kind: 'read', title: t('Two routes, one optimum - in theory', '两条路，一个最优解——在理论上'),
      blocks: [
        fig('two-routes.svg', ['Preference pairs feed either a reward model followed by RL, or the DPO loss directly; both arrows end at the same optimal policy.', '偏好对要么先训练奖励模型再做 RL，要么直接进入 DPO 损失；两条路都指向同一个最优策略。'],
          ['RLHF and DPO optimize the same objective; DPO skips the explicit reward model and the sampling loop.', 'RLHF 和 DPO 优化同一个目标；DPO 跳过了显式的奖励模型和采样循环。'], 'Redrawn after Rafailov et al. (2023), Figure 1'),
        p('"The same optimum" holds under ideal assumptions: Bradley–Terry describes the preferences, the data cover the answers that matter, and the policy can represent the optimum. In practice the data are a fixed, finite set of pairs, and **the loss says nothing about answers that are not in it** - the world below shows what that means.',
          '"同一个最优解"成立需要理想的假设：Bradley–Terry 能描述这些偏好、数据覆盖了要紧的回答、策略能表示那个最优解。实践中，数据是一份固定的、有限的偏好对，而**损失对数据里没有的回答什么也没说**——下面的世界会让你看到这意味着什么。'),
        open_q('Is DPO as good as PPO in practice? A careful study found well-tuned PPO better in every case it tried[^xu]; another found PPO ahead by up to 2.5 points on math and 1.2 in general, with the quality of the preference data mattering most[^ivison].', 'DPO 在实践中和 PPO 一样好吗？一项细致的研究发现，调好的 PPO 在它试过的所有情况下都更好[^xu]；另一项发现 PPO 在数学上最多领先 2.5 分、总体领先 1.2 分，而偏好数据的质量影响最大[^ivison]。'),
        cite('xu', 'Xu et al. 2024', 'Is DPO Superior to PPO for LLM Alignment? A Comprehensive Study', 'https://arxiv.org/abs/2404.10719'),
        cite('ivison', 'Ivison et al. 2024', 'Unpacking DPO and PPO: Disentangling Best Practices for Learning from Preference Feedback', 'https://arxiv.org/abs/2406.09279'),
      ],
    },
    {
      id: 'loss-q', kind: 'checkpoint', skill: 'dpo-derive', purpose: 'check', title: t('Which one is DPO?', '哪个是 DPO？'),
      prompt: t('Which of these is the DPO loss for one pair (w preferred over l)?', '下面哪个是一对数据（w 优于 l）上的 DPO 损失？'),
      question: {
        type: 'choice', shuffle: true, options: [
          { id: 'a', label: '$-\\log\\sigma\\big(\\beta\\log\\frac{\\pi_\\theta(y_w)}{\\pi_{ref}(y_w)} - \\beta\\log\\frac{\\pi_\\theta(y_l)}{\\pi_{ref}(y_l)}\\big)$', correct: true },
          { id: 'b', label: '$-\\log\\sigma\\big(\\beta\\log\\pi_\\theta(y_w) - \\beta\\log\\pi_\\theta(y_l)\\big)$', misconception: 'ref-irrelevant', feedback: t('Without π_ref there is no implicit reward and no anchor: this is not the KL-regularized objective any more (D4’s reference-free variants make this choice on purpose and pay for it).', '没有 π_ref，就没有隐式奖励，也没有锚：它不再是带 KL 约束的那个目标了（D4 的无参考模型变体是故意这样做的，也要为此付出代价）。') },
          { id: 'c', label: '$-\\log\\sigma\\big(\\beta\\log\\frac{\\pi_\\theta(y_w)}{\\pi_{ref}(y_w)} - \\beta\\log\\frac{\\pi_\\theta(y_l)}{\\pi_{ref}(y_l)} + \\beta\\log Z(x)\\big)$', feedback: t('Z(x) appears once for each answer and cancels; nothing is left of it.', 'Z(x) 每个回答各出现一次，相互抵消，一点不剩。') },
          { id: 'd', label: '$-\\log\\sigma\\big(\\beta\\log\\frac{\\pi_\\theta(y_l)}{\\pi_{ref}(y_l)} - \\beta\\log\\frac{\\pi_\\theta(y_w)}{\\pi_{ref}(y_w)}\\big)$', feedback: t('Swapped: this would train the model to prefer the rejected answer.', '方向反了：这会教模型偏爱被拒的回答。') },
        ],
      },
    },

    // ---------------------------------------------------------------- 2. the gradient
    {
      id: 'grad-derive', kind: 'derive', skill: 'dpo-gradient', chapter: t('What the gradient does', '梯度在做什么'), title: t('The DPO gradient', 'DPO 的梯度'),
      intro: t('Write u = r̂_w − r̂_l, the implicit-reward margin of a pair.', '记 u = r̂_w − r̂_l，一对数据的隐式奖励差。'),
      lines: [
        { tex: '\\frac{d}{du}\\log\\sigma(u) = \\sigma(-u)', why: t('σ′ = σ(1 − σ) and 1 − σ(u) = σ(−u), exactly as in D1.', 'σ′ = σ(1 − σ)，而 1 − σ(u) = σ(−u)，和 D1 一模一样。') },
        { tex: '\\nabla_\\theta u = \\beta\\big(\\nabla_\\theta\\log\\pi_\\theta(y_w|x) - \\nabla_\\theta\\log\\pi_\\theta(y_l|x)\\big)', why: t('π_ref is frozen: its log is a constant and disappears. So the reference model only enters the weight below, never the direction.', 'π_ref 是冻结的，它的对数是常数，求导后消失。所以参考模型只出现在下面的权重里，从不影响方向。') },
        { tex: '\\nabla_\\theta\\mathcal L = -\\beta\\,\\mathbb E\\big[\\sigma(\\hat r_l - \\hat r_w)\\,\\big(\\nabla\\log\\pi_\\theta(y_w) - \\nabla\\log\\pi_\\theta(y_l)\\big)\\big]', why: t('Gradient descent raises log π(y_w) and lowers log π(y_l). Pairs the implicit reward ranks wrongly get weight ≈ 1; pairs already ranked right by a wide margin get ≈ 0. The DPO paper reports that dropping this weight makes the model degenerate.', '梯度下降会提高 log π(y_w)、压低 log π(y_l)。隐式奖励排错的对权重约为 1；已经以大差距排对的对权重约为 0。DPO 论文报告：去掉这个权重，模型会退化。') },
        { tex: '\\log\\pi(y) = \\sum_t \\log\\pi(y_t\\mid x, y_{<t})', why: t('If y_w and y_l share a prefix, those tokens appear with the same context in both terms and their gradients cancel exactly: only the tokens after the two answers diverge get a gradient.', '如果 y_w 和 y_l 有一段相同的前缀，这些 token 在两项里上下文相同、梯度完全抵消：只有两个回答分叉之后的 token 才有梯度。') },
      ],
      blank: { line: 0, answer: '-u', variables: ['u'], prompt: t('d/du log σ(u) = σ( ? )', 'd/du log σ(u) = σ( ? )') },
      outro: t('"Cancels in direction" is not "unchanged": the step moves shared weights, so the shared tokens’ probabilities still change - and both answers can become less likely together. Keep that in mind for the world.', '"方向上抵消"不等于"概率不变"：这一步更新的是共享的参数，共享部分的概率照样会跟着变——两个回答甚至可能一起变得更不可能。带着这一点进入下面的世界。'),
    },
    {
      id: 'weight', kind: 'read', title: t('Two pictures of the gradient', '梯度的两张图'),
      blocks: [
        fig('dpo-weight.svg', ['The weight σ(−u) falls from 1 to 0 as the margin u grows: wrongly ranked pairs get full weight, well-ranked pairs almost none.', '权重 σ(−u) 随差距 u 增大从 1 降到 0：排错的对权重满额，排得很好的对几乎为零。'],
          ['The weight on each pair: DPO spends its effort on the pairs its implicit reward still gets wrong.', '每一对的权重：DPO 把力气花在隐式奖励还排错的那些对上。'], 'Original; exact'),
        fig('token-cancel.svg', ['Two refusals that share their first eight tokens: the shared prefix is grey (gradients cancel), the diverging tokens are coloured.', '两个拒答回答，前八个 token 相同：共享前缀标为灰色（梯度抵消），分叉后的 token 着色。'],
          ['Only the tokens after the answers diverge carry gradient. Near-identical pairs therefore give a small, narrow signal.', '只有分叉之后的 token 带梯度。所以几乎一样的两个回答，给的信号又小又窄。'], 'Original'),
      ],
    },
    {
      id: 'compute-q', kind: 'checkpoint', skill: 'dpo-gradient', purpose: 'practice', title: t('One pair, by hand', '手算一对'),
      prompt: t('β = 0.1. log π_θ(y_w) = −40, log π_ref(y_w) = −42, log π_θ(y_l) = −55, log π_ref(y_l) = −50. What is the DPO loss of this pair?', 'β = 0.1。log π_θ(y_w) = −40，log π_ref(y_w) = −42，log π_θ(y_l) = −55，log π_ref(y_l) = −50。这一对的 DPO 损失是多少？'),
      question: { type: 'number', answer: 0.4032, tolerance: 0.005, wrong: [{ answer: 0.5968, feedback: t('That is σ(0.7). The loss is −log σ(0.7).', '这是 σ(0.7)。损失是 −log σ(0.7)。') }] },
      hints: [t('r̂_w = 0.1·(−40 + 42) = 0.2; r̂_l = 0.1·(−55 + 50) = −0.5.', 'r̂_w = 0.1·(−40 + 42) = 0.2；r̂_l = 0.1·(−55 + 50) = −0.5。'), t('u = 0.7; the loss is −log σ(0.7).', 'u = 0.7；损失是 −log σ(0.7)。')],
      explain: t('u = 0.2 − (−0.5) = 0.7, loss = log(1 + e^{−0.7}) ≈ 0.403, and the pair’s weight is σ(−0.7) ≈ 0.33: it is ranked right, but not by much.', 'u = 0.2 − (−0.5) = 0.7，损失 = log(1 + e^{−0.7}) ≈ 0.403，这一对的权重是 σ(−0.7) ≈ 0.33：排对了，但差得不算开。'),
    },
    {
      id: 'beta-ref', kind: 'read', title: t('The two knobs: β and the reference', '两个旋钮：β 和参考模型'),
      blocks: [
        list([
          ['**β is the KL strength from D2b.** For the same preference margin, a small β needs a larger change of log-probabilities, so the policy drifts further from the reference.', '**β 就是 D2b 里的 KL 强度**：要达到同样的偏好差距，β 越小，对数概率要改得越多，策略就离参考模型越远。'],
          ['**The reference sets the zero point** of the implicit reward: it must be the model you start from (usually your SFT model), and the pairs should be answers that model would plausibly write.', '**参考模型定下隐式奖励的零点**：它必须是你出发时的那个模型（通常就是 SFT 模型），而偏好对里的回答，最好是这个模型说得出口的。'],
          ['**It is frozen and only weights the update**, so its log-probabilities can be computed once before training (TRL: `precompute_ref_log_probs=True`) and the model dropped from memory.', '**它是冻结的，只影响权重**：它的对数概率可以在训练前一次性算好（TRL：`precompute_ref_log_probs=True`），然后把它从显存里拿掉。'],
        ]),
        myth('"No reward model, so no KL and no reference." DPO optimizes the same KL-constrained objective; β is the KL strength and the reference defines the implicit reward.', '"没有奖励模型，所以也没有 KL、不需要参考模型。"DPO 优化的正是那个带 KL 约束的目标；β 就是 KL 强度，参考模型定义了隐式奖励。'),
      ],
    },

    // ---------------------------------------------------------------- 3. the world
    {
      id: 'chosen-q', kind: 'checkpoint', skill: 'likelihood-displacement', purpose: 'predict', chapter: t('Only the gap', '只看差距'), title: t('Bet first', '先下注'),
      prompt: t('A pair of refusals to a harmful request: chosen "a polite refusal that suggests an alternative", rejected "a curt refusal". You train DPO on this pair for 80 steps and the loss falls steadily. What happens to the probability of the chosen answer?', '对一个有害请求的两个拒答：被选的是"礼貌拒答并给出替代建议"，被拒的是"生硬拒答"。在这一对上训练 DPO 80 步，损失稳步下降。被选回答的概率会怎样？'),
      question: {
        type: 'choice', options: [
          { id: 'a', label: t('It goes up: that is what the loss rewards', '上升：损失奖励的就是这个'), misconception: 'dpo-raises-chosen' },
          { id: 'b', label: t('About the same', '差不多不变') },
          { id: 'c', label: t('It can go down, even far down', '可能下降，甚至降得很多'), correct: true },
        ],
      },
      attempts: 1,
    },
    {
      id: 'gap', kind: 'explore', title: t('Lower the loss, lose the answer', '损失降了，回答没了'), skill: 'likelihood-displacement',
      scene: vis('dpo_gap_plane', { story: 'setup', nll_switch: false }),
      prompt: t(
        '(1) **You are the optimizer.** Drag the gold point on the left - how far the chosen (Δ_w) and rejected (Δ_l) log-probabilities move - to get the loss below 0.3 **while the chosen answer becomes less likely**. (2) Now press **Train 20 steps** a few times: a real toy model trains on this pair. Watch the bars. (3) Drag **y_l** (the rejected answer, right) so that training makes the chosen answer **more** likely, and train again.',
        '(1) **你来当优化器**：拖动左边的金色点——它表示被选（Δ_w）和被拒（Δ_l）回答的对数概率各变了多少——让损失低于 0.3，**同时被选回答变得更不可能**。(2) 然后按几次 **训练 20 步**：一个真正的玩具模型在这一对上训练。盯住下面的柱子。(3) 拖动右边的 **y_l**（被拒回答），让训练使被选回答变得**更**可能，再训练一次。'),
      setup: (scene: any, ui, _ctx, world) => {
        scene.emit = (type: string, data?: Record<string, unknown>) => world.emit(type, data);
        gap_handles(scene, ui, { point: true });
      },
      actions: [{ id: 'train', label: t('Train 20 steps', '训练 20 步'), primary: true, run: (scene: any, _ctx, world) => train_press(scene, world) }],
      goals: [
        { id: 'gap-only', check: (_s, _c, w) => !!w.state.gap_only, message: t('Both log-probabilities fell, the rejected one more: the loss only sees the gap Δ_w − Δ_l.', '两个对数概率都降了，被拒的降得更多：损失只看差距 Δ_w − Δ_l。') },
        { id: 'displaced', check: (_s, _c, w) => !!w.state.displaced, message: t('The loss fell every step - and the chosen answer lost its probability to an answer that was never in the data.', '损失每一步都在降——被选回答的概率却流到了一个数据里从没出现过的回答上。') },
        { id: 'fixed', check: (_s, _c, w) => !!w.state.fixed, message: t('A rejected answer unlike the chosen one: now the push d points toward the chosen answer, and it gains.', '被拒回答和被选回答不再相像：推的方向 d 指向了被选回答，它的概率就上去了。') },
      ],
      detectors: [
        {
          id: 'events', on: (e, w) => {
            const d = (e.data ?? {}) as Record<string, any>;
            if (e.type === 'gap' && d.free && d.loss < 0.3) {
              if (d.dw < 0) w.state.gap_only = true;
              else return { kind: 'progress', id: 'raised-chosen' };
            }
            if (e.type === 'trained') {
              const default_pair = d.ches > -0.3 && d.ches < -0.2;
              if (default_pair && d.steps >= 40 && d.pw < 0.2) w.state.displaced = true;
              if (d.ches < -0.5 && d.steps >= 100 && d.pw > 0.3) w.state.fixed = true;
              if (d.ches > -0.15 && d.steps >= 40) return { kind: 'misconception', id: 'similar-pairs-safe' };
              if (d.loss < 0.1 && d.pw < 0.05) return { kind: 'misconception', id: 'dpo-metrics-good' };
            }
            return null;
          },
        },
      ],
      lines: [
        { text: t('Left: what the loss sees. Right: what the model does. Blue lines are equal loss.', '左边是损失看到的，右边是模型做的。蓝线上的损失相等。'), when: 'enter' },
        { text: t('Drag the gold point down along a blue line, or press Train.', '沿着蓝线把金色的点往下拖，或者按"训练"。'), when: 'idle' },
        { text: t('That lowers the loss too. Can it fall while the chosen answer gets less likely?', '这样损失也降了。那么，能不能在被选回答变得更不可能的同时，让损失下降？'), when: { finding: 'raised-chosen' } },
        { text: t('More alike made it worse: the gold arrow d got short and points toward complying. Similar pairs are the dangerous ones.', '越像越糟：金色箭头 d 变短了，而且指向"照做"。相似的偏好对，才是危险的那种。'), when: { finding: 'similar-pairs-safe' } },
        { text: t('The loss is almost zero and the preferred answer is almost gone. A low DPO loss is not a good model.', '损失几乎为零，被选回答也几乎没了。DPO 损失低，不等于模型好。'), when: { finding: 'dpo-metrics-good' } },
        { text: t('DPO pushes only along d. Whatever lies furthest along d gains, whether or not it was ever in your data.', 'DPO 只沿 d 推。谁在 d 的方向上走得最远，谁就得到概率，不管它是不是在你的数据里。'), when: 'goal' },
      ],
      hints: [
        t('Equal loss along each blue line: slide down-left along one of them.', '每条蓝线上损失相等：沿着其中一条往左下滑。'),
        t('d = φ_w − φ_l. Put y_l somewhere that makes d point at y_w, away from the other answers.', 'd = φ_w − φ_l。把 y_l 放到能让 d 指向 y_w、远离其他回答的地方。'),
      ],
      solve: (s: any, _c, w) => {
        s.dw.set_value(-0.5);
        s.dl.set_value(-2);
        s.emit('gap', { dw: -0.5, dl: -2, loss: s.state().loss, free: true });
        for (let k = 0; k < 3; k++) train_press(s, w);
        s.lx.set_value(0);
        s.ly.set_value(0);
        s.steps.set_value(0);
        for (let k = 0; k < 6; k++) train_press(s, w);
      },
    },
    {
      id: 'gap-why', kind: 'read', title: t('What the world showed', '刚才看到了什么'),
      blocks: [
        list([
          ['**The loss only sees the gap.** −log σ(β(Δ_w − Δ_l)) is the same along every line Δ_w − Δ_l = const, so "both down, the rejected more" lowers it just as well as "chosen up".', '**损失只看差距**：−log σ(β(Δ_w − Δ_l)) 在每条 Δ_w − Δ_l = 常数的直线上都一样，所以"两个都降、被拒的降得更多"和"被选的升"一样能让它下降。'],
          ['**Where the model goes is set by geometry, not by you.** In the toy, every DPO step moves the parameters along d = φ_w − φ_l only, so the policy becomes π_ref·e^{c·d·φ(y)}: the same tilt as D2b’s π*, with the implicit reward d·φ(y).', '**模型往哪走由几何决定，不由你决定**：在这个玩具里，DPO 每一步都只沿 d = φ_w − φ_l 移动参数，于是策略变成 π_ref·e^{c·d·φ(y)}——和 D2b 的 π* 一样的倾斜，隐式奖励是 d·φ(y)。'],
          ['**Probability flows to whatever lies furthest along d.** The polite refusal differs from the curt one mostly in being more accommodating; the most accommodating answer of all is to comply - never in the data, so nothing pushes it down.', '**概率流向在 d 方向上走得最远的回答**：礼貌拒答和生硬拒答的主要差别是"更顺从"；而最顺从的回答，是直接照做——它从没出现在数据里，没有任何一项把它往下压。'],
        ]),
        note('The five answers, their features and probabilities are made up; the gradient descent on this log-linear toy is exact. "CHES" on the canvas is the toy version of Razin et al.’s similarity score: higher means a more similar pair.', '五个回答、它们的特征和概率都是虚构的；这个对数线性玩具上的梯度下降是精确计算。画面上的"CHES"是 Razin 等人相似度分数的玩具版：越高，这一对越相像。', ['Honest label', '说明']),
      ],
    },
    {
      id: 'real', kind: 'read', chapter: t('In real models', '真实模型里'), title: t('Likelihood displacement, measured', '量出来的似然位移'),
      blocks: [
        p('This is not a toy artefact. Razin et al. trained models with DPO on pairs of refusals to harmful requests - a chosen refusal and a slightly different rejected refusal - and the models refused **less** afterwards[^razin]:', '这不是玩具才有的现象。Razin 等人在"对有害请求的拒答"这类偏好对上训练 DPO——被选的是一个拒答，被拒的是另一个稍有不同的拒答——结果模型拒答得**更少**了[^razin]：'),
        fig('refusal.svg', ['Refusal rates before and after DPO: Llama-3-8B-Instruct 74.4% to 33.4%, Gemma-2B-IT 80.5% to 54.8%.', 'DPO 前后的拒答率：Llama-3-8B-Instruct 从 74.4% 降到 33.4%，Gemma-2B-IT 从 80.5% 降到 54.8%。'],
          ['Training on refusal pairs reduced refusals: probability moved from refusing to complying.', '在拒答对上训练，反而减少了拒答：概率从"拒绝"挪到了"照做"。'], 'Data: Razin et al. (2025), §6.2'),
        p('They measure how alike a pair looks to the model with CHES, a similarity of the two answers’ summed hidden states; the more similar the pair, the more displacement. Three remedies:', '他们用 CHES 衡量一对回答在模型看来有多像——两个回答隐藏状态之和的一种相似度；越相像，位移越严重。对策有三种：'),
        list([
          ['**Filter pairs by similarity.** Dropping the most similar pairs (high CHES) worked best in their experiments[^razin].', '**按相似度过滤偏好对**：在他们的实验里，去掉最相像的那些对（CHES 高的）效果最好[^razin]。'],
          ['**Add an NLL term on the chosen answer** (as in Llama 3, weight 0.2[^llama3], and iterative RPO[^rpo]) - the optional world below.', '**在被选回答上加 NLL 项**（Llama 3 用的权重是 0.2[^llama3]，迭代 RPO 也这样做[^rpo]）——见下面的选做世界。'],
          ['**Penalize the chosen answer falling below the reference** (DPOP, from the Smaug models[^smaug]).', '**被选回答一旦低于参考模型就惩罚**（DPOP，来自 Smaug 模型[^smaug]）。'],
        ]),
        cite('razin', 'Razin et al. 2025', 'Unintentional Unalignment: Likelihood Displacement in Direct Preference Optimization (ICLR)', 'https://arxiv.org/abs/2410.08847'),
        cite('llama3', 'Llama Team 2024', 'The Llama 3 Herd of Models (§4.1.4)', 'https://arxiv.org/abs/2407.21783'),
        cite('rpo', 'Pang et al. 2024', 'Iterative Reasoning Preference Optimization', 'https://arxiv.org/abs/2404.19733'),
        cite('smaug', 'Pal et al. 2024', 'Smaug: Fixing Failure Modes of Preference Optimisation with DPO-Positive', 'https://arxiv.org/abs/2402.13228'),
      ],
    },
    {
      id: 'nll-q', kind: 'checkpoint', skill: 'likelihood-displacement', purpose: 'predict', title: t('Add an NLL term?', '加一项 NLL？'),
      prompt: t('Same similar pair as before. You add α·(−log π(y_w)) - an SFT loss on the chosen answer, α = 0.5 - to the DPO loss and train 100 steps. What happens to the chosen answer?', '还是刚才那对相似的回答。你在 DPO 损失上加一项 α·(−log π(y_w))——对被选回答的 SFT 损失，α = 0.5——然后训练 100 步。被选回答会怎样？'),
      question: {
        type: 'choice', options: [
          { id: 'a', label: t('Still displaced: the gap term dominates', '照样被挤走：差距那一项占主导') },
          { id: 'b', label: t('It gains probability: the NLL term changes the direction of the push', '概率上升：NLL 项改变了推的方向'), correct: true },
          { id: 'c', label: t('Nothing changes: the NLL term only rescales the loss', '没有变化：NLL 项只是把损失放大') },
        ],
      },
      attempts: 1,
    },
    {
      id: 'nll', kind: 'explore', title: t('Optional: rescue the chosen answer', '选做：救回被选回答'), skill: 'likelihood-displacement', required: false,
      scene: vis('dpo_gap_plane', { story: 'setup', nll_switch: true }),
      prompt: t('Turn on **+NLL** and press **Train 20 steps** until the chosen answer holds more than half the probability. Compare with the switch off.', '打开 **+NLL**，按 **训练 20 步**，直到被选回答拿到一半以上的概率。再和开关关着时比一比。'),
      setup: (scene: any, ui, _ctx, world) => {
        scene.emit = (type: string, data?: Record<string, unknown>) => world.emit(type, data);
        scene.mode.set_value(1);
        gap_handles(scene, ui, { point: false });
        scene.nll_switch.attach(ui, 'add an NLL term on the chosen response', () => {
          scene.steps.set_value(0);
          world.emit('nll', { on: scene.nll.get_value() > 0.5 });
        });
      },
      actions: [{ id: 'train', label: t('Train 20 steps', '训练 20 步'), primary: true, run: (scene: any, _ctx, world) => train_press(scene, world) }],
      goals: [{ id: 'rescue', check: (_s, _c, w) => !!w.state.rescued, message: t('With the NLL term the push gains a component toward y_w itself, and the chosen answer keeps its probability.', '加上 NLL 项，推的方向里多了一个指向 y_w 本身的分量，被选回答就保住了概率。') }],
      detectors: [
        {
          id: 'events', on: (e, w) => {
            const d = (e.data ?? {}) as Record<string, any>;
            if (e.type !== 'trained') return null;
            if (d.nll && d.steps >= 100 && d.pw > 0.5) w.state.rescued = true;
            if (!d.nll && d.loss < 0.1 && d.pw < 0.05) return { kind: 'misconception', id: 'dpo-metrics-good' };
            return null;
          },
        },
      ],
      lines: [
        { text: t('Same pair as before. This time you can add an SFT term on the chosen answer.', '还是那一对。这一次，你可以在被选回答上加一项 SFT 损失。'), when: 'enter' },
        { text: t('Without the NLL term: the loss is tiny and the chosen answer is gone, as before.', '不加 NLL 项：损失很小，被选回答却没了，和刚才一样。'), when: { finding: 'dpo-metrics-good' } },
        { text: t('This is the DPO plus NLL that recipes like Llama 3 actually use.', '这就是 Llama 3 这类配方实际在用的"DPO 加 NLL"。'), when: 'goal' },
      ],
      solve: (s: any, _c, w) => {
        s.nll.set_value(1);
        s.steps.set_value(0);
        for (let k = 0; k < 6; k++) train_press(s, w);
      },
    },

    // ---------------------------------------------------------------- 4. practice
    {
      id: 'dpo-code', kind: 'code', chapter: t('DPO in practice', '实践中的 DPO'), title: t('The DPO loss, from scratch', '从零写 DPO 损失'), lang: 'python',
      intro: t('Two functions. Put them next to D1’s reward-model loss: the only difference is where the reward comes from.', '两个函数。把它们和 D1 的奖励模型损失放在一起看：唯一的区别是奖励从哪来。'),
      code: `def seq_logp(logits, labels, mask):
    # log π(y|x): sum the log-probabilities of the answer's tokens
    lp = logits.log_softmax(-1).gather(-1, labels.unsqueeze(-1)).squeeze(-1)
    return (lp * mask).sum(-1)

def dpo_loss(pi_w, pi_l, ref_w, ref_l, beta=0.1):
    r_w = beta * (pi_w - ref_w)            # implicit reward of the chosen answer
    r_l = beta * (pi_l - ref_l)            # ... and of the rejected one
    loss = -F.logsigmoid(r_w - r_l).mean() # D1's Bradley-Terry loss
    return loss, r_w.detach(), r_l.detach()

# ref_w, ref_l come from the frozen reference model, under torch.no_grad(),
# or are computed once for the whole dataset before training.`,
      notes: [
        { lines: [1, 4], text: t('mask is 1 on the answer’s tokens only (the prompt is not scored). Summing, not averaging, is standard DPO; dividing by the length gives the length-normalized variant, whose β lives on a different scale.', 'mask 只在回答的 token 上为 1（提示不计分）。求和而不是求平均，才是标准 DPO；除以长度就是长度归一化的版本，它的 β 尺度完全不同。'), shapes: 'logits: [B, T, V] → lp: [B, T] → log π(y|x): [B]' },
        { lines: [6, 9], text: t('The implicit rewards are β × the log-ratios; the loss is the same line as D1’s reward-model loss.', '隐式奖励是 β × 对数比；损失和 D1 奖励模型的损失是同一行。'), shapes: 'pi_w, pi_l, ref_w, ref_l: [B]' },
        { lines: [10, 13], text: t('Return the implicit rewards for logging: their mean, their margin and how often r_w > r_l are what TRL logs as rewards/*.', '把隐式奖励返回去记日志：它们的均值、差距、以及 r_w > r_l 的比例，就是 TRL 记录的 rewards/* 各项。') },
      ],
    },
    {
      id: 'trl', kind: 'read', title: t('With TRL, and what to watch', '用 TRL 写，以及要盯什么'),
      blocks: [
        { type: 'code', lang: 'python', label: 'TRL', caption: t('TRL v1.15: `beta` defaults to 0.1 and `learning_rate` to 1e-6. DPO + NLL is `loss_type=["sigmoid", "sft"]` with `loss_weights=[1.0, 0.2]`.', 'TRL v1.15：`beta` 默认 0.1，`learning_rate` 默认 1e-6。DPO 加 NLL 写作 `loss_type=["sigmoid", "sft"]`，配 `loss_weights=[1.0, 0.2]`。'), code: `from datasets import load_dataset
from trl import DPOConfig, DPOTrainer

ds = load_dataset("trl-lib/ultrafeedback_binarized", split="train")  # prompt / chosen / rejected
args = DPOConfig(output_dir="dpo", beta=0.1, num_train_epochs=1,
                 precompute_ref_log_probs=True)        # the reference is not kept in memory
trainer = DPOTrainer(model="my-sft-model", args=args, train_dataset=ds)  # ref = a frozen copy
trainer.train()` },
        table([['Logged', '日志项'], ['Healthy', '健康时'], ['Displacement or overfitting', '位移或过拟合时']], [
          ['`rewards/accuracies`', ['rises, then levels off', '上升后趋稳'], ['near 1.0 within a few hundred steps', '几百步内就接近 1.0']],
          ['`rewards/margins`', ['grows slowly', '缓慢增大'], ['shoots up', '飙升']],
          ['`logps/chosen`', ['roughly flat or rising', '大致持平或上升'], ['falls steadily', '持续下降']],
          ['`logps/rejected`', ['falls', '下降'], ['falls even faster', '降得更快']],
        ]),
        h2('Numbers from real recipes', '真实配方里的数字'),
        list([
          ['**Llama 3**: β = 0.1, learning rate 1e-5, formatting tokens masked out of the loss, plus an NLL term on the chosen answer with weight 0.2[^llama3]. Meta chose DPO over PPO because it "required less compute for large-scale models and performed better".', '**Llama 3**：β = 0.1，学习率 1e-5，格式 token 不计入损失，并在被选回答上加权重为 0.2 的 NLL 项[^llama3]。Meta 选 DPO 而不选 PPO，理由是它"对大模型所需算力更少、效果更好"。'],
          ['**Zephyr**: β = 0.1, learning rate 5e-7[^zephyr].', '**Zephyr**：β = 0.1，学习率 5e-7[^zephyr]。'],
          ['**Tülu 3**: length-normalized DPO with β = 5, learning rate 5e-7 (8B), 1 epoch[^tulu]. β = 5 is not "50 times tighter" than 0.1: dividing the log-ratio by an answer length of a few hundred tokens puts it on a different scale.', '**Tülu 3**：长度归一化的 DPO，β = 5，学习率 5e-7（8B），1 轮[^tulu]。β = 5 并不比 0.1 "紧 50 倍"：对数比被除以几百个 token 的长度，尺度就完全不同了。'],
        ]),
        fig('recipes.svg', ['Recipe timelines: Llama 3 SFT and DPO over six rounds; Tülu 3 SFT, DPO, RLVR; Llama 4 light SFT, online RL, light DPO; Olmo 3 SFT, delta-learning DPO, RLVR.', '配方时间线：Llama 3 是 SFT 加 DPO，共六轮；Tülu 3 是 SFT、DPO、RLVR；Llama 4 是轻量 SFT、在线 RL、轻量 DPO；Olmo 3 是 SFT、delta learning DPO、RLVR。'],
          ['Where DPO sits now: offered by OpenAI, Vertex, Azure and Together, but in frontier recipes it has become a light finishing step or relies on specially built pairs (D4).', 'DPO 现在的位置：OpenAI、Vertex、Azure、Together 都提供它；但在前沿配方里，它要么成了轻量的收尾，要么依赖特别构造的偏好对（D4）。'], 'Original; stages from each model’s report (Llama 3, Tülu 3, Llama 4 blog, Olmo 3)'),
        cite('llama3', 'Llama Team 2024', 'The Llama 3 Herd of Models (§4.1.4)', 'https://arxiv.org/abs/2407.21783'),
        cite('zephyr', 'Tunstall et al. 2023', 'Zephyr: Direct Distillation of LM Alignment', 'https://arxiv.org/abs/2310.16944'),
        cite('tulu', 'Lambert et al. 2024', 'Tülu 3: Pushing Frontiers in Open Language Model Post-Training', 'https://arxiv.org/abs/2411.15124'),
      ],
    },
    {
      id: 'logs-q', kind: 'checkpoint', skill: 'dpo-practice', purpose: 'check', title: t('Read the logs', '读日志'),
      prompt: t('DPO on refusal pairs that differ by a few words. In 300 steps: rewards/accuracies 0.50 → 0.97; rewards/margins 0 → 9; logps/chosen −180 → −260; logps/rejected −190 → −330; on held-out harmful prompts the refusal rate fell from 74% to 40%. What is happening?', '在只差几个词的拒答对上做 DPO。300 步内：rewards/accuracies 从 0.50 升到 0.97；rewards/margins 从 0 升到 9；logps/chosen 从 −180 降到 −260；logps/rejected 从 −190 降到 −330；在留出的有害提示上，拒答率从 74% 降到 40%。发生了什么？'),
      question: {
        type: 'choice', options: [
          { id: 'a', label: t('Likelihood displacement: both answers lose probability, and it flows to complying', '似然位移：两个回答都在失去概率，概率流向了"照做"'), correct: true },
          { id: 'b', label: t('Training is going well: accuracy is 0.97', '训练很顺利：准确率 0.97'), misconception: 'dpo-metrics-good', feedback: t('Accuracy only compares the two answers with each other. logps/chosen falling and the refusal rate dropping say the model got worse.', '准确率只比较这两个回答之间的高低。logps/chosen 在降、拒答率在掉，说明模型变差了。') },
          { id: 'c', label: t('The learning rate is too low', '学习率太低') },
        ],
      },
      explain: t('Remedies: drop the most similar pairs, add an NLL term on the chosen answer, use DPOP, train fewer steps - or build rejected answers that differ more.', '对策：去掉最相像的那些对，在被选回答上加 NLL 项，用 DPOP，少训几步——或者重新构造差别更大的被拒回答。'),
    },
    {
      id: 'beta-q', kind: 'checkpoint', skill: 'dpo-practice', purpose: 'check', title: t('Turn down β', '把 β 调小'),
      prompt: t('Same data, β changed from 0.1 to 0.01. What is the most likely effect?', '同样的数据，β 从 0.1 改成 0.01。最可能的结果是什么？'),
      question: {
        type: 'choice', options: [
          { id: 'a', label: t('The policy moves further from the reference: larger KL, more risk of degenerating', '策略离参考模型更远：KL 更大，退化的风险更高'), correct: true },
          { id: 'b', label: t('It stays closer to the reference', '更贴近参考模型') },
          { id: 'c', label: t('No effect: β only rescales the loss', '没影响：β 只是把损失缩放了一下'), misconception: 'dpo-no-kl', feedback: t('β is the KL strength: with a small β the same preference margin needs a much larger change of log-probabilities.', 'β 就是 KL 强度：β 小，同样的偏好差距需要大得多的对数概率变化。') },
        ],
      },
    },
    {
      id: 'beta-compare-q', kind: 'checkpoint', skill: 'dpo-practice', purpose: 'check', title: t('Compare two recipes', '比较两个配方'),
      prompt: t('"Tülu 3 uses β = 5 and Llama 3 uses β = 0.1, so Tülu 3’s leash is fifty times tighter." True?', '"Tülu 3 用 β = 5，Llama 3 用 β = 0.1，所以 Tülu 3 的缰绳紧了五十倍。"对吗？'),
      question: {
        type: 'choice', options: [
          { id: 'a', label: t('No: Tülu 3 divides the log-ratios by the answer length, so its β is on another scale', '不对：Tülu 3 把对数比除以了回答长度，它的 β 在另一个尺度上'), correct: true },
          { id: 'b', label: t('Yes', '对'), misconception: 'beta-comparable' },
        ],
      },
      explain: t('With answers of a few hundred tokens, β = 5 per token is roughly β ≈ 0.02 on a summed log-ratio - a rough conversion, not a published number.', '回答有几百个 token 时，按 token 平均的 β = 5 大致相当于按总和计算时的 β ≈ 0.02——这是粗略换算，不是论文里的数字。'),
    },
    {
      id: 'explain-q', kind: 'checkpoint', skill: 'dpo-derive', purpose: 'check', title: t('In your own words', '用自己的话说'),
      prompt: t('A colleague says: "DPO has no reward model, so there is no KL constraint and the reference model is just a formality." Correct them in two or three sentences.', '一位同事说："DPO 没有奖励模型，所以没有 KL 约束，参考模型只是走个形式。"用两三句话纠正他。'),
      question: text_q([
        ['DPO solves the same KL-regularized objective as RLHF', 'DPO 求解的和 RLHF 是同一个带 KL 约束的目标'],
        ['β is the strength of that KL constraint', 'β 就是这个 KL 约束的强度'],
        ['The reference defines the implicit reward β·log(π_θ/π_ref), its zero point', '参考模型定义了隐式奖励 β·log(π_θ/π_ref)，也就是它的零点'],
      ], ['DPO is derived from the optimum of reward − β·KL(π‖π_ref), so it optimizes the same constrained objective; β is the KL strength. The reference model is not a formality: the implicit reward is β times the log-ratio against it, so it sets where "zero" is and anchors the policy.', 'DPO 是从"奖励 − β·KL(π‖π_ref)"的最优解推出来的，所以它优化的就是这个带约束的目标；β 就是 KL 强度。参考模型不是形式：隐式奖励是相对它的对数比乘以 β，它决定了"零"在哪里，也把策略拴住。'], 2),
    },
    {
      id: 'card', kind: 'read', chapter: t('How to choose', '怎么选'), title: t('What D3 adds to the map', 'D3 给决策图加了什么'),
      blocks: choose_card({
        upto: 'D3', highlight: 'B3',
        rule: t('If you have offline preference pairs (ideally sampled from your own SFT model) and do not want to maintain a reward model and a sampling loop, use DPO: start at β = 0.1 for one epoch, and watch logps/chosen as well as the loss.',
          '如果你有离线的偏好对（最好是从自己的 SFT 模型采样的），又不想维护奖励模型和采样循环，就用 DPO：从 β = 0.1、一轮开始，除了损失，还要盯住 logps/chosen。'),
        counter: t('Training "refuse" on pairs of near-identical refusals. Tempting because the pairs are easy to make; wrong because of likelihood displacement - in Razin et al. the refusal rate fell from 74.4% to 33.4%. Filter similar pairs or add an NLL term.',
          '用几乎一样的两个拒答回答去训练"拒答"。诱人之处是这种对很好造；错在会发生似然位移——Razin 等人的实验里，拒答率从 74.4% 掉到了 33.4%。先过滤相似的对，或者加 NLL 项。'),
        extra: [note('Need the model to keep improving on its own outputs, or is correctness checkable by a program? Then online RL or RLVR (D2, E1). In frontier recipes DPO is now usually a light finishing step.', '需要模型在自己的输出上持续进步，或者对错能用程序判断？那就用在线 RL 或 RLVR（D2、E1）。在前沿配方里，DPO 如今通常只是轻量的收尾。')],
      }),
    },
  ],
};

/** A level-2 heading. */
function h2(en: string, zh: string) {
  return { type: 'h' as const, text: t(en, zh), level: 3 as const };
}
