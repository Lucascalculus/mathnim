// A1 "Five ways to make a model do something" (让模型做事的五种办法).
// Plan: docs/lessons/llm-finetuning/part-a-map-rag.md (A1). Starts from "when
// not to fine-tune", then: two levers (context vs weights), what fine-tuning
// can and cannot teach, the signal you have decides the method, and the cost
// math (one world: the break-even of a fine-tuned small model).
import type { Lesson } from '@mathnim/core';
import { card_page, case_group, figure, hold, map_scene, OWN, T, vis, watch } from '../f/kit';

const COST = { requests_per_day: 30, hide_nstar: true, controls: 'volume' };
const SIG = case_group('a1-sig', T('Which signal do you have?', '你手里有哪种信号？'), [{ type: 'p', text: T('For each situation, pick the method the signal points to.', '每个情境，选出信号指向的方法。') }]);

export const lesson: Lesson = {
  id: 'ft-a1',
  title: T('Five ways to make a model do something', '让模型做事的五种办法'),
  description: T(
    'Before choosing a fine-tuning method: what each way of steering a model changes, what signal it needs, and what it costs.',
    '在挑微调方法之前，先弄清每种办法改的是什么、需要什么信号、要花多少钱。',
  ),
  mode: 'essay',
  skills: [
    { id: 'a1-when-not', name: T('Know when not to fine-tune', '知道什么时候不该微调') },
    { id: 'a1-levers', name: T('Context vs weights', '上下文与权重') },
    { id: 'a1-signals', name: T('The signal decides the method', '信号决定方法'), prerequisites: ['a1-levers'] },
    { id: 'a1-costs', name: T('Break-even of a fine-tuned model', '微调的持平点'), prerequisites: ['a1-levers'] },
    { id: 'a1-map', name: T('The first questions of the decision map', '决策图的前几问'), prerequisites: ['a1-when-not', 'a1-signals'] },
  ],
  misconceptions: [
    { id: 'ft-is-default', description: T('Building with LLMs means fine-tuning; prompting is for amateurs.', '做大模型应用就该微调，提示词是业余做法。') },
    { id: 'ft-injects-knowledge', description: T('To make a model know new facts, fine-tune it on them.', '要让模型知道新东西，就拿这些资料去微调。') },
    { id: 'llm-for-everything', description: T('Classification and routing should also use (or fine-tune) a generative LLM.', '分类、路由这类任务，也该用（或微调）生成式大模型。') },
    { id: 'rl-strictly-better', description: T('Reinforcement learning is the most advanced method, so it is always the best.', '强化学习最高级，所以总是最好。') },
    { id: 'ft-always-cheaper', description: T('A fine-tuned model with a shorter prompt always saves money.', '微调以后提示变短，一定更省钱。') },
    { id: 'cache-ignored', description: T('Prompt caching does not change whether fine-tuning pays off.', '提示缓存不影响微调划不划算。') },
  ],
  steps: [
    // ---------------------------------------------------------------- 1. when not to fine-tune
    {
      id: 'guess', kind: 'checkpoint', skill: 'a1-when-not', purpose: 'predict', chapter: T('Before fine-tuning', '先别急着微调'),
      title: T('A guess first', '先猜一下'),
      prompt: T('Of the teams building AI applications, about how many change the model\'s weights (fine-tune)?', '在做 AI 应用的团队里，你猜大约有多少在改模型的权重（做微调）？'),
      question: {
        type: 'choice', options: [
          { id: 'a', label: T('about 10%', '约 10%') },
          { id: 'b', label: T('about 25%', '约 25%'), correct: true },
          { id: 'c', label: T('about 50%', '约 50%'), misconception: 'ft-is-default' },
          { id: 'd', label: T('about 80%', '约 80%'), misconception: 'ft-is-default' },
        ],
      },
      explain: T('In a 2026 survey of 1,053 teams about 26% fine-tune; about 80% use prompting. The next page shows the whole picture.', '2026 年对 1,053 个团队的调查里，约 26% 做微调，约 80% 用提示词。下一页是完整的数字。'),
    },
    {
      id: 'when-not', kind: 'read', title: T('Start with how you will know it works', '先想清楚：怎么知道它做好了'),
      blocks: [
        { type: 'p', text: T(
          'You have a model and a task you want done well. The first question is not "which fine-tuning method?" but **"how will I know it is done well?"** Without a set of real examples you can score, no method can be chosen - or shown to work.',
          '你手上有一个模型，想让它把一件事做好。第一个问题不是"用哪种微调"，而是**"怎么知道它做好了"**。没有一组能打分的真实样例，任何方法都没法选，也没法证明有效。',
        ) },
        { type: 'p', text: T(
          'The second: there are two places to change what a model does - what it **reads** on each request (the prompt, examples, documents), or its **weights**. Most teams never touch the weights.',
          '第二个问题：改变模型行为的地方有两个。一是它每次**读到的内容**：提示词、示例、文档；二是它的**权重**。大多数团队从来不碰权重。',
        ) },
        figure('ft/a/survey-methods',
          T('Bar chart: prompting 80%, tool-use tuning 59%, RAG 49%, fine-tuning 26%, reinforcement learning 22%, synthetic data 19%.', '条形图：提示词 80%，工具使用调优 59%，RAG 49%，微调 26%，强化学习 22%，合成数据 19%。'),
          T('Self-reported, several answers allowed. "Tool-use tuning" may not mean training weights.', '自报数据，可多选。"工具使用调优"不一定指改权重。'),
          'Notion × Amplify × Vercel AI engineering survey 2026 (research-adoption.md)'),
        { type: 'p', text: T(
          'Even a fine-tuning provider agrees: in 2026 OpenAI began closing its self-serve fine-tuning to new users, reportedly because newer models follow instructions well enough with prompting alone[^openai].',
          '连提供微调的平台也这么看：2026 年 OpenAI 开始关闭自助微调、不再接受新用户，据报道理由是新模型听指令的能力已经足够，靠提示词就能解决[^openai]。',
        ) },
        { type: 'callout', kind: 'note', title: T('Do not fine-tune yet if...', '先别微调，如果……'), body: T(
          '1) you have no evaluation set; 2) you have not seriously tried instructions, examples and the right context; 3) what is missing is knowledge that changes (prices, policies); 4) the strongest model already passes and only the bill is too high - then do the cost math first (this lesson, section 4).',
          '1）还没有评测集；2）还没认真试过指令、示例和合适的上下文；3）缺的是会变的知识（价格、政策）；4）最强的模型已经过关，只是太贵——那就先算账（本课第 4 节）。',
        ) },
        { type: 'cite', key: 'openai', text: T('OpenAI model-optimization guide (wind-down notice); reason from secondary reporting (Tessl)', 'OpenAI model-optimization 指南（关闭公告）；理由见二手报道（Tessl）'), url: 'https://developers.openai.com/api/docs/guides/model-optimization' },
      ],
    },
    {
      id: 'levers', kind: 'read', title: T('Two levers: context and weights', '两根杠杆：上下文和权重'),
      blocks: [
        figure('ft/a/two-levers', T('Left: context, rebuilt for every request. Right: weights, changed by training, affecting every later request.', '左：上下文，每次请求重新拼装。右：权重，靠训练改动，影响之后所有请求。'), undefined, OWN),
        { type: 'p', text: T(
          'Changing the **context** is like handing someone notes before each task: it acts on this request only, takes effect at once, and is undone by removing the notes. Changing the **weights** is like changing the person: it acts on every later request, including ones you never tested.',
          '改**上下文**，像是每次做事前递给对方一张便条：只影响这一次，立刻生效，拿走便条就撤销了。改**权重**，像是改变这个人本身：影响之后的每一次，包括你没测过的那些。',
        ) },
        { type: 'table', head: [T('aspect', '方面'), T('context (prompt, RAG)', '上下文（提示词、RAG）'), T('weights (fine-tuning)', '权重（微调）')], rows: [
          [T('takes effect', '生效'), T('at once', '立刻'), T('after training', '训练之后')],
          [T('reaches', '影响范围'), T('this request', '这一次请求'), T('every later request', '之后所有请求')],
          [T('undo', '撤回'), T('remove the text', '删掉那段文字'), T('retrain or roll back', '重训或回滚')],
          [T('costs', '花费'), T('tokens on every request', '每次请求的 token'), T('training once, hosting', '一次训练，加上托管')],
          [T('side effects', '副作用'), T('none outside the request', '只影响这一次'), T('forgetting, weaker safety', '遗忘、安全性下降')],
        ] },
        { type: 'p', text: T(
          'The side effects are real: fine-tuning on ordinary, benign data can weaken a model\'s safety behaviour[^qi]. Part B shows how to measure and limit this.',
          '副作用是真实存在的：即使用正常、无害的数据微调，也可能削弱模型的安全行为[^qi]。B 部分会讲怎么测、怎么减轻。',
        ) },
        { type: 'cite', key: 'qi', text: T('Qi et al., Fine-tuning aligned language models compromises safety, ICLR 2024', '出处：Qi et al., Fine-tuning aligned language models compromises safety, ICLR 2024'), url: 'https://arxiv.org/abs/2310.03693' },
      ],
    },
    // ---------------------------------------------------------------- 2. can fine-tuning add knowledge?
    {
      id: 'faq-predict', kind: 'checkpoint', skill: 'a1-levers', purpose: 'predict', chapter: T('What fine-tuning teaches', '微调能教会什么'),
      title: T('500 FAQ answers', '500 条 FAQ'),
      prompt: T(
        'A company fine-tunes an open chat model on 500 question-answer pairs from its internal FAQ. A user then asks for the specs of a new product that is not in the FAQ. What is most likely?',
        '一家公司用 500 条内部 FAQ 问答对，对一个开源对话模型做了 SFT。上线后，有用户问一款 FAQ 里没有的新产品参数。最可能发生什么？',
      ),
      question: {
        type: 'choice', options: [
          { id: 'a', label: T('It says it does not know.', '模型回答"不知道"。') },
          { id: 'b', label: T('It answers fluently, in the FAQ\'s style - with made-up specs.', '模型用 FAQ 的口吻流畅作答，参数是编的。'), correct: true },
          { id: 'c', label: T('It answers correctly: it has learned the company\'s knowledge.', '模型答对了，因为它学会了公司的知识。'), misconception: 'ft-injects-knowledge' },
          { id: 'd', label: T('It starts refusing every question.', '模型开始拒答所有问题。') },
        ],
      },
    },
    {
      id: 'knowledge', kind: 'read', title: T('Fine-tuning teaches form more easily than facts', '微调更容易教会"怎么说"，而不是"知道什么"'),
      blocks: [
        { type: 'p', text: T(
          'The FAQ model learns the **style** of the answers quickly. Facts are another matter. When a model is fine-tuned on facts it did not already know, it learns them much more slowly than facts it knew - and once it does fit them, it starts to make things up more often[^gekhman]. For injecting knowledge, putting the documents into the context (RAG) beat fine-tuning on them[^ovadia].',
          'FAQ 模型很快学会了回答的**口吻**。事实就是另一回事了。用模型原本不知道的事实去微调，它学得比已知事实慢得多；而一旦学会，它编造内容的情况反而增多[^gekhman]。要把知识交给模型，把文档放进上下文（RAG）的效果胜过拿文档去微调[^ovadia]。',
        ) },
        { type: 'p', text: T(
          'What *does* change when a base model becomes a chat model? Below, a chat model answered a question; for every token of its answer we asked the base model, given the same text so far, where it would rank that token. Most tokens were already the base model\'s first choice; the changes cluster in style and phrasing.',
          '那基座模型变成对话模型时，到底改了什么？下图中，对话模型回答了一个问题；对回答里的每个 token，我们问基座模型：在同样的上文下，它会把这个 token 排第几。大多数 token 本来就是基座模型的首选，改动集中在语气和措辞上。',
        ) },
        figure('ft/a/urial-shift',
          T('Each token of a chat model\'s answer, coloured by the rank the base model gives it: most are grey (the base model\'s top choice).', '对话模型回答里的每个 token，按基座模型给它的排名上色：大多数是灰色（基座模型的首选）。'),
          T('Real data: Qwen2.5-0.5B-Instruct answers, Qwen2.5-0.5B ranks (tools/ft-data/af/urial_shift.py). A tiny model, one prompt: an illustration of the finding, not a measurement of it. The answer itself may be inaccurate.', '真实数据：回答来自 Qwen2.5-0.5B-Instruct，排名来自 Qwen2.5-0.5B（tools/ft-data/af/urial_shift.py）。小模型、一个问题：用来示意结论，不是对结论的测量。回答内容本身未必准确。'),
          'Method: Lin et al., URIAL (arXiv:2312.01552)'),
        { type: 'callout', kind: 'open', title: T('An open question', '一个开放问题'), body: T(
          'This is not settled. Gains in maths, code and multi-step reasoning keep growing with more fine-tuning data, so "alignment is only style" is too simple[^raghavendra]; and practitioners do teach domain knowledge with enough varied, repeated data. A fair summary: fine-tuning *can* add knowledge, but it needs many paraphrased repetitions and risks more hallucination - for facts that change, use the context.',
          '这一点还有争论。数学、代码、多步推理这类能力，会随微调数据增多而持续提升，所以"对齐只改风格"的说法过于简单[^raghavendra]；实践中也有人用足够多、反复改写的数据教会模型领域知识。比较公允的说法是：微调*可以*加知识，但需要大量改写过的重复数据，而且有幻觉风险；会变化的事实，放进上下文。',
        ) },
        { type: 'cite', key: 'gekhman', text: T('Gekhman et al., Does fine-tuning LLMs on new knowledge encourage hallucinations? EMNLP 2024', '出处：Gekhman et al., Does fine-tuning LLMs on new knowledge encourage hallucinations? EMNLP 2024'), url: 'https://arxiv.org/abs/2405.05904' },
        { type: 'cite', key: 'ovadia', text: T('Ovadia et al., Fine-tuning or retrieval? Comparing knowledge injection in LLMs', '出处：Ovadia et al., Fine-tuning or retrieval? Comparing knowledge injection in LLMs'), url: 'https://arxiv.org/abs/2312.05934' },
        { type: 'cite', key: 'raghavendra', text: T('Raghavendra et al. 2024, Revisiting the superficial alignment hypothesis', '出处：Raghavendra et al. 2024, Revisiting the superficial alignment hypothesis'), url: 'https://arxiv.org/abs/2410.03717' },
      ],
    },
    // ---------------------------------------------------------------- 3. the signal decides the method
    {
      id: 'signals', kind: 'read', chapter: T('Which method', '用哪种方法'), title: T('The signal you have decides the method', '手里有什么信号，就用什么方法'),
      blocks: [
        { type: 'p', text: T(
          'Every way of changing the weights learns from some **signal**. Which one you can produce is usually what decides the method - not which method sounds most advanced.',
          '每一种改权重的方法，都要从某种**信号**里学。你能拿出哪种信号，往往就决定了用哪种方法，而不是看哪种方法听起来最先进。',
        ) },
        figure('ft/a/signal-method', T('Table: documents → context; labels → encoder classifier; demonstrations → SFT; comparisons → preference optimization; verifier → RLVR; teacher → distillation.', '表：文档 → 上下文；标签 → 编码器分类模型；示范 → SFT；比较 → 偏好优化；验证器 → RLVR；老师 → 蒸馏。'), undefined, { en: 'drawn for this course, after Lambert, RLHF book', zh: '本课绘制，参考 Lambert《RLHF》一书' }),
        { type: 'list', items: [
          T('**SFT** (supervised fine-tuning): you show good answers and the model learns to imitate them - the workhorse of fine-tuning, usually with LoRA (part B).', '**SFT**（监督微调）：给出好的回答，让模型模仿。它是微调的主力，通常配合 LoRA 使用（B 部分）。'),
          T('**Preference optimization** (DPO): when people can say which of two answers is better but cannot write the ideal one (part D).', '**偏好优化**（DPO）：人能判断两个回答哪个更好，却写不出理想答案时使用（D 部分）。'),
          T('**RLVR / reinforcement fine-tuning**: when a program can check the answer - maths, code, a test, a schema - the model learns from its own attempts (part E).', '**RLVR / 强化微调**：程序能判对错时（数学、代码、测试、格式检查），模型从自己的尝试中学（E 部分）。'),
          T('**Distillation**: a bigger model already does it; train a smaller, cheaper one on its outputs (parts B and E).', '**蒸馏**：已经有大模型能做好；用它的输出训练一个更小、更便宜的模型（B、E 部分）。'),
          T('**An encoder classifier**: if the output is one of a few fixed labels (routing, moderation, intent), a small encoder with a classification head is far cheaper than any generative model.', '**编码器分类模型**：如果输出只是几个固定标签之一（路由、审核、意图），一个小编码器加分类头，比任何生成式模型都便宜得多。'),
        ] },
        { type: 'p', text: T(
          'Why not always use the strongest-sounding method? Because a weaker signal cannot be made up for by a fancier algorithm. One example: to make a 32B model good at competition maths, distilling a stronger model\'s reasoning beat running RL on the 32B model itself.',
          '为什么不直接用听起来最强的方法？因为信号弱，换个更花哨的算法也补不回来。举个例子：想让一个 32B 模型擅长竞赛数学，蒸馏更强模型的推理过程，效果胜过直接在这个 32B 模型上做强化学习。',
        ) },
        figure('ft/a/distill-vs-rl', T('Bars: Qwen-32B with RL 47.0 vs distilled 72.6 on AIME 2024; RL 67.6 vs on-policy distillation 74.4 at about a tenth of the GPU hours.', '条形图：Qwen-32B 直接强化学习 47.0，蒸馏 72.6（AIME 2024）；强化学习 67.6，在线蒸馏 74.4，后者约用 1/10 的 GPU 时。'), T('On-policy distillation: the student writes its own answers and the teacher scores every token - lesson E3 explains it.', '在线蒸馏：学生自己写回答，老师给每个 token 打分（E3 课详讲）。'), 'DeepSeek-R1 (arXiv:2501.12948); Thinking Machines, On-policy distillation (2025)'),
        { type: 'details', summary: T('All eight ways side by side (data, cost, typical failure, real use)', '八种方法对照（数据、成本、典型失败、实际使用程度）'), blocks: [
          { type: 'p', text: T('In the last column, "models" counts the models on the Hugging Face Hub that carry the method\'s training tag; "teams" comes from the 2026 survey.', '最后一列里，"个模型"指 Hugging Face Hub 上带这种训练标签的模型数；"团队"来自 2026 年的调查。') },
          { type: 'table', head: [T('method', '方法'), T('changes', '改哪里'), T('signal', '信号'), T('typical failure', '典型失败'), T('how common (2025-26)', '实际使用程度')], rows: [
            [T('prompting, context engineering', '提示词、上下文工程'), T('context', '上下文'), T('none (an eval set)', '无（只要评测集）'), T('long prompts ignored, brittle', '长提示里的指令被忽略、不稳定'), T('~80% of teams', '约 80% 的团队')],
            [T('RAG', 'RAG'), T('context', '上下文'), T('documents', '文档'), T('wrong chunk retrieved (A2)', '取回了错误的块（A2）'), T('~49% of teams', '约 49% 的团队')],
            [T('encoder classifier', '编码器分类模型'), T('a small model', '一个小模型'), T('labels', '标签'), T('labels drift', '类别会变'), T('43k classifier models', '4.3 万个分类模型')],
            [T('SFT, usually LoRA', 'SFT，通常用 LoRA'), T('weights', '权重'), T('demonstrations', '示范'), T('template bugs, forgetting', '模板错误、遗忘'), T('the main method: 78k SFT models', '主力：7.8 万个 SFT 模型')],
            [T('preference (DPO)', '偏好优化（DPO）'), T('weights', '权重'), T('comparisons', '比较'), T('length bias', '偏向更长的回答'), T('common, fading at the frontier', '常见，前沿配方里在淡出')],
            [T('RLVR / managed RFT', 'RLVR / 托管强化微调'), T('weights', '权重'), T('a verifier or grader', '验证器或评分器'), T('reward hacking', '奖励投机'), T('growing fast', '增长很快')],
            [T('distillation', '蒸馏'), T('a smaller model', '小模型的权重'), T('a teacher', '老师'), T('inherits the teacher\'s errors', '继承老师的错误'), T('universal in labs', '实验室普遍使用')],
            [T('continued pretraining', '继续预训练'), T('weights', '权重'), T('raw domain text', '领域文本'), T('loses chat ability', '丢掉对话能力'), T('labs; rare elsewhere', '实验室常用，别处少见')],
          ] },
          { type: 'p', text: T('Synthetic data and rejection sampling are *sources of data* for these methods, not methods of their own (part B). Multimodal fine-tuning is outside this course.', '合成数据和拒绝采样是这些方法的*数据来源*，不是独立的方法（B 部分）。多模态微调不在本课程范围内。') },
          { type: 'cite', key: 'adoption', text: T('Usage numbers: research-adoption.md (Notion survey 2026, Menlo 2024, Hugging Face Hub tags)', '使用程度：research-adoption.md（Notion 2026 调查、Menlo 2024、Hugging Face Hub 标签）'), url: 'https://www.notion.com/lp/ai-engineering-survey' },
        ] },
      ],
    },
    {
      id: 'sig-1', kind: 'checkpoint', skill: 'a1-signals', purpose: 'practice',
      group: SIG,
      prompt: T('The legal team can write a model contract summary for any contract.', '法务团队能给任何一份合同写出标准的摘要。'),
      question: { type: 'choice', options: [
        { id: 'sft', label: T('SFT', 'SFT'), correct: true },
        { id: 'dpo', label: T('preference optimization', '偏好优化'), feedback: T('They can write the ideal answer - that is the stronger signal: demonstrations.', '他们能写出理想答案，这是更强的信号：示范。') },
        { id: 'rl', label: T('RLVR', 'RLVR'), feedback: T('No program can check a summary as right or wrong.', '摘要没有程序能判对错。') },
        { id: 'enc', label: T('encoder classifier', '编码器分类模型'), feedback: T('A summary is free text, not one of a few labels.', '摘要是自由文本，不是几个标签之一。') },
      ] },
    },
    {
      id: 'sig-2', kind: 'checkpoint', skill: 'a1-signals', purpose: 'practice', group: SIG,
      prompt: T('Reviewers cannot write a perfect reply, but they reliably agree on which of two replies is more appropriate.', '评审员写不出完美的回复，但能稳定判断两份回复哪份更得体。'),
      question: { type: 'choice', options: [
        { id: 'sft', label: T('SFT', 'SFT'), feedback: T('SFT needs good demonstrations - here nobody can write them.', 'SFT 需要好的示范，这里没人写得出来。') },
        { id: 'dpo', label: T('preference optimization', '偏好优化'), correct: true },
        { id: 'rl', label: T('RLVR', 'RLVR'), feedback: T('"More appropriate" cannot be checked by a program.', '"更得体"没法用程序判定。'), misconception: 'rl-strictly-better' },
        { id: 'rag', label: T('RAG', 'RAG'), feedback: T('Nothing is missing from the model\'s knowledge here.', '这里不缺知识。') },
      ] },
    },
    {
      id: 'sig-3', kind: 'checkpoint', skill: 'a1-signals', purpose: 'practice', group: SIG,
      prompt: T('500,000 support tickets a day must be routed to one of 12 queues; 20,000 past tickets are labelled with the right queue.', '每天 50 万张工单要分到 12 个处理队列之一；已有 2 万张历史工单标好了队列。'),
      question: { type: 'choice', options: [
        { id: 'enc', label: T('encoder classifier', '编码器分类模型'), correct: true },
        { id: 'sft', label: T('SFT of a generative model that writes the queue name', '给生成式模型做 SFT，让它写出队列名'), misconception: 'llm-for-everything', feedback: T('The output is one of 12 labels: an encoder with a classification head does it, at a tiny fraction of the cost per ticket.', '输出只是 12 个标签之一：编码器加分类头就能做，每张工单的成本只是零头。') },
        { id: 'prompt', label: T('a large model with a prompt listing the queues', '大模型加列出队列的提示词'), feedback: T('Workable, and a good baseline - but at 500k requests a day the cost adds up fast.', '可行，也是好的基线；但每天 50 万次，成本累积得很快。') },
        { id: 'rag', label: T('RAG', 'RAG'), feedback: T('Routing is a labelling task, not a knowledge gap.', '路由是打标签，不是缺知识。') },
      ] },
    },
    // ---------------------------------------------------------------- 4. does fine-tuning save money?
    {
      id: 'cost-intro', kind: 'read', chapter: T('Does fine-tuning save money?', '微调能省钱吗'), title: T('Paying per token or paying a fixed cost', '按 token 付钱，还是付固定成本'),
      blocks: [
        { type: 'p', text: T(
          'A common reason to fine-tune is cost: a long prompt (instructions, twenty examples) is paid for on every request; a fine-tuned small model needs a short prompt and is cheaper per token - but you pay to train it and, often, a fixed amount per day to host it. So whether it saves money depends on how many requests you have.',
          '微调的一个常见理由是省钱：长提示（指令加二十个示例）每次请求都要付费；微调后的小模型只需短提示，每个 token 也更便宜。但训练要花钱，托管往往还要每天付一笔固定费用。所以省不省钱，取决于请求量有多大。',
        ) },
        { type: 'p', text: T('Write the cost of one request as input tokens × input price + output tokens × output price. Option A (large model, long prompt) costs $c_A$ per request; option B (fine-tuned small model) costs $c_B$ per request plus $F$ per day. With $N$ requests a day:', '把每次请求的成本写成：输入 token × 输入单价 + 输出 token × 输出单价。方案 A（大模型 + 长提示）每次 $c_A$；方案 B（微调小模型）每次 $c_B$，另外每天固定 $F$。每天 $N$ 次请求时：') },
        { type: 'math', tex: '\\text{A: } N\\,c_A \\qquad \\text{B: } F + N\\,c_B \\qquad\\Longrightarrow\\qquad N^* = \\frac{F}{c_A - c_B}' },
        { type: 'list', items: [
          T('$N^*$ is the break-even volume: above it B is cheaper.', '$N^*$ 是持平点：请求量超过它，B 更便宜。'),
          T('$F$ on top: the bigger the fixed cost, the more volume you need. With per-token LoRA hosting $F \\approx 0$, and B wins from the first request.', '分子是 $F$：固定成本越高，需要的请求量越大。按 token 计费的托管 LoRA，$F \\approx 0$，B 从第一个请求起就更便宜。'),
          T('$c_A - c_B$ below: what each request saves. Prompt caching cuts the cost of a repeated long prompt (by up to 90%[^cache]), so it shrinks $c_A$ - and moves $N^*$ up.', '分母是 $c_A - c_B$：每次请求省下的钱。提示缓存能把重复长提示的费用降低最多 90%[^cache]，于是 $c_A$ 变小，$N^*$ 变大。'),
        ] },
        { type: 'cite', key: 'cache', text: T('Anthropic, Introducing Contextual Retrieval (prompt caching), 2024', '出处：Anthropic, Introducing Contextual Retrieval (prompt caching), 2024'), url: 'https://www.anthropic.com/news/contextual-retrieval' },
      ],
    },
    {
      id: 'cost-predict', kind: 'checkpoint', skill: 'a1-costs', purpose: 'predict',
      title: T('With caching', '开了缓存以后'),
      prompt: T(
        '2,000 requests a day; 80% of A\'s long prompt is served from the cache. B (the fine-tuned small model) has a fixed cost of 20 USD a day. Which is cheaper per day?',
        '每天 2,000 次请求；A 的长提示有 80% 命中缓存。B（微调小模型）每天固定成本 20 美元。每天谁更便宜？',
      ),
      question: { type: 'choice', options: [
        { id: 'b', label: T('B, the fine-tuned model: its prompt is ten times shorter', 'B，微调模型：它的提示短了十倍'), misconception: 'ft-always-cheaper' },
        { id: 'a', label: T('A, the large model with the long prompt', 'A，大模型加长提示'), correct: true },
        { id: 'same', label: T('About the same', '差不多') },
      ] },
    },
    {
      id: 'cost-world', kind: 'explore', title: T('Find the break-even', '找到持平点'), skill: 'a1-costs',
      scene: vis('cost_crossover', COST),
      prompt: T(
        'Where do the two lines cross? Drag the daily requests $N$ to your guess and press **This is break-even** - the true break-even appears only then. After that, the cache share and the fixed cost unlock: raise the cache share to 0.8 or more, guess the new break-even and lock it again.',
        '两条线在哪里交叉？把每天请求数 $N$ 拖到你认为的位置，按**这是持平点**；真正的持平点这时才会显示。之后缓存比例和固定成本会解锁：把缓存比例拉到 0.8 以上，预测新的持平点，再锁定一次。',
      ),
      setup: (scene: any, ui, _ctx, world) => {
        hold('cost_crossover', COST)(scene, ui, _ctx, world);
        let cache = false, fzero = false, more = false;
        watch(scene, () => {
          if (!more && world.state.base) {
            more = true;
            scene.attach_controls(ui, ['h', 'F']);
            world.emit('more_controls');
          }
          if (!cache && scene.h.get_value() >= 0.75) {
            cache = true;
            world.emit('cache_on');
          }
          if (!fzero && scene.F.get_value() <= 1) {
            fzero = true;
            world.emit('f_zero');
          }
        });
      },
      actions: [{
        id: 'lock', label: T('This is break-even', '这是持平点'), primary: true,
        run: (scene: any, _ctx, world) => {
          const n = scene.lock(), ns = scene.nstar(), h = scene.h.get_value();
          const off = Number.isFinite(ns) && ns > 0 ? Math.log10(n / ns) : Infinity;
          const ok = Math.abs(off) <= 0.15; // within a factor of about 1.4 on the log axis
          const base_n = world.state.base_n as number | undefined;
          if (ok && h < 0.05) {
            world.state.base = true;
            world.state.base_n = ns;
          }
          if (ok && h >= 0.75) world.state.cache = true;
          world.emit('locked', { ok, below: off < -0.15, h, near_old: base_n !== undefined && h >= 0.75 && Math.abs(Math.log10(n / base_n)) <= 0.15 });
        },
      }],
      goals: [
        { id: 'base', check: (_s, _c, w) => !!w.state.base, message: T('Break-even ≈ 1,500 requests a day: to the right, the fine-tuned model is cheaper.', '持平点约每天 1,500 次：再往右，微调小模型更便宜。') },
        { id: 'cache', check: (_s, _c, w) => !!w.state.cache, message: T('With caching the break-even roughly doubles.', '开了缓存，持平点差不多翻了一倍。') },
      ],
      detectors: [
        { id: 'too-low', on: (e) => (e.type === 'locked' && e.data?.below ? { kind: 'misconception', id: 'ft-always-cheaper', message: T('Left of the crossing the red line is lower: A is still cheaper there.', '交叉点左边红线更低：那里 A 还更便宜。') } : null) },
        { id: 'old-point', on: (e) => (e.type === 'locked' && e.data?.near_old && !e.data?.ok ? { kind: 'misconception', id: 'cache-ignored', message: T('That was the break-even without the cache.', '那是没开缓存时的持平点。') } : null) },
      ],
      lines: [
        { text: T('Red is the large model with the long prompt; blue, the fine-tuned small model. Watch where they cross.', '红线是大模型加长提示，蓝线是微调后的小模型。看它们在哪里交叉。'), when: 'enter' },
        { text: T('Left of the crossing, which line is lower?', '交叉点左边，哪条线更低？'), when: 'idle' },
        { text: T('The cache share and the fixed cost are free now. Before you move N again: which way will the crossing move when the cache gets cheaper?', '缓存比例和固定成本现在可以拖了。再动 N 之前先想一想：缓存让 A 更便宜，交叉点会往哪边移？'), when: { event: 'more_controls' } },
        { text: T('Here the red line is still below the blue one. At low volume, B\'s fixed daily cost is not spread out yet, so fine-tuning costs more.', '这里红线还在蓝线下面。请求量小时，B 每天的固定成本还没摊薄，微调反而更贵。'), when: { finding: 'ft-always-cheaper' } },
        { text: T('With the cache, every request of A got cheaper: the red line dropped, and the crossing moved right.', '开了缓存，A 的每次请求都便宜了：红线往下移，交叉点往右跑。'), when: { event: 'cache_on' } },
        { text: T('That is where the lines crossed before the cache. Caching made c A smaller, so c A minus c B shrank and N star grew.', '那是开缓存之前的交叉点。缓存让 c A 变小，分母 c A 减 c B 跟着变小，N 星就变大了。'), when: { finding: 'cache-ignored' } },
        { text: T('With no fixed cost, the blue line starts at the bottom: per-token hosting is cheaper from the first request.', '固定成本为零，蓝线从最低处起步：按 token 计费的托管，从第一个请求起就更便宜。'), when: { event: 'f_zero' } },
        { text: T('So fine-tuning saves money only with enough volume, a long prompt the cache has not already made cheap, and a small fixed cost.', '所以微调省不省钱，要看三件事：请求量够大，长提示的费用没被缓存吃掉，固定成本不高。'), when: 'goal' },
      ],
      hints: [T('The break-even is where the red and the blue line meet.', '持平点就是红线和蓝线相交的地方。'), T('With the default numbers it is about 1,500 requests a day.', '默认数值下，大约是每天 1,500 次。')],
      solve: (_s, _c, w) => {
        w.state.base = true;
        w.state.cache = true;
      },
    },
    {
      id: 'cost-calc', kind: 'checkpoint', skill: 'a1-costs', purpose: 'check', title: T('Compute it', '算一算'),
      prompt: T('A costs 0.0135 USD per request; B costs 0.0003 USD per request plus 20 USD a day. At how many requests per day do they cost the same?', 'A 每次请求 0.0135 美元；B 每次 0.0003 美元，另加每天 20 美元。每天多少次请求时两者花费相同？'),
      question: { type: 'number', answer: 20 / 0.0132, rtol: 0.03, wrong: [
        { answer: 20 / 0.0135, feedback: T('Subtract what B pays per request too: the saving per request is $c_A - c_B$.', '还要减去 B 每次请求的花费：每次省下的是 $c_A - c_B$。') },
        { answer: 20 / 0.0003, feedback: T('The denominator is the saving per request, $c_A - c_B$, not $c_B$.', '分母是每次省下的钱 $c_A - c_B$，不是 $c_B$。') },
      ] },
      explain: T('$N^* = 20 / (0.0135 - 0.0003) \\approx 1{,}515$ requests a day.', '$N^* = 20 / (0.0135 - 0.0003) \\approx 1{,}515$ 次/天。'),
    },
    // ---------------------------------------------------------------- 5. the map
    map_scene('map', 'A1', T(
      'This is the decision map we will build through the course. It starts before any method. First, write down how you will judge success. Second, try the strongest model with a well-built context. If the output is just a label, a small classifier will do. Otherwise, ask what kind of gap is left: missing knowledge, unstable behaviour, missing capability, or plain cost. Each later lesson fills in one of these branches.',
      '这是整门课要一起搭起来的决策图。它从任何方法之前开始。第一步，写下怎么判断成功。第二步，用最强的模型加上精心准备的上下文试一试。如果输出只是一个标签，一个小分类模型就够了。否则，看剩下的差距属于哪一类：缺知识、行为不稳、缺能力，还是单纯太贵。后面每一课，都会补上其中一条分支。',
    )),
    card_page('card',
      T('Do not fine-tune by default. Write the evaluation first and get a baseline with the strongest model and good context engineering. Sort what still fails into knowledge, behaviour, capability or cost. Knowledge goes into the context. For the rest, the signal you have - demonstrations, comparisons, a verifier, a teacher, labels - picks the method; fixed labels go to an encoder classifier.',
        '默认不微调。先写评测，用最强的模型加上好的上下文工程跑出基线。把剩下的失败分成知识、行为、能力、成本四类。知识放进上下文；其余的，看手里的信号（示范、比较、验证器、老师、标签）来选方法；输出是固定标签的，交给编码器分类模型。'),
      T('Fine-tuning on 500 FAQ answers so the model "remembers" a new product. It learns the FAQ\'s tone, not reliable facts - and makes up the missing ones.', '用 500 条 FAQ 做微调，想让模型"记住"新产品。它学到的是 FAQ 的口吻，不是可靠的事实，缺的部分还会编造。'),
      { en: 'the first questions on the map', zh: '决策图最上面的几个问题' }),
    // ---------------------------------------------------------------- checks
    {
      id: 'why-context', kind: 'checkpoint', skill: 'a1-levers', purpose: 'check', chapter: T('Check', '检验'), title: T('Explain it', '用自己的话说'),
      prompt: T('In one or two sentences: why should "the prices we changed last week" go into the context rather than into the weights?', '用一两句话说明：为什么"上周刚调整的价格"应该放进上下文，而不是写进权重？'),
      question: { type: 'text', rubric: {
        key_points: [
          T('Prices change, so weights would have to be retrained after every change.', '价格会变，写进权重就得每变一次重训一次。'),
          T('Fine-tuning on new facts is slow and raises hallucination; retrieval injects knowledge better.', '用新事实微调学得慢、还会推高幻觉；检索更适合注入知识。'),
          T('In the context the answer can cite its source and be checked, and access can be controlled.', '放在上下文里，回答可以引用出处、可以核对，也能控制谁能看到。'),
        ],
        model_answer: T('Because prices change: in the context they are updated by editing a document, and the answer can cite it. Written into the weights they would need retraining each time, and fine-tuning on new facts is slow and makes the model hallucinate more.', '因为价格会变：放在上下文里，改一份文档就更新了，回答还能引用出处。写进权重就得每次重训，而且用新事实微调学得慢，还会让模型更爱编造。'),
        min_points: 2,
      } },
    },
    {
      id: 'transfer', kind: 'checkpoint', skill: 'a1-map', purpose: 'check', title: T('A new case', '一个新情境'),
      prompt: T(
        'A team wants a 7B model to get better at competition maths. They have problems with final answers, no worked solutions, and no stronger model they may use. What should they do first?',
        '一个团队想让 7B 模型在竞赛数学上变强。手里只有题目和标准答案，没有解题过程，也没有可用的更强模型。第一步该做什么？',
      ),
      question: { type: 'choice', options: [
        { id: 'a', label: T('SFT on the problems and their final answers', '用题目和答案做 SFT'), feedback: T('A final answer is not a demonstration of how to solve the problem; it can serve as a verifier instead.', '最终答案不是解题过程的示范；它可以当验证器用。') },
        { id: 'b', label: T('Let the model try each problem many times (say 64) and check that it gets some right at least once; then use the final answers as a checker for RLVR', '让模型对每道题试很多次（比如 64 次），看能不能至少做对一次；再把标准答案当成判分器，做 RLVR'), correct: true },
        { id: 'c', label: T('Have people compare pairs of solutions, then DPO', '请人两两比较解答，再做 DPO'), misconception: 'rl-strictly-better', feedback: T('With a verifier available, comparisons are a weaker and costlier signal.', '已经有验证器了，比较是更弱也更贵的信号。') },
        { id: 'd', label: T('Put the problems into a RAG index', '把题目放进 RAG 索引'), misconception: 'ft-injects-knowledge', feedback: T('What is missing is a skill, not a fact.', '缺的是能力，不是事实。') },
      ] },
      explain: T('If the model never solves a problem even in 64 tries, RL gets no signal at all: start with easier problems, or find a teacher. Part E calls this check pass@k and works it out.', '如果模型尝试 64 次都做不对一道题，强化学习就完全拿不到信号：要先换更容易的题，或者找一个老师模型。E 部分把这个检查叫作 pass@k，并会展开讲。'),
    },
  ],
};
