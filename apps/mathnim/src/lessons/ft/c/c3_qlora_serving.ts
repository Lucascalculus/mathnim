// C3 QLoRA and serving: store the frozen base in 4 bits (NF4, blockwise scales,
// double quantisation), train adapters in bf16; then merge or serve many
// adapters; and how QLoRA differs from PTQ and QAT.
// Plan: part-c-efficiency.md (C3); sources there and in research-sft.md.
import type { Lesson } from '@mathnim/core';
import { attach_visual, choose_card, t, vis } from '../b/common';

const QLORA = `import torch
from transformers import AutoModelForCausalLM, BitsAndBytesConfig
from peft import LoraConfig, get_peft_model, prepare_model_for_kbit_training
from trl import SFTConfig, SFTTrainer

bnb = BitsAndBytesConfig(
    load_in_4bit=True,
    bnb_4bit_quant_type="nf4",              # default would be "fp4"
    bnb_4bit_use_double_quant=True,         # quantise the scales too: 0.5 -> 0.127 bits/param
    bnb_4bit_compute_dtype=torch.bfloat16,  # storage is 4-bit, compute is bf16
)
model = AutoModelForCausalLM.from_pretrained("meta-llama/Llama-3.1-8B", quantization_config=bnb)
model = prepare_model_for_kbit_training(model)   # fp32 norms, input grads, recomputation

model = get_peft_model(model, LoraConfig(r=16, lora_alpha=32, target_modules="all-linear", task_type="CAUSAL_LM"))

args = SFTConfig(learning_rate=2e-4, optim="paged_adamw_8bit", gradient_checkpointing=True)
trainer = SFTTrainer(model=model, args=args, train_dataset=dataset)
trainer.train()`;

const SERVE = `from vllm import LLM, SamplingParams
from vllm.lora.request import LoRARequest

llm = LLM(model="Qwen/Qwen2.5-7B-Instruct", enable_lora=True, max_loras=8, max_lora_rank=16)
params = SamplingParams(max_tokens=256)

# one base model in memory, a different adapter per request
a = llm.generate(["Hello"], params, lora_request=LoRARequest("customer_a", 1, "/adapters/a"))
b = llm.generate(["Hello"], params, lora_request=LoRARequest("customer_b", 2, "/adapters/b"))`;

export const lesson: Lesson = {
  id: 'ft-c3-qlora-serving',
  title: t('QLoRA and shipping adapters', 'QLoRA 与上线'),
  description: t('Store the frozen model in 4 bits so a large model fits one GPU, why NF4 and small blocks, and how to ship what you trained: merge, keep adapters, or serve many at once.', '把冻结的模型存成 4 位，让大模型装进一张卡：为什么用 NF4、为什么要小块；以及训练好的东西怎样上线：合并、保留适配器，还是同时服务许多个。'),
  mode: 'essay',
  skills: [
    { id: 'quant-basics', name: t('Levels and scales', '格点与缩放') },
    { id: 'nf4', name: t('NF4: levels at normal quantiles', 'NF4：放在正态分位点上的格点'), prerequisites: ['quant-basics'] },
    { id: 'blockwise-scaling', name: t('Blockwise scales and outliers', '按块缩放与异常值'), prerequisites: ['quant-basics'] },
    { id: 'qlora-train', name: t('What QLoRA trains and stores', 'QLoRA 训练什么、存什么'), prerequisites: ['nf4'] },
    { id: 'adapter-deploy', name: t('Merging and serving adapters', '合并与服务适配器') },
    { id: 'qat-vs-ptq', name: t('QLoRA, PTQ and QAT', 'QLoRA、PTQ 与 QAT') },
  ],
  misconceptions: [
    { id: 'nf4-uniform', description: t('Four bits means 16 evenly spaced levels.', '4 位就是 16 个等距的格点。') },
    { id: 'outlier-local', description: t('An outlier weight only hurts itself.', '一个异常值只影响它自己。') },
    { id: 'qlora-trains-4bit', description: t('QLoRA trains in 4-bit and updates 4-bit weights.', 'QLoRA 在 4 位精度上训练，更新的是 4 位权重。') },
    { id: 'qlora-faster', description: t('Quantised training is faster.', '量化后训练更快。') },
    { id: 'qlora-merge-exact', description: t('Merging a QLoRA adapter into the original bf16 model is exact.', '把 QLoRA 适配器合并回原始 bf16 模型是无损的。') },
    { id: 'qlora-for-inference', description: t('Training with QLoRA makes the deployed model 4-bit and small.', '用 QLoRA 训练，上线的模型就是 4 位、很省显存。') },
    { id: 'lora-serving-free', description: t('Each customer’s adapter needs its own full deployment.', '每个客户的适配器都需要部署一整份模型。') },
  ],
  steps: [
    {
      id: 'why', kind: 'read', chapter: t('Four bits per weight', '每个权重 4 位'), title: t('Make the frozen part small', '把冻结的部分变小'),
      blocks: [
        { type: 'p', text: t(
          'With LoRA, the largest block left on the GPU is the frozen base model itself: 16 GB for 8B in bf16. It is never trained, so it does not need 16 bits; it only needs to be good enough to compute with. **QLoRA** stores it in 4 bits, dequantises each layer to bf16 on the fly, and trains bf16 LoRA adapters on top. This put a 65B model on one 48 GB GPU, and an 8B model in about 9–13 GB[^qlora].',
          '用了 LoRA 之后，显存里最大的一块就是冻结的基座模型本身：8B 模型在 bf16 下要 16 GB。它从来不被训练，所以不需要 16 位，只要足够拿来计算就行。**QLoRA** 把它存成 4 位，每一层用到时临时反量化成 bf16，再在上面训练 bf16 的 LoRA 适配器。这样，65B 模型能放进一张 48 GB 的卡，8B 模型只要约 9–13 GB[^qlora]。') },
        { type: 'p', text: t(
          'But 4 bits give only 16 possible values per weight. Quantisation is two choices: **where to put the 16 levels**, and **how to stretch them to each group of weights** (the scale). Start with the simplest version.',
          '可是 4 位只能表示 16 个值。量化其实是两个选择：**16 个格点放在哪里**，以及**怎样把它们拉伸到每一组权重上**（缩放系数）。先从最简单的版本开始。') },
        { type: 'cite', key: 'qlora', text: t('Dettmers et al. (2023). QLoRA: Efficient Finetuning of Quantized LLMs. NeurIPS.', 'Dettmers 等（2023）。QLoRA: Efficient Finetuning of Quantized LLMs。NeurIPS。'), url: 'https://arxiv.org/abs/2305.14314' },
      ],
    },
    {
      id: 'absmax', kind: 'derive', title: t('Absmax quantisation by hand', '手算 absmax 量化'), skill: 'quant-basics',
      intro: t('Eight weights: $x = [0.12, -0.05, 0.31, -0.27, 0.02, 0.44, -0.18, 0.07]$. Use 4-bit integers $-7 \\dots 7$, scaled so the largest weight lands on the last level.', '八个权重：$x = [0.12, -0.05, 0.31, -0.27, 0.02, 0.44, -0.18, 0.07]$。用 4 位整数 $-7 \\dots 7$，缩放到让最大的权重正好落在最后一个格点上。'),
      lines: [
        { tex: 's = \\frac{\\max |x|}{7} = \\frac{0.44}{7} \\approx 0.0629', why: t('The scale: one number per group, chosen from the largest absolute value (absmax).', '缩放系数：每组一个数，由最大的绝对值（absmax）决定。') },
        { tex: 'q = \\operatorname{round}(x / s) = [2, -1, 5, -4, 0, 7, -3, 1]', why: t('Store these small integers: 4 bits each.', '存的就是这些小整数，每个 4 位。') },
        { tex: '\\hat x = s\\,q \\approx [0.126, -0.063, 0.314, -0.251, 0, 0.44, -0.189, 0.063]', why: t('Dequantise when computing.', '计算时再反量化回来。') },
        { tex: '|x - \\hat x| \\le s/2 \\approx 0.031', why: t('The error is at most half a step, so it depends on $s$, which depends on the largest weight. That is the weak point.', '误差最多半个格距，所以它取决于 $s$，而 $s$ 取决于最大的那个权重。这就是弱点所在。') },
      ],
      blank: { line: 1, answer: '5', prompt: t('What integer does $x = 0.31$ get? (Just the number.)', '$x = 0.31$ 对应哪个整数？（只填数字。）') },
    },
    {
      id: 'outlier-predict', kind: 'checkpoint', title: t('Guess first', '先猜一猜'), skill: 'blockwise-scaling', purpose: 'predict',
      prompt: t('A block of 64 weights: 63 ordinary ones (about $N(0, 0.02^2)$) and one outlier of 0.5. Quantised with 4-bit absmax, on how many different levels do the 63 ordinary weights land?', '一块 64 个权重：63 个普通权重（约服从 $N(0, 0.02^2)$），外加一个 0.5 的异常值。用 4 位 absmax 量化，这 63 个普通权重会落在几个不同的格点上？'),
      question: { type: 'choice', options: [
        { id: 'a', label: t('About 14', '约 14 个'), misconception: 'outlier-local' },
        { id: 'b', label: t('About 8', '约 8 个') },
        { id: 'c', label: t('About 3', '约 3 个'), correct: true },
        { id: 'd', label: '1' },
      ] },
      explain: t('The outlier sets $s = 0.5/7 \\approx 0.071$; every ordinary weight smaller than half a step (about 93% of them) becomes 0, and the rest land on ±1.', '异常值让 $s = 0.5/7 \\approx 0.071$；凡是小于半个格距的普通权重（约 93%）都变成 0，其余落在 ±1 上。'),
    },
    {
      id: 'quant-world', kind: 'explore', title: t('Where the levels go', '格点放在哪里'), skill: 'blockwise-scaling',
      scene: vis('quant_levels', { format: 'int4', block: 0, outlier_sigma: 0, data: 'gaussian' }),
      prompt: t(
        'Top: one block of weights on the real axis with the levels stretched to its absmax. Bottom: the same weights divided by absmax, and how many land on each level. (1) Drag the outlier out to at least 20σ, then make the error over the whole tensor at least **10× smaller** than with one scale for the whole tensor. (2) Without an outlier, at block size 64, find the 4-bit format with the lower error.',
        '上面：一块权重画在真实数轴上，格点按这块的 absmax 拉伸。下面：同一批权重除以 absmax，以及落在每个格点上的个数。（1）把异常值拖到至少 20σ，然后让整个张量的误差比"整个张量共用一个缩放系数"时小 **10 倍**以上。（2）没有异常值、块大小为 64 时，找出误差更小的那种 4 位格式。'),
      setup: (scene: any, ui, _ctx, world) => {
        attach_visual('quant_levels', {}, scene, ui, () => {
          const st = scene.stats(), whole = scene.stats({ B: 4096 });
          world.emit('quant', { sigma_out: scene.outlier.get_value(), B: scene.B(), fmt: scene.fmt(), mse: st.mse, whole: whole.mse, levels: st.levels_used });
        });
      },
      goals: [
        { id: 'local', check: (s: any) => s.outlier.get_value() >= 20 && s.stats().mse * 10 <= s.stats({ B: 4096 }).mse, message: t('Small blocks keep the outlier’s damage inside its own block of weights.', '小块把异常值的伤害限制在它自己那一块里。') },
        { id: 'nf4', check: (s: any) => s.outlier.get_value() < 1 && s.B() === 64 && s.fmt() === 'nf4' && s.stats().mse < s.stats({ format: 'int4' }).mse, message: t('NF4 puts more levels near 0, where most weights are: lower error with the same 4 bits.', 'NF4 把更多格点放在 0 附近，大多数权重都在那里：同样 4 位，误差更小。') },
      ],
      detectors: [
        { id: 'whole-tensor', on: (e) => (e.type === 'quant' && (e.data!.sigma_out as number) >= 10 && (e.data!.B as number) >= 4096 && (e.data!.levels as number) <= 4 ? { kind: 'misconception', id: 'outlier-local' } : null) },
      ],
      lines: [
        { text: t('Drag the outlier to the right and watch the grid of levels stretch with it.', '把异常值往右拖，看格点网格怎样跟着它拉伸。'), when: 'enter' },
        { text: t('One scale for the whole tensor: the outlier now sets the step for all 4,096 weights, and most of them collapse onto zero.', '整个张量共用一个缩放系数：异常值决定了全部 4096 个权重的格距，大多数都塌缩到了零上。'), when: { finding: 'outlier-local' } },
        { text: t('Smaller blocks give each group its own scale. Try 64.', '更小的块让每组都有自己的缩放系数。试试 64。'), when: 'idle' },
        { text: t('Blocks of 64 and NF4 levels: exactly QLoRA’s choice.', '64 一块，再加上 NF4 格点：这正是 QLoRA 的选择。'), when: 'goal' },
      ],
      solve: (s: any, _c, w) => {
        s.outlier.set_value(25);
        s.block.set_value(64);
        w.emit('quant', {});
        s.outlier.set_value(0);
        s.format.set_value(1);
        w.emit('quant', {});
      },
    },
    {
      id: 'nf4', kind: 'read', title: t('NF4: levels where the weights are', 'NF4：格点放在权重多的地方'),
      blocks: [
        { type: 'p', text: t(
          'Trained weights are roughly normally distributed: most are near 0, few are large. Evenly spaced levels waste many of their 16 values on the sparse tails. **NF4 (4-bit NormalFloat)** places its levels at the quantiles of a standard normal distribution, so each level covers about the same probability mass if the inputs really were $N(0, 1)$. It also keeps an exact 0, because padding and pruned weights must stay exactly zero; to fit 16 values, it puts 8 levels on the positive side and 7 on the negative side[^qlora2].',
          '训练好的权重大致服从正态分布：大多数在 0 附近，很大的很少。等距的格点会把 16 个值里的许多浪费在稀疏的尾部。**NF4（4-bit NormalFloat）**把格点放在标准正态分布的分位点上：如果输入真的服从 $N(0, 1)$，每个格点覆盖的概率质量大致相同。它还保留了一个精确的 0，因为填充和被剪掉的权重必须保持精确为零；为了凑成 16 个值，它在正半边放 8 个格点，负半边放 7 个[^qlora2]。') },
        { type: 'figure', src: 'ft/c/c3-nf4-levels.svg', alt: t('The standard normal density with the 16 NF4 levels, denser near zero, against 15 evenly spaced int4 levels.', '标准正态密度曲线上的 16 个 NF4 格点（在 0 附近更密），对照 15 个等距的 int4 格点。'), credit: 'Data: the NF4 table of QLoRA (Dettmers et al., 2023) / bitsandbytes, exact · 数据：QLoRA / bitsandbytes 的 NF4 表，精确绘制' },
        { type: 'math', tex: '\\text{NF4} = \\{-1,\\ -0.696,\\ -0.525,\\ -0.395,\\ -0.284,\\ -0.185,\\ -0.091,\\ 0,\\ 0.080,\\ 0.161,\\ 0.246,\\ 0.338,\\ 0.441,\\ 0.563,\\ 0.723,\\ 1\\}' },
        { type: 'p', text: t('Each block is divided by its absmax, so its values lie in $[-1, 1]$, and each value is stored as the 4-bit index of the nearest level.', '每一块先除以自己的 absmax，数值就落在 $[-1, 1]$ 里；每个值存成离它最近的格点的 4 位编号。') },
        { type: 'details', summary: t('How the levels are computed, and a caveat', '格点是怎么算出来的，以及一个提醒'), blocks: [
          { type: 'p', text: t('bitsandbytes takes normal quantiles at evenly spaced probabilities from 0.5 up to an offset of 0.9677 (the largest level cannot sit at probability 1, whose quantile is infinite), 8 on the positive side and 7 on the negative, adds 0, and divides by the largest. The library calls the offset empirically chosen; it equals $1 - \\frac12(\\frac1{32} + \\frac1{30})$ numerically, but that derivation is a third-party reconstruction.', 'bitsandbytes 从概率 0.5 到偏移量 0.9677 之间等距取正态分位点（最外侧的格点不能取在概率 1 处，那里的分位点是无穷大），正半边 8 个、负半边 7 个，加上 0，再除以最大值。库本身说这个偏移是经验选取的；它在数值上等于 $1 - \\frac12(\\frac1{32} + \\frac1{30})$，但这个推导是第三方的重构。') },
          { type: 'p', text: t('After dividing by a block’s absmax, the values are not exactly $N(0, 1)$: their distribution depends on the block size, so NF4 is not exactly "information-theoretically optimal", and codes that give each level an equal share of real inputs actually did worse on language models (Yoshida 2023).', '除以一块的 absmax 之后，数值并不严格服从 $N(0, 1)$：它的分布取决于块大小，所以 NF4 并不严格"信息论最优"；而让每个格点在真实输入上分到同样多数值的编码，在语言模型上反而效果更差（Yoshida 2023）。') },
        ] },
        { type: 'cite', key: 'qlora2', text: t('Dettmers et al. (2023). QLoRA (Appendix E: the NF4 values).', 'Dettmers 等（2023）。QLoRA（附录 E：NF4 的取值）。'), url: 'https://arxiv.org/abs/2305.14314' },
      ],
    },
    {
      id: 'overhead', kind: 'derive', title: t('What the scales cost, and double quantisation', '缩放系数的开销，以及双重量化'), skill: 'nf4',
      intro: t('Small blocks protect against outliers, but every block stores its own fp32 scale. Count the bits per weight.', '小块能抵御异常值，可每一块都要存一个 fp32 的缩放系数。算一算每个权重摊到多少比特。'),
      lines: [
        { tex: '\\frac{32}{B}: \\quad B = 64 \\Rightarrow 0.5 \\text{ bits per weight}', why: t('One 32-bit scale shared by $B$ weights. At 64, the scales add an eighth of a 4-bit weight.', '一个 32 位的缩放系数由 $B$ 个权重分摊。块大小为 64 时，缩放系数相当于在 4 位权重之上再加八分之一。') },
        { tex: '\\frac{8}{64} + \\frac{32}{64 \\cdot 256} \\approx 0.127 \\text{ bits per weight}', why: t('Double quantisation: store the scales themselves in 8 bits (after subtracting their mean), with one fp32 scale for every 256 of them.', '双重量化：把缩放系数本身也存成 8 位（先减去它们的均值），每 256 个缩放系数再共用一个 fp32 的二级系数。') },
        { tex: '(0.5 - 0.127) \\times 65 \\times 10^{9} / 8 \\approx 3.0 \\text{ GB}', why: t('Saved on a 65B model.', '在 65B 模型上省下的显存。') },
        { tex: '6.98 \\times 10^{9} \\times \\frac{4 + 0.127}{8} \\approx 3.6 \\text{ GB}', why: t('Llama-3.1-8B’s linear layers in NF4 with double quantisation (13.96 GB in bf16); the embedding and the output head stay in bf16 (2.1 GB).', 'Llama-3.1-8B 的线性层用 NF4 加双重量化存储（bf16 时是 13.96 GB）；嵌入层和输出头仍是 bf16（2.1 GB）。') },
      ],
      blank: { line: 1, answer: '8/64 + 32/(64*256)', prompt: t('Write the overhead with double quantisation as an expression.', '写出双重量化之后的开销表达式。') },
    },
    {
      id: 'training', kind: 'read', chapter: t('Training with a 4-bit base', '在 4 位底座上训练'), title: t('What is 4-bit, and what is not', '哪些是 4 位，哪些不是'),
      blocks: [
        { type: 'figure', src: 'ft/c/c3-qlora-dataflow.svg', alt: t('Frozen NF4 weights are dequantised to bf16 for each matrix multiplication; bf16 LoRA adapters receive gradients; optimizer states are paged between GPU and CPU.', '冻结的 NF4 权重在每次矩阵乘法前反量化成 bf16；bf16 的 LoRA 适配器接收梯度；优化器状态在 GPU 和 CPU 之间分页。'), credit: 'Schematic, redrawn after QLoRA (Dettmers et al., 2023) Fig. 1 · 示意，据 QLoRA 图 1 重绘' },
        { type: 'list', items: [
          t('**4-bit is a storage format.** Every forward and backward pass dequantises each layer to bf16 and computes in bf16. Gradients flow through the dequantised weights to the adapters; the 4-bit weights never change.', '**4 位只是存储格式。**每次前向和反向传播，都先把每一层反量化成 bf16，再用 bf16 计算。梯度穿过反量化后的权重流向适配器；4 位权重本身从不改变。'),
          t('**So it is slower, not faster.** Dequantising every layer at every step costs time: QLoRA trades speed for memory.', '**所以它更慢，而不是更快。**每一步都要把每一层反量化一遍，这要花时间：QLoRA 是用速度换显存。'),
          t('**Paged optimizers** keep the optimizer states in unified memory, so a sudden spike (a long batch) spills to CPU memory instead of crashing.', '**分页优化器**把优化器状态放在统一内存里，遇到显存的突然尖峰（比如一个很长的 batch），会溢出到 CPU 内存，而不是直接崩溃。'),
          t('**All linear layers.** QLoRA matched 16-bit fine-tuning only with adapters on every linear layer.', '**所有线性层。**只有在每个线性层上都加适配器，QLoRA 才追平了 16 位微调。'),
        ] },
      ],
    },
    {
      id: 'qlora-code', kind: 'code', title: t('QLoRA in code', '用代码写 QLoRA'),
      intro: t('Four decisions: 4-bit NF4 storage with double quantisation, bf16 compute, adapters on all linear layers, a paged 8-bit optimizer.', '四个决定：NF4 加双重量化的 4 位存储，bf16 计算，所有线性层加适配器，分页的 8-bit 优化器。'),
      lang: 'python', code: QLORA,
      notes: [
        { lines: [6, 11], text: t('Set NF4 and the compute dtype explicitly: the defaults are fp4 and float32.', '显式设置 NF4 和计算精度：默认值是 fp4 和 float32。') },
        { lines: [12, 13], text: t('Load the base in 4 bits; the preparation step keeps norms in fp32, enables input gradients and activation recomputation.', '以 4 位加载基座；准备这一步会把归一化层保持在 fp32、打开输入梯度和激活重算。') },
        { lines: [15, 15], text: t('bf16 adapters on every linear layer: the only trained parameters.', '每个线性层上的 bf16 适配器：唯一被训练的参数。') },
        { lines: [17, 17], text: t('The LoRA learning rate (C2) and a paged 8-bit optimizer.', 'LoRA 的学习率（C2），以及分页的 8-bit 优化器。') },
      ],
    },
    // ------------------------------------------------------------------ shipping
    {
      id: 'merge', kind: 'read', chapter: t('Shipping', '上线'), title: t('Merging a QLoRA adapter', '合并 QLoRA 适配器'),
      blocks: [
        { type: 'p', text: t('The adapter learned to correct the **dequantised** 4-bit weights, not the original bf16 ones. So "merge it into the original model" is not quite the model you trained. Four options:', '适配器学会的是去修正**反量化后的** 4 位权重，而不是原始的 bf16 权重。所以"合并回原始模型"得到的，并不完全是你训练的那个模型。有四种做法：') },
        { type: 'table',
          head: [t('Option', '做法'), t('You get', '得到什么'), t('Watch out', '注意')],
          rows: [
            [t('A. Merge into the original bf16 weights', 'A. 合并到原始 bf16 权重'), t('a bf16 model', '一个 bf16 模型'), t('a small mismatch (the adapter was fitted to dequantised weights); re-evaluate', '有一点偏差（适配器是对着反量化后的权重学的）；要重新评测')],
            [t('B. Dequantise NF4 to bf16, then merge', 'B. 先把 NF4 反量化成 bf16，再合并'), t('a bf16 model, the function you trained', '一个 bf16 模型，和训练时的函数一致'), t('carries the quantisation error; full bf16 size', '带着量化误差；体积回到 bf16')],
            [t('C. Keep the 4-bit base and the adapter', 'C. 保留 4 位基座加适配器'), t('exactly what you trained, smallest memory', '和训练时完全一致，显存最小'), t('slower kernels; an extra adapter path', '内核较慢；多一条适配器支路')],
            [t('D. Merge, then quantise for inference (GPTQ, AWQ…)', 'D. 合并后再做推理量化（GPTQ、AWQ 等）'), t('a small, fast model', '一个又小又快的模型'), t('a second quantisation error; re-evaluate', '又多一次量化误差；要重新评测')],
          ] },
        { type: 'callout', kind: 'warning', body: t('Whatever you choose, evaluate the exact file you ship, with the serving template and decoding settings (B3, layer 4). LoftQ initialises the adapters so that the 4-bit weights plus the adapter start close to the original weights, which reduces this mismatch[^loftq].', '不管选哪种，都要评测你真正上线的那个文件，用推理时的模板和解码设置（B3 第④层）。LoftQ 会在初始化时就让"4 位权重 + 适配器"接近原始权重，从而减小这种偏差[^loftq]。') },
        { type: 'cite', key: 'loftq', text: t('Li et al. (2024). LoftQ: LoRA-Fine-Tuning-Aware Quantization. ICLR.', 'Li 等（2024）。LoftQ: LoRA-Fine-Tuning-Aware Quantization。ICLR。'), url: 'https://arxiv.org/abs/2310.08659' },
      ],
    },
    {
      id: 'serve', kind: 'read', title: t('One base, many adapters', '一个基座，许多适配器'),
      blocks: [
        { type: 'p', text: t('An adapter for an 8B model with $r = 16$ is about 84 MB; the base is 16 GB. If 100 customers each get their own style, merging means 100 full models; serving the adapters on one shared base does not:', '一个 8B 模型、$r = 16$ 的适配器约 84 MB，基座是 16 GB。如果 100 个客户各有自己的风格，合并就意味着 100 份完整模型；在一个共享基座上服务这些适配器则不然：') },
        { type: 'math', tex: '100 \\times 16 \\text{ GB} = 1.6 \\text{ TB} \\qquad\\text{vs}\\qquad 16 \\text{ GB} + 100 \\times 84 \\text{ MB} \\approx 24.4 \\text{ GB}' },
        { type: 'figure', src: 'ft/c/c3-deploy.svg', alt: t('Left: 100 merged 16 GB models, 1.6 TB. Right: one 16 GB base with 100 small adapters, about 24.4 GB.', '左：100 个合并后的 16 GB 模型，共 1.6 TB。右：一个 16 GB 基座加 100 个小适配器，约 24.4 GB。'), credit: 'Own drawing; areas to scale, arithmetic on this page · 自绘；面积按比例，算术见本页' },
        { type: 'p', text: t('Serving engines batch requests for different adapters together (S-LoRA, Punica’s kernels[^slora]); Fireworks runs up to 100 LoRA adapters on one deployment. The cost: an unmerged adapter adds latency (Fireworks’ docs report time-to-first-token often 10–30% higher). All adapters must share the same base model.', '推理引擎会把不同适配器的请求放进同一个 batch 一起算（S-LoRA、Punica 的内核[^slora]）；Fireworks 能在一个部署上同时跑最多 100 个 LoRA 适配器。代价是：不合并的适配器会增加延迟（Fireworks 文档报告首 token 延迟常常高 10–30%）。所有适配器必须基于同一个基座模型。') },
        { type: 'code', lang: 'python', code: SERVE, caption: t('vLLM: one base, a different adapter per request (v0.31 names).', 'vLLM：一个基座，每个请求用不同的适配器（v0.31 的参数名）。') },
        { type: 'cite', key: 'slora', text: t('Sheng et al. (2024). S-LoRA: Serving Thousands of Concurrent LoRA Adapters. MLSys.', 'Sheng 等（2024）。S-LoRA: Serving Thousands of Concurrent LoRA Adapters。MLSys。'), url: 'https://arxiv.org/abs/2311.03285' },
      ],
    },
    {
      id: 'qat', kind: 'read', title: t('Three things called "quantisation + training"', '三种"量化 + 训练"'),
      blocks: [
        { type: 'p', text: t('They solve different problems; mixing them up is a common mistake.', '它们解决的是不同的问题；把它们混为一谈是常见的错误。') },
        { type: 'table',
          head: [t('What', '是什么'), t('When', '什么时候'), t('Solves', '解决什么')],
          rows: [
            ['QLoRA', t('during fine-tuning', '微调时'), t('training memory: the frozen base stored in 4 bits', '训练显存：冻结的基座用 4 位存储')],
            [t('PTQ (GPTQ, AWQ, …)', 'PTQ（GPTQ、AWQ 等）'), t('after training', '训练后'), t('inference memory and speed; may lose some quality', '推理显存和速度；可能损失一些质量')],
            [t('QAT', 'QAT'), t('during (post-)training', '（后）训练时'), t('inference with less quality loss: the model learns weights that survive quantisation', '推理时质量损失更小：模型学会了"经得起量化"的权重')],
          ] },
        { type: 'p', text: t('**QAT** runs the forward pass with quantised weights $\\hat w = s \\cdot \\operatorname{round}(w / s)$ and passes gradients straight through the rounding ($\\partial \\hat w / \\partial w \\approx 1$, the straight-through estimator). Google trained Gemma 3 this way for about 5,000 steps against the bf16 model’s outputs, cutting the 4-bit perplexity drop by 54% and fitting the 27B model in 14.1 GB; Kimi K2 Thinking applies INT4 QAT in post-training[^gemma].', '**QAT（量化感知训练）**在前向传播时用量化后的权重 $\\hat w = s \\cdot \\operatorname{round}(w / s)$，反向时让梯度直接穿过取整（$\\partial \\hat w / \\partial w \\approx 1$，即直通估计）。Google 用这种方法让 Gemma 3 对着 bf16 模型的输出训练了约 5000 步，4 位量化后的困惑度损失减少了 54%，27B 模型只要 14.1 GB；Kimi K2 Thinking 在后训练里用了 INT4 QAT[^gemma]。') },
        { type: 'figure', src: 'ft/c/c3-qat-timeline.svg', alt: t('A timeline: QLoRA during fine-tuning, QAT during (post-)training, PTQ after training.', '一条时间线：QLoRA 在微调时，QAT 在（后）训练时，PTQ 在训练后。'), credit: 'Own drawing · 自绘' },
        { type: 'cite', key: 'gemma', text: t('Google Developers Blog (2025). Gemma 3 QAT models.', 'Google Developers Blog（2025）。Gemma 3 QAT 模型。'), url: 'https://developers.googleblog.com/en/gemma-3-quantized-aware-trained-state-of-the-art-ai-to-consumer-gpus/' },
      ],
    },
    // ------------------------------------------------------------------ checks
    {
      id: 'q-overhead', kind: 'checkpoint', chapter: t('Check', '检验'), title: t('Block size 128', '块大小 128'), skill: 'nf4', purpose: 'check',
      prompt: t('Block size 128 with double quantisation (8-bit first-level scales, one fp32 second-level scale per 256 of them). How many bits per weight do the scales cost?', '块大小 128，使用双重量化（一级缩放系数 8 位，每 256 个共用一个 fp32 的二级系数）。缩放系数每个权重摊多少比特？'),
      question: { type: 'number', answer: 8 / 128 + 32 / (128 * 256), tolerance: 0.001, unit: t('bits', '比特'), wrong: [{ answer: 0.25, feedback: t('That is without double quantisation (32/128).', '这是没做双重量化时的值（32/128）。') }] },
      explain: t('$8/128 + 32/(128 \\cdot 256) \\approx 0.0635$.', '$8/128 + 32/(128 \\cdot 256) \\approx 0.0635$。'),
    },
    {
      id: 'q-14b', kind: 'checkpoint', title: t('A 14B model', '一个 14B 模型'), skill: 'qlora-train', purpose: 'check',
      prompt: t('A 14B model has about 13.2B parameters in its linear layers. Stored in NF4 with double quantisation, how many GB do they take?', '一个 14B 模型的线性层约有 13.2B 个参数。用 NF4 加双重量化存储，占多少 GB？'),
      question: { type: 'number', answer: 13.2 * 4.127 / 8, rtol: 0.03, unit: 'GB', wrong: [{ answer: 6.6, feedback: t('Do not forget the 0.127 bits per weight of scales.', '别忘了每个权重 0.127 比特的缩放系数开销。') }] },
      explain: t('$13.2 \\times 4.127 / 8 \\approx 6.8$ GB.', '$13.2 \\times 4.127 / 8 \\approx 6.8$ GB。'),
    },
    {
      id: 'q-merge', kind: 'checkpoint', title: t('A slightly worse merged model', '合并后略差'), skill: 'adapter-deploy', purpose: 'check',
      prompt: t('After QLoRA training the evaluation looked good. You merged the adapter into the original bf16 model and shipped it; the score is slightly lower. Most likely cause and the safest fix?', 'QLoRA 训练完，评测结果不错。你把适配器合并进原始 bf16 模型并上线了，分数略有下降。最可能的原因和最稳妥的做法是？'),
      question: { type: 'choice', options: [
        { id: 'a', label: t('The adapter was fitted to the dequantised weights; ship and evaluate the same artifact (e.g. keep the 4-bit base + adapter, or merge into the dequantised weights)', '适配器是对着反量化后的权重学的；评测并上线同一个文件（比如保留 4 位基座加适配器，或合并到反量化后的权重）'), correct: true },
        { id: 'b', label: t('The rank was too low', '秩太低') },
        { id: 'c', label: t('Merging drops half the adapter', '合并会丢掉一半适配器'), misconception: 'qlora-merge-exact' },
        { id: 'd', label: t('bf16 is less precise than 4-bit', 'bf16 比 4 位精度低') },
      ] },
    },
    {
      id: 'q-serve', kind: 'checkpoint', title: t('Two products', '两个产品'), skill: 'adapter-deploy', purpose: 'check',
      prompt: t('Choose how to ship each and say why: (a) a platform where 200 customers each have their own style adapter on the same base; (b) a single high-traffic product with one adapter. And one of your colleagues proposes "train with QLoRA so the deployed model is 4-bit and cheap": is that right?', '为下面两种情况各选一种上线方式，并说明理由：（a）一个平台，200 个客户各有自己的风格适配器，基座相同；（b）一个高并发的单一产品，只有一个适配器。另外，有同事提议"用 QLoRA 训练，这样上线的模型就是 4 位、很便宜"：对吗？'),
      question: { type: 'text', placeholder: t('(a) … (b) … colleague: …', '（a）……（b）……同事：……'), rubric: {
        key_points: [
          t('(a) Serve the adapters on one shared base (multi-adapter serving): about 16 GB + 200 small adapters, not 200 models.', '（a）在一个共享基座上服务这些适配器（多适配器服务）：约 16 GB 加 200 个小适配器，而不是 200 份模型。'),
          t('(b) Merge the adapter for the lowest latency; quantise for inference (PTQ or QAT) if memory matters, then re-evaluate.', '（b）把适配器合并，延迟最低；如果在意显存，再做推理量化（PTQ 或 QAT），然后重新评测。'),
          t('No: QLoRA quantises the frozen base during training; merged, the model is bf16-sized. Inference compression is PTQ or QAT.', '不对：QLoRA 是在训练时量化冻结的基座；合并后模型就是 bf16 的大小。推理压缩靠的是 PTQ 或 QAT。'),
        ],
        model_answer: t('(a) Multi-adapter serving on one base: about 16 GB plus 200 × 84 MB, batching requests across adapters. (b) Merge for latency; if it must be smaller, apply PTQ (or use QAT) and re-evaluate. The colleague confuses training memory with inference: QLoRA’s 4-bit base is for training; a merged model is bf16-sized.', '（a）在一个基座上做多适配器服务：约 16 GB 加 200 × 84 MB，不同适配器的请求一起成批处理。（b）为了延迟而合并；如果还要更小，就做 PTQ（或用 QAT），再重新评测。那位同事把训练显存和推理混为一谈了：QLoRA 的 4 位基座是为训练服务的；合并后的模型是 bf16 的大小。'),
        min_points: 2,
      } },
    },
    {
      id: 'choose', kind: 'read', chapter: t('How to choose', '怎么选'), title: t('Fit it, then ship it', '先装下，再上线'),
      blocks: choose_card({
        upto: 'C3', highlight: 'E2,E3,X1', card: 'C3',
        rule: t('Not enough training memory: LoRA; still not enough: QLoRA (paying speed and a little accuracy for memory). Many tenants or tasks on one base: serve adapters on a shared base; one high-traffic product: merge, and re-evaluate after merging a QLoRA adapter. Inference memory: PTQ (GPTQ, AWQ…), or QAT when you can change training and need the quality.', '训练显存不够：用 LoRA；还不够：用 QLoRA（用速度和一点精度换显存）。多租户、多任务共用一个基座：在共享基座上服务适配器；单一产品、高并发：合并，合并 QLoRA 适配器后要重新评测。推理显存：用 PTQ（GPTQ、AWQ 等）；能改训练流程、又在乎质量时，用 QAT。'),
        counter: t('"We trained with QLoRA, so the deployed model is 4-bit and cheap": merged into bf16 it is bf16-sized. And "200 customers means 200 deployments": an adapter is tens of MB and they can share one base.', '"我们用 QLoRA 训练，所以上线的模型是 4 位、很便宜"：合并到 bf16 后就是 bf16 的大小。还有"200 个客户就要部署 200 份模型"：一个适配器只有几十 MB，它们可以共享一个基座。'),
      }),
    },
  ],
};
