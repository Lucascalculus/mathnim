// Part B of the fine-tuning course: imitation (SFT). The main session registers
// this unit in course.ts and imports packages/visuals/src/ft/b (its visuals).
import { lesson as b1 } from './b1_sft_mechanics';
import { lesson as b2 } from './b2_data_sources';
import { lesson as b3 } from './b3_training_and_eval';
import { lesson as b4 } from './b4_forgetting';

export const unit = {
  id: 'ft-b',
  title: { en: 'B · Imitation: supervised fine-tuning', zh: 'B · 模仿：监督微调（SFT）' },
  lessons: [
    { id: b1.id, title: { en: 'SFT: the same loss, aimed at the right tokens', zh: 'SFT：同一个损失，对准该学的 token' }, summary: { en: 'Chat templates, loss masks, the end token, packing and averaging: what decides what SFT learns.', zh: '聊天模板、损失掩码、结束 token、打包与平均：是什么决定了 SFT 学到什么。' }, lesson: b1, minutes: 33, level: 'knows neural networks', thumb: 'mask-world' },
    { id: b2.id, title: { en: 'Where SFT data comes from', zh: 'SFT 的数据从哪来' }, summary: { en: 'People, stronger models, the model itself, teachers and raw text: synthetic data, rejection sampling, distillation, continued pretraining, tool-calling data.', zh: '人工、强模型、模型自己、老师模型、原始文本：合成数据、拒绝采样、蒸馏、继续预训练、工具调用数据。' }, lesson: b2, minutes: 35, level: 'knows neural networks', thumb: 'rs-world' },
    { id: b3.id, title: { en: 'Training curves and evaluation', zh: '训练曲线与评测' }, summary: { en: 'Why a lower loss is not a better model, reading curves, evaluation layers, LLM judges and how noisy one eval is.', zh: '为什么 loss 更低不等于更好，怎样读曲线，评测的四层、大模型评委，以及一次评测的噪声有多大。' }, lesson: b3, minutes: 30, level: 'knows neural networks', thumb: 'noise-world' },
    { id: b4.id, title: { en: 'Forgetting', zh: '遗忘' }, summary: { en: 'Why fine-tuning breaks old abilities, what predicts how much (KL to the base model), and how to limit it.', zh: '微调为什么会弄坏原有能力，什么能预测忘多少（相对基座的 KL），以及怎样减少遗忘。' }, lesson: b4, minutes: 22, level: 'knows neural networks', thumb: 'valleys' },
  ],
};
