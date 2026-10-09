# C 装得下：C1–C3 逐段规划

2026-10-10。按 [README.md](README.md) 第 8 节模板编写；交互准则见 README 第 4 节。

**依据：**
- [research-technical.md](research-technical.md)（下文记作 [技]）
- [research-pedagogy.md](research-pedagogy.md)（[教]）
- [research-adoption.md](research-adoption.md)（[用]）
- 标准文献但不在调研文件里的出处标为 **[补]**，列在文末，写页面前需要核对。

**页面类型：** read / derive / code / scene / world / checkpoint / figure / ask，含义同 part-b。

**单位：** 1 GB = 10⁹ 字节。显卡的标称容量和实际可用容量之间，还差 CUDA 上下文和显存碎片。

**本部分的分量（据 [用]）：**
- LoRA/QLoRA 是实践中最常见的微调形态：
  - Hub 上 `peft` 库的模型有 270,110 个，带 `unsloth` 标签的有 144,775 个；
  - Vertex、Bedrock、Fireworks 的微调默认都是适配器；
  - Thinking Machines 的 Tinker 只支持 LoRA。
- 所以 C2 是核心课，讲得最深。
- C3 里加入多适配器服务和量化感知训练（QAT）的简短说明。

**和"特征值 → PCA"课的衔接**（`apps/mathnim/src/lessons/eigen-pca`）：
- "矩阵是平面的运动"（`linear_map`）；
- "对称矩阵有互相垂直的主轴"（`symmetric_ellipse`）；
- "前两个主成分保留了 (9+4)/14 的方差"（`reduce-q`）。
- C2 直接引用这三处。

> **修订记录（2026-10-10，据 [research-sft.md](research-sft.md) §2）：**
> 1. 容量"2 比特/参数"出自 Allen-Zhu & Li（Physics of LMs 3.3），不是 LoRA 的测量；D5 是量级假设，"每 token 0.1 比特"是本计划的假设。
> 2. NF4"每格质量相等"只对精确的 N(0,1) 成立；Yoshida 2023 已核实（删去"待核实"）。
> 3. 偏移 0.9677 与 $1-\tfrac12(\tfrac1{32}+\tfrac1{30})$ 只是数值相等；bnb 称其为经验值。
> 4. TRL v1.15 SFTTrainer 默认分块计算 log 概率；"不融合 4.2 GB"适用于普通 PyTorch / `Trainer`。
> 5. D4 的 SGD 一步与 rsLoRA 附录 A 的证明一致；Adam 一步是本计划自己的推理。按协调者决定，课程正文只讲已发表结论，直觉解释放在折叠块里。
> 6. "只挂注意力层 r≈49 才与 all-linear r=16 参数量相同"是本计划的推算；Thinking Machines 的同参数量对比是 attention r=256 对 MLP r=128，且 MLP-only ≈ 全部层。
> 7. Biderman：代码上 LoRA 的学–忘权衡更好，数学上全量更好；Tülu-v2-mix 上两者相当。
> 8. 混合精度论文讨论的是 FP16（相差 2048 倍时更新被吞）；本课 bf16 的数字是类比改写，课程中已注明。
> 9. Fireworks"一个部署 100 个适配器"出自其 SFT 教程博客；文档链接已迁移。

---

## C1 显存账

- **时长：** 约 29.5 分钟
- **前置：** B1（logits 与损失）；学生懂反向传播。Adam 的 m、v 用公式卡片补上。
- **技能 id：** `vram-static`、`vram-activations`、`vram-logits`、`vram-estimate`、`vram-sharding`
- **误区 id：** `vram-model-size`、`lora-saves-activations`、`params-dominate`、`logits-small`、`checkpointing-free`

### 学完能做到
1. **静态显存：** 不查资料写出混合精度 AdamW 的 16 字节/参数分解，换算出 8-bit Adam（约 10 字节）和纯 bf16（8 字节）的情形，并说出为什么需要 fp32 主权重。
2. **激活值：** 用 Korthikanti 公式估算激活值；说出激活重算省了多少显存、多花多少计算（约 +33%）。
3. **logits：** 算出 logits 和它的梯度占多少显存，说出融合或分块交叉熵的作用。
4. **总账：** 给定模型、方法、序列长度和 batch，估出总显存，判断用什么卡、要不要多卡分片。
5. **两个反直觉的点：**
   - LoRA 为什么**没有**省掉激活值；
   - batch 变大以后，QLoRA 的节省比例为什么会下降。

### 要解开的误解

| id | 误解 | 实际情况与证据 |
|---|---|---|
| `vram-model-size` | 模型权重 16 GB，所以 16 GB 显存就能微调 | 全量 AdamW 每个参数要 16 字节：8B 模型光静态部分就约 128 GB（[ZeRO](https://arxiv.org/abs/1910.02054)；[技] §3）。 |
| `lora-saves-activations` | LoRA 冻结了基座，所以激活值也省了 | LoRA 省的是冻结权重的梯度和优化器状态。每一层都挂着 LoRA，反向传播必须穿过所有冻结层，这些层的输入和非线性的输入仍然要存（推导 D3）。QLoRA 在 batch 变大时节省比例下降，原因正是激活值占了大头（[NeMo 文档](https://docs.nvidia.com/nemo-framework/user-guide/24.09/sft_peft/qlora.html)；[教] §3.5）。 |
| `params-dominate` | 显存主要花在参数上 | 序列一长、batch 一大，激活值和 logits 就会超过参数（推导 D3、D4）。 |
| `logits-small` | logits 只是最后一层，可以忽略 | s × V × 4 字节：8B 模型、4k 上下文时约 2.1 GB，它的梯度还要再占同样多；词表是 128k（[技] §3）。 |
| `checkpointing-free` | 激活重算（口语叫"梯度检查点"）省显存，没有代价 | 反向时要重算一遍前向，计算量约多 33%（每 token 从 6N 变成 8N FLOPs，[技] §3）。 |

### 段落脚本

| # | 类型 | 内容要点 | 为什么用这种形式 | 分钟 |
|---|---|---|---|---|
| 1 | checkpoint | **下注：** "Llama-3.1-8B 的 bf16 权重约 16 GB。全量 AdamW 微调，序列 4096、batch 1，至少要多少显存？"（约 16 GB / 约 32 GB / 约 64 GB / 130 GB 以上） | 先让学生暴露"模型多大就要多大显存"的直觉。 | 1 |
| 2 | read | **五块显存加一项开销：** 权重、梯度、优化器状态、激活值、logits，再加 CUDA 上下文和碎片。<br>• 静态部分 ∝ 参数量 N；<br>• 动态部分 ∝ b·s（batch × 序列长度）。<br>一张"账本"示意条贯穿全课。 | 先给框架，后面每一项各自推导。 | 2 |
| 3 | derive | **16 字节/参数**（推导 D1）：bf16 为什么存不住小的更新，所以需要 fp32 主权重；8-bit Adam 和纯 bf16 的情形。<br>公式卡片：Adam 的 $m_t$、$v_t$。 | 每一项都有"为什么"，需要逐行写出。 | 3 |
| 4 | derive | **Llama-3.1-8B 的参数构成**（推导 D2）：<br>• 每层 7 个线性层的形状和参数量；<br>• 32 层合计 6.98B；<br>• 嵌入加 LM head 1.05B。<br>这张表在 C2（LoRA 参数量）和 C3（NF4 只量化线性层）里还会用到。 | 一张表加两行算式。 | 2 |
| 5 | derive | **激活值**（推导 D3）：<br>• $s\,b\,h\,(34+5as/h)$ 字节/层，FlashAttention 去掉后一项；<br>• 34 由三部分组成：注意力 11、MLP 19、两个 LayerNorm 4；<br>• 8B、4k 时：0.57 GB/层，32 层约 18 GB；<br>• 开激活重算：约 1.6 GB，计算量 +33%；<br>• Llama 结构粗算约 41·sbh（本课估算）；<br>• LoRA 为什么还要存激活值。 | 本课最容易出错的一项，要逐步写出。 | 3.5 |
| 6 | derive | **logits**（推导 D4）：<br>• $b\cdot s\cdot V\cdot4$ 字节，梯度再加一份；<br>• 32k 上下文时各约 16.8 GB；<br>• 分块或融合交叉熵：不把整块 logits 放进显存（[Cut Cross-Entropy](https://arxiv.org/abs/2411.09009)）。 | 一个数字就能纠正误解。 | 1.5 |
| 7 | world | **显存计算器**（`vram_calculator`），见交互 I1。 | 各项随配置的变化是这一课的核心关系，要亲手预算，见 I1。 | 6 |
| 8 | read | **三种方法各省了哪一块**（推导 D5 的总表）：<br>• 全量约 135–150 GB；<br>• LoRA 约 19–24 GB；<br>• QLoRA 约 9–13 GB，取决于是否融合交叉熵。<br>与 Unsloth 标称最低值的对照：LoRA 22 GB、QLoRA 6 GB，Unsloth 没写明序列长度，而且用了融合内核（[Unsloth](https://unsloth.ai/docs/get-started/beginner-start-here/unsloth-requirements)）。 | 总结表。 | 2 |
| 9 | read | **拆到多张卡**（推导 D6）：<br>• ZeRO-1/2/3、FSDP 的每卡显存公式；<br>• 8B 全量用 2 张 80 GB 卡做 ZeRO-3：每卡约 64 GB 静态加激活值；<br>• 也可以把优化器状态卸到 CPU，代价是速度。 | 公式加一张对照表。 | 2 |
| 10 | code | **实测与开关：**<br>• `torch.cuda.reset_peak_memory_stats()` / `max_memory_allocated()`；<br>• `torch.cuda.memory._record_memory_history()` 导出显存快照；<br>• `model.gradient_checkpointing_enable()`；<br>• `optim="adamw_8bit"` / `"paged_adamw_8bit"`；<br>• 融合交叉熵（Liger 内核或 CCE）。 | 学生要能自己验证账算得对不对。 | 2 |
| 11 | figure | **一个训练步里的显存时间线：** 前向时激活值一路累积，反向时边释放边分配梯度，优化器那一步出现尖峰。 | 示意图（标注"示意"），一张图胜过文字描述；学生可以用 C1-c2 在自己的 GPU 上得到真实的版本。 | 1 |
| 12 | checkpoint ×4 | 检验题 Q1–Q4。 | | 2.5 |
| 13 | scene | **怎么选卡片：** `decision_map({ upto: 'C1', highlight: ['DM-X1'] })`，加上规则和反例。 | 每课结尾更新同一张决策图（part-f 第 2 节的约定）。 | 1 |
| 14 | ask | 建议的提问："我有一张 24 GB 的卡，想训 Qwen2.5-7B，序列 8k，够吗？"导师调用 `vram_calculator`，填入参数后回答。 | 课外迁移；这个零件本来就是给导师用的。 | — |

合计约 29.5 分钟。

### 交互规格

**I1 显存计算器**（零件 `vram_calculator`）
- **变量：**
  - 模型预设：每个预设带层数 L、隐藏维度 h、MLP 中间维度、注意力头数、KV 头数、词表大小 V、是否共享嵌入（tied）。
    - 预设：Llama-3.2-1B、3B，Llama-3.1-8B，Qwen2.5-7B、14B、32B，Llama-3.1-70B；
    - 结构参数实现时从各模型的 `config.json` 读取并核对。
  - 方法：全量 / LoRA / QLoRA；
  - 优化器：AdamW 混合精度 / 8-bit AdamW / 纯 bf16；
  - LoRA 的秩 r 和挂载位置：all-linear / 只挂注意力层；
  - 序列长度 s：512–32k；
  - micro-batch b：1–32；
  - 激活重算：开 / 关；
  - 融合交叉熵：开 / 关；
  - 卡数 N，ZeRO-3：开 / 关。
- **画面：**
  - 一根堆叠柱，各块分别是：冻结权重、可训练权重、梯度、优化器状态、激活值、logits（含梯度）、开销；每块都带文字标签和数值；
  - 旁边是 16 / 24 / 48 / 80 GB 的容量线；
  - 超出容量时柱顶变成虚线，并显示"超出 X GB"。
- **学生做什么：**
  - 先完成第 1 段的下注；
  - 揭晓后，先找到"8B、序列 4096，能放进 24 GB"的配置；
  - 再把 b 从 1 拖到 16，比较 LoRA 和 QLoRA。
- **应该注意到：**
  - 全量微调时，优化器状态是最大的一块；
  - LoRA 和 QLoRA 下，长序列时最大的变成激活值和 logits；
  - 关掉激活重算，激活值从约 1.6 GB 跳到约 18 GB；
  - QLoRA 相对 LoRA 的节省比例，b = 1 时约 54%，b = 16 时只剩约 23%（推导 D5）。
- **结束时的问题：** "从 b = 1 到 b = 16，QLoRA 相对 LoRA 省下的比例怎么变？为什么？"
  - 要点：量化只压缩了冻结权重；激活值随 b 线性增长，不会被量化。
- **计算：** 按推导 D1–D6 的估算公式精确计算，不是实测。
  - 界面注明："估算值；实际占用因实现而异，请用第 10 段的方法实测一次再对照。"
  - 开销按 1 GB 计，是经验值，界面上也标明。
- **三条准则：**
  - **关系：** 哪一块占大头，会随 s、b、方法非线性地切换，文字只能逐条断言，学生自己估不出来。
  - **形式：** 拖参数就是在做真实的预算（README 第 4 节的原例）。
  - **以问题收尾：** 先下注，最后回答上面的问题。
- **世界：**
  - 目标 1：8B、s = 4096，放进 24 GB；
  - 目标 2：QLoRA、8B，在 16 GB 里放下 s ≥ 16k 的序列；
  - `solve`：
    - 目标 1：LoRA r = 16，开激活重算，开融合交叉熵（约 19.4 GB）；
    - 目标 2：QLoRA，开激活重算，开融合交叉熵，s = 16k（约 14 GB：静态 7.4 GB，加上每 token 约 0.40 MB 的检查点激活值）。
  - 检测器：学生在下注时选"约 16 GB"，揭晓时记误区 `vram-model-size`。

### 推导全文

**D1 16 字节/参数**
1. **混合精度 AdamW 下，每个参数要存：**
   - bf16 权重 2 字节；
   - bf16 梯度 2 字节；
   - fp32 主权重 4 字节；
   - Adam 的一阶矩 m 4 字节、二阶矩 v 4 字节。
   - 合计 **16 字节**（ZeRO 论文写作 2Ψ + 2Ψ + 12Ψ）。
2. **为什么需要 fp32 主权重：**
   - bf16 只有 7 位显式尾数，[1, 2) 内相邻两个数相差 $2^{-7}\approx0.0078$（相对精度）；
   - 一个典型权重 w = 0.02，每一步的 Adam 更新约为 η = 1e-5，相对变化 $5\times10^{-4}$，远小于半个格距 $2^{-8}\approx0.0039$；
   - 所以四舍五入后 w 不变，更新被"吞"掉了。fp32 有 23 位尾数，能保住这些小更新（[补] 混合精度训练）。
3. **8-bit Adam：** m 和 v 各 1 字节，合计 2 + 2 + 4 + 1 + 1 = **10 字节**。
4. **纯 bf16（不存主权重）：** 2 + 2 + 2 + 2 = **8 字节**。要配合随机舍入（stochastic rounding）之类的技巧，否则会出现第 2 步那种更新被吞的问题。
5. **算例：** 8B 全量，16 × 8.03 = **128.5 GB**。
   - 填空：3.2B 全量 = ？（51.2 GB）

**D2 Llama-3.1-8B 的参数构成**

结构参数：h = 4096，L = 32，32 个注意力头，8 个 KV 头（头维 128），MLP 中间维 14336，V = 128,256，嵌入与 LM head 不共享。

| 线性层 | 形状（输入 → 输出） | 参数 | 输入 + 输出维度 |
|---|---|---|---|
| q_proj | 4096 → 4096 | 16.78M | 8,192 |
| k_proj | 4096 → 1024 | 4.19M | 5,120 |
| v_proj | 4096 → 1024 | 4.19M | 5,120 |
| o_proj | 4096 → 4096 | 16.78M | 8,192 |
| gate_proj | 4096 → 14336 | 58.72M | 18,432 |
| up_proj | 4096 → 14336 | 58.72M | 18,432 |
| down_proj | 14336 → 4096 | 58.72M | 18,432 |
| **每层合计** | | **218.1M** | **81,920** |

- 32 层 × 218.1M = **6.98B**（所有线性层）；
- 嵌入加 LM head = 2 × 128,256 × 4096 = **1.05B**；
- 总计约 **8.03B**（RMSNorm 的参数可以忽略）。
- "输入 + 输出维度"一列，C2 算 LoRA 参数量时要用。

**D3 激活值**
1. **每层的激活值**（不重算时，16 位激活值，[Korthikanti](https://arxiv.org/abs/2205.05198)）：$s\,b\,h\,(34+5as/h)$ 字节。
   - 34 = 注意力块 11（QKV 的输入、Q 和 K、V、输出投影的输入、dropout 掩码）+ MLP 19（输入 2、GeLU 的输入 8、GeLU 的输出 8、dropout 掩码 1）+ 两个 LayerNorm 的输入 4；
   - $5as/h$ 一项来自 s×s 的注意力分数和 softmax。FlashAttention 不存它们，这一项消失（[补] FlashAttention）。
2. **8B，s = 4096，b = 1：**
   - $sbh=4096\times4096=16.78\text{M}$；
   - 每层 34 × 16.78M = 0.57 GB，32 层约 **18.3 GB**。
3. **Llama 结构的粗算（本课的估算，不是论文值）：**
   - 没有 dropout；GQA 使 K、V 只有 1/4 大小；SwiGLU 的中间维是 3.5h，要存 gate、up、SiLU(gate)、两者的乘积；
   - 合计约 41·sbh，比 34 高约两成。计算器默认用 34，在"高级"里可以切换。
4. **激活重算：**
   - 只存每层的输入，$2sbh\times L=2\times16.78\text{M}\times32\approx1.07$ GB；
   - 反向时一次只重算一层，峰值再加 0.57 GB，合计约 **1.6 GB**；
   - 计算量：前向 2N、反向 4N，共 6N FLOPs/token；重算多一次前向，变成 8N，即 **+33%**。
5. **LoRA 为什么还要存激活值：**
   - 冻结的线性层 $y=W_0x$，求 $\partial L/\partial x=W_0^\top\,\partial L/\partial y$ 时用不到 x。
   - 但每个线性层都挂着 LoRA：$\partial L/\partial A$ 要用到 x，$\partial L/\partial B$ 要用到 Ax。
   - 而且 SiLU、softmax、归一化层求导都要用到它们的输入。
   - 所以激活值基本照存。计算量方面，LoRA 省掉了冻结权重的梯度（2N），约为 4N，是全量的 2/3（[技] §3）。

**D4 logits**
1. 大小为 $b\cdot s\cdot V\cdot4$ 字节（损失按 fp32 计算）。8B、s = 4096：4096 × 128,256 × 4 = **2.10 GB**，梯度再加 2.10 GB；有的实现还会多存一份 bf16 副本。
2. s = 32k 时：各约 **16.8 GB**，比 QLoRA 的全部权重还大。
3. **分块或融合交叉熵：** 按 token 分块计算 $\log\mathrm{softmax}$ 和损失，不把整块 logits 放进显存（[Cut Cross-Entropy](https://arxiv.org/abs/2411.09009)；Liger、Unsloth 有类似的内核）。

**D5 三种方法的总账**（8B，s = 4096，b = 1，开激活重算，开销按 1 GB 计）

| 项 | 全量 | LoRA r=16 all-linear | QLoRA（NF4 + 双重量化） |
|---|---|---|---|
| 冻结权重 | — | 16.06（bf16） | 3.60（线性层，C3 推导）+ 2.10（嵌入和 head，bf16） |
| 可训练部分（权重 + 梯度 + Adam） | 128.5 | 0.67（41.9M × 16 字节，适配器用 fp32） | 0.67 |
| 激活值（检查点） | 1.6 | 1.6 | 1.6 |
| logits 与梯度（不融合 / 融合） | 4.2 / ≈0 | 4.2 / ≈0 | 4.2 / ≈0 |
| 开销 | 1 | 1 | 1 |
| **合计（不融合 / 融合）** | **≈135 / ≈131** | **≈23.6 / ≈19.4** | **≈13.2 / ≈9.0** |

- 关掉激活重算：每列再加约 16.7 GB，全量约 150 GB。这与 [技] 的 135–150 GB 一致。
- [技] 给出的 QLoRA 8–10 GB，对应的是融合交叉熵的情形。
- **batch 的影响（融合交叉熵）：** b = 16 时，激活值 ≈ 16 × 1.07 + 16 × 0.57 ≈ 26.3 GB。
  - LoRA ≈ 16.06 + 0.67 + 26.3 + 1 = **44.0 GB**；
  - QLoRA ≈ 3.60 + 2.10 + 0.67 + 26.3 + 1 = **33.7 GB**；
  - 节省比例从 b = 1 时的 1 − 9.0/19.4 ≈ **54%**，降到 1 − 33.7/44.0 ≈ **23%**。

**D6 多卡分片**（Ψ 为参数量，N 为卡数，[ZeRO](https://arxiv.org/abs/1910.02054)）
1. **每卡的静态显存：**
   - ZeRO-1：$2\Psi+2\Psi+12\Psi/N$；
   - ZeRO-2：$2\Psi+14\Psi/N$；
   - ZeRO-3 或 FSDP：$16\Psi/N$。
2. **8B 用 2 张 80 GB 卡做 ZeRO-3：** 每卡 64.2 GB，再加激活值和 logits 约 6 GB，约 70 GB，放得下但很紧；4 张卡就宽松了。
3. 激活值不会因为分片而变小（每张卡处理自己的 micro-batch）。

### 代码片段清单

| # | 展示什么 | 库 | 行数 |
|---|---|---|---|
| C1-c1 | 实测峰值显存：`reset_peak_memory_stats` → 跑一步训练 → `max_memory_allocated`，并和计算器的估算对照。 | PyTorch | ~12 |
| C1-c2 | 显存快照：`torch.cuda.memory._record_memory_history()` → 导出 → 用 PyTorch 的显存可视化页面查看（图 C1-2 就是这样得到的）。 | PyTorch | ~8 |
| C1-c3 | 三个开关：`gradient_checkpointing=True`、`optim="adamw_8bit"`、融合/分块交叉熵（TRL v1.15 的 SFTTrainer 默认已分块计算 log 概率；在普通 PyTorch / `Trainer` 里用 `use_liger_kernel=True`）。 | transformers / TRL | ~10 |
| C1-c4 | 估算函数：把推导 D1–D5 写成约 30 行的 Python，计算器就是它的界面版。 | Python | ~30 |

### 图片清单
- **图 C1-1：** "显存账本"堆叠条，三栏分别是全量、LoRA、QLoRA，数据取自推导 D5。manim 生成 SVG，配色和 I1 一致。
- **图 C1-2：** 一个训练步的显存时间线，标注为示意（本机没有 CUDA，不做实测）。
- **图 C1-3：** Transformer 一层里要存哪些激活值，按 Korthikanti 的分解（11 / 19 / 4）标注。依据 [2205.05198](https://arxiv.org/abs/2205.05198) 重绘。

### 检验题
1. **计算（number）：** 一个 3.2B 的模型，全量 AdamW 混合精度，权重、梯度和优化器状态合计多少 GB？
   - **答案：** **51.2 GB**，相对容差 5%。
   - **判分：**
     - 答 6.4（只算了 bf16 权重）→ 误区 `vram-model-size`；
     - 答 12.8（权重加梯度）→ 提示："优化器状态呢？"
2. **计算（number）：** 词表 151,936，序列 8,192，batch 1，fp32 的 logits 张量多大（GB）？
   - **答案：** 8192 × 151936 × 4 ≈ **4.98 GB**，容差 0.1。
   - **判分：** 说出"梯度再加一份"的，额外加分。
3. **预测（choice）：** 8B 的 QLoRA，序列 4096，把 micro-batch 从 1 调到 16。相对于 LoRA，QLoRA 省下的比例会怎样？
   - **答案：** 下降，从约一半降到约四分之一。原因：激活值随 b 增长，而量化只压缩了冻结权重。
   - **判分：** 答"不变"，解释框里给出推导 D5 的两组数字。
4. **解释（AI 判读）：** "LoRA 冻结了基座的权重，为什么仍然要存基座各层的激活值？"
   - **要点：** 反向传播要穿过冻结层才能到达前面各层的 LoRA；求 ∂L/∂A 要用到每层的输入 x；非线性和归一化层求导要用到它们的输入。
   - 能说出"只冻结、没挂 LoRA 的线性层可以不存输入"，加分。
   - 答"不需要存" → 误区 `lora-saves-activations`。

**概念测验候选：** "一个 7B 模型（bf16 约 14 GB），用 24 GB 显卡能做全量微调吗？"（不能：静态部分约 112 GB。）

### "怎么选"卡片（C1 加到决策图上的）
- **节点：** DM-X1（编号见 [part-f-choosing.md](part-f-choosing.md) 第 1 节）。用到本卡的检验题：Q3。
- **规则：** 先算账，再租卡。全量所需 ≈ 16 字节 × N 加激活值；不够就依次考虑 LoRA → QLoRA → 多卡分片或卸载。
- **规则：** 长上下文或大 batch 时，先开激活重算和融合交叉熵，再考虑量化。这时大头是激活值和 logits。
- **反例：** "序列 32k 显存不够，所以换 QLoRA"：省下的只是约 10 GB 权重，logits 和激活值仍有几十 GB。
- **反例：** "我的卡能装下模型推理，就能装下训练"：训练至少还要梯度、优化器状态和激活值。

### 中英术语
- 显存（VRAM / GPU memory）
- 混合精度（mixed precision）
- 主权重（master weights）
- 优化器状态（optimizer states）
- 一阶矩、二阶矩（first / second moment）
- 激活值（activations）
- 激活重算（activation recomputation / gradient checkpointing；口语也叫"梯度检查点"，正式文字用"激活重算"，避免和"模型检查点"混淆）
- 融合交叉熵（fused cross-entropy）
- 分片（sharding）
- 零冗余优化器（ZeRO）
- 全分片数据并行（FSDP）
- 卸载（offload）
- 随机舍入（stochastic rounding）

---

## C2 LoRA

- **时长：** 约 35 分钟（核心课）
- **前置：**
  - "特征值 → PCA"课（矩阵是运动；对称矩阵的垂直主轴；方差保留比例）；
  - C1。
- **技能 id：** `lora-formula`、`lora-params`、`lora-init`、`lora-rank-svd`、`lora-scaling`、`lora-config`、`lora-capacity`、`lora-merge`
- **误区 id：** `lora-smaller-model`、`rank-bigger-better`、`alpha-folklore`、`lora-attention-only`、`finetune-is-lowrank`、`lora-always-matches`、`lora-init-random`

### 学完能做到
1. **参数量：** 写出 $h=W_0x+\tfrac{\alpha}{r}BAx$，算出任意一层和整个模型的可训练参数量、占比，以及适配器文件的大小。
2. **初始化：** 用梯度说明为什么 B = 0、A 随机；两者都为 0 或都随机各会怎样。
3. **秩与奇异值：** 用奇异值谱说出"秩 r 最多能保留 ΔW 的多少"（Eckart–Young），并把它对应到 PCA 课的"方差保留比例"。
4. **起始配置：** 给出 all-linear、r、固定 α、学习率约为全量的 10 倍、小 batch；说出为什么学习率比秩重要，以及什么时候用 rsLoRA。
5. **什么时候够用：** 判断 LoRA 在什么情况下能追平全量（中小规模 SFT、RL），什么时候落后（大数据 SFT 或 CPT、大 batch）；解释"学得少、忘得也少"；说清合并后的模型和原模型一样大、一样快。

### 要解开的误解

| id | 误解 | 实际情况与证据 |
|---|---|---|
| `lora-smaller-model` | LoRA 得到的是一个更小、更快的模型 | 合并之后，大小和速度都和原模型一样；不合并时还会多一点延迟。LoRA 省的是训练时的梯度和优化器状态（[Fireworks](https://docs.fireworks.ai/guides/understanding_lora_performance)；[教] §3.5）。 |
| `rank-bigger-better` | 秩越大，学得越快、越好 | 在 1/r 缩放下，不同秩的早期学习曲线几乎重合，学习率才是主导（[LoRA Without Regret](https://thinkingmachines.ai/blog/lora/)）。秩决定的是容量上限，不是学习速度。 |
| `alpha-folklore` | α 必须等于 2r（或 r），有一个正确答案 | 各家建议互相矛盾：α = 2r、α = r 或 2r、α/√r（[教] §3.4）。在 Adam 下，α 和学习率在早期几乎是同一个旋钮（推导 D4）。 |
| `lora-attention-only` | 加在 q、v 上就够了（原论文就是这么做的） | 要追平全量，需要加在所有线性层（[QLoRA](https://arxiv.org/abs/2305.14314)）；MLP 层最重要；即使参数量相同，只加在注意力层也更差（[LoRA Without Regret](https://thinkingmachines.ai/blog/lora/)）。 |
| `finetune-is-lowrank` | 微调的改动本来就是低秩的，LoRA 只是把它找出来 | 内在维度低：随机投影后只训练 200 个参数，就能达到全量的 90%（[Aghajanyan](https://arxiv.org/abs/2012.13255)）。但全量微调实际学到的改动，秩比常见 LoRA 配置高 10–100 倍（[Biderman](https://arxiv.org/abs/2405.09673)）。所以低秩是**约束**，不是发现。 |
| `lora-always-matches` / 反面 | 两个相反的极端："LoRA 总能追平全量"，或者"LoRA 总是更差" | 要看情形：<br>• 中小规模 SFT，加在所有层、学习率约 10 倍、小 batch 时，LoRA 能追平，RL 甚至秩 1 就够（Thinking Machines）；<br>• 代码和数学的大规模 IFT 或 CPT 上明显落后，但遗忘更少（Biderman）；<br>• 两者并不矛盾，只是情形不同（[技] §4）。 |
| `lora-init-random` | A、B 都随机初始化才对称、才合理 | 都随机，训练一开始模型就被扰动了；都为 0，梯度永远是 0（推导 D3）。 |

### 段落脚本

| # | 类型 | 内容要点 | 为什么用这种形式 | 分钟 |
|---|---|---|---|---|
| 1 | read | **为什么 LoRA 是核心：** 托管服务默认用适配器，Tinker 只支持 LoRA，Hub 上 PEFT 模型有 27 万个（[用]）。<br>回顾"矩阵是平面的运动"：微调就是 $W_0\to W_0+\Delta W$。<br>公式卡片：$\Delta W=\tfrac{\alpha}{r}BA$，$B\in\mathbb R^{d\times r}$，$A\in\mathbb R^{r\times k}$。 | 先定位，再接上前置课。 | 2 |
| 2 | scene | **秩 1 的改动是什么样**：复用 `linear_map`，$A=I+uv^\top$，取 u = (0.5, 1)、v = (1, 0)，即 A = [[1.5, 0], [1, 1]]。网格只沿一个方向被推动，竖直方向的向量（垂直于 v）完全不动。 | 一段 10 秒的动画，几何直觉一眼就能看到。 | 1.5 |
| 3 | world | **亲手做一个秩 1 改动**（`rank_one_update`），见交互 I1。 | 拖 u、v 就是改 B 的一列、A 的一行，见 I1。 | 2.5 |
| 4 | derive | **参数量**（推导 D1）：<br>• 每层是 r(d+k) 对 dk；<br>• 8B、r = 16、all-linear：41.9M，占 0.52%；<br>• 适配器文件 84 MB（bf16）；<br>• 只加在注意力层时，要用 r ≈ 49 才能有同样的参数量。 | 有具体数字的推导，最后一步留成填空。 | 2.5 |
| 5 | checkpoint | **预测：** "官方全量后训练产生的一个 ΔW（Qwen2.5-0.5B → Instruct 的某一层），截到秩 16，能保留它多少能量？"（>99% / 约 90% / 约 50% / <30%）正确选项按离线数据填入。 | 为第 6 段的世界下注。 | 1 |
| 6 | world | **用秩 r 逼近一个真实的 ΔW**（`lowrank_update`），见交互 I2。 | 拖秩就是保留或截掉奇异值（README 第 4 节的原例）。 | 5 |
| 7 | derive | **Eckart–Young 与 PCA**（推导 D2）：<br>• 截断 SVD 是最好的秩 r 近似，误差² 等于被截掉的 $\sigma_i^2$ 之和；<br>• $\Delta W^\top\Delta W$ 是对称矩阵，它的特征值就是 $\sigma_i^2$；<br>• "能量保留比例"和 PCA 的"(9+4)/14"是同一个公式。<br>文中内嵌复用 `symmetric_ellipse`，取 S = [[1, 1], [1, 1]]：秩 1 把单位圆压成一条线段。 | 和前置课逐项对应，需要逐步写出。 | 2 |
| 8 | read | **低秩是约束，不是发现：**<br>• 支持低秩够用：Aghajanyan 的内在维度（200 个参数达到 90%）；<br>• 反面：Biderman 发现全量的 ΔW 秩高 10–100 倍；<br>• 结论：存在低秩的解，但不一定是全量会找到的那个解；任务所需的信息一多，约束就会卡住。 | 两方证据并列，用文字。 | 1.5 |
| 9 | derive | **为什么 B = 0**（推导 D3）：写出 $\partial L/\partial A$ 和 $\partial L/\partial B$ 在初始化时的值；比较三种初始化。 | 梯度一写出来就清楚了。 | 2 |
| 10 | read + details | **α/r 和 α/√r**（D4）：先讲三条已发表的结论——LoRA 原文用 α/r；rsLoRA 主张大秩时用 α/√r；LoRA Without Regret 观察到在 1/r 参数化下最优学习率几乎不随秩变、早期曲线重合。实践：固定 α，调学习率；r ≥ 64 时可试 rsLoRA。<br>我们自己的"为什么"放在一个折叠的"直觉解释"块里，明确标注为直觉解释，不是论文结论。 | 已发表的结论放正文；自己的推理放折叠块，避免把直觉当成定论（协调者决定）。 | 2.5 |
| 11 | figure + read | **配置怎么定**，配三张重绘图（来自 LoRA Without Regret）：<br>• (a) 不同秩下 loss 随学习率的变化：最优学习率对秩不敏感，约为全量的 10 倍；<br>• (b) 只加注意力 / 只加 MLP / 全部加的对比；<br>• (c) batch 大小的影响。<br>配置清单：<br>• `target_modules="all-linear"`；<br>• SFT 用 r = 16–64；<br>• 固定 α（如 16 或 32），调学习率；7–8B 模型用 1e-4–2e-4；<br>• 小 batch；<br>• r ≥ 64 时可以试 `use_rslora=True`；<br>• dropout 0–0.1（PEFT 默认 0）。<br>各种变体一行带过：DoRA 把大小和方向分开学（[2402.09353](https://arxiv.org/abs/2402.09353)）；PiSSA、OLoRA、EVA、LoftQ、CorDA 改的是初始化（[技] §4）。 | 实验结论用重绘的真实曲线，比任何示意交互都可信（README 第 4 节："容量水桶"已改为重绘曲线）。 | 2.5 |
| 12 | figure + read | **容量与信息量**（推导 D5，量级估算），配两张重绘图：<br>• (a) 数据集变大时，LoRA 与全量的差距（Thinking Machines）；<br>• (b) "学得少、忘得少"：目标领域表现对遗忘的散点图（Biderman）。<br>RL 每个回合只带约 1 比特信息，所以秩 1 也够用，为 E1 埋下伏笔。 | 两张真实曲线加一段算术。 | 2.5 |
| 13 | read | **合并，以及"LoRA 不是更小的模型"：**<br>• $W'=W_0+\tfrac{\alpha}{r}BA$ 的形状和 $W_0$ 一样，推理的显存和计算都不变；<br>• 不合并时每层多两次小矩阵乘，额外的计算很少，但会增加延迟；<br>• 训练计算量约为全量的 2/3（C1 推导 D3）；<br>• 多个适配器怎么上线，留到 C3。 | 纠正误区的要点清单。 | 1.5 |
| 14 | code | **从零写 `LoRALinear`**（PyTorch，标注张量形状），然后对照 PEFT：<br>• `LoraConfig`；<br>• `print_trainable_parameters()`；<br>• `merge_and_unload()`。 | 30 行代码就能把 D1、D3 落实。 | 2.5 |
| 15 | checkpoint ×4 | 检验题 Q1–Q4。 | | 2.5 |
| 16 | scene | **怎么选卡片：** `decision_map({ upto: 'C2', highlight: ['DM-X1', 'DM-B2'] })`，加上规则和反例。 | 同上。 | 1 |
| 17 | ask | 建议的提问："给我一个 7B 模型、5 万条客服数据的 LoRA 配置，并解释每个数。"导师按第 11 段的清单回答，可以调用 `lowrank_update` 和 `vram_calculator`。 | | — |

合计约 35 分钟。

### 交互规格

**I1 亲手做一个秩 1 改动**（零件 `rank_one_update`）
- **变量：**
  - u、v 两个向量，拖动箭头尖；
  - 底矩阵 $W_0$：预设 I，或 [[1.2, 0.3], [0.1, 0.9]]；
  - 一个探针向量 x，拖动。
- **画面：**
  - 淡色的 $W_0$ 网格，实色的 $W_0+uv^\top$ 网格；
  - 垂直于 v 的那条直线高亮，标签"这条线上的输入不受影响"；
  - 探针：$W_0x$，以及沿 u 方向的改动 $u(v\cdot x)$。
- **学生做什么：**
  - 先预测："ΔW = uvᵀ 时，哪些输入 x 的输出完全不变？"（平行于 u 的 / 垂直于 v 的 / 平行于 v 的 / 没有）
  - 再拖动 u、v，做出目标矩阵 [[1, 1], [0, 1]]（从 I 出发的剪切）。
- **应该注意到：**
  - 不管输入是什么，输出的改动都只沿 u 的方向；
  - 输入里只有沿 v 的分量起作用；
  - 秩 r 时，改动落在 B 的各列张成的空间里，输入先被 A 的各行投影。
- **结束时的问题：** "秩 1 的改动，输出只会沿哪个方向变？输入的哪一部分在起作用？推广到秩 r 呢？"
- **计算：** 精确计算。
- **三条准则：**
  - **关系：** 一整片输入被映射到同一个方向，还有一条"不动的线"。这种几何结构，读公式 $(uv^\top)x=u(v\cdot x)$ 很难想象出来。
  - **形式：** 拖 u 就是改 B 的一列，拖 v 就是改 A 的一行。
  - **以问题收尾：** 先预测，最后回答上面的问题。
- **世界：**
  - 目标 1：做出 [[1, 1], [0, 1]]，容差 0.1；
  - 目标 2：把 x 放到一个满足 ΔWx = 0 的位置；
  - `solve`：u = (1, 0)，v = (0, 1)，x = (1, 0)。
- **实现：** 用 `linalg/kit.ts` 的 `Plane`、`transformed_grid` 和动态箭头搭建。

**I2 用秩 r 逼近一个真实的 ΔW**（零件 `lowrank_update`）
- **变量：**
  - 秩 r：1–64，可拖动的数字；
  - 数据源（三选一）：
    - "官方全量后训练的 ΔW"（Qwen2.5-0.5B → Qwen2.5-0.5B-Instruct）；
    - "秩 16 截断"：同一个 ΔW 截到秩 16，这正是任何 r = 16 的 LoRA 改动的形状（不用训练出来的检查点）；
    - "随机矩阵"（示意）；
  - 层：q_proj（896×896）/ down_proj（4864 → 896）。
- **画面：**
  - 三张 64×64 的热力图（裁剪显示）：ΔW、秩 r 的重建、残差；
  - 奇异值谱，对数纵轴，在 r 处画一条截断线；
  - 读数：
    - 能量保留比例 $\sum_{i\le r}\sigma_i^2/\sum\sigma_i^2$；
    - 相对误差；
    - 参数量 r(d+k) 对 dk，按整个矩阵的尺寸算。
- **学生做什么：** 先完成第 5 段的预测，然后拖 r、切换数据源。
- **应该注意到：**
  - 全量后训练的 ΔW 谱在衰减，但尾巴很长，秩 16 只能保留其中一部分（具体值离线算出后填入）；
  - 秩 16 截断的 ΔW，在秩 16 处能量就到了 100%，之后的奇异值全是 0。LoRA 的改动也是这样，被**构造成**低秩的；
  - 随机矩阵的能量几乎随 r 线性增长，没有低秩结构可截。
- **结束时的问题：** "全量微调的 ΔW 并不低秩，为什么 LoRA 在很多任务上还能追平全量？什么时候追不上？"
  - 要点：完成任务不必复制全量的那个 ΔW，存在低秩的解（内在维度低）；但任务所需的信息超过适配器容量时就追不上（Biderman；容量见第 12 段）。
- **数据：** 真实数据，离线计算。
  - 数据源"官方全量后训练"在界面上标注为"official post-training (includes RL)"；
  - 对两个整矩阵做完整 SVD，存全部奇异值；
  - 再存前 64 个分量的 U、V 在显示区域的行（64 × 64 各一份），浏览器端只做 64 × 64 × r 的重建；
  - 随机矩阵用固定种子生成，标注为示意。
  - 注明：Qwen 的官方后训练包括 SFT 和 RL，不是单纯的一次 SFT。
- **三条准则：**
  - **关系：** 秩与误差的关系取决于谱的形状，学生看不到谱就无法判断；三种谱的对比是本课最关键的观察。
  - **形式：** 拖秩就是保留或截掉奇异值（README 原例）。
  - **以问题收尾：** 先预测，最后回答上面的问题。
- **世界：**
  - 目标 1：在"全量 ΔW"上找到保留 90% 能量的最小 r；如果 r > 64，目标改为"看到 r = 64 时还不到 90%"；
  - 目标 2：在"秩 16 截断"上找到误差为 0 的最小 r（= 16）；
  - 检测器：学生在随机矩阵上把 r 拖到 64 后说"低秩总是够用"，记误区 `finetune-is-lowrank`；
  - `solve`：数据源切到"秩 16 截断"，r = 16；目标 1 按离线数据算出的 r 设置。

### 推导全文

**D1 参数量**
1. 一层 $W\in\mathbb R^{d\times k}$（输出 d、输入 k）：全量有 dk 个参数，LoRA 有 $r\cdot d+r\cdot k=r(d+k)$ 个。占比 $=r(d+k)/(dk)=r(1/k+1/d)$。
2. d = k = 4096、r = 16 时：16 × 8192 / 16,777,216 = **0.78%**。
3. **8B、all-linear、r = 16：** 每层 r × 81,920 = 1,310,720（81,920 见 C1 推导 D2），× 32 = **41,943,040 ≈ 41.9M**，占 8.03B 的 **0.52%**。
4. 适配器文件（bf16）：41.9M × 2 字节 ≈ **84 MB**，基座是 16 GB。
5. **只加 q、k、v、o：** 每层的维度和是 26,624。要和 all-linear r = 16 的参数量相同，需要 r ≈ 16 × 81,920 / 26,624 ≈ **49**。即使这样，效果仍然更差（Thinking Machines）。
   - 填空：Qwen2.5-7B 的 down_proj（18944 → 3584），r = 32 时的 LoRA 参数量 = ？（32 × 22,528 = 720,896）

**D2 Eckart–Young 与 PCA**
1. 奇异值分解：$\Delta W=\sum_i\sigma_iu_iv_i^\top$，$\sigma_1\ge\sigma_2\ge\dots$
2. 对任意秩 ≤ r 的矩阵 M，$\lVert\Delta W-M\rVert_F^2\ge\sum_{i>r}\sigma_i^2$，取截断 SVD 时等号成立（Eckart–Young 定理）。
3. 所以 LoRA 用 BA 去拟合一个目标 ΔW 时，误差最低也就是这个数。I2 画的是 LoRA 的**最好情况**。LoRA 实际上不做 SVD，而是用梯度下降去学 BA。
4. **和 PCA 课的联系：**
   - $\Delta W^\top\Delta W=V\Sigma^2V^\top$ 是对称矩阵，所以它的特征向量（就是 $v_i$）互相垂直，特征值是 $\sigma_i^2$；
   - 能量保留比例 $\sum_{i\le r}\sigma_i^2/\sum_i\sigma_i^2$，和"前两个主成分保留 (9+4)/14 的方差"是同一个公式。
5. **几何：** ΔW 把单位圆变成一个椭圆，半轴长就是 $\sigma_i$；秩 1 时椭圆退化成一条线段（复用 `symmetric_ellipse` 的 [[1, 1], [1, 1]] 示例）。
   - 填空：ΔW 的奇异值为 3、2、1（即 $\Delta W^\top\Delta W$ 的特征值为 9、4、1）时，秩 2 保留多少能量？（(9+4)/14 ≈ 93%，和 PCA 课的那道题是同一个数）

**D3 为什么 B = 0、A 随机**
1. $h=W_0x+\gamma BAx$，记 $\delta=\partial L/\partial h$。
2. $\partial L/\partial B=\gamma\,\delta\,(Ax)^\top$，$\partial L/\partial A=\gamma\,B^\top\delta\,x^\top$。
3. **三种初始化：**
   - **B = 0、A 随机：** ΔW = 0，所以训练从基座出发；$\partial L/\partial A=0$，但 $\partial L/\partial B\neq0$，第一步先学 B，之后 A 也开始动。
   - **A = B = 0：** 两个梯度都是 0，永远停在原地（鞍点）。
   - **两者都随机：** 一开始 ΔW ≠ 0，模型在学到任何东西之前就已经被随机扰动了。
4. PEFT 的做法：A 用 Kaiming 均匀分布初始化，B 初始化为 0（[技] §4）。

**D4 缩放 γ：α/r 还是 α/√r**

正文只讲已发表的结论：LoRA 原文的缩放是 α/r（[2106.09685](https://arxiv.org/abs/2106.09685)）；rsLoRA 主张用 α/√r，大秩时才能继续学（[2312.03732](https://arxiv.org/abs/2312.03732)）；LoRA Without Regret 观察到 1/r 参数化下最优学习率几乎与秩无关。下面第 1–4 步放进折叠的"直觉解释"块（details），标题写明"直觉解释，不是论文结论"（简化：单个样本、训练初期、A 近似不动）：
1. 由 D3，$g_B=\gamma\,\delta\,(Ax)^\top$。
2. **SGD：** $B_t\approx-\eta t\,\gamma\,\delta(Ax)^\top$，所以 $\Delta W x=\gamma B_tAx=-\eta t\,\gamma^2\lVert Ax\rVert^2\delta$。
   - A 的 r 行彼此独立，所以 $\lVert Ax\rVert^2\propto r$，改动 ∝ $\gamma^2 r$；
   - 要让它不随 r 变，需要 $\gamma\propto1/\sqrt r$，这就是 rsLoRA 的缩放（[2312.03732](https://arxiv.org/abs/2312.03732)）。
3. **Adam**（早期近似为符号更新）：$B_t\approx-\eta t\,\mathrm{sign}(\delta)\,\mathrm{sign}(Ax)^\top$，与 γ 无关。
   - 于是 $\Delta Wx=-\eta t\,\gamma\,\mathrm{sign}(\delta)\sum_j|(Ax)_j|$，改动 ∝ $\gamma r$；
   - 要让它不随 r 变，需要 $\gamma\propto1/r$，这就是标准的 α/r。
   - 这和 Thinking Machines 的观察一致：1/r 缩放下，不同秩的早期曲线重合，最优学习率对秩不敏感。
4. **推论：**
   - Adam 下 γ 和 η 以乘积的形式出现，所以 α 和学习率在早期几乎是同一个旋钮；
   - "α = 2r"只是把学习率乘了个常数；
   - 实践：固定 α，只调学习率。
5. **提示框（诚实标注）：**
   - 这是一个简化推导；
   - rsLoRA 的实验表明，大秩时 α/r 会让学习变慢，所以 r ≥ 64 时值得试 `use_rslora`；
   - 两种说法的前提不同，"哪个对"取决于秩和训练阶段，这是开放问题。

**D5 容量与信息量**（量级估算）
1. 容量（**量级假设**）：Thinking Machines 引用 Allen-Zhu & Li（Physics of LMs 3.3）"每个参数约 2 比特"的结论，那是一般神经网络、合成数据、长训练极限下的结果，不是对 LoRA 的测量。
   - 8B、r = 16、all-linear：41.9M 个参数，约 84M 比特；
   - r = 1：2.62M 个参数，约 5.2M 比特。
2. **RL：** 二值奖励每个回合最多带 1 比特。10 万个回合 ≤ 10⁵ 比特，比秩 1 的容量还小 50 倍，所以秩 1 就够（Thinking Machines）。
3. **SFT：** 10 万条样本 × 500 个回答 token = 5 × 10⁷ 个 token。
   - 假设每个 token 只带 0.1 比特"新信息"（这是假设，用来估量级），总共约 5 × 10⁶ 比特：大约等于秩 1 的容量，是秩 16 容量的 6%；
   - 到了百万条样本，或者数十亿 token 的 CPT，就会超过秩 16 的容量。
   - 这和 Biderman 在 200 亿 token 的 CPT 上看到 LoRA 明显落后是一致的。
4. 结论：信息量和容量之比决定 LoRA 是否"被卡住"，所以 SFT 和 RL 对秩的需求完全不同。

### 代码片段清单

| # | 展示什么 | 库 | 行数 |
|---|---|---|---|
| C2-c1 | 从零写 `LoRALinear`：冻结 base；`A = kaiming_uniform_(empty(r, k))`；`B = zeros(d, r)`；`forward`：`base(x) + scale * (drop(x) @ A.T @ B.T)`，标注形状 `(b, s, k) → (b, s, r) → (b, s, d)`；`merge()`：`W += scale * B @ A`。 | PyTorch | ~30 |
| C2-c2 | 把 `LoRALinear` 替换进一个小模型的所有 `nn.Linear`，打印可训练参数量，和推导 D1 对照。 | PyTorch | ~15 |
| C2-c3 | PEFT：`LoraConfig(r=16, lora_alpha=32, lora_dropout=0.0, target_modules="all-linear", use_rslora=False, task_type="CAUSAL_LM")` → `get_peft_model` → `print_trainable_parameters()` → 训练后 `merge_and_unload()` 并保存。 | PEFT | ~15 |
| C2-c4 | 离线数据脚本：取 Qwen2.5-0.5B 和 Instruct 的同一层，求 ΔW 并做 SVD，导出 `lowrank_update` 要用的 JSON。这个脚本放在课程资源里，不展示给学生。 | PyTorch | ~25 |

### 图片清单
- **图 C2-1：** $\Delta W=B\cdot A$ 的形状示意，d×r 乘 r×k，标出参数量。manim 生成 SVG。
- **图 C2-2：** 不同秩下 loss 随学习率的变化，以及全量的最优学习率位置。
  - 重绘自 [LoRA Without Regret](https://thinkingmachines.ai/blog/lora/)，需从原图取数。
- **图 C2-3：** 只加注意力 / 只加 MLP / 全部加的对比，同一出处，重绘。
- **图 C2-4：** 数据集变大时 LoRA 与全量的差距（容量受限），同一出处，重绘。
- **图 C2-5：** "学得少、忘得少"：目标领域表现对遗忘，不同秩的 LoRA 和全量。重绘自 [Biderman](https://arxiv.org/abs/2405.09673)。
- **图 C2-6：** LoRA 合并与不合并时的推理路径对照，标出"形状不变"和"多两次小矩阵乘"。自绘。

### 检验题
1. **计算（number）：** 一层 d = k = 4096，r = 16，LoRA 参数占这一层的百分之几？
   - **答案：** **0.78%**，接受 0.0078。
   - **判分：** 答 0.39%（只算了 A 或只算了 B）→ 提示"B 和 A 都要算"。
2. **预测（choice）：** 用 α/r 缩放、学习率不变，只把秩从 8 调到 64。前 100 步的 loss 曲线会怎样？
   - **答案：** 几乎重合。
   - **干扰项：**
     - "r = 64 下降快 8 倍" → 误区 `rank-bigger-better`；
     - "r = 64 更慢"；
     - "r = 64 会发散"。
   - **解释框：** 引用推导 D4 和 Thinking Machines 的曲线。
3. **诊断（choice，选两项）：** "用 LoRA r = 16 在 200 万条代码数据上做 SFT，比全量差很多。"最可能的原因？
   - **答案：** (a) 数据的信息量超过了适配器容量；(c) 只挂了注意力层。
   - **干扰项：** (b) B 初始化为 0；(d) 合并时丢了精度。
   - **判分：** 两项都对得满分，只选对 (a) 得一半分。
4. **解释（AI 判读）：** "LoRA 训练得到的模型合并后，比原模型小吗？推理更快吗？那它省了什么？"
   - **要点：** 不小，也不更快（合并后形状相同；不合并反而多一点延迟）；省的是训练时冻结权重的梯度和优化器状态，激活值没省（C1）。
   - 答"更小"或"更快" → 误区 `lora-smaller-model`。

**概念测验候选：**
- "LoRA 的秩越大，模型学得越快吗？"（不是。）
- "全量微调学到的权重改动本来就是低秩的吗？"（不是；低秩是约束。）

### "怎么选"卡片（C2 加到决策图上的）
- **节点：** DM-X1、DM-B2。用到本卡的检验题：Q3。
- **规则：** 中小规模的 SFT（几千到十几万条）和各种 RL → 默认用 LoRA：all-linear，学习率约为全量的 10 倍，小 batch，r 取 16–64（RL 可以更小）。
- **规则：** 数据量大（百万条，或数十亿 token 的 CPT），而且要目标领域的最高表现 → 全量或很大的秩；代价是更多遗忘，以及 C1 里算出来的显存。
- **规则：** 在意"别把原有能力弄坏"、要服务多个客户、显存紧 → LoRA 本身就是一种正则（学得少、忘得少）。
- **反例：** "为了让推理更小更快而用 LoRA"不成立：合并后一样大，要省推理显存看 C3 的量化。
- **反例：** "把只挂注意力层的秩开大，就能补上 MLP"不成立：参数量相同也更差。

### 中英术语
- 低秩适配（Low-Rank Adaptation, LoRA）
- 参数高效微调（parameter-efficient fine-tuning, PEFT）
- 适配器（adapter）
- 秩（rank）
- 奇异值分解（singular value decomposition, SVD）
- 奇异值谱（singular value spectrum）
- 截断 SVD（truncated SVD）
- Eckart–Young 定理（Eckart–Young theorem）
- 内在维度（intrinsic dimension）
- 缩放系数（scaling factor, α/r）
- 秩稳定缩放（rank-stabilized LoRA, rsLoRA）
- 目标模块（target modules）
- 合并（merge）
- 容量（capacity）
- 权重分解低秩适配（DoRA）

---

## C3 QLoRA 与上线

- **时长：** 约 31.5 分钟
- **前置：** C1、C2。
- **技能 id：** `quant-basics`、`nf4`、`blockwise-scaling`、`double-quant`、`qlora-train`、`adapter-deploy`、`qat-vs-ptq`
- **误区 id：** `nf4-uniform`、`outlier-local`、`qlora-trains-4bit`、`qlora-faster`、`qlora-merge-exact`、`qlora-for-inference`、`lora-serving-free`

### 学完能做到
1. **手算量化：** 用 absmax 方法量化、反量化一小块数，并说出误差上限是半个格距。
2. **NF4：** 解释 NF4 的格点为什么放在正态分布的分位点上，以及为什么要单独留出一个精确的 0；说出它比均匀 4 位好在哪里。
3. **按块缩放：** 解释按块缩放如何把异常值的伤害限制在一块之内；算出块大小与开销 32/B 比特之间的取舍，以及双重量化的 0.5 → 0.127 比特（65B 上约省 3 GB）。
4. **QLoRA 训练：** 说出 QLoRA 训练时哪些部分是 4 位、哪些在 bf16 下计算；为什么它更省显存但更慢；分页优化器是做什么的。
5. **上线：** 为一个场景在几种上线方式之间选择——合并到 bf16、保留 4 位基座加适配器、多适配器服务，或者合并后再做推理量化；并说出 QLoRA 适配器合并时的陷阱，以及 QLoRA、PTQ、QAT 三者的区别。

### 要解开的误解

| id | 误解 | 实际情况与证据 |
|---|---|---|
| `nf4-uniform` | 4 位就是 16 个等距的格点 | NF4 把格点放在正态分布的分位点上（按"每格概率质量相等"设计，前提是输入恰好服从 N(0,1)；经过按块 absmax 归一化后并不严格相等，见 Yoshida 2023）；并且专门留出一个精确的 0（[QLoRA](https://arxiv.org/abs/2305.14314)；推导 D1）。 |
| `outlier-local` | 一个异常值只影响它自己 | absmax 缩放时，异常值决定了整块的格距：同一块里的其他权重会挤到 0 附近的少数几个格点上（I1）。按块缩放把影响限制在 64 个权重之内。 |
| `qlora-trains-4bit` | QLoRA 是在 4 位精度上训练，更新的是 4 位权重 | 4 位只是**存储**格式：基座冻结，前向和反向时临时反量化成 bf16 再计算；梯度只流向 bf16 或 fp32 的适配器（[QLoRA](https://arxiv.org/abs/2305.14314)）。 |
| `qlora-faster` | 量化之后训练更快 | 每一层都要反量化，所以每一步通常比 bf16 的 LoRA 慢；QLoRA 换来的是显存。 |
| `qlora-merge-exact` | QLoRA 适配器合并回 bf16 原模型是无损的 | 适配器是针对反量化后的权重学出来的，合并到原始 bf16 权重会有一点偏差，合并后要重新评测（[技] §4，标注为实践者提醒，[uncertain]）。 |
| `qlora-for-inference` | 用 QLoRA 训练，上线的模型就是 4 位的、省显存 | 合并到 bf16 后，就是 bf16 的大小。推理要省显存，需要另外做训练后量化（PTQ）或量化感知训练（QAT）。 |
| `lora-serving-free` | 每个客户一个 LoRA，就要部署一份完整的模型 | 多个适配器可以共享一个基座，一次部署就能服务许多适配器（例如 Fireworks 在一个部署上跑 100 个，[用]）；不合并会有一点延迟（[Fireworks](https://docs.fireworks.ai/guides/understanding_lora_performance)）。 |

### 段落脚本

| # | 类型 | 内容要点 | 为什么用这种形式 | 分钟 |
|---|---|---|---|---|
| 1 | read + derive | **量化 = 格点 + 缩放。**<br>对称 absmax 整数量化：$s=\max\lvert x\rvert/(2^{k-1}-1)$，$q=\mathrm{round}(x/s)$，$\hat x=s\,q$。<br>手算 8 个数的 int4 量化，误差 ≤ s/2，例子见推导 D0。 | 先用一个小例子建立格点和缩放的概念，再进入交互。 | 2.5 |
| 2 | checkpoint | **预测：** "一块 64 个权重：63 个服从 N(0, 0.02²)，另有 1 个 0.5。用 int4 absmax 量化，那 63 个正常权重会落在几个不同的格点上？"（约 14 个 / 约 8 个 / 约 3 个 / 1 个） | 为第 3 段的世界下注；这个结果最反直觉。 | 1 |
| 3 | world | **格点放在哪**（`quant_levels`），见交互 I1。 | 格式、块大小、异常值与误差的关系要亲手调，见 I1。 | 6 |
| 4 | derive | **NF4 是怎么构造的**（推导 D1）：<br>• 分位点量化：每个格的概率质量相等；<br>• 正半边 8 个格点、负半边 7 个、再加一个精确的 0；<br>• 偏移 0.9677 的来历；<br>• 归一化到 [−1, 1]；<br>• 列出 16 个值；<br>• "最优"为什么只是近似。 | 每一步都有理由，适合推导页。 | 3 |
| 5 | derive | **开销与双重量化**（推导 D2）：<br>• 每块一个 fp32 缩放系数，开销 32/B 比特；B = 64 时为 0.5；<br>• 双重量化：8/64 + 32/(64·256) = 0.127；<br>• 65B 上省 3.03 GB；<br>• 8B 线性层 3.60 GB（C1 的总账就用这个数）。 | 纯算术推导，最后一步留成填空。 | 3 |
| 6 | read + figure | **QLoRA 训练时发生了什么：**<br>• NF4 存储，bf16 计算，前向和反向都临时反量化；<br>• 适配器在 bf16 或 fp32；<br>• 分页优化器：用统一内存，显存出现尖峰时把优化器状态换出到 CPU；<br>• 要加在所有线性层才能追平 16 位训练；<br>• 一张 48 GB 的卡能训 65B（[技] §4）；<br>• 速度比 bf16 LoRA 慢。<br>图：重绘 QLoRA 论文图 1 的数据流。 | 数据流用一张图最清楚。 | 2.5 |
| 7 | code | (a) `BitsAndBytesConfig(load_in_4bit=True, bnb_4bit_quant_type="nf4", bnb_4bit_use_double_quant=True, bnb_4bit_compute_dtype=torch.bfloat16)` → `prepare_model_for_kbit_training` → `LoraConfig(target_modules="all-linear")` → `SFTConfig(optim="paged_adamw_8bit")`。<br>(b) 从零写：按块 absmax 量化、反量化，加 NF4 查表（PyTorch），用来验证 I1 的数字。 | 两种写法切换：一种是库的用法，一种是从零写来理解原理。 | 3 |
| 8 | read | **合并 QLoRA 适配器的四种做法**（见下表），以及 LoftQ：初始化时就让 Q + AB ≈ W，减小训练时的偏差（[技] §4 提到 PEFT 提供 LoftQ）。<br>规则：评测的必须是你**真正上线的那个文件**（回扣 B3 评测第④层）。 | 选项对比，用表格。 | 2.5 |
| 9 | read + figure | **上线：合并还是多适配器。**<br>• 算术：100 个客户，各合并一份要 100 × 16 GB = 1.6 TB；共享基座只要 16 GB + 100 × 84 MB ≈ 24.4 GB；<br>• vLLM：`--enable-lora --max-loras --max-lora-rank`，请求里带上 `LoRARequest`；<br>• 不同适配器的请求可以放在同一个 batch 里（[补] S-LoRA、Punica）；<br>• Fireworks 一个部署跑 100 个适配器（[用]）；<br>• 怎么选：单一产品、高 QPS → 合并；多租户 → 多适配器服务；所有适配器必须基于同一个基座（以及同样的量化）。<br>图：两种部署的对照图。 | 决策加算术，不需要交互。 | 3 |
| 10 | read | **QAT 简述：** 用一张三行表区分 QLoRA、PTQ（GPTQ、AWQ 等）和 QAT。<br>QAT 在前向时用"伪量化"的权重 $\hat w=s\cdot\mathrm{round}(w/s)$，反向时用直通估计（$\partial\hat w/\partial w\approx1$），让权重学会耐受量化。<br>例子：Gemma 3 发布了 int4 的 QAT 模型，让它能在消费级显卡上运行，质量损失比 PTQ 小；Kimi K2 Thinking 在后训练里用了 INT4 QAT（[用]）。 | 按要求只简短介绍，一张表就够。 | 1.5 |
| 11 | checkpoint ×4 | 检验题 Q1–Q4。 | | 2.5 |
| 12 | scene | **怎么选卡片：** `decision_map({ upto: 'C3', highlight: ['DM-E2', 'DM-E3', 'DM-X1'] })`，加上规则和反例。 | 同上。 | 1 |
| 13 | ask | 建议的提问："我要给 50 个客户各做一个定制风格，用什么方式上线？成本怎么算？" | | — |

合计约 31.5 分钟。

**第 8 段的表：合并 QLoRA 适配器**

| 做法 | 得到什么 | 问题 |
|---|---|---|
| A. 合并到原始 bf16 权重 | bf16 模型 | 适配器是对着 dequant(W) 学的，和原始 W 有偏差，要重评（实践者提醒，偏差大小没有可靠的公开测量） |
| B. 先把 NF4 反量化成 bf16，再合并 | bf16 模型，和训练时的函数完全一致 | 带着量化误差；体积回到 bf16 |
| C. 不合并：4 位基座 + 适配器 | 和训练时完全一致，显存最小 | 推理要用 bitsandbytes 内核，较慢；多一条适配器路径 |
| D. 合并后再做推理量化（GPTQ、AWQ 等 PTQ） | 小而快的推理模型 | 又多了一次量化误差，必须重评 |

### 交互规格

**I1 格点放在哪**（零件 `quant_levels`）
- **变量：**
  - 格式：int4 均匀（absmax，−7…7）/ NF4 / int8 均匀（作对照）；
  - 块大小：32 / 64 / 256 / 1024 / 整个张量（4096）；
  - 异常值：拖动它的大小，0 到 25σ，它放在第 1 块里；
  - 数据：固定种子的 N(0, 0.02²)，共 4096 个；或者"真实权重"（Qwen2.5-0.5B 某一层的一行，离线导出）。
- **画面：**
  - 含异常值那一块的直方图，叠上 16 条格点线（按这一块的 absmax 缩放）；
  - 每个格点分到多少个权重的小柱（带数字）；
  - 读数：
    - 全张量的均方误差（不含异常值本身）；
    - 这一块用到了几个格点；
    - 被量化成 0 的比例；
    - 缩放系数的开销（比特/参数，含双重量化选项）。
- **学生做什么：**
  - 先完成第 2 段的预测；
  - 把异常值拖到约 25σ（即 0.5）；
  - 依次切块大小：整个张量 → 64；
  - 最后在没有异常值时比较 int4 和 NF4。
- **应该注意到：**
  - 异常值为 0.5 时，int4 的格距 s = 0.5/7 ≈ 0.071；|w| < 0.036（约 1.8σ）的权重全变成 0，约 93% 被量化成 0，整块只用到约 3 个格点；
  - 缩放按整个张量时，所有 4096 个权重都这样；按 64 一块时，只有这一块受害，全张量的均方误差比整张量缩放时小几十倍（按估算，只比没有异常值时高约一倍）；
  - 没有异常值时，同样是 4 位，NF4 的格点在 0 附近更密，均方误差更低，各格的使用也更均匀；
  - 块越小开销越大（32/B），双重量化把这个开销压下来。
- **结束时的问题：** "块越小越好吗？代价是什么？QLoRA 为什么选 64，再加上双重量化？"
- **计算：** 精确计算（对固定的数据做真实的量化和反量化）。
- **三条准则：**
  - **关系：** 格式、块大小、异常值三者与误差、格点使用之间的关系不直观，尤其是"一个异常值把整块压成 3 个格点"。
  - **形式：** 拖动异常值就是那个异常权重本身，切块大小就是缩放的粒度。
  - **以问题收尾：** 先预测，最后回答上面的问题。
- **世界：**
  - 目标 1：异常值 ≥ 20σ 时，把全张量的均方误差降到"整张量缩放"时的 1/10 以下。按估算，块大小 ≤ 256 才做得到；阈值实现时按精确计算核定。
  - 目标 2：在块大小 64、没有异常值时，找到均方误差更低的 4 位格式（NF4）；
  - 检测器：学生说"异常值只影响自己"之后看到整块被压成 0，记误区 `outlier-local`；
  - `solve`：块大小 64，格式切到 NF4。

### 推导全文

**D0 手算 absmax int4（第 1 段）**
1. x = [0.12, −0.05, 0.31, −0.27, 0.02, 0.44, −0.18, 0.07]，absmax = 0.44，s = 0.44/7 ≈ 0.0629。
2. q = round(x/s) = [2, −1, 5, −4, 0, 7, −3, 1]。
3. $\hat x$ ≈ [0.126, −0.063, 0.314, −0.251, 0, 0.44, −0.189, 0.063]。
4. 最大误差 0.02（出现在 0.02 → 0 这一项），不超过 s/2 ≈ 0.031。

**D1 NF4 的构造**（[QLoRA](https://arxiv.org/abs/2305.14314)；数值和 bitsandbytes 源码 `create_normal_map` 一致，写页面时核对）
1. **分位点量化：** 让每个格分到相同的概率质量。对 N(0,1)，第 i 个格点取在相应的分位点 $\Phi^{-1}(\cdot)$ 上。
2. **为什么要有精确的 0：** pad、被剪掉的权重等都是真正的 0，必须能精确表示。所以两边不对称：
   - 正半边 8 个格点：概率取 linspace(0.9677, 0.5, 9) 去掉最后一个；
   - 负半边 7 个格点：概率取 linspace(0.9677, 0.5, 8) 去掉最后一个，取负；
   - 再加上 0，共 16 个。
3. **偏移 0.9677：** $\Phi^{-1}(1)=\infty$，所以最外侧的格点不能取在 1。bitsandbytes 称这个偏移是经验选取的；它在数值上恰好等于 $1-\tfrac12(\tfrac1{32}+\tfrac1{30})$，但这个推导是第三方的重构，不要当作官方来历。$\Phi^{-1}(0.9677)\approx1.848$。
4. **除以 1.848 归一化到 [−1, 1]，得到 16 个值：**
   - 负半边：−1、−0.6962、−0.5251、−0.3949、−0.2844、−0.1848、−0.0911；
   - 0；
   - 正半边：0.0796、0.1609、0.2461、0.3379、0.4407、0.5626、0.7230、1。
5. **使用时：** 每块除以自己的 absmax 映射到 [−1, 1]，再取最近的格点，存 4 位索引。
6. **"最优"为什么只是近似：** absmax 归一化后，块内数值的分布取决于块里最大的那个数（它是随机的，而且随块大小变化），并不严格等于这些分位点所假设的分布。所以 QLoRA 所说的"对正态权重信息论最优"是近似成立的（[补] Yoshida 2023 有更细的讨论，待核实）。

**D2 开销与双重量化**
1. 每块 B 个权重共用一个 fp32 缩放系数，开销为 32/B 比特/参数：
   - B = 32：1.0；
   - B = 64：**0.5**；
   - B = 256：0.125；
   - 整张量：可以忽略，但异常值的伤害会扩散到整个张量。
2. **双重量化：** 把第一层的缩放系数（先减去均值，变成以 0 为中心）再量化成 8 位浮点，每 256 个共用一个 fp32 的二级系数：
   - 开销 = 8/64 + 32/(64·256) = 0.125 + 0.00195 ≈ **0.127** 比特/参数。
3. **65B 上省下：** (0.5 − 0.127) × 65 × 10⁹ / 8 ≈ **3.03 GB**（[技] §4：约 3 GB）。
4. **8B 的线性层：** 6.98B × (4 + 0.127)/8 ≈ **3.60 GB**，bf16 时是 13.96 GB；嵌入和 head 保持 bf16，2.10 GB。
   - 填空：块大小 128 加双重量化，开销 = ？（8/128 + 32/(128·256) ≈ 0.0635 比特）

### 代码片段清单

| # | 展示什么 | 库 | 行数 |
|---|---|---|---|
| C3-c1 | QLoRA 全流程：`BitsAndBytesConfig`（nf4、双重量化、bf16 计算）→ `AutoModelForCausalLM.from_pretrained(..., quantization_config=...)` → `prepare_model_for_kbit_training` → `LoraConfig(target_modules="all-linear")` → `SFTConfig(optim="paged_adamw_8bit", gradient_checkpointing=True)`。 | transformers + bitsandbytes + PEFT + TRL | ~25 |
| C3-c2 | 从零写：`quantize_blockwise(x, B=64, levels=NF4)` 和 `dequantize`；对 N(0, 0.02²) 加一个异常值，比较 B = 64 与整张量的均方误差，复现 I1 的数字。 | PyTorch | ~25 |
| C3-c3 | 四种合并做法中的 B 和 C：反量化后合并、保存，以及 4 位基座加适配器直接推理；两者都跑同一份评测。 | PEFT | ~20 |
| C3-c4 | vLLM 多适配器服务：`LLM(model=base, enable_lora=True, max_loras=8, max_lora_rank=16)`，`generate(..., lora_request=LoRARequest("cust_a", 1, path))`；参数名以 vLLM 文档为准。 | vLLM | ~15 |
| C3-c5（选读） | QAT 的伪量化前向加直通估计，约 10 行：`w_q = w + (quant(w) - w).detach()`。 | PyTorch | ~10 |

### 图片清单
- **图 C3-1：** 均匀 4 位与 NF4 的格点位置，画在 N(0,1) 密度曲线上，标出每格的概率质量。用推导 D1 的数值精确绘制。
- **图 C3-2：** QLoRA 的数据流：NF4 权重 → 反量化 → bf16 矩阵乘，加上 LoRA 支路，以及分页优化器在 CPU 和 GPU 之间换页。重绘自 [QLoRA](https://arxiv.org/abs/2305.14314) 图 1。
- **图 C3-3：** 上线方式对照：每个客户一个合并后的模型，对比共享基座加多个适配器；标注第 9 段的显存算术。自绘。
- **图 C3-4：** QLoRA、PTQ、QAT 三种"量化 + 训练"所处的阶段，画在一条时间线上（训练前、训练中、训练后）。自绘。

### 检验题
1. **计算（number）：** 块大小 128、使用双重量化（8 位一级系数，每 256 个共用一个 fp32 二级系数），缩放系数的开销是多少比特/参数？
   - **答案：** **0.0635**，容差 0.001。
   - **判分：** 答 0.25 → 提示"那是不做双重量化的情形"。
2. **计算（number）：** 一个 14B 的模型，线性层约 13.2B 参数，用 NF4 加双重量化存储，线性层占多少 GB？
   - **答案：** 13.2 × 4.127/8 ≈ **6.81 GB**，相对容差 3%。
   - **判分：** 答 6.6（漏了开销）→ 给一半分。
3. **诊断（choice）：** "QLoRA 训练完，评测正常；把适配器合并到原始 bf16 模型上线后，分数略有下降。"最可能的原因和最稳妥的做法是？
   - **答案：** 适配器是对着反量化后的权重学的，和原始权重有偏差；稳妥的做法是评测并上线同一个文件，例如用做法 B 或 C，或者合并后重新评测再决定。
   - **干扰项：** "LoRA 的秩太小"；"合并会丢掉适配器的一半参数"。
4. **选择（解释，AI 判读）：** 两个场景各选一种上线方式并说出理由：
   - (a) 一个 SaaS 平台，200 个客户各有自己的风格适配器；
   - (b) 一个高并发的单一产品，只有一个适配器。
   - **要点：**
     - (a) 共享基座加多适配器服务：显存近似为基座加 200 个适配器，而不是 200 份模型；
     - (b) 合并，省掉适配器路径的延迟；如果还要省推理显存，就再做 PTQ 或 QAT，然后重新评测。
   - 说"用 QLoRA 让推理更省" → 误区 `qlora-for-inference`。

**概念测验候选：**
- "QLoRA 是在 4 位精度上更新权重吗？"（不是。）
- "同样是 4 位，所有格式的误差都一样吗？"（不一样。）

### "怎么选"卡片（C3 加到决策图上的）
- **节点：** DM-E2、DM-E3、DM-X1。用到本卡的检验题：Q4。
- **规则：** 训练显存不够 → LoRA；还不够 → QLoRA（用速度和一点精度换显存）；仍然不够 → 多卡分片或卸载（C1）。
- **规则：** 多租户、多任务 → 共享基座加多适配器服务；单一产品、高并发 → 合并。合并 QLoRA 适配器后一定要重新评测。
- **规则：** 推理要省显存 → PTQ（GPTQ、AWQ 等）；对质量要求高、而且能改训练流程 → QAT。
- **反例：** "用 QLoRA 训练，所以上线的模型也是 4 位、很省"：合并到 bf16 后就是 bf16 的大小。
- **反例：** "200 个客户就部署 200 份模型"：适配器只有几十 MB，可以共享基座。

### 中英术语
- 量化（quantization）
- 格点（quantization level）
- 缩放系数（scale）
- 绝对值最大缩放（absmax scaling）
- 4 位正态浮点（4-bit NormalFloat, NF4）
- 分位点量化（quantile quantization）
- 按块量化（blockwise quantization）
- 异常值（outlier）
- 双重量化（double quantization）
- 分页优化器（paged optimizer）
- 统一内存（unified memory）
- 存储精度、计算精度（storage dtype / compute dtype）
- 反量化（dequantization）
- 训练后量化（post-training quantization, PTQ）
- 量化感知训练（quantization-aware training, QAT）
- 直通估计（straight-through estimator, STE）
- 多适配器服务（multi-LoRA serving）

---

## C 部分新零件清单

| 名称 | 用在 | 用途 | 参数（类型、范围、默认值） | 数据 |
|---|---|---|---|---|
| `vram_calculator` | C1 I1；C2、C3 的提问页；AI 导师回答"我的卡够不够" | 按估算公式画出显存的堆叠柱和容量线 | `model`：预设 id（`llama3.2-1b`、`llama3.2-3b`、`llama3.1-8b`、`qwen2.5-7b`、`qwen2.5-14b`、`qwen2.5-32b`、`llama3.1-70b`）或自定义 {L, h, ffn, heads, kv_heads, V, tied}；`method`：`full` / `lora` / `qlora`，默认 `full`；`optim`：`adamw` / `adamw8bit` / `bf16`；`rank`：1–256，默认 16；`targets`：`all-linear` / `attn`；`seq`：512–32768，默认 4096；`batch`：1–32，默认 1；`ckpt`：bool，默认 true；`fused_ce`：bool，默认 false；`gpus`：1–8，默认 1；`zero3`：bool；`act_const`：34 或 41，默认 34 | 估算公式的精确计算（标注为估算） |
| `rank_one_update` | C2 I1 | $W_0+uv^\top$ 的网格运动、不动的直线、探针的改动 | `W0`：2×2 矩阵，默认单位阵；`u`：向量，默认 (0.5, 1)；`v`：向量，默认 (1, 0)；`x`：探针向量，默认 (1, 1)；`show_null_line`：bool，默认 true | 精确计算；基于 `linalg/kit.ts` |
| `lowrank_update` | C2 I2；AI 导师讲"秩 r 能保留多少" | 秩 r 的重建、残差、奇异值谱、能量比例、参数量 | `source`：`full_ft` / `rank16` / `random`；`layer`：`q_proj` / `down_proj`；`r`：1–64，默认 4；`log_spectrum`：bool，默认 true | 真实数据（离线 SVD）；随机矩阵为示意 |
| `quant_levels` | C3 I1 | 格点位置、各格的使用量、按块缩放、异常值、开销 | `format`：`int4` / `nf4` / `int8`，默认 `int4`；`block`：32 / 64 / 256 / 1024 / 0（0 = 整张量），默认 0；`outlier_sigma`：0–25，默认 0；`data`：`gaussian` / `real_row`；`double_quant`：bool；`seed` | 精确计算 |

**复用已有零件：**
- `linear_map`（C2 第 2 段：$A=I+uv^\top$）；
- `symmetric_ellipse`（C2 推导 D2：取 [[1, 1], [1, 1]]，秩 1 把圆压成线段）；
- 前置课的 `pca_3d`、`pca_projection` 只作为链接回顾，不再嵌入。

---

## 补充出处（不在调研文件中，属于标准文献；写页面前逐条核对）

- **混合精度训练**（Micikevicius et al. 2017）：https://arxiv.org/abs/1710.03740
- **8-bit 优化器**（Dettmers et al. 2021）：https://arxiv.org/abs/2110.02861
- **激活重算**（Chen et al. 2016）：https://arxiv.org/abs/1604.06174
- **FlashAttention：** https://arxiv.org/abs/2205.14135
- **Liger Kernel：** https://github.com/linkedin/Liger-Kernel
- **S-LoRA：** https://arxiv.org/abs/2311.03285
- **Punica：** https://arxiv.org/abs/2310.18547
- **LoftQ：** https://arxiv.org/abs/2310.08659
- **GPTQ：** https://arxiv.org/abs/2210.17323
- **AWQ：** https://arxiv.org/abs/2306.00978
- **直通估计**（Bengio et al. 2013）：https://arxiv.org/abs/1308.3432
- **NF4 的最优性讨论**（Yoshida 2023，待核实）：https://arxiv.org/abs/2306.06965
- **vLLM LoRA 文档**（路径以官网为准）：https://docs.vllm.ai/
- **Eckart–Young 定理：** 标准线性代数结论。
