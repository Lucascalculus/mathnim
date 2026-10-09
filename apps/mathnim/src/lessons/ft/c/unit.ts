// Part C of the fine-tuning course: making it fit (memory, LoRA, QLoRA and
// serving). The main session registers this unit in course.ts and imports
// packages/visuals/src/ft/c (its visuals); the lessons share helpers with part B.
import { lesson as c1 } from './c1_memory';
import { lesson as c2 } from './c2_lora';
import { lesson as c3 } from './c3_qlora_serving';

export const unit = {
  id: 'ft-c',
  title: { en: 'C · Making it fit: memory, LoRA, QLoRA', zh: 'C · 装得下：显存、LoRA、QLoRA' },
  lessons: [
    { id: c1.id, title: { en: 'The memory budget', zh: '显存账' }, summary: { en: 'What fine-tuning keeps on the GPU, how to estimate it, and which trick saves which part.', zh: '微调时显存里放了什么，怎样估算，哪种技巧省哪一块。' }, lesson: c1, minutes: 30, level: 'knows neural networks', thumb: 'budget-world' },
    { id: c2.id, title: { en: 'LoRA: learn a low-rank correction', zh: 'LoRA：只学一个低秩的修正' }, summary: { en: 'Freeze the model, learn ΔW = BA: the geometry, the parameter count, a real update’s spectrum, configuration, and when it falls short.', zh: '冻结模型，只学 ΔW = BA：几何直觉、参数量、真实改动的奇异值谱、配置，以及什么时候不够用。' }, lesson: c2, minutes: 35, level: 'knows neural networks; eigen–PCA lesson', thumb: 'lowrank-world' },
    { id: c3.id, title: { en: 'QLoRA and shipping adapters', zh: 'QLoRA 与上线' }, summary: { en: 'NF4, blockwise scales and double quantisation; merging and serving many adapters; QLoRA vs PTQ vs QAT.', zh: 'NF4、按块缩放与双重量化；合并与多适配器服务；QLoRA、PTQ 与 QAT 的区别。' }, lesson: c3, minutes: 32, level: 'knows neural networks', thumb: 'quant-world' },
  ],
};
