// E1 可验证奖励与 GRPO / Verifiable rewards and GRPO.
// Plan: docs/lessons/llm-finetuning/part-e-reasoning.md (E1); facts:
// research-technical.md §6, research-reasoning.md, research-adoption.md §4.
// Order: what problem RLVR solves -> the one idea (a group baseline) -> the
// math of the baseline -> hold it (world) -> what goes wrong (zero-variance
// groups, length bias) and the fixes -> graders -> practice and choosing.
import type { Lesson } from '@mathnim/core';
import { choose_card, fig, t, vis, world_setup } from './common';

const CODE_SCRATCH = `import torch

def group_advantages(rewards, G, scale="group", eps=1e-4):
    r = rewards.view(-1, G)                        # one row per question
    adv = r - r.mean(dim=1, keepdim=True)          # the group baseline
    if scale == "group":
        adv = adv / (r.std(dim=1, keepdim=True) + eps)
    elif scale == "batch":
        adv = adv / (r.std() + eps)
    zero = (r.std(dim=1) < 1e-6).float().mean()    # share of zero-variance groups
    return adv.view(-1), zero

def grpo_loss(logp, old_logp, adv, mask, eps_low=0.2, eps_high=0.28, agg="token", L_max=None):
    ratio = torch.exp(logp - old_logp)             # importance ratio of every token
    a = adv.unsqueeze(1)                           # one advantage for all tokens of an answer
    surr = torch.min(ratio * a, torch.clamp(ratio, 1 - eps_low, 1 + eps_high) * a)
    per_tok = -surr * mask                         # loss = minus the objective
    if agg == "sequence":                          # original GRPO: mean inside each answer
        return (per_tok.sum(1) / mask.sum(1)).mean()
    if agg == "token":                             # DAPO: mean over all tokens of the batch
        return per_tok.sum() / mask.sum()
    return per_tok.sum() / (mask.shape[0] * L_max) # Dr. GRPO: divide by a constant`;

const CODE_TRL = `import re
from datasets import load_dataset
from peft import LoraConfig
from trl import GRPOConfig, GRPOTrainer

SYSTEM = "Think inside <think></think>, then put only the final number inside <answer></answer>."
ds = load_dataset("openai/gsm8k", "main", split="train").map(lambda ex: {
    "prompt": [{"role": "system", "content": SYSTEM}, {"role": "user", "content": ex["question"]}],
    "gold": ex["answer"].split("####")[-1].strip().replace(",", "")})

ANSWER = re.compile(r"<answer>\\s*(-?\\d[\\d,]*\\.?\\d*)\\s*</answer>")
def correctness(completions, gold, **kwargs):      # dataset columns arrive as keyword arguments
    out = []
    for c, g in zip(completions, gold):
        tags = ANSWER.findall(c[0]["content"])        # exactly one answer tag, compared as a number
        ok = len(tags) == 1 and abs(float(tags[0].replace(",", "")) - float(g)) < 1e-6
        out.append(1.0 if ok else 0.0)
    return out                                     # one float per completion

def fmt(completions, **kwargs):
    pat = re.compile(r"^<think>.*?</think>\\s*<answer>.*?</answer>\\s*$", re.S)
    return [0.2 if pat.match(c[0]["content"]) else 0.0 for c in completions]

args = GRPOConfig(output_dir="grpo-gsm8k", num_generations=8, max_completion_length=512,
    learning_rate=5e-6, beta=0.0, epsilon=0.2, epsilon_high=0.28, loss_type="dapo",
    scale_rewards="group", mask_truncated_completions=True, use_vllm=True,
    per_device_train_batch_size=8, gradient_accumulation_steps=4)
trainer = GRPOTrainer(model="Qwen/Qwen2.5-1.5B-Instruct", reward_funcs=[correctness, fmt],
    args=args, train_dataset=ds, peft_config=LoraConfig(r=8, lora_alpha=16, target_modules="all-linear"))
trainer.train()`;

/** Length ratio between the longest and the shortest wrong answer of a grpo_group scene. */
const wrong_len_ratio = (s: any): number => {
  const r: number[] = s.rewards(), L: number[] = s.lengths();
  const w = L.filter((_, i) => r[i] === 0);
  return w.length >= 2 ? Math.max(...w) / Math.min(...w) : 1;
};

export const lesson: Lesson = {
  id: 'ft-e1-rlvr-grpo',
  title: t('Verifiable rewards and GRPO', '可验证奖励与 GRPO'),
  description: t(
    'When answers can be checked by a program, let the model try each question several times and learn from how each try compares with its own average. The group baseline, what breaks it, the 2026 defaults, and how to write a grader.',
    '答案能用程序判对错时，让模型把每道题做好几遍，再看每一遍比自己的平均水平好还是差。本课讲组内基线、它在哪里会出问题、2026 年的常见默认配置，以及怎么写评分器。',
  ),
  mode: 'essay',
  theme: 'light',
  skills: [
    { id: 'rlvr-reward', name: t('What a verifiable reward is, and when to use one', '什么是可验证奖励，什么时候用') },
    { id: 'group-advantage', name: t('Compute group-relative advantages', '计算组内相对优势'), prerequisites: ['rlvr-reward'] },
    { id: 'grpo-objective', name: t('The GRPO objective: ratio, clipping, KL', 'GRPO 目标：比率、截断、KL'), prerequisites: ['group-advantage'] },
    { id: 'grpo-bias', name: t('Zero-variance groups and length bias', '零方差组与长度偏差'), prerequisites: ['group-advantage'] },
    { id: 'grader-design', name: t('Design and test a grader', '设计并检验评分器'), prerequisites: ['rlvr-reward'] },
  ],
  misconceptions: [
    { id: 'wrong-not-penalized', description: t('With 0/1 rewards and no baseline, wrong answers are pushed down.', '奖励是 0/1、不减基线时，错误回答会被直接压低。') },
    { id: 'zero-var-useful', description: t('A group where every answer is right is the most useful training example.', '全对的那一组样本最有价值。') },
    { id: 'seq-mean-fair', description: t('Averaging the loss inside each answer treats long and short answers alike.', '先在每条回答内部平均损失，对长短回答一视同仁。') },
    { id: 'longer-is-better', description: t('Answers that get longer during RL mean better reasoning.', '强化学习中回答越写越长，说明推理越来越强。') },
    { id: 'grader-unhackable', description: t('A rule-based grader or an LLM judge cannot be gamed.', '规则评分器或大模型评委不会被钻空子。') },
    { id: 'rl-strictly-better', description: t('RL always beats SFT or distillation, whatever the starting point.', '不管起点如何，强化学习总比 SFT 或蒸馏强。') },
  ],
  steps: [
    // ------------------------------------------------------------------ why
    {
      id: 'why', kind: 'read', chapter: t('Why verifiable rewards', '为什么要可验证奖励'), title: t('Practice problems with only the answers', '只给答案的练习题'),
      blocks: [
        { type: 'p', text: t(
          'So far a model learned from two kinds of signal: **demonstrations** (SFT: here is how to do it) and **comparisons** (DPO: this answer is better than that one). For maths and code we often have neither. We have questions with a correct answer, or programs with unit tests, but no worked solutions. What we *can* do is **check**: is the final number right, do the tests pass?',
          '前面几部分里，模型靠两种信号学习：**示范**（SFT：照这样做）和**比较**（DPO：这个回答比那个好）。可数学题、编程题往往两样都没有：只有标准答案，或者一组单元测试，没有现成的解题过程。我们能做的是**检查**：最后的数对不对？测试能不能通过？',
        ) },
        { type: 'p', text: t(
          'Reinforcement learning with such a checkable signal is called **RLVR** (reinforcement learning with verifiable rewards). It is like the practice problems at the back of a textbook that give only the answers: you try, and when you get it right you keep what worked[^karpathy].',
          '用这种"能自动判对错"的信号做强化学习，叫**可验证奖励的强化学习**（reinforcement learning with verifiable rewards, RLVR）。它就像教科书后面只给答案的练习题：自己去做，做对了，就记住是怎么做对的[^karpathy]。',
        ) },
        { type: 'list', items: [
          t('Maths: compare the final number with the reference (after normalising 42.0 and 42).', '数学：把最后的数和标准答案比对（先把 42.0 和 42 这类写法归一）。'),
          t('Code: run the unit tests. SQL: run the query and compare the result.', '代码：跑单元测试。SQL：执行查询，比对结果。'),
          t('Structured output: validate the JSON against a schema. Format: are the <think> and <answer> tags there?', '结构化输出：用 schema 校验 JSON。格式：<think> 和 <answer> 标签齐不齐？'),
        ] },
        { type: 'p', text: t(
          '**Why not train a reward model to score answers, as in D1 and D2b?** A learned reward model is only reliable near its training data, and RL is very good at finding where it is wrong. A program that compares numbers is much harder to fool. DeepSeek-R1-Zero used only rule-based rewards for exactly this reason[^r1].',
          '**为什么不像 D1、D2b 那样，训练一个奖励模型来打分？** 学出来的奖励模型只在它的训练数据附近可信，而强化学习特别擅长找到它判错的地方。一段比对数字的程序就难骗得多。DeepSeek-R1-Zero 只用规则奖励，正是这个原因[^r1]。',
        ) },
        { type: 'callout', kind: 'note', title: t('The whole method in one sentence', '整个方法一句话'), body: t(
          'Let the model answer the same question several times; push up the attempts that did **better than the group\'s average**, push down the ones that did worse. The rest of this lesson turns that sentence into a formula and then fixes what goes wrong with it.',
          '让模型把同一道题做好几遍；**比这一组的平均水平好**的做法，概率推高一点，比平均差的，压低一点。本课剩下的部分，就是把这句话变成公式，再修好它会出的毛病。',
        ) },
        { type: 'details', summary: t('How common is this?', '这种方法有多常用？'), blocks: [
          { type: 'p', text: t(
            'Since R1, verifiable-reward RL is the centre of the post-training recipes of the big labs (Qwen3, OLMo 3, Kimi K2, GLM-5). On Hugging Face, models trained with TRL\'s GRPO already outnumber those trained with its DPO (14,257 vs 10,532). In companies it is less common: about 22% of teams report using RL[^adoption].',
            '自 R1 以来，可验证奖励的强化学习成了各大实验室后训练配方的核心（Qwen3、OLMo 3、Kimi K2、GLM-5）。在 Hugging Face 上，用 TRL 的 GRPO 训练的模型已经多于用它的 DPO 训练的（14,257 对 10,532）。企业里用得少一些：约 22% 的团队自报在用强化学习[^adoption]。',
          ) },
        ] },
        { type: 'cite', key: 'karpathy', text: t('Karpathy\'s textbook analogy (coverage)', 'Karpathy 的教科书类比（报道）'), url: 'https://officechai.com/ai/andrej-karpathy-explains-different-parts-of-training-an-llm-through-the-example-of-a-textbook/' },
        { type: 'cite', key: 'r1', text: t('DeepSeek-AI (2025). DeepSeek-R1, §2.2.2.', 'DeepSeek-AI（2025）。DeepSeek-R1，§2.2.2。'), url: 'https://arxiv.org/abs/2501.12948' },
        { type: 'cite', key: 'adoption', text: t('Hugging Face Hub counts (2026-10-10) and the 2026 AI engineering survey; see research-adoption.md §4.', 'Hugging Face Hub 计数（2026-10-10）与 2026 年 AI 工程调查；见 research-adoption.md §4。'), url: 'https://huggingface.co/models?other=trl,grpo' },
      ],
    },
    // ------------------------------------------------------------------ the baseline
    {
      id: 'p-nobase', kind: 'checkpoint', chapter: t('A baseline from the group', '组内基线'), skill: 'group-advantage', purpose: 'predict', title: t('Before the formula', '先猜一猜'),
      prompt: t(
        'One question, 8 sampled answers: 2 right (reward 1), 6 wrong (reward 0). Take one step of D2a\'s plain REINFORCE, $\\nabla J \\approx \\sum_i r_i\\,\\nabla \\log \\pi(o_i)$, with no baseline. What happens to the probabilities of the 6 wrong answers?',
        '一道题采样了 8 个回答：2 个对（奖励 1），6 个错（奖励 0）。用 D2a 的朴素 REINFORCE 更新一步：$\\nabla J \\approx \\sum_i r_i\\,\\nabla \\log \\pi(o_i)$，不减基线。这 6 个错误回答的概率会怎样？',
      ),
      question: { type: 'choice', options: [
        { id: 'down', label: t('They are pushed down directly', '被直接压低'), misconception: 'wrong-not-penalized', feedback: t('Their term is $0 \\cdot \\nabla\\log\\pi$: nothing pushes them down. They only shrink because the two right answers grow and probabilities sum to 1.', '它们那一项是 $0 \\cdot \\nabla\\log\\pi$：没有任何力量压低它们。它们变小，只是因为两个对的回答变大了，而概率总和是 1。') },
        { id: 'none', label: t('Nothing pushes them; they shrink only because the right answers grow', '没有力量推它们；它们变小只是因为对的回答变大了'), correct: true },
        { id: 'up', label: t('They are pushed up a little', '被稍微抬高') },
        { id: 'len', label: t('It depends on how long they are', '要看它们有多长') },
      ] },
      explain: t('With 0/1 rewards and no baseline, a wrong answer\'s coefficient is exactly 0. All the signal comes from the right answers, so learning is slow and noisy. The next page fixes that.', '奖励是 0/1、又不减基线时，错误回答前面的系数恰好是 0。全部信号都来自对的回答，所以学得慢、噪声大。下一页解决这个问题。'),
    },
    {
      id: 'derive-baseline', kind: 'derive', skill: 'group-advantage', title: t('Compare with the group\'s average', '和同组的平均分比'),
      intro: t(
        'Intuition first: whether 1 point is good news depends on how often the model solves this question anyway. So measure each attempt against the **average reward of its own group**. Above average: push it up. Below: push it down. Here is why that is allowed, and how it relates to RLOO.',
        '先讲直觉：拿到 1 分算不算好消息，要看这道题模型平时能做对几成。所以每次尝试都拿**同组的平均分**作参照：高于平均就推高，低于平均就压低。下面推导为什么可以这样做，以及它和 RLOO 的关系。',
      ),
      lines: [
        { tex: '\\nabla J = \\mathbb E_q\\,\\mathbb E_{o\\sim\\pi_\\theta}\\big[r(q,o)\\,\\nabla\\log\\pi_\\theta(o\\mid q)\\big]', why: t('The policy gradient from D2a. The reward comes from a program, so it needs no gradient.', 'D2a 推过的策略梯度。奖励由程序给出，不需要对它求导。') },
        { tex: '\\mathbb E_o\\big[b(q)\\,\\nabla\\log\\pi(o\\mid q)\\big] = b(q)\\,\\nabla\\!\\sum_o \\pi(o\\mid q) = b(q)\\,\\nabla 1 = 0', why: t('Recap of D2a: a baseline $b(q)$ that ignores the answer adds zero on average, so subtracting it keeps the average gradient and changes only the noise.', '回顾 D2a：不看回答的基线 $b(q)$ 平均下来是 0，所以减掉它，梯度的期望不变，变的只是噪声。') },
        { tex: '\\nabla J = \\mathbb E\\big[(r - b(q))\\,\\nabla\\log\\pi(o\\mid q)\\big],\\qquad b(q)\\approx p(q) = \\Pr[r = 1]', why: t('The best simple baseline is about the question\'s success rate. Then a right answer gets $1-p$ and a wrong one $-p$: wrong answers are now pushed down.', '最好的简单基线约等于这道题的成功率。于是对的回答系数是 $1-p$，错的是 $-p$：错误回答终于被直接压低了。') },
        { tex: '\\bar r = \\tfrac1G\\textstyle\\sum_{j=1}^G r_j \\;\\approx\\; p(q)', why: t('PPO trains a value model, as big as the policy, to estimate this. GRPO simply samples G answers to the same question and averages their rewards. No value model.', 'PPO 要训练一个和策略一样大的价值模型来估计它。GRPO 直接对同一道题采样 G 个回答，取平均分。不需要价值模型。') },
        { tex: 'r_i - \\bar r = \\tfrac{G-1}{G}\\Big(r_i - \\tfrac{1}{G-1}\\textstyle\\sum_{j\\ne i} r_j\\Big)', why: t('The mean includes $r_i$ itself, but the bracket is exactly the leave-one-out (RLOO) baseline, which is unbiased. So the group mean is RLOO times a constant: the direction is right.', '平均分里包含了 $r_i$ 自己，但括号里正好是留一法（RLOO）基线，它是无偏的。所以组均值基线就是 RLOO 乘一个常数：方向没有偏。') },
        { tex: '\\hat A_i = \\frac{r_i - \\bar r}{\\sigma},\\qquad \\sigma = \\sqrt{\\hat p\\,(1-\\hat p)},\\; \\hat p = k/G', why: t('GRPO also divides by the group\'s standard deviation, so every question gets advantages on the same scale. With 0/1 rewards and k right answers, $\\sigma$ depends only on $\\hat p = k/G$.', 'GRPO 还要除以组内标准差，让每道题的优势都在同一个尺度上。奖励是 0/1、k 个对时，$\\sigma$ 只取决于 $\\hat p = k/G$。') },
        { tex: '\\hat A_+ = \\sqrt{\\frac{1-\\hat p}{\\hat p}}', why: t('Put $r_i = 1$ and $\\bar r = \\hat p$ into the line above and simplify.', '把 $r_i = 1$、$\\bar r = \\hat p$ 代入上一行，化简即得。') },
        { tex: '\\hat A_- = -\\sqrt{\\frac{\\hat p}{1-\\hat p}},\\qquad \\textstyle\\sum_i \\hat A_i = 0', why: t('For 2 right out of 8: +1.73 and -0.58. The advantages always add up to zero: the group pushes up and down by the same total amount.', '8 个里 2 个对时：+1.73 和 −0.58。优势加起来总是 0：这一组往上推和往下压的总量一样大。') },
      ],
      blank: { line: 6, answer: 'sqrt((1-p)/p)', variables: ['p'], ranges: { p: [0.1, 0.9] }, prompt: t('Your turn: the advantage of a right answer, in terms of $\\hat p$ (write it as p).', '轮到你：用 $\\hat p$（写成 p）表示正确回答的优势。') },
      outro: t('In words: the baseline is the question\'s own average, so no value model is needed; dividing by σ only puts every question on the same scale.', '换成一句话：基线就是这道题自己的平均分，所以不需要价值模型；除以 σ 只是让每道题的尺度一致。'),
    },
    {
      id: 'p-flip', kind: 'checkpoint', skill: 'group-advantage', purpose: 'predict', title: t('Predict before you touch it', '动手前先预测'),
      prompt: t(
        'With 2 right and 6 wrong, each wrong answer has advantage $-0.58$. Flip **one** wrong answer to right (3 right, 5 wrong). What happens to the advantage of the wrong answers that stay wrong?',
        '2 对 6 错时，每个错误回答的优势是 $-0.58$。把其中**一张**错卡翻成对（变成 3 对 5 错）。仍然错着的那些回答，优势会怎样？',
      ),
      question: { type: 'choice', options: [
        { id: 'same', label: t('Unchanged: I did not touch them', '不变：我又没动它们') },
        { id: 'more', label: t('More negative', '变得更负'), correct: true },
        { id: 'less', label: t('Less negative', '没那么负了') },
        { id: 'zero', label: t('Zero', '变成 0') },
      ] },
      explain: t('Check it in the next step: the baseline is the group\'s average, so one flip moves every bar.', '下一步亲手验证：基线是全组的平均分，所以翻一张，所有柱子都会动。'),
    },
    {
      id: 'w-flip', kind: 'explore', skill: 'group-advantage', title: t('One group of answers', '一组回答'),
      scene: vis('grpo_group', { right: [1, 1, 0, 0, 0, 0, 0, 0] }),
      prompt: t(
        'Each card is one answer to the same question; drag the switch on its right to make it right ✓ or wrong ✗ (that is its reward). The bars are the advantages. **1.** Give the only right answer the biggest push you can. **2.** Find a group from which training learns nothing, then press **Update one step** to confirm.',
        '每张卡是同一道题的一个回答；拖动卡片右边的开关，把它设成对 ✓ 或错 ✗（这就是它的奖励）。柱子是优势。**1.** 让唯一一个正确回答得到尽可能大的推力。**2.** 找出一组"训练什么也学不到"的结果，再按**更新一步**验证。',
      ),
      setup: world_setup((_s, w) => {
        w.state.zero_updates = 0;
      }),
      actions: [{ id: 'update', label: t('Update one step', '更新一步'), primary: true, run: (s: any) => s.update_step() }],
      goals: [
        { id: 'max_one', check: (s: any) => s.k() === 1 && s.opts().baseline && s.opts().std, message: t('One right answer out of 8: it beats the average by the most, $\\hat A = \\sqrt 7 \\approx 2.65$.', '8 个里只有 1 个对：它比平均好得最多，$\\hat A = \\sqrt 7 \\approx 2.65$。') },
        { id: 'no_signal', check: (_s, _c, w) => !!w.state.saw_zero_update, message: t('All the same: every advantage is 0, and the update leaves p where it was.', '全都一样：每个优势都是 0，更新一步，p 原地不动。') },
      ],
      detectors: [
        { id: 'flip-moves-all', on: (e) => (e.type === 'flip' ? { kind: 'progress', id: 'flip-moves-all', message: t('You flipped one card, and every bar moved: the baseline is the whole group\'s average.', '你只翻了一张卡，可每根柱子都动了：基线是全组的平均分。') } : null) },
        {
          id: 'zero-twice', on: (e, w) => {
            if (e.type !== 'update') return null;
            if (e.data!.zero) {
              w.state.saw_zero_update = true;
              w.state.zero_updates = ((w.state.zero_updates as number) ?? 0) + 1;
            } else w.state.zero_updates = 0;
            return (w.state.zero_updates as number) >= 2 ? { kind: 'misconception', id: 'zero-var-useful', message: t('Every advantage in this group is 0, so no number of updates will move p. An all-right (or all-wrong) group carries no signal.', '这一组的优势全是 0，更新多少次 p 都不会动。全对（或全错）的组没有学习信号。') } : null;
          },
        },
        { id: 'baseline-off', on: (e) => (e.type === 'baseline' && !e.data!.on ? { kind: 'progress', id: 'baseline-off', message: t('Without the baseline the wrong answers\' bars are 0: they are not pushed down at all.', '去掉基线后，错误回答的柱子变成 0：它们根本不会被压低。') } : null) },
      ],
      lines: [
        { text: t('Each bar is how much better that answer did than its group.', '每根柱子表示：这个回答比同组平均好多少。'), when: 'enter' },
        { text: t('Drag the switch on the right of a card.', '拖一下卡片右边的开关。'), when: 'idle' },
        { text: t('One flip, and every bar moved.', '只翻了一张，所有柱子都动了。'), when: { finding: 'flip-moves-all' } },
        { text: t('Every bar is zero. Pressing update again changes nothing: this group has no signal.', '每根柱子都是零。再按更新也没用：这一组没有信号。'), when: { finding: 'zero-var-useful' } },
        { text: t('Without a baseline, only the right answers move.', '没有基线时，只有对的回答在动。'), when: { finding: 'baseline-off' } },
      ],
      solve: (s: any) => {
        s.r.forEach((tr: any, i: number) => tr.set_value(i === 0 ? 1 : 0));
        s.on('flip', { i: 0, right: true, k: 1, zero: false });
        s.r.forEach((tr: any) => tr.set_value(1));
        s.update_step();
      },
    },
    {
      id: 'q-adv', kind: 'checkpoint', skill: 'group-advantage', purpose: 'check', title: t('Compute it', '算一算'),
      prompt: t('8 answers, 3 right. With the group\'s population standard deviation (divide by G), what is the advantage of a right answer?', '8 个回答里 3 个对。用组内总体标准差（除以 G），正确回答的优势是多少？'),
      question: { type: 'number', answer: Math.sqrt(5 / 3), tolerance: 0.02, wrong: [
        { answer: 0.625, feedback: t('That is $r_i - \\bar r$. Divide by $\\sigma = \\sqrt{0.375 \\cdot 0.625} = 0.484$.', '这是 $r_i - \\bar r$。还要除以 $\\sigma = \\sqrt{0.375 \\cdot 0.625} = 0.484$。') },
        { answer: 0.714, feedback: t('That is the RLOO value $1 - 2/7$; GRPO uses the mean of all 8 and divides by σ.', '这是 RLOO 的值 $1 - 2/7$；GRPO 用的是全部 8 个的平均，并且要除以 σ。') },
        { answer: 1.208, feedback: t('That uses the sample std (divide by G − 1), as torch.std does. The question asks for the population std.', '这是用样本标准差（除以 G − 1）算的，torch.std 就是这样。题目要的是总体标准差。') },
      ] },
      explain: t('$\\hat p = 3/8$, so $\\hat A_+ = \\sqrt{(5/8)/(3/8)} = \\sqrt{5/3} \\approx 1.29$, and a wrong answer gets $-\\sqrt{3/5} \\approx -0.77$.', '$\\hat p = 3/8$，所以 $\\hat A_+ = \\sqrt{(5/8)/(3/8)} = \\sqrt{5/3} \\approx 1.29$，错误回答是 $-\\sqrt{3/5} \\approx -0.77$。'),
    },
    {
      id: 'zero', kind: 'read', title: t('Easy questions waste compute', '太容易的题在浪费算力'),
      blocks: [
        { type: 'p', text: t(
          'You just saw it: when all G answers agree, every advantage is 0. That happens for questions that are **too easy** (all right) or **too hard** (all wrong) for the current model. Every sample of such a group was generated and graded for nothing.',
          '你刚才亲眼看到了：G 个回答全都一样时，每个优势都是 0。对当前模型来说**太容易**（全对）或**太难**（全错）的题，都会这样。这一组的每个回答，都白生成、白判分了。',
        ) },
        fig('zero_var', t('Exact: a question the model solves with probability p gives an all-same group with probability pᴳ + (1 − p)ᴳ.', '精确计算：模型以概率 p 做对的题，一组 G 个回答全都一样的概率是 pᴳ + (1 − p)ᴳ。')),
        { type: 'p', text: t(
          'Training makes it worse: as questions become easy, more and more groups go silent and the effective batch shrinks. Two fixes are common. **Dynamic sampling** (DAPO) samples extra questions and drops the groups with accuracy 0 or 1 until the batch is full[^dapo]. **ScaleRL** filters zero-variance groups and also stops resampling questions the model already solves almost always[^scalerl]. TRL logs the share of such groups as `frac_reward_zero_std`.',
          '训练会让情况更糟：题目越练越容易，"沉默"的组越来越多，有效批量越来越小。常见的修法有两种。**动态采样**（DAPO）：多采一些题，把正确率为 0 或 1 的组丢掉，直到批次填满[^dapo]。**ScaleRL**：过滤零方差组，并且不再重复采样那些已经几乎总能做对的题[^scalerl]。TRL 会把这类组的比例记成 `frac_reward_zero_std`。',
        ) },
        { type: 'cite', key: 'dapo', text: t('Yu et al. (2025). DAPO.', 'Yu 等（2025）。DAPO。'), url: 'https://arxiv.org/abs/2503.14476' },
        { type: 'cite', key: 'scalerl', text: t('The Art of Scaling Reinforcement Learning Compute for LLMs (ScaleRL, 2025).', 'The Art of Scaling Reinforcement Learning Compute for LLMs（ScaleRL，2025）。'), url: 'https://arxiv.org/abs/2510.13786' },
      ],
    },
    {
      id: 'q-g', kind: 'checkpoint', skill: 'grpo-bias', purpose: 'check', title: t('Budget the group', '给组的大小做预算'),
      prompt: t('A question the model solves 90% of the time. What is the smallest group size G for which the group gives a learning signal **at least half the time**?', '一道题模型有 90% 的把握做对。组的大小 G 至少取多少，这一组才能有**一半以上**的时候产生学习信号？'),
      question: { type: 'number', answer: 7, tolerance: 0, wrong: [
        { answer: 8, feedback: t('8 works, but 7 already does: $1 - 0.9^7 - 0.1^7 \\approx 0.52$.', '8 可以，但 7 就已经够了：$1 - 0.9^7 - 0.1^7 \\approx 0.52$。') },
        { answer: 2, feedback: t('With G = 2 the group disagrees only $1 - 0.81 - 0.01 = 18\\%$ of the time.', 'G = 2 时，一组只有 $1 - 0.81 - 0.01 = 18\\%$ 的时候不一致。') },
      ] },
      hints: [t('Signal = not all the same: $1 - 0.9^G - 0.1^G \\ge 0.5$.', '有信号 = 不全一样：$1 - 0.9^G - 0.1^G \\ge 0.5$。'), t('$0.9^6 = 0.53$, $0.9^7 = 0.48$.', '$0.9^6 = 0.53$，$0.9^7 = 0.48$。')],
      explain: t('$G = 7$. Bigger groups find signal on easier questions, but every extra sample costs a full generation.', '$G = 7$。组越大，越能在容易的题上找到信号，但每多一个样本，就多一次完整的生成。'),
    },
    // ------------------------------------------------------------------ the full objective
    {
      id: 'why-clip', kind: 'read', chapter: t('The full objective', '完整的目标'), title: t('Two more pieces, each for a reason', '还差两样东西，各有原因'),
      blocks: [
        { type: 'p', text: t(
          'The baseline is the new idea. The rest of GRPO\'s objective is borrowed from PPO (D2a), and each piece answers a practical question:',
          '基线是 GRPO 的新东西。目标函数剩下的部分是从 PPO（D2a）借来的，每一样都对应一个实际问题：',
        ) },
        { type: 'list', items: [
          t('**Samples are expensive**, so we reuse a batch for several steps, or generate while we train. Then the samples come from a slightly older policy, which the **importance ratio** ρ corrects, and **clipping** stops pushing a token once it has moved far enough in the direction its advantage wants (D2a).', '**样本很贵**，所以一批样本要用好几步，或者边生成边训练。这时样本来自稍旧的策略，要用**重要性比率** ρ 来校正；再用**截断**：一个 token 顺着优势的方向走得够远了，就不再推它（D2a）。'),
          t('**We may not want to drift far from the starting model.** A **KL term** pulls back toward a reference model. Many RLVR recipes now drop it, for reasons we come back to.', '**也许不想离起点模型太远。** **KL 项**把策略往参考模型拉。如今很多 RLVR 配方把它去掉了，原因后面再说。'),
        ] },
      ],
    },
    {
      id: 'derive-objective', kind: 'derive', skill: 'grpo-objective', title: t('The GRPO objective, piece by piece', 'GRPO 目标，逐项拼起来'),
      intro: t('Build the objective one term at a time. Each line says why the term is there.', '一项一项地把目标拼起来，每一行都说明这一项为什么在这里。'),
      lines: [
        { tex: '\\rho_{i,t}(\\theta) = \\frac{\\pi_\\theta(o_{i,t}\\mid q, o_{i,<t})}{\\pi_{old}(o_{i,t}\\mid q, o_{i,<t})}', why: t('Recap of D2a: the samples came from $\\pi_{old}$; at $\\theta = \\theta_{old}$ the ratio is 1 and its gradient is the policy gradient. New here: it is taken per token.', '回顾 D2a：样本来自 $\\pi_{old}$；在 $\\theta = \\theta_{old}$ 处比率是 1，梯度就是策略梯度。这里的新东西：它按 token 计算。') },
        { tex: '\\hat A_{i,t} = \\hat A_i, \\quad t = 1, \\dots, |o_i|', why: t('The reward arrives once, at the end, so every token of an answer shares its advantage. (PPO instead gives each token its own value estimate.)', '奖励只在最后给一次，所以一条回答的每个 token 共用这条回答的优势。（PPO 则给每个 token 一个自己的价值估计。）') },
        { tex: '\\min\\big(\\rho\\,\\hat A,\\ \\mathrm{clip}(\\rho, 1-\\varepsilon_{low}, 1+\\varepsilon_{high})\\,\\hat A\\big)', why: t('PPO\'s clipped surrogate from D2a: once a token has moved past the band in the direction its advantage wants, its gradient stops. New here: the two edges may differ (below).', 'D2a 讲过的 PPO 截断：一个 token 沿着优势想要的方向走出这条带子之后，它的梯度就停了。这里的新东西：上下两条边可以不一样宽（见下文）。') },
        { tex: 'k_3 = x - \\log x - 1,\\qquad x = \\frac{\\pi_{ref}(o_t)}{\\pi_\\theta(o_t)}', why: t('A one-sample estimate of the KL per token (D2b gave the formula). It is never negative, because $\\log x \\le x - 1$.', '每个 token 上 KL 的单样本估计（D2b 给过公式）。它永远不为负，因为 $\\log x \\le x - 1$。') },
        { tex: '\\mathbb E_{o_t\\sim\\pi_\\theta}[k_3] = \\mathbb E[x] - \\mathbb E[\\log x] - 1 = 1 - \\mathbb E[\\log x] - 1 = \\mathrm{KL}(\\pi_\\theta\\Vert\\pi_{ref})', why: t('$\\mathbb E[x] = \\sum \\pi_\\theta \\cdot \\pi_{ref}/\\pi_\\theta = 1$, so k3 is unbiased. The simpler $-\\log x$ is unbiased too but can be negative for a single sample, which is where "negative KL" readings come from.', '$\\mathbb E[x] = \\sum \\pi_\\theta \\cdot \\pi_{ref}/\\pi_\\theta = 1$，所以 k3 是无偏的。更简单的 $-\\log x$ 也无偏，但单个样本可能为负，"KL 读数为负"就是这么来的。') },
        { tex: 'J = \\mathbb E\\Big[\\tfrac1G\\textstyle\\sum_i \\tfrac{1}{|o_i|}\\sum_t \\big(\\min(\\rho\\hat A, \\mathrm{clip}(\\rho)\\hat A) - \\beta\\,k_3\\big)\\Big]', why: t('Put together. DeepSeekMath used G = 64, β = 0.04, lr 1e-6; R1 used β = 0.001. Keep an eye on the $1/|o_i|$: it causes trouble later in this lesson.', '拼起来就是这样。DeepSeekMath 用 G = 64、β = 0.04、学习率 1e-6；R1 用 β = 0.001。留意 $1/|o_i|$ 这一项：本课后面它会惹麻烦。') },
        { tex: '\\mu = 1:\\quad \\rho \\equiv 1 \\;\\Rightarrow\\; \\mathrm{clip}(\\rho) = \\rho', why: t('If each batch is used for one step only, the ratio is exactly 1 where the gradient is taken, and the clip does nothing. It only matters when samples are reused or generated asynchronously.', '如果每批样本只更新一步，求梯度时比率恰好是 1，截断什么也不做。只有样本被重复使用、或者异步生成时，它才起作用。') },
      ],
      blank: { line: 3, answer: 'x - log(x) - 1', variables: ['x'], ranges: { x: [0.2, 3] }, prompt: t('Your turn: write the k3 estimator in terms of x (log is the natural log).', '轮到你：用 x 写出 k3 估计量（log 是自然对数）。') },
      outro: t('So GRPO = group baseline + PPO\'s clipped ratio + (optionally) a KL penalty. With β = 0 and one step per batch, it is just REINFORCE with a group-mean baseline.', '所以 GRPO = 组内基线 + PPO 的截断比率 +（可选的）KL 惩罚。β = 0、每批只走一步时，它就是带组均值基线的 REINFORCE。'),
    },
    {
      id: 'clip-higher', kind: 'scene', title: t('Clip-higher: room for unlikely tokens', '非对称截断：给低概率 token 留余地'),
      scene: vis('ppo_clip', { eps: 0.2, eps_high: 0.28 }),
      narration: t(
        'This is the clipping picture from D2a, with the upper edge moved from 1.2 to 1.28. Why bother? § Take a token that the old policy gave one percent. With a symmetric clip it can only rise to 1.2 percent in one step, while a token at ninety percent is not held back at all. Rare tokens are where new ideas start, and DAPO found that the symmetric clip makes the policy collapse onto its most common phrasings. Raising only the upper edge gives the rare tokens a little more room.',
        '这是 D2a 里的截断图，只是把上界从 1.2 挪到了 1.28。为什么要挪？§看一个旧策略只给了百分之一概率的 token：对称截断时，它一步最多涨到百分之一点二；而一个百分之九十的 token 根本不受限制。新想法往往就藏在这些低概率的 token 里。DAPO 发现，对称截断会让策略塌缩到最常见的写法上。只放宽上界，就给这些稀有的 token 多留了一点空间。',
      ),
    },
    // ------------------------------------------------------------------ length bias
    {
      id: 'p-length', kind: 'checkpoint', chapter: t('Length bias', '长度偏差'), skill: 'grpo-bias', purpose: 'predict', title: t('A long wrong answer', '一条又长又错的回答'),
      prompt: t(
        'Two wrong answers in the same group have the same advantage. One has 100 tokens, the other 1,000. In the original GRPO objective (the $1/|o_i|$ inside), the push on **each token** of the long answer is how many times the push on each token of the short one?',
        '同一组里有两个错误回答，优势相同。一个 100 个 token，一个 1000 个 token。在原版 GRPO 目标里（带着 $1/|o_i|$），长回答**每个 token** 受到的推力，是短回答每个 token 的多少倍？',
      ),
      question: { type: 'number', answer: 0.1, tolerance: 0.001, wrong: [{ answer: 1, misconception: 'seq-mean-fair', feedback: t('Not the same: each answer is divided by its own length first.', '不一样：每条回答都先除以了自己的长度。') }, { answer: 10, feedback: t('The other way round: dividing by the length makes the long answer\'s tokens weaker.', '反了：除以长度，长回答的每个 token 反而变弱。') }] },
      explain: t('Each token carries $\\hat A / (G\\,|o_i|)$: the long wrong answer is punished ten times more gently per token. Try it in the next world.', '每个 token 的系数是 $\\hat A / (G\\,|o_i|)$：长的错误回答，每个 token 受的惩罚只有十分之一。下一个世界里亲手试试。'),
    },
    {
      id: 'w-length', kind: 'explore', skill: 'grpo-bias', title: t('Where the length goes', '长度去哪了'),
      scene: vis('grpo_group', { phase: 'length', lengths: [220, 180, 300, 260, 240, 260, 240, 280] }),
      prompt: t(
        'o₁ and o₂ are right, the rest wrong. The purple bars are lengths; the coloured bars are the push on each token. **1.** Drag one wrong answer\'s length until it is at least 5× the shortest wrong answer, and watch its push. **2.** Without changing the lengths, pick a way of averaging the loss that punishes long and short wrong answers equally per token.',
        'o₁、o₂ 是对的，其余是错的。紫条是长度，彩色柱是每个 token 受到的推力。**1.** 拖动某个错误回答的长度，让它至少是最短错答的 5 倍，看它的推力。**2.** 不改长度，换一种损失的平均方式，让长短错答每个 token 受罚一样。',
      ),
      setup: world_setup(),
      goals: [
        { id: 'see_bias', check: (s: any, _c, w) => !!w.state.saw_bias || (s.agg_name() === 'sequence' && wrong_len_ratio(s) >= 5 && !!w.state.dragged), message: t('Per answer averaging: the long wrong answer gets a fraction of the push, per token.', '按回答平均：长的错误回答，每个 token 只受到一小部分惩罚。') },
        { id: 'fixed', check: (s: any, _c, w) => !!w.state.saw_bias && s.agg_name() !== 'sequence' && wrong_len_ratio(s) >= 5, message: t('Per token (DAPO) or by a constant (Dr. GRPO): every wrong token is pushed down equally.', '按 token（DAPO）或除以常数（Dr. GRPO）：每个错误 token 受到同样的惩罚。') },
      ],
      detectors: [
        {
          id: 'drag', on: (e, w) => {
            if (e.type !== 'length') return null;
            w.state.dragged = true;
            const long = (e.data!.ratio as number) <= 0.25 && e.data!.agg === 'sequence';
            if (long) w.state.saw_bias = true;
            return null;
          },
        },
        {
          id: 'shorten', on: (e, w) => (e.type === 'length' && w.state.saw_bias && e.data!.agg === 'sequence' && (e.data!.ratio as number) > 0.66
            ? { kind: 'misconception', id: 'seq-mean-fair', message: t('You made the long answer short again. In training the model chooses its own length: the fix is how the loss is averaged, not the data.', '你把长回答又改短了。训练时，回答多长是模型自己决定的：要改的是损失怎么平均，而不是数据。') }
            : null),
        },
        { id: 'std', on: (e, w) => (e.type === 'std' && w.state.saw_bias && e.data!.agg === 'sequence' ? { kind: 'progress', id: 'std-not-length', message: t('σ rescales whole questions; it cannot tell a long answer from a short one.', 'σ 缩放的是整道题；它分不清回答的长短。') } : null) },
      ],
      lines: [
        { text: t('Purple is length. Change only the length first.', '紫条是长度。先只改长度看看。'), when: 'enter' },
        { text: t('Drag the end of a purple bar.', '拖动紫条的末端。'), when: 'idle' },
        { text: t('You shortened it again. But the model picks its own length in training.', '你又把它改短了。可训练时，长度是模型自己挑的。'), when: { finding: 'seq-mean-fair' } },
      ],
      solve: (s: any, _c, w) => {
        s.len[5].set_value(1500);
        w.state.dragged = true;
        w.state.saw_bias = true;
        s.agg.set_value(1);
      },
    },
    {
      id: 'derive-length', kind: 'derive', skill: 'grpo-bias', title: t('Why it happens, and the two fixes', '偏差从哪来，两种修法'),
      intro: t('What you saw, as four lines.', '把你看到的写成四行。'),
      lines: [
        { tex: '\\nabla J \\propto \\textstyle\\sum_i \\frac{\\hat A_i}{|o_i|}\\,\\nabla\\log\\pi(o_i)', why: t('With μ = 1 and no KL, averaging inside each answer divides its whole log-probability gradient by its length.', 'μ = 1、没有 KL 时，先在每条回答内部平均，等于把整条回答的 log 概率梯度除以它自己的长度。') },
        { tex: '\\hat A_i < 0,\\ |o_i|\\uparrow \\;\\Rightarrow\\; \\big|\\hat A_i/|o_i|\\big|\\downarrow', why: t('A wrong answer is punished less the longer it is; a right answer is rewarded more the shorter it is. So length can grow during training while accuracy does not (Dr. GRPO).', '错误回答越长，受罚越轻；正确回答越短，奖励越多。所以训练中回答长度可能一路上涨，准确率却不涨（Dr. GRPO）。') },
        { tex: '\\text{DAPO: } \\frac{\\hat A_i}{\\sum_j |o_j|} \\qquad \\text{Dr. GRPO: } \\frac{\\hat A_i}{G\\,L_{max}}', why: t('Both give every token in the batch the same weight; they differ only by a constant. TRL: loss_type="dapo" (the default) or "dr_grpo".', '两种做法都让批次里每个 token 的权重相同，只差一个常数。TRL 里分别是 loss_type="dapo"（默认）和 "dr_grpo"。') },
        { tex: '\\textstyle\\sum_i \\big|\\frac{r_i - \\bar r}{\\sigma}\\big| = 2G\\sqrt{\\hat p(1-\\hat p)}, \\qquad \\sum_i |r_i - \\bar r| = 2G\\,\\hat p(1-\\hat p)', why: t('Dividing by σ also gives very easy and very hard questions relatively more weight (Dr. GRPO calls it difficulty bias). Whether that is bad is debated; TRL\'s scale_rewards offers "group", "batch" or "none".', '除以 σ 还会让太容易和太难的题相对更重（Dr. GRPO 称之为难度偏差）。这到底好不好还有争论；TRL 的 scale_rewards 提供 "group"、"batch"、"none" 三种。') },
      ],
      outro: t('Rule of thumb: never trust "answers got longer" as evidence of better reasoning; first check how the loss is averaged.', '经验法则：不要把"回答变长了"当成推理变强的证据；先查一查损失是怎么平均的。'),
    },
    // ------------------------------------------------------------------ what people use
    {
      id: 'variants', kind: 'read', chapter: t('What people use in 2026', '2026 年大家怎么做'), title: t('Every variant fixes one of these problems', '每个改进版都在修上面某个问题'),
      blocks: [
        { type: 'p', text: t(
          'Since 2025 there are many GRPO variants. They are easier to remember by the problem each one fixes:',
          '2025 年以来，GRPO 出了很多改进版。按"它修的是哪个问题"来记，最容易：',
        ) },
        { type: 'table', head: [t('Problem', '问题'), t('Fix', '修法'), t('Where', '出处')], rows: [
          [t('Long wrong answers punished less', '又长又错的回答受罚更轻'), t('per-token or constant averaging; drop σ', '按 token 或除以常数平均；去掉 σ'), t('DAPO, Dr. GRPO', 'DAPO、Dr. GRPO')],
          [t('Groups with no signal', '没有信号的组'), t('dynamic sampling, zero-variance filtering', '动态采样、过滤零方差组'), t('DAPO, ScaleRL', 'DAPO、ScaleRL')],
          [t('Rare tokens cannot grow (entropy collapse)', '低概率 token 涨不动（熵塌缩）'), t('raise only the upper clip: 0.2 / 0.28', '只放宽上界：0.2 / 0.28'), 'DAPO'],
          [t('Clipped tokens lose their gradient', '被截断的 token 丢了梯度'), t('clip the (stop-gradient) importance weight instead', '改为截断（不回传梯度的）重要性权重'), 'CISPO (MiniMax-M1)'],
          [t('Token ratios are noisy; MoE training unstable', '逐 token 的比率噪声大；MoE 训练不稳'), t('one ratio per answer: $(\\pi_\\theta/\\pi_{old})^{1/|o|}$', '每条回答一个比率：$(\\pi_\\theta/\\pi_{old})^{1/|o|}$'), t('GSPO (Qwen3)', 'GSPO（Qwen3）')],
        ] },
        { type: 'h', level: 3, text: t('A common default (a synthesis, not one paper)', '一套常见默认配置（综合判断，不是某一篇论文）') },
        { type: 'list', items: [
          t('Group-mean baseline, G = 8–16 at small scale. TRL: `num_generations`.', '组均值基线，小规模 G = 8–16。TRL：`num_generations`。'),
          t('Token-level averaging, not $1/|o_i|$. TRL default `loss_type="dapo"`.', '按 token 平均，不用 $1/|o_i|$。TRL 默认 `loss_type="dapo"`。'),
          t('Asymmetric clipping. TRL: `epsilon=0.2, epsilon_high=0.28`.', '非对称截断。TRL：`epsilon=0.2, epsilon_high=0.28`。'),
          t('Little or no KL. TRL default `beta=0.0` (no reference model is loaded).', 'KL 很小或不用。TRL 默认 `beta=0.0`（不加载参考模型）。'),
          t('Mask truncated answers: `mask_truncated_completions=True`. Watch `frac_reward_zero_std`.', '屏蔽被截断的回答：`mask_truncated_completions=True`。盯住 `frac_reward_zero_std`。'),
        ] },
        { type: 'callout', kind: 'open', title: t('Open question: keep the KL term?', '开放问题：KL 项要不要？'), body: t(
          'Against: with a rule-based reward there is no reward model to over-optimize, long chains of thought need to move far from the start (DAPO), and dropping it saves a reference model. For: ProRL keeps long runs stable with a KL penalty plus periodic reference resets. Start with β = 0, and always log the KL to the start model anyway.',
          '不要的理由：奖励是规则，没有奖励模型可以被过度优化；长思维链需要离起点走得足够远（DAPO）；去掉它还省一个参考模型。要的理由：ProRL 靠 KL 惩罚加上定期重置参考模型，让长时间训练保持稳定。建议先从 β = 0 开始，但无论如何都把"相对起点的 KL"记下来。',
        ) },
      ],
    },
    {
      id: 'code-scratch', kind: 'code', title: t('GRPO\'s core in 20 lines', '20 行写出 GRPO 的核心'),
      intro: t('The advantages and the loss, from scratch. Notes light up the lines they explain.', '从零写出优势和损失。每条讲解会点亮它对应的代码行。'),
      lang: 'python', code: CODE_SCRATCH,
      notes: [
        { lines: [3, 4], text: t('The rewards of a batch, reshaped so that each row is one question\'s group.', '把一个批次的奖励排成矩阵，每一行是一道题的一组。'), shapes: 'rewards: [B·G] → r: [B, G]' },
        { lines: [5, 5], text: t('The group baseline: subtract each row\'s mean.', '组内基线：每一行减去它的均值。') },
        { lines: [6, 9], text: t('Divide by the group\'s std ("group"), the batch\'s std ("batch"), or not at all. torch.std divides by G − 1.', '除以组内标准差（"group"）、整批的标准差（"batch"），或者不除。torch.std 的分母是 G − 1。') },
        { lines: [10, 10], text: t('The share of groups where every reward is equal: these teach nothing.', '奖励全部相同的组所占的比例：这些组什么也学不到。') },
        { lines: [14, 15], text: t('One ratio per token; every token of an answer shares the answer\'s advantage.', '每个 token 一个比率；一条回答的所有 token 共用这条回答的优势。'), shapes: 'logp, old_logp, mask: [N, T];  adv: [N] → a: [N, 1]' },
        { lines: [16, 17], text: t('The clipped surrogate with an asymmetric band, negated because optimizers minimise.', '带非对称截断带的代理目标，取负号是因为优化器做的是最小化。') },
        { lines: [18, 22], text: t('The three ways of averaging. Only the first has the length bias.', '三种平均方式。只有第一种有长度偏差。') },
      ],
    },
    {
      id: 'code-trl', kind: 'code', title: t('The same with TRL (optional)', '用 TRL 实现（选读）'),
      intro: t('In practice you write only the reward functions. This is the setup lab L4 starts from (TRL 1.15).', '实际使用时，你只需要写奖励函数。实验 L4 就从这份配置出发（TRL 1.15）。'),
      lang: 'python', code: CODE_TRL,
      notes: [
        { lines: [6, 9], text: t('Each example becomes a chat prompt plus a `gold` column; TRL passes extra columns to the reward functions by name.', '每个样本变成一段对话提示，外加一列 `gold`；TRL 会把多出来的列按名字传给奖励函数。') },
        { lines: [11, 18], text: t('The grader: exactly one <answer> tag, compared as a number, so "42.0" counts and "41, 42 or 43" does not.', '评分器：必须恰好有一个 <answer> 标签，并按数值比较，所以 "42.0" 算对，"41、42 或 43" 不算。') },
        { lines: [20, 22], text: t('A small format reward. Keep it small: it is easy to max out without solving anything.', '一个小小的格式奖励。要给得小：它不解题也很容易拿满分。') },
        { lines: [24, 27], text: t('The defaults from the previous page. The batch (devices × per device × accumulation) must be divisible by num_generations.', '上一页的默认配置。有效批量（卡数 × 每卡批量 × 梯度累积）必须能被 num_generations 整除。') },
        { lines: [28, 30], text: t('LoRA is enough for RL (E2 explains why): a 1.5B model trains on one GPU.', '强化学习用 LoRA 就够（E2 解释原因）：一块 GPU 就能训练 1.5B 的模型。') },
      ],
    },
    // ------------------------------------------------------------------ graders
    {
      id: 'graders', kind: 'read', chapter: t('Graders', '评分器'), title: t('The grader is where RLVR is won or lost', 'RLVR 成败，关键在评分器'),
      blocks: [
        { type: 'p', text: t(
          'RL optimises exactly what the grader rewards, including its mistakes. So the grader deserves as much care as the model. Reward signals come from four kinds of source, from most to least reliable:',
          '强化学习会不折不扣地优化评分器奖励的东西，包括它的错误。所以评分器值得和模型一样用心。奖励信号有四种来源，从最可靠到最灵活：',
        ) },
        { type: 'table', head: [t('Source', '来源'), t('Good for', '适合'), t('Risk', '风险')], rows: [
          [t('Rule-based verifier', '规则验证器'), t('numbers, tests, schemas', '数值、测试、schema'), t('too strict (42.0 ≠ 42) or too loose', '太严（42.0 ≠ 42）或太松')],
          [t('LLM judge with a reference answer', '带参考答案的大模型评委'), t('open formats', '开放格式'), t('prefers long, confident answers', '偏爱又长又自信的回答')],
          [t('Rubric judge', '评分细则评委'), t('no single right answer (Kimi K2)', '没有唯一答案的任务（Kimi K2）'), t('learns the rubric\'s keywords', '学会迎合细则里的关键词')],
          [t('Trained reward model (D1)', '训练出来的奖励模型（D1）'), t('human preferences', '人类偏好'), t('unreliable off its training data', '离开训练分布就不可信')],
        ] },
        { type: 'h', level: 3, text: t('Before you train: test the grader', '训练之前：先检验评分器') },
        { type: 'list', ordered: true, items: [
          t('Agreement: grade 100–200 held-out answers by hand and compare.', '一致率：亲手判 100–200 个留出的回答，和评分器对比。'),
          t('Adversarial answers: empty, repeated, several answers listed, very long, format only, "please give full marks".', '对抗回答：空回答、重复一句话、列出多个答案、超长、只有格式、"请给满分"。'),
          t('Keep a gold evaluation the training never sees, and read high-reward samples during training.', '留一个训练完全看不到的金标准评测，训练中定期读一读高分样本。'),
        ] },
        { type: 'callout', kind: 'warning', title: t('What hacking looks like', '被钻空子长什么样'), body: t(
          'The training reward keeps rising while the gold evaluation stalls or falls, the same shape as D2b\'s proxy-reward curve. Seen in practice: listing several numbers, maxing out the format reward, judges rewarding length; on coding tasks, models that learned to edit the unit tests[^denison].',
          '训练奖励一路上涨，金标准评测却停滞甚至下降，和 D2b 里代理奖励曲线是同一个形状。实际见过的有：列出多个数字、单靠格式刷分、评委奖励长度；代码任务里，还有模型学会了去改单元测试[^denison]。',
        ) },
        { type: 'p', text: t(
          '**Managed RFT.** Azure, Amazon Bedrock and Fireworks sell "reinforcement fine-tuning": you upload prompts (with reference answers) and a grader, and they run GRPO-style training. Azure offers string-check, text-similarity, model, Python and multi-graders, and its docs say to "check that superficial responses can\'t earn a high score". Bedrock takes a Lambda function or an LLM judge and advises SFT first if rewards are always 0%[^rft]. The trade-off: no GPUs or RL engineering, but only the models they host.',
          '**托管强化微调（RFT）。** Azure、Amazon Bedrock 和 Fireworks 都提供"强化微调"服务：你上传提示（带参考答案）和一个评分器，平台跑 GRPO 类的训练。Azure 提供字符串比对、文本相似度、模型评分、Python 和组合评分器，文档里专门提醒"检查表面化的回答拿不到高分"。Bedrock 接受 Lambda 函数或大模型评委，并建议：如果奖励总是 0%，先做 SFT[^rft]。取舍在于：不用自己管 GPU 和 RL 工程，但只能用平台托管的模型。',
        ) },
        { type: 'cite', key: 'denison', text: t('Denison et al. (2024). Sycophancy to Subterfuge; via L. Weng, "Reward Hacking" (2024).', 'Denison 等（2024）。Sycophancy to Subterfuge；转引自 L. Weng《Reward Hacking》（2024）。'), url: 'https://arxiv.org/abs/2406.10162' },
        { type: 'cite', key: 'rft', text: t('Microsoft Foundry RFT docs (2026-10); Amazon Bedrock RFT docs; see research-reasoning.md.', 'Microsoft Foundry 强化微调文档（2026-10）；Amazon Bedrock 强化微调文档；见 research-reasoning.md。'), url: 'https://learn.microsoft.com/en-us/azure/foundry/openai/how-to/reinforcement-fine-tuning' },
      ],
    },
    {
      id: 'q-loophole', kind: 'checkpoint', skill: 'grader-design', purpose: 'check', title: t('Find the hole', '找漏洞'),
      prompt: t(
        'A grader is written as `1.0 if gold in completion else 0.0`, with gold answer "42". Which completion shows a hole that training will learn to exploit?',
        '评分器写成 `1.0 if gold in completion else 0.0`，标准答案是 "42"。哪个回答暴露了一个训练会学会利用的漏洞？',
      ),
      question: { type: 'choice', options: [
        { id: 'a', label: '<answer>42</answer>', feedback: t('Right answer, right score: no hole here.', '答案对，分数也对：这里没有漏洞。') },
        { id: 'b', label: t('"It is 41, 42 or 43."', '"可能是 41、42 或 43。"'), correct: true, feedback: t('Listing several numbers always contains the gold one. RL will discover it.', '列出好几个数，总会包含正确的那个。强化学习会发现这一点。') },
        { id: 'c', label: '<answer>42.0</answer>', feedback: t('This one is actually right, and the substring test happens to accept it. A strict equality test would wrongly reject it: normalise numbers.', '这个其实是对的，子串匹配恰好接受了它。严格的字符串相等反而会误判它：要把数值归一化。') },
        { id: 'd', label: t('"I am not sure."', '"我不确定。"'), feedback: t('Scored 0, correctly.', '得 0 分，判得没错。') },
      ] },
      explain: t('Fix both directions at once: read only the single <answer> tag, and compare numbers, not strings.', '两个方向一起修：只读唯一的那个 <answer> 标签，并按数值而不是字符串比较。'),
    },
    // ------------------------------------------------------------------ checks and choosing
    {
      id: 'q-diagnose', kind: 'checkpoint', chapter: t('Check and choose', '检验与选择'), skill: 'grpo-bias', purpose: 'check', title: t('Read the curves', '读曲线'),
      prompt: t(
        'A run uses the original `loss_type="grpo"` with β = 0. Reward rises for 100 steps, then stays flat. `completions/mean_length` climbs from 300 to 1,200 tokens, `completions/clipped_ratio` reaches 30%, and held-out accuracy does not move. Most likely cause and fix?',
        '一次训练用的是原版 `loss_type="grpo"`，β = 0。奖励涨了 100 步后就走平；`completions/mean_length` 从 300 一路涨到 1200 个 token，`completions/clipped_ratio` 涨到 30%，留出集准确率纹丝不动。最可能的原因和对策是什么？',
      ),
      question: { type: 'choice', options: [
        { id: 'bias', label: t('Length bias plus truncated answers scored as wrong: switch to "dapo" or "dr_grpo", mask truncated completions, track the length of right and wrong answers separately', '长度偏差，加上被截断的回答被当成错误：改用 "dapo" 或 "dr_grpo"，屏蔽被截断的回答，把对、错回答的长度分开监控'), correct: true },
        { id: 'deeper', label: t('The model is learning deeper reasoning: keep training', '模型在学更深的推理：继续训练'), misconception: 'longer-is-better', feedback: t('Accuracy is flat. Longer answers alone are not evidence; here the loss rewards long wrong answers.', '准确率没动。光是回答变长不能说明什么；这里是损失在纵容又长又错的回答。') },
        { id: 'lr', label: t('The learning rate is too low', '学习率太低'), feedback: t('A too-low learning rate would not make answers longer and longer.', '学习率太低，不会让回答越来越长。') },
        { id: 'kl', label: t('The KL penalty is too strong', 'KL 惩罚太强'), feedback: t('β = 0 here: there is no KL term.', '这次训练 β = 0，根本没有 KL 项。') },
      ] },
    },
    {
      id: 'q-value', kind: 'checkpoint', skill: 'group-advantage', purpose: 'check', title: t('Explain it', '解释一下'),
      prompt: t('In one or two sentences: why does GRPO not need a value model?', '用一两句话解释：GRPO 为什么不需要价值模型？'),
      question: { type: 'text', placeholder: t('Because…', '因为……'), rubric: {
        key_points: [
          t('It samples several answers to the same question and uses their average reward as the baseline (an estimate of what the model usually scores on it).', '它对同一道题采样多个回答，用它们的平均分当基线（估计模型在这道题上平时能拿多少分）。'),
          t('The reward comes once at the end, so there is no per-token value to learn.', '奖励只在最后出现一次，所以没有必要学习每个 token 的价值。'),
        ],
        model_answer: t('Because the baseline comes from the group itself: GRPO samples G answers to the same question and uses their mean reward as the estimate of how well the model does on it. With one reward at the end of each answer there is nothing left for a per-token value model to do.', '因为基线来自这一组本身：GRPO 对同一道题采样 G 个回答，用它们的平均分估计模型在这道题上的水平。每条回答只在最后有一个奖励，也就用不着一个给每个 token 估值的价值模型。'),
        min_points: 1,
      } },
    },
    {
      id: 'q-choose', kind: 'checkpoint', skill: 'rlvr-reward', purpose: 'check', title: t('Which task fits?', '哪个任务适合？'),
      prompt: t(
        'Which task should go **straight** to RLVR?',
        '下面哪个任务可以**直接**上 RLVR？',
      ),
      question: { type: 'choice', options: [
        { id: 'sql', label: t('Generating SQL, with a test database to run the query and compare results; the model already gets about 40% right', '生成 SQL，有测试数据库可以执行并比对结果；模型现在大约能做对 40%'), correct: true, feedback: t('Checkable by a program, and the model succeeds sometimes: most groups will carry signal.', '能用程序判对错，模型也时对时错：大多数组都会有信号。') },
        { id: 'tone', label: t('Making support replies sound warmer', '让客服回复的语气更温暖'), feedback: t('No program can check warmth. Use preference data (D) or a rubric judge, carefully.', '没有程序能判断"温暖"。用偏好数据（D 部分），或者谨慎地用评分细则评委。') },
        { id: 'hard', label: t('Competition problems the model never solves, even in 16 tries', '竞赛题，模型采样 16 次一次都做不对'), misconception: 'rl-strictly-better', feedback: t('Every group would be all wrong: zero signal. First SFT or distil, or pick easier questions.', '每一组都会全错：零信号。先做 SFT 或蒸馏，或者换难度合适的题。') },
      ] },
    },
    {
      id: 'choose', kind: 'read', title: t('How to choose (E1)', '怎么选（E1）'),
      blocks: choose_card({
        upto: 'E1', highlight: 'C1,C2,R', card: 'E1',
        rules: [
          t('If a program can check the result (answers, tests, execution, a schema) **and** the model gets it right some of the time, use RLVR (GRPO family). No reward model needed.', '结果能用程序判定（答案比对、测试、执行结果、schema），**并且**模型时对时错，就用 RLVR（GRPO 一系），不需要奖励模型。'),
          t('Start from TRL\'s defaults (dapo averaging, β = 0, group std) plus epsilon_high = 0.28 and masking truncated answers; watch frac_reward_zero_std, length and the truncation rate from step one.', '起步直接用 TRL 的默认值（dapo 聚合、β = 0、组内标准差），再加上 epsilon_high = 0.28 和屏蔽截断回答；从第一步起就盯住 frac_reward_zero_std、回答长度和截断比例。'),
          t('Test the grader before training: agreement with hand grading, adversarial answers, a gold evaluation it never sees.', '训练前先检验评分器：和人工判分的一致率、对抗回答、一个它永远看不到的金标准评测。'),
          t('No GPUs or RL engineering, or a closed model? Managed RFT, and you write the grader. Open weights or full control? TRL, Unsloth or verl.', '没有 GPU 和 RL 工程能力，或者要用闭源模型？用托管强化微调，你只负责写评分器。要开源权重或完全控制？用 TRL、Unsloth 或 verl。'),
        ],
        counter: [
          t('Questions the model never solves: every group is all wrong, there is no signal, and RL learns nothing. SFT or distil first.', '模型从来做不对的题：每一组都全错，没有信号，强化学习什么也学不到。先做 SFT 或蒸馏。'),
          t('A subjective goal (tone, style) forced into a rule: the model will find the rule\'s holes. Use preferences or a rubric judge.', '把主观目标（语气、风格）硬写成一条规则：模型会找到规则的漏洞。改用偏好数据或评分细则评委。'),
        ],
      }),
    },
  ],
};
