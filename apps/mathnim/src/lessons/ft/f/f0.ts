// F0 "Choosing, halfway" (中场选择练习): ten minutes after part B. Only the
// routes known by then - context (prompting, RAG), an encoder classifier,
// SFT, continued pretraining - on five short cases and one of your own.
// Plan: docs/lessons/llm-finetuning/part-f-choosing.md (F0 added 2026-10-10).
import type { Lesson } from '@mathnim/core';
import { card_page, case_group, map_scene, T } from './kit';

const CASES = case_group('f0-cases', T('Five requests', '五个需求'), [
  { type: 'p', text: T('Each request comes from a real kind of project. Pick the route you would take first - and notice the tempting option that would waste the most time.', '每个需求都来自一类真实的项目。选出你会先走的路，并留意哪个选项最诱人、却最浪费时间。') },
]);

export const lesson: Lesson = {
  id: 'ft-f0',
  title: T('Choosing, halfway', '中场选择练习'),
  description: T('Five short cases with the routes you know so far: context, RAG, an encoder classifier, SFT, continued pretraining.', '用目前学过的几条路练习选择：上下文、RAG、编码器分类模型、SFT、继续预训练。五个短案例。'),
  mode: 'essay',
  skills: [{ id: 'f0-route', name: T('Choose among context, classifier and SFT', '在上下文、分类模型和 SFT 之间做选择') }],
  misconceptions: [
    { id: 'ft-is-default', description: T('Building with LLMs means fine-tuning.', '做大模型应用就该微调。') },
    { id: 'ft-injects-knowledge', description: T('To make a model know new facts, fine-tune it on them.', '要让模型知道新东西，就拿这些资料去微调。') },
    { id: 'llm-for-everything', description: T('Classification should also use a generative LLM.', '分类任务也该用生成式大模型。') },
    { id: 'few-examples-suffice', description: T('A few thousand examples are enough to teach a new language.', '几千条样本就够教会一门新语言。') },
  ],
  steps: [
    {
      id: 'intro', kind: 'read', chapter: T('Halfway', '中场'), title: T('Three routes you can already take', '你已经会走的三条路'),
      blocks: [
        { type: 'p', text: T('Before preferences and reinforcement learning, practise the decisions that come up most often. You know three routes, and a check before any of them:', '在学偏好优化和强化学习之前，先练最常遇到的那些决定。你已经会三条路，外加一个走任何一条之前都要做的检查：') },
        { type: 'list', ordered: true, items: [
          T('**First**: is there an evaluation set, and how far does the strongest model get with good context - instructions, examples, structured output?', '**先检查**：有没有评测集？最强的模型配上好的上下文（指令、示例、结构化输出）能做到什么程度？'),
          T('**Missing knowledge** → put it into the context: the whole thing if small, RAG if not.', '**缺知识** → 放进上下文：内容少就整体放入，内容多就用 RAG。'),
          T('**Output is a fixed label** → an encoder classifier.', '**输出是固定标签** → 编码器分类模型。'),
          T('**Unstable behaviour you can demonstrate** → SFT (LoRA), trained in exactly the format used at inference. A new language or domain style that needs lots of text → continued pretraining first.', '**行为不稳，而且你能写出示范** → SFT（LoRA），训练格式要和线上完全一致。需要大量文本才能学会的新语言或领域语体 → 先做继续预训练。'),
        ] },
      ],
    },
    map_scene('map', 'F0', T(
      'Here is the map so far, with three routes lit: the label check that leads to an encoder classifier, retrieval for missing knowledge, and supervised fine-tuning for behaviour you can demonstrate. Everything else on the map comes later.',
      '这是到目前为止的决策图，亮着三条路：输出是固定标签时走编码器分类模型，缺知识时走检索，能写出示范的行为问题走监督微调。图上其余部分后面再学。',
    )),
    {
      id: 'c1', kind: 'checkpoint', skill: 'f0-route', purpose: 'practice', group: CASES,
      prompt: T('HR policy assistant for 3,000 employees. About 800 policy documents, changed every week; answers must cite the source; some documents are managers-only.', '给 3,000 名员工用的人事政策助手。约 800 份政策文档，每周都有改动；回答要附出处；部分文档只有经理能看。'),
      question: { type: 'choice', options: [
        { id: 'rag', label: T('RAG with permission filtering at retrieval, dates as metadata, "say when it is not in the documents"', 'RAG：检索时按权限过滤，日期作为元数据，"文档里没有就明说"'), correct: true },
        { id: 'sft', label: T('Turn the policies into Q&A pairs and fine-tune', '把政策整理成问答对去微调'), misconception: 'ft-injects-knowledge', feedback: T('Weekly changes would mean weekly retraining; no citations; no way to keep managers-only text away from others.', '每周都变，就得每周重训；没法附出处；也没法把只限经理看的内容挡在外面。') },
        { id: 'all', label: T('Paste all 800 documents into every prompt', '把 800 份文档全部塞进每次的提示'), feedback: T('Far beyond ~200k tokens, and it would ignore permissions.', '远超约 20 万 token，而且无视权限。') },
      ] },
    },
    {
      id: 'c2', kind: 'checkpoint', skill: 'f0-route', purpose: 'practice', group: CASES,
      prompt: T('Extract 20 fields from contracts as JSON. Today a large model with a prompt produces invalid JSON 3% of the time and often misses the "penalty" field.', '从合同中抽取 20 个字段，输出 JSON。目前大模型加提示词，3% 的输出 JSON 不合法，还经常漏掉"违约金"字段。'),
      question: { type: 'choice', options: [
        { id: 'struct', label: T('Structured output (a JSON schema enforced at decoding), split the prompt, add two "penalty" examples - then re-evaluate', '用结构化输出（解码时按 JSON Schema 强制格式）、拆分提示、给"违约金"加两个示例，然后重新评测'), correct: true },
        { id: 'sft', label: T('Collect 2,000 examples and fine-tune', '收集 2,000 条样本做微调'), misconception: 'ft-is-default', feedback: T('Possible later, but an expensive fix for a cheap problem: decoding constraints guarantee valid JSON today.', '以后也许可以，但这是用昂贵的手段解决便宜的问题：解码约束今天就能保证 JSON 合法。') },
        { id: 'rag', label: T('RAG over past contracts', '对过往合同做 RAG'), feedback: T('Nothing is missing from the model\'s knowledge; it is a format and attention problem.', '模型不缺知识，问题在格式和注意力。') },
      ] },
      explain: T('Constrained decoding guarantees the format, not the content - so per-field accuracy still needs its own evaluation.', '约束解码保证的是格式，不是内容；每个字段对不对，仍然要单独评测。'),
    },
    {
      id: 'c3', kind: 'checkpoint', skill: 'f0-route', purpose: 'practice', group: CASES,
      prompt: T('500,000 tickets a day must go to one of 15 queues within 50 ms. 30,000 past tickets carry the queue a person chose.', '每天 50 万张工单，要在 50 毫秒内分到 15 个队列之一。已有 3 万张历史工单，标着人工选定的队列。'),
      question: { type: 'choice', options: [
        { id: 'enc', label: T('Fine-tune an encoder classifier; check the old labels first and keep the newest month as a test set', '微调一个编码器分类模型；先清洗旧标签，把最近一个月留作测试集'), correct: true },
        { id: 'llm', label: T('Fine-tune a 7B chat model to write the queue name', '微调一个 7B 对话模型，让它写出队列名'), misconception: 'llm-for-everything', feedback: T('Generating text to choose among 15 labels costs orders of magnitude more, and 50 ms is hard to meet.', '为了在 15 个标签里选一个而去生成文字，成本高出几个数量级，50 毫秒也很难做到。') },
        { id: 'api', label: T('Call a large model with a prompt for every ticket', '每张工单都调用大模型加提示词'), feedback: T('A good way to measure the ceiling and check labels - too slow and costly as the production path here.', '适合用来测上限、检查标签；作为这里的线上方案，太慢也太贵。') },
      ] },
    },
    {
      id: 'c4', kind: 'checkpoint', skill: 'f0-route', purpose: 'practice', group: CASES,
      prompt: T('Customer service must use the brand\'s tone and a fixed structure, and call refund(order_id, reason) correctly. A careful prompt with examples passes 80% of the evaluation; failures are tone drift in long conversations and wrong tool arguments after several turns.', '客服回复要用品牌语气、固定结构，还要正确调用 refund(order_id, reason)。精心写的提示词加示例，在评测上已有 80% 合格；剩下的失败是长对话里语气走样，以及多轮之后调用参数出错。'),
      question: { type: 'choice', options: [
        { id: 'sft', label: T('SFT with LoRA on 1,000-3,000 curated conversations, with the same system prompt and tool definitions as in production; loss only on the assistant turns', '用 1,000–3,000 条精选对话做 SFT（LoRA），带上和线上相同的系统提示词和工具定义；只在客服回复上算损失'), correct: true },
        { id: 'more', label: T('Keep adding rules to the prompt', '继续往提示词里加规则'), feedback: T('That was the baseline. Longer prompts cost more on every call, and long conversations still drift.', '那就是已经试过的基线。提示越长，每次调用越贵，长对话照样走样。') },
        { id: 'raw', label: T('SFT on bare question-answer pairs, without the system prompt and tools', '用裸的问答对做 SFT，不带系统提示词和工具'), feedback: T('The model would then meet inputs at inference that it never saw in training.', '这样模型上线时遇到的输入，是它训练时从没见过的格式。') },
      ] },
    },
    {
      id: 'c5', kind: 'checkpoint', skill: 'f0-route', purpose: 'practice', group: CASES,
      prompt: T('Replies in natural written Cantonese. The open model writes stiff Cantonese mixed with Mandarin. You have about 500 million tokens of licensed Cantonese text and 2,000 support conversations.', '要用地道的粤语书面语回复。现有开源模型的粤语生硬，夹杂普通话。手上有约 5 亿 token、许可已核实的粤语文本，以及 2,000 条客服对话。'),
      question: { type: 'choice', options: [
        { id: 'cpt', label: T('Continued pretraining on the Cantonese text mixed with general and chat data, then SFT on the conversations', '先用粤语文本做继续预训练，混入通用和对话数据，再用客服对话做 SFT'), correct: true },
        { id: 'sft', label: T('SFT on the 2,000 conversations only', '只用 2,000 条对话做 SFT'), misconception: 'few-examples-suffice', feedback: T('SFT mostly teaches format; the language itself needs a lot of text.', 'SFT 主要教格式，语言本身要靠大量文本。') },
        { id: 'docs', label: T('Continued pretraining on the Cantonese text alone', '只用粤语文本做继续预训练'), feedback: T('Without mixing in chat data the model loses instruction following: in one study IF-eval fell to 45% with documents only, versus 79% with a 70/30 mix.', '不混入对话数据，模型会丢掉指令遵循能力：有研究里只用文档时 IF-eval 掉到 45%，文档与对话 70/30 混合时保持在 79%。') },
      ] },
    },
    card_page('card',
      T('First the evaluation and a context baseline. Then: missing knowledge goes into the context (RAG if large); a fixed label goes to an encoder classifier; behaviour you can demonstrate goes to SFT in the exact production format; a new language needs continued pretraining with mixed-in chat data before SFT.', '先有评测和上下文基线。然后：缺知识放进上下文（内容多就用 RAG）；固定标签交给编码器分类模型；能示范的行为用 SFT，格式和线上一致；新语言要先做继续预训练（混入对话数据），再做 SFT。'),
      T('Reaching for fine-tuning because the data is at hand - FAQ pairs, past tickets, contract samples - when a context fix or a classifier would solve it sooner and cheaper.', '因为手头正好有数据（FAQ、历史工单、合同样本）就去微调，而上下文改进或一个分类模型能更快、更便宜地解决。'),
      { en: 'the label check, the knowledge branch and demonstrations', zh: "'固定标签'、'知识'一支和'示范'" }),
    {
      id: 'own', kind: 'checkpoint', skill: 'f0-route', purpose: 'check', chapter: T('Your project', '你的项目'), title: T('Your own case', '你自己的案例'),
      prompt: T('Describe a task you would like a model to do well. Then say: how you would evaluate it, which kind of gap you expect, and the route you would try first.', '描述一件你希望模型做好的事。然后说明：你打算怎么评测它，你预计差距属于哪一类，以及你会先试哪条路。'),
      question: { type: 'text', placeholder: T('My task: ... I would evaluate it by ... The gap is ... First route: ...', '我的任务：……我会这样评测：……差距属于：……先试：……'), rubric: {
        key_points: [
          T('An evaluation: real examples and how they are scored.', '有评测：真实样例，以及怎么打分。'),
          T('A gap type named with a reason (knowledge, behaviour, capability, cost, or a fixed label).', '说出差距类型并给出理由（知识、行为、能力、成本，或固定标签）。'),
          T('A first route that matches the gap and starts with the cheaper option (context) or says why it is skipped.', '第一条路和差距相符，并且从更便宜的做法（上下文）开始，或说明为什么跳过。'),
        ],
        model_answer: T('Example: "Summarise support calls. I would score 200 real calls against a checklist of key facts. The facts are in the transcript, so the gap is behaviour (structure, length). First route: a prompt with three example summaries and a fixed format; only if it stays below the bar, SFT with LoRA on reviewed summaries."', '示例："总结客服通话。我会用 200 通真实通话，对照一份关键信息清单打分。信息都在转写稿里，所以差距是行为（结构、长度）。先试：提示词加三个示例摘要和固定格式；仍达不到标准，再用审核过的摘要做 LoRA 微调。"'),
        min_points: 2,
      } },
    },
  ],
};
