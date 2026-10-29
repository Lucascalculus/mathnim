// B3 Training dynamics and evaluation: why the loss is not the score, how to
// read curves, how to evaluate (task, regression, judges, the shipped
// artifact) and how noisy an eval is. Plan: part-b-sft.md (B3); sources there and in research-sft.md.
import type { Lesson } from '@mathnim/core';
import { choose_card, on_handles, t, vis } from './common';

const JUDGE = `def judge_pair(judge, question, answer_a, answer_b):
    """Ask the judge twice, swapping the order; count a win only if both orders agree."""
    first = judge(question, answer_a, answer_b)     # returns "A", "B" or "tie"
    second = judge(question, answer_b, answer_a)    # same answers, positions swapped
    if first == "A" and second == "B":
        return "a"
    if first == "B" and second == "A":
        return "b"
    return "tie"                                    # inconsistent: position decided it

def agreement_with_humans(verdicts, human_labels):
    """Cohen's kappa between the judge and ~100 human labels (a / b / tie)."""
    labels = ["a", "b", "tie"]
    n = len(verdicts)
    p_obs = sum(v == h for v, h in zip(verdicts, human_labels)) / n
    p_exp = sum((verdicts.count(l) / n) * (human_labels.count(l) / n) for l in labels)
    return (p_obs - p_exp) / (1 - p_exp)

def win_rate(results, lengths_a, lengths_b):
    wins = sum(r == "a" for r in results) / len(results)
    mean_len = (sum(lengths_a) / len(lengths_a), sum(lengths_b) / len(lengths_b))
    return wins, mean_len                           # always report length next to the win rate`;

const LM_EVAL = `# general-capability regression: before and after fine-tuning, same settings
lm_eval --model hf \\
  --model_args pretrained=Qwen/Qwen2.5-7B-Instruct,peft=./my-adapter \\
  --tasks ifeval,gsm8k --apply_chat_template --batch_size 8 \\
  --output_path results/after.json`;

export const lesson: Lesson = {
  id: 'ft-b3-training-eval',
  title: t('Training curves and evaluation', '训练曲线与评测'),
  description: t('Why a lower loss is not a better model, how to read training curves, and how to evaluate a fine-tune well enough to trust the result.', '为什么 loss 更低不等于模型更好，怎样读训练曲线，以及怎样把微调评测得可信。'),
  mode: 'essay',
  skills: [
    { id: 'sft-hparams', name: t('Starting hyperparameters', '起始超参数') },
    { id: 'curve-diagnosis', name: t('Reading training curves', '读训练曲线') },
    { id: 'eval-design', name: t('Designing evaluations', '设计评测') },
    { id: 'eval-stats', name: t('How noisy an eval is', '评测的噪声有多大'), prerequisites: ['eval-design'] },
    { id: 'llm-judge', name: t('Using LLM judges', '使用大模型评委'), prerequisites: ['eval-design'] },
  ],
  misconceptions: [
    { id: 'low-loss-good', description: t('A lower loss means a better model.', 'loss 越低，模型越好。') },
    { id: 'val-loss-stop', description: t('Stop as soon as the validation loss turns up.', '验证 loss 一回升就该停。') },
    { id: 'eval-small-diff-real', description: t('A 2–3 point gain on an eval set is a real improvement.', '在评测集上高 2 到 3 分，就是真的更好。') },
    { id: 'judge-objective', description: t('An LLM judge is an objective measure.', '大模型评委是客观的。') },
  ],
  steps: [
    // ------------------------------------------------------------------ the problem
    {
      id: 'why', kind: 'read', chapter: t('The loss is not the score', 'loss 不是分数'), title: t('What you actually want to know', '你真正想知道的是什么'),
      blocks: [
        { type: 'p', text: t(
          'During fine-tuning you watch a loss go down. What you want to know is different: **is the model better at the job, and did it break anything it could do before?** The loss answers neither. This lesson is about the gap: how to read the curves you get, and how to build the evaluations that answer the real question. Practitioners name evaluation their biggest challenge, year after year[^ae].',
          '微调时你盯着一条 loss 曲线往下走。可你真正想知道的是另一回事：**模型在这件工作上是不是更好了？有没有把原来会的东西弄坏？**loss 对这两个问题都回答不了。这节课讲的就是这个落差：怎样读手上的训练曲线，以及怎样搭出能回答真正问题的评测。从业者年年都把评测列为头号难题[^ae]。') },
        { type: 'h', text: t('Where to start: the learning rate is the first knob', '从哪开始：第一个旋钮是学习率') },
        { type: 'p', text: t('Of all the settings, the learning rate decides most: too high and the loss spikes or the model forgets (B4); too low and nothing changes. Full fine-tuning uses small rates, LoRA about ten times larger (C2).', '所有设置里，学习率影响最大：太大，loss 会出现尖刺，模型也会遗忘（B4）；太小，什么都不变。全量微调用很小的学习率，LoRA 大约大十倍（C2）。') },
        { type: 'details', summary: t('Where published recipes start', '公开配方从哪里起步'), blocks: [
        { type: 'table',
          head: [t('Setting', '设置'), t('Learning rate', '学习率'), t('Epochs', '轮数'), t('Batch', 'batch'), t('Source', '出处')],
          rows: [
            [t('Full SFT, 8B (Tülu 3)', '全量 SFT，8B（Tülu 3）'), '5e-6', '2', '128', 'Tülu 3'],
            [t('Full SFT, 70B (Tülu 3)', '全量 SFT，70B（Tülu 3）'), '2e-6', '2', '128', 'Tülu 3'],
            [t('Full SFT, typical range', '全量 SFT，一般范围'), t('1e-6 – 2e-5 (TRL default 2e-5)', '1e-6 – 2e-5（TRL 默认 2e-5）'), '1–3', '—', 'TRL'],
            ['LoRA / QLoRA', t('1e-4 – 2e-4, about 10× full fine-tuning', '1e-4 – 2e-4，约为全量的 10 倍'), '1–3', t('small', '宜小'), 'LoRA Without Regret'],
            [t('Tiny curated set (LIMA)', '很小的精选集（LIMA）'), t('1e-5 → 1e-6', '1e-5 → 1e-6'), '15', '32', 'LIMA'],
            [t('InstructGPT SFT (1.3B/6B)', 'InstructGPT SFT（1.3B/6B）'), '9.65e-6', '16', '32', 'InstructGPT'],
          ] },
        ] },
        { type: 'p', text: t('Add a short warmup and a linear or cosine decay, clip gradients at 1.0, and log more than the loss: the answer-only validation loss, the gradient norm, and a few fixed prompts generated every N steps, which you read.', '再加一小段预热（warmup）和线性或余弦衰减，梯度裁剪到 1.0；除了 loss 还要记录：只算回答的验证 loss、梯度范数，以及每隔 N 步对几个固定提示生成一次结果，你要亲自读。') },
        { type: 'cite', key: 'ae', text: t('AI Engineering survey notes (World’s Fair 2025 keynote), via research-adoption.', 'AI 工程调查（World’s Fair 2025 主题演讲），见 research-adoption。'), url: 'https://agents.conffab.com/worlds-fair/live/day-1-keynotes/sessions/1783008000.md' },
      ],
    },
    {
      id: 'val-predict', kind: 'checkpoint', title: t('Guess first', '先猜一猜'), skill: 'curve-diagnosis', purpose: 'predict',
      prompt: t('After the first epoch the validation loss starts rising while the training loss keeps falling. Should you stop?', '第一轮之后，验证 loss 开始回升，训练 loss 还在降。该停吗？'),
      question: { type: 'choice', options: [
        { id: 'a', label: t('Yes, it is overfitting', '该停，已经过拟合了'), misconception: 'val-loss-stop' },
        { id: 'b', label: t('Not necessarily: check a task evaluation first', '不一定：先看任务评测'), correct: true },
        { id: 'c', label: t('No, the validation loss does not matter', '不用停，验证 loss 不重要') },
      ] },
    },
    {
      id: 'low-loss', kind: 'read', title: t('A lower loss, a worse model? And the reverse', 'loss 更低，模型更差？反过来也可能'),
      blocks: [
        { type: 'p', text: t(
          'InstructGPT’s SFT model "overfit on validation loss after 1 epoch", yet training up to 16 epochs kept improving both the reward-model score and human preference; they picked checkpoints by reward-model score[^igpt]. LIMA found perplexity did not track quality and chose its checkpoint by hand on a 50-example dev set[^lima].',
          'InstructGPT 的 SFT 模型"一轮之后在验证 loss 上就过拟合了"，可一直训到 16 轮，奖励模型分数和人类偏好都还在上升；他们按奖励模型分数选检查点[^igpt]。LIMA 发现困惑度和回答质量对不上，最后在一个 50 条样本的开发集上人工挑选检查点[^lima]。') },
        { type: 'figure', src: 'ft/b/b3-instructgpt-overfit.svg', alt: t('Over 16 epochs, validation loss bottoms after epoch 1 and rises, while reward-model score and human preference keep rising.', '在 16 轮里，验证 loss 在第 1 轮后见底回升，而奖励模型分数和人类偏好持续上升。'), credit: t('Schematic from the text of InstructGPT (Ouyang et al., 2022) §3.5, not a redraw of a figure', '示意，依据 InstructGPT 第 3.5 节的文字描述绘制') },
        { type: 'p', text: t('Why? The validation loss asks how likely the **reference** answers are under the model:', '为什么？验证 loss 问的是：**参考答案**在模型下有多大概率：') },
        { type: 'math', tex: '\\mathbb{E}_{y\\sim D}\\big[-\\log \\pi(y \\mid x)\\big] = H(D) + \\mathrm{KL}(D \\,\\Vert\\, \\pi)' },
        { type: 'list', items: [
          t('$H(D)$ is fixed; minimising the loss pulls $\\pi$ towards **every** way the references are written (forward KL is mass-covering).', '$H(D)$ 是固定的；最小化 loss，就是把 $\\pi$ 拉向参考答案的**每一种**写法（正向 KL 偏向"全覆盖"）。'),
          t('As training continues, the model grows sharper: confident in one good way of answering. Other phrasings of the references become less likely and the loss rises, yet the model’s **own samples**, the thing users see and judges score, can keep getting better.', '训练继续下去，模型会变"尖"：对某一种好的回答方式很有把握。参考答案的其他写法因此概率变小，loss 就上升了；可模型**自己生成的回答**（用户看到的、评委打分的正是这个）还可能继续变好。'),
        ] },
        { type: 'callout', kind: 'note', body: t('So choose checkpoints with a task evaluation, not with the loss. The loss is still a good alarm for bugs, as the next two questions show.', '所以选检查点要看任务评测，而不是 loss。不过 loss 仍然是发现 bug 的好警报，接下来的两道题就是例子。') },
        { type: 'cite', key: 'igpt', text: t('Ouyang et al. (2022). Training language models to follow instructions with human feedback. NeurIPS.', 'Ouyang 等（2022）。Training language models to follow instructions with human feedback。NeurIPS。'), url: 'https://arxiv.org/abs/2203.02155' },
        { type: 'cite', key: 'lima', text: t('Zhou et al. (2023). LIMA: Less Is More for Alignment. NeurIPS.', 'Zhou 等（2023）。LIMA。NeurIPS。'), url: 'https://arxiv.org/abs/2305.11206' },
      ],
    },
    {
      id: 'curve-1', kind: 'checkpoint', title: t('Read the curves (1)', '读曲线（一）'), skill: 'curve-diagnosis', purpose: 'check',
      scene: vis('training_curves', { preset: 'mask_bug' }),
      prompt: t('The training loss drops from 2.1 to 0.3 within the first steps and stays there; the answer-only validation loss and the task metric do not move. What is most likely?', '训练 loss 在最初几步就从 2.1 掉到 0.3 并停在那里；只算回答的验证 loss 和任务指标都不动。最可能是什么问题？'),
      question: { type: 'choice', options: [
        { id: 'a', label: t('A mask bug: the loss is mostly on a long, repeated system prompt the model memorised', '掩码错误：loss 主要算在一段又长又重复的系统提示上，模型很快背下来了'), correct: true },
        { id: 'b', label: t('Overfitting', '过拟合'), feedback: t('Overfitting shows the answer-only validation loss turning up after improving; here it never improves.', '过拟合时，只算回答的验证 loss 是先降后升；这里它从来没降过。') },
        { id: 'c', label: t('Learning rate too high', '学习率太大'), feedback: t('That shows spikes and a noisy plateau, not a smooth collapse.', '那会表现为尖刺和较高处的震荡，而不是平滑地骤降。') },
        { id: 'd', label: t('Too little data', '数据太少') },
      ] },
      explain: t('The loss can only fall where it is computed. Check what it is computed on (B1).', 'loss 只会在它被计算的地方下降。查一查它算在了哪些 token 上（B1）。'),
    },
    {
      id: 'curve-2', kind: 'checkpoint', title: t('Read the curves (2)', '读曲线（二）'), skill: 'curve-diagnosis', purpose: 'check',
      scene: vis('training_curves', { preset: 'overfit' }),
      prompt: t('Which checkpoint would you ship, and what would you check before trusting that choice?', '你会上线哪个检查点？在相信这个选择之前，还要检查什么？'),
      question: { type: 'choice', options: [
        { id: 'a', label: t('Around epoch 1.4, where the task metric peaks; then check it on a held-out test set used only once', '大约第 1.4 轮，任务指标最高的地方；然后在只用一次的留出测试集上确认'), correct: true },
        { id: 'b', label: t('Epoch 3, the lowest training loss', '第 3 轮，训练 loss 最低'), misconception: 'low-loss-good' },
        { id: 'c', label: t('Around epoch 0.9, the lowest validation loss', '大约第 0.9 轮，验证 loss 最低'), misconception: 'val-loss-stop', feedback: t('Validation loss and task quality can disagree; pick by the task metric.', '验证 loss 和任务质量可能不一致；按任务指标选。') },
      ] },
      explain: t('Picking the best of many checkpoints on one dev set overestimates it (the winner’s curse); a final test set, used once, gives an honest number.', '在同一个开发集上从许多检查点里挑最好的，会高估它（赢家诅咒）；一个只用一次的最终测试集，才给出可信的数字。'),
    },
    // ------------------------------------------------------------------ evaluation
    {
      id: 'eval-layers', kind: 'read', chapter: t('Evaluation', '评测'), title: t('Four layers of evaluation', '评测的四层'),
      blocks: [
        { type: 'p', text: t('A fine-tune is only as good as the evaluation that accepted it. Build these before training, not after:', '一个微调好不好，取决于验收它的评测。这些要在训练之前就搭好，而不是之后：') },
        { type: 'figure', src: 'ft/b/b3-eval-layers.svg', alt: t('Four stacked layers: task held-out set, general-capability regression, safety regression, and evaluating the shipped artifact.', '四层叠在一起：任务留出集、通用能力回归、安全回归，以及评测真正上线的那个文件。'), credit: t('Own drawing', '自绘') },
        { type: 'list', ordered: true, items: [
          t('**The task itself:** a held-out set from the same distribution as the training data, decontaminated. Score automatically where you can (exact match, unit tests, JSON schema validation); otherwise with a written rubric.', '**任务本身：**一个和训练数据同分布、去过污染的留出集。能自动打分就自动打分（精确匹配、单元测试、JSON schema 校验）；否则按写好的评分细则（rubric）打分。'),
          t('**What it could do before:** general benchmarks such as IFEval and GSM8K, run before and after, with the same settings.', '**它原来会的东西：**IFEval、GSM8K 这类通用基准，训练前后各跑一次，设置完全一样。'),
          t('**Safety:** a set of prompts it should refuse. Even benign fine-tuning data can weaken safety (B4).', '**安全：**一组它应该拒绝的提示。即使是良性的微调数据，也可能削弱安全性（B4）。'),
          t('**The thing you ship:** the same chat template and decoding settings, and the merged or quantised weights you will actually serve (C3).', '**你真正上线的东西：**同样的聊天模板和解码设置，以及实际部署的合并后或量化后的权重（C3）。'),
        ] },
        { type: 'code', lang: 'bash', code: LM_EVAL, caption: t('lm-evaluation-harness can load a PEFT adapter directly; `--apply_chat_template` for instruct models.', 'lm-evaluation-harness 可以直接加载 PEFT 适配器；指令模型要加 `--apply_chat_template`。') },
        { type: 'p', text: t('How many questions does the task set need? That depends on how small a difference you want to trust. Guess first.', '任务集要多少道题？取决于你想相信多小的差距。先猜一猜。') },
      ],
    },
    {
      id: 'noise-predict', kind: 'checkpoint', title: t('Guess first', '先猜一猜'), skill: 'eval-stats', purpose: 'predict',
      prompt: t('Checkpoint B is truly 3 points better than A (73% vs 70%). Both are scored on a fresh set of 200 questions. How often will B score **lower** than A?', '检查点 B 真实比 A 好 3 分（73% 对 70%）。两者都在一份新的 200 道题上打分。B 的得分**低于** A 的情况有多常见？'),
      question: { type: 'choice', options: [
        { id: 'a', label: t('Under 5%', '不到 5%'), misconception: 'eval-small-diff-real' },
        { id: 'b', label: t('About 10%', '约 10%') },
        { id: 'c', label: t('About 25%', '约 25%'), correct: true },
        { id: 'd', label: t('About 50%', '约 50%') },
      ] },
    },
    {
      id: 'noise-world', kind: 'explore', title: t('How noisy is one eval?', '一次评测有多大噪声？'), skill: 'eval-stats',
      scene: vis('eval_noise', { n: 200, p_a: 0.7, gap: 0.03 }),
      prompt: t(
        'The curve is where the observed gap B − A lands when you evaluate on $n$ fresh questions; red is where B looks worse. Press **Re-run eval** a few times. Then find the **smallest** $n$ that makes "B looks worse" less than 5% (independent), and the smallest $n$ that does it with a **paired** analysis.',
        '这条曲线表示：在 $n$ 道新题上评测时，观测到的差距 B − A 会落在哪里；红色部分是 B 看起来更差的情况。先按几次**重新评测**。然后找到让"B 看起来更差"低于 5% 的**最小** $n$（独立比较），再找配对分析下的最小 $n$。'),
      setup: (scene: any, ui, _ctx, world) => {
        on_handles(ui, () => scene.attach(ui), () => world.emit('settings', { n: scene.n_now(), paired: scene.is_paired(), flip: scene.flip() }));
      },
      actions: [
        { id: 'rerun', label: t('Re-run eval', '重新评测'), run: (scene: any, _c, world) => {
          const d = scene.rerun();
          world.emit('rerun', { d, n: scene.n_now() });
        } },
        { id: 'ship', label: t('Declare B better', '宣布 B 更好'), run: (scene: any, _c, world) => world.emit('ship', { flip: scene.flip(), n: scene.n_now() }) },
      ],
      goals: [
        { id: 'independent', check: (s: any) => !s.is_paired() && s.flip() < 0.05 && s.n_now() <= 1350, message: t('About 1,225 questions for independent scores: a 3-point gap needs a big eval set.', '独立比较大约要 1225 道题：要看清 3 分的差距，评测集得很大。') },
        { id: 'paired', check: (s: any) => s.is_paired() && s.flip() < 0.05 && s.n_now() <= 340, message: t('Paired on the same questions: about 300 are enough, because the models agree on most of them.', '在同一批题上配对比较：约 300 道就够了，因为两个模型在大多数题上答得一样。') },
      ],
      detectors: [
        { id: 'ship-noisy', on: (e) => (e.type === 'ship' && (e.data!.flip as number) > 0.1 ? { kind: 'misconception', id: 'eval-small-diff-real' } : null) },
        { id: 'saw-flip', on: (e) => (e.type === 'rerun' && (e.data!.d as number) < 0 ? { kind: 'progress', id: 'saw-flip', message: t('That run says B is worse, though it is truly better.', '这一次说 B 更差，尽管它其实更好。') } : null) },
      ],
      lines: [
        { text: t('The dashed line is the truth: B is three points better. The curve is what one eval can show you.', '虚线是真相：B 好 3 分。曲线是一次评测可能给你看到的结果。'), when: 'enter' },
        { text: t('With this many questions, there is a real chance the eval points the wrong way. Report the interval, or use more questions.', '题这么少，评测有相当大的机会指错方向。要报告区间，或者用更多的题。'), when: { finding: 'eval-small-diff-real' } },
        { text: t('Re-run a few times and count how often the dot lands in the red.', '多重新评测几次，数数点落在红色区域里几次。'), when: 'idle' },
        { text: t('Same questions for both models removes most of the noise: report paired differences.', '两个模型用同一批题，就去掉了大部分噪声：要报告配对的差值。'), when: 'goal' },
      ],
      solve: (s: any, _c, w) => {
        s.paired.set_value(0);
        s.n.set_value(1240);
        w.emit('settings', {});
        s.paired.set_value(1);
        s.n.set_value(300);
        w.emit('settings', {});
      },
    },
    {
      id: 'noise-math', kind: 'derive', title: t('Where the numbers come from', '这些数字从哪来'), skill: 'eval-stats',
      intro: t('An accuracy on $n$ questions is an average of $n$ right/wrong outcomes, so its spread shrinks like $1/\\sqrt n$.', '$n$ 道题上的正确率是 $n$ 个对/错结果的平均，所以它的波动按 $1/\\sqrt n$ 缩小。'),
      lines: [
        { tex: '\\mathrm{SE}(\\hat p) = \\sqrt{p(1-p)/n} = \\sqrt{0.21/200} \\approx 0.032', why: t('One model at 70% on 200 questions: a 95% interval of about ±6.3 points.', '一个 70% 的模型、200 道题：95% 区间约为 ±6.3 分。') },
        { tex: '\\mathrm{SE}_\\Delta = \\sqrt{\\frac{p_A q_A + p_B q_B}{n}} = \\sqrt{\\frac{0.21 + 0.197}{200}} \\approx 0.045', why: t('The difference of two independent accuracies adds their variances: ±8.8 points, and a 3-point true gap flips with probability $\\Phi(-0.03/0.045) \\approx 25\\%$.', '两个独立正确率之差，方差相加：区间 ±8.8 分；真实差距 3 分时，翻转的概率是 $\\Phi(-0.03/0.045) \\approx 25\\%$。') },
        { tex: '\\mathrm{SE}^{\\prime}_\\Delta = \\sqrt{\\frac{\\delta - \\Delta^2}{n}} = \\sqrt{\\frac{0.10 - 0.0009}{200}} \\approx 0.022', why: t('Paired ($\\mathrm{SE}^{\\prime}_\\Delta$): score both on the same questions and look at per-question differences. If they disagree on only $\\delta = 10\\%$ of questions, the noise halves.', '配对（$\\mathrm{SE}^{\\prime}_\\Delta$）：两者在同一批题上打分，看逐题的差值。如果它们只在 $\\delta = 10\\%$ 的题上答得不同，噪声减半。') },
        { tex: 'n \\ge \\frac{1.645^2\\,(p_A q_A + p_B q_B)}{\\Delta^2} \\approx 1225', why: t('Solve $\\Phi(-\\Delta/\\mathrm{SE}_\\Delta) < 5\\%$ for $n$.', '把 $\\Phi(-\\Delta/\\mathrm{SE}_\\Delta) < 5\\%$ 解出 $n$。') },
      ],
      blank: { line: 3, answer: '1225', prompt: t('Roughly how many questions (independent scores)?', '独立比较时，大约要多少道题？') },
      outro: t('Report a confidence interval with every eval number, prefer paired comparisons, and watch for clustered questions (several from one document), whose errors are larger (Miller 2024).', '每个评测数字都要附上置信区间，尽量用配对比较；还要注意成组的题目（比如好几道题出自同一篇文档），它们的误差会更大（Miller 2024）。'),
    },
    {
      id: 'judge', kind: 'read', title: t('LLM judges: useful, biased, checkable', '大模型评委：有用、有偏差、可校准'),
      blocks: [
        { type: 'p', text: t(
          'Open-ended answers have no exact match, so teams ask a strong model to compare two answers: an **LLM-as-a-judge**. On MT-Bench, GPT-4’s verdicts agreed with humans 85% of the time (excluding ties), about as often as humans agree with each other[^zheng]. But judges have measurable biases:',
          '开放式回答没有标准答案可以精确匹配，所以团队会请一个强模型来比较两个回答：**大模型评委（LLM-as-a-judge）**。在 MT-Bench 上，GPT-4 的判断与人类的一致率（不计平局）是 85%，和人与人之间的一致率差不多[^zheng]。但评委有可测量的偏差：') },
        { type: 'figure', src: 'ft/b/b3-judge-position.svg', alt: t('Position consistency of three judges when the answer order is swapped: Claude-v1 23.8%, GPT-3.5 46.2%, GPT-4 65.0%.', '交换回答顺序后三个评委的一致率：Claude-v1 23.8%，GPT-3.5 46.2%，GPT-4 65.0%。'),
          caption: t('Swap the two answers and ask again: even GPT-4 gave the same verdict only 65% of the time on these near-identical pairs.', '把两个回答对调再问一次：在这些几乎一样的回答对上，即使是 GPT-4，也只有 65% 的情况给出相同的判断。'), credit: t('Data: Zheng et al. (2023), Table 2', '数据：Zheng 等（2023）表 2') },
        { type: 'table',
          head: [t('Bias', '偏差'), t('What to do', '怎么办')],
          rows: [
            [t('**Position:** prefers the first (or second) answer', '**位置偏差：**偏好排在前（或后）的回答'), t('judge both orders; count a win only if both agree', '两种顺序各判一次；两次一致才算赢')],
            [t('**Length:** prefers longer answers', '**长度偏差：**偏好更长的回答'), t('report lengths; use length-controlled win rates (AlpacaEval’s raised its correlation with Chatbot Arena from 0.94 to 0.98[^lc])', '报告长度；用长度控制后的胜率（AlpacaEval 这样做后，与 Chatbot Arena 的相关性从 0.94 升到 0.98[^lc]）')],
            [t('**Limited reasoning:** misjudges math and code', '**推理能力有限：**判错数学和代码题'), t('give it the reference answer or a rubric', '给它参考答案或评分细则')],
            [t('**Self-preference:** may favour its own family', '**自我偏好：**可能偏向自家模型'), t('not established (GPT-4 and Claude-v1 favoured themselves, GPT-3.5 did not); use a judge from another family to be safe', '尚无定论（GPT-4 和 Claude-v1 偏向自己，GPT-3.5 没有）；保险起见，换一个不同家族的评委')],
          ] },
        { type: 'callout', kind: 'note', body: t('Before trusting a judge, label about 100 pairs yourself and measure agreement (Cohen’s κ). People can be fooled too: crowd workers rated imitation models as good as ChatGPT (B2).', '在相信一个评委之前，自己标注约 100 对，计算一致性（Cohen’s κ）。人也会被骗：众包评分员曾认为模仿模型和 ChatGPT 一样好（B2）。') },
        { type: 'cite', key: 'zheng', text: t('Zheng et al. (2023). Judging LLM-as-a-Judge with MT-Bench and Chatbot Arena. NeurIPS.', 'Zheng 等（2023）。Judging LLM-as-a-Judge with MT-Bench and Chatbot Arena。NeurIPS。'), url: 'https://arxiv.org/abs/2306.05685' },
        { type: 'cite', key: 'lc', text: t('Dubois et al. (2024). Length-Controlled AlpacaEval. COLM.', 'Dubois 等（2024）。Length-Controlled AlpacaEval。COLM。'), url: 'https://arxiv.org/abs/2404.04475' },
      ],
    },
    {
      id: 'judge-code', kind: 'code', title: t('A judge you can trust a little more', '一个更可信一点的评委'),
      intro: t('Three habits in code: judge both orders, measure agreement with your own labels, report length next to the win rate.', '把三个习惯写成代码：两种顺序都判，和自己的标注算一致性，在胜率旁边报告长度。'),
      lang: 'python', code: JUDGE,
      notes: [
        { lines: [1, 9], text: t('A verdict counts only if it survives swapping the answers; otherwise the position decided it, so it is a tie.', '只有对调回答之后结论不变，才算数；否则是位置决定了结果，记为平局。') },
        { lines: [11, 17], text: t('Cohen’s κ corrects raw agreement for the agreement expected by chance. Above about 0.6 is usually considered good.', 'Cohen’s κ 会扣掉随机情况下也会出现的一致。一般认为 0.6 以上算好。') },
        { lines: [19, 22], text: t('A win rate without lengths hides the length bias.', '不报告长度的胜率，会把长度偏差藏起来。') },
      ],
    },
    {
      id: 'choose-ckpt', kind: 'read', title: t('Choosing the checkpoint to ship', '选出要上线的检查点'),
      blocks: [
        { type: 'list', ordered: true, items: [
          t('Pick by the task metric on a development set, never by the loss.', '在开发集上按任务指标选，绝不按 loss 选。'),
          t('Set a regression gate: no general benchmark or safety score may drop by more than X points.', '设一道回归门槛：任何通用基准或安全指标的下降都不能超过 X 分。'),
          t('Compare candidates with paired differences and intervals; a gap inside the noise is a tie.', '用配对差值和置信区间比较候选者；落在噪声范围内的差距，就当作平局。'),
          t('Keep a final test set and use it once, for the one checkpoint you ship: picking the best of many on the same set overestimates it.', '留一份最终测试集，只用一次，只测要上线的那个检查点：在同一份数据上挑最好的，会高估它。'),
        ] },
      ],
    },
    // ------------------------------------------------------------------ checks
    {
      id: 'q-ci', kind: 'checkpoint', chapter: t('Check', '检验'), title: t('Is it real?', '是真的吗？'), skill: 'eval-stats', purpose: 'check',
      prompt: t('Two checkpoints score 0.80 and 0.82 on the same 400 questions, compared as independent accuracies. What is the half-width of the 95% interval of their difference, in points?', '两个检查点在同一份 400 道题上分别得 0.80 和 0.82，按独立正确率比较。它们差值的 95% 区间半宽是多少分？'),
      question: { type: 'number', answer: 5.43, tolerance: 0.3, unit: t('points', '分'), wrong: [{ answer: 2, misconception: 'eval-small-diff-real', feedback: t('That is the observed gap, not its uncertainty.', '这是观测到的差距，不是它的不确定性。') }] },
      explain: t('$1.96 \\sqrt{(0.16 + 0.1476)/400} \\approx 5.4$ points: the 2-point gap is well inside the noise. A paired analysis would narrow it.', '$1.96 \\sqrt{(0.16 + 0.1476)/400} \\approx 5.4$ 分：2 分的差距完全在噪声之内。配对分析能把区间收窄。'),
    },
    {
      id: 'q-judge', kind: 'checkpoint', title: t('62% wins', '胜率 62%'), skill: 'llm-judge', purpose: 'check',
      prompt: t('A strong model judges your new model against the old one: 62% wins for the new model. The new model’s answers are 40% longer on average. What do you do next?', '一个强模型评委比较新旧两个模型：新模型胜率 62%。新模型的回答平均长了 40%。下一步做什么？'),
      question: { type: 'choice', options: [
        { id: 'a', label: t('Re-judge with both orders, report a length-controlled win rate, and check the judge against ~100 human labels', '两种顺序重判，报告长度控制后的胜率，并用约 100 条人工标注校准评委'), correct: true },
        { id: 'b', label: t('Ship it: 62% is a clear win', '上线：62% 已经是明显的胜利'), misconception: 'judge-objective' },
        { id: 'c', label: t('Use a larger judge from the same family', '换一个同家族、更大的评委') },
        { id: 'd', label: t('Shorten the old model’s answers to match', '把旧模型的回答截短来对齐') },
      ] },
    },
    {
      id: 'q-pick', kind: 'checkpoint', title: t('Which one ships?', '上线哪一个？'), skill: 'eval-design', purpose: 'check',
      prompt: t('Five checkpoints. The validation loss is lowest at checkpoint 2. The task metric (200 paired questions) is highest at checkpoint 4, 1.5 points above checkpoint 3. IFEval drops 3 points at checkpoint 4 and 0.5 at checkpoint 3. Your regression gate is 1 point. Which do you ship, and why?', '五个检查点。验证 loss 在第 2 个最低。任务指标（200 道配对题）在第 4 个最高，比第 3 个高 1.5 分。IFEval 在第 4 个掉了 3 分，在第 3 个掉了 0.5 分。你的回归门槛是 1 分。上线哪一个？为什么？'),
      question: { type: 'text', placeholder: t('Checkpoint …, because …', '第……个，因为……'), rubric: {
        key_points: [
          t('Not checkpoint 2: validation loss does not choose checkpoints.', '不是第 2 个：验证 loss 不用来选检查点。'),
          t('Checkpoint 4 fails the 1-point regression gate (IFEval −3).', '第 4 个没过 1 分的回归门槛（IFEval −3）。'),
          t('Checkpoint 3 passes the gate, and its 1.5-point deficit to checkpoint 4 is likely within the noise of 200 questions; confirm on the final test set.', '第 3 个过了门槛，它比第 4 个低的 1.5 分，在 200 道题上很可能落在噪声里；再用最终测试集确认。'),
        ],
        model_answer: t('Checkpoint 3. Checkpoint 2 is chosen by the loss, which does not track quality; checkpoint 4 breaks the regression gate (IFEval −3 > 1); and 1.5 points on 200 questions is probably noise. Confirm checkpoint 3 once on the held-out test set.', '第 3 个。第 2 个是按 loss 选的，而 loss 和质量对不上；第 4 个突破了回归门槛（IFEval −3 > 1）；200 道题上的 1.5 分大概率是噪声。最后在留出测试集上对第 3 个确认一次。'),
        min_points: 2,
      } },
    },
    // ------------------------------------------------------------------ how to choose
    {
      id: 'choose', kind: 'read', chapter: t('How to choose', '怎么选'), title: t('Evaluation first', '评测先行'),
      blocks: choose_card({
        upto: 'B3', highlight: '0,V', card: 'B3',
        rule: t('Write the evaluation before you train: a task held-out set and a regression set, or do not start. Choose checkpoints by the task metric and regression gates, not by the loss; report intervals, ideally from paired comparisons. With an LLM judge, swap orders, control for length and calibrate it on human labels first.', '先写评测，再训练：没有任务留出集和回归集，就不要开始。选检查点看任务指标和回归门槛，不看 loss；报告置信区间，最好来自配对比较。用大模型评委时，交换顺序、控制长度，并且先用人工标注校准。'),
        counter: t('"The new model is 2 points better on 100 questions, so we ship it." That gap is inside the noise.', '"新模型在 100 道题上高了 2 分，所以上线。"这个差距在噪声范围之内。'),
      }),
    },
  ],
};
