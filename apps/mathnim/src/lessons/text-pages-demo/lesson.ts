// Platform demo: every kind of text page in one short bilingual lesson, on a
// real topic (LoRA) so it reads like the fine-tuning course will. It uses
// every block type (h, p, list, math, code with tabs, figure, visual, the four
// callouts, details, table, cite), the step kinds read / derive / code, a
// fill-in line, a case with three numbered questions, and a free-text answer.
// Authors: copy patterns from here; the contract is packages/core/src/content.ts.
import type { Lesson } from '@mathnim/core';

const LORA_TORCH = `import torch
import torch.nn as nn

class LoRALinear(nn.Module):
    def __init__(self, base: nn.Linear, r: int = 8, alpha: int = 16):
        super().__init__()
        self.base = base
        self.base.weight.requires_grad_(False)          # W0 stays frozen
        d_out, d_in = base.weight.shape
        self.A = nn.Parameter(torch.randn(r, d_in) * 0.01)
        self.B = nn.Parameter(torch.zeros(d_out, r))    # B = 0: start as the base model
        self.scale = alpha / r

    def forward(self, x):
        # x: [batch, seq, d_in]
        h = self.base(x)                                # W0 x
        delta = (x @ self.A.T) @ self.B.T               # B A x, never forming B A
        return h + self.scale * delta`;

const LORA_PEFT = `from peft import LoraConfig, get_peft_model

config = LoraConfig(
    r=8,
    lora_alpha=16,
    target_modules=["q_proj", "k_proj", "v_proj", "o_proj"],
    lora_dropout=0.05,
    task_type="CAUSAL_LM",
)
model = get_peft_model(model, config)
model.print_trainable_parameters()`;

export const lesson: Lesson = {
  id: 'text-pages-demo',
  title: { en: 'LoRA in four pages (platform demo)', zh: '四页讲清 LoRA（平台演示）' },
  description: { en: 'A tour of the text pages: reading, derivation, code walkthrough, a case with written answers.', zh: '文字类页面导览：阅读、推导、代码讲解，以及带简答题的案例。' },
  mode: 'essay',
  skills: [
    { id: 'demo-lora-params', name: { en: 'Counting LoRA parameters', zh: '计算 LoRA 的参数量' } },
    { id: 'demo-lora-choose', name: { en: 'Deciding when LoRA fits', zh: '判断什么时候用 LoRA' } },
  ],
  misconceptions: [
    { id: 'demo-rank-quality', description: { en: 'A higher LoRA rank always gives a better fine-tune.', zh: 'LoRA 的秩越高，微调效果一定越好。' } },
    { id: 'demo-full-count', description: { en: 'LoRA trains as many parameters as the matrix it adapts.', zh: 'LoRA 训练的参数和被适配的矩阵一样多。' } },
  ],
  steps: [
    // ---------------------------------------------------------------- a read page with every block type
    {
      id: 'idea', kind: 'read', chapter: { en: 'The idea', zh: '思路' }, title: { en: 'Why a low-rank update?', zh: '为什么是低秩更新？' },
      blocks: [
        { type: 'p', text: {
          en: 'Full fine-tuning updates every weight. One $d \\times k$ projection with $d = k = 4096$ already has about **16.8 million** entries. LoRA freezes the pretrained $W_0$ and learns only a correction $\\Delta W = BA$ built from two thin matrices[^hu2021].',
          zh: '全量微调会更新每一个权重。单是一个 $d \\times k$ 的投影矩阵，取 $d = k = 4096$，就有约 **1680 万**个元素。LoRA 冻结预训练好的 $W_0$，只学习一个由两个"瘦"矩阵相乘得到的修正 $\\Delta W = BA$[^hu2021]。',
        } },
        { type: 'h', text: { en: 'What the layer computes', zh: '这一层算的是什么' } },
        { type: 'math', tex: 'h = W_0 x + \\frac{\\alpha}{r}\\, B A x, \\qquad B \\in \\mathbb{R}^{d \\times r},\\; A \\in \\mathbb{R}^{r \\times k}', label: '1' },
        { type: 'list', items: [
          { en: '$W_0$ is frozen: no gradients and no optimizer state for it.', zh: '$W_0$ 被冻结：既不算梯度，也不占优化器状态。' },
          { en: '$B$ starts at zero, so at step 0 the model is exactly the base model.', zh: '$B$ 初始化为零，所以第 0 步时模型与基座模型完全相同。' },
          { en: 'The rank $r$ is small (often 8 to 64), so $B$ and $A$ together are tiny next to $W_0$.', zh: '秩 $r$ 很小（常取 8 到 64），所以 $B$ 和 $A$ 加起来远小于 $W_0$。' },
        ] },
        { type: 'figure', src: 'platform/lora-update.svg',
          alt: { en: 'The input x goes through the frozen d×k matrix W0 and, in parallel, through A (r×k) then B (d×r); the two results are added to give h.', zh: '输入 x 一路经过冻结的 d×k 矩阵 W0，另一路依次经过 A（r×k）和 B（d×r），两路结果相加得到 h。' },
          caption: { en: 'The frozen path and the trainable path. $B = 0$ at the start, so the trainable path adds nothing until training moves it.', zh: '冻结的一路和可训练的一路。开始时 $B = 0$，可训练的一路什么也不加，直到训练改变它。' },
          credit: 'Redrawn after Hu et al. (2021), Figure 1' },
        { type: 'callout', kind: 'note', body: {
          en: 'A $4096 \\times 4096$ matrix has $16{,}777{,}216$ entries; with $r = 8$, $B$ and $A$ have $8 \\cdot (4096 + 4096) = 65{,}536$, about **0.4%**.',
          zh: '一个 $4096 \\times 4096$ 的矩阵有 $16{,}777{,}216$ 个元素；取 $r = 8$ 时，$B$ 和 $A$ 一共只有 $8 \\cdot (4096 + 4096) = 65{,}536$ 个，约 **0.4%**。',
        } },
        { type: 'callout', kind: 'misconception', body: {
          en: '"Higher rank is always better." In the LoRA paper, ranks as small as 1 to 8 did about as well as 64 on the tasks tested[^hu2021]. Rank buys capacity you may not need.',
          zh: '"秩越高越好。"在 LoRA 论文测试的任务上，秩只有 1 到 8 时的效果就和 64 差不多[^hu2021]。更高的秩买来的容量，你未必用得上。',
        } },
        { type: 'h', text: { en: 'See what a low rank means', zh: '看看"低秩"是什么意思' } },
        { type: 'visual', name: 'linear_map', params: { A: [[2, -1], [1, 1]], show_vector: false }, explore: true,
          caption: { en: 'The columns of the matrix are where $\\hat\\imath$ and $\\hat\\jmath$ land. When it has played, drag $\\hat\\jmath$ onto the line through $\\hat\\imath$: the whole plane collapses onto that line, and the matrix has rank 1. A rank-$r$ update can only move outputs within $r$ directions.', zh: '矩阵的两列就是 $\\hat\\imath$ 和 $\\hat\\jmath$ 落到的位置。播放完后，把 $\\hat\\jmath$ 拖到 $\\hat\\imath$ 所在的直线上：整个平面被压到这条线上，矩阵的秩变成 1。秩为 $r$ 的更新只能在 $r$ 个方向上改变输出。' } },
        { type: 'h', text: { en: 'In code', zh: '写成代码' } },
        { type: 'p', text: { en: 'The same adapter by hand and with the `peft` library. Pick a tab; every code block on the page follows your choice.', zh: '同一个适配器，手写一遍，再用 `peft` 库写一遍。选一个标签页，本页所有代码块都会跟着切换。' } },
        { type: 'code', lang: 'python', label: 'PyTorch', code: LORA_TORCH, tabs: [{ label: 'PEFT', lang: 'python', code: LORA_PEFT }],
          caption: { en: 'The hand-written layer multiplies by $A$ first, so the $d \\times k$ product $BA$ is never formed.', zh: '手写版本先乘 $A$，所以 $d \\times k$ 的乘积 $BA$ 从来不会被真正算出来。' } },
        { type: 'code', lang: 'bash', code: 'pip install "peft>=0.11" transformers  # models are cached under $HOME/.cache/huggingface', caption: { en: 'Installing the libraries.', zh: '安装依赖库。' } },
        { type: 'table',
          head: [{ en: 'Method', zh: '方法' }, { en: 'Trained parameters per matrix', zh: '每个矩阵训练的参数' }, { en: '$d = k = 4096$, $r = 8$', zh: '$d = k = 4096$，$r = 8$' }],
          rows: [
            [{ en: 'Full fine-tuning', zh: '全量微调' }, '$d \\cdot k$', '16,777,216'],
            ['LoRA', '$r\\,(d + k)$', '65,536'],
          ] },
        { type: 'callout', kind: 'warning', title: { en: 'Merging by hand', zh: '手动合并时' }, body: {
          en: 'After training you can merge the adapter, $W = W_0 + \\frac{\\alpha}{r} BA$, so inference costs nothing extra. Forget the factor $\\frac{\\alpha}{r}$ and the merged model is not the one you trained.',
          zh: '训练完可以把适配器合并进去：$W = W_0 + \\frac{\\alpha}{r} BA$，推理就没有额外开销。漏掉系数 $\\frac{\\alpha}{r}$，合并出来的就不是你训练的那个模型。',
        } },
        { type: 'details', summary: { en: 'A training config, for reference', zh: '一份训练配置，供参考' }, blocks: [
          { type: 'p', text: { en: 'Configs are often kept as YAML; the trainer logs the counts as JSON.', zh: '配置通常写成 YAML；训练器会把参数统计记成 JSON。' } },
          { type: 'code', lang: 'yaml', code: '# lora.yaml\nlora:\n  r: 8\n  alpha: 16\n  dropout: 0.05\n  target_modules: [q_proj, k_proj, v_proj, o_proj]\ntrain:\n  lr: 2.0e-4\n  epochs: 3\n  bf16: true' },
          { type: 'code', lang: 'json', code: '{"trainable_params": 8388608, "all_params": 6746804224, "trainable_pct": 0.1243, "merged": false}' },
        ] },
        { type: 'callout', kind: 'open', body: {
          en: 'Why do such small ranks suffice? One explanation: the change fine-tuning needs has a low "intrinsic dimension"[^aghajanyan2020]. Whether that holds for every task is still debated.',
          zh: '为什么这么小的秩就够用？一种解释是：微调所需的改变本身"内在维度"很低[^aghajanyan2020]。这是否对所有任务都成立，仍有争论。',
        } },
        { type: 'cite', key: 'hu2021', text: { en: 'Hu et al. (2021). LoRA: Low-Rank Adaptation of Large Language Models.', zh: 'Hu 等（2021）。LoRA: Low-Rank Adaptation of Large Language Models。' }, url: 'https://arxiv.org/abs/2106.09685' },
        { type: 'cite', key: 'aghajanyan2020', text: { en: 'Aghajanyan, Zettlemoyer & Gupta (2020). Intrinsic Dimensionality Explains the Effectiveness of Language Model Fine-Tuning.', zh: 'Aghajanyan、Zettlemoyer、Gupta（2020）。Intrinsic Dimensionality Explains the Effectiveness of Language Model Fine-Tuning。' }, url: 'https://arxiv.org/abs/2012.13255' },
      ],
    },
    // ---------------------------------------------------------------- a derivation with a fill-in line
    {
      id: 'count', kind: 'derive', chapter: { en: 'Counting', zh: '算一算' }, title: { en: 'How many parameters does LoRA train?', zh: 'LoRA 到底训练多少参数？' }, skill: 'demo-lora-params',
      intro: { en: 'We adapt one $d \\times k$ weight matrix with rank $r$. Reveal one line at a time.', zh: '我们用秩 $r$ 去适配一个 $d \\times k$ 的权重矩阵。一次展开一行。' },
      lines: [
        { tex: '\\Delta W = B A, \\qquad B \\in \\mathbb{R}^{d \\times r},\\; A \\in \\mathbb{R}^{r \\times k}', why: { en: 'LoRA writes the update as a product of two thin matrices whose inner size is the rank $r$.', zh: 'LoRA 把更新写成两个"瘦"矩阵的乘积，中间那一维就是秩 $r$。' } },
        { tex: '\\#B = d\\,r, \\qquad \\#A = r\\,k', why: { en: 'A matrix has (rows) × (columns) entries, and every entry of $B$ and $A$ is trained.', zh: '矩阵的元素个数是"行数 × 列数"，$B$ 和 $A$ 的每个元素都要训练。' } },
        { tex: '\\#\\Delta W = d\\,r + r\\,k = r\\,(d + k)', why: { en: 'Add the two counts and factor out $r$: the cost grows **linearly** in the rank.', zh: '把两个数加起来，提出公因子 $r$：参数量随秩**线性**增长。' } },
        { tex: '\\frac{r\\,(d + k)}{d\\,k} = \\frac{8 \\cdot 8192}{4096^2} \\approx 0.39\\%', why: { en: 'For $d = k = 4096$ and $r = 8$, divide by the $d\\,k$ entries of the full matrix.', zh: '取 $d = k = 4096$、$r = 8$，再除以完整矩阵的 $d\\,k$ 个元素。' } },
      ],
      blank: { line: 2, answer: 'r*(d+k)', variables: ['r', 'd', 'k'], prompt: { en: 'Your turn: write the total number of trained parameters in terms of $d$, $r$ and $k$.', zh: '轮到你：用 $d$、$r$、$k$ 写出要训练的参数总数。' } },
      outro: { en: 'The full matrix grows like $d\\,k$; the adapter only like $r\\,(d + k)$. That gap is why one GPU can fine-tune a large model.', zh: '完整矩阵按 $d\\,k$ 增长，适配器只按 $r\\,(d + k)$ 增长。正是这个差距，让一块 GPU 也能微调大模型。' },
    },
    // ---------------------------------------------------------------- a code walkthrough
    {
      id: 'layer', kind: 'code', chapter: { en: 'In code', zh: '写成代码' }, title: { en: 'A LoRA layer in PyTorch', zh: '用 PyTorch 写一个 LoRA 层' },
      intro: { en: 'Eighteen lines are enough. Click a note (or scroll) to light up the lines it explains.', zh: '十八行就够了。点一条讲解（或滚动页面），它讲的那几行代码会亮起来。' },
      lang: 'python', code: LORA_TORCH,
      notes: [
        { lines: [7, 8], text: { en: 'Wrap an existing layer and freeze its weight: no gradient and no optimizer state for $W_0$.', zh: '包住一个现成的线性层，并冻结它的权重：$W_0$ 不算梯度，也不占优化器状态。' } },
        { lines: [10, 11], text: { en: '$A$ is small and random, $B$ is zero, so $BA = 0$ and the wrapped model starts exactly as the base model.', zh: '$A$ 是很小的随机数，$B$ 是零，所以 $BA = 0$，包装后的模型一开始和基座模型完全一样。' }, shapes: 'A: [r, d_in]  B: [d_out, r]' },
        { lines: [12, 12], text: { en: 'The update is scaled by $\\alpha / r$; the paper uses this so that changing $r$ needs less retuning of the learning rate.', zh: '更新乘以 $\\alpha / r$；论文这样做，是为了改变 $r$ 时不必大幅重调学习率。' } },
        { lines: [16, 16], text: { en: 'The frozen path, exactly as before.', zh: '冻结的那一路，和原来一模一样。' }, shapes: 'h: [batch, seq, d_out]' },
        { lines: [17, 17], text: { en: 'Multiply by $A$ first: the activations squeeze through an $r$-wide bottleneck, and the $d_{out} \\times d_{in}$ matrix $BA$ is never built.', zh: '先乘 $A$：激活值挤过宽度只有 $r$ 的"瓶颈"，$d_{out} \\times d_{in}$ 的矩阵 $BA$ 从来不会被构造出来。' }, shapes: 'x Aᵀ: [batch, seq, r] → delta: [batch, seq, d_out]' },
        { lines: [18, 18], text: { en: 'Add the scaled correction to the frozen output.', zh: '把缩放后的修正加到冻结输出上。' } },
      ],
    },
    // ---------------------------------------------------------------- a single check
    {
      id: 'q-params', kind: 'checkpoint', chapter: { en: 'Check', zh: '检验' }, title: { en: 'Count it', zh: '数一数' }, skill: 'demo-lora-params',
      prompt: { en: 'A $4096 \\times 4096$ projection gets a LoRA adapter with $r = 16$. How many parameters does the adapter train?', zh: '给一个 $4096 \\times 4096$ 的投影矩阵加上 $r = 16$ 的 LoRA 适配器。适配器要训练多少参数？' },
      question: {
        type: 'choice', options: [
          { id: 'a', label: '131,072', correct: true, feedback: { en: '$16 \\cdot (4096 + 4096) = 131{,}072$.', zh: '$16 \\cdot (4096 + 4096) = 131{,}072$。' } },
          { id: 'b', label: '65,536', feedback: { en: 'That is $r = 8$. Doubling $r$ doubles the count.', zh: '这是 $r = 8$ 的结果。$r$ 翻倍，参数量也翻倍。' } },
          { id: 'c', label: '16,777,216', misconception: 'demo-full-count', feedback: { en: 'That is the whole matrix. The adapter only has $r\\,(d + k)$.', zh: '这是整个矩阵的大小。适配器只有 $r\\,(d + k)$ 个参数。' } },
          { id: 'd', label: '262,144', feedback: { en: 'That would be $r\\,(d + k)$ with $r = 32$.', zh: '这相当于 $r = 32$ 时的 $r\\,(d + k)$。' } },
        ],
      },
      hints: [{ en: 'Use the line you derived: $r\\,(d + k)$.', zh: '用你刚推出的那一行：$r\\,(d + k)$。' }],
    },
    // ---------------------------------------------------------------- a case: three questions, one brief
    {
      id: 'case-1', kind: 'checkpoint', chapter: { en: 'A case', zh: '案例' }, skill: 'demo-lora-choose',
      group: {
        id: 'support-bot', title: { en: 'A support bot that must sound like you', zh: '一个要说"自家话"的客服机器人' },
        brief: [
          { type: 'p', text: { en: 'A company wants its support assistant to answer in its house style: short, warm, never promising refunds. It has **2,000** past conversations its best agents wrote, one GPU with 24 GB, and a 7B open model.', zh: '一家公司希望客服助手用自家的风格回答：简短、亲切、绝不承诺退款。它手上有**2000**段由最好的客服写的历史对话、一块 24 GB 显存的 GPU，以及一个 7B 的开源模型。' } },
          { type: 'list', items: [
            { en: 'The facts (prices, policies) change every month.', zh: '事实信息（价格、政策）每个月都会变。' },
            { en: 'The style has stayed the same for years.', zh: '说话风格多年没变。' },
          ] },
          { type: 'callout', kind: 'note', body: { en: 'Three questions are about this case. It stays on screen while you answer them.', zh: '有三道题围绕这个案例，答题时它会一直留在屏幕上。' } },
        ],
      },
      prompt: { en: 'What should the team try **first**?', zh: '团队**首先**应该尝试什么？' },
      question: {
        type: 'choice', options: [
          { id: 'prompt', label: { en: 'A system prompt with the style guide and a few example replies, plus retrieval for the changing facts', zh: '写一个包含风格指南和几段示范回答的系统提示词，再用检索补充会变的事实' }, correct: true, feedback: { en: 'Cheapest to try and easy to measure; the facts belong in retrieval because they change.', zh: '成本最低、也最容易评测；事实会变，所以应该放进检索。' } },
          { id: 'full', label: { en: 'Full fine-tuning of the 7B model on the 2,000 conversations', zh: '用这 2000 段对话对 7B 模型做全量微调' }, feedback: { en: 'Full fine-tuning a 7B model does not fit in 24 GB with Adam, and it would bake in facts that change monthly.', zh: '用 Adam 全量微调 7B 模型，24 GB 显存装不下；而且会把每月都变的事实固化进权重。' } },
          { id: 'lora-facts', label: { en: 'LoRA fine-tuning on the conversations, including this month’s prices', zh: '用这些对话做 LoRA 微调，把本月价格也一起训进去' }, feedback: { en: 'Style may be a good fit for LoRA later, but facts that change monthly should not be trained into weights.', zh: '风格以后也许适合用 LoRA 学，但每月都变的事实不该训练进权重。' } },
          { id: 'rank', label: { en: 'LoRA with the highest rank that fits, to be safe', zh: '用显存能放下的最高秩做 LoRA，保险一点' }, misconception: 'demo-rank-quality', feedback: { en: 'A higher rank is not "safer": it adds capacity, not quality, and the first step should be cheaper still.', zh: '秩更高并不"更保险"：它增加的是容量，不是效果；何况第一步应该更便宜。' } },
        ],
      },
    },
    {
      id: 'case-2', kind: 'checkpoint', skill: 'demo-lora-choose',
      group: { id: 'support-bot', title: { en: 'A support bot that must sound like you', zh: '一个要说"自家话"的客服机器人' } },
      prompt: { en: 'The prompt-only version drifts out of the house style in long conversations. Argue for or against LoRA fine-tuning now, in two or three sentences.', zh: '只靠提示词的版本，在长对话里会慢慢偏离公司的风格。用两三句话说明：现在该不该做 LoRA 微调？' },
      question: {
        type: 'text',
        placeholder: { en: 'For or against, and why…', zh: '该还是不该，为什么……' },
        rubric: {
          key_points: [
            { en: 'Style is a consistent behaviour, which supervised fine-tuning on good examples changes reliably (prompts do not hold it over long chats).', zh: '风格是一种稳定的行为，用好的示范做监督微调能可靠地改变它（提示词在长对话里守不住）。' },
            { en: 'LoRA trains few parameters, so 2,000 examples and one 24 GB GPU are enough.', zh: 'LoRA 只训练很少的参数，2000 条样本、一块 24 GB 的 GPU 就够了。' },
            { en: 'Keep the changing facts in retrieval, and measure the tuned model against the prompt-only baseline on held-out conversations.', zh: '会变的事实继续放在检索里，并在留出的对话上把微调后的模型和只用提示词的基线做对比评测。' },
          ],
          model_answer: {
            en: 'For: the house style is a stable behaviour that prompts do not hold over long chats, and supervised fine-tuning on 2,000 good conversations teaches it directly. LoRA makes this cheap enough for one 24 GB GPU. Keep the monthly facts in retrieval and compare against the prompt-only version on held-out conversations before switching.',
            zh: '该做。公司风格是一种稳定的行为，提示词在长对话里守不住，而用 2000 段优质对话做监督微调可以直接教会它。LoRA 让这件事在一块 24 GB 的 GPU 上就能完成。每月变化的事实继续放在检索里；上线前，在留出的对话上和只用提示词的版本做对比。',
          },
          min_points: 2,
        },
      },
      explain: { en: 'The pattern: prompts and retrieval for knowledge that changes, fine-tuning for behaviour that does not.', zh: '规律是：会变的知识交给提示词和检索，不变的行为交给微调。' },
    },
    {
      id: 'case-3', kind: 'checkpoint', skill: 'demo-lora-params',
      group: { id: 'support-bot', title: { en: 'A support bot that must sound like you', zh: '一个要说"自家话"的客服机器人' } },
      prompt: { en: 'The team puts $r = 8$ adapters on the four attention projections (each $4096 \\times 4096$) of all 32 layers. How many parameters does the adapter train, in millions?', zh: '团队在全部 32 层的四个注意力投影矩阵（每个 $4096 \\times 4096$）上都加了 $r = 8$ 的适配器。适配器一共训练多少参数（以百万计）？' },
      question: { type: 'number', answer: (32 * 4 * 8 * 8192) / 1e6, tolerance: 0.05, unit: { en: 'million', zh: '百万' },
        wrong: [{ answer: (8 * 8192) / 1e6, feedback: { en: 'That is one matrix; there are $4 \\times 32$ of them.', zh: '这只是一个矩阵的量；一共有 $4 \\times 32$ 个。' } }] },
      hints: [{ en: 'One matrix: $8 \\cdot 8192 = 65{,}536$. How many matrices are adapted?', zh: '一个矩阵：$8 \\cdot 8192 = 65{,}536$。一共适配了多少个矩阵？' }],
      explain: { en: '$32 \\cdot 4 \\cdot 65{,}536 = 8{,}388{,}608 \\approx 8.39$ million, about 0.12% of a 7B model.', zh: '$32 \\cdot 4 \\cdot 65{,}536 = 8{,}388{,}608 \\approx 839$ 万，约占 7B 模型的 0.12%。' },
    },
    // ---------------------------------------------------------------- a short closing page
    {
      id: 'wrap', kind: 'read', chapter: { en: 'Wrap-up', zh: '小结' }, title: { en: 'What to remember', zh: '记住这几点' },
      blocks: [
        { type: 'list', ordered: true, items: [
          { en: 'LoRA learns $\\Delta W = BA$ and leaves $W_0$ frozen.', zh: 'LoRA 学的是 $\\Delta W = BA$，$W_0$ 保持冻结。' },
          { en: 'It trains $r\\,(d + k)$ parameters per matrix instead of $d\\,k$.', zh: '每个矩阵只训练 $r\\,(d + k)$ 个参数，而不是 $d\\,k$ 个。' },
          { en: 'Use it for behaviour that should not change often; keep changing facts in retrieval.', zh: '它适合用来学不常变的行为；会变的事实留给检索。' },
        ] },
        { type: 'h', level: 3, text: { en: 'Where this goes next', zh: '接下来' } },
        { type: 'p', text: { en: 'Part C of the course goes deeper: where to put adapters, how $\\alpha$ and $r$ interact, and QLoRA. The method comes from the [LoRA paper](https://arxiv.org/abs/2106.09685).', zh: '课程 C 部分会深入讲：适配器加在哪些层、$\\alpha$ 和 $r$ 怎么相互影响，以及 QLoRA。方法出自 [LoRA 论文](https://arxiv.org/abs/2106.09685)。' } },
      ],
    },
  ],
};
