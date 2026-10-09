// E3 蒸馏与合并 / Distillation and merging.
// Plan: docs/lessons/llm-finetuning/part-e-reasoning.md (E3); facts:
// research-technical.md §7, research-reasoning.md (Qwen3 Table 21, Thinking
// Machines on-policy distillation, Interconnects MOPD, R1 Table 5/6),
// research-adoption.md §3 and §8.
// Order: the problem (a strong teacher, a cheap student) -> three ways to
// learn from a teacher, which differ in whose text and which KL -> the KL
// direction, held in a world -> temperature and T² -> on-policy distillation
// as RL with a reward on every token -> many teachers -> when it beats RL ->
// merging, briefly -> forgetting -> choosing.
import type { Lesson } from '@mathnim/core';
import { descend, kl_forward, kl_reverse, moment_match } from '@mathnim/visuals/ft/e/math';
import { choose_card, fig, t, vis, world_setup } from './common';

const CODE_KD = `import torch.nn.functional as F

def kd_loss(s_logits, t_logits, mask, T=1.0, direction="forward"):
    s_lp = F.log_softmax(s_logits.float() / T, dim=-1)
    t_lp = F.log_softmax(t_logits.float() / T, dim=-1)
    if direction == "forward":                       # KL(teacher || student): cover every peak
        kl = (t_lp.exp() * (t_lp - s_lp)).sum(-1)
    else:                                            # KL(student || teacher): settle on one peak
        kl = (s_lp.exp() * (s_lp - t_lp)).sum(-1)
    return T * T * (kl * mask).sum() / mask.sum()    # T² keeps the gradient scale fixed`;

const CODE_ONPOLICY = `import torch

def token_logprobs(model, seqs):
    logits = model(seqs).logits[:, :-1].float()      # position i predicts token i + 1
    return torch.log_softmax(logits, -1).gather(-1, seqs[:, 1:, None]).squeeze(-1)

def on_policy_step(student, teacher, prompts, completion_mask, optimizer):
    with torch.no_grad():
        seqs = student.generate(**prompts, do_sample=True, temperature=1.0, max_new_tokens=512)
        t_lp = token_logprobs(teacher, seqs)          # the teacher only scores: one forward pass
    s_lp = token_logprobs(student, seqs)              # the student, with gradients
    mask = completion_mask(seqs)[:, 1:]               # only the tokens the student wrote
    adv = -(s_lp.detach() - t_lp)                     # reward per token: log pi_t - log pi_s
    loss = -(adv * s_lp * mask).sum() / mask.sum()    # a policy gradient with that reward
    optimizer.zero_grad(); loss.backward(); optimizer.step()
    return (s_lp.detach() - t_lp)[mask.bool()].mean() # sampled reverse KL per token`;

const GKD_SNIPPET = `from trl.experimental.gkd import GKDConfig, GKDTrainer   # experimental API in TRL 1.15

args = GKDConfig(output_dir="gkd", lmbda=1.0,   # 1.0: always the student's own samples (on-policy)
                 beta=1.0,                      # 0.0 ≈ forward KL, 1.0 ≈ reverse KL
                 temperature=0.9, max_new_tokens=256, learning_rate=1e-5)
trainer = GKDTrainer(model="Qwen/Qwen2.5-0.5B-Instruct", teacher_model="Qwen/Qwen2.5-1.5B-Instruct",
                     args=args, train_dataset=chats)   # same tokenizer family
# different tokenizers: trl.experimental.gold.GOLDConfig(use_uld_loss=True, teacher_tokenizer_name_or_path=...)`;

// KL minima of the world's teacher (separation 2, peak width 0.6), for its goals
type Mix = { w: number; d: number; s0: number };
const MIX = (uneven: boolean): Mix => ({ w: uneven ? 0.7 : 0.5, d: 2, s0: 0.6 });
const memo = new Map<string, { fwd: number; left: number; right: number }>();
function minima(uneven: boolean) {
  const k = String(uneven);
  if (!memo.has(k)) {
    const m = MIX(uneven), mm = moment_match(m);
    const end = (mu0: number) => descend('reverse', mu0, 0.7, m, { steps: 200 }).at(-1)!;
    const [l0, l1] = end(-2.2), [r0, r1] = end(2.2);
    memo.set(k, { fwd: kl_forward(mm.mu, mm.sigma, m), left: kl_reverse(l0, l1, m), right: kl_reverse(r0, r1, m) });
  }
  return memo.get(k)!;
}

export const lesson: Lesson = {
  id: 'ft-e3-distill-merge',
  title: t('Distillation and merging', '蒸馏与合并'),
  description: t(
    'How a small student learns from a strong teacher: on the teacher\'s text, on its full distributions, or on the student\'s own attempts graded token by token. Why the direction of the KL matters, why on-policy distillation is cheap, how labs combine specialists, and model merging in brief.',
    '小学生模型怎样向强老师学：在老师写的文本上学，学老师的完整分布，或者在自己写的回答上让老师逐 token 打分。为什么 KL 的方向很重要，为什么在线蒸馏这么省，实验室怎样把多个专家合成一个，以及简单讲讲模型合并。',
  ),
  mode: 'essay',
  theme: 'light',
  skills: [
    { id: 'kd-kinds', name: t('Three ways to distil, and what each needs', '三种蒸馏方式，各自需要什么') },
    { id: 'kl-direction', name: t('Forward vs reverse KL', '正向 KL 与反向 KL') },
    { id: 'kd-temperature', name: t('Temperature and the T² factor', '温度与 T² 因子'), prerequisites: ['kd-kinds'] },
    { id: 'on-policy-distill', name: t('On-policy and multi-teacher distillation', '在线蒸馏与多老师蒸馏'), prerequisites: ['kl-direction'] },
    { id: 'merging-basics', name: t('Task vectors and TIES', '任务向量与 TIES') },
    { id: 'forgetting-kl', name: t('Forgetting and the KL to the start model', '遗忘与相对起点的 KL') },
  ],
  misconceptions: [
    { id: 'distill-needs-logits', description: t('Distillation always needs the teacher\'s logits.', '蒸馏一定要拿到老师的 logits。') },
    { id: 'kl-direction-swap', description: t('Forward KL makes the student pick one peak (it is the reverse).', '正向 KL 会让学生挑一个峰（其实反了）。') },
    { id: 'rkl-global', description: t('Reverse KL always finds the biggest peak.', '反向 KL 总能找到最大的那个峰。') },
    { id: 't2-optional', description: t('The temperature only softens the distribution; the T² factor is optional.', '温度只是让分布变软，T² 这个因子可有可无。') },
    { id: 'seqkd-is-onpolicy', description: t('SFT on the teacher\'s outputs is on-policy distillation.', '用老师的输出做 SFT 就是在线蒸馏。') },
    { id: 'rl-strictly-better', description: t('RL always beats SFT or distillation, whatever the starting point.', '不管起点如何，强化学习总比 SFT 或蒸馏强。') },
    { id: 'merge-any', description: t('Any two models can be merged by averaging their weights.', '任意两个模型都能把权重平均起来合并。') },
    { id: 'average-is-enough', description: t('Plain averaging is all merging needs.', '合并时简单平均就够了。') },
  ],
  steps: [
    // ------------------------------------------------------------------ why
    {
      id: 'why', kind: 'read', chapter: t('Learning from a teacher', '向老师学'), title: t('A strong teacher, a cheap student', '一个强老师，一个便宜的学生'),
      blocks: [
        { type: 'p', text: t(
          'You have a strong model (the **teacher**) and want a much cheaper one (the **student**) to do nearly as well. For small models this is often the best deal there is: DeepSeek\'s distilled 32B model scores 72.6 on AIME 2024, while the same base trained with large-scale RL reached 47.0[^r1]. Qwen3 trains its small models this way at about a tenth of the GPU hours of RL[^qwen3].',
          '你有一个强模型（**老师**），想让一个便宜得多的模型（**学生**）做得差不多好。对小模型来说，这往往是最划算的路：DeepSeek 蒸馏出的 32B 模型在 AIME 2024 上得 72.6，同一个基座直接做大规模强化学习只有 47.0[^r1]。Qwen3 的小模型就是这样训练的，GPU 小时只有强化学习的约十分之一[^qwen3]。',
        ) },
        { type: 'p', text: t('There are three ways to learn from a teacher. They differ in two things: **who writes the text** the student learns on, and **what the teacher gives back**.', '向老师学有三种方式。区别只在两件事：学生在**谁写的文本**上学，以及**老师给回什么**。') },
        { type: 'table', head: [t('', ''), t('Sequence-level', '序列级'), t('Logit-level', 'logit 级'), t('On-policy', '在线')], rows: [
          [t('Who writes the text', '谁写文本'), t('the teacher', '老师'), t('the teacher (or a dataset)', '老师（或数据集）'), t('**the student**', '**学生自己**')],
          [t('The teacher gives', '老师给什么'), t('its text', '写好的文本'), t('its full next-token distribution', '每个位置完整的下一词分布'), t('a score for each of the student\'s tokens', '给学生每个 token 打的分')],
          [t('The student learns', '学生学什么'), t('SFT on it (= forward KL, B2)', '在上面做 SFT（= 正向 KL，B2）'), t('to match the distribution', '去匹配这个分布'), t('reverse KL, token by token', '逐 token 的反向 KL')],
          [t('Needs', '需要什么'), t('only text, an API is fine', '只要文本，API 也行'), t('the same vocabulary', '同一套词表'), t('the teacher running; same vocabulary', '老师在线运行；同一套词表')],
          [t('Example', '例子'), t('R1-Distill (800k samples), s1 (1k)', 'R1-Distill（80 万条）、s1（1000 条）'), t('Hinton et al. 2015', 'Hinton 等 2015'), t('Qwen3 small models, GKD', 'Qwen3 小模型、GKD')],
        ] },
        { type: 'callout', kind: 'misconception', body: t('Distillation does not have to mean logits. Outside the labs most distillation is simply SFT on text a stronger model wrote: the Hub has 12,622 datasets tagged synthetic, against 113 models tagged gkd[^adoption].', '蒸馏不一定要用 logits。在实验室以外，大多数蒸馏就是在强模型写的文本上做 SFT：Hub 上带 synthetic 标签的数据集有 12,622 个，带 gkd 标签的模型只有 113 个[^adoption]。') },
        { type: 'p', text: t('The columns differ in the direction of a KL divergence. A one-dimensional picture makes that difference visible.', '这三列的区别，归根结底是 KL 散度的方向不同。一个一维的小例子就能把这一点看清楚。') },
        { type: 'cite', key: 'r1', text: t('DeepSeek-R1 v1, Tables 5–6.', 'DeepSeek-R1 v1，表 5–6。'), url: 'https://arxiv.org/abs/2501.12948' },
        { type: 'cite', key: 'qwen3', text: t('Qwen3 Technical Report, §4.5 and Table 21.', 'Qwen3 技术报告，§4.5 与表 21。'), url: 'https://arxiv.org/abs/2505.09388' },
        { type: 'cite', key: 'adoption', text: t('Hugging Face Hub counts, 2026-10-10 (research-adoption.md §3).', 'Hugging Face Hub 计数，2026-10-10（research-adoption.md §3）。'), url: 'https://huggingface.co/datasets?other=synthetic' },
      ],
    },
    {
      id: 'p-fit', kind: 'checkpoint', chapter: t('Which way the KL points', 'KL 朝哪个方向'), skill: 'kl-direction', purpose: 'predict', title: t('Fit two peaks with one', '用一个峰去拟合两个峰'),
      prompt: t(
        'The teacher\'s distribution $p$ has two peaks; the student $q$ can only be a single Gaussian. Where does $q$ end up if we minimise the forward KL $\\mathrm{KL}(p\\Vert q)$, and where with the reverse KL $\\mathrm{KL}(q\\Vert p)$?',
        '老师的分布 $p$ 有两个峰；学生 $q$ 只能是一个高斯。最小化正向 KL $\\mathrm{KL}(p\\Vert q)$ 时，$q$ 会落在哪？最小化反向 KL $\\mathrm{KL}(q\\Vert p)$ 呢？',
      ),
      question: { type: 'choice', options: [
        { id: 'both-wide', label: t('Both spread over the two peaks', '两者都摊开，盖住两个峰') },
        { id: 'right', label: t('Forward spreads over both peaks; reverse settles in one', '正向摊开盖住两个峰；反向缩进其中一个峰'), correct: true },
        { id: 'swap', label: t('Forward settles in one peak; reverse spreads over both', '正向缩进一个峰；反向摊开盖住两个'), misconception: 'kl-direction-swap' },
        { id: 'both-one', label: t('Both settle in one peak', '两者都缩进一个峰') },
      ] },
    },
    {
      id: 'p-uneven', kind: 'checkpoint', skill: 'kl-direction', purpose: 'predict', title: t('A heavier peak', '一个峰更重'),
      prompt: t('Now the left peak holds 70% of the teacher\'s mass. Start $q$ on the right and run gradient descent on the **reverse** KL. Where does $q$ stop?', '现在左边的峰占老师 70% 的质量。把 $q$ 放在右边，对**反向** KL 做梯度下降。$q$ 停在哪？'),
      question: { type: 'choice', options: [
        { id: 'left', label: t('On the heavier left peak: it is the better fit', '停在更重的左峰：那里拟合得更好'), misconception: 'rkl-global' },
        { id: 'right', label: t('On the right peak, the one it started near', '停在右峰，也就是起点附近的那个'), correct: true },
        { id: 'middle', label: t('Between the peaks', '停在两峰之间') },
      ] },
    },
    {
      id: 'w-kl', kind: 'explore', skill: 'kl-direction', title: t('Fit the student', '拟合学生'),
      scene: vis('forward_reverse_kl', { mu: 2.5, sigma: 1, direction: 'forward' }),
      prompt: t(
        'Grey is the teacher $p$, blue the student $q$. Drag the top of $q$ (left/right: μ, up/down: σ). **1.** With the forward KL selected, drag $q$ by hand to the smallest forward KL. **2.** Switch to the reverse KL and do the same. **3.** Turn on "left peak heavier", put $q$ on the right, and press **Run gradient descent**.',
        '灰色是老师 $p$，蓝色是学生 $q$。拖动 $q$ 的峰顶（左右改 μ，上下改 σ）。**1.** 选正向 KL，手动把 $q$ 拖到正向 KL 最小的位置。**2.** 换成反向 KL，同样找到最小。**3.** 打开"左峰更重"，把 $q$ 放在右边，按**从这里开始梯度下降**。',
      ),
      setup: world_setup(),
      actions: [{ id: 'descend', label: t('Run gradient descent from here', '从这里开始梯度下降'), primary: true, run: (s: any) => s.run_descent() }],
      goals: [
        { id: 'fwd_fit', check: (_s, _c, w) => !!w.state.fwd_ok, message: t('Forward KL is smallest when q covers both peaks: it matches their mean and spread.', 'q 盖住两个峰时正向 KL 最小：它匹配了两峰的均值和方差。') },
        { id: 'rev_fit', check: (_s, _c, w) => !!w.state.rev_ok, message: t('Reverse KL is smallest with q inside one peak: no mass where the teacher has none.', 'q 缩进一个峰时反向 KL 最小：老师没有的地方，学生也不放质量。') },
        { id: 'uneven_run', check: (_s, _c, w) => !!w.state.uneven_run, message: t('It stops on the nearer, lighter peak: reverse KL only walks downhill to the nearest valley.', '它停在离起点近、较轻的那个峰：反向 KL 只会往下走，走到最近的谷底就停。') },
      ],
      detectors: [
        {
          id: 'fits', on: (e, w) => {
            if (e.type !== 'release' && e.type !== 'dir') return null;
            const d = e.data! as any, m = minima(!!d.uneven);
            if (e.type === 'release' && d.dir === 'forward' && d.fwd <= m.fwd + 0.03) w.state.fwd_ok = true;
            if (e.type === 'release' && d.dir === 'reverse' && d.rev <= (d.mu < 0 ? m.left : m.right) + 0.03) w.state.rev_ok = true;
            return null;
          },
        },
        { id: 'swap', on: (e) => (e.type === 'release' && (e.data as any).dir === 'forward' && Math.abs((e.data as any).mu) >= 1.4 && (e.data as any).sigma <= 0.9
          ? { kind: 'misconception', id: 'kl-direction-swap', message: t('That is where the reverse KL wants q. The forward KL is huge here: the other peak\'s mass is not covered, and log(p/q) blows up there.', '这是反向 KL 喜欢的位置。正向 KL 在这里很大：另一个峰的质量完全没被盖住，log(p/q) 在那里爆掉了。') }
          : null) },
        {
          id: 'run', on: (e, w) => {
            if (e.type !== 'descent') return null;
            const d = e.data! as any;
            if (d.uneven && d.dir === 'reverse' && d.start_mu > 0.5) w.state.uneven_run = true;
            return null;
          },
        },
      ],
      lines: [
        { text: t('Grey is the teacher, blue the student. Drag the top of the blue curve.', '灰色是老师，蓝色是学生。拖动蓝色曲线的峰顶。'), when: 'enter' },
        { text: t('Watch the red strip: its area is the KL you selected.', '看下方的红色条带：它的面积就是你选的那个 KL。'), when: 'idle' },
        { text: t('Forward KL is large here: the other peak is left uncovered.', '这里正向 KL 很大：另一个峰没被盖住。'), when: { finding: 'kl-direction-swap' } },
      ],
      solve: (s: any) => {
        const mm = moment_match(MIX(false));
        s.dir.set_value(0);
        s.mu.set_value(mm.mu);
        s.sigma.set_value(mm.sigma);
        s.on('release', s.state());
        s.dir.set_value(1);
        s.mu.set_value(2);
        s.sigma.set_value(0.6);
        s.on('release', s.state());
        s.uneven.set_value(1);
        s.mu.set_value(2.5);
        s.sigma.set_value(1);
        s.run_descent(true);
      },
    },
    {
      id: 'kl-llm', kind: 'read', title: t('What this means for language models', '这对语言模型意味着什么'),
      blocks: [
        { type: 'table', head: [t('Direction', '方向'), t('Averaged over', '在谁的样本上平均'), t('Behaviour', '行为'), t('In distillation', '对应的蒸馏')], rows: [
          [t('forward $\\mathrm{KL}(p\\Vert q)$', '正向 $\\mathrm{KL}(p\\Vert q)$'), t('the teacher\'s samples', '老师的样本'), t('covers every mode; a weak student smears mass between them', '覆盖所有模式；学生能力不够时，把概率摊到模式之间'), t('SFT on teacher text (B2)', '在老师文本上做 SFT（B2）')],
          [t('reverse $\\mathrm{KL}(q\\Vert p)$', '反向 $\\mathrm{KL}(q\\Vert p)$'), t('the **student\'s** samples', '**学生自己**的样本'), t('settles on modes it can do well; less variety', '缩进它能做好的模式；多样性下降'), t('on-policy distillation', '在线蒸馏')],
        ] },
        { type: 'p', text: t(
          'For a language model, "smearing mass between modes" means writing things the teacher would never write, which is MiniLLM\'s argument for the reverse KL[^minillm]. The price of the reverse KL is less variety. And because its average is over the student\'s own samples, **the reverse KL is naturally on-policy**: you have to let the student write.',
          '对语言模型来说，"把概率摊到模式之间"意味着写出老师根本不会写的东西，MiniLLM 正是据此主张用反向 KL[^minillm]。反向 KL 的代价是多样性下降。而且它是在学生自己的样本上取平均的，所以**反向 KL 天然就是在线的**：必须让学生自己写。',
        ) },
        { type: 'p', text: t('TRL\'s GKD trainer interpolates between the two with `beta` (0 ≈ forward, 1 ≈ reverse) and sets the share of the student\'s own samples with `lmbda`[^gkd].', 'TRL 的 GKD 训练器用 `beta` 在两者之间插值（0 接近正向，1 接近反向），用 `lmbda` 控制有多大比例的样本由学生自己生成[^gkd]。') },
        { type: 'cite', key: 'minillm', text: t('Gu et al. (2023). MiniLLM.', 'Gu 等（2023）。MiniLLM。'), url: 'https://arxiv.org/abs/2306.08543' },
        { type: 'cite', key: 'gkd', text: t('Agarwal et al. (2023). On-Policy Distillation of Language Models (GKD); TRL 1.15 docs.', 'Agarwal 等（2023）。On-Policy Distillation of Language Models（GKD）；TRL 1.15 文档。'), url: 'https://arxiv.org/abs/2306.13649' },
      ],
    },
    {
      id: 'derive-kd', kind: 'derive', skill: 'kd-temperature', title: t('Matching distributions with a temperature', '带温度去匹配分布'),
      intro: t(
        'Logit-level distillation softens both distributions with a temperature T, so the student also learns which wrong tokens the teacher found almost right. But softening shrinks the gradient, and the classic loss multiplies by T² to undo that. Here is why.',
        'logit 级蒸馏用温度 T 把两个分布都"软化"，这样学生还能学到：哪些错的 token，老师觉得也差不多对。但软化会让梯度变小，经典的损失要乘上 T² 才能补回来。下面推导原因。',
      ),
      lines: [
        { tex: 'q_i = \\frac{e^{z_i/T}}{\\sum_j e^{z_j/T}},\\qquad p_i = \\frac{e^{v_i/T}}{\\sum_j e^{v_j/T}}', why: t('Student logits $z$, teacher logits $v$, over the same vocabulary of N tokens: index $i$ must mean the same token in both, hence the same tokenizer.', '学生的 logits 是 $z$，老师的是 $v$，词表是同一个、共 N 个 token：下标 $i$ 在两边必须指同一个 token，所以要同一个分词器。') },
        { tex: '\\mathrm{KL}(p\\Vert q) = \\textstyle\\sum_i p_i\\log p_i - \\sum_i p_i \\log q_i', why: t('Only the second term depends on the student.', '只有第二项和学生有关。') },
        { tex: '\\frac{\\partial \\log q_k}{\\partial z_i} = \\frac{\\delta_{ki} - q_i}{T}', why: t('The derivative of a log-softmax; the 1/T comes from the chain rule.', 'log-softmax 的导数；1/T 来自链式法则。') },
        { tex: '\\frac{\\partial\\,\\mathrm{KL}}{\\partial z_i} = \\frac{q_i - p_i}{T}', why: t('Sum over $k$ with weights $p_k$, using $\\sum_k p_k = 1$.', '用权重 $p_k$ 对 $k$ 求和，并用 $\\sum_k p_k = 1$。') },
        { tex: 'T \\text{ large: } q_i \\approx \\tfrac{1 + z_i/T}{N},\\ p_i \\approx \\tfrac{1 + v_i/T}{N} \\;\\Rightarrow\\; \\frac{\\partial\\,\\mathrm{KL}}{\\partial z_i} \\approx \\frac{z_i - v_i}{N\\,T^2}', why: t('First-order Taylor with zero-mean logits (softmax ignores a shift). The gradient shrinks like $1/T^2$, and it is the gradient of a squared distance between logits: at high T, distillation is logit matching.', '一阶泰勒展开，并取均值为零的 logits（softmax 对整体平移不敏感）。梯度按 $1/T^2$ 缩小，而且它正是 logits 之间平方距离的梯度：温度很高时，蒸馏就是在直接匹配 logits。') },
        { tex: 'L = \\alpha\\,\\mathrm{CE}(y, q^{(1)}) + (1-\\alpha)\\,T^2\\,\\mathrm{KL}(p^{(T)}\\Vert q^{(T)})', why: t('Multiplying by $T^2$ keeps the soft term\'s gradient about the same size whatever T is, so α keeps its meaning when you tune T. (Language-model distillation often uses T near 1, where this matters less.)', '乘上 $T^2$，软标签项的梯度大小就基本不随 T 变化，调 T 的时候 α 的含义也就不变。（语言模型的蒸馏常用接近 1 的温度，这时它的影响小一些。）') },
      ],
      blank: { line: 3, answer: '(q - p)/T', variables: ['q', 'p', 'T'], ranges: { q: [0.05, 0.9], p: [0.05, 0.9], T: [0.5, 4] }, prompt: t('Your turn: the gradient of the KL with respect to $z_i$ (write q, p, T for $q_i$, $p_i$, $T$).', '轮到你：KL 对 $z_i$ 的梯度（用 q、p、T 表示 $q_i$、$p_i$、$T$）。') },
      outro: t('So the temperature changes what is learned (softer targets) and how strongly (by 1/T²); the T² factor separates the two.', '所以温度同时改变了学什么（更软的目标）和学得多用力（按 1/T² 变）；T² 因子把这两件事分开了。'),
    },
    {
      id: 'q-t2', kind: 'checkpoint', skill: 'kd-temperature', purpose: 'check', title: t('Without T²', '不乘 T² 会怎样'),
      prompt: t('Without the $T^2$ factor, raising the temperature from 2 to 8 makes the soft term\'s gradient about how many times **smaller**? (Use the high-temperature approximation.)', '不乘 $T^2$ 时，把温度从 2 提到 8，软标签项的梯度大约会**缩小**到原来的几分之一？（用高温近似。）'),
      question: { type: 'number', answer: 16, tolerance: 0, wrong: [{ answer: 4, misconception: 't2-optional', feedback: t('The gradient scales like $1/T^2$, not $1/T$: $(8/2)^2 = 16$.', '梯度按 $1/T^2$ 变化，不是 $1/T$：$(8/2)^2 = 16$。') }] },
    },
    {
      id: 'code-kd', kind: 'code', title: t('A distillation loss (optional)', '一个蒸馏损失（选读）'),
      intro: t('Both directions, with temperature and mask. The tensors are as wide as the vocabulary, so in practice compute it in chunks or keep only the teacher\'s top-k.', '两个方向都写了，带温度和掩码。这些张量和词表一样宽，实际中要分块计算，或者只保留老师的 top-k。'),
      lang: 'python', code: CODE_KD,
      notes: [
        { lines: [3, 5], text: t('Soften both distributions with the same temperature.', '用同一个温度软化两个分布。'), shapes: 's_logits, t_logits: [B, L, V];  mask: [B, L]' },
        { lines: [6, 7], text: t('Forward KL: weighted by the teacher\'s probabilities, so the student is punished wherever the teacher has mass it lacks.', '正向 KL：用老师的概率加权，所以老师有、学生没有的地方，学生都要挨罚。') },
        { lines: [8, 9], text: t('Reverse KL: weighted by the student\'s own probabilities, so only tokens the student already favours get a gradient.', '反向 KL：用学生自己的概率加权，所以只有学生本来就偏好的 token 才有梯度。') },
        { lines: [10, 10], text: t('Average over the answer\'s tokens and multiply by T².', '对回答的 token 取平均，再乘以 T²。') },
      ],
    },
    // ------------------------------------------------------------------ on-policy distillation
    {
      id: 'onpolicy', kind: 'read', chapter: t('On-policy distillation', '在线蒸馏'), title: t('The student writes, the teacher grades every token', '学生自己写，老师逐 token 打分'),
      blocks: [
        { type: 'p', text: t(
          'Compare the signals. **SFT on teacher text** grades every token, but on the teacher\'s text: at test time the student continues *its own* prefixes, mistakes included, which it never practised on. **RL** practises on the student\'s own attempts, but gives about one bit per attempt. **On-policy distillation** takes the best of both: the student writes, and the teacher scores every token it wrote.',
          '比较一下各自的信号。**在老师文本上做 SFT**：每个 token 都有信号，但用的是老师写的文本；考试时学生要接着*自己*的前文往下写，包括自己犯的错，这些它从没练过。**强化学习**：在学生自己的尝试上练，但每次尝试大约只给一比特信息。**在线蒸馏**取两者之长：学生自己写，老师给它写的每个 token 打分。',
        ) },
        { type: 'table', head: [t('', ''), t('sparse signal', '信号稀疏'), t('dense signal (every token)', '信号稠密（每个 token）')], rows: [
          [t('off-policy (teacher\'s text)', '离线（老师的文本）'), '—', t('SFT, sequence-level distillation', 'SFT、序列级蒸馏')],
          [t('on-policy (student\'s own text)', '在线（学生自己的文本）'), t('RL', '强化学习'), t('**on-policy distillation**', '**在线蒸馏**')],
        ] },
        { type: 'p', text: t(
          'The teacher only has to compute log-probabilities of tokens it is shown, one forward pass, not generate[^tm]. The numbers are striking. In Qwen3-8B, from the same distilled checkpoint (55.0 on AIME 2024), RL reached 67.6 in 17,920 GPU hours; on-policy distillation reached 74.4 in 1,800, and also raised pass@64 where RL did not[^qwen3]. In Thinking Machines\' own runs a checkpoint at 60% reached 70% in about 150 steps[^tm].',
          '老师只需要对给它看的 token 算 log 概率，做一次前向就够，不用自己生成[^tm]。数字很惊人。Qwen3-8B 从同一个蒸馏检查点出发（AIME 2024 得 55.0）：强化学习用 17,920 GPU 小时到了 67.6；在线蒸馏用 1,800 GPU 小时到了 74.4，而且提高了强化学习没能提高的 pass@64[^qwen3]。Thinking Machines 自己的实验里，一个 60% 的检查点大约 150 步就到了 70%[^tm]。',
        ) },
        { type: 'callout', kind: 'misconception', body: t('SFT on the teacher\'s outputs is not on-policy distillation: there the student never sees its own prefixes.', '在老师的输出上做 SFT 不是在线蒸馏：那里学生从来看不到自己写的前文。') },
        { type: 'cite', key: 'tm', text: t('Thinking Machines (2025). On-Policy Distillation.', 'Thinking Machines（2025）。On-Policy Distillation。'), url: 'https://thinkingmachines.ai/blog/on-policy-distillation/' },
        { type: 'cite', key: 'qwen3', text: t('Qwen3 Technical Report, Table 21.', 'Qwen3 技术报告，表 21。'), url: 'https://arxiv.org/abs/2505.09388' },
      ],
    },
    {
      id: 'derive-onpolicy', kind: 'derive', skill: 'on-policy-distill', title: t('It is RL with a reward on every token', '它就是每个 token 都有奖励的强化学习'),
      intro: t('Minimising the reverse KL on the student\'s own samples turns out to be policy gradient (D2, E1) with a reward on every token. That is why the same RL machinery runs it.', '在学生自己的样本上最小化反向 KL，结果正好是策略梯度（D2、E1），只不过每个 token 都有奖励。所以同一套强化学习的框架就能跑它。'),
      lines: [
        { tex: '\\mathrm{KL}(\\pi_s\\Vert\\pi_t) = \\mathbb E_{y\\sim\\pi_s}\\big[\\textstyle\\sum_t d_t\\big],\\quad d_t = \\log\\pi_s(y_t\\mid\\cdot) - \\log\\pi_t(y_t\\mid\\cdot)', why: t('A sequence\'s probability is the product of its token probabilities, so its log-ratio is a sum over tokens. The average is over the student\'s samples.', '一条序列的概率是各 token 概率的乘积，所以对数比值是逐 token 的和。期望是在学生的样本上取的。') },
        { tex: '\\nabla\\,\\mathbb E_{y\\sim\\pi_s}[f_\\theta(y)] = \\mathbb E\\big[f_\\theta\\,\\nabla\\log\\pi_s(y)\\big] + \\mathbb E\\big[\\nabla f_\\theta\\big]', why: t('The log-derivative trick, plus a term because $f$ itself depends on θ. That second term is $\\mathbb E[\\nabla\\log\\pi_s] = 0$, as in E1.', '对数导数技巧，再加上一项，因为 $f$ 本身也依赖 θ。这第二项等于 $\\mathbb E[\\nabla\\log\\pi_s] = 0$，和 E1 一样。') },
        { tex: '\\nabla\\,\\mathrm{KL} = \\mathbb E\\Big[\\textstyle\\sum_t \\big(\\sum_{t\'\\ge t} d_{t\'}\\big)\\,\\nabla\\log\\pi_s(y_t\\mid\\cdot)\\Big]', why: t('Terms before t do not depend on the choice at t and drop out: the same "reward-to-go" argument as in policy gradient.', 't 之前的项和第 t 步的选择无关，可以去掉：和策略梯度里"未来回报"的论证一样。') },
        { tex: 'r_t = -d_t = \\log\\pi_t(y_t) - \\log\\pi_s(y_t)', why: t('So minimising the reverse KL is policy gradient with a per-token reward: positive where the teacher likes the student\'s token more than the student does, negative where it likes it less.', '所以最小化反向 KL，就是用一个逐 token 奖励做策略梯度：老师比学生更认可这个 token 时奖励为正，更不认可时为负。') },
        { tex: 'A_t = r_t \\quad(\\text{discount } 0)', why: t('Thinking Machines use only the current token\'s reward and report that it works. GKD instead computes the full-vocabulary KL at each position, which needs the teacher\'s whole distribution.', 'Thinking Machines 只用当前 token 的奖励，并报告这样就够了。GKD 则在每个位置算完整词表上的 KL，这需要老师的完整分布。') },
      ],
      blank: { line: 3, answer: 'lt - ls', variables: ['lt', 'ls'], prompt: t('Your turn: the reward of a token, with lt = log π_t(y_t) and ls = log π_s(y_t).', '轮到你：一个 token 的奖励，记 lt = log π_t(y_t)，ls = log π_s(y_t)。') },
      outro: t('The student also learns how to recover from its own mistakes, because the teacher grades the tokens right after them. That is GKD\'s subtitle: learning from self-generated mistakes.', '学生还能学会怎样从自己的错误里走出来，因为老师给的正是错误之后那些 token 的分数。这就是 GKD 论文副标题的意思："从自己生成的错误中学习"。'),
    },
    {
      id: 'code-onpolicy', kind: 'code', title: t('One step of on-policy distillation', '在线蒸馏的一步'),
      intro: t('From scratch, sampled-token version (same tokenizer for both models). The TRL version is on the next page.', '从零实现，按采样到的 token 计算的版本（两个模型用同一个分词器）。TRL 的写法在下一页。'),
      lang: 'python', code: CODE_ONPOLICY,
      notes: [
        { lines: [3, 5], text: t('Log-probability of each actual next token. Logits at position i predict token i + 1, hence the shift by one.', '每个实际出现的下一个 token 的 log 概率。位置 i 的 logits 预测的是第 i + 1 个 token，所以要错开一位。'), shapes: 'seqs: [B, S] → logp: [B, S−1]' },
        { lines: [8, 10], text: t('The student samples; the teacher only scores those tokens, with no gradient.', '学生采样；老师只给这些 token 打分，不算梯度。') },
        { lines: [11, 12], text: t('The student\'s log-probabilities with gradients, masked to the tokens it wrote.', '学生带梯度的 log 概率，只保留它自己写的那些 token。') },
        { lines: [13, 14], text: t('The per-token reward $\\log\\pi_t - \\log\\pi_s$, used exactly like an advantage.', '逐 token 奖励 $\\log\\pi_t - \\log\\pi_s$，用法和优势一模一样。') },
        { lines: [16, 16], text: t('Its average is the sampled reverse KL per token: log it, it should fall.', '它的平均值就是采样得到的每 token 反向 KL：把它记下来，它应该下降。') },
      ],
    },
    {
      id: 'mopd', kind: 'read', title: t('Many teachers: the 2026 pattern', '多个老师：2026 年的标志做法'),
      blocks: [
        { type: 'p', text: t(
          'Labs now train several specialists (maths, code, agents), each with RL on its own domain, and then fold them into one student by on-policy distillation: the student answers prompts from all domains, and each answer is scored by the teacher of its domain. The reported name is multi-teacher on-policy distillation (MOPD)[^ic].',
          '如今实验室先训练几个专家（数学、代码、智能体），各自在本领域做强化学习，再用在线蒸馏把它们合进一个学生：学生回答来自各个领域的题目，每个回答由所属领域的老师打分。这种做法被称为多老师在线蒸馏（multi-teacher on-policy distillation, MOPD）[^ic]。',
        ) },
        fig('mopd', t('Multi-teacher on-policy distillation: one student, a teacher per domain, reverse KL on the student\'s own answers.', '多老师在线蒸馏：一个学生，每个领域一个老师，在学生自己的回答上做反向 KL。')),
        { type: 'list', items: [
          t('**Why it replaced weight merging:** distillation does not need a shared base (sequence-level not even a shared tokenizer), the student can be smaller, and conflicts are settled by data on the student\'s own distribution rather than by arithmetic on weights[^adoption].', '**为什么取代了权重合并：**蒸馏不要求同一个基座（序列级蒸馏连分词器都不要求一样），学生还可以更小；不同专家之间的冲突，由学生自己分布上的数据来裁决，而不是靠权重算术[^adoption]。'),
          t('**Costs:** every teacher must be served to score tokens; teachers trained very differently may pull the student apart (NVIDIA reports such teachers "cannot be effectively combined"), so prompts are routed by domain and weighted.', '**代价：**每个老师都要在线服务、给 token 打分；训练方式差别太大的老师会把学生往不同方向拉（NVIDIA 报告这类老师"无法有效合并"），所以要按领域路由题目，并调节权重。'),
          t('**Tools:** the Tinker cookbook has distillation recipes; TRL\'s GKD and GOLD (experimental) handle one teacher, so route domains yourself.', '**工具：**Tinker cookbook 里有蒸馏配方；TRL 的 GKD 和 GOLD（实验性）只支持单个老师，多老师需要自己按领域路由。'),
        ] },
        { type: 'code', lang: 'python', code: GKD_SNIPPET, caption: t('One teacher with TRL 1.15. GOLD handles teachers with a different tokenizer, approximately.', '用 TRL 1.15 做单个老师的在线蒸馏。分词器不同时，GOLD 可以做近似的对齐。') },
        { type: 'cite', key: 'ic', text: t('Interconnects, "Frontier post-training recipe review" (16 June 2026), an interview summary: MiMo Flash v2 introduced the term; DeepSeek V4 and Nemotron 3 Ultra use more than 10 teachers.', 'Interconnects，《Frontier post-training recipe review》（2026 年 6 月 16 日），访谈整理：MiMo Flash v2 提出了这个名字；DeepSeek V4 和 Nemotron 3 Ultra 用了 10 个以上的老师。'), url: 'https://interconnects.ai/p/frontier-post-training-recipe-review' },
        { type: 'cite', key: 'adoption', text: t('research-adoption.md §3, §8.', 'research-adoption.md §3、§8。'), url: 'https://interconnects.ai/p/frontier-post-training-recipe-review' },
      ],
    },
    {
      id: 'case-1', kind: 'checkpoint', skill: 'kd-kinds', purpose: 'check',
      group: { id: 'teachers', title: t('Which kind of distillation?', '用哪种蒸馏？'), brief: [
        { type: 'p', text: t('Three teams want a small, cheap model. Pick the way to distil that fits what each team can get from its teacher.', '三个团队都想要一个又小又便宜的模型。根据每个团队能从老师那里拿到什么，选出合适的蒸馏方式。') },
      ] },
      prompt: t('Team A\'s teacher is a closed model behind an API that returns only text.', 'A 团队的老师是一个闭源模型，只能通过 API 拿到文本。'),
      question: { type: 'choice', options: [
        { id: 'seq', label: t('Sequence-level: generate answers, filter them, SFT the student (and check the API\'s terms of service)', '序列级：生成回答、过滤、再对学生做 SFT（并先查 API 的服务条款）'), correct: true },
        { id: 'logit', label: t('Logit-level distillation', 'logit 级蒸馏'), misconception: 'distill-needs-logits', feedback: t('Text is all the API returns; and some providers restrict training on their outputs.', 'API 只返回文本；而且有些服务商限制用它的输出训练模型。') },
        { id: 'onp', label: t('On-policy distillation', '在线蒸馏'), feedback: t('That needs the teacher\'s log-probability of every student token, which a text-only API does not give.', '那需要老师给学生的每个 token 算 log 概率，只返回文本的 API 给不了。') },
      ] },
    },
    {
      id: 'case-2', kind: 'checkpoint', skill: 'on-policy-distill', purpose: 'check',
      group: { id: 'teachers', title: t('Which kind of distillation?', '用哪种蒸馏？') },
      prompt: t('Team B runs Qwen3-32B locally and wants Qwen3-1.7B to match it on maths. Same tokenizer.', 'B 团队在本地跑 Qwen3-32B，想让 Qwen3-1.7B 在数学上追上它。分词器相同。'),
      question: { type: 'choice', options: [
        { id: 'both', label: t('A sequence-level SFT warm-up, then on-policy distillation', '先用序列级 SFT 热身，再做在线蒸馏'), correct: true, feedback: t('This is Qwen3\'s own order: off-policy first, then on-policy.', '这正是 Qwen3 自己的顺序：先离线，后在线。') },
        { id: 'seqonly', label: t('Sequence-level SFT only', '只做序列级 SFT'), feedback: t('It works, but you can get the teacher\'s scores on the student\'s own text, which is much more efficient.', '也行，但你明明能拿到老师对学生自己文本的打分，那要高效得多。') },
        { id: 'rl', label: t('GRPO on the small model; skip the teacher', '直接在小模型上做 GRPO，不用老师'), misconception: 'rl-strictly-better', feedback: t('With a strong teacher at hand, RL on the small model costs about 10× more for less (Qwen3 Table 21).', '手边就有强老师，还在小模型上直接做强化学习：花费约 10 倍，效果还更差（Qwen3 表 21）。') },
      ] },
    },
    {
      id: 'case-3', kind: 'checkpoint', skill: 'merging-basics', purpose: 'check',
      group: { id: 'teachers', title: t('Which kind of distillation?', '用哪种蒸馏？') },
      prompt: t('Team C has a maths specialist and a code specialist fine-tuned from the same base, and a Llama-based legal model. It wants one model with all three skills.', 'C 团队有同一个基座微调出来的数学专家和代码专家，还有一个基于 Llama 的法律模型。它想要一个三样都会的模型。'),
      question: { type: 'choice', options: [
        { id: 'mopd', label: t('Distil all three into one student (multi-teacher; sequence-level for the Llama model). A quick TIES merge of the two same-base models is a cheap first try', '把三个都蒸馏进一个学生（多老师；Llama 那个用序列级）。两个同基座的模型可以先快速试一下 TIES 合并'), correct: true },
        { id: 'avg', label: t('Average the weights of all three', '把三个模型的权重直接平均'), misconception: 'merge-any', feedback: t('The Llama model has a different base: its coordinates mean different things. Weights can only be merged within one base.', 'Llama 那个模型基座不同：它的参数坐标含义不一样。权重合并只能在同一个基座内做。') },
        { id: 'logit', label: t('Logit distillation from all three teachers', '用三个老师做 logit 蒸馏'), feedback: t('The Llama teacher has a different vocabulary, so its logits do not line up with the student\'s.', 'Llama 老师的词表不同，它的 logits 和学生的对不上。') },
      ] },
    },
    {
      id: 'when', kind: 'read', title: t('When distillation wins, and its limits', '蒸馏什么时候赢，以及它的上限'),
      blocks: [
        { type: 'table', head: [t('Model (AIME 2024 pass@1)', '模型（AIME 2024 pass@1）'), t('Score', '得分')], rows: [
          [t('R1-Distill-Qwen-1.5B / 7B / 14B / 32B', 'R1-Distill-Qwen-1.5B / 7B / 14B / 32B'), '28.9 / 55.5 / 69.7 / 72.6'],
          [t('R1-Distill-Llama-8B / 70B', 'R1-Distill-Llama-8B / 70B'), '50.4 / 70.0'],
          [t('Qwen-32B with large-scale RL (R1-Zero-Qwen-32B, >10k steps)', 'Qwen-32B 直接大规模强化学习（R1-Zero-Qwen-32B，超过 1 万步）'), '47.0'],
        ] },
        { type: 'p', text: t(
          'The R1 authors draw two conclusions: distilling a stronger model into a smaller one beats large-scale RL on the small model, at far lower cost; but "advancing beyond the boundaries of intelligence may still require more powerful base models and larger-scale reinforcement learning"[^r1]. Distillation can also bring in reasoning patterns the student never had, which RLVR does not (Yue et al., E2).',
          'R1 的作者得出两条结论：把更强的模型蒸馏进小模型，比在小模型上做大规模强化学习效果更好，成本也低得多；但"要突破智能的边界，可能仍然需要更强的基座模型和更大规模的强化学习"[^r1]。此外，蒸馏还能带来学生原本没有的推理模式，而 RLVR 做不到这一点（Yue 等，E2）。',
        ) },
        { type: 'callout', kind: 'warning', title: t('The limits', '上限在哪'), body: t(
          'The student is capped by the teacher: if the teacher is weak in your domain, distillation cannot help. You need access to the teacher and its terms must allow it (check the licence; some providers restrict training on outputs). Many APIs return only text, so logit and on-policy distillation are out. And a student far smaller than its teacher may not be able to follow it.',
          '学生的上限就是老师：老师在你的领域本身就不行，蒸馏也帮不上。你得能用到老师，而且条款要允许（查许可证；有些服务商限制用它的输出训练模型）。很多 API 只返回文本，logit 蒸馏和在线蒸馏就做不了。学生如果比老师小太多，也可能学不动。',
        ) },
        { type: 'cite', key: 'r1', text: t('DeepSeek-R1 v1, Tables 5–6 and §4.1.', 'DeepSeek-R1 v1，表 5–6 与 §4.1。'), url: 'https://arxiv.org/abs/2501.12948' },
      ],
    },
    // ------------------------------------------------------------------ merging
    {
      id: 'merge', kind: 'read', chapter: t('Merging, briefly', '模型合并（简讲）'), title: t('Adding fine-tunes as vectors', '把微调当成向量相加'),
      blocks: [
        { type: 'p', text: t(
          'Merging combines fine-tuned models without any training. Fine-tuning moves the weights from $\\theta_0$ to $\\theta_i$; call the move a **task vector** $\\tau_i = \\theta_i - \\theta_0$. Merging adds them: $\\theta = \\theta_0 + \\sum_i \\lambda_i\\tau_i$. Averaging fine-tunes ("model soups") is the case $\\lambda_i = 1/n$; interpolating with the base (WiSE-FT) is one task with $\\lambda \\in [0, 1]$[^ta]. Only models from the **same base** can be merged: elsewhere the coordinates mean different things.',
          '合并不需要任何训练，就能把几个微调过的模型组合起来。微调把权重从 $\\theta_0$ 移到了 $\\theta_i$；把这段位移叫作**任务向量** $\\tau_i = \\theta_i - \\theta_0$。合并就是把它们加起来：$\\theta = \\theta_0 + \\sum_i \\lambda_i\\tau_i$。把多个微调模型取平均（"模型汤"）就是 $\\lambda_i = 1/n$ 的情形；和基座插值（WiSE-FT）就是只有一个任务、$\\lambda \\in [0, 1]$[^ta]。只有**同一个基座**出来的模型才能合并：不同基座的参数坐标，含义根本不同。',
        ) },
        fig('task_vectors', t('Why adding can hurt: what matters is whether $\\tau_B$ runs along task A\'s flat or steep direction (a 2-D toy).', '为什么相加会互相伤害：关键在于 $\\tau_B$ 沿着任务 A 的平坦方向还是陡峭方向（二维示意）。')),
        { type: 'p', text: t(
          'Near task A\'s optimum its loss grows like $\\tfrac12\\Delta^\\top H_A\\Delta$, where $\\Delta$ is how far the merge moved away from $\\theta_A$. Adding $\\tau_B$ is harmless along directions where $H_A$ is flat (small eigenvalues, the long axis of the ellipse from the eigen-PCA lesson) and harmful along steep ones. When two task vectors push **the same coordinate in opposite directions**, averaging cancels both, and a coordinate only one task changed gets diluted. **TIES** fixes this in three steps: keep each vector\'s largest entries, elect a sign per coordinate, average only the entries that agree[^ties].',
          '在任务 A 的最优点附近，它的损失大约按 $\\tfrac12\\Delta^\\top H_A\\Delta$ 增长，$\\Delta$ 是合并之后离 $\\theta_A$ 走了多远。$\\tau_B$ 如果沿着 $H_A$ 平坦的方向（小特征值，也就是"特征值 → PCA"课里椭圆的长轴），加上去几乎无害；沿着陡峭的方向就会伤到 A。两个任务向量**在同一个坐标上方向相反**时，直接平均会互相抵消；只有一个任务改过的坐标，又会被稀释。**TIES** 分三步解决：每个向量只保留幅值最大的那些分量，每个坐标投票选出一个符号，只对同号的分量取平均[^ties]。',
        ) },
        { type: 'table', head: [t('coordinate', '坐标'), '1', '2', '3', '4'], rows: [
          ['τ₁', '0.8', '−0.1', '0.5', '0.02'],
          ['τ₂', '0.6', '0.3', '−0.7', '0.01'],
          ['τ₃', '−0.1', '0.4', '−0.2', '0.9'],
          [t('plain average', '直接平均'), '0.43', '0.20', '−0.13', '0.31'],
        ] },
        { type: 'details', summary: t('DARE, tools, and how often merging is used', 'DARE、工具，以及合并的实际使用'), blocks: [
          { type: 'p', text: t('DARE drops each delta entry with probability p and rescales the rest by 1/(1 − p), which keeps the expectation (like dropout)[^dare]. Tools: MergeKit; for LoRA adapters, PEFT\'s `add_weighted_adapter`.', 'DARE 以概率 p 丢掉每个增量分量，剩下的乘以 1/(1 − p)，期望不变（和 dropout 一样）[^dare]。工具：MergeKit；LoRA 适配器可以用 PEFT 的 `add_weighted_adapter`。') },
          { type: 'p', text: t('Use is declining: on Qwen3-8B the Hub has 38 merges against 2,250 adapters, and the Open LLM Leaderboard that drove merging closed in March 2025. Labs still use it (Gemma 3\'s WARP/WARM, Cohere Command A), but combine specialists more and more by distillation[^adoption].', '使用在减少：在 Qwen3-8B 上，Hub 上只有 38 个合并模型，适配器却有 2,250 个；推动合并的 Open LLM Leaderboard 已于 2025 年 3 月关闭。实验室仍在用（Gemma 3 的 WARP/WARM、Cohere Command A），但越来越多地改用蒸馏来合并专家[^adoption]。') },
        ] },
        { type: 'cite', key: 'ta', text: t('Ilharco et al. (2023). Editing Models with Task Arithmetic.', 'Ilharco 等（2023）。Editing Models with Task Arithmetic。'), url: 'https://arxiv.org/abs/2212.04089' },
        { type: 'cite', key: 'ties', text: t('Yadav et al. (2023). TIES-Merging.', 'Yadav 等（2023）。TIES-Merging。'), url: 'https://arxiv.org/abs/2306.01708' },
        { type: 'cite', key: 'dare', text: t('Yu et al. (2023). Language Models are Super Mario (DARE).', 'Yu 等（2023）。Language Models are Super Mario（DARE）。'), url: 'https://arxiv.org/abs/2311.03099' },
        { type: 'cite', key: 'adoption', text: t('research-adoption.md §8.', 'research-adoption.md §8。'), url: 'https://huggingface.co/models?other=merge' },
      ],
    },
    {
      id: 'q-ties', kind: 'checkpoint', skill: 'merging-basics', purpose: 'check', title: t('Merge by hand', '手算一次合并'),
      prompt: t('Use the table above. Keep the **2 largest** entries (by absolute value) of each τ, then do TIES. What is the merged value of **coordinate 3**?', '用上面那张表。每个 τ 只保留幅值**最大的 2 个**分量，然后做 TIES。合并后**第 3 个坐标**是多少？'),
      question: { type: 'number', answer: -0.7, tolerance: 0.005, wrong: [
        { answer: -0.133, misconception: 'average-is-enough', feedback: t('That is the plain average of all three, before trimming.', '这是三个分量不经修剪的直接平均。') },
        { answer: -0.1, feedback: t('You averaged entries of both signs. Only those agreeing with the elected sign count.', '你把正负两种分量一起平均了。只有和选出的符号一致的分量才算。') },
        { answer: -0.2, feedback: t('That is the vote\'s sum (0.5 − 0.7), which only decides the sign.', '这是投票时的和（0.5 − 0.7），它只决定符号。') },
      ] },
      hints: [t('After trimming, coordinate 3 keeps τ₁\'s 0.5 and τ₂\'s −0.7 (τ₃\'s −0.2 is not among its 2 largest).', '修剪之后，第 3 个坐标只剩 τ₁ 的 0.5 和 τ₂ 的 −0.7（τ₃ 的 −0.2 不在它最大的 2 个之内）。')],
      explain: t('Sign: 0.5 − 0.7 < 0, so negative; average the negative entries: −0.7. Compare coordinate 4: only τ₃ changed it, and TIES keeps 0.9 where plain averaging gives 0.31.', '符号：0.5 − 0.7 < 0，取负；只平均负的分量：−0.7。再看第 4 个坐标：只有 τ₃ 改过它，TIES 保留了 0.9，直接平均却只剩 0.31。'),
    },
    // ------------------------------------------------------------------ forgetting
    {
      id: 'forget', kind: 'read', chapter: t('Forgetting, revisited', '再看遗忘'), title: t('Learn on your own samples, forget less', '在自己的样本上学，忘得更少'),
      blocks: [
        { type: 'p', text: t(
          'B3 showed that fine-tuning forgets. RL\'s Razor gives a sharper rule: **how much a model forgets is predicted by how far it moved from the start, measured as the KL to the base model on the new task**. On-policy RL, among all the solutions that do the new task, tends to find ones with small KL; SFT on fixed targets can move arbitrarily far[^razor]. "SFT memorises, RL generalises" says the same from another angle, though SFT is still needed to stabilise the output format[^chu].',
          'B3 讲过，微调会遗忘。RL\'s Razor 给出了一条更精确的规律：**一个模型忘掉多少，可以用它离起点走了多远来预测，具体是在新任务上相对基座的 KL**。在所有能完成新任务的解里，在线强化学习倾向于找 KL 小的那些；而在固定目标上做 SFT，可能走得很远[^razor]。"SFT 偏记忆，强化学习偏泛化"是从另一个角度说同一件事，不过 SFT 仍然需要用来稳定输出格式[^chu]。',
        ) },
        { type: 'p', text: t(
          'On-policy distillation also learns on the student\'s own samples, so by the same argument we would expect it to forget less (an inference, not a measured result). It is also a repair tool: after mid-training on internal documents, Thinking Machines restored instruction following (IF-eval 79% → 83%, the original 85%) by on-policy distillation from the original model[^tm].',
          '在线蒸馏同样是在学生自己的样本上学，按同样的道理，预期它遗忘也较少（这是推论，不是测出来的结果）。它还可以当修复工具：Thinking Machines 在内部文档上做完中期训练后，用原模型当老师做在线蒸馏，把指令遵循能力找了回来（IF-eval 从 79% 回到 83%，原模型是 85%）[^tm]。',
        ) },
        { type: 'cite', key: 'razor', text: t('Shenfeld et al. (2025). RL\'s Razor.', 'Shenfeld 等（2025）。RL\'s Razor。'), url: 'https://arxiv.org/abs/2509.04259' },
        { type: 'cite', key: 'chu', text: t('Chu et al. (2025). SFT Memorizes, RL Generalizes.', 'Chu 等（2025）。SFT Memorizes, RL Generalizes。'), url: 'https://arxiv.org/abs/2501.17161' },
        { type: 'cite', key: 'tm', text: t('Thinking Machines (2025). On-Policy Distillation.', 'Thinking Machines（2025）。On-Policy Distillation。'), url: 'https://thinkingmachines.ai/blog/on-policy-distillation/' },
      ],
    },
    {
      id: 'q-diversity', kind: 'checkpoint', chapter: t('Check and choose', '检验与选择'), skill: 'kl-direction', purpose: 'check', title: t('All the same opening', '开头全一样'),
      prompt: t('After on-policy distillation with the reverse KL, the student\'s maths accuracy is up, but when it writes stories, 8 samples start almost identically. Why, and what would you change?', '用反向 KL 做完在线蒸馏后，学生的数学正确率上去了，可写故事时，8 次采样的开头几乎一模一样。为什么？你会改什么？'),
      question: { type: 'choice', options: [
        { id: 'mode', label: t('Reverse KL is mode-seeking: the student settled on the teacher\'s main mode. Move β toward forward KL, or mix in sequence-level data for creative tasks', '反向 KL 会寻峰：学生缩到了老师的主要模式上。把 β 往正向那边调，或者在创作类任务上混入序列级蒸馏的数据'), correct: true },
        { id: 'lr', label: t('The learning rate is too high', '学习率太高') },
        { id: 'temp', label: t('Sampling temperature too low', '采样温度太低'), feedback: t('Temperature affects variety, but here the distribution itself has narrowed. Look back at the world.', '温度会影响多样性，但这里是分布本身变窄了。回头看看那个世界。') },
        { id: 'weak', label: t('The teacher is too weak', '老师太弱') },
      ] },
    },
    {
      id: 'q-cheap', kind: 'checkpoint', skill: 'on-policy-distill', purpose: 'check', title: t('Explain the price', '解释一下为什么便宜'),
      prompt: t('In one or two sentences: why can on-policy distillation reach RL\'s result with about a tenth of the compute?', '用一两句话解释：在线蒸馏为什么能用约十分之一的算力，达到甚至超过强化学习的效果？'),
      question: { type: 'text', placeholder: t('Because…', '因为……'), rubric: {
        key_points: [
          t('Every token gets a signal from the teacher (dense), while RL gives one scalar, about one bit, per attempt.', '每个 token 都有老师给的信号（稠密），而强化学习每次尝试只有一个标量，大约一比特。'),
          t('The samples are the student\'s own (on-policy), so it learns where it actually goes, including recovering from its own mistakes.', '样本是学生自己写的（在线），所以它学的正是自己实际会走到的地方，包括怎样从自己的错误里走出来。'),
          t('The teacher only scores tokens with one forward pass; it does not generate.', '老师只需要一次前向给 token 打分，不用自己生成。'),
        ],
        model_answer: t('Because the signal is dense: the teacher scores every token the student writes, while RL gets about one bit per attempt. The samples are the student\'s own, so nothing is learned off-distribution, and the teacher only needs one forward pass to score them.', '因为信号是稠密的：老师给学生写的每个 token 都打分，而强化学习每次尝试只拿到大约一比特。样本是学生自己写的，学到的东西都在它自己的分布上；老师给它们打分也只需要做一次前向。'),
        min_points: 1,
      } },
    },
    {
      id: 'choose', kind: 'read', title: t('How to choose (E3)', '怎么选（E3）'),
      blocks: choose_card({
        upto: 'E3', highlight: 'E2,C3,E3', card: 'E3',
        rules: [
          t('A stronger teacher is available: distil into the small model instead of running RL on it (72.6 vs 47.0; about 1/10 of the GPU hours).', '有更强的老师：把它蒸馏进小模型，不要直接在小模型上做强化学习（72.6 对 47.0；约十分之一的 GPU 小时）。'),
          t('Pick the kind by what you can get from the teacher: text only (an API) → sequence-level, after checking the terms; local and same tokenizer → sequence-level warm-up, then on-policy (Qwen3\'s order); different tokenizer → sequence-level, or GOLD/ULD (experimental).', '按你能从老师那里拿到什么来选：只有文本（API）→ 序列级，先查条款；本地能跑、分词器相同 → 先序列级热身，再在线蒸馏（Qwen3 的顺序）；分词器不同 → 序列级，或 GOLD/ULD（实验性）。'),
          t('Several specialists into one model: multi-teacher on-policy distillation is the 2026 default; a weight merge (same base only) is the zero-training first try.', '要把多个专家合成一个模型：2026 年的默认做法是多老师在线蒸馏；权重合并（只限同一基座）可以作为零训练成本的第一次尝试。'),
          t('Worried about forgetting: prefer on-policy methods (RL, on-policy distillation), or distil from the old model to restore old skills; track the KL to the base on the new task.', '担心遗忘：优先选在线的方法（强化学习、在线蒸馏），或者用旧模型当老师做在线蒸馏，把旧能力找回来；盯住新任务上相对基座的 KL。'),
        ],
        counter: [
          t('The teacher is weak in your domain: the student\'s ceiling is the teacher. To go beyond it you need RL and real data.', '老师在你的领域本身就不行：学生的上限就是老师。要超过老师，需要强化学习和真实数据。'),
          t('Merging models from different bases: their coordinates do not correspond. Logit distillation across tokenizers is only approximate too.', '把不同基座的模型做权重合并：它们的坐标根本不对应。跨分词器的 logit 蒸馏也只能近似。'),
          t('Only reverse-KL on-policy distillation for a task that needs variety (creative writing): variety drops.', '需要多样输出的任务（比如创作）只用反向 KL 在线蒸馏：多样性会下降。'),
        ],
      }),
    },
  ],
};
