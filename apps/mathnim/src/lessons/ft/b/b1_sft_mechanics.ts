// B1 SFT mechanics: the same next-token loss, aimed at the right tokens.
// Plan: docs/lessons/llm-finetuning/part-b-sft.md (B1); sources there and in research-sft.md.
import type { Lesson } from '@mathnim/core';
import { choose_card, on_handles, t, vis } from './common';

const MASKED_LOSS = `import torch
import torch.nn.functional as F

IGNORE = -100   # labels with this value are skipped by cross_entropy

def build_labels(input_ids, is_assistant):
    # input_ids, is_assistant: [B, T]
    labels = input_ids.clone()
    labels[~is_assistant] = IGNORE          # mask everything the model should not learn to say
    return labels

def sft_loss_sum(model, input_ids, attention_mask, labels):
    logits = model(input_ids=input_ids, attention_mask=attention_mask).logits   # [B, T, V]
    # position t predicts token t+1: shift by one
    logits = logits[:, :-1].float()                                             # [B, T-1, V]
    targets = labels[:, 1:]                                                     # [B, T-1]
    loss_sum = F.cross_entropy(logits.reshape(-1, logits.size(-1)), targets.reshape(-1),
                               ignore_index=IGNORE, reduction="sum")
    n_tokens = (targets != IGNORE).sum()
    return loss_sum, n_tokens

def train_step(model, micro_batches, optimizer):
    # count the graded tokens of the WHOLE accumulation window first
    total = sum((mb["labels"][:, 1:] != IGNORE).sum() for mb in micro_batches)
    for mb in micro_batches:
        loss_sum, _ = sft_loss_sum(model, mb["input_ids"], mb["attention_mask"], mb["labels"])
        (loss_sum / total).backward()   # every graded token weighs 1/total
    optimizer.step()
    optimizer.zero_grad()`;

const TRL_CONFIG = `from trl import SFTConfig, SFTTrainer

config = SFTConfig(
    assistant_only_loss=True,  # loss on the assistant's turns only (TRL swaps in a training
                               # chat template with {% generation %} tags for Qwen2.5 / Llama 3)
    packing=True,              # boundary-aware packing ("bfd", padding-free)
    max_length=2048,
    eos_token="<|im_end|>",    # Qwen2.5 *base*: its eos is <|endoftext|>, but turns end with <|im_end|>
)
trainer = SFTTrainer(model=model, args=config, train_dataset=dataset)  # messages-format dataset
trainer.train()`;

export const lesson: Lesson = {
  id: 'ft-b1-sft-mechanics',
  title: t('SFT: the same loss, aimed at the right tokens', 'SFT：同一个损失，对准该学的 token'),
  description: t('Supervised fine-tuning is next-token prediction on demonstrations. What decides what the model learns: the chat template, the loss mask, how examples share a batch.', '监督微调就是在示范数据上做下一个 token 预测。决定模型学到什么的，是聊天模板、损失掩码，以及样本怎样拼进一个 batch。'),
  mode: 'essay',
  skills: [
    { id: 'sft-objective', name: t('SFT = next-token loss on demonstrations', 'SFT = 示范数据上的下一 token 损失') },
    { id: 'chat-template', name: t('Chat templates and the end-of-turn token', '聊天模板与轮次结束 token') },
    { id: 'loss-mask', name: t('Which tokens the loss grades', 'loss 计入哪些 token'), prerequisites: ['sft-objective'] },
    { id: 'packing', name: t('Padding vs packing', '填充与打包') },
    { id: 'loss-normalization', name: t('Averaging the loss over tokens', '按 token 对 loss 取平均'), prerequisites: ['loss-mask'] },
  ],
  misconceptions: [
    { id: 'sft-new-objective', description: t('SFT is a different training objective from pretraining.', 'SFT 是一种和预训练不同的训练目标。') },
    { id: 'template-cosmetic', description: t('The chat template is cosmetic: serving with a different template or stop token is fine.', '聊天模板只是格式：推理时换模板、换停止符都没关系。') },
    { id: 'mask-dogma', description: t('Either "never put loss on the prompt" or "the whole sequence is fine": one answer for every dataset.', '要么"提示永远不能算 loss"，要么"整段都算也无所谓"：所有数据都一个答案。') },
    { id: 'pad-eos-harmless', description: t('The end-of-turn token’s label does not matter (masking it, or setting pad = EOS, is harmless).', '轮次结束 token 的 label 无所谓（把它掩掉，或者 pad 设成 EOS，都没事）。') },
    { id: 'packing-harmless', description: t('Concatenating examples into one row is free: they cannot affect each other.', '把样本直接拼成一行没有代价：它们互不影响。') },
    { id: 'mean-of-means', description: t('Averaging each micro-batch, then averaging those averages, equals the average over all tokens.', '每个 micro-batch 先求平均、再把平均数平均，等于对所有 token 求平均。') },
  ],
  steps: [
    // ------------------------------------------------------------------ what SFT is for
    {
      id: 'why', kind: 'read', chapter: t('What SFT does', 'SFT 在做什么'), title: t('Teach by showing', '用示范来教'),
      blocks: [
        { type: 'p', text: t(
          'A pretrained model continues documents: ask it a question and it may write three more questions. **Supervised fine-tuning (SFT)** shows it conversations in which an assistant answers the way you want, until it answers that way too. It is the most used way to change a model’s weights in practice, usually together with LoRA (part C).',
          '预训练模型只会续写文档：你问它一个问题，它可能接着写出三个新问题。**监督微调（supervised fine-tuning, SFT）**给它看一段段对话，对话里的助手按你想要的方式回答，直到模型也这样回答。它是实践中最常用的改权重方式，通常配合 LoRA 使用（C 部分）。') },
        { type: 'p', text: t(
          'Mechanically nothing new happens. SFT uses the pretraining loss, next-token cross-entropy, on different text, and it grades only some of the tokens:',
          '机制上没有任何新东西：SFT 用的就是预训练的损失，即下一个 token 的交叉熵；只是换了文本，而且只给其中一部分 token 打分：') },
        { type: 'math', tex: 'L(\\theta) = -\\frac{1}{Z}\\sum_t m_t \\,\\log p_\\theta(y_t \\mid y_{<t}), \\qquad m_t \\in \\{0, 1\\}' },
        { type: 'list', items: [
          t('$-\\log p_\\theta(y_t \\mid y_{<t})$: how surprised the model is by token $t$ of the demonstration. Lowering it makes the demonstration more likely.', '$-\\log p_\\theta(y_t \\mid y_{<t})$：模型对示范里第 $t$ 个 token 有多"意外"。把它压低，示范就变得更可能。'),
          t('$m_t$, the **loss mask**: 1 if the model should learn to produce token $t$, 0 if it is only context (the user’s question, for example).', '$m_t$ 是**损失掩码（loss mask）**：模型应该学会说出第 $t$ 个 token，就取 1；这个 token 只是上下文（比如用户的问题），就取 0。'),
          t('$Z$: what we divide by. It sounds like bookkeeping, but it decides how much each example counts.', '$Z$：分母。听起来像记账细节，其实它决定了每条样本的分量。'),
        ] },
        { type: 'p', text: t(
          'So if the loss is the same, what can go wrong? Three things decide what the model actually learns, and each has a silent bug: **the text it sees** (the chat template), **which tokens are graded** (the mask), and **how examples share a batch** (packing and $Z$). This lesson takes them in that order.',
          '既然损失一样，还能出什么错？决定模型真正学到什么的有三样东西，每样都有"不报错的 bug"：**模型看到的文本**（聊天模板）、**哪些 token 被打分**（掩码），以及**样本怎样共用一个 batch**（打包和 $Z$）。这节课按这个顺序讲。') },
      ],
    },
    // ------------------------------------------------------------------ the template
    {
      id: 'template', kind: 'read', chapter: t('The text the model sees', '模型看到的文本'), title: t('A chat is rendered into one string', '一段对话被渲染成一串文本'),
      blocks: [
        { type: 'p', text: t(
          'The model sees only a sequence of tokens. A **chat template** turns the list of messages into that sequence and marks who is speaking with **special tokens**. The most important one closes each turn: the **end-of-turn token**. The model learns to stop by learning to produce it.',
          '模型只看得到一串 token。**聊天模板（chat template）**把消息列表变成这串 token，用**特殊 token（special token）**标出谁在说话。其中最重要的是结束每一轮的那个：**轮次结束 token（end-of-turn token）**。模型学会"停"，靠的就是学会输出它。') },
        { type: 'figure', src: 'ft/b/b1-chat-templates.svg',
          alt: t('The same three-message chat rendered in the Qwen2.5 ChatML format and in the Llama 3 format, with special tokens highlighted and the end-of-turn token marked.', '同一段三条消息的对话，分别按 Qwen2.5 的 ChatML 格式和 Llama 3 格式渲染，特殊 token 高亮，并标出轮次结束 token。'),
          caption: t('Two families, two templates. Both end every turn with a special token, <|im_end|> or <|eot_id|>, and that token must stay in the labels so the model learns to emit it.', '两个模型家族，两种模板。两者都用一个特殊 token 结束每一轮：<|im_end|> 或 <|eot_id|>。这个 token 必须留在 labels 里，模型才学得会输出它。'),
          credit: 'Own drawing; Qwen2.5 checked against its tokenizer’s chat_template, Llama 3 from Meta’s prompt-format doc · 自绘；Qwen2.5 用其 tokenizer 的 chat_template 核对，Llama 3 据 Meta 提示格式文档' },
        { type: 'callout', kind: 'warning', title: t('Train and serve with the same template', '训练和推理用同一个模板'), body: t(
          'The model learns "after these tokens comes <|im_end|>". Serve it with another template, or stop generation on another token, and it will not stop where you expect. A real trap: the Qwen2.5 *base* tokenizer’s `eos_token` is <|endoftext|>, while chat turns end with <|im_end|>. That is why TRL asks you to set `eos_token="<|im_end|>"` when you fine-tune the base model on chats[^trl].',
          '模型学到的是"这串 token 之后接 <|im_end|>"。推理时换了模板，或者生成器在另一个 token 上停，它就不会在你预期的地方停下。一个真实的坑：Qwen2.5 *基座*的 tokenizer，`eos_token` 是 <|endoftext|>，而对话的每一轮以 <|im_end|> 结束。所以在对话数据上微调基座时，TRL 要你设 `eos_token="<|im_end|>"`[^trl]。') },
        { type: 'cite', key: 'trl', text: t('TRL documentation, SFTTrainer (v1.15).', 'TRL 文档，SFTTrainer（v1.15）。'), url: 'https://huggingface.co/docs/trl/sft_trainer' },
      ],
    },
    // ------------------------------------------------------------------ the mask: predict, then act
    {
      id: 'mask-predict', kind: 'checkpoint', chapter: t('Which tokens are graded', '哪些 token 被打分'), title: t('Guess first', '先猜一猜'), skill: 'loss-mask', purpose: 'predict',
      prompt: t(
        'A real training example: a 207-token system prompt, a 47-token question, a 35-token answer. If **every** token is graded (no mask), how much of the loss sum comes from the answer?',
        '一条真实的训练样本：207 个 token 的系统提示，47 个 token 的问题，35 个 token 的回答。如果**每个** token 都打分（不加掩码），loss 总和里来自回答的大约有多少？'),
      question: { type: 'choice', options: [
        { id: 'a', label: t('Under 10%', '不到 10%'), correct: true },
        { id: 'b', label: t('About 25%', '大约 25%') },
        { id: 'c', label: t('About 50%', '大约 50%') },
        { id: 'd', label: t('Over 80%, the answer is what we train on', '80% 以上，我们训练的就是回答'), misconception: 'mask-dogma' },
      ] },
      explain: t('About 7% on this sample. Next you can see why: the prompt has eight times as many tokens, and many of them are hard to predict.', '这条样本上大约是 7%。下一步你会看到原因：提示的 token 是回答的八倍，而且很多都难以预测。'),
    },
    {
      id: 'mask-world', kind: 'explore', title: t('Who pays the loss', 'loss 花在了谁身上'), skill: 'loss-mask',
      scene: vis('token_loss_mask', { sample: 'single', start: 'all' }),
      prompt: t(
        'Each bar is one real token, as tall as its loss. Move each part of the conversation to **trained** or **masked** (drag a card up or down). Goal: grade exactly what the assistant should learn to say. Then try a small prompt weight λ.',
        '每根柱子是一个真实的 token，高度是它的 loss。把对话的每一部分拖到**训练**或**掩掉**那一行（上下拖动卡片）。目标：只给助手应该学会说的内容打分。然后试一个小的提示权重 λ。'),
      setup: (scene: any, ui, _ctx, world) => {
        on_handles(ui, () => scene.attach_cards(ui), (i) => {
          const p = scene.parts[i];
          world.emit('card', { kind: p.kind, trained: scene.trained(i) });
        });
        on_handles(ui, () => scene.attach_lambda(ui), () => world.emit('lambda', { v: scene.lam.get_value(), share: scene.stats().share }));
      },
      goals: [
        { id: 'assistant-only', check: (s: any) => s.assistant_only() && s.lam.get_value() === 0, message: t('Assistant-only loss: 100% of the gradient goes to what the assistant says, including the closing <|im_end|>.', '只算助手的 loss：100% 的梯度都用在助手说的话上，包括结尾的 <|im_end|>。') },
        { id: 'small-weight', check: (s: any) => s.assistant_only() && s.lam.get_value() >= 0.01 && s.lam.get_value() <= 0.2, message: t('A prompt weight of 0.01–0.2 brings the prompt back at a fraction of its size, while the answer still carries a large share of the loss.', '0.01 到 0.2 的提示权重，让提示以很小的比例回到 loss 里，回答仍然占 loss 的一大块。') },
      ],
      detectors: [
        { id: 'end-masked', on: (e) => (e.type === 'card' && e.data!.kind === 'E' && !e.data!.trained ? { kind: 'misconception', id: 'pad-eos-harmless' } : null) },
        { id: 'answer-masked', on: (e) => (e.type === 'card' && e.data!.kind === 'A' && !e.data!.trained ? { kind: 'misconception', id: 'mask-dogma', message: t('Now nothing teaches the answer: the loss only grades the prompt.', '现在没有任何东西在教回答：loss 只给提示打分。') } : null) },
      ],
      lines: [
        { text: t('Look at the skyline: the purple system prompt is most of the area. That is where an unmasked loss spends its gradient.', '看这排柱子：紫色的系统提示占了大半面积。不加掩码时，梯度主要就花在这里。'), when: 'enter' },
        { text: t('Drag a card down to mask that part. Watch the answer’s share on the right.', '把一张卡片往下拖，就掩掉这一部分。看右边回答的占比。'), when: 'idle' },
        { text: t('Careful: the closing end token is how the model learns to stop. Mask it and it is never asked to produce it.', '小心：结尾的结束 token 是模型学会"停"的唯一途径。把它掩掉，就从来没人要求模型输出它。'), when: { finding: 'pad-eos-harmless' } },
        { text: t('With the answer masked, the loss only grades text the model will never have to write.', '回答被掩掉以后，loss 只在给模型永远不用写的文本打分。'), when: { finding: 'mask-dogma' } },
        { text: t('That is assistant-only loss. Now drag λ a little to the right.', '这就是只算助手的 loss。现在把 λ 往右拖一点。'), when: 'goal' },
      ],
      hints: [t('The assistant should learn its answer and the token that ends its turn. Everything else is context.', '助手要学的是它的回答，以及结束这一轮的那个 token。其余都是上下文。')],
      solve: (s: any, _c, w) => {
        s.apply((p: any) => p.kind === 'A' || p.kind === 'E');
        s.lam.set_value(0);
        w.emit('card', { kind: 'S', trained: false });
        s.lam.set_value(0.1);
        w.emit('lambda', { v: 0.1, share: s.stats().share });
      },
    },
    {
      id: 'mask-evidence', kind: 'read', title: t('Is the mask a law?', '掩码是铁律吗？'),
      blocks: [
        { type: 'p', text: t(
          'Masking the prompt is the usual default, for a simple reason: you want the model to learn to answer, not to predict what users ask. But a small prompt weight λ is a regulariser, and on some data it helps:',
          '默认掩掉提示，理由很简单：你要模型学会回答，而不是学会预测用户会问什么。但小的提示权重 λ 相当于一种正则化，在某些数据上反而有帮助：') },
        { type: 'list', items: [
          t('**Short answers:** with short-completion data, a weight of 0.01–0.5 beat both 0 and 1 on multiple-choice and short-answer benchmarks. On long-generation benchmarks, a weight near 1 did better[^he].', '**回答很短时：**在短回答数据上，0.01 到 0.5 的权重在选择题和短答案基准上都胜过 0 和 1；在长文本生成基准上，接近 1 的权重更好[^he]。'),
          t('**Long instructions, short outputs, or few examples:** putting loss on the instructions reduced overfitting, with large gains in the best case[^shi].', '**指令长、输出短，或者样本很少时：**在指令上也算 loss 能减轻过拟合，最好的情况下提升很大[^shi]。'),
        ] },
        { type: 'figure', src: 'ft/b/b1-prompt-weight.svg', alt: t('Relative score against prompt-loss weight for two models on short-completion data: an inverted U peaking between about 0.01 and 0.25.', '两个模型在短回答数据上的相对得分随提示损失权重变化：呈倒 U 形，峰值在大约 0.01 到 0.25 之间。'),
          caption: t('Short-completion data (AlpacaDataShort). On long-generation benchmarks a weight near 1 did better.', '短回答数据（AlpacaDataShort）。在长文本生成基准上，接近 1 的权重更好。'),
          credit: 'Schematic, redrawn after Huerta-Enochian & Ko (2024) Fig. 1(d); values approximate · 示意，据 Huerta-Enochian & Ko（2024）图 1(d) 重绘，数值近似' },
        { type: 'callout', kind: 'open', body: t(
          'These are single studies on specific data. Treat λ as a knob you try against a held-out set, not as a rule.',
          '这些都是针对特定数据的单项研究。把 λ 当成一个要在留出集上试的旋钮，而不是规则。') },
        { type: 'details', summary: t('In TRL', '在 TRL 里'), blocks: [
          { type: 'list', items: [
            t('`completion_only_loss` is on by default for prompt–completion datasets; plain-text datasets get loss on the whole sequence.', 'prompt–completion 格式的数据集默认开启 `completion_only_loss`；纯文本数据集默认对整段算 loss。'),
            t('`assistant_only_loss=True` needs a template with `{% generation %}` tags. The stock Qwen2.5 and Llama 3.1 templates have none, so TRL v1.15 swaps in its own training templates for them.', '`assistant_only_loss=True` 需要模板里有 `{% generation %}` 标签。Qwen2.5 和 Llama 3.1 自带的模板没有，所以 TRL v1.15 会为它们换上自己的训练模板。'),
            t('Multi-turn data: you can grade every assistant turn, or only the last one.', '多轮对话：可以给每一轮助手回答打分，也可以只给最后一轮。'),
          ] },
        ] },
        { type: 'cite', key: 'he', text: t('Huerta-Enochian & Ko (2024). Instruction Fine-Tuning: Does Prompt Loss Matter? EMNLP.', 'Huerta-Enochian & Ko（2024）。Instruction Fine-Tuning: Does Prompt Loss Matter? EMNLP。'), url: 'https://arxiv.org/abs/2401.13586' },
        { type: 'cite', key: 'shi', text: t('Shi et al. (2024). Instruction Tuning With Loss Over Instructions. NeurIPS.', 'Shi 等（2024）。Instruction Tuning With Loss Over Instructions。NeurIPS。'), url: 'https://arxiv.org/abs/2405.14394' },
      ],
    },
    {
      id: 'mask-gradient', kind: 'derive', title: t('Where the gradient goes', '梯度去了哪里'), skill: 'loss-mask',
      intro: t('Why do masked tokens get no gradient, and why are the template tokens almost free even when they are graded? Write the loss of one position and differentiate it with respect to that position’s logits $z_t$.', '为什么被掩掉的 token 拿不到梯度？为什么模板 token 即使被打分，也几乎"不花钱"？写出一个位置的 loss，对这个位置的 logits $z_t$ 求导。'),
      lines: [
        { tex: '\\ell_t = -\\log \\operatorname{softmax}(z_t)_{y_t}', why: t('Cross-entropy at position $t$: minus the log-probability of the target token $y_t$.', '第 $t$ 个位置的交叉熵：目标 token $y_t$ 的对数概率取负。') },
        { tex: '\\frac{\\partial \\ell_t}{\\partial z_t} = p_t - e_{y_t}', why: t('The softmax-plus-cross-entropy gradient: predicted probabilities minus the one-hot target.', 'softmax 加交叉熵的梯度：预测概率减去目标的 one-hot 向量。') },
        { tex: '\\Big\\lVert p_t - e_{y_t} \\Big\\rVert^2 = (1-p_{y})^2 + \\sum_{j\\neq y} p_j^2 \\;\\xrightarrow{\\;p_y \\to 1\\;}\\; 0', why: t('As $p_y \\to 1$ this goes to 0: a token the model already predicts with near certainty (like <|im_start|> after a newline) contributes almost nothing.', '当 $p_y \\to 1$ 时它趋于 0：模型已经几乎确定会出现的 token（比如换行后的 <|im_start|>）几乎不贡献梯度。') },
        { tex: 'm_t = 0 \\;\\Rightarrow\\; m_t \\, \\frac{\\partial \\ell_t}{\\partial z_t} = 0', why: t('A masked position adds nothing to the loss, so nothing to the gradient at its logits.', '被掩掉的位置不进入 loss，它的 logits 也就拿不到梯度。') },
        { tex: '\\frac{\\partial \\ell_t}{\\partial h_s} \\neq 0, \\qquad s < t', why: t('But the answer at position $t$ attends to the prompt’s hidden states $h_s$ (prompt positions $s < t$). The answer’s loss still trains how the model *reads* the prompt; masking only removes the task of *predicting* the prompt.', '但第 $t$ 个位置的回答会通过注意力读取提示的隐藏状态 $h_s$（提示所在的位置 $s < t$）。所以回答的 loss 仍然在训练模型怎样"读"提示；掩码去掉的只是"预测提示"这项任务。') },
      ],
      blank: { line: 1, answer: 'p - e', variables: ['p', 'e'], prompt: t('Fill in the gradient of $\\ell_t$ with respect to $z_t$, using $p$ (the softmax output) and $e$ (the one-hot of the target).', '填出 $\\ell_t$ 对 $z_t$ 的梯度，用 $p$（softmax 的输出）和 $e$（目标的 one-hot）表示。') },
      outro: t('So masking the prompt does not make the model ignore it. It stops the model from spending capacity on predicting text it will never have to write.', '所以，掩掉提示并不会让模型忽略提示。它只是让模型不把能力花在预测它永远不用写的文本上。'),
    },
    // ------------------------------------------------------------------ the end token: predict, then act
    {
      id: 'stop-predict', kind: 'checkpoint', chapter: t('Learning to stop', '学会停下'), title: t('Guess first', '先猜一猜'), skill: 'chat-template', purpose: 'predict',
      prompt: t(
        'Llama 3 has no pad token, so a common shortcut sets `pad_token = eos_token` (<|eot_id|>, the end of a chat turn). The collator then sets `labels = -100` wherever `input_id == pad_token_id`. Will the model learn to stop?',
        'Llama 3 没有 pad token，一个常见的省事做法是设 `pad_token = eos_token`（也就是对话轮次的结束符 <|eot_id|>）。collator 随后把所有 `input_id == pad_token_id` 的位置设为 `labels = -100`。模型能学会停下吗？'),
      question: { type: 'choice', options: [
        { id: 'a', label: t('No: the real <|eot_id|> has the pad id too, so its label is -100 as well', '学不会：真正的 <|eot_id|> 也是这个 id，它的 label 也会被设成 -100'), correct: true },
        { id: 'b', label: t('Yes: padding only affects the end of short rows', '学得会：填充只影响短样本的尾部'), misconception: 'pad-eos-harmless' },
        { id: 'c', label: t('Yes, if it trains for more epochs', '多训几轮就学得会') },
        { id: 'd', label: t('Only with a lower learning rate', '降低学习率才学得会') },
      ] },
    },
    {
      id: 'stop-world', kind: 'explore', title: t('Why won’t it stop?', '它为什么停不下来？'), skill: 'chat-template',
      scene: vis('pad_eos_trap', { pad_is_eos: true, mask_rule: 'by_id', stop_token: 'eot' }),
      prompt: t(
        'This batch was built with pad = EOS and masking by id: <|eot_id|> is never a training target, so the model runs on. First make it **stop** by changing one setting. Then find the **other** way a fine-tuned model can fail to stop.',
        '这个 batch 是按"pad = EOS、按 id 掩码"构造的：<|eot_id|> 从来不是训练目标，所以模型一直写下去。先只改一个设置，让它**停下**。然后找出微调后的模型停不下来的**另一种**原因。'),
      setup: (scene: any, ui, _ctx, world) => {
        on_handles(ui, () => scene.attach(ui), (i) => world.emit('setting', { which: i, eos: scene.eos_count(), outcome: scene.outcome() }));
      },
      goals: [
        { id: 'stops', check: (s: any) => s.eos_count() > 0 && s.outcome() === 0, message: t('<|eot_id|> is a training target again, so the model learns to end its turn.', '<|eot_id|> 重新成了训练目标，模型学会了结束这一轮。') },
        { id: 'stop-mismatch', check: (s: any) => s.eos_count() > 0 && s.outcome() === 2, message: t('The second failure: the model ends its turn correctly, but generation waits for a different token.', '第二种失败：模型正确地结束了这一轮，但生成器在等另一个 token。') },
      ],
      detectors: [
        { id: 'fix-inference-first', on: (e) => (e.type === 'setting' && e.data!.which === 2 && e.data!.eos === 0 ? { kind: 'misconception', id: 'pad-eos-harmless', message: t('The stop token is not the problem yet: the model never learned to produce <|eot_id|>.', '问题还不在停止符：模型根本没学过输出 <|eot_id|>。') } : null) },
        { id: 'mismatch', on: (e) => (e.type === 'setting' && e.data!.outcome === 2 ? { kind: 'misconception', id: 'template-cosmetic', message: t('Training and serving must agree on the stop token.', '训练和推理必须用同一个停止符。') } : null) },
      ],
      lines: [
        { text: t('Look at the labels row: every <|eot_id|> became -100, so the count of training targets is zero.', '看 labels 那一行：每个 <|eot_id|> 都变成了 -100，训练目标的计数是 0。'), when: 'enter' },
        { text: t('Changing the stop token cannot help yet: the model never learned to emit <|eot_id|>.', '这时改停止符没有用：模型从来没学过输出 <|eot_id|>。'), when: { finding: 'pad-eos-harmless' } },
        { text: t('Now it emits the end token, but the generator is listening for a different one.', '现在模型输出了结束符，可生成器在等另一个。'), when: { finding: 'template-cosmetic' } },
        { text: t('Either fix works: a dedicated pad token, or masking by the attention mask. Both keep the real end token in the labels.', '两种修法都行：用专用的 pad token，或者按 attention mask 来掩。两者都把真正的结束符留在了 labels 里。'), when: 'goal' },
        { text: t('Try one setting at a time and watch the count of training targets.', '一次只改一个设置，盯住训练目标的计数。'), when: 'idle' },
      ],
      hints: [t('Watch the count under the batch. Which setting decides whether the real <|eot_id|> keeps its label?', '盯住 batch 下面的计数。哪个设置决定了真正的 <|eot_id|> 能不能保住它的 label？')],
      solve: (s: any, _c, w) => {
        s.pad.set_value(1);
        w.emit('setting', { which: 0, eos: s.eos_count(), outcome: s.outcome() });
        s.stop.set_value(1);
        w.emit('setting', { which: 2, eos: s.eos_count(), outcome: s.outcome() });
      },
    },
    // ------------------------------------------------------------------ packing
    {
      id: 'pack-predict', kind: 'checkpoint', chapter: t('Sharing a batch', '共用一个 batch'), title: t('Guess first', '先猜一猜'), skill: 'packing', purpose: 'predict',
      prompt: t(
        'To avoid padding, four examples of 256 tokens are concatenated into one row of 1,024 and trained with ordinary causal attention. What fraction of the attention cells lets a token look at a **different** example?',
        '为了不浪费在填充上，把四条 256 token 的样本拼成一行 1024 个 token，用普通的因果注意力训练。注意力矩阵里，让一个 token 看到**别的**样本的格子占多少？'),
      question: { type: 'choice', options: [
        { id: 'a', label: t('About 5%: only at the seams', '约 5%：只在接缝处') , misconception: 'packing-harmless' },
        { id: 'b', label: t('About 25%', '约 25%') },
        { id: 'c', label: t('About 50%', '约 50%') },
        { id: 'd', label: t('About 75%', '约 75%'), correct: true },
      ] },
      explain: t('$1 - \\frac{4 \\cdot 256 \\cdot 257}{1024 \\cdot 1025} \\approx 75\\%$: with $k$ equal pieces about $1 - 1/k$ of the cells cross examples.', '$1 - \\frac{4 \\cdot 256 \\cdot 257}{1024 \\cdot 1025} \\approx 75\\%$：$k$ 条等长样本时，约有 $1 - 1/k$ 的格子跨了样本。'),
    },
    {
      id: 'pack-world', kind: 'explore', title: t('Padding or packing?', '填充还是打包？'), skill: 'packing',
      scene: vis('attention_mask_packing', { lengths: [300, 60, 120, 40], mode: 'naive' }),
      prompt: t(
        'Drag the ends of the four examples. Padding wastes compute when lengths differ; naive packing lets examples see each other. Find (1) lengths where naive packing crosses examples in **at least 70%** of the cells, then (2) lengths where padding wastes **over half** the batch while naive packing crosses **under 40%**. Last, switch on boundaries.',
        '拖动四条样本的末端。长度不一时，填充浪费算力；直接打包又让样本互相看见。请找到：（1）直接打包时**至少 70%** 的格子跨样本的长度；（2）填充浪费**超过一半**、而直接打包跨样本**不到 40%** 的长度。最后打开按边界打包。'),
      setup: (scene: any, ui, _ctx, world) => {
        on_handles(ui, () => scene.attach(ui), () => world.emit('batch', { mode: scene.mode_index(), cross: scene.cross(), waste: scene.waste() }));
      },
      goals: [
        { id: 'equal', check: (s: any) => s.mode_index() === 1 && s.cross() >= 0.7, message: t('Equal pieces cross the most: about 1 − 1/k of the cells.', '长度越接近，跨样本的格子越多：约为 1 − 1/k。') },
        { id: 'unequal', check: (s: any) => s.waste() > 0.5 && s.cross() < 0.4, message: t('One long example and short ones: padding is at its worst, naive packing at its mildest.', '一条长的加几条短的：填充最浪费，直接打包反而最不严重。') },
        { id: 'boundaries', check: (s: any, _c, w) => s.mode_index() === 2 && !!w.state.saw_both, message: t('Boundary-aware packing: no padding and no cross-talk. position_ids restart at every example.', '按边界打包：没有填充，也不串台；position_ids 在每条样本处重新计数。') },
      ],
      detectors: [
        { id: 'naive-harm', on: (e, w) => {
          if (e.type !== 'batch') return null;
          if ((e.data!.cross as number) >= 0.7 && e.data!.mode === 1) w.state.saw_cross = true;
          if ((e.data!.waste as number) > 0.5) w.state.saw_waste = true;
          w.state.saw_both = !!(w.state.saw_cross && w.state.saw_waste);
          return e.data!.mode === 1 && (e.data!.cross as number) >= 0.6 ? { kind: 'misconception', id: 'packing-harmless' } : null;
        } },
      ],
      lines: [
        { text: t('The red, hatched cells are attention from one example into another. Make the lengths more equal and watch them grow.', '红色带斜纹的格子，是一条样本对另一条样本的注意力。把长度调得更接近，看它们怎样变多。'), when: 'enter' },
        { text: t('Most of these cells are a token reading an unrelated conversation. That is not free.', '这些格子大多是一个 token 在读一段不相干的对话。这不是没有代价的。'), when: { finding: 'packing-harmless' } },
        { text: t('Try one long example and three short ones, then switch to padding.', '试试一条长样本加三条短样本，再切到填充看看。'), when: 'idle' },
        { text: t('No waste, no cross-talk. The cost: a variable-length attention kernel, and the loss now averages over tokens rather than examples.', '既不浪费，也不串台。代价是：需要变长注意力内核，而且 loss 改成了按 token 平均，而不是按样本平均。'), when: 'goal' },
      ],
      solve: (s: any, _c, w) => {
        s.set_lengths([256, 256, 256, 256]);
        s.mode.set_value(1);
        w.emit('batch', { mode: 1, cross: s.cross(), waste: s.waste() });
        s.set_lengths([480, 16, 16, 16]);
        s.mode.set_value(0);
        w.emit('batch', { mode: 0, cross: s.cross(), waste: s.waste() });
        s.mode.set_value(2);
        w.emit('batch', { mode: 2, cross: s.cross(), waste: s.waste() });
      },
    },
    // ------------------------------------------------------------------ normalisation
    {
      id: 'normalize', kind: 'derive', chapter: t('What we divide by', '分母是什么'), title: t('Averaging over tokens', '按 token 取平均'), skill: 'loss-normalization',
      intro: t('With gradient accumulation, a batch is split into micro-batches that are processed one after another. Suppose micro-batch A has one example with 10 graded tokens and loss sum 20, and micro-batch B one example with 990 tokens and loss sum 990.', '用梯度累积时，一个 batch 被拆成几个 micro-batch，一个接一个地算。假设 micro-batch A 只有一条样本，10 个被打分的 token，loss 和为 20；micro-batch B 也只有一条，990 个 token，loss 和为 990。'),
      lines: [
        { tex: 'L = \\frac{S_A + S_B}{N_A + N_B} = \\frac{20 + 990}{10 + 990} = 1.01', why: t('The intended loss: the mean over every graded token in the batch. Each token weighs $1/1000$.', '想要的 loss：对整个 batch 里所有被打分的 token 求平均。每个 token 的权重是 $1/1000$。') },
        { tex: "L' = \\frac{1}{2}\\Big(\\frac{20}{10} + \\frac{990}{990}\\Big) = 1.5", why: t('Averaging each micro-batch first, then the averages: what many training loops (including Hugging Face’s) did until October 2024.', '先对每个 micro-batch 求平均，再平均这些平均数：2024 年 10 月之前，很多训练循环（包括 Hugging Face 的）都是这么算的。') },
        { tex: "w_A: \\;\\tfrac{1}{1000} \\to \\tfrac{1}{2 \\cdot 10} = \\tfrac{1}{20}", why: t('The weight $w_A$ of each token in A goes from $1/1000$ to $1/20$: the short example’s tokens are boosted fifty times. The fix: count all graded tokens of the window first and divide every micro-batch’s sum by that one number.', 'A 里每个 token 的权重 $w_A$ 从 $1/1000$ 变成了 $1/20$：短样本的 token 被放大了 50 倍。修法：先数出整个累积窗口里被打分的 token 总数，再用这个数去除每个 micro-batch 的 loss 和。') },
        { tex: '\\frac{1}{B\\,N_i} \\qquad \\longleftrightarrow \\qquad \\frac{1}{\\sum_i N_i}', why: t('A related choice, the weight of one token of example $i$ (left: averaging per example; right: per token). Per example gives every example equal weight; per token gives long answers more. Packing silently switches you to per-token weighting.', '一个相关的选择：样本 $i$ 里一个 token 的权重（左边按样本平均，右边按 token 平均）。按样本平均，每条样本分量相同；按 token 平均，回答长的样本分量更大。打包会悄悄把你切换到按 token 加权。') },
      ],
      blank: { line: 0, answer: '1.01', prompt: t('What is the token-mean loss of this batch?', '这个 batch 按 token 平均的 loss 是多少？') },
      outro: t('Tülu 3 uses a plain sum instead of a mean, so that every token counts the same regardless of how the batch was split; the learning rate then has to account for the number of tokens per batch.', 'Tülu 3 干脆用求和而不是平均，这样不管 batch 怎么拆，每个 token 的分量都一样；代价是学习率要考虑每个 batch 的 token 数。'),
    },
    {
      id: 'packing-practice', kind: 'read', title: t('Packing and averaging in practice', '实践中的打包与平均'),
      blocks: [
        { type: 'p', text: t('The averaging bug was in widely used trainers until it was fixed in October 2024[^ga]; Tülu 3 sidesteps the question with a sum loss[^tulu].', '那个平均的 bug 一直存在于常用的训练框架里，直到 2024 年 10 月才修复[^ga]；Tülu 3 干脆用求和 loss 绕开这个问题[^tulu]。') },
        { type: 'cite', key: 'ga', text: t('Hugging Face blog (2024). Fixing gradient accumulation.', 'Hugging Face 博客（2024）。Fixing gradient accumulation。'), url: 'https://huggingface.co/blog/gradient_accumulation' },
        { type: 'cite', key: 'tulu', text: t('Lambert et al. (2024). Tülu 3: Pushing Frontiers in Open Language Model Post-Training.', 'Lambert 等（2024）。Tülu 3: Pushing Frontiers in Open Language Model Post-Training。'), url: 'https://arxiv.org/abs/2411.15124' },
        { type: 'cite', key: 'pack', text: t('Hugging Face blog (2024). Improving hugging face training efficiency through packing with Flash Attention 2.', 'Hugging Face 博客（2024）。Packing with Flash Attention 2。'), url: 'https://huggingface.co/blog/packing-with-FA2' },
        { type: 'p', text: t('Boundary-aware packing kept validation loss unchanged and raised throughput about 2× on FLAN and 1.4× on OrcaMath[^pack].', '按边界打包时，验证 loss 不变，吞吐在 FLAN 上提高约 2 倍，在 OrcaMath 上约 1.4 倍[^pack]。') },
        { type: 'figure', src: 'ft/b/b1-packing.svg', alt: t('Padding, naive packing and boundary-aware packing of four sequences, with throughput bars.', '四条序列的填充、直接打包、按边界打包三种布局，以及吞吐对比柱。'), caption: t('Layouts are exact; throughput from the Hugging Face blog.', '布局为精确计算；吞吐数据来自 Hugging Face 博客。'), credit: 'Layouts exact; throughput after the Hugging Face blog “Packing with FlashAttention 2” (2024), approximate · 布局为精确计算；吞吐据 Hugging Face 博客（2024），数值近似' },
      ],
    },
    // ------------------------------------------------------------------ code
    {
      id: 'code', kind: 'code', chapter: t('In code', '写成代码'), title: t('A masked, correctly averaged SFT step', '一个掩码正确、平均正确的 SFT 训练步'),
      intro: t('The whole lesson in thirty lines of PyTorch: build labels, shift by one, sum the masked cross-entropy, and divide by the token count of the whole accumulation window.', '这节课的全部内容，用三十行 PyTorch 写出来：构造 labels，错开一位，对掩码后的交叉熵求和，再除以整个累积窗口的 token 数。'),
      lang: 'python', code: MASKED_LOSS,
      notes: [
        { lines: [4, 4], text: t('-100 is the label PyTorch’s cross-entropy skips: this is the mask $m_t = 0$.', '-100 是 PyTorch 交叉熵会跳过的 label：这就是掩码 $m_t = 0$。') },
        { lines: [6, 10], text: t('Keep only the tokens the assistant should learn to produce, including its end-of-turn token.', '只保留助手应该学会说出的 token，包括它的轮次结束符。'), shapes: 'input_ids, labels: [B, T]' },
        { lines: [13, 16], text: t('Position $t$ predicts token $t+1$, so logits and targets are shifted against each other.', '第 $t$ 个位置预测第 $t+1$ 个 token，所以 logits 和目标要错开一位。'), shapes: 'logits: [B, T-1, V]  targets: [B, T-1]' },
        { lines: [17, 18], text: t('Sum, not mean: we decide the denominator ourselves.', '用求和，不用平均：分母由我们自己决定。') },
        { lines: [23, 27], text: t('Count the graded tokens of the whole window before the first backward pass, then divide every micro-batch by that same number.', '在第一次反向传播之前，先数出整个窗口里被打分的 token 数，再让每个 micro-batch 都除以这同一个数。') },
      ],
    },
    {
      id: 'checklist', kind: 'read', title: t('Before you press train', '开训之前检查一遍'),
      blocks: [
        { type: 'list', ordered: true, items: [
          t('Print the first batch as `token | label` pairs. The answer’s closing end token must have a real label, not -100.', '把第一个 batch 打印成"token | label"对照表。回答结尾的结束 token 必须有真正的 label，不能是 -100。'),
          t('Use the model’s own chat template, and the same one at serving time; set `eos_token` / `generation_config.eos_token_id` to the end-of-turn token.', '用模型自己的聊天模板，推理时也用同一个；把 `eos_token` 和 `generation_config.eos_token_id` 设成轮次结束 token。'),
          t('New special tokens need trained embedding and output rows (PEFT: `modules_to_save=["embed_tokens", "lm_head"]` or `trainable_token_indices`). Some base models ship template tokens that were never trained: Llama 3 base is one[^unsloth].', '新增的特殊 token 需要训练对应的嵌入行和输出行（PEFT：`modules_to_save=["embed_tokens", "lm_head"]` 或 `trainable_token_indices`）。有些基座模型自带的模板 token 从没被训练过，Llama 3 基座就是一例[^unsloth]。'),
          t('Pack with boundaries, and average the loss over tokens across the whole accumulation window.', '按边界打包，并在整个累积窗口上按 token 平均 loss。'),
        ] },
        { type: 'code', lang: 'python', label: 'TRL', code: TRL_CONFIG, caption: t('The same choices in TRL (v1.15 names; check them against your version).', '同样的选择在 TRL 里怎么写（v1.15 的参数名；以你所用版本的文档为准）。') },
        { type: 'cite', key: 'unsloth', text: t('Unsloth blog (2024). Llama 3: untrained tokens in the base model.', 'Unsloth 博客（2024）。Llama 3 基座中未训练的 token。'), url: 'https://unsloth.ai/blog/llama3' },
      ],
    },
    // ------------------------------------------------------------------ checks
    {
      id: 'q-accum', kind: 'checkpoint', chapter: t('Check', '检验'), title: t('Average it right', '平均要算对'), skill: 'loss-normalization', purpose: 'check',
      prompt: t('Two micro-batches are accumulated. A: 2 examples, 30 graded tokens, loss sum 60. B: 1 example, 270 graded tokens, loss sum 270. What is the token-mean loss of the batch?', '累积两个 micro-batch。A：2 条样本，30 个被打分的 token，loss 和 60。B：1 条样本，270 个 token，loss 和 270。这个 batch 按 token 平均的 loss 是多少？'),
      question: { type: 'number', answer: 1.1, tolerance: 0.005, wrong: [
        { answer: 1.5, misconception: 'mean-of-means', feedback: t('That averages the two micro-batch means (2.0 and 1.0). Each token of A would weigh 1/60 instead of 1/300, five times too much.', '这是把两个 micro-batch 的平均数（2.0 和 1.0）再平均。A 的每个 token 权重变成 1/60，而不是 1/300，大了 5 倍。') },
        { answer: 2, feedback: t('That is micro-batch A alone. Pool the sums and the token counts of both.', '这只是 A 一个 micro-batch。把两者的 loss 和与 token 数都加起来。') },
      ] },
      explain: t('$330 / 300 = 1.10$.', '$330 / 300 = 1.10$。'),
    },
    {
      id: 'q-diagnose', kind: 'checkpoint', title: t('Nothing learned', '什么也没学会'), skill: 'loss-mask', purpose: 'check',
      prompt: t('"The training loss falls steadily, but the model answers almost exactly as before, and often does not stop." Which two causes are most likely?', '"训练 loss 一直在降，但模型的回答和训练前几乎一样，而且经常停不下来。"最可能是哪两个原因？'),
      question: { type: 'choice', options: [
        { id: 'a', label: t('Loss on the prompt, and the end token masked', '在提示上算了 loss，并且结束 token 被掩掉了'), correct: true, feedback: t('The loss falls because the model memorises the long, repeated prompt; it never trains the answer or the end token. Check: print `token | label` for one batch.', 'loss 在降，是因为模型背下了那段又长又重复的提示；回答和结束 token 都没被训练到。检查办法：打印一个 batch 的"token | label"。') },
        { id: 'b', label: t('Learning rate too high, and too few epochs', '学习率太大，轮数太少'), feedback: t('A learning rate that is too high shows up as spikes, not as a smooth fall with no change in behaviour.', '学习率太大表现为尖刺，而不是 loss 平稳下降、行为却没变。') },
        { id: 'c', label: t('The model is too small, and the data too clean', '模型太小，数据太干净') },
        { id: 'd', label: t('Packing with boundaries, and LoRA', '按边界打包，以及用了 LoRA') },
      ] },
    },
    {
      id: 'q-weight', kind: 'checkpoint', title: t('Pick the prompt weight', '选一个提示权重'), skill: 'loss-mask', purpose: 'check',
      prompt: t('A dataset has 2,000 examples with 400-token instructions and one-word answers, and you will evaluate on multiple-choice questions. Which prompt-loss weight would you try first against a held-out set, and why?', '一个数据集有 2000 条样本，指令长 400 token，回答只有一个词，最后用选择题评测。你会先拿哪个提示损失权重去和留出集比较？为什么？'),
      question: { type: 'choice', options: [
        { id: 'a', label: '0', feedback: t('A sensible default, but on short-completion data with a multiple-choice evaluation, a small positive weight did better in the study.', '是合理的默认值；但在短回答数据、选择题评测的情况下，研究里小的正权重表现更好。'), misconception: 'mask-dogma' },
        { id: 'b', label: '0.1', correct: true, feedback: t('Short completions, little data, a short-answer evaluation: the setting where a small weight helped. Compare it with 0 on held-out data.', '回答短、数据少、评测也是短答案：正是小权重有帮助的那种情况。拿它和 0 在留出集上比一比。') },
        { id: 'c', label: '1', feedback: t('A weight near 1 did better on long-generation benchmarks, not on short-answer ones.', '接近 1 的权重在长文本生成基准上更好，在短答案基准上不是。') },
      ] },
    },
    {
      id: 'q-explain', kind: 'checkpoint', title: t('Explain it', '解释一下'), skill: 'loss-mask', purpose: 'check',
      prompt: t('With the prompt masked, are the model’s weights still trained on the prompt in any way? Explain in one or two sentences.', '提示被掩掉以后，模型的权重还会以某种方式在提示上被训练吗？用一两句话解释。'),
      question: { type: 'text', placeholder: t('Yes or no, and through what…', '会还是不会，通过什么……'), rubric: {
        key_points: [
          t('Yes: the answer’s tokens attend to the prompt, so the answer’s loss sends gradient back through the prompt positions.', '会：回答的 token 通过注意力读取提示，所以回答的 loss 会把梯度传回提示所在的位置。'),
          t('What masking removes is only the task of predicting the prompt’s own next tokens.', '掩码去掉的，只是"预测提示本身的下一个 token"这项任务。'),
        ],
        model_answer: t('Yes. The answer attends to the prompt’s hidden states, so the answer’s loss trains how the model reads the prompt. Masking only removes the loss on predicting the prompt’s own tokens.', '会。回答会通过注意力读取提示的隐藏状态，所以回答的 loss 在训练模型怎样读提示。掩码去掉的只是预测提示本身 token 的那部分 loss。'),
        min_points: 1,
      } },
    },
    // ------------------------------------------------------------------ how to choose
    {
      id: 'choose', kind: 'read', chapter: t('How to choose', '怎么选'), title: t('When SFT is the tool', '什么时候用 SFT'),
      blocks: choose_card({
        upto: 'B1', highlight: 'B1,B2,K4', card: 'B1',
        rule: t('If the model must **reliably** follow a format, style or procedure that prompting cannot hold (or only with a very long prompt), use SFT, with the same template and stop token at training and serving, and training inputs built exactly like live requests (retrieved passages, tool definitions). With long prompts, short answers and little data, try a small prompt-loss weight.', '如果模型必须**稳定地**遵循某种格式、风格或流程，而提示词做不到（或者只能靠很长的提示），就用 SFT。训练和推理用同一个模板、同一个停止符，训练样本的构造方式也要和线上请求完全一致（检索到的段落、工具定义）。提示长、回答短、数据少时，试一个小的提示损失权重。'),
        counter: t('Fine-tuning for a JSON format that one system prompt plus structured output already produces reliably: an expensive fix for a cheap problem. Likewise, "teach the model this month’s prices" is not an SFT problem (A2, B2).', '为了一个靠一条系统提示加结构化输出就能稳定得到的 JSON 格式去微调：用昂贵的手段解决便宜的问题。同理，"让模型记住这个月的价格"也不是 SFT 该解决的问题（A2、B2）。'),
      }),
    },
  ],
};
