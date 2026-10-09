# 中英术语表（初版）

2026-10-10。全课统一译名，每个术语只用一种中文写法。各部分作者如需新增或修改，请在本文件里改，并在自己的规划文件里引用。

## 0. 写法约定

1. **首次出现：** 每课第一次出现某个术语时，写成"中文（English）"；有通用缩写的，写成"中文（English, 缩写）"，例如"监督微调（supervised fine-tuning, SFT）"。之后只写中文或缩写。
2. **保留英文的：**
   - 方法名和算法名：LoRA、QLoRA、DPO、PPO、GRPO、RAG、SFT、KL、BM25、InfoNCE、NF4、TIES、DARE 等；
   - 指标名：pass@k、recall@k 等；
   - token、logits；
   - 库名和代码标识符。
3. **"推理"有歧义，不单独使用：**
   - inference 写成"推理成本、推理延迟、推理引擎、推理服务"；
   - reasoning 写成"推理能力、推理模型、推理轨迹"。
4. **on-policy 统一译"在线"**，与 B 部分一致，例如"在线蒸馏""在线采样"。需要和 online（数据随训练实时产生）严格区分时，写"在线（同策略）"。off-policy 译"离线（异策略）"。
5. **正文写"损失"，代码和曲线标签里保留 `loss`。**
6. **中文按中文习惯写，不逐字翻译。** 术语表只管统一译名，不规定句式。

## 1. 总体与训练流程

| English | 中文 | 定义 | 首次出现 |
|---|---|---|---|
| fine-tuning | 微调 | 在预训练模型的基础上，用新数据继续更新权重 | A1 |
| pretraining | 预训练 | 在海量文本上做下一个词预测，模型的知识主要来自这一阶段 | A1 |
| post-training | 后训练 | 预训练之后的阶段，包括 SFT、偏好优化和强化学习 | A1 |
| continued pretraining (CPT) | 继续预训练 | 在领域文本上接着做下一个词预测 | A1、B2 |
| mid-training | 中期训练 | 介于预训练和后训练之间、用精选数据继续训练的阶段 | A1、B2 |
| base model | 基座模型 | 只经过预训练的模型，会续写文档，不会"当助手" | A1 |
| chat model | 对话模型 | 经过后训练、能按对话格式回答的模型 | A1 |
| alignment | 对齐 | 让模型的行为符合人的意图和规范 | A1 |
| superficial alignment hypothesis | 表层对齐假说 | 认为知识主要来自预训练，对齐主要改变的是格式和风格（有争议） | A1 |
| hallucination | 幻觉 | 模型流畅地给出与事实不符或没有依据的内容 | A1 |
| multimodal fine-tuning | 多模态微调 | 涉及图像、语音等输入的微调（超出本课程范围） | A1 |

## 2. 提示词、上下文与 RAG

| English | 中文 | 定义 | 首次出现 |
|---|---|---|---|
| prompt | 提示词 | 发给模型的输入文本 | A1 |
| system prompt | 系统提示词 | 放在对话最前面、规定角色和规则的提示词 | A1 |
| context engineering | 上下文工程 | 设计每次请求的完整上下文：指令、示例、检索到的资料、工具定义、输出格式约束 | A1 |
| few-shot | 少样本 | 在提示词里放几个示例 | A1 |
| in-context learning | 上下文学习 | 模型从提示里的示例中学会任务，不改权重 | A1 |
| context window | 上下文窗口 | 模型一次能读入的最大 token 数 | A1 |
| prompt caching | 提示缓存 | 复用相同前缀的计算结果，降低重复长提示的成本和延迟 | A1 |
| structured output / constrained decoding | 结构化输出 / 约束解码 | 解码时按 JSON Schema 或语法规则限制输出格式 | F1 |
| retrieval-augmented generation (RAG) | 检索增强生成 | 先从语料中检索相关内容放进上下文，再生成回答 | A1 |
| chunk / chunking | 文本块 / 切块 | 把文档切成用于检索的片段 | A2 |
| chunk overlap | 块重叠 | 相邻块之间共享的 token，防止答案被切断 | A2 |
| embedding | 嵌入向量 | 把文本映射成的定长向量 | A2 |
| embedding model | 向量模型 | 把文本编码成嵌入向量的模型 | A2 |
| cosine similarity | 余弦相似度 | 两个向量夹角的余弦；归一化后等于点积 | A2 |
| bi-encoder | 双编码器 | 查询和文档分别编码，文档向量可以预先算好 | A2 |
| cross-encoder | 交叉编码器 | 把查询和文档一起输入，直接输出相关度，更准但更慢 | A2 |
| reranking / reranker | 重排 / 重排模型 | 对第一阶段取回的候选重新排序 | A2 |
| approximate nearest neighbor (ANN) | 近似最近邻 | 以少量召回损失换取速度的向量检索 | A2 |
| vector database | 向量数据库 | 存储嵌入向量并支持近似最近邻检索的系统 | A2 |
| keyword / lexical search | 关键词检索 | 按词面匹配检索，例如 BM25 | A2 |
| dense / sparse retrieval | 稠密检索 / 稀疏检索 | 分别基于嵌入向量和词项权重的检索 | A2 |
| hybrid search | 混合检索 | 融合关键词检索和稠密检索的结果 | A2 |
| reciprocal rank fusion (RRF) | 倒数排名融合 | 按 Σ1/(k+名次) 融合多个排序，只用名次 | A2 |
| query rewriting | 查询改写 | 检索前改写或扩展查询，例如展开缩写 | A2 |
| contextual retrieval | 上下文化检索 | 给每个块加上它在全文中位置的说明，再建索引 | A2 |
| re-indexing | 重建索引 | 用新的向量模型重新嵌入整个语料 | A2 |
| lost in the middle | 中间遗失 | 相关信息落在长上下文中间时，模型利用得较差 | A2 |
| (indirect) prompt injection | （间接）提示注入 | 输入或检索到的文本里夹带指令，劫持模型 | A2 |
| faithfulness | 忠实度 | 回答是否有检索内容作为依据 | A2 |
| contrastive learning / loss | 对比学习 / 对比损失 | 拉近正例、推开负例的表示学习方法 | A2 |
| in-batch negatives | 批内负例 | 用同一批里其他样本的正例当负例 | A2 |
| hard negative | 难负例 | 和查询很像、但不相关的负例 | A2 |
| false negative | 假负例 | 被当成负例、其实相关的样本 | A2 |
| temperature (τ) | 温度 | softmax 里除以的系数，控制分布的尖锐程度 | A2 |
| RAFT (retrieval-augmented fine-tuning) | RAFT | 用带干扰文档的检索结果去微调生成模型 | A2 |

## 3. SFT 与数据

| English | 中文 | 定义 | 首次出现 |
|---|---|---|---|
| supervised fine-tuning (SFT) | 监督微调 | 用示范数据，以下一个词预测的损失训练 | A1、B1 |
| instruction tuning | 指令微调 | 用"指令 → 回答"数据做的 SFT | B1 |
| demonstration | 示范 | 一条"输入 → 理想输出"样本 | A1 |
| chat template | 聊天模板 | 把多角色对话渲染成带特殊 token 的文本的规则 | B1 |
| special token | 特殊 token | 模板里标记角色和边界的 token | B1 |
| end-of-sequence token (EOS) | 序列结束符 | 生成时遇到它就停止 | B1 |
| loss mask | 损失掩码 | 决定哪些 token 计入损失 | B1 |
| assistant-only / completion-only loss | 仅助手损失 / 仅补全损失 | 只在助手回答或补全部分计算损失 | B1 |
| prompt loss weight | 提示损失权重 | 提示部分的损失乘上的系数 | B1 |
| padding | 填充 | 把短序列补到同一长度 | B1 |
| packing | 打包 | 把多条样本拼进一条序列，提高吞吐量 | B1 |
| gradient accumulation | 梯度累积 | 多个微批的梯度累加后，再更新一次参数 | B1 |
| micro-batch | 微批 | 梯度累积中每次前向和反向处理的小批量 | B1 |
| synthetic data | 合成数据 | 由模型生成的训练数据 | A1、B2 |
| rejection sampling | 拒绝采样 | 采样多个回答，只保留通过验证器或评委筛选的 | A1、B2 |
| expert iteration | 专家迭代 | 反复"采样 → 过滤 → SFT"的循环 | B2 |
| decontamination | 去污染 | 去掉训练集中与评测集重复的内容 | B2 |
| vocabulary extension | 扩词表 | 为新语言或新领域加入新的 token | B2 |
| replay / data mixing | 回放 / 数据混合 | 训练新数据时，混入旧数据或通用数据 | B2、B3 |
| encoder classifier | 编码器分类模型 | 编码器（如 BERT 类）加分类头，输出固定标签 | A1 |
| classification head | 分类头 | 接在编码器后面输出类别分数的线性层 | A1 |
| tool calling / function calling | 工具调用 | 模型按约定格式输出函数名和参数，由外部执行 | B2 |
| agent / trajectory | 智能体 / 轨迹 | 多步调用工具完成任务的系统 / 一次任务中的完整步骤序列 | B2、F1 |

## 4. 训练动态与评测

| English | 中文 | 定义 | 首次出现 |
|---|---|---|---|
| learning rate / warmup | 学习率 / 预热 | 每步的更新幅度 / 训练开始时逐步提高学习率 | B3 |
| epoch | 轮 | 完整遍历一次训练集 | B3 |
| overfitting | 过拟合 | 训练集上越来越好，留出集上变差 | B3 |
| early stopping | 早停 | 按验证指标提前结束训练 | B3 |
| catastrophic forgetting | 灾难性遗忘 | 学新任务时，旧能力明显退化 | B3 |
| emergent misalignment | 涌现不对齐 | 窄任务微调引发大范围的不良行为 | B3 |
| model checkpoint | 模型检查点 | 训练过程中保存的权重快照（与课程里的"检查点题"区分） | B3 |
| eval set / held-out set | 评测集 / 留出集 | 不参与训练、用来评估的数据 | A1、B3 |
| regression eval | 回归评测 | 检查原有能力有没有退步的评测 | B3 |
| LLM-as-a-judge | 大模型评委 | 用大模型按评分细则给回答打分 | B3、D1 |
| rubric | 评分细则 | 写明打分维度和标准的说明 | E1、F1 |
| win rate / length-controlled win rate | 胜率 / 长度受控胜率 | 两两比较中获胜的比例 / 扣除长度偏好影响后的胜率 | B3、D3 |
| A/B test | A/B 测试 | 线上随机分流比较两个版本 | F1 |

## 5. 显存与参数高效微调

| English | 中文 | 定义 | 首次出现 |
|---|---|---|---|
| mixed precision | 混合精度 | 计算用 bf16，主权重和优化器状态用 fp32 | C1 |
| optimizer state | 优化器状态 | Adam 的一阶和二阶矩（m、v） | C1 |
| activations | 激活值 | 前向时为反向传播保存的中间结果 | C1 |
| gradient checkpointing / activation recomputation | 激活重算 | 只保存部分激活值，反向时重新计算，用计算换显存。口语里也叫"梯度检查点"；正式文字用"激活重算"，避免和"模型检查点"混淆（与 part-c-efficiency.md 一致） | C1 |
| ZeRO / FSDP / sharding / offload | 零冗余优化器 / 全分片数据并行 / 分片 / 卸载 | 把权重、梯度和优化器状态分到多张卡上，或放到 CPU 内存里 | C1 |
| fused cross-entropy | 融合交叉熵 | 分块计算 logits 和损失，不存下完整的 logits 张量 | C1 |
| parameter-efficient fine-tuning (PEFT) | 参数高效微调 | 只训练少量新增或选定的参数 | C2 |
| low-rank adaptation (LoRA) | 低秩适配（LoRA） | 冻结 W₀，只学一个低秩改动 ΔW = BA；正文通常直接写 LoRA | C2 |
| rank (r) | 秩 | 低秩改动的维度 | C2 |
| adapter | 适配器 | LoRA 等方法新增的那部分参数 | C2 |
| merge | 合并 | 把适配器加回原权重，推理时没有额外开销 | C3 |
| multi-LoRA serving | 多适配器服务 | 一个基座模型同时挂多个适配器，对外提供服务 | C3 |
| quantization | 量化 | 用更少的比特表示权重 | C3 |
| NF4 (4-bit NormalFloat) | NF4 | 格点放在正态分位点上的 4 位格式 | C3 |
| blockwise quantization | 按块量化 | 每一块权重（例如 64 个）共用一个缩放系数（与 part-c-efficiency.md 一致；README 里写作"按块缩放"） | C3 |
| double quantization | 双重量化 | 把缩放系数本身再量化一次 | C3 |
| paged optimizer | 分页优化器 | 用统一内存吸收显存的瞬时峰值 | C3 |
| quantization-aware training (QAT) | 量化感知训练 | 训练时模拟量化，让模型适应低比特部署 | C3 |
| post-training quantization (PTQ) | 训练后量化 | 训练完成后再量化权重，例如 GPTQ、AWQ | C3 |
| rank-stabilized LoRA (rsLoRA) | 秩稳定缩放 | 用 α/√r 代替 α/r 缩放，秩大时也能继续学 | C2 |
| DoRA | 权重分解低秩适配（DoRA） | 把权重的大小和方向分开学，对方向部分用 LoRA | C2 |
| target modules | 目标模块 | 挂 LoRA 的那些层 | C2 |
| intrinsic dimension | 内在维度 | 达到某个效果所需的最少自由参数数 | C2 |

## 6. 偏好与 RLHF

| English | 中文 | 定义 | 首次出现 |
|---|---|---|---|
| preference optimization | 偏好优化 | 用"哪个更好"的信号训练模型 | A1、D1 |
| preference data / pair | 偏好数据 / 偏好对 | 同一个提示下的被选回答和被拒回答 | D1 |
| chosen / rejected | 被选回答 / 被拒回答 | 偏好对中较好的一个 / 较差的一个 | D1 |
| reward model (RM) | 奖励模型 | 给回答打分的模型 | D1 |
| reward signal | 奖励信号 | 打分的来源：验证器、评分细则加评委，或奖励模型 | D1 |
| Bradley–Terry model | Bradley–Terry 模型 | P(A 优于 B) = σ(r_A − r_B) | D1 |
| RLHF | 基于人类反馈的强化学习 | 用奖励模型和 KL 约束做强化学习 | D2 |
| policy | 策略 | 被训练的模型，即它的输出分布 | D2 |
| reference model | 参考模型 | KL 约束的锚点，通常是 SFT 后的模型 | D2 |
| policy gradient / REINFORCE | 策略梯度 / REINFORCE | 用 ∇log π 乘以回报来估计梯度 | D2 |
| baseline | 基线 | 从回报中减去的量，用来降低方差 | D2 |
| advantage | 优势 | 回报减去基线 | D2 |
| value model / critic | 价值模型 | 估计期望回报的模型，PPO 用它作基线 | D2 |
| importance ratio | 重要性比率 | 新旧策略概率之比 ρ | D2 |
| clipping | 截断 | 把 ρ 限制在 1±ε 之内 | D2 |
| PPO (proximal policy optimization) | PPO（近端策略优化） | 带截断代理目标的策略梯度方法（本课程作为概念桥梁讲） | D2 |
| KL divergence / KL penalty | KL 散度 / KL 惩罚 | 两个分布的差异 / 偏离参考模型的代价 | D2 |
| reward hacking | 奖励投机 | 策略钻奖励的空子：分数高，质量不高 | D2 |
| over-optimization | 过度优化 | 代理奖励继续上升，真实质量却下降 | D2 |
| DPO (direct preference optimization) | DPO（直接偏好优化） | 把 KL 约束下的偏好目标变成对偏好对的分类损失 | D3 |
| implicit reward | 隐式奖励 | β·log(π/π_ref)，DPO 中隐含的奖励 | D3 |
| likelihood displacement | 似然位移 | DPO 训练中被选回答的概率反而下降，概率质量移到别处 | D3 |
| length bias | 长度偏差 | 打分或训练偏向更长的回答 | D2、E1 |
| delta learning | 差值学习 | 用"强模型的回答 vs 弱模型的回答"构造偏好对 | D4 |
| IPO / KTO / ORPO / SimPO | （保留英文） | DPO 的变体，见 D4 的对照表 | D4 |

## 7. 强化学习与推理

| English | 中文 | 定义 | 首次出现 |
|---|---|---|---|
| reinforcement learning with verifiable rewards (RLVR) | 可验证奖励强化学习 | 奖励由规则或程序自动判定的强化学习 | A1、E1 |
| verifiable reward | 可验证奖励 | 能用规则或程序判断对错的奖励 | E1 |
| verifier | 验证器 | 判断回答对错的程序或规则 | A1、E1 |
| grader | 评分器 | 托管强化微调服务中给回答打分的组件（规则或大模型评委） | A1、E1 |
| reinforcement fine-tuning (RFT) | 强化微调 | 云厂商提供的、带评分器的托管强化学习微调服务 | A1、E1 |
| GRPO (group relative policy optimization) | GRPO（组相对策略优化） | 用同一题多次采样的组内均值作基线，不需要价值模型 | E1 |
| RLOO (leave-one-out) | RLOO（留一法） | 用组内其他样本的平均作基线 | E1 |
| rollout | 采样 | 让策略生成回答（强化学习里的一次生成） | E1 |
| group | 组 | 同一个提示的 G 个采样 | E1 |
| zero-variance group | 零方差组 | 组内全对或全错，优势全为 0，没有学习信号 | E1 |
| clip-higher (asymmetric clipping) | 非对称截断 | 截断的上下界不对称，例如 0.2 和 0.28 | E1 |
| pass@k | pass@k | k 次采样中至少一次正确的概率 | E1 |
| maj@k | maj@k（多数投票准确率） | k 次采样多数投票后的准确率 | E1 |
| outcome reward / process reward model (PRM) | 结果奖励 / 过程奖励模型 | 只看最终答案打分 / 给每一步推理打分 | E2 |
| cold start | 冷启动 | 强化学习前，先用少量高质量数据做 SFT | E2 |
| chain of thought / reasoning trace | 思维链 / 推理轨迹 | 模型写出的中间推理过程 | E2 |
| reasoning model | 推理模型 | 先写推理轨迹、再给答案的模型 | E2 |
| test-time scaling | 测试时扩展 | 推理时多花计算换取效果（更长的思考、多次采样） | E2 |
| agentic RL | 智能体强化学习 | 在可交互环境中，以任务成功为奖励的多步强化学习 | E2、F1 |

## 8. 蒸馏与合并

| English | 中文 | 定义 | 首次出现 |
|---|---|---|---|
| distillation | 蒸馏 | 用老师模型的输出或分布训练学生模型 | A1 |
| teacher / student model | 教师模型 / 学生模型 | 提供信号的强模型 / 被训练的小模型 | A1 |
| sequence-level distillation | 序列级蒸馏 | 用老师生成的文本做 SFT | B2、E3 |
| logit distillation | logit 级蒸馏 | 逐 token 用 KL 逼近老师的分布，要求同一个分词器 | E3 |
| on-policy distillation | 在线蒸馏 | 学生自己采样，老师逐 token 打分（反向 KL） | A1、E3 |
| multi-teacher distillation | 多老师蒸馏 | 从多个专长老师模型蒸馏到一个学生模型 | A1、E3 |
| forward / reverse KL | 正向 KL / 反向 KL | KL(p‖q) / KL(q‖p)；前者倾向覆盖所有峰，后者倾向挑一个峰 | E3 |
| mode-covering / mode-seeking | 覆盖多峰 / 寻峰 | 正向 KL 和反向 KL 各自的拟合倾向 | E3 |
| model merging | 模型合并 | 在权重空间里组合多个微调模型（要求同一基座） | E3 |
| task vector | 任务向量 | 微调后的权重减去基座权重 | E3 |
| model soup | 模型汤 | 对多个微调模型的权重取平均 | E3 |

## 9. 部署与成本

| English | 中文 | 定义 | 首次出现 |
|---|---|---|---|
| inference cost / latency | 推理成本 / 推理延迟 | 线上运行模型的花费和耗时 | A1 |
| prefill | 预填充 | 处理输入提示的阶段，耗时随输入长度增长 | A1 |
| time to first token (TTFT) | 首 token 延迟 | 从发出请求到收到第一个 token 的时间 | A1 |
| throughput | 吞吐量 | 单位时间内处理的 token 数或请求数 | B1 |
| break-even point | 持平点 | 两种方案总成本相等时的请求量 | A1 |
| self-hosted / on-premises deployment | 私有部署 | 在自有或专属环境中运行模型 | F1 |

## 10. 本课程自己的术语

| English | 中文 | 定义 | 首次出现 |
|---|---|---|---|
| decision map | 决策图 | 从需求一路推到方法的流程图，节点编号 DM-* 见 part-f-choosing.md | A1 |
| how-to-choose card | "怎么选"卡片 | 每课结尾给决策图添加的一条规则和一个反例 | A1 |
| gap type (knowledge / behavior / capability / efficiency) | 差距类型（知识 / 行为 / 能力 / 效率） | DM-2 的四类失败 | A1 |
| training signal | 训练信号 | 示范、比较、验证器、老师、标签五种 | A1 |
| world | 探索世界 | 学生动手操作的交互页 | 平台 |
| checkpoint (question) | 检查点题 | 课程中的题目页（与"模型检查点"区分） | 平台 |
| predict–observe–explain | 预测 → 观察 → 解释 | 交互页的三步结构 | 平台 |
| exact / illustrative / real data | 精确计算 / 示意 / 真实数据 | 交互和图片的诚实标注 | 平台 |

## 与其他部分的对齐记录

- **on-policy：** 统一译"在线"，与 part-b-sft.md 一致。
- **emergent misalignment：** 统一为"涌现不对齐"，与 part-b-sft.md 一致。
- **gradient checkpointing：** 统一为"激活重算"，与 part-c-efficiency.md 一致。
- **blockwise quantization：** 统一为"按块量化"，与 part-c-efficiency.md 一致。
- **LLM-as-a-judge：** 统一为"大模型评委"，与 part-e-reasoning.md 一致。part-b-sft.md 里有一处写成"LLM 裁判"，建议改成"大模型评委"。
- **README 中的口语写法：** 例如"loss 掩码"、"奖励被钻空子"。正式课程文字一律用本表译名："损失掩码"、"奖励投机"。
