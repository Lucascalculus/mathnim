// Part D of the fine-tuning course: preference optimization. The main session
// registers this unit in course.ts and imports packages/visuals/src/ft/d (its
// visuals: bradley_terry_fit, pg_baseline, ppo_clip, kl_leash_policy,
// dpo_gap_plane). Figures are in public/ft/d (made by tools/ft-data/d/make_figures.py).
import type { CourseLesson } from '../../../course';
import { lesson as d1 } from './d1';
import { lesson as d2a } from './d2a';
import { lesson as d2b } from './d2b';
import { lesson as d3 } from './d3';
import { lesson as d4 } from './d4';

export const unit: { id: string; title: { en: string; zh: string }; lessons: CourseLesson[] } = {
  id: 'ft-d',
  title: { en: 'D · Preferences: from reward models to DPO', zh: 'D · 偏好：从奖励模型到 DPO' },
  lessons: [
    { id: d1.id, title: d1.title, summary: { en: 'What imitation cannot say, how "A is better than B" becomes a reward (Bradley–Terry), and where reward signals come from in practice.', zh: '模仿说不出来的东西，"A 比 B 好"怎样变成奖励（Bradley–Terry），以及实践中奖励信号从哪来。' }, lesson: d1, minutes: 30, level: 'knows neural networks', thumb: 'league' },
    { id: d2a.id, title: d2a.title, summary: { en: 'Training on a score you cannot differentiate: REINFORCE, the baseline, and PPO’s ratio and clipping - the pieces GRPO is built from.', zh: '用一个不能求导的分数来训练：REINFORCE、基线，以及 PPO 的概率比和截断——GRPO 正是由这些部件搭成的。' }, lesson: d2a, minutes: 30, level: 'knows neural networks', thumb: 'clip-world' },
    { id: d2b.id, title: d2b.title, summary: { en: 'Why a learned reward needs a leash, the exact optimum of reward − β·KL, reward hacking you can watch, and what RLHF costs.', zh: '为什么学来的奖励需要缰绳，"奖励 − β·KL"的精确最优解，看得见的奖励投机，以及 RLHF 的代价。' }, lesson: d2b, minutes: 28, level: 'knows neural networks', thumb: 'leash' },
    { id: d3.id, title: d3.title, summary: { en: 'DPO derived from the KL optimum, what its gradient does, and why the chosen answer can lose probability while the loss falls.', zh: '从 KL 最优解推出 DPO，它的梯度在做什么，以及为什么损失在降、被选回答却可能失去概率。' }, lesson: d3, minutes: 34, level: 'knows neural networks', thumb: 'gap' },
    { id: d4.id, title: d4.title, summary: { en: 'The variants in one table, building preference pairs that teach the right thing, offline versus iterative, and choosing between SFT, DPO and RLVR.', zh: '变体一张表看完，造出教对东西的偏好对，离线与迭代，以及在 SFT、DPO、RLVR 之间怎么选。' }, lesson: d4, minutes: 32, level: 'knows neural networks' },
  ],
};
