// B2 Where SFT data comes from: people, stronger models, the model itself
// (rejection sampling), teachers (distillation), raw domain text (continued
// pretraining), and agent trajectories. Plan: part-b-sft.md (B2); sources there and in research-sft.md.
import type { Lesson } from '@mathnim/core';
import { choose_card, on_handles, t, vis } from './common';

const RS_PIPELINE = `from vllm import LLM, SamplingParams
import json, re

llm = LLM(model="Qwen/Qwen2.5-1.5B-Instruct")
params = SamplingParams(n=8, temperature=0.8, max_tokens=1024)   # n samples per problem

def final_answer(text):
    m = re.search(r"\\\\boxed\\{([^}]*)\\}", text)
    return m.group(1).strip() if m else None

problems = [json.loads(l) for l in open("train.jsonl")]          # {"question", "answer"}
outputs = llm.generate([p["question"] for p in problems], params)

kept = []
for p, out in zip(problems, outputs):
    correct = [o.text for o in out.outputs if final_answer(o.text) == p["answer"]]
    for text in list(dict.fromkeys(correct))[:1]:                   # cap c = 1 distinct answer per problem
        kept.append({"messages": [{"role": "user", "content": p["question"]},
                                  {"role": "assistant", "content": text}]})

with open("sft_round1.jsonl", "w") as f:
    for row in kept:
        f.write(json.dumps(row, ensure_ascii=False) + "\\n")
print(f"{len(kept)} kept from {len(problems)} problems")`;

const TOOL_EXAMPLE = `{"tools": [{"type": "function", "function": {
    "name": "search_trains",
    "description": "Search high-speed trains by origin, destination and date",
    "parameters": {"type": "object",
                   "properties": {"from": {"type": "string"}, "to": {"type": "string"}, "date": {"type": "string"}},
                   "required": ["from", "to", "date"]}}}],
 "messages": [
  {"role": "system", "content": "You are a train booking assistant."},
  {"role": "user", "content": "When is the first high-speed train from Shanghai to Beijing tomorrow?"},
  {"role": "assistant", "tool_calls": [{"type": "function", "function": {
      "name": "search_trains", "arguments": {"from": "Shanghai", "to": "Beijing", "date": "2026-10-11"}}}]},
  {"role": "tool", "name": "search_trains", "content": "[{\\"train\\": \\"G2\\", \\"dep\\": \\"07:00\\"}]"},
  {"role": "assistant", "content": "The first one is G2, leaving at 07:00."}
 ]}`;

export const lesson: Lesson = {
  id: 'ft-b2-data-sources',
  title: t('Where SFT data comes from', 'SFT 的数据从哪来'),
  description: t('People, stronger models, the model itself, teachers and raw domain text: what each source can teach, what it costs, and how it goes wrong.', '人工、更强的模型、模型自己、老师模型，以及原始领域文本：每种来源能教会什么、代价是什么、会在哪里出错。'),
  mode: 'essay',
  skills: [
    { id: 'sft-data-sources', name: t('Choosing a data source', '选择数据来源') },
    { id: 'synthetic-data', name: t('Synthetic data and its filters', '合成数据及其过滤') },
    { id: 'rejection-sampling', name: t('Rejection sampling and expert iteration', '拒绝采样与专家迭代') },
    { id: 'seq-distillation', name: t('Sequence-level distillation', '序列级蒸馏') },
    { id: 'cpt-vs-sft', name: t('Continued pretraining vs SFT', '继续预训练与 SFT') },
    { id: 'tool-sft-data', name: t('Tool-calling SFT data', '工具调用的 SFT 数据'), prerequisites: ['sft-data-sources'] },
  ],
  misconceptions: [
    { id: 'more-data-better', description: t('More examples always help.', '样本越多越好。') },
    { id: 'few-examples-suffice', description: t('A thousand good examples are always enough.', '一千条好样本总是够的。') },
    { id: 'imitation-equals-capability', description: t('Training on a stronger model’s outputs gives the stronger model’s abilities.', '用更强模型的输出训练，就能得到更强模型的能力。') },
    { id: 'rs-data-unbiased', description: t('Rejection-sampled data has the same mix of problems as the problem set.', '拒绝采样得到的数据，和原题集的题型分布一样。') },
    { id: 'ft-injects-knowledge', description: t('Fine-tuning on documents (or Q&A made from them) reliably teaches their facts.', '用文档（或由文档改写的问答）微调，就能可靠地教会模型里面的事实。') },
    { id: 'tool-output-trained', description: t('In tool-calling data, the whole conversation, tool results included, should be trained.', '工具调用数据里，整段对话（包括工具返回的结果）都应该训练。') },
    { id: 'pad-eos-harmless', description: t('The end-of-turn token’s label does not matter.', '轮次结束 token 的 label 无所谓。') },
  ],
  steps: [
    // ------------------------------------------------------------------ the question
    {
      id: 'sources', kind: 'read', chapter: t('Five sources', '五种来源'), title: t('SFT needs demonstrations. Who writes them?', 'SFT 需要示范。谁来写？'),
      blocks: [
        { type: 'p', text: t(
          'B1 showed that SFT copies whatever the demonstrations do. So the real question is where good demonstrations come from. Writing them by hand is slow and expensive, and today most SFT data is produced by models and then filtered. Each source teaches something different and fails differently:',
          'B1 讲过：SFT 会照搬示范里的一切。所以真正的问题是，好的示范从哪来。人工写又慢又贵；如今大多数 SFT 数据是由模型生成、再经过筛选的。不同来源能教的东西不同，出错的方式也不同：') },
        { type: 'table',
          head: [t('Source', '来源'), t('Who guarantees quality', '谁保证质量'), t('Good for', '适合教'), t('Main risk', '主要风险')],
          rows: [
            [t('People (annotators, experts)', '人工（标注员、专家）'), t('guidelines and review', '标注规范与审核'), t('style, policy, hard expert answers', '风格、规则、高难度的专家回答'), t('cost; inconsistent annotators', '成本；标注不一致')],
            [t('A stronger model (synthetic)', '更强的模型（合成）'), t('filters you write', '你写的过滤规则'), t('format, style, coverage at scale', '格式、风格、大规模覆盖'), t('copies style, not facts; terms of use', '学到风格而不是事实；使用条款')],
            [t('The model itself (rejection sampling)', '模型自己（拒绝采样）'), t('a verifier or reward model', '验证器或奖励模型'), t('tasks with checkable answers', '答案可以自动判对错的任务'), t('only reinforces what it can already do', '只强化它本来就会的')],
            [t('A teacher model (distillation)', '老师模型（蒸馏）'), t('the teacher', '老师模型'), t('making a small model capable', '让小模型变强'), t('license; the teacher’s mistakes', '许可；老师的错误')],
            [t('Raw domain text (continued pretraining)', '原始领域文本（继续预训练）'), t('the corpus', '语料本身'), t('domain language and closed-book knowledge', '领域语言与闭卷知识'), t('loses chat skills; hallucination', '丢掉对话能力；幻觉')],
          ] },
        { type: 'callout', kind: 'note', body: t('About 19% of teams say they use synthetic data[^notion], and most distillation outside labs looks like this: SFT on model-generated data.', '约 19% 的团队自报在用合成数据[^notion]；实验室以外的大多数蒸馏，形式上就是"用模型生成的数据做 SFT"。') },
        { type: 'cite', key: 'notion', text: t('Notion × Amplify × Vercel AI engineering survey (2026), self-reported.', 'Notion × Amplify × Vercel AI 工程调查（2026），自报数据。'), url: 'https://www.notion.com/lp/ai-engineering-survey' },
      ],
    },
    {
      id: 'how-much', kind: 'read', title: t('How much data? It depends on what you teach', '要多少数据？取决于你要教什么'),
      blocks: [
        { type: 'p', text: t(
          'Two results seem to disagree. LIMA fine-tuned a 65B model on about 1,000 carefully chosen examples and was judged as good as or better than GPT-4 in 43% of comparisons. Doubling its data of the same kind did not help[^lima]. Yet on math, multi-hop QA and code, performance keeps rising as a power law in the number of examples[^ragh].',
          '两个结果看起来互相矛盾。LIMA 只用约 1000 条精挑细选的样本微调一个 65B 模型，人评中 43% 的比较不输 GPT-4；同类数据翻倍也没有带来提升[^lima]。可是在数学、多跳问答和代码上，表现随样本数按幂律一路上升[^ragh]。') },
        { type: 'figure', src: 'ft/b/b2-lima-vs-scaling.svg', alt: t('Left: LIMA’s response quality stays flat from 2K to 32K examples. Right: GSM8K accuracy rises steadily on a log scale of examples.', '左：LIMA 的回答质量从 2K 到 32K 样本几乎不变。右：GSM8K 准确率随样本数（对数轴）稳步上升。'),
          caption: t('Format and style saturate early; skills keep scaling.', '格式和风格很早就饱和；能力则持续随数据增长。'), credit: '据 LIMA（Zhou et al., 2023）图 6 与 Raghavendra et al.（2024）表 7 的拟合重绘，数值近似' },
        { type: 'p', text: t(
          'They do not really disagree: they measure different things. A small, diverse, high-quality set is enough to teach **format and style**, and, with a strong enough base model, to draw out reasoning it already has (s1: 1,000 reasoning traces on a 32B model[^s1]). **New skills** keep improving with more data. So the question is not "how many examples" but "what am I teaching, and does the base model already have it?"',
          '其实并不矛盾，它们量的是不同的东西。少量、多样、高质量的数据足以教会**格式和风格**；底座模型够强时，还能把它本来就有的推理能力"引出来"（s1：在 32B 模型上用 1000 条推理轨迹[^s1]）。**新能力**则会随数据增多而持续提升。所以问题不是"要多少条"，而是"我要教的是什么？底座模型本来有没有？"') },
        { type: 'cite', key: 'lima', text: t('Zhou et al. (2023). LIMA: Less Is More for Alignment. NeurIPS.', 'Zhou 等（2023）。LIMA: Less Is More for Alignment。NeurIPS。'), url: 'https://arxiv.org/abs/2305.11206' },
        { type: 'cite', key: 'ragh', text: t('Raghavendra et al. (2024). Revisiting the Superficial Alignment Hypothesis.', 'Raghavendra 等（2024）。Revisiting the Superficial Alignment Hypothesis。'), url: 'https://arxiv.org/abs/2410.03717' },
        { type: 'cite', key: 's1', text: t('Muennighoff et al. (2025). s1: Simple test-time scaling.', 'Muennighoff 等（2025）。s1: Simple test-time scaling。'), url: 'https://arxiv.org/abs/2501.19393' },
      ],
    },
    // ------------------------------------------------------------------ synthetic data
    {
      id: 'synthetic', kind: 'read', chapter: t('Synthetic data', '合成数据'), title: t('Letting a model write the data', '让模型来写数据'),
      blocks: [
        { type: 'p', text: t(
          'Synthetic data is cheap and scales: ask a capable model for instructions and answers, then filter. Three ways to get the prompts:',
          '合成数据便宜，而且能大规模生产：让一个强模型写指令和回答，再做筛选。拿到提示的三种办法：') },
        { type: 'list', items: [
          t('**Bootstrap from seeds.** Self-Instruct had GPT-3 expand 175 seed tasks into about 52K instructions for itself; Alpaca used text-davinci-003 to write 52K demonstrations for under 500 US dollars[^selfinstruct][^alpaca].', '**从种子扩写。**Self-Instruct 让 GPT-3 把 175 个种子任务扩写成约 5.2 万条指令，给它自己用；Alpaca 用 text-davinci-003 写了 5.2 万条示范，花费不到 500 美元[^selfinstruct][^alpaca]。'),
          t('**Use the template.** Give an aligned model only the start of a user turn (B1’s chat template) and it writes a plausible user question by itself: Magpie[^magpie].', '**利用模板。**只给对齐过的模型一个"用户轮"的开头（B1 讲的聊天模板），它就会自己写出一个像样的用户问题：这就是 Magpie[^magpie]。'),
          t('**Vary the asker.** Generate prompts from many personas to cover more topics and styles (as in Tülu 3).', '**换提问的人。**用许多不同的人设（persona）来生成提示，覆盖更多话题和风格（Tülu 3 就这样做）。'),
        ] },
        { type: 'p', text: t('Then filter, because the model will happily write wrong, duplicated or leaked examples: deduplicate; remove anything overlapping your evaluation sets (decontamination); verify what can be verified; score the rest with an LLM judge, carefully (B3).', '然后一定要筛，因为模型会毫不犹豫地写出错误的、重复的、泄题的样本：去重；删掉与评测集重叠的内容（去污染）；能验证的就验证；其余的用大模型评委打分，并小心它的偏差（B3）。') },
        { type: 'callout', kind: 'misconception', title: t('A stronger model’s outputs are not its abilities', '强模型的输出 ≠ 强模型的能力'), body: t(
          'Models trained to imitate ChatGPT’s outputs were rated by crowd workers as competitive with it, yet closed "little to none of the gap" on factuality and on tasks not covered by the data: they copied the style[^gudibande]. Synthetic data buys format and style; capability needs verified data or RL.',
          '以模仿 ChatGPT 输出为目标训练出的模型，众包评分员觉得它们不相上下，但在事实性和数据没覆盖到的任务上，差距"几乎没有缩小"：它们学到的是风格[^gudibande]。合成数据换来的是格式和风格；能力要靠经过验证的数据或强化学习。') },
        { type: 'callout', kind: 'warning', body: t(
          'Two more risks. Training each generation only on the previous generation’s outputs loses the tails of the distribution; keeping some real data mitigates this but does not remove it[^collapse]. And a closed model’s terms of use may forbid training other models on its outputs.',
          '另外两个风险。一代代只用上一代模型的输出来训练，会丢掉分布的尾部；保留一部分真实数据可以缓解，但不能根除[^collapse]。还有，闭源模型的使用条款可能禁止用它的输出训练别的模型。') },
        { type: 'cite', key: 'selfinstruct', text: t('Wang et al. (2023). Self-Instruct. ACL.', 'Wang 等（2023）。Self-Instruct。ACL。'), url: 'https://arxiv.org/abs/2212.10560' },
        { type: 'cite', key: 'alpaca', text: t('Taori et al. (2023). Stanford Alpaca.', 'Taori 等（2023）。Stanford Alpaca。'), url: 'https://crfm.stanford.edu/2023/03/13/alpaca.html' },
        { type: 'cite', key: 'magpie', text: t('Xu et al. (2024). Magpie: Alignment Data Synthesis from Scratch.', 'Xu 等（2024）。Magpie: Alignment Data Synthesis from Scratch。'), url: 'https://arxiv.org/abs/2406.08464' },
        { type: 'cite', key: 'gudibande', text: t('Gudibande et al. (2024). The False Promise of Imitating Proprietary Language Models. ICLR.', 'Gudibande 等（2024）。The False Promise of Imitating Proprietary Language Models。ICLR。'), url: 'https://arxiv.org/abs/2305.15717' },
        { type: 'cite', key: 'collapse', text: t('Shumailov et al. (2024). AI models collapse when trained on recursively generated data. Nature.', 'Shumailov 等（2024）。AI models collapse when trained on recursively generated data。Nature。'), url: 'https://arxiv.org/abs/2305.17493' },
      ],
    },
    // ------------------------------------------------------------------ rejection sampling
    {
      id: 'rs-intro', kind: 'read', chapter: t('Rejection sampling', '拒绝采样'), title: t('Let the model write, keep what is right', '让模型自己写，留下对的'),
      blocks: [
        { type: 'p', text: t(
          'When answers can be checked automatically (math, code, a tool call that runs), the model itself can produce training data. For each problem, sample $n$ answers, keep the correct ones, fine-tune on them, and repeat with the improved model. Keeping the best of $n$ is **rejection sampling**; repeating the loop is **expert iteration**. It is cheap and stable, and it is a standard step in large recipes: Llama 3 picked the best of 10–30 samples with a reward model in each of six rounds[^llama3], and DeepSeek-R1 built about 600K reasoning examples this way[^r1].',
          '当答案能被自动判对错时（数学、代码、能跑通的工具调用），模型自己就能产出训练数据：每道题采 $n$ 个答案，留下对的，用它们微调，再用变好的模型重复。从 $n$ 个里留下最好的，叫**拒绝采样（rejection sampling）**；把这个循环反复做，叫**专家迭代（expert iteration）**。它便宜、稳定，是大型配方里的标准一步：Llama 3 在六轮训练里，每轮都用奖励模型从 10 到 30 个采样中挑最好的[^llama3]；DeepSeek-R1 用这种方法造了约 60 万条推理数据[^r1]。') },
        { type: 'figure', src: 'ft/b/b2-expert-iteration.svg', alt: t('A loop: sample n answers per problem, verify, keep the correct ones with a cap per problem, fine-tune, and sample again.', '一个循环：每道题采 n 个答案 → 验证 → 留下对的（每题有上限）→ 微调 → 再采样。'), credit: '自绘；Llama 3 与 DeepSeek-R1 的做法据原文' },
        { type: 'p', text: t('But what does the kept data look like? Before you look, guess.', '可是留下来的数据长什么样？先猜一猜。') },
        { type: 'cite', key: 'llama3', text: t('Llama Team (2024). The Llama 3 Herd of Models.', 'Llama 团队（2024）。The Llama 3 Herd of Models。'), url: 'https://arxiv.org/abs/2407.21783' },
        { type: 'cite', key: 'r1', text: t('DeepSeek-AI (2025). DeepSeek-R1. Nature 645.', 'DeepSeek-AI（2025）。DeepSeek-R1。Nature 645。'), url: 'https://arxiv.org/abs/2501.12948' },
      ],
    },
    {
      id: 'rs-predict', kind: 'checkpoint', title: t('Guess first', '先猜一猜'), skill: 'rejection-sampling', purpose: 'predict',
      prompt: t(
        'Sample 8 answers per problem and keep every correct one. The model solves 30% of the problems 90% of the time (easy), 40% of them 30% of the time (medium), and 30% of them 2% of the time (hard). In the kept data, what share comes from the hard problems?',
        '每道题采 8 个答案，留下所有对的。模型对 30% 的题有 90% 的通过率（简单），对 40% 的题有 30%（中等），对 30% 的题只有 2%（难）。留下的数据里，难题占多少？'),
      question: { type: 'choice', options: [
        { id: 'a', label: t('About 30%, like the problem set', '约 30%，和题集一样'), misconception: 'rs-data-unbiased' },
        { id: 'b', label: t('About 15%', '约 15%') },
        { id: 'c', label: t('About 5%', '约 5%') },
        { id: 'd', label: t('Under 2%', '不到 2%'), correct: true },
      ] },
      explain: t('About 1.5%. Each problem contributes about $n \\cdot p$ answers, so the data mirrors what the model can already do.', '约 1.5%。每道题大约贡献 $n \\cdot p$ 个答案，所以数据反映的是模型本来就会的东西。'),
    },
    {
      id: 'rs-world', kind: 'explore', title: t('What survives the filter', '过滤之后剩下什么'), skill: 'rejection-sampling',
      scene: vis('rejection_sampling_yield', { n: 8, cap: 'none', hard_boost: 1 }),
      prompt: t(
        'You may sample at most **1,600** answers for these 100 problems. Make the hard problems at least **10%** of the kept data. Then make at least **65%** of the hard problems appear at all, within **2,500** answers. Controls: samples per problem $n$, a cap $c$ on kept answers per problem, and extra samples for the hard problems.',
        '这 100 道题，你最多能采 **1600** 个答案。让难题至少占留下数据的 **10%**。然后，在 **2500** 个答案以内，让至少 **65%** 的难题至少出现一次。可调的是：每题采样数 $n$、每题最多留几个答案 $c$，以及给难题的额外采样。'),
      setup: (scene: any, ui, _ctx, world) => {
        on_handles(ui, () => scene.attach(ui), () => {
          const s = scene.stats();
          world.emit('rs', { n: scene.n_now(), cap: scene.cap_now(), boost: scene.boost_now(), hard: s.shares[2], budget: s.budget });
        });
      },
      goals: [
        { id: 'share', check: (s: any) => { const y = s.stats(); return y.budget <= 1600 && y.shares[2] >= 0.1; }, message: t('Within budget, the hard problems now weigh at least 10%: a cap stops easy problems from flooding the data.', '预算之内，难题的占比到了 10% 以上：每题上限阻止了简单题淹没数据。') },
        { id: 'coverage', check: (s: any) => { const y = s.stats(); return y.budget <= 2500 && y.per[2].coverage >= 0.65; }, message: t('Spending samples where the model fails covers most hard problems at a fraction of the cost of raising n everywhere.', '把采样花在模型做不对的地方，只用全面加大 n 的一小部分成本，就覆盖了大部分难题。') },
      ],
      detectors: [
        { id: 'brute', on: (e) => (e.type === 'rs' && (e.data!.n as number) >= 32 && e.data!.cap === Infinity && e.data!.boost === 1 ? { kind: 'misconception', id: 'rs-data-unbiased', message: t('More samples scale every kind of problem alike: the mix does not change.', '多采样会让各类题同比例增长：数据的构成不变。') } : null) },
      ],
      lines: [
        { text: t('Each bar is the number of answers kept for one example problem. The hard row is almost empty.', '每根柱子是一道示例题留下的答案数。"难"那一行几乎是空的。'), when: 'enter' },
        { text: t('Raising n everywhere grows every bar by the same factor: the hard share stays at about one and a half percent.', '处处加大 n，所有柱子按同样的倍数变高：难题占比还是约 1.5%。'), when: { finding: 'rs-data-unbiased' } },
        { text: t('Try the cap first: it limits what the easy problems can add.', '先试试每题上限：它限制了简单题能贡献多少。'), when: 'idle' },
        { text: t('Kept data reflects what the model can already do. Caps and targeted sampling are how you push it towards what it cannot.', '留下的数据反映的是模型本来就会的。上限和定向加采，才能把数据推向它还不会的地方。'), when: 'goal' },
      ],
      solve: (s: any, _c, w) => {
        s.n.set_value(8);
        s.cap.set_value(0);
        s.boost.set_value(2);
        w.emit('rs', {});
        s.boost.set_value(3);
        w.emit('rs', {});
      },
    },
    {
      id: 'rs-pg', kind: 'derive', title: t('Why this is reinforcement learning in disguise', '为什么说它是"伪装的强化学习"'), skill: 'rejection-sampling',
      intro: t('Keeping only correct answers and fine-tuning on them looks like plain SFT. Write down what reinforcement learning with a right/wrong reward would do, and compare. (The policy gradient itself is derived in D2; here we only use its formula.)', '只留下正确答案再用它们微调，看起来就是普通的 SFT。写出用"对/错"作奖励的强化学习会怎么做，再比较一下。（策略梯度本身在 D2 推导，这里只用它的公式。）'),
      lines: [
        { tex: 'J(\\theta) = \\mathbb{E}_{x}\\,\\mathbb{E}_{y \\sim \\pi_\\theta}\\big[r(x, y)\\big], \\qquad \\nabla J = \\mathbb{E}\\big[r \\, \\nabla \\log \\pi_\\theta(y \\mid x)\\big]', why: t('RL maximises the expected reward. Its gradient raises the log-probability of each sample in proportion to its reward.', '强化学习最大化期望奖励。它的梯度按奖励大小，抬高每个样本的对数概率。') },
        { tex: '\\hat g = \\frac{1}{n}\\sum_{i=1}^{n} r_i \\, \\nabla \\log \\pi_\\theta(y_i \\mid x), \\qquad y_i \\sim \\pi_{\\text{old}}', why: t('Estimate it with $n$ samples from the current model.', '用当前模型的 $n$ 个样本来估计它。') },
        { tex: 'r_i \\in \\{0, 1\\} \\;\\Rightarrow\\; \\hat g = \\frac{1}{n}\\sum_{i:\\, r_i = 1} \\nabla \\log \\pi_\\theta(y_i \\mid x)', why: t('With a right/wrong reward, wrong samples drop out and the correct ones get the plain log-likelihood gradient: exactly SFT on the kept answers.', '奖励只有对/错时，错的样本直接消失，对的样本得到的就是普通的对数似然梯度：这正是在留下的答案上做 SFT。') },
        { tex: '\\text{missing: } r = 0 \\text{ adds nothing; no baseline; on-policy only at } \\theta = \\theta_{\\text{old}}', why: t('What it lacks: wrong answers are never pushed down, there is no baseline (GRPO in E1 subtracts the group mean), and after the first update the samples are stale. Hence "iterate": sample again with the new model.', '它缺什么：错的答案从来不会被往下压；没有基线（E1 讲的 GRPO 会减去组内均值）；而且第一次更新之后，样本就过时了。所以要"迭代"：用新模型重新采样。') },
      ],
      blank: { line: 2, answer: '1', prompt: t('Reward of a kept (correct) sample in this sum?', '在这个求和里，被留下的（正确的）样本的奖励是多少？') },
      outro: t('ReST^EM describes the same loop as expectation-maximisation: an E-step that generates and filters, an M-step that is SFT. STaR adds "rationalisation": for problems the model fails, regenerate a solution with the correct answer as a hint (and drop the hint from the training example).', 'ReST^EM 把同一个循环描述为期望最大化（EM）：E 步生成并筛选，M 步就是 SFT。STaR 还加了"合理化"：对模型做错的题，把正确答案作为提示再生成一遍解题过程（训练样本里不保留这个提示）。'),
    },
    {
      id: 'rs-code', kind: 'code', title: t('One round of rejection sampling', '一轮拒绝采样'),
      intro: t('Sample with vLLM, check the final answer, keep at most one correct answer per problem, write the SFT file.', '用 vLLM 采样，检查最终答案，每题最多留一个正确答案，写成 SFT 数据文件。'),
      lang: 'python', code: RS_PIPELINE,
      notes: [
        { lines: [5, 5], text: t('`n=8` samples per problem at temperature 0.8: enough diversity that some attempts succeed.', '每题采 `n=8` 个，温度 0.8：要有足够的多样性，才会有一部分尝试成功。') },
        { lines: [7, 9], text: t('The verifier. Here: compare the final answer inside `\\boxed{}`. Anything that can check an answer works, from unit tests to a schema validator.', '验证器。这里是比对 `\\boxed{}` 里的最终答案。任何能判对错的东西都行，从单元测试到 schema 校验器。') },
        { lines: [16, 17], text: t('Deduplicate and cap at one answer per problem, so easy problems do not flood the data (the world before).', '去重，每题最多留一个答案，免得简单题淹没数据（前面的探索就是在讲这个）。') },
        { lines: [18, 19], text: t('Store kept answers as chats: the next SFT round trains on the assistant turn only (B1).', '把留下的答案存成对话格式：下一轮 SFT 只训练助手那一轮（B1）。') },
      ],
    },
    // ------------------------------------------------------------------ distillation
    {
      id: 'distill', kind: 'read', chapter: t('Distillation', '蒸馏'), title: t('Learning from a teacher’s answers', '向老师的答案学习'),
      blocks: [
        { type: 'p', text: t(
          'If a stronger model exists and its license allows it, the simplest way to make a small model capable is to fine-tune it on the teacher’s answers: **sequence-level distillation**[^kimrush]. It is how DeepSeek turned R1 into small models (about 800K samples), and how Qwen3 and Gemma 3 train their small models[^r1b]. At small scale it beats running RL on the small model directly:',
          '如果有更强的模型、并且许可允许，让小模型变强最简单的办法，就是用老师模型的回答去微调它：**序列级蒸馏（sequence-level distillation）**[^kimrush]。DeepSeek 用这种方法把 R1 的能力教给小模型（约 80 万条样本），Qwen3 和 Gemma 3 的小模型也这样训练[^r1b]。在小模型上，它比直接做强化学习效果更好：') },
        { type: 'figure', src: 'ft/b/b2-distill-vs-rl.svg', alt: t('AIME 2024 pass@1: distilled 32B model 72.6, RL on the same 32B base 47.0.', 'AIME 2024 pass@1：蒸馏得到的 32B 模型 72.6，同一个 32B 底座直接做强化学习 47.0。'), credit: '数据：DeepSeek-R1（DeepSeek-AI, 2025）' },
        { type: 'p', text: t('Why does it work so well? Training on the teacher’s sampled answers minimises how surprised the student is by them:', '为什么这么有效？在老师采样出的回答上训练，就是在降低学生对这些回答的"意外程度"：') },
        { type: 'math', tex: '\\mathbb{E}_{y \\sim \\pi_T}\\big[-\\log \\pi_S(y \\mid x)\\big] = H(\\pi_T) + \\mathrm{KL}(\\pi_T \\,\\Vert\\, \\pi_S)' },
        { type: 'p', text: t('$H(\\pi_T)$ does not depend on the student, so this pulls the student towards the teacher’s whole distribution (forward KL). This holds for sampled answers; with greedy or beam-search outputs, as Kim and Rush used, the student learns the teacher’s single most likely answer instead. E3 continues with logit distillation and on-policy distillation, the main pattern in 2026 lab recipes.', '$H(\\pi_T)$ 与学生无关，所以这是在把学生拉向老师的整个分布（正向 KL）。这一点对"采样"出的回答成立；如果用贪心或束搜索的输出（Kim 和 Rush 就是这样做的），学生学到的是老师最可能的那一个回答。E3 会接着讲 logit 蒸馏和在线蒸馏，后者是 2026 年各实验室配方的主流做法。') },
        { type: 'cite', key: 'kimrush', text: t('Kim & Rush (2016). Sequence-Level Knowledge Distillation. EMNLP.', 'Kim & Rush（2016）。Sequence-Level Knowledge Distillation。EMNLP。'), url: 'https://arxiv.org/abs/1606.07947' },
        { type: 'cite', key: 'r1b', text: t('DeepSeek-AI (2025). DeepSeek-R1 (distilled models, Table of AIME results).', 'DeepSeek-AI（2025）。DeepSeek-R1（蒸馏模型与 AIME 结果）。'), url: 'https://arxiv.org/abs/2501.12948' },
      ],
    },
    // ------------------------------------------------------------------ continued pretraining
    {
      id: 'cpt-predict', kind: 'checkpoint', chapter: t('Domain knowledge', '领域知识'), title: t('Guess first', '先猜一猜'), skill: 'cpt-vs-sft', purpose: 'predict',
      prompt: t('A company turns 300 internal documents into 2,000 question–answer pairs and fine-tunes on them. Afterwards, asked about those documents, the model most likely…', '一家公司把 300 份内部文档改写成 2000 组问答，然后用它们微调。之后问到这些文档的内容，模型最可能……'),
      question: { type: 'choice', options: [
        { id: 'a', label: t('answers reliably, like a database', '像数据库一样可靠地回答'), misconception: 'ft-injects-knowledge' },
        { id: 'b', label: t('answers in the right style, but invents facts more often than before', '回答的风格对了，但比以前更常编造事实'), correct: true },
        { id: 'c', label: t('refuses to answer', '拒绝回答') },
        { id: 'd', label: t('is unchanged', '和原来一样') },
      ] },
      explain: t('Facts the model did not know are learned slowly, and once learned, hallucination rises roughly linearly (Gekhman et al. 2024). The next page says what works instead.', '模型原本不知道的事实学得很慢；一旦学会，幻觉也近似线性增加（Gekhman 等，2024）。下一页讲什么办法管用。'),
    },
    {
      id: 'cpt', kind: 'read', title: t('Putting knowledge into weights: continued pretraining', '把知识放进权重：继续预训练'),
      blocks: [
        { type: 'p', text: t(
          'Most of the time, knowledge that changes or must be cited belongs in retrieval (A2). You need it in the weights only when the model must work **closed-book**: offline, without a retriever, or with a whole domain language to learn. Then the tool is **continued pretraining (CPT)**: the plain next-token loss on raw domain text, whole sequence, no chat template, and SFT afterwards.',
          '大多数时候，会变化或需要引用出处的知识应该放进检索（A2）。只有当模型必须**闭卷**工作时（离线、没有检索器，或者要学一整套领域语言），才需要把知识放进权重。这时的工具是**继续预训练（continued pretraining, CPT）**：在原始领域文本上做普通的下一个 token 预测，整段都算 loss，不用聊天模板，之后再做 SFT。') },
        { type: 'list', items: [
          t('**Why not SFT on Q&A?** Unknown facts are learned slowly and raise hallucination once learned[^gekhman]. For injecting knowledge, retrieval beat unsupervised fine-tuning, and paraphrased repetitions of each fact helped[^ovadia].', '**为什么不直接在问答上做 SFT？**模型不知道的事实学得慢，学会以后还会增加幻觉[^gekhman]。在注入知识这件事上，检索胜过无监督微调；同一事实的多种改写有帮助[^ovadia]。'),
          t('**Paraphrase on purpose.** Knowledge is extractable later only if it appeared in varied forms during training[^physics]. Synthetic CPT does this deliberately: EntiGraph turned a 1.3M-token corpus into 455M tokens of rewritten text and recovered 80% of the gain of putting the documents in context[^entigraph].', '**有意识地改写。**只有在训练时以多种形式出现过的知识，之后才"取得出来"[^physics]。合成继续预训练就是有意这样做：EntiGraph 把 130 万 token 的语料改写扩充成 4.55 亿 token，取回了"把文档放进上下文"的效果提升的 80%[^entigraph]。'),
          t('**Mix in chat data, and expect a cost.** Training a post-trained model only on documents dropped its instruction following from 85% to 45%; a 70/30 document/chat mix kept 79%; adding on-policy distillation afterwards restored 83%. No mix kept the original 85%[^tm].', '**混入对话数据，并且要预期有代价。**只用文档继续训练一个已经后训练过的模型，它的指令遵循从 85% 掉到 45%；文档和对话按 7:3 混合，保住了 79%；之后再做在线蒸馏，恢复到 83%。没有哪种配比能保住原来的 85%[^tm]。'),
        ] },
        { type: 'figure', src: 'ft/b/b2-cpt-pipeline.svg', alt: t('Base model, then continued pretraining on 70% domain documents and 30% chat, then SFT; bars of IF-eval and internal QA for four setups.', '基座 → 继续预训练（70% 领域文档 + 30% 对话）→ SFT；四种设置下 IF-eval 和内部问答的柱状图。'),
          caption: t('Qwen3-8B mid-trained on internal documents. Knowledge goes up, instruction following goes down; mixing chat data limits the damage.', 'Qwen3-8B 在内部文档上做中期训练：知识上去了，指令遵循掉下来；混入对话数据能减少损失。'), credit: '自绘流程；数据：Thinking Machines《On-Policy Distillation》（2025）' },
        { type: 'details', summary: t('A new vocabulary: extending the tokenizer', '换一套词汇：扩充词表'), blocks: [
          { type: 'p', text: t('When a new language or domain is split into many tiny tokens, you can add tokens: `tokenizer.add_tokens(...)`, then `model.resize_token_embeddings(len(tokenizer))`. Since transformers 4.46 the new rows start at the mean of the old ones. Train `embed_tokens` and `lm_head` too, with a 2–10× smaller learning rate than the rest (Unsloth’s CPT guide suggests 5e-6 against 5e-5). New tokens need plenty of text before they are useful.', '当一门新语言或一个领域被切成很多细碎的 token 时，可以扩充词表：`tokenizer.add_tokens(...)`，再 `model.resize_token_embeddings(len(tokenizer))`。从 transformers 4.46 起，新行会用旧行的均值初始化。`embed_tokens` 和 `lm_head` 也要参与训练，学习率比其余部分小 2 到 10 倍（Unsloth 的 CPT 指南建议 5e-6 对 5e-5）。新 token 要见过足够多的文本才派得上用场。') },
        ] },
        { type: 'cite', key: 'gekhman', text: t('Gekhman et al. (2024). Does Fine-Tuning LLMs on New Knowledge Encourage Hallucinations? EMNLP.', 'Gekhman 等（2024）。Does Fine-Tuning LLMs on New Knowledge Encourage Hallucinations? EMNLP。'), url: 'https://arxiv.org/abs/2405.05904' },
        { type: 'cite', key: 'ovadia', text: t('Ovadia et al. (2023). Fine-Tuning or Retrieval? Comparing Knowledge Injection in LLMs.', 'Ovadia 等（2023）。Fine-Tuning or Retrieval? Comparing Knowledge Injection in LLMs。'), url: 'https://arxiv.org/abs/2312.05934' },
        { type: 'cite', key: 'physics', text: t('Allen-Zhu & Li (2023). Physics of Language Models: Part 3.1.', 'Allen-Zhu & Li（2023）。Physics of Language Models: Part 3.1。'), url: 'https://arxiv.org/abs/2309.14316' },
        { type: 'cite', key: 'entigraph', text: t('Yang et al. (2025). Synthetic continued pretraining. ICLR.', 'Yang 等（2025）。Synthetic continued pretraining。ICLR。'), url: 'https://arxiv.org/abs/2409.07431' },
        { type: 'cite', key: 'tm', text: t('Thinking Machines (2025). On-Policy Distillation (section "Distillation for personalization").', 'Thinking Machines（2025）。On-Policy Distillation（"Distillation for personalization"一节）。'), url: 'https://thinkingmachines.ai/blog/on-policy-distillation/' },
      ],
    },
    // ------------------------------------------------------------------ tool calling
    {
      id: 'tools', kind: 'read', chapter: t('Tool calls and agents', '工具调用与智能体'), title: t('Data for a model that calls tools', '会调用工具的模型需要什么数据'),
      blocks: [
        { type: 'p', text: t(
          'A tool-calling model must learn three things: when to call a tool, how to write the call so a program can parse it, and how to use the result. The data is a conversation with two new parts, the assistant’s **tool call** and the **tool result** returned by the environment:',
          '一个会调用工具的模型要学会三件事：什么时候调用工具，怎样把调用写成程序能解析的格式，以及怎样用好返回的结果。它的数据就是一段对话，多了两种新内容：助手发出的**工具调用（tool call）**，以及环境返回的**工具结果（tool result）**：') },
        { type: 'code', lang: 'json', code: TOOL_EXAMPLE, caption: t('Rendered with `tokenizer.apply_chat_template(messages, tools=tools, tokenize=False)`.', '用 `tokenizer.apply_chat_template(messages, tools=tools, tokenize=False)` 渲染。') },
        { type: 'p', text: t('Which of these should the loss grade? Apply B1’s rule: grade what the model should learn to produce. The tool result is not the model’s output; it is the world’s. Try it on the real rendering.', '哪些部分该算 loss？用 B1 的规则：只给模型应该学会说出的内容打分。工具结果不是模型的输出，而是外部世界的输出。在真实的渲染结果上试一试。') },
      ],
    },
    {
      id: 'tool-world', kind: 'explore', title: t('Mask a tool-calling conversation', '给工具调用对话加掩码'), skill: 'tool-sft-data',
      scene: vis('token_loss_mask', { sample: 'tool_call', start: 'all' }),
      prompt: t('This is the conversation above, rendered with the Qwen2.5 template. Move every part to **trained** or **masked** so that the loss grades exactly what the assistant should learn to produce.', '这是上面那段对话用 Qwen2.5 模板渲染的结果。把每一部分移到**训练**或**掩掉**，让 loss 恰好只给助手应该学会说出的内容打分。'),
      setup: (scene: any, ui, _ctx, world) => {
        on_handles(ui, () => scene.attach_cards(ui), (i) => {
          const tr = (k: string) => scene.parts.some((p: any, j: number) => p.kind === k && scene.trained(j));
          world.emit('card', { kind: scene.parts[i].kind, trained: scene.trained(i), sys: tr('S'), user: tr('U'), result: tr('R') });
        });
      },
      goals: [{ id: 'assistant-only', check: (s: any) => s.assistant_only() && s.lam.get_value() === 0, message: t('The tool call, both answers’ end tokens and the final answer are trained; the tool result, like the user, is context.', '工具调用、两个结束 token 和最终回答被训练；工具结果和用户提问一样，只是上下文。') }],
      detectors: [
        { id: 'result-trained', on: (e) => (e.type === 'card' && !e.data!.sys && !e.data!.user && e.data!.result ? { kind: 'misconception', id: 'tool-output-trained' } : null) },
        { id: 'end-masked', on: (e) => (e.type === 'card' && e.data!.kind === 'E' && !e.data!.trained ? { kind: 'misconception', id: 'pad-eos-harmless' } : null) },
      ],
      lines: [
        { text: t('Eight parts this time: the assistant speaks twice, once to call the tool and once to answer.', '这次有八个部分：助手说了两次话，一次是调用工具，一次是回答。'), when: 'enter' },
        { text: t('The tool result is still trained. A model trained on it learns to predict what tools return: to make up results.', '工具结果还在训练那一行。在它上面训练，模型就会学着预测工具会返回什么，也就是学会编造结果。'), when: { finding: 'tool-output-trained' } },
        { text: t('Each assistant turn ends with its own end token, and both must be trained.', '助手的每一轮都以自己的结束 token 收尾，两个都要训练。'), when: { finding: 'pad-eos-harmless' } },
        { text: t('Which parts were written by the assistant? Those are the ones to grade.', '哪些部分是助手写的？要打分的就是这些。'), when: 'idle' },
        { text: t('Right. The same rule will mask environment outputs in agent RL later in the course.', '对。课程后面讲智能体强化学习时，同样的规则会用来掩掉环境的输出。'), when: 'goal' },
      ],
      solve: (s: any, _c, w) => {
        s.apply((p: any) => p.kind === 'A' || p.kind === 'E' || p.kind === 'C');
        s.lam.set_value(0);
        w.emit('card', { kind: 'S', trained: false, sys: false, user: false, result: false });
      },
    },
    {
      id: 'tools-data', kind: 'read', title: t('Where tool-calling data comes from', '工具调用数据从哪来'),
      blocks: [
        { type: 'list', items: [
          t('**Run it.** Let a strong model work in a sandbox with real or simulated tools; keep the trajectories whose calls parse, run, and solve the task. That is rejection sampling with the environment as the verifier. Kimi K2’s post-training is built on large-scale agentic data synthesis of this kind.', '**跑出来。**让一个强模型在沙盒里用真实或模拟的工具完成任务，只留下那些调用能解析、能运行、并且解决了任务的轨迹。这就是以环境为验证器的拒绝采样。Kimi K2 的后训练就建立在这类大规模智能体数据合成之上。'),
          t('**Serve it the same way.** The model learns the exact text format of a call (Qwen2.5 writes `<tool_call>` JSON); the serving engine must parse that format (vLLM: `--enable-auto-tool-choice --tool-call-parser hermes` for Qwen2.5).', '**推理时用同一种格式。**模型学到的是调用的确切文本格式（Qwen2.5 写的是 `<tool_call>` 里的 JSON）；推理引擎必须能解析这种格式（vLLM 上，Qwen2.5 用 `--enable-auto-tool-choice --tool-call-parser hermes`）。'),
          t('**Do not cut a call in half.** Agent trajectories are long; when truncating to `max_length`, cut between turns, never inside a call.', '**不要把一次调用截成两半。**智能体轨迹很长；截断到 `max_length` 时，要在两轮之间截，绝不能截在调用的中间。'),
        ] },
        { type: 'figure', src: 'ft/b/b2-tool-call-mask.svg', alt: t('The tool-calling conversation as template text, with the assistant’s call, end tokens and final answer marked as trained and the system, user and tool result as masked.', '工具调用对话的模板文本：助手的调用、结束 token 和最终回答标为训练；系统、用户和工具结果标为掩掉。'), credit: '自绘；用 Qwen2.5 的 chat_template 渲染核对' },
      ],
    },
    // ------------------------------------------------------------------ checks
    {
      id: 'q-coverage', kind: 'checkpoint', chapter: t('Check', '检验'), title: t('How many problems appear?', '有多少题能出现？'), skill: 'rejection-sampling', purpose: 'check',
      prompt: t('A kind of problem has pass rate 0.05. You sample 16 answers per problem. What fraction of these problems gets at least one correct answer?', '某类题的通过率是 0.05。每题采 16 个答案。这类题里有多大比例至少得到一个正确答案？'),
      question: { type: 'number', answer: 1 - 0.95 ** 16, tolerance: 0.02, wrong: [{ answer: 0.8, feedback: t('Probabilities of separate tries do not add up. Use 1 − P(all 16 wrong).', '各次尝试的概率不能直接相加。用 1 − P(16 次全错)。') }] },
      explain: t('$1 - 0.95^{16} \\approx 0.56$.', '$1 - 0.95^{16} \\approx 0.56$。'),
    },
    {
      id: 'q-diagnose', kind: 'checkpoint', title: t('Better style, worse facts', '风格更好，事实更差'), skill: 'synthetic-data', purpose: 'check',
      prompt: t('A team generated 50,000 customer-service conversations with a strong model and fine-tuned on them. Reviewers love the tone, but the model now states wrong product details more often than before. The most likely reason?', '一个团队用强模型生成了 5 万段客服对话，并在上面微调。评审很喜欢它的语气，但模型现在比以前更常说错产品细节。最可能的原因是？'),
      question: { type: 'choice', options: [
        { id: 'a', label: t('The data taught confident answers about facts the model does not know: style transferred, knowledge did not', '数据教会了它对自己不知道的事实也自信作答：风格学到了，知识没有'), correct: true, feedback: t('Imitation copies style (Gudibande), and fitting unknown facts raises hallucination (Gekhman). Ground the facts with retrieval and filter out examples whose facts the model cannot know.', '模仿学到的是风格（Gudibande），硬拟合未知事实会增加幻觉（Gekhman）。用检索提供事实，并过滤掉模型不可能知道其事实的样本。') },
        { id: 'b', label: t('The learning rate was too low', '学习率太低'), misconception: 'more-data-better' },
        { id: 'c', label: t('50,000 is too few; double it', '5 万条太少，翻倍'), misconception: 'more-data-better' },
        { id: 'd', label: t('They forgot to pack the examples', '忘了打包样本') },
      ] },
    },
    {
      id: 'q-case', kind: 'checkpoint', title: t('A law firm', '一家律所'), skill: 'sft-data-sources', purpose: 'check',
      prompt: t('A law firm has 100,000 internal contracts. It wants a model that writes contract reviews in the firm’s fixed format **and** cites the exact clauses. Propose where the knowledge and the format should come from, how you would make the training data, and the main risk.', '一家律所有 10 万份内部合同。它希望模型按事务所固定的格式写合同审查意见，**并且**引用具体条款。请说明：知识和格式分别从哪来，训练数据怎么造，主要风险是什么。'),
      question: { type: 'text', placeholder: t('Knowledge from…, format from…, data…, risk…', '知识来自……，格式来自……，数据……，风险……'), rubric: {
        key_points: [
          t('Clauses come from retrieval (they must be cited and they change), not from the weights.', '条款来自检索（要能引用，而且会变），不是来自权重。'),
          t('The format comes from SFT, on reviews written over retrieved clauses (e.g. drafted by a strong model and checked by lawyers).', '格式来自 SFT，训练样本是在检索到的条款上写成的审查意见（例如由强模型起草、律师审核）。'),
          t('Risk: the model learns the style but invents clauses or facts; or client data and model licenses do not allow this use.', '风险：模型学到了风格却编造条款或事实；或者客户数据、模型许可不允许这样用。'),
        ],
        model_answer: t('Keep the clauses in retrieval so they can be cited and updated; teach the review format with SFT on examples written over retrieved clauses, drafted by a strong model and checked by lawyers. Risks: confident invented clauses (style without knowledge), and data or license restrictions. Continued pretraining only if the legal language is far from the base model and there is a lot of text, mixed with chat data.', '条款放在检索里，便于引用和更新；用 SFT 教审查意见的格式，训练样本在检索到的条款上写成，由强模型起草、律师审核。风险：自信地编造条款（有风格没知识），以及数据或许可的限制。只有当法律语言和底座模型差得很远、并且文本量很大时，才考虑继续预训练，而且要混入对话数据。'),
        min_points: 2,
      } },
    },
    {
      id: 'q-explain', kind: 'checkpoint', title: t('Explain it', '解释一下'), skill: 'rejection-sampling', purpose: 'check',
      prompt: t('In one or two sentences: how is "SFT on the correct samples" related to policy-gradient RL with a right/wrong reward, and what does it leave out?', '用一两句话说明："只在正确样本上做 SFT"和用"对/错"作奖励的策略梯度强化学习是什么关系？它缺了什么？'),
      question: { type: 'text', placeholder: t('It equals…, but it lacks…', '它等于……，但缺了……'), rubric: {
        key_points: [
          t('With a 0/1 reward, the policy-gradient estimate at the sampling model is exactly the log-likelihood gradient of the correct samples.', '奖励为 0/1 时，在采样模型处的策略梯度估计，正好就是正确样本的对数似然梯度。'),
          t('It lacks a negative signal for wrong answers (and a baseline), and the samples go stale after one update, so it has to be iterated.', '它缺少对错误答案的负信号（以及基线），而且一次更新后样本就过时了，所以要迭代。'),
        ],
        model_answer: t('With a right/wrong reward, the policy gradient at the sampling model keeps only the correct samples’ log-likelihood gradients, which is SFT on them. It never pushes wrong answers down, has no baseline, and is only on-policy for one step, hence expert iteration.', '奖励只有对/错时，在采样模型处的策略梯度只剩正确样本的对数似然梯度，也就是在它们上做 SFT。它从不压低错误答案，没有基线，而且只在第一步是在线的，所以要做专家迭代。'),
        min_points: 2,
      } },
    },
    // ------------------------------------------------------------------ how to choose
    {
      id: 'choose', kind: 'read', chapter: t('How to choose', '怎么选'), title: t('Pick the data source first', '先选数据来源'),
      blocks: choose_card({
        upto: 'B2', highlight: 'S,C3,K5', card: 'B2',
        rule: t('If answers can be checked automatically, start with rejection sampling or expert iteration (cap per problem, extra samples where the model fails) before RL. If a stronger teacher exists and its license allows, sequence-level distillation is the shortest path to a capable small model. If the domain language is far from the base model and you have lots of text, do continued pretraining with chat data mixed in, then SFT; if facts must be cited or change, use retrieval.', '如果答案能自动判对错，先做拒绝采样或专家迭代（每题设上限，在模型做不对的地方加采），再考虑强化学习。如果有更强的老师、并且许可允许，序列级蒸馏是让小模型变强的捷径。如果领域语言和底座差得远、又有大量文本，就做继续预训练（混入对话数据），再做 SFT；如果事实需要引用或会变化，就用检索。'),
        counter: t('"We have a few hundred documents; fine-tune so the model remembers them." That is a retrieval problem, not CPT or SFT. And continuing pretraining on documents alone dropped instruction following from 85% to 45%.', '"我们有几百份文档，微调一下让模型记住。"这是检索的问题，不是继续预训练或 SFT 的问题。而且只用文档继续预训练，指令遵循从 85% 掉到了 45%。'),
      }),
    },
  ],
};
