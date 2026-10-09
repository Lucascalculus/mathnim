// F1 "Choosing: the decision map and cases" (决策框架与案例研讨) - the capstone.
// Plan: docs/lessons/llm-finetuning/part-f-choosing.md (sections 1-4).
// Principles, the whole map, two worked cases, three cases to solve (one with
// the cost world), quick triage, your own project, and the case bank.
import type { Block, Lesson } from '@mathnim/core';
import { card_page, case_group, figure, hold, map_scene, T, vis, visual, watch } from './kit';

/** Case 9: summarising 300k calls a day with a self-hosted distilled model (B has only a fixed daily cost). */
const CALLS = { tokens_in_a: 2500, tokens_in_b: 2300, tokens_out: 200, price_in_b: 0, price_out_b: 0, fixed_per_day: 100, requests_per_day: 30, hide_nstar: true, controls: 'volume' };

const RUBRIC_PLAN = [
  T('Data: where it comes from, roughly how much, and how it is cleaned (personal data removed, filtered, checked).', '数据：从哪来、大约多少、怎么清洗（去除个人信息、过滤、核对）。'),
  T('Two concrete risks, each with a mitigation (e.g. memorised personal data, weaker safety, overfitting to phrasing).', '两条具体风险，各有缓解办法（例如背下个人信息、安全性下降、过拟合到固定措辞）。'),
  T('Evaluation: a task metric, a method-specific signal, and a regression or safety check.', '评测：任务指标、方法专属的信号，加上回归或安全检查。'),
];

/** One case of the bank, as a collapsed block. */
const bank = (title: L, need: L, trap: L, path: L, data: L, risks: L, evals: L): Block => ({
  type: 'details', summary: title, blocks: [
    { type: 'table', head: [T('item', '项目'), T('this case', '本案例')], rows: [
      [T('need', '需求'), need], [T('tempting mistake', '诱人的错误'), trap], [T('route on the map', '决策图路径'), path],
      [T('data', '数据'), data], [T('risks', '风险'), risks], [T('evaluation', '怎么评测'), evals],
    ] },
  ],
});
type L = ReturnType<typeof T>;

export const lesson: Lesson = {
  id: 'ft-f1',
  title: T('Choosing: the decision map and cases', '怎么选：决策框架与案例研讨'),
  description: T('The whole course as one decision map, used on real kinds of projects: from the need to the method, the data, the risks and the evaluation.', '把整门课收成一张决策图，用在一类类真实项目上：从需求一路推到方法、数据、风险和评测。'),
  mode: 'essay',
  skills: [
    { id: 'f1-route', name: T('From a need to a route on the map', '从需求推到决策图上的路径') },
    { id: 'f1-trap', name: T('Spot the tempting mistake', '认出诱人的错误'), prerequisites: ['f1-route'] },
    { id: 'f1-plan', name: T('Data, risks and evaluation for a plan', '为方案写出数据、风险和评测'), prerequisites: ['f1-route'] },
  ],
  misconceptions: [
    { id: 'ft-is-default', description: T('Building with LLMs means fine-tuning.', '做大模型应用就该微调。') },
    { id: 'ft-injects-knowledge', description: T('To make a model know new facts, fine-tune it on them.', '要让模型知道新东西，就拿这些资料去微调。') },
    { id: 'llm-for-everything', description: T('Classification should also use a generative LLM.', '分类任务也该用生成式大模型。') },
    { id: 'fix-generator-first', description: T('When RAG answers wrongly, fine-tune the generator.', 'RAG 答错了，就去微调生成模型。') },
    { id: 'rl-strictly-better', description: T('Reinforcement learning is always the strongest choice.', '强化学习总是最强的选择。') },
    { id: 'ft-always-cheaper', description: T('A fine-tuned small model always saves money.', '微调的小模型一定更省钱。') },
    { id: 'dpo-raises-chosen', description: T('DPO always makes the chosen answer more likely.', 'DPO 一定会提高被选回答的概率。') },
    { id: 'longer-is-better', description: T('Longer reasoning means better reasoning.', '推理写得越长，推理能力越强。') },
    { id: 'few-examples-suffice', description: T('A few thousand examples are enough to teach a new language.', '几千条样本就够教会一门新语言。') },
  ],
  steps: [
    // ---------------------------------------------------------------- 1. principles and the map
    {
      id: 'why', kind: 'read', chapter: T('The map', '决策图'), title: T('Methods age; the way of choosing does not', '方法会过时，选择的思路不会'),
      blocks: [
        { type: 'p', text: T(
          'In 2023 the debate was PPO against DPO; today most open training uses GRPO-family methods and distillation, and most companies never fine-tune at all. The questions that decide a method have stayed the same. Five principles carry the whole course:',
          '2023 年大家争论的是 PPO 还是 DPO；如今开源训练多用 GRPO 类方法和蒸馏，而大多数公司根本不做微调。但决定用哪种方法的那几个问题，一直没变。整门课可以收成五条原则：',
        ) },
        { type: 'list', ordered: true, items: [
          T('**Evaluate first.** Without a scored set of real examples you cannot choose, or prove anything.', '**评测先行。**没有一组能打分的真实样例，就没法选择，也没法证明任何事。'),
          T('**Do not change weights by default.** Most problems end with good context: instructions, examples, retrieval, structured output.', '**默认不改权重。**大多数问题，靠好的上下文（指令、示例、检索、结构化输出）就能解决。'),
          T('**Name the gap**: knowledge, behaviour, capability or cost - or a fixed label.', '**说清差距**：知识、行为、能力、成本，还是固定标签。'),
          T('**Your signal picks the method**: demonstrations, comparisons, a verifier, a teacher, labels.', '**信号决定方法**：示范、比较、验证器、老师、标签。'),
          T('**Check the constraints, and finish with the method\'s own evaluation**: memory, platform, forgetting and safety, privacy and licences.', '**查约束，并用这个方法专属的评测收尾**：显存、平台、遗忘与安全、隐私与许可。'),
        ] },
        figure('ft/f/hub-methods', T('Bar chart of Hugging Face Hub models by training method: SFT 78,127; text classification 43,372; GRPO 14,257; DPO 10,532.', 'Hugging Face Hub 模型数按训练方法统计：SFT 78,127；文本分类 43,372；GRPO 14,257；DPO 10,532。'), T('When people do fine-tune, SFT dominates; plain classifiers remain one of the most common fine-tunes.', '真要微调时，SFT 是主力；普通的分类模型仍是最常见的微调之一。'), 'research-adoption.md'),
      ],
    },
    map_scene('map', 'F1', T(
      'Here is the whole map. It starts with an evaluation and a strong context baseline; a fixed label goes to a small classifier. Every other gap takes one of four branches. Knowledge goes into the context. Behaviour goes to demonstrations or comparisons. Capability goes to a verifier or a teacher. Cost goes to distillation and deployment. Every path that changes weights then passes through the same three gates: where the data comes from, the constraints, and the evaluation.',
      '这是完整的决策图。它从评测和一个强的上下文基线开始；输出是固定标签的，交给小分类模型。其余的差距走四条分支之一：知识放进上下文；行为看示范或比较；能力看验证器或老师；成本走蒸馏和部署。所有要改权重的路径，最后都要过同样三道关：数据从哪来，有哪些约束，以及怎么验收。',
    )),
    {
      id: 'nodes', kind: 'read', title: T('The questions at each node', '每一格要问的问题'),
      blocks: [
        { type: 'table', head: [T('step', '这一步'), T('question', '问题'), T('if yes', '如果是'), T('lesson', '详讲')], rows: [
          [T('evaluation', '评测'), T('Can you score real examples?', '能对真实样例打分吗？'), T('continue; if not, build that first', '继续；不能就先建评测'), 'A1, B3'],
          [T('baseline', '基线'), T('Does the strongest model pass with good context?', '最强的模型配好上下文能过关吗？'), T('stop; only check cost', '停在这里，只查成本'), 'A1'],
          [T('fixed labels?', '固定标签？'), T('Is the output one of a few labels?', '输出是几个固定标签之一吗？'), T('encoder classifier', '编码器分类模型'), 'A1'],
          [T('knowledge', '知识'), T('Does it work once the right document is in the prompt?', '把正确文档放进提示后就对了吗？'), T('knowledge: context or RAG; fix retrieval first', '知识：上下文或 RAG；先修检索'), 'A2, A2b'],
          [T('behaviour', '行为'), T('Can you demonstrate, or only compare?', '能写出示范，还是只能比较？'), T('SFT (LoRA) / DPO', 'SFT（LoRA）/ DPO'), 'B1-B3, D1-D4'],
          [T('capability', '能力'), T('Is there a verifier, and does the model sometimes succeed? A teacher?', '有验证器吗？模型偶尔能做对吗？有老师吗？'), T('RLVR or managed RFT / distillation', 'RLVR 或托管强化微调 / 蒸馏'), 'E1-E3'],
          [T('efficiency', '效率'), T('Is quality fine but cost or latency not?', '质量够了，只是成本或延迟不行？'), T('do the math; distil; merge or multi-LoRA', '算账；蒸馏；合并或多适配器'), 'A1, C3, E3'],
          [T('every weight change', '凡是改权重'), T('Data source? Memory, platform, forgetting, licences? Method-specific checks?', '数据从哪来？显存、平台、遗忘、许可？方法专属的验收？'), T('every weight-changing path', '所有改权重的路径都要过'), 'B2, C1, B3'],
        ] },
        { type: 'details', summary: T('Common traps, each with its case', '常见陷阱，各对应一个案例'), blocks: [
          { type: 'table', head: [T('trap', '陷阱'), T('case', '案例')], rows: [
            [T('teaching changing facts by fine-tuning', '用微调灌会变的知识'), '1'],
            [T('fine-tuning before trying structured output', '没试结构化输出就去微调'), '2'],
            [T('a generative model for fixed labels', '固定标签也用生成式模型'), '3'],
            [T('fine-tuning the generator when retrieval failed', '检索出了问题却去微调生成模型'), '4'],
            [T('RL when demonstrations exist', '有示范却直接上强化学习'), '5'],
            [T('DPO on near-identical pairs', '用几乎一样的偏好对做 DPO'), '6'],
            [T('collecting comparisons when a verifier exists', '有验证器却去收集比较'), '7'],
            [T('agent RL without a reproducible environment', '没有可复现的环境就做智能体强化学习'), '8'],
            [T('only shortening the prompt to save money', '以为只缩短提示就能省钱'), '9'],
            [T('RL on a small model instead of distilling', '小模型直接强化学习，不先蒸馏'), '10'],
            [T('a few thousand examples to learn a language', '几千条样本就想学会一门语言'), '11'],
          ] },
        ] },
      ],
    },
    // ---------------------------------------------------------------- 2. two worked cases
    {
      id: 'worked-1', kind: 'read', chapter: T('Worked cases', '示范案例'), title: T('Case 1: an internal policy assistant (no fine-tuning)', '案例 1：内部政策助手（不微调）'),
      blocks: [
        { type: 'p', text: T('**Need.** 3,000 employees ask about HR and IT policies: ~800 documents, changed every week; answers must cite sources; some documents are managers-only.', '**需求。**3,000 名员工询问人事和 IT 政策：约 800 份文档，每周都有改动；回答要附出处；部分文档只有经理能看。') },
        { type: 'p', text: T('**Tempting mistake.** Turn the policies into Q&A pairs and fine-tune. Weekly changes would mean weekly retraining; new facts are learned slowly and raise hallucination; and weights cannot hide managers-only text from other users.', '**诱人的错误。**把政策整理成问答对去微调。每周都变，就得每周重训；新事实学得慢，还会推高幻觉；写进权重后，也没法把只限经理看的内容挡在其他人外面。') },
        visual('decision_map', { upto: 'F1', path: '0,1,T,2,K1,K2,K3', highlight: 'K2' }, T('The route: evaluation, baseline, not a label, a knowledge gap, too large for the context, RAG, then fix retrieval.', '路径：评测 → 基线 → 不是标签 → 知识差距 → 放不进上下文 → RAG → 修检索。')),
        { type: 'p', text: T('**Route.** RAG with permission filtering at retrieval, effective dates as metadata (newest version wins on conflict), numbered sources and "say when it is not in the documents".', '**路径。**RAG：检索时按权限过滤；生效日期作为元数据，版本冲突时以最新为准；来源编号；"文档里没有就明说"。') },
        { type: 'p', text: T('**Data.** 200 real questions labelled with the chunks that answer them, plus 30 questions the documents cannot answer.', '**数据。**200 个真实问题，标上能回答它们的块；另加 30 个文档里没有答案的问题。') },
        { type: 'p', text: T('**Risks.** An outdated version retrieved (FP4); leaking managers-only text; instructions hidden in documents.', '**风险。**取回过时版本（FP4）；泄露只限经理看的内容；文档里藏着恶意指令。') },
        { type: 'p', text: T('**Evaluation.** Recall@10; faithfulness spot checks; refusal rate on unanswerable questions; a permission test run as an ordinary employee.', '**评测。**Recall@10；抽查忠实度；答不了的问题的拒答率；用普通员工身份做越权测试。') },
        { type: 'callout', kind: 'note', title: T('Change one condition', '改一个条件'), body: T('Only 30 policies, ~50,000 tokens in total? Put all of them in the prompt with caching - no retrieval to build or to fail.', '如果只有 30 份政策，总共约 5 万 token？那就全部放进提示，配合缓存：没有检索要搭，也就没有检索会出错。') },
      ],
    },
    {
      id: 'worked-2', kind: 'read', title: T('Case 10: competition maths for a 7B model (distil before RL)', '案例 10：7B 模型的竞赛数学（先蒸馏，再强化学习）'),
      blocks: [
        { type: 'p', text: T('**Need.** A 7B open model must get much better at competition maths. There are problems with final answers, and a strong reasoning model whose licence allows training on its outputs.', '**需求。**让一个 7B 开源模型在竞赛数学上明显变强。有带标准答案的题目，还有一个强推理模型，它的许可证允许用其输出训练。') },
        { type: 'p', text: T('**Tempting mistake.** GRPO directly on the 7B model, because "RL makes reasoning models". At 32B, RL alone reached 47.0 on AIME 2024, distilling the teacher 72.6[^r1]. And longer answers during training are not proof of better reasoning[^drgrpo].', '**诱人的错误。**直接在 7B 上做 GRPO，理由是"推理模型是强化学习训出来的"。在 32B 规模上，只做强化学习，AIME 2024 得分 47.0；蒸馏老师的结果是 72.6[^r1]。另外，训练中回答越来越长，并不能证明推理变强了[^drgrpo]。') },
        visual('decision_map', { upto: 'F1', path: '0,1,T,2,C3,C1,C2', highlight: 'C3' }, T('The route: a capability gap, a teacher first (distillation), then check pass@k and use the answers as a verifier.', '路径：能力差距 → 先找老师（蒸馏）→ 再测 pass@k，把答案当验证器。')),
        { type: 'p', text: T('**Route.** Sample reasoning traces from the teacher, keep only those whose final answer is right (rejection sampling), and SFT on them - 1,000 good traces already went a long way in s1[^s1]. Then measure pass@k: where the model sometimes succeeds, RLVR or on-policy distillation can raise pass@1.', '**路径。**从老师那里采样推理轨迹，只保留最终答案正确的（拒绝采样），用它们做 SFT。s1 只用了 1,000 条好轨迹，效果就很显著[^s1]。然后测 pass@k：模型偶尔能做对的题，再用 RLVR 或在线蒸馏把 pass@1 提上去。') },
        { type: 'p', text: T('**Risks.** Test problems leaking into training data; runaway answer length; weaker general ability. **Evaluation.** pass@1, pass@k and majority vote on held-out problems; the length distribution; a general regression set.', '**风险。**测试题混进训练数据；回答长度失控；通用能力下降。**评测。**在留出题上看 pass@1、pass@k 和多数投票；回答长度的分布；一组通用能力的回归测试。') },
        { type: 'callout', kind: 'note', title: T('Change one condition', '改一个条件'), body: T('No teacher? Measure pass@k first: if the model sometimes succeeds, use RLVR; if it almost never does, start with easier problems.', '没有老师？先测 pass@k：模型偶尔能做对，就用 RLVR；几乎从来做不对，就先换更容易的题。') },
        { type: 'cite', key: 'r1', text: T('DeepSeek-R1 (arXiv:2501.12948)', 'DeepSeek-R1（arXiv:2501.12948）'), url: 'https://arxiv.org/abs/2501.12948' },
        { type: 'cite', key: 'drgrpo', text: T('Liu et al., Understanding R1-Zero-Like Training (Dr. GRPO), 2025', 'Liu 等，Understanding R1-Zero-Like Training（Dr. GRPO），2025'), url: 'https://arxiv.org/abs/2503.20783' },
        { type: 'cite', key: 's1', text: T('Muennighoff et al., s1: Simple test-time scaling (2025)', 'Muennighoff 等，s1: Simple test-time scaling（2025）'), url: 'https://arxiv.org/abs/2501.19393' },
      ],
    },
    // ---------------------------------------------------------------- 3. case 5 (behaviour)
    ...case5(),
    // ---------------------------------------------------------------- 4. case 9 (cost) with the world
    {
      id: 'c9-brief', kind: 'read', chapter: T('Case 9: summarising calls', '案例 9：通话摘要'), title: T('Cheaper - but at what volume?', '能省钱，但要多大的量？'),
      blocks: [
        { type: 'p', text: T('**Need.** A call centre summarises every call; a large model through an API does it well but costs too much, and compliance would prefer transcripts not to leave the building.', '**需求。**呼叫中心要给每通电话写摘要；用大模型 API 效果很好，但太贵，合规部门也希望通话转写不要外发。') },
        { type: 'p', text: T('**Plan.** Distil: the large model (or a large self-hosted open model) writes summaries, a rubric filters them, and a small model is fine-tuned on the good ones and hosted in-house. The small model costs no tokens - only a server, about 100 USD a day in this example.', '**方案。**蒸馏：由大模型（或私有部署的大开源模型）写摘要，按评分细则过滤，再用合格的摘要微调一个小模型，放在内部服务器上。小模型不按 token 计费，只有服务器的钱，本例中约每天 100 美元。') },
        { type: 'p', text: T('Most of each request is the transcript itself (about 2,300 of 2,500 input tokens), so a shorter prompt saves almost nothing here: the saving comes from replacing per-token prices with a fixed cost.', '每次请求的输入大部分是转写稿本身（2,500 个输入 token 里约 2,300 个），所以缩短提示在这里几乎省不了钱：省钱靠的是用固定成本替换按 token 的计费。') },
      ],
    },
    {
      id: 'c9-predict', kind: 'checkpoint', skill: 'f1-route', purpose: 'predict', title: T('Your bet', '你的判断'),
      prompt: T('At 3,000 calls a day, is the self-hosted distilled model cheaper than the API?', '每天 3,000 通电话时，私有部署的蒸馏小模型比 API 便宜吗？'),
      question: { type: 'choice', options: [
        { id: 'yes', label: T('Yes: it pays no tokens at all', '便宜：它完全不付 token 费'), misconception: 'ft-always-cheaper' },
        { id: 'no', label: T('No: at that volume the server costs more than the API calls', '不便宜：这个量下，服务器比 API 调用还贵'), correct: true },
        { id: 'same', label: T('About the same', '差不多') },
      ] },
    },
    {
      id: 'c9-world', kind: 'explore', title: T('Where self-hosting pays off', '自建从哪里开始划算'), skill: 'f1-route',
      scene: vis('cost_crossover', CALLS),
      prompt: T('Drag $N$ to where you think the two lines cross and press **This is break-even** (the true value appears only then). Then the fixed cost $F$ unlocks: set $N$ to about 3,000 a day, drag $F$ until the lines cross right there, and lock again.', '把 $N$ 拖到你认为两条线交叉的地方，按**这是持平点**（真正的数值这时才显示）。之后固定成本 $F$ 会解锁：把 $N$ 调到每天约 3,000，拖动 $F$，让两条线正好在那里交叉，再锁定一次。'),
      setup: (scene: any, ui, ctx, world) => {
        hold('cost_crossover', CALLS)(scene, ui, ctx, world);
        let moved_f = false, more = false;
        watch(scene, () => {
          if (!more && world.state.base) {
            more = true;
            scene.attach_controls(ui, ['F']);
          }
          if (!moved_f && Math.abs(scene.F.get_value() - CALLS.fixed_per_day) > 5) {
            moved_f = true;
            world.emit('f_moved');
          }
        });
      },
      actions: [{
        id: 'lock', label: T('This is break-even', '这是持平点'), primary: true,
        run: (scene: any, _ctx, world) => {
          const n = scene.lock(), ns = scene.nstar();
          const off = Number.isFinite(ns) && ns > 0 ? Math.log10(n / ns) : Infinity;
          const ok = Math.abs(off) <= 0.15;
          const at3k = Math.abs(Math.log10(n / 3000)) <= 0.08;
          if (ok && Math.abs(scene.F.get_value() - CALLS.fixed_per_day) < 1) world.state.base = true;
          if (ok && at3k) world.state.at3k = true;
          world.emit('locked', { ok, below: off < -0.15, at3k });
        },
      }],
      goals: [
        { id: 'base', check: (_s, _c, w) => !!w.state.base, message: T('About 9,500 calls a day: above that, the in-house model is cheaper.', '约每天 9,500 通：超过这个量，内部部署的小模型更便宜。') },
        { id: 'at3k', check: (_s, _c, w) => !!w.state.at3k, message: T('At 3,000 calls a day the server may cost only about 31 USD a day: F = N·(c_A − c_B).', '每天 3,000 通时，服务器每天只能花约 31 美元：F = N·(c_A − c_B)。') },
      ],
      detectors: [
        { id: 'too-low', on: (e) => (e.type === 'locked' && e.data?.below ? { kind: 'misconception', id: 'ft-always-cheaper', message: T('There the API line is still lower.', '那里 API 的线还更低。') } : null) },
      ],
      lines: [
        { text: T('This time B is a model on your own server: no price per token, only the daily cost of the server.', '这一次，B 是放在自己服务器上的模型：没有按 token 的价格，只有服务器每天的费用。'), when: 'enter' },
        { text: T('Left of the crossing, the API is cheaper: the fixed cost has not been spread over enough calls.', '交叉点左边，API 更便宜：固定成本还没摊到足够多的电话上。'), when: { finding: 'ft-always-cheaper' } },
        { text: T('Moving F moves only the blue line: N star is F divided by what each call saves.', '拖动 F，只有蓝线在动：N 星等于 F 除以每通电话省下的钱。'), when: { event: 'f_moved' } },
        { text: T('Below about 9,500 calls a day, keep the API with caching. A reason to self-host anyway would be compliance, not cost.', '每天少于约 9,500 通，就继续用 API 加缓存。即便如此仍想自建，理由会是合规，而不是成本。'), when: 'goal' },
      ],
      hints: [T('With $F = 100$, the lines cross near 9,500 a day.', '$F = 100$ 时，两条线在每天约 9,500 处交叉。'), T('At 3,000 a day, A costs about 31.5 USD a day: set F to that.', '每天 3,000 通时，A 每天约 31.5 美元：把 F 设成这个数。')],
      solve: (_s, _c, w) => {
        w.state.base = true;
        w.state.at3k = true;
      },
    },
    {
      id: 'c9-advice', kind: 'checkpoint', skill: 'f1-route', purpose: 'check', title: T('Your advice', '你的建议'),
      prompt: T('The call centre handles 3,000 calls a day, and the transcripts may leave the building. What do you advise?', '这家呼叫中心每天 3,000 通，通话转写允许外发。你的建议是？'),
      question: { type: 'choice', options: [
        { id: 'api', label: T('Keep the API with prompt caching; revisit self-hosting if volume passes ~10,000 a day', '继续用 API，配合提示缓存；每天超过约 1 万通时再考虑自建'), correct: true },
        { id: 'host', label: T('Distil and self-host now: per-token prices are always worse', '现在就蒸馏并自建：按 token 计费总是更贵'), misconception: 'ft-always-cheaper' },
        { id: 'rl', label: T('Run RL on a small model to make it summarise better', '在小模型上做强化学习，让它摘要写得更好'), misconception: 'rl-strictly-better', feedback: T('There is a strong teacher and no simple verifier: distillation, not RL, is the route - and only once volume justifies it.', '有强老师、没有简单的验证器：该走蒸馏，而不是强化学习；而且要等请求量足够大才值得。') },
      ] },
    },
    // ---------------------------------------------------------------- 5. case 7 (capability with a verifier)
    ...case7(),
    // ---------------------------------------------------------------- 6. quick triage
    ...triage(),
    // ---------------------------------------------------------------- 7. your project and the bank
    card_page('card',
      T('Evaluate first and do not change weights by default; name the gap; let your signal pick the method; check data, constraints and the method\'s own evaluation before you ship.', '评测先行，默认不改权重；说清差距；让信号决定方法；上线前查清数据、约束和这个方法专属的验收。'),
      T('Choosing by familiarity or fashion - fine-tuning because the data is at hand, RL because reasoning models use it - instead of by the gap and the signal.', '按熟悉程度或流行程度来选：手头有数据就微调，推理模型用强化学习就也上强化学习，而不是按差距和信号来选。'),
      { en: 'the whole map', zh: '整张决策图' }),
    {
      id: 'own', kind: 'checkpoint', skill: 'f1-plan', purpose: 'check', chapter: T('Your project', '你的项目'), title: T('Walk your own project through the map', '把你的项目走一遍决策图'),
      prompt: T('Describe a project you care about and walk it through the map: the evaluation, the gap, the route, the data, two risks and how you will know it worked.', '描述一个你关心的项目，沿决策图走一遍：评测、差距、路径、数据、两条风险，以及你怎么知道它成功了。'),
      question: { type: 'text', placeholder: T('Project: ... Evaluation: ... Gap: ... Route: ... Data: ... Risks: ... Success means: ...', '项目：……评测：……差距：……路径：……数据：……风险：……成功的标准：……'), rubric: {
        key_points: [
          T('The gap type is named, with a reason (e.g. "it answers once the document is in the prompt").', '说出差距类型并给出理由（例如"把文档放进提示后就答对了"）。'),
          T('The method matches the signal, and the cheaper step (context) was tried first or its skipping is explained.', '方法和信号匹配，并且先试了更便宜的上下文做法，或说明了为什么跳过。'),
          ...RUBRIC_PLAN,
        ],
        model_answer: T('A full answer names the gap with evidence, picks the method from the available signal after a context baseline, says where the data comes from and how it is cleaned, gives two concrete risks with mitigations, and defines success with a task metric, a method-specific signal and a regression check.', '完整的回答会：用证据说清差距；在上下文基线之后，按手里的信号选方法；说明数据从哪来、怎么清洗；给出两条具体风险和缓解办法；用任务指标、方法专属信号和回归检查来定义成功。'),
        min_points: 4,
      } },
    },
    {
      id: 'bank', kind: 'read', chapter: T('Case bank', '案例库'), title: T('Eleven cases for practice', '十一个练习案例'),
      blocks: [
        { type: 'p', text: T('All the cases of this lesson, plus the ones you saw only briefly. Numbers marked as settings are invented for the case; the others are sourced in the lessons.', '本课所有案例，以及只简短出现过的那几个。标为"设定"的数字是为案例虚构的；其余数字的出处见各课。') },
        bank(T('1  Internal policy assistant - no fine-tuning', '1  内部政策助手——不微调'), T('800 policies changed weekly; citations; permissions.', '800 份政策，每周变；要出处；有权限。'), T('fine-tune on Q&A pairs', '用问答对微调'), T('evals → baseline → knowledge → too big for the context → RAG → fix retrieval', '评测 → 基线 → 知识 → 放不进上下文 → RAG → 修检索'), T('200 questions with answer chunks; 30 unanswerable', '200 个带答案块的问题；30 个答不了的问题'), T('outdated versions, leaks, injected instructions', '过时版本、越权泄露、注入的指令'), T('Recall@10, faithfulness, refusal rate, permission test', 'Recall@10、忠实度、拒答率、越权测试')),
        bank(T('2  Contract fields as JSON - fix the prompt', '2  合同字段抽取——改提示即可'), T('3% invalid JSON; a field often missed.', '3% 的 JSON 不合法；某个字段常漏。'), T('collect 2,000 examples and fine-tune', '收集 2,000 条样本去微调'), T('baseline → structured output', '基线 → 结构化输出'), T('100 annotated contracts (setting)', '100 份标注好的合同（设定）'), T('constraints fix format, not content', '约束解码保证格式，不保证内容'), T('per-field precision and recall; JSON validity', '逐字段的精确率和召回率；JSON 合法率')),
        bank(T('3  Ticket routing - encoder classifier', '3  工单路由——编码器分类模型'), T('500k tickets a day, 15 queues, 50 ms.', '每天 50 万张，15 个队列，50 毫秒。'), T('a generative model writing the queue name', '用生成式模型写出队列名'), T('fixed labels → encoder classifier', '固定标签 → 编码器分类模型'), T('30k past labels, cleaned; last month held out', '3 万条历史标签，清洗后使用；最近一个月留作测试'), T('queues change; rare classes; drift', '队列调整、长尾类别、分布漂移'), T('per-class precision/recall, confusion matrix, re-routing rate', '各类精确率和召回率、混淆矩阵、转派率')),
        bank(T('4  Medical literature search - tune the retriever', '4  医学文献检索——微调检索器'), T('abbreviated questions; the right paper outside the top 200.', '提问用缩写；正确文献排在 200 名以外。'), T('a bigger generator', '换更大的生成模型'), T('RAG → fix retrieval → tune the retriever (A2b)', 'RAG → 修检索 → 微调检索器（A2b）'), T('doctors\' queries and model-written queries; mined negatives filtered with a margin', '医生的提问和模型写的提问；挖出的负例按阈值过滤'), T('false negatives, re-indexing cost, regressions on general queries', '假负例、重建索引的成本、通用查询退步'), T('Recall@20 and nDCG@10 before/after, on queries from unseen papers', '在未见过的文献对应的查询上，比较微调前后的 Recall@20 和 nDCG@10')),
        bank(T('5  Customer-service tone and tools - SFT with LoRA', '5  客服语气与工具——LoRA 做 SFT'), T('80% pass with prompting; drift in long chats; tool arguments.', '提示词下 80% 合格；长对话走样；工具参数出错。'), T('RLHF straight away, or ever longer prompts', '直接上 RLHF，或无限加长提示'), T('baseline → behaviour → demonstrations: SFT (→ comparisons: DPO)', '基线 → 行为 → 示范：SFT（→ 比较：DPO）'), T('1-3k curated chats, personal data removed, tool calls executed in a sandbox (setting)', '1,000–3,000 条精选对话，去除个人信息，工具调用在沙盒里执行过（设定）'), T('memorised personal data, fixed phrasing, weaker safety', '背下个人信息、措辞僵化、安全性下降'), T('rubric judge calibrated on human labels; argument validity; safety regression; A/B', '在人工标注上校准过的评分细则评委；参数合法率；安全回归；A/B 测试')),
        bank(T('6  Refusal calibration - DPO, carefully', '6  拒答校准——小心地用 DPO'), T('over-refuses safe medical questions, sometimes lets harmful ones through.', '对正常用药问题过度拒答，对有害请求偶尔放行。'), T('more refusal SFT; DPO on near-identical pairs', '加更多拒答示例做 SFT；用几乎一样的偏好对做 DPO'), T('behaviour → comparisons: DPO → reward source', '行为 → 比较：DPO → 奖励来源'), T('borderline prompts in safe and harmful versions; preferences from medical advisers', '边界提示的安全版和有害版；偏好由医学顾问判断'), T('likelihood displacement (refusals fell from 74.4% to 33.4% in one study)', '似然位移（有研究里拒答率从 74.4% 降到 33.4%）'), T('false-refusal rate and harmful-pass rate together; chosen log-probs', '误拒率和有害放行率一起看；被选回答的 log 概率')),
        bank(T('7  Text-to-SQL - verifier and managed RFT', '7  Text-to-SQL——验证器与托管强化微调'), T('400 tables, schema changes monthly; 55% execution accuracy.', '400 张表，表结构每月变；执行正确率 55%。'), T('schema into the weights; comparisons instead of execution', '把表结构写进权重；用比较代替执行'), T('schema by RAG → model sometimes right? → data → verifier: RLVR / RFT', '表结构用 RAG → 模型偶尔能做对？→ 数据 → 验证器：RLVR / 强化微调'), T('2,000 questions with gold SQL from logs; a test database with edge cases', '从日志得到 2,000 道带标准 SQL 的题；覆盖边界情况的测试库'), T('grader fooled by empty results; schema drift; write access', '空结果骗过评分器；表结构漂移；写权限'), T('held-out execution accuracy, pass@k, audited grader, length and zero-variance share', '留出题的执行正确率、pass@k、抽查评分器、回答长度与零方差组比例')),
        bank(T('8  Tool-calling agent - context, then trajectories', '8  工具调用智能体——先上下文，再轨迹'), T('40 internal APIs, 4-8 steps per task.', '40 个内部 API，每个任务 4–8 步。'), T('agent RL without a sandbox; all 40 tools in the prompt', '没有沙盒就做智能体强化学习；把 40 个工具全塞进提示'), T('baseline → data (trajectories) → SFT (→ RL with a verifier)', '基线 → 数据（轨迹）→ SFT（→ 带验证器的强化学习）'), T('300 task templates with checkable success; successful trajectories from a strong model', '300 个可检查成功与否的任务模板；强模型跑出的成功轨迹'), T('side effects during training; API changes; unconfirmed dangerous actions', '训练时产生真实副作用；接口变化；危险操作未经确认'), T('task success in the sandbox, invalid-call rate, blocked dangerous actions', '沙盒任务成功率、无效调用率、危险操作拦截率')),
        bank(T('9  Call summaries - distil, if volume justifies it', '9  通话摘要——量够大才蒸馏'), T('300k calls a day, cost and compliance.', '每天 30 万通，成本与合规。'), T('only shortening the prompt; RL on the small model', '只缩短提示；在小模型上做强化学习'), T('cost math → compliance → distil to a small model', '算成本 → 合规 → 蒸馏到小模型'), T('20k transcripts with filtered teacher summaries; 300 human summaries as a test set (setting)', '2 万通转写配过滤后的老师摘要；300 份人工摘要作测试集（设定）'), T('inherits teacher errors; invented content; teacher licence', '继承老师的错误；编造内容；老师的许可证'), T('rubric scores, teacher-student gap, cost and latency per call', '评分细则得分、师生差距、每通的成本和延迟')),
        bank(T('10  Competition maths on 7B - distil before RL', '10  7B 竞赛数学——先蒸馏再强化学习'), T('problems with answers; a licensed strong teacher.', '有答案的题目；可用的强老师。'), T('GRPO directly on the 7B model', '直接在 7B 上做 GRPO'), T('capability → teacher: distil → model sometimes right? → RLVR', '能力 → 有老师：蒸馏 → 模型偶尔能做对？→ RLVR'), T('teacher traces kept only when the answer is right; deduplicated against the test set', '只保留答案正确的老师轨迹；与测试集去重'), T('contamination, runaway length, weaker general skills', '评测污染、长度失控、通用能力下降'), T('pass@1, pass@k, majority vote, length distribution, regression set', 'pass@1、pass@k、多数投票、长度分布、回归测试')),
        bank(T('11  Cantonese support - continued pretraining, then SFT', '11  粤语客服——先继续预训练，再 SFT'), T('stiff Cantonese mixed with Mandarin; 500M tokens of text, 2k chats (setting).', '粤语生硬、夹杂普通话；5 亿 token 文本，2,000 条对话（设定）。'), T('SFT on the 2,000 chats only', '只用 2,000 条对话做 SFT'), T('capability → continued pretraining → data → SFT', '能力 → 继续预训练 → 数据 → SFT'), T('cleaned, deduplicated text mixed with general and chat data; native-speaker test set', '清洗、去重后的文本，混入通用和对话数据；母语者编写的测试集'), T('forgetting of English and Mandarin; unsafe forum text; tokenizer inefficiency', '英文和普通话能力遗忘；论坛文本不当内容；分词器切分效率低'), T('native-speaker rubric scores; English and Mandarin regression; safety', '母语者按细则评分；英文和普通话回归；安全测试')),
      ],
    },
  ],
};

// ---------------------------------------------------------------- case 5: behaviour you can demonstrate
function case5() {
  const g = case_group('f1-c5', T('Case 5: customer-service tone and tools', '案例 5：客服语气与工具调用'), [
    { type: 'p', text: T('An online shop wants every reply in the brand\'s tone and a fixed structure (empathy, then a solution, then a confirmation), and refunds through `refund(order_id, reason)` with valid arguments. A careful system prompt with examples passes 80% of the evaluation. The failures cluster in two places: the tone drifts in long conversations, and tool arguments go wrong after several turns.', '一家网店要求每条回复都用品牌语气、固定结构（先共情，再给方案，最后确认），退款要通过 `refund(order_id, reason)`，参数必须合法。精心写的系统提示词加示例，在评测上有 80% 合格。失败集中在两处：长对话里语气走样，多轮之后工具参数出错。') },
  ]);
  return [
    {
      id: 'c5-route', kind: 'checkpoint' as const, skill: 'f1-route', purpose: 'practice' as const, chapter: T('Case 5', '案例 5'), group: g,
      prompt: T('Which route?', '走哪条路？'),
      question: { type: 'choice' as const, options: [
        { id: 'sft', label: T('SFT with LoRA on curated conversations, with the production system prompt and tool definitions in every example', '用精选对话做 SFT（LoRA），每条样本都带上线上的系统提示词和工具定义'), correct: true },
        { id: 'rlhf', label: T('Train a reward model and run RLHF', '训练奖励模型，再做 RLHF'), misconception: 'rl-strictly-better', feedback: T('You can write the right replies - demonstrations are the stronger and cheaper signal.', '你写得出正确的回复：示范是更强、也更便宜的信号。') },
        { id: 'prompt', label: T('Keep extending the prompt', '继续加长提示词'), feedback: T('That is the baseline you already have; long chats still drift and every call gets more expensive.', '那就是已有的基线；长对话照样走样，每次调用还更贵。') },
      ] },
    },
    {
      id: 'c5-data', kind: 'checkpoint' as const, skill: 'f1-plan', purpose: 'check' as const, group: g,
      prompt: T('Write the plan: data (source, size, cleaning), two risks with mitigations, and the evaluation.', '写出方案：数据（来源、规模、清洗）、两条风险及缓解办法、以及评测。'),
      question: { type: 'text' as const, rubric: {
        key_points: [
          T('Data: past chats filtered for quality, personal data removed, possibly rewritten in the brand tone and spot-checked; tool calls executed in a sandbox; hundreds to a few thousand examples; loss on assistant turns only.', '数据：筛选过质量的历史对话，去除个人信息，可按品牌语气改写并抽查；工具调用在沙盒里执行过；几百到几千条；只在客服回复上算损失。'),
          T('Risks: memorising personal data, fixed phrasing, weaker safety after fine-tuning - with mitigations (scrubbing, varied data, a safety regression).', '风险：背下个人信息、措辞僵化、微调后安全性下降，并给出缓解办法（清洗、数据多样化、安全回归）。'),
          T('Evaluation: a rubric judge calibrated on human labels, tool-argument validity, general and safety regression, then an A/B test.', '评测：在人工标注上校准过的评分细则评委、工具参数合法率、通用和安全回归，最后做 A/B 测试。'),
        ],
        model_answer: T('Data: 1-3k high-rated past chats, personal data removed, rewritten to the brand tone by a model and spot-checked, with tool calls replayed in a sandbox; train LoRA on assistant turns only, in the production template. Risks: memorised personal data (scrub, check outputs), weaker safety (safety regression set). Evaluation: rubric scores from a judge calibrated on 200 human-rated replies, argument validity rate, regression sets, then an A/B test on hand-off rate and satisfaction.', '数据：1,000–3,000 条高评分历史对话，去除个人信息，由模型按品牌语气改写并抽查，工具调用在沙盒里重放验证；只在客服回复上训练 LoRA，格式与线上模板一致。风险：背下个人信息（清洗、检查输出）、安全性下降（安全回归集）。评测：用在 200 条人工评分回复上校准过的评委按细则打分，统计参数合法率，跑回归集，最后用 A/B 测试看转人工率和满意度。'),
        min_points: 2,
      } },
    },
  ];
}

// ---------------------------------------------------------------- case 7: a verifier exists
function case7() {
  const g = case_group('f1-c7', T('Case 7: Text-to-SQL', '案例 7：Text-to-SQL'), [
    { type: 'p', text: T('Analysts ask questions in plain language about a warehouse with 400 tables whose schema changes every month. Today\'s large-model SQL returns the right result 55% of the time. There are 2,000 past questions with correct SQL, and a read-only test database.', '分析师用自然语言查询一个有 400 张表的数据仓库，表结构每月都有变化。目前大模型生成的 SQL，执行结果正确的比例是 55%。手上有 2,000 道带正确 SQL 的历史问题，以及一个只读测试库。') },
  ]);
  return [
    {
      id: 'c7-schema', kind: 'checkpoint' as const, skill: 'f1-route', purpose: 'practice' as const, chapter: T('Case 7', '案例 7'), group: g,
      prompt: T('Where should the table schemas live?', '表结构应该放在哪里？'),
      question: { type: 'choice' as const, options: [
        { id: 'ctx', label: T('In the context: retrieve the relevant table definitions for each question', '放在上下文里：每个问题检索相关的表定义'), correct: true },
        { id: 'w', label: T('In the weights: fine-tune on the schema documentation', '写进权重：用表结构文档去微调'), misconception: 'ft-injects-knowledge', feedback: T('The schema changes every month: it is knowledge, and knowledge goes into the context.', '表结构每月都变：它是知识，知识放进上下文。') },
      ] },
    },
    {
      id: 'c7-signal', kind: 'checkpoint' as const, skill: 'f1-route', purpose: 'practice' as const, group: g,
      prompt: T('To improve the SQL itself, which signal is best here?', '要提升 SQL 本身，这里最好的信号是什么？'),
      question: { type: 'choice' as const, options: [
        { id: 'ver', label: T('A verifier: run the SQL on the test database and compare the result with the gold query\'s - for rejection-sampled SFT, then RLVR or managed RFT', '验证器：在测试库上执行 SQL，和标准 SQL 的结果比较。先用它做拒绝采样 SFT，再做 RLVR 或托管强化微调'), correct: true },
        { id: 'pref', label: T('People comparing pairs of queries, then DPO', '请人两两比较 SQL，再做 DPO'), feedback: T('When a program can check the answer, comparisons are a weaker and costlier signal.', '程序能判对错时，比较是更弱、也更贵的信号。') },
        { id: 'sft', label: T('SFT on the 2,000 gold queries only', '只用 2,000 条标准 SQL 做 SFT'), feedback: T('A reasonable first step - but the verifier lets you use far more of the model\'s own correct attempts.', '可以作为第一步；但有了验证器，就能利用模型自己大量做对的尝试。') },
      ] },
    },
    {
      id: 'c7-grader', kind: 'checkpoint' as const, skill: 'f1-plan', purpose: 'practice' as const, group: g,
      prompt: T('The grader says "correct" whenever the two results are equal. What can fool it?', '评分器只要两个结果相同就判"正确"。什么情况会骗过它？'),
      question: { type: 'choice' as const, options: [
        { id: 'empty', label: T('A table that is empty in the test database: a wrong query also returns "nothing", which equals "nothing"', '测试库里某张表是空的：错误的查询也返回"空"，和"空"相等'), correct: true },
        { id: 'long', label: T('A very long SQL query', '特别长的 SQL') },
        { id: 'none', label: T('Nothing: executing the SQL is a perfect check', '骗不了：执行 SQL 是完美的检查') },
      ] },
      explain: T('Fill the test database so that wrong queries give different results, add non-empty assertions, and audit a sample of "correct" verdicts by hand.', '给测试库填上足够的数据，让错误的查询返回不同结果；加上非空断言；再人工抽查一部分被判为"正确"的结果。'),
    },
    {
      id: 'c7-variant', kind: 'checkpoint' as const, skill: 'f1-plan', purpose: 'check' as const, group: g,
      prompt: T('Change one condition: there is no test database you are allowed to run queries on. What changes in the plan?', '改一个条件：没有可以执行查询的测试库。方案要怎么变？'),
      question: { type: 'text' as const, rubric: {
        key_points: [
          T('Without execution there is no verifier, so RLVR / RFT on execution results is no longer possible.', '不能执行，就没有验证器，基于执行结果的 RLVR / 强化微调就做不了了。'),
          T('Fall back to demonstrations: experts write or check gold SQL, then SFT.', '退回到示范：由专家写或核对标准 SQL，再做 SFT。'),
          T('An LLM judge comparing SQL could serve as a reward, but only after calibration on human labels, and watched for reward hacking.', '可以用大模型评委比较 SQL 作为奖励，但要先在人工标注上校准，并防范奖励投机。'),
        ],
        model_answer: T('There is no verifier any more, so the execution-based RL is gone. Use demonstrations: experts write or check the SQL and we fine-tune on it; schemas still come from retrieval. If we want a reward signal, an LLM judge that compares queries must first agree with human checks on a sample, and be audited for hacking.', '没有验证器了，基于执行结果的强化学习就做不了。改用示范：专家写或核对 SQL，用它们做微调；表结构仍然靠检索提供。如果还想要奖励信号，用大模型评委比较 SQL，必须先在一批样本上和人工判断对齐，并检查有没有被钻空子。'),
        min_points: 2,
      } },
    },
  ];
}

// ---------------------------------------------------------------- quick triage of the remaining cases
function triage() {
  const g = case_group('f1-triage', T('Quick triage', '快速分诊'), [{ type: 'p', text: T('Short cases from the bank. For each, the route you would try first.', '案例库里的短案例。每个都选出你会先走的路。') }]);
  const q = (id: string, prompt: L, options: { id: string; label: L; correct?: boolean; misconception?: string; feedback?: L }[], explain?: L) => ({
    id, kind: 'checkpoint' as const, skill: 'f1-trap', purpose: 'practice' as const, group: g, prompt, question: { type: 'choice' as const, options }, ...(explain ? { explain } : {}),
  });
  return [
    { ...q('t-ticket', T('500k tickets a day into 15 queues, 30k labelled examples.', '每天 50 万张工单，分到 15 个队列，有 3 万条标注。'), [
      { id: 'a', label: T('encoder classifier', '编码器分类模型'), correct: true },
      { id: 'b', label: T('SFT a 7B chat model', '给 7B 对话模型做 SFT'), misconception: 'llm-for-everything' },
      { id: 'c', label: T('RAG', 'RAG') },
    ]), chapter: T('Quick triage', '快速分诊') },
    q('t-json', T('JSON output is invalid 3% of the time.', 'JSON 输出有 3% 不合法。'), [
      { id: 'a', label: T('structured output at decoding, then re-evaluate', '解码时用结构化输出，然后重新评测'), correct: true },
      { id: 'b', label: T('fine-tune on 2,000 examples', '用 2,000 条样本微调'), misconception: 'ft-is-default' },
    ]),
    q('t-med', T('Medical search: the right paper is outside the top 300; BM25 fails too.', '医学检索：正确文献在 300 名以外，BM25 也找不到。'), [
      { id: 'a', label: T('query rewriting, then fine-tune the embedding model and re-index', '查询改写，再微调向量模型并重建索引'), correct: true },
      { id: 'b', label: T('fine-tune the generator', '微调生成模型'), misconception: 'fix-generator-first' },
      { id: 'c', label: T('add only a reranker', '只加重排模型'), feedback: T('It cannot reorder what it never receives.', '它没法重排自己拿不到的候选。') },
    ]),
    q('t-refuse', T('A health assistant refuses safe dosage questions; you plan DPO with "refuse" vs "almost the same answer, not refusing".', '健康助手拒答正常的用药问题；你打算用"拒答"对"几乎一样但不拒答的回答"做 DPO。'), [
      { id: 'a', label: T('Build clearly different pairs on borderline prompts, filter near-identical ones, and watch the chosen answers\' log-probs', '在边界提示上构造差异明显的偏好对，过滤掉几乎一样的，并监控被选回答的 log 概率'), correct: true },
      { id: 'b', label: T('Go ahead: DPO always raises the chosen answer', '照做：DPO 总会提高被选回答'), misconception: 'dpo-raises-chosen', feedback: T('With near-identical pairs, likelihood displacement can push probability elsewhere - refusals fell from 74.4% to 33.4% in one study.', '偏好对几乎一样时，似然位移会把概率推到别处：有研究里拒答率从 74.4% 降到 33.4%。') },
    ]),
    q('t-agent', T('An ops assistant with 40 internal APIs, 4-8 steps per task, no sandbox yet.', '运维助手要调用 40 个内部 API，每个任务 4–8 步，还没有沙盒。'), [
      { id: 'a', label: T('tool definitions with retrieval of the relevant tools; build a sandbox; then SFT on successful trajectories', '写好工具定义并按任务检索相关工具；搭沙盒；再用成功轨迹做 SFT'), correct: true },
      { id: 'b', label: T('agentic RL now', '现在就做智能体强化学习'), misconception: 'rl-strictly-better', feedback: T('Without a reproducible environment and a success check, there is no reward.', '没有可复现的环境和成功判定，就没有奖励。') },
    ]),
    q('t-long', T('During GRPO training the answers get longer and longer. Good news?', 'GRPO 训练中，回答越来越长。这是好事吗？'), [
      { id: 'a', label: T('Not by itself: check accuracy on held-out problems and how the loss averages over length', '不一定：看留出题的准确率，以及损失是怎么按长度平均的'), correct: true },
      { id: 'b', label: T('Yes: longer reasoning is better reasoning', '是：推理越长越强'), misconception: 'longer-is-better' },
    ]),
    q('t-canto', T('Natural written Cantonese from 2,000 chats and a model that mixes in Mandarin.', '只有 2,000 条对话，想让一个夹杂普通话的模型写出地道粤语。'), [
      { id: 'a', label: T('continued pretraining on a lot of Cantonese text mixed with chat data, then SFT', '用大量粤语文本做继续预训练（混入对话数据），再做 SFT'), correct: true },
      { id: 'b', label: T('SFT on the 2,000 chats', '用 2,000 条对话做 SFT'), misconception: 'few-examples-suffice' },
    ]),
  ];
}
