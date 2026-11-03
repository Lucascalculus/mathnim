#!/usr/bin/env python3
# Builds the COMP90049 course (README.md here): every lesson of the l_*.py files as Mathnim lesson JSON in
# apps/mathnim/public/demo/comp90049/, and its entry in apps/mathnim/public/demo/courses.json.
#   python3 docs/lessons/comp90049/build.py && node apps/mathnim/tools/demo_check.mjs comp90049
# Several writers run this at once while the course is made, so a lesson file that fails to import is skipped
# with a message, and every file is written whole (to a temporary name, then renamed).
import glob
import importlib
import json
import os
import sys
import tempfile
import traceback

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, '..', '..', '..'))
DEMO = os.path.join(ROOT, 'apps', 'mathnim', 'public', 'demo')
sys.path.insert(0, HERE)
from ml_kit import *  # noqa: E402,F403

UNITS = [
    (T('Foundations', '基础'), ['start', 'concepts', 'probability']),
    (T('Classic classifiers', '经典分类器'), ['knn', 'trees', 'naive-bayes']),
    (T('Linear models', '线性模型'), ['linreg', 'logreg', 'svm']),
    (T('Evaluation and features', '评估与特征'), ['evaluation', 'bias-variance', 'features']),
    (T('Neural networks and ensembles', '神经网络与集成'), ['perceptron', 'mlp', 'backprop', 'ensembles']),
    (T('Beyond supervised learning', '监督学习之外'), ['clustering', 'semi', 'self', 'anomaly', 'fairness']),
    (T('Before the exam', '考前'), ['drill']),
]


def write_json(path, data, **kw):
    fd, tmp = tempfile.mkstemp(dir=os.path.dirname(path), suffix='.tmp')
    with os.fdopen(fd, 'w', encoding='utf8') as f:
        json.dump(data, f, ensure_ascii=False, **kw)
    os.replace(tmp, path)


def build():
    out_dir = os.path.join(DEMO, CID)
    os.makedirs(out_dir, exist_ok=True)
    made = {}
    for file in sorted(glob.glob(os.path.join(HERE, 'l_*.py'))):
        name = os.path.basename(file)[:-3]
        try:
            makers = importlib.import_module(name).LESSONS
            lessons = [make() for make in makers]
        except Exception:
            print(f'skipped {name}.py:\n{traceback.format_exc(limit=3)}')
            continue
        for L in lessons:
            made[L['id']] = L
    placed = {lid(s) for _, slugs in UNITS for s in slugs}
    for x in sorted(set(made) - placed):
        print(f'not in a unit (add its slug to UNITS): {x}')
    entries, units = [], []
    for title, slugs in UNITS:
        ids = [lid(s) for s in slugs if lid(s) in made]
        if ids:
            units.append({'title': title, 'lessons': ids})
        for i in ids:
            L = made[i]
            lesson = {'id': i, 'mode': 'essay', 'title': L['title'], 'description': L['description'], 'minutes': L['minutes'],
                      'skills': L['skills'], 'misconceptions': L.get('misconceptions', []), 'steps': L['steps']}
            write_json(os.path.join(out_dir, f'{i}.json'), lesson, separators=(',', ':'))
            entries.append({'id': i, 'title': L['title'], 'summary': L['description'], 'minutes': L['minutes'],
                            'meta': {'title': L['title'], 'mode': 'essay', 'langs': ['en', 'zh'], 'has_scene': False,
                                     'kinds': sorted({s['kind'] for s in L['steps']}), 'skills': L['skills']}})
    course = {
        'id': CID,
        'title': T('Introduction to Machine Learning, in depth', '机器学习导论 · 深入过一遍'),
        'summary': T('Concepts and probability, k-NN, decision trees, naive Bayes, linear and logistic regression, SVMs, evaluation and the bias-variance trade-off, feature selection, perceptrons, neural networks and backpropagation, ensembles, clustering, semi- and self-supervised learning, anomaly detection, fairness',
                     '基本概念与概率、k 近邻、决策树、朴素贝叶斯、线性回归与逻辑回归、SVM、评估与偏差-方差、特征选择、感知机、神经网络与反向传播、集成学习、聚类、半监督与自监督、异常检测、公平性'),
        'audience': T('Students who have met machine learning before and want to review COMP90049 for the exam: every topic once, with the derivations done properly.',
                      '学过机器学习、要为 COMP90049 期末复习的同学：每个话题过一遍，公式推导做扎实。'),
        'outcomes': [T('Explain and compare every method of the subject in a few lines, the way Section A asks', '用几行话解释和比较这门课的每个方法，正是 A 部分的考法'),
                     T('Do the calculations of Section B by hand: entropy and information gain, naive Bayes, distances, gradient and backpropagation steps, metrics, PMI, clustering', '手算 B 部分的计算：熵与信息增益、朴素贝叶斯、距离、梯度与反向传播、评估指标、PMI、聚类'),
                     T('Derive the key results yourself and choose and justify a method for a new problem (Section C)', '自己推出关键结论，并为新问题选择方法、说出理由（C 部分）')],
        'lang': 'zh', 'mine': False, 'public': True, 'ready': True,
        'origin': {'decks': 21, 'exams': 0, 'note': T('Written by an AI (Claude) from the 21 lecture decks of COMP90049 (Semester 2, 2026) and standard textbooks · not edited by a person',
                                                       '由 AI（Claude）根据 COMP90049（2026 年第二学期）的 21 份课件和标准教材编写 · 未经人工修改')},
        'units': units, 'lessons': entries, 'demo': True,
    }
    path = os.path.join(DEMO, 'courses.json')
    with open(path, encoding='utf8') as f:
        courses = json.load(f)
    courses = [c for c in courses if c.get('id') != CID] + [course]
    write_json(path, courses, indent=1)
    print(f'{len(entries)} lessons -> {out_dir}; courses.json has {len(courses)} courses')


if __name__ == '__main__':
    build()
