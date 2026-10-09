// D2b The optimal policy under a KL leash, and RLHF.
// Purpose first (a learned reward is only trustworthy near its data, so
// optimizing it hard finds its flaws), then the leash: reward − β·KL, its exact
// optimum π* ∝ π_ref·e^{r/β} (derived), one world where β is the leash on eight
// answers with an exploit, then the real evidence (Gao et al.), how the KL is
// implemented, and what full RLHF costs.
import type { Lesson } from '@mathnim/core';
import { choose_card, cite, fig, list, math, note, open_q, p, t, text_q, vis, watch } from './common';

/** Reveal the gold column once the exploit holds most of the probability. */
function check_reveal(scene: any, world: any): void {
  if (world.state.revealed) return;
  if (scene.state().pi[7] > 0.5) {
    world.state.revealed = true;
    scene.gold.set_value(1);
    world.emit('revealed', { beta: scene.beta() });
  }
}

export const lesson: Lesson = {
  id: 'ft-d2b',
  title: t('The optimal policy under a KL leash, and RLHF', 'KL 约束下的最优策略与 RLHF'),
  description: t(
    'Why a learned reward needs a leash, the exact optimum of reward minus β·KL, reward hacking you can watch, and what full RLHF costs.',
    '为什么学来的奖励需要一根缰绳；"奖励 − β·KL"的精确最优解；亲眼看着奖励被钻空子；以及完整 RLHF 的代价。',
  ),
  mode: 'essay',
  skills: [
    { id: 'kl-optimum', name: t('The KL-regularized optimum π* ∝ π_ref·e^{r/β}', 'KL 正则目标的最优解 π* ∝ π_ref·e^{r/β}') },
    { id: 'overoptimization', name: t('Recognizing reward hacking and over-optimization', '识别奖励投机与过度优化'), prerequisites: ['kl-optimum'] },
    { id: 'rlhf-cost', name: t('What RLHF with PPO costs', '用 PPO 做 RLHF 的代价'), prerequisites: ['kl-optimum'] },
  ],
  misconceptions: [
    { id: 'kl-optional', description: t('The KL term is an optional regularizer.', 'KL 项只是可有可无的正则。') },
    { id: 'reward-up-means-better', description: t('If the reward keeps going up, the model keeps getting better.', '奖励一直在涨，模型就一直在变好。') },
    { id: 'kl-fixes-rm', description: t('A KL penalty fixes the reward model’s biases.', 'KL 惩罚能修好奖励模型的偏差。') },
    { id: 'negative-kl-bug', description: t('A negative KL reading always means a bug.', 'KL 读数为负，一定是代码有 bug。') },
  ],
  steps: [
    // ---------------------------------------------------------------- 1. why a leash
    {
      id: 'why', kind: 'read', chapter: t('Why a leash', '为什么要缰绳'), title: t('A learned reward has blind spots', '学来的奖励有盲区'),
      blocks: [
        p('A reward model learned from comparisons of *ordinary* answers. It is accurate near those answers and guesses elsewhere. An optimizer does not care where the reward is accurate; it goes wherever the number is highest. If some odd answer - very long, very flattering - happens to score high, RL will find it and pile probability onto it. This is **reward hacking**.',
          '奖励模型是在*普通*回答的比较上学出来的。在这些回答附近它很准，离远了就是在猜。优化器可不管奖励哪里准，它只往数最大的地方去。如果某种古怪的回答——特别长、特别会奉承——碰巧得分很高，RL 就会找到它，把概率都堆过去。这就是**奖励投机**（reward hacking）。'),
        p('The remedy is a leash to where the reward model is reliable: the model we started from, the **reference** π_ref (usually the SFT model). We still maximize reward, but pay for every bit of drift away from the reference:',
          '办法是给模型拴一根缰绳，拴在奖励模型靠得住的地方：我们出发时的那个模型，即**参考模型** π_ref（通常就是 SFT 模型）。照样最大化奖励，但每偏离参考模型一点，都要付出代价：'),
        math('\\max_\\pi\\; \\mathbb E_{y\\sim\\pi}[r(x, y)] \\;-\\; \\beta\\,\\mathrm{KL}\\big(\\pi(\\cdot|x)\\,\\Vert\\,\\pi_{ref}(\\cdot|x)\\big)'),
        list([
          ['**r** pulls toward high-scoring answers.', '**r** 把模型拉向高分的回答。'],
          ['**KL** measures how far the model’s answers have moved from the reference’s, in nats.', '**KL** 衡量模型的回答分布离参考模型有多远，单位是 nat。'],
          ['**β** is the leash: large β keeps the model close to the reference, small β lets it roam.', '**β** 就是缰绳：β 大，模型被拉在参考附近；β 小，模型可以走远。'],
        ]),
        p('Why KL on the outputs, and not, say, a penalty on how far the weights move? Because what we fear is a change of **behaviour**, and KL measures exactly that. It also gives this objective an exact solution, which is the key to DPO (D3).',
          '为什么约束输出分布的 KL，而不是比如权重移动的距离？因为我们担心的是**行为**变了，KL 量的正是这个。它还让这个目标有一个精确解，而这个解正是 D3 中 DPO 的钥匙。'),
      ],
    },
    {
      id: 'optimum-derive', kind: 'derive', skill: 'kl-optimum', title: t('The exact optimum', '精确的最优解'),
      intro: t('For one prompt x, look for the best distribution π over answers (any distribution, not just ones a network can represent).', '对一个提示 x，在所有回答分布 π 里找最好的那个（任意分布，不限于网络能表示的）。'),
      lines: [
        { tex: '\\sum_y \\pi(y)\\,r(y) - \\beta\\sum_y \\pi(y)\\log\\frac{\\pi(y)}{\\pi_{ref}(y)}', why: t('Write the expectation and the KL as sums.', '把期望和 KL 都写成求和。') },
        { tex: '= -\\beta\\sum_y \\pi(y)\\Big[\\log\\frac{\\pi(y)}{\\pi_{ref}(y)} - \\frac{r(y)}{\\beta}\\Big]', why: t('Take out −β; both terms now sit in one sum.', '提出 −β，两项合进同一个求和。') },
        { tex: '= -\\beta\\sum_y \\pi(y)\\log\\frac{\\pi(y)}{\\pi_{ref}(y)\\,e^{r(y)/\\beta}}', why: t('r/β = log e^{r/β}; merge the logarithms.', 'r/β = log e^{r/β}，把两个对数合成一个。') },
        { tex: 'Z = \\sum_y \\pi_{ref}(y)\\,e^{r(y)/\\beta}, \\qquad \\pi^*(y) = \\frac{\\pi_{ref}(y)\\,e^{r(y)/\\beta}}{Z}', why: t('The denominator is positive but does not sum to 1; dividing by its total Z makes it a distribution π*.', '分母是正的，但加起来不等于 1；除以它的总和 Z，就得到一个真正的分布 π*。') },
        { tex: '= -\\beta\\,\\mathrm{KL}(\\pi\\,\\Vert\\,\\pi^*) + \\beta\\log Z', why: t('π_ref·e^{r/β} = Z·π*; split log(Z·π*) and use Σπ = 1.', 'π_ref·e^{r/β} = Z·π*；把 log(Z·π*) 拆开，再用 Σπ = 1。') },
        { tex: '\\pi^*(y\\mid x) = \\frac{1}{Z(x)}\\,\\pi_{ref}(y\\mid x)\\,e^{\\,r(x,y)/\\beta}', why: t('Z does not depend on π, and KL ≥ 0 with equality only at π = π*: the objective is largest exactly at π*.', 'Z 与 π 无关，而 KL ≥ 0，只有 π = π* 时取等：目标恰好在 π* 处最大。') },
      ],
      blank: { line: 5, answer: 'exp(r/beta)', variables: ['r', 'beta'], prompt: t('π*(y) = π_ref(y) · ( ? ) / Z — what tilts the reference?', 'π*(y) = π_ref(y) · ( ? ) / Z —— 是什么让参考分布倾斜？'), ranges: { r: [-2, 2], beta: [0.3, 3] } },
      outro: t('Read it as: start from the reference and tilt it toward high reward; β sets how hard. A Bayesian reading: π_ref is the prior, e^{r/β} the likelihood (Korbak et al., 2022).', '读法：从参考分布出发，往高奖励的方向倾斜；β 决定倾斜多猛。贝叶斯的读法：π_ref 是先验，e^{r/β} 是似然（Korbak 等，2022）。'),
    },
    {
      id: 'optimum-meaning', kind: 'read', title: t('What the formula says', '这个公式在说什么'),
      blocks: [
        list([
          ['**β → ∞**: e^{r/β} → 1, so π* → π_ref. A tight leash changes nothing.', '**β → ∞**：e^{r/β} → 1，于是 π* → π_ref。缰绳太紧，什么都不变。'],
          ['**β → 0**: the highest-reward answer takes everything - even if the reference gives it 0.1%.', '**β → 0**：奖励最高的那个回答拿走全部概率——哪怕参考模型只给它 0.1%。'],
          ['**π_ref(y) = 0** ⇒ π*(y) = 0 for every β: the model never says what the reference would never say. A wall.', '**π_ref(y) = 0** ⇒ 对任何 β 都有 π*(y) = 0：参考模型绝不会说的话，模型也绝不会说。这是一堵墙。'],
          ['As β falls, the expected reward under π* can only go up (its derivative with respect to 1/β is a variance, which is ≥ 0). The **true** quality has no such guarantee.', 'β 变小，π* 下的期望奖励只会上升（它对 1/β 的导数是一个方差，不小于 0）。**真实**质量可没有这个保证。'],
        ]),
        note('Why not just compute π*? Z sums over every possible answer: with a 128k-token vocabulary and 100-token answers that is about 10^511 terms. RL approaches π* by sampling instead; D3 finds a way around Z altogether.',
          '为什么不直接把 π* 算出来？Z 要对所有可能的回答求和：词表 12.8 万、回答长 100 个 token，就是大约 10^511 项。RL 只能靠采样去逼近 π*；D3 会找到完全绕开 Z 的办法。', ['Why we still need RL', '为什么还需要 RL']),
        p('On eight answers, though, Z is a sum of eight numbers - so the next world computes π* exactly.', '不过在只有八个回答时，Z 只是八个数之和——所以下面的世界能精确算出 π*。'),
      ],
    },

    // ---------------------------------------------------------------- 2. the world
    {
      id: 'leash-q', kind: 'checkpoint', skill: 'kl-optimum', purpose: 'predict', chapter: t('The leash', '缰绳'), title: t('Bet first', '先下注'),
      prompt: t('Eight candidate answers. One of them - flattering and padded - is something the reference model almost never says (0.1%), but the reward model gives it the highest score. You loosen the leash from β = 1 to β = 0.01. Where does the probability end up?', '八个候选回答。其中一个又奉承又堆砌，参考模型几乎不会这么说（0.1%），奖励模型却给了它最高分。你把缰绳从 β = 1 放松到 β = 0.01。概率最后会集中到哪里？'),
      question: {
        type: 'choice', options: [
          { id: 'a', label: t('On the answer that is truly best', '真正最好的那个回答上'), misconception: 'reward-up-means-better' },
          { id: 'b', label: t('On the flattering answer the reward model over-rates', '被奖励模型高估的那个奉承回答上'), correct: true },
          { id: 'c', label: t('Spread evenly', '平均分散') },
          { id: 'd', label: t('It stays like the reference, because the reference almost never says it', '保持和参考模型差不多，因为参考模型几乎不这么说') },
        ],
      },
      attempts: 1,
    },
    {
      id: 'leash', kind: 'explore', title: t('Loosen the leash', '放松缰绳'), skill: 'overoptimization',
      scene: vis('kl_leash_policy', { story: 'setup' }),
      prompt: t(
        'Drag **β** (the gold slider; left is loose). The bars are π* = π_ref·e^{r/β}/Z, computed exactly. (1) Loosen the leash until the flattering exploit holds most of the probability. (2) Then the true quality column appears: find the β with the **best true quality** and leave the slider there. (3) Switch off "the reference can say the exploit" and loosen the leash all the way. Where does the probability go now?',
        '拖动 **β**（金色滑块，往左是松）。柱子是精确算出的 π* = π_ref·e^{r/β}/Z。(1) 放松缰绳，直到奉承漏洞拿走大部分概率。(2) 这时真实质量那一列会出现：找到**真实质量最好**的 β，把滑块停在那里。(3) 关掉"参考模型会说漏洞回答"，再把缰绳彻底放松。概率现在去哪了？'),
      setup: (scene: any, ui, _ctx, world) => {
        scene.emit = (type: string, data?: Record<string, unknown>) => world.emit(type, data);
        scene.slider.attach(ui, 'β, the leash: left loose, right tight', {
          snap: 0.01,
          on_end: () => {
            check_reveal(scene, world);
            const s = scene.state();
            world.emit('released', { beta: scene.beta(), eg: s.eg, er: s.er, can: scene.can.get_value() > 0.5, revealed: !!world.state.revealed });
          },
        });
        scene.switch_.attach(ui, 'can the reference model say the exploit?', () => world.emit('wall', { can: scene.can.get_value() > 0.5 }));
        watch(scene, () => check_reveal(scene, world));
      },
      goals: [
        { id: 'collapse', check: (_s, _c, w) => !!w.state.revealed, message: t('The exploit took over: the proxy reward is at its highest - and here is what a careful reader thinks of these answers.', '漏洞回答接管了一切：代理奖励到了最高——现在看看认真的读者怎么评价这些回答。') },
        { id: 'best', check: (_s, _c, w) => !!w.state.best, message: t('Best true quality near β ≈ 0.6: tight enough to stay where the reward model is right, loose enough to use it.', '真实质量在 β ≈ 0.6 附近最好：缰绳紧到能留在奖励模型靠得住的地方，又松到能用上它。') },
        { id: 'wall', check: (_s, _c, w) => !!w.state.wall, message: t('Where the reference puts zero, no β can put anything. But the reward model’s milder taste for wordiness still wins.', '参考模型给 0 的地方，β 再小也放不进概率。但奖励模型对啰嗦的偏爱，照样赢了。') },
      ],
      detectors: [
        {
          id: 'release', on: (e, w) => {
            if (e.type !== 'released') return null;
            const d = e.data as { beta: number; eg: number; can: boolean; revealed: boolean };
            if (d.revealed && d.can && d.eg >= 0.55) w.state.best = true;
            if (!d.can && d.beta <= 0.06) w.state.wall = true;
            if (d.revealed && d.can && d.beta < 0.3) return { kind: 'misconception', id: 'reward-up-means-better' };
            return null;
          },
        },
      ],
      lines: [
        { text: t('Grey outlines are the reference model. Solid bars are the best policy for this β.', '灰色空心条是参考模型；实心条是这个 β 下的最优策略。'), when: 'enter' },
        { text: t('Drag the gold slider to the left, slowly.', '慢慢把金色滑块往左拖。'), when: 'idle' },
        { text: t('Now you can see the true quality. Watch the green dots on the right while you move β back.', '现在看得到真实质量了。往回拖 β 的时候，盯住右边的绿点。'), when: { event: 'revealed' } },
        { text: t('The proxy reward is still climbing here, but the true quality is falling. Loosening the leash further only feeds the exploit.', '这里代理奖励还在涨，真实质量却在跌。缰绳再放松，只是在喂那个漏洞。'), when: { finding: 'reward-up-means-better' } },
        { text: t('The leash limits how far you exploit the reward model. It does not fix the reward model.', '缰绳限制的是你能把奖励模型的毛病利用到多远，它修不好奖励模型本身。'), when: 'goal' },
      ],
      hints: [t('In step 2 watch E[g], not E[r].', '第 2 步看 E[g]，不要看 E[r]。'), t('The wall: the switch next to the trace, then β all the way left.', '那堵墙：轨迹图旁边的开关，然后把 β 拖到最左。')],
      solve: (s: any, _c, w) => {
        s.lb.set_value(Math.log10(0.2));
        check_reveal(s, w);
        const rel = () => {
          const st = s.state();
          w.emit('released', { beta: s.beta(), eg: st.eg, er: st.er, can: s.can.get_value() > 0.5, revealed: !!w.state.revealed });
        };
        rel();
        s.lb.set_value(Math.log10(0.62));
        rel();
        s.can.set_value(0);
        s.lb.set_value(-2);
        rel();
      },
    },
    {
      id: 'leash-takeaway', kind: 'read', title: t('What the world showed', '刚才看到了什么'),
      blocks: [
        list([
          ['**The proxy reward only goes up** as the leash loosens. If you watch only the reward during training, every step looks like progress.', '**代理奖励只会往上走**：缰绳越松它越高。训练时如果只盯着奖励，每一步看上去都在进步。'],
          ['**True quality rises, then falls.** Near the reference, the reward model is right and following it helps; far away, it is exploited.', '**真实质量先升后降**：在参考模型附近，奖励模型是对的，跟着它走有好处；离远了，它就被钻了空子。'],
          ['**Committing to one answer costs −log π_ref of it in KL**: 6.9 nats for an answer the reference gives 0.1%.', '**把全部概率押在一个回答上，KL 代价是它的 −log π_ref**：参考概率 0.1% 的回答，代价是 6.9 nat。'],
          ['**The wall.** What the reference never says, the optimum never says. But the reward model’s milder bias (wordiness) still wins: KL does not fix a reward model, it only limits how far its flaws are used.', '**那堵墙**：参考模型绝不会说的，最优策略也绝不会说。但奖励模型较温和的偏好（啰嗦）照样赢了：KL 修不好奖励模型，只是限制了它的毛病被利用到多远。'],
        ]),
        note('The eight answers and their scores are made up; π* is the exact closed form for them. In real training π* is approached by sampling, never computed.', '八个回答和它们的分数是虚构的；π* 是对它们的精确闭式解。真实训练中，π* 只能靠采样去逼近，从来算不出来。', ['Honest label', '说明']),
      ],
    },

    // ---------------------------------------------------------------- 3. the real evidence
    {
      id: 'gao', kind: 'read', chapter: t('In real training', '真实训练里'), title: t('Over-optimization, measured', '量出来的过度优化'),
      blocks: [
        p('Gao, Schulman and Hilton measured this effect at scale[^gao]. To have a "true" reward they could query freely, they used a large 6B reward model as the gold standard and trained smaller proxy reward models on its labels - a synthetic setup, not humans. Optimizing a proxy, the gold score rose, peaked and fell as the policy moved away from where it started:',
          'Gao、Schulman 和 Hilton 在大规模上量过这个现象[^gao]。为了有一个能随便查询的"真实"奖励，他们拿一个 6B 的大奖励模型当金标准，用它的标签训练较小的代理奖励模型——这是合成的设定，不是真人。优化代理奖励时，随着策略离起点越来越远，金标准分数先升、到顶、再降：'),
        fig('overopt.svg', ['A schematic: the proxy reward rises steadily with √KL while the gold reward rises, peaks and falls.', '示意图：代理奖励随 √KL 一路上升，真实奖励先升、到顶、再降。'],
          ['Shape after Gao et al.: for RL they fit R(d) = d(α − β log d) with d = √KL (this β is a fitted constant, not the KL coefficient). Larger proxy reward models over-optimize less.', '形状依据 Gao 等人：对 RL 他们拟合出 R(d) = d(α − β log d)，d = √KL（这里的 β 是拟合常数，不是 KL 系数）。代理奖励模型越大，过度优化越轻。'], 'Schematic; shape after Gao et al. (2022)'),
        p('What it looks like in practice: answers get longer[^singhal], repetitive, switch languages or drift into nonsense, while the reward keeps climbing. The fixes:', '在实践中，它的样子是：回答越来越长[^singhal]、开始重复、中英混杂，甚至胡言乱语，奖励却还在涨。对策：'),
        list([
          ['Decide when to stop with an **independent** evaluation (people, or a stronger judge not used for training) - never with the training reward.', '用**独立的**评估决定何时停（人工，或者一个没用于训练的更强评委）——永远不要用训练用的奖励。'],
          ['A larger β; a larger or better reward model; several reward models averaged (Gemma 3 averages weights[^warm]).', '加大 β；用更大或更好的奖励模型；把多个奖励模型平均起来（Gemma 3 对权重做平均[^warm]）。'],
          ['Re-label fresh samples from the current policy and update the reward model; penalize or control for length.', '用当前策略的新样本重新标注、更新奖励模型；对长度做惩罚或校正。'],
        ]),
        open_q('Does a KL penalty fix over-optimization, or only act like early stopping? In Gao et al.’s RL runs the penalty did not improve the gold-score-vs-KL frontier ("akin to early stopping"), with the caveat that it may be sensitive to hyperparameters.', 'KL 惩罚能修好过度优化，还是只相当于提前停止？在 Gao 等人的 RL 实验里，惩罚并没有改善"金标准分数-KL"的边界（"近似于提前停止"），但他们也提醒这可能对超参数敏感。'),
        cite('gao', 'Gao et al. 2022', 'Scaling Laws for Reward Model Overoptimization', 'https://arxiv.org/abs/2210.10760'),
        cite('singhal', 'Singhal et al. 2023', 'A Long Way to Go: Investigating Length Correlations in RLHF', 'https://arxiv.org/abs/2310.03716'),
        cite('warm', 'Ramé et al. 2024', 'WARM: On the Benefits of Weight Averaged Reward Models', 'https://arxiv.org/abs/2401.12187'),
      ],
    },
    {
      id: 'kl-impl', kind: 'read', title: t('How the KL is implemented', 'KL 在实现里长什么样'),
      blocks: [
        p('RLHF with PPO puts the leash into the reward itself. Every token pays the log-ratio, and the reward model’s score is added at the last token (InstructGPT[^instructgpt]):', '用 PPO 做 RLHF 时，缰绳被直接写进奖励：每个 token 都付它的对数比，奖励模型的分数加在最后一个 token 上（InstructGPT[^instructgpt]）：'),
        math('r_t = -\\beta\\,\\log\\frac{\\pi_\\theta(y_t\\mid s_t)}{\\pi_{ref}(y_t\\mid s_t)} \\;+\\; [t = T]\\; r_\\phi(x, y)'),
        p('Why does that implement the KL? The sequence KL is an expectation over answers of the log-ratio, and the log-ratio of an answer is the sum of its tokens’ log-ratios. So for one answer sampled from π, the summed token penalties are an unbiased one-sample estimate of the KL.', '为什么这样就是 KL？序列的 KL 是"回答的对数比"的期望，而一条回答的对数比等于各 token 对数比之和。所以对一条从 π 采样的回答，各 token 惩罚之和就是 KL 的单样本无偏估计。'),
        list([
          ['**Negative KL readings** usually are not a bug: one sample’s log-ratio can be negative, and if answers are sampled with top-k, top-p or a changed temperature they are not samples from π, so even the average can go negative.', '**KL 读数为负**通常不是 bug：单个样本的对数比本来就可能为负；而如果用 top-k、top-p 或改过的温度采样，样本就不是来自 π 本身，连平均值都可能为负。'],
          ['A non-negative alternative per token, k3 = π_ref/π − log(π_ref/π) − 1, is also unbiased[^kl]; GRPO uses it (E1).', '每个 token 上还有一个非负的替代 k3 = π_ref/π − log(π_ref/π) − 1，同样无偏[^kl]；GRPO 用的就是它（E1）。'],
          ['β can be adjusted automatically to keep the KL near a target[^ziegler]. InstructGPT also mixed in a pretraining loss ("PPO-ptx") to keep general ability.', 'β 可以自动调节，让 KL 保持在目标值附近[^ziegler]。InstructGPT 还混入了预训练损失（"PPO-ptx"），以保住通用能力。'],
        ]),
        cite('instructgpt', 'Ouyang et al. 2022', 'Training language models to follow instructions with human feedback (InstructGPT)', 'https://arxiv.org/abs/2203.02155'),
        cite('kl', 'Schulman 2020', 'Approximating KL Divergence (blog)', 'http://joschu.net/blog/kl-approx.html'),
        cite('ziegler', 'Ziegler et al. 2019', 'Fine-Tuning Language Models from Human Preferences', 'https://arxiv.org/abs/1909.08593'),
      ],
    },
    {
      id: 'cost', kind: 'read', title: t('Four models in memory', '显存里的四个模型'),
      blocks: [
        fig('rlhf-ppo.svg', ['Data flow of RLHF with PPO: the policy samples, the frozen reward model scores, the frozen reference gives the KL term, the trained value model gives advantages, and the policy and value model are updated.', 'PPO 做 RLHF 的数据流：策略采样，冻结的奖励模型打分，冻结的参考模型给出 KL 项，训练中的价值模型给出优势，最后更新策略和价值模型。'],
          ['One PPO step needs four models: two trained (policy, value), two frozen (reference, reward).', 'PPO 的一步需要四个模型：两个在训练（策略、价值模型），两个冻结（参考模型、奖励模型）。'], 'Original; after InstructGPT (Ouyang et al., 2022)'),
        p('With the memory rule from C1 (full fine-tuning ≈ 16 bytes per parameter, a frozen bf16 model 2 bytes per parameter), four 8B models need about 2 × 128 + 2 × 16 = 288 GB before activations - and generating the samples is the slowest part, which is why systems such as OpenRLHF and verl pair the trainer with a fast inference engine.',
          '按 C1 的显存规则（全量微调每参数约 16 字节，冻结的 bf16 模型每参数 2 字节），四个 8B 模型在不算激活值的情况下约需 2 × 128 + 2 × 16 = 288 GB；而生成样本是最慢的一环，所以 OpenRLHF、verl 这类系统把训练器和高速推理引擎接在一起。'),
        fig('memory.svg', ['Bars: policy 128 GB, value model 128 GB, reference 16 GB, reward model 16 GB, total 288 GB; Hub model counts with the trl tag: PPO 894, DPO 10,532, GRPO 14,257.', '柱状图：策略 128 GB、价值模型 128 GB、参考模型 16 GB、奖励模型 16 GB，合计 288 GB；Hub 上带 trl 标签的模型数：PPO 894、DPO 10,532、GRPO 14,257。'],
          ['The cost is why the field moved on: GRPO drops the value model (E1), DPO drops the reward model and the sampling loop (D3).', '代价正是这条路被替代的原因：GRPO 去掉了价值模型（E1），DPO 去掉了奖励模型和采样循环（D3）。'], 'Memory: rule from C1; counts: Hugging Face Hub, 2026-10'),
      ],
    },
    {
      id: 'memory-q', kind: 'checkpoint', skill: 'rlhf-cost', purpose: 'check', title: t('Count the memory', '算显存'),
      prompt: t('Full-parameter PPO on an 8B policy with an 8B value model; the reference and reward models are 8B too, frozen in bf16. Ignoring activations, about how many GB?', '对一个 8B 的策略做全参数 PPO，价值模型也是 8B；参考模型和奖励模型同样是 8B，以 bf16 冻结。不算激活值，大约要多少 GB？'),
      question: {
        type: 'number', answer: 288, rtol: 0.1, unit: t('GB', 'GB'),
        wrong: [
          { answer: 128, feedback: t('That is the policy alone. The value model is trained too, and two frozen models sit beside them.', '这只是策略本身。价值模型也在训练，旁边还有两个冻结的模型。') },
          { answer: 512, feedback: t('Frozen models need no gradients or optimizer state: 2 bytes per parameter, not 16.', '冻结的模型不需要梯度和优化器状态：每参数 2 字节，不是 16。') },
        ],
      },
      explain: t('2 × (16 B × 8B) + 2 × (2 B × 8B) = 256 + 32 = 288 GB.', '2 × (16 B × 8B) + 2 × (2 B × 8B) = 256 + 32 = 288 GB。'),
    },
    {
      id: 'diagnose-q', kind: 'checkpoint', skill: 'overoptimization', purpose: 'check', title: t('Read the curves', '读曲线'),
      prompt: t('At step 6k of RLHF the reward-model score is still rising and the KL has grown from 2 to 15 nats. Human win rate against the SFT model was 58% at step 2k and is 47% now. Answers are twice as long and often open with "Great question!". What happened, and what do you do?', 'RLHF 训练到第 6k 步，奖励模型的分数还在涨，KL 从 2 涨到了 15 nat。对 SFT 模型的人工胜率在第 2k 步是 58%，现在是 47%。回答长了一倍，开头常是"好问题！"。发生了什么？怎么办？'),
      question: {
        type: 'choice', options: [
          { id: 'a', label: t('Over-optimization: the policy is exploiting the reward model’s taste for length and flattery; stop near 2k by the human evaluation, raise β, retrain the reward model on fresh, length-balanced samples', '过度优化：策略在钻奖励模型偏爱长度和奉承的空子；按人工评估在 2k 步附近停，加大 β，用新的、长度配平的样本重训奖励模型'), correct: true },
          { id: 'b', label: t('The learning rate is too high; lower it and keep training', '学习率太高；调低后继续训练'), misconception: 'reward-up-means-better', feedback: t('The reward going up while people like the answers less is the signature of the reward model being exploited, not of a bad learning rate.', '奖励在涨、人却越来越不喜欢，这是奖励模型被钻空子的典型特征，不是学习率的问题。') },
          { id: 'c', label: t('Nothing is wrong: the reward is still rising', '没问题：奖励还在涨'), misconception: 'reward-up-means-better' },
        ],
      },
      explain: t('Proxy up, gold down, longer and more flattering answers: the Gao et al. curve. Decide with the independent evaluation; KL and better reward models limit the damage.', '代理奖励上升、真实质量下降、回答更长更会奉承：这正是 Gao 等人的那条曲线。用独立的评估来决定停点；KL 和更好的奖励模型能限制损害。'),
    },
    {
      id: 'explain-q', kind: 'checkpoint', skill: 'kl-optimum', purpose: 'check', title: t('In your own words', '用自己的话说'),
      prompt: t('Why does RLHF need the KL term at all? Answer in two sentences, and say what the KL term cannot do.', 'RLHF 为什么非要有 KL 这一项？用两句话回答，并说出 KL 这一项做不到什么。'),
      question: text_q([
        ['The reward model is only reliable near the data it was trained on (near the reference policy)', '奖励模型只在它的训练数据附近（参考策略附近）可靠'],
        ['Without a leash the policy moves to answers the reward model over-rates (reward hacking)', '没有缰绳，策略会跑到奖励模型高估的回答上（奖励投机）'],
        ['KL does not fix the reward model’s biases; it only limits how far they are exploited', 'KL 修不好奖励模型的偏差，只是限制它们被利用到多远'],
      ], ['The reward model is only accurate near the answers it was trained on, so an unconstrained optimizer drifts to answers it over-rates; the KL term keeps the policy near the reference, where the reward can be trusted. It does not remove the reward model’s biases - it only limits how far they can be exploited.', '奖励模型只在它训练过的那类回答附近准确，不加约束的优化器会漂到它高估的回答上；KL 把策略拴在参考模型附近，那里的奖励才靠得住。它去不掉奖励模型的偏差，只是限制这些偏差能被利用到多远。'], 2),
    },
    {
      id: 'card', kind: 'read', chapter: t('How to choose', '怎么选'), title: t('What D2b adds to the map', 'D2b 给决策图加了什么'),
      blocks: choose_card({
        upto: 'D2b', highlight: 'R',
        rule: t('If you optimize against a learned reward (a reward model or a judge), keep a KL leash or stop early, and decide where to stop with an independent evaluation, never with the training reward.',
          '如果你在优化一个学出来的奖励（奖励模型或评委），就要拴上 KL 缰绳或者提前停，并用独立的评估决定在哪停，绝不用训练用的奖励。'),
        counter: t('"The reward is still going up, so keep training." Tempting because the curve looks like progress; wrong because the true quality rises and then falls as the policy moves away from the reference (Gao et al., 2022).',
          '"奖励还在涨，那就接着训。"诱人之处是曲线看上去像在进步；错在随着策略离参考模型越来越远，真实质量会先升后降（Gao 等，2022）。'),
        extra: [note('Correctness that a program can check (math, tests) needs no learned reward at all: that is RLVR (E1), with nothing for the policy to exploit except the verifier itself.', '能用程序判对错的任务（数学、测试）根本不需要学来的奖励：那是 RLVR（E1），策略能钻的空子只剩验证器本身。')],
      }),
    },
  ],
};

