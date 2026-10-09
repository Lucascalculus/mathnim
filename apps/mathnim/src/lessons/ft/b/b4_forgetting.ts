// B4 Forgetting: why fine-tuning on a new task degrades old abilities, what
// predicts how much (RL's Razor), and what limits it. Plan: part-b-sft.md (B4);
// sources there and in research-sft.md (KL direction corrected to KL(π0‖π)).
import type { Lesson } from '@mathnim/core';
import { choose_card, on_handles, t, vis } from './common';

const KL_CODE = `import torch

@torch.no_grad()
def answer_logprob(model, ids, n_prompt):
    """Sum of log p(token) over the answer part of ids (prompt first)."""
    logits = model(ids).logits[:, :-1].float()                    # [1, T-1, V]
    logp = torch.log_softmax(logits, dim=-1)
    tok = logp.gather(-1, ids[:, 1:, None])[..., 0]               # [1, T-1]
    return tok[:, n_prompt - 1:].sum().item()                     # answer tokens only

@torch.no_grad()
def forgetting_kl(base, tuned, tokenizer, prompts, samples_per_prompt=4):
    """Estimate E_x KL(pi_0 || pi_ft) on new-task prompts: sample from the BASE model."""
    total, count = 0.0, 0
    for x in prompts:
        text = tokenizer.apply_chat_template([{"role": "user", "content": x}],
                                             add_generation_prompt=True, tokenize=False)
        enc = tokenizer(text, return_tensors="pt", add_special_tokens=False).to(base.device)
        n_prompt = enc.input_ids.size(1)
        for _ in range(samples_per_prompt):
            ids = base.generate(**enc, do_sample=True, max_new_tokens=256)   # y ~ pi_0
            total += answer_logprob(base, ids, n_prompt) - answer_logprob(tuned, ids, n_prompt)
            count += 1
    return total / count     # nats per answer; track it during training`;

export const lesson: Lesson = {
  id: 'ft-b4-forgetting',
  title: t('Forgetting', '遗忘'),
  description: t('Why fine-tuning on something new can break what the model could do, what predicts how much it forgets, and how to limit it.', '为什么在新任务上微调会弄坏模型原来会的东西，什么能预测它忘多少，以及怎样减少遗忘。'),
  mode: 'essay',
  skills: [
    { id: 'forgetting', name: t('Why fine-tuning forgets', '微调为什么会遗忘') },
    { id: 'forgetting-kl', name: t('Measuring forgetting by KL to the base model', '用相对基座的 KL 衡量遗忘'), prerequisites: ['forgetting'] },
    { id: 'forgetting-mitigation', name: t('Limiting forgetting', '减少遗忘'), prerequisites: ['forgetting'] },
  ],
  misconceptions: [
    { id: 'clean-data-safe', description: t('Fine-tuning on clean, harmless data cannot hurt other abilities or safety.', '用干净、无害的数据微调，不会伤害其他能力或安全性。') },
    { id: 'forgetting-distance', description: t('The further the weights move, the more the model forgets.', '权重挪得越远，模型忘得越多。') },
    { id: 'lora-no-forgetting', description: t('LoRA does not forget.', 'LoRA 不会遗忘。') },
    { id: 'train-longer-better', description: t('Once the new task’s loss is flat, more training steps are harmless.', '新任务的 loss 走平以后，多训几步也没坏处。') },
  ],
  steps: [
    {
      id: 'what', kind: 'read', chapter: t('Why models forget', '模型为什么会遗忘'), title: t('Nothing holds the old behaviour in place', '没有任何东西把原来的行为固定住'),
      blocks: [
        { type: 'p', text: t(
          'Fine-tuning only sees the new data. Its gradient says how to do better on the new task and nothing about the old ones, so any change that helps the new task is welcome, including changes that damage what the model could do before. That loss of old abilities is **catastrophic forgetting**. The training loss cannot show it; only the regression evaluations of B3 can.',
          '微调只看得到新数据。它的梯度只告诉模型怎样在新任务上做得更好，对旧任务只字不提；所以任何对新任务有利的改动都会被接受，包括那些损害模型原有能力的改动。这种旧能力的丢失，叫**灾难性遗忘（catastrophic forgetting）**。训练 loss 看不出它，只有 B3 讲的回归评测才能发现。') },
        { type: 'p', text: t('To see the mechanism, here is a toy with two parameters. Before you play with it, guess.', '为了看清机制，下面用一个只有两个参数的示意模型。玩之前先猜一猜。') },
      ],
    },
    {
      id: 'lr-predict', kind: 'checkpoint', title: t('Guess first', '先猜一猜'), skill: 'forgetting', purpose: 'predict',
      prompt: t('You train the same number of steps with a learning rate ten times larger. What happens to the new task’s loss, and to the old task’s?', '同样的步数，学习率调大 10 倍。新任务的 loss 会怎样？旧任务的呢？'),
      question: { type: 'choice', options: [
        { id: 'a', label: t('New: about the same. Old: much worse', '新任务：差不多。旧任务：差很多'), correct: true },
        { id: 'b', label: t('New: much better. Old: about the same', '新任务：好很多。旧任务：差不多') },
        { id: 'c', label: t('Both about the same', '两个都差不多') },
        { id: 'd', label: t('Both better: it trains faster', '两个都更好：训练得更快'), misconception: 'train-longer-better' },
      ] },
    },
    {
      id: 'valleys', kind: 'explore', title: t('Two valleys', '两个山谷'), skill: 'forgetting',
      scene: vis('two_valleys_forgetting', { lr: 0.02, replay: 0, preset: 'A' }),
      prompt: t(
        'The purple bowl is the old task, centred on the base model. The teal trough is the new task: steep across, almost flat along it. Press **Train 100 steps** to run gradient descent. Find (1) a way to stop with the new loss under 0.15 and the old loss under 2.2, without replay; (2) settings that keep the old loss under 2.0 even after 2,000 steps; (3) in preset B, a run that moves far but forgets little.',
        '紫色的碗是旧任务，中心在基座模型上；青色的槽是新任务：横向很陡，顺着槽几乎是平的。按**训练 100 步**来跑梯度下降。请找到：（1）不用回放，在新 loss 低于 0.15、旧 loss 低于 2.2 时停下的办法；（2）训到 2000 步以上、旧 loss 仍低于 2.0 的设置；（3）在预设 B 中，参数走得很远却几乎不遗忘的一次训练。'),
      setup: (scene: any, ui, _ctx, world) => {
        on_handles(ui, () => scene.attach(ui), () => world.emit('settings', { lr: scene.lr.get_value(), rho: scene.rho.get_value(), preset: scene.preset_now() }));
      },
      actions: [
        { id: 'train', label: t('Train 100 steps', '训练 100 步'), primary: true, run: (scene: any, _c, world) => {
          const before = scene.l_old();
          scene.train(100);
          world.emit('trained', { steps: scene.steps.get_value(), l_new: scene.l_new(), l_old: scene.l_old(), rose: scene.l_old() - before, rho: scene.rho.get_value(), lr: scene.lr.get_value(), preset: scene.preset_now(), dist: scene.distance(), diverged: scene.diverged() });
        } },
        { id: 'reset', label: t('Reset to the base model', '回到基座'), run: (scene: any, _c, world) => {
          scene.reset();
          world.emit('reset');
        } },
      ],
      goals: [
        { id: 'early-stop', check: (s: any) => s.rho.get_value() === 0 && s.steps.get_value() >= 300 && s.l_new() < 0.15 && s.l_old() < 2.2, message: t('Early stopping with a small learning rate: the new task is learned before the slow drift along the trough has gone far.', '小学习率加早停：新任务学会的时候，顺着槽的缓慢漂移还没走远。') },
        { id: 'replay', check: (s: any) => s.steps.get_value() >= 2000 && s.l_new() < 0.15 && s.l_old() < 2.0, message: t('With replay the point stops drifting: the old data holds the direction the new task does not care about, at almost no cost to the new task.', '有了回放，点不再漂移：旧数据固定住了新任务不在乎的那个方向，新任务几乎没付出代价。') },
        { id: 'far-not-forgotten', check: (s: any) => s.preset_now() === 1 && s.distance() > 3 && s.l_old() < 2.3 && s.l_new() < 0.15, message: t('Far from the base model, yet the old loss is low: the old task did not care about that direction. Distance in weights is not forgetting.', '离基座很远，旧 loss 却很低：旧任务不在乎那个方向。权重挪得远，不等于遗忘。') },
      ],
      detectors: [
        { id: 'kept-training', on: (e) => (e.type === 'trained' && (e.data!.l_new as number) < 0.15 && (e.data!.rose as number) > 0.05 && (e.data!.rho as number) === 0 && (e.data!.l_old as number) > 3 ? { kind: 'misconception', id: 'train-longer-better' } : null) },
        { id: 'diverged', on: (e) => (e.type === 'trained' && e.data!.diverged ? { kind: 'progress', id: 'diverged', message: t('Diverged: above η = 2/8 the steep direction overshoots further at every step.', '发散了：η 超过 2/8，陡的方向每一步都冲得更远。') } : null) },
      ],
      lines: [
        { text: t('Train a few hundred steps and watch both curves on the right.', '先训几百步，看右边的两条曲线。'), when: 'enter' },
        { text: t('The new loss is already flat, but the point keeps sliding along the trough, and the old loss keeps rising.', '新 loss 已经平了，可点还在顺着槽往前滑，旧 loss 一直在涨。'), when: { finding: 'train-longer-better' } },
        { text: t('Try a smaller learning rate and stop early, or mix in some old data with the replay slider.', '试试更小的学习率并早点停下，或者用回放滑块混入一些旧数据。'), when: 'idle' },
        { text: t('Lower learning rate, fewer steps, or replay: each limits the drift the new task alone would allow.', '更小的学习率、更少的步数、回放：每一种都在限制只有新任务时会发生的漂移。'), when: 'goal' },
      ],
      solve: (s: any, _c, w) => {
        s.reset();
        s.lr.set_value(0.02);
        s.rho.set_value(0);
        for (let k = 0; k < 5; k++) s.train(100);
        w.emit('trained', {});
        s.reset();
        s.lr.set_value(0.05);
        s.rho.set_value(0.3);
        for (let k = 0; k < 20; k++) s.train(100);
        w.emit('trained', {});
        s.reset();
        s.preset.set_value(1);
        s.rho.set_value(0);
        s.lr.set_value(0.2);
        for (let k = 0; k < 30; k++) s.train(100);
        w.emit('trained', {});
      },
    },
    {
      id: 'evidence', kind: 'read', chapter: t('What predicts forgetting', '什么能预测遗忘'), title: t('Real models, and a better ruler than distance', '真实模型，以及比"距离"更好的尺子'),
      blocks: [
        { type: 'p', text: t('Real models forget in the ways the toy suggests, and sometimes in surprising ones:', '真实模型的遗忘方式和示意模型说的一样，有时还更出人意料：') },
        { type: 'list', items: [
          t('Fine-tuning on a sequence of instruction tasks makes models forget earlier abilities[^luo].', '在一连串指令任务上依次微调，模型会忘掉更早的能力[^luo]。'),
          t('Ten adversarial examples, costing under 0.20 US dollars through the API, broke GPT-3.5 Turbo’s safety behaviour, and fine-tuning on ordinary, benign data also weakened it[^qi].', '只要 10 条对抗样本、通过 API 花不到 0.2 美元，就破坏了 GPT-3.5 Turbo 的安全行为；用普通、良性的数据微调，也会削弱它[^qi]。'),
          t('Fine-tuning on a narrow task, writing insecure code, produced broadly misaligned behaviour far outside coding: **emergent misalignment**[^em].', '在一个很窄的任务上微调（写不安全的代码），竟然在编程之外引发了大范围的不良行为：**涌现不对齐（emergent misalignment）**[^em]。'),
        ] },
        { type: 'p', text: t(
          'So what predicts how much a model forgets? Not how far the weights moved; the toy’s preset B showed why. **RL’s Razor** measured it directly: forgetting is predicted by how much the model’s behaviour on the new task changed, the KL divergence between the base model and the fine-tuned one on new-task prompts, $\\mathbb{E}_x\\,\\mathrm{KL}(\\pi_0 \\Vert \\pi)$. Weight-change measures predicted it far worse[^razor].',
          '那什么能预测模型忘多少？不是权重挪了多远，示意模型的预设 B 已经说明了原因。**RL’s Razor** 直接测量了这件事：预测遗忘的，是模型在新任务上的行为变了多少，也就是在新任务的提示上，基座模型和微调后模型之间的 KL 散度 $\\mathbb{E}_x\\,\\mathrm{KL}(\\pi_0 \\Vert \\pi)$。权重变化类的指标预测得差得多[^razor]。') },
        { type: 'figure', src: 'ft/b/b4-razor-scatter.svg', alt: t('Forgetting against KL(π0‖π) on the new task: SFT and RL runs fall on one decreasing curve of prior-task score, with RL runs clustered at low KL.', '遗忘与新任务上 KL(π0‖π) 的关系：SFT 和 RL 的各次训练落在同一条旧任务得分下降的曲线上，RL 集中在 KL 较小的一端。'),
          caption: t('All methods follow one curve; on-policy RL finds solutions close to the base model.', '所有方法都落在同一条曲线上；在线强化学习找到的解离基座模型更近。'), credit: '示意，据 RL’s Razor（Shenfeld, Pari & Agrawal, 2025）图 3（ParityMNIST）重绘；曲线读自原图，散点为示意' },
        { type: 'p', text: t(
          'The same paper explains why RL tends to forget less than SFT: among the many solutions to the new task, on-policy RL is implicitly biased towards those with the smallest KL to the base model, while SFT can converge to one arbitrarily far away. "SFT memorises, RL generalises"[^chu] points the same way. E3 comes back to this with on-policy distillation.',
          '同一篇论文还解释了为什么强化学习通常比 SFT 忘得少：在新任务的众多解里，在线强化学习隐含地偏向那些与基座 KL 最小的解，而 SFT 可能收敛到离得任意远的解。"SFT 偏记忆，RL 偏泛化"[^chu]指向同一个方向。E3 讲在线蒸馏时还会回到这一点。') },
        { type: 'cite', key: 'luo', text: t('Luo et al. (2023). An Empirical Study of Catastrophic Forgetting in LLMs During Continual Fine-tuning.', 'Luo 等（2023）。An Empirical Study of Catastrophic Forgetting in LLMs During Continual Fine-tuning。'), url: 'https://arxiv.org/abs/2308.08747' },
        { type: 'cite', key: 'qi', text: t('Qi et al. (2024). Fine-tuning Aligned Language Models Compromises Safety. ICLR.', 'Qi 等（2024）。Fine-tuning Aligned Language Models Compromises Safety。ICLR。'), url: 'https://arxiv.org/abs/2310.03693' },
        { type: 'cite', key: 'em', text: t('Betley et al. (2026). Emergent misalignment. Nature.', 'Betley 等（2026）。Emergent misalignment。Nature。'), url: 'https://arxiv.org/abs/2502.17424' },
        { type: 'cite', key: 'razor', text: t('Shenfeld, Pari & Agrawal (2025). RL’s Razor: Why Online Reinforcement Learning Forgets Less.', 'Shenfeld、Pari & Agrawal（2025）。RL’s Razor: Why Online Reinforcement Learning Forgets Less。'), url: 'https://arxiv.org/abs/2509.04259' },
        { type: 'cite', key: 'chu', text: t('Chu et al. (2025). SFT Memorizes, RL Generalizes.', 'Chu 等（2025）。SFT Memorizes, RL Generalizes。'), url: 'https://arxiv.org/abs/2501.17161' },
      ],
    },
    {
      id: 'measure', kind: 'derive', title: t('Measuring the ruler', '怎么量这把尺子'), skill: 'forgetting-kl',
      intro: t('KL is an expectation, so you estimate it by sampling. To estimate $\\mathrm{KL}(\\pi_0 \\Vert \\pi_{ft})$, sample answers from the **base** model on new-task prompts and compare log-probabilities.', 'KL 是一个期望，所以用采样来估计。要估计 $\\mathrm{KL}(\\pi_0 \\Vert \\pi_{ft})$，就在新任务的提示上从**基座**模型采样回答，再比较对数概率。'),
      lines: [
        { tex: '\\mathrm{KL}(\\pi_0 \\Vert \\pi_{ft}) = \\mathbb{E}_{y\\sim\\pi_0}\\big[\\log \\pi_0(y \\mid x) - \\log \\pi_{ft}(y \\mid x)\\big]', why: t('The definition: how much less likely the fine-tuned model finds the base model’s own answers, on average.', '定义：平均而言，微调后的模型觉得基座模型自己的回答"变得多不可能"。') },
        { tex: '\\widehat{\\mathrm{KL}} = \\frac{1}{N}\\sum_{i=1}^{N}\\big[\\log \\pi_0(y_i) - \\log \\pi_{ft}(y_i)\\big], \\qquad y_i \\sim \\pi_0', why: t('Replace the expectation by an average over $N$ sampled answers. Each term can be negative; the average is an unbiased estimate.', '把期望换成 $N$ 个采样回答上的平均。单项可能是负的；平均值是无偏估计。') },
        { tex: '\\frac{0.3 + 0.9 + 0.3}{3} = 0.5', why: t('Three base answers with $\\log \\pi_0 = -0.2, -0.6, -0.3$ and $\\log \\pi_{ft} = -0.5, -1.5, -0.6$.', '三个基座回答，$\\log \\pi_0 = -0.2, -0.6, -0.3$，$\\log \\pi_{ft} = -0.5, -1.5, -0.6$。') },
        { tex: '\\theta_\\alpha = (1-\\alpha)\\,\\theta_0 + \\alpha\\,\\theta_{ft}', why: t('One more tool: weight interpolation (WiSE-FT). Slide $\\alpha$ down from 1 and pick the point that balances the new metric against the regression evals.', '再多一个工具：权重插值（WiSE-FT）。把 $\\alpha$ 从 1 往下调，在新任务指标和回归评测之间找一个平衡点。') },
      ],
      blank: { line: 2, answer: '0.5', prompt: t('Average the three differences $\\log \\pi_0 - \\log \\pi_{ft}$.', '求三个差值 $\\log \\pi_0 - \\log \\pi_{ft}$ 的平均。') },
      outro: t('The paper reports that the reverse direction, $\\mathrm{KL}(\\pi_{ft} \\Vert \\pi_0)$, predicts almost as well. Either way, track it during training as an early warning, next to the regression evals.', '论文报告说，反方向的 $\\mathrm{KL}(\\pi_{ft} \\Vert \\pi_0)$ 预测得几乎一样好。不管用哪个方向，都把它和回归评测一起，在训练中作为早期预警来跟踪。'),
    },
    {
      id: 'measure-code', kind: 'code', title: t('Estimating forgetting KL', '估计遗忘的 KL'),
      intro: t('Sample answers from the base model on new-task prompts and compare their log-probability under both models.', '在新任务提示上从基座模型采样回答，比较它们在两个模型下的对数概率。'),
      lang: 'python', code: KL_CODE,
      notes: [
        { lines: [3, 9], text: t('Score only the answer tokens: shift by one, take the log-probability of each actual next token, sum over the answer.', '只给回答的 token 打分：错开一位，取每个实际下一个 token 的对数概率，在回答上求和。'), shapes: 'logits: [1, T-1, V]' },
        { lines: [21, 22], text: t('Sample from the base model ($y \\sim \\pi_0$), as in the definition, and add $\\log \\pi_0 - \\log \\pi_{ft}$.', '按定义从基座模型采样（$y \\sim \\pi_0$），累加 $\\log \\pi_0 - \\log \\pi_{ft}$。') },
        { lines: [24, 24], text: t('Nats per answer. Track it at each evaluation; rising KL with a flat task metric is forgetting without benefit.', '单位是每个回答多少奈特。每次评测时都记录；KL 在涨而任务指标不动，就是"白白遗忘"。') },
      ],
    },
    {
      id: 'mitigate', kind: 'read', chapter: t('What limits it', '怎样减少遗忘'), title: t('Six ways to forget less', '少忘一点的六种办法'),
      blocks: [
        { type: 'table',
          head: [t('Method', '办法'), t('Why it helps', '为什么有用'), t('Evidence and caveat', '证据与注意')],
          rows: [
            [t('Lower learning rate, fewer steps', '更小的学习率、更少的步数'), t('less drift along directions the new task does not care about', '减少沿着新任务不在乎的方向的漂移'), t('the toy above; pick the stopping point by evals (B3)', '上面的示意模型；用评测决定在哪停（B3）')],
            [t('Replay / data mixing', '回放 / 数据混合'), t('old data holds old behaviour in place', '旧数据把旧行为固定住'), t('70/30 documents/chat kept IF-eval at 79% vs 45% for documents only, but not the original 85% (Thinking Machines)', '文档和对话 7:3 混合，IF-eval 保住 79%（只用文档是 45%），但回不到原来的 85%（Thinking Machines）')],
            ['LoRA', t('a constrained update', '受约束的更新'), t('forgets less but not zero; better trade-off on code, full fine-tuning better on math (Biderman, C2)', '忘得少，但不是不忘；代码上权衡更好，数学上全量微调更好（Biderman，C2）')],
            [t('KL penalty or on-policy RL', 'KL 惩罚或在线强化学习'), t('directly limits how far behaviour moves', '直接限制行为变化的幅度'), t('RL’s Razor; D2 and E1', 'RL’s Razor；D2、E1')],
            [t('On-policy distillation from the old model', '用旧模型做在线蒸馏'), t('teaches the old behaviour back on the new model’s own outputs', '在新模型自己的输出上把旧行为教回来'), t('restored IF-eval to 83% after document training (E3)', '文档训练后把 IF-eval 恢复到 83%（E3）')],
            [t('Weight interpolation (WiSE-FT)', '权重插值（WiSE-FT）'), t('a point between the base and the fine-tune', '取基座和微调结果之间的一个点'), t('from vision models; merging is in E3', '源于视觉模型；模型合并见 E3')],
          ] },
        { type: 'callout', kind: 'warning', body: t('Whatever you choose, re-run the safety evaluations: benign data can weaken refusals too.', '不管选哪种，都要重跑安全评测：良性数据也可能削弱拒答能力。') },
      ],
    },
    // ------------------------------------------------------------------ checks
    {
      id: 'q-case', kind: 'checkpoint', chapter: t('Check', '检验'), title: t('Better at the task, worse at everything else', '任务变好了，别的都变差了'), skill: 'forgetting-mitigation', purpose: 'check',
      prompt: t('After SFT on customer-service chats, your task metric rose 6 points, but IFEval fell 9 points and the refusal test set got worse. Give two mitigations and, for each, how you would check that it worked.', '在客服对话上做完 SFT，任务指标升了 6 分，但 IFEval 掉了 9 分，拒答测试集也变差了。给出两种缓解办法，并说明各自怎样验证有效。'),
      question: { type: 'text', placeholder: t('1) … checked by … 2) … checked by …', '1）……，用……验证；2）……，用……验证'), rubric: {
        key_points: [
          t('Mix in general instruction/chat data (replay) and re-run IFEval.', '混入通用的指令/对话数据（回放），重跑 IFEval。'),
          t('Lower the learning rate or stop earlier, choosing the step by plotting the task metric and IFEval over training.', '降低学习率或更早停下，通过画出训练过程中任务指标和 IFEval 的变化来选步数。'),
          t('Add safety (refusal) data or use LoRA / KL / on-policy distillation, and re-run the safety set.', '加入安全（拒答）数据，或者用 LoRA / KL 约束 / 在线蒸馏，并重跑安全测试集。'),
        ],
        model_answer: t('Mix about 30% general chat and safety data into training and re-run IFEval and the refusal set; and lower the learning rate (or stop earlier), picking the checkpoint by plotting the task metric against IFEval over steps.', '在训练数据里混入约 30% 的通用对话和安全数据，重跑 IFEval 和拒答测试集；同时降低学习率（或更早停下），画出任务指标与 IFEval 随步数的变化来选检查点。'),
        min_points: 2,
      } },
    },
    {
      id: 'q-kl', kind: 'checkpoint', title: t('Estimate the KL', '估计 KL'), skill: 'forgetting-kl', purpose: 'check',
      prompt: t('You sample four answers from the base model. Their log-probabilities are $-0.5, -1.0, -0.2, -0.8$ under the base model and $-0.9, -2.0, -0.3, -0.8$ under the fine-tuned model. Estimate $\\mathrm{KL}(\\pi_0 \\Vert \\pi_{ft})$.', '从基座模型采样了 4 个回答。它们在基座下的对数概率是 $-0.5, -1.0, -0.2, -0.8$，在微调后模型下是 $-0.9, -2.0, -0.3, -0.8$。估计 $\\mathrm{KL}(\\pi_0 \\Vert \\pi_{ft})$。'),
      question: { type: 'number', answer: 0.375, tolerance: 0.01, wrong: [{ answer: -0.375, feedback: t('Subtract the other way: $\\log \\pi_0 - \\log \\pi_{ft}$, with samples from $\\pi_0$.', '减反了：应该是 $\\log \\pi_0 - \\log \\pi_{ft}$，样本来自 $\\pi_0$。') }] },
      explain: t('$(0.4 + 1.0 + 0.1 + 0)/4 = 0.375$ nats per answer.', '$(0.4 + 1.0 + 0.1 + 0)/4 = 0.375$ 奈特/回答。'),
    },
    {
      id: 'q-distance', kind: 'checkpoint', title: t('Explain it', '解释一下'), skill: 'forgetting-kl', purpose: 'check',
      prompt: t('Why is "how far the weights moved" a poor predictor of forgetting? Use what you saw in preset B.', '为什么"权重挪了多远"不是遗忘的好指标？用你在预设 B 里看到的现象来解释。'),
      question: { type: 'text', placeholder: t('Because…', '因为……'), rubric: {
        key_points: [
          t('Forgetting is about behaviour on the old task; some directions in weight space barely change it.', '遗忘看的是模型在旧任务上的行为；权重空间里有些方向几乎不影响它。'),
          t('In preset B the point moved far along such a direction, yet the old loss stayed low; KL between the models’ outputs captures this, distance does not.', '在预设 B 里，点沿着这样的方向走了很远，旧 loss 却仍然很低；模型输出之间的 KL 能反映这一点，距离不能。'),
        ],
        model_answer: t('What matters is how much the model’s outputs change, not its weights. In preset B the old task barely depends on θ2, so the point moved far along θ2 and the old loss stayed low. A KL between the base and fine-tuned outputs measures the change that matters.', '要紧的是模型输出变了多少，而不是权重。在预设 B 里，旧任务几乎不依赖 θ2，所以点沿着 θ2 走了很远，旧 loss 仍然很低。基座和微调后模型输出之间的 KL，量的才是要紧的那种变化。'),
        min_points: 1,
      } },
    },
    {
      id: 'choose', kind: 'read', chapter: t('How to choose', '怎么选'), title: t('Plan for forgetting', '为遗忘做好准备'),
      blocks: choose_card({
        upto: 'B3', highlight: 'X3', card: '',
        rule: t('If you change weights, run general-capability and safety regression evals, every time. If you need both the new task and the old abilities, default to replay (about 30% general data) and a smaller learning rate; if that is not enough, use LoRA, a KL constraint or on-policy methods (E3). Track KL to the base model during training as an early warning.', '只要改了权重，就每次都跑通用能力和安全两类回归评测。如果新任务和原有能力都要，默认用回放（约 30% 的通用数据）加较小的学习率；还不够，就用 LoRA、KL 约束或在线方法（E3）。训练时跟踪相对基座的 KL，作为早期预警。'),
        counter: t('"Our data is clean, so we do not need to test safety." Benign fine-tuning data weakened GPT-3.5’s safety behaviour (Qi et al.). And "we used LoRA, so nothing is forgotten": it forgets less, not nothing.', '"我们的数据很干净，不用测安全。"良性的微调数据也削弱了 GPT-3.5 的安全行为（Qi 等）。还有"我们用了 LoRA，所以什么都不会忘"：它忘得少，不是不忘。'),
      }),
    },
  ],
};
