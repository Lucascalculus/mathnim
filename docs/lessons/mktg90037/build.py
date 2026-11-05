#!/usr/bin/env python3
# Builds the MKTG90037 demo course (README.md here) as Mathnim lesson JSON in apps/mathnim/public/demo/mktg90037/ and its
# entry in apps/mathnim/public/demo/courses.json (only this course's own entry is replaced). One file per lesson (l_*.py)
# exposes a function that returns the lesson dict; the instruments are frames (public/frames/kit/kinds/).
#   python3 docs/lessons/mktg90037/build.py && node apps/mathnim/tools/demo_check.mjs mktg90037
import json
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, '..', '..', '..'))
DEMO = os.path.join(ROOT, 'apps', 'mathnim', 'public', 'demo')
CID = 'mktg90037'

sys.path.insert(0, os.path.join(HERE, '..'))
sys.path.insert(0, HERE)
from lesson_kit import T  # noqa: E402
import importlib  # noqa: E402

# (module, function) in course order
ORDER = [('l00_start', 'L00'), ('l01_value', 'L01'), ('l02_orientation', 'L02'), ('l03_service', 'L03'),
         ('l04_advantage', 'L04'), ('l05_stp', 'L05'), ('l06_proposition', 'L06'), ('l07_model', 'L07'), ('l08_vpc', 'L08'),
         ('l09_employees', 'L09'), ('l10_salesforce', 'L10'), ('l11_community', 'L11'), ('l12_cocreation', 'L12'), ('l13_makebuy', 'L13'),
         ('l14_firmvalue', 'L14'), ('l15_metrics', 'L15'), ('l16_pricecost', 'L16'), ('l17_pricevalue', 'L17'),
         ('l18_combine', 'L18'), ('l19_exam', 'L19')]
UNITS = [
    (T('The paper', '先看考卷'), ['start']),
    (T('What value is, and who decides', '价值是什么，谁说了算'), ['value', 'market-orientation', 'service-logic']),
    (T('How a firm creates it', '企业怎样创造价值'), ['advantage', 'stp', 'value-proposition', 'business-model', 'vpc']),
    (T('Creating it with others', '和别人一起创造'), ['employees', 'salesforce', 'community', 'co-creation', 'make-or-buy']),
    (T('Measuring and capturing it', '衡量并拿到价值'), ['firm-value', 'marketing-metrics', 'pricing-cost', 'pricing-value']),
    (T('Putting it together', '合起来写'), ['combine', 'exam']),
]


def build():
    out_dir = os.path.join(DEMO, CID)
    os.makedirs(out_dir, exist_ok=True)
    entries, ids = [], {}
    for mod, fn in ORDER:
        try:
            make = getattr(importlib.import_module(mod), fn)
        except (ImportError, AttributeError):
            continue  # not written yet
        L = make(CID)
        lesson = {'id': L['id'], 'mode': 'essay', 'title': L['title'], 'description': L['description'], 'minutes': L['minutes'],
                  'skills': L['skills'], 'misconceptions': L.get('misconceptions', []), 'steps': L['steps']}
        with open(os.path.join(out_dir, f'{L["id"]}.json'), 'w', encoding='utf8') as f:
            json.dump(lesson, f, ensure_ascii=False, separators=(',', ':'))
        ids[L['id'][len(CID) + 1:]] = L['id']
        entries.append({'id': L['id'], 'title': L['title'], 'summary': L['description'], 'minutes': L['minutes'],
                        'meta': {'title': L['title'], 'mode': 'essay', 'langs': ['en', 'zh'], 'has_scene': False,
                                 'kinds': sorted({s['kind'] for s in L['steps']}), 'skills': L['skills']}})
    units = [{'title': t, 'lessons': [ids[s] for s in slugs if s in ids]} for t, slugs in UNITS]
    units = [u for u in units if u['lessons']]
    course = {
        'id': CID,
        'title': T('MKTG90037 Managing for Value Creation, for the exam', 'MKTG90037 价值创造管理，备考精讲'),
        'summary': T('Twenty lessons that teach each framework by touching it, then make you write the exam’s Explain, Apply and Recommend answers on Lipton, Who Gives a Crap, Hilton and Coles, marked against the rubric.',
                     '二十节课：先动手摆弄每个框架，再按考试的“解释、应用、建议”三段，用 Lipton、Who Gives a Crap、Hilton、Coles 写答案，并按评分标准批改。'),
        'audience': T('Postgraduates sitting the MKTG90037 exam, closed book, four 600 to 750 word answers, who may not have attended every lecture.',
                      '要参加 MKTG90037 考试的研究生：闭卷，四篇 600 到 750 词的长答案，课也不一定每节都听过。'),
        'outcomes': [T('Explain each framework precisely enough to earn the five Explain marks, in your own words', '把每个框架解释得足够精确，拿下五分的“解释”'),
                     T('Apply it to a named company with cause and effect, using facts you can recall without notes', '落到具体公司上，讲清因果，用的是不看资料也记得住的事实'),
                     T('Recommend exactly two things that follow from your analysis, and join ideas across weeks', '给出恰好两条从分析里推出来的建议，并把不同周的内容连起来')],
        'lang': 'en', 'mine': False, 'public': True, 'ready': True, 'packs': [],
        'origin': {'decks': 9, 'exams': 0, 'note': T('Written by an AI (Claude) from the subject guide, nine lecture decks and the exam briefing; the decks are the coverage floor, not the order; brand facts come from the companies’ own reports and pages, and the lessons say where a fact could not be checked · not edited by a person',
                                                    '由 AI（Claude）根据课程指南、九份课件和考试说明编写；课件只是内容的下限，不决定顺序；品牌事实来自公司自己的报告和网页，核实不了的地方课里会说明 · 未经人工修改')},
        'units': [{'title': t, 'lessons': l['lessons']} for t, l in zip([u[0] for u in UNITS if any(s in ids for s in u[1])], units)],
        'lessons': entries, 'demo': True,
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
