#!/usr/bin/env python3
# Builds the MGMT90141 demo course (README.md here): 17 lessons as Mathium lesson JSON in
# apps/mathnim/public/demo/mgmt90141/, and its entry in apps/mathnim/public/demo/courses.json.
#   python3 docs/lessons/mgmt90141/build.py && node apps/mathnim/tools/demo_check.mjs mgmt90141
import importlib
import json
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
from common import CID, T  # noqa: E402

ROOT = os.path.abspath(os.path.join(HERE, '..', '..', '..'))
DEMO = os.path.join(ROOT, 'apps', 'mathnim', 'public', 'demo')

# (module, function, unit title)
ORDER = [
    ('l01_lp_picture', 'L_lp_picture'), ('l02_lp_formulate', 'L_lp_formulate'), ('l03_lp_report', 'L_lp_report'),
    ('l04_lp_patterns', 'L_lp_patterns'), ('l05_network', 'L_network'), ('l06_integer', 'L_integer'),
    ('l07_describe', 'L_describe'), ('l08_chances', 'L_chances'),
    ('l09_payoff', 'L_payoff'), ('l10_expected', 'L_expected'), ('l11_sample_info', 'L_sample_info'),
    ('l12_random', 'L_random'), ('l13_normal', 'L_normal'),
    ('l14_regression', 'L_regression'), ('l15_multiple', 'L_multiple'),
    ('l16_exam_method', 'L_exam_method'), ('l17_drill', 'L_drill'),
]
UNITS = [
    (T('What should we make?', '我们该做什么？'), ['lp-picture', 'lp-formulate', 'lp-report', 'lp-patterns', 'network', 'integer']),
    (T('What are the chances?', '可能性有多大？'), ['describe-data', 'chances']),
    (T('What do we do when we do not know?', '不确定时该怎么办？'), ['payoff', 'expected-value', 'sample-info']),
    (T('How variable is it?', '它有多不稳定？'), ['random-variables', 'normal']),
    (T('What does the data say?', '数据说明了什么？'), ['regression', 'multiple-regression']),
    (T('The paper itself', '考试本身'), ['exam-method', 'drill']),
]


def build():
    out_dir = os.path.join(DEMO, CID)
    os.makedirs(out_dir, exist_ok=True)
    for f in os.listdir(out_dir):
        if f.endswith('.json'): os.remove(os.path.join(out_dir, f))
    entries, built = [], []
    for mod, fn in ORDER:
        if not os.path.exists(os.path.join(HERE, mod + '.py')):
            continue
        L = getattr(importlib.import_module(mod), fn)()
        lesson = {'id': L['id'], 'mode': 'essay', 'title': L['title'], 'description': L['description'], 'minutes': L['minutes'],
                  'skills': L['skills'], 'misconceptions': L.get('misconceptions', []), 'steps': L['steps']}
        with open(os.path.join(out_dir, f'{L["id"]}.json'), 'w', encoding='utf8') as f:
            json.dump(lesson, f, ensure_ascii=False, separators=(',', ':'))
        built.append(L['id'])
        entries.append({'id': L['id'], 'title': L['title'], 'summary': L['description'], 'minutes': L['minutes'],
                        'meta': {'title': L['title'], 'mode': 'essay', 'langs': ['en', 'zh'], 'has_scene': False,
                                 'kinds': sorted({s['kind'] for s in L['steps']}), 'skills': L['skills']}})
    units = [{'title': t, 'lessons': [f'{CID}-{s}' for s in ids if f'{CID}-{s}' in built]} for t, ids in UNITS]
    units = [u for u in units if u['lessons']]
    course = {
        'id': CID,
        'title': T('MGMT90141 Business Analysis and Decision Making, for the exam', 'MGMT90141 商业分析与决策，备考精讲'),
        'summary': T('Five questions a manager asks (what to make, what the chances are, what to do when you cannot know, how variable it is, what the data says), each learned by moving an instrument, then done as the exam asks it, with your own work checked.',
                     '经理要问的五个问题（做什么、可能性多大、不确定时怎么办、有多不稳定、数据说明什么）：每个问题先摆弄一个交互工具弄明白，再按考试的问法做一遍，你写的东西会被检查。'),
        'audience': T('Students sitting the MGMT90141 final exam, who may not have attended much. You need school algebra, a Casio fx-82 and no spreadsheet knowledge.',
                      '要参加 MGMT90141 期末考试的同学，上课不多也没关系。需要中学代数、一台 Casio fx-82，不需要会用电子表格。'),
        'outcomes': [T('Write a linear program from a story and know whether it is right, and read a sensitivity report without guessing', '能从一段文字写出线性规划并知道对不对，能不靠猜地读灵敏度报告'),
                     T('Decide with probabilities: expected value, perfect and sample information, Bayes and the decision tree', '用概率做决策：期望值、完全信息与样本信息、贝叶斯和决策树'),
                     T('Use the normal table and read regression output, by hand, in exam time', '在考试时间内手算正态分布表，读懂回归输出')],
        'lang': 'en', 'mine': False, 'public': True, 'ready': True, 'packs': ['mgmt'],
        'origin': {'decks': 12, 'exams': 2, 'note': T('Written by an AI (Claude) from the subject’s lecture decks, the 2025 exam paper and the worked answers of past papers · not edited by a person',
                                                         '由 AI（Claude）根据这门课的课件、2025 年试卷和历年试卷的参考答案编写 · 未经人工修改')},
        'units': units, 'lessons': entries, 'demo': True,
    }
    path = os.path.join(DEMO, 'courses.json')
    with open(path, encoding='utf8') as f:
        courses = json.load(f)
    courses = [c for c in courses if c.get('id') != CID] + [course]
    with open(path, 'w', encoding='utf8') as f:
        json.dump(courses, f, ensure_ascii=False, indent=1)
    print(f'{len(entries)} lessons -> {out_dir}; courses.json has {len(courses)} courses')


if __name__ == '__main__':
    build()
