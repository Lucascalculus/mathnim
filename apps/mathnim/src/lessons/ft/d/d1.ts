// D1 Why preferences, and reward models.
// Plan: docs/lessons/llm-finetuning/part-d-preference.md (D1); sources there and
// in research-preference.md. Purpose first (what SFT cannot say), then the
// intuition of a hidden "strength", then Bradley–Terry, then one world where
// the learner fits rewards by hand and meets an undefeated answer whose reward
// never stops, then what reward signals look like in practice.
import type { Lesson } from '@mathnim/core';
import { choose_card, cite, details, fig, h, list, math, myth, note, open_q, p, t, table, text_q, vis, warn, world_setup } from './common';

/** One press of "Fit 1000 steps": record what the learner will see once the animation ends. */
function fit_press(scene: any, world: any): void {
  const undefeated = !scene.d_lost();
  const last = scene.fit(1000);
  const s = world.state;
  s.last_rd = last[3];
  s.since = ((s.since as number) ?? 0) + 1000;
  if (undefeated) s.fits_undefeated = ((s.fits_undefeated as number) ?? 0) + 1;
  world.emit('fit', { undefeated, r_d: last[3], n: s.fits_undefeated ?? 0 });
}

export const lesson: Lesson = {
  id: 'ft-d1',
  title: t('Why preferences, and reward models', '为什么要偏好，以及奖励模型'),
  description: t(
    'What imitation cannot say, how "A is better than B" becomes a number, and where that number comes from in practice.',
    '模仿说不出来的东西；"A 比 B 好"怎样变成一个数；这个数在实践中从哪里来、能不能信。',
  ),
  mode: 'essay',
  skills: [
    { id: 'pref-signal', name: t('What preference data can say that demonstrations cannot', '偏好数据能表达、示范数据表达不了的东西') },
    { id: 'bradley-terry', name: t('The Bradley–Terry model and its loss', 'Bradley–Terry 模型及其损失'), prerequisites: ['pref-signal'] },
    { id: 'rm-validate', name: t('Checking a reward model before using it', '用之前先检验奖励模型'), prerequisites: ['bradley-terry'] },
    { id: 'reward-sources', name: t('Choosing a reward signal', '选择奖励信号的来源'), prerequisites: ['rm-validate'] },
  ],
  misconceptions: [
    { id: 'sft-says-better', description: t('More good examples in SFT can express "this answer is better than that one".', '多给些好例子做 SFT，就能表达"这个回答比那个好"。') },
    { id: 'reward-has-units', description: t('A reward value means something on its own ("3.2 is good").', '奖励的绝对值本身有含义（"3.2 分算好"）。') },
    { id: 'undefeated-finite', description: t('An answer that never lost simply gets the highest finite reward.', '一场没输过的回答，只是得到一个最高的、有限的奖励。') },
    { id: 'rm-train-acc', description: t('High accuracy on the training pairs means the reward model can be trusted.', '在训练用的比较对上准确率高，奖励模型就可以信。') },
    { id: 'judge-unbiased', description: t('An LLM judge has no systematic bias.', '大模型评委没有系统性偏差。') },
  ],
  steps: [
    // ---------------------------------------------------------------- 1. why preferences
    {
      id: 'why', kind: 'read', chapter: t('What imitation cannot say', '模仿说不出来的东西'), title: t('Two correct answers, one better', '两个都对，一个更好'),
      blocks: [
        p('SFT teaches by example: here is a prompt, here is the answer to copy. That works for format and style. But a lot of what we want from an assistant is **relative**. Look at two answers to the same question:',
          'SFT 是"照着学"：给一个提示，再给一个要模仿的回答。学格式、学风格，这很管用。可我们希望助手具备的很多品质是**相对**的。看同一个问题的两个回答：'),
        table([['Question', '问题'], ['Answer A', '回答 A'], ['Answer B', '回答 B']], [
          [['How do I undo my last git commit but keep the changes?', '怎样撤销上一次 git 提交，但保留改动？'],
            ['`git reset --soft HEAD~1` - the commit is gone, your changes stay staged.', '`git reset --soft HEAD~1`：提交撤掉了，改动还留在暂存区。'],
            ['There are several ways to approach this, and it depends on your situation. Before doing anything, make sure you have a backup... (three paragraphs later) `git reset --soft HEAD~1`.', '这个问题有好几种处理方式，要看你的具体情况。动手之前，请务必先备份……（三段之后）`git reset --soft HEAD~1`。']],
        ]),
        p('Both are correct. Most people prefer A. Where in an SFT dataset would you write "A is better than B"? Nowhere: SFT can only say *copy this*. Preference data says something SFT cannot:',
          '两个都对，大多数人更喜欢 A。可在 SFT 的数据里，"A 比 B 好"该写在哪？没地方写：SFT 只会说"照这个写"。偏好数据能说出 SFT 说不出的几件事：'),
        list([
          ['**Negative signal.** "Not like B" - SFT has no way to use a bad answer except throwing it away.', '**负信号**："别像 B 那样"。SFT 拿到一个差回答，除了扔掉，没有别的用法。'],
          ['**Relative quality.** Between two acceptable answers, which one is better.', '**相对好坏**：两个都能接受的回答里，哪个更好。'],
          ['**Beyond the demonstrator.** Judging is easier than writing: you can tell the better poem without being able to write it.', '**超出示范者的水平**：判断比写容易。好诗你认得出，却未必写得出。'],
          ['**The model’s own mistakes.** Comparisons can be made on the model’s own outputs, so they cover the mistakes it actually makes.', '**模型自己的错误**：比较可以在模型自己写的回答上做，正好覆盖它真正会犯的错。'],
        ]),
        p('It pays off: in InstructGPT, people preferred the answers of a 1.3B model trained this way over those of the 175B GPT-3[^instructgpt].',
          '效果是实打实的：InstructGPT 里，用这种方法训练的 1.3B 模型，它的回答比 175B 的 GPT-3 更受人喜欢[^instructgpt]。'),
        note('This lesson: how "A is better than B" becomes a number (a reward), and where that number comes from in practice. D2 and D3 then use it to change the model.',
          '这一课讲两件事："A 比 B 好"怎样变成一个数（奖励），以及这个数在实践中从哪来、能不能信。D2 和 D3 再用它去改模型。', ['Where this is going', '这一课的去向']),
        cite('instructgpt', 'Ouyang et al. 2022', 'Training language models to follow instructions with human feedback (InstructGPT)', 'https://arxiv.org/abs/2203.02155'),
      ],
    },
    {
      id: 'why-q', kind: 'checkpoint', skill: 'pref-signal', purpose: 'predict', title: t('What is lost?', '丢了什么？'),
      prompt: t('You have 10,000 records of the form "A is better than B". You train with SFT on the A answers only. What information did you throw away?', '你有 1 万条"A 比 B 好"的记录，只拿其中的 A 去做 SFT。你丢掉了什么信息？'),
      question: {
        type: 'choice', options: [
          { id: 'a', label: t('That B is worse: the negative signal', '"B 更差"这个负信号'), correct: true },
          { id: 'b', label: t('Nothing: A already contains everything worth learning', '什么都没丢：A 里已经有全部值得学的东西'), misconception: 'sft-says-better', feedback: t('SFT raises the likelihood of A. Nothing in it lowers B, or says by how much A is better.', 'SFT 只提高 A 的似然。没有任何一项去压低 B，也没有任何一项说 A 好多少。') },
          { id: 'c', label: t('Only B’s formatting', '只丢了 B 的格式') },
        ],
      },
      explain: t('Comparisons carry what demonstrations cannot: what to avoid, and how much better one answer is.', '比较数据带着示范数据带不了的东西：该避开什么，以及一个回答比另一个好多少。'),
    },
    {
      id: 'pairwise', kind: 'read', title: t('Why compare instead of score?', '为什么比较，而不是打分？'),
      blocks: [
        p('The obvious alternative is to ask people for a score from 1 to 10. In practice absolute scores are noisy and every rater uses the scale differently: one person’s 7 is another’s 5. "Which of these two is better?" is faster to answer and far more consistent[^instructgpt].',
          '最直接的替代办法，是请人打 1 到 10 分。可实际上绝对分数噪声很大，而且每个人的尺子不一样：你的 7 分可能是别人的 5 分。"这两个哪个更好？"答得更快，也一致得多[^instructgpt]。'),
        fig('pipeline.svg', ['A prompt, K sampled answers, a human ranking, all pairs from it, a reward model, then RL or DPO.', '一个提示、采样出的 K 个回答、人工排序、由排序拆出的所有比较对、奖励模型，最后是 RL 或 DPO。'],
          ['Where comparisons come from and where they go. One ranking of K answers gives K(K−1)/2 pairs; InstructGPT used K = 4 to 9.', '比较数据从哪来、到哪去。对 K 个回答排一次序，就得到 K(K−1)/2 对比较；InstructGPT 用的 K 是 4 到 9。'], 'Redrawn after Ouyang et al. (2022), Figure 2'),
        details(['Two details from real pipelines', '真实流程里的两个细节'], [
          list([
            ['InstructGPT trained all pairs from one prompt together as a single batch element: shuffled separately, each answer was seen K−1 times and the model overfit after one pass[^instructgpt].', 'InstructGPT 把同一个提示拆出的所有对放进一个 batch 元素里一起训练：如果分开打乱，每个回答会被看 K−1 次，一轮之后就过拟合了[^instructgpt]。'],
            ['Llama 2 also asked how much better ("significantly", "slightly"...) and added a matching margin to the loss[^llama2].', 'Llama 2 还请标注者说明好多少（"明显好""略好"……），并在损失里加了对应的 margin[^llama2]。'],
          ]),
        ]),
        cite('llama2', 'Touvron et al. 2023', 'Llama 2: Open Foundation and Fine-Tuned Chat Models (§3.2)', 'https://arxiv.org/abs/2307.09288'),
        cite('instructgpt', 'Ouyang et al. 2022', 'Training language models to follow instructions with human feedback (InstructGPT)', 'https://arxiv.org/abs/2203.02155'),
      ],
    },

    // ---------------------------------------------------------------- 2. Bradley–Terry
    {
      id: 'strength', kind: 'read', chapter: t('From comparisons to a number', '从比较到一个数'), title: t('A hidden strength', '一个看不见的"强度"'),
      blocks: [
        p('We see only outcomes: in a match between two answers, people picked one. Imagine each answer has a hidden **strength**, and the stronger one wins more often but not always (raters are noisy). We want to recover the strengths from the outcomes - that strength is the **reward**.',
          '我们只看得到结果：两个回答比一场，人选了其中一个。设想每个回答都有一个看不见的**强度**：强的那个赢得更多，但不是每次都赢（人的判断有噪声）。我们想从结果反推出强度，这个强度就是**奖励**（reward）。'),
        p('The Bradley–Terry model turns the *difference* of two rewards into a win probability with the logistic function σ: a difference of 1 means a 73% win rate, a difference of 2 means 88%.',
          'Bradley–Terry 模型用 logistic 函数 σ，把两个奖励的**差**变成胜率：差 1 对应 73% 的胜率，差 2 对应 88%。'),
        math('P(y_1 \\succ y_2) = \\sigma\\big(r(y_1) - r(y_2)\\big) = \\frac{1}{1 + e^{-(r_1 - r_2)}}'),
        fig('shift.svg', ['Two pairs of bars, rewards (1, 3) and (11, 13); both give the same 88% win probability on the σ curve.', '两组柱子，奖励分别是 (1, 3) 和 (11, 13)；在 σ 曲线上给出同一个胜率 88%。'],
          ['Only the difference matters: adding 10 to every reward changes nothing.', '只有差值有意义：所有奖励都加 10，什么都不变。'], 'Original; exact'),
        p('Why this shape and not another? The next page derives it from one simple assumption, and shows how a reward model is trained on it.', '为什么是这个形状，而不是别的？下一页从一个简单的假设推出它，并说明怎样用它训练奖励模型。'),
      ],
    },
    {
      id: 'bt-derive', kind: 'derive', skill: 'bradley-terry', title: t('Bradley–Terry, step by step', '一步步推出 Bradley–Terry'),
      intro: t('Two answers y₁, y₂ to the same prompt, each with a hidden strength s(y) > 0.', '同一个提示下的两个回答 y₁、y₂，各有一个看不见的强度 s(y) > 0。'),
      lines: [
        { tex: 'P(y_1 \\succ y_2) = \\frac{s(y_1)}{s(y_1) + s(y_2)}', why: t('Bradley and Terry’s assumption (1952): like a lottery where each answer holds s tickets; whoever’s ticket is drawn wins.', 'Bradley 和 Terry（1952）的假设：好比抽奖，每个回答手里有 s 张彩票，抽中谁谁赢。') },
        { tex: 's(y) = e^{r(y)} \\;\\Rightarrow\\; P = \\frac{e^{r_1}}{e^{r_1} + e^{r_2}}', why: t('A network outputs any real number; the exponential makes the strength positive. This is a softmax over two options.', '网络输出的是任意实数；取指数保证强度为正。这就是两个选项上的 softmax。') },
        { tex: 'P = \\frac{1}{1 + e^{-(r_1 - r_2)}} = \\sigma(r_1 - r_2)', why: t('Divide by e^{r₁}. Only the difference is left: adding the same constant to every answer of a prompt changes nothing.', '分子分母同除以 e^{r₁}。只剩下差值：同一个提示下所有回答都加同一个常数，什么都不变。') },
        { tex: '\\mathcal L(\\phi) = -\\,\\mathbb E\\big[\\log \\sigma\\big(r_\\phi(x, y_w) - r_\\phi(x, y_l)\\big)\\big]', why: t('Maximum likelihood on the pairs (w = the one people preferred). It is binary cross-entropy whose label is always "w wins", with logit r_w − r_l: logistic regression on differences.', '在比较数据上做最大似然（w 是人选中的那个）。这其实就是二分类交叉熵，标签恒为"w 赢"，logit 是 r_w − r_l：在差值上做逻辑回归。') },
        { tex: '\\nabla_\\phi \\mathcal L = -\\,\\mathbb E\\big[\\sigma(r_l - r_w)\\,(\\nabla_\\phi r_w - \\nabla_\\phi r_l)\\big]', why: t('Because d log σ(Δ)/dΔ = σ(−Δ). Pairs already ranked right by a wide margin get weight ≈ 0; pairs ranked wrong get weight ≈ 1. DPO (D3) has exactly this weight.', '因为 d log σ(Δ)/dΔ = σ(−Δ)。已经排对、而且差得很开的对，权重约为 0；排错的对，权重接近 1。D3 里的 DPO 有完全一样的权重。') },
        { tex: '\\text{never lost} \\;\\Rightarrow\\; -\\log\\sigma(\\Delta) \\downarrow 0 \\text{ only as } \\Delta \\to \\infty', why: t('If an answer won every match it played, raising its reward always lowers the loss, but the loss never reaches 0: there is no finite best reward. The world below shows it.', '如果一个回答参加的每一场都赢了，把它的奖励调高总能让损失再降一点，却永远到不了 0：不存在有限的最优奖励。下面的世界会让你亲眼看到。') },
      ],
      blank: { line: 2, answer: 'r1 - r2', variables: ['r1', 'r2'], prompt: t('P(y₁ ≻ y₂) = σ( ? )  (write it with r1 and r2)', 'P(y₁ ≻ y₂) = σ( ? )（用 r1 和 r2 写）') },
      outro: t('A reward model is this loss with r_φ a neural network: a language model with a scalar head.', '奖励模型就是用这个损失训练的 r_φ：一个接了标量输出头的语言模型。'),
    },
    {
      id: 'shift-q', kind: 'checkpoint', skill: 'bradley-terry', purpose: 'check', title: t('Add ten to everything', '全部加 10'),
      prompt: t('A reward model scores every answer to a prompt, then you add 10 to all those scores. What changes?', '奖励模型给某个提示下的每个回答打了分，然后你给这些分数都加上 10。什么会变？'),
      question: {
        type: 'choice', options: [
          { id: 'a', label: t('The predicted win probabilities', '预测的胜率'), misconception: 'reward-has-units', feedback: t('σ(r₁ − r₂) only sees the difference, and the difference did not change.', 'σ(r₁ − r₂) 只看差值，而差值没有变。') },
          { id: 'b', label: t('The reward model’s loss', '奖励模型的损失'), feedback: t('The loss is built from the same differences.', '损失也是由同样的差值组成的。') },
          { id: 'c', label: t('Nothing', '什么都不变'), correct: true },
          { id: 'd', label: t('The best answer now wins more often', '原本领先的回答胜率更高了'), misconception: 'reward-has-units' },
        ],
      },
      explain: t('Rewards are only defined up to a constant per prompt. Remember this: in D3 it is exactly why an intractable term cancels.', '奖励只确定到"同一个提示下差一个常数"。记住这一点：D3 里正是因为它，一个算不出来的项消掉了。'),
    },

    // ---------------------------------------------------------------- 3. the world
    {
      id: 'league-q', kind: 'checkpoint', skill: 'bradley-terry', purpose: 'predict', chapter: t('An answer that never lost', '一个从没输过的回答'), title: t('Bet first', '先下注'),
      prompt: t('Four answers. A played 20 matches and won 15. D played only 3, all against the weakest answer C, and won all 3. You fit the rewards by gradient ascent for 1000 steps, then 10,000. What does D’s reward do?', '四个回答。A 打了 20 场，赢 15 场；D 只打了 3 场，对手都是最弱的 C，三场全胜。用梯度上升拟合奖励，先 1000 步，再 1 万步。D 的奖励会怎样？'),
      question: {
        type: 'choice', options: [
          { id: 'a', label: t('Settles a bit above C', '停在略高于 C 的地方') },
          { id: 'b', label: t('Settles near A', '停在 A 附近'), misconception: 'undefeated-finite' },
          { id: 'c', label: t('Keeps growing: no finite value fits best', '一直涨：没有哪个有限的值是最优的'), correct: true },
          { id: 'd', label: t('Becomes the highest, then stops', '变成最高的，然后停住'), misconception: 'undefeated-finite' },
        ],
      },
      attempts: 1,
    },
    {
      id: 'league', kind: 'explore', title: t('Make D stop', '让 D 停下来'), skill: 'bradley-terry',
      scene: vis('bradley_terry_fit', { story: 'setup' }),
      prompt: t(
        'Every row is a matchup: the **blue dot** is the win rate the rewards predict, σ(r_i − r_j); the **gold tick** is what the data says. (1) Drag **B** and **C** until every dot of the first three rows sits on its tick. (2) Press **Fit 1000 steps** a few times and watch **D**. (3) Change the data so that D’s reward stops.',
        '每一行是一对对局：**蓝点**是奖励预测的胜率 σ(r_i − r_j)，**金色刻线**是数据里的实际胜率。(1) 拖动 **B** 和 **C**，让前三行的蓝点都落到刻线上。(2) 按几次 **拟合 1000 步**，盯住 **D**。(3) 改动数据，让 D 的奖励停下来。'),
      setup: world_setup('bradley_terry_fit', { story: 'setup' }, (scene: any, ui, _ctx, world) => {
        const emit = scene.emit;
        scene.emit = (type: string, data?: Record<string, unknown>) => {
          if (type === 'dragged' && (data?.err as number) < 0.03) world.state.hand = true;
          if (type === 'data') world.state.since = 0;
          emit(type, data);
        };
        scene.attach_cards(ui);
      }),
      actions: [
        { id: 'fit', label: t('Fit 1000 steps', '拟合 1000 步'), primary: true, run: (scene: any, _ctx, world) => fit_press(scene, world) },
      ],
      goals: [
        { id: 'match3', check: (_s, _c, w) => w.state.hand === true, message: t('Rows A:B, B:C and A:C now agree with the data: three rewards were enough to explain six counts.', 'A:B、B:C、A:C 三行都和数据对上了：三个奖励就解释了这些战绩。') },
        { id: 'runaway', check: (s: any, _c, w) => ((w.state.fits_undefeated as number) ?? 0) >= 3 && ((w.state.last_rd as number) ?? 0) > 4.5 && !s.d_lost(), message: t('D keeps climbing - about the same amount per thousand steps, with no ceiling.', 'D 一直在涨，每一千步都涨一截，没有上限。') },
        { id: 'stopped', check: (s: any, _c, w) => s.d_lost() && ((w.state.since as number) ?? 0) >= 2000 && ((w.state.last_rd as number) ?? 1) < 0, message: t('One loss in the data and D settles - below A.', '数据里有了一场负局，D 停下来了，而且停在 A 之下。') },
      ],
      detectors: [
        { id: 'another-win', on: (e) => (e.type === 'data' && e.data?.card === 'D>C' && e.data?.added && !e.data?.d_lost ? { kind: 'misconception', id: 'undefeated-finite' } : null) },
        { id: 'climb', on: (e) => (e.type === 'fit' && e.data?.undefeated && e.data?.n === 2 ? { kind: 'progress', id: 'climbing' } : null) },
      ],
      lines: [
        { text: t('Blue dots are what the rewards predict. Gold ticks are what the data says.', '蓝点是奖励的预测，金色刻线是数据的实际。'), when: 'enter' },
        { text: t('Drag the top of a bar. Every row that answer is in moves with it.', '拖动柱子的顶端。这个回答出现在哪几行，那几行就一起动。'), when: 'idle' },
        { text: t('Look at D’s row: the dot creeps toward 1 but can never reach it.', '看 D 那一行：蓝点一点点逼近 1，却永远到不了。'), when: { finding: 'climbing' } },
        { text: t('Another win only makes D’s record more perfect. The fit still wants D higher. What D lacks is one loss.', '再加一场胜利，只会让 D 的战绩更完美，拟合还是想把 D 推得更高。D 缺的是一场败绩。'), when: { finding: 'undefeated-finite' } },
        { text: t('Three wins against the weakest answer were never strong evidence. One loss is enough to bring D down to earth.', '只赢过最弱的 C 三次，本来就算不上强证据。一场负局，就把 D 拉回了地面。'), when: 'goal' },
      ],
      hints: [
        t('If a dot sits left of its tick, the first answer of that row needs a higher reward.', '蓝点在刻线左边，说明这一行第一个回答的奖励要再高一些。'),
        t('D needs data that it could lose: which card shows D losing?', 'D 需要能让它输的数据：哪张卡片表示 D 输了？'),
      ],
      solve: (s: any, _c, w) => {
        s.set_rewards([0, -0.89, -1.33, 0]);
        s.emit('dragged', { item: 'C', err: s.abc_error() });
        for (let k = 0; k < 3; k++) fit_press(s, w);
        s.cards[0].set_value(1);
        s.emit('data', { card: 'C>D', added: true, d_lost: s.d_lost() });
        fit_press(s, w);
        fit_press(s, w);
        s.queue = [];
      },
    },
    {
      id: 'league-why', kind: 'read', title: t('What the world showed', '刚才看到了什么'),
      blocks: [
        list([
          ['**Rewards are coupled.** Moving one reward moves every match that answer is in, so a fit balances all the data at once.', '**奖励彼此牵连**：动一个回答的奖励，它参加的每一场预测都跟着变，所以拟合要同时照顾所有数据。'],
          ['**An undefeated answer has no finite reward.** The data are perfectly separable, so the likelihood always improves by pushing D higher - the same thing that happens to logistic regression on separable data.', '**全胜的回答没有有限的奖励**：数据完全可分，把 D 推得更高总能让似然再好一点。逻辑回归在线性可分的数据上也会这样。'],
          ['**One loss changes everything.** D’s three wins came against the weakest answer; with a single loss it lands at r_C + ln 3 ≈ −0.23, below A.', '**一场负局改变一切**：D 的三场胜利都是对最弱的 C；有了一场负局，它停在 r_C + ln 3 ≈ −0.23，比 A 还低。'],
        ]),
        p('Real reward models are protected by sharing parameters across millions of answers, by training for about one epoch, and by having many comparisons per answer. The same runaway reappears in D3: DPO uses this very loss, and D4 shows the variants built to give it a finite target.',
          '真实的奖励模型有几重保护：几百万个回答共享同一套参数、通常只训练一轮左右、每个回答参与很多场比较。但这种"停不下来"在 D3 还会出现：DPO 用的正是这个损失；D4 会讲专门为了给它一个有限目标而设计的变体。'),
        note('The toy numbers on the canvas are made up; the fit itself (the likelihood and its gradient ascent) is exact.', '画面上的战绩是虚构的玩具数据；拟合本身（似然和梯度上升）是精确计算。', ['Honest label', '说明']),
      ],
    },
    {
      id: 'compute-q', kind: 'checkpoint', skill: 'bradley-terry', purpose: 'practice', title: t('From scores to a win rate', '从分数到胜率'),
      prompt: t('A reward model gives answer A a score of 1.5 and answer B −0.5. With what probability does it predict that people prefer A?', '奖励模型给回答 A 打 1.5 分，给回答 B 打 −0.5 分。它预测人们更喜欢 A 的概率是多少？'),
      question: { type: 'number', answer: 0.881, tolerance: 0.01, wrong: [{ answer: 0.75, misconception: 'reward-has-units', feedback: t('That treats the scores as strengths and divides them. Only the difference counts: σ(1.5 − (−0.5)) = σ(2).', '这是把分数当成强度直接相除。只有差值有意义：σ(1.5 − (−0.5)) = σ(2)。') }] },
      hints: [t('Take the difference first.', '先求差。'), t('σ(2) = 1/(1 + e⁻²).', 'σ(2) = 1/(1 + e⁻²)。')],
      explain: t('σ(2) = 1/(1 + e^{−2}) ≈ 0.88.', 'σ(2) = 1/(1 + e^{−2}) ≈ 0.88。'),
    },

    // ---------------------------------------------------------------- 4. the reward model in code
    {
      id: 'rm-code', kind: 'code', chapter: t('A reward model in practice', '实践中的奖励模型'), title: t('The reward model, from scratch', '从零写一个奖励模型'), lang: 'python',
      intro: t('A language model with its next-token head replaced by one number per sequence. Both answers go through the same network; the loss compares their scores.', '把语言模型的下一个词输出头换成"每条序列一个数"。两个回答走同一个网络，损失比较它们的得分。'),
      code: `class RewardModel(nn.Module):
    def __init__(self, backbone):                       # an AutoModel without the LM head
        super().__init__()
        self.backbone = backbone
        self.head = nn.Linear(backbone.config.hidden_size, 1)

    def forward(self, ids, mask):                       # right-padded
        h = self.backbone(input_ids=ids, attention_mask=mask).last_hidden_state
        last = mask.sum(-1) - 1                         # index of the last real token
        return self.head(h[torch.arange(h.size(0)), last]).squeeze(-1)

def bt_loss(rm, chosen_ids, chosen_mask, rejected_ids, rejected_mask):
    # pad chosen and rejected to the same length T, run them as one batch
    r = rm(torch.cat([chosen_ids, rejected_ids]), torch.cat([chosen_mask, rejected_mask]))
    r_w, r_l = r.chunk(2)
    loss = -F.logsigmoid(r_w - r_l).mean()              # Bradley–Terry
    acc = (r_w > r_l).float().mean()                    # pairwise accuracy
    return loss, acc`,
      notes: [
        { lines: [1, 5], text: t('Start from your SFT model (or a model of the same family) and add a linear layer that outputs one number.', '从 SFT 模型（或同系列的模型）出发，加一个只输出一个数的线性层。') },
        { lines: [7, 10], text: t('Why the last token? With causal attention only the last position has seen the whole answer.', '为什么取最后一个 token？在因果注意力下，只有最后一个位置看过整段回答。'), shapes: 'ids: [2B, T] → h: [2B, T, H] → reward: [2B]' },
        { lines: [12, 15], text: t('Chosen and rejected share one forward pass, then split back into r_w and r_l.', '被选回答和被拒回答一起做一次前向，再拆回 r_w 和 r_l。'), shapes: 'r: [2B] → r_w, r_l: [B]' },
        { lines: [16, 18], text: t('The loss is the Bradley–Terry negative log-likelihood; `logsigmoid` is the numerically stable form. Accuracy is what you monitor - on held-out pairs.', '损失就是 Bradley–Terry 的负对数似然；`logsigmoid` 是数值稳定的写法。要监控的是准确率，而且要看留出集。') },
      ],
    },
    {
      id: 'rm-trl', kind: 'read', title: t('The same with TRL', '用 TRL 写'),
      blocks: [
        p('In practice you would use a trainer. TRL’s `RewardTrainer` loads a sequence-classification model with one output, takes pairs with `chosen` and `rejected` columns, and can use a per-pair `margin` (as in Llama 2).',
          '实际上一般直接用训练器。TRL 的 `RewardTrainer` 会加载一个只有一个输出的序列分类模型，读取带 `chosen` 和 `rejected` 两列的数据，还可以给每一对一个 `margin`（Llama 2 的做法）。'),
        { type: 'code', lang: 'python', label: 'TRL', caption: t('TRL v1.15. `center_rewards_coefficient` (0.01 is the recommended value) nudges rewards toward mean zero.', 'TRL v1.15。`center_rewards_coefficient`（推荐值 0.01）会把奖励往均值 0 拉。'), code: `from datasets import load_dataset
from trl import RewardConfig, RewardTrainer

ds = load_dataset("trl-lib/ultrafeedback_binarized")      # columns: chosen, rejected
args = RewardConfig(output_dir="rm", num_train_epochs=1,
                    per_device_train_batch_size=8, center_rewards_coefficient=0.01)
trainer = RewardTrainer(model="Qwen/Qwen2.5-0.5B-Instruct", args=args,
                        train_dataset=ds["train"], eval_dataset=ds["test"])
trainer.train()` },
      ],
    },
    {
      id: 'validate', kind: 'read', title: t('Check it before you trust it', '用之前先检验'),
      blocks: [
        p('A reward model is a measuring instrument. Everything after it - RL, rejection sampling, choosing checkpoints - optimizes whatever it measures, flaws included. So check it first:',
          '奖励模型是一件测量仪器。它后面的一切，无论是强化学习、拒绝采样还是挑检查点，都会去优化它测出来的东西，连同它的毛病一起。所以先检验它：'),
        list([
          ['**Held-out pairwise accuracy, against the ceiling.** People disagree with each other too: in InstructGPT, labelers agreed about 73% (training labelers) and 77% (held-out labelers) of the time[^instructgpt]. A reward model near that is about as good as the labels allow.', '**留出集上的成对准确率，并和天花板比**：人和人之间也会意见不一。InstructGPT 里，标注者之间的一致率约为 73%（训练标注者）和 77%（留出的标注者）[^instructgpt]。奖励模型接近这个数，就差不多是标签允许的最好水平了。'],
          ['**Slices.** Accuracy on pairs where the shorter answer won, by format, by whether the answer flatters the user. A shortcut hides in the average and shows up in a slice.', '**切片**：分别看"短回答赢了"的那些对、不同格式、回答是否附和用户……捷径会藏在平均数里，在切片上露出来。'],
          ['**Calibration.** When it predicts 80%, do people pick that answer about 80% of the time?', '**校准**：它预测 80% 的时候，人们真的有大约 80% 的时候选那个回答吗？'],
          ['**Public benchmarks** such as RewardBench[^rewardbench], as a sanity check, not a substitute for your own data.', '**公开基准**，例如 RewardBench[^rewardbench]：用来做健全性检查，代替不了你自己的数据。'],
        ]),
        h('The most common shortcut: length', '最常见的捷径：长度'),
        p('Longer answers are often preferred, so reward models learn "longer is better". How far does that go? Singhal et al. trained with a reward that looked **only at length** and recovered most of the gains of full RLHF[^singhal]:',
          '人们常常偏爱更长的回答，于是奖励模型学会了"越长越好"。这能走多远？Singhal 等人用一个**只看长度**的奖励去训练，拿到了完整 RLHF 的大部分收益[^singhal]：'),
        fig('length-only.svg', ['Bar chart: win rate against the SFT model, length-only reward vs the full reward model: 56% vs 58% on WebGPT, 64% vs 63% on RLCD.', '柱状图：对 SFT 模型的胜率，只看长度的奖励 vs 完整奖励模型：WebGPT 上 56% 对 58%，RLCD 上 64% 对 63%。'],
          ['A reward that only counts length (LPPO) against the real reward model (PPO): almost the same win rate.', '只数长度的奖励（LPPO）对比真正的奖励模型（PPO）：胜率几乎一样。'], 'Data: Singhal et al. (2023), Table 2'),
        cite('singhal', 'Singhal et al. 2023', 'A Long Way to Go: Investigating Length Correlations in RLHF', 'https://arxiv.org/abs/2310.03716'),
        cite('rewardbench', 'Lambert et al. 2024', 'RewardBench: Evaluating Reward Models for Language Modeling', 'https://arxiv.org/abs/2403.13787'),
        cite('instructgpt', 'Ouyang et al. 2022', 'Training language models to follow instructions with human feedback (InstructGPT)', 'https://arxiv.org/abs/2203.02155'),
      ],
    },
    {
      id: 'diagnose-q', kind: 'checkpoint', skill: 'rm-validate', purpose: 'check', title: t('Read the report', '读这份报告'),
      prompt: t(
        'A reward model’s report: training accuracy 0.94; held-out 0.71; agreement between labelers 0.73; on held-out pairs where the **shorter** answer won: 0.41; where the **longer** answer won: 0.86. What is the most important problem?',
        '一个奖励模型的报告：训练集准确率 0.94；留出集 0.71；标注者之间的一致率 0.73；在留出集里"**较短**的回答赢了"的那些对上 0.41；"**较长**的回答赢了"的那些对上 0.86。最要紧的问题是什么？'),
      question: {
        type: 'choice', options: [
          { id: 'a', label: t('Length bias: on pairs where people preferred the shorter answer it is worse than a coin flip', '长度偏差：在人们偏爱较短回答的那些对上，它还不如抛硬币'), correct: true },
          { id: 'b', label: t('Overfitting: 0.94 on training vs 0.71 held out', '过拟合：训练集 0.94，留出集只有 0.71'), misconception: 'rm-train-acc', feedback: t('0.71 is close to the 0.73 ceiling set by the labels themselves. The real alarm is the 0.41 slice.', '0.71 已经接近标签本身的天花板 0.73。真正的警报是那个 0.41 的切片。') },
          { id: 'c', label: t('Nothing: 0.71 is close to human agreement', '没问题：0.71 已经接近人类一致率'), feedback: t('The average hides it; look at the slices.', '平均数把问题藏起来了；看切片。') },
        ],
      },
      explain: t('Below 0.5 on "shorter wins" means it uses length as a shortcut. Fix the data (pairs where the shorter answer wins, length balancing), report length-controlled accuracy, and do not optimize against it until then.', '在"短的赢了"的对上低于 0.5，说明它把长度当成了捷径。先修数据（补充短回答赢的对、按长度配平），报告长度受控的准确率；在那之前，别拿它去做优化。'),
    },

    // ---------------------------------------------------------------- 5. where rewards come from today
    {
      id: 'sources', kind: 'read', chapter: t('Where reward signals come from', '奖励信号从哪来'), title: t('Four sources, and the order to try them', '四种来源，以及尝试的顺序'),
      blocks: [
        p('So far the reward came from a model trained on human comparisons. That is one of four sources, and today not the most common one: labs mostly use verifiers, rubrics and LLM judges, and a separately trained Bradley–Terry reward model has become rare in open-source work (about 1,000 models on the Hugging Face Hub carry the reward-trainer tag).',
          '到目前为止，奖励来自一个用人类比较训练出来的模型。这只是四种来源之一，而且如今不是最常见的：实验室大多用验证器、评分细则和大模型评委；单独训练 Bradley–Terry 奖励模型，在开源社区里已经少见了（Hugging Face Hub 上带 reward-trainer 标签的模型只有约 1,000 个）。'),
        table([['Source', '来源'], ['How you get it', '怎么得到'], ['Good for', '适合'], ['Main risk', '主要风险']], [
          [['Rule-based verifier', '规则验证器'], ['A program checks the answer, runs unit tests, validates JSON', '程序判答案、跑单元测试、校验 JSON'], ['Tasks whose correctness a program can decide (E1)', '对错能用程序判定的任务（E1）'], ['Narrow; the verifier itself can have holes', '覆盖面窄；验证器本身也可能有漏洞']],
          [['Rubric + LLM judge', '评分细则 + 大模型评委'], ['Write the standard down; a large model scores against it', '把标准写成细则，让大模型按细则打分'], ['Clear standards that no program can check (policy, tone)', '有明确标准、但写不成程序的任务（政策、语气）'], ['The judge’s biases; an incomplete rubric', '评委的偏差；细则写不全']],
          [['Bradley–Terry reward model', 'Bradley–Terry 奖励模型'], ['Train a scalar head on comparisons (this lesson)', '在比较数据上训练一个标量头（本课）'], ['Subjective quality that must be scored fast, many times', '主观质量，而且要快速、大量地打分'], ['Unreliable away from its data; length bias; gets exploited (D2)', '离开训练分布就不可靠；长度偏差；会被钻空子（D2）']],
          [['Pairwise AI feedback', '两两比较的 AI 反馈'], ['A judge picks the better of two answers', '让评委在两个回答中挑一个'], ['Producing preference pairs for DPO directly (D4)', '直接产出 DPO 用的偏好对（D4）'], ['Position bias, verbosity bias, self-preference', '位置偏差、冗长偏差、自我偏好']],
        ]),
        note('Try them in this order: a verifier if correctness can be checked by a program; then a rubric with an LLM judge; train a reward model last. Whatever learned scorer you use, check it against held-out human judgements first.',
          '按这个顺序尝试：能用程序判对错，就用验证器；其次是评分细则加大模型评委；最后才训练奖励模型。不管用哪种学出来的打分器，都先拿留出的人工判断检验一遍。', ['The order', '顺序']),
        p('Why learn Bradley–Terry at all, then? Because the same model sits under preference leaderboards such as Chatbot Arena[^arena], and because DPO (D3) is literally this loss with the language model as the reward model.',
          '那为什么还要学 Bradley–Terry？因为 Chatbot Arena 这类偏好排行榜底下也是它[^arena]；更因为 D3 的 DPO，就是把这个损失里的奖励模型换成了语言模型本身。'),
        h('Human or AI feedback?', '人工反馈，还是 AI 反馈？'),
        p('AI feedback is cheap and fast, and in the RLAIF study it worked about as well as human feedback for summarization and helpful dialogue[^rlaif]. Judges have known biases[^judge]: they favour the first position, longer answers, and their own style. The standard fixes: judge every pair twice with the order swapped and keep only consistent verdicts; write the rubric out; calibrate the judge on a few hundred human labels.',
          'AI 反馈便宜、快；在 RLAIF 的研究里，它在摘要和有用性对话上的效果和人工反馈差不多[^rlaif]。评委有已知的偏差[^judge]：偏爱排在前面的回答、偏爱更长的回答、偏爱和自己风格相近的回答。标准对策：每一对交换位置评两次，只保留两次一致的结论；把细则写清楚；用几百条人工标注校准评委。'),
        open_q('How far AI feedback can replace people is still open, especially for safety policies, new domains and high-stakes decisions.', 'AI 反馈能在多大程度上替代人，仍是开放问题，尤其是在安全策略、新领域和高风险决定上。'),
        cite('arena', 'Chiang et al. 2024', 'Chatbot Arena: An Open Platform for Evaluating LLMs by Human Preference', 'https://arxiv.org/abs/2403.04132'),
        cite('rlaif', 'Lee et al. 2023', 'RLAIF: Scaling Reinforcement Learning from Human Feedback with AI Feedback', 'https://arxiv.org/abs/2309.00267'),
        cite('judge', 'Zheng et al. 2023', 'Judging LLM-as-a-Judge with MT-Bench and Chatbot Arena', 'https://arxiv.org/abs/2306.05685'),
      ],
    },
    ...(['math', 'support', 'fiction'] as const).map((k, i): any => {
      const group = { id: 'signals', title: t('Pick the reward signal', '选奖励信号'), brief: [p('For each task, which reward source would you reach for first?', '对下面每个任务，你会先用哪种奖励来源？')] };
      const opts = (correct: string) => ({
        type: 'choice' as const, options: [
          { id: 'verifier', label: t('Rule-based verifier', '规则验证器'), correct: correct === 'verifier' },
          { id: 'judge', label: t('Rubric + LLM judge, calibrated on human labels', '评分细则 + 大模型评委，用人工标注校准'), correct: correct === 'judge' },
          { id: 'pairs', label: t('Pairwise comparisons (human or AI), for a reward model or DPO', '两两比较（人工或 AI），用于奖励模型或 DPO'), correct: correct === 'pairs' },
          { id: 'scores', label: t('Ask people for 1-10 scores', '请人打 1–10 分') },
        ],
      });
      const q = [
        { prompt: t('Final answers to math word problems.', '数学应用题的最终答案。'), correct: 'verifier', explain: t('A program can check the answer: no learned scorer to exploit.', '程序能判对错：没有学出来、可被钻空子的打分器。') },
        { prompt: t('Customer-support replies that must follow the refund policy and stay polite.', '客服回复，要求遵守退款政策、语气得体。'), correct: 'judge', explain: t('The standard can be written down but not programmed; calibrate the judge on human labels.', '标准能写下来，却写不成程序；用人工标注校准评委。') },
        { prompt: t('Which opening of a short story is more gripping.', '哪个小说开头更吸引人。'), correct: 'pairs', explain: t('Purely relative and subjective: compare, do not score.', '纯粹相对、主观：比较，而不是打分。') },
      ][i];
      return { id: `signal-${k}`, kind: 'checkpoint', skill: 'reward-sources', purpose: 'check', group, prompt: q.prompt, question: opts(q.correct), explain: q.explain };
    }),
    {
      id: 'explain-q', kind: 'checkpoint', skill: 'pref-signal', purpose: 'check', title: t('In your own words', '用自己的话说'),
      prompt: t('Why do preference labels usually ask "which is better?" rather than "give it a score"?', '为什么偏好标注通常问"哪个更好"，而不是"打几分"？'),
      question: text_q([
        ['Absolute scores are noisy and raters use the scale differently', '绝对分数噪声大，每个人的尺度不一样'],
        ['Comparisons are faster and more consistent', '比较更快，也更一致'],
        ['The Bradley–Terry model only needs differences', 'Bradley–Terry 模型只需要差值'],
      ], ['Because raters disagree about what a 7 means, but agree much more on which of two answers is better; and a reward model only needs differences, which is all a comparison gives.', '因为大家对"7 分"是什么意思各有各的理解，但对"两个里哪个更好"要一致得多；而奖励模型本来就只需要差值，比较给的正是差值。'], 2),
    },

    // ---------------------------------------------------------------- 6. how to choose
    {
      id: 'card', kind: 'read', chapter: t('How to choose', '怎么选'), title: t('What D1 adds to the map', 'D1 给决策图加了什么'),
      blocks: choose_card({
        upto: 'D1', highlight: 'R,B3,C4',
        rule: t('If you need to score answers, try a verifier first, then a rubric with an LLM judge, and train a reward model last; check any learned scorer on held-out human judgements, including length slices, before optimizing against it. If you can tell which answer is better but cannot write the best one, take the preference route.',
          '如果要给回答打分：先试验证器，其次评分细则加大模型评委，最后才训练奖励模型；任何学出来的打分器，在拿去优化之前，都先用留出的人工判断检验，包括长度切片。如果你能判断哪个回答更好，却写不出最好的那个，就走偏好路线。'),
        counter: t('Optimizing straight against an unchecked LLM judge. It is tempting because it is quick; it fails because judges favour longer answers, and what you get is verbosity - a reward that only counts length already reproduces most RLHF gains.',
          '拿一个没校验过的大模型评委直接打分来优化。诱人之处是快；错在评委偏爱更长的回答，优化出来的是啰嗦——只数长度的奖励就已经能复现 RLHF 的大部分收益。'),
        extra: [warn('If the goal is a fixed format you can demonstrate (say, always valid JSON), comparisons are wasted effort: use SFT or a structured-output prompt.', '如果目标是能直接示范的固定格式（比如永远输出合法 JSON），花力气做比较就浪费了：用 SFT 或结构化输出的提示词。')],
      }),
    },
  ],
};
