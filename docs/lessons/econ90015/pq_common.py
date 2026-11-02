# What the predicted questions share (predict.py and its lessons, pq_*.py): titles, the answer-spreading helper and
# the diagrams, each drawn from the same functions its question uses, so every point is where the numbers put it.
import math

from build import *  # noqa: F401,F403  (the course's helpers: T, blocks, steps, Plot, colours, chapter titles)

PQ = lambda n, marks: T(f'Predicted question {n} · {marks} marks', f'预测题 {n} · {marks} 分')
PQA = lambda n: T(f'Predicted question {n} · a full-mark answer', f'预测题 {n} · 满分答案')
PART_M = lambda x, m: T(f'Part ({x}) · {m} marks', f'({x}) 小问 · {m} 分')


def mixed(make):
    """The right answer is not always first: choice checkpoints shuffle, and each quiz puts it in a different place."""
    def made():
        L = make()
        n = 0
        for s in L['steps']:
            if s['kind'] == 'checkpoint' and s['question']['type'] == 'choice':
                s['question']['shuffle'] = True
            for b in s.get('blocks', []):
                if b['type'] == 'quiz':
                    opts = b['options']
                    right = next(o for o in opts if o.get('correct'))
                    rest = [o for o in opts if o is not right]
                    n += 1
                    k = n % len(opts)
                    b['options'] = rest[:k] + [right] + rest[k:]
        return L
    return made


# ---------------------------------------------------------------- 1. a tax and a price ceiling
D1 = lambda Q: 100 - Q / 4          # demand Q = 400 - 4p, as a price
S1 = lambda Q: (Q + 100) / 6        # supply Q = 6p - 100, as a price


def fig_tax():
    P = Plot(0, 320, 0, 104)
    P.area([(0, 46), (176, 46), (176, 56), (0, 56)], GOLD, 0.2)
    P.area([(176, 56), (200, 50), (176, 46)], PURPLE, 0.3)
    P.curve(D1, 0, 320, BLUE)
    P.curve(S1, 0, 320, ORANGE)
    P.seg((176, 46), (176, 56), INK, 3)
    P.guide(176, 56)
    P.guide(176, 46)
    P.dot(200, 50, INK)
    P.dot(176, 56, BLUE)
    P.dot(176, 46, ORANGE)
    P.text(88, 51, 'tax revenue', INK, 14, 'middle', dy=5)
    P.text(204, 52, 'DWL', PURPLE, 15, dx=8, dy=-12, weight='600')
    P.text(300, 25, 'D', BLUE, 18)
    P.text(300, 66.7, 'S', ORANGE, 18, dy=-8)
    P.axes('Q', 'p', xticks=(176, 200, 300), yticks=(46, 50, 56, 100))
    return P.svg()


def fig_ceiling():
    P = Plot(0, 320, 0, 104)
    P.area([(140, 65), (200, 50), (140, 40)], PURPLE, 0.3)
    P.curve(D1, 0, 320, BLUE)
    P.curve(S1, 0, 320, ORANGE)
    P.seg((0, 40), (300, 40), INK, 2.5, '8 6')
    P.guide(140, 65)
    P.seg((240, 40), (240, 0), MUTED, 1.5, '5 5')
    P.dot(140, 40, ORANGE)
    P.dot(240, 40, BLUE)
    P.dot(200, 50, INK)
    P.text(190, 40, 'shortage 100', INK, 14, 'middle', dy=22)
    P.text(150, 52, 'DWL', PURPLE, 15, dy=5, weight='600')
    P.text(300, 40, 'ceiling 40', INK, 14, 'end', dy=-8)
    P.text(300, 25, 'D', BLUE, 18)
    P.text(300, 66.7, 'S', ORANGE, 18, dy=-8)
    P.axes('Q', 'p', xticks=(140, 200, 240), yticks=(40, 50, 65, 100))
    return P.svg()


# ---------------------------------------------------------------- 2. pollution
D2 = lambda Q: 100 - Q / 2
MPC = lambda Q: 10 + Q / 2
MSC = lambda Q: 30 + Q / 2


def fig_external():
    P = Plot(0, 150, 0, 110)
    P.area([(70, 65), (90, 75), (90, 55)], PURPLE, 0.3)
    P.curve(D2, 0, 150, BLUE)
    P.curve(MPC, 0, 150, ORANGE)
    P.curve(MSC, 0, 150, ORANGE, 3, '7 6')
    P.guide(90, 55)
    P.guide(70, 65)
    P.dot(90, 55, ORANGE)
    P.dot(70, 65, INK)
    P.seg((120, 70), (120, 90), MUTED, 1.5)
    P.text(120, 80, '20', MUTED, 14, dx=6, dy=5)
    P.text(94, 64, 'DWL', PURPLE, 15, dy=5, weight='600')
    P.text(140, 30, 'D', BLUE, 18)
    P.text(150, 85, 'MPC', ORANGE, 16, 'end', dx=-2, dy=22)
    P.text(150, 105, 'MSC', ORANGE, 16, 'end', dx=-14, dy=-6)
    P.axes('Q', 'p', xticks=(70, 90, 140), yticks=(55, 65, 75, 100))
    return P.svg()


def fig_permits():
    # firm 1's abatement read from the left, firm 2's from the right; 60 tonnes to cut between them
    P = Plot(0, 60, 0, 250)
    P.curve(lambda a: 2 * a, 0, 60, BLUE)
    P.curve(lambda a: 4 * (60 - a), 0, 60, ORANGE)
    P.guide(40, 80)
    P.dot(40, 80, INK)
    P.seg((30, 60), (30, 120), PURPLE, 3)
    P.dot(30, 60, BLUE)
    P.dot(30, 120, ORANGE)
    P.text(2, 40, 'MAC₁ = 2a₁', BLUE, 15)
    P.text(56, 40, 'MAC₂ = 4a₂', ORANGE, 15, 'end')
    P.text(40, 80, 'permit price 80', INK, 14, dx=8, dy=-10)
    P.text(30, 96, 'each cuts 30', PURPLE, 14, 'end', dx=-10)
    P.axes('a₁ →', '$', xticks=(0, 30, 40, 60), yticks=(60, 80, 120, 240))
    P.text(60, 0, '← a₂', MUTED, 14, 'end', dy=40)
    return P.svg()


# ---------------------------------------------------------------- 3. costs
C3 = lambda q: 100 + 4 * q + q * q
MC3 = lambda q: 4 + 2 * q


def fig_costs():
    P = Plot(0, 22, 0, 50)
    P.curve(MC3, 0, 22, ORANGE)
    P.curve(lambda q: C3(q) / q, 2.6, 22, BLUE)
    P.curve(lambda q: 4 + q, 0, 22, BLUE, 2, '6 6')
    P.seg((0, 28), (21, 28), INK, 1.5, '4 5')
    P.seg((0, 16), (21, 16), INK, 1.5, '4 5')
    P.guide(10, 24)
    P.dot(10, 24, INK)
    P.dot(12, 28, ORANGE)
    P.dot(6, 16, ORANGE)
    P.text(21.5, 46, 'MC', ORANGE, 16, 'end', dy=-4)
    P.text(22, 30.5, 'ATC', BLUE, 16, 'end', dy=-10)
    P.text(22, 26, 'AVC', BLUE, 15, 'end', dy=20)
    P.text(0.4, 28, 'p = 28', INK, 13, dy=-6)
    P.text(0.4, 16, 'p = 16', INK, 13, dy=-6)
    P.axes('q', '$', xticks=(6, 10, 12, 20), yticks=(4, 16, 24, 28))
    return P.svg()


# ---------------------------------------------------------------- 4. two-part tariffs
def fig_two_part():
    P = Plot(0, 22, 0, 22)
    P.area([(0, 20), (16, 4), (0, 4)], GREEN, 0.2)
    P.curve(lambda Q: 20 - Q, 0, 20, BLUE)
    P.seg((0, 4), (21, 4), ORANGE, 3)
    P.area([(0, 4), (8, 4), (8, 12), (0, 12)], GOLD, 0.25)
    P.guide(8, 12)
    P.dot(8, 12, BLUE)
    P.dot(16, 4, BLUE)
    P.text(4, 8, 'single price: 64', INK, 13, 'middle', dy=5)
    P.text(5, 15, 'fee 128', GREEN, 15, dy=5, weight='600')
    P.text(20, 4, 'MC = 4', ORANGE, 14, 'end', dy=-8)
    P.text(19.5, 0.5, 'D', BLUE, 17, dy=-6)
    P.axes('Q', 'p', xticks=(8, 16, 20), yticks=(4, 12, 20))
    return P.svg()


def fig_two_types():
    P = Plot(0, 22, 0, 22)
    P.area([(0, 16), (10, 6), (0, 6)], GREEN, 0.22)
    P.curve(lambda Q: 20 - Q, 0, 20, BLUE)
    P.curve(lambda Q: 16 - Q, 0, 16, BLUE, 2.5, '7 6')
    P.seg((0, 6), (21, 6), INK, 2)
    P.seg((0, 4), (21, 4), ORANGE, 2)
    P.dot(10, 6, BLUE)
    P.dot(14, 6, BLUE)
    P.text(3.4, 9.5, 'fee 50', GREEN, 14, dy=5, weight='600')
    P.text(21, 6, 'p = 6', INK, 13, 'end', dy=-6)
    P.text(21, 4, 'MC = 4', ORANGE, 13, 'end', dy=16)
    P.text(20, 0, 'keen', BLUE, 14, 'middle', dy=-10)
    P.text(16, 0, 'casual', BLUE, 14, 'end', dx=-8, dy=-10)
    P.axes('Q', 'p', xticks=(10, 14, 16, 20), yticks=(4, 6, 16, 20))
    return P.svg()


# ---------------------------------------------------------------- 5. two sellers
def fig_reaction():
    P = Plot(0, 125, 0, 125, w=560, h=480)
    P.curve(lambda x: 60 - x / 2, 0, 120, BLUE)
    P.seg((60, 0), (0, 120), ORANGE, 3)
    P.seg((0, 60), (60, 0), MUTED, 1.5, '5 5')
    P.dot(40, 40, INK)
    P.dot(60, 30, PURPLE)
    P.dot(30, 30, GREEN)
    P.dot(45, 30, GOLD)
    P.text(40, 40, 'Cournot (40, 40)', INK, 14, dx=8, dy=-8)
    P.text(60, 30, 'Stackelberg (60, 30)', PURPLE, 14, dx=10, dy=-10)
    P.text(30, 30, 'cartel (30, 30)', GREEN, 14, 'end', dx=-8, dy=16)
    P.text(45, 30, 'cheat (45, 30)', GOLD, 14, dx=30, dy=46)
    P.text(104, 8, 'R₂', BLUE, 16)
    P.text(8, 110, 'R₁', ORANGE, 16)
    P.axes('q₁', 'q₂', xticks=(30, 40, 60, 120), yticks=(30, 40, 60, 120))
    return P.svg()


# ---------------------------------------------------------------- 6. an entry game, as a tree
def fig_tree(commit=False):
    inc = ('60', '45', '10') if commit else ('100', '20', '50')
    w, h = 640, 330
    node = lambda x, y, s, c=INK, side=False: (f'<circle cx="{x}" cy="{y}" r="7" fill="{c}"/><text x="{x + 16 if side else x}" y="{y + 5 if side else y - 16}" font-size="16" fill="{c}" text-anchor="{"start" if side else "middle"}">{s}</text>')
    edge = lambda x1, y1, x2, y2, s, c=INK, bold=False: (f'<line x1="{x1}" y1="{y1}" x2="{x2}" y2="{y2}" stroke="{c}" stroke-width="{4 if bold else 2}"/>'
                                                         f'<text x="{(x1 + x2) / 2 + (12 if x2 >= x1 else -12)}" y="{(y1 + y2) / 2}" font-size="15" fill="{c}" text-anchor="{"start" if x2 >= x1 else "end"}">{s}</text>')
    leaf = lambda x, y, a, b: f'<text x="{x}" y="{y + 26}" font-size="16" fill="{INK}" text-anchor="middle">({a}, {b})</text>'
    fight_best = commit
    parts = [
        edge(200, 60, 90, 180, 'stay out', INK, commit),
        edge(200, 60, 330, 180, 'enter', INK, not commit),
        edge(330, 180, 230, 290, 'fight', ORANGE, fight_best),
        edge(330, 180, 450, 290, 'accommodate', ORANGE, not fight_best),
        node(200, 60, 'Entrant'), node(330, 180, 'Incumbent', ORANGE, True),
        f'<circle cx="90" cy="180" r="5" fill="{MUTED}"/>', f'<circle cx="230" cy="290" r="5" fill="{MUTED}"/>', f'<circle cx="450" cy="290" r="5" fill="{MUTED}"/>',
        leaf(90, 180, 0, inc[0]), leaf(230, 290, -10, inc[1]), leaf(450, 290, 30, inc[2]),
        f'<text x="620" y="40" font-size="14" fill="{MUTED}" text-anchor="end">(entrant, incumbent)</text>',
    ]
    if commit:
        parts.append(f'<text x="620" y="62" font-size="14" fill="{ORANGE}" text-anchor="end">after spending 40 on capacity</text>')
    return f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {w} {h}" font-family="sans-serif"><rect width="{w}" height="{h}" fill="#ffffff"/>{"".join(parts)}</svg>'


# ---------------------------------------------------------------- 7. Malthus with numbers
def fig_malthus_numbers(plague=False):
    P = Plot(0, 80, 0, 300)
    P.curve(lambda n: 2 * math.sqrt(100 * n), 0, 80, BLUE, 2.5, '7 6')
    P.curve(lambda n: 3 * math.sqrt(100 * n), 0, 80, BLUE)
    P.seg((0, 0), (75, 300), INK, 2)
    P.dot(25, 100, INK)
    P.dot(56.25, 225, INK)
    P.guide(56.25, 225)
    P.text(75, 300, 'Y = 4N', INK, 14, 'end', dx=-8, dy=4)
    P.text(79, 2 * math.sqrt(7900), 'A = 2', BLUE, 14, 'end', dy=22)
    P.text(79, 3 * math.sqrt(7900), 'A = 3', BLUE, 14, 'end', dy=-8)
    P.text(25, 100, '(25, 100)', INK, 13, dx=8, dy=14)
    if plague:
        P.dot(37.5, 3 * math.sqrt(3750), ORANGE)
        P.seg((37.5, 0), (37.5, 3 * math.sqrt(3750)), ORANGE, 1.5, '5 5')
        P.text(37.5, 3 * math.sqrt(3750), 'after the plague', ORANGE, 13, 'end', dx=-8, dy=-6)
    else:
        P.dot(25, 150, ORANGE)
        P.seg((25, 100), (25, 150), ORANGE, 2.5)
        P.text(24, 165, 'new crop, short run', ORANGE, 13, 'end')
    P.axes('N', 'Y', xticks=(25, 37.5, 56.25) if plague else (25, 56.25), yticks=(100, 150, 225))
    return P.svg()
