#!/usr/bin/env python3
# The physics stress test's demo course (docs/design/PHYSICS-STRESS.md): one lesson, three pages, one engine figure
# each, as Mathium lesson JSON in apps/mathnim/public/demo/physics-stress/, and its entry in
# apps/mathnim/public/demo/courses.json with `test`: listed last on the home page, under Test (Lucas, 2026-11-06).
# Not a course: a place to open the figures in the real page.
#   python3 docs/lessons/physics-stress/build.py && node apps/mathnim/tools/demo_check.mjs physics-stress
import json
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, '..'))
from lesson_kit import T, p, read, visual  # noqa: E402

ROOT = os.path.abspath(os.path.join(HERE, '..', '..', '..'))
DEMO = os.path.join(ROOT, 'apps', 'mathnim', 'public', 'demo')
CID = 'physics-stress'
LID = f'{CID}-figures'
SKILL = {'id': f'{CID}.figures', 'name': T('Reading the three physics figures', '读懂三张物理图'), 'description': T('A pendulum, point charges and a torque, as the engine draws them.', '单摆、点电荷和力矩，用引擎画出来的样子。')}


def lesson():
    steps = [
        read('pendulum', T('A pendulum, integrated', '积分出来的单摆'),
             p(T('The bob is let go at an angle; its swing is computed step by step from θ″ = −(g/L) sin θ, beside the small-angle model θ″ = −(g/L) θ (dashed).',
                 '摆锤从某个角度松手；它的摆动按 θ″ = −(g/L) sin θ 一步一步算出来，旁边虚线是小角度模型 θ″ = −(g/L) θ。')),
             visual('phys_pendulum', T('A 1 m pendulum released at 120°. A simulation (velocity Verlet, 240 steps a second).', '1 米长的单摆，从 120° 松手。数值模拟（速度 Verlet，每秒 240 步）。'), release=120),
             p(T('At 20° the two stay together; at 170° the real one takes more than twice as long, which the exposures show: close together near the top, where it is slow.',
                 '20° 时两者几乎重合；170° 时真实的单摆要花两倍多的时间，频闪也看得出来：在顶端附近慢，影子挤在一起。')),
             visual('phys_pendulum', T('Released at 170°, with exposures every 0.1 s.', '从 170° 松手，每 0.1 秒拍一张。'), release=170, strobe=True)),
        read('charges', T('Point charges', '点电荷'),
             p(T('The potential as a tint (red positive, blue negative) with its equipotentials, the field as arrows and as lines traced through it, as many from a charge as its size.',
                 '电势用底色表示（红正蓝负），配上等势线；电场既画成箭头，也画成沿电场追踪出的电场线，从每个电荷出发的条数和它的电量成正比。')),
             visual('phys_charges', T('A dipole, +q and −q.', '电偶极子，+q 和 −q。'), config='dipole'),
             visual('phys_charges', T('+2q, −q and −q.', '+2q、−q 和 −q。'), config='triple')),
        read('torque', T('Torque in 3D', '三维中的力矩'),
             p(T('A lever about a pivot, a force at a point of it, and τ = r × F along the axis it would turn the lever about.',
                 '绕支点转动的杠杆，作用在杠杆上某一点的力，以及沿着杠杆转轴方向的力矩 τ = r × F。')),
             visual('phys_torque', T('Turn the view; the force and where it acts move by hand.', '可以转动视角；力和作用点都能用手移动。'))),
    ]
    return {'id': LID, 'mode': 'essay', 'title': T('Physics figures (engine stress test)', '物理图（引擎压力测试）'),
            'description': T('Three figures that test whether the engine can carry a physics course.', '三张图，测试引擎能否撑起一门物理课。'),
            'minutes': 6, 'skills': [SKILL], 'misconceptions': [], 'steps': steps}


def build():
    out_dir = os.path.join(DEMO, CID)
    os.makedirs(out_dir, exist_ok=True)
    L = lesson()
    with open(os.path.join(out_dir, f'{LID}.json'), 'w', encoding='utf8') as f:
        json.dump(L, f, ensure_ascii=False, separators=(',', ':'))
    entry = {'id': LID, 'title': L['title'], 'summary': L['description'], 'minutes': L['minutes'],
             'meta': {'title': L['title'], 'mode': 'essay', 'langs': ['en', 'zh'], 'has_scene': False,
                      'kinds': sorted({s['kind'] for s in L['steps']}), 'skills': L['skills']}}
    course = {
        'id': CID,
        'title': T('Physics on the engine (stress test)', '引擎上的物理（压力测试）'),
        'summary': T('Not a course: three figures that test the figure engine (a pendulum, point charges, torque in 3D).', '不是一门课：三张测试图形引擎的图（单摆、点电荷、三维力矩）。'),
        'audience': T('Reviewers of the engine.', '引擎的审阅者。'),
        'outcomes': [],
        'lang': 'en', 'mine': False, 'public': True, 'ready': True, 'test': True, 'cover': '/thumbs/physics-stress.webp', 'packs': ['physics'],
        'origin': {'decks': 0, 'exams': 0, 'note': T('Written by an AI (Claude) as an engine test · not a course', '由 AI（Claude）为测试引擎而写 · 不是一门课')},
        'units': [{'title': T('Figures', '图'), 'lessons': [LID]}], 'lessons': [entry], 'demo': True,
    }
    path = os.path.join(DEMO, 'courses.json')
    with open(path, encoding='utf8') as f:
        courses = json.load(f)
    courses = [c for c in courses if c.get('id') != CID] + [course]
    with open(path, 'w', encoding='utf8') as f:
        json.dump(courses, f, ensure_ascii=False, indent=1)
    print(f'{LID} -> {out_dir}; courses.json has {len(courses)} courses')


if __name__ == '__main__':
    build()
