# M8 figure: the real-time iteration's timeline (schematic), en + zh.
# Run: python3 docs/lessons/mpc/m8/figures.py  -> apps/mathnim/public/mpc/m8/rti-timeline.{en,zh}.svg
from pathlib import Path

OUT = Path(__file__).resolve().parents[4] / 'apps/mathnim/public/mpc/m8'
INK, MUTED, ACCENT, PURPLE, CORAL, GOOD = '#111113', '#86868B', '#2563EB', '#7C3AED', '#E4572E', '#0D9488'
FONT = "-apple-system, 'PingFang SC', 'Noto Sans SC', 'Helvetica Neue', Arial, sans-serif"

T = {
    'title': ('One real-time iteration per sample (RTI)', '每个采样只做一次实时迭代（RTI）'),
    'sub': ('schematic, not to scale', '示意图，未按比例'),
    'rti': ('RTI', 'RTI'),
    'conv_a': ('iterate to', '迭代到'),
    'conv_b': ('convergence', '收敛'),
    'prep_a': ('preparation (before x̂ arrives)', '准备（x̂ 到达之前）'),
    'prep_b': ('shift the last plan, linearise along it,', '平移上一个计划，沿它线性化，'),
    'prep_c': ('build and factor the QP', '把 QP 搭好、分解好'),
    'fb': ('feedback: one QP = the only delay', '反馈：解一个 QP，这是唯一的延迟'),
    'meas': ('x̂ measured', '测得 x̂'),
    'apply': ('u₀ applied', '执行 u₀'),
    'qps': ('linearise, QP, linearise, QP, …', '线性化、QP、线性化、QP……'),
    'wait': ('waits for x̂', '等 x̂ 到来'),
    'delay2': ('delay: several QPs', '延迟：好几个 QP'),
    'foot': ('After Diehl et al. (2002) and Gros et al. (2020, Algorithm 3). Linear MPC is the case where the preparation is done once, offline.',
             '据 Diehl 等（2002）与 Gros 等（2020，算法 3）绘制。线性 MPC 就是"准备"只在离线时做一次的特例。'),
}

def svg(lang):
    i = 0 if lang == 'en' else 1
    t = lambda k: T[k][i]
    W, H = 760, 400
    out = [f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W} {H}" width="{W}" height="{H}" font-family="{FONT}">',
           f'<rect width="{W}" height="{H}" fill="#FFFFFF"/>']
    def text(x, y, s, size=15, fill=INK, anchor='start', weight=400):
        out.append(f'<text x="{x}" y="{y}" font-size="{size}" fill="{fill}" text-anchor="{anchor}" font-weight="{weight}">{s}</text>')
    def rect(x, y, w, h, fill, stroke, op=1):
        out.append(f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="6" fill="{fill}" fill-opacity="{op}" stroke="{stroke}" stroke-width="1.6"/>')
    def line(x1, y1, x2, y2, col=MUTED, w=1.5, dash=None):
        d = f' stroke-dasharray="{dash}"' if dash else ''
        out.append(f'<line x1="{x1}" y1="{y1}" x2="{x2}" y2="{y2}" stroke="{col}" stroke-width="{w}"{d}/>')
    text(20, 32, t('title'), 19, INK, weight=600)
    text(W - 20, 32, t('sub'), 13, MUTED, 'end')
    # sample instants
    xs = [200, 470, 740]
    for x, lab in zip(xs, ['t<tspan baseline-shift="sub" font-size="11">i−1</tspan>', 't<tspan baseline-shift="sub" font-size="11">i</tspan>', 't<tspan baseline-shift="sub" font-size="11">i+1</tspan>']):
        line(x, 60, x, 330, MUTED, 1.2, '4 4')
        text(x, 352, lab, 15, INK, 'middle')
    line(180, 330, 750, 330, INK, 1.4)
    # row 1: RTI
    y1 = 95
    text(20, y1 + 36, t('rti'), 16, INK, weight=600)
    rect(xs[0] + 34, y1, xs[1] - xs[0] - 46, 66, '#F2EBFD', PURPLE)
    for k, key in enumerate(['prep_a', 'prep_b', 'prep_c']):
        text(xs[0] + 44, y1 + 20 + 19 * k, t(key), 13.5, INK if k else PURPLE, weight=600 if k == 0 else 400)
    rect(xs[1], y1, 30, 66, '#E5ECFD', ACCENT)
    rect(xs[1] + 42, y1, xs[2] - xs[1] - 54, 66, '#F2EBFD', PURPLE, 0.5)
    rect(xs[0], y1, 30, 66, '#E5ECFD', ACCENT, 0.5)
    text(xs[1] + 40, y1 + 86, t('fb'), 13.5, ACCENT, 'start', 600)
    out.append(f'<path d="M {xs[1]} {y1 - 4} l -5 -10 h 10 z" fill="{GOOD}"/>')
    out.append(f'<path d="M {xs[1] + 30} {y1 - 4} l -5 -10 h 10 z" fill="{ACCENT}"/>')
    text(xs[1] - 8, y1 - 6, t('meas'), 13, GOOD, 'end')
    text(xs[1] + 38, y1 - 6, t('apply'), 13, ACCENT)
    # row 2: converged
    y2 = 225
    text(20, y2 + 28, t('conv_a'), 15, INK, weight=600)
    text(20, y2 + 47, t('conv_b'), 15, INK, weight=600)
    for k in range(5):
        rect(xs[1] + k * 46, y2, 42, 50, '#FDECE7', CORAL)
    text(xs[1] + 113, y2 + 70, t('qps'), 13.5, CORAL, 'middle', 600)
    d_end = xs[1] + 5 * 46 - 4
    out.append(f'<path d="M {xs[1]} {y2 - 4} l -5 -10 h 10 z" fill="{GOOD}"/>')
    out.append(f'<path d="M {d_end} {y2 - 4} l -5 -10 h 10 z" fill="{ACCENT}"/>')
    line(xs[1], y2 - 20, d_end, y2 - 20, INK, 1.2)
    text((xs[1] + d_end) / 2, y2 - 26, t('delay2'), 13, INK, 'middle')
    text(xs[1] - 8, y2 + 30, t('wait'), 13, MUTED, 'end')
    text(20, 385, t('foot'), 12.5, MUTED)
    out.append('</svg>')
    return '\n'.join(out)

OUT.mkdir(parents=True, exist_ok=True)
for lang in ['en', 'zh']:
    (OUT / f'rti-timeline.{lang}.svg').write_text(svg(lang), encoding='utf-8')
    print('wrote', OUT / f'rti-timeline.{lang}.svg')
