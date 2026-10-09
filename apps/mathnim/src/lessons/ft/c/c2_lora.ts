// C2 LoRA: learn a low-rank correction instead of every weight. Builds on the
// eigen-PCA lesson (matrices as motions, perpendicular axes, variance kept).
// Plan: part-c-efficiency.md (C2); sources there and in research-sft.md.
import type { Lesson } from '@mathnim/core';
import { attach_visual, choose_card, t, vis } from '../b/common';

const LORA_LAYER = `import math
import torch
import torch.nn as nn

class LoRALinear(nn.Module):
    def __init__(self, base: nn.Linear, r: int = 16, alpha: int = 32):
        super().__init__()
        self.base = base
        self.base.weight.requires_grad_(False)                  # W0 frozen: no grad, no Adam state
        d_out, d_in = base.weight.shape
        self.A = nn.Parameter(torch.empty(r, d_in))             # [r, d_in]
        nn.init.kaiming_uniform_(self.A, a=math.sqrt(5))        # random, as in PEFT
        self.B = nn.Parameter(torch.zeros(d_out, r))            # [d_out, r] = 0: start at the base model
        self.scale = alpha / r

    def forward(self, x):                                       # x: [b, s, d_in]
        return self.base(x) + self.scale * ((x @ self.A.T) @ self.B.T)

    @torch.no_grad()
    def merge(self):
        self.base.weight += self.scale * (self.B @ self.A)      # same shape as W0: no extra cost at inference`;

const PEFT_CONFIG = `from peft import LoraConfig, get_peft_model

config = LoraConfig(
    r=16, lora_alpha=32, lora_dropout=0.0,
    target_modules="all-linear",     # every linear layer of the blocks (not the output head)
    use_rslora=False,                # True scales by alpha/sqrt(r): consider it for r >= 64
    task_type="CAUSAL_LM",
)
model = get_peft_model(model, config)
model.print_trainable_parameters()   # Llama-3.1-8B: 41,943,040 trainable (0.52%)
# ... train with a learning rate around 1e-4 to 2e-4 ...
merged = model.merge_and_unload()    # a plain model again, same size as the base`;

export const lesson: Lesson = {
  id: 'ft-c2-lora',
  title: t('LoRA: learn a low-rank correction', 'LoRA：只学一个低秩的修正'),
  description: t('Why freezing the model and learning a small low-rank correction works, how to configure it, and when it falls short of full fine-tuning.', '为什么冻结模型、只学一个小小的低秩修正就管用，怎样配置它，以及它什么时候比不上全量微调。'),
  mode: 'essay',
  skills: [
    { id: 'lora-formula', name: t('What a LoRA layer computes', 'LoRA 层算的是什么') },
    { id: 'lora-params', name: t('Counting LoRA parameters', '计算 LoRA 参数量'), prerequisites: ['lora-formula'] },
    { id: 'lora-rank-svd', name: t('Rank, singular values and what rank r keeps', '秩、奇异值与秩 r 保留了多少'), prerequisites: ['lora-formula'] },
    { id: 'lora-init', name: t('Why B starts at zero', '为什么 B 从零开始') },
    { id: 'lora-config', name: t('Configuring LoRA', '配置 LoRA'), prerequisites: ['lora-params'] },
    { id: 'lora-capacity', name: t('When LoRA matches full fine-tuning', 'LoRA 什么时候追平全量微调'), prerequisites: ['lora-rank-svd'] },
  ],
  misconceptions: [
    { id: 'lora-smaller-model', description: t('LoRA produces a smaller, faster model.', 'LoRA 得到的是一个更小、更快的模型。') },
    { id: 'rank-bigger-better', description: t('A higher rank learns faster and better.', '秩越高，学得越快越好。') },
    { id: 'alpha-folklore', description: t('There is one correct α (such as α = 2r).', 'α 有一个"正确"的取值（比如 α = 2r）。') },
    { id: 'lora-attention-only', description: t('Adapting q and v (or attention only) is enough.', '只加在 q、v（或只加在注意力层）就够了。') },
    { id: 'finetune-is-lowrank', description: t('Fine-tuning updates are naturally low-rank; LoRA just finds them.', '微调的改动本来就是低秩的，LoRA 只是把它找出来。') },
    { id: 'lora-init-random', description: t('Both A and B should start random.', 'A 和 B 都应该随机初始化。') },
    { id: 'rank1-in-out', description: t('In a rank-1 update u vᵀ, the output direction u is also the input direction that matters.', '在秩 1 的改动 u vᵀ 里，输出方向 u 也就是起作用的输入方向。') },
  ],
  steps: [
    {
      id: 'why', kind: 'read', chapter: t('The idea', '思路'), title: t('Freeze the model, learn a correction', '冻结模型，只学一个修正'),
      blocks: [
        { type: 'p', text: t(
          'C1 showed where full fine-tuning’s memory goes: 16 bytes for every **trained** parameter. LoRA (low-rank adaptation) attacks that factor. It freezes the pretrained weights $W_0$ and learns only a correction $\\Delta W$, built as the product of two thin matrices[^hu]. It is what most hosted fine-tuning services run, and Thinking Machines’ Tinker offers nothing else.',
          'C1 讲过全量微调的显存花在哪：每个**被训练**的参数 16 字节。LoRA（低秩适配，low-rank adaptation）对付的正是这一项。它冻结预训练好的权重 $W_0$，只学一个修正 $\\Delta W$，这个修正由两个"瘦"矩阵相乘得到[^hu]。大多数托管微调服务跑的就是它，Thinking Machines 的 Tinker 也只提供 LoRA。') },
        { type: 'math', tex: 'h = W_0 x + \\frac{\\alpha}{r}\\, B A x, \\qquad B \\in \\mathbb{R}^{d \\times r},\\; A \\in \\mathbb{R}^{r \\times k}, \\quad r \\ll d, k' },
        { type: 'list', items: [
          t('$W_0 x$: the frozen layer, unchanged.', '$W_0 x$：冻结的那一层，原封不动。'),
          t('$A$ reads $r$ directions out of the input; $B$ writes them back into $r$ output directions. Their product $BA$ is a $d \\times k$ matrix of rank at most $r$.', '$A$ 从输入里读出 $r$ 个方向；$B$ 把它们写回 $r$ 个输出方向。乘积 $BA$ 是一个 $d \\times k$ 的矩阵，秩最多为 $r$。'),
          t('$\\alpha / r$: a fixed scale, more on it below.', '$\\alpha / r$：一个固定的缩放系数，后面细说。'),
        ] },
        { type: 'p', text: t('Recall from the eigen–PCA lesson that a matrix is a motion of space. What can a rank-1 correction do to a motion? Watch first.', '回忆特征值与 PCA 那节课：矩阵就是对空间的一种运动。一个秩为 1 的修正，能对这个运动做什么？先看一段。') },
        { type: 'cite', key: 'hu', text: t('Hu et al. (2022). LoRA: Low-Rank Adaptation of Large Language Models. ICLR.', 'Hu 等（2022）。LoRA: Low-Rank Adaptation of Large Language Models。ICLR。'), url: 'https://arxiv.org/abs/2106.09685' },
      ],
    },
    {
      id: 'rank1-scene', kind: 'scene', title: t('A rank-1 change', '秩为 1 的改动'), scene: vis('rank_one_update', { u: [0.5, 1], v: [1, 0], x: [1, 1] }),
      narration: t(
        'Add u times v transpose to the identity. Every input moves, but only along u, and only by its component along v. The line perpendicular to v does not move at all. That is all a rank-one change can do: read one direction, write one direction.',
        '给单位矩阵加上 u 乘以 v 的转置。每个输入都会动，但只沿 u 的方向动，动多少只取决于它在 v 方向上的分量。垂直于 v 的那条直线完全不动。秩为 1 的改动能做的就这么多：读一个方向，写一个方向。'),
    },
    {
      id: 'rank1-predict', kind: 'checkpoint', title: t('Guess first', '先猜一猜'), skill: 'lora-formula', purpose: 'predict',
      prompt: t('A layer becomes $W_0 + u v^\\top$. For which inputs $x$ does the output not change at all?', '一层变成了 $W_0 + u v^\\top$。对哪些输入 $x$，输出完全不变？'),
      question: { type: 'choice', options: [
        { id: 'a', label: t('$x$ parallel to $u$', '与 $u$ 平行的 $x$'), misconception: 'rank1-in-out' },
        { id: 'b', label: t('$x$ perpendicular to $v$', '与 $v$ 垂直的 $x$'), correct: true },
        { id: 'c', label: t('$x$ parallel to $v$', '与 $v$ 平行的 $x$') },
        { id: 'd', label: t('none: every output changes', '没有：每个输出都会变') },
      ] },
      explain: t('$(u v^\\top) x = u\\,(v \\cdot x)$: zero exactly when $v \\cdot x = 0$.', '$(u v^\\top) x = u\\,(v \\cdot x)$：当且仅当 $v \\cdot x = 0$ 时为零。'),
    },
    {
      id: 'rank1-world', kind: 'explore', title: t('Build a rank-1 change', '亲手做一个秩 1 改动'), skill: 'lora-formula',
      scene: vis('rank_one_update', { u: [0.5, 1], v: [1, 0], x: [1, 1] }),
      prompt: t('Drag the tips of $u$ (the column of $B$), $v$ (the row of $A$) and the probe $x$. (1) Turn the identity into the shear $\\begin{bmatrix} 1 & 1 \\\\ 0 & 1 \\end{bmatrix}$. (2) Then put $x$ where its output does not change, at least one unit from the origin.', '拖动 $u$（$B$ 的一列）、$v$（$A$ 的一行）和探针 $x$ 的箭头尖。（1）把单位矩阵变成剪切 $\\begin{bmatrix} 1 & 1 \\\\ 0 & 1 \\end{bmatrix}$。（2）再把 $x$ 放到输出不变的位置，离原点至少一个单位。'),
      setup: (scene: any, ui, _ctx, world) => {
        attach_visual('rank_one_update', {}, scene, ui, (i) => {
          const u = scene.uv(), x = scene.xv(), c = scene.change();
          const cross = Math.abs(u[0] * x[1] - u[1] * x[0]) / Math.max(1e-6, Math.hypot(...u) * Math.hypot(...x));
          world.emit('drag', { which: i, x_parallel_u: cross < 0.08 && Math.hypot(...x) > 0.5, change: Math.hypot(...c) });
        });
      },
      goals: [
        { id: 'shear', check: (s: any) => { const d = s.delta_W(); return Math.abs(d[0][0]) < 0.12 && Math.abs(d[0][1] - 1) < 0.12 && Math.abs(d[1][0]) < 0.12 && Math.abs(d[1][1]) < 0.12; }, message: t('$u = (1, 0)$ times $v = (0, 1)$: only inputs with a vertical component move, and they move sideways.', '$u = (1, 0)$ 乘以 $v = (0, 1)$：只有带竖直分量的输入会动，而且是横着动。') },
        { id: 'null', check: (s: any) => Math.hypot(...s.xv()) >= 1 && Math.abs(s.vx()) < 0.05 * Math.hypot(...s.vv()) * Math.hypot(...s.xv()) + 1e-3, message: t('On the line perpendicular to $v$, $v \\cdot x = 0$: the update reads nothing there.', '在垂直于 $v$ 的直线上，$v \\cdot x = 0$：更新在这里什么也读不到。') },
      ],
      detectors: [
        { id: 'in-out', on: (e) => (e.type === 'drag' && e.data!.x_parallel_u && (e.data!.change as number) > 0.2 ? { kind: 'misconception', id: 'rank1-in-out', message: t('Along $u$ the output still changes: $u$ is where changes go, $v$ decides how much.', '沿 $u$ 方向，输出还在变：$u$ 决定改动往哪去，$v$ 决定改多少。') } : null) },
      ],
      lines: [
        { text: t('The faint grid is the identity; the blue one is the identity plus u v-transpose.', '浅色网格是单位矩阵；蓝色网格是单位矩阵加上 u 乘 v 的转置。'), when: 'enter' },
        { text: t('The change always points along u. Which input direction gives no change at all?', '改动永远指向 u 的方向。哪个输入方向完全不产生改动？'), when: { finding: 'rank1-in-out' } },
        { text: t('A shear moves points sideways in proportion to their height. Which vector reads the height?', '剪切让点按高度成比例地横向移动。哪个向量负责读出"高度"？'), when: 'idle' },
        { text: t('Rank r just stacks r of these: r directions read, r directions written.', '秩 r 就是把 r 个这样的改动叠起来：读 r 个方向，写 r 个方向。'), when: 'goal' },
      ],
      solve: (s: any, _c, w) => {
        s.set({ u: [1, 0], v: [0, 1] });
        w.emit('drag', { which: 0, x_parallel_u: false, change: 1 });
        s.set({ x: [1.5, 0] });
        w.emit('drag', { which: 2, x_parallel_u: false, change: 0 });
      },
    },
    {
      id: 'count', kind: 'derive', chapter: t('How small?', '有多小？'), title: t('Counting the parameters', '数一数参数'), skill: 'lora-params',
      intro: t('A $d \\times k$ layer has $dk$ weights. Count what LoRA trains instead.', '一个 $d \\times k$ 的层有 $dk$ 个权重。数一数 LoRA 改为训练多少。'),
      lines: [
        { tex: '\\#B + \\#A = d\\,r + r\\,k = r\\,(d + k)', why: t('Every entry of the two thin matrices is trained. The count grows linearly with the rank.', '两个瘦矩阵的每个元素都要训练。参数量随秩线性增长。') },
        { tex: '\\frac{r\\,(d+k)}{d\\,k} = \\frac{16 \\times 8192}{4096^2} \\approx 0.78\\%', why: t('One 4096 × 4096 projection with $r = 16$.', '一个 4096 × 4096 的投影，$r = 16$。') },
        { tex: '16 \\times 81{,}920 \\times 32 = 41{,}943{,}040 \\approx 0.52\\% \\text{ of } 8.03\\text{B}', why: t('Llama-3.1-8B with $r = 16$ on all 7 linear layers of all 32 blocks: 81,920 is the sum of input + output sizes per block (C1).', 'Llama-3.1-8B，32 个块的全部 7 个线性层都加 $r = 16$：81,920 是每个块里所有线性层"输入 + 输出维度"之和（C1）。') },
        { tex: '41.9\\text{M} \\times 2 \\text{ bytes} \\approx 84 \\text{ MB}', why: t('The adapter file in bf16, next to a 16 GB base model. Training state: about 0.67 GB instead of 128 GB.', 'bf16 的适配器文件，对比 16 GB 的基座模型。训练状态：约 0.67 GB，而不是 128 GB。') },
      ],
      blank: { line: 0, answer: 'r*(d+k)', variables: ['r', 'd', 'k'], prompt: t('Trained parameters of one adapted layer, in $d$, $k$ and $r$.', '用 $d$、$k$、$r$ 写出一个被适配的层要训练的参数量。') },
      outro: t('Small, but is it enough? That depends on how much of a real fine-tuning update a rank-$r$ matrix can hold.', '确实小。可是够用吗？这取决于一个秩为 $r$ 的矩阵，能装下真实微调改动的多少。'),
    },
    {
      id: 'energy-predict', kind: 'checkpoint', chapter: t('Is low rank enough?', '低秩够用吗？'), title: t('Guess first', '先猜一猜'), skill: 'lora-rank-svd', purpose: 'predict',
      prompt: t('Take the real change Qwen’s own post-training made to one 896 × 896 attention matrix of Qwen2.5-0.5B. How many singular directions are needed to keep 90% of its energy (the sum of squared singular values)?', '取 Qwen 官方后训练对 Qwen2.5-0.5B 一个 896 × 896 注意力矩阵造成的真实改动。要保留它 90% 的能量（奇异值平方和），需要多少个奇异方向？'),
      question: { type: 'choice', options: [
        { id: 'a', label: t('About 4', '约 4 个'), misconception: 'finetune-is-lowrank' },
        { id: 'b', label: t('About 16', '约 16 个'), misconception: 'finetune-is-lowrank' },
        { id: 'c', label: t('About 64', '约 64 个') },
        { id: 'd', label: t('Several hundred', '几百个'), correct: true },
      ] },
      explain: t('About 400. Rank 16 keeps about 10% of it. See for yourself next.', '大约 400 个。秩 16 只保留了约 10%。下面自己看。'),
    },
    {
      id: 'lowrank-world', kind: 'explore', title: t('Cut a real update to rank r', '把一个真实的改动截到秩 r'), skill: 'lora-rank-svd',
      scene: vis('lowrank_update', { source: 'full_ft', layer: 'q_proj', r: 4 }),
      prompt: t(
        'Drag the cut line $r$: singular directions left of it are kept, the rest dropped (this is the best any rank-$r$ matrix can do). (1) On the **official post-training** update, find the smallest $r$ that keeps 10% of the energy. (2) Switch to the **rank-16 cut** and find the smallest $r$ with zero error.',
        '拖动截断线 $r$：左边的奇异方向保留，右边的丢掉（这是任何秩为 $r$ 的矩阵所能做到的最好结果）。（1）在**官方后训练**的改动上，找到保留 10% 能量的最小 $r$。（2）切换到**秩 16 截断**，找到误差为零的最小 $r$。'),
      setup: (scene: any, ui, _ctx, world) => {
        attach_visual('lowrank_update', {}, scene, ui, () => world.emit('cut', { r: scene.rank(), source: scene.src().id, energy: scene.energy() }));
      },
      goals: [
        { id: 'ten-percent', check: (s: any) => s.src().id === 'full_ft' && s.src().layer === 'q_proj' && s.rank() === s.r_for(0.1), message: t('Rank 16 keeps only about 10% of this real update: full post-training changes weights in hundreds of directions.', '秩 16 只保留了这个真实改动约 10% 的能量：完整的后训练在几百个方向上改变了权重。') },
        { id: 'exact-16', check: (s: any) => s.src().id === 'rank16' && s.rank() === 16, message: t('A LoRA update with r = 16 is exactly rank 16: by construction, not by discovery.', 'r = 16 的 LoRA 改动恰好是秩 16：这是构造出来的，不是"发现"的。') },
      ],
      detectors: [
        { id: 'big-r', on: (e) => (e.type === 'cut' && e.data!.source === 'full_ft' && (e.data!.r as number) >= 60 ? { kind: 'misconception', id: 'finetune-is-lowrank', message: t('Even 64 directions keep under a third of this update.', '即使 64 个方向，也保留不到这个改动的三分之一。') } : null) },
      ],
      lines: [
        { text: t('Top: the update, its rank-r part and what is left. Bottom: the singular values, largest first.', '上面是改动本身、它的秩 r 部分，以及剩下的部分。下面是奇异值，从大到小。'), when: 'enter' },
        { text: t('Even at the far end the residual is still large: this update is not low-rank.', '即使拖到最右边，剩下的部分还是很大：这个改动并不低秩。'), when: { finding: 'finetune-is-lowrank' } },
        { text: t('Compare the three spectra: real, cut to 16, and random.', '比较三条奇异值谱：真实的、截到 16 的、随机的。'), when: 'idle' },
        { text: t('So low rank is a constraint LoRA imposes. Whether the constraint costs you depends on the task, which is next.', '所以低秩是 LoRA 强加的约束。这个约束会不会让你吃亏，取决于任务，接下来讲。'), when: 'goal' },
      ],
      solve: (s: any, _c, w) => {
        s.source.set_value(0);
        s.layer.set_value(0);
        s.r.set_value(s.r_for(0.1));
        w.emit('cut', {});
        s.source.set_value(1);
        s.r.set_value(16);
        w.emit('cut', {});
      },
    },
    {
      id: 'eckart', kind: 'read', title: t('What rank r keeps, and why LoRA still works', '秩 r 保留了什么，以及 LoRA 为什么仍然管用'),
      blocks: [
        { type: 'p', text: t('Write the update by its singular value decomposition, $\\Delta W = \\sum_i \\sigma_i u_i v_i^\\top$, largest $\\sigma_i$ first. The best rank-$r$ approximation keeps the first $r$ terms (Eckart–Young), and what it loses is the rest:', '把改动写成奇异值分解 $\\Delta W = \\sum_i \\sigma_i u_i v_i^\\top$，$\\sigma_i$ 从大到小排。最好的秩 $r$ 近似保留前 $r$ 项（Eckart–Young 定理），丢掉的就是其余部分：') },
        { type: 'math', tex: '\\min_{\\operatorname{rank} M \\le r} \\lVert \\Delta W - M \\rVert_F^2 = \\sum_{i > r} \\sigma_i^2, \\qquad \\text{energy kept} = \\frac{\\sum_{i \\le r} \\sigma_i^2}{\\sum_i \\sigma_i^2}' },
        { type: 'p', text: t('This is the PCA lesson again: $\\Delta W^\\top \\Delta W$ is symmetric, its eigenvectors are the $v_i$ (perpendicular axes) and its eigenvalues are $\\sigma_i^2$. "Energy kept" is the same formula as "the first two components keep (9 + 4)/14 of the variance". A rank-1 matrix squashes the plane onto a line:', '这又回到了 PCA 那节课：$\\Delta W^\\top \\Delta W$ 是对称矩阵，它的特征向量就是 $v_i$（互相垂直的轴），特征值是 $\\sigma_i^2$。"保留的能量"和"前两个主成分保留了 (9 + 4)/14 的方差"是同一个公式。秩为 1 的矩阵把平面压成一条线：') },
        { type: 'visual', name: 'symmetric_ellipse', params: { S: [[1, 1], [1, 1]] }, caption: t('A symmetric matrix with eigenvalues 2 and 0: the unit circle becomes a segment. One direction survives.', '特征值为 2 和 0 的对称矩阵：单位圆变成一条线段。只有一个方向留了下来。') },
        { type: 'p', text: t(
          'So if full fine-tuning’s update is not low-rank, why does LoRA work at all? Because the task does not need **that** update. Fine-tuning has a low intrinsic dimension: training only 200 randomly projected parameters reached 90% of full fine-tuning on one RoBERTa task[^agh]. Low-rank solutions exist; they are just not the one full fine-tuning happens to find. Full fine-tuning updates are 10–100× higher-rank than typical LoRA configurations[^biderman], and when a task needs that much change, LoRA falls behind (below).',
          '既然全量微调的改动并不低秩，LoRA 为什么还管用？因为任务并不需要**那一个**改动。微调的"内在维度"很低：在一个 RoBERTa 任务上，只训练随机投影后的 200 个参数，就达到了全量微调 90% 的效果[^agh]。低秩的解是存在的，只不过不是全量微调碰巧找到的那个。全量微调的改动，秩比常见的 LoRA 配置高 10 到 100 倍[^biderman]；当任务需要这么多的改变时，LoRA 就会落后（见下文）。') },
        { type: 'cite', key: 'agh', text: t('Aghajanyan et al. (2021). Intrinsic Dimensionality Explains the Effectiveness of Language Model Fine-Tuning. ACL.', 'Aghajanyan 等（2021）。Intrinsic Dimensionality Explains the Effectiveness of Language Model Fine-Tuning。ACL。'), url: 'https://arxiv.org/abs/2012.13255' },
        { type: 'cite', key: 'biderman', text: t('Biderman et al. (2024). LoRA Learns Less and Forgets Less. TMLR.', 'Biderman 等（2024）。LoRA Learns Less and Forgets Less。TMLR。'), url: 'https://arxiv.org/abs/2405.09673' },
      ],
    },
    {
      id: 'init', kind: 'derive', chapter: t('Starting and scaling', '初始化与缩放'), title: t('Why B starts at zero', '为什么 B 从零开始'), skill: 'lora-init',
      intro: t('We want training to start exactly at the base model, and still be able to learn. Write the gradients of the two matrices.', '我们希望训练恰好从基座模型出发，同时又能学下去。写出两个矩阵的梯度。'),
      lines: [
        { tex: 'h = W_0 x + \\gamma\\, B A x, \\qquad \\delta = \\frac{\\partial L}{\\partial h}', why: t('$\\gamma = \\alpha/r$; $\\delta$ is the gradient arriving at the layer’s output.', '$\\gamma = \\alpha/r$；$\\delta$ 是传到这一层输出的梯度。') },
        { tex: '\\frac{\\partial L}{\\partial B} = \\gamma\\, \\delta\\, (A x)^\\top, \\qquad \\frac{\\partial L}{\\partial A} = \\gamma\\, B^\\top \\delta\\, x^\\top', why: t('The chain rule through the product $B(Ax)$.', '对乘积 $B(Ax)$ 用链式法则。') },
        { tex: 'B = 0,\\ A \\text{ random}: \\quad \\Delta W = 0, \\quad \\frac{\\partial L}{\\partial A} = 0, \\quad \\frac{\\partial L}{\\partial B} \\neq 0', why: t('Training starts exactly at the base model; the first step moves $B$, after which $A$ starts moving too.', '训练恰好从基座模型出发；第一步先动 $B$，之后 $A$ 也开始动。') },
        { tex: 'A = B = 0: \\ \\text{both gradients } 0 \\text{ forever}; \\qquad A, B \\text{ random: } \\Delta W \\neq 0 \\text{ at step } 0', why: t('Both zero is a dead saddle; both random perturbs the model with noise before it has learned anything.', '两个都为零，会卡在一个永远不动的鞍点；两个都随机，模型在学到任何东西之前就被噪声扰动了。') },
      ],
      blank: { line: 2, answer: '0', prompt: t('With $B = 0$, what is $\\partial L / \\partial A$?', '当 $B = 0$ 时，$\\partial L / \\partial A$ 等于多少？') },
      outro: t('PEFT initialises $A$ with Kaiming-uniform noise and $B$ with zeros, exactly this.', 'PEFT 就是这样初始化的：$A$ 用 Kaiming 均匀分布的随机数，$B$ 用零。'),
    },
    {
      id: 'scaling', kind: 'read', title: t('α, r and the learning rate', 'α、r 和学习率'),
      blocks: [
        { type: 'p', text: t('Forum advice on α conflicts ("α = 2r", "α = r", "α/√r"). What the published work says:', '论坛上关于 α 的建议互相矛盾（"α = 2r""α = r""α/√r"）。已发表的研究是这样说的：') },
        { type: 'list', items: [
          t('The LoRA paper scales the update by $\\alpha / r$, so that changing $r$ needs less retuning[^hu2].', 'LoRA 论文用 $\\alpha / r$ 缩放更新，这样改变 $r$ 时不必大幅重调[^hu2]。'),
          t('rsLoRA argues that for large ranks the scale should be $\\alpha / \\sqrt r$; with $\\alpha / r$ higher ranks stopped improving in its experiments, with $\\alpha / \\sqrt r$ they kept improving[^rs]. PEFT: `use_rslora=True`.', 'rsLoRA 认为秩很大时应该用 $\\alpha / \\sqrt r$ 缩放；在它的实验里，用 $\\alpha / r$ 时更高的秩不再带来提升，用 $\\alpha / \\sqrt r$ 则持续提升[^rs]。PEFT 里是 `use_rslora=True`。'),
          t('LoRA Without Regret: with the $1/r$ scale, early learning curves are the same for every rank, the best learning rate changes by less than 2× between $r = 4$ and $r = 512$, and it is about **10× the best full fine-tuning rate**[^tm].', 'LoRA Without Regret：在 $1/r$ 缩放下，不同秩的早期学习曲线完全一样；从 $r = 4$ 到 $r = 512$，最优学习率变化不到 2 倍；它大约是**全量微调最优学习率的 10 倍**[^tm]。'),
        ] },
        { type: 'figure', src: 'ft/c/c2-lr-vs-rank.svg', alt: t('Final loss against learning rate for LoRA ranks 1 to 512 and full fine-tuning: LoRA optima line up near 1e-4 to 2e-4, about ten times full fine-tuning’s 2e-5.', 'LoRA 秩 1 到 512 与全量微调的最终 loss 随学习率变化：LoRA 的最优点都在 1e-4 到 2e-4 附近，约为全量微调 2e-5 的 10 倍。'), credit: 'Redrawn after LoRA Without Regret (Thinking Machines, 2025) Fig. 2; values read from the figure (±0.001) · 据 LoRA Without Regret 图 2 重绘，数值近似（±0.001）' },
        { type: 'callout', kind: 'note', title: t('In practice', '实践中'), body: t('Fix α (say 16 or 32), tune the learning rate around 1e-4 to 2e-4 for 7–8B models, and do not expect a higher rank to learn faster. For ranks of 64 and above, try rsLoRA.', '固定 α（比如 16 或 32），7–8B 模型的学习率在 1e-4 到 2e-4 附近调；别指望秩越高学得越快。秩到 64 以上时，试试 rsLoRA。') },
        { type: 'details', summary: t('Intuition (ours, not the papers’): why 1/r under Adam and 1/√r under SGD', '直觉解释（我们自己的推理，不是论文结论）：为什么 Adam 下是 1/r、SGD 下是 1/√r'), blocks: [
          { type: 'p', text: t('Look at the first few steps from $B = 0$, with $A$ nearly fixed and one example. The update to $B$ is along $\\delta (Ax)^\\top$, and the change of the output is $\\gamma B A x$.', '只看从 $B = 0$ 出发的前几步，$A$ 近似不动，只有一个样本。$B$ 的更新沿着 $\\delta (Ax)^\\top$ 的方向，输出的改变量是 $\\gamma B A x$。') },
          { type: 'list', items: [
            t('**SGD:** the step on $B$ itself contains $\\gamma$, so the output change grows like $\\gamma^2 \\lVert Ax \\rVert^2 \\propto \\gamma^2 r$. Keeping it independent of $r$ needs $\\gamma \\propto 1/\\sqrt r$, the rsLoRA scale (its appendix proof uses SGD updates of this kind).', '**SGD：**$B$ 的更新本身就带着 $\\gamma$，所以输出的改变量按 $\\gamma^2 \\lVert Ax \\rVert^2 \\propto \\gamma^2 r$ 增长。要让它与 $r$ 无关，需要 $\\gamma \\propto 1/\\sqrt r$，正是 rsLoRA 的缩放（它附录里的证明用的就是这种 SGD 更新）。'),
            t('**Adam:** each step is normalised to about $\\pm\\eta$ per entry, whatever $\\gamma$ is, and the $r$ terms add up coherently: the output change grows like $\\gamma\\,\\eta\\, r$. Keeping it independent of $r$ needs $\\gamma \\propto 1/r$, consistent with the identical early curves above. It also means α and the learning rate act almost as one knob.', '**Adam：**不管 $\\gamma$ 是多少，每一步都被归一化成每个元素约 $\\pm\\eta$，而 $r$ 项会同向累加：输出的改变量按 $\\gamma\\,\\eta\\, r$ 增长。要让它与 $r$ 无关，需要 $\\gamma \\propto 1/r$，这和上面"早期曲线相同"的观察一致。这也意味着，α 和学习率几乎是同一个旋钮。'),
          ] },
          { type: 'callout', kind: 'open', body: t('A simplification (one example, early training, fixed $A$). Which scale is better for a given rank and run length is still an open question.', '这是简化的推理（单个样本、训练初期、$A$ 不动）。对给定的秩和训练长度，哪种缩放更好，仍是开放问题。') },
        ] },
        { type: 'cite', key: 'hu2', text: t('Hu et al. (2022). LoRA. ICLR.', 'Hu 等（2022）。LoRA。ICLR。'), url: 'https://arxiv.org/abs/2106.09685' },
        { type: 'cite', key: 'rs', text: t('Kalajdzievski (2023). A Rank Stabilization Scaling Factor for Fine-Tuning with LoRA.', 'Kalajdzievski（2023）。A Rank Stabilization Scaling Factor for Fine-Tuning with LoRA。'), url: 'https://arxiv.org/abs/2312.03732' },
        { type: 'cite', key: 'tm', text: t('Schulman et al. / Thinking Machines (2025). LoRA Without Regret.', 'Schulman 等 / Thinking Machines（2025）。LoRA Without Regret。'), url: 'https://thinkingmachines.ai/blog/lora/' },
      ],
    },
    {
      id: 'where', kind: 'read', title: t('Where to attach the adapters', '适配器加在哪里'),
      blocks: [
        { type: 'p', text: t('The original LoRA paper adapted only the attention projections $W_q$ and $W_v$ of GPT-3. Later results changed the default:', 'LoRA 原论文只适配了 GPT-3 注意力里的 $W_q$ 和 $W_v$。后来的结果改变了默认做法：') },
        { type: 'list', items: [
          t('QLoRA found adapters on **all linear layers** were needed to match full fine-tuning[^qlora].', 'QLoRA 发现，要追平全量微调，必须在**所有线性层**上加适配器[^qlora]。'),
          t('LoRA Without Regret: the MLP layers matter most. Attention-only LoRA (r = 256) did worse than MLP-only LoRA (r = 128) with about the same number of parameters; MLP-only was about as good as all layers.', 'LoRA Without Regret：MLP 层最重要。参数量差不多时，只加在注意力层（r = 256）比只加在 MLP（r = 128）效果更差；只加 MLP 和全部都加差不多。'),
          t('LoRA tolerates large batches less well than full fine-tuning, at any rank.', '无论秩多大，LoRA 对大 batch 的耐受都不如全量微调。'),
        ] },
        { type: 'figure', src: 'ft/c/c2-modules.svg', alt: t('Final loss for full fine-tuning, MLP-only, all-layer and attention-only LoRA: attention-only is clearly worse.', '全量微调、只加 MLP、全部层、只加注意力的 LoRA 的最终 loss：只加注意力明显更差。'), credit: 'Redrawn after LoRA Without Regret (Thinking Machines, 2025) Fig. 4; values read from the figure (±0.001) · 据 LoRA Without Regret 图 4 重绘，数值近似（±0.001）' },
        { type: 'code', lang: 'python', label: 'PEFT', code: PEFT_CONFIG, caption: t('A sensible starting configuration (PEFT v0.21 names).', '一份合理的起始配置（PEFT v0.21 的参数名）。') },
        { type: 'details', summary: t('Variants you will meet', '你会遇到的变体'), blocks: [
          { type: 'list', items: [
            t('**DoRA** learns the magnitude and the direction of each weight column separately, applying LoRA to the direction[^dora].', '**DoRA** 把每个权重列的大小和方向分开学，LoRA 只用在方向上[^dora]。'),
            t('**PiSSA, OLoRA, EVA, LoftQ, CorDA** change how $A$ and $B$ are initialised (PEFT supports them).', '**PiSSA、OLoRA、EVA、LoftQ、CorDA** 改的是 $A$ 和 $B$ 的初始化方式（PEFT 都支持）。'),
          ] },
        ] },
        { type: 'cite', key: 'qlora', text: t('Dettmers et al. (2023). QLoRA. NeurIPS.', 'Dettmers 等（2023）。QLoRA。NeurIPS。'), url: 'https://arxiv.org/abs/2305.14314' },
        { type: 'cite', key: 'dora', text: t('Liu et al. (2024). DoRA: Weight-Decomposed Low-Rank Adaptation. ICML.', 'Liu 等（2024）。DoRA: Weight-Decomposed Low-Rank Adaptation。ICML。'), url: 'https://arxiv.org/abs/2402.09353' },
      ],
    },
    {
      id: 'capacity', kind: 'read', chapter: t('When it falls short', '什么时候不够'), title: t('Capacity versus information', '容量与信息量'),
      blocks: [
        { type: 'p', text: t('LoRA matches full fine-tuning when it is not short of capacity: small and medium SFT, with all layers adapted, the higher learning rate and small batches. It falls behind when the data carries more than the adapter can hold:', 'LoRA 在容量不吃紧时能追平全量微调：中小规模的 SFT、加在所有层、用更高的学习率和小 batch。当数据携带的信息超过适配器能装下的量时，它就会落后：') },
        { type: 'figure', src: 'ft/c/c2-capacity.svg', alt: t('Loss against training progress for LoRA ranks and full fine-tuning: low ranks fall behind as the dataset grows.', 'LoRA 各秩和全量微调的 loss 随训练进度变化：数据越多，低秩越落后。'), credit: 'Left schematic, right values read from LoRA Without Regret (Thinking Machines, 2025) Fig. 1 (±0.002) · 左为示意，右图数值读自 LoRA Without Regret 图 1（±0.002）' },
        { type: 'p', text: t('An order-of-magnitude argument (an assumption, not a measurement of LoRA): if a parameter can store about 2 bits, as studies of neural nets on synthetic data suggest, a rank-1 adapter on all linear layers of an 8B model (2.6M parameters) holds about 5M bits. Reinforcement learning with a right/wrong reward delivers at most about 1 bit per episode, so even 100,000 episodes fit in rank 1, and indeed **rank 1 matched full fine-tuning for RL**. SFT delivers information with every token, so large SFT datasets and continued pretraining can exceed small ranks.', '一个量级上的论证（这是假设，不是对 LoRA 的测量）：如果每个参数大约能存 2 比特（这是神经网络在合成数据上的研究给出的估计），那么 8B 模型所有线性层上的秩 1 适配器（260 万个参数）大约能装 500 万比特。用对/错奖励的强化学习，每个回合最多带来约 1 比特信息，所以即使 10 万个回合也装得进秩 1；事实上，**在强化学习里秩 1 就追平了全量微调**。SFT 的每个 token 都带信息，所以大规模 SFT 数据和继续预训练可能超出小秩的容量。') },
        { type: 'figure', src: 'ft/c/c2-learns-less-forgets-less.svg', alt: t('Target-domain score against forgetting for LoRA ranks and full fine-tuning on code and math: LoRA learns less and forgets less.', '代码和数学上 LoRA 各秩与全量微调的目标领域得分与遗忘的关系：LoRA 学得少、忘得也少。'),
          caption: t('"LoRA learns less and forgets less": on code, LoRA had the better learn–forget trade-off; on math, full fine-tuning did.', '"LoRA 学得少，忘得也少"：在代码上，LoRA 的学–忘权衡更好；在数学上，全量微调更好。'), credit: 'Data: Biderman et al. (2024), Tables S1–S8 (Llama-2-7B) · 数据：Biderman 等（2024）附录表 S1–S8' },
        { type: 'p', text: t('These results do not contradict each other; they describe different regimes. Small SFT and RL: LoRA is enough. Millions of examples or billions of tokens of continued pretraining, when you need the best target-domain score: full fine-tuning or a much larger rank, and expect more forgetting (B4).', '这些结果并不矛盾，它们描述的是不同的情形。小规模 SFT 和强化学习：LoRA 就够了。几百万条样本，或者几十亿 token 的继续预训练，又要在目标领域拿到最好的成绩：用全量微调或者大得多的秩，并且要预期更多的遗忘（B4）。') },
      ],
    },
    {
      id: 'merge', kind: 'read', title: t('LoRA is not a smaller model', 'LoRA 不是一个更小的模型'),
      blocks: [
        { type: 'p', text: t('After training, $W' + "'" + ' = W_0 + \\frac{\\alpha}{r} BA$ has exactly the shape of $W_0$. A merged LoRA model is as large and as fast as the base model. Left unmerged, every adapted layer runs two extra small matrix multiplications: few FLOPs, but extra latency. What LoRA saved was training memory (gradients and optimizer states) and storage (an 84 MB adapter per task).', '训练完以后，$W' + "'" + ' = W_0 + \\frac{\\alpha}{r} BA$ 的形状和 $W_0$ 完全一样。合并后的 LoRA 模型和基座一样大、一样快。不合并的话，每个被适配的层都要多做两次小矩阵乘法：算力不多，但会增加延迟。LoRA 省下的是训练显存（梯度和优化器状态）和存储（每个任务一个 84 MB 的适配器）。') },
        { type: 'figure', src: 'ft/c/c2-merge-paths.svg', alt: t('Merged: one matmul with W0 + (α/r)BA, same shape as W0. Unmerged: W0 x plus a small x → A → B path.', '合并：用 W0 + (α/r)BA 做一次矩阵乘法，形状与 W0 相同。不合并：W0 x 再加一条 x → A → B 的小支路。'), credit: 'Own drawing · 自绘' },
        { type: 'p', text: t('Which one to ship, and how to serve many adapters at once, is C3.', '上线时用哪种方式、怎样同时服务许多适配器，在 C3 讲。') },
      ],
    },
    {
      id: 'layer-code', kind: 'code', title: t('A LoRA layer from scratch', '从零写一个 LoRA 层'),
      intro: t('The whole idea in twenty lines: freeze, two thin matrices, B at zero, the scale, and merging.', '二十行代码讲完整个思路：冻结、两个瘦矩阵、B 从零开始、缩放，以及合并。'),
      lang: 'python', code: LORA_LAYER,
      notes: [
        { lines: [9, 9], text: t('Freezing: no gradient and no Adam state for $W_0$, which is where C1’s 16 bytes per parameter went.', '冻结：$W_0$ 不算梯度、不占 Adam 状态，C1 里每参数 16 字节的开销就是这样省下来的。') },
        { lines: [11, 13], text: t('$A$ random, $B$ zero: training starts exactly at the base model.', '$A$ 随机，$B$ 为零：训练恰好从基座模型出发。'), shapes: 'A: [r, d_in]  B: [d_out, r]' },
        { lines: [14, 14], text: t('The fixed scale $\\alpha / r$.', '固定的缩放系数 $\\alpha / r$。') },
        { lines: [16, 17], text: t('Multiply by $A$ first, so the $d \\times k$ matrix $BA$ is never built during training.', '先乘 $A$，这样训练时从来不会构造出 $d \\times k$ 的矩阵 $BA$。'), shapes: 'x: [b, s, d_in] → [b, s, r] → [b, s, d_out]' },
        { lines: [19, 21], text: t('Merging folds the correction into $W_0$: same shape, no extra cost at inference.', '合并就是把修正加进 $W_0$：形状不变，推理时没有额外开销。') },
      ],
    },
    // ------------------------------------------------------------------ checks
    {
      id: 'q-fraction', kind: 'checkpoint', chapter: t('Check', '检验'), title: t('How small?', '有多小？'), skill: 'lora-params', purpose: 'check',
      prompt: t('A 4096 × 4096 layer gets a LoRA adapter with $r = 16$. What percentage of the layer’s parameters does the adapter train?', '一个 4096 × 4096 的层加了 $r = 16$ 的 LoRA 适配器。适配器训练的参数占这一层的百分之几？'),
      question: { type: 'number', answer: 0.78125, tolerance: 0.02, unit: '%', wrong: [{ answer: 0.390625, feedback: t('That counts only $A$ or only $B$; both are trained.', '这只算了 $A$ 或只算了 $B$；两个都要训练。') }] },
      explain: t('$16 \\times 8192 / 4096^2 \\approx 0.78\\%$.', '$16 \\times 8192 / 4096^2 \\approx 0.78\\%$。'),
    },
    {
      id: 'q-rank', kind: 'checkpoint', title: t('Change only the rank', '只改秩'), skill: 'lora-config', purpose: 'check',
      prompt: t('With the $\\alpha / r$ scale and the same learning rate, you raise the rank from 8 to 64. What do the first 100 steps of the loss curve look like?', '在 $\\alpha / r$ 缩放、学习率不变的情况下，把秩从 8 调到 64。loss 曲线的前 100 步会怎样？'),
      question: { type: 'choice', options: [
        { id: 'a', label: t('Almost the same', '几乎一样'), correct: true },
        { id: 'b', label: t('Rank 64 falls about 8× faster', '秩 64 下降快约 8 倍'), misconception: 'rank-bigger-better' },
        { id: 'c', label: t('Rank 64 is slower', '秩 64 更慢') },
        { id: 'd', label: t('Rank 64 diverges', '秩 64 发散') },
      ] },
      explain: t('With the $1/r$ scale the early curves of all ranks coincide (LoRA Without Regret). The rank sets the capacity, not the speed.', '在 $1/r$ 缩放下，各个秩的早期曲线重合（LoRA Without Regret）。秩决定的是容量，不是速度。'),
    },
    {
      id: 'q-diagnose', kind: 'checkpoint', title: t('Falling short', '比不上全量'), skill: 'lora-capacity', purpose: 'check',
      prompt: t('LoRA with $r = 16$ on 2 million code examples ends clearly worse than full fine-tuning. Which two causes are most likely?', '在 200 万条代码样本上用 $r = 16$ 的 LoRA，结果明显比全量微调差。最可能是哪两个原因？'),
      question: { type: 'choice', options: [
        { id: 'a', label: t('The data carries more than a rank-16 adapter can hold, and/or the adapters are on attention only', '数据携带的信息超过了秩 16 适配器的容量，以及/或者适配器只加在了注意力层'), correct: true },
        { id: 'b', label: t('B was initialised at zero', 'B 初始化为零'), misconception: 'lora-init-random' },
        { id: 'c', label: t('Merging lost precision', '合并时损失了精度') },
        { id: 'd', label: t('α should be 2r', 'α 应该取 2r'), misconception: 'alpha-folklore' },
      ] },
      explain: t('Check where the adapters sit (all linear layers, MLP first), then raise the rank or use full fine-tuning for this much data. Also check the batch size: LoRA tolerates large batches less well.', '先查适配器加在哪里（所有线性层，MLP 优先）；数据这么多，再考虑提高秩或用全量微调。还要查 batch 大小：LoRA 对大 batch 的耐受更差。'),
    },
    {
      id: 'q-size', kind: 'checkpoint', title: t('Explain it', '解释一下'), skill: 'lora-formula', purpose: 'check',
      prompt: t('A colleague says: "We used LoRA, so the deployed model will be smaller and faster." Correct them in two sentences: what did LoRA save, and what did it not?', '同事说："我们用了 LoRA，所以上线的模型会更小更快。"用两句话纠正：LoRA 省了什么，没省什么？'),
      question: { type: 'text', placeholder: t('LoRA saved…, but…', 'LoRA 省下的是……，但……'), rubric: {
        key_points: [
          t('A merged LoRA model has the same size and speed as the base model (unmerged adapters even add a little latency).', '合并后的 LoRA 模型和基座一样大、一样快（不合并时还会多一点延迟）。'),
          t('LoRA saved training memory (gradients and optimizer states of the frozen weights) and storage per task, not activations or inference cost.', 'LoRA 省下的是训练显存（冻结权重的梯度和优化器状态）以及每个任务的存储，不是激活值，也不是推理成本。'),
        ],
        model_answer: t('Merged, the model is exactly as large and as fast as the base (unmerged it is slightly slower). LoRA saved training memory, since frozen weights need no gradients or Adam states, and storage, an 84 MB adapter per task; to make inference smaller you need quantisation (C3).', '合并后，模型和基座一样大、一样快（不合并还稍慢一点）。LoRA 省下的是训练显存（冻结的权重不需要梯度和 Adam 状态）和存储（每个任务一个 84 MB 的适配器）；要让推理更省，得靠量化（C3）。'),
        min_points: 2,
      } },
    },
    {
      id: 'choose', kind: 'read', chapter: t('How to choose', '怎么选'), title: t('When LoRA, when full fine-tuning', '什么时候用 LoRA，什么时候全量'),
      blocks: choose_card({
        upto: 'C2', highlight: 'X1,B2', card: 'C2',
        rule: t('Small and medium SFT and any RL: LoRA by default, on all linear layers, learning rate about 10× full fine-tuning, small batches, r 16–64 (RL can go much lower). Very large SFT or continued pretraining, when you need the best target-domain score: full fine-tuning or a much larger rank, accepting more forgetting and C1’s memory. When you care about not breaking existing abilities, LoRA itself is a regulariser (learns less, forgets less).', '中小规模 SFT 和各种强化学习：默认用 LoRA，加在所有线性层，学习率约为全量的 10 倍，小 batch，r 取 16–64（强化学习可以低得多）。超大规模 SFT 或继续预训练、又要目标领域的最佳成绩：用全量微调或大得多的秩，并接受更多遗忘和 C1 算出的显存。在意不弄坏已有能力时，LoRA 本身就是一种正则（学得少、忘得少）。'),
        counter: t('"Use LoRA to make inference smaller and faster": a merged LoRA model is exactly as large. And "raise the rank of attention-only adapters to make up for the MLP": with the same parameter count it is still worse.', '"用 LoRA 让推理更小更快"：合并后的 LoRA 模型一样大。还有"把只加在注意力层的秩调高，来弥补 MLP"：参数量相同时效果仍然更差。'),
      }),
    },
  ],
};
