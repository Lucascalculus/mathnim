// Part F of the fine-tuning course: choosing. F0 is a ten-minute practice
// meant to sit right after part B (exported on its own as `midway`); F1 is the
// capstone at the end of the course.
import type { CourseLesson, Unit } from '../../../course';
import { lesson as f0 } from './f0';
import { lesson as f1 } from './f1';
import { T } from './kit';

/** Place after part B (it uses only the routes known by then). */
export const midway: CourseLesson = {
  id: f0.id, lesson: f0, minutes: 10, thumb: 'map',
  title: T('Choosing, halfway', '中场选择练习'),
  summary: T('Five short cases with the routes you know so far: context, RAG, an encoder classifier, SFT, continued pretraining.', '用目前学过的几条路练习选择：上下文、RAG、编码器分类模型、SFT、继续预训练。'),
  level: T('after part B', '学完 B 部分之后'),
};
export const capstone: CourseLesson = {
  id: f1.id, lesson: f1, minutes: 35, thumb: 'map',
  title: T('Choosing: the decision map and cases', '怎么选：决策框架与案例研讨'),
  summary: T('The whole course as one decision map, used on eleven kinds of real projects - from the need to the method, data, risks and evaluation.', '把整门课收成一张决策图，用在十一类真实项目上：从需求推到方法、数据、风险和评测。'),
  level: T('end of the course', '课程最后'),
};
export const lessons: CourseLesson[] = [midway, capstone];
export const unit: Unit = { id: 'ft-f', title: T('Fine-tuning F · How to choose', '微调 F · 怎么选'), lessons };
