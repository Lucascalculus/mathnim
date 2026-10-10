// Recorded text-only answers: questions that words answer well, with no
// picture. Offline (no API key) MockProvider serves them, streamed into the
// "Explain this" chat like a live answer, so the chat can be tried and shown
// without a model. Each answer exists in both course languages; a question in
// one language gets the answer in that language.

export interface RecordedText {
  /** The lesson (and step) whose suggestions offer the question. */
  lesson: string;
  step?: string;
  question: { en: string; zh: string };
  answer: { en: string; zh: string };
  followups?: { en: string; zh: string }[];
}

export const RECORDED_TEXT: RecordedText[] = [
  {
    lesson: 'ft-c2-lora', step: 'why',
    question: { en: 'What shapes are A and B, and why is it called low-rank?', zh: 'A 和 B 分别是什么形状？为什么叫“低秩”？' },
    answer: {
      en: '$A$ is $r \\times k$ and $B$ is $d \\times r$, so $BA$ is $d \\times k$: the same size as $W_0$, so it can be added to it. But every column of $BA$ is a combination of the $r$ columns of $B$, so **its rank is at most $r$**, and $r$ is far smaller than $d$ and $k$. Only $r(d+k)$ numbers are trained instead of $dk$.',
      zh: '$A$ 是 $r \\times k$，$B$ 是 $d \\times r$，乘起来 $BA$ 是 $d \\times k$，和 $W_0$ 一样大，所以能直接加上去。但 $BA$ 的每一列都是 $B$ 那 $r$ 列的组合，所以**它的秩最多是 $r$**，而 $r$ 远小于 $d$ 和 $k$，这就是“低秩”。要训练的数只有 $r(d+k)$ 个，而不是 $dk$ 个。',
    },
    followups: [
      { en: 'How many parameters is that for a 4096 × 4096 layer with r = 8?', zh: '一个 4096 × 4096 的层、r = 8 时是多少参数？' },
    ],
  },
  {
    lesson: 'ft-c2-lora', step: 'why',
    question: { en: 'Why freeze W₀ instead of training it?', zh: '为什么要冻结 W₀，而不是直接训练它？' },
    answer: {
      en: 'Training $W_0$ means keeping a gradient and two Adam states for every one of its parameters: about 16 bytes each, as C1 counted. With $W_0$ frozen, that cost falls only on $A$ and $B$, usually under 1% of the parameters. **What is saved is gradient and optimizer memory**: $W_0$ itself stays in memory and is used in every forward pass.',
      zh: '训练 $W_0$，就要为它的每个参数存梯度和 Adam 的两份状态，C1 算过，一个参数约 16 字节。冻结 $W_0$ 后，这笔开销只落在 $A$ 和 $B$ 上，它们通常不到总参数的 1%。**省下的是梯度和优化器的显存**；$W_0$ 本身还在显存里，每次前向都要用。',
    },
  },
];

/** The recorded text answers keyed by normalised question (both languages), for MockProvider. */
export function recorded_text_answers(key: (q: string) => string): Record<string, { text: string; followups: string[] }> {
  const out: Record<string, { text: string; followups: string[] }> = {};
  for (const r of RECORDED_TEXT) {
    for (const lang of ['en', 'zh'] as const) out[key(r.question[lang])] = { text: r.answer[lang], followups: (r.followups ?? []).map((f) => f[lang]) };
  }
  return out;
}
