// C1 The memory budget: what fine-tuning keeps on the GPU, how to estimate it,
// and which trick saves which part. Plan: part-c-efficiency.md (C1); sources there and in research-sft.md.
import type { Lesson } from '@mathnim/core';
import { attach_visual, choose_card, t, vis } from '../b/common';

const MEASURE = `import torch

torch.cuda.reset_peak_memory_stats()
torch.cuda.memory._record_memory_history(max_entries=100_000)   # optional: a timeline

loss = model(**batch).loss          # forward: activations pile up
loss.backward()                     # backward: activations freed, gradients allocated
optimizer.step()                    # first step: optimizer states allocated
optimizer.zero_grad(set_to_none=True)

print(f"peak: {torch.cuda.max_memory_allocated() / 1e9:.1f} GB")
torch.cuda.memory._dump_snapshot("step.pickle")                 # open at pytorch.org/memory_viz`;

export const lesson: Lesson = {
  id: 'ft-c1-memory',
  title: t('The memory budget', '显存账'),
  description: t('Will it fit? What fine-tuning keeps on the GPU, how to estimate each part, and which trick saves which part.', '装得下吗？微调时显存里都放了什么，每一块怎样估算，哪种技巧省的是哪一块。'),
  mode: 'essay',
  skills: [
    { id: 'vram-static', name: t('Weights, gradients and optimizer states', '权重、梯度与优化器状态') },
    { id: 'vram-activations', name: t('Activations and recomputation', '激活值与激活重算') },
    { id: 'vram-logits', name: t('The logits', 'logits') },
    { id: 'vram-estimate', name: t('Estimating a whole budget', '估算整本账'), prerequisites: ['vram-static', 'vram-activations', 'vram-logits'] },
    { id: 'vram-sharding', name: t('Sharding across GPUs', '多卡分片') },
  ],
  misconceptions: [
    { id: 'vram-model-size', description: t('If the model’s weights fit, fine-tuning fits.', '模型权重装得下，就能微调。') },
    { id: 'lora-saves-activations', description: t('LoRA freezes the base model, so it also saves the activations.', 'LoRA 冻结了基座模型，所以激活值也省了。') },
    { id: 'params-dominate', description: t('Memory is mostly the parameters, whatever the sequence length.', '不管序列多长，显存主要都花在参数上。') },
    { id: 'logits-small', description: t('The logits are one small layer and can be ignored.', 'logits 只是最后一小层，可以忽略。') },
    { id: 'checkpointing-free', description: t('Activation recomputation saves memory at no cost.', '激活重算省显存，没有代价。') },
  ],
  steps: [
    {
      id: 'why', kind: 'read', chapter: t('Will it fit?', '装得下吗？'), title: t('The first wall is memory', '第一堵墙是显存'),
      blocks: [
        { type: 'p', text: t(
          'Before data, before hyperparameters, fine-tuning hits a simple question: will it fit on my GPU? The answer decides between full fine-tuning, LoRA and QLoRA, and whether you need one card or several. This lesson teaches you to do the budget yourself, so that you know which trick saves which part. Five things live in GPU memory while you train:',
          '在数据、在超参数之前，微调先撞上一个朴素的问题：我的显卡装得下吗？答案决定了你用全量微调、LoRA 还是 QLoRA，需要一张卡还是好几张。这节课教你自己算这本账，这样你就知道每一种技巧省的是哪一块。训练时显存里放着五样东西：') },
        { type: 'list', ordered: true, items: [
          t('**Weights**: the model itself.', '**权重**：模型本身。'),
          t('**Gradients**: one per trained weight, from the backward pass.', '**梯度**：每个被训练的权重一个，来自反向传播。'),
          t('**Optimizer states**: Adam keeps two running averages per trained weight.', '**优化器状态**：Adam 为每个被训练的权重保存两个滑动平均。'),
          t('**Activations**: intermediate results of the forward pass, kept for the backward pass. They grow with batch × sequence length.', '**激活值**：前向传播的中间结果，留给反向传播用。它们随 batch × 序列长度增长。'),
          t('**Logits**: one score per vocabulary word at every position, often the single largest tensor.', '**logits**：每个位置上，每个词表单词一个分数，常常是最大的单个张量。'),
        ] },
        { type: 'figure', src: 'ft/c/c1-ledger.svg', alt: t('Stacked bars for Llama-3.1-8B at 4k tokens: full fine-tuning about 135 GB, LoRA about 23.6 GB, QLoRA about 13.2 GB, against 24 and 80 GB lines.', 'Llama-3.1-8B、4k token 的堆叠柱：全量约 135 GB，LoRA 约 23.6 GB，QLoRA 约 13.2 GB，对照 24 GB 和 80 GB 两条线。'),
          caption: t('Where this lesson ends up: the same 8B model, three ways. The rest of the lesson builds each block.', '这节课最后会得到的结果：同一个 8B 模型，三种做法。下面一块块把它搭出来。'), credit: 'Estimate, formulas in C1 (4.2 GB logits = plain PyTorch / Trainer; TRL v1.15 SFTTrainer chunks them) · 估算，公式见 C1（logits 4.2 GB 为普通 PyTorch / Trainer 的情形；TRL v1.15 SFTTrainer 默认分块计算）' },
      ],
    },
    {
      id: 'predict-full', kind: 'checkpoint', title: t('Guess first', '先猜一猜'), skill: 'vram-static', purpose: 'predict',
      prompt: t('Llama-3.1-8B’s bf16 weights take about 16 GB. Full fine-tuning with AdamW, 4,096-token sequences, batch 1: at least how much GPU memory?', 'Llama-3.1-8B 的 bf16 权重大约 16 GB。用 AdamW 全量微调，序列 4096、batch 1，至少要多少显存？'),
      question: { type: 'choice', options: [
        { id: 'a', label: t('About 16 GB', '约 16 GB'), misconception: 'vram-model-size' },
        { id: 'b', label: t('About 32 GB', '约 32 GB') },
        { id: 'c', label: t('About 64 GB', '约 64 GB') },
        { id: 'd', label: t('130 GB or more', '130 GB 以上'), correct: true },
      ] },
      explain: t('About 135 GB: the weights are the smallest of the three per-parameter costs. Next page: why each trained parameter costs 16 bytes.', '约 135 GB：在每个参数的三项开销里，权重是最小的一项。下一页讲为什么每个被训练的参数要 16 字节。'),
    },
    {
      id: 'bytes', kind: 'derive', chapter: t('Per parameter', '每个参数'), title: t('Sixteen bytes per trained parameter', '每个被训练的参数 16 字节'), skill: 'vram-static',
      intro: t('Mixed-precision AdamW, the usual setup, keeps five numbers for every trained parameter. Add them up.', '常用的混合精度 AdamW，为每个被训练的参数保存五个数。把它们加起来。'),
      lines: [
        { tex: '\\underbrace{2}_{\\text{bf16 weight}} + \\underbrace{2}_{\\text{bf16 grad}} + \\underbrace{4}_{\\text{fp32 master}} + \\underbrace{4}_{m} + \\underbrace{4}_{v} = 16 \\text{ bytes}', why: t('Compute in bf16; keep an fp32 master copy of each weight and Adam’s first and second moments $m$, $v$ in fp32 (the ZeRO paper writes it $2\\Psi + 2\\Psi + 12\\Psi$).', '计算用 bf16；每个权重另存一份 fp32 主权重，以及 Adam 的一阶矩 $m$ 和二阶矩 $v$（也是 fp32；ZeRO 论文写作 $2\\Psi + 2\\Psi + 12\\Psi$）。') },
        { tex: '\\text{bf16 spacing near 1: } 2^{-7} \\approx 0.0078; \\quad \\frac{\\eta}{|w|} = \\frac{10^{-5}}{0.02} = 5 \\times 10^{-4} \\ll 2^{-8}', why: t('Why the fp32 copy: bf16 has 7 mantissa bits, so a typical update to a weight of 0.02 is far smaller than half a step between bf16 numbers and rounds away to nothing. (The mixed-precision paper made this argument for fp16; these numbers adapt it to bf16.)', '为什么要 fp32 副本：bf16 只有 7 位尾数，一个大小为 0.02 的权重，典型的一次更新远小于 bf16 相邻两数间距的一半，四舍五入后就没了。（混合精度论文是针对 fp16 讲的；这里的数字是改写到 bf16 的类比。）') },
        { tex: '\\text{8-bit Adam: } 2 + 2 + 4 + 1 + 1 = 10, \\qquad \\text{pure bf16: } 2 + 2 + 2 + 2 = 8', why: t('Cheaper variants: quantise $m$ and $v$ to 8 bits, or keep everything in bf16 (which needs tricks such as stochastic rounding to stop updates vanishing).', '更省的变体：把 $m$、$v$ 量化到 8 位，或者全部用 bf16（这需要随机舍入之类的技巧，免得更新被吞掉）。') },
        { tex: '16 \\times 8.03 \\times 10^{9} \\approx 128.5 \\text{ GB}', why: t('Llama-3.1-8B, all parameters trained: the static part alone needs two 80 GB cards.', 'Llama-3.1-8B 全部参数参与训练：光静态部分就要两张 80 GB 的卡。') },
      ],
      blank: { line: 0, answer: '16', prompt: t('Bytes per trained parameter with mixed-precision AdamW?', '混合精度 AdamW 下，每个被训练的参数要几个字节？') },
      outro: t('So the cost is not the model size; it is 16 bytes times the number of **trained** parameters. LoRA (C2) attacks exactly this factor.', '所以开销不是模型大小，而是 16 字节乘以**被训练**的参数数量。LoRA（C2）对付的正是这一项。'),
    },
    {
      id: 'where', kind: 'read', title: t('Where the 8B parameters are', '8B 个参数都在哪'),
      blocks: [
        { type: 'p', text: t('LoRA adapts linear layers and QLoRA compresses them, so it matters how the parameters split between the 7 linear layers of each block and the embeddings.', 'LoRA 适配的是线性层，QLoRA 压缩的也是线性层，所以要知道参数在每个块的 7 个线性层和嵌入层之间怎么分布。') },
        { type: 'table',
          head: [t('Linear layer (per block)', '线性层（每个块）'), t('In → out', '输入 → 输出'), t('Parameters', '参数'), t('In + out', '输入 + 输出')],
          rows: [
            ['q_proj', '4096 → 4096', '16.78M', '8,192'],
            ['k_proj, v_proj', '4096 → 1024', t('4.19M each', '各 4.19M'), t('5,120 each', '各 5,120')],
            ['o_proj', '4096 → 4096', '16.78M', '8,192'],
            ['gate_proj, up_proj', '4096 → 14336', t('58.72M each', '各 58.72M'), t('18,432 each', '各 18,432')],
            ['down_proj', '14336 → 4096', '58.72M', '18,432'],
            [t('**Per block**', '**每个块**'), '', '**218.1M**', '**81,920**'],
          ] },
        { type: 'p', text: t('32 blocks give **6.98B** in linear layers; the embedding and the separate output head add 2 × 128,256 × 4096 = **1.05B**; total **8.03B**. The last column is what LoRA’s parameter count needs (C2).', '32 个块的线性层共 **6.98B**；嵌入层和独立的输出头再加 2 × 128,256 × 4096 = **1.05B**；合计 **8.03B**。最后一列是 C2 算 LoRA 参数量时要用的。') },
      ],
    },
    {
      id: 'activations', kind: 'read', chapter: t('Per token', '每个 token'), title: t('Activations: the forward pass is remembered', '激活值：前向传播要被记住'),
      blocks: [
        { type: 'p', text: t('Backpropagation needs the inputs of every operation of the forward pass, so they are kept until the backward pass uses them. Their size grows with every token in the batch, not with the parameter count. Per transformer layer, with 16-bit activations[^korthikanti]:', '反向传播要用到前向传播里每个运算的输入，所以它们会一直保留到反向传播用完为止。它们的大小随 batch 里的每个 token 增长，而不是随参数量增长。每个 Transformer 层（16 位激活值）[^korthikanti]：') },
        { type: 'math', tex: 's\\,b\\,h\\,\\Big(34 + \\frac{5\\,a\\,s}{h}\\Big) \\text{ bytes}' },
        { type: 'list', items: [
          t('$s\\,b\\,h$: sequence length × batch × hidden size, the size of one hidden-state tensor.', '$s\\,b\\,h$：序列长度 × batch × 隐藏维度，也就是一个隐藏状态张量的大小。'),
          t('34: the tensors kept per layer (attention 11, MLP 19, two LayerNorms 4, in units of $sbh$ bytes).', '34：每层保留的张量（注意力 11、MLP 19、两个 LayerNorm 4，单位是 $sbh$ 字节）。'),
          t('$5as/h$: the $s \\times s$ attention scores. FlashAttention never stores them, so this term disappears.', '$5as/h$：$s \\times s$ 的注意力分数。FlashAttention 不保存它们，这一项就没了。'),
        ] },
        { type: 'figure', src: 'ft/c/c1-activations.svg', alt: t('One transformer layer with the tensors it keeps for backward: attention 11 sbh, MLP 19 sbh, LayerNorms 4 sbh, plus 5 a s² b for scores, removed by FlashAttention.', '一个 Transformer 层为反向传播保留的张量：注意力 11 sbh、MLP 19 sbh、LayerNorm 4 sbh，外加注意力分数 5 a s² b（FlashAttention 去掉了它）。'), credit: 'Drawn after Korthikanti et al. (2022), §4.1 · 据 Korthikanti 等（2022）第 4.1 节绘制' },
        { type: 'p', text: t('For 8B at 4,096 tokens: $34 \\times 4096 \\times 4096 \\approx 0.57$ GB per layer, about **18 GB** for 32 layers. **Activation recomputation** (often called gradient checkpointing) keeps only each layer’s input, $2\\,sbh$ per layer (about 1.07 GB), and recomputes the rest during backward: about **1.6 GB** at the peak, for one extra forward pass, about **+33% compute** (6N → 8N FLOPs per token).', '8B 模型、4096 个 token：每层 $34 \\times 4096 \\times 4096 \\approx 0.57$ GB，32 层约 **18 GB**。**激活重算（activation recomputation，口语也叫梯度检查点）**只保留每层的输入，每层 $2\\,sbh$（约 1.07 GB），其余在反向时重新算：峰值约 **1.6 GB**，代价是多一次前向传播，计算量约 **+33%**（每 token 从 6N 变成 8N FLOPs）。') },
        { type: 'callout', kind: 'misconception', title: t('LoRA does not save the activations', 'LoRA 不省激活值'), body: t('LoRA freezes the base weights, so their gradients and optimizer states disappear. But the backward pass still has to travel through every frozen layer to reach the adapters below, and each adapter needs its input. So the activations stay: about the same 18 GB, or 1.6 GB with recomputation.', 'LoRA 冻结了基座权重，所以它们的梯度和优化器状态没有了。但反向传播仍然要穿过每一个冻结层，才能到达下面的适配器；每个适配器也都需要它的输入。所以激活值照样要存：还是约 18 GB，开激活重算时约 1.6 GB。') },
        { type: 'cite', key: 'korthikanti', text: t('Korthikanti et al. (2023). Reducing Activation Recomputation in Large Transformer Models. MLSys.', 'Korthikanti 等（2023）。Reducing Activation Recomputation in Large Transformer Models。MLSys。'), url: 'https://arxiv.org/abs/2205.05198' },
      ],
    },
    {
      id: 'logits', kind: 'read', title: t('The hidden giant: logits', '隐藏的大块头：logits'),
      blocks: [
        { type: 'p', text: t('The last layer scores every word of the vocabulary at every position, and the loss is computed in fp32:', '最后一层要在每个位置上给词表里的每个词打分，损失还要用 fp32 计算：') },
        { type: 'math', tex: 'b \\cdot s \\cdot V \\cdot 4 \\text{ bytes} = 1 \\times 4096 \\times 128{,}256 \\times 4 \\approx 2.1 \\text{ GB}' },
        { type: 'p', text: t('Its gradient needs the same again: 4.2 GB at 4k tokens, about 34 GB at 32k, more than all of QLoRA’s weights. **Chunked (fused) cross-entropy** computes the loss a few tokens at a time and never stores the whole tensor (e.g. Cut Cross-Entropy[^cce], Liger kernels). TRL v1.15’s SFTTrainer already computes log-probabilities in chunks by default; plain PyTorch and the `Trainer` store them unless you switch it on (`use_liger_kernel=True`).', '它的梯度还要再占一份：4k token 时共 4.2 GB，32k 时约 34 GB，比 QLoRA 的全部权重还大。**分块（融合）交叉熵**每次只算一小段 token 的损失，从不把整个张量放进显存（例如 Cut Cross-Entropy[^cce]、Liger 内核）。TRL v1.15 的 SFTTrainer 默认已经分块计算对数概率；普通 PyTorch 和 `Trainer` 则会完整保存，除非你打开它（`use_liger_kernel=True`）。') },
        { type: 'cite', key: 'cce', text: t('Wijmans et al. (2025). Cut Your Losses in Large-Vocabulary Language Models. ICLR.', 'Wijmans 等（2025）。Cut Your Losses in Large-Vocabulary Language Models。ICLR。'), url: 'https://arxiv.org/abs/2411.09009' },
      ],
    },
    {
      id: 'budget-world', kind: 'explore', chapter: t('Do the budget', '算一算账'), title: t('Make it fit', '让它装下'), skill: 'vram-estimate',
      scene: vis('vram_calculator', { model: 'llama3.1-8b', method: 'full', seq: 4096, batch: 1, ckpt: false, fused_ce: false, gpu_gb: 24 }),
      prompt: t(
        'Every block of the bar is one term of the estimate. (1) Make Llama-3.1-8B with 4,096-token sequences fit on a **24 GB** card. (2) Then fit **16k-token** sequences of the same model on a **16 GB** card.',
        '柱子的每一块都是估算式里的一项。（1）让 Llama-3.1-8B、4096 token 的序列装进 **24 GB** 的卡。（2）再让同一个模型、**16k token** 的序列装进 **16 GB** 的卡。'),
      setup: (scene: any, ui, _ctx, world) => {
        attach_visual('vram_calculator', {}, scene, ui, () => {
          const c = scene.config(), e = scene.estimate();
          world.emit('budget', { method: c.method, ckpt: c.ckpt, fused: c.fused_ce, seq: c.seq, batch: c.batch, total: e.total, largest: e.largest, gpu: scene.gpu.get_value() });
        });
      },
      goals: [
        { id: 'fit-24', check: (s: any) => { const c = s.config(); return (c.model.id ?? c.model) === 'llama3.1-8b' && c.seq >= 4096 && s.estimate().total <= 24; }, message: t('8B at 4k in 24 GB: LoRA (or QLoRA) removes the 16-bytes-per-parameter block, recomputation removes most activations.', '8B、4k 装进 24 GB：LoRA（或 QLoRA）去掉了"每参数 16 字节"那一大块，激活重算去掉了大部分激活值。') },
        { id: 'fit-16k', check: (s: any) => { const c = s.config(); return (c.model.id ?? c.model) === 'llama3.1-8b' && c.seq >= 16384 && s.estimate().total <= 16; }, message: t('At 16k tokens the weights are no longer the problem: activations and logits are. Recomputation and chunked cross-entropy matter as much as 4-bit weights.', '在 16k token 时，问题已经不是权重，而是激活值和 logits。激活重算和分块交叉熵，与 4 位权重同样重要。') },
      ],
      detectors: [
        { id: 'weights-only', on: (e) => (e.type === 'budget' && e.data!.method === 'qlora' && (e.data!.seq as number) >= 16384 && (!e.data!.ckpt || !e.data!.fused) && (e.data!.total as number) > 16 ? { kind: 'misconception', id: 'params-dominate', message: t('4-bit weights are already in place; what remains is activations and logits.', '权重已经是 4 位了；剩下的是激活值和 logits。') } : null) },
        { id: 'lora-acts', on: (e) => (e.type === 'budget' && e.data!.method === 'lora' && !e.data!.ckpt && e.data!.largest === 'acts' ? { kind: 'misconception', id: 'lora-saves-activations' } : null) },
      ],
      lines: [
        { text: t('Full fine-tuning: the purple block is Adam’s two moments. Find which switch removes it.', '全量微调：紫色那块是 Adam 的两个矩。找找哪个开关能去掉它。'), when: 'enter' },
        { text: t('Look at the biggest block now: weights are 4-bit already, so it is activations or logits.', '看看现在最大的一块：权重已经是 4 位了，所以它是激活值或 logits。'), when: { finding: 'params-dominate' } },
        { text: t('LoRA freezes the weights, but the gold activation block did not shrink. That needs recomputation.', 'LoRA 冻结了权重，可金色的激活值那块没变小。那要靠激活重算。'), when: { finding: 'lora-saves-activations' } },
        { text: t('Try one switch at a time and watch which block changes.', '一次只改一个开关，看是哪一块在变。'), when: 'idle' },
        { text: t('Each trick saves one block: LoRA the optimizer and gradients, QLoRA the frozen weights, recomputation the activations, chunked cross-entropy the logits.', '每种技巧省一块：LoRA 省梯度和优化器状态，QLoRA 省冻结的权重，激活重算省激活值，分块交叉熵省 logits。'), when: 'goal' },
      ],
      hints: [t('Which block is largest right now? Find the switch that shrinks that one.', '现在哪一块最大？找到能让它变小的那个开关。')],
      solve: (s: any, _c, w) => {
        s.set_config({ method: 'lora', ckpt: true, fused_ce: true, seq: 4096, batch: 1 });
        w.emit('budget', {});
        s.set_config({ method: 'qlora', ckpt: true, fused_ce: true, seq: 16384, batch: 1 });
        w.emit('budget', {});
      },
    },
    {
      id: 'batch-predict', kind: 'checkpoint', title: t('One more prediction', '再猜一次'), skill: 'vram-estimate', purpose: 'predict',
      prompt: t('With recomputation and chunked cross-entropy on, QLoRA uses about 54% less memory than LoRA for 8B at batch 1. At batch 16, the saving is…', '开着激活重算和分块交叉熵时，8B 模型在 batch 1 下，QLoRA 比 LoRA 省约 54% 的显存。到了 batch 16，省的比例会……'),
      question: { type: 'choice', options: [
        { id: 'a', label: t('still about 54%', '还是约 54%') },
        { id: 'b', label: t('larger', '更大') },
        { id: 'c', label: t('smaller, about a quarter', '更小，约四分之一'), correct: true },
      ] },
      explain: t('Activations grow with batch × length and are not quantised: about 26 GB at batch 16 in both. LoRA ≈ 44 GB, QLoRA ≈ 34 GB, a 23% saving.', '激活值随 batch × 长度增长，而且不会被量化：batch 16 时两者都约 26 GB。LoRA ≈ 44 GB，QLoRA ≈ 34 GB，只省 23%。'),
    },
    {
      id: 'sharding', kind: 'read', title: t('More than one GPU', '不止一张卡'),
      blocks: [
        { type: 'p', text: t('When even LoRA does not fit, or you want full fine-tuning, split the 16 bytes per parameter across $N$ GPUs (ZeRO; PyTorch FSDP is the same idea as stage 3)[^zero]:', '当连 LoRA 都装不下，或者你就是要全量微调时，把每参数 16 字节分摊到 $N$ 张卡上（ZeRO；PyTorch 的 FSDP 和它的第 3 阶段是同一个思路）[^zero]：') },
        { type: 'table',
          head: [t('Stage', '阶段'), t('Per GPU', '每张卡'), t('8B on 2 GPUs', '8B 用 2 张卡')],
          rows: [
            [t('ZeRO-1: shard optimizer states', 'ZeRO-1：分片优化器状态'), '$2\\Psi + 2\\Psi + 12\\Psi/N$', '≈ 80 GB'],
            [t('ZeRO-2: + gradients', 'ZeRO-2：再分片梯度'), '$2\\Psi + 14\\Psi/N$', '≈ 72 GB'],
            [t('ZeRO-3 / FSDP: + weights', 'ZeRO-3 / FSDP：连权重也分片'), '$16\\Psi/N$', '≈ 64 GB'],
          ] },
        { type: 'p', text: t('Activations are not sharded: each GPU still holds those of its own micro-batch. Offloading optimizer states to CPU memory is another option, paid for in speed.', '激活值不会被分片：每张卡仍然保存自己那个 micro-batch 的激活值。把优化器状态卸载到 CPU 内存是另一个选择，代价是速度。') },
        { type: 'cite', key: 'zero', text: t('Rajbhandari et al. (2020). ZeRO: Memory Optimizations Toward Training Trillion Parameter Models.', 'Rajbhandari 等（2020）。ZeRO: Memory Optimizations Toward Training Trillion Parameter Models。'), url: 'https://arxiv.org/abs/1910.02054' },
      ],
    },
    {
      id: 'measure', kind: 'code', title: t('Check the estimate on your GPU', '在你的显卡上核对估算'),
      intro: t('An estimate is a starting point. Measure one step and compare; the snapshot shows the timeline below.', '估算只是起点。实测一步，再对照；显存快照能画出下面这样的时间线。'),
      lang: 'python', code: MEASURE,
      notes: [
        { lines: [3, 4], text: t('Reset the peak counter, and optionally record every allocation for a timeline.', '清零峰值计数；可选地记录每一次分配，用来画时间线。') },
        { lines: [6, 9], text: t('One full step. The peak is usually at the end of the forward pass or at the first optimizer step, when Adam allocates its states.', '完整的一步。峰值通常出现在前向结束时，或者第一次优化器更新、Adam 分配状态的时候。') },
        { lines: [11, 12], text: t('Compare the peak with the calculator; open the snapshot at pytorch.org/memory_viz.', '把峰值和计算器对照；在 pytorch.org/memory_viz 打开快照。') },
      ],
    },
    {
      id: 'timeline', kind: 'read', title: t('What a training step looks like in memory', '一个训练步在显存里的样子'),
      blocks: [
        { type: 'figure', src: 'ft/c/c1-memory-timeline.svg', alt: t('Memory over one step: activations climb during the forward pass, fall during backward while gradients appear, and the optimizer step adds a spike.', '一个训练步的显存变化：前向时激活值一路上升，反向时激活值释放、梯度出现，优化器更新时出现尖峰。'), credit: 'Schematic (full fine-tuning, mixed-precision AdamW), not to scale · 示意（全量微调、混合精度 AdamW），比例不按实际' },
      ],
    },
    // ------------------------------------------------------------------ checks
    {
      id: 'q-3b', kind: 'checkpoint', chapter: t('Check', '检验'), title: t('A 3B model', '一个 3B 模型'), skill: 'vram-static', purpose: 'check',
      prompt: t('A 3.2B-parameter model, full fine-tuning with mixed-precision AdamW. How many GB for weights, gradients and optimizer states together?', '一个 3.2B 参数的模型，用混合精度 AdamW 全量微调。权重、梯度、优化器状态合计多少 GB？'),
      question: { type: 'number', answer: 51.2, rtol: 0.05, unit: 'GB', wrong: [
        { answer: 6.4, misconception: 'vram-model-size', feedback: t('That is only the bf16 weights.', '这只是 bf16 权重。') },
        { answer: 12.8, feedback: t('Weights and gradients; the optimizer states (12 bytes per parameter) are missing.', '这是权重加梯度；还少了优化器状态（每参数 12 字节）。') },
      ] },
      explain: t('$16 \\times 3.2 = 51.2$ GB.', '$16 \\times 3.2 = 51.2$ GB。'),
    },
    {
      id: 'q-logits', kind: 'checkpoint', title: t('Logits', 'logits'), skill: 'vram-logits', purpose: 'check',
      prompt: t('Vocabulary 151,936 (Qwen2.5), sequence 8,192, batch 1. How large is the fp32 logits tensor, in GB?', '词表 151,936（Qwen2.5），序列 8192，batch 1。fp32 的 logits 张量有多少 GB？'),
      question: { type: 'number', answer: 4.98, tolerance: 0.1, unit: 'GB', wrong: [{ answer: 2.49, feedback: t('That would be 2 bytes per value; the loss is computed in fp32 (4 bytes).', '那是每个值 2 字节；损失是用 fp32（4 字节）算的。') }] },
      explain: t('$8192 \\times 151936 \\times 4 \\approx 4.98$ GB, and its gradient as much again, unless the cross-entropy is chunked.', '$8192 \\times 151936 \\times 4 \\approx 4.98$ GB；它的梯度还要再来一份，除非交叉熵是分块计算的。'),
    },
    {
      id: 'q-oom', kind: 'checkpoint', title: t('Out of memory at the loss', '在算 loss 时爆显存'), skill: 'vram-estimate', purpose: 'check',
      prompt: t('A LoRA run on an 8B model with recomputation on still runs out of memory, always on the line that computes the loss, with long sequences. What is the most likely culprit and fix?', '一个 8B 模型的 LoRA 训练，开了激活重算还是爆显存，而且总是在算 loss 那一行、序列很长的时候。最可能的原因和修法是？'),
      question: { type: 'choice', options: [
        { id: 'a', label: t('The fp32 logits and their gradient: use chunked/fused cross-entropy, shorter sequences or a smaller micro-batch', 'fp32 的 logits 和它的梯度：用分块/融合交叉熵，缩短序列，或减小 micro-batch'), correct: true },
        { id: 'b', label: t('The LoRA rank is too high', 'LoRA 的秩太高') },
        { id: 'c', label: t('Adam’s states: switch to 8-bit Adam', 'Adam 的状态：换成 8-bit Adam'), misconception: 'params-dominate', feedback: t('With LoRA the optimizer states are under 1 GB.', '用 LoRA 时，优化器状态不到 1 GB。') },
        { id: 'd', label: t('The activations: turn on recomputation', '激活值：打开激活重算'), feedback: t('It is already on.', '已经开了。') },
      ] },
    },
    {
      id: 'q-lora-acts', kind: 'checkpoint', title: t('Explain it', '解释一下'), skill: 'vram-activations', purpose: 'check',
      prompt: t('LoRA freezes the base model. Why must the base model’s activations still be kept for the backward pass?', 'LoRA 冻结了基座模型。为什么反向传播时仍然要保存基座模型的激活值？'),
      question: { type: 'text', placeholder: t('Because…', '因为……'), rubric: {
        key_points: [
          t('The gradient has to flow back through the frozen layers to reach the adapters in earlier layers.', '梯度必须穿过冻结层往回传，才能到达更前面各层的适配器。'),
          t('Each adapter’s gradient needs its layer’s input, and nonlinearities and norms need their inputs to be differentiated.', '每个适配器的梯度都要用到所在层的输入；非线性和归一化层求导时也要用到它们的输入。'),
        ],
        model_answer: t('Adapters sit in every layer, so the backward pass must go through all the frozen layers to reach them; each adapter’s gradient uses its layer’s input, and the nonlinearities need theirs. Only the weights’ gradients and optimizer states are saved.', '每一层都挂着适配器，所以反向传播必须穿过所有冻结层才能到达它们；每个适配器的梯度要用所在层的输入，非线性层也需要它们的输入。省下来的只有权重的梯度和优化器状态。'),
        min_points: 1,
      } },
    },
    {
      id: 'choose', kind: 'read', chapter: t('How to choose', '怎么选'), title: t('Budget before you rent', '先算账，再租卡'),
      blocks: choose_card({
        upto: 'C1', highlight: 'X1', card: 'C1',
        rule: t('Do the budget before renting a GPU: full fine-tuning needs about 16 bytes × N plus activations and logits. If it does not fit, try LoRA, then QLoRA, then sharding or offloading. With long sequences or large batches, the big blocks are activations and logits: turn on recomputation and chunked cross-entropy before reaching for quantisation.', '租卡之前先算账：全量微调约需 16 字节 × N，再加激活值和 logits。装不下，就依次考虑 LoRA → QLoRA → 多卡分片或卸载。序列长或 batch 大时，大头是激活值和 logits：先开激活重算和分块交叉熵，再考虑量化。'),
        counter: t('"My card can hold the model for inference, so it can fine-tune it": training adds gradients, optimizer states and activations (8B full fine-tuning is about 135–150 GB). And "32k sequences don’t fit, so switch to QLoRA": that saves about 10 GB of weights while logits and activations need tens of GB.', '"我的卡能装下模型做推理，所以也能微调"：训练还要梯度、优化器状态和激活值（8B 全量微调约需 135–150 GB）。还有"32k 序列装不下，所以换 QLoRA"：那只省下约 10 GB 权重，而 logits 和激活值要几十 GB。'),
      }),
    },
  ],
};
