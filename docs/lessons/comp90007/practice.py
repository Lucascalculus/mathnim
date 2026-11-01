# The practice-exam unit of the Internet Technologies demo course (README.md here): the sixteen questions of
# the COMP90007 practice exam that the sample-question unit does not teach (Q5 and Q16 are taught there),
# eight lessons and a start page, built the same way. build.py imports PRACTICE and writes the unit; this
# file draws with build.py's helpers (Fig, drawn, skills, the chapter titles).
import math

from build import *  # noqa: F401,F403  (T and the block helpers, Fig, drawn, skills, the colours, the chapter titles)

PE = lambda n, marks: T(f'Practice exam · Question {n} [{marks} marks]', f'模拟卷 · 第 {n} 题（{marks} 分）')
PEA = lambda n: T(f'Practice exam, Q{n} · a full-mark answer', f'模拟卷第 {n} 题 · 满分答案')


def poly(F, pts, color, width=2.2, dash=None):
    d = f' stroke-dasharray="{dash}"' if dash else ''
    F.parts.append(f'<polyline points="{" ".join(f"{x:.1f},{y:.1f}" for x, y in pts)}" fill="none" stroke="{color}" stroke-width="{width}" stroke-linejoin="round" stroke-linecap="round"{d}/>')


def bits(F, x, y, s, w=26, h=28, fill='#ffffff', stroke=MUTED, color=INK, size=15, hot=()):
    """A row of bit boxes; positions in `hot` are drawn in orange."""
    for i, b in enumerate(s):
        on = i in hot
        F.rect(x + w * i, y, w - 2, h, RED_SOFT if on else fill, ORANGE if on else stroke, 1.4 if on else 1.2, rx=3)
        F.text(x + w * i + (w - 2) / 2, y + h / 2 + 5.5, b, size, ORANGE if on else color, 'middle', '600' if on else None)


# ---------------------------------------------------------------- drawings
def fig_media(lang):
    """Copper carries a current that fades and picks up noise; fibre carries light kept in the core by total internal reflection."""
    F = Fig(600, 290, lang)
    F.text(24, 26, F.L('copper · twisted pair, coax', '铜线 · 双绞线、同轴电缆'), 17, INK, weight='600')
    F.rect(24, 104, 552, 12, '#f3e3c3', GOLD, 1.4, rx=6)
    pts = []
    for i in range(241):
        x = 40 + 520 * i / 240
        a = 22 * math.exp(-(x - 40) / 260)
        noise = (0.5 + 4.5 * (x - 40) / 520) * math.sin(x * 1.7) * math.sin(x * 0.43 + 1)
        pts.append((x, 66 - a * math.sin(2 * math.pi * (x - 40) / 44) + noise))
    poly(F, pts, GOLD, 2.2)
    F.text(40, 140, F.L('strong', '强'), 15, MUTED)
    F.text(560, 140, F.L('weak, noisy', '弱、有噪声'), 15, ORANGE, 'end', '600')
    F.text(300, 140, F.L('MHz – GHz · a few km', 'MHz – GHz · 几公里'), 15, INK, 'middle')
    F.text(24, 182, F.L('fibre · glass', '光纤 · 玻璃'), 17, INK, weight='600')
    F.rect(10, 202, 62, 44, GREY_SOFT, INK, 1.4)
    F.text(41, 229, F.L('laser', '激光'), 15, INK, 'middle')
    F.rect(528, 202, 62, 44, GREY_SOFT, INK, 1.4)
    F.text(559, 229, F.L('detector', '探测器'), 14, INK, 'middle')
    F.rect(76, 202, 448, 44, GREY_SOFT, LINE, 1.2, rx=4)
    F.rect(76, 214, 448, 20, BLUE_SOFT, None, rx=2)
    zig = [(76, 224)] + [(76 + 28 * k + 14, 215 if k % 2 == 0 else 233) for k in range(16)] + [(524, 224)]
    poly(F, zig, BLUE, 2)
    F.text(300, 272, F.L('THz · 10 – 200 km', 'THz · 10 – 200 公里'), 15, INK, 'middle')
    F.text(524, 196, F.L('core', '纤芯'), 14, BLUE, 'end')
    return F.svg()


def fig_levels(lang):
    """The same six symbol times: two levels carry 6 bits, eight levels carry 18."""
    F = Fig(600, 360, lang)
    x0, w = 96, 80

    def panel(y, title, vals, labels, top):
        F.text(24, y, title, 17, INK, weight='600')
        base, hgt = y + 120, 92
        F.line(x0 - 6, base, 576, base, LINE, 1.4)
        F.line(x0 - 6, base, x0 - 6, base - hgt - 6, LINE, 1.4)
        pts = []
        for i, v in enumerate(vals):
            yy = base - hgt * v / top
            pts += [(x0 + w * i, yy), (x0 + w * (i + 1), yy)]
            F.text(x0 + w * i + w / 2, base - hgt - 8 if top > 1 else base - hgt - 8, labels[i], 16, BLUE, 'middle', '600')
        poly(F, pts, BLUE, 3)
        for i in range(1, len(vals)):
            F.line(x0 + w * i, base, x0 + w * i, base - hgt, LINE, 1, '3 4')
        F.text(x0 - 14, base + 5, '0', 14, MUTED, 'end')
        F.text(x0 - 14, base - hgt + 5, str(top), 14, MUTED, 'end')

    panel(26, F.L('2 levels · 1 bit per symbol', '2 个电平 · 每个符号 1 位'), [1, 0, 1, 1, 0, 0], ['1', '0', '1', '1', '0', '0'], 1)
    panel(186, F.L('8 levels · 3 bits per symbol', '8 个电平 · 每个符号 3 位'), [5, 1, 6, 3, 0, 7], ['101', '001', '110', '011', '000', '111'], 7)
    F.line(x0, 334, x0 + w, 334, INK, 1.6)
    F.line(x0, 328, x0, 340, INK, 1.6)
    F.line(x0 + w, 328, x0 + w, 340, INK, 1.6)
    F.text(x0 + w + 10, 339, F.L('one symbol time, the same in both', '一个符号时间，两者相同'), 15, MUTED)
    return F.svg()


STUFF_IN = ['A', 'B', 'ESC', 'D', 'FLAG', 'FLAG', 'ESC', 'C']


def fig_stuffing(lang):
    """Question 3's fragment before and after byte stuffing: an ESC goes in front of every FLAG or ESC in the data."""
    F = Fig(600, 214, lang)
    out, src = [], []
    for k, b in enumerate(STUFF_IN):
        if b in ('FLAG', 'ESC'):
            out.append(('ESC', True))
            src.append(None)
        out.append((b, False))
        src.append(k)
    x0, w = 74, 43
    F.text(8, 52, F.L('data', '数据'), 16, INK, weight='600')
    F.text(8, 158, F.L('sent', '发出'), 16, INK, weight='600')
    for j, ((b, added), k) in enumerate(zip(out, src)):
        x = x0 + w * j
        if added:
            F.rect(x, 134, w - 4, 36, RED_SOFT, ORANGE, 1.8, rx=4)
            F.text(x + (w - 4) / 2, 157, b, 14, ORANGE, 'middle', '600')
            continue
        special = b in ('FLAG', 'ESC')
        F.rect(x, 30, w - 4, 36, BLUE_SOFT if special else '#ffffff', BLUE if special else MUTED, 1.4, rx=4)
        F.text(x + (w - 4) / 2, 53, b, 14, INK, 'middle')
        F.line(x + (w - 4) / 2, 70, x + (w - 4) / 2, 128, LINE, 1.6, arrow=True)
        F.rect(x, 134, w - 4, 36, BLUE_SOFT if special else '#ffffff', BLUE if special else MUTED, 1.4, rx=4)
        F.text(x + (w - 4) / 2, 157, b, 14, INK, 'middle')
    F.rect(74, 190, 14, 14, RED_SOFT, ORANGE, 1.4, rx=3)
    F.text(96, 202, F.L('ESC put in by the sender', '发送方加进去的 ESC'), 15, INK)
    return F.svg()


def fig_codewords(lang):
    """The repetition code 000 / 111: one flip is corrected to the nearest codeword, two flips are corrected wrongly."""
    F = Fig(600, 236, lang)
    xs = (80, 226, 372, 518)
    names = ('000', '001', '011', '111')
    F.line(xs[0], 40, xs[3], 40, MUTED, 1.4)
    F.line(xs[0], 34, xs[0], 46, MUTED, 1.4)
    F.line(xs[3], 34, xs[3], 46, MUTED, 1.4)
    F.text(299, 30, F.L('Hamming distance 3', '汉明距离 3'), 15, MUTED, 'middle')
    for a, b in zip(xs, xs[1:]):
        F.line(a + 34, 92, b - 34, 92, LINE, 2)
        F.text((a + b) / 2, 84, F.L('1 flip', '翻 1 位'), 14, MUTED, 'middle')
    for k, (x, n) in enumerate(zip(xs, names)):
        valid = k in (0, 3)
        F.rect(x - 32, 74, 64, 36, GREEN_SOFT if valid else '#ffffff', GREEN if valid else MUTED, 1.8 if valid else 1.3, rx=8)
        F.text(x, 98, n, 17, GREEN if valid else INK, 'middle', '600' if valid else None)
    F.text(xs[0], 132, F.L('sent', '发出'), 15, GREEN, 'middle', '600')
    F.text(xs[3], 132, F.L('valid', '合法码字'), 15, GREEN, 'middle')
    F.line(xs[1] - 6, 152, xs[0] + 10, 152, GREEN, 2.2, arrow=True)
    F.text(xs[1], 178, F.L('1 error: nearest is 000, corrected', '1 个错：最近的是 000，纠对了'), 15, GREEN, 'middle', '600')
    F.line(xs[2] + 6, 196, xs[3] - 10, 196, ORANGE, 2.2, arrow=True)
    F.text(xs[2], 222, F.L('2 errors: nearest is 111, wrong', '2 个错：最近的是 111，纠错了'), 15, ORANGE, 'middle', '600')
    return F.svg()


def fig_gbn_sr(lang):
    """Frames 0 to 4, frame 1 damaged: Go-Back-N discards what follows and resends it all; Selective Repeat buffers it and resends frame 1 only."""
    F = Fig(600, 452, lang)
    for k, title in enumerate((F.L('Go-Back-N', '回退 N 帧（GBN）'), F.L('Selective Repeat', '选择重传（SR）'))):
        o = 304 * k
        s, r = o + 40, o + 230
        F.text(o + 135, 22, title, 17, INK, 'middle', '600')
        F.text(s, 48, F.L('sender', '发送方'), 15, MUTED, 'middle')
        F.text(r, 48, F.L('receiver', '接收方'), 15, MUTED, 'middle')
        F.line(s, 58, s, 440, LINE, 1.6)
        F.line(r, 58, r, 440, LINE, 1.6)
        for i in range(5):
            y = 70 + 24 * i
            F.text(s - 8, y + 5, str(i), 14, INK, 'end', '600')
            if i == 1:
                F.line(s, y, s + 88, y + 22, BLUE, 2)
                F.cross(s + 96, y + 24, 6)
                continue
            F.line(s, y, r, y + 50, BLUE, 2, arrow=True)
            if i >= 2:
                F.text(r + 6, y + 55, F.L('discard', '丢弃') if k == 0 else F.L('buffer', '缓存'), 15, ORANGE if k == 0 else GREEN, weight='600')
        if k == 0:
            F.line(s - 12, 270, s + 12, 270, ORANGE, 3)
            F.text(s + 14, 266, F.L('timeout', '超时'), 15, ORANGE, weight='600')
            for j, n in enumerate((1, 2, 3, 4)):
                y = 284 + 24 * j
                F.text(s - 8, y + 5, str(n), 14, BLUE, 'end', '600')
                F.line(s, y, r, y + 50, BLUE, 2.4, arrow=True)
            F.text(o + 135, 446, F.L('resends 1, 2, 3, 4', '重发 1、2、3、4'), 15, ORANGE, 'middle', '600')
        else:
            F.line(r, 176, s, 222, ORANGE, 2, arrow=True)
            F.text(s + 14, 242, 'NAK 1', 15, ORANGE, weight='600')
            F.text(s - 8, 255, '1', 14, BLUE, 'end', '600')
            F.line(s, 250, r, 300, BLUE, 2.4, arrow=True)
            F.text(r - 8, 322, F.L('deliver 1–4', '交付 1–4'), 15, GREEN, 'end', '600')
            F.line(r, 332, s, 378, MUTED, 1.6, '5 4', arrow=True)
            F.text(s + 14, 398, 'ACK 4', 15, MUTED)
            F.text(o + 135, 446, F.L('resends 1 only', '只重发 1'), 15, GREEN, 'middle', '600')
    return F.svg()


def fig_prefix(lang):
    """A /22 block: 22 network bits fixed by the prefix, 10 host bits free, 2^10 = 1024 addresses."""
    F = Fig(600, 176, lang)
    x0, w = 30, 17
    for i in range(32):
        net = i < 22
        x = x0 + w * i + (i // 8) * 6
        F.rect(x, 64, w - 3, 34, BLUE_SOFT if net else GREEN_SOFT, BLUE if net else GREEN, 1.1, rx=2)
    xe = x0 + w * 22 + 2 * 6
    F.line(x0, 52, xe - 4, 52, BLUE, 1.6)
    F.text((x0 + xe) / 2, 40, F.L('network portion · 22 bits', '网络部分 · 22 位'), 16, BLUE, 'middle', '600')
    xh = x0 + w * 32 + 3 * 6
    F.line(xe, 52, xh - 3, 52, GREEN, 1.6)
    F.text((xe + xh) / 2, 40, F.L('host · 10 bits', '主机 · 10 位'), 16, GREEN, 'middle', '600')
    F.text((xe + xh) / 2, 124, '2^10 = 1024', 16, GREEN, 'middle', '600')
    F.text((x0 + xe) / 2, 124, F.L('the same for every address in the block', '块内所有地址都一样'), 15, MUTED, 'middle')
    F.text((x0 + xe) / 2, 158, F.L('mask', '掩码') + ' 255.255.252.0', 15, INK, 'middle')
    return F.svg()


def fig_and(lang):
    """The last byte of each destination ANDed with its row's mask: both leave 0, so both rows match."""
    F = Fig(600, 214, lang)
    for k, (addr, a, m, row) in enumerate((('148.96.40.12', 12, 128, F.L('row 3 → R2', '第 3 行 → R2')), ('196.4.153.50', 50, 192, F.L('row 4 → R3', '第 4 行 → R3')))):
        o = 304 * k
        F.text(o + 150, 22, addr, 16, INK, 'middle', '600')
        for j, (lab, v) in enumerate(((str(a), a), (F.L('mask ', '掩码 ') + str(m), m), ('AND', a & m))):
            y = 40 + 44 * j
            F.text(o + 82, y + 22, lab, 15, MUTED if j < 2 else INK, 'end', '600' if j == 2 else None)
            s = format(v, '08b')
            bits(F, o + 90, y, s, w=24, h=30, fill=BLUE_SOFT if j == 1 else ('#ffffff' if j == 0 else GREEN_SOFT),
                 stroke=BLUE if j == 1 else (MUTED if j == 0 else GREEN), size=15)
        F.line(o + 90, 124, o + 280, 124, INK, 1.4)
        F.text(o + 150, 196, f'= {a & m} → {addr.rsplit(".", 1)[0]}.0  ✓', 15, GREEN, 'middle', '600')
        F.text(o + 150, 174, row, 15, INK, 'middle')
    return F.svg()


DV_POS = {'A': (70, 150), 'B': (210, 54), 'C': (390, 54), 'D': (530, 150), 'E': (210, 246), 'F': (390, 246)}
DV_EDGES = (('A', 'B'), ('A', 'E'), ('B', 'C'), ('B', 'F'), ('C', 'E'), ('C', 'D'), ('E', 'F'), ('D', 'F'))


def fig_dv_net(lang, costs=False):
    """Question 10's six routers; with `costs`, C's three links and their lengths."""
    F = Fig(600, 300, lang)
    cost = {('B', 'C'): 7, ('C', 'D'): 4, ('C', 'E'): 6}
    for a, b in DV_EDGES:
        c = cost.get((a, b)) if costs else None
        (x1, y1), (x2, y2) = DV_POS[a], DV_POS[b]
        F.line(x1, y1, x2, y2, BLUE if c else INK, 3 if c else 1.6)
        if c:
            t = 0.3 if (a, b) == ('C', 'E') else 0.5  # C-E crosses B-F at its middle
            mx, my = x1 + (x2 - x1) * t, y1 + (y2 - y1) * t
            dx, dy = {('B', 'C'): (0, -14), ('C', 'D'): (18, -8), ('C', 'E'): (18, 6)}[(a, b)]
            F.text(mx + dx, my + dy, str(c), 18, BLUE, 'middle', '600')
    for n, (x, y) in DV_POS.items():
        hot = costs and n == 'C'
        F.circle(x, y, 20, BLUE_SOFT if hot else '#ffffff', BLUE if hot else INK, 2 if hot else 1.6)
        F.text(x, y + 6, n, 17, INK, 'middle', '600')
    return F.svg()


def fig_dgvc(lang):
    """Datagrams find their own way, packet by packet; a virtual circuit is set up once and every packet follows it."""
    F = Fig(600, 268, lang)
    pos = {'A': (40, 140), 'B': (140, 70), 'C': (140, 210), 'D': (250, 140)}
    edges = (('A', 'B'), ('A', 'C'), ('B', 'D'), ('C', 'D'), ('B', 'C'))
    for k, title in enumerate((F.L('datagram', '数据报'), F.L('virtual circuit', '虚电路'))):
        o = 304 * k
        F.text(o + 145, 24, title, 17, INK, 'middle', '600')
        for a, b in edges:
            (x1, y1), (x2, y2) = pos[a], pos[b]
            F.line(o + x1, y1, o + x2, y2, LINE, 2)
        if k == 0:
            poly(F, [(o + 40, 132), (o + 140, 62), (o + 250, 132)], BLUE, 3)
            poly(F, [(o + 40, 148), (o + 140, 218), (o + 250, 148)], PURPLE, 3)
            F.text(o + 90, 80, '1  3', 15, BLUE, 'middle', '600')
            F.text(o + 90, 214, '2  4', 15, PURPLE, 'middle', '600')
            F.text(o + 145, 258, F.L('full address in every packet', '每个包都带完整地址'), 14, MUTED, 'middle')
        else:
            poly(F, [(o + 40, 140), (o + 140, 70), (o + 250, 140)], GREEN, 4)
            F.text(o + 84, 86, '1 2 3 4', 15, GREEN, 'middle', '600')
            F.text(o + 196, 86, 'VC 7', 15, GREEN, 'middle', '600')
            F.text(o + 145, 258, F.L('short VC number in every packet', '每个包只带短的虚电路号'), 14, MUTED, 'middle')
        for n, (x, y) in pos.items():
            F.circle(o + x, y, 15, '#ffffff', INK, 1.6)
            F.text(o + x, y + 5, n, 15, INK, 'middle', '600')
    return F.svg()


def fig_windows(lang):
    """A TCP sender between two limits: the network's (congestion window) and the receiver's free buffer (flow control window)."""
    F = Fig(600, 236, lang)
    F.rect(10, 92, 96, 60, GREY_SOFT, INK, 1.6)
    F.text(58, 127, F.L('sender', '发送方'), 16, INK, 'middle', '600')
    for k, x in enumerate((176, 270, 364)):
        F.circle(x, 122, 22, '#ffffff', INK, 1.6)
        F.text(x, 127, 'R', 15, INK, 'middle')
        for q in range(4):
            full = q < (3 if k == 1 else 1)
            F.rect(x - 18 + 9 * q, 154, 8, 14, ORANGE if full else '#ffffff', MUTED, 0.8, rx=1)
    for a, b in ((106, 154), (198, 248), (292, 342), (386, 452)):
        F.line(a, 122, b, 122, INK, 1.8, arrow=True)
    F.rect(456, 92, 134, 60, '#ffffff', INK, 1.6)
    F.text(523, 116, F.L('receiver', '接收方'), 16, INK, 'middle', '600')
    for q in range(8):
        F.rect(466 + 14.5 * q, 126, 12, 16, GREEN if q < 5 else '#ffffff', GREEN, 1, rx=1)
    F.text(270, 40, F.L('congestion window', '拥塞窗口'), 16, ORANGE, 'middle', '600')
    F.text(270, 62, F.L('what the network can take', '网络承受得了多少'), 15, MUTED, 'middle')
    F.text(523, 40, F.L('flow control window', '流量控制窗口'), 16, GREEN, 'middle', '600')
    F.text(523, 62, F.L('free buffer space', '缓冲区剩余空间'), 15, MUTED, 'middle')
    F.text(270, 196, F.L('router queues', '路由器队列'), 15, MUTED, 'middle')
    F.text(58, 196, 'min(cwnd, rwnd)', 15, INK, 'middle', '600')
    F.text(58, 218, F.L('per RTT', '每个 RTT'), 14, MUTED, 'middle')
    return F.svg()


def fig_dns_lb(lang):
    """Load distribution: one name, three addresses, handed out in a rotating order; each client takes the first."""
    F = Fig(600, 252, lang)
    F.rect(10, 96, 140, 60, BLUE_SOFT, BLUE, 1.6)
    F.text(80, 122, F.L('name server', '域名服务器'), 15, INK, 'middle', '600')
    F.text(80, 143, 'www.shop.com', 14, MUTED, 'middle')
    orders = (('.1', '.2', '.3'), ('.2', '.3', '.1'), ('.3', '.1', '.2'))
    for k, order in enumerate(orders):
        y = 30 + 82 * k
        F.line(152, 126, 214, y + 22, MUTED, 1.4, arrow=True)
        F.rect(218, y + 4, 128, 36, '#ffffff', MUTED, 1.2, rx=4)
        F.rect(222, y + 8, 38, 28, GREEN_SOFT, None, rx=3)
        for j, ip in enumerate(order):
            F.text(241 + 41 * j, y + 28, ip, 15, GREEN if j == 0 else INK, 'middle', '600' if j == 0 else None)
        F.text(386, y + 28, F.L(f'client {k + 1}', f'客户 {k + 1}'), 15, INK, 'middle')
    for k, ip in enumerate(('.1', '.2', '.3')):
        y = 30 + 82 * k
        F.rect(488, y + 4, 102, 36, GREY_SOFT, INK, 1.4)
        F.text(539, y + 28, F.L('server ', '服务器 ') + ip, 15, INK, 'middle')
        F.line(424, y + 22, 484, y + 22, GREEN, 2, arrow=True)
    return F.svg()


def fig_jitter(lang):
    """Packets sent evenly arrive unevenly; a big buffer plays them all, late; a small buffer plays soon and skips a late one."""
    F = Fig(600, 300, lang)
    x0, gap = 110, 50
    arrive = [40, 70, 52, 128, 60, 78]
    rows = ((40, F.L('sent', '发出')), (110, F.L('arrive', '到达')), (190, F.L('large buffer', '大缓冲')), (262, F.L('small buffer', '小缓冲')))
    for y, lab in rows:
        F.text(8, y + 5, lab, 15, INK, weight='600')
        F.line(x0 - 10, y, 590, y, LINE, 1.4)
    for i, d in enumerate(arrive):
        xs = x0 + gap * i
        xa = xs + d
        F.circle(xs, 40, 6, BLUE, None)
        F.line(xs, 46, xa, 104, LINE, 1.2)
        F.circle(xa, 110, 6, ORANGE if i == 3 else BLUE, None)
        F.circle(xs + 140, 190, 6, GREEN, None)
        late = i == 3
        xp = xs + 80
        if late:
            F.cross(xp, 262, 7)
        else:
            F.circle(xp, 262, 6, GREEN, None)
    F.line(x0, 222, x0 + 140, 222, MUTED, 1.4, arrow=True)
    F.text(x0 + 70, 216, F.L('waits 140', '等 140'), 14, MUTED, 'middle')
    F.line(x0, 292, x0 + 80, 292, MUTED, 1.4, arrow=True)
    F.text(x0 + 40, 286, F.L('waits 80', '等 80'), 14, MUTED, 'middle')
    F.text(x0 + gap * 3 + 80, 246, F.L('too late: skipped', '迟到：跳过'), 14, ORANGE, 'middle', '600')
    return F.svg()


def fig_keys(lang):
    """Symmetric: one shared key that must travel secretly. Public key: anyone locks with Bob's public key; only his private key opens."""
    F = Fig(600, 264, lang)

    def key(x, y, label, fill, stroke):
        F.rect(x - 34, y - 16, 68, 30, fill, stroke, 1.6, rx=15)
        F.text(x, y + 5, label, 15, stroke, 'middle', '600')

    for k, (title, y) in enumerate(((F.L('symmetric', '对称密钥'), 30), (F.L('public key', '公钥'), 160))):
        F.text(8, y, title, 17, INK, weight='600')
        F.rect(10, y + 20, 92, 44, '#ffffff', INK, 1.4)
        F.text(56, y + 47, 'Alice', 16, INK, 'middle', '600')
        F.rect(498, y + 20, 92, 44, '#ffffff', INK, 1.4)
        F.text(544, y + 47, 'Bob', 16, INK, 'middle', '600')
        F.line(102, y + 42, 494, y + 42, MUTED, 1.8, arrow=True)
        F.rect(250, y + 28, 100, 28, GREY_SOFT, MUTED, 1.2, rx=4)
        F.text(300, y + 47, F.L('ciphertext', '密文'), 14, INK, 'middle')
        if k == 0:
            key(170, y + 42, 'K', GREEN_SOFT, GREEN)
            key(430, y + 42, 'K', GREEN_SOFT, GREEN)
            F.line(170, y + 82, 430, y + 82, GREEN, 1.6, '5 5')
            F.text(300, y + 102, F.L('the same key, shared in secret first', '同一把钥匙，得先秘密地交给对方'), 14, GREEN, 'middle')
        else:
            key(170, y + 42, 'E_{B}', BLUE_SOFT, BLUE)
            key(430, y + 42, 'D_{B}', RED_SOFT, ORANGE)
            F.text(170, y + 88, F.L("Bob's public key: anyone", 'Bob 的公钥：人人可用'), 14, BLUE, 'middle')
            F.text(430, y + 88, F.L('private: only Bob', '私钥：只有 Bob 有'), 14, ORANGE, 'middle')
    return F.svg()


MITM = [  # (from, to, en, zh, colour)
    ('A', 'T', "Bob's public key?", 'Bob 的公钥？', INK),
    ('T', 'A', 'E_{T}  (a fake page)', 'E_{T}（假页面）', ORANGE),
    ('A', 'T', 'E_{T}(P)', 'E_{T}(P)', INK),
    ('T', 'B', "E_{B}(P')", "E_{B}(P')", ORANGE),
]


def fig_mitm(lang):
    """Trudy answers for Bob's web page with her own key, reads (and may change) Alice's message, and passes it on to Bob."""
    F = Fig(600, 318, lang)
    X = {'A': 70, 'T': 300, 'B': 530}
    for k, name in (('A', 'Alice'), ('T', 'Trudy'), ('B', 'Bob')):
        F.rect(X[k] - 56, 10, 112, 34, RED_SOFT if k == 'T' else GREY_SOFT, ORANGE if k == 'T' else INK, 1.6)
        F.text(X[k], 33, name, 17, ORANGE if k == 'T' else INK, 'middle', '600')
        F.line(X[k], 44, X[k], 300, LINE, 1.8)
    for n, (a, b, en, zh, col) in enumerate(MITM, 1):
        y = (92, 142, 192, 280)[n - 1]
        right = X[b] > X[a]
        F.line(X[a] + (4 if right else -4), y, X[b] - (6 if right else -6), y, col, 2.2, arrow=True)
        F.text(X[a] + 12 if right else X[a] - 12, y - 9, F.L(en, zh), 16, col, 'start' if right else 'end', '600' if col != INK else None)
        if n == 3:
            F.rect(X['T'] - 82, y + 12, 164, 32, RED_SOFT, ORANGE, 1.4)
            F.text(X['T'], y + 33, F.L('D_{T}: reads, changes P', 'D_{T}：读到、改掉 P'), 15, ORANGE, 'middle', '600')
    return F.svg()


# ---------------------------------------------------------------- the lessons
# As in the sample-question unit: the question as printed and a slow read of it; the ideas it needs from the
# ground up; the answer built link by link, then a full-mark answer as written on the paper; the wider topic;
# practice. Where two questions share a lesson, each has its own chapter.
def L_pe_start():
    return dict(
        id=f'{CID}-pe-start', title=T('Start here: the practice exam, question by question', '从这里开始：模拟卷逐题看一遍'),
        description=T('What each of the eighteen questions asks, which lesson teaches it, and how the marks tell you what to write.', '十八道题各问什么、在哪一课讲，以及怎样从分值看出该写什么。'),
        minutes=8,
        skills=[{'id': 'it-pe.map', 'name': T('Reading the practice exam', '读懂模拟卷')}],
        steps=[
            read('paper', T('The practice exam, question by question', '模拟卷：每道题问什么'),
                 p(T(r"The practice exam has 18 questions worth 60 marks, and walks through the layers in the course's order: the physical layer, the data link layer and the MAC sublayer, the network layer, the transport layer, the application layer, and security. Unlike the sample questions of the review lectures, it reaches the lower layers too, and five of its questions need a calculation.",
                     r"模拟卷一共 18 道题，60 分，按课程的顺序把各层走一遍：物理层、数据链路层和 MAC 子层、网络层、传输层、应用层、网络安全。和复习课的样题不同，它把下面几层也考到了，还有五道题要算。")),
                 p(T(r"Here is each question as a story. Questions 5 and 16 are taught in the unit before this one; every other question has a lesson here, which starts with the question exactly as printed.",
                     r"先用一句话看看每道题讲的是一件什么事。第 5 题和第 16 题在前一个单元里讲过；其余每道题在这里都有一课，每一课都从题目原文开始。")),
                 table([T('Q', '题'), T('Marks', '分'), T('The situation', '题目里发生的事'), T('Lesson', '在哪一课')],
                       ['1', '4', T('Fibre or copper: what each is good at, and what each costs.', '光纤还是铜线：各自擅长什么，各自要付出什么。'), T('The cable and the signal', '线缆与信号')],
                       ['2', '4', T("A line whose bandwidth cannot change must carry three times the bits; and a telephone line's top speed.", '带宽不能变的线路要传三倍的位；以及一条电话线最快能多快。'), T('The cable and the signal', '线缆与信号')],
                       ['3', '4', T('The data inside a frame happens to contain the byte that marks the end of a frame.', '帧里的数据恰好含有标记帧结束的那个字节。'), T('Frames and errors', '成帧与差错')],
                       ['4', '4', T('Two ways to deal with damaged bits: notice them, or repair them.', '对付出错的位有两种办法：发现它，或者修好它。'), T('Frames and errors', '成帧与差错')],
                       ['5', '2', T('A busy office network: which way of sharing the cable wastes less?', '一个很忙的办公室网络：哪种共用电缆的办法浪费更少？'), T('A busy shared channel (sample-question unit)', '忙碌的共享信道（样题单元）')],
                       ['6', '3', T('One frame in a stream is damaged: what the sender and the receiver do.', '一串帧里坏了一个：发送方和接收方各怎么做。'), T('When a frame is lost', '一帧出错之后')],
                       ['7', '2', T('A router reads its table for two arriving packets.', '路由器为两个到达的包查自己的表。'), T('Addresses and the forwarding table', '地址与转发表')],
                       ['8', '4', T('Why split a network into subnets; and how big a block a company needing 1000 addresses gets.', '为什么把网络切成子网；需要 1000 个地址的公司该分多大的块。'), T('Addresses and the forwarding table', '地址与转发表')],
                       ['9', '4', T('Every packet finds its own way, or all follow a path set up in advance.', '每个包各自找路，还是都走事先建好的同一条路。'), T('Routing', '路由')],
                       ['10', '6', T('Router C hears from its neighbours and works out its new routes.', '路由器 C 听到邻居们的消息，算出自己的新路由。'), T('Routing', '路由')],
                       ['11', '4', T('The two windows a TCP sender obeys, and what breaks if it ignores them.', 'TCP 发送方要守的两个窗口，以及不守会坏在哪里。'), T('A TCP connection', '一条 TCP 连接')],
                       ['12', '2', T('Why a client program skips a step that the server needs.', '为什么客户端程序可以省掉服务器必须做的一步。'), T('A TCP connection', '一条 TCP 连接')],
                       ['13', '3', T('Why email needed MIME.', '邮件为什么需要 MIME。'), T('DNS, email and a video call', 'DNS、邮件和视频通话')],
                       ['14', '2', T('Buffering smooths a stream, so why is it a problem on a video call?', '缓冲能让流媒体播放平稳，为什么用在视频会议上就成了问题？'), T('DNS, email and a video call', 'DNS、邮件和视频通话')],
                       ['15', '2', T('What DNS does besides turning names into addresses.', 'DNS 除了把名字变成地址，还做什么。'), T('DNS, email and a video call', 'DNS、邮件和视频通话')],
                       ['16', '3', T('An encrypted file must be read from the middle.', '一个加密文件要从中间开始读。'), T('Encrypting a file (sample-question unit)', '给文件加密（样题单元）')],
                       ['17', '4', T('Two families of ciphers: one key, or a pair of keys.', '两类密码：一把密钥，还是一对密钥。'), T('Keys', '密钥')],
                       ['18', '3', T('Bob puts his public key on his website: what can go wrong.', 'Bob 把公钥放在个人网站上：会出什么事。'), T('Keys', '密钥')]),
                 ),
            read('marks', T('What the marks tell you', '分值告诉你什么'),
                 p(T(r"Every question shows its marks, and the sample solutions give about one point per mark: four bullets for question 1 (4 marks), two services for question 15 (2 marks). Count the marks before you write, and make each point its own sentence or bullet.",
                     r"每道题都标了分值，参考答案大致是一分一个要点：第 1 题（4 分）写了四条，第 15 题（2 分）写了两项服务。动笔前先数一数分值，每个要点单独写成一句或一条。")),
                 h(T('Questions that compare', '比较题')),
                 p(T(r"A third of the marks ask for differences, or advantages and disadvantages: questions 1, 4, 9, 11 and 17, four marks each. Answer them in matched pairs: say the same aspect for both sides (bandwidth for fibre *and* for copper; the purpose of correction *and* of detection), so the examiner sees a contrast rather than two unrelated lists.",
                     r"三分之一的分数考的是区别或优缺点：第 1、4、9、11、17 题，每题 4 分。答这种题要成对地写：两边说同一个方面（光纤的带宽*和*铜线的带宽；纠错的目的*和*检错的目的），阅卷人看到的是对比，而不是两张不相干的清单。")),
                 h(T('Questions with numbers', '要算的题')),
                 p(T(r"Questions 2, 3, 7, 8 and 10 need numbers. Write the rule, put the numbers in, and end with what the result means: *40 kbps*; *forwarded to R2*; */22, because 1024 is the smallest power of 2 that holds 1000*. The working shows the examiner where the number came from.",
                     r"第 2、3、7、8、10 题要算数。先写规则，再代数，最后说清结果是什么意思：*40 kbps*；*转发给 R2*；*/22，因为 1024 是装得下 1000 的最小的 2 的幂*。过程能让阅卷人看到这个数是怎么来的。")),
                 ),
            read('how', T('How each lesson works', '每一课怎么走'),
                 ol(T(r"**The question**, as printed (in English, with the Chinese under it), then a slow read: what each term means and what exactly is asked.", r"**题目**原文（英文，下面附中文），然后慢慢读一遍：每个术语是什么意思，到底在问什么。"),
                    T(r"**The ideas** the question needs, from the ground up, with figures.", r"**需要的想法**，从头讲起，配上图。"),
                    T(r"**A full-mark answer**: the answer built link by link, then written out as it would earn full marks, with where the marks are.", r"**满分答案**：一环一环把答案搭起来，再按满分标准写出来，并说明分在哪里。"),
                    T(r"**The wider topic**: what else the exam can ask here.", r"**这类题的全貌**：这个话题下考试还可能问什么。"),
                    T(r"**Your turn**: new questions, some answered in your own words and marked by the tutor against the points an examiner looks for.", r"**你来**：新的题，有些要你用自己的话作答，由助教按阅卷人看重的要点来批改。")),
                 callout('note', T('The exam is in English', '考试是英文的'),
                         T(r"The Chinese version keeps the English terms beside the Chinese, and every full-mark answer is in English, so you can write in the words the examiner expects.",
                           r"中文版在专业词旁边保留英文，满分答案也用英文写，方便你直接用阅卷人熟悉的词作答。"))),
        ],
    )


def L_pe_physical():
    CU, FI, SR, NY, SH = 'amu2b9.copper-attenuation', 'amu2b9.fibre-optics', 'amu2b9.symbol-rate', 'd39vec.nyquist-max-rate', 'd39vec.shannon-capacity'
    Q1, Q2 = T('Question 1: fibre or copper', '第 1 题：光纤还是铜线'), T('Question 2: more bits on the same line', '第 2 题：同一条线上多传几位')
    return dict(
        id=f'{CID}-pe-physical', title=T('The cable and the signal: fibre or copper, and more bits per symbol (Q1, Q2)', '线缆与信号：光纤还是铜线，每个符号多带几位（第 1、2 题）'),
        description=T("What fibre and copper each carry well and what each costs; how a line carries more bits without changing its bandwidth; Nyquist's and Shannon's limits; full-mark answers.", '光纤和铜线各擅长什么、各要付出什么；线路带宽不变时怎样多传几位；奈奎斯特和香农的极限；满分答案。'),
        minutes=35,
        skills=skills(CU, FI, SR, NY, SH),
        misconceptions=[{'id': 'triple-levels', 'description': T('Thinking three times the bits needs three times the signal levels', '以为要传三倍的位，就要三倍的电平数')}],
        steps=[
            read('q1', T('Question 1, as printed', '第 1 题原文'),
                 paper(PE(1, 4), T(r"Briefly explain key advantages and disadvantages of using Fibre Optics versus Copper Wire in bullet points.",
                                   r"用要点简要说明使用光纤（Fibre Optics）相对于铜线（Copper Wire）的主要优点和缺点。")),
                 h(T('Reading it slowly', '慢慢读一遍')),
                 ul(T(r"**Copper wire**: the course's two copper cables. **Twisted pair** is two insulated copper wires twisted together (the Ethernet cable); **coaxial cable** is a copper core inside insulation and a metal mesh (cable TV). Both carry bits as an electrical signal.", r"**铜线**：课上讲的两种铜缆。**双绞线**（twisted pair）是两根绝缘铜线绞在一起（网线就是）；**同轴电缆**（coaxial cable）是一根铜芯，外面包着绝缘层和金属网（有线电视用的）。两者都用电信号传位。"),
                    T(r"**Fibre optics**: strands of glass that carry bits as pulses of light.", r"**光纤**：一根根玻璃纤维，用光脉冲传位。"),
                    T(r"**Advantages and disadvantages ... versus**: each side's strengths and weaknesses *compared with the other*. The same few aspects decide both: how far and how fast the cable carries bits, how much noise gets in, and what it costs to buy and install.", r"**优点和缺点……相对于（versus）**：每一边*相对于另一边*的长处和短处。决定两边的是同样几个方面：能传多远、多快，噪声进来多少，以及买和装要花多少。"),
                    T(r"**4 marks, in bullet points**: the sample solution has four bullets: fibre's advantages, fibre's disadvantages, copper's advantages, copper's disadvantages.", r"**4 分，用要点写**：参考答案正好四条：光纤的优点、光纤的缺点、铜线的优点、铜线的缺点。")),
                 chapter=Q1),
            read('media', T('What a cable has to do', '一根线缆要做到什么'),
                 p(T(r"A cable's job is to deliver a signal the receiver can still read. Three things stand in the way. **Attenuation**: the signal gets weaker the farther it travels, which limits how far a cable reaches before a repeater must boost it. **Bandwidth**: the range of frequencies the cable passes, which limits how fast the signal can change, and so how many bits per second it carries (question 2 makes this exact). **Noise and interference**: unwanted signals added on the way, which corrupt bits.",
                     r"线缆的任务是把信号送到对面，而且送到时还读得出来。挡在路上的有三样。**衰减**（attenuation）：信号走得越远越弱，这限制了一根线能传多远，再远就得用中继器把信号放大。**带宽**（bandwidth）：线缆能通过的频率范围，它限制了信号能变化多快，也就限制了每秒能传多少位（第 2 题会把这一点算清楚）。**噪声和干扰**：路上混进来的杂乱信号，会把位弄错。")),
                 svg(drawn(fig_media), T('Top: a copper cable with a signal above it that starts strong and ends weak and noisy; MHz to GHz, a few km. Bottom: a laser, a fibre whose glass core keeps a zig-zag ray of light inside, and a detector; THz, 10 to 200 km.',
                                         '上：一根铜缆，上方的信号开头很强，到末端又弱又带噪声；MHz 到 GHz，几公里。下：激光器、光纤（光线在玻璃纤芯里来回反射）和探测器；THz，10 到 200 公里。'),
                     T(r"Copper's electrical signal fades and picks up noise with distance; fibre's light stays inside the glass core by total internal reflection and reaches much farther.",
                       r"铜线里的电信号越走越弱，还会混进噪声；光纤里的光靠全反射一直留在玻璃纤芯里，能走得远得多。")),
                 p(T(r"**Copper** carries an electrical current. It loses strength with distance and picks up electromagnetic interference from motors, power lines and neighbouring cables. Twisting the pair cancels much of that interference; coax's metal mesh shields it better, so coax goes faster and farther. In the course's numbers, twisted pair runs up to about 5 km (farther with repeaters), from 16 MHz (Cat 3) to 2 GHz (Cat 8) over short runs, and coax approaches 1 GHz. Copper is cheap, and anyone can install it.",
                     r"**铜线**传的是电流。它随距离衰减，还会从电机、电线和旁边的线缆那里接收电磁干扰。把两根线绞起来能抵消大部分干扰；同轴电缆的金属网屏蔽得更好，所以更快、更远。课上的数字：双绞线最远约 5 公里（加中继器还能更远），带宽从 16 MHz（Cat 3）到短距离下的 2 GHz（Cat 8）；同轴电缆接近 1 GHz。铜线便宜，谁都会装。")),
                 p(T(r"**Fibre** carries light. A laser or LED switches the light on and off (light is a 1, no light a 0), total internal reflection keeps it inside the glass core, and a photodetector at the far end turns it back into electrical pulses. Its bandwidth is in terahertz and its loss is very low, so single-mode fibre runs 10 to 200 km between repeaters: that is why the backbone links between ISPs are fibre. Light is not disturbed by electrical interference, and fibre gives off no signal that could be picked up from outside, so it is hard to tap without cutting into it.",
                     r"**光纤**传的是光。激光器或 LED 把光一开一关（有光是 1，没光是 0），全反射把光关在玻璃纤芯里，远端的光电探测器再把它变回电脉冲。它的带宽以太赫兹计，损耗又非常低，所以单模光纤两个中继器之间能隔 10 到 200 公里：ISP 之间的骨干链路都用光纤，原因就在这里。光不受电磁干扰，光纤也不向外泄露信号，不把它切开很难窃听。")),
                 p(T(r"The price of fibre: lasers and detectors cost more; joining two fibres needs specialists and tools (a fusion splice loses under 1%, a connector 10–20%); and glass breaks if it is bent too tightly.",
                     r"光纤的代价：激光器和探测器更贵；把两段光纤接起来需要专业人员和工具（熔接损耗不到 1%，用连接器则损耗 10%–20%）；玻璃弯得太狠就会断。"))),
            read('q1-answer', T('Question 1: a full-mark answer', '第 1 题：满分答案'),
                 p(T(r"Each bullet pairs with one on the other side: fibre's speed and reach against copper's limits, copper's low cost and easy installation against fibre's price.",
                     r"每一条都和另一边的一条对应：光纤的速度和距离对着铜线的局限，铜线的便宜好装对着光纤的贵。")),
                 table([T('Aspect', '方面'), T('Fibre', '光纤'), T('Copper', '铜线')],
                       [T('Bandwidth', '带宽'), T('very high (THz)', '非常高（THz）'), T('lower (MHz to GHz)', '较低（MHz 到 GHz）')],
                       [T('Distance', '距离'), T('tens of km; very low loss', '几十公里；损耗很低'), T('a few km; attenuates', '几公里；会衰减')],
                       [T('Noise', '噪声'), T('immune to electrical interference', '不受电磁干扰'), T('picks up interference', '容易受干扰')],
                       [T('Security', '安全'), T('hard to tap', '难以窃听'), T('easier to tap', '较容易窃听')],
                       [T('Cost', '成本'), T('expensive; specialists to install', '贵；要专业人员安装'), T('cheap; easy to install', '便宜；容易安装')],
                       [T('Handling', '耐用'), T('fragile', '易碎'), T('robust', '结实')]),
                 paper(PEA(1),
                       T(r"Fibre optics, advantages: much higher bandwidth; very low signal loss, so it works over long distances; immune to electromagnetic interference (low noise); difficult to tap.", r"光纤的优点：带宽高得多；信号损耗很低，所以能用于长距离；不受电磁干扰（噪声低）；难以窃听。"),
                       T(r"Fibre optics, disadvantages: expensive (lasers and detectors); needs specialists to install and join; fragile.", r"光纤的缺点：贵（激光器和探测器）；安装和接续需要专业人员；易碎。"),
                       T(r"Copper wire, advantages: cheaper; easy to install, with no specialist skills required.", r"铜线的优点：更便宜；容易安装，不需要专业技能。"),
                       T(r"Copper wire, disadvantages: lower bandwidth; signal attenuation limits the distance; more susceptible to noise and interference.", r"铜线的缺点：带宽较低；信号衰减限制了距离；更容易受噪声和干扰影响。"),
                       answer=True),
                 p(T(r"Four marks, four bullets, each with two or three properties. Adding the reason in a few words (*very low loss, so long distances*) costs little and makes the point unmistakable.",
                     r"4 分，四条，每条两三个特性。顺手用几个词带上理由（*损耗很低，所以能传得远*），花不了多少字，要点却一目了然。"))),
            read('q1-wider', T('Wired or wireless, satellite or fibre', '有线还是无线，卫星还是光纤'),
                 p(T(r"The same kind of question can compare other media. The course's two comparisons:", r"同类的题也可以比较别的介质。课上给过两组比较：")),
                 table([T('Medium', '介质'), T('+', '+'), T('−', '−')],
                       [T('Wireless', '无线'), T('supports mobility and broadcast naturally; easy and cheap to deploy', '天然支持移动和广播；部署容易又便宜'), T('transmissions interfere and must be managed; signal strength and data rate vary greatly', '各路传输会互相干扰，需要管理；信号强度和速率波动很大')],
                       [T('Wired', '有线'), T('easy to keep a fixed data rate; point-to-point', '容易保持固定的速率；点对点'), T('expensive to deploy over distance; no mobility or broadcast', '长距离部署很贵；不支持移动和广播')],
                       [T('Satellite', '卫星'), T('once launched, sets up communication anywhere quickly; broadcasts to large regions', '发射之后，在哪儿都能很快建立通信；能向大片区域广播'), T('limited bandwidth; interference to manage', '带宽有限；要处理干扰')],
                       [T('Fibre', '光纤'), T('enormous bandwidth over long distances', '长距离上的巨大带宽'), T('hard to install in rural areas', '在偏远地区很难铺设')]),
                 p(T(r"Read each row as a trade-off. What the medium is *for* (reaching people who move, covering a whole region, carrying a backbone) decides which column of costs is worth paying.",
                     r"每一行都是一个取舍。介质*用来干什么*（够到移动的人、覆盖整片区域、承载骨干网）决定了哪一列代价值得付。"))),
            read('q2', T('Question 2, as printed', '第 2 题原文'),
                 paper(PE(2, 4), T(r"(1) How can the bit rate of a 1200 kHz line be increased from X bit/s to 3X bit/s without changing the frequency?", r"(1) 在不改变频率的情况下，怎样把一条 1200 kHz 线路的比特率从 X bit/s 提高到 3X bit/s？"),
                       T(r"(2) Consider a telephone line with a bandwidth 4kHz. If we use 32-level digital signals for data transmission, what is the maximum data rate?", r"(2) 一条电话线的带宽是 4 kHz。如果用 32 电平的数字信号传数据，最大数据率是多少？")),
                 h(T('Reading it slowly', '慢慢读一遍')),
                 ul(T(r"**A 1200 kHz line**: its **bandwidth** is 1200 kHz, the range of frequencies it passes. *Without changing the frequency* means the bandwidth stays as it is: the line cannot carry faster changes than it already does.", r"**1200 kHz 的线路**：它的**带宽**是 1200 kHz，即它能通过的频率范围。*不改变频率*，就是带宽保持不变：线路承载的变化不能比现在更快。"),
                    T(r"**Bit rate** (data rate): bits per second. Part (1) wants three times as many on the same line.", r"**比特率**（数据率）：每秒传多少位。第 (1) 问要在同一条线上传三倍的位。"),
                    T(r"**32-level digital signals**: at each moment the signal takes one of 32 distinct values (32 voltages, say).", r"**32 电平的数字信号**：信号在每一时刻取 32 个不同值中的一个（比如 32 种电压）。"),
                    T(r"**Maximum data rate**: the most bits per second the line can carry. The course has one formula for a line without noise (Nyquist) and one for a noisy line (Shannon). This question gives the levels and no noise, so it is Nyquist.", r"**最大数据率**：这条线每秒最多能传多少位。课上有两个公式，一个用于无噪声的线路（奈奎斯特），一个用于有噪声的线路（香农）。这道题给了电平数，没给噪声，所以用奈奎斯特。")),
                 chapter=Q2),
            read('symbols', T('Symbols and bits', '符号和位'),
                 p(T(r"A signal sends data by holding some property (a voltage, an amplitude, a frequency or a phase) at one of several values for a short moment, then switching. Each such moment is a **symbol** (a signal element). The **symbol rate**, or **baud rate**, is how many symbols are sent per second.",
                     r"信号传数据的办法，是让某个物理量（电压、振幅、频率或相位）在一小段时间里保持某个值，然后再换一个值。这样的每一小段叫一个**符号**（symbol，信号单元）。每秒发多少个符号，就是**符号率**，也叫**波特率**（baud rate）。")),
                 p(T(r"With 2 levels a symbol carries 1 bit (low is 0, high is 1). With 4 levels it carries 2 bits (00, 01, 10, 11); with 8 levels, 3 bits; with $V$ levels, $\log_2 V$ bits. So the data rate $R$ (bits per second) is the symbol rate $R_s$ (symbols per second) times the bits per symbol:", r"2 个电平时，一个符号带 1 位（低是 0，高是 1）。4 个电平带 2 位（00、01、10、11）；8 个电平带 3 位；$V$ 个电平带 $\log_2 V$ 位。所以数据率 $R$（每秒多少位）等于符号率 $R_s$（每秒多少个符号）乘以每个符号的位数：")),
                 math_(r'R = R_s \log_2 V'),
                 svg(drawn(fig_levels), T('Two step signals over the same six symbol times. Top: two levels, reading 1 0 1 1 0 0. Bottom: eight levels, reading 101 001 110 011 000 111.',
                                          '同样六个符号时间里的两个阶梯信号。上：两个电平，读出 1 0 1 1 0 0。下：八个电平，读出 101 001 110 011 000 111。'),
                     T(r"The same six symbols: with 2 levels they carry 6 bits, with 8 levels 18 bits.", r"同样六个符号：2 个电平带 6 位，8 个电平带 18 位。")),
                 p(T(r"How fast can the symbols go? A line of bandwidth $B$ cannot follow more than about $2B$ changes per second; the sampling rule says the same from the other end (a signal must be sampled at least twice per cycle of its highest frequency). Nyquist's theorem puts the two together and gives the maximum data rate $R_{\max}$, in bits per second, of a line without noise:",
                     r"符号能发多快？带宽为 $B$ 的线路，每秒最多只能跟上大约 $2B$ 次变化；采样定理从另一头说的是同一件事（采样频率至少是最高频率的两倍）。奈奎斯特定理把两者合起来，给出没有噪声的线路的最大数据率 $R_{\max}$（每秒多少位）：")),
                 math_(r'R_{\max} = 2B\log_2 V'),
                 p(T(r"Two ways to raise it, and only two: a wider bandwidth $B$ (more symbols per second), or more levels $V$ (more bits per symbol).", r"要提高它，只有两条路：更宽的带宽 $B$（每秒更多符号），或者更多电平 $V$（每个符号更多位）。")),
                 quiz(T(r"A line uses 4 signal levels. To send three times as many bits at the same symbol rate, how many levels does it need?", r"一条线用 4 个电平。要在符号率不变的情况下传三倍的位，需要多少个电平？"),
                      [(T('64', '64'), True),
                       (T('12', '12'), T(r"12 levels carry $\log_2 12 \approx 3.6$ bits per symbol, not 6. The bits grow with the logarithm of the levels.", r"12 个电平每个符号只带 $\log_2 12 \approx 3.6$ 位，不是 6 位。位数随电平数的对数增长。")),
                       (T('8', '8'), T(r"8 levels carry 3 bits, only one more than the 2 bits of 4 levels.", r"8 个电平带 3 位，只比 4 个电平的 2 位多 1 位。"))],
                      T(r"4 levels carry 2 bits; three times that is 6 bits per symbol, and $2^6 = 64$ levels. Tripling the bits means cubing the levels.", r"4 个电平带 2 位；三倍就是每个符号 6 位，需要 $2^6 = 64$ 个电平。位数变三倍，电平数要变成立方。"))),
            read('q2-1', T('Part (1): three times the bits, same line', '第 (1) 问：同一条线，三倍的位'),
                 p(T(r"Part (1) asks for no number, only the idea. The bit rate is $2B\log_2 V$. The frequency, and so the bandwidth $B$, must stay as it is, so the symbol rate cannot rise: at most $2 \times 1200\ \text{k} = 2.4$ million symbols per second. What is left to change is $\log_2 V$, the bits per symbol, and it must triple.",
                     r"第 (1) 问不要数，只要想法。比特率是 $2B\log_2 V$。频率不变，也就是带宽 $B$ 不变，所以符号率升不上去：最多每秒 $2 \times 1200\ \text{k} = 240$ 万个符号。剩下能改的只有 $\log_2 V$，即每个符号带的位数，它必须变成三倍。")),
                 table([T('From', '从'), T('To', '到')],
                       [T('2 levels (1 bit per symbol)', '2 个电平（每个符号 1 位）'), T('8 levels (3 bits per symbol)', '8 个电平（每个符号 3 位）')],
                       [T('4 levels (2 bits)', '4 个电平（2 位）'), T('64 levels (6 bits)', '64 个电平（6 位）')],
                       [T('$V$ levels ($A$ bits)', '$V$ 个电平（$A$ 位）'), T('$V^3$ levels ($3A$ bits)', '$V^3$ 个电平（$3A$ 位）')]),
                 p(T(r"So: use more signal levels, so that each symbol carries three times as many bits. Not three times as many levels: the bits grow with the logarithm, so the levels must be cubed. The levels can be voltages, or combinations of amplitude and phase (the course's modulation slide). The catch is that more levels sit closer together, and noise confuses them more easily; Shannon's limit, below, is what stops this from going on forever.",
                     r"所以：用更多的电平，让每个符号带三倍的位。不是三倍的电平数：位数随电平数的对数增长，所以电平数要变成立方。电平可以是电压，也可以是振幅和相位的组合（课上调制那一页）。问题在于电平越多，挨得越近，噪声越容易把它们搞混；后面香农的极限，就是这件事不能无限做下去的原因。"))),
            derive('q2-2', T('Part (2), worked', '第 (2) 问：完整解法'),
                   [(r'R_{\max} = 2B\log_2 V', T(r"No noise is given, so Nyquist's formula applies.", r"题目没给噪声，所以用奈奎斯特公式。")),
                    (r'B = 4000\ \text{Hz},\qquad V = 32', T(r"The telephone line's bandwidth, 4 kHz, and the number of levels.", r"电话线的带宽 4 kHz，以及电平数。")),
                    (r'\log_2 32 = 5', T(r"Each symbol carries 5 bits, because $2^5 = 32$.", r"每个符号带 5 位，因为 $2^5 = 32$。")),
                    (r'2 \times 4000 \times 5 = 40\,000\ \text{bits/s}', T(r"8000 symbols per second, 5 bits each: 40 kbps.", r"每秒 8000 个符号，每个 5 位：40 kbps。"))],
                   blank=(3, '40000', T(r"Put the numbers in: $2 \times 4000 \times 5$. How many bits per second?", r"代入数字：$2 \times 4000 \times 5$。每秒多少位？")),
                   outro=T(r"**Answer:** 40 kbps. A real telephone line has noise, which limits how many of those 32 levels can be told apart; that is Shannon's part, further on.", r"**答案：**40 kbps。真实的电话线有噪声，噪声限制了这 32 个电平里能分辨出几个；这是香农那一部分，后面会讲。"),
                   skill=NY),
            read('q2-answer', T('Question 2: a full-mark answer', '第 2 题：满分答案'),
                 p(T(r"Part (1) is a chain: the bandwidth is fixed, so the symbol rate is fixed; so each symbol must carry more bits; three times as many, for example 2 levels to 8. Part (2): the formula, the numbers, the unit.",
                     r"第 (1) 问是一条链：带宽不变，所以符号率不变；所以每个符号得带更多的位；要三倍，比如从 2 个电平到 8 个。第 (2) 问：公式、代数、单位。")),
                 paper(PEA(2),
                       T(r"(1) The bit rate is (bits per symbol) × (symbol rate), and with the frequency (bandwidth) unchanged the symbol rate cannot increase. So increase the number of bits per symbol from A to 3A by using more signal levels, for example from a 2-level code (1 bit per symbol) to an 8-level code (3 bits per symbol).",
                         r"(1) 比特率 =（每个符号的位数）×（符号率），频率（带宽）不变，符号率就无法提高。所以要用更多的信号电平，把每个符号的位数从 A 提高到 3A，例如从 2 电平编码（每个符号 1 位）改为 8 电平编码（每个符号 3 位）。"),
                       T(r"(2) By Nyquist's theorem, max data rate = 2B log₂V = 2 × 4 kHz × log₂32 = 2 × 4000 × 5 = 40 kbps.", r"(2) 由奈奎斯特定理，最大数据率 = 2B log₂V = 2 × 4 kHz × log₂32 = 2 × 4000 × 5 = 40 kbps。"),
                       answer=True)),
            read('shannon', T('When the line is noisy: Shannon', '线路有噪声时：香农'),
                 p(T(r"More levels cannot go on forever: with noise, levels that are close together can no longer be told apart. Shannon's theorem gives the limit of a noisy line from its bandwidth and its signal-to-noise ratio $S/N$:",
                     r"电平不能无限加下去：有了噪声，挨得太近的电平就分不清了。香农定理根据带宽和信噪比 $S/N$ 给出有噪声线路的极限：")),
                 math_(r'R_{\max} = B\log_2(1 + S/N)'),
                 p(T(r"$S/N$ is usually given in decibels: $\text{dB} = 10\log_{10}(S/N)$, so 20 dB means $S/N = 100$, and 30 dB means 1000.", r"$S/N$ 通常用分贝给出：$\text{dB} = 10\log_{10}(S/N)$，所以 20 dB 就是 $S/N = 100$，30 dB 是 1000。")),
                 p(T(r"When a question gives both the levels and the noise, work out both limits and take the **smaller**: Nyquist says what the levels allow, Shannon what the noise allows. The course's Example 3: a binary signal over a 3 kHz channel at 20 dB. Nyquist: $2 \times 3000 \times \log_2 2 = 6$ kbps. Shannon: $3000 \times \log_2 101 \approx 19.97$ kbps. The binary signal is the bottleneck: 6 kbps.",
                     r"题目同时给了电平和噪声时，两个极限都算，取**小的**那个：奈奎斯特说的是电平允许多少，香农说的是噪声允许多少。课上的例 3：3 kHz 信道、20 dB，传二进制信号。奈奎斯特：$2 \times 3000 \times \log_2 2 = 6$ kbps。香农：$3000 \times \log_2 101 \approx 19.97$ kbps。瓶颈是二进制信号：6 kbps。")),
                 quiz(T(r"Question 2's telephone line (4 kHz, 32 levels) has a signal-to-noise ratio of 20 dB. What is the maximum data rate now?", r"第 2 题的电话线（4 kHz、32 电平）信噪比是 20 dB。现在最大数据率是多少？"),
                      [(T('About 26.6 kbps: the noise allows less than the levels', '约 26.6 kbps：噪声允许的比电平允许的少'), True),
                       (T('40 kbps: the levels decide', '40 kbps：由电平决定'), T(r"Noise limits how many levels can be told apart: Shannon gives $4000 \times \log_2 101 \approx 26.6$ kbps, which is lower.", r"噪声限制了能分辨出几个电平：香农给出 $4000 \times \log_2 101 \approx 26.6$ kbps，更低。")),
                       (T('66.6 kbps: the two together', '66.6 kbps：两者相加'), T(r"Both are upper limits; the line obeys the tighter one.", r"两个都是上限；线路服从更紧的那个。"))],
                      T(r"Nyquist: 40 kbps. Shannon: $4000 \times \log_2(1 + 100) \approx 26.6$ kbps. The smaller wins.", r"奈奎斯特：40 kbps。香农：$4000 \times \log_2(1 + 100) \approx 26.6$ kbps。取小的。")),
                 chapter=WIDER_CH()),
            text_q('try-media', T('Your turn: two campuses', '你来：两个校区'), FI,
                   T(r"A university links two campuses 15 km apart and expects its traffic to keep growing for years. Fibre or copper? Briefly explain.", r"一所大学要连接相距 15 公里的两个校区，预计流量会连年增长。用光纤还是铜线？简要解释。"),
                   [T('Fibre', '光纤'),
                    T('Very low loss: it covers 15 km, while copper attenuates and would need repeaters beyond a few km', '损耗很低：能跨 15 公里，而铜线会衰减，几公里以外就要中继'),
                    T('Much higher bandwidth leaves room for the growing traffic (and it is immune to interference)', '带宽高得多，给不断增长的流量留足余地（而且不受干扰）')],
                   T(r"Fibre. Its very low loss lets one link span 15 km, while copper attenuates and would need repeaters every few kilometres; its far higher bandwidth leaves room for years of growth, and it is immune to electromagnetic interference. The higher cost and the specialist installation are worth paying for a long backbone link.",
                     r"光纤。它的损耗很低，一条链路就能跨 15 公里，而铜线会衰减，每隔几公里就得加中继；它的带宽高得多，能容纳多年的增长，而且不受电磁干扰。对一条长距离的骨干链路来说，更高的成本和专业安装是值得的。"),
                   T(r"Fibre's costs are worth paying where distance and bandwidth matter; copper wins for short, cheap runs inside a building.", r"距离和带宽要紧的地方，光纤的代价值得付；楼里短而便宜的连线，铜线更合适。"),
                   chapter=TRY_CH()),
            number('try-nyquist', T('Your turn: a binary signal', '你来：二进制信号'), NY,
                   T(r"A binary signal (2 levels) is sent over a noiseless 3 kHz channel. What is the maximum data rate, in kbps?", r"在无噪声的 3 kHz 信道上传二进制信号（2 个电平）。最大数据率是多少 kbps？"),
                   6, T(r"$2 \times 3000 \times \log_2 2 = 6000$ bits/s $= 6$ kbps.", r"$2 \times 3000 \times \log_2 2 = 6000$ bit/s $= 6$ kbps。"), tolerance=0, unit='kbps',
                   hints=[T(r"Nyquist: $2B\log_2 V$, with $B = 3000$ Hz and $V = 2$.", r"奈奎斯特：$2B\log_2 V$，其中 $B = 3000$ Hz，$V = 2$。")], purpose='check'),
            choice('try-levels', T('Your turn: twice the bits', '你来：两倍的位'), SR,
                   T(r"A line sends 1 bit per symbol at the highest symbol rate its bandwidth allows. How can it send twice as many bits per second on the same line?", r"一条线以带宽允许的最高符号率发送，每个符号 1 位。怎样在同一条线上每秒传两倍的位？"),
                   [(T('Use 4 signal levels instead of 2', '用 4 个电平代替 2 个'), True),
                    (T('Send the symbols twice as fast', '把符号发快一倍'), T(r"The symbol rate is already at its limit for this bandwidth, $2B$.", r"符号率已经到了这个带宽的极限 $2B$。")),
                    (T('Use 3 signal levels', '用 3 个电平'), T(r"3 levels carry $\log_2 3 \approx 1.58$ bits per symbol, not 2.", r"3 个电平每个符号只带 $\log_2 3 \approx 1.58$ 位，不是 2 位。"), 'triple-levels')],
                   T(r"Twice the bits per symbol: from 1 bit to 2 bits, which needs $2^2 = 4$ levels.", r"每个符号的位数翻倍：从 1 位到 2 位，需要 $2^2 = 4$ 个电平。")),
        ],
    )


def L_pe_frames():
    FR, BY, BI, EC, HD, DC = 'hm4t5u.framing', 'hm4t5u.byte-stuffing', 'hm4t5u.bit-stuffing', 'hm4t5u.error-control', 'hm4t5u.hamming-distance', 'hm4t5u.detection-vs-correction'
    Q3, Q4 = T('Question 3: byte stuffing', '第 3 题：字节填充'), T('Question 4: correct or detect', '第 4 题：纠错还是检错')
    return dict(
        id=f'{CID}-pe-frames', title=T('Frames and errors: byte stuffing, and correcting or detecting (Q3, Q4)', '成帧与差错：字节填充，以及纠错还是检错（第 3、4 题）'),
        description=T('How a receiver finds where a frame ends when the data may contain the end marker, what stuffing costs at worst, and how error correction and error detection differ in purpose and in operation.', '数据里可能含有结束标记时，接收方怎样找到一帧的结尾；填充最多要多花多少；纠错和检错在目的和做法上有什么不同。'),
        minutes=35,
        skills=skills(FR, BY, BI, EC, HD, DC),
        misconceptions=[{'id': 'escape-flags-only', 'description': T('Stuffing only the FLAG bytes and leaving the ESC bytes of the data alone', '只给 FLAG 填充，数据里的 ESC 不管')},
                        {'id': 'detection-locates', 'description': T('Thinking error detection also tells where the error is', '以为检错也能指出错在哪里')}],
        steps=[
            read('q3', T('Question 3, as printed', '第 3 题原文'),
                 paper(PE(3, 4), T(r"(1) The following data fragment appears in the middle of a data stream to which the byte-stuffing algorithm described in the lecture will be applied: A B ESC D FLAG FLAG ESC C", r"(1) 下面这段数据出现在一个数据流的中间，将对它使用课上讲的字节填充算法：A B ESC D FLAG FLAG ESC C"),
                       T(r"Show the output data stream after applying the byte-stuffing algorithm.", r"写出使用字节填充算法之后输出的数据流。"),
                       T(r"(2) What is the maximum overhead in the byte-stuffing algorithm in general and when does it occur?", r"(2) 一般而言，字节填充算法的最大开销是多少？在什么情况下出现？")),
                 h(T('Reading it slowly', '慢慢读一遍')),
                 ul(T(r"**A data stream**: the bytes the data link layer hands to the physical layer. The receiver sees one long run of bytes and must find where each frame begins and ends.", r"**数据流**：数据链路层交给物理层的一串字节。接收方看到的是长长一串字节，得自己找出每一帧从哪儿开始、到哪儿结束。"),
                    T(r"**The byte-stuffing algorithm described in the lecture**: every frame starts and ends with a special byte, **FLAG**; a second special byte, **ESC** (escape), protects data bytes that look special. Both are built up below.", r"**课上讲的字节填充算法**：每一帧以一个特殊字节 **FLAG**（标志）开头和结尾；另一个特殊字节 **ESC**（转义）用来保护那些长得像特殊字节的数据。下面从头讲。"),
                    T(r"**A, B, C, D** are ordinary data bytes. The **FLAG** and **ESC** in the fragment are *data* that happen to have the same value as the special bytes: a photo or a file can contain any byte value.", r"**A、B、C、D** 是普通的数据字节。这段数据里的 **FLAG** 和 **ESC** 是*数据*，只是值恰好和特殊字节一样：一张照片、一个文件里什么字节值都可能出现。"),
                    T(r"**Overhead**: the extra bytes the algorithm adds, compared with the data. *In general* and *when*: the worst case, and the data that causes it.", r"**开销**（overhead）：算法额外加的字节，和数据本身相比。*一般而言*和*在什么情况下*：问的是最坏情况，以及什么样的数据会造成它。")),
                 chapter=Q3),
            read('framing', T('Why frames, and how to mark them', '为什么要分帧，怎样标出帧'),
                 p(T(r"The physical layer delivers bits, with no boundaries. The data link layer cuts the stream into **frames** and gives each its own checksum, so that an error spoils one frame rather than everything after it: the course calls this the primary purpose of framing, some reliability over an unreliable physical layer. For that, the receiver must find each frame's boundaries. The course's three methods:",
                     r"物理层送来的只是一串位，没有边界。数据链路层把这串位切成**帧**（frame），每帧带自己的校验和，这样一个错误只坏掉一帧，而不是后面全部：课上说这是成帧的首要目的，在不可靠的物理层之上提供一点可靠性。为此，接收方得找得到每一帧的边界。课上讲了三种办法：")),
                 ul(T(r"**Byte count**: a field in the header says how many bytes the frame has. One error in that count and the receiver lands in the middle of the next frame, and every frame after it is misread.", r"**字节计数**：帧头里有个字段说明这一帧有多少字节。这个数只要错一次，接收方就会落到下一帧的中间，之后每一帧都读歪。"),
                    T(r"**Flag bytes with byte stuffing**: a special FLAG byte at each end of a frame. The question's method.", r"**标志字节加字节填充**：每帧两头各放一个特殊的 FLAG 字节。就是这道题的办法。"),
                    T(r"**Start and end flags with bit stuffing**: the same idea one bit at a time, in the wider topic below.", r"**首尾标志加位填充**：同样的想法，按位来做，放在后面“这类题的全貌”里。"))),
            read('stuffing', T('Byte stuffing', '字节填充'),
                 p(T(r"A FLAG at each end tells the receiver where a frame starts and stops, and after an error it just waits for the next FLAG to find its place again. The trouble: the data may itself contain a byte equal to FLAG, and the receiver would take it for the end of the frame.",
                     r"两头各一个 FLAG，接收方就知道一帧从哪儿开始、到哪儿结束；出了错，等下一个 FLAG 就能重新对上位置。麻烦在于：数据里也可能有一个和 FLAG 相同的字节，接收方会把它当成帧的结尾。")),
                 p(T(r"The fix is an escape byte, **ESC**. The **sender** puts an ESC in front of every FLAG *and every ESC* that occurs in the data. The **receiver** reads the stream with one rule: an ESC means *the next byte is data, whatever it is*, so it drops the ESC and keeps the byte after it; a FLAG without an ESC in front is a frame boundary.",
                     r"解决办法是一个转义字节 **ESC**。**发送方**在数据中出现的每个 FLAG *和每个 ESC* 前面都加一个 ESC。**接收方**按一条规则读：看到 ESC，就表示*下一个字节是数据，不管它是什么*，于是丢掉这个 ESC，留下它后面那个字节；前面没有 ESC 的 FLAG 就是帧的边界。")),
                 svg(drawn(fig_stuffing), T('Top row: the data A B ESC D FLAG FLAG ESC C. Bottom row: what is sent, A B ESC ESC D ESC FLAG ESC FLAG ESC ESC C, with the four added ESC bytes in orange.',
                                            '上一行：数据 A B ESC D FLAG FLAG ESC C。下一行：实际发出的 A B ESC ESC D ESC FLAG ESC FLAG ESC ESC C，四个加进去的 ESC 用橙色标出。'),
                     T(r"The question's fragment: every FLAG or ESC in the data gets an ESC in front; A, B, C and D pass unchanged.", r"题目里的这段数据：每个 FLAG 或 ESC 前面都加一个 ESC；A、B、C、D 原样通过。")),
                 quiz(T(r"Why must an ESC in the data get an ESC in front of it too, and not only a FLAG?", r"为什么数据里的 ESC 前面也要加 ESC，而不是只给 FLAG 加？"),
                      [(T(r"The receiver treats every ESC as *the next byte is data*; a lone data ESC would swallow the byte after it, such as the frame's closing FLAG", r"接收方把每个 ESC 都当作“下一个字节是数据”；一个没加保护的数据 ESC 会吞掉它后面的字节，比如帧尾的 FLAG"), True),
                       (T(r"To keep the frame length even", r"为了让帧长保持偶数"), T(r"Frames can have any number of bytes; length plays no part here.", r"帧可以是任意字节数；这里和长度无关。")),
                       (T(r"Because ESC and FLAG are the same byte", r"因为 ESC 和 FLAG 是同一个字节"), T(r"They are two different values; that is what lets the receiver tell an escape from a boundary.", r"它们是两个不同的值；正因为不同，接收方才能分清哪个是转义、哪个是边界。"))],
                      T(r"If a data ESC were sent bare, the receiver would take it as an escape and keep the next byte as data. When that next byte is the closing FLAG, the frame never ends.", r"数据里的 ESC 要是原样发出，接收方会把它当转义，把下一个字节当数据收下。下一个字节若正好是帧尾的 FLAG，这一帧就永远结束不了。"))),
            derive('q3-2', T('Part (2): the worst case', '第 (2) 问：最坏情况'),
                   [(r'\text{FLAG} \to \text{ESC FLAG},\qquad \text{ESC} \to \text{ESC ESC}', T(r"Every special byte in the data costs one extra byte; every other byte costs nothing.", r"数据里每个特殊字节多花一个字节；其他字节不花。")),
                    (r'n \;\to\; 2n', T(r"The worst case: all $n$ data bytes are FLAG or ESC. Then every byte is doubled.", r"最坏情况：$n$ 个数据字节全是 FLAG 或 ESC。这时每个字节都变成两个。")),
                    (r'\frac{2n - n}{n} = 100\%', T(r"The overhead measured against the original data: as much again.", r"开销相对于原数据：多出一倍。")),
                    (r'\frac{2n - n}{2n} = 50\%', T(r"Or as a share of what is sent: half of it is escapes. The sample solution accepts both, provided you say which you mean.", r"或者按发出的总量算：一半是转义字节。参考答案两种都认，只要说清是哪一种。"))],
                   blank=(1, '2*n', T(r"All $n$ data bytes are FLAG or ESC. How many bytes are sent?", r"$n$ 个数据字节全是 FLAG 或 ESC。要发多少个字节？"), ['n']),
                   outro=T(r"**Answer:** at most 100% of the data, when the data consists only of FLAG and ESC bytes. Ordinary data needs almost no stuffing: the overhead depends on the data.", r"**答案：**最多是数据量的 100%，出现在数据全是 FLAG 和 ESC 字节时。普通的数据几乎不用填充：开销取决于数据本身。"),
                   skill=BY),
            read('q3-answer', T('Question 3: a full-mark answer', '第 3 题：满分答案'),
                 p(T(r"Part (1) is the stuffed stream, best with the rule in one line, so a slip in copying still shows you know the method. Part (2): the number, the condition, and what the percentage is measured against.",
                     r"第 (1) 问写出填充后的数据流，最好再用一句话写上规则，这样就算抄错一个字节，也看得出你会这个方法。第 (2) 问：数字、条件，以及百分比是相对什么算的。")),
                 paper(PEA(3),
                       T(r"(1) A B ESC ESC D ESC FLAG ESC FLAG ESC ESC C. An ESC byte is inserted before every FLAG or ESC byte that occurs in the data, so the receiver never mistakes data for a frame boundary; it removes each inserted ESC and keeps the byte that follows it.",
                         r"(1) A B ESC ESC D ESC FLAG ESC FLAG ESC ESC C。在数据中出现的每个 FLAG 或 ESC 字节前插入一个 ESC 字节，这样接收方就不会把数据误认为帧边界；接收方去掉每个插入的 ESC，保留其后的字节。"),
                       T(r"(2) The maximum overhead is 100% of the original payload (the stuffed data is twice as long), and it occurs when the payload consists only of FLAG and ESC bytes, since every one of them gets an extra ESC. (As a share of the bytes sent, this is 50%.)",
                         r"(2) 最大开销是原数据的 100%（填充后长度翻倍），出现在数据全部由 FLAG 和 ESC 字节组成时，因为每一个都要多加一个 ESC。（按发出的总字节算，是 50%。）"),
                       answer=True)),
            read('q3-wider', T('Bit stuffing', '位填充'),
                 p(T(r"Bit stuffing does the same one bit at a time. Every frame starts and ends with the flag pattern **01111110** (six 1s). In the data, the sender inserts a **0 after every five consecutive 1s**; the receiver removes a 0 that follows five 1s. So the data never shows six 1s in a row, and the flag cannot appear by accident. Its benefit, from the course: a frame can hold any number of bits, not just whole bytes. Its worst case is one extra bit for every five, 20%.",
                     r"位填充按位做同样的事。每帧以标志 **01111110**（六个 1）开头和结尾。在数据里，发送方**每遇到连续五个 1，就插入一个 0**；接收方把跟在五个 1 后面的 0 去掉。这样数据里永远不会出现连续六个 1，标志也就不会被意外拼出来。课上说它的好处是：一帧可以含任意多个位，不必是整字节。最坏情况是每五位多一位，20%。")),
                 p(T(r"The course's question: is a 0 needed in **0111110111**? Yes: after the first five 1s. Sent: **01111100111**. The last three 1s are fewer than five, so nothing more is added. The point-to-point protocol (PPP), which carries IP over links such as ADSL, frames with flag bytes and byte stuffing.",
                     r"课上的问题：**0111110111** 要不要插 0？要：在前五个 1 后面插。发出 **01111100111**。最后三个 1 不到五个，不再插。点对点协议（PPP，在 ADSL 这类链路上运送 IP）用的就是标志字节加字节填充。"))),
            read('q4', T('Question 4, as printed', '第 4 题原文'),
                 paper(PE(4, 4), T(r"Briefly explain the differences in purpose and operation between the two approaches to handling errors at the Data Link Layer: error correction and error detection, using bullet points.",
                                   r"用要点简要说明数据链路层处理差错的两种方法（纠错和检错）在目的和做法上的区别。")),
                 h(T('Reading it slowly', '慢慢读一遍')),
                 ul(T(r"**Errors**: bits flipped on the way by noise, either one alone (a single-bit error) or several close together (a burst).", r"**差错**：路上被噪声翻转的位，可能是单独一位（单比特错误），也可能是挨在一起的好几位（突发错误）。"),
                    T(r"**Purpose**: what each approach is trying to achieve. **Operation**: what the sender adds and what the receiver does with it.", r"**目的**（purpose）：每种方法想达到什么。**做法**（operation）：发送方加了什么，接收方拿它做什么。"),
                    T(r"**4 marks, bullet points**: one bullet per approach, each with its purpose and its operation.", r"**4 分，用要点写**：每种方法一条，每条写它的目的和做法。")),
                 chapter=Q4),
            read('redundancy', T('Check bits, and how far apart codewords are', '校验位，以及码字之间隔多远'),
                 p(T(r"Both approaches add **check bits** to the data: the data plus its check bits form a **codeword**, and only some bit patterns are valid codewords. A received pattern that is not a valid codeword shows that something went wrong. How much each approach can do depends on how different the valid codewords are from each other.",
                     r"两种方法都在数据后面加**校验位**：数据加校验位构成一个**码字**（codeword），而且只有一部分位组合是合法码字。收到的组合如果不是合法码字，就说明出了错。每种方法能做到多少，取决于合法码字彼此差得有多远。")),
                 p(T(r"The **Hamming distance** of a code is the fewest bit flips that turn one valid codeword into another. The course's first example sends every bit three times: 0 becomes 000 and 1 becomes 111. The distance is 3.",
                     r"一个码的**汉明距离**（Hamming distance），是把一个合法码字变成另一个合法码字最少要翻几位。课上的第一个例子把每一位发三遍：0 变 000，1 变 111。距离是 3。")),
                 svg(drawn(fig_codewords), T('Four patterns in a row: 000 (valid, sent), 001, 011, 111 (valid), one flip apart. One error lands on 001, nearest to 000, and is corrected. Two errors land on 011, nearest to 111, and are corrected wrongly.',
                                             '四个组合排成一行：000（合法，发出的）、001、011、111（合法），相邻的差一位。错一位落在 001，离 000 最近，纠对了。错两位落在 011，离 111 最近，纠错了。'),
                     T(r"Sent 000. One flip gives 001: not valid, so an error is seen, and the nearest codeword, 000, is the right one. Two flips give 011: still not valid, so the error is still seen, but the nearest codeword is now 111.",
                       r"发的是 000。翻一位得到 001：不合法，看得出出了错，而且最近的码字 000 正是原来的。翻两位得到 011：仍不合法，错误还看得出来，可最近的码字变成了 111。")),
                 p(T(r"That picture is the whole difference. **Detecting** an error only needs the received pattern to be invalid: with distance $d + 1$, any $d$ errors cannot turn one codeword into another, so up to $d$ errors are always seen. **Correcting** needs the received pattern to be closer to the codeword that was sent than to any other: that takes distance $2d + 1$ to correct $d$ errors. Here, distance 3 detects 2 errors but corrects only 1.",
                     r"这张图就是两者的全部区别。**检错**只要求收到的组合不合法：距离为 $d + 1$ 时，任何 $d$ 个错都不可能把一个码字变成另一个，所以最多 $d$ 个错一定能被发现。**纠错**要求收到的组合离原来的码字比离任何别的码字都近：要纠正 $d$ 个错，距离得是 $2d + 1$。这里距离 3，能检出 2 个错，却只能纠正 1 个。"))),
            read('which', T('Repair it, or ask again', '自己修，还是请对方重发'),
                 p(T(r"So the two approaches answer an error differently:", r"所以两种方法对付差错的方式不一样：")),
                 ul(T(r"**Error correction** (forward error correction): the sender adds enough redundancy for the receiver to work out *which* bits are wrong and flip them back. Nothing is sent again. The course's code is the **Hamming code**: 4 data bits need 3 check bits to correct any single error.", r"**纠错**（前向纠错）：发送方加足够多的冗余，让接收方能推出*哪几位*错了，再把它们翻回来。不需要重发。课上讲的是**汉明码**：4 个数据位要配 3 个校验位，才能纠正任意一个错。"),
                    T(r"**Error detection**: the sender adds just enough redundancy for the receiver to tell *that* a frame is damaged, not where or how many bits. The receiver discards the frame, and the frame is sent again (the next lesson's retransmission). The course's codes: a **parity bit**, the **Internet checksum**, a **CRC**.", r"**检错**：发送方只加够让接收方看出帧*坏了*的冗余，看不出坏在哪儿、坏了几位。接收方丢掉这一帧，由对方重发（下一课讲的重传）。课上讲的是**奇偶校验位**、**互联网校验和**、**CRC**。")),
                 p(T(r"Which is more efficient depends on the channel. The course: correction is more efficient on **noisy media** such as wireless, detection on **media with low error rates** such as quality wires. On a clean link errors are rare, so a few check bits per frame and an occasional resend cost least. On a noisy link many frames would be resent, and the resends could fail too, so it pays to carry the extra bits and repair on arrival. Correction also suits links where there is no time to resend, such as live audio and video.",
                     r"哪个更高效，要看信道。课上说：在**噪声大的介质**（比如无线）上纠错更高效，在**误码率低的介质**（比如质量好的线缆）上检错更高效。干净的链路很少出错，每帧几位校验、偶尔重发一次，代价最小。噪声大的链路上很多帧都得重发，重发还可能再错，不如多带几位冗余，收到就修。来不及重发的场合（比如实时音视频）也适合纠错。"))),
            read('q4-answer', T('Question 4: a full-mark answer', '第 4 题：满分答案'),
                 p(T(r"The answer is two bullets that match point by point: what each wants (recover the data, or only notice the error), what the sender adds (much redundancy, or a little), what the receiver does (fix it, or discard and get it resent).",
                     r"答案是两条逐点对应的要点：各想做到什么（恢复数据，还是只发现错误），发送方加了什么（很多冗余，还是一点点），接收方怎么做（修好，还是丢掉等重发）。")),
                 table([T('Aspect', '方面'), T('Error correction', '纠错'), T('Error detection', '检错')],
                       [T('Purpose', '目的'), T('recover the original data at the receiver', '在接收方恢复原数据'), T('find out that an error occurred', '发现出了错')],
                       [T('Sender adds', '发送方加'), T('enough redundancy to locate the errors (e.g. Hamming code)', '足以定位错误的冗余（比如汉明码）'), T('just enough to see an error (parity, checksum, CRC)', '刚够发现错误的冗余（奇偶校验、校验和、CRC）')],
                       [T('Receiver', '接收方'), T('corrects the bits, no retransmission', '把位改回来，不用重发'), T('discards the frame; it is retransmitted', '丢掉这一帧；对方重发')],
                       [T('Suits', '适合'), T('noisy channels (wireless)', '噪声大的信道（无线）'), T('low-error channels (wires, fibre)', '误码率低的信道（线缆、光纤）')]),
                 paper(PEA(4),
                       T(r"Error correction: its purpose is to reconstruct the original data at the receiver without a retransmission. The sender includes enough redundant information in each frame (e.g. a Hamming code) for the receiver to locate the erroneous bits and correct them. It needs more check bits and is efficient on noisy channels such as wireless.",
                         r"纠错：目的是在接收方恢复原数据，无需重传。发送方在每帧中加入足够的冗余信息（例如汉明码），使接收方能定位出错的位并加以纠正。它需要更多校验位，在无线这类噪声大的信道上效率高。"),
                       T(r"Error detection: its purpose is only to let the receiver determine that an error has occurred, so that it can discard the frame and have it retransmitted. The sender adds just enough redundancy (e.g. a parity bit, a checksum or a CRC); the receiver does not count or locate the errors. It needs fewer check bits and is efficient on low-error channels such as quality wires or fibre.",
                         r"检错：目的只是让接收方判断出发生了错误，从而丢弃该帧并请求重传。发送方只加入刚够用的冗余（例如奇偶校验位、校验和或 CRC）；接收方不统计也不定位错误。它需要的校验位更少，在优质线缆或光纤这类低误码信道上效率高。"),
                       answer=True)),
            derive('q4-wider', T('How many errors a code handles', '一个码能对付几个错'),
                   [(r'01 \to 00000\,11111,\qquad 10 \to 11111\,00000', T(r"The course's second example: 2 data bits become 10-bit codewords by repeating each bit five times (00 and 11 become all 0s and all 1s).", r"课上的第二个例子：2 个数据位，每位重复五次，变成 10 位的码字（00 和 11 分别变成全 0 和全 1）。")),
                    (r'd_{\min} = 5', T(r"The closest two codewords differ in 5 places (for instance the first two): the code's Hamming distance $d_{\min}$ is 5.", r"最接近的两个码字有 5 位不同（比如前两个）：这个码的汉明距离 $d_{\min}$ 是 5。")),
                    (r'd + 1 \le 5 \;\Rightarrow\; d = 4', T(r"Detection needs distance $d + 1$: it detects up to 4 errors.", r"检错要距离 $d + 1$：最多检出 4 个错。")),
                    (r'2d + 1 \le 5 \;\Rightarrow\; d = 2', T(r"Correction needs distance $2d + 1$: it corrects up to 2 errors.", r"纠错要距离 $2d + 1$：最多纠正 2 个错。"))],
                   blank=(3, '2', T(r"Correction needs $2d + 1 \le 5$. How many errors can it correct?", r"纠错要求 $2d + 1 \le 5$。最多能纠正几个错？")),
                   intro=T(r"The other questions here usually give a code and ask how many errors it can detect or correct. The rule, from the course: to detect $d$ errors, distance $d + 1$; to correct $d$, distance $2d + 1$. The codes the course names: a parity bit and the Internet checksum have distance 2 (they detect one error); the standard 32-bit CRC has distance 4.",
                           r"这类题通常给一个码，问它能检出或纠正几个错。课上的规则：检出 $d$ 个错要距离 $d + 1$；纠正 $d$ 个要距离 $2d + 1$。课上提到的几种码：奇偶校验位和互联网校验和的距离是 2（能检出一个错）；标准 32 位 CRC 的距离是 4。"),
                   chapter=WIDER_CH(), skill=HD),
            choice('try-stuff', T('Your turn: stuff a fragment', '你来：填充一段数据'), BY,
                   T(r"Byte-stuff the data **FLAG A ESC**.", r"对数据 **FLAG A ESC** 做字节填充。"),
                   [(T('ESC FLAG A ESC ESC: an ESC before the FLAG and before the ESC', 'ESC FLAG A ESC ESC：FLAG 和 ESC 前面各加一个 ESC'), True),
                    (T('ESC FLAG A ESC: an ESC before the FLAG only', 'ESC FLAG A ESC：只在 FLAG 前面加 ESC'), T(r"The ESC in the data needs an ESC in front too, or the receiver will treat it as an escape.", r"数据里的 ESC 前面也要加 ESC，否则接收方会把它当成转义。"), 'escape-flags-only'),
                    (T('FLAG ESC A ESC ESC: an ESC after each special byte', 'FLAG ESC A ESC ESC：每个特殊字节后面加 ESC'), T(r"The escape goes *in front of* the special byte, so the receiver knows before it reads it.", r"转义要放在特殊字节的*前面*，接收方读到之前就知道。"))],
                   T(r"An ESC goes in front of each FLAG and each ESC in the data; A is untouched.", r"数据里的每个 FLAG 和每个 ESC 前面都加 ESC；A 不变。"), chapter=TRY_CH()),
            number('try-distance', T('Your turn: distance 4', '你来：距离 4'), HD,
                   T(r"A code has Hamming distance 4. How many bit errors can it always correct?", r"一个码的汉明距离是 4。它一定能纠正几个位错误？"),
                   1, T(r"Correcting $d$ errors needs $2d + 1 \le 4$, so $d = 1$. (It can detect 3.)", r"纠正 $d$ 个错要 $2d + 1 \le 4$，所以 $d = 1$。（它能检出 3 个。）"), tolerance=0, purpose='check'),
            choice('try-channel', T('Your turn: a noisy link', '你来：一条噪声大的链路'), DC,
                   T(r"A wireless link to a remote sensor loses many frames to noise, and each round trip takes half a second. Detection with retransmission, or correction?", r"一条连到远处传感器的无线链路，很多帧因噪声出错，一个往返要半秒。用检错加重传，还是纠错？"),
                   [(T('Correction: the receiver repairs most frames itself instead of waiting for resends that may fail again', '纠错：接收方自己修好大多数帧，不用等可能再次出错的重发'), True),
                    (T('Detection: it uses fewer check bits', '检错：校验位更少'), T(r"Fewer bits per frame, but many frames would be resent, each costing half a second, and the resends could be damaged too.", r"每帧的位是少了，可很多帧都要重发，每次半秒，重发的还可能再坏。")),
                    (T('Detection: it can locate the error, so the resend is short', '检错：它能定位错误，重发的内容很短'), T(r"Detection does not locate errors; the whole frame is sent again.", r"检错定位不了错误；整帧都要重发。"), 'detection-locates')],
                   T(r"Noisy channel and slow round trips: carrying the extra check bits is cheaper than resending.", r"信道噪声大、往返又慢：多带几位校验，比重发划算。")),
        ],
    )


def L_pe_windows():
    SW, SL = '8zg9fk.stop-and-wait-arq', '8zg9fk.sliding-window'
    return dict(
        id=f'{CID}-pe-windows', title=T('When a frame is lost: Go-Back-N and Selective Repeat (Q6)', '一帧出错之后：回退 N 帧和选择重传（第 6 题）'),
        description=T('Why a sender needs acknowledgements, timeouts and sequence numbers, why it keeps several frames in flight, and what Go-Back-N and Selective Repeat each do when one frame in the middle is damaged.', '发送方为什么需要确认、超时和序号，为什么要同时让好几帧在路上，以及中间一帧坏了时，回退 N 帧和选择重传各怎么做。'),
        minutes=30,
        skills=skills(SW, SL),
        misconceptions=[{'id': 'gbn-sr-mixed', 'description': T('Mixing up which frames Go-Back-N and Selective Repeat send again', '把回退 N 帧和选择重传各重发哪些帧搞混')}],
        steps=[
            read('question', T('The question, as printed', '题目原文'),
                 paper(PE(6, 3), T(r"Give the name of one sliding window protocol and briefly explain how that protocol works at the Data Link Layer when a transmission error occurs.",
                                   r"写出一种滑动窗口协议的名称，并简要说明发生传输错误时，该协议在数据链路层是怎样工作的。")),
                 h(T('Reading it slowly', '慢慢读一遍')),
                 ul(T(r"**A sliding window protocol** lets the sender have several frames on their way before any of them is acknowledged. The course has two: **Go-Back-N** and **Selective Repeat**. Name one.", r"**滑动窗口协议**让发送方在收到确认之前，就能有好几帧同时在路上。课上讲了两种：**回退 N 帧**（Go-Back-N）和**选择重传**（Selective Repeat）。写出其中一种。"),
                    T(r"**A transmission error**: a frame arrives damaged (its checksum fails, so it is thrown away) or does not arrive at all. To the protocol the two look the same: a frame is missing.", r"**传输错误**：一帧到达时坏了（校验和不对，于是被扔掉），或者根本没到。对协议来说两者是一回事：少了一帧。"),
                    T(r"**How that protocol works**: what the receiver does with the missing frame and with the good frames behind it, what tells the sender, and what the sender sends again. 3 marks: the name, the receiver's side, the sender's side.", r"**该协议怎样工作**：接收方怎么处理缺的那一帧、以及排在它后面的好帧，什么告诉发送方出了事，发送方重发什么。3 分：名称、接收方、发送方。")),
                 chapter=Q_CH()),
            read('arq', T('Acknowledge, time out, number the frames', '确认、超时、给帧编号'),
                 p(T(r"Start with the simplest sender: send one frame, wait for an **acknowledgement** (ACK), then send the next. The ACK also protects a slow receiver, which is never sent more than it has acknowledged.", r"从最简单的发送方说起：发一帧，等一个**确认**（ACK），再发下一帧。确认也保护了慢的接收方：它确认多少，才会收到多少。")),
                 p(T(r"On a noisy channel, frames get lost or damaged, and a damaged frame is discarded, so it is a loss too. The sender would wait forever, so it starts a **timer** for each frame and sends the frame again if no ACK comes back in time. But perhaps the frame arrived and only the ACK was lost; then the receiver gets the same frame twice. So frames carry **sequence numbers**, and the receiver can tell a new frame from a copy. ACKs, timeouts and sequence numbers together are **ARQ** (automatic repeat request). Sending one frame at a time this way is **stop-and-wait**.",
                     r"信道有噪声时，帧会丢或坏，坏的帧会被扔掉，所以也等于丢了。发送方会永远等下去，于是它给每帧开一个**计时器**，到时还没等到确认，就重发。可也许帧到了，丢的只是确认；那接收方就会收到同一帧两次。所以帧要带**序号**，接收方才能分清新帧和副本。确认、超时、序号合起来叫 **ARQ**（自动重传请求）。这样一次只发一帧，就是**停等协议**（stop-and-wait）。")),
                 chapter=IDEAS_CH()),
            derive('utilisation', T('How much of the link stop-and-wait uses', '停等协议用掉了多少链路'),
                   [(r'U = \frac{T_f}{T_f + 2T_p}', T(r"Each cycle: $T_f$ to put the frame on the link (the transmission delay), $T_p$ for it to reach the receiver, $T_p$ for the ACK to come back. The link carries data only during $T_f$; the **utilisation** $U$ is that share.", r"每一轮：$T_f$ 把帧放上链路（发送时延），$T_p$ 传到接收方，再 $T_p$ 等确认回来。链路只有在 $T_f$ 里在运数据；**利用率** $U$ 就是这一段所占的比例。")),
                    (r'T_f = \frac{L}{B} = \frac{10\,000}{1\,000\,000}\ \text{s} = 10\ \text{ms}', T(r"The course's example: a 10 kb frame on a 1 Mbps link, with $T_p = 50$ ms.", r"课上的例子：1 Mbps 的链路，10 kb 的帧，$T_p = 50$ ms。")),
                    (r'U = \frac{10}{10 + 2 \times 50} = \frac{10}{110} \approx 9.1\%', T(r"The sender spends 100 ms of every 110 waiting.", r"每 110 ms 里，发送方有 100 ms 在等。")),
                    (r'N \ge \frac{T_f + 2T_p}{T_f} = 11', T(r"To keep the link busy, the sender must have enough frames in flight to fill a whole cycle: 11 here.", r"要让链路一直忙，发送方得有足够多的帧在路上，填满一整轮：这里要 11 帧。"))],
                   blank=(1, '10', T(r"How long does it take to put a 10 kb frame onto a 1 Mbps link, in ms?", r"把 10 kb 的帧放上 1 Mbps 的链路要多久？单位 ms。")),
                   outro=T(r"That is the reason for sliding windows: keep sending while the ACKs are on their way.", r"这就是滑动窗口的由来：在确认回来的路上，继续发。"),
                   skill=SW),
            read('sliding', T('A window of frames, and an error in the middle', '一窗的帧，中间坏了一个'),
                 p(T(r"In a **sliding window** protocol the sender keeps a **sending window**, the sequence numbers it may send without waiting, and the receiver a **receiving window**, the sequence numbers it will accept. Each ACK slides the sender's window forward. Stop-and-wait is the case of a window of 1.",
                     r"在**滑动窗口**协议里，发送方维护一个**发送窗口**，即不用等就可以发的那些序号；接收方维护一个**接收窗口**，即它肯收的那些序号。每来一个确认，发送窗口就往前滑。停等协议就是窗口为 1 的情形。")),
                 p(T(r"Now the question's case. Frames 0 to 4 are in flight and frame 1 is damaged. Frames 2, 3 and 4 arrive intact, but after a gap. What should the receiver do with them? The two protocols answer differently.",
                     r"现在看题目说的情形。帧 0 到 4 都在路上，帧 1 坏了。帧 2、3、4 完好地到了，可前面缺了一帧。接收方该拿它们怎么办？两个协议的回答不一样。")),
                 svg(drawn(fig_gbn_sr), T('Two timelines with frames 0 to 4 and frame 1 damaged. Go-Back-N: the receiver discards frames 2, 3 and 4; the sender times out and resends 1, 2, 3 and 4. Selective Repeat: the receiver buffers 2, 3 and 4 and sends NAK 1; the sender resends 1 only; the receiver delivers 1 to 4 and sends ACK 4.',
                                          '两条时间线，帧 0 到 4，帧 1 坏了。回退 N 帧：接收方丢弃帧 2、3、4；发送方超时，重发 1、2、3、4。选择重传：接收方缓存 2、3、4，发出 NAK 1；发送方只重发 1；接收方按顺序交付 1 到 4，发出 ACK 4。'),
                     T(r"Left: Go-Back-N throws away everything after the gap and the sender goes back to frame 1. Right: Selective Repeat keeps the good frames and asks for frame 1 alone.", r"左：回退 N 帧把缺口后面的全扔掉，发送方退回帧 1 重来。右：选择重传留下好帧，只要帧 1。")),
                 ul(T(r"**Go-Back-N**: the receiver's window is 1, so it accepts frames only in order. It discards the damaged frame *and every frame after it*, and sends no acknowledgement for them until the next in-sequence frame arrives. The sender's timer for frame 1 runs out, and it goes back: it resends frame 1 and every frame after it. The receiver needs no buffer; the cost is resending good frames.",
                      r"**回退 N 帧**：接收窗口是 1，只按顺序收。它扔掉坏帧*以及后面所有的帧*，在下一个按序的帧到来之前，不为它们发确认。发送方帧 1 的计时器到时，于是退回去：重发帧 1 以及之后的每一帧。接收方不需要缓冲区；代价是好帧也被重发了。"),
                    T(r"**Selective Repeat**: the receiver's window is larger than 1, so it accepts the good frames behind the gap and **buffers** them. It sends a **NAK** (negative acknowledgement) for frame 1, which makes the sender resend it before its timer runs out. The sender resends frame 1 only. When it arrives, the receiver hands frames 1 to 4 to the network layer in order, and its **cumulative ACK** names the highest frame received in order, ACK 4. Nothing good is resent; the cost is the buffer.",
                      r"**选择重传**：接收窗口大于 1，所以缺口后面的好帧它照收，先**缓存**起来。它为帧 1 发一个 **NAK**（否定确认），让发送方不必等计时器到时就重发。发送方只重发帧 1。帧 1 一到，接收方把帧 1 到 4 按顺序交给网络层，并发一个**累积确认**，指明按序收到的最高帧号：ACK 4。好帧一个都不用重发；代价是缓冲区。")),
                 quiz(T(r"Frames 0 to 4 are sent with Go-Back-N and frame 1 is damaged. Which frames does the sender send again?", r"用回退 N 帧发出帧 0 到 4，帧 1 坏了。发送方要重发哪些帧？"),
                      [(T('1, 2, 3 and 4', '1、2、3、4'), True),
                       (T('Only 1', '只有 1'), T(r"That is Selective Repeat. In Go-Back-N the receiver threw 2, 3 and 4 away, so they must come again.", r"那是选择重传。回退 N 帧里接收方把 2、3、4 扔了，所以它们也得重发。")),
                       (T('2, 3 and 4', '2、3、4'), T(r"Frame 1 is the one that was damaged: everything resent starts from it.", r"坏的就是帧 1：重发从它开始。"))],
                      T(r"The receiver accepts only in order, so it discards everything after the gap, and the sender goes back to the damaged frame and resends from there.", r"接收方只按顺序收，缺口之后的全丢；发送方退回坏帧，从那里重发。"))),
            read('answer', T('A full-mark answer', '一份满分答案'),
                 p(T(r"Three marks, three links: the name; what the receiver does with the damaged frame and with the frames behind it; what the sender resends, and what makes it resend. Selective Repeat is written out here; Go-Back-N earns the same marks.",
                     r"3 分，三环：名称；接收方怎么处理坏帧和它后面的帧；发送方重发什么、什么促使它重发。这里写的是选择重传；写回退 N 帧同样得分。")),
                 paper(PEA(6),
                       T(r"Selective Repeat. When a frame arrives damaged (or is lost), the receiver discards it but keeps the correctly received frames that follow it in its buffer, and sends a negative acknowledgement (NAK) for the missing frame. On the NAK (or when its timer expires), the sender retransmits only that frame. When it arrives, the receiver passes it and the buffered frames to the network layer in order, and sends a cumulative acknowledgement for the highest in-order frame received.",
                         r"选择重传（Selective Repeat）。一帧到达时损坏（或丢失）时，接收方丢弃它，但把之后正确收到的帧保存在缓冲区中，并为缺失的帧发送否定确认（NAK）。收到 NAK（或计时器到时）后，发送方只重传这一帧。该帧到达后，接收方把它和缓存的帧按顺序交给网络层，并对按序收到的最高帧发送累积确认。"),
                       T(r"(Alternatively, Go-Back-N: the receiver discards the damaged frame and all frames after it, sending no acknowledgements for them; the sender's timer for the damaged frame expires, and it retransmits that frame and every frame sent after it.)",
                         r"（也可以写回退 N 帧：接收方丢弃损坏的帧以及其后的所有帧，不为它们发送确认；发送方该帧的计时器到时后，重传这一帧以及之后发出的每一帧。）"),
                       answer=True),
                 chapter=PAPER_CH()),
            read('compare', T('Go-Back-N against Selective Repeat', '回退 N 帧对比选择重传'),
                 table([T('Aspect', '方面'), T('Go-Back-N', '回退 N 帧'), T('Selective Repeat', '选择重传')],
                       [T('Receiving window', '接收窗口'), '1', T('more than 1', '大于 1')],
                       [T('Frames after an error', '出错之后的帧'), T('discarded', '丢弃'), T('buffered', '缓存')],
                       [T('Told by', '靠什么得知'), T('a timeout', '超时'), T('a NAK (or a timeout)', 'NAK（或超时）')],
                       [T('Resent', '重发'), T('the lost frame and all after it', '丢的那帧及之后全部'), T('the lost frame only', '只有丢的那帧')],
                       [T('Costs', '代价'), T('bandwidth', '带宽'), T('buffer space at the receiver', '接收方的缓冲区')]),
                 p(T(r"The course sums it up as a trade-off between using the bandwidth efficiently and the buffer space at the data link layer. Go-Back-N also needs its timeout set with care on slow or long links, since a frame may still be on its way when the timer runs out.",
                     r"课上把它总结成一个取舍：带宽用得省，还是数据链路层的缓冲区占得少。回退 N 帧在慢速或长距离的链路上还要小心设置超时：计时器到时，帧可能还在路上。")),
                 h(T('How large a window, with $n$-bit sequence numbers', '序号有 $n$ 位时，窗口能开多大')),
                 p(T(r"Sequence numbers wrap around: with $n$ bits they run from 0 to $2^n - 1$ and start again. The window must be small enough that a resent old frame can never be mistaken for a new one.",
                     r"序号会循环：$n$ 位的序号从 0 数到 $2^n - 1$，再从头开始。窗口必须足够小，保证重发的旧帧永远不会被当成新帧。")),
                 ul(T(r"**Go-Back-N: at most $2^n - 1$.** Suppose the window were all $2^n$ numbers, 0 to 7 with 3 bits. The sender sends 0 to 7, and all eight arrive but every ACK is lost. The sender times out and resends 0 to 7, while the receiver now expects a new frame 0, so it takes the old frame 0 for the new one. One number fewer avoids it.",
                      r"**回退 N 帧：最多 $2^n - 1$。**假设窗口用满全部 $2^n$ 个序号，3 位时就是 0 到 7。发送方发出 0 到 7，八帧都到了，可确认全丢了。发送方超时，重发 0 到 7；接收方此时在等新的帧 0，于是把旧的帧 0 当成了新的。少用一个序号就能避免。"),
                    T(r"**Selective Repeat: at most $2^{n-1}$.** The receiver accepts any frame in its window. If all the ACKs are lost, its window has already moved on by a full window, and the resent old frames must not fall inside it: the two windows must not overlap, so each can be at most half the numbers.",
                      r"**选择重传：最多 $2^{n-1}$。**接收方收窗口里的任何一帧。如果确认全丢了，它的窗口已经往前挪了整整一窗，重发的旧帧绝不能落进新窗口：前后两个窗口不能重叠，所以每个最多只能占一半的序号。")),
                 p(T(r"With 3-bit sequence numbers: Go-Back-N up to 7, Selective Repeat up to 4.", r"序号 3 位时：回退 N 帧最多 7，选择重传最多 4。")),
                 chapter=WIDER_CH()),
            choice('try-sr', T('Your turn: Selective Repeat', '你来：选择重传'), SL,
                   T(r"With Selective Repeat, frames 0 to 5 are sent and frame 3 is damaged. Which frames does the sender send again?", r"用选择重传发出帧 0 到 5，帧 3 坏了。发送方要重发哪些帧？"),
                   [(T('Only 3', '只有 3'), True),
                    (T('3, 4 and 5', '3、4、5'), T(r"That is Go-Back-N. Here the receiver buffered 4 and 5.", r"那是回退 N 帧。这里接收方已经把 4 和 5 缓存了。"), 'gbn-sr-mixed'),
                    (T('0 to 5', '0 到 5'), T(r"Frames 0, 1 and 2 arrived and were acknowledged.", r"帧 0、1、2 都到了，也确认了。"))],
                   T(r"The receiver keeps 4 and 5 and sends a NAK for 3; only 3 is sent again, then 3, 4 and 5 are delivered in order.", r"接收方留着 4 和 5，为 3 发 NAK；只重发 3，然后 3、4、5 按顺序交付。"), chapter=TRY_CH()),
            number('try-window', T('Your turn: the largest window', '你来：最大窗口'), SL,
                   T(r"Selective Repeat uses 4-bit sequence numbers. What is the largest window it can use?", r"选择重传用 4 位序号。窗口最大能开多少？"),
                   8, T(r"$2^{4-1} = 8$: half of the 16 sequence numbers, so that the old and new receiving windows never overlap. (Go-Back-N could use 15.)", r"$2^{4-1} = 8$：16 个序号的一半，这样新旧两个接收窗口才不会重叠。（回退 N 帧可以用 15。）"), tolerance=0, purpose='check'),
            text_q('try-gbn', T('Your turn: Go-Back-N in words', '你来：用自己的话写回退 N 帧'), SL,
                   T(r"Explain how Go-Back-N works at the data link layer when a transmission error occurs.", r"说明发生传输错误时，回退 N 帧在数据链路层是怎样工作的。"),
                   [T('The receiver accepts frames only in order (receiving window 1)', '接收方只按顺序收帧（接收窗口为 1）'),
                    T('It discards the damaged frame and all frames after it, with no acknowledgement for them', '它丢弃坏帧及其后的所有帧，不为它们发确认'),
                    T("The sender's timer for the damaged frame expires, and it resends that frame and all frames after it", '发送方该帧的计时器到时，重发这一帧及其后的所有帧')],
                   T(r"In Go-Back-N the receiver's window is 1, so it accepts frames only in order. When a frame is damaged, the receiver discards it and every frame that follows, and sends no acknowledgement for them. The sender's timer for the damaged frame expires, so it goes back and retransmits that frame and every frame sent after it.",
                     r"回退 N 帧的接收窗口是 1，只按顺序收帧。一帧坏了，接收方丢掉它和后面的每一帧，也不为它们发确认。发送方这一帧的计时器到时，于是退回去，重发这一帧以及之后发出的每一帧。"),
                   T(r"Go-Back-N trades bandwidth (good frames resent) for a receiver that needs no buffer.", r"回退 N 帧用带宽（好帧也重发）换来一个不需要缓冲区的接收方。")),
        ],
    )


ROUTES = [('148.96.39.0', '255.255.255.0', T('Interface 0', 'Interface 0')), ('148.96.39.128', '255.255.255.128', T('Interface 1', 'Interface 1')),
          ('148.96.40.0', '255.255.255.128', 'R2'), ('196.4.153.0', '255.255.255.192', 'R3'), ('default', '', 'R4')]


def L_pe_addresses():
    IP, SN, MK, LP, CI = 'ra9r8e.ip-address-prefix', 'ra9r8e.subnetting', 'ra9r8e.subnet-mask-routing-table', 'ra9r8e.longest-prefix-match', 'ra9r8e.cidr-aggregation'
    Q8, Q7 = T('Question 8: subnets and block sizes', '第 8 题：子网和块的大小'), T('Question 7: reading the routing table', '第 7 题：查路由表')
    return dict(
        id=f'{CID}-pe-addresses', title=T('Addresses, subnets and the forwarding table (Q8, Q7)', '地址、子网与转发表（第 8、7 题）'),
        description=T("How an IPv4 address splits into network and host, what subnetting is for, how big a block 1000 addresses need, and how a router matches a destination against its table's masks.", 'IPv4 地址怎样分成网络和主机两部分，子网划分是为了什么，1000 个地址要多大的块，以及路由器怎样用表里的掩码去匹配目的地址。'),
        minutes=40,
        skills=skills(IP, SN, MK, LP, CI),
        misconceptions=[{'id': 'first-match', 'description': T('Taking the first row that matches instead of the longest matching prefix', '取第一个匹配的行，而不是最长的匹配前缀')}],
        steps=[
            read('q8', T('Question 8, as printed', '第 8 题原文'),
                 paper(PE(8, 4), T(r"(1) What are the main purposes of subnetting? Briefly explain your answer.", r"(1) 子网划分（subnetting）的主要目的是什么？简要解释。"),
                       T(r"(2) Company A requires a block of 1000 IPv4 addresses. To avoid over-allocating a subnet significantly larger than their needs, what should be the length of the network portion for the assigned subnet? Briefly explain your answer.",
                         r"(2) 公司 A 需要一个含 1000 个 IPv4 地址的地址块。为了不分配比需要大得多的子网，分给它的子网的网络部分应该有多长？简要解释。")),
                 h(T('Reading it slowly', '慢慢读一遍')),
                 ul(T(r"**Subnetting**: splitting one network's block of addresses into smaller parts. Built up below, with what it is for.", r"**子网划分**：把一个网络的地址块切成几个更小的部分。下面从头讲，连同它的用处。"),
                    T(r"**A block of 1000 IPv4 addresses**: addresses are handed out in blocks, never one by one. A block's size is always a power of 2, as below.", r"**含 1000 个 IPv4 地址的地址块**：地址是成块分配的，从不一个一个地给。块的大小总是 2 的幂，下面会看到为什么。"),
                    T(r"**The length of the network portion**: the number of leading bits shared by every address in the block, the **prefix length**, written /n.", r"**网络部分的长度**：块内所有地址共有的前面那几位的位数，即**前缀长度**，写作 /n。"),
                    T(r"**Over-allocating ... significantly larger**: choose the smallest block that still holds 1000 addresses.", r"**分配……大得多的**：要选仍然装得下 1000 个地址的最小的块。")),
                 chapter=Q8),
            read('addresses', T('Network and host, prefix and mask', '网络和主机，前缀和掩码'),
                 p(T(r"An IPv4 address is 32 bits, written as four bytes in decimal: **128.18.3.11**. It has two parts. The **network portion**, the leading bits, says which network the address belongs to; the **host portion**, the rest, picks one host on that network. Routers far away look only at the network portion.",
                     r"IPv4 地址有 32 位，写成四个十进制的字节：**128.18.3.11**。它分两部分。前面的**网络部分**说明地址属于哪个网络；后面的**主机部分**在这个网络里挑出一台主机。远处的路由器只看网络部分。")),
                 p(T(r"Addresses are given out in **blocks**: every address in a block has the same network portion, and the host portion runs through every value. A block is named by its **prefix**, the lowest address and the number of network bits: **128.18.3.0/24** is the 256 addresses from 128.18.3.0 to 128.18.3.255. A /n block leaves $32 - n$ host bits, so it holds $2^{32 - n}$ addresses: each bit taken off the prefix doubles the block.",
                     r"地址是**成块**分配的：一个块里所有地址的网络部分都相同，主机部分取遍所有值。一个块用它的**前缀**来称呼，即最低的地址加上网络位数：**128.18.3.0/24** 就是从 128.18.3.0 到 128.18.3.255 的 256 个地址。/n 的块留下 $32 - n$ 位主机位，所以有 $2^{32 - n}$ 个地址：前缀每少一位，块就大一倍。")),
                 svg(drawn(fig_prefix), T('32 bit boxes in four bytes: the first 22 in blue, the network portion; the last 10 in green, the host portion, 2^10 = 1024 addresses; the mask is 255.255.252.0.',
                                          '32 个位格分成四个字节：前 22 个蓝色，是网络部分；后 10 个绿色，是主机部分，2^10 = 1024 个地址；掩码是 255.255.252.0。'),
                     T(r"A /22 block: 22 network bits, the same in every address of the block; 10 host bits, which take all 1024 values.", r"一个 /22 的块：22 位网络位，块内所有地址都一样；10 位主机位，取遍全部 1024 个值。")),
                 p(T(r"The **subnet mask** writes the prefix as an address: 1s over the network portion, 0s over the host portion. A bitwise AND of an address with the mask keeps the network portion and clears the host bits; that is how a router extracts the network from an address.",
                     r"**子网掩码**把前缀写成地址的样子：网络部分全是 1，主机部分全是 0。地址和掩码按位与（AND），就留下网络部分、清掉主机位；路由器就是这样从地址里取出网络的。")),
                 table([T('Prefix', '前缀'), T('Mask', '掩码'), T('Addresses', '地址数')],
                       ['/22', '255.255.252.0', '1024'], ['/23', '255.255.254.0', '512'], ['/24', '255.255.255.0', '256'], ['/25', '255.255.255.128', '128'], ['/26', '255.255.255.192', '64'])),
            read('subnets', T('Subnetting, and what it is for', '子网划分，以及它的用处'),
                 p(T(r"The course's definition: subnetting splits a network into several parts for internal purposes, while it acts like a single network for external users. The course's example is the University of Melbourne, whose ISP gives it one prefix, 128.208.0.0/16. Inside, the university splits it: one part for Electrical Engineering (a /18), one for Arts (a /19), one for Computer Science (a /17), and the rest kept free.",
                     r"课上的定义：子网划分把一个网络切成几部分供内部使用，而对外仍然像一个网络。课上的例子是墨尔本大学：ISP 给了它一个前缀 128.208.0.0/16。在校内，学校把它切开：一部分给电子工程（一个 /18），一部分给文学院（一个 /19），一部分给计算机系（一个 /17），剩下的留着。")),
                 p(T(r"Two purposes follow. **Inside**, the organisation can arrange and manage its own addresses: each department gets a subnet, and the subnets can change without asking the ISP. **Outside**, every router still needs only **one entry**, 128.208.0.0/16, for the whole university, not one per department or per host. Multiplied over every network on the Internet, that keeps routing tables from exploding; only the university's own router needs to know the subnets.",
                     r"由此有两个目的。**对内**，机构可以自己安排和管理地址：每个系一个子网，子网怎么改都不用找 ISP。**对外**，所有路由器仍然只需要为整个大学存**一条**表项，128.208.0.0/16，而不是每个系、每台主机一条。乘上互联网上所有的网络，这就避免了路由表的爆炸；只有学校自己的路由器需要知道各个子网。"))),
            derive('q8-2', T('Part (2): a block for 1000 addresses', '第 (2) 问：给 1000 个地址分块'),
                   [(r'2^9 = 512 < 1000', T(r"A block's size is a power of 2. 9 host bits give 512 addresses: too few.", r"块的大小是 2 的幂。9 位主机位只有 512 个地址：不够。")),
                    (r'2^{10} = 1024 \ge 1000', T(r"10 host bits give 1024: the smallest block that holds 1000.", r"10 位主机位有 1024 个：装得下 1000 的最小的块。")),
                    (r'32 - 10 = 22', T(r"The network portion is what is left of the 32 bits.", r"网络部分就是 32 位里剩下的。")),
                    (r'/22 \;\Leftrightarrow\; 255.255.252.0', T(r"The prefix length, and the same block written as a mask.", r"前缀长度，以及同一个块的掩码写法。"))],
                   blank=(2, '22', T(r"10 host bits out of 32. How long is the network portion?", r"32 位里 10 位是主机位。网络部分有多长？")),
                   outro=T(r"**Answer:** /22. Only 24 addresses go unused; a /21 would hand out 2048, twice what is needed. (In practice a subnet also loses its first and last address to the network itself and to broadcast, leaving 1022 for hosts: still enough.)",
                           r"**答案：**/22。只空出 24 个地址；/21 会给 2048 个，是需要的两倍。（实际中子网的第一个和最后一个地址要留给网络本身和广播，剩 1022 个给主机：仍然够用。）"),
                   skill=IP),
            read('q8-answer', T('Question 8: a full-mark answer', '第 8 题：满分答案'),
                 p(T(r"Part (1): what subnetting is (one block split inside, one network outside), then the two purposes, each with its reason. Part (2): the rule (the smallest power of 2 that holds 1000), the numbers, the prefix.",
                     r"第 (1) 问：子网划分是什么（对内切开一个块，对外是一个网络），再写两个目的，各带理由。第 (2) 问：规则（装得下 1000 的最小的 2 的幂）、数字、前缀。")),
                 paper(PEA(8),
                       T(r"(1) Subnetting splits one network (one address block) into several parts for internal use, for example one per department, while it still appears as a single network to the outside. The organisation can manage and change its subnets internally without involving its ISP, and external routers need only one routing table entry for the whole network rather than one per subnet or host, which avoids routing table explosion.",
                         r"(1) 子网划分把一个网络（一个地址块）切成几部分供内部使用，例如每个部门一个，而对外仍表现为一个网络。机构可以在内部管理和调整子网，无需 ISP 参与；外部路由器只需要为整个网络存一条路由表项，而不是每个子网或每台主机一条，从而避免路由表爆炸。"),
                       T(r"(2) 22 bits (a /22 prefix). The company needs 1000 addresses, and the smallest power of 2 that holds them is 2^10 = 1024 (2^9 = 512 is too small). So the host portion needs 10 bits and the network portion is 32 − 10 = 22 bits.",
                         r"(2) 22 位（/22 前缀）。公司需要 1000 个地址，装得下它们的最小的 2 的幂是 2^10 = 1024（2^9 = 512 不够）。所以主机部分需要 10 位，网络部分是 32 − 10 = 22 位。"),
                       answer=True)),
            read('q7', T('Question 7, as printed', '第 7 题原文'),
                 paper(PE(7, 2), T(r"A router has built the following routing table. The router can directly deliver packets over Interface 0 and Interface 1, or it can forward to routers R2, R3 and R4.",
                                   r"一台路由器建立了下面这张路由表。它可以经由 Interface 0 和 Interface 1 直接投递分组，也可以转发给路由器 R2、R3 和 R4。"),
                       T(r"Describe what the router does if a packet addressed to each of the following destinations is received. (1) 148.96.40.12 (2) 196.4.153.50",
                         r"说明路由器收到目的地址分别为以下地址的分组时会怎么做。(1) 148.96.40.12 (2) 196.4.153.50")),
                 table([T('Start', 'Start'), T('Subnet Mask', 'Subnet Mask'), T('Next Hop', 'Next Hop')], *[[a, m or '', hop] for a, m, hop in ROUTES]),
                 h(T('Reading it slowly', '慢慢读一遍')),
                 ul(T(r"**Start** is the network address of each row, and **Subnet Mask** its mask: together, a prefix. The masks here are /24 (255.255.255.0), /25 (.128) and /26 (.192).", r"**Start** 是每一行的网络地址，**Subnet Mask** 是它的掩码：两者合起来就是一个前缀。这里的掩码是 /24（255.255.255.0）、/25（.128）和 /26（.192）。"),
                    T(r"**Next Hop**: an **interface** means the destination is on a network attached directly to the router, so it delivers the packet itself. **R2, R3, R4** are neighbouring routers to pass the packet to. **default** is the row used when no other row matches.", r"**Next Hop**（下一跳）：**接口**表示目的主机在直接连着路由器的网络上，路由器自己投递。**R2、R3、R4** 是要把分组交给的相邻路由器。**default**（默认）是其他行都不匹配时用的那一行。"),
                    T(r"**Describe what the router does**: for each address, say which row matches and the action: deliver directly over an interface, or forward to a router.", r"**说明路由器会怎么做**：对每个地址，说出哪一行匹配，以及动作：从接口直接投递，还是转发给哪台路由器。")),
                 chapter=Q7),
            read('lookup', T('How a router matches a row', '路由器怎样匹配一行'),
                 p(T(r"For each row, the router ANDs the destination with the row's mask and compares the result with the row's Start. Equal means the destination lies inside that row's block. Two more rules:", r"对每一行，路由器把目的地址和该行的掩码按位与，再和该行的 Start 比较。相等，就说明目的地址落在这一行的块里。还有两条规则：")),
                 ul(T(r"**Longest prefix match**: if several rows match, the row with the longest mask wins, the smallest and most specific block.", r"**最长前缀匹配**：如果有好几行都匹配，掩码最长的那一行胜出，也就是最小、最具体的那个块。"),
                    T(r"**Default**: if no row matches, the packet goes to the default route.", r"**默认路由**：一行都不匹配，分组就走默认路由。")),
                 p(T(r"Only the bytes where the mask is not 255 need any work. A mask byte of 128 keeps the top bit of the address byte; 192 keeps the top two bits.", r"只有掩码不是 255 的那些字节需要动手算。掩码字节 128 保留地址字节的最高一位；192 保留最高两位。")),
                 svg(drawn(fig_and), T('Left: 12 is 00001100; ANDed with 128 (10000000) it gives 0, so 148.96.40.12 becomes 148.96.40.0, the Start of row 3, next hop R2. Right: 50 is 00110010; ANDed with 192 (11000000) it gives 0, so 196.4.153.50 becomes 196.4.153.0, row 4, next hop R3.',
                                       '左：12 是 00001100；和 128（10000000）相与得 0，所以 148.96.40.12 变成 148.96.40.0，即第 3 行的 Start，下一跳 R2。右：50 是 00110010；和 192（11000000）相与得 0，所以 196.4.153.50 变成 196.4.153.0，第 4 行，下一跳 R3。'),
                     T(r"The last byte of each destination, ANDed with its row's mask byte. Both top bits are 0, so both results are 0 and both rows match.", r"每个目的地址的最后一个字节，和对应行的掩码字节相与。两者的最高位都是 0，所以结果都是 0，两行都匹配。"))),
            derive('q7-worked', T('Both destinations, row by row', '两个目的地址，逐行比对'),
                   [(r'148.96.40.12 \wedge 255.255.255.0 = 148.96.40.0', T(r"(1), row 1 ($\wedge$ is bitwise AND). The result is 148.96.40.0, not the row's 148.96.39.0: no match.", r"第 (1) 个，第 1 行（$\wedge$ 表示按位与）。结果是 148.96.40.0，不是该行的 148.96.39.0：不匹配。")),
                    (r'148.96.40.12 \wedge 255.255.255.128 = 148.96.40.0', T(r"Rows 2 and 3 share the mask /25, and $12 \wedge 128 = 0$. The result is not row 2's 148.96.39.128, but it is exactly row 3's Start: a match. Row 4 starts 196, so row 3 is the only match.", r"第 2、3 行的掩码都是 /25，而 $12 \wedge 128 = 0$。结果不是第 2 行的 148.96.39.128，却正好是第 3 行的 Start：匹配。第 4 行以 196 开头，所以第 3 行是唯一的匹配。")),
                    (r'\Rightarrow\ \text{R2}', T(r"Row 3's next hop is a router: forward the packet to R2.", r"第 3 行的下一跳是一台路由器：把分组转发给 R2。")),
                    (r'50 = 00110010_2,\qquad 192 = 11000000_2', T(r"(2): only row 4 starts 196.4.153. Its mask ends in 192, which keeps the top two bits of the last byte.", r"第 (2) 个：只有第 4 行以 196.4.153 开头。它的掩码以 192 结尾，保留最后一个字节的最高两位。")),
                    (r'50 \wedge 192 = 0', T(r"The top two bits of 50 are 00.", r"50 的最高两位是 00。")),
                    (r'196.4.153.50 \wedge 255.255.255.192 = 196.4.153.0', T(r"Exactly row 4's Start: a match. 196.4.153.50 lies in the block 196.4.153.0 to .63.", r"正好是第 4 行的 Start：匹配。196.4.153.50 落在 196.4.153.0 到 .63 这个块里。")),
                    (r'\Rightarrow\ \text{R3}', T(r"Forward the packet to R3.", r"把分组转发给 R3。"))],
                   blank=(4, '0', T(r"50 AND 192: keep the top two bits of 00110010. What is left?", r"50 AND 192：只留下 00110010 的最高两位。结果是多少？")),
                   skill=MK),
            read('q7-answer', T('Question 7: a full-mark answer', '第 7 题：满分答案'),
                 p(T(r"For each address: the AND that shows the match, the row, the action. The sample solution gives only *forwards to R2* and *forwards to R3*; one line of working shows how you got there.",
                     r"每个地址写三样：说明匹配的那次按位与、哪一行、什么动作。参考答案只写了“转发给 R2”和“转发给 R3”；多写一行过程，能看出你是怎么得到的。")),
                 paper(PEA(7),
                       T(r"(1) 148.96.40.12 AND 255.255.255.128 = 148.96.40.0, which matches the third entry (148.96.40.0/25) and no other, so the router forwards the packet to router R2.", r"(1) 148.96.40.12 AND 255.255.255.128 = 148.96.40.0，与第三条表项（148.96.40.0/25）匹配，且不与其他表项匹配，所以路由器把分组转发给路由器 R2。"),
                       T(r"(2) 196.4.153.50 AND 255.255.255.192 = 196.4.153.0, which matches the fourth entry (196.4.153.0/26), so the router forwards the packet to router R3.", r"(2) 196.4.153.50 AND 255.255.255.192 = 196.4.153.0，与第四条表项（196.4.153.0/26）匹配，所以路由器把分组转发给路由器 R3。"),
                       answer=True)),
            read('wider', T('When rows overlap: the longest prefix', '几行重叠时：最长前缀'),
                 p(T(r"Rows 1 and 2 of the question overlap: 148.96.39.0/24 is the whole of 148.96.39.x, and 148.96.39.128/25 is its upper half. An address such as **148.96.39.200** matches both. The longest prefix wins, so it goes out of **Interface 1**. **148.96.39.5** matches row 1 only: Interface 0. An address that matches nothing, such as 8.8.8.8, takes the default route to R4.",
                     r"题目表里第 1 行和第 2 行是重叠的：148.96.39.0/24 是整个 148.96.39.x，148.96.39.128/25 是它的上半部分。像 **148.96.39.200** 这样的地址两行都匹配。最长前缀胜出，所以它从 **Interface 1** 出去。**148.96.39.5** 只匹配第 1 行：Interface 0。什么都不匹配的地址，比如 8.8.8.8，走默认路由去 R4。")),
                 p(T(r"Overlapping rows are deliberate. **CIDR** (classless inter-domain routing) lets a router **aggregate** many prefixes into one larger prefix, which keeps backbone tables small, and longest prefix match lets an exception sit inside it. The course's example: one row sends 192.24.0.0/19 (8192 addresses) towards London, and a second row sends the part 192.24.12.0/22 to San Francisco. A destination in 192.24.12.x matches both and goes to San Francisco; the rest of the /19 goes to London.",
                     r"重叠是故意的。**CIDR**（无类域间路由）让路由器把很多前缀**聚合**成一个更大的前缀，骨干路由器的表就小了；而最长前缀匹配允许在大块里放一个例外。课上的例子：一行把 192.24.0.0/19（8192 个地址）送往伦敦，另一行把其中的 192.24.12.0/22 送往旧金山。目的地址在 192.24.12.x 里的，两行都匹配，去旧金山；/19 的其余部分去伦敦。")),
                 chapter=WIDER_CH()),
            choice('try-overlap', T('Your turn: 148.96.39.200', '你来：148.96.39.200'), LP,
                   T(r"Using the question's routing table, what does the router do with a packet for **148.96.39.200**?", r"用题目里的路由表，路由器收到目的地址为 **148.96.39.200** 的分组会怎么做？"),
                   [(T('Delivers it directly over Interface 1', '从 Interface 1 直接投递'), True),
                    (T('Delivers it directly over Interface 0', '从 Interface 0 直接投递'), T(r"Row 1 matches, but so does row 2, whose /25 prefix is longer.", r"第 1 行匹配，可第 2 行也匹配，而且它的 /25 前缀更长。"), 'first-match'),
                    (T('Forwards it to R4', '转发给 R4'), T(r"The default is used only when no row matches; two rows match here.", r"只有一行都不匹配时才用默认路由；这里有两行匹配。"))],
                   T(r"200 AND 128 = 128, so row 2 matches (148.96.39.128/25), and so does row 1 (/24). The longest prefix wins: Interface 1.", r"200 AND 128 = 128，所以第 2 行（148.96.39.128/25）匹配，第 1 行（/24）也匹配。最长前缀胜出：Interface 1。"), chapter=TRY_CH()),
            choice('try-default', T('Your turn: 148.96.40.200', '你来：148.96.40.200'), MK,
                   T(r"And a packet for **148.96.40.200**?", r"目的地址为 **148.96.40.200** 的分组呢？"),
                   [(T('Forwards it to R4, the default', '转发给默认的 R4'), True),
                    (T('Forwards it to R2', '转发给 R2'), T(r"Row 3 is a /25: it covers 148.96.40.0 to .127 only. 200 AND 128 = 128, not 0.", r"第 3 行是 /25：只覆盖 148.96.40.0 到 .127。200 AND 128 = 128，不是 0。"))],
                   T(r"No row matches 148.96.40.200, so it takes the default route.", r"没有一行和 148.96.40.200 匹配，所以走默认路由。")),
            number('try-300', T('Your turn: 300 addresses', '你来：300 个地址'), IP,
                   T(r"A department needs 300 addresses. What prefix length gives the smallest block that holds them?", r"一个部门需要 300 个地址。多长的前缀给出装得下它们的最小的块？"),
                   23, T(r"$2^8 = 256$ is too few and $2^9 = 512$ is enough, so 9 host bits: $32 - 9 = 23$.", r"$2^8 = 256$ 不够，$2^9 = 512$ 够，所以主机位 9 位：$32 - 9 = 23$。"), tolerance=0, purpose='check',
                   hints=[T(r"Find the smallest power of 2 that is at least 300.", r"找出不小于 300 的最小的 2 的幂。")]),
        ],
    )


def L_pe_routing():
    DG, VC, CM, DV, LS = '4jmwbh.datagram-subnet', '4jmwbh.virtual-circuit-subnet', '4jmwbh.datagram-vs-vc', 'xnze5w.distance-vector', 'xnze5w.link-state'
    Q9, Q10 = T('Question 9: datagrams or virtual circuits', '第 9 题：数据报还是虚电路'), T('Question 10: distance vector routing', '第 10 题：距离向量路由')
    return dict(
        id=f'{CID}-pe-routing', title=T('Routing: datagrams or virtual circuits, and distance vector (Q9, Q10)', '路由：数据报还是虚电路，以及距离向量（第 9、10 题）'),
        description=T("How a connectionless and a connection-oriented network layer route packets and what each costs; how a router builds its routes from its neighbours' distance vectors, worked through question 10's network.", '无连接和面向连接的网络层各怎样为分组选路、各有什么代价；路由器怎样根据邻居的距离向量算出自己的路由，用第 10 题的网络完整算一遍。'),
        minutes=40,
        skills=skills(DG, VC, CM, DV, LS),
        misconceptions=[{'id': 'vc-is-a-wire', 'description': T('Thinking a virtual circuit reserves a wire of its own', '以为虚电路独占一条线路')},
                        {'id': 'dv-own-old', 'description': T("Computing a router's new vector from its own old distances instead of its neighbours' vectors", '用路由器自己的旧距离，而不是邻居的向量，来算新向量')}],
        steps=[
            read('q9', T('Question 9, as printed', '第 9 题原文'),
                 paper(PE(9, 4), T(r"With respect to routing packets in the Network Layer, explain the difference between connectionless and connection-oriented services?",
                                   r"就网络层中分组的路由而言，说明无连接服务和面向连接服务的区别。")),
                 h(T('Reading it slowly', '慢慢读一遍')),
                 ul(T(r"**The network layer** carries packets from the source host to the destination host across a chain of routers.", r"**网络层**把分组从源主机经过一连串路由器送到目的主机。"),
                    T(r"**Connectionless**: nothing is set up before the packets are sent. **Connection-oriented**: a connection is set up first, and the packets then use it.", r"**无连接**：发分组之前什么都不建立。**面向连接**：先建立一条连接，分组再沿着它走。"),
                    T(r"**With respect to routing packets**: the question is about how the route of each packet is chosen, and what that means for the routers, not about reliability in the transport layer.", r"**就分组的路由而言**：问的是每个分组的路线怎么选，以及这对路由器意味着什么，不是传输层的可靠性。"),
                    T(r"**4 marks**: two bullets, each saying how that service routes packets, plus the contrasts that follow from it.", r"**4 分**：两条要点，各说明这种服务怎样给分组选路，再加由此引出的对比。")),
                 chapter=Q9),
            read('dgvc', T('Each packet on its own, or all along one path', '每个分组各走各的，还是都走同一条路'),
                 p(T(r"Routers work by **store-and-forward**: a router receives a whole packet, stores it, and sends it on along the next link towards its destination. The question is how a router decides that next link.",
                     r"路由器的工作方式是**存储转发**：收下一个完整的分组，存起来，再沿着通往目的地的下一条链路发出去。问题是：路由器怎么决定下一条链路？")),
                 svg(drawn(fig_dgvc), T('Two copies of a four-router network. Datagram: packets 1 and 3 go A, B, D and packets 2 and 4 go A, C, D. Virtual circuit: packets 1 to 4 all go A, B, D on circuit VC 7.',
                                        '同一个四台路由器的网络画了两份。数据报：分组 1 和 3 走 A、B、D，分组 2 和 4 走 A、C、D。虚电路：分组 1 到 4 都在虚电路 VC 7 上走 A、B、D。'),
                     T(r"Left: every datagram is looked up on its own, so packets of one message can take different paths. Right: a virtual circuit is set up once, and every packet follows it.", r"左：每个数据报单独查表，同一条消息的分组可能走不同的路。右：虚电路建立一次，之后每个分组都沿着它走。")),
                 ul(T(r"**Connectionless: a datagram network** (the course calls it the post office model). Each packet, a **datagram**, carries the full destination address. Every router looks the address up in its routing table, as in question 7, and forwards the packet. Nothing is set up first, and each packet is routed independently: if a table changes, later packets take another path and may arrive out of order. The Internet's IP works this way.",
                      r"**无连接：数据报网络**（课上叫邮局模式）。每个分组叫一个**数据报**（datagram），带着完整的目的地址。每台路由器在自己的路由表里查这个地址（就像第 7 题那样），再转发出去。事先什么都不建立，每个分组独立选路：路由表一变，后面的分组就走别的路，到达顺序也可能乱。互联网的 IP 就是这样工作的。"),
                    T(r"**Connection-oriented: a virtual-circuit network** (the telephone model). Before any data, a path from the source router to the destination router is set up, a **virtual circuit**, and every router on it records the circuit in a table: *arriving on this line with this circuit number, send out on that line with that number*. Packets then carry only a short circuit number and all follow the same path, in order. MPLS inside ISP networks works this way.",
                      r"**面向连接：虚电路网络**（电话模式）。发数据之前，先从源路由器到目的路由器建好一条路径，叫**虚电路**（virtual circuit），路径上每台路由器都在表里记下这条电路：*从这条线、带这个电路号进来的，从那条线、换那个号出去*。之后分组只带一个短短的电路号，全都沿同一条路按顺序走。ISP 网络内部的 MPLS 就是这样工作的。")),
                 p(T(r"A virtual circuit is *virtual*: it is a row in each router's table, not a wire. The links are still shared with all other traffic.", r"虚电路是*虚*的：它只是每台路由器表里的一行，不是一根线。链路照样和其他所有流量共用。"))),
            read('costs', T('What each one costs', '各自的代价'),
                 table([T('Aspect', '方面'), T('Datagram (connectionless)', '数据报（无连接）'), T('Virtual circuit (connection-oriented)', '虚电路（面向连接）')],
                       [T('Setup', '建立'), T('none', '不需要'), T('required before any data', '发数据前必须建立')],
                       [T('Addressing', '地址'), T('full destination address in every packet', '每个分组带完整目的地址'), T('a short VC number in every packet', '每个分组带一个短的电路号')],
                       [T('Routing', '选路'), T('each packet routed independently', '每个分组独立选路'), T('route chosen once, at setup; all packets follow it', '建立时选一次路，所有分组都沿它走')],
                       [T('Router state', '路由器状态'), T('a table for every possible destination; no per-connection state', '一张覆盖所有目的地的表；不记连接'), T('one entry per circuit through it', '经过它的每条电路一项')],
                       [T('Time', '时间'), T('a longer lookup for every packet', '每个分组查表更费时'), T('setup time, then very fast forwarding', '要花建立时间，之后转发很快')],
                       [T('A router fails', '路由器故障'), T('packets are routed around it', '分组绕过它走'), T('every circuit through it is lost and must be rebuilt', '经过它的电路全部中断，必须重建')],
                       [T('Quality of service', '服务质量'), T('hard to guarantee', '难以保证'), T('easy: resources can be reserved at setup', '容易：建立时可以预留资源')]),
                 p(T(r"The two communities behind them explain the choice, as the course puts it: the Internet community wanted to move packets over a possibly unreliable network and leave flow and error control to other layers; the telecommunications community wanted guaranteed reliability and quality of service.",
                     r"课上说，两种设计背后是两个群体的不同取向：互联网群体想在可能不可靠的网络上把分组送过去，流量和差错控制交给别的层；电信群体要的是有保证的可靠性和服务质量。")),
                 quiz(T(r"A router on the path of several virtual circuits crashes. What happens to them?", r"一台路由器位于好几条虚电路的路径上，它崩溃了。这些电路会怎样？"),
                      [(T(r"Every circuit through it is aborted and has to be set up again", r"经过它的每条电路都中断了，必须重新建立"), True),
                       (T(r"Their packets are routed around it automatically", r"它们的分组会自动绕过它"), T(r"That is what datagrams do. A circuit's path is fixed at setup, so its packets have nowhere else to go.", r"那是数据报的做法。电路的路径在建立时就定了，分组没有别的路可走。")),
                       (T(r"Nothing: the circuit's wire is reserved in advance", r"没事：电路的线路是事先预留好的"), T(r"A virtual circuit is an entry in each router's table, not a wire; the crashed router's entries are gone.", r"虚电路是每台路由器表里的一项，不是一根线；崩溃的路由器里的表项全没了。"), 'vc-is-a-wire')],
                      T(r"The circuit lives in the routers' tables. When a router on the path fails, the circuits through it are lost, and no traffic flows on them until they are rebuilt.", r"电路存在于各路由器的表里。路径上的一台路由器坏了，经过它的电路就没了，重建之前这些电路上没有流量。"))),
            read('q9-answer', T('Question 9: a full-mark answer', '第 9 题：满分答案'),
                 p(T(r"Two bullets, each with how it routes and what follows: no setup and independent routing against a path set up first; the full address against a circuit number; rerouting around failures against circuits lost.",
                     r"两条要点，每条写它怎样选路、由此带来什么：不建立、独立选路，对比先建好一条路径；完整地址，对比电路号；故障时绕路，对比电路中断。")),
                 paper(PEA(9),
                       T(r"Connectionless (datagram) service: no connection is set up in advance. Packets are injected into the network individually; each carries the full destination address and is routed independently of the others, so packets of the same message may take different paths and arrive out of order. Routers keep no per-connection state, and if a router fails, packets can be routed around it.",
                         r"无连接（数据报）服务：事先不建立连接。分组被逐个注入网络；每个分组带完整的目的地址，与其他分组无关地独立选路，所以同一条消息的分组可能走不同的路径、乱序到达。路由器不保存每条连接的状态，某台路由器故障时，分组可以绕过它。"),
                       T(r"Connection-oriented (virtual-circuit) service: a path from the source router all the way to the destination router must be established before any data packets are sent; this connection is called a virtual circuit. Each router on the path records the circuit, packets carry only a short circuit identifier, and all of them follow the same path in order. Setup takes time and router state, and a router failure breaks every circuit through it, but quality of service is easier to provide.",
                         r"面向连接（虚电路）服务：在发送任何数据分组之前，必须先建立一条从源路由器一直到目的路由器的路径，这条连接称为虚电路。路径上每台路由器都记录这条电路，分组只携带一个短的电路标识，并且全部按顺序沿同一路径走。建立需要时间和路由器状态，路由器故障会中断经过它的所有电路，但更容易提供服务质量保证。"),
                       answer=True)),
            read('q10', T('Question 10, as printed', '第 10 题原文'),
                 paper(PE(10, 6), T(r"Distance vector routing is used for a network of six nodes as shown below.", r"一个由六个节点组成的网络（如下图）使用距离向量路由。"),
                       T(r"The following vectors have just come into router C from B: (5, 0, 7, 11, 10, 7); from D: (15, 11, 4, 0, 10, 11); and from E: (5, 10, 6, 10, 0, 3). Each vector contains the distances from a certain node to the other nodes, in the order of (A, B, C, D, E, F). The distances from C to B, D, and E, are 7, 4, and 6, respectively.",
                         r"路由器 C 刚收到以下向量：来自 B 的 (5, 0, 7, 11, 10, 7)；来自 D 的 (15, 11, 4, 0, 10, 11)；来自 E 的 (5, 10, 6, 10, 0, 3)。每个向量按 (A, B, C, D, E, F) 的顺序给出某个节点到其他各节点的距离。C 到 B、D、E 的距离分别是 7、4、6。"),
                       T(r"What is the new vector for C? Show a table of the outgoing lines to use and the expected distances from C to all the other nodes.",
                         r"C 的新向量是什么？列一张表，写出 C 到其他各节点应使用的出口线路和预计距离。")),
                 svg(drawn(fig_dv_net), T('Six routers: A, B, C, D, E, F. Links: A–B, A–E, B–C, B–F, C–D, C–E, D–F, E–F.', '六台路由器：A、B、C、D、E、F。链路：A–B、A–E、B–C、B–F、C–D、C–E、D–F、E–F。'),
                     T(r"The network of question 10, as printed.", r"第 10 题的网络，和卷面一样。")),
                 h(T('Reading it slowly', '慢慢读一遍')),
                 ul(T(r"**A vector** is a list of distances, one per destination, in the order A to F. B's vector says how far B believes it is from A, B, C, D, E and F.", r"**向量**是一串距离，每个目的地一个，按 A 到 F 的顺序。B 的向量说的是 B 认为自己离 A、B、C、D、E、F 各有多远。"),
                    T(r"**The distances from C to B, D and E**: C's own measurements of its three links, for instance their delay. C's neighbours are exactly B, D and E.", r"**C 到 B、D、E 的距离**：C 自己测得的三条链路的长度，比如延迟。C 的邻居正好就是 B、D、E。"),
                    T(r"**The new vector for C**, with **outgoing lines**: C's distance to every node, and which neighbour to send through to get it.", r"**C 的新向量**，以及**出口线路**：C 到每个节点的距离，以及要达到这个距离该从哪个邻居发出去。"),
                    T(r"**6 marks**: the method, the six distances, and the six lines.", r"**6 分**：方法、六个距离、六条出口线路。")),
                 chapter=Q10),
            read('dv', T('Distance vector: ask the neighbours', '距离向量：问邻居'),
                 p(T(r"No router sees the whole network. In **distance vector routing** each router keeps a table of the lowest known distance to every destination and the line used to get there. It knows the distance to each of its neighbours, and periodically it sends its vector to them. When the vectors arrive, it recomputes every entry: for each destination, try each neighbour, add the length of the link to that neighbour to the distance the neighbour reports, and keep the smallest sum. The neighbour that gave it is the outgoing line. The course's phrase: global information, shared locally.",
                     r"没有一台路由器能看见整个网络。在**距离向量路由**里，每台路由器有一张表，记着到每个目的地已知的最短距离，以及走哪条线。它知道到每个邻居的距离，并定期把自己的向量发给邻居。向量一到，它就把每一项重算一遍：对每个目的地，逐个试邻居，把到这个邻居的链路长度加上邻居报来的距离，留下最小的和。给出这个最小值的邻居，就是出口线路。课上的说法：全局的信息，在局部交换。")),
                 math_(r'D_C(X) = \min_{N \in \{B,\,D,\,E\}} \big(\, c(C, N) + D_N(X) \,\big)'),
                 p(T(r"Here $D_C(X)$ is C's new distance to destination $X$, $c(C, N)$ the length of C's link to neighbour $N$, and $D_N(X)$ the distance $N$ reported. It is right because of the course's **optimality principle**: if C's best path to A goes through E, the rest of it is E's best path to A, so E's reported distance is exactly what C needs.",
                     r"其中 $D_C(X)$ 是 C 到目的地 $X$ 的新距离，$c(C, N)$ 是 C 到邻居 $N$ 的链路长度，$D_N(X)$ 是 $N$ 报来的距离。这样算是对的，依据是课上的**最优性原理**：如果 C 到 A 的最佳路径经过 E，那么这条路径剩下的部分就是 E 到 A 的最佳路径，所以 E 报来的距离正是 C 需要的。")),
                 svg(drawn(fig_dv_net, True), T("The same six routers with C's three links marked: C–B 7, C–D 4, C–E 6.", '同样的六台路由器，标出了 C 的三条链路：C–B 7、C–D 4、C–E 6。'),
                     T(r"C's three links, the only lengths C measures itself. Everything else comes from the neighbours' vectors.", r"C 的三条链路，C 自己测量的只有这三个长度。其余的全都来自邻居的向量。")),
                 p(T(r"One thing C does not use: its own old vector. The new table is built from the fresh vectors alone, so that a route that has got worse is noticed.", r"C 不用的一样东西：它自己的旧向量。新表只用刚收到的向量来算，这样某条路变差了才能被发现。"))),
            derive('q10-worked', T('The new vector, row by row', '新向量，逐行算'),
                   [(r'A:\ \min(7 + 5,\ 4 + 15,\ 6 + 5) = 11', T(r"To A: through B $7 + 5 = 12$, through D $4 + 15 = 19$, through E $6 + 5 = 11$. Through E is shortest: 11, line E.", r"到 A：经 B 是 $7 + 5 = 12$，经 D 是 $4 + 15 = 19$，经 E 是 $6 + 5 = 11$。经 E 最短：11，出口 E。")),
                    (r'B:\ \min(7 + 0,\ 4 + 11,\ 6 + 10) = 7', T(r"To B: the direct link wins: 7, line B.", r"到 B：直连最短：7，出口 B。")),
                    (r'C:\ 0', T(r"C to itself.", r"C 到自己。")),
                    (r'D:\ \min(7 + 11,\ 4 + 0,\ 6 + 10) = 4', T(r"To D: direct, 4, line D.", r"到 D：直连，4，出口 D。")),
                    (r'E:\ \min(7 + 10,\ 4 + 10,\ 6 + 0) = 6', T(r"To E: direct, 6, line E.", r"到 E：直连，6，出口 E。")),
                    (r'F:\ \min(7 + 7,\ 4 + 11,\ 6 + 3) = 9', T(r"To F: C has no link to F, so it goes through a neighbour: 14 through B, 15 through D, 9 through E. Line E.", r"到 F：C 和 F 之间没有直连，只能经邻居：经 B 是 14，经 D 是 15，经 E 是 9。出口 E。")),
                    (r'(11,\ 7,\ 0,\ 4,\ 6,\ 9)', T(r"C's new vector, in the order A to F.", r"C 的新向量，按 A 到 F 的顺序。"))],
                   blank=(5, '9', T(r"To F: $\min(7 + 7,\ 4 + 11,\ 6 + 3)$. What is C's distance to F?", r"到 F：$\min(7 + 7,\ 4 + 11,\ 6 + 3)$。C 到 F 的距离是多少？")),
                   outro=T(r"**Answer:** C's new vector is (11, 7, 0, 4, 6, 9), with outgoing lines (E, B, –, D, E, E).", r"**答案：**C 的新向量是 (11, 7, 0, 4, 6, 9)，出口线路依次是 (E, B, –, D, E, E)。"),
                   skill=DV),
            read('q10-answer', T('Question 10: a full-mark answer', '第 10 题：满分答案'),
                 p(T(r"The method in one sentence, the three sums (one vector per neighbour), then the table the question asks for.", r"用一句话写方法，写出三组和（每个邻居一个向量），再给出题目要的那张表。")),
                 paper(PEA(10),
                       T(r"For each destination, C takes the minimum over its neighbours of (the distance from C to the neighbour + the neighbour's distance to the destination).", r"对每个目的地，C 在各邻居中取（C 到该邻居的距离 + 该邻居到目的地的距离）的最小值。"),
                       T(r"Via B: 7 + (5, 0, 7, 11, 10, 7) = (12, 7, 14, 18, 17, 14). Via D: 4 + (15, 11, 4, 0, 10, 11) = (19, 15, 8, 4, 14, 15). Via E: 6 + (5, 10, 6, 10, 0, 3) = (11, 16, 12, 16, 6, 9).", r"经 B：7 + (5, 0, 7, 11, 10, 7) = (12, 7, 14, 18, 17, 14)。经 D：4 + (15, 11, 4, 0, 10, 11) = (19, 15, 8, 4, 14, 15)。经 E：6 + (5, 10, 6, 10, 0, 3) = (11, 16, 12, 16, 6, 9)。"),
                       T(r"New vector for C: (11, 7, 0, 4, 6, 9), with outgoing lines (E, B, –, D, E, E):", r"C 的新向量：(11, 7, 0, 4, 6, 9)，出口线路为 (E, B, –, D, E, E)："),
                       answer=True),
                 table([T('Destination', '目的地'), T('Outgoing line', '出口线路'), T('Distance', '距离')],
                       ['A', 'E', '11'], ['B', 'B', '7'], ['C', '–', '0'], ['D', 'D', '4'], ['E', 'E', '6'], ['F', 'E', '9'])),
            read('wider', T('Distance vector against link state', '距离向量对比链路状态'),
                 p(T(r"Distance vector has a known weakness, which the course gives as its reason for the alternative: it takes too long to converge after the network changes. Good news spreads quickly, one hop per exchange. Bad news spreads slowly. If a link fails, the neighbours still advertise routes that went through it, each router believes the others, and the distances creep up one exchange at a time: the **count-to-infinity** problem.",
                     r"距离向量有个出名的弱点，课上正是拿它来引出另一种算法：网络一变，它要很久才能收敛。好消息传得快，每交换一次往前走一跳。坏消息传得慢。一条链路断了，邻居们还在通告经过它的路由，每台路由器都相信别人，距离每交换一次才往上涨一点：这就是**无穷计数**（count-to-infinity）问题。")),
                 p(T(r"**Link state routing** shares the information the other way round: local information, shared globally. Each router measures the distance to each neighbour, puts them in a **link state packet**, and floods it to every router. Every router then holds the whole map and computes its own shortest paths with Dijkstra's algorithm. It needs more computation and memory, but it converges quickly; OSPF, widely used on the Internet, works this way.",
                     r"**链路状态路由**反过来分享信息：局部的信息，全局地分享。每台路由器测量到各邻居的距离，写进一个**链路状态分组**，再泛洪给所有路由器。于是每台路由器都有整张地图，自己用 Dijkstra 算法算最短路径。它要更多的计算和内存，但收敛快；互联网上广泛使用的 OSPF 就是这样工作的。")),
                 table([T('Aspect', '方面'), T('Distance vector', '距离向量'), T('Link state', '链路状态')],
                       [T('Sends', '发送什么'), T('its whole vector', '自己的整个向量'), T('its links to its neighbours', '自己到邻居的链路')],
                       [T('To', '发给谁'), T('its neighbours only', '只发给邻居'), T('every router (flooding)', '所有路由器（泛洪）')],
                       [T('Computes', '怎么算'), T('min over neighbours', '在邻居中取最小'), T("Dijkstra on the whole map", '在整张图上跑 Dijkstra')],
                       [T('After a change', '网络变化后'), T('slow (count to infinity)', '慢（无穷计数）'), T('fast', '快')]),
                 chapter=WIDER_CH()),
            choice('try-dv', T('Your turn: a worse route through E', '你来：经 E 的路变差了'), DV,
                   T(r"Suppose E's vector had said its distance to F is 12 instead of 3, with everything else as in the question. What is C's new route to F?", r"假设 E 的向量里，它到 F 的距离是 12 而不是 3，其余都和题目一样。C 到 F 的新路由是什么？"),
                   [(T('14, through B', '14，经 B'), True),
                    (T('9, through E, as before', '9，和原来一样经 E'), T(r"C does not keep its old entries: the new vector is built from the fresh vectors alone, and E now offers $6 + 12 = 18$.", r"C 不保留旧的表项：新向量只用刚收到的向量来算，而 E 现在给出的是 $6 + 12 = 18$。"), 'dv-own-old'),
                    (T('18, through E', '18，经 E'), T(r"Through E is now the worst of the three: B offers $7 + 7 = 14$.", r"经 E 现在是三条里最差的：B 给出的是 $7 + 7 = 14$。"))],
                   T(r"$\min(7 + 7,\ 4 + 11,\ 6 + 12) = \min(14, 15, 18) = 14$, through B.", r"$\min(7 + 7,\ 4 + 11,\ 6 + 12) = \min(14, 15, 18) = 14$，经 B。"), chapter=TRY_CH()),
            choice('try-route', T('Your turn: two packets, two paths', '你来：两个分组，两条路'), CM,
                   T(r"Two packets of the same message reach the destination by different paths, the second before the first. Which network layer service allows this?", r"同一条消息的两个分组走不同的路到达目的地，第二个比第一个先到。哪种网络层服务会出现这种情况？"),
                   [(T('Connectionless (datagrams)', '无连接（数据报）'), True),
                    (T('Connection-oriented (virtual circuits)', '面向连接（虚电路）'), T(r"On a virtual circuit every packet follows the path set up at the start, in order.", r"在虚电路上，每个分组都沿着一开始建好的路径按顺序走。"))],
                   T(r"Each datagram is routed independently, so when a table changes between them, they can take different paths and overtake each other.", r"每个数据报独立选路，两个分组之间路由表一变，它们就可能走不同的路，后发的还可能先到。")),
            choice('try-ls', T('Your turn: which algorithm', '你来：哪种算法'), LS,
                   T(r"In which routing algorithm does every router learn the whole network map and compute its own shortest paths?", r"在哪种路由算法里，每台路由器都知道整张网络图，并自己计算最短路径？"),
                   [(T('Link state', '链路状态'), True),
                    (T('Distance vector', '距离向量'), T(r"A distance vector router knows only its neighbours and their vectors, never the map.", r"距离向量的路由器只知道邻居和邻居的向量，从来看不到整张图。"))],
                   T(r"Link state floods every router's link costs to all routers, and each runs Dijkstra on the full map.", r"链路状态把每台路由器的链路长度泛洪给所有路由器，每台再在整张图上跑 Dijkstra。")),
        ],
    )


PRIMITIVES = [('SOCKET', 'Create a new communication endpoint', '新建一个通信端点'), ('BIND', 'Associate a local address (IP address and port) with a socket', '把一个本地地址（IP 地址和端口）关联到套接字上'),
              ('LISTEN', 'Announce willingness to accept connections; give the queue size', '表示愿意接受连接；给出等待队列的长度'), ('ACCEPT', 'Wait for and accept an incoming connection', '等待并接受一个到来的连接'),
              ('CONNECT', 'Actively attempt to establish a connection', '主动尝试建立连接'), ('SEND', 'Send some data over the connection', '通过连接发送数据'),
              ('RECEIVE', 'Receive some data from the connection', '从连接接收数据'), ('CLOSE', 'Release the connection', '释放连接')]


def L_pe_tcp():
    SK, WN, FC, TW, CG = 'uk72ey.sockets', '4952m9.tcp-window', 'fvccxy.flow-vs-congestion', 'fvccxy.tcp-two-windows', 'fvccxy.congestion-goodput'
    Q12, Q11 = T('Question 12: a client without bind', '第 12 题：不用 bind 的客户端'), T('Question 11: two windows', '第 11 题：两个窗口')
    return dict(
        id=f'{CID}-pe-tcp', title=T("A TCP connection: why a client skips bind, and the sender's two windows (Q12, Q11)", '一条 TCP 连接：客户端为什么不用 bind，以及发送方的两个窗口（第 12、11 题）'),
        description=T('What the socket primitives do and why only the server needs a known port; what the flow control window and the congestion window each protect, and what breaks if a sender ignores them.', '套接字原语各做什么，为什么只有服务器需要一个公开的端口；流量控制窗口和拥塞窗口各保护谁，发送方不守它们会坏在哪里。'),
        minutes=35,
        skills=skills(SK, WN, FC, TW, CG),
        misconceptions=[{'id': 'client-needs-port', 'description': T('Thinking a client must bind a fixed port so that replies can find it', '以为客户端必须绑定一个固定端口，回复才找得到它')},
                        {'id': 'one-window', 'description': T('Thinking the flow control window and the congestion window protect the same thing', '以为流量控制窗口和拥塞窗口保护的是同一个对象')}],
        steps=[
            read('q12', T('Question 12, as printed', '第 12 题原文'),
                 paper(PE(12, 2), T(r"Explain why a TCP client would not typically invoke the bind primitive.", r"解释为什么 TCP 客户端通常不调用 bind 原语。")),
                 h(T('Reading it slowly', '慢慢读一遍')),
                 ul(T(r"**A TCP client** is the side that starts a connection: a browser, a mail program. The **server** waits for clients to connect.", r"**TCP 客户端**是发起连接的一方：浏览器、邮件程序。**服务器**等着客户端来连。"),
                    T(r"**The bind primitive**: one of the Berkeley socket primitives, the calls a program makes to use TCP. BIND attaches a local address, an IP address and a port, to a socket.", r"**bind 原语**：伯克利套接字的原语之一，也就是程序使用 TCP 时调用的那些操作。BIND 把一个本地地址（IP 地址加端口）绑定到套接字上。"),
                    T(r"**Would not typically**: usually it does not, though it may. The answer must say why it can do without, and who does the job instead.", r"**通常不**：一般不调用，但也可以调用。答案要说清它为什么可以不调用，以及这件事由谁代劳。")),
                 chapter=Q12),
            read('primitives', T('The socket primitives', '套接字原语'),
                 p(T(r"A **socket** is a transport endpoint that a program creates and the operating system manages. The course's Berkeley socket primitives:", r"**套接字**（socket）是一个传输端点，由程序创建、由操作系统管理。课上讲的伯克利套接字原语：")),
                 table([T('Primitive', '原语'), T('What it does', '作用')], *[[n, T(en, zh)] for n, en, zh in PRIMITIVES]),
                 {'type': 'code', 'lang': 'text', 'code': 'SERVER                         CLIENT\nsocket()                       socket()\nbind(port 80)\nlisten()\naccept()   <-- connection -->  connect(128.250.1.7, 80)\nreceive() / send()             send() / receive()\nclose()                        close()'},
                 p(T(r"The two columns are not symmetric: the server calls **bind** (and listen and accept), the client goes straight from socket to **connect**.", r"两列并不对称：服务器调用 **bind**（还有 listen 和 accept），客户端从 socket 直接就到了 **connect**。"))),
            read('why-bind', T('Who needs a known address', '谁需要一个公开的地址'),
                 p(T(r"A server binds because clients must be able to find it. It attaches its socket to a **well-known port** (80 for the web, 25 for mail), and every client that wants the service connects to that IP address and port.",
                     r"服务器要 bind，是因为客户端得找得到它。它把套接字绑定到一个**知名端口**（网页 80，邮件 25），想要这项服务的客户端都连这个 IP 地址和端口。")),
                 p(T(r"Nobody connects to a client: the client is the one who calls. So its address need not be known in advance, and the operating system can choose it. When the client calls **connect**, the operating system binds the socket for it: the local IP address of the interface the connection leaves by, and a free **dynamic** (ephemeral) port. The connection request carries that address and port as its source, so the server learns them when the request arrives and sends its replies there.",
                     r"没有人会去连客户端：打电话的是客户端自己。所以它的地址不必事先公开，可以交给操作系统来选。客户端调用 **connect** 时，操作系统替它完成绑定：本地 IP 地址取连接出去的那个网络接口的地址，端口取一个空闲的**动态端口**（临时端口）。连接请求把这个地址和端口作为源地址带过去，服务器收到请求时就知道了，回复也就发回那里。")),
                 p(T(r"A fixed port would even get in the way: two copies of the same client on one machine would both want it. A client binds by hand only when it must send from a particular address or port, for example on a host with several network interfaces.",
                     r"固定端口反而碍事：同一台机器上开两个同样的客户端，会抢同一个端口。只有必须从某个特定地址或端口发出时，客户端才自己 bind，比如一台有好几个网络接口的主机。")),
                 quiz(T(r"A browser opens two tabs on the same web server. How do the server's replies reach the right tab?", r"浏览器在同一个网站上开了两个标签页。服务器的回复怎样到达正确的标签页？"),
                      [(T(r"Each tab's connection was given its own dynamic port, so the two connections differ in the client's port", r"每个标签页的连接都分到了自己的动态端口，两条连接的客户端端口不同"), True),
                       (T(r"The browser bound each tab to a fixed port of its own", r"浏览器给每个标签页绑定了自己的固定端口"), T(r"No bind is needed: the operating system picks a free port at connect.", r"不需要 bind：connect 时操作系统会挑一个空闲端口。"), 'client-needs-port'),
                       (T(r"By the client's IP address", r"靠客户端的 IP 地址"), T(r"Both tabs share the laptop's IP address; only the port tells them apart.", r"两个标签页共用笔记本的 IP 地址；只有端口能把它们分开。"))],
                      T(r"A TCP connection is identified by four numbers: the client's IP and port, the server's IP and port. The two tabs differ in the client's port, which the operating system chose.", r"一条 TCP 连接由四个数标识：客户端的 IP 和端口、服务器的 IP 和端口。两个标签页的客户端端口不同，而这个端口是操作系统挑的。"))),
            read('q12-answer', T('Question 12: a full-mark answer', '第 12 题：满分答案'),
                 p(T(r"Two marks, two links: who binds the client's socket instead (the operating system, at connect), and why the client's port need not be known (the server learns it from the request). A line on why the server *must* bind makes the contrast clear.",
                     r"2 分，两环：客户端的套接字由谁来绑定（操作系统，在 connect 时），以及为什么客户端的端口不必事先知道（服务器从请求里得知）。再加一句服务器为什么*必须* bind，对比就清楚了。")),
                 paper(PEA(12),
                       T(r"A TCP client does not need a fixed, known port, because no one connects to it: it initiates the connection. When it calls connect, the operating system automatically binds the socket to a local IP address and a free dynamic port. The server does not need to know the client's port in advance; it learns the client's address and port from the incoming connection request and replies to them. (A server, by contrast, must bind to a well-known port so that clients can find it.)",
                         r"TCP 客户端不需要固定的、公开的端口，因为没有人去连接它：是它发起连接。它调用 connect 时，操作系统自动把套接字绑定到一个本地 IP 地址和一个空闲的动态端口。服务器不需要事先知道客户端的端口；它从到来的连接请求中得知客户端的地址和端口，并向它们回复。（相反，服务器必须绑定一个知名端口，客户端才能找到它。）"),
                       answer=True)),
            read('q11', T('Question 11, as printed', '第 11 题原文'),
                 paper(PE(11, 4), T(r"Explain the role of each of the following windows, and describe the potential failures that might occur if a host transmitting data ignored them.", r"说明下面每个窗口的作用，并描述发送数据的主机若无视它们可能出现的故障。"),
                       T(r"(1) The flow control window", r"(1) 流量控制窗口"),
                       T(r"(2) The congestion control window", r"(2) 拥塞控制窗口")),
                 h(T('Reading it slowly', '慢慢读一遍')),
                 ul(T(r"**A window** is how much data the sender may have sent but not yet had acknowledged. A TCP sender keeps two of them.", r"**窗口**是发送方可以发出、但还没得到确认的数据量。TCP 发送方同时守着两个窗口。"),
                    T(r"**The role** of each: what it protects, and who sets it.", r"每个窗口的**作用**：它保护谁，由谁来定。"),
                    T(r"**Potential failures if ignored**: what goes wrong, and where it goes wrong. 4 marks: a role and a failure for each window.", r"**无视它们可能出现的故障**：会出什么错，错在哪里。4 分：每个窗口一个作用、一个故障。")),
                 chapter=Q11),
            read('two-windows', T('Two things a sender can overrun', '发送方可能压垮的两样东西'),
                 p(T(r"A TCP sender may have at most one window of unacknowledged data in flight, so it sends about one window per round trip: its rate is roughly the window divided by the RTT. Two different things can be overrun by a sender that sends too fast, and each has its own window.",
                     r"TCP 发送方在路上的未确认数据最多只能有一窗，所以每个往返大约发一窗：速率约等于窗口除以 RTT。发得太快，会压垮两样不同的东西，各由一个窗口来管。")),
                 svg(drawn(fig_windows), T('A sender, three routers with queues, and a receiver with a partly full buffer. Over the routers: the congestion window, what the network can take. Over the receiver: the flow control window, the free buffer space. The sender sends min(cwnd, rwnd) per RTT.',
                                           '一个发送方、三台带队列的路由器、一个缓冲区半满的接收方。路由器上方：拥塞窗口，网络承受得了多少。接收方上方：流量控制窗口，缓冲区剩余空间。发送方每个 RTT 发 min(cwnd, rwnd)。'),
                     T(r"Two limits on one sender: the receiver's free buffer, and the network's queues. It obeys the smaller.", r"一个发送方，两道限制：接收方缓冲区的剩余空间，以及网络里的队列。它听小的那个。")),
                 ul(T(r"**The flow control window** protects the **receiver**. In every segment it sends back, the receiver advertises how much free space is left in its buffer, and the sender must not have more unacknowledged data than that. It matters when a fast sender meets a slow receiver, or an application that is slow to read. At a window of 0 the sender stops (and now and then sends a tiny probe, in case the window update was lost).",
                      r"**流量控制窗口**保护的是**接收方**。接收方在发回的每个报文段里通告自己缓冲区还剩多少空间，发送方在路上的未确认数据不能超过这个量。快的发送方碰上慢的接收方、或者读数据很慢的应用时，它就起作用了。窗口为 0 时发送方停下（隔一阵发一个很小的探测报文，以防窗口更新丢了）。"),
                    T(r"**The congestion window** protects the **network**: the routers' queues along the path. Nobody advertises it; the sender estimates it itself, raising it while all goes well and cutting it when a segment is lost (slow start and additive increase, as in the congestion-control lesson).",
                      r"**拥塞窗口**保护的是**网络**：路径上各路由器的队列。没有谁会通告它；发送方自己估计，一切顺利就调大，丢了报文段就调小（慢启动和加法增大，拥塞控制那一课讲过）。")),
                 p(T(r"The sender obeys both: at most $\min(\text{cwnd}, \text{rwnd})$ unacknowledged data in flight.", r"发送方两个都要守：路上的未确认数据最多 $\min(\text{cwnd}, \text{rwnd})$。"))),
            read('failures', T('What breaks when a window is ignored', '无视窗口会坏在哪里'),
                 p(T(r"**Ignore the flow control window**, and data arrives faster than the receiving application takes it. The buffer fills and overflows, and the receiver has to **drop** arriving segments. The sender times out and sends them again, so the bandwidth spent on them was wasted, and the transfer is slower, not faster.",
                     r"**无视流量控制窗口**，数据来得比接收方应用取走得快。缓冲区装满、溢出，接收方只好**丢弃**新到的报文段。发送方超时后重发，花在它们身上的带宽白费了，传输反而更慢。")),
                 p(T(r"**Ignore the congestion window**, and the queues at the busiest router on the path fill up. Delay grows, then the router drops packets, many of them, from every connection that crosses it. Senders time out and retransmit, adding still more traffic, until the network carries mostly copies and little useful data, the **goodput**, gets through: congestion collapse. A sender that ignores its congestion window also takes an unfair share from the connections that respect theirs.",
                     r"**无视拥塞窗口**，路径上最忙的那台路由器的队列就会塞满。延迟越来越大，接着路由器开始丢包，丢得很多，所有经过它的连接都受影响。发送方超时重传，又加了更多流量，最后网络运的大多是副本，真正有用的数据（**有效吞吐量** goodput）没多少能通过：拥塞崩溃。无视拥塞窗口的发送方，还会从守规矩的连接那里抢走不公平的份额。")),
                 quiz(T(r"A receiver's buffer is full, and it advertises a window of 0. Which failure is the sender being asked to avoid?", r"接收方的缓冲区满了，它通告的窗口是 0。这是在请发送方避免哪种故障？"),
                      [(T(r"Segments dropped at the receiver because there is no room for them", r"报文段因为没地方放，在接收方被丢掉"), True),
                       (T(r"Packets dropped in routers' queues along the path", r"分组在路径上的路由器队列里被丢掉"), T(r"That is what the congestion window prevents. The window the receiver advertises is about its own buffer.", r"那是拥塞窗口要避免的。接收方通告的窗口只关乎它自己的缓冲区。"), 'one-window')],
                      T(r"The advertised window is the receiver's free buffer space: flow control. The network's queues are the congestion window's business.", r"通告的窗口是接收方缓冲区的剩余空间：流量控制。网络里的队列归拥塞窗口管。"))),
            derive('rate', T('Which window sets the pace', '哪个窗口说了算'),
                   [(r'W = \min(W_c,\ W_r)', T(r"The sender may have at most the smaller window in flight: $W_c$ is the congestion window, $W_r$ the window the receiver advertises. Take $W_c = 12$ KB, $W_r = 8$ KB and an RTT of 10 ms.", r"发送方在路上的数据最多是两个窗口中较小的那个：$W_c$ 是拥塞窗口，$W_r$ 是接收方通告的窗口。设 $W_c = 12$ KB，$W_r = 8$ KB，RTT 为 10 ms。")),
                    (r'W = \min(12,\ 8) = 8\ \text{KB}', T(r"Here the receiver's buffer is the limit.", r"这里限制来自接收方的缓冲区。")),
                    (r'R \approx \frac{W}{\text{RTT}}', T(r"The rate $R$: about one window per round trip.", r"速率 $R$：每个往返大约一窗。")),
                    (r'\frac{8 \times 1024 \times 8\ \text{bits}}{0.01\ \text{s}} \approx 6.6 \times 10^6\ \text{bits/s}', T(r"8 KB is 65 536 bits, sent every 10 ms: about 6.6 Mbps.", r"8 KB 是 65 536 位，每 10 ms 发一次：约 6.6 Mbps。"))],
                   blank=(1, '8', T(r"The congestion window is 12 KB and the advertised window 8 KB. How many KB may be in flight?", r"拥塞窗口 12 KB，通告窗口 8 KB。路上最多能有多少 KB？")),
                   outro=T(r"If the receiver frees its buffer and advertises 64 KB, the congestion window becomes the limit: 12 KB every 10 ms, about 9.8 Mbps. Whichever is smaller decides.", r"如果接收方腾出缓冲区、通告 64 KB，限制就换成了拥塞窗口：每 10 ms 12 KB，约 9.8 Mbps。哪个小，哪个说了算。"),
                   skill=TW),
            read('q11-answer', T('Question 11: a full-mark answer', '第 11 题：满分答案'),
                 p(T(r"For each window: what it is, whom it protects, and the failure, with where the packets are lost (at the receiver, or in the network).", r"每个窗口写三样：它是什么、保护谁、出什么故障，并说明包丢在哪里（在接收方，还是在网络里）。")),
                 paper(PEA(11),
                       T(r"(1) The flow control window is the free buffer space advertised by the receiver; its role is to prevent the sender from sending more data than the receiving host can store in its buffer. If the sender ignored it, the receiver's buffer would overflow and the receiver would drop the arriving segments, which must then be retransmitted, wasting bandwidth.",
                         r"(1) 流量控制窗口是接收方通告的缓冲区剩余空间；作用是防止发送方发出超过接收主机缓冲区所能存放的数据。发送方若无视它，接收方缓冲区会溢出，接收方会丢弃到达的报文段，这些报文段必须重传，浪费带宽。"),
                       T(r"(2) The congestion window is the sender's estimate of how much data the network can carry; its role is to prevent the sender from overloading the network, i.e. the routers' queues along the path. If the sender ignored it, router queues would overflow, so the network would add delay and drop many packets; the resulting retransmissions add more load, and the useful throughput (goodput) of every connection sharing the path can collapse.",
                         r"(2) 拥塞窗口是发送方对网络能承载多少数据的估计；作用是防止发送方让网络（即路径上各路由器的队列）过载。发送方若无视它，路由器队列会溢出，网络会增加延迟并丢弃大量分组；由此产生的重传进一步加重负载，共用这条路径的所有连接的有效吞吐量可能崩溃。"),
                       T(r"The sender may have at most min(flow control window, congestion window) of unacknowledged data in flight.", r"发送方在途的未确认数据最多为 min(流量控制窗口, 拥塞窗口)。"),
                       answer=True)),
            read('wider', T('Flow control and congestion control, side by side', '流量控制和拥塞控制，并排看'),
                 table([T('Aspect', '方面'), T('Flow control', '流量控制'), T('Congestion control', '拥塞控制')],
                       [T('Protects', '保护'), T('the receiver', '接收方'), T('the network', '网络')],
                       [T('Set by', '由谁定'), T("the receiver, advertised in every segment's window field", '接收方，写在每个报文段的窗口字段里'), T('the sender, inferred from losses', '发送方，根据丢包推断')],
                       [T('Problem it prevents', '防止的问题'), T('a fast sender overruns a slow receiver', '快的发送方压垮慢的接收方'), T('too much traffic for the routers in the middle', '流量多得中间的路由器扛不住')],
                       [T('Where packets are lost', '包丢在哪里'), T("at the receiver's buffer", '接收方的缓冲区'), T("in routers' queues", '路由器的队列')]),
                 p(T(r"A test for which one a situation is about: who is too slow? If it is the receiving host, flow control; if it is something in between, congestion control. A fast receiver on a slow, crowded path needs congestion control and no flow control at all.",
                     r"判断一个情形归哪个管，就问：谁太慢了？是接收主机，就是流量控制；是中间的某处，就是拥塞控制。快的接收方隔着一条又慢又挤的路径，需要的就只有拥塞控制，完全用不上流量控制。")),
                 chapter=WIDER_CH()),
            choice('try-which', T('Your turn: whose window', '你来：谁的窗口'), FC,
                   T(r"A gigabit server sends a large file to a fast laptop over a path whose slowest link is a busy 10 Mbps line. Which window will mostly limit the sender?", r"一台千兆服务器给一台很快的笔记本发大文件，路径上最慢的一段是一条繁忙的 10 Mbps 线路。主要是哪个窗口在限制发送方？"),
                   [(T('The congestion window', '拥塞窗口'), True),
                    (T('The flow control window', '流量控制窗口'), T(r"The laptop is fast and keeps its buffer empty; the bottleneck is in the middle of the network.", r"笔记本很快，缓冲区总是空的；瓶颈在网络中间。"), 'one-window')],
                   T(r"The slow, busy link is in the network, so losses there keep the congestion window small; the laptop's advertised window stays large.", r"又慢又忙的那段链路在网络里，那里的丢包让拥塞窗口一直偏小；笔记本通告的窗口一直很大。"), chapter=TRY_CH()),
            text_q('try-server-bind', T('Your turn: why the server binds', '你来：服务器为什么要 bind'), SK,
                   T(r"Why must a TCP server call bind, while a client usually need not?", r"为什么 TCP 服务器必须调用 bind，而客户端通常不用？"),
                   [T("Clients must know the server's address and port in advance: the server binds to a well-known port", '客户端必须事先知道服务器的地址和端口：服务器绑定知名端口'),
                    T('Nobody connects to the client; the operating system binds it to a dynamic port at connect', '没人去连客户端；connect 时操作系统给它绑定一个动态端口'),
                    T("The server learns the client's port from the connection request", '服务器从连接请求里得知客户端的端口')],
                   T(r"Clients must be able to find the server, so it binds its socket to a well-known port that clients connect to. Nobody connects to a client, so the operating system binds the client's socket to a free dynamic port when it calls connect, and the server learns that port from the incoming request.",
                     r"客户端得找得到服务器，所以服务器把套接字绑定到客户端会去连的知名端口。没人去连客户端，所以客户端调用 connect 时，操作系统把它的套接字绑定到一个空闲的动态端口，服务器再从到来的请求里得知这个端口。"),
                   T(r"The asymmetry comes from who calls whom: the side that waits must be findable.", r"不对称来自谁打给谁：等着被找的一方，必须找得到。")),
            choice('try-drop', T('Your turn: where the loss happens', '你来：丢包发生在哪'), CG,
                   T(r"Many senders ignore their congestion windows and share one router. What happens?", r"很多发送方都无视拥塞窗口，共用一台路由器。会怎样？"),
                   [(T(r"Its queue overflows, packets are dropped, retransmissions add load, and goodput falls for everyone", r"它的队列溢出、丢包，重传加重负载，所有人的有效吞吐量都下降"), True),
                    (T(r"The receivers' buffers overflow", r"接收方的缓冲区溢出"), T(r"The receivers may be idle; the overload is in the router they all share.", r"接收方可能闲着；过载发生在大家共用的那台路由器上。"), 'one-window'),
                    (T(r"Nothing, as long as every receiver advertises a large window", r"没事，只要每个接收方都通告一个大窗口"), T(r"A large advertised window says the receivers have room; it says nothing about the network.", r"通告的窗口大，只说明接收方有地方放；对网络什么都没说。"))],
                   T(r"Congestion is a property of the shared path: only the congestion window, which every sender must respect, keeps it in check.", r"拥塞是共享路径的事：只有每个发送方都守的拥塞窗口才能管住它。")),
        ],
    )


MIME_SAMPLE = '''From: alice@unimelb.edu.au
To: bob@example.com
Subject: Photo
MIME-Version: 1.0
Content-Type: multipart/mixed; boundary="xyz"

--xyz
Content-Type: text/plain; charset=UTF-8

你好 Bob, the photo is attached.
--xyz
Content-Type: image/jpeg
Content-Transfer-Encoding: base64

/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAAMCAgMCAgMDAwMEAwMEBQgFBQQE...
--xyz--'''


def L_pe_apps():
    DP, DS, MI, JB, RT = 'bsjyg8.dns-purpose', 'bsjyg8.dns-other-services', '4ndan6.message-format-mime', '4ndan6.jitter-buffer', '4ndan6.live-and-realtime'
    Q15, Q13, Q14 = T('Question 15: what DNS provides', '第 15 题：DNS 提供什么'), T('Question 13: why MIME', '第 13 题：为什么要 MIME'), T('Question 14: a buffer on a video call', '第 14 题：视频会议里的缓冲')
    return dict(
        id=f'{CID}-pe-apps', title=T('DNS, email and a video call: three short answers (Q15, Q13, Q14)', 'DNS、邮件和视频通话：三道简答题（第 15、13、14 题）'),
        description=T('The services DNS provides besides name lookup, why email needed MIME and how MIME works within SMTP, and why the buffer that smooths a stream is a problem in a conversation.', 'DNS 除了查名字还提供哪些服务，邮件为什么需要 MIME、MIME 怎样在 SMTP 之内工作，以及让流媒体平稳的缓冲为什么在对话里成了问题。'),
        minutes=35,
        skills=skills(DP, DS, MI, JB, RT),
        misconceptions=[{'id': 'mime-replaces-smtp', 'description': T('Thinking MIME replaces SMTP rather than working within it', '以为 MIME 取代了 SMTP，而不是在 SMTP 之内工作')},
                        {'id': 'bigger-buffer-better', 'description': T('Thinking a bigger playout buffer is always better', '以为播放缓冲越大越好')}],
        steps=[
            read('q15', T('Question 15, as printed', '第 15 题原文'),
                 paper(PE(15, 2), T(r"Briefly describe two services that DNS provides using bullet points.", r"用要点简要描述 DNS 提供的两项服务。")),
                 h(T('Reading it slowly', '慢慢读一遍')),
                 ul(T(r"**DNS**, the Domain Name System, is the Internet's directory of names: a distributed database run by many name servers.", r"**DNS**（域名系统）是互联网的名字目录：由许多域名服务器共同维护的一个分布式数据库。"),
                    T(r"**Two services**, 2 marks: two bullets, each naming a service and saying in a sentence what it does. The obvious one counts, and one more is needed.", r"**两项服务**，2 分：两条要点，每条说出一项服务，再用一句话说它做什么。最常见的那项算一项，还得再写一项。")),
                 chapter=Q15),
            read('dns', T('What DNS does', 'DNS 做什么'),
                 p(T(r"Its main job is **name resolution**. People remember names such as www.unimelb.edu.au; packets need IP addresses. DNS translates the name into the address, and only then can anything be sent. The course names three more services, each a different kind of record in the same database:",
                     r"它的主要任务是**域名解析**。人记得住 www.unimelb.edu.au 这样的名字；分组要的是 IP 地址。DNS 把名字翻译成地址，然后才能发东西。课上还讲了另外三项服务，每项对应同一个数据库里的一种记录：")),
                 ul(T(r"**Host aliasing**: an easy name can be an alias for the real, **canonical** name of a host. The course's example: www.unimelb.edu.au is an alias of squizedge-cloud.cms.unimelb.edu.au.", r"**主机别名**：一个好记的名字可以是主机真正的**规范名**（canonical name）的别名。课上的例子：www.unimelb.edu.au 是 squizedge-cloud.cms.unimelb.edu.au 的别名。"),
                    T(r"**Mail server registry**: DNS says which server accepts mail for a domain. A message to someone@unimelb.edu.au first asks DNS for unimelb.edu.au's mail server.", r"**邮件服务器登记**：DNS 告诉你哪台服务器接收某个域的邮件。发往 someone@unimelb.edu.au 的信，先要问 DNS：unimelb.edu.au 的邮件服务器是哪台。"),
                    T(r"**Load distribution and redundancy**: a large site runs several servers, each with its own address, and DNS associates all of them with one canonical name. It rotates the order of the addresses in its replies, so different clients start with different servers; if one server is down, a client can try the next address.", r"**负载分配和冗余**：大网站跑着好几台服务器，各有各的地址，DNS 把它们都关联到同一个规范名上。它在每次回答时轮换地址的顺序，于是不同的客户端从不同的服务器开始；某台服务器坏了，客户端可以试下一个地址。")),
                 svg(drawn(fig_dns_lb), T('A name server answers three clients for www.shop.com with the same three addresses in rotated order: .1 .2 .3, then .2 .3 .1, then .3 .1 .2. Each client connects to the first address it was given, so the three clients reach three different servers.',
                                          '一台域名服务器为 www.shop.com 回答三个客户端，给的是同样三个地址，但顺序轮换：.1 .2 .3、.2 .3 .1、.3 .1 .2。每个客户端连接拿到的第一个地址，于是三个客户端分到了三台不同的服务器。'),
                     T(r"Load distribution: the same three addresses, a different one first each time. Each client takes the first, and the load spreads over the servers.", r"负载分配：同样三个地址，每次排第一的不一样。每个客户端取第一个，负载就分摊到了各台服务器上。"))),
            read('q15-answer', T('Question 15: a full-mark answer', '第 15 题：满分答案'),
                 p(T(r"Two bullets: name resolution, and one of the other three. Each says what DNS does and what for.", r"两条：域名解析，再加另外三项中的一项。每条都说 DNS 做什么、为了什么。")),
                 paper(PEA(15),
                       T(r"Name resolution: DNS translates a host name (e.g. www.unimelb.edu.au) into its IP address, which is needed to send packets to that host.", r"域名解析：DNS 把主机名（例如 www.unimelb.edu.au）翻译成它的 IP 地址，向该主机发送分组需要这个地址。"),
                       T(r"Load distribution: a set of IP addresses of replicated servers is associated with one canonical name, and the DNS server rotates the order of the addresses in its replies, so the clients' requests are spread over the servers (and if one server is down, a client can try another).", r"负载分配：把一组副本服务器的 IP 地址关联到同一个规范名上，DNS 服务器在回答中轮换这些地址的顺序，使客户端的请求分散到各台服务器（某台服务器宕机时，客户端还可以试另一台）。"),
                       answer=True),
                 p(T(r"Also accepted as the second bullet: **host aliasing** (an alias name mapped to the host's canonical name) or the **mail server registry** (finding the server that accepts mail for a domain).", r"第二条也可以写：**主机别名**（把别名映射到主机的规范名），或**邮件服务器登记**（找出接收某个域邮件的服务器）。"))),
            read('q13', T('Question 13, as printed', '第 13 题原文'),
                 paper(PE(13, 3), T(r"Why was MIME introduced as an extension to SMTP, and what limitations did it address?", r"为什么要引入 MIME 作为 SMTP 的扩展？它解决了哪些局限？")),
                 h(T('Reading it slowly', '慢慢读一遍')),
                 ul(T(r"**SMTP** moves mail from the sender's user agent to its mail server and on to the recipient's mail server. It carries a message made of headers and a body.", r"**SMTP** 把邮件从发件人的用户代理送到它的邮件服务器，再送到收件人的邮件服务器。它运的是一封由头部和正文组成的信。"),
                    T(r"**MIME**, Multipurpose Internet Mail Extensions. *An extension*: it adds to email rather than replacing anything.", r"**MIME**，多用途互联网邮件扩展。*扩展*：它是给邮件加东西，不是替换掉什么。"),
                    T(r"**What limitations**: what email could not carry before MIME. 3 marks: the limitation, what MIME adds, what that makes possible.", r"**解决了哪些局限**：有 MIME 之前邮件运不了什么。3 分：局限是什么、MIME 加了什么、因此能做什么。")),
                 chapter=Q13),
            read('mime', T('Email before and after MIME', '有 MIME 之前和之后的邮件'),
                 p(T(r"In the early days of email, messages were in English and used only ASCII, and the message format (RFC 822) and SMTP reflected that: a message is lines of **7-bit ASCII** text. In time the limits became clear. The course lists four: languages with accents (French, Spanish); non-Latin alphabets (Cyrillic); languages without an alphabet (Chinese, Japanese); and content that is not text at all (audio, images).",
                     r"电子邮件早期，信都是英文，只用 ASCII，消息格式（RFC 822）和 SMTP 也是照这个设计的：一封信就是若干行 **7 位 ASCII** 文本。后来局限就显出来了。课上列了四种：带重音的语言（法语、西班牙语）；非拉丁字母（西里尔字母）；不用字母的语言（中文、日文）；以及根本不是文本的内容（音频、图片）。")),
                 p(T(r"MIME's answer is to leave SMTP alone and add **structure and encoding rules** to the message itself. Five new headers say what the body is and how it was wrapped; the two that matter most are **Content-Type** (text/plain, text/html, image/jpeg, video/mp4, ...) and **Content-Transfer-Encoding** (how non-ASCII data is turned into ASCII for the trip). **Base64** turns every 3 bytes into 4 ASCII characters, so any data can travel, at 4/3 of its size. A **multipart** body holds several independent parts, such as text and an attachment, separated by a boundary line.",
                     r"MIME 的办法是不动 SMTP，而是给信本身加上**结构和编码规则**。五个新的头部说明正文是什么、是怎么包装的；最要紧的两个是 **Content-Type**（text/plain、text/html、image/jpeg、video/mp4……）和 **Content-Transfer-Encoding**（为了运送，怎样把非 ASCII 数据变成 ASCII）。**Base64** 把每 3 个字节变成 4 个 ASCII 字符，什么数据都能运，代价是体积变成 4/3。**多部分**（multipart）正文可以装好几个独立的部分，比如正文加一个附件，用一条分隔线隔开。")),
                 {'type': 'code', 'lang': 'text', 'code': MIME_SAMPLE, 'caption': T('A multipart message: a text part in UTF-8 and a JPEG photo in base64, separated by the boundary --xyz.', '一封多部分的信：一部分是 UTF-8 文本，一部分是 base64 编码的 JPEG 照片，用分隔线 --xyz 隔开。')},
                 p(T(r"On the wire, all of it is still 7-bit ASCII lines, so every SMTP server in the world carries a MIME message without knowing anything about MIME. Only the user agents at the two ends need to understand it.",
                     r"在线路上，这一切仍然是一行行 7 位 ASCII 文本，所以全世界的 SMTP 服务器都能照常运送 MIME 邮件，完全不用懂 MIME。只有两端的用户代理需要理解它。")),
                 quiz(T(r"Why is the photo sent in base64 rather than as its raw bytes?", r"照片为什么要用 base64 发，而不是直接发原始字节？"),
                      [(T(r"SMTP carries 7-bit ASCII text; raw bytes could be misread or damaged on the way", r"SMTP 运的是 7 位 ASCII 文本；原始字节在路上可能被误读或损坏"), True),
                       (T(r"To compress it", r"为了压缩"), T(r"Base64 makes data a third larger.", r"Base64 会让数据大三分之一。")),
                       (T(r"Because MIME replaced SMTP with a binary protocol", r"因为 MIME 用二进制协议取代了 SMTP"), T(r"MIME changed the message, not the protocol: SMTP still carries text.", r"MIME 改的是信，不是协议：SMTP 运的仍然是文本。"), 'mime-replaces-smtp')],
                      T(r"Base64 wraps any bytes as plain ASCII characters, which SMTP carries safely; the receiving user agent unwraps them.", r"Base64 把任意字节包装成普通的 ASCII 字符，SMTP 能安全运送；收件方的用户代理再拆开。"))),
            read('q13-answer', T('Question 13: a full-mark answer', '第 13 题：满分答案'),
                 p(T(r"Three links: the limitation (7-bit ASCII, so plain English text only); what MIME adds (content types, encodings such as base64, multipart); what became possible (other languages, non-text content).", r"三环：局限（7 位 ASCII，所以只能是英文纯文本）；MIME 加了什么（内容类型、base64 之类的编码、多部分）；因此能做什么（别的语言、非文本内容）。")),
                 paper(PEA(13),
                       T(r"SMTP and the original message format (RFC 822) only supported 7-bit ASCII text, which limited email to plain English text. MIME was introduced to extend the message format without changing SMTP: it adds headers that give the content type (e.g. text/html, image/jpeg) and a transfer encoding (e.g. base64) that wraps any data as ASCII, and it allows multipart messages. This lets email carry languages with accents and non-Latin or non-alphabetic scripts (e.g. Chinese, in UTF-8), and non-text content such as images, audio, video and attachments.",
                         r"SMTP 和最初的消息格式（RFC 822）只支持 7 位 ASCII 文本，邮件因此只能是英文纯文本。引入 MIME 是为了在不改变 SMTP 的前提下扩展消息格式：它加入了说明内容类型的头部（例如 text/html、image/jpeg）和把任意数据包装成 ASCII 的传输编码（例如 base64），并支持多部分的邮件。这样邮件就能承载带重音的语言、非拉丁或非字母文字（例如 UTF-8 编码的中文），以及图片、音频、视频和附件等非文本内容。"),
                       answer=True)),
            read('q14', T('Question 14, as printed', '第 14 题原文'),
                 paper(PE(14, 2), T(r"A common approach to removing jitter in streaming audio is to buffer incoming packets at the receiver. Briefly explain a key problem using this approach for video conferencing.",
                                    r"消除流式音频中抖动的一种常见做法，是在接收方缓冲到达的分组。简要说明把这种做法用于视频会议时的一个关键问题。")),
                 h(T('Reading it slowly', '慢慢读一遍')),
                 ul(T(r"**Jitter**: the variation in delay from one packet to the next. Packets sent at an even pace arrive unevenly.", r"**抖动**（jitter）：分组与分组之间延迟的变化。匀速发出的分组，到达时却快慢不一。"),
                    T(r"**Buffer incoming packets at the receiver**: hold them for a while before playing them, then play at an even pace.", r"**在接收方缓冲到达的分组**：先攒一会儿再播，然后匀速地播。"),
                    T(r"**Video conferencing** against **streaming audio**: a conversation in both directions, live, against listening to a stream. 2 marks: the property of conferencing, and the problem it causes.", r"**视频会议**对比**流式音频**：双向的、实时的对话，对比单向地听一个流。2 分：视频会议的特点，以及它带来的问题。")),
                 chapter=Q14),
            read('jitter', T('What a buffer costs', '缓冲的代价'),
                 svg(drawn(fig_jitter), T('Six packets sent at an even pace arrive with uneven delays; the fourth arrives very late. With a large buffer, playback starts after 140 and every packet is in time. With a small buffer, playback starts after 80; the fourth packet arrives after its turn and is skipped.',
                                          '六个分组匀速发出，到达时延迟不一；第四个到得很晚。用大缓冲时，播放在 140 之后开始，每个分组都赶得上。用小缓冲时，播放在 80 之后开始；第四个分组过了它的播放时刻才到，被跳过。'),
                     T(r"A buffer hides jitter by waiting. The large buffer plays every packet, but starts late; the small one starts soon and loses the packet that came too late.", r"缓冲靠“等”来掩盖抖动。大缓冲每个分组都播到了，但开始得晚；小缓冲开始得早，却丢掉了那个迟到太久的分组。")),
                 p(T(r"The buffer removes jitter by **adding delay**: every packet is played the length of the buffer after it was sent, early ones wait longer and late ones less. The course's trade-off: a small buffer starts playing quickly but is susceptible to jitter; a large buffer has a delay at the start but is less susceptible.",
                     r"缓冲消除抖动的办法是**加延迟**：每个分组都在发出后、隔着缓冲那么长的时间才播放，早到的多等，晚到的少等。课上讲的取舍：小缓冲开播快，但容易受抖动影响；大缓冲开头有延迟，但不怕抖动。")),
                 p(T(r"For streaming audio, a few seconds of waiting at the start costs nothing: the stream goes one way, and nobody is waiting to reply. A video conference is **two-way and interactive**: every second of buffer is a second before the other side hears you, and a second more before you hear their answer. Replies come late, people interrupt and talk over each other, the conversation stops feeling live. (For telephony, the ITU's guideline G.114 recommends keeping one-way delay below about 150 ms.) So the course's advice for real-time conferencing: keep the buffer **small**, **skip** packets that arrive too late, adjust the video quality, and use the network's quality-of-service support where it exists.",
                     r"对流式音频来说，开头等几秒没什么损失：流是单向的，没人等着回话。视频会议是**双向、交互**的：缓冲多一秒，对方就晚一秒听到你，你也再晚一秒听到对方的回答。回应总是慢半拍，大家互相打断、抢着说话，对话就不像在面对面了。（国际电信联盟 ITU 的 G.114 建议，通话的单向延迟最好不超过约 150 ms。）所以课上对实时会议的建议是：缓冲要**小**，迟到太久的分组直接**跳过**，调整视频质量，网络能提供服务质量保障时就用上。"))),
            read('q14-answer', T('Question 14: a full-mark answer', '第 14 题：满分答案'),
                 p(T(r"Two links: conferencing is two-way and interactive; buffering adds delay, which harms interaction. A third line on what conferencing does instead shows you understand the trade-off.", r"两环：视频会议是双向、交互的；缓冲会增加延迟，而延迟伤害交互。再加一句会议实际怎么做，能看出你懂这个取舍。")),
                 paper(PEA(14),
                       T(r"Video conferencing is a two-way, interactive service. Buffering removes jitter only by delaying playback: every packet waits in the buffer, so the buffer's length is added to the end-to-end delay. A large buffer makes the conversation lag (people wait for replies and talk over each other), so conferencing must keep the buffer small and skip packets that arrive too late, accepting some glitches.",
                         r"视频会议是双向的交互式服务。缓冲消除抖动的代价是推迟播放：每个分组都要在缓冲区里等，缓冲的长度就加到了端到端延迟上。缓冲大了，对话就会滞后（等回应、互相抢话），所以视频会议只能用小缓冲，并跳过迟到太久的分组，接受一些卡顿。"),
                       answer=True)),
            read('wider', T('Three kinds of stream', '三种流媒体'),
                 table([T('Aspect', '方面'), T('Stored media', '点播'), T('Live media', '直播'), T('Real-time conferencing', '实时会议')],
                       [T('Direction', '方向'), T('one way', '单向'), T('one way', '单向'), T('two ways', '双向')],
                       [T('Delay tolerated', '能忍受的延迟'), T('seconds', '几秒'), T('seconds', '几秒'), T('a fraction of a second', '不到一秒')],
                       [T('Buffer', '缓冲'), T('large', '大'), T('large enough to smooth jitter', '够平滑抖动就行'), T('small; late packets skipped', '小；迟到的分组跳过')],
                       [T('Lost packets', '丢包'), T('retransmit (TCP is fine)', '重传（用 TCP 没问题）'), T('TCP in practice', '实际多用 TCP'), T('no time to retransmit: FEC, concealment', '来不及重传：前向纠错、错误掩盖')],
                       [T('Protocols', '协议'), T('HTTP', 'HTTP'), T('HTTP, RTP', 'HTTP、RTP'), T('RTP over UDP; SIP to set up the call', 'RTP 跑在 UDP 上；用 SIP 建立通话')]),
                 p(T(r"Read the table by the first row. Who is waiting for whom decides how much delay is tolerable, and that decides the buffer, how losses are handled and the transport.", r"按第一行来读这张表。谁在等谁，决定了能忍受多少延迟，进而决定了缓冲多大、丢包怎么处理、用什么传输协议。")),
                 chapter=WIDER_CH()),
            choice('try-dns', T('Your turn: three servers, one name', '你来：三台服务器，一个名字'), DS,
                   T(r"A shop's website runs on three servers with different IP addresses. Which DNS service spreads the visitors over them?", r"一家网店的网站跑在三台 IP 地址不同的服务器上。哪项 DNS 服务能把访客分摊到它们上面？"),
                   [(T('Load distribution: one name, all three addresses, in a rotating order', '负载分配：一个名字对应三个地址，顺序轮换'), True),
                    (T('Host aliasing', '主机别名'), T(r"Aliasing maps another name to the canonical name; it does not choose between servers.", r"别名是把另一个名字映射到规范名；它不负责在服务器之间挑选。")),
                    (T('The mail server registry', '邮件服务器登记'), T(r"That finds the server that accepts a domain's mail.", r"那是找接收某个域邮件的服务器。"))],
                   T(r"DNS rotates the order of the addresses in its replies; each client starts with the first, so the load spreads.", r"DNS 在回答里轮换地址的顺序；每个客户端从第一个开始，负载就分开了。"), chapter=TRY_CH()),
            choice('try-mime', T('Your turn: what needed MIME', '你来：哪个需要 MIME'), MI,
                   T(r"Which of these could email not carry before MIME?", r"有 MIME 之前，下面哪个邮件运不了？"),
                   [(T(r"A message written in Chinese", r"一封用中文写的信"), True),
                    (T(r"A plain-text message in English", r"一封英文纯文本的信"), T(r"That is exactly what 7-bit ASCII was designed for.", r"7 位 ASCII 正是为它设计的。"))],
                   T(r"Chinese characters are not in 7-bit ASCII; MIME lets the body declare a character set such as UTF-8 and encode it for the trip.", r"汉字不在 7 位 ASCII 里；MIME 让正文声明字符集（比如 UTF-8），再为运送做编码。")),
            text_q('try-live', T('Your turn: a live match and a phone call', '你来：直播比赛和打电话'), JB,
                   T(r"A live sports stream can buffer 10 seconds, but an Internet phone call cannot. Briefly explain why.", r"一场体育直播可以缓冲 10 秒，网络电话却不行。简要解释为什么。"),
                   [T('The sports stream is one-way: nobody replies, so a fixed delay is not noticed', '体育直播是单向的：没人回话，固定的延迟察觉不到'),
                    T('A call is two-way and interactive: the buffer adds to the delay of every exchange', '通话是双向交互的：缓冲会加到每一次一来一回的延迟上'),
                    T('So a call keeps a small buffer and skips late packets', '所以通话用小缓冲，迟到的分组直接跳过')],
                   T(r"The sports stream goes one way, so a 10-second delay just means the viewer sees everything 10 seconds late, which nobody notices. A call is two-way and interactive: the buffer is added to every exchange, and 10 seconds would make conversation impossible. So a call keeps its buffer small and skips packets that arrive too late.",
                     r"体育直播是单向的，延迟 10 秒只是观众晚 10 秒看到一切，没人会察觉。通话是双向交互的：缓冲会加到每一次一来一回上，10 秒根本没法对话。所以通话用小缓冲，迟到太久的分组直接跳过。"),
                   T(r"The same buffer trade-off, decided by whether anyone is waiting to reply.", r"同一个缓冲取舍，由有没有人等着回话来决定。")),
        ],
    )


def L_pe_keys():
    SY, PK, RS, CA, AT = '3kgkap.symmetric-des-aes', '3kgkap.public-key-basics', '3kgkap.rsa', '3kgkap.certificates-pki', '9ehkyb.attacks-incidents'
    Q17, Q18 = T('Question 17: one key or two', '第 17 题：一把密钥还是两把'), T('Question 18: a public key on a web page', '第 18 题：放在网页上的公钥')
    return dict(
        id=f'{CID}-pe-keys', title=T('Keys: symmetric or public, and the man in the middle (Q17, Q18)', '密钥：对称还是公钥，以及中间人（第 17、18 题）'),
        description=T("What symmetric and public-key algorithms each do and cost, why public keys solve key distribution but need to be trusted, and how a man in the middle exploits a public key published on a personal website.", '对称密钥算法和公钥算法各做什么、各有什么代价，公钥为什么解决了密钥分发、却又需要被信任，以及中间人怎样利用放在个人网站上的公钥。'),
        minutes=35,
        skills=skills(SY, PK, RS, CA, AT),
        misconceptions=[{'id': 'wrong-key', 'description': T('Encrypting a secret message with the sender\'s private key, or the receiver\'s private key', '用发送方的私钥、或接收方的私钥来加密保密消息')},
                        {'id': 'key-proves-owner', 'description': T("Thinking a public key found on Bob's page must be Bob's", '以为在 Bob 网页上找到的公钥就一定是 Bob 的')}],
        steps=[
            read('q17', T('Question 17, as printed', '第 17 题原文'),
                 paper(PE(17, 4), T(r"What are Symmetric and Asymmetric key algorithms? Briefly explain while highlighting differences between these two categories.", r"什么是对称密钥算法和非对称密钥算法？简要解释，并突出这两类之间的区别。")),
                 h(T('Reading it slowly', '慢慢读一遍')),
                 ul(T(r"**Key algorithms**: modern ciphers whose algorithm is public and whose security rests entirely on a secret **key** (Kerckhoffs's principle, from the course).", r"**密钥算法**：现代密码，算法本身是公开的，安全性完全靠一把保密的**密钥**（课上讲的柯克霍夫原则）。"),
                    T(r"**Symmetric** and **asymmetric** (public-key): the two categories, told apart by their keys.", r"**对称**和**非对称**（公钥）：两类算法，靠密钥来区分。"),
                    T(r"**Highlighting differences**: 4 marks, a bullet for each category, and the differences made explicit: the keys, speed, the problem of sharing keys, examples.", r"**突出区别**：4 分，每类一条，并把区别讲明白：密钥、速度、共享密钥的难题、例子。")),
                 chapter=Q17),
            read('two-kinds', T('One shared key, or a pair', '一把共享的钥匙，还是一对'),
                 svg(drawn(fig_keys), T('Top, symmetric: Alice and Bob each hold the same key K, which must have been shared in secret first; the ciphertext travels between them. Bottom, public key: Alice locks with Bob\'s public key E_B, which anyone can have; only Bob\'s private key D_B opens it.',
                                        '上，对称：Alice 和 Bob 各拿着同一把钥匙 K，这把钥匙得事先秘密交给对方；密文在两人之间传。下，公钥：Alice 用人人可得的 Bob 的公钥 E_B 加锁；只有 Bob 的私钥 D_B 能打开。'),
                     T(r"Symmetric: one key on both sides. Public key: anyone can lock a message for Bob, and only Bob can unlock it.", r"对称：两边同一把钥匙。公钥：谁都能给 Bob 上锁，只有 Bob 能开锁。")),
                 p(T(r"**Symmetric-key algorithms** use the **same key** to encrypt and to decrypt. They are built from substitution and permutation, repeated over many rounds: DES (64-bit blocks, a 56-bit key) and AES (128-bit blocks, keys of 128 to 256 bits, the standard since the 2000s). They are fast. Their problem is the key itself: the course's words are that the key had to be distributed to all users of the system. Alice and Bob must agree on a key in secret before they can talk in secret, and every pair of people needs a key of its own.",
                     r"**对称密钥算法**加密和解密用**同一把密钥**。它们由代换和置换反复多轮构成：DES（64 位分组，56 位密钥）和 AES（128 位分组，128 到 256 位密钥，2000 年代以来的标准）。它们很快。问题出在密钥本身：用课上的话说，密钥得分发给系统里的所有用户。Alice 和 Bob 要先秘密地商定一把钥匙，才能秘密地通信，而且每一对人都得有自己的一把。")),
                 p(T(r"**Public-key (asymmetric) algorithms**, the model Diffie and Hellman proposed, use **two keys** that cannot easily be derived from each other. The **public key** $E$ is available to anyone and is used to encrypt messages for its owner; the **private key** $D$ is known only to the owner and decrypts them: $D(E(P)) = P$. Bob publishes $E_B$, and anyone can send him a secret without ever having met him: no secret has to be shared first. The cost is speed: RSA is too slow for large volumes of data, so in practice it carries something small, such as a fresh symmetric key that then encrypts the data.",
                     r"**公钥（非对称）算法**是 Diffie 和 Hellman 提出的模式，用**两把密钥**，而且从一把很难推出另一把。**公钥** $E$ 人人可得，用来给它的主人加密消息；**私钥** $D$ 只有主人知道，用来解密：$D(E(P)) = P$。Bob 公布 $E_B$，谁都能给他发秘密消息，哪怕从没见过面：不需要事先共享任何秘密。代价是速度：RSA 太慢，加密不了大量数据，所以实际中它只运很小的东西，比如一把新的对称密钥，再由这把对称密钥去加密数据。")),
                 p(T(r"The course's RSA example shows the pair: $p = 3$, $q = 11$, so $n = 33$ and $z = (p-1)(q-1) = 20$; $d = 7$ (no common factor with 20) and $e = 3$, since $3 \times 7 \bmod 20 = 1$. The public key is $(3, 33)$, the private key $(7, 33)$.",
                     r"课上的 RSA 例子展示了这一对：$p = 3$，$q = 11$，所以 $n = 33$，$z = (p-1)(q-1) = 20$；$d = 7$（和 20 没有公因数），$e = 3$，因为 $3 \times 7 \bmod 20 = 1$。公钥是 $(3, 33)$，私钥是 $(7, 33)$。")),
                 quiz(T(r"Alice wants to send Bob a secret message with public-key cryptography. Which key does she encrypt with?", r"Alice 想用公钥密码给 Bob 发一条保密消息。她用哪把钥匙加密？"),
                      [(T(r"Bob's public key", r"Bob 的公钥"), True),
                       (T(r"Her own private key", r"她自己的私钥"), T(r"Anyone could undo that with Alice's public key: it proves the message came from her (a signature), but keeps nothing secret.", r"谁都能用 Alice 的公钥解开：这只能证明消息出自她（签名），什么也保不了密。"), 'wrong-key'),
                       (T(r"Bob's private key", r"Bob 的私钥"), T(r"Only Bob has it; that is what makes it the key that decrypts.", r"只有 Bob 有它；正因如此，它才是用来解密的那把。"), 'wrong-key')],
                      T(r"Lock with the receiver's public key; only the receiver's private key unlocks.", r"用接收方的公钥上锁；只有接收方的私钥能开。"))),
            derive('pairs', T('How many keys a group needs', '一群人需要多少把密钥'),
                   [(r'\binom{n}{2} = \frac{n(n-1)}{2}', T(r"Symmetric: every pair of people needs its own secret key, so a group of $n$ needs one key per pair.", r"对称：每一对人都要有自己的秘密密钥，$n$ 个人就要每对一把。")),
                    (r'\frac{100 \times 99}{2} = 4950', T(r"For 100 people: 4950 keys, each delivered secretly to two people.", r"100 个人：4950 把，每把都要秘密地交到两个人手里。")),
                    (r'2n = 200', T(r"Public key: one pair per person, 200 keys, and the 100 public ones may be published.", r"公钥：每人一对，200 把，其中 100 把公钥可以公开。"))],
                   blank=(1, '4950', T(r"How many keys for 100 people, one per pair? $\frac{100 \times 99}{2}$", r"100 个人，每对一把，要多少把？$\frac{100 \times 99}{2}$")),
                   outro=T(r"That is the key distribution problem in numbers, and why public keys were such a change: nothing secret has to travel.", r"这就是密钥分发难题的数量级，也是公钥意义重大的原因：不需要任何秘密在路上传。"),
                   skill=PK),
            read('q17-answer', T('Question 17: a full-mark answer', '第 17 题：满分答案'),
                 p(T(r"A bullet for each, written in matched pairs: the keys (one shared, or a public and private pair), an example, the strength, the weakness.", r"每类一条，成对地写：密钥（共享一把，还是公私一对）、例子、长处、短处。")),
                 table([T('Aspect', '方面'), T('Symmetric', '对称'), T('Asymmetric (public key)', '非对称（公钥）')],
                       [T('Keys', '密钥'), T('one secret key, shared', '一把共享的秘密密钥'), T('a public key and a private key', '一把公钥和一把私钥')],
                       [T('Encrypt / decrypt', '加密 / 解密'), T('the same key', '同一把'), T("receiver's public / receiver's private", '接收方公钥 / 接收方私钥')],
                       [T('Examples', '例子'), T('DES, AES', 'DES、AES'), T('RSA', 'RSA')],
                       [T('Speed', '速度'), T('fast', '快'), T('slow', '慢')],
                       [T('Key distribution', '密钥分发'), T('the key must be shared secretly in advance', '密钥必须事先秘密共享'), T('public keys can be published', '公钥可以公开')]),
                 paper(PEA(17),
                       T(r"Symmetric-key algorithms use the same secret key for both encryption and decryption (e.g. DES, AES). They are fast, which suits large amounts of data, but the key has to be shared secretly in advance with every communicating partner: the key distribution problem.",
                         r"对称密钥算法加密和解密使用同一把秘密密钥（例如 DES、AES）。它们速度快，适合大量数据，但密钥必须事先秘密地分享给每个通信对象：这就是密钥分发问题。"),
                       T(r"Asymmetric (public-key) algorithms use two different keys that cannot easily be derived from each other: a public key, available to anyone and used to encrypt messages for its owner, and a private key, known only to the owner and used to decrypt them (e.g. RSA). They solve the key distribution problem, since public keys can be published, but they are much slower, so in practice they are used to exchange symmetric keys and for digital signatures.",
                         r"非对称（公钥）算法使用两把不同、且难以相互推导的密钥：公钥人人可得，用来加密发给其主人的消息；私钥只有主人知道，用来解密（例如 RSA）。由于公钥可以公开，它们解决了密钥分发问题，但速度慢得多，所以实际中用于交换对称密钥和数字签名。"),
                       answer=True)),
            read('q18', T('Question 18, as printed', '第 18 题原文'),
                 paper(PE(18, 3), T(r"What is man-in-the-middle attack problem in publishing public keys on a personal website? Briefly describe the attack and potential consequences using bullet points.",
                                    r"把公钥发布在个人网站上，会有什么样的中间人攻击问题？用要点简要描述这种攻击及其可能的后果。")),
                 h(T('Reading it slowly', '慢慢读一遍')),
                 ul(T(r"**Publishing public keys on a personal website**: the course asks how to get someone's public key before you can talk, and this is the first, naive answer: Bob puts $E_B$ on his home page.", r"**把公钥发布在个人网站上**：课上问过，通信之前怎样拿到对方的公钥，这是第一个、也是最天真的答案：Bob 把 $E_B$ 放在自己的主页上。"),
                    T(r"**Man-in-the-middle**: an attacker, called Trudy, sits between the two parties, relays what they send, and can read or change it while each believes they talk to the other directly.", r"**中间人**：攻击者（叫 Trudy）夹在两方中间，转发他们发的东西，还能读、能改，而双方都以为自己在直接和对方说话。"),
                    T(r"**The attack and potential consequences**, 3 marks: how Trudy gets in, what she then does, what is lost.", r"**攻击及其可能的后果**，3 分：Trudy 怎样插进来，接着做了什么，造成了什么损失。")),
                 chapter=Q18),
            read('mitm', T('The weak point of a public key', '公钥的软肋'),
                 p(T(r"Public keys removed the need to share a secret, but they brought a new need: Alice must be sure that the key she uses really is Bob's. Anyone can make a key pair and call the public half *Bob's key*.",
                     r"公钥免去了共享秘密的需要，却带来一个新的需要：Alice 得确信她用的那把钥匙真的是 Bob 的。谁都能生成一对密钥，然后管其中的公钥叫“Bob 的公钥”。")),
                 svg(drawn(fig_mitm), T("Alice, Trudy and Bob. 1: Alice asks for Bob's public key. 2: Trudy answers with her own key E_T on a fake page. 3: Alice sends E_T(P). Trudy decrypts with D_T, reads and changes P. 4: Trudy sends E_B(P') to Bob.",
                                        '三列：Alice、Trudy、Bob。1：Alice 请求 Bob 的公钥。2：Trudy 用假页面回给她自己的公钥 E_T。3：Alice 发出 E_T(P)。Trudy 用 D_T 解密，读到并改掉 P。4：Trudy 把 E_B(P′) 发给 Bob。'),
                     T(r"Trudy answers for Bob's web page with her own key. Everything Alice sends is then readable and changeable by Trudy before it reaches Bob.", r"Trudy 冒充 Bob 的网页，给出自己的公钥。此后 Alice 发的一切，在到达 Bob 之前都能被 Trudy 读到、改掉。")),
                 ol(T(r"Trudy can intercept Alice's traffic (on the same network, or by tampering with the route to Bob's site). When Alice fetches Bob's page, Trudy returns a **fake page** with her own public key $E_T$ in place of $E_B$.", r"Trudy 能截获 Alice 的流量（在同一个网络上，或者篡改通往 Bob 网站的路由）。Alice 去取 Bob 的网页时，Trudy 返回一个**假页面**，把 $E_B$ 换成了她自己的公钥 $E_T$。"),
                    T(r"Alice encrypts her message with $E_T$, believing it is Bob's key.", r"Alice 以为 $E_T$ 是 Bob 的公钥，用它加密了消息。"),
                    T(r"Trudy decrypts it with her private key $D_T$, **reads** it, and may **change** it.", r"Trudy 用她的私钥 $D_T$ 解密，**读到**内容，还可能**改掉**它。"),
                    T(r"She encrypts the result with Bob's real key $E_B$ and sends it on. Bob decrypts it normally. Neither Alice nor Bob sees anything wrong.", r"她再用 Bob 真正的公钥 $E_B$ 加密，转发出去。Bob 照常解密。Alice 和 Bob 都看不出任何异样。")),
                 quiz(T(r"Why does Bob not notice anything?", r"Bob 为什么什么都察觉不到？"),
                      [(T(r"The message he receives is encrypted with his own public key and decrypts correctly", r"他收到的消息是用他自己的公钥加密的，能正常解密"), True),
                       (T(r"Trudy has stolen Bob's private key", r"Trudy 偷到了 Bob 的私钥"), T(r"She never needs it: she re-encrypts with Bob's public key, which is public.", r"她根本用不着：她用的是 Bob 的公钥重新加密，而公钥本来就是公开的。")),
                       (T(r"Bob's web page itself was changed on his server", r"Bob 服务器上的网页本身被改了"), T(r"Not necessarily: Trudy only has to answer Alice's request, on the way between Alice and the server.", r"不一定：Trudy 只需要在 Alice 和服务器之间的路上回应 Alice 的请求。"))],
                      T(r"From Bob's side, a message arrives encrypted with his public key and decrypts into sensible text. Nothing in it says who encrypted it.", r"在 Bob 看来，来了一条用他的公钥加密的消息，解出来也是通顺的话。消息里没有任何东西说明是谁加的密。"))),
            read('q18-answer', T('Question 18: a full-mark answer', '第 18 题：满分答案'),
                 p(T(r"The bullets follow the attack: the fake key, Alice's encryption, Trudy's decrypt-and-re-encrypt; then the consequences, named as security properties.", r"要点顺着攻击走：假公钥、Alice 加密、Trudy 解密再加密；然后是后果，用安全属性的名称说出来。")),
                 paper(PEA(18),
                       T(r"If Bob publishes his public key E_B on his personal website, Trudy, who can intercept Alice's traffic, returns a fake copy of the page containing her own public key E_T instead.", r"如果 Bob 把公钥 E_B 发布在个人网站上，能截获 Alice 流量的 Trudy 就返回一个伪造的页面副本，里面换成了她自己的公钥 E_T。"),
                       T(r"Alice, believing E_T is Bob's key, encrypts her message with it. Trudy decrypts it with her private key D_T, reads and possibly modifies it, re-encrypts it with E_B and forwards it to Bob, who decrypts it normally, so neither notices.", r"Alice 以为 E_T 是 Bob 的公钥，用它加密消息。Trudy 用自己的私钥 D_T 解密，读取并可能修改内容，再用 E_B 加密后转发给 Bob；Bob 能正常解密，所以双方都察觉不到。"),
                       T(r"Consequences: confidentiality is lost (Trudy reads every message) and data integrity is lost (she can change them undetected); Alice is also deceived about whom she is talking to (authenticity).", r"后果：失去机密性（Trudy 能读到所有消息），失去数据完整性（她能不被察觉地篡改消息）；Alice 对通信对象的身份也被欺骗了（真实性）。"),
                       answer=True)),
            read('wider', T('Certificates: binding a key to a name', '证书：把公钥和名字绑在一起'),
                 p(T(r"The attack works because nothing ties the key on the page to Bob. The course's fix is a **certificate**: a document that binds a public key to the name of a person or a company, signed by a **certification authority** (CA), a trusted intermediary that checks identity outside the network before it certifies a key. The format is **X.509**. CAs are organised in a hierarchy, the **public key infrastructure** (PKI): a root CA certifies regional CAs, which certify others.",
                     r"攻击之所以得逞，是因为没有任何东西把页面上的公钥和 Bob 联系起来。课上的解决办法是**证书**：一份把公钥和个人或公司的名字绑定在一起的文件，由**认证机构**（CA）签名。CA 是一个可信的中间方，在为一把公钥出证书之前，会在网络之外核实身份。格式是 **X.509**。CA 按层级组织，构成**公钥基础设施**（PKI）：根 CA 为区域 CA 出证书，区域 CA 再为别人出证书。")),
                 p(T(r"Trudy can still copy Bob's certificate, but it contains Bob's key, not hers. She cannot make a certificate for her own key in Bob's name, because she cannot forge the CA's signature; Alice checks that signature with the CA's public key, which her browser already holds. The same weakness, and the same fix, appear in Diffie–Hellman key exchange and in the authentication protocol of the sample-question unit.",
                     r"Trudy 还是可以复制 Bob 的证书，可证书里是 Bob 的公钥，不是她的。她没法用 Bob 的名字给自己的公钥做一张证书，因为她伪造不了 CA 的签名；Alice 用 CA 的公钥来验证这个签名，而这把公钥她的浏览器里本来就有。同样的弱点和同样的补救，在 Diffie–Hellman 密钥交换和样题单元里的认证协议中也会出现。")),
                 chapter=WIDER_CH()),
            choice('try-verify', T('Your turn: checking a certificate', '你来：验证一张证书'), CA,
                   T(r"Alice receives a certificate for Bob's public key. Which key does she use to check it?", r"Alice 收到一张 Bob 公钥的证书。她用哪把钥匙来验证它？"),
                   [(T(r"The CA's public key", r"CA 的公钥"), True),
                    (T(r"Bob's public key, from the certificate", r"证书里的 Bob 的公钥"), T(r"That is the key in question; a forger would put their own key there.", r"那正是待验证的钥匙；伪造者会在那里放上自己的。"), 'key-proves-owner'),
                    (T(r"The CA's private key", r"CA 的私钥"), T(r"Only the CA has it: it signs with it. Anyone verifies with the CA's public key.", r"只有 CA 有它：CA 用它来签名。任何人都用 CA 的公钥来验证。"))],
                   T(r"The CA signed the binding of Bob's name to his key with its private key; Alice checks the signature with the CA's public key, which she already trusts.", r"CA 用自己的私钥签了“Bob 的名字对应这把公钥”；Alice 用她早已信任的 CA 公钥来验证签名。"), chapter=TRY_CH()),
            number('try-keys', T('Your turn: ten people', '你来：十个人'), SY,
                   T(r"Ten people each want to talk privately with each of the others using symmetric keys. How many keys are needed?", r"十个人，每人都想和其他每个人用对称密钥私下通信。一共需要多少把密钥？"),
                   45, T(r"One key per pair: $\frac{10 \times 9}{2} = 45$. With public keys, 10 key pairs.", r"每对一把：$\frac{10 \times 9}{2} = 45$。用公钥的话，10 对。"), tolerance=0, purpose='check'),
            text_q('try-cert', T('Your turn: how a certificate stops Trudy', '你来：证书怎样挡住 Trudy'), CA,
                   T(r"Briefly explain how a certificate prevents the man-in-the-middle attack on Bob's published public key.", r"简要说明证书怎样防止针对 Bob 所公布公钥的中间人攻击。"),
                   [T("A CA signs a certificate binding Bob's name to his public key", 'CA 签发一张证书，把 Bob 的名字和他的公钥绑定'),
                    T("Alice verifies the signature with the CA's public key, which she already trusts", 'Alice 用她早已信任的 CA 公钥验证签名'),
                    T("Trudy cannot forge the CA's signature, so she cannot pass off her key as Bob's", 'Trudy 伪造不了 CA 的签名，所以没法把自己的公钥冒充成 Bob 的')],
                   T(r"A certification authority signs a certificate that binds Bob's name to his public key. Alice verifies the signature with the CA's public key, which she already trusts. Trudy cannot forge the CA's signature, so she cannot produce a valid certificate that binds her own key to Bob's name, and a fake key is detected.",
                     r"认证机构签发一张证书，把 Bob 的名字和他的公钥绑定在一起。Alice 用她早已信任的 CA 公钥验证这个签名。Trudy 伪造不了 CA 的签名，就做不出一张把她自己的公钥绑到 Bob 名下的有效证书，假公钥就会被识破。"),
                   T(r"Public-key cryptography is only as trustworthy as the binding between a key and a name.", r"公钥密码可靠与否，取决于公钥和名字之间的绑定是否可靠。")),
        ],
    )


def mixed(make):
    """The right answer is written first in every question above; this spreads it. Choice checkpoints are
    shuffled when shown, and each in-page quiz moves its right option to a different place."""
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


PRACTICE_LESSONS = [mixed(f) for f in (L_pe_start, L_pe_physical, L_pe_frames, L_pe_windows, L_pe_addresses, L_pe_routing, L_pe_tcp, L_pe_apps, L_pe_keys)]
PRACTICE_UNIT = T('Practice exam: every question, explained', '期末模拟卷：逐题精讲')
