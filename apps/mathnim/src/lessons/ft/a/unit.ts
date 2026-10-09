// Part A of the fine-tuning course: the map, and RAG (A2b is optional).
import type { CourseLesson, Unit } from '../../../course';
import { lesson as a1 } from './a1';
import { lesson as a2 } from './a2';
import { lesson as a2b } from './a2b';
import { T } from '../f/kit';

export const lessons: CourseLesson[] = [
  {
    id: a1.id, lesson: a1, minutes: 35, thumb: 'map',
    title: T('Five ways to make a model do something', '让模型做事的五种办法'),
    summary: T('When not to fine-tune, context vs weights, the signal that picks the method, and when a fine-tuned model really saves money.', '什么时候不该微调；上下文与权重；手里的信号如何决定方法；微调什么时候真的省钱。'),
    level: T('knows neural networks', '懂神经网络'),
  },
  {
    id: a2.id, lesson: a2, minutes: 30, thumb: 'pipeline',
    title: T('RAG: put the knowledge into the context', 'RAG：把知识放进上下文'),
    summary: T('Embeddings, keywords and fusion; chunk size under a budget on real retrieval runs; reranking; measuring retrieval; where RAG fails.', '向量、关键词与融合；用真实检索结果看预算下的块大小；重排；评测检索；RAG 在哪里失败。'),
    level: T('knows neural networks', '懂神经网络'),
  },
  {
    id: a2b.id, lesson: a2b, minutes: 15, thumb: 'push-world',
    title: T('Fine-tuning the retriever (optional)', '微调检索器（选学）'),
    summary: T('Which part of RAG to tune, the contrastive loss and its gradient, and the false negatives that quietly hurt it.', '该微调 RAG 的哪一部分；对比损失及其梯度；悄悄伤害它的假负例。'),
    level: T('knows neural networks', '懂神经网络'),
  },
];

export const unit: Unit = { id: 'ft-a', title: T('Fine-tuning A · The map and RAG', '微调 A · 地图与 RAG'), lessons };
