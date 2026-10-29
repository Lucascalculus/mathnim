// Part E of the fine-tuning course: reasoning (RLVR, the R1 recipe) and
// distillation. The main session registers this unit in course.ts; the
// visuals come from packages/visuals/src/ft/e (and ppo_clip from ft/d,
// decision_map from ft/f).
import type { L10n } from '@mathnim/core';
import type { CourseLesson } from '../../../course';
import { lesson as e1 } from './e1';
import { lesson as e2 } from './e2';
import { lesson as e3 } from './e3';
import { t } from './common';

export const unit: { id: string; title: L10n; lessons: CourseLesson[] } = {
  id: 'ft-e-reasoning',
  title: t('Reasoning and distillation', '推理与蒸馏'),
  lessons: [
    {
      id: e1.id, lesson: e1, minutes: 30, thumb: 'w-flip',
      title: e1.title,
      summary: t('When a program can check the answer: sample a group, compare each try with the group\'s average, fix what breaks (zero-variance groups, length bias), and write a grader that cannot be gamed.', '答案能用程序检查时：采样一组，每次尝试和组平均比，修好会出的毛病（零方差组、长度偏差），再写一个不容易被钻空子的评分器。'),
      level: t('knows neural networks; D2a (policy gradient, PPO), D2b (the KL leash)', '懂神经网络；学过 D2a（策略梯度、PPO）和 D2b（KL 约束）'),
    },
    {
      id: e2.id, lesson: e2, minutes: 31, thumb: 'w-passk',
      title: e2.title,
      summary: t('How DeepSeek-R1 was built and why each stage is there; outcome vs process rewards; measuring with pass@k; whether RL teaches or sharpens; running RL in practice.', 'DeepSeek-R1 是怎么训出来的，每个阶段为什么存在；结果奖励与过程奖励；用 pass@k 衡量；强化学习是教会还是磨尖；实际跑强化学习要注意什么。'),
      level: t('E1', '学过 E1'),
    },
    {
      id: e3.id, lesson: e3, minutes: 31, thumb: 'w-kl',
      title: e3.title,
      summary: t('Three ways to learn from a teacher, why the KL direction matters, on-policy and multi-teacher distillation, when distillation beats RL, merging in brief, and forgetting.', '向老师学的三种方式，KL 方向为什么重要，在线蒸馏与多老师蒸馏，蒸馏什么时候胜过强化学习，简讲模型合并，以及遗忘。'),
      level: t('E1; B2 (sequence-level distillation)', '学过 E1；B2（序列级蒸馏）'),
    },
  ],
};
